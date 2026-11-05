// Lloros Fantasy (cola de Carlos, 3 nov 20:17; formato de claude/estilo-tweets.md, el tweet de Carrasco con más vistas): jugadores que
// se quedan sin la bonificación de portería a cero por muy poco. Reglas comprobadas el 3 nov con 4.072 fichas de jornada de LaLiga
// (bot/prueba/puntos-sondeo.mjs): la portería a cero da 4 al portero, 3 al defensa, 2 al centrocampista y 1 al delantero, y SOLO
// con 60 minutos o más en el campo sin que le cuenten un gol encajado; jugar de 1 a 59 minutos da 1 punto y 60 o más, 2.
// Dos casos, sacados de la ficha de cada jugador en la jornada:
//   - se queda en 50-59 minutos (un cambio en el descanso no es «por muy poco») y su equipo no encaja en todo el partido: pierde la portería a cero y el segundo punto por jugar;
//   - juega 60 o más y su equipo solo encaja un gol, a partir del 85' (minuto de ESPN): pierde la portería a cero (un gol no resta).
// Solo porteros, defensas y centrocampistas que pesan (3 o más de media, o 5 M o más), sin rojas. Un tweet por jornada, cuando ha
// acabado del todo y han pasado 2 h del último saque + 2 h de partido, de 9 a 23 h.
import { corto, el, fmt, hash, largo } from '../lib/texto.mjs';
import { tweet, cap, puesto } from '../lib/redactar.mjs';
import { ficha as fichaLaLiga } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { partidoEspn, reconstruir, minutoDe } from '../lib/relato.mjs';
import { lista, enLetra, mayus } from '../lib/agrupar.mjs';

export const BONUS = { 1: 4, 2: 3, 3: 2, 4: 1 };
const HORA = 36e5;
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const diaEspn = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');
const pesa = (j) => Number(j.averagePoints) >= 3 || Number(j.marketValue) >= 5e6;
const val = (s, k) => (s && s[k] ? Number(s[k][0]) || 0 : 0);

/** el minuto del único gol que encajó un equipo en un partido (null si ESPN no lo da o no cuadra) */
export async function minutoGolEncajado(m, esLocal, { espn = partidoEspn } = {}) {
  const e = await espn(m, diaEspn(Date.parse(m.date))).catch(() => null);
  if (!e) return null;
  const rel = reconstruir((e.c && e.c.details) || [], e.casa.team.id, e.fuera.team.id, m.localScore, m.visitorScore);
  if (!rel.ok) return null;
  // el gol del rival: la jugada en la que su marcador pasa de 0 a 1
  for (const d of rel.orden) {
    const t = rel.tras.get(d);
    if (!d.scoringPlay || !t) continue;
    if ((esLocal ? t.marcador[1] : t.marcador[0]) === 1) return minutoDe(d);
  }
  return null;
}

/** los casos de una jornada a partir de los partidos y las fichas ya pedidas (aparte para probarlo sin red) */
export function casos({ partidos, jornada, jugadores, fichas, golTarde }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  for (const m of partidos) {
    for (const [lado, encaja, esLocal] of [[m.local, Number(m.visitorScore), true], [m.visitor, Number(m.localScore), false]]) {
      if (!(encaja === 0 || encaja === 1)) continue;
      const tarde = encaja === 1 ? golTarde[`${m.id}|${esLocal ? 'l' : 'v'}`] : null;
      if (encaja === 1 && !(tarde && tarde.min >= 85)) continue;
      for (const p of lado.players || []) {
        const j = porId.get(String(p.id));
        if (!j || !(j.positionId >= 1 && j.positionId <= 3) || !pesa(j)) continue;
        const f = fichas[String(p.id)];
        const s = f && (f.playerStats || []).find((x) => Number(x.weekNumber) === Number(jornada));
        const st = s && s.stats;
        if (!st) continue;
        const min = val(st, 'mins_played'), gc = val(st, 'goals_conceded');
        if (val(st, 'red_card') || val(st, 'second_yellow_card')) continue;
        const base = { id: j.id, nombre: j.nickname, pos: j.positionId, equipo: corto(lado.mainName), media: Number(j.averagePoints) || 0, valor: Number(j.marketValue) || 0, partido: m.id };
        if (encaja === 0 && min >= 50 && min < 60 && gc === 0) out.push({ ...base, caso: 'minutos', min, pierde: BONUS[j.positionId] + 1 });
        if (encaja === 1 && min >= 60 && gc === 1) out.push({ ...base, caso: 'gol', gol: tarde, pierde: BONUS[j.positionId] });
      }
    }
  }
  // los que más pierden y, entre iguales, los que más pesan
  return out.sort((a, b) => b.pierde - a.pierde || b.media - a.media || b.valor - a.valor);
}

