import { notFound } from 'next/navigation';

/** Cualquier dirección que no es una hoja: la 404 de la línea (not-found.tsx), en su idioma. */
export const dynamicParams = true;

export default function Missing() {
  notFound();
}
