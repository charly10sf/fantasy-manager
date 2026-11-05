// La API de LaLiga Fantasy SIN token (probada el 2 nov 2026 desde GitHub Actions). No es pública ni documentada.
import { json } from './http.mjs';

const H = 'https://fantasy-api.llt-services.com';
const CAB = { headers: { 'x-app': '2' } };
export const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
export const ESTADOS = { injured: 'lesionado', doubtful: 'duda', suspended: 'sancionado', out_of_league: 'fuera de LaLiga' };

export const semanaActual = () => json(`${H}/api/v1/competition/1/week/current?x-lang=es`, CAB);
// CloudFront delante de la API guarda la lista de jugadores 8 h (cache-control max-age=28800) y el histórico de valor de cada uno
// 1 h (max-age=3600). Con la caché, el mercado del 4 y del 5 nov salió a las 00:46 y a las 00:56 en vez de a las 00:16 (Carlos,
// 5 nov 05:34: «casi a la 1»), y un cambio de estado (lesión, vuelta) podía llegar horas tarde. La caché del histórico va por la
// URL (un parámetro que cambia cada 10 s la salta); la de la lista, por la cabecera Origin (la URL no cuenta): un Origin que cambia
// cada 10 s. Comprobado el 5 nov: «Miss from cloudfront» con los dos, y la misma respuesta que la API.
const ya = () => Math.floor(Date.now() / 1e4);
export const jugadores = () => json(`${H}/api/v1/competition/1/players?x-lang=es`, { headers: { 'x-app': '2', Origin: `https://b${ya()}.fantasymanagerapp.com` } });
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

/** histórico de valor de un jugador: [{ marketValue, date }, …], un punto por día desde el 29 jun (sin token, probado el 2 nov) */
export const valorMercado = (id) => json(`${H}/api/v1/competition/1/player/${id}/market-value?x-lang=es&_=${ya()}`, CAB);

/** una foto o un escudo de LaLiga (PNG); solo de su servidor de imágenes. Guarda lo bajado durante la ejecución. */
const imagenes = new Map();
export async function imagen(url) {
  if (!url || !/^https:\/\/assets-fantasy\.llt-services\.com\//.test(url)) return null;
  if (!imagenes.has(url)) imagenes.set(url, (async () => {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const b = Buffer.from(await r.arrayBuffer());
    return r.status === 200 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG' ? b : null;
  })().catch(() => null));
  return imagenes.get(url);
}
