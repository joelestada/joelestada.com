import type { ComponentProps, ReactNode } from 'react';
import { LineIndex } from './LineIndex';
import { SheetBar } from './SheetBar';
import { SheetFrame } from './SheetFrame';

/**
 * Hoja de lectura (proyectos, CV, 404): marco de lámina, barra arriba, el contenido y la línea al pie.
 * Todo dentro de un contenedor: al cambiar de página Next lleva arriba el primer elemento que no
 * es fijo, y así es la hoja entera (no el contenido, que quedaría bajo la barra).
 */
export function SheetPage({ bar, line, children }: { bar: ComponentProps<typeof SheetBar>; line: ComponentProps<typeof LineIndex>; children: ReactNode }) {
  return (
    <div className="page">
      <SheetFrame />
      <SheetBar {...bar} />
      {children}
      <LineIndex {...line} />
    </div>
  );
}
