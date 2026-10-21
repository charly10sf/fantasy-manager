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

/* ---------- lo difícil que es el próximo rival ---------- */
const NIV = { 'fácil': 'facil', media: 'media', 'difícil': 'dificil' };
export const nivelCls = (n) => NIV[n] || '';
const corto = (id, nombre) => (EQUIPOS[id] && EQUIPOS[id].corto) || String(nombre || '').slice(0, 3).toUpperCase();

/** «vs Getafe 18º · sáb 16:15», con el rival en verde, ámbar o rojo según lo difícil que es */
export function rivalSub(M, j) {
  const fr = M && M.factorRival ? M.factorRival(j) : null;
  if (!fr || !fr.p) return '';
  return `${fr.p.casa ? 'vs' : 'en'} <span class="niv ${nivelCls(fr.nivel)}">${esc(fr.p.rival)}${fr.r ? ` ${fr.r.pos}º` : ''}</span> · ${cuando(fr.p.fecha)}`;
}

/** los próximos tres partidos de su equipo, cada uno con su color */
/**
 * el calendario de riesgo en la ficha: sus próximos partidos (5, o los de sus 14 días protegido si son más), cada
 * uno con el rival, lo difícil que es para él, los puntos que se esperan y si será titular; y el veredicto
 */
export function calendarioHTML(M, j, mio = false) {
  const c = M && M.calendarioRiesgo ? M.calendarioRiesgo(j) : null;
  if (!c) return '';
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const titulo = c.tipo === 'duro' ? 'Calendario duro' : c.tipo === 'favorable' ? 'Calendario favorable' : 'Calendario normal';
  const riesgo = `<span class="cr-r ${c.riesgo}">Riesgo ${c.riesgo}</span>`;
  const filas = c.partidos.map((p) => `<div class="cr-p ${nivelCls(p.nivel)}">
      <span class="cr-j">J${p.jornada}<small>${esc(cuando(p.fecha, { hora: false }))}</small></span>
      <span class="cr-ri"><b>${p.casa ? 'vs' : 'en'} ${esc(p.rival)}</b><small>${p.pos ? `${p.pos}º · ` : ''}${p.nivel || 'sin datos'}${p.rot ? ` · ${esc(p.rot.join(' y '))} cerca` : ''}</small></span>
      <span class="cr-n"><b>~${d1(p.pts)}</b><small>pts</small></span>
      <span class="cr-n"><b>${p.pTit == null ? '–' : `${Math.round(p.pTit * 100)}%`}</b><small>titular</small></span>
    </div>`).join('');
  const consejo = mio
    ? (c.tipo === 'duro' ? 'Es tuyo: le vienen semanas flojas. No es motivo para venderlo, pero tenlo en cuenta si te llega una buena oferta.' : c.tipo === 'favorable' ? 'Es tuyo: le vienen semanas buenas. No lo vendas barato.' : '')
    : c.consejo;
  return `<div class="cal-riesgo ${c.tipo}">
    <div class="cr-cab"><b>${titulo}</b>${riesgo}</div>
    <p class="cr-txt">${esc(c.texto)}</p>
    <div class="cr-lista">${filas}</div>
    ${consejo ? `<p class="cr-consejo">${esc(consejo)}</p>` : ''}
  </div>`;
}

const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
/**
 * un jugador en el campo, como en el Fantasy: la cara, la placa con el nombre y debajo el dato que toque
 * (puntos esperados, valor o forma) y, arriba, contra quién juega con el color de lo difícil que es
 */
