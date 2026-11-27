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
  const monta = (retoca, cal) => {
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
  let nombres = null;
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
    // (g) el sexto, comprado a otro mánager por 15 M hace 30 días: valía 21 M al crearse la liga y llega con su cláusula de 35 M
    const g = ini[5], otro = dias[orden[1]];
    D.actividad.push({ id: 'x3', t: ahora - 30 * DIA, tipo: 1, clase: 'compra', quien: quien.q, quienId: quien.qi, otro: otro.q, otroId: otro.qi, pid: g.pid, importe: 15e6 });
    det[g.pid] = { t: ahora, stats: [], valores: [[desde - DIA, 21e6], [desde + 30 * DIA, 19e6], [ahora - DIA, 12e6]] }; D.maestro[g.pid].valor = 12e6; g.clausula = 35e6;
  });
  const sub = ab.M.subidas[R] || { lista: [] };
  out.ab = { k: ab.M.clausulaInicial, lista: sub.lista.filter((x) => nombres.includes(x.pid)).map((x) => ({ i: nombres.indexOf(x.pid), pago: x.pago, inicial: x.inicial })) };
  // (c) paga una cláusula de 2 M más de lo que tenía sin recompensas: 2 M como poco de recompensas
  const f0 = base.M.flujos[R] || { v: 0 };
  const cc = monta(({ D }) => { const otro = base.M.rivalesTid.find((t) => t !== R); const pid = (D.plantillas[otro] || [])[0].pid; D.actividad.push({ id: 'x2', t: ahora - 3600e3, tipo: 5, clase: 'clausula', quien: quien.q, quienId: quien.qi, otro: 'x', otroId: (D.clasif.find((e) => e.teamId === otro) || {}).userId || 'u', pid, importe: Math.round(100e6 + f0.v + 2e6) }); });
  const c3 = cc.M.dineroCuentaBruta(R);
  out.c = { recMin: c3 && c3.cuenta ? c3.cuenta.recMin : null, rec: c3 && c3.cuenta ? c3.cuenta.rec : null, v: c3 ? c3.v : null, cobra: f0.v };
  // (e) lo de todas las ligas, sin `cu` y con él
  const cal = { n: 60, med: -2e6, p10: -6e6, p25: -4e6, p75: 0, p90: 2e6, porDias: [], t: ahora };
  const sinCu = monta(null, cal), conCu = monta(null, { ...cal, cu: Mo.CUENTA_DINERO });
  out.e = { sin: !!sinCu.M.calDinero, con: !!conCu.M.calDinero, corr: (conCu.M.dineroCuenta(R).correccion || {}).todos || 0 };
  // (f) el peligro
  out.f = { desde: Mo.MEDIO_DESDE, cuadra: base.M.rivales.every((x) => (x.peligro.n >= Mo.MEDIO_DESDE) === (x.nivel !== 'baja')), n: base.M.rivales.map((x) => `${Math.round(x.peligro.n)} ${x.nivel}`) };
  return out;
});
const m = (v) => (v == null ? '?' : (Math.round(v / 1e4) / 100).toFixed(2));
ok(r.ab.k.n >= 3 && Math.abs(r.ab.k.k - 5 / 3) < 0.02, `(a) el tanto de la cláusula del principio se mide en la liga: ×${r.ab.k.k} con ${r.ab.k.n} jugadores`);
ok(!r.ab.lista.some((x) => x.i < 3), `(a) a los del principio con la cláusula a 5/3 de su valor no se les cuenta ninguna subida (${JSON.stringify(r.ab.lista)})`);
const x3 = r.ab.lista.find((x) => x.i === 3);
ok(x3 && x3.inicial && Math.abs(x3.pago - 3e6) < 1e5, `(a) al que tiene 6 M por encima de eso, 3 M pagados (${x3 ? m(x3.pago) : 'no sale'})`);
const x4 = r.ab.lista.find((x) => x.i === 4);
ok(x4 && Math.abs(x4.pago - 1.5e6) < 2e4, `(b) comprado a 14,36, llegó a 15,54 y la cláusula en 18,54: 1,50 M pagados, no 2,09 (${x4 ? m(x4.pago) : 'no sale'})`);
ok(!r.ab.lista.some((x) => x.i === 5), `(g) comprado a otro mánager por 15 M con la cláusula que traía (35 M, los 5/3 de lo que valía al crearse la liga): no es una subida pagada (${JSON.stringify(r.ab.lista.filter((x) => x.i === 5))})`);
ok(r.c.recMin != null && Math.abs(r.c.recMin - 2e6) < 2e4 && r.c.rec >= r.c.recMin - 1 && r.c.v >= -1e6, `(c) pagó una cláusula que sin recompensas le dejaba en −2 M: 2 M de recompensas como poco (mín ${m(r.c.recMin)}, se le calculan ${m(r.c.rec)}; le quedan ${m(r.c.v)})`);
ok(r.mias && Math.abs(r.mias.v - 3e6) < 1e4, `(d) tus recompensas se saben exactas: ${m(r.mias && r.mias.v)} M de ${m(r.mias && r.mias.de)}`);
ok(r.activo.dias > r.quieto.dias && r.activo.rec > r.quieto.rec, `(d) al que más se mueve (${r.activo.dias} días) se le calculan más recompensas que al que menos (${r.quieto.dias} días): ${m(r.activo.rec)} y ${m(r.quieto.rec)} M`);
ok(r.activo.partes.fija === 5e5 && r.activo.partes.rec <= Math.max(r.activo.rec, 2e5) + 1 && r.quieto.partes.rec <= r.activo.partes.rec, `(d) el ± de las recompensas sale de eso: ${m(r.activo.partes.rec)} M el activo y ${m(r.quieto.partes.rec)} M el quieto (más medio millón fijo)`);
ok(!r.e.sin && r.e.con && r.e.corr === 60, `(e) lo de todas las ligas: sin «cu» no cuenta, con «cu» sí (${r.e.sin}, ${r.e.con}, ${r.e.corr} apuntes)`);
ok(r.f.desde === 33 && r.f.cuadra, `(f) el peligro, «medio» desde 33: ${r.f.n.join(', ')}`);
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
