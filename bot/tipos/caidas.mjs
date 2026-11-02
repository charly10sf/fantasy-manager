// Caídas probables de la jornada que viene: titulares habituales con baja o duda (Carlos, 2 nov 16:16: «es probable que no vaya a jugar»).
// % de titularidad parcial: minutos de las últimas jornadas (peso 0,3) y partidos de más de 60' de la temporada (0,2), sin el once probable
// de futbolfantasy (0,5, aún no portado); doblado a ×0,6 si es duda; 0 si está lesionado o sancionado.
import { cierre, quepa, armar, corto, elegir, fmt, partes } from '../lib/texto.mjs';
import { ficha, ESTADOS } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';

export function baseTitular(playerStats, hasta) {
  const s = (playerStats || []).filter((x) => x.weekNumber <= hasta && x.stats && x.stats.mins_played).sort((a, b) => a.weekNumber - b.weekNumber);
  if (s.length < 3) return null;
  const min = (x) => Number(x.stats.mins_played[0]) || 0;
  const ult = s.slice(-5);
  const a = ult.filter((x) => min(x) >= 60).length / ult.length;
  const b = s.filter((x) => min(x) >= 60).length / s.length;
  return { p: (0.3 * a + 0.2 * b) / 0.5, ult: ult.length, temporada: s.length };
}

export async function generar({ jugadores, equipos, jornada, ultimaJugada, config, stats, forzar }) {
  // Mientras queden partidos de la jornada en curso, el estado de cada jugador (lesión, duda, sanción) es el de ese partido:
  // las caídas de la siguiente jornada se calculan cuando acaba la actual.
  const pendientes = (stats || []).filter((m) => m.matchState !== 7).length;
  if (pendientes && !forzar) { console.log(`  (caídas) esperando: quedan ${pendientes} partido(s) de la jornada ${ultimaJugada}`); return []; }
  const malos = jugadores
    .filter((j) => ESTADOS[j.playerStatus] && j.playerStatus !== 'out_of_league' && j.positionId >= 1 && j.positionId <= 4)
    .sort((a, b) => Number(b.marketValue) - Number(a.marketValue))
    .slice(0, 36);
  const fichas = await enParalelo(malos, 5, (j) => ficha(j.id));
  const caidas = [];
  malos.forEach((j, i) => {
    const f = fichas[i];
    if (!f || f.error) return;
    const b = baseTitular(f.playerStats, ultimaJugada);
    if (!b || b.p < 0.6) return;                      // solo titulares habituales
    const p = j.playerStatus === 'doubtful' ? b.p * 0.6 : 0;
    if (p >= config.umbralCaida) return;
    caidas.push({ id: j.id, nombre: j.nickname, equipo: corto(equipos[String(j.teamId)] || '?'), estado: ESTADOS[j.playerStatus], pct: Math.round(p * 100), media: Number(j.averagePoints) || 0 });
  });
  const out = [];
  for (let k = 0; k < caidas.length; k += 4) {
    const grupo = caidas.slice(k, k + 4);
    const cab = elegir([`🚨 LaLiga Fantasy J${jornada} · Ojo con las bajas`, `🚑 LaLiga Fantasy J${jornada} · Estos pueden caerse del once`, `⚠️ LaLiga Fantasy J${jornada} · Posibles caídas, mira tu once`], `caidas${jornada}${k}`);
    const pie = cierre(`caidas${jornada}${k}`);
    const intro = elegir(['Si tienes a alguno en el once, ve pensando en el cambio:', 'Revisa tu alineación, que estos lo tienen difícil:', 'Alguno de estos es titular fijo y ahora mismo no cuenta:'], `intro${jornada}${k}`);
    const lineas = grupo.map((c) => {
      const que = c.estado === 'duda' ? `duda (titular ${c.pct}%)` : c.estado;
      return `${c.estado === 'sancionado' ? '🟥' : c.estado === 'duda' ? '❓' : '🤕'} ${c.nombre} (${c.equipo}) · ${que}${c.media >= 3 ? ` · media ${fmt(c.media)}` : ''}`;
    });
    const usadas = quepa(cab, [intro, ...lineas], pie);
    if (usadas.length < 3) continue;
    const quienes = grupo.slice(0, usadas.length - 1);
    const num = [jornada, ...quienes.flatMap((c) => [c.pct, ...(c.media >= 3 ? partes(c.media) : [])])];
    out.push({ tipo: 'caidas', clave: `caidas|${jornada}|${quienes.map((c) => c.id).join('-')}`, jornada, texto: armar(cab, usadas, pie), numeros: num });
  }
  return out;
}
