// Utilidades comunes de los scripts.

/**
 * Argumentos `--clave valor` de la línea de órdenes. Una clave sin valor (al final, o seguida de
 * otra clave) vale `true`: `--check`.
 */
export const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] === undefined || all[i + 1].startsWith('--') ? true : all[i + 1]]);
    return acc;
  }, []),
);

/** Carpeta de capturas y medidas de trabajo: fuera del repositorio (.gitignore). */
export const CAPTURES = 'captures';
