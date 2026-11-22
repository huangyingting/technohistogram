import {
  load,
  db,
  ensure,
  ensureNow,
  onData,
  markPainted,
  hasRecord,
  lean,
  ensureD3,
} from '../lib/data';
import {
  state,
  set,
  subscribe,
  applyHash,
  readHash,
  canonHash,
  hashParams,
  pathLikeHash,
  YEAR_MIN,
  YEAR_MAX,
  VIEWS,
  TABS,
  viewOf,
  tabOf,
  moduleOf,
  mountOf,
  screenPlate,
  screensOf,
  onHover,
  initStoreHash,
  type AppState,
} from '../lib/store';
import {
  initFilters,
  syncFilters,
  fillTypes,
  fillThreads,
  initSearch,
  initDrawer,
  renderDrawer,
  initScrubber,
  select,
  tip,
  INDEXED,
  NARROW,
  desktopHandOff,
  openList,
  openEvidence,
  type ScrubberHandle,
} from '../lib/ui';
import { DOMAINS } from '../lib/palette';
import { initTour, tourHi, walkLit } from '../lib/tour';
import { initIntro } from '../lib/intro';
import { initPoster } from '../lib/poster';
import { isZh, onLangChange } from '../lib/i18n';

interface MountedView {
  el: HTMLElement;
  api: any;
  dirty: boolean;
  titles: { title: string }[] | null;
  selfPast: boolean;
}

const VIEW_NEEDS: Record<string, string[]> = {
  patterns: ['patterns'],
  impact: ['impact'],
  predictions: ['predictions'],
  wheel: ['text'],
  threads: ['tours', 'rhymes'],
  arcs: ['links', 'patterns'],
  moment: ['benchmarks'],
};

const D3_FREE = new Set([
  'helix',
  'spiral',
  'spiral_ui',
  'speed',
  'voices',
  'ai_now',
  'ai_limits',
  'games',
  'play_first',
  'play_year',
  'play_beat',
  'play_index',
]);

let booted = false;

