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
  const filas = c.partidos.map((p) => `<div class="cr-p ${nivelCls(p.nivel)}">
      <span class="cr-j">J${p.jornada}<small>${p.sinFecha ? 'sin fecha' : esc(cuando(p.fecha, { hora: false }))}</small></span>
      <b class="cr-rv2">${p.casa ? 'vs' : 'en'} ${esc(p.rival)}</b>
      <span class="cr-pt"><b>~${d1(p.pts)}</b> pts</span>
      <span class="cr-ti"><b>${p.pTit == null ? '–' : `${Math.round(p.pTit * 100)}%`}</b> tit.</span>
      <small class="cr-nv">${p.pos ? `${p.pos}º · ` : ''}${p.nivel || 'sin datos'}${p.rot ? ` · ${esc(p.rot.join(' y '))} cerca` : ''}</small>
      <span class="cr-ra">${M.racha ? rachaHTML(M.racha(p.rivalId), p.rival) : ''}</span>
    </div>`).join('');
  // con los tuyos, el calendario no decide la venta: si está bajando (o a punto de girar), manda la venta
  let consejo = c.consejo;
  if (mio) {
    const vi = M.ventaPorInercia ? M.ventaPorInercia(j.id) : null;
    const ine = M.inercia ? M.inercia(j.id) : null;
    const poco = !vi && ine && (ine.fase === 'giro' || ine.fase === 'baja') ? Math.max(0, -ine.proyJ) : null;
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
export function cromo(M, j, { modo = 'pp', chico = false, ent = false } = {}) {
  if (!j) return `<button class="cromo vacio-c" data-ir="mercado"><span class="cr-hueco">+</span><span class="cr-nom">Falta</span></button>`;
  const fr = M && M.factorRival ? M.factorRival(j) : null;
  const f = M && M.forma ? M.forma(j.id) : null;
  let dato;
  if (modo === 'valor') dato = eur(j.valor);
  else if (modo === 'forma') dato = f && f.pts.length ? f.pts.slice(-3).join(' · ') : j.media ? `${String(j.media).replace('.', ',')} m` : '–';
  else dato = M && M.ppEsperado && j.pos < 5 ? `${dec1(M.ppEsperado(j))} pts` : j.media ? `${String(j.media).replace('.', ',')} m` : '–';
  // en la jornada en directo, en «Puntos», los que lleva (si su partido ha empezado)
  const pv = modo === 'pp' && M && M.puntosVivo ? M.puntosVivo(j.id) : null;
  if (pv != null) dato = `<b class="cr-vivo ${pv > 0 ? 'sube' : pv < 0 ? 'baja' : ''}">${pv}</b> pts`;
  const conOnce = !!(M && M.hayOnces && j.pos < 5);
  const o = conOnce ? M.onceProb(j.id) : null;
  const al = M && M.alineacion && j.pos < 5 ? M.alineacion(j.id) : null;
  let marca = '';
  // con la alineación confirmada, lo que diga: titular, suplente o fuera
  if (al) marca = al.estado === 'titular' ? `<span class="cr-est ok" title="Titular confirmado">${icono('ok')}</span>` : al.estado === 'suplente' ? '<span class="cr-est sup" title="Suplente en la alineación confirmada">SUP</span>' : '<span class="cr-est mal no" title="No va convocado">NO</span>';
  else if (MALOS.has(j.estado)) marca = '<span class="cr-est mal">+</span>';
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

/* la probabilidad de ser titular al lado del nombre, en todas las listas: el motor lo pone la app cada vez que lo rehace */
let MF = null;
export function fijarMotor(M) { MF = M; }
const CONF_TXT = { titular: ['bien', 'Titular'], suplente: ['duda', 'Suplente'], fuera: ['mal', 'No convocado'], baja: ['mal', 'Baja'] };
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
export function filaJugador(x, { sub = null, extra = '', pills = null, derecha = null, conMini = false, op = null } = {}) {
  const j = x.j;
  const t = x.tend;
  if (pills) { extra = [planPill(op), ...pills].filter(Boolean).slice(0, MAX_PILLS).join(''); op = null; }
  return `<button class="fila" data-j="${esc(j.id)}">
    ${ava(j)}
    <div class="fila-c">
      <div class="fila-n">${posTag(j)}<span class="nom">${esc(j.nombre)}</span>${titBadge(MF, j)}</div>
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

/* ---------- las funciones top, bloqueadas (limite.js: bloqueada) ---------- */
export const BLOQUEO = {
  dineroRivales: ['Dinero de los rivales', 'Cuánto tiene cada rival y hasta dónde puede gastar.'],
  quienPaga: ['Quién puede pagar tu cláusula', 'Qué rivales tienen dinero para quitarte a cada jugador y cuánto subir la cláusula para que no le llegue a nadie.'],
  inercia: ['Cuándo gira un jugador', 'Hacia dónde va su valor, cuántos días le quedan subiendo y cuándo venderlo antes de que baje.'],
  ventasRivales: ['Lo que venden los rivales', 'Qué jugadores tiene cada rival en el mercado, cuánto le da LaLiga por cada uno y cuánto ofrecerle para que te lo venda a ti.'],
};

/* ---------- lo que tiene en venta cada rival (función top «ventasRivales») ---------- */
/** sus jugadores en el mercado, con lo que pide y lo que le da LaLiga */
export const ventasDe = (M, tid) => (M.mercado || []).filter((m) => m.tipo === 'manager' && String(m.vendedorTeamId || '') === String(tid));
/** la caja de una función bloqueada (se toca para ver qué es) */
export function candado(clave) {
  const [t, x] = BLOQUEO[clave] || ['Función top', ''];
  return `<button class="bloq" data-accion="bloqueada" data-clave="${esc(clave)}"><span class="bloq-ic">${icono('candado')}</span><span class="bloq-c"><b>${esc(t)}</b><span>${esc(x)} Se desbloqueará pronto viendo un anuncio.</span></span></button>`;
}
/** lo mismo, en pequeño (en una fila) */
export function candadoMini(clave, texto) {
  const [t] = BLOQUEO[clave] || ['Función top'];
  return `<span class="pill bloq-p" data-accion="bloqueada" data-clave="${esc(clave)}">${icono('candado')}${esc(texto || t)}</span>`;
}
