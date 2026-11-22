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
    sigue: I.dineroCerradoDe('¿Y cuánto dinero tiene?', D, M, `¿Qué le ficho a ${r2.e.manager}?`).length };
  // (b) las respuestas de verdad
  const cer = I.dineroCerradoDe(q, D, M);
  const casos = [
    `Eso no te lo puedo dar: el saldo de los rivales está cerrado en tu cuenta y solo lo ves tocando tu candado en la app. Por lo que sí sé, ${r2.e.manager} tiene un saldo medio, con margen para algún fichaje, pero no lo bastante para pagar cláusulas caras sin apretarse.`,
    `Eso está cerrado en su cuenta, así que no te puedo dar una cifra de lo que tiene ${r2.e.manager}. Lo que sí sé es que su dinero está en el tramo de «algo», por debajo de los que más saldo manejan en la liga; eso lo ves tocando su candado en la app.`,
    `${r2.e.manager} tiene unos 45 M de saldo, más que tú.`,
    `Ese dato se abre tocando su candado y viendo un anuncio corto. Esta semana ha fichado a dos jugadores.`,
  ];
  const FUGA = /saldo medio|tramo|«algo»|45 M|más que tú|margen para|apretarse|por debajo de los que/;
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
    orden: /PREGUNTA POR EL DINERO/.test(datos2), deOtro: I.dineroCerradoDe(`¿Cuánto dinero tiene ${r3.e.manager}?`, D, M).length, conoce: !!(r2.dinero && r2.dinero.v != null) };
  U.LS.del('top-rivales');
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
ok(r.b.every((x) => !x.fuga && x.candado), `(b) de las respuestas de verdad se quita lo que cuenta su dinero y queda cómo se abre (${r.b.map((x) => x.q).join(', ')} frases quitadas)`);
ok(r.b[3].q === 0, '(b) una respuesta que ya lo hace bien no se toca');
ok(!r.c.fuga && r.c.candado && r.c.resto, `(c) por el chat, con una IA que lo suelta: «${r.c.t}»`);
ok(r.c.otra, '(e) en otra pregunta (el peligro de los rivales), lo que dice la app de quién tiene dinero no se quita');
ok(r.e.mio === 0 && r.e.peligro === 0 && r.e.jug === 0, '(e) su propio saldo, el peligro o el valor de un jugador no son preguntar por el dinero de un rival');
ok(r.d.abierto && (!r.d.conoce || r.d.cifra) && r.d.otro && !r.d.orden && r.d.deOtro === 1, '(d) con un rival abierto, de ese va la cifra y se le puede decir; de los demás, no');
ok(r.f.plegada && r.f.vistas === 5 && r.f.todas === 9 && r.f.rev && r.f.corta && r.f.lista, `(f) una respuesta de 9 frases: ${r.f.vistas} a la vista y el resto en «Seguir leyendo»; lo revisado, siempre a la vista; las cortas y las listas, enteras`);
ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
await P.cerrar();
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
