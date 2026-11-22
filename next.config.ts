import type { NextConfig } from 'next';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
  reactStrictMode: false,
  poweredByHeader: false,
};

export default nextConfig;
