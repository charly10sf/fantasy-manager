/* Los avisos del móvil. Con cada actualización se recalcula la lista entera de lo que va a pasar y se le
   pasa a la app, que pone una alarma del sistema para cada cosa (llegan aunque la app esté cerrada). */
import { nativo, enApp } from './puente.js';
import { LS, eur, cuando, MIN, HORA, DIA, diaDe, otroDia, horaDe } from './util.js';
import { cerradaHasta } from './limite.js';
import { esClausulable } from './motor.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);

/* (40, 10 nov) la antelación de cada tipo, en minutos, la elige cada uno en Ajustes → Avisos. Las de siempre: plan 1 min,
   rivales 15 min (y otro al abrirse), tus cláusulas 2 h, mercado 1 h y el once 3 h antes de la jornada.
   `jugadores`: los «Avisarme de este jugador» de la ficha, { pid: { antes, nombre } }, aunque su interés sea bajo */
export const ANTES = { plan: 1, rivales: 15, mias: 120, mercado: 60, jornada: 180 };
export const OPC_ANTES = { plan: [0, 1, 2, 5, 10], rivales: [5, 15, 30, 60], mias: [30, 60, 120, 180, 360], mercado: [15, 30, 60, 120], jornada: [30, 60, 120, 180, 360, 720, 1440], jugador: [0, 2, 5, 15, 60] };
export const cfgAvisos = () => {
  const g = LS.get('cfg-avisos', {}) || {};
  return {
    on: false, plan: true, alarma: true, rivales: true, mias: true, mercado: true, jornada: true, diario: true, hora: '13:30', interes: 55, miasTodas: false,
    ...g, antes: { ...ANTES, ...(g.antes || {}) }, jugadores: { ...(g.jugadores || {}) },
  };
};
export const guardarCfgAvisos = (c) => LS.set('cfg-avisos', { ...cfgAvisos(), ...c });
export const ponerAntes = (k, min) => guardarCfgAvisos({ antes: { ...cfgAvisos().antes, [k]: Math.max(0, +min || 0) } });
/** el aviso de un jugador concreto: antes en minutos (0, al abrirse) o null para quitarlo */
export function avisarJugador(pid, antes, nombre = '') {
  const js = { ...cfgAvisos().jugadores };
  if (antes == null || antes === '') delete js[pid];
  else js[pid] = { antes: Math.max(0, +antes || 0), nombre: String(nombre || '').slice(0, 40) };
  guardarCfgAvisos({ jugadores: js });
}
/** «1 min», «15 min», «1 h», «1 h 30 min», «1 día» */
export function tiempoTxt(m) {
  m = Math.round(+m || 0);
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} día${m === 1440 ? '' : 's'}`;
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}
export const antesTxt = (m) => (+m ? `${tiempoTxt(m)} antes` : 'Al abrirse');

// las cláusulas que esperan a que empiece la jornada (el cierre de 24 h antes) se reabren todas a la vez: un aviso para todas
const porVeda = (xs) => Object.values(xs.filter((x) => x.veda).reduce((g, x) => ((g[x.veda.n] ||= []).push(x), g), {}));
// «A, B y C»: con los precios dentro (11,38 M) no vale partir por comas
const conY = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0] || '');
const nombres = (xs, conPrecio = false) => `${xs.slice(0, 3).map((x) => (conPrecio ? `${x.j.nombre} (${eur(x.clausula)})` : x.j.nombre)).join(', ')}${xs.length > 3 ? ` y ${xs.length - 3} más` : ''}`;

/** la lista de avisos futuros con lo que hay ahora en la liga (y en el plan que se ve) */
export function calcular(D, M, c = cfgAvisos(), plan = null) {
  const out = [];
  const ahora = Date.now();
  const add = (id, t, titulo, texto, hash = '', extra = {}) => { if (t > ahora + 30e3 && t < ahora + 14 * DIA) out.push({ id, t: Math.round(t), titulo, texto, hash, ...extra }); };
  if (!D || !M) return out;

  // (lo pidió Carlos el 30 oct) los clausulazos que manda el plan: una alarma 1 minuto antes de que se abra la cláusula,
  // para tener LaLiga Fantasy abierta a la hora. Sale del plan que se ve: al rehacerlo (o si deja de mandarlo) se recalcula.
  // El de ayer, no: lo que mandaba ya puede no valer. Desde la 0.6.11 suena como una alarma (con el volumen de alarma,
  // aunque el móvil esté en silencio, hasta que se toca): Avisos.java, «alarma»
  const A = { ...ANTES, ...(c.antes || {}) };
  const al = c.alarma !== false ? { alarma: true } : {};
  const hhmm = (t) => cuando(t).split(' ').pop();
  const js = c.jugadores || {};
  if (c.plan && plan && !plan.viejo) {
    const ap = A.plan * MIN, en = A.plan ? `En ${tiempoTxt(A.plan)} se` : 'Ya se';
    const xs = [];
    for (const o of plan.ops || []) {
      if (o.accion !== 'clausular' || !o.pid || o.descartada || o.ya || xs.some((x) => x.pid === o.pid)) continue;
      const x = M.clausulas.find((y) => y.pid === o.pid);
      if (x && !x.abierta && x.protegidoHasta) xs.push(x);
    }
    for (const g of porVeda(xs)) {
      const v = g[0].veda;
      add(`plan1-reabre-${v.n}`, v.abre - ap, `${en} reabren las cláusulas`,
        `Tu plan dice clausular a ${conY(g.map((x) => `${x.j.nombre} (${eur(x.clausula)})`))} a las ${hhmm(v.abre)}. Abre LaLiga Fantasy ya.`, 'hoy', al);
    }
    xs.filter((x) => !x.veda)
      .forEach((x) => add(`plan1-${x.teamId}-${x.pid}`, x.protegidoHasta - ap, `${en} abre ${x.j.nombre}`,
        `Tu plan dice clausularlo: ${eur(x.clausula)} a ${x.rival.nombre}, a las ${hhmm(x.protegidoHasta)}. Abre LaLiga Fantasy ya.`, 'hoy', al));
  }

  // (40) «Avisarme de este jugador», desde su ficha: a la antelación elegida, sea cual sea su interés. Si no es de ningún
  // rival o ya tiene la cláusula abierta, no hay nada que avisar (se queda guardado por si vuelve a cerrarse)
  for (const [pid, a] of Object.entries(js)) {
    const x = M.clausulas.find((y) => y.pid === pid);
    if (!x || x.abierta || !x.protegidoHasta) continue;
    const abre = x.veda ? x.veda.abre : x.protegidoHasta, m = Math.max(0, +(a && a.antes) || 0);
    add(`jug-${pid}`, abre - m * MIN, m ? `En ${tiempoTxt(m)} se abre ${x.j.nombre}` : `Ya puedes clausular a ${x.j.nombre}`,
      `${eur(x.clausula)} a ${x.rival.nombre}, a las ${hhmm(abre)}${x.veda ? `, cuando empieza la jornada ${x.veda.n}` : ''}. Vale ${eur(x.j.valor)}. Lo pediste tú: abre LaLiga Fantasy.`, 'rivales', al);
  }

  if (c.rivales) {
    const ar = A.rivales * MIN, enR = tiempoTxt(A.rivales);
    const vanAbrir = M.clausulas.filter((x) => !x.abierta && !js[x.pid] && x.abreEn < 7 * DIA && x.interes >= c.interes && esClausulable(M, x))
      .sort((a, b) => b.interes - a.interes).slice(0, 10);
    for (const xs of porVeda(vanAbrir)) {
      const v = xs[0].veda;
      const h = cuando(v.abre).split(' ').pop();
      add(`reabre15-${v.n}`, v.abre - ar, `En ${enR} se reabren las cláusulas`,
        `A las ${h} empieza la jornada ${v.n} y se puede volver a clausular: ${nombres(xs, true)}. Ten la app de LaLiga Fantasy a mano.`, 'rivales');
      add(`reabre-${v.n}`, v.abre, 'Ya se puede clausular',
        `Empieza la jornada ${v.n}: ${nombres(xs, true)}. Corre antes que el resto.`, 'rivales');
    }
    vanAbrir.filter((x) => !x.veda)
      .forEach((x) => {
        add(`cl15-${x.teamId}-${x.pid}`, x.protegidoHasta - ar, `En ${enR} se abre ${x.j.nombre}`,
          `La cláusula de ${x.j.nombre} (${x.rival.nombre}) se abre a las ${hhmm(x.protegidoHasta)}: ${eur(x.clausula)}. Ten la app de LaLiga Fantasy a mano.`, 'rivales');
        add(`cl-${x.teamId}-${x.pid}`, x.protegidoHasta, `Ya puedes clausular a ${x.j.nombre}`,
          `${eur(x.clausula)} a ${x.rival.nombre}. Vale ${eur(x.j.valor)}. Corre antes que el resto.`, 'rivales');
      });
  }
  if (c.mias) {
    // las que están baratas (ratio < 1,6) o, si lo eliges, todas
    const am = A.mias * MIN;
    const expuestos = M.mias.filter((x) => !x.abierta && x.abreEn < 7 * DIA && (c.miasTodas || (x.ratio != null && x.ratio < 1.6)));
    for (const xs of porVeda(expuestos)) {
      const v = xs[0].veda;
      add(`mias-reabre-${v.n}`, v.abre - am, `A las ${cuando(v.abre).split(' ').pop()} se reabren las cláusulas`,
        `Empieza la jornada ${v.n} y ${nombres(xs)} se ${xs.length > 1 ? 'quedan' : 'queda'} con la cláusula abierta. ${xs.length > 1 ? 'Si no quieres perderlos, súbeles la cláusula antes o blíndalos a esa hora.' : 'Si no quieres perderlo, súbele la cláusula antes o blíndalo a esa hora.'}`, 'equipo');
    }
    expuestos.filter((x) => !x.veda)
      .forEach((x) => add(`mia-${x.pid}`, x.protegidoHasta - am, `A ${x.j.nombre} le ${A.mias === 1 ? 'queda' : 'quedan'} ${tiempoTxt(A.mias)} de protección`,
        `Su cláusula es ${eur(x.clausula)} y vale ${eur(x.j.valor)}. Si no quieres perderlo, súbesela.`, 'equipo'));
  }
  if (c.mercado) {
    for (const v of M.misVentas || []) {
      const m = v.mejor;
      if (m && m.caduca) add(`oferta-${v.pid}-${m.id || m.importe}`, m.caduca - HORA, `Caduca la oferta por ${v.j.nombre}`,
        `${m.de} te da ${eur(m.importe)} (vale ${eur(v.j.valor)}). ${v.consejo === 'aceptar' ? 'Te conviene aceptarla.' : 'Si no la quieres, déjala caducar.'}`, 'equipo');
    }
  }
  // lo comprado para revender: el día que toca ponerlo a la venta
  if (c.mercado && M.ventanaEsp && (M.paraRevender || []).length) {
    const xs = M.paraRevender.filter((x) => !(M.enVenta && M.enVenta.has(x.pid)));
    if (xs.length) add(`revender-${M.proxima ? M.proxima.n : ''}`, M.ventanaEsp.ponerVenta, `Hoy toca poner a la venta ${xs.map((x) => x.j.nombre).join(', ')}`,
      'Es lo que compraste para revender: ponlo ya para que llegue la oferta antes de la jornada.', 'equipo');
  }
  if (c.mercado && M.cierreMercado) {
    const n = M.mercado.filter((m) => m.miPuja).length;
    add('mercado', M.cierreMercado - A.mercado * MIN, `El mercado cambia en ${tiempoTxt(A.mercado)}`, n ? `Tienes ${n} puja${n > 1 ? 's' : ''} en marcha. Revisa que te llega el dinero.` : 'Última hora para pujar por lo de hoy.', 'mercado');
  }
  // (40) el recordatorio del once, a la antelación elegida: con los huecos que te quedan y los tuyos de baja
  if (c.jornada && M.proxima) {
    const huecos = (M.once && M.once.huecos) || 0;
    const bajas = (M.mias || []).filter((x) => x.j && MALOS.has(x.j.estado)).map((x) => x.j.nombre);
    const txt = M.negativo ? `Estás en negativo (${eur(D.dinero)}): si empieza así, no puntúas. Y revisa el once.`
      : `${huecos ? `Te ${huecos === 1 ? 'falta 1 jugador' : `faltan ${huecos} jugadores`} para completarlo. ` : ''}${bajas.length ? `${conY(bajas.slice(0, 3))}${bajas.length > 3 ? ` y ${bajas.length - 3} más` : ''} ${bajas.length === 1 ? 'no juega' : 'no juegan'}: no ${bajas.length === 1 ? 'lo' : 'los'} pongas.` : 'Que no tengas a nadie lesionado de titular.'}`;
    add(`jornada-${M.proxima.n}`, M.proxima.ini - A.jornada * MIN, `Pon el once: la jornada ${M.proxima.n} empieza en ${tiempoTxt(A.jornada)}`, txt, 'equipo');
  }
  if (c.diario) {
    // uno por día, cada uno a su hora de Madrid: sumar 24 h fijas descuadraba una hora con el cambio de hora (el 25 oct
    // llegaba a las 12:30). El último se repite cada 24 h, por si no se abre la app en una semana
    const [h, m] = String(c.hora || '13:30').split(':').map(Number);
    const hhmm = `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
    const enMadrid = (d) => [1, 2].map((o) => Date.parse(`${d}T${hhmm}:00+0${o}:00`)).find((t) => horaDe(t) === hhmm && diaDe(t) === d);
    const d0 = diaDe(ahora);
    const ts = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => enMadrid(otroDia(d0, k))).filter((t) => t && t >= ahora + MIN).slice(0, 7);
    ts.forEach((t, i) => out.push({ id: i === ts.length - 1 ? 'diario' : `diario-${diaDe(t)}`, t, titulo: 'Tu liga hoy', texto: 'Mercado nuevo, cláusulas que se abren y el análisis del día. Ábrela para ponerla al día.', hash: '', ...(i === ts.length - 1 ? { cada: DIA } : {}) }));
  }
  return out.sort((a, b) => a.t - b.t);
}

