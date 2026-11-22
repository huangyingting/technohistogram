export const shortTitle = (e: { title_short?: string; title?: string } | null | undefined): string =>
  (e && (e.title_short || e.title)) || '';

export interface WrapToken {
  t: string;
  cjk: boolean;
}

const CJK_TOKEN_RE =
  /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF][\u3000-\u303F\uFF01-\uFF60\u2014\u2018-\u201F\u2026\u00B7]*|[\u201C\u2018\u300A\u3008\u300C\u300E\uFF08\u3010]+[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]|[^\s\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]+/g;

const CJK_CHAR_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;

export function tokenizeText(s: string | null | undefined): WrapToken[] {
  const raw = String(s || '').trim();
  if (!raw) return [];
  const matches = raw.match(CJK_TOKEN_RE);
  if (!matches) return [];
  return matches.map((t) => ({ t, cjk: CJK_CHAR_RE.test(t) }));
}

export function joinToken(cur: string, prevCjk: boolean, tok: WrapToken): string {
  if (!cur) return tok.t;
  if (prevCjk || tok.cjk) return cur + tok.t;
  return cur + ' ' + tok.t;
}

export function wrapChars(s: string | null | undefined, n: number, max = 2): string[] {
  const toks = tokenizeText(s);
  const lines: string[] = [];
  let cur = '';
  let prevCjk = false;
  let curUnits = 0;
  for (const tok of toks) {
    const u = tok.cjk ? tok.t.length * 1.8 : tok.t.length + (cur && !prevCjk ? 1 : 0);
    if (lines.length === max - 1) {
      cur = joinToken(cur, prevCjk, tok);
      prevCjk = tok.cjk;
      curUnits += u;
      continue;
    }
    if (cur && curUnits + u > n) {
      lines.push(cur);
      cur = tok.t;
      prevCjk = tok.cjk;
      curUnits = tok.cjk ? tok.t.length * 1.8 : tok.t.length;
    } else {
      cur = joinToken(cur, prevCjk, tok);
      prevCjk = tok.cjk;
      curUnits += u;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function wrapMeasured(
  ctx: CanvasRenderingContext2D,
  s: string | null | undefined,
  w: number,
  font: string,
  max = 2,
): string[] {
  ctx.font = font;
  const toks = tokenizeText(s);
  const lines: string[] = [];
  let cur = '';
  let prevCjk = false;
  let idx = 0;
  for (; idx < toks.length; idx++) {
    const tok = toks[idx];
    const t = joinToken(cur, prevCjk, tok);
    if (ctx.measureText(t).width <= w || !cur) {
      cur = t;
      prevCjk = tok.cjk;
    } else {
      lines.push(cur);
      cur = tok.t;
      prevCjk = tok.cjk;
      if (lines.length === max) break;
    }
  }
  if (lines.length < max && cur) {
    lines.push(cur);
  } else if (lines.length === max) {
    let rest = cur;
    let pCjk = prevCjk;
    for (let j = idx + 1; j < toks.length; j++) {
      rest = joinToken(rest, pCjk, toks[j]);
      pCjk = toks[j].cjk;
    }
    const base = lines[max - 1];
    const baseEndsCjk = CJK_CHAR_RE.test(base.slice(-1));
    const fullLast = rest
      ? baseEndsCjk || CJK_CHAR_RE.test(rest[0] || '')
        ? base + rest
        : base + ' ' + rest
      : base;
    let last = fullLast;
    while (last.length > 2 && ctx.measureText(last + '\u2026').width > w) {
      last = last.slice(0, -1);
    }
    lines[max - 1] = last.length < fullLast.length ? last.trimEnd() + '\u2026' : last;
  }
  return lines;
}

export function tspans(textSel: any, lines: string[], x: number, lh: number) {
  textSel.text(null);
  lines.forEach((l, i) => textSel.append('tspan').attr('x', x).attr('dy', i === 0 ? 0 : lh).text(l));
  return textSel;
}
