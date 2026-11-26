/* Fantasy Manager: arranque, navegación, carga de datos, el plan del día y todo lo que pasa al tocar algo. */
import { esc, norm, icono, botonPlay, PLAY_URL, APP_STORE_URL, LOGO, LOGO_P, LOGO_D, $, $$, LS, guardarTexto, almacenLleno, olvidarLleno, eur, rel, dura, ponerCuentas, MIN, HORA, DIA, diaDe, enParalelo, cuando as cuandoT, horaDe, firmaDe, fechaLarga } from './util.js';
import { enApp, enWeb, enInicio, enIPhone, nativo, http, guardar, WORKER, WORKER_PUBLICO, despues as relojFijo } from './puente.js';
import { haySesion, empezarLogin, prepararLogin, marcarAbierto, mirarVuelta, terminarLogin, cerrarSesion, sesion, quien } from './auth.js';
import { actualizar, foto, historico, cfg, guardarCfg, enDemo, carasDemo, pasosCarga, borrarTodo, borrarCuenta, completar, detalles, K, fuentesExternas, fuentesGuardadas, actHist, ponerCaras } from './datos.js';
import { aprender, calibracion } from './aprende.js';
import { analizar, rematarAuto, efectoTras, comoVenia } from './motor.js';
import { planDeHoy, rematarMotor } from './plan.js';
import * as V from './vistas.js';
import * as Hj from './hojas.js';
import { ponerApodo, sincronizarApodos } from './apodos.js';
import { iniciarSinc, sincronizar, sincAntes } from './sinc.js';
import * as Dr from './directo.js';
import * as Pz from './paron.js';
import * as Cl from './clubes.js';
import * as Bj from './bajas.js';
import * as Tj from './tarjetas.js';
import { programar, cfgAvisos, guardarCfgAvisos, ponerAntes, avisarJugador, antesTxt } from './avisos.js';
import { planDelDia, planViejo, planViejoAuto, planesApp, puedePlanIA, cupoPlanes, ultimoPlan, cuadrarPlan, charlar, puedeChat, preguntasApp, preguntaPendiente, reanudarPregunta, migrarMinis, guardarClave, probarClave, guardarCfgIA, cfgIA, borrarConversacion, hayClave, clave, intentosIA, borrarNota, apuntarDicho, planGuardadoHoy, cambioLocal, quitarUltimaPregunta, notasVigentes, nuevoChat, recuperarChat, borrarChatAnterior, conversacion, guardarChat, chatsAnteriores, enAppIos, iaPermitida, permisoIA, planIASolo, ponerPermisoIA } from './ia.js';
import { pedirPermisoIA } from './permiso-ia.js';
import { ultimaVersion, api, apuntarRegistro, nuevaCarga } from './api.js';
import { detalleJugador, lista as listaN } from './normalizar.js';
import { linea } from './graficos.js';
import { md } from './texto.js';
import { ponerEquipos, BLOQUEO, fijarMotor, dondeTop, selloTop } from './comunes.js';
import { encuadrar } from './caras.js';
import { qrSVG } from './qr.js';
import { historialValor, alineaciones, faltaOnce, jugadasSofa, noticiasClub, ANTES_ONCE } from './externas.js';
import { enVivo, onceRival, jornadaStats, idsOnce, formaOnce, hechosSemana, muestraSemana, guardarMuestraVivo } from './vivo.js';
import { jornadaElegida, estadoJornada, jornadasAcabadas } from './jornadas.js';
import * as Jo from './jornadas.js';
import { titularesClub } from './espn.js';
import { VERSION, NOVEDADES, cmpVer, deNumeracionVieja } from './version.js';
import { leerCodigoEnlace, leerCodigoPlay, viaPendiente, codigoPendiente, leerInvitar, miCodigo, canjear, elegirRivales, textoInv, enlaceInv, puedeCanjear, pareceInvitado, codigoPropuesto, avisarLlegada, playConCodigo, estadoInv, porElegir, sinIntersticiales, semanaDoble, cfgInv, limpiarCod, invitarOn } from './invitar.js';
import { comprobarFotos, iniciarLimite, mirarLimite, estadoLimite, versionNueva, fijarYo, fijarLiga, fijarJornada, bloqueada, otrasLigasCfg, topConAnuncio, planesCfg, anuncioTopVisto, abrirTopGratis, puedeTopGratis, usosQuedan, proximoCierreTop, POR_JORNADA, abiertaHasta, minutosRival, anunciosWebModo, novedadesPara, importantesPara, cierreApk, playDesfasada, iosDesfasada, intersticialCfg, intersticialParaMi, aperturaCfg } from './limite.js';
import { AISTUDIO, limpiarClave, pareceClave, marcarAIStudio, vieneDeAIStudio, aPegar, leerCasilla } from './clave.js';
import { prepararArchivo, prepararB64, leerFoto, MAX_FOTOS, capturaArchivo, capturaB64, miniDe, cargarMinis } from './fotos.js';
import { explicarError, bandaError, botonesError, apuntarError } from './errores.js';
import { borrarMisDatos, misAvisos, mandarAviso, marcarVisto, veTodo, todosAvisos, unAviso, capturaAviso, responderAviso, escribirAviso, fijarPendientes, numeroAvisos, hayQueMirar, avisosGuardados, saludar, quienUsa, carasLiga, bienvenidaVista, apuntarBienvenida, apuntarNovDinero, mejorarIA, ponerMejorarIA, huellaDinero, mandarDinero, calDineroGuardada, leerCalDinero, huellaCompra, mandarCompras, calPujasGuardada, leerCalPujas, huellaLiga, huellaApertura, mandarLigas, verOtrasLigas } from './soporte.js';
import * as DD from './dinero-dicho.js';
import { presentarNovedades, tarjetaNovedad, tarjetaIphone, cerrarPresentacion, listaNovedades, fijarFiltroNovedades, hayNovedadesDesde, versionesDesde, listaImportantes, hayImportantes, ultimaImportante } from './presentacion.js';
import { empezarTour, cerrarTour, tourAbierto, tourVisto, tourBasico } from './tour.js';
import { cambiarFav } from './favoritos.js';
import { registrarPujas } from './pujas-vistas.js';
import * as OL from './otras-ligas.js';
import { anunciosWeb, privacidadWeb } from './anuncios-web.js';
import { arrancarIntersticiales, quizaIntersticial, bonificadoVisto, aperturaToca, estadoIntersticial } from './intersticial.js';
import { seccionMoviles, ponerCarasPortada, activarPortada, barraPortal, portalHTML, tiraPortada } from './portada.js';
import { dibCopiar, dibAbrirCon } from './guiadib.js';
import { poner as ponerCarasDemo } from './caras-demo.js';
import { cerrar, abrir, claveQR, idDeCodigo, nuevoCodigo as codigoNuevo } from './sobre.js';
import { contar } from './eventos.js';
import { estadoHTML, pintarEstado, marcarPaso, pasoDeFallo, leerOrigen, origenActual, canalPaso, esPrueba } from './semaforo.js';
import { turnoPendiente, intentarTurno, proximoTurno, cfgHoras, guardarCfgHoras } from './planes-hora.js';
import { EN_FONDO, cfgFondo, guardarCfgFondo, deNoche, callado, avisoPlan, avisosNuevos, sinAvisar, marcarVistos } from './fondo.js';
import { plegarAviso } from './avisos-ficha.js';

const S = { D: null, H: null, M: null, c: cfg(), det: {}, plan: null, planEstado: {}, opPorPid: {}, vista: 'hoy', seg: {}, filtro: {}, ordenEq: LS.get('orden-equipo', 'puesto'), cargando: false, hoja: null, tipoHoja: null, charlando: false, parcial: '', pasoChat: '', nueva: null, adjuntos: [], fotosActuales: [], preparandoFotos: 0 };
window.S = S;
// (22 nov) para las pruebas: el análisis otra vez, como tras apuntar algo que le cuentas a la IA
window.__fmRehacer = () => { if (S.D) rehacer(); };
// (26 nov) lo que se manda y se lee de lo de todas las ligas, para probarlo de punta a punta (.github/ia/caso-otras-ligas.mjs)
window.__fmLigas = { compras: () => comprasSiToca(), ligas: () => ligasSiToca(), otras: () => otrasSiToca() };
// la app ha arrancado: el aviso de index.html («no ha podido abrirse») ya no sale, y si ya había salido se quita
window.__fmArranco = true;
try { const f = document.querySelector('.arranque-fallo'); if (f) f.remove(); } catch (e) { /* nada */ }
// (21, 9 nov) en el parón, en el sitio de Directo va la pestaña Parón, con un selector para seguir viendo el Directo
const VISTAS = { hoy: V.hoy, equipo: V.equipo, directo: Pz.vistaDirecto, rivales: V.rivales, mercado: V.mercado, clubes: Cl.clubes, ia: V.ia };
const ALIAS = { inicio: 'hoy', analisis: 'ia', chat: 'ia', vivo: 'directo', equipos: 'clubes' };
const NAV = [['hoy', 'rayo', 'Hoy'], ['equipo', 'equipo', 'Equipo'], ['directo', 'directo', 'Directo'], ['rivales', 'rivales', 'Rivales'], ['mercado', 'mercado', 'Mercado'], ['clubes', 'club', 'Clubes']];
// Pregunta (la IA) no va en la barra de abajo: con 7 pestañas no cabían bien. Va arriba, en rojo (lo pidió Carlos el 25 oct)
const raiz = () => document.getElementById('app');

/* ---------------- avisos de abajo ---------------- */
let relojT;
/** copia y lo dice; si el navegador no deja, también lo dice */
function copiarY(t, bien = 'Copiado') {
  Promise.resolve(nativo.copiar(t)).then((ok) => tostada(ok === false ? 'El navegador no deja copiar: mantén pulsado el texto y cópialo a mano' : bien), () => tostada('No se ha podido copiar'));
}
function tostada(t, ms = 3200) {
  let el = $('.tostada');
  if (!el) { el = document.createElement('div'); el.className = 'tostada'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.textContent = t; el.classList.add('on');
  clearTimeout(relojT); relojT = setTimeout(() => el.classList.remove('on'), ms);
}

/* ---------------- pantallas completas ---------------- */
const PIE_ENTRAR = '<p class="peq apag" style="margin-top:14px">App no oficial: no es de LaLiga ni tiene relación con LaLiga. Lee tu liga con tu propia cuenta, como su app, y la usas bajo tu responsabilidad; tu contraseña nunca la ve. <a href="privacidad.html">Privacidad</a> · <a href="condiciones.html">Condiciones</a></p>';
/** lo que es la app, en grande: dentro de la app, arriba de lo de entrar; en la web, en su apartado «La app» */
const heroApp = (h = 'h1', id = '') => `<${h}${id ? ` id="${id}"` : ''} class="hero-t">Fantasy<br><span>Manager</span></${h}>
    <p>Tu director deportivo para LaLiga Fantasy: cada día te dice a quién vender, a quién comprar, cuánto pujar y a quién clausular.</p>
    <ul class="lista-ok">
      <li>${icono('rayo')}Plan del día paso a paso, con el saldo después de cada operación</li>
      <li>${icono('ia')}La IA lee lesiones, convocatorias, alineaciones y el calendario antes de decidir</li>
      <li>${icono('diana')}Aviso al minuto cuando se abre una cláusula que te interesa</li>
      <li>${icono('rivales')}Lo que hace cada rival y quién va a por tus jugadores</li>
    </ul>`;
function pantallaEntrar(error = '') {
  ponerBanner(false);
  // dentro de la app, solo lo de entrar. En la web (0.7.13m, Carlos 15 nov 23:51: el portal a la vista), arriba la barra fija
  // con el portal y Google Play; a la izquierda (en el móvil, lo primero) el portal con «Hoy»; a la derecha, lo de entrar, sin
  // tocar; y debajo, en su apartado «La app», lo que es la app y los móviles
  const mudanza = enWebVieja ? '<a class="aviso-mudanza" href="https://fantasymanagerapp.com/">La web ahora está en <b>fantasymanagerapp.com</b> →</a>' : '';
  // (21 nov) en el iPhone, lo de entrar es lo primero de la página y no sale nada de Google Play arriba (ni el botón rojo
  // ni la insignia); en el ordenador, «Entrar» en rojo en la barra. En la web de un Android, como estaba
  const plat = enApp ? '' : (movilDe() || 'pc');
  // (21 nov) la llegada desde un anuncio en el iPhone (?utm_source=…, que se guarda 7 días): dos frases de qué es la app y
  // el botón de entrar en la primera pantalla, sin el menú del portal por encima, sin nada de Google Play y con el
  // semáforo de LaLiga debajo
  // (24 nov) los que llegan desde un botón de las páginas de datos (utm_source=web-…) o del QR del ordenador no vienen de
  // un anuncio: ven la portada normal
  const llegada = plat === 'iphone' && !!origenActual() && !/^(web-|qr$)/.test(origenActual());
  // (24 nov, Carlos: «que arriba se entienda que lo que importa es la aplicación, meterte dentro con tu cuenta y no ver los
  // datos desde fuera») lo primero de la portada es qué es la app y cómo tenerla en tu dispositivo (`tenlaHTML`): en el
  // ordenador y en la web de un Android, encima del portal; en el iPhone, encima de los tres pasos de entrar
  // (25 nov) quien llega con el enlace de un amigo a la web de un Android se va a descargar la app de Google Play, que no
  // recibe el enlace: el código, en grande y arriba del todo, con un botón que lo copia y abre Google Play
  const invLlega = !enApp && plat === 'android' && codigoPendiente() ? tarjetaInvLlega(codigoPendiente()) : '';
  const izq = enApp ? `<div class="pant-top">${LOGO}</div>${heroApp('h1')}${mudanza}` : `${mudanza}${invLlega}${portalHTML(plat === 'iphone' || llegada ? '' : tenlaHTML(plat))}`;
  const queEs = llegada ? `<div class="lleg"><h1 class="lleg-t">Tu director deportivo para <span>LaLiga Fantasy</span></h1><p>Cada día te dice a quién vender, a quién fichar, cuánto pujar y a quién clausular en tu liga. Es gratis y entras con tu cuenta de LaLiga.</p></div>` : '';
  raiz().innerHTML = `<div class="portada${enApp ? '' : ` web p-${plat}${llegada ? ' p-llegada' : ''}`}">${enApp ? '' : barraPortal(plat) + tiraPortada()}<div class="pantalla"><div class="pant-i">${izq}</div><div class="pant-d" id="entrar">
    ${error ? `<div class="error-c" role="alert" style="margin:0 0 16px">${esc(error)}</div>` : ''}
    ${queEs}
    ${!enApp && plat === 'iphone' && !llegada ? tenlaHTML('iphone') : ''}
    ${llegada ? '' : estadoHTML()}
    ${invitacionViva() ? `<div class="invita">${icono('rivales')}<span><b>Te han invitado desde tu liga.</b> Entra con tu cuenta de LaLiga Fantasy y se abre esa liga.</span></div>` : ''}
    ${enApp ? `<div class="invita">${icono('alerta')}<span><b>La página de LaLiga suele fallar a la primera.</b> Si te sale «Lo sentimos, tenemos problemas para iniciar su sesión», no es cosa tuya ni de la app: ciérrala y vuelve a darle a «Entrar». A la segunda suele ir bien.</span></div>
    ${abrirConVisto() && !nativo.authTab() ? avisoAbrirCon() : ''}
    <button class="btn ancho" data-accion="entrar">${icono('usuario')}Entrar con mi cuenta de LaLiga</button>
    <p class="peq apag" style="margin-top:12px">Se abre la página de LaLiga: entra como siempre (con Google, si es como lo haces). Al terminar vuelves aquí.</p>${botonDemo('sec')}` : entrarWebHTML(llegada)}
    ${llegada ? estadoHTML() : ''}
    ${PIE_ENTRAR}
  </div></div>${enApp ? '' : `<section class="po-app" id="pApp" aria-labelledby="pAppT"><div class="po-hero"><div class="ps-k">La app</div>${heroApp('h2', 'pAppT')}</div>${seccionMoviles(plat)}</section>`}</div>`;
  // la portada de la web: lo que se toca (el once, los casos, las calculadoras) y las caras y escudos de LaLiga
  if (!enApp) { activarPortada(); ponerCarasPortada(carasDemo()); ponerInstalar(); }
  // (0.7.13i) el semáforo de LaLiga y el paso «ha visto la pantalla de entrar» (una vez al día), sin cuenta
  pintarEstado();
  // (21 nov) en la app, «ver» es ver esta pantalla. En la web la portada se le pinta a cualquiera sin sesión (también a
  // quien viene a leer el mercado): eso es «llega», y «ver» solo cuenta cuando lo de entrar aparece en pantalla
  if (enApp) marcarPaso('ver', { una: true });
  else { marcarPaso('llega', { una: true }); vigilarVer(); }
  // en el ordenador, el QR para entrar escaneándolo con la app del móvil (0.6.12) va plegado en el bloque de Android: se
  // pide y se espera al móvil solo mientras está desplegado (el «toggle» de más abajo)
  pararQR();
  // (0.8l) en la web, el enlace a LaLiga en su botón y, si ya se abrió, el paso de pegar por delante
  if (!enApp) prepararEntrada();
}
/** (21 nov) apunta «ver» cuando el botón de entrar de esta pantalla (o, si va plegado, su bloque) está a la vista */
let verObs = null;
function vigilarVer() {
  if (verObs) { verObs.disconnect(); verObs = null; }
  const b = $('#edAbrir');
  // (en la web de un Android el botón va dentro de un desplegable cerrado: ahí vale su bloque)
  const el = b && !b.closest('details:not([open])') ? b : $('#entrar .plat') || $('#entrar');
  if (!el) return;
  if (typeof IntersectionObserver !== 'function') { marcarPaso('ver', { una: true }); return; }
  verObs = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) return;
    verObs.disconnect(); verObs = null;
    marcarPaso('ver', { una: true });
  }, { threshold: [0.5] });
  verObs.observe(el);
}
/* ---------------- la app de Android: «Abrir con» y la vuelta sin código (21 nov) ----------------
   Con LaLiga Fantasy instalada, las dos apps recogen la misma vuelta (authredirect://com.lfp.laligafantasy) y Android
   pregunta «Abrir con». Quien elige la otra se queda fuera y aquí no llegaba nada: de 102 toques a «Entrar» salían 62
   entradas y 3 fallos apuntados (análisis del 21 nov). Dos cosas, solo con la web:
   1. el aviso de «elige Fantasy Manager», grande y con el dibujo del cuadro, justo antes de abrir LaLiga. La primera vez
      en este móvil es un paso propio (un toque más, una sola vez); después va encima del botón, sin toques de más;
   2. si se vuelve a la app y a los 3 s no ha llegado la vuelta, la pantalla «¿No has vuelto solo?» con las dos salidas
      y un botón para repetir, y el paso «x-vuelve» en el embudo.
   Con Auth Tab (la parte nativa de esta sesión, `nativo.authTab()`), Android no pregunta: sin aviso, y la pantalla solo
   habla del error de LaLiga. */
const abrirConVisto = () => !!LS.get('abrir-con', false);
const avisoAbrirCon = (grande = false) => `<div class="abrir-con${grande ? ' grande' : ''}">
    <figure>${dibAbrirCon()}</figure>
    <p><b>Al terminar, Android puede preguntarte con qué app abrir.</b> Elige <b>Fantasy Manager</b> y <b>Solo una vez</b>. Si eliges LaLiga Fantasy, te quedas fuera.</p></div>`;
/** el paso propio de la primera vez: el aviso y, debajo, el botón que ya abre LaLiga */
function pantallaAbrirCon() {
  ponerBanner(false);
  raiz().innerHTML = `<div class="portada"><div class="pantalla pant-aviso" id="pantAbrirCon">
    <h1 class="av-t" tabindex="-1">Antes de abrir LaLiga</h1>
    ${avisoAbrirCon(true)}
    <button class="btn ancho" data-accion="entrarYa">${icono('usuario')}Entendido: abrir LaLiga</button>
    <button class="btn ancho sec" data-accion="volverEntrar" style="margin-top:10px">Volver</button>
  </div></div>`;
  const t = $('.av-t'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
  window.scrollTo(0, 0);
}
/** abre LaLiga desde la app y deja apuntado que se ha salido a entrar (aguanta que Android cierre la app mientras) */
async function abrirLaLigaApp() {
  LS.set('abrir-con', true);
  contar('l'); marcarPaso('l');
  S.loginFuera = Date.now();
  LS.set('login-fuera', S.loginFuera);
  try { await empezarLogin(); } catch (e) { S.loginFuera = 0; LS.del('login-fuera'); pantallaEntrar(e.message); }
}
const loginFuera = () => { const t = S.loginFuera || Number(LS.get('login-fuera', 0)) || 0; return t && Date.now() - t < 20 * MIN ? t : 0; };
function sinLoginFuera() { S.loginFuera = 0; LS.del('login-fuera'); if (S.relojVuelve) { S.relojVuelve(); S.relojVuelve = null; } }
/** de vuelta en la app tras abrir LaLiga: si en 3 s no llega la vuelta con el código, se pregunta qué ha pasado.
    `cerrada`: la parte nativa sabe que la pestaña se cerró sin terminar (Auth Tab): no hace falta esperar */
function mirarSinCodigo({ cerrada = false } = {}) {
  if (!enApp || !loginFuera() || haySesion() || S.relojVuelve) return;
  S.relojVuelve = relojFijo(cerrada ? 800 : 3000, () => {
    S.relojVuelve = null;
    if (!loginFuera() || haySesion() || S.entrandoApp) return;
    sinLoginFuera();
    marcarPaso('x-vuelve');
    pantallaNoVuelto();
  });
}
window.loginCerrado = () => mirarSinCodigo({ cerrada: true });
function pantallaNoVuelto() {
  ponerBanner(false);
  const auth = nativo.authTab();
  const otraApp = auth ? '' : `<section class="nv-c" aria-labelledby="nvA">
      <h2 id="nvA">${icono('alerta')}Se abrió LaLiga Fantasy en vez de esta app</h2>
      <p>Android preguntó con qué app abrir y se fue a la otra. Repite y, cuando pregunte, elige <b>Fantasy Manager</b> y <b>Solo una vez</b>.</p>
      <figure>${dibAbrirCon()}</figure>
      <details class="nv-d"><summary>No me ha preguntado: se abre LaLiga Fantasy directamente</summary>
        <p>Es que alguna vez elegiste «Siempre». Se quita en los ajustes del móvil:</p>
        <ol><li>Abre <b>Ajustes</b> y entra en <b>Aplicaciones</b>.</li>
        <li>Toca <b>LaLiga Fantasy</b> (si no sale, <b>Ver todas las aplicaciones</b>).</li>
        <li>Toca <b>Abrir de forma predeterminada</b> y luego <b>Borrar preferencias predeterminadas</b>.</li></ol>
        <p>En algunos móviles (Samsung) ese apartado se llama <b>Establecer como predeterminada</b> y el botón, <b>Borrar valores predeterminados</b>. No se borra nada de LaLiga Fantasy: solo vuelve a preguntar.</p></details>
    </section>`;
  raiz().innerHTML = `<div class="portada"><div class="pantalla pant-aviso" id="pantNoVuelto">
    <h1 class="av-t" tabindex="-1">¿No has vuelto solo?</h1>
    <p class="nv-i">Al terminar en la página de LaLiga, esta app se abre sola con tu liga. Si no ha pasado, ${auth ? 'lo más normal es esto' : 'ha sido una de estas dos cosas'}:</p>
    ${otraApp}
    <section class="nv-c" aria-labelledby="nvB">
      <h2 id="nvB">${icono('alerta')}LaLiga dio un error</h2>
      <p>«Lo sentimos, tenemos problemas para iniciar su sesión». Es un fallo de su página, no de tu cuenta ni de la app. Repite: a la segunda suele ir.</p>
    </section>
    <button class="btn ancho" data-accion="entrarYa">${icono('usuario')}Repetir: abrir LaLiga</button>
    <button class="btn ancho sec" data-accion="volverEntrar" style="margin-top:10px">Ahora no</button>
  </div></div>`;
  const t = $('.av-t'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
  window.scrollTo(0, 0);
}

/* ---------------- invitar a tu liga (fase 0 del roadmap) ----------------
   Un enlace a la web con el número de tu liga (?l=…). Quien lo abre ve que viene invitado y, al entrar con su cuenta, se
   abre esa liga si es suya. Sin nombres en el enlace: solo el número de la liga, que ya ven todos sus miembros. */
const INVITA_DIAS = 14;
function leerInvitacion() {
  try {
    const p = new URLSearchParams(location.search);
    const l = p.get('l');
    if (!l || !/^\d{1,15}$/.test(l)) return;
    p.delete('l');
    history.replaceState(null, '', location.pathname + (p.toString() ? `?${p}` : '') + location.hash);
    if (haySesion()) return;
    LS.set('invita', { liga: l, t: Date.now() });
    if (!LS.get('invita-contada', false)) { contar('i'); LS.set('invita-contada', true); }
  } catch (e) { /* nada */ }
}
const invitacionViva = () => { const x = LS.get('invita', null); return x && Date.now() - x.t < INVITA_DIAS * DIA ? x : null; };
function invitarALiga() {
  const l = S.D && S.D.liga && S.D.liga.id;
  if (!l || enDemo()) { tostada('Entra con tu cuenta para invitar a los de tu liga'); return; }
  const url = `${DOMINIO}?l=${encodeURIComponent(l)}`;
  // (iOS 3) desde la app de iOS, también el iPhone
  const t = `Uso Fantasy Manager para la liga: cada día me dice qué fichar, qué vender y a quién clausular. Gratis, en ${enAppIos() ? 'Android, iPhone' : 'Android'} y en el navegador: ${url}`;
  contar('n');
  if (enApp) { nativo.compartir(t); return; }
  if (navigator.share) { navigator.share({ text: t }).catch(() => {}); return; }
  copiarY(t, 'Copiado: pégalo en el grupo de tu liga');
}
/** (25 nov) ¿esto es un Android? la web en un Android o la app de la liga (la de Google Play ya lleva anuncios) */
const enAndroid = () => (enApp ? nativo.canal() === 'github' : movilDe() === 'android');
/** desde qué móvil se abre la web: 'android', 'iphone' o null (ordenador) */
function movilDe() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
  return null;
}
/** el logo de Android (Simple Icons, CC0), para señalar lo de Android */
const ANDROID = '<svg class="an" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/></svg>';
/* (24-25 nov) Los símbolos de cada dispositivo, de un color y con el mismo peso: el robot de Android (Google deja usarlo
   citándolo; está en aviso-legal.html), la manzana para el iPhone (Carlos, 25 nov, 01:18: «quiero que aparezca el logo de
   Apple en vez de un móvil») y el logo de Windows para el ordenador (Carlos, 25 nov, 02:06: «en vez de salir un icono de
   un ordenador, que salga un icono de Windows»). Se le dijo dos veces que Apple no deja usar su logo suelto a terceros y
   que Microsoft pide licencia para cualquier logo, símbolo o icono de Windows, y los quiere igual: no se quitan sin que
   él lo diga. En un Mac, lo de «este ordenador» va con la manzana (`ordenadorG`): el de Windows ahí sería mentira. */
/** el logo de Apple (Simple Icons, CC0), para señalar lo del iPhone */
const APPLE = '<svg class="ap" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
/** el logo de Windows (las cuatro ventanas, dibujadas aquí), para señalar el ordenador */
const WINDOWS = '<svg class="wn" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M2 2h9.5v9.5H2zM12.5 2H22v9.5h-9.5zM2 12.5h9.5V22H2zM12.5 12.5H22V22h-9.5z"/></svg>';
/** el título del desplegable del ordenador para quien ya tiene la app en el móvil (lo citan el aviso del QR y Ajustes) */
const YA_TENGO = 'Ya tengo la app en el móvil: abrirla en este ordenador';
const botonDemo = (clase) => `<button class="btn ${clase} ancho" data-accion="entrarDemo" style="margin:6px 0 12px">Ver con una liga de ejemplo</button>`;
/** en el navegador, la alternativa a los tres pasos: entrar con un código de la app (o de otra web donde ya se ha entrado) */
const codigoWebHTML = (tit = true) => `<div class="entrar-codigo">
      ${tit ? `<b>${icono('usuario')}${!enApp && !movilDe() ? 'O con el código de la app' : 'Entra con el código de la app'}</b>` : ''}
      <span>${!enApp && !movilDe() ? 'Si no puedes escanear: en la app, <b>Ajustes → Abrir en el ordenador → Código</b>; en otra web donde ya has entrado, <b>Ajustes → Abrir en otro dispositivo</b>. Dura 10 minutos.' : 'Si tienes la app en un Android: <b>Ajustes → Abrir en el ordenador</b>. Si ya has entrado en la web de un ordenador: <b>Ajustes → Abrir en otro dispositivo</b>. Te da un código de 8 letras y números que dura 10 minutos.'}</span>
      <div class="codigo-in"><input id="codigoWeb" maxlength="9" placeholder="ABCD2345" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="usarCodigo" aria-label="Código de la app" aria-describedby="codigoErr"><button class="btn" data-accion="usarCodigo">Entrar</button></div>
      <p class="codigo-err" id="codigoErr" role="alert" hidden></p>
    </div>`;
/** (sesión 8, M9) el error del código, debajo del campo y sin borrar lo escrito (antes se repintaba la entrada entera) */
function errorCodigo(t, boton) {
  const p = $('#codigoErr'), inp = $('#codigoWeb');
  if (boton) { boton.disabled = false; boton.textContent = 'Entrar'; }
  if (!p) { tostada(t); return; }
  p.textContent = t; p.hidden = false;
  if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
}
/** en el ordenador: el QR que se escanea con la app del móvil (0.6.12). El dibujo y la espera, en iniciarQR */
const qrEntrarHTML = (tit = true) => `<div class="entrar-qr">
      <div class="eq-qr" id="eqQR"></div>
      <div class="eq-t">${tit ? `<b>${icono('usuario')}Escanea con la app</b>` : ''}
      <span>En la app del móvil: <b>Ajustes → Abrir en el ordenador → Escanear QR</b>, y apunta aquí. Entras solo, sin escribir nada.</span>
      <span class="eq-est" id="eqEst">Esperando al móvil…</span></div>
    </div>`;
/**
 * Lo de entrar en la web, según desde dónde se abra (0.8l: la entrada rehecha de arriba abajo).
 * LaLiga devuelve la sesión a una página https (auth.js), así que en la web se entra con tres gestos: abrir LaLiga, copiar la
 * dirección de la página final y volver a pegarla. Es lo primero en el iPhone y en el ordenador; en la web de un Android lo
 * primero sigue siendo la app (Google Play) y esto queda plegado. El QR y el código de la app son la alternativa.
 */
/** si la web se ve dentro del navegador de otra app (X, Instagram…): ahí Google no deja entrar y «otra pestaña» no existe */
function appAjena() {
  const ua = navigator.userAgent || '';
  const m = ua.match(/Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok|musical_ly|Bytedance|LinkedInApp|Snapchat|Line\//i);
  if (!m) return '';
  const k = m[0].toLowerCase();
  return /insta/.test(k) ? 'Instagram' : /^fb/.test(k) ? 'Facebook' : /twitter/.test(k) ? 'X' : /tiktok|musical|byte/.test(k) ? 'TikTok' : /linkedin/.test(k) ? 'LinkedIn' : /snap/.test(k) ? 'Snapchat' : 'LINE';
}
/** la dirección de esta web para abrirla en Safari desde el navegador de otra app, con la campaña marcada como «…-safari»
    (así «Antes de entrar» enseña por separado los que llegan dentro de X y los que ya han saltado a Safari); con `codigo`,
    lleva la sesión detrás de # (no llega a ningún servidor) */
function enlaceSafari(codigo = '') {
  // (en las pruebas en local la página va por http: ahí se arma igual, para poder comprobarlo)
  if (location.protocol !== 'https:' && !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return '';
  const o = origenActual();
  const marca = o ? `?utm_source=${encodeURIComponent(`${o.replace(/-safari$/, '').slice(0, 17)}-safari`)}` : '';
  return `x-safari-https://${location.host}${location.pathname}${marca}${codigo ? `#codigo=${encodeURIComponent(codigo)}` : ''}`;
}
const esMac = () => /Mac/i.test(navigator.platform || '') && !(navigator.maxTouchPoints > 1);
/** hay botón de pegar si el navegador deja leer lo copiado tras un toque (si no, se pega a mano en el cuadro) */
const hayPegar = () => !!(navigator.clipboard && typeof navigator.clipboard.readText === 'function');
/**
 * Los tres pasos de entrar en la web. plat: 'iphone' | 'pc' | 'android' (cómo se copia y se pega en cada uno). Un solo
 * #vueltaWeb por pantalla. El enlace de «Abrir LaLiga» es un <a target="_blank"> de verdad (lo rellena prepararEntrada): no
 * depende de window.open, que Safari puede parar. El cuadro de pegar está siempre a la vista: vale sin portapapeles.
 */
function entrarDirectoHTML(plat, { cab = '' } = {}) {
  const tecla = (t) => `<kbd>${t}</kbd>`;
  const copiar = esMac() ? `${tecla('⌘')} + ${tecla('C')}` : `${tecla('Ctrl')} + ${tecla('C')}`;
  const pegar = esMac() ? `${tecla('⌘')} + ${tecla('V')}` : `${tecla('Ctrl')} + ${tecla('V')}`;
  const comoCopiar = plat === 'iphone' ? 'Mantén pulsada la barra de direcciones (donde pone <b>jwt.ms</b>) y elige <b>Copiar</b> (o <b>Copiar enlace</b>).'
    : plat === 'android' ? 'Toca la barra de direcciones (donde pone <b>jwt.ms</b>) y pulsa el icono de <b>copiar</b>.'
      : `Haz clic en la barra de direcciones (empieza por <b>jwt.ms</b>) y pulsa ${copiar}.`;
  const comoPegar = plat === 'pc' ? `haz clic en el cuadro y pulsa ${pegar}` : 'mantén pulsado el cuadro y elige <b>Pegar</b>';
  const ajena = appAjena();
  const navegador = plat === 'iphone' ? 'Safari' : 'tu navegador';
  // (21 nov) En el iPhone, dentro de X, Instagram o TikTok: un toque la saca a Safari (el esquema x-safari-https://, que no
  // está documentado por Apple pero funciona desde esos navegadores en iOS 15 y 17 o más; en iOS 16 no). Dentro, Google no
  // deja iniciar sesión (son vistas web incrustadas) y lo que se guarde no lo ve Safari. Si Safari no se abre, queda el
  // menú de la propia app, copiar la dirección y entrar aquí mismo
  const aSafari = ajena && plat === 'iphone' ? enlaceSafari() : '';
  const avisoAjena = !ajena ? '' : aSafari ? `<div class="ed-ajena con-boton" role="note">${icono('alerta')}<div><b>Estás dentro de la app de ${ajena}.</b> Ábrela en Safari: ahí se entra con Google sin problema y tu cuenta se queda guardada.
      <a class="btn ancho ed-safari" id="edSafari" href="${esc(aSafari)}" data-accion="aSafari">${icono('flecha')}Abrir en Safari</a>
      <p class="ed-safari-no" id="edSafariNo" role="status" aria-live="polite"></p>
      <details class="ed-safari-mas"><summary>No se abre Safari</summary><p>En el menú de ${ajena} (<b>···</b> o el botón de compartir, arriba o abajo) elige <b>Abrir en Safari</b>. O copia la dirección y pégala en Safari:</p>
      <button type="button" class="btn chico sec" data-accion="copiarWeb">${icono('copiar')}Copiar la dirección de esta web</button>
      <p>También puedes entrar aquí dentro con los tres pasos de abajo, si entras en LaLiga con tu correo.</p></details></div></div>`
    : `<div class="ed-ajena" role="note">${icono('alerta')}<div><b>Estás dentro de la app de ${ajena}.</b> Desde aquí la entrada suele fallar: Google no deja iniciar sesión dentro de otras apps. Abre esta web en ${navegador}: en el menú de arriba o de abajo (<b>···</b> o Compartir) elige <b>Abrir en ${plat === 'iphone' ? 'Safari' : 'el navegador'}</b>.
      <button type="button" class="btn chico sec" data-accion="copiarWeb">${icono('copiar')}Copiar la dirección de esta web</button></div></div>`;
  const conPegar = hayPegar();
  // si LaLiga dejara de aceptar la vuelta https: en el ordenador, el método a mano de antes (con su propio enlace, que
  // vuelve al esquema de la app); en el móvil no hay herramientas del navegador, así que queda el código
  const aMano = plat === 'pc' ? `<details class="ed-mano"><summary>Entrar con el método a mano (solo ordenador, Chrome o Edge)</summary>
        <ol>
          <li>Pulsa <a id="edAMano" data-accion="abrirAMano" target="_blank" rel="noopener">Abrir LaLiga para el método a mano</a>. Se abre en otra pestaña.</li>
          <li>En esa pestaña, <b>antes de entrar</b>, pulsa <b>F12</b> (en Mac, <b>Cmd + Opción + I</b>), entra en <b>Red</b> (Network) y marca <b>Conservar registro</b> (Preserve log).</li>
          <li>Entra con tu cuenta. La página se queda en blanco: es lo normal.</li>
          <li>En la lista de Red, busca la última fila, la que lleva <b>code=</b>: clic derecho → <b>Copiar</b> → <b>Copiar dirección del enlace</b>.</li>
          <li>Vuelve aquí y pégala en el cuadro del paso 3.</li>
        </ol>
        </details>`
    : `<p>Mientras tanto puedes entrar con un código: ${plat === 'iphone' ? 'mira «Entrar con un código», más abajo' : 'mira «Ya tengo la app y quiero usar la web», justo encima'}. O entra desde un ordenador, que tiene un método a mano.</p>`;
  return `<section class="ed" id="entrarDirecto" data-plat="${plat}" aria-labelledby="edT">
    ${cab || `<h2 class="ed-t" id="edT">${icono('usuario')}Entra con tu cuenta de LaLiga</h2>`}
    <p class="ed-i">Son tres pasos y solo se hace una vez. La contraseña la escribes en la página de LaLiga, nunca aquí.</p>
    ${avisoAjena}
    <ol class="ed-pasos" role="list">
      <li><span class="ed-n" aria-hidden="true">1</span><div class="ed-c">
        <a class="btn ancho ed-abrir" id="edAbrir" data-accion="abrirLaLiga" target="_blank" rel="noopener" aria-describedby="edAbrirD">${icono('usuario')}<span id="edAbrirT">Abrir LaLiga y entrar</span></a>
        <p id="edAbrirD">Se abre en otra pestaña. Entra como siempre: con Google, Apple o tu correo. Si LaLiga da error, ciérrala y pulsa otra vez: a veces falla a la primera.</p>
      </div></li>
      <li><span class="ed-n" aria-hidden="true">2</span><div class="ed-c">
        <h3>Copia la dirección de la página final</h3>
        <p>Al terminar acabas en una página casi vacía, de Microsoft: es lo normal y no hay que tocar nada en ella. ${comoCopiar}</p>
        <figure class="ed-fig">${dibCopiar(plat, esMac())}</figure>
      </div></li>
      <li><span class="ed-n" aria-hidden="true">3</span><div class="ed-c">
        <h3>Vuelve aquí y pégala</h3>
        ${conPegar ? `<button type="button" class="btn ancho sec ed-pegar" id="edPegar" data-accion="pegarYEntrar">${icono('nota')}Pegar y entrar</button>` : ''}
        <label class="ed-l" for="vueltaWeb">${conPegar ? `O pégala tú aquí (${comoPegar}):` : `Pégala aquí (${comoPegar}):`}</label>
        <div class="ed-campo"><input id="vueltaWeb" type="text" inputmode="url" enterkeyhint="go" placeholder="https://jwt.ms/?state=…&amp;code=…" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" aria-describedby="vueltaErr vueltaEst"><button type="button" class="btn chico sec" id="edEntrar" data-accion="pegarVuelta">Entrar</button></div>
        <p class="ed-est" id="vueltaEst" role="status" aria-live="polite"></p>
        <p class="ed-err" id="vueltaErr" role="alert" hidden></p>
      </div></li>
    </ol>
    <details class="ed-ayuda" id="edAyuda"><summary>¿Algo no va?</summary>
      <dl>
        <dt>LaLiga dice «Lo sentimos, tenemos problemas para iniciar su sesión»</dt>
        <dd>Es un fallo de su página y pasa a menudo. Cierra esa pestaña y pulsa <b>Abrir LaLiga</b> otra vez.</dd>
        <dt>No encuentro la barra de direcciones o no me deja copiar</dt>
        <dd>${plat === 'pc' ? 'Está arriba del todo de la ventana. Haz clic encima: se selecciona entera y ya puedes copiarla.' : 'Está arriba o abajo de la pantalla, según tu móvil: es donde pone <b>jwt.ms</b>. Si no sale, desliza un poco la página hacia abajo. También vale <b>Compartir → Copiar</b>.'}</dd>
        <dt>He pegado y me dice que el enlace no vale</dt>
        <dd>Cada enlace sirve una sola vez y caduca en pocos minutos. Pulsa <b>Abrir LaLiga</b> otra vez y copia la dirección nueva.</dd>
        <dt id="edRedir">Al terminar no acabo en jwt.ms, o sale un error con «AADB2C90006»</dt>
        <dd>Entonces LaLiga ha cambiado algo y esta forma de entrar ha dejado de valer. No es cosa tuya. ${aMano}</dd>
      </dl>
    </details>
  </section>`;
}
/**
 * Después de pintar la pantalla de entrar: pone el enlace a LaLiga en el botón (y en el del método a mano) y, si la página
 * de LaLiga ya se abrió hace poco (también si Safari ha recargado esta pestaña al volver), deja el paso 3 por delante.
 */
async function prepararEntrada() {
  const a = $('#edAbrir');
  if (!a) return;
  try {
    const { url, urlAMano, abierto } = await prepararLogin();
    const b = $('#edAbrir');
    if (!b) return;
    b.setAttribute('href', url);
    const m = $('#edAMano'); if (m) m.setAttribute('href', urlAMano);
    // (si Safari ha recargado esta pestaña al volver, también cuenta como vuelta)
    if (abierto && Date.now() - abierto < 30 * MIN) { if (!S.laLigaFuera) marcarVuelve(); entradaAbierta({ alVolver: true }); }
  } catch (e) {
    // sin https (o un navegador muy viejo) no hay con qué preparar la entrada: se dice, con la salida que queda
    errorVuelta('Este navegador no deja preparar la entrada desde aquí. Abre la web en https://fantasymanagerapp.com con Safari, Chrome o Edge, o entra con un código.');
  }
}
/** el paso «v» del embudo: ha vuelto de la pestaña de LaLiga (una vez por cada vez que la abre; aguanta una recarga) */
function marcarVuelve() { if (!LS.get('ll-abierta', 0)) return; LS.del('ll-abierta'); marcarPaso('v'); }
/** el paso 3 por delante: ya se ha abierto LaLiga. Con alVolver, además se lleva ahí el foco y se dice qué toca */
function entradaAbierta({ alVolver = false } = {}) {
  const c = $('#entrarDirecto');
  if (!c) return;
  c.dataset.abierto = '1';
  // (21 nov) en el iPhone, de vuelta de LaLiga, «Pegar y entrar» queda fijo abajo: sin buscarlo ni bajar
  if (alVolver && c.dataset.plat === 'iphone') c.classList.add('ed-vuelto');
  const t = $('#edAbrirT'); if (t) t.textContent = 'Abrir LaLiga otra vez';
  const a = $('#edAbrir'); if (a) a.classList.add('sec');
  const p = $('#edPegar'); if (p) p.classList.remove('sec');
  if (!alVolver || S.entrandoWeb) return;
  // que se vea: si está dentro de un desplegable o en la otra pestaña, se abre
  const d = c.closest('details'); if (d) d.open = true;
  const err = $('#vueltaErr');
  if (!err || err.hidden) estadoVuelta(p ? '¿Ya has copiado la dirección? Pulsa «Pegar y entrar».' : '¿Ya has copiado la dirección? Pégala en el cuadro.');
  const foco = p || $('#vueltaWeb');
  if (foco && document.activeElement !== $('#vueltaWeb')) { try { foco.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
  const paso = (foco && foco.closest('li')) || c;
  try { paso.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch (e) { /* nada */ }
}
const estadoVuelta = (t) => { const e = $('#vueltaEst'); if (e) e.textContent = t || ''; };
/** el error de lo pegado, debajo del cuadro y sin repintar nada (no se pierde el sitio ni lo escrito) */
function errorVuelta(t, { ayuda = false } = {}) {
  const p = $('#vueltaErr'), inp = $('#vueltaWeb');
  estadoVuelta('');
  if (!p) { tostada(t, 7000); return; }
  p.textContent = t; p.hidden = false;
  if (inp) inp.setAttribute('aria-invalid', 'true');
  const d = p.closest('details'); if (d) d.open = true;
  if (ayuda) { const y = $('#edAyuda'); if (y) y.open = true; const m = $('.ed-mano'); if (m) m.open = true; }
  try { p.scrollIntoView({ block: 'nearest' }); } catch (e) { /* nada */ }
}
function sinErrorVuelta() {
  const p = $('#vueltaErr'), inp = $('#vueltaWeb');
  if (p) { p.hidden = true; p.textContent = ''; }
  if (inp) inp.removeAttribute('aria-invalid');
}
/** (25 nov, tanda 5) la huella de un enlace de vuelta (su código o, sin código, la dirección): para saber si se vuelve a
    pegar el mismo que acaba de fallar sin guardar el código */
function huellaEnlace(url) {
  let t = String(url || '');
  try { const u = new URL(t); t = u.searchParams.get('code') || `${u.searchParams.get('error') || ''}|${u.searchParams.get('state') || ''}|${t}`; } catch (e) { /* tal cual */ }
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
/** el último fallo al entrar, para el Diagnóstico (paso, código de LaLiga y hora) y para reconocer el enlace gastado */
function apuntarFalloEntrada(e, url) {
  try { LS.set('entrada-fallo', { paso: pasoDeFallo(e), cod: String((e && e.codigo) || '').slice(0, 80), t: Date.now(), h: url ? huellaEnlace(url) : '' }); } catch (x) { /* nada */ }
}
/**
 * Entrar con lo pegado (el botón «Pegar y entrar», pegar en el cuadro o en cualquier parte de la pantalla, o «Entrar»).
 * Primero se mira lo pegado sin llamar a nadie (mirarVuelta dice qué se ha pegado en su lugar); el error sale debajo del
 * cuadro. Sin conexión no se pierde nada: se vuelve a pulsar con lo mismo.
 */
async function entrarConVuelta(txt, { solo = false } = {}) {
  if (S.entrandoWeb) return;
  const m = mirarVuelta(txt);
  // (25 nov, tanda 5) lo pegado que no vale también cuenta, con su motivo: antes se salía sin apuntar nada
  if (m.error) { marcarPaso(`m-${m.motivo || 'otro'}`); errorVuelta(m.error); return; }
  // el mismo enlace que acaba de fallar (el portapapeles lo sigue teniendo): no se vuelve a probar, se dice claro. Sin
  // conexión o con un 5xx de LaLiga sí se deja probar otra vez (el código puede seguir valiendo)
  const f = LS.get('entrada-fallo', null);
  if (f && f.h && f.h === huellaEnlace(m.url) && Date.now() - f.t < 30 * 60e3 && f.paso !== 'x-red' && f.paso !== 'x-5xx') {
    // al volver de otra pestaña con lo de antes copiado no se dice nada (no lo ha pegado él)
    if (solo) return;
    marcarPaso('x-gastado');
    errorVuelta('Ese enlace ya está gastado: pulsa «Abrir LaLiga» otra vez y copia la dirección nueva.');
    const c = $('#vueltaWeb'); if (c) c.value = '';
    return;
  }
  sinErrorVuelta();
  const campo = $('#vueltaWeb');
  if (campo && !campo.value.trim()) campo.value = m.url;
  const botones = [$('#edPegar'), $('#edEntrar')].filter(Boolean);
  S.entrandoWeb = true;
  botones.forEach((b) => { b.disabled = true; });
  estadoVuelta('Entrando…');
  marcarPaso('p');
  try { await terminarLogin(m.url); } catch (e) {
    S.entrandoWeb = false;
    botones.forEach((b) => { b.disabled = false; });
    marcarPaso(pasoDeFallo(e));
    apuntarFalloEntrada(e, m.url);
    errorVuelta(e.message || String(e), { ayuda: e.tipo === 'redirect' });
    // el enlace gastado no vale para otro intento: fuera del cuadro (sin conexión se queda, para volver a pulsar)
    if (campo && e.tipo !== 'red') campo.value = '';
    return;
  }
  marcarPaso('ok');
  try { contar('e'); mirarCuentaNueva(); LS.del('demo'); S.D = null; S.planEstado = {}; await cargar(); } catch (e) { pantallaEntrar(e.message || String(e)); } finally { S.entrandoWeb = false; }
}
/**
 * (Carlos, 21 nov: «claramente separado»: lo de Android para descargar, con el logo de Google Play, y lo del iPhone para que
 * entren desde ahí.) (24 nov, Carlos: «más limpio y claro que es una aplicación… en iPhone/ordenador que aparezca también
 * Windows, no solo Apple».) Arriba va `tenlaHTML`: qué es la app y los tres dispositivos (Android · iPhone · Ordenador), cada
 * uno con su símbolo, una línea y una sola cosa que hacer, y el tuyo destacado. Debajo, lo de entrar de tu dispositivo.
 * Lo que es verdad en cada uno: Android, la app de Google Play; iPhone, desde Safari (no hay app en la App Store); ordenador
 * (Windows y Mac), en el navegador, y en Chrome y Edge se puede instalar como app (`instalarPc`).
 */
const cabPlat = (logo, nombre, sub, id = '') => `<div class="plat-c"><span class="ent-logo">${logo}</span><div><h2 class="plat-n"${id ? ` id="${id}"` : ''}>${nombre}</h2><p class="plat-s">${sub}</p></div></div>`;
const DISPOSITIVOS = {
  android: { g: ANDROID, n: 'Android', x: 'La app, en Google Play', h: 'instalar.html#android' },
  iphone: { g: APPLE, n: 'iPhone', x: 'Desde Safari, sin descargar nada', h: 'instalar.html#iphone' },
  pc: { g: WINDOWS, n: 'Ordenador', s: 'Windows y Mac', x: 'En el navegador, sin descargar nada', h: 'instalar.html#ordenador' },
};
/** el símbolo de este ordenador: Windows, o la manzana si es un Mac */
const ordenadorG = () => (esMac() ? APPLE : WINDOWS);
/** una fila de dispositivo. `desde`: desde dónde se mira; el tuyo va destacado y con su botón */
function filaDisp(k, desde) {
  const tuyo = k === desde, d = tuyo && k === 'pc' ? { ...DISPOSITIVOS.pc, g: ordenadorG() } : DISPOSITIVOS[k];
  // en el iPhone no sale nada que lleve a Google Play (no le sirve): la fila de Android lleva a la guía
  const hacer = k === 'android' ? (desde === 'iphone' ? `<a class="tl-ir" href="${d.h}">Cómo</a>` : botonPlay(tuyo ? 'grande' : ''))
    : tuyo && k === 'pc' ? `<span class="tl-aqui">Estás aquí</span><button type="button" class="btn sec chico tl-inst" data-accion="instalarPc" hidden>${icono('descargar')}Instalar como app</button>`
      : tuyo ? '<span class="tl-aqui">Estás aquí</span>' : `<a class="tl-ir" href="${d.h}">Cómo</a>`;
  return `<li class="tl-f${tuyo ? ' tuyo' : ''}" data-d="${k}"><span class="tl-g">${d.g}</span><div class="tl-n"><b>${d.n}${d.s ? ` <small>${d.s}</small>` : ''}</b><span>${d.x}</span></div>${hacer}</li>`;
}
/** (25 nov) la llegada con el código de un amigo a la web de un Android */
const tarjetaInvLlega = (cod) => `<section class="inv-llega" aria-labelledby="invLlegaT"><h2 id="invLlegaT">Tu amigo te ha invitado</h2>
  <p>Este es su código:</p><b class="inv-llega-cod">${esc(cod)}</b>
  <button class="btn ancho" data-accion="invCopiarPlay">${icono('copiar')}Copiar el código y descargar</button>
  <p>Cuando entres en la app, te preguntará si te ha invitado alguien: pégalo ahí.</p></section>`;
/** la lista de dispositivos: el tuyo primero */
const dispositivosHTML = (desde, cuales = ['android', 'iphone', 'pc']) => `<ul class="tl-l" role="list">${[...cuales].sort((a, b) => (b === desde) - (a === desde)).map((k) => filaDisp(k, desde)).join('')}</ul>`;
/** lo primero de la portada de la web: qué es la app (una frase) y cómo tenerla. En el iPhone, solo la frase: debajo van
    ya los tres pasos de entrar (el botón rojo sigue en la primera pantalla) y los otros dispositivos, después */
function tenlaHTML(plat) {
  return `<section class="tl" id="pTenla" aria-labelledby="tlT">
    <p class="tl-k">Fantasy Manager es una app</p>
    <h2 class="tl-h" id="tlT">Tu liga, <span>por dentro</span></h2>
    <p class="tl-p">Entras con tu cuenta de LaLiga Fantasy y analiza tu equipo, tu mercado y a tus rivales${plat === 'iphone' ? '.' : ': cada día, a quién vender, fichar y clausular.'}</p>
    ${plat === 'iphone' ? '' : dispositivosHTML(plat)}
  </section>`;
}
/** «también en»: los otros dispositivos, en corto (en el iPhone, debajo de los pasos) */
const tambienHTML = (desde) => `<section class="tl tl-mas" aria-label="También en otros dispositivos"><p class="tl-k">También en</p>${dispositivosHTML(desde, Object.keys(DISPOSITIVOS).filter((k) => k !== desde))}</section>`;
/** la web abierta en un Android: la app ya está arriba (`tenlaHTML`, con Google Play); aquí, lo de usar la web */
function bloqueAndroid() {
  return `<section class="plat plat-and" aria-labelledby="platAndT">
      ${cabPlat(ANDROID, 'En Android, mejor la app', 'Es gratis y entras con tu cuenta de LaLiga, sin copiar nada: está arriba, en Google Play. Si prefieres la web:', 'platAndT')}
      <details class="sin-app"><summary>Ya tengo la app y quiero usar la web</summary><p>Entra con un código de la app:</p>${codigoWebHTML()}</details>
      <details class="sin-app"><summary>Entrar aquí, sin instalar la app</summary>${entrarDirectoHTML('android')}</details>
    </section>`;
}
/** el iPhone: los tres pasos para entrar aquí */
function bloqueIphone() {
  // Si la web está en la pantalla de inicio, su sesión va aparte de la de Safari: todo (abrir y pegar) se hace en el
  // mismo sitio. (21 nov) el aviso de «añádela a la pantalla de inicio antes de entrar» no va aquí: estorbaba antes de
  // entrar. Se ofrece después, ya dentro, pasando la sesión (bandaInicio)
  return `<div class="plat plat-ios">${entrarDirectoHTML('iphone', { cab: cabPlat(APPLE, 'En tu iPhone', 'Sin descargar nada: se entra desde aquí, con tu cuenta de LaLiga.', 'edT') })}</div>`;
}
/** el ordenador (Windows y Mac): los tres pasos para entrar aquí; quien ya tiene la app en el móvil entra con un QR, sin
    copiar nada; y un solo QR a la vista, el de tenerla en el móvil (el de entrar sale al desplegar y entonces ese se quita) */
function bloquePc() {
  return `<div class="plat plat-ios plat-pc">${entrarDirectoHTML('pc', { cab: cabPlat(ordenadorG(), 'En este ordenador', '<b>Windows y Mac.</b> Se usa en el navegador: entra aquí mismo, con tu cuenta de LaLiga.', 'edT') })}</div>
    <section class="plat plat-mov" aria-labelledby="platMovT">
      <details class="sin-app" id="detApp"><summary>${YA_TENGO}</summary>
        ${qrEntrarHTML()}${codigoWebHTML()}</details>
      <div class="plat-fila plat-movil" id="qrMovil">
        <div class="en-apk-qr" role="img" aria-label="Código QR que lleva a fantasymanagerapp.com">${qrSVG(`${DOMINIO}?utm_source=qr`)}</div>
        <div class="plat-fila-t"><h2 class="plat-n" id="platMovT">¿La quieres en el móvil?</h2><p>Escanea este QR con la <b>cámara</b>: en Android sale el botón de Google Play y en el iPhone se entra desde Safari.</p></div>
      </div>
    </section>`;
}
function entrarWebHTML(llegada = false) {
  const movil = movilDe();
  if (movil === 'android') return `${bloqueAndroid()}${botonDemo('sec')}`;
  if (movil === 'iphone') {
    // abierta desde el icono de la pantalla de inicio (guarda su sesión aparte de la de Safari): si ya se entró en Safari,
    // lo más corto es traer la sesión con un código, así que va lo primero
    const codigo = enInicio()
      ? `<section class="plat plat-cod" aria-labelledby="platCodT"><h2 class="plat-n" id="platCodT">¿Ya has entrado en Safari?</h2><p class="plat-s">Trae tu cuenta con un código: en Safari, <b>Ajustes → Abrir en otro dispositivo</b>, y escríbelo aquí.</p>${codigoWebHTML(false)}</section>`
      : `<details class="sin-app"><summary>Entrar con un código</summary>${codigoWebHTML(false)}</details>`;
    // llegando de un anuncio: nada de otros dispositivos en la pantalla; y en ningún caso un botón de Google Play (9 de 53
    // visitas del iPhone lo pulsaban y no les llevaba a nada): los otros dispositivos llevan a la guía
    return `${enInicio() ? codigo : ''}${bloqueIphone()}
    ${botonDemo('sec')}
    ${enInicio() ? '' : codigo}
    ${llegada || enInicio() ? '' : tambienHTML('iphone')}`;
  }
  // (21 nov) en el ordenador, primero entrar aquí; debajo, lo del móvil
  return `${bloquePc()}
    <section class="ent-paso" aria-labelledby="entVerT"><div class="ent-ca"><h2 id="entVerT">¿Solo quieres verla?</h2></div>
      <p>Mira todo lo que hace con una liga de ejemplo, sin cuenta y sin instalar nada.</p>
      <button class="btn ancho sec" data-accion="entrarDemo">Ver con una liga de ejemplo</button></section>`;
}
/**
 * El QR del ordenador (0.6.12): un id al azar de 128 bits en un enlace a la web (si alguien lo escanea con la cámara
 * normal, la web le explica dónde se escanea). Pregunta al Worker cada 2 s, solo con la pestaña a la vista, durante
 * 10 minutos; luego, «Otro QR». La app, al escanearlo, deja su sesión en /qr/dejar con ese id (window.qrLeido).
 */
let QRE = null;
function pararQR() { if (QRE && QRE.reloj) clearTimeout(QRE.reloj); QRE = null; }
const estQR = (t) => { const e = $('#eqEst'); if (e) e.textContent = t; };
function iniciarQR() {
  const caja = $('#eqQR');
  pararQR();
  if (!caja || !WORKER) return;
  const b = crypto.getRandomValues(new Uint8Array(16));
  const id = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // la clave para abrir lo que mande el móvil va en el QR, detrás de # (no llega al servidor): «#qr=<id>.<clave>»
  const k = claveQR();
  const q = { id, k, hasta: Date.now() + 10 * MIN, fallos: 0, reloj: null };
  QRE = q;
  caja.innerHTML = qrSVG(`${DOMINIO}#qr=${id}.${k}`);
  estQR('Esperando al móvil…');
  const paso = async () => {
    if (QRE !== q) return;
    if (!document.body.contains(caja)) { pararQR(); return; }
    if (Date.now() > q.hasta) {
      QRE = null;
      caja.innerHTML = `<button class="btn chico" data-accion="otroQR">Otro QR</button>`;
      estQR('El QR ha caducado (dura 10 minutos)');
      return;
    }
    if (!document.hidden) {
      try {
        const r = await fetch(`${WORKER}/qr/esperar?id=${id}`, { cache: 'no-store' });
        if (QRE !== q) return;
        if (r.status === 200) {
          let j = await r.json().catch(() => null);
          if (j && j.cif) {
            try { j = await abrir({ qr: q.k }, j.cif); } catch (e) { QRE = null; caja.innerHTML = `<button class="btn chico" data-accion="otroQR">Otro QR</button>`; estQR(e.message); return; }
          }
          if (j && j.sesion) { QRE = null; entrarConVinculo(j); return; }
        }
        q.fallos = r.status === 200 || r.status === 204 ? 0 : q.fallos + 1;
      } catch (e) { q.fallos++; }
      estQR(q.fallos >= 5 ? 'Sin conexión con el servidor de la web: usa el código de abajo' : 'Esperando al móvil…');
    }
    q.reloj = setTimeout(paso, 2000);
  };
  q.reloj = setTimeout(paso, 2000);
}
/** entrar con lo que manda la app (por el código o por el QR) */
async function entrarConVinculo(j) {
  raiz().innerHTML = `<div class="pantalla cargando">${LOGO}<h1 style="font-size:42px">Entrando…</h1></div>`;
  try {
    traerVinculo(j);
    contar('e');
    marcarPaso('ok');
    S.D = null; S.planEstado = {};
    await cargar();
  } catch (e) { pantallaEntrar(e.message || String(e)); }
}
/** lo que se pasa al ordenador: la sesión, tu liga y tu equipo, la clave de la IA y el dinero que te han dicho */
function datosVinculo() {
  const c = cfg();
  return { sesion: sesion(), cfg: { ligaId: c.ligaId || null }, ia: hayClave() ? { clave: clave() } : null, dichos: LS.get(K('dinero-dicho'), {}) };
}
/**
 * deja lo que se pasa al ordenador cerrado con un código que pone la app (0.7a): al servidor solo le llega el id que sale
 * del código, y del id no se saca la clave. mandar(cuerpo) → { s, b }. Si el servidor aún no lo entiende (400), como antes.
 * Devuelve { s, b } con el código dentro de b, como contestaba el servidor.
 */
async function dejarConCodigo(datos, mandar) {
  for (let k = 0; k < 2; k++) {
    const codigo = codigoNuevo();
    const r = await mandar({ id: await idDeCodigo(codigo), cif: await cerrar({ codigo }, datos) });
    if (r.s === 409) continue;
    if (r.s !== 200) { if (r.s === 400) break; return r; }
    let j = null;
    try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
    return { s: 200, b: JSON.stringify({ ...(j || {}), codigo }) };
  }
  return mandar(datos);
}
/** lo que ha dejado el móvil con ese código: primero por su id (lo cerrado); si no está, como antes (una app de antes) */
async function traerConCodigo(cod) {
  const post = (cuerpo) => fetch(`${WORKER}/vincular/usar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  let r = await post({ id: await idDeCodigo(cod) });
  if (r.status === 404 || r.status === 400) r = await post({ codigo: cod });
  let j = await r.json().catch(() => null);
  if (r.ok && j && j.cif) j = await abrir({ codigo: cod }, j.cif);
  return { r, j };
}
/** la app ha leído un QR (Principal.escanearQR): si es el del ordenador, deja ahí la sesión */
window.qrLeido = async (texto, motivo) => {
  if (texto == null) { if (motivo) tostada(motivo, 7000); return; }
  const m = String(texto).match(/[#&?]qr=([A-Za-z0-9_-]{22,64})(?:\.([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-]))?/);
  if (!m) {
    // (24 nov, Carlos) en la portada del ordenador hay tres QR y el de entrar va plegado: lo normal es escanear el de
    // descargar. Se le dice cuál es y dónde está el bueno, con el nombre de lo que tiene que pulsar
    const deDescarga = /play\.google\.com|fantasymanagerapp\.com|fantasy-manager-61v\.pages\.dev/i.test(String(texto));
    const donde = `pulsa «${YA_TENGO}» y escanea el QR que sale ahí.`;
    tostada(deDescarga ? `Ese QR es el de descargar la app, no el de entrar. En la web del ordenador, ${donde}`
      : `Ese QR no es el de Fantasy Manager. Abre fantasymanagerapp.com en el ordenador, ${donde}`, 12000);
    return;
  }
  if (!haySesion()) { tostada('Primero entra con tu cuenta de LaLiga en la app'); return; }
  tostada('Abriendo tu cuenta en el ordenador…');
  try {
    const dejar = (cuerpo) => http('POST', `${WORKER_PUBLICO}/qr/dejar`, { cabeceras: { 'content-type': 'application/json' }, cuerpo: JSON.stringify(cuerpo), tiempo: 20000 });
    // con la clave del QR, cerrado; sin ella (QR de una web de antes) o si el servidor aún no lo entiende, como antes
    let r = m[2] ? await dejar({ id: m[1], cif: await cerrar({ qr: m[2] }, datosVinculo()) }) : null;
    if (!r || r.s === 400) r = await dejar({ id: m[1], ...datosVinculo() });
    let j = null;
    try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
    if (r.s !== 200 || !j || !j.ok) throw new Error(j && j.e ? j.e : r.s ? `el servidor de la web responde ${r.s}` : `sin conexión (${r.e})`);
    cerrarHoja(true);
    tostada('Listo: el ordenador entra solo en unos segundos', 6000);
  } catch (e) { tostada(`No se ha podido abrir en el ordenador: ${e.message}`, 7000); }
};
/** lo que manda la app con el código: la sesión, tu liga y tu equipo, la clave de la IA y el dinero que te han dicho */
/**
 * otra cuenta en este dispositivo (lo que dice el token al entrar): lo de la anterior se borra antes de enseñar nada,
 * para que no se vea mientras carga la nueva (la carga lo vuelve a mirar con el id de la cuenta; revisión del 29 oct)
 */
function mirarCuentaNueva() {
  try {
    const q = quien();
    const k = q && (q.correo || q.nombre);
    if (!k) return;
    const antes = LS.get('cuenta-quien', null);
    if (antes && antes !== k) { borrarCuenta(); S.D = null; S.plan = null; S.planEstado = {}; }
    LS.set('cuenta-quien', k);
  } catch (e) { /* nada */ }
}
function traerVinculo(j) {
  LS.del('demo');
  guardar('sesion', j.sesion);
  mirarCuentaNueva();
  if (j.cfg) guardarCfg({ ligaId: j.cfg.ligaId || null });
  if (j.ia && j.ia.clave && !hayClave() && !enAppIos()) guardarClave(j.ia.clave);
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
    const mandar = (cuerpo) => fetch(`${WORKER_PUBLICO}/vincular`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(async (x) => ({ s: x.status, b: await x.text() }));
    const r = await dejarConCodigo(datos, mandar);
    let j = null;
    try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
    if (r.s !== 200 || !j || !j.codigo) throw new Error((j && j.e) || `el servidor responde ${r.s}`);
    location.href = `${DOMINIO}#codigo=${encodeURIComponent(j.codigo)}`;
  } catch (e) {
    tostada(`No se ha podido preparar la mudanza (${e.message}). Entra en fantasymanagerapp.com con el código de Ajustes → Abrir en otro dispositivo.`, 9000);
    if (el) { el.disabled = false; el.textContent = 'Llevarme'; }
  }
}
/* ---------------- (21 nov) el iPhone después de entrar: la sesión, a Safari o a la pantalla de inicio ----------------
   Lo que se guarda al entrar se queda donde se entró: el navegador de dentro de X o de Instagram no lo comparte con Safari,
   y la web puesta en la pantalla de inicio tampoco lo comparte con Safari. Con el código de «Abrir en otro dispositivo»
   (una vez, 10 minutos) la sesión viaja detrás de # en la dirección:
   - dentro de otra app: una banda con «Abrir en Safari», que abre Safari ya con la cuenta (x-safari-https://…#codigo=…);
   - en Safari: una banda que ofrece ponerla en la pantalla de inicio. Al pedirlo, la dirección de la página pasa a llevar
     el código y se quita el manifiesto (con él, iOS guarda su «start_url» y no esta dirección), para que el icono se cree
     con el código y entre solo. Nadie ha podido probarlo en un iPhone: por si iOS no guarda esa dirección, el código
     también se enseña para escribirlo, y la app de la pantalla de inicio lo pide lo primero. */
async function codigoDeSesion() {
  const c = cfg();
  const datos = { sesion: sesion(), cfg: { ligaId: c.ligaId || null }, ia: hayClave() ? { clave: clave() } : null, dichos: LS.get(K('dinero-dicho'), {}), tour: LS.get('tour', null), vista: versionVista() };
  const mandar = (cuerpo) => fetch(`${WORKER_PUBLICO}/vincular`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(async (x) => ({ s: x.status, b: await x.text() }));
  const r = await dejarConCodigo(datos, mandar);
  let j = null;
  try { j = JSON.parse(r.b || 'null'); } catch (e) { j = null; }
  if (r.s !== 200 || !j || !j.codigo) throw new Error((j && j.e) || `el servidor responde ${r.s}`);
  return j;
}
/** (21 nov) la variante c de invitar: una tira fina debajo de la barra, en todas las pestañas */
/* (25 nov) quien acaba de entrar y aún puede poner el código de quien le invitó: una banda arriba hasta que lo pone, dice
   que nadie o la cierra (la ventana sola sale una vez y se cerraba sin leerla; desde Google Play el enlace no trae el código) */
const bandaInvitado = () => {
  const uid = uidYo();
  if (!uid || enDemo() || LS.get('inv-banda-cerrada', 0) || !pareceInvitado(uid) || codigoPendiente()) return '';
  return `<div class="banda banda-invitado">${icono('estrella')}<span><b>¿Te ha invitado un amigo?</b> Pon su código.</span><button data-accion="ponerCodigo">Poner código</button><button class="banda-x" data-accion="cerrarInvitado" aria-label="Nadie me ha invitado">${icono('cerrar')}</button></div>`;
};
const bandaInvita = () => (LS.get('var-inv', '') === 'c' ? `<div class="banda banda-inv">${icono('estrella')}<span><b>Invita a un amigo</b> y ve el dinero de 2 rivales por cada uno que entre.</span><button data-accion="invitarAmigo">Invitar</button></div>` : '');
const enIPhoneWeb = () => !enApp && movilDe() === 'iphone';
const bandaInicio = () => {
  if (!enIPhoneWeb() || enInicio() || !haySesion() || enDemo()) return '';
  const ajena = appAjena();
  if (ajena) return `<div class="banda banda-inicio">${icono('alerta')}<span><b>Estás dentro de ${esc(ajena)}.</b> Sigue en Safari con tu cuenta: aquí no se queda guardada.</span><button data-accion="sesionASafari">Abrir en Safari</button></div>`;
  if (LS.get('inicio-visto', false)) return '';
  return `<div class="banda banda-inicio">${icono('movil')}<span><b>¿La quieres como una app?</b> Ponla en la pantalla de inicio, ya con tu cuenta.</span><button data-accion="pasarAInicio">Cómo</button><button class="banda-x" data-accion="cerrarInicio" aria-label="Ahora no">${icono('cerrar')}</button></div>`;
};
async function sesionASafari(el) {
  if (el) el.disabled = true;
  try {
    const j = await codigoDeSesion();
    S.vinculo = j;
    marcarPaso('saf');
    const u = enlaceSafari(j.codigo);
    if (u) location.href = u;
    // si Safari no se abre (iOS 16, o la app no deja), a los 2 s sigue esta página a la vista: el código, para escribirlo
    relojFijo(2000, () => { if (!document.hidden) hoja('vinculo'); });
  } catch (e) { tostada(`No se ha podido preparar el paso a Safari: ${e.message}`, 6000); } finally { if (el) el.disabled = false; }
}
async function pasarAInicio(el) {
  if (el) el.disabled = true;
  try {
    const j = await codigoDeSesion();
    S.vinculo = { ...j, inicio: true };
    // la dirección que iOS guarda con el icono: esta, con el código detrás de #; sin manifiesto, para que no use su start_url
    try { history.replaceState(null, '', `${location.pathname}#codigo=${encodeURIComponent(j.codigo)}`); } catch (e2) { /* nada */ }
    document.querySelectorAll('link[rel="manifest"]').forEach((l) => l.remove());
    marcarPaso('inicio');
    hoja('vinculo');
  } catch (e) { tostada(`No se ha podido preparar: ${e.message}. Puedes hacerlo luego en Ajustes → Abrir en otro dispositivo.`, 7000); } finally { if (el) el.disabled = false; }
}

/** en la web nueva: si viene de la de antes con un código, entra con él sin volver a hacer nada */
async function codigoDeMudanza() {
  // el QR del ordenador escaneado con la cámara normal: se escanea desde la app (0.6.12)
  if (!enApp && /^#qr=/.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => tostada('Ese QR se escanea desde la app de Fantasy Manager: Ajustes → Abrir en el ordenador → Escanear QR.', 9000), 1500);
    return false;
  }
  const m = !enApp && location.hash.match(/^#codigo=([A-Za-z0-9]{8})$/);
  if (!m) return false;
  // (21 nov) la app de la pantalla de inicio puede llevar en su dirección el código con el que se pasó la sesión
  // (pasarAInicio): vale una vez y 10 minutos. Si ya hay sesión, ni se mira; y si ya no vale, se entra normal, sin avisos
  const deInicio = enInicio();
  history.replaceState(null, '', location.pathname + location.search);
  if (deInicio && haySesion()) return false;
  try {
    const { r, j } = await traerConCodigo(m[1].toUpperCase());
    if (!r.ok || !j || !j.sesion) throw new Error((j && j.e) || `el servidor responde ${r.status}`);
    traerVinculo(j);
    if (j.tour && !tourVisto()) LS.set('tour', j.tour);
    if (typeof j.vista === 'string' && !LS.get('version-vista2', null)) LS.set('version-vista2', j.vista);
    return true;
  } catch (e) {
    if (!deInicio) setTimeout(() => tostada(`No se ha podido traer tu cuenta (${e.message}). Saca otro código: en la app, Ajustes → Abrir en el ordenador; en la web, Ajustes → Abrir en otro dispositivo.`, 9000), 1500);
    return false;
  }
}
/* (la banda «App en desarrollo y en pruebas…», de arriba, se quitó en la 0.7.3a, con la app ya en Google Play) */
/* la pantalla de bienvenida (Carlos, 9 nov 10:20: «en vez del aviso de arriba»): la primera vez que alguien entra con su
   liga, una vez por cuenta (en local y en el Worker, para que no salga otra vez en otro dispositivo: soporte.js). Nunca en
   la liga de ejemplo ni antes de entrar, ni encima del tutorial, las novedades o el límite: espera a que no haya nada
   delante (el tutorial, a su vez, espera a que se cierre). El texto es el de Carlos, tal cual (9 nov 11:28: «¡Hola!» de título, «Soy
   Carlos» en el cuerpo y «Muchas gracias, y vigila las cláusulas» al final) */
function bienvenidaHTML() {
  return `<div id="bienvenida" class="bv" role="dialog" aria-modal="true" aria-labelledby="bvTit"><div class="bv-caja">
    <div class="bv-logo">${LOGO_P}<span>Fantasy Manager</span></div>
    <h2 id="bvTit">¡Hola!</h2>
    <p>Soy Carlos. Fantasy Manager lo estoy haciendo yo solo, en los ratos que me dejan el trabajo y los estudios.</p>
    <p>Por eso me ayuda muchísimo que me cuentes cualquier fallo que veas o cualquier idea para mejorar algo: lo leo todo y lo tengo en cuenta.</p>
    <p>Muchas gracias, y vigila las cláusulas.</p>
    <div class="bv-botones"><button class="btn ancho" data-accion="bienvenidaReportar">${icono('bicho')}Reportar un fallo o una idea</button>
    <button class="btn sec ancho" data-accion="bienvenidaOk">Entendido</button></div></div></div>`;
}
const tocaBienvenida = () => !EN_FONDO && !!S.D && !enDemo() && haySesion() && !bienvenidaVista();
function quizaBienvenida(ms, intento = 0) {
  setTimeout(() => {
    if (!tocaBienvenida() || $('#bienvenida')) { S.bienvenidaPendiente = false; return; }
    if (estadoLimite.cerrada || $('.nv') || $('.atardecer-intro') || $('#limite') || S.hoja || tourAbierto() || (S.cargando && !S.D)) {
      if (intento < 40) quizaBienvenida(3000, intento + 1); else S.bienvenidaPendiente = false;
      return;
    }
    document.body.insertAdjacentHTML('beforeend', bienvenidaHTML());
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => $('#bienvenida')?.classList.add('on'));
  }, ms);
}
function cerrarBienvenida() {
  const b = $('#bienvenida');
  const yo = S.M && S.M.yo;
  apuntarBienvenida({ v: VERSION, canal: enApp ? nativo.canal() : 'web', app: enApp ? nativo.version() : 0, liga: (S.D && S.D.liga && S.D.liga.id) || '', equipo: yo ? yo.nombre : '' });
  // el aviso de arriba dice lo mismo: no vuelve hasta dentro de 72 h
  LS.set('beta-cerrada', Date.now());
  $$('.banda.beta').forEach((x) => x.remove());
  S.bienvenidaPendiente = false;
  if (b) { b.classList.remove('on'); setTimeout(() => b.remove(), 220); }
  if (!S.hoja) document.body.style.overflow = '';
}

/* el almacenamiento del navegador lleno: algo importante no se ha podido guardar ni haciendo sitio (util.js, A8) */
const QUE_LLENO = [[/^n-sesion/, 'tu sesión de LaLiga (tendrás que volver a entrar)'], [/^n-gemini/, 'tu clave de la IA'], [/^chat/, 'el chat'], [/^hist/, 'el histórico de valores'], [/^datos/, 'tu liga'], [/^planes/, 'el plan'], [/^notas/, 'tus notas']];
const queLleno = (k) => (QUE_LLENO.find(([re]) => re.test(k)) || [null, 'lo último'])[1];
const bandaLleno = () => {
  const x = almacenLleno();
  return x ? `<div class="banda mal banda-lleno">${icono('alerta')}<span><b>Almacenamiento lleno.</b> No se ha podido guardar ${esc(queLleno(x.k))}. Borra los datos guardados (se vuelven a descargar) o haz sitio en el navegador.</span><button data-accion="borrarDatos">Borrar datos</button><button class="banda-x" data-accion="cerrarLleno" aria-label="Cerrar el aviso">${icono('cerrar')}</button></div>` : '';
};
let llenoAvisado = 0;
window.addEventListener('fm-lleno', (e) => {
  if (Date.now() - llenoAvisado > 60e3) { llenoAvisado = Date.now(); tostada(`Almacenamiento lleno: no se ha podido guardar ${queLleno((e.detail || {}).k || '')}`, 7000); }
  const b = $('#banda');
  if (b && !$('.banda-lleno', b)) b.insertAdjacentHTML('afterbegin', bandaLleno());
});
/* el APK de GitHub ya no se actualiza: una banda fija hasta que se pasen a Google Play (avisoPlay, más abajo) */
const enApkGithub = () => enApp && nativo.canal() === 'github';
// (Carlos, 14 nov) fija arriba en todas las pestañas, sin cerrar: que ya no recibe nada y cuándo deja de funcionar, con el
// enlace a Google Play y «Cómo» (hay que desinstalar esta antes: la de Google Play no se instala encima)
const bandaPlay = () => {
  if (!enApkGithub()) return '';
  // (días del calendario: el sábado por la tarde, «en 7 días» hasta el sábado siguiente)
  const c = cierreApk(), d0 = (t) => { const x = new Date(t); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  const dias = c.hasta ? Math.round((d0(c.hasta) - d0(Date.now())) / DIA) : 0;
  const cuando = !c.hasta ? 'pronto' : dias > 1 ? `en ${dias} días` : dias === 1 ? 'mañana' : 'hoy';
  return `<div class="banda banda-play">${icono('alerta')}<div class="banda-play-c"><b>Esta app deja de funcionar ${cuando}</b><span>Ya no recibe actualizaciones ni mejoras. Instálala desde Google Play.</span><div class="banda-play-b"><button class="banda-play-ins" data-abrir="${PLAY_URL}" aria-label="Ir a Google Play"><img src="img/google-play.png" alt="Disponible en Google Play" width="646" height="250"></button><button data-accion="avisoPlay">Cómo</button></div></div></div>`;
};
/* la app de Google Play por debajo de «playMin» (0.7.13w): ya hay otra en la tienda y esta deja de recibir las mejoras.
   Fija, sin cerrar, hasta que se actualice (al actualizarse ya no está por debajo). Ni en la liga de ejemplo */
const bandaActualizarPlay = () => ((S.D && S.D.demo) ? ''
  : iosDesfasada() ? `<div class="banda banda-actualizar">${icono('descargar')}<span><b>Hay una versión nueva de la app</b></span><button data-accion="irAppStore">Actualizar en la App Store</button></div>`
  : !playDesfasada() ? ''
  : `<div class="banda banda-actualizar">${icono('descargar')}<span><b>Hay una versión nueva de la app</b></span><button data-abrir="${PLAY_URL}">Actualizar en Google Play</button></div>`);
/* (19 nov, el fallo de Bryan) el móvil no consigue descargar la web nueva con la conexión que tiene (su red no llega a
   donde está publicada). Cada vez que la app mira si hay versión nueva (webBuscada) se apunta desde cuándo falla por la
   conexión, y se borra en cuanto mira bien o llega una versión nueva. Con más de un día así, una banda pequeña que se
   cierra hasta el día siguiente. Sirve sobre todo a las apps de Google Play de antes del respaldo (hasta la 6781), que
   solo bajan la web del dominio; las de después prueban también el respaldo y solo fallan si no llegan a ninguno */
const ALDIA_RED = /sin conexi[oó]n|no conecta|tarda|sin direcci[oó]n|https roto|failed to connect|timed? ?out|unable to resolve|resolve host|no address|connection (reset|refused|abort)|software caused|unreachable|network|ssl|handshake|\bEOF\b/i;
const ALDIA_NO_RED = /firma|HTTP \d|huella|cuadra|sitio|grande|arrancaba|ruta rara|https$/i;
function apuntarAlDia(estado) {
  const e = String(estado || '');
  if (e === 'ocupada') return;
  const red = e.startsWith('error') && ALDIA_RED.test(e) && !ALDIA_NO_RED.test(e);
  const g = LS.get('aldia-red', null);
  if (!red) { if (g) LS.del('aldia-red'); return; }
  if (!g || g.v !== VERSION) LS.set('aldia-red', { t: Date.now(), v: VERSION });
}
const bandaSinDescarga = () => {
  if (!enApp || enApkGithub() || (S.D && S.D.demo) || playDesfasada() || iosDesfasada()) return '';
  const g = LS.get('aldia-red', null);
  if (!g || g.v !== VERSION || Date.now() - g.t < DIA || LS.get('aldia-red-cerrada', '') === diaDe()) return '';
  return `<div class="banda">${icono('alerta')}<span>No se ha podido descargar la actualización con esta conexión: abre la app con wifi.</span><button class="banda-x" data-accion="cerrarSinDescarga" aria-label="Cerrar el aviso">${icono('cerrar')}</button></div>`;
};
const bandaMudanza = () => (enWebVieja ? `<div class="banda">${icono('descargar')}<span>La web se ha mudado a <b>fantasymanagerapp.com</b>: llévate tu cuenta en un toque</span><button data-accion="mudarse">Llevarme</button></div>` : '');
/* el aviso de que la app sigue en pruebas, arriba en todas las pestañas (lo pidió Carlos el 2 nov, y otra vez el 16 nov): lleva a
   «Reportar un fallo» y se cierra con la ×; vuelve a salir a las 72 h de cerrarlo (Carlos, 9 nov; antes 24 h y, antes, 7 días).
   Cerrar la pantalla de bienvenida cuenta como cerrarlo. Ni en la liga de ejemplo (se apilaría con su banda) ni en el APK de GitHub (ya lleva el suyo). */
const BETA_VUELVE = 3 * DIA;
const bandaBeta = () => (S.D && S.D.demo) || enApkGithub() || (Date.now() - (LS.get('beta-cerrada', 0) || 0) < BETA_VUELVE) ? ''
  : `<div class="banda beta">${icono('bicho')}<span><b>App en desarrollo y en pruebas.</b> Cualquier fallo o idea de mejora, mándamelo con el botón Reportar: lo leo todo y lo tengo en cuenta.</span><button data-accion="mandarFallo">Reportar</button><button class="banda-x" data-accion="cerrarBeta" aria-label="Cerrar el aviso">${icono('cerrar')}</button></div>`;

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
  return `<div class="carga ${error ? 'mal' : ''}" role="main">
    <div class="carga-in">
      <div class="carga-izq">
        ${camisetaCarga(pct / 100)}
        <div class="carga-wm">Fantasy <b>Manager</b></div>
        <h1 class="carga-t">${tituloCarga(liga, error)}</h1>
        ${error ? '' : `<div class="carga-barra" role="progressbar" aria-label="Cargando" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="--p:${pct / 100}"></i></div><div class="carga-pct"><span>${Math.max(0, Math.min(paso + 1, total))} de ${total}</span><b>${pct} %</b></div>`}
      </div>
      <div class="carga-der">
        ${error ? `<div class="fallo"><p>${esc(error.texto)}</p>${error.detalle && error.detalle !== error.texto ? `<p class="fallo-det">${esc(error.detalle)}</p>` : ''}</div>
          <div class="carga-btns">${botonesError(error, icono)}</div>${estadoHTML()}`
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
    $('.carga-barra i', el).style.setProperty('--p', pct / 100);
    $('.carga-barra', el).setAttribute('aria-valuenow', pct);
    $('.carga-pct span', el).textContent = `${Math.max(0, Math.min(paso + 1, total))} de ${total}`;
    $('.carga-pct b', el).textContent = `${pct} %`;
    $('.carga-pasos', el).innerHTML = pasosHTML(paso);
    $('.carga-t', el).innerHTML = tituloCarga(liga, null);
    return;
  }
  // la primera vez (o desde la pantalla de arranque de index.html): se pinta entera
  raiz().innerHTML = cargaHTML(paso, error, liga);
  // (0.7.13i) si no carga la liga, el semáforo dice si es cosa de LaLiga
  if (error) pintarEstado();
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
  // arriba solo tres cosas: actualizar la liga (si el plan se ha quedado viejo, la IA lo rehace sola después),
  // preguntarle a la IA (en rojo) y los ajustes, donde lo primero es avisar de un fallo (el numerito de respuestas y de
  // avisos sin contestar va en Ajustes). Rehacer el plan a mano está en la tarjeta del plan, en Hoy.
  // en el móvil cada botón lleva su nombre debajo (data-et); en el ordenador, el largo (aria-label) al lado
  // (en el ordenador, Pregunta va arriba del todo de la columna, encima de las pestañas)
  const preg = `<button class="b-ico b-preg" id="bPregunta" data-ir="ia" aria-label="Pregunta" data-et="Pregunta">${icono('ia')}</button>`;
  // (21 nov, Carlos: «que lo del referido de amigo fuera más vistoso, fuera de su apartado, en la barra de arriba»)
  // tres variantes para que elija (localStorage «fm-var-inv»: a, b o c; sin elegir, como estaba):
  // a) un botón más en la barra, con el borde dorado; b) el mismo botón relleno en dorado y con «+2» (los rivales que se ganan);
  // c) una tira fina debajo de la barra, en todas las pestañas; d) como a, pero sin el botón «Actualizar»: se actualiza
  // tocando el estado («Al día ↻») o tirando hacia abajo, y el nombre de la liga no se corta
  // (Carlos, 21 nov 20:57) elegida la d: «Invitar», «Pregunta» y «Ajustes» a la derecha, y actualizar, en pequeño debajo
  // del nombre de la liga. Con las invitaciones paradas, la barra de antes
  const vInv = invitarOn() ? LS.get('var-inv', 'd') : '';
  const invBoton = vInv === 'a' ? `<button class="b-ico b-inv" id="bInvitar" data-accion="invitarAmigo" aria-label="Invita a un amigo" data-et="Invitar">${icono('estrella')}</button>`
    : vInv === 'd' ? `<button class="b-ico b-inv" id="bInvitar" data-accion="invitarAmigo" aria-label="Invita a un amigo" data-et="Invitar">${icono('estrella')}</button>`
    : vInv === 'b' ? `<button class="b-ico b-inv lleno" id="bInvitar" data-accion="invitarAmigo" aria-label="Invita a un amigo: por cada uno que entra, el dinero de 2 rivales" data-et="Invitar">${icono('estrella')}<span class="inv-mas" aria-hidden="true">+2</span></button>` : '';
  const botones = `<div class="sup-btns">${invBoton}<button class="b-ico" id="bRefrescar"${vInv === 'd' ? ' hidden' : ''} data-accion="recargar" aria-label="Actualizar la liga" title="Traer lo último de LaLiga (saldo, mercado, pujas)" data-et="Actualizar">${icono('refrescar')}</button>
    ${anchoYa ? '' : preg}
    <button class="b-ico" id="bAjustes" data-accion="ajustes" aria-label="Ajustes" data-et="Ajustes">${icono('ajustes')}<span class="gl oculto" id="gl-avisos"></span></button></div>`;
  const liga = `<span class="sup-marca">${LOGO}<button class="sup-beta" data-accion="beta" aria-label="${avisosGuardados().admin ? 'Versión beta: quién usa la app' : 'Versión beta: reportar un fallo o proponer una idea'}">BETA</button></span><div class="sup-liga"><button id="supLiga" class="sup-nombre" data-accion="ligas" disabled></button><span id="supEstado"${vInv === 'd' ? ' class="sup-toca" data-accion="recargar" role="button" tabindex="0" title="Actualizar la liga"' : ''}></span><span id="supQueda" class="sup-queda" hidden></span></div>`;
  raiz().innerHTML = anchoYa
    ? `<header class="sup">${liga}<div class="sup-preg">${preg}</div>${nav}${botones}</header><main><div id="banda"></div><div id="vista" class="vista"></div></main>`
    : `<header class="sup">${liga}${botones}</header><main><div id="banda"></div><div id="vista" class="vista"></div></main>${nav}`;
}
/** el ordenador: la clase en <html> para el CSS y, al pasar de un tamaño a otro, todo se vuelve a pintar */
function ponerTamano() { document.documentElement.classList.toggle('escritorio', V.ancho()); }
ponerTamano();
/* Las subpestañas «llenas» (Equipo) reparten el ancho a partes iguales. Con la letra grande del móvil (130 % o más)
   «Jornadas», «Cláusulas» o «Beneficio» no caben y se montan unas encima de otras: si alguna no cabe, esa barra pasa a
   deslizarse de lado, como las demás. */
function ajustarTabs(raiz = document) {
  for (const t of raiz.querySelectorAll('.tabs.llenas, .tabs.no-caben')) {
    t.classList.remove('no-caben'); t.classList.add('llenas');
    if ([...t.querySelectorAll('button')].some((b) => b.scrollWidth > b.clientWidth + 1)) { t.classList.remove('llenas'); t.classList.add('no-caben'); }
  }
  // lo mismo con las cuatro cifras de la cabecera de Equipo (a 160 % salía «488,4…»): si alguna no cabe, en dos columnas
  for (const n of raiz.querySelectorAll('.eq2-num')) {
    n.classList.remove('dos');
    if ([...n.querySelectorAll('b, span')].some((b) => b.scrollWidth > b.clientWidth + 1)) n.classList.add('dos');
  }
  // los nombres de los clubes no se parten a media palabra (con la letra del móvil grande salía «BARCELON / A»):
  // si la palabra más larga no cabe, se achica la letra hasta que quepa (como mucho, al 60 %)
  for (const el of raiz.querySelectorAll(NOMBRES)) {
    el.style.fontSize = '';
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const base = parseFloat(getComputedStyle(el).fontSize);
    for (let f = base - 1; f >= base * 0.6; f -= 1) {
      el.style.fontSize = f + 'px';
      if (el.scrollWidth <= el.clientWidth + 1) break;
    }
  }
}
const NOMBRES = '.club-hero h2, .cc-n, .pf-eq span, .fx-nom';
// la letra condensada llega después del primer pintado: al llegar, se vuelve a medir
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { try { ajustarTabs(); } catch (e) { /* nada */ } });
let tamanoT = null;
window.addEventListener('resize', () => {
  try { ajustarTabs(); } catch (e) { /* nada */ }
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
  // en el móvil, corto: «Actualizado hace 1 min» ocupaba dos o tres líneas a 390 px (0.7.1g)
  const corto = innerWidth < 600, hace = D ? (corto ? dura(edad) : rel(D.t)) : '';
  const htmlEstado = S.errorCarga && D && !S.cargando
    ? `<i class="punto ${edad < 6 * 3600e3 ? 'viejo' : 'mal'}"></i>${S.errorCarga.tipo === 'red' ? 'Sin conexión' : 'Sin actualizar'} · ${diaDe(D.t) === diaDe() ? horaDe(D.t) : hace}`
    : D && D.lento && !S.cargando ? `<i class="punto viejo"></i>Conexión lenta · ${hace}`
      : `<i class="punto ${p}"></i>${S.cargando ? 'Actualizando…' : D ? (edad < MIN ? 'Al día' : corto ? `Hace ${hace}` : `Actualizado ${hace}`) : ''}`;
  // (21 nov, Carlos: «el logo de recargar se bugea cuando sale actualizando») la flecha de actualizar es un icono de verdad:
  // el carácter ↻ girando se salía de su sitio y se cortaba, porque la letra no gira sobre su centro
  // (24 nov, «el circulito dando vueltas se entrecorta cuando está actualizando») la cabecera se repinta muchas veces mientras
  // carga y rehacer el HTML volvía a crear la flecha: el giro empezaba de cero cada vez. Ahora solo se toca si cambia algo
  { const st = $('#supEstado');
    if (st) {
      const conGiro = st.classList.contains('sup-toca'), tx = st.querySelector(':scope > .sup-tx'), gi = st.querySelector(':scope > .sup-gir');
      // (la flecha no se vuelve a crear ni al pasar de «Al día» a «Actualizando…»: solo cambia el texto de al lado)
      if (tx && !!gi === conGiro) { if (tx.innerHTML !== htmlEstado) tx.innerHTML = htmlEstado; }
      else st.innerHTML = `<span class="sup-tx">${htmlEstado}</span>${conGiro ? `<i class="sup-gir" aria-hidden="true">${icono('refrescar')}</i>` : ''}`;
    } }
  $('#supEstado').title = D ? `Actualizado ${rel(D.t)}` : '';
  $('#bRefrescar').classList.toggle('gira', S.cargando);
  { const st = $('#supEstado'); if (st) st.classList.toggle('girando', !!S.cargando); }
  pintarNumAvisos();
  const pend = S.plan ? V.cuentaPasos(S, S.plan).pend : 0;
  const gh = $('#gl-hoy'); gh.textContent = pend; gh.classList.toggle('oculto', !pend);
  const ga = S.M.mias.filter((x) => x.riesgo === 'alto').length;
  const ge = $('#gl-equipo'); ge.textContent = ga; ge.classList.toggle('oculto', !ga);
  // (21) en el parón, el botón de Directo es «Parón», con la bandera (la pestaña lleva dentro el Directo de siempre)
  const modo = Pz.hayParon(S.M) ? 'paron' : 'directo';
  for (const b of $$('.nav button[data-ir="directo"]')) {
    if (b.dataset.modo === modo) continue;
    b.dataset.modo = modo;
    b.innerHTML = `${icono(modo === 'paron' ? 'bandera' : 'directo')}${modo === 'paron' ? 'Parón' : 'Directo'}<span class="gl oculto" id="gl-directo"></span>`;
  }
  // Directo: un punto verde mientras se juega la jornada
  const gd = $('#gl-directo'); if (gd) { gd.classList.add('punto-v'); gd.classList.toggle('oculto', !S.M.enJuego); }
  marcarApodos();
}
/* (0.8a, Carlos 17 nov) tras actualizar, el botón de Ajustes brilla hasta que lo tocas: la primera vez se abre en «Apodos
   de los rivales». Una vez (por móvil); no en la liga de ejemplo, ni con el tutorial o las novedades delante */
const apodosToca = () => !LS.get('apodos-visto', null) && !!S.D && !enDemo() && tourVisto() && !tourAbierto() && !document.body.classList.contains('con-nv');
function marcarApodos() { const b = $('#bAjustes'); if (b) b.classList.toggle('brilla', apodosToca()); }
/** las bandas de arriba (también sola, sin repintar la pestaña: (25 nov) al poner el código de una invitación) */
const htmlBanda = () => bandaLleno() + bandaMudanza() + bandaInvitado() + bandaInvita() + bandaInicio() + bandaActualizarPlay() + bandaSinDescarga() + bandaBeta() + bandaPlay() + (S.errorCarga && S.D ? `<div class="banda mal">${icono('alerta')}<span>${esc(bandaError(S.errorCarga, rel(S.D.t), S.D.t))}</span><button data-accion="recargar">Reintentar</button></div>` : '') + (S.nueva ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva (${esc(S.nueva.nombre)})</span><button data-accion="actualizarApp">Actualizar</button></div>` : S.webNuevaWeb ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva de la web (${esc(S.webNuevaWeb.version)})</span><button data-accion="recargarWeb">Descargar</button></div>` : S.webNueva ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva de la app</span><button data-accion="ponerWeb">Descargar</button></div>` : '');
function pintarBanda() { const b = $('#banda'); if (b) b.innerHTML = htmlBanda(); }
function pintar({ arriba = false } = {}) {
  if (!S.D) return;
  alDiaDichos();
  // lo que estás escribiendo (la pregunta, la clave) no se pierde al repintar (llega el plan, se pone al día la liga…)
  const escrito = ['pregunta', 'claveIA'].map((id) => { const el = $(`#${id}`); return el && el.value ? [id, el.value, document.activeElement === el ? el.selectionStart : null] : null; }).filter(Boolean);
  // (el buscador del Mercado guarda lo escrito en S.busca; solo hay que devolverle el cursor)
  const focoBusca = document.activeElement && document.activeElement.id === 'buscaJ' ? document.activeElement.selectionStart : null;
  marco();
  pintarSup();
  medirSup();
  $$('.nav button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === S.vista));
  const bp = $('#bPregunta'); if (bp) bp.classList.toggle('activo', S.vista === 'ia');
  const v = $('#vista');
  try { v.innerHTML = VISTAS[S.vista](S); } catch (e) {
    console.error(e);
    apuntarError(e.message, `pintar ${S.vista}${e.stack ? ` · ${String(e.stack).split('\n')[1] || ''}` : ''}`);
    v.innerHTML = `<div class="error-c"><b>Algo ha fallado al pintar esta pantalla.</b> Las demás pestañas siguen funcionando. Manda el fallo para que se arregle.<div class="fallo-det">${esc(e.message)}</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="mandarFallo">Mandar el fallo</button><button class="btn chico sec" data-accion="recargar">Volver a cargar</button></div></div>`;
  }
  // (sesión 8, M9) cada pestaña con su h1 (si no lo trae a la vista, uno solo para lectores) y su título en el navegador
  const nomV = S.vista === 'ia' ? 'Pregunta' : S.vista === 'directo' && Pz.hayParon(S.M) ? 'Parón' : (NAV.find(([k]) => k === S.vista) || [])[2] || 'Fantasy Manager';
  if (!v.querySelector('h1')) v.insertAdjacentHTML('afterbegin', `<h1 class="solo-lector">${esc(nomV)}</h1>`);
  document.title = `${nomV} · ${S.D.liga.nombre} · Fantasy Manager`;
  pintarBanda();
  if (arriba) window.scrollTo(0, 0);
  for (const [id, v, cur] of escrito) {
    const el = $(`#${id}`);
    if (!el || el.value) continue;
    el.value = v;
    if (cur != null) { el.focus({ preventScroll: true }); try { el.setSelectionRange(cur, cur); } catch (e) { /* nada */ } }
  }
  if (focoBusca != null) { const el = $('#buscaJ'); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focoBusca, focoBusca); } catch (e) { /* nada */ } } }
  // el chat se lee de abajo arriba; la guía de la clave, de arriba abajo
  if (S.vista === 'ia' && $('#pregunta')) {
    bajarChat();
    // la pregunta que paraste vuelve a la caja
    if (S.borrador && !S.charlando) { const ta = $('#pregunta'); if (ta) { ta.value = S.borrador; S.borrador = ''; } }
  }
  encuadrar(v);
  ajustarTabs(v);
  // la subpestaña elegida, a la vista en su barra (al repintar, la barra volvía al principio y la tapaba)
  try {
    const t = v.querySelector('.tabs .activo'), b = t && t.closest('.tabs-in');
    if (t && b && b.scrollWidth > b.clientWidth) { const r = t.getBoundingClientRect(), rb = b.getBoundingClientRect(); b.scrollLeft += (r.left - rb.left) - (rb.width - r.width) / 2; }
  } catch (e) { /* nada */ }
  // en Directo, la clasificación de la jornada dice cuántos le quedan a cada rival: hacen falta sus onces
  if (S.vista === 'directo' && S.M.enJuego && S.M.vivo && (S.seg.directo === 'liga' || V.ancho())) cargarOncesRivales();
  if (S.vista === 'equipo' && S.seg.equipo === 'jornadas') cargarJornadaMia();
  // (24 nov) sin jornada en juego, también: las 24 h de después de una, Directo enseña tu liga en esa jornada
  // (y en Rivales → Por jornada, donde está desde el 24 nov)
  if ((S.vista === 'directo' && !S.M.enJuego) || (S.vista === 'rivales' && S.seg.rivales === 'jornadas')) cargarPtsJornadas();
  // el cierre hasta la hora de apertura y el límite de minutos, sin esperar a la próxima vuelta del reloj
  mirarLimite();
  // los anuncios: en la web, el de AdSense en las pestañas (nunca en Pregunta); en la app de Google Play, que ya se pueden
  // cargar (desde la 0.8 sin banner: los intersticiales, en una pausa)
  ponerBanner(S.vista !== 'ia', true);
}
/* ---------------- anuncios: AdMob en la versión de Google Play y AdSense en la web ---------------- */
let bannerYa = null;
/** si: el anuncio de la web va en esta pantalla; zona (la app de Google Play): ya se pueden cargar los suyos (por defecto, si) */
function ponerBanner(si, zona = si) {
  if (EN_FONDO) return;
  // nunca en la pantalla del límite de minutos o la cuenta atrás (Google no deja anuncios en una pantalla sin salida)
  const limitado = document.body.classList.contains('limitado');
  si = !!si && !limitado;
  // en la web, los de AdSense (anuncios-web.js), solo con la liga ya cargada (antes no se sabe quién eres) y solo en
  // una pestaña con contenido. Ni en la portada, ni en la carga, ni en la entrada con código, ni en una pestaña vacía:
  // AdSense rechazó la web el 2 nov por anuncios en pantallas sin contenido. Por eso el script ya no se pone en la
  // entrada (antes iba sin bloques para que Google viera su código: la verificación va con la etiqueta
  // google-adsense-account de index.html y con ads.txt)
  // En las dos (web y Google Play), solo con la sesión de tu liga iniciada (Carlos, 8 nov): ni antes de entrar, ni
  // mientras carga, ni en la liga de ejemplo, ni en una pestaña vacía o cargando
  const tuLiga = !!S.D && !S.D.demo && !enDemo();
  if (!enApp) { si = si && tuLiga && vistaConContenido(); const modo = S.D ? anunciosWebModo() : null; anunciosWeb(si && !!modo, V.ancho(), false, modo === 'prueba'); return; }
  // (0.8, Carlos 16 nov 23:24) en la app de Google Play ya no hay banner abajo: Android solo necesita saber si tu liga
  // está cargada (hasta entonces no carga ni precarga ningún anuncio) y si no está la pantalla del límite. Los
  // intersticiales los pide pausaNatural
  const z = !!zona && tuLiga && !limitado;
  // (y si a esta cuenta le tocan intersticiales: al dueño y a los de su liga, Android ni los carga)
  const ic = intersticialCfg(), inter = z && ic.on && intersticialParaMi();
  // (17 nov) y si hoy le toca el de apertura (uno al día; nunca el primer día ni al dueño ni a los de su liga)
  const ac = aperturaCfg(), ap = z && ac.on && intersticialParaMi() && aperturaToca();
  const k = `${z}|${inter}|${ic.bloque}|${ap}|${ac.bloque}`;
  if (k === bannerYa) return;
  bannerYa = k;
  nativo.zonaAnuncios(z, ic.bloque, inter);
  nativo.aperturaAnuncios(ap, ac.bloque);
  // (0.8.4r) mientras pueda estar el de apertura en pantalla, la versión nueva no recarga encima
  aperturaT = ap ? Date.now() : 0;
}
window.addEventListener('apertura-vista', () => ponerBanner(!!S.D && !!$('#vista') && S.vista !== 'ia', !!S.D && !!$('#vista')));
// (al volver a la app, por si ha cambiado el día y hoy toca otra vez el de apertura)
window.addEventListener('fm-vuelta', () => ponerBanner(!!S.D && !!$('#vista') && S.vista !== 'ia', !!S.D && !!$('#vista')));
window.addEventListener('limite-cambia', () => ponerBanner(!!S.D && !!$('#vista') && S.vista !== 'ia', !!S.D && !!$('#vista')));
/* (0.8) el intersticial, solo en una pausa natural: al cambiar de pestaña con la barra de abajo o al cerrar una ficha con
   la X o arrastrándola (nunca con el «atrás» de Android, que puede ser para salir). Lo demás (cada cuánto, la gracia al
   empezar, el tope del día, a quién) lo mira intersticial.js con «intersticial» de limites.json */
const FICHAS_PAUSA = new Set(['j', 'r', 'c', 'p', 'sust', 'resumen']);
/** ¿la pantalla está libre para un anuncio a pantalla completa? Nada abierto, nada a medias, la IA sin pensar */
function pantallaLibre() {
  if (EN_FONDO || !S.D || !S.M || S.D.demo || enDemo() || !$('#vista')) return false;
  if (S.hoja || $('.hoja') || $('.visor') || $('#bienvenida') || tourAbierto() || document.body.classList.contains('en-tour') || document.body.classList.contains('con-nv')) return false;
  if (document.body.classList.contains('limitado') || S.vista === 'ia' || S.anuncio) return false;
  if (S.charlando || (S.planEstado && S.planEstado.cargando) || preguntaPendiente()) return false;
  const a = document.activeElement;
  return !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
function pausaNatural() {
  if (!conAnuncios()) return;
  // tras la animación de cerrar la ficha o con la pestaña nueva ya pintada; si mientras tanto ha abierto otra cosa, nada
  setTimeout(() => { try { quizaIntersticial(pantallaLibre()); } catch (e) { /* sin anuncio, la app sigue */ } }, 450);
}
/** ¿la pestaña tiene contenido de verdad? Sin contar los «no hay nada» (.vacio) ni el «pensando» de la IA, tiene que
    quedar texto de sobra; si no (una lista vacía, una pestaña cargando), no hay anuncio */
const TEXTO_MIN_ANUNCIO = 400;
function vistaConContenido() {
  const v = $('#vista');
  if (!v) return false;
  const largo = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().length;
  let n = largo(v);
  for (const x of v.querySelectorAll('.vacio, .cargando-ia')) n -= largo(x);
  return n >= TEXTO_MIN_ANUNCIO;
}
const conAnuncios = () => enApp && !EN_FONDO && nativo.hayAnuncios();
// «Pedir otro plan a la IA» con la clave de cada uno: sin límite y sin anuncios (0.7.12)
const planesHoy = () => { const g = LS.get('planes-mano', null); return g && g.dia === diaDe() ? g.n : 0; };
const contarPlan = () => LS.set('planes-mano', { dia: diaDe(), n: planesHoy() + 1 });
/** con la IA de la app: sin planes hoy, el anuncio para uno más (solo en la de Google Play y si queda alguno hasta el tope);
    donde no hay anuncio que enseñar, no hay plan de más (Carlos, 14 nov 11:38) */
function pedirPlanExtra(cu) {
  if (!cu.masConAnuncio || !conAnuncios()) { S.planEstado = { cupo: cu }; if (!S.hoja) pintar(); return; }
  S.anuncio = { para: 'plan' };
  hoja('anuncio', 'plan');
}
function pedirOtroPlan() {
  if ((S.planEstado || {}).cargando) return;
  if (planesApp(enDemo())) {
    // (aunque lo último guardado diga que no quedan, se pregunta al Worker, que es quien cuenta: si de verdad no quedan,
    // contesta con el cupo y sale el anuncio. Así no se queda atrás un cupo viejo, como el del dueño sin límite)
    S.planEstado = {};
    generarPlan();
    return;
  }
  // (0.7.12, Carlos 15 nov: «esa IA no depende de mí») con la clave de Google de cada uno, sin anuncios ni tope: los
  // anuncios solo van en los planes que paga la app. Se sigue contando para el diagnóstico
  const yaHay = S.plan && !S.plan.auto && S.plan.dia === diaDe();
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
  // (0.8) los intersticiales esperan un rato después de un bonificado
  if (visto) bonificadoVisto();
  const sinAnuncio = !visto && /sin anuncio|sin consentimiento|no se pudo/.test(motivo || '');
  // las funciones top (limite.js): el dinero de un rival, 2 anuncios (5 min, 2 veces por jornada); lo demás, 1
  if (para === 'top') {
    const clave = S.anuncio && S.anuncio.clave, rid = S.anuncio && S.anuncio.rival;
    let abierta = false;
    if (visto) abierta = anuncioTopVisto(clave, rid);
    // sin anuncio que enseñar, se abre igual lo que pedía (un rival sus minutos; lo demás, media hora), una vez al día
    else if (sinAnuncio && puedeTopGratis()) { abrirTopGratis(clave, 30, rid); abierta = true; }
    else if (sinAnuncio) {
      // la hoja sigue abierta con el botón para reintentar, como en los planes de más
      S.anuncio = { ...(S.anuncio || {}), para, cargando: false, error: 'Ahora no hay anuncio. Prueba otra vez en un rato.' };
      if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
      return;
    }
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
      const deRival = rid != null && POR_JORNADA.includes(clave);
      const hasta = abiertaHasta(clave, rid);
      tostada(deRival ? `Su dinero, abierto ${minutosRival()} minutos${usosQuedan(clave) ? '' : ' (era la última vez de esta jornada)'}` : hasta ? `Abierta hasta las ${horaDe(hasta)}` : !visto ? 'No había anuncio ahora: abierta gratis media hora' : 'Abierta hasta medianoche', 5000);
      cerrarTopA();
      return;
    }
    S.anuncio = { ...(S.anuncio || {}), para, cargando: false, error: 'Para abrirlas hay que ver el anuncio hasta el final.' };
    if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
    return;
  }
  // (16 nov) las preguntas de más con la IA de la app: un anuncio entero, 3 más (lo cuenta el Worker con «extra»)
  if (para === 'pregunta') {
    if (visto) {
      contar('b');
      const ta = $('#pregunta');
      const t = (S.anuncio && S.anuncio.t) || S.borrador || (ta ? ta.value : '');
      S.anuncio = null; S.borrador = '';
      if (ta) ta.value = '';
      cerrarHoja();
      if (S.vista !== 'ia') ir('ia');
      enviarPregunta(t, { extra: true });
      return;
    }
    S.anuncio = { ...(S.anuncio || {}), para, cargando: false, error: sinAnuncio ? 'Ahora no hay ningún anuncio que enseñar. Prueba en un rato; tu pregunta sigue en la caja.' : 'Para las preguntas de más hay que ver el anuncio hasta el final.' };
    if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
    return;
  }
  if (para !== 'plan') return;
  // con la IA de la app: un anuncio visto entero, un plan más (lo cuenta el Worker con «extra»); sin anuncio, nada
  if (planesApp(enDemo())) {
    if (visto) {
      contar('b');
      S.anuncio = null;
      cerrarHoja();
      if (S.vista !== 'hoy') ir('hoy');
      S.planEstado = {};
      generarPlan({ extra: true });
      return;
    }
    S.anuncio = { para, error: sinAnuncio ? 'Ahora no hay ningún anuncio que enseñar, así que no hay plan de más. Prueba en un rato.' : 'Para el plan de más hay que ver el anuncio hasta el final.' };
    if (S.tipoHoja && S.tipoHoja[0] === 'anuncio') repintarHoja();
    return;
  }
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
/** baja hasta un ancla (#id) de la pestaña o de la ficha abierta, dejando sitio para la cabecera (scroll-margin-top) */
function bajarA(sel, raiz = null) {
  if (!sel) return;
  requestAnimationFrame(() => { const r = (raiz && raiz.isConnected ? raiz : null) || S.hoja || $('#vista'); const o = (r && r.querySelector(sel)) || $(`#vista ${sel}`); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
function ir(vista, { arriba = true } = {}) {
  vista = ALIAS[vista] || vista;
  if (!VISTAS[vista]) vista = 'hoy';
  if (S.vista !== vista) nativo.toque();
  S.vista = vista;
  if (location.hash !== '#' + vista) history.replaceState(null, '', '#' + vista);
  pintar({ arriba });
  // (repaso de la 0.8s) al ir a Hoy o a Pregunta, lo último de los otros dispositivos (como mucho cada 20 s): con la app
  // abierta en el móvil mientras se usa la web, antes no llegaba nada hasta salir de la app y volver
  if ((vista === 'hoy' || vista === 'ia') && S.D && !enDemo()) sincronizar({ por: 'vista' });
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
/* lo que llega por su lado al arrancar (el directo, onces y noticias, las fichas, tu once) se junta en una sola pasada
   del motor: antes eran de 3 a 5 seguidas en el primer minuto (revisión total, M7). rehacer() a secas lo hace ya y se
   come lo que estuviera esperando */
let rehacerT = 0;
function rehacerLuego() {
  clearTimeout(rehacerT);
  rehacerT = setTimeout(() => { rehacerT = 0; if (!S.D) return; rehacer(); if (!S.hoja) pintar(); }, 300);
}
const rehacerSiFalta = () => { if (rehacerT && S.D) { rehacer(); if (!S.hoja) pintar(); } };
function rehacer() {
  clearTimeout(rehacerT); rehacerT = 0;
  S.c = cfg();
  S.H = historico();
  S.det = { ...detalles(), ...S.det };
  ponerEquipos(S.D.equipos);
  // (0.8.4o) quién eres, ya antes del análisis: lo que le llega al motor de lo que te dijeron depende de lo que tienes abierto
  fijarYo(yoReal(), enDemo());
  S.M = analizar(S.D, S.H, S.c, extraM());
  fijarMotor(S.M);
  apuntarQuien();
  // (22 nov) el plan, las preguntas, lo que le cuentas y los pasos hechos, los mismos en todos tus dispositivos (sinc.js)
  iniciarSinc({ liga: S.D && !S.D.demo && S.D.liga ? S.D.liga.id : '', llega: llegaSinc, charlando: () => !!S.charlando });
  // quién eres, para lo bloqueado (antes de pintar nada)
  fijarYo(yoReal(), enDemo());
  fijarLiga(S.D.liga && S.D.liga.id);
  // el cierre del APK de GitHub no va con el dueño: sabido quién es, se quita la ventana si ya no toca
  if (enApkGithub() && !cierreApk().cerrada) { const v = document.getElementById('aviso-play'); if (v && !v.querySelector('[data-accion="cerrarAvisoPlay"]')) v.remove(); }
  fijarJornada(((S.M && (S.M.enJuego || S.M.proxima)) || {}).n);
  cerrarTopA();
  // lo previsto frente a lo que pasó: corrige los puntos esperados de la próxima pasada y lo ve la IA
  aprender(S.D, S.M, S.det);
  montarPlan();
  if (apuntarReventa()) { const ap = S.M.aprende; S.M = analizar(S.D, S.H, S.c, extraM()); S.M.aprende = ap; fijarMotor(S.M); montarPlan(); }
  programar(S.D, S.M, planAvisos());
  if (!EN_FONDO) {
    programarFondo();
    // lo que ves con la app abierta ya no te llega luego como notificación
    marcarVistos(avisosNuevos(null, S.D, S.M));
    // (16 nov) una pregunta a la IA que se quedó a medias porque Android cerró la app
    if (preguntaPendiente()) setTimeout(recogerPregunta, 800);
  }
}
/** la IA en segundo plano: cada 3 horas y unos minutos después del próximo cambio de mercado */
function programarFondo() {
  if (!enApp) return;
  const cierre = (S.M && S.M.cierreMercado) || LS.get('fondo-cierre', 0) || 0;
  let prox = cierre ? cierre + 8 * MIN : 0;
  // con un aviso de fallo esperando respuesta (o, para el dueño y quien ayuda con los fallos, avisos sin contestar) se mira
  // cada 40 minutos, para que la respuesta llegue en una notificación aunque la app esté cerrada
  const a = avisosGuardados();
  if (haySesion() && ((a.lista || []).some((x) => !x.respuesta) || ((a.admin || a.ve) && a.pendientes > 0))) {
    const t = Date.now() + 40 * MIN;
    if (!prox || prox < Date.now() || t < prox) prox = t;
  }
  // y unos 50 y 20 minutos antes de cada partido en que juega alguno de tu once, para el once confirmado
  const tOnce = (S.D ? pasadasOnce(S.D) : LS.get('fondo-onces', [])).find((x) => x > Date.now() + MIN);
  if (tOnce && (!prox || prox < Date.now() || tOnce < prox)) prox = tOnce;
  // (0.7.13l) y a la hora del próximo plan que sale solo (un minuto después, para que ya le toque)
  const pt = planIASolo(enDemo()) ? proximoTurno(S.M || { cierreMercado: cierre }) : null;
  if (pt && (!prox || prox < Date.now() || pt.t + MIN < prox)) prox = pt.t + MIN;
  nativo.programarFondo(cfgFondo().on && !enDemo(), prox);
}

/* ---------- el once confirmado con la app cerrada ----------
   Unos 50 y 20 minutos antes de cada partido en que juega alguno de los que tienes alineados, una pasada en segundo
   plano mira el once confirmado y, si uno de los tuyos no sale de titular, te avisa para que lo cambies. Solo antes de
   los partidos que abren la jornada: LaLiga cierra el once con el primer partido y ya no deja cambiar a nadie hasta la
   siguiente (aviso de Domy, 31 oct; antes se avisaba antes de cada partido). */
const ONCE_ANTES = [50 * MIN, 20 * MIN];
/** tu once de LaLiga, el último que se ha visto (o null) */
function onceSabido() {
  const g = LS.get(K('mi-once'), null);
  if (g && Date.now() - g.t < 8 * DIA && (g.ids || []).length >= 5) return g.ids;
  const v = LS.get(K('vivo'), null);
  return v && Array.isArray(v.once) && v.once.length >= 5 ? v.once : null;
}
const apuntarMiOnce = (ids, forma = null) => {
  if (!ids || ids.length < 5) return;
  // (19 nov) con la formación, para pintar en Hoy y en Equipo el once que tiene puesto en LaLiga
  const g = LS.get(K('mi-once'), null);
  const f = forma || (g && (g.ids || []).join() === ids.map(String).join() ? g.forma : null) || null;
  LS.set(K('mi-once'), { t: Date.now(), ids: ids.map(String), forma: f });
};
/** «Actualizar» vuelve a pedir tu once a LaLiga aunque se mirara hace menos de 10 minutos */
let forzarOnce = false;
/** cuándo cierra LaLiga el once de la jornada del partido de un equipo que empieza hacia t: con el primer partido de esa jornada */
function cierreOnce(D, t, eq) {
  const ps = (D && D.partidos) || [];
  const p = ps.find((q) => q.fecha && Math.abs(q.fecha - t) < 3 * HORA && (eq == null || String(q.localId) === String(eq) || String(q.visitanteId) === String(eq)));
  if (!p || p.jornada == null) return t;
  return Math.min(...ps.filter((q) => q.jornada === p.jornada && q.fecha).map((q) => q.fecha));
}
/** las horas de esas pasadas (de los partidos de los próximos 8 días); se guardan para cuando no hay datos a mano */
function pasadasOnce(D) {
  if (!D || D.demo || !D.maestro) return [];
  const yo = D.yo && D.yo.teamId;
  const ids = onceSabido() || ((D.plantillas && D.plantillas[yo]) || []).map((f) => f.pid);
  const eqs = new Set(ids.map((pid) => D.maestro[pid] && String(D.maestro[pid].equipoId)).filter(Boolean));
  const ahora = Date.now(), horas = new Set();
  for (const p of D.partidos || []) {
    if (!p.fecha || p.fecha < ahora || p.fecha - ahora > 8 * DIA) continue;
    if (!eqs.has(String(p.localId)) && !eqs.has(String(p.visitanteId))) continue;
    if (cierreOnce(D, p.fecha, p.localId) < p.fecha) continue;
    for (const a of ONCE_ANTES) horas.add(p.fecha - a);
  }
  const out = [...horas].filter((t) => t > ahora).sort((a, b) => a - b).slice(0, 40);
  LS.set('fondo-onces', out);
  return out;
}
/** ¿empieza pronto (en menos de 100 minutos) algún partido de los tuyos? */
const onceCerca = (D, ahora = Date.now()) => (D && D.partidos ? D.partidos : []).some((p) => p.fecha > ahora && p.fecha - ahora < ANTES_ONCE);
/** los avisos del once confirmado: los de tu once de LaLiga que no son titulares, si aún se puede cambiar el once */
async function avisosOnce(D, M, al) {
  const yo = D && D.yo && D.yo.teamId;
  if (!yo || !M || D.demo || !onceCerca(D)) return [];
  let ids = null;
  try { ids = idsOnce(await api.miOnce(yo)).map(String); } catch (e) { if (e.sesion) throw e; }
  if (ids && ids.length >= 5) apuntarMiOnce(ids); else ids = onceSabido();
  if (!ids) return [];
  if (!al || !al.jugadores) al = await alineaciones(D).catch(() => null);
  const ahora = Date.now(), J = (al && al.jugadores) || {};
  const TXT = { suplente: 'suplente', nosale: 'no sale de titular', fuera: 'no convocado', baja: 'de baja' };
  const FRASE = { suplente: 'Sale de suplente en el once confirmado', nosale: 'No sale de titular en el once confirmado', fuera: 'No está convocado', baja: 'Está de baja' };
  const malos = ids.map((pid) => ({ pid, j: M.J(pid), a: J[pid] })).filter((x) => x.a && x.a.estado !== 'titular' && x.a.ini > ahora && TXT[x.a.estado] && cierreOnce(D, x.a.ini, x.j && x.j.equipoId) > ahora);
  if (!malos.length) return [];
  // a quién meter: uno tuyo del mismo puesto que no está en el once, cuyo partido no ha empezado y que no se sabe que no juegue
  const usados = new Set();
  const cambio = (x) => {
    const c = (M.mias || []).filter((y) => !ids.includes(String(y.pid)) && !usados.has(y.pid) && y.j.pos === x.j.pos && !['injured', 'suspended', 'out_of_league'].includes(y.j.estado))
      .filter((y) => {
        const a = J[y.pid];
        if (a) return a.estado === 'titular' && a.ini > ahora;
        // (sin once confirmado de su equipo: que su próximo partido no haya empezado ya)
        const p = (D.partidos || []).filter((q) => q.fecha > ahora - 3 * HORA && (String(q.localId) === String(y.j.equipoId) || String(q.visitanteId) === String(y.j.equipoId))).sort((q, r) => q.fecha - r.fecha)[0];
        return !p || p.fecha > ahora;
      })
      .sort((a, b) => M.ppEsperado(b.j) - M.ppEsperado(a.j))[0];
    if (c) usados.add(c.pid);
    return c;
  };
  const hora = (t) => `${cuandoT(t, { hora: false })} a las ${horaDe(t)}`;
  if (malos.length === 1) {
    const x = malos[0], c = cambio(x);
    return [{
      k: `once:${x.pid}:${x.a.ini}`,
      titulo: `${x.j.nombre} no es titular`,
      texto: `${FRASE[x.a.estado]} (su partido empieza ${hora(x.a.ini)}) y lo tienes en tu alineación: cámbialo antes de ${hora(cierreOnce(D, x.a.ini, x.j && x.j.equipoId))}, cuando LaLiga cierra el once${c ? `; puedes meter a ${c.j.nombre}` : ''}.`,
      hash: 'equipo',
    }];
  }
  const partes = malos.map((x) => { const c = cambio(x); return `${x.j.nombre}, ${TXT[x.a.estado]} (${hora(x.a.ini)})${c ? ` → ${c.j.nombre}` : ''}`; });
  return [{
    k: `once:${malos.map((x) => `${x.pid}:${x.a.ini}`).sort().join(',')}`,
    titulo: `${malos.length} de tu once no son titulares`,
    texto: `${partes.join('; ')}. Cámbialos antes de ${hora(Math.min(...malos.map((x) => cierreOnce(D, x.a.ini, x.j && x.j.equipoId))))}, cuando LaLiga cierra el once.`,
    hash: 'equipo',
  }];
}
/** las respuestas a tus avisos de fallo (y al dueño, los avisos nuevos), como notificaciones: una sola petición */
async function avisosDeFallos() {
  if (!hayQueMirar()) return [];
  let r;
  try { r = await misAvisos(); } catch (e) { if (e.sesion) throw e; return []; }
  const out = r.nuevasResp.slice(0, 3).map((x) => ({ k: `fallo:${x.id}:${x.respondida}`, titulo: `${firmaDe(x.por) || 'Fantasy Manager'} te ha contestado`, texto: x.respuesta.length > 300 ? `${x.respuesta.slice(0, 297)}…` : x.respuesta, hash: 'fallos' }));
  if (r.nuevosRecibidos) out.push({ k: `fallos-nuevos:${r.pendientes}:${Date.now()}`, titulo: r.nuevosRecibidos > 1 ? `${r.nuevosRecibidos} avisos de fallos nuevos` : 'Un aviso de fallo nuevo', texto: 'Entra para leerlo y contestar', hash: 'fallos' });
  return out;
}

/** (19 nov) con la app cerrada: si ha entrado un amigo con tu código, que lo sepas (solo a quien ya ha sacado su código) */
async function avisosInvitarFondo() {
  const g = LS.get('invitar', null);
  if (!g || !g.uid || !g.est || !g.est.cod) return [];
  try {
    const r = await leerInvitar(g.uid);
    if (!r.nuevos) return [];
    const c = cfgInv();
    return [{ k: `inv:${r.est.entran}`, titulo: r.nuevos > 1 ? `${r.nuevos} amigos tuyos han entrado` : 'Tu amigo ya ha entrado', texto: `Elige ${c.rivales} rivales y mira su dinero: tienes ${c.horas} h. Está en Ajustes → Invita a un amigo`, hash: 'hoy' }];
  } catch (e) { return []; }
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
    // (0.7.13l) de noche nada, salvo un plan a su hora (si eligió una de madrugada)
    const turnoF = () => turnoPendiente(S.M || { cierreMercado: LS.get('fondo-cierre', 0) }, ultimoPlan());
    if (deNoche() && !(planIASolo(enDemo()) && turnoF())) { paso('de noche: nada'); return; }
    // (de madrugada no se miran: se darían por avisadas sin avisar)
    const fallos = callado() ? [] : [...(await avisosDeFallos()), ...(await avisosInvitarFondo())];
    if (fallos.length) paso(`${fallos.length} aviso${fallos.length > 1 ? 's' : ''} de fallo o de amigos`);
    const completo = LS.get('fondo-completo', 0), cierre = LS.get('fondo-cierre', 0);
    if (completo && Date.now() - completo < 150 * MIN && Date.now() < cierre && !(planIASolo(enDemo()) && turnoF())) {
      const lista = [...fallos];
      // con un partido de los tuyos a punto de empezar, el once confirmado (con la liga guardada: está al día)
      const g = foto();
      if (g && onceCerca(g)) {
        try {
          S.D = g; rehacer();
          const o = await avisosOnce(S.D, S.M);
          lista.push(...o);
          paso(`once confirmado: ${o.length ? 'alguno de los tuyos no es titular' : 'nada'}`);
        } catch (e) { if (e.sesion) throw e; paso(`once confirmado: ${e.message}`); }
      } else paso('liga mirada hace poco: solo los avisos de fallo');
      if (!callado()) { const nuevos = sinAvisar(lista); avisar(nuevos); reg.avisos = nuevos.length; }
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
    try {
      const o = await avisosOnce(S.D, S.M, S.fuentes && S.fuentes.alineaciones);
      if (o.length) { lista.unshift(...o); paso('once confirmado: alguno de los tuyos no es titular'); }
    } catch (e) { if (e.sesion) throw e; paso(`once confirmado: ${e.message}`); }
    LS.set('fondo-completo', Date.now()); LS.set('fondo-cierre', (S.M && S.M.cierreMercado) || 0);
    // (22 nov) antes de pedir el plan con la app cerrada: puede que otro dispositivo tuyo ya lo tenga
    try { await sincAntes(5000, { por: 'fondo' }); } catch (e) { /* como antes */ }
    if (planViejo(S.M) || turnoF()) {
      let conIA = false;
      // (con la IA de la app, 2 al día: solos, a sus horas, y cuentan en los del día; planViejoAuto y planes-hora.js)
      if (planIASolo(enDemo()) && planViejoAuto(S.M, enDemo())) {
        intentarTurno(turnoF());
        try {
          // (con un reloj que no se para en segundo plano, y que corta de verdad la pregunta si salta)
          const ctlF = new AbortController();
          let quitarF = () => {};
          try {
            await Promise.race([
              planDelDia(S.D, S.M, S.c, { signal: ctlF.signal, demo: enDemo() }),
              new Promise((_, mal) => { quitarF = relojFijo(7 * MIN, () => { ctlF.abort(); mal(new Error('la IA ha tardado más de 7 minutos')); }); }),
            ]);
          } finally { quitarF(); }
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

/* (0.8.4o) lo que te han dicho los rivales llega al motor solo de los que tienen su dinero abierto (dinero-dicho.js): al
   abrirse o cerrarse uno con una cifra apuntada se rehace el análisis (alDiaDichos, al pintar) */
function dichosMotorF() { S.firmaD = DD.firmaDichos(); return DD.dichosMotor(); }
function alDiaDichos() {
  if (!S.D || !S.M || S.firmaD == null || DD.firmaDichos() === S.firmaD) return;
  const ap = S.M.aprende;
  S.M = analizar(S.D, S.H, S.c, extraM());
  S.M.aprende = ap;
  fijarMotor(S.M);
  montarPlan();
}
/** lo que el motor necesita además de la foto: fichas, reventa, onces probables y noticias */
function extraM() {
  const f = S.fuentes || fuentesGuardadas() || {};
  return { cambios: S.D && !enDemo() ? LS.get(K('cambios'), {}) : {}, det: S.det, reventa: reventa(), onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, vivo: vivoGuardado(), calib: calibracion(), actHist: S.D && S.D.liga ? actHist(S.D.liga.id) : null, notas: notasVigentes(), dichos: dichosMotorF(), calDinero: calDineroGuardada().cal,
    pujasMias: apuntarMisPujas(), calPujas: calPujasGuardada().cal, pujasVistas: apuntarPujasVistas(), quienVisto: S.D && !enDemo() ? LS.get(K('quien-visto'), {}) : {} };
}

/* (0.7.13u) tus pujas del mercado, para aprender de las que ganas y pierdes: cada una que la app ve puesta (jugador, lo que
   pujaste, lo que valía y cuándo se cierra). Al cerrarse el mercado, el motor mira en la actividad de la liga quién se lo
   llevó y por cuánto. 45 días; nada en la liga de ejemplo */
function apuntarMisPujas() {
  const k = K('pujas-mias'), ya = LS.get(k, {});
  if (!S.D || enDemo()) return ya;
  const ahora = Date.now();
  let cambia = false;
  for (const m of S.D.mercado || []) {
    if (m.tipo !== 'liga' || !(Number(m.miPuja) > 0) || !m.cierra || m.cierra < ahora) continue;
    const c = `${m.pid}|${m.cierra}`, j = (S.D.maestro || {})[m.pid] || {};
    if (ya[c] && ya[c].puja === Number(m.miPuja)) continue;
    ya[c] = { pid: m.pid, puja: Number(m.miPuja), valor: Number(j.valor) || 0, precio: Number(m.precio) || 0, cierra: m.cierra, t: ahora };
    cambia = true;
  }
  for (const [c, p] of Object.entries(ya)) if (!p || !p.cierra || ahora - p.cierra > 45 * DIA) { delete ya[c]; cambia = true; }
  if (cambia) LS.set(k, ya);
  return ya;
}

/* (0.8.2) cuándo entra cada puja de otro por un libre del mercado (pujas-vistas.js): con cada foto nueva de la liga se mira
   si el número de pujas de cada jugador ha subido. Lo usa el motor para decir quién puede estar detrás (quien-puja.js) */
function apuntarPujasVistas() {
  const k = K('pujas-vistas'), ya = LS.get(k, null);
  if (!S.D) return ya;
  const r = registrarPujas(ya, S.D);
  if (r.cambia) LS.set(k, r.reg);
  return r.reg;
}
/* (0.8.2) la lista de «quién puja» que la app da por cada libre, tal como estaba la última vez antes de cerrarse el mercado:
   cuando se sabe quién se lo llevó, el motor cuenta cuántas veces estaba arriba (`M.quienAcierto`). 45 días; no en la demo */
function apuntarQuien() {
  if (!S.D || !S.M || enDemo()) return;
  const k = K('quien-visto'), ya = LS.get(k, {}), ahora = Date.now();
  let cambia = false;
  for (const m of S.M.mercado || []) {
    if (m.tipo !== 'liga' || !m.quien || !m.quien.cands.length || !m.cierra || m.cierra < ahora) continue;
    const c = `${m.pid}|${m.cierra}`, top = m.quien.cands.slice(0, 3).map((x) => String(x.tid));
    if (ya[c] && ya[c].top.join() === top.join() && ya[c].n === m.ajenas) continue;
    ya[c] = { pid: m.pid, c: m.cierra, top, n: m.ajenas, t: ahora };
    cambia = true;
  }
  for (const [c, g] of Object.entries(ya)) if (!g || !g.c || ahora - g.c > 45 * DIA) { delete ya[c]; cambia = true; }
  if (cambia) LS.set(k, ya);
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

/** el plan que se enseña: el de la IA si es de hoy; si no (no hay, es de otro día, la IA aún piensa o ha fallado), el del
 * motor de hoy (plan.js), que ya viene cuadrado. Antes, mientras llegaba el nuevo o si fallaba, se veía el de ayer */
/** (22 nov) ha llegado algo de otro dispositivo tuyo: lo que te ha contado cambia el análisis; lo demás, el plan y lo pintado */
function llegaSinc(claves) {
  if (!S.D) return;
  if (claves.includes('notas')) rehacer(); else { montarPlan(); programar(S.D, S.M, planAvisos()); }
  if (S.hoja || S.cargando || tourAbierto()) return;
  if (S.vista === 'ia' ? !S.charlando : true) { const y = window.scrollY; pintar(); if (S.vista !== 'ia') window.scrollTo(0, y); }
}
function montarPlan() {
  // (22 nov) si después de ese plan le has contado a la IA algo que manda (sin blindajes, a quién no vendes…), ya no vale:
  // sale el de la app con eso contado, hasta que lo rehagas
  const P = planGuardadoHoy(S.M);
  if (P) {
    S.plan = rematarAuto(cuadrarPlan(P, S.D, S.M));
    // el plan corto de la IA sale del motor: mientras no cambie el saldo, sus cuentas para la jornada siguen valiendo
    if (P.motor && P.cuentas && P.foto && P.foto.dinero === S.D.dinero) S.plan = rematarMotor(S.plan, S.M, { titular: false });
  } else S.plan = planDeHoy(S.D, S.M, S.c);
  // (24 nov, decide.js) el plan que se ve: con él, la decisión de cada jugador dice «hace falta el dinero» donde el plan lo vende por eso
  if (S.M.verPlan) S.M.verPlan(S.plan);
  S.opPorPid = {};
  for (const o of S.plan.ops) if (o.pid && !o.descartada && !S.opPorPid[o.pid]) S.opPorPid[o.pid] = o;
  // (24 nov) los cambios del plan (quién sale → quién entra): si ganas la puja, el motor da relevo al que sale
  const cbs = S.plan.ops.filter((o) => o.cambio && !o.descartada);
  if (cbs.length && !enDemo()) {
    const g = LS.get(K('cambios'), {}), ahora = Date.now();
    for (const k of Object.keys(g)) if (ahora - (g[k].t || 0) > 10 * DIA) delete g[k];
    for (const o of cbs) if (!g[o.cambio.sale] || g[o.cambio.sale].entra !== o.cambio.entra) g[o.cambio.sale] = { entra: o.cambio.entra, t: ahora };
    LS.set(K('cambios'), g);
  }
}
/** el plan para los avisos (la alarma de 1 min de cada clausulazo): sin los pasos que ya has marcado como hechos */
function planAvisos() {
  const P = S.plan;
  if (!P || !P.ops) return null;
  const hechos = new Set((LS.get(K('hechos'), {})[V.claveHechos(P)] || {}).n || []);
  return { ...P, ops: P.ops.filter((o) => !hechos.has(o.n)) };
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
/* «Usar lo guardado»: a los 15 s de la pantalla de carga, si hay una liga guardada, un botón para dejar de esperar y
   abrir esa (revisión total, A7). La carga sigue por detrás hasta su siguiente petición y no pisa nada */
const ESPERA_GUARDADO = 15000;
function botonGuardado(carga) {
  const g = foto();
  const der = $('.carga .carga-der');
  if (!g || !der || S.carga !== carga || !S.cargando || $('#bGuardado')) return;
  der.insertAdjacentHTML('beforeend', `<div class="carga-guardado"><p>LaLiga está tardando mucho en contestar.</p><button class="btn sec" id="bGuardado" data-accion="usarGuardado">Usar lo guardado (${esc(rel(g.t) === 'ahora' ? 'de hace un momento' : `de ${rel(g.t)}`)})</button></div>`);
}
function usarGuardado() {
  const c = S.carga;
  if (!c || c.cancelada || !S.cargando) return;
  c.cancelada = true;
  if (c.alCancelar) c.alCancelar();
}
async function cargar0({ silencio = false } = {}) {
  if (S.cargando) return;
  S.cargando = true;
  const conPantalla = !S.D;
  if (conPantalla) pantallaCarga(0); else if ($('#vista')) pintarSup();
  const carga = nuevaCarga();
  S.carga = carga;
  const cancelar = new Promise((_, mal) => { carga.alCancelar = () => mal(Object.assign(new Error('Has dejado de esperar a LaLiga: lo que ves es lo guardado'), { cancelada: true, tipo: 'lento' })); });
  const quitarBoton = conPantalla ? relojFijo(ESPERA_GUARDADO, () => botonGuardado(carga)) : () => {};
  try {
    // (en cuanto LaLiga contesta, esta web vale para AlDia: si la liga guardada no se pudo abrir, antes esperaba a la
    // carga entera y en un móvil lento pasaba de los 20 s y AlDia la descartaba; 0.7.6)
    const actualizando = actualizar((i) => { if (i > 0) webVivaUnaVez(); if (conPantalla && !carga.cancelada) { pantallaCarga(i); if (Date.now() - carga.t0 >= ESPERA_GUARDADO) botonGuardado(carga); } }, carga);
    actualizando.catch(() => {});
    S.D = await Promise.race([actualizando, cancelar]);
    quitarBoton();
    S.errorCarga = null;
    rehacer();
    if (!enDemo()) contar(S.M && S.M.enJuego ? 'A' : 'a');
    S.cargando = false;
    pintar();
    if ($('#vista')) webVivaUnaVez();
    // la primera vez: el tutorial, que recorre la app para saber dónde está cada cosa
    if (conPantalla) quizaTutorial(900);
    if (S.D.lento) tostada('La conexión va muy lenta: lo que no ha llegado es de la última vez', 6000);
    else if (!silencio && !conPantalla) tostada(V.cambiosDesdePlan(S) ? 'Datos de LaLiga al día. Tu liga ha cambiado: mira el plan' : 'Datos de LaLiga al día');
    despues();
  } catch (e) {
    quitarBoton();
    S.cargando = false;
    if (!e.cancelada) console.error(e);
    if (e.sesion) { S.D = null; pantallaEntrar(e.message); return; }
    // ha entrado con su cuenta pero no le carga la liga: que el dueño lo vea en «Quién usa la app»
    const x = { ...explicarError(e), detalle: e.message || String(e), t: Date.now() };
    // (16 nov, Carlos: «hay uno que pone que no le carga, ¿por qué?») con el motivo: el tipo del error y el principio del
    // mensaje, sin números largos (ids de liga o de cuenta)
    const fc = `${x.tipo || 'otro'}${e.estado ? ` ${e.estado}` : ''}: ${String(x.detalle).replace(/\d{5,}/g, '…')}`.slice(0, 60);
    if (!enDemo() && haySesion() && !document.hidden) { if (LS.get('fc-dicho', '') !== fc) { LS.set('hola-t', 0); LS.set('fc-dicho', fc); } saludar({ v: `${VERSION} !`, canal: enApp ? nativo.canal() : 'web', app: enApp ? nativo.version() : 0, liga: '', equipo: '', fc }); }
    S.errorCarga = x;
    // (las aperturas fallidas, aparte si hay jornada en juego: es cuando las operadoras cortan Cloudflare)
    if (!enDemo() && haySesion()) contar(S.M && S.M.enJuego ? 'F' : 'f');
    // sin poder cargar, pero con la liga guardada de antes: se enseña esa, avisando de que no está al día
    const guardada = conPantalla && x.tipo !== 'sinLigas' ? foto() : null;
    // (si el fallo es del motor, la liga guardada vuelve a fallar al rehacerse: entonces, la pantalla de error, nunca
    // quedarse en la de carga; revisión del 29 oct)
    if (guardada) {
      try { S.D = guardada; rehacer(); pintar(); webVivaUnaVez(); return; } catch (e2) {
        console.error(e2);
        apuntarError(e2.message, `al abrir la liga guardada${e2.stack ? ` · ${String(e2.stack).split('\n')[1] || ''}` : ''}`);
        S.D = null;
      }
    }
    if (conPantalla || !S.D) pantallaCarga(-1, x);
    else { try { pintar(); } catch (e3) { console.error(e3); pantallaCarga(-1, x); } }
  }
}

/** lo que va después de cargar, sin bloquear: las fichas de los jugadores (forma y caras) y el plan con IA */
/** avisa al servidor de que la app está abierta (para la lista «Quién usa la app» del dueño); nada en la de ejemplo */
function saludarSiToca(por = 'cada10') {
  if (!S.D || enDemo() || !haySesion() || document.hidden) return Promise.resolve();
  calDineroSiToca();
  calPujasSiToca();
  comprasSiToca();
  // (26 nov) lo de todas las ligas: si algo de esto falla, que no pase nada (no es de lo que se ve)
  ligasSiToca().catch(() => {});
  try { otrasSiToca(); } catch (e) { /* nada */ }
  const yo = S.M && S.M.yo;
  // el último fallo de AlDia (por qué no se pone la web nueva), para «Quién usa la app»; si es nuevo, sin esperar los 9 min
  const ad = enApp ? String((nativo.estadoWeb() || {}).error || '').slice(0, 90) : '';
  if (ad !== LS.get('aldia-dicho', '')) { LS.set('hola-t', 0); LS.set('aldia-dicho', ad); }
  // si lo último que se dijo es que no le cargaba, que se sepa ya que sí (sin esperar los 9 minutos)
  if (LS.get('fc-dicho', '')) { LS.set('hola-t', 0); LS.del('fc-dicho'); }
  return saludar({ v: VERSION, canal: enApp ? nativo.canal() : 'web', app: enApp ? nativo.version() : 0, liga: S.D.liga && S.D.liga.id, ligas: (S.D.ligas || []).map((l) => l.id).filter(Boolean).slice(0, 10).join(','), equipo: yo ? yo.nombre : '', ad, ...(enApp ? {} : { disp: canalPaso() }), ...(LS.get('nov-dinero', 0) ? { nd: true } : {}) })
    .then((dueno) => { if (dueno && S.tipoHoja && S.tipoHoja[0] === 'ajustes') repintarHoja(); }).catch(() => {})
    .then(() => invitarSiToca())
    // (19 nov) los apodos de los rivales con tu cuenta: los de este dispositivo y los de los otros, juntos
    .then(() => sincronizarApodos(S.D && S.D.liga && S.D.liga.id))
    // (22 nov) y el plan, las preguntas y lo que le has contado
    .then((x) => sincronizar({ ya: true, por: typeof por === 'string' ? por : 'cada10' }).then(() => x, () => x))
    .then((cambia) => { if (cambia && S.tipoHoja && S.tipoHoja[0] === 'ajustes') repintarHoja(); })
    .catch(() => {});
}
/* (19 nov) invita a un amigo (invitar.js): el estado del servidor (como mucho cada 20 min), el código del enlace al entrar en
   tu liga, «¿Te ha invitado alguien?» una vez a una cuenta nueva y el aviso cuando entra un amigo tuyo */
const uidYo = () => (S.D && !S.D.demo && S.D.yo && S.D.yo.userId) || null;
async function invitarSiToca({ ya = false } = {}) {
  const uid = uidYo(), liga = S.D && S.D.liga && S.D.liga.id;
  if (!uid || enDemo() || !haySesion()) return;
  const antes = `${sinIntersticiales()}|${semanaDoble()}|${JSON.stringify((estadoInv(uid) || {}).amigos || [])}`;
  let r;
  try { r = await leerInvitar(uid, { ya, liga }); } catch (e) { return; }
  // (25 nov, tanda 6) en la app de Google Play, el código con el que se instaló (si no se recogió al abrirla)
  if (enApp) leerCodigoPlay();
  const cod = codigoPendiente();
  if (cod && liga && puedeCanjear(uid)) {
    const x = await canjear(uid, cod, liga, viaPendiente());
    if (x.ok && !x.ya) tostada('Has entrado con la invitación de tu amigo', 5000);
  } else if (cod && r.est && r.est.puedeCanjear === false) LS.del('inv-cod');
  // (25 nov, Carlos) solo a quien parece invitado (el servidor le propone un código o alguien de su liga ha sacado el suyo);
  // a los demás, nada: lo tienen en Ajustes
  // (25 nov, 17:46, Carlos: «a los que ya han entrado y les ha ido mal, que les salga») la marca es nueva («inv-preguntado2»):
  // a quien ya vio la ventana de antes (a todos los nuevos, sin pistas) y parece invitado, le sale una vez esta
  else if (!cod && pareceInvitado(uid) && !LS.get('inv-preguntado2', 0) && !S.hoja && !tourAbierto() && !$('#bienvenida') && document.visibilityState !== 'hidden') {
    // (sobre todo para quien la baja de Google Play, a quien no le llega el enlace; Carlos, 19 nov)
    LS.set('inv-preguntado2', Date.now());
    S.inv = { cod: codigoPropuesto(uid), propuesto: codigoPropuesto(uid) };
    hoja('invitado');
  }
  if (r.nuevos > 0) avisoAmigoInv(r.nuevos);
  const despues = `${sinIntersticiales()}|${semanaDoble()}|${JSON.stringify((estadoInv(uid) || {}).amigos || [])}`;
  if (despues !== antes) {
    window.dispatchEvent(new Event('limite-cambia'));
    cerrarTopA();
    if (S.M && !S.hoja) pintar(); else if (S.tipoHoja && ['invitar', 'invitado', 'ajustes'].includes(S.tipoHoja[0])) repintarHoja();
  }
  // (25 nov) la banda de «¿Te ha invitado un amigo?» depende de lo que acaba de decir el servidor
  pintarBanda();
}
/** «Tu amigo ya ha entrado: elige 2 rivales, tienes 24 h» (en la app; con ella cerrada, la notificación) */
function avisoAmigoInv(n) {
  const c = cfgInv();
  const t = n > 1 ? `${n} amigos tuyos han entrado` : 'Tu amigo ya ha entrado';
  const x = `Elige ${c.rivales} rivales${n > 1 ? ' por cada uno' : ''} y mira su dinero: tienes ${c.horas} h`;
  if (enApp && !nativo.aLaVista()) nativo.notificar(t, x, 'hoy');
  else tostada(`${t}: ${x.charAt(0).toLowerCase()}${x.slice(1)}. Está en Ajustes → Invita a un amigo`, 8000);
}
setInterval(saludarSiToca, 10 * 60e3);
/* (0.7.13) lo que falla la cuenta del dinero de los rivales en todas las ligas (de lo que apunta la gente), cada 6 h: si
   ha cambiado, se rehace el análisis para que entre en el dinero de los rivales */
function calDineroSiToca() {
  const antes = calDineroGuardada().cal;
  leerCalDinero().then((cal) => {
    if (!cal || !S.D || (antes && antes.n === cal.n && antes.med === cal.med)) return;
    rehacer(); if (!S.hoja) pintar();
  }).catch(() => {});
}
/* (0.7.13u) lo que se paga por los libres en todas las ligas, cada 6 h: si ha cambiado, se rehace el análisis (las pujas) */
function calPujasSiToca() {
  const antes = calPujasGuardada().cal;
  leerCalPujas().then((cal) => {
    if (!cal || !S.D || (antes && antes.n === cal.n)) return;
    rehacer(); if (!S.hoja) pintar();
  }).catch(() => {});
}
/* (0.7.13u) las compras de tu liga a LaLiga, sin nombres ni ids (lo pagado sobre su valor, su valor, lo que subía y si era de
   los top), para que aprendan las ligas con pocos datos. Una vez al día, solo las que no se han mandado ya, y solo si el
   usuario deja «Ayudar a mejorar la IA» */
async function comprasSiToca() {
  if (enDemo() || !haySesion() || !mejorarIA() || !S.D || !S.M || !S.D.liga) return;
  const hoy = diaDe(), kd = K('pujas-mandadas'), liga = S.D.liga.id;
  const g = LS.get(kd, { dia: '', c: {} });
  if (g.dia === hoy) return;
  // (26 nov) cada compra va ahora con el id del jugador (el de LaLiga, público), para saber lo que se paga por cada uno en
  // todas las ligas. Las mandadas antes iban sin él: se mandan otra vez, una sola vez (`jug`: lo apuntado ya es con jugador),
  // y el servidor las junta con las de entonces por su huella. De más reciente a más antigua, 80 al día
  const ya = { dia: g.dia, c: g.jug ? g.c || {} : {}, jug: 1 };
  const nuevas = (S.M.comprasLiga || []).filter((x) => x.pid && x.t && !ya.c[`${x.pid}|${x.t}`]).sort((a, b) => b.t - a.t).slice(0, 80);
  if (!nuevas.length) { LS.set(kd, g.jug ? { ...ya, dia: hoy } : { ...g, dia: hoy }); return; }
  const c = [];
  for (const x of nuevas) {
    const p = Number(x.pid);
    c.push({ k: await huellaCompra(liga, x.pid, x.t), d: new Date(x.t).toISOString().slice(0, 10), s: Math.round(x.s * 1000) / 1000, v: Math.round(x.v / 1e4) * 1e4,
      r: x.r == null ? null : Math.round(x.r * 1e4) / 1e4, top: !!x.top, ...(Number.isInteger(p) && p > 0 ? { p } : {}) });
  }
  // (sin saber de qué clase es la liga, van como siempre, sin jugador para lo de todas las ligas: no se mezclan clases)
  const tl = OL.tipoLiga(S.D.liga);
  const r = await mandarCompras(c, tl ? await huellaLiga(liga) : '', tl);
  if (!r) return;
  // (un servidor de antes no mira el jugador: se apunta como siempre, sin `jug`, y se mandarán otra vez cuando lo mire.
  // Si mientras tanto se ha cambiado de liga, lo apuntado es de la de antes: `kd` ya lleva su liga)
  const sabe = !!tl && typeof r.jug === 'number', ahora = Date.now();
  const hechas = sabe ? ya.c : { ...(g.c || {}) };
  for (const x of nuevas) hechas[`${x.pid}|${x.t}`] = x.t;
  for (const [k, t] of Object.entries(hechas)) if (ahora - t > 50 * DIA) delete hechas[k];
  LS.set(kd, sabe ? { dia: hoy, c: hechas, jug: 1 } : { dia: hoy, c: hechas });
}
/* (26 nov) lo que solo se ve juntando todas las ligas (otras-ligas.js): los libres del mercado de tu liga con las pujas que
   lleva cada uno y las cláusulas que se abrieron hace más de 24 h (cómo era el jugador y si se lo llevaron), sin liga, sin
   mánager y sin nombres. Como mucho cada media hora y solo si ha cambiado algo; solo con «Ayudar a mejorar la IA» */
let ligasEnMarcha = false;
async function ligasSiToca() {
  if (ligasEnMarcha || enDemo() || !haySesion() || !mejorarIA() || !S.D || !S.M || !S.D.liga || !S.D.t) return;
  const tl = OL.tipoLiga(S.D.liga);
  if (!tl) return;
  const M = S.M, liga = S.D.liga.id, ahora = Date.now(), hoy = diaDe();
  const ke = K('ligas-env'), ka = K('ligas-aperturas');
  // las cláusulas a punto de abrirse (las de todos los equipos, también el tuyo), como están ahora
  const ap = OL.apuntarAperturas(LS.get(ka, {}), OL.fichasDe(M), ahora);
  let reg = ap.reg;
  if (ap.cambia) LS.set(ka, reg);
  const AH = actHist(liga);
  // (lo que valía cada jugador cada día, de lo que guarda la app: por si LaLiga subió sola la cláusula hasta el valor)
  const valorEl = (pid, t) => { let v = null; const d = diaDe(t); for (const [dd, vv] of (S.H && S.H.v && S.H.v[pid]) || []) { if (dd <= d) v = vv; else break; } return v; };
  const res = OL.resolverAperturas(reg, AH.lista, AH.desde, S.D.t, valorEl);
  // (la demanda, solo con la liga recién leída: con la guardada de hace rato las pujas pueden ser ya otras)
  const m = ahora - S.D.t <= OL.FOTO_FRESCA ? OL.demandaDe(M.mercado, ahora) : [], firma = OL.firmaDemanda(m);
  const ya = LS.get(ke, { t: 0, f: '', dia: '', n: 0, mal: 0 });
  if (!OL.tocaMandar(ya, firma, res.listas.length, ahora, hoy)) {
    if (res.quitar.length) { reg = { ...reg }; for (const k of res.quitar) delete reg[k]; LS.set(ka, reg); }
    return;
  }
  ligasEnMarcha = true;
  try {
    const a = [];
    for (const x of res.listas.slice(0, 40)) {
      const e = reg[x.c];
      a.push({ k: await huellaApertura(liga, e.pid, e.base), d: new Date(x.abre).toISOString().slice(0, 10), v: Math.round(x.v / 1e4) * 1e4, cs: Math.round(x.cs * 1000) / 1000,
        r: x.r == null ? null : Math.round(x.r * 1e4) / 1e4, pos: x.pos, tit: x.tit == null ? null : Math.round(x.tit * 100) / 100, ida: x.ida, bl: x.bl });
    }
    const bien = await mandarLigas({ l: await huellaLiga(liga), t: tl, m, a });
    // (las claves llevan la liga de cuando se empezó: si se ha cambiado de liga mientras, no se mezclan)
    const n = (ya.dia === hoy ? Number(ya.n) || 0 : 0) + 1;
    if (!bien) { LS.set(ke, { ...ya, mal: Date.now() }); return; }
    LS.set(ke, { t: Date.now(), f: firma, dia: hoy, n, mal: 0 });
    const queda = { ...LS.get(ka, {}) };
    for (const x of res.listas.slice(0, 40)) delete queda[x.c];
    for (const k of res.quitar) delete queda[k];
    LS.set(ka, queda);
  } finally { ligasEnMarcha = false; }
}
/* (26 nov) lo de las demás ligas para los libres de tu mercado (lo pagado por cada uno en 3 días y su demanda): solo si
   «otrasLigas» de limites.json lo enciende (apagado, ni se pide). Se guarda por liga y se pide otra vez cuando cambian los
   libres o cada 3 h. La ficha del jugador lo lee de `S.otras` */
let otrasEnMarcha = false;
const otrasGuardadas = () => LS.get(K('otras-ligas'), null);
function otrasSiToca() {
  const on = otrasLigasCfg();
  if (!on.pagado && !on.demanda) { if (S.otras) S.otras = null; return; }
  if (otrasEnMarcha || enDemo() || !haySesion() || !S.D || !S.M || !S.D.liga) return;
  const liga = S.D.liga.id, ko = K('otras-ligas'), ahora = Date.now(), tl = OL.tipoLiga(S.D.liga);
  if (!tl) return;
  const ids = OL.idsDe(S.M.mercado, ahora), clave = ids.join(',');
  const ya = otrasGuardadas();
  // (lo de otra liga no vale aquí: lo que se pide no trae lo de tu propia liga, y en otra liga tuya eso cambia)
  if (S.otras && S.otras.liga !== liga) S.otras = null;
  if (ya && ya.liga === liga && !S.otras) S.otras = ya;
  if (!OL.tocaVer(ya, clave, ahora)) return;
  otrasEnMarcha = true;
  return huellaLiga(liga).then((l) => verOtrasLigas(l, tl, ids)).then((r) => {
    const x = { liga, k: clave, t: Date.now(), p: (r && r.p) || {}, d: (r && r.d) || {} };
    LS.set(ko, x);
    if (S.D && S.D.liga && S.D.liga.id === liga) S.otras = x;
  }).catch(() => { LS.set(ko, { ...(ya || { liga, k: '', t: 0, p: {}, d: {} }), mal: Date.now() }); }).finally(() => { otrasEnMarcha = false; });
}
/** (0.7.13) lo apuntado de un rival, sin nombres ni ids, para afinar la cuenta de todos (si el usuario lo deja) */
async function apunteDinero(tid, dicho, cu) {
  if (enDemo() || !haySesion() || !mejorarIA() || !S.D || !S.M || !cu || cu.v == null || dicho.est == null) return;
  const M = S.M, ahora = Date.now();
  const dl = cu.desde ? Math.max(0, (ahora - cu.desde) / DIA) : 0;
  // los días de parón en medio: lo que suman las recompensas por encima de una al día
  const dp = cu.desde && M.recompensas && M.RECOMPENSA ? Math.max(0, M.recompensas(cu.desde, ahora) / M.RECOMPENSA - dl) : 0;
  const eq = (S.D.clasif || []).find((x) => String(x.teamId) === String(tid)) || {};
  const h = await huellaDinero(S.D.liga ? S.D.liga.id : '', tid, diaDe(ahora));
  return mandarDinero({
    h, e: dicho.v - dicho.est, m: cu.margen || 0, r: dicho.r || 0, dl: Math.round(dl), dp: Math.round(dp), mov: cu.n || 0, sub: (cu.cuenta && cu.cuenta.nSubidas) || 0,
    pago: !!(S.D.liga && S.D.liga.premium), val: Math.max(0, Number(eq.valor) || 0), pos: Number(eq.pos) || 0, nr: (S.D.clasif || []).length, est: dicho.est,
  });
}
/* (0.8.4o) apuntar lo que te dijo un rival (la hoja, la ventana «Quién y cuánto» y la tarjeta del chat), con el mismo
   formato de siempre; con su dinero cerrado, el motor no lo recibe (dinero-dicho.js) y la tostada no habla de la cuenta */
function apuntarDichoDe(tid, v, aprox) {
  const cu = S.M && (S.M.dineroCuentaBruta || S.M.dineroCuenta) ? (S.M.dineroCuentaBruta || S.M.dineroCuenta)(tid) : null;
  const todos = DD.dichos();
  todos[tid] = DD.entradaDicho(v, aprox, cu && cu.v != null ? cu.v : null);
  LS.set(K('dinero-dicho'), todos);
  apunteDinero(tid, todos[tid], cu).catch(() => {});
  DD.quitarAvisoRivales();
  rehacer();
  return { d: todos[tid], cu };
}
function tostadaDicho(tid, dc, cu) {
  tostada(!bloqueada('dineroRivales', tid) && cu && cu.v != null ? `Apuntado. La cuenta daba ${eur(cu.v)}: ${eur(dc.v - cu.v, { signo: true })} de diferencia` : 'Apuntado');
}
const modoAprox = (f) => !!(f && f.querySelector('[data-accion="ddModo"][data-m="aprox"][aria-pressed="true"]'));
function notaDichoErr(f, t) { const n = f && f.querySelector('.dd-nota'); if (n) { n.textContent = t; n.classList.add('err'); } }
/** − y +, los atajos y «Esa cifra / Más o menos»: se cambia lo que hay en pantalla, sin repintar (para no perder lo escrito) */
function formDicho(el, d) {
  const f = el.closest('.dd-hoja, #dd-ventana');
  if (!f) return;
  const inp = f.querySelector('.dd-in');
  if (d.accion === 'ddPaso' && inp) { const v = DD.leerCifra(inp.value); inp.value = String(Math.max(0, Math.round((v || 0) / 1e6) + Number(d.n))); }
  if (d.accion === 'ddAtajo' && inp) inp.value = String(d.v);
  if (d.accion === 'ddModo') f.querySelectorAll('[data-accion="ddModo"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === d.m)));
  notaDicho(f);
}
function notaDicho(f) {
  const v = DD.leerCifra((f.querySelector('.dd-in') || {}).value);
  const n = f.querySelector('.dd-nota');
  if (n) { n.textContent = DD.notaModo(v, modoAprox(f)); n.classList.remove('err'); }
  f.querySelectorAll('[data-accion="ddAtajo"]').forEach((b) => b.setAttribute('aria-pressed', String(v === Number(b.dataset.v) * 1e6)));
  const er = f.querySelector('.dd-err'); if (er) er.remove();
}
// el desplegable del rival se cierra al tocar fuera o con Escape
function cerrarListaRival(foco) { const l = $('#ddLista'); if (!l || l.hidden) return false; l.hidden = true; const b = $('#ddRival'); if (b) { b.setAttribute('aria-expanded', 'false'); if (foco) b.focus({ preventScroll: true }); } return true; }
document.addEventListener('click', (ev) => { if (!ev.target.closest || !ev.target.closest('.dd-sel-c')) cerrarListaRival(false); }, true);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && cerrarListaRival(true)) ev.stopPropagation(); }, true);
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (!t || !t.classList || !t.classList.contains('dd-in')) return;
  const limpio = t.value.replace(/[^0-9.,]/g, '');
  if (limpio !== t.value) t.value = limpio;
  const f = t.closest('.dd-hoja, #dd-ventana');
  if (f) notaDicho(f);
});
/** la ventana «Quién y cuánto» (la abre la novedad): en el centro, como las tarjetas de una vez */
function ventanaDinero(st = null) {
  if (!S.D) return;
  S.ddV = st || { sel: '', v: null, aprox: false, err: '', fase: 'pide' };
  let capa = $('#dd-capa');
  if (!capa) {
    capa = document.createElement('div');
    capa.id = 'dd-capa'; capa.className = 'nvt-capa dd-capa';
    capa.innerHTML = '<div class="nvt-velo" data-accion="ddCerrar"></div><div class="nvt dd-ventana" id="dd-ventana" role="dialog" aria-modal="true" aria-labelledby="dd-v-t"></div>';
    document.body.append(capa);
  }
  const v = $('#dd-ventana');
  v.innerHTML = DD.ventanaDineroHTML(S, S.ddV);
  const foco = v.querySelector(S.ddV.fase === 'hecho' ? '.dd-v-pri' : S.ddV.err ? '.dd-err' : 'h2');
  if (foco) { if (!foco.hasAttribute('tabindex')) foco.tabIndex = -1; foco.focus({ preventScroll: true }); }
}
function cerrarVentanaDinero() { const c = $('#dd-capa'); if (c) c.remove(); S.ddV = null; }
/* (0.8.4o; Carlos, 25 nov, 23:51: «que salga un pop up a todos explicando que está la función…») la novedad de apuntar
   el dinero de un rival: UNA vez por cuenta (LS «nov-dinero» y el Worker con /hola nd), a todos (también en la liga de
   ejemplo, para probarla) con algún rival, después del tutorial y con la pantalla libre: ni encima de la bienvenida, del
   tutorial ni de otra tarjeta. Si hoy ya ha salido la de la app para iPhone o la de invitar, mañana; y si sale esta, esas
   esperan a otro día. Con un navegador manejado por un programa, no (las pruebas) */
const novDineroHoy = () => { const t = Number(LS.get('nov-dinero', 0)) || 0; return !!t && new Date(t).toDateString() === new Date().toDateString(); };
const otraHoy = () => { const t = Number(LS.get('tarjeta-inv-t', 0)) || 0; return iphoneHoy() || (!!t && new Date(t).toDateString() === new Date().toDateString()); };
let novDineroEsperando = false;
function novDineroEsperar() {
  if (novDineroEsperando || LS.get('nov-dinero', 0) || navigator.webdriver === true) return;
  novDineroEsperando = true;
  const hasta = Date.now() + 10 * 60e3;
  const mirar = () => {
    if (LS.get('nov-dinero', 0) || Date.now() > hasta) { novDineroEsperando = false; return; }
    if (otraHoy()) { novDineroEsperando = false; return; }
    const libre = S.D && S.M && !S.cargando && !S.hoja && tourVisto() && !tourAbierto() && !document.hidden && !$('#limite') && !$('#forzar') && !$('.carga') && !$('.nv') && !$('.nvt-capa') && !$('.atardecer-intro') && !$('#bienvenida') && !S.bienvenidaPendiente && !iphoneToca();
    if (!libre || !(S.M.rivales || []).length) { setTimeout(mirar, 1500); return; }
    novDineroEsperando = false;
    const capa = document.createElement('div');
    capa.id = 'nvd-capa'; capa.className = 'nvt-capa';
    capa.innerHTML = DD.novedadDineroHTML();
    document.body.append(capa);
    const b = capa.querySelector('.dd-v-pri'); if (b) b.focus({ preventScroll: true });
  };
  // (después del saludo al Worker: si ya la vio en otro dispositivo, el saludo lo dice)
  setTimeout(mirar, 6000);
}
function cerrarNovDinero() {
  const c = $('#nvd-capa'); if (c) c.remove();
  const yo = S.D && S.M && S.M.yo;
  if (enDemo() || !haySesion()) LS.set('nov-dinero', Date.now());
  else apuntarNovDinero({ v: VERSION, canal: enApp ? nativo.canal() : 'web', app: enApp ? nativo.version() : 0, liga: (S.D && S.D.liga && S.D.liga.id) || '', equipo: yo ? yo.nombre : '' });
}
// con la app abierta, las respuestas a tus avisos también llegan sin tocar nada (comprobarAvisos mira como mucho cada 10 min)
if (!EN_FONDO) setInterval(() => { if (!document.hidden && S.D) { comprobarAvisos(); planAHora(); } }, 10 * 60e3 + 5e3);
// con la configuración nueva de limites.json puede cambiar lo que está bloqueado
window.addEventListener('limites-nuevos', () => { if (S.D && S.M && !S.hoja) pintar(); });
// las caras y los escudos de la liga de ejemplo llegan de LaLiga después de abrirla (la primera vez o pasados 3 días)
window.addEventListener('fm-caras', (e) => {
  ponerCarasPortada(e.detail);
  if (!S.D || !S.D.demo || S.cargando || !ponerCarasDemo(S.D, e.detail)) return;
  LS.set(K('datos'), S.D);
  rehacer();
  if (S.hoja) repintarHoja(); else if ($('#vista')) pintar();
});
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
    const antes = S.vivo && S.vivo.n === S.M.enJuego.n ? S.vivo : null;
    S.vivo = { ...(await enVivo(S.D, S.M.enJuego.n, yoTid)), liga: S.D.liga && S.D.liga.id };
    LS.set(K('vivo'), S.vivo);
    // los puntos nuevos, sin rehacer todas las cuentas
    if (S.M.ponerVivo) S.M.ponerVivo(S.vivo);
    vigilarClausulables(antes).catch((e) => console.warn('clausulables en directo', e));
    return true;
  } catch (e) { console.warn('en directo', e); return false; } finally { cargandoVivo = false; S.cargandoVivo = false; }
}
/**
 * con la jornada en juego: si el jugador de un rival que te conviene clausular (cláusula abierta o a punto, te llega con
 * tu saldo, te interesa y no paga de más) marca o da una asistencia, te avisa al momento: tras un partido así LaLiga
 * suele subirle el valor y la cláusula con él (lo pidió Domy el 25 oct). Se mira con cada puesta al día del directo (cada
 * 2 minutos con la app abierta): un salto de 3 puntos o más, o 6 o más si es la primera vez que se mira, y entonces su
 * ficha dice si ha sido gol o asistencia. Un aviso por gol o asistencia nuevos, por jornada
 */
async function vigilarClausulables(antes) {
  const V = S.vivo, M = S.M;
  if (!V || !M || !M.enJuego || V.n !== M.enJuego.n || enDemo() || !haySesion()) return;
  const sano = (j) => !['injured', 'suspended', 'out_of_league'].includes(j.estado);
  const cand = M.clausulas.filter((x) => x.meLlega && (x.abierta || x.abreEn < 12 * 60 * MIN) && x.interes >= 50 && sano(x.j)
    && M.sobrecoste(x.j, x.clausula, x.tend).indice <= M.tolerancia(x.j) - 30 && M.compraCal(x.j, x.clausula).ok && (!M.conSalida || M.conSalida(x.j, x.clausula, x.tend)));
  const vistos = LS.get(K('vivo-avisados'), {});
  // (21 nov, Carlos: «si un jugador hace muchísimos puntos… y tiene justo la cláusula abierta, que te salga clausúlalo
  // ya») el que acaba de hacer 8 puntos o más, con su partido ya acabado, la cláusula abierta y que te llega: los días
  // siguientes sube bastante más de lo que dice la inercia (medido con su liga, `efectoTras`). Si lo que se espera que
  // valga en 3 días pasa su cláusula, te avisa (una vez por jornada); con 25 jugadores no, que no se puede clausular
  if ((M.mias || []).length < 25) {
    const acabado = (j) => { const p = (S.D.partidos || []).find((q) => q.jornada === V.n && (q.localId === j.equipoId || q.visitanteId === j.equipoId)); return !!(p && p.fecha && p.fecha + 2 * HORA <= Date.now()); };
    for (const x of M.clausulas || []) {
      const pts = V.puntos[x.pid];
      if (pts == null || pts < 8 || !x.meLlega || !x.abierta || !sano(x.j) || !x.j.valor || !acabado(x.j)) continue;
      const p0 = vistos[x.pid] && vistos[x.pid].n === V.n ? vistos[x.pid] : { n: V.n, g: 0, as: 0 };
      if (p0.pz) continue;
      const t = M.tend(x.pid) || {}, sub = (t.sub || []).slice(-3), ine = M.inercia(x.pid);
      const e = efectoTras(pts, comoVenia(sub.reduce((a, r) => a * (1 + r), 1) - 1), x.j.valor);
      // (si el motor ya lo ha rehecho con sus puntos, la inercia ya lo lleva dentro)
      const en3 = x.j.valor + (ine && ine.partido ? ine.proy3 : x.j.valor * e.e3 + Math.max(0, ine ? ine.proy3 : 0));
      if (e.e3 < 0.03 || x.clausula > en3) continue;
      vistos[x.pid] = { ...p0, pz: pts };
      const tit = `${x.j.nombre}: ${pts} puntos y su cláusula abierta`;
      const cuerpo = `Es de ${x.rival.manager || x.rival.nombre}. Tras un partido así, los de su precio suben de media un ${String(Math.round(e.e3 * 1000) / 10).replace('.', ',')} % en 3 días: en 3 días valdría unos ${eur(en3)} y su cláusula es ${eur(x.clausula)}. Te llega: te quedarías con ${eur(x.teQueda)}. Si lo quieres, clausúlalo ya.`;
      if (nativo.aLaVista()) tostada(`⚡ ${tit}. ${cuerpo}`, 12000);
      else nativo.notificar(`⚡ ${tit}`, cuerpo, 'rivales');
      apuntarRegistro({ ruta: `aviso en directo: ${x.j.nombre} ${pts} pts con la cláusula abierta`, s: 200, ms: 0 });
    }
  }
  if (!cand.length) { LS.set(K('vivo-avisados'), vistos); return; }
  const ya = (pid) => (vistos[pid] && vistos[pid].n === V.n ? vistos[pid] : { n: V.n, g: 0, as: 0 });
  const mirar = cand.filter((x) => {
    const b = V.puntos[x.pid], a = antes && antes.puntos ? antes.puntos[x.pid] : null;
    if (b == null) return false;
    return a != null ? b - a >= 3 : !vistos[x.pid] || vistos[x.pid].n !== V.n ? b >= 6 : false;
  }).slice(0, 4);
  for (const x of mirar) {
    let h = null;
    try { h = hechosSemana(await api.jugador(x.pid, S.D.liga.id), V.n); } catch (e) { if (e.sesion) return; }
    if (!h) continue;
    const g = h.ev.gol ? h.ev.gol[0] : 0, as = h.ev.asis ? h.ev.asis[0] : 0, p0 = ya(x.pid);
    vistos[x.pid] = { ...p0, n: V.n, g: Math.max(g, p0.g), as: Math.max(as, p0.as) };
    if (g <= p0.g && as <= p0.as) continue;
    const que = g > p0.g ? (g - p0.g > 1 ? `ha marcado ${g - p0.g} goles` : 'ha marcado') : as - p0.as > 1 ? `ha dado ${as - p0.as} asistencias` : 'ha dado una asistencia';
    const pts = V.puntos[x.pid];
    const tit = `${x.j.nombre} ${que} (${pts} pts)`;
    const cuerpo = `Es de ${x.rival.manager || x.rival.nombre} y su cláusula, ${eur(x.clausula)} (vale ${eur(x.j.valor)}), ${x.abierta ? 'está abierta' : `se abre ${cuandoT(x.protegidoHasta)}`} y te llega: te quedarías con ${eur(x.teQueda)}. Tras un partido así suele subir de valor${x.abierta ? ': si lo quieres, es el momento' : ''}.`;
    if (nativo.aLaVista()) tostada(`⚡ ${tit}. ${cuerpo}`, 12000);
    else nativo.notificar(`⚡ ${tit}`, cuerpo, 'rivales');
    apuntarRegistro({ ruta: `aviso en directo: ${x.j.nombre} ${que}`, s: 200, ms: 0 });
  }
  LS.set(K('vivo-avisados'), vistos);
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
  cargarHechos(n, ps);
  const g = S.jugadas[id];
  if (g && (Dr.estadoP(ps).cls === 'fin' ? true : Date.now() - g.t < MIN)) return;
  const r = await jugadasSofa(S.D, p);
  if (r) { S.jugadas[id] = r; if (S.tipoHoja && S.tipoHoja[0] === 'p' && S.tipoHoja[1] === `${n}:${id}`) repintarHoja(); }
}
/**
 * lo que ha hecho cada uno en un partido empezado (minutos, goles, asistencias, tarjetas, penaltis…): de la ficha de cada
 * jugador que ya ha sumado o restado puntos, porque las estadísticas de la jornada no lo dicen. En juego, como mucho cada
 * 2 minutos; acabado, una vez (lo pidió Domy el 25 oct: los eventos del partido y quién ha salido de titular)
 */
async function cargarHechos(n, p) {
  if (!S.D || !p || !p.id || enDemo() || !haySesion()) return;
  S.hechos ||= {};
  const k = `${n}:${p.id}`, g = S.hechos[k];
  const fin = Dr.estadoP(p).cls === 'fin';
  if (g && (g.cargando || (fin && g.fin && Date.now() - g.t < 6 * 3600e3) || Date.now() - g.t < 2 * MIN - 10e3)) return;
  // los que ya puntúan y el once probable de los dos (en directo, a los titulares sin jugadas aún no les suma nadie
  // y sin su ficha no se sabría quién ha salido: aviso de Domy, 25 oct). Primero los que puntúan
  const ids = [...new Set([...p.jug.filter((x) => x.id && x.pts != null && x.pts !== 0 && S.D.maestro[x.id] && S.D.maestro[x.id].pos <= 4).map((x) => String(x.id)), ...(Dr.idsProbables ? Dr.idsProbables(S, p) : [])])].slice(0, 48);
  if (!ids.length) return;
  S.hechos[k] = { ...(g || { porJug: {} }), cargando: true };
  const porJug = { ...((g && g.porJug) || {}) };
  await enParalelo(ids, 4, async (pid) => {
    try {
      const r = await api.jugador(pid, S.D.liga.id), h = hechosSemana(r, n);
      if (h) porJug[pid] = h;
      // (una muestra de lo que trae, para el diagnóstico: con minutos o sin ellos, partido en juego o acabado)
      guardarMuestraVivo(`ficha de jugador, partido ${fin ? 'acabado' : 'en juego'}, ${h && h.min != null ? 'con minutos' : 'sin minutos'}`, muestraSemana(r, n));
    } catch (e) { if (e.sesion) throw e; }
  });
  S.hechos[k] = { t: Date.now(), fin, porJug, cargando: false };
  if (S.tipoHoja && S.tipoHoja[0] === 'p' && S.tipoHoja[1] === k) repintarHoja();
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
        if (est === 'proxima') apuntarMiOnce(ids);
        if (ids.length < 5 && est === 'vivo' && S.M.vivo && S.M.vivo.once) { ids = S.M.vivo.once; forma = S.M.vivo.forma || null; }
      }
      S.misJ[n] = { ids: ids && ids.length ? ids : null, forma, t: Date.now(), acabada: est === 'acabada' };
    }
    if (faltanPts) {
      try {
        S.ptsJ[n] = ptsDeClasif(await api.clasifSemana(S.D.liga.id, n));
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
  // (lo que falló se queda vacío en memoria para no pedirlo en bucle, pero no se guarda: si no, no se volvía a pedir nunca)
  guardarPtsJ();
  if (S.vista === 'equipo' && S.seg.equipo === 'jornadas' && !S.hoja) pintar();
}
/** los puntos de cada equipo en una jornada, de /leagues/{liga}/standing/{n}: { teamId: pts } */
function ptsDeClasif(r) {
  const m = {};
  for (const it of listaN(r)) {
    const t = (it && it.team) || {};
    const id = it.teamId != null ? it.teamId : t.id != null ? t.id : it.id;
    const v = it.points != null ? it.points : it.weekPoints != null ? it.weekPoints : t.weekPoints;
    if (id != null && v != null && Number.isFinite(Number(v))) m[String(id)] = Number(v);
  }
  return m;
}
/* se guardan los de las jornadas acabadas (no cambian); lo vacío no, para volver a pedirlo otro día */
function guardarPtsJ() {
  const hechas = new Set(jornadasAcabadas(S.M, S.D));
  const acabada = (k) => hechas.has(k);
  LS.set(K('pts-jornadas'), Object.fromEntries(Object.entries(S.ptsJ || {}).filter(([k, v]) => acabada(Number(k)) && v && Object.keys(v).length)));
}
/**
 * Rivales → Por jornada: los puntos de cada equipo en todas las jornadas acabadas (de 3 en 3; las que ya están
 * guardadas no se piden; lo que falla, como mucho cada 3 minutos)
 */
async function cargarPtsJornadas() {
  if (!S.D || !S.M || S.cargandoPtsJ || enDemo() || !haySesion()) return;
  const deGuardado = !S.ptsJ;
  S.ptsJ ||= LS.get(K('pts-jornadas'), {});
  S.ptsJT ||= {};
  const ahora = Date.now();
  // (24 nov) todas las acabadas, de la 1 a la última (el calendario que se baja solo trae de la pasada en adelante)
  const faltan = jornadasAcabadas(S.M, S.D).filter((n) => !S.ptsJ[n] && ahora - (S.ptsJT[n] || 0) > 3 * MIN);
  // (si ya estaban todas guardadas, se repinta una vez con ellas)
  const repintar = () => { if (S.hoja) return; if (S.vista === 'directo') pintarVivo({ forzar: true }); else if (S.vista === 'rivales') pintar(); };
  if (!faltan.length) { if (deGuardado) repintar(); return; }
  S.cargandoPtsJ = true;
  try {
    for (let i = 0; i < faltan.length; i += 3) {
      await Promise.all(faltan.slice(i, i + 3).map(async (n) => {
        S.ptsJT[n] = Date.now();
        try { S.ptsJ[n] = ptsDeClasif(await api.clasifSemana(S.D.liga.id, n)); } catch (e) { if (e.sesion) throw e; }
      }));
    }
  } catch (e) { /* la sesión ha caducado: se pide al volver a entrar */ }
  S.cargandoPtsJ = false;
  guardarPtsJ();
  repintar();
}
/** el once de un mánager en una jornada acabada (no cambia: se guarda; lo que falla, otra vez a los 3 minutos) */
async function cargarOnceJornada(tid, n) {
  const k = `${tid}:${n}`;
  S.oncesJ ||= enDemo() ? {} : LS.get(K('onces-j'), {});
  const g = S.oncesJ[k];
  if (g && (g.ids || Date.now() - g.t < 3 * MIN)) return;
  if (enDemo()) {
    // (la liga de ejemplo no tiene onces de otras jornadas: el mejor once de su plantilla)
    const js = (S.M.plantillaDe ? S.M.plantillaDe(tid) : Object.keys(S.M.dueno || {}).filter((pid) => String(S.M.dueno[pid]) === tid).map((pid) => S.M.J(pid))).filter(Boolean);
    const o = js.length ? S.M.mejorOnce(js) : null;
    S.oncesJ[k] = { ids: o ? [...o.lineas.flat().map((j) => j.id), ...(o.entrenador ? [o.entrenador.id] : [])] : null, t: Date.now() };
  } else if (haySesion()) {
    try {
      const r = await api.onceSemana(tid, n);
      const ids = idsOnce(r);
      S.oncesJ[k] = { ids: ids.length >= 5 ? ids : null, forma: formaOnce(r), t: Date.now() };
    } catch (e) {
      if (e.sesion) return;
      S.oncesJ[k] = { ids: null, error: e.message, t: Date.now() };
    }
    LS.set(K('onces-j'), Object.fromEntries(Object.entries(S.oncesJ).filter(([, v]) => v.ids).slice(-160)));
  } else return;
  if (S.tipoHoja && S.tipoHoja[0] === 'oj' && S.tipoHoja[1] === k) repintarHoja();
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
  if (EN_FONDO || Date.now() - webMiradaT < 5 * MIN) return;
  webMiradaT = Date.now();
  if (enApp) return mirarAppNueva();
  try {
    const r = await fetch(`paquete.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.version && cmpVer(j.version, VERSION) > 0) {
      const antes = S.webNuevaWeb; S.webNuevaWeb = j;
      if (!nuevaSola(j.version, 'web')) forzarWebNueva(j);
      if (!antes && S.D && !S.hoja && !aMedias()) pintar();
    }
  } catch (e) { /* sin red: ya se mirará */ }
}
/*
 * (0.8.4r, 26 nov; Carlos: «¿por qué cada vez que publico una versión sale un aviso para que la actualice? ¿No se podría
 * hacer de forma automática?») La versión nueva se pone sola, sin ventana: en la web, recargarWeb; en la app (Play e iOS),
 * AlDia la baja (nativo.buscarWeb) y la página se recarga con ella. Solo si no tiene nada a medias (`aMedias`); si lo
 * tiene, espera a que acabe (se mira cada 10 s) o a que la app se vaya a segundo plano (entonces vale con lo que no se
 * pierde: una ficha abierta, una novedad…). La ventana de siempre queda de reserva: tras 2 intentos que no han cambiado
 * la versión (LS «nueva-sola», n), si AlDia falla o si lleva ESPERA_SOLA esperando. Lo que se ve (pestaña, ficha,
 * scroll) vuelve tras recargar (`guardarVuelta`, `volverTrasRecarga`)
 */
const ESPERA_SOLA = 3 * HORA;
// lo que no se recarga ni con la app en segundo plano (se perdería algo o se cortaría a medias)
const MEDIAS_FUERTES = new Set(['cargando', 'pregunta', 'plan', 'fotos', 'anuncio', 'escribiendo', 'apuntando', 'entrando', 'tutorial']);
let aperturaT = 0;
const interEnCurso = () => { try { return !!estadoIntersticial().enCurso; } catch (e) { return false; } };
window.addEventListener('apertura-vista', () => { aperturaT = 0; });
function regNueva(v) {
  const g = LS.get('nueva-sola', null);
  if (g && g.v === v) return g;
  const n = { v, n: 0 };
  LS.set('nueva-sola', n);
  return n;
}
/** qué tiene a medias el usuario ('' si nada): lo que se perdería o se cortaría al recargar */
function aMedias() {
  if ($('#limite')) return '';
  // (al arrancar, antes de pintar nada, no hay nada que perder: es el mejor momento)
  if (S.cargando && S.D) return 'cargando';
  if (/[?&]code=/.test(location.search)) return 'entrando';
  if (S.charlando || S.chatCtl || preguntaPendiente()) return 'pregunta';
  if (S.planEstado && S.planEstado.cargando) return 'plan';
  if (S.preparandoFotos) return 'fotos';
  if (S.anuncio || interEnCurso() || (aperturaT && Date.now() - aperturaT < 45000)) return 'anuncio';
  if (tourAbierto() || document.body.classList.contains('en-tour')) return 'tutorial';
  // en la pantalla de entrar, recién abierta no hay nada que perder; después puede estar a mitad de la entrada
  if (!S.D && !haySesion() && !enDemo() && Date.now() - arranqueT > 20000) return 'entrando';
  const campos = [...document.querySelectorAll('textarea, input:not([type]), input[type="text"], input[type="number"], input[type="search"], input[type="email"], input[type="url"]')];
  if (campos.some((e) => e.value && e.value.trim() && !e.closest('#forzar'))) return 'escribiendo';
  // una hoja o ventana para apuntar algo (lo que te dijo un rival, una oferta, una puja…), aunque aún no haya escrito
  const formas = [S.hoja, ...document.querySelectorAll('.hoja, [role="dialog"]')].filter(Boolean);
  if (formas.some((h) => h.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="search"]), textarea, select'))) return 'apuntando';
  const a = document.activeElement;
  if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return 'foco';
  if ($('.nvt-capa') || $('.nv') || $('#bienvenida') || document.body.classList.contains('con-nv')) return 'novedad';
  if (S.hoja || $('.visor') || [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].some((d) => d.id !== 'forzar')) return 'ventana';
  return '';
}
/** con versión nueva: ¿se pone sola? (false: la ventana de siempre) */
function nuevaSola(v, modo) {
  if (EN_FONDO) return true;
  const g = regNueva(v);
  if ($('#forzar') || g.n >= 2) return false;
  // (lo que lleva esperando cuenta con la app abierta: si se cierra a medias, al abrirla otra vez se prueba de nuevo)
  if (!S.sola || S.sola.v !== v) S.sola = { v, modo, fase: 'espera', t0: Date.now() };
  intentarSola();
  return true;
}
function ventanaSola() {
  const s = S.sola;
  S.sola = null;
  clearTimeout(forzarT);
  if (!s) return;
  if (s.modo === 'web') forzarWebNueva(S.webNuevaWeb);
  else if (S.appNueva) forzarAppNueva('pide');
}
function intentarSola(oculta = false) {
  const s = S.sola;
  // (al irse de la página para recargar, el navegador también avisa de que se oculta: eso no es otro intento)
  if (!s || EN_FONDO || s.fase === 'bajando' || s.fase === 'recargando') return;
  const m = aMedias();
  if (m && (!oculta || MEDIAS_FUERTES.has(m))) {
    s.espera = m;
    if (Date.now() - s.t0 > ESPERA_SOLA) ventanaSola();
    return;
  }
  // en la app con la web nueva ya bajada, basta con recargar
  if (s.modo === 'app' && S.webNueva) { s.fase = 'recargando'; ponerWebNueva(); return; }
  const g = regNueva(s.v);
  g.n++; g.t = Date.now();
  LS.set('nueva-sola', g);
  if (!oculta) tostada('Poniendo la versión nueva…', 4000);
  guardarVuelta();
  if (s.modo === 'web') { s.fase = 'recargando'; recargarWeb(); return; }
  s.fase = 'bajando';
  if (!nativo.buscarWeb()) { s.fase = 'espera'; ventanaSola(); if (S.appNueva) forzarAppNueva('fallo', 'esta app no sabe descargarla sola'); return; }
  // si AlDia no contesta en un minuto, la ventana con «Volver a intentarlo»
  clearTimeout(forzarT);
  forzarT = setTimeout(() => { if (S.sola && S.sola.fase === 'bajando') { S.sola = null; forzarAppNueva('fallo', 'no ha contestado'); } }, 60000);
}
/* lo que se ve, para dejarlo igual tras recargar con la versión nueva (la pestaña también va en la dirección, #hoy…) */
const FICHAS_VUELTA = new Set(['j', 'r', 'c', 'p']);
function guardarVuelta() {
  const th = S.tipoHoja && FICHAS_VUELTA.has(S.tipoHoja[0]) && (typeof S.tipoHoja[1] === 'string' || typeof S.tipoHoja[1] === 'number') ? S.tipoHoja : null;
  LS.set('tras-recarga', { t: Date.now(), vista: S.vista, seg: S.seg || {}, hoja: th, y: Math.round(window.scrollY || 0) });
}
function leerVuelta() {
  const g = LS.get('tras-recarga', null);
  if (!g) return;
  LS.del('tras-recarga');
  if (Date.now() - g.t > 10 * MIN) return;
  if (g.vista && VISTAS[g.vista]) { S.vista = g.vista; try { history.replaceState(null, '', location.pathname + location.search + '#' + g.vista); } catch (e) { /* nada */ } }
  if (g.seg && typeof g.seg === 'object') S.seg = { ...g.seg, ...S.seg };
  S.vuelta = g;
}
function volverTrasRecarga() {
  const g = S.vuelta;
  S.vuelta = null;
  if (!g || !S.D || !S.M || tourAbierto()) return;
  if (g.y) requestAnimationFrame(() => window.scrollTo(0, g.y));
  if (g.hoja && !S.hoja) { try { hoja(g.hoja[0], g.hoja[1]); } catch (e) { /* la ficha ya no está (otro día, otra liga) */ } }
}
/* Con versión nueva en la web, una ventana en mitad de la pantalla que no se puede cerrar: «Actualizar ahora» y
   nada más (lo pidió Carlos el 25 oct: con solo la banda, Domy se quedaba en una vieja). Si tras dos intentos sigue en
   la vieja (la caché del iPhone), le dice que la cierre del todo */
function forzarWebNueva(j) {
  if (enApp || !j || document.getElementById('forzar')) return;
  let intentos = 0;
  try { intentos = Number(sessionStorage.getItem('fm-forzar-' + j.version)) || 0; } catch (e) { /* sin almacenamiento */ }
  intentos = Math.max(intentos, regNueva(j.version).n);
  const d = document.createElement('div');
  d.id = 'forzar'; d.className = 'forzar'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'forzar-t');
  d.innerHTML = `<div class="forzar-c"><span class="forzar-ic">${icono('refrescar')}</span><h2 id="forzar-t">Hay una versión nueva</h2>
    <p>Ya está la <b>${esc(j.version)}</b> y tú tienes la ${esc(VERSION)}. Actualiza para seguir: es un momento y no pierdes nada.</p>
    ${intentos >= 2 ? '<p class="t2 peq">Si vuelve a salir esto, cierra la web del todo (en el iPhone, desliza hacia arriba y quítala de las apps abiertas) y vuelve a abrirla.</p>' : ''}
    <button class="btn ancho" data-accion="recargarWeb">Actualizar ahora</button></div>`;
  document.body.appendChild(d);
  d.querySelector('button').focus();
}
async function recargarWeb() {
  const j = S.webNuevaWeb;
  if (!S.sola) tostada('Poniendo la versión nueva…', 4000);
  LS.set('web-puesta', { t: Date.now() });
  // primero la página tal como se abrió (puede ser la carpeta, «/», y no «index.html»: el navegador las guarda aparte);
  // index.html ya pide cada módulo con su huella (paquete.py), así que con ella nueva llega todo lo demás nuevo
  const pagina = location.href.split('#')[0];
  await Promise.all([pagina, 'index.html'].map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
  const fs = j && j.archivos ? Object.keys(j.archivos).filter((k) => /\.(js|css|json)$/.test(k)) : [];
  await enParalelo(fs, 6, (k) => fetch(k, { cache: 'reload' }).catch(() => null));
  // con una dirección nueva (?v=), el navegador no puede tirar de la página guardada; al arrancar se quita (limpiarV)
  try { const k = 'fm-forzar-' + ((j && j.version) || ''); sessionStorage.setItem(k, String((Number(sessionStorage.getItem(k)) || 0) + 1)); } catch (e) { /* sin almacenamiento */ }
  if (j && j.version) location.replace(`${location.pathname}?v=${encodeURIComponent(j.version)}${location.hash}`);
  else location.reload();
}
/* En la app, lo mismo desde la 0.7.6 (Carlos, 11 nov: «debería obligar a actualizar cada actualización; si no, no te
   debería dejar jugar»; dos de fuera de la liga seguían en la 0.7.1e y la 0.7.1f porque AlDia no les ponía la nueva y
   nadie se enteraba). Se mira el paquete.json publicado, el mismo que baja AlDia: si es más nuevo que esta web, la
   ventana que no se cierra. Con la misma parte Android, «Actualizar ahora» la baja con AlDia y recarga; si AlDia no
   puede (ya la descartó una vez, falla la descarga…) o hace falta la parte Android nueva, «Descargar la app», que se
   instala encima sin perder nada. En la de Google Play no se obliga a la parte Android nueva: la da la tienda cuando
   Google la revisa, y hasta entonces no hay nada que poner. Desde la 0.7.13j (Carlos, 16 nov: «no quiero que se descargue
   de ningún lado que no sea esa») la app solo se descarga de Google Play: el APK de GitHub ya no baja nada, ve el aviso
   de pasarse a Google Play (avisoPlay) y, donde antes decía «Descargar la app», sale «Ir a Google Play» */
async function paquetePublicado() {
  // (solo del dominio: el puente del móvil no deja pedir a otros sitios, y es de donde lo baja AlDia)
  for (const u of ['https://fantasymanagerapp.com/paquete.json']) {
    try {
      const r = await http('GET', `${u}?t=${Date.now()}`, { tiempo: 15000 });
      if (r.s !== 200) continue;
      const j = JSON.parse(r.b);
      if (j && j.version) return j;
    } catch (e) { /* el siguiente */ }
  }
  return null;
}
/* La ventana del paso a Google Play en el APK de GitHub (Carlos, 14 nov). Antes del cierre, una vez al día (y desde la
   banda), con «Ahora no»; después, sin cerrar. Devuelve si la app ya está cerrada (entonces no se pide versión nueva:
   el APK de GitHub ya no se publica) */
function avisoPlay(forzado = false) {
  if (!enApkGithub()) return false;
  const c = cierreApk();
  if (!c.cerrada && !forzado) { const g = LS.get('aviso-play', null); if (g && g.dia === diaDe()) return false; }
  if (!c.cerrada) LS.set('aviso-play', { dia: diaDe() });
  let d = document.getElementById('aviso-play');
  if (!d) {
    d = document.createElement('div');
    d.id = 'aviso-play'; d.className = 'forzar'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'aviso-play-t');
    document.body.appendChild(d);
  }
  const cuando = c.hasta ? `el ${fechaLarga(c.hasta)}` : '';
  const pasos = 'Primero desinstala esta (la de Google Play no se puede instalar encima) y luego descárgala de la tienda. Tendrás que volver a entrar con tu cuenta de LaLiga.';
  const txt = c.cerrada
    ? `<p>Esta versión de la app ya no funciona. Para seguir usando Fantasy Manager, instálala desde Google Play.</p><p>${pasos}</p>`
    : `<p>Esta versión de la app ya no se va a actualizar más${cuando ? ` y dejará de funcionar ${cuando}` : ''}. Para seguir usándola, instálala desde Google Play.</p><p>${pasos}</p>`;
  d.innerHTML = `<div class="forzar-c"><span class="forzar-ic">${icono('descargar')}</span><h2 id="aviso-play-t">Fantasy Manager ya está en Google Play</h2>${txt}<p><b>¡Muchas gracias por probar Fantasy Manager desde tan pronto!</b></p><div class="forzar-b"><button class="btn ancho" data-abrir="${PLAY_URL}">Ir a Google Play</button>${c.cerrada ? '' : '<button class="btn ancho sec" data-accion="cerrarAvisoPlay">Ahora no</button>'}</div></div>`;
  const b = d.querySelector('button');
  if (b) b.focus();
  return c.cerrada;
}
async function mirarAppNueva() {
  if (avisoPlay()) return;
  const j = await paquetePublicado();
  if (!j || cmpVer(j.version, VERSION) <= 0) return;
  const mia = nativo.huellaNativa();
  // (25 nov) la app de iOS tiene su propia huella nativa en el paquete («nativoIos»); la de siempre es la de Android. Si el
  // paquete publicado aún no la trae, o es otra, la web nueva no es para esta app: la app nueva llega por la App Store
  const ios = nativo.canal() === 'ios';
  const apk = ios ? j.nativoIos !== mia : !!(mia && j.nativo && j.nativo !== mia);
  // (iOS 3) en la app de iOS, como en la de Google Play: la tienda la actualiza; aquí solo se pone la web nueva
  const play = nativo.canal() === 'play' || ios;
  // con la parte Android nueva no hay nada que poner: en Google Play la da la tienda y el APK de GitHub ya no se publica
  // (0.7.13j: solo el aviso de pasarse a Google Play, nunca una descarga de fuera)
  if (apk) return;
  S.appNueva = { version: j.version, apk, play };
  // (0.8.4r) se pone sola; la ventana, solo de reserva
  if (!$('#forzar') && nuevaSola(j.version, 'app')) return;
  forzarAppNueva(apk ? 'apk' : 'pide');
}
/* paso: 'pide' (Actualizar ahora), 'bajando', 'apk' (hace falta descargar la app) o 'fallo' (AlDia no ha podido) */
let forzarT = 0;
function forzarAppNueva(paso, detalle = '') {
  const A = S.appNueva;
  if (!A) return;
  let d = document.getElementById('forzar');
  if (!d) {
    d = document.createElement('div');
    d.id = 'forzar'; d.className = 'forzar'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'forzar-t');
    document.body.appendChild(d);
  }
  A.paso = paso;
  clearTimeout(forzarT);
  const bajar = `<button class="btn ancho" data-abrir="${PLAY_URL}">Ir a Google Play</button>`;
  const otra = (prim) => `<button class="btn ancho${prim ? '' : ' sec'}" data-accion="ponerAppNueva">${paso === 'fallo' ? 'Volver a intentarlo' : 'Actualizar ahora'}</button>`;
  let txt, botones;
  if (paso === 'apk') {
    txt = `Ya está la <b>${esc(A.version)}</b> y tú tienes la ${esc(VERSION)}. Esta trae cambios en la parte del móvil: se instala desde Google Play.`;
    botones = bajar;
  } else if (paso === 'bajando') {
    txt = `Descargando la <b>${esc(A.version)}</b>… En cuanto esté, la app se abre sola con ella.`;
    botones = '<button class="btn ancho" disabled>Descargando…</button>';
    // si AlDia no contesta en un minuto, que se pueda hacer otra cosa
    forzarT = setTimeout(() => { if (S.appNueva && S.appNueva.paso === 'bajando') forzarAppNueva('fallo', 'no ha contestado'); }, 60000);
  } else if (paso === 'fallo') {
    txt = A.play
      ? `No se ha podido poner sola la <b>${esc(A.version)}</b>${detalle ? ` (${esc(detalle)})` : ''}. Prueba otra vez en un rato y, si sigue, actualiza la app desde ${nativo.canal() === 'ios' ? 'la App Store' : 'Google Play'}.`
      : `No se ha podido poner sola la <b>${esc(A.version)}</b>${detalle ? ` (${esc(detalle)})` : ''}. Instala la app desde Google Play.`;
    botones = A.play ? otra(true) : bajar + otra(false);
  } else {
    txt = `Ya está la <b>${esc(A.version)}</b> y tú tienes la ${esc(VERSION)}. Actualiza para seguir: es un momento y no pierdes nada.`;
    botones = otra(true);
  }
  d.innerHTML = `<div class="forzar-c"><span class="forzar-ic">${icono(paso === 'apk' || (paso === 'fallo' && !A.play) ? 'descargar' : 'refrescar')}</span><h2 id="forzar-t">Hay una versión nueva</h2><p>${txt}</p><div class="forzar-b">${botones}</div></div>`;
  const b = d.querySelector('button:not([disabled])');
  if (b) b.focus();
}
function ponerAppNueva() {
  S.sola = null;
  // ya bajada antes (no se pudo recargar en su momento): basta con recargar
  if (S.webNueva) { ponerWebNueva(); return; }
  forzarAppNueva('bajando');
  if (!nativo.buscarWeb()) forzarAppNueva('fallo', 'esta app no sabe descargarla sola');
}
// la ?v= que deja recargarWeb, fuera de la barra de direcciones
(function limpiarV() { try { if (/[?&]v=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* nada */ } })();
/** las fotos de los rivales que también usan la app (0.6.9a): LaLiga solo le da a cada uno la suya; el Worker la guarda
    cuando saluda (la lee él de LaLiga) y se la da a los de su liga. Cada 6 horas, o cada 20 minutos mientras no haya
    ninguna (alguien de la liga puede empezar a usarla) */
let carasPidiendo = false;
async function cargarCaras() {
  const D = S.D;
  if (!D || D.demo || enDemo() || !D.liga || !haySesion() || carasPidiendo) return;
  const g = LS.get(K('fotos-rivales'), null);
  if (g && Date.now() - g.t < (Object.keys(g.caras || {}).length ? 6 * HORA : 20 * MIN)) return;
  carasPidiendo = true;
  try {
    const caras = await carasLiga(D.liga.id);
    LS.set(K('fotos-rivales'), { t: Date.now(), caras });
    if (S.D === D && ponerCaras(D)) { if (S.hoja) repintarHoja(); else pintar(); }
  } catch (e) { /* sin red o sin sesión: las iniciales, y se prueba en la siguiente carga */ }
  finally { carasPidiendo = false; }
}
/** tu once puesto en LaLiga, al cargar (fuera de la jornada en juego; como mucho cada 10 min): el plan no te pide
    alinear lo que ya tienes puesto (Carlos, 30 oct) */
async function mirarMiOnce() {
  const D = S.D;
  if (!D || D.demo || enDemo() || !haySesion() || (S.M && S.M.enJuego) || !(D.yo && D.yo.teamId)) return;
  const g = LS.get(K('mi-once'), null);
  if (g && !forzarOnce && Date.now() - g.t < 10 * MIN) return;
  forzarOnce = false;
  try {
    const r = await api.miOnce(D.yo.teamId);
    const ids = idsOnce(r).map(String), forma = formaOnce(r);
    if (ids.length < 5 || S.D !== D) return;
    const antes = ((g && g.ids) || []).join() + '|' + ((g && g.forma) || []).join();
    apuntarMiOnce(ids, forma);
    if (antes !== ids.join() + '|' + (forma || []).join()) rehacerLuego();
  } catch (e) { /* sin red: el plan sigue con lo que sabía */ }
}
async function despues() {
  // la bienvenida, después del saludo al Worker (si ya la vio en otro dispositivo, el saludo lo dice) o a los 4 s como mucho
  S.bienvenidaPendiente = tocaBienvenida();
  const saludo = saludarSiToca('entrar');
  if (S.bienvenidaPendiente) Promise.race([saludo, new Promise((r) => setTimeout(r, 4000))]).then(() => quizaBienvenida(300));
  mirarMiOnce();
  volverTrasRecarga();
  // (después del saludo: así tu foto ya está en el Worker la primera vez)
  setTimeout(cargarCaras, 3000);
  mirarWebNueva();
  if (S.M && S.M.enJuego) cargarVivo().then((ok) => { if (ok) rehacerLuego(); });
  // onces probables y noticias (de fuera de LaLiga) y, a la vez, las fichas de los jugadores
  const fuentes = fuentesExternas(S.D, S.M).then((f) => { if (f) { S.fuentes = f; rehacerLuego(); } }).catch((e) => console.warn('fuentes', e));
  try {
    const det = await completar(S.D, S.M);
    if (det) { S.det = { ...S.det, ...det }; rehacerLuego(); }
  } catch (e) { console.warn('fichas', e); }
  await fuentes;
  // (lo de arriba aún esperando: los avisos y el plan, con el motor ya al día)
  rehacerSiFalta();
  comprobarAvisos();
  const ci = cfgIA();
  planAHora(ci.auto);
}
/** (0.7.13l) el plan que sale solo a su hora (planes-hora.js): al abrir la app y, con ella abierta, cada 10 minutos. Con
    la IA de la app manda la hora elegida; con la clave de cada uno, además «Plan automático al abrir» (ci.auto) */
let planAHoraEnCurso = false;
async function planAHora(alAbrir = false) {
  if (!S.D || !S.M || enDemo() || !puedePlanIA(enDemo()) || planAHoraEnCurso) return;
  const toca = () => {
    const E = S.planEstado || {};
    if (E.cargando || E.error || E.cupo) return null;
    const turno = turnoPendiente(S.M, ultimoPlan());
    if (!turno && !(alAbrir && !planesApp(enDemo()))) return null;
    return planViejoAuto(S.M, enDemo()) ? { turno } : null;
  };
  if (!toca()) return;
  // (iOS 3) en la app de iOS, nada a la IA sin permiso: si aún no ha contestado, se le pregunta ahora (una vez por apertura);
  // si dijo que no, se queda el plan de la app
  if (!iaPermitida()) {
    if (permisoIA() === '' && !S.permisoIAPreguntado) { S.permisoIAPreguntado = true; pedirPermisoIA(() => planAHora(alAbrir)); }
    return;
  }
  // (22 nov) antes de pedirlo, se mira si otro dispositivo tuyo ya lo tiene: el móvil y la web, con el mismo plan
  planAHoraEnCurso = true;
  try { await sincAntes(5000, { por: 'plan' }); } finally { planAHoraEnCurso = false; }
  const t = toca();
  if (!t || !S.D || enDemo()) return;
  intentarTurno(t.turno);
  generarPlan({ auto: true });
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
  const t = $('#avisoTxt'), r = $('#hiloTxt'), dg = $('#avisoDiag');
  if (t) S.av.borrador = t.value;
  if (r) S.av.hiloBorrador = r.value;
  if (dg) S.av.sinDiag = !dg.checked;
  if (S.tipoHoja && S.tipoHoja[0] === 'avisos') repintarHoja();
}
/** (el dueño) quién de la liga tiene la app, cuándo entró y quién está dentro ahora */
async function abrirQuien() {
  const tab = (S.quien && S.quien.tab) || 'hoy';
  // (23 nov, Carlos: «suele tardar bastante en cargar») sale al momento lo de la última vez, con «Actualizando…», y se
  // cambia por lo nuevo cuando llega. Se guarda solo en este dispositivo y sin hacer sitio (no echa nada para caber)
  const ult = LS.get('quien-ult', null);
  const datosDe = (r) => ({ lista: r.lista || [], registro: r.registro || null, ahora: r.ahora || Date.now(), dias: r.dias || null, embudo: r.embudo || null, invitar: r.invitar || null });
  S.quien = ult && ult.d && Array.isArray(ult.d.lista) ? { ...ult.d, tab, filtro: '', viejo: true } : { cargando: true, tab };
  hoja('quien');
  if (S.quien.viejo) filtrarQuien();
  // (0.7.13k) también «embudo» (Antes de entrar), que hasta ahora no se guardaba y no salía
  try {
    const d = datosDe(await quienUsa());
    guardarTexto('fm-quien-ult', JSON.stringify({ d }), -1);
    // (lo que hayas tocado mientras salía lo de antes se queda: el apartado y el filtro)
    const Q = S.quien || {};
    S.quien = { ...d, tab: Q.tab || tab, filtro: Q.filtro || '' };
  } catch (e) {
    if (e.estado === 403) LS.del('quien-ult');
    if (S.quien && S.quien.viejo && e.estado !== 403) S.quien = { ...S.quien, viejo: false, sinActualizar: true };
    else S.quien = { error: e.estado === 403 ? 'Esto solo lo ve el dueño de la app.' : e.message || String(e) };
  }
  if (S.tipoHoja && S.tipoHoja[0] === 'quien') { repintarHoja(); filtrarQuien(); }
}
/* pest (0.8.4c), para el dueño y quien ayuda: 'todos' (los recibidos, lo de siempre) o 'mios' (reportar uno y los tuyos; desde
   lo que lleva a reportar: la banda de arriba, la bienvenida, la etiqueta BETA, el tutorial y las pantallas de error) */
async function abrirAvisos(pest = 'todos') {
  S.av = { cargando: true, borrador: (S.av && S.av.borrador) || '', cache: (S.av && S.av.cache) || {}, pest };
  hoja('avisos');
  if (enDemo() || !haySesion()) { S.av = { ...S.av, cargando: false, sinSesion: true }; repintarAvisos(); return; }
  try {
    const r = await misAvisos();
    Object.assign(S.av, { cargando: false, lista: r.lista, admin: r.admin, ve: !!(r.ve || r.admin), pendientes: r.pendientes });
    repintarAvisos();
    // las respuestas que ves ahora quedan leídas (el numerito se va); quien ve los de todos, cuando abre «Reportar un fallo»
    if (!S.av.ve || S.av.pest === 'mios') marcarMisLeidas();
    // (0.8.4) los de todos: el dueño y quien ayuda con los fallos (ve)
    if (r.admin || r.ve) {
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
/** tus avisos con respuesta sin leer: ya leídos */
function marcarMisLeidas() {
  for (const x of (S.av.lista || []).filter((y) => y.respuesta && !y.vista)) marcarVisto(x.id).then(pintarNumAvisos).catch(() => {});
}
async function enviarAviso() {
  const t = (($('#avisoTxt') || {}).value || '').trim();
  if (!t) { tostada('Cuenta qué ha pasado'); return; }
  const conDiag = !!($('#avisoDiag') || {}).checked;
  let diag = '';
  if (conDiag) { try { diag = Hj.diagnosticoParaMandar(S); } catch (e) { diag = `(no se ha podido sacar el diagnóstico: ${e.message})`; } }
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
    if (r) Object.assign(S.av, { admin: r.admin, ve: !!(r.ve || r.admin), pendientes: r.pendientes });
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
  S.av.abierto = id; S.av.detalle = avisoListo(id); S.av.hiloBorrador = ''; S.av.capHilo = [];
  repintarAvisos();
  // (0.8.4) abrirlo de verdad: para el dueño y (0.8.4c) para quien ayuda, que también contesta, cuenta como visto (quien lo
  // mandó ve «Visto»); la precarga no. Los sin contestar ya vienen cargados de antes: sus capturas se piden aquí también
  const contesta = !!(S.av.admin || S.av.ve);
  if (S.av.detalle) { cargarCapturas(id, Hj.msgsDe(S.av.detalle)); if (contesta) unAviso(id, true).catch(() => {}); return; }
  try { const d = await unAviso(id, contesta); avisoCache()[id] = d; if (S.av.abierto === id) S.av.detalle = d; } catch (e) { if (S.av.abierto === id) S.av.detalle = { error: e.message }; }
  // el aviso entero sí está al día: si lo último es de Fantasy Manager, cuenta como contestado aunque la lista aún no lo diga
  const d = avisoListo(id);
  if (d && d.respondida && Hj.ultimoDe(d) === 'd') { apuntarContestado(id, d.respondida); S.av.todos = conContestados(S.av.todos); S.av.pendientes = (S.av.todos || []).filter((x) => !x.r).length; fijarPendientes(S.av.pendientes); }
  if (S.av.abierto === id) repintarAvisos();
  if (d) cargarCapturas(id, Hj.msgsDe(d));
}
/** las capturas de los mensajes de un hilo (al abrirlo): se piden una vez y se guardan mientras la app está abierta
    (S.av.capt['id:mensaje']) */
async function cargarCapturas(id, msgs) {
  const c = (S.av.capt ||= {});
  const tareas = [];
  for (const m of msgs || []) {
    if (!m.caps) continue;
    const k = `${id}:${m.n}`;
    if (c[k] && !c[k].some((x) => x === '')) continue;
    c[k] = new Array(m.caps).fill(null);
    for (let i = 0; i < m.caps; i++) tareas.push([k, m.n, i]);
  }
  await enParalelo(tareas, 2, async ([k, m, i]) => {
    try { c[k][i] = await capturaAviso(id, i, m); } catch (e) { c[k][i] = ''; }
    if (S.av.abierto === id || S.av.hilo === id) repintarAvisos();
  });
}
/** (0.8.4) uno de tus avisos: abrirlo enseña la conversación entera y la caja para seguirla; si había respuesta nueva, ya está leída */
function abrirHilo(id) {
  if (S.av.hilo === id) { S.av.hilo = null; repintarAvisos(); return; }
  S.av.hilo = id; S.av.hiloBorrador = ''; S.av.capHilo = [];
  const x = (S.av.lista || []).find((y) => y.id === id);
  repintarAvisos();
  if (!x) return;
  cargarCapturas(id, Hj.msgsDe(x));
  if (x.respuesta && !x.vista) marcarVisto(id).then(() => { x.vista = true; pintarNumAvisos(); repintarAvisos(); }).catch(() => {});
}
/** (0.8.4) escribir en tu aviso: el mensaje sale al momento en la conversación y se manda con sus capturas */
async function escribirHilo(id) {
  const t = (($('#hiloTxt') || {}).value || '').trim(), caps = (S.av.capHilo || []).slice();
  if (!t && !caps.length) { tostada('Escribe algo o adjunta una captura'); return; }
  S.av.hiloBorrador = t; S.av.escribiendo = true;
  repintarAvisos();
  try {
    await escribirAviso(id, t, caps.map((c) => c.url));
    // (la caja, vacía también en la pantalla: repintarAvisos guarda lo que haya en ella)
    const ta = $('#hiloTxt'); if (ta) ta.value = '';
    S.av.hiloBorrador = ''; S.av.capHilo = []; S.av.escribiendo = false;
    const r = await misAvisos().catch(() => null);
    if (r) S.av.lista = r.lista;
    const x = (S.av.lista || []).find((y) => y.id === id);
    if (x) { const ms = Hj.msgsDe(x), m = ms[ms.length - 1]; if (m && m.caps && caps.length) (S.av.capt ||= {})[`${id}:${m.n}`] = caps.map((c) => c.url); }
    tostada(enApp ? 'Mandado: cuando conteste te llega una notificación' : 'Mandado: te aviso cuando conteste', 4000);
    programarFondo();
  } catch (e) { S.av.escribiendo = false; tostada(`No se ha podido mandar: ${e.message}`, 6000); }
  repintarAvisos();
  pintarNumAvisos();
}
/* las capturas para un aviso que vas a mandar: de la galería (en la app, con su selector de fotos) o de un archivo */
const MAX_CAPTURAS = 3;
/* (0.8.4) las capturas van al aviso nuevo o, con `hilo`, al mensaje que escribes en un hilo abierto (S.av.capHilo) */
const capsDestino = () => (S.av.capDest === 'hilo' ? (S.av.capHilo ||= []) : (S.av.capturas ||= []));
function elegirCapturas(destino = 'aviso') {
  S.av.capDest = destino;
  const caps = capsDestino();
  if (caps.length >= MAX_CAPTURAS) { tostada(`Como mucho ${MAX_CAPTURAS} capturas por mensaje`); return; }
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
  const caps = capsDestino();
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
    // (0.8.4) la conversación entera, mensaje a mensaje, con las capturas de cada uno
    const ms = d.texto || d.msgs ? Hj.msgsDe(d) : [{ de: 'u', texto: x.txt || '', caps: x.c || 0 }];
    const conv = ms.map((m) => `${m.de === 'd' ? '→ Le contestaste' : '·'}${m.t ? ` (${cuandoT(m.t)})` : ''}: ${m.texto || ''}${m.caps ? ` [${m.caps} captura${m.caps > 1 ? 's' : ''}: ábrelas en la bandeja de la app y mándamelas]` : ''}`).join('\n');
    const diag = d.diag ? `\n--- diagnóstico (recortado) ---\n${String(d.diag).slice(0, 3000)}` : '';
    return `${cab}\n${conv}${diag}`;
  });
  // (en el navegador, copiar después de esperar a la red puede fallar: el texto queda a la vista con su botón)
  S.av.paraClaude = `Avisos de fallos de Fantasy Manager (${sinContestar ? 'sin contestar' : 'los últimos'}), a ${cuandoT(Date.now())}:\n\n${partes.join('\n\n')}`;
  nativo.copiar(S.av.paraClaude);
  repintarAvisos();
  tostada(`Copiados ${lista.length}: pégalos en el chat`, 5000);
}
/* lo que contestas tarda hasta un minuto en salir como contestado en la lista del servidor (el almacén del Worker
   lista con retraso): se apunta aquí y manda sobre la lista durante un día */
const contestados = () => { const c = LS.get('avisos-contestados', {}); for (const [k, t] of Object.entries(c)) if (Date.now() - t > 86400e3) delete c[k]; return c; };
function apuntarContestado(id, t = Date.now()) { const c = contestados(); c[id] = t; LS.set('avisos-contestados', c); }
// (0.8.4) solo si lo contestado aquí es de después del último mensaje: si él ha vuelto a escribir, vuelve a estar sin contestar
const conContestados = (lista) => { const c = contestados(); return (lista || []).map((x) => (!x.r && c[x.id] && c[x.id] >= (x.ult || 0) ? { ...x, r: c[x.id] } : x)); };
async function contestarAviso(id) {
  const t = (($('#hiloTxt') || {}).value || '').trim(), caps = (S.av.capHilo || []).slice();
  if (!t) { tostada('Escribe la respuesta'); return; }
  S.av.hiloBorrador = t; S.av.escribiendo = true;
  repintarAvisos();
  try {
    await responderAviso(id, t, caps.map((c) => c.url));
    const ta = $('#hiloTxt'); if (ta) ta.value = '';
    S.av.hiloBorrador = ''; S.av.capHilo = []; S.av.escribiendo = false;
    tostada('Respuesta mandada: le llega en la app');
    // (0.8.4) la conversación como está ahora (la respuesta se añade, no pisa la de antes)
    const d = await unAviso(id, true).catch(() => null);
    if (d) {
      avisoCache()[id] = d;
      if (S.av.detalle && S.av.detalle.id === id) S.av.detalle = d;
      const ms = Hj.msgsDe(d), m = ms[ms.length - 1];
      if (m && m.caps && caps.length) (S.av.capt ||= {})[`${id}:${m.n}`] = caps.map((c) => c.url);
    }
    apuntarContestado(id);
    S.av.todos = conContestados(S.av.todos);
    await misAvisos().catch(() => null);
    S.av.pendientes = S.av.todos.filter((x) => !x.r).length; fijarPendientes(S.av.pendientes);
  } catch (e) { S.av.escribiendo = false; tostada(`No se ha podido mandar: ${e.message}`, 6000); }
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
    const t = `${firmaDe(resp.por) || 'Te han'} ${resp.por ? 'te ha contestado' : 'contestado'}: «${resp.respuesta.length > 120 ? `${resp.respuesta.slice(0, 117)}…` : resp.respuesta}»`;
    if (nativo.aLaVista()) tostada(`${t} · Está en Ajustes → ${veTodo() ? 'Avisos de fallo → Reportar un fallo' : 'Reportar un fallo o una idea'}`, 8000); else nativo.notificar('Respuesta a tu aviso', t, 'hoy');
  }
  if (r.nuevosRecibidos) {
    const t = r.nuevosRecibidos > 1 ? `${r.nuevosRecibidos} avisos de fallos nuevos` : 'Un aviso de fallo nuevo';
    if (nativo.aLaVista()) tostada(`${t}: en Ajustes → Avisos de fallo`, 6000); else nativo.notificar(t, 'Entra para leerlo y contestar', 'hoy');
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
async function generarPlan({ extra = false, auto = false } = {}) {
  if (S.planEstado.cargando || !S.D) return;
  // (iOS 3) en la app de iOS, lo primero el permiso para mandar tu liga a la IA (pedido por ti: se pregunta siempre)
  if (!iaPermitida()) { if (!auto) pedirPermisoIA(() => generarPlan({ extra, auto })); return; }
  S.planEstado = { cargando: true, paso: '' };
  montarPlan();
  if (S.vista === 'hoy') pintar();
  nativo.trabajando(true, 'La IA está leyendo tu liga y las noticias. Puedes salir de la app: te avisa al terminar.');
  const ctl = new AbortController();
  S.planCtl = ctl;
  try {
    await planDelDia(S.D, S.M, S.c, {
      signal: ctl.signal, extra, demo: enDemo(),
      alPaso: (t) => { S.planEstado.paso = t; const el = $('#paso-ia'); if (el) el.textContent = t; },
    });
    if (!enDemo()) contar('p');
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
      tostada('Plan parado. Pide otro con «Rehacer el plan» cuando quieras');
    } else if (e.cupo) {
      // sin planes con la IA hoy (2 al día; más, con un anuncio en la app de Google Play): no es un fallo. Se queda el plan
      // de la app y, si lo ha pedido él, la caja con lo que puede hacer
      S.planEstado = auto ? { cupo: e.cupo, callado: true } : { cupo: e.cupo, error: e.message || String(e) };
      rehacer();
      // lo ha pedido él y aún puede ver un anuncio para uno más: directo al anuncio
      if (!auto && !extra && e.cupo.masConAnuncio && conAnuncios()) pedirPlanExtra(e.cupo);
    } else {
      S.planEstado = { error: e.message || String(e), clave: !!e.clave };
      rehacer();
      if (!nativo.aLaVista() && !auto) nativo.notificar('No ha salido el plan de hoy', 'Entra y dale a Reintentar', 'hoy');
    }
  } finally {
    if (S.planCtl === ctl) S.planCtl = null;
    // (24 nov) con una pregunta a la IA aún en marcha no se apaga: al salir de la app, el móvil no avisaba ni la recogía
    if (!S.charlando) nativo.trabajando(false);
    // (24 nov) pase lo que pase (también si falla algo al repasar el plan), la pantalla no se queda en «Preparando»
    if (S.planEstado && S.planEstado.cargando) S.planEstado = {};
    // (sin liga: se ha cambiado de liga a medias y ya se está cargando la otra)
    if (S.D) { try { if (!S.hoja) pintar(); else pintarSup(); } catch (e) { console.error(e); apuntarError(e.message, 'plan'); } }
  }
}

/* ---------------- ventanas de abajo ---------------- */
/** el asa de arriba de cada ficha: se arrastra hacia abajo para cerrar y, tocándola, también cierra (44 px de alto) */
const ASA = '<button class="asa" data-accion="cerrarHoja" aria-label="Cerrar"><i></i></button>';
/** las fichas sin botón de cerrar (jugador, rival, club, partido, resumen) llevan una × que se queda arriba al bajar.
    Solo en el ordenador: en el móvil se cierran con el asa, arrastrando hacia abajo o con Atrás ((32), Carlos, 10 nov;
    la puso la sesión 8 en todas, A12) */
const conCerrar = (html) => (/data-accion="cerrarHoja"/.test(html) ? html : `<button class="b-ico cerrar-flota" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button>${html}`);
/** la ficha es un diálogo: se anuncia con su título (el primer h2) y el foco entra en ella */
function rotularHoja(hoja) {
  const t = hoja.querySelector('h2');
  if (t) { t.id ||= 'hojaTit'; hoja.setAttribute('aria-labelledby', t.id); hoja.removeAttribute('aria-label'); } else { hoja.removeAttribute('aria-labelledby'); hoja.setAttribute('aria-label', 'Ficha'); }
}
function abrirHoja(html) {
  // el foco vuelve al cerrar a lo que abrió la primera ficha (si se encadenan, a ese mismo)
  const antes = S.hoja ? S.focoAntes : document.activeElement;
  cerrarHoja(true, true);
  S.focoAntes = antes;
  const velo = document.createElement('div'); velo.className = 'velo'; velo.dataset.accion = 'cerrarHoja';
  const hoja = document.createElement('div'); hoja.className = 'hoja';
  hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'true'); hoja.tabIndex = -1;
  hoja.innerHTML = `${ASA}${conCerrar(html)}`;
  rotularHoja(hoja);
  document.body.append(velo, hoja);
  document.body.style.overflow = 'hidden';
  // lo de detrás no se lee ni se alcanza con el tabulador mientras la ficha está abierta
  const app = $('#app'); if (app) app.inert = true;
  requestAnimationFrame(() => { velo.classList.add('on'); hoja.classList.add('on'); if (!hoja.contains(document.activeElement)) hoja.focus({ preventScroll: true }); });
  S.hoja = hoja;
  encuadrar(hoja);
  ajustarTabs(hoja);
  gestoHoja(hoja, velo);
  return hoja;
}
/* (32) En el móvil, la ficha se cierra arrastrándola hacia abajo, como las de Android e iOS (Carlos, 10 nov: sin ×).
   Va pegada al dedo (sin transición mientras se arrastra, un cambio por fotograma), se cierra si baja más de un 25 % de
   su altura o si se suelta con fuerza hacia abajo, y si no vuelve a su sitio. El velo se aclara según baja. Se puede
   empezar desde el asa, desde arriba del todo o seguir el mismo gesto después de subir hasta arriba la ficha; un gesto
   de lado (pestañas, carriles) o dentro de algo que aún tiene por subir no la mueve. Sin gesto: tocar el asa o el velo,
   Atrás o Escape (WCAG 2.5.1) */
let arrastreFin = 0;
function gestoHoja(hoja, velo) {
  let g = null, raf = 0;
  const pintarG = () => {
    raf = 0;
    if (!g || !g.arrastra) return;
    const d = Math.max(0, g.y - g.y0);
    hoja.style.transform = `translateY(${d}px)`;
    if (velo) velo.style.opacity = String(Math.max(0, 1 - (d / g.alto) * 1.1));
  };
  // ¿algo con scroll propio entre el dedo y la ficha que todavía puede subir?
  const subePorDentro = (el) => {
    for (let n = el; n && n !== hoja; n = n.parentElement) if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return true;
    return false;
  };
  const soltar = (cierra) => {
    hoja.classList.remove('arrastrando');
    hoja.style.transition = ''; hoja.style.transform = '';
    if (velo) { velo.style.transition = ''; velo.style.opacity = ''; }
    if (cierra) { nativo.toque(); const t = S.tipoHoja && S.tipoHoja[0]; if (cerrarHoja() && FICHAS_PAUSA.has(t)) pausaNatural(); }
  };
  hoja.addEventListener('touchstart', (e) => {
    g = null;
    if (e.touches.length !== 1 || V.ancho()) return;
    const t = e.touches[0];
    if (e.target.closest('input, textarea, select, [data-quieto]')) return;
    const desdeAsa = !!e.target.closest('.asa');
    if (!desdeAsa && subePorDentro(e.target)) return;
    g = { x0: t.clientX, y0: t.clientY, y: t.clientY, desdeAsa, arrastra: false, decidido: false, alto: hoja.offsetHeight || window.innerHeight, h: [[t.clientY, e.timeStamp]] };
  }, { passive: true });
  hoja.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    if (!g.decidido) {
      const dx = Math.abs(t.clientX - g.x0), dy = t.clientY - g.y0;
      if (dx < 8 && Math.abs(dy) < 8) return;
      g.decidido = true;
      // de lado: no es para cerrar
      if (dx > Math.abs(dy)) { g = null; return; }
    }
    if (!g.arrastra) {
      // empieza a arrastrar al tirar hacia abajo con la ficha arriba del todo (o desde el asa); si antes había que
      // subirla, el gesto sigue desde donde llega arriba
      if (t.clientY > g.y && (g.desdeAsa || hoja.scrollTop <= 0)) {
        // (desde el principio del gesto, desde donde se tocó: va 1:1 con el dedo; tras subir la ficha, desde aquí)
        g.arrastra = true; if (g.subio) g.y0 = t.clientY;
        hoja.classList.add('arrastrando');
        hoja.style.transition = 'none';
        if (velo) velo.style.transition = 'none';
      } else { g.y = t.clientY; g.subio = true; return; }
    }
    g.y = t.clientY;
    g.h.push([t.clientY, e.timeStamp]); if (g.h.length > 6) g.h.shift();
    // mientras se arrastra, que no haga scroll ni rebote por dentro
    if (e.cancelable) e.preventDefault();
    if (!raf) raf = requestAnimationFrame(pintarG);
  }, { passive: false });
  const fin = (e) => {
    const x = g; g = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!x || !x.arrastra) return;
    arrastreFin = Date.now();
    const d = Math.max(0, x.y - x.y0);
    // la velocidad de los últimos ~100 ms (px/ms): un tirón rápido cierra aunque baje poco
    const ult = x.h[x.h.length - 1], ini = x.h.find((p) => ult[1] - p[1] <= 100) || x.h[0];
    const vel = ult[1] > ini[1] ? (ult[0] - ini[0]) / (ult[1] - ini[1]) : 0;
    soltar(e.type !== 'touchcancel' && (d > x.alto * 0.25 || (vel > 0.5 && d > 24)));
  };
  hoja.addEventListener('touchend', fin, { passive: true });
  hoja.addEventListener('touchcancel', fin, { passive: true });
}
function cerrarHoja(ya = false, sigue = false) {
  S.apodoEdita = null;
  const h = $('.hoja'), v = $('.velo');
  if (!h) return false;
  // si se estaba cargando un anuncio para esto, ya no se enseña
  if (S.tipoHoja && S.tipoHoja[0] === 'anuncio' && S.anuncio && S.anuncio.cargando) { nativo.cancelarAnuncio(); S.anuncio = null; }
  S.hoja = null; S.tipoHoja = null; S.pila = [];
  document.body.style.overflow = '';
  if (!sigue) {
    const app = $('#app'); if (app) app.inert = false;
    const f = S.focoAntes; S.focoAntes = null;
    if (f && f.isConnected && f.focus) f.focus({ preventScroll: true });
  }
  if (ya) { h.remove(); v && v.remove(); return true; }
  quitarAtras();
  h.classList.remove('on'); v && v.classList.remove('on');
  setTimeout(() => { h.remove(); v && v.remove(); }, 250);
  return true;
}
const htmlHoja = (tipo, arg) => {
  try { return htmlHoja0(tipo, arg); } catch (e) {
    console.error(e);
    apuntarError(e.message, `hoja ${tipo}${e.stack ? ` · ${String(e.stack).split('\n')[1] || ''}` : ''}`);
    return `<div class="hoja-cab"><h2>No se ha podido abrir</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div><div class="error-c">Algo ha fallado al abrir esto. Manda el fallo para que se arregle.<div class="fallo-det">${esc(e.message)}</div><div style="margin-top:10px"><button class="btn chico" data-accion="mandarFallo">Mandar el fallo</button></div></div>`;
  }
};
/** el candado de una función top en la web y el iPhone (donde no se abre con un anuncio); arg: «clave|como» */
function bloqHTML(arg) {
  const [clave, como] = String(arg || '').split('|');
  const [t, x] = BLOQUEO[como] || BLOQUEO[clave] || ['Función top', ''];
  return `<div class="bloq-hoja"><div class="hoja-cab"><span></span><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
        <span class="bloq-grande">${icono('candado')}</span><div class="top-sello">${selloTop()}</div><h2>${esc(t)}</h2><p>${esc(x)}</p>
        <p>${esc(dondeTop(clave).trim())}</p>
        ${enApp || enIPhone ? '' : botonPlay()}
        ${Hj.botonInvitarTop(clave)}
        <button class="btn ancho sec" data-accion="cerrarHoja" aria-label="Cerrar" style="margin-top:8px">Entendido</button></div>`;
}
const htmlHoja0 = (tipo, arg) => (tipo === 'bloq' ? bloqHTML(arg) : tipo === 'quien' ? Hj.quienUsaHTML(S) : tipo === 'planAj' ? Hj.planAjustesHTML(S) : tipo === 'avisos' ? Hj.avisos(S) : tipo === 'ajustes' ? Hj.ajustes(S) : tipo === 'vinculo' ? Hj.vinculoWeb(S) : tipo === 'j' ? Hj.fichaJugador(S, arg) : tipo === 'r' ? Hj.fichaRival(S, arg) : tipo === 'oj' ? Jo.onceJornadaHTML(S, arg, Dr.puntosDeJornada(S, Number(String(arg).split(':')[1]))) : tipo === 'p' ? Dr.fichaPartido(S, arg) : tipo === 'c' ? Cl.fichaClub(S, arg) : tipo === 'bajas' ? Bj.hojaBajas(S, arg) : tipo === 'anuncio' ? Hj.anuncioHTML(S, arg) : tipo === 'invitar' ? Hj.invitarHTML(S) : tipo === 'invitado' ? Hj.invitadoHTML(S) : tipo === 'tarjeta' ? Tj.hojaTarjeta(S) : tipo === 'resumen' ? Hj.resumenEquipo(S) : tipo === 'chats' ? V.chatsViejosHTML() : tipo === 'sust' ? V.sustitutosHTML(S, arg) : tipo === 'dicho' ? DD.hojaDichoHTML(S, arg) : Hj.diagnostico(S));
/*
 * las fichas que se abren desde otra (un jugador desde su club, el club desde un partido…) llevan arriba «‹ Volver» a
 * la de antes; el gesto de atrás de Android hace lo mismo. pila: las fichas de antes, de la más vieja a la última
 */
// (25 nov, aviso de Big Mac Laporta) también la ficha de un rival: al abrir uno de sus jugadores, «‹ Volver» lleva al rival
// (25 nov, auditoría, hallazgos 12 y 13) y el resumen de tu equipo y el once de una jornada: abrir un jugador desde ahí y
// volver te deja donde estabas. El candado de una función top ('bloq') vuelve a la ficha desde la que se abrió
const CON_PILA = new Set(['c', 'j', 'p', 'sust', 'bajas', 'r', 'resumen', 'oj', 'bloq', 'dicho']);
function pilaDesde(el, tipo, arg) {
  if (!S.hoja || !S.tipoHoja || !CON_PILA.has(S.tipoHoja[0]) || !CON_PILA.has(tipo) || !(el && el.closest && el.closest('.hoja'))) return [];
  if (S.tipoHoja[0] === tipo && String(S.tipoHoja[1]) === String(arg)) return S.pila || [];
  return [...(S.pila || []), [...S.tipoHoja]].slice(-6);
}
function nombreHoja([tipo, arg]) {
  if (tipo === 'c') return Cl.nombreClub(S, arg);
  if (tipo === 'j') { const j = S.M && S.M.J(arg); return (j && j.nombre) || 'el jugador'; }
  if (tipo === 'sust') return 'Sustitutos';
  if (tipo === 'bajas') return 'Bajas';
  if (tipo === 'r') { const r = S.M && S.M.rivales.find((x) => String(x.e.teamId) === String(arg)); return (r && r.e.nombre) || 'el rival'; }
  if (tipo === 'resumen') return 'Tu equipo hoy';
  if (tipo === 'oj') {
    const [tid, n] = String(arg).split(':'), e = S.D && (S.D.clasif || []).find((x) => String(x.teamId) === tid);
    return `${(e && e.nombre) || 'Mánager'} · J${n}`;
  }
  return 'el partido';
}
function cuerpoHoja(tipo, arg, pila = S.pila) {
  const atras = pila && pila.length ? `<button class="volver-h" data-accion="volverHoja">${icono('atras')}<span>${esc(nombreHoja(pila[pila.length - 1]))}</span></button>` : '';
  return atras + htmlHoja(tipo, arg);
}
function hoja(tipo, arg, pila = []) { alDiaDichos(); abrirHoja(cuerpoHoja(tipo, arg, pila)); S.tipoHoja = [tipo, arg]; S.pila = pila; marcarAtras(); }
/* en la web, el «atrás» del navegador (o el gesto del móvil) cierra la ficha en vez de salir de la app: al abrir una
   ficha se apunta un paso en el historial y, al cerrarla con la X, se quita (revisión del 29 oct). En la app de
   Android lo hace window.atras */
let porAtras = false, porVuelta = false;
function marcarAtras() {
  if (enApp) return;
  try { if (!(history.state && history.state.fmHoja)) history.pushState({ fmHoja: 1 }, '', location.href); } catch (e) { /* nada */ }
}
function quitarAtras() {
  if (enApp || porAtras) return;
  try { if (history.state && history.state.fmHoja) { porVuelta = true; history.back(); } } catch (e) { /* nada */ }
}
if (!enApp) {
  window.addEventListener('popstate', () => {
    if (porVuelta) { porVuelta = false; return; }
    if (!S.hoja && !$('.visor')) return;
    porAtras = true;
    try { window.atras(); } finally { porAtras = false; }
  });
}
/** lo que hay que pedir al abrir cada ficha */
function alAbrir(tipo, arg) {
  if (tipo === 'j') cargarDetalle(arg);
  else if (tipo === 'p') { const [n, id] = String(arg).split(':'); cargarPartido(Number(n), id); } else if (tipo === 'c') cargarClub(arg);
  else if (tipo === 'r') cargarOnceRival(arg);
  else if (tipo === 'oj') { const [t, n] = String(arg).split(':'); cargarOnceJornada(t, Number(n)); } else if (tipo === 'resumen') { encuadrar(S.hoja); valoresMios(); }
}
function volverHoja() {
  const pila = [...(S.pila || [])];
  const ant = pila.pop();
  if (!ant) return false;
  hoja(ant[0], ant[1], pila);
  alAbrir(ant[0], ant[1]);
  return true;
}
/** al abrir un club: sus titulares de los últimos días (Google Noticias, 1 hora guardados) y lo que ha jugado cada uno */
async function cargarClub(id) {
  cargarJornadasClub(id);
  if (enDemo() || !S.D || (S.notClub && S.notClub[id] && Date.now() - S.notClub[id].t < 60 * MIN)) return;
  S.notClub = S.notClub || {};
  S.cargandoClub = id;
  let l = [];
  try { l = await noticiasClub(S.D, id); } catch (e) { l = []; }
  S.notClub[id] = { t: Date.now(), l };
  if (S.cargandoClub === id) S.cargandoClub = null;
  if (S.tipoHoja && S.tipoHoja[0] === 'c' && String(S.tipoHoja[1]) === String(id)) repintarHoja();
}
/**
 * Clubes → Jornada a jornada: la ficha de LaLiga de cada jugador del club (minutos, puntos, goles, asistencias y tarjetas de
 * cada jornada). Se guarda por club (los 8 últimos abiertos) y se vuelve a pedir a las 6 h, o a la media hora si hay una
 * jornada en juego. Unos 25 jugadores, de 4 en 4: 5-10 s la primera vez
 */
async function cargarJornadasClub(id) {
  if (enDemo() || !S.D || !haySesion() || !S.D.liga) return;
  S.clubJor ||= LS.get('clubJor', {});
  const g = S.clubJor[id];
  const vale = S.M && S.M.enJuego ? 30 * MIN : 6 * HORA;
  if (g && (g.cargando || Date.now() - g.t < vale)) return;
  const pids = Object.values(S.D.maestro || {}).filter((j) => j.equipoId === id && j.pos >= 1 && j.pos <= 4 && j.estado !== 'out_of_league').map((j) => String(j.id));
  if (!pids.length) return;
  const abierta = () => S.tipoHoja && S.tipoHoja[0] === 'c' && String(S.tipoHoja[1]) === String(id);
  const prog = { n: 0, de: pids.length };
  S.clubJor[id] = { ...(g || { porJug: {} }), cargando: true, prog };
  const porJug = {};
  let fallos = 0;
  // los titulares y los cambios (ESPN), a la vez que las fichas; si falla, se queda lo de antes y van los minutos
  const titulares = titularesClub(S.D, id, g && g.espn).catch((e) => { console.warn('titulares', e); return (g && g.espn) || null; });
  await enParalelo(pids, 4, async (pid) => {
    try {
      const d = detalleJugador(await api.jugador(pid, S.D.liga.id));
      porJug[pid] = d.stats.map((x) => [x.n, x.pts, x.min, x.gol, x.asis, x.am, x.roja]);
    } catch (e) { if (e.sesion) throw e; fallos++; }
    // (cómo va, cada 6 fichas: la primera vez son 5-10 s)
    if (++prog.n % 6 === 0 && abierta() && !(g && g.porJug && Object.keys(g.porJug).length)) repintarHoja();
  }).catch(() => {});
  const espn = await titulares;
  const ok = Object.keys(porJug).length;
  // si fallan unas pocas fichas, las de antes de esos jugadores (mejor eso que un hueco)
  if (ok && g && g.porJug) for (const pid of pids) if (!porJug[pid] && g.porJug[pid]) porJug[pid] = g.porJug[pid];
  S.clubJor[id] = ok ? { t: fallos > 3 ? Date.now() - vale + 15 * MIN : Date.now(), porJug, espn, fallos } : { ...(g || { porJug: {} }), espn: espn || (g && g.espn) || null, t: Date.now() - vale + 10 * MIN, error: 'sin fichas' };
  if (ok) {
    const todos = LS.get('clubJor', {});
    todos[id] = S.clubJor[id];
    const ids = Object.keys(todos).sort((a, b) => (todos[b].t || 0) - (todos[a].t || 0));
    for (const k of ids.slice(8)) delete todos[k];
    if (!LS.set('clubJor', todos)) { for (const k of ids.slice(3)) delete todos[k]; LS.set('clubJor', todos); }
  }
  if (abierta()) repintarHoja();
}
/** dibuja la tarjeta elegida y la pone en su hoja (si sigue abierta y no se ha cambiado mientras) */
let tarjetaN = 0;
async function pintarTarjeta() {
  const T = S.tarjeta;
  if (!T) return;
  const n = ++tarjetaN;
  let r = null;
  try { r = await Tj.dibujar(S, T.k, T.titular); } catch (e) { console.error(e); apuntarError(e.message, 'tarjeta'); }
  if (n !== tarjetaN || S.tarjeta !== T) return;
  if (r) Object.assign(T, r, { error: '' }); else T.error = 'No se ha podido preparar la imagen.';
  if (S.tipoHoja && S.tipoHoja[0] === 'tarjeta') repintarHoja();
}
function repintarHoja() {
  if (!S.hoja || !S.tipoHoja) return;
  alDiaDichos();
  const sc = S.hoja.scrollTop;
  const dentro = S.hoja.contains(document.activeElement);
  S.hoja.innerHTML = `${ASA}${conCerrar(cuerpoHoja(...S.tipoHoja))}`;
  rotularHoja(S.hoja);
  if (S.tipoHoja[0] === 'ajustes' && S.ajBusca) Hj.filtrarAjustes(S.hoja, S.ajBusca);
  S.hoja.scrollTop = sc;
  if (dentro) S.hoja.focus({ preventScroll: true });
  encuadrar(S.hoja);
  ajustarTabs(S.hoja);
}

window.atras = () => {
  if ($('.pant-aviso')) { pantallaEntrar(); return true; }
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
  // (21 nov) de vuelta de la página de LaLiga sin el código: «¿No has vuelto solo?»
  mirarSinCodigo();
  // (15 nov) el plan con la IA que se cortó al salir de la app se recoge al volver (ia.js, planPorApp)
  window.dispatchEvent(new Event('fm-vuelta'));
  comprobarAvisos();
  setTimeout(recogerPregunta, 1500);
  if (S.vista === 'ia' && !hayClave() && vieneDeAIStudio()) setTimeout(aPegar, 250);
  if (enApp && Date.now() - (S.versionT || 0) > 30 * MIN) buscarVersion(false);
  if (S.D && !S.cargando && Date.now() - S.D.t > 15 * MIN && (enDemo() || haySesion())) cargar({ silencio: true });
};
/* En el navegador nadie llamaba a alVolver (solo Android, al volver a la app): con la pestaña abierta o vuelta a ella tras
   horas, la liga se quedaba como estaba (visto el 4 nov: a las 00:21, «Mercado de hoy» con 17 subastas ya cerradas y el plan
   con «antes de las 00:15»). Ahora la web recarga al volver a la pestaña (si lo de antes tiene más de 15 min), y la web y
   la app, en cuanto cambia el mercado con la app abierta (un minuto después del cierre, como mucho cada 5 min). */
const sesionVale = () => enDemo() || haySesion();
document.addEventListener('visibilitychange', () => {
  if (enApp || document.hidden || !S.D || S.cargando || !sesionVale()) return;
  if (Date.now() - S.D.t > 15 * MIN) cargar({ silencio: true });
});
let recargaMercadoT = 0, cierreVisto = 0;
setInterval(() => {
  if (!S.D || !S.M || S.cargando || document.hidden || !sesionVale()) return;
  // (pasado el cierre, el motor rehecho cada minuto ya no trae cierreMercado: vale el último que se vio, o el cierre de
  // alguna subasta de la lista cargada que ya ha pasado)
  if (S.M.cierreMercado) cierreVisto = S.M.cierreMercado;
  const ahora = Date.now();
  const sub = (S.M.mercado || []).map((m) => m.cierra).filter((t) => t && t > S.D.t && t + MIN < ahora);
  const c = Math.max(cierreVisto > S.D.t ? cierreVisto : 0, ...sub, 0);
  if (!c || S.D.t >= c || ahora < c + MIN || ahora - recargaMercadoT < 5 * MIN) return;
  recargaMercadoT = ahora;
  cargar({ silencio: true });
}, 30e3);

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
    // los puntos de cada jornada, los de la liga de ejemplo (j.semanas): si no, las barras no casaban con sus puntos
    const sem = j.semanas || [];
    det = { stats: sem.map((w) => { const min = w.pts === 0 && azar() < 0.6 ? 0 : Math.round(45 + azar() * 45); return { n: w.n, pts: w.pts, min, gol: min && j.pos === 4 && w.pts >= 6 && azar() < 0.6 ? 1 : 0, asis: min && w.pts >= 5 && azar() < 0.25 ? 1 : 0, am: min && azar() < 0.12 ? 1 : 0, roja: 0 }; }), valores: null };
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
  const ej = $('#jor-j'); if (ej) ej.innerHTML = Hj.jornadasFichaHTML(S.det[pid]);
  // con el histórico de LaLiga ya se sabe lo que ha subido hoy aunque la app no se abriera ayer
  const vg = $('#valor-j');
  if (vg && S.det[pid] && S.det[pid].valores && S.M.olvidarTend) { S.M.olvidarTend(pid); vg.outerHTML = Hj.valorFichaHTML(S.M.J(pid), S.M.tend(pid)); }
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
/**
 * «¿Qué hago con X?» según de quién es (aviso de Domy, 31 oct: con uno suyo le preguntaba si comprarlo o clausularlo):
 * tuyo, venderlo a LaLiga o a un rival, subirle la cláusula o quedártelo; de un rival, clausularlo u ofertarle; libre, pujar
 */
function preguntaJ(j) {
  const M = S.M, D = S.D, yo = D.yo && D.yo.teamId;
  if ((M.mias || []).some((x) => String(x.pid) === String(j.id))) return `¿Qué hago con ${j.nombre}, que es mío? Dime si me lo quedo, si lo vendo a LaLiga, si se lo vendo a un rival (a quién y por cuánto) o si le subo la cláusula (hasta cuánto), y por qué.`;
  const tid = M.dueno && M.dueno[j.id];
  const r = tid != null && String(tid) !== String(yo) ? (D.clasif || []).find((e) => String(e.teamId) === String(tid)) : null;
  if (r) return `¿Qué hago con ${j.nombre}, que es de ${r.manager || r.nombre}? Dime si clausularlo (cuándo se puede y si me llega), hacerle una oferta (por cuánto) o dejarlo, y por qué.`;
  if ((M.mercado || []).some((m) => String(m.pid) === String(j.id) && m.tipo === 'liga')) return `¿Qué hago con ${j.nombre}, que está libre en el mercado? Dime si pujar por él, cuánto como mucho y por qué.`;
  return `¿Qué hago con ${j.nombre}? Dime si me interesa, cómo conseguirlo, cuánto pagar como mucho y por qué.`;
}
/* (20 nov, Carlos: «la IA debe estar actualizada siempre: si le preguntas una cosa, debe estar actualizada al momento»)
   antes de preguntar, la liga al día: si lo que hay tiene más de 2 minutos, se vuelve a pedir a LaLiga (o se espera a la
   carga que ya va), como mucho 25 s; si LaLiga no contesta, se pregunta con lo que hay */
async function ligaAlDiaParaPreguntar() {
  if (!S.D || enDemo() || !haySesion()) return;
  if (!S.cargando && Date.now() - S.D.t < 2 * MIN) return;
  S.pasoChat = 'Poniendo tu liga al día…'; pintar();
  const carga = S.cargando
    ? new Promise((ok) => { const mira = () => (S.cargando ? setTimeout(mira, 300) : ok()); mira(); })
    : cargar({ silencio: true }).catch(() => {});
  await Promise.race([carga, new Promise((ok) => setTimeout(ok, 25000))]);
  S.pasoChat = '';
}
async function enviarPregunta(texto, { extra = false } = {}) {
  const t = (texto || '').trim();
  if (S.charlando || S.preparandoFotos) return;
  const fotos = S.adjuntos.slice();
  if (!t && !fotos.length) { tostada('Escribe tu pregunta (o manda una foto) y dale a enviar'); const ta = $('#pregunta'); if (ta) ta.focus(); return; }
  // (iOS 3) en la app de iOS, nada a la IA sin permiso: se pregunta antes y, si dice que sí, sale la pregunta tal cual
  if (!iaPermitida()) { pedirPermisoIA(() => enviarPregunta(texto, { extra })); return; }
  S.adjuntos = [];
  if (S.vista !== 'ia') ir('ia');
  S.charlando = true; S.parcial = ''; S.pasoChat = ''; S.preguntaActual = t; S.fotosActuales = fotos; S.errorChat = null;
  pintar();
  let ultimo = 0;
  // como con el plan: aunque salgas de la app sigue pensando, y si no estás en ella te avisa al contestar
  const resumenP = t ? `«${t.length > 60 ? `${t.slice(0, 57)}…` : t}»` : fotos.length > 1 ? 'Tus capturas' : 'Tu captura';
  nativo.trabajando(true, `${resumenP} · Puedes salir de la app: te avisa cuando conteste.`, 'Pensando la respuesta');
  const ctl = new AbortController();
  S.chatCtl = ctl;
  try {
    // (repaso de la 0.8s) antes de preguntar, lo último de los otros dispositivos: la pregunta va detrás de la conversación de
    // verdad y no pisa lo que se haya preguntado en el otro (como mucho 2,5 s)
    if (S.D && !enDemo()) { try { await sincAntes(2500, { conChat: true, por: 'pregunta' }); } catch (e) { /* como antes */ } }
    await ligaAlDiaParaPreguntar();
    // (22 nov, Carlos) lo que cuenta como un hecho («no me quedan blindajes», «a este no lo vendo», «ya he pujado») se
    // apunta antes de preguntar y se rehace el análisis: la IA ya lee los datos corregidos y Hoy dice lo mismo
    let dicho = [];
    try { dicho = apuntarDicho(t, S.D, S.M, S.plan); if (dicho.length) rehacer(); } catch (e) { dicho = []; }
    const r = await charlar(t, S.D, S.M, S.c, (parcial) => {
      S.parcial = parcial;
      const ahora = Date.now();
      if (ahora - ultimo > 120) { ultimo = ahora; const el = $('#respuesta'); if (el) { el.innerHTML = `<div class="quien-ia">Escribiendo…</div>${md(parcial)}`; bajarChat(); } }
    }, ctl.signal, fotos, (paso) => { S.pasoChat = paso; const el = $('#paso-chat'); if (el) el.textContent = paso; }, { extra, dicho });
    if (!enDemo()) contar('q');
    // lo que apunta u olvida la IA en su respuesta también puede mandar en el motor (el jugador de «a ese no lo vendo»)
    if (r && ((r.apuntadas || []).some((x) => x.corr && !dicho.includes(x)) || r.olvidadas)) { try { rehacer(); } catch (e) { /* se rehace en la siguiente pasada */ } }
    // (16 nov) si mientras pensaba te has ido a otra pestaña de la app, que sepas que ya está
    if (S.vista !== 'ia' && nativo.aLaVista()) tostada('Ya tienes la respuesta en Pregunta', 4000);
    // (con la IA de la app y la parte Android de la 0.8, el aviso lo pone Android: ia.js, preguntaAcabada)
    if (!nativo.aLaVista() && !(preguntasApp(enDemo()) && nativo.hayAvisoPregunta())) {
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
      // (antes solo salía una tostada de 7 s y la pregunta se quedaba sola en el chat, también al recargar: ahora vuelve
      // a la caja, con sus fotos, y el error se queda en el chat con «Volver a preguntar»)
      quitarUltimaPregunta(t);
      S.borrador = t;
      S.adjuntos = [...fotos, ...S.adjuntos].slice(0, MAX_FOTOS);
      if (e.clave) S.claveMal = true;
      // (16 nov) sin preguntas hoy con la IA de la app: el anuncio para 3 más (en la de Google Play); si no hay anuncio, lo dice
      // (25 nov, hallazgo 5) lo de Google Play, solo en un Android: en el iPhone y el ordenador, «Mañana tienes otras 3»
      else if (e.cupo && e.cupo.masConAnuncio && conAnuncios() && !extra) { S.anuncio = { para: 'pregunta', cupo: e.cupo, t }; setTimeout(() => hoja('anuncio', 'pregunta'), 0); }
      else S.errorChat = { t, n: fotos.length, msg: e.cupo ? `${e.message} ${e.cupo.masConAnuncio && !conAnuncios() && enAndroid() ? 'En la app de Google Play puedes sacar más viendo un anuncio corto.' : `Mañana tienes otras ${e.cupo.gratis}.`}` : (e.message || 'No ha contestado'), cupo: !!e.cupo };
      if (!nativo.aLaVista() && !(preguntasApp(enDemo()) && nativo.hayAvisoPregunta())) nativo.notificar('No ha podido contestar', e.message || 'Entra y vuelve a preguntar', 'ia');
    }
  } finally {
    if (S.chatCtl === ctl) S.chatCtl = null;
    S.preguntaActual = ''; S.fotosActuales = [];
    // (24 nov) con el plan de la IA aún en marcha no se apaga (lo mismo, al revés, en generarPlan)
    if (!(S.planEstado && S.planEstado.cargando)) nativo.trabajando(false);
  }
  S.charlando = false; S.parcial = '';
  if (S.vista === 'ia') pintar();
}

/**
 * (16 nov) la pregunta a la IA de la app que se quedó sin respuesta porque Android cerró la app: al abrirla (o al volver,
 * si no hay una pregunta en marcha) se recoge con su id, sin gastar otra. Si ya no está, la pregunta vuelve a la caja.
 */
async function recogerPregunta() {
  if (S.charlando || !S.D || !S.M || enDemo() || !preguntasApp(false) || !preguntaPendiente()) return;
  const p = preguntaPendiente();
  S.charlando = true; S.parcial = ''; S.pasoChat = 'Recogiendo la respuesta…'; S.preguntaActual = p.t; S.fotosActuales = []; S.errorChat = null;
  if (S.vista === 'ia') pintar();
  try {
    const r = await reanudarPregunta(S.D, S.M, S.c, { alPaso: (paso) => { S.pasoChat = paso; const el = $('#paso-chat'); if (el) el.textContent = paso; } });
    if (r && !nativo.aLaVista() && !nativo.hayAvisoPregunta()) nativo.notificar('Tu director deportivo ha contestado', 'Entra para leer la respuesta', 'ia');
  } catch (e) {
    // no se ha podido: la pregunta vuelve a la caja para mandarla otra vez
    quitarUltimaPregunta(p.t);
    S.borrador = p.t;
    S.errorChat = { t: p.t, n: 0, msg: e.message || 'No ha contestado' };
  } finally {
    S.charlando = false; S.parcial = ''; S.preguntaActual = '';
  }
  if (S.vista === 'ia' && !S.hoja) pintar();
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
  if (!puedeChat(enDemo())) { ir('ia'); tostada('Primero activa la IA con tu clave de Google'); return; }
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
/* ---------------- la entrada de la web: pegar y volver (0.8l) ---------------- */
// «Ya tengo la app» del ordenador: el QR se pide al desplegarlo y se deja de esperar al móvil al plegarlo
document.addEventListener('toggle', (ev) => {
  if (!ev.target || ev.target.id !== 'detApp') return;
  if (ev.target.open) iniciarQR(); else pararQR();
}, true);
// Pegar en el cuadro o en cualquier parte de la pantalla de entrar (Ctrl+V sin apuntar a nada) entra directamente, sin
// pulsar «Entrar». En otro cuadro (el del código de la app) no se toca nada.
document.addEventListener('paste', (ev) => {
  const campo = $('#vueltaWeb');
  if (!campo || enApp) return;
  const t = ev.clipboardData && ev.clipboardData.getData('text');
  if (!t || !t.trim()) return;
  const cuadro = ev.target && ev.target.closest && ev.target.closest('input, textarea, [contenteditable="true"]');
  if (cuadro && cuadro !== campo) return;
  // fuera del cuadro solo cuenta lo que parece la dirección; dentro, todo (si no vale, se dice por qué)
  if (!cuadro && !/code=|error=|jwt\.ms/i.test(t)) return;
  if (!cuadro && (campo.offsetParent === null)) { const d = campo.closest('details'); if (d) d.open = true; }
  ev.preventDefault();
  campo.value = t.trim();
  entrarConVuelta(t);
});
// lo que llega al cuadro sin pasar por «pegar» (soltar el enlace arrastrado, el dictado, un teclado que pega a su manera):
// si ya lleva el código, se entra solo; al escribir, se quita el error de antes
document.addEventListener('input', (ev) => {
  if (!ev.target || ev.target.id !== 'vueltaWeb') return;
  const v = ev.target.value;
  if (!v.trim()) { sinErrorVuelta(); return; }
  if (/^(insertFromPaste|insertFromDrop|insertFromYank)$/.test(ev.inputType || '') && mirarVuelta(v).url) entrarConVuelta(v);
  else if ($('#vueltaErr') && !$('#vueltaErr').hidden && mirarVuelta(v).url) sinErrorVuelta();
});
// al volver de la pestaña de LaLiga: el paso de pegar por delante, con el foco en su botón. Si el navegador ya tiene dado el
// permiso de leer lo copiado (Chrome y Edge, de una vez anterior), se mira solo y, si es la dirección, se entra sin tocar nada
async function alVolverEntrada() {
  if (enApp || !S.laLigaFuera || !S.laLigaIda || S.entrandoWeb || document.hidden || !$('#entrarDirecto')) return;
  S.laLigaIda = false;
  // (21 nov) cada gesto por separado: ha vuelto de la pestaña de LaLiga (una vez por cada vez que la abre)
  marcarVuelve();
  entradaAbierta({ alVolver: true });
  try {
    if (!hayPegar() || !navigator.permissions || !document.hasFocus()) return;
    const p = await navigator.permissions.query({ name: 'clipboard-read' });
    if (p.state !== 'granted') return;
    const t = await navigator.clipboard.readText();
    if (mirarVuelta(t).url) entrarConVuelta(t, { solo: true });
  } catch (e) { /* sin permiso o sin esa pregunta (Safari, Firefox): se pega con el botón */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.laLigaFuera) S.laLigaIda = true; } else alVolverEntrada(); });
window.addEventListener('blur', () => { if (S.laLigaFuera) S.laLigaIda = true; });
window.addEventListener('focus', () => { setTimeout(alVolverEntrada, 60); });
window.addEventListener('pageshow', () => { alVolverEntrada(); });

// pegar una captura (Ctrl+V) o arrastrarla encima del chat
document.addEventListener('paste', (ev) => {
  if (S.vista !== 'ia' || !puedeChat(enDemo()) || S.charlando) return;
  const fs = [...((ev.clipboardData && ev.clipboardData.files) || [])].filter((f) => /^image\//.test(f.type));
  if (!fs.length) return;
  ev.preventDefault();
  anadirFotos(fs, prepararArchivo);
});
document.addEventListener('dragover', (ev) => {
  if (S.vista !== 'ia' || !puedeChat(enDemo()) || !ev.dataTransfer || ![...ev.dataTransfer.types].includes('Files')) return;
  ev.preventDefault();
  document.body.classList.add('soltando');
});
document.addEventListener('dragleave', (ev) => { if (!ev.relatedTarget) document.body.classList.remove('soltando'); });
document.addEventListener('drop', (ev) => {
  document.body.classList.remove('soltando');
  if (S.vista !== 'ia' || !puedeChat(enDemo()) || !ev.dataTransfer) return;
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
  if (!puedeChat(enDemo())) { ir('ia'); tostada('Primero activa la IA con tu clave de Google'); return; }
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
  if (enApp && avisar && playDesfasada()) { tostada('Hay una versión nueva de la app en Google Play'); nativo.abrir(PLAY_URL); return; }
  if (enApp && avisar && iosDesfasada()) { tostada('Hay una versión nueva de la app en la App Store'); nativo.instalar(); return; }
  if (enApp && nativo.canal() === 'ios') { if (avisar) tostada('Las versiones nuevas llegan por la App Store'); return; }
  if (!enApp || nativo.canal() === 'play') { if (avisar) tostada(enApp ? 'Las versiones nuevas llegan por Google Play' : 'La web siempre está en la última versión'); return; }
  // el APK de GitHub ya no se publica: ni versión nueva ni descarga, solo el paso a Google Play (0.7.13j)
  if (enApkGithub()) { if (avisar) avisoPlay(true); return; }
  // la web nueva se baja sola (contesta webBuscada); el APK nuevo solo hace falta si ha cambiado la parte Android
  S.versionT = Date.now();
  const conAlDia = avisar ? nativo.buscarWeb() : !!nativo.estadoWeb();
  if (avisar) { S.buscaAvisar = conAlDia ? Date.now() : 0; tostada('Buscando versión nueva…', 2000); }
  const v = await ultimaVersion();
  const mia = nativo.huellaNativa();
  // (desde la 0.7.6, app.json lleva la huella de verdad en «huella»: la de «nativo» no casa a propósito, para que las
  // webs de antes enseñen «Actualizar» y las atascadas se pongan al día instalando la app)
  const hn = v && (v.huella || v.nativo);
  const hace = v && v.version > nativo.version() && !(mia && hn && hn === mia);
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
  if ($('#limite') || $('#forzar')) return true;
  // (20 nov) con una novedad en pantalla (la tarjeta o la presentación) no se recarga: se la llevaba por delante
  if ($('.nvt-capa') || $('.nv')) return false;
  if (S.cargando || (S.planEstado || {}).cargando || S.chatCtl || tourAbierto()) return false;
  if ([...document.querySelectorAll('textarea, input[type="text"], input:not([type])')].some((e) => e.value && e.value.trim())) return false;
  if (!S.D) return true;
  return alVolver || (Date.now() - arranqueT < 25000 && !S.hoja);
}
function ponerWebNueva() {
  LS.set('web-puesta', { t: Date.now() });
  guardarVuelta();
  location.reload();
}
window.webBuscada = (estado) => {
  apuntarAlDia(estado);
  const avisar = S.buscaAvisar && Date.now() - S.buscaAvisar < 120000;
  S.buscaAvisar = 0;
  // (0.8.4r) la que se está poniendo sola: con la web bajada se recarga en cuanto no haya nada a medias; si AlDia no
  // puede, la ventana de siempre con lo que ha pasado
  if (S.sola && S.sola.modo === 'app' && S.sola.fase === 'bajando') {
    if (estado === 'ocupada') return;
    clearTimeout(forzarT);
    S.sola.fase = 'espera';
    if (estado === 'nueva' || (estado === 'igual' && S.webNueva)) { S.webNueva = true; intentarSola(document.hidden); return; }
    if (estado === 'parada') { S.sola = null; S.appNueva = null; return; }
    S.sola = null;
    if (S.appNueva) forzarAppNueva(estado === 'apk' && !S.appNueva.play ? 'apk' : 'fallo', String(estado).startsWith('error') ? String(estado).slice(7) : estado === 'igual' ? 'la descartó antes' : '');
    return;
  }
  if (estado === 'nueva') {
    S.webNueva = true;
    if (S.sola) { intentarSola(document.hidden); return; }
    if (sePuedeRecargar()) ponerWebNueva();
    else { if (S.D && !S.hoja) pintar(); if (avisar) tostada('Hay una versión nueva: toca «Descargar»'); }
    return;
  }
  // con la ventana de versión nueva: lo que no sea «nueva» es que AlDia no la va a poner (salvo «ocupada», que contestará)
  if (S.appNueva && $('#forzar')) {
    if (estado === 'parada') { $('#forzar').remove(); S.appNueva = null; return; }
    if (estado === 'ocupada') return;
    if (estado === 'igual' && S.webNueva) { ponerWebNueva(); return; }
    if (S.appNueva.paso !== 'apk') forzarAppNueva(estado === 'apk' && !S.appNueva.play ? 'apk' : 'fallo', String(estado).startsWith('error') ? String(estado).slice(7) : estado === 'igual' ? 'la descartó antes' : '');
    return;
  }
  if (!avisar) return;
  if (String(estado).startsWith('error')) tostada(`No se ha podido mirar si hay versión nueva (${String(estado).slice(7)})`, 5000);
  else if (!S.nueva) tostada('Tienes la última versión');
};
document.addEventListener('visibilitychange', () => {
  // (0.8.4r) al irse a segundo plano, el mejor momento para ponerla: al volver ya está
  if (document.hidden) { fueraT = Date.now(); if (S.sola) intentarSola(true); return; }
  if (S.webNueva && fueraT && Date.now() - fueraT > 60000 && sePuedeRecargar(true)) ponerWebNueva();
});
// por si llegó en mal momento (cargando la liga, la IA trabajando): se vuelve a mirar cada poco
setInterval(() => { if (S.sola) { if (!document.hidden) intentarSola(); return; } if (S.webNueva && sePuedeRecargar()) ponerWebNueva(); }, 10000);
window.progresoApp = (pct, estado) => {
  if (pct < 0) tostada(`No se ha podido descargar: ${estado}`, 5000);
  else if (estado === 'permiso') tostada('Dale permiso para instalar y vuelve a pulsar Actualizar', 6000);
  else if (estado === 'instalar') tostada('Instalando…');
  else tostada(`Descargando la versión nueva… ${pct} %`, 1500);
};
// (23 nov) de vuelta de los ajustes del móvil (las notificaciones se activan ahí): lo de debajo de «Preparando tu plan», al día
window.addEventListener('fm-vuelta', () => { const pn = $('#plan-notif'); if (pn) pn.innerHTML = V.notifPlanHTML(); });
window.permisoAvisos = (ok) => {
  // (23 nov) si Android ya no enseña la pregunta (dicho que no dos veces), contesta que no al momento: se dice dónde se activan
  // (25 nov) en el iPhone están en otro sitio (y la app lleva allí si se vuelve a pulsar)
  if (!ok) tostada(`Sin permiso de notificaciones no te llegan los avisos ni el plan con la app cerrada. Actívalas en los ajustes del ${nativo.canal() === 'ios' ? 'iPhone: Notificaciones → Fantasy Manager' : 'móvil: Aplicaciones → Fantasy Manager → Notificaciones'}`, 7000);
  else { if (S.D) programar(S.D, S.M, planAvisos()); tostada('Notificaciones activadas'); }
  // lo de debajo de «Preparando tu plan», con el permiso nuevo
  const pn = $('#plan-notif');
  if (pn) pn.innerHTML = V.notifPlanHTML();
  repintarHoja();
  mirarLimite();
};

/* ---------------- «Quién usa la app»: buscar y filtrar las cuentas (21 nov) ---------------- */
function filtrarQuien() {
  const l = $('#qLista');
  if (!l) return;
  const q = norm((($('#qBuscar') || {}).value || '').trim()), f = l.dataset.filtro || '';
  let n = 0;
  l.querySelectorAll('.quien-f').forEach((r) => { const ok = (!q || (r.dataset.b || '').includes(q)) && (!f || (r.dataset.f || '').split(' ').includes(f)); r.hidden = !ok; if (ok) n++; });
  // los títulos de cada grupo, solo si les queda alguna fila a la vista; con filtro o búsqueda, fuera lo que no son filas
  l.querySelectorAll('.quien-l').forEach((g) => { const vacio = !g.querySelector('.quien-f:not([hidden])'); g.hidden = vacio; const t = g.previousElementSibling; if (t && t.classList.contains('grupo')) t.hidden = vacio; });
  l.querySelectorAll('.q-no, .q-prog').forEach((e) => { e.hidden = !!(q || f); });
  const c = $('#qCuenta'); if (c) c.textContent = String(n);
  const nada = $('#qNada'); if (nada) nada.hidden = n > 0;
}
document.addEventListener('input', (ev) => { if (ev.target && ev.target.id === 'qBuscar') filtrarQuien(); });

/* ---------------- la vuelta del inicio de sesión ---------------- */
window.vueltaLogin = async () => {
  const url = nativo.loginPendiente();
  if (!url) return;
  // ha vuelto con la dirección de LaLiga: ya no hay que preguntar «¿No has vuelto solo?»
  sinLoginFuera();
  // por dónde ha llegado (Auth Tab o el intent de siempre), para el diagnóstico
  LS.set('login-via', { via: nativo.loginVia(), t: Date.now() });
  S.entrandoApp = true;
  raiz().innerHTML = `<div class="pantalla cargando">${LOGO}<h1 style="font-size:42px">Entrando…</h1></div>`;
  // (0.7.13i) si entra o en qué falla, sin cuenta (semaforo.js): los fallos de la carga de después no cuentan aquí
  try { await terminarLogin(url); } catch (e) { S.entrandoApp = false; marcarPaso(pasoDeFallo(e)); apuntarFalloEntrada(e, url); pantallaEntrar(e.message || String(e)); return; }
  S.entrandoApp = false;
  marcarPaso('ok');
  try {
    contar('e');
    mirarCuentaNueva();
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
/* iPhone, en el navegador: desde iOS 26, Safari a veces deja la barra de abajo (que es fija) a media pantalla al hacer
   scroll, sobre todo después de cerrar el teclado (un fallo de WebKit que sigue en la beta de iOS 27; aviso de Domy del
   29 oct; en el foro de Apple: tras cerrar el teclado, visualViewport.height se queda más bajo que innerHeight). Si la
   barra, o lo que Safari dice que se ve, acaba bastante más arriba que el alto de la ventana, se baja la barra hasta
   abajo con --ios-dy (también la caja del chat, las hojas y los avisos de abajo). Con el teclado abierto no se toca. */
function vigilarBarraIOS() {
  const vv = window.visualViewport;
  // (25 nov) la app de iOS lleva el mismo motor que Safari: ahí también
  if (!vv || (enApp && nativo.canal() !== 'ios') || movilDe() !== 'iphone') return;
  let dy = 0, pend = false;
  const campo = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };
  const ajustar = () => {
    pend = false;
    const nav = $('.nav');
    let nuevo = 0;
    if (nav && nav.offsetHeight && !campo() && getComputedStyle(nav).position === 'fixed') {
      // (dónde la pone Safari sin el arreglo y dónde acaba lo que dice que se ve: con el fallo, una de las dos se queda
      // a la altura del teclado y window.innerHeight sigue siendo el alto de verdad)
      const sin = nav.getBoundingClientRect().bottom - dy, vista = vv.offsetTop + vv.height;
      const d = Math.round(window.innerHeight - Math.min(sin, vista));
      if (d > 40 && d < window.innerHeight * 0.75) nuevo = d;
    }
    if (nuevo !== dy) { dy = nuevo; document.documentElement.style.setProperty('--ios-dy', `${dy}px`); }
  };
  const pedir = () => { if (!pend) { pend = true; requestAnimationFrame(ajustar); } };
  vv.addEventListener('resize', pedir);
  vv.addEventListener('scroll', pedir);
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('focusin', pedir);
  window.addEventListener('focusout', () => setTimeout(() => {
    if (campo()) return;
    // (el empujón de siempre para que Safari vuelva a colocar lo fijo al cerrar el teclado)
    const y = window.scrollY;
    window.scrollTo(window.scrollX, y + 1); window.scrollTo(window.scrollX, y);
    pedir();
  }, 150));
  pedir();
}
vigilarBarraIOS();
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
// deslizar de lado sobre la pantalla pasa a la pestaña de abajo de al lado, sin pasar por las subpestañas (Carlos, 9 nov
// 15:24 y 15:30: «solo las pestañas grandes»). No desde los bordes (ahí está el «atrás» de Android) ni en el ordenador
let desliz = null;
document.addEventListener('touchstart', (e) => {
  desliz = null;
  if (e.touches.length !== 1 || S.hoja || !S.D || V.ancho()) return;
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
  const paso = dx < 0 ? 1 : -1;
  const nav = $$('.nav button[data-ir]');
  const j = nav.findIndex((b) => b.dataset.ir === S.vista);
  if (j < 0 || !nav[j + paso]) return;
  nativo.toque();
  nav[j + paso].click();
  const v = $('#vista');
  if (v) { v.classList.remove('entra-d', 'entra-i'); void v.offsetWidth; v.classList.add(paso > 0 ? 'entra-d' : 'entra-i'); }
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
  // (0.7.13i) el botón de Google Play de la web, sin cuenta: una vez al día
  if (!enApp && !haySesion() && ev.target.closest && ev.target.closest('a[href*="play.google.com/store/apps/details"]')) {
    marcarPaso('play', { una: true });
    // (25 nov, tanda 6) quien llegó con el código de un amigo: cualquier botón de Google Play lo lleva en el referrer, para
    // que la app lo recoja al instalarse (no solo «Copiar el código y descargar»)
    const a = ev.target.closest('a[href*="play.google.com/store/apps/details"]'), cp = codigoPendiente();
    if (cp && a && !/[?&]referrer=/.test(a.getAttribute('href') || '')) a.setAttribute('href', playConCodigo(a.getAttribute('href'), cp));
  }
  const el = ev.target.closest('[data-accion],[data-ir],[data-j],[data-r],[data-club],[data-seg],[data-filtro],[data-abrir],[data-sugerencia]');
  if (!el) return;
  const d = el.dataset;
  if (d.abrir) { ev.preventDefault(); nativo.abrir(d.abrir); return; }
  if (d.sugerencia) { enviarPregunta(d.sugerencia); return; }
  if (d.seg) { const [v, s] = d.seg.split(':'); S.seg[v] = s; if (!d.ir) { pintar(); volverAPestanas(); return; } }
  if (d.filtro) { const [k, f] = d.filtro.split(':'); S.filtro[k] = f; pintar(); return; }
  // dentro del resumen de una tarjeta que se despliega (los pasos del plan), abrir la ficha sin desplegarla
  if (d.j && S.D && !d.accion) { if (el.closest('summary')) ev.preventDefault(); hoja('j', d.j, pilaDesde(el, 'j', d.j)); cargarDetalle(d.j); return; }
  if (d.club && S.D && !d.accion) { S.segClub = null; hoja('c', d.club, pilaDesde(el, 'c', d.club)); cargarClub(d.club); return; }
  if (d.r && S.D) { S.segRival = null; hoja('r', d.r, pilaDesde(el, 'r', d.r)); cargarOnceRival(d.r); return; }
  if (d.ir && !d.accion) {
    // (0.8) cambiar de pestaña con la barra de abajo es una pausa natural (a Pregunta, no: va a escribir)
    const pausa = !!el.closest('.nav') && d.ir !== 'ia' && (ALIAS[d.ir] || d.ir) !== S.vista && !S.hoja;
    cerrarHoja(); ir(d.ir);
    if (pausa) pausaNatural();
    return;
  }
  switch (d.accion) {
    case 'verPartido': cargarPartido(Number(d.n), d.id); hoja('p', `${d.n}:${d.id}`, pilaDesde(el, 'p', `${d.n}:${d.id}`)); break;
    case 'volverHoja': volverHoja(); break;
    // (Carlos, 9 nov 12:29) plegar una fase del plan: el <details> se abre o cierra solo; aquí se recuerda
    // (21) plegar una sección de la pestaña Parón: igual, se recuerda mientras dura el parón
    // (el selector Suben / Bajan de la pestaña Parón: sin repintar, para no saltar arriba)
    case 'pnzLado': { const m = el.closest('.pnz-mer'); S.seg.pnzliga = d.f; if (m) { m.classList.toggle('lado-sube', d.f !== 'baja'); m.classList.toggle('lado-baja', d.f === 'baja'); m.querySelectorAll('.pnz-mer-sel button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.f === d.f))); } break; }
    case 'pnzVer': { const l = el.closest('.pnz-mer-l'); S.seg.pnzver = d.f; if (l) { l.classList.toggle('ver-tu', d.f !== 'liga'); l.classList.toggle('ver-liga', d.f === 'liga'); l.querySelectorAll('.pnz-ver button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.f === d.f))); } break; }
    case 'plegarParon': { const det = el.closest('details'); if (det && S.M) Pz.plegarParon(S.M, d.f, !det.open); break; }
    // (37) los avisos de la ficha del jugador: se recuerda cuáles has abierto para no cerrarlos al repintar
    case 'plegarAviso': { const det = el.closest('details'); if (det) plegarAviso(S, d.k, !det.open); break; }
    case 'plegarFase': { const det = el.closest('details'); if (det && S.plan) V.plegarFase(S.plan, d.f, !det.open); break; }
    case 'quitarUrgente': { const q = LS.get(K('urgentes-quitados'), {}), hoyD = diaDe(); for (const k of Object.keys(q)) if (q[k] !== hoyD) delete q[k]; q[d.k] = hoyD; LS.set(K('urgentes-quitados'), q); tostada('Quitado hasta mañana'); pintar(); break; }
    case 'sustituto': if (S.M && S.M.J(d.pid)) hoja('sust', d.pid, pilaDesde(el, 'sust', d.pid)); break;
    // (22 nov) las bajas de la jornada: la cruz de Clubes, «pueden jugar» de Equipo y las pestañas de la hoja. Al cambiar de
    // pestaña se queda la pila; la lesión y la vuelta (bajas/partes.json) se piden al abrirla y, si llegan nuevas, se repinta
    case 'bajas': {
      if (!S.M) break;
      const yaAbierta = S.tipoHoja && S.tipoHoja[0] === 'bajas' && el.closest('.hoja');
      if (yaAbierta) { S.tipoHoja = ['bajas', d.v]; repintarHoja(); S.hoja.scrollTop = 0; } else hoja('bajas', d.v || 'todas', pilaDesde(el, 'bajas', d.v));
      Bj.cargarPartes().then((nuevo) => { if (nuevo && S.tipoHoja && S.tipoHoja[0] === 'bajas') repintarHoja(); }).catch(() => {});
      break;
    }
    case 'verJornada': S.jornadaSel = Number(d.n); pintar(); break;
    case 'ordenEq': S.ordenEq = d.o; LS.set('orden-equipo', d.o); pintar(); if (d.ver) { const o = $('#vista .eq2-orden'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
    case 'jorClub': (S.jorClub ||= {})[d.id] = Number(d.n); repintarHoja(); break;
    // las pestañas de la ficha de un club (Carlos, 9 nov): al cambiar, si estabas más abajo, vuelve a ellas
    case 'segClub': {
      S.segClub = { id: d.id, seg: d.s }; repintarHoja();
      const hero = S.hoja && S.hoja.querySelector('.club-hero');
      if (hero) { const y = hero.offsetTop + hero.offsetHeight; if (S.hoja.scrollTop > y) S.hoja.scrollTop = y; }
      break;
    }
    case 'perClub': S.perClub = d.p; repintarHoja(); break;
    // las pestañas de la ficha de un rival (Carlos, 13 nov, punto 50), como las del club: al cambiar, vuelve a ellas
    case 'segRival': case 'subRival': {
      const prev = S.segRival && String(S.segRival.tid) === String(d.tid) ? S.segRival : {};
      S.segRival = d.accion === 'segRival' ? { tid: d.tid, seg: d.s, sub: d.p } : { ...prev, tid: d.tid, sub: d.p };
      repintarHoja();
      const t = S.hoja && S.hoja.querySelector('.rival-tabs');
      if (t && S.hoja.scrollTop > t.offsetTop) S.hoja.scrollTop = t.offsetTop;
      break;
    }
    case 'filtroClub': S.filtro.club = d.f; repintarHoja(); if (d.sel) bajarA(d.sel, S.hoja); break;
    // ir a lo que explica un dato (30 oct, Carlos: «el valor de los últimos 7 días debería llevarte a la pestaña adecuada»):
    // baja hasta el ancla (data-sel), en la ficha abierta o en la pestaña; con data-seg2, antes cambia de subpestaña
    case 'ver': {
      const raiz = el.closest('.hoja');
      if (d.seg2) { const [v, s2] = d.seg2.split(':'); if (S.seg[v] !== s2) { S.seg[v] = s2; pintar(); } }
      // (0.7.7) si el bloque va plegado en la ficha, se abre antes de bajar hasta él
      { const pl = (raiz || document).querySelector(d.sel); if (pl && pl.tagName === 'DETAILS') pl.open = true; }
      bajarA(d.sel, raiz);
      break;
    }
    // los de un puesto, en Equipo → Plantilla (desde los POR 2, DEF 4… de debajo del once)
    case 'verPuesto': S.seg.equipo = 'plantilla'; S.ordenEq = 'puesto'; cerrarHoja(); if (S.vista !== 'equipo') ir('equipo'); else pintar(); bajarA(`#eq-pos-${d.p}`); break;
    // tu once y tus puntos de una jornada, en Equipo → Jornadas
    case 'irJornada': S.seg.equipo = 'jornadas'; S.jornadaSel = Number(d.n); cerrarHoja(); ir('equipo'); break;
    // (24 nov) el once de un mánager en una jornada acabada, con lo que sumó cada uno (desde Rivales → Por jornada)
    case 'onceJ': {
      const arg = `${d.t}:${Number(d.n)}`;
      if (S.hoja && S.tipoHoja && S.tipoHoja[0] === 'oj') { S.tipoHoja = ['oj', arg]; repintarHoja(); } else hoja('oj', arg, pilaDesde(el, 'oj', arg));
      cargarOnceJornada(String(d.t), Number(d.n));
      break;
    }
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
    // (21 nov) la app de Android: la primera vez en este móvil, antes de abrir LaLiga, el aviso de «Abrir con» como paso
    // propio (con Auth Tab Android no pregunta: directo). «Le da a entrar» se apunta cuando de verdad se abre LaLiga
    case 'entrar':
      if (enApp && !abrirConVisto() && !nativo.authTab()) { pantallaAbrirCon(); break; }
      if (enApp) { await abrirLaLigaApp(); break; }
      try { contar('l'); marcarPaso('l'); await empezarLogin(); } catch (e) { pantallaEntrar(e.message); }
      break;
    case 'entrarYa': await abrirLaLigaApp(); if ($('.pant-aviso')) pantallaEntrar(); break;
    case 'volverEntrar': pantallaEntrar(); break;
    // (21 nov) el iPhone dentro del navegador de otra app: el enlace x-safari-https:// lo abre el sistema; aquí se apunta
    // y, si a los 2 s la página sigue a la vista (Safari no se ha abierto), se dice qué hacer y se dejan los pasos de aquí
    case 'aSafari':
      marcarPaso('saf');
      relojFijo(2000, () => {
        if (document.hidden) return;
        const n = $('#edSafariNo'); if (n) n.textContent = 'Si Safari no se ha abierto, usa el menú de la app o entra aquí mismo con los pasos de abajo.';
        const d = $('.ed-safari-mas'); if (d) d.open = true;
      });
      break;
    case 'sesionASafari': await sesionASafari(el); break;
    case 'pasarAInicio': await pasarAInicio(el); break;
    case 'cerrarInicio': { LS.set('inicio-visto', true); const b = $('.banda-inicio'); if (b) b.remove(); if (S.tipoHoja && S.tipoHoja[0] === 'vinculo') cerrarHoja(true); break; }
    // (0.8l) en la web «Abrir LaLiga» es un enlace de verdad: lo abre el navegador y aquí solo se apunta. Si el enlace aún
    // no estuviera puesto (se rellena en milisegundos), se abre como antes
    case 'abrirLaLiga': case 'abrirAMano': {
      const listo = !!el.getAttribute('href');
      if (!listo) ev.preventDefault();
      contar('l'); marcarPaso('l');
      sinErrorVuelta();
      S.laLigaFuera = true;
      LS.set('ll-abierta', Date.now());
      if (!listo) { try { await empezarLogin(); } catch (e) { errorVuelta('No se ha podido abrir la página de LaLiga. Recarga esta página y vuelve a probar.'); break; } }
      marcarAbierto();
      entradaAbierta();
      break;
    }
    case 'copiarWeb': copiarY(DOMINIO, 'Copiada: pégala en tu navegador'); break;
    case 'mirarEstado': pintarEstado(true); break;
    case 'entrarDemo': { if (!haySesion()) marcarPaso('demo', { una: true }); const entrar = () => { cerrarHoja(true); LS.set('demo', true); S.D = null; S.planEstado = {}; cargar(); }; if (!trasCargar(entrar)) entrar(); break; }
    case 'usarCodigo': {
      const cod = (($('#codigoWeb') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cod.length !== 8) { errorCodigo(cod.length ? `El código tiene 8 letras y números (llevas ${cod.length})` : 'Escribe el código de 8 letras y números', el); break; }
      el.disabled = true; el.textContent = 'Entrando…';
      const pe = $('#codigoErr'); if (pe) pe.hidden = true;
      try {
        const { r, j } = await traerConCodigo(cod);
        if (!r.ok || !j || !j.sesion) throw new Error((j && j.e) || `El servidor de la web responde ${r.status}`);
        await entrarConVinculo(j);
      } catch (e) { errorCodigo(e.name === 'TypeError' ? 'No hay conexión con el servidor de la web. Mira que tengas internet y vuelve a probar.' : e.message || String(e), el); }
      break;
    }
    case 'pegarYEntrar': {
      // el toque da permiso para leer lo copiado (en el iPhone sale el globo «Pegar»: se toca y ya); si el navegador no deja
      // o se dice que no, se pega a mano en el cuadro. readText va lo primero, dentro del toque
      let t = null;
      try { t = await navigator.clipboard.readText(); } catch (e) { t = null; }
      if (t == null) {
        errorVuelta(movilDe() ? 'No he podido leer lo copiado. Pégalo tú: mantén pulsado el cuadro de aquí arriba y elige Pegar.' : 'No he podido leer lo copiado. Pégalo tú: haz clic en el cuadro de aquí arriba y pulsa Ctrl + V (en Mac, Cmd + V).');
        const c = $('#vueltaWeb'); if (c) c.focus();
        break;
      }
      if (!t.trim()) { marcarPaso('m-vacio'); errorVuelta('No tienes nada copiado. Copia primero la dirección de la página en la que acabas al entrar en LaLiga (paso 2).'); break; }
      await entrarConVuelta(t);
      break;
    }
    case 'pegarVuelta': await entrarConVuelta((($('#vueltaWeb') || {}).value || '')); break;
    case 'vincularWeb': {
      // la app deja la sesión en el Worker y enseña el código para escribirlo en la web
      el.disabled = true;
      try {
        const datos = datosVinculo();
        // en la app por la parte nativa; en la web, directo al Worker (no pasa por su reenvío)
        const mandar = (cuerpo) => (enApp
          ? http('POST', `${WORKER_PUBLICO}/vincular`, { cabeceras: { 'content-type': 'application/json' }, cuerpo: JSON.stringify(cuerpo), tiempo: 20000 })
          : fetch(`${WORKER_PUBLICO}/vincular`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(async (x) => ({ s: x.status, b: await x.text() }), (e) => ({ s: 0, e: e.message })));
        const r = await dejarConCodigo(datos, mandar);
        let j = null;
        try { j = JSON.parse(r.b || 'null'); } catch (e2) { j = null; }
        if (r.s !== 200 || !j || !j.codigo) throw new Error(j && j.e ? j.e : r.s ? `el servidor de la web responde ${r.s}` : `sin conexión (${r.e})`);
        S.vinculo = j;
        hoja('vinculo');
      } catch (e) { tostada(`No se ha podido sacar el código: ${e.message}`, 6000); el.disabled = false; }
      break;
    }
    case 'escanearQR':
      if (!nativo.hayQR()) { tostada('Para escanear el QR, instala la última versión de la app. Mientras, usa el código.', 6000); break; }
      nativo.escanearQR();
      break;
    case 'otroQR': iniciarQR(); break;
    case 'instalarPc': instalarPc(el); break;
    case 'copiarEnlaceWeb': copiarY('https://fantasymanagerapp.com/', 'Enlace copiado'); break;
    case 'mudarse': mudarse(el); break;
    case 'bienvenidaOk': cerrarBienvenida(); break;
    case 'bienvenidaReportar': cerrarBienvenida(); abrirAvisos('mios'); break;
    case 'cerrarLleno': olvidarLleno(); el.closest('.banda')?.remove(); break;
    case 'salirDemo': salirDemo(); break;
    case 'salir': if (confirm('¿Cerrar la sesión de LaLiga en esta app?')) { cerrarSesion(); cerrarHoja(true); S.D = null; programar(null, null); pantallaEntrar(); } break;
    case 'recargar': sinErrorPlan(); forzarOnce = true; cargar(); break;
    case 'usarGuardado': usarGuardado(); break;
    case 'ajustes': {
      S.ajBusca = '';
      const aApodos = apodosToca();
      if (aApodos) { LS.set('apodos-visto', 1); S.ajAbiertas = { ...(S.ajAbiertas || {}), apodos: 1 }; S.apodosUnaVez = true; } else if (S.apodosUnaVez && S.ajAbiertas) { delete S.ajAbiertas.apodos; S.apodosUnaVez = false; }
      hoja('ajustes');
      marcarApodos();
      if (aApodos) requestAnimationFrame(() => { const sec = S.hoja && S.hoja.querySelector('details[data-k="apodos"]'); if (sec) { S.hoja.scrollTop = Math.max(0, sec.offsetTop - 70); sec.classList.add('resalta'); } });
      break;
    }
    case 'apodoEditar': S.apodoEdita = String(d.tid); repintarHoja(); requestAnimationFrame(() => { const i = $('#apodoIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); break;
    case 'apodoGuardar': {
      const i = $('#apodoIn'), l = ponerApodo(d.tid, i ? i.value : '');
      S.apodoEdita = null; repintarHoja();
      tostada(l.length ? `Hecho: la IA lo reconocerá como ${l.map((x) => `«${x}»`).join(', ')}` : 'Apodo quitado');
      break;
    }
    case 'diag': hoja('diag'); break;
    case 'mandarFallo': abrirAvisos('mios'); break;
    case 'avisos': abrirAvisos(); break;
    case 'pestAvisos': {
      if (!S.av) break;
      S.av.pest = d.p === 'mios' ? 'mios' : 'todos';
      if (S.av.pest === 'mios') marcarMisLeidas();
      repintarAvisos();
      const ho = $('.hoja'); if (ho) ho.scrollTop = 0;
      break;
    }
    case 'cerrarBeta': LS.set('beta-cerrada', Date.now()); el.closest('.banda')?.remove(); break;
    case 'cerrarSinDescarga': LS.set('aldia-red-cerrada', diaDe()); el.closest('.banda')?.remove(); break;
    case 'quienUsa': cerrarHoja(true); abrirQuien(); break;
    // la etiqueta BETA del logo: al dueño le abre Quién usa la app (los fallos los mira en Ajustes); a los demás, Fallos e ideas
    case 'beta': if (avisosGuardados().admin && !enDemo()) { cerrarHoja(true); abrirQuien(); } else abrirAvisos('mios'); break;
    // (21 nov) la lista de cuentas de «Quién usa la app»: los filtros (y las chapas de arriba, que además bajan a la lista)
    // (21 nov, noche) las pestañas de «Quién usa la app»: Hoy, Uso, Entrada, Invitar y Cuentas
    case 'quienTab': {
      if (!S.quien || S.quien.tab === d.t) break;
      S.quien.tab = d.t;
      repintarHoja(); if (S.hoja) S.hoja.scrollTop = 0;
      filtrarQuien();
      break;
    }
    case 'quienFiltro': {
      if (S.quien) S.quien.filtro = d.f || '';
      // el aviso de problemas de Hoy: a Cuentas, ya filtrada
      if (d.irCuentas && S.quien && S.quien.tab !== 'cuentas') { S.quien.tab = 'cuentas'; repintarHoja(); if (S.hoja) S.hoja.scrollTop = 0; filtrarQuien(); break; }
      const l = $('#qLista'); if (l) l.dataset.filtro = d.f || '';
      document.querySelectorAll('.q-filtros button').forEach((b) => { const on = (b.dataset.f || '') === (d.f || ''); b.classList.toggle('activo', on); b.setAttribute('aria-pressed', String(on)); });
      filtrarQuien();
      break;
    }
    case 'bloqueada': {
      // en la de Google Play se abren viendo un anuncio
      if (topConAnuncio()) {
        // (0.7.12) el dinero, por rival: desde la elección de rival se vuelve a donde estabas, no a la elección
        const prev = S.tipoHoja && S.tipoHoja[0] === 'anuncio' && S.anuncio ? S.anuncio.volver : (S.tipoHoja && S.tipoHoja[0] !== 'anuncio' ? [...S.tipoHoja] : null);
        S.anuncio = { para: 'top', clave: d.clave, como: d.como || null, rival: d.rival != null ? String(d.rival) : null, volver: prev };
        hoja('anuncio', 'top'); break;
      }
      // (25 nov, hallazgo 11) es una ficha más ('bloq'): abierta desde la de un rival, «Entendido» y el atrás vuelven a él
      const arg = `${d.clave}|${d.como || ''}`;
      hoja('bloq', arg, pilaDesde(el, 'bloq', arg));
      break;
    }
    case 'mandarAviso': enviarAviso(); break;
    case 'capturaAviso': repintarAvisos(); elegirCapturas(); break;
    // (0.8.4) la conversación de un aviso
    case 'abrirHilo': abrirHilo(d.id); break;
    case 'escribirHilo': escribirHilo(d.id); break;
    case 'capturaHilo': repintarAvisos(); elegirCapturas('hilo'); break;
    case 'quitarCapturaHilo': if (S.av && S.av.capHilo) { repintarAvisos(); S.av.capHilo.splice(Number(d.i), 1); repintarAvisos(); } break;
    case 'verCapturaHilo': { const c = S.av && S.av.capHilo && S.av.capHilo[Number(d.n)]; if (c) verImagen(c.url, `Captura ${Number(d.n) + 1}`); break; }
    case 'quitarCaptura': if (S.av && S.av.capturas) { S.av.capturas.splice(Number(d.i), 1); repintarAvisos(); } break;
    case 'verCaptura': {
      const n = Number(d.n);
      if (d.id) { const l = S.av && S.av.capt && S.av.capt[`${d.id}:${Number(d.m) || 0}`]; if (l && l[n]) verImagen(l[n], `Captura ${n + 1}`); } else if (S.av && S.av.capturas && S.av.capturas[n]) verImagen(S.av.capturas[n].url, `Captura ${n + 1}`);
      break;
    }
    case 'tutorial': lanzarTutorial(); break;
    case 'permisoApertura': if (!cfgAvisos().on) guardarCfgAvisos({ on: true }); nativo.pedirPermisoAvisos(); break;
    // (23 nov) desde «Preparando tu plan»: solo el permiso, sin encender las alarmas del móvil
    case 'permisoPlan': nativo.pedirPermisoAvisos(); break;
    case 'abrirAviso': abrirAvisoRecibido(d.id); break;
    case 'responderAviso': contestarAviso(d.id); break;
    case 'copiarAvisos': copiarAvisosClaude(); break;
    case 'copiarParaClaude': if (S.av && S.av.paraClaude) copiarY(S.av.paraClaude); break;
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
    // (el toque que acaba un arrastre que no llegó a cerrar no cuenta como tocar el asa)
    case 'cerrarHoja': if (S.tipoHoja && S.tipoHoja[0] === 'bloq' && S.pila && S.pila.length && !(el && el.classList.contains('asa'))) { volverHoja(); break; }
      if (!(el && el.classList.contains('asa') && Date.now() - arrastreFin < 400)) { const t = S.tipoHoja && S.tipoHoja[0]; if (cerrarHoja() && FICHAS_PAUSA.has(t)) pausaNatural(); } break;
    case 'paron': if (S.M && S.M.paron) tostada(`${S.M.paron.nombre || 'Parón de selecciones'}: del ${cuandoT(S.M.paron.ini, { hora: false })} al ${cuandoT(S.M.paron.fin, { hora: false })}. No hay jornada y los valores casi no se mueven: lo que vayas a vender, mejor antes.`, 7000); break;
    case 'irIA': cerrarHoja(); ir('ia'); break;
    // (iOS 3) el permiso para mandar tu liga a la IA (Pregunta y Ajustes → La IA)
    case 'permisoIA': pedirPermisoIA(null, () => { if (S.hoja) repintarHoja(); pintar(); }); break;
    case 'quitarPermisoIA': ponerPermisoIA(false); if (S.hoja) repintarHoja(); pintar(); tostada('La IA, apagada: no se le manda nada'); break;
    // la estrella de la ficha: lo sigue en Mercado → Favoritos (y las listas lo marcan)
    case 'fav': { const j = S.M && S.M.J(d.pid); if (!j) break; const on = cambiarFav(d.pid); tostada(on ? `${j.nombre}, en tus favoritos (Mercado → Favoritos)` : `${j.nombre}, fuera de tus favoritos`, 2600); repintarHoja(); if (S.vista === 'mercado') pintar(); break; }
    case 'copiarDiag': copiarY(Hj.diagnosticoParaMandar(S)); break;
    case 'compartirDiag': nativo.compartir(Hj.diagnosticoParaMandar(S)); break;
    // (con la IA de la app, por pedirOtroPlan: mira antes si quedan planes hoy)
    case 'plan': if (planesApp(enDemo())) pedirOtroPlan(); else { S.planEstado = {}; generarPlan(); } break;
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
    case 'privAnuncios': if (enApp) nativo.privacidadAnuncios(); else privacidadWeb(); break;
    case 'voz': escuchar(); break;
    case 'pararPlan': if (S.planCtl) S.planCtl.abort(); break;
    case 'pararChat': if (S.chatCtl) S.chatCtl.abort(); break;
    case 'repreguntar': { const ta = $('#pregunta'); const t = ta ? ta.value : (S.errorChat && S.errorChat.t) || ''; if (ta) ta.value = ''; S.errorChat = null; enviarPregunta(t); break; }
    case 'resumen': if (S.D) { hoja('resumen'); encuadrar(S.hoja); valoresMios(); } break;
    case 'novedades': if (avisosGuardados().admin || novedadesPara({ ligas: (S.D && S.D.ligas) || [] }) === true) listaVersiones(); else if (importantesPara() && hayImportantes()) listaImportantesHoja(); break;
    case 'presentacion': cerrarHoja(true); verNovedades(null); break;
    case 'borrarNota': borrarNota(d.id); tostada('Olvidado'); if (S.D) rehacer(); if (S.hoja) repintarHoja(); else pintar(); break;
    // (0.8.4o) lo que te ha dicho un rival que tiene: la hoja (desde su ficha o su fila de Rivales), sin repintar al tocar
    case 'abrirDicho': if (S.D && d.tid) { DD.quitarAvisoRivales(); hoja('dicho', d.tid, pilaDesde(el, 'dicho', d.tid)); } break;
    case 'ddPaso': case 'ddAtajo': case 'ddModo': formDicho(el, d); break;
    case 'dichoGuardar': {
      const f = el.closest('.dd-hoja'), v = f ? DD.leerCifra((f.querySelector('.dd-in') || {}).value) : null;
      if (v == null) { notaDichoErr(f, 'Pon cuánto te dijo, en millones.'); break; }
      const { d: dc, cu } = apuntarDichoDe(d.tid, v, modoAprox(f));
      if (!volverHoja()) cerrarHoja();
      pintar();
      tostadaDicho(d.tid, dc, cu);
      break;
    }
    case 'mejorarIA': ponerMejorarIA(!mejorarIA()); repintarHoja(); tostada(mejorarIA() ? 'Gracias: así la IA afina más' : 'Hecho: no se manda nada más'); break;
    case 'borrarDicho': {
      const todos = DD.dichos();
      delete todos[d.tid];
      LS.set(K('dinero-dicho'), todos);
      rehacer(); repintarHoja(); pintar();
      // (0.8.4o) con su dinero cerrado, sin hablar de la cuenta
      tostada(bloqueada('dineroRivales', d.tid) ? 'Olvidado' : 'Olvidado: vuelve a salir de la cuenta');
      break;
    }
    case 'quitarAvisoDicho': { const y = window.scrollY; DD.quitarAvisoRivales(); pintar(); window.scrollTo(0, y); break; }
    case 'novDineroSi': cerrarNovDinero(); ventanaDinero(); break;
    case 'novDineroNo': cerrarNovDinero(); break;
    case 'ddApuntar': {
      const v = $('#dd-ventana'); if (!v || !S.ddV) break;
      const cant = DD.leerCifra((v.querySelector('.dd-in') || {}).value), aprox = modoAprox(v);
      S.ddV = { ...S.ddV, v: cant, aprox, err: !S.ddV.sel ? 'Elige quién te lo dijo.' : cant == null ? 'Pon cuánto te dijo, en millones.' : '' };
      if (!S.ddV.err) { apuntarDichoDe(S.ddV.sel, cant, aprox); S.ddV.fase = 'hecho'; pintar(); }
      ventanaDinero(S.ddV);
      break;
    }
    // (26 nov) el desplegable del rival, con las caras (dinero-dicho.js, botonRival)
    case 'ddAbrirLista': { const l = $('#ddLista'); if (!l) break; l.hidden = !l.hidden; el.setAttribute('aria-expanded', String(!l.hidden)); if (!l.hidden) { const o = l.querySelector('[aria-selected="true"]') || l.querySelector('.dd-op'); if (o) { o.scrollIntoView({ block: 'nearest' }); o.focus({ preventScroll: true }); } } break; }
    case 'ddElegir': {
      const v = $('#dd-ventana'); if (!v || !S.ddV) break;
      S.ddV.sel = d.tid;
      const e = (S.D.clasif || []).find((x) => String(x.teamId) === String(d.tid));
      const b = v.querySelector('#ddRival'); if (b) b.outerHTML = DD.botonRival(e);
      v.querySelectorAll('.dd-op').forEach((o) => o.setAttribute('aria-selected', String(o.dataset.tid === d.tid)));
      const l = v.querySelector('#ddLista'); if (l) l.hidden = true;
      const er = v.querySelector('.dd-err'); if (er) er.remove();
      const nb = v.querySelector('#ddRival'); if (nb) nb.focus({ preventScroll: true });
      break;
    }
    case 'ddOtro': ventanaDinero(); break;
    case 'ddCerrar': cerrarVentanaDinero(); break;
    case 'dichoChat': {
      // (0.8.4o) la tarjeta de debajo de una respuesta: solo se guarda al tocar
      const h2 = conversacion(), m = h2[Number(d.i)];
      if (!m || !m.dr || m.dr.hecho) break;
      apuntarDichoDe(m.dr.tid, m.dr.v, d.m === 'aprox');
      m.dr = { ...m.dr, hecho: d.m === 'aprox' ? 'aprox' : 'exacto' };
      guardarChat(h2);
      pintar();
      break;
    }
    case 'rango': S.rango = +d.n; pintarGraf(d.pid); break;
    case 'rkJ': { const y = window.scrollY; S.rkJ = Number(d.n); pintar(); window.scrollTo(0, y); break; }
    case 'rkOrden': { const y = window.scrollY, x = ($('.rk-caja') || {}).scrollLeft || 0; S.rkCol = String(S.rkCol || 'total') === d.n ? 'total' : d.n; if (/^\d+$/.test(d.n)) S.rkJ = Number(d.n); pintar(); window.scrollTo(0, y); const c = $('.rk-caja'); if (c) c.scrollLeft = x; break; }
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
      // (22 nov) los pasos hechos, también en tus otros dispositivos
      LS.set(K('hechos-t'), Date.now()); cambioLocal('hechos');
      if (apuntarReventa()) rehacer();
      else if (S.D) programar(S.D, S.M, planAvisos());
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
      if (!t) { if (c) c.focus(); tostada('No se ha podido leer lo copiado: pégalo tú en la casilla', 5000); break; }
      const k = limpiarClave(t);
      if (c) c.value = k;
      if (pareceClave(k)) await probarYGuardar();
      else tostada('Lo que tienes copiado no parece una clave: copia la de AI Studio (empieza por AQ. o AIza)', 6000);
      break;
    }
    case 'borrarClave': if (confirm('¿Quitar la clave de la IA?')) { guardarClave(''); rehacer(); repintarHoja(); pintar(); } break;
    case 'probarIA': try { const l = await probarClave(); tostada(`La clave funciona: ${l.length} versiones de la IA disponibles`); } catch (e) { tostada(e.message, 6000); } repintarHoja(); break;
    case 'iaWeb': guardarCfgIA({ web: !cfgIA().web }); repintarHoja(); break;
    case 'iaAuto': guardarCfgIA({ auto: !cfgIA().auto }); repintarHoja(); break;
    // (0.7.13l) los planes que salen solos a su hora, y los ajustes del plan desde el propio plan
    case 'planesHora': { const on = !cfgHoras().on; guardarCfgHoras({ on }); programarFondo(); repintarHoja(); if (S.vista === 'hoy') pintar(); tostada(on ? (enApp && !nativo.hayFondo() ? 'Los planes saldrán a su hora con la app abierta; si no, al abrirla' : 'Los planes saldrán solos a su hora') : 'Los planes solo saldrán cuando los pidas'); break; }
    case 'planAjustes': hoja('planAj'); break;
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
      if (S.D) programar(S.D, S.M, planAvisos());
      repintarHoja();
      break;
    }
    case 'avisoTipo': guardarCfgAvisos({ [d.k]: !cfgAvisos()[d.k] }); if (S.D) programar(S.D, S.M, planAvisos()); repintarHoja(); break;
    // el tema de evento (bloque TEMA_EVENTO de index.html): se enciende o se apaga sin recargar
    case 'temaEvento': if (window.temaEvento) { window.temaEvento.cambiar(!window.temaEvento.activo()); repintarHoja(); } break;
    // (40) las secciones de Ajustes: se recuerda cuáles has abierto para no cerrarlas al repintar
    case 'plegarAjuste': { const det = el.closest('details'); if (det) Hj.plegarAjuste(S, d.k, !det.open); break; }
    case 'quitarAvisoJ': { const j = S.M && S.M.J(d.pid); avisarJugador(d.pid, null); if (S.D) programar(S.D, S.M, planAvisos()); tostada(`Quitado el aviso${j ? ` de ${j.nombre}` : ''}`, 2400); repintarHoja(); break; }
    case 'exactas': nativo.pedirAlarmasExactas(); break;
    case 'probarAviso': if (enApp) { nativo.notificar('Así te llegarán los avisos', 'Por ejemplo: «Ya puedes clausular a Pedri: 74,2 M a Sergio».', 'rivales'); tostada('Mira las notificaciones'); } else tostada('Los avisos solo funcionan en la app'); break;
    // las tarjetas para el grupo de la liga (0.6.11): el plan y sus pullitas como imagen
    // (0.7.13n, Carlos 16 nov) la imagen del plan para el grupo se ha quitado: ya no hay ningún botón que la abra
    case 'tarjetaVer': if (S.tarjeta && S.tarjeta.k !== d.k) { S.tarjeta = { k: d.k, titular: S.tarjeta.titular, chiva: S.tarjeta.chiva }; repintarHoja(); pintarTarjeta(); } break;
    case 'tarjetaTitular': {
      const T = S.tarjeta;
      if (!T) break;
      T.titular = !(T.titular == null ? !T.chiva : T.titular); T.url = null; T.blob = null;
      repintarHoja(); pintarTarjeta();
      break;
    }
    case 'tarjetaMandar': {
      const r = await Tj.mandar(S.tarjeta);
      if (r === 'descargada') tostada('Imagen descargada: mándala desde tus fotos', 3500);
      else if (r === 'sin') tostada('Esta versión de la app no manda imágenes: actualízala', 4000);
      break;
    }
    case 'probarAlarma':
      nativo.probarAlarma(10, 'Así suena la alarma del clausulazo', 'Te llega 1 minuto antes de que se abra la cláusula que manda tu plan. Para pararla, tócala o baja las notificaciones.');
      tostada('Suena en 10 segundos: pon el móvil en silencio y bloquéalo', 5000);
      break;
    case 'buscarVersion': buscarVersion(true); break;
    case 'ponerWeb': ponerWebNueva(); break;
    case 'ponerAppNueva': ponerAppNueva(); break;
    case 'avisoPlay': avisoPlay(true); break;
    case 'cerrarAvisoPlay': { const d = document.getElementById('aviso-play'); if (d) d.remove(); break; }
    case 'bajarApp': if (enApkGithub()) avisoPlay(true); else if (enAppIos()) nativo.instalar(); else nativo.abrir(PLAY_URL); break;
    // (iOS 3) la ficha de la app en la App Store (la abre la app con la tienda; en otro sitio, la página)
    case 'irAppStore': if (enAppIos()) nativo.instalar(); else nativo.abrir(APP_STORE_URL); break;
    case 'recargarWeb': recargarWeb(); break;
    case 'buscarWeb': {
      tostada('Buscando versión nueva…', 2000);
      webMiradaT = 0;
      await mirarWebNueva();
      if (S.webNuevaWeb) recargarWeb(); else tostada(`Tienes la última: la ${VERSION}`);
      break;
    }
    case 'actualizarApp': if (enApkGithub()) avisoPlay(true); else if (enAppIos()) nativo.instalar(); else if (S.nueva) nativo.abrir(PLAY_URL); break;
    case 'borrarDatos': if (confirm('¿Borrar el histórico, las fichas y los planes guardados? Se vuelven a llenar solos.')) { borrarTodo(); olvidarLleno(); cerrarHoja(true); S.D = null; S.det = {}; cargar(); } break;
    case 'borrarServidor':
      if (!confirm('¿Borrar lo que guarda Fantasy Manager de ti en su servidor? Es que usas la app, cuánto rato y tus avisos de fallo con sus respuestas. Tu liga, tu sesión y tu clave están en este dispositivo y no se tocan. Si sigues usando la app, se volverá a apuntar que la usas.')) break;
      borrarMisDatos().then((r) => tostada(`Borrado${r.avisos ? ` (también ${r.avisos === 1 ? 'tu aviso' : `tus ${r.avisos} avisos`})` : ''}`, 6000)).catch((e) => tostada(e.message || 'No se ha podido borrar', 7000));
      break;
    case 'invitar': invitarALiga(); break;
    // (19 nov) invita a un amigo
    case 'invitarAmigo': {
      const uid = uidYo();
      S.inv = { ...(S.inv || {}), cargando: true, error: null };
      cerrarHoja(true);
      hoja('invitar');
      if (!uid) break;
      leerInvitar(uid, { ya: true, liga: (S.D && S.D.liga && S.D.liga.id) || '' }).then(() => { S.inv.cargando = false; S.inv.error = null; }, (e) => { S.inv.cargando = false; S.inv.error = e.message; })
        .then(() => { if (S.tipoHoja && S.tipoHoja[0] === 'invitar') repintarHoja(); });
      break;
    }
    // (25 nov) quien llega: la ventana del código (banda de arriba y Ajustes), «nadie» y cerrar la banda
    case 'ponerCodigo': { const pr = codigoPropuesto(uidYo()); cerrarHoja(true); S.inv = { ...(S.inv || {}), errorCod: null, propuesto: pr, cod: (S.inv && S.inv.cod) || pr }; hoja('invitado'); break; }
    case 'invCopiarPlay': {
      const cod = codigoPendiente();
      if (!cod) break;
      try { if (navigator.clipboard) navigator.clipboard.writeText(cod).catch(() => {}); } catch (e) { /* se ve en grande igual */ }
      avisarLlegada(cod, 'copia');
      location.href = playConCodigo(PLAY_URL, cod);
      break;
    }
    case 'invitadoNo': LS.set('inv-banda-cerrada', Date.now()); cerrarHoja(); pintarBanda(); break;
    case 'cerrarInvitado': { LS.set('inv-banda-cerrada', Date.now()); const b = $('.banda-invitado'); if (b) b.remove(); break; }
    case 'copiarCod': { const e = estadoInv(uidYo()); if (e && e.cod) copiarY(e.cod, 'Código copiado'); break; }
    case 'compartirInv': case 'copiarInv': {
      const uid = uidYo();
      if (!uid) break;
      S.inv = { ...(S.inv || {}), compartiendo: true };
      repintarHoja();
      try {
        const cod = await miCodigo(uid);
        if (d.accion === 'copiarInv') copiarY(enlaceInv(cod), 'Enlace copiado');
        else if (enApp) nativo.compartir(textoInv(cod));
        else if (navigator.share) navigator.share({ text: textoInv(cod) }).catch(() => {});
        else copiarY(textoInv(cod), 'Copiado: pégalo en WhatsApp');
        S.inv.error = null;
      } catch (e) { S.inv.error = e.message || 'No se ha podido sacar tu código ahora'; }
      S.inv.compartiendo = false;
      if (S.tipoHoja && S.tipoHoja[0] === 'invitar') repintarHoja();
      break;
    }
    case 'canjearInv': {
      const uid = uidYo(), liga = S.D && S.D.liga && S.D.liga.id, inp = $('#invCod');
      const cod = limpiarCod(inp ? inp.value : '');
      S.inv = { ...(S.inv || {}), cod, errorCod: null };
      if (!uid) break;
      if (cod.length !== 6) { S.inv.errorCod = cod ? 'Son 6 letras y números.' : 'Escribe el código que te ha pasado tu amigo.'; repintarHoja(); break; }
      S.inv.canjeando = true; repintarHoja();
      const x = await canjear(uid, cod, liga, S.inv.propuesto && cod === S.inv.propuesto ? 'propuesto' : 'escrito');
      S.inv.canjeando = false;
      if (x.ok) { S.inv.cod = ''; tostada('Listo: has entrado con la invitación de tu amigo', 5000); } else S.inv.errorCod = x.e || 'No ha valido. Vuelve a probar en un rato.';
      if (x.ok && S.tipoHoja && S.tipoHoja[0] === 'invitado') cerrarHoja();
      else if (S.tipoHoja && ['invitar', 'invitado'].includes(S.tipoHoja[0])) repintarHoja();
      pintarBanda();
      break;
    }
    case 'invElegir': {
      const i = Number(d.i), x = porElegir().find((y) => y.i === i);
      if (!x) break;
      S.inv = { ...(S.inv || {}), sel: { ...((S.inv && S.inv.sel) || {}) } };
      const a = S.inv.sel[i] || [], t = String(d.tid);
      S.inv.sel[i] = a.includes(t) ? a.filter((y) => y !== t) : a.length < x.quedan ? [...a, t] : [...a.slice(1), t];
      repintarHoja();
      break;
    }
    case 'invAbrir': {
      const uid = uidYo(), liga = S.D && S.D.liga && S.D.liga.id, i = Number(d.i), sel = (S.inv && S.inv.sel && S.inv.sel[i]) || [];
      if (!uid || !liga || !sel.length) break;
      S.inv.abriendo = true; repintarHoja();
      try {
        await elegirRivales(uid, i, liga, sel);
        delete S.inv.sel[i];
        S.inv.error = null;
        const x = ((estadoInv(uid) || {}).amigos || []).find((y) => y.i === i);
        tostada(`Su dinero, abierto${x ? ` hasta ${cuandoT(x.hasta)}` : ''}`, 5000);
        cerrarTopA();
        pintar();
      } catch (e) { S.inv.error = e.message; }
      S.inv.abriendo = false;
      if (S.tipoHoja && S.tipoHoja[0] === 'invitar') repintarHoja();
      break;
    }
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
    case 'copiarMsg': { const m = conversacion()[+d.i]; if (m) copiarY(String(m.t || '').replace(/\n> Ojo:[\s\S]*$/, '').trim()); break; }
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
      if (f) verFoto(f.id, f.mini || miniDe(f.id)); else if (actual) verFoto(actual.id, actual.mini);
      break;
    }
    case 'preguntarJ': { const j = S.M.J(d.pid); cerrarHoja(true); enviarPregunta(preguntaJ(j)); break; }
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
  if (k === 'planH1' || k === 'planH2') { guardarCfgHoras({ [k === 'planH1' ? 'h1' : 'h2']: v }); programarFondo(); repintarHoja(); if (S.vista === 'hoy') pintar(); }
  if (k === 'pullitas') { guardarCfgIA({ pullitas: v }); tostada(v === 'no' ? 'Sin pullitas desde el próximo plan' : 'Hecho: se nota desde el próximo plan o la próxima respuesta'); }
  if (k === 'apodo') { const l = ponerApodo(el.dataset.tid, v); el.value = l.join(', '); el.classList.toggle('lleno', !!l.length); tostada(l.length ? 'Apodo guardado' : 'Apodo quitado', 1800); }
  if (k === 'horaAviso') { guardarCfgAvisos({ hora: v }); if (S.D) programar(S.D, S.M, planAvisos()); }
  if (k === 'interes') { guardarCfgAvisos({ interes: +v }); if (S.D) programar(S.D, S.M, planAvisos()); repintarHoja(); }
  // (40) cuánto antes avisa cada tipo, de cuáles de tus cláusulas y el aviso de un jugador concreto (desde su ficha o Ajustes)
  if (k === 'avisoAntes') { ponerAntes(el.dataset.k, +v); if (S.D) programar(S.D, S.M, planAvisos()); repintarHoja(); }
  if (k === 'miasCuales') { guardarCfgAvisos({ miasTodas: v === 'todas' }); if (S.D) programar(S.D, S.M, planAvisos()); repintarHoja(); }
  if (k === 'avisoJ') {
    const pid = el.dataset.pid, j = S.M && S.M.J(pid);
    if (v === '') avisarJugador(pid, null);
    else {
      avisarJugador(pid, +v, j ? j.nombre : '');
      // pedirlo desde la ficha enciende los avisos (y pide el permiso) si estaban apagados
      if (!cfgAvisos().on) guardarCfgAvisos({ on: true });
      if (enApp && !nativo.avisosPermitidos()) nativo.pedirPermisoAvisos();
    }
    if (S.D) programar(S.D, S.M, planAvisos());
    tostada(v === '' ? `Sin aviso${j ? ` de ${j.nombre}` : ''}` : `Te aviso${j ? ` de ${j.nombre}` : ''}: ${antesTxt(+v).toLowerCase()}`, 2600);
    repintarHoja();
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $('.visor')) { $('.visor').remove(); return; }
  if (ev.key === 'Escape' && S.hoja && !tourAbierto()) { cerrarHoja(); return; }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('[role="button"][data-accion]')) { ev.preventDefault(); ev.target.click(); return; }
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target && ev.target.id === 'pregunta') { ev.preventDefault(); const t = ev.target.value; ev.target.value = ''; enviarPregunta(t); }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'apodoIn') { ev.preventDefault(); const b = $('[data-accion="apodoGuardar"]'); if (b) b.click(); return; }
  if (ev.key === 'Enter' && ev.target && ev.target.matches && ev.target.matches('input[data-cambia="apodo"]')) { ev.preventDefault(); ev.target.blur(); return; }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'codigoWeb') { ev.preventDefault(); const b = $('[data-accion="usarCodigo"]'); if (b) b.click(); }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'vueltaWeb') { ev.preventDefault(); entrarConVuelta(ev.target.value); return; }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'invCod') { ev.preventDefault(); const b = $('[data-accion="canjearInv"]'); if (b) b.click(); }
});
// el buscador de Ajustes: esconde filas sin repintar (no se pierde el teclado)
document.addEventListener('input', (ev) => {
  if (!ev.target || ev.target.id !== 'buscaAj' || !S.hoja) return;
  S.ajBusca = ev.target.value;
  Hj.filtrarAjustes(S.hoja, S.ajBusca);
});
// el buscador del Mercado: solo se repinta la lista de resultados (así no se pierde lo que escribes ni el teclado)
let buscaT = 0;
document.addEventListener('input', (ev) => {
  if (!ev.target || ev.target.id !== 'buscaJ') return;
  S.busca = ev.target.value;
  clearTimeout(buscaT);
  buscaT = setTimeout(() => { const r = $('#buscaRes'); if (r && S.M) { r.innerHTML = V.buscaHTML(S); encuadrar(r); } }, 120);
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
  // (la casilla de «tengo 18 años y lo he leído», encima de la clave: la piden las condiciones de la IA de Google)
  const ok = $('#claveOK');
  if (ok && !ok.checked) { tostada('Marca antes la casilla de encima de la clave', 5000); ok.focus(); return; }
  if (ok) LS.set('clave-aviso-ok', true);
  const b = $('[data-accion="guardarClave"]');
  probandoClave = true;
  if (b) { b.disabled = true; b.textContent = 'Probando la clave…'; }
  try {
    // primero se prueba y luego se guarda: si no, mientras Google contesta la app ya cree que hay clave (cambia la
    // guía por el chat y puede lanzar el plan con una clave sin probar)
    const lista = await probarClave(k);
    guardarClave(k);
    contar('c');
    LS.del('guia-clave');
    if (planesApp(enDemo())) { tostada('IA activada: ya puedes preguntarle lo que quieras'); ir('ia'); } else {
      tostada('IA activada: ya puedes preguntarle y hacer el plan con noticias');
      ir('hoy');
      S.planEstado = {};
      generarPlan();
    }
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
    if (probandoClave) { tostada('Espera: aún se está probando la de antes'); return; }
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
// (22 nov) al volver a la app: lo que hayas hecho en otro dispositivo (un plan nuevo, una pregunta, algo que le has contado)
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.D && !enDemo()) sincronizar({ por: 'volver' }); });
// (y al volver a la ventana en el ordenador, que no siempre cambia la visibilidad)
window.addEventListener('focus', () => { if (S.D && !enDemo()) sincronizar({ por: 'volver' }); });
setInterval(() => { if (!document.hidden && S.D) mirarWebNueva(); }, 10 * MIN);

/* ---------------- lo nuevo de esta versión ---------------- */
/** la última versión que viste (la numeración cambió en la 0.1.0: lo de antes se traduce) */
function versionVista() {
  const v = LS.get('version-vista2', null);
  if (v) return v;
  const vieja = LS.get('version-vista', null);
  return vieja ? deNumeracionVieja(vieja) || '0.0.1' : null;
}
/* A cada uno, lo que le afecta: el dueño (Carlos, el admin de los avisos) lo ve todo; los demás, ni lo «menor»
   (detalles, cosas de dentro) ni lo que es de otra versión de la app: «para» 'play' (la de Google Play), 'app'
   (Android), 'web' (iPhone y ordenador) o 'dueño' (solo él). Los arreglos no van en cromos: salen al final, numerados,
   para todos (también los menores), menos los que son de otra versión */
const paraMi = (c) => {
  if (avisosGuardados().admin) return true;
  if (c.para === 'dueño') return false;
  if (c.para === 'play') return topConAnuncio();
  if (c.para === 'app') return enApp;
  if (c.para === 'web') return !enApp;
  return true;
};
fijarFiltroNovedades((c) => paraMi(c) && (avisosGuardados().admin || !c.menor), paraMi);
/* (19 nov, Carlos) «todos» también puede ser de una sola versión de la app: 'web' (iPhone y ordenador) o 'app' (Android).
   Así una versión se presenta sola a los de la web sin abrirse en el móvil (invitar a un amigo, 0.8h) */
const todosMi = (n) => n.todos === true || (n.todos === 'web' && !enApp) || (n.todos === 'app' && enApp);
/** al estrenar versión, las novedades contadas bajando; la primera vez que se instala, nada */
function novedades() {
  // (9 nov, 23:42, Carlos) la presentación al actualizar ya no se abre sola a nadie, tampoco al dueño: se marca como vista
  // y ya. La lista de Ajustes sigue, solo para el dueño (y su botón «Ver en presentación»)
  // (17 nov, Carlos) salvo las versiones gordas, con «todos: true» (la 0.8): esas se presentan a todos al actualizar
  const vista = versionVista();
  iphoneEsperar();
  // (26 nov, 03:38, Carlos: «quita lo del popup para todos y haz que solo salga en la sección Rivales») la novedad del
  // dinero ya no sale: se cuenta en el aviso de Rivales (avisoRivalesHTML). novDineroEsperar se queda sin llamar.
  novAvisoAlArrancar(vista);
  if (!vista || !NOVEDADES.some((n) => todosMi(n) && cmpVer(n.v, vista) > 0 && cmpVer(n.v, '0.8') >= 0)) { LS.set('version-vista2', VERSION); return; }
  // a quien acaba de llegar (aún no ha pasado el tutorial) no se le cuentan las novedades de cada versión que le llega
  // sola: le basta con el tutorial. Las de después, sí
  if (!tourVisto() || !vista || cmpVer(vista, VERSION) >= 0) { LS.set('version-vista2', VERSION); return; }
  // y a quien no es el dueño (ni los de la liga, desde la 0.7z) no se le abre nada solo ni se le enseña la lista de
  // Ajustes: las novedades de cada versión son solo para el dueño (o para todos con «novedadesTodos»)
  // (0.7.1) una versión con «todos: true» se presenta a todos; a quien no es el dueño, desde la de antes de la primera
  // así que no haya visto (sin las viejas, que eran solo para el dueño)
  let desde = vista;
  if (!avisosGuardados().admin) {
    const paraTodos = NOVEDADES.filter((n) => todosMi(n) && cmpVer(n.v, vista) > 0);
    if (paraTodos.length) {
      const i = NOVEDADES.indexOf(paraTodos[paraTodos.length - 1]);
      if (NOVEDADES[i + 1] && cmpVer(NOVEDADES[i + 1].v, vista) > 0) desde = NOVEDADES[i + 1].v;
    } else {
      if (!S.D) return;
      const mia = novedadesPara({ ligas: S.D.ligas || [] });
      if (mia === null) return; // aún no se sabe de qué liga es: se mira en el próximo arranque
      if (!mia) { LS.set('version-vista2', VERSION); return; }
    }
  }
  // si desde la última que viste solo hay arreglos, no se abre nada: se juntan para la próxima con algo nuevo, que los
  // cuenta al final, numerados
  if (!hayNovedadesDesde(desde)) return;
  LS.set('version-vista2', VERSION);
  // (20 nov) si todo lo que se presenta solo a ti trae «aviso», en vez de la presentación entera, la tarjeta de la más nueva
  const suyas = NOVEDADES.filter((n) => todosMi(n) && cmpVer(n.v, vista) > 0);
  // (20 nov, Carlos: «no quiero que les salga nada de las novedades a no ser que yo te lo estipule; ahora, solo la de
  // invitar a un amigo») A quien no es el dueño, solo lo de las versiones que él ha dicho que salgan (`todos`): la tarjeta
  // de la más nueva si lleva «aviso», y nada más; si no la lleva, la presentación de esas versiones, sin las de en medio.
  // Antes, a quien venía de antes de la 0.8 le salía la presentación de todo lo de después, con el título de la última
  // versión (un arreglo) encima de «Invita a un amigo» (aviso de Domy, 20 nov)
  const todo = avisosGuardados().admin || novedadesPara({ ligas: (S.D && S.D.ligas) || [] }) === true;
  if (suyas.length && (suyas.every((n) => n.aviso) || (!todo && suyas[0].aviso))) { novAvisoPedir(suyas[0].v); return; }
  verNovedades(desde, todo ? null : suyas.map((n) => n.v));
}
/* La tarjeta de una novedad con «aviso» (invitar a un amigo, 0.8h).
   (20 nov, Carlos: «he abierto la app y no me ha salido nada») Salía al arrancar, antes de que cargara la liga (el botón
   aún no hacía nada), y se daba por vista en ese momento. En la app eso la perdía justo al actualizar desde Google Play:
   la web de dentro de la app la enseñaba, a los pocos segundos la app bajaba la web publicada después y recargaba
   (`ponerWebNueva`), y como ya constaba como vista no volvía a salir. Ahora:
   - queda apuntada como pendiente (LS `avisos-nov`: { visto: [versiones], pend }) y solo se da por vista cuando se cierra
     o se pulsa su botón; si la app recarga o se cierra antes, vuelve a salir;
   - se enseña con la liga cargada y la pantalla libre, no al arrancar;
   - quien ya tenía esta versión en la app sin que conste que la cerró (lo de arriba) la ve una vez. En una instalación
     nueva, nada, como siempre */
const novAvisos = () => { const g = LS.get('avisos-nov', null); return g && Array.isArray(g.visto) ? g : null; };
function novAvisoAlArrancar(vista) {
  const g = novAvisos();
  // (se mira siempre: aunque no haya tarjeta pendiente, puede tocar el recordatorio de invitar)
  novAvisoEsperar();
  if (g) return;
  const todos = NOVEDADES.filter((n) => n.aviso).map((n) => n.v);
  if (!vista) { LS.set('avisos-nov', { visto: todos, pend: null }); return; }
  // (a quien aún no ha pasado el tutorial se le mira en el próximo arranque)
  if (!tourVisto()) return;
  const n = NOVEDADES.find((x) => x.aviso && todosMi(x));
  if (enApp && n && cmpVer(vista, n.v) >= 0) { LS.set('avisos-nov', { visto: todos.filter((v) => v !== n.v && cmpVer(vista, v) >= 0), pend: n.v }); novAvisoEsperar(); return; }
  LS.set('avisos-nov', { visto: todos.filter((v) => cmpVer(vista, v) >= 0), pend: null });
}
function novAvisoPedir(v) {
  const g = novAvisos() || { visto: [], pend: null };
  if (g.visto.includes(v)) return;
  g.pend = v;
  LS.set('avisos-nov', g);
  novAvisoEsperar();
}
function novAvisoVisto(v) {
  const g = novAvisos() || { visto: [], pend: null };
  if (!g.visto.includes(v)) g.visto.push(v);
  if (g.pend === v) g.pend = null;
  // (la de invitar cuenta también como la última vez que se le recordó)
  g.invT = Date.now();
  LS.set('avisos-nov', g);
  LS.set('tarjeta-inv-t', Date.now());
}
/* (20 nov, Carlos: «que el pop-up de invitar amigos aparezca una vez cada 5 días para quien no ha invitado a ningún amigo;
   si ha invitado a un amigo, que no le salga nunca más») La misma tarjeta de invitar, de recordatorio: a quien no tiene
   ningún amigo que haya entrado con su enlace o su código (`entran` del servidor), cada «recordarDias» de «invitar» en
   limites.json (5; 0 lo apaga) desde la última vez que la cerró (`invT`). Sin saber aún su estado, espera; con la
   primera vez sin fecha (instalación nueva o quien venía de antes), la cuenta empieza ese día. Devuelve la tarjeta,
   'espera' o null */
function novInvRecordar() {
  const g = novAvisos();
  if (!g || !tourVisto() || !invitarOn()) return null;
  const dias = Number(((((LS.get('limites', null) || {}).cfg || {}).invitar) || {}).recordarDias ?? 5);
  if (!(dias > 0)) return null;
  const uid = S.D && S.D.yo && S.D.yo.userId;
  if (!uid) return null;
  const e = estadoInv(uid);
  if (!e) return 'espera';
  if ((e.entran || 0) > 0) return null;
  // (lo guardado puede ser de hace días y haber entrado un amigo desde entonces: no se decide hasta tener el estado de ahora,
  //  el que pide `invitarSiToca` al arrancar; si el servidor no contesta, no sale)
  const ig = LS.get('invitar', null);
  if (!ig || Date.now() - (Number(ig.t) || 0) > 20 * 60e3) return 'espera';
  if (!g.invT) { g.invT = Date.now(); LS.set('avisos-nov', g); return null; }
  if (Date.now() - g.invT < dias * 86400e3) return null;
  const n = NOVEDADES.find((x) => x.aviso && x.aviso.ir && x.aviso.ir.accion === 'invitarAmigo');
  return n ? { ...n.aviso, eti: 'Premios por invitar' } : null;
}
function novInvRecordado() {
  const g = novAvisos() || { visto: [], pend: null };
  g.invT = Date.now();
  LS.set('avisos-nov', g);
  LS.set('tarjeta-inv-t', Date.now());
}
let novAvisoEsperando = false;
function novAvisoEsperar() {
  if (novAvisoEsperando) return;
  novAvisoEsperando = true;
  const hasta = Date.now() + 10 * 60e3;
  const mirar = () => {
    // (pasado un rato sin hueco, se deja: lo pendiente sigue pendiente y sale la próxima vez que se abra)
    if (Date.now() > hasta) { novAvisoEsperando = false; return; }
    if (!(S.D && S.M && !S.cargando && !S.hoja && !tourAbierto() && !document.hidden && !$('#limite') && !$('#forzar') && !$('.carga') && !$('.nv') && !$('.nvt-capa'))) { setTimeout(mirar, 1000); return; }
    // (0.8.4e) la de la app para iPhone va antes y, si sale hoy, la de invitar se deja para otro día
    if (iphoneToca()) { setTimeout(mirar, 1500); return; }
    if (iphoneHoy()) { novAvisoEsperando = false; return; }
    // (0.8.4o) si hoy ha salido la novedad del dinero de los rivales, la de invitar, otro día
    if (novDineroHoy()) { novAvisoEsperando = false; return; }
    const g = novAvisos();
    const n = g && g.pend ? NOVEDADES.find((x) => x.v === g.pend && x.aviso && todosMi(x)) : null;
    if (n) {
      novAvisoEsperando = false;
      tarjetaNovedad(n.aviso, { alIr: (a) => { novAvisoVisto(n.v); irNovedad(a); }, alCerrar: () => { novAvisoVisto(n.v); quizaTutorial(700); } });
      return;
    }
    // sin tarjeta de versión pendiente: el recordatorio de invitar, si toca
    const rec = novInvRecordar();
    if (rec === 'espera') { setTimeout(mirar, 3000); return; }
    novAvisoEsperando = false;
    if (rec) tarjetaNovedad(rec, { alIr: (a) => { novInvRecordado(); irNovedad(a); }, alCerrar: () => { novInvRecordado(); } });
  };
  setTimeout(mirar, 500);
}
/* (0.8.4e; Carlos, 25 nov, 13:00 y 13:29) La tarjeta de la app para iPhone (tarjetaIphone, presentacion.js): UNA vez por
   dispositivo a todos, también al dueño (para verla) y en Android («para que lo sepan si tienen amigos»), con su liga
   cargada (no en la liga de ejemplo, ni en la portada ni en la entrada) y la pantalla libre, después del tutorial. Si
   tocan la de invitar y esta, primero esta y la de invitar otro día (iphoneHoy, en novAvisoEsperar). Se da por vista al
   cerrarla (LS «aviso-iphone»): si la app recarga o se cierra antes, vuelve a salir. Ni dentro de la app de iOS ni con un
   navegador manejado por un programa (las pruebas). OJO: lo pidió él aunque choca con la regla de no cambiar los textos
   del iPhone en la web hasta que Apple apruebe la app (claude/ESTADO-reglas.md del proyecto) */
const LINEA_IPHONE = {
  android: '¿Amigos con iPhone en tu liga? Ya pueden entrar desde la web.',
  ios: 'Mientras, sigue usándola desde Safari como hasta ahora.',
  pc: 'Si tienes iPhone, ya puedes usarla desde Safari.',
};
const iphoneNunca = () => !!LS.get('aviso-iphone', 0) || navigator.webdriver === true || (enApp && nativo.canal() === 'ios');
const iphoneToca = () => !iphoneNunca() && !enDemo() && haySesion() && tourVisto();
const iphoneHoy = () => { const t = Number(LS.get('aviso-iphone', 0)) || 0; return !!t && new Date(t).toDateString() === new Date().toDateString(); };
/** la línea de cada plataforma: la app de Android y la web en un Android, la de Android; el iPhone, la suya; el resto, el ordenador */
function lineaIphone() {
  if (enApp) return LINEA_IPHONE.android;
  const c = canalPaso();
  return c === 'web-iphone' ? LINEA_IPHONE.ios : c === 'web-android' ? LINEA_IPHONE.android : LINEA_IPHONE.pc;
}
let iphoneEsperando = false;
function iphoneEsperar() {
  if (iphoneEsperando) return;
  iphoneEsperando = true;
  const hasta = Date.now() + 10 * 60e3;
  const mirar = () => {
    if (iphoneNunca() || Date.now() > hasta) { iphoneEsperando = false; return; }
    if (novDineroHoy()) { iphoneEsperando = false; return; }
    // (en la liga de ejemplo, sin sesión o sin el tutorial visto, se espera: puede entrar con su liga en este rato)
    // (ni encima de la bienvenida ni de la presentación de un tema de evento: lo mismo que espera el tutorial)
    if (!iphoneToca() || !(S.D && S.M && !S.cargando && !S.hoja && !tourAbierto() && !document.hidden && !$('#limite') && !$('#forzar') && !$('.carga') && !$('.nv') && !$('.nvt-capa') && !$('.atardecer-intro') && !$('#bienvenida') && !S.bienvenidaPendiente)) { setTimeout(mirar, 1500); return; }
    iphoneEsperando = false;
    tarjetaIphone({ apple: APPLE, linea: lineaIphone(), alCerrar: () => { LS.set('aviso-iphone', Date.now()); quizaTutorial(700); } });
  };
  setTimeout(mirar, 800);
}
// a donde lleva el botón de una novedad: una pestaña (v, seg) o lo mismo que un botón con ese data-accion (accion)
function irNovedad(a) {
  if (!a || !S.D) return;
  if (a.accion) { const b = document.createElement('button'); b.dataset.accion = a.accion; b.hidden = true; document.body.append(b); b.click(); b.remove(); return; }
  if (a.seg) { const [v, sg] = a.seg.split(':'); S.seg[v] = sg; }
  ir(a.v);
}
function verNovedades(desde, solo = null) {
  presentarNovedades(desde, {
    solo,
    alIr: irNovedad,
    // (0.7.1) la lista de todas las versiones, solo a quien puede verla (el dueño o con «novedadesTodos»): a los demás,
    // con una versión «para todos», solo esa
    alLista: avisosGuardados().admin || novedadesPara({ ligas: (S.D && S.D.ligas) || [] }) === true ? () => listaVersiones() : null,
    alCerrar: () => quizaTutorial(700),
  });
}
function listaVersiones() {
  abrirHoja(`<div class="hoja-cab"><h2>Novedades</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <button class="btn chico" data-accion="presentacion" style="margin:0 0 6px">${icono('ia')}Ver la ${((versionesDesde(null)[0] || {}).v || VERSION).replace(/\.0$/, '')} en presentación</button>${listaNovedades()}`);
}

/** (11 nov, Carlos) a los que no son el dueño: solo lo importante de cada versión, sin arreglos */
function listaImportantesHoja() {
  LS.set('importante-vista', ultimaImportante());
  abrirHoja(`<div class="hoja-cab"><h2>Novedades</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <p class="nvl-intro">Lo más importante que ha cambiado en la app.</p>${listaImportantes()}`);
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
  if (enDemo()) {
    // (sesión 8, A9) lo que pasa de verdad en cada sitio: en el móvil, sin la app de Android no se entra con tu liga
    const m = enApp ? null : movilDe();
    if (m === 'android') return [{ k: 'cuenta', ok: false, ic: 'usuario', t: 'Con tu liga, en la app', x: 'En el móvil, tu liga se ve con la app de Android, gratis. Entras con tu cuenta en la página oficial de LaLiga y la app nunca ve tu contraseña.', b: 'Ver cómo' }];
    if (m === 'iphone') return [{ k: 'cuenta', ok: false, ic: 'usuario', t: 'Con tu liga, desde el iPhone', x: 'En el iPhone no hay app en la App Store ni hace falta: entras con tu cuenta de LaLiga desde Safari, en tres pasos, y solo la primera vez.', b: 'Ver cómo' }];
    return [{ k: 'cuenta', ok: false, ic: 'usuario', t: 'Entra con tu cuenta de LaLiga', x: enApp ? 'Lo mismo, con tu liga de verdad. Entras en la página oficial de LaLiga: la app nunca ve tu contraseña.' : 'Lo mismo, con tu liga de verdad. Entras en la página oficial de LaLiga (sin la app de Android son unos pasos, solo la primera vez) y la web nunca ve tu contraseña.', b: 'Entrar' }];
  }
  // (con la IA de la app, el plan ya va con IA sin clave: la clave es para preguntar)
  // (16 nov) con las preguntas también por la IA de la app, no hace falta clave: el paso no sale
  const l = preguntasApp(enDemo()) || enAppIos() ? [] : [{ k: 'clave', ok: hayClave(), ic: 'ia', t: 'La IA, gratis', x: planesApp(enDemo()) ? 'Una clave gratis de Google en unos 3 minutos para preguntarle lo que quieras de tu liga. El plan de cada día ya lo hace la IA de la app.' : 'Una clave gratis de Google en unos 3 minutos: el plan lee las noticias y puedes preguntarle lo que quieras.', b: 'Activar' }];
  if (enApp) l.push({ k: 'avisos', ok: nativo.avisosPermitidos() && cfgAvisos().on, ic: 'campana', t: 'Activa los avisos', x: 'Cuando se abre una cláusula que te interesa, cuando cambia el mercado y cuando está tu plan.', b: 'Activar' });
  return l;
}
/** ¿se está viendo solo lo básico del tutorial? */
const T_BASICO = () => tourBasico();
function pasosTour() {
  const demo = enDemo(), conClave = puedeChat(demo), conIA = puedePlanIA(demo);
  const liga = S.D && S.D.liga && !demo ? S.D.liga.nombre : 'tu liga';
  // en el ordenador, Pregunta está en la barra de la izquierda, no arriba
  const rojo = V.ancho() ? 'el botón rojo de la barra de la izquierda' : 'el botón rojo de arriba';
  return [
    { logo: true, b: true, elegir: true, t: 'Bienvenido a Fantasy Manager', x: `Cada día la app te dice qué hacer en ${liga}: a quién vender, a quién clausular y cuánto pujar. ¿Quieres ver lo básico o todo?` },
    { v: 'hoy', sel: '.marcador', b: true, t: 'Tu equipo de un vistazo', x: 'Tu saldo, hasta dónde puedes quedarte en negativo (contando tus pujas), lo que vale tu equipo y tu puesto. Tócalo para ver el detalle.' },
    { v: 'hoy', sel: '.tiempos', si: () => !!$('.tiempos'), t: 'Lo que viene', x: 'Cuándo cambia el mercado, cuándo se abre la cláusula de uno tuyo y las de rivales que te interesan. Toca uno para ir a él.' },
    { v: 'hoy', sel: '.llevas', si: () => !!$('.llevas'), t: 'Lo que llevas hoy', x: 'Lo que has hecho en LaLiga desde el último cambio de mercado: lo terminado y lo que está en marcha (pujas, ofertas, lo que tienes a la venta).' },
    { v: 'hoy', sel: '.plan-cab', b: true, con: ['.plan-sit', '.plan-titular'], si: () => !!$('.plan-cab'), t: 'Tu plan de hoy', x: 'Lo que toca hacer hoy, en orden y con el saldo que te queda tras cada paso. Cuando lo hagas en LaLiga, el paso se tacha solo (o lo marcas con «Hecho»).' },
    conIA
      ? { v: 'hoy', sel: '.plan-otro', si: () => !!$('.plan-otro'), t: 'Otro plan, cuando quieras', x: planesApp(demo) ? `La IA hace el plan sola al empezar el día y cuando cambia el mercado. Con este botón le pides otro, por ejemplo después de vender a alguien: tienes ${planesCfg().gratis} al día con la IA${topConAnuncio() ? ' y, viendo un anuncio corto, alguno más' : ''}. Si tu plantilla cambia sin que el plan lo dijera, te lo propone arriba, en amarillo.` : 'La IA hace el plan sola cada mañana y cuando cambia el mercado. Con este botón le pides otro, por ejemplo después de vender a alguien. Si tu plantilla cambia sin que el plan lo dijera, te lo propone arriba, en amarillo.' }
      // (iOS 3) en la app de iOS no hay clave de Google: la IA es la de la app, con tu cuenta
      : enAppIos() ? { v: 'hoy', sel: '.plan .caja', si: () => !!$('.plan .caja'), t: 'Con la IA, mejor', x: 'Aquí el plan sale de los números. Con tu cuenta de LaLiga, la IA lee noticias, lesiones y onces probables antes de decidir, y le puedes preguntar lo que quieras de tu liga.' }
      : { v: 'hoy', sel: '.plan .caja', si: () => !!$('.plan .caja'), t: 'Con la IA, mejor', x: `Sin IA, el plan sale de los números. Con una clave gratis de Google, la IA lee noticias, lesiones y onces probables antes de decidir, y le puedes preguntar. Se activa en «Pregunta», ${rojo}.` },
    { v: 'hoy', sel: '#bRefrescar:not([hidden]), #supEstado.sup-toca', b: true, t: 'Actualizar', x: 'Trae lo último de LaLiga: saldo, mercado, pujas y clasificación. Se hace solo al abrir la app; tócalo después de hacer algo en LaLiga.' },
    { v: 'hoy', sel: '#bAjustes', t: 'Ajustes y fallos', x: `Si algo no funciona o no cuadra, «Reportar un fallo o una idea» me llega a mí y te contesto ahí mismo (el numerito rojo es mi respuesta); también con la etiqueta BETA de arriba. También están ${enAppIos() ? 'la IA' : 'tu clave de la IA'}, los avisos, abrir la app en otro dispositivo y este tutorial.` },
    { v: 'hoy', sel: '#bAjustes', b: true, si: () => !!(window.temaEvento && window.temaEvento.activo()), t: 'Modo Vice City', x: PASO_TEMA },
    { v: 'hoy', sel: '#supQueda', si: () => estadoLimite.min != null && !!$('#supQueda') && !$('#supQueda').hidden, t: 'Tus minutos de hoy', x: () => `En tu liga hay ${estadoLimite.min} minutos al día, sumando la app y la web. Aquí ves los que te quedan.` },
    { v: 'equipo', sel: '.nav [data-ir="equipo"]', t: 'Equipo', x: 'Tus jugadores: si suben o bajan, sus cláusulas y quién de tu liga puede pagarlas, y tu mejor once con las formaciones gratis.' },
    // (21) en el parón, el mismo sitio es la pestaña Parón
    Pz.hayParon(S.M)
      ? { v: 'directo', sel: '.nav [data-ir="directo"]', t: 'Parón', x: 'Mientras dura el parón de selecciones: qué comprar para revender antes de la vuelta, qué vender antes de que baje y desde cuándo pensar en el once. Arriba puedes cambiar a Directo para ver los partidos de la vuelta.' }
      : { v: 'directo', sel: '.nav [data-ir="directo"]', t: 'Directo', x: 'La jornada mientras se juega: los marcadores, los puntos de cada jugador y de quién es en tu liga, tu once con lo que lleva cada uno y cómo va tu liga. Toca un partido para verlo jugador a jugador.' },
    { v: 'rivales', sel: '.nav [data-ir="rivales"]', t: 'Rivales', x: 'Las cláusulas de los demás que te llegan con tu dinero, cuándo se abren las que están protegidas y lo que ha hecho cada uno.' },
    { v: 'mercado', sel: '.nav [data-ir="mercado"]', t: 'Mercado', x: 'Cuánto pujar por cada libre según lo que se paga en tu liga, qué ofrecer a otro mánager para que te venda y quién sube y quién baja.' },
    { v: 'clubes', sel: '.nav [data-ir="clubes"]', t: 'Clubes', x: 'Los 20 de LaLiga por la clasificación. En cada uno, su próximo partido, el once probable en el campo, las bajas, sus partidos y la plantilla con lo que vale cada jugador y de quién es en tu liga.' },
    { v: 'ia', sel: '#bPregunta', b: true, t: 'Pregunta', x: conClave ? `${rojo[0].toUpperCase()}${rojo.slice(1)}, siempre a mano: pregúntale a la IA lo que quieras de tu liga, por ejemplo «¿clausulo a este o espero?». También le puedes mandar capturas.` : `${rojo[0].toUpperCase()}${rojo.slice(1)}: aquí le preguntas a la IA lo que quieras de tu liga, también con capturas. ${enAppIos() ? 'En la liga de ejemplo no contesta: hace falta entrar con tu cuenta.' : 'Necesita la clave gratis de Google, y aquí mismo te explica cómo sacarla.'}` },
    demo
      ? { v: 'hoy', b: true, t: 'Esto era la liga de ejemplo', x: 'Con datos inventados. Cuando quieras, entra con tu cuenta y lo tendrás con tu liga. El tutorial queda en Ajustes.', lista: itemsEmpezar, fin: 'Seguir mirando' }
      : { v: 'hoy', b: true, t: 'Para empezar', x: () => `${itemsEmpezar().some((y) => !y.ok) ? 'Esto se hace una vez (si no, lo tienes en Ajustes). Después, empieza por el paso 1 de tu plan de hoy.' : 'Ya lo tienes todo. Empieza por el paso 1 de tu plan de hoy.'} ${T_BASICO() ? 'El tutorial entero, con el resto de pestañas, está en Ajustes.' : 'El tutorial queda en Ajustes por si quieres repetirlo.'}`, lista: itemsEmpezar, fin: 'Ver mi plan', finAccion: 'plan' },
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
      if (window.temaEvento) LS.set('tema-aviso', Date.now());
      LS.set('beta-aviso', Date.now());
      if (S.vista !== 'hoy' || como === 'saltar') ir('hoy');
      if (como === 'saltar') { window.scrollTo(0, 0); tostada('El tutorial está en Ajustes cuando quieras', 3500); }
      else if (como === 'plan' || como === 'fin') { const pl = $('.plan'); if (pl) window.scrollTo({ top: pl.getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' }); }
      else if (como === 'clave') ir('ia');
      else if (como === 'avisos') { if (!cfgAvisos().on) guardarCfgAvisos({ on: true }); nativo.pedirPermisoAvisos(); tostada('Avisos activados', 3000); }
      else if (como === 'cuenta') salirDemo();
    },
  }), 250);
}
/* el tema de evento: lo cuenta un paso del tutorial y, a quien ya lo había visto, ese paso solo, una vez (13 nov, Carlos) */
const PASO_TEMA = 'Hasta el 26 nov la app va en modo Vice City. Si prefieres el rojo y negro de siempre, se quita en Ajustes, arriba del todo, y se vuelve a poner ahí mismo.';
function quizaAvisoTema(ms, intento = 0) {
  if (!window.temaEvento || !window.temaEvento.activo() || LS.get('tema-aviso', null)) return;
  setTimeout(() => {
    if (!window.temaEvento || !window.temaEvento.activo() || LS.get('tema-aviso', null) || tourAbierto() || !S.D || estadoLimite.cerrada) return;
    if ($('.nv') || $('.atardecer-intro') || S.hoja || $('#limite') || $('#bienvenida') || S.bienvenidaPendiente || S.vista !== 'hoy' || !$('#bAjustes')) { if (intento < 20) quizaAvisoTema(3000, intento + 1); return; }
    LS.set('tema-aviso', Date.now());
    empezarTour({
      pasos: [{ v: 'hoy', sel: '#bAjustes', t: 'Modo Vice City', x: PASO_TEMA, saltar: 'Vale', fin: 'Ver dónde', finAccion: 'tema' }],
      vista: () => S.vista,
      ir: (v) => ir(v),
      alAcabar: (como) => { if (como === 'tema' || como === 'fin') abrirTemaAjustes(); },
    });
  }, ms);
}
function abrirTemaAjustes() {
  S.ajBusca = ''; hoja('ajustes');
  setTimeout(() => { const f = $('#aj-tema'); if (f) { f.classList.remove('aj-luz'); void f.offsetWidth; f.classList.add('aj-luz'); } }, 350);
}
/* la etiqueta BETA de arriba: una ventanita, una sola vez por dispositivo, que dice que ahí se avisa de fallos e ideas (14 nov, Carlos).
   A quien hace el tutorial por primera vez no se le saca después: ya se lo cuenta (alAcabar lo apunta). */
const PASO_BETA = 'La app está en beta y se mejora con lo que me cuentas. Toca esta etiqueta, o Ajustes → Reportar un fallo o una idea, para avisarme de un fallo o proponerme algo. Te contesto en la propia app.';
function quizaAvisoBeta(ms, intento = 0) {
  if (LS.get('beta-aviso', null)) return;
  setTimeout(() => {
    if (LS.get('beta-aviso', null) || tourAbierto() || !S.D || estadoLimite.cerrada) return;
    if ($('.nv') || $('.atardecer-intro') || S.hoja || $('#limite') || $('#bienvenida') || S.bienvenidaPendiente || S.vista !== 'hoy' || !$('.sup-beta')) { if (intento < 20) quizaAvisoBeta(3000, intento + 1); return; }
    LS.set('beta-aviso', Date.now());
    empezarTour({
      pasos: [{ v: 'hoy', sel: '.sup-beta', t: 'Fallos e ideas', x: PASO_BETA, saltar: 'Vale', fin: 'Reportar ahora', finAccion: 'beta' }],
      vista: () => S.vista,
      ir: (v) => ir(v),
      alAcabar: (como) => { if (como === 'beta' || como === 'fin') abrirAvisos('mios'); },
    });
  }, ms);
}
/** la primera vez (o al abrirse la app a la hora): el tutorial, si no se ha visto y no hay nada delante */
function quizaTutorial(ms, intento = 0) {
  if (tourVisto() && S.D && !estadoLimite.cerrada) { quizaAvisoTema(ms); quizaAvisoBeta(ms + 600); return; }
  if (tourVisto() || !S.D || estadoLimite.cerrada) return;
  setTimeout(() => {
    if (tourVisto() || tourAbierto() || !S.D || estadoLimite.cerrada || S.cargando && !S.D) return;
    // con la presentación de novedades o una ventana abierta, se espera
    if ($('.nv') || $('.atardecer-intro') || S.hoja || $('#limite') || $('#bienvenida') || S.bienvenidaPendiente) { if (intento < 20) quizaTutorial(3000, intento + 1); return; }
    lanzarTutorial();
  }, ms);
}

/* las miniaturas del chat guardadas en IndexedDB (fotos.js): se pintan con data-mini y aquí se les pone la imagen */
let hidratando = false;
async function hidratarMinis() {
  if (hidratando) return;
  hidratando = true;
  try {
    const imgs = [...document.querySelectorAll('img[data-mini]')];
    if (!imgs.length) return;
    await cargarMinis(imgs.map((im) => im.dataset.mini));
    for (const im of imgs) { const m = miniDe(im.dataset.mini); im.removeAttribute('data-mini'); if (m) im.src = m; }
  } catch (e) { /* sin miniatura: el hueco */ } finally {
    hidratando = false;
    if (document.querySelector('img[data-mini]')) setTimeout(hidratarMinis, 50);
  }
}
if (!EN_FONDO && typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (!hidratando && document.querySelector('img[data-mini]')) hidratarMinis(); }).observe(document.documentElement, { childList: true, subtree: true });

/* ---------------- arranque ---------------- */
/* La web se da por buena ante AlDia (webViva) solo después del primer pintar() bueno: si una web nueva no consigue
   abrir la liga guardada, AlDia vuelve a la del APK a los 20 s (revisión total, C2). */
let webDadaPorViva = false, fotoRota = false;
function webVivaUnaVez() {
  if (webDadaPorViva) return;
  webDadaPorViva = true;
  nativo.webViva();
}
/* Abre la liga guardada. Si el motor o el pintado fallan con ella (un campo que esta versión no espera, una foto de
   otra versión), antes se quedaba en «Abriendo…» para siempre: ahora se apunta el error, se tira la foto y se vuelve
   a cargar de LaLiga (el histórico se queda). Devuelve si se ha podido abrir */
function abrirGuardada() {
  try {
    rehacer();
    pintar();
    if (!$('#vista')) throw new Error('la liga guardada no se ha pintado');
    return true;
  } catch (e) {
    console.error(e);
    apuntarError(e.message, `al abrir la liga guardada (se vuelve a cargar)${e.stack ? ` · ${String(e.stack).split('\n')[1] || ''}` : ''}`);
    fotoRota = true;
    LS.del(K('datos'));
    S.D = null; S.M = null;
    return false;
  }
}
/* Cloudflare Web Analytics (25 nov, Carlos): visitas y de dónde llegan a la web, sin cookies. Solo en la web del dominio
   (nunca en la app de Android ni en una vista previa) y no con la marca de pruebas. Las páginas públicas lo llevan en el
   <head> (CF_BEACON en paginas.py) */
function analiticaWeb() {
  try {
    if (enApp || !enWeb || location.hostname !== 'fantasymanagerapp.com' || esPrueba()) return;
    const s = document.createElement('script');
    s.defer = true; s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token": "299aacc756f14e2d84c558491aee0671"}');
    document.head.appendChild(s);
  } catch (e) {}
}

async function arrancar() {
  analiticaWeb();
  // (0.8) el reloj del rato de uso para los intersticiales (solo en la app)
  arrancarIntersticiales();
  const h = ALIAS[location.hash.slice(1)] || location.hash.slice(1);
  if (VISTAS[h]) S.vista = h;
  // (0.8.4r) recién recargada con la versión nueva: la misma pestaña (y luego la ficha y el scroll, en despues)
  leerVuelta();
  const aFallos = h === 'fallos';
  if (aFallos) history.replaceState(null, '', '#hoy');
  // venía de la web de antes con un código de mudanza
  await codigoDeMudanza();
  leerInvitacion();
  // (25 nov) la llegada con ?inv= se cuenta y deja su huella 2 h en el servidor (para proponerle el código en la app)
  { const ci = leerCodigoEnlace(); if (ci && !enApp) avisarLlegada(ci); }
  // (25 nov, tanda 6) y en la app de Google Play, el código que traía la instalación
  if (enApp) leerCodigoPlay();
  leerOrigen();
  // la versión nueva, antes de nada: con una vieja no se juega (0.7.6)
  mirarWebNueva();
  comprobarFotos();
  if ((enApp || enWeb) && !enDemo() && !haySesion()) {
    pantallaEntrar();
    webVivaUnaVez();
  } else {
    S.D = foto();
    if (S.D && !abrirGuardada()) S.D = null;
    if (S.D) {
      webVivaUnaVez();
      if (Date.now() - S.D.t > 10 * MIN) cargar({ silencio: true }); else despues();
    } else {
      // sin foto guardada no hay con qué probar la web antes de cargar (y la primera carga puede pasar de los 20 s que
      // da AlDia): se da por buena ya. Si la foto había fallado (abrirGuardada), no: que la dé por buena la carga
      if (!fotoRota) webVivaUnaVez();
      await cargar();
    }
    // venía de tocar la notificación de una respuesta a tu aviso de fallo
    if (aFallos && S.D) setTimeout(() => { if (!S.hoja) abrirAvisos(); }, 400);
  }
  // por si la vuelta del inicio de sesión llegó antes de que la web estuviera lista
  if (enApp) setTimeout(() => window.vueltaLogin(), 300);
  // (21 nov) si Android cerró la app mientras se entraba en LaLiga y se vuelve sin el código
  if (enApp && !haySesion()) setTimeout(() => mirarSinCodigo(), 600);
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
  }, () => { if (S.D && S.M) programar(S.D, S.M, planAvisos()); });
  novedades();
  quizaTutorial(2500);
  // las miniaturas del chat que aún van dentro de localStorage, a IndexedDB (A8)
  setTimeout(() => migrarMinis().catch(() => {}), 5000);
  setTimeout(() => buscarVersion(false), 4000);
  // la IA con la app cerrada avisa con notificaciones: se pide el permiso una vez
  // (25 nov) en la app de iOS no hay IA con la app cerrada: el permiso se pide al activar los avisos o al pedir un plan
  if (enApp && nativo.hayFondo() && !enDemo() && haySesion() && cfgFondo().on && !nativo.avisosPermitidos() && !LS.get('permiso-fondo')) {
    LS.set('permiso-fondo', Date.now());
    setTimeout(() => nativo.pedirPermisoAvisos(), 2500);
  }
  // cada minuto, las cuentas atrás al día (sin repintar). El motor entero solo se rehace cuando pasa algo por la hora
  // (S.M.proximoHito: se abre una cláusula, cierra el mercado, empieza un partido, cambia el día…) o, como mucho, cada
  // 10 minutos, y si no estás tocando nada. Antes se rehacía y repintaba todo cada minuto (revisión total, M7)
  let toqueT = 0;
  for (const e of ['touchstart', 'pointerdown', 'scroll', 'keydown']) window.addEventListener(e, () => { toqueT = Date.now(); }, { passive: true });
  setInterval(() => {
    if (!S.D || document.visibilityState !== 'visible') return;
    ponerCuentas();
    if (S.hoja || S.cargando || S.charlando || S.planEstado.cargando || S.vista === 'ia' || tourAbierto() || Date.now() - toqueT < 30e3) return;
    const ahora = Date.now();
    if (S.M && ahora < (S.M.proximoHito || Infinity) && ahora - (S.M.t || 0) < 10 * MIN) return;
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
    const antes = JSON.stringify(((S.fuentes || {}).alineaciones || {}).jugadores || {});
    alineaciones(S.D).then((a) => {
      if (!a) return;
      S.fuentes = { ...(S.fuentes || fuentesGuardadas() || {}), alineaciones: a };
      // si ha salido un once confirmado, el motor se rehace para que se vea ya (también con la ficha de un partido abierta)
      if (JSON.stringify(a.jugadores || {}) === antes || S.cargando) return;
      rehacer();
      if (S.hoja) repintarHoja(); else if (Date.now() - toqueT > 8e3) pintar();
    }).catch(() => {});
  }, 3 * MIN);
}

// en segundo plano no hay nada que pintar: con que hayan cargado todos los módulos, la web vale. Con la app a la vista,
// webVivaUnaVez() tras el primer pintar() bueno (arrancar)
if (EN_FONDO) nativo.webViva();
if (!EN_FONDO) { const wp = LS.get('web-puesta', null); if (wp) { LS.del('web-puesta'); if (Date.now() - wp.t < 120000 && tourVisto()) setTimeout(() => tostada(`App al día: versión ${VERSION}`, 4000), 1800); } }
if (EN_FONDO) trabajoFondo(); else arrancar();

/* el service worker (sw.js): que la web y el PWA del iPhone abran sin red con lo último guardado (revisión total, M11).
   Solo en el navegador: en la app de Android la web la sirve AlDia desde el APK y no se mezclan. Se registra con la
   app ya abierta, para no quitarle tiempo al arranque, y se le pasan los módulos del mapa de importaciones */
function ponerSW() {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  if (enApp) { sw.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {}); return; }
  if (!(location.protocol === 'https:' || location.hostname === 'localhost')) return;
  sw.register('sw.js', { scope: './' }).then(() => sw.ready).then((reg) => {
    let urls = [];
    try { const m = JSON.parse((document.querySelector('script[type=importmap]') || {}).textContent || '{}'); urls = Object.values(m.imports || {}); } catch (e) { /* sin mapa (en pruebas) */ }
    const css = document.querySelector('link[rel=stylesheet][href*="css/app.css"]');
    if (css) urls.push(css.getAttribute('href'));
    if (reg.active && urls.length) reg.active.postMessage({ tipo: 'guardar', urls });
  }).catch((e) => console.warn('sw', e));
}
/* (24 nov) Instalar en el ordenador. Chrome y Edge dejan instalar la web como una app (ventana propia, icono en el menú
   Inicio o en el Dock) si lleva manifiesto con nombre, iconos de 192 y 512, start_url y display, va por https y el visitante
   ha tocado la página y lleva 30 s en ella; entonces lanzan `beforeinstallprompt` y la web puede enseñar su propio botón
   (web.dev/articles/install-criteria; desde Chrome 112 ya no hace falta service worker para instalar, y este no se toca).
   La app instalada usa el mismo perfil del navegador: la sesión es la misma (al revés que en el iPhone, donde el icono
   guarda la suya aparte). Safari de Mac (Archivo → Añadir al Dock, con sesión aparte) y Firefox no avisan a la web: ahí el
   botón no sale y se entra en el navegador, como siempre. Solo en el ordenador: en la web de un Android lo suyo es la app
   de Google Play y Chrome ofrecería instalar la web en su lugar. */
let avisoInstalar = null;
const ponerInstalar = () => { document.querySelectorAll('[data-accion="instalarPc"]').forEach((b) => { b.hidden = !avisoInstalar; }); };
async function instalarPc(el) {
  const ev = avisoInstalar;
  if (!ev) { ponerInstalar(); return; }
  if (el) el.disabled = true;
  try {
    ev.prompt();
    const r = await ev.userChoice;
    // el aviso vale una sola vez
    avisoInstalar = null;
    if (r && r.outcome === 'accepted') marcarPaso('inicio', { una: true });
  } catch (e) { avisoInstalar = null; } finally { if (el) el.disabled = false; ponerInstalar(); }
}
if (!EN_FONDO && !enApp && !movilDe()) {
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); avisoInstalar = ev; ponerInstalar(); });
  window.addEventListener('appinstalled', () => { avisoInstalar = null; ponerInstalar(); });
}
if (!EN_FONDO) { if (document.readyState === 'complete') setTimeout(ponerSW, 3000); else window.addEventListener('load', () => setTimeout(ponerSW, 3000), { once: true }); }
