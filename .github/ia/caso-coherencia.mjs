// Coherencia entre pantallas (19 nov, tercera parte de la revisión de la IA): en cada escena, lo que dicen de cada jugador
// Hoy (lo urgente de «Ahora mismo» que no está en el plan), Equipo (el consejo de cada uno en venta), el plan del motor,
// el plan con la IA (el mismo, aplicado sin cambios) y lo que se le pasa al chat para «¿vendo a X?» y «¿acepto?». Si dos
// sitios dicen cosas distintas del mismo jugador, es un fallo.
// Uso: PW_MODULO=… node .github/ia/caso-coherencia.mjs [escenas separadas por comas]   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

const ESCENAS = (process.argv[2] || 'martes,veda,sabado,enjuego,paron,paron-final,m-negativo,holgado,hora-20,jueves-negativo,m-oferta-sube,m-oferta-sube-alta,m-baja-sin-relevo,m-reventa-protege').split(',');
let mal = 0, total = 0;
for (const escena of ESCENAS) {
  const P = await pagina(escena);
  try {
    const r = await P.page.evaluate(async () => {
      const Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js');
      const { D, M } = window.S;
      const c = Dt.cfg();
      const R = Pm.planDeHoy(D, M, c);
      const vivos = (R.ops || []).filter((o) => !o.descartada && !o.sugerencia && o.pid);
      const plan = {};
      for (const o of vivos) (plan[o.pid] ||= []).push(o.etiqueta === 'Aceptar oferta' ? 'aceptar' : o.accion + (o.hoy === false ? ' (otro día)' : ''));
      const descartes = new Map((R.descartes || []).map((d) => [String(d.pid), d.motivo || '']));
      // el plan con la IA, sin que la IA cambie nada
      const { lista } = I.idsCorto(R);
      const A = I.aplicarCorto({ titular: 'Plan de hoy', situacion: 'Todo en orden.', pasos: lista.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: 'Vale la pena.' })), quita: [], mete: [] }, R, D, M, c);
      const conIA = {};
      for (const o of (I.cuadrarPlan(A, D, M).ops || []).filter((o) => !o.descartada && !o.sugerencia && o.pid)) (conIA[o.pid] ||= []).push(o.etiqueta === 'Aceptar oferta' ? 'aceptar' : o.accion + (o.hoy === false ? ' (otro día)' : ''));
      // Hoy: lo urgente que sale arriba sin estar en el plan (lo mismo que urgentesDe de vistas.js con el plan del motor)
      const enPlan = new Set(vivos.map((o) => String(o.pid)));
      const urg = (M.acciones || []).filter((a) => a.prio >= 78 && a.pid && !enPlan.has(String(a.pid)) && !(descartes.has(String(a.pid)) && ['vender', 'clausular', 'pujar'].includes(a.tipo))).slice(0, 3)
        .map((a) => ({ pid: String(a.pid), tipo: a.tipo, titulo: a.titulo }));
      // Equipo: el consejo de cada uno en venta
      const equipo = {};
      for (const v of M.misVentas || []) if (v.consejo) equipo[v.pid] = v.consejo;
      // lo que se le pasa al chat
      const datos = I.datosChat('¿Qué hago con mis jugadores?', D, M, c, {});
      const noVende = new Set([...datos.matchAll(/^- \w{3} \| ([^|]+?) \|[^\n]*LA APP: NO LO VENDER[ÍI]A HOY/gm)].map((m) => m[1].trim()));
      const chatOferta = Object.fromEntries([...datos.matchAll(/^- ([^(\n]+?) \(vale [^\n]*?→ la app aconseja ([A-ZÁÉÍÓÚ ]+?)(?=[:.]|$)/gm)].map((m) => [m[1].trim(), m[2].trim()]));
      const nombre = (pid) => (M.J(pid) || {}).nombre || pid;
      const mal = [];
      for (const pid of new Set([...Object.keys(plan), ...Object.keys(conIA)])) if (JSON.stringify(plan[pid] || []) !== JSON.stringify(conIA[pid] || [])) mal.push(`${nombre(pid)}: el plan de la app dice ${(plan[pid] || ['nada']).join(', ')} y el de la IA sin cambios ${(conIA[pid] || ['nada']).join(', ')}`);
      for (const [pid, l] of Object.entries(plan)) {
        const n = nombre(pid);
        if (l.some((x) => x === 'vender') && noVende.has(n)) mal.push(`${n}: el plan lo vende hoy y al chat se le dice «NO LO VENDERÍA HOY»`);
        if (l.includes('aceptar') && equipo[pid] === 'esperar') mal.push(`${n}: el plan acepta la oferta y en Equipo pone esperar`);
      }
      for (const [pid, con] of Object.entries(equipo)) {
        const n = nombre(pid), ch = chatOferta[n];
        if (ch && !new RegExp(con, 'i').test(ch) && !(con === 'esperar' && /NO VENDER|ESPERAR/.test(ch)) && !(con === 'aceptar' && /ACEPTAR/.test(ch))) mal.push(`${n}: en Equipo pone ${con} y al chat se le dice «${ch}»`);
        if (con === 'esperar' && (plan[pid] || []).includes('aceptar')) mal.push(`${n}: Equipo dice esperar y el plan acepta`);
      }
      for (const a of urg) {
        const n = nombre(a.pid);
        if (a.tipo === 'vender' && noVende.has(n)) mal.push(`${n}: Hoy dice «${a.titulo}» y al chat se le dice «NO LO VENDERÍA HOY»`);
        if (a.tipo === 'vender' && equipo[a.pid] === 'esperar') mal.push(`${n}: Hoy dice «${a.titulo}» y Equipo, esperar`);
        if (a.tipo === 'clausular') { const x = M.clausulas.find((y) => String(y.pid) === a.pid); if (x && M.mereceClausula && !M.mereceClausula(x)) mal.push(`${n}: Hoy dice «${a.titulo}» y la cláusula no pasa la regla de las alarmas`); }
      }
      return { mal, urg: urg.length, jugadores: new Set([...Object.keys(plan), ...Object.keys(equipo), ...urg.map((a) => a.pid)]).size, avisosAparte: urg.map((a) => `${a.tipo} ${nombre(a.pid)}`) };
    });
    total += r.jugadores;
    for (const m of r.mal) { mal++; console.log(`MAL  ${escena}: ${m}`); }
    console.log(`${r.mal.length ? 'MAL ' : 'BIEN'} ${escena}: ${r.jugadores} jugadores mirados${r.avisosAparte.length ? `; en Hoy, aparte del plan: ${r.avisosAparte.join(', ')}` : ''}`);
    if (P.errores.length) { mal++; console.log(`MAL  ${escena}: errores de la página: ${P.errores[0]}`); }
  } finally { await P.cerrar(); }
}
await cerrar();
console.log(mal ? `${mal} MAL (${total} jugadores)` : `Todo BIEN (${total} jugadores)`);
process.exit(mal ? 1 : 0);
