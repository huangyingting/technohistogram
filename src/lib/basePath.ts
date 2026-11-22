export const BASE_PATH: string = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

export function assetUrl(path: string | undefined | null): string {
  const s = String(path || '');
  if (!s) return '';
  if (/^(https?:|data:|blob:)/.test(s)) return s;
  const clean = s.startsWith('/') ? s : `/${s}`;
  if (BASE_PATH && (clean === BASE_PATH || clean.startsWith(`${BASE_PATH}/`))) {
    return clean;
  }
  return `${BASE_PATH}${clean}`;
}
