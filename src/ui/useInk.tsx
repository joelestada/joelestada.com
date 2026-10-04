'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Marca única de unas pestañas: sigue al cursor y, al salir, vuelve a la pestaña marcada (o se
 * recoge si no hay ninguna). Aparece en su sitio, sin arrastrarse desde la anterior.
 * Devuelve las referencias que hay que poner en el rótulo de cada pestaña y la marca ya colocada.
 */
export function useInk(target: string | null) {
  const labels = useRef<Record<string, HTMLElement | null>>({});
  const [ink, setInk] = useState({ x: 0, w: 0, shown: false, jump: true });
  const targetRef = useRef(target);

  /** Coloca la marca en la pestaña del objetivo; `jump`: sin deslizarse (al aparecer o al recolocar). */
  const measure = useRef((jump: boolean) => {
    const key = targetRef.current;
    const el = key ? labels.current[key] : null;
    setInk((prev) => {
      if (!el) return prev.shown || prev.jump ? { ...prev, shown: false, jump: false } : prev;
      const x = el.offsetLeft;
      const w = el.offsetWidth;
      if (prev.shown && prev.x === x && prev.w === w) return prev;
      return { x, w, shown: true, jump: jump || !prev.shown };
    });
  }).current;

  // Cambio de objetivo: de una pestaña a otra, la marca se desliza.
  useLayoutEffect(() => {
    targetRef.current = target;
    measure(false);
  }, [target, measure]);

  // Recolocar sin deslizarse cuando cambia el ancho de un rótulo, de su pestaña o de la barra: al
  // cargar las fuentes, con la ventana o el zoom y cuando el traductor del navegador cambia los
  // textos (sin esto, la marca se quedaba encuadrando el sitio que tenía el rótulo en inglés).
  useEffect(() => {
    const ro = new ResizeObserver(() => measure(true));
    for (const el of Object.values(labels.current)) {
      if (!el) continue;
      ro.observe(el);
      if (el.parentElement) ro.observe(el.parentElement);
      if (el.parentElement?.parentElement) ro.observe(el.parentElement.parentElement);
    }
    return () => ro.disconnect();
  }, [measure]);

  const ref = (key: string) => (el: HTMLElement | null) => {
    labels.current[key] = el;
  };
  /**
   * Marcas de selección de plano: cuatro esquinas que encuadran el rótulo. Al entrar convergen desde
   * fuera sobre él; de una pestaña a otra, el encuadre se desliza y cambia de ancho; al salir se
   * abren y se apagan.
   */
  const mark = (
    <span
      className={`tabs__mark${ink.shown ? ' is-shown' : ''}${ink.jump ? ' is-jump' : ''}`}
      style={{ transform: `translateX(${ink.x}px)`, width: ink.w }}
      aria-hidden
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
  return { ref, mark };
}
