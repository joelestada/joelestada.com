'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LAMP } from '@/config/layout';
import { palette } from '@/config/palette';
import { STATIONS } from '@/config/stations';
import { runtime } from '@/lib/runtime';
import { DECAL_LAYER } from '../materials';
import { nextInkId } from '../kit/primitives';
import { BAND, RISE, WOBBLE, boot, bootActive } from '../boot';
import { PAPER_SIZE, paperTexture } from './paper';
import { compositeFragment, fullscreenVertex, inkMaskFragment, lightFragment, normalIdFragment, normalIdVertex, SPOT_COUNT } from './inkShaders';

/** Radio del laplaciano en px internos → trazo grueso de ~2 px CSS. */
const THICK_RADIUS = 2;
/** Salto de profundidad mínimo (m) para considerar silueta. */
const DEPTH_THRESHOLD = 0.035;
/** 1 - cos(ángulo) mínimo para considerar arista interior (~24°). */
const NORMAL_THRESHOLD = 0.085;
/** Desregistro de la capa de color, en px CSS. */
const MISREGISTER: [number, number] = [0.8, -0.6];
/** Desregistro de más con el que entra el color en el arranque (px CSS): la plancha cae en su sitio. */
const BOOT_MISREGISTER: [number, number] = [5.5, -4.1];
const GRAIN = 0.035;
const MOTTLE = 0.025;
const INK_VARIATION = 0.12;
/** Aristas interiores al 58 % de la silueta: jerarquía de línea de plano, no contorno de dibujo animado. */
const THIN_INK = 0.58;

/**
 * Repintado parcial: margen de cada zona y relleno extra de la escena (px de dibujo; cubren el
 * trazo, que se sale un poco de la pieza, y el desregistro del color) y pintado completo de arranque.
 */
const DIRTY_MARGIN = 8;
const SCENE_PAD = 8;
const WARMUP_MS = 3000;
/** Por encima de esta fracción de pantalla sale más a cuenta pintarla entera. */
const PARTIAL_MAX_AREA = 0.5;
/** Frames solo de ambiente: como mucho 60 fps (en pantallas de 120 Hz, un refresco de cada dos). */
const AMBIENT_FRAME_MS = 14;

/**
 * Desplazamiento: la cámara solo se mueve en píxeles enteros y todo lo pintado va anclado al mundo
 * (papel, luz, piezas ajustadas a la rejilla), así que el frame anterior desplazado es exacto. Solo se
 * pinta la franja que entra por el borde y un margen: los píxeles del borde anterior se calcularon con
 * vecinos recortados (trazo ±2 px, desregistro del color y luz a media resolución, unos 4 px).
 * Un salto mayor que `SHIFT_MAX` de la pantalla se pinta entero.
 */
const SHIFT_MARGIN = 8;
const SHIFT_MAX = 0.35;
/**
 * Agrupación de zonas: dos zonas se funden si su caja común no añade más que esta fracción de
 * pantalla. Los pases de pantalla admiten poca (cada zona es un pase barato); los de escena mucha,
 * porque cada grupo es un recorrido de la escena con todas sus draw calls (medido en un MacBook Air
 * a pantalla completa: de 0,15 a 0,3 la CPU de escena baja un 20 % y la latencia de GPU no cambia).
 */
const ZONE_SLACK = 0.004;
const SCENE_SLACK = 0.3;
/**
 * Refresco rodante: en cada frame parcial se rehace además una banda horizontal, y en `REFRESH_BANDS`
 * frames la pantalla entera (por si algo cambió sin declararlo). Repartido así no hay picos.
 */
const REFRESH_BANDS = 90;
/**
 * Descarte por conjuntos en los pases por zonas: una máquina cuya caja no toca la zona no se recorre
 * (three.js visita cada nodo visible en cada pase). Margen de la caja (m): lo que se mueve dentro de
 * la máquina (brazo, piezas del despiece).
 */
const CULL_MARGIN = 1.5;
/**
 * Descarte por piezas en los pases por zonas: dentro de los conjuntos que tocan la zona, solo se dibujan
 * las mallas cuya esfera envolvente la toca. three.js solo descarta lo que cae fuera de la cámara, así
 * que la banda del refresco rodante (todo el ancho) o una franja de 8 px en el borde volvían a dibujar
 * casi todas las piezas a la vista: tantas llamadas como un pintado completo. En Safari cada llamada
 * pasa por el proceso de la GPU antes de presentar el frame (el hilo principal lo espera), así que el
 * coste de cada frame era el de la nave entera. Margen extra (px de dibujo) por el redondeo.
 */
const PART_MARGIN = 2;

/** Rectángulo en px de dibujo, origen arriba a la izquierda. */
type Rect = { x0: number; y0: number; x1: number; y1: number };

const area = (r: Rect) => (r.x1 - r.x0) * (r.y1 - r.y0);

/**
 * Funde zonas (en su sitio) mientras la caja común no añada más de `slack` px² a las dos por separado:
 * lo que se solapa no se pinta dos veces y lo lejano (dos franjas en bordes opuestos) sigue aparte.
 */
function mergeZones(zones: Rect[], slack: number) {
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      const x0 = Math.min(a.x0, b.x0);
      const y0 = Math.min(a.y0, b.y0);
      const x1 = Math.max(a.x1, b.x1);
      const y1 = Math.max(a.y1, b.y1);
      if ((x1 - x0) * (y1 - y0) > area(a) + area(b) + slack) continue;
      a.x0 = x0;
      a.y0 = y0;
      a.x1 = x1;
      a.y1 = y1;
      zones.splice(j, 1);
      j = i;
    }
  }
  return zones;
}

