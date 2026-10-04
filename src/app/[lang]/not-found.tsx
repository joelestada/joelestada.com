'use client';

import { SITE } from '@/config/site';
import { useHref } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { SheetLink } from '@/ui/SheetLink';
import { SheetPage } from '@/ui/SheetPage';

/**
 * Una dirección que no es ninguna hoja: la misma lámina, y la línea para volver a ella. En el idioma
 * de la dirección (la 404 no recibe parámetros: lo lee del layout, que sí).
 */
export default function NotFound() {
  const t = useUi();
  const href = useHref();
  return (
    <SheetPage bar={{ here: { label: t.lost.label } }} line={{ sheet: t.lost.sheet }}>
      <title>{`${t.lost.title} — ${SITE.person}`}</title>
      <main className="lost">
        <p className="lost__kicker">{t.lost.kicker}</p>
        <h1 className="lost__title">{t.lost.title}</h1>
        <p className="lost__lead">{t.lost.lead}</p>
        <SheetLink href={href('/')} className="btn btn--ink" sheet={{ kicker: t.common.backTo, title: t.common.theLine }}>
          {t.lost.back} <span className="btn__arrow btn__arrow--right">→</span>
        </SheetLink>
      </main>
    </SheetPage>
  );
}
