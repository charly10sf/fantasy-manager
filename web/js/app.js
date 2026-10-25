/* Fantasy Manager: arranque, navegación, carga de datos, el plan del día y todo lo que pasa al tocar algo. */
import { esc, icono, LOGO, LOGO_P, LOGO_D, $, $$, LS, eur, rel, MIN, diaDe, enParalelo, cuando as cuandoT, horaDe } from './util.js';
import { enApp, enWeb, nativo, http, guardar, WORKER, WORKER_PUBLICO } from './puente.js';
import { haySesion, empezarLogin, terminarLogin, cerrarSesion, sesion } from './auth.js';
import { actualizar, foto, historico, cfg, guardarCfg, enDemo, pasosCarga, borrarTodo, completar, detalles, K, fuentesExternas, fuentesGuardadas, actHist } from './datos.js';
import { aprender, calibracion } from './aprende.js';
import { analizar, planAuto } from './motor.js';
import * as V from './vistas.js';
import * as Hj from './hojas.js';
import * as Dr from './directo.js';
import * as Cl from './clubes.js';
import { programar, cfgAvisos, guardarCfgAvisos } from './avisos.js';
import { planDelDia, planViejo, ultimoPlan, cuadrarPlan, charlar, guardarClave, probarClave, guardarCfgIA, cfgIA, borrarConversacion, hayClave, clave, intentosIA, borrarNota, quitarUltimaPregunta, notasVigentes, nuevoChat, recuperarChat, borrarChatAnterior, conversacion, chatsAnteriores } from './ia.js';
import { ultimaVersion, api } from './api.js';
import { detalleJugador, lista as listaN } from './normalizar.js';
import { linea } from './graficos.js';
import { md } from './texto.js';
import { ponerEquipos, BLOQUEO, fijarMotor } from './comunes.js';
import { encuadrar } from './caras.js';
import { historialValor, alineaciones, faltaOnce, jugadasSofa, noticiasClub } from './externas.js';
import { enVivo, onceRival, jornadaStats, idsOnce, formaOnce } from './vivo.js';
import { jornadaElegida, estadoJornada } from './jornadas.js';
import { VERSION, NOVEDADES, cmpVer, deNumeracionVieja } from './version.js';
import { iniciarLimite, mirarLimite, estadoLimite, versionNueva, fijarYo, fijarJornada, bloqueada, topConAnuncio, anuncioTopVisto, abrirTopGratis, abiertaHasta, usosQuedan, proximoCierreTop } from './limite.js';
import { AISTUDIO, limpiarClave, pareceClave, marcarAIStudio, vieneDeAIStudio, aPegar, leerCasilla } from './clave.js';
import { prepararArchivo, prepararB64, leerFoto, MAX_FOTOS, capturaArchivo, capturaB64 } from './fotos.js';
import { explicarError, bandaError, botonesError, apuntarError } from './errores.js';
import { misAvisos, mandarAviso, marcarVisto, todosAvisos, unAviso, capturaAviso, responderAviso, fijarPendientes, numeroAvisos, hayQueMirar, avisosGuardados, saludar, quienUsa } from './soporte.js';
import { presentarNovedades, cerrarPresentacion, listaNovedades, fijarFiltroNovedades, hayNovedadesDesde, versionesDesde } from './presentacion.js';
import { empezarTour, cerrarTour, tourAbierto, tourVisto } from './tour.js';
import { EN_FONDO, cfgFondo, guardarCfgFondo, deNoche, callado, avisoPlan, avisosNuevos, sinAvisar, marcarVistos } from './fondo.js';

const S = { D: null, H: null, M: null, c: cfg(), det: {}, plan: null, planEstado: {}, opPorPid: {}, vista: 'hoy', seg: {}, filtro: {}, cargando: false, hoja: null, tipoHoja: null, charlando: false, parcial: '', pasoChat: '', nueva: null, adjuntos: [], fotosActuales: [], preparandoFotos: 0 };
window.S = S;
const VISTAS = { hoy: V.hoy, equipo: V.equipo, directo: Dr.directo, rivales: V.rivales, mercado: V.mercado, clubes: Cl.clubes, ia: V.ia };
const ALIAS = { inicio: 'hoy', analisis: 'ia', chat: 'ia', vivo: 'directo', equipos: 'clubes' };
const NAV = [['hoy', 'rayo', 'Hoy'], ['equipo', 'equipo', 'Equipo'], ['directo', 'directo', 'Directo'], ['rivales', 'rivales', 'Rivales'], ['mercado', 'mercado', 'Mercado'], ['clubes', 'club', 'Clubes'], ['ia', 'ia', 'Pregunta']];
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
  ponerBanner(false);
  raiz().innerHTML = `<div class="pantalla"><div class="pant-i">${LOGO}
    <h1>Fantasy<br><span>Manager</span></h1>
    ${enWebVieja ? '<a class="aviso-mudanza" href="https://fantasymanagerapp.com/">La web ahora está en <b>fantasymanagerapp.com</b> →</a>' : ''}
    ${enApp ? '' : avisoMovilHTML()}
    <p>Cada día, las operaciones exactas para tu liga de LaLiga Fantasy: a quién vender, a quién comprar, cuánto pujar y a quién clausular.</p>
    <ul class="lista-ok">
      <li>${icono('rayo')}Plan del día paso a paso, con el saldo después de cada operación</li>
      <li>${icono('ia')}La IA lee lesiones, convocatorias, alineaciones y el calendario antes de decidir</li>
      <li>${icono('diana')}Aviso al minuto cuando se abre una cláusula que te interesa</li>
      <li>${icono('rivales')}Lo que hace cada rival y quién va a por tus jugadores</li>
    </ul></div><div class="pant-d">
    ${error ? `<div class="error-c" style="margin:0 0 16px">${esc(error)}</div>` : ''}
    ${enApp ? `<button class="btn ancho" data-accion="entrar">${icono('usuario')}Entrar con mi cuenta de LaLiga</button>
    <p class="peq apag" style="margin-top:12px">Se abre la página oficial de LaLiga: entra como siempre (con Google, si es como lo haces). Si Android pregunta con qué app volver, elige <b>Fantasy Manager</b>.</p>` : entrarWebHTML()}
    <button class="btn sec ancho" data-accion="entrarDemo" style="margin-top:6px">Ver con una liga de ejemplo</button>
    <p class="peq apag" style="margin-top:14px">App no oficial: no es de LaLiga ni tiene relación con LaLiga. <a href="privacidad.html">Privacidad</a></p>
  </div></div>`;
  // en el ordenador, el cursor directamente en el código; en el móvil no (sacaría el teclado tapando lo de arriba)
  if (!enApp && !movilDe()) setTimeout(() => { const i = $('#codigoWeb'); if (i) i.focus(); }, 50);
}
/** desde qué móvil se abre la web: 'android', 'iphone' o null (ordenador) */
function movilDe() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
  return null;
}
/** en el navegador: LaLiga solo devuelve la sesión a su app del móvil, así que se entra con un código de la app */
/** la web abierta desde un móvil: en un Android lo suyo es la app, sin códigos (es lo que más lía a quien abre la web
    desde el enlace); en el iPhone, cómo se entra la primera vez. Va arriba del todo, a la vista sin bajar */
function avisoMovilHTML() {
  const movil = movilDe();
  return movil === 'android'
    ? `<div class="entrar-movil"><b>${icono('descargar')}Estás en un Android: instala la app</b><span>Se instala en un minuto y entras con tu cuenta de LaLiga, sin códigos. Si el móvil avisa de que el archivo puede ser dañino, pulsa «Descargar de todas formas»; luego ábrelo e instálalo.</span><a class="btn ancho" href="https://fantasymanagerapp.com/descargas/fantasy-manager.apk">${icono('descargar')}Bajar la app</a></div>`
    : movil === 'iphone'
      ? `<div class="entrar-movil"><b>${icono('info')}Estás en un iPhone</b><span>La primera vez hay que entrar desde un <b>ordenador</b>: LaLiga no deja hacerlo en el iPhone. En el ordenador abre esta misma web, pulsa «No tengo la app en el móvil» y sigue los pasos. Ya dentro, en <b>Ajustes → Abrir en otro dispositivo</b> te da un código: escríbelo aquí abajo. Solo se hace una vez.</span></div>`
      : '';
}
function entrarWebHTML() {
  return `${movilDe() === 'android' ? '<p class="entrar-o">¿Ya tienes la app y quieres usar también la web? Entra con un código:</p>' : ''}<div class="entrar-codigo">
      <b>${icono('usuario')}Entra con el código de la app</b>
      <span>En la app del móvil: <b>Ajustes → Abrir en el ordenador</b>. O, si ya has entrado en la web de un ordenador: <b>Ajustes → Abrir en otro dispositivo</b>. Te da un código de 8 letras y números que dura 10 minutos.</span>
      <div class="codigo-in"><input id="codigoWeb" maxlength="9" placeholder="ABCD2345" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="usarCodigo"><button class="btn" data-accion="usarCodigo">Entrar</button></div>
    </div>
    <details class="sin-app"><summary>No tengo la app en el móvil</summary>
      <p>LaLiga devuelve la sesión a su app del móvil, no a una web. Desde un ordenador se puede copiar a mano. <b>¿Tienes iPhone?</b> Hazlo una vez en un ordenador y, ya dentro, saca en <b>Ajustes → Abrir en otro dispositivo</b> un código para escribirlo aquí en el iPhone.</p>
      <ol>
        <li>Pulsa <b>Abrir la página de LaLiga</b>: se abre en otra pestaña.</li>
        <li>En esa pestaña, antes de entrar, abre las herramientas del navegador (<b>F12</b>), ve a <b>Red</b> y marca <b>Conservar registro</b>.</li>
        <li>Entra como siempre. Al acabar la página se queda en blanco: es lo normal.</li>
        <li>En <b>Red</b>, la última fila (cancelada) empieza por <b>?state=…&amp;code=…</b>: botón derecho → <b>Copiar → Copiar dirección del enlace</b>.</li>
        <li>Pégala aquí debajo y pulsa Entrar.</li>
      </ol>
      <button class="btn chico sec" data-accion="entrar">Abrir la página de LaLiga</button>
      <textarea id="vueltaWeb" rows="3" placeholder="authredirect://com.lfp.laligafantasy/?state=…&amp;code=…" spellcheck="false"></textarea>
      <button class="btn chico" data-accion="pegarVuelta">Entrar</button>
    </details>`;
}
/** lo que manda la app con el código: la sesión, tu liga y tu equipo, la clave de la IA y el dinero que te han dicho */
function traerVinculo(j) {
  LS.del('demo');
  guardar('sesion', j.sesion);
  if (j.cfg) guardarCfg({ ligaId: j.cfg.ligaId || null });
  if (j.ia && j.ia.clave && !hayClave()) guardarClave(j.ia.clave);
  if (j.dichos && typeof j.dichos === 'object') LS.set(K('dinero-dicho'), { ...j.dichos, ...LS.get(K('dinero-dicho'), {}) });
}
/* ---------------- la mudanza de la web: de charly10sf.github.io a fantasymanagerapp.com ----------------
   La web de antes (GitHub Pages) sigue sirviendo la misma web unas semanas, con una banda arriba para irse a la nueva
   con la sesión, la liga y la clave de la IA: un código de un solo uso, como el de abrir en otro dispositivo, que va
   en la dirección detrás de # (no llega a ningún servidor). Lo guardado en el navegador (histórico, notas) se queda. */
const DOMINIO = 'https://fantasymanagerapp.com/';
const enWebVieja = !enApp && typeof location !== 'undefined' && location.hostname === 'charly10sf.github.io';
async function mudarse(el) {
  if (!haySesion() || enDemo()) { location.href = DOMINIO; return; }
  if (el) { el.disabled = true; el.textContent = 'Preparando…'; }
  try {
    const c = cfg();
    // también el tutorial y la última versión vista, para que en la nueva no le salgan otra vez
    const datos = { sesion: sesion(), cfg: { ligaId: c.ligaId || null }, ia: hayClave() ? { clave: clave() } : null, dichos: LS.get(K('dinero-dicho'), {}), tour: LS.get('tour', null), vista: versionVista() };
    const r = await fetch(`${WORKER_PUBLICO}/vincular`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.codigo) throw new Error((j && j.e) || `el servidor responde ${r.status}`);
    location.href = `${DOMINIO}#codigo=${encodeURIComponent(j.codigo)}`;
  } catch (e) {
    tostada(`No se ha podido preparar la mudanza (${e.message}). Entra en fantasymanagerapp.com con el código de Ajustes → Abrir en otro dispositivo.`, 9000);
    if (el) { el.disabled = false; el.textContent = 'Llevarme'; }
  }
}
/** en la web nueva: si viene de la de antes con un código, entra con él sin volver a hacer nada */
async function codigoDeMudanza() {
  const m = !enApp && location.hash.match(/^#codigo=([A-Za-z0-9]{8})$/);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const r = await fetch(`${WORKER}/vincular/usar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codigo: m[1].toUpperCase() }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.sesion) throw new Error((j && j.e) || `el servidor responde ${r.status}`);
    traerVinculo(j);
    if (j.tour && !tourVisto()) LS.set('tour', j.tour);
    if (typeof j.vista === 'string' && !LS.get('version-vista2', null)) LS.set('version-vista2', j.vista);
    return true;
  } catch (e) {
    setTimeout(() => tostada(`No se ha podido traer tu cuenta (${e.message}). Saca un código en la web de antes: Ajustes → Abrir en otro dispositivo.`, 9000), 1500);
    return false;
  }
}
const bandaMudanza = () => (enWebVieja ? `<div class="banda">${icono('descargar')}<span>La web se ha mudado a <b>fantasymanagerapp.com</b>: llévate tu cuenta en un toque</span><button data-accion="mudarse">Llevarme</button></div>` : '');

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
/**
 * la pantalla de carga: la camiseta se va llenando de rojo según avanza, con la lista de pasos (debajo en el
 * móvil, al lado en el ordenador). Solo sale cuando no hay nada guardado; si lo hay, la app se abre con eso y se
 * pone al día por detrás. index.html trae la de arranque (el logo y «Abriendo…»), sin contador de pasos.
 */
