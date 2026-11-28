/* Las novedades contadas bajando. Arriba, el número de versión como un marcador de estadio que se monta al abrir;
   después, cada cosa nueva o arreglada entra con el scroll: su cromo llega girando desde un lado, el título sube
   palabra a palabra y detrás el texto. El brillo del fondo toma el color de cada una (los de las posiciones). */
import { esc, LOGO, LOGO_P } from './util.js';
import { NOVEDADES, cmpVer } from './version.js';
import { DIBUJOS } from './dibujos.js';

const ACENTOS = ['#ee1c3c', '#ffc547', '#58a6ff', '#2fd18f'];
const TIPOS = { nuevo: 'Nuevo', mejora: 'Mejora', arreglo: 'Arreglado' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function fechaNov(n) {
  if (!n || !n.f) return '';
  const d = new Date(`${n.f}T12:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${n.h ? `, ${n.h}` : ''}`;
}
const cuenta = (n, a) => [n ? `${n} novedad${n > 1 ? 'es' : ''}` : '', a ? `${a} ${a > 1 ? 'correcciones' : 'corrección'}` : ''].filter(Boolean).join(' · ');

/* Lo que ve cada uno (app.js pone los dos filtros). Lo nuevo y las mejoras, cada una en su cromo: el dueño, todo; los
   demás, solo lo que les cambia algo (sin lo «menor» ni lo de otra versión de la app). Los arreglos, para todos, al final
   en una lista numerada, como las notas de una actualización de un videojuego (lo pidió Carlos el 25 oct). Las
   versiones que se quedan sin nada no salen. */
let filtro = () => true, filtroArr = () => true;
export function fijarFiltroNovedades(f, fa) { filtro = f || (() => true); filtroArr = fa || filtro; }
// (si a una versión se le quita algo, su título pasa a ser el de lo primero que queda: el suyo podía hablar de lo quitado)
const visibles = () => NOVEDADES.map((n) => {
  const todas = n.cosas || [];
  const cosas = todas.filter((c) => c.tipo !== 'arreglo' && filtro(c));
  const arreglos = todas.filter((c) => c.tipo === 'arreglo' && filtroArr(c));
  const t = cosas.length ? (todas[0] === cosas[0] ? n.t : cosas[0].t) : arreglos.length ? (todas[0] === arreglos[0] ? n.t : arreglos[0].t) : n.t;
  return { ...n, cosas, arreglos, t };
}).filter((n) => n.cosas.length || n.arreglos.length);
/** ¿hay algo nuevo que contar desde esa versión? (solo arreglos no abren la presentación: se juntan para la siguiente) */
export const hayNovedadesDesde = (desde) => visibles().some((n) => (!desde || cmpVer(n.v, desde) > 0) && n.cosas.length);

/** las versiones que no has visto (si no hay ninguna, la última con algo para ti) */
export function versionesDesde(desde, solo = null) {
  // solo: (20 nov) nada más que esas versiones (a quien no es el dueño, las que Carlos ha dicho que se presenten)
  const V = solo ? visibles().filter((n) => solo.includes(n.v)) : visibles();
  const l = V.filter((n) => desde && cmpVer(n.v, desde) > 0);
  return l.length ? l : V.slice(0, 1);
}

let abierta = null;
/** para el botón de atrás de Android: si está abierta, la cierra */
export function cerrarPresentacion() {
  if (!abierta) return false;
  abierta();
  return true;
}

/**
 * Abre la presentación. desde: la última versión que viste (salen las posteriores).
 * alIr(ir) lleva a donde está una novedad; alLista() abre la lista entera; alCerrar(), al terminar.
 */
export function presentarNovedades(desde, { alIr = () => {}, alLista = null, alCerrar = () => {}, solo = null } = {}) {
  if (abierta) abierta(true);
  const quieta = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nuevas = versionesDesde(desde, solo);
  if (!nuevas.length) { alCerrar(); return; }
  const todas = [], arreglos = [];
  for (const n of nuevas) { for (const c of n.cosas || []) todas.push({ ...c, v: n.v }); for (const c of n.arreglos || []) arreglos.push({ ...c, v: n.v }); }
  // si te has perdido muchas, solo lo principal: lo nuevo (de lo más reciente a lo más viejo) y, si falta, las mejoras;
  // lo demás, en la lista de versiones (los arreglos van todos al final, numerados)
  const MAX = 6, PRINCIPALES = 5;
  let cosas = todas, resto = 0;
  if (todas.length > MAX) {
    cosas = [...todas.filter((c) => !c.tipo || c.tipo === 'nuevo'), ...todas.filter((c) => c.tipo === 'mejora')].slice(0, PRINCIPALES);
    if (!cosas.length) cosas = todas.slice(0, PRINCIPALES);
    resto = todas.length - cosas.length;
  }
  const n0 = nuevas[0], ver = n0.v.replace(/\.0$/, '');
  // casillas y puntos del marcador: el CSS ajusta el tamaño para que el número quepa a lo ancho (0.6.10e, 0.7.2a…)
  const casillas = [...ver].filter((ch) => ch !== '.').length, puntos = [...ver].length - casillas;
  const raiz = document.createElement('div');
  raiz.className = `nv${quieta ? ' quieta' : ''}`;
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', `Novedades de la ${n0.v}`);
  raiz.innerHTML = `<div class="nv-luz" aria-hidden="true"></div><div class="nv-barra" aria-hidden="true"></div>
    <div class="nv-cab">${LOGO_P}<b>Fantasy Manager</b><button type="button" data-nv="fin">Saltar</button></div>
    <div class="nv-scroll" tabindex="-1">
      <section class="nv-heroe"><div class="nv-heroe-in">
        <p class="nv-eti">${nuevas.length > 1 ? `${resto ? 'Lo principal' : 'Lo que te has perdido'} desde la ${esc(desde)}` : 'Lo nuevo'}</p>
        <h1 class="nv-num" style="--n:${casillas};--p:${puntos}" aria-label="Versión ${esc(n0.v)}">${[...ver].map((ch, i) => (ch === '.' ? '<span class="pt" aria-hidden="true"></span>' : `<span class="dg" style="--i:${i}" aria-hidden="true">${esc(ch)}</span>`)).join('')}</h1>
        <div class="nv-lema"><h2>${esc(n0.t)}</h2><p>${esc(fechaNov(n0))} · ${esc(cuenta(todas.length, arreglos.length))}${resto ? ` en ${nuevas.length} versiones: te cuento las ${cosas.length} principales` : ''}</p></div>
        <div class="nv-baja" aria-hidden="true"><span>Desliza</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
      </div></section>
      ${cosas.map((c, k) => `<section class="nv-cap" data-lado="${k % 2 ? 'd' : 'i'}" style="--acc:${ACENTOS[k % ACENTOS.length]}">
        <div class="nv-cromo"><svg class="dib" viewBox="0 0 160 120" aria-hidden="true">${DIBUJOS[c.d] || DIBUJOS.ia}</svg><span class="nv-cromo-pie"><span>${k + 1}/${cosas.length}</span><span>${esc(c.v)}</span></span></div>
        <div class="nv-txt">
          <span class="nv-tipo ${esc(c.tipo || 'nuevo')}">${esc(TIPOS[c.tipo] || 'Nuevo')}</span>
          <h2 aria-label="${esc(c.t)}">${c.t.split(' ').map((w) => `<span aria-hidden="true">${esc(w)}</span>`).join(' ')}</h2>
          <p>${esc(c.x || '')}</p>
          ${c.ir ? `<button type="button" class="btn chico" data-nv-ir="${k}">${esc(c.ir.txt || 'Verlo')}</button>` : ''}
        </div>
      </section>`).join('')}
      ${arreglos.length ? `<section class="nv-notas">
        <p class="nv-eti">Notas de la actualización</p>
        <h2>Correcciones</h2>
        <ol>${arreglos.map((c) => `<li><b>${esc(c.t)}${tagNov(c)}</b>${c.x ? `<span>${esc(c.x)}</span>` : ''}${nuevas.length > 1 ? `<small>${esc(c.v)}</small>` : ''}</li>`).join('')}</ol>
      </section>` : ''}
      <section class="nv-fin">
        <div class="nv-fin-logo">${LOGO}</div>
        <h2>${resto ? 'Y más' : 'Eso es todo'}</h2>
        <p>${resto ? `Hay ${resto} novedad${resto > 1 ? 'es' : ''} más: están en la lista de versiones.` : 'Si algo no va como esperas, avísame desde Ajustes → Reportar un fallo.'}</p>
        <button type="button" class="btn" data-nv="fin">A mi liga</button>
        ${alLista ? `<button type="button" class="nv-enlace" data-nv="lista">${resto ? 'Ver todo lo que ha cambiado' : 'Ver todas las versiones'}</button>` : ''}
      </section>
    </div>`;
  document.body.appendChild(raiz);
  document.body.classList.add('con-nv');

  const $ = (s) => raiz.querySelector(s), $$ = (s, r = raiz) => [...r.querySelectorAll(s)];
  const sc = $('.nv-scroll'), heroe = $('.nv-heroe'), heroeIn = $('.nv-heroe-in'), barra = $('.nv-barra'), baja = $('.nv-baja');
  const caps = $$('.nv-cap');
  const tramo = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
  const suave = (t) => 1 - Math.pow(1 - t, 3);
  let medidas = null, raf = 0, color = '';
  const medir = () => {
    medidas = {
      vh: sc.clientHeight, alto: heroe.offsetHeight,
      caps: caps.map((c) => ({ c, top: c.offsetTop, h: c.offsetHeight, cromo: $$('.nv-cromo', c)[0], palabras: $$('h2 span', c), resto: $$('.nv-tipo, .nv-txt p, .nv-txt .btn', c), lado: c.dataset.lado === 'd' ? 1 : -1, acc: c.style.getPropertyValue('--acc') })),
    };
  };
  const pinta = () => {
    raf = 0;
    if (!medidas) medir();
    const { vh } = medidas, y = sc.scrollTop, H = sc.scrollHeight - vh;
    barra.style.transform = `scaleX(${H > 0 ? Math.min(1, y / H) : 0})`;
    // el marcador se va hacia arriba al bajar
    const p = quieta ? 0 : tramo(y, 0, medidas.alto * 0.8);
    heroeIn.style.transform = `translateY(${(-p * 90).toFixed(1)}px) scale(${(1 - p * 0.12).toFixed(3)})`;
    heroeIn.style.opacity = (1 - suave(p)).toFixed(3);
    baja.style.opacity = (1 - tramo(y, 0, 60)).toFixed(3);
    let cerca = null;
    for (const m of medidas.caps) {
      const q = quieta ? 0.5 : (y + vh - m.top) / (vh + m.h);
      if (q < -0.1 || q > 1.1) continue;
      // el cromo llega girando desde su lado y se va hacia arriba al pasar
      const e = suave(tramo(q, 0.06, 0.34)), sal = tramo(q, 0.7, 0.96), f = 1 - e;
      m.cromo.style.transform = `translate(${(m.lado * f * 70).toFixed(1)}vw, ${(f * 30 - sal * 70).toFixed(1)}px) rotate(${(m.lado * f * 24 + m.lado * -3 * e).toFixed(2)}deg) scale(${(0.8 + 0.2 * e).toFixed(3)})`;
      m.cromo.style.opacity = (Math.min(1, e * 1.4) * (1 - sal)).toFixed(3);
      m.palabras.forEach((w, k) => {
        const ew = suave(tramo(q, 0.2 + k * 0.03, 0.36 + k * 0.03));
        w.style.transform = `translateY(${((1 - ew) * 0.7 - sal * 0.5).toFixed(3)}em)`;
        w.style.opacity = (ew * (1 - sal)).toFixed(3);
      });
      const er = suave(tramo(q, 0.3, 0.48));
      for (const el of m.resto) { el.style.transform = `translateY(${((1 - er) * 22 - sal * 34).toFixed(1)}px)`; el.style.opacity = (er * (1 - sal)).toFixed(3); }
      if (q > 0.2 && q < 0.8 && (!cerca || Math.abs(q - 0.5) < Math.abs(cerca.q - 0.5))) cerca = { q, acc: m.acc };
    }
    const nuevo = cerca ? cerca.acc : ACENTOS[0];
    if (nuevo !== color) { color = nuevo; raiz.style.setProperty('--nv-acc', color); }
  };
  const pedir = () => { if (!raf) raf = requestAnimationFrame(pinta); };
  const redim = () => { medidas = null; pedir(); };
  sc.addEventListener('scroll', pedir, { passive: true });
  addEventListener('resize', redim);

  const quitar = () => {
    abierta = null;
    raiz.remove();
    document.body.classList.remove('con-nv');
    removeEventListener('resize', redim);
    if (raf) cancelAnimationFrame(raf);
  };
  abierta = (sinAviso) => { quitar(); if (!sinAviso) alCerrar(); };
  raiz.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-nv-ir]');
    if (ir) { const c = cosas[+ir.dataset.nvIr]; quitar(); alCerrar(); alIr(c.ir); return; }
    const b = e.target.closest('[data-nv]');
    if (!b) return;
    if (b.dataset.nv === 'fin') { quitar(); alCerrar(); }
    else if (b.dataset.nv === 'lista' && alLista) { quitar(); alCerrar(); alLista(); }
  });
  pinta();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redim);
  setTimeout(() => sc.focus({ preventScroll: true }), 60);
}

