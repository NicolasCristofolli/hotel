import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultHotelConfig } from '../config/defaultHotelConfig';
import { starterConfig } from '../config/starterConfig';
import { mergeConfig } from '../lib/mergeConfig';
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
  | { status: 'merged' } //  saved, combined with another admin's simultaneous changes
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
  /** Demo mode only: back to the sample hotel. */
  reset: () => void;
  restore: (config: unknown) => void;
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

// config_rev (0008) goes up on every content change; a save only goes through if nobody saved in between.
// select('*') keeps working on a database that doesn't have that column yet (saves then skip the check).
type HotelRow = { name: string; config: unknown; config_rev?: number };
const fetchRow = async (db: NonNullable<typeof supabase>) => {
  const { data, error } = await db.from('hotels').select('*').eq('id', HOTEL_ID).maybeSingle();
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
  /** Last version this browser saw in the database — the common ancestor when merging a concurrent save. */
  const base = useRef<{ rev: number | null; config: HotelConfig } | null>(null);

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

  const applyRemote = useCallback((raw: unknown, name?: string, rev?: number) => {
    // A null config means "never saved" — show the neutral starter under the hotel's name (first admin save creates it).
    const remote = normalize(raw as Partial<HotelConfig> | null) ?? (name ? starterConfig(name) : null);
    // While this browser is editing, the remote version is only recorded as the base: the next save merges it.
    if (remote && rev !== undefined) base.current = { rev, config: remote };
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
        applyRemote(row.config, row.name, row.config_rev ?? -1);
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
        const row = payload.new as HotelRow;
        applyRemote(row.config, row.name, row.config_rev ?? -1);
      })
      .subscribe();

    return () => {
      alive = false;
      db.removeChannel(channel);
    };
  }, [isAdmin, applyRemote]);

  const save = useCallback(async () => {
    if (!supabase) return;
    const db = supabase;
    setSync({ status: 'saving' });
    let merged = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const rev = base.current?.rev ?? -1;
      const mine = latest.current;
      let q = db.from('hotels').update({ config: mine }).eq('id', HOTEL_ID);
      if (rev >= 0) q = q.eq('config_rev', rev);
      const { data, error } = await q.select('*');
      if (error) return setSync({ status: 'error', message: `Erro ao salvar: ${error.message}` });
      const saved = (data as HotelRow[] | null)?.[0];
      if (saved) {
        base.current = { rev: saved.config_rev ?? -1, config: mine };
        // Republish the guests' CDN snapshot. If this fails the database is still correct; "Tentar de novo" republishes.
        try {
          await publishConfig(mine);
          setSync(merged ? { status: 'merged' } : { status: 'synced' });
        } catch (e) {
          setSync({ status: 'error', message: `Salvo, mas não publicado para os hóspedes: ${(e as Error).message}` });
        }
        return;
      }
      // 0 rows: either another admin saved in between (revision moved on) or no permission (RLS hides the row).
      const row = rev >= 0 ? await fetchRow(db).catch(() => null) : null;
      const theirs = row && normalize(row.config as Partial<HotelConfig>);
      if (!row || row.config_rev === rev || !theirs || !base.current) break;
      const combined = mergeConfig(base.current.config, latest.current, theirs);
      base.current = { rev: row.config_rev ?? -1, config: theirs };
      latest.current = combined;
      setState(combined);
      merged = true;
    }
    setSync({ status: 'error', message: 'Sem permissão para salvar. Entre com uma conta de administrador.' });
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
  /** Puts back a saved version (from the history) — saved as a new version, so it can be undone too. */
  const restore = useCallback(
    (raw: unknown) => {
      const c = normalize(raw as Partial<HotelConfig>);
      if (!c) throw new Error('Versão incompatível com esta versão do painel.');
      setConfig(() => c);
    },
    [setConfig],
  );

  const value = useMemo(
    () => ({ config, setConfig, patch, reset, restore, sync, retry: save, presence }),
    [config, setConfig, patch, reset, restore, sync, save, presence],
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
