/* El banco de medida del motor con los datos de una liga de verdad (claude/prompt-ia-con-datos.md, fase 1).
   Para cada día pasado rehace lo que el motor habría dicho ese día (con el reloj puesto en ese momento y la liga como
   estaba: valores de ese día, plantillas deshechas hacia atrás con la actividad, el saldo y los puntos de entonces) y
   lo compara con lo que pasó después. Mide ocho piezas: inercia, puntos esperados, la puja que gana, la oferta de
   LaLiga, el dinero de los rivales, el peligro, lo que manda vender y los puntos de la jornada frente al valor de después.

   LOS DATOS NO VAN EN EL REPO (es público). Dos maneras de usarlo:
   - En node, con el archivo que se saca de la app (las claves fm-* de localStorage sin el prefijo, como lo deja
     `datosDePagina`) en /tmp:  node .github/ia/medir-motor.mjs /tmp/fm-medida.json [pieza,pieza…] > /tmp/medida.json
   - En la página de la app (fantasymanagerapp.com con la sesión), importado por Blob URL:
       const B = await import(blob); window.__m = await B.medir(B.datosDePagina(), { analizar, ofertaDueno, ventasInercia, U })
     con analizar y ofertaDueno de motor.js, ventasInercia de acciones.js y U = util.js.
   Para las jornadas pasadas hace falta su calendario (D.resultados no trae la hora): en la página, X.calPasado =
   await calendarioPasado(api, normalizar, S.D) antes de medir. Lo que devuelve son cifras agregadas y ejemplos con nombres de jugadores (nunca de mánagers). */

const DIA = 864e5, HORA = 36e5;
const CLAVES = ['acthist', 'calib', 'datos', 'det', 'dinero-cal', 'dinero-dicho', 'hist', 'previs', 'pujas-cal', 'pujas-mias', 'avanzadas', 'cfg'];

export function datosDePagina(ls = globalThis.localStorage) {
  const o = { sacado: Date.now() };
  for (const k of CLAVES) { const v = ls.getItem('fm-' + k); if (v != null) { try { o[k] = JSON.parse(v); } catch (e) { o[k] = v; } } }
  return o;
}

/** el calendario de las jornadas jugadas, con la hora de cada partido (con la API de la app y su sesión) */
export async function calendarioPasado(A, N, D) {
  const out = [];
  for (let n = 1; n < (D.jornada || 1); n++) for (const p of N.partidos(await A.api.calendario(n), D.equipos, n)) out.push({ jornada: p.jornada, localId: p.localId, visitanteId: p.visitanteId, fecha: p.fecha });
  return out;
}

/* ---------- cuentas ---------- */
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const q = (l, p) => { if (!l.length) return null; const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100), r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const kE = (x) => (x == null ? null : Math.round(x / 1e3)); // en miles de euros
/** error medio, sesgo (lo previsto menos lo que pasó) y cuántos, de pares { p, r } */
const errores = (l, f = (x) => x) => (l.length ? { n: l.length, mae: f(media(l.map((x) => Math.abs(x.p - x.r)))), sesgo: f(media(l.map((x) => x.p - x.r)))} : { n: 0 });
/** AUC: la probabilidad de que un caso positivo tenga más nota que uno negativo (0,5 = al azar) */
function auc(l) {
  const pos = l.filter((x) => x.y), neg = l.filter((x) => !x.y);
  if (!pos.length || !neg.length) return null;
  let s = 0;
  for (const a of pos) for (const b of neg) s += a.s > b.s ? 1 : a.s === b.s ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
const TRAMOS = [[0, 1e6, '<1M'], [1e6, 3e6, '1-3M'], [3e6, 10e6, '3-10M'], [10e6, 30e6, '10-30M'], [30e6, Infinity, '>30M']];
const tramo = (v) => (TRAMOS.find(([a, b]) => v >= a && v < b) || TRAMOS[0])[2];
function porGrupo(l, g, f) { const o = {}; for (const x of l) (o[g(x)] ||= []).push(x); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])); }

/* ---------- preparar: lo de ahora, las series de valor y las jornadas ---------- */
export function preparar(X, ctx) {
  const { analizar, U } = ctx;
  const D0 = X.datos, H0 = X.hist || { v: {}, eq: {}, yo: [], mov: [] }, AH = X.acthist, det = X.det || {};
  const c = ctx.c || X.cfg || { deuda: 20 };
  const extra0 = { det, actHist: AH, calib: X.calib || null, dichos: X['dinero-dicho'] || {}, calDinero: (X['dinero-cal'] || {}).cal, calPujas: (X['pujas-cal'] || {}).cal, pujasMias: X['pujas-mias'] || {} };
  // con toda la actividad en D.actividad, para que el motor marque los clausulazos (los traspasos que lo son)
  const Mfull = analizar({ ...D0, actividad: AH.lista }, H0, c, extra0);
  const M0 = analizar(D0, H0, c, extra0);
  const serie = {};
  for (const [pid, s] of Object.entries(H0.v || {})) { const m = (serie[pid] ||= new Map()); for (const [d, v] of s) if (v) m.set(d, v); }
  for (const [pid, x] of Object.entries(det)) for (const [t, v] of x.valores || []) if (v) (serie[pid] ||= new Map()).set(U.diaDe(t), v);
  const vDia = (pid, d) => (serie[pid] && serie[pid].get(d)) || null;
  const vEn = (pid, t) => { const d = U.diaDe(t); for (let k = 0; k <= 2; k++) { const x = vDia(pid, U.otroDia(d, -k)); if (x) return x; } return null; };
  const maxEntre = (pid, t0, t1) => { let m = 0; const d0 = U.diaDe(t0), d1 = U.diaDe(t1); for (const [d, v] of serie[pid] || []) if (d >= d0 && d <= d1 && v > m) m = v; return m; };
  const yo = D0.yo.teamId;
  const tid = (id, n) => (id || n ? M0.teamDeUsuario(id, n) : null);
  const evs = AH.lista.filter((a) => a.t && a.pid && ['compra', 'clausula', 'venta'].includes(a.clase))
    .map((a) => ({ ...a, imp: Math.abs(num(a.importe)), q: tid(a.quienId, a.quien), o: a.otroId || a.otro ? tid(a.otroId, a.otro) : null })).sort((a, b) => a.t - b.t);
  const compraDe = new Set(evs.filter((a) => a.clase !== 'venta' && a.o).map((a) => `${a.pid}|${a.imp}|${a.o}`));
  const premios = AH.lista.filter((a) => a.clase === 'premio' && a.t).map((a) => ({ t: a.t, q: tid(a.quienId, a.quien), imp: Math.abs(num(a.importe)) }));
  // los clausulazos de verdad (con la marca del motor)
  const czs = Mfull.actividad.filter((a) => a.clase === 'clausula' && a.t && a.quienT).map((a) => ({ t: a.t, q: a.quienT, o: a.otroT || null, pid: a.pid, imp: Math.abs(num(a.importe)) }));
  const czSet = new Set(Mfull.actividad.filter((a) => a.clase === 'clausula').map((a) => a.id || `${a.t}|${a.pid}`));
  // las jornadas, con todos los partidos (los jugados y los que faltan): el bloque más grande de fechas
  const fx = new Map();
  // (D.resultados no lleva la hora de cada partido: la de las jornadas pasadas va en X.calPasado, el calendario de LaLiga
  // de cada jornada, que se pide aparte con la sesión: `calendarioPasado`)
  for (const p of [...(X.calPasado || []), ...(D0.resultados || []), ...(D0.partidos || [])]) if (p.fecha) fx.set(`${p.jornada}|${p.localId}|${p.visitanteId}`, p);
  const porJ = {};
  for (const p of fx.values()) (porJ[p.jornada] ||= []).push(p);
  const jor = Object.entries(porJ).map(([n, ps]) => {
    const o = ps.map((p) => p.fecha).sort((a, b) => a - b), g = [[o[0]]];
    for (let i = 1; i < o.length; i++) { if (o[i] - o[i - 1] > 3 * DIA) g.push([]); g[g.length - 1].push(o[i]); }
    const b = g.reduce((m, x) => (x.length > m.length ? x : m), g[0]);
    return { n: +n, ini: b[0], fin: b[b.length - 1] + 2 * HORA };
  }).sort((a, b) => a.ini - b.ini);
  const fechaDe = (p) => { const x = fx.get(`${p.jornada}|${p.localId}|${p.visitanteId}`); return x ? x.fecha : null; };
  return { X, D0, H0, AH, det, c, extra0, M0, Mfull, fechaDe, serie, vDia, vEn, maxEntre, yo, tid, evs, compraDe, premios, czs, czSet, fixtures: [...fx.values()], jor, ctx };
}

