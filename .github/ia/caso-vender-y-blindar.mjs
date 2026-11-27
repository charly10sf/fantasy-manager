// «Pone que se está frenando, que lo venda, y luego que lo blinde» (27 nov, Carlos con Gulácsi: portero titular al 86 %,
// 15,30 M, +26 mil hoy, la cláusula abierta a 18,54 M, un +21 %, «riesgo bajo» y 7 rivales con dinero; la ficha decía
// «Se está frenando · véndelo antes de que gire» y, debajo, «Plan de hoy: Blindar». «No tiene sentido… cuando está a 18 M
// la cláusula valiendo 15. Siendo además portero, te puedes permitir que caiga algo su valor, ya que es una posición algo
// distinta»). Tres cosas, sin red y con la liga de ejemplo:
//  (a) tu portero titular que se frena, con la cláusula abierta un 21 % por encima de su valor: la decisión es aguantarlo,
//      la tarjeta de la ficha dice «es titular: se aguanta» (nada de «véndelo») y, con el riesgo bajo, no se blinda: fuera
//      de «a quién blindar», sin paso en el plan, sin B- entre las operaciones de la IA y, si la IA lo propone, se quita
//  (b) el mismo bajando todos los días, pero poco (un 3 % en 7 días): se aguanta igual (ni venta ni cambio)
//  (c) el mismo cayendo de verdad (más de un 5 % en 7 días): ahí ya manda lo de siempre (vender, cambio o buscarle sustituto)
//  (d) uno de campo, suplente, que se frena: su tarjeta sigue diciendo «véndelo antes de que gire» (es lo que dice su
//      decisión) y, si la IA propone blindarlo, se quita: al que se vende no se le gasta un blindaje
// Uso: PW_MODULO=… node .github/ia/caso-vender-y-blindar.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const escena = (P, op) => P.page.evaluate(async (op) => {
  const S = window.S, Mo = await import('./js/motor.js'), I = await import('./js/ia.js'), Op = await import('./js/operaciones.js'), Pl = await import('./js/plan.js'), Af = await import('./js/avisos-ficha.js'), U = await import('./js/util.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M;
  const mios = [...M0.mias].filter((x) => x.j.estado === 'ok' && x.j.valor > 1e6 && !M0.enVenta.has(x.pid));
  const quien = op.suplente
    ? mios.filter((x) => x.j.pos !== 1 && x.j.pos !== 5 && M0.perdida(x.pid) < 0.3).sort((a, b) => b.j.valor - a.j.valor)[op.idx || 0]
    : mios.filter((x) => x.j.pos === 1 && M0.perdida(x.pid) >= 0.3)[0];
  if (!quien) return { falta: true };
  const j = quien.j, pid = quien.pid;
  // tres semanas subiendo un 1 % al día y la última según el caso
  const ultimos = op.ultimos;
  const vals = [j.valor];
  for (let k = ultimos.length - 1; k >= 0; k--) vals.unshift(Math.round(vals[0] / (1 + ultimos[k])));
  for (let k = 0; k < 21; k++) vals.unshift(Math.round(vals[0] / 1.01));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  const f = (D.plantillas[yo] || []).find((y) => String(y.pid) === String(pid));
  f.clausula = Math.round(j.valor * (1 + op.sobre) / 1e4) * 1e4;
  f.protegidoHasta = Date.now() - 3600e3;
  D.actividad = (D.actividad || []).filter((a) => a.clase !== 'blindaje');
  const F = S.fuentes || {};
  const M = Mo.analizar(D, H, S.c, { det: S.det, onces: F.onces, noticias: F.noticias, avanzadas: F.avanzadas, alineaciones: F.alineaciones });
  const x = M.mias.find((y) => y.pid === pid);
  let plan = null, err = '';
  try { plan = Pl.planDeHoy(D, M, S.c); } catch (e) { err = e.message; }
  M.verPlan(plan);
  const d = M.decision(pid);
  const S2 = { ...S, D, H, M, plan };
  let tarjeta = ''; try { const r = Af.inerciaPlanHTML(S2, pid, { mio: true, mia: x }); const e = document.createElement('div'); e.innerHTML = r.html; tarjeta = (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { tarjeta = `ERROR ${e.message}`; }
  const cat = Op.catalogo(D, M);
  const cu = I.cuadrarPlan({ dia: U.diaDe(), t: Date.now(), modelo: 'x', titular: 'Plan', situacion: 'x', operaciones: [{ accion: 'blindar', ref: `B-${pid}`, jugador: j.nombre, importe: 0, cuando: 'ahora', motivo: 'Lo tienen a tiro 7 rivales y el blindaje no cuesta nada.' }] }, D, M);
  const pIA = (cu.ops || []).find((o) => o.pid === pid && o.accion === 'blindar' && !o.descartada) || null;
  const quitado = (cu.descartes || []).find((q) => q.jugador === j.nombre) || null;
  const ine = M.inercia(pid) || {};
  return {
    n: j.nombre, pos: j.pos, err, tit: M.perdida(pid) >= 0.3, fase: ine.fase || '', p7: (x.tend || {}).p7, riesgo: x.riesgo, abierta: x.abierta, pagan: x.pagan ? x.pagan.seguro.length + x.pagan.quiza.length : 0, importa: x.importa, vi: !!x.ventaInercia,
    dec: d ? `${d.accion}/${d.regla}${d.matiz ? `/${d.matiz}` : ''}` : '', accion: d ? d.accion : '', porque: d ? d.porque : '',
    para: (M.paraEscudo || []).includes(pid), hayB: !!(cat.ref || {})[`B-${pid}`],
    pasoB: !!(plan && (plan.ops || []).some((o) => o.pid === pid && o.accion === 'blindar' && !o.descartada)),
    pasoV: !!(plan && (plan.ops || []).some((o) => o.pid === pid && o.accion === 'vender' && !o.descartada)),
    tarjeta: tarjeta.slice(0, 150), pIA: !!pIA, quitado: quitado ? quitado.motivo : '',
  };
}, op);

const lista = async (escenaN, op) => {
  const P = await pagina(escenaN);
  try {
    await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
    return await escena(P, op);
  } finally { await cerrar(P); }
};
const FRENA = [0.008, 0.007, 0.006, 0.005, 0.004, 0.003, 0.0017];

// (a) el portero titular que se frena, con la cláusula abierta al +21 %
// (el riesgo depende de lo que se paga por un clausulazo en la liga de ejemplo: se sube el tanto por ciento hasta que sale «bajo»)
let r = null;
for (const sobre of [0.21, 0.23, 0.25, 0.27, 0.29, 0.31, 0.33, 0.35, 0.37]) { r = await lista('martes', { ultimos: FRENA, sobre }); r.sobre = sobre; if (r.falta || r.riesgo === 'bajo') break; }
if (r.falta) ok(false, 'la liga de ejemplo no tiene un portero titular');
else {
  ok(!r.err && r.pos === 1 && r.tit && ['frena', 'parado'].includes(r.fase), `(a) ${r.n}, portero titular, se frena (${r.fase}); cláusula abierta al +${Math.round(r.sobre * 100)} %, riesgo ${r.riesgo}, le llega a ${r.pagan}${r.err ? ` ERROR ${r.err}` : ''}`);
  ok(r.accion === 'aguantar' && !r.pasoV, `(a) la decisión es aguantarlo (${r.dec}): «${r.porque}»`);
  ok(!/véndelo|vender/i.test(r.tarjeta), `(a) la tarjeta de la ficha no manda venderlo: «${r.tarjeta.slice(0, 90)}»`);
  if (r.riesgo === 'bajo' || r.riesgo === 'ninguno') {
    ok(!r.para && !r.pasoB && !r.hayB, `(a) con el riesgo ${r.riesgo} no se blinda: ni en «a quién blindar», ni paso en el plan, ni entre las operaciones de la IA`);
    ok(!r.pIA && /no merece gastar un blindaje|no corre peligro/.test(r.quitado), `(a) y si la IA lo propone, se quita: «${r.quitado.slice(0, 150)}»`);
  } else ok(false, `(a) en la liga de ejemplo esa cláusula sale con riesgo ${r.riesgo}: la prueba necesita «bajo» (cambiar el tanto por ciento)`);
}

// (b) bajando todos los días, pero poco
r = await lista('martes', { ultimos: [-0.004, -0.005, -0.004, -0.005, -0.004, -0.005, -0.004], sobre: 0.21 });
if (!r.falta) ok(r.accion === 'aguantar' && !r.pasoV && !/véndelo/i.test(r.tarjeta), `(b) bajando poco (${Math.round((r.p7 || 0) * 10) / 10} % en 7 días): se aguanta (${r.dec}); tarjeta «${r.tarjeta.slice(0, 70)}»`);

// (c) cayendo de verdad
r = await lista('martes', { ultimos: [-0.012, -0.013, -0.011, -0.014, -0.012, -0.013, -0.012], sobre: 0.21 });
if (!r.falta) ok(!/portero titular.*baja poco/.test(r.porque), `(c) cayendo un ${Math.round(Math.abs(r.p7 || 0) * 10) / 10} % en 7 días ya no vale lo de «baja poco»: ${r.dec}`);

// (d) uno de campo, suplente, que se frena
for (let idx = 0; idx < 6; idx++) { r = await lista('martes', { ultimos: [0.004, 0.002, 0.001, 0, -0.002, -0.004, -0.006], sobre: 0.02, suplente: true, idx }); if (r.falta || r.accion === 'vender') break; }
if (!r.falta) {
  if (r.accion === 'vender') {
    ok(/véndelo/i.test(r.tarjeta), `(d) ${r.n}, suplente que se frena (${r.dec}): su tarjeta sigue mandando venderlo: «${r.tarjeta.slice(0, 80)}»`);
    ok(!r.pIA && !r.pasoB, `(d) y no se le blinda aunque lo proponga la IA${r.quitado ? `: «${r.quitado.slice(0, 110)}»` : ''}`);
  } else ok(!/véndelo/i.test(r.tarjeta), `(d) ${r.n}: su decisión es ${r.dec} y la tarjeta no manda venderlo: «${r.tarjeta.slice(0, 80)}»`);
}

console.log(mal ? `${mal} MAL` : 'todo BIEN');
process.exit(mal ? 1 : 0);
