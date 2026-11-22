/* Lo mismo en todos tus dispositivos (22 nov; Carlos: «en la web me sale un plan distinto al de la app móvil; tienen que
   ser todos iguales, al igual que las preguntas que hagas en un sitio te aparezcan en el otro»).

   El plan de la IA, la conversación de Pregunta, lo que le has contado y los pasos que has marcado como hechos se
   guardaban solo en cada dispositivo, y cada uno pedía su propio plan: de ahí los dos planes distintos. Ahora van también
   con tu cuenta de LaLiga, por liga (POST /sinc del servidor, worker/src/sinc.js), como los apodos:
     - al entrar en la liga, al volver a la app y antes de pedir un plan solo, se baja lo que haya más nuevo;
     - cada cambio de aquí (un plan nuevo, una pregunta, algo que le cuentas, un paso hecho) se sube al momento.
   De cada cosa gana la que se cambió más tarde. Sin red o sin servidor no pasa nada: se queda lo de aquí, como antes.
   Qué se sube y cómo se pone lo que llega: paraSinc y ponerRemoto de ia.js. */
import { LS } from './util.js';
import { K, enDemo } from './datos.js';
import { pedirWorker } from './soporte.js';
import { paraSinc, ponerRemoto, escucharCambios } from './ia.js';

let ligaS = '', enCurso = null, ult = 0, reloj = 0, otra = false;
let alLlegar = () => {}, ocupado = () => false;
const ESPERA = 20e3;          // entre dos miradas sin nada que subir
const subido = () => { const g = LS.get(K('sinc-subido'), null); return g && typeof g === 'object' ? g : {}; };

/**
 * Lo pone en marcha para una liga. `llega(claves)`: lo que ha llegado de otro dispositivo (para rehacer y pintar);
 * `charlando()`: hay una pregunta en marcha (la conversación no se toca hasta que acabe).
 */
export function iniciarSinc({ liga, llega = null, charlando = null } = {}) {
  ligaS = liga ? String(liga) : '';
  if (llega) alLlegar = llega;
  if (charlando) ocupado = charlando;
  escucharCambios(() => subirLuego());
}
/** tras un cambio de aquí: se sube enseguida (con la app en segundo plano, ya: ahí los relojes se paran) */
function subirLuego() {
  if (!ligaS || enDemo()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { sincronizar({ ya: true }); return; }
  clearTimeout(reloj);
  reloj = setTimeout(() => sincronizar({ ya: true }), 1200);
}

/**
 * Sube lo de aquí que el servidor no tiene y baja lo que tiene más nuevo. Devuelve las claves que han cambiado aquí
 * (plan, chat, notas, hechos). Como mucho cada 20 s salvo `ya`. Nunca lanza.
 */
export async function sincronizar({ ya = false } = {}) {
  if (!ligaS || enDemo()) return [];
  if (!ya && Date.now() - ult < ESPERA) return [];
  // (con una en marcha, lo cambiado mientras tanto se sube al acabar)
  if (enCurso) { if (ya) otra = true; return enCurso; }
  enCurso = (async () => {
    try {
      const loc = paraSinc(), sub = subido(), pon = {}, tengo = {};
      for (const [k, d] of Object.entries(loc)) {
        if (!d || !d.t) continue;
        tengo[k] = d.t;
        if (d.t > (Number(sub[k]) || 0)) pon[k] = d;
      }
      const r = await pedirWorker('POST', '/sinc', { liga: ligaS, pon, tengo }, { tiempo: 12000 });
      if (!r || !r.ok) return [];
      const trae = r.trae && typeof r.trae === 'object' ? r.trae : {}, llegadas = [];
      for (const [k, d] of Object.entries(trae)) { try { if (ponerRemoto(k, d, { charlando: !!ocupado() })) llegadas.push(k); } catch (e) { /* esa, la próxima vez */ } }
      const nuevo = { ...sub };
      for (const k of Object.keys(tengo)) nuevo[k] = Math.max(Number(nuevo[k]) || 0, tengo[k]);
      for (const k of llegadas) nuevo[k] = Math.max(Number(nuevo[k]) || 0, Number(trae[k].t) || 0);
      LS.set(K('sinc-subido'), nuevo);
      ult = Date.now();
      if (llegadas.length) { try { alLlegar(llegadas); } catch (e) { /* se verá al repintar */ } }
      return llegadas;
    } catch (e) { return []; } finally {
      enCurso = null;
      if (otra) { otra = false; subirLuego(); }
    }
  })();
  return enCurso;
}

/** antes de pedir un plan solo: mira si otro dispositivo ya lo tiene (como mucho `ms` de espera) */
export function sincAntes(ms = 5000) {
  return Promise.race([sincronizar({ ya: true }), new Promise((ok) => setTimeout(() => ok([]), ms))]);
}
