/* TEMPORAL (rediseño «Liquid», 27 nov): el guion de web/maqueta-liquid.html. No es parte de la app y no se publica.
   Dos caras: el marco (el móvil con la app dentro y el selector fuera) y, con ?dentro=1, la app de verdad con la capa de
   la dirección elegida. Aquí va solo lo que el CSS no puede hacer solo y que, en el paso 2, serán unas pocas líneas en
   app.js y hojas.js (clases y medidas, nada de lógica): saber si la página está desplazada, si se baja o se sube, mover
   la píldora de los selectores de sección y decir si una hoja es de media altura. */
const Q = new URLSearchParams(location.search);
const DENTRO = Q.get('dentro') === '1';
const html = document.documentElement;

export const DIRS = [['A', 'A · Cristal'], ['B', 'B · Grafito'], ['C', 'C · Estadio'], ['D', 'D · Base'], ['M', 'Mezcla · C + A'], ['0', 'Hoy']];
export const PANTS = [['hoy', 'Hoy'], ['equipo', 'Equipo'], ['directo', 'Directo'], ['rivales', 'Rivales · parte'], ['mercado', 'Mercado'], ['clubes', 'Clubes'],
  ['ficha', 'Ficha de jugador'], ['rival', 'Ficha de rival'], ['pregunta', 'Pregunta · teclado'], ['ajustes', 'Ajustes'], ['carga', 'La carga'], ['top', 'Función top'], ['barra', 'Barra encogida']];
const TECLADO = 300;

if (DENTRO) dentro(); else fuera();

/* =====================================================================================================================
   DENTRO: la app con la capa
   ===================================================================================================================== */
