// WebGPU + Three.js TSL rendering backend for the 3D spiral Histomap.
// Renders the night sky + film grain, root lineages + dotted age rings, 100 decade thread chunks
// with active-loop chromatic fringe, post-2026 ghost thread, additive root-flow pulses & moment halos,
// all 4,823 3D event parallelogram/dot cells + rims, and GPU-cropped historical photo cards + stems + frames.
import * as THREE from 'three/webgpu';
import {
  Fn,
  attribute,
  clamp as tslClamp,
  float,
  length,
  max as tslMax,
  min as tslMin,
  mix as tslMix,
  mod,
  positionGeometry,
  select,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  abs,
  If,
  Discard,
} from 'three/tsl';
import {
  createWebGPURenderer,
  ensureWebGPUTelemetry,
  linearRgb,
  loadGpuTexture,
  textureFromImage,
} from './webgpu';

const NIGHT_HEX = '#060d0e';
const INK_HEX = '#f2efe9';

function srgbVec3ToLinear(c: any) {
  const lo = c.div(12.92);
  const hi = c.add(0.055).div(1.055).pow(vec3(2.4));
  return vec3(select(c.lessThanEqual(0.04045), lo, hi));
}

function hexToSrgbVec3(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}

function makeGrainTexture(): THREE.DataTexture {
  const S = 128;
  const data = new Uint8Array(S * S * 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < data.length; i += 4) {
    const v = rnd() < 0.5 ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = Math.round(rnd() * 8);
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

class LineBatch {
  mesh: THREE.InstancedMesh;
  epArr: Float32Array;
  colArr: Float32Array;
  stArr: Float32Array;
  epAttr: THREE.InstancedBufferAttribute;
  colAttr: THREE.InstancedBufferAttribute;
  stAttr: THREE.InstancedBufferAttribute;
  count = 0;
  readonly max: number;

  constructor(
    max: number,
    uSize: any,
    renderOrder: number,
    additive = false,
  ) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.epArr = new Float32Array(max * 4);
    this.colArr = new Float32Array(max * 4);
    this.stArr = new Float32Array(max * 4);
    this.epAttr = new THREE.InstancedBufferAttribute(this.epArr, 4);
    this.colAttr = new THREE.InstancedBufferAttribute(this.colArr, 4);
    this.stAttr = new THREE.InstancedBufferAttribute(this.stArr, 4);
    this.epAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.stAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aEnd', this.epAttr);
    geo.setAttribute('aCol', this.colAttr);
    geo.setAttribute('aStyle', this.stAttr);

    const aEnd = attribute('aEnd', 'vec4');
    const aCol = attribute('aCol', 'vec4');
    const aStyle = attribute('aStyle', 'vec4'); // x = lineWidth, y = dashPeriod (0 solid), z = startDist, w = dashOn

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    if (additive) mat.blending = THREE.AdditiveBlending;

    mat.positionNode = Fn(() => {
      const p0 = aEnd.xy;
      const p1 = aEnd.zw;
      const delta = p1.sub(p0);
      const segLen = tslMax(length(delta), float(0.001));
      const dir = delta.div(segLen);
      const nrm = vec2(dir.y.negate(), dir.x);
      const halfW = aStyle.x.mul(0.5).add(0.85);
      const along = positionGeometry.x.add(0.5); // 0..1
      const across = positionGeometry.y.mul(2.0); // -1..1
      const ext = aStyle.x.mul(0.5);
      const px = p0
        .sub(dir.mul(ext))
        .add(dir.mul(segLen.add(ext.mul(2.0)).mul(along)))
        .add(nrm.mul(across.mul(halfW)));
      return vec3(px.x, uSize.y.sub(px.y), 0.0);
    })();

    mat.outputNode = Fn(() => {
      const p0 = aEnd.xy;
      const p1 = aEnd.zw;
      const segLen = tslMax(length(p1.sub(p0)), float(0.001));
      const halfW = aStyle.x.mul(0.5).add(0.85);
      const acrossPx = abs(positionGeometry.y.mul(2.0).mul(halfW));
      const aa = float(1.0).sub(
        smoothstep(tslMax(float(0.0), aStyle.x.mul(0.5).sub(0.35)), aStyle.x.mul(0.5).add(0.75), acrossPx),
      );
      const along = positionGeometry.x.add(0.5);
      const ext = aStyle.x.mul(0.5);
      const sPx = along.mul(segLen.add(ext.mul(2.0))).sub(ext);
      const capDist = tslMax(float(0.0), tslMax(sPx.negate(), sPx.sub(segLen)));
      const capAa = float(1.0).sub(
        smoothstep(tslMax(float(0.0), aStyle.x.mul(0.5).sub(0.35)), aStyle.x.mul(0.5).add(0.75), length(vec2(capDist, acrossPx))),
      );
      const mask = select(capDist.greaterThan(0.0), capAa, aa);

      // Optional dash pattern [dashOn, dashPeriod - dashOn]
      const dPeriod = aStyle.y;
      const dOn = aStyle.w;
      const ph = mod(aStyle.z.add(tslClamp(sPx, 0.0, segLen)), tslMax(dPeriod, 1.0));
      const dashMask = select(
        dPeriod.greaterThan(0.5),
        float(1.0).sub(smoothstep(dOn, dOn.add(0.8), ph)),
        float(1.0),
      );
      const alpha = aCol.w.mul(mask).mul(dashMask);
      If(alpha.lessThan(0.004), () => {
        Discard();
      });
      return vec4(aCol.xyz, alpha);
    })();

    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  reset() {
    this.count = 0;
  }

  push(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    hexCol: string,
    alpha: number,
    width: number,
    dashPeriod = 0,
    startDist = 0,
    dashOn = 2,
  ) {
    if (this.count >= this.max || alpha <= 0.003) return;
    if (Math.abs(x1 - x0) < 0.05 && Math.abs(y1 - y0) < 0.05 && width < 2) return;
    const i = this.count++;
    const e4 = i * 4;
    this.epArr[e4] = x0;
    this.epArr[e4 + 1] = y0;
    this.epArr[e4 + 2] = x1;
    this.epArr[e4 + 3] = y1;
    const rgb = linearRgb(hexCol);
    this.colArr[e4] = rgb[0];
    this.colArr[e4 + 1] = rgb[1];
    this.colArr[e4 + 2] = rgb[2];
    this.colArr[e4 + 3] = Math.min(1, alpha);
    this.stArr[e4] = Math.max(0.65, width);
    this.stArr[e4 + 1] = dashPeriod;
    this.stArr[e4 + 2] = startDist;
    this.stArr[e4 + 3] = dashOn;
  }

  flush() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count > 0) {
      this.epAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
      this.stAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

class GlowBatch {
  mesh: THREE.InstancedMesh;
  posArr: Float32Array;
  colArr: Float32Array;
  posAttr: THREE.InstancedBufferAttribute;
  colAttr: THREE.InstancedBufferAttribute;
  count = 0;
  readonly max: number;

  constructor(
    max: number,
    uSize: any,
    renderOrder: number,
  ) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.posArr = new Float32Array(max * 4); // cx, cy, innerR, outerR
    this.colArr = new Float32Array(max * 4); // rLin, gLin, bLin, alpha
    this.posAttr = new THREE.InstancedBufferAttribute(this.posArr, 4);
    this.colAttr = new THREE.InstancedBufferAttribute(this.colArr, 4);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGlowPos', this.posAttr);
    geo.setAttribute('aGlowCol', this.colAttr);

    const aGlowPos = attribute('aGlowPos', 'vec4');
    const aGlowCol = attribute('aGlowCol', 'vec4');

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    mat.blending = THREE.AdditiveBlending;

    mat.positionNode = Fn(() => {
      const outerR = aGlowPos.w;
      const offset = positionGeometry.xy.mul(outerR.mul(2.0));
      const sx = aGlowPos.x.add(offset.x);
      const sy = aGlowPos.y.add(offset.y);
      return vec3(sx, uSize.y.sub(sy), 0.0);
    })();

    mat.outputNode = Fn(() => {
      const rNorm = length(positionGeometry.xy.mul(2.0));
      If(rNorm.greaterThan(1.0), () => {
        Discard();
      });
      const innerFrac = tslClamp(aGlowPos.z.div(tslMax(aGlowPos.w, 0.001)), 0.0, 0.95);
      const t = tslClamp(rNorm.sub(innerFrac).div(float(1.0).sub(innerFrac)), 0.0, 1.0);
      const falloff = float(1.0).sub(t);
      const alpha = aGlowCol.w.mul(falloff.mul(falloff));
      If(alpha.lessThan(0.003), () => {
        Discard();
      });
      return vec4(aGlowCol.xyz, alpha);
    })();

    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  reset() {
    this.count = 0;
  }

  push(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    hexCol: string,
    alpha: number,
  ) {
    if (this.count >= this.max || outerR < 1.5 || alpha <= 0.003) return;
    const i = this.count++;
    const p4 = i * 4;
    this.posArr[p4] = cx;
    this.posArr[p4 + 1] = cy;
    this.posArr[p4 + 2] = innerR;
    this.posArr[p4 + 3] = outerR;
    const rgb = linearRgb(hexCol);
    this.colArr[p4] = rgb[0];
    this.colArr[p4 + 1] = rgb[1];
    this.colArr[p4 + 2] = rgb[2];
    this.colArr[p4 + 3] = alpha;
  }

  flush() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count > 0) {
      this.posAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

class CellBatch {
  mesh: THREE.InstancedMesh;
  cenArr: Float32Array;
  axArr: Float32Array;
  colArr: Float32Array;
  metaArr: Float32Array;
  cenAttr: THREE.InstancedBufferAttribute;
  axAttr: THREE.InstancedBufferAttribute;
  colAttr: THREE.InstancedBufferAttribute;
  metaAttr: THREE.InstancedBufferAttribute;
  count = 0;
  readonly max: number;

  constructor(
    max: number,
    uSize: any,
    renderOrder: number,
  ) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.cenArr = new Float32Array(max * 2);
    this.axArr = new Float32Array(max * 4);
    this.colArr = new Float32Array(max * 4);
    this.metaArr = new Float32Array(max * 3); // lu, lv, rimAlpha
    this.cenAttr = new THREE.InstancedBufferAttribute(this.cenArr, 2);
    this.axAttr = new THREE.InstancedBufferAttribute(this.axArr, 4);
    this.colAttr = new THREE.InstancedBufferAttribute(this.colArr, 4);
    this.metaAttr = new THREE.InstancedBufferAttribute(this.metaArr, 3);
    this.cenAttr.setUsage(THREE.DynamicDrawUsage);
    this.axAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.metaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCenter', this.cenAttr);
    geo.setAttribute('aAxis', this.axAttr);
    geo.setAttribute('aCellCol', this.colAttr);
    geo.setAttribute('aCellMeta', this.metaAttr);

    const aCenter = attribute('aCenter', 'vec2');
    const aAxis = attribute('aAxis', 'vec4');
    const aCellCol = attribute('aCellCol', 'vec4');
    const aCellMeta = attribute('aCellMeta', 'vec3');
    const inkLin = linearRgb(INK_HEX);
    const inkNode = vec3(inkLin[0], inkLin[1], inkLin[2]);

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;

    // Expand local quad slightly (1.15x) so rim + AA feather fit cleanly inside
    mat.positionNode = Fn(() => {
      const s = positionGeometry.xy.mul(2.3); // [-1.15, 1.15]
      const uV = aAxis.xy;
      const vV = aAxis.zw;
      const px = aCenter.add(uV.mul(s.x)).add(vV.mul(s.y));
      return vec3(px.x, uSize.y.sub(px.y), 0.0);
    })();

    mat.outputNode = Fn(() => {
      const s = abs(positionGeometry.xy.mul(2.3)); // [0, 1.15]
      const isDot = aCellMeta.x.lessThan(0.01);

      // Dot mode (sub-floor square mark): crisp filled square over s <= 1.0
      const dotAlpha = float(1.0)
        .sub(smoothstep(0.92, 1.08, tslMax(s.x, s.y)))
        .mul(aCellCol.w);

      // Parallelogram mode: lu = aCellMeta.x, lv = aCellMeta.y (full outer lengths in px)
      const luHalf = tslMax(aCellMeta.x.mul(0.5), 0.5);
      const lvHalf = tslMax(aCellMeta.y.mul(0.5), 0.5);
      // Signed distance inward from outer edge (0 on outer boundary, positive inside)
      const du = float(1.0).sub(s.x).mul(luHalf);
      const dv = float(1.0).sub(s.y).mul(lvHalf);
      const dEdge = tslMin(du, dv);

      // Fill is inset by 0.5px on each side (total 1px ground gap between neighbor tiles)
      const inset = tslMin(float(0.5), tslMin(luHalf, lvHalf).mul(0.38));
      const fillMask = smoothstep(inset.sub(0.45), inset.add(0.45), dEdge);
      const fillA = aCellCol.w.mul(fillMask);

      // Optional INK rim on outer boundary for unit-in-hand tiles >= 9px
      const rimMask = float(1.0)
        .sub(smoothstep(0.15, 0.75, abs(dEdge)))
        .mul(aCellMeta.z);

      const totalA = select(isDot, dotAlpha, tslClamp(fillA.add(rimMask), 0.0, 1.0));
      If(totalA.lessThan(0.004), () => {
        Discard();
      });
      const rgb = select(
        isDot,
        aCellCol.xyz,
        tslMix(aCellCol.xyz, inkNode, tslClamp(rimMask.div(tslMax(totalA, 0.001)), 0.0, 1.0)),
      );
      return vec4(rgb, totalA);
    })();

    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  reset() {
    this.count = 0;
  }

  pushCell(
    cx: number,
    cy: number,
    q0: number,
    q1: number,
    q2: number,
    q3: number,
    q6: number,
    q7: number,
    scale: number,
    hexCol: string,
    alpha: number,
    floor: number,
    rimAlpha: number,
  ) {
    if (this.count >= this.max || alpha <= 0.003) return;
    let ux = q2 - q0;
    let uy = q3 - q1;
    let vx = q6 - q0;
    let vy = q7 - q1;
    const lu = Math.hypot(ux, uy) * scale;
    const lv = Math.hypot(vx, vy) * scale;

    const i = this.count++;
    const i2 = i * 2;
    const i3 = i * 3;
    const i4 = i * 4;
    this.cenArr[i2] = cx;
    this.cenArr[i2 + 1] = cy;

    const rgb = linearRgb(hexCol);
    this.colArr[i4] = rgb[0];
    this.colArr[i4 + 1] = rgb[1];
    this.colArr[i4 + 2] = rgb[2];
    this.colArr[i4 + 3] = Math.min(1, alpha);

    if (lu < floor || lv < floor) {
      const h = floor * 0.5;
      this.axArr[i4] = h;
      this.axArr[i4 + 1] = 0;
      this.axArr[i4 + 2] = 0;
      this.axArr[i4 + 3] = h;
      this.metaArr[i3] = 0;
      this.metaArr[i3 + 1] = 0;
      this.metaArr[i3 + 2] = 0;
    } else {
      const halfScale = scale * 0.5;
      this.axArr[i4] = ux * halfScale;
      this.axArr[i4 + 1] = uy * halfScale;
      this.axArr[i4 + 2] = vx * halfScale;
      this.axArr[i4 + 3] = vy * halfScale;
      this.metaArr[i3] = lu;
      this.metaArr[i3 + 1] = lv;
      this.metaArr[i3 + 2] = rimAlpha;
    }
  }

  flush() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count > 0) {
      this.cenAttr.needsUpdate = true;
      this.axAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
      this.metaAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

class CardDecorBatch {
  shadowMesh: THREE.InstancedMesh;
  shArr: Float32Array; // cx, cy, w, h
  shMetaArr: Float32Array; // alpha, blur, offsetY, frameAlpha
  shAttr: THREE.InstancedBufferAttribute;
  shMetaAttr: THREE.InstancedBufferAttribute;
  frameMesh: THREE.InstancedMesh;
  count = 0;
  readonly max: number;

  constructor(
    max: number,
    uSize: any,
    shadowOrder: number,
    frameOrder: number,
  ) {
    this.max = max;
    this.shArr = new Float32Array(max * 4);
    this.shMetaArr = new Float32Array(max * 4);
    this.shAttr = new THREE.InstancedBufferAttribute(this.shArr, 4);
    this.shMetaAttr = new THREE.InstancedBufferAttribute(this.shMetaArr, 4);
    this.shAttr.setUsage(THREE.DynamicDrawUsage);
    this.shMetaAttr.setUsage(THREE.DynamicDrawUsage);

    const nightLin = linearRgb(NIGHT_HEX);
    const nightNode = vec3(nightLin[0], nightLin[1], nightLin[2]);
    const inkLin = linearRgb(INK_HEX);
    const inkNode = vec3(inkLin[0], inkLin[1], inkLin[2]);

    // Shadow + dark backing card
    const shGeo = new THREE.PlaneGeometry(1, 1);
    shGeo.setAttribute('aCardBox', this.shAttr);
    shGeo.setAttribute('aCardMeta', this.shMetaAttr);
    const aBox = attribute('aCardBox', 'vec4');
    const aMeta = attribute('aCardMeta', 'vec4');

    const shMat = new THREE.MeshBasicNodeMaterial();
    shMat.transparent = true;
    shMat.depthTest = false;
    shMat.depthWrite = false;
    shMat.side = THREE.DoubleSide;
    shMat.positionNode = Fn(() => {
      const pad = aMeta.y.mul(1.6).add(4.0);
      const sx = aBox.x.add(positionGeometry.x.mul(aBox.z.add(pad.mul(2.0))));
      const sy = aBox.y
        .add(aMeta.z.mul(0.5))
        .add(positionGeometry.y.mul(aBox.w.add(pad.mul(2.0)).add(aMeta.z)));
      return vec3(sx, uSize.y.sub(sy), 0.0);
    })();
    shMat.outputNode = Fn(() => {
      const pad = aMeta.y.mul(1.6).add(4.0);
      const totW = aBox.z.add(pad.mul(2.0));
      const totH = aBox.w.add(pad.mul(2.0)).add(aMeta.z);
      const localPx = vec2(
        positionGeometry.x.mul(totW),
        positionGeometry.y.mul(totH).add(aMeta.z.mul(0.5)),
      );
      // Backing rect (NIGHT, w+3 x h+3 centered at (0,0))
      const backHalf = vec2(aBox.z.mul(0.5).add(1.5), aBox.w.mul(0.5).add(1.5));
      const dBack = length(tslMax(abs(localPx).sub(backHalf), vec2(0.0, 0.0)));
      const backA = float(1.0).sub(smoothstep(0.0, 1.0, dBack)).mul(aMeta.x);

      // Drop shadow (centered at (0, offsetY))
      const shLocal = vec2(localPx.x, localPx.y.sub(aMeta.z));
      const dSh = length(tslMax(abs(shLocal).sub(backHalf), vec2(0.0, 0.0)));
      const shFall = float(1.0).sub(smoothstep(0.0, tslMax(aMeta.y.mul(1.4), 2.0), dSh));
      const shA = shFall.mul(shFall).mul(0.72).mul(aMeta.x);

      const alpha = tslMax(backA, shA);
      If(alpha.lessThan(0.004), () => {
        Discard();
      });
      return vec4(nightNode.mul(0.6), alpha);
    })();
    this.shadowMesh = new THREE.InstancedMesh(shGeo, shMat, max);
    this.shadowMesh.count = 0;
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.renderOrder = shadowOrder;

    // Crisp 1px INK border frame over the photo
    const frGeo = new THREE.PlaneGeometry(1, 1);
    frGeo.setAttribute('aCardBox', this.shAttr);
    frGeo.setAttribute('aCardMeta', this.shMetaAttr);
    const frMat = new THREE.MeshBasicNodeMaterial();
    frMat.transparent = true;
    frMat.depthTest = false;
    frMat.depthWrite = false;
    frMat.side = THREE.DoubleSide;
    frMat.positionNode = Fn(() => {
      const sx = aBox.x.add(positionGeometry.x.mul(aBox.z.add(2.0)));
      const sy = aBox.y.add(positionGeometry.y.mul(aBox.w.add(2.0)));
      return vec3(sx, uSize.y.sub(sy), 0.0);
    })();
    frMat.outputNode = Fn(() => {
      const px = abs(vec2(positionGeometry.x.mul(aBox.z.add(2.0)), positionGeometry.y.mul(aBox.w.add(2.0))));
      const half = vec2(aBox.z.mul(0.5), aBox.w.mul(0.5));
      const distEdge = tslMin(half.x.sub(px.x), half.y.sub(px.y));
      const inside = stepRect(px, half.add(vec2(0.6, 0.6)));
      const border = float(1.0).sub(smoothstep(0.0, 1.05, abs(distEdge.sub(0.5)))).mul(inside);
      const alpha = border.mul(aMeta.w);
      If(alpha.lessThan(0.004), () => {
        Discard();
      });
      return vec4(inkNode, alpha);
    })();
    this.frameMesh = new THREE.InstancedMesh(frGeo, frMat, max);
    this.frameMesh.count = 0;
    this.frameMesh.frustumCulled = false;
    this.frameMesh.renderOrder = frameOrder;
  }

  reset() {
    this.count = 0;
  }

  push(
    cx: number,
    cy: number,
    w: number,
    h: number,
    alpha: number,
    blur: number,
    offsetY: number,
    frameAlpha: number,
  ) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i4 = i * 4;
    this.shArr[i4] = cx;
    this.shArr[i4 + 1] = cy;
    this.shArr[i4 + 2] = w;
    this.shArr[i4 + 3] = h;
    this.shMetaArr[i4] = alpha;
    this.shMetaArr[i4 + 1] = blur;
    this.shMetaArr[i4 + 2] = offsetY;
    this.shMetaArr[i4 + 3] = frameAlpha;
  }

  flush() {
    const c = this.count;
    this.shadowMesh.count = c;
    this.frameMesh.count = c;
    this.shadowMesh.visible = c > 0;
    this.frameMesh.visible = c > 0;
    if (c > 0) {
      this.shAttr.needsUpdate = true;
      this.shMetaAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
  }
}

function stepRect(p: any, half: any) {
  return float(1.0)
    .sub(smoothstep(half.x.sub(0.5), half.x.add(0.5), p.x))
    .mul(float(1.0).sub(smoothstep(half.y.sub(0.5), half.y.add(0.5), p.y)));
}

interface TexQuadSlot {
  mesh: THREE.InstancedMesh;
  boxArr: Float32Array;
  rectArr: Float32Array;
  opArr: Float32Array;
  boxAttr: THREE.InstancedBufferAttribute;
  rectAttr: THREE.InstancedBufferAttribute;
  opAttr: THREE.InstancedBufferAttribute;
  count: number;
  max: number;
}

class PicLayer {
  readonly stems: LineBatch;
  readonly dots: GlowBatch;
  readonly halos: GlowBatch;
  readonly decor: CardDecorBatch;
  readonly slots = new Map<number, TexQuadSlot>();
  private scene: THREE.Scene;
  private uSize: any;
  private picOrder: number;

  constructor(
    scene: THREE.Scene,
    uSize: any,
    baseOrder: number,
    maxPics: number,
  ) {
    this.scene = scene;
    this.uSize = uSize;
    this.picOrder = baseOrder + 3;
    this.halos = new GlowBatch(64, uSize, baseOrder);
    this.stems = new LineBatch(maxPics, uSize, baseOrder + 1, false);
    this.dots = new GlowBatch(maxPics, uSize, baseOrder + 1);
    this.decor = new CardDecorBatch(maxPics, uSize, baseOrder + 2, baseOrder + 4);
    scene.add(this.halos.mesh);
    scene.add(this.stems.mesh);
    scene.add(this.dots.mesh);
    scene.add(this.decor.shadowMesh);
    scene.add(this.decor.frameMesh);
  }

  ensureTexSlot(texId: number, tex: THREE.Texture, max = 512): TexQuadSlot {
    const existing = this.slots.get(texId);
    if (existing) return existing;

    const geo = new THREE.PlaneGeometry(1, 1);
    const boxArr = new Float32Array(max * 4);
    const rectArr = new Float32Array(max * 4);
    const opArr = new Float32Array(max);
    const boxAttr = new THREE.InstancedBufferAttribute(boxArr, 4);
    const rectAttr = new THREE.InstancedBufferAttribute(rectArr, 4);
    const opAttr = new THREE.InstancedBufferAttribute(opArr, 1);
    boxAttr.setUsage(THREE.DynamicDrawUsage);
    rectAttr.setUsage(THREE.DynamicDrawUsage);
    opAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPicBox', boxAttr);
    geo.setAttribute('aPicRect', rectAttr);
    geo.setAttribute('aPicOp', opAttr);

    const aPicBox = attribute('aPicBox', 'vec4');
    const aPicRect = attribute('aPicRect', 'vec4');
    const aPicOp = attribute('aPicOp', 'float');

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    mat.positionNode = Fn(() => {
      const sx = aPicBox.x.add(positionGeometry.x.mul(aPicBox.z));
      const sy = aPicBox.y.sub(positionGeometry.y.mul(aPicBox.w));
      return vec3(sx, this.uSize.y.sub(sy), 0.0);
    })();
    mat.outputNode = Fn(() => {
      If(aPicOp.lessThan(0.004), () => {
        Discard();
      });
      const sampleUv = aPicRect.xy.add(uv().mul(aPicRect.zw));
      const c = texture(tex, sampleUv);
      return vec4(c.rgb, c.a.mul(aPicOp));
    })();

    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = this.picOrder;
    this.scene.add(mesh);

    const slot: TexQuadSlot = {
      mesh,
      boxArr,
      rectArr,
      opArr,
      boxAttr,
      rectAttr,
      opAttr,
      count: 0,
      max,
    };
    this.slots.set(texId, slot);
    return slot;
  }

  reset() {
    this.halos.reset();
    this.stems.reset();
    this.dots.reset();
    this.decor.reset();
    for (const s of this.slots.values()) s.count = 0;
  }

  pushPic(
    texId: number,
    tex: THREE.Texture,
    cx: number,
    cy: number,
    w: number,
    h: number,
    u0: number,
    v0: number,
    uw: number,
    vh: number,
    alpha: number,
    lift: number,
    momentHaloHex: string | null,
    stemCell: [number, number] | null,
  ) {
    if (alpha <= 0.004) return;
    if (momentHaloHex) {
      const r = Math.max(w, h) * 0.5;
      if (r * 3 >= 2) {
        this.halos.push(cx, cy, Math.max(0.5, r * 0.5), r * 3, momentHaloHex, alpha * 0.26);
      }
    }
    if (stemCell) {
      const [scx, scy] = stemCell;
      const dx = scx - cx;
      const dy = scy - cy;
      if (Math.abs(dx) >= w * 0.5 || Math.abs(dy) >= h * 0.5) {
        const t = Math.min(
          dx ? (w * 0.5) / Math.abs(dx) : 1e9,
          dy ? (h * 0.5) / Math.abs(dy) : 1e9,
        );
        const ex = cx + dx * t;
        const ey = cy + dy * t;
        const sa = alpha * 0.45;
        this.stems.push(ex, ey, scx, scy, INK_HEX, sa, 1.0);
        this.dots.push(scx, scy, 1.2, 2.4, INK_HEX, sa);
      }
    }
    if (w >= 20) {
      this.decor.push(
        cx,
        cy,
        w,
        h,
        alpha,
        lift > 0.5 ? 14 : 8,
        lift > 0.5 ? 5 : 3,
        alpha * (lift > 0.5 ? 0.85 : 0.55),
      );
    }
    const slot = this.ensureTexSlot(texId, tex);
    if (slot.count >= slot.max) return;
    const i = slot.count++;
    const i4 = i * 4;
    slot.boxArr[i4] = cx;
    slot.boxArr[i4 + 1] = cy;
    slot.boxArr[i4 + 2] = w;
    slot.boxArr[i4 + 3] = h;
    slot.rectArr[i4] = u0;
    slot.rectArr[i4 + 1] = v0;
    slot.rectArr[i4 + 2] = uw;
    slot.rectArr[i4 + 3] = vh;
    slot.opArr[i] = Math.min(1, alpha);
  }

  flush() {
    this.halos.flush();
    this.stems.flush();
    this.dots.flush();
    this.decor.flush();
    for (const s of this.slots.values()) {
      s.mesh.count = s.count;
      s.mesh.visible = s.count > 0;
      if (s.count > 0) {
        s.boxAttr.needsUpdate = true;
        s.rectAttr.needsUpdate = true;
        s.opAttr.needsUpdate = true;
      }
    }
  }

  dispose() {
    this.halos.dispose();
    this.stems.dispose();
    this.dots.dispose();
    this.decor.dispose();
    for (const s of this.slots.values()) {
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    this.slots.clear();
  }
}

export class HelixGpuRenderer {
  readonly canvas: HTMLCanvasElement;
  renderer: THREE.WebGPURenderer | null = null;
  ready = false;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  readonly uSize = uniform(new THREE.Vector2(1, 1));

  private groundMesh: THREE.Mesh;
  private grainTex: THREE.DataTexture;
  readonly lines: LineBatch;
  readonly rootPics: PicLayer;
  readonly farCellHalos: GlowBatch;
  readonly farCells: CellBatch;
  readonly farPics: PicLayer;
  readonly frontLines: LineBatch;
  readonly cellHalos: GlowBatch;
  readonly cells: CellBatch;
  readonly earlyPics: PicLayer;
  readonly latePics: PicLayer;
  readonly topLines: LineBatch;
  readonly flowLines: LineBatch;
  readonly flowGlows: GlowBatch;

  private texCache = new Map<string, { id: number; tex: THREE.Texture }>();
  private imgCache = new Map<HTMLImageElement, { id: number; tex: THREE.Texture }>();
  private nextTexId = 1;
  private W = 1;
  private H = 1;
  private DPR = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera.position.set(0, 0, 5);

    // Pass 0: Deep Mineral Obsidian-Pine sky + Celadon astrolabe radial glow + 128x128 LCG grain
    this.grainTex = makeGrainTexture();
    const g0 = hexToSrgbVec3('#050b0c');
    const g1 = hexToSrgbVec3('#091517');
    const g2 = hexToSrgbVec3('#0f2224');
    const gAura = hexToSrgbVec3('#1c4a48');
    const groundGeo = new THREE.PlaneGeometry(1, 1);
    const groundMat = new THREE.MeshBasicNodeMaterial();
    groundMat.depthTest = false;
    groundMat.depthWrite = false;
    groundMat.side = THREE.DoubleSide;
    groundMat.positionNode = Fn(() => {
      const sx = positionGeometry.x.add(0.5).mul(this.uSize.x);
      const sy = positionGeometry.y.add(0.5).mul(this.uSize.y);
      return vec3(sx, sy, 0.0);
    })();
    groundMat.outputNode = Fn(() => {
      // Screen coordinates with top-left origin: sx in [0, W], sy in [0, H]
      const sx = uv().x.mul(this.uSize.x);
      const sy = float(1.0).sub(uv().y).mul(this.uSize.y);
      const gx = this.uSize.x.mul(0.32);
      const gy = this.uSize.y;
      const denom = tslMax(gx.mul(gx).add(gy.mul(gy)), 1.0);
      const t = tslClamp(sx.mul(gx).add(sy.mul(gy)).div(denom), 0.0, 1.0);
      const cA = vec3(g0.x, g0.y, g0.z);
      const cB = vec3(g1.x, g1.y, g1.z);
      const cC = vec3(g2.x, g2.y, g2.z);
      const baseSky = select(
        t.lessThan(0.55),
        tslMix(cA, cB, t.div(0.55)),
        tslMix(cB, cC, t.sub(0.55).div(0.45)),
      );
      // Subtle mineral-celadon zenith aura behind the right-hand spiral stage
      const dx = uv().x.sub(0.68).mul(1.25);
      const dy = float(1.0).sub(uv().y).sub(0.50);
      const rad = smoothstep(0.72, 0.0, length(vec2(dx, dy))).mul(0.32);
      const skySrgb = tslMix(baseSky, vec3(gAura.x, gAura.y, gAura.z), rad);
      const gr = texture(this.grainTex, vec2(sx.div(128.0), sy.div(128.0)));
      const compositedSrgb = tslMix(skySrgb, gr.rgb, gr.a);
      return vec4(srgbVec3ToLinear(compositedSrgb), 1.0);
    })();
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.frustumCulled = false;
    this.groundMesh.renderOrder = 0;
    this.scene.add(this.groundMesh);

    // Ordered GPU batches matching upstream paintScene painter's order:
    // 10: back lines (roots, dotted age rings, far threads)
    // 12..16: rootPics
    // 17: far cell halos, 18: far cells, 19..23: far early pictures
    // 25: frontLines (active loop chromatic-fringe threads)
    // 27: near cell halos, 28: near cells, 29..33: near early pictures
    // 35..39: latePics (unit-in-hand lifted pictures)
    // 41: topLines (decade ticks, 2026..2076 ghost dashed thread & ticks, leaders)
    // 44..45: additive root flow pulses
    this.lines = new LineBatch(7000, this.uSize, 10, false);
    this.scene.add(this.lines.mesh);

    this.rootPics = new PicLayer(this.scene, this.uSize, 12, 128);

    this.farCellHalos = new GlowBatch(128, this.uSize, 17);
    this.scene.add(this.farCellHalos.mesh);

    this.farCells = new CellBatch(5500, this.uSize, 18);
    this.scene.add(this.farCells.mesh);

    this.farPics = new PicLayer(this.scene, this.uSize, 19, 1200);

    this.frontLines = new LineBatch(2000, this.uSize, 25, false);
    this.scene.add(this.frontLines.mesh);

    this.cellHalos = new GlowBatch(128, this.uSize, 27);
    this.scene.add(this.cellHalos.mesh);

    this.cells = new CellBatch(2500, this.uSize, 28);
    this.scene.add(this.cells.mesh);

    this.earlyPics = new PicLayer(this.scene, this.uSize, 29, 256);
    this.latePics = new PicLayer(this.scene, this.uSize, 35, 160);

    this.topLines = new LineBatch(1024, this.uSize, 41, false);
    this.scene.add(this.topLines.mesh);

    this.flowLines = new LineBatch(600, this.uSize, 44, true);
    this.flowGlows = new GlowBatch(32, this.uSize, 45);
    this.scene.add(this.flowLines.mesh);
    this.scene.add(this.flowGlows.mesh);
  }

  async init(onReady?: () => void) {
    const r = await createWebGPURenderer(this.canvas, {
      alpha: false,
      antialias: true,
      clearColor: 0x060d0e,
      clearAlpha: 1,
      label: 'helix',
    });
    if (this.disposed) {
      r.dispose();
      return;
    }
    this.renderer = r;
    this.ready = true;
    this.applySize();
    onReady?.();
  }

  textureForImage(img: HTMLImageElement): { id: number; tex: THREE.Texture } {
    const hit = this.imgCache.get(img);
    if (hit) return hit;
    const entry = { id: this.nextTexId++, tex: textureFromImage(img) };
    this.imgCache.set(img, entry);
    return entry;
  }

  async loadTexture(key: string, url: string, preBlob?: Promise<Blob> | null) {
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const preRes = preBlob
      ? preBlob.then((b) => new Response(b)).catch(() => null as any)
      : null;
    const tex = await loadGpuTexture(url, preRes);
    if (this.disposed) {
      tex.dispose();
      return null;
    }
    const entry = { id: this.nextTexId++, tex };
    this.texCache.set(key, entry);
    return entry;
  }

  getTexture(key: string) {
    return this.texCache.get(key) || null;
  }

  setSize(W: number, H: number, DPR: number) {
    this.W = Math.max(1, W);
    this.H = Math.max(1, H);
    this.DPR = DPR;
    this.applySize();
  }

  private applySize() {
    const { W, H, DPR } = this;
    this.uSize.value.set(W, H);
    this.camera.left = 0;
    this.camera.right = W;
    this.camera.top = H;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    if (this.renderer) {
      this.renderer.setPixelRatio(DPR);
      this.renderer.setSize(W, H, false);
    } else {
      this.canvas.width = Math.round(W * DPR);
      this.canvas.height = Math.round(H * DPR);
    }
  }

  beginScene() {
    this.lines.reset();
    this.rootPics.reset();
    this.farCellHalos.reset();
    this.farCells.reset();
    this.farPics.reset();
    this.frontLines.reset();
    this.cellHalos.reset();
    this.cells.reset();
    this.earlyPics.reset();
    this.latePics.reset();
    this.topLines.reset();
  }

  beginFlow() {
    this.flowLines.reset();
    this.flowGlows.reset();
  }

  private countPicLayer(layer: PicLayer): { pics: number; lines: number; halos: number } {
    let pics = 0;
    for (const s of layer.slots.values()) pics += s.count;
    return {
      pics,
      lines: layer.stems.count,
      halos: layer.halos.count + layer.dots.count,
    };
  }

  render() {
    if (!this.ready || !this.renderer || this.disposed) return;
    this.lines.flush();
    this.rootPics.flush();
    this.farCellHalos.flush();
    this.farCells.flush();
    this.farPics.flush();
    this.frontLines.flush();
    this.cellHalos.flush();
    this.cells.flush();
    this.earlyPics.flush();
    this.latePics.flush();
    this.topLines.flush();
    this.flowLines.flush();
    this.flowGlows.flush();
    this.renderer.render(this.scene, this.camera);

    const rp = this.countPicLayer(this.rootPics);
    const fp = this.countPicLayer(this.farPics);
    const ep = this.countPicLayer(this.earlyPics);
    const lp = this.countPicLayer(this.latePics);
    const tel = ensureWebGPUTelemetry();
    tel.frameCount++;
    tel.cellInstances = this.farCells.count + this.cells.count;
    tel.lineInstances =
      this.lines.count +
      this.frontLines.count +
      this.topLines.count +
      this.flowLines.count +
      rp.lines +
      fp.lines +
      ep.lines +
      lp.lines;
    tel.picInstances = rp.pics + fp.pics + ep.pics + lp.pics;
    tel.haloInstances =
      this.farCellHalos.count +
      this.cellHalos.count +
      this.flowGlows.count +
      rp.halos +
      fp.halos +
      ep.halos +
      lp.halos;
  }

  dispose() {
    this.disposed = true;
    this.ready = false;
    this.groundMesh.geometry.dispose();
    (this.groundMesh.material as THREE.Material).dispose();
    this.grainTex.dispose();
    this.lines.dispose();
    this.rootPics.dispose();
    this.farCellHalos.dispose();
    this.farCells.dispose();
    this.farPics.dispose();
    this.frontLines.dispose();
    this.cellHalos.dispose();
    this.cells.dispose();
    this.earlyPics.dispose();
    this.latePics.dispose();
    this.topLines.dispose();
    this.flowLines.dispose();
    this.flowGlows.dispose();
    for (const { tex } of this.texCache.values()) tex.dispose();
    for (const { tex } of this.imgCache.values()) tex.dispose();
    this.texCache.clear();
    this.imgCache.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
