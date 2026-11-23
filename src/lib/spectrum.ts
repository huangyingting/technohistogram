// Mineral Astrolabe Spectrum: Cinnabar terracotta & burnished bronze (1026) -> mineral gold ->
// malachite & verdigris jade -> glacial cyan -> warm porcelain pearl (2026), blended seamlessly in OKLCh
// over deep obsidian-pine shadows with a copper/jade chromatic fringe.

import { getTheme, onThemeChange, type ThemeSpec } from './theme';

export const ELECTRIC: [number, string][] = [
  [0, '#d96b38'],
  [0.14, '#e6943a'],
  [0.27, '#ebd060'],
  [0.4, '#a6db6c'],
  [0.53, '#47cf8e'],
  [0.66, '#1fc7a8'],
  [0.78, '#22c7d6'],
  [0.89, '#62e3e8'],
  [0.96, '#b8f7ec'],
  [1, '#f7f4eb'],
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
let sunkTargetHex = '#060d0e';

function buildLutFromCurve(curve: [number, string][]) {
  LUT.length = 0;
  const raw: [number, number, number][] = [];
  for (let i = 0; i <= 512; i++) {
    const t = i / 512;
    let k = 0;
    while (k < curve.length - 2 && t > curve[k + 1][0]) k++;
    const [t0, c0] = curve[k];
    const [t1, c1] = curve[k + 1];
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

buildLutFromCurve(getTheme().curve);
sunkTargetHex = getTheme().sunkTarget;

export function heat(t: number): string {
  return LUT[Math.round(Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1)) * 512)];
}

export function sunk(h: string, d: number): string {
  const [L1, a1, b1] = toOklab(h);
  const [L2, a2, b2] = toOklab(sunkTargetHex);
  const C = Math.hypot(a1, b1);
  let H = Math.atan2(b1, a1);
  if (!getTheme().isLight && H > 1.0 && H < 2.0) H += (1.05 - H) * d * 0.5;
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
  ai: ['#ffe3dc', '#f99b8b', '#ec5f4f', '#b43a2d', '#732119'],
  materials: ['#ffe5d4', '#f6a77a', '#df6d35', '#a64719', '#6c2b0d'],
  energy: ['#ffebd2', '#f6b868', '#e58a24', '#a85d0a', '#6d3a04'],
  space: ['#fdf0c4', '#f0ca55', '#cfa01c', '#946f0b', '#614704'],
  transport: ['#f7efc2', '#dfd06a', '#b8a528', '#827312', '#554b08'],
  biotech: ['#c8fae3', '#5ee9a8', '#22c382', '#0d8a58', '#075838'],
  computing: ['#c4fbf4', '#5eead4', '#1fb8a6', '#0d8275', '#06544c'],
  semiconductors: ['#ccf4fe', '#67dbf8', '#22aed6', '#0e7b9b', '#075066'],
  internet: ['#d8effe', '#85c8f9', '#469be2', '#236cb0', '#144574'],
  communications: ['#dfeafa', '#9cbbf2', '#6d92dc', '#4465aa', '#293f6e'],
  software: ['#eae4fb', '#c3aff5', '#9678e0', '#694cb0', '#432f73'],
  society: ['#f9e2ee', '#ea9fc8', '#cc67a0', '#964372', '#612949'],
  media: ['#fde2e6', '#f49eab', '#db6278', '#a13d50', '#692432'],
  agriculture: ['#eef8c8', '#c6e265', '#95ba29', '#698514', '#435609'],
  health: ['#cbf9ee', '#6de7cc', '#27bfa0', '#128971', '#0a5949'],
  home: ['#ffe9dd', '#f7b495', '#e47f58', '#aa5434', '#6f341f'],
};

export const GROUNDS = {
  night: '#060d0e',
  indigo: '#0c1c1e',
  print: '#e6ebe8',
  ultramarine: '#0d2629',
  violet: '#193836',
};

export const domainBase = (d: string): string => (SPECTRUM[d] || SPECTRUM.computing)[2];
export const domainLit = (d: string): string => (SPECTRUM[d] || SPECTRUM.computing)[1];
export const domainCore = (d: string): string => (SPECTRUM[d] || SPECTRUM.computing)[0];

export const INK = {
  onDark: '#f2efe9',
  onDark2: '#9cb5af',
  onDark3: '#68837d',
  onLight: '#0c1617',
  onLight2: '#425653',
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
  if (!h) return [156, 181, 175];
  if (h.startsWith('#')) {
    if (h.length === 4) {
      return [
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
        parseInt(h[3] + h[3], 16),
      ];
    }
    return [parseInt(h.slice(1, 3), 16) || 0, parseInt(h.slice(3, 5), 16) || 0, parseInt(h.slice(5, 7), 16) || 0];
  }
  const m = h.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
  return [156, 181, 175];
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

export const KIT = { ink: '#f2efe9', soft: '#9cb5af', night: '#060d0e', indigo: '#0c1c1e', ultramarine: '#0d2629' };

export function applySpectrumTheme(spec: ThemeSpec = getTheme()): void {
  buildLutFromCurve(spec.curve);
  sunkTargetHex = spec.sunkTarget;
  GROUNDS.night = spec.night;
  GROUNDS.indigo = spec.indigo;
  GROUNDS.ultramarine = spec.ultramarine;
  INK.onDark = spec.ink;
  INK.onDark2 = spec.soft;
  INK.onDark3 = spec.ink3;
  KIT.ink = spec.ink;
  KIT.soft = spec.soft;
  KIT.night = spec.night;
  KIT.indigo = spec.indigo;
  KIT.ultramarine = spec.ultramarine;
}

applySpectrumTheme(getTheme());
onThemeChange((spec) => applySpectrumTheme(spec));

export const VERDICT_NIGHT: Record<string, string> = {
  came_true: '#4ade9e',
  came_true_late: '#4fd1c5',
  partly: '#eab854',
  wrong: '#f06464',
  pending: '#8aa39d',
  misattributed: '#d482b8',
  unresolvable: '#6e8782',
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