const hechaAntes = (P, T) => Math.max(0, ...P.jor.filter((j) => j.fin < T).map((j) => j.n));

/* ---------- la liga como estaba en el momento T ---------- */
export function pasado(P, T, opc = {}) {
  const { U } = P.ctx;
  const { D0, H0, AH, det } = P;
  const dT = U.diaDe(T);
  const nHecha = hechaAntes(P, T);
  // las plantillas: se deshace hacia atrás todo lo de después de T
  const pl = {};
  for (const [t, fs] of Object.entries(D0.plantillas || {})) pl[t] = new Map(fs.map((f) => [f.pid, { ...f, _hoy: true }]));
  for (let i = P.evs.length - 1; i >= 0; i--) {
    const a = P.evs[i];
    if (a.t <= T) break;
    if (a.clase === 'venta') {
      if (a.o || P.compraDe.has(`${a.pid}|${a.imp}|${a.q}`)) continue;
      if (a.q && pl[a.q]) pl[a.q].set(a.pid, { pid: a.pid });
    } else {
      if (a.q && pl[a.q]) pl[a.q].delete(a.pid);
      if (a.o && pl[a.o]) pl[a.o].set(a.pid, { pid: a.pid });
    }
  }
  // la cláusula y la protección de entonces: la del fichaje (o su valor al empezar la liga), subida sola hasta lo más que
  // valió hasta T, y las subidas pagadas que se vieron antes de T
  const blinda = (H0.mov || []).filter((m) => m.tipo === 'blinda' && m.a > m.de && !(m.vA && m.a <= m.vA * 1.02));
  const plantillas = {};
  for (const [t, m] of Object.entries(pl)) {
    plantillas[t] = [...m.values()].map((f) => {
      let acq = null;
      for (const a of P.evs) { if (a.t > T) break; if (a.pid === f.pid && a.q === t && a.clase !== 'venta') acq = a; }
      const t0 = acq ? acq.t : AH.desde;
      const base = acq ? Math.max(acq.imp, P.vEn(f.pid, acq.t) || 0, 1e6) : Math.max(P.vEn(f.pid, AH.desde) || 0, 1e6);
      let cl = Math.max(base, P.maxEntre(f.pid, t0, T));
      const sub = blinda.filter((b) => b.teamId === t && b.pid === f.pid && b.t > t0 && b.t <= T).pop();
      if (sub) cl = Math.max(cl, sub.a);
      const despues = blinda.some((b) => b.teamId === t && b.pid === f.pid && b.t > T);
      if (f._hoy && !despues && f.clausula > cl && f.clausula > P.maxEntre(f.pid, t0, Date.now()) * 1.02) cl = f.clausula;
      const prot = acq ? acq.t + 14 * DIA : null;
      return { pid: f.pid, ptId: f.ptId, clausula: Math.round(cl), protegidoHasta: prot && prot > T ? prot : null, compra: acq ? acq.imp : null };
    });
  }
  // los valores de ese día
  const maestro = {};
  for (const [pid, j] of Object.entries(D0.maestro || {})) {
    const v = P.vEn(pid, T);
    // (lo de la temporada, solo con las jornadas acabadas antes de T: si no, la media ya sabe lo que va a pasar)
    if (!Array.isArray(j.semanas)) { maestro[pid] = { ...j, valor: v || j.valor, _sinValor: !v }; continue; }
    const sem = j.semanas.filter((s) => s.n <= nHecha);
    const pts = sem.reduce((s, x) => s + num(x.pts), 0);
    maestro[pid] = { ...j, valor: v || j.valor, _sinValor: !v, semanas: sem, puntos: pts, media: sem.length ? Math.round((pts / sem.length) * 10) / 10 : 0 };
  }
  // tu saldo: el de ahora menos lo que se movió después (las recompensas diarias, como si las hubieras cogido todas). Así
  // la base de la cuenta del dinero de los rivales es la misma de ahora; el que guardó la app ese día es de otra hora
  // (con un fichaje de por medio se va decenas de millones: `comprobar`) y solo se usa con opc.saldoApp
  const yoS = (H0.yo || []).find((x) => x[0] === dT);
  let dinero;
  if (yoS && opc.saldoApp) dinero = yoS[1];
  else {
    const fl = ((P.M0.flujos || {})[P.yo] || { ev: [] }).ev.filter(([t]) => t > T).reduce((s, [, x]) => s + x, 0);
    const subidas = blinda.filter((b) => b.teamId === P.yo && b.t > T).reduce((s, b) => s + (b.a - b.de) / 2, 0);
    dinero = num(D0.dinero) - fl - P.M0.recompensas(T, D0.t || Date.now()) + subidas;
  }
  const valorDe = (t) => (plantillas[t] || []).reduce((s, f) => s + num((maestro[f.pid] || {}).valor), 0);
  const clasif = D0.clasif.map((e) => {
    const h = ((H0.eq || {})[e.teamId] || []).filter(([d]) => d <= dT).pop();
    const premiosDesp = P.premios.filter((p) => p.q === e.teamId && p.t > T).reduce((s, p) => s + p.imp, 0);
    const conH = h && h[0] >= U.otroDia(dT, -1);
    return { ...e, valor: conH ? h[1] : valorDe(e.teamId), puntos: conH ? h[2] : Math.round(num(e.puntos) - premiosDesp / 1e5), dinero: undefined, puntosVivo: undefined, puntosJornada: undefined };
  });
  [...clasif].sort((a, b) => b.puntos - a.puntos).forEach((e, i) => { e.pos = i + 1; });
  const resultados = (D0.resultados || []).filter((p) => { const f = P.fechaDe(p); return f ? f + 2 * HORA < T : p.jornada <= nHecha; });
  const nProx = (P.jor.find((j) => j.fin >= T) || {}).n || D0.jornada;
  const D = {
    ...D0, t: T, maestro, plantillas, clasif, mercado: [], misVentas: [], tendencias: {}, tendenciasT: null, dineros: {},
    dinero, valorEquipo: valorDe(P.yo), partidos: P.fixtures, resultados, jornada: nProx, avisos: [], plantillasViejas: null,
    actividad: AH.lista.filter((a) => a.t && a.t <= T && T - a.t < 12 * DIA).sort((a, b) => b.t - a.t),
  };
  const H = {
    v: Object.fromEntries(Object.entries(H0.v || {}).map(([pid, s]) => [pid, s.filter(([d]) => d <= dT)])),
    eq: Object.fromEntries(Object.entries(H0.eq || {}).map(([t, s]) => [t, s.filter(([d]) => d <= dT)])),
    yo: (H0.yo || []).filter(([d]) => d <= dT), mov: (H0.mov || []).filter((m) => m.t <= T),
  };
  const detT = {};
  for (const [pid, x] of Object.entries(det)) detT[pid] = { ...x, stats: (x.stats || []).filter((s) => s.n <= nHecha), valores: (x.valores || []).filter(([t]) => U.diaDe(t) <= dT) };
  const dichos = Object.fromEntries(Object.entries(P.extra0.dichos || {}).filter(([, dc]) => dc && dc.t && dc.t <= T));
  const pujasMias = Object.fromEntries(Object.entries(P.extra0.pujasMias || {}).filter(([, p]) => p && p.t && p.t <= T));
  // (opc.vivo) los puntos de los partidos de la jornada en juego que ya han acabado, como los da el directo
  let vivo = null;
  if (opc.vivo) {
    const jo = P.jor.find((j) => j.ini <= T && T <= j.fin);
    if (jo) {
      const acabados = new Set();
      for (const p of P.fixtures) if (p.jornada === jo.n && p.fecha && p.fecha + 2 * HORA <= T) { acabados.add(String(p.localId)); acabados.add(String(p.visitanteId)); }
      const puntos = {};
      for (const j of Object.values(D0.maestro || {})) { if (!acabados.has(String(j.equipoId))) continue; const sm = (j.semanas || []).find((x) => x.n === jo.n); if (sm) puntos[j.id] = num(sm.pts); }
      vivo = { n: jo.n, t: T, puntos };
    }
  }
  const extra = {
    det: detT, actHist: { ...AH, lista: AH.lista.filter((a) => a.t && a.t <= T) }, calib: opc.calib === undefined ? null : opc.calib,
    dichos, calDinero: P.extra0.calDinero, calPujas: P.extra0.calPujas, pujasMias, avanzadas: opc.avanzadas ? P.X.avanzadas : null,
    reventa: {}, notas: [], onces: null, alineaciones: null, vivo, noticias: null,
  };
  return { D, H, extra, nHecha, nProx };
}

