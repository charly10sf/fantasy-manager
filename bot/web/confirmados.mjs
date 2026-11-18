// Los onces oficiales de cada partido (sesión 3 de AdSense, idea 12), para que en jornada/onces.html el confirmado sustituya al probable.
// Salen de donde ya los lee el bot para sus tuits de onces confirmados (tipos/previa.mjs): el partido de ESPN y su `summary`, con cada
// titular casado con su jugador de LaLiga (casarJugador y casarJugadorFlojo de tipos/directo.mjs). Nunca de una web de fantasy.
//   tocaOnces(): ¿hay un partido que empiece en la próxima hora (o haya empezado hace poco) sin su once confirmado en onces.json?
import { json } from '../lib/http.mjs';
import { ESPN, partidoEspn } from '../lib/relato.mjs';
import { casarJugador, casarJugadorFlojo } from '../tipos/directo.mjs';

const POS_ESPN = (a) => (/^G/.test(a) ? 'POR' : /^(CD|LB|RB|D|CB|LWB|RWB|SW)/.test(a) ? 'DEF' : /^(F|CF|ST|LF|RF|LW|RW)/.test(a) ? 'DEL' : 'MED');
const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
const MIN = 6e4;
export const VENTANA = { antes: 70 * MIN, despues: 30 * MIN };   // se mira desde 70 min antes del saque hasta 30 min después
const diaEspn = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');

/** los titulares de ESPN casados con LaLiga: [{ id, nombre, pos }] (11) o null si aún no están o alguno no casa */
export function casarTitulares(roster, plantilla) {
  const tits = ((roster && roster.roster) || []).filter((x) => x.starter);
  if (tits.length !== 11) return null;
  const pl = { players: plantilla.map((j) => ({ ...j, name: j.nickname })) };
  const out = tits.map((x) => {
    const nom = x.athlete && x.athlete.displayName, abr = (x.position && x.position.abbreviation) || '';
    const p = casarJugador(nom, pl, { portero: !abr || abr === 'SUB' ? null : POS_ESPN(abr) === 'POR' });
    return { id: p ? String(p.id) : null, nombre: p ? p.nickname : nom, pos: p ? POS[p.positionId] : POS_ESPN(abr), abr };
  });
  const usados = new Set(out.filter((x) => x.id).map((x) => x.id));
  out.forEach((x) => {
    if (x.id) return;
    const p = casarJugadorFlojo(x.nombre, pl, { pos: POS_ESPN(x.abr), usados });
    if (p) { usados.add(String(p.id)); Object.assign(x, { id: String(p.id), nombre: p.nickname, pos: POS[p.positionId] || x.pos }); }
  });
  out.forEach((x) => { delete x.abr; });
  return out;
}

/** los dos onces de un partido de LaLiga (stats/week): { [teamId]: [{ id, nombre, pos }] } o {} si ESPN aún no los tiene */
export async function confirmadosDe(m, jugadores, { pedir = json, buscar = partidoEspn } = {}) {
  const ev = await buscar(m, diaEspn(Date.parse(m.date))).catch(() => null);
  const sum = ev ? await pedir(`${ESPN}/summary?event=${ev.ev.id}`).catch(() => null) : null;
  const ros = (sum && sum.rosters) || [];
  const out = {};
  for (const [lado, eq] of [['home', m.local], ['away', m.visitor]]) {
    const r = ros.find((x) => x.homeAway === lado);
    const plantilla = jugadores.filter((j) => String(j.teamId) === String(eq.id) && Number(j.positionId) >= 1 && Number(j.positionId) <= 4);
    const c = r ? casarTitulares(r, plantilla) : null;
    if (c) out[String(eq.id)] = c;
  }
  return out;
}

/** los partidos de la jornada en la ventana de los onces (de 70 min antes a 30 después del saque) cuyos equipos no tienen el confirmado */
export function pendientes(stats, onces, ahora = Date.now()) {
  if (!onces || !Array.isArray(stats)) return [];
  const conf = new Set(onces.equipos.filter((y) => y.confirmado).map((y) => y.id));
  const hay = new Set(onces.equipos.map((y) => y.id));
  return stats.filter((m) => {
    const t = Date.parse(m.date);
    if (!(t - ahora <= VENTANA.antes && ahora - t <= VENTANA.despues)) return false;
    const ids = [String(m.local.id), String(m.visitor.id)].filter((id) => hay.has(id));
    return ids.some((id) => !conf.has(id));
  });
}

/**
 * ¿toca lanzar «Portal web» con los onces? Una vez por hora de saque (los partidos que empiezan a la vez van juntos); lo lanzado se
 * apunta en `est` ({ 'J|t': true }) para no repetirlo. Devuelve la clave de la hora de saque o ''.
 */
export function tocaOnces(stats, onces, est = {}, ahora = Date.now()) {
  const ps = pendientes(stats, onces, ahora).filter((m) => Date.parse(m.date) - ahora <= 65 * MIN);
  for (const m of ps) { const k = `${onces.J}|${Date.parse(m.date)}`; if (!est[k]) return k; }
  return '';
}
