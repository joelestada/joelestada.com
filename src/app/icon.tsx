import { brandMark } from '@/lib/brandMark';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** Favicon: la marca de la web (lib/brandMark). */
export default function Icon() {
  return brandMark(size.width);
}
