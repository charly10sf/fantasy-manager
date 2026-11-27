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
import { rivalesInvitados, proximoCierreInv, semanaDoble, sinIntersticiales } from './invitar.js';
import { pedirWorker } from './soporte.js';
import { VERSION } from './version.js';
import { contar } from './eventos.js';

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
      aplicarSinFotos();
      // lo bloqueado depende de esto: si ha cambiado, que se vuelva a pintar
      if (antes !== JSON.stringify(cfg) && typeof window !== 'undefined') window.dispatchEvent(new Event('limites-nuevos'));
      return cfg;
    }
  } catch (e) { /* sin red: lo guardado, aunque sea viejo */ }
  return g ? g.cfg : null;
}

/* «sinFotos» en limites.json (fase 0 del roadmap): sin las caras de los jugadores ni los escudos y fotos que vienen de
   LaLiga, en toda la app y la web, sin sacar versión. Por si llega una queja: quedan las iniciales y los colores. Lo
   hace el CSS (html.sin-fotos) con las imágenes de los servidores de LaLiga; las tarjetas para compartir no las dibujan. */
export const sinFotos = () => { const g = LS.get('limites', null); return !!(g && g.cfg && g.cfg.sinFotos); };
export function aplicarSinFotos() { try { if (typeof document !== 'undefined') document.documentElement.classList.toggle('sin-fotos', sinFotos()); } catch (e) { /* nada */ } }
aplicarSinFotos();
/** lee limites.json (lo guardado si es reciente) y aplica «sinFotos»: para la portada, antes de entrar */
export const comprobarFotos = () => leerLimites().then(aplicarSinFotos, () => {});

/** ¿es este equipo uno de los de la lista? (por el nombre del equipo, su id o el id de la cuenta de LaLiga) */
function esDe(yo) {
  const n = norm(yo.nombre || ''), id = String(yo.teamId || ''), uid = String(yo.userId || '');
  return (k) => (norm(k) && norm(k) === n) || String(k) === id || (uid && String(k) === uid);
}
/* Las funciones top, bloqueadas.
   limites.json: «bloqueadas», cuáles lo están (si no lo dice, estas tres), y «todoAbierto», los equipos que las ven
   todas (si no lo dice, los de «sinLimite»). En la liga de ejemplo, bloqueadas.
   En la versión de Google Play (la que lleva anuncios) se abren viendo anuncios bonificados. Desde la 0.7.12 (Carlos,
   15 nov, 02:08: «TODO un solo anuncio salvo ver el dinero del rival durante 5 minutos, que serán 2»):
   - El dinero de un rival (dineroRivales), POR RIVAL: 2 anuncios seguidos lo abren 5 MINUTOS; como mucho 2 veces por
     jornada. «top» en limites.json: { "rivales": 2, "anuncios": 2, "minutos": 5 }.
   - Quién paga tu cláusula (quienPaga), de todos los rivales: 1 anuncio, 12 HORAS («horasQuien»: 12; Carlos, 27 nov: «durante 12 horas en vez de durante 5»). Sin tope.
   - Cuándo gira un jugador (inercia, y con ella el radar de subidas del Mercado): GRATIS desde el 27 nov (Carlos: «la
     pasamos a gratis»; es consejo del plan sobre tus jugadores, no algo de los rivales). Antes, con cualquier anuncio
     visto hoy, hasta las 00:00 de Madrid.
   Antes (0.6.3a-0.7.11f) las de los rivales iban por función: 2 anuncios, 2 veces por jornada y 1 hora, y a un amigo
   de Carlos le salieron dos rondas seguidas para ver a un solo rival.
   Si no hay anuncio que enseñar, se abre igual lo que pedías (un rival, que cuenta como una de las 2; quién paga y
   cuándo gira, media hora), pero solo una vez al día. En la de la liga, que no lleva anuncios, siguen como diga
   limites.json. Todo se guarda en el móvil: borrando los datos de la app se vuelve a empezar (no se puede evitar sin
   un servidor, y no compensa). */
