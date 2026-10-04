import type { Lang } from '@/i18n/lang';
import { localize, type L } from '@/i18n/localize';
import type { Vec3 } from './layout';
import type { StationId } from './stations';

/**
 * Vista explosionada: las piezas de cada máquina, en el orden de la lista de piezas.
 *
 * Cada pieza se separa en línea recta por su eje de montaje (`to`, en el marco de su conjunto:
 * la estación o, dentro del motor, el propio motor). Salen por etapas, de fuera hacia dentro:
 * protecciones, luego los conjuntos grandes y al final lo que va dentro, y vuelven al revés.
 * `at` es el punto de la pieza (en el mismo marco) donde se clava su globo; el globo sale hacia
 * fuera del conjunto, o hacia `tag` (px) si hay que fijarlo. Una pieza sin `to` no se mueve
 * (bancada, base…): solo lleva su globo.
 */
export type PartSpec = {
  n: number;
  /** Nombre en la lista de piezas, en los dos idiomas. */
  name: L;
  stage: number;
  to?: Vec3;
  at: Vec3;
  tag?: [number, number];
};

type Parts = Record<string, PartSpec>;

// prettier-ignore
const engine = {
  guard: { n: 1, name: { en: 'Safety guard', es: 'Protección' }, stage: 0, to: [-0.7, 0, -0.7], at: [-2.95, 2.0, -1.32] },
  dyno: { n: 2, name: { en: 'Dynamometer', es: 'Dinamómetro' }, stage: 1, to: [-0.8, 0, 0], at: [-1.95, 0.8, 0.62] },
  block: { n: 3, name: { en: 'Engine block', es: 'Bloque motor' }, stage: 1, to: [0, 0.95, 0], at: [-0.34, 1.41, 0.33] },
  // Dentro del motor (marco del motor, escalado ×1,2). Primero lo de fuera: el tubo de carga pasa
  // por encima de la tapa y el cárter tiene que estar fuera antes de que baje el cigüeñal.
  charge: { n: 4, name: { en: 'Charge pipe', es: 'Tubo de carga' }, stage: 2, to: [0, 1.55, 0], at: [1.09, 1.27, 0.2], tag: [42, -26] },
  // La columna de arriba lleva sus globos alineados a la izquierda, como en un plano de conjunto.
  cover: { n: 5, name: { en: 'Valve cover', es: 'Tapa de balancines' }, stage: 2, to: [0, 1.4, 0], at: [0.46, 1.135, 0.1], tag: [-62, 0] },
  sump: { n: 6, name: { en: 'Oil sump', es: 'Cárter' }, stage: 2, to: [0, -0.74, 0], at: [1.45, 0.08, 0.24], tag: [34, 22] },
  // El turbo sale hacia fuera y algo hacia arriba (su bajante queda por encima del cárter).
  turbo: { n: 7, name: { en: 'Turbocharger', es: 'Turbocompresor' }, stage: 2, to: [0, 0.25, 0.62], at: [1.0, 0.64, 0.5] },
  // En el marco de la culata: se separa de ella y luego sube con ella.
  manifold: { n: 8, name: { en: 'Exh. manifold', es: 'Colector de escape' }, stage: 2, to: [0, 0.05, 0.26], at: [1.3, 0.925, 0.4] },
  accessories: { n: 9, name: { en: 'Belt drive', es: 'Correa de accesorios' }, stage: 2, to: [1.3, 0, 0], at: [1.65, 0.73, 0.35] },
  timing: { n: 10, name: { en: 'Timing cover', es: 'Tapa de distribución' }, stage: 2, to: [0.66, 0, 0], at: [1.66, 1.0, 0.24] },
  shaft: { n: 11, name: { en: 'Driveshaft', es: 'Eje de transmisión' }, stage: 2, to: [-0.66, 0, 0], at: [-0.16, 0.48, 0.03] },
  flywheel: { n: 12, name: { en: 'Flywheel', es: 'Volante motor' }, stage: 2, to: [-0.48, 0, 0], at: [0.115, 0.6, 0.1] },
  housing: { n: 13, name: { en: 'Bell housing', es: 'Campana' }, stage: 2, to: [-0.26, 0, 0], at: [0.2, 0.62, 0.22] },
  // Arranque y enfriador salen por delante del bloque, lejos de la franja del cigüeñal que baja.
  starter: { n: 14, name: { en: 'Starter motor', es: 'Motor de arranque' }, stage: 2, to: [0, 0.36, 0.3], at: [0.4, 0.26, 0.36], tag: [-30, 26] },
  oil: { n: 15, name: { en: 'Oil cooler', es: 'Enfriador de aceite' }, stage: 2, to: [0, 0, 0.62], at: [1.2, 0.46, 0.33] },
  // Lo de dentro.
  cams: { n: 16, name: { en: 'Camshafts', es: 'Árboles de levas' }, stage: 3, to: [0, 1.09, 0], at: [0.46, 1.07, 0.1], tag: [-62, 0] },
  head: { n: 17, name: { en: 'Cylinder head', es: 'Culata' }, stage: 3, to: [0, 0.91, 0], at: [0.46, 1.0, 0.1], tag: [-62, 0] },
  gasket: { n: 18, name: { en: 'Head gasket', es: 'Junta de culata' }, stage: 3, to: [0, 0.73, 0], at: [0.46, 0.849, 0.1], tag: [-62, 0] },
  crank: { n: 19, name: { en: 'Crankshaft', es: 'Cigüeñal' }, stage: 3, to: [0, -0.52, 0], at: [0.39, 0.45, 0.04], tag: [-44, 8] },
  pistons: { n: 20, name: { en: 'Pistons & rods', es: 'Pistones y bielas' }, stage: 4, to: [0, 0.57, 0], at: [0.46, 0.8, 0.07], tag: [-62, 0] },
} satisfies Parts;

