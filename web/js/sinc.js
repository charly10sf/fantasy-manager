/* Lo mismo en todos tus dispositivos (22 nov; Carlos: «en la web me sale un plan distinto al de la app móvil; tienen que
   ser todos iguales, al igual que las preguntas que hagas en un sitio te aparezcan en el otro»).

   El plan de la IA, la conversación de Pregunta, lo que le has contado y los pasos que has marcado como hechos se
   guardaban solo en cada dispositivo, y cada uno pedía su propio plan: de ahí los dos planes distintos. Ahora van también
   con tu cuenta de LaLiga, por liga (POST /sinc del servidor, worker/src/sinc.js), como los apodos:
     - al entrar en la liga, al volver a la app y antes de pedir un plan solo, se baja lo que haya más nuevo;
     - cada cambio de aquí (un plan nuevo, una pregunta, algo que le cuentas, un paso hecho) se sube enseguida.
   De cada cosa gana la que se cambió más tarde. Sin red o sin servidor no pasa nada: se queda lo de aquí, como antes.
   Qué se sube y cómo se pone lo que llega: paraSinc y ponerRemoto de ia.js.

   (0.8.4) Eran 33 llamadas por persona y día: cada subida eran dos (primero mirar si el otro dispositivo había cambiado lo
   mismo y luego subir), una pregunta al chat eran cinco (antes de preguntar, al guardar la pregunta y al guardar la
   respuesta, dos cada una) y cada vuelta a la app, otra. Ahora: la subida va en una sola llamada (`base`: el servidor
   dice si ha chocado con otro dispositivo y solo entonces se junta y se vuelve a subir), los cambios seguidos se juntan
   en una subida (SUBIR_TRAS), mientras la IA contesta no se llama para nada (la conversación se sube al acabar) y al
   volver a la app se mira como mucho una vez por minuto (ESPERA). Si la app se va a segundo plano con una subida
   pendiente, se sube ya. */
import { LS } from './util.js';
import { K, enDemo } from './datos.js';
import { pedirWorker } from './soporte.js';
import { paraSinc, ponerRemoto, escucharCambios } from './ia.js';

let ligaS = '', enCurso = null, ult = 0, reloj = 0, otra = false, pendiente = false;
let alLlegar = () => {}, ocupado = () => false;
const ESPERA = 60e3;          // entre dos miradas sin nada que subir (antes, 20 s)
export const SUBIR_TRAS = 4000;      // los cambios seguidos (marcar varios pasos, la pregunta y lo apuntado) van en una subida
// (el servidor entiende `base` desde la 0.8.4: lo dice en cada respuesta; con uno de antes, se mira primero, como antes)
const conBase = () => LS.get('sinc-base', 0) === 1;
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
/** tras un cambio de aquí: se sube a los SUBIR_TRAS sin más cambios (con la app en segundo plano, ya: ahí los relojes se paran) */
function subirLuego() {
  if (!ligaS || enDemo()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { subirYa('oculta'); return; }
  clearTimeout(reloj);
  pendiente = true;
  reloj = setTimeout(subirYa, SUBIR_TRAS);
}
function subirYa(por = 'subir') { clearTimeout(reloj); pendiente = false; sincronizar({ ya: true, subir: true, por }); }
// al irse a segundo plano con una subida esperando, se sube ya (Android congela los relojes de una app que no se ve)
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pendiente) subirYa('oculta'); });

/**
 * Sube lo de aquí que el servidor no tiene y baja lo que tiene más nuevo. Devuelve las claves que han cambiado aquí
 * (plan, chat, notas, hechos). Como mucho cada ESPERA salvo `ya`. Con `subir` (viene de un cambio de aquí), si no hay
 * nada que subir no llama. Nunca lanza.
 */