/** Encendido de los focos por la noche (0..1). */
const NIGHT_LAMP = 0.42;

/** Oscurecimiento del resto de la nave con el foco encendido. */
const SPOT_DIM = 0.09;
/** Densidad del haz (1/m) y realce de las superficies iluminadas. */
const SPOT_HAZE = 0.27;
const SPOT_POOL = 0.18;

function makeTarget(opts: { srgb: boolean; linear: boolean; depthTexture?: boolean; depthBuffer?: boolean }) {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.UnsignedByteType,
    colorSpace: opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace,
    minFilter: opts.linear ? THREE.LinearFilter : THREE.NearestFilter,
    magFilter: opts.linear ? THREE.LinearFilter : THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: opts.depthBuffer ?? true,
    stencilBuffer: false,
  });
  if (opts.depthTexture) {
    rt.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
    rt.depthTexture.minFilter = THREE.NearestFilter;
    rt.depthTexture.magFilter = THREE.NearestFilter;
  }
  return rt;
}

function fullscreen(material: THREE.ShaderMaterial) {
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return scene;
}

/**
 * Pipeline de render propio: toma el control del frame (prioridad 1) y pinta
 * color → normales/ID → máscara de tinta → composición en papel.
 *
 * Solo repinta lo que cambia: con la cámara quieta, las zonas que declaran las animaciones; al
 * desplazarse, además, la franja que entra por el borde (el resto es el frame anterior desplazado).
 * El coste de un frame de scroll depende del perímetro de la pantalla, no de su área.
 */
