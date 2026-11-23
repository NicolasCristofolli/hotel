import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarClock, ChevronRight, Megaphone, PartyPopper, Wrench, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Img } from '../components/Img';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../lib/icons';
import { useRunQuickAction } from '../lib/quickActions';
import { useTrack } from '../lib/analytics';
import { fmtTime } from '../lib/status';
import { useGuest } from '../state/GuestContext';
import { useHotel, useNow } from '../state/HotelContext';
import type { NoticePriority } from '../types';
import { hotelKey } from '../lib/tenant';

const DISMISS_KEY = hotelKey('guia-hospede:dismissed');

export const PRIORITY_META: Record<NoticePriority, { label: string; icon: typeof Megaphone }> = {
  aviso: { label: 'Aviso', icon: Megaphone },
  evento: { label: 'Evento', icon: PartyPopper },
  manutencao: { label: 'Manutenção', icon: Wrench },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};
const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

export function HomeView() {
  const { config } = useHotel();
  const run = useRunQuickAction();
  const id = config.identity;
  const actions = config.quickActions.filter((a) => a.active);

  return (
    <div className="home">
      <section className="hero">
        <Img src={id.heroImage} alt={id.name} className="hero-img" loading="eager" />
        <div className="hero-overlay" />
        <HeroLineArt />
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
        >
          <p className="hero-eyebrow">
            <span className="gold-rule" /> {id.name} • {id.subtitle}
          </p>
          <h1 className="hero-title">{id.heroTitle}</h1>
          <p className="hero-sub">{id.heroSubtitle}</p>
          <div className="hero-meta">
            <span>
              Check-in <strong>{id.checkIn}</strong>
            </span>
            <i />
            <span>
              Check-out <strong>{id.checkOut}</strong>
            </span>
          </div>
        </motion.div>
      </section>

      <NoticeCarousel />

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Concierge digital</p>
          <h2 className="section-title">
            Sua estadia, <em>em um toque</em>
          </h2>
        </div>
        <motion.div className="quick-grid" variants={stagger} initial="hidden" animate="show">
          {actions.map((a) => (
            <motion.button key={a.id} variants={rise} className={`quick-card ${a.kind === 'wifi' ? 'is-wifi' : ''}`} onClick={() => run(a)}>
              <span className="quick-icon">
                <Icon name={a.icon} size={24} strokeWidth={1.25} />
              </span>
              <span className="quick-label">{a.label}</span>
              <span className="quick-hint">{a.hint}</span>
              <ChevronRight className="quick-chevron" size={16} strokeWidth={1.5} />
            </motion.button>
          ))}
        </motion.div>
      </section>

      <NextUp />

      <footer className="footer">
        <Img src={id.footerImage} alt="" className="footer-img" />
        <div className="footer-overlay" />
        <div className="footer-content">
          <BrandMark identity={id} size="lg" />
          <p className="footer-tagline">{id.tagline}</p>
          <span className="gold-rule wide" />
          <p className="footer-small">{[id.name, [id.city, id.region].filter(Boolean).join(', ')].filter(Boolean).join(' • ')}</p>
          <p className="footer-small faint">© {new Date().getFullYear()} • Guia do Hóspede</p>
        </div>
      </footer>
    </div>
  );
}

function NoticeCarousel() {
  const { config } = useHotel();
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]'));
  const [index, setIndex] = useState(0);
  const trackEvent = useTrack();
  const track = useRef<HTMLDivElement>(null);

  // A notice re-appears if the admin edits its message.
  const keyOf = (n: { id: string; message: string }) => `${n.id}:${n.message}`;
  const notices = config.notices.filter((n) => n.active && !dismissed.includes(keyOf(n)));

  const dismiss = (k: string) => {
    const n = config.notices.find((x) => keyOf(x) === k);
    if (n) trackEvent('notice_dismiss', n.id, n.title);
    const next = [...dismissed, k];
    setDismissed(next);
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  if (!notices.length) return null;

  return (
    <section className="notices" aria-label="Recados e avisos">
      <div className="notices-head">
        <span className="live-dot" /> Recados ao vivo
        {notices.length > 1 && (
          <span className="notices-count">
            {Math.min(index + 1, notices.length)}/{notices.length}
          </span>
        )}
      </div>
      <div
        className="notices-track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / (el.clientWidth * 0.88)));
        }}
      >
        <AnimatePresence initial={false}>
          {notices.map((n) => {
            const meta = PRIORITY_META[n.priority];
            return (
              <motion.article
                key={n.id}
                layout
                className={`notice notice-${n.priority}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              >
                <span className="notice-icon">
                  <meta.icon size={18} strokeWidth={1.5} />
                </span>
                <div className="notice-body">
                  <span className="notice-tag">{meta.label}</span>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                </div>
                <button className="notice-close" onClick={() => dismiss(keyOf(n))} aria-label="Dispensar aviso">
                  <X size={16} strokeWidth={1.5} />
                </button>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
      {notices.length > 1 && (
        <div className="dots">
          {notices.map((n, i) => (
            <span key={n.id} className={i === index ? 'on' : ''} />
          ))}
        </div>
      )}
    </section>
  );
}

function NextUp() {
  const { config } = useHotel();
  const { navigate } = useGuest();
  const now = useNow();

  const next = useMemo(() => {
    const mins = now.getHours() * 60 + now.getMinutes();
    return config.events
      .filter((e) => !e.draft && e.days.includes(now.getDay()))
      .map((e) => ({ e, m: Number(e.time.slice(0, 2)) * 60 + Number(e.time.slice(3, 5)) }))
      .filter(({ m }) => m >= mins - 30)
      .sort((a, b) => a.m - b.m)[0]?.e;
  }, [config.events, now]);

  if (!next) return null;

  return (
    <section className="section">
      <motion.button
        className="nextup"
        onClick={() => navigate('programacao')}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <span className="nextup-time">
          <CalendarClock size={18} strokeWidth={1.5} />
          {fmtTime(next.time)}
        </span>
        <span className="nextup-body">
          <small>A seguir na programação</small>
          <strong>{next.title}</strong>
          <span>{next.location}</span>
        </span>
        <ArrowRight size={18} strokeWidth={1.5} />
      </motion.button>
    </section>
  );
}

/** Fine gold line-art: mountain ridges + sun, drawn on load (CSS stroke animation). */
function HeroLineArt() {
  return (
    <svg className="hero-lineart" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path className="draw d1" pathLength={1} d="M-10 230 L70 160 L110 190 L180 110 L240 175 L290 135 L410 225" />
      <path className="draw d2" pathLength={1} d="M-10 250 L90 195 L150 220 L220 160 L300 205 L410 160" />
      <circle className="draw d3" pathLength={1} cx="330" cy="70" r="22" />
    </svg>
  );
}
