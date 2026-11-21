import type { HotelConfig } from '../types';
import { store, type AnalyticsEvent } from './analytics';

/** Fills the local store with ~30 days of plausible guest usage, so the dashboard can be previewed. */
export function generateDemoData(config: HotelConfig) {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  // Weighted pick: earlier items in each list are more popular.
  const pick = <T>(list: T[]): T => list[Math.min(list.length - 1, Math.floor(Math.pow(Math.random(), 1.8) * list.length))];
  // Activity peaks: breakfast, after lunch, evening.
  const HOURS = [7, 8, 8, 9, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 18, 19, 19, 20, 20, 20, 21, 21, 22, 23];

  const shortcuts = config.quickActions.filter((a) => a.active);
  const events = config.events.filter((e) => !e.draft);
  const out: AnalyticsEvent[] = [];
  const now = Date.now();

  for (let day = 29; day >= 0; day--) {
    const visits = 8 + rnd(10) + (new Date(now - day * 86_400_000).getDay() % 6 === 0 ? 10 : 0); // busier weekends
    for (let v = 0; v < visits; v++) {
      const sid = `demo-${day}-${v}`;
      const d = new Date(now - day * 86_400_000);
      d.setHours(HOURS[rnd(HOURS.length)], rnd(60), 0, 0);
      let t = Math.min(d.getTime(), now - 60_000);
      const push = (type: AnalyticsEvent['type'], target: string, label: string) =>
        out.push({ type, target, label, ts: (t += 20_000 + rnd(90_000)), sid });

      push('session', 'portal', 'Acesso ao portal');
      push('page', 'inicio', 'Início');
      for (let i = 0, n = 1 + rnd(4); i < n; i++) {
        const a = pick(shortcuts);
        if (!a) break;
        push('shortcut', a.id, a.label);
        if (a.kind === 'wifi') push('wifi', 'senha', 'Senha do Wi-Fi copiada');
        if (a.kind === 'route') {
          const view = a.target.split(/[/?]/)[0];
          if (view === 'servicos') {
            push('page', 'servicos', 'Horários & Serviços');
            const s = pick(config.services);
            if (s && Math.random() < 0.7) push('service', s.id, s.name);
            if (s?.bookable && Math.random() < 0.2) push('booking', s.id, s.name);
          } else if (view === 'mapa') {
            push('page', 'mapa', 'Mapa');
            const p = pick(config.pins);
            if (p) push('pin', p.id, p.name);
          } else if (view === 'programacao') {
            push('page', 'programacao', 'Programação');
            for (let k = 0, m = 1 + rnd(3); k < m; k++) {
              const e = pick(events);
              if (e && Math.random() < 0.5) push('calendar', e.id, e.title);
              if (e?.pinId && Math.random() < 0.3) push('event_map', e.id, e.title);
            }
          } else if (view === 'experience') {
            const ex = config.experiences.find((x) => `experience/${x.id}` === a.target);
            push('page', a.target, ex?.title ?? 'Experiência');
          }
        }
      }
      if (Math.random() < 0.35) {
        const q = pick(config.quickRequests);
        if (q) push('request', q.id, q.label);
      }
      if (Math.random() < 0.08) push('whatsapp', 'recepcao', 'Conversa no WhatsApp');
      if (Math.random() < 0.15 && config.notices[0]) push('notice_dismiss', config.notices[0].id, config.notices[0].title);
    }
  }
  store.recordMany(out.filter((e) => e.ts <= now).sort((a, b) => a.ts - b.ts));
}