const camisetaCarga = (f) => `<svg class="cc" viewBox="6 10 188 188" aria-hidden="true">
  <defs><clipPath id="ccClip"><path d="${LOGO_D.camiseta}"/></clipPath></defs>
  <path class="cc-vacia" d="${LOGO_D.camiseta}"/>
  <g clip-path="url(#ccClip)"><g class="cc-llena" style="transform:translateY(${Math.round(190 - 168 * f)}px)"><path class="cc-ola" d="M-200 0q12.5-5 25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0V220H-200Z"/></g></g>
  <path d="${LOGO_D.punos}" fill="#fff"/><path d="${LOGO_D.cuello}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="${LOGO_D.letras}" fill="#fff"/>
</svg>`;
const pctCarga = (paso, total) => Math.max(4, Math.min(100, Math.round(((paso + 0.5) / total) * 100)));
const tituloCarga = (liga, error) => (error ? esc(error.titulo || 'No se ha podido cargar') : `Poniendo al día <span>${liga && liga.nombre ? esc(liga.nombre) : 'tu liga'}</span>`);
/** la lista de pasos: hechos (✓), el de ahora (girando, con los segundos si tarda) y los que faltan */
const pasosHTML = (paso) => pasosCarga.map((t, i) => {
  const e = i < paso ? 'ok' : i === paso ? 'ya' : '';
  return `<li class="${e}">${e === 'ok' ? icono('ok') : '<i></i>'}<span>${esc(t)}</span><small></small></li>`;
}).join('');
// cuándo empezó el paso de ahora, para contar los segundos si se atasca
let pasoAhora = -1, pasoDesde = 0, relojCarga = null;
function cargaHTML(paso, error, liga) {
  const total = pasosCarga.length;
  const pct = error ? 0 : pctCarga(paso, total);
  return `<div class="carga ${error ? 'mal' : ''}">
    <div class="carga-in">
      <div class="carga-izq">
        ${camisetaCarga(pct / 100)}
        <div class="carga-wm">Fantasy <b>Manager</b></div>
        <h1 class="carga-t">${tituloCarga(liga, error)}</h1>
        ${error ? '' : `<div class="carga-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><div class="carga-pct"><span>${Math.max(0, Math.min(paso + 1, total))} de ${total}</span><b>${pct} %</b></div>`}
      </div>
      <div class="carga-der">
        ${error ? `<div class="fallo"><p>${esc(error.texto)}</p>${error.detalle && error.detalle !== error.texto ? `<p class="fallo-det">${esc(error.detalle)}</p>` : ''}</div>
          <div class="carga-btns">${botonesError(error, icono)}</div>`
          : `<ol class="carga-pasos">${pasosHTML(paso)}</ol>
          <div class="carga-consejo"><span class="et">${icono('info')}¿Sabías que…?</span><p id="cConsejo">${esc(CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)])}</p></div>`}
      </div>
    </div>
  </div>`;
}
function pantallaCarga(paso = -1, error = null) {
  ponerBanner(false);
  const total = pasosCarga.length;
  const el = $('.carga');
  const liga = (foto() || {}).liga;
  if (paso !== pasoAhora) { pasoAhora = paso; pasoDesde = Date.now(); }
  // si ya está en pantalla, solo se mueve lo que cambia: la camiseta se llena suave
  if (el && !error && $('.carga-pasos', el)) {
    const pct = pctCarga(paso, total);
    $('.cc-llena', el).style.transform = `translateY(${Math.round(190 - 168 * (pct / 100))}px)`;
    $('.carga-barra i', el).style.width = `${pct}%`;
    $('.carga-barra', el).setAttribute('aria-valuenow', pct);
    $('.carga-pct span', el).textContent = `${Math.max(0, Math.min(paso + 1, total))} de ${total}`;
    $('.carga-pct b', el).textContent = `${pct} %`;
    $('.carga-pasos', el).innerHTML = pasosHTML(paso);
    $('.carga-t', el).innerHTML = tituloCarga(liga, null);
    return;
  }
  // la primera vez (o desde la pantalla de arranque de index.html): se pinta entera
  raiz().innerHTML = cargaHTML(paso, error, liga);
  clearInterval(consejoT); consejoT = null;
  clearInterval(relojCarga); relojCarga = null;
  if (!error) {
    rotarConsejos();
    // si un paso tarda, se ven los segundos: así se sabe que sigue trabajando
    relojCarga = setInterval(() => {
      const li = $('.carga-pasos li.ya small');
      if (!li) { clearInterval(relojCarga); relojCarga = null; return; }
      const sg = Math.round((Date.now() - pasoDesde) / 1000);
      li.textContent = sg >= 3 ? `${sg} s` : '';
    }, 1000);
  }
}
function rotarConsejos() {
  let k = Math.floor(Math.random() * CONSEJOS.length);
  const c0 = $('#cConsejo');
  if (c0 && !c0.textContent.trim()) c0.textContent = CONSEJOS[k];
  consejoT = setInterval(() => {
    const c = $('#cConsejo');
    if (!c) { clearInterval(consejoT); consejoT = null; return; }
    c.classList.add('sale');
    setTimeout(() => { k = (k + 1) % CONSEJOS.length; c.textContent = CONSEJOS[k]; c.classList.remove('sale'); }, 350);
  }, 4200);
}

/* ---------------- el marco ---------------- */
function marco() {
  // en el ordenador las pestañas van dentro del banquillo (la columna de la izquierda), entre la liga y los botones
  const anchoYa = V.ancho();
  if ($('#vista') && S.marcoAncho === anchoYa) return;
  S.marcoAncho = anchoYa;
  const nav = `<nav class="nav"><div class="nav-in">${NAV.map(([k, ic, t]) => `<button data-ir="${k}">${icono(ic)}${t}<span class="gl oculto" id="gl-${k}"></span></button>`).join('')}</div></nav>`;
  // arriba solo tres cosas: actualizar la liga (si el plan se ha quedado viejo, la IA lo rehace sola después), avisar
  // de un fallo y los ajustes. Rehacer el plan a mano está en la tarjeta del plan, en Hoy.
  // en el móvil cada botón lleva su nombre debajo (data-et); en el ordenador, el largo (aria-label) al lado
  const botones = `<div class="sup-btns"><button class="b-ico" id="bRefrescar" data-accion="recargar" aria-label="Actualizar la liga" title="Traer lo último de LaLiga (saldo, mercado, pujas)" data-et="Actualizar">${icono('refrescar')}</button>
    <button class="b-ico" id="bAvisos" data-accion="avisos" aria-label="Avisar de un fallo" data-et="Fallo">${icono('bicho')}<span class="gl oculto" id="gl-avisos"></span></button>
    <button class="b-ico" data-accion="ajustes" aria-label="Ajustes" data-et="Ajustes">${icono('ajustes')}</button></div>`;
  const liga = `${LOGO_P}<div class="sup-liga"><button id="supLiga" class="sup-nombre" data-accion="ligas" disabled></button><span id="supEstado"></span><span id="supQueda" class="sup-queda" hidden></span></div>`;
  raiz().innerHTML = anchoYa
    ? `<header class="sup">${liga}${nav}${botones}</header><main><div id="banda"></div><div id="vista" class="vista"></div></main>`
    : `<header class="sup">${liga}${botones}</header><main><div id="banda"></div><div id="vista" class="vista"></div></main>${nav}`;
}
/** el ordenador: la clase en <html> para el CSS y, al pasar de un tamaño a otro, todo se vuelve a pintar */
function ponerTamano() { document.documentElement.classList.toggle('escritorio', V.ancho()); }
ponerTamano();
let tamanoT = null;
window.addEventListener('resize', () => {
  clearTimeout(tamanoT);
  tamanoT = setTimeout(() => {
    const antes = document.documentElement.classList.contains('escritorio');
    ponerTamano();
    if (antes !== V.ancho() && S.D && $('#vista')) pintar();
  }, 150);
});
function pintarSup() {
  const { D } = S;
  const varias = !!(D && D.ligas && D.ligas.length > 1);
  const sl = $('#supLiga');
  sl.innerHTML = `<b>${esc(D ? D.liga.nombre : 'Fantasy Manager')}</b>${varias ? icono('abajo') : ''}`;
  sl.disabled = !varias;
  sl.setAttribute('aria-label', varias ? `${D.liga.nombre}: cambiar de liga` : (D ? D.liga.nombre : 'Fantasy Manager'));
  const edad = D ? Date.now() - D.t : Infinity;
  const p = S.cargando ? 'vivo' : edad < 30 * MIN ? 'vivo' : edad < 6 * 3600e3 ? 'viejo' : 'mal';
  $('#supEstado').innerHTML = S.errorCarga && D && !S.cargando
    ? `<i class="punto ${edad < 6 * 3600e3 ? 'viejo' : 'mal'}"></i>${S.errorCarga.tipo === 'red' ? 'Sin internet' : 'Sin actualizar'} · ${rel(D.t)}`
    : `<i class="punto ${p}"></i>${S.cargando ? 'Actualizando…' : D ? (edad < MIN ? 'Al día' : `Actualizado ${rel(D.t)}`) : ''}`;
  $('#bRefrescar').classList.toggle('gira', S.cargando);
  pintarNumAvisos();
  const pend = S.plan ? S.plan.ops.filter((o) => o.hoy !== false && !['esperar'].includes(o.accion) && !V.hecho(S, S.plan, o)).length : 0;
  const gh = $('#gl-hoy'); gh.textContent = pend; gh.classList.toggle('oculto', !pend);
  const ga = S.M.mias.filter((x) => x.riesgo === 'alto').length;
  const ge = $('#gl-equipo'); ge.textContent = ga; ge.classList.toggle('oculto', !ga);
  // Directo: un punto verde mientras se juega la jornada
  const gd = $('#gl-directo'); if (gd) { gd.classList.add('punto-v'); gd.classList.toggle('oculto', !S.M.enJuego); }
}
function pintar({ arriba = false } = {}) {
  if (!S.D) return;
  // lo que estás escribiendo (la pregunta, la clave) no se pierde al repintar (llega el plan, se pone al día la liga…)
  const escrito = ['pregunta', 'claveIA'].map((id) => { const el = $(`#${id}`); return el && el.value ? [id, el.value, document.activeElement === el ? el.selectionStart : null] : null; }).filter(Boolean);
  // (el buscador del Mercado guarda lo escrito en S.busca; solo hay que devolverle el cursor)
  const focoBusca = document.activeElement && document.activeElement.id === 'buscaJ' ? document.activeElement.selectionStart : null;
  marco();
  pintarSup();
  medirSup();
  $$('.nav button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === S.vista));
  const v = $('#vista');
  try { v.innerHTML = VISTAS[S.vista](S); } catch (e) {
    console.error(e);
    apuntarError(e.message, `pintar ${S.vista}${e.stack ? ` · ${String(e.stack).split('\n')[1] || ''}` : ''}`);
    v.innerHTML = `<div class="error-c"><b>Algo ha fallado al pintar esta pantalla.</b> Las demás pestañas siguen funcionando. Mándame el fallo y lo arreglo.<div class="fallo-det">${esc(e.message)}</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="mandarFallo">Mandar el fallo</button><button class="btn chico sec" data-accion="recargar">Volver a cargar</button></div></div>`;
  }
  $('#banda').innerHTML = bandaMudanza() + (S.errorCarga && S.D ? `<div class="banda mal">${icono('alerta')}<span>${esc(bandaError(S.errorCarga, rel(S.D.t)))}</span><button data-accion="recargar">Reintentar</button></div>` : '') + (S.nueva ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva (${esc(S.nueva.nombre)})</span><button data-accion="actualizarApp">Actualizar</button></div>` : S.webNuevaWeb ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva de la web (${esc(S.webNuevaWeb.version)})</span><button data-accion="recargarWeb">Recargar</button></div>` : S.webNueva ? `<div class="banda">${icono('descargar')}<span>Versión nueva lista: se pone al volver a abrir la app</span><button data-accion="ponerWeb">Ponerla</button></div>` : '');
  if (arriba) window.scrollTo(0, 0);
  for (const [id, v, cur] of escrito) {
    const el = $(`#${id}`);
    if (!el || el.value) continue;
    el.value = v;
    if (cur != null) { el.focus({ preventScroll: true }); try { el.setSelectionRange(cur, cur); } catch (e) { /* nada */ } }
  }
  if (focoBusca != null) { const el = $('#buscaJ'); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focoBusca, focoBusca); } catch (e) { /* nada */ } } }
  // el chat se lee de abajo arriba; la guía de la clave, de arriba abajo
  if (S.vista === 'ia' && hayClave()) {
    bajarChat();
    // la pregunta que paraste vuelve a la caja
    if (S.borrador && !S.charlando) { const ta = $('#pregunta'); if (ta) { ta.value = S.borrador; S.borrador = ''; } }
  }
  encuadrar(v);
  // en Directo, la clasificación de la jornada dice cuántos le quedan a cada rival: hacen falta sus onces
  if (S.vista === 'directo' && S.M.enJuego && S.M.vivo && (S.seg.directo === 'liga' || V.ancho())) cargarOncesRivales();
  if (S.vista === 'equipo' && S.seg.equipo === 'jornadas') cargarJornadaMia();
  // el cierre hasta la hora de apertura y el límite de minutos, sin esperar a la próxima vuelta del reloj
  mirarLimite();
  // el banner de los anuncios (solo en la versión de Google Play): en las pestañas, nunca en Pregunta
  ponerBanner(S.vista !== 'ia');
}
/* ---------------- anuncios (solo en la versión de Google Play) ---------------- */
let bannerYa = null;
function ponerBanner(si) {
  if (EN_FONDO || !enApp) return;
  // nunca en la pantalla del límite de minutos o la cuenta atrás (Google no deja anuncios en una pantalla sin salida)
  si = !!si && !document.body.classList.contains('limitado');
  if (si === bannerYa) return;
  bannerYa = si;
  nativo.banner(si);
}
window.addEventListener('limite-cambia', () => ponerBanner(!!S.D && !!$('#vista') && S.vista !== 'ia'));
const conAnuncios = () => enApp && !EN_FONDO && nativo.hayAnuncios();
// «Pedir otro plan a la IA»: 3 veces al día gratis; a partir de la 4.ª, viendo un anuncio (solo en la de Google Play)
const PLANES_GRATIS = 3;
const planesHoy = () => { const g = LS.get('planes-mano', null); return g && g.dia === diaDe() ? g.n : 0; };
const contarPlan = () => LS.set('planes-mano', { dia: diaDe(), n: planesHoy() + 1 });
function pedirOtroPlan() {
  if ((S.planEstado || {}).cargando) return;
  // (el primero con IA del día no cuenta: solo cuando ya hay uno de la IA)
  const yaHay = S.plan && !S.plan.auto && S.plan.dia === diaDe();
  if (yaHay && conAnuncios() && planesHoy() >= PLANES_GRATIS) { S.anuncio = { para: 'plan' }; hoja('anuncio', 'plan'); return; }
  if (yaHay) contarPlan();
  S.planEstado = {};
  generarPlan();
}
/** al pasar su hora, lo que se abrió por un rato se vuelve a cerrar en pantalla (también la ficha abierta). Un solo
    temporizador, siempre a la hora más cercana de todo lo abierto; se vuelve a poner al rehacer los datos */
