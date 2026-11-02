// Resumen al acabar cada partido, en lenguaje de persona: cómo ha sido (con la secuencia de goles de ESPN si cuadra con el marcador),
// quién se lo ha llevado, cuánto por encima de su media, quién lo ha pasado mal. Los puntos salen de LaLiga (jornada, media y racha).
import { cierre, quepa, armar, corto, elegir, fmt, partes, el, del, al } from '../lib/texto.mjs';
import { rachaDe } from '../lib/laliga.mjs';
import { partidoEspn, reconstruir, minutoDe } from '../lib/relato.mjs';
import { casarJugador } from './directo.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');

const cap = (f) => f.replace(/^./, (c) => c.toUpperCase());

/**
 * Una frase de cómo ha sido el partido. Con la secuencia de ESPN (si cuadra con el marcador) puede hablar de remontadas y de goles
 * en el último minuto; sin ella, solo del resultado. Devuelve { frase, num }.
 */
export async function relato(m, semilla) {
  const gl = Number(m.localScore), gv = Number(m.visitorScore);
  const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
  const dif = Math.abs(gl - gv), total = gl + gv;
  const [G, P] = gl >= gv ? [L, V] : [V, L];
  let sec = null;
  try {
    const e = await partidoEspn(m, diaMadrid(Date.parse(m.date)));
    if (e) {
      const rel = reconstruir(e.c.details || [], e.casa.team.id, e.fuera.team.id, gl, gv);
      if (rel.ok) sec = { rel, casa: e.casa, fuera: e.fuera };
    }
  } catch { /* sin relato de ESPN: solo el resultado */ }
  const mt = (mn) => (mn.extra ? `${mn.min}+${mn.extra}'` : `${mn.min}'`);
  if (sec && dif >= 1) {
    const casaGana = gl > gv;
    const lado = casaGana ? m.local : m.visitor;
    // la remontada y el gol que dejó al ganador por delante para siempre (el último en que pasó de no ir ganando a ir ganando)
    let detras = false, decisivo = null, ventajaAntes = 0;
    for (const d of sec.rel.orden) {
      const mom = sec.rel.tras.get(d); if (!mom) continue;
      const ventaja = casaGana ? mom.marcador[0] - mom.marcador[1] : mom.marcador[1] - mom.marcador[0];
      if (ventaja < 0) detras = true;
      if (d.scoringPlay) { if (ventajaAntes <= 0 && ventaja > 0) decisivo = d; ventajaAntes = ventaja; }
    }
    if (decisivo) {
      const mn = minutoDe(decisivo);
      const a = decisivo.ownGoal ? null : (decisivo.athletesInvolved || [])[0];
      const p = a ? casarJugador(a.displayName, lado) : null;
      const quien = a ? (p ? p.nickname || p.name : a.displayName) : null;
      const num = [mn.min, mn.extra];
      if (detras && quien) return { num, frase: cap(elegir([`Remontada ${del(G)}: ${quien} puso el gol de la victoria en el ${mt(mn)}.`, `${el(G)} le dio la vuelta al partido y el gol que lo decidió fue de ${quien}, en el ${mt(mn)}.`], semilla)) };
      if (detras) return { num, frase: cap(`remontada ${del(G)}: el gol que le dio la vuelta al partido llegó en el ${mt(mn)}.`) };
      if (mn.min >= 80 && dif === 1 && quien) return { num, frase: cap(elegir([`${quien} lo decidió en el ${mt(mn)} para ${el(G)}.`, `Partido cerrado hasta el ${mt(mn)}, cuando marcó ${quien} para ${el(G)}.`], semilla)) };
      if (mn.min >= 80 && dif === 1) return { num, frase: cap(`se decidió tarde, en el ${mt(mn)}, a favor ${del(G)}.`) };
    }
  }
  if (sec && dif === 0 && total > 0) {
    const ult = [...sec.rel.orden].reverse().find((d) => d.scoringPlay);
    const mn = ult ? minutoDe(ult) : null;
    if (mn && mn.min >= 85) return { num: [mn.min, mn.extra], frase: `Se igualó en el ${mt(mn)} y cada uno se lleva un punto.` };
  }
  if (total === 0) return { num: [], frase: elegir(['Sin goles: un punto para cada uno.', 'Partido sin goles y punto para cada equipo.'], semilla) };
  if (dif === 0) return { num: [], frase: elegir([`Empate a ${gl} y un punto para cada uno.`, `Reparto de puntos con goles de los dos.`], semilla) };
  if (dif >= 3) return { num: [], frase: cap(elegir([`goleada ${del(G)}.`, `${el(G)} golea ${al(P)}.`], semilla)) };
  if (dif === 2) return { num: [], frase: cap(elegir([`victoria ${del(G)} por dos goles.`, `${el(G)} gana por dos goles.`], semilla)) };
  return { num: [], frase: cap(elegir([`${el(G)} gana por la mínima.`, `victoria por la mínima ${del(G)}.`, `${el(G)} se lleva los tres puntos por un solo gol.`], semilla)) };
}

