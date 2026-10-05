// Tamaños reducidos de las capturas de Ottometrix (public/projects/ottometrix/<id>-<ancho>.webp) para
// el srcset de la pista: el móvil y la tableta piden la de su ancho y no la de 2480 px, que queda para
// el escritorio de alta densidad y el visor. Hay que volver a generarlas cuando cambie una captura.
// Uso: npm run gen:shots
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'public/projects/ottometrix';
/** Anchos (px) de las variantes: deben cuadrar con SHOT_WIDTHS de src/config/projects.ts. */
const WIDTHS = [960, 1400];

const files = (await readdir(DIR)).filter((f) => /^[a-z-]+\.webp$/.test(f) && !/-\d+\.webp$/.test(f));
for (const f of files) {
  const src = path.join(DIR, f);
  for (const w of WIDTHS) {
    const out = path.join(DIR, f.replace('.webp', `-${w}.webp`));
    await sharp(src).resize({ width: w }).webp({ quality: 82, effort: 6 }).toFile(out);
    console.log(out, `${Math.round((await stat(out)).size / 1024)} KB (original ${Math.round((await stat(src)).size / 1024)} KB)`);
  }
}
