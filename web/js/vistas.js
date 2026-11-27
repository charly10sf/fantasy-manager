/* Las pestañas: Hoy (el plan del día), Equipo, Rivales, Mercado y Pregunta (el chat). Cada una devuelve su HTML.
   (Directo, la jornada en juego, está en directo.js.) */
import { pillRival, avisoRivalesVisto, avisoRivalesHTML, tarjetaChatHTML } from './dinero-dicho.js';
import { esc, eur, pct, dura, cuenta, cuando, icono, clase, POS_PLURAL, num, DIA, HORA, rel, LS, diaDe, otroDia as otroDiaV, norm, esWebFantasy, sinWebs, horaDe, elDia } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, partidoTxt, filaJugador, nada, oncePill, filaNoticia, cromo, rivalSub, dineroCorto, calPill, candadoMini, candado, candadosJuntos, caraManager, planPill } from './comunes.js';
import { bloqueada, topConAnuncio } from './limite.js';
import { esClausulable } from './motor.js';
import { ventaVista, comoVa } from './decide.js';
import { linea, barra } from './graficos.js';
import { proximoTurno } from './planes-hora.js';
import { hayClave, puedePlanIA, planesApp, cupoPlanes, puedeChat, preguntasApp, cupoPreguntas, conversacion, notasVigentes, chatsAnteriores, jugadoresEn, pidDe, planes, ultimoPlan, consejosChat, enAppIos, permisoIA } from './ia.js';
import { md } from './texto.js';
import { miniDe } from './fotos.js';
import { enApp, nativo } from './puente.js';
import { guiaClave } from './clave.js';
import { K } from './datos.js';
import { jornadasHTML } from './jornadas.js';
import { favoritos } from './favoritos.js';
import { paronLejos, origenFichaje } from './operaciones.js';
import { porJornadaHTML } from './directo.js';
import { parte, visibles, novedades, firmaParte } from './parte.js';

const ICO_ACT = { compra: 'mercado', clausula: 'diana', venta: 'euro', blindaje: 'escudo', premio: 'hucha', alineacion: 'alerta', entra: 'usuario', otro: 'cambio' };
const VERBO = { compra: 'fichó a', clausula: 'clausuló a', venta: 'vendió a', blindaje: 'blindó a', premio: 'cobró por la jornada', alineacion: 'no puntuó por alineación incorrecta', entra: 'entró en la liga', otro: 'movió a' };
const VERBO_TU = { compra: 'fichaste a', clausula: 'clausulaste a', venta: 'vendiste a', blindaje: 'blindaste a', premio: 'cobraste por la jornada', alineacion: 'no puntuaste por alineación incorrecta', entra: 'entraste en la liga', otro: 'moviste a' };
export const PELIGRO = { muyalta: 'muy alto', alta: 'alto', media: 'medio', baja: 'bajo' };
/** qué es el peligro de un rival (en el title de su etiqueta) */
export const PELIGRO_TXT = 'Lo que te puede hacer ahora y lo que suele hacer: si le llega el dinero para tus cláusulas que se pagan en esta liga (abiertas o que se abren pronto) y te dolería perder, sus clausulazos de toda la temporada (los hechos a ti, el doble) y si te pelea el puesto, y cuánto dinero tiene frente a los demás. Muy alto, alto, medio o bajo; en la veda, el de cuando se reabran las cláusulas.';
/** cuántas cláusulas tuyas abiertas le llegan y se pagan en tu liga (las de a precio de locos no cuentan, como en el peligro) */
const quitaYa = (r) => (r.peligro ? r.peligro.llegan.filter((x) => x.abierta && x.w >= 0.25).length : (r.leLleganYa || []).length);
/** la jornada de los puntos de jornada que da LaLiga en la clasificación: la que se juega o la última jugada */
const jornadaPts = (M) => (M.enJuego && M.enJuego.n) || (M.ultimaJornada && M.ultimaJornada.n) || null;
const ptsJornadaTxt = (M, e) => (num(e.puntosJornada) > 0 ? (jornadaPts(M) ? `${e.puntosJornada} en la J${jornadaPts(M)}` : `${e.puntosJornada} en la última`) : '');

/* ---------- el ordenador ---------- */
/** pantalla ancha (ordenador o tableta en horizontal): cada pestaña se reparte en columnas */
export const ancho = () => typeof matchMedia === 'function' && matchMedia('(min-width: 1100px)').matches;
/** dos columnas: «lado-der» (lo principal y una columna estrecha a la derecha) o «lado-izq» (la estrecha a la izquierda) */
export const cols = (izq, der, tipo = 'lado-der') => `<div class="cols-e ${tipo}"><div class="ce-i">${izq}</div><div class="ce-d">${der}</div></div>`;
/** las listas de jugadores, en dos columnas en el ordenador */
export const lista2 = (h) => (ancho() ? `<div class="lista2">${h}</div>` : h);

export function filaActividad(a, { dentroDe = null } = {}) {
  const quien = a.esYo ? '<span class="quien yo">Tú</span>' : `<span class="quien">${esc(a.quien || 'Un rival')}</span>`;
  const jug = a.nombreJ ? ` <b>${esc(a.nombreJ)}</b>` : '';
  const a2 = a.otro && a.clase !== 'premio' ? ` ${a.clase === 'clausula' ? 'de' : 'a'} ${a.contraMi ? '<b class="rojo">ti</b>' : esc(a.otro)}` : '';
  const imp = a.importe ? `<div class="v">${eur(a.importe)}</div>` : '';
  // con jugador abre su ficha; sin él, la del rival; si no hay a dónde ir (lo tuyo sin jugador), no es un botón
  const ir = a.pid ? `data-j="${esc(a.pid)}"` : !a.esYo && a.quienT && a.quienT !== dentroDe ? `data-r="${esc(a.quienT)}"` : '';
  const tag = ir ? 'button' : 'div';
  // con jugador, su cara pequeña con el tipo de movimiento en la esquina (Carlos, 10 nov); sin él, solo el icono
  const ic = a.j ? `<span class="act-cara">${ava(a.j, 'm')}<span class="ic-act mini ${a.clase}">${icono(ICO_ACT[a.clase] || 'cambio')}</span></span>`
    : `<span class="ic-act ${a.clase}">${icono(ICO_ACT[a.clase] || 'cambio')}</span>`;
  return `<${tag} class="fila act-f" ${ir}>
    ${ic}
    <div class="fila-c"><div class="act-t">${quien} ${(a.esYo ? VERBO_TU : VERBO)[a.clase] || 'movió a'}${jug}${a2}</div><div class="fila-s">${a.t ? cuando(a.t) : ''}${a.j && a.j.equipo ? ` · ${esc(a.j.equipo)}` : ''}${a.j && a.j.valor && a.importe ? ` · vale ${eur(a.j.valor)}` : ''}</div></div>
    <div class="fila-d">${imp}</div></${tag}>`;
}

/* ================= EL MARCADOR (arriba de Hoy) ================= */
/** El marcador de Hoy (18 nov, Fran y Carlos: sencillo y sin información de más): saldo y equipo en grande; debajo del saldo, hasta
    dónde puedes quedarte en negativo (el saldo más bajo al que puedes llegar pujando: el margen de deuda menos lo ya pujado); el puesto,
    en pequeño en la línea de la jornada. */
function marcador(S, { corto = false, tiempos = false } = {}) {
  const { D, M } = S;
  const yo = M.yo || {};
  const ahora = Date.now();
  const puesto = M.yo ? ` · <b>${yo.pos}º</b> de ${D.clasif.length} · ${num(yo.puntos)} pts` : '';
  let fila = '';
  if (M.enParon) fila = `<span>${icono('bandera')} Parón${puesto}</span><span class="der">vuelve ${cuando(M.proxima ? M.proxima.ini : M.paron.fin, { hora: false })}</span>`; // (26) la fecha de la jornada, no la del fin del parón
  else if (M.enJuego) fila = `<span><span class="vivo">J${M.enJuego.n} en juego</span>${puesto}</span><span class="der">hasta ${cuando(M.enJuego.fin, { hora: false })}</span>`;
  else if (M.proxima) fila = `<span>Jornada ${M.proxima.n}${puesto}</span><span class="der">${cuando(M.proxima.ini, { hora: false })} · ${cuenta(M.proxima.ini)}</span>`;
  else fila = `<span>${esc(D.liga.nombre)}${puesto}</span>`;
  const dEq = M.mias.reduce((s, x) => s + num(x.tend.d1), 0);
  const margen = Math.max(0, M.deuda - M.misPujas);
  let h = `<div class="marcador ${corto ? 'corto' : ''}" data-accion="resumen" role="button" tabindex="0" title="Ver el detalle de tu equipo"><div class="fila-j">${fila}<span class="marcador-ir" aria-hidden="true">${icono('flecha')}</span></div>
    <div class="m-cols">
      <div class="m-c"><div class="et">Saldo</div><div class="v ${num(D.dinero) < 0 ? 'neg' : ''}">${eur(D.dinero)}</div><div class="d apag">${margen > 0 ? `puedes quedarte en <b class="neg">−${eur(margen)}</b>` : `gastas hasta ${eur(Math.max(0, M.pujaMax))}`}</div></div>
      <div class="m-c"><div class="et">Equipo</div><div class="v">${eur(D.valorEquipo, { dec: 1 })}</div><div class="d ${clase(dEq)}">${dEq ? `${eur(dEq, { signo: true, dec: 1 })} hoy` : '<span class="apag">= hoy</span>'}</div></div>
    </div>`;
  // (0.7.13o, Carlos 16 nov) lo que va a pasar pronto (el mercado, las cláusulas, el parón), dentro del marcador y en
  // pequeño, en vez de en chips sueltos debajo
  if (tiempos) h += tiemposHTML(S, { dentro: true });
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
/** (24 nov) los puntos de cada equipo en la última jornada acabada: { teamId: pts } o null */
export function mapaUltimaJornada(S) { const r = puntosUltimaJornada(S, { mapa: true }); return r && r.mapa; }
export function puntosUltimaJornada(S, { mapa = false } = {}) {
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
  // en la liga de ejemplo, lo tuyo es la suma de tu once, como en Equipo → Jornadas (antes, 75 en Directo y 66 allí)
  if (D.demo && ptsJ && M.once && ultJ) {
    const campo = M.once.lineas.flat().map((j) => D.maestro[j.id]).filter((j) => j && j.pos < 5);
    ptsJ = { ...ptsJ, [yo.teamId]: campo.reduce((t, j) => t + (((j.semanas || []).find((w) => w.n === ultJ.n) || {}).pts || 0), 0) };
  }
  const pts = ptsJ ? ptsJ[yo.teamId] : null;
  if (pts == null) return null;
  return { n: ultJ ? ultJ.n : null, pts, puesto: Object.values(ptsJ).filter((v) => v > pts).length + 1, ...(mapa ? { mapa: ptsJ } : {}) };
}

/** lo que va a pasar pronto, en chips: el mercado, las cláusulas, tu protección, el parón */
function tiemposHTML(S, { dentro = false } = {}) {
  const { M } = S;
  const ahora = Date.now();
  const c = [];
  if (M.cierreMercado) c.push(['mercado', 'Mercado nuevo', `en ${cuenta(M.cierreMercado)}`, 'mercado']);
  const prot = M.mias.filter((x) => !x.abierta && x.abreEn < 3 * DIA && x.riesgo !== 'ninguno').sort((a, b) => a.abreEn - b.abreEn)[0];
  if (prot) c.push(['candado', `Se abre ${prot.j.nombre}`, `en ${cuenta(prot.protegidoHasta)}`, `j:${prot.pid}`]);
  const cl = M.clausulas.filter((x) => !x.abierta && x.abreEn < 2 * DIA && x.interes >= 60 && esClausulable(M, x, ahora)).sort((a, b) => a.abreEn - b.abreEn)[0];
  if (cl) c.push(['diana', `Cláusula de ${cl.j.nombre}`, `en ${cuenta(cl.protegidoHasta)}`, `j:${cl.pid}`]);
  if (M.paron && !M.enParon && M.paron.ini - ahora < 21 * DIA) c.push(['bandera', 'Parón', `en ${cuenta(M.paron.ini)}`, 'accion:paron']);
  if (!c.length) return '';
  // cada chip lleva a lo que dice: el jugador, el mercado o lo que pasa en el parón
  const destino = (a) => (a.startsWith('j:') ? `data-j="${esc(a.slice(2))}"` : a.startsWith('accion:') ? `data-accion="${esc(a.slice(7))}"` : a ? `data-ir="${a}"` : '');
  if (dentro) return `<div class="m-tiempos">${c.map(([ic, t, sub, a]) => `<button type="button" class="m-t" ${destino(a)}>${icono(ic)}<span>${esc(t)}</span><b>${sub.replace(/^en /, '')}</b></button>`).join('')}</div>`;
  return `<div class="tiempos">${c.map(([ic, t, sub, a]) => `<button class="tiempo" ${destino(a)}>${icono(ic)}<div><b>${esc(t)}</b><span>${sub}</span></div>${a ? icono('flecha', 'tiempo-ir') : ''}</button>`).join('')}</div>`;
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
/** (24 nov) un paso del plan de la IA que la app ha sacado al repasarlo con los datos de ahora: «A las 06:25: vender. Ahora: …» */
export function pasoCambiaTxt(P, o) {
  if (!P || !o || !o.descartada || !o.decAhora || !P.t || P.auto || P.motorHoy) return '';
  const VERBO = { vender: 'vender', clausular: 'clausular', pujar: 'pujar', comprar: 'comprar', blindar: 'blindar', ofertar: 'ofertar' };
  const era = o.etiqueta === 'Aceptar oferta' ? 'aceptar la oferta' : VERBO[o.accion] || o.accion;
  const c = o.decAhora.corta || '';
  return `A las ${horaDe(P.t)}: ${era}. Ahora: ${c.charAt(0).toLowerCase()}${c.slice(1)}.`;
}
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
  // (24 nov, Senna: «recomienda vender y luego me dice que es una decisión que he tomado por mi cuenta») de dónde salió cada
  // cosa: del plan (también lo que proponía cuando se hizo, aunque al repasarlo ahora ese paso haya salido: `cuadradas` y
  // lo que la app ha sacado después, `decAhora`), de lo que le aconsejó la IA en Pregunta, o por su cuenta
  const esIA = !!(P && P.t && !P.auto && !P.motor) || !!(P && P.modelo);
  const horaPlan = P && P.t && esIA ? horaDe(P.t) : '';
  const proponia = P ? P.ops.filter((o) => o.pid && o.descartada && o.decAhora).map((o) => ({ pid: o.pid, accion: o.accion })) : [];
  const deAntesT = planes().filter((p) => p && p.t && diaDe(p.t) === hoyD).flatMap((p) => (p.operaciones || []).map((o) => ({ pid: o.pid || pidDe(o.jugador, S.D), accion: accDe(o.accion), t: p.t })));
  let dichoIA = []; try { dichoIA = consejosChat(M, undefined, { desde: desde - 12 * HORA }); } catch (e) { dichoIA = []; }
  const origenDe = (pid, acciones) => {
    if (ops.some((o) => o.pid === pid && acciones.includes(o.accion)) || proponia.some((o) => o.pid === pid && acciones.includes(o.accion))) return { plan: true, txt: horaPlan ? `Del plan de las ${horaPlan}` : 'Del plan' };
    const a = deAntesT.find((o) => o.pid === pid && acciones.includes(o.accion));
    if (a) return { plan: true, txt: `Del plan de las ${horaDe(a.t)}` };
    const k = acciones.includes('vender') ? dichoIA.find((y) => y.pid === pid && y.clase === 'V') : null;
    if (k) return { plan: true, txt: k.ts ? `Te lo aconsejó la IA a las ${horaDe(k.ts)}` : 'Te lo aconsejó la IA' };
    return { plan: false, txt: 'Por tu cuenta' };
  };
  const delPlan = (pid, acciones) => origenDe(pid, acciones);
  // y si ahora la app aconseja otra cosa con lo que tiene en venta, se dice en corto
  const ahoraDe = (pid) => { const d = M.decision ? M.decision(pid) : null; return d && ['esta-oferta-no', 'oferta-no', 'acepta', 'por-dinero'].includes(d.matiz) ? d.corta : ''; };
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
    items.push({ t: ahora - 1, estado: 'curso', pid: v.pid, plan: delPlan(v.pid, ['vender']), nota: ahoraDe(v.pid),
      texto: `${v.j.nombre} a la venta${mej ? `: la mejor oferta, ${eur(mej.importe)}${mej.deLiga ? ' (LaLiga)' : ''}` : ': aún sin ofertas'}` });
  }
  const hechos = items.filter((x) => x.estado === 'hecho').length, curso = items.filter((x) => x.estado === 'curso').length;
  const quedan = P && !P.viejo ? cuentaPasos(S, P).pend : 0;
  const balance = items.filter((x) => x.estado !== 'curso').reduce((s, x) => s + (x.dinero || 0), 0);
  const cab = `<summary><span class="llevas-t">${icono('lista')}<b>Lo que llevas hoy</b></span><span class="llevas-n">${items.length ? [hechos ? `${hechos} hecho${hechos > 1 ? 's' : ''}` : '', curso ? `${curso} en marcha` : ''].filter(Boolean).join(' · ') : 'nada aún'}</span></summary>`;
  if (!items.length) {
    return `<details class="llevas vacio">${cab}<p class="llevas-vacio">Desde el último cambio de mercado no has movido nada en LaLiga. Lo que hagas allí (pujas, ofertas, ventas, cláusulas) sale aquí al darle a Actualizar, y los pasos del plan se tachan solos.</p></details>`;
  }
  const ICO = { hecho: 'ok', curso: 'reloj', contra: 'alerta' };
  const orden = { curso: 0, contra: 1, hecho: 2 };
  items.sort((a, b) => orden[a.estado] - orden[b.estado] || b.t - a.t);
  return `<details class="llevas">${cab}
    <ul class="llevas-l">${items.map((x) => `<li class="${x.estado}"><button class="llevas-f" data-j="${esc(x.pid)}"><span class="ll-ic">${icono(ICO[x.estado])}</span><span class="ll-t">${esc(x.texto)}${x.estado === 'hecho' && x.t ? ` <small>${esc(cuando(x.t))}</small>` : ''}${x.nota ? ` <small class="ll-ahora">Ahora: ${esc(x.nota.charAt(0).toLowerCase() + x.nota.slice(1))}</small>` : ''}</span>${x.estado === 'contra' ? '' : `<span class="ll-tag ${x.plan && x.plan.plan ? 'plan' : ''}">${esc((x.plan && x.plan.txt) || 'Por tu cuenta')}</span>`}</button></li>`).join('')}</ul>
    <p class="llevas-pie">${balance ? `Hecho hasta ahora: ${eur(balance, { signo: true })}. ` : ''}${M.misPujas ? `En pujas tienes ${eur(M.misPujas)} comprometidos. ` : ''}${quedan ? `Del plan te ${quedan === 1 ? 'queda 1 paso' : `quedan ${quedan} pasos`}.` : P && !P.viejo ? 'Del plan no te queda nada por hacer hoy.' : ''}</p></details>`;
}

