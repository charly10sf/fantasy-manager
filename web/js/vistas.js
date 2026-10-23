/* Las pestañas: Hoy (el plan del día), Equipo, Rivales, Mercado y Pregunta (el chat). Cada una devuelve su HTML. */
import { esc, eur, pct, dura, cuando, icono, clase, POS_PLURAL, num, DIA, HORA, rel, LS, diaDe } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, partidoTxt, filaJugador, nada, oncePill, filaNoticia, cromo, rivalSub, dineroCorto, calPill, avisoOnce, candadoMini, candado } from './comunes.js';
import { bloqueada } from './limite.js';
import { linea, barra } from './graficos.js';
import { hayClave, nombreModelo, conversacion, notasVigentes, chatsAnteriores, jugadoresEn, pidDe, planes } from './ia.js';
import { md } from './texto.js';
import { enApp, nativo } from './puente.js';
import { guiaClave } from './clave.js';
import { K } from './datos.js';

const ICO_ACT = { compra: 'mercado', clausula: 'diana', venta: 'euro', blindaje: 'escudo', premio: 'hucha', alineacion: 'alerta', entra: 'usuario', otro: 'cambio' };
const VERBO = { compra: 'fichó a', clausula: 'clausuló a', venta: 'vendió a', blindaje: 'blindó a', premio: 'cobró por la jornada', alineacion: 'no puntuó por alineación incorrecta', entra: 'entró en la liga', otro: 'movió a' };
const VERBO_TU = { compra: 'fichaste a', clausula: 'clausulaste a', venta: 'vendiste a', blindaje: 'blindaste a', premio: 'cobraste por la jornada', alineacion: 'no puntuaste por alineación incorrecta', entra: 'entraste en la liga', otro: 'moviste a' };
export const PELIGRO = { alta: 'alto', media: 'medio', baja: 'bajo' };

/* ---------- el ordenador ---------- */
/** pantalla ancha (ordenador o tableta en horizontal): cada pestaña se reparte en columnas */
export const ancho = () => typeof matchMedia === 'function' && matchMedia('(min-width: 1100px)').matches;
/** dos columnas: «lado-der» (lo principal y una columna estrecha a la derecha) o «lado-izq» (la estrecha a la izquierda) */
const cols = (izq, der, tipo = 'lado-der') => `<div class="cols-e ${tipo}"><div class="ce-i">${izq}</div><div class="ce-d">${der}</div></div>`;
/** las listas de jugadores, en dos columnas en el ordenador */
const lista2 = (h) => (ancho() ? `<div class="lista2">${h}</div>` : h);

export function filaActividad(a) {
  const quien = a.esYo ? '<span class="quien yo">Tú</span>' : `<span class="quien">${esc(a.quien || 'Un rival')}</span>`;
  const jug = a.nombreJ ? ` <b>${esc(a.nombreJ)}</b>` : '';
  const a2 = a.otro && a.clase !== 'premio' ? ` ${a.clase === 'clausula' ? 'de' : 'a'} ${a.contraMi ? '<b class="rojo">ti</b>' : esc(a.otro)}` : '';
  const imp = a.importe ? `<div class="v">${eur(a.importe)}</div>` : '';
  return `<button class="fila" ${a.pid ? `data-j="${esc(a.pid)}"` : ''}>
    <span class="ic-act ${a.clase}">${icono(ICO_ACT[a.clase] || 'cambio')}</span>
    <div class="fila-c"><div class="act-t">${quien} ${(a.esYo ? VERBO_TU : VERBO)[a.clase] || 'movió a'}${jug}${a2}</div><div class="fila-s">${a.t ? cuando(a.t) : ''}</div></div>
    <div class="fila-d">${imp}</div></button>`;
}

/* ================= EL MARCADOR (arriba de Hoy) ================= */
function marcador(S) {
  const { D, M } = S;
  const yo = M.yo || {};
  const ahora = Date.now();
  let fila = '';
  if (M.enParon) fila = `<span>${icono('bandera')} Parón de selecciones</span><span class="der">vuelve ${cuando(M.paron.fin, { hora: false })}</span>`;
  else if (M.enJuego) fila = `<span class="vivo">Jornada ${M.enJuego.n} en juego</span><span class="der">hasta ${cuando(M.enJuego.fin)}</span>`;
  else if (M.proxima) fila = `<span>Jornada ${M.proxima.n}</span><span class="der">${cuando(M.proxima.ini)} · ${dura(M.proxima.ini - ahora)}</span>`;
  else fila = `<span>${esc(D.liga.nombre)}</span>`;
  const dEq = M.mias.reduce((s, x) => s + num(x.tend.d1), 0);
  let h = `<div class="marcador" data-accion="resumen" role="button" tabindex="0" aria-label="Ver el detalle de tu equipo"><div class="fila-j">${fila}<span class="marcador-ir" aria-hidden="true">${icono('flecha')}</span></div>
    <div class="cols">
      <div class="col"><div class="et">Saldo</div><div class="v ${D.dinero < 0 ? 'neg' : ''}">${eur(D.dinero)}</div><div class="d apag">gastas hasta ${eur(M.pujaMax, { dec: 1 })}</div></div>
      <div class="col"><div class="et">Equipo</div><div class="v">${eur(D.valorEquipo, { dec: 1 })}</div><div class="d ${clase(dEq)}">${dEq ? `${eur(dEq, { signo: true, dec: 1 })} hoy` : '<span class="apag">= hoy</span>'}</div></div>
      <div class="col"><div class="et">Puesto</div><div class="v">${yo.pos || '–'}º<small>/${D.clasif.length}</small></div><div class="d apag">${num(yo.puntos)} pts</div>${distanciaHTML(S)}</div>
    </div>`;
  if (M.negativo && M.proxima) h += `<div class="alerta-m">${icono('alerta')}En negativo: si la jornada empieza así, no puntúas.</div>`;
  if (M.vedaAhora) h += `<div class="alerta-m oro">${icono('candado')}<span>Cláusulas cerradas: nadie puede clausular hasta que empiece la jornada ${M.vedaAhora.n}, ${cuando(M.vedaAhora.fin)}.</span></div>`;
  else if (M.proxima && M.proxima.ini - M.VEDA_H * HORA - ahora < 12 * HORA) h += `<div class="alerta-m oro">${icono('reloj')}<span>Las cláusulas se cierran ${cuando(M.proxima.ini - M.VEDA_H * HORA)}, 24 h antes de la jornada, y se reabren ${cuando(M.proxima.ini)}.</span></div>`;
  return h + '</div>';
}

/** en la columna del puesto: a cuánto estás del primero (o cuánto le sacas al segundo) */
function distanciaHTML(S) {
  const { D, M } = S;
  const yo = M.yo;
  if (!yo) return '';
  const tabla = [...D.clasif].sort((a, b) => a.pos - b.pos);
  const lider = tabla[0], segundo = tabla[1];
  if (yo.pos === 1) return segundo ? `<div class="dist">+${yo.puntos - segundo.puntos} al 2º</div>` : '';
  return lider ? `<div class="dist">a ${lider.puntos - yo.puntos} del 1º</div>` : '';
}

/**
 * lo que sacaste en la última jornada jugada y en qué puesto de esa jornada quedaste ({ n, pts, puesto } o null). Si
 * LaLiga ya da los puntos de la jornada en curso (todo a 0 antes de empezar), se sacan del histórico de puntos de cada
 * equipo (los de ahora menos los de antes de que empezara)
 */
export function puntosUltimaJornada(S) {
  const { D, M } = S;
  const yo = M.yo;
  if (!yo) return null;
  const ultJ = M.ultimaJornada;
  let ptsJ = null;
  const jo = ultJ && (M.jornadas || []).find((j) => j.n === ultJ.n);
  if (jo && jo.fin < Date.now()) {
    const dIni = new Date(jo.ini - 6 * 3600e3).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const m = {};
    for (const e of D.clasif) {
      const serie = ((S.H && S.H.eq) || {})[e.teamId] || [];
      const antes = serie.filter(([d]) => d <= dIni).pop();
      if (antes && antes[2] != null) m[e.teamId] = e.puntos - antes[2];
    }
    const ok = Object.values(m).every((v) => v >= -10 && v <= 200);
    if (ok && Object.keys(m).length >= Math.max(2, D.clasif.length - 1) && m[yo.teamId] != null) ptsJ = m;
  }
  // si no hay histórico, lo que dé LaLiga, pero solo si no está todo a cero (eso es la jornada que aún no ha empezado)
  if (!ptsJ && D.clasif.filter((e) => num(e.puntosJornada) > 0).length >= 2) ptsJ = Object.fromEntries(D.clasif.map((e) => [e.teamId, num(e.puntosJornada)]));
  const pts = ptsJ ? ptsJ[yo.teamId] : null;
  if (pts == null) return null;
  return { n: ultJ ? ultJ.n : null, pts, puesto: Object.values(ptsJ).filter((v) => v > pts).length + 1 };
}

/** lo que va a pasar pronto, en chips: el mercado, las cláusulas, tu protección, el parón */
function tiemposHTML(S) {
  const { M } = S;
  const ahora = Date.now();
  const c = [];
  if (M.cierreMercado) c.push(['mercado', 'Mercado nuevo', `en ${dura(M.cierreMercado - ahora)}`, 'mercado']);
  const prot = M.mias.filter((x) => !x.abierta && x.abreEn < 3 * DIA && x.riesgo !== 'ninguno').sort((a, b) => a.abreEn - b.abreEn)[0];
  if (prot) c.push(['candado', `Se abre ${prot.j.nombre}`, `en ${dura(prot.abreEn)}`, `j:${prot.pid}`]);
  const cl = M.clausulas.filter((x) => !x.abierta && x.meLlega && x.interes >= 60 && x.abreEn < 2 * DIA).sort((a, b) => a.abreEn - b.abreEn)[0];
  if (cl) c.push(['diana', `Cláusula de ${cl.j.nombre}`, `en ${dura(cl.abreEn)}`, `j:${cl.pid}`]);
  if (M.paron && !M.enParon && M.paron.ini - ahora < 21 * DIA) c.push(['bandera', 'Parón', `en ${dura(M.paron.ini - ahora)}`, 'accion:paron']);
  if (!c.length) return '';
  // cada chip lleva a lo que dice: el jugador, el mercado o lo que pasa en el parón
  const destino = (a) => (a.startsWith('j:') ? `data-j="${esc(a.slice(2))}"` : a.startsWith('accion:') ? `data-accion="${esc(a.slice(7))}"` : a ? `data-ir="${a}"` : '');
  return `<div class="tiempos">${c.map(([ic, t, sub, a]) => `<button class="tiempo" ${destino(a)}>${icono(ic)}<div><b>${esc(t)}</b><span>${esc(sub)}</span></div>${a ? icono('flecha', 'tiempo-ir') : ''}</button>`).join('')}</div>`;
}

/** un texto con los nombres de jugadores que salen en él, para tocarlos y abrir su ficha */
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function conEnlaces(S, texto) {
  const t = String(texto || '');
  let html = esc(t);
  if (!S.D || !t) return html;
  const marcas = [];
  for (const j of jugadoresEn(t, S.D).sort((a, b) => b.nombre.length - a.nombre.length)) {
    for (const n of [j.nombre, j.nombre.split(' ').pop()].filter((x) => x && x.length >= 4)) {
      const re = new RegExp(`(^|[^\\p{L}\\u0000])(${reEsc(esc(n))})(?![\\p{L}])`, 'iu');
      if (!re.test(html)) continue;
      html = html.replace(re, (m, a, b) => { marcas.push(`<button class="enlace-j" data-j="${esc(j.id)}">${b}</button>`); return `${a}\u0000${marcas.length - 1}\u0000`; });
      break;
    }
  }
  return html.replace(/\u0000(\d+)\u0000/g, (m, i) => marcas[+i]);
}

