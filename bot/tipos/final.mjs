// Resumen al acabar cada partido, como lo contaría una persona (guía de estilo del 3 nov, claude/estilo-tweets.md): el marcador arriba,
// una línea de cómo fue, el mejor con sus puntos, quien puntúa aunque pierde, quien lo pasa mal y, si hay una noche grande, una lectura
// para el mánager. Una idea por línea con su emoji delante. Los puntos salen de LaLiga (jornada, media y racha); la secuencia de goles,
// de ESPN, solo si cuadra con el marcador.
import { CIERRES, corto, elegir, fmt, partes, el, del, al, largo, rotar, turno, ordenJornada } from '../lib/texto.mjs';
import { tweet, cap, segunda, proximoPartido, cuando } from '../lib/redactar.mjs';
import { rachaDe } from '../lib/laliga.mjs';
import { partidoEspn, reconstruir, minutoDe, incidenciasDe, sumarioEspn } from '../lib/relato.mjs';
import { clubes as clubesH, estadio as estadioH, frenteMedia, franja } from '../lib/hechos.mjs';
import { casarJugador } from './directo.mjs';
import { lista, mayus, enLetra } from '../lib/agrupar.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');


/**
 * La línea de cómo ha sido el partido, con su emoji. Con la secuencia de ESPN (si cuadra con el marcador) puede hablar de remontadas
 * y de goles en el último minuto; sin ella, solo del resultado. Devuelve { linea, num, goleadores } (goleadores: ids de LaLiga de
 * los que marcaron, si se ha podido casar con ESPN).
 */
/** la forma de «el mejor» del final del k-ésimo partido de la jornada (0 «el mejor fantasy», 1 «se va a», 2 «N puntos para») */
export const formaMejor = (jornada, k) => turno(3, `mvp${jornada}`, k);
// la forma del MVP que choca con la del final: «se va a» (0) con «se va a» (1); «N puntos para» (1) con «N puntos fantasy para» (2)
const choca = (e) => (e === 1 ? 0 : e === 2 ? 1 : -1);
/** la forma del MVP del k-ésimo partido (tipos/mvp.mjs, cuatro formas): nunca la del MVP de antes, ni la que choca con su final ni con
 *  el final del partido siguiente (dos partidos que acaban a la vez salen final A, final B, MVP A, MVP B; auditoría del 5 nov) */
export function formaMvp(jornada, k) {
  let prev = -1;
  for (let i = 0; i <= k; i++) {
    const t = turno(4, `mvpt${jornada}`, i), no = [choca(formaMejor(jornada, i)), choca(formaMejor(jornada, i + 1)), prev];
    prev = [0, 1, 2, 3].map((d) => (t + d) % 4).find((x) => !no.includes(x));
  }
  return prev;
}
export const chocaConFinal = (jornada, k) => choca(formaMejor(jornada, k));
/** el tipo de resultado (para que la forma del relato rote entre los partidos del mismo tipo, no entre todos) */
const tipoRes = (x) => { const a = Number(x.localScore), b = Number(x.visitorScore), d = Math.abs(a - b); return a + b === 0 ? 'nada' : !d ? 'empate' : d >= 3 ? 'goleada' : d === 2 ? 'dos' : 'minima'; };
// la hora en Madrid (creado una vez: nada de formateadores dentro de los bucles)
const HORA_MAD = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' });

