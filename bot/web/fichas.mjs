// Fase 2 del portal de datos: una página por cada uno de los 20 equipos (equipos/<club>.html), una por cada jugador de los que más
// pesan en el juego (jugadores/<nombre>.html, ~150) y el índice de jugadores (jugadores/). Todo con la API de LaLiga Fantasy sin token:
// la lista de jugadores (puntos de cada jornada), el histórico de valor (ya bajado para /mercado/ en `hechosMercado`), stats/week de
// cada jornada (resultados, clasificación y calendario) y la ficha de cada jugador (minutos, goles, paradas…). Nada de la liga de
// nadie. El texto sale de reglas sobre los datos, sin IA, con las cifras medidas de las guías (.github/datos-guias).
import { enParalelo } from '../lib/http.mjs';
import { ESTADOS } from '../lib/laliga.mjs';
import { tablaDe, nivelDe } from '../lib/info-jugador.mjs';
import { baseTitular } from '../tipos/caidas.mjs';
import { motivoSancion } from '../lib/partes.mjs';
import { corto, el, del, al } from '../lib/texto.mjs';
import { fechaHora } from './vista.mjs';
import { e, coma, dinero, dif, pct, cara, escudo, chipPuntos, cambio, graficaValor, filaJugador, bloque, lista, tarjetas, slug, diaMadrid, fechaCorta, POS, PUESTO } from './portal.mjs';

const num = (x) => Number(x) || 0;
const CASA = 0.85, FUERA = 1.15;   // como bot/tipos/calendario.mjs: jugar fuera pesa más que en casa
const INICIO = Date.parse('2026-08-01');
const PLURAL = { 1: 'porteros', 2: 'defensas', 3: 'centrocampistas', 4: 'delanteros' };
const NIVEL = { 'fácil': 'facil', media: 'media', 'difícil': 'dificil' };

// lo que dicen los datos de la temporada (guías de alineación, porteros y valor de mercado; .github/datos-guias, 15 nov, J1-J12)
const TITULAR = { 1: 6.6, 2: 4.7, 3: 5.5, 4: 6.4 };          // puntos de media con 60 minutos o más, por puesto
const BANQUILLO = { 2: 1.7, 3: 2.4, 4: 2.8 };                 // de 31 a 59 minutos
const PORTERO_GOLES = [11.4, 6.3, 4.7, 2.2];                  // portero titular según los goles encajados (0, 1, 2, 3 o más)

// pesa en el fantasy (bot/tipos/sancionados.mjs): titular habitual, buena media o mucho valor
const pesa = (j, b) => (b && b.p >= 0.5) || num(j.averagePoints) >= 3 || num(j.marketValue) >= 8e6;

/** el valor de un jugador un día (el último conocido hasta ese día; antes del primero, el primero) */
function valorEn(serie, t) {
  let v = serie.length ? serie[0].v : 0;
  for (const x of serie) { if (x.t > t) break; v = x.v; }
  return v;
}

/** la URL de cada uno, estable: la primera vez que sale se apunta en el estado y ya no cambia (si dos se llaman igual, con el club) */
function asignar(mapa, id, base, extra) {
  if (mapa[id]) return mapa[id];
  const usados = new Set(Object.values(mapa));
  let s = slug(base) || `jugador-${id}`;
  if (usados.has(s)) s = slug(`${base} ${extra}`);
  if (usados.has(s)) s = `${s}-${id}`;
  mapa[id] = s;
  return s;
}

/**
 * Los hechos de las fichas. api: { jugadores, statsSemana, semanaActual, ficha }; hm: lo de `hechosMercado` (con `todas` y
 * `equipos`); estado: { jugadores: {id: slug}, equipos: {id: slug} } (lo que ya tiene página; se amplía aquí). max: cuántos
 * jugadores con ficha como mucho (los que ya tienen página se quedan siempre, mientras sigan en LaLiga).
 */
