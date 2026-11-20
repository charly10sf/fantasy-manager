// El peligro de cada rival (20 nov, «todos los rivales me pone peligro bajo»): sale de lo que PUEDE hacerte (su dinero
// frente a tus cláusulas que se pagan en tu liga) y de lo que SUELE hacer (sus clausulazos de toda la temporada). Sin red,
// con la liga de ejemplo y rivales forzados:
//  (a) mucho dinero, tres cláusulas tuyas baratas abiertas, sin clausulazos: no puede salir «bajo»
//  (b) sin dinero y muy activo (el que más clausula), con las mismas cláusulas baratas: «bajo» (20 nov, tarde, Carlos:
//      «¿cómo puede ser peligro medio gente con 600 M igual que otro con 90 M?»: el historial ya no deja en «medio» al que
//      no tiene dinero para ninguna cláusula tuya)
//  (c) en la veda: el peligro de cuando se reabran (ya no un escalón menos: en la veda salían todos «medio»), y lo dice
//  (f) el mismo rival que más clausula, con mucho dinero: por encima de como sale sin dinero
//  (d) tras un parón sin movimientos (nada en 15 días): el de (a) sigue sin salir «bajo»
//  (e) el porqué no lleva cifras de dinero (vale con el dinero del rival cerrado) ni, con «quién paga» cerrado, qué le llega
// y además: en la liga tal cual no salen todos en «alto», y ningún rival que paga una cláusula tuya en riesgo alto sale
// «bajo». Uso: PW_MODULO=… node .github/ia/caso-peligro.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const forzar = async (P, { veda = false, sinMov = false, activoRico = false } = {}) => P.page.evaluate(async ({ sinMov, activoRico }) => {
  const S = window.S, Mo = await import('./js/motor.js');
  const D = JSON.parse(JSON.stringify(S.D));
  const M0 = S.M, yo = D.yo.teamId;
  // el rival rico y tranquilo: el que menos se ha movido sin clausulazos; el activo sin dinero: el que más clausula
  const czDe = (tid) => (D.actividad || []).filter((a) => a.clase === 'clausula' && M0.teamDeUsuario(a.quienId, a.quien) === tid).length;
  const rs = M0.rivales.map((r) => ({ tid: r.e.teamId, n: r.e.nombre, cz: czDe(r.e.teamId), movs: r.movs }));
  const rico = rs.filter((r) => !r.cz).sort((a, b) => a.movs - b.movs)[0];
  const activo = rs.slice().sort((a, b) => b.cz - a.cz || b.movs - a.movs)[0];
  D.dineros = { ...(D.dineros || {}), [rico.tid]: { v: 400e6, fuente: 'LaLiga' }, [activo.tid]: { v: activoRico ? 400e6 : 1e6, fuente: 'LaLiga' } };
  // tres de los que más te dan, con la cláusula a su valor (+2 %) y abierta
  const top = M0.mias.filter((x) => x.clausula).sort((a, b) => b.pierde - a.pierde).slice(0, 3).map((x) => x.pid);
  for (const f of D.plantillas[yo]) if (top.includes(f.pid)) { f.clausula = Math.round(D.maestro[f.pid].valor * 1.02); f.protegidoHasta = 0; }
  // un parón sin movimientos: todo lo de la liga, 15 días antes
  if (sinMov) for (const a of D.actividad || []) if (a.t) a.t -= 15 * 864e5;
  const M = Mo.analizar(D, S.H, S.c, {});
  const R = (tid) => M.rivales.find((r) => r.e.teamId === tid);
  const motivos = M.rivales.map((r) => Mo.motivoPeligro(r)), sinQuien = M.rivales.map((r) => Mo.motivoPeligro(r, { quien: false }));
  const enAlto = [];
  for (const x of M.mias) if (x.riesgo === 'alto' && x.pagan) for (const y of x.pagan.seguro) enAlto.push({ j: x.j.nombre, rival: R(y.tid).e.nombre, nivel: R(y.tid).nivel });
  const ver = (r) => ({ n: r.e.nombre, nivel: r.nivel, a: r.amenaza, veda: r.peligro.veda ? r.peligro.veda.nivel : null, motivo: Mo.motivoPeligro(r), puede: r.peligro.puede, suele: r.peligro.suele });
  return { rico: ver(R(rico.tid)), activo: ver(R(activo.tid)), top: top.map((p) => D.maestro[p].nombre), motivos, sinQuien, enAlto };
}, { sinMov, activoRico });

