/* Los anuncios intersticiales de la app de Google Play (0.8, 17 nov), en lugar del banner de abajo, que a Carlos le
   parecía grande y molesto (14 nov) y quiso quitar del todo (16 nov, 23:24).

   Un intersticial es un anuncio a pantalla completa que se cierra con la X. Google pide que salga solo en una pausa
   natural, nunca por sorpresa en medio de algo, ni al abrir o al salir de la app. Aquí:
   - Solo en dos pausas: al cambiar de pestaña con la barra de abajo y al cerrar una ficha (jugador, rival, club,
     partido…) con la X o arrastrándola. Nunca con el «atrás» de Android (puede que quiera salir), ni yendo a Pregunta.
   - Nunca en los primeros minutos de cada vez que se abre la app (o se vuelve a ella tras media hora fuera), como mucho
     uno cada N minutos de uso (con la app a la vista; el rato fuera no cuenta), un máximo al día y no justo después de
     un anuncio bonificado.
   - Nunca con la IA pensando, en el tutorial, con una ficha o una ventana abierta, escribiendo, en la liga de ejemplo,
     en la pantalla del límite ni antes de entrar en tu liga. Nunca al dueño (sinLimite/todoAbierto). Con
     «suLiga» (true desde el 17 nov), también a los de sus ligas: anuncios para todos menos el dueño.
   - Si no hay uno cargado, no pasa nada: Android ya está cargando el siguiente y no se reintenta en bucle.
   Los números, en «intersticial» de limites.json (intersticialCfg de limite.js), para cambiarlos sin sacar versión.
   Android (Anuncios.java de src/play) vuelve a comprobar lo suyo (la app a la vista, sin teclado, sin la IA trabajando,
   un mínimo de tiempo entre dos) y contesta con intersticialVisto(ok, motivo). */
import { LS, diaDe, MIN } from './util.js';
import { enApp, nativo } from './puente.js';
import { intersticialCfg, intersticialParaMi } from './limite.js';

const TICK = 10e3;
// una vuelta a la app tras media hora o más fuera es otra sesión: vuelven los minutos de gracia
const SESION_NUEVA = 30 * MIN;
// usoDesde: minutos de uso desde el último intersticial de ESTA sesión; en una sesión nueva empieza «cumplido» (Carlos,
// 17 nov: el primero a los 2 min de cada sesión y después uno cada 10), y si la app se abre de nuevo poco después de uno
// (Android la cerró), cuenta desde cero para no repetirlo
let ultimo = Date.now(), usoSesion = 0, usoDesde = Infinity, enCurso = false, enCursoT = 0, arrancado = false, fueraDesde = 0;

const aLaVista = () => !document.hidden && (!enApp || nativo.aLaVista());
/** cuenta el rato de uso: solo con la app a la vista. Fuera de la app el reloj puede seguir (Android no siempre congela
    la web) o pararse del todo (un hueco largo entre dos vueltas): en los dos casos, media hora fuera es otra sesión */
function contar() {
  const ahora = Date.now(), dt = ahora - ultimo;
  ultimo = ahora;
  if (!aLaVista()) { if (!fueraDesde) fueraDesde = ahora - Math.min(dt, TICK); return; }
  if (fueraDesde) { const fuera = ahora - fueraDesde; fueraDesde = 0; if (fuera >= SESION_NUEVA) { usoSesion = 0; usoDesde = Infinity; } return; }
  if (dt >= SESION_NUEVA) { usoSesion = 0; usoDesde = Infinity; return; }
  if (dt > TICK * 3) return;
  usoSesion += dt;
  usoDesde += dt;
}
/** lo de hoy: cuántos han salido y a qué hora el último (en LS, para que valga aunque Android cierre la app) */
const hoy = () => { const g = LS.get('inter', null); return g && g.dia === diaDe() ? g : { dia: diaDe(), n: 0, t: 0 }; };

/** al arrancar la app: el reloj del rato de uso */
export function arrancarIntersticiales() {
  if (arrancado || !enApp) return;
  arrancado = true;
  ultimo = Date.now();
  { const h = hoy(); if (h.t && ultimo - h.t < SESION_NUEVA) usoDesde = 0; }
  setInterval(contar, TICK);
  document.addEventListener('visibilitychange', contar);
  window.addEventListener('fm-vuelta', contar);
}

/** el último bonificado visto (los intersticiales esperan un rato después de uno) */
export const bonificadoVisto = () => LS.set('inter-bonif', Date.now());

/**
 * ¿Toca un intersticial en esta pausa? pantallaLibre: lo que solo sabe app.js (sin ficha ni ventana abierta, sin la IA
 * pensando, sin tutorial, sesión de tu liga iniciada…). Devuelve el motivo por el que no (para las pruebas) o '' si lo pide.
 */
export function quizaIntersticial(pantallaLibre) {
  if (!enApp || !nativo.hayIntersticial()) return 'sin intersticiales';
  const c = intersticialCfg();
  if (!c.on) return 'apagado';
  if (!intersticialParaMi()) return 'no a esta cuenta';
  // (por si Android no contestó: a los 2 min se da por acabado)
  if (enCurso && Date.now() - enCursoT < 2 * MIN) return 'ya hay uno';
  contar();
  const h = hoy();
  if (h.n >= c.maxDia) return 'tope del día';
  if (usoSesion < c.gracia) return 'gracia';
  if (h.t && (usoDesde < c.cada || Date.now() - h.t < c.cada)) return 'muy seguido';
  if (Date.now() - (Number(LS.get('inter-bonif', 0)) || 0) < c.trasBonificado) return 'tras un bonificado';
  if (!pantallaLibre || !aLaVista()) return 'pantalla ocupada';
  enCurso = true;
  enCursoT = Date.now();
  nativo.intersticial(c.bloque);
  return '';
}

/** la vuelta de Android: si se ha visto, cuenta para el tope y el tiempo entre uno y otro */
window.intersticialVisto = (ok, motivo) => {
  enCurso = false;
  if (!ok) return;
  const h = hoy();
  LS.set('inter', { dia: h.dia, n: h.n + 1, t: Date.now() });
  usoDesde = 0;
  ultimo = Date.now();
  void motivo;
};

/* (17 nov, Carlos) el anuncio de apertura: uno al día como mucho, al abrir la app (un intersticial al abrir lo prohíbe
   Google; este formato es el que deja). Nunca el primer día que alguien usa la app con su liga (que la vea antes que un
   anuncio). A quién (no al dueño ni a los de su liga) lo mira app.js con intersticialParaMi */
export function aperturaToca() {
  const d = diaDe(), desde = LS.get('ap-desde', null);
  if (!desde) { LS.set('ap-desde', d); return false; }
  if (desde === d) return false;
  const a = LS.get('apertura', null);
  return !(a && a.dia === d);
}
window.aperturaVista = (ok, motivo) => {
  if (ok) LS.set('apertura', { dia: diaDe(), t: Date.now() });
  window.dispatchEvent(new CustomEvent('apertura-vista', { detail: { ok: !!ok, motivo } }));
};

/** para las pruebas: el rato de uso de esta sesión (ms) y lo de hoy */
export const estadoIntersticial = () => ({ usoSesion, usoDesde, enCurso, ...hoy() });
/** para las pruebas: hace como si llevara ms de uso */
export const sumarUso = (ms) => { usoSesion += ms; usoDesde += ms; };
