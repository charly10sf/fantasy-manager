// Novedades de jugadores entre semana (Carlos, 2 nov 23:28): cambios de estado en LaLiga Fantasy de los jugadores que importan
// (media de 4 o más, o 10 M o más de valor): pasa a lesionado, sancionado, o vuelve a estar disponible. Las dudas no salen solas
// (una duda necesita una segunda fuente, regla de Carlos). Compara con el estado guardado en el registro (`estados`, en la rama
// bot-estado); la primera vez solo lo guarda. Fuera de horario (9 a 23 h) no mira nada, así los cambios se acumulan para el día.
import { corto, fmt, partes, elegir, el, del, largo, rotar, turno } from '../lib/texto.mjs';
import { tweet, cap, segunda, proximoPartido, paraLa, cuando, aparte } from '../lib/redactar.mjs';
import { tarjetaBajas, tarjetasNovedades } from '../lib/datos-tarjetas.mjs';
import { lineasPorEstado, elQueMasPesa, enLetra, mayus, detalle, detalles, pesos } from '../lib/agrupar.mjs';
import { clubes as clubesH, partido as partidoH, jugador as jugadorH } from '../lib/hechos.mjs';
import { lesionados, parteDe, motivoSancion, desdeTxt, lesionTxt, numerosDe, ventaObligatoria } from '../lib/partes.mjs';
import { ficha as fichaLaLiga } from '../lib/laliga.mjs';
import { ideasInfo, vecesHoy } from '../lib/info-jugador.mjs';

const IMPORTA = (j) => Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
import { horaMadrid, horas } from '../lib/horario.mjs';   // entre semana, desde las 7 (lib/horario.mjs)
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
const ESTADO_DE = { lesion: 'injured', sancion: 'suspended', vuelve: 'ok' };
const HORA = 36e5;

