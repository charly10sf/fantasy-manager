// Directo: goles, rojas y penaltis fallados de ESPN (con minuto) casados con los puntos oficiales de LaLiga. Aquí se prueba
// repitiendo partidos ya jugados de la jornada; en directo se llamará igual con el marcador de cada momento.
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

export function disparadores(detalles) {
  const goles = new Map(); const out = [];
  for (const d of detalles) {
    const a = (d.athletesInvolved || [])[0];
    if (!a) continue;
    const min = (d.clock && d.clock.displayValue) || '';
    if (d.scoringPlay && !d.ownGoal) {
      const g = goles.get(a.displayName) || { n: 0, mins: [], equipo: d.team && d.team.id };
      g.n++; g.mins.push(min); goles.set(a.displayName, g);
    } else if (d.redCard) out.push({ clase: 'roja', jugador: a.displayName, min, equipo: d.team && d.team.id });
    else if (d.penaltyKick && !d.scoringPlay) out.push({ clase: 'penalti fallado', jugador: a.displayName, min, equipo: d.team && d.team.id });
  }
  for (const [jugador, g] of goles) if (g.n >= 2) out.push({ clase: g.n === 2 ? 'doblete' : g.n === 3 ? 'triplete' : `${g.n} goles`, jugador, min: g.mins[g.mins.length - 1], goles: g.n, equipo: g.equipo });
  return out;
}

export async function generar({ stats, jornada, fechasEspn, jugadores }) {
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  const out = [];
  for (const f of fechasEspn) {
    const sb = await json(`${ESPN}/scoreboard?dates=${f}`).catch(() => null);
    for (const ev of (sb && sb.events) || []) {
      if (!(ev.status && ev.status.type && ev.status.type.completed)) continue;
      const c = ev.competitions[0];
      const casa = c.competitors.find((x) => x.homeAway === 'home'), fuera = c.competitors.find((x) => x.homeAway === 'away');
      const m = stats.find((x) => comparten(x.local.mainName, casa.team.displayName) && comparten(x.visitor.mainName, fuera.team.displayName));
      if (!m) { console.log(`  (directo) sin casar ${ev.shortName} con LaLiga`); continue; }
      for (const dsp of disparadores(c.details || [])) {
        const lado = String(dsp.equipo) === String(casa.team.id) ? m.local : String(dsp.equipo) === String(fuera.team.id) ? m.visitor : null;
        if (!lado) continue;
        const p = casarJugador(dsp.jugador, lado);
        const nombre = p ? p.nickname || p.name : dsp.jugador;
        const pts = p && p.weekPoints != null ? Number(p.weekPoints) : null;
        const min = parseInt(dsp.min, 10);
        const marcador = `${corto(m.local.mainName)} ${m.localScore}-${m.visitorScore} ${corto(m.visitor.mainName)}`;
        const media = p && porId.get(String(p.id)) ? Number(porId.get(String(p.id)).averagePoints) || 0 : 0;
        const equipo = corto(lado.mainName);
        const cab = dsp.clase === 'roja' ? `🟥 ¡Roja para ${nombre} (${equipo}) en el ${min}'!`
          : dsp.clase === 'penalti fallado' ? `❌ ¡${nombre} (${equipo}) falla un penalti en el ${min}'!`
          : `${'⚽'.repeat(Math.min(dsp.goles || 2, 3))} ¡${dsp.clase === 'doblete' ? 'DOBLETE' : dsp.clase === 'triplete' ? 'TRIPLETE' : 'Goles'} de ${nombre} (${equipo})! Último en el ${min}'.`;
        const lineas = [`${marcador} · LaLiga Fantasy J${jornada}`];
        // la media solo si el partido la supera de verdad (ahora mismo suma 1,5 veces su media o más)
        const sobre = pts != null && media >= 3 && pts >= 1.5 * media && dsp.clase !== 'roja' && dsp.clase !== 'penalti fallado';
        if (pts != null) lineas.push(dsp.clase === 'roja' || dsp.clase === 'penalti fallado' ? `📊 Ahora mismo suma ${pts} pts.` : `📊 Ya suma ${pts} pts${sobre ? `, muy por encima de su media (${fmt(media)})` : ''}.`);
        out.push({ tipo: 'directo', clave: `directo|${m.id}|${dsp.jugador}|${dsp.clase}`, jornada, texto: armar(cab, lineas, cierre(`directo${m.id}${dsp.jugador}`)),
          numeros: [jornada, min, m.localScore, m.visitorScore, ...(pts != null ? [pts] : []), ...(sobre ? partes(media) : [])], casado: !!p,
          // para la tarjeta de jugador (solo dobletes y tripletes, y solo si el jugador casa con LaLiga)
          partido: m.id, jugadorId: p ? p.id : null, motivo: ['doblete', 'triplete'].includes(dsp.clase) ? dsp.clase : null });
      }
    }
  }
  return out;
}
