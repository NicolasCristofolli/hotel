import { motion } from 'framer-motion';
import { ArrowUpRight, DoorOpen, MessageCircle, PhoneCall } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { formatPhone, waLink } from '../lib/actions';
import { useTrack } from '../lib/analytics';
import { useGuest } from '../state/GuestContext';
import { useHotel } from '../state/HotelContext';
import { useToast } from '../state/ToastContext';
import { BottomSheet } from './BottomSheet';

const ROOM_KEY = 'guia-hospede:room';

export function ContactSheet() {
  const { config } = useHotel();
  const { contactOpen, setContactOpen } = useGuest();
  const toast = useToast();
  const track = useTrack();
  const id = config.identity;
  const [room, setRoom] = useState(() => localStorage.getItem(ROOM_KEY) ?? '');

  useEffect(() => {
    localStorage.setItem(ROOM_KEY, room);
  }, [room]);

  const roomSuffix = room ? ` — Acomodação ${room}` : '';

  const request = (reqId: string, label: string) => {
    track('request', reqId, label);
    window.open(waLink(id.whatsapp, `Olá, ${id.shortName}! Gostaria de: ${label}${roomSuffix}. Obrigado!`), '_blank', 'noopener');
    toast('Solicitação preparada', `${label} • enviada pelo WhatsApp`);
  };

  return (
    <BottomSheet open={contactOpen} onClose={() => setContactOpen(false)} label="Falar com a Recepção">
      <p className="eyebrow">Atendimento {id.receptionHours}</p>
      <h2 className="sheet-title">Como podemos ajudar?</h2>

      <a
        className="btn btn-primary btn-block btn-lg"
        href={waLink(id.whatsapp, `Olá, ${id.shortName}! Preciso de ajuda${roomSuffix}.`)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('whatsapp', 'recepcao', 'Conversa no WhatsApp')}
      >
        <MessageCircle size={20} strokeWidth={1.5} />
        Conversar no WhatsApp
        <ArrowUpRight size={18} strokeWidth={1.5} className="ml-auto" />
      </a>

      <div className="contact-row">
        <div className="contact-tile">
          <PhoneCall size={20} strokeWidth={1.5} />
          <div>
            <small>Ramal interno</small>
            <strong>Disque {id.extension}</strong>
          </div>
        </div>
        <label className="contact-tile room-input">
          <DoorOpen size={20} strokeWidth={1.5} />
          <div>
            <small>Sua acomodação</small>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value.slice(0, 8))}
              placeholder="Nº do quarto"
              inputMode="text"
              aria-label="Número da acomodação"
            />
          </div>
        </label>
      </div>

      <h3 className="sheet-sub">Pedidos rápidos</h3>
      <div className="request-grid">
        {config.quickRequests.map((q, i) => (
          <motion.button
            key={q.id}
            className="request-chip"
            onClick={() => request(q.id, q.label)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}
          >
            <Icon name={q.icon} size={20} />
            <span>{q.label}</span>
          </motion.button>
        ))}
      </div>
      <p className="muted small center">WhatsApp {formatPhone(id.whatsapp)}</p>
    </BottomSheet>
  );
}