const minTxt = (g) => (g.extra ? `${g.min}+${g.extra}'` : `${g.min}'`);
// Varias formas por caso, para que dos lloros seguidos no se lean calcados (Carlos, 4 nov: nada que suene a plantilla).
// q: quién al principio de la frase; a: «a Vivian» o «al defensa».
const MINUTOS = [
  (q, a, x) => `${q} se quedó en ${x.min} minutos con ${el(x.equipo)} sin encajar: ${x.pierde} puntos menos`,
  (q, a, x) => `${q} jugó ${x.min} minutos y ${el(x.equipo)} acabó a cero. Por no llegar a 60, ${x.pierde} puntos menos`,
  (q, a, x) => `${cap(a)} ${60 - x.min === 1 ? 'le faltó un minuto' : `le faltaron ${60 - x.min} minutos`}: jugó ${x.min} con ${el(x.equipo)} a cero y se deja ${x.pierde} puntos`,
];
const GOL = [
  (q, a, x) => `${q}: ${el(x.equipo)} encajó en el ${minTxt(x.gol)} y se le van ${x.pierde} puntos`,
  (q, a, x) => `${q} tenía la portería a cero hasta el ${minTxt(x.gol)}, cuando encajó ${el(x.equipo)}: ${x.pierde} puntos menos`,
  (q, a, x) => `El gol que encajó ${el(x.equipo)} en el ${minTxt(x.gol)} le quita ${x.pierde} puntos ${a}`,
];
/** «⚠️ El defensa se quedó en 58 minutos con el Getafe sin encajar: 4 puntos menos»; v elige la forma (0 por defecto) */
export function lineaLloro(x, solo, v = 0) {
  const quien = solo ? cap(`el ${puesto(x.pos)}`) : x.nombre;
  const a = solo ? `al ${puesto(x.pos)}` : `a ${x.nombre}`;
  const formas = x.caso === 'minutos' ? MINUTOS : GOL;
  return `⚠️ ${formas[v % formas.length](quien, a, x)}`;
}
// dos o más del mismo equipo y el mismo caso van en una frase: «El Athletic acabó a cero, pero Vivian (58 minutos) y Sancet (59)…»
export function lineaGrupo(xs) {
  const eq = xs[0].equipo;
  const iguales = xs.every((x) => x.pierde === xs[0].pierde);
  const pierden = iguales ? `${xs[0].pierde} puntos menos cada uno` : `${lista(xs.map((x) => x.pierde))} puntos menos`;
  if (xs[0].caso === 'minutos') {
    const quienes = lista(xs.map((x, i) => `${x.nombre} (${x.min}${i ? '' : ' minutos'})`));
    return `⚠️ ${cap(el(eq))} acabó a cero, pero ${quienes} no llegaron a los 60: ${pierden}`;
  }
  return `⚠️ ${cap(el(eq))} encajó en el ${minTxt(xs[0].gol)} y lo pagan ${lista(xs.map((x) => x.nombre))}: ${pierden}`;
}
/** las líneas del tweet: una por lloro o por grupo, y cada caso rotando de forma según la jornada */
export function lineasLloros(xs, { solo = false, jornada = 0 } = {}) {
  const vez = { minutos: hash(`lloros${jornada}m`), gol: hash(`lloros${jornada}g`) };
  const grupos = [];
  for (const x of xs) {
    // un equipo que solo encajó un gol: es el mismo gol para todos los suyos
    const g = !solo && grupos.find((g) => g[0].caso === x.caso && g[0].equipo === x.equipo);
    if (g) g.push(x); else grupos.push([x]);
  }
  // con muchos (hasta 6 en un tweet largo), del cuarto en adelante van juntos por caso: con una frase por cabeza, cada forma salía dos
  // veces y «puntos menos», cuatro (auditoría del 5 nov)
  const sueltos = grupos.slice(3), lineas = grupos.slice(0, 3).map((g) => (g.length > 1 ? lineaGrupo(g) : lineaLloro(g[0], solo, vez[g[0].caso]++)));
  for (const caso of ['minutos', 'gol']) {
    const xs = sueltos.flat().filter((x) => x.caso === caso);
    if (!xs.length) continue;
    const ya = grupos.slice(0, 3).some((g) => g[0].caso === caso), n = xs.length;
    const iguales = xs.every((x) => x.pierde === xs[0].pierde);
    const pierden = n > 1 && iguales ? `${xs[0].pierde} puntos menos cada uno` : `${lista(xs.map((x) => x.pierde))} puntos menos`;
    if (caso === 'minutos') {
      lineas.push(`⚠️ ${lista(xs.map((x) => `${x.nombre} (${x.min})`))} ${ya ? 'tampoco' : 'no'} ${n > 1 ? 'llegaron' : 'llegó'} a los 60 con su equipo a cero: ${pierden}`);
    } else {
      lineas.push(`⚠️ A ${lista(xs.map((x) => `${x.nombre} (${minTxt(x.gol)})`))} ${ya ? 'también ' : ''}${n > 1 ? 'les' : 'le'} quitó la portería a cero un gol al final: ${pierden}`);
    }
  }
  return lineas;
}
const numerosDe = (x) => [x.pierde, ...(x.caso === 'minutos' ? [x.min, 60, 60 - x.min] : [x.gol.min, x.gol.extra].filter(Boolean))];