export function cromo(M, j, { modo = 'pp', chico = false, ent = false } = {}) {
  if (!j) return `<button class="cromo vacio-c" data-ir="mercado"><span class="cr-hueco">+</span><span class="cr-nom">Falta</span></button>`;
  const fr = M && M.factorRival ? M.factorRival(j) : null;
  const f = M && M.forma ? M.forma(j.id) : null;
  let dato;
  if (modo === 'valor') dato = eur(j.valor);
  else if (modo === 'forma') dato = f && f.pts.length ? f.pts.slice(-3).join(' · ') : j.media ? `${String(j.media).replace('.', ',')} m` : '–';
  else dato = M && M.ppEsperado && j.pos < 5 ? `${dec1(M.ppEsperado(j))} pts` : j.media ? `${String(j.media).replace('.', ',')} m` : '–';
  const conOnce = !!(M && M.hayOnces && j.pos < 5);
  const o = conOnce ? M.onceProb(j.id) : null;
  let marca = '';
  if (MALOS.has(j.estado)) marca = '<span class="cr-est mal">+</span>';
  else if (j.estado === 'doubtful') marca = '<span class="cr-est duda">?</span>';
  else if (conOnce && (!o || !o.titular)) marca = '<span class="cr-est sup">SUP</span>';
  const rv = fr && fr.p ? `<span class="cr-rv ${nivelCls(fr.nivel)}">${fr.p.casa ? '' : '@'}${esc(corto(fr.p.rivalId, fr.p.rival))}</span>` : '';
  const ape = String(j.nombre || '').split(' ');
  const nom = ape.length > 1 && j.nombre.length > 11 ? ape.slice(1).join(' ') : j.nombre;
  return `<button class="cromo p${j.pos}${chico ? ' chico' : ''}${MALOS.has(j.estado) ? ' baja-c' : ''}" data-j="${esc(j.id)}">
    <span class="cr-foto">${ava(j, 'cr')}${rv}${marca}</span>
    <span class="cr-nom">${ent ? '<i>ENT</i>' : ''}${esc(nom)}</span>
    <span class="cr-dato">${dato}</span></button>`;
}

const ACC = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };
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

/** el calendario de sus próximos partidos, solo si es duro o favorable */
export function calPill(M, j) {
  const c = M && M.calendarioRiesgo && j && j.pos < 5 ? M.calendarioRiesgo(j) : null;
  if (!c || c.tipo === 'normal') return '';
  return `<span class="pill ${c.tipo === 'duro' ? 'mal' : 'bien'}" title="${esc(c.texto)}">${c.tipo === 'duro' ? 'Calendario duro' : 'Calendario favorable'}</span>`;
}

/** un titular de prensa */
export const filaNoticia = (n) => `<button class="noticia" data-abrir="${esc(n.link)}"><span class="tit">${esc(n.titulo)}</span><span class="meta">${esc(n.fuente || '')}${n.t ? ` · ${cuando(n.t)}` : ''}</span></button>`;

/** el dinero de un rival en corto: «12,3 M» si es exacto, «≈ 8,1 M» si es estimado */
export const dineroCorto = (d) => (!d || d.v == null ? '' : d.exacto ? eur(d.v) : `≈ ${eur(d.v)}`);
/** y en largo, con de dónde sale */
export function dineroLargo(d) {
  if (!d) return 'No se sabe: LaLiga no lo da y aún no hay movimientos guardados.';
  if (d.v == null) return `No se sabe todavía: LaLiga no lo da y para calcularlo ${d.motivo || 'faltan datos'}.`;
  if (d.exacto) return `${eur(d.v)}, exacto (${d.fuente === 'API' ? 'lo da LaLiga' : `de ${d.fuente}`}).`;
  if (d.dicho) return `Unos ${eur(d.v)} (± ${eur(d.margen)}). Te dijo que tenía ${d.dicho.min === d.dicho.max ? eur(d.dicho.v) : `entre ${eur(d.dicho.min)} y ${eur(d.dicho.max)}`} ${cuando(d.dicho.t)}${d.desdeDicho ? ` y desde entonces ha movido ${eur(d.desdeDicho, { signo: true })}` : ' y no ha movido nada desde entonces'}.`;
  const c = d.cuenta;
  return `Unos ${eur(d.v)} (± ${eur(d.margen)}). LaLiga no lo da: sale de sus movimientos desde el principio. Empezasteis con lo mismo (${c ? eur(c.base) : '100 M'} contando las recompensas diarias), ${c ? `y lo que ha comprado, vendido, cobrado y ganado por jornada le deja en ${eur(c.mov, { signo: true })}` : 'más lo que ha vendido y cobrado, menos lo que ha comprado'}${c && c.subidas ? `; además se ha gastado unos ${eur(c.subidas)} en subir ${c.nSubidas} cláusula${c.nSubidas === 1 ? '' : 's'} (se ve en su plantilla)` : ''}. La recompensa diaria no sale en ningún sitio, por eso el margen.${d.fiable === 'media' ? '' : ' Tómalo con cuidado.'}`;
}
