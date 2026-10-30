/* Piezas que se repiten en todas las pantallas: la cara del jugador, su fila, las pastillas de cláusula y estado. */
import { esc, eur, pct, dura, POS, iniciales, estadoDe, icono, clase, cuando, norm, esWebFantasy } from './util.js';
import { mini } from './graficos.js';
import { topConAnuncio, POR_JORNADA, usosQuedan, usosPorJornada, minutosPorVez } from './limite.js';
import { esFav } from './favoritos.js';

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
/* ---------- los colores de cada club (su ficha, su fila en Clubes, su camiseta y el brillo detrás de la cara de sus jugadores) ----------
   [clave del nombre (sin tildes), color 1, color 2, dibujo de la camiseta, color 3 opcional]. El 1 es el de la camiseta;
   el 2, el de las rayas, la franja o los detalles; el 3, un toque (pantalón o ribete). Dibujos: liso, rayas (verticales),
   franja (horizontal), banda (diagonal) y aros. Revisados el 30 oct (Carlos: «el Madrid es blanco y morado, no blanco y
   amarillo»). El orden importa: va la primera clave que salga en el nombre («alaves» antes que «deportivo», que el
   Alavés es «Deportivo Alavés»). Los que no estén, sin colores. */
const COLORES = [
  ['real madrid', '#FFFFFF', '#5E2B97', 'liso'], ['barcelona', '#A50044', '#004D98', 'rayas'], ['atletico', '#CB3524', '#FFFFFF', 'rayas', '#272E61'],
  ['athletic', '#EE2523', '#FFFFFF', 'rayas', '#111111'], ['real sociedad', '#0067B1', '#FFFFFF', 'rayas'], ['betis', '#00954C', '#FFFFFF', 'rayas'],
  ['sevilla', '#FFFFFF', '#D81E05', 'liso'], ['valencia', '#FFFFFF', '#111111', 'liso', '#F18E00'], ['villarreal', '#FFE135', '#005187', 'liso'],
  ['celta', '#8AC3EE', '#FFFFFF', 'liso', '#E1261C'], ['espanyol', '#007FC8', '#FFFFFF', 'rayas'], ['getafe', '#005999', '#FFFFFF', 'liso'],
  ['girona', '#CD2534', '#FFFFFF', 'rayas'], ['levante', '#B4053F', '#005B9E', 'rayas'], ['mallorca', '#E20613', '#111111', 'liso'],
  ['osasuna', '#D91A21', '#0A346F', 'liso'], ['alaves', '#0057B8', '#FFFFFF', 'rayas'], ['elche', '#FFFFFF', '#05642C', 'franja'],
  ['rayo', '#FFFFFF', '#E53027', 'banda'], ['oviedo', '#0047AB', '#FFFFFF', 'liso'], ['las palmas', '#FFE400', '#0057A8', 'liso'],
  ['valladolid', '#FFFFFF', '#6A1B7E', 'rayas'], ['leganes', '#0B4DA2', '#FFFFFF', 'rayas'], ['deportivo', '#00529F', '#FFFFFF', 'rayas'],
  ['racing', '#00843D', '#FFFFFF', 'liso'], ['zaragoza', '#FFFFFF', '#1C3F94', 'liso'], ['sporting', '#D2001F', '#FFFFFF', 'rayas'],
  ['malaga', '#3EA7E0', '#FFFFFF', 'rayas'], ['almeria', '#EE1119', '#FFFFFF', 'rayas'], ['granada', '#C8102E', '#FFFFFF', 'aros'],
  ['cadiz', '#FDE100', '#0045A5', 'liso'], ['eibar', '#A6192E', '#003DA5', 'rayas'], ['huesca', '#A6192E', '#003DA5', 'rayas'],
  ['tenerife', '#FFFFFF', '#004A99', 'liso'], ['cordoba', '#00965E', '#FFFFFF', 'rayas'], ['mirandes', '#D10A11', '#111111', 'liso'],
  ['burgos', '#FFFFFF', '#111111', 'liso'], ['castellon', '#111111', '#FFFFFF', 'rayas'],
];
const luz = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const colorCache = {};
/** los colores de un club: { c1, c2, c3, dibujo, vivo, brillo, suave, tenue } (vivo: el primero que no sea casi blanco ni
    casi negro, para los brillos sobre el fondo oscuro) o null */
