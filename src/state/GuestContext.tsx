import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Tiny router for the guest portal.
 *  - "hash" mode: the main portal, URL-addressable (#/mapa/p4) so QR codes can deep-link.
 *  - "memory" mode: the embedded live preview inside the Admin panel.
 */
export type GuestRoute = { path: string; view: string; param?: string; query: URLSearchParams };

type Ctx = {
  route: GuestRoute;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
  back: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  contactOpen: boolean;
  setContactOpen: (v: boolean) => void;
  wifiOpen: boolean;
  setWifiOpen: (v: boolean) => void;
  embedded: boolean;
};

const GuestContext = createContext<Ctx | null>(null);

const parse = (path: string): GuestRoute => {
  const [p, q = ''] = path.split('?');
  const [view = '', param] = p.split('/').filter(Boolean);
  return { path, view, param, query: new URLSearchParams(q) };
};

const readHash = () => window.location.hash.replace(/^#\/?/, '');

export function GuestProvider({ children, mode }: { children: ReactNode; mode: 'hash' | 'memory' }) {
  const [stack, setStack] = useState<string[]>(() => [mode === 'hash' ? readHash() : '']);
  const depth = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'hash') return;
    const onHash = () => setStack((s) => [...s.slice(0, -1), readHash()]);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [mode]);

  const closeOverlays = () => {
    setDrawerOpen(false);
    setContactOpen(false);
    setWifiOpen(false);
  };

  const navigate = useCallback(
    (path: string, opts?: { replace?: boolean }) => {
      closeOverlays();
      if (mode === 'hash') {
        if (opts?.replace) {
          history.replaceState(null, '', `#/${path}`);
          setStack((s) => [...s.slice(0, -1), path]);
        } else {
          depth.current += 1;
          window.location.hash = `/${path}`;
        }
      } else {
        setStack((s) => (opts?.replace ? [...s.slice(0, -1), path] : [...s, path]));
      }
    },
    [mode],
  );

  const back = useCallback(() => {
    closeOverlays();
    if (mode === 'hash') {
      if (depth.current > 0) {
        depth.current -= 1;
        history.back();
      } else {
        // Landed directly on a deep link (QR) — go "up" to home.
        history.replaceState(null, '', '#/');
        setStack(['']);
      }
    } else {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : ['']));
    }
  }, [mode]);

  const route = useMemo(() => parse(stack[stack.length - 1] ?? ''), [stack]);

  const value = useMemo(
    () => ({
      route,
      navigate,
      back,
      drawerOpen,
      setDrawerOpen,
      contactOpen,
      setContactOpen,
      wifiOpen,
      setWifiOpen,
      embedded: mode === 'memory',
    }),
    [route, navigate, back, drawerOpen, contactOpen, wifiOpen, mode],
  );

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error('useGuest must be used inside <GuestProvider>');
  return ctx;
}
