import { preload } from 'react-dom';
import { SCROLL } from '@/config/layout';
import { SITE, siteIn } from '@/config/site';
import { stationsIn } from '@/config/stations';
import { DEFAULT_LANG, isLang, localePath } from '@/i18n/lang';
import { uiIn } from '@/i18n/ui';
import { STENCIL_FONT } from '@/scene/fonts';
import { SceneLoader } from '@/scene/SceneLoader';
import { Overlay } from '@/ui/Overlay';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = uiIn(lang);
  const site = siteIn(lang);
  // La fuente de los rótulos pintados en la nave: la pide la escena cuando ya ha cargado, y el
  // arranque la espera. Precargada, llega a la vez que el resto.
  preload(STENCIL_FONT, { as: 'font', type: 'font/woff', crossOrigin: 'anonymous' });
  return (
    <main id="top">
      {/* La escena es un dibujo: el encabezado y la presentación solo los leen los lectores de pantalla y los buscadores. */}
      <h1 className="sr-only">{t.meta.h1(SITE.person)}</h1>
      <p className="sr-only">{site.about}</p>
      {/*
        Las hojas de los proyectos y el CV como enlaces de verdad, para los lectores de pantalla (la nave
        es un dibujo) y los buscadores. Fuera del tabulador: con el teclado se llega por la línea.
      */}
      <nav className="sr-only" aria-label={t.meta.sheets}>
        <ul>
          {stationsIn(lang).map((s) => (
            <li key={s.id}>
              <a href={localePath(lang, `/projects/${s.id}`)} tabIndex={-1}>
                {s.number} {s.title.join(' ')}
              </a>
            </li>
          ))}
          <li>
            <a href={localePath(lang, SITE.cv.href)} tabIndex={-1}>
              {t.common.cv}
            </a>
          </li>
        </ul>
      </nav>
      <SceneLoader />
      <Overlay />
      {/*
        Solo aporta recorrido de scroll: la cámara avanza con él. En escritorio desplaza la página;
        en táctil la pista es fija y la mueve el arrastre horizontal (ver CameraRig y globals.css).
      */}
      <div className="track" aria-hidden>
        <div style={{ height: `${SCROLL.heightVh}vh` }} />
      </div>
    </main>
  );
}
