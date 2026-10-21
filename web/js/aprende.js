/* Aprender de los fallos.
   1) Antes de cada jornada se apunta lo que se espera de cada jugador que importa (los tuyos y los candidatos), con
      la fórmula de siempre y con el desglose por partes. Cuando la jornada se ha jugado, se compara con lo que sacó
      de verdad: de ahí sale cuánto pesa cada forma de calcularlo (la que más acierta, más) y el sesgo de cada
      puesto (si a los delanteros se les espera de más, se les baja). El motor lo usa en la siguiente pasada.
   2) De cada plan de la IA se guardan las operaciones con el valor del jugador ese día. Pasados unos días se mira
      cómo salió: si lo que te dijo que compraras subió o puntuó, y si lo que te dijo que vendieras bajó. La IA ve
      sus aciertos y sus fallos, y tú el porcentaje. */
import { LS, num, clamp, DIA, HORA, eur, pct } from './util.js';
import { K } from './datos.js';

export const previsiones = () => LS.get(K('previs'), {});
export const calibracion = () => LS.get(K('calib'), null);
const r1 = (x) => Math.round(x * 10) / 10;

/** lo que se espera de cada jugador para la próxima jornada (se rehace hasta que empieza) */
export function apuntarPrevision(D, M) {
  const p = M.proxima;
  if (!p || !M.ppDetalle || Date.now() >= p.ini) return;
  const pids = new Set([
    ...M.mias.map((x) => x.pid),
    ...M.mercado.slice(0, 15).map((m) => m.pid),
    ...M.clausulas.slice(0, 25).map((x) => x.pid),
    ...M.suben.slice(0, 10).map((x) => x.j.id),
  ]);
  const pp = {};
  for (const pid of pids) {
    const j = M.J(pid);
    if (!j || !j.pos || j.pos === 5) continue;
    const d = M.ppDetalle(j);
    if (d) pp[pid] = [r1(d.final), r1(d.base), d.desg != null ? r1(d.desg) : null, j.pos];
  }
  if (!Object.keys(pp).length) return;
  const P = previsiones();
  const mios = M.mias.map((x) => x.pid);
  P[p.n] = { t: Date.now(), ini: p.ini, pp, mios };
  for (const k of Object.keys(P).map(Number).sort((a, b) => b - a).slice(12)) delete P[k];
  LS.set(K('previs'), P);
}

/** los puntos que sacó en esa jornada (de su ficha o de la lista de LaLiga); null si no se sabe */
function realDe(D, det, pid, n) {
  const st = det && det[pid] && det[pid].stats;
  if (st && st.length) {
    const s = st.find((x) => x.n === n);
    if (s) return num(s.pts);
    if (st.some((x) => x.n > n)) return 0;
  }
  const sem = (D.maestro[pid] || {}).semanas;
  if (sem && sem.length) {
    const s = sem.find((x) => x.n === n);
    if (s) return num(s.pts);
    if (sem.some((x) => x.n > n)) return 0;
  }
  return null;
}

