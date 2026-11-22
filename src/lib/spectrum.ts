// The Histomap's colour is one blend: electric blue, violet, hot pink, red-orange, orange, yellow, white,
// blended in OKLCh without a seam, with deep navy shadows and a chromatic fringe on the lines.

export const ELECTRIC: [number, string][] = [
  [0, '#ffd84a'],
  [0.14, '#ff9a1f'],
  [0.28, '#ff5a2a'],
  [0.4, '#ff3f66'],
  [0.5, '#ff2d9b'],
  [0.62, '#c438e8'],
  [0.73, '#7a45ff'],
  [0.84, '#2a5cff'],
  [0.93, '#3fa9ff'],
  [1, '#f2f8ff'],
];

const _hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];
const _lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const _srgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function toOklab(h: string): [number, number, number] {
  const [r, g, b] = _hex(h).map(_lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  ];
}

export function fromOklab(L: number, a: number, b: number): string {
  for (let k = 0; k < 12; k++) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s2 = s_ ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2,
    ];
    if (rgb.every((c) => c >= -0.002 && c <= 1.002) || k === 11) {
      return (
        '#' +
        rgb
          .map((c) =>
            Math.round(Math.min(1, Math.max(0, _srgb(Math.min(1, Math.max(0, c))))) * 255)
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
      );
    }
    a *= 0.88;
    b *= 0.88;
  }
  return '#ffffff';
}

export function blend(h1: string, h2: string, t: number): string {
  const [L1, a1, b1] = toOklab(h1);
  const [L2, a2, b2] = toOklab(h2);
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  let H1 = Math.atan2(b1, a1);
  let H2 = Math.atan2(b2, a2);
  if (C1 < 0.02) H1 = H2;
  if (C2 < 0.02) H2 = H1;
  let d = H2 - H1;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  const L = L1 + (L2 - L1) * t;
  const C = C1 + (C2 - C1) * t;
  const H = H1 + d * t;
  return fromOklab(L, C * Math.cos(H), C * Math.sin(H));
}

const LUT: string[] = [];
{
  const raw: [number, number, number][] = [];
  for (let i = 0; i <= 512; i++) {
    const t = i / 512;
    let k = 0;
    while (k < ELECTRIC.length - 2 && t > ELECTRIC[k + 1][0]) k++;
    const [t0, c0] = ELECTRIC[k];
    const [t1, c1] = ELECTRIC[k + 1];
    raw.push(toOklab(blend(c0, c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))))));
  }
  let cur = raw;
  for (let pass = 0; pass < 3; pass++) {
    const nx: [number, number, number][] = [];
    for (let i = 0; i <= 512; i++) {
      let L = 0;
      let a = 0;
      let b = 0;
      let n = 0;
      for (let j = -10; j <= 10; j++) {
        const q = cur[Math.min(512, Math.max(0, i + j))];
        L += q[0];
        a += q[1];
        b += q[2];
        n++;
      }
      nx.push([L / n, a / n, b / n]);
    }
    cur = nx;
  }
  for (const [L, a, b] of cur) LUT.push(fromOklab(L, a, b));
}

export function heat(t: number): string {
  return LUT[Math.round(Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1)) * 512)];
}

export function sunk(h: string, d: number): string {
  const [L1, a1, b1] = toOklab(h);
  const [L2, a2, b2] = toOklab('#06081a');
  const C = Math.hypot(a1, b1);
  let H = Math.atan2(b1, a1);
  if (H > 1.0 && H < 2.0) H += (1.05 - H) * d * 0.5;
  const L = L1 + (L2 - L1) * d;
  const Cs = C * (1 - 0.45 * d);
  const a = Cs * Math.cos(H) + (a2 - a1) * d * 0.3;
  const b = Cs * Math.sin(H) + (b2 - b1) * d * 0.3;
  return fromOklab(L, a, b);
}

export const ORDER = [
  'ai',
  'materials',
  'energy',
  'space',
  'transport',
  'agriculture',
  'biotech',
  'health',
  'computing',
  'semiconductors',
  'internet',
  'communications',
  'software',
  'society',
  'media',
  'home',
] as const;

export const SPECTRUM: Record<string, [string, string, string, string, string]> = {
  ai: ['#fedfdf', '#fe9fa2', '#fc5d6d', '#bd3748', '#7b242e'],
  materials: ['#ffe0d7', '#ffa286', '#fe612c', '#bc3e0d', '#7b290c'],
  energy: ['#ffe1d0', '#fea56e', '#eb7616', '#ab5201', '#713401'],
  space: ['#ffe3c1', '#fdaa24', '#d28a0c', '#966208', '#643f00'],
  transport: ['#fae7af', '#e3b904', '#ba9708', '#856c07', '#584600'],
  biotech: ['#bdf8d7', '#1bdf95', '#18b77a', '#008455', '#015636'],
  computing: ['#acf8f5', '#21d8d4', '#00b2ae', '#037f7c', '#035351'],
  semiconductors: ['#caeffe', '#44cffe', '#0fabd7', '#0b7a9a', '#005067'],
  internet: ['#dbe9ff', '#96c0fe', '#599bfb', '#236bcf', '#184687'],
  communications: ['#e1e7ff', '#abb9fe', '#8090fc', '#5560cf', '#373e87'],
  software: ['#ebe3ff', '#c9acfe', '#ae7bfb', '#7f51c1', '#53347e'],
  society: ['#ffdbf6', '#ff90e9', '#e55ece', '#a73f95', '#6d2961'],
  media: ['#ffdee9', '#ff9ac0', '#f9559f', '#b53772', '#76254a'],
  agriculture: ['#edf6bf', '#c9e24f', '#9fbf12', '#728a08', '#4a5a04'],
  health: ['#c9f6ec', '#62e6cb', '#1fc0a4', '#0f8b76', '#0a5b4d'],
  home: ['#ffe6dc', '#ffb8a0', '#ff8666', '#c45a3a', '#7f3a22'],
};

