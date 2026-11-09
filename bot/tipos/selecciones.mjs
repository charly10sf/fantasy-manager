// Los jugadores de LaLiga con sus selecciones durante el parón (Carlos, 9 nov 08:58): goles, asistencias y los que se retiran
// lesionados, de FotMob (API no oficial, sin clave: lib/fotmob.mjs). Los partidos de cada día del parón (`/matches?date=…`), solo de
// selecciones absolutas masculinas (Nations League, amistosos, clasificaciones; nada de sub-21 ni femenino) y acabados; de cada uno, el
// detalle (`/matchDetails`): en las alineaciones cada jugador trae su club (`primaryTeamName`), así se sabe quién juega en LaLiga, y
// se cruza con la lista de LaLiga por club y nombre. Una lesión solo si FotMob la marca (`injuredPlayerOut` en el cambio): nada de
// lo que no venga en los datos (como `sucesosSinHechos` del final). Convocatorias: FotMob solo da los que van en el acta de cada
// partido, no la lista de convocados; sin una fuente fiable, no se cuentan (Carlos lo sabe: 9 nov).
// Un tuit por parón, el último de los cuatro (lib/paron-tuits.mjs), con tarjeta (la del mercado con otros paneles).
import { json } from '../lib/http.mjs';
import { enParalelo } from '../lib/http.mjs';
import { FOTMOB, mismoNombre } from '../lib/fotmob.mjs';
import { pais } from '../lib/nacionalidad.mjs';
import { clubes as clubesH, jugador as jugadorH } from '../lib/hechos.mjs';
import { corto, norm, hash, el } from '../lib/texto.mjs';
import { tweet, aparte, cap } from '../lib/redactar.mjs';
import { lista as enLista } from '../lib/agrupar.mjs';
import { ventanaParon, imagenesDe } from '../lib/paron-tuits.mjs';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
const aaaammdd = (t) => DIA.format(new Date(t)).replace(/-/g, '');

/** ¿es un partido de selecciones absolutas masculinas? (por la competición y por los equipos) */
export function deSelecciones(liga, m) {
  const n = `${liga.name || ''} ${liga.parentLeagueName || ''}`;
  if (/women|\(w\)|u-?2[0-3]\b|u-?1\d\b|youth|olympic|club|copa del rey|copa de la reina|supercopa/i.test(n)) return false;
  if (m && [m.home && m.home.name, m.away && m.away.name].some((x) => /\(w\)|\bU-?\d\d\b/i.test(String(x || '')))) return false;
  return /nations league|friendl|world cup qual|qualification|euro\b|africa cup|asian cup|gold cup|copa am[eé]rica|concacaf|conmebol|afc\b|caf\b/i.test(n);
}

/**
 * Lo de los jugadores de LaLiga en un partido de selecciones (el detalle de FotMob). clubesLiga: Set de los nombres cortos de LaLiga.
 * { jugadores: Map(idFm → { id, nombre, club, codigo, casa }), goles: [{ id, min }], asist: [{ id, min }], lesiones: [{ id, min }],
 *   casa: { nombre, codigo, goles }, fuera }
 */