let topT = 0;
function cerrarTopA() {
  clearTimeout(topT);
  const hasta = proximoCierreTop();
  if (!hasta) return;
  topT = setTimeout(() => { if (S.D && S.M) { if (!S.hoja) pintar(); else if (S.tipoHoja && S.tipoHoja[0] !== 'anuncio') repintarHoja(); } cerrarTopA(); }, Math.max(1000, hasta - Date.now() + 500));
}
/** la vuelta del anuncio bonificado (Anuncios.java) */
window.anuncioVisto = (para, visto, motivo) => {
  const sinAnuncio = !visto && /sin anuncio|sin consentimiento|no se pudo/.test(motivo || '');
  // las funciones top (limite.js): las de los rivales, 2 anuncios cada vez y unas veces por jornada; cuándo gira, 1
  if (para === 'top') {
    const clave = S.anuncio && S.anuncio.clave;
    let abierta = false;
    if (visto) abierta = anuncioTopVisto(clave);
    // sin anuncio que enseñar, se abre igual lo que pedía, pero solo media hora
    else if (sinAnuncio) { abrirTopGratis(clave, 30); abierta = true; }
    // con el primero de dos visto, la ventana sigue abierta para el segundo (cada anuncio lo pide él: así lo quiere Google)
    if (visto && !abierta) {
      S.anuncio = { ...(S.anuncio || {}), para, cargando: false, error: null };
      // (sin tostada: la ventana ya dice «Llevas 1 de 2», y la tostada taparía el botón del segundo)
      if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
      return;
    }
    if (abierta) {
      const volver = S.anuncio && S.anuncio.volver;
      S.anuncio = null;
      cerrarHoja();
      pintar();
      // si el candado estaba en una ficha, se vuelve a ella para ver lo que se ha abierto
      if (volver) hoja(volver[0], volver[1]);
      const hasta = abiertaHasta(clave);
      tostada(!visto ? 'No había anuncio ahora: abierta gratis media hora' : hasta ? `Abierta hasta las ${horaDe(hasta)}${usosQuedan(clave) ? '' : ' (era la última vez de esta jornada)'}` : 'Abierta hasta medianoche', 5000);
      cerrarTopA();
      return;
    }
    S.anuncio = { ...(S.anuncio || {}), para, cargando: false, error: 'Para abrirlas hay que ver el anuncio hasta el final.' };
    if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
    return;
  }
  if (para !== 'plan') return;
  if (visto || sinAnuncio) {
    // si no hay anuncio que enseñar, va igual: no es culpa suya
    S.anuncio = null;
    cerrarHoja();
    if (S.vista !== 'hoy') ir('hoy');
    contarPlan();
    S.planEstado = {};
    generarPlan();
    if (sinAnuncio) tostada('No había anuncio ahora: este va gratis');
    return;
  }
  S.anuncio = { para, error: 'Para el plan hay que ver el anuncio hasta el final.' };
  if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
};
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
/** tu equipo de verdad (el de tu cuenta de LaLiga, no el que se elige a mano en Ajustes) */
function yoReal() {
  const yo = S.D && S.D.yo, cl = (S.D && S.D.clasif) || [];
  const real = yo && yo.userId ? cl.find((e) => e.userId === yo.userId || e.managerId === yo.userId) : null;
  const eq = real || (S.M && S.M.yo) || null;
  return eq ? { nombre: eq.nombre, teamId: eq.teamId, userId: yo && yo.userId, ligas: (S.D && S.D.ligas) || [] } : null;
}
function rehacer() {
  S.c = cfg();
  S.H = historico();
  S.det = { ...detalles(), ...S.det };
  ponerEquipos(S.D.equipos);
  S.M = analizar(S.D, S.H, S.c, extraM());
  fijarMotor(S.M);
  // quién eres, para lo bloqueado (antes de pintar nada)
  fijarYo(yoReal(), enDemo());
  fijarJornada(((S.M && (S.M.enJuego || S.M.proxima)) || {}).n);
  cerrarTopA();
  // lo previsto frente a lo que pasó: corrige los puntos esperados de la próxima pasada y lo ve la IA
  aprender(S.D, S.M, S.det);
  montarPlan();
  if (apuntarReventa()) { const ap = S.M.aprende; S.M = analizar(S.D, S.H, S.c, extraM()); S.M.aprende = ap; fijarMotor(S.M); montarPlan(); }
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
  const cierre = (S.M && S.M.cierreMercado) || LS.get('fondo-cierre', 0) || 0;
  let prox = cierre ? cierre + 8 * MIN : 0;
  // con un aviso de fallo esperando respuesta (o, para el dueño, avisos sin contestar) se mira cada 40 minutos, para
  // que la respuesta llegue en una notificación aunque la app esté cerrada
  const a = avisosGuardados();
  if (haySesion() && ((a.lista || []).some((x) => !x.respuesta) || (a.admin && a.pendientes > 0))) {
    const t = Date.now() + 40 * MIN;
    if (!prox || prox < Date.now() || t < prox) prox = t;
  }
  nativo.programarFondo(cfgFondo().on && !enDemo(), prox);
}
/** las respuestas a tus avisos de fallo (y al dueño, los avisos nuevos), como notificaciones: una sola petición */
async function avisosDeFallos() {
  if (!hayQueMirar()) return [];
  let r;
  try { r = await misAvisos(); } catch (e) { if (e.sesion) throw e; return []; }
  const out = r.nuevasResp.slice(0, 3).map((x) => ({ k: `fallo:${x.id}:${x.respondida}`, titulo: `${x.por || 'Fantasy Manager'} te ha contestado`, texto: x.respuesta.length > 300 ? `${x.respuesta.slice(0, 297)}…` : x.respuesta, hash: 'fallos' }));
  if (r.nuevosRecibidos) out.push({ k: `fallos-nuevos:${r.pendientes}:${Date.now()}`, titulo: r.nuevosRecibidos > 1 ? `${r.nuevosRecibidos} avisos de fallos nuevos` : 'Un aviso de fallo nuevo', texto: 'Entra para leerlo y contestar', hash: 'fallos' });
  return out;
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
    // (de madrugada no se miran: se darían por avisadas sin avisar)
    const fallos = callado() ? [] : await avisosDeFallos();
    if (fallos.length) paso(`${fallos.length} aviso${fallos.length > 1 ? 's' : ''} de fallo`);
    const completo = LS.get('fondo-completo', 0), cierre = LS.get('fondo-cierre', 0);
    if (completo && Date.now() - completo < 150 * MIN && Date.now() < cierre) {
      paso('liga mirada hace poco: solo los avisos de fallo');
      if (!callado()) { const nuevos = sinAvisar(fallos); avisar(nuevos); reg.avisos = nuevos.length; }
      reg.ok = true;
      return;
    }
    const antes = foto();
    S.D = await actualizar(() => {});
    rehacer();
    paso('liga al día');
    try { const f = await fuentesExternas(S.D, S.M); if (f) S.fuentes = f; } catch (e) { paso(`onces y noticias: ${e.message}`); }
    try { const det = await completar(S.D, S.M); if (det) S.det = { ...S.det, ...det }; } catch (e) { if (e.sesion) throw e; paso(`fichas: ${e.message}`); }
    rehacer();
    const lista = [...fallos, ...avisosNuevos(antes, S.D, S.M)];
    LS.set('fondo-completo', Date.now()); LS.set('fondo-cierre', (S.M && S.M.cierreMercado) || 0);
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
  return { det: S.det, reventa: reventa(), onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, vivo: vivoGuardado(), calib: calibracion(), actHist: S.D && S.D.liga ? actHist(S.D.liga.id) : null, notas: notasVigentes(), dichos: LS.get(K('dinero-dicho'), {}) };
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

/* cambiar de liga, entrar o salir de la demo mientras se carga la liga guardaría lo de una con las claves de la
   otra: se hace al terminar la carga en marcha */
function trasCargar(f) {
  if (!S.cargando) return false;
  S.pendiente = f;
  tostada('Un momento: termino de cargar y cambio');
  return true;
}
async function cargar(op = {}) {
  try { await cargar0(op); } finally {
    const f = S.pendiente;
    if (f && !S.cargando) { S.pendiente = null; setTimeout(f, 0); }
  }
}
async function cargar0({ silencio = false } = {}) {
  if (S.cargando) return;
  S.cargando = true;
  const conPantalla = !S.D;
  if (conPantalla) pantallaCarga(0); else if ($('#vista')) pintarSup();
  try {
    S.D = await actualizar((i) => { if (conPantalla) pantallaCarga(i); });
    S.errorCarga = null;
    rehacer();
    S.cargando = false;
    pintar();
    // la primera vez: el tutorial, que recorre la app para saber dónde está cada cosa
    if (conPantalla) quizaTutorial(900);
    if (!silencio && !conPantalla) tostada(V.cambiosDesdePlan(S) ? 'Datos de LaLiga al día. Tu liga ha cambiado: mira el plan' : 'Datos de LaLiga al día');
    despues();
  } catch (e) {
    S.cargando = false;
    console.error(e);
    if (e.sesion) { S.D = null; pantallaEntrar(e.message); return; }
    // ha entrado con su cuenta pero no le carga la liga: que el dueño lo vea en «Quién usa la app»
    if (!enDemo() && haySesion() && !document.hidden) saludar({ v: `${VERSION} !`, canal: enApp ? nativo.canal() : 'web', app: enApp ? nativo.version() : 0, liga: '', equipo: '' });
    const x = { ...explicarError(e), detalle: e.message || String(e), t: Date.now() };
    S.errorCarga = x;
    // sin poder cargar, pero con la liga guardada de antes: se enseña esa, avisando de que no está al día
    const guardada = conPantalla && x.tipo !== 'sinLigas' ? foto() : null;
    if (guardada) { S.D = guardada; rehacer(); pintar(); return; }
    if (conPantalla) pantallaCarga(-1, x);
    else pintar();
  }
}

/** lo que va después de cargar, sin bloquear: las fichas de los jugadores (forma y caras) y el plan con IA */
/** avisa al servidor de que la app está abierta (para la lista «Quién usa la app» del dueño); nada en la de ejemplo */
function saludarSiToca() {
  if (!S.D || enDemo() || !haySesion() || document.hidden) return;
  const yo = S.M && S.M.yo;
  saludar({ v: VERSION, canal: enApp ? nativo.canal() : 'web', app: enApp ? nativo.version() : 0, liga: S.D.liga && S.D.liga.id, equipo: yo ? yo.nombre : '' });
}
setInterval(saludarSiToca, 10 * 60e3);
// con la app abierta, las respuestas a tus avisos también llegan sin tocar nada (comprobarAvisos mira como mucho cada 10 min)
if (!EN_FONDO) setInterval(() => { if (!document.hidden && S.D) comprobarAvisos(); }, 10 * 60e3 + 5e3);
// con la configuración nueva de limites.json puede cambiar lo que está bloqueado
window.addEventListener('limites-nuevos', () => { if (S.D && S.M && !S.hoja) pintar(); });
/* ---------------- la jornada en directo (vivo.js) ---------------- */
// los puntos de cada uno mientras se juega; se guardan (por liga) para que se vean al abrir sin esperar
const vivoGuardado = () => {
  if (enDemo()) return null;
  const liga = S.D && S.D.liga && S.D.liga.id;
  if (S.vivo === undefined || (S.vivo && S.vivo.liga !== liga)) S.vivo = LS.get(K('vivo'), null);
  return S.vivo && S.vivo.liga === liga ? S.vivo : null;
};
let cargandoVivo = false;
async function cargarVivo() {
  if (cargandoVivo || !S.D || !S.M || !S.M.enJuego || enDemo() || !haySesion()) return false;
  cargandoVivo = true; S.cargandoVivo = true;
  try {
    const yoTid = (S.M.yo && S.M.yo.teamId) || (S.D.yo && S.D.yo.teamId);
    S.vivo = { ...(await enVivo(S.D, S.M.enJuego.n, yoTid)), liga: S.D.liga && S.D.liga.id };
    LS.set(K('vivo'), S.vivo);
    // los puntos nuevos, sin rehacer todas las cuentas
    if (S.M.ponerVivo) S.M.ponerVivo(S.vivo);
    return true;
  } catch (e) { console.warn('en directo', e); return false; } finally { cargandoVivo = false; S.cargandoVivo = false; }
}
/** con los puntos nuevos: lo que esté abierto (la pestaña, la ficha de un partido o la de un jugador) */
function pintarVivo({ forzar = false } = {}) {
  if (S.tipoHoja && S.tipoHoja[0] === 'p') { repintarHoja(); return; }
  if (S.tipoHoja && S.tipoHoja[0] === 'j') { const el = $('#vivo-j'); if (el) el.innerHTML = Dr.jornadaJugadorHTML(S, S.tipoHoja[1]); return; }
  if (S.hoja || S.charlando || S.planEstado.cargando || S.vista === 'ia' || tourAbierto()) return;
  if (!forzar && S.vista !== 'directo' && S.vista !== 'equipo' && S.vista !== 'rivales') return;
  const y = window.scrollY;
  pintar();
  window.scrollTo(0, y);
}
/** los onces de todos los rivales en la jornada en juego (para «le quedan N por jugar»), como mucho cada 3 minutos */
async function cargarOncesRivales() {
  const n = S.M && S.M.enJuego && S.M.enJuego.n;
  if (!n || S.cargandoOnces || enDemo() || !haySesion() || Date.now() - (S.oncesT || 0) < 3 * MIN) return;
  S.cargandoOnces = true; S.oncesT = Date.now();
  S.oncesRival ||= {};
  const tids = (S.M.rivales || []).map((r) => r.e.teamId).filter((tid) => { const g = S.oncesRival[tid]; return !(g && g.n === n && Date.now() - g.t < 3 * MIN); });
  await enParalelo(tids, 3, async (tid) => {
    try { S.oncesRival[tid] = { t: Date.now(), n, ids: await onceRival(tid, n) }; } catch (e) { S.oncesRival[tid] = { t: Date.now(), n, ids: null }; }
  });
  S.cargandoOnces = false;
  if (S.vista === 'directo' && !S.hoja) pintarVivo();
}
/** la ficha de un partido: sus puntos (si no es la jornada en juego, se piden) y, si SofaScore deja, sus jugadas */
async function cargarPartido(n, id) {
  if (!S.D || enDemo() || !haySesion()) return;
  const vivoN = S.M && S.M.enJuego && S.M.enJuego.n;
  S.jornadasV ||= {}; S.jugadas ||= {};
  if (n !== vivoN) {
    const g = S.jornadasV[n];
    if (!g || Date.now() - g.t > 30 * MIN) {
      S.cargandoPartido = true;
      try { S.jornadasV[n] = await jornadaStats(S.D, n); } catch (e) { console.warn('partido', e); }
      S.cargandoPartido = false;
      if (S.tipoHoja && S.tipoHoja[0] === 'p' && S.tipoHoja[1] === `${n}:${id}`) repintarHoja();
    }
  }
  const ps = Dr.partidosJornada(S, n).find((x) => String(x.id) === String(id));
  const p = ps ? (S.D.partidos || []).find((x) => x.jornada === n && x.localId === ps.lid && x.visitanteId === ps.vid) : null;
  if (!p || Dr.estadoP(ps).cls === 'prox') return;
  const g = S.jugadas[id];
  if (g && (Dr.estadoP(ps).cls === 'fin' ? true : Date.now() - g.t < MIN)) return;
  const r = await jugadasSofa(S.D, p);
  if (r) { S.jugadas[id] = r; if (S.tipoHoja && S.tipoHoja[0] === 'p' && S.tipoHoja[1] === `${n}:${id}`) repintarHoja(); }
}
/** el once de un rival en la jornada en juego, para su ficha (se pide al abrirla, como mucho cada 3 minutos) */
/*
 * Equipo → Jornadas: tu once de la jornada elegida (de LaLiga) y los puntos de cada equipo en ella. Los de las
 * jornadas acabadas se guardan (no cambian); el de la que se juega es el de vivo.js; el de la próxima, el que tienes
 * puesto ahora (se mira como mucho cada 3 minutos)
 */
async function cargarJornadaMia() {
  if (!S.D || !S.M || !S.M.yo) return;
  const n = jornadaElegida(S);
  if (!n) return;
  const tid = String(S.M.yo.teamId);
  S.misJ ||= LS.get(K('mis-jornadas'), {});
  S.ptsJ ||= LS.get(K('pts-jornadas'), {});
  S.cargandoJ ||= {};
  if (S.cargandoJ[n]) return;
  const est = estadoJornada(S.M, n);
  const g = S.misJ[n];
  // (lo que ha fallado o no estaba no se vuelve a pedir hasta pasados 3 minutos: pintar() llama aquí cada vez)
  const fresco = g && ((est === 'acabada' && g.acabada && g.ids) || Date.now() - g.t < 3 * MIN);
  const faltanPts = est === 'acabada' && !S.ptsJ[n] && !enDemo();
  if (fresco && !faltanPts) return;
  S.cargandoJ[n] = true;
  try {
    if (!fresco) {
      let ids = null, forma = null;
      if (enDemo()) ids = S.M.once ? [...S.M.once.lineas.flat().map((j) => j.id), ...(S.M.once.entrenador ? [S.M.once.entrenador.id] : [])] : null;
      else {
        // el de esa jornada (también el de la que se juega: el de ahora puede ser ya otro); el de la próxima, el de ahora
        const r = est === 'proxima' ? await api.miOnce(tid) : await api.onceSemana(tid, n);
        ids = idsOnce(r); forma = formaOnce(r);
        if (ids.length < 5 && est === 'vivo' && S.M.vivo && S.M.vivo.once) { ids = S.M.vivo.once; forma = S.M.vivo.forma || null; }
      }
      S.misJ[n] = { ids: ids && ids.length ? ids : null, forma, t: Date.now(), acabada: est === 'acabada' };
    }
    if (faltanPts) {
      try {
        const m = {};
        for (const it of listaN(await api.clasifSemana(S.D.liga.id, n))) {
          const t = (it && it.team) || {};
          const id = it.teamId != null ? it.teamId : t.id != null ? t.id : it.id;
          const v = it.points != null ? it.points : it.weekPoints != null ? it.weekPoints : t.weekPoints;
          if (id != null && v != null && Number.isFinite(Number(v))) m[String(id)] = Number(v);
        }
        S.ptsJ[n] = m;
      } catch (e) { if (e.sesion) throw e; S.ptsJ[n] = {}; }
    }
  } catch (e) {
    if (e.sesion) { delete S.cargandoJ[n]; return; }
    S.misJ[n] = { ids: null, error: e.message, t: Date.now(), acabada: false };
  }
  delete S.cargandoJ[n];
  // se guardan las acabadas (lo de la que se juega y la próxima cambia)
  const guardar = (o, ok) => Object.fromEntries(Object.entries(o).filter(([k, v]) => ok(Number(k), v)));
  LS.set(K('mis-jornadas'), guardar(S.misJ, (k, v) => v.acabada && v.ids));
  LS.set(K('pts-jornadas'), guardar(S.ptsJ, (k) => S.misJ[k] && S.misJ[k].acabada));
  if (S.vista === 'equipo' && S.seg.equipo === 'jornadas' && !S.hoja) pintar();
}
async function cargarOnceRival(tid) {
  const n = S.M && S.M.enJuego && S.M.enJuego.n;
  if (!n || enDemo() || !haySesion()) return;
  S.oncesRival ||= {};
  const g = S.oncesRival[tid];
  if (g && g.n === n && Date.now() - g.t < 3 * MIN) return;
  try { S.oncesRival[tid] = { t: Date.now(), n, ids: await onceRival(tid, n) }; } catch (e) { S.oncesRival[tid] = { t: Date.now(), n, ids: null }; }
  if (S.tipoHoja && S.tipoHoja[0] === 'r' && S.tipoHoja[1] === tid) repintarHoja();
}
/*
 * en la web (iPhone, ordenador): si hay versión nueva publicada, una banda para ponerla. El navegador guarda los
 * archivos un rato (GitHub Pages, 10 minutos) y una recarga normal puede traer los de antes: «Recargar» los vuelve a
 * pedir todos sin caché (los de paquete.json) y luego recarga la página
 */
let webMiradaT = 0;
async function mirarWebNueva() {
  if (enApp || Date.now() - webMiradaT < 5 * MIN) return;
  webMiradaT = Date.now();
  try {
    const r = await fetch(`paquete.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.version && cmpVer(j.version, VERSION) > 0) { const antes = S.webNuevaWeb; S.webNuevaWeb = j; if (!antes && S.D && !S.hoja) pintar(); }
  } catch (e) { /* sin red: ya se mirará */ }
}
async function recargarWeb() {
  const j = S.webNuevaWeb;
  tostada('Poniendo la versión nueva…', 4000);
  // primero la página tal como se abrió (puede ser la carpeta, «/», y no «index.html»: el navegador las guarda aparte);
  // index.html ya pide cada módulo con su huella (paquete.py), así que con ella nueva llega todo lo demás nuevo
  const pagina = location.href.split('#')[0];
  await Promise.all([pagina, 'index.html'].map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
  const fs = j && j.archivos ? Object.keys(j.archivos).filter((k) => /\.(js|css|json)$/.test(k)) : [];
  await enParalelo(fs, 6, (k) => fetch(k, { cache: 'reload' }).catch(() => null));
  location.reload();
}
async function despues() {
  saludarSiToca();
  mirarWebNueva();
  if (S.M && S.M.enJuego) cargarVivo().then((ok) => { if (ok) { rehacer(); if (!S.hoja) pintar(); } });
  // onces probables y noticias (de fuera de LaLiga) y, a la vez, las fichas de los jugadores
  const fuentes = fuentesExternas(S.D, S.M).then((f) => { if (f) { S.fuentes = f; rehacer(); if (!S.hoja) pintar(); } }).catch((e) => console.warn('fuentes', e));
  try {
    const det = await completar(S.D, S.M);
    if (det) { S.det = { ...S.det, ...det }; rehacer(); if (!S.hoja) pintar(); }
  } catch (e) { console.warn('fichas', e); }
  await fuentes;
  comprobarAvisos();
  const ci = cfgIA();
  if (hayClave() && ci.auto && planViejo(S.M) && !S.planEstado.cargando && !S.planEstado.error) generarPlan();
}

/* ---------------- avisos de fallos (te llegan a ti y contestas desde la app) ---------------- */
function pintarNumAvisos() {
  const g = $('#gl-avisos');
  if (!g) return;
  const n = numeroAvisos();
  g.textContent = n; g.classList.toggle('oculto', !n);
}
/** lo escrito en la hoja se guarda antes de repintarla, para no perderlo */
function repintarAvisos() {
  if (!S.av) return;
  const t = $('#avisoTxt'), r = $('#respTxt'), dg = $('#avisoDiag');
  if (t) S.av.borrador = t.value;
  if (r) S.av.respBorrador = r.value;
  if (dg) S.av.sinDiag = !dg.checked;
  if (S.tipoHoja && S.tipoHoja[0] === 'avisos') repintarHoja();
}
/** (el dueño) quién de la liga tiene la app, cuándo entró y quién está dentro ahora */
async function abrirQuien() {
  S.quien = { cargando: true };
  hoja('quien');
  try { const r = await quienUsa(); S.quien = { lista: r.lista || [], ahora: r.ahora || Date.now() }; }
  catch (e) { S.quien = { error: e.estado === 403 ? 'Esto solo lo ve el dueño de la app.' : e.message || String(e) }; }
  if (S.tipoHoja && S.tipoHoja[0] === 'quien') repintarHoja();
}
async function abrirAvisos() {
  S.av = { cargando: true, borrador: (S.av && S.av.borrador) || '', cache: (S.av && S.av.cache) || {} };
  hoja('avisos');
  if (enDemo() || !haySesion()) { S.av = { ...S.av, cargando: false, sinSesion: true }; repintarAvisos(); return; }
  try {
    const r = await misAvisos();
    Object.assign(S.av, { cargando: false, lista: r.lista, admin: r.admin, pendientes: r.pendientes });
    repintarAvisos();
    // las respuestas que ves ahora quedan leídas (el numerito se va)
    for (const x of r.lista.filter((y) => y.respuesta && !y.vista)) marcarVisto(x.id).then(pintarNumAvisos).catch(() => {});
    if (r.admin) {
      S.av.cargandoTodos = true; repintarAvisos();
      const t = await todosAvisos();
      Object.assign(S.av, { todos: conContestados(t.lista), cargandoTodos: false });
      S.av.pendientes = S.av.todos.filter((x) => !x.r).length; fijarPendientes(S.av.pendientes);
      precargarAvisos();
      repintarAvisos();
    }
  } catch (e) {
    Object.assign(S.av, { cargando: false, cargandoTodos: false, sinSesion: !!e.sesion, error: e.sesion ? '' : `No he podido mirar tus avisos: ${e.message}` });
    repintarAvisos();
  }
  pintarNumAvisos();
}
async function enviarAviso() {
  const t = (($('#avisoTxt') || {}).value || '').trim();
  if (!t) { tostada('Cuenta qué ha pasado'); return; }
  const conDiag = !!($('#avisoDiag') || {}).checked;
  let diag = '';
  if (conDiag) { try { diag = Hj.textoDiagnostico(S); } catch (e) { diag = `(no se ha podido sacar el diagnóstico: ${e.message})`; } }
  S.av.borrador = t; S.av.sinDiag = !conDiag; S.av.enviando = true; S.av.error = '';
  repintarAvisos();
  try {
    const caps = (S.av.capturas || []).map((c) => c.url);
    const env = await mandarAviso({ texto: t, diag, equipo: (S.M && S.M.yo && S.M.yo.nombre) || '', liga: (S.D && S.D.liga && S.D.liga.nombre) || '', app: `${VERSION} · ${enApp ? `app ${nativo.canal()}` : 'web'}`, capturas: caps });
    S.av.borrador = ''; S.av.enviando = false; S.av.capturas = [];
    tostada(enApp ? 'Aviso mandado: cuando conteste te llega una notificación' : 'Aviso mandado: te aviso cuando conteste', 5000);
    // el servidor tarda unos segundos en listarlo: mientras, se pone a mano para que lo veas ya
    const nuevo = { id: env.id, t: Date.now(), texto: t, respuesta: null, respondida: null, vista: true, capturas: caps.length };
    const r = await misAvisos().catch(() => null);
    const lista = (r ? r.lista : S.av.lista) || [];
    S.av.lista = lista.some((x) => x.id === env.id) ? lista : [nuevo, ...lista];
    if (r) Object.assign(S.av, { admin: r.admin, pendientes: r.pendientes });
    if (!r) { const g = avisosGuardados(); LS.set('avisos', { ...g, lista: [nuevo, ...(g.lista || [])] }); }
    programarFondo();
  } catch (e) {
    S.av.enviando = false;
    if (e.sesion) S.av.sinSesion = true; else S.av.error = `No se ha podido mandar: ${e.message}`;
  }
  repintarAvisos();
  pintarNumAvisos();
}
/* un aviso entero (con su diagnóstico). El servidor tarda uno o dos segundos en darlo: se guardan los que ya se han
   pedido y, al abrir la lista, se piden solos los que están sin contestar, para que se abran al momento */
const avisoCache = () => (S.av.cache ||= {});
async function pedirAviso(id) {
  const c = avisoCache();
  if (c[id] && c[id].then) return c[id];
  const p = unAviso(id).then((d) => { c[id] = d; return d; }).catch((e) => { delete c[id]; throw e; });
  c[id] = p;
  return p;
}
const avisoListo = (id) => { const d = avisoCache()[id]; return d && !d.then ? d : null; };
function precargarAvisos() {
  const ids = (S.av.todos || []).filter((x) => !x.r).slice(0, 10).map((x) => x.id);
  enParalelo(ids, 2, (id) => pedirAviso(id).catch(() => null));
}
async function abrirAvisoRecibido(id) {
  // tocarlo otra vez lo cierra, salvo mientras carga (parecía que no hacía nada y se quedaba pillado)
  if (S.av.abierto === id) { if (!avisoListo(id) && !(S.av.detalle && S.av.detalle.error)) return; S.av.abierto = null; repintarAvisos(); return; }
  S.av.abierto = id; S.av.detalle = avisoListo(id); S.av.respBorrador = '';
  repintarAvisos();
  // (los sin contestar ya vienen cargados de antes: sus capturas se piden aquí también)
  if (S.av.detalle) { if (S.av.detalle.capturas) cargarCapturas(id, S.av.detalle.capturas); return; }
  try { const d = await pedirAviso(id); if (S.av.abierto === id) S.av.detalle = d; } catch (e) { if (S.av.abierto === id) S.av.detalle = { error: e.message }; }
  // el aviso entero sí está al día: si ya tiene respuesta, cuenta como contestado aunque la lista aún no lo diga
  const d = avisoListo(id);
  if (d && d.respondida) { apuntarContestado(id, d.respondida); S.av.todos = conContestados(S.av.todos); S.av.pendientes = (S.av.todos || []).filter((x) => !x.r).length; fijarPendientes(S.av.pendientes); }
  if (S.av.abierto === id) repintarAvisos();
  if (d && d.capturas) cargarCapturas(id, d.capturas);
}
/** las capturas de un aviso (el dueño, al abrirlo): se piden una vez y se guardan mientras la app está abierta */
async function cargarCapturas(id, n) {
  const c = (S.av.capt ||= {});
  if (c[id] && !c[id].some((x) => x === '')) return;
  c[id] = new Array(n).fill(null);
  await enParalelo([...Array(n).keys()], 2, async (i) => {
    try { c[id][i] = await capturaAviso(id, i); } catch (e) { c[id][i] = ''; }
    if (S.av.abierto === id) repintarAvisos();
  });
}
/* las capturas para un aviso que vas a mandar: de la galería (en la app, con su selector de fotos) o de un archivo */
const MAX_CAPTURAS = 3;
function elegirCapturas() {
  const caps = (S.av.capturas ||= []);
  if (caps.length >= MAX_CAPTURAS) { tostada(`Como mucho ${MAX_CAPTURAS} capturas por aviso`); return; }
  S.fotosPara = 'aviso';
  if (enApp && nativo.hayFotos()) { nativo.fotos(MAX_CAPTURAS - caps.length); return; }
  let inp = $('#capturaArchivo');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'capturaArchivo'; inp.hidden = true;
    inp.addEventListener('change', () => { const fs = [...(inp.files || [])]; inp.value = ''; anadirCapturas(fs, capturaArchivo); });
    document.body.appendChild(inp);
  }
  inp.click();
}
async function anadirCapturas(lista, preparar) {
  S.fotosPara = null;
  if (!S.av) return;
  const caps = (S.av.capturas ||= []);
  let mal = 0;
  for (const x of (lista || []).slice(0, MAX_CAPTURAS - caps.length)) {
    try { caps.push(await preparar(x)); } catch (e) { mal++; }
  }
  if (mal) tostada(mal > 1 ? `${mal} archivos no se han podido abrir como imagen` : 'Esa imagen no se ha podido abrir');
  repintarAvisos();
}
/** una imagen en grande, encima de todo (se cierra tocándola o con atrás) */
function verImagen(src, alt = 'Imagen') {
  if (!src) return;
  const v = document.createElement('div');
  v.className = 'visor'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', alt);
  v.innerHTML = `<img alt=""><button class="visor-x" aria-label="Cerrar">${icono('cerrar')}</button>`;
  const im = v.querySelector('img'); im.src = src; im.alt = alt;
  v.addEventListener('click', () => v.remove());
  document.body.appendChild(v);
}
/* para el dueño: los avisos sin contestar, enteros y con su diagnóstico, para pegarlos en el chat de Claude */
async function copiarAvisosClaude() {
  const todos = S.av.todos || [];
  let lista = todos.filter((x) => !x.r);
  const sinContestar = lista.length > 0;
  if (!sinContestar) lista = todos.slice(0, 5);
  lista = lista.slice(0, 15);
  if (!lista.length) { tostada('No hay avisos'); return; }
  tostada('Juntando los avisos…');
  const det = await enParalelo(lista, 3, (x) => pedirAviso(x.id).catch((e) => ({ error: e.message })));
  const partes = lista.map((x, i) => {
    const d = det[i] || {};
    const cab = `## ${x.id} · ${cuandoT(x.t)} · ${x.equipo || '?'}${x.quien ? ` (${x.quien})` : ''}${d.app ? ` · ${d.app}` : ''}`;
    const resp = d.respuesta ? `\n→ Le contestaste: ${d.respuesta}` : '';
    const caps = d.capturas ? `\n(${d.capturas} captura${d.capturas > 1 ? 's' : ''}: ábrelas en la bandeja de la app y mándamelas)` : '';
    const diag = d.diag ? `\n--- diagnóstico (recortado) ---\n${String(d.diag).slice(0, 3000)}` : '';
    return `${cab}\n${d.texto || x.txt || ''}${caps}${resp}${diag}`;
  });
  // (en el navegador, copiar después de esperar a la red puede fallar: el texto queda a la vista con su botón)
  S.av.paraClaude = `Avisos de fallos de Fantasy Manager (${sinContestar ? 'sin contestar' : 'los últimos'}), a ${cuandoT(Date.now())}:\n\n${partes.join('\n\n')}`;
  nativo.copiar(S.av.paraClaude);
  repintarAvisos();
  tostada(`Copiados ${lista.length}: pégalos en el chat de Claude`, 5000);
}
/* lo que contestas tarda hasta un minuto en salir como contestado en la lista del servidor (el almacén del Worker
   lista con retraso): se apunta aquí y manda sobre la lista durante un día */
const contestados = () => { const c = LS.get('avisos-contestados', {}); for (const [k, t] of Object.entries(c)) if (Date.now() - t > 86400e3) delete c[k]; return c; };
function apuntarContestado(id, t = Date.now()) { const c = contestados(); c[id] = t; LS.set('avisos-contestados', c); }
const conContestados = (lista) => { const c = contestados(); return (lista || []).map((x) => (!x.r && c[x.id] ? { ...x, r: c[x.id] } : x)); };
async function contestarAviso(id) {
  const t = (($('#respTxt') || {}).value || '').trim();
  if (!t) { tostada('Escribe la respuesta'); return; }
  S.av.respBorrador = t; S.av.respondiendo = true;
  repintarAvisos();
  try {
    await responderAviso(id, t);
    S.av.respBorrador = ''; S.av.respondiendo = false;
    tostada('Respuesta mandada: le llega en la app');
    // lo contestado, a mano ya (el servidor tarda unos segundos en listarlo)
    if (S.av.detalle && S.av.detalle.id === id) Object.assign(S.av.detalle, { respuesta: t, respondida: Date.now(), vista: false });
    if (avisoListo(id)) Object.assign(avisoListo(id), { respuesta: t, respondida: Date.now(), vista: false });
    apuntarContestado(id);
    S.av.todos = conContestados(S.av.todos);
    await misAvisos().catch(() => null);
    S.av.pendientes = S.av.todos.filter((x) => !x.r).length; fijarPendientes(S.av.pendientes);
  } catch (e) { S.av.respondiendo = false; tostada(`No se ha podido mandar: ${e.message}`, 6000); }
  repintarAvisos();
  pintarNumAvisos();
}
/** de vez en cuando (al abrir y al volver a la app): ¿hay respuesta a tus avisos o, si eres el dueño, avisos nuevos? */
async function comprobarAvisos() {
  if (enDemo() || !haySesion() || !hayQueMirar()) return;
  if (Date.now() - (avisosGuardados().t || 0) < 10 * MIN) return;
  let r;
  try { r = await misAvisos(); } catch (e) { return; }
  pintarNumAvisos();
  const resp = r.nuevasResp[0];
  if (resp) {
    const t = `${resp.por || 'Te han'} ${resp.por ? 'te ha contestado' : 'contestado'}: «${resp.respuesta.length > 120 ? `${resp.respuesta.slice(0, 117)}…` : resp.respuesta}»`;
    if (nativo.aLaVista()) tostada(`${t} · Toca Fallo, arriba`, 8000); else nativo.notificar('Respuesta a tu aviso', t, 'hoy');
  }
  if (r.nuevosRecibidos) {
    const t = r.nuevosRecibidos > 1 ? `${r.nuevosRecibidos} avisos de fallos nuevos` : 'Un aviso de fallo nuevo';
    if (nativo.aLaVista()) tostada(`${t}: toca Fallo, arriba`, 6000); else nativo.notificar(t, 'Entra para leerlo y contestar', 'hoy');
  }
}

/** a otra liga de tu cuenta: lo de cada liga se guarda aparte, así que se carga la suya */
function cambiarDeLiga(id) {
  if (trasCargar(() => cambiarDeLiga(id))) return;
  if (S.planCtl) S.planCtl.abort();
  if (S.chatCtl) S.chatCtl.abort();
  guardarCfg({ ligaId: id });
  S.D = null; S.M = null; S.plan = null; S.planEstado = {}; S.det = {}; S.fuentes = null; S.opPorPid = {}; S.errorCarga = null; S.adjuntos = [];
  cargar();
}
// al volver internet, si lo último falló, se vuelve a probar solo
window.addEventListener('online', () => {
  if (S.cargando) return;
  if (S.errorCarga || $('.carga.mal')) { tostada('Ha vuelto la conexión: actualizo'); sinErrorPlan(); cargar({ silencio: true }); }
});

/* ---------------- el plan con IA ---------------- */
/** quita el error del plan para que se pueda volver a intentar, sin tocar uno que esté en marcha (se pedirían dos) */
const sinErrorPlan = () => { if (!S.planEstado.cargando) S.planEstado = {}; };
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
      // lo has parado tú (o has cambiado de liga): se queda el plan que había y puedes pedir otro cuando quieras
      S.planEstado = {};
      if (!S.D) return;
      rehacer();
      tostada('Plan parado. Pide otro con «Pedir otro plan» cuando quieras');
    } else {
      S.planEstado = { error: e.message || String(e), clave: !!e.clave };
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
/** las fichas sin botón de cerrar (jugador, rival) lo llevan en el ordenador, donde no hay asa ni gesto de atrás */
const conCerrar = (html) => (/data-accion="cerrarHoja"/.test(html) ? html : `<button class="b-ico cerrar-flota" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button>${html}`);
function abrirHoja(html) {
  cerrarHoja(true);
  const velo = document.createElement('div'); velo.className = 'velo'; velo.dataset.accion = 'cerrarHoja';
  const hoja = document.createElement('div'); hoja.className = 'hoja';
  hoja.innerHTML = `<div class="asa"></div>${conCerrar(html)}`;
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
  // si se estaba cargando un anuncio para esto, ya no se enseña
  if (S.tipoHoja && S.tipoHoja[0] === 'anuncio' && S.anuncio && S.anuncio.cargando) { nativo.cancelarAnuncio(); S.anuncio = null; }
  S.hoja = null; S.tipoHoja = null; S.pila = [];
  document.body.style.overflow = '';
  if (ya) { h.remove(); v && v.remove(); return true; }
  h.classList.remove('on'); v && v.classList.remove('on');
  setTimeout(() => { h.remove(); v && v.remove(); }, 250);
  return true;
}
const htmlHoja = (tipo, arg) => {
  try { return htmlHoja0(tipo, arg); } catch (e) {
    console.error(e);
    apuntarError(e.message, `hoja ${tipo}${e.stack ? ` · ${String(e.stack).split('\n')[1] || ''}` : ''}`);
    return `<div class="hoja-cab"><h2>No se ha podido abrir</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div><div class="error-c">Algo ha fallado al abrir esto. Mándame el fallo y lo arreglo.<div class="fallo-det">${esc(e.message)}</div><div style="margin-top:10px"><button class="btn chico" data-accion="mandarFallo">Mandar el fallo</button></div></div>`;
  }
};
const htmlHoja0 = (tipo, arg) => (tipo === 'quien' ? Hj.quienUsaHTML(S) : tipo === 'avisos' ? Hj.avisos(S) : tipo === 'ajustes' ? Hj.ajustes(S) : tipo === 'vinculo' ? Hj.vinculoWeb(S) : tipo === 'j' ? Hj.fichaJugador(S, arg) : tipo === 'r' ? Hj.fichaRival(S, arg) : tipo === 'p' ? Dr.fichaPartido(S, arg) : tipo === 'c' ? Cl.fichaClub(S, arg) : tipo === 'anuncio' ? Hj.anuncioHTML(S, arg) : tipo === 'resumen' ? Hj.resumenEquipo(S) : tipo === 'chats' ? V.chatsViejosHTML() : Hj.diagnostico(S));
/*
 * las fichas que se abren desde otra (un jugador desde su club, el club desde un partido…) llevan arriba «‹ Volver» a
 * la de antes; el gesto de atrás de Android hace lo mismo. pila: las fichas de antes, de la más vieja a la última
 */
const CON_PILA = new Set(['c', 'j', 'p']);
function pilaDesde(el, tipo, arg) {
  if (!S.hoja || !S.tipoHoja || !CON_PILA.has(S.tipoHoja[0]) || !CON_PILA.has(tipo) || !(el && el.closest && el.closest('.hoja'))) return [];
  if (S.tipoHoja[0] === tipo && String(S.tipoHoja[1]) === String(arg)) return S.pila || [];
  return [...(S.pila || []), [...S.tipoHoja]].slice(-6);
}
function nombreHoja([tipo, arg]) {
  if (tipo === 'c') return Cl.nombreClub(S, arg);
  if (tipo === 'j') { const j = S.M && S.M.J(arg); return (j && j.nombre) || 'el jugador'; }
  return 'el partido';
}
function cuerpoHoja(tipo, arg, pila = S.pila) {
  const atras = pila && pila.length ? `<button class="volver-h" data-accion="volverHoja">${icono('atras')}<span>${esc(nombreHoja(pila[pila.length - 1]))}</span></button>` : '';
  return atras + htmlHoja(tipo, arg);
}
function hoja(tipo, arg, pila = []) { abrirHoja(cuerpoHoja(tipo, arg, pila)); S.tipoHoja = [tipo, arg]; S.pila = pila; }
/** lo que hay que pedir al abrir cada ficha */
function alAbrir(tipo, arg) {
  if (tipo === 'j') cargarDetalle(arg);
  else if (tipo === 'p') { const [n, id] = String(arg).split(':'); cargarPartido(Number(n), id); } else if (tipo === 'c') cargarClub(arg);
}
function volverHoja() {
  const pila = [...(S.pila || [])];
  const ant = pila.pop();
  if (!ant) return false;
  hoja(ant[0], ant[1], pila);
  alAbrir(ant[0], ant[1]);
  return true;
}
/** al abrir un club: sus titulares de los últimos días (Google Noticias, 1 hora guardados) */
async function cargarClub(id) {
  if (enDemo() || !S.D || (S.notClub && S.notClub[id] && Date.now() - S.notClub[id].t < 60 * MIN)) return;
  S.notClub = S.notClub || {};
  S.cargandoClub = id;
  let l = [];
  try { l = await noticiasClub(S.D, id); } catch (e) { l = []; }
  S.notClub[id] = { t: Date.now(), l };
  if (S.cargandoClub === id) S.cargandoClub = null;
  if (S.tipoHoja && S.tipoHoja[0] === 'c' && String(S.tipoHoja[1]) === String(id)) repintarHoja();
}
function repintarHoja() {
  if (!S.hoja || !S.tipoHoja) return;
  const sc = S.hoja.scrollTop;
  S.hoja.innerHTML = `<div class="asa"></div>${conCerrar(cuerpoHoja(...S.tipoHoja))}`;
  S.hoja.scrollTop = sc;
  encuadrar(S.hoja);
}

window.atras = () => {
  const visor = $('.visor');
  if (visor) { visor.remove(); return true; }
  if (cerrarPresentacion()) return true;
  if (tourAbierto()) { cerrarTour('saltar'); return true; }
  if (S.hoja && S.pila && S.pila.length && volverHoja()) return true;
  if (cerrarHoja()) return true;
  if (S.D && S.vista !== 'hoy') { ir('hoy'); return true; }
  return false;
};
window.alVolver = () => {
  comprobarAvisos();
  if (S.vista === 'ia' && !hayClave() && vieneDeAIStudio()) setTimeout(aPegar, 250);
  if (enApp && Date.now() - (S.versionT || 0) > 30 * MIN) buscarVersion(false);
  if (S.D && !S.cargando && Date.now() - S.D.t > 15 * MIN && (enDemo() || haySesion())) cargar({ silencio: true });
};

/* ---------------- la ficha de un jugador: puntos por jornada ---------------- */
async function cargarDetalle(pid) {
  const ya = S.det[pid];
  // con su partido de la jornada en juego, lo que lleva hecho se vuelve a pedir (como mucho cada 2 minutos)
  const jugando = !!(S.M && S.M.vivo && Dr.jornadaJugadorHTML(S, pid) && Date.now() - ((ya && ya.t) || 0) > 2 * MIN);
  if (ya && !jugando && Date.now() - ya.t < 6 * 3600e3 && !ya.error && (ya.valores || ya.sinValores || enDemo())) { pintarDetalle(pid); return; }
  let det;
  if (enDemo()) {
    const j = S.M.J(pid);
    let x = (+pid || 7) * 7;
    const azar = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    det = { stats: Array.from({ length: 9 }, (_, i) => { const min = azar() < 0.15 ? 0 : Math.round(45 + azar() * 45); return { n: i + 1, pts: min ? Math.round(j.media * (0.3 + azar() * 1.4)) : 0, min, gol: j.pos === 4 && azar() < 0.4 ? 1 : 0, asis: azar() < 0.15 ? 1 : 0, am: azar() < 0.12 ? 1 : 0, roja: 0 }; }), valores: null };
  } else {
    try {
      const d = ya && !jugando && Date.now() - ya.t < 6 * 3600e3 && !ya.error ? ya : detalleJugador(await api.jugador(pid, S.D.liga.id));
      // (el histórico de valor que ya se tenía no se vuelve a pedir)
      if (!d.valores && ya && !ya.error && (ya.valores || ya.sinValores)) { d.valores = ya.valores || null; d.sinValores = !ya.valores; }
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
  const vj = $('#vivo-j'); if (vj) vj.innerHTML = Dr.jornadaJugadorHTML(S, pid);
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
  if (S.charlando || S.preparandoFotos) return;
  const fotos = S.adjuntos.slice();
  if (!t && !fotos.length) return;
  S.adjuntos = [];
  if (S.vista !== 'ia') ir('ia');
  S.charlando = true; S.parcial = ''; S.pasoChat = ''; S.preguntaActual = t; S.fotosActuales = fotos;
  pintar();
  let ultimo = 0;
  // como con el plan: aunque salgas de la app sigue pensando, y si no estás en ella te avisa al contestar
  const resumenP = t ? `«${t.length > 60 ? `${t.slice(0, 57)}…` : t}»` : fotos.length > 1 ? 'Tus capturas' : 'Tu captura';
  nativo.trabajando(true, `${resumenP} · Puedes salir de la app: te aviso cuando conteste.`, 'Pensando la respuesta');
  const ctl = new AbortController();
  S.chatCtl = ctl;
  try {
    const r = await charlar(t, S.D, S.M, S.c, (parcial) => {
      S.parcial = parcial;
      const ahora = Date.now();
      if (ahora - ultimo > 120) { ultimo = ahora; const el = $('#respuesta'); if (el) { el.innerHTML = `<div class="quien-ia">Escribiendo…</div>${md(parcial)}`; bajarChat(); } }
    }, ctl.signal, fotos, (paso) => { S.pasoChat = paso; const el = $('#paso-chat'); if (el) el.textContent = paso; });
    if (!nativo.aLaVista()) {
      const limpio = String((r && r.texto) || '').replace(/[*_#>`]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\s+/g, ' ').trim();
      nativo.notificar('Tu director deportivo ha contestado', limpio.length > 220 ? `${limpio.slice(0, 217)}…` : limpio || 'Entra para leer la respuesta', 'ia');
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      // parada: la pregunta vuelve a la caja para cambiarla o mandarla otra vez
      quitarUltimaPregunta(t);
      S.borrador = t;
      S.adjuntos = [...fotos, ...S.adjuntos].slice(0, MAX_FOTOS);
      tostada('Pregunta parada');
    } else {
      if (e.clave) { S.claveMal = true; if (S.vista === 'ia') pintar(); } else tostada(e.message || 'No ha contestado', 7000);
      if (!nativo.aLaVista()) nativo.notificar('No ha podido contestar', e.message || 'Entra y vuelve a preguntar', 'ia');
    }
  } finally {
    if (S.chatCtl === ctl) S.chatCtl = null;
    S.preguntaActual = ''; S.fotosActuales = [];
    nativo.trabajando(false);
  }
  S.charlando = false; S.parcial = '';
  if (S.vista === 'ia') pintar();
}

/* ---------------- fotos y capturas para la IA ---------------- */
/** la tira de fotos que van con la próxima pregunta (sin repintar todo, para no perder lo escrito) */
function pintarAdjuntos() {
  const el = $('#adjuntos');
  if (el) el.innerHTML = V.adjuntosHTML(S);
  const ch = $('.chat');
  if (ch) ch.classList.toggle('con-adj', S.adjuntos.length > 0 || !!S.preparandoFotos);
  const bf = $('[data-accion="foto"]');
  if (bf) bf.disabled = S.adjuntos.length >= MAX_FOTOS;
}
async function anadirFotos(lista, preparar) {
  const sitio = MAX_FOTOS - S.adjuntos.length;
  if (sitio <= 0) { tostada(`Como mucho ${MAX_FOTOS} fotos por mensaje`); return; }
  const cola = [...lista].slice(0, sitio);
  if (lista.length > sitio) tostada(`Solo caben ${MAX_FOTOS} fotos por mensaje: van las ${sitio} primeras`);
  if (!cola.length) return;
  S.preparandoFotos = (S.preparandoFotos || 0) + cola.length;
  pintarAdjuntos();
  let mal = 0;
  for (const x of cola) {
    try { S.adjuntos.push(await preparar(x)); } catch (e) { mal++; }
    S.preparandoFotos--;
    pintarAdjuntos();
  }
  if (mal) tostada(mal > 1 ? `${mal} archivos no se han podido abrir como imagen` : 'Esa imagen no se ha podido abrir');
  const ta = $('#pregunta'); if (ta && !S.charlando) ta.focus({ preventScroll: true });
}
function elegirFotos() {
  if (!hayClave()) { ir('ia'); tostada('Primero activa la IA con tu clave de Google'); return; }
  if (S.adjuntos.length >= MAX_FOTOS) { tostada(`Como mucho ${MAX_FOTOS} fotos por mensaje`); return; }
  S.fotosPara = null;
  if (enApp && nativo.hayFotos()) { nativo.fotos(MAX_FOTOS - S.adjuntos.length); return; }
  let inp = $('#fotoArchivo');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'fotoArchivo'; inp.hidden = true;
    inp.addEventListener('change', () => { const fs = [...(inp.files || [])]; inp.value = ''; anadirFotos(fs, prepararArchivo); });
    document.body.appendChild(inp);
  }
  inp.click();
}
/** lo que devuelve el selector de fotos de la app: JPEG ya reducidos, en base64 */
window.fotosApp = (lista, error) => {
  if (error) tostada(error, 5000);
  if (S.fotosPara === 'aviso') { anadirCapturas(Array.isArray(lista) ? lista : [], capturaB64); return; }
  if (Array.isArray(lista) && lista.length) anadirFotos(lista, prepararB64);
};
// pegar una captura (Ctrl+V) o arrastrarla encima del chat
document.addEventListener('paste', (ev) => {
  if (S.vista !== 'ia' || !hayClave() || S.charlando) return;
  const fs = [...((ev.clipboardData && ev.clipboardData.files) || [])].filter((f) => /^image\//.test(f.type));
  if (!fs.length) return;
  ev.preventDefault();
  anadirFotos(fs, prepararArchivo);
});
document.addEventListener('dragover', (ev) => {
  if (S.vista !== 'ia' || !hayClave() || !ev.dataTransfer || ![...ev.dataTransfer.types].includes('Files')) return;
  ev.preventDefault();
  document.body.classList.add('soltando');
});
document.addEventListener('dragleave', (ev) => { if (!ev.relatedTarget) document.body.classList.remove('soltando'); });
document.addEventListener('drop', (ev) => {
  document.body.classList.remove('soltando');
  if (S.vista !== 'ia' || !hayClave() || !ev.dataTransfer) return;
  const fs = [...(ev.dataTransfer.files || [])].filter((f) => /^image\//.test(f.type));
  ev.preventDefault();
  if (fs.length && !S.charlando) anadirFotos(fs, prepararArchivo);
});
/** una foto del chat, en grande */
async function verFoto(id, mini) {
  const b = id ? await leerFoto(id) : null;
  const src = b ? `data:image/jpeg;base64,${b}` : mini;
  if (!src) return;
  const v = document.createElement('div');
  v.className = 'visor'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Foto');
  v.innerHTML = `<img alt="Foto que le mandaste a la IA"><button class="visor-x" aria-label="Cerrar">${icono('cerrar')}</button>${b ? '' : '<p>Solo queda la miniatura: la foto entera ya no está guardada.</p>'}`;
  v.querySelector('img').src = src;
  v.addEventListener('click', () => v.remove());
  document.body.appendChild(v);
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
  // la de Google Play la actualiza la tienda; la web siempre está al día
  if (!enApp || nativo.canal() === 'play') { if (avisar) tostada(enApp ? 'Las versiones nuevas llegan por Google Play' : 'La web siempre está en la última versión'); return; }
  // la web nueva se baja sola (contesta webBuscada); el APK nuevo solo hace falta si ha cambiado la parte Android
  S.versionT = Date.now();
  const conAlDia = avisar ? nativo.buscarWeb() : !!nativo.estadoWeb();
  if (avisar) { S.buscaAvisar = conAlDia ? Date.now() : 0; tostada('Buscando versión nueva…', 2000); }
  const v = await ultimaVersion();
  const mia = nativo.huellaNativa();
  const hace = v && v.version > nativo.version() && !(mia && v.nativo && v.nativo === mia);
  if (hace) { S.nueva = v; versionNueva(v); pintar(); if (avisar) tostada(`Hay una versión nueva de la app: ${v.nombre}`); }
  else if (avisar && !conAlDia) tostada('Tienes la última versión');
}

/* ---------------- la web al día sin reinstalar ----------------
   La app mira al abrirse (y cada rato) si se ha publicado web nueva; si es para su misma parte Android, la baja
   sola y avisa con webBuscada('nueva'). Entonces se pone recargando la página, pero solo cuando no se pierde nada:
   con la cuenta atrás o sin minutos, recién abierta o al volver a la app después de un rato. Si no, una banda. */
const arranqueT = Date.now();
let fueraT = 0;
function sePuedeRecargar(alVolver = false) {
  if ($('#limite')) return true;
  if (S.cargando || (S.planEstado || {}).cargando || S.chatCtl || tourAbierto()) return false;
  if ([...document.querySelectorAll('textarea, input[type="text"], input:not([type])')].some((e) => e.value && e.value.trim())) return false;
  if (!S.D) return true;
  return alVolver || (Date.now() - arranqueT < 25000 && !S.hoja);
}
function ponerWebNueva() {
  LS.set('web-puesta', { t: Date.now() });
  location.reload();
}
window.webBuscada = (estado) => {
  const avisar = S.buscaAvisar && Date.now() - S.buscaAvisar < 120000;
  S.buscaAvisar = 0;
  if (estado === 'nueva') {
    S.webNueva = true;
    if (sePuedeRecargar()) ponerWebNueva();
    else { if (S.D && !S.hoja) pintar(); if (avisar) tostada('Versión nueva lista: toca «Ponerla»'); }
    return;
  }
  if (!avisar) return;
  if (String(estado).startsWith('error')) tostada(`No he podido mirar si hay versión nueva (${String(estado).slice(7)})`, 5000);
  else if (!S.nueva) tostada('Tienes la última versión');
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { fueraT = Date.now(); return; }
  if (S.webNueva && fueraT && Date.now() - fueraT > 60000 && sePuedeRecargar(true)) ponerWebNueva();
});
// por si llegó en mal momento (cargando la liga, la IA trabajando): se vuelve a mirar cada poco
setInterval(() => { if (S.webNueva && sePuedeRecargar()) ponerWebNueva(); }, 10000);
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
  mirarLimite();
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

/* ---------------- a mano: pestañas fijas, deslizar y tirar para actualizar ---------------- */
// la cabecera mide lo que mide (con la barra de estado en el móvil): las pestañas se pegan justo debajo
function medirSup() {
  const s = $('.sup'); if (s) document.documentElement.style.setProperty('--sup-h', `${s.offsetHeight}px`);
  // y la barra de abajo (con la letra grande del móvil es más alta): la caja del chat va justo encima
  const n = $('.nav'); if (n && n.offsetHeight) document.documentElement.style.setProperty('--nav-h', `${n.offsetHeight}px`);
}
window.addEventListener('resize', medirSup);
/** si al cambiar de pestaña estabas más abajo, vuelve al principio de la pestaña (con las pestañas a la vista) */
function volverAPestanas() {
  const a = $('#vista .tabs-ancla'), s = $('.sup');
  if (!a) return;
  const y = a.getBoundingClientRect().top + window.scrollY - (s && !V.ancho() ? s.offsetHeight : 0);
  if (window.scrollY > y) window.scrollTo(0, y);
}
const conScrollX = (el) => {
  for (let x = el; x && x !== document.body; x = x.parentElement) {
    if (x.scrollWidth > x.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(x).overflowX)) return true;
  }
  return false;
};
// deslizar de lado sobre la pantalla pasa a la pestaña de al lado (no desde los bordes: ahí está el «atrás» de Android)
let desliz = null;
document.addEventListener('touchstart', (e) => {
  desliz = null;
  if (e.touches.length !== 1 || S.hoja || !$('#vista .tabs')) return;
  const t = e.touches[0];
  if (t.clientX < 28 || t.clientX > window.innerWidth - 28) return;
  if (e.target.closest('.tabs, .filtros, .carril, .campo, .graf, .rangos, .campo-modo, input, textarea, select, .nav, [data-quieto]') || conScrollX(e.target)) return;
  desliz = { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const d0 = desliz; desliz = null;
  if (!d0 || !e.changedTouches.length) return;
  const dx = e.changedTouches[0].clientX - d0.x, dy = e.changedTouches[0].clientY - d0.y;
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - d0.t > 700) return;
  const bs = $$('#vista .tabs button[data-seg]');
  const i = bs.findIndex((b) => b.classList.contains('activo'));
  const k = i + (dx < 0 ? 1 : -1);
  if (i < 0 || k < 0 || k >= bs.length) return;
  nativo.toque();
  bs[k].click();
  const n = $('#vista .tabs button.activo');
  if (n) n.scrollIntoView({ block: 'nearest', inline: 'center' });
}, { passive: true });
// tirar hacia abajo desde arriba del todo actualiza, como en cualquier app
let tiron = null;
const UMBRAL = 96;
function marcaTiron(f, listo = false) {
  let m = $('#tiron');
  if (!m) { m = document.createElement('div'); m.id = 'tiron'; m.innerHTML = icono('refrescar'); document.body.appendChild(m); }
  m.style.setProperty('--f', f);
  m.classList.toggle('listo', f >= 1);
  m.classList.toggle('va', listo);
  if (listo) setTimeout(() => m.style.setProperty('--f', 0), 500);
}
document.addEventListener('touchstart', (e) => {
  tiron = null;
  if (e.touches.length !== 1 || window.scrollY > 0 || S.hoja || !$('#vista') || S.cargando || S.vista === 'ia' || V.ancho()) return;
  if (e.target.closest('.nav, input, textarea, select, .campo')) return;
  tiron = { y: e.touches[0].clientY, d: 0 };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!tiron) return;
  const d = e.touches[0].clientY - tiron.y;
  tiron.d = window.scrollY > 0 ? 0 : Math.max(0, d);
  marcaTiron(Math.min(1, tiron.d / UMBRAL));
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!tiron) return;
  const listo = tiron.d >= UMBRAL;
  tiron = null;
  marcaTiron(0, listo);
  if (listo) { nativo.toque(); sinErrorPlan(); cargar(); }
}, { passive: true });

/* ---------------- el teclado en la app ---------------- */
// Al volver del selector de fotos o del dictado, Android a veces deja la app sin foco y al tocar donde se escribe
// no sale el teclado. Al tocar una caja de texto se le pide a la app que lo saque (y se enfoca la caja si no lo estaba).
const esCampo = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|range|file|button|submit)$/i.test(el.type || '')));
if (enApp) {
  document.addEventListener('focusin', (ev) => { if (esCampo(ev.target)) nativo.teclado(); });
  document.addEventListener('click', (ev) => {
    const c = ev.target && ev.target.closest && ev.target.closest('textarea, input');
    if (!esCampo(c)) return;
    if (document.activeElement !== c) c.focus();
    nativo.teclado();
  });
}

