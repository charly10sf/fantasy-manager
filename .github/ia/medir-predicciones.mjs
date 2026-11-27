/* Mide las tres predicciones candidatas del parte de los rivales con una liga de verdad, ANTES de enseñar nada (27 nov;
   claude/prompt-parte-ideas.md del proyecto; Carlos eligió medir las tres). Usa el banco de medir-motor.mjs (`preparar`,
   `pasado`), como medir-parte.mjs. LAS REGLAS PARA DECIDIR VAN ESCRITAS AQUÍ ANTES DE VER LOS DATOS y no se cambian después:

   H. A QUÉ HORAS MUEVE CADA RIVAL. Solo cuenta lo que hace él a su hora: las cláusulas que paga, sus blindajes y los
      traspasos que acepta como vendedor (las compras al mercado y las ventas a LaLiga salen con la hora del cambio de
      mercado, no con la suya). Varios en la misma hora cuentan como uno. Para cada movimiento se predice con lo suyo de los
      28 días anteriores (hasta 6 h antes, y con 6 movimientos o más): las dos franjas de 3 horas (hora de Madrid) en las
      que más mueve. Acierta si el movimiento cae en una de las dos. Se compara con las dos franjas en las que más se mueve
      toda la liga en esos mismos 28 días.
      SALE SI: 60 movimientos medidos o más, acierta el 50 % o más y saca 10 puntos o más a las franjas de toda la liga.

   C. EL CONTRAGOLPE. Tras un clausulazo (A le quita un jugador a B), ¿B le clausula a A uno suyo en las 72 h siguientes?
      Se compara con lo normal: de cada pareja (B, A), la parte de ventanas de 72 h (una por día) en las que B clausuló a A.
      Aparte se cuenta el caso en que a B le llegaba (su dinero estimado más lo cobrado llega a la cláusula más barata de A
      que se podía pagar).
      SALE SI: 15 clausulazos o más, la devuelve el 20 % o más de las veces y eso es 3 veces lo normal o más.

   S. SIN MARGEN PARA PUJAR. Con la liga de cada día a las 12:00, un rival está «sin margen» si lo más que puede pujar (su
      dinero estimado más alto, más el 20 % del valor de su equipo: lo mismo que usa el parte, `topePuja`) no llega a 3 M.
      ¿Compra en el mercado en las 24 h siguientes?
      SALE SI: 30 días de rival sin margen o más, compra el 10 % de las veces o menos y eso es un tercio o menos de lo que
      compra con margen.

   C y S salen de su dinero: si salen, solo con el dinero de ESE rival abierto.

   LOS DATOS NO SALEN DEL NAVEGADOR: se usa dentro de la app, con la liga cargada, y devuelve cifras agregadas, sin nombres:
     const B = await import(blob de medir-motor.mjs), X = await import(blob de este archivo);
     const datos = B.datosDePagina(); datos.calPasado = await B.calendarioPasado(api, normalizar, S.D);
     await X.medirPredicciones(B, datos, { analizar, U, hechosRival })
*/
const DIA = 864e5, HORA = 36e5;
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const ceder = () => new Promise((r) => setTimeout(r, 0));
// la hora de Madrid sin crear formateadores en el bucle
const FMT = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hourCycle: 'h23' });
const horaMadrid = (t) => Number(FMT.format(new Date(t)));
const franja = (t) => Math.floor(horaMadrid(t) / 3);

