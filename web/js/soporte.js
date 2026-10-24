/* Los avisos de fallos: se mandan al Worker (con la sesión de LaLiga, para saber quién es) y el dueño de la app
   los lee y los contesta desde la propia app. La respuesta le llega a quien lo mandó la próxima vez que la abre. */
import { http, enApp, WORKER_PUBLICO } from './puente.js';
import { token } from './auth.js';
import { LS } from './util.js';

/** una petición al Worker con la sesión de LaLiga (para saber quién es); también la usa el límite de minutos */
export async function pedirWorker(metodo, ruta, cuerpo = null, { tiempo = 20000 } = {}) {
  const tk = await token(); // sin sesión de LaLiga lanza un error de sesión
  const cab = { Authorization: `Bearer ${tk}`, 'content-type': 'application/json', Accept: 'application/json' };
  let s, b;
  if (enApp) {
    const r = await http(metodo, WORKER_PUBLICO + ruta, { cabeceras: cab, cuerpo: cuerpo ? JSON.stringify(cuerpo) : null, tiempo });
    s = r.s; b = r.b;
    if (s === 0) throw Object.assign(new Error('Sin conexión: vuelve a probar en un rato'), { estado: 0 });
  } else {
    let r;
    try { r = await fetch(WORKER_PUBLICO + ruta, { method: metodo, headers: cab, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); } catch (e) { throw Object.assign(new Error('Sin conexión: vuelve a probar en un rato'), { estado: 0 }); }
    s = r.status; b = await r.text();
  }
  let j = null;
  try { j = JSON.parse(b || 'null'); } catch (e) { j = null; }
  if (s >= 400 || !j) throw Object.assign(new Error((j && j.e) || `El servidor de avisos responde ${s}`), { estado: s, sesion: !!(j && j.sesion) });
  return j;
}

/** lo último que se sabe (para el numerito del botón sin esperar a la red) */
export const avisosGuardados = () => LS.get('avisos', { t: 0, lista: [], admin: false, pendientes: 0 });
/** respuestas tuyas sin leer + (si eres el dueño) avisos sin contestar */
export function numeroAvisos() {
  const a = avisosGuardados();
  return (a.lista || []).filter((x) => x.respuesta && !x.vista).length + (a.admin ? a.pendientes || 0 : 0);
}
/** ¿merece la pena preguntar? solo si has mandado alguno o eres el dueño (para no gastar el servidor por nada) */
export const hayQueMirar = () => { const a = avisosGuardados(); return !!(a.admin || (a.lista || []).some((x) => !x.respuesta || !x.vista) || LS.get('avisos-mandado', 0)); };

export async function mandarAviso(datos) {
  // (con capturas, más tiempo: son unos cientos de KB)
  const r = await pedirWorker('POST', '/fallos', datos, { tiempo: datos.capturas && datos.capturas.length ? 60000 : 20000 });
  LS.set('avisos-mandado', Date.now());
  return r;
}
/**
 * tus avisos con sus respuestas (y si eres el dueño, cuántos hay sin contestar). Devuelve también lo nuevo desde la
 * última vez: respuestas que no habías visto llegar y avisos recibidos de más, para avisar.
 */
export async function misAvisos() {
  const antes = avisosGuardados();
  const r = await pedirWorker('GET', '/fallos/mios');
  const ya = new Set(LS.get('avisos-notificados', []));
  const nuevasResp = (r.lista || []).filter((x) => x.respuesta && !x.vista && !ya.has(`${x.id}:${x.respondida}`));
  const nuevosRecibidos = r.admin ? Math.max(0, (r.pendientes || 0) - (antes.admin ? antes.pendientes || 0 : 0)) : 0;
  LS.set('avisos', { t: Date.now(), lista: r.lista || [], admin: !!r.admin, pendientes: r.pendientes || 0, yo: r.yo });
  if (nuevasResp.length) LS.set('avisos-notificados', [...ya, ...nuevasResp.map((x) => `${x.id}:${x.respondida}`)].slice(-60));
  return { ...r, nuevasResp, nuevosRecibidos };
}
export async function marcarVisto(id) {
  await pedirWorker('POST', '/fallos/visto', { id });
  const a = avisosGuardados();
  LS.set('avisos', { ...a, lista: (a.lista || []).map((x) => (x.id === id ? { ...x, vista: true } : x)) });
}
export const todosAvisos = () => pedirWorker('GET', '/fallos/todos');
/** los sin contestar contados por la app (la cuenta del servidor llega con retraso tras contestar) */
export function fijarPendientes(n) { const a = avisosGuardados(); if (a.admin) LS.set('avisos', { ...a, pendientes: n }); }

/* quién usa la app: cada app avisa al abrirse (y cada 10 minutos a la vista) y el dueño ve la lista */
export async function saludar(datos) {
  if (Date.now() - LS.get('hola-t', 0) < 9 * 60e3) return;
  LS.set('hola-t', Date.now());
  try { await pedirWorker('POST', '/hola', datos); } catch (e) { LS.set('hola-t', 0); }
}
export const quienUsa = () => pedirWorker('GET', '/hola/todos');
export const unAviso = (id) => pedirWorker('GET', `/fallos/uno?id=${encodeURIComponent(id)}`);
/** una captura de un aviso: data:image/… (la tuya o, si eres el dueño, la de cualquiera) */
export const capturaAviso = (id, n) => pedirWorker('GET', `/fallos/captura?id=${encodeURIComponent(id)}&n=${Number(n) || 0}`, null, { tiempo: 30000 }).then((r) => r.img);
export async function responderAviso(id, respuesta) {
  const r = await pedirWorker('POST', '/fallos/responder', { id, respuesta });
  const a = avisosGuardados();
  if (a.admin) LS.set('avisos', { ...a, pendientes: Math.max(0, (a.pendientes || 0) - 1) });
  return r;
}
