// Registro de lo publicado: duplicados, topes por tipo y jornada, tope por día. Vive en un archivo JSON (en el workflow, en la
// rama `bot-estado`) para que sobreviva entre ejecuciones. Se marca SOLO cuando X ha dicho que sí (201).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));

export class Registro {
  constructor(config, fichero = null) {
    this.config = config; this.fichero = fichero;
    this.datos = { enviados: [] };
    if (fichero && existsSync(fichero)) { try { this.datos = JSON.parse(readFileSync(fichero, 'utf8')); } catch { /* vacío */ } }
    this.claves = new Set(this.datos.enviados.map((e) => e.clave));
    this.enEstaEjecucion = 0;
  }
  // el día en Madrid, no en UTC (la noche del 2 al 3 nov llegaron 6 avisos de fallo en vez de 3: el tope se reiniciaba a la 01:00)
  hoy() { return diaMadrid(Date.now()); }
  /** 'ok' o el motivo de no publicar */
  decidir(tw) {
    if (this.claves.has(tw.clave)) return 'duplicado';
    // novedades y caídas, separadas (Carlos, 3 nov 12:06: a las 11:51 y 11:52 salieron dos tweets de bajas casi seguidos):
    // si el otro tipo ha salido hace menos de `separacionBajasMin`, este espera a una ejecución posterior
    const otro = { caidas: 'novedades', novedades: 'caidas' }[tw.tipo];
    const sep = this.config.separacionBajasMin ?? 0;
    if (otro && sep) {
      const ult = this.todos().filter((e) => e.tipo === otro).reduce((m, e) => Math.max(m, Date.parse(e.t) || 0), 0);
      const hace = (Date.now() - ult) / 60e3;
      if (ult && hace < sep) return `espera: salió un tweet de ${otro} hace ${Math.round(hace)} min (separación de ${sep})`;
    }
    const tope = this.config.topes[tw.tipo] ?? 0;
    const n = this.datos.enviados.filter((e) => e.tipo === tw.tipo && e.jornada === tw.jornada).length;
    if (n >= tope) return `tope de ${tope} para «${tw.tipo}» en la jornada ${tw.jornada}`;
    const hoy = this.datos.enviados.filter((e) => diaMadrid(e.t) === this.hoy()).length;
    if (hoy >= (this.config.topeDiario ?? 25)) return `tope diario de ${this.config.topeDiario ?? 25}`;
    if (this.enEstaEjecucion >= (this.config.maxPorEjecucion ?? 4)) return `máximo de ${this.config.maxPorEjecucion ?? 4} por ejecución (sigue en la próxima)`;
    return 'ok';
  }
  marcar(tw, id) {
    this.claves.add(tw.clave);
    this.enEstaEjecucion++;
    this.datos.enviados.push({ clave: tw.clave, tipo: tw.tipo, jornada: tw.jornada, id: id || null, t: new Date().toISOString() });
    this.guardar();
  }
  /** en simulacro solo se reservan en memoria (para que los topes se vean) */
  reservar(tw) {
    this.claves.add(tw.clave); this.enEstaEjecucion++; this.reservadas = (this.reservadas || 0) + 1;
    (this.reservadasLista ||= []).push({ clave: tw.clave, tipo: tw.tipo, jornada: tw.jornada, t: new Date().toISOString() });
  }
  /** lo publicado y, en simulacro, lo reservado en esta ejecución */
  todos() { return [...this.datos.enviados, ...(this.reservadasLista || [])]; }
  /**
   * Jugadores que ya han salido en caídas o novedades, sacados de las claves (`caidas|J|id-id`, `novedades|id:que,id:que|día`),
   * así vale también para lo publicado antes de este cambio. [{ tipo, id, que, jornada, t }]
   */
  cubiertos() {
    const out = [];
    for (const e of this.todos()) {
      const p = String(e.clave).split('|'), t = Date.parse(e.t) || 0;
      if (e.tipo === 'caidas' && p[2]) for (const id of p[2].split('-')) out.push({ tipo: 'caidas', id, que: null, jornada: e.jornada, t });
      if (e.tipo === 'novedades' && p[1]) for (const x of p[1].split(',')) { const [id, que] = x.split(':'); out.push({ tipo: 'novedades', id, que: que || null, jornada: e.jornada, t }); }
    }
    return out;
  }
  guardar() {
    if (!this.fichero) return;
    mkdirSync(dirname(this.fichero), { recursive: true });
    this.datos.enviados = this.datos.enviados.slice(-1500);
    writeFileSync(this.fichero, JSON.stringify(this.datos, null, 1));
  }
}
