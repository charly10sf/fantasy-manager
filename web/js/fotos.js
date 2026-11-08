/* Las fotos y capturas que le mandas a la IA en el chat.
   Cada una se reduce (1600 px el lado largo, JPEG): así se lee bien una captura del móvil y no pesa. La foto
   entera se guarda en el navegador (IndexedDB, las 40 últimas) para volver a mandársela si sigues hablando de
   ella; en el chat solo queda una miniatura. Las miniaturas también van a IndexedDB (almacén «m», las 400 últimas) y
   el chat guardado solo lleva su id: en localStorage ocupaban decenas de KB cada una y lo llenaban (revisión total,
   A8). Las de antes de la 0.7z, que iban dentro del chat, se pasan solas (migrarMinis, en ia.js). */

export const MAX_FOTOS = 4;
const LADO = 1600, LADO_MINI = 360;
const BD = 'fm-fotos', ALMACEN = 'f', GUARDAR = 40, MINIS = 'm', GUARDAR_MINIS = 400;
const memoria = new Map(), minis = new Map();

let bd = null;
function abrir() {
  if (bd) return bd;
  bd = new Promise((ok, mal) => {
    try {
      const r = indexedDB.open(BD, 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(MINIS)) db.createObjectStore(MINIS, { keyPath: 'id' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    } catch (e) { mal(e); }
  }).catch(() => null);
  return bd;
}
async function tx(modo, f, almacen = ALMACEN) {
  const db = await abrir();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const t = db.transaction(almacen, modo);
      const r = f(t.objectStore(almacen));
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

/** la miniatura de una foto del chat, si ya está en memoria (si no, null: cargarMinis la trae) */
export const miniDe = (id) => minis.get(id) || null;
/** guarda una miniatura (data:…). Devuelve si ha quedado en IndexedDB */
export async function guardarMini(id, mini) {
  if (!id || !mini) return false;
  minis.set(id, mini);
  const ok = await tx('readwrite', (s) => s.put({ id, t: Date.now(), mini }), MINIS);
  if (!ok) return false;
  // de vez en cuando, fuera las más viejas
  if (Math.random() < 0.1) {
    const todas = await tx('readonly', (s) => s.getAllKeys(), MINIS);
    if (Array.isArray(todas) && todas.length > GUARDAR_MINIS) {
      const filas = await tx('readonly', (s) => s.getAll(), MINIS);
      const viejas = (filas || []).sort((a, b) => b.t - a.t).slice(GUARDAR_MINIS);
      await tx('readwrite', (s) => viejas.forEach((v) => s.delete(v.id)), MINIS);
    }
  }
  return true;
}
/** trae a memoria las miniaturas de esos ids (las que falten); devuelve cuántas ha traído */
export async function cargarMinis(ids) {
  const faltan = [...new Set(ids)].filter((id) => id && !minis.has(id));
  if (!faltan.length) return 0;
  const filas = await tx('readonly', (s) => s.getAll(), MINIS);
  let n = 0;
  for (const f of filas || []) if (f && f.mini && faltan.includes(f.id)) { minis.set(f.id, f.mini); n++; }
  return n;
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
