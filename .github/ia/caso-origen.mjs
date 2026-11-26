// De dónde sale cada fichaje que recomienda la app (26 nov; idea de IsmaelMartín, liga «VESTUARIO 5»: «del mercado de la
// liga y de jugadores de equipos de los participantes»; Carlos: una sola lista, con la etiqueta al lado de cada uno).
//   A. `origenFichaje` (operaciones.js) con la liga de ejemplo: un libre del mercado dice «Mercado»; uno que vende otro
//      mánager, «En venta · <su equipo>»; una cláusula, «Cláusula · <su equipo>». Con un apodo puesto a ese rival, el
//      nombre del equipo igual (el apodo no se usa aquí). Ventas, blindajes y alinear no llevan origen.
//   B. Hoy, en un móvil de 360 px: el plan con un libre y uno en venta de un rival enseña la etiqueta de cada uno al lado
//      del nombre, entera (sin cortar), y un paso descartado no la lleva. CAPTURA=<archivo.png> guarda la captura.
// Uso: PW_MODULO=… node .github/ia/caso-origen.mjs
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const { page, errores, cerrar: cerrarCtx } = await pagina('martes');
try {
  /* --- A: los datos --- */
  const A = await page.evaluate(async () => {
    const O = await import('./js/operaciones.js');
    const S = window.S, M = S.M, yo = String(M.yo.teamId);
    const libre = M.mercado.find((m) => m.tipo === 'liga' && m.j);
    const venta = M.mercado.find((m) => m.tipo === 'manager' && m.j && String(m.vendedorTeamId) !== yo);
    const cl = M.clausulas[0];
    const r = {
      libre: libre && O.origenFichaje(M, { accion: 'pujar', ref: `P-${libre.pid}`, pid: libre.pid }),
      libreSinRef: libre && O.origenFichaje(M, { accion: 'pujar', j: libre.j }),
      venta: venta && O.origenFichaje(M, { accion: 'comprar', ref: `M-${venta.pid}`, pid: venta.pid }),
      ventaEq: venta && M.equipo[venta.vendedorTeamId].nombre,
      cl: cl && O.origenFichaje(M, { accion: 'clausular', ref: `C-${cl.pid}`, pid: cl.pid }),
      clEq: cl && cl.rival.nombre,
      urgente: cl && O.origenFichaje(M, { tipo: 'clausular', pid: cl.pid }),
      vender: O.origenFichaje(M, { accion: 'vender', ref: `V-${M.mias[0].pid}`, pid: M.mias[0].pid }),
      blindar: O.origenFichaje(M, { accion: 'blindar', ref: `B-${M.mias[0].pid}`, pid: M.mias[0].pid }),
      // ya no está en el mercado (lo ha ganado alguien): por la referencia, un P- es del mercado
      ido: libre && O.origenFichaje({ ...M, mercado: [] }, { accion: 'pujar', ref: `P-${libre.pid}`, pid: libre.pid }),
    };
    // con apodo para ese rival: el nombre del equipo
    const U = await import('./js/util.js'), Dt = await import('./js/datos.js');
    if (venta) { U.LS.set(Dt.K('apodos'), { [String(venta.vendedorTeamId)]: 'El Tito' }); r.ventaApodo = O.origenFichaje(M, { accion: 'comprar', ref: `M-${venta.pid}`, pid: venta.pid }); U.LS.set(Dt.K('apodos'), {}); }
    return r;
  });
  ok(A.libre && A.libre.txt === 'Mercado' && A.libre.tipo === 'mercado', `un libre: «${A.libre && A.libre.txt}»`);
  ok(A.libreSinRef && A.libreSinRef.txt === 'Mercado', 'un libre sin referencia (solo el jugador): «Mercado»');
  ok(A.venta && A.venta.txt === `En venta · ${A.ventaEq}`, `uno en venta de un rival: «${A.venta && A.venta.txt}»`);
  ok(A.ventaApodo && A.ventaApodo.txt === `En venta · ${A.ventaEq}`, `con apodo puesto, el nombre del equipo: «${A.ventaApodo && A.ventaApodo.txt}»`);
  ok(A.cl && A.cl.txt === `Cláusula · ${A.clEq}`, `una cláusula: «${A.cl && A.cl.txt}»`);
  ok(A.urgente && A.urgente.txt === `Cláusula · ${A.clEq}`, 'la cláusula urgente de «Antes de nada», igual');
  ok(!A.vender && !A.blindar, 'vender y blindar no llevan origen');
  ok(A.ido && A.ido.txt === 'Mercado', 'una puja por uno que ya no está en el mercado: «Mercado»');

  /* --- B: Hoy en 360 px, con un libre y uno en venta de un rival --- */
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => localStorage.setItem('fm-beta-aviso', '1'));
  const B0 = await page.evaluate(() => {
    const S = window.S, M = S.M, yo = String(M.yo.teamId);
    const venta = M.mercado.find((m) => m.tipo === 'manager' && m.j && String(m.vendedorTeamId) !== yo);
    const ops = S.plan.ops;
    const i = ops.findIndex((o) => ['pujar', 'clausular'].includes(o.accion));
    const n = Math.max(...ops.map((o) => o.n || 0)) + 1;
    const paso = { n, accion: 'comprar', ref: `M-${venta.pid}`, pid: venta.pid, j: venta.j, jugador: venta.j.nombre, donde: `ofértale a ${venta.vendedor || 'su mánager'}`, importe: venta.precio, signo: -1, cuando: 'hoy', confianza: 'media', objetivo: 'titular', motivo: 'Mejora tu once.' };
    ops.splice(i < 0 ? ops.length : i + 1, 0, paso);
    // y un descartado de un libre: sin etiqueta
    const libre = M.mercado.find((m) => m.tipo === 'liga' && m.j && !ops.some((o) => o.pid === m.pid));
    ops.push({ n: n + 1, accion: 'pujar', ref: `P-${libre.pid}`, pid: libre.pid, j: libre.j, jugador: libre.j.nombre, donde: 'en el mercado', importe: libre.precio, descartada: true, aviso: 'La app lo descarta: no mejora tu once.', motivo: 'x' });
    return { venta: venta.j.nombre, libre: libre.j.nombre, pujas: ops.filter((o) => o.accion === 'pujar' && !o.descartada).map((o) => o.jugador) };
  });
  await page.click('[data-ir="equipo"]');
  await page.click('[data-ir="hoy"]');
  await page.waitForSelector('.paso3 .pp-ori');
  const B = await page.$$eval('details.paso3', (l) => l.map((d) => {
    const ori = d.querySelector('.pp-l1 .pp-ori');
    const caja = d.querySelector('summary').getBoundingClientRect();
    const r = ori && ori.getBoundingClientRect();
    return { nom: (d.querySelector('.pp-nom') || {}).textContent || '', acc: (d.querySelector('.accion-t') || {}).textContent || '', desc: d.classList.contains('descartada'), ori: ori ? ori.textContent : null, corta: ori ? ori.scrollWidth > ori.clientWidth + 1 || r.right > caja.right + 1 : false };
  }));
  const de = (nom) => B.find((x) => x.nom === nom && !x.desc);
  ok(de(B0.venta) && de(B0.venta).ori && de(B0.venta).ori.startsWith('En venta · '), `Hoy: ${B0.venta} lleva «${de(B0.venta) && de(B0.venta).ori}»`);
  for (const p of B0.pujas) ok(de(p) && de(p).ori === 'Mercado', `Hoy: la puja por ${p} lleva «${de(p) && de(p).ori}»`);
  const d = B.find((x) => x.nom === B0.libre && x.desc);
  ok(d && !d.ori, `Hoy: el descartado (${B0.libre}) no lleva etiqueta`);
  ok(B.every((x) => !x.corta), `en 360 px ninguna etiqueta se corta (${B.filter((x) => x.ori).length} con etiqueta)`);
  ok(B.filter((x) => !['Pujar', 'Comprar', 'Clausular', 'Recambio'].includes(x.acc) || x.desc).every((x) => !x.ori), 'solo los fichajes llevan etiqueta');
  if (process.env.CAPTURA) {
    // la fase de fichar, arriba (debajo de la barra fija)
    await page.evaluate(() => { const e = document.querySelector('details.paso3 .pp-ori').closest('details'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 150); });
    await page.screenshot({ path: process.env.CAPTURA });
  }
  ok(!errores.length, `sin errores de la página${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`);
} catch (e) { mal++; console.log(`MAL  se rompe: ${e.stack || e.message}`); }
await cerrarCtx();
await cerrar();
console.log(mal ? `${mal} MAL` : 'todo BIEN');
process.exit(mal ? 1 : 0);