/* ---------------- toques ---------------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion],[data-ir],[data-j],[data-r],[data-club],[data-seg],[data-filtro],[data-abrir],[data-sugerencia]');
  if (!el) return;
  const d = el.dataset;
  if (d.abrir) { ev.preventDefault(); nativo.abrir(d.abrir); return; }
  if (d.sugerencia) { enviarPregunta(d.sugerencia); return; }
  if (d.seg) { const [v, s] = d.seg.split(':'); S.seg[v] = s; if (!d.ir) { pintar(); volverAPestanas(); return; } }
  if (d.filtro) { const [k, f] = d.filtro.split(':'); S.filtro[k] = f; pintar(); return; }
  if (d.j && S.D && !d.accion) { hoja('j', d.j, pilaDesde(el, 'j', d.j)); cargarDetalle(d.j); return; }
  if (d.club && S.D && !d.accion) { hoja('c', d.club, pilaDesde(el, 'c', d.club)); cargarClub(d.club); return; }
  if (d.r && S.D) { hoja('r', d.r); cargarOnceRival(d.r); return; }
  if (d.ir && !d.accion) { cerrarHoja(); ir(d.ir); return; }
  switch (d.accion) {
    case 'verPartido': cargarPartido(Number(d.n), d.id); hoja('p', `${d.n}:${d.id}`, pilaDesde(el, 'p', `${d.n}:${d.id}`)); break;
    case 'volverHoja': volverHoja(); break;
    case 'verJornada': S.jornadaSel = Number(d.n); pintar(); break;
    case 'filtroClub': S.filtro.club = d.f; repintarHoja(); break;
    case 'vivoYa': {
      if (enDemo()) { tostada('En la demo no hay jornada en directo'); break; }
      if (S.cargandoVivo) break;
      const b = el; b.classList.add('gira');
      const ok = await cargarVivo();
      b.classList.remove('gira');
      if (!ok) tostada('No se ha podido leer la jornada en LaLiga');
      pintarVivo({ forzar: true });
      break;
    }
    case 'entrar': try { await empezarLogin(); } catch (e) { pantallaEntrar(e.message); } break;
    case 'entrarDemo': { const entrar = () => { cerrarHoja(true); LS.set('demo', true); S.D = null; S.planEstado = {}; cargar(); }; if (!trasCargar(entrar)) entrar(); break; }
    case 'usarCodigo': {
      const cod = (($('#codigoWeb') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cod.length !== 8) { tostada('El código tiene 8 letras y números'); break; }
      el.disabled = true; el.textContent = 'Entrando…';
      try {
        const r = await fetch(`${WORKER}/vincular/usar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codigo: cod }) });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || !j.sesion) throw new Error((j && j.e) || `El servidor de la web responde ${r.status}`);
        traerVinculo(j);
        S.D = null; S.planEstado = {};
        await cargar();
      } catch (e) { pantallaEntrar(e.name === 'TypeError' ? `Sin conexión con el servidor de la web (${e.message})` : e.message || String(e)); }
      break;
    }
    case 'pegarVuelta': {
      const url = (($('#vueltaWeb') || {}).value || '').trim();
      if (!/[?&]code=/.test(url)) { tostada('Pega la dirección entera: la que lleva «code=»'); break; }
      el.disabled = true;
      try { await terminarLogin(url); LS.del('demo'); S.D = null; S.planEstado = {}; await cargar(); } catch (e) { pantallaEntrar(e.message || String(e)); }
      break;
    }
    case 'vincularWeb': {
      // la app deja la sesión en el Worker y enseña el código para escribirlo en la web
      el.disabled = true;
      try {
        const c = cfg();
        const datos = { sesion: sesion(), cfg: { ligaId: c.ligaId || null }, ia: hayClave() ? { clave: clave() } : null, dichos: LS.get(K('dinero-dicho'), {}) };
        // en la app por la parte nativa; en la web, directo al Worker (no pasa por su reenvío)
        const r = enApp
          ? await http('POST', `${WORKER_PUBLICO}/vincular`, { cabeceras: { 'content-type': 'application/json' }, cuerpo: JSON.stringify(datos), tiempo: 20000 })
          : await fetch(`${WORKER_PUBLICO}/vincular`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos) }).then(async (x) => ({ s: x.status, b: await x.text() }), (e) => ({ s: 0, e: e.message }));
        let j = null;
        try { j = JSON.parse(r.b || 'null'); } catch (e2) { j = null; }
        if (r.s !== 200 || !j || !j.codigo) throw new Error(j && j.e ? j.e : r.s ? `el servidor de la web responde ${r.s}` : `sin conexión (${r.e})`);
        S.vinculo = j;
        hoja('vinculo');
      } catch (e) { tostada(`No se ha podido sacar el código: ${e.message}`, 6000); el.disabled = false; }
      break;
    }
    case 'copiarEnlaceWeb': nativo.copiar('https://fantasymanagerapp.com/'); tostada('Enlace copiado'); break;
    case 'mudarse': mudarse(el); break;
    case 'salirDemo': salirDemo(); break;
    case 'salir': if (confirm('¿Cerrar la sesión de LaLiga en esta app?')) { cerrarSesion(); cerrarHoja(true); S.D = null; programar(null, null); pantallaEntrar(); } break;
    case 'recargar': sinErrorPlan(); cargar(); break;
    case 'ajustes': hoja('ajustes'); break;
    case 'diag': hoja('diag'); break;
    case 'mandarFallo': case 'avisos': abrirAvisos(); break;
    case 'quienUsa': cerrarHoja(true); abrirQuien(); break;
    case 'bloqueada': {
      // en la de Google Play se abren viendo un anuncio
      if (topConAnuncio()) { S.anuncio = { para: 'top', clave: d.clave, volver: S.tipoHoja && S.tipoHoja[0] !== 'anuncio' ? [...S.tipoHoja] : null }; hoja('anuncio', 'top'); break; }
      const [t, x] = BLOQUEO[d.clave] || ['Función top', ''];
      abrirHoja(`<div class="bloq-hoja"><div class="hoja-cab"><span></span><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
        <span class="bloq-grande">${icono('candado')}</span><h2>${esc(t)}</h2><p>${esc(x)}</p>
        <p>Es una de las funciones top de Fantasy Manager. De momento está bloqueada: <b>muy pronto se desbloqueará viendo un anuncio corto</b>, gratis.</p>
        <button class="btn ancho" data-accion="cerrarHoja" aria-label="Cerrar">Entendido</button></div>`);
      break;
    }
    case 'mandarAviso': enviarAviso(); break;
    case 'capturaAviso': repintarAvisos(); elegirCapturas(); break;
    case 'quitarCaptura': if (S.av && S.av.capturas) { S.av.capturas.splice(Number(d.i), 1); repintarAvisos(); } break;
    case 'verCaptura': {
      const n = Number(d.n);
      if (d.id) { const l = S.av && S.av.capt && S.av.capt[d.id]; if (l && l[n]) verImagen(l[n], `Captura ${n + 1}`); } else if (S.av && S.av.capturas && S.av.capturas[n]) verImagen(S.av.capturas[n].url, `Captura ${n + 1}`);
      break;
    }
    case 'tutorial': lanzarTutorial(); break;
    case 'permisoApertura': if (!cfgAvisos().on) guardarCfgAvisos({ on: true }); nativo.pedirPermisoAvisos(); break;
    case 'abrirAviso': abrirAvisoRecibido(d.id); break;
    case 'responderAviso': contestarAviso(d.id); break;
    case 'copiarAvisos': copiarAvisosClaude(); break;
    case 'copiarParaClaude': if (S.av && S.av.paraClaude) { nativo.copiar(S.av.paraClaude); tostada('Copiado'); } break;
    case 'ligas': {
      const D = S.D; if (!D || !D.ligas || D.ligas.length < 2) break;
      abrirHoja(`<div class="hoja-cab"><h2>Tus ligas</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
        <div class="ligas-l">${D.ligas.map((l) => `<button class="${l.id === D.liga.id ? 'activa' : ''}" data-accion="cambiarLiga" data-id="${esc(l.id)}"${l.id === D.liga.id ? ' aria-current="true"' : ''}><b>${esc(l.nombre)}</b>${l.premium ? '<small>Premium</small>' : ''}${l.id === D.liga.id ? icono('ok') : ''}</button>`).join('')}</div>
        <p class="t2 peq">Cada liga guarda su plan, su chat y lo que le has contado a la IA por separado.</p>`);
      break;
    }
    case 'cambiarLiga': {
      cerrarHoja(true);
      if (!S.D || d.id === S.D.liga.id) break;
      cambiarDeLiga(d.id);
      break;
    }
    case 'cambiarClave': guardarClave(''); S.planEstado = {}; S.claveMal = false; rehacer(); ir('ia'); tostada('Pega la clave nueva'); break;
    case 'cerrarHoja': cerrarHoja(); break;
    case 'paron': if (S.M && S.M.paron) tostada(`${S.M.paron.nombre || 'Parón de selecciones'}: del ${cuandoT(S.M.paron.ini, { hora: false })} al ${cuandoT(S.M.paron.fin, { hora: false })}. No hay jornada y los valores casi no se mueven: lo que vayas a vender, mejor antes.`, 7000); break;
    case 'irIA': cerrarHoja(); ir('ia'); break;
    case 'copiarDiag': nativo.copiar(Hj.textoDiagnostico(S)); tostada('Copiado'); break;
    case 'compartirDiag': nativo.compartir(Hj.textoDiagnostico(S)); break;
    case 'plan': S.planEstado = {}; generarPlan(); break;
    case 'planYa': cerrarHoja(); ir('hoy'); pedirOtroPlan(); break;
    // «Ahora no» en el anuncio de las funciones top: de vuelta a la ficha de la que venía (si venía de una)
    case 'noTop': { const v = S.anuncio && S.anuncio.volver; cerrarHoja(); S.anuncio = null; if (v) hoja(v[0], v[1]); break; }
    case 'verAnuncio': {
      S.anuncio = { ...(S.anuncio || {}), para: d.para, cargando: true, error: null };
      repintarHoja();
      nativo.verAnuncio(d.para);
      // por si la app no contesta: a los 20 segundos se puede volver a probar
      const t0 = S.anuncio;
      setTimeout(() => { if (S.anuncio === t0 && t0.cargando) { S.anuncio = { ...t0, cargando: false, error: 'No ha llegado el anuncio. Prueba otra vez en un rato.' }; if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja(); } }, 20000);
      break;
    }
    case 'privAnuncios': nativo.privacidadAnuncios(); break;
    case 'voz': escuchar(); break;
    case 'pararPlan': if (S.planCtl) S.planCtl.abort(); break;
    case 'pararChat': if (S.chatCtl) S.chatCtl.abort(); break;
    case 'resumen': if (S.D) { hoja('resumen'); encuadrar(S.hoja); valoresMios(); } break;
    case 'novedades': listaVersiones(); break;
    case 'presentacion': cerrarHoja(true); verNovedades(null); break;
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
      const todos = LS.get(K('hechos'), {});
      const clave = V.claveHechos(P);
      const l = new Set((todos[clave] || {}).n || []);
      const n = +d.n;
      if (l.has(n)) l.delete(n); else l.add(n);
      todos[clave] = { t: Date.now(), n: [...l] };
      // solo los de la última semana
      for (const k of Object.keys(todos)) if (!todos[k] || Date.now() - (todos[k].t || 0) > 7 * 86400e3) delete todos[k];
      LS.set(K('hechos'), todos);
      if (apuntarReventa()) rehacer();
      pintar();
      break;
    }
    case 'guardarClave': await probarYGuardar(); break;
    case 'abrirAIStudio': marcarAIStudio(); nativo.abrir(AISTUDIO); pintar(); break;
    case 'irAPegar': ev.preventDefault(); aPegar(); break;
    case 'pegarClave': {
      let t = '';
      try { t = await navigator.clipboard.readText(); } catch (e) { /* sin permiso */ }
      const c = $('#claveIA');
      if (!t) { if (c) c.focus(); tostada('No he podido leer lo copiado: pégalo tú en la casilla', 5000); break; }
      const k = limpiarClave(t);
      if (c) c.value = k;
      if (pareceClave(k)) await probarYGuardar();
      else tostada('Lo que tienes copiado no parece una clave: copia la de AI Studio (empieza por AQ. o AIza)', 6000);
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
    case 'avisosOn': {
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
    case 'ponerWeb': ponerWebNueva(); break;
    case 'recargarWeb': recargarWeb(); break;
    case 'buscarWeb': {
      tostada('Buscando versión nueva…', 2000);
      webMiradaT = 0;
      await mirarWebNueva();
      if (S.webNuevaWeb) recargarWeb(); else tostada(`Tienes la última: la ${VERSION}`);
      break;
    }
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
    case 'foto': elegirFotos(); break;
    case 'quitarFoto': S.adjuntos.splice(+d.i, 1); pintarAdjuntos(); break;
    case 'verFoto': {
      const m = conversacion()[+d.m];
      const f = m && m.fotos && m.fotos[+d.i];
      const actual = !f && S.fotosActuales && S.fotosActuales[+d.i];
      if (f) verFoto(f.id, f.mini); else if (actual) verFoto(actual.id, actual.mini);
      break;
    }
    case 'preguntarJ': { const j = S.M.J(d.pid); cerrarHoja(true); enviarPregunta(`¿Qué hago con ${j.nombre}? Dime si comprarlo, venderlo, clausularlo o esperar, cuánto pagar como mucho y por qué.`); break; }
    default: break;
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-cambia]');
  if (!el) return;
  const k = el.dataset.cambia, v = el.value;
  if (k === 'deuda') { guardarCfg({ deuda: +v }); rehacer(); pintar(); repintarHoja(); }
  if (k === 'liga') { cerrarHoja(true); cambiarDeLiga(v); }
  if (k === 'modelo') guardarCfgIA({ modelo: v });
  if (k === 'pullitas') { guardarCfgIA({ pullitas: v }); tostada(v === 'no' ? 'Sin pullitas desde el próximo plan' : 'Hecho: se nota desde el próximo plan o la próxima respuesta'); }
  if (k === 'horaAviso') { guardarCfgAvisos({ hora: v }); if (S.D) programar(S.D, S.M); }
  if (k === 'interes') { guardarCfgAvisos({ interes: +v }); if (S.D) programar(S.D, S.M); repintarHoja(); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $('.visor')) { $('.visor').remove(); return; }
  if (ev.key === 'Escape' && S.hoja && !tourAbierto()) { cerrarHoja(); return; }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('[role="button"][data-accion]')) { ev.preventDefault(); ev.target.click(); return; }
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target && ev.target.id === 'pregunta') { ev.preventDefault(); const t = ev.target.value; ev.target.value = ''; enviarPregunta(t); }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'codigoWeb') { ev.preventDefault(); const b = $('[data-accion="usarCodigo"]'); if (b) b.click(); }
});
// el buscador del Mercado: solo se repinta la lista de resultados (así no se pierde lo que escribes ni el teclado)
let buscaT = 0;
document.addEventListener('input', (ev) => {
  if (!ev.target || ev.target.id !== 'buscaJ') return;
  S.busca = ev.target.value;
  clearTimeout(buscaT);
  buscaT = setTimeout(() => { const r = $('#buscaRes'); if (r && S.M) r.innerHTML = V.buscaHTML(S); }, 120);
});
document.addEventListener('input', (ev) => {
  if (ev.target && ev.target.id === 'pregunta') { ev.target.style.height = 'auto'; ev.target.style.height = Math.min(120, ev.target.scrollHeight) + 'px'; }
});
window.addEventListener('hashchange', () => {
  // la notificación de una respuesta a tu aviso de fallo abre la bandeja de avisos
  if (location.hash === '#fallos') { history.replaceState(null, '', '#' + S.vista); if (S.D) abrirAvisos(); return; }
  const v = ALIAS[location.hash.slice(1)] || location.hash.slice(1); if (S.D && VISTAS[v] && v !== S.vista) ir(v);
});

