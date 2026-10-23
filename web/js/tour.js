/* El tutorial: recorre la app de verdad, con un foco sobre cada cosa y una tarjeta al lado que dice para qué sirve
   (como el de GrowFolio). El foco se desliza de una cosa a otra; la tarjeta va debajo o encima, donde quepa sin taparla.
   Se pasa con Siguiente, deslizando la tarjeta o con las flechas; Esc o la X lo cierran. Al final, lo que conviene
   hacer para empezar. Sale una vez a todos y está siempre en Ajustes. */
import { esc, icono, LS, LOGO } from './util.js';

const MARGEN = 6, HUECO = 12;
let T = null;

export const tourAbierto = () => !!T;
/** ¿se ha visto ya (o se saltó)? */
export const tourVisto = () => !!LS.get('tour', null);

/**
 * opts: pasos (de pasosTour), ir(vista), vista() (la pestaña de ahora), alAcabar(como) con como = 'fin' | 'saltar' |
 * una acción de la lista del final ('clave', 'avisos', 'plan', 'cuenta').
 */
export function empezarTour(opts) {
  cerrarTour(null);
  const capa = document.createElement('div');
  capa.className = 'tour';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-label', 'Tutorial de la app');
  capa.innerHTML = '<div class="tour-foco sin"></div><div class="tour-caja" tabindex="-1" aria-live="polite"></div>';
  document.body.appendChild(capa);
  document.body.classList.add('en-tour');
  const colocar = () => colocarTour();
  const tecla = (e) => {
    if (!T) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarTour('saltar'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
  };
  window.addEventListener('resize', colocar);
  window.addEventListener('scroll', colocar, true);
  document.addEventListener('keydown', tecla, true);
  // solo cuentan los pasos que se pueden enseñar ahora (el de tus minutos, solo si tienes límite…)
  const pasos = opts.pasos.filter((p) => !p.si || p.si());
  T = { capa, i: 0, pasos, opts, n: 0, el: null, raf: 0, quitar: () => { window.removeEventListener('resize', colocar); window.removeEventListener('scroll', colocar, true); document.removeEventListener('keydown', tecla, true); } };
  // deslizar la tarjeta pasa de paso
  let x0 = null, y0 = null;
  capa.addEventListener('touchstart', (e) => { if (!e.target.closest('.tour-caja')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  capa.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) mover(dx < 0 ? 1 : -1);
  }, { passive: true });
  capa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const a = b.dataset.t;
    if (a === 'sig') mover(1);
    else if (a === 'ant') mover(-1);
    else if (a === 'saltar') cerrarTour('saltar');
    else if (a === 'fin') cerrarTour('fin');
    else if (a.startsWith('emp:')) cerrarTour(a.slice(4));
  });
  pintarPaso(1);
}

/** cierra el tutorial (como: 'fin', 'saltar' o una acción del final; null, sin avisar a nadie). Devuelve si estaba abierto */
export function cerrarTour(como = 'saltar') {
  if (!T) return false;
  const { opts } = T;
  cancelAnimationFrame(T.raf);
  T.quitar();
  T.capa.remove();
  T = null;
  document.body.classList.remove('en-tour');
  if (como) {
    LS.set('tour', Date.now());
    if (opts.alAcabar) opts.alAcabar(como);
  }
  return true;
}

function mover(d) {
  if (!T) return;
  const n = T.i + d;
  if (n < 0) return;
  if (n >= T.pasos.length) { cerrarTour('fin'); return; }
  T.i = n;
  pintarPaso(d);
}

const visible = (sel) => {
  if (!sel) return null;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
};