export async function hechosFichas(api, hm, { estado = {}, max = 150, ahora = Date.now(), log = () => {} } = {}) {
  const slugs = { jugadores: { ...(estado.jugadores || {}) }, equipos: { ...(estado.equipos || {}) } };
  const sem = await api.semanaActual();
  const W = sem.weekNumber;
  const nums = Array.from({ length: Math.min(38, W + 5) }, (_, i) => i + 1);
  const semanas = await enParalelo(nums, 4, (J) => api.statsSemana(J).catch(() => []));
  const partidos = [];
  semanas.forEach((st, i) => { if (Array.isArray(st)) for (const m of st) partidos.push({ ...m, J: nums[i] }); });
  const tabla = tablaDe(partidos);
  const ultimaJugada = Math.max(0, ...nums.filter((J, i) => Array.isArray(semanas[i]) && semanas[i].length && semanas[i].every((m) => m.matchState === 7)));
  if (!ultimaJugada || tabla.n < 10) { log(`  (fichas) sin jornadas jugadas o sin clasificación (${tabla.n} equipos)`); return null; }

  // por equipo: resultados de lo jugado y los próximos 4 partidos (los que no han empezado) con la dificultad de cada rival
  const res = {}, prox = {}, nombre = {}, escudoDe = {};
  for (const m of [...partidos].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    for (const [yo, otro, casa] of [[m.local, m.visitor, true], [m.visitor, m.local, false]]) {
      if (!yo || !otro || yo.id == null) continue;
      const id = String(yo.id), rid = String(otro.id);
      nombre[id] = yo.mainName; escudoDe[id] = yo.badgeColor || escudoDe[id];
      if (m.matchState === 7) {
        const gf = num(casa ? m.localScore : m.visitorScore), gc = num(casa ? m.visitorScore : m.localScore);
        (res[id] ||= []).push({ J: m.J, rivalId: rid, rival: corto(otro.mainName), escRival: otro.badgeColor, casa, gf, gc, r: gf > gc ? 'G' : gf === gc ? 'E' : 'P' });
      } else if (m.matchState === 1 && (prox[id] || []).length < 4) {
        const r = tabla.porId[rid];
        const fuerza = r && r.pj ? r.pts / r.pj / tabla.mediaPts : 1;
        (prox[id] ||= []).push({ J: m.J, t: Date.parse(m.date), rivalId: rid, rival: corto(otro.mainName), escRival: otro.badgeColor, casa, pos: r ? r.pos : null, nivel: nivelDe(r, tabla) || 'media', d: fuerza * (casa ? CASA : FUERA) });
      }
    }
  }
  for (const id of Object.keys(res)) res[id].sort((a, b) => a.J - b.J);
  const dificultad = Object.entries(prox).filter(([, ps]) => ps.length >= 2).map(([id, ps]) => ({ id, d: ps.reduce((s, p) => s + p.d, 0) / ps.length })).sort((a, b) => a.d - b.d);
  const puestoCal = Object.fromEntries(dificultad.map((x, i) => [x.id, i + 1]));

  // los jugadores: la fila del mercado (valor, rachas, serie) + la lista (puntos por jornada) + su ficha (minutos y demás)
  const todos = await api.jugadores();
  const lista0 = new Map(todos.map((j) => [String(j.id), j]));
  const filas = hm.todas.filter((f) => f.pos >= 1 && f.pos <= 4 && lista0.has(f.id));
  const conPuntos = filas.filter((f) => (lista0.get(f.id).weekPoints || []).length);
  log(`  (fichas) ${conPuntos.length} fichas de jugadores`);
  const fichas = await enParalelo(conPuntos, 8, (f) => api.ficha(f.id));
  const fichaDe = new Map(conPuntos.map((f, i) => [f.id, fichas[i] && !fichas[i].error && Array.isArray(fichas[i].playerStats) ? fichas[i] : null]));
  const sinFicha = conPuntos.filter((f) => !fichaDe.get(f.id)).length;
  if (sinFicha > conPuntos.length * 0.2) { log(`  (fichas) ${sinFicha} fichas sin bajar: lo dejo para la próxima`); return null; }

  const J = [];
  for (const f of filas) {
    const j = lista0.get(f.id), fi = fichaDe.get(f.id) || null;
    const v = (x, k) => num(x.stats && x.stats[k] && x.stats[k][0]);
    const puntosJ = new Map((j.weekPoints || []).map((w) => [num(w.weekNumber), num(w.points)]));
    const ps = fi ? fi.playerStats.filter((x) => x.stats).sort((a, b) => a.weekNumber - b.weekNumber) : [];
    const porJ = new Map(ps.map((x) => [num(x.weekNumber), x]));
    const rs = res[f.teamId] || [];
    const jornadas = rs.map((r) => {
      const x = porJ.get(r.J);
      return { ...r, min: x ? v(x, 'mins_played') : 0, pts: puntosJ.has(r.J) ? puntosJ.get(r.J) : (x ? num(x.totalPoints) : null), g: x ? v(x, 'goals') : 0, a: x ? v(x, 'goal_assist') : 0,
        am: x ? v(x, 'yellow_card') : 0, roja: x ? v(x, 'red_card') + v(x, 'second_yellow_card') : 0, par: x ? v(x, 'saves') : 0, enc: x ? v(x, 'goals_conceded') : 0 };
    });
    const jugados = jornadas.filter((x) => x.min > 0);
    const tit = jugados.filter((x) => x.min >= 60);
    const b = fi ? baseTitular(fi.playerStats, ultimaJugada) : null;
    J.push({ ...f, nombreCompleto: (fi && fi.name) || f.nombre, club: nombre[f.teamId] || f.equipo, fi: !!fi, jornadas, jugados: jugados.length, titular: tit.length,
      minutos: jugados.reduce((s, x) => s + x.min, 0), goles: jugados.reduce((s, x) => s + x.g, 0), asist: jugados.reduce((s, x) => s + x.a, 0),
      amarillas: jugados.reduce((s, x) => s + x.am, 0), rojas: jugados.reduce((s, x) => s + x.roja, 0), paradas: jugados.reduce((s, x) => s + x.par, 0),
      aCero: tit.filter((x) => x.enc === 0).length, mediaTit: tit.length ? tit.reduce((s, x) => s + num(x.pts), 0) / tit.length : null,
      ult5: jornadas.slice(-5), tit5: jornadas.slice(-5).filter((x) => x.min >= 60).length, b, pesa: pesa(j, b),
      motivo: f.estado === 'suspended' && fi ? motivoSancion(fi) : null, pctTit: b ? Math.round(b.p * 100) : null });
  }
  // el puesto de cada uno por media entre los de su puesto que han jugado 5 partidos o más
  for (const p of [1, 2, 3, 4]) {
    const xs = J.filter((x) => x.pos === p && x.jugados >= 5).sort((a, b) => b.media - a.media);
    xs.forEach((x, i) => { x.rangoMedia = i + 1; x.deRango = xs.length; });
  }

  // quién tiene página: los que ya la tenían (si siguen en LaLiga) y, hasta `max`, los que más pesan por valor
  const ya = J.filter((x) => slugs.jugadores[x.id]);
  const nuevos = J.filter((x) => !slugs.jugadores[x.id] && x.pesa && x.fi).sort((a, b) => b.valor - a.valor).slice(0, Math.max(0, max - ya.length));
  const conPagina = [...ya, ...nuevos].sort((a, b) => b.valor - a.valor);
  // con una inicial en el nombre del juego («F. de Jong», «Germán V.»), la URL va con el nombre completo: es lo que se busca
  const base = (x) => (/(^|\s)\p{L}\.(\s|$)/u.test(x.nombre) && x.nombreCompleto.split(/\s+/).length <= 4 ? x.nombreCompleto : x.nombre);
  for (const x of conPagina) x.slug = asignar(slugs.jugadores, x.id, base(x), x.equipo);
  const rutaJ = new Map(conPagina.map((x) => [x.id, `jugadores/${x.slug}.html`]));

  // los equipos
  const porEquipo = {};
  for (const x of J) (porEquipo[x.teamId] ||= []).push(x);
  const totalJ = {};
  for (const x of J) for (const r of x.jornadas) if (r.pts != null) totalJ[r.J] = (totalJ[r.J] || 0) + r.pts;
  const eqs = [];
  hm.equipos.forEach((q, i) => {
    const xs = (porEquipo[q.id] || []).sort((a, b) => a.pos - b.pos || b.puntos - a.puntos || b.valor - a.valor);
    if (!xs.length) return;
    const ptsJ = {};
    for (const x of xs) for (const r of x.jornadas) if (r.pts != null) ptsJ[r.J] = (ptsJ[r.J] || 0) + r.pts;
    // la evolución del valor de la plantilla de hoy (todos los de hm.todas de ese club, entrenador incluido)
    const del0 = hm.todas.filter((f) => f.teamId === q.id && f.temporada && f.temporada.length);
    const dias = [...new Set(del0.flatMap((f) => f.temporada.map((p) => diaMadrid(p.t))))].sort();
    const tDia = {};
    for (const f of del0) for (const p of f.temporada) tDia[diaMadrid(p.t)] = Math.max(tDia[diaMadrid(p.t)] || 0, p.t);
    const serie = dias.map((d) => ({ t: tDia[d], v: del0.reduce((s, f) => s + valorEn(f.temporada, tDia[d]), 0) }));
    const porteros = xs.filter((x) => x.pos === 1 && x.jugados > 0).sort((a, b) => b.minutos - a.minutos);
    const r = res[q.id] || [];
    eqs.push({ ...q, puestoValor: i + 1, tabla: tabla.porId[q.id] || null, resultados: r, proximos: prox[q.id] || [], puestoCal: puestoCal[q.id] || null,
      ptsJ: Object.entries(ptsJ).map(([k, p]) => [Number(k), p]).sort((a, b) => a[0] - b[0]), jugadores: xs, serie,
      aCero: r.filter((x) => x.gc === 0).length, paradas: porteros.reduce((s, x) => s + x.paradas, 0), portero: porteros[0] || null,
      bajas: xs.filter((x) => !x.ok && x.estado !== 'out_of_league'),
      entrenador: hm.todas.find((f) => f.teamId === q.id && f.pos === 5) || null });
  });
  for (const q of eqs) q.slug = asignar(slugs.equipos, q.id, q.nombre, q.club);
  for (const x of J) { const q = eqs.find((y) => y.id === x.teamId); x.equipoSlug = q ? q.slug : null; }
  const rutaE = new Map(eqs.map((q) => [q.id, `equipos/${q.slug}.html`]));
  const totales = eqs.map((q) => ({ id: q.id, pts: q.ptsJ.reduce((s, [, p]) => s + p, 0) })).sort((a, b) => b.pts - a.pts);
  totales.forEach((x, i) => { eqs.find((q) => q.id === x.id).puestoPuntos = i + 1; eqs.find((q) => q.id === x.id).puntosTotal = x.pts; });

  return {
    dia: hm.dia, generada: ahora, ultimaJugada, tabla, mediaJornada: Object.fromEntries(Object.entries(totalJ).map(([k, s]) => [k, s / eqs.length])),
    equipos: eqs, jugadores: conPagina, todos: J, slugs, nCalendario: dificultad.length,
    rutas: { jugador: (id) => rutaJ.get(String(id)) || null, equipo: (id) => rutaE.get(String(id)) || null },
  };
}

