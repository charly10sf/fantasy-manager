/* Los avisos del móvil. Con cada actualización se recalcula la lista entera de lo que va a pasar y se le
   pasa a la app, que pone una alarma del sistema para cada cosa (llegan aunque la app esté cerrada). */
import { nativo, enApp } from './puente.js';
import { LS, eur, cuando, MIN, HORA, DIA } from './util.js';

export const cfgAvisos = () => ({
  on: false, rivales: true, mias: true, mercado: true, jornada: true, diario: true, hora: '13:30', interes: 55,
  ...LS.get('cfg-avisos', {}),
});
export const guardarCfgAvisos = (c) => LS.set('cfg-avisos', { ...cfgAvisos(), ...c });

/** la lista de avisos futuros con lo que hay ahora en la liga */
export function calcular(D, M, c = cfgAvisos()) {
  const out = [];
  const ahora = Date.now();
  const add = (id, t, titulo, texto, hash = '', extra = {}) => { if (t > ahora + 30e3 && t < ahora + 14 * DIA) out.push({ id, t: Math.round(t), titulo, texto, hash, ...extra }); };
  if (!D || !M) return out;

  if (c.rivales) {
    M.clausulas.filter((x) => !x.abierta && x.abreEn < 7 * DIA && x.meLlega && x.interes >= c.interes && x.j.estado !== 'injured')
      .sort((a, b) => b.interes - a.interes).slice(0, 10)
      .forEach((x) => {
        add(`cl15-${x.teamId}-${x.pid}`, x.protegidoHasta - 15 * MIN, `En 15 min se abre ${x.j.nombre}`,
          `La cláusula de ${x.j.nombre} (${x.rival.nombre}) se abre a las ${cuando(x.protegidoHasta).split(' ').pop()}: ${eur(x.clausula)}. Ten la app de LaLiga Fantasy a mano.`, 'rivales');
        add(`cl-${x.teamId}-${x.pid}`, x.protegidoHasta, `Ya puedes clausular a ${x.j.nombre}`,
          `${eur(x.clausula)} a ${x.rival.nombre}. Vale ${eur(x.j.valor)}. Corre antes que el resto.`, 'rivales');
      });
  }
  if (c.mias) {
    M.mias.filter((x) => !x.abierta && x.abreEn < 7 * DIA && x.ratio != null && x.ratio < 1.6)
      .forEach((x) => add(`mia-${x.pid}`, x.protegidoHasta - 2 * HORA, `A ${x.j.nombre} le quedan 2 h de protección`,
        `Su cláusula es ${eur(x.clausula)} y vale ${eur(x.j.valor)}. Si no quieres perderlo, súbesela.`, 'equipo'));
  }
  if (c.mercado) {
    for (const v of M.misVentas || []) {
      const m = v.mejor;
      if (m && m.caduca) add(`oferta-${v.pid}-${m.id || m.importe}`, m.caduca - HORA, `Caduca la oferta por ${v.j.nombre}`,
        `${m.de} te da ${eur(m.importe)} (vale ${eur(v.j.valor)}). ${v.consejo === 'aceptar' ? 'Te conviene aceptarla.' : 'Si no la quieres, déjala caducar.'}`, 'equipo');
    }
  }
  if (c.mercado && M.cierreMercado) {
    const n = M.mercado.filter((m) => m.miPuja).length;
    add('mercado', M.cierreMercado - HORA, 'El mercado cambia en 1 hora', n ? `Tienes ${n} puja${n > 1 ? 's' : ''} en marcha. Revisa que te llega el dinero.` : 'Última hora para pujar por lo de hoy.', 'mercado');
  }
  if (c.jornada && M.proxima) {
    add(`jornada-${M.proxima.n}`, M.proxima.ini - 3 * HORA, `La jornada ${M.proxima.n} empieza en 3 horas`,
      M.negativo ? `Estás en negativo (${eur(D.dinero)}): si empieza así, no puntúas. Y revisa la alineación.` : 'Revisa la alineación y que no tengas a nadie lesionado de titular.', 'equipo');
  }
  if (c.diario) {
    const [h, m] = String(c.hora || '13:30').split(':').map(Number);
    const hoy = new Date();
    const t = new Date(hoy.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const desfase = hoy.getTime() - t.getTime();
    t.setHours(h || 0, m || 0, 0, 0);
    let cuandoT = t.getTime() + desfase;
    if (cuandoT < ahora + MIN) cuandoT += DIA;
    out.push({ id: 'diario', t: cuandoT, titulo: 'Tu liga hoy', texto: 'Mercado nuevo, cláusulas que se abren y el análisis del día. Ábrela para ponerla al día.', hash: '', cada: DIA });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** recalcula y se los pasa a la app (o los quita todos si están apagados) */
export function programar(D, M) {
  const c = cfgAvisos();
  const lista = c.on ? calcular(D, M, c) : [];
  LS.set('avisos-prog', lista);
  if (enApp) nativo.programarAvisos(lista);
  return lista;
}
export const programados = () => LS.get('avisos-prog', []);