function pintarPaso(dir) {
  const { pasos, opts } = T;
  const p = pasos[T.i], ultimo = T.i === pasos.length - 1;
  const cambia = p.v && opts.vista() !== p.v;
  if (cambia) opts.ir(p.v);
  const caja = T.capa.querySelector('.tour-caja');
  const x = typeof p.x === 'function' ? p.x() : p.x;
  const lista = p.lista ? p.lista() : null;
  const pendientes = lista ? lista.filter((y) => !y.ok) : [];
  caja.innerHTML = `<button type="button" class="tour-x" data-t="saltar" aria-label="Cerrar el tutorial">${icono('cerrar')}</button>
    <div class="tour-prog" aria-hidden="true">${pasos.map((_, k) => `<i class="${k === T.i ? 'on' : k < T.i ? 'ya' : ''}"></i>`).join('')}</div>
    <div class="tour-txt ${dir < 0 ? 'entra-i' : 'entra-d'}">${p.logo ? `<div class="tour-logo">${LOGO}</div>` : ''}<h3>${esc(p.t)}</h3><p>${esc(x)}</p>
      ${lista ? `<ol class="tour-lista">${lista.map((y) => `<li class="${y.ok ? 'ok' : ''}"><span class="tl-ic">${icono(y.ok ? 'ok' : y.ic || 'flecha')}</span><span class="tl-t"><b>${esc(y.t)}</b>${y.ok ? '<small>Hecho</small>' : `<small>${esc(y.x)}</small>`}</span>${y.ok ? '' : `<button type="button" class="btn chico${y === pendientes[0] ? '' : ' sec'}" data-t="emp:${esc(y.k)}">${esc(y.b)}</button>`}</li>`).join('')}</ol>` : ''}</div>
    <div class="tour-btns"><small class="tour-n">${T.i + 1} de ${pasos.length}</small>
      ${T.i ? '<button type="button" class="btn chico sec" data-t="ant">Atrás</button>' : '<button type="button" class="btn chico sec" data-t="saltar">Saltar</button>'}
      ${ultimo ? `<button type="button" class="btn chico${pendientes.length ? ' sec' : ''}" data-t="${p.finAccion ? `emp:${p.finAccion}` : 'fin'}">${esc(p.fin || 'Terminar')}</button>` : `<button type="button" class="btn chico" data-t="sig">${T.i ? 'Siguiente' : 'Empezar'}</button>`}</div>`;
  const n = ++T.n;
  const buscar = () => {
    if (!T || T.n !== n) return;
    const el = p.sel ? visible(p.sel) : null;
    T.el = el;
    if (el) encuadrar(el, p);
    seguir(700);
    caja.focus({ preventScroll: true });
  };
  // al cambiar de pestaña, se espera a que esté pintada
  if (cambia) setTimeout(buscar, 260); else buscar();
}

/** los bordes útiles: lo resaltado se ve entre la cabecera y la barra de abajo (salvo que esté en ellas) */
function bordes(el) {
  const sup = document.querySelector('.sup'), nav = document.querySelector('.nav');
  const escritorio = document.documentElement.classList.contains('escritorio');
  const enFijo = !!((sup && sup.contains(el)) || (nav && nav.contains(el)));
  const enNav = !!(nav && nav.contains(el)) && !escritorio;
  const arriba = escritorio || enFijo || !sup ? 0 : Math.max(0, sup.getBoundingClientRect().bottom);
  const barra = !escritorio && nav ? nav.getBoundingClientRect().top : innerHeight;
  return { fijo: enFijo, nav: enNav, arriba, abajo: enNav ? innerHeight : barra, techo: 12, suelo: barra - 12 };
}

