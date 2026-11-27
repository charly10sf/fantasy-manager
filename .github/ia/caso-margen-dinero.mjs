// (27 nov) De qué sale el ± del dinero de un rival (Carlos, con la ficha de un rival: «≈ 43,30 M · ± 21,70 M por la
// recompensa diaria»). La recompensa diaria da 7,5 M como mucho: un ± mayor viene de otra cosa y hay que decir cuál.
//  (a) con la cuenta normal, la casilla de la ficha dice «por la recompensa diaria» y la explicación, lo de siempre
//  (b) si lo que pesa es que faltan movimientos (tu base no cuadra) o subidas de cláusula que no se miden, lo dicen la
//      casilla, la explicación (con sus cifras) y lo que lee la IA
//  (c) con lo que te dijo en un tramo, «por lo que te dijo»
// Uso: PW_MODULO=… node .github/ia/caso-margen-dinero.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const { page } = await pagina('martes');
const r = await page.evaluate(async () => {
  const U = await import('./js/util.js'), Hj = await import('./js/hojas.js'), Co = await import('./js/comunes.js'), I = await import('./js/ia.js');
  const S = window.S, M = S.M;
  const riv = M.rivales.find((x) => x.dinero && x.dinero.v != null && !x.dinero.exacto && x.dinero.partes);
  if (!riv) return { sin: true };
  const tid = riv.e.teamId;
  U.LS.set('top-rivales', { j: null, usos: 1, abiertos: { [tid]: Date.now() + 5 * 60e3 }, uno: null });
  const casilla = () => { S.segRival = { tid, seg: 'juego', sub: 'movs' }; const el = document.createElement('div'); el.innerHTML = Hj.fichaRival(S, tid); const b = [...el.querySelectorAll('.eq2-t')].find((x) => /su dinero/.test(x.textContent)); return b ? b.textContent.replace(/\s+/g, ' ') : ''; };
  const ia = () => { const t = I.contexto(S.D, M, I.cfgIA()); const l = t.split('\n').find((x) => x.includes(`| ${riv.e.manager} |`) && /dinero ≈/.test(x)) || ''; return (l.match(/dinero ≈[^|]*/) || [''])[0]; };
  const out = { nombre: riv.e.manager, partes: riv.dinero.partes, margen: riv.dinero.margen };
  out.a = { casilla: casilla(), largo: Co.dineroLargo(riv.dinero), ia: ia() };
  const orig = riv.dinero;
  riv.dinero = { ...orig, margen: 21.7e6, partes: { fija: 1e6, rec: 7.5e6, dudas: 0, desvio: 13.2e6, raros: 0 } };
  out.b = { casilla: casilla(), largo: Co.dineroLargo(riv.dinero), ia: ia() };
  riv.dinero = { ...orig, margen: 17.7e6, partes: { fija: 1e6, rec: 7.5e6, dudas: 9.2e6, desvio: 0, raros: 0 } };
  out.b2 = { casilla: casilla(), largo: Co.dineroLargo(riv.dinero), ia: ia() };
  riv.dinero = { v: 40e6, exacto: false, margen: 3e6, partes: { fija: 0.3e6, rec: 0.7e6, dicho: 2e6 }, fiable: 'alta', dicho: { v: 40e6, min: 38e6, max: 42e6, r: 2e6, t: Date.now() - 3600e3 }, desdeDicho: 0 };
  out.c = { casilla: casilla(), largo: Co.dineroLargo(riv.dinero), ia: ia() };
  riv.dinero = orig;
  return out;
});
if (r.sin) ok(false, 'la liga de ejemplo no trae ningún rival con el dinero estimado');
else {
  const top = Object.entries(r.partes).filter(([k]) => k !== 'fija').sort((a, b) => b[1] - a[1])[0];
  ok(top[0] === 'rec' && /± [\d,]+ (M|mil) por la recompensa diaria/.test(r.a.casilla), `(a) ${r.nombre}, con la cuenta normal (pesa «${top[0]}»): «${r.a.casilla}»`);
  ok(/El ± es por la recompensa diaria/.test(r.a.largo) && !/el ± es por/.test(r.a.ia), `(a) la explicación, la de siempre, y a la IA no se le repite («${r.a.ia.slice(0, 60)}…»)`);
  ok(/± 21,70 M por movimientos que faltan ›?/.test(r.b.casilla) && !/recompensa/.test(r.b.casilla), `(b) si lo que pesa es que faltan movimientos: «${r.b.casilla}»`);
  ok(/El ± son 13,20 M de movimientos que faltan \(tu cuenta no cuadra[^)]*\), 7,50 M de la recompensa diaria \(no se sabe cuántas ha cogido\) y 1,00 M de holgura\./.test(r.b.largo), `(b) la explicación, con sus cifras: «…${r.b.largo.slice(r.b.largo.indexOf('El ±'), r.b.largo.indexOf('El ±') + 170)}…»`);
  ok(/el ± es por movimientos que faltan y la recompensa diaria/.test(r.b.ia), `(b) y lo lee la IA: «${r.b.ia.slice(-90)}»`);
  ok(/por subidas de cláusula/.test(r.b2.casilla) && /El ± son 9,20 M de subidas de cláusula que no se pueden medir, 7,50 M de la recompensa diaria/.test(r.b2.largo) && /el ± es por subidas de cláusula y la recompensa diaria/.test(r.b2.ia), `(b) subidas de cláusula que no se miden: «${r.b2.casilla}»`);
  ok(/por lo que te dijo/.test(r.c.casilla) && /El ± son 2,00 M de lo que te dijo, que era un tramo y no una cifra/.test(r.c.largo) && /el ± es por lo que te dijo/.test(r.c.ia), `(c) con lo que te dijo en un tramo: «${r.c.casilla}»`);
}
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