async function dentro() {
  // la liga de ejemplo, sin el tutorial ni el aviso de beta, y sin contar en «Antes de entrar»
  try {
    localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-prueba', '1');
    localStorage.setItem('fm-beta-aviso', String(Date.now()));
    localStorage.removeItem('fm-limites'); // que vuelva a leer limites.json (con ?top=1 se lee sin las bloqueadas)
    // Pregunta con su caja de escribir: una clave de mentira, solo en esta página (no llama a nadie si no se pregunta)
    if (!localStorage.getItem('fm-n-gemini')) localStorage.setItem('fm-n-gemini', 'AIzaMAQUETA-no-es-una-clave');
  } catch (e) { /* nada */ }
  // ?top=1: lo de dentro de las funciones top, sin cambiar limites.json (solo lo que lee esta página)
  if (Q.get('top') === '1') {
    const f0 = window.fetch.bind(window);
    window.fetch = async (u, o) => {
      const r = await f0(u, o);
      if (!/limites\.json/.test(String((u && u.url) || u))) return r;
      try { const j = await r.clone().json(); j.bloqueadas = []; return new Response(JSON.stringify(j), { status: 200, headers: { 'content-type': 'application/json' } }); } catch (e) { return r; }
    };
  }
  if (Q.get('tx')) texto(Q.get('tx'));
  if (Q.get('inv') === '1') html.classList.add('inv-aj'); // Invitar, fuera de la cabecera (dentro de Ajustes)
  if (Q.get('tc') === '1') html.classList.add('tit-c'); // la mezcla, con los títulos condensados de C
  // ?bl=12: probar con menos desenfoque (para las medidas)
  if (Q.get('bl')) { const st = document.createElement('style'); st.textContent = `html.dL { --cristal-desenfoque: blur(${+Q.get('bl')}px) saturate(170%) !important; }`; document.head.append(st); }
  if (Q.get('cap') === '1') { html.classList.add('maq-captura'); const g = document.createElement('div'); g.id = 'maq-sup-cristal'; document.body.append(g); } // el cristal, como lo pinta un móvil, en un Chromium sin tarjeta gráfica
  // la pantalla de carga se guarda al pasar, para poder enseñarla después
  let cargaHTML = '';
  const app = document.getElementById('app');
  const ojo = new MutationObserver(() => { const c = app.querySelector(':scope > .carga'); if (c && !c.classList.contains('mal')) cargaHTML = c.outerHTML; });
  ojo.observe(app, { childList: true, subtree: true });

  movimiento();
  await import('./app.js');
  await new Promise((ok) => { const t = setInterval(() => { if (window.S && window.S.M && document.querySelector('.nav')) { clearInterval(t); ok(); } }, 120); });
  ojo.disconnect();
  const S = window.S, M = S.M;
  const clic = (sel) => { const b = document.querySelector(sel); if (b) b.click(); return !!b; };
  const abrir = (attr, id) => { const b = document.createElement('button'); b.dataset[attr] = id; b.hidden = true; document.body.append(b); b.click(); b.remove(); };
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  // la ficha: el tuyo que más vale; el rival: el primero de la clasificación que no eres tú
  const suyo = [...M.mias].filter((x) => x.j && x.j.pos !== 5).sort((a, b) => b.j.valor - a.j.valor)[0];

  let pant = Q.get('p') || 'hoy';
  async function ver(p, y) {
    pant = p;
    document.querySelectorAll('#maq-carga').forEach((e) => e.remove());
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (document.querySelector('.hoja')) { clic('[data-accion="cerrarHoja"]'); await espera(320); }
    window.scrollTo(0, 0);
    const base = { ficha: 'equipo', rival: 'rivales', ajustes: 'hoy', carga: 'hoy', top: 'rivales', barra: 'mercado', pregunta: 'hoy' }[p] || p;
    clic(`.nav [data-ir="${base}"]`);
    await espera(150);
    if (p === 'rivales') { clic('[data-seg="rivales:parte"]'); await espera(120); }
    if (p === 'ficha' && suyo) abrir('j', suyo.pid);
    if (p === 'rival' || p === 'top') { clic('.tabs [data-seg^="rivales:"]'); await espera(120); }
    if (p === 'rival') clic('#vista [data-r]');
    if (p === 'ajustes') clic('#bAjustes');
    if (p === 'pregunta') { clic('#bPregunta'); await espera(250); const t = document.querySelector('.escribe textarea'); if (t) t.focus(); }
    if (p === 'top') clic('#vista [data-accion="bloqueada"]');
    if (p === 'carga' && cargaHTML) { const d = document.createElement('div'); d.id = 'maq-carga'; d.innerHTML = cargaHTML; document.body.append(d); }
    // una ficha tarda en montarse (más en WebKit): se espera a que esté abierta
    if (['ficha', 'rival', 'ajustes', 'top'].includes(p)) for (let i = 0; i < 25 && !document.querySelector('.hoja.on'); i++) await espera(80);
    await espera(420);
    const baja = y != null ? y : (p === 'barra' ? 1 : 0);
    if (baja) { await desplazar(); if (p !== 'barra') { await espera(60); html.classList.remove('nav-min'); } }
    parent !== window && parent.postMessage({ maq: 'lista', p }, '*');
  }
  // desplazada: hasta que pasen caras y escudos por debajo de la cabecera y de la barra (en una hoja, por dentro de ella)
  async function desplazar() {
    const h = document.querySelector('.hoja.on');
    const el = h || document.scrollingElement;
    const tope = el.scrollHeight - el.clientHeight;
    const y = Math.min(tope, Math.max(260, Math.round(tope * 0.34)));
    for (let i = 1; i <= 6; i++) { el.scrollTo(0, Math.round((y * i) / 6)); await espera(40); }
  }
  window.maq = { ver, desplazar, dir: poner, S };
  function poner(d) {
    html.classList.remove('dA', 'dB', 'dC', 'dD', 'dM', 'd0', 'dL');
    html.classList.add(`d${d}`); if ('ABCM'.includes(d)) html.classList.add('dL');
    window.dispatchEvent(new Event('resize')); // la app vuelve a medir la cabecera y la barra (--sup-h, --nav-h)
    requestAnimationFrame(() => window.dispatchEvent(new Event('maq-capa')));
  }
  window.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.maq === 'dir') poner(m.d);
    if (m.maq === 'ver') ver(m.p, m.y);
    if (m.maq === 'clase') html.classList.toggle(m.c, !!m.si);
    if (m.maq === 'texto') texto(m.v);
  });
  window.dispatchEvent(new Event('resize'));
  await ver(pant, Q.get('y') === '1' ? 1 : null);
  html.classList.add('maq-lista');
}