/** el recuadro de lo resaltado (puede ser dos cosas juntas: la cabecera del plan y su titular) */
function rect(el, p) {
  const r = el.getBoundingClientRect();
  const o = p && p.con ? [].concat(p.con).map(visible).find(Boolean) : null;
  if (!o) return r;
  const q = o.getBoundingClientRect();
  const left = Math.min(r.left, q.left), top = Math.min(r.top, q.top), right = Math.max(r.right, q.right), bottom = Math.max(r.bottom, q.bottom);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** mueve la página lo justo para ver lo resaltado con sitio para la tarjeta */
function encuadrar(el, p) {
  const B = bordes(el);
  if (B.fijo) return;
  const r = rect(el, p), caja = T.capa.querySelector('.tour-caja');
  const hc = caja.offsetHeight, alto = r.height + 2 * MARGEN;
  const sitio = B.suelo - B.arriba - HUECO;
  // si caben los dos, lo resaltado arriba y la tarjeta debajo; si no, lo resaltado desde arriba y la tarjeta encima de su parte baja
  const objetivo = B.arriba + 14;
  const dy = r.top - MARGEN - objetivo;
  if (Math.abs(dy) > 4 || alto + hc > sitio) window.scrollTo({ top: Math.max(0, scrollY + dy), behavior: 'smooth' });
}

/** durante un rato, el foco y la tarjeta siguen a lo resaltado cada fotograma (mientras la página se desliza) */
function seguir(ms) {
  if (!T) return;
  const hasta = performance.now() + ms;
  cancelAnimationFrame(T.raf);
  const f = () => { if (!T) return; colocarTour(); if (performance.now() < hasta) T.raf = requestAnimationFrame(f); };
  f();
}

function colocarTour() {
  if (!T) return;
  const foco = T.capa.querySelector('.tour-foco'), caja = T.capa.querySelector('.tour-caja');
  const p = T.pasos[T.i] || {};
  let el = T.el;
  if (el && !el.isConnected) el = T.el = visible(p.sel);
  const hc = caja.offsetHeight, cw = caja.offsetWidth, dw = document.documentElement.clientWidth;
  if (!el) {
    // nada que señalar: el foco se cierra en el centro y la tarjeta va en medio de la pantalla
    if (!foco.classList.contains('sin')) {
      const f = foco.getBoundingClientRect();
      foco.style.cssText = `left:${f.left + f.width / 2}px;top:${f.top + f.height / 2}px;width:0;height:0`;
      foco.classList.add('sin');
    }
    caja.classList.add('centro');
    caja.style.left = `${Math.round((dw - cw) / 2)}px`;
    caja.style.top = `${Math.max(16, Math.round((innerHeight - hc) / 2))}px`;
    return;
  }
  const r = rect(el, p), B = bordes(el);
  let ft = B.fijo ? r.top - MARGEN : Math.max(r.top - MARGEN, B.arriba + 2);
  let fb = B.fijo ? r.bottom + MARGEN : Math.min(r.bottom + MARGEN, B.abajo - 2);
  ft = Math.max(1, ft); fb = Math.min(innerHeight - 1, fb);
  if (fb < ft + 24) fb = ft + 24;
  // la tarjeta, donde quepa entera sin pisar lo resaltado: debajo si está arriba, encima si está abajo
  const da = ft - HUECO - B.techo, db = B.suelo - (fb + HUECO);
  const prefAbajo = (ft + fb) / 2 < innerHeight / 2;
  const cabeB = db >= hc, cabeA = da >= hc;
  const abajo = cabeB && cabeA ? prefAbajo : cabeB || (!cabeA && !B.nav);
  let top;
  if (abajo) { top = fb + HUECO; if (top + hc > B.suelo) { top = Math.max(B.techo, B.suelo - hc); fb = Math.max(ft + 24, top - HUECO); } }
  else { top = ft - HUECO - hc; if (top < B.techo) { top = B.techo; ft = Math.min(fb - 24, top + hc + HUECO); } }
  foco.classList.remove('sin');
  foco.style.cssText = `left:${(r.left - MARGEN).toFixed(1)}px;top:${ft.toFixed(1)}px;width:${(r.width + 2 * MARGEN).toFixed(1)}px;height:${(fb - ft).toFixed(1)}px`;
  caja.classList.remove('centro');
  caja.classList.toggle('abajo', abajo);
  caja.classList.toggle('arriba', !abajo);
  caja.style.top = `${Math.round(top)}px`;
  // en pantallas anchas, la tarjeta se acerca a lo resaltado; la flechita apunta a su centro
  const mg = Math.min(16, (dw - cw) / 2);
  const cl = Math.max(mg, Math.min(dw - cw - mg, r.left + r.width / 2 - cw / 2));
  caja.style.left = `${cl.toFixed(1)}px`;
  caja.style.setProperty('--fx', `${Math.max(22, Math.min(cw - 22, r.left + r.width / 2 - cl)).toFixed(0)}px`);
}
