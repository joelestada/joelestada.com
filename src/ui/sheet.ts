/**
 * Cambio de lámina entre páginas: una hoja de papel crece desde el control pulsado hasta cubrir la
 * pantalla, con el rótulo de la hoja a la que se va; se navega debajo y la página nueva la retira
 * (CoverRelease en las páginas de lectura; la portada, cuando la escena ya ha pintado).
 * Sin React: la hoja vive en <body> y sobrevive al cambio de página.
 */

/** Lo que tarda la hoja en cubrir y en retirarse (deben cuadrar con chrome.css). */
const COVER_MS = 560;
const LEAVE_MS = 640;
/** Si la página nueva no llega a retirarla (un error al navegar), se retira sola. */
const STUCK_MS = 8000;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type SheetLabel = { kicker?: string; title: string };

function sheet({ kicker, title }: SheetLabel) {
  const warp = document.createElement('div');
  warp.className = 'warp';
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const cross = document.createElement('i');
    cross.className = `warp__cross warp__cross--${corner}`;
    warp.appendChild(cross);
  }
  const label = document.createElement('div');
  label.className = 'warp__label';
  if (kicker) {
    const k = document.createElement('span');
    k.className = 'warp__kicker';
    k.textContent = kicker;
    label.appendChild(k);
  }
  const t = document.createElement('span');
  t.className = 'warp__title';
  t.textContent = title;
  label.appendChild(t);
  const bar = document.createElement('i');
  bar.className = 'warp__bar';
  label.appendChild(bar);
  warp.appendChild(label);
  return warp;
}

/**
 * Cubre la pantalla desde `from` (el control pulsado o la ficha) y llama a `go` cuando está cubierta.
 * Con «reducir movimiento», navega sin más.
 */
export function coverAndGo(go: () => void, label: SheetLabel, from?: Element | DOMRect | null) {
  if (reduced()) {
    go();
    return;
  }
  document.querySelectorAll('.warp').forEach((w) => w.remove());
  const warp = sheet(label);
  const r = from instanceof Element ? from.getBoundingClientRect() : from;
  if (r) {
    warp.style.setProperty('--t', `${Math.max(0, r.top)}px`);
    warp.style.setProperty('--r', `${Math.max(0, window.innerWidth - r.right)}px`);
    warp.style.setProperty('--b', `${Math.max(0, window.innerHeight - r.bottom)}px`);
    warp.style.setProperty('--l', `${Math.max(0, r.left)}px`);
  }
  document.body.appendChild(warp);
  requestAnimationFrame(() => requestAnimationFrame(() => warp.classList.add('is-full')));
  window.setTimeout(go, COVER_MS);
  window.setTimeout(() => release(warp), STUCK_MS);
}

function release(warp: Element) {
  if (!warp.isConnected || warp.classList.contains('is-leaving')) return;
  warp.classList.add('is-leaving');
  window.setTimeout(() => warp.remove(), LEAVE_MS);
}

/** Retira la hoja que dejó la página anterior (se levanta y descubre la nueva). */
export function releaseCover() {
  document.querySelectorAll('.warp').forEach(release);
}

export const hasCover = () => document.querySelector('.warp:not(.is-leaving)') !== null;
