// La versión de la app. La Action de Android la lee de aquí para nombrar el APK.
// Numeración: la 0.1.0 es la primera completa (las anteriores pasaron a ser la 0.0.1 a la 0.0.11). A partir de
// aquí, cada versión sube el último número (0.1.1, 0.1.2…) y el del medio solo con un cambio grande.
export const VERSION = '0.1.0';

// Lo nuevo de cada versión, de la más nueva a la más vieja. Al abrir una versión nueva se presenta bajando
// (presentacion.js); la lista entera está en Ajustes.
// Cada cosa: tipo (nuevo | mejora | arreglo), d (el dibujo, de dibujos.js), t (título), x (texto) e ir (a dónde
// lleva «Verlo»: { v: pestaña, seg: 'pestaña:sección' }).
export const NOVEDADES = [
  {
    v: '0.1.0', f: '2026-10-20', h: '21:05', t: 'Háblale y te hace caso',
    cosas: [
      { tipo: 'nuevo', d: 'voz', t: 'Pregúntale hablando', x: 'Toca el micro en Pregunta, o «Cuéntale algo» en el plan de hoy. Usa el dictado de Google y la IA te contesta al momento.', ir: { v: 'ia' } },
      { tipo: 'nuevo', d: 'nota', t: 'Lo que le cuentas, cuenta', x: 'Si un amigo te ofrece un jugador, piensas vender a alguien o no quieres soltar a otro, díselo. Lo apunta y lo tiene en cuenta en el plan, en el chat y cuando trabaja con la app cerrada.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'lupa', t: 'Te dice si te compensa', x: 'Cuando nombras a un jugador, la IA recibe todos sus datos: lo que vale, lo que ha subido en 7 y 30 días, de quién es, su cláusula, si es titular y sus próximos rivales. Te contesta con cifras y te dice qué vender para que te llegue.' },
      { tipo: 'mejora', d: 'plan', t: 'Lo apuntado, a la vista', x: 'Arriba en Pregunta y en la ficha de cada jugador. Bórralo cuando ya no valga. Cuando apuntas algo nuevo, el plan se rehace.' },
      { tipo: 'nuevo', d: 'scroll', t: 'Novedades que se cuentan bajando', x: 'Como estas: cada versión nueva se presenta así. La lista entera está en Ajustes → Novedades.' },
      { tipo: 'mejora', d: 'versiones', t: 'Versiones sin prisa', x: 'La numeración empieza de nuevo: esta es la 0.1 y las de antes son de la 0.0.1 a la 0.0.11.' },
    ],
  },
  {
    v: '0.0.11', f: '2026-10-20', h: '20:41', t: 'La IA trabaja sola',
    cosas: [
      { tipo: 'nuevo', d: 'noche', t: 'Trabaja con la app cerrada', x: 'Cada 3 horas, y unos minutos después de cada cambio de mercado, pone tu liga al día y rehace el plan con Gemini.' },
      { tipo: 'nuevo', d: 'campana', t: 'Notificaciones de lo importante', x: 'El plan nuevo con sus pasos, las ofertas por tus jugadores, si te clausulan a alguien y lo que fichas. Cada aviso llega una vez y nunca de madrugada.' },
      { tipo: 'mejora', d: 'ajustes', t: 'Tú decides', x: 'Se apaga en Ajustes → «Trabaja con la app cerrada». Ahí ves también cuándo trabajó por última vez.' },
    ],
  },
  {
    v: '0.0.10', f: '2026-10-20', h: '20:31', t: 'El precio, en gráfica',
    cosas: [
      { tipo: 'nuevo', d: 'grafica', t: 'El valor de cada jugador', x: 'En su ficha: 7 días, 1 mes o 3 meses, con lo que ha subido o bajado y su máximo y mínimo. Si no es tuyo, se pide su histórico a LaLiga al abrirla.' },
      { tipo: 'arreglo', d: 'arreglo', t: 'Medias con un decimal', x: 'Se acabó el «5,555555555555555 de media».' },
    ],
  },
  {
    v: '0.0.9', f: '2026-10-20', h: '20:29', t: 'El once del Fantasy y el rival',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'Tu once, como en el Fantasy', x: 'Césped, cromos con la cara y el nombre, los puntos esperados, el valor o la forma, y el banquillo debajo.', ir: { v: 'equipo', seg: 'equipo:plantilla' } },
      { tipo: 'nuevo', d: 'semaforo', t: 'No es lo mismo el Barça que el colista', x: 'Cada jugador lleva su próximo rival en verde, ámbar o rojo según la clasificación de LaLiga, y la ficha enseña sus tres próximos partidos. Los puntos esperados y la IA lo tienen en cuenta.' },
      { tipo: 'arreglo', d: 'conexion', t: 'La IA ya no se corta a medias', x: 'Mientras prepara el plan, la app no pierde internet aunque salgas de ella, mantiene viva la conexión con Google y, si se corta, vuelve a probar sola. Te avisa al terminar.' },
    ],
  },
  {
    v: '0.0.8', f: '2026-10-20', h: '20:09', t: 'Gemini encuentra el camino',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: '«Unable to resolve host», resuelto', x: 'Si el DNS del móvil o del wifi no encuentra el servidor de Gemini, la app se lo pregunta por https a Cloudflare o a Google.' },
    ],
  },
  {
    v: '0.0.7', f: '2026-10-20', h: '20:05', t: 'Deuda fija y modelos explicados',
    cosas: [
      { tipo: 'mejora', d: 'dinero', t: 'La deuda, siempre al 20 %', x: 'Como en el juego: ya no hay que elegirla en Ajustes.' },
      { tipo: 'mejora', d: 'ia', t: 'Los modelos de tu clave, explicados', x: 'Ajustes te dice a cuántas versiones de Gemini te da acceso tu clave y cuántas han gastado ya el cupo de hoy.' },
    ],
  },
  {
    v: '0.0.6', f: '2026-10-20', h: '20:00', t: 'Onces, prensa e histórico',
    cosas: [
      { tipo: 'nuevo', d: 'camiseta', t: 'Onces probables', x: 'De futbolfantasy: cada jugador dice si sale de titular, suplente o fuera, y cuenta para tu once y para la IA.' },
      { tipo: 'nuevo', d: 'periodico', t: 'Titulares de prensa', x: 'De tus jugadores, de los candidatos y de las webs de fantasy, de los últimos días.' },
      { tipo: 'nuevo', d: 'grafica', t: 'Histórico de valor de LaLiga', x: 'Para tus jugadores y los candidatos, sin esperar a que la app vaya apuntando días.' },
      { tipo: 'mejora', d: 'dinero', t: 'Especular con colchón', x: 'Aunque lo comprado baje un 8 %, al venderlo vuelves a positivo.' },
    ],
  },
  {
    v: '0.0.5', f: '2026-10-20', h: '19:50', t: 'Para el once o para revender',
    cosas: [
      { tipo: 'nuevo', d: 'camiseta', t: 'Dos tipos de fichaje', x: 'Para tu once o para revender: cada paso del plan dice cuál es.' },
      { tipo: 'nuevo', d: 'especular', t: 'Especular entre semana', x: 'Comprar lo que sube aunque no te haga falta, bajando hasta el límite de deuda, y venderlo el día antes de la jornada.', ir: { v: 'mercado', seg: 'mercado:especular' } },
      { tipo: 'mejora', d: 'nota', t: 'Lo que compras para revender, apuntado', x: 'El plan te dice cuándo venderlo. También lo puedes marcar tú desde la ficha.' },
    ],
  },
  {
    v: '0.0.4', f: '2026-10-20', h: '19:43', t: 'La IA arranca',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'La IA ya contesta', x: 'Las preguntas a Gemini salen por la parte nativa de la app. Antes el navegador de dentro las cortaba con «Failed to fetch».' },
      { tipo: 'nuevo', d: 'campo', t: 'Posiciones y formaciones gratis', x: 'El plan solo te ficha jugadores que entren en tu once, tapa antes los huecos y usa las formaciones de la versión gratuita.' },
      { tipo: 'arreglo', d: 'cara', t: 'Quién hace cada movimiento', x: 'En los movimientos de la liga sale el nombre de cada manager.' },
    ],
  },
  {
    v: '0.0.3', f: '2026-10-20', h: '19:32', t: 'Tus ventas y sus ofertas',
    cosas: [
      { tipo: 'nuevo', d: 'oferta', t: 'Ofertas por tus jugadores en venta', x: 'La de LaLiga y las de otros managers, cuánto sacas sobre su valor y si te conviene aceptar o esperar.', ir: { v: 'equipo', seg: 'equipo:venta' } },
      { tipo: 'arreglo', d: 'cara', t: 'Caras encuadradas', x: 'La app mira cada foto y centra la cabeza en el círculo.' },
    ],
  },
  {
    v: '0.0.2', f: '2026-10-20', h: '19:19', t: 'El plan del día',
    cosas: [
      { tipo: 'nuevo', d: 'plan', t: 'El plan de hoy, paso a paso', x: 'Qué vender, a quién clausular y cuánto pujar, con tu saldo después de cada operación.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'ia', t: 'Todos los modelos gratis', x: 'Si un modelo de Gemini gasta su cupo, pasa al siguiente en vez de pararse.' },
      { tipo: 'arreglo', d: 'cara', t: 'Caras y nombres', x: 'Las caras se ven con el escudo de su equipo y en los movimientos sale quién hace cada cosa.' },
    ],
  },
  {
    v: '0.0.1', f: '2026-10-20', h: '18:14', t: 'Primera versión',
    cosas: [
      { tipo: 'nuevo', d: 'escudo', t: 'Tu liga en el móvil', x: 'Entras con tu cuenta de LaLiga y ves tu equipo, las cláusulas de los rivales, el mercado y los movimientos.' },
    ],
  },
];

/** compara dos versiones (0.0.10 va después de la 0.0.9) */
export function cmpVer(a, b) {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}

// la numeración de antes (hasta la 0.9.0) en la de ahora, para saber qué versión habías visto
const VIEJAS = { '0.1.0': '0.0.1', '0.2.0': '0.0.2', '0.3.0': '0.0.3', '0.4.0': '0.0.4', '0.5.0': '0.0.5', '0.6.0': '0.0.6', '0.6.1': '0.0.7', '0.6.2': '0.0.8', '0.7.0': '0.0.9', '0.7.1': '0.0.10', '0.8.0': '0.0.11', '0.9.0': '0.0.11' };
export const deNumeracionVieja = (v) => VIEJAS[v] || null;
