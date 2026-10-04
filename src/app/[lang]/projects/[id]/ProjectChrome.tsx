'use client';

import type { ReactNode } from 'react';
import type { StationId } from '@/config/stations';
import { useHref } from '@/i18n/LangProvider';
import { useUi } from '@/i18n/ui';
import { rememberReturn } from '@/lib/runtime';
import { SheetLink } from '@/ui/SheetLink';

/** Vuelve a la línea con la cámara en la estación del proyecto y su ficha abierta (con cambio de lámina). */
export function BackToLine({ id, className, children }: { id: StationId; className?: string; children: ReactNode }) {
  const t = useUi();
  const href = useHref();
  return (
    <SheetLink href={href('/')} className={className} sheet={{ kicker: t.common.backTo, title: t.common.theLine }} onGo={() => rememberReturn(id)}>
      {children}
    </SheetLink>
  );
}
