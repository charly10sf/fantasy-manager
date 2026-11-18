// El calendario de cláusulas (clausulas/, idea 3 del plan de AdSense, 16 nov): cuándo se cierran y se reabren las cláusulas en las
// próximas jornadas, cuántos cambios de mercado quedan hasta el próximo cierre y, si fichas a alguien hoy o en los próximos días,
// hasta cuándo lo tienes protegido y desde cuándo te lo pueden clausular. Con las reglas de LaLiga Fantasy que usa la app (motor.js,
// `M.vedas`): nadie puede pagar una cláusula en las 24 h antes del primer partido de la jornada, se reabren a esa hora, y un fichaje
// tiene la cláusula protegida 14 días. Los horarios, de la API de LaLiga Fantasy sin token. Texto con reglas, sin IA.
import { corto } from '../lib/texto.mjs';
import { equiposDe } from '../lib/laliga.mjs';
import { enMadrid, fechaHora, fecha, diaCorto, hora } from './vista.mjs';
import { e, bloque, tabla, kpis, fechaCorta, escudo } from './portal.mjs';

const HORA = 36e5, DIA = 24 * HORA;
export const PROTEGIDO = 14 * DIA;          // como motor.js (336 h)
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** LaLiga pone las 00:00 UTC cuando aún no sabe la hora de un partido */
const sinHora = (t) => { const d = new Date(t); return d.getUTCHours() === 0 && d.getUTCMinutes() === 0; };

/** el instante de una hora de Madrid (día y mes de Madrid) */
export function enHoraMadrid(anio, mes, dia, hh, mm) {
  const quiero = Date.UTC(anio, mes - 1, dia, hh, mm);
  let t = quiero;
  for (let i = 0; i < 3; i++) {
    const p = enMadrid(t);
    const veo = Date.UTC(p.anio, p.mes - 1, p.dia, +p.hora.slice(0, 2), +p.hora.slice(3));
    if (veo === quiero) break;
    t -= veo - quiero;
  }
  return t;
}

/** los cambios de mercado (hacia las 00:15 de Madrid) que hay entre dos instantes */
export function cambiosEntre(desde, hasta) {
  const d = enMadrid(desde);
  let n = 0;
  for (let k = 0; k < 60; k++) {
    const t = enHoraMadrid(d.anio, d.mes, d.dia + k, 0, 15);
    if (t >= hasta) break;
    if (t > desde) n++;
  }
  return n;
}

/**
 * Los hechos del calendario. api: { semanaActual, statsSemana }. Devuelve null si no hay jornadas por jugar.
 * { ahora, jornadas: [{ J, primero, ultimo, cierre, reapertura, sinHora, enJuego, partido }], siguiente (la del próximo cierre),
 *   cambios (hasta ese cierre), fichajes: [{ dia, protegido, libre, veda }] }
 */
export async function hechosClausulas(api, { ahora = Date.now(), n = 5 } = {}) {
  const sem = await api.semanaActual();
  const J0 = sem.weekNumber;
  const jornadas = [];
  for (let J = J0; J <= Math.min(38, J0 + n + 1) && jornadas.length < n; J++) {
    const st = await api.statsSemana(J).catch(() => []);
    if (!Array.isArray(st) || !st.length) continue;
    const ps = [...st].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const primero = Date.parse(ps[0].date), ultimo = Date.parse(ps[ps.length - 1].date);
    if (st.every((m) => m.matchState === 7) || ultimo + 3 * HORA < ahora) continue;
    const eq = equiposDe(st);
    const m0 = ps[0];
    jornadas.push({ J, primero, ultimo, cierre: primero - DIA, reapertura: primero, sinHora: sinHora(primero), enJuego: primero <= ahora,
      partido: { local: corto(eq[String(m0.local.id)] || m0.local.mainName), visitante: corto(eq[String(m0.visitor.id)] || m0.visitor.mainName), escL: m0.local.badgeColor, escV: m0.visitor.badgeColor } });
  }
  if (!jornadas.length) return null;
  const siguiente = jornadas.find((j) => j.cierre > ahora) || null;
  const cambios = siguiente ? cambiosEntre(ahora, siguiente.cierre) : null;
  // si se queda contigo en el cambio de mercado de hoy o de los próximos 6 días (las pujas se resuelven con el cambio, hacia las 00:15)
  const h = enMadrid(ahora);
  const fichajes = [];
  for (let k = 0; fichajes.length < 7 && k < 9; k++) {
    const t = enHoraMadrid(h.anio, h.mes, h.dia + k, 0, 15);
    if (t <= ahora) continue;   // el primero, el próximo cambio: lo que pujes hoy se resuelve ahí
    const protegido = t + PROTEGIDO;
    const veda = jornadas.find((j) => protegido >= j.cierre && protegido < j.reapertura) || null;
    fichajes.push({ dia: t, protegido, libre: veda ? veda.reapertura : protegido, veda: veda ? veda.J : null,
      jornadaLibre: (jornadas.find((j) => j.cierre > (veda ? veda.reapertura : protegido)) || {}).J || null });
  }
  return { ahora, jornadas, siguiente, cambios, fichajes };
}

