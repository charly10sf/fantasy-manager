/* Mide el parte de los rivales (web/js/parte.js) con una liga de verdad, ANTES de enseñar nada (26 nov; encargo 3 de
   claude/prompts-26nov-premium-ligas-parte.md del proyecto). Rehace la liga de cada día pasado con el banco de
   medir-motor.mjs (`preparar`, `pasado`) y mira si lo que el parte habría dicho ese día se cumplió después:
     rojo        los rivales «en rojo seguro» antes de una jornada: ¿vendieron antes?, ¿cobraron premio de esa jornada?
     falta       el rival al que le falta gente en un puesto: ¿ficha de ese puesto en las 48 h siguientes más que los demás?
     sobra       los que la app daría por sobrantes: ¿se venden en los 7 días siguientes más que el resto del banquillo?
     reventa     lo que se paga entre mánagers (sobre el valor) cuando al que compra le faltaba ese puesto, y lo que paga en
                 el mercado el que va corto, frente a lo que cuesta ganar esa puja
     blindajes   cuántos gasta cada rival por jornada
     lleno       cuántas veces hay alguien con 25 y si ficha estando así (comprueba la regla y la reconstrucción)

   LÍMITE: el estado de cada jugador (lesionado, dudoso, sancionado) es el de HOY: el de entonces no se guarda. Aquí todos
   cuentan como sanos (menos los que ya no están en LaLiga), así que «falta» y «sobra» se miden solo por cuántos tiene en
   cada puesto; lo que añaden las lesiones no se puede medir hacia atrás.

   LOS DATOS NO SALEN DEL NAVEGADOR: se usa dentro de la app, con la liga cargada, y devuelve cifras agregadas, sin nombres:
     const B = await import(blob de medir-motor.mjs), X = await import(blob de este archivo);
     const datos = B.datosDePagina(); datos.calPasado = await B.calendarioPasado(api, normalizar, S.D);
     await X.medirParte(B, datos, { analizar, U, hechosRival })      // analizar de motor.js, U = util.js, hechosRival de parte.js
*/
const DIA = 864e5, HORA = 36e5;
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const q = (l, p) => { if (!l.length) return null; const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100), r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const tasa = (l, f) => (l.length ? { n: l.length, si: l.filter(f).length, p: r3(l.filter(f).length / l.length) } : { n: 0 });

