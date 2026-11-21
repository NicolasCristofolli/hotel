/**
 * Anonymous usage analytics for the management dashboard.
 *
 * Every guest interaction becomes one small, anonymous record (no name, phone or room).
 * Storage goes through `AnalyticsStore`, so moving from this browser (localStorage)
 * to a shared database (Supabase) only means swapping `store` — screens stay the same.
 */
import { useCallback } from 'react';
import { useGuest } from '../state/GuestContext';

export type AnalyticsType =
  | 'session' //  a guest opened the portal
  | 'page' //  section viewed (inicio, servicos, programacao, mapa, experience/…)
  | 'shortcut' //  home/menu shortcut tapped
  | 'request' //  quick request to the front desk (toalhas, limpeza…)
  | 'whatsapp' //  "Conversar no WhatsApp"
  | 'booking' //  "Reservar agora" on a service
  | 'calendar' //  event added to the guest's calendar
  | 'event_map' //  "Ver no mapa" from an event
  | 'service' //  service details opened
  | 'pin' //  map point opened
  | 'wifi' //  Wi-Fi password copied
  | 'notice_dismiss'; // notice closed

export type AnalyticsEvent = {
  type: AnalyticsType;
  target: string; // stable id (shortcut id, event id…)
  label: string; // human name at the time of the click
  ts: number;
  sid: string; // random per-visit id — counts unique visits, identifies no one
};

export interface AnalyticsStore {
  record(e: AnalyticsEvent): void;
  recordMany(list: AnalyticsEvent[]): void;
  query(fromTs: number): Promise<AnalyticsEvent[]>;
  clear(): Promise<void>;
  /** Fires when new data arrives (other tab, realtime…). Returns an unsubscribe. */
  subscribe(cb: () => void): () => void;
  /** true while data comes only from this browser. */
  readonly local: boolean;
}

const KEY = 'guia-hospede:analytics';
const MAX = 20_000;
const CHANGE = 'guia-hospede:analytics-change';

const readAll = (): AnalyticsEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};

class LocalStore implements AnalyticsStore {
  readonly local = true;
  record(e: AnalyticsEvent) {
    this.recordMany([e]);
  }
  recordMany(list: AnalyticsEvent[]) {
    const all = readAll().concat(list);
    this.write(all.length > MAX ? all.slice(-MAX) : all);
  }
  write(all: AnalyticsEvent[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* quota — drop silently, analytics must never break the portal */
    }
    window.dispatchEvent(new Event(CHANGE));
  }
  async query(fromTs: number) {
    return readAll().filter((e) => e.ts >= fromTs);
  }
  async clear() {
    this.write([]);
  }
  subscribe(cb: () => void) {
    const onStorage = (e: StorageEvent) => e.key === KEY && cb();
    window.addEventListener(CHANGE, cb);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE, cb);
      window.removeEventListener('storage', onStorage);
    };
  }
}

export const store: AnalyticsStore = new LocalStore();

// ── Recording ────────────────────────────────────────────
const SID_KEY = 'guia-hospede:sid';
function sessionId() {
  let sid = sessionStorage.getItem(SID_KEY);
  if (!sid) {
    sid = Math.random().toString(36).slice(2, 12);
    sessionStorage.setItem(SID_KEY, sid);
  }
  return sid;
}

let last = { k: '', t: 0 };
export function track(type: AnalyticsType, target: string, label = target) {
  const k = `${type}:${target}`;
  const now = Date.now();
  if (k === last.k && now - last.t < 1500) return; // de-dupe double fires (re-renders, double taps)
  last = { k, t: now };
  store.record({ type, target, label, ts: now, sid: sessionId() });
}

/** Counts one visit per browser session. */
export function trackSessionStart() {
  if (sessionStorage.getItem(`${SID_KEY}:counted`)) return;
  sessionStorage.setItem(`${SID_KEY}:counted`, '1');
  track('session', 'portal', 'Acesso ao portal');
}

/** Tracking from inside the guest portal — disabled in the admin's live preview so staff clicks don't count. */
export function useTrack() {
  const { embedded } = useGuest();
  return useCallback(
    (type: AnalyticsType, target: string, label?: string) => {
      if (!embedded) track(type, target, label);
    },
    [embedded],
  );
}