/* ---------------- la clave de la IA ---------------- */
/** prueba la clave de la casilla con Google y, si vale, la guarda y hace el plan */
let probandoClave = false;
async function probarYGuardar() {
  if (probandoClave) return;
  S.claveMal = false;
  const k = leerCasilla();
  if (!k) { tostada('Pega la clave primero'); const c = $('#claveIA'); if (c) c.focus(); return; }
  const b = $('[data-accion="guardarClave"]');
  probandoClave = true;
  if (b) { b.disabled = true; b.textContent = 'Probando la clave…'; }
  try {
    // primero se prueba y luego se guarda: si no, mientras Google contesta la app ya cree que hay clave (cambia la
    // guía por el chat y puede lanzar el plan con una clave sin probar)
    const lista = await probarClave(k);
    guardarClave(k);
    LS.del('guia-clave');
    tostada(`IA activada: ${lista.length} modelos disponibles con tu clave`);
    ir('hoy');
    S.planEstado = {};
    generarPlan();
  } catch (e) {
    const raro = !pareceClave(k);
    tostada(raro ? 'Eso no parece una clave de Google: empieza por AQ. o AIza y es larga. Cópiala entera desde AI Studio.' : e.message, 7000);
    // si es cosa de la clave, la ayuda abierta («Dice que la clave no vale»)
    const ay = $('.gc-ayuda');
    if (ay && (raro || e.clave)) ay.open = true;
    if (b) { b.disabled = false; b.innerHTML = `${icono('ok')}Guardar y hacer el plan`; }
    const c = $('#claveIA');
    if (c) c.select();
  } finally { probandoClave = false; }
}
// en cuanto se pega algo con pinta de clave, se prueba sin tener que pulsar (escribiéndola a mano, al parar un momento)
let claveT = 0;
document.addEventListener('input', (ev) => {
  if (!ev.target || ev.target.id !== 'claveIA') return;
  clearTimeout(claveT);
  const pegado = ev.inputType === 'insertFromPaste' || ev.inputType === 'insertReplacementText';
  claveT = setTimeout(() => {
    const c = $('#claveIA');
    if (!c) return;
    const k = limpiarClave(c.value);
    if (!pareceClave(k)) return;
    if (probandoClave) { tostada('Espera, estoy probando la de antes'); return; }
    c.value = k;
    probarYGuardar();
  }, pegado ? 50 : 700);
});
// al volver de AI Studio, la casilla de pegar a la vista
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S.vista === 'ia' && !hayClave() && vieneDeAIStudio()) setTimeout(aPegar, 250);
});
// la web nueva: al volver a la pestaña y cada 10 minutos con ella a la vista (como mucho cada 5)
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.D) mirarWebNueva(); });
setInterval(() => { if (!document.hidden && S.D) mirarWebNueva(); }, 10 * MIN);

