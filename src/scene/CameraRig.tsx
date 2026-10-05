'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Lenis from 'lenis';
import { CAMERA, SCROLL, cameraDirection } from '@/config/layout';
import { isCompact, isSide } from '@/lib/compact';
import { LOCK_CLASS, TOUCH_CLASS, TOUCH_QUERY } from '@/lib/touch';
import {
  cameraXAt,
  emitFrame,
  getSnapshot,
  leaveIntro,
  linkHash,
  requestAmbient,
  restoreView,
  runtime,
  setSelected,
  updateActive,
  updateExit,
} from '@/lib/runtime';
import { explode } from './explode';
import { createFraming } from './framing';
import { frameClock } from './frameClock';

/**
 * Diagnóstico (?snap=split): el redondeo anterior, cada eje por su cuenta, para compararlo a mano.
 * Se queda mientras siga abierto el tirón de Safari en escritorio (ver el medidor, tecla F).
 */
const SPLIT_SNAP = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('snap') === 'split';

/**
 * Diagnóstico (?zoom=3, solo en desarrollo): acerca la cámara ese factor para revisar el detalle de
 * una máquina en las capturas. La nave se recorre igual; solo cambian los metros que caben.
 */
const DEV_ZOOM =
  typeof window !== 'undefined' && process.env.NODE_ENV !== 'production'
    ? Math.max(1, Number(new URLSearchParams(window.location.search).get('zoom')) || 1)
    : 1;

/** Paso máximo del reloj de Lenis: tras una pausa sin frames no salta de golpe al destino. */
const MAX_STEP_MS = 34;

/** Encuadre del móvil: aire entre la máquina y el borde del hueco libre (px) y rapidez con que lo sigue (1/s). */
const FRAME_MARGIN = 14;
const FRAME_RATE = 11;
/** Tras el último evento de cambio de tamaño, lo que se mantiene el avance guardado (ms). */
const RESIZE_SETTLE_MS = 400;
const REDUCED = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * Cámara ortográfica fija en ángulo que recorre la línea con el scroll.
 *
 * Fluidez: un único suavizado (Lenis) avanzado dentro del frame de R3F, así la posición
 * de scroll, la cámara y el render ocurren en el mismo frame, sin segundo bucle de rAF. Lenis avanza
 * con el reloj de los frames (refrescos enteros): con performance.now() Safari daba pasos desiguales.
 *
 * Nitidez: la cámara se ajusta a la rejilla de píxeles de dispositivo en su propio plano
 * y su profundidad no cambia nunca (en ortográfica no afecta a la imagen). Cada frame es
 * la misma imagen desplazada un número entero de píxeles: el trazo no puede parpadear.
 */