/** el motor como habría salido en T (con el reloj puesto en T) */
export function motorEn(P, T, opc = {}) {
  const k = `${T}|${opc.calib === undefined ? '' : 'c'}|${opc.avanzadas ? 'a' : ''}|${opc.vivo ? 'v' : ''}`;
  P.cache ||= new Map();
  if (P.cache.has(k)) return P.cache.get(k);
  const { D, H, extra, nHecha, nProx } = pasado(P, T, opc);
  const real = Date.now;
  let M;
  try { Date.now = () => T; M = P.ctx.analizar(D, H, P.c, extra); } finally { Date.now = real; }
  const r = { M, D, nHecha, nProx };
  P.cache.set(k, r);
  if (P.cache.size > 40) P.cache.delete(P.cache.keys().next().value);
  return r;
}
const reloj = (T, f) => { const real = Date.now; try { Date.now = () => T; return f(); } finally { Date.now = real; } };

/* ---------- los días que se rehacen: a las 21:00 de Madrid ---------- */
function dias(P, desde, hasta) {
  const { U } = P.ctx;
  const out = [];
  for (let d = desde; d <= hasta; d = U.otroDia(d, 1)) out.push(U.mediodia(d) + 9 * HORA);
  return out;
}

/* ===================== 1. la inercia ===================== */
function medirInercia(P, T0, T1, o = {}) {
  const { U } = P.ctx;
  const pares = [];
  for (const T of dias(P, T0, T1)) {
    const { M } = motorEn(P, T, o);
    const d = U.diaDe(T), d7 = U.otroDia(d, 7), d3 = U.otroDia(d, 3);
    for (const pid of Object.keys(P.serie)) {
      const v = P.vDia(pid, d), v7 = P.vDia(pid, d7), v3 = P.vDia(pid, d3);
      if (!v || !v7) continue;
      const j = M.J(pid);
      if (!j || !j.pos || j.pos > 4) continue;
      const x = M.inercia(pid);
      if (!x) continue;
      const t = M.tend(pid);
      const vm7 = P.vDia(pid, U.otroDia(d, -7));
      pares.push({ pid, T, v, fase: x.fase, p7: x.proy(7), p3: x.proy(3), r7: v7 - v, r3: v3 ? v3 - v : null, d7: vm7 ? v - vm7 : null, ult: x.ult, quieto: x.quieto, vende: !!M.ventaPorInercia(pid), nombre: j.nombre });
    }
  }
  const resumen = (l) => {
    const e = errores(l.map((x) => ({ p: x.p7, r: x.r7 })), kE);
    const e0 = errores(l.map((x) => ({ p: 0, r: x.r7 })), kE);
    const conD7 = l.filter((x) => x.d7 != null);
    const eS = errores(conD7.map((x) => ({ p: 0.5 * x.d7, r: x.r7 })), kE);
    const pct = errores(l.map((x) => ({ p: x.p7 / x.v, r: x.r7 / x.v })), (y) => r1(y * 100));
    const signo = l.filter((x) => Math.abs(x.r7) > x.quieto * 3 && Math.abs(x.p7) > x.quieto);
    const e3 = errores(l.filter((x) => x.r3 != null).map((x) => ({ p: x.p3, r: x.r3 })), kE);
    return { n: l.length, mae7k: e.mae, sesgo7k: e.sesgo, mae7pct: pct.mae, sesgo7pct: pct.sesgo, mae7_cero_k: e0.mae, mae7_mitadSemana_k: eS.mae, mae3k: e3.mae, sesgo3k: e3.sesgo,
      aciertoSigno: signo.length ? r2(signo.filter((x) => Math.sign(x.p7) === Math.sign(x.r7)).length / signo.length) : null, nSigno: signo.length,
      realMedio7k: kE(media(l.map((x) => x.r7))), previstoMedio7k: kE(media(l.map((x) => x.p7))) };
  };
  const vende = pares.filter((x) => x.vende);
  const peores = [...pares].sort((a, b) => Math.abs(b.p7 - b.r7) - Math.abs(a.p7 - a.r7)).slice(0, 6)
    .map((x) => ({ nombre: x.nombre, dia: U.diaDe(x.T), fase: x.fase, valorM: r1(x.v / 1e6), previstoM: r2(x.p7 / 1e6), realM: r2(x.r7 / 1e6) }));
  return {
    total: resumen(pares), porFase: porGrupo(pares, (x) => x.fase, resumen), porPrecio: porGrupo(pares, (x) => tramo(x.v), resumen),
    vender: { n: vende.length, bajaron7: vende.length ? r2(vende.filter((x) => x.r7 < 0).length / vende.length) : null, cambioMedio7k: kE(media(vende.map((x) => x.r7))), cambioMedio3k: kE(media(vende.filter((x) => x.r3 != null).map((x) => x.r3))) },
    peores, _pares: pares,
  };
}

