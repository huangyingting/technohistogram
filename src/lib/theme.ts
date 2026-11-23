export type ThemeId = 'jade' | 'starlight' | 'xuan';

export interface ThemeSpec {
  id: ThemeId;
  zh: string;
  zhShort: string;
  en: string;
  enShort: string;
  subZh: string;
  subEn: string;
  dot: string;
  isLight: boolean;
  sky: [string, string, string];
  aura: string;
  night: string;
  indigo: string;
  ultramarine: string;
  sunkTarget: string;
  ink: string;
  soft: string;
  ink3: string;
  fringeBlue: string;
  fringeRed: string;
  core: string;
  ember: string;
  plate: string;
  plateSoft: string;
  ruleStrong: string;
  cardBg: string;
  cardSelBg: string;
  cardBorder: string;
  stripBg: string;
  shadowCss: string;
  accent: string;
  accentWarm: string;
  curve: [number, string][];
}

export const THEMES: Record<ThemeId, ThemeSpec> = {
  jade: {
    id: 'jade',
    zh: '墨玉青金',
    zhShort: '墨玉',
    en: 'Obsidian Jade',
    enShort: 'Jade',
    subZh: '矿物青绿 · 博物星盘（默认）',
    subEn: 'Mineral jade & amber astrolabe',
    dot: '#2dd4bf',
    isLight: false,
    sky: ['#050b0c', '#091517', '#0f2224'],
    aura: '#1c4a48',
    night: '#060d0e',
    indigo: '#0c1c1e',
    ultramarine: '#0d2629',
    sunkTarget: '#060d0e',
    ink: '#f2efe9',
    soft: '#9cb5af',
    ink3: '#68837d',
    fringeBlue: '#2dd4bf',
    fringeRed: '#e8834a',
    core: '#f7f4eb',
    ember: '#4d2619',
    plate: 'rgba(7, 16, 18, 0.94)',
    plateSoft: 'rgba(7, 16, 18, 0.72)',
    ruleStrong: 'rgba(130, 214, 198, 0.32)',
    cardBg: 'rgba(8, 18, 20, 0.92)',
    cardSelBg: 'rgba(11, 24, 27, 0.96)',
    cardBorder: 'rgba(216, 234, 229, 0.2)',
    stripBg: 'rgba(8, 18, 20, 0.94)',
    shadowCss: 'rgba(3, 8, 9, 0.85)',
    accent: '#2dd4bf',
    accentWarm: '#e6a94c',
    curve: [
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
    ],
  },
  starlight: {
    id: 'starlight',
    zh: '深海星夜',
    zhShort: '星夜',
    en: 'Deep Starlight',
    enShort: 'Starlight',
    subZh: '原版靛蓝星云 · 霓虹光谱',
    subEn: 'Cosmic indigo & neon spectrum',
    dot: '#6366f1',
    isLight: false,
    sky: ['#050718', '#0a0f2c', '#151140'],
    aura: '#2d2175',
    night: '#06081a',
    indigo: '#0d1233',
    ultramarine: '#15194a',
    sunkTarget: '#06081a',
    ink: '#f2f0fc',
    soft: '#a3a9d1',
    ink3: '#6f76a8',
    fringeBlue: '#38bdf8',
    fringeRed: '#f43f8e',
    core: '#fff8ec',
    ember: '#381a38',
    plate: 'rgba(8, 11, 30, 0.94)',
    plateSoft: 'rgba(8, 11, 30, 0.72)',
    ruleStrong: 'rgba(165, 180, 252, 0.34)',
    cardBg: 'rgba(10, 14, 36, 0.92)',
    cardSelBg: 'rgba(15, 20, 48, 0.96)',
    cardBorder: 'rgba(210, 218, 255, 0.22)',
    stripBg: 'rgba(9, 13, 34, 0.94)',
    shadowCss: 'rgba(3, 4, 15, 0.86)',
    accent: '#60a5fa',
    accentWarm: '#f472b6',
    curve: [
      [0, '#ffcf48'],
      [0.14, '#ff7e3d'],
      [0.28, '#f43f8e'],
      [0.43, '#b845f5'],
      [0.58, '#6366f1'],
      [0.72, '#2563eb'],
      [0.84, '#38bdf8'],
      [0.94, '#a5f3fc'],
      [1, '#fff8ec'],
    ],
  },
  xuan: {
    id: 'xuan',
    zh: '宣纸宋刻',
    zhShort: '宣纸',
    en: 'Xuan Archival',
    enShort: 'Xuan',
    subZh: '典藏浅色宣纸 · 松烟朱砂印',
    subEn: 'Warm archival paper & cinnabar ink',
    dot: '#b83728',
    isLight: true,
    sky: ['#f5efe2', '#ece2ce', '#dfd2b8'],
    aura: '#e8dcc4',
    night: '#efe7d6',
    indigo: '#e6dcc8',
    ultramarine: '#dcd0b8',
    sunkTarget: '#cabaa0',
    ink: '#1e1914',
    soft: '#5c5142',
    ink3: '#877966',
    fringeBlue: '#176670',
    fringeRed: '#b83728',
    core: '#7d1e19',
    ember: '#9e7d58',
    plate: 'rgba(247, 241, 229, 0.95)',
    plateSoft: 'rgba(247, 241, 229, 0.82)',
    ruleStrong: 'rgba(72, 56, 38, 0.28)',
    cardBg: 'rgba(250, 245, 235, 0.94)',
    cardSelBg: 'rgba(253, 250, 243, 0.98)',
    cardBorder: 'rgba(72, 56, 38, 0.22)',
    stripBg: 'rgba(246, 239, 226, 0.95)',
    shadowCss: 'rgba(245, 239, 226, 0.92)',
    accent: '#176670',
    accentWarm: '#b83728',
    curve: [
      [0, '#a84b26'],
      [0.15, '#b86c19'],
      [0.28, '#8a6d14'],
      [0.42, '#3d7528'],
      [0.55, '#176e51'],
      [0.68, '#156373'],
      [0.8, '#204d7d'],
      [0.9, '#553675'],
      [0.96, '#8c2722'],
      [1, '#781b17'],
    ],
  },
};

