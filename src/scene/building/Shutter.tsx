'use client';

import { useMemo, useRef } from 'react';
import { pageLang } from '@/i18n/lang';
import { uiIn } from '@/i18n/ui';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILDING, DOOR } from '@/config/layout';
import { palette } from '@/config/palette';
import { SITE } from '@/config/site';
import { DECAL_LAYER, dimmed, flat, toon } from '../materials';
import { Block, Box, Cyl, Merge, nextInkId } from '../kit/primitives';
import { Bollard } from './Bollard';
import { SceneText } from '../kit/SceneText';
import { boot } from '../boot';

const WZ = BUILDING.doorWallZ;
const GW = DOOR.guideWidth;
const WIDTH = DOOR.x1 - DOOR.x0;
const CX = (DOOR.x0 + DOOR.x1) / 2;
/** Plano medio de las lamas, dentro de las guías. */
const SLAT_Z = WZ + 0.05;
/**
 * Rótulo pintado justo delante de la cara de las lamas (que sobresale 0,018): sin salto de
 * profundidad, el trazo de tinta no contornea las letras (se veía en el dibujo del arranque).
 */
const PAINT_Z = SLAT_Z + 0.022;
/** Rótulo de la persiana: nombre grande y, debajo, «PORTAFOLIO» espaciado al ancho del nombre. */
const NAME_SIZE = 1.86;
const NAME_Y = 2.93;
/** Bajo el nombre, «portfolio» en el idioma de la página. */
const SUBTITLE = () => uiIn(pageLang()).scene.shutter;
const SUBTITLE_SIZE = 0.4;
const SUBTITLE_Y = 1.86;
const SUBTITLE_SPACING = 0.52;

/**
 * Perfil de lama: bisel superior (mira arriba, tono claro), cara principal (tono medio)
 * y bisel inferior (mira abajo, tono oscuro). Los pliegues dan una línea fina por lama.
 */
function slatGeometry() {
  const h = DOOR.slatPitch;
  const shape = new THREE.Shape();
  shape.moveTo(-0.012, 0);
  shape.lineTo(0.004, 0);
  shape.lineTo(0.018, 0.016);
  shape.lineTo(0.018, h - 0.026);
  shape.lineTo(0.0, h);
  shape.lineTo(-0.012, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: WIDTH + 0.06, bevelEnabled: false });
  // Forma en (Z, Y) → extrusión a lo largo de X.
  g.rotateY(-Math.PI / 2);
  g.translate((WIDTH + 0.06) / 2, 0, 0);
  return g;
}

/** Lamas de la persiana cerrada del todo: al subir, las de arriba entran en el cajón y se ocultan. */
const SLATS = Math.ceil(DOOR.openingHeight / DOOR.slatPitch);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Borde inferior de las lamas con la persiana abierta la fracción `open` (0 cerrada). */
const slatBottom = (open: number) => DOOR.slatBottom * open;

