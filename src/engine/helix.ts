// The Histomap 3D coil view: constant-radius helix (one loop per century, 1026..2026, plus 8 lineage roots from 3.3M BCE
// and a dashed ghost ring to 2076), rendered via Three.js WebGPURenderer + TSL InstancedMesh batches (HelixGpuRenderer)
// with crisp 2D canvas layers for typography, interactive HUD, reading plates, claim arcs, and strip scrubbing.
import {
  db,
  ensure,
  onData,
  fmtDate,
  forecastOrder,
  pickForecasts,
  forecastCount,
  census,
} from '../lib/data';
import {
  ORDER,
  VERDICT_NIGHT,
  VERDICT_WORD,
  STATUS_NIGHT,
  STATUS_WORD,
  GROUNDS,
  heat,
  sunk,
  mix,
  blend,
  toOklab,
  fromOklab,
} from '../lib/spectrum';
import { DOMAIN, TYPE } from '../lib/palette';
import { REGION, YEAR_MIN, YEAR_MAX, fmtYear, fmtSpan, fmtTick } from '../lib/time';
import { esc, tip, select as selectRecord, openEvidence } from '../lib/ui';
import { assetUrl } from '../lib/basePath';
import { state, hashParams } from '../lib/store';
import { POSTER } from '../lib/poster';
import { HelixGpuRenderer } from './helixGpu';
import {
  isZh,
  onLangChange,
  FONT_STACK_DISPLAY,
  FONT_STACK_SANS,
  ROOT_LINEAGE_ZH,
} from '../lib/i18n';
import { tokenizeText, joinToken } from '../lib/text';

const T0 = 1026;
const T1 = YEAR_MAX;
const R = 400;
const SPAN = R + 1026;
const NL = ORDER.length;
const Y_LO = YEAR_MIN;

const RK: [number, number][] = [
  [YEAR_MIN, 0],
  [-99999, 0.12],
  [-9999, 0.26],
  [-2999, 0.5],
  [1, 0.76],
  [1026, 1],
];

const rootF = (y: number): number => {
  if (y <= RK[0][0]) return 0;
  for (let i = 1; i < RK.length; i++) {
    if (y <= RK[i][0]) {
      const [y0, f0] = RK[i - 1];
      const [y1, f1] = RK[i];
      return f0 + (f1 - f0) * Math.log10(1 + (9 * (y - y0)) / (y1 - y0));
    }
  }
  return 1;
};

const rootY = (f: number): number => {
  let lo = YEAR_MIN;
  let hi = 1026;
  for (let k = 0; k < 48; k++) {
    const m = (lo + hi) / 2;
    if (rootF(m) < f) lo = m;
    else hi = m;
  }
  return Math.round(lo);
};

const slf = (y: number): number =>
  y >= T0 ? R + Math.min(T1, y) - 1000 : rootF(y) * (R - 1e-6);
const sl = (y: number): number => Math.floor(slf(y));

const rootYMemo = new Map<number, number>();
const rootYM = (f: number): number => {
  let v = rootYMemo.get(f);
  if (v === undefined) {
    v = rootY(f);
    if (rootYMemo.size < 4096) rootYMemo.set(f, v);
  }
  return v;
};

const yearOfSlotF = (s: number): number => (s >= R ? 1000 + s - R : rootYM(s / R));
const yearOfSlot = (s: number): number => (s >= R ? 1000 + s - R : rootYM(s / R));
const slx = (y: number): number => (y > T1 ? SPAN + (y - T1) : slf(y));

const LIN: [string, string[]][] = [
  ['Stone and metal', ['materials', 'energy', 'semiconductors']],
  ['Farming and food', ['agriculture']],
  ['Shelter', ['home']],
  ['Boats and roads', ['transport']],
  ['Writing and number', ['media', 'computing', 'software', 'ai', 'internet']],
  ['Healing', ['health', 'biotech']],
  ['Signals and sky', ['communications', 'space']],
  ['Law and trade', ['society']],
];
const LIN_OF: Record<string, number> = Object.fromEntries(
  LIN.flatMap(([, ds], i) => ds.map((d) => [d, i])),
);
const LANE_LIN = ORDER.map((d) => LIN_OF[d] ?? 7);

const INK = '#f2efe9';
const SOFT = '#9cb5af';
const NIGHT = GROUNDS.night;
const GROUND = ['#050b0c', '#091517', '#0f2224'];
const FRINGE_BLUE = '#2dd4bf';
const FRINGE_RED = '#e8834a';
const CORE = '#f7f4eb';
const FONT_DISPLAY = FONT_STACK_DISPLAY;
const FONT_TEXT = FONT_STACK_SANS;
const linName = (en: string) => (isZh() ? ROOT_LINEAGE_ZH[en] || en : en);
const capW = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const MIN_TEXT = 13;

interface StagePreset {
  vert: boolean;
  el: number;
  az: number;
  dist: number;
  fov: number;
  ox: number;
  oy: number;
  picMax: number;
  lines: number;
  claims: number;
  head: number;
  line: number;
  year: number;
  cent: number;
  readout: number;
  card: number;
  colW: number;
}

const DESK: StagePreset = {
  vert: false,
  el: 22,
  az: 32,
  dist: 2.98,
  fov: 1.05,
  ox: 0.395,
  oy: 0.485,
  picMax: 74,
  lines: 9,
  claims: 3,
  head: 18,
  line: 13,
  year: 13,
  cent: 22,
  readout: 54,
  card: 13.5,
  colW: 336,
};

const VERT: StagePreset = {
  vert: true,
  el: 22,
  az: 32,
  dist: 3.5,
  fov: 1.15,
  ox: 0.5,
  oy: 0.55,
  picMax: 56,
  lines: 5,
  claims: 1,
  head: 17,
  line: 13,
  year: 13,
  cent: 18,
  readout: 38,
  card: 13.5,
  colW: 0,
};

const PITCH = 0.9;
const LANE_W = 0.062;
const LAYER = 0.016;
const A0 = (270 * Math.PI) / 180;
const GAP_Y = ((6 / 360) * 100) / 2;
const ROOT_LEN = 4.4 * PITCH;
const ROOT_X = -10 * PITCH;
const EMBER = '#4d2619';
const TONE = [0, 1, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2, 1];
const FLOOR_PULLED = 2.6;
const FLOOR_FAR = 2.2;
const OMEGA_PHONE = 11;
const BREATH = 0.2;
const BREATH_AT = 110;
const BREATH_OUT_S = 0.16;
const BREATH_HOME_S = 0.3;
const COAST_TAU = 0.5;
const COAST_K = 4;
const COAST_MS = COAST_TAU * COAST_K * 1000;
const coast = (t: number) => (1 - Math.exp(-COAST_K * t)) / (1 - Math.exp(-COAST_K));
const OMEGA = 15;
const SPEED_MAX = 520;
const FLING_MS = 900;
const RIDE_MS = 1400;
const SETTLE_MS = 700;
const REST_MS = 150;
const LINES_MS = 120;
const HOLD_SPEED = 70;
const GLIDE_END_MS = 240;
const QUICK_MS = 140;
const RO_DWELL_MS = 220;
const NOTCH_PX = 120;
const YPP = 0.16;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const laneIx: Record<string, number> = Object.fromEntries(ORDER.map((d, i) => [d, i]));

const rootCol = (f: number) => blend(EMBER, heat(0), Math.pow(clamp(f, 0, 1), 1.5));
const colAt = (sf: number) => (sf < R ? rootCol(sf / R) : heat((sf - R - 26) / 1000));
const uOf = (y: number) => (slf(y) - R - 26) / 1000;

const COLS: string[] = [];
for (let si = 0; si <= SPAN; si++) {
  const h =
    si < R
      ? rootCol(si / R)
      : heat(
          uOf(yearOfSlot(si)) +
            0.012 * Math.sin(si * 0.37) +
            0.008 * Math.sin(si * 1.31),
        );
  for (const t of [h, mix(h, INK, 0.22), sunk(h, 0.22)]) {
    COLS.push(t, sunk(t, 0.2), sunk(t, 0.42));
  }
}

const heatOf = (y: number) => colAt(slf(y));
const W_SIZE = [1, 1, 1, 1, 1.08];
const W_SAT = [0.6, 0.7, 0.85, 1, 0.95];
const W_LIFT = [0, 0, 0, 0.03, 0.17];
const wOf = (e: any) => clamp(Math.round((e && e.significance) || 3), 1, 5) - 1;
const satOf = (h: string, k: number, up = 0) => {
  const [L, a, b] = toOklab(h);
  return fromOklab(Math.min(1, L + up), a * k, b * k);
};
const COLW = new Array<string>(COLS.length * 5);
const colW = (key: number): string =>
  COLW[key] ||
  (COLW[key] = satOf(COLS[(key / 5) | 0], W_SAT[key % 5], W_LIFT[key % 5]));

