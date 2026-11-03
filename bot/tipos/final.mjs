// Resumen al acabar cada partido, como lo contaría una persona (guía de estilo del 3 nov, claude/estilo-tweets.md): el marcador arriba,
// una línea de cómo fue, el mejor con sus puntos, quien puntúa aunque pierde, quien lo pasa mal y, si hay una noche grande, una lectura
// para el mánager. Una idea por línea con su emoji delante. Los puntos salen de LaLiga (jornada, media y racha); la secuencia de goles,
// de ESPN, solo si cuadra con el marcador.
import { cierre, corto, elegir, fmt, partes, el, del, al } from '../lib/texto.mjs';
import { tweet, cap, segunda } from '../lib/redactar.mjs';
import { rachaDe } from '../lib/laliga.mjs';
import { partidoEspn, reconstruir, minutoDe } from '../lib/relato.mjs';
import { casarJugador } from './directo.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');


/**
 * La línea de cómo ha sido el partido, con su emoji. Con la secuencia de ESPN (si cuadra con el marcador) puede hablar de remontadas
 * y de goles en el último minuto; sin ella, solo del resultado. Devuelve { linea, num, goleadores } (goleadores: ids de LaLiga de
 * los que marcaron, si se ha podido casar con ESPN).
 */
export async function relato(m, semilla) {
  const gl = Number(m.localScore), gv = Number(m.visitorScore);
  const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
  const dif = Math.abs(gl - gv), total = gl + gv;
  const [G, P] = gl >= gv ? [L, V] : [V, L];
  const goleadores = new Set();
  let sec = null;
  try {
    const e = await partidoEspn(m, diaMadrid(Date.parse(m.date)));
    if (e) {
      const rel = reconstruir(e.c.details || [], e.casa.team.id, e.fuera.team.id, gl, gv);
      if (rel.ok) {
        sec = { rel, casa: e.casa, fuera: e.fuera };
        for (const d of rel.orden) {
          if (!d.scoringPlay || d.ownGoal) continue;
          const a = (d.athletesInvolved || [])[0]; if (!a) continue;
          const lado = String(d.team && d.team.id) === String(e.casa.team.id) ? m.local : m.visitor;
          const p = casarJugador(a.displayName, lado);
          if (p) goleadores.add(String(p.id));
        }
      }
    }
  } catch { /* sin relato de ESPN: solo el resultado */ }
  const mt = (mn) => (mn.extra ? `${mn.min}+${mn.extra}'` : `${mn.min}'`);
  const sal = (linea, num = []) => ({ linea, num, goleadores });
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
      if (detras && quien) return sal(elegir([`🔄 Remontada ${del(G)} con gol de ${quien} en el ${mt(mn)}`, `🔄 ${cap(el(G))} le da la vuelta y ${quien} marca el bueno en el ${mt(mn)}`], semilla), num);
      if (detras) return sal(`🔄 Remontada ${del(G)}, que se pone por delante en el ${mt(mn)}`, num);
      if (mn.min >= 80 && dif === 1 && quien) return sal(elegir([`⏱️ ${quien} lo decide en el ${mt(mn)}`, `⏱️ Partido cerrado hasta el ${mt(mn)}, cuando marca ${quien}`], semilla), num);
      if (mn.min >= 80 && dif === 1) return sal(`⏱️ Se decide en el ${mt(mn)}, a favor ${del(G)}`, num);
    }
  }
  if (sec && dif === 0 && total > 0) {
    const ult = [...sec.rel.orden].reverse().find((d) => d.scoringPlay);
    const mn = ult ? minutoDe(ult) : null;
    if (mn && mn.min >= 85) return sal(`🤝 Empate en el ${mt(mn)} y un punto para cada uno`, [mn.min, mn.extra]);
  }
  if (total === 0) return sal(elegir(['🤝 Sin goles y un punto para cada uno', '🤝 Ni un gol en todo el partido'], semilla));
  if (dif === 0) return sal(elegir([`🤝 Empate a ${gl} y reparto de puntos`, '🤝 Marcan los dos y se reparten los puntos'], semilla));
  if (dif >= 3) return sal(elegir([`🔥 Goleada ${del(G)}`, `🔥 ${cap(el(G))} le pasa por encima ${al(P)}`], semilla));
  if (dif === 2) return sal(elegir([`✅ ${cap(el(G))} gana por dos goles`, `✅ Victoria ${del(G)} sin muchos apuros`], semilla));
  return sal(elegir([`✅ ${cap(el(G))} gana por la mínima`, `✅ Victoria por la mínima ${del(G)}`, `✅ ${cap(el(G))} se lleva los tres puntos por un gol`], semilla));
}