// ---------------------------------------------------------------- texto con reglas

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaDia = (d) => { const [, m, dd] = d.split('-').map(Number); return `${dd} de ${MESES[m - 1]}`; };
const enLetraA = (n) => ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco'][n] ?? String(n);
const ordinal = (n) => `${n}.º`;
const ordinalA = (n) => `${n}.ª`;
const partidosTxt = (n) => `${n} ${n === 1 ? 'partido' : 'partidos'}`;
const NIVEL_TXT = { 'fácil': 'un rival asequible', media: 'un rival de nivel medio', 'difícil': 'un rival difícil' };
/** «domingo 6 de diciembre a las 21:00» o, si LaLiga aún no ha puesto la hora (00:00 UTC), «domingo 6 de diciembre, hora por confirmar» */
export const cuando = (t) => { const d = new Date(t); return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? `${fechaHora(t).replace(/ a las .*$/, '')}, hora por confirmar` : fechaHora(t); };
const rivalTxt = (p) => `${p.casa ? 'recibe' : 'visita'} ${al(p.rival)}${p.pos ? ` (${p.pos}.º)` : ''}`;
const calTxt = (pc, n) => (!pc ? null : pc <= 5 ? 'de los más fáciles' : pc > n - 5 ? 'de los más difíciles' : 'normal');

