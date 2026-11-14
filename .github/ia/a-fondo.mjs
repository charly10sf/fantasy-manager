// El motor del plan, a fondo: la liga de ejemplo movida al azar (saldo, pujas puestas, plantilla de 11 a 25, lesionados,
// cláusulas mías abiertas a su valor, ofertas por lo que vendo, cosas compradas para revender) en nueve momentos de la
// semana. En cada una, el plan del motor pasa por el árbitro de banco.mjs: no puede saltarse ninguna regla de LaLiga ni
// llevar nada que la app descarte. No va en la Action (tarda): se pasa a mano al tocar web/js/plan.js.
// Uso: node .github/ia/a-fondo.mjs [vueltas por momento = 25] [semilla = 1]   (PW_MODULO como en prueba-web.mjs)
// MOTOR=viejo pasa las mismas ligas por el plan sin IA de antes (planAuto), para comparar.
import { pagina, cerrar, arbitro, ESCENAS } from './banco.mjs';

const N = +process.argv[2] || 25, SEMILLA = +process.argv[3] || 1;
const paron = (s) => s.replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,');
const MOMENTOS = {
  'martes 10:00': { hora: '2026-11-03T10:00:00+01:00' },
  'miércoles 23:50': { hora: '2026-11-04T23:50:00+01:00' },
  'jueves 12:00': { hora: '2026-11-05T12:00:00+01:00' },
  'viernes 16:00 (cierre)': { hora: '2026-11-06T16:00:00+01:00' },
  'sábado 13:30 (cierre)': { hora: '2026-11-07T13:30:00+01:00' },
  'sábado 16:00 (en juego)': { hora: '2026-11-07T16:00:00+01:00' },
  'lunes 23:00 (en juego)': { hora: '2026-11-09T23:00:00+01:00' },
  'parón, martes': { hora: '2026-11-03T10:00:00+01:00', demo: paron },
  'parón, a 2 días': { hora: '2026-11-12T10:00:00+01:00', demo: paron },
};
let total = 0, mal = 0, ms = 0, peor = 0, ops = 0, vacios = 0, viejos = 0, sinSalida = 0;
for (const [nombre, E] of Object.entries(MOMENTOS)) {
  ESCENAS['a-fondo'] = E;
  const P = await pagina('a-fondo');
  await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
  const r = await P.page.evaluate(async ({ N, semilla, viejo }) => {
    const U = await import('./js/util.js'), Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), I = await import('./js/ia.js');
    const S = window.S;
    for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
    const f = S.fuentes || {};
    const D0 = structuredClone(S.D);
    let s = semilla >>> 0;
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const de = (xs) => xs[Math.floor(r() * xs.length)];
    const out = [];
    for (let k = 0; k < N; k++) {
      const D = structuredClone(D0), yo = D.yo.teamId, cambios = [];
      let mios = D.plantillas[yo];
      const fin = (D.mercado.find((m) => m.cierra) || {}).cierra || Date.now() + 36e5;
      // el saldo
      const q = r();
      D.dinero = Math.round((q < 0.2 ? -1 - r() * 80 : q < 0.6 ? r() * 15 : 15 + r() * 135) * 1e6);
      // las pujas puestas
      for (const m of D.mercado) m.miPuja = null;
      if (r() < 0.5) for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) { const m = de(D.mercado.filter((x) => x.tipo === 'liga')); m.miPuja = Math.round(m.precio * (1 + r() * 0.2)); }
      // la plantilla: quitar o añadir
      if (r() < 0.3) { for (let i = 0, n = 1 + Math.floor(r() * 4); i < n && mios.length > 8; i++) mios.splice(Math.floor(r() * mios.length), 1); cambios.push('menos'); }
      if (r() < 0.35) {
        const con = new Set(Object.values(D.plantillas).flat().map((x) => x.pid)), enM = new Set(D.mercado.map((m) => m.pid));
        const libres = Object.values(D.maestro).filter((j) => !con.has(j.id) && !enM.has(j.id) && j.pos !== 5);
        const n = r() < 0.5 ? 25 - mios.length : 1 + Math.floor(r() * 6);
        for (let i = 0; i < n && libres.length && mios.length < 25; i++) { const j = libres.splice(Math.floor(r() * libres.length), 1)[0]; mios.push({ pid: j.id, ptId: `pt${j.id}`, clausula: Math.round(j.valor * (1.1 + r())), protegidoHasta: r() < 0.5 ? null : Date.now() + r() * 12 * 864e5, compra: Math.round(j.valor * (0.7 + r() * 0.5)) }); }
        cambios.push(`plantilla ${mios.length}`);
      }
      // cláusulas mías abiertas y casi a su valor
      if (r() < 0.4) for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) { const x = de(mios); x.clausula = Math.round(D.maestro[x.pid].valor * (1 + r() * 0.1)); x.protegidoHasta = null; }
      // lesionados
      if (r() < 0.3) for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) D.maestro[de(mios).pid].estado = de(['injured', 'suspended', 'doubtful']);
      // más ofertas por lo que vendo
      if (r() < 0.4) {
        for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) {
          const x = de(mios), j = D.maestro[x.pid];
          if (D.misVentas.some((v) => v.pid === x.pid)) continue;
          const imp = Math.round(j.valor * (0.9 + r() * 0.2));
          D.misVentas.push({ marketId: `fz${k}${i}`, pid: j.id, ptId: `pt${j.id}`, precio: Math.round(j.valor * 1.1), cierra: fin, ofertas: [{ id: `ofz${k}${i}`, importe: imp, estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true }] });
          D.mercado.push({ id: `fz${k}${i}`, pid: j.id, tipo: 'manager', precio: Math.round(j.valor * 1.1), cierra: fin, pujas: 0, ofertas: 1, vendedorTeamId: yo, vendedor: D.yo.nombre, miPuja: null, clausula: null });
        }
      }
      D.misVentas = D.misVentas.filter((v) => mios.some((x) => x.pid === v.pid));
      D.mercado = D.mercado.filter((m) => m.vendedorTeamId !== yo || mios.some((x) => x.pid === m.pid));
      D.valorEquipo = mios.reduce((t, x) => t + D.maestro[x.pid].valor, 0);
      // que sea una liga posible: LaLiga no deja pasar del tope de deuda (20 % del valor del equipo) ni pujar más allá
      const deuda = Math.floor(D.valorEquipo * 0.2);
      D.dinero = Math.max(D.dinero, -Math.round(deuda * 0.95));
      let cabe = D.dinero + deuda;
      for (const m of D.mercado) { if (!m.miPuja) continue; if (m.miPuja > cabe) m.miPuja = null; else cabe -= m.miPuja; }
      // lo comprado para revender
      const reventa = {};
      if (r() < 0.3) for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) { const x = de(mios); reventa[x.pid] = { t: Date.now() - 2 * 864e5, precio: Math.round(D.maestro[x.pid].valor * (0.9 + r() * 0.15)) }; }
      let L = null, R = null, t = 0, error = null;
      try {
        const M = Mo.analizar(D, S.H, S.c, { det: S.det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, reventa });
        const t0 = performance.now();
        R = viejo ? Mo.rematarAuto(I.cuadrarPlan(Mo.planAuto(D, M, S.c), D, M)) : Pm.planDeHoy(D, M, S.c);
        t = performance.now() - t0;
        L = window.__arbitro(R, D, M, U.eur);
        if ((R.ops || []).some((o) => o.descartada)) L.push('REGLAS: MAL lleva algo descartado por la app');
        if ((R.ops || []).some((o) => o.sugerencia)) L.push('REGLAS: MAL lleva una venta «sin prisa» de la app');
        if (!R.motor && !viejo) L.push('REGLAS: MAL el motor ha fallado y ha salido el plan de antes');
      } catch (e) { error = `${e.message} ${String(e.stack || '').split('\n').slice(1, 3).join(' ')}`; }
      let malas = error ? [error] : L.filter((l) => /^REGLAS: MAL|^VENDE_POR_CAJA/.test(l));
      // sin salida: ni vendiendo se llega en positivo a la jornada. Vale si el plan lo dice y acepta todas las ofertas que hay
      let sinSalida = false;
      if (!error && malas.length === 1 && /^REGLAS: MAL r10: [^·]*$/.test(malas[0]) && R.avisoTipo === 'mal') {
        const M2 = R.ops || [];
        const ofertas = (D.misVentas || []).filter((v) => (v.ofertas || []).length);
        if (ofertas.every((v) => M2.some((o) => o.pid === v.pid && o.accion === 'vender' && !o.descartada))) { sinSalida = true; malas = []; }
      }
      const nOps = R ? (R.ops || []).filter((o) => !['alinear', 'esperar'].includes(o.accion)).length : 0;
      out.push({ k, t, nOps, sinSalida, viejo: !!R && !R.motor, malas, resumen: malas.length ? `[claves ${R && R.cuentas && R.cuentas.claves}; vetos: ${JSON.stringify((R && R.vetos) || []).slice(0, 500)}; aviso ${R && R.avisoTipo}; ofertas: ${(D.misVentas || []).map((v) => `${D.maestro[v.pid].nombre} ${(v.ofertas || []).length}`).join(', ')}] saldo ${U.eur(D.dinero)}, pujado ${U.eur(D.mercado.reduce((a, m) => a + (m.miPuja || 0), 0))}, plantilla ${mios.length}, ${cambios.join(', ')} → ${(R && R.ops || []).map((o) => `${o.etiqueta || o.accion} ${(o.j && o.j.nombre) || ''}${o.hoy === false ? ' (otro día)' : ''}`).join('; ')}` : '' });
    }
    return out;
  }, { N, semilla: SEMILLA * 7919 + Object.keys(MOMENTOS).indexOf(nombre), viejo: process.env.MOTOR === 'viejo' });
  await P.cerrar();
  const malos = r.filter((x) => x.malas.length);
  total += r.length; mal += malos.length;
  for (const x of r) { ms += x.t; peor = Math.max(peor, x.t); ops += x.nOps; if (!x.nOps) vacios++; if (x.viejo && process.env.MOTOR !== 'viejo') viejos++; if (x.sinSalida) sinSalida++; }
  console.log(`${malos.length ? 'MAL ' : 'BIEN'} ${nombre}: ${r.length - malos.length} de ${r.length}`);
  for (const x of malos.slice(0, process.env.VER ? 99 : 4)) console.log(`     #${x.k} ${x.malas.join(' | ').slice(0, 300)}\n        ${x.resumen.slice(0, 400)}`);
  if (P.errores.length) console.log('     errores de la página:', P.errores.slice(0, 3));
}
await cerrar();
console.log(`\n${total - mal} de ${total} planes BIEN${mal ? `, ${mal} MAL` : ''} · ${(ops / total).toFixed(1)} operaciones de media, ${vacios} planes sin operaciones, ${sinSalida} sin salida (ni vendiendo se llega en positivo, y el plan lo dice) · el motor tarda ${(ms / total).toFixed(0)} ms de media y ${peor.toFixed(0)} ms el que más${viejos ? ` · ${viejos} veces salió el plan de antes` : ''}`);
process.exit(mal ? 1 : 0);
