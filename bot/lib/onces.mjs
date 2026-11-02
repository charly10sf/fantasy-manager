// Posible once de un equipo con los datos de LaLiga (sin token): % de titularidad de la app a partir de los minutos de cada jugador
// (últimas 5 jornadas y temporada, `baseTitular` de tipos/caidas.mjs) y su estado (lesionado o sancionado: 0; duda: ×0,6).
// No lleva aún el once probable de futbolfantasy (peso 0,5 en la app): es la parte que sale solo de los datos de LaLiga.
import { ficha } from './laliga.mjs';
import { enParalelo } from './http.mjs';
import { baseTitular } from '../tipos/caidas.mjs';

const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
// formaciones que se prueban: se queda la que más suma de % (defensas, medios, delanteros)
const FORMACIONES = [[4, 3, 3], [4, 4, 2], [4, 5, 1], [3, 5, 2], [3, 4, 3], [5, 3, 2], [5, 4, 1]];
const fichas = new Map();
const fichaDe = (id) => { if (!fichas.has(id)) fichas.set(id, ficha(id).catch(() => null)); return fichas.get(id); };

/** { [idJugador]: { id, nombre, pos, p (0-1), duda, estado } } de los jugadores de un equipo (los 20 de más valor) */
export async function probabilidades(teamId, jugadores, ultimaJugada) {
  const del = jugadores.filter((j) => String(j.teamId) === String(teamId) && Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && j.playerStatus !== 'out_of_league')
    .sort((a, b) => Number(b.marketValue) - Number(a.marketValue)).slice(0, 20);
  const fs = await enParalelo(del, 10, (j) => fichaDe(j.id));
  const out = {};
  del.forEach((j, i) => {
    const b = fs[i] && !fs[i].error ? baseTitular(fs[i].playerStats, ultimaJugada) : null;
    let p = b ? b.p : 0.15;
    if (j.playerStatus === 'injured' || j.playerStatus === 'suspended') p = 0;
    if (j.playerStatus === 'doubtful') p *= 0.6;
    out[j.id] = { id: j.id, nombre: j.nickname, pos: POS[j.positionId], p: Math.min(0.97, p), duda: j.playerStatus === 'doubtful', estado: j.playerStatus };
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
