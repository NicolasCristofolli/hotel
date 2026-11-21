import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock3, MapPin, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Img } from '../components/Img';
import { Icon } from '../lib/icons';
import { useGuest } from '../state/GuestContext';
import { useHotel } from '../state/HotelContext';

export function ExperienceView() {
  const { config } = useHotel();
  const { route, navigate, setContactOpen } = useGuest();
  const exp = config.experiences.find((e) => e.id === route.param) ?? config.experiences[0];
  const [openItem, setOpenItem] = useState<string | null>(exp.items[0]?.id ?? null);

  return (
    <div className="page experience has-actionbar">
      <section className="exp-hero">
        <Img src={exp.image} alt={exp.title} className="exp-img" loading="eager" />
        <div className="exp-overlay" />
        <motion.div
          className="exp-hero-text"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.1 }}
        >
          <p className="hero-eyebrow">
            <span className="gold-rule" /> {exp.eyebrow}
          </p>
          <h1 className="exp-title">{exp.title}</h1>
        </motion.div>
      </section>

      <p className="exp-intro">{exp.intro}</p>

      <ul className="exp-list">
        {exp.items.map((item, i) => {
          const open = openItem === item.id;
          return (
            <motion.li
              key={item.id}
              className={`exp-item ${open ? 'is-open' : ''}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
            >
              <button className="exp-item-head" onClick={() => setOpenItem(open ? null : item.id)} aria-expanded={open}>
                <span className="service-icon">
                  <Icon name={item.icon} size={20} strokeWidth={1.25} />
                </span>
                <span className="exp-item-main">
                  <strong>{item.name}</strong>
                  <small>
                    <Clock3 size={12} strokeWidth={1.5} /> {item.hours}
                  </small>
                </span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} className="chev">
                  <ChevronDown size={18} strokeWidth={1.5} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    className="exp-item-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                  >
                    <ul className="rule-list">
                      {item.rules.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>

      <div className="actionbar">
        <button className="btn btn-primary btn-lg grow" onClick={() => setContactOpen(true)}>
          <MessageCircle size={19} strokeWidth={1.5} /> Falar com a Recepção
        </button>
        {exp.pinId && (
          <button className="btn btn-cream btn-lg" onClick={() => navigate(`mapa/${exp.pinId}`)}>
            <MapPin size={19} strokeWidth={1.5} /> Ver no Mapa
          </button>
        )}
      </div>
    </div>
  );
}