/**
 * Lo que llevas hoy: lo que de verdad has hecho en LaLiga desde el último cambio de mercado (lo veas o no en el
 * plan): lo terminado, lo que está en marcha (pujas, ofertas, lo que tienes a la venta) y lo que te han hecho a ti.
 * Cada cosa dice si venía en el plan o es por tu cuenta.
 */
export function llevasHTML(S) {
  const { M } = S;
  const P = S.plan;
  if (!M || !M.actividad) return '';
  const ahora = Date.now();
  const desde = M.cierreMercado && M.cierreMercado > ahora ? Math.max(M.cierreMercado - 24 * HORA, ahora - 24 * HORA) : ahora - 24 * HORA;
  const ops = P ? P.ops.filter((o) => o.pid && !o.descartada) : [];
  // y lo que te propusieron los planes anteriores de hoy (al pedir otro plan, lo que ya hiciste del primero sigue
  // siendo «del plan»)
  const hoyD = diaDe(ahora);
  const accDe = (a) => String(a || '').toLowerCase().replace('aceptar_oferta', 'vender').replace('aceptar', 'vender').replace('ofertar', 'comprar');
  const deAntes = planes().filter((p) => p && p.t && diaDe(p.t) === hoyD && p !== P).flatMap((p) => (p.operaciones || []).map((o) => ({ pid: o.pid || pidDe(o.jugador, S.D), accion: accDe(o.accion) })));
  const delPlan = (pid, acciones) => ops.some((o) => o.pid === pid && acciones.includes(o.accion)) || deAntes.some((o) => o.pid === pid && acciones.includes(o.accion));
  const items = [];
  for (const a of M.actividad) {
    if (!a.t || a.t <= desde || !a.pid) continue;
    const nom = a.nombreJ || 'un jugador';
    if (a.esYo && ['compra', 'clausula', 'venta', 'blindaje'].includes(a.clase)) {
      const t = a.clase === 'venta' ? `Vendiste a ${nom}${a.importe ? ` por ${eur(a.importe)}` : ''}${a.otro ? ` a ${a.otro}` : ''}`
        : a.clase === 'clausula' ? `Clausulaste a ${nom}${a.otro ? ` de ${a.otro}` : ''}${a.importe ? ` por ${eur(a.importe)}` : ''}`
          : a.clase === 'blindaje' ? `Blindaste a ${nom}`
            : `Fichaste a ${nom}${a.importe ? ` por ${eur(a.importe)}` : ''}${a.otro ? ` (de ${a.otro})` : ''}`;
      const acc = { venta: ['vender'], clausula: ['clausular', 'pujar', 'comprar'], compra: ['pujar', 'comprar', 'clausular'], blindaje: ['blindar'] }[a.clase];
      items.push({ t: a.t, estado: 'hecho', texto: t, pid: a.pid, plan: delPlan(a.pid, acc), dinero: a.clase === 'venta' ? num(a.importe) : a.clase === 'blindaje' ? 0 : -num(a.importe) });
    } else if (a.contraMi && a.clase === 'clausula') {
      items.push({ t: a.t, estado: 'contra', texto: `${a.quien || 'Un rival'} te clausuló a ${nom}${a.importe ? `: cobras ${eur(a.importe)}` : ''}`, pid: a.pid, dinero: num(a.importe) });
    }
  }
  for (const m of M.mercado || []) {
    if (!m.miPuja) continue;
    items.push({ t: ahora, estado: 'curso', pid: m.pid, plan: delPlan(m.pid, ['pujar', 'comprar']),
      texto: m.tipo === 'manager' ? `Ofreces ${eur(m.miPuja)} por ${m.j.nombre} a ${m.vendedor || 'su dueño'}: decide él` : `Pujas ${eur(m.miPuja)} por ${m.j.nombre}${M.cierreMercado ? `: se resuelve ${cuando(M.cierreMercado)}` : ''}` });
  }
  for (const v of M.misVentas || []) {
    const mej = v.mejor;
    items.push({ t: ahora - 1, estado: 'curso', pid: v.pid, plan: delPlan(v.pid, ['vender']),
      texto: `${v.j.nombre} a la venta${mej ? `: la mejor oferta, ${eur(mej.importe)}${mej.deLiga ? ' (LaLiga)' : ''}` : ': aún sin ofertas'}` });
  }
  const hechos = items.filter((x) => x.estado === 'hecho').length, curso = items.filter((x) => x.estado === 'curso').length;
  const quedan = P && !P.viejo ? P.ops.filter((o) => !o.descartada && !['esperar', 'alinear'].includes(o.accion) && o.hoy !== false && !hecho(S, P, o)).length : 0;
  const balance = items.filter((x) => x.estado !== 'curso').reduce((s, x) => s + (x.dinero || 0), 0);
  const cab = `<summary><span class="llevas-t">${icono('lista')}<b>Lo que llevas hoy</b></span><span class="llevas-n">${items.length ? [hechos ? `${hechos} hecho${hechos > 1 ? 's' : ''}` : '', curso ? `${curso} en marcha` : ''].filter(Boolean).join(' · ') : 'nada aún'}</span></summary>`;
  if (!items.length) {
    return `<details class="llevas vacio">${cab}<p class="llevas-vacio">Desde el último cambio de mercado no has movido nada en LaLiga. Lo que hagas allí (pujas, ofertas, ventas, cláusulas) sale aquí al darle a Actualizar, y los pasos del plan se tachan solos.</p></details>`;
  }
  const ICO = { hecho: 'ok', curso: 'reloj', contra: 'alerta' };
  const orden = { curso: 0, contra: 1, hecho: 2 };
  items.sort((a, b) => orden[a.estado] - orden[b.estado] || b.t - a.t);
  return `<details class="llevas" ${items.length <= 8 ? 'open' : ''}>${cab}
    <ul class="llevas-l">${items.map((x) => `<li class="${x.estado}"><button class="llevas-f" data-j="${esc(x.pid)}"><span class="ll-ic">${icono(ICO[x.estado])}</span><span class="ll-t">${esc(x.texto)}${x.estado === 'hecho' && x.t ? ` <small>${esc(cuando(x.t))}</small>` : ''}</span>${x.estado === 'contra' ? '' : `<span class="ll-tag ${x.plan ? 'plan' : ''}">${x.plan ? 'Del plan' : 'Por tu cuenta'}</span>`}</button></li>`).join('')}</ul>
    <p class="llevas-pie">${balance ? `Hecho hasta ahora: ${eur(balance, { signo: true })}. ` : ''}${M.misPujas ? `En pujas tienes ${eur(M.misPujas)} comprometidos. ` : ''}${quedan ? `Del plan te ${quedan === 1 ? 'queda 1 paso' : `quedan ${quedan} pasos`}.` : P && !P.viejo ? 'Del plan no te queda nada por hacer hoy.' : ''}</p></details>`;
}

/** lo urgente de verdad (lo que no puede esperar al plan): como mucho tres cosas */
function ahoraHTML(S) {
  const { M } = S;
  // lo que ya está en el plan no se repite aquí
  const enPlan = new Set(Object.keys(S.opPorPid || {}));
  const urg = (M.acciones || []).filter((a) => a.prio >= 78 && !(a.pid && enPlan.has(a.pid))).slice(0, 3);
  if (!urg.length && S.plan) return '';
  if (!urg.length) return `<div class="ahora-ok">${icono('ok')}<span><b>Nada urgente ahora mismo.</b> Ninguna cláusula tuya en peligro ni nada que vender ya.</span></div>`;
  return `<div class="sec"><h2>Ahora mismo</h2><span class="sub">${urg.length === 1 ? '1 cosa urgente' : `${urg.length} cosas urgentes`}</span></div><div class="ahora">${urg.map((a) => `<button class="ahora-f t-${esc(a.tipo)}" ${a.pid ? `data-j="${esc(a.pid)}"` : a.hash ? `data-ir="${esc(a.hash)}"` : ''}><span class="ahora-ic">${icono(a.icono || 'alerta')}</span><span class="ahora-c"><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></span>${a.cuando ? `<span class="ahora-cu">${esc(a.cuando)}</span>` : ''}</button>`).join('')}</div>`;
}

/** tu equipo de un vistazo: cuántos suben y bajan, los que hay que vender, lesionados y cláusulas abiertas */
export function equipoHoyHTML(S, { corto = false } = {}) {
  const { M } = S;
  const xs = M.mias.filter((x) => x.j && x.j.pos !== 5);
  if (!xs.length) return '';
  const giro = xs.filter((x) => x.ventaInercia && x.ventaInercia.urgencia === 'ya');
  const frena = xs.filter((x) => x.ventaInercia && x.ventaInercia.urgencia !== 'ya');
  const malos = xs.filter((x) => ['injured', 'suspended', 'out_of_league'].includes(x.j.estado));
  const dudas = xs.filter((x) => x.j.estado === 'doubtful');
  const riesgo = xs.filter((x) => x.riesgo === 'alto');
  const sinI = bloqueada('inercia');
  // cada uno con su nombre (se toca y se abre su ficha); si son muchos, los 3 primeros y «+N»
  const de = (lista, cls, txt, ic = '') => {
    if (!lista.length) return '';
    const v = lista.slice(0, 3).map((x) => `<button class="ch ${cls}" data-j="${esc(x.pid)}">${ic ? icono(ic) : ''}${esc(txt(x.j.nombre))}</button>`);
    if (lista.length > 3) v.push(`<span class="ch ${cls}">+${lista.length - 3}</span>`);
    return v.join('');
  };
  const chips = [
    !sinI && de(giro, 'mal', (n) => `${n} ha girado`),
    !sinI && de(frena, 'duda', (n) => `${n} frenando`),
    de(malos, 'mal', (n) => `${n} de baja`),
    de(dudas, 'duda', (n) => `${n} en duda`),
    de(riesgo, 'mal', (n) => `cláusula de ${n} en riesgo`, 'abierto'),
  ].filter(Boolean);
  const proy = xs.reduce((s, x) => s + num(x.inercia && x.inercia.proyJ), 0);
  const conProy = !sinI && M.proxima && Math.abs(proy) >= 100000;
  if (!chips.length && !conProy) return '';
  let h = `<div class="eq-hoy">${corto ? '' : `<div class="eq-hoy-t">${icono('equipo')}<b>Tu equipo hoy</b><button class="mas" data-accion="resumen">Detalle</button></div>`}${chips.length ? `<div class="chs">${chips.join('')}</div>` : ''}`;
  if (conProy) h += `<p class="eq-hoy-m">Hasta la jornada, con la inercia de cada uno: <b class="${clase(proy)}">${eur(proy, { signo: true })}</b></p>`;
  return h + '</div>';
}

