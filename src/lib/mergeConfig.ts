import type { HotelConfig } from '../types';

/**
 * Three-way merge for two admins editing at the same time.
 *   base   — the version both started from (last one this browser saw from the database)
 *   mine   — this browser's edits
 *   theirs — what another admin saved in the meantime
 * Whatever only one side changed is kept. Lists of items with an id (events, services, pins…) are merged
 * item by item, so editing different events never loses either change; when both sides changed the very
 * same field or item, this browser's version wins (it's what the person is looking at).
 */
export function mergeConfig(base: HotelConfig, mine: HotelConfig, theirs: HotelConfig): HotelConfig {
  return mergeValue(base, mine, theirs) as HotelConfig;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasIds = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.every((x) => isObj(x) && typeof (x as { id?: unknown }).id === 'string');

function mergeValue(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(mine, theirs)) return mine;
  if (isObj(base) && isObj(mine) && isObj(theirs)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      if (!(k in mine) && same(theirs[k], base[k])) continue; // removed here, untouched there
      if (!(k in theirs) && same(mine[k], base[k])) continue;
      out[k] = mergeValue(base[k], k in mine ? mine[k] : theirs[k], k in theirs ? theirs[k] : mine[k]);
    }
    return out;
  }
  if (hasIds(base) && hasIds(mine) && hasIds(theirs)) return mergeList(base, mine, theirs);
  return mine;
}

function mergeList<T extends { id: string }>(base: T[], mine: T[], theirs: T[]): T[] {
  const byId = (l: T[]) => new Map(l.map((x) => [x.id, x]));
  const b = byId(base);
  const t = byId(theirs);
  const m = byId(mine);
  const out: T[] = [];
  // My order, with each item merged against theirs; items they deleted (and I didn't touch) drop out.
  for (const item of mine) {
    const old = b.get(item.id);
    const other = t.get(item.id);
    if (!other) {
      if (old && same(item, old)) continue; // they deleted it, I didn't edit it
      out.push(item); // I added it, or edited something they deleted
    } else out.push(old ? (mergeValue(old, item, other) as T) : item);
  }
  // Items they added, placed after the item that precedes them on their side.
  theirs.forEach((item, i) => {
    if (m.has(item.id) || b.has(item.id)) return;
    const prev = theirs[i - 1]?.id;
    if (!prev) return void out.unshift(item);
    const at = out.findIndex((x) => x.id === prev);
    if (at < 0) out.push(item);
    else out.splice(at + 1, 0, item);
  });
  return out;
}