const tal = async (P) => P.page.evaluate(() => window.S.M.rivales.map((r) => r.nivel));
const ESC = ['alta', 'media', 'baja'];

// la liga tal cual: no todos en alto
for (const e of ['martes', 'veda', 'enjuego', 'paron']) {
  const P = await pagina(e);
  const n = await tal(P);
  ok(n.filter((x) => x === 'alta').length <= n.length / 2, `${e}: no salen todos en «alto» (${['alta', 'media', 'baja'].map((k) => `${n.filter((x) => x === k).length} ${k}`).join(', ')})`);
  if (P.errores.length) ok(false, `${e}: errores en la página: ${P.errores.join(' | ')}`);
  await P.cerrar();
}

{
  const P = await pagina('martes');
  const r = await forzar(P);
  console.log(`     forzados: ${r.top.join(', ')} a su valor y abiertas; rico ${r.rico.n}, activo ${r.activo.n}`);
  ok(r.rico.nivel !== 'baja', `(a) mucho dinero, cláusulas baratas abiertas y sin clausulazos: ${r.rico.nivel} (${r.rico.a}; ${r.rico.motivo})`);
  ok(r.activo.nivel === 'baja', `(b) sin dinero y el que más clausula: ${r.activo.nivel} (${r.activo.a}; ${r.activo.motivo})`);
  ok(/no le llega/i.test(r.activo.motivo), `(b) el porqué dice que no le llega: «${r.activo.motivo}»`);
  ok(/le llega/i.test(r.rico.motivo), '(a) el porqué dice qué cláusulas le llegan');
  ok(r.motivos.every((m) => m && !/\d\s?(M|mil)\b|€/.test(m)), '(e) ningún porqué lleva cifras de dinero');
  ok(r.sinQuien.every((m) => !/le llega/i.test(m)), '(e) con «quién paga» cerrado no dice qué cláusulas le llegan');
  ok(r.enAlto.every((x) => x.nivel !== 'baja'), `quien paga una cláusula tuya en riesgo alto no sale «bajo» (${r.enAlto.length} casos${r.enAlto.filter((x) => x.nivel === 'baja').map((x) => `: ${x.j} → ${x.rival}`).join('')})`);
  await P.cerrar();
}
{
  const P = await pagina('veda');
  const r = await forzar(P);
  ok(!!r.rico.veda && r.rico.nivel === r.rico.veda, `(c) en la veda, el peligro de cuando se reabran: ${r.rico.nivel} (al reabrirse ${r.rico.veda})`);
  ok(r.rico.nivel !== 'baja', `(c) en la veda, el rico con tus cláusulas baratas no es «bajo» (${r.rico.nivel})`);
  ok(r.activo.nivel === 'baja' && r.rico.nivel !== r.activo.nivel, `(c) en la veda no salen iguales el rico y el que no tiene dinero (${r.rico.nivel} / ${r.activo.nivel})`);
  ok(/^Cláusulas cerradas hasta .+; al reabrirse, /.test(r.rico.motivo), `(c) lo dice: «${r.rico.motivo}»`);
  ok(r.enAlto.every((x) => x.nivel !== 'baja'), '(c) en la veda tampoco sale «bajo» quien paga una cláusula tuya en riesgo alto');
  await P.cerrar();
}
{
  const P = await pagina('martes');
  const pobre = await forzar(P), rico = await forzar(P, { activoRico: true });
  ok(rico.activo.a > pobre.activo.a && rico.activo.nivel !== 'baja', `(f) el que más clausula, con dinero (${rico.activo.nivel}, ${rico.activo.a}) por encima de sin dinero (${pobre.activo.nivel}, ${pobre.activo.a})`);
  await P.cerrar();
}
{
  const P = await pagina('paron-final');
  const r = await forzar(P, { sinMov: true });
  ok(r.rico.nivel !== 'baja', `(d) tras un parón sin movimientos, el rico con tus cláusulas baratas: ${r.rico.nivel} (${r.rico.motivo})`);
  ok(r.activo.nivel === 'baja', `(d) y el que clausulaba, sin dinero: ${r.activo.nivel} (${r.activo.motivo})`);
  await P.cerrar();
}
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo bien');
process.exit(mal ? 1 : 0);
