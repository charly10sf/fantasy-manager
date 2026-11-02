// Directo: goles (con asistente), rojas y penaltis fallados de ESPN (con minuto) casados con los puntos oficiales de LaLiga.
// Sin ventanas repite los partidos ya jugados de los días de fechasEspn (para probar); con ventanas, los de hoy en juego o recién acabados.
import { json } from '../lib/http.mjs';
import { cierre, norm, corto, armar, fmt, partes } from '../lib/texto.mjs';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const VACIAS = new Set(['de', 'fc', 'cf', 'club', 'real', 'ud', 'cd', 'rcd', 'la', 'del', 'el', 'y', 'sd', 'ad']);
const fichas = (s) => new Set(norm(s).split(' ').filter((t) => t && !VACIAS.has(t)));
const comparten = (a, b) => { const A = fichas(a), B = fichas(b); for (const t of A) if (B.has(t)) return true; return false; };

export function casarJugador(nombreEspn, lado) {
  const toks = norm(nombreEspn).split(' ').filter(Boolean);
  if (!toks.length) return null;
  const ape = toks[toks.length - 1];
  const cand = (lado.players || []).filter((p) => norm(p.name).split(' ').includes(ape) || norm(p.nickname).split(' ').includes(ape));
  if (cand.length === 1) return cand[0];
  const con = cand.filter((p) => toks.slice(0, -1).some((t) => norm(p.name).split(' ').includes(t)));
  return con.length === 1 ? con[0] : null;
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
      out.push({ clase: n === 2 ? 'doblete' : n === 3 ? 'triplete' : 'gol', n, jugador: a.displayName, min, equipo: d.team && d.team.id, penalti: !!d.penaltyKick,
        asistente: (d.athletesInvolved[1] && d.athletesInvolved[1].displayName) || null });
    } else if (d.redCard) out.push({ clase: 'roja', jugador: a.displayName, min, equipo: d.team && d.team.id });
    else if (d.penaltyKick && !d.scoringPlay) out.push({ clase: 'penalti fallado', jugador: a.displayName, min, equipo: d.team && d.team.id });
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

/**
 * ventanas: en directo solo los partidos en juego o empezados hace menos de 3 h (al activar no se sueltan goles viejos).
 * fechasEspn: días del marcador de ESPN (AAAAMMDD); con ventanas, hoy en Madrid.
 */
export async function generar({ stats, jornada, fechasEspn, jugadores, desdeDirecto = 0, ahora = Date.now() }) {
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
      const asis = dsps.some((d) => d.n && !d.asistente) ? await asistencias(ev.id) : {};
      // el marcador de ESPN, que va al momento (el de LaLiga puede ir por detrás)
      const gl = Number(casa.score), gv = Number(fuera.score);
      const marcador = `${corto(m.local.mainName)} ${gl}-${gv} ${corto(m.visitor.mainName)}`;
      const acabado = st.state === 'post';
      for (const dsp of dsps) {
        const lado = String(dsp.equipo) === String(casa.team.id) ? m.local : String(dsp.equipo) === String(fuera.team.id) ? m.visitor : null;
        if (!lado) continue;
        const p = casarJugador(dsp.jugador, lado);
        const nombre = p ? p.nickname || p.name : dsp.jugador;
        // los puntos solo si LaLiga ya los ha movido (un gol nunca deja 0 o menos: si sale eso, aún no se han actualizado)
        let pts = p && p.weekPoints != null ? Number(p.weekPoints) : null;
        if (dsp.n && pts != null && pts <= 0) pts = null;
        const min = parseInt(dsp.min, 10) || 0;
        const media = p && porId.get(String(p.id)) ? Number(porId.get(String(p.id)).averagePoints) || 0 : 0;
        const equipo = corto(lado.mainName);
        const num = [jornada, min, gl, gv];
        let cab;
        const lineas = [`${marcador}${acabado ? ' (final)' : ''} · LaLiga Fantasy J${jornada}`];
        if (dsp.clase === 'roja') cab = `🟥 ¡Roja para ${nombre} (${equipo}) en el ${min}'!`;
        else if (dsp.clase === 'penalti fallado') cab = `❌ ¡${nombre} (${equipo}) falla un penalti en el ${min}'!`;
        else {
          const que = dsp.clase === 'doblete' ? 'DOBLETE' : dsp.clase === 'triplete' ? 'TRIPLETE' : 'Gol';
          cab = `${'⚽'.repeat(Math.min(dsp.n, 3))} ¡${que} de ${nombre} (${equipo})${dsp.penalti ? ' de penalti' : ''}! ${min}'`;
          const an = dsp.asistente || asis[`${dsp.jugador}|${dsp.min}`] || null;
          if (an) {
            const pa = casarJugador(an, lado);
            const ptsA = pa && pa.weekPoints != null && Number(pa.weekPoints) > 0 ? Number(pa.weekPoints) : null;
            lineas.push(`🅰️ Asistencia de ${pa ? pa.nickname || pa.name : an}${ptsA != null ? ` (${ptsA} pts)` : ''}.`);
            if (ptsA != null) num.push(ptsA);
          }
        }
        // la media solo si el partido la supera de verdad (ahora mismo suma 1,5 veces su media o más)
        const sobre = pts != null && media >= 3 && pts >= 1.5 * media && dsp.n;
        if (pts != null) {
          lineas.push(dsp.n ? `📊 ${nombre} ya suma ${pts} pts fantasy${sobre ? `, muy por encima de su media (${fmt(media)})` : ''}.` : `📊 Ahora mismo suma ${pts} pts fantasy.`);
          num.push(pts); if (sobre) num.push(...partes(media));
        }
        out.push({ tipo: 'directo', clave: `directo|${m.id}|${dsp.jugador}|${dsp.n ? `gol${dsp.n}` : dsp.clase}`, jornada, texto: armar(cab, lineas, cierre(`directo${m.id}${dsp.jugador}${dsp.n || ''}`)),
          numeros: num, casado: !!p, minuto: min,
          // para la tarjeta de jugador (solo dobletes y tripletes, y solo si el jugador casa con LaLiga)
          partido: m.id, marcador: [gl, gv], jugadorId: p ? p.id : null, motivo: ['doblete', 'triplete'].includes(dsp.clase) ? dsp.clase : null });
      }
    }
  }
  // en el orden en que pasaron (si en una ejecución salen varios, el primero el más antiguo)
  return out.sort((a, b) => a.minuto - b.minuto);
}
