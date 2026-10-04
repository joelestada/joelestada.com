/**
 * Arranque corto: la primera vez en la sesión (pestaña) la nave se dibuja entera; al recargar la
 * portada en la misma sesión, la misma secuencia va más deprisa. El script de <head> lo lee de
 * sessionStorage y marca <html>; el arranque lo apunta al empezar (scene/boot.ts).
 */
export const BOOT_SEEN_KEY = 'factory:boot-seen';
export const BOOT_SHORT_CLASS = 'boot-short';
