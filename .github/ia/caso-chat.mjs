// El chat con la IA de la app (16 nov), sin red: lo que monta la app para el Worker (/pregunta) con la liga de ejemplo, y
// que el Worker lo acepta. Comprueba lo que falló en las capturas de Carlos del 16 nov: la plantilla entera del rival del
// que pregunta, el bloque de notas a la vista y los códigos de operación en el texto.
// Uso: PW_MODULO=… node .github/ia/caso-chat.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';
const W = await import('../../worker/src/index.js');
const CS = await import('../../web/js/chat-sistema.js');
let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('martes');
const r = await P.page.evaluate(async () => {
  const I = await import('./js/ia.js'), Dt = await import('./js/datos.js');
  const { D, M } = window.S;
  const riv = M.rivales.find((x) => x.e.pos === 2) || M.rivales[0];
  const q = `¿Qué le puedo fichar a ${riv.e.manager}? De toda su plantilla, no solo lo que tiene a la venta`;
  const hist = [
    { r: 'yo', t: `¿Qué tiene ${riv.e.manager} a la venta?` },
    { r: 'ia', t: 'Solo a uno.\n\nnotas\n{"recomiendo": [], "apuntar": [], "olvidar": []}' },
    { r: 'yo', t: '', fotos: [{ id: 'f1' }] },
    { r: 'ia', t: 'Es su mercado.\n\n**Revisado por la app:**\n- algo' },
    { r: 'yo', t: q },
  ];
  const cuerpo = I.pedidoChat(q, D, M, Dt.cfg(), hist, [], { rid: 'pruebachat01' });
  const nombres = [...M.rivales.map((x) => x.e.nombre), ...M.rivales.map((x) => `(${x.e.manager}, `)].filter((n) => n && n.length > 3);
  const n = I.aplicarNotas('Ofrécele 140,33 M (Operación M-3143) o espera a su cláusula [C-3143].\n\nnotas\n\n{"recomiendo": [], "apuntar": [{"texto": "Le interesa Diomande", "tipo": "otro"}], "olvidar": []}', D, '¿qué hago con Diomande?');
  const gem = I.montarChat(q, D, M, Dt.cfg(), { hist });
  return { cuerpo, nombres, notaTexto: n.texto, gem: gem.slice(0, 600), gemTodo: gem.includes('PLANTILLAS DE LOS RIVALES') && gem.includes('NUNCA le pidas que te pase datos'), equipo: riv.e.nombre };
});
await P.cerrar();
const c = r.cuerpo;
ok(CS.esDatosChat(c.datos), `los datos empiezan por la cabecera y caben (${c.datos.length} caracteres, ~${Math.round(c.datos.length / 3.3 / 1000)} mil tokens)`);
ok(/PLANTILLAS DE LOS RIVALES/.test(c.datos) && /DEL QUE PREGUNTA/.test(c.datos), 'van las plantillas de los rivales, con la del que pregunta marcada');
const sueltos = r.nombres.filter((n) => c.datos.includes(n)); console.log("   sueltos:", sueltos.join(", ")); ok(!sueltos.length, 'ni un equipo rival ni un mánager sin alias en las plantillas (los nombres de pila que también son de jugadores se quedan, como siempre)');
ok(/Rival \d+/.test(c.datos) && c.alias && typeof c.alias.puesto === 'boolean', 'los rivales van con alias y se avisa al Worker');
const msgs = W.mensajesChat(c.hist, c.pregunta, c.fotos);
ok(Array.isArray(msgs) && msgs[0].role === 'user' && msgs.at(-1).role === 'user', `el Worker acepta la conversación (${msgs && msgs.length} mensajes)`);
ok(!c.hist.some((m) => /notas|Revisado por la app/.test(m.t)) && c.hist.some((m) => /captura/.test(m.t)), 'la conversación va sin notas ni revisiones y con la marca de la captura');
ok(c.hist.length === 4 && !c.hist.some((m) => m.t.includes('De toda su plantilla')), 'la pregunta de ahora va aparte, no repetida en la conversación');
ok(TONOS(c.tono) && Array.isArray(c.bloq) && c.rid === 'pruebachat01', `tono «${c.tono}», funciones cerradas y el id`);
ok(r.notaTexto === 'Ofrécele 140,33 M o espera a su cláusula.', `notas sin comillas y códigos fuera: «${r.notaTexto}»`);
ok(r.gemTodo, 'con la clave de Google, las mismas instrucciones nuevas y los mismos datos');
// (noche del 16 al 17 nov) las formas raras en que Haiku dejó el bloque de notas en las pasadas de verdad
for (const [t, como] of [
  ['Acepta.\n\n<notas>\n{"recomiendo": [{"ref": "A-1003", "accion": "aceptar_oferta", "jugador": "Álex Baena"}], "apuntar": [], "olvidar": []}\n</notas>', 'entre etiquetas <notas>'],
  ['Acepta.\n\n[{"ref": "A-1003", "accion": "aceptar_oferta", "jugador": "Álex Baena", "importe": 66170000, "cuando": "ahora"}]\n```', 'solo la lista, con comillas sueltas detrás'],
  ['Acepta.\n\n[{"ref": "A-1003", "accion": "aceptar_oferta", "jugador": "Álex Baena"}]\n</br>', 'solo la lista, con un </br> detrás'],
  ['Acepta.\n\n_notas_omitted', 'con «_notas_omitted»'],
  ['Acepta.\n\n\n<br>', 'con un <br> suelto'],
]) {
  const sep = CS.separarNotas(t);
  ok(sep.texto === 'Acepta.' && (!/[\[{]/.test(t) || (sep.bloque && JSON.parse(sep.bloque).recomiendo.length === 1)), `notas ${como}: fuera del texto${/[\[{]/.test(t) ? ' y la app las lee' : ''}`);
}
const sis = CS.sistemaChat({ tono: c.tono, bloq: c.bloq, anuncio: c.anuncio, alias: c.alias });
// (19 nov: 16.500 con lo de los tratos entre managers, el trueque de Carlos con Domy)
ok(sis.length < 16500 && !/OPERACIONES POSIBLES HOY \(las ÚNICAS/.test(sis), `las instrucciones del chat, cortas (${sis.length} caracteres) y sin las del plan`);
ok(!/es una función top/.test(CS.sistemaChat({ bloq: ['dineroRivales', 'quienPaga', 'inercia'], anuncio: true })) && /candado/.test(CS.sistemaChat({ bloq: ['quienPaga'], anuncio: true })), 'lo cerrado, con su candado y sin «función top»');
ok(/SUS CLÁUSULAS, DE LA MÁS FÁCIL/.test(c.datos) && /EN EL MERCADO ME QUEDAN PARA PUJAS/.test(c.datos) && !/funci[oó]n top/.test(c.datos) && !/\bme faltan\b/.test(c.datos.slice(c.datos.indexOf('PLANTILLAS DE LOS RIVALES'))), 'los datos del chat: sus cláusulas ordenadas, lo que queda para pujar bien dicho, sin «función top» ni «me faltan» en los rivales');

// ---- en la app, de punta a punta: la pregunta va al servidor (de mentira) y lo que se ve sale limpio ----
{
  const P2 = await pagina('martes');
  const pedidos = [];
  let respuesta = (b) => ({ texto: `Mira la plantilla entera de ${b.datos.includes('Rival 2') ? 'Rival 2' : 'ese rival'}: su mejor opción es la cláusula (Operación C-1203) cuando se abra.\n\nnotas\n{"recomiendo": [], "apuntar": [], "olvidar": []}`, cupo: { usados: 1, gratis: 5, max: 20, extras: 0, porAnuncio: 3, quedan: 4, masConAnuncio: true }, tok: { entra: 20000, sale: 600 } });
  await P2.page.route('**/fantasy-manager.fantasymanager-web-app.workers.dev/**', async (rt) => {
    const q = rt.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (q.method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors });
    if (!q.url().endsWith('/pregunta')) return rt.fulfill({ status: 404, headers: cors, body: '{}' });
    const b = JSON.parse(q.postData() || '{}');
    pedidos.push(b);
    const j = respuesta(b);
    return rt.fulfill({ status: j.e && j.cupo ? 429 : 200, headers: cors, contentType: 'application/json', body: `   ${JSON.stringify(j)}` });
  });
  const x = await P2.page.evaluate(async () => {
    const Pu = await import('./js/puente.js'), U = await import('./js/util.js');
    await Pu.guardar('sesion', { token: 'x'.repeat(40), caduca: Date.now() + 3600e3 });
    await Pu.guardar('gemini', null);
    const g = U.LS.get('limites', null) || { t: Date.now(), cfg: {} };
    g.cfg = { ...(g.cfg || {}), preguntas: { on: true, gratis: 3, porAnuncio: 3, max: 6 } };
    U.LS.set('limites', g);
    window.S.D.demo = false;
    return true;
  });
  // a Pregunta: ya no pide la clave
  await P2.page.evaluate(() => document.querySelector('[data-v="ia"], #bPregunta')?.click());
  await P2.page.waitForTimeout(500);
  const guia = await P2.page.evaluate(() => !document.querySelector('#pregunta'));
  ok(!guia, 'sin clave de Google, Pregunta deja escribir (la IA de la app)');
  await P2.page.fill('#pregunta', '¿Qué le ficho al segundo?');
  await P2.page.click('[data-accion="enviar"]');
  await P2.page.waitForFunction(() => !window.S.charlando, null, { timeout: 20000 });
  const visto = await P2.page.evaluate(() => [...document.querySelectorAll('.msg.ia')].pop()?.innerText || '');
  ok(pedidos.length === 1 && pedidos[0].datos.startsWith('DATOS DE SU LIGA') && pedidos[0].pregunta === '¿Qué le ficho al segundo?' && /^[a-z0-9]{8,24}$/.test(pedidos[0].rid), `la pregunta va al servidor con sus datos y un id (${pedidos.length} pedido)`);
  ok(/plantilla entera/.test(visto) && !/notas|recomiendo|C-1203|Operación/.test(visto), `lo que se ve, limpio: «${visto.replace(/\s+/g, ' ').slice(0, 140)}»`);
  // sin preguntas hoy: 429 con el cupo; en la web no hay anuncio, así que lo dice y la pregunta vuelve a la caja
  respuesta = () => ({ e: 'Ya has hecho tus 3 preguntas de hoy.', cupo: { usados: 3, gratis: 3, max: 6, extras: 0, porAnuncio: 3, quedan: 0, masConAnuncio: true } });
  await P2.page.fill('#pregunta', '¿Y otra?');
  await P2.page.click('[data-accion="enviar"]');
  await P2.page.waitForFunction(() => !window.S.charlando, null, { timeout: 20000 });
  const err = await P2.page.evaluate(() => ({ t: document.querySelector('.error-c')?.innerText || '', caja: document.querySelector('#pregunta')?.value || '' }));
  ok(/3 preguntas de hoy/.test(err.t) && err.caja === '¿Y otra?', `sin cupo: lo dice y la pregunta vuelve a la caja («${err.t.replace(/\s+/g, ' ').slice(0, 120)}»)`);
  // Android cerró la app con una pregunta en marcha: al volver se recoge con el mismo id
  respuesta = (b) => ({ texto: `Recogida: ${b.rid}`, cupo: { usados: 2, gratis: 3, max: 6, extras: 0, porAnuncio: 3, quedan: 1, masConAnuncio: true } });
  const rec = await P2.page.evaluate(async () => {
    const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
    const h = I.conversacion(); h.push({ r: 'yo', t: '¿Me la recoges?', ts: Date.now() }); U.LS.set(Dt.K('chat'), h);
    U.LS.set('preg-rid', { rid: 'recogeme0001', t: '¿Me la recoges?', ts: Date.now(), dia: U.diaDe() });
    const r = await I.reanudarPregunta(window.S.D, window.S.M, Dt.cfg());
    return { t: r && r.texto, queda: !!U.LS.get('preg-rid', null), ult: I.conversacion().slice(-1)[0].t };
  });
  ok(rec.t === 'Recogida: recogeme0001' && !rec.queda && rec.ult === rec.t, `la pregunta a medias se recoge con su id (${rec.t})`);
  await P2.cerrar(); await cerrar();
}
console.log(`${mal ? `${mal} MAL` : 'Todo BIEN'}`);
process.exit(mal ? 1 : 0);
function TONOS(t) { return ['serio', 'normal', 'saco'].includes(t); }