function placeSlats(mesh: THREE.InstancedMesh, bottom: number, m: THREE.Matrix4) {
  for (let i = 0; i < SLATS; i++) {
    const y = bottom + i * DOOR.slatPitch;
    // Dentro del cajón ya no se ven: fuera, para que no asomen por encima.
    if (y > DOOR.openingHeight + 0.3) mesh.setMatrixAt(i, HIDDEN);
    else mesh.setMatrixAt(i, m.makeTranslation(CX, y, SLAT_Z));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Zona iluminada: franja exterior bajo el hueco (fija) y trapecio de luz hacia dentro (crece al abrir). */
function litGeometry() {
  const y = 0.003;
  const inner = DOOR.litDepth;
  const quad = (p0: number[], p1: number[], p2: number[], p3: number[]) => {
    const pos: number[] = [];
    for (const p of [p0, p2, p1, p0, p3, p2]) pos.push(p[0], y, p[1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  };
  // El trapecio va en z local desde el muro: se escala en z con la apertura.
  return {
    outside: quad([DOOR.x0, WZ - 3.5], [DOOR.x1, WZ - 3.5], [DOOR.x1, WZ], [DOOR.x0, WZ]),
    inside: quad([DOOR.x0, 0], [DOOR.x1, 0], [DOOR.x1 + 0.9, inner], [DOOR.x0 - 0.15, inner]),
  };
}

/**
 * Persiana enrollable a medio subir con "JOEL" en stencil, en el muro del fondo. En el arranque de
 * la nave empieza cerrada y sube a su altura: la luz de fuera entra con ella.
 */
export function Shutter() {
  const lit = useMemo(litGeometry, []);
  const boxId = useMemo(nextInkId, []);
  const top = DOOR.openingHeight;
  const bh = DOOR.boxHeight;
  const br = bh / 2;
  const slats = useRef<THREE.InstancedMesh>(null);
  const leaf = useRef<THREE.Group>(null);
  const light = useRef<THREE.Mesh>(null);
  const geometry = useMemo(slatGeometry, []);
  const shown = useRef(NaN);
  const m = useMemo(() => new THREE.Matrix4(), []);

  // Solo se mueve en el arranque; el resto del tiempo esto no hace nada.
  useFrame(() => {
    const open = boot.shutter;
    if (open === shown.current) return;
    shown.current = open;
    const bottom = slatBottom(open);
    if (slats.current) placeSlats(slats.current, bottom, m);
    leaf.current?.position.set(0, bottom - DOOR.slatBottom, 0);
    if (light.current) {
      light.current.scale.z = Math.max(0.001, open);
      light.current.visible = open > 0.001;
    }
  });

  return (
    <group>
      <Merge>
        {/* Guías laterales. */}
        <Block min={[DOOR.x0 - GW, 0, WZ]} max={[DOOR.x0 + 0.02, top, WZ + 0.16]} c={palette.metalLight} />
        <Block min={[DOOR.x1 - 0.02, 0, WZ]} max={[DOOR.x1 + GW, top, WZ + 0.16]} c={palette.metalLight} />
        {/* Cajón de enrollamiento: cuerpo + frente redondeado. */}
        <Block min={[DOOR.x0 - GW, top, WZ]} max={[DOOR.x1 + GW, top + bh, WZ + DOOR.boxDepth - br]} c={palette.metalLight} id={boxId} />
        <Cyl p={[CX, top + br, WZ + DOOR.boxDepth - br]} radius={br} length={WIDTH + 2 * GW} axis="x" c={palette.metalLight} id={boxId} segments={28} />
        {/* Motor en el extremo del cajón. */}
        <Block min={[DOOR.x0 - GW - 0.42, top + 0.06, WZ]} max={[DOOR.x0 - GW, top + bh - 0.04, WZ + 0.38]} c={palette.metalMid} />
        <Cyl p={[DOOR.x0 - GW - 0.44, top + bh / 2, WZ + 0.2]} radius={0.15} length={0.05} axis="x" c={palette.metalLight} />
        {/* Caja de mando en la pared y su tubo. */}
        <Block min={[DOOR.x0 - GW - 1.02, 1.12, WZ]} max={[DOOR.x0 - GW - 0.66, 1.6, WZ + 0.14]} c={palette.metalLight} />
        <Block min={[DOOR.x0 - GW - 0.96, 1.42, WZ + 0.14]} max={[DOOR.x0 - GW - 0.72, 1.54, WZ + 0.15]} c={palette.screen} />
        {/* Pilotos: encendido el verde de «disponible para nuevos proyectos» (o el rojo, si no). */}
        <Cyl
          p={[DOOR.x0 - GW - 0.9, 1.3, WZ + 0.155]}
          radius={0.028}
          length={0.03}
          axis="z"
          c={SITE.available ? palette.andonGreen : dimmed(palette.andonGreen)}
        />
        <Cyl
          p={[DOOR.x0 - GW - 0.78, 1.3, WZ + 0.155]}
          radius={0.028}
          length={0.03}
          axis="z"
          c={SITE.available ? dimmed(palette.andonRed) : palette.andonRed}
        />
        <Cyl p={[DOOR.x0 - GW - 0.84, 1.2, WZ + 0.155]} radius={0.022} length={0.03} axis="z" c={dimmed(palette.andonAmber)} />
        <Cyl p={[DOOR.x0 - GW - 0.84, (1.6 + top + 0.3) / 2, WZ + 0.04]} radius={0.022} length={top + 0.3 - 1.6} c={palette.metalMid} />
        {/* Bolardos a los lados de la puerta. */}
        <Bollard position={[DOOR.x0 - GW - 0.3, 0, WZ + 0.32]} />
        <Bollard position={[DOOR.x1 + GW + 0.95, 0, WZ + 0.45]} />
        <Bollard position={[DOOR.x1 + GW + 1.75, 0, WZ + 0.45]} />
      </Merge>
      <instancedMesh
        ref={(mesh) => {
          slats.current = mesh;
          if (mesh && Number.isNaN(shown.current)) placeSlats(mesh, slatBottom(boot.shutter), m);
        }}
        args={[geometry, toon(palette.metalMid), SLATS]}
        frustumCulled={false}
      />
      {/* Hoja: barra inferior con tirador y rótulo, que suben con las lamas. */}
      <group ref={leaf} position={[0, slatBottom(boot.shutter) - DOOR.slatBottom, 0]}>
        <Merge>
          <Block min={[DOOR.x0, DOOR.slatBottom - 0.08, WZ + 0.02]} max={[DOOR.x1, DOOR.slatBottom, WZ + 0.1]} c={palette.metalMid} />
          <Box p={[CX, DOOR.slatBottom - 0.1, WZ + 0.12]} s={[0.36, 0.035, 0.05]} c={palette.metalMid} />
        </Merge>
        <SceneText
          fontSize={NAME_SIZE}
          position={[CX - 0.05, NAME_Y, PAINT_Z]}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.02}
          color={palette.ink}
          layers={DECAL_LAYER}
        >
          JOEL
        </SceneText>
        <SceneText
          fontSize={SUBTITLE_SIZE}
          position={[CX - 0.05 + (SUBTITLE_SIZE * SUBTITLE_SPACING) / 2, SUBTITLE_Y, PAINT_Z]}
          anchorX="center"
          anchorY="middle"
          letterSpacing={SUBTITLE_SPACING}
          color={palette.ink}
          layers={DECAL_LAYER}
        >
          {SUBTITLE()}
        </SceneText>
      </group>
      <mesh geometry={lit.outside} material={flat(palette.floorLit)} layers={DECAL_LAYER} />
      <mesh
        ref={light}
        geometry={lit.inside}
        material={flat(palette.floorLit)}
        layers={DECAL_LAYER}
        position={[0, 0, WZ]}
        scale={[1, 1, Math.max(0.001, boot.shutter)]}
        visible={boot.shutter > 0.001}
      />
    </group>
  );
}