// (25 nov, B-3) `por`: de dónde sale la llamada (entrar, cada10, volver, vista, plan, fondo, pregunta, subir, oculta); el Worker
// lo apunta en su registro para contar en Observability de qué son las ~20 llamadas por persona y día
export async function sincronizar({ ya = false, conChat = false, subir = false, por = '' } = {}) {
  if (!ligaS || enDemo()) return [];
  if (!ya && Date.now() - ult < ESPERA) return [];
  // (con una en marcha, lo cambiado mientras tanto se sube al acabar)
  if (enCurso) { if (ya) otra = true; return enCurso; }
  enCurso = (async () => {
    // (0.8.4) sin esto, una vuelta que no llama (nada que subir) acababa antes de guardarse en enCurso y lo dejaba puesto
    // para siempre: ya no se sincronizaba nada más
    await null;
    try {
      const charlando = !conChat && !!ocupado();
      const sub = { ...subido() }, llegadas = new Set();
      const poner = (trae) => {
        for (const [k, d] of Object.entries(trae && typeof trae === 'object' ? trae : {})) {
          try { if (ponerRemoto(k, d, { charlando, desde: Number(sub[k]) || 0 })) { llegadas.add(k); sub[k] = Math.max(Number(sub[k]) || 0, Number(d.t) || 0); } } catch (e) { /* esa, la próxima vez */ }
        }
      };
      /* (repaso de la 0.8s, 22 nov) con cambios de aquí sin subir, primero se mira si otro dispositivo cambió lo mismo desde
         la última vez (tengo = lo último visto): si es así, se junta aquí y luego se sube lo juntado. Antes se subía sin
         mirar y, con el móvil abierto mientras se usaba la web, ganaba entero el último y lo del otro se perdía */
      const loc0 = paraSinc();
      if (!conBase() && Object.entries(loc0).some(([k, d]) => d && d.t && d.t > (Number(sub[k]) || 0))) {
        const visto = {};
        for (const k of Object.keys(loc0)) visto[k] = Number(sub[k]) || 0;
        const r0 = await pedirWorker('POST', '/sinc', { liga: ligaS, pon: {}, tengo: visto, por }, { tiempo: 12000 });
        if (!r0 || !r0.ok) return [];
        poner(r0.trae);
      }
      // (0.8.4) una vuelta normalmente; dos si ha chocado: lo juntado aquí se sube enseguida, en la misma
      for (let vuelta = 0; vuelta < 2; vuelta++) {
        const loc = paraSinc(), pon = {}, tengo = {}, base = {};
        for (const [k, d] of Object.entries(loc)) {
          if (!d || !d.t) continue;
          tengo[k] = d.t;
          // (con una pregunta en marcha, la conversación se sube al acabarla, ya juntada)
          if (d.t > (Number(sub[k]) || 0) && !(k === 'chat' && charlando)) { pon[k] = d; base[k] = Number(sub[k]) || 0; }
        }
        // un cambio de aquí que no se puede subir aún (la conversación, con la IA contestando): ni se llama
        if ((subir || vuelta) && !Object.keys(pon).length) break;
        const r = await pedirWorker('POST', '/sinc', { liga: ligaS, pon, tengo, base, por: vuelta ? `${por}+` : por }, { tiempo: 12000 });
        if (!r || !r.ok) return [...llegadas];
        if (r.base === 1 && !conBase()) LS.set('sinc-base', 1);
        // lo que ha chocado (otro dispositivo lo cambió desde la última vez): se junta aquí y se vuelve a subir
        const choque = new Set(Array.isArray(r.choque) ? r.choque.filter((k) => k in pon) : []);
        poner(r.trae);
        for (const k of Object.keys(pon)) if (!choque.has(k)) sub[k] = Math.max(Number(sub[k]) || 0, tengo[k]);
        for (const k of choque) sub[k] = Math.max(Number(sub[k]) || 0, Number(r.trae && r.trae[k] && r.trae[k].t) || 0);
        LS.set(K('sinc-subido'), sub);
        ult = Date.now();
        if (!choque.size) break;
      }
      const l = [...llegadas];
      if (l.length) { try { alLlegar(l); } catch (e) { /* se verá al repintar */ } }
      return l;
    } catch (e) { return []; } finally {
      enCurso = null;
      if (otra) { otra = false; subirLuego(); }
    }
  })();
  return enCurso;
}

/** antes de pedir un plan solo: mira si otro dispositivo ya lo tiene (como mucho `ms` de espera) */
export function sincAntes(ms = 5000, { conChat = false, por = 'antes' } = {}) {
  return Promise.race([sincronizar({ ya: true, conChat, por }), new Promise((ok) => setTimeout(() => ok([]), ms))]);
}
