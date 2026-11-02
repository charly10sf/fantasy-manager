// Datos de las tarjetas a partir de la API de LaLiga (sin token, probado el 2 nov desde Actions): stats/week/{n} da el marcador
// y los puntos de cada jugador del partido (sin minutos); la ficha (player/{id}) da los minutos de cada jornada; market-value,
// el valor de cada día desde el 29 jun. Las fotos (256x256) y los escudos (78x105) son PNG públicos de assets-fantasy.
// Cada función devuelve { d, permitidos }: d es lo que se dibuja; permitidos, las cifras y palabras sacadas directamente de los
// datos crudos, con las que validarTarjeta comprueba que la imagen no lleva nada que no esté en ellos.
import { corto } from './texto.mjs';
import { num1, millones } from './tarjetas.mjs';

export const MIN_MINUTOS_PEOR = 30;     // «peores»: los que menos puntúan de los que jugaron 30' o más (con 0' no cuentan)
export const DIAS_VALOR = 30;           // la gráfica enseña los últimos 30 días de valor (Carlos, 2 nov 23:00: mejor 30 que 60)
export const DIAS_CAMBIO = 30;          // y el cambio, en esos mismos 30 días
const POS = { 1: 'Portero', 2: 'Defensa', 3: 'Centrocampista', 4: 'Delantero', 5: 'Entrenador' };
// palabras fijas de las tarjetas (todo lo demás tiene que salir de los datos)
export const PALABRAS_FIJAS = ['LALIGA', 'FANTASY', 'JORNADA', 'FINAL', 'MEJORES', 'PEORES', 'pts', 'MANAGER', 'Fantasyman_app', 'MVP', 'DOBLETE',
  'TRIPLETE', 'PUNTOS', 'EN', 'LA', 'TEMPORADA', 'DE', 'MEDIA', 'ÚLTIMAS', 'JORNADAS', 'VALOR', 'DÍAS', 'M', 'Sin', 'histórico', 'valor', 'GOL', 'ASISTENCIA', 'ROJA', 'PENALTI', 'FALLADO', ...Object.values(POS)];

const caraDe = (p) => p && p.images && p.images.transparent && p.images.transparent['256x256'];
const minutosEn = (ficha, n) => { const s = (ficha && ficha.playerStats || []).find((x) => Number(x.weekNumber) === Number(n)); return s ? Number((s.stats.mins_played || [0])[0]) : 0; };

/**
 * Tarjeta de final de un partido acabado de stats/week/{n}.
 * fuentes: { ficha(id) -> JSON de player/{id}, imagen(url) -> Buffer PNG o null }
 */
export const CUANTOS = 3;               // en la tarjeta del final, los 3 mejores y los 3 peores de cada equipo (Carlos, 2 nov 21:13)

export async function datosFinal(m, { jornada, fuentes, maxFichas = 25 }) {
  const lado = async (eq, goles) => {
    const ps = (eq.players || []).filter((p) => p.weekPoints != null).map((p) => ({ ...p, pts: Number(p.weekPoints) }));
    const desc = [...ps].sort((a, b) => b.pts - a.pts || Number(a.id) - Number(b.id));
    const mejores = desc.slice(0, CUANTOS);
    const ya = new Set(mejores.map((p) => String(p.id)));
    // los peores: de menos a más puntos, los que jugaron 30' o más; si no llegan a 3, se completan con los que jugaron algo
    const largos = [], cortos = [];
    let pedidas = 0;
    for (const p of [...desc].reverse()) {
      if (ya.has(String(p.id)) || largos.length >= CUANTOS || pedidas >= maxFichas) break;
      pedidas++;
      const min = minutosEn(await fuentes.ficha(p.id).catch(() => null), jornada);
      if (min >= MIN_MINUTOS_PEOR) largos.push({ ...p, min });
      else if (min > 0) cortos.push({ ...p, min });
    }
    const peores = [...largos, ...cortos].slice(0, CUANTOS).sort((a, b) => a.pts - b.pts);
    const ficha = async (p) => ({ id: p.id, nombre: p.nickname || p.name, pts: p.pts, cara: await fuentes.imagen(caraDe(p)).catch(() => null), min: p.min });
    return { nombre: eq.mainName, corto: corto(eq.mainName), goles, escudo: await fuentes.imagen(eq.badgeColor).catch(() => null),
      mejores: await Promise.all(mejores.map(ficha)), peores: await Promise.all(peores.map(ficha)) };
  };
  const d = { jornada, local: await lado(m.local, Number(m.localScore)), visitante: await lado(m.visitor, Number(m.visitorScore)) };
  // permitidos: el marcador, la jornada y los puntos y nombres de los jugadores de ESTE partido, más los nombres de los dos clubes
  const todos = [...(m.local.players || []), ...(m.visitor.players || [])];
  const permitidos = {
    numeros: [jornada, m.localScore, m.visitorScore, ...todos.map((p) => p.weekPoints)].map(String),
    palabras: [m.local.mainName, m.visitor.mainName, corto(m.local.mainName), corto(m.visitor.mainName), ...todos.map((p) => p.nickname || p.name)],
  };
  return { d, permitidos };
}

