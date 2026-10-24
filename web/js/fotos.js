/* Las fotos y capturas que le mandas a la IA en el chat.
   Cada una se reduce (1600 px el lado largo, JPEG): así se lee bien una captura del móvil y no pesa. La foto
   entera se guarda en el navegador (IndexedDB, las 40 últimas) para volver a mandársela si sigues hablando de
   ella; en el chat solo queda una miniatura. */

export const MAX_FOTOS = 4;
const LADO = 1600, LADO_MINI = 360;
const BD = 'fm-fotos', ALMACEN = 'f', GUARDAR = 40;
const memoria = new Map();

let bd = null;
function abrir() {
  if (bd) return bd;
  bd = new Promise((ok, mal) => {
    try {
      const r = indexedDB.open(BD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    } catch (e) { mal(e); }
  }).catch(() => null);
  return bd;
}
async function tx(modo, f) {
  const db = await abrir();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const t = db.transaction(ALMACEN, modo);
      const r = f(t.objectStore(ALMACEN));
      t.oncomplete = () => ok(r && 'result' in r ? r.result : true);
      t.onerror = () => ok(null);
      t.onabort = () => ok(null);
    } catch (e) { ok(null); }
  });
}

/** guarda la foto entera (y quita las más viejas) */
export async function guardarFoto(f) {
  memoria.set(f.id, f.b64);
  await tx('readwrite', (s) => s.put({ id: f.id, t: Date.now(), b64: f.b64 }));
  const todas = await tx('readonly', (s) => s.getAll());
  if (Array.isArray(todas) && todas.length > GUARDAR) {
    const viejas = todas.sort((a, b) => b.t - a.t).slice(GUARDAR);
    await tx('readwrite', (s) => viejas.forEach((v) => s.delete(v.id)));
  }
}
/** la foto entera en base64 (null si ya no está) */
export async function leerFoto(id) {
  if (memoria.has(id)) return memoria.get(id);
  const r = await tx('readonly', (s) => s.get(id));
  if (r && r.b64) { memoria.set(id, r.b64); return r.b64; }
  return null;
}

const cargarImg = (src) => new Promise((ok, mal) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = () => mal(new Error('No se puede abrir la imagen'));
  im.src = src;
});
function dibujar(im, lado, calidad) {
  const w0 = im.naturalWidth || im.width, h0 = im.naturalHeight || im.height;
  const f = Math.min(1, lado / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * f)), h = Math.max(1, Math.round(h0 * f));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); // las transparentes, sobre blanco
  g.drawImage(im, 0, 0, w, h);
  return { url: c.toDataURL('image/jpeg', calidad), w, h };
}
const nuevoId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** de un archivo (o lo que se pega o se arrastra) a { id, b64, mini, w, h } */
export async function prepararArchivo(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Eso no es una imagen');
  const url = URL.createObjectURL(file);
  try { return await preparar(url); } finally { URL.revokeObjectURL(url); }
}
/** de lo que devuelve la app (ya reducida, JPEG en base64) */
export const prepararB64 = (b64) => preparar(`data:image/jpeg;base64,${b64}`);

/*
 * una captura para un aviso de Fallo: más pequeña que las del chat (el servidor del Worker las guarda tal cual y tiene
 * poco tiempo para cada petición): lado largo de 1400 px y, si aún pasa de unos 650 KB, más pequeña
 */
async function captura(src) {
  const im = await cargarImg(src);
  let g = dibujar(im, 1400, 0.72);
  if (g.url.length > 650000) g = dibujar(im, 1100, 0.6);
  if (g.url.length > 650000) g = dibujar(im, 900, 0.5);
  return { id: nuevoId(), url: g.url, mini: dibujar(im, 240, 0.6).url };
}
export async function capturaArchivo(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Eso no es una imagen');
  const url = URL.createObjectURL(file);
  try { return await captura(url); } finally { URL.revokeObjectURL(url); }
}
export const capturaB64 = (b64) => captura(`data:image/jpeg;base64,${b64}`);

async function preparar(src) {
  const im = await cargarImg(src);
  const grande = dibujar(im, LADO, 0.85);
  const mini = dibujar(im, LADO_MINI, 0.6);
  return { id: nuevoId(), b64: grande.url.slice(grande.url.indexOf(',') + 1), mini: mini.url, w: grande.w, h: grande.h };
}
