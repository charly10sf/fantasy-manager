// Cómo marca cada jugador (Carlos, 7 nov, tras el gol de Valverde: «que la IA conozca al jugador»). Dos fuentes:
//  - AQUÍ, contadores calculados con los datos de FotMob de cada partido acabado de Liga, Champions y Copa del Rey: goles, de lejos
//    (20 m o más, sin penalti), de falta directa, de penalti y de cabeza, por competición. Se guardan en el registro
//    (`registro.datos.rasgos`) y se ponen al día cuando hay partidos acabados que aún no cuentan, nunca cientos de peticiones por vuelta.
//  - A mano, `rasgos: [...]` de cada jugador en lib/apodos-jugadores.mjs, con fuente y aprobados por Carlos; pasan a los hechos como `suEstilo`.
// OJO con el alcance: no entran la Europa League, la Conference ni la Supercopa, así que «primer gol del curso» solo vale para estas
// tres competiciones y los hechos lo dicen (`alcanceDeLosContadores`).
import { norm } from './texto.mjs';
import { comparten } from './relato.mjs';
import { LIGAS } from './fotmob.mjs';

export const COMPETICIONES = [['liga', LIGAS.liga, 'Liga'], ['champions', LIGAS.champions, 'Champions'], ['copa', LIGAS.copa, 'Copa del Rey']];
export const LEJOS_M = 20;
// cada competición de un jugador: [goles (con penaltis, sin autogoles), de lejos (sin penalti), de falta directa, de penalti, de cabeza]
const vacio = () => [0, 0, 0, 0, 0];
const sumaGol = (a, g) => {
  a[0]++;
  if (g.penalti) a[3]++;
  else {
    if (g.distancia != null && g.distancia >= LEJOS_M) a[1]++;
    if (g.situacion === 'FreeKick') a[2]++;
  }
  if (g.tiro === 'Header') a[4]++;
};

export const estadoDe = (registro) => (registro.datos.rasgos ||= { vistos: [], equipos: [], base: false, jugadores: {} });

/** suma los goles de un partido acabado de FotMob (`det`, de `leerDetalle`) a los contadores. `nombres`: { local, visitante } */
export function sumarPartido(R, det, comp, nombres) {
  for (const g of det.goles) {
    if (g.propia || !g.jugadorId) continue;
    const e = (R.jugadores[g.jugadorId] ||= { n: g.jugador, e: g.esLocal ? nombres.local : nombres.visitante, g: {} });
    sumaGol(e.g[comp] ||= vacio(), g);
  }
}

/**
 * Pone al día los contadores. La primera vez (`base` falso) baja todo lo acabado del curso en las tres competiciones, `max` partidos
 * por ejecución (el resto, en las siguientes); después, solo los partidos acabados de los días de `fechas` que aún no cuentan.
 * Solo cuentan los partidos de clubes de LaLiga. Devuelve cuántos partidos nuevos ha contado.
 */
export async function ponerAlDia({ fm, registro, fechas = [], log = () => {}, max = 60, hasta = Date.now() + 15000 } = {}) {
  if (!fm || !registro || !registro.datos) return 0;
  const R = estadoDe(registro);
  const vistos = new Set(R.vistos);
  const pendientes = [];   // { id, comp, nombres }
  const nombreDe = (m) => ({ local: m.home && m.home.name, visitante: m.away && m.away.name });
  if (!R.base) {
    const liga = await fm.calendario(LIGAS.liga);
    if (!liga) return 0;
    R.equipos = [...new Set(liga.flatMap((m) => [m.home && m.home.id, m.away && m.away.id]).filter(Boolean).map(String))];
    const eq = new Set(R.equipos);
    for (const [comp, id] of COMPETICIONES) {
      const cal = comp === 'liga' ? liga : await fm.calendario(id);
      if (!cal) return 0;   // sin una de las listas no se da la base por buena
      for (const m of cal) if (m.status && m.status.finished && !m.status.cancelled && (eq.has(String(m.home.id)) || eq.has(String(m.away.id))) && !vistos.has(String(m.id))) pendientes.push({ id: String(m.id), comp, nombres: nombreDe(m) });
    }
  } else {
    const eq = new Set(R.equipos);
    for (const f of fechas) {
      for (const [comp, id] of COMPETICIONES) {
        for (const m of await fm.partidosDelDia(f, [id])) if (m.status && m.status.finished && !m.status.cancelled && (eq.has(String(m.home.id)) || eq.has(String(m.away.id))) && !vistos.has(String(m.id))) pendientes.push({ id: String(m.id), comp, nombres: nombreDe(m) });
      }
    }
  }
  let nuevos = 0, fallos = 0;
  for (let i = 0; i < pendientes.length && nuevos + fallos < max && Date.now() < hasta; i += 6) {
    const lote = pendientes.slice(i, Math.min(i + 6, i + (max - nuevos - fallos)));
    const dets = await Promise.all(lote.map((p) => fm.detalle(p.id)));
    lote.forEach((p, k) => {
      const det = dets[k];
      if (!det || !det.acabado) { fallos++; return; }
      sumarPartido(R, det, p.comp, p.nombres);
      R.vistos.push(p.id); nuevos++;
    });
  }
  if (!R.base && nuevos + fallos >= pendientes.length && !fallos) R.base = true;
  if (nuevos || pendientes.length) log(`  (rasgos) contadores: ${nuevos} partidos nuevos contados${fallos ? `, ${fallos} sin poder` : ''}${R.base ? '' : `, faltan ${Math.max(0, pendientes.length - nuevos - fallos)} para tener todo el curso`}; ${Object.keys(R.jugadores).length} jugadores con goles`);
  if (registro.fichero && nuevos) registro.guardar();
  return nuevos;
}

