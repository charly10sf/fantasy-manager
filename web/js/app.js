/* Fantasy Manager: arranque, navegación, carga de datos, el plan del día y todo lo que pasa al tocar algo. */
import { esc, icono, LOGO, $, $$, LS, eur, rel, MIN, diaDe, enParalelo } from './util.js';
import { enApp, nativo } from './puente.js';
import { haySesion, empezarLogin, terminarLogin, cerrarSesion } from './auth.js';
import { actualizar, foto, historico, cfg, guardarCfg, enDemo, pasosCarga, borrarTodo, completar, detalles, K, fuentesExternas, fuentesGuardadas, actHist } from './datos.js';
import { aprender, calibracion } from './aprende.js';
import { analizar, planAuto } from './motor.js';
import * as V from './vistas.js';
import * as Hj from './hojas.js';
import { programar, cfgAvisos, guardarCfgAvisos } from './avisos.js';
import { planDelDia, planViejo, ultimoPlan, cuadrarPlan, charlar, guardarClave, probarClave, guardarCfgIA, cfgIA, borrarConversacion, hayClave, intentosIA, borrarNota, quitarUltimaPregunta, notasVigentes, nuevoChat, recuperarChat, borrarChatAnterior, conversacion, chatsAnteriores } from './ia.js';
import { ultimaVersion, api } from './api.js';
import { detalleJugador } from './normalizar.js';
import { linea } from './graficos.js';
import { md } from './texto.js';
import { ponerEquipos } from './comunes.js';
import { encuadrar } from './caras.js';
import { historialValor } from './externas.js';
import { VERSION, NOVEDADES, cmpVer, deNumeracionVieja } from './version.js';
import { presentarNovedades, cerrarPresentacion, listaNovedades } from './presentacion.js';
import { EN_FONDO, cfgFondo, guardarCfgFondo, deNoche, callado, avisoPlan, avisosNuevos, sinAvisar, marcarVistos } from './fondo.js';

const S = { D: null, H: null, M: null, c: cfg(), det: {}, plan: null, planEstado: {}, opPorPid: {}, vista: 'hoy', seg: {}, filtro: {}, cargando: false, hoja: null, tipoHoja: null, charlando: false, parcial: '', pasoChat: '', nueva: null };
window.S = S;
const VISTAS = { hoy: V.hoy, equipo: V.equipo, rivales: V.rivales, mercado: V.mercado, ia: V.ia };
const ALIAS = { inicio: 'hoy', analisis: 'ia', chat: 'ia' };
const NAV = [['hoy', 'rayo', 'Hoy'], ['equipo', 'equipo', 'Equipo'], ['rivales', 'rivales', 'Rivales'], ['mercado', 'mercado', 'Mercado'], ['ia', 'ia', 'Pregunta']];
const raiz = () => document.getElementById('app');

/* ---------------- avisos de abajo ---------------- */
let relojT;
function tostada(t, ms = 3200) {
  let el = $('.tostada');
  if (!el) { el = document.createElement('div'); el.className = 'tostada'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('on');
  clearTimeout(relojT); relojT = setTimeout(() => el.classList.remove('on'), ms);
}

/* ---------------- pantallas completas ---------------- */
function pantallaEntrar(error = '') {
  raiz().innerHTML = `<div class="pantalla">${LOGO}
    <h1>Fantasy<br><span>Manager</span></h1>
    <p>Cada día, las operaciones exactas para tu liga de LaLiga Fantasy: a quién vender, a quién comprar, cuánto pujar y a quién clausular.</p>
    <ul class="lista-ok">
      <li>${icono('rayo')}Plan del día paso a paso, con el saldo después de cada operación</li>
      <li>${icono('ia')}La IA lee lesiones, convocatorias, alineaciones y el calendario antes de decidir</li>
      <li>${icono('diana')}Aviso al minuto cuando se abre una cláusula que te interesa</li>
      <li>${icono('rivales')}Lo que hace cada rival y quién va a por tus jugadores</li>
    </ul>
    ${error ? `<div class="error-c" style="margin:0 0 16px">${esc(error)}</div>` : ''}
    <button class="btn ancho" data-accion="entrar">${icono('usuario')}Entrar con mi cuenta de LaLiga</button>
    <p class="peq apag" style="margin-top:12px">Se abre la página oficial de LaLiga: entra como siempre (con Google, si es como lo haces). Si Android pregunta con qué app volver, elige <b>Fantasy Manager</b>.</p>
    <button class="btn sec ancho" data-accion="entrarDemo" style="margin-top:6px">Ver con una liga de ejemplo</button>
  </div>`;
}
/* ---------------- la pantalla de carga ---------------- */
// lo que se va contando mientras carga: cosas del juego que conviene tener presentes
const CONSEJOS = [
  'Si empiezas la jornada en negativo, no puntúas. Entre semana puedes bajar hasta el 20 % del valor de tu equipo.',
  'Un jugador recién fichado tiene la cláusula protegida unos 14 días.',
  'Lo que pagas por encima del valor de un jugador se pierde: si lo vendes, te dan cerca de su valor.',
  'En el mercado de la liga se puja a ciegas: gana la puja más alta cuando cambia el mercado.',
  'Lo que vende otro manager sigue siendo suyo hasta que acepta tu oferta.',
  'En la versión gratis no hay entrenador: no gastes en ellos.',
  'Un defensa con poca portería a cero esperada puntúa poco aunque sea titular.',
  'Si un jugador marca menos de lo que dice su xG, lo normal es que acaben llegando los goles.',
  'Antes de un parón los valores se paran: buen momento para vender lo que está arriba.',
  'Puedes contarle a la IA un trato con un amigo y lo tendrá en cuenta en el plan.',
];
let consejoT = null;
function pantallaCarga(paso = -1, error = '') {
  const total = pasosCarga.length;
  const pct = error ? 0 : Math.max(4, Math.min(100, Math.round(((paso + 0.5) / total) * 100)));
  const actual = paso >= 0 && paso < total ? pasosCarga[paso] : 'Preparando';
  const hechos = pasosCarga.slice(0, Math.max(0, paso));
  const el = $('.carga');
  // si ya está en pantalla, solo se mueve lo que cambia (para que la barra y las animaciones vayan suaves)
  if (el && !error && $('.carga-barra', el)) {
    $('.carga-barra i', el).style.width = `${pct}%`;
    $('.carga-paso b', el).textContent = actual;
    $('.carga-paso .pct', el).textContent = `${pct} %`;
    $('.carga-hechos', el).innerHTML = hechos.map((t) => `<span>${icono('ok')}${esc(t)}</span>`).join('');
    return;
  }
  const liga = (foto() || {}).liga;
  raiz().innerHTML = `<div class="carga ${error ? 'mal' : ''}">
    <div class="carga-luz" aria-hidden="true"></div><div class="carga-campo" aria-hidden="true"><i></i><i></i></div>
    <div class="carga-in">
      <div class="carga-escudo">${LOGO}</div>
      <div class="carga-marca">Fantasy <span>Manager</span></div>
      <h1 class="carga-t">${error ? 'No se ha podido cargar' : liga && liga.nombre ? `Poniendo al día<br><span>${esc(liga.nombre)}</span>` : 'Poniendo al día<br><span>tu liga</span>'}</h1>
      ${error ? `<div class="error-c">${esc(error)}</div>
        <div class="carga-btns"><button class="btn" data-accion="recargar">${icono('refrescar')}Volver a probar</button><button class="btn sec" data-accion="diag">Diagnóstico</button><button class="btn sec" data-accion="entrarDemo">Ver la liga de ejemplo</button></div>`
        : `<div class="carga-barra"><i style="width:${pct}%"></i></div>
        <div class="carga-paso"><span class="balon">${icono('balon')}</span><b>${esc(actual)}</b><span class="pct">${pct} %</span></div>
        <div class="carga-hechos">${hechos.map((t) => `<span>${icono('ok')}${esc(t)}</span>`).join('')}</div>`}
    </div>
    ${error ? '' : `<div class="carga-consejo"><span class="et">${icono('info')}¿Sabías que…?</span><p id="cConsejo">${esc(CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)])}</p></div>`}
  </div>`;
  clearInterval(consejoT);
  if (!error) {
    let k = Math.floor(Math.random() * CONSEJOS.length);
    consejoT = setInterval(() => {
      const c = $('#cConsejo');
      if (!c) { clearInterval(consejoT); return; }
      c.classList.add('sale');
      setTimeout(() => { k = (k + 1) % CONSEJOS.length; c.textContent = CONSEJOS[k]; c.classList.remove('sale'); }, 350);
    }, 4200);
  }
}

