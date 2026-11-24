// Vender o quedárselo (20 nov, el chat de Carlos y la queja de Fran: «la IA es pésima con ventas y tendencias»). A la
// pregunta de vender a cuatro de los suyos «si me dan más que su cláusula», la IA dijo «a LaLiga no le sacas más que su
// cláusula» (mezclaba la oferta de LaLiga con la cláusula) y no miró la tendencia ni el precio para un rival. Ahora las
// cuentas las hace M.ventaMia y van al chat con su veredicto (ventasMiasTxt). Sin red, con la liga de ejemplo:
//  (a) uno que sube con la cláusula pegada a su valor, a punto de abrirse y con un rival rico: AGUANTAR Y PROTEGERLO,
//      y sin mandar subir la cláusula si cuesta más de lo que va a subir
//  (b) uno que baja todos los días: VENDER (o AGUANTAR si su decisión es aguantarlo: decide.js), nunca subirle la cláusula
//  (c) en martes, parón y sábado, con todos los suyos: las cifras cuadran (LaLiga entre su mínimo y su máximo, lo del rival
//      de menos a más), cada línea lleva LaLiga, la cláusula y el rival por separado, y nada de NaN ni undefined
//  (d) dice lo mismo que el plan de hoy (si lo vende, VENDER) y que las ofertas (si la app la acepta, ACEPTAR)
//  (e) el bloque sale con la pregunta de Carlos, con «¿a quién vendo?» y siguiendo la conversación, y no con «¿qué tiene
//      X a la venta?»
// Uso: PW_MODULO=… node .github/ia/caso-ventas.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const forzado = async (P) => P.page.evaluate(async () => {
  const S = window.S, Mo = await import('./js/motor.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M;
  const mias = M0.mias.filter((x) => x.j.pos !== 5 && x.clausula).sort((a, b) => a.j.valor - b.j.valor);
  const sube = mias.find((x) => !M0.misVentas.some((v) => v.pid === x.pid) && x.j.valor > 8e6), baja = mias.find((x) => x !== sube && !M0.misVentas.some((v) => v.pid === x.pid) && x.j.valor > 8e6);
  // las series: once días seguidos subiendo un 1,5 % y bajando un 1,2 %
  const serie = (j, r) => { const s = []; for (let k = 11; k >= 1; k--) s.push([new Date(Date.now() - k * 864e5 + 3600e3).toISOString().slice(0, 10), Math.round(j.valor / Math.pow(1 + r, k))]); H.v = H.v || {}; H.v[j.id] = s; };
  serie(sube.j, 0.015); serie(baja.j, -0.012);
  if (S.det) for (const j of [sube.j, baja.j]) if (S.det[j.id]) delete S.det[j.id].valores;
  // la del que sube, a su valor (+2 %) y se abre en 20 h; un rival con 400 M
  for (const f of D.plantillas[yo]) if (f.pid === sube.pid) { f.clausula = Math.round(sube.j.valor * 1.02); f.protegidoHasta = Date.now() + 20 * 36e5; }
  const rico = M0.rivales[0].e.teamId;
  D.dineros = { ...(D.dineros || {}), [rico]: { v: 400e6, fuente: 'LaLiga' } };
  const M = Mo.analizar(D, H, S.c, {});
  const x = (pid) => M.mias.find((y) => y.pid === pid);
  const vs = M.ventaMia(x(sube.pid)), vb = M.ventaMia(x(baja.pid));
  const txt = I.ventasMiasTxt(D, M, [sube.j, baja.j], Dt.cfg());
  const linea = (n) => txt.split('\n').find((l) => l.startsWith(`- ${n} (`)) || '';
  return { sube: { n: sube.j.nombre, ver: vs.veredicto, presa: vs.presa, pronto: vs.pronto, fase: vs.fase, p14: vs.p14, prot: vs.proteger, linea: linea(sube.j.nombre) }, baja: { n: baja.j.nombre, ver: vb.veredicto, fase: vb.fase, linea: linea(baja.j.nombre) } };
});

