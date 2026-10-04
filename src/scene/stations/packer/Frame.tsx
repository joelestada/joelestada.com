'use client';

import { palette } from '@/config/palette';
import { Anchor } from '../../kit/hardware';
import { Bar, Block, Box, Cyl, Tube } from '../../kit/primitives';
import { BOX_L, ERECTOR, FORM_Z, HEAD_CHAIN, HMI, INFEED, PALLET_TOP, PICKER_CHAIN, PORTAL, PUSHER, PUSHER_CHAIN, X0 } from './dims';

const c = palette;
const g = c.green;

/** Placa de anclaje con cuatro tuercas bajo un pilar. */
function Foot({ x, z, half = 0.13 }: { x: number; z: number; half?: number }) {
  return (
    <group>
      <Block min={[x - half, 0, z - half]} max={[x + half, 0.025, z + half]} c={c.metalDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Anchor key={`${sx}${sz}`} p={[x + sx * (half - 0.035), 0.025, z + sz * (half - 0.035)]} r={0.014} />))}
    </group>
  );
}

/**
 * Pórtico de la embaladora: cuatro pilares anclados, dinteles, travesaño central con el cilindro
 * del cabezal y los casquillos de sus guías, cartabones en las esquinas y consola de mando.
 */
export function Portal() {
  const { x, z, post, h, beam } = PORTAL;
  const xs = [X0 - x, X0 + x];
  const p = post / 2;
  return (
    <group>
      {xs.flatMap((px) =>
        [-z, z].map((pz) => (
          <group key={`${px}${pz}`}>
            <Foot x={px} z={pz} />
            <Block min={[px - p, 0.025, pz - p]} max={[px + p, h, pz + p]} c={g} />
          </group>
        )),
      )}
      {[-z, z].map((pz) => (
        <Block key={`x${pz}`} min={[xs[0] - p, h - beam, pz - p]} max={[xs[1] + p, h, pz + p]} c={g} />
      ))}
      {xs.map((px) => (
        <Block key={`z${px}`} min={[px - p, h - beam, -z + p]} max={[px + p, h, z - p]} c={g} />
      ))}
      {/* Cartabones en las esquinas superiores, a lo largo de X. */}
      {xs.flatMap((px) =>
        [-z, z].map((pz) => {
          const dir = px < X0 ? 1 : -1;
          return <Bar key={`k${px}${pz}`} a={[px + dir * p, h - 0.42, pz]} b={[px + dir * 0.3, h - beam, pz]} t={0.04} c={g} />;
        }),
      )}
      {/* Travesaño del cilindro, cilindro con sus tomas y casquillos de las dos guías. */}
      <Block min={[X0 - 0.09, h - beam, -z + p]} max={[X0 + 0.09, h, z - p]} c={g} />
      <Cyl p={[X0, h + 0.02, 0]} radius={0.1} length={0.04} segments={24} c={c.metalMid} />
      <Cyl p={[X0, h + 0.27, 0]} radius={0.075} length={0.46} segments={24} c={c.metalLight} />
      <Cyl p={[X0, h + 0.52, 0]} radius={0.085} length={0.04} segments={24} c={c.metalMid} />
      {[h + 0.1, h + 0.44].map((y) => (
        <group key={y}>
          <Cyl p={[X0 + 0.09, y, 0]} radius={0.016} length={0.04} axis="x" segments={6} c={c.metalMid} />
          <Tube
            points={[
              [X0 + 0.11, y, 0],
              [X0 + 0.2, y, 0],
              [X0 + 0.2, h - beam / 2, 0],
              [X0 + 0.09, h - beam / 2, 0.06],
            ]}
            radius={0.008}
            bend={0.04}
            c={c.stripeBlack}
          />
        </group>
      ))}
      {[-0.2, 0.2].map((gz) => (
        <Cyl key={gz} p={[X0, h + 0.03, gz]} radius={0.045} length={0.18} segments={20} c={c.metalMid} />
      ))}
      {/* Consola de mando en el pilar delantero izquierdo: brazo giratorio, marco de la pantalla y seta. */}
      <Block min={[HMI.p[0], 1.42, z - 0.03]} max={[xs[0] - p, 1.46, z + 0.03]} c={c.metalMid} />
      <Cyl p={[HMI.p[0], 1.38, z]} radius={0.025} length={0.12} c={c.metalMid} />
      <group position={HMI.p} rotation={HMI.r}>
        <Block min={[-0.17, -0.12, -0.04]} max={[0.17, 0.12, 0.03]} c={c.metalLight} />
        <Block min={[HMI.screen.x0 - 0.008, HMI.screen.y0 - 0.008, 0.03]} max={[HMI.screen.x1 + 0.008, HMI.screen.y1 + 0.008, HMI.screen.z]} c={c.screen} />
        <Cyl p={[0.12, 0.05, 0.045]} radius={0.026} length={0.03} axis="z" c={c.andonRed} />
        <Cyl p={[0.12, -0.05, 0.04]} radius={0.016} length={0.02} axis="z" c={c.andonGreen} />
      </group>
      {/* Soporte del extremo fijo de la cadena del cabezal, bajo el travesaño del cilindro. */}
      <Block
        min={[X0 + 0.06, HEAD_CHAIN.y, HEAD_CHAIN.z - HEAD_CHAIN.h / 2 - 0.012]}
        max={[X0 + HEAD_CHAIN.x + HEAD_CHAIN.w / 2 + 0.006, h - beam, HEAD_CHAIN.z + HEAD_CHAIN.h / 2 + 0.012]}
        c={c.metalMid}
      />
      {/* Colgador delantero de la viga del empujador, desde el dintel de atrás. */}
      <Block min={[X0 - 0.03, PUSHER.beamY + 0.08, -z - 0.03]} max={[X0 + 0.03, h - beam, -z + 0.03]} c={c.metalMid} />
    </group>
  );
}

