// Una oferta por un titular de tu once (23 nov, Carlos con Gulácsi: portero titular al 92 %, 4,8 puntos de media, partido
// fácil, seis días bajando poco y hoy subiendo, y el plan mandaba «Aceptar oferta por 16,23 M» porque LaLiga pagaba un 7 %
// más de lo que vale). Aceptar una oferta es venderlo: a uno de tu once, solo si baja todos los días y tiene relevo, si
// está de baja o si te hace falta el dinero. Sin red, con la liga de ejemplo y su portero:
//  (a) oferta de LaLiga de un 7 %, seis días bajando y hoy subiendo, con dinero: ESPERAR, y ni el plan, ni Hoy, ni lo que
//      lee la IA mandan aceptarla
//  (b) un suplente (no entra en tu once): ACEPTAR si hoy baja; ESPERAR si hoy sube después de días bajando (20:32,
//      Carlos: «ha cambiado la tendencia… no tiene sentido la venta»)
//  (c) el portero en negativo un martes: ESPERAR (no se malvende); el viernes, sin otra oferta antes de la jornada,
//      la regla no lo frena (el dinero manda)
//  (d) el portero bajando todos los días: ESPERAR si no tienes otro que puntúe como él (antes hace falta un sustituto);
//      si lo tienes, ACEPTAR
//  (e) un 10 % o más (un mánager que paga un 20 %, LaLiga un 11 %): ACEPTAR, como antes (Carlos, 17 nov: «la de un 12 %
//      por encima, aunque suba un 1 % al día, sí»)
// Uso: PW_MODULO=… node .github/ia/caso-oferta-titular.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const eur0 = (x) => `${Math.round(Number(x) / 1e5) / 10} M`;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const escena = (P, op) => P.page.evaluate(async (op) => {
  const S = window.S, Mo = await import('./js/motor.js'), Pl = await import('./js/plan.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M;
  const quien = op.quien === 'suplente'
    ? [...M0.mias].filter((x) => x.j.pos !== 5 && M0.perdida(x.pid) < 0.05 && x.j.valor > 3e6).sort((a, b) => b.j.valor - a.j.valor)[0]
    : M0.mias.find((x) => x.j.pos === 1 && M0.perdida(x.pid) >= 0.3);
  if (!quien) return { falta: op.quien || 'portero' };
  const j = quien.j, pid = quien.pid;
  // la serie: un mes subiendo un 0,8 % al día; luego los días de Gulácsi (seis bajando un 0,4-0,55 % y hoy +0,05 %)
  const ultimos = op.bajaSiempre ? [-0.0043, -0.005, -0.0041, -0.0038, -0.0055, -0.0042, -0.003] : op.bajaHoy ? [0.004, 0.003, 0.002, 0.001, -0.002, -0.003, -0.004] : [-0.0043, -0.005, -0.0041, -0.0038, -0.0055, -0.0042, 0.00055];
  const vals = [j.valor];
  for (let k = ultimos.length - 1; k >= 0; k--) vals.unshift(Math.round(vals[0] / (1 + ultimos[k])));
  for (let k = 0; k < 24; k++) vals.unshift(Math.round(vals[0] / 1.008));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  // en venta con una oferta que caduca hoy
  const sobre = op.sobre != null ? op.sobre : 0.0744;
  const fin = Date.now() + 10 * 36e5;
  D.misVentas = [{ marketId: 'vt', pid, ptId: 'pt' + pid, precio: Math.round(j.valor * 1.1 / 1000) * 1000, cierra: fin, ofertas: [
    { id: 'ot', importe: Math.round(j.valor * (1 + sobre) / 1000) * 1000, estado: 'pending', caduca: fin, de: op.manager ? M0.rivales[0].e.manager : 'LaLiga', deLiga: !op.manager, ...(op.manager ? { deTeamId: M0.rivales[0].e.teamId } : {}) },
  ] }];
  D.mercado = (D.mercado || []).filter((m) => !(m.tipo === 'manager' && m.vendedorTeamId === yo));
  D.mercado.push({ id: 'vt', pid, tipo: 'manager', precio: D.misVentas[0].precio, cierra: fin, pujas: 0, ofertas: 1, vendedorTeamId: yo, vendedor: D.yo.manager, miPuja: null, clausula: null });
  if (op.dinero != null) D.dinero = op.dinero;
  if (op.sinPujas) for (const m of D.mercado) if (m.miPuja) m.miPuja = null;
  const M = Mo.analizar(D, H, S.c, {});
  const v = M.misVentas.find((y) => y.pid === pid);
  const R = Pl.planDeHoy(D, M, Dt.cfg());
  const enPlan = (R && R.ops ? R.ops : []).filter((o) => !o.descartada && !o.sugerencia && o.pid === pid && o.accion === 'vender').map((o) => `${o.etiqueta || o.accion}${o.objetivo ? ` (${o.objetivo})` : ''}`);
  const enHoy = (M.acciones || []).filter((a) => a.pid === pid && /acept|vend/i.test(`${a.tipo || ''} ${a.titulo || ''} ${a.texto || ''}`)).map((a) => a.titulo || a.tipo);
  // (lo que lee la IA de sus ventas: «- X (vale …) puesto a …: LaLiga ofrece … → la app aconseja …», en el plan y en el chat)
  const linea = (t) => t.split('\n').find((l) => l.startsWith(`- ${j.nombre} (vale`)) || '';
  const lineaIA = linea(I.contexto(D, M, Dt.cfg())) || linea(I.contexto(D, M, Dt.cfg(), { chat: true }));
  const p = M.perdida(pid), pp = M.ppEsperado(j) || 0;
  return { n: j.nombre, consejo: v && v.consejo, porque: v && v.porque, enPlan, enHoy, lineaIA: lineaIA.slice(0, 400), perdida: Math.round(p * 10) / 10, sinRelevo: p >= 1 && p >= 0.5 * pp, baja: !!M.bajaSeguido(pid), p1: M.tend(pid).p1, dinero: D.dinero, pujas: M.misPujas, protege: !!(v && v.protege) };
}, op);

