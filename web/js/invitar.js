/* Invita a un amigo (19 nov; idea de Domy, diseño de Carlos). Solo gana quien invita:
   - por cada amigo que entra con su código, el dinero de 2 rivales que elige él durante 24 h desde que entra el amigo;
   - con 3 amigos que vuelven otro día, una semana con el doble de planes y preguntas gratis;
   - con 5, 30 días sin anuncios a pantalla completa (ni el de abrir la app).
   Quien cuenta y decide es el servidor (Worker, /invitar); aquí se guarda lo último que dijo (LS 'invitar') para pintar
   sin esperar a la red, se recoge el código del enlace (?inv=) y se canjea al entrar en una liga. Los números, en
   «invitar» de limites.json (el servidor los manda con el estado, en `cfg`). */
import { LS } from './util.js';
import { pedirWorker } from './soporte.js';

const DOMINIO = 'https://fantasymanagerapp.com/';
const LETRAS = /^[A-HJ-NP-Z2-9]{6}$/;
/** el código como lo escribe la gente: en mayúsculas, sin espacios, con la O como 0 y la I como 1 */
export const limpiarCod = (x) => String(x == null ? '' : x).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').slice(0, 12);
export const codValido = (x) => LETRAS.test(limpiarCod(x));

/* ---------- el código que llega con el enlace ---------- */
/** ?inv=CODIGO en la dirección: se guarda (7 días) hasta que entra en su liga, y se quita de la barra */
export function leerCodigoEnlace() {
  try {
    const p = new URLSearchParams(location.search);
    const c = limpiarCod(p.get('inv'));
    if (!p.has('inv')) return '';
    p.delete('inv');
    history.replaceState(null, '', location.pathname + (p.toString() ? `?${p}` : '') + location.hash);
    if (!codValido(c)) return '';
    LS.set('inv-cod', { cod: c, t: Date.now() });
    return c;
  } catch (e) { return ''; }
}
/** el código del enlace que espera a canjearse (o '') */
export const codigoPendiente = () => { const x = LS.get('inv-cod', null); return x && codValido(x.cod) && Date.now() - x.t < 14 * 86400e3 ? x.cod : ''; };

/* ---------- lo que dice el servidor ---------- */
/** lo último que dijo el servidor de esta cuenta (o null) */
export function estadoInv(uid = null) {
  const g = LS.get('invitar', null);
  if (!g || !g.est) return null;
  if (uid != null && String(g.uid) !== String(uid)) return null;
  return g.est;
}
const guardar = (uid, est) => { if (est && est.ok !== false) LS.set('invitar', { uid: String(uid || ''), t: Date.now(), est }); return est; };
let pidiendo = null;
/** pide el estado al servidor (como mucho cada 20 min, salvo `ya`). Devuelve { est, nuevos } (nuevos: amigos que han entrado
    desde la última vez que se miró, para el aviso) */
export async function leerInvitar(uid, { ya = false } = {}) {
  const g = LS.get('invitar', null);
  if (!ya && g && String(g.uid) === String(uid) && Date.now() - g.t < 20 * 60e3) return { est: g.est, nuevos: 0 };
  if (pidiendo) return pidiendo;
  pidiendo = (async () => {
    try {
      const est = await pedirWorker('GET', '/invitar', null, { tiempo: 15000 });
      const antes = g && String(g.uid) === String(uid) && g.est ? g.est.entran || 0 : null;
      guardar(uid, est);
      return { est, nuevos: antes == null ? 0 : Math.max(0, (est.entran || 0) - antes) };
    } finally { pidiendo = null; }
  })();
  return pidiendo;
}
/** tu código (lo saca la primera vez) */
export async function miCodigo(uid) {
  const e = estadoInv(uid);
  if (e && e.cod) return e.cod;
  const est = await pedirWorker('POST', '/invitar/codigo', {}, { tiempo: 15000 });
  guardar(uid, est);
  return est.cod;
}
/** canjea un código al entrar (el del enlace o el que escribe). { ok, e } */
export async function canjear(uid, cod, liga) {
  try {
    const r = await pedirWorker('POST', '/invitar/canjear', { cod: limpiarCod(cod), liga: String(liga || '') }, { tiempo: 15000 });
    LS.del('inv-cod');
    LS.set('inv-hecho', { t: Date.now() });
    await leerInvitar(uid, { ya: true }).catch(() => {});
    return { ok: true, ya: !!r.ya };
  } catch (e) {
    const m = e.datos && e.datos.motivo;
    // (lo que no va a valer nunca, fuera: si es la liga, se reintenta al entrar en una)
    if (m && m !== 'liga') LS.del('inv-cod');
    return { ok: false, e: e.message, motivo: m || '' };
  }
}
/** elige rivales con la invitación i (en la liga de ahora) */
export async function elegirRivales(uid, i, liga, tids) {
  const est = await pedirWorker('POST', '/invitar/rivales', { i, liga: String(liga), tids: tids.map(String) }, { tiempo: 15000 });
  return guardar(uid, est);
}