/** lo urgente de verdad (lo que no puede esperar al plan): como mucho tres cosas */
/** cada cosa urgente se puede quitar hasta mañana (aviso de Domy, 27 oct): se guarda por liga con el día */
export const claveUrgente = (a) => `${a.tipo}|${a.pid || a.titulo}`;
export const urgentesQuitados = () => { const q = LS.get(K('urgentes-quitados'), {}), d = diaDe(); return new Set(Object.keys(q).filter((k) => q[k] === d)); };
/** lo urgente que no está en el plan (como mucho tres) y la nota de cada cláusula abierta después del plan */
export function urgentesDe(S) {
  const { M } = S;
  // lo que ya está en el plan no se repite aquí, ni lo que has quitado hoy
  const enPlan = new Set(Object.keys(S.opPorPid || {}));
  const fuera = urgentesQuitados();
  // (Carlos, 1 nov: le salían 2 clausulazos urgentes que el plan no decía) con un plan de la IA de hoy, una cláusula que
  // ya estaba abierta cuando se hizo no es urgente: la IA la tenía entre lo que se podía hacer y no la eligió (o la
  // descartó). Solo sale la que se ha abierto después, y lo dice
  const P = S.plan;
  const conIA = !!(P && !P.auto && !P.viejo && P.t);
  // (14 nov) el plan del motor (plan.js) es lo que la app haría hoy: lo que ha mirado y dejado fuera («Mirados y
  // descartados», con su porqué) no sale aquí arriba como urgente. Hoy y el plan dicen lo mismo
  const delMotor = new Set(P && P.motor && Array.isArray(P.descartes) ? P.descartes.map((d) => String(d && d.pid)).filter(Boolean) : []);
  const descartados = new Set(conIA && Array.isArray(P.descartes) ? P.descartes.map((d) => norm(d && d.jugador)).filter(Boolean) : []);
  const ahora = Date.now();
  const despuesDelPlan = (x) => (x.protegidoHasta && x.protegidoHasta > P.t) || (M.vedas || []).some((v) => v.ini <= P.t && v.fin > P.t && v.fin <= ahora);
  const nota = {};
  const yaVista = (a) => {
    if (!conIA || a.tipo !== 'clausular' || !a.pid) return false;
    const x = M.clausulas.find((y) => y.pid === a.pid);
    if (!x || descartados.has(norm(x.j.nombre)) || !despuesDelPlan(x)) return true;
    nota[a.pid] = 'Se ha abierto después de tu plan: no lo tiene en cuenta.';
    return false;
  };
  // (24 nov, decide.js) y lo de vender o buscar sustituto, solo si es lo que dice la decisión del jugador con el plan delante
  const segunDec = (a) => { if (!a.pid || !M.decision || !['vender', 'sustituto'].includes(a.tipo)) return true; const d = M.decision(a.pid); return !d || (a.tipo === 'vender' ? d.accion === 'vender' && d.matiz !== 'por-dinero' : d.accion === 'aguantar'); };
  const noFicha = (a) => !!a.pid && ['pujar', 'clausular'].includes(a.tipo) && !!M.decisionFichar && (M.decisionFichar(a.pid) || {}).accion === 'no';
  // (repaso del 24 nov) con el plan de la app delante (el de ahora), una cláusula o una puja que el plan no lleva no es
  // urgente: el plan la ha tenido entre lo posible y no la ha elegido (salían dos «Clausula a…» que juntas no cabían)
  const planDeAhora = !!(P && P.motor && !conIA);
  const urg = (M.acciones || []).filter((a) => a.prio >= 78 && segunDec(a) && !noFicha(a) && !(planDeAhora && a.pid && ['pujar', 'clausular'].includes(a.tipo)) && !(a.pid && enPlan.has(a.pid)) && !fuera.has(claveUrgente(a)) && !yaVista(a) && !(a.pid && delMotor.has(String(a.pid)) && ['vender', 'clausular', 'pujar'].includes(a.tipo))).slice(0, 3);
  // (sesión 8, M10) si el plan dice otra cosa de ese jugador, se dice por qué no está en el plan (antes, «Vende a Rodri»
  // arriba y el plan de debajo sin Rodri, sin explicar nada)
  const desc = conIA && Array.isArray(P.descartes) ? P.descartes : [];
  for (const a of urg) {
    if (!a.pid || nota[a.pid] || !P) continue;
    const j = M.J(a.pid), d = j && desc.find((x) => x && norm(x.jugador) === norm(j.nombre));
    // (24 nov, Carlos: «¿qué es eso de la app dice una cosa y la IA otra? ¿A un usuario le vas a decir eso?») nada de
    // «el plan de la IA no lo vende»: si el plan lo descartó, su porqué y nada más
    if (d && d.motivo) nota[a.pid] = d.motivo;
  }
  return { urg, nota, fuera };
}
/** a uno tuyo que hay que vender o que no puede jugar se le puede buscar sustituto */
const conSustituto = (S, a) => a.pid && S.M.dueno[a.pid] === (S.D && S.D.yo && S.D.yo.teamId) && (a.tipo === 'vender' || a.tipo === 'sustituto' || ['injured', 'suspended'].includes((S.M.J(a.pid) || {}).estado));
/** (24 nov, «menos texto» y «nada cortado») la primera frase entera, en vez del texto cortado a dos líneas */
// (24 nov) sin cortar en la inicial de un nombre («puja por C. Soler»)
const frase1 = (t) => String(t || '').trim().split(/(?<!(?:^|[\s(«"])[A-ZÁÉÍÓÚÑ]\.)(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)[0] || '';
/** «Ahora mismo»: solo sin plan. Con plan, lo urgente va arriba de sus pasos, en «Antes de nada» (18, 9 nov) */
function ahoraHTML(S) {
  const { M } = S;
  if (S.plan) return '';
  const { urg, nota, fuera } = urgentesDe(S);
  if (!urg.length) return `<div class="ahora-ok">${icono('ok')}<span><b>Nada urgente ahora mismo.</b> ${fuera.size ? 'Lo que has quitado vuelve mañana si sigue igual.' : 'Ninguna cláusula tuya en peligro ni nada que vender ya.'}</span></div>`;
  const conSust = (a) => conSustituto(S, a);
  void M;
  // el «cuando» largo («La jornada empieza mañana 21:00», «Antes de que baje más») va debajo del título: a la derecha y sin
  // partir, dejaba el título en una columna de una palabra por línea (Carlos, 5 nov 05:34, con captura)
  const largoCu = (t) => !!t && t.length > 14;
  return `<div class="sec"><h2>Ahora mismo</h2><span class="sub">${urg.length === 1 ? '1 cosa urgente' : `${urg.length} cosas urgentes`}</span></div><div class="ahora">${urg.map((a) => `<div class="ahora-f t-${esc(a.tipo)}"><button class="ahora-b" ${a.pid ? `data-j="${esc(a.pid)}"` : a.hash ? `data-ir="${esc(a.hash)}"` : ''}><span class="ahora-ic">${icono(a.icono || 'alerta')}</span><span class="ahora-c"><b>${esc(a.titulo)}</b>${largoCu(a.cuando) ? `<span class="ahora-cu2">${esc(a.cuando)}</span>` : ''}<span>${esc(frase1(a.texto))}</span>${a.pid && nota[a.pid] ? `<em class="ahora-nota">${esc(nota[a.pid])}</em>` : ''}</span>${a.cuando && !largoCu(a.cuando) ? `<span class="ahora-cu">${esc(a.cuando)}</span>` : ''}</button><button class="ahora-x" data-accion="quitarUrgente" data-k="${esc(claveUrgente(a))}" aria-label="Quitar hasta mañana" title="Quitar hasta mañana">${icono('cerrar')}</button>${conSust(a) ? `<button class="ahora-sust" data-accion="sustituto" data-pid="${esc(a.pid)}">${icono('buscar')}Buscar sustituto</button>` : ''}</div>`).join('')}</div>`;
}

/**
 * los sustitutos de uno tuyo (aviso de Domy, 27 oct): de su mismo puesto, lo que podrías poner o fichar hoy, de más a
 * menos puntos esperados: tus suplentes, los del mercado y las cláusulas que te llegan y tienen salida
 */
export function sustitutosHTML(S, pid) {
  const { M } = S;
  const j = M.J(pid);
  const cab = `<div class="hoja-cab"><h2>Sustitutos${j ? ` de ${esc(j.nombre)}` : ''}</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (!j) return `${cab}${nada('No encuentro a ese jugador.')}`;
  const pp = (x) => (M.ppEsperado ? M.ppEsperado(x) : num(x.media));
  const ppTxt = (x) => { const v = pp(x); return v ? `${String(Math.round(v * 10) / 10).replace('.', ',')} pts esperados` : ''; };
  const sano = (x) => !['injured', 'suspended', 'out_of_league'].includes(x.estado);
  const mios = M.mias.filter((x) => x.j && x.pid !== pid && x.j.pos === j.pos && sano(x.j)).sort((a, b) => pp(b.j) - pp(a.j));
  const merc = M.mercado.filter((m) => m.j && m.j.pos === j.pos && !M.enVenta.has(m.pid) && !m.noVende && sano(m.j) && !(m.tipo === 'manager' && bloqueada('ventasRivales')))
    .sort((a, b) => pp(b.j) - pp(a.j)).slice(0, 8);
  const cls = M.clausulas.filter((x) => x.j.pos === j.pos && x.meLlega && (x.abierta || x.abreEn < 30 * 3600e3) && sano(x.j) && (!M.conSalida || M.conSalida(x.j, x.clausula, x.tend)))
    .sort((a, b) => pp(b.j) - pp(a.j)).slice(0, 8);
  let h = `${cab}<p class="t2 peq">${esc(POS_PLURAL[j.pos] || 'Su puesto')}: lo que podrías poner o fichar hoy en su sitio, de más a menos puntos esperados. Toca uno para ver su ficha.</p>`;
  if (mios.length) h += `<div class="grupo"><span>Ya los tienes</span><span>${mios.length}</span></div>${mios.map((x) => filaJugador(x, { sub: `${esc(x.j.equipo)}${ppTxt(x.j) ? ` · ${ppTxt(x.j)}` : ''}`, derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d">${delta(x.tend)}</div>` })).join('')}`;
  if (merc.length) h += `<div class="grupo"><span>En el mercado</span><span>${merc.length}</span></div>${merc.map((m) => filaJugador(m, { sub: `${m.tipo === 'manager' ? `lo vende ${esc(m.vendedor || 'un manager')}` : 'libre'}${ppTxt(m.j) ? ` · ${ppTxt(m.j)}` : ''}`, derecha: `<div class="v">${eur(m.precio)}</div>${m.puja ? `<div class="d apag">${m.tipo === 'manager' ? 'ofrece' : 'puja'} ${eur(m.puja)}</div>` : ''}` })).join('')}`;
  if (cls.length) h += `<div class="grupo"><span>Cláusulas que te llegan</span><span>${cls.length}</span></div>${cls.map((x) => filaJugador(x, { sub: `de ${esc(x.rival.manager || x.rival.nombre)}${ppTxt(x.j) ? ` · ${ppTxt(x.j)}` : ''}`, derecha: `<div class="v">${eur(x.clausula)}</div><div class="d apag">${x.abierta ? 'abierta' : `se abre ${cuando(x.protegidoHasta)}`}</div>` })).join('')}`;
  if (!mios.length && !merc.length && !cls.length) h += nada('Ahora mismo no hay nadie de su puesto que puedas poner o fichar hoy. Mira mañana el mercado nuevo.');
  return h;
}

/** tu equipo de un vistazo: cuántos suben y bajan, los que hay que vender, lesionados y cláusulas abiertas */
export function equipoHoyHTML(S, { corto = false } = {}) {
  const { M } = S;
  const xs = M.mias.filter((x) => x.j && x.j.pos !== 5);
  if (!xs.length) return '';
  // (24 nov, decide.js) lo de vender sale de la decisión de cada uno: los que se venden y los titulares que giran y se aguantan
  const vv = xs.map((x) => ({ x, v: ventaVista(M, x, { sinInercia: bloqueada('inercia') }) })).filter((y) => y.v && !y.v.d.enVenta);
  const giro = vv.filter((y) => y.v.d.accion === 'vender').map((y) => y.x);
  const frena = vv.filter((y) => y.v.d.accion !== 'vender').map((y) => y.x);
  const malos = xs.filter((x) => ['injured', 'suspended', 'out_of_league'].includes(x.j.estado));
  const dudas = xs.filter((x) => x.j.estado === 'doubtful');
  const riesgo = xs.filter((x) => x.riesgo === 'alto');
  // con la alineación de su partido ya confirmada: los que se quedan en el banquillo o no van
  const conf = (x) => (M.alineacion && M.alineacion(x.j.id)) || {};
  const confSup = xs.filter((x) => ['suplente', 'nosale'].includes(conf(x).estado));
  const confFuera = xs.filter((x) => ['fuera', 'baja'].includes(conf(x).estado) && !malos.includes(x));
  const sinI = bloqueada('inercia');
  // cada uno con su nombre (se toca y se abre su ficha); si son muchos, los 3 primeros y «+N»
  const de = (lista, cls, txt, ic = '') => {
    if (!lista.length) return '';
    const v = lista.slice(0, 3).map((x) => `<button class="ch ${cls}" data-j="${esc(x.pid)}">${ic ? icono(ic) : ''}${esc(txt(x.j.nombre))}</button>`);
    if (lista.length > 3) v.push(`<span class="ch ${cls}">+${lista.length - 3}</span>`);
    return v.join('');
  };
  const chips = [
    de(giro, 'mal', (n) => `${n}: vender`),
    de(frena, 'duda', (n) => `${n} baja · titular`),
    de(confFuera, 'mal', (n) => `${n} no juega`),
    de(confSup, 'duda', (n) => `${n} suplente`),
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
      <span class="liga-n"><b>${esc(e.nombre)}</b><span>${esc(e.manager && e.manager !== e.nombre ? `${e.manager} · ` : '')}${ptsJornadaTxt(M, e)}${r && r.dinero && r.dinero.v != null ? ` · ${r.dinero.exacto ? '' : '≈ '}${eur(r.dinero.v, { dec: 1 })}` : ''}</span></span>
      ${r && (r.nivel === 'alta' || r.nivel === 'muyalta') ? `<span class="amenaza ${r.nivel}" title="${esc(PELIGRO_TXT)}">Peligro${r.nivel === 'muyalta' ? ' muy alto' : ''}</span>` : ''}
      <span class="liga-p"><b>${e.puntos}</b><span class="${esYo ? 'apag' : dif > 0 ? 'baja' : 'sube'}">${esYo ? 'tú' : dif > 0 ? `+${dif}` : dif < 0 ? `${dif}` : '='}</span></span></button>`;
  }
  return h + '</div>';
}

/* ================= EL PLAN DEL DÍA ================= */
const ACCION = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Blindar', alinear: 'Alinear', esperar: 'Esperar' };

/** ¿ya lo has hecho? lo marcas tú o se ve en la actividad de la liga */
export const claveHechos = (P) => (P.auto ? `auto-${P.dia}` : String(P.t));
export function hecho(S, P, o) {
  const marcados = (LS.get(K('hechos'), {})[claveHechos(P)] || {}).n || [];
  if (marcados.includes(o.n)) return true;
  return !!hechoEnLiga(S, P, o);
}
/**
 * los pasos del plan por grupos, para que el número de Hoy, la cabecera de los pasos y «Lo que llevas hoy» digan lo
 * mismo: por hacer (hoy, sin descartados, sugerencias, esperar ni alinear), hechos, para luego (esperar, alinear, lo de
 * otro día y las sugerencias) y descartados
 */
export function cuentaPasos(S, P) {
  const r = { total: 0, pend: 0, hechos: 0, luego: 0, descartados: 0 };
  for (const o of (P && P.ops) || []) {
    r.total++;
    if (o.descartada) r.descartados++;
    else if (hecho(S, P, o)) r.hechos++;
    else if (o.sugerencia || o.hoy === false || ['esperar', 'alinear'].includes(o.accion)) r.luego++;
    else r.pend++;
  }
  return r;
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
        const m = (M.mercado || []).find((x) => x.pid === o.pid && x.miPuja) || (M.entrenadoresMercado || []).find((x) => x.pid === o.pid && x.miPuja);
        if (m) return { estado: 'curso', texto: m.tipo === 'manager' ? `Oferta hecha: ${eur(m.miPuja)} · decide ${m.vendedor || 'él'}` : `Pujado ${eur(m.miPuja)}` };
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

const OBJ = { titular: ['bien', 'Para tu once'], revender: ['oro', 'Para revender'], caja: ['', 'Para hacer caja'], entrenador: ['bien', 'Entrenador'] };
function objetivoPill(o) {
  const k = String(o.objetivo || '').toLowerCase().replace(/^revend.*/, 'revender');
  const x = OBJ[k];
  if (!x || ['blindar', 'alinear', 'esperar'].includes(o.accion)) return '';
  // (24 nov) lo que se compra para aguantarlo: se revende más adelante, sin día
  if (k === 'revender' && o.aguantar) return `<span class="pill ${x[0]}">Para aguantarlo${o.beneficio_esperado ? ` · ${eur(o.beneficio_esperado, { signo: true })}` : ''}</span>`;
  return `<span class="pill ${x[0]}">${x[1]}${k === 'revender' && o.beneficio_esperado ? ` · ${eur(o.beneficio_esperado, { signo: true })}` : ''}${k === 'revender' && o.vender_el ? ` · vender ${esc(o.vender_el)}` : ''}</span>`;
}

/**
 * un paso del plan, en corto (30 oct, Carlos: Hoy «más quirúrgica y clara»): cerrado se ve qué hacer, con quién, el
 * dinero, cuándo y el porqué en dos líneas; al tocarlo se abre el resto (datos, lo que pagaste, avisos, confianza,
 * saldo y «Hecho»)
 */
/** (24 nov, Carlos: «muchísimo texto… más al grano») la frase que decide un paso: la de la IA si es corta; si no, la
 *  primera frase del porqué de la app. El texto entero queda plegado debajo («Más detalle») */
const palabras = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const primeraFrase = (t) => String(t || '').trim().split(/(?<!(?:^|[\s(«"])[A-ZÁÉÍÓÚÑ]\.)(?<=[.:])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)[0] || '';
/** (24 nov, Carlos, con capturas de «Mirados y descartados»: «una cantidad ingente de texto») un descartado, en una frase:
 *  la primera y, si aún es larga, hasta su última pausa antes de los 120 caracteres */
export function breve(t, n = 120) {
  let f = primeraFrase(String(t || '').replace(/^La app lo (descarta|quita)[.:]?\s*/i, '').replace(/…$/, '')).trim();
  if (f.length > n) {
    const c = f.slice(0, n), i = Math.max(c.lastIndexOf(', '), c.lastIndexOf('; '), c.lastIndexOf(' y '), c.lastIndexOf(' ('), c.lastIndexOf(': '));
    f = (i >= 45 ? c.slice(0, i) : c.slice(0, c.lastIndexOf(' '))).replace(/[\s,;:]+$/, '');
  }
  f = f.replace(/[.:]$/, '');
  return f ? `${f.charAt(0).toUpperCase()}${f.slice(1)}.` : '';
}
function fraseDecide(o) {
  const m = String(o.motivo || '').trim();
  // (el cambio se lee entero: lo de no aceptar la oferta hasta tener al nuevo es la mitad del paso)
  if (o.descartada || palabras(m) <= (o.cambio && o.accion === 'vender' ? 42 : 30)) return m;
  const d = o.datos && o.datos.porque ? primeraFrase(o.datos.porque) : primeraFrase(m);
  const f = d.replace(/\.$/, '');
  return f ? `${f.charAt(0).toUpperCase()}${f.slice(1)}.` : m;
}
/** las cifras del paso en pastillas: las de la IA (claves) o las de la app (datos) */
function clavesDe(o) {
  if (Array.isArray(o.claves) && o.claves.length) return o.claves;
  const d = o.datos || {};
  return [d.cuanto, d.cuando && `Cuándo: ${d.cuando}`, d.siNo && `Si no: ${d.siNo}`].filter(Boolean);
}
/** (26 nov, IsmaelMartín) de dónde sale un fichaje (origenFichaje), al lado del nombre: si no cabe, baja de línea
 *  entera (nunca se corta) */
const ORI_CLS = { mercado: 'libre', venta: 'vende', trato: 'vende', clausula: 'abierta' };
const oriHTML = (ori) => (ori ? `<span class="pill pp-ori ${ORI_CLS[ori.tipo] || ''}">${esc(ori.txt)}</span>` : '');
function pasoOp(S, P, o) {
  const j = o.j;
  const ok = hecho(S, P, o);
  // si se ve en LaLiga que lo has hecho, se dice qué y no hace falta el botón
  const liga = hechoEnLiga(S, P, o);
  const curso = liga && liga.estado === 'curso';
  const est = o.descartada ? 'descartada' : curso ? 'curso' : ok ? 'hecho' : o.sugerencia ? 'sugerencia' : '';
  // el importe es el dinero que entra o sale, no lo que ganas: se dice dentro (en verde lo que entra)
  const imp = o.importe ? `<span class="pp-imp ${o.signo > 0 ? 'mas' : ''}">${o.signo > 0 ? '+' : o.signo < 0 ? '−' : ''}${eur(o.importe)}</span>` : '';
  const sub = [j && j.equipo, o.donde].filter(Boolean).map(esc).join(' · ');
  const nombre = j ? j.nombre : o.jugador || '';
  // la cara y el nombre abren su ficha (30 oct, Carlos: sin tener que ir a buscarlo al mercado); el resto de la
  // tarjeta la sigue abriendo y cerrando
  // (18, 9 nov) cerrado, una fila: la acción, quién, el dinero y, debajo, cuándo y el porqué en una línea
  // (26 nov, IsmaelMartín) de dónde sale el fichaje: «Mercado», «En venta · equipo» o «Cláusula · equipo»
  const ori = o.descartada ? null : origenFichaje(S.M, o);
  const estadoTxt = o.descartada ? '' : liga ? `<span class="pp-est ${liga.estado}">${esc(liga.texto)}</span>` : ok ? '<span class="pp-est hecho">Hecho</span>' : o.sugerencia ? '<span class="pp-cu">Sin prisa</span>' : o.cuando ? `<span class="pp-cu">${esc(String(o.cuando).replace(/^(hoy|esta noche|esta tarde|mañana) antes de las /i, 'antes de las '))}</span>` : '';
  // (24 nov) si la app lo ha sacado al repasar el plan con los datos de ahora, el paso dice qué ha cambiado y desde cuándo
  const cambiaTxt = pasoCambiaTxt(P, o);
  const porque = cambiaTxt ? `${cambiaTxt} ${String(o.decAhora.porque || '').trim()}` : o.descartada && o.aviso ? o.aviso : fraseDecide(o);
  // (24 nov, Carlos: «muchísimo texto… más resumido») un descartado dice solo por qué se descarta: sin la explicación de la
  // IA de por qué hacerlo, sin las pastillas ni la confianza
  const pie = `<div class="op-pie">${o.confianza && !o.sugerencia && !o.descartada ? `<span class="conf ${esc(o.confianza)}">Confianza ${esc(o.confianza)}</span>` : ''}${j ? `<button data-j="${esc(j.id)}">${icono('usuario')}Ficha</button>` : ''}${liga || o.descartada ? '' : `<button data-accion="hecho" data-n="${o.n}">${icono(ok ? 'cerrar' : 'ok')}${ok ? 'Deshacer' : 'Hecho'}</button>`}${o.saldo != null && !o.descartada ? `<span class="saldo ${o.saldo < 0 ? 'neg' : ''}">saldo ${eur(o.saldo)}</span>` : ''}</div>`;
  // (24 nov) el cambio: quién sale y quién entra, y los otros recambios (en la ficha del que sale)
  // (las dos caras solo si van los dos pasos en el plan; la puja sola es una puja más)
  const parCambio = !!o.cambio && (P.ops || []).some((p) => p !== o && p.cambio && p.cambio.sale === o.cambio.sale && !p.descartada);
  const jS = o.cambio && parCambio && S.D.maestro[o.cambio.sale], jE = o.cambio && parCambio && S.D.maestro[o.cambio.entra];
  const cambioHTML = o.cambio && jS && jE && !o.descartada ? `<div class="pp-cambio"><span class="pp-cj" data-j="${esc(jS.id)}">${ava(jS, 'p')}<b>${esc(jS.nombre)}</b><small>sale</small></span><span class="pp-cf" aria-hidden="true">→</span><span class="pp-cj" data-j="${esc(jE.id)}">${ava(jE, 'p')}<b>${esc(jE.nombre)}</b><small>entra</small></span></div>` : '';
  const recHTML = o.cambio && !o.descartada && S.D.maestro[o.cambio.sale] ? `<button class="enlace pp-rec" data-j="${esc(o.cambio.sale)}">Ver los recambios de ${esc(o.cambio.saleNombre || '')} ›</button>` : '';
  const dentro = o.descartada ? [sub ? `<p class="pp-sub">${sub}</p>` : '', porque ? `<p class="pp-mot pp-mot1">${esc(String(porque).replace(/^La app lo (descarta|quita)[.:]\s*/, ''))}</p>` : '', pie].join('') : [
    sub ? `<p class="pp-sub">${sub}</p>` : '',
    cambioHTML,
    porque ? `<p class="pp-mot pp-mot1">${esc(porque)}</p>` : '',
    recHTML,
    objetivoPill(o) || o.accion === 'pujar' && o.puja_max ? `<div class="pp-pills">${objetivoPill(o)}${o.accion === 'pujar' && o.puja_max ? `<span class="pill">Puja hasta ${eur(o.puja_max)}</span>` : ''}</div>` : '',
    o.motivo && porque !== o.motivo ? `<details class="pp-mas"><summary>Más detalle</summary><p class="pp-mot">${esc(o.motivo)}</p></details>` : '',
    o.compra && !o.descartada ? `<p class="paso-compra">${o.compra.desconocida ? 'Lo que pagaste por él no sale en los movimientos de la liga, así que no se sabe si con esta venta ganas o pierdes.' : `${o.compra.inicial ? `Venía en tu equipo inicial: al empezar la liga valía ${eur(o.compra.precio)}` : `Lo pagaste a ${eur(o.compra.precio)}`}: ${o.compra.con === 'venta' ? 'con esta venta' : 'hoy'} ${o.compra.gana >= 0 ? 'ganas' : 'pierdes'} <b class="${clase(o.compra.gana)}">${eur(Math.abs(o.compra.gana))}</b>.`}</p>` : '',
    // (lo que pagaste ya va en su línea: fuera de las pastillas)
    ((k) => (k.length ? `<div class="claves">${k.slice(0, 5).map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''))(clavesDe(o).filter((c) => !(o.compra && !o.descartada && /pagaste/.test(c)))),
    o.aviso && !(o.descartada && porque === o.aviso) ? `<div class="aviso-op ${o.descartada ? 'mal' : ''}">${icono(o.descartada ? 'alerta' : 'info')}${esc(o.aviso)}</div>` : '',
    pie,
  ].join('');
  // (en la fila corta, «Aceptar oferta» se queda en «Aceptar»: en un móvil de 360 se comía el nombre; dentro va entero)
  const acc = esc(o.cambio && !o.descartada ? (o.accion === 'vender' ? 'Cambio' : parCambio ? 'Recambio' : ACCION[o.accion] || o.accion) : o.etiqueta === 'Aceptar oferta' ? 'Aceptar' : o.etiqueta || ACCION[o.accion] || o.accion);
  // (sesión 8, M9) un botón dentro de summary no se puede alcanzar bien: la cara es un span que abre la ficha al tocarla
  // y, con el teclado, va el botón «Ficha» de dentro
  const cara = j ? `<span class="pp-j" data-j="${esc(j.id)}" aria-hidden="true">${ava(j, 'm')}</span>` : `<span class="pp-ic">${icono(o.accion === 'alinear' ? 'campo' : o.accion === 'esperar' ? 'reloj' : 'lista')}</span>`;
  return `<details class="paso2 paso3 ${esc(o.accion)} ${est}"><summary>
      <span class="pp-num" aria-hidden="true">${curso ? icono('reloj') : ok ? icono('ok') : o.descartada ? icono('cerrar') : ''}</span>
      ${cara}
      <span class="pp-c">
        <span class="pp-l1${ori ? ' con-ori' : ''}">${o.descartada ? `<span class="accion-t descartada">${cambiaTxt ? 'Ha cambiado' : 'Descartado'}</span>` : `<span class="accion-t ${esc(o.accion)}">${acc}</span>`}<b class="pp-nom">${esc(nombre || (o.descartada ? acc : o.accion === 'alinear' ? 'Tu once' : ''))}</b>${oriHTML(ori)}</span>
        <span class="pp-l2s${liga ? ' con-est' : ''}">${estadoTxt}${estadoTxt && porque ? '<i>·</i>' : ''}${porque ? `<span class="pp-porque">${esc(o.descartada ? String(porque).replace(/^La app lo (descarta|quita)[.:]\s*/, '') : porque)}</span>` : ''}</span>
      </span>
      ${imp || '<span></span>'}
    </summary><div class="pp-d">${dentro}</div></details>`;
}

/**
 * lo que ha cambiado en tu plantilla desde que la IA hizo el plan (un texto, o null): jugadores que se han ido o han
 * llegado sin que el plan lo dijera. Lo que el plan mandaba hacer (vender a uno, fichar a otro) no cuenta.
 */
export function cambiosDesdePlan(S) {
  const P = S.plan, M = S.M;
  if (P && !P.auto && P.empezo && M && M.enJuego) return `La jornada ${M.enJuego.n} ha empezado y se han reabierto las cláusulas.`;
  // (24 nov) lo que la app ha sacado del plan de la IA al repasarlo con los datos de ahora: se dice arriba, con «Rehacer el plan»
  const camb = P && !P.auto && P.t ? (P.ops || []).filter((o) => o.descartada && o.decAhora).length : 0;
  const cambTxt = camb ? `Desde las ${horaDe(P.t)} ${camb > 1 ? `han cambiado ${camb} pasos` : 'ha cambiado un paso'} (abajo, con su porqué).` : '';
  if (!P || P.auto || !P.foto || !Array.isArray(P.foto.mias) || !M) return cambTxt || null;
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
  if (!fuera.length && !dentro.length) return cambTxt || null;
  const lista = (l) => (l.length > 2 ? `${l.slice(0, 2).join(', ')} y ${l.length - 2} más` : l.join(' y '));
  return [fuera.length ? `Se ${fuera.length > 1 ? 'han ido' : 'ha ido'} ${lista(fuera)}.` : '', dentro.length ? `${dentro.length > 1 ? 'Han llegado' : 'Ha llegado'} ${lista(dentro)}.` : '', cambTxt].filter(Boolean).join(' ');
}

/**
 * (18, 9 nov: «que se entienda todo mejor») los pasos del plan por fases, en el orden en que cuadra el dinero: lo urgente
 * que no está en el plan, hacer caja, fichar, proteger y alinear; lo de otro día o sin prisa, aparte, y lo descartado,
 * plegado al final. Cada fase con lo que entra o sale y el saldo con el que te deja. Arriba, cuántos llevas hechos
 */
const FASES = [
  ['caja', 'Haz caja', 'lo que vendes o aceptas'],
  ['fichar', 'Ficha', 'pujas, compras y cláusulas'],
  ['proteger', 'Protege', 'tus cláusulas abiertas'],
  ['once', 'Alinea', 'antes de la jornada'],
];
function faseDe(o) {
  if (o.sugerencia || o.hoy === false || o.accion === 'esperar') return 'luego';
  if (o.accion === 'vender') return 'caja';
  if (['clausular', 'pujar', 'comprar'].includes(o.accion)) return 'fichar';
  if (o.accion === 'blindar') return 'proteger';
  return 'once';
}
function urgenteFila(S, a, nota) {
  const j = a.pid ? S.M.J(a.pid) : null;
  const largo = a.cuando && a.cuando.length > 14;
  const cara = j ? `<span class="pp-j" data-j="${esc(j.id)}" aria-hidden="true">${ava(j, 'm')}</span>` : `<span class="pp-ic">${icono(a.icono || 'alerta')}</span>`;
  // (26 nov) un fichaje urgente dice también de dónde sale
  const ori = ['clausular', 'pujar'].includes(a.tipo) ? origenFichaje(S.M, a) : null;
  return `<details class="paso2 paso3 urg t-${esc(a.tipo)}"><summary>
      <span class="pp-num" aria-hidden="true">${icono('alerta')}</span>${cara}
      <span class="pp-c"><span class="pp-l1${ori ? ' con-ori' : ''}"><span class="accion-t urg">Urgente</span><b class="pp-nom">${esc(a.titulo)}</b>${oriHTML(ori)}</span>
      <span class="pp-l2s">${a.cuando && !largo ? `<span class="pp-cu">${esc(a.cuando)}</span><i>·</i>` : ''}<span class="pp-porque">${esc(a.texto)}</span></span></span><span></span>
    </summary><div class="pp-d">${largo ? `<p class="pp-sub">${esc(a.cuando)}</p>` : ''}<p class="pp-mot pp-mot1">${esc(a.texto)}</p>${nota ? `<div class="aviso-op">${icono('info')}${esc(nota)}</div>` : ''}
      <div class="op-pie">${j ? `<button data-j="${esc(j.id)}">${icono('usuario')}Ficha</button>` : a.hash ? `<button data-ir="${esc(a.hash)}">${icono('flecha')}Ver</button>` : ''}${conSustituto(S, a) ? `<button data-accion="sustituto" data-pid="${esc(a.pid)}">${icono('buscar')}Buscar sustituto</button>` : ''}<button data-accion="quitarUrgente" data-k="${esc(claveUrgente(a))}">${icono('cerrar')}Quitar hasta mañana</button></div></div></details>`;
}
/** las fases que has plegado o abierto a mano en este plan: { caja: 'plegada' | 'abierta', … } */
export const fasesPlegadas = (P) => (P ? LS.get(K('fases'), {})[claveHechos(P)] || {} : {});
export function plegarFase(P, f, abierta) {
  const todas = LS.get(K('fases'), {}), k = claveHechos(P);
  // solo el plan de ahora: lo de los planes viejos no sirve
  LS.set(K('fases'), { [k]: { ...(todas[k] || {}), [f]: abierta ? 'abierta' : 'plegada' } });
}
function fasesHTML(S, P) {
  const { urg, nota } = urgentesDe(S);
  const vivos = P.ops.filter((o) => !o.descartada), fuera = P.ops.filter((o) => o.descartada);
  if (!vivos.length && !fuera.length && !urg.length) return '';
  const cp = cuentaPasos(S, P);
  const total = cp.pend + cp.hechos;
  let h = '';
  if (total) h += `<div class="plan-prog" role="progressbar" aria-label="Pasos del plan hechos" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${cp.hechos}"><i style="--p:${Math.round((cp.hechos / total) * 100)}%"></i><span>${cp.hechos ? `${cp.hechos} de ${total} hechos` : `${total} ${total > 1 ? 'pasos' : 'paso'} por hacer`}${cp.luego ? ` · ${cp.luego} para luego` : ''}</span></div>`;
  let k = 0;
  // (Carlos, 9 nov 12:29) cada fase se pliega tocando su título; se recuerda por plan. Una fase con todo hecho sale plegada
  const plegadas = fasesPlegadas(P);
  const caja = (f, titulo, sub, filas, { tot = null, saldo = null, cls = '', n = 0, todoHecho = false } = {}) => {
    k++;
    const abierta = plegadas[f] ? plegadas[f] === 'abierta' : !todoHecho;
    return `<details class="fase ${cls}" ${abierta ? 'open' : ''}><summary class="fase-t" data-accion="plegarFase" data-f="${f}"><span class="fase-n">${cls === 'f-urg' ? '!' : cls === 'f-luego' ? '·' : k - (urg.length ? 1 : 0)}</span><span class="fase-tx"><b>${titulo}</b><small>${sub}</small><small class="fase-cuantos">${todoHecho ? 'hecho' : `${n} ${n === 1 ? 'paso' : 'pasos'}`}</small></span>${tot ? `<span class="fase-tot ${tot > 0 ? 'mas' : 'menos'}">${tot > 0 ? '+' : '−'}${eur(Math.abs(tot))}</span>` : ''}${icono('flecha', 'fase-ab')}</summary>
      <div class="pasos3">${filas}</div>${saldo != null ? `<div class="fase-saldo"><span>Te quedan <b class="${saldo < 0 ? 'neg' : ''}">${eur(saldo)}</b></span></div>` : ''}</details>`;
  };
  if (urg.length) h += caja('urg', 'Antes de nada', 'urgente y fuera del plan', urg.map((a) => urgenteFila(S, a, nota[a.pid])).join(''), { cls: 'f-urg', n: urg.length });
  const conDinero = FASES.filter(([f]) => vivos.some((o) => faseDe(o) === f));
  conDinero.forEach(([f, titulo, sub], i) => {
    const ops = vivos.filter((o) => faseDe(o) === f);
    const tot = ops.reduce((s2, o) => s2 + (o.importe && o.signo ? o.signo * o.importe : 0), 0);
    // el saldo tras la fase: el del último paso con saldo (cuadrarPlan lo cuenta paso a paso); en la última, ya lo dice el cierre
    const ult = [...ops].reverse().find((o) => o.saldo != null);
    h += caja(f, titulo, sub, ops.map((o) => pasoOp(S, P, o)).join(''), { tot: Math.round(tot) || null, saldo: ult && i < conDinero.length - 1 ? ult.saldo : null, n: ops.length, todoHecho: ops.every((o) => hecho(S, P, o)) });
  });
  const luego = vivos.filter((o) => faseDe(o) === 'luego');
  if (luego.length) h += caja('luego', 'Para luego', 'sin prisa u otro día', luego.map((o) => pasoOp(S, P, o)).join(''), { cls: 'f-luego', n: luego.length });
  if (fuera.length) h += `<details class="pleg pasos-fuera"><summary>${icono('cerrar')}<b>${fuera.every((o) => o.decAhora) ? 'Ha cambiado desde el plan' : fuera.length > 1 ? 'Descartados por la app' : 'Descartado por la app'}</b><span>${fuera.length}</span>${icono('flecha', 'pleg-ab')}</summary><div class="pasos3">${fuera.map((o) => pasoOp(S, P, o)).join('')}</div></details>`;
  return h;
}

/** plegable con su título y cuántos hay (lo de después del plan: próximos días, vigila, noticias, rivales) */
const plegado = (ic, titulo, n, cuerpo, abierto = false, cls = '') => (cuerpo ? `<details class="pleg ${cls}" ${abierto ? 'open' : ''}><summary>${icono(ic)}<b>${titulo}</b>${n ? `<span>${n}</span>` : ''}${icono('flecha', 'pleg-ab')}</summary><div class="pleg-d">${cuerpo}</div></details>` : '');

/** sin planes con la IA hoy (la de la app: 2 al día y, en la de Google Play, uno más por anuncio hasta el tope). Donde no
    hay anuncios (la web, la app de la liga) son los de cada día y ya (Carlos, 14 nov) */
function cupoPlanHTML(cu) {
  const hechos = Math.min(cu.max, cu.gratis + (cu.extras || 0));
  const mas = cu.masConAnuncio && topConAnuncio();
  const t = !cu.masConAnuncio ? `Ya has hecho los ${cu.max} planes con la IA de hoy, el máximo.` : `Hoy ya has hecho tus ${hechos} planes con la IA.`;
  const x = mas ? `Para uno más, mira un anuncio corto (hasta ${cu.max} al día). Mientras, el plan de la app sigue al día con tus datos.` : `Mañana tienes otros ${cu.gratis}. Mientras, el plan de la app sigue al día con tus datos.`;
  return `<div class="caja plan-cupo" style="margin-top:10px"><b>${esc(t)}</b><p class="t2" style="margin:4px 0 ${mas ? '10px' : '0'}">${esc(x)}</p>${mas ? `<button class="btn chico" data-accion="planYa">${icono('ia')}Ver el anuncio</button>` : ''}</div>`;
}

/* (22 nov) una respuesta de la IA que se va de largo (7 frases o más, sin lista) se pliega: las 5 primeras a la vista y el
   resto detrás de «Seguir leyendo». Medido con la IA de verdad: un 3 % de las respuestas, casi todas con cuatro jugadores.
   Lo de «Revisado por la app» va siempre a la vista */
export function respuestaHTML(t) {
  const txt = String(t || '');
  const i = txt.indexOf('\n\n**Revisado por la app:**');
  const cuerpo = i >= 0 ? txt.slice(0, i) : txt, rev = i >= 0 ? txt.slice(i) : '';
  if (/^\s*(?:[-•*]|\d+[.)])\s/m.test(cuerpo)) return md(txt);
  const partes = cuerpo.split(/(?<=[.!?…])(\s+)(?=[\p{Lu}¿¡«"(*])/u);
  if ((partes.length + 1) / 2 < 7) return md(txt);
  const visto = partes.slice(0, 9).join(''), resto = partes.slice(10).join('');
  // (una negrita a medias entre lo visto y el resto se vería con sus asteriscos: entonces, entera)
  if ((visto.match(/\*\*/g) || []).length % 2) return md(txt);
  return `${md(visto)}<details class="resp-mas"><summary>Seguir leyendo</summary>${md(resto)}</details>${rev ? md(rev) : ''}`;
}

/* (22 nov, Carlos: «que lo que le digo a la IA se tenga en cuenta en los planes y SE VEA en el plan») Dentro del plan,
   lo que le ha contado en Pregunta y cuenta hoy: primero lo que manda en el motor (M.dicho: sin blindajes, a quién no vende,
   pujas ya hechas), después los tratos y lo que le contó de un jugador que sale en el plan. Cada cosa se quita con su × */
function dichoHTML(S, P) {
  const M = S.M || {};
  const mandan = M.dicho || [];
  const ids = new Set(mandan.map((n) => n.id));
  const enPlan = new Set(((P && P.ops) || []).filter((o) => !o.descartada).map((o) => o.pid).filter(Boolean));
  const otras = notasVigentes().filter((n) => !n.corr && !ids.has(n.id) && (n.tipo === 'trato' || (n.pid && enPlan.has(n.pid)))).slice(-3);
  if (!mandan.length && !otras.length) return '';
  const corto = (t) => { const x = String(t || '').trim(); return x.length > 64 ? `${x.slice(0, 61)}…` : x; };
  const fila = (n, txt, hasta) => `<span class="pd-c"><span>${esc(txt)}${hasta ? `<small> · hasta ${esc(cuando(hasta, { hora: false }))}</small>` : ''}</span><button data-accion="borrarNota" data-id="${esc(n.id)}" aria-label="Quitar: ${esc(txt)}">${icono('cerrar')}</button></span>`;
  return `<div class="plan-dicho"><div class="pd-t">${icono('nota')}Lo que me has dicho</div><div class="pd-l">${mandan.map((n) => fila(n, n.txt, n.hasta)).join('')}${otras.map((n) => fila(n, corto(n.texto), n.caduca)).join('')}</div></div>`;
}

function planHTML(S) {
  const { M } = S;
  const P = S.plan;
  const E = S.planEstado || {};
  let h = '';
  const esIA = P && !P.auto;
  // arriba, solo quién lo ha hecho y cuándo; el botón para pedir otro va al final de los pasos (y en la banda si tu liga
  // ha cambiado desde entonces), para no confundirlo con «Actualizar», que trae los datos de LaLiga
  // (sin el nombre ni la versión del modelo: Carlos, 3 nov)
  const demo = !!(S.D && S.D.demo), conIA = puedePlanIA(demo), cu = planesApp(demo) ? cupoPlanes() : null;
  // (con la IA de la app, lo que te queda hoy: 2 al día)
  const queda = cu && cu.ilimitado ? ' · sin límite' : cu && cu.quedan > 0 ? ` · ${cu.quedan === 1 ? 'te queda 1 hoy' : `te quedan ${cu.quedan} hoy`}` : '';
  // (Carlos, 14 nov) el de la IA dice de cuándo es: «de hoy 10:32 (hace 2 h)»
  const quien = P ? (esIA ? `Con la IA${P.web ? ' y Google' : ''} · de ${cuando(P.t)} (${rel(P.t)})${queda}` : 'Automático, sin IA') : '';
  // (0.7.13l, Carlos 16 nov) en lugar de «Compartir» y del «Otro plan» pequeño, «Rehacer el plan», más grande, y al lado sus
  // ajustes (el tono, a qué horas sale solo; la imagen para el grupo está ahí dentro). Cuándo sale solo el siguiente, debajo
  const rehacer = conIA && !E.cargando && P ? `<button class="plan-rehacer" data-accion="planYa" title="${esIA ? 'Vuelve a leer tu liga y las noticias (1 o 2 min). «Actualizar» solo trae los datos de LaLiga.' : 'Lee las noticias, las lesiones y los onces probables antes de decidir (1 o 2 min).'}">${icono('ia')}${esIA ? 'Rehacer el plan' : 'Hacerlo con la IA'}</button>` : '';
  const ajB = P && (conIA || !E.cargando) ? `<button class="b-ico plan-aj-b" data-accion="planAjustes" aria-label="Ajustes del plan" title="Ajustes del plan">${icono('ajustes')}</button>` : '';
  const pt = conIA ? proximoTurno(M) : null;
  // (25 nov) en la app de iOS no hay pasadas con la app cerrada: a su hora con la app abierta y, si no, al abrirla
  const sigue = pt ? ` · el siguiente sale solo ${diaDe(pt.t) !== diaDe() ? 'mañana ' : ''}a las ${pt.txt}${enApp && !nativo.hayFondo() ? ', o al abrir la app' : ''}` : '';
  h += `<div class="plan"><div class="plan-cab"><div class="eti">Plan de hoy</div>${rehacer}${ajB}</div>${quien ? `<div class="plan-quien">${icono(esIA ? 'ia' : 'lista')}<span>${quien}${sigue}</span></div>` : ''}`;
  if (E.cargando) h += `<div class="cargando-ia"><div class="t">${icono('ia', 'rojo')} Preparando tu plan</div><div class="p" id="paso-ia">${esc(E.paso || 'Leyendo noticias de tus jugadores y de los que te interesan…')}</div><div class="barra-ia"><i></i></div>${enApp ? `<div class="p2" id="plan-notif">${notifPlanHTML()}</div>` : ''}<button class="btn chico sec parar-ia" data-accion="pararPlan">${icono('parar')}Parar</button></div>`;
  if (E.error && E.clave) h += `<div class="error-c"><b>Google no acepta tu clave de la IA.</b> Puede que la hayas borrado en aistudio o que se haya copiado mal. Crea otra en aistudio.google.com/apikey y pégala.${P && P.auto ? '<br>Mientras, tienes el plan automático.' : ''}<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="cambiarClave">Poner otra clave</button><button class="btn chico sec" data-abrir="https://aistudio.google.com/apikey">Abrir aistudio</button></div></div>`;
  else if (E.error && !E.cupo) h += `<div class="error-c"><b>La IA no ha podido hacer el plan.</b> ${esc(E.error)}${P && P.auto && !/plan de la app|plan automático/i.test(E.error) ? '<br>Mientras, tienes el plan automático.' : ''}<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="plan">Reintentar</button><button class="btn chico sec" data-accion="diag">Ver qué ha pasado</button></div></div>`;
  if (E.cupo && !E.callado) h += cupoPlanHTML(E.cupo);
  if (!P) return h + '</div>';
  const cambios = !E.cargando && !(esIA && P.dia && P.viejo) ? cambiosDesdePlan(S) : null;
  if (esIA && P.dia && P.viejo) h += `<div class="banda">${icono('reloj')}<span>Este plan es de ${cuando(P.t)}.</span>${conIA && !E.cargando ? '<button data-accion="plan">Hacer el de hoy</button>' : ''}</div>`;
  // (Carlos, 14 nov) mientras la IA piensa, si falla o si no te quedan planes con la IA, se sigue viendo el último suyo de hoy,
  // diciendo de cuándo es y que puede no estar al día
  else if (esIA && !cambios && (E.cargando || E.error || E.cupo || Date.now() - P.t > 3 * 3600e3)) h += `<div class="banda plan-cambio">${icono('reloj')}<span>Es el último plan de la IA, de ${cuando(P.t)}: puede que no esté al día.${E.cargando ? ' El nuevo llega en un momento.' : ''}</span></div>`;
  else if (cambios) h += `<div class="banda plan-cambio">${icono('cambio')}<span>${esc(cambios)} El plan es de antes.</span>${conIA ? '<button data-accion="planYa">Rehacer el plan</button>' : ''}</div>`;
  // (22 nov) le has contado algo que manda después del último plan de la IA: ese ya no vale y sale el de la app con eso contado
  const UP = ultimoPlan();
  if (!esIA && !E.cargando && UP && !UP.auto && UP.dia === diaDe() && (M.dicho || []).some((n) => n.t > UP.t)) h += `<div class="banda plan-cambio">${icono('nota')}<span>Este plan ya cuenta lo que me has dicho. El de la IA era de antes.</span>${conIA ? '<button data-accion="planYa">Rehacerlo con la IA</button>' : ''}</div>`;
  h += `<div class="plan-titular">${esc(P.titular || '')}</div>${P.situacion ? (ancho() ? `<p class="plan-sit">${conEnlaces(S, P.situacion)}</p>` : `<details class="plan-sit-d"><summary class="plan-sit">${conEnlaces(S, P.situacion)}</summary></details>`) : ''}`;
  h += dichoHTML(S, P);
  h += fasesHTML(S, P);
  if (P.final != null && P.ops.some((o) => o.signo && o.importe)) h += `<div class="cierre ${P.avisoTipo === 'mal' ? 'mal' : P.avisoTipo === 'plan' ? 'oro' : ''}">${icono(P.avisoTipo === 'mal' ? 'alerta' : P.avisoTipo === 'plan' ? 'cambio' : 'euro')}<span>${P.avisoSaldo ? esc(P.avisoSaldo) : 'Te quedas con'}</span><span class="v">${eur(P.final)}</span></div>`;
  // lo que el plan te deja: las pujas que ya tienes hechas cuentan como gastadas, el once tras las ventas y si la
  // alineación de la IA no valía
  if (P.final != null && P.pujasHechas && P.ops.some((o) => o.signo && o.importe)) h += `<p class="t2 peq" style="margin:6px 2px 0">Cuenta como gastado lo que ya tienes pujado (${eur(P.pujasHechas)}): si no ganas alguna puja, tendrás eso de más.</p>`;
  if (P.avisoOnce) h += `<div class="cierre mal">${icono('campo')}<span>${esc(P.avisoOnce)}</span></div>`;
  if (P.avisoAlin) h += `<div class="cierre oro">${icono('alerta')}<span>${esc(P.avisoAlin)}</span></div>`;
  h += llevasHTML(S);
  // (en el ordenador, los próximos días van a la derecha, con los tiempos; en el móvil, plegados con lo demás)
  if (!ancho()) h += diasHTML(S, { plegar: true });
  // el once, abierto cuando la jornada está cerca; si no, plegado. Con la jornada en juego, nada: LaLiga lo cierra con el
  // primer partido y Hoy ya piensa en la siguiente (aviso de Domy, 31 oct); el que puntúa se ve en Directo
  const onceH = M.enJuego ? '' : onceHTML(S, P.alineacion, { sinCab: true });
  if (M.enJuego) h += `<button class="fila once-cerrado" data-ir="directo"><span class="ic-act">${icono('campo')}</span><div class="fila-c"><div class="fila-n">Tu once de la jornada ${M.enJuego.n} ya está cerrado</div><div class="fila-s">LaLiga no deja cambiarlo hasta la jornada ${M.proxima ? M.proxima.n : 'siguiente'}. Lo que lleva, en Directo.</div></div></button>`;
  if (onceH) {
    const abrir = !!M.enJuego || (M.proxima && M.proxima.ini - Date.now() < 2 * DIA);
    h += `<details class="once-pleg" ${abrir ? 'open' : ''}><summary>${icono('campo')}<b>Tu once</b><span>${M.enJuego ? `jornada ${M.enJuego.n} · en juego` : M.proxima ? `jornada ${M.proxima.n} · ${cuando(M.proxima.ini)}` : ''}</span></summary>${onceH}</details>`;
  }
  const abrir = ancho();
  if (Array.isArray(P.vigilar) && P.vigilar.length) h += plegado('ojo', 'Vigila', P.vigilar.length, P.vigilar.map((v) => notaJugador(S, v.jugador, v.texto)).join(''), abrir);
  if (Array.isArray(P.noticias) && P.noticias.length) h += plegado('info', 'Noticias que te afectan', P.noticias.length, P.noticias.map((n) => notaJugador(S, n.jugador, n.texto, n.efecto)).join(''), abrir);
  if (Array.isArray(P.rivales) && P.rivales.length) h += plegado('rivales', 'Tus rivales', P.rivales.length, P.rivales.map((r) => { const tid = M.teamDeManager(r.manager); const e = tid && S.D.clasif.find((x) => x.teamId === tid); return `<button class="fila" ${tid ? `data-r="${esc(tid)}"` : ''}>${e ? caraManager(e) : `<span class="ic-act">${icono('rivales')}</span>`}<div class="fila-c"><div class="fila-n">${esc(r.manager || '')}</div><div class="fila-s entero">${esc(r.texto || '')}</div></div></button>`; }).join(''), abrir);
  if (Array.isArray(P.descartes) && P.descartes.length) h += plegado('buscar', 'Mirados y descartados', P.descartes.length, P.descartes.map((d) => notaJugador(S, d.jugador, breve(d.motivo))).join(''));
  if (!conIA) h += `<div class="caja" style="margin-top:14px"><b>Este plan sale de los números, sin noticias.</b><p class="t2" style="margin:4px 0 10px">Con la IA (gratis) lee las noticias, las lesiones, las convocatorias y el calendario antes de decidir.</p><button class="btn chico" data-ir="ia">${icono('ia')}Pregunta</button></div>`;
  h += aciertosHTML(M);
  const fuentesP = (P.fuentes || []).filter((f) => !esWebFantasy(f.t) && !esWebFantasy(f.u));
  if (fuentesP.length) h += `<div class="sec"><h2>Fuentes</h2></div><div class="fuentes">${fuentesP.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>`;
  return h + '</div>';
}

/** lo que el plan dice de los próximos días y del parón */
function diasHTML(S, { plegar = false } = {}) {
  const P = S.plan;
  if (!P) return '';
  let h = '';
  if (Array.isArray(P.proximos_dias) && P.proximos_dias.length) {
    const dias = `<div class="dias">${P.proximos_dias.map((d) => `<div class="dia"><b>${esc(d.dia)}</b><span>${conEnlaces(S, d.texto)}</span></div>`).join('')}</div>`;
    h += plegar ? plegado('calendario', 'Los próximos días', P.proximos_dias.length, dias) : `<div class="sec"><h2>Los próximos días</h2></div>${dias}`;
  }
  // (lo que dice la IA del parón va aquí: el aviso de arriba de Hoy solo lleva a la pestaña Parón)
  if (P.paron) h += `<div class="caja">${icono('bandera', 'oro')} <b>El parón.</b> <span class="t2">${conEnlaces(S, P.paron)}</span></div>`;
  return h;
}

const hayTarjetaParon = (S) => !!(S.M && S.M.enParon && S.M.proxima && S.M.paron && S.M.proxima.ini >= S.M.paron.ini);
// (Carlos, 9 nov 15:17: en Hoy, solo un aviso pequeño en amarillo que lleve a la pestaña Parón, donde está todo)
function paronHTML(S) {
  if (!hayTarjetaParon(S)) return '';
  const { M } = S, v = M.proxima, ahora = Date.now();
  const lejos = paronLejos(M, ahora);
  return `<button class="paron-m ${lejos ? '' : 'vuelta'}" data-ir="directo" data-seg="paron:paron">${icono('bandera')}<b>Parón de selecciones</b><span>${lejos ? `J${v.n} en ${Math.max(1, Math.round((v.ini - ahora) / DIA))} días` : `vuelve la J${v.n} ${esc(cuando(v.ini))}`}</span>${icono('flecha', 'pm-f')}</button>`;
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
export function onceHTML(S, al, { conBanquillo = false, sinCab = false, directo = false } = {}) {
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
  // con la jornada en juego (en Equipo): el once que tienes puesto en LaLiga, con los puntos que lleva cada uno
  const V = directo && M.vivo && M.enJuego ? M.vivo : null;
  let real = false;
  // (aunque le falte alguno: el que tiene puesto, con los huecos vacíos, que no puntúan)
  let faltanReal = 0;
  if (!lineas && V && V.once) {
    const js = V.once.map((pid) => M.J(pid)).filter((j) => j && j.pos && j.pos < 5);
    const ls = [1, 2, 3, 4].map((p) => js.filter((j) => j.pos === p));
    if (ls[0].length <= 1 && js.length >= 5) {
      const fl = V.forma && ls.slice(1).every((l, i) => l.length <= V.forma[i]) ? V.forma : ls.slice(1).map((l) => l.length);
      lineas = ls; form = fl.join('-'); real = true;
      faltanReal = 11 - js.length;
    }
  }
  if (!lineas && M.once && M.once.formacion) { form = M.once.nombre; lineas = M.once.lineas; dudas = M.once.lineas.flat().filter((j) => j.estado === 'doubtful').map((j) => `${j.nombre}: es duda`); }
  if (!lineas) return '';
  // (19 nov, Carlos y el aviso de RIOYARAFC) fuera del directo, en el campo va el once que tienes puesto en LaLiga; el de
  // la app (o el de la IA) queda como recomendación: debajo, qué cambiaría, con los puntos y lo que tiene de ser titular
  let mio = false, rec = null;
  if (!real) {
    const g = S.D.demo ? null : LS.get(K('mi-once'), null);
    const mias = new Set(M.mias.map((x) => String(x.pid)));
    const js = g && Date.now() - g.t < 8 * DIA ? (g.ids || []).filter((pid) => mias.has(String(pid))).map((pid) => M.J(pid)).filter((j) => j && j.pos && j.pos < 5) : [];
    const ls = [1, 2, 3, 4].map((p) => js.filter((j) => j.pos === p));
    if (ls[0].length <= 1 && js.length >= 5) {
      rec = { lineas, form, deIA };
      const fg = Array.isArray(g.forma) && g.forma.length === 3 && ls.slice(1).every((l, i) => l.length <= g.forma[i]) ? g.forma : null;
      lineas = ls; form = (fg || ls.slice(1).map((l) => l.length)).join('-'); mio = true; deIA = false;
      faltanReal = 11 - js.length;
    }
  }
  const huecos = !deIA && !real && !mio && M.once.huecos;
  const modo = S.filtro.campo || 'pp';
  const f = String(form).split('-').map(Number);
  const tit = lineas.flat();
  const total = tit.reduce((s, j) => s + (j.pos < 5 ? M.ppEsperado(j) : 0), 0);
  // en directo: lo que llevas (el de LaLiga si lo da; si no, la suma de tu once) y tu puesto en la jornada
  let cabPts = `<b>${String(Math.round(total * 10) / 10).replace('.', ',')}</b> pts`;
  if (V) {
    const yoT = M.yo && M.yo.teamId != null ? String(M.yo.teamId) : null;
    const suma = tit.reduce((t, j) => t + (M.puntosVivo(j.id) || 0), 0);
    const lleva = real && yoT && V.equipos && V.equipos[yoT] != null ? V.equipos[yoT] : suma;
    const tabla = Object.entries(V.equipos || {}).sort((a, b) => b[1] - a[1]);
    const pos = yoT ? tabla.findIndex(([t]) => t === yoT) + 1 : 0;
    cabPts = `<span class="vivo-dot"></span><b>${lleva}</b> pts${pos && tabla.length > 1 ? ` · ${pos}º` : ''}`;
  }
  const sub = real ? `el tuyo en LaLiga · J${V.n} en directo` : mio ? 'el que tienes puesto en LaLiga' : deIA ? 'el de la IA' : 'el mejor según la app';
  const cambiosApp = deIA && al.cambiosApp ? `, con ${al.cambiosApp > 1 ? `${al.cambiosApp} cambios` : 'un cambio'} de la app` : '';
  let h = sinCab ? `<p class="t2 peq" style="margin:2px 0 6px">${mio ? 'El que tienes puesto en LaLiga.' : deIA ? `El que propone ${S.plan && (S.plan.auto || (S.plan.motor && !S.plan.modelo)) ? 'la app' : 'la IA'}${cambiosApp}.` : 'El mejor según la app. Cuando la app vea el que tienes puesto en LaLiga, saldrá aquí.'}</p>` : `<div class="sec"><h2>Tu once</h2><span class="sub">${sub}</span></div>`;
  h += `<div class="campo-cab"><span class="form">${esc(form)}</span><span class="pp${V ? ' pp-vivo' : ''}">${cabPts}</span>
    <div class="campo-modo">${[['pp', 'Puntos'], ['valor', 'Valor'], ['forma', 'Forma']].map(([k, t]) => `<button data-filtro="campo:${k}" class="${modo === k ? 'activo' : ''}">${t}</button>`).join('')}</div></div>`;
  const cambios = mio && rec ? cambiosOnce(M, lineas, form, rec) : null;
  const saleIds = new Set(cambios ? cambios.pares.filter((x) => x.sale).map((x) => String(x.sale.id)) : []);
  // de arriba abajo: delanteros, medios, defensas y el portero; los huecos que falten, como cromos vacíos
  // (26 nov, parte B) en una liga premium, el capitán y el banquillo que propone la app para el once que recomienda (el
  // suyo, el de la IA o el tuyo con sus cambios): una sola cuenta, la del motor. Con la jornada en juego ya no se cambian
  const pm = V || M.enJuego ? null : premiumOnce(M, rec ? rec.lineas : lineas, mio ? (LS.get(K('mi-once'), null) || {}).pr : null);
  const capId = mio ? (pm && pm.capTuyo ? String(pm.capTuyo.id) : null) : pm && pm.cap ? String(pm.cap.j.id) : null;
  const filas = [3, 2, 1, 0].map((i) => {
    const n = i === 0 ? 1 : f[i - 1] || 0;
    // (una línea vacía, como la delantera de un 4-6-0, no se pinta)
    if (!n && !(lineas[i] || []).length) return '';
    const js = (lineas[i] || []).slice(0, n);
    while (js.length < n) js.push(null);
    return `<div class="linea-c${n >= 6 ? ' seis' : n >= 5 ? ' cinco' : ''}">${js.map((j) => { const c = cromo(M, j, { modo, directo: !!V, cap: !!(j && capId === String(j.id)) }); return j && saleIds.has(String(j.id)) ? c.replace('class="cromo ', 'class="cromo sale-c ') : c; }).join('')}</div>`;
  });
  // (26 nov) el entrenador del campo (solo sale en una liga premium que los tiene): si el campo es el que tienes puesto en
  // LaLiga o el de la jornada en juego, el que TÚ alineaste (o ninguno); el que elige la app, solo en el once de la app
  const entDe = (ids) => { if (!(M.premium && M.premium.entrenador)) return null; const mias = new Set(M.mias.map((x) => String(x.pid))); return (ids || []).map((pid) => M.J(pid)).find((j) => j && j.pos === 5 && mias.has(String(j.id))) || null; };
  const ent = real ? entDe(V && V.once) : mio ? entDe((LS.get(K('mi-once'), null) || {}).ids) : deIA ? null : M.once && M.once.entrenador;
  h += `<div class="cancha"><i class="l-borde"></i><i class="l-medio"></i><i class="l-circ"></i><i class="l-area arriba"></i><i class="l-area abajo"></i>
    ${filas.join('')}${ent ? `<div class="cr-ent">${cromo(M, ent, { modo, chico: true, ent: true, directo: !!V })}</div>` : ''}</div>`;
  // (19 nov, Carlos: «no veo el sentido a cómo pone banquillo y lo del once de la app») fuera del directo, debajo del campo
  // solo lo que sirve: los cambios que haría la app y lo flojo de tu once con quién del mercado lo arreglaría (o una línea si
  // no hay nada flojo). Sin banquillo ni tira de «fuera» (Carlos, 08:20: «¿de qué sirve?»); siguen en la lista de la plantilla
  const hayCambios = !!(cambios && cambios.pares.length);
  if (hayCambios) h += cambiosOnceHTML(M, cambios);
  if (pm) h += premiumOnceHTML(pm);
  if (!V) h += fueraOnceHTML(M, { ver: veredictoOnce(M, tit, cambios, S.plan), sinCambios: !hayCambios, conLinea: mio });
  h += `<div class="puestos-c">${M.puestos.map((p) => `<button class="pz p${p.pos}${p.faltan ? ' falta' : p.conviene ? ' conviene' : p.sobran ? ' sobra' : ''}" data-accion="verPuesto" data-p="${p.pos}" title="Ver tus ${esc(POS_PLURAL[p.pos] || '')}"><b>${['', 'POR', 'DEF', 'MED', 'DEL'][p.pos]}</b> ${p.sanos}${p.faltan ? ` · faltan ${p.faltan}` : p.conviene ? ` · mejor ${p.sanos + p.conviene}` : p.sobran ? ' · sobran' : ''}</button>`).join('')}</div>`;
  const notas = [];
  if (huecos) notas.push(`<b class="rojo">${huecos > 1 ? `Te faltan ${huecos} jugadores sanos` : 'Te falta un jugador sano'} para completarlo.</b>`);
  // (26 nov, parte B) la formación que tienes puesta en LaLiga ya no vale en tu liga (una de las de premium con esa función
  // apagada por el administrador): con ella no se puntúa (ayuda de LaLiga, «Ligas premium»)
  const fPuesta = real ? V.forma : mio ? (LS.get(K('mi-once'), null) || {}).forma : null;
  if (Array.isArray(fPuesta) && M.formacionApagada(fPuesta)) notas.push(`<b class="rojo">Tu ${esc(fPuesta.join('-'))} no vale ahora en tu liga y con él no puntúas${real ? '' : ': pon otra formación en LaLiga Fantasy'}.</b>`);
  if ((real || mio) && faltanReal > 0) notas.push(`<b class="rojo">En LaLiga tienes ${11 - faltanReal} en el once: ${faltanReal > 1 ? `los ${faltanReal} huecos no puntúan` : 'el hueco no puntúa'}.</b>`);
  if (dudas.length) notas.push(`Dudas: ${esc(dudas.join(' · '))}`);
  // (aviso de Domy, 30 oct: un defensa del Racing contra el Madrid) el portero o el defensa que va de titular contra uno
  // que marca mucho, si no hay nadie mejor fuera del once (si lo hubiera, la app ya lo habría cambiado): se dice
  if (!real) {
    // (24 nov, captura de Carlos: «Alti → Juan Iglesias» arriba y, debajo, «no tienes a nadie fuera del once que sume más
    // en su sitio» por el mismo Alti) el que la app ya cambia por otro no cuenta aquí
    const cambiados = new Set(cambios ? cambios.pares.filter((x) => x.sale).map((x) => String(x.sale.id)) : []);
    const duros = tit.filter((j) => j.pos <= 2 && !cambiados.has(String(j.id)) && M.ppEsperado(j) < 2 && !dudas.some((d) => String(d).toLowerCase().includes(String(j.nombre).toLowerCase()))).filter((j) => { const fr = M.factorRival(j); return fr.p && fr.f <= 0.8; });
    if (duros.length) notas.push(`Contra un rival que marca mucho: ${esc(duros.map((j) => { const fr = M.factorRival(j); return `${j.nombre} (${fr.p.casa ? 'vs' : 'en'} ${fr.p.rival}, ~${String(Math.round(M.ppEsperado(j) * 10) / 10).replace('.', ',')} pts)`; }).join(', '))}, y no tienes a nadie mejor fuera del once.`);
  }
  notas.push(`<span class="leyenda">Arriba, su próximo rival: <i class="facil"></i>fácil <i class="media"></i>medio <i class="dificil"></i>difícil.${V ? '' : ' Abajo, lo que tiene de ser titular: <b class="alta">75 % o más</b>, <b class="media">50-74 %</b>, <b class="baja">menos</b>.'}</span>`);
  h += `<p class="t2 peq">${notas.join('<br>')}</p>`;
  return h;
}

/** (26 nov, parte B) el capitán y el banquillo de una liga premium para ese once: lo que propone el motor (`M.capitanDe`,
    `M.banquilloDe`) y, si la app ha reconocido lo que tienes puesto en LaLiga (`pr`, de `alineacionDe`), si ya coincide */
export function premiumOnce(M, lineas, pr = null) {
  if (!M.premium || !(M.premium.capitan || M.premium.banquillo || M.premium.entrenador) || !Array.isArray(lineas)) return null;
  // la propuesta del motor (sin los que la app te manda vender), la misma de la ficha y la IA; del banquillo no sale
  // quien sigue en el campo que se ve
  const pp = M.premiumPropuesta ? M.premiumPropuesta() : null;
  const enEste = new Set(lineas.flat().filter(Boolean).map((j) => String(j.id)));
  const cap = pp ? pp.capitan : null, ban = pp ? pp.banquillo.filter((b) => !enEste.has(String(b.j.id))) : [];
  // el entrenador: con dos, el que alinea `mejorOnce`; sin ninguno, el que conviene fichar
  const mios = M.premium.entrenador ? M.mias.filter((x) => x.j.pos === 5 && x.j.estado !== 'out_of_league').map((x) => x.j) : [];
  const elegido = mios.length >= 2 && M.once && M.once.entrenador ? M.once.entrenador : null;
  const otro = elegido ? mios.find((j) => j.id !== elegido.id) || null : null;
  const ent = elegido ? { j: elegido, otro: otro && M.mejorPartidoEnt(elegido, otro) ? otro : null } : null;
  const fichar = M.ficharEntrenador ? M.ficharEntrenador() : null;
  if (!cap && !ban.length && !ent && !fichar) return null;
  const tuyo = (id, pos) => { const j = id != null && M.mias.some((x) => String(x.pid) === String(id)) ? M.J(id) : null; return j && (pos == null ? j.pos < 5 : j.pos === pos) ? j : null; };
  return { cap, ban, ent, fichar, capTuyo: pr && pr.cap ? tuyo(pr.cap) : null, banTuyo: (p) => (pr && pr.banq && pr.banq[p] ? tuyo(pr.banq[p], p) : null), entTuyo: pr && pr.ent ? tuyo(pr.ent, 5) : null, partido: (j) => { const p = M.proximoPartido(j.equipoId); return p ? `${p.casa ? 'en casa contra' : 'fuera, contra'} ${p.rival}` : ''; } };
}
function premiumOnceHTML(pm) {
  const d1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const fila = (j, sub, tuyo) => `<div class="co-f pm-f"><button class="co-j" data-j="${esc(j.id)}">${ava(j, 'm')}<span><b>${esc(j.nombre)}</b><i>${sub}</i></span></button>${tuyo ? (String(tuyo.id) === String(j.id) ? `<span class="pm-ya">${icono('ok')} puesto</span>` : `<span class="pm-ya no">ahora, ${esc(tuyo.nombre)}</span>`) : ''}</div>`;
  let h = '';
  if (pm.cap) h += fila(pm.cap.j, `capitán · ~${d1(pm.cap.pp)} pts esperados`, pm.capTuyo);
  for (const b of pm.ban) h += fila(b.j, `banquillo ${POS_CORTA[b.pos]}${b.cubre ? ` · por si no juega ${esc(b.cubre.nombre)}` : ''}`, pm.banTuyo(b.pos));
  if (pm.ent) h += fila(pm.ent.j, `entrenador · ${esc(pm.partido(pm.ent.j) || 'el que más lleva por jornada')}${pm.ent.otro ? `, mejor partido que ${esc(pm.ent.otro.nombre)}` : ''}`, pm.entTuyo);
  if (pm.fichar) h += fila(pm.fichar.j, `no tienes entrenador · puja ${eur(pm.fichar.puja)} · ${d1(pm.fichar.media)} pts por jornada`, null);
  const partes = [pm.cap && 'capitán', pm.ban.length && 'banquillo', (pm.ent || pm.fichar) && 'entrenador'].filter(Boolean);
  const titulo = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0] || '';
  return `<div class="cambio-once pm-once"><div class="co-t">${titulo.charAt(0).toUpperCase()}${titulo.slice(1)}</div>${h}</div>`;
}
const POS_CORTA = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };

/** (19 nov) lo flojo de tu once: los que tienen menos de la mitad de ser titular (o están de baja) y no tienes a nadie
    mejor fuera (como mucho 3); para los 2 primeros, lo mejor de su puesto en el mercado que te llega y juega */
export function veredictoOnce(M, tit, cambios, plan = null) {
  const MAL = new Set(['injured', 'suspended', 'out_of_league']);
  // (24 nov, Carlos: «¿cómo puede recomendar a Pepelu en Equipo y descartarlo en el plan?») el plan manda: aquí no sale
  // como fichaje quien el plan ha mirado y descartado (o probado y no elegido), y va delante quien el plan ficha
  const ficha = new Set(((plan && plan.ops) || []).filter((o) => !o.descartada && !o.sugerencia && ['pujar', 'comprar', 'clausular'].includes(o.accion) && o.pid).map((o) => String(o.pid)));
  const noPlan = new Set([...((plan && plan.descartes) || []).map((d) => String(d && d.pid)), ...((plan && plan.cuentas && plan.cuentas.claves) || []).filter((k) => /^[PG]-/.test(k)).map((k) => k.slice(2))].filter((pid) => pid && !ficha.has(pid)));
  // (repaso del 24 nov) y lo que el plan no ficha por otra razón (plantilla llena, el parón, no te llega…)
  for (const m of M.mercado || []) if (M.decisionFichar && !ficha.has(String(m.pid)) && (M.decisionFichar(m.pid) || {}).accion === 'no') noPlan.add(String(m.pid));
  const tp = (j) => { const T = M.titularidad ? M.titularidad(j) : null; return T ? T.p : null; };
  const pp = (j) => (j && j.pos < 5 ? M.ppEsperado(j) : 0);
  const salen = new Set(cambios ? cambios.pares.filter((x) => x.sale).map((x) => String(x.sale.id)) : []);
  const flojos = tit.filter((j) => j && j.pos < 5 && !salen.has(String(j.id)) && (MAL.has(j.estado) || (tp(j) != null && tp(j) < 0.5)))
    .sort((a, b) => (tp(a) || 0) - (tp(b) || 0)).slice(0, 3);
  const usados = new Set();
  const mercado = (j) => {
    const m = (M.mercado || []).filter((x) => x.j && x.j.pos === j.pos && !usados.has(x.pid) && !noPlan.has(String(x.pid)) && !MAL.has(x.j.estado) && x.meLlega && !x.noVende && (tp(x.j) || 0) >= 0.6 && pp(x.j) > pp(j))
      .sort((a, b) => (ficha.has(String(b.pid)) ? 1 : 0) - (ficha.has(String(a.pid)) ? 1 : 0) || pp(b.j) - pp(a.j))[0] || null;
    if (m) usados.add(m.pid);
    return m;
  };
  return { flojos: flojos.map((j, i) => ({ j, p: tp(j), m: i < 2 ? mercado(j) : null })), tp };
}
function fueraOnceHTML(M, { ver, sinCambios, conLinea }) {
  const MAL = new Set(['injured', 'suspended', 'out_of_league']);
  const pc = (p) => (p == null ? '' : `${Math.round(p * 100)}\u00a0%`);
  const est = (j) => (j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga');
  let h = '';
  const fl = ver.flojos;
  if (!fl.length) return h + (sinCambios && conLinea ? `<p class="t2 peq co-ok">${icono('ok')} Nadie de fuera mejora tu once.</p>` : '');
  h += `<div class="cambio-once vo-flojo"><div class="co-t">Lo flojo de tu once</div>${fl.map((x) => `<div class="co-f"><button class="co-j sale" data-j="${esc(x.j.id)}">${ava(x.j, 'm')}<span><b>${esc(x.j.nombre)}</b><i>${MAL.has(x.j.estado) ? est(x.j) : `titular ${pc(x.p)}`}</i></span></button><span class="co-fl" aria-hidden="true">→</span>${x.m ? `<button class="co-j entra" data-j="${esc(x.m.pid)}">${ava(x.m.j, 'm')}<span><b>${esc(x.m.j.nombre)}</b><i>${pc(ver.tp(x.m.j))} · ${eur(x.m.puja || x.m.precio)}</i></span></button>` : `<button class="co-j entra" data-accion="sustituto" data-pid="${esc(x.j.id)}"><span><b>Ver sustitutos</b></span></button>`}</div>`).join('')}</div>`;
  return h;
}

/** (19 nov) lo que cambiaría la app en el once que tienes puesto en LaLiga: quién sale y quién entra, del mismo puesto
    si se puede; si no, con otra formación. Solo los cambios que se notan: el que sale está lesionado o sancionado, el
    que entra suma 0,3 puntos esperados más o tiene 20 puntos más de ser titular (en el Fantasy pesa tanto que juegue
    como lo que pueda hacer: Carlos, 19 nov) */
function cambiosOnce(M, lineas, form, rec) {
  const pp = (j) => (j && j.pos < 5 ? M.ppEsperado(j) : 0);
  const tp = (j) => { const T = j && M.titularidad ? M.titularidad(j) : null; return T ? T.p : null; };
  const MAL = new Set(['injured', 'suspended', 'out_of_league']);
  const mios = lineas.flat().filter(Boolean);
  const recJs = (rec.lineas || []).flat().filter((j) => j && j.pos < 5);
  const enMio = new Set(mios.map((j) => String(j.id))), enRec = new Set(recJs.map((j) => String(j.id)));
  const salen = mios.filter((j) => !enRec.has(String(j.id))).sort((a, b) => pp(a) - pp(b));
  const entran = recJs.filter((j) => !enMio.has(String(j.id))).sort((a, b) => pp(b) - pp(a));
  const f = String(form).split('-').map(Number), fr = String(rec.form).split('-').map(Number);
  const huecosEn = (pos) => (pos === 1 ? 1 : f[pos - 2] || 0) - mios.filter((j) => j.pos === pos).length;
  const pares = [];
  for (const e of [...entran]) {
    const i = salen.findIndex((x) => x.pos === e.pos);
    if (i >= 0) { pares.push({ sale: salen[i], entra: e }); salen.splice(i, 1); entran.splice(entran.indexOf(e), 1); }
  }
  for (const e of [...entran]) if (huecosEn(e.pos) > 0 && !pares.some((x) => !x.sale && x.entra.pos === e.pos)) { pares.push({ sale: null, entra: e }); entran.splice(entran.indexOf(e), 1); }
  // lo que queda es cambio de formación: se empareja en orden
  while (salen.length && entran.length) pares.push({ sale: salen.shift(), entra: entran.shift(), otraForma: true });
  for (const e of entran) pares.push({ sale: null, entra: e });
  // (19 nov, Carlos: «por 0,5 pts me cambia a uno con 74 % por uno con 47 %: tiene que haber un balance y premiar la
  // titularidad») cada cambio se valora con lo que gana en puntos esperados (que ya cuentan el rival) y con lo que gana
  // o pierde en ser titular: cada 10 puntos de titular valen 0,4 pts. Solo sale si así gana medio punto; uno que juega
  // menos de la mitad de las veces no entra por uno que juega 6 de cada 10 salvo que gane 2 pts o más
  const vale = pares.filter(({ sale, entra }) => {
    if (!sale || MAL.has(sale.estado)) return true;
    const ts = tp(sale), te = tp(entra), dp = pp(entra) - pp(sale);
    const dt = ts != null && te != null ? te - ts : 0;
    if (te != null && ts != null && te < 0.5 && ts >= 0.6 && dp < 2) return false;
    return dp + 4 * dt >= 0.5;
  });
  const gana = vale.reduce((t, x) => t + pp(x.entra) - pp(x.sale), 0);
  return { pares: vale, gana, forma: vale.some((x) => x.otraForma) && fr.join('-') !== f.join('-') ? rec.form : null, deIA: rec.deIA };
}
function cambiosOnceHTML(M, C) {
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const MAL = new Set(['injured', 'suspended', 'out_of_league']);
  const dato = (j) => {
    const T = M.titularidad ? M.titularidad(j) : null;
    const est = MAL.has(j.estado) ? (j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga') : null;
    const fr = M.factorRival ? M.factorRival(j) : null;
    const rv = fr && fr.p && fr.p.rival ? ` · ${fr.p.casa ? 'vs' : 'en'} ${fr.p.rival}` : '';
    return est || `${d1(M.ppEsperado(j))} pts${T && T.p > 0 ? ` · titular ${Math.round(T.p * 100)}\u00a0%` : T ? ' · no sale de titular' : ''}${rv}`;
  };
  const quien = C.deIA ? 'la IA' : 'la app';
  if (!C.pares.length) return '';
  const filas = C.pares.map(({ sale, entra }) => `<div class="co-f">${sale ? `<button class="co-j sale" data-j="${esc(sale.id)}">${ava(sale, 'm')}<span><b>${esc(sale.nombre)}</b><i>${esc(dato(sale))}</i></span></button><span class="co-fl" aria-hidden="true">→</span>` : '<span class="co-hueco">Hueco libre</span><span class="co-fl" aria-hidden="true">→</span>'}<button class="co-j entra" data-j="${esc(entra.id)}">${ava(entra, 'm')}<span><b>${esc(entra.nombre)}</b><i>${esc(dato(entra))}</i></span></button></div>`).join('');
  const gana = C.gana >= 0.1 ? ` · <b class="sube">+${d1(C.gana)} pts esperados</b>` : '';
  return `<div class="cambio-once"><div class="co-t">Cambios que haría ${quien}${C.forma ? ` (con ${esc(C.forma)})` : ''}${gana}</div>${filas}<p class="t2 peq">El once lo cambias tú en LaLiga Fantasy.</p></div>`;
}

function notaJugador(S, nombre, texto, efecto) {
  const k = String(nombre || '').toLowerCase();
  const j = Object.values(S.D.maestro).find((x) => x.nombre.toLowerCase() === k) || Object.values(S.D.maestro).find((x) => k && x.nombre.toLowerCase().includes(k));
  const mio = j && S.M.mias.some((x) => x.pid === j.id);
  return `<button class="fila" ${j ? `data-j="${esc(j.id)}"` : ''}>${j ? ava(j, 'm') : `<span class="ic-act">${icono('info')}</span>`}<div class="fila-c"><div class="fila-n">${esc(nombre || '')}${mio ? '<span class="pill abierta">Tuyo</span>' : ''}</div><div class="fila-s entero">${esc(texto || '')}</div></div>${efecto ? `<div class="fila-d cifra ${efecto === 'sube' ? 'sube' : efecto === 'baja' ? 'baja' : 'apag'}">${efecto === 'sube' ? '▲' : efecto === 'baja' ? '▼' : '•'}</div>` : ''}</button>`;
}

/* ================= HOY ================= */
/** un saludo con la fecha (y tu nombre de manager) */
function saludoHTML(S) {
  const h = Number(new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }));
  const sal = h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches';
  // el nombre de manager suele ser el del equipo («Unión Clausulera»): solo se usa si parece un nombre de persona
  const cand = String((S.D.yo && S.D.yo.nombre) || (S.M.yo && S.M.yo.manager) || '').trim();
  const equipo = String((S.M.yo && S.M.yo.nombre) || '').trim();
  const nombre = cand && cand !== equipo && !/[.\d_]|\b(fc|cf|ud|cd|sd|rcd|club|team|united|real)\b/i.test(cand) ? cand.split(/\s+/)[0] : '';
  const fecha = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="saludo"><span class="eti">${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</span><span class="t2">${sal}${nombre ? `, <b>${esc(nombre)}</b>` : ''}</span></div>`;
}
/** (23 nov, Carlos: «cuando me salgo de la aplicación no me sale ninguna notificación… no sé si es porque he quitado las
    notificaciones») debajo de «Preparando tu plan», en la app: si sale de la app, se sigue haciendo; con las notificaciones
    apagadas, se le dice que así no le puede avisar y se le ofrece activarlas (app.js lo cambia al volver del permiso) */
export function notifPlanHTML() {
  const t = ['play', 'ios'].includes(nativo.canal()) ? 'Tarda menos de un minuto' : 'Tarda uno o dos minutos';
  if (nativo.avisosPermitidos()) return `${t}. Puedes salir de la app: se sigue haciendo y te aviso cuando esté.`;
  return `${t}. Si sales de la app se sigue haciendo, pero con las notificaciones apagadas no te puedo avisar cuando esté. <button class="btn chico sec" data-accion="permisoPlan">${icono('campana')}Activar notificaciones</button>`;
}

export function hoy(S) {
  if (ancho()) return hoyAncho(S);
  const { D, M } = S;
  let h = '';
  h += bandasHoy(S);
  // (0.7.13o, Carlos 16 nov) el aviso del parón arriba del todo, encima del marcador; lo que falta para el mercado y
  // demás, dentro del marcador
  h += paronHTML(S);
  // (18, 9 nov) en el móvil, el marcador en una franja y el plan en la primera pantalla; sin saludo
  h += marcador(S, { corto: true, tiempos: true });
  h += ahoraHTML(S);
  h += planHTML(S);
  h += noticiasHTML(S, { plegar: true });
  void D; void M;
  return h;
}

/** Hoy en el ordenador: el plan en grande a la izquierda y la liga de un vistazo a la derecha */
function hoyAncho(S) {
  const { M } = S;
  let izq = saludoHTML(S) + ahoraHTML(S) + planHTML(S);
  izq += noticiasHTML(S);
  void M;
  const der = marcador(S, { tiempos: true }) + diasHTML(S) + aTiroHTML(S) + movimientosHTML(S, 5);
  return bandasHoy(S) + paronHTML(S) + cols(izq, der);
}
function bandasHoy(S) {
  const { D } = S;
  let h = '';
  if (D.demo) {
    // (sesión 8, A9) en la web del móvil, con tu liga hace falta la app (Android) o pasar una vez por un ordenador (iPhone)
    const ua = enApp ? '' : navigator.userAgent || '', mov = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/.test(ua) ? 'iphone' : null;
    const conMia = mov === 'android' ? ' Para la tuya, en el móvil, hace falta la app de Android.' : mov === 'iphone' ? ' Para la tuya, entra con tu cuenta de LaLiga.' : '';
    h += `<div class="banda">${icono('info')}<span>Liga de ejemplo con datos inventados.${conMia}</span><button data-accion="salirDemo">Usar la mía</button></div>`;
  }
  // (lo que falla pero se ha tapado con lo de la última vez, como las ofertas, no se avisa: queda en el diagnóstico)
  const av = (D.avisos || []).filter((a) => !a.leve);
  if (av.length) {
    const graves = av.some((a) => /formato|vac[ií]/i.test(a.e) || ['jugadores', 'plantillas', 'tu plantilla', 'mercado'].includes(a.paso));
    const conexion = av.every((a) => /conexi|connect|tiempo agotado|timeout/i.test(a.e || ''));
    h += `<div class="banda">${icono('alerta')}<span>${conexion ? 'Sin conexión al leer' : 'No se ha podido leer'}: ${esc(av.map((a) => a.paso).slice(0, 3).join(', '))}${av.length > 3 ? ` y ${av.length - 3} más` : ''}.${graves ? ' Lo que depende de eso puede salir incompleto.' : conexion ? ' Dale a Actualizar en un rato.' : ''}</span><button data-accion="${graves ? 'mandarFallo' : conexion ? 'recargar' : 'diag'}">${graves ? 'Avisar' : conexion ? 'Actualizar' : 'Ver'}</button></div>`;
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
function noticiasHTML(S, { plegar = false } = {}) {
  const { M } = S;
  if (!M.noticias.length) return '';
  if (plegar) {
    const mios = new Set(M.mias.map((x) => x.pid));
    const tuyas = M.noticias.filter((n) => (n.pids || []).some((p) => mios.has(p)));
    const resto = M.noticias.filter((n) => !tuyas.includes(n));
    return plegado('info', 'Noticias', tuyas.length ? `${tuyas.length} de los tuyos` : M.noticias.length, `<div class="noticias-l">${[...tuyas.slice(0, 4), ...resto.slice(0, 6 - Math.min(4, tuyas.length))].map(filaNoticia).join('')}</div>`);
  }
  const mios = new Set(M.mias.map((x) => x.pid));
  const tuyas = M.noticias.filter((n) => (n.pids || []).some((p) => mios.has(p)));
  const resto = M.noticias.filter((n) => !tuyas.includes(n));
  const n = ancho() ? 8 : 6;
  return `<div class="sec"><h2>Noticias</h2><span class="sub">${tuyas.length ? `${tuyas.length} de los tuyos` : 'Google Noticias'}</span></div><div class="noticias-l">${[...tuyas.slice(0, 4), ...resto.slice(0, n - Math.min(4, tuyas.length))].map(filaNoticia).join('')}</div>`;
}
function movimientosHTML(S, n) {
  const act = S.M.actividad.filter((a) => a.clase !== 'premio').slice(0, n);
  return act.length ? `<div class="sec"><h2>Últimos movimientos</h2><button class="mas" data-ir="mercado" data-seg="mercado:movimientos">Todos</button></div>${act.map(filaActividad).join('')}` : '';
}

/* ================= TUS JUGADORES EN VENTA ================= */
const CONSEJO = { aceptar: '<span class="pill bien">Acepta</span>', esperar: '<span class="pill duda">Espera</span>' };
export function ventaHTML(v) {
  const m = v.mejor;
  const ofs = v.ofertas.map((o) => `<div class="oferta"><span class="de ${o.deLiga ? 'liga' : ''}">${esc(o.de)}</span><span class="cifra">${eur(o.importe)}</span><span class="${o.sobre >= 0 ? 'sube' : 'baja'} cifra">${pct(o.sobre * 100)}</span>${o.caduca ? `<span class="apag">${icono('reloj')}${cuando(o.caduca)}</span>` : ''}</div>`).join('');
  return `<div class="venta"><button class="fila" data-j="${esc(v.pid)}">${ava(v.j)}
      <div class="fila-c"><div class="fila-n">${posTag(v.j)}<span>${esc(v.j.nombre)}</span></div>
        <div class="fila-s">Puesto a ${eur(v.precio)} · vale ${eur(v.j.valor)}${v.compra ? ` · pagaste ${eur(v.compra)}` : ''}</div>
        <div class="fila-x">${CONSEJO[v.consejo] || ''}${v.ofertas.length ? `<span class="pill">${v.ofertas.length} oferta${v.ofertas.length === 1 ? '' : 's'}</span>` : ''}</div></div>
      <div class="fila-d">${m ? `<div class="v ${m.sobre >= 0 ? 'sube' : ''}">${eur(m.importe)}</div><div class="d apag">mejor oferta</div>` : '<div class="d apag">sin ofertas</div>'}</div></button>
    ${ofs ? `<div class="ofertas">${ofs}</div>` : ''}${v.ligaEst ? `<p class="t2 peq" style="margin:6px 0 0">La oferta de LaLiga llegará con el cambio de mercado: entre <b>${eur(v.ligaEst.una ? v.ligaEst.una.min : v.ligaEst.v)}</b> y <b>${eur(v.ligaEst.una ? v.ligaEst.una.max : v.ligaEst.v)}</b>, a suerte (de −10 % a +10 % de su valor).</p>` : ''}${v.porque && v.consejo !== 'sin ofertas' ? `<p class="t2 peq" style="margin:6px 0 0">${esc(v.porque)}${v.ganado != null ? ` Con la mejor oferta ganas <b class="${clase(v.ganado)}">${eur(v.ganado, { signo: true })}</b> sobre lo que pagaste.` : ''}</p>` : ''}</div>`;
}

/* ================= EQUIPO ================= */
/** las subpestañas, con un número al lado cuando hay algo que contar ([clave, texto, número, 'rojo'|'']) */
// las pestañas de cada pantalla: se quedan fijas arriba al bajar (el ancla marca dónde van, para volver a ellas)
export const tabs = (v, actual, lista, { llenas = false } = {}) => `<div class="tabs-ancla"></div><div class="tabs${llenas ? ' llenas' : ''}"><div class="tabs-in" role="tablist"${llenas ? ` style="--n:${lista.length}"` : ''}>${lista.map(([k, t, n, cls]) => `<button data-seg="${v}:${k}" role="tab" aria-selected="${actual === k}" class="${actual === k ? 'activo' : ''}">${t}${n ? `<span class="tab-n ${cls || ''}">${n}</span>` : ''}</button>`).join('')}</div></div>`;

/* ================= EQUIPO ================= */
// Rediseño del 30 oct (lo pidió Carlos: «todo más claro y más visual»): arriba tu cara, el nombre y cuatro números; las
// pestañas caben sin salirse; en Plantilla, el estado del equipo en casillas y lo que pide atención, cada cosa con su
// botón; la plantilla se puede ordenar; en Cláusulas, el resumen en casillas y una barra de lo protegida que está cada una
const MALOS_EQ = ['injured', 'suspended', 'out_of_league'];

/** arriba: tu cara, el nombre del equipo y el valor (con lo que ha cambiado en 7 días), el puesto, el saldo y la plantilla */
function eqCabHTML(S) {
  const { M, D, H } = S;
  const yoE = (D.clasif || []).find((e) => e.esYo) || null;
  // lo que han subido o bajado en 7 días los que tienes ahora (el valor del equipo de hace 7 días contaba también a los
  // que has vendido: Carlos vio «−14,75 M» tras vender a varios)
  void H;
  const con7 = M.mias.filter((x) => x.tend && x.tend.d7 != null);
  const dv = con7.length ? con7.reduce((s, x) => s + num(x.tend.d7), 0) : null;
  const jug = M.mias.filter((x) => x.j.pos !== 5).length, ent = M.mias.length - jug;
  return `<div class="eq2-cab">
    <div class="eq2-quien">${yoE ? caraManager(yoE, 'g') : ''}<div class="eq2-nom"><div class="eti">Tu equipo</div><h1 class="titulo"><span class="eq2-nombre">${esc((M.yo && M.yo.nombre) || 'Tu equipo')}</span></h1></div></div>
    <div class="eq2-num">
      <button data-accion="ver" data-seg2="equipo:dinero" data-sel="#eq-valor" title="Valor del equipo: ver Beneficio"><b>${eur(D.valorEquipo)}</b><span>valor ›</span>${dv != null && Math.abs(dv) >= 1000 ? `<i class="${clase(dv)}">${eur(dv, { signo: true })} en 7 días</i>` : ''}</button>
      <button data-ir="rivales" data-seg="rivales:clasif" title="Tu puesto: ver la clasificación"><b>${M.yo ? `${M.yo.pos}º` : '–'}</b><span>${M.yo ? `${M.yo.puntos} pts ›` : 'en la liga ›'}</span></button>
      <button data-ir="hoy" title="Tu saldo: ver las cuentas del plan"><b class="${D.dinero != null && num(D.dinero) < 0 ? 'baja' : ''}">${D.dinero != null ? eur(D.dinero) : '–'}</b><span>saldo ›</span></button>
      <button data-accion="ver" data-seg2="equipo:plantilla" data-sel="#eq-plantilla" title="Ver la plantilla"><b>${jug}</b><span>jugadores${ent ? ` y ${ent} entr.` : ''} ›</span></button>
    </div>
  </div>`;
}

/** el estado de tu equipo: casillas y, debajo, lo que pide atención (bajas, suplentes, los que hay que vender y las
    cláusulas en riesgo), cada uno con su botón: buscar sustituto o ir a sus cláusulas */
function eqEstadoHTML(S) {
  const { M } = S;
  const xs = M.mias.filter((x) => x.j && x.j.pos !== 5);
  if (!xs.length) return '';
  const conf = (x) => ((M.alineacion && M.alineacion(x.j.id)) || {}).estado;
  const sinI = bloqueada('inercia');
  const at = [];
  for (const x of xs) {
    const c = conf(x);
    if (MALOS_EQ.includes(x.j.estado)) at.push({ x, n: 'mal', t: x.j.estado === 'injured' ? 'Lesionado' : x.j.estado === 'suspended' ? (M.sancionCorta && M.sancionCorta(x.j) ? (x.ventaInercia || M.vendeBaja(x) ? 'Sancionado una jornada' : 'Sancionado una jornada: se aguanta') : 'Sancionado más de un partido') : 'Fuera de LaLiga', sust: true });
    else if (['fuera', 'baja'].includes(c)) at.push({ x, n: 'mal', t: 'No va convocado', sust: true });
    else if (['suplente', 'nosale'].includes(c)) at.push({ x, n: 'duda', t: 'No es titular en el once confirmado', sust: true });
    else if (x.j.estado === 'doubtful') at.push({ x, n: 'duda', t: 'En duda para el próximo partido', sust: true });
    // (24 nov, decide.js) lo mismo que la pastilla, el plan y la IA: antes aquí ponía «toca venderlo» de un titular que la pastilla aguantaba
    const vvA = ventaVista(M, x, { sinInercia: sinI });
    if (vvA) at.push({ x, n: vvA.n, t: vvA.largo, sust: true });
    if (x.riesgo === 'alto') at.push({ x, n: 'mal', t: `Cláusula en riesgo: ${eur(x.clausula)}${x.abierta ? ', abierta' : ''}`, cl: true });
  }
  at.sort((a, b) => (a.n === b.n ? 0 : a.n === 'mal' ? -1 : 1));
  const pueden = xs.filter((x) => !MALOS_EQ.includes(x.j.estado) && !['fuera', 'baja'].includes(conf(x))).length;
  const suben = xs.filter((x) => x.tend && num(x.tend.d1) > 0).length, bajan = xs.filter((x) => x.tend && num(x.tend.d1) < 0).length;
  const abiertas = M.mias.filter((x) => x.abierta && x.clausula).length, riesgo = M.mias.filter((x) => x.riesgo === 'alto').length;
  const vender = sinI ? null : xs.filter((x) => { const d = M.decision ? M.decision(x.pid) : null; return d && d.accion === 'vender'; }).length;
  const tiles = [
    // (22 nov) abre la hoja de las bajas de la jornada en «Tu liga», con los tuyos primero (bajas.js; Carlos: sin botón nuevo en Equipo)
    `<button class="eq2-t eq2-bajas ${pueden < xs.length ? 'duda' : 'bien'}" data-accion="bajas" data-v="liga" aria-label="${pueden} de ${xs.length} pueden jugar: ver las bajas"><b>${pueden}<small>/${xs.length}</small></b><span>pueden jugar ›</span><span class="cz-t cz-mini" aria-hidden="true">${icono('cruz')}</span></button>`,
    `<button class="eq2-t" data-accion="ordenEq" data-o="sube" data-ver="1"><b><em class="sube"><small>▲</small>${suben}</em> <em class="baja"><small>▼</small>${bajan}</em></b><span>suben y bajan hoy ›</span></button>`,
    vender != null ? (vender ? `<button class="eq2-t duda" data-accion="ver" data-sel="#eq-atencion"><b>${vender}</b><span>para vender ›</span></button>` : '<div class="eq2-t"><b>0</b><span>para vender</span></div>') : '',
    `<button class="eq2-t ${riesgo ? 'mal' : abiertas ? 'duda' : 'bien'}" data-seg="equipo:clausulas"><b>${abiertas}</b><span>${riesgo ? `abiertas, ${riesgo} en riesgo` : 'cláusulas abiertas'} ›</span></button>`,
  ].filter(Boolean).join('');
  const MAX = 4;
  const fila = (a) => `<div class="eq2-at ${a.n}">
      <button class="eq2-at-b" data-j="${esc(a.x.pid)}">${ava(a.x.j, 'm')}<span class="eq2-at-c"><b>${esc(a.x.j.nombre)}</b><span>${esc(a.t)}</span></span></button>
      ${a.cl ? '<button class="eq2-at-x" data-seg="equipo:clausulas">Ver</button>' : a.sust ? `<button class="eq2-at-x" data-accion="sustituto" data-pid="${esc(a.x.pid)}">${icono('buscar')}Sustituto</button>` : ''}
    </div>`;
  const lista = at.length ? `<div class="sec" id="eq-atencion" data-ancla><h2>Pide atención</h2><span class="sub">${at.length === 1 ? '1 cosa' : `${at.length} cosas`}</span></div><div class="eq2-ats">${at.slice(0, MAX).map(fila).join('')}${at.length > MAX ? `<p class="t2 peq">Y ${at.length - MAX} más: los ves en la plantilla, abajo.</p>` : ''}</div>`
    : `<div class="ahora-ok">${icono('ok')}<span><b>Todo en orden.</b> ${sinI ? 'Nadie de baja ni ninguna cláusula en riesgo. Si toca vender a alguien, sale en el plan de Hoy.' : 'Nadie de baja, ninguna cláusula en riesgo ni nadie que vender ya.'}</span></div>`;
  return `<div class="eq2-tiles">${tiles}</div>${lista}`;
}

/** la plantilla, en el orden que elijas: por puesto (con el valor de cada línea), valor, lo que sube hoy o puntos */
const ORDENES_EQ = [['puesto', 'Puesto'], ['titular', 'Titular'], ['valor', 'Valor'], ['sube', 'Sube hoy'], ['puntos', 'Puntos']];
/* (aviso de Domy, 1 nov) quién de los tuyos es titular en su partido: confirmados, probables (75 % o más), con dudas, suplentes
   o poco probables, los que no juegan y los que no tienen datos del once; los entrenadores, aparte */
const GRUPOS_TIT = ['Titular confirmado', 'Probable titular · 75 % o más', 'Con dudas · 45-74 %', 'Suplente o poco probable', 'No juegan: lesión, sanción o sin convocar', 'Sin datos del once', 'Entrenadores'];
function grupoTitular(M, j) {
  if (j.pos === 5) return [6, 0];
  const al = M.alineacion ? M.alineacion(j.id) : null;
  if (al) return [al.estado === 'titular' ? 0 : ['suplente', 'nosale'].includes(al.estado) ? 3 : 4, al.estado === 'titular' ? 1 : 0];
  if (MALOS_EQ.includes(j.estado)) return [4, 0];
  const T = M.titularidad ? M.titularidad(j) : null;
  if (!T || T.p == null) return [5, 0];
  return [T.p >= 0.75 ? 1 : T.p >= 0.45 ? 2 : 3, T.p];
}
function eqPlantillaHTML(S, op) {
  const { M } = S;
  const orden = ORDENES_EQ.some(([k]) => k === S.ordenEq) ? S.ordenEq : 'puesto';
  const fila = (x) => filaJugador(x, {
    sub: `${esc(x.j.equipo)}${x.prox ? ` · ${rivalSub(M, x.j)}` : ''}${orden === 'puntos' ? ` · <b>${num(x.j.puntos)} pts</b>` : ''}`,
    pills: [
      estadoPill(x.j),
      // (24 nov) a un titular el plan no lo vende hasta que baja todos los días (Carlos, 14 nov): sin «vender» en la pastilla
      ((vvP) => (vvP && (vvP.d.matiz === 'con-recambio' || !op(x.pid)) ? `<span class="pill ${vvP.n}" title="${esc(vvP.d.porque)}">${icono(vvP.icono)}${esc(vvP.pill)}</span>` : ''))(ventaVista(M, x, { sinInercia: bloqueada('inercia') })),
      x.riesgo === 'alto' ? `<span class="pill mal">${icono('abierto')}Cláusula en riesgo</span>` : '',
      M.enVenta.has(x.pid) && !/En venta|oferta/.test((ventaVista(M, x, { sinInercia: bloqueada('inercia') }) || {}).pill || '') ? '<span class="pill abierta">En venta</span>' : '',
      M.reventa[x.pid] ? '<span class="pill oro">Para revender</span>' : '',
      calPill(M, x.j, { soloDuro: true }),
    ],
    maxPills: 2, conMini: true, op: op(x.pid),
  });
  let l = `<div class="sec" id="eq-plantilla" data-ancla><h2>Plantilla</h2><span class="sub">${M.premium && M.premium.entrenador && M.mias.some((x) => x.j.pos === 5) ? `${M.mias.filter((x) => x.j.pos !== 5).length} jugadores y ${M.mias.filter((x) => x.j.pos === 5).length} entr.` : `${M.mias.length} jugadores`}</span></div>
    <div class="eq2-orden" role="group" aria-label="Ordenar la plantilla">${ORDENES_EQ.map(([k, t]) => `<button data-accion="ordenEq" data-o="${k}" class="${k === orden ? 'activo' : ''}" aria-pressed="${k === orden}">${t}</button>`).join('')}</div><div class="eq-filas">`;
  if (orden === 'puesto') {
    for (const p of [1, 2, 3, 4, 5]) {
      const xs = M.mias.filter((x) => x.j.pos === p).sort((a, b) => b.j.valor - a.j.valor);
      if (!xs.length) continue;
      l += `<div class="grupo" id="eq-pos-${p}" data-ancla><span>${POS_PLURAL[p]} · ${xs.length}${p === 5 && !(M.premium && M.premium.entrenador) ? ' · no puntúan en la versión gratis' : ''}</span><span>${eur(xs.reduce((s, x) => s + x.j.valor, 0))}</span></div>`;
      l += xs.map(fila).join('');
    }
  } else if (orden === 'titular') {
    const gs = GRUPOS_TIT.map(() => []);
    for (const x of M.mias) { const [g, p] = grupoTitular(M, x.j); gs[g].push({ x, p }); }
    l += `<p class="t2 peq">Si cada uno sale de titular en su próximo partido: con la alineación confirmada (sale unas 2 h antes) y, hasta entonces, con el once probable.</p>`;
    gs.forEach((xs, g) => { if (xs.length) l += `<div class="grupo"><span>${GRUPOS_TIT[g]} · ${xs.length}</span><span></span></div>${xs.sort((a, b) => b.p - a.p || b.x.j.valor - a.x.j.valor).map((o) => fila(o.x)).join('')}`; });
  } else if (orden === 'sube') {
    // los que suben hoy (de más a menos), los que siguen igual y los que bajan (de los que más bajan a los que menos)
    const d1 = (x) => (x.tend && x.tend.d1 != null ? num(x.tend.d1) : 0);
    const grupos = [['Suben hoy', M.mias.filter((x) => d1(x) > 0).sort((a, b) => d1(b) - d1(a))], ['Bajan hoy', M.mias.filter((x) => d1(x) < 0).sort((a, b) => d1(a) - d1(b))], ['Sin cambio', M.mias.filter((x) => !d1(x))]];
    for (const [t, xs] of grupos) if (xs.length) l += `<div class="grupo"><span>${t} · ${xs.length}</span><span class="${t === 'Suben hoy' ? 'sube' : t === 'Bajan hoy' ? 'baja' : ''}">${t === 'Sin cambio' ? '' : eur(xs.reduce((s, x) => s + d1(x), 0), { signo: true })}</span></div>${xs.map(fila).join('')}`;
  } else {
    const val = { valor: (x) => x.j.valor, puntos: (x) => num(x.j.puntos) }[orden];
    l += [...M.mias].sort((a, b) => val(b) - val(a)).map(fila).join('');
  }
  // (26 nov, Carlos: «en el PC hay mucho espacio a la derecha») en una columna ancha, las filas van a dos columnas (CSS: .eq-pl)
  return `<div class="eq-pl">${l}</div></div>`;
}

/** Cláusulas: el resumen en casillas, cómo funcionan (plegado) y cada uno con una barra de cuánto está su cláusula por
    encima de su valor: a partir de un 30 % no hay riesgo (la raya) */
function eqClausulasHTML(S, op) {
  const { M } = S;
  const xs = [...M.mias].sort((a, b) => (a.abierta === b.abierta ? a.abreEn - b.abreEn : a.abierta ? -1 : 1));
  const ab = xs.filter((x) => x.abierta), pronto = xs.filter((x) => !x.abierta && x.abreEn < 2 * DIA), prot = xs.filter((x) => !x.abierta && x.abreEn >= 2 * DIA);
  const riesgo = xs.filter((x) => x.riesgo === 'alto').length;
  const ES = M.escudosMios;
  let h = `<div class="eq2-tiles">
    ${[[ab, riesgo ? `abiertas, ${riesgo} en riesgo` : 'abiertas ya', riesgo ? 'mal' : ab.length ? 'duda' : 'bien'], [pronto, 'se abren en 48 h', pronto.length ? 'duda' : ''], [prot, 'protegidas', 'bien']].map(([l, t, c], i) => (l.length ? `<button class="eq2-t ${c}" data-accion="ver" data-sel="#cl-g${i}"><b>${l.length}</b><span>${t} ›</span></button>` : `<div class="eq2-t ${c}"><b>0</b><span>${t}</span></div>`)).join('')}
    ${ES ? `<div class="eq2-t"><b>${ES.quedan}<small> de 2</small></b><span>blindajes que te quedan esta jornada</span></div>` : ''}
  </div>
  <details class="eq2-como"><summary>${icono('info')}Cómo funcionan</summary><p>Si te clausulan a uno, cobras su cláusula, pero lo pierdes: sus puntos, lo que iba a subir y, si la cláusula está en su valor, te lo quitan sin pagar nada de más (venderlo a LaLiga te daría más, y reponerlo te costaría más). Con la cláusula un 30 % o más por encima de su valor (o por encima de lo que se paga en los clausulazos de tu liga) no hay riesgo, y menos si está bajando.${ES ? ` En LaLiga puedes blindar a uno viendo un anuncio: ${ES.horas} h protegido, 2 por jornada.` : ''} La barra de cada uno dice cuánto está su cláusula por encima de su valor; la raya es el 30 %.</p></details>`;
  const barraCl = (x) => {
    if (!x.ratio) return '';
    const sobre = (x.ratio - 1) * 100;
    const w = Math.max(3, Math.min(100, (sobre / 60) * 100));
    return `<span class="cl-m ${x.riesgo === 'alto' ? 'mal' : x.riesgo === 'medio' ? 'duda' : 'bien'}" title="Cláusula ${pct(sobre, 0)} sobre su valor"><i style="width:${w.toFixed(0)}%"></i></span>`;
  };
  const filaCl = (x) => filaJugador(x, {
    sub: `${x.abierta ? '<span class="rojo">Abierta</span>' : `Se abre ${cuando(x.protegidoHasta)}`} · cláusula ${eur(x.clausula)}${x.ratio ? ` (${pct((x.ratio - 1) * 100, 0)})` : ''}`,
    extra: `${barraCl(x)}${planPill(op(x.pid))}${x.escudo ? `<span class="pill pronto">${icono('escudo')}Blindado · ${cuando(x.escudo).replace(/^hoy /, '')}</span>` : (M.paraEscudo || []).includes(x.pid) ? `<span class="pill plan">${icono('escudo')}Blíndalo gratis</span>` : ''}<span class="pill ${x.riesgo === 'alto' ? 'mal' : x.riesgo === 'medio' ? 'duda' : ''}">${x.riesgo === 'ninguno' ? 'Sin riesgo' : `Riesgo ${x.riesgo}`}</span>${x.pagan && !bloqueada('quienPaga') && (x.abierta || x.abreEn < 3 * DIA) && (x.pagan.seguro.length || x.pagan.quiza.length) ? `<span class="pill ${x.pagan.seguro.length ? 'mal' : 'duda'}">${icono('rivales')}Le llega a ${x.pagan.seguro.length + x.pagan.quiza.length}</span>` : x.pagan && !bloqueada('quienPaga') && x.pagan.hayDatos && x.abierta ? '<span class="pill bien">No le llega a nadie</span>' : ''}${x.blindaje && !x.blindaje.yaVale && !x.blindaje.caro ? `<span class="pill">Subirla a ${eur(x.blindaje.objetivo, { dec: 1 })}: ${eur(x.blindaje.coste, { dec: 1 })}</span>` : ''}`,
    derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d apag">${x.abierta ? 'valor' : cuenta(x.protegidoHasta)}</div>`,
  });
  let gl = '';
  [['Abiertas ya', ab], ['Se abren en menos de 48 h', pronto], ['Protegidas', prot]].forEach(([t, l], i) => { if (l.length) gl += `<div class="grupo" id="cl-g${i}" data-ancla><span>${t}</span><span>${l.length}</span></div>${l.map(filaCl).join('')}`; });
  return h + lista2(gl);
}

/** Beneficio: lo ganado sobre lo pagado, el mejor y el peor fichaje, el valor del equipo y jugador a jugador */
function eqBeneficioHTML(S, op) {
  const { M, H } = S;
  const con = M.mias.filter((x) => x.compra).sort((a, b) => b.ganado - a.ganado);
  const serie = (H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
  const mejor = con[0], peor = con.length > 1 ? con[con.length - 1] : null;
  const resumen = `<div class="eq2-tiles">
      <button class="eq2-t ${M.conCompra ? (M.ganadoTotal >= 0 ? 'bien' : 'mal') : ''}" data-accion="ver" data-sel="#eq-jaj"><b class="${clase(M.ganadoTotal)}">${M.conCompra ? eur(M.ganadoTotal, { signo: true }) : '–'}</b><span>ganado sobre lo pagado (${con.length} de ${M.mias.length}) ›</span></button>
      ${mejor ? `<button class="eq2-t" data-j="${esc(mejor.pid)}"><b class="${clase(mejor.ganado)}">${eur(mejor.ganado, { signo: true })}</b><span>el mejor: ${esc(mejor.j.nombre)}</span></button>` : ''}
      ${peor && peor.ganado < 0 ? `<button class="eq2-t" data-j="${esc(peor.pid)}"><b class="${clase(peor.ganado)}">${eur(peor.ganado, { signo: true })}</b><span>el peor: ${esc(peor.j.nombre)}</span></button>` : ''}
    </div>
    <div class="sec" id="eq-valor" data-ancla><h2>Valor del equipo</h2></div>${linea(serie, { alto: ancho() ? 220 : 150 })}`;
  const lista = `<div class="sec" id="eq-jaj" data-ancla><h2>Jugador a jugador</h2></div>${con.length ? con.map((x) => filaJugador(x, {
    sub: `Pagaste ${eur(x.compra)} · vale ${eur(x.j.valor)}${(() => { const ol = M.ofertaLigaDe ? M.ofertaLigaDe(x.j) : null; return ol ? ` · LaLiga te daría ~${eur(ol.v)}` : ''; })()}`,
    derecha: `<div class="v ${clase(x.ganado)}">${eur(x.ganado, { signo: true })}</div><div class="d ${clase(x.ganado)}">${pct((x.j.valor / x.compra - 1) * 100)}</div>`, op: op(x.pid),
  })).join('') : nada('Aún no se sabe lo que pagaste por tus jugadores: sale de los movimientos de la liga, que guardan unas semanas.')}`;
  return ancho() ? cols(resumen, lista, 'mitades') : resumen + lista;
}

export function equipo(S) {
  const { M } = S;
  const seg = S.seg.equipo || 'plantilla';
  const op = (pid) => S.opPorPid[pid];
  let h = eqCabHTML(S);
  const abiertasE = M.mias.filter((x) => x.abierta && x.clausula).length, riesgoE = M.mias.filter((x) => x.riesgo === 'alto').length;
  h += tabs('equipo', seg, [['plantilla', 'Plantilla', M.mias.length], ['jornadas', 'Jornadas'], ['venta', 'En venta', M.misVentas.length], ['clausulas', 'Cláusulas', abiertasE, riesgoE ? 'rojo' : ''], ['dinero', 'Beneficio']], { llenas: true });
  if (!M.mias.length) return h + nada(S.D && S.D.ligas && S.D.ligas.length > 1 ? 'No encuentro tu equipo en esta liga con tu cuenta de LaLiga. Toca el nombre de la liga, arriba, para cambiar a otra de tus ligas.' : 'No encuentro tu equipo en esta liga con tu cuenta de LaLiga. Si acabas de entrar en ella, prueba a actualizar en un rato.');

  if (seg === 'plantilla') {
    const once = `<div id="eq-once" data-ancla>${onceHTML(S, null, { conBanquillo: true, directo: true })}</div>`;
    // en el ordenador, el estado y el once a la izquierda y la plantilla al lado
    // (26 nov, Carlos: «el campo más ancho, como en la pestaña del plan») como en Hoy: lo del once a lo ancho y la plantilla en la columna estrecha de la derecha
    h += ancho() ? cols(eqEstadoHTML(S) + once, eqPlantillaHTML(S, op)) : eqEstadoHTML(S) + once + eqPlantillaHTML(S, op);
  } else if (seg === 'jornadas') {
    h += jornadasHTML(S);
  } else if (seg === 'venta') {
    h += M.misVentas.length ? lista2(M.misVentas.map(ventaHTML).join('')) : nada('No tienes a nadie en venta. Cuando pongas a alguien en el mercado, aquí verás sus ofertas (la de LaLiga y las de otros managers) y si te conviene aceptar.');
  } else if (seg === 'clausulas') {
    h += eqClausulasHTML(S, op);
  } else {
    h += eqBeneficioHTML(S, op);
  }
  return h;
}

/* ================= RIVALES ================= */
/** una cláusula de un rival que te llega: con tu dinero, abierta o que se abre en menos de 48 h */
const teLlega = (x) => x.meLlega && (x.abierta || x.abreEn < 2 * DIA);
/** el parte de los rivales con las llaves de ahora: { jornada, toca, desde, abierto, rivales: los que tienen algo que se pueda
    enseñar, ya ordenados }. Lo ÚNICO que se pinta sale de `visibles`. Si algo falla dentro, Rivales no se cae: sale vacío */
export function parteVisto(S) {
  try {
    const P = parte(S.M, S.D);
    const abierto = !bloqueada('parteRivales');
    const rivales = visibles(P, { abierto, dineroAbierto: (tid) => !bloqueada('dineroRivales', tid) });
    // (27 nov) lo nuevo desde la última vez que miraste el parte: se compara con lo guardado al salir de él
    let nuevo = [], visto = null;
    if (abierto && P.toca) { visto = LS.get(K('parte-visto'), null); nuevo = novedades(visto, rivales, P.jornada); parteFirma = firmaParte(P.jornada, rivales); }
    return { jornada: P.jornada, ini: P.ini, toca: P.toca, desde: P.desde, abierto, rivales, nuevo, vistoT: visto && visto.t };
  } catch (e) { return { jornada: null, toca: false, abierto: false, rivales: [] }; }
}
/* (27 nov) lo que se ve del parte se guarda al dejar de mirarlo (otra pestaña de Rivales u otra vista, o la app a segundo
   plano): la próxima vez, lo que haya cambiado sale marcado como nuevo */
let parteFirma = null;
export function guardarParteVisto() { if (parteFirma) { LS.set(K('parte-visto'), parteFirma); parteFirma = null; } }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) guardarParteVisto(); });
const PARTE_IC = { rojo: ['euro', ''], falta: ['info', 'oro'], sobra: ['info', 'oro'], blindajes: ['escudo', 'azul'] };
const PARTE_POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
/** el resumen de arriba: cuántos rivales hay de cada cosa, contando SOLO lo que se ve */
const PARTE_RES = [['rojo', 'en negativo', 'en negativo', ''], ['falta', 'corto de un puesto', 'cortos de un puesto', 'oro'], ['blindajes', 'sin blindajes', 'sin blindajes', 'azul']];
/** la gráfica de «le falta» (Carlos, 26 nov, 18:33: fuera los cuadrados por puesto; «algo que denote calidad»): SU CAMPO en
    pequeño, de portería a portería. En cada línea, un punto por cada uno que tiene y puede jugar (hasta lo que cabe en un
    once: 1, 5, 5 y 3) y, donde le falta, un aro que late. `ps`: [{ p, n, falta }] de parte.js */
const PARTE_CABE = { 1: 1, 2: 5, 3: 5, 4: 3 }, PARTE_X = { 1: 30, 2: 106, 3: 190, 4: 274 };
function parteCampo(ps) {
  const fig = ps.map((x) => {
    const hay = Math.min(num(x.n), PARTE_CABE[x.p]), aros = Math.min(num(x.falta), PARTE_CABE[x.p]), n = Math.min(hay + aros, 5);
    const paso = n > 4 ? 14.5 : 17, cx = PARTE_X[x.p], antes = Math.floor((n - aros) / 2);
    let g = '';
    for (let k = 0; k < n; k++) {
      const cy = Math.round((45 + (k - (n - 1) / 2) * paso) * 10) / 10, aro = k >= antes && k < antes + aros;
      g += aro ? `<circle class="pc-a" cx="${cx}" cy="${cy}" r="6.2"/>` : `<circle class="pc-d" cx="${cx}" cy="${cy}" r="4.6"/>`;
    }
    return `${g}<text class="pc-t${x.falta ? ' mal' : ''}" x="${cx}" y="103" text-anchor="middle">${PARTE_POS[x.p]}</text>`;
  }).join('');
  const txt = ps.map((x) => `${PARTE_POS[x.p]} ${x.n}${x.falta ? ` (falta${x.falta > 1 ? 'n' : ''} ${x.falta})` : ''}`).join(', ');
  return `<svg class="parte-campo" viewBox="0 0 304 108" role="img" aria-label="${esc(txt)}"><rect class="pc-c" x="1" y="1" width="302" height="88" rx="10"/><path class="pc-l" d="M152 1v88M1 23h30v44H1M303 23h-30v44h30"/><circle class="pc-l" cx="152" cy="45" r="15"/>${fig}</svg>`;
}
/** (27 nov) la ficha de un rival: su estado en una línea de pastillas (en negativo o su saldo, sus blindajes, su plantilla y
    dónde va corto) y, debajo, como mucho tres hechos cortos (lo suyo que te llega por cláusula, lo que vende y sus bajas) */
function parteFicha(f) {
  if (!f) return '';
  const pills = f.estado.map((e) => {
    if (e.k === 'escudos') return `<span class="pill parte-esc2${e.quedan === 0 ? ' cero' : ''}" title="${esc(e.txt)}">${[0, 1].map((i) => `<i class="${i < e.quedan ? 'si' : ''}">${icono('escudo')}</i>`).join('')}<b>${e.quedan}</b>/2</span>`;
    const cl = e.k === 'rojo' ? 'abierta' : e.tono === 'oro' ? 'pronto' : e.tono === 'rojo' ? 'abierta' : '';
    const ic = e.k === 'rojo' || e.k === 'saldo' ? 'euro' : e.k === 'plantilla' ? 'usuario' : e.k === 'corto' ? 'alerta' : '';
    return `<span class="pill ${cl}">${ic ? icono(ic) : ''}${esc(e.txt)}</span>`;
  }).join('');
  const hs = f.hechos.map((x) => { const c = `${icono(x.ic)}<span>${esc(x.txt)}</span>`; return x.pid ? `<button class="parte-h" data-j="${esc(x.pid)}">${c}</button>` : `<div class="parte-h">${c}</div>`; }).join('');
  return `<div class="parte-est">${pills}</div>${hs}`;
}
/** Rivales → Parte (26 nov, función top «parteRivales»): de cada rival, solo lo que te cambia los planes, con su acción.
    CORTO (Carlos, 26 nov, 18:10: «menos texto y más sintetizado y entendible»): arriba, cuándo empieza la jornada y cuántos
    rivales hay de cada cosa; de cada línea, el hecho en negrita con su cifra, UNA frase con lo que puedes hacer y, en «le
    falta», su campo en pequeño (`parteCampo`); los blindajes gastados, dos escudos apagados. Sale desde 4 días antes de la jornada (antes dice cuándo, sin candado: no hay nada
    que abrir). QUIÉN está en negativo sale con el parte abierto (Carlos, 26 nov, 18:34: «solo eso, no por cuánto»); la cifra,
    solo con el dinero de ese rival abierto, y entonces el candado del final lo dice */
function parteHTML(S, PV) {
  const { M } = S;
  if (!PV.jornada) return nada('El parte sale cuando hay una jornada por delante.');
  if (!PV.toca) return nada(`El parte de la jornada ${PV.jornada} sale ${PV.desde && PV.desde > Date.now() ? `${elDia(PV.desde)}, 4 días antes de que empiece` : 'cuando acabe la que se está jugando'}.`);
  let h = `<p class="t2 peq">Jornada ${PV.jornada}${PV.ini ? ` · empieza ${cuando(PV.ini)}` : ''}</p>`;
  if (!PV.abierto) return h + candado('parteRivales');
  if (PV.rivales.length) {
    const res = PARTE_RES.map(([t, uno, varios, col]) => { const n = PV.rivales.filter((x) => x.lineas.some((l) => l.tipo === t)).length; return n ? `<span class="pill parte-c ${col}"><b>${n}</b> ${n === 1 ? uno : varios}</span>` : ''; }).join('');
    h += `<div class="parte-res">${res}</div>`;
    if (PV.nuevo && PV.nuevo.length) {
      const nom = (tid) => { const x = PV.rivales.find((r) => r.tid === tid); return x ? x.e.manager || x.e.nombre || x.nombre : 'Un rival'; };
      h += `<div class="parte-nuevo"><span class="pill parte-nv">Nuevo</span><span>${PV.nuevo.slice(0, 4).map((n) => `<b>${esc(nom(n.tid))}</b> ${esc(n.txt)}`).join(' · ')}${PV.nuevo.length > 4 ? ` · y ${PV.nuevo.length - 4} más` : ''}</span></div>`;
    }
    h += PV.rivales.map((x) => `<div class="parte-r"><button class="fila" data-r="${esc(x.tid)}">${caraManager(x.e)}<div class="fila-c"><div class="fila-n">${esc(x.e.nombre || x.nombre)}</div>${x.e.manager && x.e.manager !== x.e.nombre ? `<div class="fila-s">${esc(x.e.manager)}</div>` : ''}</div>${(PV.nuevo || []).some((n) => n.tid === x.tid) ? '<span class="pill parte-nv">Nuevo</span>' : ''}<span class="posn">${esc(x.e.pos || '')}º</span></button>
    ${parteFicha(x.ficha)}
    ${x.lineas.map((l) => { const [ic, col] = PARTE_IC[l.tipo] || ['info', 'oro'], pid = l.pid || (l.pids || [])[0];
      const cuerpo = `${icono(ic)}<div><span class="parte-t"><b>${esc(l.txt)}</b>${l.tipo === 'blindajes' ? `<span class="parte-esc" title="${esc(l.dato || '')}">${icono('escudo')}${icono('escudo')}</span>` : l.dato ? `<span class="parte-d">${esc(l.dato)}</span>` : ''}</span>${l.puestos ? parteCampo(l.puestos) : ''}<span class="parte-a">${esc(l.accion)}</span>${l.nota ? `<span class="parte-n">${esc(l.nota)}</span>` : ''}</div>`;
      return pid ? `<button class="aviso-ficha av peq parte-l ${col}" data-j="${esc(pid)}">${cuerpo}</button>` : `<div class="aviso-ficha av peq parte-l ${col}">${cuerpo}</div>`; }).join('')}</div>`).join('');
  } else h += nada('Aún no hay datos de tus rivales para esta jornada.');
  // quién está en negativo ya se ve; por cuánto, solo con su dinero abierto: el candado sale si a alguno de los que salen le falta la cifra
  if (PV.rivales.some((x) => x.lineas.some((l) => l.sinCifra))) h += `<div class="parte-pie">${candadoMini('dineroRivales', 'Su dinero')}<span>Con su dinero abierto, sale también por cuánto.</span></div>`;
  return h;
}

export function rivales(S) {
  const { M } = S;
  const seg = S.seg.rivales || 'clasif';
  // (0.8.5; Carlos, 26 nov, 23:13: «que salga a la derecha de Rivales, en dorado… el parte como función top», y no entre las
  // pestañas) el parte va en un botón dorado al lado del título; su número, solo con la llave abierta
  if (seg !== 'parte') guardarParteVisto();
  const PV = parteVisto(S);
  // (27 nov) el número del botón: los que tienen algo que hacer, no todos (ahora todos salen con su ficha)
  const nParte = PV.abierto ? PV.rivales.filter((x) => x.lineas.length).length : 0;
  let h = `<div class="eti">${esc(S.D.liga.nombre)}</div><h1 class="titulo riv-tit">Rivales<button type="button" class="parte-top${seg === 'parte' ? ' activo' : ''}" data-seg="rivales:parte" aria-pressed="${seg === 'parte'}">${icono(PV.abierto ? 'corona' : 'candado')}<span>Parte</span><small>Top</small>${nParte ? `<span class="tab-n oro">${nParte}</span>` : ''}</button></h1>`;
  // el número de «Cláusulas» es lo que sale al abrirla (el filtro «Te llegan»: abiertas o que se abren en 48 h)
  const llegan = M.clausulas.filter(teLlega).length;
  // (24 nov, Carlos: «la clasificación por jornadas debería ir en Rivales, delante de Cláusulas») antes estaba en Directo
  h += tabs('rivales', seg, [['clasif', 'Clasificación'], ['jornadas', 'Por jornada'], ['clausulas', 'Cláusulas', llegan, llegan ? 'verde' : '']]);

  if (seg === 'jornadas') h += porJornadaHTML(S);
  else if (seg === 'parte') h += parteHTML(S, PV);
  else if (seg !== 'clausulas') {
    const tabla = S.D.clasif.map((e) => {
      const r = M.rivales.find((x) => x.e.teamId === e.teamId);
      const yo = !r;
      return `<button class="fila ${yo ? 'yo-fila' : ''}" ${yo ? 'data-ir="equipo"' : `data-r="${esc(e.teamId)}"`}>
        <span class="posn ${yo ? 'yo' : ''}">${e.pos}</span>${caraManager(e)}
        <div class="fila-c"><div class="fila-n">${esc(e.nombre)}</div>
          <div class="fila-s">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${eur(e.valor)}${r && r.dValor != null ? ` · <span class="${clase(r.dValor)}">${eur(r.dValor, { signo: true, dec: 1 })} en&nbsp;7&nbsp;días</span>` : ''}${r && M.yo ? ` · ${e.puntos > M.yo.puntos ? `te saca ${e.puntos - M.yo.puntos}` : e.puntos < M.yo.puntos ? `le sacas ${M.yo.puntos - e.puntos}` : 'empatados'}` : ''}</div>
          ${r ? `<div class="fila-x">${bloqueada('dineroRivales', r.e.teamId) ? (r.dinero && r.dinero.exacto ? '' : pillRival(r.e.teamId)) : r.dinero && r.dinero.v != null ? `<span class="pill ${r.dinero.exacto ? '' : 'estim'}" title="${r.dinero.exacto ? 'Saldo exacto' : 'Saldo estimado'}">${icono('euro')}${dineroCorto(r.dinero)}</span>` : ''}<span class="amenaza ${r.nivel}" title="${esc(PELIGRO_TXT)}">Peligro ${PELIGRO[r.nivel]}</span>${quitaYa(r) && !bloqueada('quienPaga', r.e.teamId) ? `<span class="pill mal">Te puede quitar ${quitaYa(r)}</span>` : r.meLlegan ? `<span class="pill abierta">${r.meLlegan} a tiro</span>` : ''}</div>` : ''}
        </div>
        <div class="fila-d"><div class="v">${e.puntos}</div>${M.vivo && M.vivo.equipos && M.vivo.equipos[String(e.teamId)] != null ? `<div class="d vivo-d"><span class="vivo-dot"></span>${M.vivo.equipos[String(e.teamId)]} J${M.vivo.n}</div>` : `<div class="d apag">${ptsJornadaTxt(M, e) || 'pts'}</div>`}</div></button>`;
    }).join('');
    // el dinero de cada uno cerrado: un solo candado arriba (antes, uno en cada fila)
    const candDinero = M.rivales.some((r) => r.dinero && r.dinero.v != null && bloqueada('dineroRivales', r.e.teamId)) ? `<div class="cand-cab">${candadoMini('dineroRivales', 'Dinero de cada rival')}</div>` : '';
    // (0.8.4o) con el dinero de alguno cerrado, en su fila «Apuntar» (o «Te dijo 48 M»): un aviso arriba hasta que se quita
    const avisoD = !avisoRivalesVisto() && M.rivales.some((r) => !(r.dinero && r.dinero.exacto)) ? avisoRivalesHTML() : '';
    // en el ordenador, al lado de la clasificación: lo que te llega de ellos y lo último que han hecho
    h += ancho() ? cols(avisoD + candDinero + tabla, aTiroHTML(S) + movimientosHTML(S, 10)) : avisoD + candDinero + tabla;
  } else {
    const f = S.filtro.cl || 'llegan';
    h += `<div class="filtros">${[['llegan', 'Te llegan'], ['pronto', 'Se abren pronto'], ['todas', 'Todas']].map(([k, t]) => `<button data-filtro="cl:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.clausulas;
    if (f === 'llegan' || f === 'abiertas') xs = xs.filter(teLlega);
    if (f === 'pronto' || f === 'hoy' || f === 'semana') xs = xs.filter((x) => !x.abierta && x.abreEn < 7 * DIA).sort((a, b) => a.abreEn - b.abreEn);
    void HORA;
    h += `<p class="t2 peq">Para clausular tienes <b>${eur(S.D.dinero)}</b>: las cláusulas se pagan con saldo, sin deuda. La barra es lo que te interesa: rendimiento, si sube y lo que cuesta sobre su valor.</p>`;
    h += xs.length ? lista2(xs.slice(0, 80).map((x) => filaJugador(x, {
      sub: `de ${esc(x.rival.manager || x.rival.nombre)} · vale ${eur(x.j.valor)}`,
      pills: [clausulaPill(x), estadoPill(x.j), calPill(M, x.j, { soloDuro: true }), x.meLlega ? '' : '<span class="pill">No te llega</span>'],
      derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${barra(x.interes)} <span class="t2">${x.interes}</span></div>`, op: S.opPorPid[x.pid],
    })).join('')) : nada('Ninguna con este filtro.');
  }
  return h;
}

/** Mercado → Movimientos (antes en Rivales; Carlos, 10 nov): lo que se ha movido en la liga, con la cara de cada
    jugador. Arriba, de quién (toda la liga o solo lo tuyo: lo que has hecho tú y lo que te han hecho a ti) y, debajo,
    de qué tipo. Por días: hoy, ayer y la fecha */
export function movimientosLiga(S) {
  const { M } = S;
  const quien = S.filtro.movq || 'liga', f = S.filtro.mov || 'todos';
  const mio = (a) => a.esYo || a.contraMi;
  let xs = M.actividad.filter((a) => a.clase !== 'premio');
  if (quien === 'yo') xs = xs.filter(mio);
  const n = (k) => (k === 'todos' ? xs : xs.filter((a) => a.clase === k)).length;
  let h = `<div class="filtros mov-quien" role="group" aria-label="De quién">${[['liga', 'Toda la liga'], ['yo', 'Los tuyos']].map(([k, t]) => `<button data-filtro="movq:${k}" class="${quien === k ? 'activo' : ''}" aria-pressed="${quien === k}">${t}</button>`).join('')}</div>`;
  h += `<div class="filtros">${[['todos', 'Todo'], ['clausula', 'Cláusulas'], ['compra', 'Fichajes'], ['venta', 'Ventas'], ['blindaje', 'Blindajes']].map(([k, t]) => { const c = n(k); return `<button data-filtro="mov:${k}" class="${f === k ? 'activo' : ''}">${t}${c && k !== 'todos' ? ` <small>${c}</small>` : ''}</button>`; }).join('')}</div>`;
  if (f !== 'todos') xs = xs.filter((a) => a.clase === f);
  // las subidas de cláusula que se ven al comparar plantillas (LaLiga no las da en la actividad)
  let cambios = f === 'todos' || f === 'blindaje' ? M.cambios.filter((m) => m.tipo === 'blinda') : [];
  if (quien === 'yo') cambios = cambios.filter((m) => m.equipo && M.yo && m.equipo.teamId === M.yo.teamId);
  // las subidas vistas en las plantillas van en su día, entre lo demás
  const items = [
    ...xs.slice(0, 150).map((a) => ({ t: a.t || 0, html: filaActividad(a) })),
    ...cambios.slice(0, 8).map((m) => ({ t: m.t || 0, html: `<button class="fila act-f" data-j="${esc(m.pid)}"><span class="act-cara">${ava(m.j, 'm')}<span class="ic-act mini blindaje">${icono('escudo')}</span></span><div class="fila-c"><div class="act-t"><span class="quien">${esc((m.equipo || {}).manager || (m.equipo || {}).nombre || 'Un rival')}</span> subió la cláusula de <b>${esc(m.j.nombre)}</b></div><div class="fila-s">${cuando(m.t)} · de ${eur(m.de)} a ${eur(m.a)} · visto en su plantilla</div></div></button>` })),
  ].sort((x, y) => y.t - x.t);
  if (!items.length) return h + nada(quien === 'yo' ? 'No has hecho ningún movimiento de este tipo en los últimos días.' : 'Sin movimientos con este filtro.');
  // por días: «Hoy», «Ayer» y la fecha
  const hoy = diaDe(), ayer = otroDiaV(hoy, -1);
  let ml = '', dia = null;
  for (const it of items) {
    const d = it.t ? diaDe(it.t) : '';
    if (d !== dia) { dia = d; ml += `<div class="grupo"><span>${!d ? 'Sin fecha' : d === hoy ? 'Hoy' : d === ayer ? 'Ayer' : esc(cuando(it.t, { hora: false }))}</span></div>`; }
    ml += it.html;
  }
  return h + lista2(ml);
}

/* ================= MERCADO ================= */
/** el buscador del Mercado: cualquier jugador de LaLiga por su nombre o su equipo, con su dueño y su cláusula */
export function buscaHTML(S) {
  const q = norm(S.busca || '');
  if (q.length < 2) return '';
  const { M, D } = S;
  const todos = Object.values(D.maestro || {}).filter((j) => j && j.pos && (norm(j.nombre).includes(q) || norm(j.largo || '').includes(q) || norm(j.equipo || '').includes(q)));
  // primero los que empiezan por lo que buscas; luego, los que más valen
  const empieza = (j) => (norm(j.nombre).startsWith(q) || norm(j.largo || '').split(' ').some((w) => w.startsWith(q)) ? 0 : 1);
  const xs = todos.sort((a, b) => empieza(a) - empieza(b) || b.valor - a.valor).slice(0, 25);
  if (!xs.length) return nada(`Ningún jugador con «${esc(S.busca)}».`);
  const dueno = (pid) => { const t = M.dueno[pid]; if (!t) return 'libre'; if (String(t) === String(S.D.yo.teamId)) return '<span class="rojo">tuyo</span>'; return `de ${esc((M.equipo[t] || {}).manager || (M.equipo[t] || {}).nombre || 'un rival')}`; };
  return `<div class="grupo"><span>Resultados</span><span>${todos.length > 25 ? `25 de ${todos.length}` : todos.length}</span></div>${xs.map((j) => {
    // (lo que vende otro manager es una función top: con ella cerrada, el buscador no lo dice)
    const enM = M.mercado.find((m) => m.pid === j.id && !(m.tipo === 'manager' && bloqueada('ventasRivales')));
    const cl = M.clausulas.find((x) => x.pid === j.id);
    return filaJugador({ j, tend: M.tend(j.id) }, {
      sub: `${esc(j.equipo || '')} · ${dueno(j.id)}`,
      pills: [enM ? `<span class="pill abierta">En el mercado · ${eur(enM.precio)}</span>` : '', cl ? clausulaPill(cl) : '', estadoPill(j)],
    });
  }).join('')}`;
}

/**
 * el paso de pujar o comprar que el plan de hoy descarta para ese jugador (si no hay otro paso suyo que sí vaya): para que
 * Mercado y su ficha no lo vendan como chollo sin decir que el plan no lo hace (3 nov). `tope`: hasta cuánto te llega
 */
export function descartePlan(S, pid) {
  if (!S.plan || !pid || (S.opPorPid || {})[pid]) return null;
  const o = (S.plan.ops || []).find((x) => x.descartada && String(x.pid) === String(pid) && ['pujar', 'comprar'].includes(x.accion));
  if (o) return o;
  // (24 nov, decide.js) y lo que el plan ha mirado y no ficha («Mirados y descartados»): antes Mercado lo seguía llamando
  // «Chollo» y los avisos decían «la app pujaría…» con el plan diciendo que se paga de más
  const df = S.M && S.M.decisionFichar ? S.M.decisionFichar(pid) : null;
  return df && df.accion === 'no' ? { accion: 'pujar', aviso: df.porque, tope: df.tope != null ? df.tope : null, descartada: true, yaPujada: df.yaPujada || null } : null;
}
/** la etiqueta de Mercado de uno que se vende: la del motor (chollo, sube…) o, si el plan lo descarta, eso (para las pruebas) */
export const etiquetaFichar = (S, pid) => { const m = (S.M.mercado || []).find((y) => String(y.pid) === String(pid)); return !m || m.miPuja ? '' : descartePlan(S, pid) ? 'El plan lo descarta' : String(m.veredicto || ''); };

export function mercado(S) {
  const { M } = S;
  let seg = S.seg.mercado || 'venta';
  // las antiguas Suben / Bajan / Libres son ahora filtros de Tendencias
  if (['suben', 'bajan', 'libres'].includes(seg)) { S.filtro.tend = seg; seg = S.seg.mercado = 'tendencias'; }
  let h = `<div class="eti">${M.cierreMercado ? `Cambia ${cuando(M.cierreMercado)} · en ${cuenta(M.cierreMercado)}` : 'Mercado de hoy'}</div><h1 class="titulo">Mercado</h1><p class="entradilla">Puedes gastar hasta <b>${eur(M.pujaMax)}</b>${num(M.misPujas) ? ` (ya descontados los ${eur(M.misPujas)} que tienes pujados)` : ''}.</p>`;
  h += `<div class="busca-j">${icono('buscar')}<input id="buscaJ" type="search" enterkeyhint="search" placeholder="Busca cualquier jugador o equipo" autocomplete="off" aria-label="Buscar jugador" value="${esc(S.busca || '')}"></div><div id="buscaRes">${buscaHTML(S)}</div>`;
  h += tabs('mercado', seg, [['venta', 'Fichar', M.mercado.filter((m) => !M.enVenta.has(m.pid)).length], ['especular', 'Especular', (M.especular || []).length, (M.especular || []).length ? 'verde' : ''], ['tendencias', 'Tendencias'], ['favoritos', `${icono('estrella')}Favoritos`, favoritos().filter((pid) => M.J(pid)).length], ['movimientos', 'Movimientos', M.actividad.filter((a) => a.clase !== 'premio' && a.t && Date.now() - a.t < DIA).length]]);
  const tagV = { chollo: '<span class="pill chollo">Chollo</span>', sube: '<span class="pill bien">Subiendo</span>', caro: '<span class="pill duda">Caro</span>', evitar: '<span class="pill mal">Evitar</span>', baja: '<span class="pill mal">Bajando</span>', frena: '<span class="pill duda">Frenando</span>', normal: '' };
  const dueno = (pid) => { const t = M.dueno[pid]; if (!t) return 'Libre'; if (t === S.D.yo.teamId) return '<span class="rojo">Tuyo</span>'; return esc((M.equipo[t] || {}).manager || (M.equipo[t] || {}).nombre || 'Rival'); };

  if (seg === 'venta') {
    const liga = M.mercado.filter((m) => m.tipo === 'liga'), man = M.mercado.filter((m) => m.tipo === 'manager' && !M.enVenta.has(m.pid));
    const misPujasN = M.mercado.filter((m) => m.miPuja).length;
    if (misPujasN) h += `<p class="t2 peq" style="margin:0 0 6px">Tienes ${misPujasN} puja${misPujasN > 1 ? 's' : ''} hecha${misPujasN > 1 ? 's' : ''} por ${eur(M.misPujas)} en total.</p>`;
    if (M.misVentas.length) h += `<p class="t2 peq" style="margin:0 0 6px">Lo que tienes tú en venta está en <button class="rojo" data-ir="equipo" data-seg="equipo:venta">Equipo → En venta</button>.</p>`;
    // la puja de la derecha es la misma que en Especular y en el plan; si el plan la descarta o no te llega, se dice
    // (y no se llama «Chollo»: 3 nov, Xavi Espart salía como chollo con puja 39,5 M y el plan lo descartaba por dinero)
    // si la puja pasa de lo que puedes gastar, no se enseña: «Solo puedes gastar X» (3 nov: Lamine salía con «Te llega
    // hasta 67,8 M» y «puja 129,9 M» a la vez)
    const noLlega = new Set();
    const avisoPuja = (m) => {
      if (m.miPuja || m.noVende) return '';
      const dp = descartePlan(S, m.pid);
      const pide = m.tipo === 'liga' ? m.puja : m.ofertaMin ? m.puja : m.precio;
      const tope = dp && dp.tope != null ? dp.tope : !dp && pide > M.pujaMax ? Math.max(0, M.pujaMax) : null;
      if (tope != null && pide > tope) { noLlega.add(m.pid); return `<span class="pill duda" title="${esc((dp && dp.aviso) || `Puedes gastar hasta ${eur(tope)}`)}">Solo puedes gastar ${eur(tope)}</span>`; }
      if (dp) return `<span class="pill duda" title="${esc(dp.aviso || '')}">${dp.tope != null ? `Te llega hasta ${eur(dp.tope)}` : 'El plan lo descarta'}</span>`;
      return '';
    };
    // (repaso del 24 nov) la puja de la derecha es la del paso del plan si lo lleva (para revender no es la misma que para el
    // once); si el plan lo descarta o retira tu puja, no se enseña puja ni «Chollo»
    const opM = (m) => (S.opPorPid || {})[m.pid] || null;
    const pujaDe = (m) => { const o = opM(m); return o && ['pujar', 'comprar'].includes(o.accion) && (o.puja_max || o.importe) ? (o.puja_max || o.importe) : m.puja; };
    // (0.8.2) una puja de otro que ha entrado en las últimas 6 horas (pujas-vistas.js)
    const pujaReciente = (m) => (m.pujasEv || []).some((e) => e[0] > 0 && Date.now() - e[1] < 6 * HORA);
    const fila = (m) => { const ap = avisoPuja(m), sinPuja = noLlega.has(m.pid) || !!ap || !!(opM(m) && opM(m).retira); return filaJugador(m, {
      sub: m.tipo === 'manager' ? `${esc(m.j.equipo)} · lo vende <b>${esc(m.vendedor || 'un manager')}</b>` : `${esc(m.j.equipo)}${m.prox ? ` · ${rivalSub(M, m.j)}` : ''}`,
      pills: [
        m.miPuja ? `<span class="pill abierta">${m.tipo === 'manager' ? 'Tu oferta' : 'Tu puja'} ${eur(m.miPuja)}</span>` : '',
        m.noVende ? `<span class="pill mal" title="${esc(`No te lo venderá: ${m.noVende}`)}">No lo venderá: ${esc(m.noVende.replace(/^es /, ''))}</span>` : '',
        ap, estadoPill(m.j), m.noVende || ap || (opM(m) && opM(m).retira) ? '' : tagV[m.veredicto] || '', calPill(M, m.j, { soloDuro: true }),
        m.tipo === 'liga' && m.pujas ? `<span class="pill${pujaReciente(m) ? ' duda' : ''}">${m.pujas} puja${m.pujas > 1 ? 's' : ''}${pujaReciente(m) ? ' · nueva' : ''}</span>` : '',
      ],
      derecha: `<div class="v">${eur(m.precio)}</div><div class="d">${delta(m.tend)}</div>${sinPuja ? '' : m.tipo === 'liga' && !m.miPuja ? `<div class="d apag">puja ${eur(pujaDe(m))}</div>` : m.ofertaMin && !m.miPuja && m.puja > m.precio && !m.noVende ? `<div class="d apag">ofrece ${eur(m.puja)}</div>` : ''}`, op: S.opPorPid[m.pid],
    }); };
    const PL = M.pujasLiga;
    // (por tramos de valor: cuanto más barato, más se paga en porcentaje; Carlos, 30 oct)
    const tramoCorto = (x) => (x.desde === 0 ? `menos de ${eur(x.hasta, { dec: 0 })}` : x.hasta === Infinity ? `más de ${eur(x.desde, { dec: 0 })}` : `de ${x.desde / 1e6} a ${eur(x.hasta, { dec: 0 })}`);
    const pagaTxt = !PL || PL.poco ? ''
      : PL.tramos && PL.tramos.length >= 2 ? `<p class="t2 peq" style="margin:4px 0 2px">En tu liga, cuanto más barato, más se paga sobre su valor (mediana): ${PL.tramos.map((x) => `${tramoCorto(x)}, <b>${pct(x.med * 100)}</b>`).join(' · ')}. A la derecha, la puja que propone la app (con lo que se paga por los de su valor): la misma en Especular y en el plan.</p>`
      : `<p class="t2 peq" style="margin:4px 0 2px">En tu liga se llevan con un <b>${pct(PL.med * 100)}</b> sobre su valor de mediana. A la derecha, la puja que propone la app: la misma en Especular y en el plan.</p>`;
    let ml = liga.length ? `<div class="grupo"><span>Libres · subasta a ciegas</span><span>${liga.length}</span></div>${pagaTxt}${liga.map(fila).join('')}` : nada('No hay jugadores libres en el mercado ahora.');
    // (con lo de los rivales cerrado, su candado va con el del radar en una tarjeta, debajo de la lista)
    if (man.length && bloqueada('ventasRivales')) ml += `<div class="grupo"><span>En venta de tus rivales</span><span>${man.length}</span></div>`;
    else if (man.length) ml += `<div class="grupo"><span>En venta de tus rivales</span><span>${man.length}</span></div><p class="t2 peq" style="margin:4px 0 2px">Siguen siendo suyos y LaLiga también les hace una oferta: solo te lo vende si la tuya es mejor. A la derecha, lo que tendrías que ofrecer.</p>${man.map(fila).join('')}`;
    // (26 nov, parte B) en una liga premium con entrenador, los del mercado, aparte de los jugadores y sin veredictos
    const ents = M.entrenadoresMercado || [];
    if (ents.length) {
      const d1e = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
      const fe = M.ficharEntrenador ? M.ficharEntrenador() : null;
      ml += `<div class="grupo"><span>Entrenadores</span><span>${ents.length}</span></div>${ents.map((m) => filaJugador(m, {
        sub: `${esc(m.j.equipo)}${M.proximoPartido(m.j.equipoId) ? ` · ${rivalSub(M, m.j)}` : ''}`,
        pills: [m.miPuja ? `<span class="pill abierta">Tu puja ${eur(m.miPuja)}</span>` : '', fe && fe.pid === m.pid ? '<span class="pill bien">No tienes entrenador</span>' : '', estadoPill(m.j)],
        derecha: `<div class="v">${eur(m.precio)}</div><div class="d apag">${d1e(m.media)} pts por jornada</div>`,
      })).join('')}`;
    }
    h += lista2(ml);
    // el radar de subidas, debajo de la lista (antes iba arriba y la tapaba); cerrado, junto a los otros candados
    h += bloqueada('inercia') ? '' : radarHTML(S);
    h += candadosJuntos([man.length && bloqueada('ventasRivales') && 'ventasRivales', M.radar && bloqueada('inercia') && ['inercia', 'radar']]);
  } else if (seg === 'especular') {
    const v = M.ventanaEsp;
    if (!v || v.ciclos < 1) h += nada(M.enJuego ? 'Con la jornada en juego no se especula: espera a que acabe.' : 'No da tiempo a comprar y vender antes de la jornada.');
    else {
      h += `<p class="t2 peq">Compra lo que sube y véndelo antes de la jornada: entre medias puedes bajar hasta <b>${eur(-M.deuda)}</b>, pero la jornada tiene que empezar en positivo. Lo que compres hoy, ponlo a la venta <b>${cuando(v.ponerVentaSeguro)}</b> y acepta la oferta de <b>${cuando(v.limite)}</b>.${v.justo ? ` Hay otro cambio ${esc(cuando(v.justo))}, pero con la jornada a punto de empezar no cuentes con él para salir del negativo.` : ''} Sale de la tendencia de estos días, que puede cambiar.</p>`;
      if (M.paraRevender.length) h += `<div class="grupo"><span>Ya tienes para revender</span></div>${M.paraRevender.map((x) => filaJugador(x, { sub: `Comprado a ${eur(x.rev.precio)} · vale ${eur(x.j.valor)}`, derecha: `<div class="v ${clase(x.beneficioYa)}">${eur(x.beneficioYa, { signo: true })}</div><div class="d">${delta(x.tend)}</div>` })).join('')}`;
      h += M.especular.length ? lista2(`<div class="grupo"><span>Candidatos</span><span>${M.especular.length}</span></div>` + M.especular.slice(0, 30).map((e) => filaJugador({ j: e.j, tend: e.tend }, {
        sub: `${e.origen === 'mercado' ? `Mercado · puja ${eur(e.puja)}` : `Cláusula ${eur(e.precio)} a ${esc(e.rival.manager || e.rival.nombre)}`}`,
        extra: `${(() => { const dp = descartePlan(S, e.pid); return dp ? `<span class="pill duda" title="${esc(dp.aviso || '')}">${dp.tope != null ? `Te llega hasta ${eur(dp.tope)}` : 'El plan lo descarta'}</span>` : ''; })()}<span class="pill bien">${pct(e.r * 100)}/día</span><span class="pill">${e.dias} día${e.dias > 1 ? 's' : ''}</span>${e.vuelve ? `<span class="pill bien" title="Llegó a valer ${eur(e.vuelve.max)} esta temporada y lleva ${e.vuelve.racha} días subiendo">Vuelve · valía ${eur(e.vuelve.max)}</span>` : ''}<span class="pill ${e.confianza === 'media' ? 'duda' : ''}">Confianza ${e.confianza}</span>`,
        derecha: `<div class="v sube">${eur(e.beneficio, { signo: true })}</div><div class="d apag">${pct(e.pct * 100)}</div>`, op: S.opPorPid[e.pid],
      })).join('')) : nada('Ahora mismo nada sube lo bastante como para sacarle beneficio antes de la jornada.');
    }
  } else if (seg === 'favoritos') {
    h += favoritosHTML(S, { tagV });
  } else if (seg === 'movimientos') {
    h += movimientosLiga(S);
  } else {
    const f = S.filtro.tend || 'suben';
    h += `<div class="filtros">${[['suben', 'Suben'], ['bajan', 'Bajan'], ['libres', 'Sin dueño']].map(([k, t]) => `<button data-filtro="tend:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    if (f === 'libres') {
      h += `<p class="t2 peq">Nadie los tiene en tu liga. Ordenados por lo que interesan: pueden salir en el mercado cualquier día.</p>`;
      h += lista2(M.libresBuenos.map((x) => filaJugador({ j: x.j, tend: x.t }, { pills: [estadoPill(x.j)], sub: `${esc(x.j.equipo)}${x.j.media ? ` · ${String(Math.round(x.j.media * 10) / 10).replace('.', ',')} pts por partido` : ''}`, derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d">${delta(x.t)}</div>` })).join('') || nada('Sin datos.'));
    } else {
      const xs = f === 'suben' ? M.suben : M.bajan;
      h += `<p class="t2 peq">Toda LaLiga. ${f === 'suben' ? 'Comprar antes de que suban es como se saca beneficio.' : 'Si tienes alguno, piensa en venderlo antes de que pierda más.'}</p>`;
      h += xs.length ? lista2(xs.map((x) => filaJugador({ j: x.j, tend: x.t }, { sub: `${esc(x.j.equipo)} · ${dueno(x.j.id)}`, conMini: true, op: S.opPorPid[x.j.id] })).join('')) : nada('Aún no hay subidas: hoy no se han podido leer y la app necesita un par de días de histórico.');
    }
  }
  return h;
}

/**
 * el radar de subidas (0.6.5), arriba de Mercado → Fichar: los que más van a subir los próximos 3 días según su inercia
 * y los que acaban de hacer un partidazo, con de quién es cada uno y si se pueden fichar hoy. Va con la llave de la
 * inercia (en la de Google Play, un anuncio hasta medianoche)
 */
function radarHTML(S) {
  const { M } = S;
  if (!M.radar) return '';
  if (bloqueada('inercia')) return candado('inercia', { como: 'radar' });
  const R = M.radar();
  if (!R.suben.length && !R.partidazos.length) return '';
  const quien = (x) => (x.mio ? '<span class="rojo">Tuyo</span>' : x.tid ? `de ${esc((M.equipo[x.tid] || {}).manager || (M.equipo[x.tid] || {}).nombre || 'un rival')}` : 'sin dueño');
  const hoy = (x) => x.mio ? '' : x.mercado ? `<span class="pill abierta">${x.mercado.tipo === 'manager' ? 'A la venta' : 'En el mercado'} · ${eur(x.mercado.precio)}</span>` : x.cl ? clausulaPill(x.cl) : '';
  const fila = (x, derecha, extra = '') => filaJugador({ j: x.j, tend: x.tend }, { sub: `${esc(x.j.equipo || '')} · ${quien(x)}`, pills: [extra, hoy(x), estadoPill(x.j)], derecha, op: S.opPorPid[x.pid] });
  const sube = (x) => fila(x, `<div class="v sube">${eur(x.proy3, { signo: true })}</div><div class="d apag">${pct(x.pct3 * 100)} en 3 días</div>`, `${x.vuelve ? `<span class="pill bien" title="Llegó a valer ${eur(x.vuelve.max)} esta temporada y lleva ${x.vuelve.racha} días subiendo">Vuelve · valía ${eur(x.vuelve.max)}</span>` : ''}${x.fase === 'acelera' ? '<span class="pill bien">Acelera</span>' : ''}`);
  const VISTOS = 4;
  let h = `<details class="radar" open><summary>${icono('sube', 'rojo')}Radar de subidas<span class="sub">${R.suben.length + R.partidazos.length}</span></summary>`;
  if (R.suben.length) {
    h += `<p class="t2 peq">Los que más van a subir los próximos 3 días si siguen al ritmo de ahora (su inercia). Es una proyección, no una promesa.${R.suben.some((x) => x.vuelve) ? ' Primero, los que <b>vuelven</b>: valían mucho más esta temporada, juegan otra vez y suben varios días seguidos.' : ''}</p>`;
    h += R.suben.slice(0, VISTOS).map(sube).join('');
    if (R.suben.length > VISTOS) h += `<details class="mas-radar"><summary>Ver los ${R.suben.length}</summary>${R.suben.slice(VISTOS).map(sube).join('')}</details>`;
  }
  if (R.partidazos.length) {
    h += `<div class="grupo"><span>Acaban de hacer un partidazo</span><span>${R.partidazos.length}</span></div><p class="t2 peq">Tras un partido así LaLiga suele subirles el valor los días siguientes.</p>`;
    const pz = (x) => fila(x, `<div class="v">${eur(x.j.valor)}</div><div class="d">${delta(x.tend)}</div>`, `<span class="pill ${x.pz.nivel >= 3 ? 'bien' : 'duda'}">${x.pz.pts} pts · J${x.pz.n}</span>`);
    h += R.partidazos.slice(0, VISTOS).map(pz).join('');
    if (R.partidazos.length > VISTOS) h += `<details class="mas-radar"><summary>Ver los ${R.partidazos.length}</summary>${R.partidazos.slice(VISTOS).map(pz).join('')}</details>`;
  }
  return h + '</details>';
}

/**
 * Mercado → Favoritos: los jugadores que sigues (la estrella de su ficha), arriba los que puedes fichar hoy (libres en el
 * mercado, a la venta por otro manager o con la cláusula abierta) y debajo el resto, con de quién son y su cláusula
 */
function favoritosHTML(S, { tagV }) {
  const { M } = S;
  const ids = favoritos().filter((pid) => M.J(pid));
  if (!ids.length) return nada(`Aún no sigues a nadie. Abre la ficha de cualquier jugador (con el buscador de arriba, desde una lista o desde Clubes) y toca la estrella <b>Seguir</b>: lo tendrás aquí con su precio, de quién es y cuándo se puede fichar.`);
  const yo = S.D.yo.teamId;
  // lo que vende otro manager es una función top: si está cerrada, no se dice aquí
  const sinVentas = bloqueada('ventasRivales');
  const fichas = ids.map((pid) => {
    const j = M.J(pid), t = M.tend(pid);
    const tid = M.dueno[pid];
    const enM = M.mercado.find((m) => m.pid === pid && !(m.tipo === 'manager' && (sinVentas || m.vendedorTeamId === yo)));
    const cl = tid && tid !== yo ? M.clausulas.find((x) => x.pid === pid) : null;
    const mio = tid === yo;
    const hoy = !mio && (!!enM || !!(cl && cl.abierta));
    const quien = mio ? '<span class="rojo">Tuyo</span>' : tid ? `de ${esc((M.equipo[tid] || {}).manager || (M.equipo[tid] || {}).nombre || 'un rival')}` : 'sin dueño';
    const sub = `${esc(j.equipo || '')} · ${quien}${enM ? (enM.tipo === 'manager' ? ' · lo vende' : ' · en el mercado') : !tid ? ' · no está en el mercado' : ''}`;
    const pills = [
      enM ? `<span class="pill abierta">${enM.tipo === 'manager' ? 'A la venta' : 'Libre'} · ${eur(enM.precio)}</span>` : '',
      enM && enM.miPuja ? `<span class="pill abierta">${enM.tipo === 'manager' ? 'Tu oferta' : 'Tu puja'} ${eur(enM.miPuja)}</span>` : '',
      cl ? clausulaPill(cl) : '', estadoPill(j), enM ? (descartePlan(S, j.id) ? '<span class="pill duda">El plan lo descarta</span>' : tagV[enM.veredicto] || '') : '', calPill(M, j, { soloDuro: true }),
    ];
    const precio = enM ? enM.precio : cl ? cl.clausula : null;
    return { hoy, html: filaJugador({ j, tend: t }, { sub, pills, derecha: `<div class="v">${eur(precio || j.valor)}</div><div class="d">${precio && precio !== j.valor ? `vale ${eur(j.valor, { dec: 1 })}` : delta(t)}</div>`, op: S.opPorPid[pid] }) };
  });
  const ya = fichas.filter((x) => x.hoy), resto = fichas.filter((x) => !x.hoy);
  let ml = '';
  if (ya.length) ml += `<div class="grupo"><span>Puedes ficharlos hoy</span><span>${ya.length}</span></div>${ya.map((x) => x.html).join('')}`;
  if (resto.length) ml += `<div class="grupo"><span>${ya.length ? 'El resto' : 'Los que sigues'}</span><span>${resto.length}</span></div>${resto.map((x) => x.html).join('')}`;
  return `<p class="t2 peq">Los que sigues con la estrella de su ficha. Se guardan en este dispositivo.</p>${lista2(ml)}`;
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
    const vi = M.mias.filter((x) => x.ventaInercia && !bloqueada('inercia') && ((M.decision ? M.decision(x.pid) : null) || {}).accion === 'vender').sort((a, b) => b.ventaInercia.perder - a.ventaInercia.perder)[0];
    if (vi) add(`¿Vendo ya a ${vi.j.nombre}? ${comoVa(M, vi.pid, vi.ventaInercia)}`);
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
// (la miniatura guardada está en IndexedDB: si aún no está en memoria, la pone app.js al pintar, por data-mini)
const fotosMsg = (fs, m) => (fs && fs.length ? `<div class="msg-fotos">${fs.map((f, i) => { const src = f.mini || miniDe(f.id); return `<button data-accion="verFoto" data-m="${m}" data-i="${i}" aria-label="Ver la foto ${i + 1}"><img ${src ? `src="${esc(src)}"` : `data-mini="${esc(f.id)}"`} alt=""></button>`; }).join('')}</div>` : '');

/* (iOS 3) en la app de iOS no hay clave de Google: sin la IA de la app (en la liga de ejemplo, o si no está disponible),
   se dice qué pasa en vez de la guía para sacar la clave */
function iaSinClaveIos(S) {
  const demo = !!(S.D && S.D.demo);
  return `<div class="eti">Pregunta</div><h1 class="titulo">Tu director deportivo</h1>${demo
    ? `<p class="entradilla">En la liga de ejemplo no se le puede preguntar a la IA. Entra con tu cuenta de LaLiga y pregúntale lo que quieras de tu liga, también con capturas.</p><button class="btn ancho" data-accion="salirDemo">Entrar con mi cuenta</button>`
    : '<p class="entradilla">Ahora mismo no se le puede preguntar a la IA. Vuelve a probar en un rato: mientras, en Hoy tienes el plan de la app.</p>'}`;
}
export function ia(S) {
  if (!puedeChat(!!(S.D && S.D.demo))) return enAppIos() ? iaSinClaveIos(S) : guiaClave(planesApp(!!(S.D && S.D.demo)));
  const msgs = conversacion();
  const viejos = chatsAnteriores();
  let h = `<div class="chat${(S.adjuntos || []).length ? ' con-adj' : ''}"><div class="chat-cab"><div><div class="eti">Pregunta</div><h1 class="titulo">Tu director deportivo</h1></div>
    <div class="chat-acc">${viejos.length ? `<button class="btn chico sec" data-accion="chatsViejos">${icono('lista')}Anteriores (${viejos.length})</button>` : ''}${msgs.length ? `<button class="btn chico" data-accion="nuevoChat">${icono('mas')}Nuevo chat</button>` : ''}</div></div>`;
  // (iOS 3) dijo que no a mandar su liga a la IA: no se manda nada hasta que diga que sí
  if (enAppIos() && permisoIA() === 'no') h += `<div class="banda">${icono('candado')}<span>La IA está apagada en este iPhone: no se le manda nada.</span><button data-accion="permisoIA">Activar</button></div>`;
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
    : `<div class="msg ia"><div class="quien-ia">IA${m.ts ? `<span>${hora(m.ts)}</span>` : ''}<button class="copiar-msg" data-accion="copiarMsg" data-i="${i}" aria-label="Copiar">${icono('copiar')}</button></div>${respuestaHTML(sinWebs(m.t))}${(m.fuentes || []).filter((f) => !esWebFantasy(f.t) && !esWebFantasy(f.u)).length ? `<div class="fuentes">${m.fuentes.filter((f) => !esWebFantasy(f.t) && !esWebFantasy(f.u)).map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>` : ''}${m.dr ? tarjetaChatHTML(m.dr, i, S.D) : ''}${(m.apuntadas && m.apuntadas.length) || m.olvidadas ? `<div class="apuntado">${icono('nota')}<div>${(m.apuntadas || []).map((t) => `<b>Apuntado:</b> ${esc(t)}`).join('<br>')}${m.olvidadas ? `${m.apuntadas && m.apuntadas.length ? '<br>' : ''}Olvidado${m.olvidadas > 1 ? `s ${m.olvidadas}` : ''} lo que ya no vale.` : ''}${m === ultimaIA ? '<button class="btn chico" data-accion="planYa">Rehacer el plan con esto</button>' : ''}</div></div>` : ''}</div>`)).join('');
  // para seguir la conversación sin escribir
  if (ultimaIA && msgs[msgs.length - 1] === ultimaIA && !S.charlando) h += `<div class="seguir">${['Dímelo más corto', '¿Y qué alternativas tengo?', '¿Qué hago primero?'].map((x) => `<button data-sugerencia="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  // la pregunta que se está contestando, aunque aún no esté guardada en el chat
  const yaEsta = msgs.length && msgs[msgs.length - 1].r === 'yo' && msgs[msgs.length - 1].t === S.preguntaActual;
  if (S.charlando && (S.preguntaActual || (S.fotosActuales || []).length) && !yaEsta) h += `<div class="msg yo">${fotosMsg(S.fotosActuales, -1)}${S.preguntaActual ? `<div>${esc(S.preguntaActual)}</div>` : ''}</div>`;
  if (S.claveMal && !S.charlando) h += `<div class="error-c"><b>Google no acepta tu clave de la IA.</b> Crea otra en aistudio.google.com/apikey y pégala: tu chat no se borra.<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="cambiarClave">Poner otra clave</button><button class="btn chico sec" data-abrir="https://aistudio.google.com/apikey">Abrir aistudio</button></div></div>`;
  if (S.errorChat && !S.charlando) h += `<div class="error-c"><b>No ha podido contestar.</b> ${esc(S.errorChat.msg)}<div class="t2 peq" style="margin-top:4px">Tu pregunta está otra vez abajo, en la caja${S.errorChat.n ? ', con sus fotos' : ''}.</div><div style="margin-top:8px"><button class="btn chico" data-accion="repreguntar">Volver a preguntar</button></div></div>`;
  if (S.charlando) h += `<div class="msg ia" id="respuesta"><div class="quien-ia">Pensando…</div>${S.parcial ? md(S.parcial) : `<span class="pensando"><i></i><i></i><i></i></span> <span class="t2 peq" id="paso-chat">${esc(S.pasoChat || '')}</span>`}</div><div class="parar-chat"><button class="btn chico sec" data-accion="pararChat">${icono('parar')}Parar la respuesta</button></div>`;
  const puedeFotos = !S.charlando && (S.adjuntos || []).length < 4;
  h += `</div><div class="escribe"><div class="adjuntos" id="adjuntos">${adjuntosHTML(S)}</div><div class="escribe-in"><button class="micro foto" data-accion="foto" aria-label="Mandar una foto o captura"${puedeFotos ? '' : ' disabled'}>${icono('foto')}</button><textarea id="pregunta" rows="1" placeholder="Pregunta o cuéntale algo"></textarea>${S.charlando ? `<button class="parar" data-accion="pararChat" aria-label="Parar">${icono('parar')}</button>` : `${nativo.hayVoz() ? `<button class="micro" data-accion="voz" aria-label="Hablar">${icono('micro')}</button>` : ''}<button data-accion="enviar" aria-label="Enviar">${icono('enviar')}</button>`}</div></div>`;
  return h;
}
