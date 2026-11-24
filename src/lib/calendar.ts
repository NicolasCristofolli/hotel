/** Builds and downloads an .ics file so the guest's own calendar app handles the reminder. */

const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n|\r/g, '\\n')
    .replace(/([,;])/g, '\\$1');
const pad = (n: number) => String(n).padStart(2, '0');
/** Floating local time (no timezone) — the phone shows it at the same clock time as the hotel schedule. */
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export type CalendarEvent = {
  uid: string;
  title: string;
  start: Date;
  durationMin?: number;
  location?: string;
  description?: string;
  alarmMin?: number;
};

export function buildIcs(e: CalendarEvent): string {
  const end = new Date(e.start.getTime() + (e.durationMin ?? 60) * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Guia do Hospede//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.location && `LOCATION:${esc(e.location)}`,
    e.description && `DESCRIPTION:${esc(e.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    `TRIGGER:-PT${e.alarmMin ?? 15}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(e: CalendarEvent, filename: string) {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Fire Pit às 21h" → "fire-pit" */
export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'evento';
