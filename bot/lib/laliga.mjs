// La API de LaLiga Fantasy SIN token (probada el 2 nov 2026 desde GitHub Actions). No es pública ni documentada.
import { json } from './http.mjs';

const H = 'https://fantasy-api.llt-services.com';
const CAB = { headers: { 'x-app': '2' } };
export const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
export const ESTADOS = { injured: 'lesionado', doubtful: 'duda', suspended: 'sancionado', out_of_league: 'fuera de LaLiga' };

export const semanaActual = () => json(`${H}/api/v1/competition/1/week/current?x-lang=es`, CAB);
export const jugadores = () => json(`${H}/api/v1/competition/1/players?x-lang=es`, CAB);
export const statsSemana = (n) => json(`${H}/stats/v1/competition/1/stats/week/${n}?x-lang=es`, CAB);
export const ficha = (id) => json(`${H}/api/v1/competition/1/player/${id}?x-lang=es`, CAB);

/** { teamId: nombre } a partir de las estadísticas de una jornada */
export function equiposDe(stats) {
  const m = {};
  for (const p of stats) for (const lado of [p.local, p.visitor]) if (lado && lado.id != null) m[String(lado.id)] = lado.mainName;
  return m;
}

/** puntos de las últimas jornadas de un jugador: [[semana, pts], …] de la lista de jugadores */
export const rachaDe = (j, k = 3) => (j.weekPoints || []).slice().sort((a, b) => a.weekNumber - b.weekNumber).slice(-k).map((w) => [w.weekNumber, w.points]);
