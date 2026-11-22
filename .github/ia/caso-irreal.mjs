// El precio irreal que un rival pone en el mercado (22 nov, Fran: «si pones en el mercado un jugador por 200 kilos y le
// preguntas por cuánto deberías comprárselo, te dice que al menos 200 kilos, aunque valga un millón; no entiende que a
// veces pones precios irreales»). A la IA le llegaba «OFERTA MÍNIMA CON OPCIONES 200 M; la app ofrecería 200 M». Sin red:
//  (a) el motor lo marca como irreal y saca aparte lo que vale la pena pagar; uno a un precio normal no cambia
//  (b) lo que lee la IA: «PRECIO IRREAL», lo que vale la pena pagar y nunca «oferta mínima 200 M»
//  (c) si aun así la IA dice «ofrécele al menos 200 M», la app lo corrige debajo; si dice que es irreal, no añade nada
//  (d) ni el plan ni Hoy proponen comprarlo
//  (e) la oferta que le cuentan (Domy, 22 nov, por audio: «le digo lo que me ofrecen y dice que no lo ve en la aplicación»):
//      a la IA se le dice que es un hecho y, si contesta que no la ve, esa frase se quita
// Uso: PW_MODULO=… node .github/ia/caso-irreal.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
let turno = 0;
const P = await pagina('martes', () => (turno++ === 0 ? 'Para que te lo venda tienes que ofrecerle al menos 200,00 M, que es lo que pide.' : 'Ese precio es irreal: a 200 M no se compra. Lo que vale la pena pagar por él ronda los 3 M.'));
const r = await P.page.evaluate(async () => {
  const S = window.S, Mo = await import('./js/motor.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), Pm = await import('./js/plan.js'), U = await import('./js/util.js');
  const D = S.D, yo = D.yo.teamId, c = Dt.cfg();
  const riv = D.clasif.find((e) => e.teamId !== yo);
  const js = D.plantillas[riv.teamId].map((x) => D.maestro[x.pid]).filter((j) => j.pos !== 5).sort((a, b) => a.valor - b.valor);
  const barato = js[0], normal = js[1];
  D.mercado = D.mercado.filter((m) => m.pid !== barato.id && m.pid !== normal.id);
  const cierra = D.mercado[0].cierra;
  D.mercado.push({ id: 'irreal', pid: barato.id, tipo: 'manager', precio: 200e6, cierra, pujas: 0, ofertas: 0, vendedorTeamId: riv.teamId, vendedor: riv.manager, miPuja: null, clausula: null });
  D.mercado.push({ id: 'normal', pid: normal.id, tipo: 'manager', precio: Math.round(normal.valor * 1.08), cierra, pujas: 0, ofertas: 0, vendedorTeamId: riv.teamId, vendedor: riv.manager, miPuja: null, clausula: null });
  const M = Mo.analizar(D, S.H, S.c, {});
  S.M = M;
  const mi = M.mercado.find((x) => x.pid === barato.id), mn = M.mercado.find((x) => x.pid === normal.id);
  const q = `¿Por cuánto debería comprarle a ${barato.nombre} a ${riv.manager}?`;
  const datos = I.datosChat(q, D, M, c, {});
  const linea = datos.split('\n').find((l) => l.includes(`COMPRAR ${barato.nombre} a `)) || '';
  const lineaN = I.datosChat(`¿Por cuánto le compro a ${normal.nombre}?`, D, M, c, {}).split('\n').find((l) => l.includes(`COMPRAR ${normal.nombre} a `)) || '';
  const x1 = await I.charlar(q, D, M, c, null, null, []);
  U.LS.set(Dt.K('chat'), []);
  const x2 = await I.charlar(q, D, M, c, null, null, []);
  const R = Pm.planDeHoy(D, M, c);
  // (e) la oferta contada
  const mio = M.mias.filter((x) => x.j.pos !== 5)[2].j;
  const qo = `Me ofrecen 30 kilos por ${mio.nombre}, ten en cuenta los puntos de esta jornada. ¿Acepto?`;
  const noVe = `No veo esa oferta en los datos de la app, así que no te la puedo confirmar. ${mio.nombre} vale ${U.eur(mio.valor)} y sube; con 30 M te pagan de más y yo aceptaría si no lo necesitas en el once.`;
  const oferta = { cuenta: [qo, 'Fran me ha dicho por WhatsApp que me da 20 M por Rodri', 'LaLiga me da 12 M por él, ¿lo vendo?', 'tengo una oferta de 9 M'].map((q) => I.cuentaOferta(q)).join(), noCuenta: ['¿Qué me ofrecen por Rodri?', '¿Cuánto me dan por él?', '¿Vendo a Rodri?', 'Voy a ofrecer 10 M por Pepe'].map((q) => I.cuentaOferta(q)).join(),
    orden: /TE CUENTA UNA OFERTA O UN TRATO QUE LE HAN HECHO: es un HECHO/.test(I.datosChat(qo, D, M, c, {})), sinOrden: !/TE CUENTA UNA OFERTA/.test(I.datosChat('¿Vendo a Rodri?', D, M, c, {})),
    limpia: I.sinNoLaVeo(noVe), intacta: I.sinNoLaVeo('Acéptala: te pagan 4 M más de lo que vale.').quitadas, sola: I.sinNoLaVeo('No veo esa oferta en la app.').quitadas };
  return { oferta, j: barato.nombre, valor: barato.valor, irreal: mi.irreal, real: mi.ofertaReal, normalIrreal: mn.irreal, linea: linea.slice(0, 700), lineaN: /OFERTA MÍNIMA CON OPCIONES/.test(lineaN) && !/PRECIO IRREAL/.test(lineaN),
    t1: x1.texto, t2: x2.texto, plan: R.ops.some((o) => !o.descartada && o.pid === barato.id), hoy: (M.acciones || []).some((a) => a.pid === barato.id && /compr|fich/i.test(`${a.tipo} ${a.titulo}`)) };
});
ok(r.irreal === true && r.real > r.valor && r.real < r.valor * 1.4 && r.normalIrreal === false, `(a) ${r.j} (vale ${Math.round(r.valor / 1e4) / 100} M) a 200 M: irreal, y lo que vale la pena pagar son ~${Math.round(r.real / 1e4) / 100} M; uno a un +8 % no lo es`);
ok(/PRECIO IRREAL/.test(r.linea) && /NO ES LO QUE HAY QUE PAGAR/.test(r.linea) && !/OFERTA MÍNIMA CON OPCIONES 200|la app ofrecería 200/.test(r.linea), '(b) la IA lee «PRECIO IRREAL» y lo que vale la pena pagar, no «oferta mínima 200 M»');
ok(r.lineaN, '(b) el de precio normal se le cuenta como siempre');
ok(/Revisado por la app/.test(r.t1) && /no son un precio de verdad/.test(r.t1), '(c) si la IA dice «ofrécele al menos 200 M», la app lo corrige debajo');
ok(!/no son un precio de verdad/.test(r.t2), '(c) si ya dice que es irreal, la app no añade nada');
ok(!r.plan && !r.hoy, '(d) ni el plan ni Hoy proponen comprarlo');
ok(r.oferta.cuenta === 'true,true,true,true' && r.oferta.noCuenta === 'false,false,false,false' && r.oferta.orden && r.oferta.sinOrden, '(e) «me ofrecen…», «me ha dicho que me da…», «LaLiga me da…»: a la IA se le dice que es un hecho; una pregunta no lo es');
ok(r.oferta.limpia.quitadas === 1 && !/No veo esa oferta/.test(r.oferta.limpia.texto) && /yo aceptaría/.test(r.oferta.limpia.texto) && r.oferta.intacta === 0 && r.oferta.sola === 0, '(e) si contesta «no veo esa oferta en la app», esa frase se quita y el resto se queda (y nunca se deja la respuesta vacía)');
ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
await P.cerrar();
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