const BLOQUEADAS = ['dineroRivales', 'quienPaga', 'quienPuja', 'parteRivales'];
/** las que van por rival (y unas veces por jornada): solo el dinero */
export const POR_JORNADA = ['dineroRivales'];
/** las que no conoce un limites.json leído por una versión anterior: con ese, cerradas hasta volver a leerlo */
const NUEVAS = ['quienPuja', 'parteRivales'];
const porJornada = (clave) => POR_JORNADA.includes(clave);
const num0 = (x, d) => (Number(x) > 0 ? Number(x) : d);
const cfgTop = () => {
  const g = LS.get('limites', null), t = (g && g.cfg && g.cfg.top) || {};
  return { rivales: Math.floor(num0(t.rivales, 2)), anuncios: Math.min(3, Math.floor(num0(t.anuncios, 2))), minutos: num0(t.minutos, 5), horasQuien: num0(t.horasQuien, 12), parteAnuncios: Math.min(3, Math.floor(num0(t.parteAnuncios, 2))) };
};
/** cuántos anuncios pide cada vez (los del dinero de un rival, todos seguidos) */
export const anunciosPorVez = (clave) => (porJornada(clave) ? cfgTop().anuncios : clave === 'parteRivales' ? cfgTop().parteAnuncios : 1);
/** cuánto queda abierto el dinero de un rival (minutos) y quién paga (horas) */
export const minutosRival = () => cfgTop().minutos;
export const horasQuien = () => cfgTop().horasQuien;
/** ¿se pueden abrir viendo un anuncio? (solo en la versión de Google Play) */
export const topConAnuncio = () => enApp && nativo.hayAnuncios();
let jornadaB = 0, inicioB = 0;
/** la jornada para contar las veces: la que se juega o, si no, la próxima (lo pone la app al rehacer los datos); `ini`:
    cuándo empieza la próxima (hasta entonces queda abierto el parte de los rivales) */
export function fijarJornada(n, ini = 0) { if (Number(n) > 0) jornadaB = Number(n); inicioB = Number(ini) > 0 ? Number(ini) : 0; }
/* el parte de los rivales (26 nov): { hasta, n, t } (n: los anuncios ya vistos de los que pide; t: cuándo se vio el último,
   para que uno visto hace días no cuente). Se abre hasta que empieza la próxima jornada (sin saberla, 24 h) */
// (0.8.5; Carlos, 26 nov, 23:07: «2 anuncios para que se desbloquee durante 24h») abierto 24 h.
// (0.8.5a; Carlos, 27 nov, 01:5x, con la propuesta: «sí, hazlo así») ABIERTO HASTA QUE EMPIECE LA JORNADA: el parte solo existe los 4
// días antes, y con 24 h quien lo quería seguir necesitaba hasta 8 anuncios y los avisos se cortaban. Sin saber cuándo empieza, 24 h.
// Más de 5 días guardados no valen (un valor raro no lo deja abierto para siempre)
const PARTE_H = 24 * 3600e3, PARTE_TOPE = 5 * 24 * 3600e3, PARTE_MAX = PARTE_TOPE + 60e3;
const parteG = () => { const g = LS.get('top-parte', null); return g && typeof g === 'object' ? g : {}; };
const parteHasta = () => { const h = Number(parteG().hasta), t = Date.now(); return Number.isFinite(h) && h > t && h - t <= PARTE_MAX ? h : 0; };
const parteVistos = () => { const g = parteG(), n = Math.floor(Number(g.n)); return Number(g.t) > 0 && Date.now() - g.t < 12 * 3600e3 && n > 0 ? Math.min(n, cfgTop().parteAnuncios - 1) : 0; };
const abrirParte = (ms = 0) => { const t = Date.now(), fin = parteFin(); LS.set('top-parte', { hasta: ms ? t + ms : fin || t + PARTE_H, n: ms ? parteVistos() : 0, t: ms ? Number(parteG().t) || t : t }); };
/** cuándo empieza la próxima jornada (0 si no se sabe): hasta entonces queda abierto el parte */
export const inicioJornada = () => (inicioB > Date.now() ? inicioB : 0);
/** (0.8.5a) hasta cuándo lo abrirían los anuncios ahora: el inicio de la jornada si se sabe y está a 5 días o menos; si no, 0 (24 h) */
export const parteFin = () => { const i = inicioJornada(); return i && i - Date.now() <= PARTE_TOPE ? i : 0; };

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
/* el dinero de los rivales: { j, usos, abiertos: { tid: hasta }, uno: { tid, n } } (uno: los anuncios ya vistos del
   rival que estás abriendo; se guarda aunque cambie la jornada, para no hacerle ver otra vez el que ya vio) */
