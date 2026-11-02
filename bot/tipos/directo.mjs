// Directo: goles (con asistente), rojas y penaltis fallados de ESPN (con minuto) casados con los puntos oficiales de LaLiga.
// Sin ventanas repite los partidos ya jugados de los días de fechasEspn (para probar); con ventanas, los de hoy en juego o recién acabados.
import { json } from '../lib/http.mjs';
import { norm, corto, fmt, partes, elegir, el, del, al, sinCierre } from '../lib/texto.mjs';
import { reconstruir, situacion, iba_perdiendo, minutoDe } from '../lib/relato.mjs';

const ESPN = process.env.ESPN_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const VACIAS = new Set(['de', 'fc', 'cf', 'club', 'real', 'ud', 'cd', 'rcd', 'la', 'del', 'el', 'y', 'sd', 'ad']);
const fichas = (s) => new Set(norm(s).split(' ').filter((t) => t && !VACIAS.has(t)));
const comparten = (a, b) => { const A = fichas(a), B = fichas(b); for (const t of A) if (B.has(t)) return true; return false; };

export function casarJugador(nombreEspn, lado) {
  const toks = norm(nombreEspn).split(' ').filter(Boolean);
  if (!toks.length) return null;
  const ps = lado.players || [];
  const de = (p) => new Set([...norm(p.name).split(' '), ...norm(p.nickname).split(' ')].filter(Boolean));
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

/** asistentes de cada gol, del resumen del partido de ESPN (keyEvents: «Assisted by X.»): { 'goleador|minuto': asistente } */
async function asistencias(evId) {
  const r = await json(`${ESPN}/summary?event=${evId}`).catch(() => null);
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

// Cómo se dice lo que ha supuesto cada gol (la situación sale del marcador de ese momento, no del actual).
const VERBO = { abre: 'abre el marcador', empata: 'empata el partido', adelanta: 'pone por delante a los suyos', voltea: 'da la vuelta al partido',
  recorta: 'recorta distancias', amplia: 'amplía la ventaja', sentencia: 'sentencia el partido' };
function fraseGol(sit, n, eq, semilla) {
  const E = { el: el(eq), del: del(eq), al: al(eq) };
  const v = {
    abre: [`${n} abre el marcador para ${E.el}.`, `${n} marca primero y adelanta ${E.al}.`, `Gol de ${n}: ${E.el} se pone por delante.`],
    empata: [`${n} empata el partido para ${E.el}.`, `${n} iguala el marcador.`, `Empata ${E.el} con gol de ${n}.`],
    adelanta: [`${n} pone por delante ${E.al}.`, `${n} adelanta ${E.al}.`, `Gol de ${n} y ${E.el} se pone por delante.`],
    voltea: [`${n} da la vuelta al partido para ${E.el}.`, `Remontada ${E.del}: ${n} lo pone por delante.`, `${n} completa la remontada ${E.del}.`],
    recorta: [`${n} recorta distancias para ${E.el}.`, `Gol de ${n}: ${E.el} no se rinde.`, `${n} le mete un gol más al partido.`],
    amplia: [`${n} amplía la ventaja ${E.del}.`, `${n} pone tierra de por medio para ${E.el}.`, `Otro gol para ${E.el}, de ${n}.`],
    sentencia: [`${n} sentencia el partido para ${E.el}.`, `${n} redondea la goleada ${E.del}.`, `Goleada ${E.del}: ${n} marca otro.`],
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
      // con el partido ya acabado, los puntos solo valen cuando están los DAZN: antes, los tweets esperan (los de durante el partido ya salieron)
      if (st.state === 'post' && dsps.length && dazn && !(await dazn(m)).listo) { console.log(`  (directo) ${ev.shortName}: acabado, espero a los puntos DAZN para sus ${dsps.length} tweets`); continue; }
      console.log(`  (directo) ${ev.shortName} · ${st.state === 'in' ? `en juego, ${(ev.status.displayClock || '')}` : 'acabado'} · ${casa.score}-${fuera.score} · ${dsps.length} cosas que contar`);
      const asis = dsps.some((d) => d.n && !d.asistente) ? await asistencias(ev.id) : {};
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
        const mom = rel.ok && rel.tras.get(dsp.ref);
        const [sl, sv] = mom ? mom.marcador : [gl, gv];
        const mar = `${corto(m.local.mainName)} ${sl}-${sv} ${corto(m.visitor.mainName)}`;
        const [propio, rival] = esCasa ? [sl, sv] : [sv, sl];
        const num = [mn.min, mn.extra, sl, sv, propio, rival].filter((x) => x != null);
        const sem = `directo${m.id}${dsp.jugador}${dsp.clase}${dsp.n || ''}`;
        const tarjetas = [];
        let cab, cuerpo = [];
        const puntos = (nom, valor, conMedia) => {
          num.push(valor);
          const sobre = conMedia && media >= 3 && valor >= 1.5 * media;
          if (sobre) num.push(...partes(media));
          if (valor <= 0) return `Para ${nom}, ${valor} puntos fantasy de momento.`;
          return `${elegir([`${nom} ya suma ${valor} puntos fantasy`, `${valor} puntos fantasy ya para ${nom}`, `Eso son ${valor} puntos fantasy para ${nom} de momento`], sem + 'p')}${sobre ? `. Su media es de ${fmt(media)}` : ''}.`;
        };
        if (dsp.clase === 'roja') {
          cab = `🟥 ${mar} · ${minTxt}`;
          const rojas = (mom && mom.rojas) || 1;
          const quedan = rojas === 1 ? 'diez' : rojas === 2 ? 'nueve' : null;
          if (quedan) num.push(rojas === 1 ? 10 : 9);
          const estado = propio < rival ? ' y encima va perdiendo' : propio > rival ? ', aunque gana el partido' : ' con el partido empatado';
          cuerpo.push(quedan ? `${nombre} ve la roja y ${el(equipo)} se queda con ${quedan}${estado}.` : `Expulsan a ${nombre} (${equipo}).`);
          if (pts != null) cuerpo.push(puntos(nombre, pts, false));
          if (p) tarjetas.push({ jugadorId: p.id, motivo: 'roja' });
        } else if (dsp.clase === 'penalti fallado') {
          cab = `❌ ${mar} · ${minTxt}`;
          const pudo = propio === rival ? 'que habría adelantado a su equipo' : propio < rival ? (rival - propio === 1 ? 'que habría empatado el partido' : 'que habría recortado distancias') : 'que habría ampliado la ventaja';
          cuerpo.push(`${nombre} (${equipo}) falla un penalti, ${pudo}.`);
          if (pts != null) cuerpo.push(puntos(nombre, pts, false));
          if (p) tarjetas.push({ jugadorId: p.id, motivo: 'penalti' });
        } else {
          cab = `${'⚽'.repeat(Math.min(dsp.n, 3))} ${mar} · ${minTxt}`;
          const sit = mom ? situacion(propio, rival, iba_perdiendo(rel, dsp.ref, esCasa)) : null;
          let frase;
          if (!sit) frase = `${{ gol: 'Gol', doblete: 'Doblete', triplete: 'Triplete' }[dsp.clase]} de ${nombre} (${equipo})${dsp.penalti ? ' de penalti' : ''}.`;
          else if (dsp.clase === 'gol') frase = fraseGol(sit, nombre, equipo, sem);
          else frase = `${dsp.clase === 'doblete' ? 'Doblete' : 'Triplete'} de ${nombre} (${equipo}), que ${VERBO[sit]}.`;
          if (dsp.penalti && sit) frase += ' Fue de penalti.';
          if (sit && ['empata', 'adelanta', 'voltea'].includes(sit) && mn.min >= 85) frase += mn.min >= 88 ? ' Casi sobre la bocina.' : ' Ya en el tramo final.';
          else if (sit === 'abre' && mn.min <= 6) frase += ' Apenas habían pasado unos minutos.';
          cuerpo.push(frase);
          if (p) tarjetas.push({ jugadorId: p.id, motivo: dsp.clase === 'doblete' ? 'doblete' : dsp.clase === 'triplete' ? 'triplete' : 'gol' });
          const an = dsp.asistente || asis[`${dsp.jugador}|${dsp.min}`] || null;
          if (an) {
            const pa = casarJugador(an, lado);
            const na = pa ? pa.nickname || pa.name : an;
            const ptsA = pa && pa.weekPoints != null && Number(pa.weekPoints) > 0 ? Number(pa.weekPoints) : null;
            if (ptsA != null) num.push(ptsA);
            cuerpo[0] += ' ' + (ptsA != null
              ? elegir([`Asistencia de ${na}, que ya suma ${ptsA}.`, `El pase, de ${na} (ya lleva ${ptsA}).`], sem + 'a')
              : elegir([`Asistencia de ${na}.`, `El pase, de ${na}.`, `Lo asistió ${na}.`], sem + 'a'));
            if (pa) tarjetas.push({ jugadorId: pa.id, motivo: 'asistencia' });
          }
          if (pts != null) cuerpo.push(puntos(nombre, pts, true));
        }
        const { usadas, texto } = sinCierre(cab, cuerpo);
        if (!usadas.length) continue;
        out.push({ tipo: 'directo', clave: `directo|${m.id}|${dsp.jugador}|${dsp.n ? `gol${dsp.n}` : dsp.clase}`, jornada, texto,
          numeros: num, casado: !!p, minuto: mn.min * 100 + mn.extra,
          // para las tarjetas de jugador (cada jugador implicado que case con LaLiga) y su marcador del momento
          partido: m.id, marcador: [sl, sv], tarjetas });
      }
    }
  }
  // en el orden en que pasaron (si en una ejecución salen varios, el primero el más antiguo)
  return out.sort((a, b) => a.minuto - b.minuto);
}
