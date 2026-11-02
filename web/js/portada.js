/* La portada (la pantalla de antes de entrar), en la web: tres móviles dibujados en HTML con lo que de verdad hace la app.
   Van dibujados y no como capturas a propósito: pesan unos pocos KB en vez de los 3,5 MB de las 8 capturas de Play, y
   web/ entera va dentro del APK y la bajan todas las apps al ponerse al día. Los datos son los de la liga de ejemplo,
   los mismos de las capturas de la ficha de Google Play (play/captura-2, 3 y 6). */
import { icono, esc, LOGO_P } from './util.js';

const NAV = [['rayo', 'Hoy'], ['equipo', 'Equipo'], ['rivales', 'Rivales'], ['mercado', 'Mercado'], ['ia', 'Pregunta']];

/** el marco de un móvil con la cabecera de la app, la pestaña activa abajo y la pantalla que se le pase */
function movil(activa, pantalla) {
  const nav = NAV.map(([ic, t], i) => `<span${i === activa ? ' class="on"' : ''}>${icono(ic)}<i>${t}</i></span>`).join('');
  return `<div class="mq" aria-hidden="true"><div class="mq-p">
    <div class="mq-cab">${LOGO_P}<span><b>Liga de ejemplo</b><small><u></u>Al día</small></span></div>
    <div class="mq-cuerpo">${pantalla}</div>
    <div class="mq-nav">${nav}</div>
  </div></div>`;
}

const PLAN = `
  <div class="mq-k">Plan de hoy</div>
  <div class="mq-t">Hoy toca vender 3, clausular 2</div>
  <p class="mq-x">Tienes 6,43 M y puedes gastar hasta 39,16 M. Vas 1º con 600 puntos.</p>
  <div class="mq-op"><div class="mq-op-c"><em class="verde">Aceptar oferta</em><small>antes de hoy 08:41</small></div>
    <div class="mq-op-f"><span class="mq-av">L</span><div><b>Lewandowski</b><small>Barcelona · oferta de Dani</small></div><strong class="verde">+39,64 M</strong></div>
    <div class="mq-op-p"><span>Hecho</span><span>saldo 46,07 M</span></div></div>
  <div class="mq-op"><div class="mq-op-c"><em class="verde">Vender</em><small>hoy</small></div>
    <div class="mq-op-f"><span class="mq-av">UL</span><div><b>Unai López</b><small>Rayo · ponlo en venta</small></div><strong class="verde">+5,98 M</strong></div></div>
  <div class="mq-op"><div class="mq-op-c"><em class="rojo">Clausular</em><small>hoy</small></div>
    <div class="mq-op-f"><span class="mq-av rojo">O</span><div><b>Oyarzabal</b><small>de Iván · cláusula abierta</small></div><strong class="rojo">−35,85 M</strong></div></div>`;

const fila = (pos, nombre, de, clau, abierta, pts) => `<div class="mq-fila"><span class="mq-av ${pos === 'DEL' ? 'rojo' : 'oro'}">${esc(nombre[0])}</span>
  <div><div><i class="pos ${pos}">${pos}</i><b>${esc(nombre)}</b></div><small>${esc(de)}</small>
  ${clau ? `<span class="mq-b">${icono('rayo')}Clausular hoy</span>` : ''}<span class="mq-c">${abierta} abierta</span></div>
  <strong>${abierta}<small><u></u>${pts}</small></strong></div>`;

const CLAUSULAS = `
  <div class="mq-k">Liga de ejemplo</div>
  <div class="mq-t">Rivales</div>
  <div class="mq-chips"><span class="on">Te llegan</span><span>Se abren pronto</span><span>Todas</span></div>
  <p class="mq-x">Puedes gastar hasta <b>39,16 M</b>. La barra es lo que te interesa.</p>
  ${fila('POR', 'Gazzaniga', 'de Javi · vale 8,15 M', true, '8,68 M', 71)}
  ${fila('POR', 'Ryan', 'de Javi · vale 4,02 M', false, '4,21 M', 69)}
  ${fila('DEL', 'Oyarzabal', 'de Iván · vale 33,43 M', true, '35,85 M', 65)}`;

const CHAT = `
  <div class="mq-k">Pregunta</div>
  <div class="mq-t">Tu director deportivo</div>
  <div class="mq-yo">¿Clausulo a Oyarzabal o espero a mañana?</div>
  <div class="mq-ia"><em>Gemini 2.5 Flash</em>
    <p><b>Clausúlalo hoy.</b> Su cláusula está abierta (35,85 M) y mañana Iván puede subirla o blindarlo.</p>
    <ul><li>Entra directo en tu once por Chaira: <b>+2,4 pts por jornada</b>.</li><li>Te quedas con <b>2,2 M</b> de saldo y empiezas la jornada en positivo.</li></ul></div>
  <div class="mq-in"><span>Pregunta o cuéntale algo</span><i>${icono('enviar')}</i></div>`;

const PIES = [
  [0, PLAN, 'Qué hacer hoy', 'Vender, clausular y pujar, paso a paso y con el saldo que te queda después de cada operación.'],
  [2, CLAUSULAS, 'Cláusulas a tiro', 'Las de tus rivales que te llegan y cuándo se abren. Te avisa al minuto cuando se abre una que te interesa.'],
  [4, CHAT, 'Pregúntale lo que quieras', 'Con una IA gratis que lee lesiones, convocatorias y alineaciones antes de contestar. También con capturas.'],
];

/** las páginas públicas (HTML sin JavaScript, de .github/paginas.py). «Guías» entra cuando haya alguna publicada */
const ENLACES = [['quienes-somos.html', 'Quiénes somos'], ['contacto.html', 'Contacto'], ['privacidad.html', 'Privacidad'], ['instalar.html', 'Instalar']];

/** lo que va debajo de la entrada: los tres móviles, uno a uno en el móvil y en fila en el ordenador */
export function seccionMoviles() {
  return `<section class="portada-m" aria-labelledby="pmT"><h2 id="pmT">Así se ve</h2>
    <div class="pm-fila">${PIES.map(([a, p, t, x]) => `<figure>${movil(a, p)}<figcaption><b>${t}</b><span>${x}</span></figcaption></figure>`).join('')}</div>
    <p class="pm-nota">Con datos de la liga de ejemplo. Tu liga se carga al entrar con tu cuenta de LaLiga.</p>
    <p class="pm-pie">App no oficial: no es de LaLiga ni tiene relación con LaLiga.</p>
    <nav class="pm-pie pm-enlaces" aria-label="Más">${ENLACES.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  </section>`;
}
