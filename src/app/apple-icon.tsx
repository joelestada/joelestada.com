import { brandMark } from '@/lib/brandMark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Icono al guardar la web en la pantalla de inicio del iPhone: la misma marca, a su tamaño. */
export default function AppleIcon() {
  return brandMark(size.width, { square: true });
}
