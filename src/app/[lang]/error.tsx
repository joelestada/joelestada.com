'use client';

import { useEffect } from 'react';
import { SITE } from '@/config/site';
import { useHref } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { LOCK_CLASS, TOUCH_CLASS } from '@/lib/touch';
import { SheetFrame } from '@/ui/SheetFrame';

/**
 * Algo ha fallado al pintar una hoja: la misma lámina que la 404, con volver a intentarlo y, por si la
 * línea no arranca, el contacto y el CV a mano. Va en todas las páginas desde el principio, así que es
 * ligera: el marco y enlaces normales, sin la barra ni el pie de las hojas de lectura. En la portada
 * quita el arranque y el bloqueo de la página, que esperaban a la escena.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    window.clearTimeout((window as { __bootFallback?: number }).__bootFallback);
    document.documentElement.classList.remove('boot', 'boot-in', LOCK_CLASS, TOUCH_CLASS);
  }, [error]);

  const { email } = SITE.contact;
  const t = useUi();
  const href = useHref();
  return (
    <>
      <SheetFrame />
      <main className="lost">
        <p className="lost__kicker">
          {SITE.name} · {t.error.kicker}
        </p>
        <h1 className="lost__title">{t.error.title}</h1>
        <p className="lost__lead">{t.error.lead(email)}</p>
        <div className="lost__actions">
          <button type="button" className="btn btn--ink" onClick={reset}>
            {t.error.retry}
          </button>
          <a className="btn" href={`mailto:${email}`}>
            Email <span className="btn__arrow">↗</span>
          </a>
          <a className="btn" href={href(SITE.cv.href)}>
            CV <span className="btn__arrow btn__arrow--right">→</span>
          </a>
          <a className="btn" href={href('/')}>
            {t.common.theLine} <span className="btn__arrow btn__arrow--right">→</span>
          </a>
        </div>
      </main>
    </>
  );
}
