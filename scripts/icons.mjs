// Iconos de la web a partir de su única fuente, src/app/icon.svg (la marca: la «J» que baja a la
// cinta, la pieza amarilla y la máquina). La marca va sin placa y de borde a borde, con contorno de
// tinta: se ve lo más grande posible y se recorta igual en pestañas claras y oscuras (una placa oscura
// hace que Safari, en modo oscuro, le ponga un halo claro detrás). Se generan:
// - src/app/favicon.ico con 16, 32 y 48 px (Safari y la ficha de Google, que pide múltiplos de 48),
// - src/app/apple-icon.png a 180 px: la marca sobre una placa de tinta cuadrada (iOS no admite
//   transparencia y redondea las esquinas por su cuenta).
// Los navegadores modernos usan el SVG directamente.
// Uso: npm run gen:icons
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile('src/app/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

/** La marca sobre una placa de tinta, con aire alrededor (icono del iPhone). */
const plate = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#17191A"/>` +
  inner.replace('<svg ', '<svg x="9" y="9" width="46" height="46" ') +
  `</svg>`;

/** El SVG rasterizado a `px` (con `onPlate`, sobre la placa del iPhone). */
async function png(px, { onPlate = false } = {}) {
  const src = onPlate ? plate(svg) : svg;
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(`<body style="margin:0">${src.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
}

/** Un .ico con las imágenes PNG tal cual (formato admitido desde Windows Vista y en todos los navegadores). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ px, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(px >= 256 ? 0 : px, e);
    head.writeUInt8(px >= 256 ? 0 : px, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((im) => im.data)]);
}

const sizes = [16, 32, 48];
const images = [];
for (const px of sizes) images.push({ px, data: await png(px) });
await writeFile('src/app/favicon.ico', ico(images));
await writeFile('src/app/apple-icon.png', await png(180, { onPlate: true }));
await browser.close();
console.log('src/app/favicon.ico (16, 32, 48) y src/app/apple-icon.png (180)');
