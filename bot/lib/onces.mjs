// Posible once de un equipo: % de titularidad como el de la app (`M.titularidad`): el once probable de las webs de previas
// (peso 0,5, lib/ff.mjs; desde el 3 nov), los partidos de 60' o más de las últimas 5 jornadas (0,3) y de la temporada (0,2),
// sacados de las fichas de LaLiga (`baseTitular` de tipos/caidas.mjs); lesionado o sancionado: 0; duda: ×0,6. Si la página
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
  del.forEach((j, i) => {
    const b = fs[i] && !fs[i].error ? baseTitular(fs[i].playerStats, ultimaJugada) : null;
    const o = ff ? ff[j.id] || null : null;
    let p;
    if (ff) p = b ? 0.5 * pOnce(o) + 0.3 * b.a + 0.2 * b.b : pOnce(o);
    else p = b ? b.p : 0.15;
    const duda = j.playerStatus === 'doubtful' || (o && o.estado === 'doubtful');
    if (j.playerStatus === 'injured' || j.playerStatus === 'suspended' || (o && o.estado === 'injured')) p = 0;
    else if (duda) p *= 0.6;
    out[j.id] = { id: j.id, nombre: j.nickname, pos: POS[j.positionId], p: Math.min(0.97, p), duda, estado: j.playerStatus, ff: !!ff };
  });
  return out;
}

/** el posible once: { formacion: '4-3-3', once: [...], resto } */
export function elegirOnce(probs) {
  const por = (pos) => Object.values(probs).filter((x) => x.pos === pos).sort((a, b) => b.p - a.p);
  const [P, D, M, F] = ['POR', 'DEF', 'MED', 'DEL'].map(por);
  let mejor = null;
  for (const [d, m, f] of FORMACIONES) {
    if (D.length < d || M.length < m || F.length < f || !P.length) continue;
    const once = [P[0], ...D.slice(0, d), ...M.slice(0, m), ...F.slice(0, f)];
    const suma = once.reduce((s, x) => s + x.p, 0);
    if (!mejor || suma > mejor.suma + 1e-9) mejor = { suma, formacion: `${d}-${m}-${f}`, once };
  }
  return mejor;
}
