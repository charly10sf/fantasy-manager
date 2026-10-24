/* La API de LaLiga Fantasy (la que usa su app; no es pública) y la página de mercado de futbolfantasy.com.
   Las rutas salen del proyecto abierto LaLigaApp (github.com/Externoak/LaLigaApp), temporada 26/27:
   casi todo cuelga de /v1/competition/1 (1 = LaLiga). Cada petición queda apuntada en el registro para
   el diagnóstico de Ajustes. */
import { http } from './puente.js';
import { token, renovar, ErrorSesion } from './auth.js';

const HOST = 'https://fantasy-api.llt-services.com', BASE = `${HOST}/api`;
const CMP = '/v1/competition/1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const registro = [];
export const apuntarRegistro = (x) => apuntar(x);
function apuntar(x) {
  registro.unshift({ t: Date.now(), ...x });
  if (registro.length > 120) registro.length = 120;
}

export class ErrorApi extends Error {
  constructor(m, estado, cuerpo) { super(m); this.estado = estado; this.cuerpo = cuerpo; }
}

/** cómo es una respuesta (las claves y el tamaño de las listas), para el diagnóstico sin datos personales */
export function forma(x, prof = 0) {
  if (x == null) return String(x);
  if (Array.isArray(x)) return `[${x.length}${x.length ? ' × ' + forma(x[0], prof + 1) : ''}]`;
  if (typeof x !== 'object') return typeof x;
  if (prof > 2) return '{…}';
  return '{' + Object.keys(x).slice(0, 14).map((k) => `${k}${prof < 2 && x[k] && typeof x[k] === 'object' ? ':' + forma(x[k], prof + 1) : ''}`).join(', ') + (Object.keys(x).length > 14 ? ', …' : '') + '}';
}

async function pedir(ruta, { metodo = 'GET', otraVez = true, reintento = true } = {}) {
  const t0 = Date.now();
  // (las estadísticas de la jornada cuelgan de /stats, fuera de /api)
  const url = (ruta.startsWith('/stats/') ? HOST : BASE) + ruta + (ruta.includes('?') ? '&' : '?') + 'x-lang=es';
  const tk = await token();
  const r = await http(metodo, url, {
    cabeceras: { Authorization: `Bearer ${tk}`, 'x-app': '2', 'x-lang': 'es', Accept: 'application/json', 'User-Agent': UA },
  });
  const base = { ruta, s: r.s, ms: Date.now() - t0 };
  if (r.s === 401 && otraVez) {
    apuntar({ ...base, nota: 'sesión caducada, se renueva' });
    await renovar();
    return pedir(ruta, { metodo, otraVez: false });
  }
  if (r.s === 401) { apuntar(base); throw new ErrorSesion('LaLiga no acepta la sesión: vuelve a entrar'); }
  // sin conexión (con datos móviles a veces no llega a conectar): una lectura se prueba una vez más antes de darla por perdida
  if (r.s === 0 && metodo === 'GET' && reintento) {
    apuntar({ ...base, e: r.e, nota: 'sin conexión: se prueba otra vez' });
    await new Promise((ok) => setTimeout(ok, 800));
    return pedir(ruta, { metodo, otraVez, reintento: false });
  }
  if (r.s === 0) { apuntar({ ...base, e: r.e }); throw new ErrorApi(`Sin conexión (${r.e})`, 0); }
  let j = null;
  const texto = r.b || '';
  if (texto.trim()) {
    try { j = JSON.parse(texto); } catch (e) {
      apuntar({ ...base, e: 'no es JSON', muestra: texto.slice(0, 120) });
      throw new ErrorApi(`Respuesta rara de LaLiga (${r.s})`, r.s, texto.slice(0, 300));
    }
  }
  if (r.s >= 400) {
    const m = (j && (j.message || j.error || j.title)) || texto.slice(0, 160);
    apuntar({ ...base, e: m });
    throw new ErrorApi(`LaLiga responde ${r.s}${m ? ': ' + m : ''}`, r.s, texto.slice(0, 300));
  }
  apuntar({ ...base, forma: forma(j) });
  return j;
}

export const api = {
  yo: () => pedir('/v4/user/me'),
  ligas: () => pedir(`${CMP}/leagues`),
  clasificacion: (liga) => pedir(`${CMP}/leagues/${liga}/standing`),
  equipo: (liga, eq) => pedir(`${CMP}/leagues/${liga}/teams/${eq}`),
  dinero: (eq) => pedir(`${CMP}/teams/${eq}/money`),
  mercado: (liga) => pedir(`${CMP}/league/${liga}/market`),
  crudo: (ruta) => pedir(ruta),
  formaciones: () => pedir('/v4/teams/lineup/formations?option=free'),
  ofertas: (liga, ptId) => pedir(`${CMP}/league/${liga}/playerTeam/${ptId}/offer`),
  jugadores: () => pedir(`${CMP}/players`),
  jugador: (id, liga) => pedir(`${CMP}/player/${id}/league/${liga}`),
  semana: () => pedir(`${CMP}/week/current`),
  calendario: (n) => pedir(`${CMP}/calendar?weekNumber=${n}`),
  equiposLaLiga: () => pedir('/v3/teams-master'),
  actividad: (liga, i = 0) => pedir(`${CMP}/leagues/${liga}/activity/${i}`),
  // la jornada en directo (vivo.js)
  statsSemana: (n) => pedir(`/stats/v1/competition/1/stats/week/${n}`),
  miOnce: (eq) => pedir(`${CMP}/teams/${eq}/lineup`),
  onceSemana: (eq, n) => pedir(`${CMP}/teams/${eq}/lineup/week/${n}`),
  clasifSemana: (liga, n) => pedir(`${CMP}/leagues/${liga}/standing/${n}`),
};

/** la página de mercado de futbolfantasy.com (valor y subida o bajada de cada jugador en el día) */
export async function paginaMercado() {
  const t0 = Date.now();
  const r = await http('GET', 'https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado', {
    cabeceras: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-ES,es;q=0.9', 'User-Agent': UA },
  });
  apuntar({ ruta: 'futbolfantasy /mercado', s: r.s, ms: Date.now() - t0, e: r.e, forma: r.b ? `${Math.round(r.b.length / 1024)} KB` : '' });
  if (r.s !== 200 || !r.b) throw new ErrorApi(`futbolfantasy responde ${r.s || r.e}`, r.s);
  return r.b;
}

/** el número de la última versión publicada de la app (lo escribe la Action en app.json) */
export async function ultimaVersion() {
  // del dominio de la app; si no contesta, de GitHub (donde estaba antes de la mudanza)
  for (const u of ['https://fantasymanagerapp.com/app.json', 'https://raw.githubusercontent.com/charly10sf/fantasy-manager/main/app.json']) {
    const r = await http('GET', `${u}?t=${Date.now()}`, { tiempo: 15000 });
    if (r.s !== 200) continue;
    try { return JSON.parse(r.b); } catch (e) { /* la siguiente */ }
  }
  return null;
}