export function escribir(cs, { jornada }) {
  // con tweets largos (X Premium) caben hasta 6; en 280, hasta 4
  for (let n = Math.min(cs.length, largo() ? 6 : 4); n >= 1; n--) {
    const xs = cs.slice(0, n);
    const cab = n <= 2 ? `🚨 ${lista(xs.map((x) => x.nombre))} ${n === 1 ? 'se queda' : 'se quedan'} sin la portería a cero`
      : `🚨 ${mayus(enLetra(n))} jugadores se quedan sin la portería a cero por muy poco`;
    const lineas = lineasLloros(xs, { solo: n === 1, jornada });
    const etiqueta = `💔 Lloros Fantasy de la jornada ${jornada}`;
    const r = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), { t: etiqueta, prio: 9 }]);
    if (![...lineas, etiqueta].every((l) => r.usadas.includes(l))) continue;
    const numeros = [jornada, ...xs.flatMap(numerosDe)];
    return [{ tipo: 'lloros', clave: `lloros|${jornada}`, jornada, texto: r.texto, numeros }];
  }
  return [];
}

export async function generar({ stats, jornada, jugadores, config = {}, ventanas = true, forzar = false, ahora = Date.now(), log = console.log, fichaDe = fichaLaLiga, espn = partidoEspn, registro = null }) {
  if (registro && registro.claves.has(`lloros|${jornada}`)) return [];
  if (!stats.length || !stats.every((m) => m.matchState === 7)) { log('  (lloros) la jornada no ha acabado'); return []; }
  const [hD, hH] = config.horasLloros || [9, 23];
  if (ventanas && !forzar) {
    if (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH) { log(`  (lloros) fuera de horario (${hD} a ${hH} h)`); return []; }
    const ultimo = Math.max(...stats.map((m) => Date.parse(m.date)).filter(Number.isFinite));
    if (ahora - ultimo < 4 * HORA) { log('  (lloros) espero a que se asienten los puntos del último partido'); return []; }
  }
  // los goles tardíos (ESPN) de los equipos que solo encajaron uno
  const golTarde = {};
  for (const m of stats) for (const esLocal of [true, false]) {
    if (Number(esLocal ? m.visitorScore : m.localScore) !== 1) continue;
    golTarde[`${m.id}|${esLocal ? 'l' : 'v'}`] = await minutoGolEncajado(m, esLocal, { espn }).catch(() => null);
  }
  // las fichas solo de los que pueden ser un lloro: equipos a cero o con un gol tardío
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const ids = [];
  for (const m of stats) for (const [lado, encaja, k] of [[m.local, Number(m.visitorScore), 'l'], [m.visitor, Number(m.localScore), 'v']]) {
    const g = golTarde[`${m.id}|${k}`];
    if (!(encaja === 0 || (encaja === 1 && g && g.min >= 85))) continue;
    for (const p of lado.players || []) { const j = porId.get(String(p.id)); if (j && j.positionId >= 1 && j.positionId <= 3 && pesa(j)) ids.push(String(p.id)); }
  }
  const fs = await enParalelo(ids, 6, (id) => fichaDe(id).catch(() => null));
  const fichas = Object.fromEntries(ids.map((id, i) => [id, fs[i]]));
  const cs = casos({ partidos: stats, jornada, jugadores, fichas, golTarde });
  log(`  (lloros) jornada ${jornada}: goles encajados a partir del 85' que dejan sin portería a cero: ${Object.values(golTarde).filter((g) => g && g.min >= 85).length}; ${ids.length} fichas miradas, ${cs.length} lloros${cs.length ? `: ${cs.map((x) => `${x.nombre} (${x.caso}, −${x.pierde})`).join(', ')}` : ''}`);
  return escribir(cs, { jornada });
}