export function bootHistomap(): void {
  if (booted || typeof window === 'undefined' || typeof document === 'undefined') return;
  booted = true;

  initPoster();
  initStoreHash();

  // Reveal #ar-pre once display faces load (or remove if not in arrival mode)
  {
    const arPre = document.getElementById('ar-pre');
    if (arPre) {
      if (!window.__ARRIVAL) {
        arPre.remove();
      } else {
        const showTitle = () => arPre.classList.add('on');
        if (document.fonts && document.fonts.load) {
          Promise.all([
            document.fonts.load("400 48px 'Instrument Serif'"),
            document.fonts.load("italic 400 48px 'Instrument Serif'"),
            document.fonts.load("400 14px 'Instrument Sans'"),
          ]).then(showTitle, showTitle);
          setTimeout(showTitle, 1200);
        } else {
          showTitle();
        }
      }
    }
  }

  // Pre-module intro Start click fallback
  {
    const introEl = document.getElementById('intro');
    if (introEl) {
      introEl.addEventListener('click', (e) => {
        if (window.__introLive) return;
        const target = e.target as HTMLElement | null;
        if (!(target?.closest && target.closest('button')) && window.innerWidth >= 700) return;
        introEl.hidden = true;
        introEl.classList.remove('sp-boot');
        document.documentElement.classList.remove('arrive');
        location.replace('#v=spiral');
      });
    }
  }

  // Reduced motion handling
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const patchD3 = () => {
      const d3Any = (window as any).d3;
      if (!d3Any || !d3Any.transition) return;
      const tp = d3Any.transition.prototype;
      const dur = tp.duration;
      const del = tp.delay;
      tp.duration = function (...args: any[]) {
        return args.length ? dur.call(this, 0) : dur.call(this);
      };
      tp.delay = function (...args: any[]) {
        return args.length ? del.call(this, 0) : del.call(this);
      };
    };
    patchD3();
    document.addEventListener('d3-ready', patchD3, { once: true });
    const origScrollTo = Element.prototype.scrollTo as any;
    (Element.prototype as any).scrollTo = function (a?: any, b?: any) {
      return typeof a === 'object' && a
        ? origScrollTo.call(this, { ...a, behavior: 'auto' })
        : origScrollTo.call(this, a, b);
    };
    document.documentElement.classList.add('reduced-motion');
  }

  // Standalone / fullscreen display mode
  try {
    const syncStandalone = () =>
      document.documentElement.classList.toggle(
        'standalone',
        window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          (navigator as any).standalone === true,
      );
    syncStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', syncStandalone);
  } catch {
    /* ignore */
  }

  const stage = document.getElementById('stage') as HTMLElement | null;
  const app = document.getElementById('app') as HTMLElement | null;
  const topbar = document.querySelector('.topbar') as HTMLElement | null;
  if (!stage || !app || !topbar) return;

  // Measure --top-h from actual rendered topbar height (including padding & wrapped rows)
  {
    const measure = () => {
      const h = Math.ceil(topbar.getBoundingClientRect().height);
      if (h > 1) {
        app.style.setProperty('--top-h', `${h}px`);
        document.documentElement.style.setProperty('--top-h', `${h}px`);
      }
    };
    if (typeof ResizeObserver !== 'undefined') {
      for (const c of Array.from(topbar.children)) new ResizeObserver(measure).observe(c);
      new ResizeObserver(measure).observe(topbar);
    }
    document.addEventListener('draw-change', () => requestAnimationFrame(measure));
    onLangChange(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);
    measure();
  }

  const mounted = new Map<string, MountedView>();
  const DARK = new Set<string>();
  const NO_SCRUB: ScrubberHandle = {
    layout() {},
    draw() {},
    setRange() {},
    mark() {},
  };
  let scrub: ScrubberHandle = NO_SCRUB;
  let scrubReady: Promise<ScrubberHandle> | null = null;
  let filtersUp = false;
  let upFiltersRef: (now?: boolean) => void = () => {};

  const idle = (fn: () => void, ms = 2000) =>
    typeof (window as any).requestIdleCallback === 'function'
      ? (window as any).requestIdleCallback(fn, { timeout: ms })
      : window.setTimeout(fn, 200);

  function wakeScrubber(): Promise<ScrubberHandle> {
    if (scrubReady) return scrubReady;
    scrubReady = ensureD3()
      .then(() => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0))))
      .then(() => {
        if (scrub === NO_SCRUB) scrub = initScrubber();
        scrub.layout();
        scrub.setRange();
        return scrub;
      })
      .catch(() => scrub);
    return scrubReady;
  }

  function loadingState() {
    if (!stage) return;
    stage.innerHTML = `<div class="state-msg"><div><div class="loading-bars">${DOMAINS.slice(0, 9)
      .map((d, i) => `<span style="--c:${d.color};animation-delay:${i * 0.09}s"></span>`)
      .join('')}</div><h2>${isZh() ? '正在展开技术演进螺旋…' : 'Loading the map'}</h2><p>${
      isZh() ? '正在读取 4,828 条历史考证记录、影像与文献来源。' : 'Reading events, measures and sources.'
    }</p></div></div>`;
  }

  function emptyState() {
    if (!stage) return;
    const root = document.documentElement;
    root.classList.remove('arrive', 'arrival-mode');
    document.getElementById('ar-pre')?.remove();
    root.dataset.tab = 'map';
    root.dataset.view = 'spiral';
    document.body.dataset.page = 'map';
    stage.innerHTML = `<div class="state-msg"><div><h2>${isZh() ? '未能加载史料数据' : 'Nothing loaded'}</h2><p>${
      isZh() ? '请检查网络连接后重新加载。' : 'The record did not load.'
    }</p><button type="button" class="reload">${isZh() ? '重新加载页面' : 'Reload the page'}</button></div></div>`;
    stage.querySelector('.reload')?.addEventListener('click', () => location.reload());
    root.dataset.ready = '1';
  }

  function partialNote() {
    if (!db.missing || !db.missing.size || !db.events.length || document.getElementById('load-note')) return;
    const n = document.createElement('p');
    n.id = 'load-note';
    n.className = 'load-note';
    n.setAttribute('role', 'status');
    n.innerHTML =
      '<span>Record did not finish loading.</span> <button type="button" class="reload">Reload</button>';
    n.querySelector('.reload')?.addEventListener('click', () => location.reload());
    document.body.appendChild(n);
  }
  window.addEventListener('histomap:partial', partialNote);

  const nav = document.getElementById('views') as HTMLElement;
  const sub = document.getElementById('subnav') as HTMLElement;
  const screensEl = document.getElementById('screens') as HTMLElement | null;

  const renderNavTabs = () => {
    nav.innerHTML =
      TABS.map(
        (t) =>
          `<button type="button" data-tab="${t.id}" title="${t.label}: ${t.sub}" aria-current="${
            tabOf(state.view) === t.id ? 'page' : 'false'
          }"><span class="lg">${t.label}</span><span class="sub">${t.sub}</span></button>`,
      ).join('') + '<i class="tab-ind" aria-hidden="true"></i>';
  };
  renderNavTabs();

  const placeTabInd = () => {
    const tabInd = nav.querySelector('.tab-ind') as HTMLElement | null;
    const b = nav.querySelector("button[aria-current='page']") as HTMLElement | null;
    if (!b || !tabInd) return;
    const pad = parseFloat(getComputedStyle(b).paddingLeft) || 0;
    tabInd.style.left = `${b.offsetLeft + pad}px`;
    tabInd.style.width = `${Math.max(0, b.offsetWidth - 2 * pad)}px`;
    nav.classList.add('has-ind');
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeTabInd);
  onLangChange(() => {
    renderNavTabs();
    drawSubnav();
    placeTabInd();
    document.title = isZh()
      ? '技术演进全图 · Technology Histomap'
      : 'Technology Histomap — 3.3 million BCE to 2026';
  });

  nav.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest('button') as HTMLElement | null;
    if (!b) return;
    const t = TABS.find((x) => x.id === b.dataset.tab);
    if (t) set({ view: t.view, mode: '' });
  });

  nav.querySelectorAll('button[data-tab]').forEach((b, i) =>
    b.setAttribute('aria-keyshortcuts', String(i + 1)),
  );
  document.addEventListener('keydown', (ev) => {
    if (
      ev.metaKey ||
      ev.ctrlKey ||
      ev.altKey ||
      ev.key.length !== 1 ||
      ev.key < '1' ||
      ev.key > String(TABS.length)
    ) {
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target?.closest && target.closest('input, textarea, select, [contenteditable], [role=slider]')) {
      return;
    }
    if (document.body.classList.contains('intro-open')) return;
    const t = TABS[+ev.key - 1];
    if (t) {
      ev.preventDefault();
      set({ view: t.view, mode: '' });
    }
  });

  const subBtn = (v: any, cur: string) =>
    `<button type="button" data-v="${v.id}" aria-label="${v.label}" aria-current="${
      v.id === cur ? 'page' : 'false'
    }"><span class="lg">${v.label}</span><span class="sh" aria-hidden="true">${v.sh}</span></button>`;

  const PHONE_MQ = window.matchMedia('(max-width: 760px)');
  let current: MountedView | null = null;

  function placeScreens() {
    if (!screensEl || !sub) return;
    if (PHONE_MQ.matches) {
      if (screensEl.parentElement === sub) sub.parentElement?.insertBefore(screensEl, sub.nextSibling);
    } else if (screensEl.parentElement !== sub) {
      sub.appendChild(screensEl);
    }
  }

  function drawScreens() {
    if (!screensEl) return;
    const n = screensOf(state.view);
    screensEl.hidden = n < 2;
    if (n < 2) {
      screensEl.innerHTML = '';
      return;
    }
    const titles = current?.titles || null;
    const k = Math.min(Math.max(1, state.screen), n);
    const t = titles && titles[k - 1] ? titles[k - 1].title : '';
    placeScreens();
    if (PHONE_MQ.matches) {
      screensEl.innerHTML = `<button type="button" data-sc="${k - 1}" ${
        k <= 1 ? 'disabled' : ''
      } aria-label="Previous screen">\u2190 Previous</button><span class="sc-n" aria-live="polite">${
        t ? `${t} \u00b7 ` : ''
      }${k} of ${n}</span><button type="button" data-sc="${k + 1}" ${
        k >= n ? 'disabled' : ''
      } aria-label="Next screen">Next \u2192</button>`;
      return;
    }
    screensEl.innerHTML = `<button type="button" data-sc="${k - 1}" ${
      k <= 1 ? 'disabled' : ''
    } aria-label="Previous screen">\u2190</button><span class="sc-n" aria-live="polite">${
      t ? `${t} \u00b7 ` : ''
    }${k} of ${n}</span><button type="button" data-sc="${k + 1}" ${
      k >= n ? 'disabled' : ''
    } aria-label="Next screen">\u2192</button>`;
  }

  function fadeSubnav() {
    const over = sub.scrollWidth > sub.clientWidth + 1;
    sub.classList.toggle('more', over && sub.scrollLeft + sub.clientWidth < sub.scrollWidth - 2);
    sub.classList.toggle('more-l', over && sub.scrollLeft > 2);
  }

  function fitSubnav() {
    topbar?.classList.remove('stacked');
    if (!sub.hidden && window.innerWidth > 1380 && sub.scrollWidth > sub.clientWidth + 1) {
      topbar?.classList.add('stacked');
    }
    fadeSubnav();
  }

  function drawSubnav() {
    const tab = tabOf(state.view);
    const cur = viewOf(state.view);
    const items = VIEWS.filter((v) => v.tab === tab && (v.nav !== false || v.id === cur.id));
    sub.hidden = !items.length;
    sub.innerHTML = items.map((v) => subBtn(v, cur.id)).join('');
    placeScreens();
    sub.dataset.tab = tab;
    drawScreens();
    fitSubnav();
  }

  PHONE_MQ.addEventListener('change', () => drawScreens());
  screensEl?.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest('button[data-sc]') as HTMLButtonElement | null;
    if (b && !b.disabled && b.dataset.sc) set({ screen: +b.dataset.sc });
  });
  sub.addEventListener('scroll', fadeSubnav, { passive: true });
  window.addEventListener('resize', fitSubnav);
  sub.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest('button[data-v]') as HTMLElement | null;
    if (b && b.dataset.v) set({ view: b.dataset.v, mode: '' });
  });

  function markSubnav(id: string) {
    sub.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-current', (b as HTMLElement).dataset.v === id ? 'page' : 'false'),
    );
  }

  async function loadViewModule(name: string): Promise<any> {
    if (name === 'helix' || name === 'spiral') {
      return import('./helix');
    }
    return import('./helix');
  }

  async function ensureView(id: string, screen = 1): Promise<MountedView> {
    const key = mountOf(id, screen);
    const existing = mounted.get(key);
    if (existing) return existing;

    const el = document.createElement('section');
    el.className = 'view';
    el.dataset.view = key;
    el.setAttribute('aria-label', viewOf(id).label);
    (el as any).inert = true;
    stage!.appendChild(el);

    const home = key === 'today' && id === 'anatomy';
    const name = moduleOf(id, screen);
    const recentFirst = name === 'ai_now';
    const needs = [...(VIEW_NEEDS[name] || []), ...(home ? ['policy_core'] : recentFirst ? [] : ['past'])];
    if (needs.some((n) => !db.loaded.has(n))) stage!.classList.add('waiting');

    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const [mod] = await Promise.all([
      (D3_FREE.has(name) ? Promise.resolve() : ensureD3().then(frame)).then(() => loadViewModule(name)),
      ensureNow(needs),
    ]);
    stage!.classList.remove('waiting');
    await frame();

    const raced = mounted.get(key);
    if (raced) {
      el.remove();
      return raced;
    }

    const t0 = performance.now();
    const api = mod.default(el, { db, select, tip, markSubnav, openList, openEvidence });
    try {
      performance.measure(`view-mount-${key}`, { start: t0 });
    } catch {
      /* ignore */
    }
    const m: MountedView = {
      el,
      api,
      dirty: true,
      titles: mod.SCREENS || null,
      selfPast: recentFirst,
    };
    mounted.set(key, m);
    return m;
  }

  function reHi(ch?: Set<string>) {
    if (!current) return;
    if (current.api.lit) current.api.lit(walkLit());
    if (!current.api.hover) return;
    if (state.tour) current.api.hover(tourHi(state.view));
    else if (ch && ch.has('tour')) current.api.hover(null);
  }

  let landing = 0;
  function landAt(root: HTMLElement) {
    const key = state.at;
    if (!key) return;
    const t0 = performance.now();
    const my = ++landing;
    const find = () =>
      key.startsWith('m-')
        ? (root.querySelector(`[data-m="${CSS.escape(key.slice(2))}"]`) as HTMLElement | null)
        : key.startsWith('g-')
          ? (root.querySelector(
              `[data-g="${CSS.escape(key.slice(2))}"], [data-game="${CSS.escape(key.slice(2))}"]`,
            ) as HTMLElement | null)
          : (root.querySelector(`#${CSS.escape(key)}`) as HTMLElement | null);
    const tick = () => {
      if (my !== landing || state.at !== key) return;
      const el = find();
      if (!el) {
        if (performance.now() - t0 < 6000) requestAnimationFrame(tick);
        else set({ at: '' }, { replace: true });
        return;
      }
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      if (el.tabIndex < 0) el.tabIndex = -1;
      el.focus({ preventScroll: true });
      el.classList.add('landed');
      setTimeout(() => el.classList.remove('landed'), 2400);
      set({ at: '' }, { replace: true });
    };
    requestAnimationFrame(tick);
  }

  let showToken = 0;
  async function showView(id: string, changed: Set<string>) {
    const my = ++showToken;
    const v = viewOf(id);
    const tab = v.tab;
    nav.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-current', (b as HTMLElement).dataset.tab === tab ? 'page' : 'false'),
    );
    placeTabInd();
    drawSubnav();
    app!.dataset.tab = tab;
    document.documentElement.dataset.tab = tab;
    document.documentElement.dataset.view = id;
    document.body.dataset.page = tab;

    const sc = document.querySelector('.scrubber') as HTMLElement | null;
    const off = tab !== 'past';
    if (sc) {
      if (sc.hidden !== off) {
        sc.hidden = off;
        requestAnimationFrame(() => {
          if (!off) {
            wakeScrubber().then(() => {
              scrub.layout();
              scrub.setRange();
            });
          }
        });
      } else if (!off && scrub === NO_SCRUB) {
        wakeScrubber();
      }
    }
    app!.classList.toggle('dark', DARK.has(id));

    const m = await ensureView(id, state.screen);
    if (my !== showToken) return;
    const switching = current !== m;
    if (switching) {
      await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      if (my !== showToken) return;
    }
    const prev = current;
    current = m;
    drawScreens();

    const t0 = performance.now();
    if (switching || m.dirty) {
      m.api.render(state, switching ? new Set(['*']) : changed);
      m.dirty = false;
    } else {
      m.api.render(state, changed);
    }
    try {
      performance.measure(`view-render-${m.el.dataset.view}`, { start: t0 });
    } catch {
      /* ignore */
    }

    const plate = screenPlate(id, state.screen);
    if (plate && m.api.show) m.api.show(plate);

    if (prev && prev !== m) {
      prev.el.classList.remove('on');
      (prev.el as any).inert = true;
    }
    m.el.classList.add('on');
    (m.el as any).inert = false;
    if (state.at && (switching || changed.has('at') || changed.has('view'))) landAt(m.el);
    reHi();
    for (const [, o] of mounted) {
      if (o !== m) o.dirty = true;
    }
  }

  let noteEl: HTMLElement | null = null;
  let noteT = 0;
  function noteSel(text: string | null) {
    clearTimeout(noteT);
    if (!text) {
      if (noteEl) noteEl.remove();
      noteEl = null;
      return;
    }
    if (!noteEl) {
      noteEl = document.createElement('p');
      noteEl.className = 'drawer-note';
      noteEl.setAttribute('role', 'status');
      document.body.appendChild(noteEl);
    }
    noteEl.textContent = text;
    noteT = window.setTimeout(() => noteSel(null), 9000);
  }

  function indexArrival() {
    const s = state;
    if (!s.sel || !INDEXED[s.view] || !NARROW()) return;
    if (s.view !== 'arcs' && !(s.mode || '').split('.').includes('cx')) return;
    desktopHandOff(s.sel);
  }

  function checkSel(id: string) {
    if (!id) return;
    hasRecord(id)
      .then((ok) => {
        if (ok || state.sel !== id) return;
        set({ view: 'spiral', sel: '', mode: '', at: '' });
        noteSel(isZh() ? '未找到对应史料条目。' : 'No record by that name.');
      })
      .catch(() => {});
  }

  async function startArrival() {
    document.getElementById('intro')?.remove();
    try {
      const [{ runArrival }, hx] = await Promise.all([import('./arrival'), import('./helix')]);
      document.documentElement.classList.remove('arrive');
      runArrival({
        targets: () => hx.arrivalTargets(),
        ready: () => hx.arrivalReady(),
        onReveal: () => hx.onReveal(),
        onDone: () => {
          hx.afterArrival();
          window.dispatchEvent(new Event('histomap:intro-closed'));
        },
      });
    } catch (e) {
      console.error('arrival failed', e);
      document.documentElement.classList.remove('arrive', 'arrival-mode');
      document.getElementById('ar-pre')?.remove();
      try {
        const hx = await import('./helix');
        hx.onReveal();
        hx.afterArrival();
      } catch {
        /* ignore */
      }
    }
  }

  function redrawDrawer(keep = true) {
    const dr = document.getElementById('drawer');
    const body = document.getElementById('db');
    const a = document.activeElement as HTMLElement | null;
    const inside = !!(dr && a && a !== document.body && dr.contains(a));
    const id = inside && a?.dataset ? a.dataset.id || '' : '';
    const top = keep && body ? body.scrollTop : 0;
    renderDrawer();
    if (body && top) body.scrollTop = top;
    const now = document.activeElement;
    if (inside && state.sel && dr?.classList.contains('on') && (!now || now === document.body)) {
      const t =
        (id &&
          (Array.from(dr.querySelectorAll('[data-id]')).find(
            (b) => (b as HTMLElement).dataset.id === id,
          ) as HTMLElement | undefined)) ||
        (dr.querySelector('h3') as HTMLElement | null);
      if (t) {
        if (t.tagName === 'H3') t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }
    }
  }

  async function main() {
    loadingState();
    await load();
    if (!db.events.length) {
      emptyState();
      return;
    }
    partialNote();
    stage!.innerHTML = '';
    Object.assign(state, readHash());
    {
      const p = hashParams();
      if ((p.has('v') && p.get('v') !== state.view) || pathLikeHash()) canonHash();
    }
    performance.mark('m-loaded');

    {
      const nm = moduleOf(state.view, state.screen);
      if (nm) {
        if (!D3_FREE.has(nm)) ensureD3();
        loadViewModule(nm).catch(() => {});
      }
    }

    const isFiltered =
      state.types ||
      state.thread ||
      state.q ||
      (state.domains && state.domains.size < DOMAINS.length) ||
      state.y0 !== YEAR_MIN ||
      state.y1 !== YEAR_MAX;

    const upFilters = (now?: boolean) => {
      if (filtersUp) return;
      filtersUp = true;
      initFilters();
      performance.mark('m-filters');
      if (now) syncFilters();
      else idle(() => syncFilters(), 2000);
    };
    upFiltersRef = upFilters;
    if (isFiltered) upFilters(true);

    initSearch();
    performance.mark('m-search');
    initDrawer();
    performance.mark('m-drawer');

    const qEl = document.getElementById('q') as HTMLInputElement | null;
    const mq = window.matchMedia('(max-width: 1100px)');
    if (qEl) {
      const syncPlaceholder = () => {
        const zh = isZh();
        const w = qEl.getBoundingClientRect().width;
        qEl.placeholder =
          w < 165
            ? zh
              ? '搜索…'
              : 'Search…'
            : zh
              ? '搜索史料、人物…'
              : 'Search records…';
      };
      syncPlaceholder();
      mq.addEventListener('change', syncPlaceholder);
      onLangChange(() => syncPlaceholder());
      subscribe((_s, ch) => {
        if (ch.has('view')) syncPlaceholder();
      });
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(syncPlaceholder).observe(qEl);
      else window.addEventListener('resize', syncPlaceholder);
    }

    performance.mark('m-scrubber');
    performance.mark('m-sync');

    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    onData(async (name) => {
      if (name === 'past') {
        idle(() => {
          scrub.draw();
          if (filtersUp) {
            fillTypes();
            idle(() => {
              fillThreads();
              syncFilters();
              performance.mark('past-shell');
            });
          } else {
            performance.mark('past-shell');
          }
        });
        await frame();
        if (current && !current.selfPast) {
          const home = current.el.dataset.view === 'today' && state.view === 'anatomy';
          current.api.render(state, new Set(home ? ['events'] : ['*']));
          reHi();
        }
        performance.mark('past-view');
        for (const o of mounted.values()) {
          if (o !== current) o.dirty = true;
        }
        await frame();
      }
      if ((name === 'text' || name === 'meta' || name === 'past' || name === 'links') && state.sel) {
        redrawDrawer();
      }
      if (current && current.api.onData) {
        const t = performance.now();
        current.api.onData(name);
        try {
          performance.measure(`view-ondata-${name}`, { start: t });
        } catch {
          /* ignore */
        }
      }
      if (name === 'past') performance.mark('past-ondata');
    });

    renderDrawer();

    if (lean() && document.body.classList.contains('intro-open')) {
      await new Promise<void>((r) => {
        const t = setTimeout(r, 8000);
        window.addEventListener(
          'histomap:intro-closed',
          () => {
            clearTimeout(t);
            r();
          },
          { once: true },
        );
      });
    }

    performance.mark('first-view-start');
    await showView(state.view, new Set(['*']));
    performance.mark('first-view-done');

    idle(() => {
      upFiltersRef();
    }, 3000);

    subscribe(async (s: AppState, ch: Set<string>) => {
      if (filtersUp) syncFilters();
      else if (
        ch.has('domains') ||
        ch.has('types') ||
        ch.has('thread') ||
        ch.has('q') ||
        ch.has('y0') ||
        ch.has('y1')
      ) {
        upFilters(true);
      }
      if (ch.has('sel')) checkSel(s.sel);
      else if (ch.has('view') || ch.has('mode')) noteSel(null);

      document.body.classList.toggle('drawer-open', !!s.sel);
      document.body.classList.toggle('story-on', /^story-/.test(s.mode || ''));

      if (ch.has('domains') || ch.has('types') || ch.has('thread') || ch.has('q')) scrub.draw();
      if (ch.has('y0') || ch.has('y1')) scrub.setRange();
      if (ch.has('sel')) redrawDrawer(false);

      if (ch.has('view') && !ch.has('sel') && s.sel) select('');
      if (ch.has('view') || ch.has('screen')) {
        tip.hide();
        await showView(s.view, ch);
      } else if (current) {
        current.api.render(s, ch);
        reHi(ch);
        if (ch.has('at') && s.at) landAt(current.el);
      }
      for (const o of mounted.values()) {
        if (o !== current) o.dirty = true;
      }
    });

    document.addEventListener('draw-change', () => {
      if (current) {
        current.api.render(state, new Set(['y0', 'y1']));
        reHi(new Set(['y0']));
      }
      for (const o of mounted.values()) {
        if (o !== current) o.dirty = true;
      }
    });

    checkSel(state.sel);
    window.addEventListener('resize', () => {
      if (state.sel) redrawDrawer();
    });
    onHover((id) => current && current.api.hover && current.api.hover(id || tourHi(state.view)));
    initTour();
    performance.mark('m-tour');

    window.addEventListener('hashchange', () => {
      applyHash();
      indexArrival();
    });
    window.addEventListener('popstate', () => {
      applyHash();
      indexArrival();
    });
    indexArrival();

    let rt: number | undefined;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => {
        scrub.layout();
        scrub.setRange();
        placeTabInd();
        if (current) {
          if (current.api.resize) current.api.resize();
          else current.api.render(state, new Set(['*']));
          reHi();
        }
        for (const o of mounted.values()) {
          if (o !== current) o.dirty = true;
        }
      }, 120);
    });
    performance.mark('m-resize');

    if (window.__ARRIVAL) startArrival();
    else initIntro();
    performance.mark('m-intro');

    window.__histomap = { db, state, set, ensure };
    document.documentElement.dataset.ready = '1';

    const t0 = performance.now();
    const drawn = () =>
      document.querySelectorAll('.view.on svg path, .view.on svg circle, .view.on svg rect, .view.on canvas')
        .length > 0;
    const gate = () => {
      if (drawn() || performance.now() - t0 > 1200) {
        markPainted();
        ensure('past')
          .then(() => ensure('series'))
          .then(() => {
            if (!lean()) ensure('meta').then(() => ensure('text'));
          });
      } else {
        requestAnimationFrame(gate);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(gate));
  }

  main().catch((err) => {
    console.error('boot failed', err);
    document.documentElement.dataset.ready = '1';
    const st = document.getElementById('stage');
    if (st && !st.querySelector('.view.on')) {
      st.innerHTML =
        '<section class="view on boot-fail"><p class="boot-note">Map did not finish loading. <a href="#v=spiral" onclick="location.reload()">Reload</a></p></section>';
    }
  });
}