// Banco de flexión, como se desmonta en el laboratorio: primero se levanta el dintel, luego se
// abren los pilares y sube lo que colgaba de él, por etapas; al final sale la probeta (hacia delante
// y algo arriba, para no tapar lo que tiene debajo) y se levantan sus apoyos.
// prettier-ignore
const structure = {
  specimen: { n: 1, name: { en: 'Test specimen', es: 'Probeta' }, stage: 4, to: [0, 0.55, 1.4], at: [-1.27, 1.57, -2.09] },
  beam: { n: 2, name: { en: 'Crossbeam', es: 'Dintel' }, stage: 0, to: [0, 1.35, 0], at: [-1.75, 3.55, -2.0] },
  columns: { n: 3, name: { en: 'Columns', es: 'Columnas' }, stage: 1, to: [0.3, 0, 0], at: [2.25, 2.4, -2.07] },
  actuator: { n: 4, name: { en: 'Actuator', es: 'Actuador' }, stage: 1, to: [0, 0.9, 0], at: [0.1, 2.6, -2.11] },
  // En el marco del actuador: se separa del bloque de distribución y luego sube con él.
  servo: { n: 5, name: { en: 'Servovalve', es: 'Servoválvula' }, stage: 2, to: [-0.34, 0, 0], at: [-0.33, 2.53, -2.27] },
  cell: { n: 6, name: { en: 'Load cell', es: 'Célula de carga' }, stage: 2, to: [0, 0.7, 0], at: [-0.11, 2.01, -2.16] },
  spreader: { n: 7, name: { en: 'Spreader beam', es: 'Viga de reparto' }, stage: 2, to: [0, 0.42, 0], at: [-0.82, 1.86, -2.15] },
  rollers: { n: 8, name: { en: 'Load rollers', es: 'Rodillos de carga' }, stage: 3, to: [0, 0.2, 0], at: [-0.63, 1.69, -2.04] },
  bearings: { n: 9, name: { en: 'Pin & roller', es: 'Apoyos' }, stage: 4, to: [0, 0.25, 0], at: [-1.9, 0.88, -2.03] },
  pedestals: { n: 10, name: { en: 'Pedestals', es: 'Pedestales' }, stage: 0, at: [1.9, 0.6, -2.03] },
  lvdt: { n: 11, name: { en: 'LVDTs', es: 'LVDT' }, stage: 0, at: [0.63, 0.72, -2.07] },
  hsm: { n: 12, name: { en: 'Svc. manifold', es: 'Bloque distribuidor' }, stage: 0, to: [0.4, 0, 0], at: [2.58, 1.56, -2.13] },
  hpu: { n: 13, name: { en: 'Power unit', es: 'Grupo hidráulico' }, stage: 0, at: [3.3, 0.62, -2.25] },
  controller: { n: 14, name: { en: 'Controller', es: 'Controlador' }, stage: 0, at: [-3.45, 1.5, -2.48] },
  bed: { n: 15, name: { en: 'Test bed', es: 'Bancada' }, stage: 0, at: [2.5, 0.2, -1.35] },
} satisfies Parts;

