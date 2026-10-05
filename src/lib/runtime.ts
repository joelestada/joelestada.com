import type Lenis from 'lenis';
import { CAMERA, END, SCROLL, STATION_X } from '@/config/layout';
import { STATIONS, STATION_BY_ID, isStationId, type StationId } from '@/config/stations';

/**
 * Estado compartido entre la escena (R3F) y la interfaz (DOM), fuera de React.
 * - Lo continuo (progreso, cámara, niveles de foco) se lee directamente y se pinta en `onFrame`.
 * - Lo discreto (estación destacada/activa, ficha, panel) se publica con `subscribe` para React.
 */

/** Encendido del foco de una estación (0..1, suavizado). Al pasar el cursor solo cambia la luz. */
type StationFx = { level: number };

export const SECTIONS = ['projects', 'about', 'contact', 'cv'] as const;
export type Section = (typeof SECTIONS)[number];

export type Snapshot = {
  /** Estación destacada por el cursor, la interfaz o el foco automático táctil. */
  focused: StationId | null;
  /** Estación más cercana al centro de la vista. */
  active: StationId;
  /** Proyecto con la ficha desplegada (clic en la máquina, su globo o el índice). */
  selected: StationId | null;
  menuOpen: boolean;
  section: Section;
  /** La línea avanza sola en reposo (el visitante puede pararla; con «reducir movimiento» empieza parada). */
  lineOn: boolean;
  /** La cámara ha llegado al final de la línea (embaladora y puerta de salida): la ficha es el contacto. */
  atExit: boolean;
  /** Máquina en vista explosionada (se pide desde su ficha; la línea se para mientras tanto). */
  exploded: StationId | null;
  /** La nave no se puede dibujar (sin WebGL, o el lienzo falló): la línea se lee como un juego de láminas. */
  flat: boolean;
  /**
   * Al principio de la línea, antes de recorrerla: la ficha presenta a Joel (quién, qué, dónde). El
   * primer gesto o cualquier ir a una estación la deja; volver al inicio la recupera.
   */
  intro: boolean;
};

type Listener = () => void;

export type ViewArea = { l: number; t: number; r: number; b: number };

export const runtime = {
  lenis: null as Lenis | null,
  /** Progreso suavizado del scroll (0..1). */
  progress: 0,
  /** X del centro de la vista. */
  cameraX: CAMERA.startX as number,
  /** Mundo → px CSS de la vista actual (null hasta el primer frame). */
  project: null as ((x: number, y: number, z: number) => [number, number]) | null,
  /**
   * Hueco de la pantalla que deja libre la interfaz en las pantallas compactas (px CSS, de la barra a
   * la ficha): la cámara encuadra ahí la máquina (ui/useViewArea). Null en escritorio, donde la ficha
   * flota sobre la nave y el encuadre es el de siempre.
   */
  view: null as ViewArea | null,
  sceneHover: null as StationId | null,
  uiHover: null as StationId | null,
  autoFocus: null as StationId | null,
  fx: Object.fromEntries(STATIONS.map((s) => [s.id, { level: 0 }])) as Record<StationId, StationFx>,
  /** Pide un frame a la escena (lo conecta el lienzo). */
  invalidate: () => {},
  /** Px internos del pipeline de tinta por px de lienzo (1 o 2). */
  supersample: 1,
  /** Marcapasos: 1 = se pinta en cada refresco; 2 = uno de cada dos (60 fps estables en 120 Hz). */
  pace: 1,
  /** Este frame no se pinta (lo decide el marcapasos, o el compás si no cambia ningún píxel). */
  skipFrame: false,
  /** Frames pintados desde la carga (para los scripts de medida). */
  drawn: 0,
  /** Banco de pruebas: se pinta cada frame aunque no haya cambios. */
  forceDraw: false,
  /**
   * Cajas del mundo (min y max, planas de seis en seis) que han cambiado desde el último frame
   * pintado: el pase de tinta solo rehace esa parte de la imagen.
   */
  dirty: [] as number[],
  /** Un sistema animado pidió este frame para seguir su movimiento (y no un cambio ajeno a la escena). */
  ambient: false,
  /** Ms hasta el próximo cambio que espera algún sistema quieto (lo convierte en un temporizador el programador). */
  nextWake: Infinity,
  /** Noche (0..1): los focos colgantes quedan encendidos a media luz. */
  night: 0,
  /** El próximo frame se pinta entero (un cambio que afecta a media imagen, como la luz del sol). */
  fullNext: false,
  /**
   * Recuento de frames completos, parciales (cámara quieta), desplazados (cámara en movimiento: el
   * frame anterior desplazado más lo nuevo) y de solo luz (cambia un foco con la cámara quieta),
   * fracción de pantalla repintada acumulada y motivo de los completos (medidas).
   */
  stats: { full: 0, partial: 0, shift: 0, relight: 0, area: 0, why: {} as Record<string, number> },
};

