'use client';

import { useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from 'react';

/** Animaciones con las que sale el contenido viejo (al acabar, se retira). */
const OUT = new Set(['swap-to', 'swap-fade-to']);

type Out = { k: string; n: number; node: ReactNode; dir: number };

/**
 * Cambio de contenido sin parpadeo: cuando cambia `k`, el contenido anterior sale y el nuevo entra a
 * la vez, superpuestos en la misma celda y cada uno con su máscara. Nunca hay un fotograma vacío.
 * - roll: rodillo vertical en el sentido del recorrido (dir 1, avanzar: sube; -1, retroceder: baja).
 * - fade: fundido con un pequeño desplazamiento; el viejo sale por encima sin ocupar sitio.
 * `delay` escalona varios (ms). Al montarse no anima: solo los cambios.
 */
export function Swap({
  k,
  dir = 1,
  delay = 0,
  mode = 'roll',
  className,
  children,
}: {
  k: string;
  dir?: number;
  delay?: number;
  mode?: 'roll' | 'fade';
  className?: string;
  children: ReactNode;
}) {
  const [cur, setCur] = useState({ k, node: children });
  const [outs, setOuts] = useState<Out[]>([]);
  const [serial, setSerial] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  if (k !== cur.k) {
    // Si llegan cambios seguidos, solo se conserva la salida más reciente (más se amontonarían).
    setOuts((list) => [...list.slice(-1), { k: cur.k, n: serial, node: cur.node, dir }]);
    setSerial(serial + 1);
    setCur({ k, node: children });
  }
  // Oculto (p. ej., la versión del título que no es para esta pantalla) no anima ni avisa al acabar:
  // lo viejo se retira ya, en vez de quedarse esperando y salir de golpe si luego se muestra.
  useLayoutEffect(() => {
    if (outs.length && root.current && !root.current.getClientRects().length) setOuts([]);
  }, [outs]);
  const done = (o: Out) => (e: AnimationEvent) => {
    if (e.target === e.currentTarget && OUT.has(e.animationName)) setOuts((list) => list.filter((x) => x !== o));
  };
  return (
    <span ref={root} className={`swap swap--${mode}${className ? ` ${className}` : ''}`} style={{ '--swap-delay': `${delay}ms` } as CSSProperties}>
      {outs.map((o) => (
        <span key={`o${o.n}`} className="swap__item is-out" style={{ '--dir': o.dir } as CSSProperties} aria-hidden inert onAnimationEnd={done(o)}>
          {o.node}
        </span>
      ))}
      <span key={`i${k}`} className={`swap__item${outs.length ? ' is-in' : ''}`} style={{ '--dir': dir } as CSSProperties}>
        {k === cur.k ? children : cur.node}
      </span>
    </span>
  );
}

/**
 * Contenedor que sigue el alto de su contenido con una transición: al cambiar de máquina con la ficha
 * abierta, la descripción nueva no hace saltar la ficha, la ficha crece o encoge con suavidad.
 */
export function Morph({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    let ready = false;
    const fit = () => {
      o.style.height = `${i.offsetHeight}px`;
      if (!ready) {
        ready = true;
        // La primera medida, sin transición; desde la siguiente, anima.
        requestAnimationFrame(() => o.classList.add('is-ready'));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className={`morph${className ? ` ${className}` : ''}`}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