/* (20 nov, Carlos: «que aparezca en la pantalla pero no ocupe toda, y que no diga mucho texto») una novedad corta: una
   tarjeta en el centro, encima de la app, con su dibujo, el título, una línea, una chapita (mas) y un botón. Se cierra con
   «Ahora no», tocando fuera o con el atrás de Android (cerrarPresentacion). a: el «aviso» de una versión de version.js */
/* (0.8.4s; Carlos, 26 nov: «el icono de la Liga Premium… morado» y «pásame varios diseños») los iconos de la tarjeta de
   novedades, uno por cosa (`ico`). El de premium es nuestro (una corona en un cuadro morado), no el logo de LaLiga */
const ICO_NOV = {
  parte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 8l2 2m0-2l-2 2M15 13l2 2m0-2l-2 2"/><path d="M10 9.5c2 0 3 1 4 3" stroke-dasharray="1.5 2"/><path d="M9 21h6"/></svg>',
  premium: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8l4 3 4-6 4 6 4-3-1.6 9H5.6z"/><rect x="5.6" y="18.4" width="12.8" height="1.8" rx=".9"/></svg>',
  origen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>',
  ordenador: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
};
const tagNov = (c) => (c.tag ? ` <em class="nvt-tag">${esc(c.tag)}</em>` : '');
const icoNov = (c) => (c.ico && ICO_NOV[c.ico] ? `<i class="nvt-ico ni-${esc(c.ico)}" aria-hidden="true">${ICO_NOV[c.ico]}</i>` : '');
/** la lista de la tarjeta de novedades (Carlos, 26 nov, 23:07, de tres diseños eligió la lista): una fila por cosa, con su
    icono, el título (y su etiqueta, `tag`) y una línea */
