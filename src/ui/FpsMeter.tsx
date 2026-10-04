'use client';

import { useEffect, useRef, useState } from 'react';
import { runtime } from '@/lib/runtime';

const KEY = 'factory:fps';
/** Intervalos que guarda la gráfica (≈3 s a 60 Hz). */
const SAMPLES = 180;
/** Techo de la gráfica, en ms: un salto mayor se dibuja a tope. */
const CEIL = 50;

/**
 * Medidor de fluidez en directo, para comprobar a mano en cada pantalla y navegador lo que las
 * pruebas automáticas no ven. Se activa con la tecla F o con `?fps` en la dirección (y se recuerda
 * en la pestaña). Mide lo que se nota como tirón: el tiempo entre fotogramas del navegador, los
 * fotogramas perdidos (un intervalo de más de 1,5 refrescos) y el peor salto, más cuántos frames
 * pinta de verdad la escena por segundo. Además, el movimiento de la imagen fotograma a fotograma
 * (gráfica de abajo): un tirón que no es un fotograma perdido sino un avance a trompicones, como el
 * zigzag de dar un paso en horizontal y otro en vertical en frames distintos (en rojo). Un toque lo
 * pone a cero.
 */
export function FpsMeter() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let stored = false;
    try {
      stored = sessionStorage.getItem(KEY) === '1';
    } catch {}
    setOn(stored || new URLSearchParams(window.location.search).has('fps'));
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.key !== 'f' && e.key !== 'F')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      setOn((v) => {
        try {
          sessionStorage.setItem(KEY, v ? '0' : '1');
        } catch {}
        return !v;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return on ? <Meter /> : null;
}

function Meter() {
  const graph = useRef<HTMLCanvasElement>(null);
  const motion = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLPreElement>(null);
  const reset = useRef(() => {});

  useEffect(() => {
    const canvas = graph.current;
    const mc = motion.current;
    const out = text.current;
    if (!canvas || !mc || !out) return;
    const ctx = canvas.getContext('2d')!;
    const mctx = mc.getContext('2d')!;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--paper').trim();
    const bad = css.getPropertyValue('--alert').trim();
    const dim = css.getPropertyValue('--metal').trim();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    mc.width = Math.round(mc.clientWidth * dpr);
    mc.height = Math.round(mc.clientHeight * dpr);
    // Movimiento de la imagen: cuánto se desplaza un punto fijo de la nave en cada frame (px de
    // dispositivo) y si ese frame solo se movió en vertical (el zigzag).
    const moves = new Float32Array(SAMPLES);
    const zigs = new Uint8Array(SAMPLES);
    let prev: [number, number] | null = null;
    let zigzag = 0;
    let moving = 0;

    const dts = new Float32Array(SAMPLES);
    let head = 0;
    let last = 0;
    let frames = 0;
    let drawnAt = runtime.drawn;
    let windowStart = performance.now();
    let missed = 0;
    let worst = 0;
    let total = 0;
    let refresh = 1000 / 60;
    let raf = 0;
    reset.current = () => {
      missed = 0;
      worst = 0;
      total = 0;
      zigzag = 0;
      moving = 0;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (last) {
        const dt = now - last;
        dts[head] = dt;
        head = (head + 1) % SAMPLES;
        total++;
        // Un intervalo de más de 1,5 refrescos es al menos un fotograma perdido.
        if (dt > refresh * 1.5) missed++;
        if (total > 10) worst = Math.max(worst, dt);
      }
      last = now;
      frames++;

      const pr = runtime.project;
      if (pr) {
        const [x, y] = pr(10, 0, 0);
        const dx = prev ? Math.round((x - prev[0]) * dpr) : 0;
        const dy = prev ? Math.round((y - prev[1]) * dpr) : 0;
        prev = [x, y];
        const slot = (head + SAMPLES - 1) % SAMPLES;
        moves[slot] = Math.hypot(dx, dy);
        zigs[slot] = dx === 0 && dy !== 0 ? 1 : 0;
        if (dx || dy) moving++;
        if (zigs[slot]) zigzag++;
      }

      // Gráfica: una barra por intervalo, de izquierda (antiguo) a derecha (reciente).
      const w = canvas.width;
      const h = canvas.height;
      const bw = w / SAMPLES;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dim;
      ctx.fillRect(0, h - (refresh / CEIL) * h, w, Math.max(1, dpr)); // línea del refresco
      for (let i = 0; i < SAMPLES; i++) {
        const dt = dts[(head + i) % SAMPLES];
        if (!dt) continue;
        const bh = Math.min(1, dt / CEIL) * h;
        ctx.fillStyle = dt > refresh * 1.5 ? bad : ink;
        ctx.fillRect(i * bw, h - bh, Math.max(1, bw - dpr * 0.5), bh);
      }

      // Movimiento: una barra por frame (0–6 px de dispositivo); en rojo, los pasos solo en vertical.
      const mw = mc.width;
      const mh = mc.height;
      const mb = mw / SAMPLES;
      mctx.clearRect(0, 0, mw, mh);
      for (let i = 0; i < SAMPLES; i++) {
        const k = (head + i) % SAMPLES;
        const m = moves[k];
        if (!m) continue;
        const bh = Math.max(dpr, Math.min(1, m / 6) * mh);
        mctx.fillStyle = zigs[k] ? bad : ink;
        mctx.fillRect(i * mb, mh - bh, Math.max(1, mb - dpr * 0.5), bh);
      }

      // Texto, cuatro veces por segundo.
      const span = now - windowStart;
      if (span >= 250) {
        const fps = (frames * 1000) / span;
        const scene = ((runtime.drawn - drawnAt) * 1000) / span;
        // El refresco de la pantalla: la mediana de los últimos intervalos (60 o 120 Hz).
        const recent = Array.from(dts)
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (recent.length > 30) refresh = recent[Math.floor(recent.length * 0.5)];
        out.textContent =
          `FPS    ${fps.toFixed(0).padStart(3)}   ${(1000 / refresh).toFixed(0)} Hz\n` +
          `SCENE  ${scene.toFixed(0).padStart(3)}/s  pace ${runtime.pace}\n` +
          `MISSED ${String(missed).padStart(3)}   worst ${worst.toFixed(0)} ms\n` +
          `ZIGZAG ${String(zigzag).padStart(3)}   of ${moving} moves\n` +
          `${window.innerWidth}×${window.innerHeight} @${dpr}`;
        frames = 0;
        drawnAt = runtime.drawn;
        windowStart = now;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <button type="button" className="fps" onClick={() => reset.current()} aria-label="Frame meter: tap to reset" data-ui>
      <pre ref={text} className="fps__text" />
      <canvas ref={graph} className="fps__graph" aria-hidden />
      <canvas ref={motion} className="fps__graph fps__graph--motion" aria-hidden />
    </button>
  );
}