export async function generar({ stats, jornada, jugadores, desdeFinal = 0 }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  // con ventanas, solo los partidos que empezaron hace poco: al activar el bot no se sueltan los de días atrás
  for (const m of stats.filter((x) => x.matchState === 7 && Date.parse(x.date) >= desdeFinal)) {
    const filas = [];
    for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
      if (p.weekPoints == null) continue;
      const j = porId.get(String(p.id));
      filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), pts: Number(p.weekPoints), media: j ? Number(j.averagePoints) : null });
    }
    if (filas.length < 10) continue;
    const ord = [...filas].sort((a, b) => b.pts - a.pts);
    const top = ord[0];
    const empate = ord[1].pts === top.pts ? ord[1] : null;
    const peor = ord[ord.length - 1].pts < 0 ? ord[ord.length - 1] : null;
    const gl = Number(m.localScore), gv = Number(m.visitorScore);
    const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
    const marcador = `${L} ${gl}-${gv} ${V}`;
    const dif = Math.abs(gl - gv);
    const emoji = dif >= 3 ? '🔥' : gl === gv ? '🤝' : '🏁';
    const cab = `${emoji} Final: ${marcador}`;
    const pie = cierre(`final${m.id}`);
    const num = [gl, gv];
    const lineas = [];
    // 0) cómo ha sido el partido
    const r = await relato(m, `relato${m.id}`);
    if (r) { lineas.push(r.frase); num.push(...r.num); }
    // 1) el mejor (o los dos mejores, si empatan)
    if (empate) {
      lineas.push(top.equipo === empate.equipo
        ? `⭐ ${top.nombre} y ${empate.nombre} (${top.equipo}) se reparten el trono fantasy: ${top.pts} puntos cada uno.`
        : `⭐ ${top.nombre} (${top.equipo}) y ${empate.nombre} (${empate.equipo}) se reparten el trono fantasy: ${top.pts} puntos cada uno.`);
      num.push(top.pts);
    } else {
      lineas.push(`⭐ ${elegir([`${top.nombre} (${top.equipo}) es el MVP fantasy con ${top.pts} puntos.`, `${top.nombre} (${top.equipo}) manda en el fantasy: ${top.pts} puntos.`, `El mejor fantasy del partido, ${top.nombre} (${top.equipo}), con ${top.pts} puntos.`], `mvp${m.id}`)}`);
      num.push(top.pts);
    }
    // 2) un dato con miga: el doble de su media, una racha, o el podio
    const t2 = empate ? ord[2] : ord[1], t3 = empate ? ord[3] : ord[2];
    const racha = (() => { const j = porId.get(String(top.id)); const rr = j ? rachaDe(j, 3) : []; return rr.length === 3 && rr.every(([, p]) => p >= 8) ? rr.map(([, p]) => p) : null; })();
    if (top.media && top.media >= 3 && top.pts >= 2 * top.media) {
      lineas.push(`Suele sacar ${fmt(top.media)} de media y hoy más del doble.`);
      num.push(...partes(top.media), 2);
    } else if (racha) {
      lineas.push(`Ya van 3 jornadas seguidas con 8 puntos o más: ${racha.join(', ')}.`);
      num.push(3, 8, ...racha);
    }
    lineas.push(`Detrás, ${t2.nombre} con ${t2.pts} y ${t3.nombre} con ${t3.pts}.`);
    num.push(t2.pts, t3.pts);
    // 3) quién lo ha pasado peor
    if (peor) {
      const encajo = peor.equipo === L ? gv : gl;
      lineas.push(`Para olvidar, ${peor.nombre} (${peor.equipo}) con ${peor.pts}.${encajo >= 3 ? ` Su equipo encajó ${encajo}.` : ''}`);
      num.push(peor.pts); if (encajo >= 3) num.push(encajo);
    }
    const usadas = quepa(cab, lineas, pie);
    if (usadas.length < 1) continue;
    out.push({ tipo: 'final', clave: `final|${m.id}`, jornada, texto: armar(cab, usadas, pie), numeros: num, partido: m.id });
  }
  return out;
}