/* ===================== 2. los puntos esperados ===================== */
function realDe(P, pid, n) {
  const st = P.det[pid] && P.det[pid].stats;
  if (st && st.length) { const s = st.find((x) => x.n === n); if (s) return { pts: num(s.pts), min: num(s.min) }; if (st.some((x) => x.n > n)) return { pts: 0, min: 0 }; }
  const sem = (P.D0.maestro[pid] || {}).semanas;
  if (sem && sem.length) { const s = sem.find((x) => x.n === n); if (s) return { pts: num(s.pts), min: null }; if (sem.some((x) => x.n > n)) return { pts: 0, min: null }; }
  return null;
}
function medirPuntos(P, nDesde, nHasta, opc = {}) {
  const pares = [];
  for (const jo of P.jor.filter((j) => j.n >= nDesde && j.n <= nHasta)) {
    const T = jo.ini - 3 * HORA;
    const { M, D } = motorEn(P, T, opc);
    if (!M.proxima || M.proxima.n !== jo.n) continue;
    const enLiga = new Set(Object.values(D.plantillas).flat().map((f) => f.pid));
    for (const j of Object.values(D.maestro)) {
      if (!j.pos || j.pos > 4 || j._sinValor) continue;
      const liga = enLiga.has(j.id);
      if (!liga && num(j.valor) < 3e6) continue;
      const r = realDe(P, j.id, jo.n);
      if (!r) continue;
      const d = M.ppDetalle(j);
      if (!d) continue;
      const sem = j.semanas || [];
      const u5 = sem.slice(-5);
      pares.push({ n: jo.n, pid: j.id, pos: j.pos, liga, p: d.final, base: d.base, desg: d.desg, pT: d.T ? d.T.p : null, r: r.pts, min: r.min,
        media: j.media, u5: u5.length ? u5.reduce((s, x) => s + num(x.pts), 0) / u5.length : 0, nombre: j.nombre });
    }
  }
  const res = (l) => {
    const e = errores(l, r2), eM = errores(l.map((x) => ({ p: x.media, r: x.r })), r2), e5 = errores(l.map((x) => ({ p: x.u5, r: x.r })), r2);
    const eB = errores(l.map((x) => ({ p: x.base, r: x.r })), r2), eD = errores(l.filter((x) => x.desg != null).map((x) => ({ p: x.desg, r: x.r })), r2);
    return { n: l.length, mae: e.mae, sesgo: e.sesgo, mae_media: eM.mae, mae_ult5: e5.mae, mae_formula: eB.mae, sesgo_formula: eB.sesgo, mae_desglose: eD.mae, sesgo_desglose: eD.sesgo, previstoMedio: r2(media(l.map((x) => x.p))), realMedio: r2(media(l.map((x) => x.r))) };
  };
  // titular = 50 minutos o más (solo los que tienen ficha con minutos)
  const conMin = pares.filter((x) => x.min != null && x.pT != null);
  const brier = conMin.length ? r3(media(conMin.map((x) => (x.pT - (x.min >= 50 ? 1 : 0)) ** 2))) : null;
  const calT = porGrupo(conMin, (x) => (x.pT < 0.2 ? '0-20' : x.pT < 0.5 ? '20-50' : x.pT < 0.8 ? '50-80' : '80-100'), (l) => ({ n: l.length, pMedio: r2(media(l.map((x) => x.pT))), titularReal: r2(l.filter((x) => x.min >= 50).length / l.length) }));
  return {
    total: res(pares), liga: res(pares.filter((x) => x.liga)), porPuesto: porGrupo(pares, (x) => x.pos, res), porJornada: porGrupo(pares, (x) => x.n, res),
    titularReal: res(pares.filter((x) => x.min != null && x.min >= 50)), suplenteReal: res(pares.filter((x) => x.min != null && x.min < 50)),
    titularidad: { n: conMin.length, brier, calibracion: calT },
    _pares: pares,
  };
}

/* lo que se apuntó de verdad antes de cada jornada (aprende.js), frente a lo que sacó */
function medirPrevis(P) {
  const out = {};
  for (const [nS, x] of Object.entries(P.X.previs || {})) {
    const n = +nS, jo = P.jor.find((j) => j.n === n);
    if (!jo || jo.fin + 6 * HORA > Date.now()) continue;
    const l = [];
    for (const [pid, [fin, base, desg, pos]] of Object.entries(x.pp || {})) { const r = realDe(P, pid, n); if (r) l.push({ p: fin, base, desg, r: r.pts, pos }); }
    out[n] = { ...errores(l, r2), mae_formula: errores(l.map((y) => ({ p: y.base, r: y.r })), r2).mae, mae_desglose: errores(l.filter((y) => y.desg != null).map((y) => ({ p: y.desg, r: y.r })), r2).mae };
  }
  return out;
}

