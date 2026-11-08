// Directo: goles (con asistente), rojas y penaltis fallados de ESPN (con minuto) casados con los puntos oficiales de LaLiga.
// Sin ventanas repite los partidos ya jugados de los días de fechasEspn (para probar); con ventanas, los de hoy en juego o recién acabados.
import { json } from '../lib/http.mjs';
import { norm, corto, fmt, partes, elegir, el, del, al } from '../lib/texto.mjs';
import { tweet, cap, segunda } from '../lib/redactar.mjs';
import { reconstruir, situacion, iba_perdiendo, minutoDe } from '../lib/relato.mjs';
import { clubes as clubesH, jugador as jugadorH, frenteMedia, estadio } from '../lib/hechos.mjs';
import { crearFotmob, casarPartido, casarGol, mismoNombre } from '../lib/fotmob.mjs';
import { golazoFotmob, golazoEspn, textoGolEspn } from '../lib/golazo.mjs';
import { ponerAlDia as ponerAlDiaRasgos, contadorDe, ajustarGoles, conGolesEspn, yaContado, hechosDeTemporada, cifrasDeTemporada } from '../lib/rasgos.mjs';
import { rasgosDe } from '../lib/apodos-jugadores.mjs';
import { nacionalidadFm, sinRepetidas } from '../lib/nacionalidad.mjs';
import { apuntarVista, completa, lineaMedida, apuntarSalud } from '../lib/fuentes-medida.mjs';
import { apuntarFuente, encolarAviso, FUENTE_PARTIDOS } from '../lib/salud.mjs';

/* ---- lo ya publicado que ESPN corrige (revisión total, A11) ----
   Cada gol y cada roja publicados llevan su huella en el registro (partido, equipo, minuto y añadido, jugador). Con ella:
   - el mismo gol con otro goleador (ESPN corrige el nombre: la clave lleva el nombre de ESPN y saldría como tuit nuevo) no se publica
     otra vez: se avisa a Carlos;
   - un gol o una roja publicados que ESPN deja de dar dos ejecuciones seguidas (VAR tardío, autogol, roja quitada) se avisan a
     Telegram con el id del tuit, para borrarlo o corregirlo a mano. Antes solo quedaba una línea en el log. */
const enlace = (id) => (id ? `https://x.com/i/web/status/${id}` : '(sin id)');
const minHuella = (h) => (h && h.min != null ? (h.extra ? `${h.min}+${h.extra}'` : `${h.min}'`) : '?');
/** el gol publicado de este partido y equipo en el mismo minuto y añadido, con otra clave (otro goleador); null si no hay */
export function mismoGolPublicado(registro, { partido, equipo, min, extra = 0, clave }) {
  if (!registro || !registro.datos) return null;
  return (registro.datos.enviados || []).find((e) => e.huella && e.huella.clase === 'gol' && e.clave !== clave && e.huella.partido === String(partido)
    && e.huella.equipo === String(equipo) && e.huella.min === min && (e.huella.extra || 0) === (extra || 0)) || null;
}
/** mira lo publicado de un partido que ESPN ya no da; avisa a la segunda ejecución seguida sin verlo. `actuales`: las claves de ahora */
export function vigilarPublicados(registro, { partidoId, nombre, actuales, dsps = [], ahora = Date.now(), log = () => {} }) {
  if (!registro || !registro.datos) return [];
  const tabla = (registro.datos.desaparecidos ||= {});
  const nuevos = [];
  for (const e of registro.datos.enviados || []) {
    if (!e.clave.startsWith(`directo|${partidoId}|`) || !/\|(gol\d+|roja)$/.test(e.clave)) continue;
    if (actuales.has(e.clave)) { delete tabla[e.clave]; continue; }
    const x = (tabla[e.clave] ||= { n: 0, desde: new Date(ahora).toISOString() });
    x.n++;
    const jug = e.clave.split('|')[2], esRoja = /\|roja$/.test(e.clave), h = e.huella || {};
    log(`  (directo) ⚠ ${esRoja ? 'la roja' : 'el gol'} ${e.clave} ya salió en X (id ${e.id || '?'}) y ESPN ya no lo da (${x.n}.ª vez)`);
    if (x.n < 2 || x.avisado) continue;
    x.avisado = true;
    // ¿el mismo gol, con otro goleador?
    const otro = !esRoja && h.min != null ? dsps.find((d) => d.n && String(d.equipo) === h.equipo && minutoDe(d.ref).min === h.min && (minutoDe(d.ref).extra || 0) === (h.extra || 0)) : null;
    const txt = esRoja ? `⚠️ Roja ya tuiteada que ESPN ya no da: ${jug} en el ${minHuella(h)} del ${nombre}. ¿Se la han quitado? Tuit ${enlace(e.id)} — revísalo y, si hace falta, bórralo a mano.`
      : otro ? `⚠️ ESPN ha cambiado el goleador del gol del ${minHuella(h)} del ${nombre}: antes ${jug}, ahora ${otro.jugador}. El tuit con ${jug} sigue publicado: ${enlace(e.id)} — corrígelo a mano. No publico otro.`
        : `⚠️ Gol ya tuiteado que ESPN ya no da: ${jug} en el ${minHuella(h)} del ${nombre}. ¿Anulado por el VAR? Tuit ${enlace(e.id)} — revísalo y, si hace falta, bórralo a mano.`;
    // (con otro goleador, la misma clave que el aviso de generar(): sale uno solo)
    if (encolarAviso(registro, otro ? `mismoGol|${e.clave}|${claveDirecto({ id: partidoId }, otro)}` : `quitado|${e.clave}`, txt, ahora)) nuevos.push(txt);
  }
  return nuevos;
}


const ESPN = process.env.ESPN_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const VACIAS = new Set(['de', 'fc', 'cf', 'club', 'real', 'ud', 'cd', 'rcd', 'la', 'del', 'el', 'y', 'sd', 'ad']);
const fichas = (s) => new Set(norm(s).split(' ').filter((t) => t && !VACIAS.has(t)));
const comparten = (a, b) => { const A = fichas(a), B = fichas(b); for (const t of A) if (B.has(t)) return true; return false; };

// `portero`: true si ESPN dice que es portero, false si dice que no, null si no se sabe. Un portero nunca casa con uno de campo ni al
// revés (6 nov: «Isaac Romero», delantero del Sevilla, casó con Rafa Romero, su portero, y la tarjeta salió con dos porteros).
// abreviaturas de apellidos que usa LaLiga («Aitor Fdez», «Rafa Fdez.»; 7 nov, Osasuna-Athletic: el portero salió sin cara porque
// ESPN lo llama «Aitor Fernández»): al casar nombres, se leen enteras
const ABREV = { fdez: 'fernandez', fdz: 'fernandez', fndez: 'fernandez', glez: 'gonzalez', gzlez: 'gonzalez', gonz: 'gonzalez', hdez: 'hernandez', hndez: 'hernandez',
  mtnez: 'martinez', mtez: 'martinez', rdguez: 'rodriguez', rguez: 'rodriguez', rodz: 'rodriguez', sdez: 'sanchez', snchez: 'sanchez', fdo: 'fernando', fco: 'francisco', jco: 'jose' };
