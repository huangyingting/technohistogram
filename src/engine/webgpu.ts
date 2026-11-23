import * as THREE from 'three/webgpu';
import type { WebGPUTelemetry } from '../lib/global';

export type { WebGPUTelemetry };

const srgbToLinearCache = new Map<string, [number, number, number]>();
const scratchColor = new THREE.Color();

/**
 * Converts a CSS hex/rgb color string into linear-sRGB [r, g, b] floats (0..1)
 * so that Three.js WebGPURenderer's linear-to-sRGB output transform reproduces
 * the exact CSS sRGB hex color on screen.
 */
export function linearRgb(cssHex: string): [number, number, number] {
  const hit = srgbToLinearCache.get(cssHex);
  if (hit) return hit;
  scratchColor.set(cssHex);
  const rgb: [number, number, number] = [scratchColor.r, scratchColor.g, scratchColor.b];
  srgbToLinearCache.set(cssHex, rgb);
  return rgb;
}

export interface CreateWebGPUOptions {
  alpha?: boolean;
  antialias?: boolean;
  clearColor?: number;
  clearAlpha?: number;
  label?: 'arrival' | 'helix';
}

function createFallbackTexture(): THREE.DataTexture {
  const data = new Uint8Array([0, 0, 0, 0]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function ensureWebGPUTelemetry(): WebGPUTelemetry {
  if (typeof window === 'undefined') {
    return {
      ready: false,
      active: false,
      backend: 'initializing',
      isWebGPUBackend: false,
      hasNavigatorGpu: false,
      frameCount: 0,
      cellInstances: 0,
      lineInstances: 0,
      picInstances: 0,
      haloInstances: 0,
    };
  }
  if (!window.__webgpu) {
    window.__webgpu = {
      ready: false,
      active: false,
      backend: 'initializing',
      isWebGPUBackend: false,
      hasNavigatorGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
      frameCount: 0,
      cellInstances: 0,
      lineInstances: 0,
      picInstances: 0,
      haloInstances: 0,
    };
  }
  return window.__webgpu;
}

/**
 * Acquires and validates a shared WebGPU device (including a 2x2 compositor
 * swapchain smoke check) before touching any application `<canvas>`, so:
 *  1. `arrival` and `helix` share one `GPUDevice` (`arrival.dispose()` will not
 *     destroy `helix`'s device because `parameters.device` is explicitly provided).
 *  2. Environments without working WebGPU swapchain backing cleanly fall back to
 *     Three.js `WebGPURenderer`'s WebGL2 backend without poisoning the canvas.
 */
let sharedGpu: GPU | null = null;
let sharedAdapter: GPUAdapter | null = null;
let sharedDevice: GPUDevice | null = null;
let sharedIsSoftware = false;
let webgpuDevicePromise: Promise<GPUDevice | null> | null = null;

function acquireSharedWebGPUDevice(): Promise<GPUDevice | null> {
  if (sharedDevice) return Promise.resolve(sharedDevice);
  if (webgpuDevicePromise) return webgpuDevicePromise;
  webgpuDevicePromise = (async () => {
    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
      return null;
    }
    let probeCanvas: HTMLCanvasElement | null = null;
    try {
      const gpu = navigator.gpu;
      const adapter =
        (await gpu.requestAdapter({ powerPreference: 'high-performance' })) ||
        (await gpu.requestAdapter()) ||
        (await gpu.requestAdapter({ fallbackAdapter: true } as any));
      if (!adapter) return null;
      // Retain strong references to GPU + GPUAdapter so V8 GC never drops Dawn's wgpu::Instance wire reference
      sharedGpu = gpu;
      sharedAdapter = adapter;
      const info = (adapter as any).info;
      const arch = String(info?.architecture || info?.description || '').toLowerCase();
      sharedIsSoftware =
        Boolean((adapter as any).isFallbackAdapter) ||
        arch.includes('swiftshader') ||
        arch.includes('llvmpipe') ||
        arch.includes('lavapipe');
      const dev = await adapter.requestDevice();
      if (typeof window !== 'undefined') {
        (window as any).__webgpuKeepAlive = { gpu: sharedGpu, adapter: sharedAdapter, device: dev };
      }
      let lost = false;
      dev.lost.then(() => {
        lost = true;
        if (sharedDevice === dev) {
          sharedDevice = null;
          sharedAdapter = null;
          webgpuDevicePromise = null;
        }
      });

      if (typeof document !== 'undefined' && document.body && document.visibilityState !== 'hidden') {
        probeCanvas = document.createElement('canvas');
        probeCanvas.width = 2;
        probeCanvas.height = 2;
        probeCanvas.style.cssText =
          'position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(probeCanvas);
        const wctx = probeCanvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!wctx) {
          probeCanvas.remove();
          dev.destroy();
          return null;
        }
        wctx.configure({
          device: dev,
          format: gpu.getPreferredCanvasFormat(),
          alphaMode: 'opaque',
        });
        const enc = dev.createCommandEncoder();
        const pass = enc.beginRenderPass({
          colorAttachments: [
            {
              view: wctx.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store',
            },
          ],
        });
        pass.end();
        dev.queue.submit([enc.finish()]);
        await dev.queue.onSubmittedWorkDone();
        await Promise.race([
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 16))),
          ),
          new Promise<void>((r) => setTimeout(r, 120)),
        ]);
        try {
          wctx.unconfigure();
        } catch {
          /* ignore */
        }
        probeCanvas.remove();
        probeCanvas = null;
      }

      if (lost) return null;
      sharedDevice = dev;
      return dev;
    } catch {
      if (probeCanvas) probeCanvas.remove();
      return null;
    }
  })();
  return webgpuDevicePromise;
}