// Puesto de Ottometrix: la cámara sube, los módulos del videowall se abren en rejilla, los
// servidores, el switch y el SAI salen del rack como cajones y unas baldosas del suelo técnico se
// levantan sobre la bandeja de cables.
// prettier-ignore
const display = {
  camera: { n: 1, name: { en: 'Camera', es: 'Cámara' }, stage: 0, to: [0, 0.35, 0], at: [0.13, 3.96, -2.57] },
  panels: { n: 2, name: { en: 'Display panels', es: 'Módulos de pantalla' }, stage: 1, to: [0, 0, 0.3], at: [0.6, 2.66, -2.55] },
  controller: { n: 3, name: { en: 'Wall controller', es: 'Controlador del muro' }, stage: 0, at: [0.32, 0.88, -2.78] },
  stand: { n: 4, name: { en: 'Stand & rails', es: 'Soporte y raíles' }, stage: 0, at: [-1.1, 1.2, -2.84] },
  console: { n: 5, name: { en: 'Operator console', es: 'Consola del operador' }, stage: 0, at: [-1.0, 0.9, -1.5] },
  servers: { n: 6, name: { en: 'Servers', es: 'Servidores' }, stage: 1, to: [0, 0, 0.34], at: [3.81, 1.93, -2.23] },
  switch: { n: 7, name: { en: 'Network switch', es: 'Switch de red' }, stage: 2, to: [0, 0, 0.3], at: [3.81, 2.06, -2.23] },
  ups: { n: 8, name: { en: 'UPS', es: 'SAI' }, stage: 2, to: [0, 0, 0.3], at: [3.81, 0.46, -2.23] },
  rack: { n: 9, name: { en: 'Server rack', es: 'Rack de servidores' }, stage: 0, at: [3.86, 2.19, -2.7] },
  tiles: { n: 10, name: { en: 'Access tiles', es: 'Baldosas registrables' }, stage: 0, to: [0, 0.3, -0.62], at: [2.2, 0.14, -2.0] },
  floor: { n: 11, name: { en: 'Raised floor', es: 'Suelo técnico' }, stage: 0, at: [-2.6, 0.14, -2.6] },
} satisfies Parts;

