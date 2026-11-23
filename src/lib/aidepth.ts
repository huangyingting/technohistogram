import { db, host } from './data';
import { isZh } from './i18n';

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
const span = (r: any) => {
  if (isZh()) {
    return r.start || r.end
      ? `${r.start ? fmtYM(r.start) : '起始未详'}${r.end ? ' — ' + fmtYM(r.end) : r.start ? ' 至今' : ''}`
      : '起止日期未载';
  }
  return r.start || r.end
    ? `${r.start ? fmtYM(r.start) : 'start not stated'}${r.end ? ' to ' + fmtYM(r.end) : r.start ? ' onward' : ''}`
    : 'dates not stated';
};

export function personDrawer(p: any, $: (sel: string) => HTMLElement | null) {
  const zh = isZh();
  const founded = [...db.orgById.values()].filter((o: any) => (o.founders || []).includes(p.name));
  const g = TORG_GROUP.get(laneOf(p.moves.length ? p.moves[p.moves.length - 1].to_org : null)) || TGROUPS[0];
  $('#dk')!.innerHTML = `<i style="background:${g.color}"></i>${zh ? '人物履历' : 'Person'} <span aria-hidden="true">&middot;</span> ${
    zh ? `${p.moves.length} 次机构履新` : `${p.moves.length} move${p.moves.length === 1 ? '' : 's'}`
  }${p.stub ? ` <span aria-hidden="true">&middot;</span> ${zh ? '简明条目' : 'minimal entry'}` : ''}`;
  const roles = p.roles.slice();
  const srcs = [...new Map([...roles.map((r: any) => r.source_url), ...p.moves.map((m: any) => m.source_url)].filter(Boolean).map((u) => [u, u])).keys()];
  const rel = db.events.filter((e) => (e.people || []).includes(p.name)).sort((a, b) => a.t - b.t).slice(0, 8);
  const row = (x: any) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:var(--ink-3)"></i><span class="y">${x.year}</span><span>${esc(x.title)}</span></button></li>`;
  $('#db')!.innerHTML = `
    <h3>${esc(p.name)}</h3>
    <div class="date">${p.moves.length ? `<span>${esc(fmtYM(p.moves[0].date))} ${zh ? '至' : 'to'} ${esc(fmtYM(p.moves[p.moves.length - 1].date))}</span>` : ''}${founded.length ? `<span>${zh ? `联合创立 ${esc(founded.map((o: any) => orgShort(o.id)).join('、'))}` : `co-founder of ${esc(founded.map((o: any) => orgShort(o.id)).join(', '))}`}</span>` : ''}</div>
    ${p.stub ? `<p class="tl-stub"><span class="sc">${zh ? '简明记录' : 'Minimal entry'}</span> ${zh ? '现有公开文献仅记载此次履新，更早期的职位细节暂未收录。' : 'One sourced report names this move; earlier roles and titles are not on record.'}</p>` : ''}
    ${p.moves.length ? `<div class="sect-h"><span>${zh ? '机构流动轨迹' : 'Moves on the map'}</span><span>${p.moves.length}</span></div>
    <ol class="tl-moves">${p.moves.map((m: any) => `<li class="${isFounding(m) ? 'f' : ''}"><span class="y">${esc(fmtYM(m.date))}</span><span class="b"><b>${esc(m.from_org ? orgShort(m.from_org) : zh ? '未详' : 'Not stated')}</b> <span aria-hidden="true">&rarr;</span><span class="sr-only">${zh ? '至' : 'to'}</span> <b>${esc(orgShort(m.to_org))}</b>${isFounding(m) ? ` <span class="tl-f sc">${zh ? '创立' : 'founding'}</span>` : ''}${m.announced ? ` <span class="tl-f tl-ann sc">${zh ? '官宣' : 'announced'}</span>` : ''}<span class="n">${esc(m.note || '')}</span>${m.date_note ? `<span class="n">${zh ? '日期说明：' : 'Date: '}${esc(m.date_note)}</span>` : ''}${m.verification_note ? `<span class="n tl-fc">${zh ? '考证：' : 'Fact check: '}${esc(m.verification_note)}</span>` : ''}<a href="${esc(m.source_url)}" target="_blank" rel="noopener" class="host">${esc(host(m.source_url))}</a>${(m.more_sources || []).map((x: any) => ` <a href="${esc(x.url)}" target="_blank" rel="noopener" class="host">${esc(host(x.url))}</a>`).join('')}${m.verification === 'supported' ? `<span class="tl-v">${zh ? '已核查' : 'fact checked'}</span>` : ''}</span></li>`).join('')}</ol>` : ''}
    ${roles.length ? `<div class="sect-h"><span>${zh ? '履历阶段' : 'Career path'}</span><span>${zh ? `${roles.length} 段经历` : `${roles.length} role${roles.length === 1 ? '' : 's'}`}</span></div>
    <ol class="tl-roles">${roles.map((r: any) => `<li><span class="o">${esc(r.org)}</span>${r.title && !ROLE_FILLER.test(r.title) ? `<span class="t">${esc(r.title)}</span>` : ''}<span class="d">${esc(span(r))}</span></li>`).join('')}</ol>` : ''}
    ${rel.length ? `<div class="sect-h"><span>${zh ? '相关技术史事件' : `Events naming ${esc(p.name.split(' ').slice(-1)[0])}`}</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>${zh ? '文献来源' : 'Sources'}</span><span>${srcs.length}</span></div>
    <ol class="sources">${srcs.map((u: string) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a><span class="host">${esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70))}</span></li>`).join('')}</ol>
    ${p.verification_note ? `<p class="verif part"><span>${zh ? '文献核查' : 'Fact check'}</span> ${esc(p.verification_note)}</p>` : ''}`;
}