export async function relato(m, semilla, k = null) {
  // con k (su puesto en la jornada), la forma rota entre los partidos seguidos en vez de salir del hash del partido
  const E = (fs) => (k == null ? elegir(fs, semilla) : rotar(fs, semilla, k));
  const gl = Number(m.localScore), gv = Number(m.visitorScore);
  const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
  const dif = Math.abs(gl - gv), total = gl + gv;
  const [G, P] = gl >= gv ? [L, V] : [V, L];
  const goleadores = new Set();
  const goles = [];   // para la IA que redacta (lib/redaccion.mjs): cada gol con su minuto, quién y para quién
  let incidencias = [];   // y los penaltis parados o fallados y las rojas (del summary de ESPN): lo único que no es un gol y se puede contar
  let sec = null;
  try {
    const e = await partidoEspn(m, diaMadrid(Date.parse(m.date)));
    if (e) {
      incidencias = incidenciasDe(await sumarioEspn(e.ev), { casaId: e.casa.team.id, fueraId: e.fuera.team.id, L, V,
        casar: (n, lado, o) => casarJugador(n, lado === 'local' ? m.local : m.visitor, o) });
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
        for (const d of rel.orden) {
          if (!d.scoringPlay) continue;
          const a = (d.athletesInvolved || [])[0];
          const casa = String(d.team && d.team.id) === String(e.casa.team.id);
          const p = a ? casarJugador(a.displayName, casa ? m.local : m.visitor) : null;
          const mn = minutoDe(d), mom = rel.tras.get(d);
          goles.push({ minuto: mn.extra ? `${mn.min}+${mn.extra}'` : `${mn.min}'`, para: corto((casa ? m.local : m.visitor).mainName),
            ...(d.ownGoal ? { enPropia: a ? a.displayName : true } : { goleador: p ? p.nickname || p.name : a ? a.displayName : null }),
            ...(d.penaltyKick || /penal/i.test((d.type && d.type.text) || '') ? { penalti: true } : {}), ...(mom ? { marcador: mom.marcador.join('-') } : {}) });
        }
      }
    }
  } catch { /* sin relato de ESPN: solo el resultado */ }
  const mt = (mn) => (mn.extra ? `${mn.min}+${mn.extra}'` : `${mn.min}'`);
  // nombra: el id (LaLiga) del goleador que sale en la frase, para no repetirlo en la del mejor (comparar el texto fallaba con
  // «Rodri» dentro de «Rodrigo Gamón»; auditoría del 5 nov)
  const sal = (linea, num = [], nombra = null) => ({ linea, num, goleadores, nombra, goles, incidencias });
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
      const num = [mn.min, mn.extra], id = p ? String(p.id) : null;
      if (detras && quien) return sal(E([`🔄 Remontada ${del(G)} con gol de ${quien} en el ${mt(mn)}`, `🔄 ${cap(el(G))} le da la vuelta y ${quien} marca el bueno en el ${mt(mn)}`,
        `🔄 ${cap(el(G))} remonta y lo cierra ${quien} en el ${mt(mn)}`]), num, id);
      if (detras) return sal(`🔄 Remontada ${del(G)}, que se pone por delante en el ${mt(mn)}`, num);
      if (mn.min >= 80 && dif === 1 && quien) return sal(E([`⏱️ ${quien} lo decide en el ${mt(mn)}`, `⏱️ Partido cerrado hasta el ${mt(mn)}, cuando marca ${quien}`,
        `⏱️ Hasta el ${mt(mn)} no se rompe el partido: gol de ${quien}`]), num, id);
      if (mn.min >= 80 && dif === 1) return sal(`⏱️ Se decide en el ${mt(mn)}, a favor ${del(G)}`, num);
    }
  }
  if (sec && dif === 0 && total > 0) {
    const ult = [...sec.rel.orden].reverse().find((d) => d.scoringPlay);
    const mn = ult ? minutoDe(ult) : null;
    if (mn && mn.min >= 85) return sal(`🤝 Empate en el ${mt(mn)} y un punto para cada uno`, [mn.min, mn.extra]);
  }
  // (tres formas cada uno: con dos y la k de la jornada, las tres goleadas de la J11 salían «Goleada del…»; auditoría del 5 nov)
  if (total === 0) return sal(E(['🤝 Sin goles y un punto para cada uno', '🤝 Ni un gol en todo el partido', '🤝 Nadie acierta con la portería y reparto de puntos']));
  if (dif === 0) return sal(E([`🤝 Empate a ${gl} y reparto de puntos`, '🤝 Marcan los dos y se reparten los puntos', `🤝 Tablas a ${gl} y un punto para cada uno`]));
  if (dif >= 3) return sal(E([`🔥 Goleada ${del(G)}`, `🔥 ${cap(el(G))} le pasa por encima ${al(P)}`, `🔥 ${cap(el(G))} golea ${al(P)}`]));
  if (dif === 2) return sal(E([`✅ ${cap(el(G))} gana por dos goles`, `✅ Victoria ${del(G)} sin muchos apuros`, `✅ ${cap(el(G))} se impone con dos goles de margen`]));
  return sal(E([`✅ ${cap(el(G))} gana por la mínima`, `✅ Victoria por la mínima ${del(G)}`, `✅ ${cap(el(G))} se lleva los tres puntos por un gol`]));
}

