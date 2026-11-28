// (0.9, 27 nov) Lo que se mueve del diseño «Liquid» y el CSS no puede hacer solo. No sabe nada de la liga ni decide nada:
// solo pone clases en <html> y medidas en variables, para la sección «0.9 · EL REDISEÑO LIQUID» del final de app.css.
//   · al desplazarse: html.desplazada (el apagado de detrás de la cabecera), .nav-min en la barra de abajo (se encoge al
//     bajar y vuelve al subir, arriba del todo o al tocarla) y html.tabs-pegada (el selector, pegado bajo la cabecera).
//     En cada fotograma solo se lee el scroll; nada se mide ahí, y las clases que pone esto no vuelven a lanzar nada
//   · html.escribiendo: el teclado en pantalla en Pregunta (la barra se aparta y la caja baja hasta el teclado)
//   · la píldora que se desliza en los selectores de sección al cambiar de pestaña dentro de uno (.tabs-in.con-pil)
//   · las hojas: .hoja-media (flota con margen, de cristal) o .hoja-entera (opaca, pegada a los bordes) y .hoja-baja
//   · la barra de abajo cuando una etiqueta no cabe (html.nav-justa: la etiqueta, solo en la pestaña activa)
//   · la cápsula de la liga: si tus puntos, o tu puesto, no caben al lado del estado, se quitan (el estado manda)
//   · html.sin-cristal en un móvil flojo. No hay ajuste: el cristal es automático siempre (Carlos, 27 nov, 14:05)
// La cabecera NO se recoge al bajar (Carlos, 27 nov, 13:21): no proponerlo.
const html = document.documentElement;
const movil = () => !html.classList.contains('escritorio');
const quieto = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** un móvil flojo no pinta bien el desenfoque: ahí, el nivel opaco. Provisional (sin medir en móviles de verdad): 2 GB o
 * menos de memoria, que es lo único que dice el navegador (solo Chromium). `fm-cristal` = no | si lo fuerza (para probar). */
