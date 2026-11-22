// Bilingual localization runtime (Simplified Chinese default + instant English toggle).

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'histomap:lang';

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  try {
    const sp = new URLSearchParams(window.location.search);
    const ql = sp.get('lang');
    if (ql === 'en' || ql === 'zh') return ql;
    const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hl = hp.get('lang');
    if (hl === 'en' || hl === 'zh') return hl;
    const saved = window.localStorage?.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* ignore storage errors */
  }
  return 'zh';
}

let currentLang: Lang = detectInitialLang();
const langListeners = new Set<(lang: Lang) => void>();

export const getLang = (): Lang => currentLang;
export const isZh = (): boolean => currentLang === 'zh';

export function syncHtmlLang(lang: Lang = currentLang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.lang = lang;
}

export function setLang(lang: Lang): void {
  if (lang !== 'zh' && lang !== 'en') return;
  if (lang === currentLang) {
    syncHtmlLang(lang);
    return;
  }
  currentLang = lang;
  syncHtmlLang(lang);
  try {
    window.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  langListeners.forEach((fn) => fn(lang));
}

export function toggleLang(): Lang {
  const next: Lang = currentLang === 'zh' ? 'en' : 'zh';
  setLang(next);
  return next;
}

export function onLangChange(fn: (lang: Lang) => void): () => boolean {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
}

export const FONT_STACK_DISPLAY =
  '"Newsreader", "Songti SC", "STZhongsong", "Noto Serif SC", "Source Han Serif SC", Georgia, serif';

export const FONT_STACK_SANS =
  '"Plus Jakarta Sans", "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei UI", system-ui, -apple-system, sans-serif';

export const DOMAIN_ZH: Record<string, { label: string; short: string }> = {
  ai: { label: '人工智能', short: '人工智能' },
  computing: { label: '计算技术', short: '计算' },
  semiconductors: { label: '半导体与芯片', short: '芯片' },
  software: { label: '软件工程', short: '软件' },
  internet: { label: '互联网', short: '互联网' },
  communications: { label: '通信技术', short: '通信' },
  media: { label: '媒介与出版', short: '媒介' },
  society: { label: '社会与治理', short: '社会' },
  energy: { label: '能源动力', short: '能源' },
  transport: { label: '交通运输', short: '交通' },
  biotech: { label: '生物技术', short: '生物' },
  space: { label: '航天探索', short: '航天' },
  materials: { label: '材料工艺', short: '材料' },
  agriculture: { label: '农业与食物', short: '农业' },
  health: { label: '医疗与卫生', short: '医疗' },
  home: { label: '日常与居所', short: '居所' },
};

export const TYPE_ZH: Record<string, string> = {
  invention: '技术发明',
  discovery: '科学发现',
  product: '标志产品',
  milestone: '里程碑',
  concept: '思想概念',
  person: '关键人物',
  market: '商业与市场',
  policy: '政策法规',
  culture: '文化现象',
  moment: '历史瞬间',
  hope: '远景希冀',
  fear: '技术隐忧',
  failure: '重大挫折',
  incident: '风险事件',
  era: '时代浪潮',
};

export const REGION_ZH: Record<string, { label: string; short: string }> = {
  europe: { label: '欧洲', short: '欧洲' },
  'middle-east': { label: '中东与北非', short: '中东' },
  'east-asia': { label: '东亚', short: '东亚' },
  'south-asia': { label: '南亚', short: '南亚' },
  africa: { label: '撒哈拉以南非洲', short: '非洲' },
  'latin-america': { label: '拉丁美洲', short: '拉美' },
  'north-america': { label: '北美', short: '北美' },
  oceania: { label: '大洋洲与太平洋', short: '大洋洲' },
  global: { label: '全球', short: '全球' },
};

export const AI_ERA_ZH: Record<string, string> = {
  cybernetics: '控制论时代',
  symbolic: '符号主义 AI',
  winter1: '第一次 AI 寒冬',
  expert: '专家系统',
  winter2: '第二次 AI 寒冬',
  statistical: '统计学习',
  deep: '深度学习',
  transformer: 'Transformer 架构',
  foundation: '基础大模型',
  agentic: '智能体系统',
};

export const AGE_ZH: Record<string, { label: string; short: string }> = {
  medieval: { label: '造纸、活字与水运仪象', short: '1026 至 1450' },
  print: { label: '印刷机、火炮与远洋航路', short: '1450 至 1760' },
  industrial: { label: '煤炭、蒸汽机与电报', short: '1760 至 1914' },
  electric: { label: '电子工业与晶体管', short: '1914 至 1990' },
  network: { label: '万维网与移动互联', short: '1990 至 2017' },
  ai: { label: 'Transformer 与大模型纪元', short: '2017 至 2026' },
};

export const VERDICT_ZH: Record<string, string> = {
  came_true: '已应验',
  came_true_late: '延期应验',
  partly: '部分应验',
  wrong: '未应验',
  pending: '待验证',
  misattributed: '附会误传',
  unresolvable: '难以判定',
};

export const STATUS_ZH: Record<string, string> = {
  came_true: '已应验',
  on_track: '进展顺利',
  behind: '进度滞后',
  contradicted: '相悖证伪',
  too_early: '尚待观察',
  unresolvable: '尚无定论',
  'deployed-at-scale': '已大规模部署',
  commercialized: '已商业化',
  demonstrated: '已实验验证',
  proposed: '理论提出',
  refuted: '已被证伪',
};

export const ROOT_LINEAGE_ZH: Record<string, string> = {
  'Stone and metal': '石器与冶金',
  'Farming and food': '农耕与食粮',
  Shelter: '营造与居所',
  'Boats and roads': '舟车与道路',
  'Writing and number': '文字与算术',
  Healing: '医药与疗愈',
  'Signals and sky': '信使与观天',
  'Law and trade': '律法与商贸',
};

export const ROOT_AGE_ZH: Record<string, string> = {
  Stone: '石器时代',
  Farming: '农耕起源',
  Bronze: '青铜时代',
  Iron: '铁器时代',
};

export const TAG_ZH: Record<string, string> = {
  'automation-anxiety': '自动化焦虑',
  'moores-law': '摩尔定律',
  'hype-cycle': '技术炒作周期',
  'ai-winter': 'AI 寒冬',
  privacy: '隐私保护',
  surveillance: '监控技术',
  misinformation: '虚假信息',
  'existential-risk': '生存性风险',
  'open-vs-closed': '开源与闭源',
  'compute-scaling': '算力扩展定律',
  'energy-demand': '能源需求',
  regulation: '监管治理',
  'geopolitics-chips': '芯片地缘博弈',
  labor: '劳动与就业',
  utopianism: '技术乌托邦',
  'military-origins': '军事起源',
  democratization: '技术普惠',
  'platform-power': '平台权力',
  safety: 'AI 安全',
  alignment: '价值对齐',
  copyright: '版权争议',
  bubble: '资本泡沫',
  'diffusion-lag': '技术扩散时滞',
  'scientific-discovery': '科学发现',
  robotics: '机器人',
  quantum: '量子计算',
  nuclear: '核能技术',
  encryption: '密码与加密',
  semiconductors: '半导体',
  climate: '气候与环境',
};

export const SIG_ZH: Record<number, string> = {
  1: '背景记录',
  2: '行业演进',
  3: '重要节点',
  4: '重大突破',
  5: '文明里程碑',
};

export const KIND_ZH: Record<string, string> = {
  journal: '同行评审期刊',
  book: '学术专著',
  primary: '一手史料',
  reference: '权威工具书',
  technical: '独立技术评估',
  news: '深度报道',
  vendor: '机构原始发布',
};

export function domainLabel(id: string, fallback = id): string {
  if (currentLang === 'zh' && DOMAIN_ZH[id]) return DOMAIN_ZH[id].label;
  return fallback;
}

export function domainShort(id: string, fallback = id): string {
  if (currentLang === 'zh' && DOMAIN_ZH[id]) return DOMAIN_ZH[id].short;
  return fallback;
}

export function typeLabel(id: string, fallback = id): string {
  if (currentLang === 'zh' && TYPE_ZH[id]) return TYPE_ZH[id];
  return fallback;
}

export function regionLabel(id: string, fallback = id): string {
  if (currentLang === 'zh' && REGION_ZH[id]) return REGION_ZH[id].label;
  return fallback;
}

export function regionShort(id: string, fallback = id): string {
  if (currentLang === 'zh' && REGION_ZH[id]) return REGION_ZH[id].short;
  return fallback;
}

export function verdictWord(id: string, isStatus = false): string {
  if (currentLang === 'zh') {
    if (isStatus && STATUS_ZH[id]) return STATUS_ZH[id];
    if (VERDICT_ZH[id]) return VERDICT_ZH[id];
    if (STATUS_ZH[id]) return STATUS_ZH[id];
  }
  return '';
}

export function tagLabel(tag: string): string {
  if (currentLang === 'zh' && TAG_ZH[tag]) return TAG_ZH[tag];
  return tag.replace(/-/g, ' ');
}

export interface ZhBundle {
  events?: Record<string, string>;
  summaries?: Record<string, string>;
  forecasts?: { idx: number; text: string; lab?: string; note?: string }[];
  predictions?: { id: string; role?: string; quote?: string; paraphrase?: string; outcome_note?: string }[];
  century_lines?: { century: number; label: string; line: string }[];
  decade_cards?: { decade: number; kind: string; subject: string; fact: string; labels?: string[] }[];
  tours?: {
    id: string;
    title: string;
    years: string;
    dek: string;
    steps: { event: string; label: string; narration: string }[];
  }[];
}
