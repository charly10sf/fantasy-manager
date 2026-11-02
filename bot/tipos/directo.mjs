// Directo: goles, rojas y penaltis fallados de ESPN (con minuto) casados con los puntos oficiales de LaLiga. Aquí se prueba
// repitiendo partidos ya jugados de la jornada; en directo se llamará igual con el marcador de cada momento.
import { json } from '../lib/http.mjs';
import { cierre } from '../lib/texto.mjs';
import { norm, corto } from '../lib/texto.mjs';

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

export async function generar({ stats, jornada, fechasEspn }) {
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
        const cab = `${dsp.clase === 'roja' ? '🟥' : dsp.clase === 'penalti fallado' ? '❌' : '⚽'} LaLiga Fantasy J${jornada} · ${dsp.clase[0].toUpperCase()}${dsp.clase.slice(1)} de ${nombre} (${corto(lado.mainName)}) en el ${min}'`;
        const lineas = [`${marcador}.${pts != null ? ` Lleva ${pts} pts.` : ''}`];
        out.push({ tipo: 'directo', clave: `directo|${m.id}|${dsp.jugador}|${dsp.clase}`, jornada, texto: [cab, ...lineas, cierre(`directo${m.id}${dsp.jugador}`)].join('\n'),
          numeros: [jornada, min, m.localScore, m.visitorScore, ...(pts != null ? [pts] : [])], casado: !!p });
      }
    }
  }
  return out;
}