/**
 * La valoración del resultado contra la tabla de antes del partido (Carlos, 6 nov 08:39: «también al fin de un partido, quién lo
 * tenía más fácil, qué se preveía… no la típica crónica»): sorpresa si gana el que iba 6 puestos o más por debajo, y «cumple el
 * favorito» si gana el de arriba por la misma diferencia. null si no hay nada que valorar. { t, num } con las cifras para el validador.
 */
export function valoracionFinal({ gl, gv, L, V, rl, rv, f = 0 }) {
  if (!rl || !rv || rl.pj < 3 || rv.pj < 3 || gl === gv) return null;
  const [gana, pierde, eg, ep] = gl > gv ? [rl, rv, L, V] : [rv, rl, V, L];
  const dif = gana.pos - pierde.pos;   // positivo: ganó el de más abajo
  if (dif >= 6) return { num: [gana.pos, pierde.pos], t: [`Sorpresa: ${el(eg)}, que iba ${gana.pos}º, gana ${al(ep)}, ${pierde.pos}º`, `Resultado inesperado: ${el(eg)} (${gana.pos}º) se lleva el partido ante ${el(ep)}, que iba ${pierde.pos}º`][f % 2] };
  if (dif <= -6) return { num: [gana.pos, pierde.pos], t: [`Cumple el favorito: ${el(eg)}, ${gana.pos}º, gana ${al(ep)}, ${pierde.pos}º`, `Lo normal en la tabla: ${el(eg)} (${gana.pos}º) se impone ${al(ep)}, que iba ${pierde.pos}º`][f % 2] };
  return null;
}