/**
 * Initializes a Three.js `WebGPURenderer` (automatically using native WebGPU
 * when `navigator.gpu` adapter + swapchain are available, or Three's WebGPURenderer
 * fallback backend when running on environments without WebGPU swapchain support)
 * and records diagnostics on `window.__webgpu`.
 */
export async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  opts: CreateWebGPUOptions = {},
): Promise<THREE.WebGPURenderer> {
  const tel = ensureWebGPUTelemetry();
  const device = await acquireSharedWebGPUDevice();

  const renderer = new THREE.WebGPURenderer({
    canvas,
    alpha: opts.alpha ?? false,
    antialias: sharedIsSoftware ? false : (opts.antialias ?? true),
    powerPreference: 'high-performance',
    device: (device as any) ?? undefined,
    forceWebGL: !device,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  await renderer.init();

  if (opts.clearColor !== undefined) {
    renderer.setClearColor(opts.clearColor, opts.clearAlpha ?? 1);
  }

  const backendAny = (renderer as any).backend;
  const isWebGPUBackend = !!(backendAny && backendAny.isWebGPUBackend);
  const backendName: 'WebGPU' | 'WebGL2-Fallback' = isWebGPUBackend ? 'WebGPU' : 'WebGL2-Fallback';

  tel.ready = true;
  tel.active = true;
  tel.backend = backendName;
  tel.isWebGPUBackend = isWebGPUBackend;
  tel.hasNavigatorGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  if (opts.label === 'arrival') tel.arrivalBackend = backendName;
  if (opts.label === 'helix') tel.helixBackend = backendName;

  return renderer;
}

/**
 * Wraps an already-decoded HTMLImageElement in an upright `THREE.Texture`
 * (`flipY = true`, `SRGBColorSpace`) compatible with both WebGPU and WebGL2 backends.
 */
export function textureFromImage(img: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.Texture(img);
  texture.flipY = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Loads an HTMLImageElement from URL or pre-fetched Response/Blob promise and wraps
 * it in an upright `THREE.Texture` (`flipY = true`, `SRGBColorSpace`) compatible
 * with both WebGPU and WebGL2 backends.
 */
export async function loadGpuTexture(
  url: string,
  preSource?: Promise<Response | Blob | null> | Blob | null,
): Promise<THREE.Texture> {
  let blobUrl: string | null = null;
  try {
    if (preSource) {
      const resolved =
        preSource instanceof Promise ? await preSource.catch(() => null) : preSource;
      if (resolved instanceof Blob) {
        blobUrl = URL.createObjectURL(resolved);
      } else if (resolved && typeof (resolved as Response).blob === 'function' && (resolved as Response).ok) {
        const blob = await (resolved as Response).blob();
        blobUrl = URL.createObjectURL(blob);
      }
    }
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to decode texture: ${url}`));
      img.src = blobUrl || url;
    });
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    return textureFromImage(img);
  } catch {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    return createFallbackTexture();
  }
}