/** tu liga en corto: el líder, tú y los que tienes al lado, con su dinero y si van a por ti */
function ligaHTML(S) {
  const { D, M } = S;
  const tabla = [...D.clasif].sort((a, b) => a.pos - b.pos);
  const yo = tabla.findIndex((e) => e.teamId === (D.yo && D.yo.teamId));
  if (yo < 0 || tabla.length < 3) return '';
  const idx = [...new Set([0, yo - 1, yo, yo + 1, yo === 0 ? 2 : -1].filter((i) => i >= 0 && i < tabla.length))].sort((a, b) => a - b);
  const mios = tabla[yo].puntos;
  let h = `<div class="sec"><h2>Tu liga</h2><button class="mas" data-ir="rivales">Clasificación</button></div><div class="liga-c">`;
  let ant = -1;
  for (const i of idx) {
    if (ant >= 0 && i > ant + 1) h += '<div class="liga-sep">···</div>';
    ant = i;
    const e = tabla[i], esYo = i === yo, r = M.rivales.find((x) => x.e.teamId === e.teamId);
    const dif = e.puntos - mios;
    h += `<button class="liga-f ${esYo ? 'yo' : ''}" ${esYo ? 'data-ir="equipo"' : `data-r="${esc(e.teamId)}"`}><span class="posn ${esYo ? 'yo' : ''}">${e.pos}</span>
      <span class="liga-n"><b>${esc(e.nombre)}</b><span>${esc(e.manager && e.manager !== e.nombre ? `${e.manager} · ` : '')}${num(e.puntosJornada) > 0 ? `${e.puntosJornada} últ.` : ''}${r && r.dinero && r.dinero.v != null ? ` · ${r.dinero.exacto ? '' : '≈ '}${eur(r.dinero.v, { dec: 1 })}` : ''}</span></span>
      ${r && r.nivel === 'alta' ? '<span class="amenaza alta">Peligro</span>' : ''}
      <span class="liga-p"><b>${e.puntos}</b><span class="${esYo ? 'apag' : dif > 0 ? 'baja' : 'sube'}">${esYo ? 'tú' : dif > 0 ? `+${dif}` : dif < 0 ? `${dif}` : '='}</span></span></button>`;
  }
  return h + '</div>';
}

/* ================= EL PLAN DEL DÍA ================= */
const ACCION = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };

/** ¿ya lo has hecho? lo marcas tú o se ve en la actividad de la liga */
export const claveHechos = (P) => (P.auto ? `auto-${P.dia}` : String(P.t));
export function hecho(S, P, o) {
  const marcados = (LS.get(K('hechos'), {})[claveHechos(P)] || {}).n || [];
  if (marcados.includes(o.n)) return true;
  return !!hechoEnLiga(S, P, o);
}

/**
 * ¿lo has hecho ya en LaLiga? Se mira en tu actividad (desde que se hizo el plan), en tus pujas y ofertas, en lo que
 * tienes a la venta y en tus cláusulas. Devuelve null o { estado: 'hecho' | 'curso', texto }: «curso» es que tú ya lo
 * has hecho pero falta que se resuelva (la puja hasta el cambio de mercado, la oferta hasta que el otro acepte).
 */
export function hechoEnLiga(S, P, o) {
  const M = S.M;
  if (!o || !o.pid || o.descartada || !M) return null;
  const desde = P.auto ? Date.parse(P.dia + 'T00:00:00') : P.t;
  const mio = (clases) => M.actividad.find((a) => a.esYo && a.pid === o.pid && a.t > desde && clases.includes(a.clase));
  const porImp = (a, verbo) => `${verbo}${a && a.importe ? ` por ${eur(a.importe)}` : ''}`;
  const resuelve = M.cierreMercado ? ` · se resuelve ${cuando(M.cierreMercado)}` : '';
  switch (o.accion) {
    case 'vender': {
      const a = mio(['venta']);
      if (a) return { estado: 'hecho', texto: porImp(a, 'Vendido') };
      if (o.etiqueta !== 'Aceptar oferta' && M.enVenta && M.enVenta.has(o.pid)) return { estado: 'curso', texto: 'Puesto a la venta: falta aceptar una oferta' };
      return null;
    }
    case 'pujar':
    case 'comprar':
    case 'clausular': {
      const a = mio(['compra', 'clausula']);
      if (a) return { estado: 'hecho', texto: porImp(a, a.clase === 'clausula' ? 'Clausulado' : 'Fichado') };
      if (o.accion !== 'clausular') {
        const m = (M.mercado || []).find((x) => x.pid === o.pid && x.miPuja);
        if (m) return { estado: 'curso', texto: m.tipo === 'manager' ? `Oferta hecha: ${eur(m.miPuja)} · decide ${m.vendedor || 'él'}` : `Pujado ${eur(m.miPuja)}${resuelve}` };
      }
      return null;
    }
    case 'blindar': {
      if (!o.importe) { const a = mio(['blindaje']); return a ? { estado: 'hecho', texto: 'Blindado' } : null; }
      const antes = P.foto && P.foto.clausulas ? P.foto.clausulas[o.pid] : null;
      const ahora = M.mias.find((x) => x.pid === o.pid);
      return antes && ahora && ahora.clausula > antes + 1000 ? { estado: 'hecho', texto: `Cláusula subida a ${eur(ahora.clausula)}` } : null;
    }
    default: return null;
  }
}

const OBJ = { titular: ['bien', 'Para tu once'], revender: ['oro', 'Para revender'], caja: ['', 'Para hacer caja'] };
function objetivoPill(o) {
  const k = String(o.objetivo || '').toLowerCase().replace(/^revend.*/, 'revender');
  const x = OBJ[k];
  if (!x || ['blindar', 'alinear', 'esperar'].includes(o.accion)) return '';
  return `<span class="pill ${x[0]}">${x[1]}${k === 'revender' && o.beneficio_esperado ? ` · ${eur(o.beneficio_esperado, { signo: true })}` : ''}${k === 'revender' && o.vender_el ? ` · vender ${esc(o.vender_el)}` : ''}</span>`;
}

