// Mide «quién puja» (web/js/quien-puja.js) con una liga de verdad: para cada compra a LaLiga de los últimos 45 días que hizo
// un rival, rehace la liga como estaba justo antes (plantillas, dinero y compras de entonces, con el historial de
// movimientos) y mira en qué puesto de la lista sale quien se lo llevó. Quien gana una subasta es uno de los que pujaban:
// si el modelo vale, tiene que salir arriba mucho más que al azar.
// Se usa DENTRO de la app, con la liga cargada (los datos no salen del navegador): en la consola,
//   const X = await import(URL.createObjectURL(new Blob([codigo de este archivo], { type: 'text/javascript' })));
//   const QP = await import('/js/quien-puja.js'), Dt = await import('/js/datos.js');
//   X.medir(window.S, QP, Dt)            → { n, top1, top3, logp, azar: { top1, top3, logp }, … }
//   X.medir(window.S, QP, Dt, { pesos: { expAct: 0.7 } })   con otros pesos
// Lo medido con la liga de Carlos, en claude/medida-quien-puja-24nov.md (proyecto).
const DIA = 864e5, HORA = 36e5;

export function preparar(S, Dt) {
  const M = S.M, D = S.D, yo = D.yo.teamId;
  const AH = Dt.actHist(D.liga.id);
  const todos = D.clasif.map((e) => e.teamId);
  const tidDe = (id, nombre) => (id || nombre ? M.teamDeUsuario(id, nombre) : null);
  const conV = new Map((M.comprasLiga || []).map((x) => [`${x.pid}|${x.t}`, x]));
  const lista = (AH.lista || []).filter((a) => a.t).map((a) => ({ a, q: tidDe(a.quienId, a.quien), o: a.otroId || a.otro ? tidDe(a.otroId, a.otro) : null })).sort((x, y) => x.a.t - y.a.t);
  const compras = [], manual = [];
  for (const { a, q, o } of lista) {
    const imp = Math.abs(Number(a.importe) || 0);
    if (a.clase === 'compra' && !a.otroId && !a.otro && a.pid && imp && q) {
      const k = conV.get(`${a.pid}|${a.t}`);
      compras.push({ tid: q, t: a.t, pid: a.pid, imp, v: k ? k.v : imp / 1.12, s: k ? k.s : null, conV: !!k });
    } else if ((a.clase === 'compra' || a.clase === 'clausula') && (a.otroId || a.otro) && a.pid) {
      if (q) manual.push({ tid: q, t: a.t, clase: 'clausula', pid: a.pid });
      if (o) manual.push({ tid: o, t: a.t, clase: 'pierde', pid: a.pid });
    } else if (a.clase === 'venta' && a.pid && q) manual.push({ tid: q, t: a.t, clase: 'venta', pid: a.pid });
    else if (a.clase === 'blindaje' && q) manual.push({ tid: q, t: a.t, clase: 'blindaje', pid: a.pid });
  }
  return { M, D, H: S.H, yo, todos, lista, compras, manual };
}

/** las plantillas como estaban en el momento t: las de ahora, deshaciendo lo de después */
function plantillasEn(X, t) {
  const P = {};
  for (const tid of X.todos) P[tid] = new Set(((X.D.plantillas || {})[tid] || []).map((f) => f.pid));
  for (let i = X.lista.length - 1; i >= 0 && X.lista[i].a.t > t; i--) {
    const { a, q, o } = X.lista[i];
    if (!a.pid) continue;
    if (a.clase === 'compra' || a.clase === 'clausula') { if (q && P[q]) P[q].delete(a.pid); if (o && P[o]) P[o].add(a.pid); } else if (a.clase === 'venta') { if (q && P[q]) P[q].add(a.pid); }
  }
  return P;
}