function listaNov(a) {
  return `<ul class="nvt-lista">${a.lista.map((c) => `<li>${icoNov(c)}<div><b>${esc(c.t)}${tagNov(c)}</b>${c.x ? `<span>${esc(c.x)}</span>` : ''}</div></li>`).join('')}</ul>`;
}
/* (0.8.5e; Carlos, 28 nov, 01:15, de cuatro diseños eligió el animado: «que el pop-up en sí sea una animación donde van
   saliendo todos los datos») la tarjeta que cuenta una cuenta: `pasos` (una fila por pieza: el nombre, qué es y su cifra del
   ejemplo, `v`; van entrando una detrás de otra) y `rango` (lo que sale: la cifra cuenta de `desde` a `hasta`, con su ±, y la
   barra de lo que no se sabe, de `de` a `a`, con el punto en la parte alta). Todo por CSS (los retrasos van en `--r`) menos
   la cifra que cuenta; con «reducir movimiento» sale todo puesto */
const numNov = (x) => x.toFixed(1).replace('.', ',');
function pasosNov(a) {
  return `<ol class="nvt-pasos">${a.pasos.map((c, i) => `<li style="--r:${(0.5 + i * 0.6).toFixed(2)}s"><b>${esc(c.c)}${tagNov(c)}</b><span>${esc(c.x)}</span>${c.v ? `<em class="np-v${c.cls ? ` ${esc(c.cls)}` : ''}">${esc(c.v)}</em>` : ''}</li>`).join('')}</ol>`;
}
function rangoNov(a) {
  const r = a.rango, t0 = a.pasos ? 0.5 + a.pasos.length * 0.6 + 0.2 : 0.4;
  return `<div class="nvt-rango" style="--r:${t0.toFixed(2)}s">${r.eti ? `<span class="nr-eti">${esc(r.eti)}</span>` : ''}
    <div class="nr-cifra">≈ <span class="nr-n" data-de="${r.desde != null ? r.desde : r.hasta}" data-a="${r.hasta}">${numNov(r.hasta)}</span> M <i>${esc(r.margen || '')}</i></div>
    <div class="nr-barra" aria-hidden="true"><i></i><b></b></div><div class="nr-pies"><span>${esc(r.de)}</span><span>${esc(r.a)}</span></div></div>`;
}
function contarNov(capa) {
  const n = capa.querySelector('.nr-n');
  if (!n || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const de = Number(n.dataset.de), a = Number(n.dataset.a), caja = capa.querySelector('.nvt-rango');
  if (!(de !== a) || !window.requestAnimationFrame) return;
  const espera = (parseFloat(getComputedStyle(caja).getPropertyValue('--r')) || 0) * 1000 + 250, dura = 900, t0 = performance.now();
  n.textContent = numNov(de);
  const paso = (t) => {
    if (!n.isConnected) return;
    const k = Math.min(1, Math.max(0, (t - t0 - espera) / dura)), s = 1 - (1 - k) ** 3;
    n.textContent = numNov(de + (a - de) * s);
    if (k < 1) window.requestAnimationFrame(paso);
  };
  window.requestAnimationFrame(paso);
}
export function tarjetaNovedad(a, { alIr = () => {}, alCerrar = () => {} } = {}) {
  if (abierta) abierta(true);
  const capa = document.createElement('div');
  capa.className = 'nvt-capa';
  capa.innerHTML = `<div class="nvt-velo" data-nvt="no"></div>
    <div class="nvt${a.lista && a.lista.length ? ' nvt-novs' : ''}${a.pasos ? ' nvt-cuenta' : ''}" role="dialog" aria-modal="true" aria-labelledby="nvt-t">
      <svg class="dib" viewBox="0 0 160 120" aria-hidden="true">${DIBUJOS[a.d] || DIBUJOS.ia}</svg>
      <span class="nvt-eti">${esc(a.eti || 'Nuevo')}</span>
      <h2 id="nvt-t">${esc(a.t)}</h2>
      ${a.x ? `<p>${esc(a.x)}</p>` : ''}
      ${a.lista && a.lista.length ? listaNov(a) : ''}
      ${a.pasos && a.pasos.length ? pasosNov(a) : ''}
      ${a.rango ? rangoNov(a) : ''}
      ${a.mas ? `<span class="nvt-mas">${esc(a.mas)}</span>` : ''}
      ${a.nota ? `<small class="nvt-nota">${esc(a.nota)}</small>` : ''}
      ${a.ir ? `<button type="button" class="btn ancho" data-nvt="ir">${esc(a.ir.txt || 'Verlo')}</button>` : ''}
      <button type="button" class="nvt-no" data-nvt="no">${a.ir ? 'Ahora no' : 'Vale'}</button>
    </div>`;
  const cerrar = (sinAviso) => {
    capa.remove();
    abierta = null;
    if (!sinAviso) alCerrar();
  };
  capa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nvt]');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.nvt === 'ir') { cerrar(true); alIr(a.ir); } else cerrar();
  });
  document.body.append(capa);
  contarNov(capa);
  abierta = cerrar;
  const bt = capa.querySelector('[data-nvt="ir"]') || capa.querySelector('.nvt-no');
  if (bt) bt.focus({ preventScroll: true });
}