/**
 * Tarjeta de un jugador. j: el jugador de la lista de LaLiga (players); m: el partido de stats/week/{n} del que se habla;
 * motivo: 'mvp' | 'doblete' | 'triplete' | 'gol' | 'asistencia' | 'roja' | 'penalti'. fuentes: { valor(id) -> lista de market-value, imagen(url) }
 */
export async function datosJugador(j, m, { jornada, motivo = 'mvp', fuentes, ahora = Date.now(), marcador: goles = null }) {
  // en directo, el marcador de ESPN (va al momento); si no, el de LaLiga
  const [gl, gv] = goles || [m.localScore, m.visitorScore];
  const enPartido = [...(m.local.players || []), ...(m.visitor.players || [])].find((p) => String(p.id) === String(j.id));
  const club = String(m.local.id) === String(j.teamId) ? m.local : m.visitor;
  const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
  const marcador = `${L} ${gl}-${gv} ${V}`;
  const etiqueta = `${{ mvp: 'MVP', doblete: '¡DOBLETE!', triplete: '¡TRIPLETE!', gol: 'GOL', asistencia: 'ASISTENCIA', roja: 'ROJA', penalti: 'PENALTI FALLADO' }[motivo] || 'MVP'} · ${marcador}`;
  const wp = new Map((j.weekPoints || []).map((w) => [Number(w.weekNumber), Number(w.points)]));
  const ultimas = [];
  for (let k = Math.max(1, jornada - 4); k <= jornada; k++) ultimas.push([k, wp.has(k) ? wp.get(k) : 0]);
  const ptsJornada = enPartido && enPartido.weekPoints != null ? Number(enPartido.weekPoints) : (wp.get(jornada) || 0);
  // valor: un punto por día, los últimos 30; el cambio, entre el primer y el último punto de esa ventana
  const crudo = await fuentes.valor(j.id).catch(() => null);
  const serie = (Array.isArray(crudo) ? crudo : []).map((v) => [Date.parse(v.date), Number(v.marketValue)]).filter(([t, v]) => t && v).sort((a, b) => a[0] - b[0]);
  const valor = serie.filter(([t]) => t >= ahora - DIAS_VALOR * 864e5);
  const hoy = serie.length ? serie[serie.length - 1] : [ahora, Number(j.marketValue)];
  // la base del cambio: el último punto de hace 30 días o más; si no hay (histórico corto), el primero de la ventana
  const antes = [...serie].reverse().find(([t]) => t <= hoy[0] - DIAS_CAMBIO * 864e5) || valor[0];
  const cambio = antes ? Math.round((hoy[1] - antes[1]) / antes[1] * 100) : 0;
  const d = {
    jornada, etiqueta, nombre: j.nickname, posicion: POS[j.positionId] || '',
    club: { nombre: club.mainName, corto: corto(club.mainName), escudo: await fuentes.imagen(club.badgeColor).catch(() => null) },
    cara: await fuentes.imagen(j.image || caraDe(enPartido)).catch(() => null),
    ptsJornada, total: Number(j.points), media: Number(j.averagePoints), ultimas, valor, valorHoy: hoy[1], cambio, dias: DIAS_VALOR,
  };
  // permitidos, otra vez desde los datos crudos: sus puntos por jornada (y 0 para las que no tiene), total, media, el marcador,
  // la jornada y sus números, el valor de hoy y el cambio recalculado aquí
  const semanas = [];
  for (let k = Math.max(1, jornada - 4); k <= jornada; k++) semanas.push(k);
  const vHoy = serie.length ? serie[serie.length - 1][1] : Number(j.marketValue);
  const vAntes = antes ? antes[1] : null;
  const permitidos = {
    numeros: [jornada, gl, gv, 0, j.points, num1(j.averagePoints), ...(j.weekPoints || []).map((w) => w.points), ...semanas,
      millones(vHoy).replace(' M', ''), vAntes ? Math.abs(Math.round((vHoy - vAntes) / vAntes * 100)) : 0, DIAS_VALOR, enPartido ? enPartido.weekPoints : 0].map(String),
    palabras: [j.nickname, club.mainName, corto(club.mainName), L, V, POS[j.positionId] || ''],
  };
  return { d, permitidos };
}
