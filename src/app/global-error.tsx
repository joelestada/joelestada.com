'use client';

import { palette } from '@/config/palette';
import { SITE } from '@/config/site';

/**
 * Último recurso, si falla la propia plantilla de la web: sin sus estilos, una hoja mínima con los
 * colores de la línea, volver a intentarlo y el contacto.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { email } = SITE.contact;
  const ink = palette.ink;
  // Sin la plantilla no hay idioma de la página: se lee de la dirección.
  const es = typeof window !== 'undefined' && /^\/es(\/|$)/.test(window.location.pathname);
  return (
    <html lang={es ? 'es' : 'en'}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: palette.floor,
          color: ink,
          font: '16px/1.5 system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: '46ch', padding: 24 }}>
          <p style={{ margin: 0, font: '500 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.7 }}>
            {SITE.name} · Error
          </p>
          <h1 style={{ margin: '16px 0', fontSize: 48, lineHeight: 1, letterSpacing: '-0.03em' }}>{es ? 'Línea parada' : 'Line stopped'}</h1>
          <p style={{ margin: '0 0 24px' }}>
            {es
              ? 'Algo se ha atascado al cargar la web. Vuelve a intentarlo o escríbeme a '
              : 'Something jammed while loading the site. Try again, or write to '}
            <a href={`mailto:${email}`} style={{ color: ink }}>
              {email}
            </a>
            .
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '12px 18px',
              border: 0,
              background: ink,
              color: palette.floor,
              font: '600 11px/1 ui-monospace, Menlo, monospace',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {es ? 'Reintentar' : 'Try again'}
          </button>
        </main>
      </body>
    </html>
  );
}