/* ===================== 3. la puja que gana ===================== */
function medirPujas(P, T0) {
  const out = [];
  for (const a of P.evs) {
    if (a.clase !== 'compra' || a.o || !a.imp || a.t < T0) continue;
    const T = a.t - 3 * HORA;
    const { M } = motorEn(P, Math.floor(T / HORA) * HORA);
    const j = M.J(a.pid), v = num(j.valor);
    if (!v || j._sinValor) continue;
    const PV = M.pagaLiga(v, a.pid);
    if (!PV) continue;
    // (el cuantil con el que el motor dice que se gana; si es un motor de antes, el de 6 de cada 10 y el ajuste de tus pujas)
    const aj = M.misPujasRes ? M.misPujasRes.ajuste : 0;
    const qL = M.qPujaGana ? M.qPujaGana(a.pid) : Math.min(0.85, Math.max(0.5, 0.6 + aj));
    const pred = Math.ceil((v * (1 + Math.max(0, PV.q(qL)))) / 1e4) * 1e4;
    out.push({ v, imp: a.imp, pred, qL, top: !!(M.perfilPuja && M.perfilPuja(a.pid).top), s: a.imp / v - 1, sPred: pred / v - 1, q: [0.25, 0.5, 0.6, 0.75, 0.9].map((p) => a.imp <= v * (1 + PV.q(p))), mio: a.q === P.yo, nombre: j.nombre, t: a.t, wL: PV.wL });
  }
  const gana = out.filter((x) => x.pred >= x.imp), pierde = out.filter((x) => x.pred < x.imp);
  const res = (l) => (l.length ? {
    n: l.length, ganaria: r2(l.filter((x) => x.pred >= x.imp).length / l.length),
    sobrePagoMedianaPct: r1((q(l.filter((x) => x.pred >= x.imp).map((x) => (x.pred - x.imp) / x.v), 0.5) || 0) * 100),
    faltaMedianaPct: r1((q(l.filter((x) => x.pred < x.imp).map((x) => (x.imp - x.pred) / x.v), 0.5) || 0) * 100),
    sobrePagoMedioK: kE(media(l.filter((x) => x.pred >= x.imp).map((x) => x.pred - x.imp))),
    calibracion: Object.fromEntries([0.25, 0.5, 0.6, 0.75, 0.9].map((p, i) => [p, r2(l.filter((x) => x.q[i]).length / l.length)])),
    pagadoSobreValorMedianaPct: r1(q(l.map((x) => x.s), 0.5) * 100), previstoSobreValorMedianaPct: r1(q(l.map((x) => x.sPred), 0.5) * 100),
  } : { n: 0 });
  return { total: res(out), porPrecio: porGrupo(out, (x) => tramo(x.v), res), top: res(out.filter((x) => x.top)), noTop: res(out.filter((x) => !x.top)), mias: res(out.filter((x) => x.mio)),
    peoresFaltas: pierde.sort((a, b) => (b.imp - b.pred) / b.v - (a.imp - a.pred) / a.v).slice(0, 5).map((x) => ({ nombre: x.nombre, valorM: r2(x.v / 1e6), pagadoM: r2(x.imp / 1e6), previstoM: r2(x.pred / 1e6) })),
    _l: out };
}

/* ===================== 4. la oferta de LaLiga ===================== */
function medirOfertaLiga(P, T0) {
  const comprasManager = new Set(P.evs.filter((a) => a.clase !== 'venta').map((a) => `${a.pid}|${a.imp}`));
  const l = [];
  for (const a of P.evs) {
    if (a.clase !== 'venta' || a.o || !a.imp || a.t < T0 || comprasManager.has(`${a.pid}|${a.imp}`)) continue;
    const T = a.t - 3 * HORA;
    const { M } = motorEn(P, Math.floor(T / HORA) * HORA);
    const j = M.J(a.pid), v = num(j.valor);
    if (!v || j._sinValor) continue;
    const OL = M.ofertaLigaDe(j);
    const s = a.imp / v - 1;
    if (s < -0.25 || s > 0.25) continue;
    l.push({ v, imp: a.imp, p: OL.v, r: a.imp, s, min: OL.min, max: OL.max, sinDatos: OL.sinDatos });
  }
  const ss = l.map((x) => x.s);
  return {
    n: l.length, reparto: { p10: r1(q(ss, 0.1) * 100), p25: r1(q(ss, 0.25) * 100), mediana: r1(q(ss, 0.5) * 100), p75: r1(q(ss, 0.75) * 100), p90: r1(q(ss, 0.9) * 100), min: r1(Math.min(...ss) * 100), max: r1(Math.max(...ss) * 100) },
    motor: errores(l.map((x) => ({ p: x.p / x.v, r: x.s + 1 })), (y) => r2(y * 100)),
    sinAjuste: errores(l.map((x) => ({ p: 1, r: x.s + 1 })), (y) => r2(y * 100)),
    dentroMinMax: l.filter((x) => x.min != null).length ? r2(l.filter((x) => x.min != null && x.imp >= x.min && x.imp <= x.max).length / l.filter((x) => x.min != null).length) : null,
    dentro10: r2(l.filter((x) => Math.abs(x.s) <= 0.1).length / Math.max(1, l.length)),
  };
}

