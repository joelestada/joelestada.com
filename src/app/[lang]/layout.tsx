import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import { palette } from '@/config/palette';
import { SITE } from '@/config/site';
import { DEFAULT_LANG, isLang, LANG_SWITCH_KEY, LANGS, localePath } from '@/i18n/lang';
import { BOOT_SEEN_KEY, BOOT_SHORT_CLASS } from '@/lib/bootFlags';
import { alternatesFor } from '@/i18n/meta';
import { LangProvider } from '@/i18n/LangProvider';
import { uiIn } from '@/i18n/ui';
import { SITE_URL } from '@/lib/siteUrl';
import { LOCK_CLASS, TOUCH_CLASS, TOUCH_QUERY } from '@/lib/touch';
import { CoverRelease } from '@/ui/CoverRelease';
import '../globals.css';
import '../../ui/overlay.css';
import '../../ui/card.css';
import '../../ui/chrome.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

/** Vista previa al compartir: capturas de la propia nave (scripts/og.mjs). Cada proyecto pone la suya en su página. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = uiIn(lang);
  const title = `${SITE.person} — ${t.meta.disciplines}`;
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: t.meta.description,
    alternates: alternatesFor(lang, '/'),
    openGraph: {
      type: 'website',
      siteName: SITE.person,
      locale: lang === 'es' ? 'es_ES' : 'en_US',
      title,
      description: t.meta.description,
      url: localePath(lang, '/'),
      images: [{ url: `/og/${lang}/home.jpg`, width: 1200, height: 630, alt: t.meta.ogAlt(SITE.person) }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  themeColor: palette.floor,
};

/** Tokens de identidad para la capa HTML, derivados de la paleta de la escena. */
const themeVars = {
  '--paper': palette.floor,
  '--paper-lit': palette.floorLit,
  '--paper-shade': palette.paperShade,
  '--ink': palette.ink,
  '--green': palette.green,
  '--yellow': palette.signalYellow,
  '--metal': palette.metalMid,
  '--metal-light': palette.metalLight,
  '--ok': palette.andonGreen,
  '--alert': palette.andonRed,
  '--amber': palette.andonAmber,
} as CSSProperties;

/**
 * La portada no se desplaza (`line-lock`): la línea la recorre una pista fija; en táctil, arrastrando en
 * horizontal (`line-touch`).
 * Se decide aquí, antes de pintar, para que la página no llegue a moverse ni un instante.
 *
 * Traductor del navegador: si el visitante lee español o inglés, la web tiene su versión escrita a mano
 * (botón EN · ES), así que se le pide al navegador que no la traduzca (`translate="no"` y la clase
 * `notranslate` de Chrome). En otros idiomas el traductor sigue disponible.
 *
 * Arranque de la nave: solo al cargar la portada (también al recargarla), no al volver de un
 * proyecto sin recargar, al cambiar de idioma ni con «reducir movimiento»; si ya se vio en esta sesión,
 * en versión corta (lib/bootFlags). Se decide antes de pintar,
 * para que la interfaz no asome antes de tiempo; si la escena no llega a arrancar, la interfaz sale igual.
 */
const BOOT_SCRIPT = `try{var d=document.documentElement,L=navigator.languages||[navigator.language],h=/^\\/(en|es)\\/?$/.test(location.pathname),k='${LANG_SWITCH_KEY}',w=sessionStorage.getItem(k);sessionStorage.removeItem(k);if(L.some(function(l){return/^(en|es)\\b/i.test(l)})){d.setAttribute('translate','no');d.classList.add('notranslate')}if(h){d.classList.add('${LOCK_CLASS}');if(matchMedia('${TOUCH_QUERY}').matches)d.classList.add('${TOUCH_CLASS}')}if(h&&!w&&!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('boot');if(sessionStorage.getItem('${BOOT_SEEN_KEY}'))d.classList.add('${BOOT_SHORT_CLASS}');window.__bootFallback=setTimeout(function(){d.classList.remove('boot')},9000)}}catch(e){}`;

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  return (
    // data-scroll-behavior: el scroll suave (globals.css) es para las anclas; al cambiar de página, Next va arriba sin animar.
    <html lang={lang} style={themeVars} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
        <CoverRelease />
      </body>
    </html>
  );
}