/* ---------------- lo nuevo de esta versión ---------------- */
/** la última versión que viste (la numeración cambió en la 0.1.0: lo de antes se traduce) */
function versionVista() {
  const v = LS.get('version-vista2', null);
  if (v) return v;
  const vieja = LS.get('version-vista', null);
  return vieja ? deNumeracionVieja(vieja) || '0.0.1' : null;
}
/* A cada uno, lo que le afecta: el dueño (Carlos, el admin de los avisos) lo ve todo; los demás, ni los arreglos ni lo
   «menor» (detalles, cosas de dentro) ni lo que es de otra versión de la app: «para» 'play' (la de Google Play),
   'app' (Android), 'web' (iPhone y ordenador) o 'dueño' (solo él) */
fijarFiltroNovedades((c) => {
  if (avisosGuardados().admin) return true;
  if (c.tipo === 'arreglo' || c.menor || c.para === 'dueño') return false;
  if (c.para === 'play') return topConAnuncio();
  if (c.para === 'app') return enApp;
  if (c.para === 'web') return !enApp;
  return true;
});
/** al estrenar versión, las novedades contadas bajando; la primera vez que se instala, nada */
function novedades() {
  const vista = versionVista();
  LS.set('version-vista2', VERSION);
  // a quien acaba de llegar (aún no ha pasado el tutorial) no se le cuentan las novedades de cada versión que le llega
  // sola: le basta con el tutorial. Las de después, sí
  if (!tourVisto()) return;
  if (!vista || cmpVer(vista, VERSION) >= 0 || !hayNovedadesDesde(vista)) return;
  verNovedades(vista);
}
function verNovedades(desde) {
  presentarNovedades(desde, {
    alIr: (a) => { if (!a || !S.D) return; if (a.seg) { const [v, sg] = a.seg.split(':'); S.seg[v] = sg; } ir(a.v); },
    alLista: () => listaVersiones(),
    alCerrar: () => quizaTutorial(700),
  });
}
function listaVersiones() {
  abrirHoja(`<div class="hoja-cab"><h2>Novedades</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <button class="btn chico" data-accion="presentacion" style="margin:0 0 6px">${icono('ia')}Ver la ${((versionesDesde(null)[0] || {}).v || VERSION).replace(/\.0$/, '')} en presentación</button>${listaNovedades()}`);
}

