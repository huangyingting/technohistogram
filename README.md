# Technology Histomap (WebGPU + Three.js + Next.js)

An interactive 3D spiral timeline of **4,828 sourced records** spanning **3.3 million BCE to 2026**—plus **240 dated forecasts reaching to 2076**—rebuilt with **WebGPU**, **Three.js Shading Language (TSL)**, and **Next.js**.

## Stack

- **Next.js `16.4.6`** (App Router, Turbopack) + **React `19.3.1`** + **TypeScript `7.0.2`**
- **Three.js `0.187.0`** (`three/webgpu` `WebGPURenderer` + `three/tsl` WGSL node shaders, with automatic WebGL 2 fallback when a WebGPU swapchain is unavailable)
- **D3 `7.9.2`** for scale/timeline calculations

## Architecture & Feature Parity

- **3D Arrival Globe (`src/engine/arrival.ts`)**: GPU-instanced TSL shaders (`MeshBasicNodeMaterial`) rendering 342 multi-atlas archival photo cards across 9 texture atlases, 3,429 spiral grain particles, procedural starry background, additive bloom halos, and seamless camera handoff into the main helix.
- **3D Spiral Histomap (`src/engine/helixGpu.ts` & `src/engine/helix.ts`)**: Four custom GPU-instanced TSL pipelines:
  1. **Cells (`MAX_CELLS = 5,120`)**: Screen-space billboarded SDF quads with significance sizing, selection/search dimming, and focus boost.
  2. **Lines (`MAX_LINES = 8,192`)**: Screen-projected mitered segments with dashed ring patterns, animated root-filament flow pulses, and causal dependency arcs.
  3. **Pictures (`MAX_PICS = 1,024`)**: Dynamic 4096×4096 `DataTexture` atlas packer with white archival borders, soft drop shadows, and progressive moment/root thumbnail streaming.
  4. **Halos (`MAX_HALOS = 64`)**: Additive radial glow sprites for landmarks, hovered records, and active selections.
- **Shared WebGPU Device Lifecycle (`src/engine/webgpu.ts`)**: Shares a single validated `GPUDevice` across the arrival and helix renderers so disposing the arrival scene never invalidates the active helix swapchain.
- **Full Editorial UI (`src/lib/*`, `src/components/HistomapClient.tsx`)**:
  - Logarithmic deep-roots + century-turn scrubbing (`3.3M BCE` to `2026`), pull-back conical overview, keyboard navigation (`/` search, arrow keys, `Escape`), and URL hash deep-linking.
  - Instant full-text, person, company, place, and tag search with mini temporal sparklines.
  - Floating unit sheets (with domain chips and claim verdicts), **Forecasts to 2076** decade sheet, rich Evidence Drawer with primary sources & archival photography, guided tours, poster export mode (`?poster=1`), and mobile bottom-sheet layout.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a WebGPU-capable browser (Chrome/Edge 113+, Safari 18+, Firefox Nightly; falls back cleanly to WebGL 2 elsewhere).

## Production Build

```bash
npm run typecheck
npm run build
npm run start
```
