// (0.9c, 28 nov) El movimiento al cambiar de pantalla: comprueba con la app de verdad (la liga de ejemplo) que cada cosa
// entra desde su lado, que un toque a mitad no deja nada a medias, que las hojas se quitan cuando han acabado de irse y que
// las secciones de Ajustes se abren y se cierran sin quedarse movidas.
//   node .github/liquid/movimiento.mjs [opciones: pc, webkit, w320, tx160, rm (reducir movimiento)] [BASE]
// Con la web servida en local (python3 -m http.server 8765 dentro de web/).
const PW = process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs';
const pw = await import(PW);
const [, , opA = '', BASE = process.env.BASE || 'http://127.0.0.1:8765'] = process.argv;
const op = new Set(opA.split(',').filter(Boolean));
const num = (pre, d) => { const o = [...op].find((x) => new RegExp(`^${pre}\\d+$`).test(x)); return o ? +o.slice(pre.length) : d; };
const PC = op.has('pc'), RM = op.has('rm');
const W = num('w', PC ? 1280 : 390), H = PC ? 800 : 844, tx = num('tx', 0);
const motor = op.has('webkit') ? 'webkit' : 'chromium';
const nav = await pw[motor].launch();
const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: !PC && motor === 'chromium', hasTouch: !PC, reducedMotion: RM ? 'reduce' : 'no-preference' });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-prueba', '1');
    localStorage.setItem('fm-beta-aviso', String(Date.now()));
    if (!localStorage.getItem('fm-n-gemini')) localStorage.setItem('fm-n-gemini', 'AIzaMAQUETA-no-es-una-clave');
  } catch (e) { /* nada */ }
});
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`${BASE}/index.html`);
await p.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 60000 });
if (tx) await p.evaluate((v) => { for (const k of ['text-size-adjust', '-webkit-text-size-adjust']) document.documentElement.style.setProperty(k, `${v}%`, 'important'); window.dispatchEvent(new Event('resize')); }, tx);
await p.waitForTimeout(600);