export const GROUNDS = {
  night: '#06081a',
  indigo: '#141a3d',
  print: '#e3e4ea',
  ultramarine: '#1c2c96',
  violet: '#5a2a9a',
};

export const domainBase = (d: string): string => (SPECTRUM[d] || SPECTRUM.computing)[2];
export const domainLit = (d: string): string => (SPECTRUM[d] || SPECTRUM.computing)[1];
export const domainCore = (d: string): string => (SPECTRUM[d] || SPECTRUM.computing)[0];

export const INK = {
  onDark: '#eef0fa',
  onDark2: '#b9c0e4',
  onDark3: '#7f88b8',
  onLight: '#0f1120',
  onLight2: '#4a4f66',
};

export const VERDICT: Record<string, { mark: string; word: string; pale: string }> = {
  came_true: { mark: '#00906e', word: '#00624a', pale: '#b2edd6' },
  came_true_late: { mark: '#008d8a', word: '#00605d', pale: '#a9edea' },
  partly: { mark: '#987500', word: '#674f00', pale: '#f4dca2' },
  wrong: { mark: '#cb4457', word: '#951b34', pale: '#ffd1d2' },
  misattributed: { mark: '#ad5698', word: '#7d316b', pale: '#ffccf0' },
  pending: { mark: '#8b8fa8', word: '#5d6280', pale: '#d9dbe6' },
  unresolvable: { mark: '#b4b7c6', word: '#6f7390', pale: '#e9eaf0' },
};

export function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return (
    '#' +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    ).join('')
  );
}

export function rgba(h: string, a: number): string {
  const [r, g, b] = hex(h);
  return `rgba(${r},${g},${b},${a})`;
}

export const SPIRAL = Object.fromEntries(
  ORDER.map((d) => [d, [SPECTRUM[d][0], SPECTRUM[d][1], SPECTRUM[d][2], SPECTRUM[d][3], mix(SPECTRUM[d][3], SPECTRUM[d][4], 0.5)]]),
);

export const step = (d: string, i: number): string => (SPECTRUM[d] || SPECTRUM.computing)[Math.max(0, Math.min(4, i))];

export const FAMILIES = ['computing', 'communications', 'ai', 'society', 'energy', 'transport', 'biotech', 'software'].map(
  (d) => ({ ink: SPECTRUM[d][2], bright: SPECTRUM[d][1], dim: SPECTRUM[d][4] }),
);

export const PAIRS: Record<string, [string, string]> = {
  capability: ['computing', 'semiconductors'],
  methods: ['semiconductors', 'internet'],
  agents: ['internet', 'communications'],
  labor: ['energy', 'materials'],
  economy: ['transport', 'space'],
  distribution: ['society', 'software'],
  science: ['biotech', 'computing'],
  society: ['software', 'media'],
  control: ['ai', 'media'],
  governance: ['communications', 'society'],
  access: ['biotech', 'semiconductors'],
  resources: ['space', 'energy'],
  geopolitics: ['communications', 'computing'],
  reliability: ['media', 'society'],
};

export const MOTION = { fall: 900, split: 600, trace: 1400, resolve: 500 };

export const KIT = { ink: '#eef0fa', soft: '#aeb6dc', night: '#06081a', indigo: '#141a3d', ultramarine: '#1c2c96' };

export const VERDICT_NIGHT: Record<string, string> = {
  came_true: '#3fe0a0',
  came_true_late: '#36c9d6',
  partly: '#f2c14e',
  wrong: '#ff4d6d',
  pending: 'rgba(185,192,255,0.6)',
  misattributed: '#e07be0',
  unresolvable: '#7a80a8',
};

import { isZh, VERDICT_ZH, STATUS_ZH } from './i18n';

const VERDICT_WORD_EN: Record<string, string> = {
  came_true: 'came true',
  came_true_late: 'came true late',
  partly: 'partly',
  wrong: 'wrong',
  pending: 'pending',
  misattributed: 'misattributed',
  unresolvable: 'unresolvable',
};

export const VERDICT_WORD: Record<string, string> = new Proxy(VERDICT_WORD_EN, {
  get(target, prop: string) {
    if (typeof prop === 'string' && isZh() && VERDICT_ZH[prop]) return VERDICT_ZH[prop];
    return target[prop];
  },
});

export const STATUS_NIGHT: Record<string, string> = {
  came_true: '#3fe0a0',
  on_track: '#8fd9b8',
  behind: '#f2b24e',
  contradicted: '#ff6f86',
  too_early: '#9aa3e6',
  unresolvable: '#7a80a8',
};

const STATUS_WORD_EN: Record<string, string> = {
  came_true: 'came true',
  on_track: 'on track',
  behind: 'behind',
  contradicted: 'contradicted',
  too_early: 'too early to tell',
  unresolvable: 'no measure',
};

export const STATUS_WORD: Record<string, string> = new Proxy(STATUS_WORD_EN, {
  get(target, prop: string) {
    if (typeof prop === 'string' && isZh() && STATUS_ZH[prop]) return STATUS_ZH[prop];
    return target[prop];
  },
});