/** recalcula y se los pasa a la app (o los quita todos si están apagados) */
export function programar(D, M, plan = null) {
  const c = cfgAvisos();
  // con la liga de ejemplo, nada de avisos: serían de datos inventados
  let lista = c.on && D && !D.demo ? calcular(D, M, c, plan) : [];
  // si la app aún no se ha abierto para este equipo (limites.json, «abre»), nada de avisos antes de esa hora
  const e = D && !D.demo && D.yo ? (D.clasif || []).find((x) => x.teamId === D.yo.teamId) : null;
  const hasta = e ? cerradaHasta((LS.get('limites', null) || {}).cfg, { nombre: e.nombre, teamId: e.teamId, userId: D.yo.userId, ligas: D.ligas || [] }) : null;
  if (hasta) {
    lista = lista.filter((a) => a.t >= hasta);
    if (hasta > Date.now() + 30e3) lista.push({ id: 'apertura', t: Math.round(hasta), titulo: '¡Fantasy Manager ya está abierta!', texto: 'Mercado nuevo y tu plan del día listos. Entra antes de que empiece la jornada.', hash: 'hoy' });
  }
  LS.set('avisos-prog', lista);
  if (enApp) nativo.programarAvisos(lista);
  return lista;
}
export const programados = () => LS.get('avisos-prog', []);