function rivalesTop() {
  const g = LS.get('top-rivales', null);
  const ab = g && g.abiertos && !Array.isArray(g.abiertos) ? g.abiertos : {};
  if (g && (g.j === jornadaB || !jornadaB)) return { j: g.j, usos: g.usos || 0, abiertos: ab, uno: g.uno || null };
  return { j: jornadaB, usos: 0, abiertos: ab, uno: (g && g.uno) || null };
}
const guardarRivales = (g) => LS.set('top-rivales', g);
const abrirRival = (g, rid, min) => guardarRivales({ j: g.j, usos: g.usos + 1, abiertos: { ...g.abiertos, [String(rid)]: Date.now() + min * 60e3 }, uno: null });
/* (19 nov) y los que se abren invitando a un amigo (invitar.js), en la liga que se ve: lo pone la app con fijarLiga */
let ligaB = '';
export function fijarLiga(l) { ligaB = String(l || ''); }
/** los rivales abiertos: { tid: hasta }, los de los anuncios y los de las invitaciones (el plazo más largo) */
function abiertosTodos() {
  const ab = { ...rivalesTop().abiertos };
  if (ligaB && !demoB) for (const [k, h] of Object.entries(rivalesInvitados(ligaB))) ab[k] = Math.max(ab[k] || 0, h);
  return ab;
}
/** los rivales con el dinero abierto ahora (sus teamId, en texto) */
export const rivalesAbiertos = () => { const ab = abiertosTodos(), t = Date.now(); return Object.keys(ab).filter((k) => ab[k] > t); };
const abiertoRival = (rid) => rid != null && rivalesAbiertos().includes(String(rid));
/** hasta cuándo está abierto el dinero de ese rival (0 si no) */
export const rivalAbiertoHasta = (rid) => (abiertoRival(rid) ? abiertosTodos()[String(rid)] : 0);
/** ¿lo tiene abierto por una invitación? (para decirlo en su ficha) */
export const rivalPorInvitar = (rid) => rid != null && !!ligaB && !demoB && (rivalesInvitados(ligaB)[String(rid)] || 0) > Date.now();
/* quién paga: { hasta } */
const quienHasta = () => { const g = LS.get('top-quien', null); return g && g.hasta > Date.now() ? g.hasta : 0; };
/** la hora más cercana a la que se cierra algo abierto por un rato (para volver a pintar), o 0 */
export function proximoCierreTop() {
  const t = Date.now(), hs = [...Object.values(abiertosTodos()), quienHasta(), parteHasta(), hoyTop().libreHasta, proximoCierreInv()].filter((h) => h > t);
  return hs.length ? Math.min(...hs) : 0;
}
/** hasta cuándo está abierta (las de un rato); 0 si no lo está o si va hasta medianoche */
export function abiertaHasta(clave, rid = null) {
  if (porJornada(clave)) return rivalAbiertoHasta(rid);
  if (clave === 'quienPaga') return quienHasta();
  if (clave === 'parteRivales') return parteHasta();
  return 0;
}

