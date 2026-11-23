// Intro, Zürich Grid: spiral sheet for non-arrival intro fallback (#intro=1 when arrival is disabled).
import { db, census, onData } from './data';
import { set, TABS } from './store';
import { assetUrl } from './basePath';
import { isZh } from './i18n';

const esc = (v: any) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

let _seen = false;
let panel: HTMLElement | null = null;
let last: Element | null = null;
let raf = 0;
let S: any = null;
let closing = false;

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PULSE = 1400;
const DRAW0 = 450;
const DRAW = 3900;
const CUT = 7 * PULSE;
const Y0 = 1026;
const Y1 = 2026;
const TURN = 100;
let INK = '#050b0c';
let WHITE = '#f4f1ea';
let GROUND: string | null = '#0d2629';

const PAL: Record<string, string> = {
  ai: '#E0716B',
  computing: '#28C8C4',
  semiconductors: '#48B4E0',
  software: '#D871A2',
  internet: '#6E9CF4',
  communications: '#9AB4FF',
  media: '#DE708B',
  society: '#CE74B7',
  energy: '#DC7A44',
  transport: '#B68D00',
  biotech: '#07A874',
  space: '#C8860C',
  materials: '#E17460',
  agriculture: '#A6C21A',
  health: '#2CC4A8',
  home: '#F08A6A',
};

