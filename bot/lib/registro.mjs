// Registro de lo publicado: duplicados y topes por tipo y jornada. En simulacro vive en memoria; para publicar de verdad
// hará falta guardarlo fuera del proceso (un archivo en una rama, Deno KV…).
export class Registro {
  constructor(topes) { this.topes = topes; this.claves = new Set(); this.cuenta = {}; }
  decidir(tw) {
    if (this.claves.has(tw.clave)) return 'duplicado';
    const k = `${tw.tipo}|${tw.jornada}`;
    if ((this.cuenta[k] || 0) >= (this.topes[tw.tipo] ?? 0)) return `tope de ${this.topes[tw.tipo] ?? 0} para «${tw.tipo}» en esta jornada`;
    this.claves.add(tw.clave);
    this.cuenta[k] = (this.cuenta[k] || 0) + 1;
    return 'ok';
  }
}