const corta = (t, sh = false) => `${diaCorto(t).split(' ')[0]} ${fechaCorta(t)}, ${sh ? 'hora por confirmar' : hora(t)}`;
const diaLargo = (t) => { const d = enMadrid(t); return `${d.dia} de ${MESES[d.mes - 1]}`; };

/** clausulas/: el calendario */
export function contenidoClausulas(c, { previa = null } = {}) {
  const raiz = '../';
  const o = [];
  const s = c.siguiente;
  o.push(`  <h1>Calendario de <span>cláusulas</span></h1>`);
  o.push(`  <p class="fresco">Horarios de LaLiga Fantasy del ${e(diaLargo(c.ahora))}, en hora de Madrid · se rehace cada noche</p>`);
  const enJuego = c.jornadas.find((j) => j.enJuego);
  if (s) {
    o.push(kpis([
      { v: s.sinHora ? '¿?' : e(hora(s.cierre)), l: 'Próximo cierre', s: e(`${diaCorto(s.cierre).split(' ')[0]} ${fechaCorta(s.cierre)} · J${s.J}`) },
      { v: s.sinHora ? '¿?' : e(hora(s.reapertura)), l: 'Se reabren', s: e(`${diaCorto(s.reapertura).split(' ')[0]} ${fechaCorta(s.reapertura)}`) },
      { v: String(c.cambios), l: 'Cambios de mercado', s: 'hasta el cierre' },
    ], 'k3'));
  }

  // lo de ahora, contado
  const fr = [];
  if (enJuego && (!s || s.J !== enJuego.J)) fr.push(`La jornada ${enJuego.J} se está jugando: las cláusulas están abiertas desde el ${fechaHora(enJuego.reapertura)}, cuando empezó el ${enJuego.partido.local}-${enJuego.partido.visitante}.`);
  if (s) {
    fr.push(s.sinHora
      ? `LaLiga Fantasy aún no ha puesto la hora del primer partido de la jornada ${s.J} (${s.partido.local}-${s.partido.visitante}, el ${fecha(s.primero)}), así que el cierre de cláusulas será 24 horas antes de esa hora, todavía por confirmar.`
      : `El próximo cierre de cláusulas es el ${fechaHora(s.cierre)}, 24 horas antes del ${s.partido.local}-${s.partido.visitante}, el primer partido de la jornada ${s.J}. Desde ese momento nadie puede pagar ninguna cláusula hasta que empiece ese partido, a las ${hora(s.reapertura)} del ${fecha(s.reapertura)}.`);
    fr.push(c.cambios === 0 ? 'Ya no queda ningún cambio de mercado antes del cierre: lo que no hayas fichado o blindado ya, no llega.'
      : c.cambios === 1 ? 'Antes del cierre queda un solo cambio de mercado: las pujas que hagas hoy son las últimas que se resuelven antes de que se cierren las cláusulas.'
      : `Antes del cierre quedan ${c.cambios} cambios de mercado (hacia las 00:15 de cada día), es decir, ${c.cambios} oportunidades de que se resuelvan tus pujas.`);
  }
  o.push(bloque('Ahora mismo', fr.map((f) => `  <p>${e(f)}</p>`).join('\n') + (previa ? `\n  <p>Quién no juega y quién está a una amarilla esta jornada, en <a href="${raiz}${e(previa.ruta)}">la previa de la jornada ${previa.jornada}</a>.</p>` : ''), { id: 'ahora' }));

  // las próximas jornadas
  o.push(bloque('Cierres y reaperturas de las próximas jornadas', tabla([{ t: 'J', c: 'n' }, { t: 'Cierre' }, { t: 'Se reabren' }, { t: 'Primer partido', c: 'm' }],
    c.jornadas.map((j) => `<td class="n">${j.J}</td><td>${j.enJuego ? '<small>ya pasó</small>' : `<b>${e(corta(j.cierre, j.sinHora))}</b>`}</td><td>${e(corta(j.reapertura, j.sinHora))}</td><td class="m"><span class="eq-c">${escudo(j.partido.escL, j.partido.local, 20)}${escudo(j.partido.escV, j.partido.visitante, 20)}<span>${e(j.partido.local)}-${e(j.partido.visitante)}</span></span></td>`), { clase: 'td-cal' }),
  { id: 'jornadas', linea: 'El cierre es siempre 24 horas antes del primer partido de la jornada y las cláusulas se reabren cuando empieza ese partido. Si LaLiga cambia un horario, la tabla cambia esa misma noche.' }));

  // si fichas hoy
  const f0 = c.fichajes[0];
  const filas = c.fichajes.map((f) => `<td>${e(corta(f.dia))}</td><td>${e(corta(f.protegido))}</td><td><b>${e(corta(f.libre))}</b>${f.veda ? `<br><small>cae en el cierre de la J${f.veda}</small>` : ''}</td>`);
  const tx = [];
  if (f0) {
    tx.push(`Un jugador que fichas tiene la cláusula protegida 14 días: en ese tiempo nadie te lo puede quitar pagándola. Si pujas hoy y se queda contigo en el próximo cambio de mercado, el del ${fecha(f0.dia)}, lo tienes a salvo hasta el ${fechaHora(f0.protegido)}${f0.veda ? `, pero ese momento cae dentro del cierre de la jornada ${f0.veda}, así que en la práctica nadie lo puede clausular hasta que se reabran, el ${fechaHora(f0.libre)}` : ''}.`);
    const conVeda = c.fichajes.filter((f) => f.veda);
    if (conVeda.length && !f0.veda) tx.push(conVeda.length === 1 ? `Ojo con lo que se quede contigo el ${diaCorto(conVeda[0].dia)}: su protección se acaba en pleno cierre de cláusulas, así que le dura unas horas más, hasta la reapertura.` : `Ojo con lo que se quede contigo el ${conVeda.map((f) => diaCorto(f.dia)).join(' y el ')}: su protección se acaba en pleno cierre de cláusulas, así que les dura unas horas más, hasta la reapertura.`);
    else if (!conVeda.length) tx.push('Ninguno de los fichajes de esta semana acaba su protección dentro de un cierre: se pueden clausular justo al cumplir los 14 días.');
  }
  o.push(bloque('Si fichas hoy, ¿hasta cuándo está protegido?', tx.map((f) => `  <p>${e(f)}</p>`).join('\n') + '\n'
    + tabla([{ t: 'Se queda contigo' }, { t: 'Protegido hasta' }, { t: 'Clausulable desde' }], filas, { clase: 'td-fich' }),
  { id: 'fichajes', linea: `Hora de Madrid. Las pujas se resuelven con el cambio de mercado, hacia las 00:15; un jugador que te llega por cláusula a otra hora tiene sus 14 días desde ese momento. Para que tus jugadores aguanten más, <a href="${raiz}guias/blindaje-laliga-fantasy.html">el blindaje</a> o <a href="${raiz}guias/subir-clausula.html">subir la cláusula</a>.` }));

  o.push(bloque('Las reglas, en corto', `  <ul>
    <li>Las cláusulas se cierran 24 horas antes del primer partido de cada jornada y se reabren cuando empieza ese partido.</li>
    <li>Un fichaje tiene la cláusula protegida 14 días.</li>
    <li>Una cláusula solo se paga con saldo: el margen de deuda vale para pujar, no para clausular.</li>
    <li>El mercado cambia una vez al día, hacia las 00:15.</li>
  </ul>
  <p>Cuándo merece la pena pagar la de un rival, en <a href="${raiz}guias/cuando-clausular.html">cuándo clausular</a>; cómo funcionan, en <a href="${raiz}guias/clausulas-laliga-fantasy.html">las cláusulas en LaLiga Fantasy</a>. Cómo sacamos los horarios, en <a href="${raiz}metodo.html#clausulas">cómo calculamos</a>.</p>`, { id: 'reglas' }));
  return o.join('\n');
}

export const metasClausulas = () => ({ ruta: 'clausulas/index.html', seccion: 'jornada',
  titulo: 'Cierre de cláusulas en LaLiga Fantasy: calendario y horas', h1: 'Calendario de cláusulas',
  descripcion: 'Cuándo se cierran y se reabren las cláusulas en LaLiga Fantasy en las próximas jornadas, cuántos cambios de mercado quedan y hasta cuándo está protegido un fichaje. Se pone al día cada noche.',
  migas: [['Inicio', ''], ['Jornadas', 'jornada/']] });
