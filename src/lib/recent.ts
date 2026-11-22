import { db } from './data';

const DAY = 86400000;
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

export const dateOf = (e: any): number | null =>
  e.month && e.day ? Date.UTC(e.year, e.month - 1, e.day) : null;

export function yearFrac(ms: number): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const a = Date.UTC(y, 0, 1);
  const b = Date.UTC(y + 1, 0, 1);
  return y + (ms - a) / (b - a);
}

export const fmtDate = (ms: number, opts: Intl.DateTimeFormatOptions = {}): string =>
  new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...opts });

let cache: any = null;
let cacheKey = '';

export function recent() {
  const key = `${db.events.length}:${db.loaded.has('text')}`;
  if (cache && cacheKey === key) return cache;
  let latest = -Infinity;
  for (const e of db.events) {
    const d = dateOf(e);
    if (d != null && d > latest) latest = d;
  }
  if (!isFinite(latest)) return (cache = { latest: null, week: [], month: [], all: [] });
  const weekFrom = latest - WEEK_DAYS * DAY;
  const monthFrom = latest - MONTH_DAYS * DAY;
  const week: any[] = [];
  const month: any[] = [];
  for (const e of db.events) {
    const d = dateOf(e);
    if (d == null || d < monthFrom) continue;
    (d >= weekFrom ? week : month).push(e);
  }
  const byDate = (a: any, b: any) =>
    (dateOf(b) || 0) - (dateOf(a) || 0) || b.significance - a.significance || a.title.localeCompare(b.title);
  week.sort(byDate);
  month.sort(byDate);
  cacheKey = key;
  return (cache = {
    latest,
    weekFrom,
    monthFrom,
    year: new Date(latest).getUTCFullYear(),
    t: yearFrac(latest),
    tWeek: yearFrac(weekFrom),
    tMonth: yearFrac(monthFrom),
    week,
    month,
    all: week.concat(month),
    ids: new Set(week.map((e) => e.id)),
  });
}