/* el tamaño de letra del sistema (en Android, el del móvil agranda toda la letra de la app): aquí, con text-size-adjust */
function texto(v) {
  for (const k of ['text-size-adjust', '-webkit-text-size-adjust']) { if (v) html.style.setProperty(k, `${v}%`, 'important'); else html.style.removeProperty(k); }
  html.dataset.tx = v || ''; html.classList.toggle('maq-tx', !!v);
  window.dispatchEvent(new Event('maq-capa'));
}

/* lo que se mueve: clases en <html> según el scroll, la píldora de los selectores y las hojas de media altura */
function movimiento() {
  // 1. desplazada (la cabecera pasa a cristal) y baja/sube (la barra se encoge al bajar y vuelve al subir)
  let y0 = 0, pend = false, acum = 0;
  // el selector de sección, ¿pegado ya bajo la cabecera? (la mezcla apaga lo que asoma entre las dos cápsulas)
  const pegada = () => { const t = document.querySelector('#vista .tabs'), s = document.querySelector('.sup'); html.classList.toggle('tabs-pegada', !!(t && s && window.scrollY > 6 && t.getBoundingClientRect().top <= s.getBoundingClientRect().bottom + 1)); };
  const mirar = () => {
    pend = false;
    const y = Math.max(0, window.scrollY);
    html.classList.toggle('desplazada', y > 6);
    pegada();
    const d = y - y0; y0 = y;
    if (y < 40) { if (html.classList.contains('nav-min')) { html.classList.remove('nav-min'); seguirCapsulas(); } acum = 0; return; }
    acum = (Math.sign(d) === Math.sign(acum) ? acum : 0) + d;
    const antes = html.classList.contains('nav-min');
    if (acum > 28) html.classList.add('nav-min');
    else if (acum < -18) html.classList.remove('nav-min');
    if (antes !== html.classList.contains('nav-min')) seguirCapsulas();
  };
  // (solo capturas y vídeos) mientras la cápsula de los botones se recoge o se abre, su cristal de captura la sigue
  const seguirCapsulas = () => { if (!html.classList.contains('maq-captura')) return; const fin = performance.now() + 650; const paso = () => { capsulasCaptura(); if (performance.now() < fin) requestAnimationFrame(paso); }; requestAnimationFrame(paso); };
  window.addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(mirar); } }, { passive: true });

  // 1b. escribiendo en Pregunta (el teclado abierto): la barra se aparta
  const escribe = () => html.classList.toggle('escribiendo', !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.escribe')));
  document.addEventListener('focusin', escribe); document.addEventListener('focusout', () => setTimeout(escribe, 0));

  // 2. la gota de la barra de abajo: hacia dónde va (para estirarse, dirección C) y que no se anime al pintar por primera vez
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.nav [data-ir]'); if (!b) return;
    const bs = [...b.parentNode.children], de = bs.findIndex((x) => x.classList.contains('activo')), a = bs.indexOf(b);
    html.classList.remove('nav-min');
    if (de < 0 || a === de || !(html.classList.contains('dC') || html.classList.contains('dM'))) return;
    const gota = b.parentNode;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !gota.animate) return;
    // la gota se estira hacia donde va y se recoge al llegar (solo transform: no cuesta)
    const paso = 100, x0 = de * paso, x1 = a * paso, medio = (x0 + x1) / 2, largo = 1 + Math.min(1.2, Math.abs(a - de) * 0.5);
    try {
      gota.animate([
        { transform: `translateX(${x0}%) scaleX(1)` },
        { transform: `translateX(${medio}%) scaleX(${largo})`, offset: 0.45 },
        { transform: `translateX(${x1}%) scaleX(1)` },
      ], { duration: 420, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', pseudoElement: '::before' });
    } catch (x) { /* sin animación de pseudoelementos: la transición del CSS */ }
  }, true);

  // 3. la píldora que se desliza en los selectores de sección (.tabs): la app repinta la pestaña entera, así que se
  //    recuerda dónde estaba la píldora de cada selector y se lleva desde ahí hasta la nueva
  const donde = new Map();
  const pildoras = () => {
    if (!html.classList.contains('dL')) return;
    document.querySelectorAll('.tabs-in').forEach((t) => {
      const act = t.querySelector('button.activo'); if (!act) return;
      const clave = `${(act.dataset.seg || act.dataset.filtro || '').split(':')[0]}|${t.children.length}|${t.closest('.hoja') ? 'h' : 'v'}`;
      const a = { x: act.offsetLeft, w: act.offsetWidth, oro: act.classList.contains('tab-oro') };
      const antes = donde.get(clave);
      t.classList.toggle('pil-oro', a.oro);
      if (antes && (antes.x !== a.x || antes.w !== a.w) && !t.dataset.pil) {
        t.style.setProperty('--px', `${antes.x}px`); t.style.setProperty('--pw', `${antes.w}px`);
        t.classList.add('pil-quieta'); void t.offsetWidth; t.classList.remove('pil-quieta');
      }
      t.dataset.pil = '1';
      t.style.setProperty('--px', `${a.x}px`); t.style.setProperty('--pw', `${a.w}px`);
      t.classList.add('con-pil');
      donde.set(clave, a);
    });
  };
  // 4. hojas: de media altura (flotan con margen, de cristal) o a pantalla completa (opacas, pegadas a los bordes)
  const hojas = () => {
    document.querySelectorAll('.hoja').forEach((h) => {
      if (h.dataset.maq) return;
      h.dataset.maq = '1';
      const media = h.scrollHeight < window.innerHeight * 0.62;
      h.classList.add(media ? 'hoja-media' : 'hoja-entera');
      h.addEventListener('scroll', () => h.classList.toggle('hoja-baja', h.scrollTop > 6), { passive: true });
    });
    html.classList.toggle('con-hoja', !!document.querySelector('.hoja'));
  };
  // 5. la barra de abajo: si alguna etiqueta no cabe en su pestaña, la etiqueta solo en la activa (nunca texto cortado).
  //    Se mide con una sonda aparte (misma letra), para no depender de cómo esté la barra en ese momento
  let sonda = null;
  const barra = () => {
    const nav = document.querySelector('.nav-in');
    if (!nav || !html.classList.contains('dL')) { html.classList.remove('nav-justa'); return; }
    if (!sonda) { sonda = document.createElement('span'); sonda.style.cssText = "position:absolute;left:-999px;top:0;visibility:hidden;white-space:nowrap;font:600 11px/1.1 'Barlow',sans-serif"; document.body.append(sonda); }
    let mayor = 0;
    nav.querySelectorAll('button').forEach((b) => { const t = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); if (!t) return; sonda.textContent = t.textContent.trim(); mayor = Math.max(mayor, sonda.getBoundingClientRect().width); });
    const hueco = (Math.min(window.innerWidth - 20, 460) - 10) / 6;
    html.classList.toggle('nav-justa', mayor > hueco - 4);
    gota();
  };
  const gota = () => {
    const nav = document.querySelector('.nav-in'), act = nav && nav.querySelector('button.activo');
    if (!act || !html.classList.contains('nav-justa')) return;
    nav.style.setProperty('--gx', `${act.offsetLeft}px`); nav.style.setProperty('--gw', `${act.offsetWidth}px`);
  };
  let ojoNav = null;
  const vigilarNav = () => {
    const nav = document.querySelector('.nav-in');
    if (!nav || nav === ojoNav) return;
    ojoNav = nav;
    new MutationObserver(() => requestAnimationFrame(() => { gota(); setTimeout(gota, 60); })).observe(nav, { attributes: true, attributeFilter: ['class'], subtree: true });
    barra();
  };
  new MutationObserver(() => { gota(); setTimeout(gota, 420); setTimeout(mapa, 460); }).observe(html, { attributes: true, attributeFilter: ['class'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => barra());

  // 6. nivel 2, la refracción (solo Chromium): el mapa de desplazamiento con la forma de la barra. En el canto, cada
  //    punto coge lo de un poco más afuera, así lo de detrás se dobla hacia dentro como en el borde de un cristal grueso
  const CHROMIUM = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.some((b) => /Chromium/.test(b.brand))) || /Chrome\/\d+/.test(navigator.userAgent);
  let mapaDe = '';
  const mapa = () => {
    const nav = document.querySelector('.nav-in'), im = document.getElementById('fm-refraccion-mapa');
    if (!nav || !im || !CHROMIUM || !html.classList.contains('nivel-2') || !html.classList.contains('dA')) { html.classList.remove('con-mapa'); mapaDe = ''; return; }
    const w = nav.offsetWidth, h = nav.offsetHeight;
    if (mapaDe === `${w}x${h}`) return;
    mapaDe = `${w}x${h}`;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), d = g.createImageData(w, h), r = h / 2, banda = Math.min(18, r);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.min(Math.max(x + 0.5, r), w - r), dx = x + 0.5 - cx, dy = y + 0.5 - r, dist = Math.hypot(dx, dy), dentro = r - dist;
      let fx = 0, fy = 0;
      if (dentro < banda && dist > 0) { const t = 1 - Math.max(0, dentro) / banda, k = t * t; fx = (dx / dist) * k; fy = (dy / dist) * k; }
      const i = (y * w + x) * 4; d.data[i] = 128 + fx * 127; d.data[i + 1] = 128 + fy * 127; d.data[i + 2] = 128; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    im.setAttribute('width', w); im.setAttribute('height', h); im.setAttribute('href', c.toDataURL());
    html.classList.add('con-mapa');
  };

  // 7. solo en las capturas (?cap=1) de la mezcla: el cristal de las dos cápsulas de la cabecera, en dos elementos
  //    sueltos puestos justo detrás, alargados hasta 60 px por donde hay pantalla y recortados a la forma de la cápsula
  let capsulas = null;
  const capsulasCaptura = () => {
    if (!html.classList.contains('maq-captura') || !html.classList.contains('dM')) return;
    const liga = document.querySelector('.sup-liga'), btns = document.querySelector('.sup-btns'); if (!liga || !btns) return;
    if (!capsulas) capsulas = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'maq-capsula'; document.body.append(d); return d; });
    const a = liga.getBoundingClientRect(), b = btns.getBoundingClientRect(), W = window.innerWidth;
    // cuánto se sale cada cápsula de su caja lo dice el propio CSS (cambia con el ancho de la pantalla)
    const caja = (el, r) => { const c = getComputedStyle(el, '::before'), n = (v) => parseFloat(v) || 0; return [r.left + n(c.left), r.top + n(c.top), r.right - n(c.right), r.bottom - n(c.bottom)]; };
    [caja(liga, a), caja(btns, b)].forEach(([x0, y0, x1, y1], i) => {
      const iz = Math.min(60, Math.max(0, x0)), de = Math.min(60, Math.max(0, W - x1)), ar = Math.min(60, Math.max(0, y0)), ab = 60;
      capsulas[i].style.cssText = `left:${x0 - iz}px;top:${y0 - ar}px;width:${x1 - x0 + iz + de}px;height:${y1 - y0 + ar + ab}px;clip-path:inset(${ar}px ${de}px ${ab}px ${iz}px round 25px)`;
    });
  };

  let pte = false;
  const todo = () => { pte = false; pildoras(); hojas(); vigilarNav(); mapa(); capsulasCaptura(); };
  const pedir = () => { if (!pte) { pte = true; requestAnimationFrame(todo); } };
  new MutationObserver(pedir).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('maq-capa', () => { pedir(); barra(); });
  window.addEventListener('resize', () => { pedir(); barra(); });
}

