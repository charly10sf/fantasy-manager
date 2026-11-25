// El dinero de un rival, cerrado (22 nov, Carlos: «si alguien pregunta cuánto dinero tiene X rival y no lo ha desbloqueado
// viendo el anuncio, que no se lo diga, evidentemente»). La cifra ya no le llegaba a la IA, pero a la pregunta directa
// contestaba con la categoría («tiene un saldo medio», «está en el tramo de algo»). Sin red, con la liga de ejemplo (en ella
// el dinero de los rivales está cerrado):
//  (a) a la IA no le llega ninguna cifra del dinero de un rival cerrado, y con la pregunta directa se le dice que no cuente
//      ni la categoría
//  (b) la app quita de la respuesta las frases que lo cuentan (las de verdad de la pasada del 22 nov) y deja cómo se abre
//  (c) por el chat entero, con una IA de mentira que lo suelta: lo que ve el mánager no lo lleva
//  (d) con un rival abierto (ha visto sus anuncios): de ese sí va la cifra y se le puede decir; de los demás, no
//  (e) lo que no es preguntar por el dinero de un rival no se toca: su propio saldo, el peligro de los rivales
//  (f) una respuesta larga se pliega: las 5 primeras frases a la vista y el resto en «Seguir leyendo»
// Uso: PW_MODULO=… node .github/ia/caso-dinero.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