export function CameraRig() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);

  const basis = useMemo(() => {
    const back = new THREE.Vector3(...cameraDirection());
    const rotation = new THREE.Matrix4().lookAt(back, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    const right = new THREE.Vector3().setFromMatrixColumn(rotation, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(rotation, 1);
    const forward = back.clone().negate();
    const mid = new THREE.Vector3((CAMERA.startX + CAMERA.endX) / 2, CAMERA.targetY, CAMERA.targetZ);
    return {
      right,
      up,
      forward,
      quaternion: new THREE.Quaternion().setFromRotationMatrix(rotation),
      /** Coordenada fija de la cámara sobre su eje de visión. */
      depth: mid.dot(forward) - CAMERA.distance,
      /** Px verticales por px horizontal al avanzar a lo largo de X (la pendiente de la línea en pantalla). */
      upPerRight: up.x / right.x,
    };
  }, []);

  const shift = useRef(0);
  /** Desplazamiento vertical del encuadre (m, en el plano de la cámara): en móvil la línea sube. */
  const lift = useRef(0);
  const portrait = useRef(false);
  /**
   * Encuadre de las pantallas compactas (scene/framing): el hueco libre que sigue la cámara, ya
   * suavizado, y la presentación (0..1). Sin hueco medido, el encuadre de siempre.
   */
  const compact = useRef(false);
  const framing = useMemo(() => createFraming(basis.right, basis.up), [basis]);
  const view = useRef({ ready: false, l: 0, t: 0, r: 0, b: 0, intro: 1, at: 0 });
  const place = useMemo(() => {
    const target = new THREE.Vector3();
    return (x: number) => {
      const cam = camRef.current;
      if (!cam) return;
      const px = 1 / (cam.zoom * gl.getPixelRatio());
      const v = view.current;
      // Desplazamiento del encuadre en el plano de la cámara (m): a la derecha y hacia arriba.
      let dr = 0;
      let du = -lift.current;
      if (compact.current && v.ready) {
        // Móvil: la caja de la parada (con la presentación y el despiece mezclados) en el centro del
        // hueco libre. Si no cabe de alto, manda su parte de arriba: el despiece crece hacia arriba.
        const k = cam.zoom;
        const ex = explode.station && explode.end > 0 ? Math.min(1, explode.t / explode.end) : 0;
        const s = framing(x, v.intro, explode.station, ex * ex * (3 - 2 * ex));
        const top = v.t + FRAME_MARGIN;
        const tall = (s.u1 - s.u0) * k > v.b - FRAME_MARGIN - top;
        const cy = tall ? top + ((s.u1 - s.u0) * k) / 2 : (v.t + v.b) / 2;
        dr = (s.r0 + s.r1) / 2 - ((v.l + v.r) / 2 - size.width / 2) / k;
        du = (s.u0 + s.u1) / 2 - (size.height / 2 - cy) / k;
        target.set(x, CAMERA.targetY, CAMERA.targetZ);
      } else {
        // En vertical, al principio del recorrido el encuadre se corre hacia la persiana (el rótulo
        // JOEL entero) y vuelve a su sitio poco a poco: sin saltos, porque depende solo de x.
        const k = Math.min(1, Math.max(0, (x - CAMERA.startX) / CAMERA.portraitStartSpan));
        const start = portrait.current ? CAMERA.portraitStartShiftX * (1 - k * k * (3 - 2 * k)) : 0;
        target.set(x + shift.current + start, CAMERA.targetY, CAMERA.targetZ);
      }
      const exactR = (target.dot(basis.right) + dr) / px;
      const exactU = (target.dot(basis.up) + du) / px;
      const r = Math.round(exactR);
      // La cámara viaja a lo largo de X, que en pantalla es una diagonal. Redondear cada eje por
      // su cuenta hacía que a poca velocidad un frame avanzara en horizontal y otro en vertical (un
      // zigzag que se nota como tirón). El vertical sale del punto de la diagonal que corresponde
      // al horizontal ya redondeado: los dos ejes saltan siempre en el mismo frame.
      const u = SPLIT_SNAP ? Math.round(exactU) : Math.round(exactU + (r - exactR) * basis.upPerRight);
      cam.position
        .copy(basis.right)
        .multiplyScalar(r * px)
        .addScaledVector(basis.up, u * px)
        .addScaledVector(basis.forward, basis.depth);
      cam.updateMatrixWorld();
      // Desplazamiento entero en px de dispositivo: el grano del papel viaja con la nave.
      cam.userData.pixelOffset = [r, u];
      // Sin redondear: lo que viaja con la cámara se ajusta respecto a esto y no tiembla.
      cam.userData.pixelExact = [exactR, exactU];
    };
  }, [basis, gl, framing, size.width, size.height]);

  // Cámara por defecto del lienzo mientras la escena está montada.
  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    const previous = get().camera;
    set({ camera: cam });
    return () => set({ camera: previous });
  }, [get, set]);

  // Orientación fija, una sola vez.
  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.quaternion.copy(basis.quaternion);
    place(runtime.cameraX);
  }, [basis, place]);

  // Zoom: metros visibles constantes en vertical (con anchura mínima en pantallas estrechas).
  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    const aspect = size.width / size.height;
    const minWidth = aspect < 1 ? CAMERA.minViewWidthPortrait : CAMERA.minViewWidth;
    portrait.current = aspect < 1;
    shift.current = aspect < 1 ? CAMERA.portraitShiftX : 0;
    // Móvil en horizontal: con la anchura mínima del escritorio las máquinas quedaban diminutas.
    const viewHeight = (isSide(size.width, size.height) ? CAMERA.shortViewHeight : Math.max(CAMERA.viewHeight, minWidth / aspect)) / DEV_ZOOM;
    lift.current = aspect < 1 ? CAMERA.portraitLift * viewHeight : 0;
    compact.current = isCompact(size.width, size.height);
    // Con otro tamaño, el hueco libre se toma tal cual (sin seguirlo desde el de antes).
    view.current.ready = false;
    cam.zoom = size.height / viewHeight;
    cam.updateProjectionMatrix();
    place(runtime.cameraX);
    invalidate();
  }, [size.width, size.height, invalidate, place]);

  // Proyección mundo → px CSS para la capa HTML (rótulos).
  useEffect(() => {
    const d = new THREE.Vector3();
    runtime.project = (x, y, z) => {
      const cam = camRef.current;
      if (!cam) return [0, 0];
      d.set(x, y, z).sub(cam.position);
      return [size.width / 2 + d.dot(basis.right) * cam.zoom, size.height / 2 - d.dot(basis.up) * cam.zoom];
    };
    emitFrame();
  }, [basis, size.width, size.height]);

  // Lenis sin rAF propio: lo avanza el frame de la escena y cualquier gesto pide frame.
  useEffect(() => {
    // La página queda quieta y Lenis mueve la pista fija: con la rueda o el trackpad en escritorio y
    // con el arrastre horizontal en táctil (el dedo hacia la izquierda avanza por la nave). Así ni la
    // barra del navegador del móvil aparece y desaparece, ni Safari recoloca las capas fijas a
    // destiempo por desplazar el documento en cada frame.
    const touch = window.matchMedia(TOUCH_QUERY).matches;
    const track = document.querySelector<HTMLElement>('.track');
    const root = document.documentElement;
    root.classList.add(LOCK_CLASS);
    root.classList.toggle(TOUCH_CLASS, touch);
    const lenis = track?.firstElementChild
      ? new Lenis({
          wrapper: track,
          content: track.firstElementChild as HTMLElement,
          eventsTarget: root,
          smoothWheel: true,
          ...(touch ? { gestureOrientation: 'horizontal' as const, syncTouch: true, touchMultiplier: SCROLL.touchMultiplier } : {}),
          lerp: SCROLL.lerp,
          autoRaf: false,
        })
      : new Lenis({ lerp: SCROLL.lerp, smoothWheel: true, autoRaf: false });
    runtime.lenis = lenis;
    // El panel puede abrirse antes de que exista Lenis (al llegar con ?panel=): queda parado igual.
    if (getSnapshot().menuOpen) lenis.stop();
    runtime.invalidate = () => invalidate();
    const wake = () => invalidate();
    // Un gesto de scroll del usuario recoge la ficha abierta (los desplazamientos programados no).
    // Lo que se desliza por su cuenta (la cinta de piezas, el panel) no recorre la línea ni recoge nada.
    const own = (n: EventTarget) => n instanceof HTMLElement && (n.hasAttribute('data-lenis-prevent') || n.hasAttribute('data-lenis-prevent-touch'));
    lenis.on('virtual-scroll', ({ deltaX, deltaY, event }: { deltaX: number; deltaY: number; event: Event }) => {
      wake();
      if (event.composedPath().some(own)) return;
      const delta = touch ? deltaX : deltaY;
      if (Math.abs(delta) > 2) {
        if (getSnapshot().selected) setSelected(null);
        leaveIntro();
      }
    });
    lenis.on('scroll', wake);
    window.addEventListener('scroll', wake, { passive: true });
    // La pista mide 800vh: al girar el móvil (o cambiar el alto de la ventana) cambia su recorrido, y
    // el navegador recoloca su scroll nativo, con el que Lenis se vuelve a sincronizar. La cámara
    // saltaba a otra máquina con la ficha de la anterior abierta. El avance se guarda al empezar el
    // cambio de tamaño (antes de esa recolocación) y se mantiene hasta que se asienta.
    const onResize = () => {
      const h = held.current;
      if (h.progress === null) h.progress = runtime.progress;
      h.at = performance.now();
      invalidate();
    };
    window.addEventListener('resize', onResize);
    const restore = requestAnimationFrame(restoreView);
    const unlink = linkHash();
    invalidate();
    return () => {
      cancelAnimationFrame(restore);
      window.removeEventListener('resize', onResize);
      unlink();
      window.removeEventListener('scroll', wake);
      // Al salir de la portada (a un proyecto o al CV), esas páginas vuelven a desplazarse.
      root.classList.remove(LOCK_CLASS, TOUCH_CLASS);
      lenis.destroy();
      runtime.lenis = null;
      runtime.invalidate = () => {};
    };
  }, [invalidate]);

  /** Avance guardado durante un cambio de tamaño de la ventana (null fuera de él). */
  const held = useRef({ progress: null as number | null, at: 0 });

  /**
   * El encuadre del móvil sigue al hueco libre y a la presentación con un suavizado corto: el hueco
   * cambia a saltos (la ficha cambia de contenido) o con la transición de la ficha, y la cámara lo
   * acompaña sin brincos. Mientras no ha llegado, pide frames.
   */
  const followView = (now: number) => {
    const v = view.current;
    const target = runtime.view;
    if (!target) {
      v.ready = false;
      return;
    }
    const snap = getSnapshot();
    const intro = snap.intro && snap.selected === null && !snap.atExit ? 1 : 0;
    if (!v.ready) {
      Object.assign(v, target, { intro, ready: true, at: now });
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - v.at) / 1000));
    v.at = now;
    // Con «reducir movimiento», el encuadre salta a su sitio en lugar de acompañar a la ficha.
    if (REDUCED?.matches) {
      Object.assign(v, target, { intro });
      return;
    }
    const k = 1 - Math.exp(-FRAME_RATE * dt);
    let moving = false;
    for (const key of ['l', 't', 'r', 'b'] as const) {
      const d = target[key] - v[key];
      if (Math.abs(d) < 0.25) v[key] = target[key];
      else {
        v[key] += d * k;
        moving = true;
      }
    }
    const di = intro - v.intro;
    if (Math.abs(di) < 0.002) v.intro = intro;
    else {
      v.intro += di * (1 - Math.exp(-4.5 * dt));
      moving = true;
    }
    if (moving) requestAmbient();
  };

  const clock = useRef({ last: 0, time: 0, frame: 0 });
  useFrame(() => {
    const lenis = runtime.lenis;
    if (!lenis) return;
    // Al girar el móvil o cambiar el tamaño de la ventana se mantiene el avance guardado (ver `held`).
    const h = held.current;
    if (h.progress !== null) {
      if (performance.now() - h.at > RESIZE_SETTLE_MS) h.progress = null;
      else {
        if (lenis.limit > 0) lenis.scrollTo(h.progress * lenis.limit, { immediate: true, force: true });
        invalidate();
      }
    }
    const now = frameClock.now;
    const c = clock.current;
    // Con marcapasos a 2 solo se pinta un refresco de cada dos; el scroll sigue avanzando igual.
    c.frame++;
    runtime.skipFrame = runtime.pace > 1 && c.frame % runtime.pace !== 0;
    c.time += c.last ? Math.min(now - c.last, MAX_STEP_MS) : 1000 / 60;
    c.last = now;
    lenis.raf(c.time);
    // Sigue la inercia; si la cámara no llega a moverse un píxel entero, no hay nada que pintar.
    if (lenis.isScrolling === 'smooth') requestAmbient();

    const progress = lenis.limit > 0 ? Math.min(1, Math.max(0, lenis.animatedScroll / lenis.limit)) : 0;
    runtime.progress = progress;
    runtime.cameraX = cameraXAt(progress);
    if (compact.current) followView(now);
    place(runtime.cameraX);
    updateActive(runtime.cameraX);
    updateExit(runtime.cameraX);
    if (runtime.skipFrame) {
      // Frame no pintado: hay que asegurar el siguiente aunque el scroll ya se haya detenido.
      invalidate();
      return;
    }
    emitFrame();
  }, -2);

  // Frustum en px CSS (el zoom lo convierte en metros).
  return (
    <orthographicCamera
      ref={camRef}
      left={size.width / -2}
      right={size.width / 2}
      top={size.height / 2}
      bottom={size.height / -2}
      near={CAMERA.near}
      far={CAMERA.far}
    />
  );
}
