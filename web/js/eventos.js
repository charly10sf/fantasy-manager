/* Lo que se cuenta del uso (fase 0 del roadmap, 4 nov 2026): cuántas veces pasa cada cosa por día, nada más (ni qué
   jugador, ni qué pregunta, ni qué liga). Se guarda en el dispositivo y viaja con el saludo a /hola, que lo suma a la
   ficha r:<cuenta> como mucho dos veces al día (las escrituras gratis del servidor son unas mil al día para todo).
   Lo que pasa antes de entrar con la cuenta (empezar el login, ver la guía de la clave) espera a que haya sesión.

   p plan pedido · q pregunta en el chat · b anuncio bonificado visto · t función top abierta · l login empezado ·
   e entrada hecha (login, QR o código) · v guía de la clave vista (una vez al día) · c clave guardada ·
   n invitación a tu liga mandada · i llegó con una invitación (una vez) · a/A carga de la liga bien (A con jornada en
   juego) · f/F carga fallida (F con jornada en juego: el bloqueo de Cloudflare en los partidos) */
import { LS, diaDe } from './util.js';

export const EVENTOS = { p: 'planes pedidos', q: 'preguntas al chat', b: 'anuncios bonificados', t: 'funciones top abiertas', l: 'logins empezados', e: 'entradas hechas', v: 'guía de la clave vista', c: 'claves guardadas', n: 'invitaciones mandadas', i: 'llegadas por invitación', a: 'cargas bien', A: 'cargas bien en jornada', f: 'cargas fallidas', F: 'cargas fallidas en jornada' };

/** apunta un evento; con una: true, solo si hoy aún no se había apuntado */
export function contar(k, { una = false } = {}) {
  if (!EVENTOS[k]) return;
  try {
    const e = LS.get('eventos', {}) || {};
    const d = diaDe();
    const hoy = e[d] || (e[d] = {});
    if (una && hoy[k]) return;
    hoy[k] = (hoy[k] || 0) + 1;
    // como mucho dos semanas sin mandar (si no hay sesión en todo ese tiempo, lo viejo se tira)
    for (const x of Object.keys(e).sort().slice(0, -14)) delete e[x];
    LS.set('eventos', e);
  } catch (err) { /* contar nunca puede romper nada */ }
}
/** lo que queda por mandar: { 'AAAA-MM-DD': { p: 2, … } } */
export const pendientes = () => LS.get('eventos', {}) || {};
/** el servidor ya lo ha sumado: se resta lo mandado (lo que haya pasado mientras, se queda) */
export function mandados(env) {
  const e = pendientes();
  for (const [d, cs] of Object.entries(env || {})) {
    if (!e[d]) continue;
    for (const [k, n] of Object.entries(cs)) { e[d][k] = (e[d][k] || 0) - n; if (e[d][k] <= 0) delete e[d][k]; }
    if (!Object.keys(e[d]).length) delete e[d];
  }
  LS.set('eventos', e);
}