export async function generar({ stats, jornada, jugadores, desdeFinal = 0, dazn = null }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  // con ventanas, solo los partidos que empezaron hace poco: al activar el bot no se sueltan los de días atrás
  for (const m of stats.filter((x) => x.matchState === 7 && Date.parse(x.date) >= desdeFinal)) {
    if (dazn && !(await dazn(m)).listo) continue;   // aún sin los puntos DAZN: los de ahora irían cortos
    const filas = [];
    for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
      if (p.weekPoints == null) continue;
      const j = porId.get(String(p.id));
      filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), ladoId: lado.id, pts: Number(p.weekPoints),
        media: j ? Number(j.averagePoints) : null, pos: j ? j.positionId : p.positionId });
    }
    if (filas.length < 10) continue;
    const ord = [...filas].sort((a, b) => b.pts - a.pts);
    const top = ord[0];
    const empate = ord[1].pts === top.pts ? ord[1] : null;
    const peor = ord[ord.length - 1].pts < 0 ? ord[ord.length - 1] : null;
    const gl = Number(m.localScore), gv = Number(m.visitorScore);
    const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
    const cab = `🏁 ${L} ${gl}-${gv} ${V}`;
    const pie = cierre(`final${m.id}`);
    const num = [gl, gv];
    const ideas = [];
    // 1) cómo ha sido el partido
    const r = await relato(m, `relato${m.id}`);
    ideas.push({ t: r.linea, prio: 8 }); num.push(...r.num);
    // 2) el mejor (o los dos, si empatan). El partido ya está arriba: sin el equipo entre paréntesis.
    if (empate) ideas.push({ t: `⭐ ${top.nombre} y ${empate.nombre}, los mejores fantasy: ${top.pts} puntos cada uno`, prio: 9 });
    else if (gl !== gv && String(top.ladoId) === String(gl > gv ? m.visitor.id : m.local.id)) ideas.push({ t: `⭐ ${top.nombre}, el mejor fantasy aunque ${el(gl > gv ? V : L)} pierde: ${top.pts} puntos`, prio: 9 });
    else ideas.push({ t: elegir([`⭐ ${top.nombre}, el mejor fantasy: ${top.pts} puntos`, `⭐ ${top.nombre} se va a ${top.pts} puntos fantasy`, `⭐ ${top.pts} puntos fantasy para ${top.nombre}`], `mvp${m.id}`), prio: 9 });
    num.push(top.pts);
    // 3) un dato con miga del mejor, ya por su puesto: el doble de su media o una racha
    const racha = (() => { const j = porId.get(String(top.id)); const rr = j ? rachaDe(j, 3) : []; return rr.length === 3 && rr.every(([, p]) => p >= 8) ? rr.map(([, p]) => p) : null; })();
    if (!empate && top.media && top.media >= 3 && top.pts >= 2 * top.media) {
      ideas.push({ t: `📈 ${cap(segunda(top.pos, top.nombre))} suele sacar ${fmt(top.media)} de media: hoy, más del doble`, prio: 5 });
      num.push(...partes(top.media));
    } else if (!empate && racha) {
      ideas.push({ t: `📈 Lleva 3 jornadas seguidas con 8 o más: ${racha.slice(0, -1).join(', ')} y ${racha[racha.length - 1]}`, prio: 5 });
      num.push(3, 8, ...racha);
    }
    // 4) quien puntúa aunque su equipo pierde (si ha marcado, se dice); si no hay, el podio
    const ya = new Set([top.id, empate && empate.id].filter(Boolean).map(String));
    let pierde = null;
    if (gl !== gv) {
      const idP = gl > gv ? m.visitor.id : m.local.id;
      const b = ord.find((f) => String(f.ladoId) === String(idP));
      if (b && b.pts >= 6 && !ya.has(String(b.id))) pierde = b;
    }
    if (pierde) {
      const eqP = gl > gv ? V : L;
      ideas.push({ t: `‼️ ${pierde.nombre}${r.goleadores.has(String(pierde.id)) ? ' marcó y' : ''} se va a ${pierde.pts} aunque ${el(eqP)} pierde`, prio: 7 });
      num.push(pierde.pts); ya.add(String(pierde.id));
    } else {
      const det = ord.filter((f) => !ya.has(String(f.id))).slice(0, 2);
      if (det.length === 2 && det[1].pts > 0) { ideas.push({ t: `🥈 Detrás, ${det[0].nombre} con ${det[0].pts} y ${det[1].nombre} con ${det[1].pts}`, prio: 4 }); num.push(det[0].pts, det[1].pts); }
    }
    // 5) quien lo ha pasado peor
    if (peor && !ya.has(String(peor.id))) {
      const encajo = peor.equipo === L ? gv : gl;
      ideas.push({ t: `❌ Noche para olvidar de ${peor.nombre}: ${peor.pts} puntos${encajo >= 3 ? ` y ${encajo} goles encajados por su equipo` : ''}`, prio: 3 });
      num.push(peor.pts); if (encajo >= 3) num.push(encajo);
    }
    // 6) la lectura para el mánager, solo en una noche grande (y no en todos: depende del partido)
    if (!empate && top.pts >= 12) ideas.push({ t: elegir([`✅ Quien lleve a ${top.nombre}, buena noche`, `✅ Si tienes a ${top.nombre}, hoy sonríes`, `✅ Noche redonda para quien tenga a ${top.nombre}`], `lect${m.id}`), prio: 2 });
    const { usadas, texto } = tweet(cab, ideas, { pie });
    if (!usadas.length) continue;
    out.push({ tipo: 'final', clave: `final|${m.id}`, jornada, texto, numeros: num, partido: m.id });
  }
  return out;
}
