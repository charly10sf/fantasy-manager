/* La puja recomendada frente a lo que de verdad se pagó (27 nov; Carlos: «recomienda pujas muy a la baja… en mi liga
   para llevarte a un jugador muchas veces hay que pagar más que eso»).

   Para cada compra al mercado de la liga (un libre, no de otro mánager) rehace el motor 3 h antes del cierre, con la
   liga como estaba (medir-motor.mjs: `preparar` y `pasado`), pone a ese jugador en el mercado con su precio de salida
   y mira qué habría recomendado la app: `m.puja` (la que se enseña), `m.pujaGana` y `m.pGana` (lo que la app dice que
   gana). Lo que pagó el que se lo llevó es la puja a batir. Solo con compras de ANTES de ese momento (el motor no ve la
   compra que mide).

   LOS DATOS NO VAN EN EL REPO (es público). Se corre en la página de la app, con la sesión, igual que medir-motor:
     const MM = await import(blob de medir-motor.mjs), MP = await import(blob de este archivo);
     X = MM.datosDePagina(); X.calPasado = await MM.calendarioPasado(api, normalizar, S.D);
     // el histórico de valor de cada comprado (si no, solo se miden los de los últimos días del histórico de aquí):
     for (const pid of comprados) X.det[pid] = { ...(X.det[pid] || { stats: [] }), valores: await historialValor(pid) };
     await MP.medirPuja(X, { analizar, ofertaDueno, ventasInercia, U, MM }, { pujas: 0 })
   (historialValor de externas.js; el 27 nov, 254 jugadores en 16 s, de tres en tres). Para medir un motor sin publicar,
   motor.js y puja-txt.js de la rama por Blob URL con sus importaciones cambiadas a las de la web publicada.
   Devuelve cifras agregadas y la lista de compras con el nombre del jugador (nunca el de los mánagers). */

const DIA = 864e5, HORA = 36e5;
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const q = (l, p) => { if (!l.length) return null; const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
const r1 = (x) => (x == null ? null : Math.round(x * 1000) / 10);
const TRAMOS = [[0, 3e6, 'baratos (<3 M)'], [3e6, 15e6, 'medios (3-15 M)'], [15e6, 40e6, 'altos (15-40 M)'], [40e6, Infinity, 'top (>40 M)']];
const tramo = (v) => (TRAMOS.find(([a, b]) => v >= a && v < b) || TRAMOS[0])[2];
const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };

export async function medirPuja(X, ctx, opc = {}) {
  const { MM, U } = ctx;
  const P = MM.preparar(X, ctx);
  const desde = opc.desde || (P.AH.desde ? P.AH.desde + 14 * DIA : 0);
  const out = [];
  for (const a of P.evs) {
    if (a.clase !== 'compra' || a.o || !a.imp || a.t < desde) continue;
    const T = Math.floor((a.t - 3 * HORA) / HORA) * HORA;
    const { D, H, extra } = MM.pasado(P, T);
    const j0 = D.maestro[a.pid];
    // (sin su valor de ese día no se mide: el de hoy daría cualquier cosa)
    if (!j0 || !j0.valor || j0._sinValor) continue;
    // el precio de salida: lo que valía el día anterior (LaLiga lo pone al sacarlo al mercado)
    const salida = P.vEn(a.pid, a.t - 27 * HORA) || j0.valor;
    D.mercado = [{ id: 'medida', pid: a.pid, tipo: 'liga', precio: salida, cierra: a.t, pujas: opc.pujas || 0, ofertas: 0, jugador: j0 }];
    const real = Date.now;
    let M;
    try { Date.now = () => T; M = ctx.analizar(D, H, P.c, extra); } catch (e) { continue; } finally { Date.now = real; }
    const m = (M.mercado || []).find((x) => String(x.pid) === String(a.pid));
    const v = num(j0.valor);
    if (!m || !v) continue;
    const s = a.imp / v - 1;
    if (s < -0.1 || s > 5 || (s > 1 && a.imp - v > 3e6)) continue; // lo mismo que tira el motor
    const PV = M.pagaLiga(v, a.pid);
    out.push({
      nombre: j0.nombre, pos: POS[j0.pos] || '?', v, salida, imp: a.imp, s, mio: a.q === P.yo, top: !!(M.perfilPuja && M.perfilPuja(a.pid).top),
      puja: m.puja, pujaGana: m.pujaGana, pGana: m.pGana, recortada: !!m.recortada, topeCal: !!m.topeCal, interes: m.interes,
      // con cada cuantil de lo que el motor ve pagado, ¿se habría ganado?
      cuant: PV ? Object.fromEntries([0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9].map((p) => [p, a.imp <= Math.ceil(v * (1 + Math.max(0, PV.q(p))) / 1e4) * 1e4])) : null,
      f: PV ? PV.f(s - 1e-9) : null, n: PV ? PV.n : 0, t: a.t,
    });
  }
  return { resumen: resumir(out), _l: out };
}

/** lo que se enseña: por tramo y por puesto, lo pagado sobre el valor y lo que habría ganado la puja de la app */
export function resumir(out) {
  const res = (l) => {
    if (!l.length) return { n: 0 };
    const gana = l.filter((x) => x.puja >= x.imp);
    const calib = {};
    for (const p of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) { const c = l.filter((x) => x.cuant); if (c.length) calib[p] = Math.round(c.filter((x) => x.cuant[p]).length / c.length * 100); }
    return {
      n: l.length,
      pagadoSobreValor: { p25: r1(q(l.map((x) => x.s), 0.25)), med: r1(q(l.map((x) => x.s), 0.5)), p75: r1(q(l.map((x) => x.s), 0.75)), p90: r1(q(l.map((x) => x.s), 0.9)) },
      pujaAppSobreValor: r1(q(l.map((x) => x.puja / x.v - 1), 0.5)),
      ganaPujaApp: Math.round(gana.length / l.length * 100),
      ganaPujaGana: Math.round(l.filter((x) => x.pujaGana >= x.imp).length / l.length * 100),
      appDiceQueGana: Math.round(q(l.filter((x) => x.pGana != null).map((x) => x.pGana), 0.5) * 100),
      recortadas: Math.round(l.filter((x) => x.recortada).length / l.length * 100),
      calibracion: calib,
    };
  };
  const por = (g) => { const o = {}; for (const x of out) (o[g(x)] ||= []).push(x); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, res(v)])); };
  return { total: res(out), porTramo: por((x) => tramo(x.v)), porPuesto: por((x) => x.pos), mias: res(out.filter((x) => x.mio)) };
}
