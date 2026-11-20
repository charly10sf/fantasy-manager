// El árbitro de banco.mjs, a prueba (19 nov, tercera parte de la revisión de la IA): cada regla que mira, con un plan hecho
// a mano que se la salta, tiene que salir como MAL; y el plan de la app de esa escena, como ok. Así una regla que deja de
// comprobarse (por un cambio en el árbitro o en lo que deja el motor) se ve aquí y no en un plan de verdad.
// Uso: PW_MODULO=… node .github/ia/caso-arbitro.mjs   (sale con 1 si algo falla)
import { pagina, cerrar, arbitro } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

/** en la escena, `montar(S)` devuelve [nombre, regla esperada (regex) o null si tiene que salir ok, plan] */
async function probar(escena, montar, prep = null) {
  const P = await pagina(escena);
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const r = await P.page.evaluate(async ({ montar, prep }) => {
      const U = await import('./js/util.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js'), Mo = await import('./js/motor.js');
      const S = window.S;
      if (prep) { new Function('S', prep)(S); S.M = Mo.analizar(S.D, S.H, S.c, {}); }
      const { D, M } = S;
      const base = Pm.planDeHoy(D, M, Dt.cfg());
      // eslint-disable-next-line no-new-func
      const casos = new Function('S', 'D', 'M', 'base', montar)(S, D, M, base);
      return casos.map(([n, re, R]) => ({ n, re, l: window.__arbitro(R, D, M, U.eur).find((x) => /^REGLAS:/.test(x)) }));
    }, { montar, prep });
    for (const x of r) {
      const bien = x.re ? new RegExp(x.re).test(x.l) : /^REGLAS: ok/.test(x.l);
      ok(bien, `${escena}: ${x.n} → ${x.l.slice(0, 200)}`);
    }
    if (P.errores.length) ok(false, `${escena}: errores de la página: ${P.errores[0]}`);
  } finally { await P.cerrar(); }
}

// lo común: un jugador mío, uno libre del mercado, uno de un rival con la cláusula abierta
const COMUN = `
  const mio = M.mias.filter((x) => x.j.pos !== 5).sort((a, b) => b.j.valor - a.j.valor)[0];
  const libre = M.mercado.find((m) => m.tipo === 'liga' && !M.dueno[m.pid]);
  const op = (o) => ({ motivo: 'Porque sí.', hoy: true, ...o });
  const plan = (ops, extra = {}) => ({ titular: 'Plan', ops, ...extra });
`;

