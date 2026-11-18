// El dinero estimado de un rival va en el punto medio (16 nov, Carlos: «el ± es la mitad y la cifra tiene que estar en
// medio»): la cuenta parte de tu saldo y daba por hecho que el rival cogió tantas recompensas diarias como tú; ahora, sin
// datos de nadie, se centra entre «ninguna» y «todas». Sin red. Uso: node .github/ia/dinero-centro.mjs (PW_MODULO como en
// prueba-web.mjs). Sale con 1 si no se cumple lo de abajo.
import { pagina, cerrar } from './banco.mjs';

const P = await pagina('paron');
let mal = 0;
const ok = (c, t) => { console.log(c ? 'BIEN' : 'MAL ', t); if (!c) mal++; };
try {
  const r = await P.page.evaluate(async () => {
    const Mo = await import('./js/motor.js');
    const S = window.S;
    for (let i = 0; i < 40 && !S.M; i++) await new Promise((res) => setTimeout(res, 50));
    const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H));
    D.demo = false; D.dineros = {};
    // el saldo de la demo no cuadra con las recompensas: se ajusta para que tu base salga a 100 M + las recompensas que cogiste
    const ext = { actHist: { lista: D.actividad, completa: true, desde: Math.min(...D.actividad.map((a) => a.t)) } };
    const M0 = Mo.analizar(D, H, S.c, ext);
    D.dinero = 101e6 + M0.baseDinero.mov - M0.baseDinero.subidas;
    const M = Mo.analizar(D, H, S.c, ext);
    const out = { base: M.baseDinero, rec: M.recompensas(M.baseDinero.dias ? Date.now() - M.baseDinero.dias * 864e5 : 0, Date.now()) };
    out.riv = M.rivales.map((r) => { const b = M.dineroCuentaBruta(r.e.teamId), c = M.dineroCuenta(r.e.teamId), d = M.dineroDe(r.e.teamId); return { m: b && b.motivo, b: b && { v: b.v, mg: b.margen, p: b.partes }, c: c && { v: c.v, mg: c.margen, centro: c.centro, corr: c.correccion }, d: d && { v: d.v, mg: d.margen } }; });
    // con lo que te dijo un rival: la cifra va en medio (rec / 2) y no se mueve el centro de su cuenta
    const tid = M.rivales[0].e.teamId, tDijo = Date.now() - 12 * 864e5;
    const D2 = JSON.parse(JSON.stringify(D));
    const ev = { t: tDijo, v: 20e6, r: 0.5e6, est: 20e6 };
    D2.actividad = D2.actividad.filter((a) => a.t <= tDijo);
    const H2 = JSON.parse(JSON.stringify(H)); H2.mov = (H2.mov || []).filter((m) => m.t <= tDijo);
    const M2 = Mo.analizar(D2, H2, S.c, { ...ext, actHist: { ...ext.actHist, lista: D2.actividad }, dichos: { [tid]: ev } });
    const dd = M2.dineroDe(tid);
    out.dicho = { v: dd.v, mg: dd.margen, desde: dd.desdeDicho, rec: M2.recompensas(ev.t, Date.now()) };
    return out;
  });
  const b = r.base;
  console.log('base', JSON.stringify({ v: b.v, min: b.min, max: b.max, desvio: b.desvio, dias: b.dias }));
  const rv = r.riv.filter((x) => x.b && x.b.v != null && x.c && x.c.v != null);
  ok(rv.length > 0, `hay rivales con cuenta estimada (${rv.length})`);
  const mid = (b.min + b.max) / 2;
  for (const x of rv) {
    const esperado = x.b.v + Math.round((mid - b.v) / 1e5) * 1e5;
    ok(Math.abs(x.c.v - esperado) < 1, `la cifra va en el punto medio: ${(x.b.v / 1e6).toFixed(2)} → ${(x.c.v / 1e6).toFixed(2)} M (centro ${(x.c.centro / 1e6).toFixed(1)}, ±${(x.c.mg / 1e6).toFixed(1)})`);
    ok(x.c.mg === x.b.mg && x.b.p && Math.abs(x.b.p.fija + x.b.p.rec + x.b.p.dudas + x.b.p.desvio + x.b.p.raros - x.b.mg) <= 5e4, `el margen cuadra con sus partes (${JSON.stringify(Object.fromEntries(Object.entries(x.b.p).map(([k, v]) => [k, +(v / 1e6).toFixed(2)])))})`);
    ok(Math.abs(x.c.v - x.b.v) <= (b.max - b.min) / 2 + 1e5, 'el centro nunca mueve más de la mitad del hueco');
    ok(x.d.v === x.c.v, 'dineroDe da lo mismo sin «te dijo»');
  }
  ok(r.dicho.rec > 0.2e6 && Math.abs(r.dicho.v - (20e6 + r.dicho.rec * 0.5)) < 1, `con «te dijo» 20 M, sin movimientos desde entonces: 20 M + la mitad de las recompensas posibles (${(r.dicho.rec / 1e6).toFixed(2)} M) → ${(r.dicho.v / 1e6).toFixed(2)} M ±${(r.dicho.mg / 1e6).toFixed(1)}`);
  ok(Math.abs(r.dicho.mg - Math.round((0.5e6 + 0.3e6 + r.dicho.rec * 0.5) / 1e5) * 1e5) < 1, 'y el margen es esa misma mitad (más lo que él dijo que fallaba)');
} catch (e) { console.log('MAL  error:', e.message); mal++; }
await cerrar();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