/* =====================================================================================================================
   FUERA: el marco, con el selector de dirección y de pantalla debajo de la app
   ===================================================================================================================== */
function fuera() {
  let dir = (Q.get('d') || 'M').toUpperCase(), pant = Q.get('p') || 'hoy', y = Q.get('y') === '1';
  const op = { top: Q.get('top') === '1', sc: Q.get('sc') === '1', n2: Q.get('n') === '2', tx: Q.get('tx') || '', w: Q.get('w') || '', tc: Q.get('tc') === '1', inv: Q.get('inv') === '1' };
  const marco = document.getElementById('marco');
  const dirDe = () => `?dentro=1&d=${dir}&p=${pant}${y ? '&y=1' : ''}${op.top ? '&top=1' : ''}${op.sc ? '&sc=1' : ''}${op.n2 ? '&n=2' : ''}${op.tx ? `&tx=${op.tx}` : ''}${op.tc ? '&tc=1' : ''}${op.inv ? '&inv=1' : ''}`;
  marco.innerHTML = `
    <div class="mq-movil"><div class="mq-pant"><iframe id="mq-app" title="La app con la dirección elegida" src="maqueta-liquid.html${dirDe()}"></iframe>
      <div class="mq-teclado" aria-hidden="true">${teclado()}</div></div></div>
    <div class="mq-sel" id="mq-sel"></div>`;
  const fr = document.getElementById('mq-app');
  const manda = (m) => fr.contentWindow && fr.contentWindow.postMessage(m, '*');
  const b = (attr, k, t, on) => `<button data-${attr}="${k}" aria-pressed="${on}">${t}</button>`;
  function pintar() {
    document.getElementById('mq-sel').innerHTML = `
      <div class="mq-fila"><b>Dirección</b>${DIRS.map(([k, t]) => b('d', k, t, dir === k)).join('')}</div>
      <div class="mq-fila"><b>Pantalla</b>${PANTS.map(([k, t]) => b('p', k, t, pant === k)).join('')}</div>
      <div class="mq-fila"><b>Ver</b>${b('o', 'y', 'Desplazada', y)}${b('o', 'inv', 'Invitar dentro de Ajustes', op.inv)}${b('o', 'tc', 'Títulos condensados (mezcla)', op.tc)}${b('o', 'top', 'Funciones top abiertas', op.top)}${b('o', 'sc', 'Sin cristal', op.sc)}${b('o', 'n2', 'Refracción (solo Android)', op.n2)}${b('o', 'tx', 'Texto al 160 %', op.tx === '160')}
        <span class="mq-anchos">${['320', '360', '', '430'].map((w) => b('w', w, w || '390', op.w === w)).join('')}</span>
        <a class="mq-entera" href="maqueta-liquid.html${dirDe()}">Pantalla completa ↗</a></div>`;
    history.replaceState(null, '', `?d=${dir}&p=${pant}${y ? '&y=1' : ''}${op.top ? '&top=1' : ''}${op.sc ? '&sc=1' : ''}${op.n2 ? '&n=2' : ''}${op.tx ? `&tx=${op.tx}` : ''}${op.tc ? '&tc=1' : ''}${op.inv ? '&inv=1' : ''}${op.w ? `&w=${op.w}` : ''}`);
    marco.classList.toggle('con-teclado', pant === 'pregunta');
    marco.style.setProperty('--mq-w', `${op.w || 390}px`);
    marco.dataset.w = op.w || '390';
  }
  document.getElementById('mq-sel').addEventListener('click', (e) => {
    const x = e.target.closest('button'); if (!x) return;
    const d = x.dataset;
    if (d.d) { dir = d.d; manda({ maq: 'dir', d: dir }); }
    if (d.p) { pant = d.p; manda({ maq: 'ver', p: pant, y: pant === 'barra' ? 1 : (y ? 1 : 0) }); }
    if (d.w != null && 'w' in d) op.w = d.w;
    if (d.o === 'y') { y = !y; manda({ maq: 'ver', p: pant, y: y ? 1 : 0 }); }
    if (d.o === 'inv') { op.inv = !op.inv; manda({ maq: 'clase', c: 'inv-aj', si: op.inv }); }
    if (d.o === 'tc') { op.tc = !op.tc; manda({ maq: 'clase', c: 'tit-c', si: op.tc }); }
    if (d.o === 'sc') { op.sc = !op.sc; manda({ maq: 'clase', c: 'sin-cristal', si: op.sc }); }
    if (d.o === 'n2') { op.n2 = !op.n2; manda({ maq: 'clase', c: 'nivel-2', si: op.n2 }); }
    if (d.o === 'tx') { op.tx = op.tx ? '' : '160'; manda({ maq: 'texto', v: op.tx }); }
    if (d.o === 'top') { op.top = !op.top; pintar(); fr.src = `maqueta-liquid.html${dirDe()}`; return; } // hay que volver a leer limites.json
    pintar();
  });
  pintar();
}
function teclado() {
  const fila = (s) => `<div>${[...s].map((c) => `<i>${c}</i>`).join('')}</div>`;
  return `${fila('qwertyuiop')}${fila('asdfghjklñ')}<div><i class="an">⇧</i>${[...'zxcvbnm'].map((c) => `<i>${c}</i>`).join('')}<i class="an">⌫</i></div><div><i class="an">123</i><i class="esp">espacio</i><i class="an">intro</i></div>`;
}
