import * as d3Module from 'd3';
import { fmtYear } from './time';
import { state, viewOf, hashParams, AppState } from './store';

export interface HistomapDB {
  events: any[];
  byId: Map<string, any>;
  in: Map<string, string[]>;
  tags: { tag: string; n: number }[];
  series: any[];
  models: any;
  modelList?: any[];
  modelById?: Map<string, any>;
  anatomyMap: Map<string, any> | null;
  tours: any[];
  rhymes: any[];
  flows: any;
  flowList?: any[];
  dealById?: Map<string, any>;
  predictions: any[];
  predById: Map<string, any>;
  forecasts?: any[];
  forecastById?: Map<string, any>;
  decadeCards?: Map<number, any>;
  centuryLines?: Map<number, any>;
  highlights?: Map<string, any>;
  diffusion?: any[];
  markers?: any[];
  benchmarks: any[];
  benchMethod?: any;
  benchById: Map<string, any>;
  talent: any;
  moves?: any[];
  personById: Map<string, any>;
  orgById: Map<string, any>;
  policy: any[];
  policyById: Map<string, any>;
  patterns: any[];
  impact: any;
  links: any;
  manifest?: any;
  missing: Set<string>;
  loaded: Set<string>;
  complete?: boolean;
  metaApplied?: boolean;
  _textJson?: any;
  _metaJson?: any;
  pointById?: Map<string, { kicker: string; html: string }>;
}

export const db: HistomapDB = {
  events: [],
  byId: new Map(),
  in: new Map(),
  tags: [],
  series: [],
  models: null,
  anatomyMap: null,
  tours: [],
  rhymes: [],
  flows: null,
  predictions: [],
  predById: new Map(),
  benchmarks: [],
  benchById: new Map(),
  talent: null,
  personById: new Map(),
  orgById: new Map(),
  policy: [],
  policyById: new Map(),
  patterns: [],
  impact: null,
  links: null,
  missing: new Set(),
  loaded: new Set(),
};

export const ym = (d: string | number | null | undefined): number | null => {
  if (!d) return null;
  const [y, m, dd] = String(d).split('-').map(Number);
  if (!y) return null;
  return y + ((m || 6.5) - 1 + (m ? ((dd || 15) - 0.5) / 31 : 0.5)) / 12;
};

let VER = '';
const vurl = (path: string) => `/data/${path}${VER ? `?v=${VER}` : ''}`;