const nToks = (s) => norm(s).split(' ').filter(Boolean).map((t) => ABREV[t] || t);

export function casarJugador(nombreEspn, lado, { portero = null } = {}) {
  const toks = nToks(nombreEspn);
  if (!toks.length) return null;
  const ps = (lado.players || []).filter((p) => portero == null || !p.positionId || (Number(p.positionId) === 1) === portero);
  const de = (p) => new Set([...nToks(p.name), ...nToks(p.nickname)]);
  // 0) el que lleva en LaLiga un nombre que está entero en el de ESPN («Isaac» en «Isaac Romero», «C. Romero» en «Cristian Romero»):
  //    va antes que el apellido suelto, que en el Sevilla daba «Rafa Romero» para «Isaac Romero» (Isaac sale en LaLiga sin apellido)
  const cabe = (p) => {
    const ns = nToks(p.nickname);
    return ns.length > 0 && ns.every((t) => toks.includes(t) || (/^[a-z]\.?$/.test(t) && toks.some((u) => u[0] === t[0])));
  };
  const enteros = ps.filter(cabe);
  if (enteros.length === 1) return enteros[0];
  // 1) por el apellido (el último nombre de ESPN) y, si hay varios, por el resto
  const ape = toks[toks.length - 1];
  const cand = ps.filter((p) => de(p).has(ape));
  if (cand.length === 1) return cand[0];
  const con = cand.filter((p) => toks.slice(0, -1).some((t) => de(p).has(t)));
  if (con.length === 1) return con[0];
  // 2) ESPN a veces trae el segundo apellido y LaLiga no («Mario Soriano Carreno» / «Mario Soriano»): el que comparta más
  //    nombres, con al menos 2 y sin empate
  const pun = ps.map((p) => ({ p, n: toks.filter((t) => t.length > 2 && de(p).has(t)).length })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n);
  if (pun.length && !(pun[1] && pun[1].n === pun[0].n)) return pun[0].p;
  return null;
}

/** Segunda pasada para el que `casarJugador` no encuentra porque LaLiga lo llama por un nombre de guerra («Rafita» para Rafa Garrido,
    «Chupe» para Chupete; 7 nov, Málaga-Racing: salían sin cara). Es más flojo, así que pide todo esto a la vez: el mismo puesto (`pos`:
    'POR' | 'DEF' | 'MED' | 'DEL'), que nadie lo tenga ya (`usados`), que TODAS las palabras del nombre de LaLiga se parezcan a alguna del de ESPN
    (empiezan igual, 3 letras como poco) y que quede uno solo. «Dani Sánchez» no casa con «Daniel Pérez»: Sánchez no aparece. */
export function casarJugadorFlojo(nombreEspn, lado, { pos = null, usados = new Set() } = {}) {
  const clase = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
  const et = nToks(nombreEspn).filter((t) => t.length >= 3);
  if (!et.length) return null;
  const k = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const parecen = (a, b) => { const c = k(a, b); return c >= 3 && c >= Math.min(a.length, b.length) - 2; };
  const cand = (lado.players || []).filter((p) => {
    if (usados.has(String(p.id))) return false;
    if (pos && p.positionId && clase[p.positionId] !== pos) return false;
    const nt = nToks(p.nickname).filter((t) => t.length >= 3);
    return nt.length > 0 && nt.every((t) => et.some((u) => parecen(t, u)));
  });
  return cand.length === 1 ? cand[0] : null;
}

// Lo que se tuitea en directo (término medio que propuso Domy y aceptó Carlos el 2 nov): cada gol, con su asistente y los puntos
// fantasy; las rojas; los penaltis fallados. Sin amarillas (Domy: solo tendrían sentido para los apercibidos, y esa lista aún no
// se lee) ni cambios (irían en el tweet del final, salvo los forzados por lesión, que ESPN no distingue).
// Puntos de LaLiga Fantasy por acción (sistema oficial): gol de portero o defensa 6, de medio 5, de delantero 4; asistencia 3; jugar, 1
// (2 con más de 60 min, que en directo no se sabe). Carlos (7 nov, 20:54): el tuit del gol sale con los puntos aunque LaLiga aún no los
// haya sumado («súmalos tú sabiendo la posición»).
export const PTS_GOL = { 1: 6, 2: 6, 3: 5, 4: 4 };
export const PTS_ASIS = 3;
/**
 * Los puntos de un jugador en el momento de un gol: los de LaLiga si ya cuentan lo que ha hecho; si no, los suma el bot.
 * lal: weekPoints de LaLiga (o null); pos: positionId; goles y asis: los que lleva según ESPN contando esta jugada; accion: 'gol' | 'asistencia'.
 * LaLiga «ya lo cuenta» si va por encima del mínimo que dan esas acciones más el punto de jugar. Si no: lo de LaLiga (o el punto de
 * jugar si aún está a 0) más lo de esta jugada, y nunca menos que ese mínimo. { pts, estimado }
 */
export function puntosConGol(lal, pos, { goles = 0, asis = 0, accion = 'gol' } = {}) {
  const g = PTS_GOL[Number(pos)];
  if (!g) return { pts: lal != null && Number(lal) > 0 ? Number(lal) : null, estimado: false };
  const minimo = 1 + goles * g + asis * PTS_ASIS;
  const base = lal != null ? Number(lal) : null;
  if (base != null && base >= minimo) return { pts: base, estimado: false };
  const est = (base != null && base > 0 ? base : 1) + (accion === 'gol' ? g : PTS_ASIS);
  return { pts: Math.max(est, minimo), estimado: true };
}
/**
 * Los puntos de un gol o una asistencia nunca por debajo de los de un tuit anterior del mismo partido más lo que el jugador ha hecho
 * desde entonces. El 7 nov Arda Güler «lleva 10» tras su gol del 36' y, en el 0-3 del 75', con su pase, «se lleva 9»: los puntos en
 * vivo de LaLiga habían bajado y el bot sumaba desde ahí. `tabla`: registro.datos.ptsDirecto (o null); clave: jornada|partido|jugador.
 * Solo vale lo apuntado en una ejecución anterior (`ahora` distinto): en la misma, todas las jugadas ven los mismos puntos de LaLiga y
 * sumar daría dos veces lo mismo. `apuntar`: solo las jugadas que aún no han salido (una ya publicada, recalculada con los puntos de
 * después, contaría acciones posteriores). Devuelve los puntos que van al tuit.
 */
