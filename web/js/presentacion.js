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
export function versionesDesde(desde) {
  const V = visibles();
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
export function presentarNovedades(desde, { alIr = () => {}, alLista = () => {}, alCerrar = () => {} } = {}) {
  if (abierta) abierta(true);
  const quieta = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nuevas = versionesDesde(desde);
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
        <h1 class="nv-num" aria-label="Versión ${esc(n0.v)}">${[...ver].map((ch, i) => (ch === '.' ? '<span class="pt" aria-hidden="true"></span>' : `<span class="dg" style="--i:${i}" aria-hidden="true">${esc(ch)}</span>`)).join('')}</h1>
        <div class="nv-lema"><h2>${esc(n0.t)}</h2><p>${esc(fechaNov(n0))} · ${esc(cuenta(todas.length, arreglos.length))}${resto ? ` en ${nuevas.length} versiones: te cuento las ${cosas.length} principales` : ''}</p></div>
        <div class="nv-baja" aria-hidden="true"><span>Desliza</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
      </div></section>
      ${cosas.map((c, k) => `<section class="nv-cap" data-lado="${k % 2 ? 'd' : 'i'}" style="--acc:${ACENTOS[k % ACENTOS.length]}">
        <div class="nv-cromo"><svg class="dib" viewBox="0 0 160 120" aria-hidden="true">${DIBUJOS[c.d] || DIBUJOS.ia}</svg><span class="nv-cromo-pie"><span>${k + 1}/${cosas.length}</span><span>${esc(c.v)}</span></span></div>
        <div class="nv-txt">
          <span class="nv-tipo ${esc(c.tipo || 'nuevo')}">${esc(TIPOS[c.tipo] || 'Nuevo')}</span>
          <h2 aria-label="${esc(c.t)}">${c.t.split(' ').map((w) => `<span aria-hidden="true">${esc(w)}</span>`).join(' ')}</h2>
          <p>${esc(c.x || '')}</p>
          ${c.ir ? `<button type="button" class="btn chico" data-nv-ir="${k}">Verlo</button>` : ''}
        </div>
      </section>`).join('')}
      ${arreglos.length ? `<section class="nv-notas">
        <p class="nv-eti">Notas de la actualización</p>
        <h2>Correcciones</h2>
        <ol>${arreglos.map((c) => `<li><b>${esc(c.t)}</b>${c.x ? `<span>${esc(c.x)}</span>` : ''}${nuevas.length > 1 ? `<small>${esc(c.v)}</small>` : ''}</li>`).join('')}</ol>
      </section>` : ''}
      <section class="nv-fin">
        <div class="nv-fin-logo">${LOGO}</div>
        <h2>${resto ? 'Y más' : 'Eso es todo'}</h2>
        <p>${resto ? `Hay ${resto} novedad${resto > 1 ? 'es' : ''} más: están en la lista de versiones.` : 'Si algo no va como esperas, avísame desde Ajustes → Reportar un fallo.'}</p>
        <button type="button" class="btn" data-nv="fin">A mi liga</button>
        <button type="button" class="nv-enlace" data-nv="lista">${resto ? 'Ver todo lo que ha cambiado' : 'Ver todas las versiones'}</button>
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
    else if (b.dataset.nv === 'lista') { quitar(); alCerrar(); alLista(); }
  });
  pinta();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redim);
  setTimeout(() => sc.focus({ preventScroll: true }), 60);
}

/** la lista entera, versión a versión, para la hoja de Novedades de Ajustes */
export function listaNovedades() {
  return visibles().map((n) => `<div class="nvl">
    <div class="nvl-cab"><b>${esc(n.v)}</b><span>${esc(n.t)}</span><small>${esc(fechaNov(n))}</small></div>
    ${(n.cosas || []).map((c) => `<div class="nvl-c"><span class="nv-tipo ${esc(c.tipo || 'nuevo')}">${esc(TIPOS[c.tipo] || 'Nuevo')}</span><div><b>${esc(c.t)}</b>${c.x ? `<p>${esc(c.x)}</p>` : ''}</div></div>`).join('')}
    ${(n.arreglos || []).length ? `<div class="nvl-arr"><span class="nv-tipo arreglo">Correcciones</span><ol>${n.arreglos.map((c) => `<li><b>${esc(c.t)}</b>${c.x ? `<p>${esc(c.x)}</p>` : ''}</li>`).join('')}</ol></div>` : ''}
  </div>`).join('');
}
