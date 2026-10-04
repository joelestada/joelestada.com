import { SITE } from '@/config/site';

/**
 * Dirección pública del portfolio, sin barra final: la de site.ts o, sin ella, el dominio de producción
 * de Vercel (en local, localhost). La usan la vista previa al compartir, el mapa del sitio y robots.
 */
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = SITE.url || (vercel ? `https://${vercel}` : `http://localhost:${process.env.PORT ?? 3000}`);