export async function generar({ stats, jornada, jugadores, desdeFinal = 0, dazn = null, config = {}, info = null }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  const K = ordenJornada(stats);
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
    // cada forma rota por el orden del partido en la jornada: los finales salen casi seguidos y dos seguidos no se leen igual
    const k = Math.max(0, K.indexOf(String(m.id)));
    const R = (fs, slot) => rotar(fs, `${slot}${jornada}`, k);
    const pie = R(CIERRES, 'cierre');
    // de tarde o de noche, según cuándo acaba en Madrid (un partido de las 14:00 no es una «noche redonda»)
    const hFin = Number(HORA_MAD.format(new Date(Date.parse(m.date) + 2 * 36e5)));
    const Franja = hFin >= 20 || hFin < 6 ? 'Noche' : 'Tarde';
    const num = [gl, gv];
    const ideas = [];
    const LG = largo();
    let tablaAntes = null, proximoTop = null;   // para los hechos de la IA que redacta
    // el podio: siempre tres formas en el mismo orden (con listas de largo distinto, la rotación repetía); «completan el podio» solo si
    // lo es de verdad (los dos siguientes de la clasificación, sin empate arriba); si no, «Tras él». Si el relato ya nombra a uno,
    // «el propio» («Bil Nsongo marca el bueno… el propio Bil Nsongo y Adama Traoré…»)
    const detras = (det) => {
      const [a, b] = det, nom = (x) => (r.nombra && String(x.id) === r.nombra ? `el propio ${x.nombre}` : x.nombre), A = nom(a), B = nom(b);
      if (!LG) return a.pts === b.pts ? `🥈 Detrás, ${A} y ${B}, con ${a.pts} cada uno` : `🥈 Detrás, ${A} con ${a.pts} y ${B} con ${b.pts}`;
      const podio = !empate && String(ord[1].id) === String(a.id) && String(ord[2].id) === String(b.id);
      const tras = empate ? 'Tras ellos' : 'Tras él';
      const fs = a.pts === b.pts
        ? [`🥈 Detrás, ${A} y ${B}, con ${a.pts} cada uno`, `🥈 Le siguen ${A} y ${B}, con ${a.pts} cada uno`, podio ? `🥈 ${cap(A)} y ${B} completan el podio con ${a.pts} cada uno` : `🥈 ${tras}, ${A} y ${B}, con ${a.pts} cada uno`]
        : [`🥈 Detrás, ${A} con ${a.pts} y ${B} con ${b.pts}`, `🥈 Le siguen ${A}, con ${a.pts}, y ${B}, con ${b.pts}`, podio ? `🥈 ${cap(A)} y ${B} completan el podio con ${a.pts} y ${b.pts}` : `🥈 ${tras}, ${A} con ${a.pts} y ${B} con ${b.pts}`];
      return R(fs, 'det');
    };
    // 1) cómo ha sido el partido
    // (la k del relato cuenta solo los partidos de antes con el mismo tipo de resultado: con la de toda la jornada, las goleadas salían
    // todas con la misma forma)
    const kRes = K.slice(0, k).map((id) => stats.find((x) => String(x.id) === id)).filter((x) => x && x.matchState === 7 && tipoRes(x) === tipoRes(m)).length;
    const r = await relato(m, `relato${jornada}${tipoRes(m)}`, kRes);
    ideas.push({ t: r.linea, prio: 8 }); num.push(...r.num);
    const nombrado = !!r.nombra && r.nombra === String(top.id);
    // 2) el mejor (o los dos, si empatan). El partido ya está arriba: sin el equipo entre paréntesis.
    if (empate) ideas.push({ t: `⭐ ${top.nombre} y ${empate.nombre}, los mejores fantasy: ${top.pts} puntos cada uno`, prio: 9 });
    else if (gl !== gv && String(top.ladoId) === String(gl > gv ? m.visitor.id : m.local.id)) ideas.push({ t: `⭐ ${top.nombre}, el mejor fantasy aunque ${el(gl > gv ? V : L)} pierde: ${top.pts} puntos`, prio: 9 });
    else {
      // si el relato ya lo nombra («Satriano marca el bueno en el 73'»), aquí sin nombre: «Se va a 14 puntos fantasy». La forma es la
      // misma que mira tipos/mvp.mjs (`formaMejor`) para no repetirla en el tweet del MVP, que sale justo después
      const n = top.nombre;
      // («el goleador», no sin sujeto: «Remontada del Getafe con gol de Satriano. Se va a 14…» parecía que hablaba del Getafe)
      ideas.push({ t: (nombrado ? [`⭐ El goleador es el mejor fantasy: ${top.pts} puntos`, `⭐ El goleador se va a ${top.pts} puntos fantasy`, `⭐ ${top.pts} puntos fantasy para el goleador`]
        : [`⭐ ${n}, el mejor fantasy: ${top.pts} puntos`, `⭐ ${n} se va a ${top.pts} puntos fantasy`, `⭐ ${top.pts} puntos fantasy para ${n}`])[formaMejor(jornada, k)], prio: 9 });
    }
    num.push(top.pts);
    // 3) un dato con miga del mejor, ya por su puesto: el doble de su media o una racha
    const racha = (() => { const j = porId.get(String(top.id)); const rr = j ? rachaDe(j, 3) : []; return rr.length === 3 && rr.every(([, p]) => p >= 8) ? rr.map(([, p]) => p) : null; })();
    // (con la media redondeada, la que se escribe, y «más del»: 12 con 6,0 no es «más del doble»)
    const mediaR = Math.round(Number(top.media) * 10) / 10;
    const dobla = !empate && mediaR >= 3 && top.pts > 2 * mediaR;
    if (dobla) {
      // con tweets largos, cada final con su forma (Carlos, 4 nov 23:39: que no se note que es una plantilla)
      // «más del triple» si llega (De Frutos, 15 con 4,7 de media, no «ha doblado»)
      const veces = top.pts > 3 * mediaR ? 'triple' : 'doble';
      const migas = [`📈 ${cap(segunda(top.pos, top.nombre))} suele sacar ${fmt(top.media)} de media: hoy, más del ${veces}`, `📈 Más del ${veces} de lo que suele: ${fmt(top.media)} de media`,
        `📈 Su media es de ${fmt(top.media)}, así que hoy ha sacado más del ${veces}`, `📈 Va a ${fmt(top.media)} por partido y hoy ha hecho más del ${veces}`];
      // (también con 280: las cuatro miden parecido y con una sola salía igual en todos los finales)
      ideas.push({ t: R(migas, 'miga'), prio: 5, fija: true });
      num.push(...partes(top.media));
    }
    // la racha, si no ha salido el doble de su media (con tweets largos, las dos)
    if (!empate && racha && (largo() || !dobla)) {
      const rs = `${racha.slice(0, -1).join(', ')} y ${racha[racha.length - 1]}`;
      ideas.push({ t: LG ? R([`📈 Lleva 3 jornadas seguidas con 8 o más: ${rs}`, `📈 Tercera jornada seguida con 8 o más: ${rs}`, `📈 Va lanzado: ${rs} en las 3 últimas jornadas`], 'racha')
        : `📈 Lleva 3 jornadas seguidas con 8 o más: ${rs}`, prio: 5 });
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
      const marco = r.goleadores.has(String(pierde.id));
      ya.add(String(pierde.id));
      // con tweets largos (X Premium), el podio también, pegado al mejor (antes del que se salva aunque pierde)
      const det = LG ? ord.filter((f) => !ya.has(String(f.id))).slice(0, 2) : [];
      // (solo si el que se salva no está en el podio de verdad: «Nsongo y Traoré completan el podio con 10» y luego «Budimir saca 11»
      // es falso; auditoría del 5 nov)
      if (det.length === 2 && det[1].pts > 0 && pierde.pts <= det[1].pts) { ideas.push({ t: detras(det), prio: 2 }); num.push(det[0].pts, det[1].pts); }
      // («suma», no «se va a»: el mejor ya puede llevar «se va a» en el mismo tweet)
      ideas.push({ t: LG ? R([`‼️ ${pierde.nombre}${marco ? ' marcó y' : ''} suma ${pierde.pts} aunque ${el(eqP)} pierde`, `‼️ En ${el(eqP)} se salva ${pierde.nombre}${marco ? ', que marcó' : ''}: ${pierde.pts} puntos`,
        `‼️ ${pierde.nombre} saca ${pierde.pts} puntos${marco ? ', con gol incluido,' : ''} pese a la derrota ${del(eqP)}`], 'pierde')
        : R([`‼️ ${pierde.nombre}${marco ? ' marcó y' : ''} suma ${pierde.pts} aunque ${el(eqP)} pierde`, `‼️ En ${el(eqP)} se salva ${pierde.nombre}${marco ? ', que marcó' : ''}: ${pierde.pts} puntos`], 'pierde'), prio: 7, rota: true });
      num.push(pierde.pts);
    } else {
      const det = ord.filter((f) => !ya.has(String(f.id))).slice(0, 2);
      if (det.length === 2 && det[1].pts > 0) { ideas.push({ t: detras(det), prio: 4 }); num.push(det[0].pts, det[1].pts); }
    }
    // 5) quien lo ha pasado peor
    // (con varios empatados abajo, «Lo peor se lo lleva Koski: -4» era falso: con dos o tres, todos; con más, cuántos)
    const peores = peor ? ord.filter((f) => f.pts === peor.pts && !ya.has(String(f.id))) : [];
    if (peores.length > 1) {
      const mismoEq = peores.every((f) => f.equipo === peores[0].equipo);
      const quienes = peores.length <= 3 ? lista(peores.map((f) => f.nombre)) : `${mayus(enLetra(peores.length))} jugadores${mismoEq ? ` ${del(peores[0].equipo)}` : ''}`;
      ideas.push({ t: `❌ ${quienes} se quedan en ${peor.pts} ${Math.abs(peor.pts) === 1 ? 'punto' : 'puntos'}`, prio: 3, rota: true });
      num.push(peor.pts);
    } else if (peor && !ya.has(String(peor.id))) {
      const encajo = peor.equipo === L ? gv : gl;
      const ptsP = `${peor.pts} ${Math.abs(peor.pts) === 1 ? 'punto' : 'puntos'}`;
      const enc = encajo < 3 ? '' : LG ? R([` y ${encajo} goles encajados por su equipo`, `, con ${encajo} goles en contra`, ` en un partido en el que su equipo encajó ${encajo}`], 'enc') : ` y ${encajo} goles encajados por su equipo`;
      ideas.push({ t: LG ? R([`❌ ${Franja} para olvidar de ${peor.nombre}: ${ptsP}${enc}`, `❌ Lo peor se lo lleva ${peor.nombre}: ${ptsP}${enc}`, `❌ A ${peor.nombre} se le atraganta el partido: ${ptsP}${enc}`], 'peor')
        : R([`❌ ${Franja} para olvidar de ${peor.nombre}: ${ptsP}${enc}`, `❌ Lo peor se lo lleva ${peor.nombre}: ${ptsP}${enc}`], 'peor'), prio: 3, rota: true });
      num.push(peor.pts); if (encajo >= 3) num.push(encajo);
    }
    // 6) la lectura para el mánager, solo en un partido grande (y no en todos: depende del partido). Cinco formas, siempre en el mismo
    // orden; si el peor ya dice «Noche/Tarde para olvidar», la de «Noche/Tarde redonda» se cambia por otra, sin recortar la lista
    const yaFranja = ideas.some((x) => x.t.includes(`${Franja} para olvidar`));
    const lects = [`✅ Si tienes a ${top.nombre}, hoy sonríes`, `✅ Acertó quien alineó a ${top.nombre}`, `✅ Premio para quien confió en ${top.nombre}`,
      yaFranja ? `✅ Partido redondo para quien tenga a ${top.nombre}` : `✅ ${Franja} redonda para quien tenga a ${top.nombre}`, `✅ Quien lleve a ${top.nombre}, de celebración`];
    if (!empate && top.pts >= 12) ideas.push({ t: R(lects, 'lect'), prio: 2, ultima: true });
    // con tweets largos: la valoración del resultado contra la tabla de antes del partido (una sorpresa, o que cumple el favorito)
    if (LG && info && info.tablaSin) {
      const tp = await info.tablaSin(m.id).catch(() => null);
      const v = tp && valoracionFinal({ gl, gv, L, V, rl: tp.porId[String(m.local.id)], rv: tp.porId[String(m.visitor.id)], f: turno(2, `valFinal${jornada}`, k) });
      if (v) { ideas.push({ t: `👀 ${v.t}`, prio: 4 }); num.push(...v.num); }
      if (tp) tablaAntes = { [L]: tp.porId[String(m.local.id)], [V]: tp.porId[String(m.visitor.id)] };
    }
    // con tweets largos: el próximo partido del mejor (lo que mira el mánager que lo tiene)
    // (no si sale el tweet del MVP con su tarjeta: ya lo cuenta él y serían dos tweets seguidos diciendo lo mismo)
    if (LG && !empate && top.pts >= 8 && !(config.tarjetas && config.tarjetas.jugador)) {
      const pp = await proximoPartido(top.ladoId, { jornada: jornada + 1 }).catch(() => null);
      const c = pp && pp.fecha ? cuando(pp.fecha) : null;
      if (pp) proximoTop = { club: pp.rival, rival: el(pp.rival), ...(pp.enCasa != null ? { juega: pp.enCasa ? 'en casa' : 'fuera' } : {}), ...(c ? { cuando: c.t } : { jornada: pp.jornada }) };
      if (pp) { ideas.push({ t: `🗓️ ${cap(segunda(top.pos, top.nombre))} vuelve a jugar ${c ? `${c.t}, ` : `en la jornada ${pp.jornada}, `}contra ${el(pp.rival)}`, prio: 1, antes: true }); num.push(...(c ? c.numeros : [pp.jornada])); }
    }
    // con tweets largos, «el que se salva aunque pierde» y «el peor» cambian de orden entre sí según el partido (solo esas dos: el podio
    // y la racha hablan del mejor y van pegados a él; la auditoría del 5 nov vio «Pedro Felipe se va a 6… Detrás, Arda Güler…»).
    // La lectura para el mánager, siempre al final, y el próximo partido, justo antes
    if (LG) {
      const pos = ideas.map((x, i) => (x.rota ? i : -1)).filter((i) => i >= 0);
      if (pos.length === 2 && turno(2, `orden${jornada}`, k)) { const a = ideas[pos[0]]; ideas[pos[0]] = ideas[pos[1]]; ideas[pos[1]] = a; }
      const fin = [...ideas.filter((x) => x.antes), ...ideas.filter((x) => x.ultima)];
      const resto = ideas.filter((x) => !x.antes && !x.ultima);
      ideas.splice(0, ideas.length, ...resto, ...fin);
    }
    const { usadas, texto } = tweet(cab, ideas.map(({ fija, ultima, antes, rota, ...x }) => x), { pie });
    if (!usadas.length) continue;
    // los hechos para la IA que redacta (lib/redaccion.mjs): el marcador, los goles de ESPN, los puntos de cada uno y el contexto
    const fila = (f, extra = {}) => ({ nombre: f.nombre, club: f.equipo, puntos: f.pts, ...(f.media != null && f.media >= 1 ? { mediaPuntos: fmt(f.media), hoyFrenteASuMedia: frenteMedia(f.pts, f.media) } : {}), principal: false, ...extra });
    const jugH = [fila(top, { papel: 'el que más puntos ha sacado de los dos equipos', principal: true,
      ...(racha ? { racha: `3 jornadas seguidas con 8 o más: ${racha.join(', ')}` } : {}), ...(proximoTop ? { proximoPartido: proximoTop } : {}) })];
    if (empate) jugH.push(fila(empate, { papel: 'empatado con el mejor', principal: true }));
    for (const f of ord.filter((x) => ![top.id, empate && empate.id].includes(x.id)).slice(0, 2)) jugH.push(fila(f, { papel: 'detrás del mejor' }));
    if (pierde && !jugH.some((x) => x.nombre === pierde.nombre)) jugH.push(fila(pierde, { papel: 'puntúa aunque su equipo pierde' }));
    for (const f of peores.length ? peores.slice(0, 3) : peor ? [peor] : []) if (!jugH.some((x) => x.nombre === f.nombre)) jugH.push(fila(f, { papel: 'el peor del partido' }));
    const hechos = { tipo: 'final', jornada, partido: { partido: `${L}-${V}`, local: L, visitante: V, ...estadioH(L), marcador: `${gl}-${gv}`, ...(franja(m.date) ? { horario: franja(m.date) } : {}), fecha: m.date || null },
      alcance: 'datos de este partido: los jugadores de la lista son una selección (los que más y los que menos puntos han sacado); del resto de la jornada no se sabe nada',
      goles: r.goles || [], incidencias: r.incidencias || [], jugadores: jugH,
      ...(tablaAntes && tablaAntes[L] && tablaAntes[V] ? { antesDelPartido: { [L]: `${tablaAntes[L].pos}º`, [V]: `${tablaAntes[V].pos}º` } } : {}),
      clubes: clubesH(L, V, proximoTop ? proximoTop.club : null), etiqueta: pie };
    if (proximoTop) delete proximoTop.club;
    out.push({ tipo: 'final', clave: `final|${m.id}`, jornada, texto, hechos, numeros: num, partido: m.id });
  }
  return out;
}
