import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultHotelConfig } from '../config/defaultHotelConfig';
import { fetchPublicConfig, publishConfig } from '../lib/publicConfig';
import { HOTEL_ID, isRemote, supabase } from '../lib/supabase';
import type { HotelConfig } from '../types';

const STORAGE_KEY = 'guia-hospede:config:v1';
const SAVE_DELAY = 800;
/** How often an open guest portal re-checks the CDN snapshot. */
const REVALIDATE_MS = 5 * 60_000;

const isAdminHash = () => /^#\/?admin/.test(window.location.hash);

export type SyncState =
  | { status: 'local' } //  no Supabase configured — this browser only
  | { status: 'loading' }
  | { status: 'synced' }
  | { status: 'saving' }
  | { status: 'error'; message: string };

type Ctx = {
  config: HotelConfig;
  setConfig: (updater: (prev: HotelConfig) => HotelConfig) => void;
  patch: <K extends keyof HotelConfig>(key: K, value: HotelConfig[K]) => void;
  reset: () => void;
  sync: SyncState;
  /** Retry a failed save. */
  retry: () => void;
};

const HotelContext = createContext<Ctx | null>(null);

/** Merge a stored/remote config over the defaults so newly added keys get sensible values. */
function normalize(parsed: Partial<HotelConfig> | null | undefined): HotelConfig | null {
  if (!parsed || parsed.version !== defaultHotelConfig.version) return null;
  return {
    ...defaultHotelConfig,
    ...parsed,
    identity: { ...defaultHotelConfig.identity, ...parsed.identity },
    theme: { ...defaultHotelConfig.theme, ...parsed.theme },
  };
}

function loadCache(): HotelConfig {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? defaultHotelConfig;
  } catch {
    return defaultHotelConfig;
  }
}