function pasoOp(S, P, o) {
  const j = o.j;
  const ok = hecho(S, P, o);
  // si se ve en LaLiga que lo has hecho, se dice qué y no hace falta el botón
  const liga = hechoEnLiga(S, P, o);
  const imp = o.importe ? `<div class="imp ${o.signo > 0 ? 'mas' : 'menos'}">${o.signo > 0 ? '+' : o.signo < 0 ? '−' : ''}${eur(o.importe)}</div>` : '';
  const puja = o.accion === 'pujar' && o.puja_max ? `<div class="puja">puja hasta ${eur(o.puja_max)}</div>` : '';
  const sub = j ? `${esc(j.equipo || '')}${o.donde ? ` · ${esc(o.donde)}` : ''}` : esc(o.donde || '');
  return `<div class="paso-op ${esc(o.accion)} ${ok ? 'hecho' : ''} ${liga && liga.estado === 'curso' ? 'curso' : ''} ${o.descartada ? 'descartada' : ''}"><span class="num">${liga && liga.estado === 'curso' ? icono('reloj') : ok ? icono('ok') : o.n}</span>
    <div class="op ${ok ? 'hecho' : ''}">
      <div class="op-top"><span class="accion-t ${esc(o.accion)}">${esc(o.etiqueta || ACCION[o.accion] || o.accion)}</span>${o.descartada ? '<span class="pill mal">No lo hagas</span>' : ''}${objetivoPill(o)}${o.cuando ? `<span class="cuando">${icono('reloj')}${esc(o.cuando)}</span>` : ''}</div>
      ${j ? `<button class="op-j" data-j="${esc(j.id)}">${ava(j, 'm')}<div style="min-width:0"><div class="n">${esc(j.nombre)}</div><div class="s">${sub}</div></div><div class="der">${imp}${puja}</div></button>`
        : o.jugador || o.importe ? `<div class="op-j"><div style="min-width:0"><div class="n">${esc(o.jugador || '')}</div><div class="s">${sub}</div></div><div class="der">${imp}${puja}</div></div>` : ''}
      ${o.motivo ? `<p class="motivo">${esc(o.motivo)}</p>` : ''}
      ${Array.isArray(o.claves) && o.claves.length ? `<div class="claves">${o.claves.slice(0, 5).map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      ${o.aviso ? `<div class="aviso-op ${o.descartada ? 'mal' : ''}">${icono(o.descartada ? 'alerta' : 'info')}${esc(o.aviso)}</div>` : ''}
      ${liga ? `<div class="paso-liga ${liga.estado}">${icono(liga.estado === 'curso' ? 'reloj' : 'ok')}<span><b>${liga.estado === 'curso' ? 'En marcha' : 'Hecho en LaLiga'}:</b> ${esc(liga.texto)}</span></div>` : ''}
      <div class="op-pie">${o.confianza ? `<span class="conf ${esc(o.confianza)}">Confianza ${esc(o.confianza)}</span>` : ''}
        ${liga ? '' : `<button data-accion="hecho" data-n="${o.n}">${icono(ok ? 'cerrar' : 'ok')}${ok ? 'Deshacer' : 'Hecho'}</button>`}
        ${o.saldo != null ? `<span class="saldo ${o.saldo < 0 ? 'neg' : ''}">saldo ${eur(o.saldo)}</span>` : ''}</div>
    </div></div>`;
}

/**
 * lo que ha cambiado en tu plantilla desde que la IA hizo el plan (un texto, o null): jugadores que se han ido o han
 * llegado sin que el plan lo dijera. Lo que el plan mandaba hacer (vender a uno, fichar a otro) no cuenta.
 */
export function cambiosDesdePlan(S) {
  const P = S.plan, M = S.M;
  if (!P || P.auto || !P.foto || !Array.isArray(P.foto.mias) || !M) return null;
  const ahora = new Set(M.mias.map((x) => x.pid)), antes = new Set(P.foto.mias);
  const mandado = new Set();
  for (const o of P.ops || []) {
    const id = (o.j && o.j.id) || o.pid;
    if (!id || o.descartada) continue;
    mandado.add(`${o.accion === 'vender' ? 'fuera' : 'dentro'}:${id}`);
  }
  const nombre = (id) => (S.D.maestro[id] && S.D.maestro[id].nombre) || 'uno';
  const fuera = P.foto.mias.filter((id) => !ahora.has(id) && !mandado.has(`fuera:${id}`)).map(nombre);
  const dentro = [...ahora].filter((id) => !antes.has(id) && !mandado.has(`dentro:${id}`)).map(nombre);
  if (!fuera.length && !dentro.length) return null;
  const lista = (l) => (l.length > 2 ? `${l.slice(0, 2).join(', ')} y ${l.length - 2} más` : l.join(' y '));
  return [fuera.length ? `Se ${fuera.length > 1 ? 'han ido' : 'ha ido'} ${lista(fuera)}.` : '', dentro.length ? `${dentro.length > 1 ? 'Han llegado' : 'Ha llegado'} ${lista(dentro)}.` : ''].filter(Boolean).join(' ');
}

function planHTML(S) {
  const { M } = S;
  const P = S.plan;
  const E = S.planEstado || {};
  let h = '';
  const esIA = P && !P.auto;
  // arriba, solo quién lo ha hecho y cuándo; el botón para pedir otro va al final de los pasos (y en la banda si tu liga
  // ha cambiado desde entonces), para no confundirlo con «Actualizar», que trae los datos de LaLiga
  const quien = P ? (esIA ? `${esc(String(nombreModelo(P.modelo) || 'IA').replace(/\s*\(.*?\)/g, ''))}${P.web ? ' + Google' : ''} · ${rel(P.t)}` : 'Automático, sin IA') : '';
  h += `<div class="plan"><div class="plan-cab"><div class="eti">Plan de hoy</div>${quien ? `<span class="plan-quien">${icono(esIA ? 'ia' : 'lista')}${quien}</span>` : ''}</div>`;
  if (E.cargando) h += `<div class="cargando-ia"><div class="t">${icono('ia', 'rojo')} Preparando tu plan</div><div class="p" id="paso-ia">${esc(E.paso || 'Leyendo noticias de tus jugadores y de los que te interesan…')}</div><div class="barra-ia"><i></i></div>${enApp ? '<div class="p2">Tarda uno o dos minutos. Puedes salir de la app: te aviso cuando esté.</div>' : ''}<button class="btn chico sec parar-ia" data-accion="pararPlan">${icono('parar')}Parar</button></div>`;
  if (E.error && E.clave) h += `<div class="error-c"><b>Google no acepta tu clave de la IA.</b> Puede que la hayas borrado en aistudio o que se haya copiado mal. Crea otra en aistudio.google.com/apikey y pégala.${P && P.auto ? '<br>Mientras, tienes el plan automático.' : ''}<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="cambiarClave">Poner otra clave</button><button class="btn chico sec" data-abrir="https://aistudio.google.com/apikey">Abrir aistudio</button></div></div>`;
  else if (E.error) h += `<div class="error-c"><b>La IA no ha podido hacer el plan.</b> ${esc(E.error)}${P && P.auto ? '<br>Mientras, tienes el plan automático.' : ''}<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="plan">Reintentar</button><button class="btn chico sec" data-accion="diag">Ver qué ha pasado</button></div></div>`;
  if (!P) return h + '</div>';
  const cambios = !E.cargando && !(esIA && P.dia && P.viejo) ? cambiosDesdePlan(S) : null;
  if (esIA && P.dia && P.viejo) h += `<div class="banda">${icono('reloj')}<span>Este plan es de ${cuando(P.t)}.</span>${hayClave() && !E.cargando ? '<button data-accion="plan">Hacer el de hoy</button>' : ''}</div>`;
  else if (cambios) h += `<div class="banda plan-cambio">${icono('cambio')}<span>${esc(cambios)} El plan es de antes.</span>${hayClave() ? '<button data-accion="planYa">Rehacer el plan</button>' : ''}</div>`;
  h += `<div class="plan-titular">${esc(P.titular || '')}</div>${P.situacion ? `<p class="plan-sit">${conEnlaces(S, P.situacion)}</p>` : ''}`;
  // pedir otro: justo debajo del resumen, antes de los pasos (al final quedaba a más de una pantalla en el móvil)
  if (hayClave() && !E.cargando) h += `<div class="plan-otro"><button class="btn ancho" data-accion="planYa">${icono('ia')}${esIA ? 'Pedir otro plan a la IA' : 'Hacer el plan con la IA'}</button><p>${esIA ? 'Vuelve a leer tu liga y las noticias (1 o 2 min). «Actualizar» solo trae los datos de LaLiga.' : 'Lee las noticias, las lesiones y los onces probables antes de decidir (1 o 2 min).'}</p></div>`;
  const VISTOS = 4;
  if (P.ops.length > VISTOS + 1) {
    h += `<div class="pasos">${P.ops.slice(0, VISTOS).map((o) => pasoOp(S, P, o)).join('')}</div>`;
    h += `<details class="mas-pasos"><summary>${icono('lista')}Ver los otros ${P.ops.length - VISTOS} pasos</summary><div class="pasos">${P.ops.slice(VISTOS).map((o) => pasoOp(S, P, o)).join('')}</div></details>`;
  } else h += `<div class="pasos">${P.ops.map((o) => pasoOp(S, P, o)).join('')}</div>`;
  if (P.final != null && P.ops.some((o) => o.signo && o.importe)) h += `<div class="cierre ${P.avisoTipo === 'mal' ? 'mal' : P.avisoTipo === 'plan' ? 'oro' : ''}">${icono(P.avisoTipo === 'mal' ? 'alerta' : P.avisoTipo === 'plan' ? 'cambio' : 'euro')}<span>${P.avisoSaldo ? esc(P.avisoSaldo) : 'Te quedas con'}</span><span class="v">${eur(P.final)}</span></div>`;
  if (Array.isArray(P.descartes) && P.descartes.length) h += `<details class="descartes"><summary>${icono('buscar')}Mirados y descartados (${P.descartes.length})</summary>${P.descartes.map((d) => notaJugador(S, d.jugador, d.motivo)).join('')}</details>`;
  if (!hayClave()) h += `<div class="caja" style="margin-top:14px"><b>Este plan sale de los números, sin noticias.</b><p class="t2" style="margin:4px 0 10px">Con la IA (gratis) lee las noticias, las lesiones, las convocatorias y el calendario antes de decidir.</p><button class="btn chico" data-ir="ia">${icono('ia')}Activar la IA</button></div>`;
  if (Array.isArray(P.proximos_dias) && P.proximos_dias.length) h += `<div class="sec"><h2>Los próximos días</h2></div><div class="dias">${P.proximos_dias.map((d) => `<div class="dia"><b>${esc(d.dia)}</b><span>${conEnlaces(S, d.texto)}</span></div>`).join('')}</div>`;
  if (P.paron) h += `<div class="caja">${icono('bandera', 'oro')} <b>El parón.</b> <span class="t2">${conEnlaces(S, P.paron)}</span></div>`;
  // el once, abierto cuando la jornada está cerca; si no, plegado
  const onceH = onceHTML(S, P.alineacion, { sinCab: true });
  if (onceH) {
    const abrir = !!M.enJuego || (M.proxima && M.proxima.ini - Date.now() < 2 * DIA);
    h += `<details class="once-pleg" ${abrir ? 'open' : ''}><summary>${icono('campo')}<b>Tu once</b><span>${M.proxima ? `jornada ${M.proxima.n} · ${cuando(M.proxima.ini)}` : ''}</span></summary>${onceH}</details>`;
  }
  if (Array.isArray(P.vigilar) && P.vigilar.length) h += `<div class="sec"><h2>Vigila</h2></div>${P.vigilar.map((v) => notaJugador(S, v.jugador, v.texto)).join('')}`;
  if (Array.isArray(P.noticias) && P.noticias.length) h += `<div class="sec"><h2>Noticias que te afectan</h2></div>${P.noticias.map((n) => notaJugador(S, n.jugador, n.texto, n.efecto)).join('')}`;
  if (Array.isArray(P.rivales) && P.rivales.length) h += `<div class="sec"><h2>Tus rivales</h2></div>${P.rivales.map((r) => { const tid = M.teamDeManager(r.manager); return `<button class="fila" ${tid ? `data-r="${esc(tid)}"` : ''}><span class="ic-act">${icono('rivales')}</span><div class="fila-c"><div class="fila-n">${esc(r.manager || '')}</div><div class="fila-s" style="white-space:normal">${esc(r.texto || '')}</div></div></button>`; }).join('')}`;
  h += aciertosHTML(M);
  if (P.fuentes && P.fuentes.length) h += `<div class="sec"><h2>Fuentes</h2></div><div class="fuentes">${P.fuentes.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>`;
  return h + '</div>';
}

/** cómo van las recomendaciones de la IA y los puntos esperados de la app (de aprende.js) */
export function aciertosHTML(M) {
  const A = M && M.aprende;
  if (!A) return '';
  const q = A.planes, p = A.prev && !A.prev.poco ? A.prev : null;
  if (!(q && q.n) && !p) return '';
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  let h = `<details class="descartes aciertos"><summary>${icono('diana')}Cómo van sus aciertos${q && q.n ? `: <b>${q.bien} de ${q.n}</b> (${q.pct} %)` : ''}</summary>`;
  if (q && q.n) {
    h += `<p class="t2 peq">Lo que te recomendó la IA hace entre 2 y 30 días y cómo salió: comprar está bien si no ha perdido valor o si saca 6 puntos o más por jornada; vender, si ha bajado o no puntuaba.${q.hechas ? ` De lo que hiciste, ${q.bienHechas} de ${q.hechas} bien.` : ''}</p>`;
    h += q.lista.slice(0, 10).map((x) => `<button class="fila" data-j="${esc(x.pid)}"><span class="ic-act ${x.bien ? 'compra' : 'clausula'}">${icono(x.bien ? 'ok' : 'alerta')}</span><div class="fila-c"><div class="fila-n">${esc({ pujar: 'Pujar', comprar: 'Comprar', clausular: 'Clausular', vender: 'Vender' }[x.accion] || x.accion)} ${esc(x.nombre || '')}</div><div class="fila-s">${cuando(x.t, { hora: false })} a ${eur(x.valor)} · ahora ${eur(x.ahora)}${x.ppj != null ? ` · ${d1(x.ppj)} pts/jornada` : ''}${x.hecho ? '' : ' · no lo hiciste'}</div></div><div class="fila-d"><div class="v ${x.bien ? 'sube' : 'baja'}">${pct(x.dv * 100)}</div><div class="d apag">${x.accion === 'vender' ? 'bajar es bien' : 'subir es bien'}</div></div></button>`).join('');
  }
  if (p) {
    h += `<p class="t2 peq" style="margin-top:10px"><b>Los puntos esperados</b> fallan de media ${d1(p.mae.final)} pts por jugador; en el ${p.dentro2} % se acierta con ±2 (${p.pares} jugadores en ${p.jornadas} jornada${p.jornadas > 1 ? 's' : ''}). Con eso se corrigen solos: ${p.mae.desg != null ? `el desglose por partes pesa un ${Math.round(p.w * 100)} %` : 'aún sin datos del desglose'}${Object.keys(p.sesgo || {}).length ? `; por puestos ${Object.entries(p.sesgo).map(([pos, f]) => `${['', 'POR', 'DEF', 'MED', 'DEL'][pos]} ×${String(Math.round(f * 100) / 100).replace('.', ',')}`).join(', ')}` : ''}.</p>`;
    if (p.porJornada && p.porJornada.length) h += `<div class="previa">${p.porJornada.map((x) => `<span>J${x.n}: esperados <b>${d1(x.previsto)}</b> · sacaste <b>${x.real}</b></span>`).join('')}</div>`;
  }
  return h + '</details>';
}

/** el once: el que propone la IA si es una formación gratuita y cuadra con tus jugadores; si no, el mejor que sale de los números */
export function onceHTML(S, al, { conBanquillo = false, sinCab = false } = {}) {
  const { M } = S;
  const gratis = M.formaciones.map((f) => f.join('-'));
  const todos = Object.values(S.D.maestro);
  const k = (n) => String(n || '').toLowerCase().trim();
  const buscar = (n) => M.mias.map((x) => x.j).find((j) => k(j.nombre) === k(n)) || todos.find((j) => k(j.nombre) === k(n)) || M.mias.map((x) => x.j).find((j) => k(n).includes(k(j.nombre)));
  let form = null, lineas = null, deIA = false, dudas = [];
  if (al && Array.isArray(al.titulares) && gratis.includes(String(al.formacion || '').replace(/\s/g, ''))) {
    const tit = al.titulares.map(buscar).filter(Boolean);
    const f = String(al.formacion).split('-').map(Number);
    const ls = [1, 2, 3, 4].map((p) => tit.filter((j) => j.pos === p));
    if (ls[0].length === 1 && ls[1].length === f[0] && ls[2].length === f[1] && ls[3].length === f[2]) { form = al.formacion; lineas = ls; deIA = true; dudas = al.dudas || []; }
  }
  if (!lineas && M.once && M.once.formacion) { form = M.once.nombre; lineas = M.once.lineas; dudas = M.once.lineas.flat().filter((j) => j.estado === 'doubtful').map((j) => `${j.nombre}: es duda`); }
  if (!lineas) return '';
  const huecos = !deIA && M.once.huecos;
  const banquillo = conBanquillo;
  const modo = S.filtro.campo || 'pp';
  const f = String(form).split('-').map(Number);
  const tit = lineas.flat();
  const total = tit.reduce((s, j) => s + (j.pos < 5 ? M.ppEsperado(j) : 0), 0);
  let h = sinCab ? `<p class="t2 peq" style="margin:2px 0 6px">${deIA ? 'El que propone la IA.' : 'El mejor según la app.'}</p>` : `<div class="sec"><h2>Tu once</h2><span class="sub">${deIA ? 'el de la IA' : 'el mejor según la app'}</span></div>`;
  h += `<div class="campo-cab"><span class="form">${esc(form)}</span><span class="pp"><b>${String(Math.round(total * 10) / 10).replace('.', ',')}</b> pts</span>
    <div class="campo-modo">${[['pp', 'Puntos'], ['valor', 'Valor'], ['forma', 'Forma']].map(([k, t]) => `<button data-filtro="campo:${k}" class="${modo === k ? 'activo' : ''}">${t}</button>`).join('')}</div></div>`;
  // de arriba abajo: delanteros, medios, defensas y el portero; los huecos que falten, como cromos vacíos
  const filas = [3, 2, 1, 0].map((i) => {
    const n = i === 0 ? 1 : f[i - 1] || 0;
    const js = (lineas[i] || []).slice(0, n);
    while (js.length < n) js.push(null);
    return `<div class="linea-c${n >= 5 ? ' cinco' : ''}">${js.map((j) => cromo(M, j, { modo })).join('')}</div>`;
  });
  const ent = M.once && M.once.entrenador;
  h += `<div class="cancha"><i class="l-borde"></i><i class="l-medio"></i><i class="l-circ"></i><i class="l-area arriba"></i><i class="l-area abajo"></i>
    ${filas.join('')}${ent ? `<div class="cr-ent">${cromo(M, ent, { modo, chico: true, ent: true })}</div>` : ''}</div>`;
  if (banquillo) {
    const dentro = new Set([...tit.map((j) => j.id), ent && ent.id]);
    const resto = M.mias.map((x) => x.j).filter((j) => !dentro.has(j.id) && j.pos !== 5).sort((a, b) => a.pos - b.pos || b.valor - a.valor);
    if (resto.length) h += `<div class="banquillo"><div class="banq-t">Banquillo <span>${resto.length}</span></div><div class="banq-l">${resto.map((j) => cromo(M, j, { modo, chico: true })).join('')}</div></div>`;
  }
  h += `<div class="puestos-c">${M.puestos.map((p) => `<span class="pz p${p.pos}${p.faltan ? ' falta' : p.sobran ? ' sobra' : ''}"><b>${['', 'POR', 'DEF', 'MED', 'DEL'][p.pos]}</b> ${p.sanos}${p.faltan ? ` · faltan ${p.faltan}` : p.sobran ? ' · sobran' : ''}</span>`).join('')}</div>`;
  const notas = [];
  if (huecos) notas.push(`<b class="rojo">${huecos > 1 ? `Te faltan ${huecos} jugadores sanos` : 'Te falta un jugador sano'} para completarlo.</b>`);
  if (dudas.length) notas.push(`Dudas: ${esc(dudas.join(' · '))}`);
  notas.push('<span class="leyenda"><i class="facil"></i>rival fácil <i class="media"></i>medio <i class="dificil"></i>difícil · @ fuera de casa</span>');
  h += `<p class="t2 peq">${notas.join('<br>')}</p>`;
  return h;
}

function notaJugador(S, nombre, texto, efecto) {
  const k = String(nombre || '').toLowerCase();
  const j = Object.values(S.D.maestro).find((x) => x.nombre.toLowerCase() === k) || Object.values(S.D.maestro).find((x) => k && x.nombre.toLowerCase().includes(k));
  const mio = j && S.M.mias.some((x) => x.pid === j.id);
  return `<button class="fila" ${j ? `data-j="${esc(j.id)}"` : ''}>${j ? ava(j, 'm') : `<span class="ic-act">${icono('info')}</span>`}<div class="fila-c"><div class="fila-n">${esc(nombre || '')}${mio ? '<span class="pill abierta">Tuyo</span>' : ''}</div><div class="fila-s" style="white-space:normal">${esc(texto || '')}</div></div>${efecto ? `<div class="fila-d cifra ${efecto === 'sube' ? 'sube' : efecto === 'baja' ? 'baja' : 'apag'}">${efecto === 'sube' ? '▲' : efecto === 'baja' ? '▼' : '•'}</div>` : ''}</button>`;
}

/* ================= HOY ================= */
/** un saludo con la fecha (y tu nombre de manager) */
function saludoHTML(S) {
  const h = Number(new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }));
  const sal = h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches';
  // el nombre de manager suele ser el del equipo («U.D. Carlista»): solo se usa si parece un nombre de persona
  const cand = String((S.D.yo && S.D.yo.nombre) || (S.M.yo && S.M.yo.manager) || '').trim();
  const equipo = String((S.M.yo && S.M.yo.nombre) || '').trim();
  const nombre = cand && cand !== equipo && !/[.\d_]|\b(fc|cf|ud|cd|sd|rcd|club|team|united|real)\b/i.test(cand) ? cand.split(/\s+/)[0] : '';
  const fecha = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="saludo"><span>${sal}${nombre ? `, <b>${esc(nombre)}</b>` : ''}</span><span class="t2">${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</span></div>`;
}
export function hoy(S) {
  if (ancho()) return hoyAncho(S);
  const { D, M } = S;
  let h = '';
  h += bandasHoy(S);
  h += saludoHTML(S);
  h += marcador(S);
  h += tiemposHTML(S);
  h += ahoraHTML(S);
  h += llevasHTML(S);
  h += planHTML(S);
  h += noticiasHTML(S);
  void D; void M;
  return h;
}

/** Hoy en el ordenador: el plan en grande a la izquierda y la liga de un vistazo a la derecha */
function hoyAncho(S) {
  const { M } = S;
  let izq = saludoHTML(S) + ahoraHTML(S) + llevasHTML(S) + planHTML(S);
  izq += noticiasHTML(S);
  void M;
  const der = marcador(S) + tiemposHTML(S) + aTiroHTML(S) + movimientosHTML(S, 5);
  return bandasHoy(S) + cols(izq, der);
}
function bandasHoy(S) {
  const { D } = S;
  let h = '';
  if (D.demo) h += `<div class="banda">${icono('info')}<span>Liga de ejemplo con datos inventados.</span><button data-accion="salirDemo">Usar la mía</button></div>`;
  if (D.avisos && D.avisos.length) {
    const graves = D.avisos.some((a) => /formato|vac[ií]/i.test(a.e) || ['jugadores', 'plantillas', 'tu plantilla', 'mercado'].includes(a.paso));
    h += `<div class="banda">${icono('alerta')}<span>No se ha podido leer: ${esc(D.avisos.map((a) => a.paso).slice(0, 3).join(', '))}${D.avisos.length > 3 ? ` y ${D.avisos.length - 3} más` : ''}.${graves ? ' Lo que depende de eso puede salir incompleto.' : ''}</span><button data-accion="${graves ? 'mandarFallo' : 'diag'}">${graves ? 'Avisar' : 'Ver'}</button></div>`;
  }
  return h;
}
/** las cláusulas de rivales que te llegan y se abren ya o pronto */
function aTiroHTML(S) {
  const { M } = S;
  const parar = M.clausulas.filter((x) => x.meLlega && x.interes >= 45 && (x.abierta || x.abreEn < 2 * DIA))
    .sort((a, b) => (a.abierta === b.abierta ? (a.abierta ? b.interes - a.interes : a.abreEn - b.abreEn) : a.abierta ? -1 : 1)).slice(0, ancho() ? 6 : 10);
  if (!parar.length) return '';
  return `<div class="sec"><h2>Cláusulas a tiro</h2><button class="mas" data-ir="rivales" data-seg="rivales:clausulas">Todas</button></div><div class="carril">${parar.map((x) => `<button class="tj" data-j="${esc(x.pid)}"><span class="esq">${x.interes}</span>${ava(x.j)}
      <div class="n">${esc(x.j.nombre)}</div><div class="s">de ${esc(x.rival.manager || x.rival.nombre)}</div>
      <div class="gr">${eur(x.clausula)}</div>
      <div class="cuenta ${x.abierta ? 'ya' : ''}">${icono(x.abierta ? 'abierto' : 'reloj')}${x.abierta ? 'Abierta' : cuando(x.protegidoHasta)}</div></button>`).join('')}</div>`;
}
function noticiasHTML(S) {
  const { M } = S;
  if (!M.noticias.length) return '';
  const mios = new Set(M.mias.map((x) => x.pid));
  const tuyas = M.noticias.filter((n) => (n.pids || []).some((p) => mios.has(p)));
  const resto = M.noticias.filter((n) => !tuyas.includes(n));
  const n = ancho() ? 8 : 6;
  return `<div class="sec"><h2>Noticias</h2><span class="sub">${tuyas.length ? `${tuyas.length} de los tuyos` : 'Google Noticias'}</span></div><div class="noticias-l">${[...tuyas.slice(0, 4), ...resto.slice(0, n - Math.min(4, tuyas.length))].map(filaNoticia).join('')}</div>`;
}
function movimientosHTML(S, n) {
  const act = S.M.actividad.filter((a) => a.clase !== 'premio').slice(0, n);
  return act.length ? `<div class="sec"><h2>Últimos movimientos</h2><button class="mas" data-ir="rivales" data-seg="rivales:movimientos">Todos</button></div>${act.map(filaActividad).join('')}` : '';
}

/* ================= TUS JUGADORES EN VENTA ================= */
const CONSEJO = { aceptar: '<span class="pill bien">Acepta</span>', esperar: '<span class="pill duda">Espera</span>', 'sin ofertas': '<span class="pill">Sin ofertas</span>' };
export function ventaHTML(v) {
  const m = v.mejor;
  const ofs = v.ofertas.map((o) => `<div class="oferta"><span class="de ${o.deLiga ? 'liga' : ''}">${esc(o.de)}</span><span class="cifra">${eur(o.importe)}</span><span class="${o.sobre >= 0 ? 'sube' : 'baja'} cifra">${pct(o.sobre * 100)}</span>${o.caduca ? `<span class="apag">${icono('reloj')}${cuando(o.caduca)}</span>` : ''}</div>`).join('');
  return `<div class="venta"><button class="fila" data-j="${esc(v.pid)}">${ava(v.j)}
      <div class="fila-c"><div class="fila-n">${posTag(v.j)}<span>${esc(v.j.nombre)}</span></div>
        <div class="fila-s">Puesto a ${eur(v.precio)} · vale ${eur(v.j.valor)}${v.compra ? ` · pagaste ${eur(v.compra)}` : ''}</div>
        <div class="fila-x">${CONSEJO[v.consejo] || ''}${v.ofertas.length ? `<span class="pill">${v.ofertas.length} oferta${v.ofertas.length === 1 ? '' : 's'}</span>` : ''}</div></div>
      <div class="fila-d">${m ? `<div class="v ${m.sobre >= 0 ? 'sube' : ''}">${eur(m.importe)}</div><div class="d apag">mejor oferta</div>` : '<div class="d apag">sin ofertas</div>'}</div></button>
    ${ofs ? `<div class="ofertas">${ofs}</div>` : ''}${v.ligaEst ? `<p class="t2 peq" style="margin:6px 0 0">La oferta de LaLiga llegará con el cambio de mercado y rondará <b>${eur(v.ligaEst.v)}</b>${v.ligaEst.sinDatos ? ' (cerca de su valor)' : ` (en tu liga ofrece de mediana un ${pct(v.ligaEst.med * 100)} sobre el valor)`}.</p>` : ''}${v.porque ? `<p class="t2 peq" style="margin:6px 0 0">${esc(v.porque)}${v.ganado != null ? ` Con la mejor oferta ganas <b class="${clase(v.ganado)}">${eur(v.ganado, { signo: true })}</b> sobre lo que pagaste.` : ''}</p>` : ''}</div>`;
}

/* ================= EQUIPO ================= */
/** las subpestañas, con un número al lado cuando hay algo que contar ([clave, texto, número, 'rojo'|'']) */
// las pestañas de cada pantalla: se quedan fijas arriba al bajar (el ancla marca dónde van, para volver a ellas)
const tabs = (v, actual, lista) => `<div class="tabs-ancla"></div><div class="tabs"><div class="tabs-in" role="tablist">${lista.map(([k, t, n, cls]) => `<button data-seg="${v}:${k}" role="tab" aria-selected="${actual === k}" class="${actual === k ? 'activo' : ''}">${t}${n ? `<span class="tab-n ${cls || ''}">${n}</span>` : ''}</button>`).join('')}</div></div>`;

export function equipo(S) {
  const { M, H, D } = S;
  const seg = S.seg.equipo || 'plantilla';
  const op = (pid) => S.opPorPid[pid];
  let h = `<div class="eti">Tu equipo</div><div class="titulo">${esc((M.yo && M.yo.nombre) || 'Tu equipo')}</div><p class="entradilla">${M.mias.length} jugadores · ${eur(D.valorEquipo)}${M.yo ? ` · ${M.yo.pos}º con ${M.yo.puntos} pts` : ''}</p>`;
  const abiertasE = M.mias.filter((x) => x.abierta && x.clausula).length, riesgoE = M.mias.filter((x) => x.riesgo === 'alto').length;
  const aVender = M.mias.filter((x) => x.ventaInercia).length;
  void aVender;
  h += tabs('equipo', seg, [['plantilla', 'Plantilla', M.mias.length], ['venta', 'En venta', M.misVentas.length], ['clausulas', 'Cláusulas', abiertasE, riesgoE ? 'rojo' : ''], ['dinero', 'Beneficio']]);
  if (!M.mias.length) return h + nada(S.D && S.D.ligas && S.D.ligas.length > 1 ? 'No encuentro tu equipo en esta liga con tu cuenta de LaLiga. Toca el nombre de la liga, arriba, para cambiar a otra de tus ligas.' : 'No encuentro tu equipo en esta liga con tu cuenta de LaLiga. Si acabas de entrar en ella, prueba a actualizar en un rato.');

  if (seg === 'plantilla') {
    const arriba = equipoHoyHTML(S, { corto: true }) + onceHTML(S, null, { conBanquillo: true });
    let l = '';
    const titulares = new Set((M.once ? M.once.lineas.flat() : []).map((j) => j.id));
    for (const p of [1, 2, 3, 4, 5]) {
      const xs = M.mias.filter((x) => x.j.pos === p);
      if (!xs.length) continue;
      l += `<div class="grupo"><span>${POS_PLURAL[p]}${p === 5 ? ' · no puntúan en la versión gratis' : ''}</span><span>${eur(xs.reduce((s, x) => s + x.j.valor, 0))}</span></div>`;
      l += xs.map((x) => {
        void titulares;
        return filaJugador(x, {
          sub: `${esc(x.j.equipo)}${x.prox ? ` · ${rivalSub(M, x.j)}` : ''}`,
          pills: [
            estadoPill(x.j),
            x.ventaInercia && !op(x.pid) && !bloqueada('inercia') ? `<span class="pill ${x.ventaInercia.urgencia === 'ya' ? 'mal' : 'duda'}">${icono(x.ventaInercia.urgencia === 'ya' ? 'baja' : 'reloj')}${x.ventaInercia.urgencia === 'ya' ? 'Ha girado: vender' : 'Frenando: vender'}</span>` : '',
            M.enVenta.has(x.pid) ? '<span class="pill abierta">En venta</span>' : '',
            x.riesgo === 'alto' ? `<span class="pill mal">${icono('abierto')}Cláusula en riesgo</span>` : '',
            M.reventa[x.pid] ? '<span class="pill oro">Para revender</span>' : '',
            avisoOnce(M, x.j), calPill(M, x.j, { soloDuro: true }),
          ],
          conMini: true, op: op(x.pid),
        });
      }).join('');
    }
    // en el ordenador, el once a la izquierda y la plantilla al lado
    h += ancho() ? cols(arriba, l, 'lado-izq') : arriba + l;
  } else if (seg === 'venta') {
    h += M.misVentas.length ? lista2(M.misVentas.map(ventaHTML).join('')) : nada('No tienes a nadie en venta. Cuando pongas a alguien en el mercado, aquí verás sus ofertas (la de LaLiga y las de otros managers) y si te conviene aceptar.');
  } else if (seg === 'clausulas') {
    const xs = [...M.mias].sort((a, b) => (a.abierta === b.abierta ? a.abreEn - b.abreEn : a.abierta ? -1 : 1));
    const abiertas = xs.filter((x) => x.abierta).length;
    const ES = M.escudosMios;
    h += `<p class="t2 peq">${abiertas ? `<b>${abiertas}</b> de tus jugadores se pueden clausular ya.` : 'Todos tus jugadores están protegidos ahora.'}${ES ? ` Te quedan <b>${ES.quedan} de 2 blindajes</b> esta jornada (en LaLiga, viendo un anuncio: ${ES.horas} h protegido).` : ''} Si te clausulan a uno, cobras su cláusula: el riesgo es perder lo que te puntúa. Con la cláusula un 30 % o más por encima de su valor (o por encima de lo que se paga en los clausulazos de tu liga) no hay riesgo, y menos si está bajando.</p>`;
    const filaCl = (x) => filaJugador(x, {
      sub: `${x.abierta ? `<span class="rojo">Abierta</span> · cláusula ${eur(x.clausula)}` : `Se abre ${cuando(x.protegidoHasta)} · ${eur(x.clausula)}`}${x.ratio ? ` (${pct((x.ratio - 1) * 100, 0)})` : ''}`,
      extra: `${x.escudo ? `<span class="pill pronto">${icono('escudo')}Blindado · ${cuando(x.escudo).replace(/^hoy /, '')}</span>` : (S.M.paraEscudo || []).includes(x.pid) ? `<span class="pill plan">${icono('escudo')}Blíndalo gratis</span>` : ''}<span class="pill ${x.riesgo === 'alto' ? 'mal' : x.riesgo === 'medio' ? 'duda' : ''}">${x.riesgo === 'ninguno' ? 'Sin riesgo' : `Riesgo ${x.riesgo}`}</span>${x.pagan && (x.abierta || x.abreEn < 3 * DIA) && (x.pagan.seguro.length || x.pagan.quiza.length) ? `<span class="pill ${x.pagan.seguro.length ? 'mal' : 'duda'}">${icono('rivales')}Le llega a ${x.pagan.seguro.length + x.pagan.quiza.length}</span>` : x.pagan && x.pagan.hayDatos && x.abierta ? '<span class="pill bien">No le llega a nadie</span>' : ''}${x.blindaje && !x.blindaje.yaVale && !x.blindaje.caro ? `<span class="pill">Subirla a ${eur(x.blindaje.objetivo, { dec: 1 })}: ${eur(x.blindaje.coste, { dec: 1 })}</span>` : ''}`,
      derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d apag">${x.abierta ? 'abierta' : dura(x.abreEn)}</div>`, op: op(x.pid),
    });
    const grupos = [['Abiertas: te los pueden quitar ya', xs.filter((x) => x.abierta)], ['Se abren en menos de 48 h', xs.filter((x) => !x.abierta && x.abreEn < 2 * DIA)], ['Protegidos', xs.filter((x) => !x.abierta && x.abreEn >= 2 * DIA)]];
    let gl = '';
    for (const [t, l] of grupos) if (l.length) gl += `<div class="grupo"><span>${t}</span><span>${l.length}</span></div>${l.map(filaCl).join('')}`;
    h += lista2(gl);
  } else {
    const con = M.mias.filter((x) => x.compra).sort((a, b) => b.ganado - a.ganado);
    const serie = (H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
    const resumen = `<div class="rejilla"><div class="dato"><div class="et">Ganado sobre lo pagado</div><div class="v ${clase(M.ganadoTotal)}">${M.conCompra ? eur(M.ganadoTotal, { signo: true }) : '–'}</div></div>
      <div class="dato"><div class="et">Con precio de compra</div><div class="v">${con.length}<small>de ${M.mias.length}</small></div></div></div>
      <div class="sec"><h2>Valor del equipo</h2></div>${linea(serie, { alto: ancho() ? 220 : 150 })}`;
    const lista = `<div class="sec"><h2>Jugador a jugador</h2></div>${con.length ? con.map((x) => filaJugador(x, {
      sub: `Pagaste ${eur(x.compra)} · vale ${eur(x.j.valor)}`,
      derecha: `<div class="v ${clase(x.ganado)}">${eur(x.ganado, { signo: true })}</div><div class="d ${clase(x.ganado)}">${pct((x.j.valor / x.compra - 1) * 100)}</div>`, op: op(x.pid),
    })).join('') : nada('Aún no sé lo que pagaste por tus jugadores: sale de los movimientos de la liga, que guardan unas semanas.')}`;
    h += ancho() ? cols(resumen, lista, 'mitades') : resumen + lista;
  }
  return h;
}

/* ================= RIVALES ================= */
export function rivales(S) {
  const { M } = S;
  const seg = S.seg.rivales || 'clasif';
  let h = `<div class="eti">${esc(S.D.liga.nombre)}</div><div class="titulo">Rivales</div>`;
  const llegan = M.clausulas.filter((x) => x.meLlega && x.abierta && x.interes >= 45).length;
  const movs7 = M.actividad.filter((a) => a.clase !== 'premio' && a.t && Date.now() - a.t < DIA).length;
  h += tabs('rivales', seg, [['clasif', 'Clasificación'], ['clausulas', 'Cláusulas', llegan, llegan ? 'verde' : ''], ['movimientos', 'Movimientos', movs7]]);

  if (seg === 'clasif') {
    const tabla = S.D.clasif.map((e) => {
      const r = M.rivales.find((x) => x.e.teamId === e.teamId);
      const yo = !r;
      return `<button class="fila ${yo ? 'yo-fila' : ''}" ${yo ? 'data-ir="equipo"' : `data-r="${esc(e.teamId)}"`}>
        <span class="posn ${yo ? 'yo' : ''}">${e.pos}</span>
        <div class="fila-c"><div class="fila-n">${esc(e.nombre)}</div>
          <div class="fila-s">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${eur(e.valor)}${r && r.dValor != null ? ` · <span class="${clase(r.dValor)}">${eur(r.dValor, { signo: true, dec: 1 })} 7d</span>` : ''}${r && M.yo ? ` · ${e.puntos > M.yo.puntos ? `te saca ${e.puntos - M.yo.puntos}` : e.puntos < M.yo.puntos ? `le sacas ${M.yo.puntos - e.puntos}` : 'empatados'}` : ''}</div>
          ${r ? `<div class="fila-x">${r.dinero && r.dinero.v != null ? (bloqueada('dineroRivales') ? candadoMini('dineroRivales', 'Dinero') : `<span class="pill ${r.dinero.exacto ? '' : 'estim'}" title="${r.dinero.exacto ? 'Saldo exacto' : 'Saldo estimado'}">${icono('euro')}${dineroCorto(r.dinero)}</span>`) : ''}${r.nivel !== 'baja' ? `<span class="amenaza ${r.nivel}">Peligro ${PELIGRO[r.nivel]}</span>` : ''}${r.leLleganYa && r.leLleganYa.length && !bloqueada('quienPaga') ? `<span class="pill mal">Te puede quitar ${r.leLleganYa.length}</span>` : r.meLlegan ? `<span class="pill abierta">${r.meLlegan} a tiro</span>` : ''}</div>` : ''}
        </div>
        <div class="fila-d"><div class="v">${e.puntos}</div><div class="d apag">pts${e.puntosJornada ? ` · ${e.puntosJornada} últ.` : ''}</div></div></button>`;
    }).join('');
    // en el ordenador, al lado de la clasificación: lo que te llega de ellos y lo último que han hecho
    h += ancho() ? cols(tabla, aTiroHTML(S) + movimientosHTML(S, 10)) : tabla;
  } else if (seg === 'clausulas') {
    const f = S.filtro.cl || 'llegan';
    h += `<div class="filtros">${[['llegan', 'Te llegan'], ['pronto', 'Se abren pronto'], ['todas', 'Todas']].map(([k, t]) => `<button data-filtro="cl:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.clausulas;
    if (f === 'llegan' || f === 'abiertas') xs = xs.filter((x) => x.meLlega && (x.abierta || x.abreEn < 2 * DIA));
    if (f === 'pronto' || f === 'hoy' || f === 'semana') xs = xs.filter((x) => !x.abierta && x.abreEn < 7 * DIA).sort((a, b) => a.abreEn - b.abreEn);
    void HORA;
    h += `<p class="t2 peq">Para clausular tienes <b>${eur(S.D.dinero)}</b>: las cláusulas se pagan con saldo, sin deuda. La barra es lo que te interesa: rendimiento, si sube y lo que cuesta sobre su valor.</p>`;
    h += xs.length ? lista2(xs.slice(0, 80).map((x) => filaJugador(x, {
      sub: `de ${esc(x.rival.manager || x.rival.nombre)} · vale ${eur(x.j.valor)}`,
      pills: [clausulaPill(x), estadoPill(x.j), avisoOnce(M, x.j), calPill(M, x.j, { soloDuro: true }), x.meLlega ? '' : '<span class="pill">No te llega</span>'],
      derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${barra(x.interes)} <span class="t2">${x.interes}</span></div>`, op: S.opPorPid[x.pid],
    })).join('')) : nada('Ninguna con este filtro.');
  } else {
    const f = S.filtro.mov || 'todos';
    h += `<div class="filtros">${[['todos', 'Todo'], ['clausula', 'Cláusulas'], ['compra', 'Fichajes'], ['venta', 'Ventas'], ['blindaje', 'Blindajes']].map(([k, t]) => `<button data-filtro="mov:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.actividad.filter((a) => a.clase !== 'premio');
    if (f !== 'todos') xs = xs.filter((a) => a.clase === f);
    const cambios = f === 'todos' || f === 'blindaje' ? M.cambios.filter((m) => m.tipo === 'blinda') : [];
    let ml = '';
    if (cambios.length) {
      ml += `<div class="grupo"><span>Vistos en sus plantillas</span></div>` + cambios.slice(0, 8).map((m) => `<button class="fila" data-j="${esc(m.pid)}"><span class="ic-act blindaje">${icono('escudo')}</span><div class="fila-c"><div class="act-t"><span class="quien">${esc((m.equipo || {}).manager || (m.equipo || {}).nombre || 'Un rival')}</span> subió la cláusula de <b>${esc(m.j.nombre)}</b></div><div class="fila-s">${cuando(m.t)} · de ${eur(m.de)} a ${eur(m.a)}</div></div></button>`).join('');
      ml += `<div class="grupo"><span>Actividad de la liga</span></div>`;
    }
    ml += xs.length ? xs.slice(0, 120).map(filaActividad).join('') : nada('Sin movimientos con este filtro.');
    h += lista2(ml);
  }
  return h;
}

/* ================= MERCADO ================= */
export function mercado(S) {
  const { M } = S;
  let seg = S.seg.mercado || 'venta';
  // las antiguas Suben / Bajan / Libres son ahora filtros de Tendencias
  if (['suben', 'bajan', 'libres'].includes(seg)) { S.filtro.tend = seg; seg = S.seg.mercado = 'tendencias'; }
  let h = `<div class="eti">${M.cierreMercado ? `Cambia ${cuando(M.cierreMercado)} · en ${dura(M.cierreMercado - Date.now())}` : 'Mercado de hoy'}</div><div class="titulo">Mercado</div><p class="entradilla">Puedes gastar hasta <b>${eur(M.pujaMax)}</b>.</p>`;
  h += tabs('mercado', seg, [['venta', 'Fichar', M.mercado.filter((m) => !M.enVenta.has(m.pid)).length], ['especular', 'Especular', (M.especular || []).length, (M.especular || []).length ? 'verde' : ''], ['tendencias', 'Tendencias']]);
  const tagV = { chollo: '<span class="pill chollo">Chollo</span>', sube: '<span class="pill bien">Subiendo</span>', caro: '<span class="pill duda">Caro</span>', evitar: '<span class="pill mal">Evitar</span>', baja: '<span class="pill mal">Bajando</span>', frena: '<span class="pill duda">Frenando</span>', normal: '' };
  const dueno = (pid) => { const t = M.dueno[pid]; if (!t) return 'Libre'; if (t === S.D.yo.teamId) return '<span class="rojo">Tuyo</span>'; return esc((M.equipo[t] || {}).manager || (M.equipo[t] || {}).nombre || 'Rival'); };

  if (seg === 'venta') {
    const liga = M.mercado.filter((m) => m.tipo === 'liga'), man = M.mercado.filter((m) => m.tipo === 'manager' && !M.enVenta.has(m.pid));
    const misPujasN = M.mercado.filter((m) => m.miPuja).length;
    if (misPujasN) h += `<p class="t2 peq" style="margin:0 0 6px">Tienes ${misPujasN} puja${misPujasN > 1 ? 's' : ''} hecha${misPujasN > 1 ? 's' : ''} por ${eur(M.misPujas)} en total.</p>`;
    if (M.misVentas.length) h += `<p class="t2 peq" style="margin:0 0 6px">Lo que tienes tú en venta está en <button class="rojo" data-ir="equipo" data-seg="equipo:venta">Equipo → En venta</button>.</p>`;
    const fila = (m) => filaJugador(m, {
      sub: m.tipo === 'manager' ? `${esc(m.j.equipo)} · lo vende <b>${esc(m.vendedor || 'un manager')}</b>` : `${esc(m.j.equipo)}${m.prox ? ` · ${rivalSub(M, m.j)}` : ''}`,
      pills: [
        m.miPuja ? `<span class="pill abierta">${m.tipo === 'manager' ? 'Tu oferta' : 'Tu puja'} ${eur(m.miPuja)}</span>` : '',
        m.noVende ? `<span class="pill mal" title="${esc(`No te lo venderá: ${m.noVende}`)}">No lo venderá: ${esc(m.noVende.replace(/^es /, ''))}</span>` : '',
        estadoPill(m.j), m.noVende ? '' : tagV[m.veredicto] || '', avisoOnce(M, m.j), calPill(M, m.j, { soloDuro: true }),
        m.tipo === 'liga' && m.pujas ? `<span class="pill">${m.pujas} puja${m.pujas > 1 ? 's' : ''}</span>` : '',
      ],
      derecha: `<div class="v">${eur(m.precio)}</div><div class="d">${delta(m.tend)}</div>${m.tipo === 'liga' && !m.miPuja ? `<div class="d apag">puja ${eur(m.puja, { dec: 1 })}</div>` : m.ofertaMin && !m.miPuja && m.puja > m.precio && !m.noVende ? `<div class="d apag">ofrece ${eur(m.puja, { dec: 1 })}</div>` : ''}`, op: S.opPorPid[m.pid],
    });
    const PL = M.pujasLiga;
    const pagaTxt = PL && !PL.poco ? `<p class="t2 peq" style="margin:4px 0 2px">En tu liga se llevan con un <b>${pct(PL.med * 100)}</b> sobre su valor de mediana. A la derecha, la puja que te propongo.</p>` : '';
    let ml = liga.length ? `<div class="grupo"><span>Libres · subasta a ciegas</span><span>${liga.length}</span></div>${pagaTxt}${liga.map(fila).join('')}` : nada('No hay jugadores libres en el mercado ahora.');
    if (man.length && bloqueada('ventasRivales')) ml += `<div class="grupo"><span>Los vende otro manager</span><span>${man.length}</span></div>${candado('ventasRivales')}`;
    else if (man.length) ml += `<div class="grupo"><span>Los vende otro manager</span><span>${man.length}</span></div><p class="t2 peq" style="margin:4px 0 2px">Siguen siendo suyos y LaLiga también les hace una oferta: solo te lo vende si la tuya es mejor. A la derecha, lo que tendrías que ofrecer.</p>${man.map(fila).join('')}`;
    h += lista2(ml);
  } else if (seg === 'especular') {
    const v = M.ventanaEsp;
    if (!v || v.ciclos < 1) h += nada(M.enJuego ? 'Con la jornada en juego no se especula: espera a que acabe.' : 'No da tiempo a comprar y vender antes de la jornada.');
    else {
      h += `<p class="t2 peq">Comprar ahora lo que sube y venderlo antes de la jornada, aunque no te haga falta. Entre medias puedes bajar hasta <b>${eur(-M.deuda)}</b>; lo único obligatorio es empezar la jornada en positivo. Ponlo a la venta <b>${cuando(v.ponerVenta)}</b> para aceptar la oferta del cambio de mercado de <b>${cuando(v.ultimoMercado)}</b> (el del mismo día de la jornada no cuenta). Cuenta con la tendencia de los últimos días, que puede cambiar.</p>`;
      if (M.paraRevender.length) h += `<div class="grupo"><span>Ya tienes para revender</span></div>${M.paraRevender.map((x) => filaJugador(x, { sub: `Comprado a ${eur(x.rev.precio)} · vale ${eur(x.j.valor)}`, derecha: `<div class="v ${clase(x.beneficioYa)}">${eur(x.beneficioYa, { signo: true })}</div><div class="d">${delta(x.tend)}</div>` })).join('')}`;
      h += M.especular.length ? lista2(`<div class="grupo"><span>Candidatos</span><span>${M.especular.length}</span></div>` + M.especular.slice(0, 30).map((e) => filaJugador({ j: e.j, tend: e.tend }, {
        sub: `${e.origen === 'mercado' ? `Mercado · puja ${eur(e.puja)}` : `Cláusula ${eur(e.precio)} a ${esc(e.rival.manager || e.rival.nombre)}`}`,
        extra: `<span class="pill bien">${pct(e.r * 100)}/día</span><span class="pill">${e.dias} día${e.dias > 1 ? 's' : ''}</span><span class="pill ${e.confianza === 'media' ? 'duda' : ''}">Confianza ${e.confianza}</span>`,
        derecha: `<div class="v sube">${eur(e.beneficio, { signo: true })}</div><div class="d apag">${pct(e.pct * 100)}</div>`, op: S.opPorPid[e.pid],
      })).join('')) : nada('Ahora mismo nada sube lo bastante como para sacarle beneficio antes de la jornada.');
    }
  } else {
    const f = S.filtro.tend || 'suben';
    h += `<div class="filtros">${[['suben', 'Suben'], ['bajan', 'Bajan'], ['libres', 'Sin dueño']].map(([k, t]) => `<button data-filtro="tend:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    if (f === 'libres') {
      h += `<p class="t2 peq">Nadie los tiene en tu liga. Ordenados por lo que interesan: pueden salir en el mercado cualquier día.</p>`;
      h += lista2(M.libresBuenos.map((x) => filaJugador({ j: x.j, tend: x.t }, { pills: [estadoPill(x.j)], sub: `${esc(x.j.equipo)}${x.j.media ? ` · ${String(Math.round(x.j.media * 10) / 10).replace('.', ',')} pts por partido` : ''}`, derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d">${delta(x.t)}</div>` })).join('') || nada('Sin datos.'));
    } else {
      const xs = f === 'suben' ? M.suben : M.bajan;
      h += `<p class="t2 peq">Toda LaLiga. ${f === 'suben' ? 'Comprar antes de que suban es cómo se saca beneficio.' : 'Si tienes alguno, piensa en venderlo antes de que pierda más.'}</p>`;
      h += xs.length ? lista2(xs.map((x) => filaJugador({ j: x.j, tend: x.t }, { sub: `${esc(x.j.equipo)} · ${dueno(x.j.id)}`, conMini: true, op: S.opPorPid[x.j.id] })).join('')) : nada('Aún no hay subidas: futbolfantasy.com no ha contestado y la app necesita un par de días de histórico.');
    }
  }
  return h;
}

/** los chats anteriores, para volver a uno */
export function chatsViejosHTML() {
  const l = chatsAnteriores();
  let h = `<div class="hoja-cab"><h2>Chats anteriores</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (!l.length) return h + nada('Aún no has empezado ningún chat nuevo.');
  h += `<p class="t2 peq" style="margin:0 0 8px">Al abrir uno, el de ahora se guarda aquí. Se guardan los 15 últimos.</p>`;
  h += l.map((c, i) => `<div class="fila chat-viejo"><span class="ic-act">${icono('ia')}</span><div class="fila-c"><div class="fila-n" style="white-space:normal">${esc(c.titulo)}</div><div class="fila-s">${cuando(c.ini || c.t)} · ${c.n} mensaje${c.n === 1 ? '' : 's'}</div></div><div class="chat-viejo-acc"><button class="btn chico sec" data-accion="recuperarChat" data-i="${i}">Abrir</button><button class="b-ico" data-accion="borrarChatViejo" data-i="${i}" aria-label="Borrar">${icono('cerrar')}</button></div></div>`).join('');
  return h;
}

/* ================= PREGUNTA (el chat) ================= */
/** preguntas pensadas para tu liga de hoy (si no hay nada especial, las de siempre) */
function sugerenciasDe(S) {
  const { M } = S;
  const out = [];
  const add = (t) => { if (t && !out.includes(t) && out.length < 6) out.push(t); };
  if (M) {
    const vi = M.mias.filter((x) => x.ventaInercia).sort((a, b) => b.ventaInercia.perder - a.ventaInercia.perder)[0];
    if (vi) add(`¿Vendo ya a ${vi.j.nombre}? ${vi.ventaInercia.urgencia === 'ya' ? 'Ha girado a la baja' : 'Se está frenando'}`);
    const cl = M.clausulas.find((x) => x.abierta && x.meLlega && x.interes >= 55);
    if (cl) add(`¿Clausulo a ${cl.j.nombre} por ${eur(cl.clausula)}?`);
    const ml = M.mercado.find((m) => m.tipo === 'liga' && m.interes >= 55);
    if (ml) add(`¿Cuánto pujo por ${ml.j.nombre}?`);
    const rg = M.mias.find((x) => x.riesgo === 'alto');
    if (rg) add(`¿Blindo a ${rg.j.nombre} o me arriesgo?`);
    const of = (M.misVentas || []).find((v) => v.mejor);
    if (of) add(`¿Acepto la oferta de ${eur(of.mejor.importe)} por ${of.j.nombre}?`);
    if (M.paron && M.paron.ini - Date.now() < 7 * DIA) add('¿Qué hago antes del parón?');
  }
  for (const t of SUGERENCIAS) add(t);
  return out;
}
const SUGERENCIAS = ['¿A quién clausulo hoy y por qué?', '¿Qué vendo para tener dinero sin perder puntos?', '¿Cuánto pujo por el mejor del mercado?', '¿Qué once pongo esta jornada?', '¿Qué hago antes del parón?', '¿Qué rival va a por mis jugadores?'];
/** las fotos que van con la próxima pregunta (en la caja de escribir) */
export function adjuntosHTML(S) {
  const fs = S.adjuntos || [];
  if (!fs.length && !S.preparandoFotos) return '';
  return `${fs.map((f, i) => `<span class="adj"><img src="${f.mini}" alt="Foto ${i + 1}"><button data-accion="quitarFoto" data-i="${i}" aria-label="Quitar la foto ${i + 1}">${icono('cerrar')}</button></span>`).join('')}${S.preparandoFotos ? `<span class="adj cargando" aria-label="Preparando la foto"><i></i></span>` : ''}<span class="adj-txt">${fs.length ? `${fs.length} foto${fs.length > 1 ? 's' : ''} para mandar` : 'Preparando…'}</span>`;
}
/** las fotos de un mensaje del chat */
const fotosMsg = (fs, m) => (fs && fs.length ? `<div class="msg-fotos">${fs.map((f, i) => `<button data-accion="verFoto" data-m="${m}" data-i="${i}" aria-label="Ver la foto ${i + 1}"><img src="${f.mini}" alt=""></button>`).join('')}</div>` : '');

export function ia(S) {
  if (!hayClave()) return guiaClave();
  const msgs = conversacion();
  const viejos = chatsAnteriores();
  let h = `<div class="chat${(S.adjuntos || []).length ? ' con-adj' : ''}"><div class="chat-cab"><div><div class="eti">Pregunta</div><div class="titulo">Tu director deportivo</div></div>
    <div class="chat-acc">${viejos.length ? `<button class="btn chico sec" data-accion="chatsViejos">${icono('lista')}Anteriores (${viejos.length})</button>` : ''}${msgs.length ? `<button class="btn chico" data-accion="nuevoChat">${icono('mas')}Nuevo chat</button>` : ''}</div></div>`;
  const ns = notasVigentes();
  if (ns.length) h += `<details class="notas"><summary>${icono('nota')}Recuerda ${ns.length} cosa${ns.length > 1 ? 's' : ''} que le has contado</summary>${ns.map((n) => `<div class="nota"><span>${esc(n.texto)}<small>${cuando(n.t)}${n.caduca ? ` · hasta ${cuando(n.caduca, { hora: false })}` : ''}</small></span><button data-accion="borrarNota" data-id="${esc(n.id)}" aria-label="Olvidar">${icono('cerrar')}</button></div>`).join('')}<p class="t2 peq" style="margin:6px 2px 2px">Lo recuerda aunque empieces un chat nuevo. Toca la × para que lo olvide.</p></details>`;
  if (!msgs.length && !S.charlando) {
    h += `<p class="entradilla">Sabe todo lo de tu liga ahora mismo y busca noticias antes de contestar. Cuéntale también lo que no sale en la app (un amigo te ofrece un jugador, a quién no quieres vender): lo apunta y cuenta en el plan. Puedes hablarle con el micro o mandarle capturas (del mercado, de una oferta, de un chat) con el botón de la foto.</p>`;
    h += `<div class="sugerencias">${sugerenciasDe(S).map((x) => `<button data-sugerencia="${esc(x)}">${icono('ia')}${esc(x)}</button>`).join('')}</div>`;
  }
  const ultimaIA = [...msgs].reverse().find((m) => m.r === 'ia');
  const hora = (ts) => (ts ? cuando(ts) : '');
  h += msgs.map((m, i) => (m.r === 'yo'
    ? `<div class="msg yo${m.fotos && m.fotos.length ? ' con-fotos' : ''}">${fotosMsg(m.fotos, i)}${m.t ? `<div>${esc(m.t)}</div>` : ''}${m.ts ? `<div class="msg-h">${hora(m.ts)}</div>` : ''}</div>`
    : `<div class="msg ia"><div class="quien-ia">${esc(nombreModelo(m.modelo) || 'IA')}${m.ts ? `<span>${hora(m.ts)}</span>` : ''}<button class="copiar-msg" data-accion="copiarMsg" data-i="${i}" aria-label="Copiar">${icono('copiar')}</button></div>${md(m.t)}${m.fuentes && m.fuentes.length ? `<div class="fuentes">${m.fuentes.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>` : ''}${(m.apuntadas && m.apuntadas.length) || m.olvidadas ? `<div class="apuntado">${icono('nota')}<div>${(m.apuntadas || []).map((t) => `<b>Apuntado:</b> ${esc(t)}`).join('<br>')}${m.olvidadas ? `${m.apuntadas && m.apuntadas.length ? '<br>' : ''}Olvidado${m.olvidadas > 1 ? `s ${m.olvidadas}` : ''} lo que ya no vale.` : ''}${m === ultimaIA ? '<button class="btn chico" data-accion="planYa">Rehacer el plan con esto</button>' : ''}</div></div>` : ''}</div>`)).join('');
  // para seguir la conversación sin escribir
  if (ultimaIA && msgs[msgs.length - 1] === ultimaIA && !S.charlando) h += `<div class="seguir">${['Dímelo más corto', '¿Y qué alternativas tengo?', '¿Qué hago primero?'].map((x) => `<button data-sugerencia="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  // la pregunta que se está contestando, aunque aún no esté guardada en el chat
  const yaEsta = msgs.length && msgs[msgs.length - 1].r === 'yo' && msgs[msgs.length - 1].t === S.preguntaActual;
  if (S.charlando && (S.preguntaActual || (S.fotosActuales || []).length) && !yaEsta) h += `<div class="msg yo">${fotosMsg(S.fotosActuales, -1)}${S.preguntaActual ? `<div>${esc(S.preguntaActual)}</div>` : ''}</div>`;
  if (S.claveMal && !S.charlando) h += `<div class="error-c"><b>Google no acepta tu clave de la IA.</b> Crea otra en aistudio.google.com/apikey y pégala: tu chat no se borra.<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="cambiarClave">Poner otra clave</button><button class="btn chico sec" data-abrir="https://aistudio.google.com/apikey">Abrir aistudio</button></div></div>`;
  if (S.charlando) h += `<div class="msg ia" id="respuesta"><div class="quien-ia">Pensando…</div>${S.parcial ? md(S.parcial) : `<span class="pensando"><i></i><i></i><i></i></span> <span class="t2 peq" id="paso-chat">${esc(S.pasoChat || '')}</span>`}</div><div class="parar-chat"><button class="btn chico sec" data-accion="pararChat">${icono('parar')}Parar la respuesta</button></div>`;
  const puedeFotos = !S.charlando && (S.adjuntos || []).length < 4;
  h += `</div><div class="escribe"><div class="adjuntos" id="adjuntos">${adjuntosHTML(S)}</div><div class="escribe-in"><button class="micro foto" data-accion="foto" aria-label="Mandar una foto o captura"${puedeFotos ? '' : ' disabled'}>${icono('foto')}</button><textarea id="pregunta" rows="1" placeholder="Pregunta o cuéntale algo"></textarea>${S.charlando ? `<button class="parar" data-accion="pararChat" aria-label="Parar">${icono('parar')}</button>` : `${nativo.hayVoz() ? `<button class="micro" data-accion="voz" aria-label="Hablar">${icono('micro')}</button>` : ''}<button data-accion="enviar" aria-label="Enviar">${icono('enviar')}</button>`}</div></div>`;
  return h;
}