export async function medirPredicciones(B, datos, ctx) {
  const P = B.preparar(datos, ctx);
  const { analizar, hechosRival } = ctx;
  const todos = P.D0.clasif.map((e) => e.teamId);
  const rivales = todos.filter((t) => t !== P.yo);
  const desde = P.AH.desde || (P.evs[0] && P.evs[0].t) || Date.now() - 120 * DIA, hasta = Date.now();

  /* ---------- H. horas ---------- */
  const propios = [];
  for (const c of P.czs) if (c.q) propios.push({ t: c.t, q: c.q, k: 'cz' });
  for (const a of P.AH.lista) if (a.clase === 'blindaje' && a.t) { const q = P.tid(a.quienId, a.quien); if (q) propios.push({ t: a.t, q, k: 'bl' }); }
  for (const a of P.evs) if (a.clase !== 'venta' && a.o && !P.czSet.has(a.id || `${a.t}|${a.pid}`)) propios.push({ t: a.t, q: a.o, k: 'tr' });
  propios.sort((a, b) => a.t - b.t);
  const uno = [], visto = new Set();
  for (const e of propios) { const k = `${e.q}|${Math.floor(e.t / HORA)}`; if (!visto.has(k)) { visto.add(k); uno.push(e); } }
  const top2 = (l) => { const n = Array(8).fill(0); for (const e of l) n[franja(e.t)]++; return n.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => x[1]); };
  const H = { n: 0, rival: 0, liga: 0, porTipo: { cz: 0, bl: 0, tr: 0 }, total: uno.length };
  for (const e of uno) {
    H.porTipo[e.k]++;
    if (!rivales.includes(e.q)) continue;
    const ant = uno.filter((x) => x.t < e.t - 6 * HORA && x.t >= e.t - 28 * DIA);
    const suyos = ant.filter((x) => x.q === e.q);
    if (suyos.length < 6) continue;
    const f = franja(e.t);
    H.n++;
    if (top2(suyos).includes(f)) H.rival++;
    if (top2(ant).includes(f)) H.liga++;
  }
  const hR = H.n ? H.rival / H.n : null, hL = H.n ? H.liga / H.n : null;
  const resH = { medidos: H.n, movimientos: H.total, porTipo: H.porTipo, aciertaRival: r3(hR), aciertaLiga: r3(hL), azar: 0.25,
    sale: H.n >= 60 && hR >= 0.5 && hR - hL >= 0.1 };

  /* ---------- la liga de un momento (con todos sanos), para C y S ---------- */
  const cache = new Map();
  const en = (T) => {
    if (cache.has(T)) return cache.get(T);
    const { D, H: HH, extra } = B.pasado(P, T);
    const maestro = {};
    for (const [pid, j] of Object.entries(D.maestro)) maestro[pid] = j.estado === 'out_of_league' ? j : { ...j, estado: 'ok' };
    const D2 = { ...D, maestro };
    const real = Date.now;
    let M;
    try { Date.now = () => T; M = analizar(D2, HH, P.c, extra); } finally { Date.now = real; }
    const h = {};
    for (const r of M.rivales) {
      const x = hechosRival(M, r, T);
      h[x.tid] = { alto: x.cap && x.cap.alto != null ? x.cap.alto : null, tope: x.cap && x.cap.alto != null ? x.cap.alto + 0.2 * num(r.e.valor) : null };
    }
    const cl = {};
    for (const [t, fs] of Object.entries(D.plantillas || {})) cl[t] = fs.filter((f) => !f.protegidoHasta && f.clausula).map((f) => f.clausula);
    const r = { h, cl };
    cache.set(T, r);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return r;
  };

  /* ---------- C. el contragolpe ---------- */
  const cz = P.czs.filter((c) => c.q && c.o && c.t >= desde && c.t <= hasta - 3 * DIA);
  const devuelve = (c) => P.czs.some((d) => d.q === c.o && d.o === c.q && d.t > c.t && d.t <= c.t + 3 * DIA);
  const casos = [];
  for (const c of cz) {
    let llega = null;
    if (c.o !== P.yo) {
      const L = en(c.t + 60e3), x = L.h[c.o], cls = L.cl[c.q] || [];
      if (x && x.alto != null && cls.length) llega = x.alto + c.imp >= Math.min(...cls);
    }
    casos.push({ dev: devuelve(c), llega });
    await ceder();
  }
  // lo normal: de cada pareja (b, a), en cuántas ventanas de 72 h (una por día) b clausuló a a
  let ventanas = 0, conCz = 0;
  for (let T = Math.floor(desde / DIA) * DIA; T < hasta - 3 * DIA; T += DIA) {
    for (const b of todos) for (const a of todos) {
      if (a === b) continue;
      ventanas++;
      if (P.czs.some((d) => d.q === b && d.o === a && d.t > T && d.t <= T + 3 * DIA)) conCz++;
    }
  }
  const base = ventanas ? conCz / ventanas : null;
  const pDev = casos.length ? casos.filter((x) => x.dev).length / casos.length : null;
  const ll = casos.filter((x) => x.llega === true);
  const resC = { clausulazos: casos.length, devuelve: casos.filter((x) => x.dev).length, pDevuelve: r3(pDev), normal: r3(base), veces: base ? r3(pDev / base) : null,
    leLlegaba: { n: ll.length, devuelve: ll.filter((x) => x.dev).length }, noLeLlegaba: { n: casos.filter((x) => x.llega === false).length, devuelve: casos.filter((x) => x.llega === false && x.dev).length },
    sale: casos.length >= 15 && pDev >= 0.2 && base > 0 && pDev / base >= 3 };

  /* ---------- S. sin margen para pujar ---------- */
  const sin = [], con = [];
  for (let T = Math.floor((desde + 7 * DIA) / DIA) * DIA + 11 * HORA; T < hasta - DIA; T += DIA) {
    const L = en(T);
    for (const tid of rivales) {
      const x = L.h[tid];
      if (!x || x.tope == null) continue;
      const compra = P.evs.some((a) => a.clase === 'compra' && !a.o && a.q === tid && a.t > T && a.t <= T + DIA);
      (x.tope < 3e6 ? sin : con).push(compra);
    }
    await ceder();
  }
  const pS = sin.length ? sin.filter(Boolean).length / sin.length : null, pC = con.length ? con.filter(Boolean).length / con.length : null;
  const resS = { diasSin: sin.length, compranSin: sin.filter(Boolean).length, pSin: r3(pS), diasCon: con.length, compranCon: con.filter(Boolean).length, pCon: r3(pC),
    sale: sin.length >= 30 && pS <= 0.1 && pC > 0 && pS <= pC / 3 };

  return { liga: { rivales: rivales.length, desde: new Date(desde).toISOString().slice(0, 10), clausulazos: P.czs.length, histCompleta: !!P.AH.completa }, horas: resH, contragolpe: resC, sinMargen: resS };
}
