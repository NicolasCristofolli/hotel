import { AnimatePresence, motion } from 'framer-motion';
import { Delete, Lock } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AdminLogin } from '../admin/auth/AdminLogin';
import {
  authMessage,
  IDLE_LIMIT_MS,
  isFullyAuthenticated,
  LAST_ACTIVITY_KEY,
  LOGOUT_REASON_KEY,
  RECOVERY_KEY,
  type AdminRole,
} from '../lib/adminAuth';
import { applyPendingAuthLink } from '../lib/authLinks';
import { supabase } from '../lib/supabase';
import { isPlatformPanel } from '../lib/tenant';

export type { AdminRole } from '../lib/adminAuth';

/** Local demo mode only (no Supabase configured). Checked in the browser — not real security. */
const DEMO_PIN = '1234';
const SESSION_KEY = 'guia-hospede:admin-unlocked';

type Ctx = {
  unlocked: boolean;
  role: AdminRole | null;
  email: string | null;
  canEdit: boolean;
  lock: () => void;
  isAdminRoute: boolean;
  exitAdmin: () => void;
};
const AdminAccessContext = createContext<Ctx | null>(null);

// The platform panel (/painel) is always an admin screen; in a hotel, it's the #/admin route.
const isAdminHash = () => isPlatformPanel || /^#\/?admin/.test(window.location.hash);

const lastActivity = () => Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
const markActivity = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole | null>(() => (!supabase && sessionStorage.getItem(SESSION_KEY) === '1' ? 'demo' : null));
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(!!supabase);
  const [isAdminRoute, setIsAdminRoute] = useState(isAdminHash);
  const [promptOpen, setPromptOpen] = useState(false);
  const [linkError, setLinkError] = useState('');
  const unlocked = role !== null;

  useEffect(() => {
    const onHash = () => setIsAdminRoute(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Supabase session → role (only once password + 2FA are done)
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let alive = true;
    const resolve = async () => {
      const { data } = await db.auth.getSession();
      if (!alive) return;
      setEmail(data.session?.user.email ?? null);
      setRole(data.session ? await isFullyAuthenticated() : null);
      setChecking(false);
    };

    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      // Invite / new-access link from the platform → signed in with it; 2FA setup + new password come next.
      const link = await applyPendingAuthLink(db);
      if (link.error) setLinkError(link.error);
      if (link.applied) {
        /* signed in by the link — 2FA + new password come next */
      } else if (code && url.searchParams.get('reset') === '1') {
        // "Esqueci minha senha" link → exchange the one-time code, then ask for a new password (after 2FA).
        url.searchParams.delete('code');
        url.searchParams.delete('reset');
        history.replaceState(null, '', `${url.pathname}${url.search}#/admin`);
        setIsAdminRoute(true);
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (error) setLinkError(authMessage(error));
        else {
          sessionStorage.setItem(RECOVERY_KEY, '1');
          markActivity();
        }
      } else {
        // Session left open in a closed tab for too long → end it.
        const { data } = await db.auth.getSession();
        if (data.session && Date.now() - lastActivity() > IDLE_LIMIT_MS) {
          sessionStorage.setItem(LOGOUT_REASON_KEY, 'idle');
          await db.auth.signOut();
        }
      }
      await resolve();
    })();

    const { data: sub } = db.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      // Never await Supabase calls inside this callback (it can deadlock the auth lock).
      setTimeout(resolve, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Direct visit to #/admin while locked → ask for credentials; leaving the route closes it.
  useEffect(() => {
    if (!isAdminRoute) setPromptOpen(false);
    else if (!unlocked && !checking) setPromptOpen(true);
  }, [isAdminRoute, unlocked, checking]);

  const exitAdmin = useCallback(() => {
    window.location.hash = '/';
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(RECOVERY_KEY);
    supabase?.auth.signOut();
    setRole(null);
    if (isPlatformPanel) window.location.assign('/');
    else window.location.hash = '/';
  }, []);

  // ── Auto logout after 30 min without activity (shared across admin tabs) ──
  const lastWrite = useRef(0);
  useEffect(() => {
    if (!supabase || !unlocked) return;
    markActivity();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite.current > 15_000) {
        lastWrite.current = now;
        markActivity();
      }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity() > IDLE_LIMIT_MS) {
        sessionStorage.setItem(LOGOUT_REASON_KEY, 'idle');
        supabase?.auth.signOut();
        setRole(null); // stays on #/admin → the login opens with the reason
      }
    }, 20_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, [unlocked]);

  const onSuccess = (r: AdminRole) => {
    if (r === 'demo') sessionStorage.setItem(SESSION_KEY, '1');
    markActivity();
    setLinkError('');
    setRole(r);
    setPromptOpen(false);
    if (!isPlatformPanel) window.location.hash = '/admin';
  };

  const onCancel = () => {
    setPromptOpen(false);
    setLinkError('');
    if (isPlatformPanel) return window.location.assign('/');
    if (isAdminHash()) {
      history.replaceState(null, '', '#/');
      setIsAdminRoute(false);
    }
  };

  const canEdit = role === 'owner' || role === 'admin' || role === 'demo' || role === 'platform';

  return (
    <AdminAccessContext.Provider value={{ unlocked, role, email, canEdit, lock, isAdminRoute, exitAdmin }}>
      {children}
      {supabase ? (
        <AdminLogin open={promptOpen} initialError={linkError} onSuccess={onSuccess} onCancel={onCancel} />
      ) : (
        <PinModal open={promptOpen} onSuccess={() => onSuccess('demo')} onCancel={onCancel} />
      )}
    </AdminAccessContext.Provider>
  );
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error('useAdminAccess must be used inside <AdminAccessProvider>');
  return ctx;
}

function PinModal({ open, onSuccess, onCancel }: { open: boolean; onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setPin('');
      setError(false);
    }
  }, [open]);

  const pinRef = useRef('');
  pinRef.current = pin;

  const press = useCallback(
    (d: string) => {
      if (pinRef.current.length >= 4) return;
      const next = pinRef.current + d;
      pinRef.current = next;
      setError(false);
      setPin(next);
      if (next.length === 4) {
        setTimeout(() => {
          if (next === DEMO_PIN) onSuccess();
          else {
            setError(true);
            setPin('');
          }
        }, 180);
      }
    },
    [onSuccess],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, press, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="pin-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="pin-backdrop" onClick={onCancel} />
          <motion.div
            className="pin-card"
            role="dialog"
            aria-modal="true"
            aria-label="Acesso ao painel administrativo"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="pin-icon">
              <Lock size={20} strokeWidth={1.5} />
            </div>
            <h2>Painel Administrativo</h2>
            <p>Digite o PIN de acesso da equipe.</p>
            <motion.div
              className={`pin-dots ${error ? 'is-error' : ''}`}
              animate={error ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < pin.length ? 'filled' : ''} />
              ))}
            </motion.div>
            <p className="pin-hint">{error ? 'PIN incorreto. Tente novamente.' : 'Modo demonstração (sem banco): PIN 1234'}</p>
            <div className="pin-pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => press(d)}>
                  {d}
                </button>
              ))}
              <button className="pin-text" onClick={onCancel}>
                Cancelar
              </button>
              <button onClick={() => press('0')}>0</button>
              <button className="pin-text" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Apagar">
                <Delete size={20} strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