await probar('martes', `${COMUN}
  return [
    ['el plan de la app', null, base],
    ['pujar con 25 jugadores', 'r17', null],
    ['pujar por uno que no está en el mercado', 'no está en el mercado', plan([op({ accion: 'pujar', pid: mio.pid, j: mio.j, jugador: mio.j.nombre, importe: 1e6 })])],
    ['«antes de las 20:00» con el mercado a las 00:15', 'rM', plan([op({ accion: 'pujar', pid: libre.pid, j: libre.j, jugador: libre.j.nombre, importe: libre.precio, cuando: 'hoy antes de las 20:00' })])],
    ['pujar «hoy» con el día de otra semana', 'rH', plan([op({ accion: 'pujar', pid: libre.pid, j: libre.j, jugador: libre.j.nombre, importe: libre.precio, cuando: 'el dom 8' })])],
    ['una cláusula de más del saldo', 'r5', (() => { const c = M.clausulas.find((x) => x.abierta && x.clausula > D.dinero + 1e6) || M.clausulas.find((x) => x.abierta); return plan([op({ accion: 'clausular', pid: c.pid, j: c.j, jugador: c.j.nombre, importe: Math.max(c.clausula, D.dinero + 5e6) })]); })()],
    ['comprar por debajo de lo que pide', 'r6', (() => { const v = M.mercado.find((m) => m.tipo === 'manager' && m.vendedorTeamId !== D.yo.teamId); return plan([op({ accion: 'comprar', pid: v.pid, j: v.j, jugador: v.j.nombre, importe: Math.round(v.precio * 0.8) })]); })()],
    // (20 nov, Carlos) las cláusulas casi nunca se suben: como mucho un 5 % de su valor y nunca a uno que se frena o baja
    ['subir la cláusula por más de un 5 % de su valor', 'rC: subir la cláusula de [^·]+ cuesta', plan([op({ accion: 'blindar', pid: mio.pid, j: mio.j, jugador: mio.j.nombre, importe: Math.round(mio.j.valor * 0.2) })])],
    ...(() => { const b = M.mias.find((x) => ['giro', 'baja', 'frena', 'parado'].includes((M.inercia(x.pid) || {}).fase) && x.j.pos !== 5); return b ? [['subir la cláusula a uno que se frena o baja, aunque sea barato', 'rC: subir la cláusula de [^·]+, que', plan([op({ accion: 'blindar', pid: b.pid, j: b.j, jugador: b.j.nombre, importe: Math.round(b.j.valor * 0.01) })])]] : []; })(),
    // (20 nov, Carlos con Revivo) a un rival, por uno suyo que sube, no menos de lo que pediría
    ...(() => { const r = M.clausulas.find((x) => x.j.pos !== 5 && !M.mercado.some((m) => m.pid === x.pid) && (M.ofertaDuenoDe(x.j) || {}).sube); return r ? [['ofrecer a su dueño por uno que sube menos de lo que pediría', 'rO', plan([op({ accion: 'comprar', pid: r.pid, j: r.j, jugador: r.j.nombre, importe: Math.round(M.ofertaDuenoDe(r.j).v * 0.9) })])]] : []; })(),
    // (20 nov, Carlos) la IA, al momento: el plan con la liga de hace dos horas no vale
    ['el plan con la liga de hace dos horas', 'rD', { ...base, t: D.t + 2 * 3600e3 }],
    ['el titular nombra a uno descartado', 'titular', plan([op({ accion: 'pujar', pid: libre.pid, j: libre.j, jugador: libre.j.nombre, importe: libre.precio, descartada: true })], { titular: 'Hoy, puja por ' + libre.j.nombre })],
  ].map((c) => (c[1] === 'r17' ? null : c)).filter(Boolean);
`);
// con 25 jugadores (m-25), pujar sin vender antes
await probar('m-25', `${COMUN}
  return [
    ['el plan de la app con 25', null, base],
    ['pujar con 25 jugadores', 'r17', plan([op({ accion: 'pujar', pid: libre.pid, j: libre.j, jugador: libre.j.nombre, importe: libre.precio })])],
    // (20 nov, Carlos: «con 25 jugadores tampoco se puede clausular, ya te lo dije»)
    ...(() => { const c = M.clausulas.find((x) => x.abierta && x.clausula <= D.dinero) || M.clausulas.find((x) => x.abierta); return c ? [['clausular con 25 jugadores', 'r17', plan([op({ accion: 'clausular', pid: c.pid, j: c.j, jugador: c.j.nombre, importe: c.clausula })])]] : []; })(),
  ];
`);
// en negativo entre semana, con tres cambios de mercado por delante: no se malvende
await probar('m-negativo', `${COMUN}
  const v = D.misVentas.find((x) => x.ofertas && x.ofertas.length);
  const jv = M.J(v.pid);
  const sano = M.mias.find((x) => x.j.pos !== 5 && !['giro', 'baja', 'frena'].includes((M.inercia(x.pid) || {}).fase) && !M.vendeBaja(x) && (M.tend(x.pid) || {}).p7 > -2 && x.pid !== v.pid);
  return [
    ['el plan de la app en negativo', null, base],
    ['aceptar una oferta por debajo de su valor', 'rN', plan([op({ accion: 'vender', etiqueta: 'Aceptar oferta', pid: sano.pid, j: sano.j, jugador: sano.j.nombre, importe: Math.round(sano.j.valor * 0.9) })])],
    ['poner a la venta hoy «por caja» uno que no cae', 'rN', plan([op({ accion: 'vender', objetivo: 'caja', pid: sano.pid, j: sano.j, jugador: sano.j.nombre, importe: sano.j.valor })])],
  ];
`);
// en el parón, para el once: lo que ni sube ni es un chollo
await probar('paron', `${COMUN}
  const caro = M.mercado.filter((m) => m.tipo === 'liga' && !M.dueno[m.pid] && !['sube', 'acelera'].includes((M.inercia(m.pid) || {}).fase)).sort((a, b) => b.j.valor - a.j.valor)[0];
  return [
    ['el plan de la app en el parón', null, base],
    ['pujar para el once un 20 % por encima de su valor sin que suba', 'rP', plan([op({ accion: 'pujar', objetivo: 'titular', pid: caro.pid, j: caro.j, jugador: caro.j.nombre, importe: Math.round(caro.j.valor * 1.2) })])],
  ];
`, 'S.D.dinero = 200000000;');
// el once con uno que se vende hoy
await probar('martes', `${COMUN}
  const v = D.misVentas.find((x) => x.ofertas && x.ofertas.length);
  const jv = M.J(v.pid), of = v.ofertas.find((o) => !o.deLiga) || v.ofertas[0];
  return [
    ['vender hoy a uno que va en el once', 'r18', plan([op({ accion: 'vender', etiqueta: 'Aceptar oferta', pid: v.pid, j: jv, jugador: jv.nombre, importe: of.importe })], { alineacion: { titulares: [jv.nombre] } })],
  ];
`, 'S.D.dinero = 30000000;');
// (19 nov, sesión larga) con el mercado de verdad de un día (banco.mjs, 'mercado-real'): el plan de la app vale y las reglas
// se siguen viendo con jugadores y precios reales
await probar('mercado-real', `${COMUN}
  return [
    ['el plan de la app con el mercado de verdad', null, base],
    ['comprar por debajo de lo que pide', 'r6', (() => { const v = M.mercado.find((m) => m.tipo === 'manager' && m.vendedorTeamId !== D.yo.teamId); return plan([op({ accion: 'comprar', pid: v.pid, j: v.j, jugador: v.j.nombre, importe: Math.round(v.precio * 0.8) })]); })()],
    ['pujar por uno de verdad del mercado sin dinero para la jornada', 'r10', plan([op({ accion: 'pujar', pid: libre.pid, j: libre.j, jugador: libre.j.nombre, importe: libre.precio + 60e6 })])],
    ['una cláusula de más del saldo', 'r5', (() => { const c = M.clausulas.find((x) => x.abierta && x.clausula > D.dinero + 1e6) || M.clausulas.find((x) => x.abierta); return plan([op({ accion: 'clausular', pid: c.pid, j: c.j, jugador: c.j.nombre, importe: Math.max(c.clausula, D.dinero + 5e6) })]); })()],
  ];
`);
await cerrar();
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
