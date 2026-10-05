'use client';

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { setFlat } from '@/lib/runtime';
import { LOCK_CLASS, TOUCH_CLASS } from '@/lib/touch';
import { releaseCover } from '@/ui/sheet';
import { useSnapshot } from '@/ui/useSnapshot';
import FactoryCanvas from './FactoryCanvas';

const noop = () => () => {};

/** Clase de <html> con la línea en láminas: la página se desplaza y la pista de la cámara sobra. */
const FLAT_CLASS = 'flat';

/** Tras perder el contexto, lo que se espera (con la página a la vista) a que el navegador lo devuelva. */
const RESTORE_WAIT = 2000;
/** Más pérdidas que estas en un minuto: la GPU no da para la nave y la línea pasa a láminas. */
const MAX_LOSSES = 3;

/**
 * WebGL por software (sin GPU: SwiftShader, llvmpipe…). Cada fotograma de la nave cuesta cientos de ms
 * en la CPU y la página deja de responder (PageSpeed, que prueba así, medía 30 s de bloqueo): la línea
 * pasa a láminas. Con GPU no cambia nada. `?gl=any` dibuja la nave igualmente.
 */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;
let software: boolean | undefined;
function softwareGL() {
  if (software === undefined) {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    software = SOFTWARE_GL.test(renderer) && new URLSearchParams(window.location.search).get('gl') !== 'any';
  }
  return software;
}

/** Si el lienzo falla al crearse o al montar la nave, la portada sigue: la línea pasa a láminas. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('The plant could not be drawn; the line is shown as a set of sheets.', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Sin nave: fuera el arranque (que esperaba a la escena), el bloqueo de la página y la hoja del cambio
 * de página; la interfaz entra ya (un panel pedido con ?panel= se abre entonces).
 */
function useFlatPage(flat: boolean) {
  useEffect(() => {
    if (!flat) return;
    const root = document.documentElement;
    window.clearTimeout((window as { __bootFallback?: number }).__bootFallback);
    const booting = root.classList.contains('boot');
    root.classList.remove('boot', 'boot-in', LOCK_CLASS, TOUCH_CLASS);
    root.classList.add(FLAT_CLASS);
    releaseCover();
    if (booting) window.dispatchEvent(new Event('factory:ui-in'));
    return () => root.classList.remove(FLAT_CLASS);
  }, [flat]);
}

/**
 * La escena solo se pinta en el cliente (WebGL), pero su código se importa de forma estática: así
 * va en los scripts que el HTML pide desde el principio y se descarga en paralelo con React. Con
 * `dynamic(..., { ssr: false })` no se pedía hasta acabar la hidratación (≈1 s más tarde en 4G lenta).
 *
 * Si el navegador retira el contexto WebGL, la nave se vuelve a montar entera en cuanto lo devuelve
 * (o, con la página a la vista, pasado un momento): el pase de tinta guarda estado propio en la GPU y
 * rehacerlo todo es lo seguro. Sin WebGL, o si la nave no llega a montarse, la línea pasa a láminas.
 */
export function SceneLoader() {
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const { flat } = useSnapshot('flat');
  const soft = client && softwareGL();
  const [mount, setMount] = useState(0);
  const losses = useRef<number[]>([]);
  const pending = useRef<() => void>(() => {});
  useFlatPage(flat);
  useEffect(() => () => pending.current(), []);
  useEffect(() => {
    if (soft) setFlat();
  }, [soft]);

  const onLost = useCallback((canvas: HTMLCanvasElement) => {
    const now = performance.now();
    losses.current = [...losses.current.filter((t) => now - t < 60_000), now];
    if (losses.current.length > MAX_LOSSES) {
      setFlat();
      return;
    }
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      canvas.removeEventListener('webglcontextrestored', remount);
      document.removeEventListener('visibilitychange', arm);
      pending.current = () => {};
    };
    const remount = () => {
      done();
      // La nave vieja suelta su contexto antes de desmontarse: si el navegador ya lo había devuelto, sus
      // objetos (de antes de la pérdida) no son de él y borrarlos llenaba la consola de avisos.
      const gl = canvas.getContext('webgl2');
      if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
      setMount((n) => n + 1);
    };
    // Oculta, la página no cuenta el tiempo: iOS devuelve el contexto al volver a ella.
    const arm = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') timer = window.setTimeout(remount, RESTORE_WAIT);
    };
    canvas.addEventListener('webglcontextrestored', remount);
    document.addEventListener('visibilitychange', arm);
    pending.current = done;
    arm();
  }, []);

  if (!client || flat || soft) return null;
  return (
    <SceneBoundary onError={setFlat}>
      <FactoryCanvas key={mount} onLost={onLost} />
    </SceneBoundary>
  );
}