/* (0.8.4e; Carlos, 25 nov, 13:00: «un pop-up que diga que por las muchas peticiones se está trabajando en una versión de
   Apple… con el logo de Apple»; a las 13:29 eligió el diseño A, «sin el anillo rojo del logo de Apple y que el logo no esté
   sobre esa circunferencia») La tarjeta de la app para iPhone: la manzana sola, «En camino», el título, el texto de todos,
   la línea de cada plataforma (linea) en la caja dorada y «Entendido». Se cierra con el botón, tocando fuera o con el atrás
   de Android (cerrarPresentacion); cuándo sale lo decide app.js (iphoneToca). apple: el svg de la manzana */
export const TEXTO_IPHONE = 'Me lo habéis pedido muchos y ya estoy con la app para iPhone. Espero tenerla en la App Store lo antes posible.';
export function tarjetaIphone({ apple = '', linea = '', alCerrar = () => {} } = {}) {
  if (abierta) abierta(true);
  const capa = document.createElement('div');
  capa.className = 'nvt-capa';
  capa.innerHTML = `<div class="nvt-velo" data-nvt="no"></div>
    <div class="nvt nvt-ios" role="dialog" aria-modal="true" aria-labelledby="nvt-t">
      <div class="ios-logo">${apple}</div>
      <span class="ios-eti"><i></i>En camino</span>
      <h2 id="nvt-t">Fantasy Manager<br>para iPhone</h2>
      <p>${esc(TEXTO_IPHONE)}</p>
      ${linea ? `<span class="ios-mas">${esc(linea)}</span>` : ''}
      <button type="button" class="ios-ok" data-nvt="no">Entendido</button>
    </div>`;
  const cerrar = (sinAviso) => {
    capa.remove();
    abierta = null;
    if (!sinAviso) alCerrar();
  };
  capa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nvt]');
    if (!b) return;
    e.stopPropagation();
    cerrar();
  });
  document.body.append(capa);
  abierta = cerrar;
  const bt = capa.querySelector('.ios-ok');
  if (bt) bt.focus({ preventScroll: true });
}