const BCAT_ZH: Record<string, string> = {
  vision: '视觉感知',
  language: '自然语言',
  knowledge: '知识理解',
  math: '数学推理',
  code: '代码编程',
  reasoning: '综合推理',
  agentic: '智能体执行',
};

export function benchDrawer(b: any, pointId: string, $: (sel: string) => HTMLElement | null) {
  const zh = isZh();
  const c = bcolor(b);
  const cat = zh ? BCAT_ZH[b.domain] || (BCAT[b.domain] || {}).label || b.domain : (BCAT[b.domain] || {}).label || b.domain;
  const sel = b.points.find((p: any) => p.id === pointId);
  $('#dk')!.innerHTML = `<i style="background:${c}"></i>${zh ? '基准评测' : 'Benchmark'} <span aria-hidden="true">&middot;</span> ${esc(cat)} <span aria-hidden="true">&middot;</span> ${
    b.ts ? (zh ? '已趋饱和' : 'Saturated') : zh ? '尚未饱和' : 'Unsaturated'
  }`;
  const hb = b.human_baseline;
  const best = b.points[b.points.length - 1];
  const fmtV = (v: any) => `${+(+v).toFixed(2)}`;
  const rel = (b.related_event_ids || []).map((id: string) => db.byId.get(id)).filter(Boolean).sort((a: any, x: any) => a.t - x.t);
  const row = (x: any) => `<li><button type="button" data-id="${esc(x.id)}"><i style="background:var(--ink-3)"></i><span class="y">${x.year}</span><span>${esc(x.title)}</span></button></li>`;
  const srcs = [...(b.sources || [])];
  $('#db')!.innerHTML = `
    <h3>${esc(sel ? sel.model : b.name)}</h3>
    ${sel ? `<div class="date"><span>${esc(fmtYM(sel.date))}</span><span>${esc(sel.org)}</span><span>${esc(bshort(b))} ${fmtV(sel.value)}${b.higher_is_better ? '' : zh ? ' 误差' : ' error'}</span></div>
    <div class="bd-pick" style="--oc:${c}"><span class="sc">${zh ? '刷新纪录成绩' : 'Record result'}</span><p><b>${fmtV(sel.value)}</b> ${esc(b.metric)}（${esc(b.name)}，${zh ? `达满分基准的 ${Math.round(pct(b, sel.value) || 0)}%` : `${Math.round(pct(b, sel.value) || 0)}% of the maximum score`}${hb && hb.value != null ? (zh ? `；人类基线 ${fmtV(hb.value)}` : `. Human baseline ${fmtV(hb.value)}`) : ''}）。</p>${sel.date_note ? `<p>${zh ? '日期说明：' : 'Date: '}${esc(sel.date_note)}</p>` : ''}${sel.t > Math.floor(b.t0) && String(sel.date) < String(b.introduced) ? `<p>${zh ? '该模型发布早于评测基准创立日期，故按基准发布时点绘制。' : "The model was released before the benchmark, so the result is drawn at the benchmark's launch."}</p>` : ''}<p class="src"><a href="${esc(sel.source_url)}" target="_blank" rel="noopener">${esc(sel.source_title || (zh ? '成绩原始出处' : 'Source for this result'))}</a> <span class="host">${esc(host(sel.source_url))}</span>${(sel.more_sources || []).map((x: any) => ` &middot; <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || host(x.url))}</a>`).join('')}</p>${sel.verification === 'supported' ? `<p class="bd-fc">${zh ? '已对照原始出处核查。' : 'Fact checked against the source.'}</p>` : sel.verification_note ? `<p class="bd-fc">${zh ? '考证说明：' : 'Fact check: '}${esc(sel.verification_note)}</p>` : ''}</div>
    <div class="sect-h"><span>${zh ? '评测基准概况' : 'The benchmark'}</span><span>${esc(bshort(b))}</span></div>` : `<div class="date"><span>${zh ? `发布于 ${esc(fmtYM(b.introduced))}` : `Introduced ${esc(fmtYM(b.introduced))}`}</span><span>${b.ts ? (zh ? `${esc(fmtYM(b.saturated_date))} 趋于饱和（历时 ${yrs(b.ts - b.t0)}）` : `saturated ${esc(fmtYM(b.saturated_date))}, after ${yrs(b.ts - b.t0)}`) : zh ? `已持续开放 ${yrs(NOW_T - b.t0)}` : `open after ${yrs(NOW_T - b.t0)}`}</span></div>`}
    ${sel ? `<p class="summary"><b>${esc(b.name)}</b>，${zh ? `发布于 ${esc(fmtYM(b.introduced))}` : `introduced ${esc(fmtYM(b.introduced))}`}；${b.ts ? (zh ? `于 ${esc(fmtYM(b.saturated_date))} 趋于饱和（历时 ${yrs(b.ts - b.t0)}）。` : `saturated ${esc(fmtYM(b.saturated_date))}, after ${yrs(b.ts - b.t0)}.`) : zh ? `至今仍未饱和（历时 ${yrs(NOW_T - b.t0)}）。` : `still open after ${yrs(NOW_T - b.t0)}.`}</p>` : ''}
    ${b.notes ? `<p class="summary">${esc(b.notes)}</p>` : ''}
    <dl class="dl">
      <dt>${zh ? '创立团队' : 'Created by'}</dt><dd>${esc(b.creator)}</dd>
      <dt>${zh ? '评分指标' : 'Metric'}</dt><dd>${esc(b.metric)}${b.higher_is_better ? '' : zh ? '（越低越优）' : ', lower is better'}</dd>
      <dt>${zh ? '人类水平基线' : 'Human baseline'}</dt><dd>${hb && hb.value != null ? `${fmtV(hb.value)} ${esc(hb.unit || '')}${hb.note ? `<span class="bd-note">${esc(hb.note)}</span>` : ''}${hb.source ? ` <a class="bd-src" href="${esc(hb.source)}" target="_blank" rel="noopener">${esc(host(hb.source))}</a>` : ''}` : zh ? '未公布人类基线' : 'None published'}${b.checks?.human_baseline?.note ? `<span class="bd-note">${zh ? '核查：' : 'Fact check: '}${esc(b.checks.human_baseline.note)}</span>` : ''}</dd>
      <dt>${zh ? '饱和状态' : 'Saturation'}</dt><dd>${b.ts ? `${esc(fmtYM(b.saturated_date))}（${zh ? `发布后 ${yrs(b.ts - b.t0)}` : `${yrs(b.ts - b.t0)} after release`}）` : zh ? '尚未饱和' : 'Not yet'}${b.checks?.saturated_date?.note ? `<span class="bd-note">${zh ? '核查：' : 'Fact check: '}${esc(b.checks.saturated_date.note)}</span>` : ''}</dd>
      <dt>${zh ? '最新最高纪录' : 'Latest record'}</dt><dd>${fmtV(best.value)}，${esc(best.model)}（${esc(fmtYM(best.date))}）</dd>
    </dl>
    <div class="sect-h"><span>${zh ? '历代最高分演进' : 'Record progression'}</span><span>${b.points.length}</span></div>
    <table class="bd-tab"><thead><tr><th>${zh ? '日期' : 'Date'}</th><th>${zh ? '模型与机构' : 'Model and lab'}</th><th class="r">${zh ? '得分' : 'Score'}</th></tr></thead><tbody>${b.points.map((p: any) => `<tr class="${p.id === pointId ? 'on' : ''}"><td class="y">${esc(fmtYM(p.date))}</td><td><button type="button" data-id="${esc(p.id)}">${esc(p.model)}</button><span>${esc(p.org)} &middot; <a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(host(p.source_url))}</a></span></td><td class="r">${fmtV(p.value)}${p.verification_note ? `<sup title="${zh ? '附有文献核查限定说明，点击查看详情' : 'Qualified by the fact check; open the result for the note'}">*</sup>` : ''}</td></tr>`).join('')}</tbody></table>
    ${rel.length ? `<div class="sect-h"><span>${zh ? '图谱关联事件' : 'Related on the map'}</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>${zh ? '评测文献来源' : 'Benchmark sources'}</span><span>${srcs.length}</span></div>
    <ol class="sources">${srcs.map((s: any) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a><span class="host">${esc(host(s.url))}</span></li>`).join('')}</ol>
    ${b.verification_note ? `<p class="verif part"><span>${zh ? '文献核查' : 'Fact check'}</span> ${esc(b.verification_note)}</p>` : ''}`;
}

export const RISO = { ultramarine: '#7E91DC', teal: '#7EB3B4', pink: '#FB99C0', orange: '#FBA783' };
export const PSTATUS = [
  { id: 'in_force', label: 'In force', zh: '现行有效', color: RISO.ultramarine },
  { id: 'enacted', label: 'Enacted', zh: '已颁布', color: RISO.teal },
  { id: 'proposed', label: 'Proposed', zh: '提案审议中', color: RISO.pink, hollow: true },
  { id: 'repealed', label: 'Repealed', zh: '已废止', color: RISO.orange, hatch: true },
  { id: 'vetoed', label: 'Vetoed', zh: '已否决', color: RISO.orange, hatch: true },
  { id: 'blocked', label: 'Blocked', zh: '已受阻搁置', color: RISO.orange, hatch: true },
];
export const PSTAT: Record<string, any> = Object.fromEntries(PSTATUS.map((s) => [s.id, s]));
export const pswatch = (st: any) =>
  st.hatch
    ? `background:repeating-linear-gradient(135deg, ${st.color} 0 1px, var(--ground-2) 1px 3.5px);border:1px solid ${st.color}`
    : st.hollow
      ? `background:var(--ground);border:1.5px solid ${st.color}`
      : `background:${st.color}`;

export const PTYPES = [
  { id: 'law', label: 'Law', zh: '法律立法', sym: 'circle', fill: true },
  { id: 'regulation', label: 'Regulation', zh: '行政法规', sym: 'square', fill: true },
  { id: 'executive_order', label: 'Executive order', zh: '行政命令', sym: 'triangle', fill: true },
  { id: 'treaty', label: 'Treaty', zh: '国际条约', sym: 'star', fill: true },
  { id: 'bill', label: 'Bill', zh: '法案草案', sym: 'square', fill: false },
  { id: 'strategy', label: 'Strategy', zh: '国家战略', sym: 'diamond', fill: false },
  { id: 'guidance', label: 'Guidance', zh: '监管指引', sym: 'circle', fill: false },
];
export const PTYPE: Record<string, any> = Object.fromEntries(PTYPES.map((t) => [t.id, t]));

export function psym(type: string, size = 60): string {
  const kind = (PTYPE[type] || PTYPES[0]).sym;
  if (kind === 'square') {
    const h = Math.sqrt(size) / 2;
    return `M${-h},${-h}L${h},${-h}L${h},${h}L${-h},${h}Z`;
  }
  if (kind === 'triangle') {
    const r = Math.sqrt((size * 4) / (3 * Math.sqrt(3)));
    return `M0,${-r}L${(r * Math.sqrt(3)) / 2},${r / 2}L${(-r * Math.sqrt(3)) / 2},${r / 2}Z`;
  }
  if (kind === 'diamond') {
    const r = Math.sqrt(size / 2);
    return `M0,${-r}L${r},0L0,${r}L${-r},0Z`;
  }
  if (kind === 'star') {
    const R = Math.sqrt(size / 1.12);
    const r = R * 0.42;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : r;
      pts.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`);
    }
    return `M${pts.join('L')}Z`;
  }
  const r = Math.sqrt(size / Math.PI);
  return `M${r},0A${r},${r},0,1,1,${-r},0A${r},${r},0,1,1,${r},0Z`;
}

const fmtD = (d: string | null | undefined) => {
  if (!d) return '';
  const [y, m, dd] = String(d).split('-').map(Number);
  if (isZh()) return `${y}年${m ? `${m}月` : ''}${dd ? `${dd}日` : ''}`;
  return (dd ? dd + ' ' : '') + (m ? MON[m - 1] + ' ' : '') + y;
};

export function policyDrawer(x: any, $: (sel: string) => HTMLElement | null) {
  const zh = isZh();
  const st = PSTAT[x.status] || PSTATUS[0];
  const ty = PTYPE[x.type] || { label: x.type, zh: x.type };
  const stLabel = zh ? st.zh || st.label : st.label;
  const tyLabel = zh ? ty.zh || ty.label : ty.label;
  $('#dk')!.innerHTML = `<i style="${pswatch(st)}"></i>${zh ? '科技政策' : 'Policy'} <span aria-hidden="true">&middot;</span> ${esc(tyLabel)} <span aria-hidden="true">&middot;</span> ${esc(stLabel)}`;
  const rel = (x.related_event_ids || []).map((id: string) => db.byId.get(id)).filter(Boolean).sort((a: any, b: any) => a.t - b.t);
  const row = (e: any) => `<li><button type="button" data-id="${esc(e.id)}"><i style="background:var(--ink-3)"></i><span class="y">${e.year}</span><span>${esc(e.title)}</span></button></li>`;
  const steps = [
    [zh ? '提出日期' : 'Introduced', x.date_introduced, x.date_introduced_note],
    [zh ? '正式颁布' : 'Enacted', x.date_enacted, x.date_enacted_note],
    [zh ? '生效施行' : 'In force', x.date_in_force, x.date_in_force_note],
  ].filter((s) => s[1]);
  $('#db')!.innerHTML = `
    <h3${x.title.length > 90 ? ' class="long"' : ''}>${esc(x.title)}</h3>
    <div class="date"><span>${esc(x.jurisdiction)}</span><span>${esc(x.level)}</span><span style="color:${st.color};filter:brightness(.85)">${esc(stLabel)}</span></div>
    <ol class="pd-life">${steps.map(([l, d, n]) => `<li><span class="sc">${l}</span><b>${esc(fmtD(d))}</b>${n ? `<span class="pd-dn">${esc(n)}</span>` : ''}</li>`).join('')}${['repealed', 'vetoed', 'blocked'].includes(x.status) ? `<li class="end" style="--oc:${st.color}"><span class="sc">${esc(stLabel)}</span><b>${zh ? '具体日期未载' : 'date not recorded'}</b></li>` : ''}</ol>
    <p class="summary">${esc(x.summary)}</p>
    ${x.status_note ? `<p class="pd-note">${esc(x.status_note)}</p>` : ''}
    <dl class="dl"><dt>${zh ? '管辖法域' : 'Jurisdiction'}</dt><dd>${esc(x.jurisdiction)} (${esc(x.region)})</dd><dt>${zh ? '法律层级' : 'Instrument'}</dt><dd>${esc(tyLabel)}${ty.fill ? (zh ? '（具法律约束力）' : ', binding') : ty.fill === false ? (zh ? '（非强制约束性）' : ', not binding on its own') : ''}</dd><dt>${zh ? '当前效力' : 'Status'}</dt><dd>${esc(stLabel)}</dd></dl>
    ${rel.length ? `<div class="sect-h"><span>${zh ? '图谱关联事件' : 'Related on the map'}</span><span>${rel.length}</span></div><ul class="links">${rel.map(row).join('')}</ul>` : ''}
    <div class="sect-h"><span>${zh ? '文献来源' : 'Sources'}</span><span>${(x.sources || []).length}</span></div>
    <ol class="sources">${(x.sources || []).map((s: any) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || host(s.url))}</a><span class="host">${esc(host(s.url))}</span></li>`).join('')}</ol>
    ${x.verification === 'supported' ? `<p class="verif ok"><span>${zh ? '已核查考证' : 'Fact checked'}</span> ${zh ? '核心陈述已对照引用文献核实。' : 'Key claims confirmed against the cited sources.'}</p>` : x.verification_note ? `<p class="verif part"><span>${x.verification === 'unsupported' ? (zh ? '已勘误修正' : 'Corrected') : zh ? '部分证实' : 'Partly confirmed'}</span> ${esc(x.verification_note)}</p>` : ''}`;
}
