// The arrival: the Image World globe drops onto the night, bounces, and breaks open; its 342 photographs and the record's
// 3,429 grains fly to their own places on the spiral, which waits beneath.
// Rendered with Three.js WebGPURenderer + TSL InstancedMesh batches (one draw call per atlas sheet) and a 2D grain/halo overlay.
import * as THREE from 'three/webgpu';
import {
  Fn,
  attribute,
  float,
  frontFacing,
  select,
  texture,
  uv,
  vec2,
  vec4,
  If,
  Discard,
} from 'three/tsl';
import { slotOf, SLOT_MAX } from '../lib/time';
import { heat, sunk, mix } from '../lib/spectrum';
import { POSTER } from '../lib/poster';
import { assetUrl } from '../lib/basePath';
import { createWebGPURenderer, loadGpuTexture } from './webgpu';

const BASE = `${assetUrl('/arrival')}/`;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

export interface ArrivalTargets {
  ok: boolean;
  dots?: Float32Array;
  picAt?: Float32Array;
  cx?: number;
  cy?: number;
  R?: number;
  pic?: number;
}

export interface RunArrivalOpts {
  targets: () => ArrivalTargets;
  ready?: () => boolean;
  onReveal?: () => void;
  onDone?: () => void;
}

interface CardInstance {
  it: any;
  dir: THREE.Vector3;
  full: THREE.Vector4;
  sq: THREE.Vector4;
  a: number;
  arc: number;
  outward: THREE.Quaternion;
  batchIdx: number;
  instIdx: number;
}

interface AtlasBatch {
  mesh: THREE.InstancedMesh;
  rectArr: Float32Array;
  rectAttr: THREE.InstancedBufferAttribute;
  opArr: Float32Array;
  opAttr: THREE.InstancedBufferAttribute;
}