/* ---------------- el marco ---------------- */
function marco() {
  if ($('#vista')) return;
  raiz().innerHTML = `<header class="sup">${LOGO}<div class="sup-liga"><b id="supLiga"></b><span id="supEstado"></span></div>
    <button class="b-ico" id="bRefrescar" data-accion="recargar" aria-label="Actualizar">${icono('refrescar')}</button>
    <button class="b-ico" data-accion="ajustes" aria-label="Ajustes">${icono('ajustes')}</button></header>
    <main><div id="banda"></div><div id="vista" class="vista"></div></main>
    <nav class="nav"><div class="nav-in">${NAV.map(([k, ic, t]) => `<button data-ir="${k}">${icono(ic)}${t}<span class="gl oculto" id="gl-${k}"></span></button>`).join('')}</div></nav>`;
}
function pintarSup() {
  const { D } = S;
  $('#supLiga').textContent = D ? D.liga.nombre : 'Fantasy Manager';
  const edad = D ? Date.now() - D.t : Infinity;
  const p = S.cargando ? 'vivo' : edad < 30 * MIN ? 'vivo' : edad < 6 * 3600e3 ? 'viejo' : 'mal';
  $('#supEstado').innerHTML = `<i class="punto ${p}"></i>${S.cargando ? 'Actualizando…' : D ? (edad < MIN ? 'Al día' : `Actualizado ${rel(D.t)}`) : ''}`;
  $('#bRefrescar').classList.toggle('gira', S.cargando);
  const pend = S.plan ? S.plan.ops.filter((o) => o.hoy !== false && !['esperar'].includes(o.accion) && !V.hecho(S, S.plan, o)).length : 0;
  const gh = $('#gl-hoy'); gh.textContent = pend; gh.classList.toggle('oculto', !pend);
  const ga = S.M.mias.filter((x) => x.riesgo === 'alto').length;
  const ge = $('#gl-equipo'); ge.textContent = ga; ge.classList.toggle('oculto', !ga);
}
function pintar({ arriba = false } = {}) {
  if (!S.D) return;
  marco();
  pintarSup();
  $$('.nav button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === S.vista));
  const v = $('#vista');
  try { v.innerHTML = VISTAS[S.vista](S); } catch (e) { v.innerHTML = `<div class="error-c">Algo ha fallado al pintar esta pantalla: ${esc(e.message)}</div>`; console.error(e); }
  $('#banda').innerHTML = S.nueva ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva (${esc(S.nueva.nombre)})</span><button data-accion="actualizarApp">Actualizar</button></div>` : '';
  if (arriba) window.scrollTo(0, 0);
  if (S.vista === 'ia') {
    bajarChat();
    // la pregunta que paraste vuelve a la caja
    if (S.borrador && !S.charlando) { const ta = $('#pregunta'); if (ta) { ta.value = S.borrador; S.borrador = ''; } }
  }
  encuadrar(v);
}
function ir(vista, { arriba = true } = {}) {
  vista = ALIAS[vista] || vista;
  if (!VISTAS[vista]) vista = 'hoy';
  if (S.vista !== vista) nativo.toque();
  S.vista = vista;
  if (location.hash !== '#' + vista) history.replaceState(null, '', '#' + vista);
  pintar({ arriba });
}
const bajarChat = () => setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 30);

/* ---------------- datos ---------------- */
function rehacer() {
  S.c = cfg();
  S.H = historico();
  S.det = { ...detalles(), ...S.det };
  ponerEquipos(S.D.equipos);
  S.M = analizar(S.D, S.H, S.c, extraM());
  // lo previsto frente a lo que pasó: corrige los puntos esperados de la próxima pasada y lo ve la IA
  aprender(S.D, S.M, S.det);
  montarPlan();
  if (apuntarReventa()) { const ap = S.M.aprende; S.M = analizar(S.D, S.H, S.c, extraM()); S.M.aprende = ap; montarPlan(); }
  programar(S.D, S.M);
  if (!EN_FONDO) {
    programarFondo();
    // lo que ves con la app abierta ya no te llega luego como notificación
    marcarVistos(avisosNuevos(null, S.D, S.M));
  }
}
/** la IA en segundo plano: cada 3 horas y unos minutos después del próximo cambio de mercado */
function programarFondo() {
  if (!enApp) return;
  nativo.programarFondo(cfgFondo().on && !enDemo(), S.M && S.M.cierreMercado ? S.M.cierreMercado + 8 * MIN : 0);
}

/**
 * La pasada en segundo plano (Android abre la web sin pantalla con ?fondo=1): pone la liga al día, rehace el plan
 * con la IA si toca y avisa con notificaciones de lo nuevo. Al acabar se lo dice a la app, pase lo que pase.
 */
async function trabajoFondo() {
  const t0 = Date.now();
  const reg = { t: t0, pasos: [] };
  const paso = (x) => reg.pasos.push(x);
  const avisar = (lista) => {
    for (const a of lista.slice(0, 4)) nativo.notificar(a.titulo, a.texto, a.hash || 'hoy');
    if (lista.length > 4) nativo.notificar(`Y ${lista.length - 4} cosas más en tu liga`, 'Abre la app para verlas', 'hoy');
  };
  try {
    if (!enApp || enDemo()) { paso('liga de ejemplo: nada que hacer'); return; }
    if (!cfgFondo().on) { paso('apagado en Ajustes'); return; }
    if (!haySesion()) { paso('sin sesión de LaLiga'); return; }
    if (deNoche()) { paso('de noche: nada'); return; }
    const antes = foto();
    S.D = await actualizar(() => {});
    rehacer();
    paso('liga al día');
    try { const f = await fuentesExternas(S.D, S.M); if (f) S.fuentes = f; } catch (e) { paso(`onces y noticias: ${e.message}`); }
    try { const det = await completar(S.D, S.M); if (det) S.det = { ...S.det, ...det }; } catch (e) { if (e.sesion) throw e; paso(`fichas: ${e.message}`); }
    rehacer();
    const lista = avisosNuevos(antes, S.D, S.M);
    if (planViejo(S.M)) {
      let conIA = false;
      if (hayClave()) {
        try {
          await Promise.race([
            planDelDia(S.D, S.M, S.c, {}),
            new Promise((_, mal) => setTimeout(() => mal(new Error('la IA ha tardado más de 7 minutos')), 7 * MIN)),
          ]);
          conIA = true;
          paso('plan nuevo con IA');
        } catch (e) { paso(`IA: ${e.message || e}`); }
        rehacer();
      }
      if (S.plan) {
        const a = avisoPlan(S.plan, conIA);
        if (!conIA) a.k = `plan-auto:${diaDe()}:${(S.M && S.M.cierreMercado) || ''}`;
        lista.unshift(a);
      }
    }
    if (callado()) paso('de madrugada: sin avisos');
    else { const nuevos = sinAvisar(lista); avisar(nuevos); reg.avisos = nuevos.length; }
    reg.ok = true;
  } catch (e) {
    reg.error = e.message || String(e);
    if (e.sesion && !callado()) avisar(sinAvisar([{ k: `sesion:${diaDe()}`, titulo: 'Tu sesión de LaLiga ha caducado', texto: 'Entra en la app para volver a conectarte. Mientras, la IA no puede mirar tu liga.', hash: 'hoy' }]));
  } finally {
    reg.ms = Date.now() - t0;
    reg.ia = intentosIA.slice(0, 10);
    LS.set('fondo-ultimo', reg);
    try { programarFondo(); } catch (e) { /* nada */ }
    nativo.fondoTerminado();
  }
}

/** lo que el motor necesita además de la foto: fichas, reventa, onces probables y noticias */
function extraM() {
  const f = S.fuentes || fuentesGuardadas() || {};
  return { det: S.det, reventa: reventa(), onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, calib: calibracion(), actHist: S.D && S.D.liga ? actHist(S.D.liga.id) : null, notas: notasVigentes(), dichos: LS.get(K('dinero-dicho'), {}) };
}

/* lo que compras para revender se apunta (para recordarte venderlo antes de la jornada) */
const reventa = () => LS.get(K('reventa'), {});
function apuntarReventa() {
  const r = reventa();
  let cambia = false;
  const mios = new Set(S.M.mias.map((x) => x.pid));
  for (const o of (S.plan && S.plan.ops) || []) {
    if (!String(o.objetivo || '').startsWith('revend') || o.signo >= 0 || !o.pid || r[o.pid]) continue;
    if (mios.has(o.pid) && V.hecho(S, S.plan, o)) { r[o.pid] = { t: Date.now(), precio: o.puja_max || o.importe || null }; cambia = true; }
  }
  // fuera los que ya no son tuyos
  for (const pid of Object.keys(r)) if (!mios.has(pid) && Date.now() - r[pid].t > 3600e3) { delete r[pid]; cambia = true; }
  if (cambia) LS.set(K('reventa'), r);
  return cambia;
}

/** el plan que se enseña: el de la IA si es de hoy (o el último mientras llega el nuevo); si no, el automático */
function montarPlan() {
  const P = ultimoPlan();
  let base;
  if (P && (P.dia === diaDe() || S.planEstado.cargando || !hayClave())) base = { ...P, viejo: P.dia !== diaDe() };
  else if (P && S.planEstado.error && Date.now() - P.t < 2 * 86400e3) base = { ...P, viejo: true };
  else base = planAuto(S.D, S.M, S.c);
  S.plan = cuadrarPlan(base, S.D, S.M);
  S.opPorPid = {};
  for (const o of S.plan.ops) if (o.pid && !o.descartada && !S.opPorPid[o.pid]) S.opPorPid[o.pid] = o;
}

async function cargar({ silencio = false } = {}) {
  if (S.cargando) return;
  S.cargando = true;
  const conPantalla = !S.D;
  if (conPantalla) pantallaCarga(0); else if ($('#vista')) pintarSup();
  try {
    S.D = await actualizar((i) => { if (conPantalla) pantallaCarga(i); });
    rehacer();
    S.cargando = false;
    pintar();
    if (!silencio && !conPantalla) tostada('Liga al día');
    despues();
  } catch (e) {
    S.cargando = false;
    console.error(e);
    if (e.sesion) { S.D = null; pantallaEntrar(e.message); return; }
    if (conPantalla) pantallaCarga(-1, e.message || String(e));
    else { pintar(); tostada(`No se ha podido actualizar: ${e.message}`, 5000); }
  }
}

/** lo que va después de cargar, sin bloquear: las fichas de los jugadores (forma y caras) y el plan con IA */
async function despues() {
  // onces probables y noticias (de fuera de LaLiga) y, a la vez, las fichas de los jugadores
  const fuentes = fuentesExternas(S.D, S.M).then((f) => { if (f) { S.fuentes = f; rehacer(); if (!S.hoja) pintar(); } }).catch((e) => console.warn('fuentes', e));
  try {
    const det = await completar(S.D, S.M);
    if (det) { S.det = { ...S.det, ...det }; rehacer(); if (!S.hoja) pintar(); }
  } catch (e) { console.warn('fichas', e); }
  await fuentes;
  const ci = cfgIA();
  if (hayClave() && ci.auto && planViejo(S.M) && !S.planEstado.cargando && !S.planEstado.error) generarPlan();
}

/* ---------------- el plan con IA ---------------- */
async function generarPlan() {
  if (S.planEstado.cargando || !S.D) return;
  S.planEstado = { cargando: true, paso: '' };
  montarPlan();
  if (S.vista === 'hoy') pintar();
  nativo.trabajando(true, 'La IA está leyendo tu liga y las noticias. Puedes salir de la app: te aviso al terminar.');
  const ctl = new AbortController();
  S.planCtl = ctl;
  try {
    await planDelDia(S.D, S.M, S.c, {
      signal: ctl.signal,
      alPaso: (t) => { S.planEstado.paso = t; const el = $('#paso-ia'); if (el) el.textContent = t; },
    });
    S.planEstado = {};
    rehacer();
    tostada('Plan de hoy listo');
    if (!nativo.aLaVista()) nativo.notificar('Tu plan de hoy está listo', (S.plan && S.plan.titular) || 'Entra para ver los pasos', 'hoy');
  } catch (e) {
    if (e.name === 'AbortError') {
      // lo has parado tú: se queda el plan que había y puedes pedir otro cuando quieras
      S.planEstado = {};
      rehacer();
      tostada('Plan parado. Dale a «Rehacer» cuando quieras otro');
    } else {
      S.planEstado = { error: e.message || String(e) };
      rehacer();
      if (!nativo.aLaVista()) nativo.notificar('No ha salido el plan de hoy', 'Entra y dale a Reintentar', 'hoy');
    }
  } finally {
    if (S.planCtl === ctl) S.planCtl = null;
    nativo.trabajando(false);
  }
  if (!S.hoja) pintar(); else pintarSup();
}

/* ---------------- ventanas de abajo ---------------- */
function abrirHoja(html) {
  cerrarHoja(true);
  const velo = document.createElement('div'); velo.className = 'velo'; velo.dataset.accion = 'cerrarHoja';
  const hoja = document.createElement('div'); hoja.className = 'hoja';
  hoja.innerHTML = `<div class="asa"></div>${html}`;
  document.body.append(velo, hoja);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { velo.classList.add('on'); hoja.classList.add('on'); });
  S.hoja = hoja;
  encuadrar(hoja);
  let y0 = null;
  hoja.addEventListener('touchstart', (e) => { y0 = hoja.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  hoja.addEventListener('touchmove', (e) => { if (y0 == null) return; const d = e.touches[0].clientY - y0; if (d > 0) hoja.style.transform = `translateY(${d}px)`; }, { passive: true });
  hoja.addEventListener('touchend', (e) => { if (y0 == null) return; const d = e.changedTouches[0].clientY - y0; hoja.style.transform = ''; if (d > 110) cerrarHoja(); y0 = null; });
  return hoja;
}
function cerrarHoja(ya = false) {
  const h = $('.hoja'), v = $('.velo');
  if (!h) return false;
  S.hoja = null; S.tipoHoja = null;
  document.body.style.overflow = '';
  if (ya) { h.remove(); v && v.remove(); return true; }
  h.classList.remove('on'); v && v.classList.remove('on');
  setTimeout(() => { h.remove(); v && v.remove(); }, 250);
  return true;
}
const htmlHoja = (tipo, arg) => (tipo === 'ajustes' ? Hj.ajustes(S) : tipo === 'j' ? Hj.fichaJugador(S, arg) : tipo === 'r' ? Hj.fichaRival(S, arg) : tipo === 'resumen' ? Hj.resumenEquipo(S) : tipo === 'chats' ? V.chatsViejosHTML() : Hj.diagnostico(S));
function hoja(tipo, arg) { abrirHoja(htmlHoja(tipo, arg)); S.tipoHoja = [tipo, arg]; }
function repintarHoja() {
  if (!S.hoja || !S.tipoHoja) return;
  const sc = S.hoja.scrollTop;
  S.hoja.innerHTML = `<div class="asa"></div>${htmlHoja(...S.tipoHoja)}`;
  S.hoja.scrollTop = sc;
  encuadrar(S.hoja);
}

window.atras = () => {
  if (cerrarPresentacion()) return true;
  if (cerrarHoja()) return true;
  if (S.D && S.vista !== 'hoy') { ir('hoy'); return true; }
  return false;
};
window.alVolver = () => {
  if (S.D && !S.cargando && Date.now() - S.D.t > 15 * MIN && (enDemo() || haySesion())) cargar({ silencio: true });
};

/* ---------------- la ficha de un jugador: puntos por jornada ---------------- */
async function cargarDetalle(pid) {
  const ya = S.det[pid];
  if (ya && Date.now() - ya.t < 6 * 3600e3 && !ya.error && (ya.valores || ya.sinValores || enDemo())) { pintarDetalle(pid); return; }
  let det;
  if (enDemo()) {
    const j = S.M.J(pid);
    let x = (+pid || 7) * 7;
    const azar = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    det = { stats: Array.from({ length: 9 }, (_, i) => { const min = azar() < 0.15 ? 0 : Math.round(45 + azar() * 45); return { n: i + 1, pts: min ? Math.round(j.media * (0.3 + azar() * 1.4)) : 0, min, gol: j.pos === 4 && azar() < 0.4 ? 1 : 0, asis: azar() < 0.15 ? 1 : 0, am: azar() < 0.12 ? 1 : 0, roja: 0 }; }), valores: null };
  } else {
    try {
      const d = ya && Date.now() - ya.t < 6 * 3600e3 && !ya.error ? ya : detalleJugador(await api.jugador(pid, S.D.liga.id));
      // el histórico de valor para la gráfica, si la ficha no lo trae
      if (!d.valores) { d.valores = await historialValor(pid).catch(() => null); if (!d.valores) d.sinValores = true; }
      det = d;
      if (d.img && S.D.maestro[pid] && !S.D.maestro[pid].img) { S.D.maestro[pid].img = d.img; const caras = LS.get('caras', {}); caras[pid] = d.img; LS.set('caras', caras); }
    } catch (e) { det = { error: e.message, stats: [] }; }
  }
  S.det[pid] = { ...det, t: Date.now() };
  pintarDetalle(pid);
}
function pintarDetalle(pid) {
  if (!S.tipoHoja || S.tipoHoja[0] !== 'j' || S.tipoHoja[1] !== pid) return;
  const el = $('#det-j'); if (el) el.innerHTML = Hj.detalleHTML(S.det[pid]);
  pintarGraf(pid);
}
/** el histórico de valor de tus jugadores que aún no se tenga, para sumar el del equipo */
async function valoresMios() {
  if (enDemo()) return;
  const faltan = S.M.mias.map((x) => x.pid).filter((pid) => !(S.det[pid] && (S.det[pid].valores || S.det[pid].sinValores)));
  if (!faltan.length) return;
  await enParalelo(faltan.slice(0, 25), 3, async (pid) => {
    const v = await historialValor(pid).catch(() => null);
    S.det[pid] = { ...(S.det[pid] || { stats: [], t: Date.now() }), valores: v || null, sinValores: !v };
  });
  if (S.tipoHoja && S.tipoHoja[0] === 'resumen') repintarHoja();
}
function pintarGraf(pid) {
  const g = $('#graf-j');
  if (!g) return;
  const r = S.rango || 30;
  g.innerHTML = Hj.grafValor(Hj.serieValor(S, pid), r, Hj.cargandoValor(S, pid));
  $$('.rangos button').forEach((b) => b.classList.toggle('activo', +b.dataset.n === r));
}

/* ---------------- el chat ---------------- */
async function enviarPregunta(texto) {
  const t = (texto || '').trim();
  if (!t || S.charlando) return;
  if (S.vista !== 'ia') ir('ia');
  S.charlando = true; S.parcial = ''; S.pasoChat = ''; S.preguntaActual = t;
  pintar();
  let ultimo = 0;
  // como con el plan: aunque salgas de la app sigue pensando, y si no estás en ella te avisa al contestar
  nativo.trabajando(true, `«${t.length > 60 ? `${t.slice(0, 57)}…` : t}» · Puedes salir de la app: te aviso cuando conteste.`, 'Pensando la respuesta');
  const ctl = new AbortController();
  S.chatCtl = ctl;
  try {
    const r = await charlar(t, S.D, S.M, S.c, (parcial) => {
      S.parcial = parcial;
      const ahora = Date.now();
      if (ahora - ultimo > 120) { ultimo = ahora; const el = $('#respuesta'); if (el) { el.innerHTML = `<div class="quien-ia">Escribiendo…</div>${md(parcial)}`; bajarChat(); } }
    }, ctl.signal);
    if (!nativo.aLaVista()) {
      const limpio = String((r && r.texto) || '').replace(/[*_#>`]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\s+/g, ' ').trim();
      nativo.notificar('Tu director deportivo ha contestado', limpio.length > 220 ? `${limpio.slice(0, 217)}…` : limpio || 'Entra para leer la respuesta', 'ia');
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      // parada: la pregunta vuelve a la caja para cambiarla o mandarla otra vez
      quitarUltimaPregunta(t);
      S.borrador = t;
      tostada('Pregunta parada');
    } else {
      tostada(e.message || 'No ha contestado', 7000);
      if (!nativo.aLaVista()) nativo.notificar('No ha podido contestar', e.message || 'Entra y vuelve a preguntar', 'ia');
    }
  } finally {
    if (S.chatCtl === ctl) S.chatCtl = null;
    S.preguntaActual = '';
    nativo.trabajando(false);
  }
  S.charlando = false; S.parcial = '';
  if (S.vista === 'ia') pintar();
}