export async function generar({ jugadores, equipos, jornada, stats = null, semana = null, config = {}, registro = null, ventanas = true, forzar = false, previos = null, ahora = Date.now(), log = console.log, proximo = proximoPartido, soloSeguras = false, listaPartes = null, fichaDe = fichaLaLiga, info = null }) {
  const [hD, hH] = horas(config, 'horasNovedades', [9, 23], ahora);
  if (ventanas && !forzar && (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH)) return [];
  const actual = {};
  for (const j of jugadores || []) actual[j.id] = j.playerStatus || 'ok';
  const antes = previos || (registro && registro.datos && registro.datos.estados) || null;
  const datos = registro && registro.datos;
  if (datos) datos.estados = actual;
  if (!antes) { if (registro) registro.guardar(); log('  (novedades) primera vez: guardo los estados y no publico nada'); return []; }
  // Pendientes (3 nov): el estado nuevo se guarda antes de publicar, así que un cambio que no salía (tope, máximo por ejecución o la
  // separación con caídas) se perdía. Ahora cada cambio queda pendiente hasta que sale, deja de ser verdad o pasan 36 h.
  let pend = (datos && Array.isArray(datos.novedadesPend) ? datos.novedadesPend : []).slice();
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  for (const j of (jugadores || []).filter(IMPORTA)) {
    const a = antes[j.id], b = actual[j.id];
    if (!a || a === b) continue;
    let que = null;
    if (b === 'injured' && a !== 'injured') que = 'lesion';
    else if (b === 'suspended' && a !== 'suspended') que = 'sancion';
    else if (b === 'ok' && ['injured', 'suspended', 'doubtful'].includes(a)) que = 'vuelve';
    if (!que) continue;
    pend = pend.filter((p) => String(p.id) !== String(j.id));
    pend.push({ id: j.id, que, antes: a, t: ahora });
  }
  const cub = registro && registro.cubiertos ? registro.cubiertos() : [];
  // también si la prensa ya lo ha contado (tipos/noticias.mjs): una lesión de la que ya habló, o una vuelta, en las 48 h de antes
  const fam = (q) => (q === 'vuelve' ? 'buena' : 'mala');
  const yaSalio = (p) => cub.some((c) => String(c.id) === String(p.id) && ((c.tipo === 'novedades' && c.que === p.que && c.t >= p.t - 72 * HORA)
    || (c.tipo === 'noticias' && c.que === fam(p.que) && c.t >= p.t - 48 * HORA)
    || (c.tipo === 'sancionados' && p.que === 'sancion' && c.t >= p.t - 72 * HORA)));
  pend = pend.filter((p) => porId.has(String(p.id)) && IMPORTA(porId.get(String(p.id))) && actual[p.id] === ESTADO_DE[p.que] && ahora - p.t < 36 * HORA && !yaSalio(p));
  if (datos) { datos.novedadesPend = pend; registro.guardar(); }
  const escudos = {};
  for (const m of stats || []) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const eventos = pend.map((p) => {
    const j = porId.get(String(p.id));
    return { id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo: corto(equipos[String(j.teamId)] || '?'), club: equipos[String(j.teamId)] || '', caraUrl: j.image || null, escudoUrl: escudos[String(j.teamId)] || null,
      estado: p.que === 'lesion' ? 'lesionado' : p.que === 'sancion' ? 'sancionado' : 'disponible', media: Number(j.averagePoints) || 0, valor: Number(j.marketValue) || 0, que: p.que, antes: p.antes, desde: p.t };
  });
  if (!eventos.length) return [];
  // el motivo (Carlos, 3 nov 13:15): la lesión y lo que se espera, de la lista de lesionados; la roja o las amarillas, de la ficha.
  // Publicando, una lesión sin parte espera (sigue pendiente) a que lo haya.
  const lista = listaPartes || await lesionados({ log });
  for (const e of eventos) {
    const j = porId.get(String(e.id));
    if (e.que !== 'sancion') e.parte = parteDe(j, lista);
    else e.motivoSan = motivoSancion(await fichaDe(e.id).catch(() => null));
  }
  const listos = eventos.filter((e) => !(soloSeguras && e.que === 'lesion' && !(e.parte && e.parte.lesion)));
  if (listos.length < eventos.length) log(`  (novedades) sin parte todavía, esperan: ${eventos.filter((e) => !listos.includes(e)).map((e) => e.nombre).join(', ')}`);
  eventos.length = 0; eventos.push(...listos);
  if (!eventos.length) return [];
  log(`  (novedades) ${eventos.length} pendientes: ${eventos.map((e) => `${e.nombre} ${e.antes}→${e.que}`).join(', ')}`);
  eventos.sort((a, b) => b.media - a.media);
  for (const e of eventos) e.pp = await proximo(e.teamId, { stats, semana, jornada }).catch(() => null);
  const dia = diaMadrid(ahora);
  const out = [];

  // Uno solo: un tweet con la noticia arriba, el detalle por su puesto y la etiqueta final con la jornada y el rival (formato Carrasco)
  // con tweets largos (X Premium): cuándo es el partido, el motivo de todos y la media de todos (lib/agrupar.mjs)
  const L = largo();
  const hora = (pp) => { const c = L && pp && pp.fecha ? cuando(pp.fecha, ahora) : null; return c ? { t: `🗓️ El partido es ${c.t}`, numeros: c.numeros } : null; };
  // las novedades de uno salen a lo largo del día: cada forma rota por cuántas llevamos hoy (las del registro y las de esta vuelta),
  // para que dos seguidas no se lean calcadas cambiando el nombre (Carlos, 4 nov). Las etiquetas del final no cambian (guía de estilo)
  let vez = registro && registro.todos ? registro.todos().filter((x) => x && x.tipo === 'novedades' && x.t && diaMadrid(Date.parse(x.t)) === dia).length : 0;
  // el % de titularidad y el rival (lib/info-jugador.mjs) rotan con los de noticias: por cuántos tweets de un jugador van hoy
  let vezInfo = vecesHoy(registro, dia);
  const solo = async (e) => {
    const k = vez++, kI = vezInfo++;
    const R = (fs, slot) => rotar(fs, `nov${slot}${dia}`, k);
    const quien = `${cap(segunda(e.pos, e.nombre))} ${del(e.equipo)}`;
    const d = diaMadrid(e.desde);
    const p = e.parte;
    const mediaT = e.media >= 3 ? { t: R([`‼️ ${quien} suma ${fmt(e.media)} puntos de media`, `‼️ Es de los que pesan en ${el(e.equipo)}: ${fmt(e.media)} puntos de media`, `‼️ En ${el(e.equipo)} va a ${fmt(e.media)} puntos por partido`], 'media'), prio: 5 } : null;
    let cab, ideas;
    if (e.que === 'lesion') {
      const dudaWeb = p && p.estado === 'duda';
      const venta = ventaObligatoria(p, ahora);
      cab = R([`🚨 ${e.nombre} se cae por lesión`, `🚨 Saltan las alarmas con ${e.nombre}`, `🚨 Lesión de ${e.nombre}`], 'cabL');
      ideas = [p && p.lesion ? { t: `⚠️ ${cap(lesionTxt(p))}${desdeTxt(p) ? ` ${desdeTxt(p)}` : ''}`, prio: 9 } : null,
        p && p.estado === 'baja' && p.hasta ? { t: R([`🗓️ No se le espera hasta ${p.hasta}`, `🗓️ Estará fuera hasta ${p.hasta}`], 'hasta'), prio: venta ? 9 : 7 } : dudaWeb ? { t: R(['⁉️ De momento no está descartado', '⁉️ Aún no está descartado del todo'], 'desc'), prio: 7 } : null,
        mediaT, { t: venta ? '💸 Venta obligatoria' : `${dudaWeb ? '⁉️ Duda' : '❌ Baja'} ${paraLa(e.pp, null)}`, prio: 9 }];
    } else if (e.que === 'sancion') {
      // (la cabecera y «se pierde» van atadas: «no podrá jugar por sanción. No estará contra…» decía lo mismo dos veces)
      const fS = turno(2, `novcabS${dia}`, k);
      cab = [`🟥 ${e.nombre}, sancionado`, `🟥 ${e.nombre} no podrá jugar por sanción`][fS];
      ideas = [e.motivoSan ? { t: `⚠️ ${e.motivoSan.txt}`, prio: 9 } : null,
        { t: e.pp ? (fS === 1 ? `❌ Se pierde el partido contra ${el(e.pp.rival)}` : `❌ No estará contra ${el(e.pp.rival)}`) : '❌ Se pierde el próximo partido', prio: 8 },
        mediaT, { t: `❌ Baja ${paraLa(e.pp, null)}`, prio: 9 }];
    } else {
      // vuelve: la lesión de la que viene, si está en la lista («Deja atrás la lesión en el sóleo»)
      // solo si es una lesión de verdad («trabajo al margen» o «descanso» no se dejan atrás)
      const les = p && p.lesion && /(lesi[oó]n|rotura|molestia|sobrecarga|contusi[oó]n|esguince|fractura|elongaci[oó]n|tendinitis|luxaci[oó]n|distensi[oó]n|edema|fascitis|pubalgia|golpe|problema|dolencia|tobillo|rodilla|isquio|gemelo|aductor|s[oó]leo|cu[aá]driceps|hombro|espalda)/i.test(p.lesion) ? lesionTxt(p) : '';
      const art = /^(lesi[oó]n|rotura|sobrecarga|contusi[oó]n|elongaci[oó]n|tendinitis|fractura|fascitis|distensi[oó]n|luxaci[oó]n|pubalgia)/.test(les) ? 'la ' : /^(golpe|esguince|edema|problema)/.test(les) ? 'el ' : '';
      const tras = les ? ` deja atrás ${art}${les}` : e.antes === 'injured' ? ' ya está recuperado' : e.antes === 'suspended' ? ' ya ha cumplido la sanción' : ' deja de estar en duda';
      // (Carlos, 5 nov 17:42: frases más largas) de dónde viene, en la misma frase que la noticia («Buenas noticias: vuelve Natan, que ya
      // está recuperado»); la media, el % y el partido, en las frases de lib/info-jugador.mjs
      const fC = turno(3, `novcabV${dia}`, k);
      cab = fC === 2 ? `✅ Buenas noticias: vuelve ${e.nombre}, que${tras}` : `${[`✅ ${e.nombre} vuelve a estar disponible`, `✅ ${e.nombre}, de nuevo disponible`][fC]}:${tras}`;
      ideas = [{ t: `✅ Disponible ${paraLa(e.pp, null)}`, prio: 9 }];
    }
    const clave = `novedades|${e.id}:${e.que}|${d}`;
    // (Carlos, 5 nov 13:33) el que vuelve: si pinta a titular y lo difícil que es el rival (solo si el tweet puede salir: se piden datos)
    const conInfo = info && e.que === 'vuelve' && e.pp && (!registro || !registro.decidir || registro.decidir({ tipo: 'novedades', clave, jornada }) === 'ok');
    let extra = { numeros: [] }, titH = null, rivH = null;
    const hr = hora(e.pp);
    if (e.que === 'vuelve') {
      const j = porId.get(String(e.id));
      const tit = conInfo ? await info.titularidad(j, e.pp).catch(() => null) : null, riv = conInfo ? await info.rival(e.pp).catch(() => null) : null;
      titH = tit; rivH = riv;
      if (conInfo) e.pct = tit ? tit.pct : null;   // (5 nov 16:39) también en la carta
      extra = ideasInfo({ posId: e.pos, equipo: e.equipo, pp: e.pp, quien, media: e.media, tit, riv, tipo: 'vuelve', hr: L && e.pp && e.pp.fecha ? cuando(e.pp.fecha, ahora) : null, k: kI, dia, largo: L });
      ideas.splice(ideas.length - 1, 0, ...extra.ideas);
    } else if (hr) ideas.splice(ideas.length - 1, 0, { t: hr.t, prio: 2 });
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) return null;
    // los hechos para la IA que redacta (lib/redaccion.mjs)
    const etiquetaH = ideas[ideas.length - 1].t;
    const estadoH = e.que === 'lesion' ? (p && p.estado === 'duda' ? 'duda' : 'lesionado') : e.que === 'sancion' ? 'sancionado' : 'disponible';
    const jH = porId.get(String(e.id));
    const hechos = { tipo: 'novedades', noticia: e.que === 'vuelve' ? `LaLiga Fantasy le cambia el estado a disponible: ${e.antes === 'injured' ? 'estaba lesionado' : e.antes === 'suspended' ? 'estaba sancionado' : 'estaba en duda'}`
      : e.que === 'lesion' ? `LaLiga Fantasy le pone como ${estadoH === 'duda' ? 'duda' : 'lesionado'}` : 'LaLiga Fantasy le pone como sancionado',
      jugadores: [jugadorH(jH, { equipos, estado: estadoH, tit: titH,
        motivo: e.que === 'sancion' ? (e.motivoSan ? e.motivoSan.txt : '') : p && p.lesion ? `${lesionTxt(p)}${desdeTxt(p) ? ` ${desdeTxt(p)}` : ''}` : '',
        plazo: e.que === 'lesion' && p && p.estado === 'baja' && p.hasta ? `no se le espera hasta ${p.hasta}` : '',
        extra: e.que === 'lesion' && ventaObligatoria(p, ahora) ? { aviso: 'tanto tiempo fuera que es venta obligatoria' } : {} })],
      ...(e.pp ? { partido: partidoH(e.pp, { equipo: e.equipo, riv: rivH, posId: e.pos, ahora }) } : {}), clubes: clubesH(e.equipo, e.pp && e.pp.rival), etiqueta: etiquetaH };
    return { tipo: 'novedades', clave, jornada, texto, hechos, numeros: [...(e.media >= 3 ? partes(e.media) : []), ...(e.pp ? [e.pp.jornada] : []), ...numerosDe(p), ...(e.motivoSan ? e.motivoSan.numeros : []), ...(e.que === 'vuelve' ? extra.numeros : hr ? hr.numeros : [])], tarjeta: tarjetaBajas({ jornada, filas: [e], pp: e.pp, clave }) };
  };

  // Varios: agrupados por lo que pasa, con una cabecera que ya cuenta la noticia y la media solo del que más pesa (Carlos, 3 nov 12:06)
  const varios = (xs, k, conMotivo = true, conClubes = true) => {
    const buenos = xs.filter((e) => e.que === 'vuelve'), malos = xs.filter((e) => e.que !== 'vuelve');
    const clubes = [...new Set(xs.map((e) => e.equipo))];
    const mismo = clubes.length === 1, n = xs.length, sem = `nov${dia}${k}`;
    let cab;
    if (mismo) cab = !malos.length ? `🚨 Buenas noticias en ${el(clubes[0])}` : !buenos.length ? `🚨 Malas noticias en ${el(clubes[0])}` : `🚨 Buenas y malas noticias en ${el(clubes[0])}`;
    else if (!malos.length) cab = elegir([`✅ ${mayus(enLetra(n))} jugadores vuelven a estar disponibles`, `✅ Buenas noticias: vuelven ${enLetra(n)} jugadores`], sem);
    else if (!buenos.length) cab = elegir([`🚨 ${mayus(enLetra(n))} bajas nuevas`, `🚨 Saltan las alarmas: ${enLetra(n)} bajas nuevas`], sem);
    else if (malos.length === 1) {
      // «🚨 Vuelven tres y Lemar se lesiona»: la cabecera ya cuenta la noticia y abajo va por su puesto («El centrocampista del Elche…»)
      const m = malos[0];
      cab = `🚨 ${buenos.length === 1 ? `Vuelve ${buenos[0].nombre}` : `Vuelven ${enLetra(buenos.length)}`} y ${m.nombre} ${m.que === 'lesion' ? 'se lesiona' : 'cae sancionado'}`;
    } else cab = malos.every((e) => e.que === 'lesion') ? elegir(['🚨 Movimiento en la enfermería', '🚨 Buenas y malas noticias'], sem) : '🚨 Buenas y malas noticias';
    let lineas;
    if (!mismo && buenos.length && malos.length === 1) {
      const m = malos[0];
      const quien = `${cap(segunda(m.pos, m.nombre))} ${del(m.equipo)}`;
      const que = m.que === 'lesion' ? (m.pp ? `en principio no estará contra ${el(m.pp.rival)}` : 'en principio se pierde el próximo partido') : (m.pp ? `se pierde el partido contra ${el(m.pp.rival)}` : 'se pierde el próximo partido');
      // con el motivo delante: «❌ El centrocampista del Elche, rotura fibrilar en el aductor: en principio no estará contra el Girona»
      const por = !conMotivo ? '' : m.que === 'lesion' && m.parte && m.parte.lesion ? `, ${lesionTxt(m.parte)}:` : m.motivoSan ? `, ${m.motivoSan.txt.replace(/^./, (c) => c.toLowerCase())}:` : '';
      lineas = [...lineasPorEstado(buenos, { club: !conClubes, ya: buenos.length > 1 }), `${m.que === 'lesion' ? '❌' : '🟥'} ${quien}${por} ${que}`];
    } else if (buenos.length && malos.length) lineas = [...lineasPorEstado(buenos, { club: mismo }), ...lineasPorEstado(malos, { club: mismo })];
    else lineas = lineasPorEstado(xs, { club: mismo });
    const top = L ? (() => { const r = pesos(xs, `${dia}${k}`, { bajas: !buenos.length }); return r && { ...r, t: aparte(r.t) }; })() : elQueMasPesa(xs);
    const pps = xs.map((e) => e.pp).filter(Boolean);
    const J = pps.length ? Math.min(...pps.map((p) => p.jornada)) : jornada;
    const para = mismo && xs[0].pp ? paraLa(xs[0].pp, J) : `para la jornada ${J}`;
    const etiqueta = !buenos.length ? `❌ Bajas ${para}` : !malos.length ? `✅ Disponibles ${para}` : `👀 Novedades ${para}`;
    const det = buenos.length && malos.length === 1 && !mismo ? null : L ? detalles(xs, 3, `${dia}${k}`) : detalle(xs);   // en el caso de arriba el motivo ya va en su línea
    const { usadas, texto } = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), det && { t: det.t, prio: 6 }, top && { t: top.t, prio: 4 }, { t: etiqueta, prio: 8 }]);
    if (![...lineas, etiqueta].every((l) => usadas.includes(l))) return null;   // la etiqueta tiene que caber: si no, van menos
    const clave = `novedades|${xs.map((e) => `${e.id}:${e.que}`).join(',')}|${dia}`;
    const hechos = { tipo: 'novedades', noticia: 'cambios de estado en LaLiga Fantasy de varios jugadores',
      jugadores: xs.map((e) => jugadorH(porId.get(String(e.id)), { equipos, principal: true,
        estado: e.que === 'lesion' ? (e.parte && e.parte.estado === 'duda' ? 'duda' : 'lesionado') : e.que === 'sancion' ? 'sancionado' : 'disponible',
        motivo: e.que === 'sancion' ? (e.motivoSan ? e.motivoSan.txt : '') : e.que === 'lesion' && e.parte && e.parte.lesion ? lesionTxt(e.parte) : '',
        extra: e.pp ? { proximoRival: el(e.pp.rival) } : {} })),
      clubes: clubesH(xs.map((e) => e.equipo), xs.map((e) => e.pp && e.pp.rival)), etiqueta };
    return { tipo: 'novedades', clave, jornada, texto, hechos, numeros: [J, ...pps.map((p) => p.jornada), ...(top ? top.numeros : []), ...(det ? det.numeros : []), ...malos.flatMap((m) => [...numerosDe(m.parte), ...(m.motivoSan ? m.motivoSan.numeros : [])])],
      // buenas y malas noticias juntas: dos tarjetas, la verde con los que vuelven y la de bajas con el resto (Carlos, 5 nov 07:08)
      tarjeta: tarjetasNovedades({ jornada, filas: xs, clave, ppDe: (fs) => (fs.every((e) => e.equipo === fs[0].equipo) ? fs[0].pp : null) }) };
  };

  if (eventos.length === 1) { const t = await solo(eventos[0]); return t ? [t] : []; }
  let i = 0, k = 0;
  while (i < eventos.length && out.length < 4) {
    const resto = eventos.slice(i, i + 5);
    let n = resto.length, t = null;
    for (; n >= 2 && !t; n--) { const ys = resto.slice(0, n); t = varios(ys, k) || varios(ys, k, true, false) || varios(ys, k, false); }   // si no cabe: el motivo sin los clubes de los que vuelven y, si aún no, sin motivo, antes que partirlo
    if (t) n++;
    else { n = 1; t = await solo(resto[0]); }
    if (t) out.push(t);
    i += n; k++;
  }
  return out;
}