const typeOf = (y: number) => mix(heatOf(y), INK, 0.32);
const lumOf = (c: string) => {
  const v = [1, 3, 5]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((u2) => (u2 <= 0.03928 ? u2 / 12.92 : Math.pow((u2 + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const typeOfPhone = (y: number) => {
  const h = heatOf(y);
  let m = 0.32;
  let c = mix(h, INK, m);
  while (m < 0.9 && (lumOf(c) + 0.05) / 0.062 < 5) {
    m += 0.06;
    c = mix(h, INK, m);
  }
  return c;
};
const u = (y: number) => slf(y) / SPAN;
const reduced = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
const early = (y: number) => y < 2000;

const RB: number[] = [];
for (let k = 0; k < R / 10; k++) RB.push(rootY((k * 10) / R));
RB.push(T0);
for (let k = 1; k < RB.length; k++) if (RB[k] <= RB[k - 1]) RB[k] = RB[k - 1] + 1;
const rootBin = (y: number) => {
  let k = 0;
  while (k < RB.length - 2 && y >= RB[k + 1]) k++;
  return k;
};

const unitOf = (y: number) => {
  if (y < T0) return RB[rootBin(y)];
  return early(y) ? Math.max(T0, Math.floor(y / 10) * 10) : Math.round(y);
};
const unitEnd = (u0: number) =>
  u0 < T0 ? RB[rootBin(u0) + 1] - 1 : early(u0) ? Math.floor(u0 / 10) * 10 + 9 : u0;
const unitLabel = (u0: number) => {
  if (u0 < T0) return fmtSpan(u0, unitEnd(u0));
  if (isZh()) {
    if (u0 === T0) return '1026\u20131029年';
    return early(u0) ? `${u0}年代` : `${u0}年`;
  }
  if (u0 === T0) return '1026\u20131029';
  return early(u0) ? `${u0}s` : String(u0);
};
const fmtReadout = (u0: number): [string, string] => {
  if (u0 >= T0) {
    if (isZh()) {
      if (u0 === T0) return ['1026\u20131029', '年'];
      return early(u0) ? [String(u0), '年代'] : [String(u0), '年'];
    }
    return [unitLabel(u0), ''];
  }
  const y = Math.round(u0);
  if (isZh()) {
    if (y > 0) return [String(y), '公元'];
    const b = 1 - y;
    if (b >= 1e6) {
      const wan = Math.round(b / 1e5) * 10;
      return [`${wan}万`, '公元前'];
    }
    if (b >= 1e4) {
      const w = b / 1e4;
      return [`${Number.isInteger(w) ? w : w.toFixed(1)}万`, '公元前'];
    }
    return [b.toLocaleString('en-US'), '公元前'];
  }
  if (y > 0) return [String(y), 'CE'];
  const b = 1 - y;
  if (b >= 1e6) {
    const m = Math.round(b / 1e5) / 10;
    return [m % 1 ? m.toFixed(1) : String(m), 'million BCE'];
  }
  if (b >= 1e4) return [`${Math.round(b / 1000).toLocaleString('en-US')}k`, 'BCE'];
  return [b.toLocaleString('en-US'), 'BCE'];
};
const stopOf = (y: number) => unitOf(y);
const stepStop = (y: number, dir: number) => {
  const s = stopOf(y);
  if (dir > 0) {
    if (s < T0) return RB[rootBin(s) + 1];
    if (s === T0) return 1030;
    return Math.min(T1, s + (s < 2000 ? 10 : 1));
  }
  if (s <= RB[0]) return RB[0];
  if (s <= T0) return RB[Math.max(0, rootBin(s) - 1)];
  if (s === 1030) return T0;
  return s - (s <= 2000 ? 10 : 1);
};
const nearestStop = (y: number) => {
  const s0 = stopOf(clamp(y, Y_LO, T1));
  const s1 = stepStop(s0, 1);
  return Math.abs(y - s0) <= Math.abs(y - s1) ? s0 : s1;
};

const rootRad = (f: number) => 0.1 + 0.9 * Math.pow(f, 1.4);
const rootAng = (li: number, f: number) => {
  const a0 = A0 + (li / LIN.length) * Math.PI * 2;
  const a1 = A0 + (Math.floor((li * 100) / LIN.length) / 100) * Math.PI * 2;
  return a0 + (a1 - a0) * f + (1 - f) * 0.55;
};
function coilRel(s: number, lane: number, lift: number, out: Float32Array, k: number) {
  if (s < R) {
    const f = clamp(s / R, 0, 1);
    const li = LANE_LIN[Math.round(clamp(lane, 0, NL - 1))] ?? 0;
    const wob = ((lane - (NL - 1) / 2) * 0.018 + lift * 0.35) * (0.25 + 0.75 * f);
    const rr = rootRad(f) + lift * (0.2 + 0.8 * f);
    const a = rootAng(li, f) + wob;
    out[k] = ROOT_X - (1 - f) * ROOT_LEN;
    out[k + 1] = rr * Math.cos(a);
    out[k + 2] = rr * Math.sin(a);
    return;
  }
  const t = (s - R) / 100;
  const a = A0 + t * Math.PI * 2;
  const off = (lane - (NL - 1) / 2) * LANE_W;
  const r = 1 + lift;
  out[k] = (t - 10.26) * PITCH + off * 0.88;
  out[k + 1] = r * Math.cos(a);
  out[k + 2] = r * Math.sin(a);
}
const coilY = (y: number, lane: number, lift: number, out: Float32Array, k: number) =>
  coilRel(slx(y), lane, lift, out, k);

const hexA = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
};

function pushDashedSegment(
  batch: HelixGpuRenderer['lines'],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col: string,
  alpha: number,
  width: number,
  dashOn: number,
  dashOff: number,
  distRef: { v: number },
  clipTop = -1e9,
) {
  let ax = x0;
  let ay = y0;
  let bx = x1;
  let by = y1;
  const rawLen = Math.hypot(bx - ax, by - ay);
  if (rawLen < 0.01) return;
  if (ay < clipTop && by < clipTop) {
    distRef.v = (distRef.v + rawLen) % (dashOn + dashOff);
    return;
  }
  let skipStart = 0;
  let endLen = rawLen;
  if (ay < clipTop && by > ay) {
    const f = (clipTop - ay) / (by - ay);
    skipStart = rawLen * f;
  } else if (by < clipTop && ay > by) {
    const f = (ay - clipTop) / (ay - by);
    endLen = rawLen * f;
  }
  const ux = (bx - ax) / rawLen;
  const uy = (by - ay) / rawLen;
  const P = dashOn + dashOff;
  let d = skipStart;
  while (d < endLen - 0.01) {
    const phase = (distRef.v + d) % P;
    if (phase < dashOn) {
      const seg = Math.min(endLen - d, dashOn - phase);
      batch.push(
        ax + ux * d,
        ay + uy * d,
        ax + ux * (d + seg),
        ay + uy * (d + seg),
        col,
        alpha,
        width,
      );
      d += seg;
    } else {
      d += Math.min(endLen - d, P - phase);
    }
  }
  distRef.v = (distRef.v + rawLen) % P;
}

type HelixHooks = {
  arrivalTargets: () => any;
  arrivalReady: () => boolean;
  onReveal: () => void;
  afterArrival: () => void;
};

let activeHooks: HelixHooks | null = null;

export function arrivalTargets(): any {
  return activeHooks ? activeHooks.arrivalTargets() : { ok: false };
}

export function arrivalReady(): boolean {
  return activeHooks ? activeHooks.arrivalReady() : false;
}

export function onReveal(): void {
  activeHooks?.onReveal();
}

export function afterArrival(): void {
  activeHooks?.afterArrival();
}

export default function helix(el: HTMLElement, shell: Record<string, any> = {}) {
  const host = el;
  host.classList.add('hx-host');
  host.innerHTML =
    '<canvas class="hx-gpu" aria-hidden="true"></canvas>' +
    '<canvas class="hx-canvas" tabindex="0" aria-label="Histomap: 1026 to 2026 on a coil, one loop per century, with roots back to 3.3 million BCE, the year in hand beside its list. Scroll or drag to travel, arrow keys step a stop."></canvas>' +
    '<canvas class="hx-over" aria-hidden="true"></canvas>';

  const gpuCanvas = host.querySelector('.hx-gpu') as HTMLCanvasElement;
  const scene = host.querySelector('.hx-canvas') as HTMLCanvasElement;
  const over = host.querySelector('.hx-over') as HTMLCanvasElement;
  const ctx = scene.getContext('2d')!;
  const octx = over.getContext('2d')!;
  void shell;

  const gpu = new HelixGpuRenderer(gpuCanvas);
  let sceneKey = '';
  let alive = true;
  let raf = 0;

  function invalidate() {
    if (!alive || raf) return;
    raf = requestAnimationFrame(frame);
  }

  gpu.init(() => {
    sceneKey = '';
    invalidate();
  });

  let W = 0;
  let H = 0;
  let DPR = 1;
  let grd: HTMLCanvasElement | null = null;
  let grdKey = '';

  const T2 = 2076;
  const GHOST_FROM = 1970;
  const GHOST_A = 0.28;
  const FC_FROM = 2020;

  let cam = {
    year: T1,
    target: T1,
    v: 0,
    pull: 0,
    pullT: 0,
    azOff: 0,
    elOff: 0,
    breath: 0,
    drawer: 0,
    fling: null as {
      y0: number;
      y1: number;
      t0: number;
      dur: number;
      ease?: (t: number) => number;
    } | null,
  };
  let settleAt = 0;
  let moveAt = 0;
  let restAt = 0;
  let linesAt = 0;
  let wasRest = true;
  let roUnit: number | null = null;
  let roShown: number | null = null;
  let roSince = 0;
  let hov: { kind: string; [k: string]: any } | null = null;
  let stripDrag = false;
  let orbitDrag: {
    id: number;
    x0: number;
    y0: number;
    lx: number;
    ly: number;
    moved: boolean;
    az0: number;
    el0: number;
    yStart: number;
    hist: [number, number][];
    pinch: boolean;
  } | null = null;
  const touches = new Map<number, { x: number; y: number }>();
  let pinchD0 = 0;
  let pinchPull0 = 0;
  let wheelAcc = 0;
  let wheelT = 0;

  let cells: any[] = [];
  let decCells = new Map<number, any[]>();
  let decThreads = new Map<number, any[]>();
  let decPics = new Map<number, any[]>();
  let evCell = new Map<string, any>();
  let claimsByUnit = new Map<number, any[]>();
  let fcastAll: any[] = [];
  let fcastHead: any[] = [];
  let fcastTotal = 0;
  let fcastVoices = 0;
  let evByUnit = new Map<number, any[]>();
  let density = new Float32Array(101);
  let rootDensity = new Float32Array(40);
  let rootTicks: { f: number; y: number; lbl: string }[] = [];
  let claimArcs: any[] = [];
  let arcOfClaim = new Map<string, any>();
  let arcByFrom = new Map<number, any[]>();
  let geomKey = '';
  let lastT = performance.now();

  let picState = 0;
  const picById = new Map<string, { pc: any; atl: HTMLImageElement }>();
  const rootPics: any[] = [];
  let fcLeaps: {
    pr: any;
    kind: 'arc' | 'mark';
    y0: number;
    y1: number;
    lane: number;
    apex: number;
    col: string;
    pts?: Float32Array;
    n?: number;
  }[] = [];
  let fcHits: { kind: 'claim'; pr: any; x0: number; y0: number; x1: number; y1: number }[] = [];

  function ensurePictures() {
    if (picState) return;
    picState = 1;
    const A = window.__arr;
    const loadImg = (src: string, preBlob?: Promise<Blob> | null) =>
      new Promise<HTMLImageElement | null>((res) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.decoding = 'async';
        const fromUrl = () => {
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = src;
        };
        if (preBlob) {
          preBlob
            .then((b) => {
              const u2 = URL.createObjectURL(b);
              im.onload = () => {
                URL.revokeObjectURL(u2);
                res(im);
              };
              im.onerror = () => {
                URL.revokeObjectURL(u2);
                fromUrl();
              };
              im.src = u2;
            })
            .catch(fromUrl);
        } else {
          fromUrl();
        }
      });
    const p =
      A && A.pics
        ? A.pics.catch(() => null).then((j) => j || fetch(assetUrl('/data/pictures.json')).then((r) => (r.ok ? r.json() : null)))
        : fetch(assetUrl('/data/pictures.json')).then((r) => (r.ok ? r.json() : null));
    p.then((D: any) => {
      const list = D && Array.isArray(D.pictures) ? D.pictures : null;
      if (!list || !list.length) {
        picState = -1;
        return;
      }
      const nAtlas = list.reduce(
        (mx: number, x: any) => Math.max(mx, Number.isFinite(x.atlas) ? x.atlas + 1 : 0),
        0,
      );
      const pre = A && A.sheets ? A.sheets.catch(() => null) : Promise.resolve(null);
      return pre
        .then((blobs: Promise<Blob>[] | null) =>
          Promise.all(
            Array.from({ length: nAtlas }, (_, i) =>
              loadImg(assetUrl(`/arrival/thumb${i}.jpg`), blobs && blobs[i]),
            ),
          ),
        )
        .then((atl) => {
          picById.clear();
          for (const pc of list) {
            const img = atl[pc.atlas];
            if (img && img.naturalWidth > 0) {
              picById.set(pc.id, { pc, atl: img });
            }
          }
          picState = picById.size > 0 ? 2 : -1;
          geomKey = '';
          sceneKey = '';
          unitDomKey = '';
          invalidate();
        });
    }).catch(() => {
      picState = -1;
    });
  }

  const momentImg = new Map<string, HTMLImageElement | 0 | null>();
  function ensureMomentPics() {
    for (const e of db.events || []) {
      if (!(e.moment || e.type === 'moment') || !e.picture || !e.picture.src) continue;
      if (picById.has(e.id)) continue;
      const s = assetUrl(e.picture.src);
      if (momentImg.has(s)) continue;
      momentImg.set(s, null);
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        momentImg.set(s, im);
        geomKey = '';
        sceneKey = '';
        unitDomKey = '';
        invalidate();
      };
      im.onerror = () => momentImg.set(s, 0);
      im.src = s;
    }
  }

  const prColor = (pr: any): string =>
    pr && pr.isCheckStatus
      ? STATUS_NIGHT[pr.verdict] || STATUS_NIGHT.unresolvable || INK
      : VERDICT_NIGHT[pr?.verdict] || VERDICT_NIGHT.unresolvable || INK;

  const prWord = (pr: any): string =>
    pr && pr.isCheckStatus
      ? STATUS_WORD[pr.verdict] || pr.verdict || 'pending'
      : VERDICT_WORD[pr?.verdict] || pr?.verdict || 'pending';

  function buildGeom() {
    ensureMomentPics();
    const evs = db.events || [];
    const prs = db.predictions || [];
    const fcs = db.forecasts || [];
    const hlSize = db.highlights ? db.highlights.size : 0;
    const domSet = state.domains && state.domains.size > 0 && state.domains.size < ORDER.length ? state.domains : null;
    const domKey = domSet ? [...domSet].sort().join(',') : 'all';
    const key = `${evs.length}:${prs.length}:${fcs.length}:${hlSize}:${picState}:${picById.size}:${momentImg.size}:${[...momentImg.values()].filter((v) => v && typeof v === 'object').length}:${domKey}:${isZh() ? 'zh' : 'en'}`;
    if (key === geomKey) return;
    geomKey = key;

    cells = [];
    decCells = new Map();
    decThreads = new Map();
    decPics = new Map();
    rootPics.length = 0;
    evCell = new Map();
    claimsByUnit = new Map();
    evByUnit = new Map();
    density.fill(0);
    rootDensity.fill(0);

    const bySlotLane = new Map<number, any[]>();
    for (const e of evs) {
      if (e.period) continue;
      if (e.year < Y_LO || e.year > T1) continue;
      if (domSet && !domSet.has(e.domain)) continue;
      const li = laneIx[e.domain];
      if (li === undefined) continue;
      const si = sl(e.year);
      const k = si * NL + li;
      let a = bySlotLane.get(k);
      if (!a) bySlotLane.set(k, (a = []));
      a.push(e);
      if (e.year >= T0) {
        density[clamp(Math.floor((e.year - T0) / 10), 0, 100)]++;
      } else {
        rootDensity[rootBin(e.year)]++;
      }
      const un = unitOf(e.year);
      let ulist = evByUnit.get(un);
      if (!ulist) evByUnit.set(un, (ulist = []));
      ulist.push(e);
    }

    rootTicks = (
      [
        [-2000000, isZh() ? '前200万年' : '2M BCE'],
        [-100000, isZh() ? '前10万年' : '100k'],
        [-10000, isZh() ? '前1万年' : '10k'],
        [-3000, isZh() ? '前3000年' : '3000'],
        [1, isZh() ? '公元元年' : '1 CE'],
      ] as [number, string][]
    ).map(([y, lbl]) => ({ f: rootF(y), y, lbl }));

    for (const [un, ulist] of evByUnit.entries()) {
      const hKey = un < 2000 ? `d${un}` : `y${un}`;
      const hlList = db.highlights ? db.highlights.get(hKey) : null;
      const hlRank = hlList
        ? new Map<string, number>(hlList.map((id: string, idx: number) => [id, idx]))
        : null;
      ulist.sort((a, b) => {
        if (hlRank) {
          const ra = hlRank.has(a.id) ? hlRank.get(a.id)! : 1e6;
          const rb = hlRank.has(b.id) ? hlRank.get(b.id)! : 1e6;
          if (ra !== rb) return ra - rb;
        }
        return (
          (b.moment || b.type === 'moment' ? 1 : 0) -
            (a.moment || a.type === 'moment' ? 1 : 0) ||
          (b.significance || 0) - (a.significance || 0) ||
          (picById.has(b.id) ? 1 : 0) - (picById.has(a.id) ? 1 : 0) ||
          (b.links || 0) - (a.links || 0) ||
          b.year - a.year
        );
      });
    }

    for (const [k, list] of bySlotLane) {
      const si = Math.floor(k / NL);
      const lane = k - si * NL;
      const root = si < R;
      list.sort(
        (a, b) =>
          (b.significance || 0) - (a.significance || 0) ||
          String(a.id).localeCompare(String(b.id)),
      );
      const n = list.length;
      const nAng = Math.min(root ? 4 : 8, n);
      const du = (n === 1 ? 0.92 : 1 / nAng) * (root ? 1.5 : 1);
      const hw = (root ? 0.34 : 0.46) * (n === 1 ? 1 : 0.92);
      const dec = Math.floor(si / 10) * 10;
      let bucket = decCells.get(dec);
      if (!bucket) decCells.set(dec, (bucket = []));

      for (let i = 0; i < n; i++) {
        const ai = i % nAng;
        const layer = (i / nAng) | 0;
        const u0 = root ? slf(list[i].year) - du * 0.5 : si + ai / nAng;
        const u1 = u0 + du;
        const lift = 0.008 + layer * LAYER;
        const p = new Float32Array(12);
        coilRel(u0, lane - hw, lift, p, 0);
        coilRel(u1, lane - hw, lift, p, 3);
        coilRel(u1, lane + hw, lift, p, 6);
        coilRel(u0, lane + hw, lift, p, 9);
        const c = new Float32Array([
          (p[0] + p[3] + p[6] + p[9]) * 0.25,
          (p[1] + p[4] + p[7] + p[10]) * 0.25,
          (p[2] + p[5] + p[8] + p[11]) * 0.25,
        ]);
        const cell = {
          e: list[i],
          y: list[i].year,
          s: si,
          lane,
          layer,
          p,
          c,
          colKey: (si * 3 + TONE[lane]) * 3,
          w: wOf(list[i]),
          moment: !!list[i].moment,
        };
        cells.push(cell);
        bucket.push(cell);
        evCell.set(list[i].id, cell);
      }
    }

    const STEP = 5;
    for (let s0 = R; s0 < SPAN; s0 += STEP) {
      const s1 = Math.min(SPAN, s0 + STEP);
      const century = Math.floor(s0 / 100) * 100;
      let a = Math.max(s0, R + 26);
      let b = s1;
      if (s0 < century + GAP_Y && century > R) a = Math.max(a, century + GAP_Y);
      if (s1 > century + 100 - GAP_Y && century + 100 < SPAN) {
        b = Math.min(b, century + 100 - GAP_Y);
      }
      if (b <= a + 0.2) continue;
      const n = Math.max(2, Math.ceil((b - a) * 1.5));
      const pts = new Float32Array((n + 1) * 3);
      for (let i = 0; i <= n; i++) coilRel(a + ((b - a) * i) / n, 0, -0.02, pts, i * 3);
      const mid = Math.round((a + b) * 0.5);
      const col = [0, 1, 2].map((st) => COLS[mid * 9 + st]);
      const dec = Math.floor(s0 / 10) * 10;
      let tb = decThreads.get(dec);
      if (!tb) decThreads.set(dec, (tb = []));
      tb.push({ y: yearOfSlot(mid), pts, n, col });
    }

    if (picState === 2) {
      const rootCandByLin = Array.from({ length: LIN.length }, () => [] as any[]);
      for (const e of evs) {
        if (e.period || e.year < Y_LO || e.year > T1) continue;
        const hit = picById.get(e.id);
        if (!hit || !hit.atl || !hit.atl.naturalWidth) continue;
        const cell = evCell.get(e.id);
        if (!cell) continue;
        if (e.year < T0) {
          const lin = LANE_LIN[cell.lane] ?? 0;
          const lift = 0.22 + (hit.pc.atlas % 3) * 0.05;
          const p = new Float32Array(3);
          coilRel(slf(e.year), cell.lane, lift, p, 0);
          rootCandByLin[lin].push({
            e,
            s: slf(e.year),
            y: e.year,
            pc: hit.pc,
            atl: hit.atl,
            p,
            cell,
            cellP: cell.c,
          });
          continue;
        }
        const h = (hit.pc.atlas * 7 + Math.round(hit.pc.u * 97)) % 5;
        const lift = 0.2 + h * 0.028;
        const p = new Float32Array(3);
        coilRel(slf(e.year) + 0.5, cell.lane, lift, p, 0);
        const dec = Math.floor(sl(e.year) / 10) * 10;
        let pb = decPics.get(dec);
        if (!pb) decPics.set(dec, (pb = []));
        pb.push({ e, s: sl(e.year), y: e.year, pc: hit.pc, atl: hit.atl, p, cell });
      }
      for (const pb of decPics.values()) {
        pb.sort((a, b) => (b.e.significance || 0) - (a.e.significance || 0));
      }
      for (const bucket of rootCandByLin) {
        bucket.sort(
          (a, b) =>
            (b.e.significance || 0) - (a.e.significance || 0) ||
            (b.e.links || 0) - (a.e.links || 0) ||
            a.y - b.y,
        );
        for (const it of bucket.slice(0, 10)) rootPics.push(it);
      }
      rootPics.sort((a, b) => (b.e.significance || 0) - (a.e.significance || 0));
    }

    for (const e of evs) {
      if (!(e.moment || e.type === 'moment') || !e.picture || !e.picture.src || picById.has(e.id)) {
        continue;
      }
      const src = assetUrl(e.picture.src);
      const im = momentImg.get(src);
      if (!im || typeof im !== 'object' || !im.naturalWidth) continue;
      const cell = evCell.get(e.id);
      if (!cell) continue;
      const pc = { u: 0, v: 0, uw: 1, vh: 1, a: im.naturalWidth / im.naturalHeight };
      const p = new Float32Array(3);
      coilRel(slf(e.year) + 0.5, cell.lane, 0.28, p, 0);
      const dec = Math.floor(sl(e.year) / 10) * 10;
      let pb = decPics.get(dec);
      if (!pb) decPics.set(dec, (pb = []));
      pb.unshift({
        e,
        s: sl(e.year),
        y: e.year,
        pc,
        atl: im,
        p,
        cell,
        moment: true,
      });
    }

    claimArcs = [];
    arcOfClaim = new Map();
    arcByFrom = new Map();
    const o1 = new Float32Array(3);
    const o2 = new Float32Array(3);
    for (const rawPr of prs) {
      const yFrom = rawPr.year_made;
      if (yFrom == null) continue;
      const verdict = rawPr.verdict || rawPr.outcome || 'unresolvable';
      const target_year = rawPr.target_year ?? rawPr.predicted_for ?? null;
      const by = rawPr.by || (rawPr.who ? String(rawPr.who).split(',')[0].trim() : '');
      const claim = rawPr.claim || rawPr.paraphrase || rawPr.quote || '';
      const pr = {
        ...rawPr,
        verdict,
        target_year,
        by,
        claim,
      };
      const yTo = target_year ?? yFrom + 20;
      const u1 = unitOf(clamp(yFrom, Y_LO, T1));
      let l1 = claimsByUnit.get(u1);
      if (!l1) claimsByUnit.set(u1, (l1 = []));
      l1.push(pr);
      if (target_year != null && target_year <= T1) {
        const u2 = unitOf(clamp(target_year, Y_LO, T1));
        if (u2 !== u1) {
          let l2 = claimsByUnit.get(u2);
          if (!l2) claimsByUnit.set(u2, (l2 = []));
          l2.push(pr);
        }
      }
      if (yFrom < Y_LO || yFrom > T1 || !target_year || target_year === yFrom) continue;
      const lane = laneIx[pr.domain] ?? 6;
      const span = Math.abs(yTo - yFrom);
      const apex = -(0.16 + 0.3 * clamp(span / 80, 0, 1));
      const N = clamp(Math.round(span * 0.7), 14, 56);
      const pts = new Float32Array((N + 1) * 3);
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        coilY(
          lerp(yFrom, Math.min(T2, yTo), t),
          lane * (1 - 4 * t * (1 - t) * 0.7),
          0.02 * (1 - 4 * t * (1 - t)) + apex * 4 * t * (1 - t),
          pts,
          i * 3,
        );
      }
      coilY(yFrom, lane, 0.02, o1, 0);
      coilY(Math.min(T2, yTo), lane, 0.02, o2, 0);
      const col = prColor(pr);
      const arc = {
        pr,
        yFrom,
        yTo,
        pts,
        n: N,
        from: new Float32Array(o1),
        to: new Float32Array(o2),
        col,
        ghost: yTo > T1,
      };
      claimArcs.push(arc);
      arcOfClaim.set(pr.id, arc);
      const uf = unitOf(yFrom);
      let af = arcByFrom.get(uf);
      if (!af) arcByFrom.set(uf, (af = []));
      af.push(arc);
    }

    const fc = forecastCount();
    const fcNorm = fc.all.slice().sort(forecastOrder).map((f: any) => {
      const hasChk = !!(f.chk && f.chk.s);
      return {
        ...f,
        verdict: hasChk ? f.chk.s : f.v || 'pending',
        isCheckStatus: hasChk,
        target_year: f.t,
        year_made: f.y0,
        by: f.who ? String(f.who).split(',')[0].trim() : '',
        claim: f.text || '',
        domain: f.domain || 'ai',
      };
    });
    fcastAll = fcNorm;
    fcastTotal = fc.n;
    fcastVoices = fc.voices;
    fcastHead = pickForecasts(fcNorm, 6);

    for (const fpr of fcNorm) {
      if (fpr.target_year >= 2024 && fpr.target_year <= T1) {
        const uDue = unitOf(fpr.target_year);
        let lDue = claimsByUnit.get(uDue);
        if (!lDue) claimsByUnit.set(uDue, (lDue = []));
        lDue.push(fpr);
      }
    }

    fcLeaps = [];
    const datedFc = fcNorm.filter((f: any) => f.target_year && f.target_year > f.year_made && f.target_year <= T2);
    const arcFcSet = new Set(pickForecasts(datedFc.filter((f: any) => f.target_year <= 2040), 48));
    const perYearFc = new Map<number, number>();
    const aiLane = laneIx.ai ?? 6;
    for (const fpr of datedFc) {
      const k = perYearFc.get(fpr.target_year) || 0;
      perYearFc.set(fpr.target_year, k + 1);
      const ln = aiLane + ((k % 7) - 3) * 0.8;
      const at = fpr.target_year + 0.08 + (Math.floor(k / 7) % 6) * 0.14;
      const col = prColor(fpr);
      if (arcFcSet.has(fpr)) {
        const y0 = fpr.year_made + 0.5;
        const y1 = at;
        const apex = -Math.min(0.5, 0.1 + (fpr.target_year - fpr.year_made) / 70);
        const N = 20;
        const pts = new Float32Array((N + 1) * 3);
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          coilY(
            lerp(y0, Math.min(T2, y1), t),
            ln * (1 - 4 * t * (1 - t) * 0.5),
            0.05 * (1 - 4 * t * (1 - t)) + apex * 4 * t * (1 - t),
            pts,
            i * 3,
          );
        }
        coilY(y0, ln, 0.05, o1, 0);
        coilY(Math.min(T2, y1), ln, 0.05, o2, 0);
        arcOfClaim.set(fpr.id, {
          pr: fpr,
          yFrom: y0,
          yTo: y1,
          pts,
          n: N,
          from: new Float32Array(o1),
          to: new Float32Array(o2),
          col,
          ghost: true,
        });
        fcLeaps.push({ pr: fpr, kind: 'arc', y0, y1, lane: ln, apex, col, pts, n: N });
      } else {
        fcLeaps.push({ pr: fpr, kind: 'mark', y0: fpr.year_made, y1: at, lane: ln, apex: 0, col });
      }
    }

    const vRank = (p: any) =>
      p.verdict === 'wrong' || p.verdict === 'contradicted'
        ? -3
        : p.verdict === 'came_true' || p.verdict === 'came_true_late' || p.verdict === 'on_track'
          ? -2
          : p.verdict === 'partly' || p.verdict === 'behind'
            ? -1
            : 0;
    for (const l of claimsByUnit.values()) {
      l.sort((a, b) => vRank(a) - vRank(b) || (b.year_made || 0) - (a.year_made || 0));
    }
  }

  let BAND = { x0: 0, x1: 0, y0: 0, y1: 0, w: 0, h: 0, stripY: 0, stripH: 0 };
  const STRIP_W = 44;
  const STRIP_PAD = 18;
  const STRIP_BOT = 38;
  const PLATE = 'rgba(5,12,14,0.92)';
  const PLATE_S = 'rgba(5,12,14,0.74)';
  const READ = { pad: 10, date: 19, name: 24, line: 20 };
  const TAG_H = 18;
  const skyTop = () => 6;
  const onStage = (sx: number, sy: number) =>
    sx >= -24 && sx <= W + 24 && sy >= -24 && sy <= BAND.stripY + 6;
  let readR: { x: number; y: number; w: number; h: number } | null = null;
  let decPl: [number, number, number, number][] = [];
  let rootEnd: { sx: number; sy: number; near: number } | null = null;

  let lastLayoutSig = '';
  const syncLayoutVars = (P: StagePreset, b: typeof BAND) => {
    const split = !P.vert && W >= 900;
    const eraRightEdge = split ? Math.max(266, Math.round(b.x0 - 8)) : 0;
    const drawerW = split ? Math.round(clamp(W * 0.265, 304, 372)) : 0;
    const eraBottom = split ? Math.round(b.stripH + 8) : 0;
    const sig = `${split ? '1' : '0'}:${eraRightEdge}:${drawerW}:${eraBottom}`;
    if (sig === lastLayoutSig) return;
    lastLayoutSig = sig;
    const root = document.documentElement;
    root.dataset.hxLayout = split ? 'split' : 'stack';
    if (split) {
      root.style.setProperty('--hx-era-right-edge', `${eraRightEdge}px`);
      root.style.setProperty('--hx-drawer-w', `${drawerW}px`);
      root.style.setProperty('--hx-era-bottom', `${eraBottom}px`);
    }
  };

  const bandOf = (P: StagePreset) => {
    const sh = P.vert ? STRIP_BOT : 42;
    const sy = H - sh;
    if (P.vert) {
      return { x0: 0, x1: W, y0: 0, y1: sy, w: W, h: sy, stripY: sy, stripH: sh };
    }
    const cw = Math.min(P.colW, Math.max(256, Math.round(W * 0.24)));
    const x0 = 10 + cw + 8;
    return { x0, x1: W, y0: 0, y1: sy, w: Math.max(240, W - x0), h: sy, stripY: sy, stripH: sh };
  };

  const stageLeft = () => {
    if (BAND.x0 <= 0) return 0;
    const drW = clamp(W * 0.265, 304, 372);
    const openX0 = BAND.x0 - 8 + 6 + drW + 8;
    return Math.round(lerp(BAND.x0, openX0, cam.drawer * (1 - cam.pull)));
  };

  function view() {
    const P = H > W || W < 720 ? VERT : DESK;
    BAND = bandOf(P);
    syncLayoutVars(P, BAND);
    const pull = cam.pull;
    const Y = Math.max(T0, cam.year);
    const el = ((P.el + cam.elOff + pull * 10) * Math.PI) / 180;
    const az = ((P.az + cam.azOff + pull * 18) * Math.PI) / 180;
    const dist = P.dist * (1 + pull * 3.55) * (P.vert ? 1 + cam.breath * BREATH : 1);
    const tY = (slf(Y) - R) / 100;
    const aY = A0 + tY * Math.PI * 2;
    const xY = (tY - 10.26) * PITCH;
    const tx = xY - pull * (xY + 5 * PITCH);
    const cx = tx + dist * Math.cos(el) * Math.sin(az);
    const cy = dist * Math.sin(el);
    const cz = dist * Math.cos(el) * Math.cos(az);
    let fx = tx - cx;
    let fy = -cy;
    let fz = -cz;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl;
    fy /= fl;
    fz /= fl;
    let rx = fz;
    let ry = 0;
    let rz = -fx;
    const rl = Math.hypot(rx, rz);
    rx /= rl;
    rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    const split = !P.vert && W >= 900;
    const drT = split ? cam.drawer * (1 - pull) : 0;
    const drawerW = split ? clamp(W * 0.265, 304, 372) : 0;
    const openStageX0 = split ? BAND.x0 - 8 + 6 + drawerW + 8 : BAND.x0;
    const openRightW = split ? Math.max(260, W - openStageX0) : BAND.w;
    const side = P.vert
      ? Math.min(BAND.w * 0.92, BAND.h * 0.95)
      : Math.min(BAND.w, BAND.h);
    const f = side * P.fov * lerp(1, 0.91, drT);
    const closedOx = BAND.x0 + BAND.w * (1 - P.ox);
    const openOx = openStageX0 + openRightW * 0.575;
    const baseOx = split ? lerp(closedOx, openOx, cam.drawer) : closedOx;
    const ox = P.vert ? BAND.w * P.ox : lerp(baseOx, W * 0.5, pull);
    const oy = BAND.y0 + BAND.h * (P.vert ? lerp(P.oy, 0.58, pull) : P.oy);
    const rot = -aY * (1 - pull);
    return {
      P,
      cx,
      cy,
      cz,
      fx,
      fy,
      fz,
      rx,
      ry,
      rz,
      ux,
      uy,
      uz,
      f,
      ox,
      oy,
      dist,
      pull,
      ca: Math.cos(rot),
      sa: Math.sin(rot),
    };
  }

  type ViewState = ReturnType<typeof view>;

  const prOut = { sx: 0, sy: 0, d: 0, s: 0 };
  function projR(V: ViewState, x: number, y0: number, z0: number) {
    let y = y0 * V.ca - z0 * V.sa;
    let z = y0 * V.sa + z0 * V.ca;
    if (V.P.vert) {
      const t = x;
      x = -y;
      y = -t;
    }
    const dx = x - V.cx;
    const dy = y - V.cy;
    const dz = z - V.cz;
    const d = dx * V.fx + dy * V.fy + dz * V.fz;
    if (d <= 0.12) {
      prOut.d = 0;
      return prOut;
    }
    const s = V.f / d;
    const hSign = V.P.vert ? 1 : -1;
    prOut.sx = V.ox + hSign * (dx * V.rx + dy * V.ry + dz * V.rz) * s;
    prOut.sy = V.oy - (dx * V.ux + dy * V.uy + dz * V.uz) * s;
    prOut.d = d;
    prOut.s = s;
    return prOut;
  }

  const nearOf = (V: ViewState, d: number) =>
    clamp(1 - (d - (V.dist - 1.05)) / 2.2, 0, 1);

  function ground() {
    const k = `${W}x${H}x${DPR}`;
    if (grd && grdKey === k) return grd;
    grdKey = k;
    grd = document.createElement('canvas');
    grd.width = Math.max(1, Math.round(W * DPR));
    grd.height = Math.max(1, Math.round(H * DPR));
    const g = grd.getContext('2d')!;
    g.scale(DPR, DPR);
    const lg = g.createLinearGradient(W, 0, W * 0.7, H);
    lg.addColorStop(0, GROUND[0]);
    lg.addColorStop(0.55, GROUND[1]);
    lg.addColorStop(1, GROUND[2]);
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W * 0.68, H * 0.5, 0, W * 0.68, H * 0.5, Math.max(W, H) * 0.62);
    rg.addColorStop(0, 'rgba(28, 74, 72, 0.28)');
    rg.addColorStop(0.55, 'rgba(16, 44, 46, 0.12)');
    rg.addColorStop(1, 'rgba(5, 11, 12, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    const tg = t.getContext('2d')!;
    const im = tg.createImageData(128, 128);
    let s = 1337;
    for (let i = 0; i < im.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = (s >> 16) & 255;
      const up = v > 128;
      im.data[i] = up ? 236 : 0;
      im.data[i + 1] = up ? 244 : 0;
      im.data[i + 2] = up ? 240 : 0;
      im.data[i + 3] = Math.round((Math.abs(v - 128) / 128) * 9);
    }
    tg.putImageData(im, 0, 0);
    g.fillStyle = g.createPattern(t, 'repeat')!;
    g.fillRect(0, 0, W, H);
    return grd;
  }

  let visCells: {
    cell: any;
    cx: number;
    cy: number;
    r: number;
    d: number;
    q: Float32Array;
  }[] = [];
  let picHits: {
    it: any;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    cx: number;
    cy: number;
    w: number;
    h: number;
  }[] = [];
  let fcHead: { x: number; y: number; w: number; h: number } | null = null;
  let openUnit: number | null = null;
  let openScroll = 0;
  let openFilter: string | null = null;
  let openMaxScroll = 0;
  let openRect: { x: number; y: number; w: number; h: number } | null = null;
  let openHits: any[] = [];
  let openFcast = false;
  let shOpen = false;
  let shA = 0;
  let shDrag: { id: number; y0: number; ly: number; sc0: number; pull: number } | null =
    null;
  let feedHits: any[] = [];
  let satHits: any[] = [];
  let ageRects: [number, number, number, number][] = [];
  let captionRect: [number, number, number, number] | null = null;

  const ahead = (y: number) =>
    cam.pull > 0.5 ? 1 : clamp(1 - (y - cam.year) / 6, 0, 1);

  const getRootAges = (): [number, string][] =>
    isZh()
      ? [
          [-2000000, '石器时代'],
          [-10000, '农耕起源'],
          [-3000, '青铜时代'],
          [-500, '铁器时代'],
        ]
      : [
          [-2000000, 'Stone'],
          [-10000, 'Farming'],
          [-3000, 'Bronze'],
          [-500, 'Iron'],
        ];

  function drawRoots(x: CanvasRenderingContext2D, V: ViewState, headY: number) {
    const o = new Float32Array(3);
    const N = 96;
    for (let li = 0; li < LIN.length; li++) {
      let prev = false;
      let px = 0;
      let py = 0;
      for (let i = 0; i <= N; i++) {
        const f = i / N;
        const rr = rootRad(f);
        const a = rootAng(li, f) + (1 - f) * 0.55;
        const wx = ROOT_X - (1 - f) * ROOT_LEN;
        const wy = rr * Math.cos(a);
        const wz = rr * Math.sin(a);
        const p = projR(V, wx, wy, wz);
        if (!p.d || !onStage(p.sx, p.sy)) {
          prev = false;
          continue;
        }
        if (prev) {
          const near = nearOf(V, p.d);
          const alpha = clamp(0.18 + 0.55 * f, 0, 1) * (0.35 + 0.65 * near);
          gpu.lines.push(px, py, p.sx, p.sy, rootCol(f), alpha, 1.6);
        }
        px = p.sx;
        py = p.sy;
        prev = true;
      }
    }

    const rc = mix(rootCol(0.55), INK, 0.35);
    const fs = MIN_TEXT;
    x.font = `400 ${fs}px ${FONT_TEXT}`;
    x.textBaseline = 'middle';
    const rFade = V.P.vert
      ? clamp((1080 - cam.year) / 50, 0, 1) * (1 - shA)
      : 1;
    let lastCrownY = -1e9;
    let lastAgeBox: [number, number, number, number] | null = null;
    const clipTop = V.P.vert ? headY + 6 : -1e9;

    for (const [ry, name] of getRootAges()) {
      const f = rootF(ry);
      const rr = rootRad(f);
      const wx = ROOT_X - (1 - f) * ROOT_LEN;
      let prev = false;
      let px = 0;
      let py = 0;
      let crownX = 0;
      let crownY = 1e9;
      let rightX = -1e9;
      let rightY = 0;
      let rightD = 0;
      let crownD = 0;
      const distRef = { v: 0 };

      for (let k = 0; k <= 60; k++) {
        const a = (k / 60) * Math.PI * 2;
        const p = projR(V, wx, rr * Math.cos(a), rr * Math.sin(a));
        if (!p.d || !onStage(p.sx, p.sy)) {
          prev = false;
          continue;
        }
        if (prev) {
          pushDashedSegment(
            gpu.lines,
            px,
            py,
            p.sx,
            p.sy,
            rc,
            0.3,
            1.0,
            2,
            6,
            distRef,
            clipTop,
          );
        }
        if (p.sy < crownY) {
          crownY = p.sy;
          crownX = p.sx;
          crownD = p.d;
        }
        if (p.sx > rightX) {
          rightX = p.sx;
          rightY = p.sy;
          rightD = p.d;
        }
        px = p.sx;
        py = p.sy;
        prev = true;
      }

      if (V.P.vert) {
        if (!rightD || rFade <= 0.02) continue;
        const tw = x.measureText(name).width;
        const lx = rightX + 8;
        const ly = rightY;
        if (
          lx + tw > BAND.x1 - 4 ||
          ly - fs / 2 < Math.max(skyTop(), headY + 8) ||
          ly + fs / 2 > BAND.y1 - 8
        ) {
          continue;
        }
        const bx0 = lx - 4;
        const by0 = ly - fs / 2 - 2;
        const bw = tw + 8;
        const bh = fs + 4;
        if (
          (lastAgeBox &&
            bx0 < lastAgeBox[2] + 3 &&
            bx0 + bw > lastAgeBox[0] - 3 &&
            by0 < lastAgeBox[3] + 3 &&
            by0 + bh > lastAgeBox[1] - 3) ||
          (readR &&
            bx0 < readR.x + readR.w + 4 &&
            bx0 + bw > readR.x - 4 &&
            by0 < readR.y + readR.h + 4 &&
            by0 + bh > readR.y - 4)
        ) {
          continue;
        }
        plate(x, bx0, by0, bw, bh, 0.72 * rFade);
        x.textAlign = 'left';
        x.fillStyle = INK;
        x.globalAlpha = 0.88 * rFade;
        x.fillText(name, lx, ly);
        lastAgeBox = [bx0, by0, bx0 + bw, by0 + bh];
        ageRects.push(lastAgeBox);
        continue;
      }

      if (crownD && Math.abs(crownY - lastCrownY) > 18 && crownY > 30) {
        const tw = x.measureText(name).width;
        const cy = crownY - 11;
        x.textAlign = 'center';
        x.globalAlpha = 0.72;
        x.fillStyle = NIGHT;
        x.fillRect(crownX - tw / 2 - 5, cy - 9, tw + 10, 18);
        x.globalAlpha = 0.78;
        x.fillStyle = rc;
        x.fillText(name, crownX, cy);
        lastCrownY = crownY;
        ageRects.push([crownX - tw / 2 - 5, cy - 9, crownX + tw / 2 + 5, cy + 9]);
      }
    }

    x.textAlign = 'left';
    x.globalAlpha = 1;
    const pe = projR(V, ROOT_X - ROOT_LEN, 0, 0);
    rootEnd =
      pe.d && onStage(pe.sx, pe.sy)
        ? { sx: pe.sx, sy: pe.sy, near: nearOf(V, pe.d) }
        : null;
    void o;
  }

  function drawRootNames(x: CanvasRenderingContext2D, V: ViewState) {
    if (V.P.vert) return;
    const fade = clamp((1090 - cam.year) / 45, 0, 1) * (1 - cam.pull);
    if (fade <= 0.02) return;
    const f = 0.88;
    const rr = rootRad(f);
    const wx = ROOT_X - (1 - f) * ROOT_LEN;
    const placed: {
      name: string;
      ax: number;
      ay: number;
      tx: number;
      ty: number;
      side: number;
    }[] = [];
    const col = mix(rootCol(0.75), INK, 0.5);
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    x.textBaseline = 'middle';
    const sL = stageLeft();
    const c = projR(V, wx, 0, 0);
    const cx0 = c.d ? c.sx : sL + (BAND.x1 - sL) * 0.6;

    for (let li = 0; li < LIN.length; li++) {
      const a = rootAng(li, f) + (1 - f) * 0.55;
      const p = projR(V, wx, rr * Math.cos(a), rr * Math.sin(a));
      if (!p.d || p.sx < sL + 20 || p.sx > BAND.x1 - 20 || p.sy < 24 || p.sy > BAND.y1 - 20) {
        continue;
      }
      const side = p.sx >= cx0 ? 1 : -1;
      placed.push({
        name: linName(LIN[li][0]),
        ax: p.sx,
        ay: p.sy,
        tx: p.sx + side * 14,
        ty: p.sy,
        side,
      });
    }

    for (const s of [-1, 1]) {
      const g = placed.filter((q) => q.side === s).sort((a, b) => a.ty - b.ty);
      for (let i = 1; i < g.length; i++) {
        if (g[i].ty - g[i - 1].ty < 18) g[i].ty = g[i - 1].ty + 18;
      }
    }

    for (const q of placed) {
      const tw = x.measureText(q.name).width;
      const x0 = q.side > 0 ? q.tx : q.tx - tw;
      if (x0 < sL + 8 || x0 + tw > BAND.x1 - 8) continue;
      if (
        ageRects.some(
          (r) =>
            x0 - 4 < r[2] &&
            x0 + tw + 4 > r[0] &&
            q.ty - 9 < r[3] &&
            q.ty + 9 > r[1],
        )
      ) {
        continue;
      }
      gpu.topLines.push(q.ax, q.ay, q.tx - q.side * 3, q.ty, col, 0.35 * fade, 1.0);
      x.globalAlpha = 0.78 * fade;
      x.fillStyle = NIGHT;
      x.fillRect(x0 - 4, q.ty - 9, tw + 8, 18);
      x.globalAlpha = 0.88 * fade;
      x.fillStyle = col;
      x.textAlign = q.side > 0 ? 'left' : 'right';
      x.fillText(q.name, q.tx, q.ty);
      ageRects.push([x0 - 4, q.ty - 9, x0 + tw + 4, q.ty + 9]);
    }
    x.textAlign = 'left';
    x.globalAlpha = 1;
  }

  function drawRootCaption(
    x: CanvasRenderingContext2D,
    V: ViewState,
    p: { sx: number; sy: number; near: number } | null,
  ) {
    if (!p) return null;
    if (V.P.vert) {
      const fade =
        clamp((1080 - cam.year) / 50, 0, 1) * (1 - cam.pull) * (1 - shA);
      if (fade <= 0.02) return null;
      const fs = MIN_TEXT;
      x.font = `400 ${fs}px ${FONT_TEXT}`;
      const t = isZh() ? '公元前330万年' : '3.3M BCE';
      const tw = x.measureText(t).width;
      const lx = clamp(p.sx - tw / 2, BAND.x0 + 10, BAND.x1 - 10 - tw);
      const ly = p.sy + 18;
      if (ly + fs / 2 > BAND.y1 - 6 || ly - fs / 2 < skyTop()) return null;
      const bx0 = lx - 4;
      const by0 = ly - fs / 2 - 2;
      const bw = tw + 8;
      const bh = fs + 4;
      if (
        readR &&
        bx0 < readR.x + readR.w + 4 &&
        bx0 + bw > readR.x - 4 &&
        by0 < readR.y + readR.h + 4 &&
        by0 + bh > readR.y - 4
      ) {
        return null;
      }
      plate(x, bx0, by0, bw, bh, 0.72 * fade);
      x.textAlign = 'left';
      x.textBaseline = 'middle';
      x.fillStyle = INK;
      x.globalAlpha = 0.88 * fade;
      x.fillText(t, lx, ly);
      x.globalAlpha = 1;
      const box: [number, number, number, number] = [bx0, by0, bx0 + bw, by0 + bh];
      ageRects.push(box);
      return box;
    }

    const fade = (0.4 + 0.55 * p.near) * (1 - cam.pull * 0.5);
    if (fade <= 0.05) return null;
    const l1 = isZh() ? '最早的石器遗存' : 'First stone tools';
    const l2 = isZh() ? '公元前330万年' : '3.3 million BCE';
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    const w = Math.max(x.measureText(l1).width, x.measureText(l2).width);
    const sL = stageLeft();
    const side = p.sx > BAND.x1 - 180 ? -1 : 1;
    const tx = p.sx + side * 14;
    const ty = clamp(p.sy, 28, BAND.y1 - 28);
    const x0 = side > 0 ? tx : tx - w;
    if (x0 < sL + 6 || x0 + w > BAND.x1 - 6) return null;
    const box: [number, number, number, number] = [
      x0 - 6,
      ty - 20,
      x0 + w + 6,
      ty + 20,
    ];
    if (
      ageRects.some(
        (r) => box[0] < r[2] && box[2] > r[0] && box[1] < r[3] && box[3] > r[1],
      )
    ) {
      return null;
    }
    x.globalAlpha = 0.76 * fade;
    x.fillStyle = NIGHT;
    x.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    x.textAlign = side > 0 ? 'left' : 'right';
    x.textBaseline = 'middle';
    x.globalAlpha = 0.9 * fade;
    x.fillStyle = mix(rootCol(0.35), INK, 0.55);
    x.fillText(l1, tx, ty - 9);
    x.globalAlpha = 0.72 * fade;
    x.fillStyle = SOFT;
    x.fillText(l2, tx, ty + 9);
    x.textAlign = 'left';
    x.globalAlpha = 1;
    ageRects.push(box);
    return box;
  }

  function rootFlowOn() {
    return (
      !POSTER &&
      !reduced() &&
      cam.year < 1100 &&
      cam.pull < 0.35 &&
      !stripDrag &&
      !(orbitDrag && orbitDrag.moved)
    );
  }

  function drawRootFlow(V: ViewState, now: number) {
    const fade = clamp((1100 - cam.year) / 60, 0, 1) * (1 - cam.pull / 0.35);
    if (fade <= 0.02) return;
    const PERIOD = 6500;
    const TAIL = 0.22;
    const SEG = 18;
    for (let li = 0; li < LIN.length; li++) {
      const head = (now / PERIOD + li / LIN.length) % 1;
      const f0 = Math.max(0, head - TAIL);
      if (head <= 0.01) continue;
      let prev = false;
      let px = 0;
      let py = 0;
      let hx = 0;
      let hy = 0;
      let hd = 0;
      for (let k = 0; k <= SEG; k++) {
        const f = f0 + ((head - f0) * k) / SEG;
        const rr = rootRad(f);
        const a = rootAng(li, f) + (1 - f) * 0.55;
        const p = projR(
          V,
          ROOT_X - (1 - f) * ROOT_LEN,
          rr * Math.cos(a),
          rr * Math.sin(a),
        );
        if (!p.d || !onStage(p.sx, p.sy)) {
          prev = false;
          continue;
        }
        if (prev) {
          const t = k / SEG;
          const col = mix(rootCol(f), INK, 0.35 + 0.35 * t);
          gpu.flowLines.push(px, py, p.sx, p.sy, col, fade * t * t * 0.65, 2.0);
        }
        px = p.sx;
        py = p.sy;
        prev = true;
        if (k === SEG) {
          hx = p.sx;
          hy = p.sy;
          hd = p.d;
        }
      }
      if (hd) {
        const c = mix(rootCol(head), INK, 0.6);
        gpu.flowGlows.push(hx, hy, 0, 6, c, fade * 0.85);
      }
    }
  }

  function paintScene(x: CanvasRenderingContext2D, V: ViewState) {
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (gpu.ready) {
      x.clearRect(0, 0, W, H);
    } else {
      x.drawImage(ground(), 0, 0, W, H);
    }
    gpu.beginScene();

    visCells = [];
    picHits = [];
    const pulled = V.pull > 0.5;
    const uInHand = !pulled ? unitOf(cam.year) : null;
    const late: any[] = [];
    const q = new Float32Array(8);
    const o1 = new Float32Array(3);
    const o2 = new Float32Array(3);
    const Y = Math.max(T0, cam.year);
    const scFront = slf(Y) - 90;

    let headY = -1e9;
    if (V.P.vert) {
      for (let k = 0; k < 24; k++) {
        coilRel(R + (k / 24) * 100, 0, 0.16, o1, 0);
        const p = projR(V, o1[0], o1[1], o1[2]);
        if (p.d) headY = Math.max(headY, p.sy);
      }
    }
    ageRects = [];
    captionRect = null;
    drawRoots(x, V, headY);
    captionRect = drawRootCaption(x, V, rootEnd);

    for (let dec = 0; dec <= R + 1020; dec += 10) {
      const th = decThreads.get(dec);
      if (th) {
        for (const c of th) {
          const ah = ahead(c.y);
          if (ah <= 0) continue;
          const pts = c.pts;
          const p0 = projR(V, pts[0], pts[1], pts[2]);
          if (!p0.d) continue;
          const near = nearOf(V, p0.d);
          const step = pulled ? 0 : near > 0.62 ? 0 : near > 0.25 ? 1 : 2;
          const own = !pulled && near > 0.66;
          if (own) {
            const strokes: [number, string, number, number][] = [
              [-1.1, FRINGE_BLUE, 0.45 * ah, 1.0],
              [1.1, FRINGE_RED, 0.45 * ah, 1.0],
              [0, CORE, 0.6 * ah, 0.9],
            ];
            for (const [dx, st, al, lw] of strokes) {
              let prev = false;
              let px = 0;
              let py = 0;
              for (let i = 0; i <= c.n; i++) {
                const p = projR(V, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
                if (!p.d || !onStage(p.sx, p.sy)) {
                  prev = false;
                  continue;
                }
                const sx = p.sx + dx;
                if (prev) gpu.frontLines.push(px, py, sx, p.sy, st, al, lw);
                px = sx;
                py = p.sy;
                prev = true;
              }
            }
          } else {
            const al = (near * 0.62 + 0.08) * ah;
            const col = c.col[step];
            let prev = false;
            let px = 0;
            let py = 0;
            for (let i = 0; i <= c.n; i++) {
              const p = projR(V, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
              if (!p.d || !onStage(p.sx, p.sy)) {
                prev = false;
                continue;
              }
              if (prev) gpu.lines.push(px, py, p.sx, p.sy, col, al, 1.3);
              px = p.sx;
              py = p.sy;
              prev = true;
            }
          }
        }
      }

      if (dec === R && rootPics.length) {
        const rp = separate(rootPics, V).filter(
          (pl) =>
            !captionRect ||
            pl.cx + pl.w / 2 + 4 < captionRect[0] ||
            pl.cx - pl.w / 2 - 4 > captionRect[2] ||
            pl.cy + pl.h / 2 + 4 < captionRect[1] ||
            pl.cy - pl.h / 2 - 4 > captionRect[3],
        );
        for (const pl of rp) paintPic(pl, gpu.rootPics, V);
      }

      const inFront = !pulled && dec >= scFront;
      const targetHalos = inFront ? gpu.cellHalos : gpu.farCellHalos;
      const targetCells = inFront ? gpu.cells : gpu.farCells;
      const targetPics = inFront ? gpu.earlyPics : gpu.farPics;

      const cb = decCells.get(dec);
      if (cb) {
        const marks: {
          c: any;
          d: number;
          s: number;
          cx: number;
          cy: number;
          ah: number;
          w: number;
          q: Float32Array;
        }[] = [];
        for (const c of cb) {
          const ah = ahead(c.y);
          if (ah <= 0) continue;
          const cp = projR(V, c.c[0], c.c[1], c.c[2]);
          if (!cp.d || !onStage(cp.sx, cp.sy)) continue;
          const d = cp.d;
          const s = cp.s;
          const cx = cp.sx;
          const cy = cp.sy;
          const p = c.p;
          let ok = true;
          for (let k = 0; k < 4; k++) {
            const v = projR(V, p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
            if (!v.d) {
              ok = false;
              break;
            }
            q[k * 2] = v.sx;
            q[k * 2 + 1] = v.sy;
          }
          if (!ok) continue;
          marks.push({ c, d, s, cx, cy, ah, w: c.w, q: new Float32Array(q) });
        }
        marks.sort((a, b) => a.w - b.w);

        for (const m of marks) {
          const { c, d, s, cx, cy, ah } = m;
          const qm = m.q;
          const near = nearOf(V, d);
          const step = pulled ? 0 : near > 0.62 ? 0 : near > 0.25 ? 1 : 2;
          const inHand = uInHand !== null && unitOf(c.e.year) === uInHand;
          const dim =
            uInHand !== null && !inHand ? (near > 0.62 ? 0.58 : 0.85) : 1;
          let ux = qm[2] - qm[0];
          let uy = qm[3] - qm[1];
          let vx = qm[6] - qm[0];
          let vy = qm[7] - qm[1];
          const ws = W_SIZE[m.w];
          const lu = Math.hypot(ux, uy) * ws;
          const lv = Math.hypot(vx, vy) * ws;
          const floor = pulled ? FLOOR_PULLED : FLOOR_FAR;
          const col = c.moment
            ? mix(heatOf(c.e.year), INK, 0.28)
            : colW((c.colKey + step) * 5 + m.w);
          const alpha =
            (pulled
              ? 0.92
              : c.moment
                ? 1
                : near > 0.5
                  ? 0.96
                  : 0.52 + near * 0.44) *
            ah *
            dim;

          if (c.moment) {
            const rad = Math.max(floor, Math.min(lu, lv) * 0.5, 4);
            if (rad * 4 >= 2) {
              targetHalos.push(
                cx,
                cy,
                Math.max(0.5, rad * 0.4),
                rad * 4,
                heatOf(c.e.year),
                alpha * 0.35,
              );
            }
          }

          if (lu < floor || lv < floor) {
            targetCells.pushCell(
              cx,
              cy,
              qm[0],
              qm[1],
              qm[2],
              qm[3],
              qm[6],
              qm[7],
              ws,
              col,
              alpha,
              floor,
              0,
            );
            visCells.push({ cell: c, cx, cy, r: floor * 0.8, d, q: qm });
            continue;
          }

          const rimAlpha =
            inHand && Math.min(lu, lv) >= 9 ? 0.55 * ah : 0;
          targetCells.pushCell(
            cx,
            cy,
            qm[0],
            qm[1],
            qm[2],
            qm[3],
            qm[6],
            qm[7],
            ws,
            col,
            alpha,
            floor,
            rimAlpha,
          );
          visCells.push({
            cell: c,
            cx,
            cy,
            r: Math.max(4, Math.max(lu, lv) * 0.55),
            d,
            q: qm,
          });
          void s;
        }
      }

      const pb = decPics.get(dec);
      if (pb) {
        const earlyP: any[] = [];
        for (const it of pb) {
          if (ahead(it.y) <= 0) continue;
          if (uInHand !== null && unitOf(it.y) === uInHand) late.push(it);
          else earlyP.push(it);
        }
        if (earlyP.length) {
          for (const pl of separate(earlyP, V)) paintPic(pl, targetPics, V);
        }
      }
    }

    if (late.length) {
      const sep = separate(late, V);
      sep.sort((a, b) => wOf(a.it.e) - wOf(b.it.e));
      for (const pl of sep) paintPic(pl, gpu.latePics, V);
    }

    drawRootNames(x, V);

    decPl = [];
    if (V.P.vert && shA === 0) {
      const f = fieldData();
      const cards = Math.min(V.P.lines, f.evs.length);
      const cl = Math.min(V.P.claims, f.claims.length);
      const h =
        READ.pad * 2 +
        READ.date +
        READ.name +
        cards * READ.line +
        (cl ? 6 + cl * READ.line : 0);
      readR = {
        x: BAND.x0 + 8,
        y: BAND.y1 - 8 - h,
        w: BAND.w - 16,
        h,
      };
    } else {
      readR = null;
    }

    const underRead = (x0: number, y0: number, x1: number, y1: number) =>
      !!(
        readR &&
        x1 > readR.x - 4 &&
        x0 < readR.x + readR.w + 4 &&
        y1 > readR.y - 4 &&
        y0 < readR.y + readR.h + 4
      );

    const Yc = Math.floor(slf(Y) / 100) * 100;
    const centR: [number, number, number, number][] = [];
    x.textAlign = 'center';
    x.textBaseline = 'middle';

    if (V.P.vert) {
      if (shA === 0) {
        x.font = `400 ${V.P.cent}px ${FONT_DISPLAY}`;
        let best: { sx: number; sy: number; near: number; y: number } | null =
          null;
        for (let s = R + 100; s <= SPAN; s += 100) {
          const y = yearOfSlot(s);
          if (ahead(y) <= 0.5) continue;
          coilRel(s, 0, -0.34, o1, 0);
          const p = projR(V, o1[0], o1[1], o1[2]);
          if (!p.d || !onStage(p.sx, p.sy)) continue;
          const near = nearOf(V, p.d);
          if (!pulled && near < 0.35) continue;
          if (!best || y > best.y) best = { sx: p.sx, sy: p.sy, near, y };
        }
        if (best) {
          const t = String(best.y);
          const tw = x.measureText(t).width;
          const tx = clamp(best.sx, BAND.x0 + tw / 2 + 12, BAND.x1 - tw / 2 - 12);
          const ty = best.sy;
          if (
            !underRead(
              tx - tw / 2 - 6,
              ty - V.P.cent * 0.45,
              tx + tw / 2 + 6,
              ty + V.P.cent * 0.45,
            ) &&
            ty - V.P.cent * 0.45 >= skyTop()
          ) {
            plate(
              x,
              tx - tw / 2 - 6,
              ty - V.P.cent * 0.42,
              tw + 12,
              V.P.cent * 0.84,
              1,
            );
            x.fillStyle = INK;
            x.globalAlpha = 0.92;
            x.fillText(t, tx, ty);
            centR.push([
              tx - tw / 2 - 6,
              ty - V.P.cent * 0.42,
              tx + tw / 2 + 6,
              ty + V.P.cent * 0.42,
            ]);
          }
        }
      }
    } else {
      x.font = `400 ${V.P.cent}px ${FONT_DISPLAY}`;
      for (let s = R; s <= SPAN; s += 100) {
        if (!pulled && Math.abs(s - Yc) > 200) continue;
        coilRel(s, 0, -0.34, o1, 0);
        const p = projR(V, o1[0], o1[1], o1[2]);
        if (!p.d || !onStage(p.sx, p.sy)) continue;
        const near = nearOf(V, p.d);
        const ah = ahead(yearOfSlot(s));
        if (ah <= 0) continue;
        const isOwn = !pulled && s >= Yc && s <= Yc + 100;
        x.fillStyle = isOwn ? INK : SOFT;
        x.globalAlpha =
          (pulled ? 0.55 : isOwn ? 0.62 : 0.1 + near * 0.22) * ah;
        if (s > R) x.fillText(String(yearOfSlot(s)), p.sx, p.sy);
      }
    }

    if (!pulled && !(V.P.vert && shA > 0)) {
      x.font = `400 ${V.P.year}px ${FONT_TEXT}`;
      const fcR = V.P.vert && Y >= 1990 ? fcSeat(V, x) : null;
      const underFc = (x0: number, y0: number, x1: number, y1: number) =>
        !!(
          fcR &&
          x1 > fcR.box.x - 4 &&
          x0 < fcR.box.x + fcR.box.w + 4 &&
          y1 > fcR.box.y - 4 &&
          y0 < fcR.box.y + fcR.box.h + 4
        );

      for (let y = Math.max(R + 30, Yc + 10); y < Yc + 100 && y <= SPAN; y += 10) {
        coilRel(y, 0, -0.16, o1, 0);
        const p = projR(V, o1[0], o1[1], o1[2]);
        if (!p.d) continue;
        const px = p.sx;
        const py = p.sy;
        const near = nearOf(V, p.d);
        coilRel(y, 0, -0.06, o2, 0);
        const q2 = projR(V, o2[0], o2[1], o2[2]);
        if (!q2.d) continue;
        const ah = ahead(yearOfSlot(y));
        if (ah <= 0) continue;
        const tickAlpha = 0.85 * (0.5 + 0.5 * near) * ah;
        gpu.topLines.push(q2.sx, q2.sy, px, py, SOFT, tickAlpha, 1.0);

        const dx = px - q2.sx;
        const dy = py - q2.sy;
        const l = Math.hypot(dx, dy) || 1;
        x.fillStyle = INK;

        if (V.P.vert) {
          const t = fmtTick(yearOfSlot(y));
          const tw = x.measureText(t).width;
          let tx = px + (dx / l) * 16;
          let ty = py + (dy / l) * 12;
          const af = clamp((ah - 0.3) / 0.25, 0, 1);
          if (af <= 0) continue;
          const hitC = () =>
            centR.some(
              (c) =>
                tx - tw / 2 - 5 < c[2] &&
                tx + tw / 2 + 5 > c[0] &&
                ty - MIN_TEXT / 2 - 4 < c[3] &&
                ty + MIN_TEXT / 2 + 3 > c[1],
            );
          const hitD = () =>
            decPl.some(
              (c) =>
                tx - tw / 2 - 5 < c[2] - 4 &&
                tx + tw / 2 + 5 > c[0] + 4 &&
                ty - MIN_TEXT / 2 - 4 < c[3] - 4 &&
                ty + MIN_TEXT / 2 + 2 > c[1] + 4,
            );
          let step = 0;
          while ((hitC() || hitD()) && step < 3) {
            step++;
            tx += (dx / l) * 14;
            ty += (dy / l) * 14;
          }
          if (
            hitC() ||
            hitD() ||
            (step && (tx - tw / 2 < 8 || tx + tw / 2 > W - 8)) ||
            underRead(
              tx - tw / 2 - 5,
              ty - MIN_TEXT / 2 - 4,
              tx + tw / 2 + 5,
              ty + MIN_TEXT / 2 + 2,
            ) ||
            underFc(
              tx - tw / 2 - 5,
              ty - MIN_TEXT / 2 - 4,
              tx + tw / 2 + 5,
              ty + MIN_TEXT / 2 + 2,
            )
          ) {
            continue;
          }
          plate(
            x,
            tx - tw / 2 - 5,
            ty - MIN_TEXT / 2 - 4,
            tw + 10,
            MIN_TEXT + 6,
            af,
          );
          x.globalAlpha = 0.95 * af;
          x.fillText(t, tx, ty);
          decPl.push([
            tx - tw / 2 - 5,
            ty - MIN_TEXT / 2 - 4,
            tx + tw / 2 + 5,
            ty + MIN_TEXT / 2 + 2,
          ]);
          continue;
        }
        x.globalAlpha = tickAlpha;
        x.fillText(fmtTick(yearOfSlot(y)), px + (dx / l) * 16, py + (dy / l) * 12);
      }
      drawGhost(x, V, Y, o1, o2, underRead);
    }
    x.globalAlpha = 1;
  }

  const fcO = new Float32Array(3);
  function plate(
    x: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    w: number,
    h: number,
    a: number,
  ) {
    const ga = x.globalAlpha;
    const fs = x.fillStyle;
    x.globalAlpha = a;
    x.fillStyle = PLATE;
    x.beginPath();
    if (x.roundRect) x.roundRect(x0, y0, w, h, 4);
    else x.rect(x0, y0, w, h);
    x.fill();
    x.globalAlpha = ga;
    x.fillStyle = fs;
  }

  const FC_AT = 2037;
  let recN = 0;
  let recKey = '';
  const recCount = () => {
    const k = `${db.events.length}:${db.loaded.size}`;
    if (k !== recKey) {
      recKey = k;
      recN = census().events;
    }
    return recN
      ? isZh()
        ? `共收录 ${recN.toLocaleString('en-US')} 条技术史料`
        : `${recN.toLocaleString('en-US')} records`
      : '';
  };
  const fcT1 = () => (isZh() ? '远景展望至 2076' : 'Forecasts to 2076');
  const fcT2 = () => {
    const c = forecastCount();
    return c.n
      ? isZh()
        ? `${c.n.toLocaleString('en-US')} 条定年预测 · ${c.voices} 位学者`
        : `${c.n.toLocaleString('en-US')} dated, ${c.voices} voices`
      : '';
  };

  function fcSeat(V: ViewState, x: CanvasRenderingContext2D) {
    const size = MIN_TEXT + (V.P.vert ? 3 : 5);
    const f0 = x.font;
    x.font = `500 ${size}px ${FONT_TEXT}`;
    const w1 = x.measureText(fcT1()).width;
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    const w2 = x.measureText(fcT2()).width;
    x.font = f0;
    const half = Math.max(w1, w2) / 2;
    if (V.P.vert) {
      coilY(FC_AT, 0, -0.02, fcO, 0);
      const m = projR(V, fcO[0], fcO[1], fcO[2]);
      if (!m.d) return null;
      const mx = m.sx;
      const my = m.sy;
      let ty = my;
      for (const y of [2030, 2040]) {
        coilY(y, 0, 0.27, fcO, 0);
        const q = projR(V, fcO[0], fcO[1], fcO[2]);
        if (q.d) ty = Math.min(ty, q.sy - 14);
      }
      const h = (w2 ? TAG_H * 2 : TAG_H + 6) + 2;
      const w = half * 2 + 14;
      const bx = BAND.x1 - w;
      const by = clamp(
        ty - 8 - h,
        skyTop() + 2,
        BAND.y1 -
          h -
          (cam.year < FC_FROM
            ? READ.pad * 2 + READ.date + READ.name + READ.line * 3 + 8
            : 0),
      );
      if (!onStage(mx, my)) return null;
      return {
        sx: BAND.x1 - 7,
        sy: by + TAG_H / 2 + 1,
        size,
        w1,
        w2,
        half,
        mx,
        my,
        box: { x: bx, y: by, w, h },
      };
    }
    coilY(2036, 0, 0.5, fcO, 0);
    const p = projR(V, fcO[0], fcO[1], fcO[2]);
    if (!p.d) return null;
    const sy = p.sy;
    if (!onStage(p.sx, sy)) return null;
    const sx = clamp(p.sx, stageLeft() + half + 10, BAND.x1 - half - 10);
    return {
      sx,
      sy,
      size,
      w1,
      w2,
      half,
      mx: 0,
      my: 0,
      box: {
        x: sx - half - 8,
        y: sy - size - 4,
        w: half * 2 + 16,
        h: size + MIN_TEXT + 18,
      },
    };
  }

  function drawGhost(
    x: CanvasRenderingContext2D,
    V: ViewState,
    Y: number,
    o1: Float32Array,
    o2: Float32Array,
    underRead: (x0: number, y0: number, x1: number, y1: number) => boolean,
  ) {
    if (Y < GHOST_FROM) {
      fcHead = null;
      fcHits = [];
      return;
    }
    let prev = false;
    let px = 0;
    let py = 0;
    for (let y = T1, i = 0; y <= T2; y += 0.5, i++) {
      coilY(y, 0, -0.02, o1, 0);
      const p = projR(V, o1[0], o1[1], o1[2]);
      if (!p.d || !onStage(p.sx, p.sy)) {
        prev = false;
        continue;
      }
      if (prev && i % 3 !== 0) {
        const ga = GHOST_A + 0.4 * (1 - (y - T1) / (T2 - T1));
        gpu.topLines.push(px, py, p.sx, p.sy, CORE, ga, 1.8);
      }
      px = p.sx;
      py = p.sy;
      prev = true;
    }

    if (V.P.vert && shA > 0) {
      fcHead = null;
      return;
    }

    let fcBox: ReturnType<typeof fcSeat> = null;
    const fs = V.P.vert ? MIN_TEXT : MIN_TEXT + 4;
    x.font = `400 ${fs}px ${FONT_TEXT}`;
    x.fillStyle = INK;
    for (let y = 2030; y <= (V.P.vert ? 2060 : 2070); y += 10) {
      coilY(y, 0, 0.34, o1, 0);
      const p = projR(V, o1[0], o1[1], o1[2]);
      if (!p.d || !onStage(p.sx, p.sy)) continue;
      coilY(y, 0, 0.27, o2, 0);
      const q = projR(V, o2[0], o2[1], o2[2]);
      if (!q.d) continue;
      const near = nearOf(V, p.d);
      const ga = 0.8 * (0.5 + 0.5 * near);
      gpu.topLines.push(q.sx, q.sy, p.sx, p.sy, SOFT, ga, 1.0);
      const dx = p.sx - q.sx;
      const dy = p.sy - q.sy;
      const l = Math.hypot(dx, dy) || 1;

      if (V.P.vert) {
        let tx = clamp(p.sx, BAND.x0 + 24, BAND.x1 - 24);
        let ty = p.sy;
        const tw = x.measureText(String(y)).width;
        const hb = Y >= 1990 ? fcBox || (fcBox = fcSeat(V, x)) : null;
        const under = () =>
          !!(
            hb &&
            tx + tw / 2 > hb.box.x - 3 &&
            tx - tw / 2 < hb.box.x + hb.box.w + 3 &&
            ty + fs / 2 + 2 > hb.box.y - 2 &&
            ty - fs / 2 - 1 < hb.box.y + hb.box.h + 2
          );
        if (under()) {
          coilY(y, 0, 0.14, o1, 0);
          const r = projR(V, o1[0], o1[1], o1[2]);
          if (!r.d) continue;
          tx = clamp(r.sx, BAND.x0 + 24, BAND.x1 - 24);
          ty = r.sy;
          if (under()) continue;
        }
        if (underRead(tx - tw / 2, ty - fs / 2 - 1, tx + tw / 2, ty + fs / 2 + 2)) {
          continue;
        }
        plate(x, tx - tw / 2, ty - fs / 2 - 1, tw, fs + 3, 0.6);
        x.globalAlpha = 0.95;
        x.fillText(String(y), tx, ty + 1);
        decPl.push([tx - tw / 2, ty - fs / 2 - 1, tx + tw / 2, ty + fs / 2 + 2]);
        continue;
      }
      x.globalAlpha = ga;
      x.fillText(String(y), p.sx + (dx / l) * 18, p.sy + (dy / l) * 13);
    }

    fcHead = null;
    if (Y >= 1990) {
      const h = fcSeat(V, x);
      if (h) {
        const { sx, sy, size, w1 } = h;
        if (V.P.vert) {
          const b = h.box;
          const lx = clamp(h.mx, b.x + 10, b.x + b.w - 10);
          plate(x, b.x, b.y, b.w, b.h, 1);
          gpu.topLines.push(
            lx,
            h.my < b.y ? b.y : b.y + b.h,
            h.mx,
            h.my,
            SOFT,
            0.6,
            1.0,
          );
          x.fillStyle = INK;
          x.globalAlpha = 0.9;
          x.beginPath();
          x.arc(h.mx, h.my, 2.2, 0, 6.283);
          x.fill();
          x.textAlign = 'right';
          x.font = `500 ${size}px ${FONT_TEXT}`;
          x.fillStyle = INK;
          x.globalAlpha = 0.92;
          x.fillText(fcT1(), sx, sy);
          x.strokeStyle = INK;
          x.lineWidth = 1;
          x.globalAlpha = 0.5;
          x.beginPath();
          x.moveTo(sx - w1, sy + 6.5);
          x.lineTo(sx, sy + 6.5);
          x.stroke();
          x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
          x.fillStyle = SOFT;
          x.globalAlpha = 0.92;
          x.fillText(fcT2(), sx, sy + TAG_H);
          x.textAlign = 'center';
        } else {
          x.font = `500 ${size}px ${FONT_TEXT}`;
          x.fillStyle = INK;
          x.globalAlpha = 0.88;
          x.fillText(fcT1(), sx, sy);
          x.strokeStyle = INK;
          x.lineWidth = 1;
          x.globalAlpha = 0.5;
          x.beginPath();
          x.moveTo(sx - w1 / 2, sy + 5.5);
          x.lineTo(sx + w1 / 2, sy + 5.5);
          x.stroke();
          x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
          x.fillStyle = SOFT;
          x.globalAlpha = 0.72;
          x.fillText(fcT2(), sx, sy + MIN_TEXT + 5);
        }
        fcHead = h.box;
      }
    }

    fcHits = [];
    if (Y >= FC_FROM && fcLeaps.length && !(V.P.vert && shA > 0)) {
      for (const l of fcLeaps) {
        coilY(Math.min(T2, l.y1), l.lane, 0.05, o1, 0);
        const p = projR(V, o1[0], o1[1], o1[2]);
        if (!p.d || !onStage(p.sx, p.sy)) continue;
        if (
          fcHead &&
          p.sx >= fcHead.x - 6 &&
          p.sx <= fcHead.x + fcHead.w + 6 &&
          p.sy >= fcHead.y - 6 &&
          p.sy <= fcHead.y + fcHead.h + 6
        ) {
          continue;
        }
        x.fillStyle = l.col;
        x.globalAlpha = l.kind === 'arc' ? 0.9 : 0.8;
        x.beginPath();
        x.arc(p.sx, p.sy, l.kind === 'arc' ? 3.2 : 2.6, 0, Math.PI * 2);
        x.fill();
        if (l.kind === 'arc') {
          x.strokeStyle = CORE;
          x.lineWidth = 1;
          x.globalAlpha = 0.42;
          x.beginPath();
          x.arc(p.sx, p.sy, 6.2, 0, Math.PI * 2);
          x.stroke();
        }
        fcHits.push({
          kind: 'claim',
          pr: l.pr,
          x0: p.sx - 10,
          y0: p.sy - 10,
          x1: p.sx + 10,
          y1: p.sy + 10,
        });
      }
      x.globalAlpha = 1;
    }
  }

  function separate(items: any[], V: ViewState) {
    const pulled = V.pull > 0.5;
    const uInHand = !pulled ? unitOf(cam.year) : null;
    const placed: any[] = [];
    for (const it of items) {
      const pr = projR(V, it.p[0], it.p[1], it.p[2]);
      if (!pr.d || !onStage(pr.sx, pr.sy)) continue;
      const sx = pr.sx;
      const sy = pr.sy;
      const d = pr.d;
      const s = pr.s;
      const near = nearOf(V, d);
      const lift = uInHand !== null && unitOf(it.y) === uInHand ? 1 : 0;
      const size = pulled
        ? Math.max(9, s * 0.14)
        : clamp(s * (0.1 + near * 0.12) * (1 + lift * 0.35), 9, V.P.picMax);
      if (size < 8) continue;
      const a = clamp(it.pc.a || 1, 0.65, 1.65);
      const w = a >= 1 ? size : size * a;
      const h = a >= 1 ? size / a : size;
      let cellSx: number | null = null;
      let cellSy: number | null = null;
      const cp = it.cell ? it.cell.c : it.cellP;
      if (cp) {
        const c = projR(V, cp[0], cp[1], cp[2]);
        if (c.d) {
          cellSx = c.sx;
          cellSy = c.sy;
        }
      }
      placed.push({ it, cx: sx, cy: sy, ox: sx, oy: sy, w, h, d, near, lift, cellSx, cellSy });
    }
    const n = placed.length;
    if (n > 1 && !pulled) {
      const pad = 4;
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const A = placed[i];
            const B = placed[j];
            const ox = (A.w + B.w) * 0.5 + pad - Math.abs(A.cx - B.cx);
            if (ox <= 0) continue;
            const oy = (A.h + B.h) * 0.5 + pad - Math.abs(A.cy - B.cy);
            if (oy <= 0) continue;
            if (ox < oy) {
              const sgn = A.cx <= B.cx ? -1 : 1;
              A.cx += sgn * ox * 0.5;
              B.cx -= sgn * ox * 0.5;
            } else {
              const sgn = A.cy <= B.cy ? -1 : 1;
              A.cy += sgn * oy * 0.5;
              B.cy -= sgn * oy * 0.5;
            }
          }
        }
        for (const P of placed) {
          P.cx = lerp(P.cx, P.ox, 0.08);
          P.cy = lerp(P.cy, P.oy, 0.08);
        }
      }
    }
    placed.sort((a, b) => b.d - a.d);
    return placed;
  }

  function paintPic(
    pl: any,
    layer: HelixGpuRenderer['rootPics'],
    V: ViewState,
  ) {
    const { it, cx, cy, w, h, near, lift, cellSx, cellSy } = pl;
    if (!it || !it.atl || !it.atl.naturalWidth) return;
    const pulled = V.pull > 0.5;
    const ah = ahead(it.y);
    const alpha =
      (pulled ? 0.85 : clamp(0.38 + near * 0.62 + lift * 0.2, 0, 1)) * ah;
    if (alpha <= 0.004) return;
    const texEntry = gpu.textureForImage(it.atl);
    const pc = it.pc;
    const momentHex =
      it.moment && Math.max(w, h) * 0.5 * 3 >= 2 ? heatOf(it.y) : null;
    const stem: [number, number] | null =
      lift > 0.5 && cellSx !== null ? [cellSx, cellSy] : null;
    layer.pushPic(
      texEntry.id,
      texEntry.tex,
      cx,
      cy,
      w,
      h,
      pc.u,
      pc.v,
      pc.uw,
      pc.vh,
      alpha,
      lift,
      momentHex,
      stem,
    );
    if (w >= 14) {
      picHits.push({
        it,
        x0: cx - w / 2,
        y0: cy - h / 2,
        x1: cx + w / 2,
        y1: cy + h / 2,
        cx,
        cy,
        w,
        h,
      });
    }
  }

  function drawPic(
    x: CanvasRenderingContext2D,
    it: { atl: HTMLImageElement; pc: any },
    cx: number,
    cy: number,
    w: number,
    h: number,
  ) {
    if (!it || !it.atl || !it.atl.naturalWidth) return;
    const aw = it.atl.naturalWidth;
    const ah2 = it.atl.naturalHeight;
    const pc = it.pc;
    x.drawImage(
      it.atl,
      pc.u * aw,
      (1 - pc.v - pc.vh) * ah2,
      pc.uw * aw,
      pc.vh * ah2,
      cx - w / 2,
      cy - h / 2,
      w,
      h,
    );
  }

  function trimText(x: CanvasRenderingContext2D, s: string, maxW: number): string {
    if (x.measureText(s).width <= maxW) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (x.measureText(s.slice(0, m) + '\u2026').width <= maxW) lo = m;
      else hi = m - 1;
    }
    return s.slice(0, lo).trimEnd() + '\u2026';
  }

  function wrapLines(
    x: CanvasRenderingContext2D,
    s: string,
    maxW: number,
    maxL: number,
  ): string[] {
    const tokens = tokenizeText(String(s || ''));
    const out: string[] = [];
    let line = '';
    let prevCjk = false;
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      const tryL = joinToken(line, prevCjk, w);
      if (x.measureText(tryL).width <= maxW || !line) {
        line = tryL;
        prevCjk = w.cjk;
      } else {
        if (out.length === maxL - 1) {
          let rest = line;
          let rc = prevCjk;
          for (let j = i; j < tokens.length; j++) {
            rest = joinToken(rest, rc, tokens[j]);
            rc = tokens[j].cjk;
          }
          out.push(trimText(x, rest, maxW));
          return out;
        }
        if (line) out.push(line);
        line = w.t;
        prevCjk = w.cjk;
      }
    }
    if (line) out.push(line);
    return out;
  }

  const STATUS_RANK: Record<string, number> = {
    'deployed-at-scale': 0,
    commercialized: 1,
    demonstrated: 2,
    proposed: 3,
    refuted: 4,
  };

  function pickClaims(all: any[], k: number) {
    if (all.length <= k) return all;
    const used = new Set<string>();
    const out: any[] = [];
    const take = (fn: (p: any) => boolean) => {
      const p = all.find((x) => !used.has(x.id) && fn(x));
      if (p) {
        used.add(p.id);
        out.push(p);
      }
    };
    take((p) => p.verdict === 'wrong' || p.verdict === 'contradicted');
    take(
      (p) =>
        p.verdict === 'came_true' ||
        p.verdict === 'came_true_late' ||
        p.verdict === 'on_track',
    );
    if (k >= 3) {
      take(
        (p) =>
          p.verdict !== 'wrong' &&
          p.verdict !== 'contradicted' &&
          p.verdict !== 'came_true' &&
          p.verdict !== 'came_true_late' &&
          p.verdict !== 'on_track',
      );
    }
    for (const p of all) {
      if (out.length >= k) break;
      if (!used.has(p.id)) {
        used.add(p.id);
        out.push(p);
      }
    }
    return out;
  }

  function fieldData() {
    const un = unitOf(cam.year);
    const evs = evByUnit.get(un) || [];
    const cl = claimsByUnit.get(un) || [];
    return { un, fcast: false, evs, total: evs.length, claims: cl, claimsTotal: cl.length };
  }

  function drawArc(
    x: CanvasRenderingContext2D,
    V: ViewState,
    arc: any,
    alpha: number,
    weight: number,
    dash?: number[],
  ) {
    x.strokeStyle = arc.col;
    x.lineWidth = weight;
    x.globalAlpha = alpha;
    if (dash) x.setLineDash(dash);
    x.beginPath();
    let pen = false;
    let fx = 0;
    let fy = 0;
    let fd = 0;
    let tx = 0;
    let ty = 0;
    let td = 0;
    for (let i = 0; i <= arc.n; i++) {
      const p = projR(V, arc.pts[i * 3], arc.pts[i * 3 + 1], arc.pts[i * 3 + 2]);
      if (!p.d || !onStage(p.sx, p.sy)) {
        pen = false;
        continue;
      }
      if (!pen) {
        x.moveTo(p.sx, p.sy);
        pen = true;
      } else {
        x.lineTo(p.sx, p.sy);
      }
      if (i === 0) {
        fx = p.sx;
        fy = p.sy;
        fd = p.d;
      }
      if (i === arc.n) {
        tx = p.sx;
        ty = p.sy;
        td = p.d;
      }
    }
    x.stroke();
    if (dash) x.setLineDash([]);
    if (fd) {
      x.fillStyle = arc.col;
      x.beginPath();
      x.arc(fx, fy, 2.6, 0, Math.PI * 2);
      x.fill();
    }
    if (td && !arc.ghost) {
      x.lineWidth = 1.4;
      x.beginPath();
      x.arc(tx, ty, 3.8, 0, Math.PI * 2);
      x.stroke();
    } else if (td) {
      x.fillStyle = arc.col;
      x.globalAlpha = alpha * 0.7;
      x.beginPath();
      x.arc(tx, ty, 2.4, 0, Math.PI * 2);
      x.fill();
    }
    return fd ? { fx, fy, tx, ty, td } : null;
  }

  function unitPic(e: any) {
    const hit = picById.get(e.id);
    if (hit && hit.atl && hit.atl.naturalWidth) return hit;
    if (e.picture && e.picture.src) {
      const src = assetUrl(e.picture.src);
      const im = momentImg.get(src);
      if (im && typeof im === 'object' && im.naturalWidth) {
        return {
          pc: { u: 0, v: 0, uw: 1, vh: 1, a: im.naturalWidth / im.naturalHeight },
          atl: im,
        };
      }
    }
    return null;
  }

  let unitDom: HTMLDivElement | null = null;
  let unitDomKey = '';
  let unitBuilding = false;
  let sheetTouch: { id: number; y0: number; ly: number; sc0: number; top: boolean } | null =
    null;

  function ensureUnitDom() {
    if (unitDom) return unitDom;
    unitDom = document.createElement('div');
    unitDom.className = 'hx-unit';
    unitDom.hidden = true;
    unitDom.setAttribute('role', 'region');
    host.appendChild(unitDom);

    unitDom.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      const cl = t.closest('[data-close]');
      if (cl) {
        closeSheet();
        invalidate();
        return;
      }
      const fb = t.closest('[data-f]') as HTMLElement | null;
      if (fb) {
        const d = fb.dataset.f || '';
        openFilter = openFilter === d ? null : d || null;
        openScroll = 0;
        const sc = unitDom!.querySelector('.hx-ubody');
        if (sc) sc.scrollTop = 0;
        unitDomKey = '';
        invalidate();
        return;
      }
      const row = t.closest('[data-id]') as HTMLElement | null;
      if (row) {
        if (V_LAST && V_LAST.P.vert) closeSheet();
        selectRecord(row.dataset.id!);
        invalidate();
      }
    });

    unitDom.addEventListener('pointerover', (ev) => {
      const row = (ev.target as HTMLElement).closest('[data-id]') as HTMLElement | null;
      const id = row ? row.dataset.id : null;
      const k = row ? row.dataset.k : null;
      const nh = id
        ? k === 'pr'
          ? { kind: 'feedClaim', pr: (db.predictions || []).find((p) => p.id === id) }
          : { kind: 'feedEv', e: db.byId && db.byId.get(id) }
        : null;
      if ((nh && nh.e) || (nh && nh.pr)) {
        hov = nh;
        invalidate();
      } else if (hov && (hov.kind === 'feedEv' || hov.kind === 'feedClaim')) {
        hov = null;
        invalidate();
      }
    });

    unitDom.addEventListener('pointerleave', () => {
      if (hov && (hov.kind === 'feedEv' || hov.kind === 'feedClaim')) {
        hov = null;
        invalidate();
      }
    });

    unitDom.addEventListener(
      'touchstart',
      (ev) => {
        if (!V_LAST || !V_LAST.P.vert || ev.touches.length !== 1) return;
        const sc = unitDom!.querySelector('.hx-ubody') as HTMLElement | null;
        const t = ev.touches[0];
        const inHead = !!(ev.target as HTMLElement).closest('.hx-uhead');
        sheetTouch = {
          id: t.identifier,
          y0: t.clientY,
          ly: t.clientY,
          sc0: sc ? sc.scrollTop : 0,
          top: inHead || !sc || sc.scrollTop <= 1,
        };
      },
      { passive: true },
    );

    unitDom.addEventListener(
      'touchmove',
      (ev) => {
        if (!sheetTouch) return;
        const t = [...ev.touches].find((q) => q.identifier === sheetTouch!.id);
        if (!t) return;
        sheetTouch.ly = t.clientY;
        const dy = t.clientY - sheetTouch.y0;
        if (sheetTouch.top && dy > 6) {
          unitDom!.style.transform = `translateY(${Math.max(0, dy * 0.85)}px)`;
          ev.preventDefault();
        }
      },
      { passive: false },
    );

    const endTouch = () => {
      if (!sheetTouch) return;
      const dy = sheetTouch.ly - sheetTouch.y0;
      const pull = sheetTouch.top && dy > 72;
      sheetTouch = null;
      unitDom!.style.transform = '';
      if (pull) {
        closeSheet();
        invalidate();
      }
    };
    unitDom.addEventListener('touchend', endTouch, { passive: true });
    unitDom.addEventListener('touchcancel', endTouch, { passive: true });
    return unitDom;
  }

  let V_LAST: ViewState | null = null;
  function closeSheet() {
    openUnit = null;
    openFcast = false;
    openFilter = null;
    openScroll = 0;
    shOpen = false;
    if (unitDom) {
      unitDom.hidden = true;
      unitDom.style.transform = '';
    }
    unitDomKey = '';
  }

  let lastUnitSel = '';
  const syncUnitSel = (uEl: HTMLElement) => {
    const sel = state.sel || '';
    if (sel === lastUnitSel) return;
    lastUnitSel = sel;
    uEl.querySelectorAll<HTMLElement>('.hx-urow[data-id]').forEach((row) => {
      row.classList.toggle('sel', Boolean(sel && row.dataset.id === sel));
    });
  };

  function renderUnitDom(V: ViewState) {
    V_LAST = V;
    const vert = V.P.vert;
    const on = openFcast || openUnit !== null;
    if (!on) {
      if (unitDom && !unitDom.hidden) unitDom.hidden = true;
      openRect = null;
      openHits = [];
      return;
    }
    const uEl = ensureUnitDom();
    const un = openUnit;
    const allEvs = openFcast ? [] : evByUnit.get(un!) || [];
    const allCl = openFcast ? fcastAll : claimsByUnit.get(un!) || [];
    const key = `${vert ? 'v' : 'd'}:${openFcast ? 'fc' : un}:${openFilter || ''}:${allEvs.length}:${allCl.length}:${picState}:${momentImg.size}`;
    const x = vert ? BAND.x0 : 10;
    const w = vert ? BAND.w : BAND.x0 - 18;
    const y = vert ? Math.round(BAND.h * 0.28) : 8;
    const h = vert ? BAND.y1 - y : BAND.stripY - 16;
    openRect = { x, y, w, h };
    uEl.hidden = false;
    uEl.classList.toggle('vert', vert);
    uEl.style.left = x + 'px';
    uEl.style.top = y + 'px';
    uEl.style.width = w + 'px';
    uEl.style.height = h + 'px';
    if (key === unitDomKey) {
      syncUnitSel(uEl);
      return;
    }
    unitDomKey = key;
    lastUnitSel = '';
    unitBuilding = true;

    const counts = new Map<string, number>();
    for (const e of allEvs) counts.set(e.domain, (counts.get(e.domain) || 0) + 1);
    for (const p of allCl) {
      if (p.domain) counts.set(p.domain, (counts.get(p.domain) || 0) + 1);
    }
    const doms = ORDER.filter((d) => counts.get(d));
    if (openFilter && !counts.get(openFilter)) openFilter = null;
    const evs = openFilter ? allEvs.filter((e) => e.domain === openFilter) : allEvs;
    const cl = openFilter ? allCl.filter((p) => p.domain === openFilter) : allCl;
    const headTxt = openFcast ? fcT1() : unitLabel(un!);
    const col = openFcast ? INK : vert ? typeOfPhone(un!) : typeOf(un!);
    const countTxt = openFcast
      ? isZh()
        ? `收录 ${allCl.length} 条定年预测 · ${fcastVoices} 位学者与思想者`
        : `${allCl.length} dated forecasts \u00b7 ${fcastVoices} voices`
      : isZh()
        ? `共 ${allEvs.length} 条史料${allCl.length ? ` · ${allCl.length} 条历史论断` : ''}`
        : `${allEvs.length} record${allEvs.length === 1 ? '' : 's'}${
            allCl.length ? ` \u00b7 ${allCl.length} claim${allCl.length === 1 ? '' : 's'}` : ''
          }`;
    uEl.setAttribute('aria-label', headTxt);

    const chips =
      doms.length > 1
        ? `<div class="hx-uchips"><button type="button" data-f="" class="${!openFilter ? 'on' : ''}">${
            isZh() ? '全部' : 'All'
          } ${allEvs.length + allCl.length}</button>${doms
            .map((d) => {
              const dm = DOMAIN[d];
              const nm = dm ? dm.short || dm.label : d;
              return `<button type="button" data-f="${esc(d)}" class="${
                openFilter === d ? 'on' : ''
              }">${esc(nm)} ${counts.get(d)}</button>`;
            })
            .join('')}</div>`
        : '';

    const groups: { label: string; items: any[]; kind?: string }[] = [];
    if (openFcast) {
      const byD = new Map<number, any[]>();
      for (const pr of cl) {
        const d = Math.floor((pr.target_year ?? T1) / 10) * 10;
        let g = byD.get(d);
        if (!g) byD.set(d, (g = []));
        g.push(pr);
      }
      for (const d of [...byD.keys()].sort((a, b) => a - b)) {
        groups.push({ label: isZh() ? `${d}年代` : `${d}s`, items: byD.get(d)!, kind: 'fcast' });
      }
    } else if (un! >= 2000) {
      groups.push({ label: '', items: evs });
    } else {
      const span = un! < T0;
      const byY = new Map<number, any[]>();
      for (const e of evs) {
        let g = byY.get(e.year);
        if (!g) byY.set(e.year, (g = []));
        g.push(e);
      }
      for (const yr of [...byY.keys()].sort((a, b) => a - b)) {
        groups.push({
          label: span ? fmtYear(yr) : isZh() ? `${yr}年` : String(yr),
          items: byY.get(yr)!,
        });
      }
    }

    const rowEv = (e: any, showYr: boolean) => {
      const dm = DOMAIN[e.domain];
      const reg = REGION[e.region]?.label || e.region || '';
      const sub: string[] = [];
      if (showYr) sub.push(e.date ? fmtDate(e.date) : fmtYear(e.year));
      if (dm) sub.push(dm.label);
      if (e.who) sub.push(e.who);
      else if (reg && reg !== 'Global' && reg !== '全球') sub.push(reg);
      if (e.status && STATUS_WORD[e.status]) sub.push(capW(STATUS_WORD[e.status]));
      const pic = unitPic(e);
      const dot = e.status
        ? STATUS_NIGHT[e.status] || heatOf(e.year)
        : heatOf(e.year);
      return `<button type="button" class="hx-urow${pic ? ' pic' : ''}" data-id="${esc(
        e.id,
      )}" data-k="ev">${
        pic
          ? `<canvas class="hx-uth" data-pic="${esc(e.id)}" width="88" height="68"></canvas>`
          : `<i class="hx-udot" style="background:${dot}"></i>`
      }<span class="hx-utxt"><span class="hx-ut">${esc(e.title)}</span><span class="hx-um">${esc(
        sub.join(' \u00b7 '),
      )}</span></span></button>`;
    };

    const rowPr = (pr: any, fcast?: boolean) => {
      const vc = prColor(pr);
      const vw = prWord(pr);
      const who = [
        pr.by,
        pr.year_made != null
          ? fcast
            ? isZh()
              ? `${pr.year_made}年提出`
              : `said ${pr.year_made}`
            : fmtYear(pr.year_made)
          : '',
      ]
        .filter(Boolean)
        .join(isZh() ? ' · ' : ', ');
      const tgt =
        pr.target_year != null
          ? fcast
            ? isZh()
              ? `目标 ${pr.target_year}年`
              : `for ${pr.target_year}`
            : `\u2192 ${pr.target_year}`
          : '';
      const q = String(pr.claim || '').replace(/^[\u201c"]|[\u201d"]$/g, '');
      return `<button type="button" class="hx-urow pr" data-id="${esc(
        pr.id,
      )}" data-k="pr"><i class="hx-udot ring" style="border-color:${vc}"></i><span class="hx-utxt"><span class="hx-ut">\u201c${esc(
        q,
      )}\u201d</span><span class="hx-um"><b style="color:${vc}">${esc(
        capW(vw),
      )}</b>${tgt ? ' ' + esc(tgt) : ''}${who ? ' \u00b7 ' + esc(who) : ''}</span></span></button>`;
    };

    const bodyHtml =
      groups
        .map(
          (g) =>
            (g.label ? `<div class="hx-ug">${esc(g.label)}</div>` : '') +
            g.items
              .map((it) =>
                g.kind === 'fcast' ? rowPr(it, true) : rowEv(it, !g.label),
              )
              .join(''),
        )
        .join('') +
      (!openFcast && cl.length
        ? `<div class="hx-ug">${isZh() ? `历史预测与论断 (${cl.length})` : `Claims (${cl.length})`}</div>` +
          cl.map((p) => rowPr(p, false)).join('')
        : '');

    uEl.innerHTML = `<div class="hx-uhead">${
      vert ? '<i class="hx-ugrip"></i>' : ''
    }<div class="hx-utop"><h3 style="color:${col}">${esc(
      headTxt,
    )}</h3><button type="button" class="hx-ux" data-close="1" aria-label="${
      isZh() ? '关闭' : 'Close'
    }">\u00d7 ${isZh() ? '关闭' : 'Close'}</button></div><div class="hx-usub">${esc(
      countTxt,
    )}</div>${chips}</div><div class="hx-ubody">${bodyHtml}</div>`;

    const sc = uEl.querySelector('.hx-ubody') as HTMLElement | null;
    if (sc && openScroll) sc.scrollTop = openScroll;
    syncUnitSel(uEl);
    if (sc) {
      sc.addEventListener(
        'scroll',
        () => {
          if (!unitBuilding) openScroll = sc.scrollTop;
        },
        { passive: true },
      );
    }

    for (const cv of uEl.querySelectorAll('canvas[data-pic]')) {
      const cEl = cv as HTMLCanvasElement;
      const e = db.byId && db.byId.get(cEl.dataset.pic!);
      const pic = e && unitPic(e);
      if (!pic) continue;
      const g = cEl.getContext('2d')!;
      drawPic(g, pic, cEl.width / 2, cEl.height / 2, cEl.width, cEl.height);
    }
    unitBuilding = false;
  }

  let refItem: any = null;

  function drawRef(x: CanvasRenderingContext2D, V: ViewState, selEv: any) {
    satHits = [];
    if (V.pull > 0.45) {
      refItem = null;
      return;
    }

    let cEv = selEv;
    let cCell = selEv ? evCell.get(selEv.id) : null;
    if (!cEv && hov) {
      if (hov.kind === 'cell') {
        cCell = hov.cell || (hov.e ? evCell.get(hov.e.id) : null);
        cEv = cCell ? cCell.e : hov.e || null;
      } else if (hov.kind === 'pic') {
        cEv = hov.it.e;
        cCell = hov.it.cell || evCell.get(cEv.id);
      } else if (hov.kind === 'feedEv') {
        cEv = hov.e;
        cCell = evCell.get(cEv.id);
      }
    }

    let cp: { sx: number; sy: number } | null = null;
    if (cCell && Math.abs(slf(cEv.year) - slf(Math.max(T0, cam.year))) <= 240) {
      const p = projR(V, cCell.c[0], cCell.c[1], cCell.c[2]);
      if (p.d && onStage(p.sx, p.sy)) cp = { sx: p.sx, sy: p.sy };
    }
    if (!cp && cEv && cEv.year < T0 && picHits.length) {
      const ph = picHits.find((h) => h.it.e.id === cEv.id);
      if (ph) cp = { sx: ph.cx, sy: ph.cy };
    }
    if (!cp) cEv = null;

    if (V.P.vert) {
      refItem = null;
      if (!cEv || !cp || shA > 0) return;
      if (hov && (hov.kind === 'cell' || hov.kind === 'pic')) return;
      x.save();
      const col = typeOfPhone(cEv.year);
      x.strokeStyle = col;
      x.lineWidth = 1.6;
      x.globalAlpha = 0.92;
      x.beginPath();
      x.arc(cp.sx, cp.sy, 9, 0, Math.PI * 2);
      x.stroke();
      x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`;
      const maxW = BAND.w - 36;
      const t = trimText(x, cEv.title, maxW);
      const tw = x.measureText(t).width;
      const bw = tw + 16;
      const bh = TAG_H + 8;
      let bx = clamp(cp.sx - bw / 2, BAND.x0 + 8, BAND.x1 - 8 - bw);
      let by = cp.sy - 14 - bh;
      if (by < skyTop() + 4) by = cp.sy + 14;
      if (readR && by + bh > readR.y - 6) by = Math.max(skyTop() + 4, cp.sy - 14 - bh);
      if (by + bh <= BAND.y1 - 4 && !(readR && by + bh > readR.y - 2)) {
        const ly = by < cp.sy ? by + bh : by;
        const lx = clamp(cp.sx, bx + 10, bx + bw - 10);
        x.strokeStyle = col;
        x.lineWidth = 1;
        x.globalAlpha = 0.55;
        x.beginPath();
        x.moveTo(cp.sx, cp.sy + (by < cp.sy ? -9 : 9));
        x.lineTo(lx, ly);
        x.stroke();
        plate(x, bx, by, bw, bh, 1);
        x.strokeStyle = hexA(col, 0.45);
        x.lineWidth = 1;
        x.globalAlpha = 1;
        x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        x.fillStyle = INK;
        x.textAlign = 'left';
        x.textBaseline = 'middle';
        x.fillText(t, bx + 8, by + bh / 2);
        satHits.push({ e: cEv, x0: bx, y0: by, x1: bx + bw, y1: by + bh });
      }
      x.restore();
      return;
    }

    if (cEv && (!refItem || refItem.e.id !== cEv.id)) {
      refItem = { e: cEv, sx: cp!.sx, sy: cp!.sy, a: 0 };
    }
    if (!refItem) return;
    if (cEv) {
      refItem.sx = cp!.sx;
      refItem.sy = cp!.sy;
    }
    const want = cEv ? 1 : 0;
    refItem.a += (want - refItem.a) * (want ? 0.3 : 0.22);
    if (!want && refItem.a < 0.03) {
      refItem = null;
      return;
    }
    if (Math.abs(want - refItem.a) > 0.01) invalidate();

    const e = refItem.e;
    const a = refItem.a;
    const pic = unitPic(e);
    const hasPic = !!(pic && pic.atl && pic.atl.complete && pic.atl.naturalWidth);
    const CW = Math.min(252, Math.max(188, Math.round(BAND.w * 0.27)));
    const PAD = 11;
    const PW = CW - PAD * 2;
    const PH = hasPic ? Math.round(PW / clamp(pic!.pc.a || 1.35, 0.85, 1.85)) : 0;

    x.save();
    x.font = `600 ${MIN_TEXT + 1}px ${FONT_TEXT}`;
    const tLines = wrapLines(x, e.title, PW, 2);
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    const sumSource =
      isZh() && !e._hasZhSummary
        ? [
            DOMAIN[e.domain]?.label,
            TYPE[e.type]?.label,
            REGION[e.region]?.label,
            ...(e.people || []).slice(0, 2),
            ...(e.orgs || []).slice(0, 2),
          ]
            .filter(Boolean)
            .join(' · ')
        : e.summary;
    const sum = sumSource ? wrapLines(x, sumSource, PW, hasPic ? 2 : 3) : [];
    const CH =
      PAD +
      (hasPic ? PH + 9 : 0) +
      17 +
      4 +
      tLines.length * 19 +
      (sum.length ? 5 + sum.length * 18 : 0) +
      (selEv ? 0 : 20) +
      PAD;
    const sL = stageLeft();
    const side = refItem.sx > sL + (BAND.x1 - sL) * 0.52 ? -1 : 1;
    let cx0 = side > 0 ? refItem.sx + 44 : refItem.sx - 44 - CW;
    cx0 = clamp(cx0, sL + 14, BAND.x1 - CW - 14);
    if (Math.abs(cx0 + CW / 2 - refItem.sx) < CW * 0.45) {
      cx0 =
        side > 0
          ? Math.min(BAND.x1 - CW - 14, refItem.sx + 30)
          : Math.max(sL + 14, refItem.sx - 30 - CW);
    }
    let cy0 = clamp(refItem.sy - CH * 0.5, 58, BAND.y1 - CH - 14);
    if (!V.P.vert && cx0 + CW > W - 210 && cy0 + CH > BAND.stripY - 80) {
      cy0 = Math.max(54, BAND.stripY - 84 - CH);
    }
    const ax = refItem.sx < cx0 ? cx0 : refItem.sx > cx0 + CW ? cx0 + CW : refItem.sx;
    const ay = clamp(refItem.sy, cy0 + 14, cy0 + CH - 14);
    const col = heatOf(e.year);

    x.strokeStyle = col;
    x.lineWidth = 1.1;
    x.globalAlpha = 0.55 * a;
    x.beginPath();
    x.moveTo(refItem.sx, refItem.sy);
    x.lineTo(ax, ay);
    x.stroke();
    x.fillStyle = col;
    x.globalAlpha = 0.9 * a;
    x.beginPath();
    x.arc(refItem.sx, refItem.sy, 3, 0, Math.PI * 2);
    x.fill();

    x.save();
    x.globalAlpha = 0.96 * a;
    x.shadowColor = 'rgba(0,0,0,0.68)';
    x.shadowBlur = 24;
    x.shadowOffsetY = 6;
    x.fillStyle = 'rgba(7,16,18,0.95)';
    x.fillRect(cx0, cy0, CW, CH);
    x.restore();

    x.strokeStyle = hexA(col, 0.55);
    x.lineWidth = 1;
    x.globalAlpha = a;
    x.strokeRect(cx0 + 0.5, cy0 + 0.5, CW - 1, CH - 1);
    x.fillStyle = col;
    x.globalAlpha = 0.9 * a;
    x.fillRect(cx0, cy0, 3, CH);

    let yy = cy0 + PAD;
    const xx = cx0 + PAD;
    if (hasPic) {
      x.globalAlpha = a;
      drawPic(x, pic!, xx + PW / 2, yy + PH / 2, PW, PH);
      x.strokeStyle = 'rgba(156,181,175,0.22)';
      x.strokeRect(xx + 0.5, yy + 0.5, PW - 1, PH - 1);
      yy += PH + 9;
    }

    const dm = DOMAIN[e.domain];
    const kick = [
      e.date ? fmtDate(e.date) : fmtYear(e.year),
      dm ? dm.short || dm.label : '',
    ]
      .filter(Boolean)
      .join(' \u00b7 ');
    x.textAlign = 'left';
    x.textBaseline = 'alphabetic';
    x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`;
    x.fillStyle = typeOf(e.year);
    x.globalAlpha = 0.95 * a;
    x.fillText(trimText(x, kick, PW), xx, yy + 13);
    yy += 17 + 4;

    x.font = `600 ${MIN_TEXT + 1}px ${FONT_TEXT}`;
    x.fillStyle = INK;
    x.globalAlpha = a;
    for (const ln of tLines) {
      x.fillText(ln, xx, yy + 14);
      yy += 19;
    }

    if (sum.length) {
      yy += 5;
      x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
      x.fillStyle = SOFT;
      x.globalAlpha = 0.88 * a;
      for (const ln of sum) {
        x.fillText(ln, xx, yy + 13);
        yy += 18;
      }
    }

    if (!selEv) {
      x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
      x.fillStyle = SOFT;
      x.globalAlpha = 0.58 * a;
      x.fillText(isZh() ? '点击展开详细考证 \u2192' : 'Click to open record \u2192', xx, cy0 + CH - PAD + 1);
    }
    if (want) {
      satHits.push({ e, x0: cx0, y0: cy0, x1: cx0 + CW, y1: cy0 + CH });
    }
    x.restore();
  }

  let flowWasActive = false;

  function drawOverlay(V: ViewState, sceneRepainted: boolean) {
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.clearRect(0, 0, W, H);
    feedHits = [];
    const now = performance.now();

    gpu.beginFlow();
    const flowActive = rootFlowOn();
    if (flowActive) {
      drawRootFlow(V, now);
      invalidate();
    }
    if (sceneRepainted || flowActive || flowWasActive) {
      try {
        gpu.render();
      } catch {
        /* guard rAF/DOM sheet loop against transient GPU device loss */
      }
    }
    flowWasActive = flowActive;

    const rest =
      Math.abs(cam.year - cam.target) < 0.35 &&
      Math.abs(cam.v) < 0.8 &&
      !cam.fling &&
      !stripDrag;
    const uNow = unitOf(cam.year);
    if (uNow !== roUnit) {
      roUnit = uNow;
      roSince = now;
    }
    if (roShown === null || rest || now - roSince >= RO_DWELL_MS) roShown = uNow;
    if (roShown !== uNow) invalidate();

    if (rest && !wasRest) {
      restAt = now;
      linesAt = now + REST_MS;
    }
    wasRest = rest;
    const speed = Math.abs(cam.v);
    let fieldA: number;
    let linesA: number;
    if (POSTER) {
      fieldA = 1;
      linesA = 1;
    } else if (reduced()) {
      fieldA = rest ? 1 : 0.45;
      linesA = rest ? 1 : 0;
    } else if (rest) {
      fieldA = clamp((now - restAt) / REST_MS, 0.35, 1);
      linesA = clamp((now - linesAt) / LINES_MS, 0, 1);
      if (linesA < 1) invalidate();
    } else {
      const fast = clamp((speed - 20) / HOLD_SPEED, 0, 1);
      fieldA = lerp(0.85, 0.25, fast);
      linesA = lerp(0.55, 0, fast);
    }
    const pullFade = clamp(1 - V.pull * 1.6, 0, 1);

    const sel = state.sel || '';
    const selEv = sel && db.byId ? db.byId.get(sel) : null;
    const selArc = sel ? arcOfClaim.get(sel) : null;

    if (V.pull < 0.5) {
      const nearArcs = arcByFrom.get(unitOf(cam.year)) || [];
      for (const a of nearArcs) {
        if (a === selArc) continue;
        drawArc(octx, V, a, 0.26 * pullFade, 1.1, a.ghost ? [3, 4] : undefined);
      }
      if (hov && (hov.kind === 'feedClaim' || hov.kind === 'claim')) {
        const a = arcOfClaim.get(hov.pr.id);
        if (a && a !== selArc) {
          drawArc(octx, V, a, 0.9, 2.2, a.ghost ? [4, 4] : undefined);
        }
      }
      if (selArc) {
        drawArc(octx, V, selArc, 0.95, 2.4, selArc.ghost ? [4, 4] : undefined);
      }
    }
    octx.globalAlpha = 1;

    if (selEv) {
      const c = evCell.get(selEv.id);
      if (c) {
        const p = projR(V, c.c[0], c.c[1], c.c[2]);
        if (p.d) {
          octx.strokeStyle = INK;
          octx.lineWidth = 1.8;
          const r = Math.max(8, p.s * 0.055);
          octx.strokeRect(p.sx - r, p.sy - r, r * 2, r * 2);
        }
      }
    }
    if (hov && hov.kind === 'cell' && hov.q) {
      octx.strokeStyle = INK;
      octx.lineWidth = 1.6;
      const q = hov.q;
      octx.beginPath();
      octx.moveTo(q[0], q[1]);
      for (let k = 1; k < 4; k++) octx.lineTo(q[k * 2], q[k * 2 + 1]);
      octx.closePath();
      octx.stroke();
    }
    if (hov && hov.kind === 'feedEv') {
      const c = evCell.get(hov.e.id);
      if (c) {
        const p = projR(V, c.c[0], c.c[1], c.c[2]);
        if (p.d) {
          const r = Math.max(7, p.s * 0.05);
          octx.strokeStyle = heatOf(hov.e.year);
          octx.lineWidth = 2;
          octx.beginPath();
          octx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          octx.stroke();
        }
      }
    }

    drawRef(octx, V, selEv);

    if (hov && hov.kind === 'pic') {
      const { it, cx, cy, w, h } = hov;
      const z = 1.5;
      const zw = Math.max(w * z, 96);
      const zh = Math.max(h * z, 96 / clamp(it.pc.a || 1, 0.65, 1.65));
      const zx = clamp(cx, stageLeft() + zw / 2 + 8, W - zw / 2 - 8);
      const zy = clamp(cy, zh / 2 + 52, BAND.y1 - zh / 2 - 8);
      octx.save();
      octx.shadowColor = 'rgba(0,0,0,0.72)';
      octx.shadowBlur = 22;
      octx.shadowOffsetY = 6;
      octx.fillStyle = NIGHT;
      octx.fillRect(zx - zw / 2 - 3, zy - zh / 2 - 3, zw + 6, zh + 6);
      octx.restore();
      drawPic(octx, it, zx, zy, zw, zh);
      octx.strokeStyle = INK;
      octx.lineWidth = 1.4;
      octx.strokeRect(zx - zw / 2 - 0.5, zy - zh / 2 - 0.5, zw + 1, zh + 1);
    }

    const P = V.P;
    const f = fieldData();
    const roU = roShown ?? f.un;
    const [roNum, roEra] = fmtReadout(roU);
    if (P.vert) {
      drawPhoneOverlay(octx, V, f, roU, roNum, roEra, fieldA, linesA, pullFade);
    } else {
      const rxRight = W - 20;
      const ry = BAND.stripY - 24;
      octx.save();
      octx.textAlign = 'left';
      octx.textBaseline = 'alphabetic';
      octx.shadowColor = 'rgba(3, 9, 10, 0.88)';
      octx.shadowBlur = 16;
      if (isZh() && roEra === '公元前') {
        const eraFont = `600 ${Math.round(P.readout * 0.30)}px ${FONT_TEXT}`;
        const numFont = `500 ${Math.round(P.readout * 0.84)}px ${FONT_DISPLAY}`;
        const yrFont = `500 ${Math.round(P.readout * 0.32)}px ${FONT_TEXT}`;
        octx.font = eraFont;
        const ew = octx.measureText(roEra).width;
        octx.font = numFont;
        const nw = octx.measureText(roNum).width;
        octx.font = yrFont;
        const yw = octx.measureText('年').width;
        const rx = rxRight - (ew + 5 + nw + 6 + yw);
        octx.font = eraFont;
        octx.fillStyle = SOFT;
        octx.globalAlpha = 0.86;
        octx.fillText(roEra, rx, ry - Math.round(P.readout * 0.38));
        octx.font = numFont;
        octx.fillStyle = INK;
        octx.globalAlpha = 0.96;
        octx.fillText(roNum, rx + ew + 5, ry);
        octx.font = yrFont;
        octx.globalAlpha = 0.84;
        octx.fillText('年', rx + ew + nw + 6, ry);
      } else {
        const numFont = `500 ${P.readout}px ${FONT_DISPLAY}`;
        const eraFont = `500 ${Math.round(P.readout * 0.34)}px ${isZh() ? FONT_TEXT : FONT_DISPLAY}`;
        octx.font = numFont;
        const numW = octx.measureText(roNum).width;
        let eraW = 0;
        const gap = roEra ? (isZh() ? 5 : 8) : 0;
        if (roEra) {
          octx.font = eraFont;
          eraW = octx.measureText(roEra).width;
        }
        const rx = rxRight - (numW + gap + eraW);
        octx.font = numFont;
        octx.fillStyle = INK;
        octx.globalAlpha = 0.96;
        octx.fillText(roNum, rx, ry);
        if (roEra) {
          octx.font = eraFont;
          octx.fillStyle = isZh() ? mix(INK, SOFT, 0.35) : INK;
          octx.globalAlpha = 0.82;
          octx.fillText(roEra, rx + numW + gap, ry);
        }
      }
      octx.shadowBlur = 0;
      octx.font = `400 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
      octx.fillStyle = SOFT;
      octx.globalAlpha = 0.78;
      const sub = V.pull > 0.5 ? recCount() : '';
      if (sub) {
        octx.textAlign = 'right';
        octx.fillText(sub, rxRight, BAND.stripY - 8);
      }
      octx.restore();

      if (pullFade > 0.02) {
        const fx = 10;
        const fw = BAND.x0 - 18;
        if (openFcast || openUnit !== null) renderUnitDom(V);
        else {
          renderUnitDom(V);
          drawFeed(octx, fx, 8, fw, BAND.stripY - 16, P, f, fieldA * pullFade, linesA * pullFade);
        }
      } else {
        renderUnitDom(V);
      }
    }

    drawStrip(octx, P);
    octx.globalAlpha = 1;
  }

  function drawPhoneOverlay(
    x: CanvasRenderingContext2D,
    V: ViewState,
    f: ReturnType<typeof fieldData>,
    roU: number,
    roNum: string,
    roEra: string,
    fieldA: number,
    linesA: number,
    pullFade: number,
  ) {
    const P = V.P;
    if (shOpen && (openUnit !== null || openFcast)) shA = Math.min(1, shA + 0.22);
    else shA = Math.max(0, shA - 0.22);
    if (shA > 0 && shA < 1) invalidate();
    renderUnitDom(V);

    if (V.pull > 0.5) {
      const cnt = recCount();
      if (!cnt) return;
      x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
      const tw = x.measureText(cnt).width;
      const pw = tw + 20;
      const ph = 28;
      const px = (W - pw) / 2;
      const py = BAND.y1 - ph - 10;
      plate(x, px, py, pw, ph, 1);
      x.fillStyle = INK;
      x.globalAlpha = 0.92;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(cnt, W / 2, py + ph / 2);
      x.textAlign = 'left';
      return;
    }

    if (shA > 0.02) return;
    const pad = READ.pad;
    const x0 = BAND.x0 + 8;
    const w = BAND.w - 16;
    const inner = w - pad * 2;
    const cards = f.evs.slice(0, P.lines);
    const claims = pickClaims(f.claims, P.claims);
    const hasMore = f.total > cards.length || f.claimsTotal > claims.length;
    const h =
      pad * 2 +
      READ.date +
      READ.name +
      cards.length * READ.line +
      (claims.length ? 6 + claims.length * READ.line : 0);
    const y0 = BAND.y1 - 8 - h;
    const a = clamp(fieldA * pullFade, 0, 1);
    if (a <= 0.02) return;

    plate(x, x0, y0, w, h, 0.94 * a);
    x.strokeStyle = 'rgba(130,206,194,0.20)';
    x.lineWidth = 1;
    x.globalAlpha = a;
    x.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

    if (hasMore || f.total > 0 || f.fcast) {
      x.fillStyle = 'rgba(156,181,175,0.34)';
      x.fillRect(x0 + w / 2 - 16, y0 + 5, 32, 3);
    }

    const lx = x0 + pad;
    let yy = y0 + pad;
    x.textBaseline = 'alphabetic';
    x.textAlign = 'left';

    const dateStr = isZh()
      ? roEra === '公元前'
        ? `公元前${roNum}年`
        : `${roNum}${roEra}`
      : roEra
        ? `${roNum} ${roEra}`
        : roNum;
    const cnt = f.fcast
      ? isZh()
        ? `${f.total} 条远景预测`
        : `${f.total} forecasts`
      : f.total
        ? isZh()
          ? `${f.total} 条记录${f.claimsTotal ? ` · ${f.claimsTotal} 条论断` : ''}`
          : `${f.total} record${f.total === 1 ? '' : 's'}${
              f.claimsTotal ? ` \u00b7 ${f.claimsTotal}` : ''
            }`
        : isZh()
          ? '暂无记录'
          : 'No records';
    x.font = `500 ${MIN_TEXT}px ${FONT_TEXT}`;
    x.fillStyle = typeOfPhone(roU);
    x.globalAlpha = a;
    x.fillText(dateStr, lx, yy + 15);

    const openStr = hasMore
      ? `${cnt} \u00b7 ${isZh() ? '全部' : 'All'} \u2192`
      : cnt;
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    x.fillStyle = SOFT;
    x.globalAlpha = 0.88 * a;
    x.textAlign = 'right';
    x.fillText(openStr, x0 + w - pad, yy + 15);
    x.textAlign = 'left';

    const headHit = f.fcast
      ? { kind: 'openFcast', x0, y0, x1: x0 + w, y1: yy + READ.date + READ.name }
      : f.total + f.claimsTotal > 0
        ? {
            kind: 'openUnit',
            un: f.un,
            x0,
            y0,
            x1: x0 + w,
            y1: yy + READ.date + READ.name,
          }
        : null;
    if (headHit) feedHits.push(headHit);
    yy += READ.date;

    const lead = f.fcast
      ? fcT1()
      : cards[0]
        ? cards[0].title
        : claims[0]
          ? `\u201c${String(claims[0].claim || '').replace(/^[\u201c"]|[\u201d"]$/g, '')}\u201d`
          : unitLabel(f.un);
    x.font = `600 ${P.head}px ${FONT_TEXT}`;
    x.fillStyle = INK;
    x.globalAlpha = a;
    x.fillText(trimText(x, lead, inner), lx, yy + 17);
    if (cards[0] && !f.fcast) {
      feedHits[feedHits.length - 1] = {
        kind: 'openUnit',
        un: f.un,
        x0,
        y0,
        x1: x0 + w,
        y1: y0 + pad + READ.date,
      };
      feedHits.push({
        kind: 'feedEv',
        e: cards[0],
        x0,
        y0: yy,
        x1: x0 + w,
        y1: yy + READ.name,
      });
    }
    yy += READ.name;

    const la = clamp(Math.max(linesA, 0.55) * pullFade, 0, 1);
    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    for (let i = f.fcast ? 0 : 1; i < cards.length; i++) {
      const e = cards[i];
      const dot = e.status
        ? STATUS_NIGHT[e.status] || heatOf(e.year)
        : heatOf(e.year);
      x.fillStyle = dot;
      x.globalAlpha = la;
      x.beginPath();
      x.arc(lx + 4, yy + 11, 3, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = INK;
      x.globalAlpha = 0.92 * la;
      x.fillText(trimText(x, e.title, inner - 16), lx + 14, yy + 16);
      feedHits.push({
        kind: 'feedEv',
        e,
        x0,
        y0: yy,
        x1: x0 + w,
        y1: yy + READ.line,
      });
      yy += READ.line;
    }

    if (claims.length) {
      yy += 6;
      for (const pr of claims) {
        const vc = VERDICT_NIGHT[pr.verdict] || INK;
        x.strokeStyle = vc;
        x.lineWidth = 1.5;
        x.globalAlpha = la;
        x.beginPath();
        x.arc(lx + 4, yy + 11, 3.2, 0, Math.PI * 2);
        x.stroke();
        const q = `\u201c${String(pr.claim || '').replace(/^[\u201c"]|[\u201d"]$/g, '')}\u201d`;
        x.fillStyle = INK;
        x.globalAlpha = 0.9 * la;
        x.fillText(trimText(x, q, inner - 16), lx + 14, yy + 16);
        feedHits.push({
          kind: 'feedClaim',
          pr,
          x0,
          y0: yy,
          x1: x0 + w,
          y1: yy + READ.line,
        });
        yy += READ.line;
      }
    }
  }

  function drawFeed(
    x: CanvasRenderingContext2D,
    fx0: number,
    fy0: number,
    fw0: number,
    fh0: number,
    P: StagePreset,
    f: ReturnType<typeof fieldData>,
    headA: number,
    linesA: number,
  ) {
    if (fw0 < 140) return;
    const padX = 14;
    const padY = 12;
    const fx = fx0 + padX;
    const fy = fy0 + padY;
    const fw = fw0 - padX * 2;
    const fh = fh0 - padY * 2;

    x.save();
    // Smoked Obsidian-Jade architectural reading frame on the desktop left rail
    const cardA = clamp(Math.max(headA, linesA), 0, 1);
    const bgGrad = x.createLinearGradient(fx0, fy0, fx0, fy0 + fh0);
    bgGrad.addColorStop(0, `rgba(8, 18, 20, ${(0.88 * cardA).toFixed(3)})`);
    bgGrad.addColorStop(1, `rgba(5, 11, 13, ${(0.95 * cardA).toFixed(3)})`);
    x.fillStyle = bgGrad;
    x.shadowColor = `rgba(1, 5, 6, ${(0.62 * cardA).toFixed(3)})`;
    x.shadowBlur = 24;
    x.shadowOffsetY = 6;
    x.beginPath();
    if (x.roundRect) x.roundRect(fx0, fy0, fw0, fh0, 8);
    else x.rect(fx0, fy0, fw0, fh0);
    x.fill();
    x.shadowBlur = 0;
    x.shadowOffsetY = 0;

    const accentCol = f.fcast ? '#6ee7d8' : typeOf(f.un);
    x.strokeStyle = `rgba(130, 206, 194, ${(0.18 * cardA).toFixed(3)})`;
    x.lineWidth = 1;
    x.stroke();

    // Precision top mineral accent rule matching current era's spectrum hue
    x.save();
    x.clip();
    const topGlow = x.createLinearGradient(fx0, fy0, fx0 + fw0 * 0.78, fy0);
    topGlow.addColorStop(0, hexA(accentCol, 0.78 * cardA));
    topGlow.addColorStop(1, hexA(accentCol, 0));
    x.fillStyle = topGlow;
    x.fillRect(fx0, fy0, fw0, 2);
    x.restore();

    x.beginPath();
    if (x.roundRect) x.roundRect(fx0 + 2, fy0 + 2, fw0 - 4, fh0 - 4, 6);
    else x.rect(fx - 4, fy - 4, fw + 8, fh + 8);
    x.clip();
    x.textAlign = 'left';
    x.textBaseline = 'alphabetic';

    let y = fy + P.head - 2;
    x.font = `600 ${P.head}px ${FONT_TEXT}`;
    x.fillStyle = accentCol;
    x.globalAlpha = 0.98 * headA;
    const headTxt = f.fcast ? fcT1() : unitLabel(f.un);
    x.fillText(headTxt, fx, y);

    const cntTxt = f.fcast
      ? isZh()
        ? `${f.total} 条定年预测 · ${fcastVoices} 位学者`
        : `${f.total} dated \u00b7 ${fcastVoices} voices`
      : isZh()
        ? `本时段收录 ${f.total} 条史料${f.claimsTotal ? ` · ${f.claimsTotal} 条历史论断` : ''}`
        : `${f.total} record${f.total === 1 ? '' : 's'}${
            f.claimsTotal
              ? ` \u00b7 ${f.claimsTotal} claim${f.claimsTotal === 1 ? '' : 's'}`
              : ''
          }`;
    y += 17;
    x.font = `400 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
    x.fillStyle = SOFT;
    x.globalAlpha = 0.78 * headA;
    x.fillText(cntTxt, fx, y);

    if (f.total + f.claimsTotal > 0) {
      feedHits.push(
        f.fcast
          ? { kind: 'openFcast', x0: fx, y0: fy, x1: fx + fw, y1: y + 4 }
          : { kind: 'openUnit', un: f.un, x0: fx, y0: fy, x1: fx + fw, y1: y + 4 },
      );
    }

    y += 8;
    x.strokeStyle = 'rgba(130, 206, 194, 0.14)';
    x.lineWidth = 1;
    x.globalAlpha = headA;
    x.beginPath();
    x.moveTo(fx, y + 0.5);
    x.lineTo(fx + fw, y + 0.5);
    x.stroke();
    y += 9;

    if (linesA <= 0.02) {
      x.restore();
      return;
    }

    const cards = f.evs.slice(0, P.lines);
    if (state.sel && cards.length > 0 && !cards.some((ev) => ev.id === state.sel)) {
      const selInUnit = f.evs.find((ev) => ev.id === state.sel);
      if (selInUnit) cards[cards.length - 1] = selInUnit;
    }
    const claims = f.fcast ? f.claims : pickClaims(f.claims, P.claims);
    const reserveFoot = !f.fcast && f.un >= FC_FROM && fcastTotal > 0 ? 42 : 24;
    const itemRes = drawFeedItems(x, fx, y, fw, fy + fh - reserveFoot, P, f, cards, claims, linesA);
    y = itemRes.y;

    const shown = f.fcast ? claims.length : cards.length;
    const more = f.fcast
      ? f.total - shown
      : f.total - cards.length + Math.max(0, f.claimsTotal - claims.length);
    if (more > 0 && y < fy + fh - 4) {
      const my = Math.min(y + 6, fy + fh - (reserveFoot > 28 ? 46 : 22));
      const lbl = f.fcast
        ? isZh()
          ? `展开全部 ${f.total} 条远景预测 \u2192`
          : `See all ${f.total} forecasts \u2192`
        : isZh()
          ? `展开本时段全部 ${f.total} 条史料${f.claimsTotal ? `与 ${f.claimsTotal} 条论断` : ''} \u2192`
          : `See all ${f.total} records${
              f.claimsTotal ? ` & ${f.claimsTotal} claims` : ''
            } \u2192`;
      x.font = `500 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
      x.fillStyle = accentCol;
      x.globalAlpha = 0.94 * linesA;
      x.fillText(trimText(x, lbl, fw), fx, my + 14);
      feedHits.push(
        f.fcast
          ? { kind: 'openFcast', x0: fx, y0: my - 2, x1: fx + fw, y1: my + 22 }
          : {
              kind: 'openUnit',
              un: f.un,
              x0: fx,
              y0: my - 2,
              x1: fx + fw,
              y1: my + 22,
            },
      );
      y = my + 22;
    }
    if (!f.fcast && f.un >= FC_FROM && fcastTotal > 0 && y < fy + fh - 16) {
      const fy2 = Math.min(y + 4, fy + fh - 20);
      const fcLbl = isZh()
        ? `浏览 2076 远景展望（${fcastTotal} 条定年预测）\u2192`
        : `Forecasts to 2076 (${fcastTotal} dated) \u2192`;
      x.font = `500 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
      x.fillStyle = SOFT;
      x.globalAlpha = 0.88 * linesA;
      x.fillText(trimText(x, fcLbl, fw), fx, fy2 + 14);
      feedHits.push({ kind: 'openFcast', x0: fx, y0: fy2 - 2, x1: fx + fw, y1: fy2 + 22 });
    }
    x.restore();

    // Luminous celadon-jade bridge chevron connecting the selected left-panel item into the right-adjacent detail drawer
    if (itemRes.selMidY !== null && !P.vert && W >= 900) {
      x.save();
      const my = itemRes.selMidY;
      const rx = fx0 + fw0;
      x.globalAlpha = 0.96 * linesA;
      x.fillStyle = '#5eead4';
      x.shadowColor = 'rgba(94, 234, 212, 0.70)';
      x.shadowBlur = 10;
      x.beginPath();
      x.moveTo(rx - 1, my - 6);
      x.lineTo(rx + 5, my);
      x.lineTo(rx - 1, my + 6);
      x.closePath();
      x.fill();
      x.restore();
    }
  }

  function drawFeedItems(
    x: CanvasRenderingContext2D,
    fx: number,
    y: number,
    fw: number,
    yMax: number,
    P: StagePreset,
    f: ReturnType<typeof fieldData>,
    cards: any[],
    claims: any[],
    a: number,
  ): { y: number; selMidY: number | null } {
    const span = !f.fcast && (f.un < T0 || early(f.un));
    const TH_W = 46;
    const TH_H = 36;
    const lineH = 17;
    let selMidY: number | null = null;

    for (const e of cards) {
      const pic = unitPic(e);
      const hasPic = !!(pic && pic.atl && pic.atl.complete && pic.atl.naturalWidth);
      const tx = fx + (hasPic ? TH_W + 9 : 12);
      const tw = fw - (tx - fx);
      x.font = `500 ${P.card}px ${FONT_TEXT}`;
      const tl = wrapLines(x, e.title, tw, 2);
      const rowH = Math.max(hasPic ? TH_H + 6 : 0, tl.length * lineH + 17);
      if (y + rowH > yMax) break;

      const isHov = hov && hov.kind === 'feedEv' && hov.e.id === e.id;
      const isSel = state.sel === e.id;
      if (isSel) {
        selMidY = y - 2 + rowH * 0.5;
        x.save();
        x.globalAlpha = a;
        x.fillStyle = 'rgba(45, 212, 191, 0.13)';
        x.strokeStyle = 'rgba(94, 234, 212, 0.38)';
        x.lineWidth = 1;
        x.beginPath();
        if (x.roundRect) x.roundRect(fx - 5, y - 3, fw + 12, rowH + 1, 5);
        else x.rect(fx - 5, y - 3, fw + 12, rowH + 1);
        x.fill();
        x.stroke();
        x.fillStyle = '#5eead4';
        x.beginPath();
        if (x.roundRect) x.roundRect(fx + fw + 4.5, y + 1, 2.5, Math.max(10, rowH - 7), 1.5);
        else x.rect(fx + fw + 4.5, y + 1, 2.5, Math.max(10, rowH - 7));
        x.fill();
        x.restore();
      } else if (isHov) {
        x.fillStyle = 'rgba(94, 234, 212, 0.07)';
        x.globalAlpha = a;
        x.beginPath();
        if (x.roundRect) x.roundRect(fx - 5, y - 2, fw + 9, rowH - 1, 5);
        else x.rect(fx - 5, y - 2, fw + 9, rowH - 1);
        x.fill();
      }

      if (hasPic) {
        x.globalAlpha = 0.95 * a;
        drawPic(x, pic!, fx + TH_W / 2, y + TH_H / 2 + 2, TH_W, TH_H);
        x.strokeStyle = 'rgba(156,181,175,0.22)';
        x.lineWidth = 1;
        x.strokeRect(fx + 0.5, y + 2.5, TH_W - 1, TH_H - 1);
      } else {
        const dot = e.status
          ? STATUS_NIGHT[e.status] || heatOf(e.year)
          : heatOf(e.year);
        x.fillStyle = dot;
        x.globalAlpha = a;
        x.beginPath();
        x.arc(fx + 3.5, y + 9, e.moment ? 3.6 : 2.8, 0, Math.PI * 2);
        x.fill();
      }

      x.font = `500 ${P.card}px ${FONT_TEXT}`;
      x.fillStyle = INK;
      x.globalAlpha = 0.96 * a;
      let ly = y + 13;
      for (const ln of tl) {
        x.fillText(ln, tx, ly);
        ly += lineH;
      }

      const dm = DOMAIN[e.domain];
      const meta: string[] = [];
      if (span) meta.push(e.date ? fmtDate(e.date) : fmtYear(e.year));
      else if (e.date && e.date.length > 4) meta.push(fmtDate(e.date));
      if (dm) meta.push(dm.short || dm.label);
      if (e.who) meta.push(e.who);
      x.font = `400 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
      x.fillStyle = SOFT;
      x.globalAlpha = 0.72 * a;
      x.fillText(trimText(x, meta.join(' \u00b7 '), tw), tx, ly - 2);

      feedHits.push({ kind: 'feedEv', e, x0: fx - 4, y0: y - 2, x1: fx + fw + 4, y1: y + rowH });
      y += rowH + 4;
    }

    if (claims.length && y < yMax - 24) {
      if (!f.fcast && cards.length) {
        y += 3;
        x.strokeStyle = 'rgba(130,206,194,0.13)';
        x.lineWidth = 1;
        x.globalAlpha = a;
        x.beginPath();
        x.moveTo(fx, y + 0.5);
        x.lineTo(fx + fw, y + 0.5);
        x.stroke();
        y += 8;
      }
      for (const pr of claims) {
        const tx = fx + 12;
        const tw = fw - 12;
        const q = `\u201c${String(pr.claim || '').replace(/^[\u201c"]|[\u201d"]$/g, '')}\u201d`;
        x.font = `400 ${P.card}px ${FONT_TEXT}`;
        const tl = wrapLines(x, q, tw, 2);
        const rowH = tl.length * lineH + 17;
        if (y + rowH > yMax) break;

        const isHov = hov && hov.kind === 'feedClaim' && hov.pr.id === pr.id;
        const isPrSel = state.sel === pr.id;
        if (isPrSel) {
          selMidY = y - 2 + rowH * 0.5;
          x.save();
          x.globalAlpha = a;
          x.fillStyle = 'rgba(45, 212, 191, 0.13)';
          x.strokeStyle = 'rgba(94, 234, 212, 0.38)';
          x.lineWidth = 1;
          x.beginPath();
          if (x.roundRect) x.roundRect(fx - 5, y - 3, fw + 12, rowH + 1, 5);
          else x.rect(fx - 5, y - 3, fw + 12, rowH + 1);
          x.fill();
          x.stroke();
          x.fillStyle = '#5eead4';
          x.beginPath();
          if (x.roundRect) x.roundRect(fx + fw + 4.5, y + 1, 2.5, Math.max(10, rowH - 7), 1.5);
          else x.rect(fx + fw + 4.5, y + 1, 2.5, Math.max(10, rowH - 7));
          x.fill();
          x.restore();
        } else if (isHov) {
          x.fillStyle = 'rgba(94, 234, 212, 0.07)';
          x.globalAlpha = a;
          x.beginPath();
          if (x.roundRect) x.roundRect(fx - 5, y - 2, fw + 9, rowH - 1, 5);
          else x.rect(fx - 5, y - 2, fw + 9, rowH - 1);
          x.fill();
        }

        const vc = prColor(pr);
        x.strokeStyle = vc;
        x.lineWidth = 1.5;
        x.globalAlpha = a;
        x.beginPath();
        x.arc(fx + 3.5, y + 9, 3.1, 0, Math.PI * 2);
        x.stroke();

        x.font = `400 ${P.card}px ${FONT_TEXT}`;
        x.fillStyle = INK;
        x.globalAlpha = 0.94 * a;
        let ly = y + 13;
        for (const ln of tl) {
          x.fillText(ln, tx, ly);
          ly += lineH;
        }

        const vw = capW(prWord(pr));
        const tgt =
          pr.target_year != null
            ? f.fcast
              ? isZh()
                ? `目标 ${pr.target_year}年`
                : `for ${pr.target_year}`
              : `\u2192 ${pr.target_year}`
            : '';
        const who = [
          pr.by,
          pr.year_made != null
            ? f.fcast
              ? isZh()
                ? `${pr.year_made}年提出`
                : `said ${pr.year_made}`
              : fmtYear(pr.year_made)
            : '',
        ]
          .filter(Boolean)
          .join(isZh() ? ' · ' : ', ');
        x.font = `500 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
        x.fillStyle = vc;
        x.globalAlpha = 0.92 * a;
        const vwW = x.measureText(vw).width;
        x.fillText(vw, tx, ly - 2);
        x.font = `400 ${MIN_TEXT - 1}px ${FONT_TEXT}`;
        x.fillStyle = SOFT;
        x.globalAlpha = 0.72 * a;
        const rest = [tgt, who].filter(Boolean).join(' \u00b7 ');
        if (rest) {
          x.fillText(
            trimText(x, ' ' + rest, tw - vwW - 4),
            tx + vwW + 4,
            ly - 2,
          );
        }

        feedHits.push({
          kind: 'feedClaim',
          pr,
          x0: fx - 4,
          y0: y - 2,
          x1: fx + fw + 4,
          y1: y + rowH,
        });
        y += rowH + 4;
      }
    }
    return { y, selMidY };
  }

  const stripBox = () => {
    const pad = BAND.w < 520 ? 14 : 24;
    const x0 = pad;
    const x1 = W - pad;
    const y = BAND.stripY + BAND.stripH * 0.52;
    return { x0, x1, w: Math.max(1, x1 - x0), y };
  };
  const stripXOf = (yr: number) => {
    const b = stripBox();
    return b.x0 + u(clamp(yr, Y_LO, T1)) * b.w;
  };
  const stripYearAt = (sx: number) => {
    const b = stripBox();
    const f = clamp((sx - b.x0) / b.w, 0, 1);
    return yearOfSlotF(f * SPAN);
  };

  function drawStrip(x: CanvasRenderingContext2D, P: StagePreset) {
    const b = stripBox();
    const sy = BAND.stripY;
    x.fillStyle = 'rgba(5, 12, 14, 0.90)';
    x.globalAlpha = 1;
    x.fillRect(0, sy, W, BAND.stripH);
    x.strokeStyle = 'rgba(130, 206, 194, 0.16)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(0, sy + 0.5);
    x.lineTo(W, sy + 0.5);
    x.stroke();

    const rShare = R / SPAN;
    const rx1 = b.x0 + rShare * b.w;

    const maxR = Math.max(1, ...rootDensity);
    for (let k = 0; k < 40; k++) {
      const n = rootDensity[k];
      if (!n) continue;
      const f0 = (k * 10) / SPAN;
      const f1 = ((k + 1) * 10) / SPAN;
      const bx = b.x0 + f0 * b.w;
      const bw = Math.max(1, (f1 - f0) * b.w - 0.5);
      const bh = Math.max(2, Math.pow(n / maxR, 0.45) * 12);
      x.fillStyle = rootCol((k + 0.5) / 40);
      x.globalAlpha = 0.55;
      x.fillRect(bx, b.y - bh, bw, bh);
    }

    const maxD = Math.max(1, ...density);
    for (let k = 0; k <= 100; k++) {
      const n = density[k];
      if (!n) continue;
      const y0 = T0 + k * 10;
      const y1 = Math.min(T1, y0 + 10);
      const bx = b.x0 + u(y0) * b.w;
      const bw = Math.max(1, (u(y1) - u(y0)) * b.w - 0.4);
      const bh = Math.max(2, Math.pow(n / maxD, 0.42) * 14);
      x.fillStyle = heat((y0 - T0) / 1000);
      x.globalAlpha = 0.62;
      x.fillRect(bx, b.y - bh, bw, bh);
    }

    x.strokeStyle = 'rgba(156, 181, 175, 0.28)';
    x.lineWidth = 1;
    x.globalAlpha = 1;
    x.beginPath();
    x.moveTo(b.x0, b.y + 0.5);
    x.lineTo(b.x1, b.y + 0.5);
    x.stroke();

    x.strokeStyle = 'rgba(94, 234, 212, 0.42)';
    x.beginPath();
    x.moveTo(rx1 + 0.5, b.y - 6);
    x.lineTo(rx1 + 0.5, b.y + 6);
    x.stroke();

    x.font = `400 ${MIN_TEXT}px ${FONT_TEXT}`;
    x.textBaseline = 'top';
    x.fillStyle = SOFT;
    const ty = b.y + 4;
    if (P.vert) {
      x.globalAlpha = 0.72;
      x.textAlign = 'left';
      x.fillText(isZh() ? '前330万年' : '3.3M BCE', b.x0, ty);
      x.textAlign = 'center';
      if (rx1 - b.x0 > 84 && b.x1 - rx1 > 84) x.fillText('1026', rx1, ty);
      x.textAlign = 'right';
      x.fillText('2026', b.x1, ty);
    } else {
      x.globalAlpha = 0.68;
      let lastRight = -1e9;
      const putLbl = (lx: number, txt: string, align: CanvasTextAlign = 'center') => {
        const tw = x.measureText(txt).width;
        const left = align === 'left' ? lx : align === 'right' ? lx - tw : lx - tw / 2;
        if (left < lastRight + 10 || left + tw > b.x1 + 4) return;
        x.textAlign = align;
        x.fillText(txt, lx, ty);
        lastRight = left + tw;
      };
      putLbl(b.x0, isZh() ? '公元前330万年' : '3.3M BCE', 'left');
      for (const rt of rootTicks) {
        if (rt.y === -2000000) continue;
        putLbl(b.x0 + rt.f * rShare * b.w, rt.lbl);
      }
      putLbl(rx1, '1026');
      for (let yr = 1200; yr <= 1800; yr += 200) putLbl(stripXOf(yr), String(yr));
      x.textAlign = 'right';
      const w2026 = x.measureText('2026').width;
      if (b.x1 - w2026 > lastRight + 8) x.fillText('2026', b.x1, ty);
    }

    const cx = stripXOf(cam.year);
    const hc = heatOf(cam.year);
    x.globalAlpha = 1;
    x.strokeStyle = INK;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(cx, b.y - 14);
    x.lineTo(cx, b.y + 5);
    x.stroke();
    x.fillStyle = hc;
    x.beginPath();
    x.arc(cx, b.y - 14, 4.2, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = INK;
    x.lineWidth = 1.2;
    x.stroke();
    x.textAlign = 'left';
  }

  function hitAt(sx: number, sy: number) {
    if (sy >= BAND.stripY) return { kind: 'strip' };
    if (openRect && (openFcast || openUnit !== null)) {
      if (
        sx >= openRect.x &&
        sx <= openRect.x + openRect.w &&
        sy >= openRect.y &&
        sy <= openRect.y + openRect.h
      ) {
        return { kind: 'sheet' };
      }
    }
    for (let i = feedHits.length - 1; i >= 0; i--) {
      const h = feedHits[i];
      if (sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1) return h;
    }
    for (let i = satHits.length - 1; i >= 0; i--) {
      const h = satHits[i];
      if (sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1) {
        return { kind: 'sat', e: h.e };
      }
    }
    if (
      fcHead &&
      sx >= fcHead.x &&
      sx <= fcHead.x + fcHead.w &&
      sy >= fcHead.y &&
      sy <= fcHead.y + fcHead.h
    ) {
      return { kind: 'openFcast' };
    }
    for (let i = fcHits.length - 1; i >= 0; i--) {
      const fh = fcHits[i];
      if (sx >= fh.x0 && sx <= fh.x1 && sy >= fh.y0 && sy <= fh.y1) return fh;
    }
    for (let i = picHits.length - 1; i >= 0; i--) {
      const p = picHits[i];
      if (sx >= p.x0 && sx <= p.x1 && sy >= p.y0 && sy <= p.y1) {
        return {
          kind: 'pic',
          it: p.it,
          cx: p.cx,
          cy: p.cy,
          w: p.w,
          h: p.h,
        };
      }
    }
    let best: any = null;
    let bestScore = 1e9;
    for (let i = visCells.length - 1; i >= 0; i--) {
      const v = visCells[i];
      const dx = sx - v.cx;
      const dy = sy - v.cy;
      const dist = Math.hypot(dx, dy);
      const rad = Math.max(8, v.r);
      if (dist <= rad) {
        const sc = dist + v.d * 0.25;
        if (sc < bestScore) {
          bestScore = sc;
          best = v;
        }
      }
    }
    if (best) return { kind: 'cell', cell: best.cell, q: best.q };
    return null;
  }

  function travelTo(
    y: number,
    opts: { snap?: boolean; dur?: number; ease?: (t: number) => number } = {},
  ) {
    const t = clamp(y, Y_LO, T1);
    moveAt = performance.now();
    if (opts.snap || reduced()) {
      cam.year = t;
      cam.target = t;
      cam.v = 0;
      cam.fling = null;
      invalidate();
      return;
    }
    if (opts.dur) {
      cam.fling = {
        y0: cam.year,
        y1: t,
        t0: performance.now(),
        dur: opts.dur,
        ease: opts.ease || easeInOut,
      };
      cam.target = t;
      cam.v = 0;
      invalidate();
      return;
    }
    cam.fling = null;
    cam.target = t;
    invalidate();
  }

  function stepBy(notches: number) {
    let t = cam.fling ? cam.target : stopOf(cam.target);
    const n = Math.round(notches);
    const dir = n >= 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(n); i++) t = stepStop(t, dir);
    if (cam.pullT > 0.5) cam.pullT = 0;
    cam.fling = null;
    cam.target = t;
    moveAt = performance.now();
    invalidate();
  }

  function pullBack(on?: boolean) {
    cam.pullT = on === undefined ? (cam.pullT > 0.5 ? 0 : 1) : on ? 1 : 0;
    if (cam.pullT > 0.5) closeSheet();
    invalidate();
  }

  function stepPhysics(now: number) {
    const dt = clamp((now - lastT) / 1000, 0, 0.05);
    lastT = now;
    let moving = false;

    if (cam.fling) {
      const u2 = clamp((now - cam.fling.t0) / cam.fling.dur, 0, 1);
      const e = (cam.fling.ease || easeInOut)(u2);
      const prev = cam.year;
      cam.year = lerp(cam.fling.y0, cam.fling.y1, e);
      cam.v = dt > 1e-4 ? (cam.year - prev) / dt : 0;
      if (u2 >= 1) {
        cam.year = cam.fling.y1;
        cam.target = cam.fling.y1;
        cam.v = 0;
        cam.fling = null;
        settleAt = now;
      } else {
        moving = true;
      }
    } else {
      const isPhone = H > W || W < 720;
      const w = isPhone ? OMEGA_PHONE : OMEGA;
      const s0 = slf(cam.year);
      const s1 = slf(cam.target);
      const ds = s1 - s0;
      if (Math.abs(ds) > 1e-3 || Math.abs(cam.v) > 1e-2) {
        let sv = cam.v;
        const a = w * w * ds - 2 * w * sv;
        sv += a * dt;
        const maxS = (SPEED_MAX / 1000) * SPAN;
        sv = clamp(sv, -maxS, maxS);
        const sn = clamp(s0 + sv * dt, 0, SPAN);
        cam.v = sv;
        cam.year = yearOfSlotF(sn);
        if (Math.abs(s1 - sn) < 0.015 && Math.abs(sv) < 0.08) {
          cam.year = cam.target;
          cam.v = 0;
          settleAt = now;
        } else {
          moving = true;
        }
      }
    }

    if (Math.abs(cam.pull - cam.pullT) > 0.001) {
      cam.pull += (cam.pullT - cam.pull) * Math.min(1, dt * 9);
      if (Math.abs(cam.pull - cam.pullT) < 0.002) cam.pull = cam.pullT;
      moving = true;
    }

    if (!orbitDrag && (Math.abs(cam.azOff) > 0.02 || Math.abs(cam.elOff) > 0.02)) {
      const k = Math.min(1, dt * 6);
      cam.azOff *= 1 - k;
      cam.elOff *= 1 - k;
      if (Math.abs(cam.azOff) < 0.03) cam.azOff = 0;
      if (Math.abs(cam.elOff) < 0.03) cam.elOff = 0;
      moving = true;
    }

    const slotSpeed = Math.abs(cam.v);
    const bTarget = clamp(slotSpeed / BREATH_AT, 0, 1);
    const tau = bTarget > cam.breath ? BREATH_OUT_S : BREATH_HOME_S;
    if (Math.abs(bTarget - cam.breath) > 0.002) {
      cam.breath += (bTarget - cam.breath) * Math.min(1, dt / tau);
      moving = true;
    } else {
      cam.breath = bTarget;
    }

    const drTarget = !(H > W || W < 900) && state.sel ? 1 : 0;
    if (Math.abs(cam.drawer - drTarget) > 0.001) {
      cam.drawer += (drTarget - cam.drawer) * Math.min(1, dt * 9);
      if (Math.abs(cam.drawer - drTarget) < 0.002) cam.drawer = drTarget;
      moving = true;
    }

    void settleAt;
    void moveAt;
    return moving;
  }

  function resize() {
    const r = host.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width));
    const nh = Math.max(1, Math.round(r.height));
    const ndpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nw === W && nh === H && ndpr === DPR) return;
    W = nw;
    H = nh;
    DPR = ndpr;
    for (const c of [scene, over]) {
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    }
    const P = H > W || W < 720 ? VERT : DESK;
    BAND = bandOf(P);
    syncLayoutVars(P, BAND);
    gpu.setSize(W, H, DPR);
    sceneKey = '';
    unitDomKey = '';
  }

  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    resize();
    buildGeom();
    const moving = stepPhysics(now);
    const V = view();
    const uHand = V.pull > 0.5 ? 'p' : unitOf(cam.year);
    const key = `${W}x${H}x${DPR}:${slf(cam.year).toFixed(3)}:${V.pull.toFixed(3)}:${cam.drawer.toFixed(3)}:${cam.azOff.toFixed(2)}:${cam.elOff.toFixed(2)}:${cam.breath.toFixed(3)}:${uHand}:${shA.toFixed(2)}:${geomKey}:${gpu.ready ? 1 : 0}`;
    let sceneRepainted = false;
    if (key !== sceneKey) {
      sceneKey = key;
      paintScene(ctx, V);
      sceneRepainted = true;
    }
    drawOverlay(V, sceneRepainted);
    if (moving) invalidate();
  }

  function onWheel(ev: WheelEvent) {
    if (openRect && (openFcast || openUnit !== null)) {
      const r = host.getBoundingClientRect();
      const sx = ev.clientX - r.left;
      const sy = ev.clientY - r.top;
      if (
        sx >= openRect.x &&
        sx <= openRect.x + openRect.w &&
        sy >= openRect.y &&
        sy <= openRect.y + openRect.h
      ) {
        return;
      }
    }
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      pullBack(ev.deltaY > 0);
      return;
    }
    const now = performance.now();
    if (now - wheelT > 220) wheelAcc = 0;
    wheelT = now;
    const dy =
      ev.deltaMode === 1
        ? ev.deltaY * 36
        : ev.deltaMode === 2
          ? ev.deltaY * 360
          : ev.deltaY;
    wheelAcc += dy;
    const n = Math.trunc(wheelAcc / NOTCH_PX);
    if (n !== 0) {
      wheelAcc -= n * NOTCH_PX;
      stepBy(-n);
    } else if (Math.abs(dy) >= 40) {
      const sign = dy > 0 ? -1 : 1;
      wheelAcc = 0;
      stepBy(sign);
    }
  }

  function onPointerDown(ev: PointerEvent) {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    const r = host.getBoundingClientRect();
    const sx = ev.clientX - r.left;
    const sy = ev.clientY - r.top;
    if (openRect && (openFcast || openUnit !== null)) {
      if (
        sx >= openRect.x &&
        sx <= openRect.x + openRect.w &&
        sy >= openRect.y &&
        sy <= openRect.y + openRect.h
      ) {
        return;
      }
    }

    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, { x: sx, y: sy });
      if (touches.size === 2) {
        const pts = [...touches.values()];
        pinchD0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchPull0 = cam.pull;
        if (orbitDrag) orbitDrag.pinch = true;
        return;
      }
    }

    if (sy >= BAND.stripY) {
      stripDrag = true;
      if (cam.pullT > 0.5) cam.pullT = 0;
      scene.setPointerCapture?.(ev.pointerId);
      travelTo(stripYearAt(sx), { snap: true });
      return;
    }

    scene.focus({ preventScroll: true });
    scene.setPointerCapture?.(ev.pointerId);
    cam.fling = null;
    orbitDrag = {
      id: ev.pointerId,
      x0: sx,
      y0: sy,
      lx: sx,
      ly: sy,
      moved: false,
      az0: cam.azOff,
      el0: cam.elOff,
      yStart: cam.year,
      hist: [[performance.now(), slf(cam.year)]],
      pinch: false,
    };
  }

  function onPointerMove(ev: PointerEvent) {
    const r = host.getBoundingClientRect();
    const sx = ev.clientX - r.left;
    const sy = ev.clientY - r.top;

    if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) {
      touches.set(ev.pointerId, { x: sx, y: sy });
      if (touches.size === 2 && pinchD0 > 10) {
        const pts = [...touches.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const next = clamp(pinchPull0 + (pinchD0 - d) / 180, 0, 1);
        cam.pull = next;
        cam.pullT = next > 0.45 ? 1 : 0;
        invalidate();
        return;
      }
    }

    if (stripDrag) {
      travelTo(stripYearAt(sx), { snap: true });
      return;
    }

    if (orbitDrag && orbitDrag.id === ev.pointerId && !orbitDrag.pinch) {
      const dx = sx - orbitDrag.lx;
      const dy = sy - orbitDrag.ly;
      orbitDrag.lx = sx;
      orbitDrag.ly = sy;
      if (
        !orbitDrag.moved &&
        Math.hypot(sx - orbitDrag.x0, sy - orbitDrag.y0) > 5
      ) {
        orbitDrag.moved = true;
        tip.hide();
      }
      if (!orbitDrag.moved) return;

      const isVert = H > W || W < 720;
      if (ev.shiftKey) {
        cam.azOff = clamp(cam.azOff + dx * 0.22, -42, 42);
        cam.elOff = clamp(cam.elOff + dy * 0.18, -18, 28);
      } else {
        const delta = isVert ? dy * 0.24 : (-dx * YPP + dy * 0.12);
        const sNext = clamp(slf(cam.year) + delta, 0, SPAN);
        const yn = yearOfSlotF(sNext);
        cam.year = yn;
        cam.target = yn;
        cam.v = 0;
        if (!isVert) {
          cam.azOff = clamp(cam.azOff + dx * 0.04, -18, 18);
          cam.elOff = clamp(cam.elOff + dy * 0.04, -10, 14);
        }
        const now = performance.now();
        orbitDrag.hist.push([now, sNext]);
        while (orbitDrag.hist.length > 8 && now - orbitDrag.hist[0][0] > 120) {
          orbitDrag.hist.shift();
        }
      }
      invalidate();
      return;
    }

    if (ev.pointerType === 'touch') return;
    const h = hitAt(sx, sy);
    const prevKey = hov
      ? `${hov.kind}:${hov.cell?.e?.id || hov.it?.e?.id || hov.e?.id || hov.pr?.id || ''}`
      : '';
    const nextKey = h
      ? `${h.kind}:${h.cell?.e?.id || h.it?.e?.id || h.e?.id || h.pr?.id || ''}`
      : '';
    if (prevKey !== nextKey) {
      hov = h;
      scene.style.cursor =
        h && h.kind !== 'sheet'
          ? h.kind === 'strip'
            ? 'ew-resize'
            : 'pointer'
          : 'grab';
      if (h && (h.kind === 'cell' || h.kind === 'pic')) {
        const e = h.kind === 'cell' ? h.cell.e : h.it.e;
        const dm = DOMAIN[e.domain];
        tip.show(
          ev,
          `<span class="k">${esc(
            [e.date ? fmtDate(e.date) : fmtYear(e.year), dm ? dm.label : '']
              .filter(Boolean)
              .join(' \u00b7 '),
          )}</span><br><b>${esc(e.title)}</b>`,
        );
      } else if (h && h.kind === 'claim' && h.pr) {
        const pr = h.pr;
        const when =
          pr.target_year != null
            ? isZh()
              ? `${pr.year_made}年提出 · 目标 ${pr.target_year}年`
              : `${pr.year_made}, for ${pr.target_year}`
            : String(pr.year_made || '');
        tip.show(
          ev,
          `<span class="k">${esc(
            [pr.by || pr.who, when, prWord(pr)].filter(Boolean).join(' \u00b7 '),
          )}</span><br><b>${esc(pr.claim || '')}</b>`,
        );
      } else if (h && h.kind === 'openFcast' && fcastTotal > 0) {
        tip.show(
          ev,
          `<div class="h">${
            isZh()
              ? `查看全部 ${fcastTotal} 条远景预测（${fcastVoices} 位学者）`
              : `All ${fcastTotal} dated forecasts (${fcastVoices} voices)`
          }</div>`,
        );
      } else {
        tip.hide();
      }
      invalidate();
    } else if (
      h &&
      (h.kind === 'cell' || h.kind === 'pic' || h.kind === 'claim' || h.kind === 'openFcast')
    ) {
      tip.move(ev);
    }
  }

  function onPointerUp(ev: PointerEvent) {
    touches.delete(ev.pointerId);
    if (touches.size < 2) pinchD0 = 0;

    if (stripDrag) {
      stripDrag = false;
      cam.target = nearestStop(cam.year);
      invalidate();
      return;
    }

    if (!orbitDrag || orbitDrag.id !== ev.pointerId) return;
    const d = orbitDrag;
    orbitDrag = null;

    if (d.pinch) {
      invalidate();
      return;
    }

    if (!d.moved) {
      const r = host.getBoundingClientRect();
      const sx = ev.clientX - r.left;
      const sy = ev.clientY - r.top;
      const h = hitAt(sx, sy);
      if (!h) {
        if (state.sel) {
          selectRecord('');
          invalidate();
          return;
        }
        if (shOpen) {
          closeSheet();
          invalidate();
        }
        return;
      }
      if (h.kind === 'openUnit') {
        openFcast = false;
        openUnit = h.un;
        openFilter = null;
        openScroll = 0;
        shOpen = true;
        unitDomKey = '';
        if (V_LAST) renderUnitDom(V_LAST);
        invalidate();
        return;
      }
      if (h.kind === 'openFcast') {
        openFcast = true;
        openUnit = null;
        openFilter = null;
        openScroll = 0;
        shOpen = true;
        unitDomKey = '';
        if (V_LAST) renderUnitDom(V_LAST);
        invalidate();
        return;
      }
      if (
        h.kind === 'cell' ||
        h.kind === 'pic' ||
        h.kind === 'feedEv' ||
        h.kind === 'sat'
      ) {
        const e =
          h.kind === 'cell'
            ? h.cell.e
            : h.kind === 'pic'
              ? h.it.e
              : h.e;
        tip.hide();
        selectRecord(e.id);
        invalidate();
        return;
      }
      if (h.kind === 'feedClaim' || h.kind === 'claim') {
        tip.hide();
        selectRecord(h.pr.id);
        invalidate();
        return;
      }
      return;
    }

    const hist = d.hist;
    const now = performance.now();
    if (hist.length >= 2 && now - hist[0][0] > 12) {
      const [t0, s0] = hist[0];
      const [t1, s1] = hist[hist.length - 1];
      const dt = (t1 - t0) / 1000;
      const sv = dt > 0.008 ? (s1 - s0) / dt : 0;
      const isPhone = H > W || W < 720;
      if (Math.abs(sv) > 18) {
        const reach = clamp(s1 + sv * (isPhone ? COAST_TAU : 0.36), 0, SPAN);
        const yStop = nearestStop(yearOfSlotF(reach));
        travelTo(yStop, {
          dur: isPhone ? COAST_MS : FLING_MS,
          ease: isPhone ? coast : easeOut,
        });
        return;
      }
    }
    travelTo(nearestStop(cam.year));
  }

  function onKey(ev: KeyboardEvent) {
    if (
      ev.target &&
      (ev.target as HTMLElement).matches?.('input, textarea, select, [contenteditable]')
    ) {
      return;
    }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      stepBy(-1);
    } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      stepBy(1);
    } else if (ev.key === 'PageDown') {
      ev.preventDefault();
      stepBy(-5);
    } else if (ev.key === 'PageUp') {
      ev.preventDefault();
      stepBy(5);
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      travelTo(Y_LO, { dur: RIDE_MS });
    } else if (ev.key === 'End') {
      ev.preventDefault();
      travelTo(T1, { dur: RIDE_MS });
    } else if (ev.key === '0' || ev.key === 'o' || ev.key === 'O') {
      ev.preventDefault();
      pullBack();
    } else if (ev.key === '-' || ev.key === '_') {
      ev.preventDefault();
      pullBack(true);
    } else if (ev.key === '+' || ev.key === '=') {
      ev.preventDefault();
      pullBack(false);
    } else if (ev.key === 'Enter' && !openFcast && openUnit === null) {
      ev.preventDefault();
      openFcast = false;
      openUnit = unitOf(cam.year);
      openFilter = null;
      openScroll = 0;
      shOpen = true;
      unitDomKey = '';
      invalidate();
    } else if (ev.key === 'Escape' && (openFcast || openUnit !== null)) {
      ev.preventDefault();
      closeSheet();
      invalidate();
    }
  }

  let awaitingArrival = false;
  let textA = 1;
  let landingRaf = 0;
  let tookInput = false;

  const markUserInput = () => {
    tookInput = true;
  };

  scene.addEventListener('wheel', (ev) => {
    markUserInput();
    onWheel(ev);
  }, { passive: false });
  scene.addEventListener('pointerdown', (ev) => {
    markUserInput();
    onPointerDown(ev);
  });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  scene.addEventListener('pointerleave', () => {
    if (!orbitDrag && hov) {
      hov = null;
      tip.hide();
      invalidate();
    }
  });
  scene.addEventListener('dblclick', (ev) => {
    const r = host.getBoundingClientRect();
    const h = hitAt(ev.clientX - r.left, ev.clientY - r.top);
    if (!h) pullBack();
  });
  scene.addEventListener('keydown', onKey);

  const ro = new ResizeObserver(() => {
    resize();
    invalidate();
  });
  ro.observe(host);

  const offData = onData((name?: string) => {
    if (name === 'text') ensureMomentPics();
    recKey = '';
    geomKey = '';
    sceneKey = '';
    unitDomKey = '';
    invalidate();
  });
  const offLang = onLangChange(() => {
    recKey = '';
    geomKey = '';
    sceneKey = '';
    unitDomKey = '';
    if (V_LAST) renderUnitDom(V_LAST);
    invalidate();
  });

  if (!db.loaded.has('past')) ensure('past');
  if (!db.predictions || !db.predictions.length) ensure('predictions');
  ensurePictures();
  for (const k of ['cards', 'centuries', 'diffusion', 'markers', 'highlights', 'forecasts']) {
    if (!db.loaded.has(k)) ensure(k);
  }
  if (!db.loaded.has('text')) ensure('text');
  else ensureMomentPics();

  const hp = hashParams();
  const fyRaw = hp.get('fy') || hp.get('at') || state.at || '';
  const fy = parseFloat(fyRaw);
  if (Number.isFinite(fy)) {
    cam.year = cam.target = clamp(Math.round(fy), Y_LO, T1);
  }
  if (POSTER) {
    if (Number.isFinite(POSTER.year)) {
      cam.year = cam.target = clamp(POSTER.year, Y_LO, T1);
    }
    if (POSTER.lift) cam.pull = cam.pullT = clamp(POSTER.lift, 0, 1);
  }

  if (typeof window !== 'undefined' && (window as any).__ARRIVAL && !hp.get('born')) {
    awaitingArrival = true;
    if (!reduced() || POSTER) {
      cam.year = cam.target = POSTER && Number.isFinite(POSTER.year) ? POSTER.year : T1 - 3;
      cam.pull = cam.pullT = 0.06;
      textA = 0;
      over.style.opacity = '0';
    }
  }

  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load(`400 20px ${FONT_DISPLAY}`),
      document.fonts.load(`italic 400 20px ${FONT_DISPLAY}`),
      document.fonts.load(`400 14px ${FONT_TEXT}`),
      document.fonts.load(`500 14px ${FONT_TEXT}`),
    ])
      .then(() => {
        sceneKey = '';
        invalidate();
      })
      .catch(() => {});
  }

  function computeArrivalTargets(forceStill = false) {
    resize();
    buildGeom();
    if (!db.loaded.has('past') || !cells.length) return { ok: false };
    const rect = scene.getBoundingClientRect();
    if (rect.width < 10) return { ok: false };

    let V: ViewState;
    if (forceStill) {
      const saved = { ...cam };
      cam.year = T1;
      cam.target = T1;
      cam.pull = 0;
      cam.azOff = 0;
      cam.elOff = 0;
      cam.breath = 0;
      V = view();
      cam = saved;
    } else {
      V = view();
    }

    const evs = db.events || [];
    const dots = new Float32Array(evs.length * 2);
    dots.fill(NaN);
    const picAt = new Float32Array(evs.length * 2);
    picAt.fill(NaN);

    const idxById = new Map<string, number>();
    evs.forEach((e, i) => idxById.set(e.id, i));

    for (const c of cells) {
      const idx = idxById.get(c.e.id);
      if (idx === undefined) continue;
      const p = projR(V, c.c[0], c.c[1], c.c[2]);
      if (p.d) {
        dots[idx * 2] = p.sx + rect.left;
        dots[idx * 2 + 1] = p.sy + rect.top;
      }
    }
    for (const pb of decPics.values()) {
      for (const it of pb) {
        const idx = idxById.get(it.e.id);
        if (idx === undefined) continue;
        const p = projR(V, it.p[0], it.p[1], it.p[2]);
        if (p.d) {
          picAt[idx * 2] = p.sx + rect.left;
          picAt[idx * 2 + 1] = p.sy + rect.top;
        }
      }
    }
    for (const it of rootPics) {
      const idx = idxById.get(it.e.id);
      if (idx === undefined) continue;
      const p = projR(V, it.p[0], it.p[1], it.p[2]);
      if (p.d) {
        picAt[idx * 2] = p.sx + rect.left;
        picAt[idx * 2 + 1] = p.sy + rect.top;
      }
    }

    if (POSTER && !forceStill) {
      const yb = (POSTER.year || T1) + 40 + (POSTER.ahead || 0);
      const xa = ((yb - T1) / 100) * PITCH;
      const c = projR(V, xa, 0, 0);
      if (!c.d) return { ok: false };
      const cx = c.sx;
      const cy = c.sy;
      let Rpx = 0;
      let m = 0;
      for (const [ry, rz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const e = projR(V, xa, ry, rz);
        if (e.d) {
          Rpx += Math.hypot(e.sx - cx, e.sy - cy);
          m++;
        }
      }
      Rpx = m ? Rpx / m : Math.min(W, H) * 0.3;
      return {
        ok: true,
        dots,
        picAt,
        cx: cx + rect.left,
        cy: cy + rect.top - (POSTER.rise || 0) * Rpx,
        R: Rpx,
        pic: 12,
      };
    }

    const c0 = projR(V, 0, 0, 0);
    const cx = c0.d ? c0.sx : V.ox;
    const cy = c0.d ? c0.sy : V.oy;
    const o = new Float32Array(3);
    coilY(cam.year, 0, 0, o, 0);
    const ce = projR(V, o[0], o[1], o[2]);
    const loopR = ce.d ? Math.hypot(ce.sx - cx, ce.sy - cy) : Math.min(W, H) * 0.3;
    return {
      ok: true,
      dots,
      picAt,
      cx: cx + rect.left,
      cy: cy + rect.top,
      R: loopR,
      pic: 12,
    };
  }

  function stillFrame() {
    return computeArrivalTargets(true);
  }

  const hooks: HelixHooks = {
    arrivalTargets: () => computeArrivalTargets(false),
    arrivalReady: () =>
      !!(
        W > 10 &&
        db.loaded.has('past') &&
        cells.length > 0 &&
        (picState === 2 || picState === -1)
      ),
    onReveal() {
      if (!awaitingArrival) return;
      if (reduced()) {
        textA = 1;
        over.style.opacity = '';
        invalidate();
        return;
      }
      const phone = H > W;
      const t0 = performance.now();
      const DUR = phone ? 520 : 700;
      if (phone && !tookInput) {
        cam.pullT = 0;
        travelTo(T1, { dur: 520 });
      }
      const tick = () => {
        if (!alive) return;
        const k = clamp((performance.now() - t0) / DUR, 0, 1);
        textA = k;
        over.style.opacity = k < 0.999 ? k.toFixed(3) : '';
        if (k < 1) {
          landingRaf = requestAnimationFrame(tick);
        } else {
          landingRaf = 0;
          textA = 1;
          over.style.opacity = '';
          invalidate();
        }
      };
      landingRaf = requestAnimationFrame(tick);
    },
    afterArrival() {
      if (!awaitingArrival) return;
      awaitingArrival = false;
      textA = 1;
      over.style.opacity = '';
      if (reduced() || tookInput) {
        cam.pull = cam.pullT = 0;
        sceneKey = '';
        invalidate();
      } else {
        cam.pullT = 0;
        travelTo(T1, { dur: SETTLE_MS });
      }
      try {
        const p = hashParams();
        if (!p.get('v')) p.set('v', 'spiral');
        p.set('born', '1');
        const h = '#' + p.toString().replace(/%2C/g, ',');
        if (h !== location.hash) history.replaceState(null, '', h);
      } catch {
        /* ignore */
      }
    },
  };
  activeHooks = hooks;

  function applyState(s: typeof state, ch?: Set<string>) {
    if (ch && ch.has('domains')) {
      geomKey = '';
      recKey = '';
      unitDomKey = '';
    }
    if (ch && ch.has('at') && s.at) {
      const y = +s.at;
      if (Number.isFinite(y)) {
        const span = Math.abs(slf(y) - slf(cam.year));
        travelTo(y, { dur: span > 120 ? RIDE_MS : SETTLE_MS });
      }
    }
    if (ch && ch.has('sel') && s.sel) {
      const e = db.byId && db.byId.get(s.sel);
      const pr = !e && ((db.predById && db.predById.get(s.sel)) || (db.predictions || []).find((p) => p.id === s.sel));
      const fc = !e && !pr && db.forecastById ? db.forecastById.get(s.sel) : null;
      const yr = e ? e.year : pr ? pr.year_made : fc ? fc.y0 : null;
      if (yr != null && Number.isFinite(yr)) {
        if (cam.pullT > 0.5) cam.pullT = 0;
        const span = Math.abs(slf(yr) - slf(cam.year));
        if (span > 18) {
          travelTo(yr, { dur: span > 140 ? RIDE_MS : SETTLE_MS });
        }
      }
    }
    sceneKey = '';
    invalidate();
  }

  function cleanup() {
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    if (landingRaf) cancelAnimationFrame(landingRaf);
    ro.disconnect();
    offData();
    offLang();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    scene.removeEventListener('keydown', onKey);
    delete document.documentElement.dataset.hxLayout;
    gpu.dispose();
    if (activeHooks === hooks) activeHooks = null;
    if (window.__helix === debugApi) delete window.__helix;
  }

  const api = {
    render: applyState,
    update: applyState,
    resize() {
      resize();
      invalidate();
    },
    hover(id: string | null) {
      if (!id) {
        if (hov) {
          hov = null;
          invalidate();
        }
        return;
      }
      const hit = visCells.find((vc) => vc.cell.e.id === id);
      if (hit) {
        hov = { kind: 'cell', cell: hit.cell, q: hit.q };
      } else {
        const ev = db.byId.get(id);
        hov = ev ? { kind: 'feedEv', e: ev } : null;
      }
      invalidate();
    },
    onData(name: string) {
      if (name === 'text') ensureMomentPics();
      geomKey = '';
      sceneKey = '';
      unitDomKey = '';
      invalidate();
    },
    teardown: cleanup,
    destroy: cleanup,
  };

  const debugApi = {
    get year() {
      return cam.year;
    },
    get target() {
      return cam.target;
    },
    get pull() {
      return cam.pull;
    },
    get cellsCount() {
      return cells.length;
    },
    get visCellsCount() {
      return visCells.length;
    },
    get picHitsCount() {
      return picHits.length;
    },
    get gpuReady() {
      return gpu.ready;
    },
    arrivalReady: hooks.arrivalReady,
    arrivalTargets: hooks.arrivalTargets,
    travelTo,
    stepBy,
    pullBack,
    stillFrame,
    openUnitSheet(un: number) {
      openFcast = false;
      openUnit = un;
      openFilter = null;
      openScroll = 0;
      shOpen = true;
      unitDomKey = '';
      if (V_LAST) renderUnitDom(V_LAST);
      invalidate();
    },
    openForecasts() {
      openFcast = true;
      openUnit = null;
      openFilter = null;
      openScroll = 0;
      shOpen = true;
      unitDomKey = '';
      if (V_LAST) renderUnitDom(V_LAST);
      invalidate();
    },
    closeSheet: () => {
      closeSheet();
      invalidate();
    },
  };
  window.__helix = debugApi;

  void openEvidence;
  void shDrag;
  void openMaxScroll;
  void SETTLE_MS;
  void GLIDE_END_MS;
  void QUICK_MS;
  void STATUS_RANK;

  invalidate();
  return api;
}

export { helix as mount };
