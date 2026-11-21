import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string; detail?: string };
const ToastContext = createContext<(message: string, detail?: string) => void>(() => {});

/** Toasts render inside the nearest positioned ancestor (so they stay inside the phone shell on desktop). */
export function ToastProvider({ children, placement = 'bottom' }: { children: ReactNode; placement?: 'bottom' | 'top' }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, detail?: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, detail }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast-stack toast-${placement}`} aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: placement === 'bottom' ? 24 : -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: placement === 'bottom' ? 12 : -12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <CheckCircle2 size={18} strokeWidth={1.5} className="toast-icon" />
              <div>
                <strong>{t.message}</strong>
                {t.detail && <span>{t.detail}</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
