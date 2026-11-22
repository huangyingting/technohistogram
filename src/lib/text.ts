export const shortTitle = (e: { title_short?: string; title?: string } | null | undefined): string =>
  (e && (e.title_short || e.title)) || '';

export function wrapChars(s: string | null | undefined, n: number, max = 2): string[] {
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (lines.length === max - 1) {
      cur = cur ? cur + ' ' + w : w;
      continue;
    }
    if (cur && (cur + ' ' + w).length > n) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
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
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const t = cur ? cur + ' ' + word : word;
    if (ctx.measureText(t).width <= w || !cur) {
      cur = t;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length === max) break;
    }
  }
  if (lines.length < max && cur) {
    lines.push(cur);
  } else if (lines.length === max) {
    const rest = words.slice(lines.join(' ').split(' ').length).join(' ');
    let last = lines[max - 1] + (rest ? ' ' + rest : '');
    while (last.length > 3 && ctx.measureText(last + '\u2026').width > w) last = last.slice(0, -1);
    lines[max - 1] = last.length < (lines[max - 1] + (rest ? ' ' + rest : '')).length ? last.trimEnd() + '\u2026' : last;
  }
  return lines;
}

export function tspans(textSel: any, lines: string[], x: number, lh: number) {
  textSel.text(null);
  lines.forEach((l, i) => textSel.append('tspan').attr('x', x).attr('dy', i === 0 ? 0 : lh).text(l));
  return textSel;
}