let R2 = '';
const SUELTA = () => `Eso no te lo puedo dar: el saldo de los rivales está cerrado en tu cuenta. Por lo que sí sé, ${R2} tiene un saldo medio, con margen para algún fichaje, pero no lo bastante para pagar cláusulas caras sin apretarse. Esta semana ha hecho dos movimientos.`;
const P = await pagina('martes', (cuerpo) => {
  const t = JSON.stringify(cuerpo);
  if (/PREGUNTA POR EL DINERO/.test(t)) return SUELTA();
  return `El más peligroso es ${R2}: tiene mucho dinero y ya ha clausulado a uno hace poco.`;
});
const r = await P.page.evaluate(async () => {
  const S = window.S, I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), L = await import('./js/limite.js'), U = await import('./js/util.js'), V = await import('./js/vistas.js');
  const { D, M } = S, c = Dt.cfg();
  const rv = (n) => M.rivales.find((x) => x.e.pos === n) || M.rivales[n - 1];
  const r2 = rv(2), r3 = rv(3);
  const out = { r2: r2.e.manager, cerrado: L.bloqueada('dineroRivales', r2.e.teamId) };
  const q = `¿Cuánto dinero tiene ${r2.e.manager}?`;
  // (a)
  const datos = I.datosChat(q, D, M, c, {});
  const lineas = datos.split('\n').filter((l) => /^- \d+º \| /.test(l));
  out.a = { rivales: lineas.length, sinCifra: lineas.every((l) => /dinero: [^|]*sin cifra\)|dinero: no se sabe/.test(l) && !/dinero (≈ )?\d/.test(l)), orden: /PREGUNTA POR EL DINERO DE [^\n]* Y LO TIENE CERRADO/.test(datos),
    de: I.dineroCerradoDe(q, D, M).map((x) => x.nombre).join(), todos: I.dineroCerradoDe('¿Qué rival tiene más dinero?', D, M).length, pasta: I.dineroCerradoDe(`cuanta pasta le queda a ${r2.e.manager.toLowerCase()}`, D, M).length,
    sigue: I.dineroCerradoDe('¿Y cuánto dinero tiene?', D, M, `¿Qué le ficho a ${r2.e.manager}?`).length,
    // (repaso de la 0.8s) de refilón: quién puede pagar una cláusula es preguntar por el dinero de todos
    refilon: I.dineroCerradoDe(`¿Quién me puede pagar la cláusula de ${M.mias[0].j.nombre}?`, D, M).length, nadaMio: I.dineroCerradoDe('¿Cuánto dinero tengo?', D, M).length };
  // (b) las respuestas de verdad
  const cer = I.dineroCerradoDe(q, D, M);
  const casos = [
    `Eso no te lo puedo dar: el saldo de los rivales está cerrado en tu cuenta y solo lo ves tocando tu candado en la app. Por lo que sí sé, ${r2.e.manager} tiene un saldo medio, con margen para algún fichaje, pero no lo bastante para pagar cláusulas caras sin apretarse.`,
    `Eso está cerrado en su cuenta, así que no te puedo dar una cifra de lo que tiene ${r2.e.manager}. Lo que sí sé es que su dinero está en el tramo de «algo», por debajo de los que más saldo manejan en la liga; eso lo ves tocando su candado en la app.`,
    `${r2.e.manager} tiene unos 45 M de saldo, más que tú.`,
    `Ese dato se abre tocando su candado y viendo un anuncio corto. Esta semana ha fichado a dos jugadores.`,
    // (repaso de la 0.8s, batería del 22 nov) sin decir «dinero»: lo que ha gastado y, de ahí, que no le sobra
    `Eso lo tienes cerrado en tu cuenta. Lo que sí te digo: ha gastado 34,61 M esta semana, así que no le sobra tanto como para pujar fuerte por los libres de hoy.`,
    `Ahora mismo nadie: está protegida hasta el viernes. Después tampoco corre peligro, porque está un 54 % por encima de su valor; ningún rival tiene dinero para pagar algo así.`,
  ];
  const FUGA = /saldo medio|tramo|«algo»|45 M|más que tú|margen para|apretarse|por debajo de los que|no le sobra|tiene dinero para/;
  out.b = casos.map((t) => { const x = I.sinDineroCerrado(t, cer); return { fuga: FUGA.test(x.texto), candado: /candado|anuncio/.test(x.texto), q: x.quitadas, t: x.texto }; });
  // (e) lo que no es eso
  out.e = { mio: I.dineroCerradoDe('¿Cuánto saldo tengo?', D, M).length, peligro: I.dineroCerradoDe('¿Qué rival es el más peligroso?', D, M).length, jug: I.dineroCerradoDe(`¿Cuánto vale ${M.mias[0].j.nombre}?`, D, M).length };
  // (c) por el chat
  const x1 = await I.charlar(q, D, M, c, null, null, []);
  const x2 = await I.charlar('¿Qué rival es el más peligroso para mí?', D, M, c, null, null, []);
  out.c = { fuga: FUGA.test(x1.texto), candado: /candado|anuncio/.test(x1.texto), resto: /dos movimientos/.test(x1.texto), t: x1.texto.slice(0, 200), otra: /tiene mucho dinero/.test(x2.texto) };
  // (d) con ese rival abierto (como tras ver sus anuncios)
  U.LS.set('top-rivales', { j: null, usos: 1, abiertos: { [String(r2.e.teamId)]: Date.now() + 5 * 60e3 }, uno: null });
  const datos2 = I.datosChat(q, D, M, c, {});
  const l2 = (n) => datos2.split('\n').find((l) => /^- \d+º \| /.test(l) && l.includes(`| ${n} |`)) || '';
  out.d = { abierto: !L.bloqueada('dineroRivales', r2.e.teamId), cifra: /dinero (≈ )?\d[^|]*ABIERTO/.test(l2(r2.e.manager)), otro: /sin cifra\)|no se sabe/.test(l2(r3.e.manager)) && !/dinero (≈ )?\d/.test(l2(r3.e.manager)),
    orden: /PREGUNTA POR EL DINERO DE [^\n]*CERRADO/.test(datos2), dilo: /QUE LO TIENE ABIERTO \(ha visto sus anuncios\): díselo/.test(datos2), deOtro: I.dineroCerradoDe(`¿Cuánto dinero tiene ${r3.e.manager}?`, D, M).length, conoce: !!(r2.dinero && r2.dinero.v != null) };
  U.LS.del('top-rivales');
  // (g) (25 nov, B13) «¿quién me puede pagar la cláusula de X?» con «quién paga» cerrado: a la IA no le llega a quién le
  // llega (ni «no le llega a ningún rival»), se le dice que lo diga cerrado y la app quita «a ninguno le llega»
  const qp = `¿Quién me puede pagar la cláusula de ${M.mias[0].j.nombre}?`;
  const dqp = I.datosChat(qp, D, M, c, {}), pqp = JSON.stringify(I.pedidoChat(qp, D, M, c, [], [], {}));
  const dp = I.dineroPreguntado(qp, D, M);
  const respQ = [
    `Ahora mismo nadie: a ninguno le llega el saldo para pagarla. Pide un 54 % sobre su valor y en esta liga los clausulazos se pagan a un +22 %.`,
    `Ningún rival puede pagarte esa cláusula. Además, está cerrada hasta que empiece la jornada.`,
  ].map((t) => I.sinDineroCerrado(t, dp.cerrados, { quien: dp.quien }).texto);
  out.g = { cerrado: L.bloqueada('quienPaga'), quien: dp.quien, fuga: /le sobra el dinero para pagarla|le llega justo|no le llega a ningún rival/.test(dqp), orden: /PREGUNTA QUIÉN PUEDE PAGARLE UNA CLÁUSULA/.test(pqp),
    resp: respQ, limpia: respQ.every((t) => /quién paga tus cláusulas lo tienes cerrado/.test(t) && !/a ninguno le llega|Ningún rival puede pagar/.test(t)), queda: /54 %/.test(respQ[0]) };
  // (f) plegar lo largo
  const larga = Array.from({ length: 9 }, (_, i) => `Esta es la frase ${i + 1} de la respuesta.`).join(' ');
  const h = V.respuestaHTML(`${larga}\n\n**Revisado por la app:**\n- Ojo con una cosa.`);
  out.f = { plegada: /<details class="resp-mas">/.test(h), vistas: (h.split('<details')[0].match(/frase \d/g) || []).length, todas: (h.match(/frase \d/g) || []).length, rev: /Revisado por la app/.test(h.split('</details>')[1] || ''),
    corta: !/<details/.test(V.respuestaHTML('Una. Dos. Tres. Cuatro. Cinco. Seis.')), lista: !/<details/.test(V.respuestaHTML(`Tiene estos:\n\n${Array.from({ length: 9 }, (_, i) => `- Jugador ${i}.`).join('\n')}`)) };
  return out;
});
R2 = r.r2;
ok(r.cerrado, 'la escena: el dinero de los rivales está cerrado en la liga de ejemplo');
ok(r.a.rivales >= 5 && r.a.sinCifra, `(a) a la IA no le llega ninguna cifra del dinero de los ${r.a.rivales} rivales`);
ok(r.a.orden && r.a.de === r.r2 && r.a.todos >= 5 && r.a.pasta === 1 && r.a.sigue === 1, `(a) «¿Cuánto dinero tiene ${r.r2}?», «cuánta pasta le queda», «¿y cuánto dinero tiene?» y «¿qué rival tiene más?»: a la IA se le dice que no cuente ni la categoría`);
ok(r.a.refilon === r.a.todos && r.a.refilon > 0 && r.a.nadaMio === 0, `(a) «¿quién me puede pagar la cláusula de X?» cuenta como preguntar por el dinero de todos (${r.a.refilon}); «¿cuánto dinero tengo?», no`);
ok(r.b.every((x) => !x.fuga && x.candado), `(b) de las respuestas de verdad se quita lo que cuenta su dinero y queda cómo se abre (${r.b.map((x) => x.q).join(', ')} frases quitadas)`);
ok(r.b[3].q === 0, '(b) una respuesta que ya lo hace bien no se toca');
ok(!r.c.fuga && r.c.candado && r.c.resto, `(c) por el chat, con una IA que lo suelta: «${r.c.t}»`);
ok(r.c.otra, '(e) en otra pregunta (el peligro de los rivales), lo que dice la app de quién tiene dinero no se quita');
ok(r.e.mio === 0 && r.e.peligro === 0 && r.e.jug === 0, '(e) su propio saldo, el peligro o el valor de un jugador no son preguntar por el dinero de un rival');
ok(r.d.abierto && (!r.d.conoce || r.d.cifra) && r.d.otro && !r.d.orden && r.d.dilo && r.d.deOtro === 1, '(d) con un rival abierto, de ese va la cifra y se le puede decir; de los demás, no');
ok(r.g.cerrado && r.g.quien && !r.g.fuga && r.g.orden, '(g) «¿quién me puede pagar la cláusula de X?» con quién paga cerrado: a la IA no le llega si le llega a alguien y se le dice que lo diga cerrado');
ok(r.g.limpia && r.g.queda, `(g) y de la respuesta se quita «a ninguno le llega» y queda lo de la cláusula sobre su valor: «${(r.g.resp[0] || '').slice(0, 160)}»`);
ok(r.f.plegada && r.f.vistas === 5 && r.f.todas === 9 && r.f.rev && r.f.corta && r.f.lista, `(f) una respuesta de 9 frases: ${r.f.vistas} a la vista y el resto en «Seguir leyendo»; lo revisado, siempre a la vista; las cortas y las listas, enteras`);
ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
await P.cerrar();
// (h) (25 nov) en la web del iPhone no hay app de Google Play: lo cerrado se abre invitando (el dinero) o aún no (quién paga)
{
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const Pi = await pagina('martes', () => 'vale', { ua: UA });
  const h = await Pi.page.evaluate(async () => {
    const I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), C = await import('./js/chat-sistema.js');
    const { D, M } = window.S, c = Dt.cfg();
    const o = I.opcionesChat(), sis = C.sistemaChat(o);
    const r2 = (M.rivales.find((x) => x.e.pos === 2) || M.rivales[1]).e.manager;
    const ped = (q) => JSON.stringify(I.pedidoChat(q, D, M, c, [], [], {}));
    const qp = `¿Quién me puede pagar la cláusula de ${M.mias[0].j.nombre}?`, dp = I.dineroPreguntado(qp, D, M);
    const t1 = I.sinDineroCerrado('Ahora mismo nadie: a ninguno le llega el saldo para pagarla.', dp.cerrados, { quien: dp.quien }).texto;
    const t2 = I.sinDineroCerrado(`${r2} tiene un saldo medio.`, I.dineroCerradoDe(`¿Cuánto dinero tiene ${r2}?`, D, M)).texto;
    return { o, gp: /Google Play/.test(sis), inv: /invitando a un amigo/.test(sis), pDinero: /invitando a un amigo/.test(ped(`¿Cuánto dinero tiene ${r2}?`)) && !/Google Play/.test(ped(`¿Cuánto dinero tiene ${r2}?`)), pQuien: /no se puede abrir/.test(ped(qp)), t1, t2 };
  });
  ok(h.o.iphone && !h.o.anuncio && !h.gp && h.inv, `(h) en la web del iPhone, las instrucciones dicen que lo cerrado se abre invitando, sin Google Play`);
  ok(h.pDinero && h.pQuien && !/Google Play/.test(h.t1 + h.t2) && /invitando/.test(h.t2) && /no se puede abrir/.test(h.t1), `(h) y lo de cada pregunta y lo que repone la app, igual: «${h.t2.slice(0, 120)}» · «${h.t1.slice(0, 120)}»`);
  ok(!Pi.errores.length, 'sin errores en la página del iPhone');
  await Pi.cerrar();
}
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
