import type { Service } from '../types';

export type LiveStatusTone = 'open' | 'soon' | 'closed' | 'maintenance' | 'appointment';

export type LiveStatus = { tone: LiveStatusTone; label: string };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** "07:00" → "07h", "10:30" → "10h30" */
export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return m && m !== '00' ? `${h}h${m}` : `${h}h`;
};

export const fmtRange = (open: string, close: string) => {
  if (open === close) return '24 horas';
  const c = fmtTime(close);
  return `${fmtTime(open)} ${c.startsWith('00') || c.startsWith('01') ? 'à' : 'às'} ${c}`;
};

export function isOpenAt(open: string, close: string, date: Date): boolean {
  if (open === close) return true;
  const now = date.getHours() * 60 + date.getMinutes();
  const o = toMin(open);
  const c = toMin(close);
  return o < c ? now >= o && now < c : now >= o || now < c; // crosses midnight
}

export function getServiceStatus(s: Service, date: Date): LiveStatus {
  switch (s.override) {
    case 'open':
      return { tone: 'open', label: 'Aberto agora' };
    case 'closed':
      return { tone: 'closed', label: 'Fechado' };
    case 'maintenance':
      return { tone: 'maintenance', label: 'Em manutenção' };
    case 'appointment':
      return { tone: 'appointment', label: 'Mediante agendamento' };
  }
  if (isOpenAt(s.open, s.close, date)) {
    const now = date.getHours() * 60 + date.getMinutes();
    let left = toMin(s.close) - now;
    if (left < 0) left += 1440;
    if (s.open !== s.close && left <= 45) return { tone: 'soon', label: `Fecha às ${fmtTime(s.close)}` };
    return { tone: 'open', label: 'Aberto agora' };
  }
  return { tone: 'closed', label: `Abre às ${fmtTime(s.open)}` };
}

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export const uid = () => Math.random().toString(36).slice(2, 9);
