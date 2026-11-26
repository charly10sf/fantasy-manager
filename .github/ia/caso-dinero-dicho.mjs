// Apuntar el dinero que te ha dicho un rival (0.8.4o; Carlos, 25 nov, 23:58: «el dinero es una función top, que esto solo
// sea para apuntar y ya. Que en ningún caso revele datos que son viendo anuncios»). Sin red, con la liga de ejemplo (en ella
// el dinero de los rivales y quién paga están cerrados):
//  (a) se pinta todo (Hoy, Equipo, Rivales con sus tres pestañas, la ficha de cada rival con todas sus pestañas, Mercado,
//      la ficha de un jugador tuyo y de uno del rival, el plan sin IA y lo que se le pasa a la IA) SIN cifra dicha
//  (b) se apunta 70 M a un rival por la app de verdad (su fila de Rivales → la hoja → Guardar): la tostada dice «Apuntado»
//      sin la cuenta, la ficha dice «70 M · lo que te dijo» y la fila «Te dijo 70 M»
//  (c) se pinta todo otra vez CON la cifra: quitando lo apuntado (la cifra, «Apuntar» → «Cambiar la cifra»), TODO es igual
//      que en (a): ni un número, ni «le llega», ni «te lo puede quitar», ni el peligro, ni una categoría de dinero
//  (d) con su dinero abierto (como al ver sus anuncios), la cifra sí entra en la cuenta: su dinero sale de lo que te dijo
//  (e) al cerrarse otra vez, todo vuelve a ser como en (c)
//  (f) «Olvidar»: la tostada dice «Olvidado» sin hablar de la cuenta y todo vuelve a ser como en (a)
//  (g) la ventana «Quién y cuánto» (la de la novedad): sin rival o sin cifra no guarda; con los dos, «Apuntado: X tiene unos 48 M»
//  (h) Pregunta: la nota «dinero» de la IA sale como tarjeta y no se guarda hasta tocarla; con una cifra que él no ha escrito, nada
// Uso: PW_MODULO=… node .github/ia/caso-dinero-dicho.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

let R = '';
const P = await pagina('martes', () => `Vale. Si quieres, lo apunto en su ficha con un toque.\n\n\`\`\`notas\n{"apuntar": [{"tipo": "dinero", "jugador": "${R}", "importe": 52000000}]}\n\`\`\``);
const { page } = P;
// el reloj quieto: así dos pasadas seguidas pintan lo mismo
const t0 = await page.evaluate(() => Date.now());
await page.clock.pauseAt(new Date(t0 + 1000));

const info = await page.evaluate(async () => {
  const S = window.S, L = await import('./js/limite.js');
  // (con el análisis de la app: el de la escena no lleva lo de fuera)
  window.__fmRehacer();
  // uno sin el dinero exacto (en la liga de ejemplo, de los cuatro primeros sí se sabe)
  const r = S.M.rivales.find((x) => !(x.dinero && x.dinero.exacto));
  return { tid: String(r.e.teamId), nombre: r.e.manager || r.e.nombre, cerrado: L.bloqueada('dineroRivales', r.e.teamId), quien: L.bloqueada('quienPaga', r.e.teamId), n: S.M.rivales.length };
});
R = info.nombre;
ok(info.cerrado && info.quien && info.n > 1, `la liga de ejemplo, con el dinero de ${info.nombre} y quién paga cerrados (${info.n} rivales)`);