export function conSuelo(tabla, clave, pts, { goles = 0, asis = 0, pos, ahora = Date.now(), apuntar = true } = {}) {
  if (!tabla || pts == null) return pts;
  const g = PTS_GOL[Number(pos)] || 0;
  const prev = tabla[clave];
  let out = pts;
  if (prev && prev.t !== ahora && goles >= prev.g && asis >= prev.a) out = Math.max(pts, prev.p + (goles - prev.g) * g + (asis - prev.a) * PTS_ASIS);
  if (apuntar && (!prev || (goles >= prev.g && asis >= prev.a))) tabla[clave] = { p: out, g: goles, a: asis, t: ahora };
  return out;
}
const mismo = (a, b) => norm(a || '') === norm(b || '');
const hasta = (detalles, ref) => { const i = detalles.indexOf(ref); return i < 0 ? detalles : detalles.slice(0, i + 1); };
/** goles (sin autogoles) de un jugador en los `details` de ESPN hasta la jugada `ref` incluida */
export const golesDe = (detalles, nombre, ref) => hasta(detalles, ref).filter((d) => d.scoringPlay && !d.ownGoal && mismo(((d.athletesInvolved || [])[0] || {}).displayName, nombre)).length;
/** asistencias de un jugador en los `details` de ESPN hasta la jugada `ref` incluida */
export const asistenciasDe = (detalles, nombre, ref) => hasta(detalles, ref).filter((d) => d.scoringPlay && mismo(((d.athletesInvolved || [])[1] || {}).displayName, nombre)).length;

export function disparadores(detalles) {
  const goles = new Map(); const out = [];
  for (const d of detalles) {
    const a = (d.athletesInvolved || [])[0];
    if (!a) continue;
    const min = (d.clock && d.clock.displayValue) || '';
    if (d.scoringPlay && !d.ownGoal) {
      const n = (goles.get(a.displayName) || 0) + 1; goles.set(a.displayName, n);
      out.push({ ref: d, clase: n === 2 ? 'doblete' : n === 3 ? 'triplete' : 'gol', n, jugador: a.displayName, min, equipo: d.team && d.team.id, penalti: !!d.penaltyKick,
        asistente: (d.athletesInvolved[1] && d.athletesInvolved[1].displayName) || null });
    } else if (d.redCard) out.push({ ref: d, clase: 'roja', jugador: a.displayName, min, equipo: d.team && d.team.id });
    else if (d.penaltyKick && !d.scoringPlay) out.push({ ref: d, clase: 'penalti fallado', jugador: a.displayName, min, equipo: d.team && d.team.id });
  }
  return out;
}

/** los penaltis PARADOS de un partido, del `summary` de ESPN (el `scoreboard` no los trae; el de Sivera del 6 nov no salió por eso). Son
    disparadores como los demás: { ref, clase: 'penalti parado', jugador (el lanzador), portero, min, equipo (el del lanzador) } */
