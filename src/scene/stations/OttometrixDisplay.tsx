'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE, STATION_X, type Vec3 } from '@/config/layout';
import { palette } from '@/config/palette';
import { PARTS } from '@/config/parts';
import { STATION_BY_ID } from '@/config/stations';
import { markDirty, runtime, wakeIn } from '@/lib/runtime';
import { SCAN, easeInOut, flow, workTime } from '../line/flow';
import { force, forceLevel } from '../force';
import { animateRegions, regionOnScreen, type Region } from '../kit/regions';
import { hash, lifeRunning, lifeTime } from '../life/clock';
import { DECAL_LAYER } from '../materials';
import { Explode } from '../kit/Explode';
import { PendantLamp } from '../kit/PendantLamp';
import { createScreenTexture } from './screenArt';
import { Chair, Console } from './display/Console';
import { LIFT_TILES, RACK, SCREEN } from './display/dims';
import { RaisedFloor, Tile, UnderFloor } from './display/Floor';
import { LED_BOX, NetworkSwitch, RackFrame, SERVER_Y, Server, Ups } from './display/Rack';
import { Camera, Module, Readout, Stand, WallController, type ReadoutState } from './display/Wall';

const STATION = STATION_BY_ID.display;
/** Piezas de la vista explosionada. */
const P = PARTS.display;

/** Brillo de la pantalla en reposo (1 = encendida del todo). */
const IDLE = 0.86;
/** Zonas que se mueven: pantalla (con la lectura) y pilotos del rack. */
const RACK_REGION: Region = [RACK.x1 - 0.2, LED_BOX.y0, RACK.z1 - 0.02, RACK.x1, LED_BOX.y1, RACK.z1 + 0.02];
const REGIONS: Region[] = [[-2.35, 1.3, -2.7, 2.35, 4.0, -2.35], RACK_REGION];

/** Lectura en curso: intensidad (0..1) y tiempo (s), compartidos por la pantalla y el rack. */
const scan = { level: 0, time: 0 };

/** Punto de LIVE de la pantalla (px del lienzo → m) y su parpadeo lento: encendido, apagado (s). */
const LIVE_DOT = { u: 66 / 1600, v: 804 / 900, r: 0.028 };
const LIVE_BLINK = { on: 1.5, off: 0.5 };
/** Pilotos del rack en reposo: un par titilan como actividad de disco (cambio cada 0,2 s). */
const RACK_STEP_S = 0.2;

/**
 * Despiece del videowall: cada módulo sale hacia delante y se aparta del centro (la pantalla se
 * abre en rejilla y deja ver los travesaños); primero el del centro, luego la cruz y las esquinas.
 */
const SPREAD = { x: 0.34, y: 0.26, z: 0.3, wave: 0.06 };
const MODULES = Array.from({ length: SCREEN.cols * SCREEN.rows }, (_, i) => {
  const col = i % SCREEN.cols;
  const row = Math.floor(i / SCREEN.cols);
  const [dx, dy] = [col - 1, row - 1];
  return { col, row, to: [dx * SPREAD.x, dy * SPREAD.y, SPREAD.z] as Vec3, delay: (Math.abs(dx) + Math.abs(dy)) * SPREAD.wave };
});

/**
 * Lectura de cada pieza: sus cuatro factores (percentiles, como los del motor) salen de la propia
 * lectura. Al empezar, la anterior se recoge; luego cada factor rellena su cuarto de barra, uno
 * tras otro, y al final la marca amarilla se coloca en la nota (la media de los cuatro).
 */
const READING = { clear: [SCAN.start, 600], fill: 600, stagger: 320, fillMs: 520, score: 1900, scoreMs: 700 } as const;
const factorsOf = (seed: number) => [0, 1, 2, 3].map((i) => 0.24 + 0.72 * hash(seed * 4.17 + i * 13.3 + 1));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function readAt(t: number, prev: number[], next: number[], out: ReadoutState) {
  const [c0, c1] = READING.clear;
  if (t < c1) {
    const k = 1 - easeInOut((t - c0) / (c1 - c0));
    prev.forEach((v, i) => (out.fills[i] = v * k));
    out.score = mean(prev) * k;
    return;
  }
  next.forEach((v, i) => (out.fills[i] = v * easeInOut((t - READING.fill - i * READING.stagger) / READING.fillMs)));
  out.score = mean(next) * easeInOut((t - READING.score) / READING.scoreMs);
}

