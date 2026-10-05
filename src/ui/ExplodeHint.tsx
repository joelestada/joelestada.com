'use client';

import { useEffect, useState } from 'react';
import { useUi } from '@/i18n/ui';
import { useHotPart } from './ExplodeCallouts';
import { useSnapshot } from './useSnapshot';

const KEY = 'factory:parts-hint';
/** Lo que dura la pista si no se toca ninguna pieza (ms). */
const SHOW_MS = 7000;

/** Si ya se vio la pista en este navegador. Sin almacenamiento, se ve cada vez. */
function seenBefore() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * La primera vez que se despieza una máquina, en el sitio de la indicación de scroll: cómo se
 * encuentra cada pieza en la máquina. Se va al destacar una pieza, al montarla o a los pocos segundos,
 * y no vuelve a salir. La lista de piezas de la ficha es la versión accesible.
 */
export function ExplodeHint() {
  const { exploded } = useSnapshot('exploded');
  const hot = useHotPart();
  const t = useUi();
  // Se lee al montar (en modo estricto el render se repite: no se escribe aquí).
  const [seen] = useState(seenBefore);
  const [state, setState] = useState<'wait' | 'on' | 'done'>('wait');
  if (state === 'wait' && exploded) setState(seen ? 'done' : 'on');
  if (state === 'on' && (!exploded || hot)) setState('done');

  useEffect(() => {
    if (state !== 'on') return;
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    const timer = window.setTimeout(() => setState('done'), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <div className={`cue cue--parts${state === 'on' ? '' : ' is-gone'}`} aria-hidden>
      <span className="cue__desk">{t.card.partsHintDesk}</span>
      <span className="cue__touch">{t.card.partsHintTouch}</span>
    </div>
  );
}
