/* La guía para sacar la clave gratis de Gemini (Google AI Studio) sin salir de la pestaña de la IA: cada paso con un
   dibujo de lo que se ve en la web de Google, el botón que la abre y la casilla para pegar la clave, que se guarda
   sola en cuanto tiene pinta de clave.
   Los dibujos son esquemas, no capturas: Google cambia los detalles de AI Studio a menudo y un esquema sigue valiendo.
   Desde mayo de 2026 las claves nuevas empiezan por «AQ.»; las de antes, por «AIza». Las dos valen. */
import { icono, LS } from './util.js';
import { enApp } from './puente.js';

export const AISTUDIO = 'https://aistudio.google.com/apikey';

/** saca la clave de lo pegado: sin espacios, sin comillas y aunque venga con más texto («GEMINI_API_KEY=AQ.…») */
export function limpiarClave(t) {
  const s = String(t || '').replace(/[\s"'`]+/g, ' ').trim();
  const m = s.match(/(AQ\.[^\s"'`<>]{20,}|AIza[0-9A-Za-z_-]{30,})/);
  return m ? m[1] : s.replace(/\s+/g, '');
}
/** ¿tiene pinta de clave de Google? */
export const pareceClave = (t) => /^(AQ\.[^\s"'`<>]{20,}|AIza[0-9A-Za-z_-]{35})$/.test(t || '');

/** acabas de ir a AI Studio (en la última media hora): al volver, la casilla de pegar sale a la vista */
export const vieneDeAIStudio = () => { const t = LS.get('guia-clave', 0); return !!t && Date.now() - t < 30 * 60e3; };
export const marcarAIStudio = () => LS.set('guia-clave', Date.now());

/* ---------- los dibujos (viewBox 0 0 300 176): la ventana de Google y, marcado en rojo, dónde tocar ---------- */
const marco = (url, dentro) => `<svg class="gc-dib" viewBox="0 0 300 176" role="img" aria-hidden="true">
  <rect class="m" x="1" y="1" width="298" height="174" rx="12"/><path class="l" d="M1 27h298"/>
  <circle class="p" cx="15" cy="14" r="3.2"/><circle class="p" cx="26" cy="14" r="3.2"/><circle class="p" cx="37" cy="14" r="3.2"/>
  <rect class="u" x="52" y="6.5" width="196" height="15" rx="7.5"/><text class="ut" x="64" y="17.6">${url}</text>${dentro}</svg>`;
const anillo = (x, y, w, h, r = 8) => `<rect class="ring" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const dedo = (x, y) => `<circle class="tap" cx="${x}" cy="${y}" r="10"/><circle class="tap2" cx="${x}" cy="${y}" r="4.5"/>`;
const barra = (x, y, w) => `<rect class="g" x="${x}" y="${y}" width="${w}" height="6" rx="3"/>`;

const DIB = {
  // la cuenta de Google
  cuenta: marco('accounts.google.com', `
    <text class="t tb" x="150" y="52" text-anchor="middle">Elige una cuenta</text>
    <rect class="c" x="40" y="66" width="220" height="38" rx="9"/>
    <circle class="av" cx="62" cy="85" r="11"/><text class="av-t" x="62" y="89.5" text-anchor="middle">T</text>
    <text class="t" x="82" y="82">Tu nombre</text><text class="t s" x="82" y="96">tu.correo@gmail.com</text>
    ${anillo(36, 62, 228, 46, 11)}${dedo(232, 86)}
    <rect class="c" x="40" y="114" width="220" height="32" rx="9"/>
    <circle class="g" cx="62" cy="130" r="9"/><text class="t s" x="82" y="134">Usar otra cuenta</text>`),
  // las condiciones, la primera vez
  condiciones: marco('aistudio.google.com', `
    <rect class="c" x="34" y="38" width="232" height="128" rx="10"/>
    <text class="t tb" x="50" y="60">Terms of Service</text>
    ${barra(50, 70, 190)}${barra(50, 80, 160)}
    <rect class="chk on" x="50" y="96" width="13" height="13" rx="3"/><path class="w" d="M52.6 102.6l3 3 5.2-6"/>
    ${barra(72, 99.5, 150)}
    <rect class="chk" x="50" y="118" width="13" height="13" rx="3"/>${barra(72, 121.5, 120)}
    ${anillo(44, 90, 26, 25, 6)}
    <rect class="b" x="196" y="140" width="58" height="20" rx="10"/><text class="bt" x="225" y="153.6" text-anchor="middle">Continue</text>
    ${anillo(191, 135, 68, 30, 13)}${dedo(256, 164)}`),
  // la página de las claves
  claves: marco('aistudio.google.com/apikey', `
    <rect class="side" x="1" y="27" width="46" height="148"/>${barra(11, 44, 26)}${barra(11, 58, 26)}<rect class="g on" x="11" y="72" width="26" height="6" rx="3"/>${barra(11, 86, 26)}
    <text class="t tb" x="60" y="52">API Keys</text>
    <rect class="b" x="186" y="38" width="100" height="22" rx="11"/><text class="bt" x="236" y="52.8" text-anchor="middle">+ Create API key</text>
    ${anillo(181, 33, 110, 32, 15)}${dedo(287, 63)}
    <path class="l" d="M60 78h226"/>${barra(60, 86, 60)}${barra(170, 86, 40)}
    <path class="l" d="M60 100h226"/>
    <text class="t" x="60" y="118">Default Gemini API Key</text><text class="t s" x="170" y="118">…7Qd</text>
    <path class="l" d="M60 130h226"/>${barra(60, 142, 90)}${barra(170, 142, 34)}`),
  // copiar la clave
  copiar: marco('aistudio.google.com/apikey', `
    <rect class="c" x="30" y="40" width="240" height="96" rx="10"/>
    <text class="t tb" x="46" y="62">API key</text>
    <rect class="f" x="46" y="74" width="208" height="28" rx="7"/>
    <text class="k" x="56" y="92.5">AQ.Ab8RN6K…xY2Qd</text>
    <g class="cp"><rect x="225" y="81" width="10" height="11" rx="2"/><path d="M229 81v-3h9v11h-3"/></g>
    ${anillo(217, 74, 30, 28, 7)}${dedo(246, 102)}
    ${barra(46, 116, 130)}
    <rect class="toast" x="94" y="146" width="112" height="22" rx="11"/><text class="tt" x="150" y="160.6" text-anchor="middle">Copied to clipboard</text>`),
};

/** la pestaña de la IA sin clave: la guía entera */
export function guiaClave() {
  const pegar = !enApp && typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function';
  const paso = (n, t, cuerpo, extra = '') => `<li class="gc-paso"${extra}><span class="gc-num">${n}</span><div class="gc-c"><b class="gc-t">${t}</b>${cuerpo}</div></li>`;
  return `<div class="ia-alta gc">
    <div class="eti">Inteligencia artificial</div><div class="titulo">Activa la IA</div>
    <p class="entradilla">Gemini, de Google, con tu propia clave. Hace el plan de cada día leyendo noticias, lesiones y onces probables, y contesta lo que le preguntes de tu liga, también con capturas.</p>
    <div class="gc-chips"><span>${icono('ok')}Gratis</span><span>${icono('ok')}Sin tarjeta</span><span>${icono('reloj')}3 minutos</span></div>
    ${vieneDeAIStudio() ? `<a class="gc-vuelta" href="#pegaClave" data-accion="irAPegar">${icono('copiar')}<span>¿Ya la tienes copiada? <b>Pégala abajo</b></span></a>` : ''}
    <ol class="gc-pasos">
      ${paso(1, 'Abre AI Studio y entra con Google', `<p>Es la web de Google para sacar la clave. Entra con tu cuenta de Gmail de siempre; si es del trabajo o del colegio, puede que no te deje.</p>
        <button class="btn ancho gc-abrir" data-accion="abrirAIStudio">${icono('google')}Abrir AI Studio</button>${DIB.cuenta}`)}
      ${paso(2, 'Acepta las condiciones', `<p>Solo la primera vez. Marca la casilla de las condiciones y pulsa <b>Continue</b>. La de recibir correos de Google no hace falta.</p>${DIB.condiciones}`)}
      ${paso(3, 'Busca tu clave', `<p>Google te crea una al entrar por primera vez: sale en la lista de <b>API Keys</b>. Si no tienes ninguna, pulsa <b>Create API key</b>, ponle de nombre «Fantasy» y créala en un proyecto nuevo (<b>Create project</b>).</p>${DIB.claves}`)}
      ${paso(4, 'Cópiala', `<p>Toca la clave y luego el icono de copiar. Empieza por <span class="gc-mono">AQ.</span> (las de antes, por <span class="gc-mono">AIza</span>). Cópiala entera.</p>${DIB.copiar}`)}
      ${paso(5, 'Vuelve aquí y pégala', `<p>${enApp ? 'Mantén el dedo en la casilla y pulsa <b>Pegar</b>.' : 'Pégala en la casilla.'} En cuanto la pegues, la pruebo y te hago el plan.</p>
        <div class="gc-fila"><input class="campo-t gc-campo" id="claveIA" placeholder="AQ.… o AIza…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Tu clave de Gemini">${pegar ? `<button class="btn sec gc-pegar" data-accion="pegarClave">${icono('copiar')}Pegar</button>` : ''}</div>
        <button class="btn ancho gc-guardar" data-accion="guardarClave">${icono('ok')}Guardar y hacer el plan</button>`, ' id="pegaClave"')}
    </ol>
    <details class="gc-ayuda"><summary>${icono('info')}¿Algo no te sale así?</summary>
      <dl>
        <dt>En el móvil no veo «API Keys»</dt><dd>El menú de AI Studio está escondido en el botón de las tres rayas, arriba a la izquierda. O abre directamente <a href="#" data-abrir="${AISTUDIO}">aistudio.google.com/apikey</a>.</dd>
        <dt>«Create API key» sale en gris</dt><dd>Pasa con cuentas de empresa o de colegio, que no tienen permiso. Entra con una cuenta personal de Gmail.</dd>
        <dt>Me pide tarjeta o «billing»</dt><dd>No hace falta. Ignóralo: la clave funciona con el cupo gratis.</dd>
        <dt>Dice que la clave no vale</dt><dd>Cópiala otra vez entera, sin espacios. Si sigue igual, crea otra en un proyecto nuevo: las claves viejas de otras apps a veces están bloqueadas.</dd>
        <dt>¿Es gratis de verdad?</dt><dd>Sí. Google da un cupo diario gratis por clave. Si un día se acaba, tienes el plan automático (sale de los números, sin noticias) y la IA vuelve al día siguiente, hacia las 9 de la mañana.</dd>
      </dl>
    </details>
    <p class="gc-priv">${icono('candado')}<span>La clave se queda en tu ${enApp ? 'móvil' : 'dispositivo'} y las preguntas van directas a Google. Puedes quitarla cuando quieras en Ajustes.</span></p>
  </div>`;
}

/** te lleva a la casilla de pegar y la marca un momento */
export function aPegar() {
  const el = document.getElementById('pegaClave');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('resalta');
  void el.offsetWidth;
  el.classList.add('resalta');
}

/** lo pegado (por el botón o en la casilla), limpio; null si no hay nada */
export function leerCasilla() {
  const c = document.getElementById('claveIA');
  if (!c) return null;
  const k = limpiarClave(c.value);
  if (k !== c.value) c.value = k;
  return k || null;
}
