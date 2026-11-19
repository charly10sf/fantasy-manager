// Posible once de un equipo: % de titularidad como el de la app (`M.titularidad`): el once probable de las webs de previas
// (peso 0,5, lib/ff.mjs; desde el 3 nov) y los minutos de las fichas de LaLiga con su valor (web/js/titular.js, desde el 19 nov;
// `baseTitular` de tipos/caidas.mjs); lesionado o sancionado: 0; duda: ×0,6 a los minutos. Si la página
// del once probable no se lee, sale solo de los minutos, como antes. Falta el riesgo de rotación por Europa y Copa de la app.
import { ficha } from './laliga.mjs';
import { onceProbable, pOnce } from './ff.mjs';
import { enParalelo } from './http.mjs';
import { baseTitular } from '../tipos/caidas.mjs';

const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
// formaciones que se prueban: se queda la que más suma de % (defensas, medios, delanteros)
const FORMACIONES = [[4, 3, 3], [4, 4, 2], [4, 5, 1], [3, 5, 2], [3, 4, 3], [5, 3, 2], [5, 4, 1]];
const fichas = new Map();
const fichaDe = (id) => { if (!fichas.has(id)) fichas.set(id, ficha(id).catch(() => null)); return fichas.get(id); };

/**
 * { [idJugador]: { id, nombre, pos, p (0-1), duda, estado, ff } } de los jugadores de un equipo: los 20 de más valor y los que el
 * once probable pone de titulares o alternativas (un chaval barato que juega se quedaba fuera de los 20).
 * opciones.equipo: el nombre del equipo en LaLiga, para buscar su once probable (sin él, solo minutos).
 */
export async function probabilidades(teamId, jugadores, ultimaJugada, { equipo = null, conOnce = true, log = () => {} } = {}) {
  const todos = jugadores.filter((j) => String(j.teamId) === String(teamId) && Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && j.playerStatus !== 'out_of_league')
    .sort((a, b) => Number(b.marketValue) - Number(a.marketValue));
  const ff = conOnce && equipo ? await onceProbable(equipo, todos, { log }) : null;
  const del = todos.filter((j, i) => i < 20 || (ff && ff[j.id] && (ff[j.id].titular || ff[j.id].alternativa)));
  const fs = await enParalelo(del, 10, (j) => fichaDe(j.id));
  const out = {};
  // (19 nov) como la app: minutos con su valor frente al que más vale de su puesto (web/js/titular.js) y el once probable a medias
  const MAL = new Set(['injured', 'suspended', 'out_of_league']);
  const top = {};
  for (const j of todos) if (!MAL.has(j.playerStatus)) top[j.positionId] = Math.max(top[j.positionId] || 0, Number(j.marketValue) || 0);
  del.forEach((j, i) => {
    const vrel = top[j.positionId] ? Math.min(1, (Number(j.marketValue) || 0) / top[j.positionId]) : 0.5;
    const b = fs[i] && !fs[i].error ? baseTitular(fs[i].playerStats, ultimaJugada, vrel) : null;
    const o = ff ? ff[j.id] || null : null;
    const duda = j.playerStatus === 'doubtful' || (o && o.estado === 'doubtful');
    const pm = b ? b.p * (duda ? 0.6 : 1) : null;
    const pf = ff ? pOnce(o) * (duda && !(o && o.prob != null) ? 0.6 : 1) : null;
    let p = pm != null && pf != null ? (pm + pf) / 2 : pm != null ? pm : pf != null ? pf : 0.15;
    if (j.playerStatus === 'injured' || j.playerStatus === 'suspended' || (o && o.estado === 'injured')) p = 0;
    out[j.id] = { id: j.id, nombre: j.nickname, pos: POS[j.positionId], p: Math.min(0.97, p), duda, estado: j.playerStatus, ff: !!ff, tit: !!(o && o.titular) };
  });
  return out;
}

/**
 * El posible once: { formacion: '4-3-3', once: [...] }. Con once probable, sus titulares (los que pueden jugar) entran siempre y
 * se queda la formación que más de ellos mete; los huecos, con los de más %. Sin él, la formación que más % suma.
 * (Carlos, 3 nov 11:52: salían en el once jugadores con un 30-40 %.)
 */
export function elegirOnce(probs) {
  const xs = Object.values(probs);
  const fijo = (x) => x.tit && x.p > 0;
  const por = (pos) => xs.filter((x) => x.pos === pos).sort((a, b) => Number(fijo(b)) - Number(fijo(a)) || b.p - a.p);
  const [P, D, M, F] = ['POR', 'DEF', 'MED', 'DEL'].map(por);
  let mejor = null;
  for (const [d, m, f] of FORMACIONES) {
    if (D.length < d || M.length < m || F.length < f || !P.length) continue;
    const once = [P[0], ...D.slice(0, d), ...M.slice(0, m), ...F.slice(0, f)];
    const suma = once.reduce((s, x) => s + x.p, 0);
    const puntos = once.filter(fijo).length * 10 + suma;
    if (!mejor || puntos > mejor.puntos + 1e-9) mejor = { puntos, suma, formacion: `${d}-${m}-${f}`, once };
  }
  return mejor;
}
