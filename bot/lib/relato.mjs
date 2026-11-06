// Reconstruye cómo fue un partido a partir de los `details` de ESPN (goles, rojas, penaltis) para poder escribir los tweets
// con el marcador del momento y una frase de cómo ha sido. Si algo no cuadra con el marcador final de ESPN, devuelve ok:false
// y quien lo use cae a un texto sin relato (nunca se inventa la secuencia).
import { json } from './http.mjs';
import { norm, corto } from './texto.mjs';

export const ESPN = process.env.ESPN_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const VACIAS = new Set(['de', 'fc', 'cf', 'club', 'real', 'ud', 'cd', 'rcd', 'la', 'del', 'el', 'y', 'sd', 'ad']);
const fichas = (s) => new Set(norm(s).split(' ').filter((t) => t && !VACIAS.has(t)));
export const comparten = (a, b) => { const A = fichas(a), B = fichas(b); for (const t of A) if (B.has(t)) return true; return false; };

const segs = (d) => { const c = d && d.clock; if (c && Number.isFinite(Number(c.value))) return Number(c.value); const m = String((c && c.displayValue) || '').match(/(\d+)(?:'?\+(\d+))?/); return m ? Number(m[1]) * 60 + Number(m[2] || 0) * 60 : 0; };

/** minuto de un detalle: { min: 90, extra: 3 } para «90'+3'» */
export function minutoDe(d) {
  const m = String((d.clock && d.clock.displayValue) || '').match(/(\d+)\s*'?\s*(?:\+\s*(\d+))?/);
  return m ? { min: Number(m[1]), extra: Number(m[2] || 0) } : { min: 0, extra: 0 };
}

/**
 * Recorre los detalles en orden de tiempo y apunta, para cada uno, el marcador en ese momento ([local, visitante], ya con el gol
 * si es un gol) y cuántas rojas llevaba su equipo (con la suya). Un autogol se atribuye al equipo que dice ESPN o al contrario:
 * se prueban las dos y se queda la que cuadra con el marcador final.
 */
export function reconstruir(detalles, casaId, fueraId, golesCasa, golesFuera) {
  const orden = detalles.map((d, i) => ({ d, i })).sort((a, b) => segs(a.d) - segs(b.d) || a.i - b.i).map((x) => x.d);
  for (const propia of ['igual', 'contrario']) {
    let c = 0, f = 0; const tras = new Map(); const rojas = {};
    for (const d of orden) {
      let eq = String(d.team && d.team.id);
      if (d.scoringPlay) {
        if (d.ownGoal && propia === 'contrario') eq = eq === String(casaId) ? String(fueraId) : String(casaId);
        if (eq === String(casaId)) c++; else if (eq === String(fueraId)) f++;
        tras.set(d, { marcador: [c, f] });
      } else if (d.redCard) {
        rojas[eq] = (rojas[eq] || 0) + 1;
        tras.set(d, { marcador: [c, f], rojas: rojas[eq] });
      } else tras.set(d, { marcador: [c, f] });
    }
    if (c === Number(golesCasa) && f === Number(golesFuera)) return { ok: true, tras, orden };
  }
  return { ok: false, tras: new Map(), orden };
}

/**
 * Qué ha supuesto un gol para el equipo que lo marca; [s, r] es el marcador tras el gol desde su punto de vista.
 * `iba_perdiendo`: el equipo ha ido por detrás en algún momento antes de este gol (así un gol que lo pone por delante es una remontada).
 */
export function situacion(s, r, iba_perdiendo = false) {
  const antes = s - 1;
  if (s + r === 1) return 'abre';
  if (s === r) return 'empata';
  if (antes === r && s > r) return iba_perdiendo ? 'voltea' : 'adelanta';
  if (s < r) return 'recorta';
  return s - r >= 3 ? 'sentencia' : 'amplia';
}

/** ¿ha ido ese equipo por detrás en el marcador antes de la jugada `ref`? (usa la secuencia reconstruida) */
export function iba_perdiendo(rel, ref, esCasa) {
  for (const d of rel.orden) {
    if (d === ref) return false;
    const mom = rel.tras.get(d); if (!mom) continue;
    const [c, f] = mom.marcador;
    if (esCasa ? c < f : f < c) return true;
  }
  return false;
}

/** El evento de ESPN de un partido de LaLiga (por los nombres de los equipos), con sus detalles; null si no se encuentra. */
export async function partidoEspn(m, fechaAAAAMMDD) {
  const sb = await json(`${ESPN}/scoreboard?dates=${fechaAAAAMMDD}`).catch(() => null);
  for (const ev of (sb && sb.events) || []) {
    const c = ev.competitions && ev.competitions[0]; if (!c) continue;
    const casa = c.competitors.find((x) => x.homeAway === 'home'), fuera = c.competitors.find((x) => x.homeAway === 'away');
    if (casa && fuera && comparten(m.local.mainName, casa.team.displayName) && comparten(m.visitor.mainName, fuera.team.displayName)) return { ev, c, casa, fuera };
  }
  return null;
}

/**
 * Los sucesos de un partido que no son goles y que mandan en un tuit (penaltis parados o fallados y rojas), de los `keyEvents` del
 * `summary` de ESPN (el `scoreboard` no los trae: el penalti parado del Sevilla-Alavés del 6 nov solo sale ahí). Es lo único que
 * puede contarse como «lo que pasó»: lo demás de un partido (VAR, lesiones, un cambio que lo decidió…) no está comprobado y no va.
 * `ident`: { casaId, fueraId, L, V, casar(nombreEspn, 'local'|'visitante') } con el nombre de LaLiga de quien se pueda casar.
 * Cada suceso: { minuto, suceso, equipo, jugador, ... }; las rojas solo con el equipo y el jugador, los penaltis con el lanzador y el portero.
 */
export function incidenciasDe(sumario, { casaId, fueraId, L, V, casar = () => null } = {}) {
  const out = [];
  for (const k of (sumario && sumario.keyEvents) || []) {
    const tipo = String((k.type && k.type.text) || '');
    const penalti = /^penalty/i.test(tipo) && !/scored|goal/i.test(tipo), roja = /red card|yellow.?red|second yellow/i.test(tipo);
    if (!penalti && !roja) continue;
    const eqId = String(k.team && k.team.id);
    const lado = eqId === String(casaId) ? 'local' : eqId === String(fueraId) ? 'visitante' : null;
    if (!lado) continue;
    const a = ((k.participants || [])[0] || {}).athlete;
    const nombre = (n) => { const p = n ? casar(n, lado) : null; return p ? p.nickname || p.name : n || null; };
    const mn = minutoDe(k);
    const minuto = mn.extra ? `${mn.min}+${mn.extra}'` : `${mn.min}'`;
    const equipo = lado === 'local' ? L : V, rival = lado === 'local' ? V : L;
    if (penalti) {
      const parado = /saved/i.test(tipo);
      const portero = parado ? ((String(k.text || '').match(/\bby ([^()]+?) \(/) || [])[1] || '').trim() : '';
      const porteroLaLiga = portero ? (() => { const p = casar(portero, lado === 'local' ? 'visitante' : 'local', { portero: true }); return p ? p.nickname || p.name : portero; })() : null;
      out.push({ minuto, suceso: parado ? 'penalti parado' : 'penalti fallado', equipoQueLoLanza: equipo, lanzador: nombre(a && a.displayName),
        ...(parado ? { porteroQueLoPara: porteroLaLiga, equipoDelPortero: rival } : {}) });
    } else out.push({ minuto, suceso: 'roja', equipo, jugador: nombre(a && a.displayName) });
  }
  return out;
}

/** el summary de ESPN de un evento (null si no llega) */
export const sumarioEspn = (ev) => (ev && ev.id ? json(`${ESPN}/summary?event=${ev.id}`).catch(() => null) : Promise.resolve(null));

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');
/** los sucesos de un partido de LaLiga (stats: `m`, con `local`/`visitor`); [] si ESPN no lo tiene o no llega. `casar`: como en `incidenciasDe` */
export async function incidenciasPartido(m, casar) {
  try {
    const e = await partidoEspn(m, diaMadrid(Date.parse(m.date)));
    if (!e) return [];
    return incidenciasDe(await sumarioEspn(e.ev), { casaId: e.casa.team.id, fueraId: e.fuera.team.id, L: corto(m.local.mainName), V: corto(m.visitor.mainName), casar });
  } catch { return []; }
}
