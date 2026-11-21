import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, ChevronRight, Clock3, MapPin, Shirt, Sparkle } from 'lucide-react';
import { useMemo } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Img } from '../components/Img';
import { StatusPill } from '../components/StatusPill';
import { waLink } from '../lib/actions';
import { Icon } from '../lib/icons';
import { fmtRange, getServiceStatus } from '../lib/status';
import { useTrack } from '../lib/analytics';
import { useGuest } from '../state/GuestContext';
import { useHotel, useNow } from '../state/HotelContext';
import type { ServiceCategory } from '../types';

export const CATEGORIES: { id: 'todos' | ServiceCategory; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'gastronomia', label: 'Gastronomia' },
  { id: 'drinks', label: 'Drinks & Bar' },
  { id: 'lazer', label: 'Lazer' },
  { id: 'bem-estar', label: 'Bem-Estar' },
  { id: 'servicos', label: 'Serviços' },
];

export function ServicesView() {
  const { config } = useHotel();
  const { route, navigate } = useGuest();
  const track = useTrack();
  const now = useNow();
  const cat = (route.query.get('c') as ServiceCategory | null) ?? 'todos';
  const selectedId = route.param;

  const list = useMemo(() => config.services.filter((s) => cat === 'todos' || s.category === cat), [config.services, cat]);
  const selected = config.services.find((s) => s.id === selectedId);

  const setCat = (c: string) => navigate(c === 'todos' ? 'servicos' : `servicos?c=${c}`, { replace: true });
  const openService = (id: string) => navigate(`servicos/${id}${cat !== 'todos' ? `?c=${cat}` : ''}`, { replace: true });
  const closeService = () => navigate(`servicos${cat !== 'todos' ? `?c=${cat}` : ''}`, { replace: true });

  const openCount = config.services.filter((s) => getServiceStatus(s, now).tone === 'open').length;

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">Funcionamento</p>
        <h1 className="page-title">
          Horários, Gastronomia <em>& Drinks</em>
        </h1>
        <p className="page-lead">
          <span className="live-dot" /> {openCount} espaços abertos agora •{' '}
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="pills-wrap">
        <div className="pills" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cat === c.id}
              className={`pill ${cat === c.id ? 'is-active' : ''}`}
              onClick={() => setCat(c.id)}
            >
              {cat === c.id && (
                <motion.span layoutId="pill-bg" className="pill-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
              )}
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <motion.ul className="service-list" layout>
        <AnimatePresence mode="popLayout">
          {list.map((s, i) => (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035, type: 'spring', stiffness: 300, damping: 28 } }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            >
              <button className="service-card" onClick={() => openService(s.id)}>
                <span className="service-icon">
                  <Icon name={s.icon} size={22} strokeWidth={1.25} />
                </span>
                <span className="service-main">
                  <strong>{s.name}</strong>
                  <span className="service-hours">
                    <Clock3 size={13} strokeWidth={1.5} /> {fmtRange(s.open, s.close)}
                  </span>
                  <StatusPill status={getServiceStatus(s, now)} />
                </span>
                <ChevronRight size={18} strokeWidth={1.5} className="chev" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <BottomSheet
        open={!!selected}
        onClose={closeService}
        label={selected?.name ?? 'Serviço'}
        media={selected && <Img src={selected.image} alt={selected.name} className="sheet-img" />}
      >
        {selected && (
          <>
            <div className="sheet-heading">
              <p className="eyebrow">{CATEGORIES.find((c) => c.id === selected.category)?.label}</p>
              <h2 className="sheet-title">{selected.name}</h2>
              <div className="sheet-meta">
                <StatusPill status={getServiceStatus(selected, now)} size="md" />
                <span className="sheet-hours">
                  <Clock3 size={15} strokeWidth={1.5} /> {fmtRange(selected.open, selected.close)}
                </span>
              </div>
            </div>
            <p className="sheet-text">{selected.description}</p>

            {selected.highlights.length > 0 && (
              <>
                <h3 className="sheet-sub">
                  <Sparkle size={15} strokeWidth={1.5} /> Destaques
                </h3>
                <ul className="highlight-list">
                  {selected.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </>
            )}

            {selected.dressCode && (
              <div className="dress">
                <Shirt size={18} strokeWidth={1.5} />
                <span>
                  <small>Dress code</small>
                  {selected.dressCode}
                </span>
              </div>
            )}

            <div className="sheet-actions">
              {selected.bookable && (
                <a
                  className="btn btn-primary btn-block"
                  onClick={() => track('booking', selected.id, selected.name)}
                  href={waLink(config.identity.whatsapp, `Olá! Gostaria de reservar: ${selected.name}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarCheck size={18} strokeWidth={1.5} /> Reservar agora
                </a>
              )}
              {selected.pinId && (
                <button className="btn btn-outline btn-block" onClick={() => navigate(`mapa/${selected.pinId}`)}>
                  <MapPin size={18} strokeWidth={1.5} /> Ver no Mapa
                </button>
              )}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
