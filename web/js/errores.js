/* Los fallos, explicados: qué ha pasado, qué hacer y con qué botones. Y los errores de la propia app (los que
   se escapan sin que nadie los recoja), apuntados para el diagnóstico. */

/** los últimos errores de la app que nadie ha recogido (para «Mandar un fallo») */
export const erroresApp = [];
function apuntarError(m, donde) {
  const t = String(m || '').slice(0, 300);
  if (!t || (erroresApp[0] && erroresApp[0].m === t)) return;
  erroresApp.unshift({ t: Date.now(), m: t, donde: donde ? String(donde).slice(0, 160) : '' });
  if (erroresApp.length > 15) erroresApp.length = 15;
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', (e) => apuntarError(e.message, e.filename ? `${String(e.filename).split('/').pop()}:${e.lineno}` : ''));
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason; apuntarError(r && (r.message || r), r && r.stack ? String(r.stack).split('\n')[1] : ''); });
}

const sinRed = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * de un error a { tipo, titulo, texto, botones }. tipo: red | laliga | cambio | sinLigas | vacia | sesion | otro.
 * botones: lista de acciones de la app (recargar, salir, entrarDemo, mandarFallo).
 */
export function explicarError(e) {
  const m = String((e && e.message) || e || '');
  const estado = e && e.estado;
  if (e && e.sesion) return { tipo: 'sesion', titulo: 'Hay que volver a entrar', texto: m, botones: [] };
  if (e && e.tipo === 'sinLigas') {
    return {
      tipo: 'sinLigas', titulo: 'Tu cuenta no tiene ligas',
      texto: 'La cuenta con la que has entrado no está en ninguna liga de LaLiga Fantasy. Si juegas con otra cuenta (otro correo u otro Google), sal y entra con esa. Si aún no tienes liga, únete a una o créala en la app de LaLiga Fantasy y vuelve.',
      botones: ['salir', 'entrarDemo'],
    };
  }
  if (e && e.tipo === 'vacia') {
    return {
      tipo: 'vacia', titulo: 'Tu liga ha llegado vacía',
      texto: 'LaLiga ha devuelto la liga sin equipos. Si la acabáis de crear, puede que aún no se haya apuntado nadie: vuelve cuando estéis dentro. Si no, suele ser un fallo suyo de un momento.',
      botones: ['recargar', 'mandarFallo'],
    };
  }
  if (sinRed() || estado === 0 || /sin conexi[oó]n|failed to fetch|network|timeout|timed out/i.test(m)) {
    return {
      tipo: 'red', titulo: 'Sin internet',
      texto: 'No llego a los servidores de LaLiga. Mira que tengas datos o wifi; en cuanto vuelva la conexión, lo intento yo solo.',
      botones: ['recargar'],
    };
  }
  if ((estado && estado >= 500) || estado === 429 || /respuesta rara|LaLiga responde 5|LaLiga responde 429/i.test(m)) {
    return {
      tipo: 'laliga', titulo: 'LaLiga no responde',
      texto: 'Sus servidores están fallando ahora mismo (cuando pasa, también falla su propia app). No es tu móvil ni tu cuenta: prueba en unos minutos.',
      botones: ['recargar', 'entrarDemo'],
    };
  }
  if (estado === 400 || estado === 403 || estado === 404 || estado === 405 || estado === 410) {
    return {
      tipo: 'cambio', titulo: 'LaLiga ha cambiado algo',
      texto: 'La app lee tu liga como lo hace la app de LaLiga, y LaLiga ha cambiado algo por su lado. Hace falta una actualización de Fantasy Manager: mándame el fallo con el botón y lo arreglo.',
      botones: ['mandarFallo', 'recargar'],
    };
  }
  return {
    tipo: 'otro', titulo: 'Algo ha fallado',
    texto: 'No he podido cargar tu liga. Vuelve a probar; si se repite, mándame el fallo con el botón.',
    botones: ['recargar', 'mandarFallo', 'entrarDemo'],
  };
}

/** lo corto que se enseña en una banda cuando ya hay datos (lo de antes sigue a la vista) */
export function bandaError(x, edad) {
  const hace = !edad || edad === 'ahora' ? 'hace un momento' : edad;
  if (x.tipo === 'red') return `Sin internet: lo que ves es de ${hace}`;
  if (x.tipo === 'laliga') return `LaLiga no responde: lo que ves es de ${hace}`;
  if (x.tipo === 'cambio') return `LaLiga ha cambiado algo y no puedo actualizar: lo que ves es de ${hace}`;
  return `No he podido actualizar: lo que ves es de ${hace}`;
}

const ETIQUETAS = { recargar: 'Volver a probar', salir: 'Entrar con otra cuenta', entrarDemo: 'Ver la liga de ejemplo', mandarFallo: 'Mandar el fallo' };
const ICONOS = { recargar: 'refrescar', salir: 'usuario', entrarDemo: null, mandarFallo: 'copiar' };
/** los botones de un fallo (el primero, el principal) */
export function botonesError(x, icono) {
  return x.botones.map((b, i) => `<button class="btn${i ? ' sec' : ''}" data-accion="${b}">${ICONOS[b] ? icono(ICONOS[b]) : ''}${ETIQUETAS[b]}</button>`).join('');
}