/* ===================== 5. el dinero de cada rival ===================== */
function medirDinero(P, T0) {
  const l = [];
  // un clausulazo o un traspaso entre mánagers se paga con saldo: lo que pagó es lo menos que tenía
  for (const a of P.evs) {
    if (a.clase === 'venta' || !a.o || !a.q || a.q === P.yo || !a.imp || a.t < T0) continue;
    // (justo antes de pagar: con lo que acabara de cobrar en el mismo cambio de mercado)
    const T = a.t - 1000;
    const { M } = motorEn(P, T);
    const c = M.capacidad(a.q);
    if (!c) continue;
    const antes = P.evs.filter((b) => b.t <= a.t && a.t - b.t < 3 * HORA && ((b.clase === 'venta' && b.q === a.q) || (b.clase !== 'venta' && b.o === a.q)) && b !== a).reduce((x, b) => x + b.imp, 0);
    l.push({ imp: a.imp, v: c.v, margen: c.margen || 0, alto: c.alto, seguro: c.seguro, cz: P.czSet.has(a.id || `${a.t}|${a.pid}`), t: a.t, q: a.q, cobro3h: antes, dias: (a.t - P.AH.desde) / DIA });
  }
  const fuera = l.filter((x) => x.imp > x.alto), bajoCentro = l.filter((x) => x.imp > x.v);
  const dichos = Object.values(P.extra0.dichos || {}).filter((dc) => dc && dc.v != null && dc.est != null).map((dc) => ({ errorK: kE(dc.v - dc.est), dentroMargen: dc.r != null ? Math.abs(dc.v - dc.est) <= dc.r : null }));
  const cal = P.extra0.calDinero || null;
  return {
    pagos: { n: l.length, clausulazos: l.filter((x) => x.cz).length, pagoPorEncimaDelAlto: fuera.length, pagoPorEncimaDelCentro: bajoCentro.length,
      faltaMedianaK: kE(q(fuera.map((x) => x.imp - x.alto), 0.5)), faltaMaxK: fuera.length ? kE(Math.max(...fuera.map((x) => x.imp - x.alto))) : null,
      margenMedianoK: kE(q(l.map((x) => x.margen), 0.5)), holguraMedianaK: kE(q(l.map((x) => x.v - x.imp), 0.5)),
      porRival: porGrupo(l, (x) => x.q, (y) => ({ n: y.length, fuera: y.filter((x) => x.imp > x.alto).length })),
      casos: fuera.map((x) => ({ dia: P.ctx.U.diaDe(x.t), diasLiga: Math.round(x.dias), pagoM: r1(x.imp / 1e6), estimadoM: r1(x.v / 1e6), margenM: r1(x.margen / 1e6), cz: x.cz, cobro3hM: r1(x.cobro3h / 1e6) })) },
    dichos, todasLasLigas: cal ? { n: cal.n, medianaK: kE(cal.med), p10K: kE(cal.p10), p90K: kE(cal.p90) } : null,
  };
}

/* ===================== 6. el peligro ===================== */
function medirPeligro(P, T0, T1, opc = {}) {
  const filas = [];
  for (const T of dias(P, T0, T1)) {
    const { M } = motorEn(P, T, opc.vivo ? { vivo: true } : {});
    for (const r of M.rivales) {
      const tid = r.e.teamId, p = r.peligro;
      const y = P.czs.some((z) => z.q === tid && z.t > T && z.t <= T + 7 * DIA);
      const yMi = P.czs.some((z) => z.q === tid && z.o === P.yo && z.t > T && z.t <= T + 7 * DIA);
      filas.push({ T, tid, n: r.amenaza, nivel: r.nivel, riq: p.riq, suele: p.suele, puede: p.puede, cerca: p.cerca, lleno: p.lleno, veda: !!p.veda, y, yMi });
    }
  }
  const porNivel = porGrupo(filas, (x) => x.nivel, (l) => ({ n: l.length, clausulan7d: r2(l.filter((x) => x.y).length / l.length), aTi7d: r2(l.filter((x) => x.yMi).length / l.length) }));
  return { n: filas.length, positivos: filas.filter((x) => x.y).length, positivosATi: filas.filter((x) => x.yMi).length,
    auc: r3(auc(filas.map((x) => ({ s: x.n, y: x.y })))), aucATi: r3(auc(filas.map((x) => ({ s: x.n, y: x.yMi })))),
    aucSoloSuele: r3(auc(filas.map((x) => ({ s: x.suele, y: x.y })))), aucSoloRiq: r3(auc(filas.map((x) => ({ s: x.riq, y: x.y })))), aucSoloPuede: r3(auc(filas.map((x) => ({ s: x.puede, y: x.y })))),
    porNivel, _filas: filas };
}
/** el nivel con otros pesos (la misma forma que `nivelDe` de M.rivales) */
export function nivelCon(x, k) {
  return Math.min(100, 100 * Math.pow(Math.max(0, x.riq), k.a) * (x.lleno ? 0.7 : 1) * ((1 - k.s) + k.s * x.suele / 100) * (0.85 + k.p * (x.puede / 100) ** 2) * (1 + 0.1 * x.cerca));
}
export function ajustarPeligro(filas) {
  const prueba = [];
  for (const a of [0.2, 0.4, 0.6, 0.8, 1, 1.3]) for (const s of [0.3, 0.45, 0.6, 0.75, 0.9]) for (const p of [0, 0.25, 0.5, 1]) {
    const k = { a, s, p };
    prueba.push({ k, auc: auc(filas.map((x) => ({ s: nivelCon(x, k), y: x.y }))), aucATi: auc(filas.map((x) => ({ s: nivelCon(x, k), y: x.yMi }))) });
  }
  return prueba.sort((x, y) => y.auc - x.auc);
}

