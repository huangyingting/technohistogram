import { db, ensure, passes } from './data';
import { set, state as S } from './store';
import { goWhere, esc } from './ui';
import { DOMAIN } from './palette';

export const CX_KINDS: [string, string, string][] = [
  ['th', 'Thread', 'Threads'],
  ['po', 'Policy', 'Policies'],
  ['bm', 'Benchmark', 'Benchmarks'],
  ['dl', 'Deal', 'Deals'],
  ['im', 'Measure', 'Measures'],
  ['pt', 'Pattern', 'Patterns'],
];
const WEIGHT: Record<string, number> = { th: 3, po: 3, bm: 3, dl: 3, im: 2, pt: 1 };

export function cxLinks(id: string, onReady?: () => void) {
  if (!db.links) {
    ensure('links').then(() => onReady && onReady());
    return null;
  }
  return db.links.events[id] || null;
}

const name = (k: string, id: string) => ((db.links && db.links.names[k]) || {})[id] || id;
const year = (k: string, id: string) => ((db.links && db.links.years[k]) || {})[id];

const apart = (a: number, b: number) => {
  const d = b - a;
  return d === 0 ? 'the same year' : d > 0 ? `${d} year${d === 1 ? '' : 's'} later` : `${-d} year${d === -1 ? '' : 's'} earlier`;
};

const KIND_ONE: Record<string, string> = {
  th: 'thread',
  po: 'rule',
  bm: 'benchmark',
  dl: 'deal',
  im: 'measure',
  pt: 'pattern',
};

export const cxWhy = (L: any, k: string, id: string, e: any): string => {
  const w = (L && (L.why || L.reasons)) || {};
  const r = w[`${k}:${id}`] || (w[k] && typeof w[k] === 'object' ? w[k][id] : '') || '';
  if (r) return r;
  const yr = year(k, id);
  return yr && e ? `${KIND_ONE[k]}, ${apart(e.year, yr)}` : '';
};

export const cxBasis = (L: any, k: string, id: string): string => ((L && L.basis) || {})[`${k}:${id}`] || '';

export const cxLine = (L: any, k: string, id: string, e: any): string => {
  const b = cxBasis(L, k, id);
  const w = cxWhy(L, k, id, e);
  if (b && w) {
    const bl = b.toLowerCase();
    const wl = w.toLowerCase();
    if (bl.includes(wl)) return b;
    if (wl.includes(bl)) return w;
    if (w.split(' ')[0] === b.split(' ')[0]) {
      const m = w.match(/, (\d{4})$/);
      return b + (m ? `, ${m[1]}` : '');
    }
  }
  return [b, w].filter(Boolean).join('; ');
};

export function cxLinked(e: any, pool: any[], cap = 40) {
  const out = cxLinkedAll(e, pool);
  const list: any = out.slice(0, cap).sort((a, b) => a.e.year - b.e.year);
  list.total = out.length;
  return list as { e: any; shared: string[]; score: number }[] & { total: number };
}

function cxLinkedAll(e: any, pool: any[]) {
  const L = db.links && db.links.events[e.id];
  if (!L) return [];
  const mine = new Map<string, number>();
  for (const [k] of CX_KINDS) for (const id of L[k] || []) mine.set(`${k}:${id}`, WEIGHT[k]);
  if (!mine.size) return [];
  const out: { e: any; shared: string[]; score: number }[] = [];
  for (const o of pool) {
    if (o.id === e.id) continue;
    const M = db.links.events[o.id];
    if (!M) continue;
    let score = 0;
    const shared: string[] = [];
    for (const [k] of CX_KINDS) {
      for (const id of M[k] || []) {
        const key = `${k}:${id}`;
        if (mine.has(key)) {
          score += mine.get(key)!;
          shared.push(key);
        }
      }
    }
    if (score >= 2 || (score === 1 && mine.size === 1)) out.push({ e: o, shared, score });
  }
  out.sort((a, b) => b.score - a.score || Math.abs(a.e.year - e.year) - Math.abs(b.e.year - e.year));
  return out;
}

export function cxSpan(e: any, linked: { e: any }[]): [number, number] {
  const ys = [e.year, ...linked.map((l) => l.e.year)];
  const a = Math.min(...ys);
  const b = Math.max(...ys);
  return [Math.max(1026, a - 1), Math.min(2026, b + 1)];
}

const SHARE: Record<string, string> = {
  th: 'steps of the same thread',
  po: 'named by the same rule',
  bm: 'named by the same benchmark',
  dl: 'names a party to the same deal',
  im: 'milestone on the same measure',
  pt: 'counted in the same pattern',
};

export const cxShared = (shared: string[]): string =>
  shared
    .slice(0, 2)
    .map((s) => {
      const k = s.slice(0, 2);
      const id = s.slice(3);
      return `${SHARE[k]} \u201c${name(k, id)}\u201d`;
    })
    .join('; ') + (shared.length > 2 ? `; and ${shared.length - 2} more` : '');

