import { AnimatePresence, motion } from 'framer-motion';
import { Delete, Lock } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const DEMO_PIN = '1234';
const SESSION_KEY = 'guia-hospede:admin-unlocked';

type Ctx = { unlocked: boolean; requestAdmin: () => void; lock: () => void; isAdminRoute: boolean; exitAdmin: () => void };
const AdminAccessContext = createContext<Ctx | null>(null);

const isAdminHash = () => /^#\/?admin/.test(window.location.hash);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [isAdminRoute, setIsAdminRoute] = useState(isAdminHash);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setIsAdminRoute(isAdminHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Direct visit to #/admin while locked → ask for the PIN
  useEffect(() => {
    if (isAdminRoute && !unlocked) setPinOpen(true);
  }, [isAdminRoute, unlocked]);

  const requestAdmin = useCallback(() => {
    if (unlocked) window.location.hash = '/admin';
    else setPinOpen(true);
  }, [unlocked]);

  const exitAdmin = useCallback(() => {
    window.location.hash = '/';
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
    window.location.hash = '/';
  }, []);

  const onSuccess = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setUnlocked(true);
    setPinOpen(false);
    window.location.hash = '/admin';
  };

  const onCancel = () => {
    setPinOpen(false);
    if (isAdminHash()) {
      history.replaceState(null, '', '#/');
      setIsAdminRoute(false);
    }
  };

  return (
    <AdminAccessContext.Provider value={{ unlocked, requestAdmin, lock, isAdminRoute, exitAdmin }}>
      {children}
      <PinModal open={pinOpen} onSuccess={onSuccess} onCancel={onCancel} />
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
            <p className="pin-hint">{error ? 'PIN incorreto. Tente novamente.' : 'Demonstração: PIN 1234'}</p>
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
