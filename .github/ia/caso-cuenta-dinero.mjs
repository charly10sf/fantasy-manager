// (27 nov) La cuenta del dinero de un rival, lo más exacta posible (Carlos: «las cuentas tienen que ser lo más exactas
// posibles… la recompensa diaria se podría calcular en función de si el tío es muy activo o no»). Con la liga de ejemplo
// retocada dentro de la prueba:
//  (a) la plantilla del principio empieza con la cláusula por encima de su valor (×5/3): eso no es una subida pagada, y el
//      tanto se mide en la liga; lo que haya por encima de ahí, sí
//  (b) una subida pagada después de que el valor subiera la cláusula sola: se paga la mitad de lo que hay por encima de lo
//      más que ha valido (3,00 de subida = 1,50), no de lo que costó
//  (c) lo que paga solo con saldo (una cláusula) acota sus recompensas: no pudo quedarse en negativo
//  (d) las recompensas, por los días en que hace algo en la liga: más al que más se mueve; el ±, pequeño
//  (e) lo de todas las ligas solo cuenta si viene de apuntes hechos con esta cuenta (`cu`)
//  (f) el peligro: «medio» desde 33
//  (g) un jugador comprado a otro mánager llega con la cláusula que tenía: eso tampoco es una subida pagada
// Uso: PW_MODULO=… node .github/ia/caso-cuenta-dinero.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('martes');
const r = await P.page.evaluate(async () => {
  const Mo = await import('./js/motor.js');
  const S = window.S, DIA = 864e5, ahora = Date.now();
  const copia = () => ({ D: JSON.parse(JSON.stringify(S.D)), H: JSON.parse(JSON.stringify(S.H)) });
  const monta = (retoca, cal, dichosDe) => {
    const { D, H } = copia();
    D.demo = false; D.dineros = {};
    const desde = ahora - 100 * DIA;
    // un movimiento tuyo de hace 100 días: la liga tiene 100 días (y unas 10 M de recompensas)
    D.actividad.push({ id: 'x0', t: desde, tipo: 1, clase: 'venta', quien: D.yo.nombre, quienId: D.yo.userId, otro: '', otroId: '', pid: Object.keys(D.maestro)[0], importe: 1000 });
    const det = {};
    const ctx = { D, H, det, desde };
    if (retoca) retoca(ctx);
    const ext = { actHist: { lista: D.actividad, completa: true, desde }, det, calDinero: cal || null };
    let M = Mo.analizar(D, H, S.c, ext);
    // tu saldo, para que tu cuenta cuadre con 3 M de recompensas cogidas
    D.dinero = 103e6 + M.baseDinero.mov - M.baseDinero.subidas;
    M = Mo.analizar(D, H, S.c, ext);
    if (dichosDe) { ext.dichos = dichosDe(M); M = Mo.analizar(D, H, S.c, ext); }
    return { M, D };
  };
  const base = monta();
  // dos rivales: el que más días se mueve y el que menos
  const dias = {}; for (const a of base.D.actividad) { if (!['compra', 'venta', 'clausula'].includes(a.clase)) continue; const t = base.M.teamDeUsuario(a.quienId, a.quien); if (t && t !== base.D.yo.teamId) (dias[t] ||= { n: new Set(), q: a.quien, qi: a.quienId }).n.add(new Date(a.t).toDateString()); }
  const orden = base.M.rivalesTid.slice().sort((x, y) => ((dias[y] || { n: new Set() }).n.size) - ((dias[x] || { n: new Set() }).n.size));
  const activo = orden[0], quieto = orden[orden.length - 1];
  const R = activo, quien = dias[R];
  const cA = base.M.dineroCuentaBruta(activo), cQ = base.M.dineroCuentaBruta(quieto);
  const out = { mias: base.M.recompensasMias, activo: { dias: cA.cuenta.dias, rec: cA.cuenta.rec, margen: cA.margen, partes: cA.partes }, quieto: { dias: cQ.cuenta.dias, rec: cQ.cuenta.rec, margen: cQ.margen, partes: cQ.partes } };
  // (a) y (b): cuatro del principio con la cláusula a 5/3 de lo que valían, uno de ellos con 6 M más; y uno comprado
  const sinFichar = (D, M) => (D.plantillas[R] || []).filter((f) => !D.actividad.some((a) => ['compra', 'clausula'].includes(a.clase) && String(a.pid) === String(f.pid) && M.teamDeUsuario(a.quienId, a.quien) === R));
  let nombres = null, ido = null;
  const ab = monta(({ D, H, det, desde }) => {
    const ini = sinFichar(D, base.M).slice(0, 6);
    nombres = ini.map((f) => f.pid);
    // (lo que la app tenía apuntado de su valor no cuenta aquí: manda el histórico que se le pone)
    for (const pid of nombres) if (H.v) delete H.v[pid];
    ini.slice(0, 4).forEach((f, i) => { const v0 = 9e6 + i * 4e6; det[f.pid] = { t: ahora, stats: [], valores: [[desde - DIA, v0], [desde + 20 * DIA, v0 * 0.9], [ahora - DIA, v0 * 0.6]] }; D.maestro[f.pid].valor = v0 * 0.6; f.clausula = Math.round(v0 * 5 / 3) + (i === 3 ? 6e6 : 0); });
    // (b) el quinto, comprado a 14,36 M hace 40 días; llegó a valer 15,54 y la cláusula está en 18,54
    const f = ini[4]; const t1 = ahora - 40 * DIA;
    D.actividad.push({ id: 'x1', t: t1, tipo: 1, clase: 'compra', quien: quien.q, quienId: quien.qi, otro: '', otroId: '', pid: f.pid, importe: 14.36e6 });
    det[f.pid] = { t: ahora, stats: [], valores: [[t1 - DIA, 14e6], [t1 + 10 * DIA, 15.54e6], [ahora - DIA, 15.3e6]] }; D.maestro[f.pid].valor = 15.3e6; f.clausula = 18.54e6;
    // (g) el sexto, comprado a otro mánager por 15.000.123 hace 30 días: la cláusula empieza en lo que pagó (no hereda la
    // del anterior); la tiene en 35.000.123: son 20 M de subida, 10 M pagados
    const g = ini[5], otro = dias[orden[1]];
    D.actividad.push({ id: 'x3', t: ahora - 30 * DIA, tipo: 1, clase: 'compra', quien: quien.q, quienId: quien.qi, otro: otro.q, otroId: otro.qi, pid: g.pid, importe: 15000123 });
    det[g.pid] = { t: ahora, stats: [], valores: [[desde - DIA, 21e6], [desde + 30 * DIA, 19e6], [ahora - DIA, 12e6]] }; D.maestro[g.pid].valor = 12e6; g.clausula = 35000123;
    // (h) uno que ya no tiene: lo fichó del mercado por 3.246.497 y el otro se lo clausuló por 6.246.497 (le había subido 3 M)
    ido = (D.plantillas[orden[1]] || [])[0];
    if (H.v) delete H.v[ido.pid];
    D.actividad.push({ id: 'x4', t: ahora - 60 * DIA, tipo: 31, clase: 'compra', quien: quien.q, quienId: quien.qi, otro: '', otroId: '', pid: ido.pid, importe: 3246497 });
    D.actividad.push({ id: 'x5', t: ahora - 20 * DIA, tipo: 1, clase: 'compra', quien: otro.q, quienId: otro.qi, otro: quien.q, otroId: quien.qi, pid: ido.pid, importe: 6246497 });
    ido.clausula = 6246497; D.maestro[ido.pid].valor = 2e6;
  });
  const sub = ab.M.subidas[R] || { lista: [] };
  out.ab = { k: ab.M.clausulaInicial, lista: sub.lista.filter((x) => nombres.includes(x.pid)).map((x) => ({ i: nombres.indexOf(x.pid), pago: x.pago, inicial: x.inicial, exacta: x.exacta, hace: x.t ? Math.round((ahora - x.t) / DIA) : null })), idas: (sub.idas || []).filter((x) => x.pid === ido.pid).map((x) => x.pago) };
  // (c) paga una cláusula de 2 M más de lo que tenía sin recompensas: 2 M como poco de recompensas
  const f0 = base.M.flujos[R] || { v: 0 };
  const cc = monta(({ D }) => { const otro = base.M.rivalesTid.find((t) => t !== R); const pid = (D.plantillas[otro] || [])[0].pid; D.actividad.push({ id: 'x2', t: ahora - 3600e3, tipo: 5, clase: 'clausula', quien: quien.q, quienId: quien.qi, otro: 'x', otroId: (D.clasif.find((e) => e.teamId === otro) || {}).userId || 'u', pid, importe: Math.round(100e6 + f0.v + 2e6) }); });
  const c3 = cc.M.dineroCuentaBruta(R);
  out.c = { recMin: c3 && c3.cuenta ? c3.cuenta.recMin : null, rec: c3 && c3.cuenta ? c3.cuenta.rec : null, v: c3 ? c3.v : null, cobra: f0.v };
  // (e) lo de todas las ligas, sin `cu` y con él
  const cal = { n: 60, med: -2e6, p10: -6e6, p25: -4e6, p75: 0, p90: 2e6, porDias: [], t: ahora };
  const sinCu = monta(null, cal), conCu = monta(null, { ...cal, cu: Mo.CUENTA_DINERO });
  out.e = { sin: !!sinCu.M.calDinero, con: !!conCu.M.calDinero, corr: (conCu.M.dineroCuenta(R).correccion || {}).todos || 0 };
  // (d) lo que te dice un rival: de ahí sale qué parte de las recompensas coge
  const sinRec = cA.v - cA.cuenta.rec;
  const dd = monta(null, null, () => ({ [activo]: { v: Math.round(sinRec + 0.9 * cA.cuenta.recTodas), r: 0, min: 0, max: 0, t: ahora - 3600e3, est: cA.v, cu: Mo.CUENTA_DINERO } }));
  out.d = { ritmo: dd.M.ritmoDicho[activo], v: dd.M.dineroDe(activo).v, dijo: Math.round(sinRec + 0.9 * cA.cuenta.recTodas), otro: dd.M.dineroCuentaBruta(quieto).cuenta.rec, tot: cA.cuenta.recTodas, min: cA.cuenta.recMin, minQ: cQ.cuenta.recMin };
  // (f) el peligro
  out.f = { desde: Mo.MEDIO_DESDE, cuadra: base.M.rivales.every((x) => (x.peligro.n >= Mo.MEDIO_DESDE) === (x.nivel !== 'baja')), n: base.M.rivales.map((x) => `${Math.round(x.peligro.n)} ${x.nivel}`) };
  return out;
});
const m = (v) => (v == null ? '?' : (Math.round(v / 1e4) / 100).toFixed(2));
ok(r.ab.k.n >= 3 && Math.abs(r.ab.k.k - 5 / 3) < 0.001, `(a) la cláusula del principio es 5/3 del valor del día en que se creó la liga: ×${r.ab.k.k}, ${r.ab.k.n} jugadores que lo cumplen al euro`);
ok(!r.ab.lista.some((x) => x.i < 3), `(a) a los del principio con la cláusula a 5/3 de su valor no se les cuenta ninguna subida (${JSON.stringify(r.ab.lista)})`);
const x3 = r.ab.lista.find((x) => x.i === 3);
ok(x3 && x3.inicial && x3.exacta && Math.abs(x3.pago - 3e6) < 2, `(a) al que tiene 6 M por encima de eso, 3 M pagados (${x3 ? m(x3.pago) : 'no sale'})`);
const x4 = r.ab.lista.find((x) => x.i === 4);
ok(x4 && x4.exacta && Math.abs(x4.pago - 1.5e6) < 2 && x4.hace === 30, `(b) comprado a 14,36, la cláusula en 18,54 y un día valió 15,54: subió 3 M ese día (hace ${x4 && x4.hace} días) y pagó 1,50 M (${x4 ? m(x4.pago) : 'no sale'})`);
const x5 = r.ab.lista.find((x) => x.i === 5);
ok(x5 && x5.exacta && Math.abs(x5.pago - 10e6) < 2, `(g) comprado a otro mánager por 15 M y con la cláusula 20 M por encima de lo que pagó: 10 M pagados (${x5 ? m(x5.pago) : 'no sale'})`);
ok(r.ab.idas.length === 1 && Math.abs(r.ab.idas[0] - 1.5e6) < 2, `(h) el que ya no tiene: lo fichó por 3.246.497 y se lo clausularon por 6.246.497: le había subido 3 M, 1,50 M pagados (${JSON.stringify(r.ab.idas)})`);
ok(r.c.recMin != null && Math.abs(r.c.recMin - 2e6) < 2e4 && r.c.rec >= r.c.recMin - 1 && r.c.v >= -1e6, `(c) pagó una cláusula que sin recompensas le dejaba en −2 M: 2 M de recompensas como poco (mín ${m(r.c.recMin)}, se le calculan ${m(r.c.rec)}; le quedan ${m(r.c.v)})`);
ok(r.mias && Math.abs(r.mias.v - 3e6) < 1e4, `(d) tus recompensas se saben exactas: ${m(r.mias && r.mias.v)} M de ${m(r.mias && r.mias.de)}`);
ok(Math.abs(r.activo.rec - (r.d.min + r.d.tot) / 2) < 2 && Math.abs(r.quieto.rec - (r.d.minQ + r.d.tot) / 2) < 2, `(d) las recompensas de un rival no se ven: va la mitad de las que ha podido coger (${m(r.activo.rec)} y ${m(r.quieto.rec)} M de ${m(r.d.tot)})`);
ok(r.activo.partes.fija === 5e5 && Math.abs(r.activo.partes.rec - (r.d.tot - r.d.min) / 2) < 2, `(d) y el ± es la otra mitad: ${m(r.activo.partes.rec)} M (más medio millón fijo)`);
ok(Math.abs(r.d.ritmo - 0.9) < 0.01 && Math.abs(r.d.v - r.d.dijo) < 3e5 && Math.abs(r.d.otro - r.quieto.rec) < 2, `(d) si te dice lo que tiene, se sabe qué parte coge (${r.d.ritmo == null ? '?' : r.d.ritmo.toFixed(2)}), su cifra es la que dijo (${m(r.d.v)} de ${m(r.d.dijo)}) y a los demás no les cambia nada`);
ok(!r.e.sin && r.e.con && r.e.corr === 60, `(e) lo de todas las ligas: sin «cu» no cuenta, con «cu» sí (${r.e.sin}, ${r.e.con}, ${r.e.corr} apuntes)`);
ok(r.f.desde === 33 && r.f.cuadra, `(f) el peligro, «medio» desde 33: ${r.f.n.join(', ')}`);
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
