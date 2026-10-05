/**
 * Maqueta de la nave. Unidades: metros.
 * Convención: X = eje de la línea (el tiempo), Y = arriba, Z = hacia el espectador.
 * La cámara mira desde (-X, +Y, +Z): en pantalla X sube hacia la derecha y Z baja hacia la derecha.
 */

export type Vec3 = [number, number, number];

/** Cinta transportadora de rodillos. */
export const LINE = {
  axisZ: 0,
  /** Cota superior de los rodillos. */
  rollerTop: 0.85,
  /** Separación entre largueros laterales (ejes). */
  width: 0.9,
  startX: 2.0,
  /** La cinta sale por la puerta de la pared final (x 49,2) y acaba fuera, donde ya no se ve. */
  endX: 51.9,
  /**
   * Rodillos de Ø 90 cada 18 cm (cinta de palés). Con la cámara de la línea, cada rodillo deja dos
   * trazos de silueta: más finos o más juntos, la tinta se come el hueco y la cinta se lee como una
   * trama oscura en vez de como rodillos sueltos.
   */
  rollerPitch: 0.18,
  rollerRadius: 0.045,
  legSpacing: 1.6,
} as const;

/** Centro de cada estación a lo largo de X (el orden es el del recorrido). */
export const STATION_X = {
  engine: 0,
  structure: 10,
  display: 20,
  hydraulic: 30,
  robotic: 40,
} as const;

/**
 * Piezas que circulan por la cinta: avanzan solas y despacio (el scroll no las mueve) y paran
 * cuando quedan frente a las máquinas, que solo trabajan con una pieza delante.
 */
export const FLOW = {
  /**
   * Ritmo de la planta: cinta y máquinas (pantalla, prensa, robot, embaladora, precintadora, banco
   * de la celosía y programa del motor) van a este múltiplo del tiempo real, todas a la vez, así
   * que los ciclos siguen encajando entre sí. La gente y la vida del fondo van a su paso.
   */
  tempo: 1.35,
  /** Separación entre piezas: la de las estaciones entre dos, así hay una pieza frente a cada máquina. */
  pitch: 5,
  /** Rejilla de posiciones de la tolva (la primera pieza nace alineada con las paradas). */
  step: 2.5,
  /** Parada de referencia: bajo la masa de la prensa hidráulica (sale de su pórtico, x local 0,2). */
  stopX: STATION_X.hydraulic + 0.2,
  count: 10,
  /** Sin tocar nada durante este tiempo, la planta se detiene (no se pinta nada). */
  standbyMs: 60000,
  /** Tolva de entrada: tapa la aparición de las piezas (salen embaladas por la puerta del final). */
  feeder: { x0: 1.9, x1: 3.1 },
  /** Más allá, la pieza ya ha salido por la puerta y la tapa la pared: deja de dibujarse. */
  hideX: 51.3,
  /** Pieza: palé de transporte y pieza mecanizada (medidas completas). */
  pallet: [0.66, 0.04, 0.6] as Vec3,
  part: [0.48, 0.2, 0.38] as Vec3,
  /** Casquillo que coloca la prensa y tapa que coloca el robot. */
  bushing: { r: 0.055, h: 0.028 },
  cap: { r: 0.09, h: 0.05 },
} as const;

/**
 * Final de la línea: embaladora que mete cada pieza en una caja de cartón, la cierra y la precinta
 * sobre su palé, y puerta de salida en la pared final, en el eje de la cinta. Al llegar al final del
 * recorrido la puerta se abre del todo y la ficha pasa a ser el contacto.
 */
export const END = {
  /** Centro de la embaladora (su parada es, como en las máquinas, centro + 0,2). */
  packX: 45,
  /**
   * Caja americana de cuatro solapas (m): largo a lo largo de la línea, ancho, alto de las paredes,
   * alto de cada solapa (la mitad del ancho: las largas se juntan en el centro) y grueso del cartón.
   */
  carton: { l: 0.6, w: 0.46, h: 0.32, flap: 0.23, t: 0.008 },
  /** Puerta de salida: hueco en z, altura libre y altura del borde de las lamas en reposo (medio abierta). */
  door: { z0: -1.6, z1: 1.6, height: 3.2, rest: 1.85 },
} as const;

/**
 * Nave: muro del fondo (paralelo a la línea) y pared final (perpendicular).
 * Como en la referencia, el tramo de la persiana está más cerca de la línea
 * y a su derecha el muro retranquea hacia el fondo.
 */
export const BUILDING = {
  /** Cara interior del tramo de muro con la persiana. */
  doorWallZ: -5.5,
  /** Cara interior del muro del fondo a partir del retranqueo. */
  backWallZ: -9.5,
  /** X donde termina el tramo de la persiana y empieza el retranqueo. */
  stepX: 6.4,
  wallThickness: 0.3,
  wallHeight: 10,
  startX: -30,
  /** Cara interior de la pared final de la nave. */
  endWallX: 49.2,
  endWallDepth: 40,
  pilasterWidth: 0.32,
  pilasterDepth: 0.12,
  doorWallPilasterXs: [-11.5, -6.8],
  backWallPilasterXs: [9.5, 16.2, 22.9, 29.6, 36.3, 43.0],
  plinthHeight: 0.32,
} as const;