/** ¿está abierta ahora? (el dinero, para ese rival) */
export function topAbierto(clave, rid = null) {
  if (porJornada(clave)) return abiertoRival(rid);
  if (clave === 'quienPaga') return quienHasta() > 0;
  if (clave === 'parteRivales') return parteHasta() > 0;
  const h = hoyTop();
  return h.vistos > 0 || Date.now() < h.libreHasta;
}
/** cuántas veces te quedan para abrir el dinero de un rival esta jornada */
export const usosQuedan = (clave) => (porJornada(clave) ? Math.max(0, cfgTop().rivales - rivalesTop().usos) : Infinity);
export const usosPorJornada = () => cfgTop().rivales;
/** cuántos anuncios te faltan para abrirla (el dinero, para ese rival) */
export function faltanAnuncios(clave, rid = null) {
  if (topAbierto(clave, rid)) return 0;
  if (clave === 'parteRivales') return Math.max(1, cfgTop().parteAnuncios - parteVistos());
  if (!porJornada(clave)) return 1;
  const u = rivalesTop().uno, n = cfgTop().anuncios;
  return u && rid != null && String(u.tid) === String(rid) ? Math.max(1, n - (u.n || 0)) : n;
}
/** un anuncio visto hasta el final, para esa función (y ese rival). Devuelve si ya se ha abierto */
export function anuncioTopVisto(clave, rid = null) {
  const h = hoyTop();
  guardarHoy({ ...h, vistos: h.vistos + 1 });
  contar('b');
  if (clave === 'quienPaga') { LS.set('top-quien', { hasta: Date.now() + cfgTop().horasQuien * 3600e3 }); contar('t'); return true; }
  if (clave === 'parteRivales') {
    const n = parteVistos() + 1;
    if (n < cfgTop().parteAnuncios) { LS.set('top-parte', { hasta: 0, n, t: Date.now() }); return false; }
    abrirParte(); contar('t'); return true;
  }
  if (!porJornada(clave)) { contar('t'); return true; }
  if (rid == null) return false;
  const g = rivalesTop(), c = cfgTop();
  const vistos = (g.uno && String(g.uno.tid) === String(rid) ? g.uno.n || 0 : 0) + 1;
  if (vistos < c.anuncios) { guardarRivales({ ...g, uno: { tid: String(rid), n: vistos } }); return false; }
  abrirRival(g, rid, c.minutos);
  contar('t');
  return true;
}
/** sin anuncio que enseñar (sin consentimiento, sin relleno, un DNS que los bloquea…): gratis UNA vez al día por
    dispositivo, contando todas las funciones top juntas (Carlos, 14 nov). La segunda vez del día ya no se abre */
export const puedeTopGratis = () => { const g = LS.get('top-sin-anuncio', null); return !g || g.dia !== diaDe(); };
/** sin anuncio que enseñar: se abre igual lo que pedías (el dinero de un rival, sus minutos y cuenta como una de las
    veces; quién paga y cuándo gira, «min» minutos). Apunta el día (`puedeTopGratis`) */
export function abrirTopGratis(clave, min = 30, rid = null) {
  LS.set('top-sin-anuncio', { dia: diaDe() });
  if (clave === 'quienPaga') { LS.set('top-quien', { hasta: Date.now() + min * 60e3 }); return; }
  if (clave === 'parteRivales') { abrirParte(min * 60e3); return; }
  if (!porJornada(clave)) { const h = hoyTop(); guardarHoy({ ...h, libreHasta: Date.now() + min * 60e3 }); return; }
  if (rid == null) return;
  abrirRival(rivalesTop(), rid, cfgTop().minutos);
}
/* «planes» en limites.json: los planes del día con la IA de Carlos (el Worker, /plan). on: si van por ahí (si no, como
   antes: con la clave de Google de cada uno); gratis y max: los de cada día y el tope con anuncios. Quien cuenta de verdad
   es el Worker (lee el mismo limites.json); esto es para los textos. Sin «planes» (un limites.json de antes), apagado. */
export function planesCfg() {
  const g = LS.get('limites', null), p = (g && g.cfg && g.cfg.planes) || null;
  const n = (x, d) => (Number(x) >= 0 ? Math.floor(Number(x)) : d);
  // (web: las búsquedas en Google de cada plan; las decide el Worker, aquí solo es para los textos)
  // (17 nov) en la web y el iPhone (sin anuncios para pedir más) valen los gratis de «gratisWeb», si los hay
  const gratis = n(p && p.gratis, 2), gw = !enApp ? n(p && p.gratisWeb, 0) : 0;
  // (19 nov) con la semana doble de invitar a amigos, el doble (lo cuenta el servidor; esto es para los textos)
  const x = semanaDoble() ? 2 : 1;
  return { on: !!(p && p.on), gratis: Math.max(gratis, gw) * x, max: Math.max(n(p && p.max, 5), gw) * x, web: Math.min(3, n(p && p.web, 0)), doble: x === 2 };
}
/** (16 nov) las preguntas del chat con la IA de la app (el Worker, /pregunta): «preguntas» de limites.json. porAnuncio: las que
    da cada anuncio bonificado cuando se acaban las gratis */