/* ---------------- preguntar con la voz ---------------- */
function escuchar() {
  if (!hayClave()) { ir('ia'); tostada('Primero activa la IA con tu clave de Google'); return; }
  if (S.charlando) return;
  if (enApp) { nativo.voz(); return; }
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { tostada('Este navegador no entiende la voz'); return; }
  const r = new R();
  r.lang = 'es-ES'; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = (e) => window.vozTexto(e.results[0][0].transcript);
  r.onerror = (e) => window.vozTexto(null, e.error === 'not-allowed' ? 'Sin permiso para el micrófono' : 'No te he entendido');
  tostada('Te escucho…', 6000);
  r.start();
}
/** lo que ha entendido el dictado: se pregunta tal cual */
window.vozTexto = (texto, error) => {
  const t = String(texto || '').trim();
  if (!t) { if (error) tostada(error, 5000); return; }
  enviarPregunta(t);
};

/* ---------------- versión nueva y permisos ---------------- */
async function buscarVersion(avisar = false) {
  if (!enApp) return;
  const v = await ultimaVersion();
  if (v && v.version > nativo.version()) { S.nueva = v; pintar(); if (avisar) tostada(`Hay una versión nueva: ${v.nombre}`); }
  else if (avisar) tostada('Tienes la última versión');
}
window.progresoApp = (pct, estado) => {
  if (pct < 0) tostada(`No se ha podido bajar: ${estado}`, 5000);
  else if (estado === 'permiso') tostada('Dale permiso para instalar y vuelve a pulsar Actualizar', 6000);
  else if (estado === 'instalar') tostada('Instalando…');
  else tostada(`Bajando la versión nueva… ${pct} %`, 1500);
};
window.permisoAvisos = (ok) => {
  if (!ok) tostada('Sin permiso de notificaciones no te llegan los avisos ni el plan con la app cerrada', 5000);
  else { if (S.D) programar(S.D, S.M); tostada('Notificaciones activadas'); }
  repintarHoja();
};