const todos = async (P) => P.page.evaluate(async () => {
  const S = window.S, I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), Pl = await import('./js/plan.js');
  const { D, M } = S;
  const js = M.mias.filter((x) => x.j.pos !== 5).map((x) => x.j);
  const ys = js.map((j) => M.ventaMia(M.mias.find((x) => x.pid === j.id)));
  const txt = I.ventasMiasTxt(D, M, js, Dt.cfg());
  const R = Pl.planDeHoy(D, M, Dt.cfg());
  const vende = (R.ops || []).filter((o) => !o.descartada && !o.sugerencia && o.accion === 'vender').map((o) => (o.j && o.j.nombre) || o.jugador);
  // lo que aconseja la app con cada oferta (Equipo → en venta) y lo que dice de ella en MIS JUGADORES
  const conOferta = M.misVentas.filter((v) => v.mejor && ['aceptar', 'esperar'].includes(v.consejo)).map((v) => ({ n: v.j.nombre, consejo: v.consejo }));
  const ctx = I.contexto(D, M, Dt.cfg(), { chat: true });
  const enMias = conOferta.map((o) => ({ ...o, linea: (ctx.split('\n').find((l) => l.startsWith('- ') && l.includes(`| ${o.n} |`) && l.includes('EN MI ONCE')) || '') }));
  const datos = (q, hist = []) => I.datosChat(q, D, M, Dt.cfg(), { hist });
  const mio = [...M.mias].filter((x) => x.j.pos !== 5).sort((a, b) => b.j.valor - a.j.valor).slice(0, 4).map((x) => x.j.nombre);
  const rival = M.rivales[0].e.manager || M.rivales[0].e.nombre;
  const carlos = `¿Me renta vender a ${mio.join(', ')} si me dan más que su cláusula, o me los quedo y sigo especulando? Si vendo, ¿a LaLiga o a un rival, y por cuánto?`;
  const tiene = (t) => t.includes('VENDER O QUEDÁRTELO');
  return {
    ys: ys.map((y) => ({ n: y.j.nombre, liga: y.liga, rival: y.rival, clausula: y.clausula })),
    txt, vende, conOferta, enMias,
    det: {
      carlos: tiene(datos(carlos)),
      general: tiene(datos('¿A quién vendo y por cuánto?')),
      sigue: tiene(datos('Sigues sin entenderlo. Revisa los precios.', [{ r: 'yo', t: carlos }, { r: 'ia', t: 'vale' }, { r: 'yo', t: 'Sigues sin entenderlo. Revisa los precios.' }])),
      rival: tiene(datos(`¿Qué tiene ${rival} a la venta?`)),
      clausular: tiene(datos(`¿Puedo clausular a alguien de ${rival}?`)),
    },
  };
});

