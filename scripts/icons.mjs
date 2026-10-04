// Iconos de la web a partir de su única fuente, src/app/icon.svg (la marca: la «J» que baja a la
// cinta, la pieza amarilla y la máquina, sobre la tinta de la web):
// - src/app/favicon.ico con 16, 32 y 48 px (Safari y la ficha de Google, que pide múltiplos de 48),
// - src/app/apple-icon.png a 180 px y cuadrado (iOS redondea las esquinas por su cuenta).
// Los navegadores modernos usan el SVG directamente.
// Uso: npm run gen:icons
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile('src/app/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

/** El SVG rasterizado a `px` (con `square`, sin las esquinas redondeadas del fondo). */
async function png(px, { square = false } = {}) {
  const src = square ? svg.replace(/ rx="[\d.]+"/, '') : svg;
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
await writeFile('src/app/apple-icon.png', await png(180, { square: true }));
await browser.close();
console.log('src/app/favicon.ico (16, 32, 48) y src/app/apple-icon.png (180)');
