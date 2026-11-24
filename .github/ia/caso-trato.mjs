// La calculadora de tratos entre managers (19 nov, el trueque de Carlos con Domy), sin red: la app saca el trato de la
// pregunta, lo calcula (M.trato) y se lo pasa a la IA hecho («LA APP, EL TRATO»). Escena «trato-domy»: 58,10 M de saldo,
// Fornals (58,95 M) mío, Huijsen (57,42 M) del 2º con la cláusula abriéndose a las 20:00, y Huijsen por 60 M.
// Uso: PW_MODULO=… node .github/ia/caso-trato.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';
let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('trato-domy');
const r = await P.page.evaluate(async () => {
  const I = await import('./js/ia.js'), Dt = await import('./js/datos.js');
  const { D, M } = window.S;
  const riv = M.rivales.find((x) => x.e.pos === 2);
  const R = riv.e.manager;
  const q1 = `${R} me propone que él me compra a Fornals a su valor y yo, con ese dinero, le compro a Huijsen por 60 M. ¿Me conviene?`;
  const q2 = `Le pago 60 M por Huijsen y ${R} me compra a Fornals por lo que vale. ¿Lo hago?`;
  const q3 = 'Me ha dicho que si no hay trato le sube la cláusula o lo blinda antes de las 20:00.';
  const q4 = `${R} me ofrece cambiarme Fornals por Huijsen, uno por otro.`;
  const q5 = `${R} me compra a Fornals a su valor y yo le compro a Huijsen por 75 M, ¿vale?`;
  const sp1 = I.tratoEn(q1, D, M), sp2 = I.tratoEn(q2, D, M), sp4 = I.tratoEn(q4, D, M), sp5 = I.tratoEn(q5, D, M);
  const T1 = I.tratoDeChat(q1, D, M, []);
  const T3 = I.tratoDeChat(q3, D, M, [q1]);
  const T5 = I.tratoDeChat(q5, D, M, []);
  const hist = [{ r: 'yo', t: q1 }, { r: 'ia', t: 'Sí.' }, { r: 'yo', t: q3 }];
  const d1 = I.datosChat(q1, D, M, Dt.cfg(), { hist: [{ r: 'yo', t: q1 }] });
  const d3 = I.datosChat(q3, D, M, Dt.cfg(), { hist });
  const dNo = I.datosChat('¿Qué hago hoy?', D, M, Dt.cfg(), { hist: [{ r: 'yo', t: '¿Qué hago hoy?' }] });
  const C = await import('./js/chat-sistema.js');
  // una respuesta buena, con las cifras del trato, no la toca la revisión de la app
  const buena = 'Sí, si lo quieres para el once. Primero te compra él a Fornals por 58,95 M y te entra al momento: tienes 117,05 M, le pagas 60 M por Huijsen y acabas con 57,05 M. Pagas 2,58 M sobre su valor, por debajo de los ~63,07 M que es lo normal entre managers, y Huijsen llega con 14 días de cláusula cerrada.';
  let rev = null; try { rev = I.revisarChat(buena, q1, D, M, { rec: [], hist: [{ r: 'yo', t: q1 }] }); } catch (e) { rev = { notas: [String(e)] }; }
  // (21 nov) ofrecerle a un rival por uno suyo que sube menos de lo que pediría: la revisión lo corrige; lo que pediría, no
  const sube = Object.values(D.maestro).find((j) => M.dueno[j.id] && M.dueno[j.id] !== D.yo.teamId && j.pos !== 5 && (M.ofertaDuenoDe(j) || {}).sube);
  let bajo = null, justo = null;
  if (sube) {
    const od = M.ofertaDuenoDe(sube), q = `¿Cuánto le ofrezco a su dueño por ${sube.nombre}?`, m = (x) => `${String(Math.round(x / 1e4) / 100).replace('.', ',')} M`;
    bajo = { j: sube.nombre, od: od.v, notas: I.revisarChat(`Ofrécele ${m(od.v * 0.85)} por ${sube.nombre} y a ver si cuela.`, q, D, M, { rec: [], hist: [{ r: 'yo', t: q }] }).notas };
    justo = { notas: I.revisarChat(`Ofrécele ${m(od.v * 1.02)} por ${sube.nombre}: es lo que pediría su dueño.`, q, D, M, { rec: [], hist: [{ r: 'yo', t: q }] }).notas };
  }
  const lim = (T) => T && { orden: T.orden, saldoFin: T.saldoFin, dValor: T.dValor, normal: T.normal, barato: T.barato, veredicto: T.veredicto, si: T.si, via: T.via && { fuera: T.via.fuera, vale: T.via.vale, meLlega: T.via.meLlega } };
  return { sp1, sp2, sp4, sp5, T1: lim(T1), T3: lim(T3), T5: lim(T5), bloque1: (d1.match(/\nLA APP, EL TRATO[^]*?VEREDICTO DE LA APP[^\n]*/) || [''])[0], bloque3: (d3.match(/\nLA APP, EL TRATO[^]*?VEREDICTO DE LA APP[^\n]*/) || [''])[0],
    cambioValores: /CAMBIO DE FORNALS POR HUIJSEN/.test(d1), sinTrato: !/LA APP, EL TRATO/.test(dNo), sis: C.sistemaChat({}).length, rev: rev.notas, bajo, justo };
});
await P.cerrar(); await cerrar();
const M_ = (x) => Math.round(x / 1e4) / 100;
console.log(r.bloque1, '\n', r.bloque3.split('\n').filter((l) => /otra vía|VEREDICTO/.test(l)).join('\n'));
ok(r.sp1 && r.sp1.mios[0].precio === 58950000 && r.sp1.suyos[0].precio === 60000000, `precios de la pregunta: Fornals ${r.sp1 && M_(r.sp1.mios[0].precio)} M, Huijsen ${r.sp1 && M_(r.sp1.suyos[0].precio)} M`);
ok(r.sp2 && r.sp2.mios[0].precio === 58950000 && r.sp2.suyos[0].precio === 60000000, 'también con la cifra delante («le pago 60 M por Huijsen») y «por lo que vale»');
ok(r.sp4 && r.sp4.igual && r.sp4.mios[0].precio === r.sp4.suyos[0].precio, 'uno por otro: los dos al mismo precio');
ok(r.T1 && r.T1.orden === 'el' && Math.abs(r.T1.saldoFin - 57050000) < 1, `orden: primero me compra él y acabo con ${r.T1 && M_(r.T1.saldoFin)} M (57,05)`);
ok(r.T1 && Math.abs(r.T1.dValor + 2580000) < 1, `mi valor baja ${r.T1 && M_(-r.T1.dValor)} M (lo de más sobre su valor)`);
ok(r.T1 && r.T1.barato && r.T1.normal > 60e6, `60 M por debajo de lo normal entre managers (~${r.T1 && M_(r.T1.normal)} M): buen precio`);
ok(r.T1 && r.T1.via && !r.T1.via.fuera, 'sin decir nada, su cláusula de las 20:00 cuenta como otra vía');
ok(r.T3 && r.T3.via && r.T3.via.fuera && !/CONVIENE SI no te da tiempo/.test(`${r.T3.veredicto} ${r.T3.si}`), `si dice que la blinda, la cláusula fuera (${r.T3 && `${r.T3.veredicto} ${r.T3.si}`})`);
ok(r.T5 && !r.T5.barato && r.T5.veredicto !== 'CONVIENE', `a 75 M, caro (${r.T5 && r.T5.veredicto})`);
ok(/LA APP, EL TRATO/.test(r.bloque1) && /AL MOMENTO/.test(r.bloque1) && /57,05 M/.test(r.bloque1) && /VEREDICTO DE LA APP: (CONVIENE|NO)/.test(r.bloque1), 'el bloque del trato va en los datos del chat, con el dinero al momento y el saldo final');
ok(/NO CUENTA/.test(r.bloque3), 'en el mensaje siguiente («si no, la blinda») sigue el trato y la cláusula no cuenta');
ok(!r.cambioValores, 'sin las cuentas «a sus valores» del mismo cambio');
ok(r.sinTrato, 'sin trato en la pregunta, no va el bloque');
ok(r.sis < 16500, `las instrucciones del chat siguen por debajo de 16.500 caracteres (${r.sis})`);
ok(!r.rev.length, `la revisión de la app no corrige una respuesta buena del trato${r.rev.length ? `: ${JSON.stringify(r.rev)}` : ''}`);
ok(r.bajo && r.bajo.notas.some((n) => /sube: por menos de unos/.test(n)), `ofrecer por ${r.bajo && r.bajo.j}, que sube, un 15 % menos de lo que pediría su dueño (${r.bajo && M_(r.bajo.od)} M): la revisión lo dice${r.bajo ? ` (${JSON.stringify(r.bajo.notas)})` : ' (no hay ninguno que suba)'}`);
ok(r.justo && !r.justo.notas.some((n) => /sube: por menos de unos/.test(n)), 'y ofreciendo lo que pediría, no');
// (24 nov, Carlos con Bernardo Silva: «le compro a Fran a Bernardo Silva por precio mercado para revenderlo» y la IA: «el dueño
// no vende a su valor, la oferta que tienes que hacer es de 33,58 M») una compra a otro mánager a un precio que él cuenta es
// un hecho, y las cuentas de revenderlo las hace la app
{
  const P2 = await pagina('holgado');
  const c2 = await P2.page.evaluate(async () => {
    const I = await import('./js/ia.js'), Dt = await import('./js/datos.js');
    const { D, M } = window.S, c = Dt.cfg();
    const x = M.clausulas.filter((y) => y.j.valor > 20e6 && y.j.valor < 45e6).sort((a, b) => a.j.valor - b.j.valor)[0];
    const riv = x.rival.manager || x.rival.nombre, n = x.j.nombre;
    const q1 = `le compro a ${riv} a ${n} por precio mercado para revenderlo y sacar el 10%?`;
    const q2 = 'pero si lo compro por precio de mercado y la liga me ofrece cerca del +10% posible, estaria ganando dinero';
    const hist = [{ r: 'yo', t: q1 }, { r: 'ia', t: 'No.' }, { r: 'yo', t: q2 }];
    const C1 = I.compraContada(q1, D, M);
    const bloque = (t) => (t.match(/LA APP, LA COMPRA QUE CUENTA[^\n]*/) || [''])[0];
    const rev = I.revisarChat('Con eso no compras: el dueño no vende a su valor, y la oferta que tienes que hacer es mayor.', q2, D, M, { hist });
    return { n, valor: x.j.valor, C1, b1: bloque(I.datosChat(q1, D, M, c, {})), b2: bloque(I.datosChat(q2, D, M, c, { hist })), rev: rev.notas || [],
      sin: I.compraContada(`¿Cuánto vale ${n}?`, D, M), conMio: I.compraContada(`le compro a ${riv} a ${n} a su valor y él me compra a ${M.mias[0].j.nombre}`, D, M),
      pobre: (I.compraTxt({ ...D, dinero: 1e6 }, M, C1).match(/LA DECISIÓN DE LA APP: [^.]*/) || [''])[0], ol: M.ofertaLiga };
  });
  ok(c2.C1 && c2.C1.precio === c2.valor, `«por precio mercado» es su valor (${c2.n}: ${M_(c2.valor)} M)`);
  ok(/ES UN HECHO/.test(c2.b1) && /NO le digas que el dueño no vende/.test(c2.b1) && /LA DECISIÓN DE LA APP: SÍ, PARA REVENDERLO/.test(c2.b1), `a su valor y con saldo de sobra, la app dice que sí para revenderlo: «${(c2.b1.match(/LA DECISIÓN DE LA APP: [^.]*/) || [''])[0]}»`);
  ok(/LA APP, LA COMPRA QUE CUENTA/.test(c2.b2), 'en el mensaje siguiente, sin nombrarlo, sigue siendo la misma compra');
  ok(c2.rev.some((t) => /ese es el precio/.test(t) && /para revenderlo/.test(t)), `si la IA contesta que el dueño no vende a ese precio, la revisión lo corrige: ${JSON.stringify(c2.rev).slice(0, 200)}`);
  ok(c2.sin === null && c2.conMio === null, 'una pregunta que no es una compra no lo activa, y con uno mío en el mensaje es un trato');
  ok(/NO LE LLEGA/.test(c2.pobre), `sin saldo, no (a otro mánager no se le paga con deuda): «${c2.pobre}»`);
  await P2.cerrar(); await cerrar();
}
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
