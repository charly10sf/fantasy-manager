/* El límite de uso diario (para los amigos viciados): cuántos minutos al día puede tener cada uno la app abierta.
   Y la hora de apertura («abre» en limites.json): hasta entonces, a todos menos a los de «sinLimite» les sale la
   cuenta atrás en vez de la app (pueden instalarla y entrar con su cuenta, pero no ver nada).
   Lo decide web/limites.json, que se lee de GitHub (cambiarlo en main lo cambia para todos sin sacar versión).
   Los minutos y la cuenta atrás son solo para las ligas de «ligas» (la de los amigos); en las demás, ni una cosa ni
   la otra.
   Solo cuenta el tiempo con la app a la vista; los avisos y la IA trabajando sola siguen igual. Se reinicia a las
   00:00, hora de Madrid. Al pasarse, una pantalla de «hasta mañana» tapa la app.
   El tiempo se suma también en el Worker, por cuenta de LaLiga: así los minutos son en total, entre la app y la web
   (y en cualquier dispositivo). Sin conexión, cuenta lo de este dispositivo. */
import { LS, norm, diaDe, otroDia, esc, LOGO, dura } from './util.js';
import { http, enApp, nativo } from './puente.js';
import { pedirWorker } from './soporte.js';
import { VERSION } from './version.js';

// del dominio de la app; si no contesta, de GitHub (donde estaba antes de la mudanza)
const URLS_APP = ['https://fantasymanagerapp.com/limites.json', 'https://raw.githubusercontent.com/charly10sf/fantasy-manager/main/web/limites.json'];
const CADA = 15; // segundos entre cuentas
const FRASES = [
  'Ni Mbappé entrena tanto. Sal a que te dé el aire.',
  'La cláusula seguirá ahí mañana. Tu vida social, a lo mejor no.',
  'Hasta los cracks tienen día de descanso.',
  'El mercado cambia de madrugada lo mires o no.',
  'Míster, por hoy ya ha hecho bastante.',
  'Ni el VAR revisa tanto como tú.',
];