/* ---------------- el tutorial ---------------- */
function salirDemo() {
  if (trasCargar(salirDemo)) return;
  cerrarHoja(true); LS.del('demo'); S.D = null; S.planEstado = {};
  if (!enApp && !enWeb) { LS.set('demo', true); tostada('En este navegador solo se puede ver el ejemplo'); cargar(); }
  else if (haySesion()) { S.D = foto(); if (S.D) { rehacer(); pintar(); cargar({ silencio: true }); } else cargar(); }
  else pantallaEntrar();
  mirarLimite();
}
/** lo que conviene hacer para empezar (al final del tutorial) */
function itemsEmpezar() {
  if (enDemo()) return [{ k: 'cuenta', ok: false, ic: 'usuario', t: 'Entra con tu cuenta de LaLiga', x: 'Lo mismo, con tu liga de verdad. Entras en la página oficial de LaLiga: la app nunca ve tu contraseña.', b: 'Entrar' }];
  const l = [{ k: 'clave', ok: hayClave(), ic: 'ia', t: 'Activa la IA, gratis', x: 'Una clave gratis de Google en unos 3 minutos: el plan lee las noticias y puedes preguntarle lo que quieras.', b: 'Activar' }];
  if (enApp) l.push({ k: 'avisos', ok: nativo.avisosPermitidos() && cfgAvisos().on, ic: 'campana', t: 'Activa los avisos', x: 'Cuando se abre una cláusula que te interesa, cuando cambia el mercado y cuando está tu plan.', b: 'Activar' });
  return l;
}
function pasosTour() {
  const demo = enDemo(), conClave = hayClave();
  const liga = S.D && S.D.liga && !demo ? S.D.liga.nombre : 'tu liga';
  return [
    { logo: true, t: 'Bienvenido a Fantasy Manager', x: `Cada día te digo qué hacer en ${liga}: a quién vender, a quién clausular y cuánto pujar. Te enseño dónde está cada cosa en un minuto.` },
    { v: 'hoy', sel: '.marcador', t: 'Tu equipo de un vistazo', x: 'Tu saldo y lo que puedes gastar de verdad (con lo que te dejan quedarte en negativo y quitando tus pujas), lo que vale tu equipo y tu puesto. Tócalo para ver el detalle.' },
    { v: 'hoy', sel: '.tiempos', si: () => !!$('.tiempos'), t: 'Lo que viene', x: 'Cuándo cambia el mercado, cuándo se abre la cláusula de uno tuyo y las de rivales que te interesan. Toca uno para ir a él.' },
    { v: 'hoy', sel: '.llevas', si: () => !!$('.llevas'), t: 'Lo que llevas hoy', x: 'Lo que has hecho de verdad en LaLiga desde el último cambio de mercado: lo terminado, lo que está en marcha (pujas, ofertas, lo que tienes a la venta) y si venía en el plan o fue por tu cuenta. Sale al darle a Actualizar.' },
    { v: 'hoy', sel: '.plan-cab', con: ['.plan-sit', '.plan-titular'], si: () => !!$('.plan-cab'), t: 'Tu plan de hoy', x: 'Las operaciones exactas para hoy, en orden y con el saldo que te queda después de cada una. Cuando hagas una en LaLiga, el paso se tacha solo (o lo marcas tú con «Hecho»). Si algo no se puede hacer, la app lo tacha y te dice por qué.' },
    conClave
      ? { v: 'hoy', sel: '.plan-otro', si: () => !!$('.plan-otro'), t: 'Otro plan, cuando quieras', x: 'La IA hace el plan sola cada mañana y cuando cambia el mercado. Con este botón le pides otro, por ejemplo después de vender a alguien. Si tu plantilla cambia sin que el plan lo dijera, te lo propone arriba, en amarillo.' }
      : { v: 'hoy', sel: '.plan .caja', si: () => !!$('.plan .caja'), t: 'Con la IA, mejor', x: 'Sin IA, el plan sale de los números. Con una clave gratis de Google, la IA lee noticias, lesiones y onces probables antes de decidir, y le puedes preguntar. Se activa en la pestaña Pregunta.' },
    { v: 'hoy', sel: '#bRefrescar', t: 'Actualizar', x: 'Trae lo último de LaLiga: saldo, mercado, pujas y clasificación. Solo usa la IA si tu plan es de antes del último cambio de mercado. Se hace solo al abrir la app; tócalo después de hacer algo en LaLiga.' },
    { v: 'hoy', sel: '#bAvisos', con: '.sup-btns [data-accion="ajustes"]', t: 'Fallo y Ajustes', x: '«Fallo», si algo no funciona o no cuadra: me llega a mí y te contesto aquí mismo. En «Ajustes», tu clave de la IA, los avisos, abrir la app en el ordenador o el iPhone y este tutorial.' },
    { v: 'hoy', sel: '#supQueda', si: () => estadoLimite.min != null && !!$('#supQueda') && !$('#supQueda').hidden, t: 'Tus minutos de hoy', x: () => `En tu liga hay ${estadoLimite.min} minutos al día, sumando la app y la web. Aquí ves los que te quedan.` },
    { v: 'equipo', sel: '.nav [data-ir="equipo"]', t: 'Equipo', x: 'Tus jugadores: si suben o bajan, sus cláusulas y quién de tu liga puede pagarlas, y tu mejor once con las formaciones gratis.' },
    { v: 'directo', sel: '.nav [data-ir="directo"]', t: 'Directo', x: 'La jornada mientras se juega: los marcadores, los puntos de cada jugador y de quién es en tu liga, tu once con lo que lleva cada uno y cómo va tu liga. Toca un partido para verlo jugador a jugador.' },
    { v: 'rivales', sel: '.nav [data-ir="rivales"]', t: 'Rivales', x: 'Las cláusulas de los demás que te llegan con tu dinero, cuándo se abren las que están protegidas y lo que ha hecho cada uno.' },
    { v: 'mercado', sel: '.nav [data-ir="mercado"]', t: 'Mercado', x: 'Cuánto pujar por cada libre según lo que se paga en tu liga, qué ofrecer a otro mánager para que te venda y quién sube y quién baja.' },
    { v: 'clubes', sel: '.nav [data-ir="clubes"]', t: 'Clubes', x: 'Los 20 de LaLiga por la clasificación. En cada uno, su próximo partido, el once probable en el campo, las bajas, sus partidos y la plantilla con lo que vale cada jugador y de quién es en tu liga.' },
    { v: 'ia', sel: '.nav [data-ir="ia"]', t: 'Pregunta', x: conClave ? 'Pregúntale a la IA lo que quieras de tu liga, por ejemplo «¿clausulo a este o espero?». También le puedes mandar capturas.' : 'Aquí le preguntas a la IA lo que quieras de tu liga, también con capturas. Necesita la clave gratis de Google, y aquí mismo te explica cómo sacarla.' },
    demo
      ? { v: 'hoy', t: 'Esto era la liga de ejemplo', x: 'Con datos inventados. Cuando quieras, entra con tu cuenta y lo tendrás con tu liga. El tutorial queda en Ajustes.', lista: itemsEmpezar, fin: 'Seguir mirando' }
      : { v: 'hoy', t: 'Para empezar', x: () => (itemsEmpezar().some((y) => !y.ok) ? 'Esto se hace una vez (si no, lo tienes en Ajustes). Después, empieza por el paso 1 de tu plan de hoy.' : 'Ya lo tienes todo. Empieza por el paso 1 de tu plan de hoy. El tutorial queda en Ajustes por si quieres repetirlo.'), lista: itemsEmpezar, fin: 'Ver mi plan', finAccion: 'plan' },
  ];
}
/** abre el tutorial desde el principio (desde Ajustes, o la primera vez) */
function lanzarTutorial() {
  if (!S.D || tourAbierto()) return;
  cerrarHoja(true);
  if (S.vista !== 'hoy') ir('hoy');
  window.scrollTo(0, 0);
  setTimeout(() => empezarTour({
    pasos: pasosTour(),
    vista: () => S.vista,
    ir: (v) => { ir(v); window.scrollTo(0, 0); },
    alAcabar: (como) => {
      if (S.vista !== 'hoy' || como === 'saltar') ir('hoy');
      if (como === 'saltar') { window.scrollTo(0, 0); tostada('El tutorial está en Ajustes cuando quieras', 3500); }
      else if (como === 'plan' || como === 'fin') { const pl = $('.plan'); if (pl) window.scrollTo({ top: pl.getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' }); }
      else if (como === 'clave') ir('ia');
      else if (como === 'avisos') { if (!cfgAvisos().on) guardarCfgAvisos({ on: true }); nativo.pedirPermisoAvisos(); tostada('Avisos activados', 3000); }
      else if (como === 'cuenta') salirDemo();
    },
  }), 250);
}
/** la primera vez (o al abrirse la app a la hora): el tutorial, si no se ha visto y no hay nada delante */
function quizaTutorial(ms, intento = 0) {
  if (tourVisto() || !S.D || estadoLimite.cerrada) return;
  setTimeout(() => {
    if (tourVisto() || tourAbierto() || !S.D || estadoLimite.cerrada || S.cargando && !S.D) return;
    // con la presentación de novedades o una ventana abierta, se espera
    if ($('.nv') || S.hoja || $('#limite')) { if (intento < 20) quizaTutorial(3000, intento + 1); return; }
    lanzarTutorial();
  }, ms);
}

/* ---------------- arranque ---------------- */
async function arrancar() {
  const h = ALIAS[location.hash.slice(1)] || location.hash.slice(1);
  if (VISTAS[h]) S.vista = h;
  const aFallos = h === 'fallos';
  if (aFallos) history.replaceState(null, '', '#hoy');
  // venía de la web de antes con un código de mudanza
  await codigoDeMudanza();
  if ((enApp || enWeb) && !enDemo() && !haySesion()) {
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
    // venía de tocar la notificación de una respuesta a tu aviso de fallo
    if (aFallos && S.D) setTimeout(() => { if (!S.hoja) abrirAvisos(); }, 400);
  }
  // por si la vuelta del inicio de sesión llegó antes de que la web estuviera lista
  if (enApp) setTimeout(() => window.vueltaLogin(), 300);
  // el límite de uso diario (web/limites.json): cuenta el tiempo con la app a la vista
  // (tu equipo de verdad, el de tu cuenta de LaLiga: no el que se elige a mano en Ajustes)
  iniciarLimite(() => {
    const yo = S.D && S.D.yo, cl = (S.D && S.D.clasif) || [];
    const real = yo && yo.userId ? cl.find((e) => e.userId === yo.userId || e.managerId === yo.userId) : null;
    const eq = real || (S.M && S.M.yo) || null;
    return { yo: eq ? { nombre: eq.nombre, teamId: eq.teamId, userId: yo && yo.userId, ligas: (S.D && S.D.ligas) || [] } : null, demo: enDemo() };
  }, (t) => tostada(t, 6000), () => {
    tostada('¡Ya está abierta! Pongo tu liga al día', 5000); sinErrorPlan();
    if (!S.cargando) cargar({ silencio: true });
    // el tutorial, que no se ha visto con la app cerrada
    quizaTutorial(1800);
  }, () => { if (S.D && S.M) programar(S.D, S.M); });
  novedades();
  quizaTutorial(2500);
  setTimeout(() => buscarVersion(false), 4000);
  // la IA con la app cerrada avisa con notificaciones: se pide el permiso una vez
  if (enApp && !enDemo() && haySesion() && cfgFondo().on && !nativo.avisosPermitidos() && !LS.get('permiso-fondo')) {
    LS.set('permiso-fondo', Date.now());
    setTimeout(() => nativo.pedirPermisoAvisos(), 2500);
  }
  // cada minuto se recalculan las cuentas atrás, si no estás tocando nada
  let toqueT = 0;
  for (const e of ['touchstart', 'pointerdown', 'scroll', 'keydown']) window.addEventListener(e, () => { toqueT = Date.now(); }, { passive: true });
  setInterval(() => {
    if (!S.D || S.hoja || S.cargando || S.charlando || S.planEstado.cargando || S.vista === 'ia' || tourAbierto() || document.visibilityState !== 'visible' || Date.now() - toqueT < 30e3) return;
    const y = window.scrollY;
    const ap = S.M && S.M.aprende;
    S.M = analizar(S.D, S.H, S.c, extraM());
    S.M.aprende = ap;
    fijarMotor(S.M);
    montarPlan();
    pintar();
    window.scrollTo(0, y);
  }, 60e3);
  // con la jornada en juego, los puntos en directo cada 2 minutos; cada minuto en Directo o con la ficha de un partido
  // abierta (y se pinta lo que haya abierto, si no estás tocando nada)
  setInterval(async () => {
    if (!S.D || !S.M || !S.M.enJuego || S.cargando || document.visibilityState !== 'visible') return;
    const prisa = S.vista === 'directo' || (S.tipoHoja && (S.tipoHoja[0] === 'p' || (S.tipoHoja[0] === 'j' && $('#vivo-j'))));
    if (!prisa && S.vivo && Date.now() - S.vivo.t < 2 * MIN - 5e3) return;
    if (!(await cargarVivo())) return;
    if (S.tipoHoja && S.tipoHoja[0] === 'p') { const [n, id] = S.tipoHoja[1].split(':'); cargarPartido(Number(n), id); }
    if (S.tipoHoja && S.tipoHoja[0] === 'j' && $('#vivo-j')) cargarDetalle(S.tipoHoja[1]);
    if (Date.now() - toqueT < 8e3 && !S.hoja) return;
    pintarVivo();
  }, MIN);
  // las alineaciones confirmadas salen una hora antes de cada partido: mientras falte alguna, se mira cada 3 minutos
  // (solo eso, sin recargar la liga); lo pinta la vuelta de cada minuto de arriba
  setInterval(() => {
    if (!S.D || S.cargando || document.visibilityState !== 'visible' || !faltaOnce(S.D)) return;
    alineaciones(S.D).then((a) => { if (a) S.fuentes = { ...(S.fuentes || fuentesGuardadas() || {}), alineaciones: a }; }).catch(() => {});
  }, 3 * MIN);
}

// todos los módulos han cargado: la web arranca bien (si era una bajada sin reinstalar, la app se la queda)
nativo.webViva();
if (!EN_FONDO) { const wp = LS.get('web-puesta', null); if (wp) { LS.del('web-puesta'); if (Date.now() - wp.t < 120000 && tourVisto()) setTimeout(() => tostada(`App al día: versión ${VERSION}`, 4000), 1800); } }
if (EN_FONDO) trabajoFondo(); else arrancar();
