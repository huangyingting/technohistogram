import { DOMAINS } from './palette';
import { YEAR_MIN, YEAR_MAX } from './time';
import { isZh } from './i18n';

export { YEAR_MIN, YEAR_MAX } from './time';

export interface TabDef {
  id: string;
  readonly label: string;
  readonly sub?: string;
  view: string;
}

export interface ViewDef {
  id: string;
  tab: string;
  readonly label: string;
  readonly sh: string;
  module: string;
  budget: number;
  screens?: string[];
  mount?: string;
  nav?: boolean;
}

export const TABS: TabDef[] = [
  {
    id: 'map',
    get label() {
      return isZh() ? '螺旋长卷' : 'Histomap';
    },
    get sub() {
      return isZh() ? '1026 至 2026 · 远溯八脉根系' : '1026 to 2026, with roots';
    },
    view: 'spiral',
  },
];

export const VIEWS: ViewDef[] = [
  {
    id: 'spiral',
    tab: 'map',
    get label() {
      return isZh() ? '科技长卷' : 'The Histomap';
    },
    get sh() {
      return isZh() ? '长卷' : 'Histomap';
    },
    module: 'helix',
    budget: 1,
  },
];

export const PLATES = ['anatomy', 'strata', 'genealogy', 'capital', 'benchmarks', 'policy', 'lineage'];
export const VIEW: Record<string, ViewDef> = Object.fromEntries(VIEWS.map((v) => [v.id, v]));
export const TAB: Record<string, TabDef> = Object.fromEntries(TABS.map((t) => [t.id, t]));

const RETIRED = [
  'now', 'anatomy', 'money', 'models', 'rules', 'stream', 'centuries', 'threads', 'findings', 'adoption', 'wheel', 'arcs',
  'millennium', 'decade', 'regions', 'shadows', 'first', 'year', 'beat',
  'today', 'moment', 'capital', 'strata', 'genealogy', 'benchmarks', 'lineage', 'talent', 'policy', 'columns', 'patterns', 'diffusion',
  'matrix', 'rates', 'impact', 'play', 'past', 'history', 'games',
  'beliefs', 'ideas', 'ideahorizons', 'speed', 'ai', 'forecasts', 'aiforecasts', 'predictions', 'right', 'horizon', 'ledger',
];

export const VIEW_ALIAS: Record<string, string> = {
  ...Object.fromEntries(RETIRED.map((id) => [id, 'spiral'])),
  ...Object.fromEntries(
    TABS.filter((t) => !VIEWS.some((v) => v.id === t.id)).map((t) => [t.id, VIEWS.find((v) => v.tab === t.id)!.id]),
  ),
};

export const ALIAS_SCREEN: Record<string, number> = {};
export const viewOf = (id: string): ViewDef => VIEW[VIEW_ALIAS[id] || id] || VIEW.spiral;
export const resolveView = (id: string): string | null =>
  VIEW[id] ? id : VIEW_ALIAS[id] && VIEW[VIEW_ALIAS[id]] ? VIEW_ALIAS[id] : null;
export const tabOf = (id: string): string => viewOf(id).tab;

export const screenModule = (id: string, screen = 1): string => {
  const v = viewOf(id);
  const m = v.screens ? v.screens[Math.min(Math.max(1, screen), v.screens.length) - 1] : v.module || v.id;
  return m.split(':')[0];
};
export const screenPlate = (id: string, screen = 1): string | null => {
  const v = viewOf(id);
  const m = v.screens ? v.screens[Math.min(Math.max(1, screen), v.screens.length) - 1] : v.module || v.id;
  return m.includes(':') ? m.split(':')[1] : null;
};
export const screensOf = (id: string): number => {
  const v = viewOf(id);
  return v.screens ? v.screens.length : v.budget || 1;
};
export const moduleOf = (id: string, screen?: number): string => screenModule(id, screen);
export const mountOf = (id: string, screen = 1): string => {
  const v = viewOf(id);
  const m = screenModule(id, screen);
  if (m === 'today') return 'today';
  if (v.mount) return v.mount;
  return v.screens ? `${v.id}:${m}` : v.id;
};