let snapshot: Snapshot = {
  focused: null,
  active: STATIONS[0].id,
  selected: null,
  menuOpen: false,
  section: 'projects',
  lineOn: true,
  atExit: false,
  exploded: null,
  flat: false,
  intro: true,
};
const listeners = new Set<Listener>();
const frameListeners = new Set<Listener>();

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
export const getSnapshot = () => snapshot;

function patch(next: Partial<Snapshot>) {
  const keys = Object.keys(next) as (keyof Snapshot)[];
  if (keys.every((k) => snapshot[k] === next[k])) return;
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

/** Se llama tras colocar la cámara en cada frame renderizado. */
export function onFrame(l: Listener) {
  frameListeners.add(l);
  return () => void frameListeners.delete(l);
}
export function emitFrame() {
  frameListeners.forEach((l) => l());
}

function refreshFocus() {
  const focused = runtime.uiHover ?? runtime.sceneHover ?? runtime.autoFocus;
  if (focused !== snapshot.focused) {
    patch({ focused });
    runtime.invalidate();
  }
}

export function setSceneHover(id: StationId | null) {
  runtime.sceneHover = id;
  refreshFocus();
}
export function setUiHover(id: StationId | null) {
  runtime.uiHover = id;
  refreshFocus();
}
export function setAutoFocus(id: StationId | null) {
  runtime.autoFocus = id;
  refreshFocus();
}
/**
 * Sin ningún foco enganchado: un elemento que desaparece bajo el cursor (la ficha al entrar en un
 * proyecto) no avisa de que el cursor ha salido, y su foco se quedaba encendido al volver a la línea
 * tapando el de las máquinas. Se llama al montar y al desmontar la escena.
 */
export function resetFocus() {
  runtime.uiHover = null;
  runtime.sceneHover = null;
  runtime.autoFocus = null;
  for (const s of STATIONS) runtime.fx[s.id].level = 0;
  refreshFocus();
}
/**
 * Lo que hay que pasar de la frontera entre dos paradas (m) para cambiar de una a otra: con un scroll
 * que va y viene justo en la frontera, la ficha no oscila entre las dos.
 */
const STOP_MARGIN = 0.6;

/** Estación en curso según la cámara, con margen en las fronteras. */
export function updateActive(cameraX: number) {
  const best = nearestStation(cameraX);
  const cur = STATION_BY_ID[snapshot.active];
  if (best.id !== cur.id && Math.abs(cur.x - cameraX) - Math.abs(best.x - cameraX) > 2 * STOP_MARGIN) patch({ active: best.id });
}
export function setSelected(id: StationId | null) {
  // Al cerrar la ficha o pasar a otra máquina, la que estaba abierta se vuelve a montar.
  patch({ selected: id, exploded: snapshot.exploded === id ? id : null, ...(id ? { intro: false } : {}) });
}

/** Se empieza a recorrer la línea (un gesto de scroll): la ficha deja la presentación. */
export function leaveIntro() {
  patch({ intro: false });
}

/** Vista explosionada de la máquina de la ficha: abre o vuelve a montar. */
export function toggleExplode(id: StationId) {
  patch({ exploded: snapshot.exploded === id ? null : id });
  runtime.invalidate();
}

/** Pasado el robot, a media distancia de la embaladora, la cámara ya mira el final de la línea. */
const EXIT_FROM_X = (STATION_X.robotic + END.packX) / 2 + 0.5;
export function updateExit(cameraX: number) {
  patch({ atExit: cameraX > EXIT_FROM_X + (snapshot.atExit ? -STOP_MARGIN : STOP_MARGIN) });
}
/** Declara que una caja del mundo ha cambiado en este frame. */
export function markDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  runtime.dirty.push(x0, y0, z0, x1, y1, z1);
}

/** Algo ha cambiado en toda la imagen: el próximo frame se pinta entero. */
export function markFull() {
  runtime.fullNext = true;
  runtime.invalidate();
}

/** Pide el frame siguiente para continuar una animación. */
export function requestAmbient() {
  runtime.ambient = true;
  runtime.invalidate();
}

/** Un sistema quieto que cambiará dentro de `ms`: se le despierta entonces, sin gastar frames mientras espera. */
export function wakeIn(ms: number) {
  if (ms >= 0 && ms < runtime.nextWake) runtime.nextWake = ms;
}

