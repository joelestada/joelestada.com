'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { STATIONS, type StationId } from '@/config/stations';
import { getSnapshot, goToStation, resetFocus, runtime, setAutoFocus, setSceneHover, setSelected, wakeIn } from '@/lib/runtime';
import { bootActive } from './boot';
import { explode } from './explode';
import { HOLD_DELAY_MS, force, releaseForce, startForce } from './force';
import { frameClock } from './frameClock';
import { workTime } from './line/flow';

/** Velocidad de encendido y apagado del foco (1/s). */
const RISE = 4.2;
const FALL = 2.8;
/** En táctil se enciende sola la estación centrada si está a menos de esto (m). */
const AUTO_FOCUS_RANGE = 3.2;
/** Si el dedo o el cursor se mueve más que esto (px) mientras espera, no es mantener: es arrastrar. */
const HOLD_SLOP = 8;
/**
 * Con la cámara en marcha, el foco no salta de máquina en máquina bajo un cursor quieto: espera a
 * que el recorrido se asiente. Así el scroll no enciende y apaga focos a su paso y el foco se posa
 * donde el visitante se ha parado. Por lo mismo, un foco que se está encendiendo o apagando se
 * detiene mientras la cámara se mueve y termina al pararse: cada paso de luz cambia la nave entera
 * (el foco oscurece el resto) y obligaría a repintarla completa en pleno scroll.
 */
const SETTLE_MS = 140;

/**
 * Cursor → estación: rayo ortográfico contra el volumen de cada estación (sin el sistema
 * de eventos de R3F). Al pasar el cursor solo se enciende el foco: aquí se suaviza su
 * encendido y se piden frames mientras la luz sube o baja (con la luz quieta, ninguno).
 * Un clic abre la ficha; mantener pulsado sobre la máquina la lleva a plena potencia (force.ts).
 */