/** compara lo previsto con lo que pasó y recalcula la corrección (se guarda para la próxima pasada del motor) */
export function evaluarPrevisiones(D, M, det) {
  const P = previsiones();
  const pares = [];
  const porJornada = [];
  for (const [nS, x] of Object.entries(P)) {
    const n = +nS;
    const jo = (M.jornadas || []).find((y) => y.n === n);
    const jugada = jo ? Date.now() > jo.fin + 6 * HORA : !!(M.ultimaJornada && M.ultimaJornada.n >= n && Date.now() - x.ini > 3 * DIA);
    if (!jugada) continue;
    let prevMios = 0, realMios = 0, nMios = 0;
    for (const [pid, [fin, base, desg, pos]] of Object.entries(x.pp)) {
      const real = realDe(D, det, pid, n);
      if (real == null) continue;
      pares.push({ n, pid, pos, fin, base, desg, real });
      if ((x.mios || []).includes(pid)) { prevMios += fin; realMios += real; nMios++; }
    }
    if (nMios) porJornada.push({ n, previsto: r1(prevMios), real: realMios, jugadores: nMios });
  }
  if (pares.length < 8) return { pares: pares.length, poco: true, porJornada };
  const mae = (k, l = pares) => { const v = l.filter((x) => x[k] != null); return v.length ? v.reduce((s, x) => s + Math.abs(x[k] - x.real), 0) / v.length : null; };
  const conDes = pares.filter((x) => x.desg != null);
  const maeBase = mae('base', conDes.length >= 8 ? conDes : pares), maeDes = conDes.length >= 8 ? mae('desg', conDes) : null;
  // cuánto pesa el desglose: lo que acierte cada uno, sin ir a los extremos y con poca confianza si hay pocos datos
  let w = 0.5;
  if (maeDes != null && maeBase != null && maeBase + maeDes > 0) {
    const crudo = clamp(maeBase / (maeBase + maeDes), 0.2, 0.8);
    w = 0.5 + (crudo - 0.5) * Math.min(1, conDes.length / 80);
  }
  // el sesgo de cada puesto, con lo que saldría con el peso nuevo (sin la corrección vieja para no acumularla)
  const sesgo = {};
  for (const pos of [1, 2, 3, 4]) {
    const l = pares.filter((x) => x.pos === pos);
    if (l.length < 6) continue;
    const prev = l.reduce((s, x) => s + (x.desg != null ? w * x.desg + (1 - w) * x.base : x.base), 0);
    const real = l.reduce((s, x) => s + x.real, 0);
    // se arrastra hacia 1 con 25 puntos ficticios para que una jornada rara no lo mueva todo
    sesgo[pos] = Math.round(clamp((real + 25) / (prev + 25), 0.75, 1.25) * 100) / 100;
  }
  const fallos = [...pares].sort((a, b) => Math.abs(b.real - b.fin) - Math.abs(a.real - a.fin)).slice(0, 6)
    .map((x) => ({ ...x, nombre: (D.maestro[x.pid] || {}).nombre || x.pid }));
  const calib = {
    t: Date.now(), pares: pares.length, jornadas: [...new Set(pares.map((x) => x.n))].length,
    mae: { final: r1(mae('fin') || 0), base: maeBase != null ? r1(maeBase) : null, desg: maeDes != null ? r1(maeDes) : null },
    w: Math.round(w * 100) / 100, sesgo, porJornada: porJornada.sort((a, b) => a.n - b.n).slice(-8), fallos,
    // de cada 10 jugadores, en cuántos se acertó con un margen de 2 puntos
    dentro2: Math.round((pares.filter((x) => Math.abs(x.real - x.fin) <= 2).length / pares.length) * 100),
  };
  LS.set(K('calib'), calib);
  return calib;
}

/* ---------------- los aciertos de la IA ---------------- */
const COMPRA = new Set(['pujar', 'comprar', 'clausular']);
/** las operaciones que se van a medir de un plan (se guardan al crearlo) */
export function recsDe(ops, M) {
  return (ops || []).filter((o) => o.pid && !o.descartada && (COMPRA.has(o.accion) || o.accion === 'vender')).map((o) => {
    const j = M.J(o.pid);
    return { pid: o.pid, accion: o.accion, importe: o.importe || null, valor: j ? j.valor : null, nombre: j ? j.nombre : o.jugador, pts0: j ? num(j.puntos) : null, jornada: M.proxima ? M.proxima.n : null };
  });
}

/** cómo salió lo que te recomendó (de planes de hace 2 a 30 días) */
export function aciertosPlanes(D, M) {
  const P = LS.get(K('planes'), []);
  const ahora = Date.now();
  const vistos = new Set();
  const lista = [];
  for (const p of P) {
    if (!p.recs || ahora - p.t < 2 * DIA || ahora - p.t > 30 * DIA) continue;
    for (const r of p.recs) {
      const k = `${r.pid}|${r.accion}`;
      if (vistos.has(k) || !r.valor) continue;
      vistos.add(k);
      const j = D.maestro[r.pid];
      if (!j || !j.valor) continue;
      const dv = j.valor / r.valor - 1;
      // los puntos que ha hecho desde entonces (de la lista de LaLiga), por jornada
      const pts = r.pts0 != null ? num(j.puntos) - r.pts0 : null;
      const jornadas = r.jornada && M.ultimaJornada ? Math.max(0, M.ultimaJornada.n - r.jornada + 1) : 0;
      const ppj = pts != null && jornadas > 0 ? pts / jornadas : null;
      const hecho = (M.actividad || []).some((a) => a.esYo && a.pid === r.pid && a.t > p.t - HORA && a.t < p.t + 4 * DIA
        && (COMPRA.has(r.accion) ? ['compra', 'clausula'].includes(a.clase) : a.clase === 'venta'))
        || (COMPRA.has(r.accion) ? M.mias.some((x) => x.pid === r.pid) : !M.mias.some((x) => x.pid === r.pid));
      // comprar: bien si no ha perdido valor o si puntúa; vender: bien si ha bajado o no puntuaba
      const bien = COMPRA.has(r.accion) ? dv >= -0.01 || (ppj != null && ppj >= 6) : dv <= 0.01 || (ppj != null && ppj < 3);
      lista.push({ ...r, t: p.t, dv, ahora: j.valor, ppj, jornadas, hecho, bien });
    }
  }
  if (!lista.length) return null;
  const bien = lista.filter((x) => x.bien).length;
  const hechas = lista.filter((x) => x.hecho);
  return { n: lista.length, bien, pct: Math.round((bien / lista.length) * 100), hechas: hechas.length, bienHechas: hechas.filter((x) => x.bien).length, lista: lista.sort((a, b) => b.t - a.t) };
}