export function preguntasCfg() {
  const g = LS.get('limites', null), p = (g && g.cfg && g.cfg.preguntas) || null;
  const n = (x, d) => (Number(x) >= 0 ? Math.floor(Number(x)) : d);
  const gratis = n(p && p.gratis, 3), x = semanaDoble() ? 2 : 1;
  return { on: !!(p && p.on), gratis: gratis * x, max: Math.max(gratis, n(p && p.max, 6)) * x, porAnuncio: Math.max(1, n(p && p.porAnuncio, 3)), doble: x === 2 };
}
/** (0.8) los intersticiales de la app de Google Play (intersticial.js): «intersticial» de limites.json. Los minutos van en ms.
    cada: minutos de uso entre uno y otro, contando desde la primera vez que se abre la app en el día y sumando todas las
    visitas (20 nov, Carlos); sesion: minutos sin ninguno cada vez que se abre la app, aunque ya toque («sesionMin», 1;
    «graciaMin» ya solo lo leen las webs de antes del 20 nov); maxDia: cuántos al día; trasBonificado: minutos sin intersticial después de un bonificado; bloque:
    el id del bloque de AdMob (si la app no lo lleva puesto; Android solo acepta los de la cuenta de Carlos); suLiga: si
    también a los de sus ligas («ligas»). Sin «intersticial» (o con «on»: false), ninguno */
/** el bloque de anuncios de limites.json, si la app no lo lleva puesto: en la app de iOS, «bloqueIos» (los bloques de
    AdMob son distintos en cada plataforma); en la de Google Play, «bloque», como siempre */
function bloqueDe(p) {
  const b = p && (enApp && nativo.canal() === 'ios' ? p.bloqueIos : p.bloque);
  return typeof b === 'string' && /^ca-app-pub-\d{16}\/\d{10}$/.test(b) ? b : '';
}
export function intersticialCfg() {
  const g = LS.get('limites', null), p = (g && g.cfg && g.cfg.intersticial) || null;
  const n = (x, d, min, max) => { const v = Number(x); return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d; };
  return {
    on: !!(p && p.on), sesion: n(p && p.sesionMin, 1, 0, 30) * 60e3, cada: n(p && p.cadaMin, 7, 3, 240) * 60e3,
    maxDia: Math.floor(n(p && p.maxDia, 5, 0, 20)), trasBonificado: n(p && p.trasBonificadoMin, 3, 0, 60) * 60e3,
    bloque: bloqueDe(p), suLiga: !!(p && p.suLiga),
    // (para que Carlos los vea en su móvil, que está como dispositivo de prueba en AdMob: le salen «de prueba»)
    dueno: !!(p && p.dueno),
  };
}
/** (17 nov, Carlos) el anuncio de apertura: uno al día como mucho al abrir la app (intersticial.js decide si toca hoy y
    Android lo enseña solo en los primeros segundos). «apertura» de limites.json: on y bloque (si la app no lo lleva) */
export function aperturaCfg() {
  const g = LS.get('limites', null), p = (g && g.cfg && g.cfg.apertura) || null;
  return { on: !!(p && p.on), bloque: bloqueDe(p) };
}
let yoB = null, demoB = false;
/** (26 nov) «otrasLigas» de limites.json: lo de las demás ligas que se enseña en la ficha de un libre (lo pagado por él y su
    demanda). Cada cosa: false o sin poner (a nadie), 'dueño' (solo a los de «todoAbierto», para verlo con datos de verdad
    antes de abrirlo) o true (a todos). Quien manda es el servidor, que lee lo mismo: apagado, no devuelve nada */