export const THEME_ORDER: ThemeId[] = ['jade', 'starlight', 'xuan'];

const THEME_STORAGE_KEY = 'histomap:theme';

function isValidTheme(v: string | null | undefined): v is ThemeId {
  return v === 'jade' || v === 'starlight' || v === 'xuan';
}

function detectInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'jade';
  try {
    const sp = new URLSearchParams(window.location.search);
    const qt = sp.get('theme');
    if (isValidTheme(qt)) return qt;
    const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const ht = hp.get('theme');
    if (isValidTheme(ht)) return ht;
    const saved = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (isValidTheme(saved)) return saved;
  } catch {
    /* ignore */
  }
  return 'jade';
}

let currentTheme: ThemeId = detectInitialTheme();
const themeListeners = new Set<(theme: ThemeSpec) => void>();

export const getThemeId = (): ThemeId => currentTheme;
export const getTheme = (): ThemeSpec => THEMES[currentTheme];

export function syncHtmlTheme(id: ThemeId = currentTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme = THEMES[id].isLight ? 'light' : 'dark';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEMES[id].night;
}

export function setTheme(id: ThemeId): void {
  if (!isValidTheme(id)) return;
  if (id === currentTheme) {
    syncHtmlTheme(id);
    return;
  }
  currentTheme = id;
  syncHtmlTheme(id);
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  const spec = THEMES[id];
  themeListeners.forEach((fn) => fn(spec));
}

export function cycleTheme(): ThemeId {
  const idx = THEME_ORDER.indexOf(currentTheme);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  setTheme(next);
  return next;
}

export function onThemeChange(fn: (theme: ThemeSpec) => void): () => boolean {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}

/* ---------- 3D Lineage Spotlight state ---------- */
let lineageSpotlight = false;
const lineageListeners = new Set<(on: boolean) => void>();

export const isLineageSpotlight = (): boolean => lineageSpotlight;

export function setLineageSpotlight(on: boolean): void {
  if (lineageSpotlight === on) return;
  lineageSpotlight = on;
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('lineage-on', on);
  }
  lineageListeners.forEach((fn) => fn(on));
}

export function toggleLineageSpotlight(): boolean {
  setLineageSpotlight(!lineageSpotlight);
  return lineageSpotlight;
}

export function onLineageChange(fn: (on: boolean) => void): () => boolean {
  lineageListeners.add(fn);
  return () => lineageListeners.delete(fn);
}
