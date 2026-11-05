// Caídas probables de la jornada que viene: titulares habituales con baja o duda (Carlos, 2 nov 16:16: «es probable que no vaya a jugar»).
// % de titularidad: el once probable (0,5, lib/ff.mjs, desde el 3 nov), minutos de las últimas jornadas (0,3) y partidos de más de 60'
// de la temporada (0,2); ×0,6 si es duda; 0 si está lesionado o sancionado. Una duda se publica si el once probable también la da.
import { corto, elegir, fmt, partes, el, del, largo, rotar } from '../lib/texto.mjs';
import { tweet, cap, segunda, enPalabras, proximoPartido, paraLa, cuando, aparte } from '../lib/redactar.mjs';
import { ficha, ESTADOS } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { tarjetaBajas } from '../lib/datos-tarjetas.mjs';
import { onceProbable, pOnce } from '../lib/ff.mjs';
import { lesionados, parteDe, motivoSancion, desdeTxt, lesionTxt, numerosDe, ventaObligatoria } from '../lib/partes.mjs';
import { lineasPorEstado, elQueMasPesa, enLetra, mayus, detalle, detalles, pesos } from '../lib/agrupar.mjs';

export function baseTitular(playerStats, hasta) {
  const s = (playerStats || []).filter((x) => x.weekNumber <= hasta && x.stats && x.stats.mins_played).sort((a, b) => a.weekNumber - b.weekNumber);
  if (s.length < 3) return null;
  const min = (x) => Number(x.stats.mins_played[0]) || 0;
  const ult = s.slice(-5);
  const a = ult.filter((x) => min(x) >= 60).length / ult.length;
  const b = s.filter((x) => min(x) >= 60).length / s.length;
  return { p: (0.3 * a + 0.2 * b) / 0.5, a, b, ult: ult.length, temporada: s.length };
}

export async function generar({ jugadores, equipos, jornada, ultimaJugada, config, stats = [], semana = null, soloSeguras = false, registro = null, ahora = Date.now(), log = console.log }) {
  // Sin repetir (Carlos, 3 nov 12:06: Lemar salió en novedades a las 11:51 y en caídas a las 11:52): fuera quien ya ha salido en un
  // tweet de caídas de esta jornada o en uno de novedades de las últimas 24 h. Así, además, un grupo publicado no vuelve a salir
  // con otra forma cuando se le suma o se le quita alguien.
  const cub = registro && registro.cubiertos ? registro.cubiertos() : [];
  const yaSalio = new Set(cub.filter((c) => ((c.tipo === 'caidas' || c.tipo === 'sancionados') && c.jornada === jornada) || ((c.tipo === 'novedades' || (c.tipo === 'noticias' && c.que === 'mala')) && ahora - c.t < 24 * 36e5)).map((c) => String(c.id)));
  // escudos por equipo, de la jornada que hay en memoria (juegan los 20)
  const escudos = {};
  for (const m of stats || []) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const malos = jugadores
    .filter((j) => ESTADOS[j.playerStatus] && j.playerStatus !== 'out_of_league' && j.positionId >= 1 && j.positionId <= 4)
    .filter((j) => { if (!yaSalio.has(String(j.id))) return true; log(`  (caídas) ${j.nickname} ya ha salido: no lo repito`); return false; })
    .sort((a, b) => Number(b.marketValue) - Number(a.marketValue))
    .slice(0, 36);
  const fichas = await enParalelo(malos, 5, (j) => ficha(j.id));
  // el once probable de los equipos con alguna duda (lib/ff.mjs): da el % como la app y sirve de segunda fuente para la duda
  const ffs = new Map();
  if (config.onceProbable !== false) {
    for (const j of malos) {
      const k = String(j.teamId);
      if (j.playerStatus !== 'doubtful' || ffs.has(k)) continue;
      ffs.set(k, await onceProbable(equipos[k] || '', jugadores.filter((x) => String(x.teamId) === k), { log }));
    }
  }
  // el motivo de cada uno (lib/partes.mjs): la lesión y lo que se espera, o la roja o las amarillas de la sanción
  const lista = await lesionados({ log });
  const caidas = [];
  malos.forEach((j, i) => {
    const f = fichas[i];
    if (!f || f.error) return;
    const b = baseTitular(f.playerStats, ultimaJugada);
    if (!b || b.p < 0.6) return;                      // solo titulares habituales
    const ff = ffs.get(String(j.teamId)) || null, o = ff ? ff[j.id] || null : null;
    // publicando, una duda solo sale con una segunda fuente (regla de Carlos): que el once probable también lo dé por tocado
    if (soloSeguras && j.playerStatus === 'doubtful' && !(o && o.estado !== 'ok')) return;
    const p = j.playerStatus === 'doubtful' ? (ff ? 0.5 * pOnce(o) + 0.3 * b.a + 0.2 * b.b : b.p) * 0.6 : 0;
    if (p >= config.umbralCaida) return;
    const parte = parteDe(j, lista);
    const motivoSan = j.playerStatus === 'suspended' ? motivoSancion(f) : null;
    // publicando, un lesionado sin parte no sale todavía (Carlos, 3 nov 13:15: no vale «aparece como lesionado» a secas); vuelve a mirarse en la siguiente
    if (soloSeguras && j.playerStatus === 'injured' && !(parte && parte.lesion)) { log(`  (caídas) ${j.nickname}: sin parte de la lesión todavía, espero`); return; }
    caidas.push({ parte, motivoSan, id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo: corto(equipos[String(j.teamId)] || '?'), club: equipos[String(j.teamId)] || '', caraUrl: j.image || null, escudoUrl: escudos[String(j.teamId)] || null, estado: ESTADOS[j.playerStatus], p, pct: Math.round(p * 100), media: Number(j.averagePoints) || 0, valor: Number(j.marketValue) || 0, n60: Math.round(b.a * b.ult), ult: b.ult });
  });
  // cuántas caídas llevamos esta jornada (para que las formas roten entre los tweets que salen a lo largo de los días)
  const vez = registro && registro.todos ? registro.todos().filter((x) => x && x.tipo === 'caidas' && Number(x.jornada) === Number(jornada)).length : 0;
  return escribir(caidas, { jornada, semana, ahora, vez });
}

