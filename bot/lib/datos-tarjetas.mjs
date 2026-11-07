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
  'TRIPLETE', 'PUNTOS', 'EN', 'LA', 'TEMPORADA', 'DE', 'MEDIA', 'ÚLTIMAS', 'JORNADAS', 'VALOR', 'DÍAS', 'M', 'Sin', 'histórico', 'valor', 'GOL', 'ASISTENCIA', 'ROJA', 'PENALTI', 'FALLADO', 'PARADO', 'LOS', 'DEL', 'POSIBLES', 'ONCES', 'CONFIRMADOS', 'VS', 'POR', 'DEF', 'MED', 'DUDA', 'PTS', 'TOTALES', 'LAS', 'ENT', ...Object.values(POS)];

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
 * motivo: 'mvp' | 'doblete' | 'triplete' | 'gol' | 'asistencia' | 'roja' | 'penalti' | 'parada'. fuentes: { valor(id) -> lista de market-value, imagen(url) }
 */
export async function datosJugador(j, m, { jornada, motivo = 'mvp', fuentes, ahora = Date.now(), marcador: goles = null }) {
  // en directo, el marcador de ESPN (va al momento); si no, el de LaLiga
  const [gl, gv] = goles || [m.localScore, m.visitorScore];
  const enPartido = [...(m.local.players || []), ...(m.visitor.players || [])].find((p) => String(p.id) === String(j.id));
  const club = String(m.local.id) === String(j.teamId) ? m.local : m.visitor;
  const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
  const marcador = `${L} ${gl}-${gv} ${V}`;
  const etiqueta = `${{ mvp: 'MVP', doblete: '¡DOBLETE!', triplete: '¡TRIPLETE!', gol: 'GOL', asistencia: 'ASISTENCIA', roja: 'ROJA', penalti: 'PENALTI FALLADO', parada: 'PENALTI PARADO' }[motivo] || 'MVP'} · ${marcador}`;
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

/**
 * Lo que la carta de un jugador enseña además de su estado (Carlos, 3 nov 11:24: en la de un lesionado, «sus últimas jornadas y el
 * valor que tiene»): las 5 últimas jornadas que ya tienen puntos (hasta `jornada`), total, media y valor de los últimos 30 días.
 * Devuelve { d, numeros } (numeros: lo que la imagen puede escribir, sacado de los datos crudos).
 */
export async function historialJugador(j, { jornada, fuentes, ahora = Date.now() }) {
  const wp = new Map((j.weekPoints || []).map((w) => [Number(w.weekNumber), Number(w.points)]));
  const conDatos = [...wp.keys()].filter((k) => k <= jornada);
  const hasta = conDatos.length ? Math.max(...conDatos) : jornada;
  const ultimas = [];
  for (let k = Math.max(1, hasta - 4); k <= hasta; k++) ultimas.push([k, wp.has(k) ? wp.get(k) : 0]);
  const crudo = await fuentes.valor(j.id).catch(() => null);
  const serie = (Array.isArray(crudo) ? crudo : []).map((v) => [Date.parse(v.date), Number(v.marketValue)]).filter(([t, v]) => t && v).sort((a, b) => a[0] - b[0]);
  const hoy = serie.length ? serie[serie.length - 1] : [ahora, Number(j.marketValue)];
  const valor = serie.filter(([t]) => t >= hoy[0] - DIAS_VALOR * 864e5);
  const antes = [...serie].reverse().find(([t]) => t <= hoy[0] - DIAS_CAMBIO * 864e5) || valor[0];
  const cambio = antes ? Math.round((hoy[1] - antes[1]) / antes[1] * 100) : 0;
  const d = { ultimas, total: Number(j.points), media: Number(j.averagePoints), valor, valorHoy: hoy[1], cambio, dias: DIAS_VALOR };
  const numeros = [0, j.points, num1(j.averagePoints), ...ultimas.flat(), millones(hoy[1]).replace(' M', ''), Math.abs(cambio), DIAS_VALOR].map(String);
  return { d, numeros };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de bajas y novedades (caídas y novedades). Recibe a los jugadores ya elegidos por el tipo, cada uno con
// { id, nombre, teamId, pos, equipo (corto), club (largo), estado ('lesionado'|'sancionado'|'duda'|'disponible'|'vuelve'), pct, media, caraUrl, escudoUrl }.
// Si todos son del mismo club, la tarjeta es la de ese equipo (con su próximo rival, pp de proximoPartido); si no, la lista.
export const esBuena = (f) => f.estado === 'disponible' || f.estado === 'vuelve';
export function tarjetaBajas({ jornada, filas: todas, pp = null, clave }) {
  // (Carlos, 3 nov 10:25: «BAJAS» con jugadores «DISPONIBLE» no tiene sentido; 5 nov 07:08: y en «NOVEDADES», que va en verde, solo
  // cosas buenas) una tarjeta lleva o solo buenas (NOVEDADES) o solo malas: si llegan mezcladas, se queda con las malas. Las novedades
  // con buenas y malas noticias piden dos (tarjetasNovedades)
  const filas = todas.every(esBuena) ? todas : todas.filter((f) => !esBuena(f));
  const mismo = filas.length && filas.every((f) => String(f.teamId) === String(filas[0].teamId));
  const conMedia = (f) => (f.media >= 3 && f.estado !== 'duda' ? num1(f.media) : null);
  const titulo = filas.every(esBuena) ? 'NOVEDADES' : filas.every((f) => f.estado === 'sancionado') && filas.length > 1 ? 'SANCIONADOS'
    : filas.some((f) => f.estado === 'duda') ? (filas.every((f) => f.estado === 'duda') ? 'DUDAS' : 'BAJAS Y DUDAS') : 'BAJAS';
  const fila = (f) => ({ id: f.id, nombre: f.nombre, equipo: f.equipo, club: f.club, teamId: f.teamId, posicion: POS[f.pos] || '', caraUrl: f.caraUrl || null, escudoUrl: f.escudoUrl || null,
    estado: f.estado, leve: !!f.leve, pct: f.estado === 'duda' || esBuena(f) ? (f.pct ?? null) : null, media: conMedia(f), valor: f.valor || null });
  const d = { jornada: pp ? pp.jornada : jornada, titulo, filas: filas.slice(0, mismo ? 4 : 6).map(fila),
    equipo: mismo ? { nombre: filas[0].club, corto: filas[0].equipo, escudoUrl: filas[0].escudoUrl || null } : null,
    rival: mismo && pp ? { nombre: pp.rivalNombre || pp.rival, corto: pp.rival, escudoUrl: pp.rivalEscudo || null } : null };
  const permitidos = {
    numeros: [d.jornada, ...d.filas.flatMap((f) => [f.pct, f.media].filter((x) => x != null))].map(String),
    palabras: ['BAJAS', 'Y', 'DUDAS', 'NOVEDADES', 'SANCIONADOS', 'DUDA LEVE', 'LEVE', 'LESIONADO', 'SANCIONADO', 'DISPONIBLE', 'VUELVE', 'PRÓXIMO', 'RIVAL', 'TITULARIDAD',
      ...d.filas.flatMap((f) => [f.nombre, f.equipo, f.club]), ...(d.equipo ? [d.equipo.corto, d.equipo.nombre] : []), ...(d.rival ? [d.rival.corto] : [])],
  };
  return { tipo: 'bajas', nombre: `bajas-${clave.replace(/[^\w-]+/g, '_').slice(0, 80)}`, d, permitidos };
}
// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de apercibidos (Carlos, 5 nov 08:14: el tweet los nombraba a todos seguidos y se veía todo junto; mejor una imagen con los
// jugadores separados por equipo). Recibe a los apercibidos que ha elegido sancionados.mjs, de más a menos importantes, cada uno con
// { id, nombre, teamId, pos, equipo (corto), club (largo), media, caraUrl, escudoUrl }. Los equipos salen en el orden de su primer jugador.
export function tarjetaApercibidos({ jornada, filas, clave }) {
  const equipos = [];
  for (const f of filas) {
    let e = equipos.find((x) => String(x.teamId) === String(f.teamId));
    if (!e) equipos.push(e = { teamId: f.teamId, nombre: f.club, corto: f.equipo, escudoUrl: f.escudoUrl || null, jugadores: [] });
    e.jugadores.push({ id: f.id, nombre: f.nombre, posicion: POS[f.pos] || '', media: f.media > 0 ? num1(f.media) : null, caraUrl: f.caraUrl || null });
  }
  const d = { jornada, equipos };
  const permitidos = {
    numeros: [jornada, ...equipos.flatMap((e) => e.jugadores.map((j) => j.media).filter((x) => x != null))].map(String),
    palabras: ['APERCIBIDOS', 'A', 'UNA', 'AMARILLA', 'DE', 'LA', 'SANCIÓN', 'MEDIA', ...Object.values(POS),
      ...equipos.flatMap((e) => [e.corto, e.nombre, ...e.jugadores.map((j) => j.nombre)])],
  };
  return { tipo: 'apercibidos', nombre: clave.replace(/[^\w-]+/g, '_').slice(0, 80), d, permitidos };
}

/** las de unas novedades: si hay buenas y malas noticias, dos tarjetas (la verde, solo con los que vuelven, y la de bajas); si no, una.
    `ppDe(filas)` da el próximo partido si todas son del mismo club */
export function tarjetasNovedades({ jornada, filas, ppDe = () => null, clave }) {
  const buenas = filas.filter(esBuena), malas = filas.filter((f) => !esBuena(f));
  if (!buenas.length || !malas.length) return tarjetaBajas({ jornada, filas, pp: ppDe(filas), clave });
  return [tarjetaBajas({ jornada, filas: buenas, pp: ppDe(buenas), clave: `${clave}-buenas` }), tarjetaBajas({ jornada, filas: malas, pp: ppDe(malas), clave: `${clave}-malas` })];
}
