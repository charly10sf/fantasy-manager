// Los hechos de un tuit para la IA que redacta (lib/redaccion.mjs): lo que ya está comprobado (de LaLiga, de la app, de la prensa
// clasificada), en un objeto sencillo. Todo lo que va aquí puede salir en el texto; lo que no está aquí, no (el validador lo mira).
// Cada tipo arma los suyos con estas piezas y los deja en `t.hechos`, junto a la plantilla de siempre, que queda de respaldo.
import { fmt, corto, el } from './texto.mjs';
import { puesto, cuando } from './redactar.mjs';
import { nombresClub } from './redaccion.mjs';
import { comoLeLlaman } from './apodos-jugadores.mjs';

// el campo de cada club (solo los seguros: el del Betis cambia mientras se reforma el Villamarín y no va). La IA solo puede nombrar el
// del que juega en casa (el validador no deja pasar un nombre propio que no esté en los hechos)
export const ESTADIOS = { 'Real Madrid': 'el Santiago Bernabéu', 'Atlético': 'el Metropolitano', 'Athletic': 'San Mamés', 'Valencia': 'Mestalla',
  'Sevilla': 'el Sánchez-Pizjuán', 'Real Sociedad': 'Anoeta', 'Villarreal': 'La Cerámica', 'Celta': 'Balaídos', 'Osasuna': 'El Sadar', 'Getafe': 'el Coliseum',
  'Rayo': 'Vallecas', 'Levante': 'el Ciutat de València', 'Elche': 'el Martínez Valero', 'Alavés': 'Mendizorroza', 'Mallorca': 'Son Moix', 'Girona': 'Montilivi',
  'Oviedo': 'el Carlos Tartiere', 'Racing': 'El Sardinero', 'Deportivo': 'Riazor', 'Málaga': 'La Rosaleda' };
export const estadio = (local) => { const e = ESTADIOS[corto(local || '')]; return e ? { estadio: e } : {}; };

/** { [club]: { nombres: [...], emoji } } de los clubes que salen en el tuit */
export function clubes(...eqs) {
  const o = {};
  for (const e of eqs.flat().filter(Boolean)) { const c = corto(e); if (!o[c]) o[c] = nombresClub(c); }
  return o;
}

/** lo que marca o encaja el rival y si le viene bien o mal a ese puesto (solo si está entre los 4 primeros o los 4 últimos) */
export function golesRival(riv, posId, rival) {
  if (!riv) return null;
  const atras = Number(posId) <= 2;
  const k = atras ? 'gf' : 'gc', rk = riv[`r${k}`];
  const mucho = rk <= 4, poco = rk >= riv.n - 3;
  if (!mucho && !poco) return null;
  const que = atras ? (mucho ? 'de los que más marcan' : 'de los que menos marcan') : (mucho ? 'de los que más encajan' : 'de los que menos encajan');
  const bueno = atras ? poco : mucho;
  return { rival: el(rival), dato: `${que}: ${fmt(riv[k])} ${atras ? 'marcados' : 'encajados'} por partido`, paraEste: bueno ? 'le viene bien' : 'le viene mal' };
}

/** el partido que viene: rival, casa o fuera, cuándo, puesto y dificultad del rival (y sus goles si destacan) */
export function partido(pp, { equipo, riv = null, posId = null, ahora = Date.now() } = {}) {
  if (!pp) return null;
  const c = pp.fecha ? cuando(pp.fecha, ahora) : null;
  const local = pp.enCasa ? equipo : pp.rival, visitante = pp.enCasa ? pp.rival : equipo;
  return {
    jornada: pp.jornada, partido: `${local}-${visitante}`, local, visitante, ...estadio(local), juega: pp.enCasa ? 'en casa' : 'fuera', rival: el(pp.rival),
    ...(c ? { cuando: c.t } : {}), fecha: pp.fecha || null,
    // el equipo ya ha jugado hoy (8 nov, Barrenetxea): de ese partido no se habla como si viniera; el que viene es este
    ...(pp.hoy ? { yaJugoHoy: `contra ${el(pp.hoy.rival)}; ese partido ya se ha jugado: no digas que llega con dudas a él ni que es hoy. El que viene es este. Que se lesionó en el de hoy, solo si lo dice su motivo.` } : {}),
    ...(riv ? { rivalVa: `${riv.pos}º de ${riv.n}`, dificultad: riv.nivel } : {}),
    ...(riv && posId ? (() => { const g = golesRival(riv, posId, pp.rival); return g ? { golesRival: g } : {}; })() : {}),
  };
}

/** un jugador: nombre, puesto, club, estado (disponible, vuelve, duda, baja, lesionado, sancionado), media y % de la app */
export function jugador(j, { equipos = {}, estado = null, motivo = '', plazo = '', tit = null, principal = true, extra = {} } = {}) {
  const media = Number(j.averagePoints ?? j.media) || 0;
  return {
    nombre: j.nickname || j.nombre, puesto: puesto(j.positionId ?? j.pos) || undefined, club: corto(equipos[String(j.teamId)] || j.equipo || ''),
    ...(estado ? { estado } : {}), ...(motivo ? { motivo } : {}), ...(plazo ? { plazo } : {}),
    ...(media >= 1 ? { mediaPuntos: fmt(media) } : {}),
    ...(tit && tit.pct != null ? { titularidadFantasyManager: `${tit.pct} %` } : {}),
    ...(otrosNombres(j.nickname || j.nombre)), ...extra, principal,
  };
}
// otros nombres con los que se le conoce («Borja Iglesias» por «B. Iglesias», «el Cuti»; Carlos, 7 nov): la IA puede usarlos
const otrosNombres = (n) => { const xs = comoLeLlaman(n); return xs.length ? { tambienSeLeLlama: xs } : {}; };

/** la fuente de una noticia: el club o los medios (sin LaLiga Fantasy: el estado ya va en la etiqueta) */
export const fuente = ({ oficial = false, medios = [] } = {}) => (oficial ? 'lo ha comunicado el club' : medios.length ? `prensa: ${medios.join(', ')}` : null);

/** cómo quedan los puntos de hoy frente a su media, dicho con las palabras que valen (la IA no hace la cuenta: con 17 y 10 de media
    escribía «casi el doble» y el revisor lo tiraba; 7 nov) */
export function frenteMedia(pts, media) {
  const m = Number(media), p = Number(pts);
  if (!(m >= 1) || !Number.isFinite(p)) return null;
  const r = p / m;
  return r >= 3 ? 'más del triple de su media' : r >= 2 ? 'más del doble de su media' : r >= 1.75 ? 'casi el doble de su media'
    : r >= 1.3 ? 'muy por encima de su media' : r >= 1.1 ? 'por encima de su media' : r >= 0.9 ? 'en su media' : r >= 0.5 ? 'por debajo de su media' : 'muy por debajo de su media';
}
const HORA_MAD = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false });
/** «mediodía», «tarde» o «noche» según la hora de Madrid del saque (para «la noche fue de…»: el revisor tiraba «noche» sin dato) */
export function franja(fecha) {
  const t = Date.parse(fecha || '');
  if (!Number.isFinite(t)) return null;
  const h = Number(HORA_MAD.format(new Date(t)));
  return h < 15 ? 'mediodía' : h < 20 ? 'tarde' : 'noche';
}
