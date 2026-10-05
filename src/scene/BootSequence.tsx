'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING } from '@/config/layout';
import { pageLang } from '@/i18n/lang';
import { uiIn } from '@/i18n/ui';
import { markFull, resumeScroll, runtime } from '@/lib/runtime';
import { BOOT, RISE, boot, bootHeld, hurryBoot, startBoot, stepBoot } from './boot';
import { frameClock } from './frameClock';

/** Paso máximo del reloj del arranque: un frame lento (un shader que compila) no se come la animación. */
const MAX_STEP = 1 / 30;
/** Si algo no llega a cargar, el arranque empieza igual pasado este tiempo (ms). */
const READY_TIMEOUT = 2500;
/** La interfaz queda con su transición de entrada hasta este tiempo (ms). */
const UI_IN_MS = 1500;

/** Rótulo del pie durante el arranque: [desde (s), texto], en el idioma de la página. El primero se ve mientras carga. */
const stages = (): [number, string][] => {
  const t = uiIn(pageLang()).boot;
  return [
    [-Infinity, t.loading],
    [0, t.drawing],
    [BOOT.color[0], t.building],
    [BOOT.shutter[0], t.powering],
    [BOOT.plant, t.running],
  ];
};

/**
 * Tramo de la coordenada de avance (x + RISE·y) que se ve: una rejilla de rayos por la vista hasta la
 * primera superficie grande (suelo o muro). Así los frentes recorren justo lo que hay en pantalla.
 */
function visibleRange(camera: THREE.Camera): [number, number] {
  const cam = camera as THREE.OrthographicCamera;
  cam.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar((cam.right - cam.left) / 2 / cam.zoom);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar((cam.top - cam.bottom) / 2 / cam.zoom);
  const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
  const o = new THREE.Vector3();
  const p = new THREE.Vector3();
  let lo = Infinity;
  let hi = -Infinity;
  const N = 8;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      o.copy(cam.position)
        .addScaledVector(right, (i / N) * 2 - 1)
        .addScaledVector(up, (j / N) * 2 - 1);
      let t = -o.y / fwd.y;
      p.copy(o).addScaledVector(fwd, t);
      // Muro de la persiana hasta el retranqueo; más allá, el del fondo.
      const wallZ = p.x < BUILDING.stepX ? BUILDING.doorWallZ : BUILDING.backWallZ;
      if (p.z < wallZ) {
        t = (wallZ - o.z) / fwd.z;
        p.copy(o).addScaledVector(fwd, t);
      }
      if (p.y > BUILDING.wallHeight) continue;
      const s = p.x + RISE * p.y;
      lo = Math.min(lo, s);
      hi = Math.max(hi, s);
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [-10, 30];
}

/** Rótulo de estado del pie de la lámina (se escribe directamente: no hay que repintar React). */
function setStatus(text: string, progress: number) {
  const el = document.querySelector<HTMLElement>('.boot-status');
  if (!el) return;
  el.style.setProperty('--boot', progress.toFixed(3));
  const label = el.querySelector<HTMLElement>('.boot-status__label');
  if (!label || label.textContent === text) return;
  label.textContent = text;
  // Reinicia la entrada del rótulo.
  label.classList.remove('is-new');
  void label.offsetWidth;
  label.classList.add('is-new');
}

/** La interfaz entra (barra, pie, ficha, globos) con su transición y se retira la del arranque. */
function revealUi() {
  const root = document.documentElement;
  // La línea de referencia se vuelve a trazar mientras entra la ficha.
  window.dispatchEvent(new Event('factory:ui-in'));
  root.classList.add('boot-in');
  root.classList.remove('boot');
  window.setTimeout(() => root.classList.remove('boot-in'), UI_IN_MS);
}

/**
 * Conduce el arranque de la nave (ver boot.ts): espera a que la escena esté lista y pintada una
 * vez (fuentes cargadas, shaders compilados), cuenta el tiempo y pide frames hasta el final.
 */
export function BootSequence() {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const ready = useRef(false);
  const mounted = useRef(0);
  const last = useRef(0);
  const shown = useRef(false);
  const STAGES = useRef(stages()).current;

  useEffect(() => {
    mounted.current = performance.now();
    if (boot.phase !== 'wait') return;
    let alive = true;
    // Fuentes de la interfaz y de las pantallas; los rótulos de la escena se esperan aparte (holdBoot).
    const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
    const timeout = new Promise<void>((res) => window.setTimeout(res, READY_TIMEOUT));
    const since = performance.now();
    Promise.race([fonts, timeout]).then(() => {
      if (!alive) return;
      ready.current = true;
      invalidate();
    });
    // Los rótulos avisan al sincronizar (invalidan); por si alguno no llega, un tope.
    const poll = window.setInterval(() => {
      if (!bootHeld() || performance.now() - since > READY_TIMEOUT) {
        window.clearInterval(poll);
        invalidate();
      }
    }, 100);
    // Cualquier gesto acelera el resto del arranque.
    const onInput = () => hurryBoot();
    const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    inputs.forEach((t) => window.addEventListener(t, onInput, { passive: true }));
    return () => {
      alive = false;
      window.clearInterval(poll);
      inputs.forEach((t) => window.removeEventListener(t, onInput));
    };
  }, [invalidate]);

  useFrame(() => {
    if (boot.phase === 'wait') {
      // Primero un par de frames en blanco: compilan los shaders sin comerse la animación.
      const held = bootHeld() && performance.now() - mounted.current < READY_TIMEOUT;
      if (!ready.current || held || runtime.drawn < 2) {
        if (ready.current && !held) invalidate();
        return;
      }
      last.current = frameClock.now;
      // Mientras se dibuja, el scroll no mueve la cámara (un gesto acelera el arranque).
      if (startBoot(visibleRange(camera))) runtime.lenis?.stop();
    }
    if (boot.phase !== 'run') return;
    const now = frameClock.now;
    const dt = Math.min((now - last.current) / 1000, MAX_STEP);
    last.current = now;
    const ended = stepBoot(dt);

    let text = STAGES[0][1];
    for (const [from, label] of STAGES) if (boot.t >= from) text = label;
    setStatus(text, Math.min(1, boot.t / BOOT.end));
    if (!shown.current && (boot.t >= BOOT.ui || ended)) {
      shown.current = true;
      revealUi();
    }
    if (ended) {
      resumeScroll();
      markFull();
    }
    invalidate();
  }, -2.5);

  return null;
}
