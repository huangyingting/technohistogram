import { SPECTRUM, domainBase, domainLit } from './spectrum';
import { isZh, DOMAIN_ZH, TYPE_ZH, AI_ERA_ZH, tagLabel } from './i18n';

const sp = (id: string) => (SPECTRUM[id] || SPECTRUM.computing)[2];

export interface DomainInfo {
  id: string;
  readonly label: string;
  readonly short: string;
  color: string;
}

const mkDom = (id: string, enLabel: string, enShort: string): DomainInfo => ({
  id,
  get label() {
    return isZh() && DOMAIN_ZH[id] ? DOMAIN_ZH[id].label : enLabel;
  },
  get short() {
    return isZh() && DOMAIN_ZH[id] ? DOMAIN_ZH[id].short : enShort;
  },
  color: sp(id),
});

export const DOMAINS: DomainInfo[] = [
  mkDom('ai', 'Artificial intelligence', 'AI'),
  mkDom('computing', 'Computing', 'Computing'),
  mkDom('semiconductors', 'Semiconductors', 'Chips'),
  mkDom('software', 'Software', 'Software'),
  mkDom('internet', 'Internet', 'Internet'),
  mkDom('communications', 'Communications', 'Comms'),
  mkDom('media', 'Media', 'Media'),
  mkDom('society', 'Society', 'Society'),
  mkDom('energy', 'Energy', 'Energy'),
  mkDom('transport', 'Transport', 'Transport'),
  mkDom('biotech', 'Biotech', 'Biotech'),
  mkDom('space', 'Space', 'Space'),
  mkDom('materials', 'Materials', 'Materials'),
  mkDom('agriculture', 'Agriculture and food', 'Agriculture'),
  mkDom('health', 'Health and sanitation', 'Health'),
  mkDom('home', 'Home', 'Home'),
];

export const DOMAIN: Record<string, DomainInfo> = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
export const domainColor = (id: string): string => (DOMAIN[id] ? domainBase(id) : '#8b8fa8');
export const domainInk = (id: string): string => (DOMAIN[id] ? domainLit(id) : '#aeb6dc');

export interface TypeInfo {
  id: string;
  readonly label: string;
  color: string;
}

const mkType = (id: string, enLabel: string, color: string): TypeInfo => ({
  id,
  get label() {
    return isZh() && TYPE_ZH[id] ? TYPE_ZH[id] : enLabel;
  },
  color,
});

export const TYPES: TypeInfo[] = [
  mkType('invention', 'Invention', '#1f4e8c'),
  mkType('discovery', 'Discovery', '#5b8fd0'),
  mkType('product', 'Product', '#9cc3e6'),
  mkType('milestone', 'Milestone', '#2a2f3a'),
  mkType('concept', 'Concept', '#8a63b5'),
  mkType('person', 'Person', '#c9a7dd'),
  mkType('market', 'Market', '#e9b22c'),
  mkType('policy', 'Policy', '#4c8a5a'),
  mkType('culture', 'Culture', '#e48ea4'),
  mkType('moment', 'Moment', '#e8a0b4'),
  mkType('hope', 'Hope', '#f2d04a'),
  mkType('fear', 'Fear', '#d23a2f'),
  mkType('failure', 'Failure', '#7a2420'),
  mkType('incident', 'Incident', '#f08a5d'),
  mkType('era', 'Era', '#9b958a'),
];

export const TYPE: Record<string, TypeInfo> = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const typeColor = (id: string): string => (TYPE[id] ? TYPE[id].color : '#999');

export interface AiEraInfo {
  id: string;
  readonly label: string;
  start: number;
  end: number;
  level: number;
  winter?: boolean;
}

const mkEra = (id: string, enLabel: string, start: number, end: number, level: number, winter?: boolean): AiEraInfo => ({
  id,
  get label() {
    return isZh() && AI_ERA_ZH[id] ? AI_ERA_ZH[id] : enLabel;
  },
  start,
  end,
  level,
  ...(winter ? { winter: true } : {}),
});

export const AI_ERAS: AiEraInfo[] = [
  mkEra('cybernetics', 'Cybernetics', 1943, 1956, 1),
  mkEra('symbolic', 'Symbolic AI', 1956, 1974, 2),
  mkEra('winter1', 'First AI winter', 1974, 1980, 0.9, true),
  mkEra('expert', 'Expert systems', 1980, 1987, 2.7),
  mkEra('winter2', 'Second AI winter', 1987, 1993, 1.5, true),
  mkEra('statistical', 'Statistical learning', 1993, 2012, 3.2),
  mkEra('deep', 'Deep learning', 2012, 2017, 4.3),
  mkEra('transformer', 'Transformers', 2017, 2020, 5.3),
  mkEra('foundation', 'Foundation models', 2020, 2024, 6.4),
  mkEra('agentic', 'Agentic systems', 2024, 2026, 7.5),
];

export const AI_ERA: Record<string, AiEraInfo> = Object.fromEntries(AI_ERAS.map((e) => [e.id, e]));
export const eraForYear = (y: number): AiEraInfo | null => {
  let f: AiEraInfo | null = null;
  for (const e of AI_ERAS) if (y >= e.start && y < e.end) f = e;
  if (!f && y >= 2026) f = AI_ERAS[AI_ERAS.length - 1];
  return f;
};

export const THREADS: Record<string, string> = {
  'automation-anxiety': '#d23a2f',
  'moores-law': '#2d5a88',
  'hype-cycle': '#e3a031',
  'ai-winter': '#6c8db3',
  privacy: '#8f6aa0',
  surveillance: '#5a3f73',
  misinformation: '#d8603c',
  'existential-risk': '#7a2420',
  'open-vs-closed': '#3f8f78',
  'compute-scaling': '#1f4e8c',
  'energy-demand': '#8a4e2c',
  regulation: '#4c8a5a',
  'geopolitics-chips': '#79a3c6',
  labor: '#c4552f',
  utopianism: '#e2bf3a',
  'military-origins': '#4a4a3a',
  democratization: '#6f8f4a',
  'platform-power': '#b0457a',
  safety: '#a33a3a',
  alignment: '#b8282e',
  copyright: '#c9a03a',
  bubble: '#e48ea4',
  'diffusion-lag': '#9b958a',
};

const extra = ['#2d5a88', '#d8603c', '#3f8f78', '#8f6aa0', '#e3a031', '#6f8f4a', '#b0457a', '#79a3c6'];
export const threadColor = (t: string): string => {
  if (THREADS[t]) return THREADS[t];
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return extra[h % extra.length];
};
export const prettyTag = (t: string): string => tagLabel(t);