export interface AppState {
  view: string;
  y0: number;
  y1: number;
  domains: Set<string>;
  types: Set<string> | null;
  thread: string;
  q: string;
  sel: string;
  mode: string;
  tour: string;
  step: number;
  at: string;
  screen: number;
  issue: string;
}

const defaults = (): AppState => ({
  view: 'spiral',
  y0: YEAR_MIN,
  y1: YEAR_MAX,
  domains: new Set(DOMAINS.map((d) => d.id)),
  types: null,
  thread: '',
  q: '',
  sel: '',
  mode: '',
  tour: '',
  step: 0,
  at: '',
  screen: 1,
  issue: '',
});

type Listener = (s: AppState, ch: Set<string>) => void;
const listeners = new Set<Listener>();
export const state: AppState = defaults();
let hover: string | null = null;
const hoverListeners = new Set<(id: string | null) => void>();

export function subscribe(fn: Listener): () => boolean {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onHover(fn: (id: string | null) => void): () => boolean {
  hoverListeners.add(fn);
  return () => hoverListeners.delete(fn);
}

export function getHover(): string | null {
  return hover;
}

export function setHover(id: string | null): void {
  if (id === hover) return;
  hover = id;
  hoverListeners.forEach((f) => f(hover));
}

let pending: number | null = null;
let changedKeys = new Set<string>();

export function set(patch: Partial<AppState>, { replace = false } = {}): void {
  let any = false;
  if (patch.view && VIEW_ALIAS[patch.view] && !VIEW[patch.view]) {
    patch = {
      ...patch,
      view: VIEW_ALIAS[patch.view],
      ...(ALIAS_SCREEN[patch.view] && !('screen' in patch) ? { screen: ALIAS_SCREEN[patch.view] } : {}),
    };
  } else if (patch.view && !VIEW[patch.view]) {
    patch = { ...patch, view: 'spiral' };
  }
  if (patch.view && patch.view !== 'rules' && state.issue && !('issue' in patch)) patch = { ...patch, issue: '' };
  if (patch.view && patch.view !== state.view && !('screen' in patch)) patch = { ...patch, screen: 1 };

  for (const [k, v] of Object.entries(patch) as [keyof AppState, any][]) {
    const cur = state[k];
    const same =
      cur instanceof Set && v instanceof Set
        ? cur.size === v.size && [...v].every((x) => cur.has(x))
        : cur === v;
    if (!same) {
      (state as any)[k] = v;
      changedKeys.add(k);
      any = true;
    }
  }
  if (!any || typeof window === 'undefined') return;
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    const ch = changedKeys;
    changedKeys = new Set();
    writeHash(replace || !(ch.has('view') || ch.has('sel')), ch);
    listeners.forEach((f) => f(state, ch));
  });
}

export const SPIRAL_KEYS = ['born', 'fy', 'z'];

function writeHash(replace: boolean, ch = new Set<string>()): void {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams();
  p.set('v', state.view);
  if (state.y0 !== YEAR_MIN || state.y1 !== YEAR_MAX) p.set('y', `${state.y0}-${state.y1}`);
  if (state.domains.size !== DOMAINS.length) p.set('d', [...state.domains].join(','));
  if (state.types) p.set('t', [...state.types].join(','));
  if (state.thread) p.set('th', state.thread);
  if (state.q) p.set('q', state.q);
  if (state.sel) p.set('e', state.sel);
  if (state.mode) p.set('m', state.mode);
  if (state.tour) p.set('tr', `${state.tour}.${state.step + 1}`);
  if (state.at) p.set('at', state.at);
  if (state.screen > 1) p.set('s', String(state.screen));
  if (state.view === 'rules' && !ch.has('issue')) {
    state.issue = (hashParams().get('issue') || '').replace(/[^a-zA-Z0-9_-]/g, '');
  }
  if (state.issue) p.set('issue', state.issue);
  if (state.view === 'spiral') {
    const hp = hashParams();
    for (const k of SPIRAL_KEYS) {
      const val = hp.get(k);
      if (val) p.set(k, val);
    }
  }
  const h = '#' + p.toString().replace(/%2C/g, ',');
  if (h === location.hash) return;
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
}