// Prensa con recuperación: el dintel sube, el cabezal sube con la masa (que se descuelga y suelta su
// punzón), las columnas y los cilindros se abren hacia los lados y el grupo hidráulico se desmonta
// sobre su depósito; las botellas suben en cascada.
// prettier-ignore
const hydraulic = {
  beam: { n: 1, name: { en: 'Crossbeam', es: 'Dintel' }, stage: 1, to: [0, 1.05, 0], at: [0.35, 3.67, 0.9] },
  carriage: { n: 2, name: { en: 'Crosshead', es: 'Cabezal' }, stage: 1, to: [0, 0.55, 0], at: [0.36, 2.95, 0.6] },
  // Masa y punzón: en el marco del cabezal.
  mass: { n: 3, name: { en: 'Test mass', es: 'Masa de ensayo' }, stage: 2, to: [0, -0.28, 0], at: [-0.16, -0.4, 0.36], tag: [-40, -4] },
  tool: { n: 4, name: { en: 'Press tool', es: 'Punzón' }, stage: 3, to: [0, -0.22, 0], at: [0.142, -0.72, 0.05], tag: [-38, 16] },
  guides: { n: 5, name: { en: 'Guide columns', es: 'Columnas guía' }, stage: 2, to: [0, 0, 0.55], at: [0.29, 2.3, 1.24] },
  cylinders: { n: 6, name: { en: 'Lift cylinders', es: 'Cilindros de elevación' }, stage: 2, to: [0, 0, 0.32], at: [0.3, 1.0, 0.84] },
  accumulators: { n: 7, name: { en: 'Accumulators', es: 'Acumuladores' }, stage: 1, to: [0, 0.6, 0], at: [-2.1, 1.7, -2.2] },
  // El motor se iza (como con la grúa) y la bomba sale por su eje.
  motor: { n: 8, name: { en: 'Electric motor', es: 'Motor eléctrico' }, stage: 1, to: [0, 0.5, 0], at: [3.45, 1.17, -2.15] },
  pump: { n: 9, name: { en: 'Pump', es: 'Bomba' }, stage: 1, to: [0.4, 0, 0], at: [4.24, 1.08, -2.3] },
  cooler: { n: 10, name: { en: 'Oil cooler', es: 'Enfriador de aceite' }, stage: 0, at: [2.82, 0.5, -2.0], tag: [34, 28] },
  valves: { n: 11, name: { en: 'Valve block', es: 'Bloque de válvulas' }, stage: 2, to: [0, 0.5, 0], at: [0.35, 0.72, -1.35] },
  filter: { n: 12, name: { en: 'Return filter', es: 'Filtro de retorno' }, stage: 2, to: [0, 0.45, 0], at: [4.5, 1.1, -2.52] },
  tank: { n: 13, name: { en: 'Oil tank', es: 'Depósito de aceite' }, stage: 0, at: [4.7, 0.6, -1.8] },
} satisfies Parts;

// prettier-ignore
const robotic = {
  rear: { n: 1, name: { en: 'Rear guard', es: 'Vallado trasero' }, stage: 0, to: [0, 0, -0.75], at: [0.9, 2.1, -3.0] },
  front: { n: 2, name: { en: 'Front guard', es: 'Vallado delantero' }, stage: 0, to: [0, 0, 0.7], at: [2.3, 2.1, 1.15] },
  feeder: { n: 3, name: { en: 'Cap feeder', es: 'Alimentador de tapas' }, stage: 1, to: [0, 0.5, 0], at: [1.1, 0.95, -0.8] },
  base: { n: 4, name: { en: 'Base', es: 'Base' }, stage: 0, at: [-0.2, 0.06, -1.1] },
  // Brazo: cada eslabón se separa del anterior a lo largo del brazo (marco de su articulación).
  turret: { n: 5, name: { en: 'Axis 1 turret', es: 'Torreta eje 1' }, stage: 1, to: [0, 0.35, 0], at: [0.22, 0.95, 0.29] },
  upper: { n: 6, name: { en: 'Upper arm', es: 'Brazo' }, stage: 2, to: [0, 0.32, 0], at: [0.17, 0.55, 0.17] },
  fore: { n: 7, name: { en: 'Forearm', es: 'Antebrazo' }, stage: 2, to: [0, 0.3, 0], at: [0.7, 0.115, 0.115] },
  wrist: { n: 8, name: { en: 'Wrist', es: 'Muñeca' }, stage: 2, to: [0.3, 0, 0], at: [0, 0.1, 0.13] },
  gripper: { n: 9, name: { en: 'Gripper', es: 'Pinza' }, stage: 3, to: [0.28, 0, 0], at: [0.38, 0, 0.1] },
} satisfies Parts;

export const PARTS = { engine, structure, display, hydraulic, robotic } satisfies Record<StationId, Parts>;

/** Lista de piezas de una estación, en orden. */
export function partList(id: StationId): PartSpec[] {
  return (Object.values(PARTS[id]) as PartSpec[]).sort((a, b) => a.n - b.n);
}

/** Lo mismo con los nombres en un idioma (la lista de la ficha y los globos del despiece). */
export const partNames = (id: StationId, lang: Lang) => partList(id).map((p) => ({ n: p.n, name: localize(p.name, lang) }));
