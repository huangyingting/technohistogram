import { SPECTRUM, domainBase, domainLit } from './spectrum';

const sp = (id: string) => (SPECTRUM[id] || SPECTRUM.computing)[2];

export interface DomainInfo {
  id: string;
  label: string;
  short: string;
  color: string;
}

export const DOMAINS: DomainInfo[] = [
  { id: 'ai', label: 'Artificial intelligence', short: 'AI', color: sp('ai') },
  { id: 'computing', label: 'Computing', short: 'Computing', color: sp('computing') },
  { id: 'semiconductors', label: 'Semiconductors', short: 'Chips', color: sp('semiconductors') },
  { id: 'software', label: 'Software', short: 'Software', color: sp('software') },
  { id: 'internet', label: 'Internet', short: 'Internet', color: sp('internet') },
  { id: 'communications', label: 'Communications', short: 'Comms', color: sp('communications') },
  { id: 'media', label: 'Media', short: 'Media', color: sp('media') },
  { id: 'society', label: 'Society', short: 'Society', color: sp('society') },
  { id: 'energy', label: 'Energy', short: 'Energy', color: sp('energy') },
  { id: 'transport', label: 'Transport', short: 'Transport', color: sp('transport') },
  { id: 'biotech', label: 'Biotech', short: 'Biotech', color: sp('biotech') },
  { id: 'space', label: 'Space', short: 'Space', color: sp('space') },
  { id: 'materials', label: 'Materials', short: 'Materials', color: sp('materials') },
  { id: 'agriculture', label: 'Agriculture and food', short: 'Agriculture', color: sp('agriculture') },
  { id: 'health', label: 'Health and sanitation', short: 'Health', color: sp('health') },
  { id: 'home', label: 'Home', short: 'Home', color: sp('home') },
];

export const DOMAIN: Record<string, DomainInfo> = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));
export const domainColor = (id: string): string => (DOMAIN[id] ? domainBase(id) : '#8b8fa8');
export const domainInk = (id: string): string => (DOMAIN[id] ? domainLit(id) : '#aeb6dc');

export interface TypeInfo {
  id: string;
  label: string;
  color: string;
}

export const TYPES: TypeInfo[] = [
  { id: 'invention', label: 'Invention', color: '#1f4e8c' },
  { id: 'discovery', label: 'Discovery', color: '#5b8fd0' },
  { id: 'product', label: 'Product', color: '#9cc3e6' },
  { id: 'milestone', label: 'Milestone', color: '#2a2f3a' },
  { id: 'concept', label: 'Concept', color: '#8a63b5' },
  { id: 'person', label: 'Person', color: '#c9a7dd' },
  { id: 'market', label: 'Market', color: '#e9b22c' },
  { id: 'policy', label: 'Policy', color: '#4c8a5a' },
  { id: 'culture', label: 'Culture', color: '#e48ea4' },
  { id: 'moment', label: 'Moment', color: '#e8a0b4' },
  { id: 'hope', label: 'Hope', color: '#f2d04a' },
  { id: 'fear', label: 'Fear', color: '#d23a2f' },
  { id: 'failure', label: 'Failure', color: '#7a2420' },
  { id: 'incident', label: 'Incident', color: '#f08a5d' },
  { id: 'era', label: 'Era', color: '#9b958a' },
];

export const TYPE: Record<string, TypeInfo> = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const typeColor = (id: string): string => (TYPE[id] ? TYPE[id].color : '#999');

export interface AiEraInfo {
  id: string;
  label: string;
  start: number;
  end: number;
  level: number;
  winter?: boolean;
}

export const AI_ERAS: AiEraInfo[] = [
  { id: 'cybernetics', label: 'Cybernetics', start: 1943, end: 1956, level: 1 },
  { id: 'symbolic', label: 'Symbolic AI', start: 1956, end: 1974, level: 2 },
  { id: 'winter1', label: 'First AI winter', start: 1974, end: 1980, level: 0.9, winter: true },
  { id: 'expert', label: 'Expert systems', start: 1980, end: 1987, level: 2.7 },
  { id: 'winter2', label: 'Second AI winter', start: 1987, end: 1993, level: 1.5, winter: true },
  { id: 'statistical', label: 'Statistical learning', start: 1993, end: 2012, level: 3.2 },
  { id: 'deep', label: 'Deep learning', start: 2012, end: 2017, level: 4.3 },
  { id: 'transformer', label: 'Transformers', start: 2017, end: 2020, level: 5.3 },
  { id: 'foundation', label: 'Foundation models', start: 2020, end: 2024, level: 6.4 },
  { id: 'agentic', label: 'Agentic systems', start: 2024, end: 2026, level: 7.5 },
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
export const prettyTag = (t: string): string => t.replace(/-/g, ' ');
