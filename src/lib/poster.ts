// The poster: one composed still of the arrival for automated link-card capture or #poster=1 review.
import { hashParams } from './store';

export interface PosterConfig {
  year: number;
  window: number;
  ahead: number;
  ball: number;
  lift: number;
  ox: number;
  oy: number;
  spin: number;
  rise: number;
}

const DEFAULTS: PosterConfig = {
  year: 1400,
  window: 160,
  ahead: 60,
  ball: 1.15,
  lift: 0.38,
  ox: 0.58,
  oy: 0.34,
  spin: 2.6,
  rise: 0.5,
};

function parse(raw: string): PosterConfig {
  const v = String(raw || '').split(',').map((s) => parseFloat(s));
  const keys: (keyof PosterConfig)[] = ['year', 'window', 'ahead', 'ball', 'lift', 'ox', 'oy', 'spin', 'rise'];
  const out: PosterConfig = { ...DEFAULTS };
  if (v.length > 1 || (v.length === 1 && v[0] > 1026)) {
    keys.forEach((k, i) => {
      if (Number.isFinite(v[i])) out[k] = v[i];
    });
  }
  return out;
}

export let POSTER: PosterConfig | null = null;

export function initPoster(): PosterConfig | null {
  if (typeof window === 'undefined') {
    POSTER = null;
    return null;
  }
  const asked = hashParams().get('poster');
  const qsNoPoster = new URLSearchParams(location.search).get('poster') === '0';
  if (asked === '0' || asked === 'false' || qsNoPoster) {
    POSTER = null;
  } else if (asked != null) {
    POSTER = parse(asked);
  } else {
    const noInput =
      !matchMedia('(pointer: fine)').matches &&
      !matchMedia('(hover: hover)').matches &&
      !(navigator.maxTouchPoints > 0);
    // Only auto-enable headless poster capture when arrival is active (bare URL), matching link-card capture
    POSTER = window.__ARRIVAL && (navigator.webdriver || noInput) ? { ...DEFAULTS } : null;
  }

  if (POSTER) {
    if (!document.getElementById('poster-style')) {
      const st = document.createElement('style');
      st.id = 'poster-style';
      st.textContent = '.topbar { display: none !important; }';
      document.head.appendChild(st);
    }
  } else {
    document.getElementById('poster-style')?.remove();
  }
  return POSTER;
}

export function clearPoster(): void {
  POSTER = null;
  if (typeof document !== 'undefined') {
    document.getElementById('poster-style')?.remove();
  }
}

if (typeof window !== 'undefined') {
  initPoster();
}