export function leerPartido(det, clubesLiga) {
  const lu = det && det.content && det.content.lineup;
  if (!lu || !lu.homeTeam || !lu.awayTeam) return null;
  const todos = new Map(), deLaLiga = new Map();
  const codigoDe = (t) => { const c = {}; for (const p of [...(t.starters || []), ...(t.subs || [])]) if (p.countryCode) c[p.countryCode] = (c[p.countryCode] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
  for (const [t, casa] of [[lu.homeTeam, true], [lu.awayTeam, false]]) for (const p of [...(t.starters || []), ...(t.subs || [])]) {
    const x = { id: String(p.id), nombre: p.name, clubFm: p.primaryTeamName || '', club: corto(p.primaryTeamName || ''), codigo: p.countryCode || null, casa, titular: (t.starters || []).includes(p) };
    todos.set(x.id, x);
    if (clubesLiga.has(x.club)) deLaLiga.set(x.id, x);
  }
  const ev = (det.content.matchFacts && det.content.matchFacts.events && det.content.matchFacts.events.events) || [];
  const goles = [], asist = [], lesiones = [];
  for (const e of ev) {
    if (e.type === 'Goal' && e.player && e.player.id != null && !e.ownGoal && !/own goal/i.test(String(e.goalDescription || ''))) {
      goles.push({ id: String(e.player.id), min: e.time });
      if (e.assistInput) {
        const del = [...todos.values()].filter((p) => p.casa === !!e.isHome && mismoNombre(p.nombre, e.assistInput));
        if (del.length === 1) asist.push({ id: del[0].id, min: e.time });
      }
    }
    // el cambio por lesión: el que sale es el que estaba en el campo (titular, o el que había entrado antes)
    if (e.type === 'Substitution' && e.injuredPlayerOut && Array.isArray(e.swap) && e.swap.length === 2) {
      const [a, b] = e.swap.map((s) => String(s.id));
      const sale = todos.get(b) && (todos.get(b).titular || !todos.get(a)?.titular) ? b : a;
      lesiones.push({ id: sale, min: e.time });
    }
  }
  const h = det.header && det.header.teams;
  const equipo = (i, t) => ({ nombre: (h && h[i] && h[i].name) || t.name, codigo: codigoDe(t), goles: h && h[i] ? Number(h[i].score) : null });
  return { jugadores: deLaLiga, goles, asist, lesiones, casa: equipo(0, lu.homeTeam), fuera: equipo(1, lu.awayTeam) };
}

/** el jugador de la lista de LaLiga que es este de FotMob: mismo club y el mismo nombre (exacto o, si es el único, el apellido) */
export function casarJugador(x, jugadores, equipos) {
  const delClub = jugadores.filter((j) => corto(equipos[String(j.teamId)] || '') === x.club);
  const n = norm(x.nombre);
  const exactos = delClub.filter((j) => norm(j.nickname) === n);
  if (exactos.length === 1) return exactos[0];
  const parecidos = delClub.filter((j) => mismoNombre(j.nickname, x.nombre));
  return parecidos.length === 1 ? parecidos[0] : null;
}

/** lo de cada jugador de LaLiga en todos los partidos: [{ j, fm, seleccion, goles, asist, partidos: [{ rival, marcador, fecha }], lesion }] */
export function juntar(partidos, jugadores, equipos) {
  const por = new Map();
  for (const { p, fecha } of partidos) {
    const tocados = new Set([...p.goles, ...p.asist, ...p.lesiones].map((x) => x.id));
    for (const id of tocados) {
      const x = p.jugadores.get(id);
      if (!x) continue;
      const j = casarJugador(x, jugadores, equipos);
      if (!j) continue;
      const k = String(j.id);
      const yo = x.casa ? p.casa : p.fuera, otro = x.casa ? p.fuera : p.casa;
      const r = por.get(k) || { j, fm: x, seleccion: pais(yo.codigo || x.codigo) || yo.nombre, codigo: yo.codigo || x.codigo, goles: 0, asist: 0, partidos: [], lesion: null };
      const g = p.goles.filter((y) => y.id === id).length, a = p.asist.filter((y) => y.id === id).length, l = p.lesiones.find((y) => y.id === id);
      r.goles += g; r.asist += a;
      const rival = pais(otro.codigo) || otro.nombre;
      const marcador = yo.goles != null && otro.goles != null ? `${yo.goles}-${otro.goles}` : null;
      r.partidos.push({ rival, marcador, fecha, goles: g, asist: a });
      if (l) r.lesion = { min: l.min, rival, fecha };
      por.set(k, r);
    }
  }
  return [...por.values()];
}

export async function generar(ctx) {
  const { jugadores = [], stats = [], equipos: equiposCtx = {}, log = console.log, ahora = Date.now(), paron = null, fechasSelecciones = null, pedir = json } = ctx;
  const v = ventanaParon('selecciones', ctx);
  if (!v.ok) { log(`  (selecciones) ${v.motivo}`); return []; }
  const im = imagenesDe(jugadores, stats, paron && paron.statsAnterior, paron && paron.statsSiguiente);
  const equipos = { ...equiposCtx, ...im.equipos };
  const clubesLiga = new Set(Object.values(equipos).map((n) => corto(n)));
  // los días del parón hasta hoy (o los que se pasen para probar: --fechas-selecciones=AAAAMMDD,…)
  let dias = fechasSelecciones;
  if (!dias) {
    const desde = paron ? paron.fin : ahora - 8 * 864e5;
    dias = [];
    for (let t = desde; t <= ahora && dias.length < 12; t += 864e5) dias.push(aaaammdd(t));
    if (!dias.includes(aaaammdd(ahora))) dias.push(aaaammdd(ahora));
  }
  const ua = { headers: { Accept: 'application/json' }, tiempo: 15000, reintentos: 1 };
  const delDia = await enParalelo(dias, 3, (d) => pedir(`${FOTMOB}/matches?date=${d}&timezone=Europe%2FMadrid&ccode3=ESP`, ua).catch(() => null));
  const ms = [];
  delDia.forEach((r, i) => { for (const l of (r && r.leagues) || []) for (const m of l.matches || []) if (deSelecciones(l, m) && m.status && m.status.finished && !m.status.cancelled) ms.push({ id: m.id, fecha: dias[i], liga: l.name }); });
  log(`  (selecciones) ${dias[0]}-${dias[dias.length - 1]}: ${ms.length} partidos de selecciones acabados`);
  if (!ms.length) return [];
  const dets = await enParalelo(ms, 4, (m) => pedir(`${FOTMOB}/matchDetails?matchId=${m.id}`, ua).catch(() => null));
  const partidos = [];
  dets.forEach((d, i) => { const p = leerPartido(d, clubesLiga); if (p && p.jugadores.size) partidos.push({ p, fecha: ms[i].fecha, liga: ms[i].liga }); });
  const gente = juntar(partidos, jugadores, equipos);
  const goleadores = gente.filter((x) => x.goles + x.asist > 0).sort((a, b) => (b.goles * 2 + b.asist) - (a.goles * 2 + a.asist) || Number(b.j.marketValue) - Number(a.j.marketValue));
  const tocados = gente.filter((x) => x.lesion).sort((a, b) => Number(b.j.marketValue) - Number(a.j.marketValue));
  log(`  (selecciones) ${partidos.length} partidos con jugadores de LaLiga · goles o asistencias: ${goleadores.map((x) => `${x.j.nickname} ${x.goles}+${x.asist}`).join(', ') || 'nadie'} · tocados: ${tocados.map((x) => x.j.nickname).join(', ') || 'nadie'}`);
  if (goleadores.length < 2 && !tocados.length) return [];
  const eq = (x) => corto(equipos[String(x.j.teamId)] || '?');
  const fechaTxt = (d) => `${Number(d.slice(6))} de ${MESES[Number(d.slice(4, 6)) - 1]}`;
  const ga = (x) => [x.goles ? `${x.goles} ${x.goles === 1 ? 'gol' : 'goles'}` : '', x.asist ? `${x.asist} ${x.asist === 1 ? 'asistencia' : 'asistencias'}` : ''].filter(Boolean).join(' y ');
  const V = (xs, k) => xs[hash(`sel${v.jugada}${k}`) % xs.length];

  // la plantilla (último recurso)
  const a = goleadores[0];
  const num = [];
  const cab = V(['🌍 Lo que han hecho los de LaLiga con sus selecciones en el parón', '🌍 Parón de selecciones: goles, asistencias y sustos de los jugadores de LaLiga'], 'cab');
  const ideas = [];
  if (a) { ideas.push({ t: aparte(`⚽ ${a.j.nickname} ${eq(a) ? `(${eq(a)})` : ''} ha hecho ${ga(a)} con ${a.seleccion}`), prio: 9 }); num.push(a.goles, a.asist); }
  const otros = goleadores.slice(1, 5);
  if (otros.length) { ideas.push({ t: aparte(`También han marcado o dado un gol ${enLista(otros.map((x) => `${x.j.nickname} (${x.seleccion})`))}`), prio: 7 }); }
  for (const x of tocados.slice(0, 2)) { ideas.push({ t: aparte(`🚑 ${x.j.nickname} ${del2(eq(x))} se retiró lesionado en el minuto ${x.lesion.min} ante ${x.lesion.rival}`), prio: 8 }); num.push(x.lesion.min); }
  const { texto } = tweet(cab, ideas);

  // la tarjeta: la del mercado con un panel de goles y asistencias y, si los hay, otro de los que se retiran tocados
  const fila = (x, dif, pct) => ({ nombre: x.j.nickname, pos: Number(x.j.positionId), equipo: eq(x), club: equipos[String(x.j.teamId)] || '', caraUrl: im.cara(x.j), escudoUrl: im.escudoDe(x.j.teamId), dif, pct, valor: x.seleccion.toUpperCase() });
  const grande = (x) => (x.goles ? `${x.goles} ${x.goles === 1 ? 'GOL' : 'GOLES'}` : `${x.asist} ${x.asist === 1 ? 'ASIST.' : 'ASIST.'}`);
  const peque = (x) => (x.goles && x.asist ? `+${x.asist} ASIST.` : `${x.partidos.length} ${x.partidos.length === 1 ? 'PARTIDO' : 'PARTIDOS'}`);
  const paneles = [];
  if (goleadores.length) paneles.push({ titulo: 'GOLES Y ASISTENCIAS', bueno: true, flecha: false, filas: goleadores.slice(0, 5).map((x) => fila(x, grande(x), peque(x))) });
  if (tocados.length) paneles.push({ titulo: 'SE RETIRAN TOCADOS', bueno: false, flecha: false, filas: tocados.slice(0, 5).map((x) => fila(x, `MIN. ${x.lesion.min}`, `ANTE ${String(x.lesion.rival).toUpperCase()}`)) });
  else if (goleadores.length > 5) paneles.push({ titulo: 'Y TAMBIÉN', bueno: true, flecha: false, filas: goleadores.slice(5, 10).map((x) => fila(x, grande(x), peque(x))) });
  const d1 = dias[0], d2 = dias[dias.length - 1];
  const d = { titulo: 'SELECCIONES', sub: 'JUGADORES DE LALIGA', sub2: `PARÓN · ${fechaTxt(d1).toUpperCase()} - ${fechaTxt(d2).toUpperCase()}`, paneles };
  const todas = paneles.flatMap((p) => p.filas);
  const tarjeta = { tipo: 'mercado', nombre: `selecciones-${v.jugada}`, d,
    permitidos: { numeros: [Number(d1.slice(6)), Number(d2.slice(6)), ...todas.flatMap((f) => [f.dif, f.pct])].map(String),
      palabras: ['SELECCIONES', 'JUGADORES', 'DE', 'LALIGA', 'PARÓN', 'GOLES', 'GOL', 'Y', 'ASISTENCIAS', 'ASIST', 'SE', 'RETIRAN', 'TOCADOS', 'TAMBIÉN', 'MIN', 'ANTE', 'PARTIDO', 'PARTIDOS',
        ...MESES.map((m) => m.toUpperCase()), ...todas.flatMap((f) => [f.nombre, f.equipo, f.valor, f.pct])] } };

  // los hechos para la IA: cada uno con lo que hizo y contra quién; las lesiones, solo las que marca FotMob
  const jug = (x, extra, principal = false) => jugadorH(x.j, { equipos, principal, sinDatos: ['goles'], extra: { club: eq(x), seleccion: x.seleccion, ...extra } });
  const hechos = { tipo: 'selecciones', noticia: `lo que han hecho los jugadores de LaLiga con sus selecciones en el parón (del ${fechaTxt(d1)} al ${fechaTxt(d2)}): goles, asistencias y los que se han retirado lesionados`,
    momento: `la liga vuelve con la jornada ${v.siguiente}`,
    aviso: 'una lesión, solo la que está en «seRetiranTocados» y tal como está (se retiró lesionado en ese minuto): ni gravedad ni plazos, que no se saben. Nada de convocatorias ni de partidos que no estén aquí. La imagen adjunta lleva a los que han marcado o asistido.',
    golesYAsistencias: goleadores.slice(0, 6).map((x) => ({ nombre: x.j.nickname, club: eq(x), seleccion: x.seleccion, loQueHizo: ga(x), partidos: x.partidos.filter((p) => p.goles || p.asist).map((p) => `ante ${p.rival}${p.marcador ? ` (${p.marcador})` : ''}, el ${fechaTxt(p.fecha)}`) })),
    ...(tocados.length ? { seRetiranTocados: tocados.slice(0, 4).map((x) => ({ nombre: x.j.nickname, club: eq(x), seleccion: x.seleccion, queLePaso: `se retiró lesionado en el minuto ${x.lesion.min} ante ${x.lesion.rival}, el ${fechaTxt(x.lesion.fecha)}` })) } : {}),
    jugadores: [...goleadores.slice(0, 3).map((x, i) => jug(x, { loQueHizo: ga(x) }, i === 0)), ...tocados.slice(0, 2).map((x) => jug(x, { estado: 'tocado con su selección' }, true))],
    clubes: clubesH(...[...goleadores.slice(0, 6), ...tocados.slice(0, 4)].map(eq)) };
  return [{ tipo: 'selecciones', clave: `selecciones|${v.jugada}`, jornada: v.jugada, texto, hechos, numeros: num, partido: null, tarjeta }];
}
const del2 = (eq) => (eq ? `(${eq})` : '');
