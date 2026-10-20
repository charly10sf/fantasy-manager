/* Piezas que se repiten en todas las pantallas: la cara del jugador, su fila, las pastillas de cláusula y estado. */
import { esc, eur, pct, dura, POS, iniciales, estadoDe, icono, clase, cuando } from './util.js';
import { mini } from './graficos.js';

let EQUIPOS = {};
export const ponerEquipos = (m) => { EQUIPOS = m || {}; };

/** la cara del jugador (con sus iniciales detrás por si la foto no carga) y el escudo de su equipo */
export function ava(j, tam = '') {
  const p = j && j.pos ? `p${j.pos}` : '';
  const cara = j && j.img ? `<img class="cara" src="${esc(j.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  const eq = j && EQUIPOS[j.equipoId];
  const esc2 = eq && eq.escudo && tam !== 'm' ? `<img class="esc" src="${esc(eq.escudo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  return `<span class="ava-w"><span class="ava ${p} ${tam}"><span class="ini">${esc(iniciales(j && j.nombre))}</span>${cara}</span>${esc2}</span>`;
}
export const posTag = (j) => (j && j.pos ? `<span class="pos p${j.pos}">${POS[j.pos]}</span>` : '');

export function estadoPill(j) {
  const e = estadoDe(j && j.estado);
  return e ? `<span class="pill ${e.c}">${icono(e.c === 'mal' ? 'lesion' : 'info')}${esc(e.t)}</span>` : '';
}

/** la cláusula: abierta ya, se abre pronto (menos de 24 h) o protegida */
export function clausulaPill(f) {
  if (!f || !f.clausula) return '';
  if (f.abierta) return `<span class="pill abierta">${icono('abierto')}${eur(f.clausula)} abierta</span>`;
  const pronto = f.abreEn < 24 * 3600e3;
  return `<span class="pill ${pronto ? 'pronto' : ''}">${icono('candado')}${eur(f.clausula)} · ${pronto ? cuando(f.protegidoHasta).replace(/^hoy /, '') : dura(f.abreEn)}</span>`;
}

export function delta(t, { largo = false } = {}) {
  if (!t) return '';
  if (t.d1 != null && Math.abs(t.d1) > 0) return `<span class="${clase(t.d1)}">${t.d1 > 0 ? '▲' : '▼'} ${eur(Math.abs(t.d1), { dec: largo ? 2 : 1 })}${largo && t.p1 != null ? ` (${pct(t.p1)})` : ''}</span>`;
  if (t.d7 != null && Math.abs(t.d7) > 0) return `<span class="${clase(t.d7)}">${t.d7 > 0 ? '▲' : '▼'} ${eur(Math.abs(t.d7), { dec: 1 })} <span class="apag">7d</span></span>`;
  return '<span class="apag">=</span>';
}

export const partidoTxt = (p) => (p ? `${p.casa ? 'vs' : 'en'} ${esc(p.rival)} · ${cuando(p.fecha)}` : '');

const ACC = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };
/** la pastilla del plan del día en las listas, si el plan dice algo de este jugador */
export const planPill = (op) => (op ? `<span class="pill plan">${icono('rayo')}${ACC[op.accion] || op.accion} hoy</span>` : '');

/** una fila de jugador. x lleva j (jugador) y opcionalmente tend, cláusula, etc. */
export function filaJugador(x, { sub = null, extra = '', derecha = null, conMini = false, op = null } = {}) {
  const j = x.j;
  const t = x.tend;
  return `<button class="fila" data-j="${esc(j.id)}">
    ${ava(j)}
    <div class="fila-c">
      <div class="fila-n">${posTag(j)}<span>${esc(j.nombre)}</span></div>
      <div class="fila-s">${sub != null ? sub : esc(j.equipo || '')}</div>
      ${extra || op ? `<div class="fila-x">${planPill(op)}${extra}</div>` : ''}
    </div>
    <div class="fila-d">${derecha != null ? derecha : `<div class="v">${eur(j.valor)}</div><div class="d">${delta(t)}</div>${conMini && t ? mini(t.serie, t.d7 != null ? t.d7 >= 0 : t.d1 >= 0) : ''}`}</div>
  </button>`;
}

export const nada = (txt) => `<div class="vacio">${txt}</div>`;

/** si sale de titular en el once probable de su equipo (futbolfantasy) */
export function oncePill(M, j) {
  if (!M || !M.hayOnces || !j || j.pos === 5) return '';
  const o = M.onceProb(j.id);
  if (!o) return '<span class="pill">Fuera del once</span>';
  if (o.titular) return `<span class="pill bien">Titular${o.prob != null ? ` ${o.prob} %` : ''}</span>`;
  return '<span class="pill duda">Suplente</span>';
}

/** un titular de prensa */
export const filaNoticia = (n) => `<button class="noticia" data-abrir="${esc(n.link)}"><span class="tit">${esc(n.titulo)}</span><span class="meta">${esc(n.fuente || '')}${n.t ? ` · ${cuando(n.t)}` : ''}</span></button>`;
