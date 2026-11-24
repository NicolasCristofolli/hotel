import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Home, MessageCircle, X } from 'lucide-react';
import { useEffect } from 'react';
import { Icon } from '../lib/icons';
import { MAX_QUICK_ACTIONS, useRunQuickAction } from '../lib/quickActions';
import { BrandMark } from './BrandMark';
import { useGuest } from '../state/GuestContext';
import { useHotel } from '../state/HotelContext';

export function Drawer() {
  const { config } = useHotel();
  const { drawerOpen, setDrawerOpen, navigate, route, setContactOpen } = useGuest();
  const run = useRunQuickAction();
  const id = config.identity;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Menu">
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
          <motion.nav
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.6 }}
            onDragEnd={(_, info) => (info.offset.x > 90 || info.velocity.x > 500) && setDrawerOpen(false)}
          >
            <div className="drawer-head">
              <div className="monogram">
                <BrandMark identity={id} />
                <span className="monogram-text">
                  <strong>{id.name}</strong>
                  <small>{id.subtitle}</small>
                </span>
              </div>
              <button className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Fechar menu">
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>

            <div className="drawer-scroll">
              <p className="eyebrow">Navegação</p>
              <ul className="drawer-list">
                <motion.li initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
                  <button className={route.view === '' ? 'is-active' : ''} onClick={() => navigate('')}>
                    <Home size={20} strokeWidth={1.5} />
                    <span>Início</span>
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </button>
                </motion.li>
                {config.quickActions
                  .filter((a) => a.active)
                  .slice(0, MAX_QUICK_ACTIONS)
                  .map((a, i) => {
                    const active = a.kind === 'route' && !a.target.includes('?') && route.path.split('?')[0] === a.target;
                    return (
                      <motion.li
                        key={a.id}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + i * 0.035 }}
                      >
                        <button className={active ? 'is-active' : ''} onClick={() => run(a)}>
                          <Icon name={a.icon} size={20} strokeWidth={1.5} />
                          <span>{a.label}</span>
                          <ChevronRight size={16} strokeWidth={1.5} />
                        </button>
                      </motion.li>
                    );
                  })}
              </ul>

              <button
                className="drawer-contact"
                onClick={() => {
                  setDrawerOpen(false);
                  setContactOpen(true);
                }}
              >
                <MessageCircle size={20} strokeWidth={1.5} />
                <span>
                  <strong>Falar com a Recepção</strong>
                  <small>WhatsApp • Ramal {id.extension}</small>
                </span>
              </button>

              <div className="drawer-info">
                <div>
                  <small>Check-in</small>
                  <strong>{id.checkIn}</strong>
                </div>
                <div>
                  <small>Check-out</small>
                  <strong>{id.checkOut}</strong>
                </div>
                <div>
                  <small>Recepção</small>
                  <strong>{id.receptionHours}</strong>
                </div>
              </div>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}
