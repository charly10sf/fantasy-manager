/* El límite de uso diario (para los amigos viciados): cuántos minutos al día puede tener cada uno la app abierta.
   Y la hora de apertura («abre» en limites.json): hasta entonces, a todos menos a los de «sinLimite» les sale la
   cuenta atrás en vez de la app (pueden instalarla y entrar con su cuenta, pero no ver nada).
   Lo decide web/limites.json, que se lee de GitHub (cambiarlo en main lo cambia para todos sin sacar versión).
   Solo cuenta el tiempo con la app a la vista; los avisos y la IA trabajando sola siguen igual. Se reinicia a las
   00:00, hora de Madrid. Al pasarse, una pantalla de «hasta mañana» tapa la app.
   El tiempo se suma también en el Worker, por cuenta de LaLiga: así los minutos son en total, entre la app y la web
   (y en cualquier dispositivo). Sin conexión, cuenta lo de este dispositivo. */
import { LS, norm, diaDe, esc, LOGO, dura } from './util.js';
import { http, enApp, nativo } from './puente.js';
import { pedirWorker } from './soporte.js';

const URL_APP = 'https://raw.githubusercontent.com/charly10sf/fantasy-manager/main/web/limites.json';
const CADA = 15; // segundos entre cuentas
const FRASES = [
  'Ni Mbappé entrena tanto. Sal a que te dé el aire.',
  'La cláusula seguirá ahí mañana. Tu vida social, a lo mejor no.',
  'Hasta los cracks tienen día de descanso.',
  'El mercado cambia de madrugada lo mires o no.',
  'Míster, por hoy ya ha hecho bastante.',
  'Ni el VAR revisa tanto como tú.',
];

/** la configuración: la guardada (vale 6 horas) o la de GitHub */
async function leerLimites() {
  const g = LS.get('limites', null);
  if (g && Date.now() - g.t < 6 * 3600e3) return g.cfg;
  try {
    let cfg = null;
    if (enApp) {
      const r = await http('GET', `${URL_APP}?t=${Date.now()}`, { tiempo: 12000 });
      if (r.s === 200 && r.b) cfg = JSON.parse(r.b);
    } else {
      const r = await fetch(`limites.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) cfg = await r.json();
    }
    if (cfg) {
      const antes = JSON.stringify(g && g.cfg);
      LS.set('limites', { t: Date.now(), cfg });
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
/* Las funciones top, bloqueadas hasta que lleguen los anuncios (entonces se desbloquearán viendo uno).
   limites.json: «bloqueadas», cuáles lo están (si no lo dice, estas tres), y «todoAbierto», los equipos que las ven
   todas (si no lo dice, los de «sinLimite»). En la liga de ejemplo, bloqueadas. */
const BLOQUEADAS = ['dineroRivales', 'quienPaga', 'inercia'];
let yoB = null, demoB = false;
/** quién eres para lo bloqueado (lo pone la app cada vez que rehace los datos) */
export function fijarYo(yo, demo) { yoB = yo || null; demoB = !!demo; }
export function bloqueada(clave) {
  const g = LS.get('limites', null), cfg = g && g.cfg;
  const lista = cfg && Array.isArray(cfg.bloqueadas) ? cfg.bloqueadas : BLOQUEADAS;
  if (!lista.includes(clave)) return false;
  if (demoB || !yoB || !cfg) return true;
  return !(cfg.todoAbierto || cfg.sinLimite || []).some(esDe(yoB));
}

/** los minutos de un equipo (null: sin límite) */
export function minutosDe(cfg, yo) {
  if (!cfg || !yo) return null;
  const es = esDe(yo);
  if ((cfg.sinLimite || []).some(es)) return null;
  for (const [k, m] of Object.entries(cfg.equipos || {})) if (es(k)) return Number(m) >= 0 ? Number(m) : null;
  return Number(cfg.minutos) > 0 ? Number(cfg.minutos) : null;
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
  if ((cfg.sinLimite || []).some(esDe(yo))) return null;
  return t;
}
/** «hoy a las 20:00», «mañana a las 20:00» o «el sábado 24 a las 20:00» (hora de Madrid) */
function cuandoAbre(t) {
  const f = (x, o) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...o }).format(new Date(x));
  const dia = (x) => f(x, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const hora = f(t, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (dia(t) === dia(Date.now())) return `hoy a las ${hora}`;
  if (dia(t) === dia(Date.now() + 864e5)) return `mañana a las ${hora}`;
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
function hastaMedianoche() {
  const ahora = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).formatToParts(ahora).map((x) => [x.type, x.value]));
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
    : `<p class="lim-vuelve">Ya has entrado con tu cuenta: a esa hora, abre la app y estará todo listo.${enApp ? ' Mientras, se pone al día sola con los arreglos que vayan saliendo.' : ''}</p>${enApp ? (nativo.avisosPermitidos() ? '<p class="lim-vuelve">Te llegará una notificación cuando se abra.</p>' : '<button class="btn" data-accion="permisoApertura">Avísame cuando se abra</button>') : ''}`}${botonNueva()}</div>`;
  if (!el) {
    el = document.createElement('div');
    el.id = 'limite'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'limT');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  document.body.classList.add('limitado');
}
function destapar() {
  const el = document.getElementById('limite');
  if (el) el.remove();
  document.body.classList.remove('limitado');
}

/** lo último que se ha comprobado (para enseñarlo en Ajustes): minutos de límite (null: sin límite), segundos usados y si está cerrada */
export const estadoLimite = { min: null, usados: 0, cerrada: null };

/**
 * empieza a contar. quien() da { yo, demo } (yo: tu equipo, con nombre y teamId); aviso(texto) enseña un aviso corto
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
  function comprobar() {
    const q = quien() || {};
    const cerrada = q.demo ? cerradaDemo(cfg) : cerradaHasta(cfg, q.yo);
    const estaba = estadoLimite.cerrada;
    estadoLimite.cerrada = cerrada;
    if (cerrada) { taparHastaApertura(cerrada, cfg && cfg.mensajeApertura, !!q.demo); pintarQueda(null); if (!estaba && !q.demo) alCerrar(cerrada); return; }
    if (estaba) { destapar(); if (Date.now() >= estaba && !q.demo) alAbrir(); }
    const min = q.demo ? null : minutosDe(cfg, q.yo);
    // la primera vez, el total de hoy que lleva en el Worker (puede venir de la web o de otro móvil)
    if (min != null && !ultimoSync) sincronizar(true).then(() => comprobar());
    const usados = usadosHoy();
    estadoLimite.min = min; estadoLimite.usados = usados;
    pintarQueda(min, usados);
    if (min == null) { destapar(); return; }
    if (usados >= min * 60) { tapar(min, usados); return; }
    destapar();
    const quedan = min * 60 - usados;
    if (quedan <= 3 * 60 && avisado !== hoy()) { avisado = hoy(); LS.set('uso-avisado', avisado); aviso(`Te quedan ${Math.max(1, Math.round(quedan / 60))} min de app por hoy`); }
  }
  comprobarYa = comprobar;
  comprobar();
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      const q = quien() || {};
      if (!q.demo && q.yo && !estadoLimite.cerrada) {
        sumar(CADA);
        if (estadoLimite.min != null) { porMandar += CADA; sincronizar(); }
      }
    }
    comprobar();
  }, CADA * 1000);
  // la configuración se vuelve a mirar cada 6 horas (por si el admin cambia los minutos)
  setInterval(() => leerLimites().then((c) => { cfg = c; comprobar(); }), 6 * 3600e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') comprobar(); });
}