/** la lista entera, versión a versión, para la hoja de Novedades de Ajustes */
export function listaNovedades() {
  return visibles().map((n) => `<div class="nvl">
    <div class="nvl-cab"><b>${esc(n.v)}</b><span>${esc(n.t)}</span><small>${esc(fechaNov(n))}</small></div>
    ${(n.cosas || []).map((c) => `<div class="nvl-c"><span class="nv-tipo ${esc(c.tipo || 'nuevo')}">${esc(TIPOS[c.tipo] || 'Nuevo')}</span><div><b>${esc(c.t)}${tagNov(c)}</b>${c.x ? `<p>${esc(c.x)}</p>` : ''}</div></div>`).join('')}
    ${(n.arreglos || []).length ? `<div class="nvl-arr"><span class="nv-tipo arreglo">Correcciones</span><ol>${n.arreglos.map((c) => `<li><b>${esc(c.t)}${tagNov(c)}</b>${c.x ? `<p>${esc(c.x)}</p>` : ''}</li>`).join('')}</ol></div>` : ''}
  </div>`).join('');
}

/* (11 nov, Carlos) Lo importante, para todos: solo lo que lleva importante: true (lo gordo, lo que cambia cómo se usa
   la app), y de eso lo que es de tu versión de la app (filtroArr: sin lo de 'dueño' ni lo de otra plataforma). Sin
   arreglos ni detalles. No se abre sola al actualizar: solo desde Ajustes. */