export function medir(S, QP, Dt, { pesos = {}, X = preparar(S, Dt), detalle = false } = {}) {
  const { M, D, H, yo, todos } = X;
  const rivales = todos.filter((t) => t !== yo);
  const objetivos = X.compras.filter((x) => x.conV && x.tid !== yo && rivales.includes(x.tid));
  let top1 = 0, top3 = 0, logp = 0, n = 0, fueraMal = 0;
  // ¿se cumple lo que dice? De las veces que al primero le da un 30-50 %, un 50 % o más… cuántas era él
  const tramos = [[0, 0.3], [0.3, 0.5], [0.5, 1.01]].map(([a, b]) => ({ de: a, a: b, n: 0, ok: 0, p: 0 }));
  const filas = [];
  const azar = { top1: 0, top3: 0, logp: 0 };
  for (const x of objetivos) {
    const t = x.t - 60e3;
    const P = plantillasEn(X, t);
    const capEn = (tid) => {
      const c = M.capacidad(tid);
      if (!c) return null;
      const despues = (((M.flujos || {})[tid] || {}).ev || []).filter(([te]) => te > t).reduce((s, [, d]) => s + d, 0);
      const v = c.v - despues, mg = c.exacto ? 0 : c.margen || 0;
      return { v, seguro: v - mg, alto: v + mg, exacto: !!c.exacto };
    };
    const valorEq = (tid) => { const s = (H.eq || {})[tid] || []; const dia = new Date(t).toISOString().slice(0, 10); let r = null; for (const f of s) { if (f[0] <= dia) r = f[1]; } return r || (M.equipo[tid] || {}).valor || 0; };
    const J = (pid) => (String(pid) === String(x.pid) ? { ...M.J(pid), valor: x.v, estado: 'ok' } : M.J(pid));
    const qp = QP.crearQuienPuja({
      ahora: t, rivales, todos, nombre: (tid) => (M.equipo[tid] || {}).manager || String(tid), J,
      plantilla: (tid) => [...(P[tid] || [])], valorEquipo: valorEq, capacidad: capEn,
      compras: X.compras.filter((c) => c.t < t - HORA / 2), manual: X.manual.filter((a) => a.t < t),
      paga: null, deudaPct: 0.2, minimoPos: { 1: 1, 2: 3, 3: 3, 4: 1 }, pesos,
    });
    const r = qp.para({ pid: x.pid, id: 'x', precio: x.v, j: J(x.pid), puja: x.v * 1.08, pujaGana: x.v * 1.1 }, 1, []);
    n++;
    const k = rivales.length;
    azar.top1 += 1 / k; azar.top3 += Math.min(1, 3 / k); azar.logp += Math.log(1 / k);
    const i = r ? r.cands.findIndex((c) => c.tid === x.tid) : -1;
    if (r && r.cands[0]) { const tr = tramos.find((y) => r.cands[0].p >= y.de && r.cands[0].p < y.a); if (tr) { tr.n++; tr.p += r.cands[0].p; if (i === 0) tr.ok++; } }
    if (i < 0) { fueraMal++; logp += Math.log(0.01); if (detalle) filas.push({ j: M.J(x.pid).nombre, quien: x.tid, puesto: 'descartado', por: r && (r.fuera.find((f) => f.tid === x.tid) || {}).por }); continue; }
    if (i === 0) top1++;
    if (i < 3) top3++;
    logp += Math.log(Math.max(0.01, r.cands[i].p));
    if (detalle) filas.push({ j: M.J(x.pid).nombre, v: Math.round(x.v / 1e5) / 10, puesto: i + 1, p: Math.round(r.cands[i].p * 100), de: r.cands.length });
  }
  const pc = (a) => Math.round((a / Math.max(1, n)) * 1000) / 10;
  return { n, top1: pc(top1), top3: pc(top3), logp: Math.round((logp / Math.max(1, n)) * 1000) / 1000, fueraMal, tramos: tramos.map((y) => ({ tramo: `${y.de * 100}-${Math.min(100, y.a * 100)} %`, n: y.n, dice: y.n ? Math.round((y.p / y.n) * 100) : null, acierta: y.n ? Math.round((y.ok / y.n) * 100) : null })), azar: { top1: pc(azar.top1), top3: pc(azar.top3), logp: Math.round((azar.logp / Math.max(1, n)) * 1000) / 1000 }, ...(detalle ? { filas } : {}) };
}
