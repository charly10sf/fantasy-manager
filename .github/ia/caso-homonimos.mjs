// Dos jugadores con el mismo nombre (19 nov, Carlos: «entra Morcillo y sale Morcillo… que no es tuyo»): la IA nombra a uno
// tuyo y en LaLiga hay otro que se llama igual. El plan tiene que quedarse con el tuyo: ni «entra X y sale X» ni «no es
// tuyo»; y como el once es el que ya tienes puesto, el paso de alinear sobra.
// Uso: PW_MODULO=… node .github/ia/caso-homonimos.mjs   (sale con 1 si algo falla)
import { pagina } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('martes');
try {
  const r = await P.page.evaluate(async () => {
    const U = await import('./js/util.js'), Dt = await import('./js/datos.js'), Ia = await import('./js/ia.js'), Mo = await import('./js/motor.js');
    const S = window.S;
    const once = Mo.analizar(S.D, S.H, S.c, {}).mias.filter((x) => x.j.estado !== 'injured').slice(0, 11);
    const yo = once[1].j;
    // el otro, con el mismo nombre, de otro equipo y sin dueño: con el id más bajo va primero en el maestro (eso hacía fallar)
    const otro = { ...yo, id: '1', equipoId: String(+yo.equipoId + 1), largo: `${yo.nombre} Otro` };
    S.D.maestro = { [otro.id]: otro, ...S.D.maestro };
    S.M = Mo.analizar(S.D, S.H, S.c, {});
    U.LS.set(Dt.K('mi-once'), { t: Date.now(), ids: once.map((x) => String(x.pid)), forma: '' });
    const plan = { titular: 'Plan', alineacion: { formacion: '', titulares: once.map((x) => x.j.nombre) },
      operaciones: [{ accion: 'alinear', jugador: yo.nombre, motivo: 'Tu once.', hoy: true }] };
    const R = Ia.cuadrarPlan(plan, S.D, S.M);
    const al = (R.ops || []).filter((o) => o.accion === 'alinear');
    return { nombre: yo.nombre, avisos: al.map((o) => o.aviso || ''), pids: al.map((o) => String(o.pid)) };
  });
  ok(!r.avisos.some((a) => /no es tuyo/.test(a)), `${r.nombre} repetido: sin «no es tuyo» (${r.avisos.join(' | ') || 'sin avisos'})`);
  ok(!r.avisos.some((a) => /entra .* y sale/.test(a)), `${r.nombre} repetido: sin «entra y sale»`);
  ok(!r.pids.length, `${r.nombre} repetido: el once es el que ya tienes, sin paso de alinear (${r.pids.length})`);
  if (P.errores.length) ok(false, `errores de la página: ${P.errores[0]}`);
} finally { await P.cerrar(); }
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
