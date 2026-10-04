'use client';

import { palette } from '@/config/palette';
import { roundCorners, type Pt } from '../../kit/geometry';
import { Block, Bolt, Cyl, Gear, Prism, Ring, useInkId } from '../../kit/primitives';
import { BLOCK, BORE_R, CAM, COVER, CYL_X, HEAD, MAIN_X, TIMING } from './dims';

const c = palette;
const DEG = Math.PI / 180;
/** Tornillos de culata, a ambos lados de las levas. */
const HEAD_BOLT_Z = 0.2;

/** Cáncamo de izado: pletina con aro amarillo. `y` es la cara de apoyo. */
export function LiftingEye({ x, y }: { x: number; y: number }) {
  return (
    <group>
      <Block min={[x - 0.012, y, -0.045]} max={[x + 0.012, y + 0.1, 0.045]} c={c.metalMid} />
      <Ring p={[x, y + 0.115, 0]} radius={0.032} tube={0.009} axis="x" c={c.signalYellow} />
    </group>
  );
}

/** Junta de culata: chapa fina con las bocas de los cilindros y los pasos de los tornillos. */
export function HeadGasket() {
  const { x0, x1, z } = HEAD;
  const y = BLOCK.deck;
  return (
    <group>
      <Block min={[x0, y, -z]} max={[x1, y + 0.008, z]} c={c.metalMid} />
      {CYL_X.map((x) => (
        <Cyl key={x} p={[x, y + 0.009, 0]} radius={BORE_R + 0.003} length={0.002} c={c.stripeBlack} />
      ))}
      {MAIN_X.flatMap((x) => [-1, 1].map((s) => <Cyl key={`${x}${s}`} p={[x, y + 0.009, s * HEAD_BOLT_Z]} radius={0.013} length={0.002} c={c.stripeBlack} />))}
    </group>
  );
}

/** Culata: lumbreras de escape y admisión, muelles de válvula, inyectores, tornillos y cáncamo trasero. */
export function CylinderHead() {
  const id = useInkId();
  const { x0, x1, y0, y1, z } = HEAD;
  return (
    <group>
      <Block min={[x0, y0, -z]} max={[x1, y1, z]} c={c.metalLight} id={id} />
      {CYL_X.map((x) => (
        <group key={x}>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Block min={[x - 0.032, 0.895, s > 0 ? z : -z - 0.003]} max={[x + 0.032, 0.955, s > 0 ? z + 0.003 : -z]} c={c.stripeBlack} />
              <Cyl p={[x, y1 + 0.02, s * CAM.z]} radius={0.02} length={0.04} c={c.metalMid} />
            </group>
          ))}
          <Cyl p={[x, y1 + 0.035, 0]} radius={0.016} length={0.07} c={c.metalMid} />
          <Cyl p={[x, y1 + 0.079, 0]} radius={0.023} length={0.018} c={c.metalLight} />
        </group>
      ))}
      {MAIN_X.flatMap((x) => [-1, 1].map((s) => <Bolt key={`${x}${s}`} p={[x, y1, s * HEAD_BOLT_Z]} r={0.016} h={0.014} />))}
      <LiftingEye x={0.39} y={y1} />
    </group>
  );
}

/** Leva: círculo base con una nariz hacia +y, en el plano (z, y). */
const LOBE: Pt[] = Array.from({ length: 28 }, (_, k) => {
  const a = (k / 28) * Math.PI * 2;
  const r = 0.022 + 0.012 * Math.max(0, Math.cos(a)) ** 3;
  return [r * Math.sin(a), r * Math.cos(a)] as Pt;
});
const LOBE_DEG = [0, 240, 120, 120, 240, 0];

/** Dos árboles de levas (admisión y escape) con sus sombreretes y engranajes de distribución. */
export function Camshafts() {
  return (
    <group>
      {[-1, 1].map((s) => {
        const z = s * CAM.z;
        return (
          <group key={s}>
            <Cyl p={[(CAM.x0 + CAM.x1) / 2, CAM.y, z]} radius={0.016} length={CAM.x1 - CAM.x0} axis="x" c={c.metalLight} />
            {CYL_X.map((x, i) => (
              <Prism
                key={x}
                outline={LOBE}
                plane="zy"
                from={x - 0.014}
                depth={0.028}
                p={[0, CAM.y, z]}
                r={[(LOBE_DEG[i] + (s > 0 ? 90 : 0)) * DEG, 0, 0]}
                c={c.metalLight}
              />
            ))}
            {CAM.capsX.map((x) => (
              <Block key={x} min={[x - 0.018, HEAD.y1, z - 0.034]} max={[x + 0.018, CAM.y + 0.02, z + 0.034]} c={c.metalMid} />
            ))}
            <Gear p={[0, CAM.y, z]} teeth={26} root={0.052} tip={0.06} from={TIMING.gearX} depth={TIMING.gearDepth} c={c.metalMid} />
          </group>
        );
      })}
    </group>
  );
}

/** Sección de la tapa de balancines: pestaña atornillada abajo y cuerpo que se estrecha hacia arriba. */
const COVER_PROFILE = roundCorners(
  [
    [-0.205, COVER.y0],
    [0.205, COVER.y0],
    [0.205, 1.04],
    [0.176, 1.04],
    [0.16, COVER.top],
    [-0.16, COVER.top],
    [-0.176, 1.04],
    [-0.205, 1.04],
  ],
  [0, 0, 0, 0, 0.03, 0.03, 0, 0],
  4,
);

/** Tapa de balancines: fila de tornillos a cada lado, nervio central con sus tornillos y tapón de aceite amarillo. */
export function ValveCover() {
  return (
    <group>
      <Prism outline={COVER_PROFILE} plane="zy" from={COVER.x0} depth={COVER.x1 - COVER.x0} c={c.metalLight} />
      <Block min={[CYL_X[0] - 0.05, COVER.top, -0.035]} max={[CYL_X[5] + 0.05, COVER.top + 0.012, 0.035]} c={c.metalLight} />
      {CYL_X.map((x) => (
        <Bolt key={x} p={[x, COVER.top + 0.012, 0]} r={0.012} h={0.01} />
      ))}
      {CYL_X.flatMap((x) => [-1, 1].map((s) => <Bolt key={`${x}${s}`} p={[x, 1.04, s * 0.19]} r={0.011} h={0.012} />))}
      <Cyl p={[1.36, COVER.top + 0.012, 0.09]} radius={0.032} length={0.024} c={c.signalYellow} />
      <Block min={[1.338, COVER.top + 0.024, 0.084]} max={[1.382, COVER.top + 0.036, 0.096]} c={c.signalYellow} />
    </group>
  );
}
