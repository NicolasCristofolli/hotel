import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultHotelConfig } from '../config/defaultHotelConfig';
import { fetchPublicConfig, publishConfig } from '../lib/publicConfig';
import { HOTEL_ID, isRemote, supabase } from '../lib/supabase';
import { hotelKey } from '../lib/tenant';
import type { HotelConfig } from '../types';

const STORAGE_KEY = hotelKey('guia-hospede:config:v1');
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

/**
 * Whether this hotel's content can be shown. Never falls back to the demo hotel's content in remote mode,
 * so a new or mistyped hotel URL can't briefly show another hotel.
 */
export type Presence = 'loading' | 'ready' | 'missing' | 'offline';

type Ctx = {
  config: HotelConfig;
  setConfig: (updater: (prev: HotelConfig) => HotelConfig) => void;
  patch: <K extends keyof HotelConfig>(key: K, value: HotelConfig[K]) => void;
  reset: () => void;
  sync: SyncState;
  /** Retry a failed save. */
  retry: () => void;
  presence: Presence;
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

function readCache(): HotelConfig | null {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}
const loadCache = () => readCache() ?? defaultHotelConfig;

/** A hotel that exists but was never saved (config null): the template, under the hotel's own name. */
function starterConfig(name: string): HotelConfig {
  const words = name
    .replace(/^(hotel|pousada|resort)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return {
    ...defaultHotelConfig,
    identity: {
      ...defaultHotelConfig.identity,
      name,
      shortName: words.join(' ') || name,
      monogram:
        words
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || name.slice(0, 2).toUpperCase(),
    },
  };
}

type HotelRow = { name: string; config: unknown };
const fetchRow = async (db: NonNullable<typeof supabase>) => {
  const { data, error } = await db.from('hotels').select('name, config').eq('id', HOTEL_ID).maybeSingle();
  if (error) throw new Error(error.message);
  return data as HotelRow | null;
};

export function HotelProvider({ children }: { children: ReactNode }) {
  // The local cache renders instantly (and offline); the database is the source of truth when configured.
  const [config, setState] = useState<HotelConfig>(loadCache);
  const [sync, setSync] = useState<SyncState>(isRemote ? { status: 'loading' } : { status: 'local' });
  // Demo mode always has content; remote mode needs this hotel's cache or its first fetch.
  const [presence, setPresence] = useState<Presence>(() => (!isRemote || readCache() ? 'ready' : 'loading'));
  const lastLocalEdit = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(config);
  latest.current = config;

  // Persist cache (only real content of this hotel — never a placeholder)
  useEffect(() => {
    if (presence !== 'ready') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [config, presence]);

  // Which audience is reading: the admin panel needs the live database; guests read the CDN snapshot.
  const [isAdmin, setIsAdmin] = useState(isAdminHash);
  useEffect(() => {
    const onHash = () => setIsAdmin(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const applyRemote = useCallback((raw: unknown, name?: string) => {
    // A null config means "never saved" — show the template under the hotel's name (first admin save creates it).
    const remote = normalize(raw as Partial<HotelConfig> | null) ?? (name ? starterConfig(name) : null);
    if (remote && Date.now() - lastLocalEdit.current > 3000) setState(remote);
    setPresence('ready');
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
        const raw = await fetchPublicConfig();
        if (raw !== null) {
          if (alive) applyRemote(raw);
        } else {
          // Not published yet (hotel never saved, or URL of a hotel that doesn't exist) → ask the database once.
          const row = await fetchRow(db);
          if (!alive) return;
          if (!row) return setPresence('missing');
          applyRemote(row.config, row.name);
        }
        setSync({ status: 'synced' });
      } catch (e) {
        // The local cache keeps the portal usable offline / if the CDN hiccups; without one, say so.
        if (!alive) return;
        setSync({ status: 'error', message: `Não foi possível atualizar: ${(e as Error).message}` });
        setPresence((p) => (p === 'loading' ? 'offline' : p));
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

    fetchRow(db).then(
      (row) => {
        if (!alive) return;
        if (!row) return setPresence('missing');
        applyRemote(row.config, row.name);
        setSync({ status: 'synced' });
      },
      (e: Error) => {
        if (!alive) return;
        setSync({ status: 'error', message: `Não foi possível carregar do banco: ${e.message}` });
        setPresence((p) => (p === 'loading' ? 'offline' : p));
      },
    );

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

  const value = useMemo(
    () => ({ config, setConfig, patch, reset, sync, retry: save, presence }),
    [config, setConfig, patch, reset, sync, save, presence],
  );
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
