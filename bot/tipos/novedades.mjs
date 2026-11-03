// Novedades de jugadores entre semana (Carlos, 2 nov 23:28): cambios de estado en LaLiga Fantasy de los jugadores que importan
// (media de 4 o más, o 10 M o más de valor): pasa a lesionado, sancionado, o vuelve a estar disponible. Las dudas no salen solas
// (una duda necesita una segunda fuente, regla de Carlos). Compara con el estado guardado en el registro (`estados`, en la rama
// bot-estado); la primera vez solo lo guarda. Fuera de horario (9 a 23 h) no mira nada, así los cambios se acumulan para el día.
import { corto, fmt, partes, elegir, el, del } from '../lib/texto.mjs';
import { tweet, cap, segunda, proximoPartido, paraLa } from '../lib/redactar.mjs';
import { tarjetaBajas } from '../lib/datos-tarjetas.mjs';
import { lineasPorEstado, elQueMasPesa, enLetra, mayus } from '../lib/agrupar.mjs';

const IMPORTA = (j) => Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
const ESTADO_DE = { lesion: 'injured', sancion: 'suspended', vuelve: 'ok' };
const HORA = 36e5;

export async function generar({ jugadores, equipos, jornada, stats = null, semana = null, config = {}, registro = null, ventanas = true, forzar = false, previos = null, ahora = Date.now(), log = console.log, proximo = proximoPartido }) {
  const [hD, hH] = config.horasNovedades || [9, 23];
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
  const yaSalio = (p) => cub.some((c) => c.tipo === 'novedades' && String(c.id) === String(p.id) && c.que === p.que && c.t >= p.t - 72 * HORA);
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
  log(`  (novedades) ${eventos.length} pendientes: ${eventos.map((e) => `${e.nombre} ${e.antes}→${e.que}`).join(', ')}`);
  eventos.sort((a, b) => b.media - a.media);
  for (const e of eventos) e.pp = await proximo(e.teamId, { stats, semana, jornada }).catch(() => null);
  const dia = diaMadrid(ahora);
  const out = [];

  // Uno solo: un tweet con la noticia arriba, el detalle por su puesto y la etiqueta final con la jornada y el rival (formato Carrasco)
  const solo = (e) => {
    const media = e.media >= 3 ? `, con ${fmt(e.media)} puntos de media` : '';
    const quien = `${cap(segunda(e.pos, e.nombre))} ${del(e.equipo)}`;
    const d = diaMadrid(e.desde);
    let cab, ideas;
    if (e.que === 'lesion') {
      cab = elegir([`🚨 ${e.nombre} aparece como lesionado en LaLiga Fantasy`, `🚨 Saltan las alarmas con ${e.nombre}: lesionado en LaLiga Fantasy`], `nl${e.id}${d}`);
      ideas = [e.media >= 3 ? { t: `⚠️ ${quien} suma ${fmt(e.media)} puntos de media`, prio: 6 } : null, { t: `❌ En principio, baja ${paraLa(e.pp, null)}`, prio: 9 }];
    } else if (e.que === 'sancion') {
      cab = `🚨 ${e.nombre} aparece como sancionado en LaLiga Fantasy`;
      ideas = [{ t: `⚠️ ${quien} se pierde el próximo partido${e.media >= 3 ? ` y suma ${fmt(e.media)} puntos de media` : ''}`, prio: 6 }, { t: `❌ Baja confirmada ${paraLa(e.pp, null)}`, prio: 9 }];
    } else {
      const tras = e.antes === 'injured' ? ' ya está recuperado' : e.antes === 'suspended' ? ' ya ha cumplido la sanción' : ' deja de estar en duda';
      cab = `✅ ${e.nombre} vuelve a estar disponible en LaLiga Fantasy`;
      ideas = [{ t: `‼️ ${quien}${tras}${media}`, prio: 6 }, { t: `✅ Disponible ${paraLa(e.pp, null)}`, prio: 9 }];
    }
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) return null;
    const clave = `novedades|${e.id}:${e.que}|${d}`;
    return { tipo: 'novedades', clave, jornada, texto, numeros: [...(e.media >= 3 ? partes(e.media) : []), ...(e.pp ? [e.pp.jornada] : [])], tarjeta: tarjetaBajas({ jornada, filas: [e], pp: e.pp, clave }) };
  };

  // Varios: agrupados por lo que pasa, con una cabecera que ya cuenta la noticia y la media solo del que más pesa (Carlos, 3 nov 12:06)
  const varios = (xs, k) => {
    const buenos = xs.filter((e) => e.que === 'vuelve'), malos = xs.filter((e) => e.que !== 'vuelve');
    const clubes = [...new Set(xs.map((e) => e.equipo))];
    const mismo = clubes.length === 1, n = xs.length, sem = `nov${dia}${k}`;
    let cab;
    if (mismo) cab = !malos.length ? `🚨 Buenas noticias en ${el(clubes[0])}` : !buenos.length ? `🚨 Malas noticias en ${el(clubes[0])}` : `🚨 Buenas y malas noticias en ${el(clubes[0])}`;
    else if (!malos.length) cab = elegir([`🚨 ${mayus(enLetra(n))} jugadores vuelven a estar disponibles en LaLiga Fantasy`, `✅ Buenas noticias en LaLiga Fantasy: vuelven ${enLetra(n)} jugadores`], sem);
    else if (!buenos.length) cab = elegir([`🚨 ${mayus(enLetra(n))} bajas nuevas en LaLiga Fantasy`, `🚨 Saltan las alarmas en LaLiga Fantasy: ${enLetra(n)} bajas nuevas`], sem);
    else if (malos.length === 1) {
      // «🚨 Vuelven tres y Lemar se lesiona»: la cabecera ya cuenta la noticia y abajo va por su puesto («El centrocampista del Elche…»)
      const m = malos[0];
      cab = `🚨 ${buenos.length === 1 ? `Vuelve ${buenos[0].nombre}` : `Vuelven ${enLetra(buenos.length)}`} y ${m.nombre} ${m.que === 'lesion' ? 'se lesiona' : 'cae sancionado'}`;
    } else cab = malos.every((e) => e.que === 'lesion') ? elegir(['🚨 Movimiento en la enfermería de LaLiga Fantasy', '🚨 Buenas y malas noticias en LaLiga Fantasy'], sem) : '🚨 Buenas y malas noticias en LaLiga Fantasy';
    let lineas;
    if (!mismo && buenos.length && malos.length === 1) {
      const m = malos[0];
      const quien = `${cap(segunda(m.pos, m.nombre))} ${del(m.equipo)}`;
      const que = m.que === 'lesion' ? (m.pp ? `en principio no estará contra ${el(m.pp.rival)}` : 'en principio se pierde el próximo partido') : (m.pp ? `se pierde el partido contra ${el(m.pp.rival)}` : 'se pierde el próximo partido');
      lineas = [...lineasPorEstado(buenos, { club: false, ya: buenos.length > 1 }), `${m.que === 'lesion' ? '❌' : '🟥'} ${quien} ${que}`];
    } else if (buenos.length && malos.length) lineas = [...lineasPorEstado(buenos, { club: mismo }), ...lineasPorEstado(malos, { club: mismo })];
    else lineas = lineasPorEstado(xs, { club: mismo });
    const top = elQueMasPesa(xs);
    const pps = xs.map((e) => e.pp).filter(Boolean);
    const J = pps.length ? Math.min(...pps.map((p) => p.jornada)) : jornada;
    const para = mismo && xs[0].pp ? paraLa(xs[0].pp, J) : `para la jornada ${J}`;
    const etiqueta = !buenos.length ? `❌ Bajas Fantasy ${para}` : !malos.length ? `✅ Disponibles en LaLiga Fantasy ${para}` : `👀 Revisa tu once Fantasy ${para}`;
    const { usadas, texto } = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), top && { t: top.t, prio: 4 }, { t: etiqueta, prio: 8 }]);
    if (!lineas.every((l) => usadas.includes(l))) return null;
    const clave = `novedades|${xs.map((e) => `${e.id}:${e.que}`).join(',')}|${dia}`;
    return { tipo: 'novedades', clave, jornada, texto, numeros: [J, ...pps.map((p) => p.jornada), ...(top ? top.numeros : [])],
      tarjeta: tarjetaBajas({ jornada, filas: xs, pp: mismo ? xs[0].pp : null, clave }) };
  };

  if (eventos.length === 1) { const t = solo(eventos[0]); return t ? [t] : []; }
  let i = 0, k = 0;
  while (i < eventos.length && out.length < 4) {
    const resto = eventos.slice(i, i + 5);
    let n = resto.length, t = null;
    for (; n >= 2 && !t; n--) t = varios(resto.slice(0, n), k);
    if (t) n++;
    else { n = 1; t = solo(resto[0]); }
    if (t) out.push(t);
    i += n; k++;
  }
  return out;
}
