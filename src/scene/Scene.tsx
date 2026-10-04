'use client';

import type { ReactNode } from 'react';
import { LIGHT_DIRECTION } from '@/config/layout';
import { AMBIENT_INTENSITY, DIRECTIONAL_INTENSITY } from './materials';
import { CameraRig } from './CameraRig';
import { Interaction } from './Interaction';
import { Resolution } from './Resolution';
import { Floor } from './building/Floor';
import { Walls } from './building/Walls';
import { Shutter } from './building/Shutter';
import { ExitDoor } from './building/ExitDoor';
import { FloorMarkings } from './building/FloorMarkings';
import { Conveyor } from './line/Conveyor';
import { LineFlow } from './line/LineFlow';
import { EngineTestBench } from './stations/EngineTestBench';
import { StructuralTest } from './stations/StructuralTest';
import { OttometrixDisplay } from './stations/OttometrixDisplay';
import { HydraulicRecovery } from './stations/HydraulicRecovery';
import { RoboticCell } from './stations/RoboticCell';
import { Packer } from './stations/Packer';
import { InkPass } from './effects/InkPass';
import { Agv } from './life/Agv';
import { Daylight } from './life/Daylight';
import { Operator } from './life/Operator';
import { WallCrane } from './life/WallCrane';
import { Scheduler } from './Scheduler';
import { BootSequence } from './BootSequence';
import { ExplodeDriver } from './ExplodeDriver';
import { ForceDriver } from './ForceDriver';

/**
 * Conjunto que el repintado por zonas puede saltarse entero cuando su caja no toca la zona que se
 * repinta (ver InkPass): las máquinas y los elementos fijos de la nave, no lo que recorre la planta.
 */
function Cullable({ children }: { children: ReactNode }) {
  return <group userData={{ zoneCull: true }}>{children}</group>;
}

export function Scene() {
  return (
    <>
      <Resolution />
      <BootSequence />
      <CameraRig />
      <Interaction />
      <ExplodeDriver />
      <ForceDriver />
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight position={LIGHT_DIRECTION} intensity={DIRECTIONAL_INTENSITY} />
      <Floor />
      <Walls />
      <Cullable>
        <Shutter />
      </Cullable>
      <Cullable>
        <ExitDoor />
      </Cullable>
      <FloorMarkings />
      <Conveyor />
      <LineFlow />
      <Cullable>
        <EngineTestBench />
      </Cullable>
      <Cullable>
        <StructuralTest />
      </Cullable>
      <Cullable>
        <OttometrixDisplay />
      </Cullable>
      <Cullable>
        <HydraulicRecovery />
      </Cullable>
      <Cullable>
        <RoboticCell />
      </Cullable>
      <Cullable>
        <Packer />
      </Cullable>
      {/* Vida de la nave: discreta y al fondo. */}
      <Cullable>
        <Operator />
      </Cullable>
      <Agv />
      <WallCrane />
      <Daylight />
      <InkPass />
      <Scheduler />
    </>
  );
}