/** la configuración: la guardada (vale media hora) o la de GitHub; forzar: sin mirar la guardada */
async function leerLimites(forzar = false) {
  const g = LS.get('limites', null);
  // la guardada vale media hora (antes 6 h: un cambio del admin, como darle minutos a uno, tardaba demasiado en
  // llegar), salvo que sea de antes de la 0.5.0 (sin «ligas»): esa se vuelve a leer ya
  // (y la que guardó otra versión de la app, que puede no saber de una función top nueva)
  if (!forzar && g && Date.now() - g.t < 30 * 60e3 && g.cfg && Array.isArray(g.cfg.ligas) && g.v === VERSION) return g.cfg;
  try {
    let cfg = null;
    if (enApp) {
      for (const u of URLS_APP) {
        const r = await http('GET', `${u}?t=${Date.now()}`, { tiempo: 12000 });
        if (r.s === 200 && r.b) { try { cfg = JSON.parse(r.b); break; } catch (e) { /* la siguiente */ } }
      }
    } else {
      const r = await fetch(`limites.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) cfg = await r.json();
    }
    if (cfg) {
      const antes = JSON.stringify(g && g.cfg);
      LS.set('limites', { t: Date.now(), cfg, v: VERSION });
      // lo bloqueado depende de esto: si ha cambiado, que se vuelva a pintar
      if (antes !== JSON.stringify(cfg) && typeof window !== 'undefined') window.dispatchEvent(new Event('limites-nuevos'));
      return cfg;
    }
  } catch (e) { /* sin red: lo guardado, aunque sea viejo */ }
  return g ? g.cfg : null;
}

/** ¿es este equipo uno de los de la lista? (por el nombre del equipo, su id o el id de la cuenta de LaLiga) */
function esDe(yo) {
  const n = norm(yo.nombre || ''), id = String(yo.teamId || ''), uid = String(yo.userId || '');
  return (k) => (norm(k) && norm(k) === n) || String(k) === id || (uid && String(k) === uid);
}
/* Las funciones top, bloqueadas.
   limites.json: «bloqueadas», cuáles lo están (si no lo dice, estas cuatro), y «todoAbierto», los equipos que las ven
   todas (si no lo dice, los de «sinLimite»). En la liga de ejemplo, bloqueadas.
   En la versión de Google Play (la que lleva anuncios) se abren viendo anuncios bonificados (desde la 0.6.3a; lo
   decidió Carlos el 25 oct, tras decirle sus amigos que 1 anuncio por el dinero de los rivales era poco y que eso es
   demasiado fuerte para tenerlo siempre):
   - Las de los rivales (dineroRivales, ventasRivales, quienPaga y, desde la 0.6.5, perfilRival: cómo juega cada uno),
     cada una por su lado: 2 anuncios seguidos por vez y
     como mucho 2 veces por jornada (de una jornada a la siguiente), y cada vez abierta 1 hora. Se cambia en
     limites.json con «top»: { "usos": 2, "minutos": 60 }.
   - Cuándo gira un jugador (inercia, y con ella el radar de subidas del Mercado): con cualquier anuncio visto hoy,
     hasta las 00:00 de Madrid.
   Si no hay anuncio que enseñar, se abre igual media hora (y en las de los rivales cuenta como una vez). También en la
   liga de ejemplo (así las ve quien revisa la app en Google). En la de la liga, que no lleva anuncios, siguen como
   diga limites.json. Todo se guarda en el móvil: borrando los datos de la app se vuelve a empezar (no se puede evitar
   sin un servidor, y no compensa). */
const BLOQUEADAS = ['dineroRivales', 'quienPaga', 'inercia', 'ventasRivales', 'perfilRival'];
/** las que van por veces a la jornada, con 2 anuncios cada vez */
export const POR_JORNADA = ['dineroRivales', 'ventasRivales', 'quienPaga', 'perfilRival'];
/** las que no conoce un limites.json leído por una versión anterior: con ese, cerradas hasta volver a leerlo */
const NUEVAS = ['perfilRival'];
const porJornada = (clave) => POR_JORNADA.includes(clave);
/** cuántos anuncios pide cada vez */
export const anunciosPorVez = (clave) => (porJornada(clave) ? 2 : 1);
const cfgTop = () => { const g = LS.get('limites', null), t = (g && g.cfg && g.cfg.top) || {}; return { usos: Number(t.usos) > 0 ? Number(t.usos) : 2, minutos: Number(t.minutos) > 0 ? Number(t.minutos) : 60 }; };
/** ¿se pueden abrir viendo un anuncio? (solo en la versión de Google Play) */
export const topConAnuncio = () => enApp && nativo.hayAnuncios();
let jornadaB = 0;
/** la jornada para contar las veces: la que se juega o, si no, la próxima (lo pone la app al rehacer los datos) */
export function fijarJornada(n) { if (Number(n) > 0) jornadaB = Number(n); }

/* lo de hoy (para cuándo gira): cuántos anuncios has visto y, si no había anuncio, hasta cuándo va abierta gratis */
function hoyTop() {
  const g = LS.get('top-abierto', null);
  if (!g || g.dia !== diaDe()) return { vistos: 0, libreHasta: 0 };
  // lo guardado por la 0.6.3, { dia, t, hasta }: un anuncio abría las cuatro hasta medianoche
  if (g.vistos == null) return { vistos: g.hasta ? 0 : 1, libreHasta: g.hasta || 0 };
  return { vistos: g.vistos || 0, libreHasta: g.libreHasta || 0 };
}
// con «hasta: 1»: la web de la 0.6.3 y anteriores (la que va dentro del APK, si AlDia vuelve a ella) lo lee como cerrado
const guardarHoy = (h) => LS.set('top-abierto', { dia: diaDe(), t: Date.now(), vistos: h.vistos, libreHasta: h.libreHasta || 0, hasta: 1 });
/* lo de la jornada (para las de los rivales): por cada una, cuántas veces la has abierto, hasta cuándo está abierta y si
   llevas visto el primero de los dos anuncios */
function jornadaTop() {
  const g = LS.get('top-jornada', null);
  if (g && (g.j === jornadaB || !jornadaB)) return g;
  // jornada nueva: las veces vuelven a 0, pero lo que estaba abierto sigue hasta su hora y el «1 de 2» se guarda
  const f = {};
  if (g && g.f) for (const [k, x] of Object.entries(g.f)) if ((x.hasta && x.hasta > Date.now()) || x.uno) f[k] = { usos: 0, hasta: x.hasta || 0, uno: !!x.uno };
  return { j: jornadaB, f };
}
/** la hora más cercana a la que se cierra algo de lo abierto por jornada (0 si nada) */
export function proximoCierreTop() {
  const ahora = Date.now();
  const hs = Object.values(jornadaTop().f || {}).map((x) => x.hasta || 0).filter((h) => h > ahora);
  return hs.length ? Math.min(...hs) : 0;
}
const deJornada = (clave) => jornadaTop().f[clave] || { usos: 0, hasta: 0, uno: false };
function guardarJornada(clave, x) { const g = jornadaTop(); g.f = { ...g.f, [clave]: x }; LS.set('top-jornada', g); }

/** ¿está abierta ahora? */
export function topAbierto(clave) {
  if (porJornada(clave)) return Date.now() < deJornada(clave).hasta;
  const h = hoyTop();
  return h.vistos > 0 || Date.now() < h.libreHasta;
}
/** cuántas veces te quedan esta jornada (las de los rivales) */
export const usosQuedan = (clave) => (porJornada(clave) ? Math.max(0, cfgTop().usos - deJornada(clave).usos) : Infinity);
export const usosPorJornada = () => cfgTop().usos;
export const minutosPorVez = () => cfgTop().minutos;
/** hasta cuándo está abierta (0 si no lo está) */
export const abiertaHasta = (clave) => { const h = porJornada(clave) ? deJornada(clave).hasta : 0; return h > Date.now() ? h : 0; };
/** cuántos anuncios te faltan para abrirla esta vez */
export function faltanAnuncios(clave) {
  if (topAbierto(clave)) return 0;
  return porJornada(clave) ? (deJornada(clave).uno ? 1 : 2) : 1;
}
/** un anuncio visto hasta el final, para esa función. Devuelve si ya se ha abierto */
export function anuncioTopVisto(clave) {
  const h = hoyTop();
  guardarHoy({ ...h, vistos: h.vistos + 1 });
  if (!porJornada(clave)) return true;
  const x = deJornada(clave);
  if (!x.uno) { guardarJornada(clave, { ...x, uno: true }); return false; }
  guardarJornada(clave, { usos: x.usos + 1, hasta: Date.now() + cfgTop().minutos * 60e3, uno: false });
  return true;
}
/** sin anuncio que enseñar: se abre igual lo que pedías, pero solo «min» minutos (y en las de los rivales cuenta como
    una vez: así no se abren gratis tocando el candado antes de que AdMob arranque) */
export function abrirTopGratis(clave, min = 30) {
  if (!porJornada(clave)) { const h = hoyTop(); guardarHoy({ ...h, libreHasta: Date.now() + min * 60e3 }); return; }
  const x = deJornada(clave);
  guardarJornada(clave, { usos: x.usos + 1, hasta: Date.now() + Math.min(min, cfgTop().minutos) * 60e3, uno: false });
}
let yoB = null, demoB = false;
/** quién eres para lo bloqueado (lo pone la app cada vez que rehace los datos) */
export function fijarYo(yo, demo) { yoB = yo || null; demoB = !!demo; }
export function bloqueada(clave) {
  const g = LS.get('limites', null), cfg = g && g.cfg;
  const lista = cfg && Array.isArray(cfg.bloqueadas) ? cfg.bloqueadas : BLOQUEADAS;
  if (!lista.includes(clave) && !(NUEVAS.includes(clave) && cfg && g.v !== VERSION)) return false;
  if (topAbierto(clave)) return false;
  if (demoB || !yoB || !cfg) return true;
  return !(cfg.todoAbierto || cfg.sinLimite || []).some(esDe(yoB));
}

/** los anuncios de la web (AdSense): si «anunciosWeb» está a true en limites.json, para todos menos los de «todoAbierto»
    o «sinLimite» (Carlos), y solo cuando ya se sabe quién eres */
export const anunciosWebEncendidos = () => { const g = LS.get('limites', null); return !!(g && g.cfg && g.cfg.anunciosWeb === true); };
export function anunciosWebOk() {
  const g = LS.get('limites', null), cfg = g && g.cfg;
  if (!cfg || cfg.anunciosWeb !== true || !yoB) return false;
  return ![...(cfg.todoAbierto || []), ...(cfg.sinLimite || [])].some(esDe(yoB));
}

/* «ligas» en limites.json: las ligas (por nombre o id) a las que se aplican «minutos» y «abre». La app ya no es solo
   de una liga: quien juega en otra no tiene límite ni cuenta atrás. Cuenta cualquier liga de la cuenta de LaLiga, no
   solo la que se está viendo (así no se escapa uno cambiando de liga). Sin «ligas» (una configuración de antes de la
   0.5.0, aún guardada), a todos, como entonces. */
function enSusLigas(cfg, yo) {
  if (!cfg || !Array.isArray(cfg.ligas)) return true;
  const mias = (yo && yo.ligas) || [];
  return cfg.ligas.some((k) => {
    const n = norm(String(k));
    return n && mias.some((l) => String(l.id) === String(k) || norm(l.nombre || '') === n || (n.length >= 5 && norm(l.nombre || '').includes(n)));
  });
}

/** los minutos de un equipo (null: sin límite) */
export function minutosDe(cfg, yo) {
  if (!cfg || !yo) return null;
  const es = esDe(yo);
  if ((cfg.sinLimite || []).some(es)) return null;
  // los que salen con nombre en «equipos», con sus minutos, sea cual sea su liga
  for (const [k, m] of Object.entries(cfg.equipos || {})) if (es(k)) return Number(m) >= 0 ? Number(m) + extraHoy(cfg, es) : null;
  if (!enSusLigas(cfg, yo)) return null;
  // «minutosLiga» manda sobre «minutos»: las versiones de antes de la 0.5.0b solo leen «minutos», y con un fallo que
  // congelaba la app al contar el tiempo; ahí se deja a 0 para que a ellas no les toque contar
  const m = cfg.minutosLiga != null ? cfg.minutosLiga : cfg.minutos;
  return Number(m) > 0 ? Number(m) + extraHoy(cfg, es) : null;
}
/* «extra»: minutos de más para un equipo un día concreto ({ "C.A.D Domyngas": { "dia": "2026-10-23", "min": 20 } }).
   Al día siguiente deja de contar solo. */
function extraHoy(cfg, es) {
  let mas = 0;
  for (const [k, x] of Object.entries(cfg.extra || {})) if (es(k) && x && x.dia === hoy() && Number(x.min) > 0) mas += Number(x.min);
  return mas;
}

/** hasta cuándo está cerrada la liga de ejemplo (para todos: sin cuenta no se sabe quién eres) */
function cerradaDemo(cfg) {
  const t = cfg && cfg.abre ? Date.parse(cfg.abre) : NaN;
  return Number.isFinite(t) && Date.now() < t ? t : null;
}
/** hasta cuándo está cerrada para este equipo (null: abierta) */
export function cerradaHasta(cfg, yo) {
  const t = cfg && cfg.abre ? Date.parse(cfg.abre) : NaN;
  if (!yo || !Number.isFinite(t) || Date.now() >= t) return null;
  if ((cfg.sinLimite || []).some(esDe(yo)) || !enSusLigas(cfg, yo)) return null;
  return t;
}
/** «hoy a las 20:00», «mañana a las 20:00» o «el sábado 24 a las 20:00» (hora de Madrid) */
function cuandoAbre(t) {
  const f = (x, o) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...o }).format(new Date(x));
  const hora = f(t, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (diaDe(t) === diaDe()) return `hoy a las ${hora}`;
  if (diaDe(t) === otroDia(diaDe(), 1)) return `mañana a las ${hora}`;
  return `el ${f(t, { weekday: 'long', day: 'numeric' })} a las ${hora}`;
}

const hoy = () => diaDe();
export const usoHoy = () => { const u = LS.get('uso', null); return u && u.dia === hoy() ? u.seg : 0; };
function sumar(seg) { const d = hoy(); const u = LS.get('uso', null); LS.set('uso', { dia: d, seg: (u && u.dia === d ? u.seg : 0) + seg }); }

/* el total de hoy entre todos tus dispositivos, según el Worker (más lo de aquí que aún no se ha mandado) */
let porMandar = 0, sincronizando = false, ultimoSync = 0;
const enServidor = () => { const x = LS.get('uso-srv', null); return x && x.dia === hoy() ? x.seg : null; };
function usadosHoy() { const l = usoHoy(), s = enServidor(); return s == null ? l : Math.max(l, s + porMandar); }
async function sincronizar(forzar = false) {
  if (sincronizando || (!forzar && Date.now() - ultimoSync < 60e3)) return;
  sincronizando = true;
  const mando = Math.min(120, porMandar);
  try {
    const r = await pedirWorker('POST', '/uso', { seg: mando });
    porMandar = Math.max(0, porMandar - mando);
    if (r && r.dia === hoy()) LS.set('uso-srv', { dia: r.dia, seg: Number(r.seg) || 0 });
  } catch (e) { /* sin conexión: se manda en la próxima */ }
  ultimoSync = Date.now();
  sincronizando = false;
}

/** lo que falta para las 00:00 en Madrid */
const FHORA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
function hastaMedianoche() {
  const ahora = new Date();
  const p = Object.fromEntries(FHORA.formatToParts(ahora).map((x) => [x.type, x.value]));
  return ((23 - Number(p.hour)) * 3600 + (59 - Number(p.minute)) * 60 + (60 - Number(p.second))) * 1000;
}

/* con la app cerrada (cuenta atrás o sin minutos) se puede actualizar igual: la web se pone al día sola, y si hace
   falta el APK nuevo (cambia la parte Android), su botón sale aquí también */
let appNueva = null;
export function versionNueva(v) {
  appNueva = v || null;
  if (document.getElementById('limite') && comprobarYa) comprobarYa();
}
const botonNueva = () => (appNueva && enApp ? `<div class="lim-nueva"><p>Hay una versión nueva de la app (${esc(appNueva.nombre || '')}). Instálala ya y estarás listo.</p><button class="btn" data-accion="actualizarApp">Actualizar la app</button></div>` : '');
function tapar(min, usados) {
  let el = document.getElementById('limite');
  const frase = FRASES[Math.floor(Date.now() / 86400e3) % FRASES.length];
  const html = `<div class="lim-in">${LOGO}<h1 id="limT">Se acabó por hoy</h1>
    <p>Hoy llevas <b>${Math.round(usados / 60)} min</b> con la app abierta (contando la app y la web) y tu límite son <b>${min} min al día</b>.</p>
    <p class="lim-frase">${esc(frase)}</p>
    <p class="lim-vuelve">Vuelve mañana: se reinicia a las 00:00 (dentro de ${esc(dura(hastaMedianoche()))}).${enApp ? ' Los avisos te siguen llegando.' : ''}</p>${botonNueva()}</div>`;
  if (!el) {
    el = document.createElement('div');
    el.id = 'limite'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'limT');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  document.body.classList.add('limitado');
  // (sin anuncios en esta pantalla: es un callejón sin salida)
  window.dispatchEvent(new Event('limite-cambia'));
}
/** la cuenta atrás hasta que se abre (demo: en la liga de ejemplo, sin cuenta) */
function taparHastaApertura(t, mensaje, demo = false) {
  let el = document.getElementById('limite');
  const html = `<div class="lim-in">${LOGO}<h1 id="limT">Se abre ${esc(cuandoAbre(t))}</h1>
    <p>Todavía no se puede usar: empezamos todos a la vez, con el cambio de mercado.</p>
    <p class="lim-frase">${t - Date.now() < 60e3 ? 'Falta menos de un minuto' : `Faltan ${esc(dura(t - Date.now()))}`}</p>
    ${mensaje ? `<p class="lim-msg">${esc(mensaje)}</p>` : ''}
    ${demo
    ? '<p class="lim-vuelve">La liga de ejemplo también se abre a esa hora. Si aún no has entrado con tu cuenta, entra ya y a esa hora estará todo listo.</p><button class="btn" data-accion="salirDemo">Entrar con mi cuenta</button>'
    : `<p class="lim-vuelve">Ya has entrado con tu cuenta: a esa hora, abre la app y estará todo listo.${enApp ? ' Mientras, se pone al día sola con los arreglos que vayan saliendo.' : ''}</p>${enApp ? (nativo.avisosPermitidos() ? '<p class="lim-vuelve">Te llegará una notificación cuando se abra.</p>' : '<button class="btn" data-accion="permisoApertura">Avísame cuando se abra</button>') : ''}
      <div class="lim-otro"><p>${enApp ? '¿La vas a usar también en el ordenador? Saca aquí el código para entrar.' : '¿La vas a usar en el iPhone o en otro ordenador? Saca aquí el código para entrar allí.'}</p><button class="btn sec" data-accion="vincularWeb">${enApp ? 'Abrir en el ordenador' : 'Abrir en el iPhone u otro dispositivo'}</button></div>`}${botonNueva()}</div>`;
  if (!el) {
    el = document.createElement('div');
    el.id = 'limite'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'limT');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  document.body.classList.add('limitado');
  // (sin anuncios en esta pantalla: es un callejón sin salida)
  window.dispatchEvent(new Event('limite-cambia'));
}
function destapar() {
  const el = document.getElementById('limite');
  if (el) el.remove();
  document.body.classList.remove('limitado');
  window.dispatchEvent(new Event('limite-cambia'));
}

/** lo último que se ha comprobado (para enseñarlo en Ajustes): minutos de límite (null: sin límite), segundos usados y si está cerrada */
export const estadoLimite = { min: null, usados: 0, cerrada: null };

/**
 * empieza a contar. quien() da { yo, demo } (yo: tu equipo, con nombre, teamId, userId y las ligas de tu cuenta);
 * aviso(texto) enseña un aviso corto
 */
let comprobarYa = null;
/** vuelve a mirar el límite ahora mismo (al acabar de cargar la liga, al salir del ejemplo) */
export const mirarLimite = () => { if (comprobarYa) comprobarYa(); };
/** los minutos que te quedan hoy, en la cabecera (solo si tienes límite) */
function pintarQueda(min, usados) {
  const el = document.getElementById('supQueda');
  if (!el) return;
  if (min == null) { el.hidden = true; return; }
  const q = Math.max(0, Math.ceil((min * 60 - usados) / 60));
  el.hidden = false;
  el.textContent = q ? `Te quedan ${q} min hoy` : 'Sin minutos hoy';
  el.classList.toggle('poco', q <= 3);
}
export function iniciarLimite(quien, aviso = () => {}, alAbrir = () => {}, alCerrar = () => {}) {
  let cfg = LS.get('limites', null) ? LS.get('limites', null).cfg : null;
  leerLimites().then((c) => { cfg = c; comprobar(); });
  let avisado = LS.get('uso-avisado', null);
  let releido = 0;
  function comprobar() {
    const q = quien() || {};
    const cerrada = q.demo ? cerradaDemo(cfg) : cerradaHasta(cfg, q.yo);
    const estaba = estadoLimite.cerrada;
    estadoLimite.cerrada = cerrada;
    if (cerrada) { taparHastaApertura(cerrada, cfg && cfg.mensajeApertura, !!q.demo); pintarQueda(null); if (!estaba && !q.demo) alCerrar(cerrada); return; }
    if (estaba) { destapar(); if (Date.now() >= estaba && !q.demo) alAbrir(); }
    const min = q.demo ? null : minutosDe(cfg, q.yo);
    // la primera vez, el total de hoy que lleva en el Worker (puede venir de la web o de otro móvil)
    // (solo si no hay ya una en marcha: si no, cada comprobación lanzaría otra que vuelve al momento y llama a
    // comprobar() otra vez, en bucle, y la app se queda congelada)
    if (min != null && !ultimoSync && !sincronizando) sincronizar(true).then(() => comprobar());
    const usados = usadosHoy();
    estadoLimite.min = min; estadoLimite.usados = usados;
    pintarQueda(min, usados);
    if (min == null) { destapar(); return; }
    if (usados >= min * 60) {
      tapar(min, usados);
      // por si el admin le ha dado minutos de más: se vuelve a mirar limites.json (como mucho cada 2 min)
      if (Date.now() - releido > 2 * 60e3) { releido = Date.now(); leerLimites(true).then((c) => { if (c) { cfg = c; comprobar(); } }); }
      return;
    }
    destapar();
    const quedan = min * 60 - usados;
    if (quedan <= 3 * 60 && avisado !== hoy()) { avisado = hoy(); LS.set('uso-avisado', avisado); aviso(`Te quedan ${Math.max(1, Math.round(quedan / 60))} min de app por hoy`); }
  }
  comprobarYa = comprobar;
  comprobar();
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      const q = quien() || {};
      // con la pantalla de «Se acabó por hoy» ya no se cuenta (ni se manda al servidor cada minuto)
      const agotado = estadoLimite.min != null && estadoLimite.usados >= estadoLimite.min * 60;
      if (!q.demo && q.yo && !estadoLimite.cerrada && !agotado) {
        sumar(CADA);
        if (estadoLimite.min != null) { porMandar += CADA; sincronizar(); }
      }
    }
    comprobar();
  }, CADA * 1000);
  // la configuración se vuelve a mirar cada media hora (por si el admin cambia los minutos)
  setInterval(() => leerLimites().then((c) => { if (c) cfg = c; comprobar(); }), 30 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') comprobar(); });
}
