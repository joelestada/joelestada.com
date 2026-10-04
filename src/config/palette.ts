/**
 * Única fuente de color del proyecto. Ningún hex fuera de este archivo.
 * Los valores son sRGB; three.js los pasa a lineal al crear los materiales.
 *
 * Identidad: lámina técnica impresa. Papel gris cálido, tinta casi negra,
 * un solo color de máquina (verde industrial), metales neutros y un único
 * acento (amarillo señal) reservado para seguridad, pieza y estado activo.
 */
export const palette = {
  /** Suelo, muros y "papel" de fondo. */
  floor: '#D8D7CF',
  /** Zona de suelo iluminada bajo la persiana. */
  floorLit: '#ECEBE4',
  /** Papel un punto más oscuro: paneles y bandas de la interfaz. */
  paperShade: '#CFCEC5',
  /** Tinta: trazo, stencil "JOEL", rótulos. */
  ink: '#17191A',
  /** Verde máquina: gris verdoso de pintura en polvo, no verde de juguete. */
  green: '#435C4E',
  /** Metal y chapa claros. */
  metalLight: '#CBCCC6',
  /** Pieza mecanizada que recorre la línea: aluminio claro, destaca sobre los rodillos. */
  workpiece: '#E4E3DB',
  /**
   * Caja de cartón ondulado del final de la línea: kraft apagado, sus cantos algo más oscuros y la
   * cinta de precinto marrón (un material, no un segundo acento).
   */
  carton: '#CBB891',
  cartonEdge: '#AE9A73',
  tape: '#A47E4E',
  /** Metal gris medio. */
  metalMid: '#9B9D97',
  /** Acero oscuro: latiguillos, bridas pesadas, bastidores de fondo. */
  metalDark: '#5F625F',
  /** Amarillo señal: pintura de suelo, bolardos, probetas y estado activo. */
  signalYellow: '#F1AF1C',
  /** Pintura de suelo: el mismo amarillo, gastado sobre el hormigón (menos saturado que las piezas). */
  floorPaint: '#E8BA55',
  /** Negro de franjas de bolardo y piezas oscuras (cámara, taladros, cables). */
  stripeBlack: '#1F2021',
  andonRed: '#C7361F',
  andonAmber: '#E79E1D',
  andonGreen: '#3D8B4C',
  /** Pantallas apagadas y paneles de vidrio oscuro. */
  screen: '#232B31',
  /** Fondo emisivo de la pantalla grande. */
  screenDeep: '#0E1417',
  /** Contenido claro de la pantalla grande. */
  screenInk: '#EDEBE3',
  /** Malla de vallado. */
  fenceMesh: '#6F716E',
  /** Personas: piel, pelo y ropa, apagados para que no destaquen sobre las máquinas. */
  skin: '#D9B8A0',
  hair: '#2C2724',
  shirt: '#E6E0D2',
  trousers: '#30353A',
  shoes: '#8D908B',
  /** Mancha de sol que entra por los lucernarios. */
  sunlight: '#F4F0E4',
  /** Luz de foco al destacar una estación: blanco cálido muy contenido. */
  lampLight: '#F5F1E8',
  /** Aceite hidráulico en circulación. */
  oil: '#E79E1D',
} as const;