/* ===================== 7. lo que manda vender, y lo que se ofrece a un rival ===================== */
function medirVentas(P, T0, T1, o = {}) {
  const { U } = P.ctx;
  const sen = [];
  for (const T of dias(P, T0, T1)) {
    const { M } = motorEn(P, T, o);
    const d = U.diaDe(T);
    const vi = new Set((P.ctx.ventasInercia ? reloj(T, () => P.ctx.ventasInercia(M)) : []).map((x) => x.pid));
    for (const x of M.mias) {
      const v = P.vDia(x.pid, d), v7 = P.vDia(x.pid, U.otroDia(d, 7)), v3 = P.vDia(x.pid, U.otroDia(d, 3));
      if (!v || !v7 || !x.j || x.j.pos > 4) continue;
      const vm = reloj(T, () => M.ventaMia(x));
      sen.push({ T, pid: x.pid, v, r7: v7 - v, r3: v3 ? v3 - v : null, hoy: vi.has(x.pid), ver: vm ? vm.veredicto : null, nombre: x.j.nombre });
    }
  }
  const res = (l) => (l.length ? { n: l.length, bajaron7: r2(l.filter((x) => x.r7 < 0).length / l.length), cambioMedio7k: kE(media(l.map((x) => x.r7))), cambioMedio3k: kE(media(l.filter((x) => x.r3 != null).map((x) => x.r3))), cambioMedio7pct: r1(media(l.map((x) => (x.r7 / x.v) * 100))) } : { n: 0 });
  const grandes = sen.filter((x) => x.r7 < -0.05 * x.v);
  // tus ventas de verdad: lo que cobraste frente a lo más que valió la semana de antes y lo que valió la de después
  const mias = [];
  for (const a of P.evs) {
    if (a.clase !== 'venta' || a.q !== P.yo || !a.imp || a.t < T0) continue;
    const d = U.diaDe(a.t);
    let max7 = 0; for (let k = 0; k <= 7; k++) max7 = Math.max(max7, P.vDia(a.pid, U.otroDia(d, -k)) || 0);
    const v = P.vEn(a.pid, a.t), v7 = P.vDia(a.pid, U.otroDia(d, 7));
    if (!v) continue;
    mias.push({ imp: a.imp, v, max7, v7, tarde: max7 - v, despues: v7 != null ? v7 - v : null });
  }
  // lo que se pagó de verdad entre mánagers (sin los clausulazos) frente a lo que la app ofrecería ese día
  const tratos = [];
  for (const a of P.evs) {
    if (a.clase === 'venta' || !a.o || !a.q || !a.imp || a.t < T0 || P.czSet.has(a.id || `${a.t}|${a.pid}`)) continue;
    const T = Math.floor((a.t - 3 * HORA) / HORA) * HORA;
    const { M } = motorEn(P, T);
    const j = M.J(a.pid);
    if (!j.valor || j._sinValor || !P.ctx.ofertaDueno) continue;
    const od = reloj(T, () => P.ctx.ofertaDueno(M, j, M.tend(a.pid) || {}, T));
    if (!od) continue;
    tratos.push({ imp: a.imp, v: j.valor, od: od.v, sube: od.sube, s: a.imp / j.valor - 1, ratio: a.imp / od.v });
  }
  const rt = (l) => (l.length ? { n: l.length, pagadoSobreValorMedianaPct: r1(q(l.map((x) => x.s), 0.5) * 100), pagadoEntreOfertaApp: { p25: r2(q(l.map((x) => x.ratio), 0.25)), mediana: r2(q(l.map((x) => x.ratio), 0.5)), p75: r2(q(l.map((x) => x.ratio), 0.75)) }, laAppOfreceMenos: r2(l.filter((x) => x.ratio > 1).length / l.length) } : { n: 0 });
  return {
    porVeredicto: porGrupo(sen, (x) => x.ver || 'nada', res), hoyVenderInercia: res(sen.filter((x) => x.hoy)), restoSinAviso: res(sen.filter((x) => !x.hoy)),
    bajadasGrandes: { n: grandes.length, conAvisoHoy: grandes.filter((x) => x.hoy).length, conVeredictoVender: grandes.filter((x) => x.ver === 'vender').length, perdidaK: kE(grandes.reduce((s, x) => s + x.r7, 0)) },
    tusVentas: mias.length ? { n: mias.length, tardeMedianaK: kE(q(mias.map((x) => x.tarde), 0.5)), tardeTotalK: kE(mias.reduce((s, x) => s + x.tarde, 0)), despuesMedianaK: kE(q(mias.filter((x) => x.despues != null).map((x) => x.despues), 0.5)), siguioBajando: r2(mias.filter((x) => x.despues != null && x.despues < 0).length / Math.max(1, mias.filter((x) => x.despues != null).length)) } : { n: 0 },
    tratos: rt(tratos), tratosSube: rt(tratos.filter((x) => x.sube)), tratosNoSube: rt(tratos.filter((x) => !x.sube)),
    _sen: sen,
  };
}

/* ===================== 8. los puntos de la jornada y el valor de después ===================== */
// (Carlos, 20 nov, 23:33: Berenguer venía de subir mucho y hace 1 punto: se va a frenar; uno que hace 15 con la cláusula
// abierta, a clausularlo ya). Para cada jugador y jornada: cómo venía (lo que subió los 3 días de antes del partido), los
// puntos que hizo y lo que cambió su valor 1 y 3 días después, frente a lo que esperaba la inercia antes del partido
function medirDirecto(P, nDesde, nHasta) {
  const { U } = P.ctx;
  const partidoDe = {};
  for (const p of P.fixtures) for (const id of [p.localId, p.visitanteId]) partidoDe[`${p.jornada}|${id}`] = p.fecha;
  const l = [];
  for (const jo of P.jor.filter((j) => j.n >= nDesde && j.n <= nHasta)) {
    for (const j of Object.values(P.D0.maestro)) {
      if (!j.pos || j.pos > 4) continue;
      const f = partidoDe[`${jo.n}|${j.equipoId}`];
      if (!f) continue;
      const sem = (j.semanas || []).find((x) => x.n === jo.n);
      if (!sem) continue;
      const d = U.diaDe(f), v0 = P.vDia(j.id, d), v1 = P.vDia(j.id, U.otroDia(d, 1)), v3 = P.vDia(j.id, U.otroDia(d, 3)), vm3 = P.vDia(j.id, U.otroDia(d, -3));
      if (!v0 || !v1 || !v3 || !vm3 || v0 < 5e5) continue;
      l.push({ n: jo.n, pid: j.id, f, pts: num(sem.pts), v0, s1: v1 / v0 - 1, s3: v3 / v0 - 1, antes: v0 / vm3 - 1, nombre: j.nombre });
    }
  }
  // lo que esperaba la inercia: una hora antes del partido; al acabar (con sus puntos en el directo, el mismo día, antes
  // del cambio de valor de la noche); y al día siguiente, con el primer cambio ya hecho (lo que queda hasta el día 3 y el 7)
  for (const x of l) {
    const { M } = motorEn(P, Math.floor((x.f - HORA) / HORA) * HORA);
    const ine = M.inercia(x.pid);
    x.p3 = ine ? ine.proy(3) / x.v0 : null;
    x.p7 = ine ? ine.proy(7) / x.v0 : null;
    x.fase = ine ? ine.fase : null;
    const fin = Math.min(Math.ceil((x.f + 2.25 * HORA) / (15 * 60e3)) * 15 * 60e3, U.mediodia(U.diaDe(x.f)) + 11.9 * HORA);
    if (fin > x.f + 2 * HORA) {
      const M1 = motorEn(P, fin, { vivo: true }).M, i1 = M1.inercia(x.pid);
      x.a3 = i1 ? i1.proy(3) / x.v0 : null; x.a7 = i1 ? i1.proy(7) / x.v0 : null;
      x.vivo = M1.puntosVivo ? M1.puntosVivo(x.pid) : null;
    }
    const d1 = U.otroDia(U.diaDe(x.f), 1), v7 = P.vDia(x.pid, U.otroDia(U.diaDe(x.f), 7));
    x.s7 = v7 ? v7 / x.v0 - 1 : null;
    const T2 = U.mediodia(d1) + 9 * HORA;
    if (T2 < Date.now()) {
      const M2 = motorEn(P, T2, { vivo: true }).M, i2 = M2.inercia(x.pid), v1 = P.vDia(x.pid, d1);
      if (i2 && v1) { x.b2 = i2.proy(2) / v1; x.b6 = i2.proy(6) / v1; x.r2b = P.vDia(x.pid, U.otroDia(d1, 2)) / v1 - 1; const v7b = P.vDia(x.pid, U.otroDia(d1, 6)); x.r6b = v7b ? v7b / v1 - 1 : null; }
    }
  }
  const mm = (y, f) => { const z = y.map(f).filter((v) => v != null && Number.isFinite(v)); return z.length ? r1(media(z) * 100) : null; };
  const bloque = (y) => (y.length ? { n: y.length, real1pct: mm(y, (x) => x.s1), real3pct: mm(y, (x) => x.s3), inercia3pct: mm(y, (x) => x.p3), bajan3: r2(y.filter((x) => x.s3 < 0).length / y.length),
    deMas3: mm(y, (x) => (x.p3 != null ? x.s3 - x.p3 : null)), deMas7: mm(y, (x) => (x.p7 != null && x.s7 != null ? x.s7 - x.p7 : null)),
    deMas3alAcabar: mm(y, (x) => (x.a3 != null ? x.s3 - x.a3 : null)), deMas7alAcabar: mm(y, (x) => (x.a7 != null && x.s7 != null ? x.s7 - x.a7 : null)),
    deMasDiaSig2: mm(y, (x) => (x.b2 != null && Number.isFinite(x.r2b) ? x.r2b - x.b2 : null)), deMasDiaSig6: mm(y, (x) => (x.b6 != null && x.r6b != null ? x.r6b - x.b6 : null)) } : { n: 0 });
  const como = (x) => (x.antes > 0.03 ? 'subía' : x.antes < -0.03 ? 'bajaba' : 'plano');
  const pts = (x) => (x.pts <= 1 ? '≤1' : x.pts <= 4 ? '2-4' : x.pts <= 7 ? '5-7' : x.pts <= 9 ? '8-9' : '10+');
  return {
    n: l.length, porPuntos: porGrupo(l, pts, bloque),
    subia: porGrupo(l.filter((x) => como(x) === 'subía'), pts, bloque), plano: porGrupo(l.filter((x) => como(x) === 'plano'), pts, bloque), bajaba: porGrupo(l.filter((x) => como(x) === 'bajaba'), pts, bloque),
    _l: l,
  };
}