/* ---------- lo que se ha ganado ---------- */
const est0 = () => { const g = LS.get('invitar', null); return (g && g.est) || null; };
/** ¿tiene ahora ese premio? ('doble' o 'sinIntersticiales'); hasta cuándo, o 0 */
export function premioHasta(premio, ahora = Date.now()) {
  const e = est0(), p = e && e.premios && e.premios[premio];
  return p && p.hasta > ahora ? p.hasta : 0;
}
export const semanaDoble = () => premioHasta('doble') > 0;
export const sinIntersticiales = () => premioHasta('sinIntersticiales') > 0;
/** los rivales abiertos por invitaciones en esa liga: { tid: hasta } (el plazo más largo si sale en dos) */
export function rivalesInvitados(liga, ahora = Date.now()) {
  const e = est0(), out = {};
  if (!e || !Array.isArray(e.amigos)) return out;
  for (const a of e.amigos) {
    if (!(a.hasta > ahora) || String(a.l) !== String(liga || '')) continue;
    for (const t of a.r || []) out[String(t)] = Math.max(out[String(t)] || 0, a.hasta);
  }
  return out;
}
/** las invitaciones con rivales por elegir aún dentro de plazo: [{ i, hasta, quedan }] */
export function porElegir(ahora = Date.now()) {
  const e = est0(), n = (e && e.cfg && e.cfg.rivales) || 2;
  if (!e || !Array.isArray(e.amigos)) return [];
  return e.amigos.filter((a) => a.hasta > ahora && (a.r || []).length < n).map((a) => ({ i: a.i, hasta: a.hasta, quedan: n - (a.r || []).length, liga: a.l || '' }));
}
/** cuántos rivales se dan por amigo y cuántas horas */
export const cfgInv = () => { const e = est0(); const c = (e && e.cfg) || {}; return { rivales: c.rivales || 2, horas: c.horas || 24, diasCodigo: c.diasCodigo ?? 7, escalones: c.escalones || [{ n: 3, premio: 'doble', dias: 7 }, { n: 5, premio: 'sinIntersticiales', dias: 30 }] }; };
export const invitarOn = () => { const e = est0(); return !e || e.on !== false; };
/** el nombre de cada premio, para la gente */
export const PREMIO_TXT = { doble: (d) => `${d === 7 ? 'una semana' : `${d} días`} con el doble de planes y preguntas gratis`, sinIntersticiales: (d) => `${d === 30 ? 'un mes' : `${d} días`} sin anuncios a pantalla completa` };
/** el contador: «Llevas 2 de 3 para la semana doble» (o null si ya lo tiene todo) */
export function contadorTxt(e = est0()) {
  if (!e) return null;
  const s = e.sig;
  if (!s) return null;
  const que = s.premio === 'doble' ? (s.dias === 7 ? 'la semana doble' : `${s.dias} días dobles`) : s.dias === 30 ? 'un mes sin anuncios' : `${s.dias} días sin anuncios`;
  return `Llevas ${Math.min(e.cuentan || 0, s.n)} de ${s.n} para ${que}`;
}
/** ¿le sale «¿Te ha invitado alguien?»? (cuenta nueva sin invitación, en sus primeros días) */
export const puedeCanjear = (uid) => { const e = estadoInv(uid); return !!(e && e.puedeCanjear && !e.invitado && !LS.get('inv-hecho', null)); };

/* ---------- lo que se comparte ---------- */
export const enlaceInv = (cod) => `${DOMINIO}?inv=${encodeURIComponent(cod)}`;
/** el mensaje para WhatsApp: habla de la app; al amigo no se le promete nada (Carlos, 19 nov). (25 nov) El código, en su
    propia línea y en negrita de WhatsApp (*…*), con lo que tiene que hacer con él: casi todos la instalan desde Google
    Play, que pierde el enlace, y el código hay que escribirlo a mano al entrar */
export const textoInv = (cod) => `Uso Fantasy Manager para LaLiga Fantasy: cada día me dice qué fichar, qué vender y a quién clausular. Es gratis.

Descárgala aquí: ${enlaceInv(cod)}

Mi código de invitación: *${cod}*
Cuando entres con tu cuenta de LaLiga, la app te pregunta si te ha invitado alguien: pon ese código.`;
/** para repintar al cerrarse algo: la hora más cercana a la que se cierra un rival o un premio (o 0) */
export function proximoCierreInv(ahora = Date.now()) {
  const e = est0();
  if (!e) return 0;
  const hs = [...(e.amigos || []).filter((a) => (a.r || []).length).map((a) => a.hasta), ...Object.values(e.premios || {}).map((p) => p.hasta)].filter((h) => h > ahora);
  return hs.length ? Math.min(...hs) : 0;
}