export function Interaction() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const boxes = useMemo(
    () =>
      STATIONS.map((s) => ({
        id: s.id,
        box: new THREE.Box3(
          new THREE.Vector3(s.x + s.hit.min[0], s.hit.min[1], s.hit.min[2]),
          new THREE.Vector3(s.x + s.hit.max[0], s.hit.max[1], s.hit.max[2]),
        ),
      })),
    [],
  );

  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches, []);
  const pointer = useRef({ x: 0, y: 0, inside: false, blocked: false });
  /** Estación bajo un punto de la pantalla (px CSS), o null. */
  const hitTest = useMemo(() => {
    const ray = new THREE.Ray();
    const hit = new THREE.Vector3();
    const axis = new THREE.Vector3();
    return (x: number, y: number) => {
      const cam = camera as THREE.OrthographicCamera;
      const nx = (x / size.width) * 2 - 1;
      const ny = 1 - (y / size.height) * 2;
      ray.origin.copy(cam.position);
      ray.origin.addScaledVector(axis.setFromMatrixColumn(cam.matrixWorld, 0), (nx * (cam.right - cam.left)) / 2 / cam.zoom);
      ray.origin.addScaledVector(axis.setFromMatrixColumn(cam.matrixWorld, 1), (ny * (cam.top - cam.bottom)) / 2 / cam.zoom);
      ray.direction.setFromMatrixColumn(cam.matrixWorld, 2).negate();
      let best: StationId | null = null;
      let bestT = Infinity;
      for (const { id, box } of boxes) {
        if (!ray.intersectBox(box, hit)) continue;
        const t = hit.distanceTo(ray.origin);
        if (t < bestT) {
          bestT = t;
          best = id;
        }
      }
      return best;
    };
  }, [camera, size, boxes]);
  const probe = useMemo(
    () => () => {
      const p = pointer.current;
      if (!p.inside || p.blocked || getSnapshot().menuOpen) {
        setSceneHover(null);
        return;
      }
      const best = hitTest(p.x, p.y);
      setSceneHover(best);
      document.documentElement.classList.toggle('is-pointing', best !== null);
    },
    [hitTest],
  );
  /** Pulsación en curso: la máquina, dónde empezó y si ya está forzada (su clic no abre la ficha). */
  const hold = useRef({ timer: 0, id: null as StationId | null, x: 0, y: 0, active: false, suppress: false });

  // Se entra y se sale de la línea sin focos heredados (ver resetFocus).
  useEffect(() => {
    resetFocus();
    return resetFocus;
  }, []);

  useEffect(() => {
    const p = pointer.current;
    /**
     * El gesto empezó sobre la interfaz (barra, ficha, globos…). Se mira la ruta del evento tal como era
     * al pulsar: un botón que la interfaz retira al pulsarlo (la ficha cambia de contenido) ya no está en
     * la página cuando el clic llega aquí, y se tomaba por un clic en vacío que recogía la ficha.
     */
    const fromUi = (e: Event) => e.composedPath().some((n) => n instanceof Element && n.hasAttribute('data-ui'));
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      p.x = e.clientX;
      p.y = e.clientY;
      p.inside = true;
      p.blocked = fromUi(e);
      probe();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      p.inside = false;
      probe();
    };
    // Mantener pulsado: tras una breve espera sin moverse, la máquina pasa a plena potencia.
    const h = hold.current;
    const endHold = () => {
      window.clearTimeout(h.timer);
      h.timer = 0;
      h.id = null;
      if (h.active) {
        h.active = false;
        h.suppress = true;
        releaseForce();
        invalidate();
      }
    };
    const onDown = (e: PointerEvent) => {
      h.suppress = false;
      if (e.button !== 0 || fromUi(e)) return;
      const snap = getSnapshot();
      if (snap.menuOpen || snap.exploded || explode.station || bootActive()) return;
      const id = hitTest(e.clientX, e.clientY);
      if (!id) return;
      window.clearTimeout(h.timer);
      h.id = id;
      h.x = e.clientX;
      h.y = e.clientY;
      h.timer = window.setTimeout(() => {
        h.timer = 0;
        // El robot no se fuerza a mitad de su gesto (llevaría la tapa en la mano).
        if (id === 'robotic' && workTime('robotic') >= 0) return;
        if (startForce(id)) {
          h.active = true;
          invalidate();
        }
      }, HOLD_DELAY_MS);
    };
    const onDrag = (e: PointerEvent) => {
      if (!h.id) return;
      if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) endHold();
    };
    // Mantener pulsado en el móvil no debe sacar el menú contextual.
    const onContext = (e: Event) => {
      if (h.id || force.held) e.preventDefault();
    };
    const onBlur = () => {
      p.inside = false;
      probe();
      endHold();
    };
    // Clic (o toque) en una máquina: centrarla y desplegar su ficha. En vacío: recoger la ficha.
    const onClick = (e: MouseEvent) => {
      if (h.suppress) {
        h.suppress = false;
        return;
      }
      if (fromUi(e)) return;
      p.x = e.clientX;
      p.y = e.clientY;
      p.inside = true;
      p.blocked = false;
      probe();
      const id = runtime.sceneHover;
      if (touch) {
        p.inside = false;
        setSceneHover(null);
      }
      if (id) goToStation(id, { select: true });
      else if (getSnapshot().selected) setSelected(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointermove', onDrag, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', endHold);
    window.addEventListener('pointercancel', endHold);
    window.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerout', onLeave);
    window.addEventListener('blur', onBlur);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', endHold);
      window.removeEventListener('pointercancel', endHold);
      window.removeEventListener('contextmenu', onContext);
      document.removeEventListener('pointerout', onLeave);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('click', onClick);
      document.documentElement.classList.remove('is-pointing');
      endHold();
    };
  }, [probe, hitTest, touch, invalidate]);

  const last = useRef({ t: 0, cameraX: NaN, movedAt: 0, pending: false });

  useFrame(() => {
    const now = frameClock.now;
    const l = last.current;
    const dt = l.t ? Math.min((now - l.t) / 1000, 1 / 30) : 1 / 60;
    l.t = now;

    // La cámara se ha movido bajo un cursor quieto: la estación bajo él puede cambiar, pero se mira
    // cuando el recorrido se asienta.
    if (runtime.cameraX !== l.cameraX) {
      const first = Number.isNaN(l.cameraX);
      l.cameraX = runtime.cameraX;
      l.movedAt = first ? -Infinity : now;
      l.pending = true;
    }
    if (l.pending) {
      const wait = SETTLE_MS - (now - l.movedAt);
      if (wait > 0) wakeIn(wait);
      else {
        l.pending = false;
        if (touch) {
          let nearest: StationId | null = null;
          for (const s of STATIONS) if (Math.abs(s.x - runtime.cameraX) < AUTO_FOCUS_RANGE) nearest = s.id;
          setAutoFocus(nearest);
        } else if (pointer.current.inside) {
          probe();
        }
      }
    }

    const focused = getSnapshot().focused;
    const moving = l.pending;
    let busy = false;
    for (const s of STATIONS) {
      const fx = runtime.fx[s.id];
      // La máquina abierta en vista explosionada queda con su foco encendido.
      const goal = focused === s.id || explode.station === s.id ? 1 : 0;
      if (fx.level === goal) continue;
      busy = true;
      if (moving) continue;
      fx.level += (goal - fx.level) * (1 - Math.exp(-(goal > fx.level ? RISE : FALL) * dt));
      if (Math.abs(goal - fx.level) < 0.002) fx.level = goal;
    }
    // En marcha, el propio recorrido pide los frames y `wakeIn` despierta al asentarse.
    if (busy && !moving) invalidate();
  }, -1);

  return null;
}
