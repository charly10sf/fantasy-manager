// El cambio (24 nov, Carlos con Alti: «este jugador hay que venderlo aunque no tienes recambio, y que la app te proponga
// qué suplente buscar»). Un titular de tu once que baja todos los días, sin nadie en tu plantilla que puntúe como él y con
// un recambio mejor en el mercado. Sin red, con la liga de ejemplo:
//  (a) la app lo ve (cambioDe) y la ficha dice «Véndelo y ficha a otro» con los recambios
//  (b) el plan puja por el recambio (y la venta, si el recambio le quita el sitio en tu once)
//  (c) si la IA quita la puja, la venta se descarta («sin su recambio no lo vendas»)
//  (d) el día siguiente sin recambio: con una oferta de LaLiga de un 5 %, ESPERAR
//  (e) con el recambio ya fichado: ya no hay cambio y la oferta se acepta
// Uso: PW_MODULO=… node .github/ia/caso-cambio.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const escena = (P, op) => P.page.evaluate(async (op) => {
  const S = window.S, Mo = await import('./js/motor.js'), Pl = await import('./js/plan.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js'), Ho = await import('./js/hojas.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M, F = S.fuentes || {};
  const ext = { det: S.det, onces: F.onces, noticias: F.noticias, avanzadas: F.avanzadas, alineaciones: F.alineaciones };
  // el titular: uno de tu once sin relevo (sin él pierdes 1 pt o más y la mitad de lo suyo) con un recambio que dé 0,8 pts más
  const sinRel = (x) => { const p = M0.perdida(x.pid); return p >= 1 && p >= 0.5 * (M0.ppEsperado(x.j) || 0); };
  const tits = [...M0.mias].filter((y) => y.j.pos <= 4 && sinRel(y) && !M0.enVenta.has(y.pid)).sort((a, b) => a.j.pos - b.j.pos);
  let x = null, cand = null;
  for (const y of tits) {
    const ppY = M0.ppEsperado(y.j) || 0;
    const c = Object.values(D.maestro).filter((z) => z.pos === y.j.pos && !M0.dueno[z.id] && z.estado === 'ok' && z.valor > 1e6 && z.valor < 45e6 && (M0.ppEsperado(z) || 0) > ppY + 0.8 && (!M0.titularidad(z) || M0.titularidad(z).p == null || M0.titularidad(z).p >= 0.6))
      .sort((a, b) => (M0.ppEsperado(b) || 0) - (M0.ppEsperado(a) || 0))[0];
    if (c) { x = y; cand = c; break; }
  }
  if (!x) return { falta: 'titular sin relevo con recambio' };
  const j = x.j, pid = x.pid;
  // baja todos los días (una semana)
  const ultimos = [-0.006, -0.007, -0.005, -0.008, -0.006, -0.007, -0.009];
  const vals = [j.valor];
  for (let k = ultimos.length - 1; k >= 0; k--) vals.unshift(Math.round(vals[0] / (1 + ultimos[k])));
  for (let k = 0; k < 18; k++) vals.unshift(Math.round(vals[0] / 1.004));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  D.dinero = Math.max(Number(D.dinero) || 0, 70e6);
  D.mercado = (D.mercado || []).filter((m) => String(m.pid) !== String(cand.id));
  D.mercado.push({ id: 'mr', pid: cand.id, tipo: 'liga', precio: cand.valor, cierra: Date.now() + 20 * 36e5, pujas: 0, ofertas: 0, miPuja: null, clausula: null });
  if (op.fichado) {
    D.mercado = D.mercado.filter((m) => m.id !== 'mr');
    D.plantillas[yo].push({ pid: cand.id, clausula: Math.round(cand.valor * 1.3), protegidoHasta: Date.now() + 10 * 864e5, compra: cand.valor });
  }
  if (op.oferta) {
    const fin = Date.now() + 10 * 36e5;
    D.misVentas = [{ marketId: 'vt', pid, ptId: 'pt' + pid, precio: j.valor, cierra: fin, ofertas: [{ id: 'ot', importe: Math.round(j.valor * 1.05 / 1000) * 1000, estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true }] }];
    D.mercado.push({ id: 'vt', pid, tipo: 'manager', precio: j.valor, cierra: fin, pujas: 0, ofertas: 1, vendedorTeamId: yo, vendedor: D.yo.manager, miPuja: null, clausula: null });
  }
  if (op.fichado) ext.cambios = { [pid]: { entra: cand.id, t: Date.now() - 864e5 } };
  const M = Mo.analizar(D, H, S.c, ext);
  // (la puja que gana en la liga de ejemplo por el recambio sale disparada, +20 %: aquí, a su valor)
  const mr = (M.mercado || []).find((m) => String(m.pid) === String(cand.id));
  if (mr) mr.puja = Math.round(cand.valor / 1e4) * 1e4;
  const cb = M.cambioDe(pid);
  // (24 nov) la decisión de cada jugador se toma al analizar y ya ha mirado los recambios: la puja de la escena, también en ellos
  if (cb && mr) for (const r of cb.rec) if (String(r.pid) === String(cand.id)) r.puja = mr.puja;
  const dbg = '';
  window.__dbgR = null;
  const R = Pl.planDeHoy(D, M, Dt.cfg());
  const ops = (R && R.ops) || [];
  const vV = ops.find((o) => o.pid === pid && o.accion === 'vender' && o.cambio);
  const vP = ops.find((o) => o.pid === cand.id && o.accion === 'pujar' && o.cambio);
  let quitada = null;
  {
    const vSola = vV || { accion: 'vender', ref: `V-${pid}`, pid, jugador: j.nombre, donde: 'ponlo en venta', importe: j.valor, cuando: 'hoy', cambio: { sale: pid, saleNombre: j.nombre, entra: cand.id, entraNombre: cand.nombre } };
    const cu = I.cuadrarPlan({ dia: new Date().toISOString().slice(0, 10), t: Date.now(), titular: 'Plan', situacion: 'x', operaciones: [{ ...vSola }] }, D, M);
    const o = (cu.ops || []).find((y) => y.pid === pid && y.accion === 'vender');
    quitada = o ? { descartada: !!o.descartada, aviso: o.aviso || '' } : null;
  }
  // la de la IA, sin `cambio`: lo mismo
  let quitadaIA = null, catTxt = '';
  {
    const cu = I.cuadrarPlan({ dia: new Date().toISOString().slice(0, 10), t: Date.now(), titular: 'Plan', situacion: 'x', operaciones: [{ accion: 'vender', ref: `V-${pid}`, pid, jugador: j.nombre, importe: j.valor, cuando: 'hoy' }] }, D, M);
    const o = (cu.ops || []).find((y) => y.pid === pid && y.accion === 'vender');
    quitadaIA = o ? { descartada: !!o.descartada, aviso: o.aviso || '' } : null;
    const Op = await import('./js/operaciones.js');
    const cat = Op.catalogo(D, M);
    const ct = Op.catalogoTxt(D, M, cat);
    catTxt = (ct.split('\n').find((l) => l.includes(`[V-${pid}]`)) || '');
    if (op.dbg) window.__dbgR = { ct: ct.slice(0, 3000), ops: ops.map((o) => `${o.accion} ${o.jugador || ''} ${o.descartada ? 'X' : ''}`), lista: cat.lista.filter((o) => o.ref[0] === 'V' || o.ref === `P-${cand.id}`).map((o) => o.ref) };
  }
  if (op.foto) { S.D = D; S.H = H; S.M = M; window.__pid = pid; }
  const v = (M.misVentas || []).find((y) => y.pid === pid);
  let ficha = '';
  try { ficha = String(Ho.fichaJugador({ ...S, D, H, M }, pid) || ''); } catch (e) { ficha = `ERROR ${e.message}`; }
  return { quitadaIA, catTxt, dbg, n: j.nombre, rec: cand.nombre, bs: !!M.bajaSeguido(pid), cb: cb ? cb.rec.map((r) => r.j.nombre) : null, vV: !!vV, vP: !!vP, motivo: vV ? vV.motivo : '', quitada, consejo: v && v.consejo, porque: v && v.porque, base: (M.decisionBase(pid) || {}).oferta || null, vA: ops.some((o) => o.pid === pid && o.accion === 'vender' && !o.descartada), ficha: /Véndelo y ficha a otro/.test(ficha), fichaErr: ficha.startsWith('ERROR') ? ficha : '' };
}, op);