export function InkPass() {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const gl = useThree((s) => s.gl);

  const pipeline = useMemo(() => {
    const color = makeTarget({ srgb: true, depthTexture: true, linear: true });
    const normal = makeTarget({ srgb: false, linear: false });
    const ink = makeTarget({ srgb: false, linear: true, depthBuffer: false });
    /** Luz de los focos a media resolución (se muestrea con filtrado lineal). */
    const light = makeTarget({ srgb: false, linear: true, depthBuffer: false });
    /** Copia del lienzo para desplazarlo (mismo formato que el lienzo: la copia es exacta). */
    const shift = makeTarget({ srgb: false, linear: false, depthBuffer: false });

    const normalId = new THREE.ShaderMaterial({
      vertexShader: normalIdVertex,
      fragmentShader: normalIdFragment,
      uniforms: { uInkId: { value: 0 } },
      side: THREE.DoubleSide,
    });
    // Valor por defecto del atributo cuando la geometría no lo trae (mallas sin fusionar).
    (normalId as THREE.ShaderMaterial & { defaultAttributeValues: Record<string, number[]> }).defaultAttributeValues = {
      ...normalId.defaultAttributeValues,
      aInkId: [0],
    };
    normalId.onBeforeRender = (_r, _s, _c, _g, object) => {
      if (object.userData.inkId === undefined) object.userData.inkId = nextInkId();
      normalId.uniforms.uInkId.value = object.userData.inkId;
      normalId.uniformsNeedUpdate = true;
    };

    const inkMask = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: inkMaskFragment,
      uniforms: {
        tDepth: { value: color.depthTexture },
        tNormal: { value: normal.texture },
        uNear: { value: 1 },
        uFar: { value: 100 },
        uDepthTh: { value: DEPTH_THRESHOLD },
        uNormalTh: { value: NORMAL_THRESHOLD },
        uThick: { value: THICK_RADIUS },
        uBoot: { value: 1 },
        uCamPos: { value: new THREE.Vector3() },
        uCamRight: { value: new THREE.Vector3() },
        uCamUp: { value: new THREE.Vector3() },
        uCamFwd: { value: new THREE.Vector3() },
        uFront: { value: new THREE.Vector4(0, 0, 0, RISE) },
        uBand: { value: new THREE.Vector3(BAND.thick, BAND.thin, BAND.color) },
        uWobble: { value: WOBBLE },
      },
      depthTest: false,
      depthWrite: false,
    });

    const lightPass = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: lightFragment,
      uniforms: {
        tDepth: { value: color.depthTexture },
        uInternalRes: { value: new THREE.Vector2(1, 1) },
        uParity: { value: new THREE.Vector2() },
        uCamPos: { value: new THREE.Vector3() },
        uCamRight: { value: new THREE.Vector3() },
        uCamUp: { value: new THREE.Vector3() },
        uCamFwd: { value: new THREE.Vector3() },
        uNear: { value: 1 },
        uFar: { value: 100 },
        uSpots: { value: Array.from({ length: SPOT_COUNT }, () => new THREE.Vector4()) },
        uSpotMouth: { value: LAMP.mouth },
        uSpotTan: { value: Math.tan((LAMP.halfAngleDeg * Math.PI) / 180) },
        uHaze: { value: SPOT_HAZE },
      },
      depthTest: false,
      depthWrite: false,
    });

    const composite = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: compositeFragment,
      uniforms: {
        tColor: { value: color.texture },
        tInk: { value: ink.texture },
        tLight: { value: light.texture },
        tPaper: { value: paperTexture() },
        uPaperSize: { value: PAPER_SIZE },
        uScreenRes: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: 1 },
        uMisregister: { value: new THREE.Vector2(...MISREGISTER) },
        uPaperOffset: { value: new THREE.Vector2() },
        uInk: { value: new THREE.Color(palette.ink) },
        uGrain: { value: GRAIN },
        uMottle: { value: MOTTLE },
        uInkVariation: { value: INK_VARIATION },
        uThinInk: { value: THIN_INK },
        uLevel: { value: 0 },
        uLightRes: { value: new THREE.Vector2(1, 1) },
        uLightParity: { value: new THREE.Vector2() },
        uLightScale: { value: 1 },
        uLight: { value: new THREE.Color(palette.lampLight) },
        uDim: { value: SPOT_DIM },
        uPool: { value: SPOT_POOL },
        uBoot: { value: 1 },
        uPaperColor: { value: new THREE.Color(palette.floor) },
      },
      depthTest: false,
      depthWrite: false,
    });

    return {
      color,
      normal,
      ink,
      light,
      shift,
      normalId,
      inkMask,
      lightPass,
      composite,
      inkScene: fullscreen(inkMask),
      lightScene: fullscreen(lightPass),
      compositeScene: fullscreen(composite),
      quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      paper: new THREE.Color(palette.floor),
      /** Normal/ID vacíos: sin pieza. */
      empty: new THREE.Color(0, 0, 0),
      drawingBuffer: new THREE.Vector2(),
    };
  }, []);

  // Resolución interna = la del lienzo (que ajusta Resolution) por un supermuestreo entero.
  // Se comprueba en cada frame: el supermuestreo puede cambiar sin que cambie el dpr.
  const fit = () => {
    const scale = dpr * runtime.supersample;
    const w = Math.max(1, Math.floor(size.width * scale));
    const h = Math.max(1, Math.floor(size.height * scale));
    if (pipeline.color.width === w && pipeline.color.height === h) return false;
    frame.valid = false;
    pipeline.color.setSize(w, h);
    pipeline.normal.setSize(w, h);
    pipeline.ink.setSize(w, h);
    // Rejilla de la luz anclada al mundo: un texel por cada 2 px internos, más holgura para la paridad.
    pipeline.light.setSize(Math.floor(w / 2) + 3, Math.floor(h / 2) + 3);
    pipeline.shift.setSize(Math.max(1, Math.floor(size.width * dpr)), Math.max(1, Math.floor(size.height * dpr)));
    return true;
  };
  useLayoutEffect(() => void fit());

  // Todos los programas de la nave al montar (en el arranque): los de las piezas que aún no se ven
  // (rótulos de las cajas, líneas de flujo) se compilarían al entrar en cámara, en pleno recorrido,
  // con una espera a la GPU. Con KHR_parallel_shader_compile se enlazan en paralelo sin bloquear.
  // Cada escena con su objetivo real: la variante del programa depende de él (salida lineal o sRGB).
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const p = pipeline;
    const passes = [
      [scene, camera, p.color],
      [p.inkScene, p.quadCamera, p.ink],
      [p.lightScene, p.quadCamera, p.light],
      [p.compositeScene, p.quadCamera, null],
    ] as const;
    for (const [s, c, target] of passes) {
      gl.setRenderTarget(target);
      gl.compileAsync(s, c).catch(() => {});
    }
    gl.setRenderTarget(null);
  }, [gl, scene, camera, pipeline]);

  useEffect(
    () => () => {
      pipeline.color.dispose();
      pipeline.normal.dispose();
      pipeline.ink.dispose();
      pipeline.light.dispose();
      pipeline.shift.dispose();
      pipeline.lightPass.dispose();
      pipeline.normalId.dispose();
      pipeline.inkMask.dispose();
      pipeline.composite.dispose();
    },
    [pipeline],
  );

  // Perfilado de GPU por pase (solo desarrollo): window.__gpu() devuelve ms medios por pase.
  const timer = useMemo(() => {
    if ((process.env.NODE_ENV === 'production' && process.env.PERF_HOOKS !== '1') || typeof window === 'undefined') return null;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    if (!ext) return null;
    const pending: { name: string; q: WebGLQuery }[] = [];
    const totals: Record<string, { ms: number; n: number }> = {};
    const t = {
      begin(name: string) {
        const q = ctx.createQuery()!;
        ctx.beginQuery(ext.TIME_ELAPSED_EXT, q);
        pending.push({ name, q });
      },
      end() {
        ctx.endQuery(ext.TIME_ELAPSED_EXT);
      },
      collect() {
        while (pending.length && ctx.getQueryParameter(pending[0].q, ctx.QUERY_RESULT_AVAILABLE)) {
          const { name, q } = pending.shift()!;
          const ns = ctx.getQueryParameter(q, ctx.QUERY_RESULT) as number;
          ctx.deleteQuery(q);
          if (ctx.getParameter(ext.GPU_DISJOINT_EXT)) continue;
          const e = (totals[name] ??= { ms: 0, n: 0 });
          e.ms += ns / 1e6;
          e.n++;
        }
      },
    };
    (window as unknown as { __gpu: (reset?: boolean) => Record<string, number> }).__gpu = (reset = false) => {
      const out = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, +(v.ms / Math.max(1, v.n)).toFixed(2)]));
      if (reset) for (const k of Object.keys(totals)) delete totals[k];
      return out;
    };
    return t;
  }, [gl]);

  /**
   * Conjuntos descartables (`userData.zoneCull`): su caja en el mundo y su rectángulo en pantalla este
   * frame. Y cada pieza suelta a la vista con el rectángulo de su esfera envolvente (`parts`, los
   * `count` primeros; se reutilizan de frame en frame).
   */
  const cull = useMemo(
    () => ({
      list: [] as { object: THREE.Object3D; box: THREE.Box3; rect: Rect; was: boolean }[],
      corner: new THREE.Vector3(),
      parts: [] as { object: THREE.Object3D; rect: Rect; hidden: boolean }[],
      count: 0,
      sphere: new THREE.Sphere(),
      center: new THREE.Vector3(),
    }),
    [],
  );

  // Estado entre frames del repintado parcial.
  const frame = useMemo(
    () => ({
      mounted: performance.now(),
      lastDraw: 0,
      /** Desplazamiento de cámara (px de dibujo) y zoom del último frame pintado. */
      cam: [NaN, NaN, NaN],
      /** Encendido de cada foco en el último frame pintado (Float64: se compara con valores de JS). */
      levels: new Float64Array(STATIONS.length).fill(-1),
      rects: [] as Rect[],
      /** Banda del refresco rodante que toca. */
      band: 0,
      /**
       * Color, normales, profundidad y tinta valen en toda la pantalla (tras un pintado completo, y
       * mientras la cámara no se desplace): un cambio de luz solo rehace la luz y la composición.
       */
      valid: false,
      draw: null as null | ((zones: Rect[] | null, shiftX?: number, shiftY?: number, relight?: boolean) => void),
    }),
    [],
  );
  const invalidate = useThree((s) => s.invalidate);

  /** Zonas declaradas → rectángulos en px de dibujo (origen arriba a la izquierda). */
  const dirtyRects = (width: number, height: number): Rect[] | null => {
    const d = runtime.dirty;
    const project = runtime.project;
    if (!project) return null;
    const pr = gl.getPixelRatio();
    const rects = frame.rects;
    rects.length = 0;
    for (let k = 0; k < d.length; k += 6) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        const [cx, cy] = project(i & 1 ? d[k + 3] : d[k], i & 2 ? d[k + 4] : d[k + 1], i & 4 ? d[k + 5] : d[k + 2]);
        x0 = Math.min(x0, cx * pr);
        y0 = Math.min(y0, cy * pr);
        x1 = Math.max(x1, cx * pr);
        y1 = Math.max(y1, cy * pr);
      }
      const r = {
        x0: Math.max(0, Math.floor(x0 - DIRTY_MARGIN)),
        y0: Math.max(0, Math.floor(y0 - DIRTY_MARGIN)),
        x1: Math.min(width, Math.ceil(x1 + DIRTY_MARGIN)),
        y1: Math.min(height, Math.ceil(y1 + DIRTY_MARGIN)),
      };
      if (r.x1 > r.x0 && r.y1 > r.y0) rects.push(r);
    }
    return rects;
  };

  /**
   * Franjas que deja al descubierto un desplazamiento de (sx, sy) px de dibujo (GL: y hacia arriba),
   * con su margen hacia dentro.
   */
  const addExposed = (rects: Rect[], sx: number, sy: number, width: number, height: number) => {
    const m = SHIFT_MARGIN;
    if (sx > 0) rects.push({ x0: 0, y0: 0, x1: Math.min(width, sx + m), y1: height });
    else if (sx < 0) rects.push({ x0: Math.max(0, width + sx - m), y0: 0, x1: width, y1: height });
    // La imagen sube (sy > 0): entra por abajo; baja: entra por arriba.
    if (sy > 0) rects.push({ x0: 0, y0: Math.max(0, height - sy - m), x1: width, y1: height });
    else if (sy < 0) rects.push({ x0: 0, y0: 0, x1: width, y1: Math.min(height, -sy + m) });
  };

  /** Recorte de un objetivo de render a un rectángulo en px de dibujo, escalado a su resolución. */
  const scissorTarget = (rt: THREE.WebGLRenderTarget, r: Rect | null, width: number, height: number, pad = 0) => {
    if (!r) {
      rt.scissorTest = false;
      return;
    }
    const sx = rt.width / width;
    const sy = rt.height / height;
    const x0 = Math.max(0, Math.floor(r.x0 * sx) - pad);
    const x1 = Math.min(rt.width, Math.ceil(r.x1 * sx) + pad);
    const y0 = Math.max(0, Math.floor((height - r.y1) * sy) - pad);
    const y1 = Math.min(rt.height, Math.ceil((height - r.y0) * sy) + pad);
    rt.scissor.set(x0, y0, x1 - x0, y1 - y0);
    rt.scissorTest = true;
  };

  /**
   * Recorte de la luz: los texels cuya huella alcanza la zona (desregistro del color y filtrado
   * bilineal incluidos), en la rejilla anclada al mundo.
   */
  const scissorLight = (r: Rect | null, height: number, parity: THREE.Vector2) => {
    const rt = pipeline.light;
    if (!r) {
      rt.scissorTest = false;
      return;
    }
    const s = runtime.supersample;
    const texel = (px: number, p: number) => (px * s - p + 1.5) * 0.5;
    const x0 = Math.max(0, Math.floor(texel(r.x0 - 4, parity.x)) - 1);
    const x1 = Math.min(rt.width, Math.ceil(texel(r.x1 + 4, parity.x)) + 1);
    const y0 = Math.max(0, Math.floor(texel(height - r.y1 - 4, parity.y)) - 1);
    const y1 = Math.min(rt.height, Math.ceil(texel(height - r.y0 + 4, parity.y)) + 1);
    rt.scissor.set(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    rt.scissorTest = true;
  };

  useFrame(({ scene, camera }) => {
    // Frame saltado por el marcapasos: el lienzo conserva el anterior (cadencia estable).
    if (runtime.skipFrame && !runtime.forceDraw) return;
    const now = performance.now();
    const resized = fit();
    const p = pipeline;
    const cam = camera as THREE.OrthographicCamera;

    // Luz de los focos (lo único que cambia al pasar el cursor).
    let level = 0;
    let levelChanged = false;
    const lu = p.lightPass.uniforms;
    STATIONS.forEach((st, i) => {
      // De noche los focos quedan a media luz; al pasar el cursor, el de la estación se enciende del todo.
      // En el arranque se encienden uno tras otro a lo largo de la línea.
      const l = Math.max(runtime.fx[st.id].level, NIGHT_LAMP * runtime.night * boot.power[i], boot.lamps[i]);
      // Arranque de lámpara: sube rápido y asienta suave.
      const on = l * l * (3 - 2 * l);
      level = Math.max(level, on);
      lu.uSpots.value[i].set(st.x + st.lamp[0], st.lamp[1], st.lamp[2], on);
      if (frame.levels[i] !== on) levelChanged = true;
    });

    // ¿Qué hay que pintar? Todo si cambia algo que afecta a la imagen entera (luz, tamaño, zoom, un
    // salto de cámara); si la cámara se desplaza, el frame anterior desplazado más la franja que entra;
    // además, las zonas que declaran las animaciones; nada si una animación pidió frame y no movió
    // ningún píxel.
    const offset = cam.userData.pixelOffset as [number, number] | undefined;
    const ambient = runtime.ambient;
    runtime.ambient = false;
    gl.getDrawingBufferSize(p.drawingBuffer);
    const width = p.drawingBuffer.x;
    const height = p.drawingBuffer.y;
    // Desplazamiento de la imagen desde el último frame pintado (px de dibujo, GL: y hacia arriba).
    let shiftX = 0;
    let shiftY = 0;
    let jump = !offset || cam.zoom !== frame.cam[2] || Number.isNaN(frame.cam[0]);
    if (!jump && offset) {
      shiftX = frame.cam[0] - offset[0];
      shiftY = frame.cam[1] - offset[1];
      jump = Math.abs(shiftX) > width * SHIFT_MAX || Math.abs(shiftY) > height * SHIFT_MAX;
    }
    const shifted = !jump && (shiftX !== 0 || shiftY !== 0);
    // El arranque cambia la imagen entera en cada frame.
    const booting = bootActive();
    // Un cambio de luz afecta a toda la imagen (el foco oscurece el resto de la nave), pero con la
    // cámara quieta basta con rehacer la luz y la composición: lo demás sigue valiendo.
    const relightOnly = levelChanged && !shifted && frame.valid;
    let full = runtime.forceDraw || runtime.fullNext || resized || jump || (levelChanged && !relightOnly) || booting || now - frame.mounted < WARMUP_MS;
    let why = full ? (jump ? 'camera' : levelChanged ? 'light' : booting ? 'boot' : runtime.fullNext ? 'full' : resized ? 'resize' : 'other') : '';
    let zones: Rect[] | null = null;
    if (!full) {
      zones = dirtyRects(width, height);
      if (!zones) {
        full = true;
        why = 'other';
      } else {
        if (shifted) addExposed(zones, shiftX, shiftY, width, height);
        if (zones.length === 0 && !relightOnly) {
          runtime.dirty.length = 0;
          // Nada visible ha cambiado: si lo pidió una animación, no se pinta; si no, se pinta entero.
          if (ambient) return;
          full = true;
          why = 'unknown';
        } else if (!shifted && !relightOnly && now - frame.lastDraw < AMBIENT_FRAME_MS) {
          // Solo animaciones de ambiente: como mucho 60 fps (en 120 Hz, un refresco de cada dos).
          invalidate();
          return;
        } else {
          // Refresco rodante: una banda más por frame parcial.
          const band = frame.band++ % REFRESH_BANDS;
          const y0 = Math.floor((band * height) / REFRESH_BANDS);
          const y1 = Math.floor(((band + 1) * height) / REFRESH_BANDS);
          if (y1 > y0) zones.push({ x0: 0, y0, x1: width, y1 });
          mergeZones(zones, ZONE_SLACK * width * height);
          let total = 0;
          for (const z of zones) total += area(z);
          if (total > PARTIAL_MAX_AREA * width * height) {
            full = true;
            why = 'area';
          }
        }
      }
    }
    if (full) zones = null;
    runtime.dirty.length = 0;
    runtime.fullNext = false;
    frame.cam[0] = offset?.[0] ?? NaN;
    frame.cam[1] = offset?.[1] ?? NaN;
    frame.cam[2] = cam.zoom;
    STATIONS.forEach((_, i) => (frame.levels[i] = lu.uSpots.value[i].w));
    frame.lastDraw = now;
    runtime.drawn++;
    if (!zones) {
      runtime.stats.full++;
      runtime.stats.why[why] = (runtime.stats.why[why] ?? 0) + 1;
    } else if (shifted) runtime.stats.shift++;
    else if (relightOnly) runtime.stats.relight++;
    else runtime.stats.partial++;
    if (!zones) frame.valid = true;
    else if (shifted) frame.valid = false;

    /** Copia el lienzo desplazado (sx, sy) px de dibujo; lo que queda al descubierto se repinta después. */
    const shiftCanvas = (sx: number, sy: number) => {
      const w = width - Math.abs(sx);
      const h = height - Math.abs(sy);
      if (w <= 0 || h <= 0) return;
      const ctx = gl.getContext() as WebGL2RenderingContext;
      gl.initRenderTarget(p.shift);
      const copy = (gl.properties.get(p.shift) as { __webglFramebuffer: WebGLFramebuffer }).__webglFramebuffer;
      // three cree enlazado el lienzo y sin recorte: así queda también al acabar.
      gl.setRenderTarget(null);
      gl.setScissorTest(false);
      const srcX = Math.max(0, -sx);
      const srcY = Math.max(0, -sy);
      const dstX = Math.max(0, sx);
      const dstY = Math.max(0, sy);
      ctx.bindFramebuffer(ctx.READ_FRAMEBUFFER, null);
      ctx.bindFramebuffer(ctx.DRAW_FRAMEBUFFER, copy);
      ctx.blitFramebuffer(srcX, srcY, srcX + w, srcY + h, 0, 0, w, h, ctx.COLOR_BUFFER_BIT, ctx.NEAREST);
      ctx.bindFramebuffer(ctx.READ_FRAMEBUFFER, copy);
      ctx.bindFramebuffer(ctx.DRAW_FRAMEBUFFER, null);
      ctx.blitFramebuffer(0, 0, w, h, dstX, dstY, dstX + w, dstY + h, ctx.COLOR_BUFFER_BIT, ctx.NEAREST);
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
    };

    /** Caja de cada conjunto descartable → rectángulo en px de dibujo con la cámara de este frame. */
    const projectCullables = () => {
      const list = cull.list;
      if (!list.length || list.some((e) => e.object.parent !== scene)) {
        list.length = 0;
        for (const object of scene.children) {
          if (!object.userData.zoneCull) continue;
          const box = new THREE.Box3().setFromObject(object).expandByScalar(CULL_MARGIN);
          list.push({ object, box, rect: { x0: 0, y0: 0, x1: 0, y1: 0 }, was: true });
        }
      }
      const v = cull.corner;
      for (const e of list) {
        const { min, max } = e.box;
        const r = e.rect;
        r.x0 = r.y0 = Infinity;
        r.x1 = r.y1 = -Infinity;
        for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).project(cam);
          const x = ((v.x + 1) / 2) * width;
          const y = ((1 - v.y) / 2) * height;
          r.x0 = Math.min(r.x0, x);
          r.y0 = Math.min(r.y0, y);
          r.x1 = Math.max(r.x1, x);
          r.y1 = Math.max(r.y1, y);
        }
      }
    };

    /**
     * Piezas sueltas a la vista (mallas y líneas) → rectángulo de su esfera envolvente en px de dibujo,
     * con la cámara de este frame. Fuera quedan las que three.js no descarta nunca (frustumCulled
     * false), las instanciadas (su esfera no sigue a las instancias) y las de geometría que cambia
     * (su esfera se calculó con la forma de entonces): esas se dibujan siempre, como hasta ahora.
     */
    const projectParts = () => {
      const { parts, sphere, center } = cull;
      // Px de dibujo por metro (cámara ortográfica: la esfera se ve como un círculo de ese radio).
      const kx = (cam.zoom * width) / (cam.right - cam.left);
      const ky = (cam.zoom * height) / (cam.top - cam.bottom);
      let n = 0;
      scene.traverseVisible((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh && !(o as THREE.Line).isLine) return;
        if ((o as THREE.InstancedMesh).isInstancedMesh || !o.frustumCulled) return;
        const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
        const position = geometry?.attributes.position as THREE.BufferAttribute | undefined;
        if (!geometry || !position?.isBufferAttribute || position.version > 0) return;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        sphere.copy(geometry.boundingSphere!).applyMatrix4(o.matrixWorld);
        center.copy(sphere.center).project(cam);
        const x = ((center.x + 1) / 2) * width;
        const y = ((1 - center.y) / 2) * height;
        const e = (parts[n] ??= { object: o, rect: { x0: 0, y0: 0, x1: 0, y1: 0 }, hidden: false });
        e.object = o;
        e.rect.x0 = x - sphere.radius * kx;
        e.rect.x1 = x + sphere.radius * kx;
        e.rect.y0 = y - sphere.radius * ky;
        e.rect.y1 = y + sphere.radius * ky;
        n++;
      });
      cull.count = n;
    };

    /**
     * Pase de escena en un objetivo, entero o solo en un rectángulo (recorte de scissor). La
     * proyección es siempre la de la vista completa: con una vista recortada (setViewOffset) la
     * rasterización cambia en el último bit y los bordes de las zonas no casaban con el resto (medido:
     * trazos a medio pintar en las franjas finas). Lo que no toca el rectángulo se ahorra aparte: las
     * máquinas cuya caja queda fuera ni se recorren, y de las demás solo se dibujan las piezas que lo
     * tocan (lo que queda fuera del recorte no cambiaba ningún píxel: el resultado es el mismo).
     */
    const renderScene = (rt: THREE.WebGLRenderTarget, r: Rect | null) => {
      // Solo perfilado y verificación: `runtime.skip.parts` dibuja todas las piezas, para comparar.
      const parts = r && !(runtime as unknown as { skip?: Record<string, boolean> }).skip?.parts ? cull.count : 0;
      if (r) {
        for (const e of cull.list) {
          e.was = e.object.visible;
          const q = e.rect;
          if (q.x1 < r.x0 - SCENE_PAD || q.x0 > r.x1 + SCENE_PAD || q.y1 < r.y0 - SCENE_PAD || q.y0 > r.y1 + SCENE_PAD) e.object.visible = false;
        }
        const pad = SCENE_PAD + PART_MARGIN;
        for (let i = 0; i < parts; i++) {
          const e = cull.parts[i];
          const q = e.rect;
          e.hidden = q.x1 < r.x0 - pad || q.x0 > r.x1 + pad || q.y1 < r.y0 - pad || q.y0 > r.y1 + pad;
          if (e.hidden) e.object.visible = false;
        }
        scissorTarget(rt, r, width, height, SCENE_PAD * (rt.width / width));
      }
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
      if (r) {
        rt.scissorTest = false;
        for (let i = 0; i < parts; i++) if (cull.parts[i].hidden) cull.parts[i].object.visible = true;
        for (const e of cull.list) e.object.visible = e.was;
      }
    };

    const draw = (zones: Rect[] | null, sx = 0, sy = 0, relight = false) => {
      // La cámara se lee al pintar (no al preparar el frame): las comprobaciones pintan fuera de él.
      const offset = cam.userData.pixelOffset as [number, number] | undefined;
      const T = zones ? null : timer;
      T?.collect();
      // Solo perfilado en desarrollo: permite saltarse pases para medir su coste.
      const skip = (runtime as unknown as { skip?: Record<string, boolean> }).skip ?? {};
      gl.autoClear = true;

      if (zones) {
        let covered = 0;
        for (const r of zones) covered += area(r);
        runtime.stats.area += covered / (width * height);
        if ((sx || sy) && !skip.shift) shiftCanvas(sx, sy);
      }
      // Grupos para los pases de escena: menos recorridos de la escena a cambio de algo más de área.
      const groups = zones
        ? mergeZones(
            zones.map((z) => ({ ...z })),
            SCENE_SLACK * width * height,
          )
        : [null];

      // Las matrices del mundo se actualizan una vez por frame, no en cada pase ni en cada grupo.
      scene.updateMatrixWorld();
      if (zones) {
        projectCullables();
        projectParts();
      }
      const autoUpdate = scene.matrixWorldAutoUpdate;
      scene.matrixWorldAutoUpdate = false;

      // 1. Color (toon + calcomanías) con textura de profundidad.
      cam.layers.enable(DECAL_LAYER);
      gl.setClearColor(p.paper, 1);
      T?.begin('color');
      if (!skip.color) for (const g of groups) renderScene(p.color, g);
      T?.end();

      // 2. Normales + ID de pieza, sin calcomanías.
      cam.layers.disable(DECAL_LAYER);
      scene.overrideMaterial = p.normalId;
      gl.setClearColor(p.empty, 0);
      T?.begin('normal');
      if (!skip.normal) for (const g of groups) renderScene(p.normal, g);
      T?.end();
      scene.overrideMaterial = null;
      cam.layers.enable(DECAL_LAYER);
      scene.matrixWorldAutoUpdate = autoUpdate;

      // 3. Máscara de tinta a resolución interna (con los frentes del arranque, si lo hay).
      const iu = p.inkMask.uniforms;
      iu.uNear.value = cam.near;
      iu.uFar.value = cam.far;
      iu.uBoot.value = booting ? 0 : 1;
      if (booting) {
        iu.uCamPos.value.copy(cam.position);
        iu.uCamRight.value.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar((cam.right - cam.left) / 2 / cam.zoom);
        iu.uCamUp.value.setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar((cam.top - cam.bottom) / 2 / cam.zoom);
        iu.uCamFwd.value.setFromMatrixColumn(cam.matrixWorld, 2).negate();
        iu.uFront.value.set(boot.front.thick, boot.front.thin, boot.front.color, RISE);
      }
      T?.begin('ink');
      for (const r of zones ?? [null]) {
        scissorTarget(p.ink, r, width, height);
        gl.setRenderTarget(p.ink);
        if (!skip.ink) gl.render(p.inkScene, p.quadCamera);
      }
      T?.end();

      // 4. Luz de los focos, solo si hay alguno encendido, a media resolución y anclada al mundo.
      const s = runtime.supersample;
      const parity = p.composite.uniforms.uLightParity.value as THREE.Vector2;
      parity.set(((((offset?.[0] ?? 0) * s) % 2) + 2) % 2, ((((offset?.[1] ?? 0) * s) % 2) + 2) % 2);
      if (level > 0.001 && !skip.light) {
        lu.uInternalRes.value.set(p.color.width, p.color.height);
        lu.uParity.value.copy(parity);
        lu.uCamPos.value.copy(cam.position);
        lu.uCamRight.value.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar((cam.right - cam.left) / 2 / cam.zoom);
        lu.uCamUp.value.setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar((cam.top - cam.bottom) / 2 / cam.zoom);
        lu.uCamFwd.value.setFromMatrixColumn(cam.matrixWorld, 2).negate();
        lu.uNear.value = cam.near;
        lu.uFar.value = cam.far;
        T?.begin('light');
        for (const r of zones && !relight ? zones : [null]) {
          scissorLight(r, height, parity);
          gl.setRenderTarget(p.light);
          gl.render(p.lightScene, p.quadCamera);
        }
        T?.end();
      }

      // 5. Composición en pantalla (el lienzo conserva lo que no se repinta).
      const u = p.composite.uniforms;
      u.uScreenRes.value.copy(p.drawingBuffer);
      u.uDpr.value = dpr;
      u.uLevel.value = level;
      u.uBoot.value = booting ? 0 : 1;
      u.uLightRes.value.set(p.light.width, p.light.height);
      u.uLightScale.value = s;
      u.uMisregister.value.set(MISREGISTER[0] + BOOT_MISREGISTER[0] * boot.register, MISREGISTER[1] + BOOT_MISREGISTER[1] * boot.register);
      if (offset) u.uPaperOffset.value.set(offset[0], offset[1]);
      gl.setRenderTarget(null);
      gl.setClearColor(p.paper, 1);
      const pr = gl.getPixelRatio();
      T?.begin('composite');
      for (const r of zones && !relight ? zones : [null]) {
        if (r) {
          gl.setScissor(r.x0 / pr, (height - r.y1) / pr, (r.x1 - r.x0) / pr, (r.y1 - r.y0) / pr);
          gl.setScissorTest(true);
        }
        if (!skip.composite) gl.render(p.compositeScene, p.quadCamera);
      }
      T?.end();

      gl.setScissorTest(false);
      for (const rt of [p.color, p.normal, p.ink, p.light]) rt.scissorTest = false;
    };
    frame.draw = draw;
    draw(zones, shiftX, shiftY, relightOnly && zones !== null);
  }, 1);

  /**
   * Comprobación (solo desarrollo): lo pintado por zonas y desplazado coincide con un pintado completo.
   * `differing` cuenta todo; `clustered`, solo los píxeles con 4 o más vecinos también distintos. Una
   * zona sin declarar deja una mancha (clustered > 0); el frame anterior desplazado solo difiere en
   * píxeles sueltos a lo largo de aristas largas (precisión de la rasterización: el mismo 0,00x % que
   * cambia entre dos frames consecutivos) y en el borde por el que sale la imagen (el pintado completo
   * recorta allí sus vecinos y el desplazado no).
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && process.env.PERF_HOOKS !== '1') return;
    const w = window as unknown as {
      __verifyPartial?: () => { differing: number; clustered: number; total: number; pending: boolean; box: number[] | null; spots: number[] };
      __benchDraw?: (n: number, fraction: number, noSync?: boolean) => number;
      __drawZones?: (zones: Rect[] | null) => void;
    };
    // Pintado por zonas a voluntad (px de dibujo, origen arriba a la izquierda): comprobaciones.
    w.__drawZones = (zones) => frame.draw?.(zones ? zones.map((z) => ({ ...z })) : null);
    // Coste de un pintado por zonas de `fraction` de la pantalla (0 = pintado completo), ms por frame.
    w.__benchDraw = (n, fraction, noSync = false) => {
      gl.getDrawingBufferSize(pipeline.drawingBuffer);
      const { x: W, y: H } = pipeline.drawingBuffer;
      const side = Math.sqrt(fraction);
      const rect = {
        x0: Math.round((W * (1 - side)) / 2),
        y0: Math.round((H * (1 - side)) / 2),
        x1: Math.round((W * (1 + side)) / 2),
        y1: Math.round((H * (1 + side)) / 2),
      };
      const ctx = gl.getContext();
      const px = new Uint8Array(4);
      // Sin sincronizar: quien llama espera con una fence (en WebKit la lectura no espera a todos los pases).
      const sync = () => noSync || ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      sync();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) frame.draw?.(fraction > 0 ? [{ ...rect }] : null);
      sync();
      return (performance.now() - t0) / n;
    };
    w.__verifyPartial = () => {
      // Con zonas aún sin pintar (el frame siguiente las pinta) la comparación no vale.
      const pending = runtime.dirty.length > 0;
      const ctx = gl.getContext();
      gl.setRenderTarget(null);
      gl.getDrawingBufferSize(pipeline.drawingBuffer);
      const { x: W, y: H } = pipeline.drawingBuffer;
      const read = () => {
        const px = new Uint8Array(W * H * 4);
        ctx.readPixels(0, 0, W, H, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        return px;
      };
      const before = read();
      frame.draw?.(null);
      const after = read();
      let differing = 0;
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      const spots: number[] = [];
      const mask = new Uint8Array(W * H);
      for (let i = 0; i < before.length; i += 4) {
        if (Math.abs(before[i] - after[i]) > 1 || Math.abs(before[i + 1] - after[i + 1]) > 1 || Math.abs(before[i + 2] - after[i + 2]) > 1) {
          differing++;
          mask[i / 4] = 1;
          const px = (i / 4) % W;
          const py = H - 1 - Math.floor(i / 4 / W);
          box[0] = Math.min(box[0], px);
          box[1] = Math.min(box[1], py);
          box[2] = Math.max(box[2], px);
          box[3] = Math.max(box[3], py);
          if (spots.length < 600) spots.push(px, py);
        }
      }
      let clustered = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const k = y * W + x;
          if (!mask[k]) continue;
          const n = mask[k - W - 1] + mask[k - W] + mask[k - W + 1] + mask[k - 1] + mask[k + 1] + mask[k + W - 1] + mask[k + W] + mask[k + W + 1];
          if (n >= 4) clustered++;
        }
      }
      // Rectángulo de las diferencias en px CSS (origen arriba a la izquierda).
      const pr = gl.getPixelRatio();
      return {
        differing,
        clustered,
        total: W * H,
        pending,
        box: differing ? box.map((v) => Math.round(v / pr)) : null,
        spots: spots.map((v) => Math.round(v / pr)),
      };
    };
  }, [gl, pipeline, frame]);

  return null;
}
