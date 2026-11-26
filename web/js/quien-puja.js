/* Quién puede estar detrás de cada puja de un libre del mercado, y cuánto (0.8.2, 24 nov). LaLiga solo dice cuántas pujas
   lleva un jugador: ni quién ni cuánto (comprobado en crudo, claude/pendiente-pujas-rivales.md del proyecto). Esto es una
   ESTIMACIÓN, y así se enseña: se descarta a quien no puede pujar (la plantilla llena, o no le llega ni con la deuda) y al resto
   se le da más o menos peso por lo que se sabe de cada uno:
     - cuánto ficha en el mercado y de qué precio (sus compras a LaLiga, las recientes pesan más);
     - si le hace falta alguien de ese puesto (su plantilla de ahora) y si ficha mucho de ese puesto;
     - si le llega el dinero con holgura (el dinero estimado de cada rival);
     - lo que acaba de pasarle (ha vendido o le han quitado a uno del puesto; nadie recompra al que acaba de vender);
     - y la hora: si entre las dos lecturas en las que entró la puja ese rival hizo algo en la liga, o si es su hora de siempre
       (pujas-vistas.js apunta cuándo entra cada puja).
   Con quién es más probable y lo que suele pagar cada uno (sus compras parecidas, mezcladas con lo que se paga en la liga),
   sale con qué puja se gana 7 de cada 10 veces.
   Sin nada de la app dentro: todo le llega por `ctx` (lo monta motor.js), para poder medirlo con ligas de verdad
   (.github/ia/medir-quien-puja.mjs). Los pesos, en PESOS; lo medido, en claude/medida-quien-puja-24nov.md. */
import { num, clamp, DIA, HORA, MIN, horaDe } from './util.js';

export const PESOS = {
  // (medido el 24 nov con la liga de Carlos, 81 compras de rivales en 45 días: claude/medida-quien-puja-24nov.md)
  vida: 30,          // días a los que una compra pesa la mitad
  act0: 1, expAct: 1.3, // cuánto ficha: (suyo + act0) / (media + act0), elevado a expAct
  bValor: 3, expValor: 1, // de qué precio compra, encogido hacia lo de la liga con bValor compras
  bPuesto: 6, expPuesto: 0, // de qué puesto ficha (medido: no ayuda; apagado)
  nec: 0.3,          // cada jugador del puesto de menos que la media de la liga
  corta: 1.15, llena: 0.6, mejor: 1, sinOnce: 1.35, // (que fuera su mejor del puesto no ayuda: apagado)
  dineroSobra: 1.2, dineroJusto: 0.6, dineroMargen: 0.3, dineroNoSe: 0.9, dineroFuera: 0.9,
  // (recompra: 4 de las 81 las ganó quien había vendido a ese mismo jugador días antes; no se le quita peso)
  vende: 1.2, pierde: 1.3, recompra: 1, compro: 0.85,
  visto: 2.5, priHora: 6, maxVentana: 10, // la hora: visto en ese rato, y su hora de siempre (ventanas de hasta 10 h)
  bPaga: 3,          // lo que paga él, encogido hacia lo de la liga con bPaga compras parecidas
  temp: 0.9,         // todo el peso, elevado a esto (menos de 1: más repartido; con 1 decía 64 % y acertaba 56 %)
  gana: 0.7,         // «para ganar»: la puja con la que se gana esta parte de las veces
};
const K_VALOR = Math.log(2.5);
const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
const PUESTO = { 1: ['portero', 'porteros'], 2: ['defensa', 'defensas'], 3: ['medio', 'medios'], 4: ['delantero', 'delanteros'] };
const cerca = (a, b) => (a > 0 && b > 0 ? Math.exp(-Math.pow(Math.log(a / b) / K_VALOR, 2)) : 0);
const r10 = (x) => Math.ceil(x / 1e4) * 1e4;