function lecturaJugador(x, H, eq) {
  const o = [];
  const p = PUESTO[x.pos];
  const desde = x.temporada && x.temporada.length ? x.temporada[0] : null;
  const max = x.temporada && x.temporada.length ? x.temporada.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  o.push(`${x.nombreCompleto}${!x.nombreCompleto.includes(x.nombre.replace(/\.$/, '')) ? ` (${x.nombre} en el juego)` : ''}, ${p} ${del(x.equipo)}, vale ${dinero(x.valor)} en LaLiga Fantasy`
    + (desde ? `: empezó agosto en ${dinero(desde.v)} y ${x.valor >= desde.v ? 'ha ganado' : 'ha perdido'} ${dinero(Math.abs(x.valor - desde.v))} desde entonces` : '')
    + (max && max.v > x.valor * 1.02 && (!desde || max.t !== desde.t) ? `, y su máximo fue de ${dinero(max.v)} el ${fechaCorta(max.t)}` : max && max.v <= x.valor ? ', y hoy está en su máximo de la temporada' : '') + '.');
  if (x.jugados) {
    o.push(`Lleva ${x.puntos} puntos en ${x.jugados} ${x.jugados === 1 ? 'partido jugado' : 'partidos jugados'}, ${coma(x.media)} de media`
      + (x.rangoMedia ? `, la ${ordinalA(x.rangoMedia)} mejor media entre los ${x.deRango} ${PLURAL[x.pos]} con cinco partidos o más` : '') + '.');
    if (x.titular && x.mediaTit != null) {
      const ref = TITULAR[x.pos];
      const cuantas = x.titular === H.ultimaJugada ? `en las ${H.ultimaJugada} jornadas` : `en ${x.titular} de ${H.ultimaJugada} jornadas (${x.tit5 === 5 ? 'todas las últimas cinco' : `${enLetraA(x.tit5)} de las últimas cinco`})`;
      o.push(`Ha jugado 60 minutos o más ${cuantas}; cuando lo hace saca ${coma(x.mediaTit)} puntos, `
        + `${x.mediaTit >= ref * 1.15 ? 'bastante más que' : x.mediaTit <= ref * 0.85 ? 'menos que' : 'parecido a'} los ${coma(ref)} de un ${p} titular cualquiera esta temporada.`);
    } else if (x.jugados) o.push(`No ha llegado a los 60 minutos en ningún partido: casi todo lo suyo es desde el banquillo.`);
  } else o.push(`Todavía no ha jugado esta temporada.`);
  if (x.racha >= 3) o.push(`Lleva ${x.racha} días seguidos subiendo (${dif(x.rachaDif)}); esta temporada, de los que llevan tres días subiendo, el 87,3 % sube también el cuarto.`);
  else if (x.racha <= -3) o.push(`Lleva ${-x.racha} días seguidos bajando (${dif(x.rachaDif)}); tras tres días bajando, el 88,4 % baja también el cuarto.`);
  if (!x.ok && ESTADOS[x.estado]) o.push(`LaLiga lo da ahora como ${ESTADOS[x.estado]}${x.motivo ? ` (${x.motivo.txt.charAt(0).toLowerCase() + x.motivo.txt.slice(1)})` : ''}.`);
  const px = eq && eq.proximos[0];
  if (px) o.push(`Su próximo partido es en la jornada ${px.J}, ${px.casa ? 'en casa' : 'fuera'} contra ${el(px.rival)}${px.pos ? `, ${px.pos}.º de la tabla` : ''}: ${NIVEL_TXT[px.nivel] || 'un rival de nivel medio'}.`);
  return o;
}

function lecturaEquipo(q, H) {
  const o = [];
  const t = q.tabla;
  if (t) o.push(`${q.club} va ${ordinal(t.pos)} en LaLiga con ${t.pts} puntos en ${t.pj} partidos (${t.gf} goles a favor y ${t.gc} en contra).`);
  o.push(`En LaLiga Fantasy su plantilla vale ${dinero(q.valor)}, la ${ordinalA(q.puestoValor)} más cara de las ${H.equipos.length}, y en la última semana ${q.dif7 >= 0 ? 'ha ganado' : 'ha perdido'} ${dinero(Math.abs(q.dif7))}.`);
  const mejor = [...q.jugadores].sort((a, b) => b.puntos - a.puntos)[0];
  const mj = [...q.ptsJ].sort((a, b) => b[1] - a[1])[0];
  if (mejor) o.push(`Sus jugadores suman ${q.puntosTotal} puntos fantasy esta temporada (${ordinal(q.puestoPuntos)} de ${H.equipos.length}); el que más, ${mejor.nombre}, con ${mejor.puntos}${mj ? `. Su mejor jornada fue la ${mj[0]}, con ${mj[1]} puntos entre todos` : ''}.`);
  const c = calTxt(q.puestoCal, H.nCalendario);
  if (q.proximos.length >= 2 && c) o.push(`Su calendario de las próximas ${q.proximos.length} jornadas es ${c} (${ordinal(q.puestoCal)} más fácil de ${H.nCalendario}): ${q.proximos.map(rivalTxt).join(', ')}.`);
  return o;
}

// ---------------------------------------------------------------- el HTML

/** las fichas de las jornadas, con la forma de las de la app: [{ J, pts (null si no jugó), abajo, icono, titulo, clase }] */
function fichasJornada(xs) {
  const nivel = (p) => (p >= 10 ? 'top' : p >= 6 ? 'bien' : p >= 2 ? 'medio' : 'mal');
  return `  <div class="jt-fila">${xs.map((x) => `<div class="jt ${x.pts == null ? 'nada' : x.clase || nivel(x.pts)}" title="${e(x.titulo)}">${x.icono ? `<i class="gol" aria-hidden="true">${x.icono}</i>` : ''}`
    + `<span class="jt-n">J${x.J}</span><b>${x.pts == null ? '–' : x.pts}</b>${x.pts == null ? '<small class="nj">no<br>jugó</small>' : `<small>${e(x.abajo || '')}</small>`}</div>`).join('')}</div>`;
}

/** el texto de arriba: las primeras `k` frases en grande y el resto en párrafos de dos frases */
function parrafos(fr, k) {
  const o = [`  <p class="lead">${e(fr.slice(0, k).join(' '))}</p>`];
  for (let i = k; i < fr.length; i += 2) o.push(`  <p>${e(fr.slice(i, i + 2).join(' '))}</p>`);
  return o.join('\n');
}

/** los puntos de un equipo en una jornada frente a la media de los 20 esa jornada (los mismos colores que los de un jugador) */
const claseEquipo = (p, m) => (p >= m * 1.2 ? 'p10' : p >= m ? 'p6' : p >= m * 0.8 ? 'p2' : 'p1');
const nivelChip = (n) => `<span class="niv niv-${NIVEL[n] || 'media'}">${e(n)}</span>`;
const resChip = (r) => `<span class="res-c res-${r.r}" title="${r.r === 'G' ? 'Ganó' : r.r === 'E' ? 'Empate' : 'Perdió'}">${r.r === 'G' ? 'G' : r.r === 'E' ? 'E' : 'P'}</span>`;

function proximosHtml(q, raiz) {
  if (!q.proximos.length) return '';
  const filas = q.proximos.map((p) => `<li class="fe">${escudo(p.escRival, p.rival, 28)}<b>${e(p.casa ? `${q.nombre} - ${p.rival}` : `${p.rival} - ${q.nombre}`)}<small class="sub">Jornada ${p.J} · ${e(cuando(p.t))}</small></b><span class="fe-d">${p.pos ? `<small>${p.pos}.º</small>` : ''}${nivelChip(p.nivel)}</span></li>`);
  return `  <ul class="le">${filas.join('')}</ul>`;
}

