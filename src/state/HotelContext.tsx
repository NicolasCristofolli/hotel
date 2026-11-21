import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultHotelConfig } from '../config/defaultHotelConfig';
import type { HotelConfig } from '../types';

const STORAGE_KEY = 'guia-hospede:config:v1';

type Ctx = {
  config: HotelConfig;
  setConfig: (updater: (prev: HotelConfig) => HotelConfig) => void;
  patch: <K extends keyof HotelConfig>(key: K, value: HotelConfig[K]) => void;
  reset: () => void;
};

const HotelContext = createContext<Ctx | null>(null);

function load(): HotelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultHotelConfig;
    const parsed = JSON.parse(raw) as Partial<HotelConfig>;
    if (parsed.version !== defaultHotelConfig.version) return defaultHotelConfig;
    // Shallow-merge so newly added config keys get sensible defaults.
    return {
      ...defaultHotelConfig,
      ...parsed,
      identity: { ...defaultHotelConfig.identity, ...parsed.identity },
      theme: { ...defaultHotelConfig.theme, ...parsed.theme },
    };
  } catch {
    return defaultHotelConfig;
  }
}

export function HotelProvider({ children }: { children: ReactNode }) {
  const [config, setState] = useState<HotelConfig>(load);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [config]);

  // Cross-tab live sync (admin in one tab, guest view in another)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
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

  const setConfig = useCallback((updater: (prev: HotelConfig) => HotelConfig) => setState(updater), []);
  const patch = useCallback(<K extends keyof HotelConfig>(key: K, value: HotelConfig[K]) => setState((p) => ({ ...p, [key]: value })), []);
  const reset = useCallback(() => setState(defaultHotelConfig), []);

  const value = useMemo(() => ({ config, setConfig, patch, reset }), [config, setConfig, patch, reset]);
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