/* ---------------- la vuelta del inicio de sesión ---------------- */
window.vueltaLogin = async () => {
  const url = nativo.loginPendiente();
  if (!url) return;
  raiz().innerHTML = `<div class="pantalla cargando">${LOGO}<h1 style="font-size:42px">Entrando…</h1></div>`;
  try {
    await terminarLogin(url);
    LS.del('demo');
    S.D = null;
    await cargar();
  } catch (e) {
    pantallaEntrar(e.message || String(e));
  }
};

/* ---------------- toques ---------------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion],[data-ir],[data-j],[data-r],[data-seg],[data-filtro],[data-abrir],[data-sugerencia]');
  if (!el) return;
  const d = el.dataset;
  if (d.abrir) { ev.preventDefault(); nativo.abrir(d.abrir); return; }
  if (d.sugerencia) { enviarPregunta(d.sugerencia); return; }
  if (d.seg) { const [v, s] = d.seg.split(':'); S.seg[v] = s; if (!d.ir) { pintar(); return; } }
  if (d.filtro) { const [k, f] = d.filtro.split(':'); S.filtro[k] = f; pintar(); return; }
  if (d.j && S.D && !d.accion) { hoja('j', d.j); cargarDetalle(d.j); return; }
  if (d.r && S.D) { hoja('r', d.r); return; }
  if (d.ir && !d.accion) { cerrarHoja(); ir(d.ir); return; }
  switch (d.accion) {
    case 'entrar': try { await empezarLogin(); } catch (e) { pantallaEntrar(e.message); } break;
    case 'entrarDemo': cerrarHoja(true); LS.set('demo', true); S.D = null; S.planEstado = {}; cargar(); break;
    case 'salirDemo':
      cerrarHoja(true); LS.del('demo'); S.D = null; S.planEstado = {};
      if (!enApp) { LS.set('demo', true); tostada('Fuera de la app solo se puede ver el ejemplo'); cargar(); }
      else if (haySesion()) { S.D = foto(); if (S.D) { rehacer(); pintar(); cargar({ silencio: true }); } else cargar(); }
      else pantallaEntrar();
      break;
    case 'salir': if (confirm('¿Cerrar la sesión de LaLiga en esta app?')) { cerrarSesion(); cerrarHoja(true); S.D = null; programar(null, null); pantallaEntrar(); } break;
    case 'recargar': S.planEstado = {}; cargar(); break;
    case 'ajustes': hoja('ajustes'); break;
    case 'diag': hoja('diag'); break;
    case 'cerrarHoja': cerrarHoja(); break;
    case 'irIA': cerrarHoja(); ir('ia'); break;
    case 'copiarDiag': nativo.copiar(Hj.textoDiagnostico(S)); tostada('Copiado'); break;
    case 'compartirDiag': nativo.compartir(Hj.textoDiagnostico(S)); break;
    case 'plan': S.planEstado = {}; generarPlan(); break;
    case 'planYa': cerrarHoja(); ir('hoy'); S.planEstado = {}; generarPlan(); break;
    case 'voz': escuchar(); break;
    case 'pararPlan': if (S.planCtl) S.planCtl.abort(); break;
    case 'pararChat': if (S.chatCtl) S.chatCtl.abort(); break;
    case 'resumen': if (S.D) { hoja('resumen'); encuadrar(S.hoja); valoresMios(); } break;
    case 'novedades': listaVersiones(); break;
    case 'presentacion': cerrarHoja(true); verNovedades((NOVEDADES[1] || {}).v || null); break;
    case 'borrarNota': borrarNota(d.id); tostada('Olvidado'); if (S.hoja) repintarHoja(); else pintar(); break;
    case 'guardarDicho': {
      // lo que te ha dicho un rival que tiene (en millones; si escribe en euros, se entiende igual)
      const leer = (id) => { const x = parseFloat(String(($(id) || {}).value || '').replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(x) ? (Math.abs(x) >= 10000 ? x : x * 1e6) : null; };
      let a = leer('#dichoMin'), b = leer('#dichoMax');
      if (a == null && b == null) { tostada('Pon cuánto te ha dicho que tiene'); break; }
      if (a == null) a = b; if (b == null) b = a;
      if (a > b) [a, b] = [b, a];
      const cu = S.M && S.M.dineroCuenta ? S.M.dineroCuenta(d.tid) : null;
      const todos = LS.get(K('dinero-dicho'), {});
      todos[d.tid] = { v: Math.round((a + b) / 2), r: Math.round((b - a) / 2), min: Math.round(a), max: Math.round(b), t: Date.now(), est: cu && cu.v != null ? Math.round(cu.v) : null };
      LS.set(K('dinero-dicho'), todos);
      rehacer(); repintarHoja(); pintar();
      tostada(cu && cu.v != null ? `Apuntado. La cuenta daba ${eur(cu.v)}: ${eur(todos[d.tid].v - cu.v, { signo: true })} de diferencia` : 'Apuntado');
      break;
    }
    case 'borrarDicho': {
      const todos = LS.get(K('dinero-dicho'), {});
      delete todos[d.tid];
      LS.set(K('dinero-dicho'), todos);
      rehacer(); repintarHoja(); pintar();
      tostada('Olvidado: vuelve a salir de la cuenta');
      break;
    }
    case 'rango': S.rango = +d.n; pintarGraf(d.pid); break;
    case 'hecho': {
      const P = S.plan; if (!P) break;
      const todos = LS.get('hechos', {});
      const clave = V.claveHechos(P);
      const l = new Set((todos[clave] || {}).n || []);
      const n = +d.n;
      if (l.has(n)) l.delete(n); else l.add(n);
      todos[clave] = { t: Date.now(), n: [...l] };
      // solo los de la última semana
      for (const k of Object.keys(todos)) if (!todos[k] || Date.now() - (todos[k].t || 0) > 7 * 86400e3) delete todos[k];
      LS.set('hechos', todos);
      if (apuntarReventa()) rehacer();
      pintar();
      break;
    }
    case 'guardarClave': {
      const k = ($('#claveIA') || {}).value || '';
      if (!k.trim()) { tostada('Pega la clave primero'); break; }
      el.disabled = true; el.textContent = 'Probando…';
      try {
        guardarClave(k);
        const lista = await probarClave(k).catch((e) => { guardarClave(''); throw e; });
        tostada(`Clave guardada: ${lista.length} modelos disponibles`);
        ir('hoy');
        S.planEstado = {};
        generarPlan();
      } catch (e) { tostada(e.message, 7000); el.disabled = false; el.textContent = 'Guardar y hacer el plan'; }
      break;
    }
    case 'borrarClave': if (confirm('¿Quitar la clave de Gemini?')) { guardarClave(''); rehacer(); repintarHoja(); pintar(); } break;
    case 'probarIA': try { const l = await probarClave(); tostada(`${l.length} modelos disponibles con tu clave`); } catch (e) { tostada(e.message, 6000); } repintarHoja(); break;
    case 'iaWeb': guardarCfgIA({ web: !cfgIA().web }); repintarHoja(); break;
    case 'iaAuto': guardarCfgIA({ auto: !cfgIA().auto }); repintarHoja(); break;
    case 'fondo': {
      const on = !cfgFondo().on;
      guardarCfgFondo({ on });
      programarFondo();
      if (on && enApp && !nativo.avisosPermitidos()) nativo.pedirPermisoAvisos();
      repintarHoja();
      break;
    }
    case 'avisos': {
      const on = !cfgAvisos().on;
      guardarCfgAvisos({ on });
      if (on && enApp && !nativo.avisosPermitidos()) nativo.pedirPermisoAvisos();
      if (S.D) programar(S.D, S.M);
      repintarHoja();
      break;
    }
    case 'avisoTipo': guardarCfgAvisos({ [d.k]: !cfgAvisos()[d.k] }); if (S.D) programar(S.D, S.M); repintarHoja(); break;
    case 'exactas': nativo.pedirAlarmasExactas(); break;
    case 'probarAviso': if (enApp) { nativo.notificar('Así te llegarán los avisos', 'Por ejemplo: «Ya puedes clausular a Pedri: 74,2 M a Sergio».', 'rivales'); tostada('Mira las notificaciones'); } else tostada('Los avisos solo funcionan en la app'); break;
    case 'buscarVersion': buscarVersion(true); break;
    case 'actualizarApp': if (S.nueva) { nativo.actualizar(S.nueva.apk); tostada('Bajando la versión nueva…'); } break;
    case 'borrarDatos': if (confirm('¿Borrar el histórico, las fichas y los planes guardados? Se vuelven a llenar solos.')) { borrarTodo(); cerrarHoja(true); S.D = null; S.det = {}; cargar(); } break;
    case 'borrarChat': borrarConversacion(); pintar(); break;
    case 'nuevoChat':
      if (S.charlando) { tostada('Espera a que conteste o para la respuesta'); break; }
      if (nuevoChat()) tostada('Chat guardado en «anteriores»');
      S.borrador = '';
      pintar({ arriba: true });
      break;
    case 'chatsViejos': hoja('chats'); break;
    case 'recuperarChat':
      if (S.charlando) { tostada('Espera a que conteste o para la respuesta'); break; }
      if (recuperarChat(+d.i)) { cerrarHoja(true); pintar(); bajarChat(); }
      break;
    case 'borrarChatViejo': borrarChatAnterior(+d.i); if (chatsAnteriores().length) repintarHoja(); else { cerrarHoja(true); pintar(); } break;
    case 'copiarMsg': { const m = conversacion()[+d.i]; if (m) { nativo.copiar(String(m.t || '').replace(/\n> Ojo:[\s\S]*$/, '').trim()); tostada('Copiado'); } break; }
    case 'reventa': {
      const r = reventa();
      if (r[d.pid]) delete r[d.pid]; else r[d.pid] = { t: Date.now(), precio: (S.M.mias.find((x) => x.pid === d.pid) || {}).compra || S.M.J(d.pid).valor };
      LS.set(K('reventa'), r);
      rehacer(); repintarHoja(); pintar();
      tostada(r[d.pid] ? 'Apuntado para revender: te diré cuándo venderlo' : 'Ya no está marcado para revender');
      break;
    }
    case 'enviar': { const ta = $('#pregunta'); if (ta) { const t = ta.value; ta.value = ''; enviarPregunta(t); } break; }
    case 'preguntarJ': { const j = S.M.J(d.pid); cerrarHoja(true); enviarPregunta(`¿Qué hago con ${j.nombre}? Dime si comprarlo, venderlo, clausularlo o esperar, cuánto pagar como mucho y por qué.`); break; }
    default: break;
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-cambia]');
  if (!el) return;
  const k = el.dataset.cambia, v = el.value;
  if (k === 'deuda') { guardarCfg({ deuda: +v }); rehacer(); pintar(); repintarHoja(); }
  if (k === 'liga') { guardarCfg({ ligaId: v, miEquipo: null }); cerrarHoja(true); S.D = null; cargar(); }
  if (k === 'miEquipo') { guardarCfg({ miEquipo: v || null }); cerrarHoja(true); cargar(); }
  if (k === 'modelo') guardarCfgIA({ modelo: v });
  if (k === 'horaAviso') { guardarCfgAvisos({ hora: v }); if (S.D) programar(S.D, S.M); }
  if (k === 'interes') { guardarCfgAvisos({ interes: +v }); if (S.D) programar(S.D, S.M); repintarHoja(); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target && ev.target.id === 'pregunta') { ev.preventDefault(); const t = ev.target.value; ev.target.value = ''; enviarPregunta(t); }
});
document.addEventListener('input', (ev) => {
  if (ev.target && ev.target.id === 'pregunta') { ev.target.style.height = 'auto'; ev.target.style.height = Math.min(120, ev.target.scrollHeight) + 'px'; }
});
window.addEventListener('hashchange', () => { const v = ALIAS[location.hash.slice(1)] || location.hash.slice(1); if (S.D && VISTAS[v] && v !== S.vista) ir(v); });

/* ---------------- lo nuevo de esta versión ---------------- */
/** la última versión que viste (la numeración cambió en la 0.1.0: lo de antes se traduce) */
function versionVista() {
  const v = LS.get('version-vista2', null);
  if (v) return v;
  const vieja = LS.get('version-vista', null);
  return vieja ? deNumeracionVieja(vieja) || '0.0.1' : null;
}
/** al estrenar versión, las novedades contadas bajando; la primera vez que se instala, nada */
function novedades() {
  const vista = versionVista();
  LS.set('version-vista2', VERSION);
  if (!vista || cmpVer(vista, VERSION) >= 0) return;
  verNovedades(vista);
}
function verNovedades(desde) {
  presentarNovedades(desde, {
    alIr: (a) => { if (!a || !S.D) return; if (a.seg) { const [v, sg] = a.seg.split(':'); S.seg[v] = sg; } ir(a.v); },
    alLista: () => listaVersiones(),
  });
}
function listaVersiones() {
  abrirHoja(`<div class="hoja-cab"><h2>Novedades</h2><button class="b-ico" data-accion="cerrarHoja">${icono('cerrar')}</button></div>
    <button class="btn chico" data-accion="presentacion" style="margin:0 0 6px">${icono('ia')}Ver la ${VERSION.replace(/\.0$/, '')} en presentación</button>${listaNovedades()}`);
}

