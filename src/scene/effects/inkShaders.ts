/**
 * Shaders del trazo de tinta.
 *
 * 1. normalId: pase con material override → normal en vista (RGB) + ID de pieza (A).
 * 2. inkMask: a resolución interna (2 px por px CSS) calcula la máscara de línea:
 *    - trazo grueso (siluetas, saltos de profundidad): laplaciano de la profundidad lineal.
 *      En ortográfica la profundidad de un plano es afín en pantalla → laplaciano 0 exacto,
 *      así que el suelo rasante no mancha y solo cuentan las discontinuidades.
 *    - trazo fino (aristas interiores): pliegue brusco de la normal o cambio de ID de pieza.
 *      El test de "brusquedad" evita que los cilindros pequeños se llenen de tinta.
 * 3. light (solo con un foco encendido, a media resolución): reconstruye la posición de mundo
 *    desde la profundidad: charco de luz en las superficies dentro del cono y haz volumétrico
 *    analítico que se corta contra la escena. Su rejilla va anclada al mundo (sigue la paridad del
 *    desplazamiento de la cámara): al reutilizar el frame anterior desplazado, la luz coincide.
 * 4. composite: color desregistrado 1 px + papel (tesela precalculada) + luz + tinta, a resolución de pantalla.
 *    Jerarquía de plano: la silueta va en tinta plena y la arista interior más clara.
 *
 * Arranque de la nave (solo al cargar): la máscara de tinta calcula además, desde la profundidad,
 * dónde ha llegado cada frente (silueta, aristas, color) y lo deja en la propia máscara: el trazo
 * aparece por barrido y el canal B dice cuánto color hay ya (la composición mezcla con el papel).
 */

export const normalIdVertex = /* glsl */ `
#include <common>
attribute float aInkId;
uniform float uInkId;
varying vec3 vN;
varying float vId;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal);
  vId = aInkId > 0.5 ? aInkId : uInkId;
}
`;

export const normalIdFragment = /* glsl */ `
varying vec3 vN;
varying float vId;
void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  gl_FragColor = vec4(n * 0.5 + 0.5, vId / 255.0);
}
`;

export const fullscreenVertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const inkMaskFragment = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform float uNear;
uniform float uFar;
uniform float uDepthTh;
uniform float uNormalTh;
uniform int uThick;
// Arranque: 1 = sin arranque (todo a la vista). Base ortográfica como en el pase de luz.
uniform float uBoot;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
// Frentes (m): x silueta, y aristas, z color; w = subida con la altura. Anchuras y ondulación.
uniform vec4 uFront;
uniform vec3 uBand;
uniform float uWobble;

ivec2 gRes;

float D(ivec2 q) {
  q = clamp(q, ivec2(0), gRes - 1);
  return uNear + texelFetch(tDepth, q, 0).x * (uFar - uNear);
}

vec4 N(ivec2 q) {
  q = clamp(q, ivec2(0), gRes - 1);
  return texelFetch(tNormal, q, 0);
}

float nd(vec4 a, vec4 b) {
  return 1.0 - dot(a.xyz * 2.0 - 1.0, b.xyz * 2.0 - 1.0);
}

// Pliegue entre b y c (a antes, d después).
float crease(vec4 a, vec4 b, vec4 c, vec4 d) {
  float m = nd(b, c);
  float around = min(nd(a, b), nd(c, d));
  float cr = step(uNormalTh, m) * step(2.0 * around, m);
  float idEdge = step(0.5 / 255.0, abs(b.w - c.w));
  return max(cr, idEdge);
}

