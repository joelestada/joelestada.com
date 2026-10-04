import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  agentRules: false,
  turbopack: {
    root: path.resolve(__dirname),
    // 'three' es la parte de three.js que usa la nave (ver src/scene/three.ts). Solo el nombre exacto:
    // las rutas de dentro del paquete (three/src/…, three/examples/…) siguen yendo al paquete.
    resolveAlias: { three: './src/scene/three.ts' },
  },
  // Ganchos de medida y verificación en `window` (__factory, __r3f, __verifyPartial…): siempre en
  // desarrollo y, en producción, solo en una build de medida (`npm run build:perf`). Se define siempre
  // para que la condición quede fija al compilar y el código salga del bundle en las builds normales.
  env: { PERF_HOOKS: process.env.PERF_HOOKS ?? '' },
};

export default nextConfig;
