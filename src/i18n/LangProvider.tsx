'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LANG, localePath, type Lang } from './lang';

const LangContext = createContext<Lang>(DEFAULT_LANG);

/** Idioma de la página para los componentes de cliente (lo pone el layout con el de la dirección). */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Dirección de una página en el idioma de esta (`useHref()('/cv')` → `/es/cv`). */
export function useHref() {
  const lang = useContext(LangContext);
  return (path: string) => localePath(lang, path);
}
