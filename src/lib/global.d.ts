export interface WebGPUTelemetry {
  ready: boolean;
  active: boolean;
  backend: 'WebGPU' | 'WebGL2-Fallback' | 'initializing';
  isWebGPUBackend: boolean;
  hasNavigatorGpu: boolean;
  arrivalBackend?: string;
  helixBackend?: string;
  adapterInfo?: string;
  frameCount: number;
  cellInstances: number;
  lineInstances: number;
  picInstances: number;
  haloInstances: number;
}

declare global {
  interface Window {
    __BUILD?: string;
    __ARRIVAL?: boolean;
    __pre?: Record<string, Promise<Response> | undefined>;
    __arr?: {
      data?: Promise<Response>;
      pics?: Promise<any>;
      sheets?: Promise<Promise<Blob>[]>;
    };
    __introPre?: {
      pal?: Promise<Response>;
      lm?: Promise<Response>;
    };
    __introLive?: boolean;
    __openIntro?: () => void;
    __intro?: Record<string, any>;
    __STILL?: {
      cx: number;
      cy: number;
      ballR: number;
      loopR: number;
      W: number;
      H: number;
    };
    __helix?: Record<string, any>;
    __histomap?: Record<string, any>;
    __webgpu?: WebGPUTelemetry;
    d3?: typeof import('d3');
  }

  const scheduler:
    | {
        yield?: () => Promise<void>;
      }
    | undefined;
}

export {};