let palTried = false;
async function loadPalette() {
  if (palTried) return;
  palTried = true;
  try {
    const pre = window.__introPre && window.__introPre.pal;
    const r = await (pre || fetch(assetUrl(`/data/palette.json${window.__BUILD ? `?v=${window.__BUILD}` : ''}`), { cache: 'no-cache' }));
    if (!r.ok) return;
    const j = await r.json();
    const pick = (o: any) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
    let set0 = pick(j.intro && (j.intro.domains || j.intro)) || pick(j.domains_on_ultramarine) || null;
    if (!set0 && Array.isArray(j.domains)) {
      set0 = Object.fromEntries(j.domains.filter((d: any) => d && d.id).map((d: any) => [d.id, d.intro || d.on_blue || d.color]));
    }
    const I = j.intro || {};
    if (/^#[0-9a-f]{6}$/i.test(I.ground || '')) GROUND = I.ground;
    if (/^#[0-9a-f]{6}$/i.test(I.headline_black || '')) INK = I.headline_black;
    if (/^#[0-9a-f]{6}$/i.test(I.headline_white || '')) WHITE = I.headline_white;
    if (!set0 && j.css) {
      const m: Record<string, string> = {};
      for (const [k, v] of Object.entries(j.css)) {
        const mm = /^--in-(.+)$/.exec(k);
        if (mm) m[mm[1]] = v as string;
      }
      if (Object.keys(m).length) set0 = m;
    }
    if (set0) {
      for (const [k, v] of Object.entries(set0)) {
        const c = typeof v === 'string' ? v : v && ((v as any).hex || (v as any).intro || (v as any).full || (v as any).color);
        if (PAL[k] && /^#[0-9a-f]{6}$/i.test(c || '')) PAL[k] = c;
      }
    }
  } catch {
    /* built-in set stands */
  }
}

const OBJECTS: { id: string; year: number; name: string; nameZh: string; short?: string; d: string; s?: number }[] = [
  { id: 'su-song-astronomical-clock-1092', year: 1092, name: "Su Song's clock", nameZh: '苏颂水运仪象台', d: 'clock' },
  { id: 'jikji-metal-type-1377-1377', year: 1377, name: 'Jikji, printed with movable metal type in Goryeo Korea', nameZh: '《直指心体要节》金属活字本', short: 'Jikji \u00b7 Goryeo Korea', d: 'book' },
  { id: 'gutenberg-press-1450', year: 1450, name: "Gutenberg's press", nameZh: '古腾堡活字印刷机', d: 'press' },
  { id: 'newcomen-engine-1712', year: 1712, name: 'Newcomen engine', nameZh: '纽科门大气蒸汽机', d: 'engine' },
  { id: 'morse-telegraph-1844', year: 1844, name: 'telegraph', nameZh: '莫尔斯电报', d: 'key' },
  { id: 'transistor-1947', year: 1947, name: 'transistor', nameZh: '点接触晶体管', d: 'transistor' },
  { id: 'www-public-1991', year: 1991, name: 'World Wide Web', nameZh: '万维网（WWW）', d: 'web' },
  { id: 'gpt-6-astra-2026', year: 2026, name: 'GPT-6 Astra', nameZh: 'GPT-6 Astra', d: 'model' },
];

const DRAW_OBJ: Record<string, string> = {
  clock: '<path d="M12 38V17h16v21M9 38h22M12 24h16M12 31h16M10 17l3-4h14l3 4M20 13v-3"/><circle cx="20" cy="6.5" r="4"/><path d="M16 6.5h8M20 2.5v8"/>',
  book: '<path d="M5 11c5-2.5 10-2.5 15 1v25c-5-3.5-10-3.5-15-1zM35 11c-5-2.5-10-2.5-15 1v25c5-3.5 10-3.5 15-1z"/><path d="M9 17c3-1 6-1 8 .5M9 22c3-1 6-1 8 .5M9 27c3-1 6-1 8 .5M23 17.5c2-1.5 5-1.5 8-.5M23 22.5c2-1.5 5-1.5 8-.5M23 27.5c2-1.5 5-1.5 8-.5"/>',
  press: '<path d="M8 38V4h24v34M5 38h30M8 11h24M20 11v10M14 15h12M11 21h18v5H11zM11 31h18"/>',
  engine: '<path d="M20 38V13M5 13h30M20 13l-3.5-4h7zM8 13v8M4 21h8v15H4zM32 13v25M1 38h38"/>',
  key: '<path d="M3 32h34v5H3zM8 32v-4h24v4M9 25l22-6M31 19v-4M28 15h6M13 28v-3"/><circle cx="9" cy="25" r="2.2"/>',
  transistor: '<path d="M11 6h18v15H11zM14 21v17M20 21v17M26 21v17M11 11h18"/>',
  web: '<circle cx="20" cy="20" r="15"/><ellipse cx="20" cy="20" rx="6.5" ry="15"/><path d="M5 20h30M7.5 12.5h25M7.5 27.5h25"/>',
  model: '<circle cx="7" cy="9" r="2.6"/><circle cx="7" cy="20" r="2.6"/><circle cx="7" cy="31" r="2.6"/><circle cx="20" cy="14" r="2.6"/><circle cx="20" cy="26" r="2.6"/><circle cx="33" cy="20" r="2.6"/><path d="M9.5 9.6l8 3.6M9.5 19.2l8-4.2M9.5 30l8-14.2M9.5 10.6l8 14M9.5 20.8l8 4.2M9.5 30.4l8-3.6M22.5 14.8l8 4.4M22.5 25.2l8-4.4"/>',
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const inOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function tabKey() {
  return `<ol class="ar-tabkey">${TABS.map((t) => `<li><b>${esc(t.label)}</b> <span>${esc(t.sub || '')}</span></li>`).join('')}</ol>`;
}

function html(F: { N: number; sourced: boolean }) {
  const zh = isZh();
  const word = zh ? (F.sourced ? '条考证史料' : '条编年记录') : F.sourced ? 'sourced' : 'dated';
  const objs = OBJECTS.map((o, i) => {
    const nm = zh ? o.nameZh : o.name;
    return `<g class="sp-obj" data-i="${i}" style="--i:${i}"><line class="sp-lead"/><circle class="sp-pin" r="4.5"/><g class="sp-ic">${DRAW_OBJ[o.d]}</g><text class="sp-nm"><tspan class="y">${o.year}</tspan><tspan class="n" dx="7">${esc(nm)}</tspan></text><title>${esc(nm)}, ${o.year}</title></g>`;
  }).join('');
  return `
  <h2 id="intro-h" class="sp-hl"><span class="ln" style="--i:0">${zh ? '技术演进' : 'Technology'}</span><span class="ln" style="--i:1">${zh ? '全图' : 'Histomap'}</span></h2>
  <canvas class="sp-cv" aria-hidden="true"></canvas>
  <svg class="sp-svg" aria-hidden="true">${objs}</svg>
  <p class="ar-vh">${
    zh
      ? `涵盖 ${fmt(F.N)} 条技术史记录的螺旋年表，${Y0} 至 ${Y1} 年每世纪旋转一圈，八条远古根脉追溯至公元前 330 万年。`
      : `A spiral timeline of ${fmt(F.N)} from ${Y0} to ${Y1}, one turn per century, with roots reaching back to 3.3 million BCE.`
  }</p>
  <div class="sp-tb">
    <div class="sp-tb-n"><b>${fmt(F.N)}</b> <span>${word}</span></div>
    <div class="sp-tb-k">${zh ? `${Y0}—${Y1} 每世纪一圈 · 八脉溯源远古` : `${Y0} to ${Y1}, one turn per century, with its roots`}</div>
    <button type="button" class="sp-start" data-a="enter">${zh ? '进入星图' : 'Start'} <span aria-hidden="true">&rarr;</span></button>
  </div>`;
}

function coil(g: any, t: number): [number, number, number, number] {
  const k = (t - Y0) / (Y1 - Y0);
  const r = g.r0 + (g.R - g.r0) * k;
  const a = g.aEnd + (2 * Math.PI * (t - Y1)) / TURN;
  return [g.cx + r * Math.cos(a), g.cy + r * Math.sin(a), r, a];
}

function stack(g: any, list = S.dots, reset = true) {
  if (!reset) return place(g, list);
  const step = g.pitch < 2 ? 0.1 : 0.05;
  const n = Math.round((S.tEnd - Y0) / step) + 1;
  const s = new Float64Array(n);
  let px = 0;
  let py = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = coil(g, Y0 + i * step);
    s[i] = i ? s[i - 1] + Math.hypot(x - px, y - py) : 0;
    px = x;
    py = y;
  }
  g.s = s;
  g.step = step;
  g.L = s[n - 1];
  const sAt = (t: number) => {
    const f = clamp((t - Y0) / step, 0, n - 1);
    const i = Math.floor(f);
    return i >= n - 1 ? s[n - 1] : s[i] + (s[i + 1] - s[i]) * (f - i);
  };
  g.sAt = sAt;
  g.nS = n;
  g.tOfS = (sv: number) => {
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] < sv) lo = mid;
      else hi = mid;
    }
    const f = s[hi] > s[lo] ? (sv - s[lo]) / (s[hi] - s[lo]) : 0;
    return Y0 + (lo + f) * step;
  };
  g.hgt = new Float64Array(Math.ceil(g.L / g.pitch) + 8);
  g.reach = g.R;
  return place(g, list);
}

function place(g: any, list: any[]) {
  const hgt = g.hgt;
  const nb = hgt.length;
  const sAt = g.sAt;
  const SPREAD = 4;
  const put = (d: any, b: number) => {
    const k = hgt[b];
    hgt[b] += d.lm ? 2 : 1;
    const [, , r, a] = coil(g, g.tOfS((b + 0.5) * g.pitch));
    const rr = r + (d.lm ? k : k + 0.5) * g.pitch;
    d.x = g.cx + rr * Math.cos(a);
    d.y = g.cy + rr * Math.sin(a);
    d.s = sAt(d.t);
    g.reach = Math.max(g.reach, rr + (d.lm ? g.lmR : g.dotR));
  };
  for (const pass of [1, 0]) {
    for (const d of list) {
      if (d.lm !== pass) continue;
      const home = Math.min(nb - 1, Math.floor(sAt(d.t) / g.pitch));
      let best = home;
      for (let j = 1; j <= SPREAD; j++) {
        for (const c of [home - j, home + j]) {
          if (c >= 0 && c < nb && hgt[c] < hgt[best] - 0.5) best = c;
        }
      }
      put(d, best);
    }
  }
  return g.reach;
}

function layout() {
  if (!panel || !S) return;
  const W = panel.clientWidth;
  const H = panel.clientHeight;
  const wide = W / H >= 1.05;
  const hl = panel.querySelector('.sp-hl') as HTMLElement;
  const hr = hl.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  const m = Math.round(hr.left - pr.left);
  const fs = parseFloat(getComputedStyle(hl).fontSize) || 60;
  const hlW = fs * 5.5;
  const hlH = fs * 0.9 * 4;
  S.hlW0 = hr.width;
  S.hlH0 = hr.height;
  S.m = m;
  const tb = panel.querySelector('.sp-tb') as HTMLElement;
  const tbH = tb.offsetHeight || 120;
  const small = W < 700;
  const g: any = { pitch: small ? 1.5 : 2.3, dotR: small ? 0.65 : 0.95, lmR: small ? 1.9 : 2.7, wide };
  const boxEast = wide ? [m + hlW + Math.max(24, W * 0.04), m, W - m, H - m] : [m, m + hlH + Math.max(14, m), W - m, H - m - tbH - 10];
  const boxSouth = [m, m + hlH + Math.max(14, m), W - m, H - m - tbH - 10];
  const solve = (box: number[], east: boolean) => {
    const bw = box[2] - box[0];
    const bh = box[3] - box[1];
    g.aEnd = east ? 0 : Math.PI / 2;
    const fit = (R: number) => {
      g.R = R;
      g.r0 = R * 0.05;
      if (east) {
        g.cx = box[0] + R;
        g.cy = (box[1] + box[3]) / 2;
      } else {
        g.cx = (box[0] + box[2]) / 2;
        g.cy = box[1] + R;
      }
      const reach = stack(g);
      if (east) {
        g.cx = box[0] + (bw - (R + reach)) / 2 + R;
        stack(g);
      }
      return east ? R + reach <= bw && R <= bh / 2 : R + reach <= bh && R <= bw / 2;
    };
    let R = Math.min(bw, bh) / 2;
    while (R > 60 && !fit(R)) R *= 0.98;
    return R;
  };
  let east = true;
  if (!wide) {
    const rE = solve(boxEast, true);
    const rS = solve(boxSouth, false);
    east = rE > rS * 1.04;
  }
  const R = solve(east ? boxEast : boxSouth, east);
  g.east = east;
  g.R = R;
  g.r0 = R * 0.05;
  g.aEnd = east ? 0 : Math.PI / 2;
  {
    const box = east ? boxEast : boxSouth;
    const bw = box[2] - box[0];
    if (east) {
      g.cx = box[0] + R;
      g.cy = (box[1] + box[3]) / 2;
      const reach = stack(g);
      g.cx = box[0] + (bw - (R + reach)) / 2 + R;
    } else {
      g.cx = (box[0] + box[2]) / 2;
      g.cy = box[1] + R;
    }
    stack(g);
  }
  S.g = g;
  const cv = panel.querySelector('.sp-cv') as HTMLCanvasElement;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  S.ctx = cv.getContext('2d')!;
  S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S.W = W;
  S.H = H;
  const pts: [number, number, number, number][] = [];
  for (let t = Y0; t <= S.tEnd + 1e-9; t += 0.25) pts.push(coil(g, t));
  S.pts = pts;
  placeObjects(W, H, m, tb);
}

function placeObjects(W: number, H: number, m: number, tb: HTMLElement) {
  if (!panel || !S) return;
  const g = S.g;
  const svg = panel.querySelector('.sp-svg') as SVGSVGElement;
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const small = W < 600;
  const ic = small ? 18 : 30;
  const fsz = small ? 11 : 14;
  const hlR = panel.querySelector('.sp-hl')!.getBoundingClientRect();
  const tbR = tb.getBoundingClientRect();
  const blocks: number[][] = [
    [hlR.left - 4, hlR.top - 4, hlR.right + 4, hlR.bottom + 4],
    [tbR.left - 16, tbR.top - 16, tbR.right + 8, tbR.bottom + 8],
  ];
  for (const o of OBJECTS) {
    const [px, py] = coil(g, Math.min(o.year + 0.5, S.tEnd));
    blocks.push([px - 6, py - 6, px + 6, py + 6]);
  }
  const bx = S.dots.filter((d: any) => d.t >= Y1 - 3 && Math.hypot(d.x - g.cx, d.y - g.cy) > g.R + g.pitch * 2);
  if (bx.length) {
    blocks.push([
      Math.min(...bx.map((d: any) => d.x)) - 2,
      Math.min(...bx.map((d: any) => d.y)) - 2,
      Math.max(...bx.map((d: any) => d.x)) + 2,
      Math.max(...bx.map((d: any) => d.y)) + 2,
    ]);
  }
  const CELL = 6;
  const gw = Math.ceil(W / CELL);
  const occ = new Uint16Array(gw * Math.ceil(H / CELL));
  for (const d of S.dots) {
    const ix = Math.floor(d.x / CELL);
    const iy = Math.floor(d.y / CELL);
    if (ix >= 0 && ix < gw && iy >= 0 && iy * gw + ix < occ.length) occ[iy * gw + ix]++;
  }
  const dense = (b: number[]) => {
    let n = 0;
    for (let y = Math.max(0, Math.floor(b[1] / CELL)); y <= Math.floor(b[3] / CELL); y++) {
      for (let x = Math.max(0, Math.floor(b[0] / CELL)); x <= Math.min(gw - 1, Math.floor(b[2] / CELL)); x++) {
        n += Math.max(0, (occ[y * gw + x] || 0) - 2);
      }
    }
    return n;
  };
  const area = (b: number[]) =>
    blocks.reduce(
      (acc, c) => acc + Math.max(0, Math.min(b[2], c[2]) - Math.max(b[0], c[0])) * Math.max(0, Math.min(b[3], c[3]) - Math.max(b[1], c[1])),
      0,
    );
  const outB = (b: number[]) =>
    Math.max(0, m * 0.5 - b[0]) + Math.max(0, b[2] - (W - m * 0.5)) + Math.max(0, m * 0.5 - b[1]) + Math.max(0, b[3] - (H - m * 0.5));
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `500 ${fsz}px 'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif`;
  const order = OBJECTS.map((_, i) => i).sort((p, q) => OBJECTS[p].year - OBJECTS[q].year);
  for (const i of order) {
    const o = OBJECTS[i];
    const el = svg.querySelector(`.sp-obj[data-i="${i}"]`)!;
    const tO = Math.min(o.year + 0.5, S.tEnd);
    const [qx, qy, r, a] = coil(g, tO);
    const names = o.short ? (W < 1400 ? [o.short] : [o.name, o.short]) : [o.name];
    for (const nm of names) {
      const isLast = nm === names[names.length - 1];
      const tw = ctx.measureText(`${o.year}  ${nm}`).width;
      const t = el.querySelector('.sp-nm') as SVGTextElement;
      const pin = el.querySelector('.sp-pin') as SVGCircleElement;
      const lead = el.querySelector('.sp-lead') as SVGLineElement;
      const icg = el.querySelector('.sp-ic') as SVGGElement;
      t.style.fontSize = fsz + 'px';
      let best: any = null;
      let bestScore = Infinity;
      const consider = (bb: number[], extra: number, data: any) => {
        const sc = area(bb) + outB(bb) * 400 + dense(bb) * 40 + extra;
        if (sc < bestScore) {
          bestScore = sc;
          best = { b: bb, ...data };
        }
        return sc === 0;
      };
      if (small) {
        const icB = [qx - ic / 2 - 2, qy - ic / 2 - 2, qx + ic / 2 + 2, qy + ic / 2 + 2];
        const h = fsz + 4;
        const cands: [string, number, number, number][] = [];
        for (const dy of [0, -9, 9, -18, 18]) {
          cands.push(['r', qx + ic / 2 + 4, qy + dy - h / 2, dy]);
          cands.push(['l', qx - ic / 2 - 4 - tw, qy + dy - h / 2, dy]);
        }
        for (const dx of [0, -20, 20]) {
          cands.push(['b', qx - tw / 2 + dx, qy + ic / 2 + 3, 30]);
          cands.push(['a', qx - tw / 2 + dx, qy - ic / 2 - 3 - h, 30]);
        }
        for (const [side, x0, y0, pen] of cands) {
          const bb = [x0, y0, x0 + tw, y0 + h];
          if (consider(bb, Math.abs(pen) + area(icB), { side, x0, y0, h, icB })) break;
        }
        if (bestScore > 0 && !isLast) continue;
        t.querySelector('.n')!.textContent = nm;
        const { b, side } = best;
        icg.setAttribute('transform', `translate(${qx - ic / 2},${qy - ic / 2}) scale(${ic / 40})`);
        pin.setAttribute('cx', String(qx));
        pin.setAttribute('cy', String(qy));
        pin.setAttribute('r', String(ic / 2 + 1.5));
        pin.classList.add('disc');
        lead.setAttribute('x1', String(qx));
        lead.setAttribute('y1', String(qy));
        lead.setAttribute('x2', String(qx));
        lead.setAttribute('y2', String(qy));
        t.setAttribute('x', String(side === 'l' ? b[2] : side === 'r' ? b[0] : (b[0] + b[2]) / 2));
        t.setAttribute('y', String((b[1] + b[3]) / 2));
        t.setAttribute('text-anchor', side === 'l' ? 'end' : side === 'r' ? 'start' : 'middle');
        blocks.push([b[0] - 3, b[1] - 2, b[2] + 3, b[3] + 2], best.icB);
      } else {
        const w = ic + 8 + tw;
        const h = Math.max(ic, fsz + 4);
        const reachEnd =
          o.year >= Y1
            ? Math.max(...S.dots.filter((d: any) => d.t >= Y1 - 0.6).map((d: any) => Math.hypot(d.x - g.cx, d.y - g.cy)), r)
            : r;
        const out = Math.max(g.R, 0) - r;
        const dists = o.year >= Y1 ? [16, -18, reachEnd - r + 16, -34] : [16, 26, 40, -16, -28, -42, out + 18, out + 32, out + 48];
        for (const dist of dists) {
          for (const slide of [0, 14, -14, 28, -28, 44, -44]) {
            const rr = Math.max(8, r + dist);
            const aa = a + slide / rr;
            const ax = g.cx + rr * Math.cos(aa);
            const ay = g.cy + rr * Math.sin(aa);
            const pref = Math.cos(aa) < -0.2;
            for (const left of [pref, !pref]) {
              const x0 = left ? ax - w : ax;
              const bb = [x0, ay - h / 2, x0 + w, ay + h / 2];
              const lx = left ? bb[2] : bb[0];
              const ly = (bb[1] + bb[3]) / 2;
              consider(bb, (left !== pref ? 30 : 0) + 1.0 * Math.hypot(lx - qx, ly - qy), { left });
            }
          }
        }
        if (bestScore > 0 && !isLast) continue;
        t.querySelector('.n')!.textContent = nm;
        const { b, left } = best;
        const icx = left ? b[2] - ic : b[0];
        const icy = (b[1] + b[3]) / 2 - ic / 2;
        icg.setAttribute('transform', `translate(${icx},${icy}) scale(${ic / 40})`);
        t.setAttribute('x', String(left ? icx - 8 : icx + ic + 8));
        t.setAttribute('y', String((b[1] + b[3]) / 2));
        t.setAttribute('text-anchor', left ? 'end' : 'start');
        pin.setAttribute('cx', String(qx));
        pin.setAttribute('cy', String(qy));
        pin.setAttribute('r', '4.5');
        pin.classList.remove('disc');
        const ex = left ? icx + ic + 2 : icx - 2;
        const ey = (b[1] + b[3]) / 2;
        lead.setAttribute('x1', String(qx));
        lead.setAttribute('y1', String(qy));
        lead.setAttribute('x2', String(ex));
        lead.setAttribute('y2', String(ey));
        blocks.push([b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4]);
      }
      break;
    }
    o.s = g.sAt(tO);
  }
}

function toDots(records: any[]) {
  const groups = new Map<string, any[]>();
  for (const e of records) {
    if (!(e.year >= Y0 && e.year <= Y1) || e.kind === 'overlay' || S.ids.has(e.id)) continue;
    const key = e.month ? `${e.year}-${e.month}${e.day ? '-' + e.day : ''}` : `${e.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const out: any[] = [];
  for (const list of groups.values()) {
    const e0 = list[0];
    const start = e0.month ? e0.year + (e0.month - 1) / 12 + (e0.day ? (e0.day - 1) / 365 : 0) : e0.year;
    const span = e0.month ? (e0.day ? 1 / 365 : 1 / 12) : 1;
    list.forEach((e, i) => {
      S.ids.add(e.id);
      out.push({ id: e.id, t: start + (span * (i + 0.5)) / list.length, lm: e.landmark || S.phone ? 1 : 0, c: PAL[e.domain] || WHITE });
    });
  }
  return out;
}

const byT = (a: any, b: any) => a.t - b.t;
function firstDots(records: any[]) {
  S.dots = toDots(records).sort(byT);
  S.tEnd = Math.max(Y1, S.dots.length ? S.dots[S.dots.length - 1].t : Y1);
  layout();
}
function moreDots(records: any[]) {
  const add = toDots(records);
  if (!add.length || !S.g) return;
  place(S.g, add);
  S.dots = S.dots.concat(add).sort(byT);
}

function fracOfS(s: number) {
  const g = S.g;
  const a = g.s;
  if (s >= g.L) return 1;
  let lo = 0;
  let hi = a.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < s) lo = mid;
    else hi = mid;
  }
  const f = a[hi] > a[lo] ? (s - a[lo]) / (a[hi] - a[lo]) : 0;
  return ((lo + f) * g.step) / (S.tEnd - Y0);
}

function draw(t: number) {
  if (!S || !S.g || !panel) return;
  const { ctx, g, W, H } = S;
  ctx.clearRect(0, 0, W, H);
  const k = reduced() ? 1 : inOut(clamp((t - DRAW0) / DRAW));
  const sNow = k * g.L;
  ctx.beginPath();
  let started = false;
  const nPts = S.pts.length;
  const frontT = Y0 + (S.tEnd - Y0) * fracOfS(sNow);
  for (let i = 0; i < nPts; i++) {
    const tt = Y0 + i * 0.25;
    if (tt > frontT) {
      const [x, y] = coil(g, frontT);
      ctx.lineTo(x, y);
      break;
    }
    const p = S.pts[i];
    if (!started) {
      ctx.moveTo(p[0], p[1]);
      started = true;
    } else {
      ctx.lineTo(p[0], p[1]);
    }
  }
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = g.pitch < 2 ? 0.75 : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (let pass = 0; pass < 2; pass++) {
    for (const d of S.dots) {
      if (d.s > sNow) break;
      if (pass === 0 && d.lm) continue;
      if (pass === 1 && !d.lm) continue;
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.lm ? g.lmR : g.dotR, 0, Math.PI * 2);
      ctx.fill();
      if (d.lm) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  panel.querySelectorAll('.sp-obj').forEach((el, i) => el.classList.toggle('on', reduced() || (OBJECTS[i].s || 0) <= sNow + 1));
}

function finished() {
  if (S.done) return;
  S.done = true;
  try {
    performance.mark('intro-finished');
  } catch {
    /* ignore */
  }
}

function frame(now: number) {
  if (!S) return;
  const dt = S.last ? Math.min(50, now - S.last) : 16;
  S.last = now;
  S.t += dt;
  if (!S.phone || S.redraw) {
    draw(S.t);
    S.redraw = false;
  }
  if (!S.done && S.t >= DRAW0 + DRAW && (S.phone || db.loaded.has('past'))) finished();
  if (reduced()) {
    draw(CUT);
    finished();
    raf = 0;
    return;
  }
  if (S.t >= CUT) {
    finish('enter');
    return;
  }
  raf = requestAnimationFrame(frame);
}

function finish(how?: string) {
  if (!panel || panel.hidden || closing) return;
  cancelAnimationFrame(raf);
  raf = 0;
  if (how === 'enter') {
    closeIntro({ restore: false });
    set({ view: 'spiral', mode: '', sel: '' });
  } else closeIntro();
}

function focusables() {
  if (!panel) return [];
  return [...panel.querySelectorAll('button')].filter((x) => !x.disabled && x.offsetParent !== null);
}

const PHONE = 700;
function sheet() {
  if (!panel) return;
  if (!panel.querySelector('.sp-hl')) panel.innerHTML = html({ N: 4823, sourced: true });
  const svg = panel.querySelector('.sp-svg');
  if (svg && !svg.querySelector('.sp-obj')) {
    svg.innerHTML = OBJECTS.map(
      (o, i) =>
        `<g class="sp-obj" data-i="${i}" style="--i:${i}"><line class="sp-lead"/><circle class="sp-pin" r="4.5"/><g class="sp-ic">${DRAW_OBJ[o.d]}</g><text class="sp-nm"><tspan class="y">${o.year}</tspan><tspan class="n" dx="7">${esc(o.name)}</tspan></text><title>${esc(o.name)}, ${o.year}</title></g>`,
    ).join('');
  }
}

function recount() {
  if (!panel || !(db.loaded.has('past') || db.manifest) || !db.events.length) return;
  const b = panel.querySelector('.sp-tb-n b');
  const n = fmt(census().events);
  if (b && b.textContent !== n) b.textContent = n;
}

function paint() {
  if (!panel) return;
  if (GROUND) panel.style.setProperty('--in-ground', GROUND);
  panel.style.setProperty('--in-black', INK);
  panel.style.setProperty('--in-white', WHITE);
}

function startCoil() {
  if (!S || S.g || S.phone || !db.events || !db.events.length) return;
  firstDots(db.events);
  try {
    performance.mark('intro-coil');
  } catch {
    /* ignore */
  }
  S.redraw = true;
  if (reduced()) draw(CUT);
  if (!raf) raf = requestAnimationFrame(frame);
  recount();
}

function onWave(name: string) {
  if (!S || !panel || panel.hidden) return;
  if (name === 'core') {
    startCoil();
    recount();
  }
  if (name === 'past') {
    if (!S.phone) {
      if (!S.g) startCoil();
      else moreDots(db.events);
      try {
        performance.mark('intro-past');
      } catch {
        /* ignore */
      }
    } else if (S.g) {
      const before = S.dots.length;
      S.dots = S.dots.filter((d: any) => {
        const e = db.byId && db.byId.get(d.id);
        return !e || e.kind !== 'overlay';
      });
      if (S.dots.length !== before) S.redraw = true;
    }
    S.redraw = true;
    if (reduced() && S.g) draw(CUT);
    recount();
  }
}
onData(onWave);

export function openIntro() {
  if (!panel) return;
  last = document.activeElement;
  sheet();
  panel.classList.remove('sp-boot');
  panel.classList.toggle('sp-reduced', reduced());
  panel.hidden = false;
  document.documentElement.classList.remove('arrive');
  paint();
  document.body.classList.add('intro-open');
  const app = document.getElementById('app');
  if (app) (app as any).inert = true;
  S = { t: 0, last: 0, dots: [], ids: new Set<string>(), phone: window.innerWidth < PHONE, done: false };
  (panel.querySelector('.sp-start') as HTMLElement | null)?.focus({ preventScroll: true });
  const pal = loadPalette();
  if (S.phone) {
    const reg = (
      (window.__introPre && window.__introPre.lm) ||
      fetch(assetUrl(`/data/landmarks.json${window.__BUILD ? `?v=${window.__BUILD}` : ''}`))
    )
      .then((r) => (r && r.ok ? r.json() : null))
      .catch(() => null);
    Promise.all([pal, reg]).then(([, L]) => {
      if (!S || S.g) return;
      paint();
      const list = L && Array.isArray(L.register) ? L.register.filter((e: any) => e.kind !== 'overlay') : (db.events || []).filter((e) => e.landmark);
      firstDots(list);
      if (db.loaded.has('past')) onWave('past');
      draw(CUT);
      try {
        performance.mark('intro-coil');
        performance.mark('intro-finished');
      } catch {
        /* ignore */
      }
      S.done = true;
      recount();
      if (!raf) raf = requestAnimationFrame(frame);
    });
  } else {
    pal.then(() => {
      if (!S) return;
      paint();
      startCoil();
    });
    const look = () => {
      if (!S || S.g || !panel || panel.hidden) return;
      if (db.events && db.events.length) startCoil();
      else setTimeout(look, 60);
    };
    setTimeout(look, 0);
  }
  const refit = () => {
    if (!S || !S.g || !panel || panel.hidden) return;
    placeObjects(S.W, S.H, S.m, panel.querySelector('.sp-tb') as HTMLElement);
  };
  if (document.fonts) {
    document.fonts.ready.then(refit);
    document.fonts.addEventListener('loadingdone', refit);
  }
}

function relayout() {
  if (!S || !S.g) return;
  layout();
  S.redraw = true;
  draw(S.phone ? CUT : S.t);
}

function landHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const had = location.hash;
  p.delete('intro');
  if (!p.get('v')) p.set('v', 'spiral');
  const h = '#' + p.toString();
  if (h !== had) History.prototype.replaceState.call(window.history, window.history.state, '', h);
}

export function closeIntro({ restore = true } = {}) {
  if (!panel || panel.hidden || closing) return;
  _seen = true;
  closing = true;
  landHash();
  cancelAnimationFrame(raf);
  raf = 0;
  S = null;
  document.body.classList.add('intro-done');
  document.body.classList.remove('intro-open');
  const app = document.getElementById('app');
  if (app) (app as any).inert = false;
  if (restore && last && last.isConnected && last !== document.body) (last as HTMLElement).focus();
  else document.getElementById('stage')?.focus({ preventScroll: true });
  dispatchEvent(new CustomEvent('histomap:intro-closed'));
  const hide = () => {
    if (panel) panel.hidden = true;
    closing = false;
  };
  if (reduced()) hide();
  else requestAnimationFrame(() => requestAnimationFrame(hide));
}

function complete() {
  if (S && S.g && S.t < DRAW0 + DRAW) {
    S.t = DRAW0 + DRAW;
    S.redraw = true;
  }
}

function wire(el: HTMLElement) {
  if (panel === el) return;
  panel = el;
  panel.classList.add('intro', 'spiral');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'intro-h');
  panel.tabIndex = -1;
  window.__introLive = true;
  panel.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (b) {
      if (b.dataset.a === 'enter') finish('enter');
      return;
    }
    if (S && S.phone) finish('enter');
    else complete();
  });
  panel.addEventListener('keydown', (ev) => {
    const tgt = ev.target as HTMLElement;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      finish('enter');
      return;
    }
    if (ev.key === 'Enter' && !tgt.closest('button')) {
      ev.preventDefault();
      finish('enter');
      return;
    }
    if (ev.key === ' ' || ev.key === 'ArrowRight') {
      if (!tgt.closest('button')) {
        ev.preventDefault();
        complete();
      }
      return;
    }
    if (ev.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    ev.preventDefault();
    f[0].focus();
  });
  let rt: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    if (!panel || panel.hidden || !S || !S.g) return;
    if (rt) clearTimeout(rt);
    rt = setTimeout(relayout, 120);
  });
  window.__openIntro = openIntro;
  window.__intro = {
    PULSE,
    CUT,
    DRAW0,
    DRAW,
    seek(t: number, hold = true) {
      if (!S || !S.g) return;
      S.t = t;
      S.last = 0;
      cancelAnimationFrame(raf);
      raf = 0;
      draw(S.phone ? CUT : t);
      if (!hold) raf = requestAnimationFrame(frame);
    },
    layoutMs() {
      const t0 = performance.now();
      relayout();
      return performance.now() - t0;
    },
    state() {
      return S && S.g
        ? {
            t: S.t,
            R: S.g.R,
            cx: S.g.cx,
            cy: S.g.cy,
            dots: S.dots.length,
            landmarks: S.dots.filter((d: any) => d.lm).length,
            phone: S.phone,
          }
        : null;
    },
  };
}

function wanted() {
  if (window.__ARRIVAL) return false;
  const h = location.hash.slice(1);
  const bare = !/(^|&)(v|tr|e|m)=/.test(h);
  return /(^|&)intro=1/.test(h) || (!_seen && bare);
}

export function initIntro() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('intro');
  if (!el) return;
  wire(el);
  if (wanted()) openIntro();
  else {
    el.hidden = true;
    el.classList.remove('sp-boot');
    document.documentElement.classList.remove('arrive');
  }
}
