/**
 * Recursos de three.js que viven más que una escena (geometrías unitarias, materiales por color,
 * texturas precalculadas): se crean una vez por módulo y se comparten entre montajes.
 *
 * Al usarlos, cada renderer les cuelga un listener de `dispose` que lo apunta a él. Si no se liberan
 * al desmontar la escena (al entrar en un proyecto), el renderer viejo queda retenido por ellos, y con
 * él su lienzo y la página entera: una copia de la nave por cada ida y vuelta. `releaseShared()` los
 * libera al desmontar; los objetos siguen valiendo y el renderer siguiente los vuelve a subir.
 */
const resources = new Set<{ dispose(): void }>();

/** Registra un recurso compartido entre montajes (lo devuelve tal cual). */
export function shared<T extends { dispose(): void }>(resource: T): T {
  resources.add(resource);
  return resource;
}

/** Libera en la GPU todos los recursos compartidos y suelta los renderers que los usaron. */
export function releaseShared() {
  resources.forEach((resource) => resource.dispose());
}
