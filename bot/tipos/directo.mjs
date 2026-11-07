// Directo: goles (con asistente), rojas y penaltis fallados de ESPN (con minuto) casados con los puntos oficiales de LaLiga.
// Sin ventanas repite los partidos ya jugados de los días de fechasEspn (para probar); con ventanas, los de hoy en juego o recién acabados.
import { json } from '../lib/http.mjs';
import { norm, corto, fmt, partes, elegir, el, del, al } from '../lib/texto.mjs';
import { tweet, cap, segunda } from '../lib/redactar.mjs';
import { reconstruir, situacion, iba_perdiendo, minutoDe } from '../lib/relato.mjs';
import { clubes as clubesH, jugador as jugadorH, frenteMedia } from '../lib/hechos.mjs';

const ESPN = process.env.ESPN_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const VACIAS = new Set(['de', 'fc', 'cf', 'club', 'real', 'ud', 'cd', 'rcd', 'la', 'del', 'el', 'y', 'sd', 'ad']);
const fichas = (s) => new Set(norm(s).split(' ').filter((t) => t && !VACIAS.has(t)));
const comparten = (a, b) => { const A = fichas(a), B = fichas(b); for (const t of A) if (B.has(t)) return true; return false; };

// `portero`: true si ESPN dice que es portero, false si dice que no, null si no se sabe. Un portero nunca casa con uno de campo ni al
// revés (6 nov: «Isaac Romero», delantero del Sevilla, casó con Rafa Romero, su portero, y la tarjeta salió con dos porteros).
export function casarJugador(nombreEspn, lado, { portero = null } = {}) {
  const toks = norm(nombreEspn).split(' ').filter(Boolean);
  if (!toks.length) return null;
  const ps = (lado.players || []).filter((p) => portero == null || !p.positionId || (Number(p.positionId) === 1) === portero);
  const de = (p) => new Set([...norm(p.name).split(' '), ...norm(p.nickname).split(' ')].filter(Boolean));
  // 0) el que lleva en LaLiga un nombre que está entero en el de ESPN («Isaac» en «Isaac Romero», «C. Romero» en «Cristian Romero»):
  //    va antes que el apellido suelto, que en el Sevilla daba «Rafa Romero» para «Isaac Romero» (Isaac sale en LaLiga sin apellido)
  const cabe = (p) => {
    const ns = norm(p.nickname).split(' ').filter(Boolean);
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
  const et = norm(nombreEspn).split(' ').filter((t) => t.length >= 3);
  if (!et.length) return null;
  const k = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const parecen = (a, b) => { const c = k(a, b); return c >= 3 && c >= Math.min(a.length, b.length) - 2; };
  const cand = (lado.players || []).filter((p) => {
    if (usados.has(String(p.id))) return false;
    if (pos && p.positionId && clase[p.positionId] !== pos) return false;
    const nt = norm(p.nickname).split(' ').filter((t) => t.length >= 3);
    return nt.length > 0 && nt.every((t) => et.some((u) => parecen(t, u)));
  });
  return cand.length === 1 ? cand[0] : null;
}

// Lo que se tuitea en directo (término medio que propuso Domy y aceptó Carlos el 2 nov): cada gol, con su asistente y los puntos
// fantasy; las rojas; los penaltis fallados. Sin amarillas (Domy: solo tendrían sentido para los apercibidos, y esa lista aún no
// se lee) ni cambios (irían en el tweet del final, salvo los forzados por lesión, que ESPN no distingue).
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
    merezca»). Solo con datos: un gol de falta directa, uno en el descuento o los últimos minutos que empata, adelanta o da la vuelta,
    una remontada y un triplete. Un «golazo» que no sea de falta no se puede saber (ESPN no lo dice): no sale. */