/** Hueco de la persiana en el muro del fondo. */
export const DOOR = {
  x0: -2.25,
  x1: 3.75,
  /** Altura libre del hueco (bajo el cajón). */
  openingHeight: 3.8,
  /** Cota del borde inferior de las lamas: persiana a medio subir. */
  slatBottom: 1.4,
  slatPitch: 0.1,
  boxHeight: 0.55,
  boxDepth: 0.5,
  guideWidth: 0.14,
  /** Profundidad de la zona iluminada hacia dentro de la nave. */
  litDepth: 2.9,
} as const;

/** Pintura de suelo. */
export const MARKINGS = {
  lineWidth: 0.12,
  /** Pasillo delantero (entre la línea y el espectador). */
  aisleNearZ: 4.1,
  /** Pasillo trasero (entre la línea y el muro). */
  aisleFarZ: -4.3,
  aisleStartX: -9,
  aisleEndX: 48.8,
  dash: 0.62,
  gap: 0.42,
  crossbarLength: 2.0,
  crossbarWidth: 0.16,
  /** Inicio del tramo de cada estación (travesaño); el año pintado sale de `STATIONS[i].year`. */
  yearStartsX: [-0.9, 5.6, 15.6, 25.6, 35.6],
  yearOffsetX: 0.45,
  yearZ: 3.0,
  yearSize: 0.74,
} as const;

/**
 * Vida de la nave, siempre al fondo y despacio: carro autónomo por la línea pintada del pasillo
 * trasero y una grúa de pluma sobre el muro.
 */
export const LIFE = {
  /** Paradas en los huecos entre máquinas, donde se ve entero (detrás de una máquina solo asomaría). */
  agv: { z: MARKINGS.aisleFarZ, x0: 8, x1: 46.4, stops: [13.8, 24.2, 34.0], speed: 0.75, dwellS: 6 },
  crane: { y: 4.3, x0: 9, x1: 46, reach: 3.4 },
} as const;

/** Cámara ortográfica y recorrido de scroll. */
export const CAMERA = {
  /** Elevación sobre el horizonte y azimut: línea a ~22° y transversal a ~27° en pantalla, medidos en la referencia. */
  elevationDeg: 27,
  azimuthDeg: 41.7,
  distance: 70,
  near: 1,
  far: 180,
  /** Metros visibles en vertical: lo bastante lejos para que las máquinas se lean como piezas finas, no como bloques. */
  viewHeight: 12.2,
  /** Anchura mínima visible (la del encuadre 16:9): en ventanas más estrechas se aleja en vez de recortar la persiana. */
  minViewWidth: 21.6,
  /**
   * En vertical (móvil) se acepta recortar más para que las máquinas no queden diminutas: unos 7 m
   * a lo ancho, lo que mide el motor con su vallado. Las máquinas más anchas pierden algo de vallado
   * por los lados; el encuadre (scene/framing) las centra en el hueco que deja la interfaz.
   */
  minViewWidthPortrait: 7.2,
  /** Móvil en horizontal (poca altura): metros visibles en vertical. Con los de siempre quedaban diminutas. */
  shortViewHeight: 8.6,
  /** En vertical el encuadre se corre hacia -X: las máquinas quedan centradas y no pegadas al borde. */
  portraitShiftX: -0.6,
  /**
   * En vertical la línea sube esta fracción del alto de la vista: el hueco libre está entre la barra
   * y la ficha, por encima del centro de la pantalla (y así sobra menos muro).
   */
  portraitLift: 0.09,
  /** Y al principio del recorrido, un corrimiento extra hacia la persiana que se desvanece en estos metros. */
  portraitStartShiftX: -2.9,
  portraitStartSpan: 4,
  targetY: 2.47,
  targetZ: 0,
  startX: 2.0,
  /** El recorrido acaba pasado el robot: embaladora y puerta de salida (el contacto). */
  endX: END.packX,
} as const;

export const SCROLL = {
  heightVh: 800,
  /** Inercia de Lenis: fracción recorrida por frame a 60 fps (único suavizado del scroll). */
  lerp: 0.085,
  /** Táctil: px de recorrido por px de arrastre horizontal (unos cinco barridos de pantalla, de la persiana a la salida). */
  touchMultiplier: 2.6,
  /** Fracción del recorrido con suavizado al principio y al final. */
  edgeEase: 0.08,
  /** Velocidad relativa al arrancar/frenar (1 = sin suavizado). */
  edgeSpeed: 0.35,
} as const;

/** Focos colgantes que destacan la estación bajo el cursor. */
export const LAMP = {
  /** Radio de la boca de la campana (m). */
  mouth: 0.3,
  /** Semiángulo del cono de luz. */
  halfAngleDeg: 21,
} as const;

/** Luz direccional fija (hacia la luz). Caras superiores claras, +Z medias, -X oscuras, como en la referencia. */
export const LIGHT_DIRECTION: Vec3 = [0.25, 1, 0.6];

/** Dirección unitaria desde el target hacia la cámara. */
export function cameraDirection(): Vec3 {
  const phi = (CAMERA.elevationDeg * Math.PI) / 180;
  const theta = (CAMERA.azimuthDeg * Math.PI) / 180;
  return [-Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi)];
}
