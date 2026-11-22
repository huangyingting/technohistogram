// Shared time axis from 3.31M BCE (-3310000) to 2026 in slot space.

export const YEAR_MIN = -3310000;
export const YEAR_MAX = 2026;
export const Y_MID = -10000;
export const Y_LATE = 1000;
const S_MID = 3300;
const S_LATE = 4400;
export const SLOT_MAX = S_LATE + (YEAR_MAX - Y_LATE); // 5426

export function slotOf(y: number): number {
  if (y >= Y_LATE) return Math.min(SLOT_MAX, S_LATE + (y - Y_LATE));
  if (y >= Y_MID) return S_LATE + Math.floor((y - Y_LATE) / 10);
  return Math.max(0, S_MID + Math.floor((y - Y_MID) / 1000));
}

export function yearOfSlot(s: number): number {
  if (s >= S_LATE) return Y_LATE + (s - S_LATE);
  if (s >= S_MID) return Y_LATE + (s - S_LATE) * 10;
  return Y_MID + (s - S_MID) * 1000;
}

export const slotSpan = (y: number): number => (y >= Y_LATE ? 1 : y >= Y_MID ? 10 : 1000);

export function slotF(y: number): number {
  if (y >= Y_LATE) return Math.min(SLOT_MAX, S_LATE + (y - Y_LATE));
  if (y >= Y_MID) return S_LATE + (y - Y_LATE) / 10;
  return Math.max(0, S_MID + (y - Y_MID) / 1000);
}

export function yearOfSlotF(s: number): number {
  if (s >= S_LATE) return Y_LATE + (s - S_LATE);
  if (s >= S_MID) return Y_LATE + (s - S_LATE) * 10;
  return Y_MID + (s - S_MID) * 1000;
}

export function fmtYear(y: number | null | undefined): string {
  if (y == null || !Number.isFinite(y)) return '';
  if (y > 0) return String(Math.round(y));
  const b = 1 - Math.round(y);
  return `${b.toLocaleString('en-US')} BCE`;
}

export function fmtTick(y: number | null | undefined): string {
  if (y == null || !Number.isFinite(y)) return '';
  if (y > 0) return y < 1000 ? `${Math.round(y)} CE` : String(Math.round(y));
  let b = 1 - Math.round(y);
  if (b >= 20000) b = Math.round(b / 1000) * 1000;
  else if (b >= 100) b = Math.round(b / 10) * 10;
  return `${b.toLocaleString('en-US')} BCE`;
}

export function fmtSpan(y0: number, y1: number): string {
  if (y0 > 0 && y1 > 0) return y1 - y0 <= 9 && y0 % 10 === 0 ? `The ${y0}s` : `${y0} to ${y1}`;
  return `${fmtTick(y0)} to ${fmtTick(y1)}`;
}

const KNOTS: [number, number][] = [
  [-3310000, 0],
  [-10000, 0.08],
  [1026, 0.16],
  [1500, 0.235],
  [1800, 0.33],
  [1900, 0.44],
  [1950, 0.56],
  [2000, 0.75],
  [2027, 1],
];

export function frac(t: number): number {
  if (t <= KNOTS[0][0]) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [y1, f1] = KNOTS[i];
    const [y0, f0] = KNOTS[i - 1];
    if (t <= y1) return f0 + ((t - y0) / (y1 - y0)) * (f1 - f0);
  }
  return 1;
}

export function unfrac(f: number): number {
  if (f <= 0) return KNOTS[0][0];
  for (let i = 1; i < KNOTS.length; i++) {
    const [y1, f1] = KNOTS[i];
    const [y0, f0] = KNOTS[i - 1];
    if (f <= f1) return y0 + ((f - f0) / (f1 - f0)) * (y1 - y0);
  }
  return KNOTS[KNOTS.length - 1][0];
}

export interface TimeScale {
  (t: number): number;
  invert: (px: number) => number;
  domain: {
    (): [number, number];
    (v: [number, number]): TimeScale;
  };
  range: {
    (): [number, number];
    (v: [number, number]): TimeScale;
  };
  copy: () => TimeScale;
  mode: string;
  ticks: (minPx?: number, labelPx?: number) => number[];
  major: (y: number) => boolean;
}