/** Los tweets a partir de las caídas ya calculadas (aparte para poder probarlo sin red: bot/prueba/bajas-ejemplo.mjs) */
export async function escribir(caidas, { jornada, semana = null, proximo = proximoPartido, ahora = Date.now(), vez = 0 }) {
  // Cómo se escriben (guía de estilo del 3 nov y Carlos, 3 nov 12:06: la lista con paréntesis le sonaba a máquina): un equipo con dos
  // o más caídas, en su propio tweet («🚨 El Villarreal se queda sin dos titulares» y una línea por lo que pasa); uno o dos sueltos,
  // un tweet cada uno con la etiqueta final; más sueltos, agrupados por lo que pasa («❌ Se caen por lesión Lemar en el Elche y…»),
  // con la media solo del que más pesa (lib/agrupar.mjs).
  const out = [];
  const pp = new Map();
  for (const c of caidas) if (!pp.has(String(c.teamId))) pp.set(String(c.teamId), await proximo(c.teamId, { jornada, semana }).catch(() => null));
  // en los tweets de varios, el lesionado que el parte da por duda va como «tocado» (lib/agrupar.mjs): ni «se cae» ni «Baja Fantasy»
  const est = (c) => (c.estado === 'lesionado' && c.parte && c.parte.estado === 'duda' ? 'tocado' : c.estado);
  const comoVan = (xs) => xs.map((c) => ({ ...c, estado: est(c) }));
  const seguro = (c) => est(c) !== 'duda' && est(c) !== 'tocado';
  // en la tarjeta, el «tocado» va como «DUDA LEVE» (no como lesionado: contradecía al texto; auditoría del 5 nov)
  const aTarjeta = (xs) => xs.map((c) => (est(c) === 'tocado' ? { ...c, estado: 'duda', leve: true, pct: null } : c));
  // la forma de `pesos` rota entre los tweets de esta vuelta (con el hash de los ids, dos seguidos salían igual)
  let kP = vez;
  const pesoR = (xs) => { if (!L) return elQueMasPesa(xs); const r = pesos(xs, `pesos${jornada}`, { k: kP++ }); return r && { ...r, t: aparte(r.t) }; };
  // con tweets largos (X Premium): el motivo de todos, la media de todos y cuándo es el partido (lib/agrupar.mjs, lib/redactar.mjs)
  const L = largo();
  const motivo = (xs) => (L ? detalles(xs, 3, xs.map((x) => x.id).join('-')) : detalle(xs));
  const hora = (pr) => { const c = L && pr && pr.fecha ? cuando(pr.fecha, ahora) : null; return c ? { t: `🗓️ El partido es ${c.t}`, numeros: c.numeros } : null; };
  const numDe = (c) => [...(c.estado === 'duda' ? [c.pct] : []), ...(c.media >= 3 ? partes(c.media) : [])];
  const porEquipo = new Map();
  for (const c of caidas) { const k = String(c.teamId); if (!porEquipo.has(k)) porEquipo.set(k, []); porEquipo.get(k).push(c); }
  const sueltos = [];
  for (const [k, cs] of porEquipo) {
    if (cs.length < 2) { sueltos.push(...cs); continue; }
    const xs = cs.slice(0, 4);
    const eq = xs[0].equipo, pr = pp.get(k);
    const cab = `🚨 ${cap(el(eq))} ${xs.every(seguro) ? 'se queda sin' : 'puede quedarse sin'} ${enLetra(xs.length)} titulares`;
    const lineas = lineasPorEstado(comoVan(xs), { club: true });
    const top = pesoR(xs.filter(seguro)), det = motivo(xs), hr = hora(pr);
    const ideas = [...lineas.map((t) => ({ t, prio: 9 })), hr && { t: hr.t, prio: 3 }, det && { t: det.t, prio: 6 }, top && { t: top.t, prio: 5 },
      { t: `${xs.every(seguro) ? '❌ Bajas' : xs.some(seguro) ? '⁉️ Bajas y dudas' : '⁉️ Dudas'} Fantasy ${paraLa(pr, jornada)}`, prio: 8 }];
    const { usadas, texto } = tweet(cab, ideas);
    if (!lineas.every((l) => usadas.includes(l))) continue;
    const clave = `caidas|${jornada}|${xs.map((c) => c.id).join('-')}`;
    out.push({ tipo: 'caidas', clave, jornada, texto, numeros: [jornada, pr ? pr.jornada : jornada, ...xs.filter((c) => c.estado === 'duda').map((c) => c.pct), ...(top ? top.numeros : []), ...(det ? det.numeros : []), ...(hr ? hr.numeros : [])], tarjeta: tarjetaBajas({ jornada, filas: aTarjeta(xs), pp: pr, clave }) });
  }
  // uno suelto: su propio tweet con la etiqueta final (formato Carrasco)
  let kS = vez + out.length;
  const unSuelto = (c) => {
    // cada forma rota por cuántas caídas sueltas llevamos (dos seguidas no se leen calcadas; las etiquetas del final no cambian)
    const k = kS++, R = (fs, slot) => rotar(fs, `caida${slot}${jornada}`, k);
    const pr = pp.get(String(c.teamId));
    const p = c.parte;
    // la web lo da por duda aunque LaLiga lo tenga lesionado: se dice así, sin darlo por perdido
    const dudaWeb = c.estado === 'lesionado' && p && p.estado === 'duda';
    const venta = c.estado === 'lesionado' && ventaObligatoria(p, ahora);
    const cab = c.estado === 'duda' ? `⁉️ ${c.nombre} es duda en ${el(c.equipo)}`
      : c.estado === 'sancionado' ? `🟥 ${c.nombre} no estará ${pr ? `contra ${el(pr.rival)}` : 'en el próximo partido'}`
      : dudaWeb ? `🚨 ${c.nombre} apunta a perderse ${pr ? `el partido contra ${el(pr.rival)}` : 'el próximo partido'}`
      : R([`🚨 ${c.nombre} se cae del once ${del(c.equipo)}`, `🚨 ${cap(el(c.equipo))} pierde a ${c.nombre}`, c.media >= 5 ? `🚨 Baja importante en ${el(c.equipo)}: ${c.nombre}` : `🚨 ${c.nombre} no estará con ${el(c.equipo)}`], 'cab');
    const ideas = [
      p && p.lesion ? { t: `⚠️ ${cap(lesionTxt(p))}${desdeTxt(p) ? ` ${desdeTxt(p)}` : ''}`, prio: 9 } : null,
      p && p.estado === 'baja' && p.hasta ? { t: R([`🗓️ No se le espera hasta ${p.hasta}`, `🗓️ Estará fuera hasta ${p.hasta}`], 'hasta'), prio: venta ? 9 : 7 } : dudaWeb ? { t: R(['⁉️ Aún no está descartado del todo', '⁉️ De momento no está descartado'], 'desc'), prio: 7 } : null,
      c.motivoSan ? { t: `⚠️ ${c.motivoSan.txt} y cumple sanción`, prio: 9 } : null,
      c.estado === 'duda' ? { t: `📊 ${cap(enPalabras(c.p))}: ${c.pct} % de titularidad`, prio: 8 } : null,
      { t: R([`‼️ ${cap(segunda(c.pos, c.nombre))} es titular habitual${c.media >= 3 ? ` y suma ${fmt(c.media)} de media` : ''}`,
        c.media >= 3 ? `‼️ Suele ser titular y va a ${fmt(c.media)} puntos por partido` : `‼️ Suele ser titular`,
        `‼️ ${cap(segunda(c.pos, c.nombre))} sale casi siempre de inicio${c.media >= 3 ? `: ${fmt(c.media)} de media` : ''}`], 'tit'), prio: 6 },
      // con tweets largos: cuánto juega y cuándo es el partido
      // (solo con 3 partidos o más y 2 o más de 60: ni «en 0 de sus 5» con un titular habitual ni «en sus 1 últimos»)
      L && c.n60 != null && c.ult >= 3 && c.n60 >= 2 ? { t: c.n60 === c.ult ? `📊 Ha jugado 60 minutos o más en sus ${c.ult} últimos partidos` : `📊 Ha jugado 60 minutos o más en ${c.n60} de sus ${c.ult} últimos partidos`, prio: 3 } : null,
      hora(pr) ? { t: hora(pr).t, prio: 2 } : null,
      // una baja larga (5 semanas o más según el parte): la etiqueta de Carrasco para las lesiones largas
      { t: venta ? '💸 Venta Fantasy Obligatoria' : `${c.estado === 'duda' || dudaWeb ? '⁉️ Duda' : '❌ Baja'} Fantasy ${paraLa(pr, jornada)}`, prio: 9 }];
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) return null;
    const clave = `caidas|${jornada}|${c.id}`;
    return { tipo: 'caidas', clave, jornada, texto, numeros: [jornada, pr ? pr.jornada : jornada, ...numDe(c), ...numerosDe(p), ...(c.motivoSan ? c.motivoSan.numeros : []),
      ...(L && c.n60 != null && c.ult >= 3 && c.n60 >= 2 ? [60, c.n60, c.ult] : []), ...(hora(pr) ? hora(pr).numeros : [])], tarjeta: tarjetaBajas({ jornada, filas: [c], pp: pr, clave }) };
  };
  if (sueltos.length <= 2) {
    for (const c of sueltos) { const t = unSuelto(c); if (t) out.push(t); }
    return out;
  }
  // más de dos sueltos: agrupados por lo que pasa, llenando cada tweet con todos los que caben (por orden de valor)
  let i = 0, k = 0;
  while (i < sueltos.length && out.length < 12) {
    const resto = sueltos.slice(i, i + 6);
    let n = resto.length, texto = null, top = null, det = null;
    for (; n >= 1; n--) {
      const xs = resto.slice(0, n);
      // («no estarán», no «se caen»: la primera línea ya dice «Se caen por lesión…»)
      const quien = `${enLetra(n)} ${n === 1 ? 'titular habitual' : 'titulares habituales'} ${xs.every(seguro) ? (n === 1 ? 'no estará' : 'no estarán') : (n === 1 ? 'puede faltar' : 'pueden faltar')}`;
      const cab = elegir([`🚨 ${mayus(quien)} en la jornada ${jornada}`, `🚨 Ojo a tu once fantasy: ${quien} en la jornada ${jornada}`], `caidas${jornada}${k}`);
      const lineas = lineasPorEstado(comoVan(xs));
      top = pesoR(xs.filter(seguro)); det = motivo(xs);
      const etiqueta = `${xs.every(seguro) ? '❌ Bajas' : '⁉️ Bajas y dudas'} Fantasy para la jornada ${jornada}`;
      const r = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), det && { t: det.t, prio: 6 }, top && { t: top.t, prio: 4 }, { t: etiqueta, prio: 8 }]);
      // la etiqueta final tiene que caber: si no, van menos jugadores en este tweet y el resto en el siguiente
      // la etiqueta y el motivo (si alguno lo tiene) tienen que caber: si no, van menos jugadores en este tweet
      if ([...lineas, etiqueta, ...(det ? [det.t] : [])].every((l) => r.usadas.includes(l))) { texto = r.texto; break; }
    }
    if (!texto) break;
    if (n === 1) { const t = unSuelto(resto[0]); if (t) out.push(t); i += 1; k++; continue; }   // si sobra uno, va con el formato de uno solo
    const quienes = resto.slice(0, n);
    const clave = `caidas|${jornada}|${quienes.map((c) => c.id).join('-')}`;
    out.push({ tipo: 'caidas', clave, jornada, texto, numeros: [jornada, ...quienes.flatMap((c) => (c.estado === 'duda' ? [c.pct] : [])), ...(top ? top.numeros : []), ...(det ? det.numeros : [])], tarjeta: tarjetaBajas({ jornada, filas: aTarjeta(quienes), pp: quienes.every((c) => String(c.teamId) === String(quienes[0].teamId)) ? pp.get(String(quienes[0].teamId)) : null, clave }) });
    i += n; k++;
  }
  return out;
}
