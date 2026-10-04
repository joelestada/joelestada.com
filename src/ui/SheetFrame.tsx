/**
 * Marco de lámina: papel fuera del marco, un filete en su borde y las cruces de registro a media
 * altura. Lo llevan todas las páginas (la portada encuadra la escena; las demás, la hoja que se lee):
 * así cada página es una hoja del mismo juego de planos.
 */
export function SheetFrame() {
  return (
    <div className="sheet" aria-hidden>
      <i className="sheet__edge sheet__edge--t" />
      <i className="sheet__edge sheet__edge--b" />
      <i className="sheet__edge sheet__edge--l" />
      <i className="sheet__edge sheet__edge--r" />
      <i className="sheet__cross sheet__cross--l" />
      <i className="sheet__cross sheet__cross--r" />
    </div>
  );
}