/* ---------- comprobar que lo rehecho se parece a lo de verdad ---------- */
function comprobar(P) {
  const { U } = P.ctx;
  // tu saldo rehecho con los movimientos, frente al que guardó la app esos días
  const s = [];
  for (const [d, din] of P.H0.yo || []) {
    const T = U.mediodia(d) + 9 * HORA;
    if (T > Date.now()) continue;
    const { D } = pasado(P, T);
    s.push({ p: D.dinero, r: din });
  }
  // las plantillas rehechas de hace 1 día frente a las de ahora (solo cambia lo que se movió)
  const T = Date.now() - 60e3;
  const { D } = pasado(P, T);
  let iguales = 0, total = 0;
  for (const [t, fs] of Object.entries(P.D0.plantillas)) for (const f of fs) { total++; const g = (D.plantillas[t] || []).find((x) => x.pid === f.pid); if (g && Math.abs(g.clausula - f.clausula) <= Math.max(1e4, f.clausula * 0.01)) iguales++; }
  const ab = s.map((x) => Math.abs(x.p - x.r));
  return { saldo: { ...errores(s, kE), medianaK: kE(q(ab, 0.5)), menosDe1M: ab.filter((x) => x < 1e6).length }, clausulasAhora: { total, iguales }, jornadasConFecha: P.jor.map((j) => j.n) };
}

export async function medir(X, ctx, opc = {}) {
  const t0 = Date.now();
  const P = preparar(X, ctx);
  const { U } = ctx;
  const hoy = U.diaDe(Date.now());
  const desde = opc.desde || U.otroDia(U.diaDe(P.AH.desde), 28);
  const hasta7 = U.otroDia(hoy, -8);
  const piezas = opc.piezas || ['comprobar', 'inercia', 'puntos', 'previs', 'pujas', 'ofertaLiga', 'dinero', 'peligro', 'ventas', 'directo'];
  const T0 = U.mediodia(desde);
  const out = { desde, hasta: hasta7, jornadas: P.jor.filter((j) => j.fin < Date.now()).map((j) => j.n), hechaAhora: hechaAntes(P, Date.now()) };
  const paso = async (k, f) => { if (!piezas.includes(k)) return; const a = Date.now(); out[k] = f(); out[k + 'Ms'] = Date.now() - a; await new Promise((r) => setTimeout(r, 0)); };
  await paso('comprobar', () => comprobar(P));
  // (opc.vivo: con los puntos de los partidos ya acabados de la jornada en juego, como en la app)
  const conVivo = opc.vivo ? { vivo: true } : {};
  await paso('inercia', () => medirInercia(P, desde, hasta7, conVivo));
  await paso('puntos', () => medirPuntos(P, opc.nDesde || 4, opc.nHasta || out.hechaAhora, { calib: opc.calib, avanzadas: opc.avanzadas }));
  await paso('previs', () => medirPrevis(P));
  await paso('pujas', () => medirPujas(P, T0));
  await paso('ofertaLiga', () => medirOfertaLiga(P, T0));
  await paso('dinero', () => medirDinero(P, T0));
  await paso('peligro', () => medirPeligro(P, desde, hasta7, conVivo));
  await paso('ventas', () => medirVentas(P, desde, hasta7, conVivo));
  await paso('directo', () => medirDirecto(P, opc.nDesde || 4, opc.nHasta || out.hechaAhora));
  out.ms = Date.now() - t0;
  out._P = P;
  return out;
}
/** lo mismo sin las listas largas (lo que se apunta en el informe) */
export function sinListas(o) { return JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v))); }

/* ---------- en node ---------- */
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const arch = process.argv[2];
  if (!arch) { console.error('uso: node .github/ia/medir-motor.mjs /tmp/fm-medida.json [piezas]'); process.exit(1); }
  const X = JSON.parse(fs.readFileSync(arch, 'utf8'));
  globalThis.localStorage ||= { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 };
  const raiz = new URL('../../web/js/', import.meta.url);
  const { analizar, ofertaDueno } = await import(new URL('motor.js', raiz));
  const { ventasInercia } = await import(new URL('acciones.js', raiz));
  const U = await import(new URL('util.js', raiz));
  const piezas = process.argv[3] ? process.argv[3].split(',') : undefined;
  const r = await medir(X, { analizar, ofertaDueno, ventasInercia, U, c: X.cfg }, { piezas });
  console.log(JSON.stringify(sinListas(r), null, 1));
}