export function penaltisParados(sumario) {
  const out = [];
  for (const k of (sumario && sumario.keyEvents) || []) {
    const tipo = String((k.type && k.type.text) || '');
    if (!/^penalty/i.test(tipo) || !/saved/i.test(tipo) || /scored|goal/i.test(tipo)) continue;
    const a = ((k.participants || [])[0] || {}).athlete;
    if (!a || !k.team) continue;
    const portero = ((String(k.text || '').match(/\bby ([^()]+?) \(/) || [])[1] || '').trim();
    out.push({ ref: k, clase: 'penalti parado', jugador: a.displayName, portero: portero || null, min: (k.clock && k.clock.displayValue) || '', equipo: k.team.id });
  }
  return out;
}
/** el marcador [local, visitante] justo antes (o en el momento) de un minuto, con la secuencia reconstruida de ESPN; null si no cuadra */
export function marcadorEn(rel, ref) {
  if (!rel || !rel.ok) return null;
  const t = (d) => { const m = minutoDe(d); return m.min + m.extra / 100; };
  const tp = t(ref);
  let ult = [0, 0];
  for (const d of rel.orden) { if (t(d) > tp) break; const mom = rel.tras.get(d); if (mom) ult = mom.marcador; }
  return ult;
}

/** asistentes de cada gol, del resumen del partido de ESPN (keyEvents: «Assisted by X.»): { 'goleador|minuto': asistente } */
function asistencias(r) {
  const m = {};
  for (const k of (r && r.keyEvents) || []) {
    if (!(k.scoringPlay || /goal/i.test((k.type && k.type.text) || ''))) continue;
    const quien = (k.participants || []).map((p) => p.athlete && p.athlete.displayName).filter(Boolean);
    const txt = String(k.text || '');
    const asis = (txt.match(/Assisted by ([^.]+?)(?: with | following |\.|$)/) || [])[1] || (quien[1] || null);
    if (quien[0]) m[`${quien[0]}|${(k.clock && k.clock.displayValue) || ''}`] = asis ? asis.trim() : null;
  }
  return m;
}

// Cómo se dice lo que ha supuesto cada gol (la situación sale del marcador de ese momento, no del actual). Desde el 3 nov, la frase
// va arriba como titular («⚽ Gol de Budimir y Osasuna se adelanta en el 32'»), el marcador debajo y los puntos en su línea.
const VERBO = { abre: 'se adelanta', empata: 'empata', adelanta: 'se pone por delante', voltea: 'le da la vuelta',
  recorta: 'recorta', amplia: 'amplía la ventaja', sentencia: 'sentencia el partido' };
/** cómo fue el gol según ESPN («Goal - Free-kick», «Goal - Volley», «Goal - Header») y si es un momento para celebrarlo a lo grande
    (Carlos, 7 nov 15:35: «lenguaje más coloquial y mayúsculas si hay un golazo o un gol en los últimos instantes o algún evento que lo
    merezca»). Solo con datos: un golazo, un gol en el descuento o los últimos minutos que empata, adelanta o da la vuelta, una remontada
    y un triplete. `golazo` lo calcula lib/golazo.mjs (7 nov, 22:43): falta directa o disparo de 22 m o más sin penalti con los datos de
    FotMob; sin FotMob, la regla C con el texto de ESPN. Sin `golazo`, solo la falta directa que dice el tipo de ESPN. */
export function momentoEspecial({ tipoEspn = '', min = 0, extra = 0, sit = null, clase = 'gol', penalti = false, golazo = null } = {}) {
  const t = String(tipoEspn || '');
  let forma = penalti ? null : /free.?kick/i.test(t) ? 'de falta directa' : /volley/i.test(t) ? 'de volea' : /header/i.test(t) ? 'de cabeza' : null;
  const cambia = ['empata', 'adelanta', 'voltea'].includes(sit);
  const motivos = [];
  const g = penalti ? null : golazo || (forma === 'de falta directa' ? { motivo: 'falta directa' } : null);
  if (g) {
    if (g.motivo === 'falta directa') { forma = 'de falta directa'; motivos.push('golazo de falta directa'); }
    else if (g.motivo === 'de volea') motivos.push('golazo de volea');
    else motivos.push('golazo de lejos');
  }
  if (cambia && min >= 90) motivos.push(`gol en el descuento (${min}${extra ? `+${extra}` : ''}') que ${VERBO[sit] === 'empata' ? 'empata el partido' : VERBO[sit] === 'le da la vuelta' ? 'le da la vuelta al partido' : 'pone por delante a su equipo'}`);
  else if (cambia && min >= 85) motivos.push(`gol en los últimos minutos que ${sit === 'empata' ? 'empata el partido' : sit === 'voltea' ? 'le da la vuelta al partido' : 'pone por delante a su equipo'}`);
  else if (sit === 'voltea') motivos.push('remontada: le da la vuelta al partido');
  if (clase === 'triplete') motivos.push('triplete');
  return { forma, motivos };
}
/** lo que habría supuesto el penalti (fallado o parado), desde el punto de vista de quien lo lanza */
const pudoTxt = (propio, rival, equipo) => (propio === rival ? `Habría adelantado ${al(equipo)}` : propio < rival ? (rival - propio === 1 ? 'Habría empatado el partido' : 'Habría recortado distancias') : `Habría ampliado la ventaja ${del(equipo)}`);
function titularGol(sit, n, eq, min, semilla) {
  const E = { el: el(eq), del: del(eq), al: al(eq) };
  const v = {
    abre: [`⚽ Gol de ${n} y ${E.el} se adelanta en el ${min}`, `⚽ ${n} abre el marcador en el ${min}`],
    empata: [`⚽ ${n} empata para ${E.el} en el ${min}`, `⚽ Gol de ${n} y empate en el ${min}`],
    adelanta: [`⚽ Gol de ${n} y ${E.el} se pone por delante en el ${min}`, `⚽ ${n} adelanta ${E.al} en el ${min}`],
    voltea: [`⚽ ${n} completa la remontada ${E.del} en el ${min}`, `⚽ Gol de ${n} y ${E.el} le da la vuelta en el ${min}`],
    recorta: [`⚽ ${n} recorta para ${E.el} en el ${min}`, `⚽ Gol de ${n} y ${E.el} se mete en el partido`],
    amplia: [`⚽ ${n} amplía la ventaja ${E.del} en el ${min}`, `⚽ Otro gol ${E.del}, de ${n}, en el ${min}`],
    sentencia: [`⚽ ${n} sentencia en el ${min}`, `⚽ Goleada ${E.del}: ${n} marca otro en el ${min}`],
  }[sit];
  return elegir(v, semilla);
}

const claveDirecto = (m, d) => `directo|${m.id}|${d.jugador}|${d.n ? `gol${d.n}` : d.clase}`;
const totalMin = (mn) => mn.min + mn.extra;
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');

/** los goles que ESPN dice en el comentario del partido que ha anulado el VAR («Deleted After Review»): [{ jugador, t (minuto con el añadido) }].
    En 114 partidos acabados de LaLiga el gol anulado ya no estaba en los `details` ni en los `keyEvents`, solo aquí; se mira por si en directo
    aún convive con el aviso del VAR. */
export function anuladosEspn(sumario) {
  const out = [];
  for (const k of (sumario && sumario.commentary) || []) {
    const pl = k.play || {};
    if (!(pl.type && /deleted after review/i.test(pl.type.text || '')) && !/GOAL OVERTURNED BY VAR/i.test(String(k.text || ''))) continue;
    const a = ((pl.participants || [])[0] || {}).athlete;
    const mn = minutoDe({ clock: pl.clock || k.time });
    if (a && a.displayName) out.push({ jugador: a.displayName, t: totalMin(mn) });
  }
  return out;
}
/** ¿es esta jugada de ESPN uno de los goles anulados? (mismo goleador y a menos de un minuto; `lado`: true si es del local, o null si no se sabe) */
const esAnulado = (d, anulados, casaId) => d.scoringPlay && !d.ownGoal && anulados.some((a) => {
  const g = (d.athletesInvolved || [])[0];
  return g && mismoNombre(g.displayName, a.jugador) && Math.abs(totalMin(minutoDe(d)) - a.t) <= 1 && (a.esLocal == null || a.esLocal === (String(d.team && d.team.id) === String(casaId)));
});
/** la hora a la que ESPN apuntó la jugada de un gol (el `wallclock` de su comentario), para medir el retraso; null si no está */
function horaGolEspn(sumario, jugador, minuto) {
  for (const k of (sumario && sumario.commentary) || []) {
    const pl = k.play || {};
    if (!/^(goal|penalty - scored)/i.test((pl.type && pl.type.text) || '')) continue;
    const a = ((pl.participants || [])[0] || {}).athlete;
    if (a && a.displayName === jugador && String((pl.clock && pl.clock.displayValue) || '') === String(minuto) && pl.wallclock) return pl.wallclock;
  }
  return null;
}

/**
 * ventanas: en directo solo los partidos en juego o empezados hace menos de 3 h (al activar no se sueltan goles viejos).
 * fechasEspn: días del marcador de ESPN (AAAAMMDD); con ventanas, hoy en Madrid.
 * Cada tweet lleva el marcador del momento de la jugada (reconstruido de ESPN), una frase de cómo ha sido, y las tarjetas de los
 * jugadores implicados (goleador y asistente, el expulsado, el que falla el penalti) en `tarjetas`.
 */
export async function generar({ stats, jornada, fechasEspn, jugadores, desdeDirecto = 0, ahora = Date.now(), dazn = null, config = {}, registro = null, fotmob = null }) {
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  const out = [];
  const log = (s) => console.log(s);
  // FotMob, fuente extra (lib/fotmob.mjs): nunca retrasa un tuit y, si no contesta, todo sale con ESPN. Se apaga con config.fotmob = false o BOT_FOTMOB=0
  const fm = fotmob || (config.fotmob === false || process.env.BOT_FOTMOB === '0' ? null : crearFotmob({ log }));
  if (fm && registro) await ponerAlDiaRasgos({ fm, registro, fechas: fechasEspn, log, max: registro.fichero ? 60 : 200 }).catch((e) => log(`  (rasgos) ERROR ${e.message || e}`));
  // los puntos ya dichos en el directo de esta jornada (conSuelo): lo de otras jornadas se borra
  const tablaPts = registro && registro.datos ? (registro.datos.ptsDirecto ||= {}) : null;
  if (tablaPts) for (const k of Object.keys(tablaPts)) if (!k.startsWith(`${jornada}|`)) delete tablaPts[k];
  // «0 eventos en día de partido» (M15): ESPN contesta pero no da ningún partido mientras LaLiga tiene alguno en juego
  let eventosEspn = 0, marcadorOk = false;
  for (const f of fechasEspn) {
    const sb = await json(`${ESPN}/scoreboard?dates=${f}`).catch(() => null);
    if (sb) marcadorOk = true;
    for (const ev of (sb && sb.events) || []) {
      const st = ev.status && ev.status.type;
      if (!st || !['in', 'post'].includes(st.state)) continue;
      if (Date.parse(ev.date) < desdeDirecto || Date.parse(ev.date) > ahora) continue;
      eventosEspn++;
      const c = ev.competitions[0];
      const casa = c.competitors.find((x) => x.homeAway === 'home'), fuera = c.competitors.find((x) => x.homeAway === 'away');
      const m = stats.find((x) => comparten(x.local.mainName, casa.team.displayName) && comparten(x.visitor.mainName, fuera.team.displayName));
      if (!m) { console.log(`  (directo) sin casar ${ev.shortName} con LaLiga`); continue; }
      let dsps = disparadores(c.details || []);
      const claveDe = (d) => claveDirecto(m, d);
      const yaSalio = (d) => !!(registro && registro.claves.has(claveDe(d)));
      const medidas = registro ? (registro.datos.medidaFuentes || {}) : {};
      // FotMob se pide si el partido está en juego (para medir quién ve antes cada gol) o si algún gol aún no ha salido o no se ha medido
      const quiereFm = !!fm && (st.state === 'in' || dsps.some((d) => d.n && (!yaSalio(d) || !completa(medidas[claveDe(d)]))));
      const traerFm = async () => {
        let pm = null;
        for (const dia of [...new Set([f, diaMadrid(ev.date)])]) { pm = casarPartido(await fm.partidosDelDia(dia), casa.team.displayName, fuera.team.displayName, { fecha: ev.date }); if (pm) break; }
        if (!pm) { log(`  (fotmob) ${ev.shortName}: sin casar con un partido de FotMob`); return null; }
        const d = await fm.detalle(pm.id);
        return d ? { ...d, partidoId: String(pm.id) } : null;
      };
      // el resumen del partido de ESPN (una petición por partido y ejecución: penaltis parados, asistentes y goles anulados) y, a la vez, FotMob
      const [sumario, det] = await Promise.all([json(`${ESPN}/summary?event=${ev.id}`).catch(() => null), quiereFm ? traerFm().catch(() => null) : null]);
      // goles anulados por el VAR: ESPN los quita de sus jugadas al anularlos, pero mientras dura la revisión puede convivir con el aviso (comentario de ESPN o `VAR` de FotMob)
      const anulados = [...anuladosEspn(sumario), ...((det && det.anulados) || []).map((a) => ({ jugador: a.jugador, t: a.min + a.extra, esLocal: a.esLocal }))];
      const detalles = anulados.length ? (c.details || []).filter((d) => !esAnulado(d, anulados, casa.team.id)) : (c.details || []);
      if (detalles.length !== (c.details || []).length) {
        log(`  (directo) ${ev.shortName}: gol anulado por el VAR, no sale (${(c.details || []).filter((d) => esAnulado(d, anulados, casa.team.id)).map((d) => `${((d.athletesInvolved || [])[0] || {}).displayName} ${(d.clock || {}).displayValue}`).join(', ')})`);
        dsps = disparadores(detalles);
      }
      dsps.push(...penaltisParados(sumario));
      // un gol o una roja que ya salieron y que ahora no están (VAR tardío, otro goleador, roja quitada): no se pueden deshacer, pero se
      // avisa a Telegram con el id del tuit (A11)
      vigilarPublicados(registro, { partidoId: m.id, nombre: `${corto(m.local.mainName)}-${corto(m.visitor.mainName)}`, actuales: new Set(dsps.map(claveDe)), dsps, ahora, log });
      // VAR pendiente en FotMob: los goles que aún no han salido esperan hasta que se resuelva (como mucho `directo.varEsperaMin`, 10 por defecto,
      // por si el aviso se queda puesto). Es lo ÚNICO por lo que se espera a FotMob, y solo si dice que hay una revisión en curso, nunca porque no vea el gol
      let retenerVar = false;
      if (det && det.varPendiente && dsps.some((d) => d.n && !yaSalio(d))) {
        const tabla = registro ? (registro.datos.varEspera ||= {}) : {};
        const desde = tabla[m.id] || (tabla[m.id] = new Date(ahora).toISOString());
        const espera = (ahora - Date.parse(desde)) / 6e4;
        retenerVar = espera < ((config.directo || {}).varEsperaMin ?? 10);
        log(`  (directo) ${ev.shortName}: VAR en revisión (FotMob) desde hace ${Math.round(espera)} min; ${retenerVar ? 'los goles esperan' : 'paso de esperar y sigo'}`);
      } else if (registro && registro.datos.varEspera && registro.datos.varEspera[m.id]) delete registro.datos.varEspera[m.id];
      // con el partido ya acabado, los puntos solo valen cuando están los DAZN: antes, los tweets esperan (los de durante el partido ya salieron)
      if (st.state === 'post' && dsps.length && dazn && !(await dazn(m)).listo) { console.log(`  (directo) ${ev.shortName}: acabado, espero a los puntos DAZN para sus ${dsps.length} tweets`); continue; }
      console.log(`  (directo) ${ev.shortName} · ${st.state === 'in' ? `en juego, ${(ev.status.displayClock || '')}` : 'acabado'} · ${casa.score}-${fuera.score} · ${dsps.length} cosas que contar`);
      const asis = dsps.some((d) => d.n && !d.asistente) ? asistencias(sumario) : {};
      // el marcador de ESPN, que va al momento (el de LaLiga puede ir por detrás)
      const gl = Number(casa.score), gv = Number(fuera.score);
      const rel = reconstruir(detalles, casa.team.id, fuera.team.id, gl, gv, { vivo: true });
      if (rel.desfase && dsps.length) console.log(`  (directo) ${ev.shortName}: el marcador de ESPN (${gl}-${gv}) va por detrás de sus jugadas; uso el de las jugadas`);
      if (!rel.ok && dsps.length) console.log(`  (directo) ${ev.shortName}: la secuencia de ESPN no cuadra con ${gl}-${gv}; los goles esperan a la siguiente vuelta`);
      // FotMob: casa cada gol de ESPN con el suyo (distancia, situación…) y apunta quién ve antes cada gol (lib/fuentes-medida.mjs)
      const golesFm = det ? det.goles : [];
      const golFm = new Map();
      const usadosFm = new Set();
      for (const dsp of dsps) {
        if (!dsp.n) continue;
        const mnD = minutoDe(dsp.ref), mom0 = rel.ok ? rel.tras.get(dsp.ref) : null;
        const g = casarGol(golesFm, { esCasa: String(dsp.equipo) === String(casa.team.id), jugador: dsp.jugador, min: mnD.min, extra: mnD.extra, marcador: mom0 ? mom0.marcador : null }, usadosFm);
        if (g) { golFm.set(dsp, g); usadosFm.add(g); }
      }
      if (registro) {
        const tabla = () => registro.datos.medidaFuentes || {};
        for (const g of golesFm) if (!g.propia) apuntarVista(registro, `fm|${m.id}|${g.jugadorId}|${g.min}`, { jugador: g.jugador, minuto: `${g.min}'`, vio: { fotmob: true }, reloj: { fotmob: det.reloj }, ahora });
        for (const dsp of dsps.filter((d) => d.n)) {
          const g = golFm.get(dsp);
          const r = apuntarVista(registro, claveDe(dsp), { jugador: dsp.jugador, minuto: dsp.min, vio: { espn: true, fotmob: !!g }, reloj: { espn: ev.status.displayClock, fotmob: det && det.reloj }, espnWall: horaGolEspn(sumario, dsp.jugador, dsp.min), ahora });
          let nuevo = r.nuevo;
          const fe = g ? tabla()[`fm|${m.id}|${g.jugadorId}|${g.min}`] : null;
          if (fe) { fe.casado = true; if (fe.f && (!r.ficha.f || fe.f < r.ficha.f)) { r.ficha.f = fe.f; r.ficha.rf = fe.rf; nuevo = true; } }
          if (nuevo) log(lineaMedida(ev.shortName, r.ficha));
        }
        for (const g of golesFm) {
          const fe = !g.propia && tabla()[`fm|${m.id}|${g.jugadorId}|${g.min}`];
          if (fe && !fe.casado && !fe.avisado) { fe.avisado = true; log(lineaMedida(ev.shortName, fe)); }
        }
      }
      for (const dsp of dsps) {
        // el VAR de FotMob dice que hay una revisión en curso: los goles que no han salido esperan (arriba)
        if (retenerVar && dsp.n && !yaSalio(dsp)) continue;
        // el mismo gol (partido, equipo, minuto y añadido) ya publicado con otro goleador: no sale otra vez (A11)
        if (dsp.n && !yaSalio(dsp)) {
          const mn0 = minutoDe(dsp.ref);
          const previo = mismoGolPublicado(registro, { partido: m.id, equipo: dsp.equipo, min: mn0.min, extra: mn0.extra, clave: claveDe(dsp) });
          if (previo) {
            log(`  (directo) ${ev.shortName}: el gol de ${dsp.jugador} en el ${dsp.min} ya salió como ${previo.clave} (id ${previo.id || '?'}): no lo repito`);
            encolarAviso(registro, `mismoGol|${previo.clave}|${claveDe(dsp)}`, `⚠️ ESPN ha cambiado el goleador del gol del ${minHuella(previo.huella)} del ${corto(m.local.mainName)}-${corto(m.visitor.mainName)}: antes ${previo.clave.split('|')[2]}, ahora ${dsp.jugador}. El tuit sigue publicado: ${enlace(previo.id)} — corrígelo a mano. No publico otro.`, ahora);
            continue;
          }
        }
        // un gol sin su marcador seguro no sale: con el actual de ESPN podía decir «0-1» de un gol que era el 1-1 (7 nov)
        if (!rel.ok && dsp.n) continue;
        const esCasa = String(dsp.equipo) === String(casa.team.id);
        const lado = esCasa ? m.local : String(dsp.equipo) === String(fuera.team.id) ? m.visitor : null;
        if (!lado) continue;
        const p = casarJugador(dsp.jugador, lado);
        const nombre = p ? p.nickname || p.name : dsp.jugador;
        // los puntos solo si LaLiga ya los ha movido (un gol nunca deja 0 o menos: si sale eso, aún no se han actualizado)
        let pts = p && p.weekPoints != null ? Number(p.weekPoints) : null;
        if (dsp.n && pts != null && pts <= 0) pts = null;
        // en un gol, si LaLiga aún no ha sumado lo suyo, los suma el bot por su puesto (7 nov, 20:54)
        let ptsEstimado = false;
        if (dsp.n && p) {
          const jp0 = porId.get(String(p.id));
          const pos0 = (jp0 && jp0.positionId) || p.positionId, asis0 = asistenciasDe(detalles, dsp.jugador, dsp.ref);
          const r = puntosConGol(p.weekPoints, pos0, { goles: dsp.n, asis: asis0, accion: 'gol' });
          if (r.pts != null) {
            pts = conSuelo(tablaPts, `${jornada}|${m.id}|${p.id}`, r.pts, { goles: dsp.n, asis: asis0, pos: pos0, ahora, apuntar: !yaSalio(dsp) });
            ptsEstimado = r.estimado || pts !== r.pts;
          }
        }
        const mn = minutoDe(dsp.ref);
        const minTxt = mn.extra ? `${mn.min}+${mn.extra}'` : `${mn.min}'`;
        const media = p && porId.get(String(p.id)) ? Number(porId.get(String(p.id)).averagePoints) || 0 : 0;
        const equipo = corto(lado.mainName);
        // marcador en el momento de la jugada (si la secuencia cuadra) o el actual de ESPN
        // (un penalti parado viene del `summary`, no de los `details`: su marcador sale de la secuencia, por el minuto)
        const mom = (rel.ok && rel.tras.get(dsp.ref)) || (dsp.clase === 'penalti parado' && rel.ok ? { marcador: marcadorEn(rel, dsp.ref) } : null);
        const [sl, sv] = mom ? mom.marcador : [gl, gv];
        const mar = `${corto(m.local.mainName)} ${sl}-${sv} ${corto(m.visitor.mainName)}`;
        const [propio, rival] = esCasa ? [sl, sv] : [sv, sl];
        const num = [mn.min, mn.extra, mn.extra ? mn.min + mn.extra : null, sl, sv, propio, rival].filter((x) => x != null);   // «¡EN EL 93!» (90+3)
        const sem = `directo${m.id}${dsp.jugador}${dsp.clase}${dsp.n || ''}`;
        const tarjetas = [];
        const jp = p ? porId.get(String(p.id)) : null;
        const pos = jp ? jp.positionId : p && p.positionId;
        let cab; const ideas = [];
        // los hechos para la IA que redacta (lib/redaccion.mjs): lo mismo que dice la plantilla, sin sus frases
        const jugH = []; let extraH = {};
        const jH = (nom, posId, med, extra, eq = equipo, principal = true) => jugadorH({ nickname: nom, positionId: posId, equipo: eq, averagePoints: med }, { principal, extra });
        const marcador = `📍 ${mar}`;
        const puntos = (valor, conMedia, conNombre = false) => {
          num.push(valor);
          const sobre = conMedia && media >= 3 && valor >= 1.5 * media;
          if (sobre) num.push(...partes(media));
          if (valor <= 0) return { t: `📉 Se queda en ${valor} puntos fantasy`, prio: 8 };
          // con asistente en el mismo tuit, el goleador va por su nombre: «Ya suma 4 puntos» a secas se leía como del asistente (7 nov)
          const base = conNombre ? `📊 ${nombre} ya suma ${valor} puntos` : elegir([`📊 Ya suma ${valor} puntos`, `📊 ${cap(segunda(pos, nombre))} ya va por ${valor} puntos`, `📊 Lleva ${valor} puntos de momento`], sem + 'p');
          return { t: `${base}${sobre ? `, con una media de ${fmt(media)}` : ''}`, prio: 8 };
        };
        if (dsp.clase === 'roja') {
          cab = `🟥 Roja para ${nombre} en el ${minTxt}`;
          ideas.push({ t: marcador, prio: 9 });
          const rojas = (mom && mom.rojas) || 1;
          const quedan = rojas === 1 ? 'diez' : rojas === 2 ? 'nueve' : null;
          const estado = propio < rival ? ' y encima va perdiendo' : propio > rival ? ', aunque va ganando' : ' con el empate en el marcador';
          ideas.push({ t: quedan ? `⚠️ ${cap(el(equipo))} se queda con ${quedan}${estado}` : `⚠️ ${cap(el(equipo))} se queda con un jugador menos`, prio: 7 });
          if (pts != null) ideas.push(puntos(pts, false));
          if (p) tarjetas.push({ jugadorId: p.id, motivo: 'roja' });
          jugH.push(jH(nombre, pos, media, { queLePasa: 'es expulsado', ...(pts != null ? { puntosFantasyAhora: pts } : {}) }));
          extraH = { suEquipoSeQuedaCon: quedan || 'un jugador menos', suEquipoVa: propio < rival ? 'perdiendo' : propio > rival ? 'ganando' : 'empatando' };
        } else if (dsp.clase === 'penalti parado') {
          // el portero es del otro equipo (con ESPN dicho: `portero`); su carta, como segunda imagen
          const ladoP = esCasa ? m.visitor : m.local;
          const pPor = dsp.portero ? casarJugador(dsp.portero, ladoP, { portero: true }) : null;
          const nomP = pPor ? pPor.nickname || pPor.name : dsp.portero;
          const ptsP = pPor && pPor.weekPoints != null && Number(pPor.weekPoints) > 0 ? Number(pPor.weekPoints) : null;
          const mediaP = pPor && porId.get(String(pPor.id)) ? Number(porId.get(String(pPor.id)).averagePoints) || 0 : 0;
          const equipoP = corto(ladoP.mainName);
          cab = nomP ? `🧤 ${nomP} le para un penalti a ${nombre} en el ${minTxt}` : `🧤 Penalti parado a ${nombre} en el ${minTxt}`;
          ideas.push({ t: marcador, prio: 9 });
          ideas.push({ t: `⚠️ ${pudoTxt(propio, rival, equipo)}`, prio: 6 });
          if (ptsP != null && nomP) { num.push(ptsP); ideas.push({ t: `📊 ${nomP} ya suma ${ptsP} puntos`, prio: 8 }); }
          if (pPor) tarjetas.push({ jugadorId: pPor.id, motivo: 'parada' });
          if (nomP) jugH.push(jH(nomP, 1, mediaP, { queLePasa: `le para un penalti a ${nombre}`, ...(ptsP != null ? { puntosFantasyAhora: ptsP } : {}) }, equipoP));
          jugH.push(jH(nombre, pos, media, { queLePasa: 'lanza el penalti y se lo paran' }));
          extraH = { quePudoSerElPenalti: pudoTxt(propio, rival, equipo) };
        } else if (dsp.clase === 'penalti fallado') {
          cab = `❌ ${nombre} falla un penalti en el ${minTxt}`;
          ideas.push({ t: marcador, prio: 9 });
          const pudo = pudoTxt(propio, rival, equipo);
          ideas.push({ t: `⚠️ ${pudo}`, prio: 6 });
          jugH.push(jH(nombre, pos, media, { queLePasa: 'falla un penalti', ...(pts != null ? { puntosFantasyAhora: pts } : {}) }));
          extraH = { quePudoSerElPenalti: pudo };
          if (pts != null) ideas.push(puntos(pts, false));
          if (p) tarjetas.push({ jugadorId: p.id, motivo: 'penalti' });
        } else {
          const sit = mom ? situacion(propio, rival, iba_perdiendo(rel, dsp.ref, esCasa)) : null;
          const goles = '⚽'.repeat(Math.min(dsp.n, 3));
          // titular: con un gol normal, la frase entera; con doblete, triplete o penalti, eso arriba y lo que supone junto al marcador
          if (dsp.clase === 'gol' && !dsp.penalti && sit) { cab = titularGol(sit, nombre, equipo, minTxt, sem); ideas.push({ t: marcador, prio: 9 }); }
          else {
            const que = dsp.clase === 'doblete' ? 'Doblete' : dsp.clase === 'triplete' ? 'Triplete' : 'Gol';
            cab = dsp.penalti ? `${goles} ${que} de penalti de ${nombre} en el ${minTxt}` : `${goles} ${que} de ${nombre} en el ${minTxt}`;
            ideas.push({ t: sit ? `${marcador}: ${el(equipo)} ${VERBO[sit]}` : marcador, prio: 9 });
          }
          if (sit && ['empata', 'adelanta', 'voltea'].includes(sit) && mn.min >= 85) ideas.push({ t: mn.min >= 88 ? '⏱️ Casi sobre la bocina' : '⏱️ Ya en el tramo final', prio: 4 });
          else if (sit === 'abre' && mn.min <= 6) ideas.push({ t: '⏱️ Apenas habían pasado unos minutos', prio: 3 });
          if (p) tarjetas.push({ jugadorId: p.id, motivo: dsp.clase === 'doblete' ? 'doblete' : dsp.clase === 'triplete' ? 'triplete' : 'gol', ...(pts != null ? { pts } : {}) });
          const an = dsp.asistente || asis[`${dsp.jugador}|${dsp.min}`] || null;
          let ptsA = null;
          if (an) {
            const pa = casarJugador(an, lado);
            const na = pa ? pa.nickname || pa.name : an;
            if (pa) {
              const jpa = porId.get(String(pa.id));
              const posA = (jpa && jpa.positionId) || pa.positionId, golesA = golesDe(detalles, an, dsp.ref), asisA = Math.max(1, asistenciasDe(detalles, an, dsp.ref));
              ptsA = conSuelo(tablaPts, `${jornada}|${m.id}|${pa.id}`, puntosConGol(pa.weekPoints, posA, { goles: golesA, asis: asisA, accion: 'asistencia' }).pts, { goles: golesA, asis: asisA, pos: posA, ahora, apuntar: !yaSalio(dsp) });
            }
            if (ptsA != null) num.push(ptsA);
            ideas.push({ t: ptsA != null ? `🅰️ Asistencia de ${na}, con ${ptsA} puntos fantasy` : elegir([`🅰️ Asistencia de ${na}`, `🅰️ El pase, de ${na}`], sem + 'a'), prio: 5 });
            if (pa) tarjetas.push({ jugadorId: pa.id, motivo: 'asistencia', ...(ptsA != null ? { pts: ptsA } : {}) });
          }
          if (pts != null) ideas.push(puntos(pts, true, !!an));
          const sobre = pts != null && media >= 3 && pts >= 1.5 * media;
          // golazo (7 nov, 22:43): falta directa o disparo de 22 m o más sin penalti con FotMob; sin FotMob, la regla C con el texto de ESPN
          const gFm = golFm.get(dsp) || null;
          const tipoEspn = dsp.ref && dsp.ref.type && dsp.ref.type.text;
          const golazo = dsp.penalti ? null : gFm ? golazoFotmob(gFm) : golazoEspn({ tipo: tipoEspn, texto: textoGolEspn(sumario, dsp.jugador, dsp.min), penalti: dsp.penalti });
          if (golazo && golazo.metros != null) num.push(golazo.metros);
          // cómo marca este jugador: lo que se ha contado del curso (con este gol) y lo apuntado a mano (lib/rasgos.mjs, lib/apodos-jugadores.mjs)
          // (un partido en juego aún no está en los contadores: se le suman sus goles hasta este; uno acabado ya está, y se le restan los posteriores)
          const delJugador = gFm ? golesFm.filter((g) => !g.propia && g.jugadorId === gFm.jugadorId) : [];
          const hasta = delJugador.filter((g) => g.min + g.extra <= gFm.min + gFm.extra), despues = delJugador.filter((g) => g.min + g.extra > gFm.min + gFm.extra);
          const cont0 = contadorDe(registro, { id: gFm ? gFm.jugadorId : null, nombre: dsp.jugador, equipo: lado.mainName });
          const contado = det ? yaContado(registro, det.partidoId) : st.state === 'post';
          const cont = !cont0 ? null : contado ? (det ? ajustarGoles(cont0, despues, -1) : null)
            : hasta.length && hasta.length === dsp.n ? ajustarGoles(cont0, hasta, 1) : conGolesEspn(cont0, dsp.n);
          const temporada = hechosDeTemporada(cont);
          const estilo = p ? rasgosDe(p.nickname || p.name) : [];
          if (temporada) num.push(...cifrasDeTemporada(temporada));
          log(`  (directo) gol de ${dsp.jugador} ${dsp.min}: ${golazo ? `GOLAZO ${golazo.motivo} (${[golazo.metros != null ? `${golazo.metros} m` : null, golazo.fuente].filter(Boolean).join(', ')})` : 'sin golazo'} · FotMob ${gFm ? `sí (${gFm.situacion || '?'}${gFm.distancia != null ? `, ${gFm.distancia.toFixed(1)} m` : ''})` : det ? 'no ve este gol' : fm ? 'sin datos' : 'apagado'}${temporada ? ` · temporada ${JSON.stringify(temporada).slice(0, 160)}` : ''}${estilo.length ? ' · con rasgos a mano' : ''}`);
          // de qué país es cada uno (de las alineaciones de FotMob), para que la IA diga «el francés» en vez de repetir el nombre (Carlos, 7 nov, 23:40);
          // si goleador y asistente son del mismo país, ninguno lo lleva (no distingue) y sin España ni países desconocidos (lib/nacionalidad.mjs)
          const [paisG, paisA] = sinRepetidas(nacionalidadFm(det, { id: gFm ? gFm.jugadorId : null, nombre: dsp.jugador }), an ? nacionalidadFm(det, { nombre: an }) : null);
          jugH.push(jH(nombre, pos, media, { queLePasa: `${dsp.clase === 'doblete' ? 'marca su segundo gol' : dsp.clase === 'triplete' ? 'marca su tercer gol' : 'marca'}${dsp.penalti ? ' de penalti' : ''}`,
            ...(pts != null ? { puntosFantasyAhora: pts } : {}), ...(sobre ? { frenteASuMedia: frenteMedia(pts, media) } : {}),
            ...(estilo.length ? { suEstilo: estilo } : {}), ...(temporada ? { suTemporada: temporada } : {}), ...(paisG ? { suNacionalidad: paisG } : {}) }));
          if (an) { const paH = casarJugador(an, lado); const ptsAH = ptsA;
            jugH.push(jH(paH ? paH.nickname || paH.name : an, paH ? paH.positionId : null, paH && porId.get(String(paH.id)) ? Number(porId.get(String(paH.id)).averagePoints) || 0 : 0,
              { queLePasa: 'da el pase del gol', ...(ptsAH != null ? { puntosFantasyAhora: ptsAH } : {}), ...(paisA ? { suNacionalidad: paisA } : {}) })); }
          const esp = momentoEspecial({ tipoEspn, min: mn.min, extra: mn.extra, sit, clase: dsp.clase, penalti: dsp.penalti, golazo });
          extraH = { ...(esp.forma ? { comoFueElGol: esp.forma } : {}), ...(esp.motivos.length ? { momentoParaCelebrar: esp.motivos } : {}),
            ...(golazo && golazo.metros != null ? { distanciaDelDisparo: `a unos ${golazo.metros} metros de la portería` } : {}),
            ...(sit ? { loQueSuponeElGol: `${equipo} ${VERBO[sit]}` } : {}), ...(sit && ['empata', 'adelanta', 'voltea'].includes(sit) && mn.min >= 85 ? { tramo: mn.min >= 88 ? 'casi sobre la bocina' : 'ya en el tramo final' } : {}),
            ...(sit === 'abre' && mn.min <= 6 ? { tramo: 'apenas habían pasado unos minutos' } : {}) };
        }
        const { usadas, texto } = tweet(cab, ideas);
        if (!usadas.length) continue;
        const hechos = { tipo: 'directo', subtipo: dsp.clase, jornada, noticia: `${dsp.clase === 'gol' ? 'gol' : dsp.clase} en el ${corto(m.local.mainName)}-${corto(m.visitor.mainName)}`,
          minuto: minTxt, partido: { partido: `${corto(m.local.mainName)}-${corto(m.visitor.mainName)}`, local: corto(m.local.mainName), visitante: corto(m.visitor.mainName), ...estadio(m.local.mainName), marcadorEnEseMomento: `${sl}-${sv}`,
            estadoDelPartido: st.state === 'in' ? 'en juego' : 'acabado' },
          ...(dsp.clase === 'doblete' || dsp.clase === 'triplete' ? { golNumeroDelJugador: dsp.n } : {}), ...extraH,
          jugadores: jugH, clubes: clubesH(m.local.mainName, m.visitor.mainName), etiqueta: '' };
        out.push({ tipo: 'directo', clave: `directo|${m.id}|${dsp.jugador}|${dsp.n ? `gol${dsp.n}` : dsp.clase}`, jornada, texto, hechos,
          numeros: num, casado: !!p, minuto: mn.min * 100 + mn.extra, minutoTxt: minTxt,
          // para las tarjetas de jugador (cada jugador implicado que case con LaLiga) y su marcador del momento
          partido: m.id, marcador: [sl, sv], tarjetas,
          // la huella para reconocer este gol o esta roja aunque ESPN cambie el nombre (A11; Registro.marcar la guarda)
          ...(dsp.n || dsp.clase === 'roja' ? { huella: { clase: dsp.n ? 'gol' : 'roja', partido: String(m.id), equipo: String(dsp.equipo), min: mn.min, extra: mn.extra || 0, jugador: dsp.jugador } } : {}) });
      }
    }
  }
  // ¿ESPN da los partidos que LaLiga tiene en juego? (M15: solo si ESPN ha contestado; si no contesta, ya lo apunta lib/http.mjs)
  const enJuego = (stats || []).filter((x) => { const t0 = Date.parse(x.date); return Number.isFinite(t0) && t0 <= ahora && ahora - t0 < 2.5 * 3600e3 && t0 >= desdeDirecto; }).length;
  if (enJuego && marcadorOk) apuntarFuente(FUENTE_PARTIDOS, eventosEspn > 0, `ESPN no da ningún partido y LaLiga tiene ${enJuego} en juego`);
  // cómo ha ido FotMob en esta ejecución (peticiones bien y mal, tiempo medio): el registro acumula la fiabilidad desde Actions
  if (fm && registro && fm.salud) { apuntarSalud(registro, fm.salud, ahora); if (registro.fichero) registro.guardar(); }
  // en el orden en que pasaron (si en una ejecución salen varios, el primero el más antiguo)
  return out.sort((a, b) => a.minuto - b.minuto);
}