const P = await pagina('martes');
try {
  await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
  let r = await escena(P, {});
  if (r.falta) ok(false, `la liga de ejemplo no da para la prueba: falta ${r.falta}`);
  else {
    ok(r.bs && r.cb && r.cb.includes(r.rec), `(a) ${r.n} baja todos los días y sin relevo: recambios ${JSON.stringify(r.cb)}`);
    ok(r.ficha && !r.fichaErr, `(a) la ficha dice «Véndelo y ficha a otro»${r.fichaErr ? ` (${r.fichaErr})` : ''}`);
    ok(r.vP, `(b) el plan puja por el recambio, ${r.rec} (la venta de ${r.n}, ${r.vV ? 'también' : 'no: con los dos en tu once suma más quedártelo'})`);
    ok(r.quitada && r.quitada.descartada && /sin su recambio/.test(r.quitada.aviso), `(c) sin la puja, la venta se descarta: ${JSON.stringify(r.quitada)}`);
    ok(r.quitadaIA && r.quitadaIA.descartada, `(c) y la de la IA, sin la puja, también: ${JSON.stringify(r.quitadaIA)}`);
    ok(/CAMBIO: .*SOLO junto con la puja por su recambio/.test(r.catTxt) && r.catTxt.includes(r.rec), `(c) a la IA se le dice que va junto con la puja: «${r.catTxt.slice(0, 220)}»`);
  }
  r = await escena(P, { oferta: true });
  if (!r.falta) ok(r.consejo === 'esperar', `(d) sin recambio, la oferta de LaLiga de un 5 % por ${r.n}: ${r.consejo} («${r.porque}»)`);
  r = await escena(P, { oferta: true, fichado: true });
  if (!r.falta) {
    ok(!r.cb, `(e) con ${r.rec} ya fichado, ya no hay cambio (${JSON.stringify(r.cb)})`);
    // (24 nov, decide.js) el cambio ya no la frena (sin mirar el plan, se aceptaría) y Equipo dice lo que hace el plan con ella
    ok(r.base === 'aceptar' && (r.consejo === 'aceptar') === r.vA, `(e) y la oferta ya no la frena el cambio (${r.base}); Equipo, como el plan: ${r.consejo} («${r.porque}»)`);
  }
} finally { await cerrar(P); }
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