const total = (e, i) => Object.values((e && e.g) || {}).reduce((s, a) => s + (a[i] || 0), 0);
const porComp = (e) => Object.fromEntries(COMPETICIONES.map(([k, , n]) => [n, ((e && e.g && e.g[k]) || [])[0] || 0]).filter(([, v]) => v > 0));
const ultima = (n) => norm(n).split(' ').filter(Boolean).pop() || '';

/**
 * Lo que llevan contado de un jugador: por su id de FotMob o, si no, por su nombre dentro de su club (uno solo con ese apellido).
 * { goles, lejos, falta, penalti, cabeza, porCompeticion } o null si no se sabe (sin base, o sin forma de identificarlo). Con la base ya
 * completa, un jugador sin goles da ceros.
 */
export function contadorDe(registro, { id = null, nombre = '', equipo = '' } = {}) {
  const R = registro && registro.datos && registro.datos.rasgos;
  if (!R || !R.base) return null;
  let e = id != null ? R.jugadores[String(id)] : null;
  let conocido = id != null;
  if (!e && nombre) {
    const ap = ultima(nombre);
    const c = Object.values(R.jugadores).filter((x) => ultima(x.n) === ap && (!equipo || comparten(x.e, equipo)));
    if (c.length === 1) { e = c[0]; conocido = true; }
  }
  if (!e && !conocido) return null;
  return { goles: total(e, 0), lejos: total(e, 1), falta: total(e, 2), penalti: total(e, 3), cabeza: total(e, 4), porCompeticion: porComp(e) };
}

/** ¿ya cuenta este partido de FotMob en los contadores? (partidos acabados: sí; en juego: no) */
export const yaContado = (registro, idFotmob) => !!(idFotmob && registro && registro.datos && registro.datos.rasgos && registro.datos.rasgos.vistos.includes(String(idFotmob)));

/** suma (signo 1) o resta (signo -1) al contador los goles de FotMob de un jugador en un partido: se suman los de un partido EN JUEGO
    (hasta el gol que se cuenta, que aún no están en los contadores) y se restan los de uno ya contado que son posteriores a ese gol */
export function ajustarGoles(c, golesFm = [], signo = 1) {
  if (!c) return null;
  const o = { ...c, porCompeticion: { ...c.porCompeticion } };
  if (!golesFm.length) return o;
  const a = vacio();
  for (const g of golesFm) sumaGol(a, g);
  o.goles += signo * a[0]; o.lejos += signo * a[1]; o.falta += signo * a[2]; o.penalti += signo * a[3]; o.cabeza += signo * a[4];
  o.porCompeticion.Liga = Math.max(0, (o.porCompeticion.Liga || 0) + signo * a[0]);
  if (!o.porCompeticion.Liga) delete o.porCompeticion.Liga;
  return o;
}

/** partido en juego sin FotMob: solo el total de goles (el de ESPN) y nada de lejos ni de falta, que no se sabe */
export function conGolesEspn(c, golesEspn = 0) {
  if (!c) return null;
  const o = { ...c, porCompeticion: { ...c.porCompeticion } };
  o.goles += golesEspn; o.porCompeticion.Liga = (o.porCompeticion.Liga || 0) + golesEspn;
  return o;
}

/** lo que va a los hechos del jugador: solo lo que cuenta algo (un primer gol, dos de lejos, uno de falta, dos penaltis, tres de cabeza); null si nada */
export function hechosDeTemporada(c) {
  if (!c || !(c.goles >= 1)) return null;
  // «lleva 2 goles» a secas no cuenta nada: solo el primero, los de un estilo (lejos, falta, penalti, cabeza) o una cifra que llame la atención
  if (!(c.goles === 1 || c.goles >= 3 || c.lejos >= 2 || c.falta >= 1 || c.penalti >= 2 || c.cabeza >= 3)) return null;
  const h = {};
  if (c.goles === 1) h.esSuPrimerGolEnLigaChampionsOCopa = true;
  else h.golesEnLigaChampionsYCopa = c.goles;
  if (c.lejos >= 2) h.golesDeLejosEnLigaChampionsYCopa = c.lejos;
  if (c.falta >= 1) h.golesDeFaltaDirectaEnLigaChampionsYCopa = c.falta;
  if (c.penalti >= 2) h.penaltisMarcadosEnLigaChampionsYCopa = c.penalti;
  if (c.cabeza >= 3) h.golesDeCabezaEnLigaChampionsYCopa = c.cabeza;
  if (Object.keys(c.porCompeticion).length > 1) h.golesPorCompeticion = c.porCompeticion;
  return { ...h, alcanceDeLosContadores: 'solo Liga, Champions y Copa del Rey (no cuenta la Europa League, la Conference ni la Supercopa); «de lejos» son los de 20 m o más, sin penaltis' };
}

/** las cifras de esos hechos, para la lista de números que acepta el validador */
export const cifrasDeTemporada = (h) => (h ? Object.entries(h).flatMap(([k, v]) => (typeof v === 'number' ? [v] : k === 'golesPorCompeticion' ? Object.values(v) : [])) : []);
