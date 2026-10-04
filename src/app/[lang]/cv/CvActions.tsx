'use client';

import { useEffect } from 'react';
import { useUi } from '@/i18n/ui';

/**
 * Guardar en PDF: el diálogo de impresión del navegador con la lámina ajustada a un A4 (ver
 * @media print en cv.css). Con `?print=1` (el botón del panel CV) se abre solo al cargar.
 * Es una celda de la barra, junto a la de volver a la línea.
 */
export function SavePdf() {
  const t = useUi();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') !== '1') return;
    let t = 0;
    // Con las fuentes ya cargadas: si no, el PDF sale con las del sistema.
    document.fonts.ready.then(() => {
      t = window.setTimeout(() => window.print(), 250);
    });
    return () => window.clearTimeout(t);
  }, []);
  return (
    <button type="button" className="bar__act" onClick={() => window.print()} aria-label={t.bar.savePdf}>
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2.5 V10.5 M4.5 7 L8 10.5 L11.5 7 M3 13.5 H13" />
      </svg>
      <span className="bar__act-label">{t.bar.savePdf}</span>
    </button>
  );
}