/** equipos/<club>.html */
export function contenidoEquipo(q, H) {
  const raiz = '../';
  const rj = (x) => (H.rutas.jugador(x.id) ? `${raiz}${H.rutas.jugador(x.id)}` : null);
  const o = [];
  o.push(`  <div class="ficha-cab">${escudo(q.escudoUrl, q.nombre, 72)}<div><h1>${e(q.nombre)} <span>en LaLiga Fantasy</span></h1><p class="peq">${e(q.club)}${q.entrenador ? ` · Entrenador: ${e(q.entrenador.nombre)}` : ''}</p></div></div>`);
  o.push(parrafos(lecturaEquipo(q, H), 2));
  o.push(`  <p class="peq">Datos del ${e(fechaDia(H.dia))}, con lo jugado hasta la jornada ${H.ultimaJugada}. Se rehace sola cada noche.</p>`);
  const t = q.tabla;
  o.push(tarjetas([
    `<div class="cifra-c"><b>${e(dinero(q.valor))}</b><span>vale la plantilla (${ordinalA(q.puestoValor)} más cara)</span></div>`,
    `<div class="cifra-c"><b>${t ? ordinal(t.pos) : '—'}</b><span>en LaLiga${t ? `, ${t.pts} puntos` : ''}</span></div>`,
    `<div class="cifra-c"><b>${q.puntosTotal}</b><span>puntos fantasy de sus jugadores</span></div>`,
    `<div class="cifra-c"><b>${q.aCero}</b><span>porterías a cero en ${q.resultados.length} partidos</span></div>`,
  ], 'cifras'));

  if (q.proximos.length) o.push(bloque(`Próximos rivales`, proximosHtml(q, raiz),
    { id: 'calendario', linea: e(`La dificultad sale de los puntos por partido de cada rival frente a la media de la liga, y pesa más jugar fuera que en casa.${q.puestoCal ? ` Con esa cuenta, el ${ordinal(q.puestoCal)} calendario más fácil de los ${H.nCalendario} para las próximas jornadas.` : ''}`) }));

  // la plantilla por puestos
  const plant = [1, 2, 3, 4].map((p) => {
    const xs = q.jugadores.filter((x) => x.pos === p).sort((a, b) => b.puntos - a.puntos || b.valor - a.valor);
    if (!xs.length) return '';
    return `<div><h3>${e(PLURAL[p].charAt(0).toUpperCase() + PLURAL[p].slice(1))}</h3>${lista(xs.map((x) => filaJugador(x, `<span class="fj-n">${e(dinero(x.valor))}<small>${x.puntos} pts · media ${e(coma(x.media))}</small></span>`,
      { enlace: rj(x), sub: `${POS[x.pos]}${x.jugados ? ` · ${partidosTxt(x.jugados)}` : ' · sin jugar'}${!x.ok && ESTADOS[x.estado] ? ` · ${ESTADOS[x.estado]}` : ''}` })))}</div>`;
  }).filter(Boolean);
  o.push(bloque('La plantilla', `  <div class="dos">${plant.join('')}</div>`, { id: 'plantilla', linea: 'Valor de hoy en el mercado, puntos de la temporada y media por partido jugado. Los que tienen ficha propia van enlazados.' }));

  if (q.serie.length > 10) {
    const a = q.serie[0], z = q.serie[q.serie.length - 1];
    o.push(bloque('El valor de la plantilla', `  ${graficaValor(q.serie, { fecha: fechaCorta })}`,
      { linea: e(`La suma del valor de los jugadores que tiene hoy, día a día desde el ${fechaCorta(a.t)}: de ${dinero(a.v)} a ${dinero(z.v)} (${dif(z.v - a.v)}).`) }));
  }

  if (q.ptsJ.length) {
    const media = H.mediaJornada;
    const encima = q.ptsJ.filter(([j, p]) => p > media[j]).length;
    const resJ = new Map(q.resultados.map((r) => [r.J, r]));
    const nivelEq = { p10: 'top', p6: 'bien', p2: 'medio', p1: 'mal' };
    o.push(bloque('Puntos fantasy por jornada', fichasJornada(q.ptsJ.map(([j, p]) => { const r = resJ.get(j); return { J: j, pts: p, clase: nivelEq[claseEquipo(p, media[j])],
      abajo: r ? `${r.r} ${r.gf}-${r.gc}` : '', titulo: `J${j}: ${p} puntos entre todos${r ? ` · ${r.casa ? 'en casa' : 'fuera'} contra ${el(r.rival)}, ${r.gf}-${r.gc}` : ''}` }; })),
      { linea: e(`Lo que suman todos sus jugadores cada jornada, y debajo el resultado. En verde, por encima de la media de los ${H.equipos.length} equipos esa jornada: lo ha estado en ${encima} de ${q.ptsJ.length}.`) }));
  }

  if (q.resultados.length) {
    const filas = [...q.resultados].reverse().map((r) => {
      const pt = q.ptsJ.find(([j]) => j === r.J);
      return `      <tr><td>${r.J}</td><td><span class="eq-c">${escudo(r.escRival, r.rival, 22)}<span>${e(r.casa ? 'vs' : 'en')} ${e(r.rival)}</span></span></td><td>${resChip(r)} ${r.gf}-${r.gc}</td><td>${pt ? `<span class="pts ${claseEquipo(pt[1], H.mediaJornada[r.J])}">${pt[1]}</span>` : ''}</td></tr>`;
    });
    o.push(bloque('Resultados', `  <div class="tabla-scroll"><table class="tabla-j">\n    <thead><tr><th>J</th><th>Rival</th><th>Res.</th><th>Pts</th></tr></thead>\n    <tbody>\n${filas.join('\n')}\n    </tbody>\n  </table></div>`,
      { linea: '«vs», en casa; «en», fuera. Los puntos son la suma de todos sus jugadores esa jornada.' }));
  }

  // la portería
  const pr = q.portero;
  if (pr) {
    const pg = pr.titular ? `${pr.nombre}, con ${partidosTxt(pr.titular)} de titular, saca ${coma(pr.mediaTit)} puntos de media cuando juega de inicio. Esta temporada, un portero titular que deja la portería a cero saca ${coma(PORTERO_GOLES[0])} de media; con un gol, ${coma(PORTERO_GOLES[1])}; con dos, ${coma(PORTERO_GOLES[2])}.` : '';
    o.push(bloque('La portería', `  <ul class="lj">${filaJugador(pr, `<span class="fj-n">${pr.paradas} paradas<small>${pr.aCero} a cero · media ${e(coma(pr.media))}</small></span>`, { enlace: rj(pr), sub: `${POS[1]} · ${partidosTxt(pr.jugados)} · ${pr.minutos} min` })}</ul>\n  <p>${e(`${q.nombre} lleva ${q.aCero} ${q.aCero === 1 ? 'portería' : 'porterías'} a cero en ${q.resultados.length} partidos y sus porteros suman ${q.paradas} paradas. ${pg}`)} <a href="${raiz}guias/puntos-porteros-laliga-fantasy.html">Cómo puntúan los porteros</a>.</p>`));
  }

  // suben y bajan del equipo en 7 días
  const mov = q.jugadores.filter((x) => x.dif7);
  const sub = [...mov].sort((a, b) => b.dif7 - a.dif7).filter((x) => x.dif7 > 0).slice(0, 5), baj = [...mov].sort((a, b) => a.dif7 - b.dif7).filter((x) => x.dif7 < 0).slice(0, 5);
  const d7 = (x) => `<span class="fj-n">${cambio(x.dif7, dif(x.dif7))}<small>${e(pct(x.pct7))} · ${e(dinero(x.valor))}</small></span>`;
  if (sub.length || baj.length) o.push(bloque('Los que más suben y bajan en 7 días', `  <div class="dos"><div><h3>Suben</h3>${lista(sub.map((x) => filaJugador(x, d7(x), { enlace: rj(x) })))}</div><div><h3>Bajan</h3>${lista(baj.map((x) => filaJugador(x, d7(x), { enlace: rj(x) })))}</div></div>`,
    { linea: 'Valor de hoy frente al de hace siete cambios de mercado. Todo el mercado del día, en <a href="../mercado/">el mercado de hoy</a>.' }));

  // bajas
  const bj = q.bajas.filter((x) => x.pesa || x.jugados >= 3);
  o.push(bloque('Bajas y sancionados', bj.length ? lista(bj.map((x) => filaJugador(x, `<span class="fj-n"><b>${e(ESTADOS[x.estado] || x.estado)}</b>${x.motivo ? `<small>${e(x.motivo.txt)}</small>` : ''}</span>`, { enlace: rj(x) })))
    : `  <p>LaLiga Fantasy no da ahora a ningún jugador del ${e(q.nombre)} que juegue habitualmente como lesionado, en duda ni sancionado.</p>`,
  { linea: 'El estado es el que pone LaLiga Fantasy en cada jugador.' + (H.previa ? ` La lista de la jornada que viene, con apercibidos y el cierre de cláusulas, está en <a href="${raiz}${e(H.previa.ruta)}">la previa de la jornada ${H.previa.jornada}</a>.` : '') }));

  o.push(bloque('De dónde salen los datos', `  <p>Los valores y los puntos son los que publica LaLiga Fantasy para todas las ligas; los resultados, la clasificación y los partidos, los de su calendario. La plantilla es la que tiene el club en el juego hoy, juegue o no. Las cifras de los porteros salen de 237 partidos de portero titular de esta temporada (<a href="${raiz}guias/puntos-porteros-laliga-fantasy.html">la guía de los porteros</a>). Los 20 equipos, en <a href="./">equipos</a>.</p>`));
  o.push(bloque('Con Fantasy Manager', `  <p>La app te dice cuáles de estos jugadores tienes a tiro en el mercado de tu liga, cuánto pujar por ellos y qué rival los tiene en su equipo con la cláusula abierta.</p>`));
  return o.join('\n');
}

