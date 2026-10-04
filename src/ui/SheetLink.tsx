'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { coverAndGo, type SheetLabel } from './sheet';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  /** Rótulo de la hoja que cubre la pantalla mientras se cambia de página. */
  sheet: SheetLabel;
  /** Antes de cubrir (p. ej., recordar la estación a la que se vuelve o cerrar el panel). */
  onGo?: () => void;
};

/**
 * Enlace entre páginas con cambio de lámina: la hoja crece desde el propio enlace y se navega cuando
 * cubre la pantalla. Con una tecla modificadora (abrir en otra pestaña) es un enlace normal.
 */
export function SheetLink({ href, sheet, onGo, onClick, ...rest }: Props) {
  const router = useRouter();
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onGo?.();
    coverAndGo(() => router.push(href), sheet, e.currentTarget);
  };
  return <Link href={href} onClick={go} {...rest} />;
}
