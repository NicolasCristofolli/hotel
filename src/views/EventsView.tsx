import { motion } from 'framer-motion';
import { CalendarCheck, CalendarPlus, MapPin } from 'lucide-react';
import { useTrack } from '../lib/analytics';
import { downloadIcs, slug } from '../lib/calendar';
import type { HotelEvent } from '../types';
import { useMemo, useState } from 'react';
import { Icon } from '../lib/icons';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../lib/status';
import { useGuest } from '../state/GuestContext';
import { useHotel, useNow } from '../state/HotelContext';
import { useToast } from '../state/ToastContext';
import { hotelKey } from '../lib/tenant';

const REMIND_KEY = hotelKey('guia-hospede:reminders');

export function EventsView() {
  const { config } = useHotel();
  const { navigate } = useGuest();
  const toast = useToast();
  const track = useTrack();
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const [reminders, setReminders] = useState<string[]>(() => JSON.parse(localStorage.getItem(REMIND_KEY) ?? '[]'));

  const days = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        return { i, date: d, label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : WEEKDAYS_SHORT[d.getDay()] };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.toDateString()],
  );

  const day = days[offset].date;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const events = config.events.filter((e) => !e.draft && e.days.includes(day.getDay())).sort((a, b) => a.time.localeCompare(b.time));

  const remindKey = (eventId: string) => `${day.toDateString()}:${eventId}`;

  const addToCalendar = (e: HotelEvent) => {
    track('calendar', e.id, e.title);
    const [h, m] = e.time.split(':').map(Number);
    const start = new Date(day);
    start.setHours(h || 0, m || 0, 0, 0);
    downloadIcs(
      {
        uid: `${e.id}-${start.getFullYear()}${start.getMonth() + 1}${start.getDate()}@guia-hospede`,
        title: `${e.title} • ${config.identity.shortName}`,
        start,
        location: `${e.location} — ${config.identity.name}`,
        description: e.description,
        alarmMin: 15,
      },
      slug(e.title),
    );
    const next = reminders.includes(remindKey(e.id)) ? reminders : [...reminders, remindKey(e.id)];
    setReminders(next);
    localStorage.setItem(REMIND_KEY, JSON.stringify(next));
    toast('Evento baixado', 'Abra o arquivo para salvar na sua agenda • aviso 15 min antes');
  };

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">Agenda do hotel</p>
        <h1 className="page-title">
          Programação <em>do Hotel</em>
        </h1>
        <p className="page-lead">
          {WEEKDAYS_LONG[day.getDay()]}, {day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
        </p>
      </div>

      <div className="day-selector" role="tablist">
        {days.map((d) => (
          <button
            key={d.i}
            role="tab"
            aria-selected={offset === d.i}
            className={`day ${offset === d.i ? 'is-active' : ''}`}
            onClick={() => setOffset(d.i)}
          >
            {offset === d.i && (
              <motion.span layoutId="day-bg" className="day-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
            )}
            <small>{d.label}</small>
            <strong>{d.date.getDate()}</strong>
          </button>
        ))}
      </div>

      <motion.ol
        key={offset}
        className="timeline"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {events.length === 0 && <li className="empty">Nenhuma atividade programada para este dia.</li>}
        {events.map((e, i) => {
          const m = Number(e.time.slice(0, 2)) * 60 + Number(e.time.slice(3, 5));
          const isToday = offset === 0;
          const live = isToday && nowMin >= m && nowMin < m + 60;
          const past = isToday && nowMin >= m + 60;
          const reminded = reminders.includes(remindKey(e.id));
          return (
            <motion.li
              key={e.id}
              className={`tl-item ${live ? 'is-live' : ''} ${past ? 'is-past' : ''}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05, type: 'spring', stiffness: 280, damping: 26 }}
            >
              <div className="tl-time">
                <strong>{e.time.replace(':', 'h')}</strong>
              </div>
              <div className="tl-node">
                <span />
              </div>
              <article className="tl-card">
                <div className="tl-card-head">
                  <span className="tl-icon">
                    <Icon name={e.icon} size={18} strokeWidth={1.25} />
                  </span>
                  <div>
                    {live && (
                      <span className="status status-open status-sm">
                        <i className="status-dot" /> Acontecendo agora
                      </span>
                    )}
                    <h3>{e.title}</h3>
                    <p className="tl-loc">
                      <MapPin size={13} strokeWidth={1.5} /> {e.location}
                    </p>
                  </div>
                </div>
                <p className="tl-desc">{e.description}</p>
                {!past && (
                  <div className="tl-actions">
                    <button className={`btn btn-sm ${reminded ? 'btn-primary' : 'btn-ghost'}`} onClick={() => addToCalendar(e)}>
                      {reminded ? <CalendarCheck size={15} strokeWidth={1.5} /> : <CalendarPlus size={15} strokeWidth={1.5} />}
                      {reminded ? 'Na sua agenda' : 'Adicionar à agenda'}
                    </button>
                    {e.pinId && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          track('event_map', e.id, e.title);
                          navigate(`mapa/${e.pinId}`);
                        }}
                      >
                        <MapPin size={15} strokeWidth={1.5} /> Ver no Mapa
                      </button>
                    )}
                  </div>
                )}
              </article>
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}