/** Viga del empujador a lo largo del transportador, con el carril por debajo. */
export function PusherBeam() {
  const { beamY, z0, z1 } = PUSHER;
  return (
    <group>
      <Block min={[X0 - 0.04, beamY, z0]} max={[X0 + 0.04, beamY + 0.08, z1]} c={c.metalLight} />
      <Block min={[X0 - 0.02, beamY - 0.012, z0 + 0.04]} max={[X0 + 0.02, beamY, z1 - 0.04]} c={c.metalMid} />
      {[z0 + 0.02, z1 - 0.02].map((z) => (
        <Block key={z} min={[X0 - 0.05, beamY - 0.02, z - 0.02]} max={[X0 + 0.05, beamY + 0.09, z + 0.02]} c={c.metalDark} />
      ))}
      <Block min={[X0 - 0.03, beamY + 0.08, z0 - 0.01]} max={[X0 + 0.03, ERECTOR.h - 0.06, z0 + 0.05]} c={c.metalMid} />
      {/* Soporte del extremo fijo de la cadena portacables. */}
      <Block
        min={[X0 - 0.034, PUSHER_CHAIN.top, PUSHER_CHAIN.fixed - 0.05]}
        max={[X0 + 0.034, PUSHER_CHAIN.top + PUSHER_CHAIN.h + 0.006, PUSHER_CHAIN.fixed + 0.004]}
        c={c.metalMid}
      />
    </group>
  );
}

/**
 * Transportador de rodillos de la formadora a la cinta: largueros, rodillos a la cota del palé,
 * patas, guías laterales para la caja y chapa de paso sobre el larguero de la cinta.
 */
export function Infeed() {
  const { z0, z1, half, pitch, r } = INFEED;
  const n = Math.floor((z1 - z0 - 0.06) / pitch) + 1;
  const rollerY = PALLET_TOP - r;
  const guideX = BOX_L / 2 + 0.025;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Block min={[X0 + s * half - 0.02, rollerY - 0.06, z0]} max={[X0 + s * half + 0.02, rollerY + 0.012, z1]} c={c.metalLight} />
          {[z0 + 0.08, (z0 + z1) / 2, z1 - 0.08].map((z) => (
            <group key={z}>
              <Block min={[X0 + s * half - 0.02, 0.03, z - 0.02]} max={[X0 + s * half + 0.02, rollerY - 0.06, z + 0.02]} c={c.metalLight} />
              <Cyl p={[X0 + s * half, 0.016, z]} radius={0.035} length={0.032} c={c.metalMid} />
            </group>
          ))}
          {/* Guía lateral: barra redonda sobre sus soportes. */}
          <Cyl p={[X0 + s * guideX, 0.965, (z0 + z1 - 0.12) / 2]} radius={0.011} length={z1 - z0 - 0.12} axis="z" c={c.metalMid} />
          {[z0 + 0.12, (z0 + z1) / 2, z1 - 0.2].map((z) => (
            <Block key={`g${z}`} min={[X0 + s * guideX - 0.008, rollerY + 0.012, z - 0.012]} max={[X0 + s * guideX + 0.008, 0.965, z + 0.012]} c={c.metalMid} />
          ))}
        </group>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <Cyl key={i} p={[X0, rollerY, z0 + 0.03 + i * pitch]} radius={r} length={2 * half - 0.04} axis="x" segments={12} c={c.metalLight} />
      ))}
      <Block min={[X0 - half + 0.02, 0.2, z0 + 0.06]} max={[X0 + half - 0.02, 0.23, z1 - 0.06]} c={c.metalMid} />
      <Block min={[X0 - BOX_L / 2 - 0.04, PALLET_TOP - 0.013, z1]} max={[X0 + BOX_L / 2 + 0.04, PALLET_TOP - 0.001, -0.31]} c={c.metalMid} />
    </group>
  );
}