{
  const P = await pagina('martes');
  const r = await forzado(P);
  ok(r.sube.ver === 'proteger' && /LA DECISIÓN DE LA APP: AGUANTAR Y PROTEGERLO/.test(r.sube.linea), `(a) ${r.sube.n}, que sube con la cláusula a su valor a punto de abrirse: quedárselo y protegerlo (${r.sube.ver}, fase ${r.sube.fase})`);
  ok(!/Súbele la cláusula/.test(r.sube.linea) || (r.sube.prot && r.sube.prot.como === 'subir' && r.sube.prot.coste <= Math.max(0, r.sube.p14) / 2), `(a) no manda pagar por subirle la cláusula más de lo que va a subir (${r.sube.prot && r.sube.prot.como})`);
  ok(/se lo llevan a precio de mercado|se llevan a precio de mercado/.test(r.sube.linea), '(a) dice que, si se lo clausulan, se llevan lo que iba a subir');
  ok(r.baja.ver === 'vender' && /LA DECISIÓN DE LA APP: (VENDER|AGUANTAR)/.test(r.baja.linea), `(b) ${r.baja.n}, que baja todos los días: vender o, si el plan lo aguanta, aguantarlo por ahora (${r.baja.ver}, fase ${r.baja.fase})`);
  ok(!/Súbele la cláusula|Blíndalo/.test(r.baja.linea), '(b) a uno que baja no se le sube la cláusula ni se blinda');
  ok(!(/LA DECISIÓN DE LA APP: VENDER/.test(r.baja.linea) && /se aguanta/.test(r.baja.linea)), '(b) no dice a la vez vender y que el plan lo aguanta');
  await P.cerrar();
}
for (const escena of ['martes', 'paron', 'sabado']) {
  const P = await pagina(escena);
  const r = await todos(P);
  const malas = r.ys.filter((y) => !(y.liga.min <= y.liga.v && y.liga.v <= y.liga.max && y.rival.piso <= y.rival.techo && y.rival.piso > 0));
  ok(!malas.length, `(c) ${escena}: LaLiga entre su mínimo y su máximo y lo del rival de menos a más (${r.ys.length} jugadores)${malas.length ? `: ${malas.map((y) => y.n).join(', ')}` : ''}`);
  const lineas = r.txt.split('\n').filter((l) => l.startsWith('- '));
  ok(lineas.length === r.ys.length && lineas.every((l) => /\| LALIGA: /.test(l) && /\| CLÁUSULA /.test(l) && /\| A UN RIVAL /.test(l) && /TENDENCIA: /.test(l)), `(c) ${escena}: cada uno con su tendencia, LaLiga, la cláusula y el rival por separado`);
  ok(!/NaN|undefined|null M|\bInfinity/.test(r.txt), `(c) ${escena}: sin NaN, undefined ni null`);
  const linea = (n) => lineas.find((l) => l.startsWith(`- ${n} (`)) || '';
  const noVende = r.vende.filter((n) => linea(n) && !/LA DECISIÓN DE LA APP: VENDER/.test(linea(n)));
  ok(!noVende.length, `(d) ${escena}: lo que vende el plan de hoy sale como VENDER (${r.vende.join(', ') || 'no vende a nadie'})`);
  const malOf = r.conOferta.filter((o) => (o.consejo === 'aceptar' ? !/LA DECISIÓN DE LA APP: VENDER: ACEPTAR LA OFERTA/.test(linea(o.n)) : !/LA DECISIÓN DE LA APP: (AGUANTAR[^:]*: NO ACEPTAR LA OFERTA|AGUANTAR Y PROTEGERLO \(NO ACEPTAR LA OFERTA|VENDER, PERO ESTA OFERTA NO|NO SE VENDE)/.test(linea(o.n))));
  ok(!malOf.length, `(d) ${escena}: con una oferta, lo mismo que aconseja la app en Equipo (${r.conOferta.map((o) => `${o.n} ${o.consejo}`).join(', ') || 'ninguna'})`);
  const malMias = r.enMias.filter((o) => !o.linea.includes(`CON LA OFERTA QUE TIENE: ${o.consejo.toUpperCase()}`) || /aceptaría hoy la oferta/.test(o.linea));
  ok(!malMias.length, `(d) ${escena}: en MIS JUGADORES, la oferta con el mismo consejo y sin «aceptaría» suelto${malMias.length ? `: ${malMias.map((o) => o.n).join(', ')}` : ''}`);
  ok(r.det.carlos && r.det.general && r.det.sigue && !r.det.rival && !r.det.clausular, `(e) ${escena}: sale con la pregunta de Carlos, «¿a quién vendo?» y siguiendo la conversación, y no con la venta de un rival ni con clausular (${JSON.stringify(r.det)})`);
  await P.cerrar();
}
await cerrar();
if (mal) { console.log(`\n${mal} mal`); process.exit(1); }
console.log('\nTodo bien');