float hash21(vec2 q) {
  q = fract(q * vec2(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

float vnoise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Coordenada de avance del punto de la escena visto en q a profundidad d (ondulada, anclada al mundo).
float along(ivec2 q, float d) {
  vec2 ndc = (vec2(q) + 0.5) / vec2(gRes) * 2.0 - 1.0;
  vec3 P = uCamPos + uCamRight * ndc.x + uCamUp * ndc.y + uCamFwd * d;
  return P.x + uFront.w * P.y + uWobble * (vnoise(P.xz * 0.85 + P.y * 0.3) * 2.0 - 1.0);
}

float reached(float front, float s, float band) {
  return clamp((front - s) / band, 0.0, 1.0);
}

void main() {
  gRes = textureSize(tDepth, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);

  // Trazo grueso: laplaciano de la profundidad lineal en 4 direcciones.
  int r = uThick;
  float dc = D(p);
  float d0 = 2.0 * dc;
  float a1 = D(p + ivec2(r, 0));
  float b1 = D(p - ivec2(r, 0));
  float a2 = D(p + ivec2(0, r));
  float b2 = D(p - ivec2(0, r));
  float a3 = D(p + ivec2(r, r));
  float b3 = D(p - ivec2(r, r));
  float a4 = D(p + ivec2(r, -r));
  float b4 = D(p - ivec2(r, -r));
  float l1 = abs(a1 + b1 - d0);
  float l2 = abs(a2 + b2 - d0);
  float l3 = abs(a3 + b3 - d0);
  float l4 = abs(a4 + b4 - d0);
  float lap = max(max(l1, l2), max(l3, l4));
  float thick = smoothstep(uDepthTh, uDepthTh * 1.6, lap);

  // Trazo fino: pliegues de normal y cambios de ID, 1 px interno a cada lado.
  vec4 c = N(p);
  vec4 xm2 = N(p - ivec2(2, 0));
  vec4 xm1 = N(p - ivec2(1, 0));
  vec4 xp1 = N(p + ivec2(1, 0));
  vec4 xp2 = N(p + ivec2(2, 0));
  vec4 ym2 = N(p - ivec2(0, 2));
  vec4 ym1 = N(p - ivec2(0, 1));
  vec4 yp1 = N(p + ivec2(0, 1));
  vec4 yp2 = N(p + ivec2(0, 2));
  float thin = max(
    max(crease(xm2, xm1, c, xp1), crease(xm1, c, xp1, xp2)),
    max(crease(ym2, ym1, c, yp1), crease(ym1, c, yp1, yp2))
  );

  // Arranque: la silueta es de la pieza más cercana del entorno (la que tapa), no del fondo.
  float fill = 1.0;
  if (uBoot < 1.0) {
    float dn = min(dc, min(min(min(a1, b1), min(a2, b2)), min(min(a3, b3), min(a4, b4))));
    float here = along(p, dc);
    thick *= reached(uFront.x, along(p, dn), uBand.x);
    thin *= reached(uFront.y, here, uBand.y);
    fill = reached(uFront.z, here, uBand.z);
  }

  // R = silueta, G = arista interior: la composición les da pesos distintos. B = color ya llegado.
  gl_FragColor = vec4(thick, thin, fill, 1.0);
}
`;

export const SPOT_COUNT = 5;

/**
 * Luz de los focos, a media resolución (es un degradado suave: no se nota y cuesta 4 veces menos).
 * R = superficie dentro del cono (charco de luz), G = haz atravesado por el rayo de vista.
 *
 * Rejilla anclada al mundo: el texel i representa el píxel interno 2i − 1 + p, con p la paridad del
 * desplazamiento de la cámara en píxeles internos. Así un mismo punto de la nave cae siempre en el
 * mismo sitio de su texel, se mueva la cámara un número par o impar de píxeles.
 */
export const lightFragment = /* glsl */ `
precision highp float;
#define SPOTS ${SPOT_COUNT}

uniform sampler2D tDepth;
/** Resolución interna (la de la profundidad) y paridad del desplazamiento de la cámara (0 o 1). */
uniform vec2 uInternalRes;
uniform vec2 uParity;
// Vista ortográfica: origen del rayo = uCamPos + uCamRight·ndc.x + uCamUp·ndc.y (ejes ya escalados en metros).
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uNear;
uniform float uFar;
// Focos colgantes: xyz = centro de la boca de la campana, w = encendido (0..1).
uniform vec4 uSpots[SPOTS];
uniform float uSpotMouth;
uniform float uSpotTan;
uniform float uHaze;

/**
 * Cono de luz vertical con vértice virtual sobre la boca de la campana.
 * lit: la superficie visible cae dentro del cono. beam: haz atravesado por el rayo de vista
 * hasta la superficie (integral de densidad en 6 muestras), con oclusión por profundidad.
 */
void spot(vec3 O, vec3 D, float tS, vec3 P, vec4 s, inout float lit, inout float beam) {
  float k = uSpotTan;
  float hm = uSpotMouth / k;
  vec3 A = s.xyz + vec3(0.0, hm, 0.0);

  float hP = A.y - P.y;
  if (hP > hm) {
    float r = length(P.xz - A.xz) / (k * hP);
    lit = max(lit, (1.0 - smoothstep(0.72, 1.0, r)) * s.w);
  }

  vec2 q = O.xz - A.xz;
  vec2 d = D.xz;
  float h0 = A.y - O.y;
  float k2 = k * k;
  float a = dot(d, d) - k2 * D.y * D.y;
  float b = 2.0 * (dot(q, d) + k2 * h0 * D.y);
  float c = dot(q, q) - k2 * h0 * h0;
  float disc = b * b - 4.0 * a * c;
  if (disc <= 0.0) return;
  float sq = sqrt(disc);
  float t0 = max((-b - sq) / (2.0 * a), (h0 - hm) / D.y);
  float t1 = min((-b + sq) / (2.0 * a), tS);
  if (t1 <= t0) return;

  float L = t1 - t0;
  float acc = 0.0;
  for (int j = 0; j < 6; j++) {
    vec3 X = O + D * (t0 + (float(j) + 0.5) * L / 6.0);
    float h = A.y - X.y;
    float r = length(X.xz - A.xz) / (k * h);
    float radial = 1.0 - smoothstep(0.3, 1.0, r);
    float fall = mix(1.0, 0.28, smoothstep(hm, hm + 5.5, h));
    acc += radial * fall;
  }
  acc *= L / 6.0;
  beam = 1.0 - (1.0 - beam) * (1.0 - (1.0 - exp(-acc * uHaze)) * s.w);
}

void main() {
  vec2 q = clamp(floor(gl_FragCoord.xy) * 2.0 - 1.0 + uParity, vec2(0.0), uInternalRes - 1.0);
  vec2 ndc = (q + 0.5) / uInternalRes * 2.0 - 1.0;
  vec3 O = uCamPos + uCamRight * ndc.x + uCamUp * ndc.y;
  float tS = uNear + texelFetch(tDepth, ivec2(q), 0).x * (uFar - uNear);
  vec3 P = O + uCamFwd * tS;
  float lit = 0.0;
  float beam = 0.0;
  for (int i = 0; i < SPOTS; i++) {
    if (uSpots[i].w > 0.001) spot(O, uCamFwd, tS, P, uSpots[i], lit, beam);
  }
  gl_FragColor = vec4(lit, beam, 0.0, 1.0);
}
`;

export const compositeFragment = /* glsl */ `
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tInk;
uniform sampler2D tLight;
uniform sampler2D tPaper;
uniform float uPaperSize;
uniform vec2 uScreenRes;
uniform float uDpr;
uniform vec2 uMisregister;
/** Desplazamiento de la cámara en px de dispositivo (enteros): el papel viaja con la nave. */
uniform vec2 uPaperOffset;
uniform vec3 uInk;
uniform float uGrain;
uniform float uMottle;
uniform float uInkVariation;
/** Intensidad de las aristas interiores respecto a la silueta. */
uniform float uThinInk;
/** Encendido máximo de los focos (0 = no se lee la luz). */
uniform float uLevel;
/** Rejilla de la luz (ver lightFragment): tamaño en texels, paridad y px internos por px de lienzo. */
uniform vec2 uLightRes;
uniform vec2 uLightParity;
uniform float uLightScale;
uniform vec3 uLight;
uniform float uDim;
uniform float uPool;
/** Arranque: < 1 mientras la nave se dibuja; el papel limpio es lo que hay donde aún no llegó el color. */
uniform float uBoot;
uniform vec3 uPaperColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uScreenRes;
  // Capa de color desregistrada respecto a la de línea.
  vec2 misregister = uMisregister * uDpr;
  vec2 uvc = uv + misregister / uScreenRes;
  vec4 color = texture2D(tColor, uvc);
  vec3 col = color.rgb;
  // Alfa 0 = superficie emisiva (pantallas): el foco ni la oscurece ni la enturbia.
  float solid = color.a;
  vec3 strokes = texture2D(tInk, uv).rgb;
  float ink = max(strokes.r, strokes.g * uThinInk);

  // Papel anclado a la nave, en px CSS: el grano no cambia con el devicePixelRatio.
  ivec2 texel = ivec2(mod(floor((gl_FragCoord.xy + uPaperOffset) / uDpr), uPaperSize));
  vec3 paper = texelFetch(tPaper, texel, 0).rgb;
  float tooth = 1.0 + uGrain * (paper.r - 0.5) + uMottle * (paper.g * 1.5 - 0.75);
  col *= tooth;
  // Arranque: donde aún no ha llegado el color queda la lámina en blanco (solo el trazo).
  if (uBoot < 1.0) col = mix(uPaperColor * tooth, col, strokes.b);

  float lit = 0.0;
  float beam = 0.0;
  if (uLevel > 0.001) {
    // Texel de luz del punto (desregistrado como el color), en la rejilla anclada al mundo.
    vec2 lt = ((gl_FragCoord.xy + misregister) * uLightScale - uLightParity + 1.5) * 0.5 / uLightRes;
    vec2 l = texture2D(tLight, lt).rg;
    lit = l.r;
    beam = l.g;
    col *= 1.0 - uDim * uLevel * (1.0 - lit) * solid;
    col = mix(col, min(col * (1.0 + uPool) * uLight, vec3(1.0)), lit * solid);
  }

  // Tinta con ligera variación de carga.
  float load = 1.0 - uInkVariation * paper.b;
  col = mix(col, uInk, clamp(ink * load, 0.0, 1.0));

  // El haz queda delante de todo, también del trazo; sobre lo ya iluminado se aclara para que
  // la máquina destacada conserve el contraste y el haz se lea en el aire que la rodea.
  col = mix(col, uLight, beam * mix(0.3, 1.0, solid) * (1.0 - 0.55 * lit));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
