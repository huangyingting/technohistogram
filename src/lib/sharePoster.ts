import { db, ensureEventText, neighbors } from './data';
import { getTheme } from './theme';
import { isZh, DOMAIN_ZH, TYPE_ZH, REGION_ZH, FONT_STACK_DISPLAY, FONT_STACK_SANS } from './i18n';
import { chinesePeriodParallel, synthesizeZhArchivalDigest } from './dynasties';
import { fmtYear } from './time';
import { heat } from './spectrum';

/* ============================================================================
 * Pure ISO/IEC 18004 QR Code Matrix Encoder (Byte Mode, ECC Level L, V1..V10)
 * ========================================================================== */

// Version 1..10 specs for ECC Level L: [totalDataCodewords, ecCodewordsPerBlock, numBlocks, alignCenters[]]
const QR_VER_L: Record<number, [number, number, number, number[]]> = {
  1: [19, 7, 1, []],
  2: [34, 10, 1, [6, 18]],
  3: [55, 15, 1, [6, 22]],
  4: [80, 20, 1, [6, 26]],
  5: [108, 26, 1, [6, 30]],
  6: [136, 18, 2, [6, 34]],
  7: [156, 20, 2, [6, 22, 38]],
  8: [194, 24, 2, [6, 24, 42]],
  9: [232, 30, 2, [6, 26, 46]],
  10: [274, 18, 4, [6, 28, 50]],
};

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function bchFormatBits(eclBits: number, mask: number): number {
  const data = (eclBits << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersionBits(ver: number): number {
  let rem = ver << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (ver << 12) | rem;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let ver = 1;
  while (ver <= 10) {
    const [cap] = QR_VER_L[ver];
    const hdrBytes = ver <= 9 ? 2 : 3;
    if (bytes.length + hdrBytes <= cap) break;
    ver++;
  }
  if (ver > 10) ver = 10;
  const [totalData, ecPerBlock, numBlocks, align] = QR_VER_L[ver];
  const payload = bytes.length + (ver <= 9 ? 2 : 3) <= totalData ? bytes : bytes.slice(0, totalData - 3);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  // Mode 0100 (Byte)
  pushBits(0b0100, 4);
  pushBits(payload.length, ver <= 9 ? 8 : 16);
  for (let i = 0; i < payload.length; i++) pushBits(payload[i], 8);
  const maxBits = totalData * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords = new Uint8Array(totalData);
  const writtenBytes = bits.length >> 3;
  for (let i = 0; i < writtenBytes; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataWords[i] = b;
  }
  for (let i = writtenBytes, padIdx = 0; i < totalData; i++, padIdx++) {
    dataWords[i] = padIdx % 2 === 0 ? 0xec : 0x11;
  }

  // Split into blocks & interleave
  const shortBlockLen = Math.floor(totalData / numBlocks);
  const numLongBlocks = totalData % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = b < numShortBlocks ? shortBlockLen : shortBlockLen + 1;
    const slice = dataWords.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(slice);
    ecBlocks.push(rsEncode(slice, ecPerBlock));
  }

  const finalBytes: number[] = [];
  const maxBlockLen = shortBlockLen + (numLongBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) finalBytes.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalBytes.push(ecBlocks[b][i]);
    }
  }

  const size = ver * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunc[r][c] = true;
  };

  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r0 + dr;
        const cc = c0 + dc;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(rr, cc, inOuter && (onRing || inCore));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) {
        continue;
      }
      const cr = align[i];
      const cc = align[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(cr + dr, cc + dc, dist !== 1);
        }
      }
    }
  }

  // Dark module + reserve format info areas
  setFunc(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunc[8][i]) setFunc(8, i, false);
    if (!isFunc[i][8]) setFunc(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunc[8][size - 1 - i]) setFunc(8, size - 1 - i, false);
    if (!isFunc[size - 1 - i][8]) setFunc(size - 1 - i, 8, false);
  }
  if (ver >= 7) {
    const vbits = bchVersionBits(ver);
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(b, a, bit);
      setFunc(a, b, bit);
    }
  }

  // Zigzag codeword placement
  let bitIdx = 0;
  const totalStreamBits = finalBytes.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (!isFunc[r][c]) {
          let dark = false;
          if (bitIdx < totalStreamBits) {
            dark = ((finalBytes[bitIdx >> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          // Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark;
        }
      }
    }
  }

  // Format bits for ECC Level L (0b01), Mask 0 (0)
  const fbits = bchFormatBits(0b01, 0);
  for (let i = 0; i <= 5; i++) setFunc(8, i, ((fbits >>> i) & 1) !== 0);
  setFunc(8, 7, ((fbits >>> 6) & 1) !== 0);
  setFunc(8, 8, ((fbits >>> 7) & 1) !== 0);
  setFunc(7, 8, ((fbits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunc(14 - i, 8, ((fbits >>> i) & 1) !== 0);
  for (let i = 0; i < 8; i++) setFunc(8, size - 1 - i, ((fbits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunc(size - 15 + i, 8, ((fbits >>> i) & 1) !== 0);
  setFunc(size - 8, 8, true);

  return modules;
}

/* ============================================================================
 * Museum-Grade Archival Share Poster Renderer (1200 x 1560)
 * ========================================================================== */

function wrapParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  // Tokenize CJK characters individually and Latin words with trailing space
  const tokens = clean.match(/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]|[^\u3400-\u9fff\s]+\s*/g) || [clean];
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const test = cur + tk;
    if (cur && ctx.measureText(test.trimEnd()).width > maxWidth) {
      lines.push(cur.trimEnd());
      if (lines.length >= maxLines) {
        const last = lines[lines.length - 1];
        lines[lines.length - 1] = last.replace(/[，。；、,.!?\s]*$/, '') + '…';
        return lines;
      }
      cur = tk.trimStart();
    } else {
      cur = test;
    }
  }
  if (cur.trim() && lines.length < maxLines) lines.push(cur.trim());
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function exportEventPoster(eventOrId: any): Promise<boolean> {
  const e = typeof eventOrId === 'string' ? db.byId.get(eventOrId) : eventOrId;
  if (!e) return false;
  await ensureEventText(e.id);

  const zh = isZh();
  const theme = getTheme();
  const W = 1200;
  const H = 1560;
  const PAD = 64;
  const INNER_W = W - PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // 1. Theme-matched Background Gradient + Subtle Grid Frame
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.sky[0]);
  bgGrad.addColorStop(0.52, theme.sky[1]);
  bgGrad.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const yrT = Math.max(0, Math.min(1, (e.year - 1026) / 1000));
  const recColor = heat(yrT);

  // Subtle radial aura behind spiral frame
  const aura = ctx.createRadialGradient(W * 0.5, 380, 30, W * 0.5, 380, 560);
  aura.addColorStop(0, theme.isLight ? 'rgba(184, 55, 40, 0.09)' : 'rgba(45, 212, 191, 0.14)');
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, 900);

  // Outer editorial border
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 28, 28, W - 56, H - 56, 20);
  ctx.stroke();

  // 2. Top Masthead
  ctx.fillStyle = theme.soft;
  ctx.font = `600 18px ${FONT_STACK_SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(
    zh ? '技术演进全图 · TECHNOLOGY HISTOMAP' : 'TECHNOLOGY HISTOMAP · ARCHIVAL RECORD',
    PAD,
    84,
  );

  const sealText = `${zh ? theme.zh : theme.en} · #${String((e._i ?? 0) + 1).padStart(4, '0')}`;
  ctx.font = `500 17px "JetBrains Mono", monospace, ${FONT_STACK_SANS}`;
  const sealW = ctx.measureText(sealText).width;
  ctx.fillStyle = theme.accent;
  ctx.fillText(sealText, W - PAD - sealW, 84);

  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 106);
  ctx.lineTo(W - PAD, 106);
  ctx.stroke();

  // 3. Live 3D Spiral Stage Capture Window (1072 x 460)
  const frameX = PAD;
  const frameY = 132;
  const frameW = INNER_W;
  const frameH = 460;

  ctx.save();
  roundRect(ctx, frameX, frameY, frameW, frameH, 16);
  ctx.clip();
  ctx.fillStyle = theme.night;
  ctx.fillRect(frameX, frameY, frameW, frameH);

  const hx = typeof window !== 'undefined' ? (window as any).__helix : null;
  const stageSnap: HTMLCanvasElement | null = hx?.captureStageCanvas ? hx.captureStageCanvas() : null;
  if (stageSnap && stageSnap.width > 0 && stageSnap.height > 0) {
    // Center-crop biased slightly right where the 3D spiral sits
    const srcAspect = stageSnap.width / stageSnap.height;
    const dstAspect = frameW / frameH;
    let sx = 0;
    let sy = 0;
    let sw = stageSnap.width;
    let sh = stageSnap.height;
    if (srcAspect > dstAspect) {
      sw = stageSnap.height * dstAspect;
      sx = Math.min(stageSnap.width - sw, stageSnap.width * 0.22);
    } else {
      sh = stageSnap.width / dstAspect;
      sy = (stageSnap.height - sh) * 0.45;
    }
    ctx.drawImage(stageSnap, sx, sy, sw, sh, frameX, frameY, frameW, frameH);
  } else {
    // Graceful geometric astrolabe rings fallback
    for (let r = 60; r <= 340; r += 36) {
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(frameX + frameW * 0.55, frameY + frameH * 0.52, r * 1.45, r * 0.62, -0.14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Subtle bottom gradient fade inside viewport frame
  const vig = ctx.createLinearGradient(0, frameY + frameH - 110, 0, frameY + frameH);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, theme.isLight ? 'rgba(239,231,214,0.82)' : 'rgba(6,13,14,0.82)');
  ctx.fillStyle = vig;
  ctx.fillRect(frameX, frameY + frameH - 110, frameW, 110);

  // Caption pill inside viewport bottom-left
  ctx.fillStyle = theme.plate;
  roundRect(ctx, frameX + 20, frameY + frameH - 52, 340, 34, 8);
  ctx.fill();
  ctx.fillStyle = recColor;
  ctx.beginPath();
  ctx.arc(frameX + 38, frameY + frameH - 35, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.ink;
  ctx.font = `500 15px ${FONT_STACK_SANS}`;
  ctx.fillText(
    zh ? `三维时间螺旋实景 · 聚焦 ${fmtYear(e.year)}` : `3D Temporal Spiral · ${fmtYear(e.year)}`,
    frameX + 52,
    frameY + frameH - 29,
  );
  ctx.restore();

  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, frameX, frameY, frameW, frameH, 16);
  ctx.stroke();

  // 4. Era / Domain Kicker Pills
  let curY = frameY + frameH + 50;
  const domLabel = zh ? DOMAIN_ZH[e.domain]?.label || e.domain : e.domain;
  const typLabel = zh ? TYPE_ZH[e.type] || e.type : e.type;
  const periodLabel = zh ? chinesePeriodParallel(e.year) : e.region || '';
  const badges = [fmtYear(e.year), periodLabel, domLabel, typLabel].filter(Boolean);

  let bx = PAD;
  ctx.font = `600 17px ${FONT_STACK_SANS}`;
  for (let i = 0; i < badges.length; i++) {
    const bTxt = String(badges[i]);
    const tw = ctx.measureText(bTxt).width;
    const bw = tw + (i === 0 ? 38 : 26);
    ctx.fillStyle = i === 0 ? theme.cardSelBg : theme.cardBg;
    roundRect(ctx, bx, curY - 25, bw, 36, 9);
    ctx.fill();
    ctx.strokeStyle = i === 0 ? recColor : theme.cardBorder;
    ctx.lineWidth = i === 0 ? 1.6 : 1;
    ctx.stroke();
    if (i === 0) {
      ctx.fillStyle = recColor;
      ctx.beginPath();
      ctx.arc(bx + 15, curY - 7, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = theme.ink;
    ctx.fillText(bTxt, bx + (i === 0 ? 27 : 13), curY - 1);
    bx += bw + 12;
  }

  // 5. Title + Bilingual Subtitle
  curY += 64;
  const mainTitle = e.title || e.title_short || e.id;
  ctx.fillStyle = theme.ink;
  ctx.font = `600 44px ${FONT_STACK_DISPLAY}`;
  const titleLines = wrapParagraph(ctx, mainTitle, INNER_W, 3);
  for (const ln of titleLines) {
    ctx.fillText(ln, PAD, curY);
    curY += 58;
  }

  const enSub = zh && e._en?.title && e._en.title !== mainTitle ? e._en.title : '';
  if (enSub) {
    ctx.fillStyle = theme.soft;
    ctx.font = `italic 400 22px ${FONT_STACK_DISPLAY}`;
    const subLines = wrapParagraph(ctx, enSub, INNER_W, 2);
    for (const ln of subLines) {
      ctx.fillText(ln, PAD, curY - 8);
      curY += 32;
    }
    curY += 8;
  } else {
    curY += 6;
  }

  // Accent divider bar
  ctx.fillStyle = recColor;
  roundRect(ctx, PAD, curY - 12, 84, 4, 2);
  ctx.fill();
  curY += 28;

  // 6. Summary / Chinese Archival Digest
  const out = (e.connects || []).map((id: string) => db.byId.get(id)).filter(Boolean);
  const inc = (db.in.get(e.id) || []).map((id: string) => db.byId.get(id)).filter(Boolean);
  const bodyProse =
    zh && !e._hasZhSummary
      ? `${synthesizeZhArchivalDigest(e, inc, out)}${e.summary ? '  ' + e.summary : ''}`
      : e.summary || synthesizeZhArchivalDigest(e, inc, out);

  ctx.fillStyle = theme.ink;
  ctx.font = `400 24px ${FONT_STACK_SANS}`;
  const maxSummaryLines = Math.max(4, Math.floor((1245 - curY) / 40));
  const sumLines = wrapParagraph(ctx, bodyProse, INNER_W, maxSummaryLines);
  for (const ln of sumLines) {
    ctx.fillText(ln, PAD, curY);
    curY += 40;
  }

  // 7. Metadata Strip above QR Footer
  const metaY = 1278;
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, metaY);
  ctx.lineTo(W - PAD, metaY);
  ctx.stroke();

  const connCount = neighbors(e.id).length;
  const srcCount = (e.sources || []).length;
  const whoOrg = [...(e.people || []).slice(0, 2), ...(e.orgs || []).slice(0, 2)].join(' · ');

  // 8. QR Code + Deep Link Footer (1296 .. 1500)
  const shareUrl = (() => {
    if (typeof window === 'undefined') return `https://huangyingting.github.io/technohistogram/#v=spiral&e=${e.id}`;
    const u = new URL(window.location.href);
    u.searchParams.set('lang', zh ? 'zh' : 'en');
    u.searchParams.set('theme', theme.id);
    u.hash = `v=spiral&e=${encodeURIComponent(e.id)}`;
    return u.toString();
  })();

  const qrMatrix = encodeQrMatrix(shareUrl);
  const qrMods = qrMatrix.length;
  const qrBox = 172;
  const quiet = 3;
  const cell = qrBox / (qrMods + quiet * 2);
  const qrX = W - PAD - qrBox;
  const qrY = metaY + 28;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX, qrY, qrBox, qrBox, 12);
  ctx.fill();
  ctx.strokeStyle = theme.cardBorder;
  ctx.stroke();

  ctx.fillStyle = '#111618';
  for (let r = 0; r < qrMods; r++) {
    for (let c = 0; c < qrMods; c++) {
      if (qrMatrix[r][c]) {
        ctx.fillRect(
          qrX + (c + quiet) * cell,
          qrY + (r + quiet) * cell,
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }

  // Left footer callouts
  let fy = metaY + 58;
  ctx.fillStyle = theme.ink;
  ctx.font = `600 22px ${FONT_STACK_SANS}`;
  ctx.fillText(
    zh
      ? `因果关联节点 ${connCount} 项  ·  原始考证文献 ${srcCount} 篇`
      : `${connCount} Connected Records  ·  ${srcCount} Primary Sources`,
    PAD,
    fy,
  );
  if (whoOrg) {
    fy += 36;
    ctx.fillStyle = theme.soft;
    ctx.font = `500 19px ${FONT_STACK_SANS}`;
    const woLine = wrapParagraph(ctx, `${zh ? '人物与机构：' : 'Figures & Orgs: '}${whoOrg}`, INNER_W - qrBox - 36, 1)[0];
    if (woLine) ctx.fillText(woLine, PAD, fy);
  }
  fy += 42;
  ctx.fillStyle = theme.accent;
  ctx.font = `500 18px ${FONT_STACK_SANS}`;
  ctx.fillText(
    zh
      ? '扫码直达三维 WebGPU 时间螺旋对应坐标 →'
      : 'Scan QR to jump directly to this coordinate on the 3D Spiral →',
    PAD,
    fy,
  );
  fy += 30;
  ctx.fillStyle = theme.ink3;
  ctx.font = `400 15px "JetBrains Mono", monospace`;
  const shortLink = shareUrl.replace(/^https?:\/\//, '');
  ctx.fillText(shortLink.length > 66 ? shortLink.slice(0, 65) + '…' : shortLink, PAD, fy);

  // Trigger download (encode synchronously via toDataURL -> Blob so Blink's
  // PostIdleTask scheduler never stalls when the 3D canvas is at rest or under
  // prefers-reduced-motion: reduce)
  const dataUrl = canvas.toDataURL('image/png');
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return false;
  const b64 = atob(dataUrl.slice(commaIdx + 1));
  const bytes = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) bytes[i] = b64.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeYear = e.year < 0 ? `${Math.abs(e.year)}bce` : String(e.year);
  a.href = objUrl;
  a.download = `histomap-${safeYear}-${e.id.slice(0, 36)}.png`;
  a.style.display = 'none';
  a.addEventListener('click', (ev) => ev.stopPropagation());
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(objUrl);
  }, 5000);
  return true;
}
