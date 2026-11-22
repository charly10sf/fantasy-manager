// (22 nov, Carlos: «lo que ponga un mánager de precio de venta, que no se tenga en cuenta para nada») Desde entonces el precio
// que pide no cuenta en ningún sitio: se le oferta desde el valor. Lo de abajo es como empezó.
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
const P = await pagina('martes', () => (turno++ === 0 ? 'Para que te lo venda tienes que ofrecerle al menos 200,00 M, que es lo que pide.' : 'Lo que pide no cuenta: ofrécele algo por encima de su valor, que es lo que le daría LaLiga.'));
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
    limpia: I.sinNoLaVeo(noVe), intacta: I.sinNoLaVeo('Acéptala: te pagan 4 M más de lo que vale.').quitadas, sola: I.sinNoLaVeo('No veo esa oferta en la app.').quitadas,
    // (repaso de la 0.8s) «LaLiga me da 12 M por X»: los datos dicen que ya la tiene, y «llega mañana» se quita
    ql: `LaLiga me da 12 M por ${mio.nombre}, ¿lo vendo o aguanto?`,
    yaL: I.laligaYaDa(`LaLiga me da 12 M por ${mio.nombre}, ¿lo vendo o aguanto?`) && !I.laligaYaDa(`¿Qué me da LaLiga por ${mio.nombre}?`) && !I.laligaYaDa(`Fran me da 20 M por ${mio.nombre}`),
    datosL: I.datosChat(`LaLiga me da 12 M por ${mio.nombre}, ¿lo vendo o aguanto?`, D, M, c, {}),
    manana: I.sinLlegaManana(`Aguántalo por ahora. Los 12 M que te ofrece LaLiga aún no son dinero: su oferta real llega en el cambio de mercado de mañana. Si no la coges, mañana te hará otra parecida.`) };
  // (22 nov, Carlos) la ficha y la lista del mercado: ni rastro de los 200 M
  window.__fmRehacer();
  await new Promise((r) => setTimeout(r, 400));
  const b = document.createElement('button'); b.dataset.j = barato.id; document.body.appendChild(b); b.click();
  await new Promise((r) => setTimeout(r, 600));
  const hoja = (document.querySelector('.hoja') || document.body).innerText;
  b.remove();
  const opB = R.ops.filter((o) => !o.descartada && o.pid === barato.id);
  const txt = JSON.stringify([R.ops.filter((o) => o.pid === barato.id), (M.acciones || []).filter((a) => a.pid === barato.id), M.mercado.filter((x) => x.pid === barato.id).map((x) => ({ ...x, pide: 0, j: 0 }))]);
  return { oferta, j: barato.nombre, valor: barato.valor, precio: mi.precio, puja: mi.puja, min: mi.ofertaMin, pide: mi.pide, sobre: mi.sobre, nPrecio: mn.precio, nValor: normal.valor, nPuja: mn.puja, linea: linea.slice(0, 900), lineaN: lineaN.slice(0, 900),
    t1: x1.texto, t2: x2.texto, caro: opB.some((o) => o.importe > barato.valor * 1.4), txt200: /200[.,]00 M|200000000/.test(txt), hoja: hoja.slice(0, 1500) };
});
const m2 = (x) => `${Math.round(x / 1e4) / 100} M`;
ok(r.precio === r.valor && r.pide === 200e6 && r.min >= r.valor && r.puja >= r.valor && r.puja < r.valor * 1.4 && r.sobre < 0.4, `(a) ${r.j} (vale ${m2(r.valor)}) puesto a 200 M: lo que pide no cuenta; se le oferta desde su valor y la app ofrecería ${m2(r.puja)}`);
ok(r.nPrecio === r.nValor && r.nPuja >= r.nValor && r.nPuja < r.nValor * 1.4, `(a) el que estaba a un +8 %, igual: desde su valor (${m2(r.nValor)}), la app ofrecería ${m2(r.nPuja)}`);
ok(/NO CUENTA PARA NADA/.test(r.linea) && /OFERTA MÍNIMA CON OPCIONES/.test(r.linea) && !/200[.,]00 M|200 M/.test(r.linea), '(b) a la IA no le llega lo que pide: lee que no cuenta, su valor y la oferta con opciones');
ok(/NO CUENTA PARA NADA/.test(r.lineaN) && /OFERTA MÍNIMA CON OPCIONES/.test(r.lineaN), '(b) y con el otro, lo mismo');
ok(/Revisado por la app/.test(r.t1) && /en el mercado no cuenta/.test(r.t1), '(c) si la IA dice «ofrécele al menos 200 M», la app lo corrige debajo');
ok(!/en el mercado no cuenta/.test(r.t2), '(c) si contesta bien, la app no añade nada');
ok(!r.caro && !r.txt200, '(d) ni el plan, ni Hoy, ni la lista del mercado llevan los 200 M en ningún sitio');
ok(/Lo vende/.test(r.hoja) && !/200[.,]00\s?M|Pide/.test(r.hoja) && /ofrécele|desde su valor|no te lo venda/.test(r.hoja), `(d) su ficha: «Lo vende…», sin lo que pide${/Lo vende/.test(r.hoja) ? '' : ` — ${r.hoja.slice(0, 200).replace(/\n/g, ' ')}`}`);
ok(r.oferta.cuenta === 'true,true,true,true' && r.oferta.noCuenta === 'false,false,false,false' && r.oferta.orden && r.oferta.sinOrden, '(e) «me ofrecen…», «me ha dicho que me da…», «LaLiga me da…»: a la IA se le dice que es un hecho; una pregunta no lo es');
ok(r.oferta.limpia.quitadas === 1 && !/No veo esa oferta/.test(r.oferta.limpia.texto) && /yo aceptaría/.test(r.oferta.limpia.texto) && r.oferta.intacta === 0 && r.oferta.sola === 0, '(e) si contesta «no veo esa oferta en la app», esa frase se quita y el resto se queda (y nunca se deja la respuesta vacía)');
ok(r.oferta.yaL && /ÉL DICE QUE YA LE OFRECE LA CIFRA DE SU MENSAJE/.test(r.oferta.datosL) && !/su oferta llega en el siguiente cambio/.test(r.oferta.datosL.split('ÉL DICE QUE YA LE OFRECE')[1] ? r.oferta.datosL.slice(r.oferta.datosL.indexOf('ÉL DICE'), r.oferta.datosL.indexOf('ÉL DICE') + 300) : 'su oferta llega en el siguiente cambio'), '(f) «LaLiga me da 12 M por X»: los datos le dicen a la IA que la oferta ya está hecha, no que llega mañana');
ok(r.oferta.manana.quitadas === 1 && /Si no la coges, mañana te hará otra/.test(r.oferta.manana.texto) && !/llega en el cambio/.test(r.oferta.manana.texto), `(f) si contesta que la oferta de LaLiga llega mañana, esa frase se quita y «mañana te hará otra» se queda: ${r.oferta.manana.texto}`);
ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
await P.cerrar();
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