export function cxIndex(
  hostEl: HTMLElement,
  {
    e,
    linked = [] as any,
    onPick,
    onExit,
    onJump,
    onAll,
    onOpen,
    all = false,
  }: {
    e: any;
    linked?: any;
    onPick?: (id: string) => void;
    onExit?: () => void;
    onJump?: (go: string) => void;
    onAll?: () => void;
    onOpen?: (id: string) => void;
    all?: boolean;
  },
) {
  const L = e ? db.links && db.links.events[e.id] : null;
  if (!e && !db.links) {
    const args = { e, linked, onPick, onExit, onJump, onAll, onOpen, all };
    ensure('links').then(() => {
      if (hostEl.isConnected && !hostEl.querySelector('.cx-sel')) cxIndex(hostEl, args);
    });
  }
  hostEl.setAttribute('role', 'region');
  hostEl.setAttribute('aria-label', 'Linked records');
  hostEl.setAttribute('aria-live', 'polite');
  const parts = [
    `<div class="cx-h"><span class="sc">Connections</span><button type="button" class="cx-exit" data-a="exit" aria-label="Exit connections">Exit</button></div>`,
  ];
  if (!e) {
    parts.push(`<p class="cx-cue">Click a mark.</p>`);
    const E = (db.links && db.links.events) || {};
    const picks = Object.keys(E)
      .map((id) => ({
        id,
        n: Object.values(E[id]).reduce<number>((a, v: any) => a + (Array.isArray(v) ? v.length : 0), 0),
      }))
      .filter((x) => x.n && db.byId && db.byId.get(x.id))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);
    if (picks.length) {
      parts.push(
        `<div class="cx-picks" role="group" aria-label="Pick a record by keyboard"><ul class="cx-g">${picks
          .map(({ id, n }) => {
            const o = db.byId.get(id);
            return `<li><button type="button" data-pick="${esc(id)}"><span class="tt">${esc(o.title)}</span><span class="y">${o.year}</span><small class="cx-why">${n} link${n === 1 ? '' : 's'}</small></button></li>`;
          })
          .join('')}</ul></div>`,
      );
    }
  } else {
    const d = DOMAIN[e.domain];
    parts.push(
      `<div class="cx-sel"><b>${esc(e.title)}</b><span>${e.year}${d ? ` · ${esc(d.label)}` : ''}</span><button type="button" class="cx-open" data-a="open">Open the record</button></div>`,
    );
    if (!db.links) parts.push(`<p class="cx-cue">Loading the links.</p>`);
    else if (!L) parts.push(`<p class="cx-cue">No links yet for this record.</p>`);
    const rows: string[] = [];
    for (const [k, , many] of CX_KINDS) {
      const ids: string[] = (L && L[k]) || [];
      if (!ids.length) continue;
      rows.push(`<li class="cx-grp"><span class="k">${esc(many)}</span><b>${ids.length}</b></li>`);
      const order = ids
        .slice()
        .sort((p, q) => cxBasis(L, k, p).localeCompare(cxBasis(L, k, q)) || (year(k, p) || 0) - (year(k, q) || 0));
      for (const id of order) {
        const yr = year(k, id);
        const w = cxLine(L, k, id, e);
        rows.push(
          `<li><button type="button" data-go="${k}:${esc(id)}" title="Open in its view"><span class="tt">${esc(name(k, id))}</span>${yr ? `<span class="y">${yr}</span>` : '<span class="y"></span>'}${w ? `<small class="cx-why">${esc(w)}</small>` : ''}</button></li>`,
        );
      }
    }
    const total = linked.total != null ? linked.total : linked.length;
    if (linked.length) {
      rows.push(
        `<li class="cx-grp"><span class="k">Linked records${total > linked.length ? `, ${linked.length} of ${total}` : ''}</span><b>${total}</b></li>`,
      );
      for (const { e: o, shared } of linked) {
        rows.push(
          `<li><button type="button" data-pick="${esc(o.id)}"><span class="tt">${esc(o.title)}</span><span class="y">${o.year}</span><small class="cx-why">${esc(cxShared(shared))}</small></button></li>`,
        );
      }
      if (total > linked.length && !all) {
        rows.push(`<li><button type="button" class="cx-all" data-a="all"><span class="tt">Show all ${total}</span></button></li>`);
      }
    }
    if (rows.length) parts.push(`<ul class="cx-g">${rows.join('')}</ul>`);
  }
  hostEl.innerHTML = parts.join('');
  hostEl.onclick = (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.a === 'exit') onExit && onExit();
    else if (b.dataset.a === 'open') {
      if (onOpen) onOpen(e.id);
      else set({ sel: e.id });
    } else if (b.dataset.a === 'all') onAll && onAll();
    else if (b.dataset.pick) onPick && onPick(b.dataset.pick);
    else if (b.dataset.go) {
      onJump && onJump(b.dataset.go);
      goWhere(b.dataset.go, e);
    }
  };
}

let foldWatch: MutationObserver | null = null;
export function cxFoldList(id: string, { onExit, onPick }: { onExit?: () => void; onPick?: (pid: string) => void } = {}) {
  const e = db.byId.get(id);
  if (!e) return;
  const body = document.getElementById('db');
  if (!body) return;
  const place = () => {
    if (S.sel !== id) return;
    let hostEl = body.querySelector('.cx-fold') as HTMLElement | null;
    if (!hostEl) {
      hostEl = document.createElement('section');
      hostEl.className = 'cx-fold cx-ix';
      body.prepend(hostEl);
    }
    const linked = cxLinked(
      e,
      db.events.filter((o) => passes(o)),
      12,
    );
    cxIndex(hostEl, { e, linked, onExit, onPick: (pid) => (onPick ? onPick(pid) : set({ sel: pid })) });
  };
  if (foldWatch) foldWatch.disconnect();
  foldWatch = new MutationObserver(() => {
    if (S.sel === id && !body.querySelector('.cx-fold')) place();
  });
  foldWatch.observe(body, { childList: true });
  if (!cxLinks(id, place) && !db.links) {
    place();
    return;
  }
  place();
}

export function cxFoldStop() {
  if (foldWatch) {
    foldWatch.disconnect();
    foldWatch = null;
  }
  const f = document.querySelector('#db .cx-fold');
  if (f) f.remove();
}
