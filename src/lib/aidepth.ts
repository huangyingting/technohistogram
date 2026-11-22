import * as d3 from 'd3';
import { db, host } from './data';

const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const NOW_T = 2026 + 9.5 / 12;

export const BCAT: Record<string, { label: string; color: string }> = {
  vision: { label: 'Vision', color: '#2d5a88' },
  language: { label: 'Language', color: '#3f8f78' },
  knowledge: { label: 'Knowledge', color: '#8f6aa0' },
  math: { label: 'Math', color: '#8a4e2c' },
  code: { label: 'Code', color: '#d8603c' },
  reasoning: { label: 'Reasoning', color: '#b8282e' },
  agentic: { label: 'Agents', color: '#3c4180' },
};

export const BSHORT: Record<string, string> = {
  'imagenet-top5': 'ImageNet top-5',
  'imagenet-top1': 'ImageNet top-1',
  glue: 'GLUE',
  superglue: 'SuperGLUE',
  mmlu: 'MMLU',
  gsm8k: 'GSM8K',
  math: 'MATH',
  'math-level-5': 'MATH Level 5',
  humaneval: 'HumanEval',
  'gpqa-diamond': 'GPQA Diamond',
  'swe-bench-verified': 'SWE-bench Verified',
  'arc-agi-1': 'ARC-AGI-1',
  'arc-agi-2': 'ARC-AGI-2',
  'arc-agi-3': 'ARC-AGI-3',
  'humanitys-last-exam': "Humanity's Last Exam",
  frontiermath: 'FrontierMath',
  osworld: 'OSWorld',
  'osworld-2': 'OSWorld 2.0',
  'apex-agents': 'APEX-Agents',
};

export const bshort = (b: any) => BSHORT[b.key] || b.name.replace(/\s*\(.*\)\s*$/, '');
export const bcolor = (b: any) => (BCAT[b.domain] || { color: '#6e6e6a' }).color;
export const pct = (b: any, v: number | null) =>
  v == null ? null : b.higher_is_better ? (v / (b.max_score || 100)) * 100 : 100 - v;
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtYM = (d: string | number | null | undefined) => {
  if (!d) return '';
  const [y, m] = String(d).split('-').map(Number);
  return (m ? MON[m - 1] + ' ' : '') + y;
};

export const DGROUPS = [
  ['reasoning', 'Reasoning', ['reasoning', 'math'], 'Reasoning and math benchmarks'],
  ['code', 'Code', ['code'], 'Code benchmarks'],
  ['agents', 'Agents', ['agentic'], 'Agent and computer-use benchmarks'],
  ['vision', 'Vision', ['vision'], 'Vision benchmarks'],
  ['knowledge', 'Knowledge', ['knowledge', 'language'], 'Knowledge and language benchmarks'],
];

export const MAKERS = [
  ['independent', 'Independent', 'No frontier lab or lab-serving data vendor created, co-authored or funded the benchmark'],
  ['linked', 'Lab-linked', 'A frontier lab or a data vendor that sells to labs created, co-authored or funded the benchmark'],
];

const MK_LAB = /openai|deepmind|anthropic|google|microsoft|meta\b|salesforce|scale ai|mercor|cohere|nvidia|facebook/i;
export const makerOf = (b: any, over?: any) => {
  const m = over && over[b.key || b.id];
  if (m) return m.independent === false ? 'linked' : 'independent';
  return MK_LAB.test(b.creator || '') ? 'linked' : 'independent';
};
export const makerInfo = (b: any, over?: any) => (over && over[b.key || b.id]) || null;
export const firstSentence = (t: string, n = 140) => {
  const s = String(t || '').split(/(?<=[.!?])\s+/)[0] || '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '\u2026' : s;
};
export const yrs = (n: number) => (n < 1 ? `${Math.max(1, Math.round(n * 12))} mo` : `${n < 10 ? n.toFixed(1) : Math.round(n)} yr`);