const P = await pagina('martes');
try {
  await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
  // (a) el caso de Gulácsi
  let r = await escena(P, {});
  if (r.falta) ok(false, `la liga de ejemplo no tiene ${r.falta} titular`);
  else {
    ok(!r.baja && r.p1 > 0, `(a) ${r.n}: seis días bajando y hoy sube (${r.p1 && r.p1.toFixed(2)} %), titular (pierdes ${r.perdida} pts por jornada sin él)`);
    ok(r.consejo === 'esperar' && /titular en tu once/.test(r.porque || '') && /no compensa/.test(r.porque || ''), `(a) con la oferta de LaLiga de un 7 %: ${r.consejo} («${r.porque}»)`);
    ok(!r.enPlan.length, `(a) el plan no manda venderlo ni aceptarla, ni con lo pujado por encima del saldo (${eur0(r.dinero)} y ${eur0(r.pujas)} pujados): ${JSON.stringify(r.enPlan)}`);
    ok(/sube \([^)]*\) después de 6 días bajando: ha dejado de bajar/.test(r.porque || ''), '(a) dice que hoy sube después de 6 días bajando');
    ok(!r.enHoy.length, `(a) Hoy no dice aceptarla (${JSON.stringify(r.enHoy)})`);
    ok(/la app aconseja ESPERAR: Es titular en tu once/.test(r.lineaIA), `(a) lo que lee la IA: ESPERAR («${r.lineaIA.slice(-200)}»)`);
  }
  // (b) un suplente con la misma oferta: si hoy baja, ACEPTAR; si hoy sube después de días bajando, ESPERAR (20:32)
  r = await escena(P, { quien: 'suplente', bajaHoy: true });
  if (r.falta) ok(false, 'la liga de ejemplo no tiene suplente');
  else ok(r.consejo === 'aceptar', `(b) ${r.n}, suplente que hoy baja (pierdes ${r.perdida} pts): ${r.consejo} («${r.porque}»)`);
  r = await escena(P, { quien: 'suplente' });
  if (!r.falta) ok(r.consejo === 'esperar' && /ha dejado de bajar/.test(r.porque || '') && !r.enPlan.length, `(b) ${r.n}, suplente que hoy sube tras 6 días bajando: ${r.consejo} («${r.porque}»; plan: ${JSON.stringify(r.enPlan)})`);
  // (c) el portero en negativo un martes: no se malvende; el plan lo vende solo si hace falta para la jornada
  r = await escena(P, { dinero: -5e6 });
  ok(r.consejo === 'esperar' && /titular en tu once/.test(r.porque || '') && !r.enPlan.length, `(c) en negativo un martes (${r.dinero}): ${r.consejo} y el plan no la acepta («${r.porque}»; plan: ${JSON.stringify(r.enPlan)})`);
  // (d) el portero bajando todos los días
  r = await escena(P, { bajaSiempre: true });
  if (r.sinRelevo) ok(r.consejo === 'esperar' && /sustituto/.test(r.porque || ''), `(d) baja todos los días y sin relevo: ${r.consejo} («${r.porque}»)`);
  else ok(r.consejo === 'aceptar', `(d) baja todos los días y con relevo: ${r.consejo} («${r.porque}»)`);
  ok(r.baja, '(d) la serie baja todos los días');
  // (e) un mánager paga un 20 % más
  r = await escena(P, { manager: true, sobre: 0.2 });
  ok(r.consejo === 'aceptar', `(e) un mánager le paga un 20 % más: ${r.consejo} («${r.porque}»)`);
  r = await escena(P, { sobre: 0.11 });
  ok(r.consejo === 'aceptar', `(e) LaLiga le paga un 11 % más: ${r.consejo} («${r.porque}»)`);
  r = await escena(P, { sobre: 0.095 });
  ok(r.consejo === 'esperar', `(e) LaLiga le paga un 9,5 % más: ${r.consejo}`);
  if (P.errores && P.errores.length) ok(false, `errores de la página: ${P.errores.slice(0, 3).join(' / ')}`);
  // (c) en negativo el viernes por la tarde, con la jornada antes de la siguiente oferta: la regla no frena (el dinero manda)
  const V = await pagina('veda');
  await V.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
  r = await escena(V, { dinero: -5e6 });
  ok(r.consejo === 'aceptar' && !/titular en tu once/.test(r.porque || ''), `(c) en negativo el viernes, sin otra oferta antes de la jornada: ${r.consejo} («${r.porque}»)`);
  r = await escena(V, { sinPujas: true });
  ok(r.consejo === 'esperar', `(c) el viernes con dinero y sin pujas: ${r.consejo}`);
  r = await escena(V, {});
  ok(r.consejo === 'aceptar', `(c) el viernes con lo pujado por encima del saldo y sin otra oferta antes de la jornada: ${r.consejo} («${r.porque}»)`);
} catch (e) {
  ok(false, `la prueba se ha caído: ${e.message.split('\n')[0]}`);
}
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