export function coloresClub(id, nombre = '') {
  const k = `${id}|${nombre}`;
  if (k in colorCache) return colorCache[k];
  const n = ` ${norm(nombre || (EQUIPOS[id] && EQUIPOS[id].nombre) || '')} `;
  const f = COLORES.find(([clave]) => n.includes(` ${clave} `) || n.includes(` ${clave}`));
  if (!f) return (colorCache[k] = null);
  const [, c1, c2, dibujo = 'liso', c3 = null] = f;
  const vivo = [c1, c2, c3].filter(Boolean).find((c) => { const l = luz(c); return l < 0.8 && l > 0.1; }) || null;
  return (colorCache[k] = {
    c1, c2, c3: c3 || c2, dibujo, vivo,
    brillo: vivo ? rgba(vivo, 0.45) : 'rgba(255,255,255,0.14)',
    suave: vivo ? rgba(vivo, 0.24) : 'rgba(255,255,255,0.08)',
    tenue: vivo ? rgba(vivo, 0.13) : 'rgba(255,255,255,0.05)',
  });
}
/** el atributo style con los colores del club (vacío si no se conocen) */
export const estiloClub = (id, nombre) => { const c = coloresClub(id, nombre); return c ? ` style="--c1:${c.c1};--c2:${c.c2};--c3:${c.c3};--cb:${c.brillo};--cs:${c.suave};--ct:${c.tenue}"` : ''; };

/** la camiseta del club dibujada con sus colores (SVG; vacío si no se conocen) */
let svgN = 0;
const CAMISETA = 'M13 4 5 9 2 17l6 2.4 1-3.6V36h22V15.8l1 3.6 6-2.4-3-8-8-5c-1.6 3-12.4 3-14 0Z';
export function camisetaClub(id, nombre = '', cls = '') {
  const c = coloresClub(id, nombre);
  if (!c) return '';
  const k = `cm${++svgN}`;
  const borde = luz(c.c1) > 0.85 || luz(c.c1) < 0.08 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  let dib = '';
  if (c.dibujo === 'rayas') dib = [10.5, 18, 25.5].map((x) => `<rect x="${x}" y="0" width="4" height="40" fill="${c.c2}"/>`).join('');
  else if (c.dibujo === 'franja') dib = `<rect x="0" y="16" width="40" height="7" fill="${c.c2}"/>`;
  else if (c.dibujo === 'banda') dib = `<path d="M9 7h6l17 29h-6Z" fill="${c.c2}"/>`;
  else if (c.dibujo === 'aros') dib = [11, 19, 27].map((y) => `<rect x="0" y="${y}" width="40" height="4" fill="${c.c2}"/>`).join('');
  // el cuello y los puños, del color 2 (o del 3, si las rayas ya son del 2)
  const ribete = c.dibujo === 'liso' ? c.c2 : c.c3;
  return `<svg class="camiseta ${cls}" viewBox="0 0 40 40" aria-hidden="true"><defs><clipPath id="${k}"><path d="${CAMISETA}"/></clipPath></defs><g clip-path="url(#${k})"><rect width="40" height="40" fill="${c.c1}"/>${dib}<path d="M2 17l6 2.4 .8-3M38 17l-6 2.4-.8-3" stroke="${ribete}" stroke-width="2.4" fill="none"/></g><path d="M13 4c1.6 3 12.4 3 14 0" stroke="${ribete}" stroke-width="2.2" fill="none"/><path d="${CAMISETA}" fill="none" stroke="${borde}" stroke-width="1"/></svg>`;
}