/** jugadores/<nombre>.html */
export function contenidoJugador(x, H) {
  const raiz = '../';
  const eq = H.equipos.find((q) => q.id === x.teamId) || null;
  const re = H.rutas.equipo(x.teamId);
  const o = [];
  o.push(`  <div class="ficha-cab">${cara(x, 'g')}<div><h1>${e(x.nombre)} <span>en LaLiga Fantasy</span></h1><p class="peq">${e(PUESTO[x.pos].charAt(0).toUpperCase() + PUESTO[x.pos].slice(1))} · ${re ? `<a href="${raiz}${e(re)}">${e(x.club)}</a>` : e(x.club)}${!x.ok && ESTADOS[x.estado] ? ` · <b class="baja-t">${e(ESTADOS[x.estado])}</b>` : ''}</p></div></div>`);
  o.push(parrafos(lecturaJugador(x, H, eq), 1));
  o.push(`  <p class="peq">Datos del ${e(fechaDia(H.dia))}, con lo jugado hasta la jornada ${H.ultimaJugada}. Se rehace sola cada noche.</p>`);
  o.push(tarjetas([
    `<div class="cifra-c"><b>${e(dinero(x.valor))}</b><span>valor hoy, ${cambio(x.dif, dif(x.dif))}</span></div>`,
    `<div class="cifra-c"><b>${x.puntos}</b><span>puntos en la temporada</span></div>`,
    `<div class="cifra-c"><b>${e(coma(x.media))}</b><span>de media por partido</span></div>`,
    `<div class="cifra-c"><b>${x.pctTit != null ? `${x.pctTit} %` : '—'}</b><span>titularidad (60 minutos o más, más peso a las últimas cinco)</span></div>`,
  ], 'cifras'));

  // el valor
  if (x.temporada && x.temporada.length > 5) {
    const s = x.temporada;
    const max = s.reduce((a, b) => (b.v > a.v ? b : a)), min = s.reduce((a, b) => (b.v < a.v ? b : a));
    const v30 = s[Math.max(0, s.length - 31)];
    o.push(bloque('Valor de mercado', `  ${graficaValor(s, { fecha: fechaCorta })}\n${tarjetas([
      `<div class="cifra-c"><b>${cambio(x.dif7, dif(x.dif7))}</b><span>en 7 días</span></div>`,
      `<div class="cifra-c"><b>${cambio(x.valor - v30.v, dif(x.valor - v30.v))}</b><span>en 30 días</span></div>`,
      `<div class="cifra-c"><b>${e(dinero(max.v))}</b><span>máximo, el ${e(fechaCorta(max.t))}</span></div>`,
      `<div class="cifra-c"><b>${e(dinero(min.v))}</b><span>mínimo, el ${e(fechaCorta(min.t))}</span></div>`], 'cifras')}`,
    { id: 'valor', linea: e(`Su valor cada día desde el ${fechaCorta(s[0].t)}.${x.racha ? ` Ahora lleva ${Math.abs(x.racha)} ${Math.abs(x.racha) === 1 ? 'día' : 'días'} ${x.racha > 0 ? 'subiendo' : 'bajando'} (${dif(x.rachaDif)}).` : ''}`) + ` <a href="${raiz}guias/valor-de-mercado.html">Cómo se mueve el valor</a>.` }));
  }

  // los puntos: una ficha por jornada, como en la app (web/js/hojas.js, `jornadasPtsHTML`): la jornada, los puntos con el color
  // de lo buenos que son (10+, 6-9, 2-5, 1 o menos) y los minutos; las que no jugó, «–» y «no jugó»; el balón o la roja en la esquina
  const pj = x.jornadas.filter((r) => r.pts != null && r.min > 0).map((r) => [r.J, r.pts]);
  if (pj.length) {
    const sorted = [...pj].sort((a, b) => b[1] - a[1]);
    const n10 = pj.filter(([, p]) => p >= 10).length, n1 = pj.filter(([, p]) => p <= 1).length;
    o.push(bloque('Puntos por jornada', fichasJornada(x.jornadas.map((r) => {
      const jugo = r.min > 0 && r.pts != null;
      const extra = [r.g ? `${r.g} gol${r.g > 1 ? 'es' : ''}` : '', r.a ? `${r.a} asist.` : '', r.roja ? 'roja' : r.am ? 'amarilla' : ''].filter(Boolean).join(', ');
      return { J: r.J, pts: jugo ? r.pts : null, abajo: jugo ? `${r.min}'` : null, icono: jugo ? (r.g ? '⚽' : r.roja ? '🟥' : '') : '',
        titulo: jugo ? `J${r.J}: ${r.pts} pts · ${r.min} min${extra ? ` · ${extra}` : ''} · ${r.casa ? 'en casa' : 'fuera'} contra ${el(r.rival)}` : `J${r.J}: no jugó` };
    })), { linea: e(`Su mejor partido, ${sorted[0][1]} puntos en la jornada ${sorted[0][0]}; ${n10 ? `${n10} de 10 o más` : 'ninguno de 10 o más'} y ${n1 ? `${n1} de 1 o menos` : 'ninguno de 1 o menos'}. Debajo de cada jornada, los minutos que jugó.`) }));
  }

  // jornada a jornada
  if (x.jornadas.length) {
    const gk = x.pos === 1;
    const filas = [...x.jornadas].reverse().map((r) => `      <tr><td>${r.J}</td><td><span class="eq-c">${escudo(r.escRival, r.rival, 22)}<span>${e(r.casa ? 'vs' : 'en')} ${e(r.rival)}</span></span></td><td>${r.gf}-${r.gc}</td><td>${r.min ? `${r.min}'` : '—'}</td><td>${r.min && r.pts != null ? chipPuntos(r.pts) : '—'}</td><td>${gk ? (r.min ? `${r.par} par. · ${r.enc} enc.` : '') : [r.g ? `${r.g} gol${r.g > 1 ? 'es' : ''}` : '', r.a ? `${r.a} asist.` : '', r.roja ? 'roja' : r.am ? 'amarilla' : ''].filter(Boolean).join(' · ')}</td></tr>`);
    o.push(bloque('Jornada a jornada', `  <div class="tabla-scroll"><table class="tabla-j">\n    <thead><tr><th>J</th><th>Rival</th><th>Res.</th><th>Min</th><th>Pts</th><th>${gk ? 'Portería' : 'Detalle'}</th></tr></thead>\n    <tbody>\n${filas.join('\n')}\n    </tbody>\n  </table></div>`,
      { linea: e(`${x.jugados} partidos jugados, ${x.titular} de ellos con 60 minutos o más, y ${x.minutos} minutos en total. ${gk ? `${x.paradas} paradas y ${x.aCero} ${x.aCero === 1 ? 'portería' : 'porterías'} a cero siendo titular.` : `${x.goles} ${x.goles === 1 ? 'gol' : 'goles'}, ${x.asist} ${x.asist === 1 ? 'asistencia' : 'asistencias'} y ${x.amarillas} ${x.amarillas === 1 ? 'amarilla' : 'amarillas'}.`}`) }));
  }

  // lo que dicen los datos
  const d = [];
  if (BANQUILLO[x.pos]) d.push(`Si sale desde el banquillo, lo normal en un ${PUESTO[x.pos]} es quedarse en ${coma(BANQUILLO[x.pos])} puntos: por eso pesa tanto que sea titular.`);
  if (x.pos === 1) d.push(`En un portero titular manda la portería: con 0 goles encajados la media es de ${coma(PORTERO_GOLES[0])} puntos y con 3 o más, de ${coma(PORTERO_GOLES[3])}.`);
  if (x.amarillas % 5 === 4 && x.ok) d.push(`Lleva ${x.amarillas} amarillas: una más y se pierde la jornada siguiente.`);
  if (d.length) o.push(bloque('Lo que dicen los datos', `  <p>${e(d.join(' '))} <a href="${raiz}guias/${x.pos === 1 ? 'puntos-porteros-laliga-fantasy' : 'alineacion'}.html">${x.pos === 1 ? 'Los puntos de los porteros' : 'Cuánto pierde un suplente'}</a>.</p>`));

  if (eq && eq.proximos.length) o.push(bloque(`Próximos rivales ${del(eq.nombre)}`, proximosHtml(eq, raiz),
    { linea: e(`La dificultad, por los puntos por partido de cada rival en la tabla, y pesa más jugar fuera.`) }));

  // compañeros con ficha
  const comp = eq ? eq.jugadores.filter((y) => y.id !== x.id && H.rutas.jugador(y.id)).sort((a, b) => (a.pos === x.pos ? 0 : 1) - (b.pos === x.pos ? 0 : 1) || b.valor - a.valor).slice(0, 6) : [];
  if (comp.length) o.push(bloque(`Más del ${eq.nombre}`, lista(comp.map((y) => filaJugador(y, `<span class="fj-n">${e(dinero(y.valor))}<small>media ${e(coma(y.media))}</small></span>`, { enlace: `${raiz}${H.rutas.jugador(y.id)}` })))
    + (re ? `\n  <p><a class="btn sec" href="${raiz}${e(re)}">Toda la plantilla ${e(del(eq.nombre))}</a></p>` : '')));

  o.push(bloque('De dónde salen los datos', `  <p>El valor de mercado es el que publica LaLiga Fantasy cada noche, hacia las 00:15, para todas las ligas; los puntos, minutos, goles y paradas, los de su ficha oficial. La titularidad cuenta los partidos con 60 minutos o más y da más peso a los cinco últimos. Las medias por puesto salen de 3.758 partidos de esta temporada (<a href="${raiz}guias/alineacion.html">la guía de la alineación</a>).</p>`));
  o.push(bloque('Con Fantasy Manager', `  <p>La app te dice si ${e(x.nombre)} está en el mercado de tu liga o en el equipo de un rival, cuánto pujar por él, a cuánto tiene la cláusula y si te compensa pagarla.</p>`));
  return o.join('\n');
}

/** jugadores/: los que tienen ficha, por equipo */
export function contenidoJugadores(H) {
  const o = [];
  const n = H.jugadores.length;
  const caro = H.jugadores[0];
  const mejor = [...H.jugadores].filter((x) => x.jugados >= 5).sort((a, b) => b.media - a.media)[0];
  o.push(`  <h1>Jugadores de <span>LaLiga Fantasy</span></h1>`);
  o.push(`  <p class="lead">${e(`Las fichas de los ${n} jugadores que más pesan en LaLiga Fantasy: titulares habituales, los de buena media y los más caros. Cada una trae su valor día a día, sus puntos de cada jornada, los minutos y la titularidad y sus próximos rivales. El que más vale hoy es ${caro.nombre} (${dinero(caro.valor)})${mejor ? `; el de mejor media con cinco partidos o más, ${mejor.nombre}, con ${coma(mejor.media)}` : ''}.`)}</p>`);
  o.push(`  <p class="peq">Datos del ${e(fechaDia(H.dia))}. Se rehace sola cada noche.</p>`);
  for (const q of [...H.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    const xs = H.jugadores.filter((x) => x.teamId === q.id).sort((a, b) => a.pos - b.pos || b.valor - a.valor);
    if (!xs.length) continue;
    const re = H.rutas.equipo(q.id);
    o.push(`\n  <section class="bq" id="${e(q.slug)}">\n  <h2 class="h2-esc">${escudo(q.escudoUrl, q.nombre, 26)}${re ? `<a href="../${e(re)}">${e(q.nombre)}</a>` : e(q.nombre)}</h2>\n${lista(xs.map((x) => filaJugador(x, `<span class="fj-n">${e(dinero(x.valor))}<small>${x.puntos} pts · media ${e(coma(x.media))}</small></span>`, { enlace: H.rutas.jugador(x.id).split('/').pop() })), 'lj-c')}\n  </section>`);
  }
  o.push(bloque('De dónde salen los datos', `  <p>Tienen ficha los jugadores que juegan de titular la mitad de las veces o más, los que llevan 3 puntos de media o más y los que valen 8 M o más, empezando por los más caros. Los valores y los puntos son los de LaLiga Fantasy para todas las ligas. Los 20 equipos, en <a href="../equipos/">equipos</a>.</p>`));
  return o.join('\n');
}

/** las entradas de paginas.json (en .github/portal/fichas.json) de cada página */
export function metasEquipo(q) {
  return { ruta: `equipos/${q.slug}.html`, seccion: 'equipos', grupo: 'equipo', id: q.id,
    titulo: `${q.nombre} en LaLiga Fantasy: plantilla, valor y puntos`, h1: `${q.nombre} en LaLiga Fantasy`,
    descripcion: `${q.club} en LaLiga Fantasy: lo que vale su plantilla, los puntos de cada jornada, sus próximos rivales, la portería y las bajas. Se pone al día cada noche.`,
    migas: [['Inicio', ''], ['Equipos', 'equipos/']], sobre: { '@type': 'SportsTeam', name: q.club, sport: 'Fútbol' } };
}
export function metasJugador(x) {
  return { ruta: `jugadores/${x.slug}.html`, seccion: 'equipos', grupo: 'jugador', id: x.id,
    titulo: `${x.nombre}: valor de mercado y puntos en LaLiga Fantasy`, h1: `${x.nombre} en LaLiga Fantasy`,
    descripcion: `Valor de mercado de ${x.nombreCompleto} (${x.club}) en LaLiga Fantasy día a día, sus puntos de cada jornada, media, minutos, titularidad y próximos rivales.`,
    migas: [['Inicio', ''], ['Equipos', 'equipos/'], [x.club, `equipos/${x.equipoSlug}.html`]],
    sobre: { '@type': 'Person', name: x.nombreCompleto, memberOf: { '@type': 'SportsTeam', name: x.club } } };
}
export const metasJugadores = () => ({ ruta: 'jugadores/index.html', seccion: 'equipos', grupo: 'jugadores',
  titulo: 'Jugadores de LaLiga Fantasy: valor y puntos de cada uno', h1: 'Jugadores de LaLiga Fantasy',
  descripcion: 'Las fichas de los jugadores que más pesan en LaLiga Fantasy, por equipo: valor de mercado día a día, puntos por jornada, titularidad y próximos rivales.',
  migas: [['Inicio', ''], ['Equipos', 'equipos/']] });