const RETRY_MS = 700;
async function getJSON(url: string, fallback: any): Promise<any> {
  const relUrl = url.replace(/^\//, '');
  const pre =
    typeof window !== 'undefined' &&
    window.__pre &&
    (window.__pre[url] || window.__pre[relUrl]);
  if (pre && window.__pre) {
    delete window.__pre[url];
    delete window.__pre[relUrl];
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await (attempt === 0 && pre ? pre : fetch(url));
      if (r.ok) return await r.json();
    } catch {
      /* retry */
    }
    if (attempt === 0) await new Promise((res) => setTimeout(res, RETRY_MS));
  }
  db.missing.add(url.replace(/^\/?data\//, '').replace(/\?.*$/, ''));
  if (typeof dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    dispatchEvent(new CustomEvent('histomap:partial', { detail: url }));
  }
  return fallback;
}

export const bytes = { first: 0, later: 0 };

const listeners = new Set<(name: string) => void>();
export const onData = (fn: (name: string) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (name: string) => {
  for (const fn of listeners) fn(name);
};

export const host = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

function applyBench(bench: any) {
  db.benchmarks = ((bench && bench.benchmarks) || []).map((b: any) => ({
    ...b,
    key: b.id,
    id: 'bench:' + b.id,
    t0: ym(b.introduced),
    ts: ym(b.saturated_date),
    points: b.points.map((p: any, i: number) => ({
      ...p,
      t: Math.max(ym(p.date) || 0, ym(b.introduced) || 0),
      i,
      id: `bench:${b.id}:${i}`,
    })),
    _txt: [b.name, b.creator, b.metric, ...b.points.map((p: any) => p.model + ' ' + p.org)]
      .join(' ')
      .toLowerCase(),
  }));
  db.benchMethod = bench && bench.method;
  db.benchById = new Map(db.benchmarks.flatMap((b: any) => [[b.id, b], ...b.points.map((p: any) => [p.id, b])]));
}

function applyTalent(talent: any) {
  db.talent = talent;
  if (!talent) return;
  db.orgById = new Map(talent.orgs.map((o: any) => [o.id, { ...o, t: ym(o.founded) }]));
  db.personById = new Map(talent.people.map((p: any) => [p.id, { ...p, key: p.id, id: 'person:' + p.id }]));
  db.moves = talent.moves
    .map((m: any) => ({ ...m, t: ym(m.date), year: +String(m.date).slice(0, 4) }))
    .filter((m: any) => m.t);
  for (const p of db.personById.values()) {
    p.moves = db.moves!.filter((m: any) => m.person === p.key).sort((a: any, b: any) => a.t - b.t);
    p._txt = [p.name, ...p.roles.map((r: any) => r.org + ' ' + r.title)].join(' ').toLowerCase();
  }
  db.personById = new Map([...db.personById.values()].map((p: any) => [p.id, p]));
}

function applyPolicyText(T: any) {
  if (!T) return;
  for (const x of db.policy) {
    const t = T[x.key];
    if (t) Object.assign(x, t);
  }
}

function applyPolicy(policy: any) {
  if (db.policy.length && Array.isArray(policy)) {
    const byKey = new Map(policy.map((x: any) => [x.id, x]));
    for (const x of db.policy) {
      const f = byKey.get(x.key);
      if (f) {
        if (f.summary) x.summary = f.summary;
        if (f.sources) x.sources = f.sources;
        if (f.verification_note) x.verification_note = f.verification_note;
      }
    }
    return;
  }
  db.policy = (Array.isArray(policy) ? policy : [])
    .map((x: any) => {
      const ti = ym(x.date_introduced);
      const te = ym(x.date_enacted);
      const tf = ym(x.date_in_force);
      const key = te ?? tf ?? ti;
      return {
        ...x,
        key: x.id,
        id: 'policy:' + x.id,
        ti,
        te,
        tf,
        t: key,
        year: Math.floor(key || 0),
        _txt: [x.title, x.jurisdiction, x.summary, x.type].join(' ').toLowerCase(),
      };
    })
    .filter((x: any) => x.t);
  db.policyById = new Map(db.policy.map((x: any) => [x.id, x]));
}

function applyPreds(preds: any) {
  db.predictions = (Array.isArray(preds) ? preds : preds?.predictions || []).map((p: any) => ({
    ...p,
    key: p.id,
    id: 'pred:' + p.id,
    _txt: [p.who, p.claim, p.quote, p.paraphrase, p.role].join(' ').toLowerCase(),
  }));
  db.predById = new Map(db.predictions.map((p: any) => [p.id, p]));
}

function applyForecasts(j: any) {
  db.forecasts = (Array.isArray(j) ? j : []).map((f: any, i: number) => ({
    ...f,
    id: 'fc:' + i,
    y0: +String(f.said || '2025').slice(0, 4) || 2025,
  }));
  db.forecastById = new Map(db.forecasts.map((f: any) => [f.id, f]));
}

let fcCountOf: any[] | null = null;
let fcCount = { all: [] as any[], n: 0, voices: 0 };

export function forecastCount() {
  const src = db.forecasts || null;
  if (src !== fcCountOf) {
    const all = (src || [])
      .filter((f) => f.t && f.t >= 2026 && f.t <= 2076)
      .sort((a, b) => a.t - b.t || a.y0 - b.y0);
    fcCount = { all, n: all.length, voices: new Set(all.map((f) => f.who)).size };
    fcCountOf = src;
  }
  return fcCount;
}

const FC_RESOLVED = new Set(['came_true', 'came_true_late', 'wrong', 'partly']);
export const forecastOrder = (a: any, b: any): number =>
  (b.w || 0) - (a.w || 0) ||
  (FC_RESOLVED.has(b.v) ? 1 : 0) - (FC_RESOLVED.has(a.v) ? 1 : 0) ||
  String(a.said || '').localeCompare(String(b.said || '')) ||
  (a.id < b.id ? -1 : 1);

export function pickForecasts(list: any[], n: number): any[] {
  const sorted = [...list].sort(forecastOrder);
  const out: any[] = [];
  const seen = new Set<string>();
  for (const f of sorted) {
    if (out.length >= n) break;
    const who = String(f.who || '').toLowerCase();
    if (seen.has(who)) continue;
    seen.add(who);
    out.push(f);
  }
  for (const f of sorted) {
    if (out.length >= n) break;
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

function applyCards(j: any) {
  db.decadeCards = new Map(((j && j.cards) || []).map((c: any) => [c.decade, c]));
}
function applyCenturies(j: any) {
  db.centuryLines = new Map(((j && j.lines) || []).map((l: any) => [l.century, l]));
}
function applyHighlights(j: any) {
  db.highlights = new Map(Object.entries((j && j.units) || {}));
}
function applyDiffusion(j: any) {
  db.diffusion = (j && j.series) || [];
}
function applyFlows(flows: any) {
  db.flows = flows;
  const fl = Array.isArray(flows) ? flows : flows?.deals || flows?.flows || flows?.links || [];
  db.flowList = fl
    .filter((f: any) => f && f.source_org && f.target_org)
    .map((f: any) => {
      const [y, mo] = String(f.date || f.year || '').split('-').map(Number);
      const cut = /(\.\.\.|\u2026)\s*$/.test(f.source_title || '');
      return {
        ...f,
        source_label: !f.source_title || cut ? host(f.source_url) : f.source_title,
        id: 'deal:' + (f.id || `${f.source_org}-${f.target_org}-${f.date}`),
        year: y,
        month: mo || null,
      };
    })
    .filter((f: any) => f.year);
  db.dealById = new Map(db.flowList!.map((f: any) => [f.id, f]));
}

const txtOf = (e: any) =>
  [e.title, e.summary, ...(e.people || []), ...(e.orgs || []), ...(e.tags || [])].join(' ').toLowerCase();

export function ensureTxt() {
  for (const e of db.events) if (e._txt == null) e._txt = txtOf(e);
}

const breathe = () =>
  typeof scheduler !== 'undefined' && scheduler?.yield
    ? scheduler.yield()
    : new Promise<void>((r) => setTimeout(r, 0));
const CHUNK = 250;

function applyText(text: any) {
  if (!text) return;
  db._textJson = text;
  const T = text.events || text;
  for (const e of db.events) {
    const x = T[e.id];
    if (!x) continue;
    if (x.summary) e.summary = x.summary;
    if (x.sources) e.sources = x.sources;
    if (x.verification_note) e.verification_note = x.verification_note;
    if (x.detail) e.detail = x.detail;
    if (x.picture) e.picture = x.picture;
    e._txt = txtOf(e);
  }
}

function applyMeta(meta: any) {
  if (!meta) return;
  db._metaJson = meta;
  const M = meta.events || meta;
  for (const e of db.events) {
    const x = M[e.id];
    if (!x) continue;
    if (x.people) e.people = x.people;
    if (x.orgs) e.orgs = x.orgs;
    if (x.verification) e.verification = x.verification;
    if (x.quote) e.quote = x.quote;
    if (x.ai_precursor) e.ai_precursor = x.ai_precursor;
    e._txt = txtOf(e);
  }
  db.metaApplied = true;
}

interface LoaderSpec {
  file: string;
  parts?: RegExp;
  after?: string;
  apply: (json: any) => any;
  fallback?: { file: string; apply: (json: any) => any };
}

const LOADERS: Record<string, LoaderSpec> = {
  past: { file: 'events_past.json', apply: (p) => mergePast(p) },
  meta: { file: 'events_meta.json', apply: applyMeta },
  text: { file: 'events_text.json', parts: /^events_text(_\d+)?\.json$/, apply: applyText },
  tours: { file: 'tours.json', apply: (t) => { db.tours = (t && (t.tours || t)) || []; } },
  rhymes: { file: 'rhymes.json', apply: (r) => { db.rhymes = (r && (Array.isArray(r) ? r : r.rhymes || r.pairs)) || []; } },
  flows: { file: 'capital_flows.json', apply: applyFlows },
  predictions: { file: 'predictions.json', apply: applyPreds },
  forecasts: { file: 'forecasts.json', apply: applyForecasts },
  cards: { file: 'decade_cards.json', apply: applyCards },
  centuries: { file: 'century_lines.json', apply: applyCenturies },
  highlights: { file: 'highlights.json', apply: applyHighlights },
  diffusion: { file: 'diffusion.json', apply: applyDiffusion },
  markers: { file: 'markers.json', apply: (j) => { db.markers = (j && j.markers) || []; } },
  benchmarks: { file: 'benchmarks.json', apply: applyBench },
  talent: { file: 'talent.json', apply: applyTalent },
  policy_core: { file: 'policy_core.json', apply: applyPolicy },
  policy: {
    file: 'policy_text.json',
    after: 'policy_core',
    apply: applyPolicyText,
    fallback: { file: 'policy.json', apply: applyPolicy },
  },
  patterns: { file: 'patterns.json', apply: (p) => { db.patterns = (p && p.patterns) || []; } },
  impact: { file: 'impact.json', apply: (i) => { db.impact = i; } },
  links: { file: 'links.json', apply: (l) => { db.links = l && l.events ? l : { events: {}, names: {}, years: {} }; } },
  series: {
    file: 'series_all.json',
    apply: (arr) => { db.series = (Array.isArray(arr) ? arr : (arr && arr.series) || []).filter(Boolean); },
  },
};

const SERIES_FIRST = new Set(['anatomy', 'money', 'models', 'rules', 'adoption', 'findings', 'first', 'year', 'beat']);
function initialView(): string {
  try {
    return viewOf(hashParams().get('v') || 'spiral').id;
  } catch {
    return 'spiral';
  }
}

const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
const saveData = () => !!(typeof navigator !== 'undefined' && (navigator as any).connection && (navigator as any).connection.saveData);
export const lean = () => narrow() || saveData();

let available: string[] | null = null;
const pending = new Map<string, Promise<void>>();
let painted = false;
let openGate!: () => void;
const gate = new Promise<void>((r) => {
  openGate = r;
});
let paintCalled = false;

export function markPainted(): void {
  if (paintCalled) return;
  paintCalled = true;
  const open = () => {
    if (!painted) {
      painted = true;
      openGate();
      if (typeof window !== 'undefined' && window.performance && performance.mark) {
        performance.mark('histomap-painted');
      }
    }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(open, { timeout: 2500 });
  else setTimeout(open, 0);
}

const releases = new Map<string, () => void>();
let queue: Promise<any> = Promise.resolve();

function start(n: string, now: boolean): Promise<void> {
  if (db.loaded.has(n)) return Promise.resolve();
  const L = LOADERS[n];
  if (!L) return Promise.resolve();
  if (!pending.has(n)) {
    const has = (f: string) => !available || available.includes(f);
    const F = L.fallback && !has(L.file) && has(L.fallback.file) ? L.fallback : null;
    const parts = L.parts ? (available || []).filter((f) => L.parts!.test(f)).sort() : [];
    const fetchParts = () =>
      Promise.all(parts.map((f) => getJSON(vurl(f), null))).then((js) => {
        const first = js.find(Boolean);
        if (!first) return null;
        const events: Record<string, any> = {};
        for (const j of js) if (j) Object.assign(events, j.events || j);
        return { ...first, events };
      });
    const fetchIt = () =>
      F
        ? getJSON(vurl(F.file), null)
        : parts.length > 1
          ? fetchParts()
          : has(L.file)
            ? getJSON(vurl(L.file), null)
            : Promise.resolve(null);
    const go = () =>
      (L.after && !F ? start(L.after, true) : Promise.resolve())
        .then(fetchIt)
        .then(async (json) => {
          await (F ? F.apply : L.apply)(json);
          db.loaded.add(n);
          emit(n);
        });
    if (now || painted) {
      pending.set(n, go());
    } else {
      let release!: () => void;
      pending.set(
        n,
        new Promise((res) => {
          let done = false;
          release = () => {
            if (!done) {
              done = true;
              res(go());
            }
          };
        }),
      );
      releases.set(n, release);
      gate.then(() => {
        queue = queue.then(() => {
          if (releases.has(n)) {
            release();
            return pending.get(n)?.catch(() => {});
          }
        });
      });
    }
  } else if (now && releases.has(n)) {
    releases.get(n)!();
  }
  return pending.get(n)!;
}

export function ensure(...names: (string | string[])[]): Promise<void[]> {
  return Promise.all(names.flat().filter(Boolean).map((n) => start(n, false)));
}
export function ensureNow(...names: (string | string[])[]): Promise<void[]> {
  return Promise.all(names.flat().filter(Boolean).map((n) => start(n, true)));
}
export const need = (names: string | string[]) => ensureNow(names).then(() => db);
export const ensureAll = () => ensure(...Object.keys(LOADERS));

export const needsFor = (sel: string): string | null =>
  !sel
    ? null
    : sel.startsWith('pred:')
      ? 'predictions'
      : sel.startsWith('fc:')
        ? 'forecasts'
        : sel.startsWith('bench:')
          ? 'benchmarks'
          : sel.startsWith('person:')
            ? 'talent'
            : sel.startsWith('policy:')
              ? 'policy'
              : sel.startsWith('deal:')
                ? 'flows'
                : null;

let HEAD: any = null;
const KEY: Record<string, string> = {
  i: 'id',
  y: 'year',
  m: 'month',
  d: 'day',
  t: 'title',
  ts: 'title_short',
  do: 'domain',
  ty: 'type',
  s: 'significance',
  se: 'sentiment',
  r: 'region',
  c: 'century',
  a: 'ai_era',
  ey: 'end_year',
  ax: 'approximate_year',
  g: 'tags',
  k: 'connects',
  kd: 'kind',
  lm: 'landmark',
  dn: 'dense',
  db: 'dating_basis',
};

function decodeOne(o: any): any {
  const H = HEAD;
  const e: any = {};
  for (const k in o) {
    const K = KEY[k] || k;
    const v = o[k];
    if (K === 'domain') e.domain = H.domains[v];
    else if (K === 'type') e.type = H.types[v];
    else if (K === 'region') e.region = H.regions[v];
    else if (K === 'ai_era') e.ai_era = H.eras[v];
    else if (K === 'tags') e.tags = v.map((i: number) => H.tags[i]);
    else if (K === 'connects') e._kpos = v;
    else if (K === 'approximate_year' || K === 'landmark' || K === 'dense') e[K] = !!v;
    else e[K] = v;
  }
  if (e.title_short == null) e.title_short = e.title;
  return e;
}

const SHAPE = {
  people: [],
  orgs: [],
  tags: [],
  connects: [],
  month: null,
  day: null,
  end_year: null,
  ai_era: null,
  sentiment: 0,
  summary: '',
  sources: [],
};

function shape(e: any) {
  return { ...SHAPE, ...e, t: e.year + ((e.month || 6.5) - 0.5) / 12 };
}

async function decodeEventsAsync(pack: any): Promise<any[]> {
  if (!pack) return [];
  if (Array.isArray(pack)) return pack.map(shape);
  HEAD = HEAD || pack;
  const src = pack.events || [];
  const out = new Array(src.length);
  for (let i = 0; i < src.length; i += CHUNK) {
    const end = Math.min(src.length, i + CHUNK);
    for (let j = i; j < end; j++) out[j] = shape(decodeOne(src[j]));
    if (end < src.length) await breathe();
  }
  return out;
}

let posToId: (string | null)[] | null = null;

async function index(all: any[]) {
  db.events = all;
  all.forEach((e, i) => {
    e._i = i;
  });
  db.byId = new Map(all.map((e) => [e.id, e]));
  db.in = new Map();
  for (let i = 0; i < all.length; i++) {
    const e = all[i];
    if (e._kpos) {
      e.connects = posToId
        ? e._kpos.map((p: number) => posToId![p]).filter((id: string | null) => id && db.byId.has(id) && id !== e.id)
        : e.connects || [];
    } else {
      e.connects = (e.connects || []).filter((c: string) => db.byId.has(c) && c !== e.id);
    }
    for (const c of e.connects) {
      if (!db.in.has(c)) db.in.set(c, []);
      db.in.get(c)!.push(e.id);
    }
    if (i % (CHUNK * 2) === CHUNK * 2 - 1 && i + 1 < all.length) await breathe();
  }
  const tc = new Map<string, number>();
  for (const e of all) for (const t of e.tags || []) tc.set(t, (tc.get(t) || 0) + 1);
  db.tags = [...tc].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
  db.complete = !HEAD || all.length >= (HEAD.total || 0);
}

function buildPos(recent: any[], past: any[]) {
  const full = [...past, ...recent];
  posToId = full.map((e) => e.id);
  return full;
}

async function mergePast(pack: any) {
  if (!pack) {
    db.complete = true;
    return;
  }
  performance.mark('past-fetched');
  await breathe();
  const past = await decodeEventsAsync(pack);
  performance.mark('past-decoded');
  const recent = db.events;
  const all = buildPos(recent, past);
  await index(all);
  performance.mark('past-indexed');
  if (db.loaded.has('meta')) applyMeta(db._metaJson);
  if (db.loaded.has('text')) applyText(db._textJson);
  await breathe();
}

let loadPromise: Promise<HistomapDB> | null = null;

export async function load(): Promise<HistomapDB> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const man = await getJSON(
      `/data/manifest.json${typeof window !== 'undefined' && window.__BUILD ? `?v=${window.__BUILD}` : ''}`,
      { optional: [] },
    );
    VER = man.version || '';
    available = [...(man.optional || []), ...(man.core || [])];
    db.manifest = man;
    const view = initialView();
    const home = view === 'anatomy';
    if (!(man.core || []).includes('series_all.json')) {
      LOADERS.series = { file: 'series_index.json', apply: () => {} };
      pending.set(
        'series',
        getJSON(vurl('series_index.json'), [])
          .then((sidx: any[]) => Promise.all(sidx.map((s) => getJSON(vurl(`series/${s.id}.json`), null))))
          .then((arr) => {
            db.series = arr.filter(Boolean);
            db.loaded.add('series');
            emit('series');
          }),
      );
    }
    const seriesP = SERIES_FIRST.has(view) ? ensureNow('series') : ensure('series');
    const coreFile = (man.core || []).includes('events_core.json') ? 'events_core.json' : 'events.json';
    const [pack, models, amap] = await Promise.all([
      getJSON(vurl(coreFile), []),
      getJSON(vurl('ai_models.json'), null),
      home && (man.optional || []).includes('anatomy_map.json') ? getJSON(vurl('anatomy_map.json'), null) : Promise.resolve(null),
      SERIES_FIRST.has(view) ? seriesP : Promise.resolve(),
      home && (man.optional || []).includes('policy_core.json') ? ensureNow('policy_core') : Promise.resolve(),
    ]);
    db.anatomyMap = amap && amap.map ? new Map(Object.entries(amap.map)) : null;
    const mark = (n: string) => {
      if (typeof performance !== 'undefined' && performance.mark) performance.mark(n);
    };
    mark('core-fetched');
    const recent = await decodeEventsAsync(pack);
    mark('core-decoded');
    const twoWave = !!HEAD && (man.core || []).includes('events_past.json');
    if (!twoWave) {
      posToId = recent.map((e) => e.id);
      db.loaded.add('past');
      if (coreFile === 'events.json') {
        db.loaded.add('text');
        db.loaded.add('meta');
      }
    } else {
      const nPast = Math.max(0, (HEAD.total || recent.length) - recent.length);
      posToId = new Array(nPast + recent.length).fill(null);
      recent.forEach((e, i) => {
        posToId![nPast + i] = e.id;
      });
    }
    await index(recent);
    mark('core-indexed');
    emit('core');
    db.models = models;
    const ml = Array.isArray(models) ? models : models?.models || [];
    db.modelList = ml.map((m: any) => {
      const [y, mo] = String(m.date || '').split('-').map(Number);
      const slug = (m.name + '-' + m.date)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return { ...m, id: 'model:' + slug, year: y, month: mo || null, t: y + ((mo || 6.5) - 0.5) / 12 };
    });
    db.modelById = new Map(db.modelList!.map((m: any) => [m.id, m]));
    return db;
  })();
  return loadPromise;
}

export const neighbors = (id: string): string[] => {
  const e = db.byId.get(id);
  if (!e) return [];
  return [...new Set([...(e.connects || []), ...(db.in.get(id) || [])])];
};

export const draw: { register: string; overlays: boolean } = { register: 'auto', overlays: false };
export const registerFor = (s: AppState = state): string =>
  draw.register !== 'auto' ? draw.register : s.y1 - s.y0 > 300 ? 'landmarks' : 'all';
export const registerLabel = (s: AppState = state): string =>
  registerFor(s) === 'landmarks' ? 'Landmarks: one entry per episode at significance 5' : 'All: the whole record';

export function ensureD3(): Promise<typeof d3Module | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!window.d3) {
    window.d3 = d3Module;
    document.dispatchEvent(new CustomEvent('d3-ready'));
  }
  return Promise.resolve(window.d3);
}
export const hasD3 = (): boolean => {
  if (typeof window !== 'undefined' && !window.d3) window.d3 = d3Module;
  return typeof window !== 'undefined' && !!window.d3;
};

export function census() {
  const ev = db.events.filter((e) => e.kind !== 'overlay');
  const got = {
    events: ev.length,
    landmarks: ev.filter((e) => e.landmark).length,
    overlays: db.events.length - ev.length,
    records: db.events.length,
    partial: false,
  };
  if (db.loaded.has('past')) return got;
  const M = db.manifest || {};
  const records = M.events || got.records;
  const overlays = M.overlays != null ? M.overlays : got.overlays;
  return {
    events: records - overlays,
    landmarks: M.landmarks != null ? M.landmarks : got.landmarks,
    overlays,
    records,
    partial: true,
  };
}

export const THIN_UNDER = 6;
let thinCache: { n: number; m: Map<string, number> } | null = null;
export function thinCells(y0 = state.y0, y1 = state.y1) {
  if (!thinCache || thinCache.n !== db.events.length) {
    const m = new Map<string, number>();
    for (const e of db.events) {
      if (e.kind === 'overlay' || !e.region) continue;
      const k = `${e.region}:${Math.floor(e.year / 100) * 100}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    thinCache = { n: db.events.length, m };
  }
  const out: { region: string; c: number; n: number }[] = [];
  const regions = new Set(db.events.map((e) => e.region).filter(Boolean));
  for (const r of regions) {
    for (let c = Math.floor(y0 / 100) * 100; c <= y1; c += 100) {
      const n = thinCache.m.get(`${r}:${c}`) || 0;
      if (n < THIN_UNDER) out.push({ region: r, c, n });
    }
  }
  return out;
}
export const thinKey = (e: any) => `${e.region}:${Math.floor(e.year / 100) * 100}`;
export const overlaysOn = () =>
  draw.overlays && (typeof matchMedia !== 'function' || matchMedia('(min-width: 600px)').matches);

export function drawn(e: any, s: AppState = state, withOverlays = false): boolean {
  if (e.kind === 'overlay') return withOverlays && overlaysOn() && passes(e, s);
  if (registerFor(s) === 'landmarks' && !e.landmark) return false;
  return passes(e, s);
}

export function passes(e: any, s: AppState = state): boolean {
  if (!s.domains.has(e.domain)) return false;
  if (s.types && !s.types.has(e.type)) return false;
  if (s.thread && !(e.tags || []).includes(s.thread)) return false;
  if (s.q) {
    const terms = s.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (e._txt == null) e._txt = txtOf(e);
    for (const t of terms) if (!e._txt.includes(t)) return false;
  }
  return true;
}

export const inYears = (e: any, s: AppState = state): boolean => e.year >= s.y0 && e.year <= s.y1;

export function aiCount({ from = -Infinity, to = Infinity, layered = false } = {}): number {
  let n = 0;
  for (const e of db.events) {
    if ((e.domain === 'ai' || (layered && (e.ai_era || e.ai_precursor))) && e.year >= from && e.year <= to) n++;
  }
  return n;
}

const RECORD_SETS: Record<string, [string | null, keyof HistomapDB]> = {
  'pred:': ['predictions', 'predById'],
  'fc:': ['forecasts', 'forecastById'],
  'bench:': ['benchmarks', 'benchById'],
  'person:': ['talent', 'personById'],
  'policy:': ['policy', 'policyById'],
  'deal:': ['flows', 'dealById'],
  'model:': [null, 'modelById'],
};

export async function hasRecord(id: string): Promise<boolean> {
  if (!id) return true;
  if (id === 'fc:all') {
    await ensureNow('forecasts');
    return true;
  }
  if (db.pointById && db.pointById.has(id)) return true;
  const k = Object.keys(RECORD_SETS).find((p) => id.startsWith(p));
  if (k) {
    const [setKey, mapKey] = RECORD_SETS[k];
    if (setKey) await ensureNow(setKey);
    const mapObj = db[mapKey] as Map<string, any> | undefined;
    return !!(mapObj && mapObj.has(id));
  }
  if (id.includes(':')) return true;
  if (db.byId.has(id)) return true;
  await ensureNow('past');
  return db.byId.has(id);
}

export const filtered = (s: AppState = state) => db.events.filter((e) => passes(e, s));

export function fmtDate(e: any): string {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let s = '';
  if (e.month) s += (e.day ? e.day + ' ' : '') + M[e.month - 1] + ' ';
  if (/^(radiocarbon|typological|stratigraphy|luminescence|mixed)$/.test(e.dating_basis || '')) s += 'c. ';
  s += fmtYear(e.year);
  if (e.end_year && e.end_year !== e.year) s += ' to ' + fmtYear(e.end_year);
  return s;
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUFFIX = /[- ](?:\d+(?:\.\d+)?[BMT]|Large|mini|Maverick|Preview|Exp|Opus|Sonnet|Ultra|Pro|A\d+B|\d+x\d+B|base\/big)$/i;

function modelNames(m: any): string[] {
  const raw = m.name.replace(/^OpenAI /, '');
  const out = new Set<string>([raw, raw.replace(/\s*\(.*?\)\s*/g, ' ').trim()]);
  (raw.match(/\(([^)]+)\)/) || []).slice(1).forEach((s: string) => out.add(s));
  for (const n of [...out]) {
    let b = n;
    for (let i = 0; i < 3 && SUFFIX.test(b); i++) {
      b = b.replace(SUFFIX, '').trim();
      if (b.length >= 3) out.add(b);
    }
  }
  return [...out].filter((s) => (s.length > 1 && !/^(Transformer|Claude|Gemini|Mistral|GPT|Llama)$/i.test(s)) || s === raw);
}

export function modelEvents(m: any): any[] {
  if (!m) return [];
  if (m._ev) return m._ev;
  const names = modelNames(m);
  const res = names.map((n) => new RegExp(`(^|[^A-Za-z0-9.])${escRe(n)}(?![A-Za-z0-9]|\\.\\d)`, 'i'));
  const pm = m.name.match(/^([A-Z][A-Za-z]+)-([A-Z]\d[\w.]*)$/);
  const pre = pm ? [new RegExp(escRe(pm[1]), 'i'), new RegExp(`(^|[^A-Za-z0-9.])${escRe(pm[2])}(?![A-Za-z0-9]|\\.\\d)`)] : null;
  const out: [any, number][] = [];
  for (const e of db.events) {
    if (Math.abs(e.year - m.year) > 1) continue;
    if (!(e.domain === 'ai' || e.domain === 'semiconductors' || e.domain === 'software')) continue;
    const t = e.title.replace(/\u00b7/g, '-');
    let hit: { n: string; at: number } | null = null;
    res.forEach((r, i) => {
      const mm = r.exec(t);
      if (mm && (!hit || names[i].length > hit.n.length)) hit = { n: names[i], at: mm.index + mm[0].length };
    });
    if (!hit && pre && pre[0].test(t) && pre[1].test(t)) {
      hit = { n: pm[2], at: t.search(pre[1]) + pm[2].length + 1 };
    }
    if (!hit) continue;
    const h = hit as { n: string; at: number };
    const exact = h.n.length >= m.name.replace(/^OpenAI /, '').replace(/\s*\(.*?\)\s*/g, ' ').trim().length;
    const after = t.slice(h.at);
    const cont = /^[\s-]+(?:[A-Z0-9]|mini\b|pro\b|turbo\b)/.test(after) || /^o\b/.test(after);
    const dm = e.year === m.year && e.month && m.month ? Math.abs(e.month - m.month) : 6 + Math.abs(e.year - m.year) * 12;
    out.push([e, dm + (cont ? 4 : 0) + (exact ? 0 : 2) - (e.type === 'product' ? 0.5 : 0)]);
  }
  m._ev = out.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  return m._ev;
}

export function seriesLines(s: any) {
  if (!s) return [];
  if (s.technologies) return Object.entries(s.technologies).map(([name, pts]) => ({ name, points: pts }));
  if (s.groups && typeof s.groups === 'object' && !Array.isArray(s.groups)) {
    const g = Object.entries(s.groups)
      .filter(([, p]) => Array.isArray(p))
      .map(([name, points]) => ({ name, points }));
    if (g.length) return g;
  }
  const out: any[] = [{ name: s.title, points: s.points || [] }];
  if (s.secondary && s.secondary.points) {
    out.push({ name: s.secondary.title || 'secondary', points: s.secondary.points, secondary: true });
  }
  if (s.data_center_points) {
    out.push({ name: 'Data Center revenue', points: s.data_center_points, secondary: true });
  }
  return out;
}
export const seriesById = (id: string) => db.series.find((x) => x.id === id);