export function momentoEspecial({ tipoEspn = '', min = 0, extra = 0, sit = null, clase = 'gol', penalti = false } = {}) {
  const t = String(tipoEspn || '');
  const forma = penalti ? null : /free.?kick/i.test(t) ? 'de falta directa' : /volley/i.test(t) ? 'de volea' : /header/i.test(t) ? 'de cabeza' : null;
  const cambia = ['empata', 'adelanta', 'voltea'].includes(sit);
  const motivos = [];
  if (forma === 'de falta directa') motivos.push('golazo de falta directa');
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

/**
 * ventanas: en directo solo los partidos en juego o empezados hace menos de 3 h (al activar no se sueltan goles viejos).
 * fechasEspn: días del marcador de ESPN (AAAAMMDD); con ventanas, hoy en Madrid.
 * Cada tweet lleva el marcador del momento de la jugada (reconstruido de ESPN), una frase de cómo ha sido, y las tarjetas de los
 * jugadores implicados (goleador y asistente, el expulsado, el que falla el penalti) en `tarjetas`.
 */
export async function generar({ stats, jornada, fechasEspn, jugadores, desdeDirecto = 0, ahora = Date.now(), dazn = null }) {
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  const out = [];
  for (const f of fechasEspn) {
    const sb = await json(`${ESPN}/scoreboard?dates=${f}`).catch(() => null);
    for (const ev of (sb && sb.events) || []) {
      const st = ev.status && ev.status.type;
      if (!st || !['in', 'post'].includes(st.state)) continue;
      if (Date.parse(ev.date) < desdeDirecto || Date.parse(ev.date) > ahora) continue;
      const c = ev.competitions[0];
      const casa = c.competitors.find((x) => x.homeAway === 'home'), fuera = c.competitors.find((x) => x.homeAway === 'away');
      const m = stats.find((x) => comparten(x.local.mainName, casa.team.displayName) && comparten(x.visitor.mainName, fuera.team.displayName));
      if (!m) { console.log(`  (directo) sin casar ${ev.shortName} con LaLiga`); continue; }
      const dsps = disparadores(c.details || []);
      // el resumen del partido (una petición por partido y ejecución): los penaltis parados y los asistentes que falten
      const sumario = await json(`${ESPN}/summary?event=${ev.id}`).catch(() => null);
      dsps.push(...penaltisParados(sumario));
      // con el partido ya acabado, los puntos solo valen cuando están los DAZN: antes, los tweets esperan (los de durante el partido ya salieron)
      if (st.state === 'post' && dsps.length && dazn && !(await dazn(m)).listo) { console.log(`  (directo) ${ev.shortName}: acabado, espero a los puntos DAZN para sus ${dsps.length} tweets`); continue; }
      console.log(`  (directo) ${ev.shortName} · ${st.state === 'in' ? `en juego, ${(ev.status.displayClock || '')}` : 'acabado'} · ${casa.score}-${fuera.score} · ${dsps.length} cosas que contar`);
      const asis = dsps.some((d) => d.n && !d.asistente) ? asistencias(sumario) : {};
      // el marcador de ESPN, que va al momento (el de LaLiga puede ir por detrás)
      const gl = Number(casa.score), gv = Number(fuera.score);
      const rel = reconstruir(c.details || [], casa.team.id, fuera.team.id, gl, gv);
      if (!rel.ok && dsps.length) console.log(`  (directo) ${ev.shortName}: la secuencia de ESPN no cuadra con ${gl}-${gv}; escribo sin relato`);
      for (const dsp of dsps) {
        const esCasa = String(dsp.equipo) === String(casa.team.id);
        const lado = esCasa ? m.local : String(dsp.equipo) === String(fuera.team.id) ? m.visitor : null;
        if (!lado) continue;
        const p = casarJugador(dsp.jugador, lado);
        const nombre = p ? p.nickname || p.name : dsp.jugador;
        // los puntos solo si LaLiga ya los ha movido (un gol nunca deja 0 o menos: si sale eso, aún no se han actualizado)
        let pts = p && p.weekPoints != null ? Number(p.weekPoints) : null;
        if (dsp.n && pts != null && pts <= 0) pts = null;
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
          const base = conNombre ? `📊 ${nombre} ya suma ${valor} puntos fantasy` : elegir([`📊 Ya suma ${valor} puntos fantasy`, `📊 ${cap(segunda(pos, nombre))} ya va por ${valor} puntos fantasy`, `📊 Lleva ${valor} puntos fantasy de momento`], sem + 'p');
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
          if (ptsP != null && nomP) { num.push(ptsP); ideas.push({ t: `📊 ${nomP} ya suma ${ptsP} puntos fantasy`, prio: 8 }); }
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
          if (p) tarjetas.push({ jugadorId: p.id, motivo: dsp.clase === 'doblete' ? 'doblete' : dsp.clase === 'triplete' ? 'triplete' : 'gol' });
          const an = dsp.asistente || asis[`${dsp.jugador}|${dsp.min}`] || null;
          if (an) {
            const pa = casarJugador(an, lado);
            const na = pa ? pa.nickname || pa.name : an;
            const ptsA = pa && pa.weekPoints != null && Number(pa.weekPoints) > 0 ? Number(pa.weekPoints) : null;
            if (ptsA != null) num.push(ptsA);
            ideas.push({ t: ptsA != null ? `🅰️ Asistencia de ${na}, con ${ptsA} puntos fantasy` : elegir([`🅰️ Asistencia de ${na}`, `🅰️ El pase, de ${na}`], sem + 'a'), prio: 5 });
            if (pa) tarjetas.push({ jugadorId: pa.id, motivo: 'asistencia' });
          }
          if (pts != null) ideas.push(puntos(pts, true, !!an));
          const sobre = pts != null && media >= 3 && pts >= 1.5 * media;
          jugH.push(jH(nombre, pos, media, { queLePasa: `${dsp.clase === 'doblete' ? 'marca su segundo gol' : dsp.clase === 'triplete' ? 'marca su tercer gol' : 'marca'}${dsp.penalti ? ' de penalti' : ''}`,
            ...(pts != null ? { puntosFantasyAhora: pts } : {}), ...(sobre ? { frenteASuMedia: frenteMedia(pts, media) } : {}) }));
          if (an) { const paH = casarJugador(an, lado); const ptsAH = paH && paH.weekPoints != null && Number(paH.weekPoints) > 0 ? Number(paH.weekPoints) : null;
            jugH.push(jH(paH ? paH.nickname || paH.name : an, paH ? paH.positionId : null, paH && porId.get(String(paH.id)) ? Number(porId.get(String(paH.id)).averagePoints) || 0 : 0,
              { queLePasa: 'da el pase del gol', ...(ptsAH != null ? { puntosFantasyAhora: ptsAH } : {}) })); }
          const esp = momentoEspecial({ tipoEspn: dsp.ref && dsp.ref.type && dsp.ref.type.text, min: mn.min, extra: mn.extra, sit, clase: dsp.clase, penalti: dsp.penalti });
          extraH = { ...(esp.forma ? { comoFueElGol: esp.forma } : {}), ...(esp.motivos.length ? { momentoParaCelebrar: esp.motivos } : {}),
            ...(sit ? { loQueSuponeElGol: `${equipo} ${VERBO[sit]}` } : {}), ...(sit && ['empata', 'adelanta', 'voltea'].includes(sit) && mn.min >= 85 ? { tramo: mn.min >= 88 ? 'casi sobre la bocina' : 'ya en el tramo final' } : {}),
            ...(sit === 'abre' && mn.min <= 6 ? { tramo: 'apenas habían pasado unos minutos' } : {}) };
        }
        const { usadas, texto } = tweet(cab, ideas);
        if (!usadas.length) continue;
        const hechos = { tipo: 'directo', subtipo: dsp.clase, jornada, noticia: `${dsp.clase === 'gol' ? 'gol' : dsp.clase} en el ${corto(m.local.mainName)}-${corto(m.visitor.mainName)}`,
          minuto: minTxt, partido: { partido: `${corto(m.local.mainName)}-${corto(m.visitor.mainName)}`, local: corto(m.local.mainName), visitante: corto(m.visitor.mainName), marcadorEnEseMomento: `${sl}-${sv}`,
            estadoDelPartido: st.state === 'in' ? 'en juego' : 'acabado' },
          ...(dsp.clase === 'doblete' || dsp.clase === 'triplete' ? { golNumeroDelJugador: dsp.n } : {}), ...extraH,
          jugadores: jugH, clubes: clubesH(m.local.mainName, m.visitor.mainName), etiqueta: '' };
        out.push({ tipo: 'directo', clave: `directo|${m.id}|${dsp.jugador}|${dsp.n ? `gol${dsp.n}` : dsp.clase}`, jornada, texto, hechos,
          numeros: num, casado: !!p, minuto: mn.min * 100 + mn.extra, minutoTxt: minTxt,
          // para las tarjetas de jugador (cada jugador implicado que case con LaLiga) y su marcador del momento
          partido: m.id, marcador: [sl, sv], tarjetas });
      }
    }
  }
  // en el orden en que pasaron (si en una ejecución salen varios, el primero el más antiguo)
  return out.sort((a, b) => a.minuto - b.minuto);
}
