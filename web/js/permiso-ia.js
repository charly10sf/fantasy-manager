/* (iOS 3, 25 nov) El permiso para mandar los datos de tu liga a la IA, solo en la app de iOS. Apple pide (norma 5.1.2(i))
   decir con claridad qué datos personales van a una IA de otra empresa y tener permiso expreso antes de mandar nada. Sale
   la primera vez que se va a pedir un plan con la IA o a mandar una pregunta; con «No», no se manda nada y el plan de la
   app sigue saliendo cada día. Se cambia en Ajustes → La IA. Quién es la empresa, en la política de privacidad (en la app
   no se nombran los modelos de IA). Fuera de la app de iOS no sale nunca (ia.js, `pidePermisoIA`). */
import { icono } from './util.js';
import { nativo } from './puente.js';
import { ponerPermisoIA } from './ia.js';

const PRIVACIDAD = 'https://fantasymanagerapp.com/privacidad.html';

/** el texto de la ventana: qué se manda, a quién y qué pasa si dices que no */
export const textoPermisoIA = () => `<span class="forzar-ic">${icono('ia')}</span>
  <h2 id="permIA-t">¿Usamos la IA con tu liga?</h2>
  <p>Para hacerte el plan del día con la IA y contestar tus preguntas, la app manda a un servicio de IA de otra empresa:</p>
  <ul class="perm-ia-l">
    <li>los datos de tu liga: tu plantilla, tu saldo, tus ofertas, el mercado y lo que hacen tus rivales, con sus nombres cambiados por «Rival 1», «Rival 2»…;</li>
    <li>lo que le preguntes y las fotos que le mandes.</li>
  </ul>
  <p>No lo usa para entrenar su IA y lo borra en 30 días como mucho. Qué empresa es y el detalle, en la <button type="button" class="perm-ia-pol" data-perm="pol">política de privacidad</button>.</p>
  <p>Si dices que no, no se manda nada y el plan de la app sigue saliendo cada día, sin la IA. Lo puedes cambiar en Ajustes → La IA.</p>
  <div class="forzar-b"><button type="button" class="btn ancho" data-perm="si">Sí, usar la IA</button><button type="button" class="btn ancho sec" data-perm="no">No</button></div>`;

/**
 * Enseña la ventana. `seguir` se llama solo si dice que sí (lo que estaba haciendo: el plan, la pregunta); `alAcabar(si)`,
 * pase lo que pase. Si ya está abierta, no se abre otra (se queda el último `seguir`).
 */
let pendiente = null;
export function pedirPermisoIA(seguir = null, alAcabar = null) {
  pendiente = { seguir, alAcabar };
  if (document.getElementById('permIA')) return;
  const d = document.createElement('div');
  d.id = 'permIA'; d.className = 'forzar perm-ia'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'permIA-t');
  d.innerHTML = `<div class="forzar-c">${textoPermisoIA()}</div>`;
  d.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-perm]');
    if (!b) return;
    ev.stopPropagation();
    if (b.dataset.perm === 'pol') { nativo.abrir(PRIVACIDAD); return; }
    const si = b.dataset.perm === 'si';
    ponerPermisoIA(si);
    d.remove();
    const p = pendiente;
    pendiente = null;
    if (p && p.alAcabar) { try { p.alAcabar(si); } catch (e) { /* nada */ } }
    if (si && p && p.seguir) p.seguir();
  });
  document.body.appendChild(d);
  const b = d.querySelector('[data-perm="si"]');
  if (b) b.focus();
}
