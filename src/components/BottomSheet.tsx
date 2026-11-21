import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  /** full-bleed media rendered above the content, under the grab handle */
  media?: ReactNode;
};

/** Swipe-to-dismiss bottom sheet, positioned inside the nearest `.guest` container. */
export function BottomSheet({ open, onClose, children, label, media }: Props) {
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={label}>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="sheet-grab" onPointerDown={(e) => drag.start(e)}>
              <span />
            </div>
            <button className="sheet-close" onClick={onClose} aria-label="Fechar">
              <X size={18} strokeWidth={1.5} />
            </button>
            <div className="sheet-scroll">
              {media && (
                <div className="sheet-media" onPointerDown={(e) => drag.start(e)}>
                  {media}
                </div>
              )}
              <div className="sheet-body">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
