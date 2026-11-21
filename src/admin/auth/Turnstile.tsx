import { useEffect, useRef } from 'react';

/** Cloudflare Turnstile (anti-bot). Only active when VITE_TURNSTILE_SITE_KEY is set. */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loader: Promise<TurnstileApi> | null = null;
function loadTurnstile() {
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponível')));
    s.onerror = () => {
      loader = null;
      reject(new Error('Não foi possível carregar a verificação anti-robô'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

/** Renders the widget; `onToken('')` when it expires. Change `resetKey` to get a fresh token (tokens are single-use). */
export function Turnstile({ onToken, resetKey }: { onToken: (t: string) => void; resetKey: number }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string>();
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let alive = true;
    loadTurnstile()
      .then((t) => {
        if (!alive || !el.current) return;
        id.current = t.render(el.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          size: 'flexible',
          language: 'pt-br',
          callback: (tok: string) => cb.current(tok),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        });
      })
      .catch(() => cb.current(''));
    return () => {
      alive = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (resetKey && id.current) {
      cb.current('');
      window.turnstile?.reset(id.current);
    }
  }, [resetKey]);

  return TURNSTILE_SITE_KEY ? <div ref={el} className="turnstile" /> : null;
}