export const TGROUPS = [
  { id: 'else', label: 'Elsewhere', color: '#7d7668', orgs: ['_else'] },
  {
    id: 'google',
    label: 'Google and its alumni',
    color: '#2d5a88',
    orgs: ['discovery-loop', 'sakana', 'near', 'cohere', 'essential-ai', 'adept', 'character-ai', 'reka', 'reflection-ai', 'inflection', 'google-brain', 'deepmind'],
  },
  {
    id: 'openai',
    label: 'OpenAI and its alumni',
    color: '#3f8f78',
    orgs: ['openai', 'anthropic', 'ssi', 'thinking-machines-lab', 'periodic-labs', 'eureka-labs', 'perplexity'],
  },
  { id: 'meta', label: 'Meta, Microsoft, Mistral', color: '#8f6aa0', orgs: ['meta-fair', 'meta-superintelligence-labs', 'ami-labs', 'mistral', 'microsoft-ai'] },
  { id: 'indie', label: 'Independent labs', color: '#c48a1c', orgs: ['xai', 'scale-ai', 'world-labs', 'windsurf', 'hugging-face', 'stability-ai'] },
  { id: 'china', label: 'China', color: '#b8282e', orgs: ['deepseek', 'moonshot', 'zhipu', '01-ai'] },
];

export const TORG_GROUP = new Map(TGROUPS.flatMap((g) => g.orgs.map((o) => [o, g])));
export const orgName = (id: string) => (id === '_else' ? 'Elsewhere' : db.orgById.get(id)?.name || id || 'Not stated');
export const orgShort = (id: string) =>
  id === '_else'
    ? 'Elsewhere'
    : (db.orgById.get(id)?.name || id)
        .replace(/\s*\(.*\)\s*$/, '')
        .replace(/^Advanced Machine Intelligence Labs/, 'AMI Labs')
        .replace(/^Safe Superintelligence Inc\./, 'SSI')
        .replace(/^Thinking Machines Lab$/, 'Thinking Machines');
export const laneOf = (o: string | null) => (o && db.orgById.has(o) && TORG_GROUP.has(o) ? o : '_else');
export const isFounding = (m: any) => {
  const o = db.orgById.get(m.to_org);
  const p = db.personById.get('person:' + m.person);
  return !!(o && p && (o.founders || []).includes(p.name) && (!o.t || Math.abs(m.t - o.t) <= 1.05));
};

const ROLE_FILLER =
  /^(?:(?:Academic\/research role|Research role|Role prior to move|Joined) \((?:specific )?title (?:not stated|per source note)\)|Title not stated)$/i;
const span = (r: any) =>
  r.start || r.end
    ? `${r.start ? fmtYM(r.start) : 'start not stated'}${r.end ? ' to ' + fmtYM(r.end) : r.start ? ' onward' : ''}`
    : 'dates not stated';

export function personDrawer(p: any, $: (sel: string) => HTMLElement | null) {
  const founded = [...db.orgById.values()].filter((o: any) => (o.founders || []).includes(p.name));
  const g = TORG_GROUP.get(laneOf(p.moves.length ? p.moves[p.moves.length - 1].to_org : null)) || TGROUPS[0];
  $('#dk')!.innerHTML = `<i style="background:${g.color}"></i>Person <span aria-hidden="true">&middot;</span> ${p.moves.length} move${p.moves.length === 1 ? '' : 's'}${p.stub ? ' <span aria-hidden="true">&middot;</span> minimal entry' : ''}`;
  const roles = p.roles.slice();
  const srcs = [...new Map([...roles.map((r: any) => r.source_url), ...p.moves.map((m: any) => m.source_url)].filter(Boolean).map((u) => [u, u])).keys()];
  const rel = db.events.filter((e) => (e.people || []).includes(p.name)).sort((a, b) => a.t - b.t).slice(0, 8);
  const row = (x: any) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:var(--ink-3)"></i><span class="y">${x.year}</span><span>${esc(x.title)}</span></button></li>`;
  $('#db')!.innerHTML = `
    <h3>${esc(p.name)}</h3>
    <div class="date">${p.moves.length ? `<span>${esc(fmtYM(p.moves[0].date))} to ${esc(fmtYM(p.moves[p.moves.length - 1].date))}</span>` : ''}${founded.length ? `<span>co-founder of ${esc(founded.map((o: any) => orgShort(o.id)).join(', '))}</span>` : ''}</div>
    ${p.stub ? `<p class="tl-stub"><span class="sc">Minimal entry</span> One sourced report names this move; earlier roles and titles are not on record.</p>` : ''}
    ${p.moves.length ? `<div class="sect-h"><span>Moves on the map</span><span>${p.moves.length}</span></div>
    <ol class="tl-moves">${p.moves.map((m: any) => `<li class="${isFounding(m) ? 'f' : ''}"><span class="y">${esc(fmtYM(m.date))}</span><span class="b"><b>${esc(m.from_org ? orgShort(m.from_org) : 'Not stated')}</b> <span aria-hidden="true">&rarr;</span><span class="sr-only">to</span> <b>${esc(orgShort(m.to_org))}</b>${isFounding(m) ? ' <span class="tl-f sc">founding</span>' : ''}${m.announced ? ' <span class="tl-f tl-ann sc">announced</span>' : ''}<span class="n">${esc(m.note || '')}</span>${m.date_note ? `<span class="n">Date: ${esc(m.date_note)}</span>` : ''}${m.verification_note ? `<span class="n tl-fc">Fact check: ${esc(m.verification_note)}</span>` : ''}<a href="${esc(m.source_url)}" target="_blank" rel="noopener" class="host">${esc(host(m.source_url))}</a>${(m.more_sources || []).map((x: any) => ` <a href="${esc(x.url)}" target="_blank" rel="noopener" class="host">${esc(host(x.url))}</a>`).join('')}${m.verification === 'supported' ? `<span class="tl-v">fact checked</span>` : ''}</span></li>`).join('')}</ol>` : ''}
    ${roles.length ? `<div class="sect-h"><span>Career path</span><span>${roles.length} role${roles.length === 1 ? '' : 's'}</span></div>
    <ol class="tl-roles">${roles.map((r: any) => `<li><span class="o">${esc(r.org)}</span>${r.title && !ROLE_FILLER.test(r.title) ? `<span class="t">${esc(r.title)}</span>` : ''}<span class="d">${esc(span(r))}</span></li>`).join('')}</ol>` : ''}
    ${rel.length ? `<div class="sect-h"><span>Events naming ${esc(p.name.split(' ').slice(-1)[0])}</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>Sources</span><span>${srcs.length}</span></div>
    <ol class="sources">${srcs.map((u: string) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a><span class="host">${esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70))}</span></li>`).join('')}</ol>
    ${p.verification_note ? `<p class="verif part"><span>Fact check</span> ${esc(p.verification_note)}</p>` : ''}`;
}