export function setLineOn(on: boolean) {
  patch({ lineOn: on });
  runtime.invalidate();
}

/* ---------- Panel ---------- */

export function openMenu(section: Section = snapshot.section) {
  patch({ menuOpen: true, section, selected: null, exploded: null });
  runtime.lenis?.stop();
}
export function closeMenu() {
  if (!snapshot.menuOpen) return;
  patch({ menuOpen: false });
  runtime.lenis?.start();
}
/** Pestaña de la barra: abre en esa sección, cambia de sección o, si ya está en ella, cierra. */
export function toggleSection(section: Section) {
  if (snapshot.menuOpen && snapshot.section === section) closeMenu();
  else openMenu(section);
}
export function toggleMenu() {
  if (snapshot.menuOpen) closeMenu();
  else openMenu();
}

/* ---------- Recorrido: scroll ↔ X de cámara ---------- */

/**
 * Curva de recorrido: lineal en el centro y con arranque/frenada suaves en los extremos.
 * La velocidad sube de `edgeSpeed` a 1 en la primera fracción `edgeEase` y baja igual al final.
 */
function edgeEase(t: number) {
  const a = SCROLL.edgeEase;
  const k = SCROLL.edgeSpeed;
  const ramp = (s: number) => k * s + ((1 - k) * s * s) / (2 * a);
  const total = 1 - a * (1 - k);
  let p: number;
  if (t <= a) p = ramp(t);
  else if (t >= 1 - a) p = total - ramp(1 - t);
  else p = ramp(a) + (t - a);
  return p / total;
}

export function cameraXAt(progress: number) {
  const t = Math.min(1, Math.max(0, progress));
  return CAMERA.startX + (CAMERA.endX - CAMERA.startX) * edgeEase(t);
}