export function runArrival({ targets, ready, onReveal, onDone }: RunArrivalOpts) {
  const PHONE = typeof innerWidth === 'number' && innerHeight > innerWidth;
  const DROP = PHONE ? 0.08 : 0.5;
  const FALL = 0.42;
  const CONTACT = 0.05;
  const HOPS: [number, number][] = PHONE
    ? [[0.11, 0.28]]
    : [
        [0.11, 0.34],
        [0.045, 0.22],
        [0.018, 0.14],
      ];
  const IMPACT =
    DROP + FALL + HOPS.reduce((t, [, d]) => t + CONTACT + d, 0) + CONTACT;
  const CLK0 = IMPACT + 0.02;
  const CLK1 = PHONE ? CLK0 + 0.68 : 4.75;
  const FLY = PHONE ? 0.4 : 0.55;
  const END = PHONE ? CLK1 + FLY : 5.3;
  const FADE = 0.5;
  const TITLE_HOLD = PHONE ? 0.2 : 0.55;
  const TITLE_FADE = PHONE ? 0.5 : 0.7;

  seed = 11;
  const reduced =
    !POSTER &&
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = document.createElement('div');
  host.className = 'arrival';
  let pre = document.getElementById('ar-pre');
  if (pre && POSTER) {
    pre.remove();
    pre = null;
  }
  host.innerHTML =
    '<canvas class="ar-gl"></canvas><canvas class="ar-ov"></canvas>' +
    (pre
      ? ''
      : '<h2 class="ar-lines" aria-live="polite"><span>Technology <em>Histomap</em></span><small>3.3 million BCE to 2026</small></h2>');
  document.body.appendChild(host);
  if (pre) pre.classList.add('live');
  requestAnimationFrame(() => document.documentElement.classList.remove('arrival-mode'));

  const gl = host.querySelector('.ar-gl') as HTMLCanvasElement;
  const ov = host.querySelector('.ar-ov') as HTMLCanvasElement;
  const ctx = ov.getContext('2d')!;
  const lines = (pre || host.querySelector('.ar-lines')) as HTMLElement;

  let renderer: THREE.WebGPURenderer | null = null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  let DPR = Math.min(window.devicePixelRatio || 1, 2);

  const L = {
    W: 0,
    H: 0,
    cx: 0,
    cy: 0,
    R: 0,
    ballR: 0,
    ballX: 0,
    ballY0: 0,
    floor: 0,
    Hv: 0,
    s: 12,
    phone: false,
    dot: null as Float32Array | null,
    picAt: null as Float32Array | null,
    arr: null as Float32Array | null,
  };
  const D = { events: [] as any[], images: [] as any[] };
  const cards: CardInstance[] = [];
  const batches: AtlasBatch[] = [];
  let sheetTex: THREE.Texture[] = [];
  let sheetGeo: THREE.PlaneGeometry | null = null;
  let booted = false;
  let t0 = 0;
  let lastS = 0;
  let slowPrev = false;
  let preOut = false;
  let done = false;
  let raf = 0;
  let T: ArrivalTargets | null = null;
  const evKey: number[] = [];
  let wpp = 1;

  const toWorld = (px: number, py: number, out: THREE.Vector3) =>
    out.set((px - L.W / 2) * wpp, (L.H / 2 - py) * wpp, 0);

  function layout() {
    L.W = innerWidth;
    L.H = innerHeight;
    L.phone = L.W < 760;
    T = targets();
    if (T && T.ok && T.dots) {
      L.cx = T.cx!;
      L.cy = T.cy!;
      L.R = T.R!;
      L.dot = T.dots;
      L.s = T.pic || 12;
      L.picAt = T.picAt || null;
    } else {
      L.cx = L.W / 2;
      L.cy = L.H * 0.52;
      L.R = Math.min(L.W, L.H) * 0.36;
      L.s = L.phone ? 9 : 12;
      L.dot = null;
    }
    L.ballR = POSTER
      ? clamp(L.R * POSTER.ball, 40, 320)
      : clamp(Math.min(L.W, L.H) * 0.27, 110, 300);
    L.ballX = L.cx;
    L.floor = L.cy + L.ballR;
    L.ballY0 = -L.ballR * 1.2;
    L.Hv = L.H;
    const n = D.events.length;
    if (n && !L.arr) {
      L.arr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        L.arr[i] = clamp(slotOf(D.events[i][0]) / SLOT_MAX, 0, 1);
      }
    }
    if (L.dot) {
      for (const c of cards) {
        const it = c.it;
        const e = it.e;
        if (e >= 0 && L.picAt && Number.isFinite(L.picAt[e * 2])) {
          it.px = L.picAt[e * 2];
          it.py = L.picAt[e * 2 + 1];
        } else if (e >= 0 && Number.isFinite(L.dot[e * 2])) {
          it.px = L.dot[e * 2];
          it.py = L.dot[e * 2 + 1];
        } else {
          it.px = L.cx + (rnd() - 0.5) * 40;
          it.py = L.cy + (rnd() - 0.5) * 40;
        }
      }
    }
    for (const it of D.images) {
      if (!(it.arr >= 0)) it.arr = clamp(slotOf(it.y) / SLOT_MAX, 0, 1);
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    layout();
    for (const c of [gl, ov]) {
      c.style.width = L.W + 'px';
      c.style.height = L.H + 'px';
    }
    if (renderer) {
      renderer.setPixelRatio(DPR);
      renderer.setSize(L.W, L.H, false);
    }
    ov.width = Math.round(L.W * DPR);
    ov.height = Math.round(L.H * DPR);
    camera.aspect = L.W / Math.max(1, L.H);
    camera.position.set(0, 0, 60);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    wpp = (2 * 60 * Math.tan(THREE.MathUtils.degToRad(20))) / Math.max(1, L.H);
  }

  function ball(t: number) {
    const fl = L.floor - L.ballR;
    if (t < DROP) return { y: L.ballY0, sq: 0 };
    if (t < DROP + FALL) {
      const u = (t - DROP) / FALL;
      return { y: L.ballY0 + (fl - L.ballY0) * u * u, sq: 0 };
    }
    let c = DROP + FALL;
    for (const [h, d] of HOPS) {
      if (t < c + CONTACT) {
        return {
          y: fl,
          sq: Math.sin((Math.PI * (t - c)) / CONTACT) * (0.05 + h * 0.5),
        };
      }
      c += CONTACT;
      if (t < c + d) {
        const v = (t - c) / d;
        return { y: fl - h * L.Hv * 4 * v * (1 - v), sq: 0 };
      }
      c += d;
    }
    return { y: fl, sq: Math.min(1, (t - c) / CONTACT) * 0.12 };
  }

  const clock = (t: number) => {
    const u = clamp((t - CLK0) / (CLK1 - CLK0), 0, 1);
    return 1 - Math.pow(1 - u, 1.9);
  };
  const clockT = (a: number) =>
    CLK0 + (1 - Math.pow(1 - a, 1 / 1.9)) * (CLK1 - CLK0);

  function remaining(t: number) {
    const k = clock(t);
    let n = 0;
    for (const it of D.images) if (it.arr > k) n++;
    return n / Math.max(1, D.images.length);
  }

  const SPR: Record<number, HTMLCanvasElement> = {};
  function grain(key: number) {
    if (SPR[key]) return SPR[key];
    const c = document.createElement('canvas');
    const S = 32;
    c.width = c.height = S;
    const h = heat(key / 31);
    const x = c.getContext('2d')!;
    const col = mix(h, '#ffffff', 0.18);
    const deep = sunk(h, 0.55);
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, col);
    g.addColorStop(0.3, col);
    g.addColorStop(0.42, hexA(deep, 0.5));
    g.addColorStop(0.75, hexA(deep, 0.08));
    g.addColorStop(1, hexA(deep, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return (SPR[key] = c);
  }

  function makeAtlasMaterial(tex: THREE.Texture) {
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthTest = true;
    mat.depthWrite = true;
    mat.side = THREE.DoubleSide;
    const aRect = attribute('aRect', 'vec4');
    const aOpacity = attribute('aOpacity', 'float');
    mat.outputNode = Fn(() => {
      If(aOpacity.lessThan(0.01), () => {
        Discard();
      });
      const baseUv = uv();
      const ux = select(frontFacing, baseUv.x, float(1.0).sub(baseUv.x));
      const sampleUv = aRect.xy.add(vec2(ux, baseUv.y).mul(aRect.zw));
      const c = texture(tex, sampleUv).rgb.mul(0.96);
      return vec4(c, aOpacity);
    })();
    return mat;
  }

  async function boot() {
    renderer = await createWebGPURenderer(gl, {
      alpha: true,
      antialias: true,
      clearColor: 0x000000,
      clearAlpha: 0,
      label: 'arrival',
    });
    if (done) {
      renderer.dispose();
      return;
    }

    const A = window.__arr || null;
    const dataUrl = `${BASE}data2.json`;
    let res = A && A.data ? await A.data.catch(() => null) : null;
    if (!res || !res.ok) res = await fetch(dataUrl);
    const data = await res.json();
    if (done) return;

    D.events = data.events;
    D.images = data.images.filter((i: any) => i.e >= 0);
    D.images.sort((a: any, b: any) => a.y - b.y || a.u - b.u);

    const pf = data.pictures_from;
    const picN =
      data.pictures > 0 &&
      Array.isArray(pf) &&
      pf[0] === data.record_pictures &&
      pf[1] === D.images.length
        ? data.pictures
        : 0;
    const sub = lines?.querySelector('small');
    const counts = ` \u00b7 ${D.events.length.toLocaleString('en-US')} records${picN ? ` \u00b7 ${picN.toLocaleString('en-US')} pictures` : ''}`;
    if (sub && pre) {
      const c = document.createElement('i');
      c.textContent = counts;
      sub.appendChild(c);
      requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on')));
    } else if (sub) {
      sub.textContent = `3.3 million BCE to 2026${counts}`;
    }

    D.events.forEach((e: any) =>
      evKey.push(clamp(Math.round((slotOf(e[0]) / SLOT_MAX) * 31), 0, 31)),
    );
    const nAtlas = Math.max(...D.images.map((i: any) => i.atlas)) + 1;
    const sheets = A && A.sheets ? await A.sheets.catch(() => null) : null;

    const tex = await Promise.all(
      Array.from({ length: nAtlas }, (_, i) =>
        loadGpuTexture(
          `${BASE}thumb${i}.jpg`,
          sheets ? (sheets[i] ?? null) : null,
        ),
      ),
    );
    sheetTex = tex;
    if (done) {
      for (const t of tex) t.dispose();
      return;
    }

    const baseGeo = (sheetGeo = new THREE.PlaneGeometry(1, 1));
    const golden = Math.PI * (3 - Math.sqrt(5));

    // Group images by atlas into 9 InstancedMeshes
    const byAtlas: { it: any; globalIdx: number }[][] = Array.from(
      { length: nAtlas },
      () => [],
    );
    D.images.forEach((it: any, i: number) => {
      byAtlas[it.atlas].push({ it, globalIdx: i });
    });

    for (let ai = 0; ai < nAtlas; ai++) {
      const group = byAtlas[ai];
      const cnt = Math.max(1, group.length);
      const geo = baseGeo.clone();
      const rectArr = new Float32Array(cnt * 4);
      const opArr = new Float32Array(cnt);
      const rectAttr = new THREE.InstancedBufferAttribute(rectArr, 4);
      const opAttr = new THREE.InstancedBufferAttribute(opArr, 1);
      rectAttr.setUsage(THREE.DynamicDrawUsage);
      opAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aRect', rectAttr);
      geo.setAttribute('aOpacity', opAttr);

      const mat = makeAtlasMaterial(tex[ai]);
      const mesh = new THREE.InstancedMesh(geo, mat, cnt);
      mesh.count = group.length;
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      scene.add(mesh);

      const batchIdx = batches.length;
      batches.push({ mesh, rectArr, rectAttr, opArr, opAttr });

      group.forEach(({ it, globalIdx }, instIdx) => {
        const q = (globalIdx * 0.7548776662 + 0.31) % 1;
        const z = 1 - 2 * q;
        const rad = Math.sqrt(1 - z * z);
        const th = golden * globalIdx;
        const dir = new THREE.Vector3(Math.cos(th) * rad, z, Math.sin(th) * rad);
        const a = it.a;
        const full = new THREE.Vector4(it.u, it.v, it.uw, it.vh);
        const sq =
          a > 1
            ? new THREE.Vector4(it.u + (it.uw - it.uw / a) / 2, it.v, it.uw / a, it.vh)
            : new THREE.Vector4(it.u, it.v + (it.vh - it.vh * a) / 2, it.uw, it.vh * a);
        const outward = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)),
        );
        rectArr[instIdx * 4] = full.x;
        rectArr[instIdx * 4 + 1] = full.y;
        rectArr[instIdx * 4 + 2] = full.z;
        rectArr[instIdx * 4 + 3] = full.w;
        opArr[instIdx] = 1;
        cards.push({
          it,
          dir,
          full,
          sq,
          a: clamp(a, 0.6, 1.7),
          arc: 20 + rnd() * 40,
          outward,
          batchIdx,
          instIdx,
        });
      });
    }

    resize();
    addEventListener('resize', resize);

    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
    try {
      await Promise.race([
        renderer.compileAsync(scene, camera),
        new Promise((r) => setTimeout(r, 800)),
      ]);
    } catch {
      /* compiled on first render */
    }

    const w0 = performance.now();
    while (!done && ready && !ready() && performance.now() - w0 < 2500) {
      await nextFrame();
    }
    if (done) return;
    await nextFrame();
    booted = true;
    t0 = performance.now() / 1000;
    if (window.performance && performance.mark) performance.mark('arrival-clock');
  }

  const COL: string[] = [];
  for (let k = 0; k < 32; k++) COL.push(mix(heat(k / 31), '#ffffff', 0.3));

  function light(time: number, b: { y: number; sq: number }, Rb: number) {
    const cx = L.ballX;
    const cy = b.y;
    if (time < IMPACT + 0.4) {
      const a =
        0.22 *
        clamp((time - DROP * 0.6) / 0.4, 0, 1) *
        (time < IMPACT ? 1 : 1 - (time - IMPACT) / 0.4);
      const g = ctx.createRadialGradient(cx, cy, Rb * 0.5, cx, cy, Rb * 2.1);
      g.addColorStop(0, `rgba(255,232,180,${a})`);
      g.addColorStop(0.45, `rgba(255,214,150,${a * 0.35})`);
      g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - Rb * 2.2, cy - Rb * 2.2, Rb * 4.4, Rb * 4.4);
    }
    if (b.sq > 0 && time < IMPACT + 0.05) {
      const a = clamp(b.sq * 2.2, 0, 0.55);
      const fw = L.ballR * 2.6;
      const fh = L.ballR * 0.5;
      const g = ctx.createRadialGradient(cx, L.floor, 0, cx, L.floor, fw);
      g.addColorStop(0, `rgba(255,236,200,${a})`);
      g.addColorStop(0.35, `rgba(255,220,170,${a * 0.3})`);
      g.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.save();
      ctx.translate(cx, L.floor);
      ctx.scale(1, fh / fw);
      ctx.translate(-cx, -L.floor);
      ctx.fillStyle = g;
      ctx.fillRect(cx - fw, L.floor - fw, fw * 2, fw * 2);
      ctx.restore();
    }
  }

  function drawOverlay(time: number) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    const b = ball(Math.min(time, IMPACT));
    const rem = L.dot ? remaining(time) : 1;
    const Rb = L.ballR * Math.sqrt(Math.max(rem, 0.02));
    ctx.globalCompositeOperation = 'lighter';
    light(time, b, Rb);
    if (!L.dot || !L.arr) {
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const sz0 = L.phone ? 1.6 : 2.2;
    const trails = rem > 0.15;
    for (let i = 0; i < D.events.length; i++) {
      const tx = L.dot[i * 2];
      if (!Number.isFinite(tx)) continue;
      const dl = clockT(L.arr[i]);
      const kk = clamp((time - dl) / FLY, 0, 1);
      if (kk <= 0) continue;
      const e = easeOut(kk);
      const ty = L.dot[i * 2 + 1];
      const arcH = 24 * ((i % 5) / 5);
      const ang = i * 2.399;
      const sx = L.ballX + Math.cos(ang) * Rb * 0.9;
      const sy = b.y + Math.sin(ang) * Rb * 0.9;
      const x = sx + (tx - sx) * e;
      const y = sy + (ty - sy) * e - Math.sin(Math.PI * e) * arcH;
      if (trails && kk > 0.04 && kk < 1) {
        const e2 = easeOut(Math.max(0, kk - 0.06));
        let x2 = sx + (tx - sx) * e2;
        let y2 = sy + (ty - sy) * e2 - Math.sin(Math.PI * e2) * arcH;
        const dx = x - x2;
        const dy = y - y2;
        const len = Math.hypot(dx, dy);
        const cap = L.phone ? 26 : 44;
        if (len > cap) {
          x2 = x - (dx / len) * cap;
          y2 = y - (dy / len) * cap;
        }
        ctx.globalAlpha = 0.2 * (1 - kk);
        ctx.strokeStyle = COL[evKey[i]];
        ctx.lineWidth = sz0 * 0.7;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      const sz = sz0 * (0.6 + 0.4 * kk);
      ctx.globalAlpha = 0.55 + 0.45 * kk;
      ctx.drawImage(grain(evKey[i]), x - sz, y - sz, sz * 2, sz * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  let held = 0;
  let holdFrom: number | null = null;
  let revealed = false;
  let skipped = false;

  const skip = (ev?: any) => {
    if (ev && ev.type === 'keydown' && (ev.metaKey || ev.ctrlKey || ev.altKey)) return;
    skipped = true;
    if (!booted && !done && !POSTER) {
      onReveal && onReveal();
      finish();
    }
  };
  const skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  for (const t of skipEvents) addEventListener(t, skip, { passive: true, capture: true });

  const v = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const posV = new THREE.Vector3();
  const sclV = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const flatQ = new THREE.Quaternion();
  const spinAxis = new THREE.Vector3(0, 1, 0);
  const spinQ = new THREE.Quaternion();
  const mat4 = new THREE.Matrix4();
  const rectTmp = new THREE.Vector4();
  const toCamV = new THREE.Vector3();

  let stillOn = !!POSTER;
  function release() {
    if (!stillOn) return;
    stillOn = false;
    skipped = true;
    const st = document.getElementById('poster-style');
    if (st) st.remove();
  }
  if (POSTER) {
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
      addEventListener(ev, release, { passive: true, once: false });
    }
    setTimeout(release, 30000);
  }

  function flushBatches() {
    for (const b of batches) {
      b.mesh.instanceMatrix.needsUpdate = true;
      b.rectAttr.needsUpdate = true;
      b.opAttr.needsUpdate = true;
    }
  }

  function frame() {
    if (done) return;
    raf = requestAnimationFrame(frame);
    if (!booted || !renderer) return;
    if (stillOn) {
      still();
      return;
    }
    const nowS = performance.now() / 1000;
    const gap = lastS ? nowS - lastS : 0;
    if (gap > 0.1 && !slowPrev) t0 += gap - 1 / 60;
    slowPrev = gap > 0.1;
    lastS = nowS;
    const raw = nowS - t0;
    if (!L.dot) layout();
    if (!L.dot && raw - held > IMPACT) {
      if (holdFrom == null) holdFrom = raw;
      held += raw - holdFrom;
      holdFrom = raw;
    }
    let time = raw - held;
    if ((reduced || skipped) && time < END) {
      held = raw - END;
      holdFrom = null;
      time = END;
    }

    if (pre) {
      if (time >= IMPACT + TITLE_HOLD) {
        if (!preOut) {
          preOut = true;
          pre.style.transition = 'none';
        }
        pre.style.opacity = String(
          clamp(1 - (time - IMPACT - TITLE_HOLD) / TITLE_FADE, 0, 1),
        );
      }
    } else if (lines) {
      lines.style.opacity = String(
        time < 0.1
          ? 0
          : time < 0.6
            ? easeOut((time - 0.1) / 0.5)
            : time < IMPACT + TITLE_HOLD
              ? 1
              : clamp(1 - (time - IMPACT - TITLE_HOLD) / TITLE_FADE, 0, 1),
      );
    }

    const b = ball(Math.min(time, IMPACT + 0.05));
    const rem = remaining(time);
    const Rpx = L.ballR * Math.sqrt(Math.max(rem, 0.02));
    const R = Rpx * wpp;
    const sx = 1 + b.sq * 0.6;
    const sy = 1 - b.sq;
    const cW = toWorld(L.ballX, b.y + L.ballR * b.sq, tgt).clone();
    spinQ.setFromAxisAngle(
      spinAxis,
      0.7 * Math.min(time, IMPACT) + 0.4 + 0.5 * easeOut(clock(time)),
    );
    const camPos = camera.position;

    for (const c of cards) {
      const it = c.it;
      const dl = clockT(it.arr);
      const k = L.dot ? clamp((time - dl) / FLY, 0, 1) : 0;
      const e = easeInOut(k);
      v.copy(c.dir).applyQuaternion(spinQ);
      const onBall = new THREE.Vector3(cW.x + v.x * R * sx, cW.y + v.y * R * sy, v.z * R * sx);
      toWorld(it.px || L.cx, it.py || L.cy, tgt);
      posV.lerpVectors(onBall, tgt, e);
      posV.z += Math.sin(Math.PI * e) * c.arc * wpp;
      quat.slerpQuaternions(c.outward.clone().premultiply(spinQ), flatQ, e);
      const ballSide = Math.max(Rpx * 0.22, 6) * wpp;
      const cell = L.s * wpp;
      const w0 = ballSide * Math.sqrt(c.a);
      const h0 = ballSide / Math.sqrt(c.a);
      sclV.set(w0 + (cell - w0) * e, h0 + (cell - h0) * e, 1);
      mat4.compose(posV, quat, sclV);

      const batch = batches[c.batchIdx];
      batch.mesh.setMatrixAt(c.instIdx, mat4);
      rectTmp.lerpVectors(c.full, c.sq, e);
      const ro = c.instIdx * 4;
      batch.rectArr[ro] = rectTmp.x;
      batch.rectArr[ro + 1] = rectTmp.y;
      batch.rectArr[ro + 2] = rectTmp.z;
      batch.rectArr[ro + 3] = rectTmp.w;

      const facing = clamp(
        (v.dot(toCamV.subVectors(camPos, onBall).normalize()) + 0.05) / 0.3,
        0,
        1,
      );
      batch.opArr[c.instIdx] = THREE.MathUtils.lerp(facing, 1, clamp(e * 3, 0, 1));
    }

    flushBatches();
    renderer.render(scene, camera);
    drawOverlay(time);

    if (time >= END && !revealed) {
      revealed = true;
      host.classList.add('fade');
      onReveal && onReveal();
    }
    if (time >= END + FADE) finish();
  }

  let stillTick = 0;
  function still() {
    if (!POSTER || !renderer) return;
    if (!L.dot || ++stillTick % 30 === 0) layout();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);

    // Render WebGPU helix right before copying its canvas into the poster backdrop
    if (window.__helix && typeof window.__helix.renderGpuNow === 'function') {
      window.__helix.renderGpuNow();
    }
    const hxGpu = document.querySelector('.hx-gpu') as HTMLCanvasElement | null;
    if (hxGpu && hxGpu.width > 0) {
      const r = hxGpu.getBoundingClientRect();
      ctx.drawImage(hxGpu, r.left, r.top, r.width, r.height);
    }
    const hx = document.querySelector('.hx-canvas') as HTMLCanvasElement | null;
    if (hx && hx.width > 0) {
      const r = hx.getBoundingClientRect();
      ctx.drawImage(hx, r.left, r.top, r.width, r.height);
    }

    const Y0 = POSTER.year + 40;
    const Y1 = Y0 + Math.max(1, POSTER.window);
    const prog = (y: number) => clamp((Y1 - y) / (Y1 - Y0), 0, 1);
    const Rpx = L.ballR;
    const R = Rpx * wpp;
    const cW = toWorld(L.ballX, L.cy, tgt).clone();
    window.__STILL = {
      cx: L.cx,
      cy: L.cy,
      ballR: Rpx,
      loopR: L.R,
      W: L.W,
      H: L.H,
    };
    spinQ.setFromAxisAngle(spinAxis, POSTER.spin);
    const camPos = camera.position;

    for (const c of cards) {
      const it = c.it;
      const batch = batches[c.batchIdx];
      if (L.dot && it.y <= Y0) {
        batch.opArr[c.instIdx] = 0;
        sclV.set(0, 0, 0);
        mat4.compose(posV.set(0, 0, -999), flatQ, sclV);
        batch.mesh.setMatrixAt(c.instIdx, mat4);
        continue;
      }
      const k = L.dot && it.y <= Y1 ? prog(it.y) : 0;
      const e = easeInOut(k);
      v.copy(c.dir).applyQuaternion(spinQ);
      const onBall = new THREE.Vector3(cW.x + v.x * R, cW.y + v.y * R, v.z * R);
      toWorld(it.px || L.cx, it.py || L.cy, tgt);
      posV.lerpVectors(onBall, tgt, e);
      posV.z += Math.sin(Math.PI * e) * c.arc * wpp;
      quat.slerpQuaternions(c.outward.clone().premultiply(spinQ), flatQ, e);
      const ballSide = Math.max(Rpx * 0.22, 6) * wpp;
      const cell = L.s * wpp;
      const w0 = ballSide * Math.sqrt(c.a);
      const h0 = ballSide / Math.sqrt(c.a);
      sclV.set(w0 + (cell - w0) * e, h0 + (cell - h0) * e, 1);
      mat4.compose(posV, quat, sclV);
      batch.mesh.setMatrixAt(c.instIdx, mat4);

      rectTmp.lerpVectors(c.full, c.sq, e);
      const ro = c.instIdx * 4;
      batch.rectArr[ro] = rectTmp.x;
      batch.rectArr[ro + 1] = rectTmp.y;
      batch.rectArr[ro + 2] = rectTmp.z;
      batch.rectArr[ro + 3] = rectTmp.w;

      const facing = clamp(
        (v.dot(toCamV.subVectors(camPos, onBall).normalize()) + 0.05) / 0.3,
        0,
        1,
      );
      batch.opArr[c.instIdx] = THREE.MathUtils.lerp(facing, 1, clamp(e * 3, 0, 1));
    }

    flushBatches();
    renderer.render(scene, camera);

    if (!L.dot) return;
    ctx.globalCompositeOperation = 'lighter';
    const sz0 = L.phone ? 1.4 : 2;
    for (let i = 0; i < D.events.length; i++) {
      const y = D.events[i][0];
      if (y > Y1) continue;
      const tx = L.dot[i * 2];
      if (!Number.isFinite(tx)) continue;
      if (y <= Y0) {
        const sz = sz0 * 0.9;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(grain(evKey[i]), tx - sz, L.dot[i * 2 + 1] - sz, sz * 2, sz * 2);
        continue;
      }
      const kk = prog(y);
      const e = easeOut(kk);
      const ang = i * 2.399;
      const sx = L.ballX + Math.cos(ang) * Rpx * 0.9;
      const sy = L.cy + Math.sin(ang) * Rpx * 0.9;
      const x = sx + (tx - sx) * e;
      const yy =
        sy + (L.dot[i * 2 + 1] - sy) * e - Math.sin(Math.PI * e) * 24 * ((i % 5) / 5);
      const sz = sz0 * (0.6 + 0.4 * kk);
      ctx.globalAlpha = 0.4 + 0.6 * kk;
      ctx.drawImage(grain(evKey[i]), x - sz, yy - sz, sz * 2, sz * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    for (const t of skipEvents) removeEventListener(t, skip, { capture: true } as any);
    clearTimeout(cap);
    try {
      for (const t of sheetTex) t.dispose();
      for (const b of batches) {
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
      }
      if (sheetGeo) sheetGeo.dispose();
      renderer?.dispose();
    } catch {
      /* ignore */
    }
    host.remove();
    if (pre) pre.remove();
    onDone && onDone();
  }

  const cap = setTimeout(() => {
    if (!booted && !done && !POSTER) {
      onReveal && onReveal();
      finish();
    }
  }, 12000);

  boot()
    .then(() => {
      if (!done) frame();
    })
    .catch((e) => {
      console.error(e);
      if (!done) {
        onReveal && onReveal();
        finish();
      }
    });

  return finish;
}