const importantes = () => NOVEDADES.map((n) => ({ ...n, cosas: (n.cosas || []).filter((c) => c.importante && c.tipo !== 'arreglo' && !c.menor && filtroArr(c)),
  // (11 nov, Carlos) y debajo, en pequeño, los arreglos de esa versión
  arreglos: (n.cosas || []).filter((c) => c.tipo === 'arreglo' && !c.menor && filtroArr(c)) }))
  .filter((n) => n.cosas.length);
export const hayImportantes = () => importantes().length > 0;
/** la última versión con algo importante para ti (para «Nuevo» en Ajustes) */
export const ultimaImportante = () => (importantes()[0] || {}).v || null;
export function listaImportantes() {
  return importantes().map((n) => `<div class="nvl">
    <div class="nvl-cab"><b>${esc(n.v)}</b><small>${esc(fechaNov(n))}</small></div>
    ${n.cosas.map((c) => `<div class="nvl-c"><span class="nv-tipo ${esc(c.tipo || 'nuevo')}">${esc(TIPOS[c.tipo] || 'Nuevo')}</span><div><b>${esc(c.t)}${tagNov(c)}</b>${c.x ? `<p>${esc(c.x)}</p>` : ''}</div></div>`).join('')}
    ${n.arreglos.length ? `<div class="nvl-arreglos"><small>También se ha arreglado</small><ul>${n.arreglos.map((c) => `<li>${esc(c.t)}</li>`).join('')}</ul></div>` : ''}
  </div>`).join('');
}