/** la cara de un mánager de tu liga: su foto o el escudo de su equipo si los ha puesto en LaLiga Fantasy; si no, sus
    iniciales en un color fijo para cada uno */
export function caraManager(e, tam = '') {
  if (!e) return '';
  const quien = e.manager || e.nombre || '';
  let k = 0;
  for (const c of String(e.teamId || quien)) k = (k * 31 + c.charCodeAt(0)) % 100003;
  const n = Math.round((k * 137.508) % 360);
  const img = e.avatar || e.escudo;
  return `<span class="cara-m ${tam}" style="--h:${n}"><span class="ini">${esc(iniciales(quien))}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="${e.avatar ? 'foto' : 'escudo'}" onerror="this.remove()">` : ''}</span>`;
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
  if (f.escudo) return `<span class="pill pronto">${icono('escudo')}Blindado · ${cuando(f.escudo).replace(/^hoy /, '')}</span>`;
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
/** los últimos enfrentamientos con un rival: V, E o D, de la más vieja a la más nueva (con el marcador al pasar por encima) */
/** la racha de un equipo: sus últimos partidos como bolitas (V verde, E amarilla, D roja; la de la derecha, la última) */
export function rachaHTML(r, quien = '') {
  if (!r || !r.ult || !r.ult.length) return '';
  const dice = r.ult.map((x) => ({ V: 'ganó', E: 'empató', D: 'perdió' }[x.r] || x.r) + (x.gf != null ? ` ${x.gf}-${x.gc}` : '')).join(', ');
  return `<span class="racha" role="img" aria-label="${esc(`${quien ? `${quien}, ` : ''}últimos ${r.ult.length}: ${dice}`)}" title="${esc(dice)}">${r.ult.map((x) => `<i class="r-${esc(x.r)}">${esc(x.r)}</i>`).join('')}</span>`;
}
export function h2hHTML(h2h, rival = '') {
  if (!h2h || !h2h.length) return '';
  const fecha = (e) => (e.t ? new Date(e.t).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) : `J${e.jornada || '?'}`);
  const txt = h2h.map((e) => `${e.r === 'V' ? 'ganó' : e.r === 'E' ? 'empató' : 'perdió'} ${e.gf}-${e.gc} ${e.casa ? 'en casa' : 'fuera'} (${e.comp || 'LaLiga'}, ${fecha(e)})`).join('; ');
  return `<span class="cr-h2h" title="${esc(txt)}" aria-label="${esc(`Últimas veces contra ${rival}: ${txt}`)}">${h2h.map((e) => `<i class="h-${e.r}">${e.r}</i>`).join('')}</span>`;
}

/**
 * el calendario de riesgo en la ficha: sus próximos partidos (5, o los de sus 14 días protegido si son más), cada
 * uno con el rival, lo difícil que es para él, los puntos que se esperan y si será titular; y el veredicto
 */
export function calendarioHTML(M, j, mio = false) {
  const c = M && M.calendarioRiesgo ? M.calendarioRiesgo(j) : null;
  if (!c) return '';
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const titulo = c.tipo === 'duro' ? 'Calendario duro' : c.tipo === 'favorable' ? 'Calendario favorable' : 'Calendario normal';
  // el riesgo es el de ficharlo: con los tuyos no pinta nada
  const riesgo = mio ? '' : `<span class="cr-r ${c.riesgo}">Riesgo ${c.riesgo}</span>`;
  // cada rival, con cómo llega (sus últimos partidos); arriba, cómo llega su equipo
  // dos líneas por partido: el rival con sus puntos y su titularidad; debajo, su puesto y nivel y, a la derecha, cómo llega
  const filas = c.partidos.map((p) => `<${p.rivalId ? `button data-club="${esc(p.rivalId)}"` : 'div'} class="cr-p ${nivelCls(p.nivel)}">
      <span class="cr-j">J${p.jornada}<small>${p.sinFecha ? 'sin fecha' : esc(cuando(p.fecha, { hora: false }))}</small></span>
      <b class="cr-rv2">${p.casa ? 'vs' : 'en'} ${esc(p.rival)}</b>
      <span class="cr-pt"><b>~${d1(p.pts)}</b> pts</span>
      <span class="cr-ti"><b>${p.pTit == null ? '–' : `${Math.round(p.pTit * 100)}%`}</b> tit.</span>
      <small class="cr-nv">${p.pos ? `${p.pos}º · ` : ''}${p.nivel || 'sin datos'}${p.rot ? ` · ${esc(p.rot.join(' y '))} cerca` : ''}</small>
      <span class="cr-ra">${M.racha ? rachaHTML(M.racha(p.rivalId), p.rival) : ''}</span>
    </${p.rivalId ? 'button' : 'div'}>`).join('');
  // con los tuyos, el calendario no decide la venta: si está bajando (o a punto de girar), manda la venta
  let consejo = c.consejo;
  if (mio) {
    const vi = M.ventaPorInercia ? M.ventaPorInercia(j.id) : null;
    const ine = M.inercia ? M.inercia(j.id) : null;
    // tras un partidazo (10 o más) la venta no manda: lo normal es que suba estos días
    const pz = M.partidazo ? M.partidazo(j.id) : null;
    const poco = !vi && ine && (ine.fase === 'giro' || ine.fase === 'baja') && !(pz && pz.nivel >= 3) ? Math.max(0, -ine.proyJ) : null;
    const baja = vi ? (vi.urgencia === 'ya' ? 'está bajando de valor' : 'está a punto de girar a la baja') : '';
    const pierde = vi && vi.perder > 0 ? ` (hasta la jornada, unos ${eur(vi.perder)} menos)` : '';
    if (M.enVenta && M.enVenta.has(j.id)) consejo = `Lo tienes en venta: aquí manda la oferta (mira «En venta»)${vi ? `, y ${baja}${pierde}` : ''}.`;
    else if (vi) {
      consejo = c.tipo === 'favorable' ? `Le vienen partidos buenos, pero ${baja}${pierde}: manda la venta. Lo que sume en puntos no compensa lo que pierde cada día; si es titular en tu once, busca antes quién lo sustituya.`
        : c.tipo === 'duro' ? `Partidos difíciles y ${baja}${pierde}: más motivo para venderlo.`
        : `${baja[0].toUpperCase()}${baja.slice(1)}${pierde}: manda la venta.`;
    } else if (poco != null) {
      consejo = `Va bajando poco a poco${poco > 0 ? ` (unos ${eur(poco)} hasta la jornada)` : ''}: ${c.tipo === 'favorable' ? 'los partidos buenos que le vienen' : 'el calendario'} no son motivo para quedártelo si te sale una buena venta.`;
    } else {
      consejo = c.tipo === 'duro' ? 'Le vienen partidos difíciles. No es motivo para venderlo por sí solo; si te llega una buena oferta, cuéntalo.'
        : c.tipo === 'favorable' ? 'Le vienen partidos buenos: buen momento para tenerlo en el once.' : '';
    }
  }
  const suya = M.racha ? M.racha(j.equipoId) : null;
  return `<div class="cal-riesgo ${c.tipo}">
    <div class="cr-cab"><b>${titulo}</b>${riesgo}</div>
    <p class="cr-txt">${esc(c.texto)}</p>
    ${suya ? `<div class="cr-su"><span>Cómo llega ${esc(j.equipo || 'su equipo')}</span>${rachaHTML(suya, j.equipo)}</div>` : ''}
    <div class="cr-lista">${filas}</div>
    <p class="cr-ley">Las bolitas, los últimos partidos de cada equipo: <b class="ley-V">V</b> ganó, <b class="ley-E">E</b> empató, <b class="ley-D">D</b> perdió. La de la derecha es la más reciente.</p>
    ${consejo ? `<p class="cr-consejo">${esc(consejo)}</p>` : ''}
  </div>`;
}

const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
/**
 * un jugador en el campo, como en el Fantasy: la cara, la placa con el nombre y debajo el dato que toque
 * (puntos esperados, valor o forma) y, arriba, contra quién juega con el color de lo difícil que es
 */
// (en la ficha de un partido: tag es la etiqueta de arriba a la izquierda, { txt, cls }, en vez del rival; marca, lo
// de arriba a la derecha; datoFijo, lo de debajo del nombre, { txt, cls })
export function cromo(M, j, { modo = 'pp', chico = false, ent = false, vivo = false, directo = false, tag = null, marca: marcaFija = null, datoFijo = null } = {}) {
  if (!j) return `<button class="cromo vacio-c" data-ir="mercado"><span class="cr-hueco">+</span><span class="cr-nom">Falta</span></button>`;
  const fr = M && M.factorRival ? M.factorRival(j) : null;
  const f = M && M.forma ? M.forma(j.id) : null;
  let dato;
  if (modo === 'valor') dato = eur(j.valor);
  else if (modo === 'forma') dato = f && f.pts.length ? f.pts.slice(-3).join(' · ') : j.media ? `${String(j.media).replace('.', ',')} m` : '–';
  else dato = M && M.ppEsperado && j.pos < 5 ? `${dec1(M.ppEsperado(j))} pts` : j.media ? `${String(j.media).replace('.', ',')} m` : '–';
  // con la jornada en juego (en Equipo y en la ficha de un rival), en «Puntos»: los que lleva, en verde si suma y en rojo
  // si resta; el que aún no ha jugado, la hora de su partido («16:15» hoy, «mañ. 14:00», «lun 21:00»)
  let datoCls = '';
  if ((vivo || directo) && modo === 'pp' && M && M.vivo) {
    const pv = M.puntosVivo ? M.puntosVivo(j.id) : null;
    if (pv != null) { dato = `${pv} pts`; datoCls = ` vivo-p ${pv > 0 ? 'sube' : pv < 0 ? 'baja' : 'cero'}`; }
    else {
      const p = M.proximoPartido ? M.proximoPartido(j.equipoId) : null;
      dato = esc(p ? cuando(p.fecha).replace(/^hoy /, '').replace(/^mañana /, 'mañ. ').replace(/^(\S+) \d+, /, '$1 ') : '–');
      datoCls = ' hora';
    }
  }
  if (datoFijo) { dato = esc(datoFijo.txt); datoCls = datoFijo.cls ? ` ${datoFijo.cls}` : ''; }
  const conOnce = !!(M && M.hayOnces && j.pos < 5);
  const o = conOnce ? M.onceProb(j.id) : null;
  const al = M && M.alineacion && j.pos < 5 ? M.alineacion(j.id) : null;
  let marca = '';
  // con la alineación confirmada, lo que diga: titular, suplente o fuera
  if (al) marca = al.estado === 'titular' ? `<span class="cr-est ok" title="Titular confirmado">${icono('ok')}</span>` : al.estado === 'suplente' || al.estado === 'nosale' ? `<span class="cr-est supl" title="${al.estado === 'nosale' ? 'No sale de titular en la alineación confirmada' : 'Suplente en la alineación confirmada'}">SUP</span>` : '<span class="cr-est mal no" title="No va convocado">NO</span>';
  else if (MALOS.has(j.estado)) marca = '<span class="cr-est mal">+</span>';
  else if (j.estado === 'doubtful') marca = '<span class="cr-est duda">?</span>';
  else if (conOnce && (!o || !o.titular)) marca = '<span class="cr-est supl">SUP</span>';
  if (marcaFija != null) marca = marcaFija;
  const rv = tag ? (tag.txt ? `<span class="cr-rv ${tag.cls || ''}">${esc(tag.txt)}</span>` : '') : fr && fr.p ? `<span class="cr-rv ${nivelCls(fr.nivel)}">${fr.p.casa ? '' : '@'}${esc(corto(fr.p.rivalId, fr.p.rival))}</span>` : '';
  const ape = String(j.nombre || '').split(' ');
  const nom = ape.length > 1 && j.nombre.length > 11 ? ape.slice(1).join(' ') : j.nombre;
  return `<button class="cromo p${j.pos}${chico ? ' chico' : ''}${MALOS.has(j.estado) ? ' baja-c' : ''}" data-j="${esc(j.id)}">
    <span class="cr-foto">${ava(j, 'cr')}${rv}${marca}</span>
    <span class="cr-nom">${ent ? '<i>ENT</i>' : ''}${esc(nom)}</span>
    <span class="cr-dato${datoCls}">${dato}</span></button>`;
}

/**
 * el once de la jornada en directo en su campo, con la forma de verdad (las líneas salen del puesto de cada uno) y los
 * puntos que lleva cada jugador; el que aún no ha jugado, con la hora de su partido
 */
export function campoVivo(M, ids) {
  const js = (ids || []).map((pid) => M.J(pid)).filter((j) => j && j.pos);
  if (!js.length) return '';
  const lineas = [1, 2, 3, 4].map((p) => js.filter((j) => j.pos === p));
  const ent = js.find((j) => j.pos === 5);
  const filas = [3, 2, 1, 0].filter((i) => lineas[i].length).map((i) => `<div class="linea-c${lineas[i].length >= 5 ? ' cinco' : ''}">${lineas[i].map((j) => cromo(M, j, { vivo: true })).join('')}</div>`);
  const forma = lineas.slice(1).map((l) => l.length).join('-');
  return `<div class="cancha cancha-vivo"><i class="l-borde"></i><i class="l-medio"></i><i class="l-circ"></i><i class="l-area arriba"></i><i class="l-area abajo"></i>
    <span class="cv-forma">${esc(forma)}</span>${filas.join('')}${ent ? `<div class="cr-ent">${cromo(M, ent, { chico: true, ent: true, vivo: true })}</div>` : ''}</div>`;
}

const ACC = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };
/** la pastilla del plan del día en las listas, si el plan dice algo de este jugador */
export const planPill = (op) => (op ? `<span class="pill plan">${icono('rayo')}${ACC[op.accion] || op.accion} hoy</span>` : '');

/* la probabilidad de ser titular al lado del nombre, en todas las listas: el motor lo pone la app cada vez que lo rehace */
let MF = null;
export function fijarMotor(M) { MF = M; }
const CONF_TXT = { titular: ['bien', 'Titular'], suplente: ['duda', 'Suplente'], nosale: ['duda', 'No titular'], fuera: ['mal', 'No convocado'], baja: ['mal', 'Baja'] };
/** al lado del nombre: la probabilidad de que sea titular o, con la alineación ya confirmada, si está */
export function titBadge(M, j) {
  if (!M || !j || !j.pos) return '';
  // con su partido de la jornada ya empezado, los puntos que lleva
  const pv = M.puntosVivo ? M.puntosVivo(j.id) : null;
  if (pv != null) return `<span class="tit-b vivo ${pv > 0 ? 'bien' : pv < 0 ? 'mal' : ''}" title="Puntos en esta jornada">${pv} pts</span>`;
  if (j.pos === 5 || !M.titularidad) return '';
  const al = M.alineacion ? M.alineacion(j.id) : null;
  if (al && CONF_TXT[al.estado]) {
    const [cls, txt] = CONF_TXT[al.estado];
    return `<span class="tit-b ${cls} conf" title="Alineación confirmada">${al.estado === 'titular' ? icono('ok') : ''}${txt}</span>`;
  }
  // el lesionado o sancionado ya lleva su pastilla
  if (['injured', 'suspended', 'out_of_league'].includes(j.estado)) return '';
  const T = M.titularidad(j);
  if (!T || T.p == null) return '';
  const p = Math.round(T.p * 100);
  return `<span class="tit-b ${p >= 75 ? 'bien' : p >= 45 ? 'duda' : 'mal'}" title="Probabilidad de ser titular">${p} %</span>`;
}

/** una fila de jugador. x lleva j (jugador) y opcionalmente tend, cláusula, etc. */
// como mucho 3 pastillas por fila, en orden de importancia: lo que sobra se ve en su ficha
const MAX_PILLS = 3;
export function filaJugador(x, { sub = null, extra = '', pills = null, derecha = null, conMini = false, op = null, maxPills = MAX_PILLS } = {}) {
  const j = x.j;
  const t = x.tend;
  if (pills) { extra = [planPill(op), ...pills].filter(Boolean).slice(0, maxPills).join(''); op = null; }
  return `<button class="fila" data-j="${esc(j.id)}">
    ${ava(j)}
    <div class="fila-c">
      <div class="fila-n">${posTag(j)}<span class="nom">${esc(j.nombre)}</span>${esFav(j.id) ? `<span class="fav-mini" title="Favorito">${icono('estrella')}</span>` : ''}${titBadge(MF, j)}</div>
      <div class="fila-s">${sub != null ? sub : esc(j.equipo || '')}</div>
      ${extra || op ? `<div class="fila-x">${planPill(op)}${extra}</div>` : ''}
    </div>
    <div class="fila-d">${derecha != null ? derecha : `<div class="v">${eur(j.valor)}</div><div class="d">${delta(t)}</div>${conMini && t ? mini(t.serie, t.d7 != null ? t.d7 >= 0 : t.d1 >= 0) : ''}`}</div>
  </button>`;
}

export const nada = (txt) => `<div class="vacio">${txt}</div>`;

/** si sale de titular en la alineación confirmada o, si aún no la hay, en el once probable de su equipo (futbolfantasy) */
export function oncePill(M, j) {
  if (!M || !j || j.pos === 5) return '';
  const al = M.alineacion ? M.alineacion(j.id) : null;
  if (al && CONF_TXT[al.estado]) { const [cls, txt] = CONF_TXT[al.estado]; return `<span class="pill ${cls}">${al.estado === 'titular' ? icono('ok') : ''}${txt} (confirmado)</span>`; }
  // el mismo % que sale en las listas (junta el once probable con sus minutos y la temporada)
  const T = M.titularidad && !['injured', 'suspended', 'out_of_league'].includes(j.estado) ? M.titularidad(j) : null;
  if (T && T.p != null) { const p = Math.round(T.p * 100); return `<span class="pill ${p >= 75 ? 'bien' : p >= 45 ? 'duda' : 'mal'}">${p} % de ser titular</span>`; }
  if (!M.hayOnces) return '';
  const o = M.onceProb(j.id);
  if (!o) return '<span class="pill">Fuera del once</span>';
  if (o.titular) return `<span class="pill bien">Titular${o.prob != null ? ` ${o.prob} %` : ''}</span>`;
  return '<span class="pill duda">Suplente</span>';
}

/** el calendario de sus próximos partidos, solo si es duro o favorable */
export function calPill(M, j, { soloDuro = false } = {}) {
  const c = M && M.calendarioRiesgo && j && j.pos < 5 ? M.calendarioRiesgo(j) : null;
  if (!c || c.tipo === 'normal' || (soloDuro && c.tipo !== 'duro')) return '';
  return `<span class="pill ${c.tipo === 'duro' ? 'mal' : 'bien'}" title="${esc(c.texto)}">${c.tipo === 'duro' ? 'Calendario duro' : 'Calendario favorable'}</span>`;
}


/** un titular de prensa */
export const filaNoticia = (n) => `<button class="noticia" data-abrir="${esc(n.link)}"><span class="tit">${esc(n.titulo)}</span><span class="meta">${[n.fuente && !esWebFantasy(n.fuente) ? esc(n.fuente) : '', n.t ? cuando(n.t) : ''].filter(Boolean).join(' · ')}</span></button>`;

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

/* ---------- las funciones top, bloqueadas (limite.js: bloqueada) ---------- */
export const BLOQUEO = {
  dineroRivales: ['Dinero de los rivales', 'Cuánto tiene cada rival y hasta dónde puede gastar.'],
  quienPaga: ['Quién puede pagar tu cláusula', 'Qué rivales tienen dinero para quitarte a cada jugador.'],
  inercia: ['Cuándo gira un jugador', 'Hacia dónde va su valor, cuántos días le quedan subiendo y cuándo venderlo antes de que baje.'],
  perfilRival: ['Cómo juega cada rival', 'A quién clausula y cuánto paga, si vende rápido o aguanta, qué puestos ficha, si se protege y a qué hora se mueve.'],
  radar: ['Radar de subidas', 'Los que más van a subir estos días según su inercia y los que acaban de hacer un partidazo, con de quién es cada uno. Se abre junto con «Cuándo gira un jugador».'],
  ventasRivales: ['Lo que venden los rivales', 'Qué jugadores tiene cada rival en el mercado, cuánto le suele dar LaLiga por cada uno y cuánto ofrecerle para que te lo venda a ti.'],
};

/* ---------- lo que tiene en venta cada rival (función top «ventasRivales») ---------- */
/** sus jugadores en el mercado, con lo que pide y lo que suele dar LaLiga */
export const ventasDe = (M, tid) => (M.mercado || []).filter((m) => m.tipo === 'manager' && String(m.vendedorTeamId || '') === String(tid));
/** la caja de una función bloqueada (se toca para ver qué es) */
export function candado(clave, { como = null } = {}) {
  // «como»: otra cara para la misma llave (el radar se abre con la de la inercia)
  const [t, x] = BLOQUEO[como || clave] || BLOQUEO[clave] || ['Función top', ''];
  // en la de Google Play se abre viendo anuncios (las de los rivales, con 2 y unas veces por jornada); en la de la liga, aún no
  return `<button class="bloq" data-accion="bloqueada" data-clave="${esc(clave)}"${como ? ` data-como="${esc(como)}"` : ''}><span class="bloq-ic">${icono('candado')}</span><span class="bloq-c"><b>${esc(t)}</b><span>${esc(x)}${colaCandado(clave)}</span></span></button>`;
}
/** lo que dice un candado de cómo se abre */
export function colaCandado(clave) {
  if (!topConAnuncio()) return ' Se desbloqueará pronto viendo un anuncio.';
  if (!POR_JORNADA.includes(clave)) return ' Tócalo y ábrela hasta medianoche viendo un anuncio corto.';
  const q = usosQuedan(clave), n = usosPorJornada();
  if (!q) return ` Ya la has abierto las ${n} veces de esta jornada: vuelve en la siguiente.`;
  return ` Tócalo y ábrela ${minutosPorVez() >= 60 && minutosPorVez() % 60 === 0 ? `${minutosPorVez() / 60} hora${minutosPorVez() > 60 ? 's' : ''}` : `${minutosPorVez()} minutos`} con dos anuncios cortos. ${n} veces por jornada: te ${q === 1 ? 'queda 1' : `quedan ${q}`}.`;
}
/** lo mismo, en pequeño (en una fila) */
export function candadoMini(clave, texto) {
  const [t] = BLOQUEO[clave] || ['Función top'];
  return `<span class="pill bloq-p" data-accion="bloqueada" data-clave="${esc(clave)}">${icono('candado')}${esc(texto || t)}</span>`;
}