/** Inversa de `cameraXAt` (monótona): bisección. */
function progressAtX(x: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cameraXAt(mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Estación más cercana a una X de cámara. */
function nearestStation(x: number) {
  let best = STATIONS[0];
  for (const s of STATIONS) if (Math.abs(s.x - x) < Math.abs(best.x - x)) best = s;
  return best;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const stationProgress = (id: StationId) => progressAtX(Math.min(CAMERA.endX, Math.max(CAMERA.startX, STATION_BY_ID[id].x)));

function scrollToProgress(p: number, immediate = false) {
  const lenis = runtime.lenis;
  if (!lenis) return;
  pendingGoal = lenis.isStopped && !snapshot.menuOpen ? p : null;
  const target = p * lenis.limit;
  const distance = Math.abs(target - lenis.animatedScroll) / Math.max(1, lenis.limit);
  lenis.scrollTo(target, { duration: 0.9 + 1.3 * Math.sqrt(distance), easing: easeInOutCubic, force: true, immediate });
  runtime.invalidate();
}

/**
 * Final del arranque: el scroll vuelve a andar. Lenis, al arrancar, descarta el recorrido que tuviera
 * a medias: si durante la entrada de la interfaz se pidió una parada (el pie, «empezar la línea»), la
 * cámara se quedaba a pocos px del inicio con la ficha de otra máquina. Se retoma.
 */
export function resumeScroll() {
  const lenis = runtime.lenis;
  if (!lenis) return;
  const goal = pendingGoal;
  pendingGoal = null;
  lenis.start();
  if (goal !== null) scrollToProgress(goal);
}

/** Parada pedida con el scroll parado por el arranque (Lenis no la recuerda: ver resumeScroll). */
let pendingGoal: number | null = null;

/**
 * Lleva la cámara a centrar una estación; con `select` además despliega su ficha. Sin `select`, una
 * ficha abierta de otra máquina se recoge: la cámara y la ficha nunca hablan de proyectos distintos.
 */
export function goToStation(id: StationId, { select = false } = {}) {
  if (snapshot.flat) return scrollToSheet(id);
  leaveIntro();
  scrollToProgress(stationProgress(id));
  if (select) setSelected(id);
  else if (snapshot.selected !== null && snapshot.selected !== id) setSelected(null);
}

export function goHome() {
  if (snapshot.flat) return scrollToSheet(null);
  setSelected(null);
  patch({ intro: true });
  scrollToProgress(0);
}

/** Al final de la línea: la puerta de salida y el contacto. */
export function goToExit() {
  if (snapshot.flat) return scrollToSheet(EXIT_HASH);
  setSelected(null);
  leaveIntro();
  scrollToProgress(1);
}

/**
 * Parada anterior o siguiente: la presentación, las estaciones y el final de la línea. Con una ficha
 * abierta se abre la de la parada siguiente (la ficha y el pie del móvil usan lo mismo).
 */
export function stepLine(dir: 1 | -1) {
  const { intro, atExit, selected, active } = snapshot;
  const exit = atExit && selected === null;
  const at = intro && selected === null && !exit ? -1 : exit ? STATIONS.length : STATIONS.findIndex((s) => s.id === (selected ?? active));
  const k = at + dir;
  if (k < 0) goHome();
  else if (k >= STATIONS.length) goToExit();
  else goToStation(STATIONS[k].id, { select: selected !== null });
}

/* ---------- La línea en láminas (sin WebGL) ---------- */

/**
 * La nave no se puede dibujar: la portada pasa a ser una página que se desplaza, con una lámina por
 * estación y el contacto al final (ui/FlatLine). No hay ficha ni despiece: cada lámina lleva a su hoja.
 */
export function setFlat() {
  // Sin ficha no hay presentación: la hace la cabecera de la página.
  patch({ flat: true, selected: null, exploded: null, focused: null, intro: false });
}

/** Lámina que se está leyendo (una estación, o null para el final de la línea): la sigue la barra. */
export function setFlatStop(id: StationId | null) {
  patch(id ? { active: id, atExit: false } : { atExit: true });
}

/** Sin cámara, el recorrido es el de la página: lleva a la lámina con ese id (o arriba del todo). */
function scrollToSheet(id: string | null) {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const el = id ? document.getElementById(id) : null;
  if (el) el.scrollIntoView({ behavior, block: 'start' });
  else window.scrollTo({ top: 0, behavior });
}

/* ---------- Ida y vuelta a la página de un proyecto ---------- */

const RETURN_KEY = 'factory:return';

/** Recuerda la estación de la que se sale para volver a ella. */
export function rememberReturn(id: StationId) {
  try {
    sessionStorage.setItem(RETURN_KEY, id);
  } catch {}
}

/**
 * Vista inicial, sin animación: si se vuelve de un proyecto, su estación con la ficha abierta; si
 * no, lo que nombre el fragmento de la URL (un enlace compartido a una estación o al contacto).
 */
export function restoreView() {
  let id: string | null = null;
  try {
    id = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {}
  if (isStationId(id)) goToHash(id, true);
  else goToHash(location.hash, true);
}

/* ---------- Enlace propio de cada estación ---------- */

/** Fragmento del final de la línea. Las estaciones usan su id, el mismo que su página de proyecto. */
const EXIT_HASH = 'contact';

/** Lo que se mira, como fragmento de la URL: la ficha abierta, el final de la línea o la estación en curso (el inicio, sin fragmento). */
function hashOf({ selected, active, atExit }: Snapshot) {
  if (selected) return selected;
  if (atExit) return EXIT_HASH;
  return active === STATIONS[0].id ? '' : active;
}

/** Lleva la cámara a lo que nombra un fragmento: una estación (con su ficha abierta) o el contacto. */
function goToHash(hash: string, immediate = false) {
  const id = hash.replace(/^#/, '');
  if (id === EXIT_HASH) {
    setSelected(null);
    leaveIntro();
    scrollToProgress(1, immediate);
  } else if (isStationId(id)) {
    scrollToProgress(stationProgress(id), immediate);
    setSelected(id);
  }
}

/**
 * La URL sigue al recorrido (#structure, #contact…) sin añadir entradas al historial: la barra de
 * direcciones siempre tiene un enlace a lo que se está mirando. Cambiar el fragmento a mano lleva allí.
 * Solo escribe cuando cambia lo que se mira: al cargar no borra el fragmento antes de que se lea.
 */
export function linkHash() {
  let written = location.hash.slice(1);
  const sync = () => {
    const hash = hashOf(snapshot);
    if (hash === written) return;
    written = hash;
    history.replaceState(history.state, '', hash ? `#${hash}` : location.pathname + location.search);
  };
  const onHashChange = () => {
    written = location.hash.slice(1);
    goToHash(location.hash);
  };
  listeners.add(sync);
  window.addEventListener('hashchange', onHashChange);
  return () => {
    listeners.delete(sync);
    window.removeEventListener('hashchange', onHashChange);
  };
}

// Acceso para los scripts de verificación (Playwright), solo en desarrollo.
if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || process.env.PERF_HOOKS === '1')) {
  (window as unknown as { __factory: object }).__factory = { runtime, goToStation, goHome, goToExit, getSnapshot, setSelected, toggleExplode };
}