export function timeScale({
  domain = [YEAR_MIN, YEAR_MAX + 1] as [number, number],
  range = [0, 1] as [number, number],
  mode = 'warp',
} = {}): TimeScale {
  let [d0, d1] = domain;
  let [r0, r1] = range;
  const tf = mode === 'linear' ? (t: number) => t : mode === 'log' ? (t: number) => -Math.log(Math.max(1, 2037 - t)) : frac;
  const inv = mode === 'linear' ? (f: number) => f : mode === 'log' ? (f: number) => 2037 - Math.exp(-f) : unfrac;
  let f0 = tf(d0);
  let f1 = tf(d1);

  const s = ((t: number) => r0 + ((tf(t) - f0) / (f1 - f0 || 1)) * (r1 - r0)) as TimeScale;
  s.invert = (px: number) => inv(f0 + ((px - r0) / (r1 - r0 || 1)) * (f1 - f0));
  s.domain = ((v?: [number, number]) => {
    if (!v) return [d0, d1];
    [d0, d1] = v;
    f0 = tf(d0);
    f1 = tf(d1);
    return s;
  }) as TimeScale['domain'];
  s.range = ((v?: [number, number]) => {
    if (!v) return [r0, r1];
    [r0, r1] = v;
    return s;
  }) as TimeScale['range'];
  s.copy = () => timeScale({ domain: [d0, d1], range: [r0, r1], mode });
  s.mode = mode;
  s.ticks = (minPx = 56, labelPx = 26) => {
    const gap = Math.max(minPx, labelPx + 8);
    const lo = Math.ceil(d0);
    const hi = Math.floor(Math.min(d1, YEAR_MAX));
    const placed: { y: number; px: number }[] = [];
    const fits = (y: number) => {
      const px = s(y);
      return placed.every((q) => Math.abs(q.px - px) >= gap);
    };
    const add = (y: number) => {
      if (y >= lo && y <= hi && !placed.some((q) => q.y === y) && fits(y)) placed.push({ y, px: s(y) });
    };
    if (hi === YEAR_MAX) add(YEAR_MAX);
    for (const st of [1000000, 100000, 10000, 1000, 500, 100, 50, 25, 10, 5, 2, 1]) {
      const anchors = () => [lo, ...placed.map((q) => q.y), hi].sort((u, v) => u - v);
      const cands: number[] = [];
      for (let y = Math.ceil(lo / st) * st; y <= hi; y += st) cands.push(y);
      for (const y of cands) {
        const an = anchors();
        const p1 = Math.max(...an.filter((v) => v < y));
        const p2 = Math.min(...an.filter((v) => v > y));
        if (st < 100 && y !== lo && y !== hi && (!Number.isFinite(p1) || !Number.isFinite(p2) || p2 - p1 > st * 4)) continue;
        if (st >= 500 && y < 1000 && y % (st * 2) !== 0 && st < 1000000 && placed.length > 3) continue;
        add(y);
      }
    }
    if (!placed.length) add(lo);
    return placed.map((q) => q.y).sort((u, v) => u - v);
  };
  s.major = (y: number) => {
    const span = d1 - d0;
    return span > 400 ? y % 100 === 0 : span > 120 ? y % 50 === 0 : y % 10 === 0;
  };
  return s;
}

export const AGES = [
  { id: 'medieval', label: 'Paper, type, water clocks', short: '1026 to 1450', start: 1026, end: 1450 },
  { id: 'print', label: 'Press, cannon, silver', short: '1450 to 1760', start: 1450, end: 1760 },
  { id: 'industrial', label: 'Coal, steam, telegraph', short: '1760 to 1914', start: 1760, end: 1914 },
  { id: 'electric', label: 'Electronics and the transistor', short: '1914 to 1990', start: 1914, end: 1990 },
  { id: 'network', label: 'The web', short: '1990 to 2017', start: 1990, end: 2017 },
  { id: 'ai', label: 'Transformer models', short: '2017 to 2026', start: 2017, end: 2027 },
];

export const ageForYear = (y: number) => AGES.find((a) => y >= a.start && y < a.end) || AGES[AGES.length - 1];

export interface RegionInfo {
  id: string;
  label: string;
  short: string;
  color: string;
}

export const REGIONS: RegionInfo[] = [
  { id: 'europe', label: 'Europe', short: 'Europe', color: '#2d5a88' },
  { id: 'middle-east', label: 'Middle East and North Africa', short: 'MENA', color: '#c99a1e' },
  { id: 'east-asia', label: 'East Asia', short: 'E Asia', color: '#b8282e' },
  { id: 'south-asia', label: 'South Asia', short: 'S Asia', color: '#d8603c' },
  { id: 'africa', label: 'Sub-Saharan Africa', short: 'Africa', color: '#6f8f4a' },
  { id: 'latin-america', label: 'Latin America and the Caribbean', short: 'Lat America', color: '#7a9a3a' },
  { id: 'north-america', label: 'North America', short: 'N America', color: '#3c4180' },
  { id: 'oceania', label: 'Oceania and the Pacific', short: 'Oceania', color: '#2f8a9a' },
  { id: 'global', label: 'Global', short: 'Global', color: '#8f6aa0' },
];

export const REGION: Record<string, RegionInfo> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
REGION.americas = REGION['north-america'];
export const regionColor = (id: string): string => (REGION[id] ? REGION[id].color : '#a59a83');
