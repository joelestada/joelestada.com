import type { Lang } from './lang';

/**
 * Texto en los dos idiomas, uno junto al otro: así se escriben todos los textos de la web (en los
 * archivos de config y en el diccionario de la interfaz). `localize` los resuelve al idioma de la página.
 */
export type L<T = string> = { en: T; es: T };

/** El mismo dato con cada `{ en, es }` cambiado por el texto de un idioma. */
/** (Sobre listas y ternas, el tipo mapeado conserva su forma: una `Vec3` sigue siendo una terna.) */
export type Localized<T> = T extends L<infer U> ? U : T extends (...args: never[]) => unknown ? T : T extends object ? { [K in keyof T]: Localized<T[K]> } : T;

const isL = (v: object): v is L<unknown> => {
  const keys = Object.keys(v);
  return keys.length === 2 && 'en' in v && 'es' in v;
};

/** Resuelve un dato (objeto, lista o texto) al idioma `lang`, a cualquier profundidad. */
export function localize<T>(value: T, lang: Lang): Localized<T> {
  if (Array.isArray(value)) return value.map((v) => localize(v, lang)) as Localized<T>;
  if (value && typeof value === 'object') {
    if (isL(value)) return localize(value[lang], lang) as Localized<T>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = localize(v, lang);
    return out as Localized<T>;
  }
  return value as Localized<T>;
}

/** El dato resuelto a los dos idiomas de una vez (para los contenidos fijos: se calcula al cargar). */
export function bilingual<T>(value: T): Record<Lang, Localized<T>> {
  return { en: localize(value, 'en'), es: localize(value, 'es') };
}