/** lo uno y lo otro, para la pantalla y para la IA */
export function aprender(D, M, det) {
  if (!D || !M) return null;
  try { apuntarPrevision(D, M); } catch (e) { /* nada */ }
  let prev = null, planes = null;
  try { prev = evaluarPrevisiones(D, M, det); } catch (e) { prev = null; }
  try { planes = aciertosPlanes(D, M); } catch (e) { planes = null; }
  M.aprende = { prev, planes };
  return M.aprende;
}

/** para la IA: cómo van las previsiones de la app y las recomendaciones de la IA */
export function aprendeTxt(M) {
  const A = M && M.aprende;
  if (!A || (!A.prev && !A.planes)) return '';
  const L = ['\nCÓMO VAN TUS ACIERTOS (úsalo para afinar; si fallas en algo, corrígelo):'];
  const p = A.prev;
  if (p && !p.poco) {
    L.push(`- Puntos esperados de la app: fallan de media ${String(p.mae.final).replace('.', ',')} pts por jugador; ${p.dentro2} % dentro de ±2 (${p.pares} jugadores en ${p.jornadas} jornadas).${p.mae.desg != null ? ` El desglose por partes falla ${String(p.mae.desg).replace('.', ',')} y la fórmula de siempre ${String(p.mae.base).replace('.', ',')}: pesa ${Math.round(p.w * 100)} % el desglose.` : ''}`);
    const ses = Object.entries(p.sesgo || {}).filter(([, f]) => Math.abs(f - 1) >= 0.05).map(([pos, f]) => `${['', 'porteros', 'defensas', 'medios', 'delanteros'][pos]} ${f > 1 ? 'sacan más' : 'sacan menos'} de lo esperado (×${String(Math.round(f * 100) / 100).replace('.', ',')})`);
    if (ses.length) L.push(`- Sesgo corregido: ${ses.join('; ')}.`);
    if (p.porJornada && p.porJornada.length) L.push(`- Tu once, previsto frente a real: ${p.porJornada.map((x) => `J${x.n} ${String(x.previsto).replace('.', ',')}→${x.real}`).join(' · ')}.`);
    if (p.fallos && p.fallos.length) L.push(`- Los mayores fallos: ${p.fallos.slice(0, 4).map((x) => `${x.nombre} J${x.n}: esperados ${String(x.fin).replace('.', ',')}, sacó ${x.real}`).join('; ')}.`);
  }
  const q = A.planes;
  if (q && q.n) {
    L.push(`- Tus recomendaciones de hace 2 a 30 días: ${q.bien} de ${q.n} salieron bien (${q.pct} %); de las que hizo, ${q.bienHechas} de ${q.hechas}.`);
    for (const x of q.lista.slice(0, 8)) {
      L.push(`  · ${x.accion} ${x.nombre} (${new Date(x.t).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}) a ${eur(x.valor)} → ahora ${eur(x.ahora)} (${pct(x.dv * 100)})${x.ppj != null ? `, ${String(Math.round(x.ppj * 10) / 10).replace('.', ',')} pts/jornada` : ''}: ${x.bien ? 'BIEN' : 'MAL'}${x.hecho ? '' : ' (no lo hizo)'}`);
    }
  }
  return L.length > 1 ? L.join('\n') : '';
}