/** Indicador LIVE de la pantalla grande: parpadea despacio mientras la planta está en marcha. */
function LiveDot() {
  const { w, h, y0, z } = SCREEN;
  const mesh = useRef<THREE.Mesh>(null);
  const state = useRef<boolean | null>(null);
  const colors = useMemo(() => ({ on: new THREE.Color(palette.andonGreen), off: new THREE.Color(palette.screenDeep) }), []);
  const x = -w / 2 + LIVE_DOT.u * w;
  const y = y0 + h - LIVE_DOT.v * h;
  const region: Region = [x - 0.06, y - 0.06, z - 0.02, x + 0.06, y + 0.06, z + 0.03];

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const visible = regionOnScreen(region, STATION_X.display);
    if (state.current !== null && (!visible || !lifeRunning())) return;
    const period = LIVE_BLINK.on + LIVE_BLINK.off;
    const t = lifeTime(flow.now) % period;
    const on = t < LIVE_BLINK.on;
    if (on !== state.current) {
      state.current = on;
      (m.material as THREE.MeshBasicMaterial).color.copy(on ? colors.on : colors.off);
      animateRegions([region], STATION_X.display, false);
    }
    if (visible) wakeIn(((on ? LIVE_BLINK.on : period) - t) * 1000);
  });

  return (
    <mesh ref={mesh} position={[x, y, z + 0.009]} layers={DECAL_LAYER} renderOrder={2}>
      <circleGeometry args={[LIVE_DOT.r, 16]} />
      <meshBasicMaterial color={palette.andonGreen} />
    </mesh>
  );
}

const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const screenFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform float uLevel;
  uniform float uTime;
  uniform float uIdle;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv).rgb * mix(uIdle, 1.06, uLevel);
    // Barrido de refresco de arriba abajo mientras la estación está activa.
    float y = fract(uTime * 0.32) * 1.3 - 0.15;
    float band = exp(-pow((1.0 - vUv.y - y) * 16.0, 2.0));
    c += band * uLevel * vec3(0.05, 0.07, 0.065);
    // Alfa 0 marca la superficie como emisiva para el pase de composición.
    gl_FragColor = vec4(c, 0.0);
    #include <colorspace_fragment>
  }