/**
 * Bastidor de la formadora (fijo): pilares, marco superior con el carril del brazo de la plancha, el
 * soporte del abridor y el travesaño del empujador; cargador de planchas con sus guías y topes;
 * cilindros de la mesa; caja de mando y terminal de válvulas.
 */
export function ErectorFrame() {
  const { x: ex, z: ez, h } = ERECTOR;
  return (
    <group>
      {ex.flatMap((px) =>
        ez.map((pz) => (
          <group key={`${px}${pz}`}>
            <Foot x={px} z={pz} half={0.1} />
            <Block min={[px - 0.035, 0.025, pz - 0.035]} max={[px + 0.035, h, pz + 0.035]} c={g} />
          </group>
        )),
      )}
      {ez.map((pz) => (
        <Block key={`x${pz}`} min={[ex[0] - 0.035, h - 0.06, pz - 0.035]} max={[ex[1] + 0.035, h, pz + 0.035]} c={g} />
      ))}
      {ex.map((px) => (
        <Block key={`z${px}`} min={[px - 0.035, h - 0.06, ez[1] + 0.035]} max={[px + 0.035, h, ez[0] - 0.035]} c={g} />
      ))}
      <Block min={[ex[0] + 0.035, h - 0.06, -2.63]} max={[ex[1] - 0.035, h, -2.57]} c={g} />
      {/* Carril del brazo de la plancha, en el larguero izquierdo, y soporte fijo de su cadena encima. */}
      <Block min={[ex[0] + 0.035, h - 0.085, ez[1] + 0.06]} max={[ex[0] + 0.075, h - 0.06, ez[0] - 0.06]} c={c.metalMid} />
      <Block
        min={[PICKER_CHAIN.x - PICKER_CHAIN.w / 2 - 0.006, h, PICKER_CHAIN.fixed - 0.045]}
        max={[PICKER_CHAIN.x + PICKER_CHAIN.w / 2 + 0.006, h + PICKER_CHAIN.h + 0.006, PICKER_CHAIN.fixed + 0.004]}
        c={c.metalMid}
      />
      {/* Soporte del abridor: ménsula desde el larguero delantero y cuerpo de su guía vertical. */}
      <Block min={[0.5, h - 0.06, ERECTOR.formA - 0.02]} max={[0.58, h, ez[0]]} c={g} />
      <Block min={[0.505, h - 0.36, ERECTOR.formA + 0.005]} max={[0.575, h - 0.06, ERECTOR.formA + 0.06]} c={c.metalMid} />
      {/* Cargador: bancada, guías, topes delanteros y plancha de empuje. */}
      <Block min={[-0.17, 0.62, -2.83]} max={[1.03, 0.676, -2.48]} c={c.metalMid} />
      {[-0.13, 0.99].map((x) => (
        <group key={x}>
          <Block min={[x - 0.015, 0.676, -2.8]} max={[x + 0.015, 1.5, -2.77]} c={c.metalMid} />
          <Block min={[x - 0.015, 1.47, -2.8]} max={[x + 0.015, 1.5, -2.5]} c={c.metalMid} />
          <Block min={[x - 0.015, 0.676, -2.53]} max={[x + 0.015, 1.47, -2.5]} c={c.metalMid} />
        </group>
      ))}
      {[-0.17, 0.98].flatMap((x) => [-2.83, -2.53].map((z) => <Block key={`${x}${z}`} min={[x, 0, z]} max={[x + 0.05, 0.62, z + 0.05]} c={c.metalMid} />))}
      {/* Cilindros de la mesa de formado. */}
      {[-0.2, 0.2].map((dx) => (
        <group key={dx}>
          <Cyl p={[X0 + dx, 0.3, FORM_Z]} radius={0.03} length={0.5} c={c.metalLight} />
          <Cyl p={[X0 + dx, 0.035, FORM_Z]} radius={0.05} length={0.03} c={c.metalMid} />
        </group>
      ))}
      {/* Caja de mando en el pilar delantero derecho y terminal de válvulas en el costado. */}
      <Block min={[ex[1] - 0.2, 1.05, ez[0] + 0.035]} max={[ex[1] + 0.035, 1.35, ez[0] + 0.1]} c={c.metalLight} />
      <Block min={[ex[1] - 0.17, 1.2, ez[0] + 0.1]} max={[ex[1] - 0.05, 1.31, ez[0] + 0.104]} c={c.screen} />
      <Cyl p={[ex[1] - 0.11, 1.12, ez[0] + 0.112]} radius={0.02} length={0.024} axis="z" c={c.andonRed} />
      <Block min={[ex[1] + 0.035, 0.9, -2.45]} max={[ex[1] + 0.09, 1.08, -2.15]} c={c.metalMid} />
      {Array.from({ length: 5 }, (_, i) => (
        <Box key={i} p={[ex[1] + 0.095, 1.04, -2.42 + i * 0.06]} s={[0.012, 0.03, 0.04]} c={c.stripeBlack} />
      ))}
    </group>
  );
}