export async function medirParte(B, datos, ctx, opc = {}) {
  const P = B.preparar(datos, ctx);
  const { U, analizar, hechosRival } = ctx;
  const desdeJ = opc.desdeJ || 4, hastaJ = opc.hastaJ || 13;
  const jor = P.jor.filter((j) => j.n >= desdeJ && j.n <= hastaJ && j.fin < Date.now());
  if (!jor.length) return { error: 'sin jornadas con calendario' };
  const pos = (pid) => num((P.D0.maestro[pid] || {}).pos);
  const rivales = P.D0.clasif.map((e) => e.teamId).filter((t) => t !== P.yo);
  const alias = Object.fromEntries(rivales.map((t, i) => [t, `R${i + 1}`]));
  const tiempos = {};

  /* el motor de un momento, con todos sanos (el estado de entonces no se sabe) */
  const cache = new Map();
  const en = (T) => {
    if (cache.has(T)) return cache.get(T);
    const { D, H, extra } = B.pasado(P, T);
    const maestro = {};
    for (const [pid, j] of Object.entries(D.maestro)) maestro[pid] = j.estado === 'out_of_league' ? j : { ...j, estado: 'ok' };
    const D2 = { ...D, maestro };
    const real = Date.now;
    let M;
    try { Date.now = () => T; M = analizar(D2, H, P.c, extra); } finally { Date.now = real; }
    const h = {};
    for (const r of M.rivales) {
      const x = hechosRival(M, r, T);
      h[x.tid] = { n: x.n, lleno: x.lleno, falta: x.falta, rojo: x.rojo, v: x.cap ? x.cap.v : null, alto: x.cap ? x.cap.alto : null, margen: x.cap ? x.cap.margen || 0 : null, rec: x.rec,
        tit: new Set(x.titulares), sup: Object.fromEntries([1, 2, 3, 4].map((p) => [p, x.suplentes[p].map((j) => j.id)])), sob: Object.fromEntries([1, 2, 3, 4].map((p) => [p, x.sobran[p].map((j) => j.id)])),
        esc: x.escudos, ids: x.fichas.map((f) => f.pid), prox: M.proxima ? M.proxima.n : null };
    }
    const r = { h, pagaLiga: M.pagaLiga || null };
    cache.set(T, r);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return r;
  };
  const ceder = () => new Promise((r) => setTimeout(r, 0));

  // los movimientos: quién ficha (q), a quién (o), y las ventas. Un traspaso entre mánagers es una compra con `o`
  const evs = P.evs;
  const esCz = (a) => P.czSet.has(a.id || `${a.t}|${a.pid}`);
  const ingresa = (tid, t0, t1) => evs.filter((a) => a.t > t0 && a.t <= t1 && ((a.clase === 'venta' && a.q === tid) || (a.clase !== 'venta' && a.o === tid)));
  const ficha = (tid, p, t0, t1, soloMercado = false) => evs.filter((a) => a.t > t0 && a.t <= t1 && a.clase !== 'venta' && a.q === tid && pos(a.pid) === p && (!soloMercado || !a.o));
  const sale = (tid, pid, t0, t1) => evs.find((a) => a.t > t0 && a.t <= t1 && a.pid === pid && ((a.clase === 'venta' && a.q === tid) || (a.clase !== 'venta' && a.o === tid)));
  const premioDe = (tid, jo, sig) => P.premios.filter((p) => p.q === tid && p.t > jo.fin - HORA && p.t < (sig ? sig.fin - HORA : Infinity)).sort((a, b) => a.t - b.t)[0] || null;

  /* ---------- 1. en rojo seguro ---------- */
  let t0 = Date.now();
  const rojo = { casos: [], sinPremio: [] };
  for (let i = 0; i < jor.length; i++) {
    const jo = jor[i], sig = P.jor.find((j) => j.ini > jo.fin) || null;
    for (const [k, T] of [['3d', jo.ini - 3 * DIA], ['2d', jo.ini - 2 * DIA], ['1d', jo.ini - DIA], ['1h', jo.ini - HORA]]) {
      const { h } = en(T);
      for (const tid of rivales) {
        const x = h[tid];
        if (!x || x.prox !== jo.n || x.v == null) continue;
        const pr = premioDe(tid, jo, sig);
        const fila = { j: jo.n, k, r: alias[tid], rojo: !!x.rojo, centroNeg: x.v < 0, vM: r2(x.v / 1e6), altoM: r2(x.alto / 1e6), ingresaAntes: ingresa(tid, T, jo.ini).length, ingresadoM: r2(ingresa(tid, T, jo.ini).reduce((s, a) => s + a.imp, 0) / 1e6), premioM: pr ? r2(pr.imp / 1e6) : null };
        if (fila.rojo || fila.centroNeg) rojo.casos.push(fila);
        if (k === '1h' && !pr) rojo.sinPremio.push({ j: jo.n, r: alias[tid], vM: fila.vM, altoM: fila.altoM, rojo: fila.rojo });
      }
      await ceder();
    }
  }
  const rj = (k, f) => rojo.casos.filter((x) => x.k === k && f(x));
  const resRojo = {};
  for (const k of ['3d', '2d', '1d', '1h']) {
    const seg = rj(k, (x) => x.rojo), cen = rj(k, (x) => x.centroNeg && !x.rojo);
    resRojo[k] = { seguro: { n: seg.length, ingresanAntes: seg.filter((x) => x.ingresaAntes > 0).length, sinPremio: seg.filter((x) => x.premioM == null).length, conPremio: seg.filter((x) => x.premioM != null).length },
      soloCentro: { n: cen.length, ingresanAntes: cen.filter((x) => x.ingresaAntes > 0).length, sinPremio: cen.filter((x) => x.premioM == null).length } };
  }
  const jornadasRival = jor.length * rivales.length;
  tiempos.rojo = Date.now() - t0;

  /* ---------- 2 a 6: con la liga de cada día a las 12:00 ---------- */
  t0 = Date.now();
  const dia0 = jor[0].ini - 4 * DIA, dia1 = jor[jor.length - 1].fin;
  const dias = [];
  for (let T = Math.floor(dia0 / DIA) * DIA + 11 * HORA; T < dia1; T += DIA) dias.push(T);
  const falta = [], noFalta = [], sobra = { sobrante: [], recambio: [], titular: [] }, lleno = { dias: 0, fichaLleno: 0, casos: 0 };
  const fotoDe = {}; // la foto de cada día, para los movimientos (reventa)
  for (const T of dias) {
    const { h } = en(T);
    const jo = P.jor.find((j) => j.ini > T) || null;
    const enJuego = P.jor.some((j) => j.ini <= T && T <= j.fin);
    const antesDeJornada = jo && jo.ini - T < 4 * DIA && !enJuego;
    fotoDe[T] = {};
    for (const tid of rivales) {
      const x = h[tid];
      if (!x) continue;
      fotoDe[T][tid] = { falta: x.falta, lleno: x.lleno, sob: x.sob, tit: x.tit };
      if (x.lleno) { lleno.dias++; const f = evs.filter((a) => a.t > T && a.t <= T + DIA && a.clase !== 'venta' && a.q === tid); if (f.length) { lleno.casos++; const antes = (a) => evs.some((b) => b.t > T && b.t <= a.t && b !== a && ((b.clase === 'venta' && b.q === tid) || (b.clase !== 'venta' && b.o === tid))); if (f.some((a) => !antes(a))) lleno.fichaLleno++; } }
      if (antesDeJornada) {
        for (const p of [1, 2, 3, 4]) {
          const fila = { p, k: num(x.falta[p]), lleno: x.lleno, f48: ficha(tid, p, T, T + 2 * DIA).length > 0, m48: ficha(tid, p, T, T + 2 * DIA, true).length > 0, fJ: ficha(tid, p, T, jo.ini).length > 0 };
          (fila.k > 0 ? falta : noFalta).push(fila);
        }
      }
      // sobrantes, recambios y titulares: ¿salen en 7 días? (una vez por semana, para no contar 7 veces al mismo)
      if (new Date(T).getUTCDay() === 2) {
        const sob = new Set([1, 2, 3, 4].flatMap((p) => x.sob[p])), sup = new Set([1, 2, 3, 4].flatMap((p) => x.sup[p]));
        for (const pid of x.ids) {
          if (!pos(pid) || pos(pid) > 4) continue;
          const s = sale(tid, pid, T, T + 7 * DIA);
          const fila = { sale: !!s, aManager: !!(s && s.clase !== 'venta' && !esCz(s)), cz: !!(s && s.clase !== 'venta' && esCz(s)) };
          (sob.has(pid) ? sobra.sobrante : sup.has(pid) ? sobra.recambio : x.tit.has(pid) ? sobra.titular : []).push(fila);
        }
      }
    }
    await ceder();
  }
  tiempos.dias = Date.now() - t0;
  const fotoAntes = (t) => { let k = null; for (const T of dias) { if (T < t) k = T; else break; } return k != null ? fotoDe[k] : null; };

  /* ---------- 4. lo que se paga: entre mánagers y en el mercado, con y sin hueco ---------- */
  const tratos = [], mercado = [];
  for (const a of evs) {
    if (a.clase === 'venta' || !a.q || !a.imp || a.t < dia0 || a.t > dia1) continue;
    const v = P.vEn(a.pid, a.t - 3 * HORA), p = pos(a.pid);
    if (!v || !p || p > 4) continue;
    const foto = fotoAntes(a.t), fq = foto && foto[a.q];
    const conHueco = !!(fq && num(fq.falta[p]) > 0);
    if (a.o) { if (!esCz(a)) tratos.push({ s: a.imp / v - 1, conHueco, v, yo: a.q === P.yo || a.o === P.yo, eraSobrante: !!(foto && foto[a.o] && (foto[a.o].sob[p] || []).includes(a.pid)), eraTitular: !!(foto && foto[a.o] && foto[a.o].tit && foto[a.o].tit.has(a.pid)) }); }
    else if (a.q !== P.yo) mercado.push({ s: a.imp / v - 1, conHueco, v });
  }
  // la reventa de verdad: cada compra al mercado (de cualquiera) de un puesto que ese día le faltaba a OTRO mánager: ¿acabó
  // vendiéndoselo a ese en 10 días?, ¿a otro mánager?, ¿a LaLiga?, y cuánto ganó o perdió sobre lo que pagó
  const directa = { con: [], sin: [] };
  for (const c of evs) {
    if (c.clase !== 'compra' || c.o || !c.q || !c.imp || c.t < dia0 || c.t > dia1 - 10 * DIA) continue;
    const p = pos(c.pid), foto = fotoAntes(c.t);
    if (!p || p > 4 || !foto) continue;
    const cortos = rivales.filter((t) => t !== c.q && foto[t] && num(foto[t].falta[p]) > 0);
    const sig = evs.find((b) => b.t > c.t && b.t <= c.t + 10 * DIA && b.pid === c.pid && ((b.clase === 'venta' && b.q === c.q) || (b.clase !== 'venta' && b.o === c.q)));
    const fila = { g: sig ? sig.imp / c.imp - 1 : null, gM: sig ? (sig.imp - c.imp) / 1e6 : null, v: c.imp,
      como: !sig ? 'se-queda' : sig.clase === 'venta' ? 'liga' : esCz(sig) ? 'clausulado' : cortos.includes(sig.q) ? 'al-corto' : 'otro-manager' };
    (cortos.length ? directa.con : directa.sin).push(fila);
  }
  const resD = (l) => {
    const de = (k) => l.filter((x) => x.como === k), g = (k) => { const y = de(k); return { n: y.length, medG: r3(q(y.map((x) => x.g), 0.5)), medM: r2(q(y.map((x) => x.gM), 0.5)), pierden: y.filter((x) => x.g < 0).length }; };
    return { n: l.length, alCorto: g('al-corto'), otroManager: g('otro-manager'), liga: g('liga'), clausulado: g('clausulado'), seQueda: de('se-queda').length };
  };
  const resS = (l) => (l.length ? { n: l.length, p25: r3(q(l.map((x) => x.s), 0.25)), med: r3(q(l.map((x) => x.s), 0.5)), p75: r3(q(l.map((x) => x.s), 0.75)), bajoValor: l.filter((x) => x.s < 0).length, mas5: l.filter((x) => x.s >= 0.05).length, mas10: l.filter((x) => x.s >= 0.1).length } : { n: 0 });
  const caros = (l) => l.filter((x) => x.v >= 5e6);

  /* ---------- 5. blindajes por rival y jornada ---------- */
  const blind = { 0: 0, 1: 0, 2: 0, mas: 0 };
  const bl = P.AH.lista.filter((a) => a.clase === 'blindaje' && a.t).map((a) => ({ t: a.t, q: P.tid(a.quienId, a.quien) }));
  for (let i = 0; i < jor.length; i++) {
    const jo = jor[i], ant = P.jor.filter((j) => j.fin < jo.ini).pop();
    const desde = ant ? ant.fin : jo.ini - 7 * DIA;
    for (const tid of rivales) { const n = bl.filter((b) => b.q === tid && b.t > desde && b.t <= jo.fin).length; blind[n > 2 ? 'mas' : n]++; }
  }

  return {
    liga: { rivales: rivales.length, jornadas: jor.map((j) => j.n), dias: dias.length, movimientos: evs.filter((a) => a.t >= dia0 && a.t <= dia1).length, histCompleta: !!P.AH.completa },
    rojo: { jornadasRival, porMomento: resRojo, casosSeguro: rojo.casos.filter((x) => x.rojo), sinPremioAlEmpezar: rojo.sinPremio },
    falta: {
      conHueco: { n: falta.length, fichan48: tasa(falta, (x) => x.f48), mercado48: tasa(falta, (x) => x.m48), antesJornada: tasa(falta, (x) => x.fJ), llenos: falta.filter((x) => x.lleno).length },
      sinHueco: { fichan48: tasa(noFalta, (x) => x.f48), mercado48: tasa(noFalta, (x) => x.m48), antesJornada: tasa(noFalta, (x) => x.fJ) },
      porPuesto: Object.fromEntries([1, 2, 3, 4].map((p) => [p, { con: tasa(falta.filter((x) => x.p === p), (x) => x.f48), sin: tasa(noFalta.filter((x) => x.p === p), (x) => x.f48) }])),
    },
    sobra: Object.fromEntries(Object.entries(sobra).map(([k, l]) => [k, { sale7: tasa(l, (x) => x.sale), aManager7: tasa(l, (x) => x.aManager), clausulado7: tasa(l, (x) => x.cz) }])),
    reventa: {
      tratos: { todos: resS(tratos), sinYo: resS(tratos.filter((x) => !x.yo)), conHueco: resS(tratos.filter((x) => x.conHueco)), sinHueco: resS(tratos.filter((x) => !x.conHueco)), de5M: resS(caros(tratos)), eraSobrante: tratos.filter((x) => x.eraSobrante).length, eraTitular: tratos.filter((x) => x.eraTitular).length },
      directa: { conOtroCorto: resD(directa.con), sinNadieCorto: resD(directa.sin) },
      mercado: { todos: resS(mercado), conHueco: resS(mercado.filter((x) => x.conHueco)), sinHueco: resS(mercado.filter((x) => !x.conHueco)), de5M: resS(caros(mercado)), de5MConHueco: resS(caros(mercado.filter((x) => x.conHueco))) },
    },
    blindajes: { rivalJornada: blind },
    lleno: lleno,
    tiempos,
  };
}