export function cristalDe(nav = navigator, guardado = null) {
  if (guardado === 'no') return false;
  if (guardado === 'si') return true;
  return !(nav && nav.deviceMemory && nav.deviceMemory <= 2);
}
/** para el Diagnóstico: cómo va el cristal en este dispositivo */
export function cristalTxt() {
  const sin = html.classList.contains('sin-cristal');
  const sinFiltro = typeof CSS !== 'undefined' && CSS.supports && !(CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  const rt = typeof matchMedia === 'function' && (matchMedia('(prefers-reduced-transparency: reduce)').matches || matchMedia('(prefers-contrast: more)').matches);
  // (Safari y la app del iPhone no dicen si está puesto «Reducir transparencia»: ahí solo se quita con «Aumentar contraste»)
  return `${sin ? 'apagado (móvil justo)' : sinFiltro ? 'apagado (el navegador no lo pinta)' : rt ? 'apagado (lo pide el sistema)' : 'sí'} · memoria ${navigator.deviceMemory || '?'} GB · ${navigator.hardwareConcurrency || '?'} núcleos`;
}

/** el diseño nuevo es el de la app por dentro (la liga, la carga, el error): la portada y la entrada se quedan como están
 * (regla del encargo: «ni portada ni páginas públicas»). La clase `lq` de <html> la pone y la quita esto, nunca index.html:
 * así el texto que trae la página antes de que arranque la app tampoco la lleva */
const dentro = () => !document.querySelector('#app > .portada, #app .sin-js');

let puesto = false;
export function iniciarLiquid() {
  if (puesto || typeof window === 'undefined') return;
  puesto = true;
  html.classList.toggle('lq', dentro());
  let guardado = null;
  try { guardado = localStorage.getItem('fm-cristal'); } catch (e) { /* nada */ }
  html.classList.toggle('sin-cristal', !cristalDe(navigator, guardado));

  // ---- 1. al desplazarse. En cada fotograma solo se lee window.scrollY: dónde se pega el selector se mide una vez por
  //         repintado (`medirTabs`, abajo), no aquí (medir en cada fotograma costaba el doble de hilo principal) ----
  let y0 = 0, acum = 0, mudo = 0, tabsY = -1;
  const dAncla = new Map();
  const medirTabs = () => {
    const t = movil() && document.querySelector('#vista .tabs'), sp = document.querySelector('.sup');
    if (!t || !sp) { tabsY = -1; return; }
    // a qué scroll queda el selector pegado bajo la cabecera: su sitio en la página menos el alto de la cabecera. OJO: el
    // selector es `sticky` y, ya pegado, su offsetTop es el del sitio donde está pegado, no el suyo (medido así, al subir
    // la clase iba y venía en cada fotograma y el selector parpadeaba). Sin pegar se mide tal cual, y se apunta a cuánto
    // queda del ancla de alto 0 que lleva delante (.tabs-ancla, la de `volverAPestanas`), que no se pega; pegado, su
    // sitio es el del ancla más eso (de esa pantalla; si aún no se ha visto sin pegar, su margen)
    const a = t.previousElementSibling && t.previousElementSibling.classList.contains('tabs-ancla') ? t.previousElementSibling : null;
    const alto = sp.offsetHeight, y = t.offsetTop - alto, act = document.querySelector('.nav-in button.activo'), clave = (act && act.dataset.ir) || '';
    if (y > Math.max(0, window.scrollY) + 1) { tabsY = Math.max(0, y); if (a) dAncla.set(clave, t.offsetTop - a.offsetTop); return; }
    if (a) tabsY = Math.max(0, a.offsetTop + (dAncla.has(clave) ? dAncla.get(clave) : parseFloat(getComputedStyle(t).marginTop) || 0) - alto);
    else if (tabsY < 0) tabsY = Math.max(0, y);
  };
  // (.nav-min y .nav-anim van en la barra, no en <html>: así el navegador solo vuelve a mirar la barra)
  let navEl = null;
  const encoger = (si) => {
    if (!navEl || !navEl.isConnected) navEl = document.querySelector('.nav');
    if (!navEl || navEl.classList.contains('nav-min') === si) return;
    navEl.classList.add('nav-anim'); // desde ahora, el cambio de tamaño de la barra se anima (solo transform)
    navEl.classList.toggle('nav-min', si);
    if (html.classList.contains('nav-justa')) { gota(); setTimeout(gota, 440); }
  };
  const mirar = () => {
    const y = Math.max(0, window.scrollY);
    html.classList.toggle('desplazada', y > 6);
    html.classList.toggle('tabs-pegada', tabsY >= 0 && y > 6 && y >= tabsY - 1);
    const d = y - y0; y0 = y;
    if (y < 40 || !movil()) { encoger(false); acum = 0; return; }
    // un salto de golpe (la app baja sola al final del chat, o vuelve arriba) y lo que se mueve justo al cambiar de
    // pantalla no es bajar con el dedo
    if (Math.abs(d) > 300 || performance.now() < mudo) { acum = 0; return; }
    acum = (Math.sign(d) === Math.sign(acum) ? acum : 0) + d;
    if (acum > 28) encoger(true);
    else if (acum < -18) encoger(false);
  };
  // (el navegador ya manda este aviso una vez por fotograma como mucho: se mira ahí mismo, sin pedir otro turno)
  window.addEventListener('scroll', mirar, { passive: true });

  // ---- 2. escribiendo en Pregunta: la barra se aparta SOLO con el teclado en pantalla (con el cursor en la caja pero sin
  //         teclado —Android al cerrarlo con «Atrás», un teclado físico— la barra se queda). El teclado se nota en que
  //         lo que se ve mide bastante menos que la ventana de siempre con ese ancho ----
  let altoBase = 0, anchoBase = 0;
  const altoVisto = () => Math.min(window.innerHeight, window.visualViewport ? window.visualViewport.height : window.innerHeight);
  const escribe = () => {
    if (window.innerWidth !== anchoBase) { anchoBase = window.innerWidth; altoBase = 0; }
    const a = altoVisto();
    if (a > altoBase) altoBase = a;
    const enCaja = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.escribe'));
    html.classList.toggle('escribiendo', enCaja && a < altoBase - 120);
  };
  document.addEventListener('focusin', escribe);
  document.addEventListener('focusout', () => setTimeout(escribe, 0));
  window.addEventListener('resize', escribe);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', escribe);
  escribe();

  // ---- 3. la gota de la barra: al tocar una pestaña la barra vuelve a su tamaño y la gota se estira hacia donde va ----
  document.addEventListener('click', (e) => {
    const ir = e.target.closest && e.target.closest('[data-ir]');
    if (!ir) return;
    // al cambiar de pantalla la barra vuelve a su tamaño, y lo que la página se mueva sola al pintarse no la encoge
    encoger(false); acum = 0; mudo = performance.now() + 700;
    const b = ir.closest('.nav [data-ir]');
    if (!b) return;
    if (!movil() || html.classList.contains('nav-justa') || quieto()) return;
    const bs = [...b.parentNode.children], de = bs.findIndex((x) => x.classList.contains('activo')), a = bs.indexOf(b);
    if (de < 0 || a === de || !b.parentNode.animate) return;
    const x0 = de * 100, x1 = a * 100, largo = 1 + Math.min(1.2, Math.abs(a - de) * 0.5);
    try {
      b.parentNode.animate([
        { transform: `translateX(${x0}%) scaleX(1)` },
        { transform: `translateX(${(x0 + x1) / 2}%) scaleX(${largo})`, offset: 0.45 },
        { transform: `translateX(${x1}%) scaleX(1)` },
      ], { duration: 420, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', pseudoElement: '::before' });
    } catch (x) { /* sin animación de pseudoelementos: la transición del CSS */ }
  }, true);

  // ---- 4. la píldora de los selectores. La pestaña activa ya lleva su lente con el CSS; la píldora (.con-pil) solo
  //         hace falta para deslizarse cuando cambias de pestaña DENTRO de un selector: la app repinta la vista entera,
  //         así que se recuerda cuál era la activa de cada selector y la píldora va desde su sitio hasta el de la nueva.
  //         Así, al cambiar de pestaña de abajo (lo más corriente) no se mide nada ----
  const activa = new Map();
  const idDe = (b) => b.dataset.seg || b.dataset.filtro || b.textContent.trim();
  const pildoras = () => {
    for (const t of document.querySelectorAll('.tabs-in')) {
      const act = t.querySelector('button.activo');
      if (!act) continue;
      const id = idDe(act), clave = `${id.split(':')[0]}|${t.children.length}|${t.closest('.hoja') ? 'h' : 'v'}`;
      const antes = activa.get(clave);
      activa.set(clave, id);
      if (t.dataset.pil === id) continue;
      t.dataset.pil = id;
      if (!antes || antes === id || quieto()) { t.classList.remove('con-pil'); continue; }
      const de = [...t.children].find((b) => idDe(b) === antes);
      if (!de) { t.classList.remove('con-pil'); continue; }
      t.classList.toggle('pil-oro', act.classList.contains('tab-oro'));
      t.style.setProperty('--px', `${de.offsetLeft}px`); t.style.setProperty('--pw', `${de.offsetWidth}px`);
      t.classList.add('con-pil', 'pil-quieta'); void t.offsetWidth; t.classList.remove('pil-quieta');
      t.style.setProperty('--px', `${act.offsetLeft}px`); t.style.setProperty('--pw', `${act.offsetWidth}px`);
    }
  };
  // si cambia el ancho o llega la letra, la píldora medida ya no vale: vuelve la lente del CSS
  const sinPildoras = () => { for (const t of document.querySelectorAll('.tabs-in.con-pil')) t.classList.remove('con-pil'); };

  // ---- 5. las hojas ----
  const clasificar = (h) => {
    if (h.classList.contains('arrastrando')) return;
    const alto = window.innerHeight, era = h.classList.contains('hoja-media') ? 'm' : h.classList.contains('hoja-entera') ? 'e' : '';
    // con un margen entre los dos cortes, para que una hoja que crece un poco al cargar no vaya y venga
    const media = movil() && h.scrollHeight < alto * (era === 'm' ? 0.68 : 0.6);
    h.classList.toggle('hoja-media', media); h.classList.toggle('hoja-entera', !media);
  };
  const hojas = () => {
    const hs = document.querySelectorAll('.hoja');
    for (const h of hs) {
      if (!h.dataset.lq) {
        h.dataset.lq = '1';
        h.addEventListener('scroll', () => h.classList.toggle('hoja-baja', h.scrollTop > 6), { passive: true });
      }
      clasificar(h);
    }
    html.classList.toggle('con-hoja', hs.length > 0);
  };

  // ---- 6. la barra de abajo: si alguna etiqueta no cabe en su pestaña, la etiqueta solo en la activa (nunca texto
  //         cortado). Se mide con una sonda aparte, con la misma letra, para no depender de cómo esté la barra ----
  let sonda = null, navVista = null;
  const gota = () => {
    const nav = document.querySelector('.nav-in'), act = nav && nav.querySelector('button.activo');
    if (!act || !html.classList.contains('nav-justa')) return;
    nav.style.setProperty('--gx', `${act.offsetLeft}px`); nav.style.setProperty('--gw', `${act.offsetWidth}px`);
  };
  const barra = () => {
    const nav = document.querySelector('.nav-in');
    if (!nav || !movil()) { html.classList.remove('nav-justa'); return; }
    if (!sonda) { sonda = document.createElement('span'); sonda.setAttribute('aria-hidden', 'true'); sonda.style.cssText = "position:absolute;left:-999px;top:0;visibility:hidden;white-space:nowrap;font:600 11px/1.1 'Barlow',sans-serif"; document.body.append(sonda); }
    let mayor = 0;
    for (const b of nav.querySelectorAll('button')) {
      const t = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!t) continue;
      sonda.textContent = t.textContent.trim(); mayor = Math.max(mayor, sonda.getBoundingClientRect().width);
    }
    const hueco = (Math.min(window.innerWidth - 20, 460) - 10) / 6;
    html.classList.toggle('nav-justa', mayor > hueco - 4);
    gota();
  };
  // qué pestaña es la activa: la gota se coloca con --i (y data-i, para que sin pestaña activa, en Pregunta, no se vea)
  const indice = () => {
    const nav = navVista; if (!nav) return;
    const i = [...nav.children].findIndex((b) => b.classList.contains('activo'));
    if (i < 0) { if (nav.dataset.i != null) delete nav.dataset.i; return; }
    if (nav.dataset.i !== String(i)) { nav.dataset.i = String(i); nav.style.setProperty('--i', String(i)); }
  };
  const vigilarNav = () => {
    const nav = document.querySelector('.nav-in');
    if (!nav || nav === navVista) return;
    navVista = nav;
    new MutationObserver(() => { indice(); requestAnimationFrame(() => { gota(); setTimeout(gota, 60); }); }).observe(nav, { attributes: true, attributeFilter: ['class'], subtree: true });
    indice();
    barra();
  };

  // ---- 7. la cápsula de la liga: el estado («Actualizando…») manda. Si tus puntos no caben a su lado se quitan; si el
  //         nombre se queda sin sitio (la letra del sistema muy grande), se quita el puesto; y solo si ni así cabe el
  //         estado (320 px con «Sin actualizar · 13:20»), se acorta ----
  let cabeAntes = '';
  const cabecera = () => {
    const liga = document.querySelector('.sup-liga'), sup = document.querySelector('.sup');
    if (!liga || !sup || !movil()) { if (cabeAntes) { cabeAntes = ''; html.classList.remove('sin-pts', 'sin-pos', 'est-corta'); } return; }
    const pos = liga.querySelector('.sup-pos:not([hidden])'), pts = liga.querySelector('.sup-pts:not([hidden])'), est = liga.querySelector('#supEstado');
    // (la clave no lee medidas: si no ha cambiado el texto ni el ancho, no se mide nada)
    const clave = `${window.innerWidth}|${est ? est.textContent : ''}|${pos ? pos.textContent : ''}|${pts ? pts.textContent : ''}|${liga.querySelector('#supLiga') ? liga.querySelector('#supLiga').textContent : ''}`;
    if (clave === cabeAntes) return;
    cabeAntes = clave;
    html.classList.remove('sin-pts', 'sin-pos', 'est-corta');
    if (est) est.style.removeProperty('--est-f');
    if (pts && est && est.getBoundingClientRect().right + 8 > pts.getBoundingClientRect().left) html.classList.add('sin-pts');
    // (con la letra del móvil grande ni solo cabía: «Actualizand…») antes de cortarlo, la letra del estado se achica
    // hasta que quepa entero, como mucho a la mitad; solo si ni así cabe, se corta. El tamaño va con --est-f, que multiplica
    // la letra del texto (.sup-tx, que lleva la suya: ponérsela a #supEstado no hacía nada) sea cual sea el agrandado
    const sobra = () => (est ? est.getBoundingClientRect().right - liga.getBoundingClientRect().right : 0);
    const tx = est && est.querySelector('.sup-tx');
    // (el tope: la mitad, y nunca por debajo de unos 10,5 px de letra)
    const fMin = tx ? Math.max(0.5, 10.5 / (parseFloat(getComputedStyle(tx).fontSize) || 14)) : 1;
    for (let f = 1, v = 0; tx && v < 3 && sobra() > 0.5 && f > fMin; v++) {
      const ancho = tx.getBoundingClientRect().width, hueco = ancho - sobra() - 1;
      if (!(ancho > 0) || !(hueco > 0)) break;
      f = Math.max(fMin, Math.floor(f * Math.min(0.98, hueco / ancho) * 100) / 100);
      est.style.setProperty('--est-f', String(f));
    }
    if (sup.scrollWidth > sup.clientWidth + 1 || sobra() > 1) html.classList.add('est-corta');
    const nom = liga.querySelector('#supLiga b');
    if (pos && nom && nom.clientWidth < nom.scrollWidth * 0.6) html.classList.add('sin-pos');
  };

  let pte = false;
  const todo = () => { pte = false; try { html.classList.toggle('lq', dentro()); medirTabs(); pildoras(); hojas(); vigilarNav(); cabecera(); mirar(); } catch (e) { /* lo de adorno no rompe nada */ } };
  const pedir = () => { if (!pte) { pte = true; requestAnimationFrame(todo); } };
  new MutationObserver(pedir).observe(document.body, { childList: true, subtree: true, characterData: true });
  // lo que cambie en <html> desde fuera (el ancho de ordenador, sin fotos, el alto de la cabecera) también cuenta, pero NO
  // las clases que pone esto mismo: con ellas dentro, cada clase puesta al desplazar lanzaba otra vez todo lo de arriba
  const MIAS = new Set(['lq', 'sin-cristal', 'desplazada', 'tabs-pegada', 'escribiendo', 'con-hoja', 'nav-justa', 'sin-pts', 'sin-pos', 'est-corta']);
  const firmaDe = () => `${[...html.classList].filter((c) => !MIAS.has(c)).join(' ')}|${html.getAttribute('style') || ''}`;
  let firma = firmaDe();
  new MutationObserver(() => { const f = firmaDe(); if (f === firma) return; firma = f; pedir(); }).observe(html, { attributes: true, attributeFilter: ['class', 'style'] });
  const otraVez = () => { sinPildoras(); cabeAntes = ''; pedir(); barra(); };
  window.addEventListener('resize', otraVez);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(otraVez).catch(() => {});
  pedir();
}

/* ---- 8. (0.9b, 28 nov) el movimiento al cambiar de pantalla: cada cosa entra desde el lado al que vas (Carlos: «como de
 *         hacia la derecha, hacia la izquierda… o arriba, abajo»). La app repinta la vista entera con innerHTML, así que no
 *         hay «pantalla de antes» que sacar: se anima la ENTRADA de lo recién pintado, un desplazamiento corto con fundido,
 *         en UN elemento (la vista entera, o lo de debajo del selector) y solo transform y opacity. Lo nuevo se puede tocar
 *         desde el primer fotograma y un toque a mitad cancela lo que está en marcha. Con «reducir movimiento», nada.
 *         (Las View Transitions, que sí sacan la de antes, se descartaron: medido en claude/sesion-28nov-animaciones.md.)
 *         `fm-anim` = largo: más recorrido, para comparar en los vídeos ---- */
let vivas = [];
const largo = () => { try { return localStorage.getItem('fm-anim') === 'largo'; } catch (e) { return false; } };
/** desde: de dónde llega lo nuevo: 'der', 'izq', 'arriba' o 'abajo' */
export function entra(el, desde) {
  if (!el || !el.animate || quieto() || !desde) return null;
  parar();
  const lado = desde === 'der' || desde === 'izq', s = desde === 'izq' || desde === 'arriba' ? -1 : 1;
  const d = largo() ? (lado ? Math.round(Math.min(window.innerWidth, 520) * 0.32) : 80) : lado ? 36 : 28;
  const t = lado ? `translate3d(${s * d}px, 0, 0)` : `translate3d(0, ${s * d}px, 0)`;
  try {
    const a = el.animate([{ transform: t, opacity: 0 }, { opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
      { duration: largo() ? 340 : 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    vivas.push(a);
    // (mientras entra, el cristal del selector que va dentro, sin desenfoque: nada de desenfoque en lo que se mueve)
    el.classList.add('entrando');
    a.onfinish = a.oncancel = () => { vivas = vivas.filter((x) => x !== a); if (!vivas.some((x) => x.effect && x.effect.target === el)) el.classList.remove('entrando'); };
    return a;
  } catch (e) { return null; }
}
/** un toque a mitad: lo que se estaba moviendo acaba ya (en su sitio) */
export function parar() { const l = vivas; vivas = []; for (const a of l) { try { a.cancel(); } catch (e) { /* nada */ } } }
/** mete en una caja lo que va detrás de `desde` dentro de `padre` (o todo, sin `desde`), salvo lo que case con `fuera`
 *  (la caja del chat, que es fixed: con un antepasado movido dejaría de estarlo). Se hace justo después del innerHTML,
 *  antes de que el navegador lo coloque: no cuesta nada */
export function envolver(padre, desde = null, fuera = '') {
  if (!padre) return null;
  const caja = document.createElement('div'); caja.className = 'mueve';
  let ir = !desde;
  const mover = [];
  for (const n of [...padre.childNodes]) {
    if (n === desde) { ir = true; continue; }
    if (!ir) continue;
    if (fuera && n.nodeType === 1 && n.matches(fuera)) continue;
    mover.push(n);
  }
  if (!mover.length) return null;
  padre.insertBefore(caja, mover[0]);
  caja.append(...mover);
  return caja;
}
/** en un selector de sección, hacia dónde queda la pestaña `b` respecto a la activa */
export function ladoTabs(b) {
  const t = b && b.closest && b.closest('.tabs-in');
  if (!t) return null;
  const bs = [...t.children], de = bs.findIndex((x) => x.classList.contains('activo')), a = bs.indexOf(b);
  if (de < 0 || a < 0 || a === de) return null;
  return a > de ? 'der' : 'izq';
}
