/* Encuadra la cara de cada jugador en su círculo. Las fotos de LaLiga son recortes con fondo transparente y la
   cabeza no está siempre en el mismo sitio, así que se mira la foto: dónde empieza la silueta por arriba y dónde
   está la cabeza, y se recorta un cuadrado alrededor. Se calcula una vez por foto y se guarda. */
import { imagenDatos } from './puente.js';
import { LS } from './util.js';

const CLAVE = 'encuadres';
let memo = null;
const cache = () => (memo ||= LS.get(CLAVE, {}));
let guardarT = null;
const guardarLuego = () => {
  clearTimeout(guardarT);
  guardarT = setTimeout(() => {
    const c = cache();
    const k = Object.keys(c);
    if (k.length > 900) for (const x of k.slice(0, k.length - 700)) delete c[x];
    LS.set(CLAVE, c);
  }, 800);
};

/** dónde está la cara: { x, y, s } en fracciones de la foto (esquina de arriba a la izquierda y lado del cuadrado) */
function calcular(src) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      try {
        const N = 96;
        const cv = document.createElement('canvas');
        cv.width = N; cv.height = N;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        // la foto entera en el lienzo, respetando su proporción
        const r = img.naturalWidth / img.naturalHeight || 1;
        const w = r >= 1 ? N : N * r, h = r >= 1 ? N / r : N;
        const ox = (N - w) / 2, oy = (N - h) / 2;
        cx.drawImage(img, ox, oy, w, h);
        const d = cx.getImageData(0, 0, N, N).data;
        let opacos = 0;
        const filas = [];
        for (let y = 0; y < N; y++) {
          let a = -1, b = -1;
          for (let x = 0; x < N; x++) {
            if (d[(y * N + x) * 4 + 3] > 70) { if (a < 0) a = x; b = x; opacos++; }
          }
          filas.push(a < 0 ? null : [a, b]);
        }
        // sin transparencia (foto con fondo): la cara suele estar arriba en el centro
        if (opacos > N * N * 0.96) { ok({ x: 0.19, y: 0.02, s: 0.62 }); return; }
        const y0 = filas.findIndex((f) => f && f[1] - f[0] >= 2);
        let y1 = N - 1; while (y1 > y0 && !filas[y1]) y1--;
        if (y0 < 0) { ok(null); return; }
        const alto = y1 - y0 + 1;
        // la cabeza: las filas de arriba de la silueta (el primer 22 %), su centro y su anchura
        const banda = filas.slice(y0, y0 + Math.max(4, Math.round(alto * 0.22))).filter(Boolean);
        const centros = banda.map(([a, b]) => (a + b) / 2);
        const anchos = banda.map(([a, b]) => b - a + 1).sort((p, q) => p - q);
        const centro = centros.reduce((s, v) => s + v, 0) / centros.length;
        const ancho = anchos[Math.floor(anchos.length * 0.6)] || N * 0.3;
        let s = Math.min(1, Math.max(0.34, (ancho * 2.15) / N));
        let x = centro / N - s / 2;
        let y = y0 / N - s * 0.1;
        x = Math.max(-0.05, Math.min(1.05 - s, x));
        y = Math.max(-0.05, Math.min(1 - s, y));
        ok({ x: +x.toFixed(3), y: +y.toFixed(3), s: +s.toFixed(3) });
      } catch (e) { mal(e); }
    };
    img.onerror = () => mal(new Error('no se puede leer la imagen'));
    img.src = src;
  });
}

function aplicar(el, e) {
  if (!e) { el.classList.add('entera'); return; }
  const k = 100 / e.s;
  el.style.width = `${k}%`;
  el.style.height = `${k}%`;
  el.style.left = `${-e.x * k}%`;
  el.style.top = `${-e.y * k}%`;
  el.classList.add('lista');
}

const cola = [];
let activos = 0;
const esperando = new Map();
function siguiente() {
  while (activos < 3 && cola.length) {
    const url = cola.shift();
    activos++;
    imagenDatos(url).then(calcular).catch(() => null).then((e) => {
      cache()[url] = e || 0;
      guardarLuego();
      for (const el of esperando.get(url) || []) aplicar(el, e);
      esperando.delete(url);
      activos--;
      siguiente();
    });
  }
}

/** encuadra todas las caras que haya dentro de raiz */
export function encuadrar(raiz = document) {
  for (const el of raiz.querySelectorAll('img.cara:not([data-enc])')) {
    el.dataset.enc = '1';
    const url = el.getAttribute('src');
    const c = cache()[url];
    if (c !== undefined) { aplicar(el, c || null); continue; }
    if (esperando.has(url)) { esperando.get(url).push(el); continue; }
    esperando.set(url, [el]);
    cola.push(url);
  }
  siguiente();
}
