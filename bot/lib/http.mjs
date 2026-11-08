// Peticiones con tiempo límite y reintentos. ESPN y varias webs pedían un User-Agent de navegador (con uno de bot, 403/406).
// Cada petición apunta si su fuente ha contestado (lib/salud.mjs: el aviso de «ESPN no contesta desde hace 6 ejecuciones»).
import { fuenteDe, apuntarFuente } from './salud.mjs';
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export async function get(url, { headers = {}, reintentos = 2, tiempo = 20000 } = {}) {
  let ultimo = null;
  for (let i = 0; i <= reintentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...headers }, signal: AbortSignal.timeout(tiempo) });
      const b = await r.text();
      if (r.status >= 500 && i < reintentos) { ultimo = new Error(`HTTP ${r.status}`); await new Promise((ok) => setTimeout(ok, 800 * (i + 1))); continue; }
      apuntarFuente(fuenteDe(url), r.status < 500, `HTTP ${r.status} en ${String(url).replace(/\?.*/, '')}`);
      return { s: r.status, b };
    } catch (e) { ultimo = e; await new Promise((ok) => setTimeout(ok, 800 * (i + 1))); }
  }
  apuntarFuente(fuenteDe(url), false, `${(ultimo && (ultimo.name === 'TimeoutError' ? 'sin respuesta a tiempo' : ultimo.message)) || 'sin respuesta'} en ${String(url).replace(/\?.*/, '')}`);
  throw ultimo || new Error('sin respuesta');
}

export async function json(url, opciones) {
  const r = await get(url, opciones);
  if (r.s !== 200) throw new Error(`HTTP ${r.s} en ${url.replace(/\?.*/, '')}`);
  try { return JSON.parse(r.b); } catch { throw new Error(`no es JSON: ${url.replace(/\?.*/, '')}`); }
}

// n tareas a la vez como mucho
export async function enParalelo(lista, n, f) {
  const out = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (i < lista.length) { const k = i++; out[k] = await f(lista[k], k).catch((e) => ({ error: String(e.message || e) })); }
  }));
  return out;
}
