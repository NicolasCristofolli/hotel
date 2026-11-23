import { store, type AnalyticsEvent } from './analytics';
import { HOTEL_ID, supabase } from './supabase';

/**
 * Report numbers for a period. Online they're computed in the database (`hotel_report`, over the daily
 * and hourly summaries — the payload is the same size for 100 or 10 million clicks); in local demo mode
 * the same shape is built here from this browser's events.
 */
export type ReportTarget = { type: string; target: string; label: string; n: number };
export type Report = {
  /** Hotel's current date ("YYYY-MM-DD"), in its time zone. */
  today: string;
  totals: Record<string, number>;
  prevTotals: Record<string, number> | null;
  targets: ReportTarget[];
  /** 24 values, hour of the day in the hotel's time zone (page views excluded). */
  byHour: number[];
  /** Guest sessions per day ("YYYY-MM-DD"); days without visits are omitted. */
  byDay: { day: string; n: number }[];
  /** First day with data, or null when there's none. */
  first: string | null;
};

/** Individual clicks are kept this long (see 0007_analytics_rollup.sql) — the CSV export covers it. */
export const RAW_RETENTION_DAYS = 90;

const DAY = 86_400_000;

export const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "2026-11-23" → Date at noon UTC (calendar math without time-zone surprises). */
export const parseDay = (day: string) => new Date(`${day}T12:00:00Z`);
export const addDays = (day: string, n: number) => parseDay(day).getTime() + n * DAY;
export const dayKeyUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** @param days 1 = today, 7, 30…; null = everything */
export async function loadReport(days: number | null): Promise<Report> {
  if (!supabase) return buildReport(await store.query(0), days);
  const { data, error } = await supabase.rpc('hotel_report', { p_hotel: HOTEL_ID, p_days: days });
  if (error) throw new Error(error.message);
  const r = data as {
    today: string;
    totals: Record<string, number>;
    prev_totals: Record<string, number> | null;
    targets: ReportTarget[];
    by_hour: number[];
    by_day: { day: string; n: number }[];
    first: string | null;
  };
  return {
    today: r.today,
    totals: r.totals,
    prevTotals: r.prev_totals,
    targets: r.targets.map((t) => ({ ...t, n: Number(t.n) })),
    byHour: r.by_hour.map(Number),
    byDay: r.by_day.map((d) => ({ day: d.day, n: Number(d.n) })),
    first: r.first,
  };
}

/** Same computation as `hotel_report`, over raw events, in the browser's time zone (local demo mode). */
export function buildReport(all: AnalyticsEvent[], days: number | null): Report {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const from = days === null ? 0 : midnight - (days - 1) * DAY;
  const prevFrom = days === null ? null : from - days * DAY;

  const totals: Record<string, number> = {};
  const targets = new Map<string, ReportTarget & { ts: number }>();
  const byHour = Array.from({ length: 24 }, () => 0);
  const byDay = new Map<string, number>();
  const prevTotals: Record<string, number> | null = prevFrom === null ? null : {};

  for (const e of all) {
    if (e.ts < from) {
      if (prevTotals && prevFrom !== null && e.ts >= prevFrom) prevTotals[e.type] = (prevTotals[e.type] ?? 0) + 1;
      continue;
    }
    totals[e.type] = (totals[e.type] ?? 0) + 1;
    const k = `${e.type}\u0000${e.target}`;
    const t = targets.get(k) ?? { type: e.type, target: e.target, label: e.label, n: 0, ts: 0 };
    t.n++;
    if (e.ts >= t.ts) {
      t.label = e.label;
      t.ts = e.ts;
    }
    targets.set(k, t);
    const d = new Date(e.ts);
    if (e.type !== 'page') byHour[d.getHours()]++;
    if (e.type === 'session') byDay.set(localDayKey(d), (byDay.get(localDayKey(d)) ?? 0) + 1);
  }

  return {
    today: localDayKey(now),
    totals,
    prevTotals,
    targets: [...targets.values()].map(({ ts: _ts, ...t }) => t).sort((a, b) => b.n - a.n),
    byHour,
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => ({ day, n })),
    first: all.length ? localDayKey(new Date(Math.min(...all.map((e) => e.ts)))) : null,
  };
}