export function otrasLigasCfg() {
  const g = LS.get('limites', null), cfg = g && g.cfg, o = (cfg && cfg.otrasLigas) || {};
  const soy = !!(cfg && yoB && !demoB && (cfg.todoAbierto || []).some(esDe(yoB)));
  const on = (x) => !demoB && !!yoB && (x === true || ((x === 'dueño' || x === 'dueno') && soy));
  return { pagado: on(o.pagado), demanda: on(o.demanda) };
}
/** ¿a esta cuenta se le enseñan intersticiales? Al dueño no (salvo «dueno», para probarlos); a los de sus ligas, solo con «suLiga» */
export function intersticialParaMi() {
  const g = LS.get('limites', null), cfg = g && g.cfg;
  if (!cfg || !yoB || demoB) return false;
  if ([...(cfg.todoAbierto || []), ...(cfg.sinLimite || [])].some(esDe(yoB))) return intersticialCfg().dueno;
  // (19 nov) con 5 amigos invitados, 30 días sin intersticiales ni el de apertura (los bonificados siguen)
  if (sinIntersticiales()) return false;
  if (!intersticialCfg().suLiga && Array.isArray(cfg.ligas) && enSusLigas(cfg, yoB)) return false;
  return true;
}
/** quién eres para lo bloqueado (lo pone la app cada vez que rehace los datos) */
export function fijarYo(yo, demo) { yoB = yo || null; demoB = !!demo; }
/** ¿cerrada? Las de los rivales, con «rid», para ese rival (abierto con sus anuncios esta jornada); sin «rid», si
    está cerrada en general (para lo que mezcla a todos los rivales) */
export function bloqueada(clave, rid = null) {
  const g = LS.get('limites', null), cfg = g && g.cfg;
  const lista = cfg && Array.isArray(cfg.bloqueadas) ? cfg.bloqueadas : BLOQUEADAS;
  if (!lista.includes(clave) && !(NUEVAS.includes(clave) && cfg && g.v !== VERSION)) return false;
  if (topAbierto(clave, rid)) return false;
  if (demoB || !yoB || !cfg) return true;
  return !(cfg.todoAbierto || cfg.sinLimite || []).some(esDe(yoB));
}

/** 'real' para todos; para el dueño, 'prueba' (con «anunciosWebDueno»: true: anuncios de prueba, que no cuentan, para
    ver cómo quedan y cazar fallos) o nada; null antes de saber quién eres o con «anunciosWeb» apagado */
export function anunciosWebModo() {
  const g = LS.get('limites', null), cfg = g && g.cfg;
  if (!cfg || cfg.anunciosWeb !== true || !yoB) return null;
  const dueno = [...(cfg.todoAbierto || []), ...(cfg.sinLimite || [])].some(esDe(yoB));
  // (sesión 8, M8) los de sus ligas («ligas» de limites.json), sin anuncios de verdad, salvo «intersticial.suLiga» (17 nov,
  // Carlos: anuncios para todos, también los de su liga; el dueño sigue sin ellos)
  if (!dueno && Array.isArray(cfg.ligas) && enSusLigas(cfg, yoB) && !intersticialCfg().suLiga) return null;
  if (!dueno) return 'real';
  return cfg.anunciosWebDueno === true ? 'prueba' : null;
}
export const anunciosWebOk = () => anunciosWebModo() === 'real';
/* El APK de GitHub (el de la liga) se despide (Carlos, 14 nov): desde la 0.7.10 todo va por Google Play, el APK ya no se
   actualiza y deja de funcionar a la semana. «cierreApk» en limites.json mueve la fecha (false: solo el aviso, sin cerrar).
   Al dueño no se le cierra: la pre-release «prueba» de pendiente es un APK de GitHub */
const CIERRE_APK = '2026-11-21T23:59:00+01:00';
export function cierreApk() {
  const g = LS.get('limites', null), cfg = (g && g.cfg) || {};
  const f = cfg.cierreApk === false ? 0 : Date.parse(cfg.cierreApk || CIERRE_APK) || Date.parse(CIERRE_APK);
  const dueno = !!yoB && [...(cfg.todoAbierto || []), ...(cfg.sinLimite || [])].some(esDe(yoB));
  return { hasta: f, cerrada: !!f && Date.now() > f && !dueno };
}
/* La app de Google Play está por debajo de «playMin» de limites.json (0.7.13w): ya hay otra en la tienda y esta, con la
   parte del móvil de antes, deja de recibir la web nueva. «playMin» se sube al código nuevo solo cuando Google lo ha
   aprobado (si no, la banda manda a una ficha que aún no la tiene). Sin «playMin», nada */