/** todo lo que se pinta y lo que lee la IA, en texto; sin lo que es de apuntar (la cifra y su botón) */
const foto = () => page.evaluate(async (tid) => {
  const S = window.S, V = await import('./js/vistas.js'), Hj = await import('./js/hojas.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js');
  const quita = (html) => { const d = document.createElement('div'); d.innerHTML = html; d.querySelectorAll('.dd-ficha, .dd-pie, .dd-tile, .dd-cerr, .pill.dd-p, .pill.dd-ap, .dd-aviso').forEach((e) => e.remove()); return d.innerHTML.replace(/(id="|#)g\d+/g, '$1g').replace(/>\s+</g, '><').replace(/\s+/g, ' '); };
  // (los números de lo que calcula el motor, a 10 mil: con el reloj, las recompensas del día cambian unos euros por segundo)
  const js = (x) => JSON.stringify(x, (k, v) => (typeof v === 'number' && Math.abs(v) >= 1e4 ? Math.round(v / 1e4) : v));
  const seg0 = JSON.stringify(S.seg), sr0 = S.segRival;
  const out = {};
  const vista = (k, segs, f) => { for (const s of segs) { S.seg[k] = s; out[`${k}:${s}`] = quita(f(S)); } };
  out.hoy = quita(V.hoy(S));
  vista('equipo', ['plantilla', 'jornadas', 'venta', 'clausulas', 'dinero'], V.equipo);
  vista('rivales', ['clasif', 'jornadas', 'clausulas'], V.rivales);
  vista('mercado', ['venta', 'especular', 'tendencias', 'movimientos'], V.mercado);
  const SUB = { plantilla: ['todos', 'puesto'], suben: ['hoy', '7d'], clausulas: ['quitas', 'quita'], juego: ['perfil', 'venta', 'movs'] };
  for (const r of S.M.rivales) for (const [seg, subs] of Object.entries(SUB)) for (const sub of subs) { S.segRival = { tid: r.e.teamId, seg, sub }; out[`ficha ${r.e.teamId} ${seg}/${sub}`] = quita(Hj.fichaRival(S, r.e.teamId)); }
  const suyo = S.M.rivales.find((r) => String(r.e.teamId) === tid);
  const pids = [...[...S.M.mias].sort((a, b) => b.j.valor - a.j.valor).slice(0, 2).map((x) => x.pid), ...[...suyo.fichas].sort((a, b) => b.j.valor - a.j.valor).slice(0, 2).map((x) => x.pid)];
  for (const pid of pids) out[`jugador ${pid}`] = quita(Hj.fichaJugador(S, pid));
  S.seg = JSON.parse(seg0); S.segRival = sr0;
  out.plan = JSON.stringify((S.plan && S.plan.ops || []).map((o) => [o.tipo, o.pid, o.importe, o.txt, o.porque, o.descartada]));
  const c = Dt.cfg();
  out.iaPlan = I.contexto(S.D, S.M, c);
  for (const q of ['¿Qué hago hoy?', `¿Cuánto dinero tiene ${suyo.e.manager}?`, `¿Quién me puede pagar la cláusula de ${S.M.mias[0].j.nombre}?`, `¿Le llega a ${suyo.e.manager} para clausularme a alguien?`]) out[`iaChat ${q}`] = I.datosChat(q, S.D, S.M, c, {});
  out.motor = js(S.M.rivales.map((r) => ({ t: r.e.teamId, nivel: r.nivel, d: r.dinero, ll: (r.leLlegan || []).map((x) => x.pid), cap: S.M.capacidad(r.e.teamId) })));
  out.quienPaga = js(S.M.mias.map((x) => x.clausula && S.M.quienPaga(x.clausula)));
  out.acciones = JSON.stringify(S.M.acciones || []);
  return out;
}, info.tid);
const dif = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
const muestra = (a, b, k) => { const x = a[k] || '', y = b[k] || ''; let i = 0; while (i < x.length && x[i] === y[i]) i++; return `${k}: «…${x.slice(Math.max(0, i - 60), i + 80)}» / «…${y.slice(Math.max(0, i - 60), i + 80)}»`; };

// (a)
const A = await foto();
const A2 = await foto();
ok(!dif(A, A2).length, `(a) dos pasadas seguidas pintan lo mismo (${Object.keys(A).length} pantallas y textos)${dif(A, A2).length ? ': ' + muestra(A, A2, dif(A, A2)[0]) : ''}`);

// (b) por la app de verdad: su fila → «Apuntar» → la hoja → 70 → Guardar
await page.click('.nav [data-ir="rivales"]');
const enFila = await page.$(`.fila[data-r="${info.tid}"] .dd-ap`);
ok(!!enFila && !!(await page.$('.dd-aviso')), '(b) en su fila de Rivales, «Apuntar», y el aviso de arriba');
await enFila.click();
await page.clock.runFor(400);
ok(!!(await page.$('.hoja .dd-hoja')) && /Verás solo tu cifra: su dinero sigue cerrado/.test(await page.textContent('.hoja')), '(b) la hoja, con «Verás solo tu cifra: su dinero sigue cerrado»');
await page.click('.hoja [data-accion="ddAtajo"][data-v="60"]');
await page.click('.hoja [data-accion="ddPaso"][data-n="1"]');
const enCaja = await page.inputValue('.hoja .dd-in');
await page.fill('.hoja .dd-in', '70');
const nota = await page.textContent('.hoja .dd-nota');
await page.click('.hoja [data-accion="dichoGuardar"]');
await page.clock.runFor(400);
const tost = await page.textContent('.tostada').catch(() => '');
const fila = await page.textContent(`.fila[data-r="${info.tid}"]`);
const guard = await page.evaluate(async (tid) => { const U = await import('./js/util.js'), Dt = await import('./js/datos.js'); return U.LS.get(Dt.K('dinero-dicho'), {})[tid]; }, info.tid);
ok(enCaja === '61' && /tal cual/.test(nota), `(b) los atajos y el +: «${enCaja}», «${nota}»`);
ok(tost === 'Apuntado', `(b) la tostada, sin la cuenta: «${tost}»`);
ok(guard && guard.v === 70e6 && guard.min === 70e6 && guard.max === 70e6 && guard.t > 0 && 'est' in guard, `(b) guardado como siempre: ${JSON.stringify(guard)}`);
ok(/Te dijo 70 M/.test(fila) && !(await page.$('.dd-aviso')), `(b) en su fila, «Te dijo 70 M», y el aviso ya no sale`);
const ficha = await page.evaluate(async (tid) => { const S = window.S, Hj = await import('./js/hojas.js'); S.segRival = { tid, seg: 'clausulas', sub: 'quita' }; const d = document.createElement('div'); d.innerHTML = Hj.fichaRival(S, tid); return d.textContent; }, info.tid);
ok(/70 M\s*lo que te dijo/.test(ficha) && /Te dijo 70 M hoy a las \d/.test(ficha) && /Cambiar la cifra/.test(ficha) && /Olvidar lo que te dijo/.test(ficha) && /Cerrado\s*su dinero en la app/.test(ficha), '(b) la ficha: «70 M · lo que te dijo», «Te dijo 70 M hoy a las…», cambiar y olvidar, y su dinero cerrado');
ok(!/Cuando te lo dijo|Ahora daría|de diferencia/.test(ficha), '(b) y nada de lo que daba la cuenta');

// (c)
const B = await foto();
const dc = dif(A, B);
ok(!dc.length, `(c) con 70 M apuntados y su dinero cerrado, lo demás igual en todo${dc.length ? ` (cambia ${dc.length}: ${dc.slice(0, 4).join(', ')}) ${muestra(A, B, dc[0])}` : ''}`);

// (d) su dinero abierto: la cifra entra en la cuenta
const abierto = await page.evaluate(async (tid) => {
  const U = await import('./js/util.js'), S = window.S, Hj = await import('./js/hojas.js');
  U.LS.set('top-rivales', { j: null, usos: 1, abiertos: { [tid]: Date.now() + 5 * 60e3 }, uno: null });
  document.querySelector('.nav [data-ir="hoy"]').click();
  const d = S.M.dineroDe(tid);
  S.segRival = { tid, seg: 'clausulas', sub: 'quita' };
  const el = document.createElement('div'); el.innerHTML = Hj.fichaRival(S, tid);
  return { dicho: d && d.dicho ? d.dicho.v : null, v: d && d.v, txt: el.textContent };
}, info.tid);
ok(abierto.dicho === 70e6 && abierto.v != null, `(d) con su dinero abierto, su dinero sale de lo que te dijo (${Math.round(abierto.v / 1e5) / 10} M)`);
const C = await foto();
ok(dif(B, C).length > 0, `(d) y eso sí cambia lo que se ve (${dif(B, C).length} pantallas)`);

// (e) se cierra otra vez
await page.evaluate(async () => { const U = await import('./js/util.js'); U.LS.del('top-rivales'); document.querySelector('.nav [data-ir="rivales"]').click(); });
const E = await foto();
ok(!dif(B, E).length, `(e) al cerrarse otra vez, como antes de abrirlo${dif(B, E).length ? ': ' + muestra(B, E, dif(B, E)[0]) : ''}`);

// (f) olvidar
await page.click(`.fila[data-r="${info.tid}"]`);
await page.clock.runFor(400);
await page.click('.hoja [data-accion="segRival"][data-s="clausulas"]');
await page.click('.hoja [data-accion="subRival"][data-p="quita"]');
await page.click('.hoja [data-accion="borrarDicho"]');
await page.clock.runFor(200);
const tostF = await page.textContent('.tostada').catch(() => '');
const F = await foto();
const df = dif(A, F);
ok(tostF === 'Olvidado', `(f) «Olvidar»: la tostada, «${tostF}»`);
ok(!df.length, `(f) y todo como sin cifra${df.length ? ': ' + muestra(A, F, df[0]) : ''}`);
await page.evaluate(() => document.querySelector('[data-accion="cerrarHoja"]') && document.querySelector('.velo').click());
await page.clock.runFor(400);

// (g) la ventana «Quién y cuánto»
const g = await page.evaluate(async (tid) => {
  const b = document.createElement('button'); b.dataset.accion = 'novDineroSi'; document.body.append(b); b.click(); b.remove();
  const v = () => document.getElementById('dd-ventana');
  const out = { abre: !!v(), caras: v() ? v().querySelectorAll('#ddRival option[value]:not([value=""])').length : 0 };
  v().querySelector('.dd-in').value = '48';
  v().querySelector('[data-accion="ddApuntar"]').click();
  out.sinRival = (v().querySelector('.dd-err') || {}).textContent || '';
  const sel = v().querySelector('#ddRival'); sel.value = tid; sel.dispatchEvent(new Event('change', { bubbles: true }));
  v().querySelector('.dd-in').value = '';
  v().querySelector('[data-accion="ddApuntar"]').click();
  out.sinCifra = (v().querySelector('.dd-err') || {}).textContent || '';
  v().querySelector('.dd-in').value = '48';
  v().querySelector('[data-accion="ddModo"][data-m="aprox"]').click();
  out.nota = v().querySelector('.dd-nota').textContent;
  v().querySelector('[data-accion="ddApuntar"]').click();
  out.hecho = v().textContent;
  const U = await import('./js/util.js'), Dt = await import('./js/datos.js');
  out.guard = U.LS.get(Dt.K('dinero-dicho'), {})[tid];
  v().querySelector('[data-accion="ddCerrar"]').click();
  out.cerrada = !v();
  return out;
}, info.tid);
ok(g.abre && g.caras === info.n, `(g) la ventana, con los ${info.n} rivales en el desplegable`);
ok(g.sinRival === 'Elige quién te lo dijo.' && g.sinCifra === 'Pon cuánto te dijo, en millones.', `(g) sin rival o sin cifra no guarda: «${g.sinRival}» «${g.sinCifra}»`);
ok(g.nota === 'Lo contamos entre 43 y 53 M.' && new RegExp(`Apuntado[\\s\\S]*${R} tiene unos 48 M[\\s\\S]*Lo verás en su ficha`).test(g.hecho), `(g) «Más o menos» y lo apuntado: «${g.nota}» · «${g.hecho.replace(/\s+/g, ' ').slice(0, 90)}»`);
ok(g.guard && g.guard.min === 43e6 && g.guard.max === 53e6 && g.guard.v === 48e6 && g.cerrada, `(g) guardado entre 43 y 53 M y la ventana cerrada`);
const G = await foto();
ok(!dif(A, G).length, `(g) y con eso apuntado y su dinero cerrado, lo demás igual${dif(A, G).length ? ': ' + muestra(A, G, dif(A, G)[0]) : ''}`);

// (h) Pregunta: la tarjeta
const h = await page.evaluate(async ({ tid, nom }) => {
  const I = await import('./js/ia.js'), S = window.S, U = await import('./js/util.js'), Dt = await import('./js/datos.js');
  U.LS.set(Dt.K('dinero-dicho'), {});
  const nota = (imp, j = nom) => `Vale.\n\n\`\`\`notas\n{"apuntar": [{"tipo": "dinero", "jugador": "${j}", "importe": ${imp}}]}\n\`\`\``;
  const bien = I.aplicarNotas(nota(52000000), S.D, `${nom} me ha dicho que tiene 52 millones`, false, S.M);
  const enMill = I.aplicarNotas(nota(52), S.D, `${nom} me ha dicho que tiene 52 kilos`, false, S.M);
  const otra = I.aplicarNotas(nota(60000000), S.D, `${nom} me ha dicho que tiene 52 millones`, false, S.M);
  const nadie = I.aplicarNotas(nota(52000000, 'Perico'), S.D, 'Perico me ha dicho que tiene 52 millones', false, S.M);
  const notas = I.notasVigentes().length;
  return { bien: bien.dineroRival, enMill: enMill.dineroRival, otra: otra.dineroRival, nadie: nadie.dineroRival, ap: bien.apuntadas.length, notas, guard: Object.keys(U.LS.get(Dt.K('dinero-dicho'), {})).length };
}, { tid: info.tid, nom: R });
ok(h.bien && h.bien.tid === info.tid && h.bien.v === 52e6 && h.enMill && h.enMill.v === 52e6, '(h) la nota «dinero» de la IA da el rival y la cifra (también en millones)');
ok(!h.otra && !h.nadie, '(h) con una cifra que él no ha escrito, o con alguien que no es de la liga, nada');
ok(h.ap === 0 && h.notas === 0 && h.guard === 0, '(h) y no se guarda nada solo: ni nota ni cifra');
// por el chat entero, con la IA de mentira
await page.evaluate((q) => { document.querySelector('.nav [data-ir="ia"], [data-ir="ia"]').click(); const b = document.createElement('button'); b.dataset.sugerencia = q; document.body.append(b); b.click(); b.remove(); }, `${R} me ha dicho que tiene 52 millones`);
await page.clock.runFor(5000);
await page.waitForSelector('.dd-chat', { timeout: 15000 }).catch(() => {});
const tarj = await page.textContent('.dd-chat').catch(() => '');
ok(/¿Lo apunto en su ficha\?/.test(tarj) && new RegExp(`${R} tiene 52 M`).test(tarj) && /Te lo dijo hoy/.test(tarj) && /Solo se guarda tu cifra/.test(tarj), `(h) en Pregunta, la tarjeta: «${tarj.replace(/\s+/g, ' ').slice(0, 110)}»`);
const antesToque = await page.evaluate(async () => { const U = await import('./js/util.js'), Dt = await import('./js/datos.js'); return Object.keys(U.LS.get(Dt.K('dinero-dicho'), {})).length; });
await page.click('.dd-chat [data-m="aprox"]').catch(() => {});
await page.clock.runFor(300);
const tras = await page.evaluate(async (tid) => { const U = await import('./js/util.js'), Dt = await import('./js/datos.js'); return { g: U.LS.get(Dt.K('dinero-dicho'), {})[tid], t: (document.querySelector('.msg.ia:last-of-type .apuntado') || document.body).textContent }; }, info.tid);
ok(antesToque === 0 && tras.g && tras.g.min === 47e6 && tras.g.max === 57e6, `(h) nada guardado hasta tocar; «Era más o menos»: entre 47 y 57 M`);
ok(/Apuntado en su ficha/.test(tras.t), '(h) y la tarjeta pasa a «Apuntado en su ficha»');

console.log(P.errores && P.errores.length ? `errores en la página: ${P.errores.join(' | ')}` : 'sin errores en la página');
if (P.errores && P.errores.length) mal++;
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTODO BIEN');
process.exit(mal ? 1 : 0);