`;

/** Servidores del rack: en la vista explosionada salen como cajones, en cascada de arriba abajo. */
const CASCADE = 0.05;

/** Servidores con sus pilotos de actividad: parpadean con la estación activa y titilan en reposo. */
function RackServers() {
  const materials = useMemo(() => SERVER_Y.flatMap(() => [0, 1].map(() => new THREE.MeshBasicMaterial({ color: palette.andonGreen }))), []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const dim = useMemo(() => new THREE.Color(palette.metalDark), []);
  const green = useMemo(() => new THREE.Color(palette.andonGreen), []);
  const amber = useMemo(() => new THREE.Color(palette.andonAmber), []);
  const last = useRef('');
  // Después de la estación (prioridad 0), que calcula la lectura de este frame.
  useFrame(() => {
    const { level, time } = scan;
    const visible = regionOnScreen(RACK_REGION, STATION_X.display);
    // En reposo, un par de pilotos ámbar titilan (actividad de disco) mientras la planta corre.
    const idle = level === 0 && lifeRunning() && visible;
    const step = idle ? Math.floor(lifeTime(flow.now) / RACK_STEP_S) : -1;
    const key = `${level.toFixed(3)}|${time.toFixed(2)}|${step}`;
    if (key === last.current) return;
    last.current = key;
    materials.forEach((m, i) => {
      const base = i % 2 === 0 ? green : amber;
      const blink = Math.sin(time * (5 + ((i * 7) % 5)) + i * 2.3) > 0.1 ? 1 : 0.15;
      const disk = step >= 0 && i % 2 === 1 && hash(step * 31 + i * 7) > 0.86 ? 0.7 : 0;
      m.color.lerpColors(dim, base, i % 2 === 0 ? 0.55 + 0.45 * (1 - level + level * blink) : Math.max(level * blink, disk));
    });
    if (level === 0) animateRegions([RACK_REGION], STATION_X.display, false);
    if (idle) wakeIn((step + 1) * RACK_STEP_S * 1000 - lifeTime(flow.now) * 1000);
  }, 0.5);

  return (
    <group>
      {SERVER_Y.map((y, i) => (
        <Explode key={i} station="display" part={P.servers} delay={i * CASCADE} callout={i === 0}>
          <Server y={y} leds={[materials[i * 2], materials[i * 2 + 1]]} />
        </Explode>
      ))}
    </group>
  );
}

/**
 * Estación 03: puesto de Ottometrix sobre suelo técnico. Videowall de 3 × 3 con el logo y, debajo,
 * la lectura de cada pieza; consola con el operador y rack de servidores. Cuando llega una pieza sube
 * el brillo, la pantalla barre y lee sus cuatro factores.
 */
export function OttometrixDisplay() {
  const idle = useRef(false);
  const readout = useMemo<ReadoutState>(() => {
    const v = factorsOf(7);
    return { fills: [...v], score: mean(v) };
  }, []);
  /** Lectura: la pieza anterior y la que se está leyendo (y el inicio de su trabajo, para notar una nueva). */
  const reading = useRef({ start: -1, prev: factorsOf(7), next: factorsOf(7), cycle: -1 });

  // Al cargar la fuente de los rótulos se repinta la pantalla.
  const texture = useMemo(
    () =>
      createScreenTexture(() => {
        const [x0, y0s, z0, x1, y1, z1] = REGIONS[0];
        markDirty(STATION_X.display + x0, y0s, z0, STATION_X.display + x1, y1, z1);
        runtime.invalidate();
      }),
    [],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          tMap: { value: texture },
          uLevel: { value: 0 },
          uTime: { value: 0 },
          uIdle: { value: IDLE },
        },
        vertexShader: screenVertex,
        fragmentShader: screenFragment,
      }),
    [texture],
  );
  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );

  useFrame(() => {
    const t = workTime('display');
    // Mantenida pulsada: lectura a tope, con su barrido, y una pieza tras otra.
    const f = forceLevel('display');
    if (t < 0 && f === 0 && idle.current) return;
    idle.current = t < 0 && f === 0;
    let level = 0;
    if (t >= 0) {
      if (t < SCAN.up) level = easeInOut((t - SCAN.start) / (SCAN.up - SCAN.start));
      else if (t < SCAN.down) level = 1;
      else level = 1 - easeInOut((t - SCAN.down) / (SCAN.end - SCAN.down));
    }
    level = Math.max(level, f);
    const time = t >= 0 ? t / 1000 : force.time;
    scan.level = level;
    scan.time = time;
    material.uniforms.uLevel.value = level;
    material.uniforms.uTime.value = time;

    const r = reading.current;
    if (t >= 0) {
      if (flow.work.display !== r.start) {
        r.start = flow.work.display;
        r.prev = r.next;
        r.next = factorsOf(Math.round(r.start));
      }
      readAt(t, r.prev, r.next, readout);
    } else if (f > 0) {
      const ms = force.time * 1000;
      const cycle = Math.floor(ms / SCAN.end);
      if (cycle !== r.cycle) {
        r.cycle = cycle;
        r.prev = r.next;
        r.next = factorsOf(cycle + 1000);
      }
      readAt(ms - cycle * SCAN.end, r.prev, r.next, readout);
    } else readAt(Infinity, r.next, r.next, readout);
    animateRegions(REGIONS, STATION_X.display, t >= 0 || f > 0);
  });

  return (
    <group position={[STATION_X.display, 0, LINE.axisZ]}>
      {/* Suelo técnico: unas baldosas se levantan en el despiece y dejan ver la bandeja de cables. */}
      <Explode station="display" part={P.floor}>
        <RaisedFloor />
        <UnderFloor />
      </Explode>
      {LIFT_TILES.map(([k, row], i) => (
        <Explode key={`${k}-${row}`} station="display" part={P.tiles} delay={i * 0.06} callout={i === 0}>
          <Tile k={k} r={row} />
        </Explode>
      ))}
      <Explode station="display" part={P.stand}>
        <Stand />
      </Explode>
      <Explode station="display" part={P.controller}>
        <WallController />
      </Explode>
      <Explode station="display" part={P.camera}>
        <Camera />
      </Explode>
      {MODULES.map(({ col, row, to, delay }) => (
        <Explode key={`${col}-${row}`} station="display" part={P.panels} to={to} delay={delay} callout={col === 1 && row === 1}>
          <Module col={col} row={row} material={material} />
          {col === 0 && row === 0 && <LiveDot />}
          {col === 1 && row === 0 && <Readout state={readout} />}
        </Explode>
      ))}
      <Explode station="display" part={P.console}>
        <Console />
        <Chair />
      </Explode>
      <Explode station="display" part={P.rack}>
        <RackFrame />
      </Explode>
      <RackServers />
      <Explode station="display" part={P.switch}>
        <NetworkSwitch />
      </Explode>
      <Explode station="display" part={P.ups}>
        <Ups />
      </Explode>
      <PendantLamp position={STATION.lamp} station="display" />
    </group>
  );
}