const r = await p.evaluate(async ({ PC, RM }) => {
  const mal = [], bien = [];
  const ok = (c, t) => (c ? bien : mal).push(t);
  const espera = (ms) => new Promise((f) => setTimeout(f, ms));
  const clic = (sel) => { const b = document.querySelector(sel); if (b) b.click(); return b; };
  // (solo las de la API de animaciones: las del CSS, como la píldora o un número que late, van aparte)
  const vivas = () => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && !a.effect.pseudoElement && !(typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation) && !(typeof CSSTransition !== 'undefined' && a instanceof CSSTransition));
  const deVista = () => vivas().filter((a) => a.effect.target.closest && a.effect.target.closest('#vista'));
  const inicio = (a) => { const k = a.effect.getKeyframes()[0]; return k && k.transform; };
  const quieta = (el) => { const cs = getComputedStyle(el); return (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)') && Number(cs.opacity) === 1; };
  const vista = () => document.querySelector('#vista');
  // 1. pestañas de abajo: hacia la derecha entra desde la derecha; hacia la izquierda, desde la izquierda
  clic('.nav [data-ir="hoy"]'); await espera(400);
  clic('.nav [data-ir="mercado"]'); await espera(16);
  let a = deVista();
  if (RM) ok(!a.length, 'reducir movimiento: nada se mueve al cambiar de pestaña');
  else {
    ok(a.length === 1 && a[0].effect.target === vista(), `Hoy → Mercado: se mueve la vista entera, un elemento (${a.length})`);
    ok(a[0] && /translate3d\(0px, 28px|translate3d\(36px|translate3d\(\d+px, 0/.test(inicio(a[0])) && (PC ? /, 28px/.test(inicio(a[0])) : /^translate3d\(\d+px/.test(inicio(a[0]))), `Hoy → Mercado entra desde ${PC ? 'abajo' : 'la derecha'} (${a[0] && inicio(a[0])})`);
  }
  await espera(400);
  ok(quieta(vista()) && !deVista().length, `Mercado: acaba en su sitio (${getComputedStyle(vista()).transform} ${getComputedStyle(vista()).opacity} ${document.getAnimations().filter((x) => x.effect && x.effect.target === vista()).map((x) => x.constructor.name + ':' + Math.round(x.currentTime) + '/' + x.playState).join(',')} t=${Math.round(performance.now())})`);
  clic('.nav [data-ir="equipo"]'); await espera(16);
  a = deVista();
  if (!RM) ok(a[0] && (PC ? /, -28px/.test(inicio(a[0])) : /translate3d\(-\d+px/.test(inicio(a[0]))), `Mercado → Equipo entra desde ${PC ? 'arriba' : 'la izquierda'} (${a[0] && inicio(a[0])})`);
  await espera(400);
  // 2. toques rápidos seguidos: nada se queda a medias
  for (const v of ['clubes', 'directo', 'hoy', 'rivales', 'mercado']) { clic(`.nav [data-ir="${v}"]`); await espera(45); }
  ok(deVista().length <= 1, `toques rápidos: como mucho una animación viva (${deVista().length})`);
  await espera(420);
  ok(quieta(vista()) && !deVista().length && window.S.vista === 'mercado', 'toques rápidos: la última pestaña, quieta y entera');
  // lo nuevo se puede tocar desde el primer fotograma
  clic('.nav [data-ir="equipo"]');
  const b0 = document.querySelector('#vista .tabs [data-seg]:not(.activo)');
  ok(!!b0 && document.elementFromPoint(b0.getBoundingClientRect().left + 5, b0.getBoundingClientRect().top + 5) !== null, 'lo nuevo se puede tocar mientras entra');
  await espera(400);
  // 3. sub-pestañas: el selector se queda, lo de debajo entra desde su lado
  const tabs = [...document.querySelectorAll('#vista .tabs-in button[data-seg]')];
  const act = tabs.findIndex((b) => b.classList.contains('activo'));
  const otra = tabs[act + 1] || tabs[act - 1];
  if (otra) {
    const der = tabs.indexOf(otra) > act;
    otra.click(); await espera(16);
    a = deVista();
    if (!RM) {
      ok(a.length === 1 && a[0].effect.target.classList.contains('mueve'), `sección nueva: se mueve solo lo de debajo del selector (${a.map((x) => x.effect.target.className).join(',')})`);
      ok(a[0] && !a[0].effect.target.querySelector('.tabs') && a[0].effect.target.previousElementSibling && a[0].effect.target.previousElementSibling.classList.contains('tabs'), 'sección nueva: el selector no va dentro de lo que se mueve');
      ok(a[0] && (der ? /translate3d\(\d+px/ : /translate3d\(-\d+px/).test(inicio(a[0])), `sección nueva entra desde la ${der ? 'derecha' : 'izquierda'} (${a[0] && inicio(a[0])})`);
    }
    await espera(400);
    ok(!deVista().length, 'sección nueva: acaba en su sitio');
  } else mal.push('no hay sub-pestañas en Equipo');
  // 4. Pregunta: entra desde arriba y la caja del chat no se mueve; al dejarla, lo nuevo sube desde abajo
  clic('#bPregunta'); await espera(16);
  a = deVista();
  const esc = document.querySelector('.escribe');
  if (!RM) {
    ok(a.length === 1 && /, -28px/.test(inicio(a[0])), `Pregunta entra desde arriba (${a[0] && inicio(a[0])})`);
    ok(!!esc && a[0] && !a[0].effect.target.contains(esc) && a[0].effect.target !== vista(), 'Pregunta: la caja del chat (fija) no va dentro de lo que se mueve');
  }
  await espera(400);
  clic('.nav [data-ir="hoy"]'); await espera(16);
  a = deVista();
  if (!RM) ok(a[0] && /, 28px/.test(inicio(a[0])), `dejar Pregunta: lo nuevo sube desde abajo (${a[0] && inicio(a[0])})`);
  await espera(400);
  // 5. las hojas: suben, y al cerrarse se van hasta el final antes de quitarse
  const S = window.S, M = S.M;
  const suyo = [...M.mias].filter((x) => x.j && x.j.pos !== 5).sort((x, y) => y.j.valor - x.j.valor)[0];
  const abrir = (attr, id) => { const b = document.createElement('button'); b.dataset[attr] = id; b.hidden = true; document.body.append(b); b.click(); b.remove(); };
  abrir('j', suyo.pid); await espera(520);
  const h1 = document.querySelector('.hoja.on');
  ok(!!h1, 'la ficha se abre');
  clic('.velo'); await espera(200);
  const sigue = document.querySelector('.hoja.sale');
  ok(RM ? !sigue : !!sigue, RM ? 'reducir movimiento: la ficha se quita ya' : 'a los 200 ms la ficha sigue yéndose (no se quita a medias)');
  if (sigue && !PC) { const rr = sigue.getBoundingClientRect(); ok(rr.top < window.innerHeight, 'a los 200 ms aún se ve'); }
  await espera(330);
  ok(!document.querySelector('.hoja') && !document.querySelector('.velo'), 'a los 530 ms ya no está');
  // dos toques en el velo seguidos: un solo cierre
  abrir('j', suyo.pid); await espera(520);
  const hl = history.length;
  clic('.velo'); await espera(30); clic('.velo'); await espera(500);
  ok(!document.querySelector('.hoja') && !window.S.hoja, 'dos toques en el velo: se cierra una vez');
  // 6. una ficha encima de otra: entra desde la derecha; «Volver», lo de antes desde la izquierda
  abrir('j', suyo.pid); await espera(520);
  const club = document.querySelector('.hoja [data-club]');
  if (club) {
    club.click(); await espera(16);
    const hs = document.querySelectorAll('.hoja');
    a = vivas().filter((x) => x.effect.target.closest && x.effect.target.closest('.hoja'));
    ok(hs.length === 1 && hs[0].classList.contains('on'), 'ficha encima: la hoja se queda (una, ya en su sitio)');
    if (!RM) ok(a.length === 1 && a[0].effect.target.classList.contains('mueve') && /translate3d\(\d+px/.test(inicio(a[0])), `ficha encima: lo nuevo entra desde la derecha (${a[0] && inicio(a[0])})`);
    await espera(400);
    const v = document.querySelector('.hoja [data-accion="volverHoja"]');
    ok(!!v, 'ficha encima: lleva «Volver»');
    if (v) {
      v.click(); await espera(16);
      a = vivas().filter((x) => x.effect.target.closest && x.effect.target.closest('.hoja'));
      if (!RM) ok(a[0] && /translate3d\(-\d+px/.test(inicio(a[0])), `«Volver»: lo de antes entra desde la izquierda (${a[0] && inicio(a[0])})`);
      await espera(400);
      ok(window.S.tipoHoja && window.S.tipoHoja[0] === 'j', '«Volver»: vuelve a la ficha del jugador');
    }
  } else mal.push('la ficha del jugador no lleva su club');
  clic('.velo'); await espera(520);
  // 7. Ajustes: en el móvil entra desde arriba; las secciones se abren y se cierran
  clic('#bAjustes'); await espera(520);
  const aj = document.querySelector('.hoja.on');
  ok(!!aj, 'Ajustes se abre');
  if (!PC) ok(aj && aj.classList.contains('hoja-arriba'), 'Ajustes (móvil): entra desde arriba');
  const sec = aj && aj.querySelector('details.aj-sec:not([open])');
  if (sec) {
    sec.querySelector('summary').click(); await espera(16);
    ok(sec.open, 'sección: se abre');
    a = vivas().filter((x) => aj.contains(x.effect.target));
    if (!RM) ok(a.length >= 1 && a.every((x) => /transform|opacity/.test(JSON.stringify(x.effect.getKeyframes()))), `sección: se mueve con transform y opacity (${a.length})`);
    await espera(420);
    ok(![...aj.querySelectorAll('.aj-sec')].some((x) => !quieta(x)), 'sección abierta: todo en su sitio');
    sec.querySelector('summary').click(); await espera(60);
    if (!RM) ok(sec.open && sec.classList.contains('cerrando'), 'sección: al cerrar, sigue abierta mientras sube lo de debajo');
    await espera(400);
    ok(!sec.open && !sec.classList.contains('cerrando') && ![...aj.querySelectorAll('.aj-sec')].some((x) => !quieta(x)), 'sección cerrada: todo en su sitio');
    // toques rápidos sobre la misma sección
    for (let i = 0; i < 5; i++) { sec.querySelector('summary').click(); await espera(40); }
    await espera(450);
    ok(sec.open && !sec.classList.contains('cerrando') && ![...aj.querySelectorAll('.aj-sec, .aj-cuerpo')].some((x) => !quieta(x)), 'sección, cinco toques seguidos: abierta y en su sitio');
    ok(!!(window.S.ajAbiertas && window.S.ajAbiertas[sec.dataset.k]), 'sección: se recuerda abierta');
  } else mal.push('Ajustes sin secciones');
  ok(!!(aj && aj.querySelector('#buscaAj')), 'Ajustes: sigue el buscador');
  clic('.velo'); await espera(520);
  ok(!document.querySelector('.hoja'), 'Ajustes se cierra');
  return { mal, bien };
}, { PC, RM });
console.log(`movimiento ${opA || '(móvil)'}: ${r.bien.length} bien, ${r.mal.length} mal${errores.length ? `, ${errores.length} errores` : ''}`);
for (const m of r.mal) console.log('  MAL', m);
for (const e of errores) console.log('  ERROR', e);
if (process.env.TODO) for (const b of r.bien) console.log('  ok', b);
await nav.close();
process.exit(r.mal.length || errores.length ? 1 : 0);
