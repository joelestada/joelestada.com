'use client';

import { useEffect, useRef, useState } from 'react';
import { SITE } from '@/config/site';

/** Copia el email al portapapeles (con alternativa si no hay permiso) y avisa durante un momento. */
export function useCopyEmail() {
  const { email } = SITE.contact;
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const t = document.createElement('textarea');
      t.value = email;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return { email, copied, copy };
}