const PAGE_WORDS: Record<string, string> = {
  map: 'map',
  histomap: 'map',
  spiral: 'map',
  history: 'map',
  past: 'map',
  impact: 'map',
  play: 'map',
  ai: 'ai',
  today: 'ai',
  ledger: 'ledger',
};

export function hashParams(hash?: string): URLSearchParams {
  try {
    const raw = hash !== undefined ? hash : typeof location !== 'undefined' ? location.hash : '';
    const h = String(raw || '').replace(/^#/, '');
    if (!h.includes('=')) {
      const segs = h
        .replace(/^!?\/+/, '')
        .split(/[\/&?]+/)
        .map((x) => decodeURIComponent(x).trim().toLowerCase())
        .filter(Boolean);
      const p = new URLSearchParams();
      let v: string | null = null;
      for (const g of segs) {
        if (VIEWS.some((x) => x.id === g) || VIEW_ALIAS[g]) v = VIEW_ALIAS[g] || g;
        else if (PAGE_WORDS[g] && !v) {
          const t = TABS.find((x) => x.id === PAGE_WORDS[g]);
          if (t) v = t.view;
        } else if (/^[1-9]$/.test(g) && v) p.set('s', g);
      }
      if (v) p.set('v', v);
      return p;
    }
    return new URLSearchParams(h);
  } catch {
    return new URLSearchParams();
  }
}

export const pathLikeHash = (hash?: string): boolean => {
  const raw = hash !== undefined ? hash : typeof location !== 'undefined' ? location.hash : '';
  const h = String(raw || '').replace(/^#/, '');
  return h.length > 0 && !h.includes('=');
};

export function readHash(): AppState {
  const p = hashParams();
  const s = defaults();
  const v = p.get('v');
  if (v && (VIEWS.some((x) => x.id === v) || VIEW_ALIAS[v])) s.view = VIEW_ALIAS[v] || v;
  const y = p.get('y');
  if (y) {
    const [a, b] = y.split('-').map(Number);
    if (a >= YEAR_MIN && b <= YEAR_MAX && a < b) {
      s.y0 = a;
      s.y1 = b;
    }
  }
  if (p.get('d')) s.domains = new Set(p.get('d')!.split(',').filter(Boolean));
  if (p.get('t')) s.types = new Set(p.get('t')!.split(',').filter(Boolean));
  s.thread = p.get('th') || '';
  s.q = p.get('q') || '';
  s.sel = p.get('e') || '';
  s.mode = p.get('m') || '';
  const tr = (p.get('tr') || '').match(/^([a-z0-9-]+)\.(\d+)$/);
  if (tr) {
    s.tour = tr[1];
    s.step = Math.max(0, +tr[2] - 1);
  }
  s.at = (p.get('at') || '').replace(/[^a-zA-Z0-9_:.-]/g, '');
  const rawV = p.get('v') || '';
  s.screen = Math.max(1, parseInt(p.get('s') || '', 10) || ALIAS_SCREEN[rawV] || 1);
  s.issue = (p.get('issue') || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return s;
}

export const canonHash = (): void => writeHash(true);

export function applyHash(): void {
  const s = readHash();
  const ch = new Set<string>();
  for (const k of Object.keys(s) as (keyof AppState)[]) {
    const a = state[k];
    const b = s[k];
    const same =
      a instanceof Set && b instanceof Set
        ? a.size === b.size && [...b].every((x) => a.has(x))
        : a === b;
    if (!same) {
      (state as any)[k] = b;
      ch.add(k);
    }
  }
  if (ch.size) listeners.forEach((f) => f(state, ch));
  const raw = hashParams().get('v');
  if ((raw !== null && raw !== state.view) || pathLikeHash()) writeHash(true);
}

export const need = (names: string[]) => import('./data').then((m) => m.need(names));

export function initStoreHash(): void {
  if (typeof window === 'undefined') return;
  try {
    if (pathLikeHash()) {
      const p = hashParams();
      if (!p.get('v')) p.set('v', 'spiral');
      history.replaceState(null, '', '#' + p.toString());
    }
  } catch {
    /* ignore */
  }
}

initStoreHash();