/**
 * ctx: { ahora, rivales: [tid], nombre(tid), J(pid), plantilla(tid) → [pid], valorEquipo(tid), capacidad(tid) → { v, seguro,
 *        alto, exacto } | null, compras: [{ tid, v, s, t, pid }] (a LaLiga, de toda la liga), manual: [{ tid, t, clase:
 *        'venta' | 'clausula' | 'blindaje' | 'pierde', pid }] (lo que hace cada uno al momento), paga(v, pid) → { q, f } | null,
 *        deudaPct, minimoPos: { 1..4 }, todos: [tid] (con el tuyo, para las medias), pesos }
 */
export function crearQuienPuja(ctx) {
  const W = { ...PESOS, ...(ctx.pesos || {}) };
  // el tope de la plantilla (24 en LaLiga Fantasy; lo pasa el motor, `M.TOPE`)
  const TOPE = num(ctx.tope) || 24;
  const ahora = ctx.ahora, J = ctx.J;
  const peso = (t) => Math.pow(0.5, Math.max(0, ahora - t) / (W.vida * DIA));
  const compras = (ctx.compras || []).filter((x) => x && x.tid && x.t && x.t <= ahora && x.v > 0).map((x) => ({ ...x, w: peso(x.t), pos: num(J(x.pid).pos) }));
  const todos = ctx.todos && ctx.todos.length ? ctx.todos : ctx.rivales;
  const sumaW = compras.reduce((s, x) => s + x.w, 0);
  const porTid = {};
  for (const x of compras) (porTid[x.tid] ||= []).push(x);
  const act = (tid) => (porTid[tid] || []).reduce((s, x) => s + x.w, 0);
  const actMedia = todos.length ? todos.reduce((s, tid) => s + act(tid), 0) / todos.length : 0;
  const partePos = {};
  for (const x of compras) partePos[x.pos] = (partePos[x.pos] || 0) + x.w;
  // las plantillas: cuántos sanos tiene cada uno por puesto, y la media de la liga
  const plant = {};
  const plantillaDe = (tid) => {
    if (plant[tid]) return plant[tid];
    const pids = (ctx.plantilla(tid) || []).map((f) => (f && typeof f === 'object' ? f.pid : f));
    const sanos = { 1: 0, 2: 0, 3: 0, 4: 0 }, mejor = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let n = 0;
    for (const pid of pids) {
      const j = J(pid);
      if (!(j.pos >= 1 && j.pos <= 4)) continue;
      n++;
      if (!MALOS.has(j.estado)) sanos[j.pos]++;
      mejor[j.pos] = Math.max(mejor[j.pos], num(j.valor));
    }
    return (plant[tid] = { n, sanos, mejor });
  };
  const mediaPos = { 1: 0, 2: 0, 3: 0, 4: 0 };
  if (todos.length) for (const q of [1, 2, 3, 4]) mediaPos[q] = todos.reduce((s, tid) => s + plantillaDe(tid).sanos[q], 0) / todos.length;
  // lo que hace cada uno al momento: sus horas y lo último
  const manual = (ctx.manual || []).filter((a) => a && a.tid && a.t && a.t <= ahora);
  const horasDe = {};
  const horas = (tid) => {
    if (horasDe[tid]) return horasDe[tid];
    const h = new Array(24).fill(0);
    let n = 0;
    for (const a of manual) if (a.tid === tid && a.clase !== 'pierde') { h[Number(horaDe(a.t).slice(0, 2)) % 24]++; n++; }
    return (horasDe[tid] = { h, n });
  };

  /** el peso de un rival por un jugador, sin la hora: { w, por: [[fuerza, texto, dinero?]], fuera } */
  function base(tid, m, j) {
    const por = [];
    const P = plantillaDe(tid);
    // (lo que cuenta para el tope lo dice el motor, `ctx.cuenta`: en una liga normal el entrenador también ocupa sitio)
    const nTope = ctx.cuenta ? num(ctx.cuenta(tid)) : P.n;
    if (nTope >= TOPE) return { fuera: 'llena' };
    const cap = ctx.capacidad(tid);
    const deuda = Math.max(0, num(ctx.valorEquipo(tid)) * num(ctx.deudaPct));
    const precio = num(m.precio) || num(j.valor);
    // (con algo de manga: el dinero de un rival es una cuenta, y en lo medido el único descarte fallido fue por esto)
    if (cap && cap.alto + deuda < precio * W.dineroFuera) return { fuera: 'dinero' };
    let w = 1;
    const f = (x, txt, dinero) => { w *= x; if (txt && x > 1.12) por.push([Math.log(x), txt, !!dinero]); };
    // cuánto ficha en el mercado
    const a = act(tid);
    const fa = Math.pow((a + W.act0) / (actMedia + W.act0), W.expAct);
    f(fa, fa >= 1.4 ? 'de los que más fichan en el mercado' : null);
    // de qué precio
    const v = num(j.valor) || precio;
    if (sumaW > 0) {
      const g = compras.reduce((s, x) => s + x.w * cerca(x.v, v), 0) / sumaW;
      if (g > 0) {
        const suyo = (porTid[tid] || []).reduce((s, x) => s + x.w * cerca(x.v, v), 0);
        const r = clamp(((suyo + W.bValor * g) / (a + W.bValor)) / g, 0.35, 2.8);
        f(Math.pow(r, W.expValor), r >= 1.3 ? 'suele comprar de este precio' : null);
      }
      // de qué puesto
      const gp = (partePos[j.pos] || 0) / sumaW;
      if (gp > 0 && PUESTO[j.pos]) {
        const suyoP = (porTid[tid] || []).filter((x) => x.pos === j.pos).reduce((s, x) => s + x.w, 0);
        const r = clamp(((suyoP + W.bPuesto * gp) / (a + W.bPuesto)) / gp, 0.6, 1.7);
        f(Math.pow(r, W.expPuesto), r >= 1.35 ? `ficha muchos ${PUESTO[j.pos][1]}` : null);
      }
    }
    // si le hace falta
    if (PUESTO[j.pos]) {
      const tiene = P.sanos[j.pos];
      const nec = clamp(1 + W.nec * (mediaPos[j.pos] - tiene), 0.55, 1.8);
      const mp = (ctx.minimoPos || {})[j.pos];
      const minimo = mp != null ? num(mp) : 1;
      if (tiene < minimo) f(nec * W.sinOnce, `no le llegan los ${PUESTO[j.pos][1]} para alinear`);
      else f(nec, nec >= 1.2 ? `va corto de ${PUESTO[j.pos][1]} (${tiene})` : null);
      if (num(j.valor) > 0 && P.mejor[j.pos] > 0 && num(j.valor) >= P.mejor[j.pos]) f(W.mejor, `sería su mejor ${PUESTO[j.pos][0]}`);
    }
    if (P.n > 0 && P.n < 15) f(W.corta, `tiene la plantilla corta (${P.n})`);
    else if (nTope >= TOPE - 1) f(W.llena);
    // el dinero
    const ref = num(m.pujaGana) || num(m.puja) || precio;
    let tope = null;
    if (!cap) f(W.dineroNoSe);
    else {
      tope = cap.alto + deuda;
      if (cap.seguro >= ref) f(W.dineroSobra, 'lo paga sin tirar de deuda', true);
      else if (cap.v + deuda >= ref) f(1);
      else if (cap.v + deuda >= precio) f(W.dineroJusto);
      else f(W.dineroMargen);
    }
    // lo último que le ha pasado
    for (const x of manual) {
      if (x.tid !== tid || !x.pid) continue;
      const hace = ahora - x.t;
      if (x.clase === 'venta' && String(x.pid) === String(j.id) && hace < 10 * DIA) { f(W.recompra, 'lo tenía hace nada'); continue; }
      if (hace > 3 * DIA || J(x.pid).pos !== j.pos) continue;
      if (x.clase === 'venta') f(W.vende, `acaba de vender a ${J(x.pid).nombre}`);
      else if (x.clase === 'pierde') f(W.pierde, `le acaban de quitar a ${J(x.pid).nombre}`);
    }
    if ((porTid[tid] || []).some((x) => x.pos === j.pos && ahora - x.t < 2 * DIA)) f(W.compro);
    return { w: Math.pow(Math.max(w, 1e-6), W.temp), por, tope, cap };
  }

  /** lo que pesa la hora a la que entró una puja para ese rival: [factor, texto] */
  function hora(tid, ev) {
    const [desde, hasta] = ev;
    if (!desde || !(hasta > desde) || hasta - desde > W.maxVentana * HORA) return [1, null];
    const ancho = hasta - desde;
    let x = 1, txt = null;
    const algo = manual.filter((a) => a.tid === tid && a.clase !== 'pierde' && a.t >= desde - 5 * MIN && a.t <= hasta + 5 * MIN).sort((p, q) => q.t - p.t)[0];
    if (algo) {
      x *= 1 + (W.visto - 1) * clamp(1 - ancho / (12 * HORA), 0.3, 1);
      const que = algo.clase === 'venta' ? `vendió a ${J(algo.pid).nombre}` : algo.clase === 'clausula' ? `clausuló a ${J(algo.pid).nombre}` : `blindó a ${J(algo.pid).nombre}`;
      txt = `andaba por la liga a esa hora (${que} a las ${horaDe(algo.t)})`;
    }
    const H = horas(tid);
    if (H.n >= 4) {
      // la parte de lo que hace que cae en ese rato del día, frente a lo que tocaría si se repartiera igual
      const [h0, m0] = horaDe(desde).split(':').map(Number);
      let dentro = 0;
      const pasos = Math.max(1, Math.round(ancho / (15 * MIN)));
      for (let k = 0; k < pasos; k++) dentro += (H.h[Math.floor((h0 * 60 + m0 + (k + 0.5) * (ancho / pasos) / MIN) / 60) % 24] / H.n) * ((ancho / pasos) / HORA);
      const u = ancho / DIA;
      const r = clamp(((Math.min(1, dentro) * H.n + W.priHora * u) / (H.n + W.priHora)) / u, 0.4, 2.5);
      x *= r;
      if (!txt && r >= 1.4) txt = 'suele moverse a esa hora';
    }
    return [x, txt];
  }

  /** lo que pujaría ese rival por uno de ese valor: sus compras parecidas, mezcladas con lo que se paga en la liga */
  function paga(tid, v, pid, sMin, sMax) {
    const PV = ctx.paga ? ctx.paga(v, pid) : null;
    const suyas = (porTid[tid] || []).filter((x) => x.s != null && x.s > -0.1 && x.s <= 1.5).map((x) => ({ s: x.s, w: x.w * cerca(x.v, v) })).filter((x) => x.w > 0.02).sort((p, q) => p.s - q.s);
    const Ws = suyas.reduce((s, x) => s + x.w, 0);
    if (!PV && Ws < 1.5) return null;
    const lam = PV ? Ws / (Ws + W.bPaga) : 1;
    const Fs = (s) => (Ws ? suyas.reduce((t, x) => t + (x.s <= s + 1e-9 ? x.w : 0), 0) / Ws : 0);
    const F = (s) => (s < sMin - 1e-9 ? 0 : sMax != null && s >= sMax ? 1 : lam * Fs(s) + (PV ? (1 - lam) * clamp(PV.f(s), 0, 1) : 0));
    const q = (p) => {
      let a = Math.min(sMin, -0.1), b = 3;
      for (let k = 0; k < 28; k++) { const c = (a + b) / 2; if (F(c) >= p) b = c; else a = c; }
      return Math.max(sMin, sMax != null ? Math.min(b, sMax) : b);
    };
    return { F, q, n: suyas.length, lam };
  }

  /**
   * Para un libre del mercado con pujas de otros. m: { pid, id, precio, j, puja, pujaGana, miPuja }; ajenas: cuántas hay de
   * otros; ev: [[desde, hasta, cuántas]] de pujas-vistas (puede faltar). Devuelve null si no hay nadie que pueda pujar.
   */
  function para(m, ajenas, ev = []) {
    const j = m.j || J(m.pid);
    const n = Math.max(0, Math.round(num(ajenas)));
    if (!n || !ctx.rivales.length) return null;
    const v = num(j.valor) || num(m.precio);
    const precio = num(m.precio) || v;
    const cands = [], fuera = [];
    for (const tid of ctx.rivales) {
      const b = base(tid, m, j);
      if (b.fuera) { fuera.push({ tid, nombre: ctx.nombre(tid), por: b.fuera }); continue; }
      cands.push({ tid, nombre: ctx.nombre(tid), ...b });
    }
    if (!cands.length) return { n, cands: [], fuera, conf: 'baja', ev: [] };
    // cada rato en el que entraron pujas; las que no se sabe cuándo, juntas
    const evs = (ev || []).filter((x) => x && x[2] > 0).map((x) => [num(x[0]), num(x[1]), num(x[2])]);
    let apuntadas = evs.reduce((s, x) => s + x[2], 0);
    while (apuntadas > n && evs.length) { const u = evs[0]; const q = Math.min(u[2], apuntadas - n); u[2] -= q; apuntadas -= q; if (!u[2]) evs.shift(); }
    if (apuntadas < n) evs.push([0, 0, n - apuntadas]);
    const sMin = v > 0 ? precio / v - 1 : 0;
    for (const c of cands) c.d = v > 0 ? paga(c.tid, v, m.pid, sMin, c.tope != null ? Math.max(sMin, c.tope / v - 1) : null) : null;
    const pe = evs.map((e) => {
      const hs = cands.map((c) => hora(c.tid, e));
      const ws = cands.map((c, i) => c.w * hs[i][0]);
      const T = ws.reduce((s, x) => s + x, 0) || 1;
      return { e, p: ws.map((x) => x / T), txt: hs.map((h) => h[1]) };
    });
    cands.forEach((c, i) => {
      c.p = 1 - pe.reduce((s, x) => s * Math.pow(1 - x.p[i], x.e[2]), 1);
      const hTxt = pe.map((x, k) => [x.p[i], x.txt[i], k]).filter((x) => x[1]).sort((a, b) => b[0] - a[0])[0];
      if (hTxt) c.por.push([1.2, hTxt[1], false]);
      c.motivos = c.por.sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => ({ t: x[1], dinero: x[2] }));
      if (c.d) { c.est = Math.max(precio, r10(v * (1 + c.d.q(0.5)))); c.alto = Math.max(c.est, r10(v * (1 + c.d.q(0.8)))); }
    });
    const orden = cands.map((c, i) => [c, i]).sort((a, b) => b[0].p - a[0].p);
    // con cuánto se gana: que cada una de las pujas que hay sea más baja que la tuya
    const hayPaga = cands.every((c) => c.d);
    const pGana = !hayPaga || !(v > 0) ? null : (b) => {
      const s = b / v - 1;
      return pe.reduce((t, x) => t * Math.pow(cands.reduce((u, c, i) => u + x.p[i] * c.d.F(s - 1e-6), 0), x.e[2]), 1);
    };
    let paraPasar = null;
    if (pGana) {
      for (let s = sMin; s <= sMin + 1.6; s += 0.0025) { const b = r10(v * (1 + s)); if (b >= precio && pGana(b) >= W.gana) { paraPasar = b; break; } }
    }
    const top = orden[0][0];
    const conf = cands.length === 1 ? 'alta' : top.p >= 0.5 ? 'alta' : top.p >= 0.3 ? 'media' : 'baja';
    return {
      n, ev: evs.filter((e) => e[0] > 0), conf, fuera,
      cands: orden.map(([c]) => ({ tid: c.tid, nombre: c.nombre, p: c.p, motivos: c.motivos, est: c.est || null, alto: c.alto || null, tope: c.tope, exacto: !!(c.cap && c.cap.exacto), sinDinero: !c.cap })),
      paraPasar,
      pApp: pGana && m.puja ? pGana(num(m.puja)) : null,
      pGanaLiga: pGana && m.pujaGana ? pGana(num(m.pujaGana)) : null,
      pMia: pGana && Number(m.miPuja) > 0 ? pGana(Number(m.miPuja)) : null,
    };
  }

  return { para, act, plantillaDe, horas };
}