export function benchDrawer(b: any, pointId: string, $: (sel: string) => HTMLElement | null) {
  const c = bcolor(b);
  const cat = (BCAT[b.domain] || {}).label || b.domain;
  const sel = b.points.find((p: any) => p.id === pointId);
  $('#dk')!.innerHTML = `<i style="background:${c}"></i>Benchmark <span aria-hidden="true">&middot;</span> ${esc(cat)} <span aria-hidden="true">&middot;</span> ${b.ts ? 'Saturated' : 'Unsaturated'}`;
  const hb = b.human_baseline;
  const best = b.points[b.points.length - 1];
  const fmtV = (v: any) => `${+(+v).toFixed(2)}`;
  const rel = (b.related_event_ids || []).map((id: string) => db.byId.get(id)).filter(Boolean).sort((a: any, x: any) => a.t - x.t);
  const row = (x: any) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:var(--ink-3)"></i><span class="y">${x.year}</span><span>${esc(x.title)}</span></button></li>`;
  const srcs = [...(b.sources || [])];
  $('#db')!.innerHTML = `
    <h3>${esc(sel ? sel.model : b.name)}</h3>
    ${sel ? `<div class="date"><span>${esc(fmtYM(sel.date))}</span><span>${esc(sel.org)}</span><span>${esc(bshort(b))} ${fmtV(sel.value)}${b.higher_is_better ? '' : ' error'}</span></div>
    <div class="bd-pick" style="--oc:${c}"><span class="sc">Record result</span><p><b>${fmtV(sel.value)}</b> ${esc(b.metric)} on ${esc(b.name)}, ${Math.round(pct(b, sel.value) || 0)}% of the maximum score.${hb && hb.value != null ? ` Human baseline ${fmtV(hb.value)}.` : ''}</p>${sel.date_note ? `<p>Date: ${esc(sel.date_note)}.</p>` : ''}${sel.t > Math.floor(b.t0) && String(sel.date) < String(b.introduced) ? `<p>The model was released before the benchmark, so the result is drawn at the benchmark's launch.</p>` : ''}<p class="src"><a href="${esc(sel.source_url)}" target="_blank" rel="noopener">${esc(sel.source_title || 'Source for this result')}</a> <span class="host">${esc(host(sel.source_url))}</span>${(sel.more_sources || []).map((x: any) => ` &middot; <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || host(x.url))}</a>`).join('')}</p>${sel.verification === 'supported' ? `<p class="bd-fc">Fact checked against the source.</p>` : sel.verification_note ? `<p class="bd-fc">Fact check: ${esc(sel.verification_note)}</p>` : ''}</div>
    <div class="sect-h"><span>The benchmark</span><span>${esc(bshort(b))}</span></div>` : `<div class="date"><span>Introduced ${esc(fmtYM(b.introduced))}</span><span>${b.ts ? `saturated ${esc(fmtYM(b.saturated_date))}, after ${yrs(b.ts - b.t0)}` : `open after ${yrs(NOW_T - b.t0)}`}</span></div>`}
    ${sel ? `<p class="summary"><b>${esc(b.name)}</b>, introduced ${esc(fmtYM(b.introduced))}; ${b.ts ? `saturated ${esc(fmtYM(b.saturated_date))}, after ${yrs(b.ts - b.t0)}.` : `still open after ${yrs(NOW_T - b.t0)}.`}</p>` : ''}
    ${b.notes ? `<p class="summary">${esc(b.notes)}</p>` : ''}
    <dl class="dl">
      <dt>Created by</dt><dd>${esc(b.creator)}</dd>
      <dt>Metric</dt><dd>${esc(b.metric)}${b.higher_is_better ? '' : ', lower is better'}</dd>
      <dt>Human baseline</dt><dd>${hb && hb.value != null ? `${fmtV(hb.value)} ${esc(hb.unit || '')}${hb.note ? `<span class="bd-note">${esc(hb.note)}</span>` : ''}${hb.source ? ` <a class="bd-src" href="${esc(hb.source)}" target="_blank" rel="noopener">${esc(host(hb.source))}</a>` : ''}` : 'None published'}${b.checks?.human_baseline?.note ? `<span class="bd-note">Fact check: ${esc(b.checks.human_baseline.note)}</span>` : ''}</dd>
      <dt>Saturation</dt><dd>${b.ts ? `${esc(fmtYM(b.saturated_date))}, ${yrs(b.ts - b.t0)} after release` : 'Not yet'}${b.checks?.saturated_date?.note ? `<span class="bd-note">Fact check: ${esc(b.checks.saturated_date.note)}</span>` : ''}</dd>
      <dt>Latest record</dt><dd>${fmtV(best.value)}, ${esc(best.model)} (${esc(fmtYM(best.date))})</dd>
    </dl>
    <div class="sect-h"><span>Record progression</span><span>${b.points.length}</span></div>
    <table class="bd-tab"><thead><tr><th>Date</th><th>Model and lab</th><th class="r">Score</th></tr></thead><tbody>${b.points.map((p: any) => `<tr class="${p.id === pointId ? 'on' : ''}"><td class="y">${esc(fmtYM(p.date))}</td><td><button type="button" data-id="${esc(p.id)}">${esc(p.model)}</button><span>${esc(p.org)} &middot; <a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(host(p.source_url))}</a></span></td><td class="r">${fmtV(p.value)}${p.verification_note ? '<sup title="Qualified by the fact check; open the result for the note">*</sup>' : ''}</td></tr>`).join('')}</tbody></table>
    ${rel.length ? `<div class="sect-h"><span>Related on the map</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>Benchmark sources</span><span>${srcs.length}</span></div>
    <ol class="sources">${srcs.map((s: any) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a><span class="host">${esc(host(s.url))}</span></li>`).join('')}</ol>
    ${b.verification_note ? `<p class="verif part"><span>Fact check</span> ${esc(b.verification_note)}</p>` : ''}`;
}

export const RISO = { ultramarine: '#7E91DC', teal: '#7EB3B4', pink: '#FB99C0', orange: '#FBA783' };
export const PSTATUS = [
  { id: 'in_force', label: 'In force', color: RISO.ultramarine },
  { id: 'enacted', label: 'Enacted', color: RISO.teal },
  { id: 'proposed', label: 'Proposed', color: RISO.pink, hollow: true },
  { id: 'repealed', label: 'Repealed', color: RISO.orange, hatch: true },
  { id: 'vetoed', label: 'Vetoed', color: RISO.orange, hatch: true },
  { id: 'blocked', label: 'Blocked', color: RISO.orange, hatch: true },
];
export const PSTAT: Record<string, any> = Object.fromEntries(PSTATUS.map((s) => [s.id, s]));
export const pswatch = (st: any) =>
  st.hatch
    ? `background:repeating-linear-gradient(135deg, ${st.color} 0 1px, var(--ground-2) 1px 3.5px);border:1px solid ${st.color}`
    : st.hollow
      ? `background:var(--ground);border:1.5px solid ${st.color}`
      : `background:${st.color}`;

export const PTYPES = [
  { id: 'law', label: 'Law', sym: 'circle', fill: true },
  { id: 'regulation', label: 'Regulation', sym: 'square', fill: true },
  { id: 'executive_order', label: 'Executive order', sym: 'triangle', fill: true },
  { id: 'treaty', label: 'Treaty', sym: 'star', fill: true },
  { id: 'bill', label: 'Bill', sym: 'square', fill: false },
  { id: 'strategy', label: 'Strategy', sym: 'diamond', fill: false },
  { id: 'guidance', label: 'Guidance', sym: 'circle', fill: false },
];
export const PTYPE: Record<string, any> = Object.fromEntries(PTYPES.map((t) => [t.id, t]));
const SYM = (): Record<string, d3.SymbolType> => ({
  circle: d3.symbolCircle,
  square: d3.symbolSquare,
  triangle: d3.symbolTriangle,
  star: d3.symbolStar,
  diamond: d3.symbolDiamond,
});
export const psym = (type: string, size = 60) => d3.symbol(SYM()[(PTYPE[type] || PTYPES[0]).sym], size)();
const fmtD = (d: string | null | undefined) => {
  if (!d) return '';
  const [y, m, dd] = String(d).split('-').map(Number);
  return (dd ? dd + ' ' : '') + (m ? MON[m - 1] + ' ' : '') + y;
};

export function policyDrawer(x: any, $: (sel: string) => HTMLElement | null) {
  const st = PSTAT[x.status] || PSTATUS[0];
  const ty = PTYPE[x.type] || { label: x.type };
  $('#dk')!.innerHTML = `<i style="${pswatch(st)}"></i>Policy <span aria-hidden="true">&middot;</span> ${esc(ty.label)} <span aria-hidden="true">&middot;</span> ${esc(st.label)}`;
  const rel = (x.related_event_ids || []).map((id: string) => db.byId.get(id)).filter(Boolean).sort((a: any, b: any) => a.t - b.t);
  const row = (e: any) => `<li><button type="button" data-id="${esc(e.id)}"><i style="background:var(--ink-3)"></i><span class="y">${e.year}</span><span>${esc(e.title)}</span></button></li>`;
  const steps = [
    ['Introduced', x.date_introduced, x.date_introduced_note],
    ['Enacted', x.date_enacted, x.date_enacted_note],
    ['In force', x.date_in_force, x.date_in_force_note],
  ].filter((s) => s[1]);
  $('#db')!.innerHTML = `
    <h3${x.title.length > 90 ? ' class="long"' : ''}>${esc(x.title)}</h3>
    <div class="date"><span>${esc(x.jurisdiction)}</span><span>${esc(x.level)}</span><span style="color:${st.color};filter:brightness(.85)">${esc(st.label)}</span></div>
    <ol class="pd-life">${steps.map(([l, d, n]) => `<li><span class="sc">${l}</span><b>${esc(fmtD(d))}</b>${n ? `<span class="pd-dn">${esc(n)}</span>` : ''}</li>`).join('')}${['repealed', 'vetoed', 'blocked'].includes(x.status) ? `<li class="end" style="--oc:${st.color}"><span class="sc">${esc(st.label)}</span><b>date not recorded</b></li>` : ''}</ol>
    <p class="summary">${esc(x.summary)}</p>
    ${x.status_note ? `<p class="pd-note">${esc(x.status_note)}</p>` : ''}
    <dl class="dl"><dt>Jurisdiction</dt><dd>${esc(x.jurisdiction)} (${esc(x.region)})</dd><dt>Instrument</dt><dd>${esc(ty.label)}${ty.fill ? ', binding' : ty.fill === false ? ', not binding on its own' : ''}</dd><dt>Status</dt><dd>${esc(st.label)}</dd></dl>
    ${rel.length ? `<div class="sect-h"><span>Related on the map</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>Sources</span><span>${(x.sources || []).length}</span></div>
    <ol class="sources">${(x.sources || []).map((s: any) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a><span class="host">${esc(host(s.url))}</span></li>`).join('')}</ol>
    ${x.verification === 'supported' ? `<p class="verif ok"><span>Fact checked</span> Key claims confirmed against the cited sources.</p>` : x.verification_note ? `<p class="verif part"><span>${x.verification === 'unsupported' ? 'Corrected' : 'Partly confirmed'}</span> ${esc(x.verification_note)}</p>` : ''}`;
}