/* ---------------- arranque ---------------- */
async function arrancar() {
  const h = ALIAS[location.hash.slice(1)] || location.hash.slice(1);
  if (VISTAS[h]) S.vista = h;
  if (enApp && !enDemo() && !haySesion()) {
    pantallaEntrar();
  } else {
    S.D = foto();
    if (S.D) {
      rehacer();
      pintar();
      if (Date.now() - S.D.t > 10 * MIN) cargar({ silencio: true }); else despues();
    } else {
      await cargar();
    }
  }
  // por si la vuelta del inicio de sesión llegó antes de que la web estuviera lista
  if (enApp) setTimeout(() => window.vueltaLogin(), 300);
  novedades();
  setTimeout(() => buscarVersion(false), 4000);
  // la IA con la app cerrada avisa con notificaciones: se pide el permiso una vez
  if (enApp && !enDemo() && haySesion() && cfgFondo().on && !nativo.avisosPermitidos() && !LS.get('permiso-fondo')) {
    LS.set('permiso-fondo', Date.now());
    setTimeout(() => nativo.pedirPermisoAvisos(), 2500);
  }
  // cada minuto se recalculan las cuentas atrás, si no estás tocando nada
  let toqueT = 0;
  for (const e of ['touchstart', 'scroll', 'keydown']) window.addEventListener(e, () => { toqueT = Date.now(); }, { passive: true });
  setInterval(() => {
    if (!S.D || S.hoja || S.cargando || S.charlando || S.planEstado.cargando || S.vista === 'ia' || document.visibilityState !== 'visible' || Date.now() - toqueT < 30e3) return;
    const y = window.scrollY;
    const ap = S.M && S.M.aprende;
    S.M = analizar(S.D, S.H, S.c, extraM());
    S.M.aprende = ap;
    montarPlan();
    pintar();
    window.scrollTo(0, y);
  }, 60e3);
}

if (EN_FONDO) trabajoFondo(); else arrancar();
