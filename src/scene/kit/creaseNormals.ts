import * as THREE from 'three';

/**
 * Normales con aristas vivas: el mismo resultado, bit a bit, que `toCreasedNormals` de three.js
 * (examples/jsm/utils/BufferGeometryUtils), en una fracción del tiempo. Era lo que más costaba al
 * montar la nave (tubos, prismas y sólidos de revolución): aquella localizaba cada vértice dos veces
 * con una clave de texto y creaba un vector por cara. Aquí cada vértice se localiza una vez, con una
 * clave numérica, y las normales de cara se guardan en un array. Las cuentas son las mismas y en el
 * mismo orden (producto vectorial, normalizado, producto escalar y suma), así que los bits también.
 *
 * Vértices en la misma posición (redondeada a la centésima, como en three) comparten la media de las
 * normales de sus caras que no se separan más de `creaseAngle`; por encima, la arista queda viva.
 */
export function creaseNormals(geometry: THREE.BufferGeometry, creaseAngle: number) {
  const creaseDot = Math.cos(creaseAngle);
  const hashMultiplier = (1 + 1e-10) * 1e2;
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = result.attributes.position as THREE.BufferAttribute;
  const count = position.count;
  const faces = count / 3;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const face = new THREE.Vector3();

  // Normal de cada cara (en doble precisión, como el vector de three) y grupo de posición de cada vértice.
  const normals = new Float64Array(Math.ceil(faces) * 3);
  const groupOf = new Int32Array(count + 3);
  const groups: number[][] = [];
  const index = new Map<number | string, number>();
  const corners = [a, b, c];
  for (let i = 0; i < faces; i++) {
    const i3 = 3 * i;
    a.fromBufferAttribute(position, i3);
    b.fromBufferAttribute(position, i3 + 1);
    c.fromBufferAttribute(position, i3 + 2);
    cb.subVectors(c, b);
    ab.subVectors(a, b);
    face.crossVectors(cb, ab).normalize();
    normals[i3] = face.x;
    normals[i3 + 1] = face.y;
    normals[i3 + 2] = face.z;
    for (let n = 0; n < 3; n++) {
      const v = corners[n];
      const x = ~~(v.x * hashMultiplier);
      const y = ~~(v.y * hashMultiplier);
      const z = ~~(v.z * hashMultiplier);
      // Clave exacta: número si cabe (posiciones de menos de 655 m), texto si no.
      const key =
        Math.abs(x) < 65536 && Math.abs(y) < 65536 && Math.abs(z) < 65536 ? ((x + 65536) * 131072 + (y + 65536)) * 131072 + (z + 65536) : `${x},${y},${z}`;
      let g = index.get(key);
      if (g === undefined) {
        g = groups.length;
        groups.push([]);
        index.set(key, g);
      }
      groups[g].push(i);
      groupOf[i3 + n] = g;
    }
  }

  // Media de las normales de cada grupo que no superan el pliegue respecto a la de la cara.
  const out = new Float32Array(count * 3);
  const sum = new THREE.Vector3();
  for (let i = 0; i < faces; i++) {
    const i3 = 3 * i;
    const fx = normals[i3];
    const fy = normals[i3 + 1];
    const fz = normals[i3 + 2];
    for (let n = 0; n < 3; n++) {
      const group = groups[groupOf[i3 + n]];
      sum.set(0, 0, 0);
      for (let k = 0; k < group.length; k++) {
        const j3 = 3 * group[k];
        const ox = normals[j3];
        const oy = normals[j3 + 1];
        const oz = normals[j3 + 2];
        if (fx * ox + fy * oy + fz * oz > creaseDot) {
          sum.x += ox;
          sum.y += oy;
          sum.z += oz;
        }
      }
      sum.normalize();
      const o = (i3 + n) * 3;
      out[o] = sum.x;
      out[o + 1] = sum.y;
      out[o + 2] = sum.z;
    }
  }
  result.setAttribute('normal', new THREE.BufferAttribute(out, 3, false));
  return result;
}
