// La salud de cada fuente y los avisos del bot para Carlos (revisión total, M15 y A11).
//
// Salud: los errores de ESPN, futbolfantasy, FotMob, la prensa y LaLiga se tragaban (`.catch(() => null)`) y la ejecución acababa
// bien: nadie se enteraba de que una fuente llevaba horas sin contestar. Ahora cada petición de lib/http.mjs apunta aquí si la fuente
// ha contestado, y al acabar la ejecución (`cerrarSalud`) se guarda en el registro, por fuente: ejecuciones seguidas sin contestar,
// desde cuándo y el último error. Pasadas `salud.avisarTras` (6) se avisa a Telegram una vez, y otra cuando vuelve.
// Una fuente «contesta» en una ejecución si al menos una de sus peticiones ha tenido respuesta (un 404 es respuesta; un 5xx o sin red, no).
//
// Avisos: lo que Carlos tiene que saber al momento (un gol ya tuiteado que ESPN ha quitado, una roja que desaparece, un tuit que no se
// sabe si ha salido, una fuente caída). Van a una cola del registro (`avisos`) y los manda el paso «Avisos del bot» del workflow
// (telegram.mjs --aviso=bot), con su propio tope: no gastan los 3 avisos de fallo del día.
const EJECUCION = new Map();
// el control de «0 eventos en día de partido» (tipos/directo.mjs): ESPN contesta, pero sin partidos, y LaLiga tiene alguno en juego
export const FUENTE_PARTIDOS = 'ESPN, partidos en juego';

/** de qué fuente es una dirección */
export function fuenteDe(url) {
  let h = '';
  try { h = new URL(url).hostname; } catch { return null; }
  if (/espn\.com$/.test(h)) return 'ESPN';
  if (/futbolfantasy\.com$/.test(h)) return 'futbolfantasy';
  if (/fotmob\.com$/.test(h)) return 'FotMob';
  if (/llt-services\.com$|laliga\.(es|com)$/.test(h)) return 'LaLiga';
  if (/api\.(x|twitter)\.com$|anthropic\.com$|googleapis\.com$|telegram\.org$/.test(h)) return null;
  return 'prensa';
}

/** apunta una petición (o un control como «ESPN, partidos de hoy») en la cuenta de esta ejecución */
export function apuntarFuente(fuente, ok, error = '') {
  if (!fuente) return;
  const x = EJECUCION.get(fuente) || { ok: 0, mal: 0, error: '' };
  if (ok) x.ok++; else { x.mal++; x.error = String(error || 'sin respuesta').slice(0, 160); }
  EJECUCION.set(fuente, x);
}
/** lo de esta ejecución (para las pruebas) */
export const deEstaEjecucion = () => new Map(EJECUCION);
export const olvidarEjecucion = () => EJECUCION.clear();

const HORA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const hora = (t) => HORA.format(new Date(t));

/** mete un aviso en la cola (una vez por clave) */
export function encolarAviso(registro, clave, texto, ahora = Date.now()) {
  if (!registro || !registro.datos) return false;
  const cola = (registro.datos.avisos ||= []);
  if (cola.some((a) => a.clave === clave)) return false;
  cola.push({ clave, texto: String(texto).slice(0, 900), t: new Date(ahora).toISOString() });
  // (los de hace más de 3 días, fuera: ya se mandaron o ya no sirven)
  registro.datos.avisos = cola.filter((a) => ahora - Date.parse(a.t) < 3 * 864e5).slice(-60);
  return true;
}

/**
 * Pasa al registro la salud de esta ejecución y encola los avisos que toquen. Devuelve los avisos nuevos (textos).
 * `textos`: el texto del aviso de cada fuente especial (p. ej. «ESPN, partidos de hoy» → «0 eventos en día de partido»).
 */
export function cerrarSalud(registro, { config = {}, ahora = Date.now(), textos = {} } = {}) {
  const nuevos = [];
  if (!registro || !registro.datos) { EJECUCION.clear(); return nuevos; }
  const tras = (config.salud && config.salud.avisarTras) || 6;
  const tabla = (registro.datos.salud ||= {});
  for (const [f, x] of EJECUCION) {
    const s = (tabla[f] ||= { seguidas: 0 });
    if (x.ok) {
      if (s.avisado) {
        const txt = `✅ ${f} vuelve a contestar (fallaba desde las ${hora(Date.parse(s.desde))}, ${s.seguidas} ejecuciones).`;
        if (encolarAviso(registro, `salud|${f}|vuelve|${s.desde}`, txt, ahora)) nuevos.push(txt);
      }
      tabla[f] = { seguidas: 0, ultimaBien: new Date(ahora).toISOString() };
      continue;
    }
    if (!s.seguidas) s.desde = new Date(ahora).toISOString();
    s.seguidas++;
    s.error = x.error;
    if (s.seguidas >= tras && !s.avisado) {
      const que = textos[f] ? textos[f](s) : `${f} no contesta desde hace ${s.seguidas} ejecuciones (desde las ${hora(Date.parse(s.desde))})`;
      const txt = `⚠️ ${que}. Último error: ${s.error}`;
      if (encolarAviso(registro, `salud|${f}|${s.desde}`, txt, ahora)) nuevos.push(txt);
      s.avisado = true;
    }
  }
  EJECUCION.clear();
  return nuevos;
}
