/**
 * Anonymous usage analytics for the management dashboard.
 *
 * Every guest interaction becomes one small, anonymous record (no name, phone or room).
 * Storage goes through `AnalyticsStore`, so moving from this browser (localStorage)
 * to a shared database (Supabase) only means swapping `store` — screens stay the same.
 */
import { useCallback } from 'react';
import { HOTEL_ID, isRemote, loadSupabase, rest } from './backend';
import { useGuest } from '../state/GuestContext';
import { hotelKey } from './tenant';

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

const KEY = hotelKey('guia-hospede:analytics');
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

/**
 * Shared database: guests only insert (batched, plain REST — no supabase-js in the guest bundle);
 * admins read via RLS with the full client, loaded on demand.
 */
class SupabaseStore implements AnalyticsStore {
  readonly local = false;
  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor() {
    const flushNow = () => this.flush();
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow());
  }
  record(e: AnalyticsEvent) {
    this.recordMany([e]);
  }
  recordMany(list: AnalyticsEvent[]) {
    this.queue.push(...list);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 2000);
  }
  private async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    // `ts` is set by the database (server time) — clients can't backdate events.
    const rows = batch.map((e) => ({
      hotel_id: HOTEL_ID,
      type: e.type,
      target: e.target.slice(0, 80),
      label: e.label.slice(0, 120),
      sid: e.sid.slice(0, 40),
    }));
    const body = JSON.stringify(rows);
    let ok = false;
    try {
      // keepalive: the request survives the tab closing (flush on pagehide). Browsers cap it at 64 KB.
      const res = await rest('analytics_events', {
        method: 'POST',
        body,
        headers: { Prefer: 'return=minimal' },
        keepalive: body.length < 60_000,
      });
      ok = res.ok;
    } catch {
      /* offline — retried below */
    }
    if (!ok && this.queue.length < 500) this.queue.unshift(...batch); // retry on the next flush
  }
  async query(fromTs: number) {
    const db = await loadSupabase();
    if (!db) return [];
    const out: AnalyticsEvent[] = [];
    const PAGE = 1000;
    for (let i = 0; i < 100; i++) {
      const { data, error } = await db
        .from('analytics_events')
        .select('type,target,label,sid,ts')
        .eq('hotel_id', HOTEL_ID)
        .gte('ts', new Date(fromTs).toISOString())
        .order('ts', { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const r of data) out.push({ ...(r as Omit<AnalyticsEvent, 'ts'>), ts: Date.parse(r.ts as string) });
      if (data.length < PAGE) break;
    }
    return out;
  }
  async clear() {
    const db = await loadSupabase();
    if (!db) return;
    // Individual clicks and the summaries the reports are computed from.
    for (const table of ['analytics_events', 'analytics_daily', 'analytics_hourly']) {
      const { error } = await db.from(table).delete().eq('hotel_id', HOTEL_ID);
      if (error) throw new Error(error.message);
    }
  }
  subscribe(cb: () => void) {
    let t: ReturnType<typeof setTimeout> | undefined;
    const throttled = () => {
      if (!t) t = setTimeout(() => ((t = undefined), cb()), 5000);
    };
    let alive = true;
    let off = () => {};
    loadSupabase().then((db) => {
      if (!db || !alive) return;
      const ch = db
        .channel(`analytics:${HOTEL_ID}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'analytics_events', filter: `hotel_id=eq.${HOTEL_ID}` },
          throttled,
        )
        .subscribe();
      off = () => db.removeChannel(ch);
    });
    return () => {
      alive = false;
      clearTimeout(t);
      off();
    };
  }
}

export const store: AnalyticsStore = isRemote ? new SupabaseStore() : new LocalStore();

// ── Recording ────────────────────────────────────────────
const SID_KEY = hotelKey('guia-hospede:sid');
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
