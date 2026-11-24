// Vender al barato que baja (24 nov, Carlos: «no me puedo creer que no me recomiende vender a ninguno… incluso el defensa
// del Depor, que esta jornada ni jugó»: 1,62 M, bajando 26 mil al día y suplente). El corte para «vender por la inercia»
// era 150 mil para todos y uno de 1,6 M nunca llegaba. Sin red, con la liga de ejemplo:
//  (a) un suplente de entre 1 y 3 M que ha girado (tres semanas subiendo y dos días bajando un 1,6 %): vender por la
//      inercia y el plan lo pone a la venta
//  (b) el mismo bajando un 0,3 % al día: no (lo que pierde no llega al 3 %)
//  (c) uno de los caros con la misma caída: el corte de siempre (1,2 %), se vende igual que antes
// Uso: PW_MODULO=… node .github/ia/caso-venta-barato.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const escena = (P, op) => P.page.evaluate(async (op) => {
  const S = window.S, Mo = await import('./js/motor.js'), Pl = await import('./js/plan.js'), Dt = await import('./js/datos.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const M0 = S.M, F = S.fuentes || {};
  const ext = { det: S.det, onces: F.onces, noticias: F.noticias, avanzadas: F.avanzadas, alineaciones: F.alineaciones };
  const sup = [...M0.mias].filter((x) => x.j.pos !== 5 && M0.perdida(x.pid) < 0.05 && !(M0.reventa || {})[x.pid] && (op.caro ? !M0.enVenta.has(x.pid) : true));
  const quien = op.caro ? sup.filter((x) => x.j.valor > 8e6).sort((a, b) => a.j.valor - b.j.valor)[0] : sup.filter((x) => x.j.valor >= 1e6 && x.j.valor <= 3e6).sort((a, b) => a.j.valor - b.j.valor)[0];
  if (!quien) return { falta: true };
  const j = quien.j, pid = quien.pid;
  // (si ya está a la venta en la liga de ejemplo, se quita: se mira si el plan lo pondría)
  D.misVentas = (D.misVentas || []).filter((v) => String(v.pid) !== String(pid));
  D.mercado = (D.mercado || []).filter((m) => !(String(m.pid) === String(pid) && String(m.vendedorTeamId) === String(D.yo.teamId)));
  const ultimos = op.suave ? [0.01, 0.012, 0.011, 0.01, 0.009, -0.003, -0.003] : [0.01, 0.012, 0.011, 0.01, 0.009, -0.016, -0.017];
  const vals = [j.valor];
  for (let k = ultimos.length - 1; k >= 0; k--) vals.unshift(Math.round(vals[0] / (1 + ultimos[k])));
  for (let k = 0; k < 18; k++) vals.unshift(Math.round(vals[0] / 1.01));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  const M = Mo.analizar(D, H, S.c, ext);
  const vi = M.ventaPorInercia(pid), ine = M.inercia(pid);
  const R = Pl.planDeHoy(D, M, Dt.cfg());
  const enPlan = (R && R.ops ? R.ops : []).filter((o) => !o.descartada && o.pid === pid && o.accion === 'vender').map((o) => o.etiqueta || o.accion);
  return { n: j.nombre, valor: j.valor, fase: ine && ine.fase, proyJ: ine && ine.proyJ, vi: vi ? vi.urgencia : null, enPlan, tit: M.perdida(pid) };
}, op);

const P = await pagina('martes');
try {
  await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
  let r = await escena(P, {});
  const m = (x) => `${Math.round(x / 1e4) / 100} M`;
  if (r.falta) ok(false, 'la liga de ejemplo no tiene un suplente de 1 a 3 M');
  else {
    ok(['giro', 'baja'].includes(r.fase), `(a) ${r.n} (${m(r.valor)}, suplente): ha girado (${r.fase}; hasta la jornada ${Math.round(r.proyJ / 1000)} mil)`);
    ok(r.vi === 'ya', `(a) vender por la inercia: ${r.vi}`);
    ok(r.enPlan.length > 0, `(a) el plan lo pone a la venta: ${JSON.stringify(r.enPlan)}`);
  }
  r = await escena(P, { suave: true });
  if (!r.falta) ok(!r.vi, `(b) ${r.n} bajando un 0,3 % al día (${Math.round((r.proyJ || 0) / 1000)} mil hasta la jornada): no se vende por la inercia (${r.vi})`);
  r = await escena(P, { caro: true });
  if (r.falta) ok(true, '(c) la liga de ejemplo no tiene un suplente caro (no se mira)');
  else ok(r.vi === 'ya', `(c) ${r.n} (${m(r.valor)}) con la misma caída: vender por la inercia, como antes (${r.vi})`);
} finally { await cerrar(P); }
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