export function HotelProvider({ children }: { children: ReactNode }) {
  // The local cache renders instantly (and offline); the database is the source of truth when configured.
  const [config, setState] = useState<HotelConfig>(loadCache);
  const [sync, setSync] = useState<SyncState>(isRemote ? { status: 'loading' } : { status: 'local' });
  const lastLocalEdit = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(config);
  latest.current = config;

  // Persist cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [config]);

  // Which audience is reading: the admin panel needs the live database; guests read the CDN snapshot.
  const [isAdmin, setIsAdmin] = useState(isAdminHash);
  useEffect(() => {
    const onHash = () => setIsAdmin(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const applyRemote = useCallback((raw: unknown) => {
    const remote = normalize(raw as Partial<HotelConfig> | null);
    // A null config means "never saved" — keep the defaults (first admin save creates it).
    if (remote && Date.now() - lastLocalEdit.current > 3000) setState(remote);
  }, []);

  // Guests: published snapshot on the Storage CDN — no database query, no realtime connection.
  // Revalidated when the guest comes back to the tab and every few minutes while it's visible.
  useEffect(() => {
    if (!supabase || isAdmin) return;
    const db = supabase;
    let alive = true;
    let lastCheck = 0;

    const refresh = async () => {
      lastCheck = Date.now();
      try {
        let raw = await fetchPublicConfig();
        if (raw === null) {
          // Not published yet (no admin save since the CDN snapshot shipped) → read the database once.
          const { data, error } = await db.from('hotels').select('config').eq('id', HOTEL_ID).maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error(`Hotel "${HOTEL_ID}" não encontrado no banco. Rode o SQL de instalação.`);
          raw = data.config;
        }
        if (!alive) return;
        applyRemote(raw);
        setSync({ status: 'synced' });
      } catch (e) {
        // The local cache keeps the portal usable offline / if the CDN hiccups.
        if (alive) setSync({ status: 'error', message: `Não foi possível atualizar: ${(e as Error).message}` });
      }
    };

    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > REVALIDATE_MS / 5) refresh();
    };
    const timer = setInterval(() => document.visibilityState === 'visible' && refresh(), REVALIDATE_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAdmin, applyRemote]);

  // Admin: database (source of truth) + realtime, so two admins editing at once see each other's changes.
  useEffect(() => {
    if (!supabase || !isAdmin) return;
    const db = supabase;
    let alive = true;
    setSync({ status: 'loading' });

    db.from('hotels')
      .select('config')
      .eq('id', HOTEL_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) return setSync({ status: 'error', message: `Não foi possível carregar do banco: ${error.message}` });
        if (!data) return setSync({ status: 'error', message: `Hotel "${HOTEL_ID}" não encontrado no banco. Rode o SQL de instalação.` });
        applyRemote(data.config);
        setSync({ status: 'synced' });
      });

    const channel = db
      .channel(`hotel:${HOTEL_ID}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hotels', filter: `id=eq.${HOTEL_ID}` }, (payload) => {
        // Ignore echoes while this browser is editing, so typing isn't overwritten by an older save.
        applyRemote((payload.new as { config?: unknown }).config);
      })
      .subscribe();

    return () => {
      alive = false;
      db.removeChannel(channel);
    };
  }, [isAdmin, applyRemote]);

  const save = useCallback(async () => {
    if (!supabase) return;
    setSync({ status: 'saving' });
    const { data, error } = await supabase.from('hotels').update({ config: latest.current }).eq('id', HOTEL_ID).select('id');
    if (error) setSync({ status: 'error', message: `Erro ao salvar: ${error.message}` });
    // RLS turns an unauthorized update into "0 rows" rather than an error.
    else if (!data?.length) setSync({ status: 'error', message: 'Sem permissão para salvar. Entre com uma conta de administrador.' });
    else {
      // Republish the guests' CDN snapshot. If this fails the database is still correct; "Tentar de novo" republishes.
      try {
        await publishConfig(latest.current);
        setSync({ status: 'synced' });
      } catch (e) {
        setSync({ status: 'error', message: `Salvo, mas não publicado para os hóspedes: ${(e as Error).message}` });
      }
    }
  }, []);

  const scheduleSave = useCallback(() => {
    lastLocalEdit.current = Date.now();
    if (!supabase) return;
    setSync({ status: 'saving' });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, SAVE_DELAY);
  }, [save]);

  // Don't lose the last keystrokes when the tab closes mid-debounce.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current && Date.now() - lastLocalEdit.current < SAVE_DELAY + 100) save();
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [save]);

  // Cross-tab live sync (local mode: admin in one tab, guest view in another)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && !isRemote) setState(loadCache());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Theme → CSS variables
  useEffect(() => {
    const r = document.documentElement.style;
    const t = config.theme;
    r.setProperty('--color-primary', t.primary);
    r.setProperty('--color-bg', t.bg);
    r.setProperty('--color-surface', t.surface);
    r.setProperty('--color-accent', t.accent);
    r.setProperty('--color-text-main', t.textMain);
    r.setProperty('--color-text-muted', t.textMuted);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.primary);
    document.title = `Guia do Hóspede — ${config.identity.name}`;
  }, [config.theme, config.identity.name]);

  // Only the admin panel edits the config, so every edit is also a save.
  const setConfig = useCallback(
    (updater: (prev: HotelConfig) => HotelConfig) => {
      setState(updater);
      scheduleSave();
    },
    [scheduleSave],
  );
  const patch = useCallback(
    <K extends keyof HotelConfig>(key: K, value: HotelConfig[K]) => setConfig((p) => ({ ...p, [key]: value })),
    [setConfig],
  );
  const reset = useCallback(() => setConfig(() => defaultHotelConfig), [setConfig]);

  const value = useMemo(() => ({ config, setConfig, patch, reset, sync, retry: save }), [config, setConfig, patch, reset, sync, save]);
  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be used inside <HotelProvider>');
  return ctx;
}

/** Current time, refreshed every 30s — drives live "Aberto agora" badges. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