export function playDesfasada() {
  if (!enApp || nativo.canal() !== 'play') return false;
  const g = LS.get('limites', null), cfg = (g && g.cfg) || {};
  const min = Math.round(Number(cfg.playMin) || 0), mia = Math.round(Number(nativo.version()) || 0);
  return min > 0 && mia > 0 && mia < min;
}
/* (iOS 3) lo mismo en la app de iOS con «iosMin» (el número de compilación de la versión que ya ha aprobado Apple): por
   debajo, la banda lleva a la App Store. Sin «iosMin», nada */
export function iosDesfasada() {
  if (!enApp || nativo.canal() !== 'ios') return false;
  const g = LS.get('limites', null), cfg = (g && g.cfg) || {};
  const min = Math.round(Number(cfg.iosMin) || 0), mia = Math.round(Number(nativo.version()) || 0);
  return min > 0 && mia > 0 && mia < min;
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

/** ¿puede ver las novedades de las versiones (el aviso al actualizar y la lista de Ajustes)? Desde la 0.7z, nadie
   salvo el dueño (Carlos, 8 nov: tampoco los de la liga), a no ser que limites.json lleve «novedadesTodos»: true. null
   si aún no se ha leído limites.json (no se sabe). El dueño no pasa por aquí: lo ve todo (avisosGuardados().admin).
   `yo` se queda en la firma por si vuelve a ir por ligas */
export function novedadesPara(yo) {
  const g = LS.get('limites', null);
  if (!g || !g.cfg) return null;
  return g.cfg.novedadesTodos === true;
}

/** (20 nov, Carlos: «no quiero que les salga nada de las novedades a ninguno, a no ser que yo te lo estipule») La lista
    «Novedades» de Ajustes con lo importante de cada versión (la del 11 nov), a quien no es el dueño: solo si limites.json
    lleva «novedadesImportantes»: true. Sin eso, a los demás no les sale nada de las versiones en Ajustes */
export function importantesPara() {
  const g = LS.get('limites', null);
  return !!(g && g.cfg && g.cfg.novedadesImportantes === true);
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

/* el total de hoy entre todos tus dispositivos, según el Worker (más lo de aquí que aún no se ha mandado)
   Desde la 0.7t se manda para todos (el dueño ve en «Quién usa la app» cuánto pasa cada uno al día): con límite, cada
   minuto, como antes; sin límite, cada 5 minutos y al dejar la app (lo que no llega se guarda y va en la siguiente),
   para no gastar las escrituras gratis del servidor. */
const SIN_LIMITE_CADA = 300;
const pendiente = () => { const x = LS.get('uso-pend', null); return x && x.dia === diaDe() ? Number(x.seg) || 0 : 0; };
let porMandar = pendiente(), sincronizando = false, ultimoSync = 0;
const guardarPendiente = () => LS.set('uso-pend', { dia: diaDe(), seg: porMandar });
const enServidor = () => { const x = LS.get('uso-srv', null); return x && x.dia === hoy() ? x.seg : null; };
function usadosHoy() { const l = usoHoy(), s = enServidor(); return s == null ? l : Math.max(l, s + porMandar); }
async function sincronizar(forzar = false) {
  if (sincronizando || (!forzar && Date.now() - ultimoSync < 60e3)) return;
  sincronizando = true;
  const mando = Math.min(600, porMandar);
  try {
    const r = await pedirWorker('POST', '/uso', { seg: mando });
    porMandar = Math.max(0, porMandar - mando);
    guardarPendiente();
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
        porMandar += CADA; guardarPendiente();
        if (estadoLimite.min != null) sincronizar();
        else if (porMandar >= SIN_LIMITE_CADA) sincronizar(true);
      }
    }
    comprobar();
  }, CADA * 1000);
  // la configuración se vuelve a mirar cada media hora (por si el admin cambia los minutos)
  setInterval(() => leerLimites().then((c) => { if (c) cfg = c; comprobar(); }), 30 * 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') comprobar();
    // al dejar la app, lo que falte por mandar (si no llega, sale en la siguiente)
    else if (porMandar > 0 && !(quien() || {}).demo) sincronizar(true);
  });
}
