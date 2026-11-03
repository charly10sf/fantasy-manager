/* La portada (la pantalla de antes de entrar), en la web: una página larga al estilo de toison.es (Carlos, 2 nov: «todo,
   básicamente»), con la idea y no el código. Debajo de la entrada:
   0. Una barra arriba que sale al pasar la entrada, con el menú, lo leído y «Descargar la app».
   1. Cómo funciona: en el ordenador, el móvil se queda fijo y cambia de pantalla según bajas (en el móvil, de lado).
      Los móviles van dibujados en HTML (pesan unos KB; web/ entera va dentro del APK).
   2. Tu once: el campo con caras y escudos; un toque en un jugador enseña su ficha.
   3. Qué hace por dentro: las funciones, con un interruptor «Juego por diversión / Voy a por la liga».
   4. Así decide: cuatro casos y lo que mira la app en cada uno (las reglas son las de motor.js).
   5. Calculadoras: el blindaje justo y cuánto puedes gastar.
   6. Preguntas, privacidad y cierre.
   Las caras y los escudos son los de LaLiga, cargados al vuelo (caras-demo.js); las cifras son de la liga de ejemplo.
   Nada de esto sale dentro de la app de Android, que solo enseña lo de entrar. */
import { icono, esc, LOGO_P, proxPlay } from './util.js';
import { jugadoresDemo } from './demo.js';

const NF2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const mM = (v) => `${NF2.format(v)} M`;
const ini = (n) => String(n || '').replace(/[^\p{L} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '·';

/** la cara de un jugador de la demo: sus iniciales y, cuando llegan de LaLiga, su foto y el escudo de su equipo */
const cara = (lid, nombre, eq, cls = '') => `<span class="mq-av pc ${cls}" data-lid="${lid}"${eq ? ` data-eq="${eq}"` : ''}><i>${esc(ini(nombre))}</i></span>`;

/** la barra de abajo de la app (NAV de app.js); Pregunta va arriba, en rojo */
const NAV = [['rayo', 'Hoy'], ['equipo', 'Equipo'], ['directo', 'Directo'], ['rivales', 'Rivales'], ['mercado', 'Mercado'], ['club', 'Clubes']];

/** el marco de un móvil con la cabecera de la app, la pestaña activa abajo (o 'ia', Pregunta, arriba) y la pantalla que se le pase */
function movil(activa, pantalla) {
  const nav = NAV.map(([ic, t], i) => `<span${i === activa ? ' class="on"' : ''}>${icono(ic)}<i>${t}</i></span>`).join('');
  return `<div class="mq" aria-hidden="true"><div class="mq-p">
    <div class="mq-cab">${LOGO_P}<span><b>Liga de ejemplo</b><small><u></u>Al día</small></span><span class="mq-preg${activa === 'ia' ? ' on' : ''}">${icono('ia')}<i>Pregunta</i></span></div>
    <div class="mq-cuerpo">${pantalla}</div>
    <div class="mq-nav">${nav}</div>
  </div></div>`;
}

const PLAN = `
  <div class="mq-k">Plan de hoy</div>
  <div class="mq-t">Hoy toca vender 2, clausular 1</div>
  <p class="mq-x">Tienes 6,43 M y puedes gastar hasta 39,16 M. Vas 1º con 600 puntos.</p>
  <div class="mq-op"><div class="mq-op-c"><em class="verde">Aceptar oferta</em><small>hoy, antes de las 08:41</small></div>
    <div class="mq-op-f">${cara(3084, 'Budimir', 13)}<div><b>Budimir</b><small>Osasuna · oferta de Dani</small></div><strong class="verde">+39,64 M</strong></div>
    <div class="mq-op-p"><span>Hecho</span><span>saldo 46,07 M</span></div></div>
  <div class="mq-op"><div class="mq-op-c"><em class="verde">Vender</em><small>hoy</small></div>
    <div class="mq-op-f">${cara(886, 'De Frutos', 14)}<div><b>De Frutos</b><small>Rayo · ponlo en venta</small></div><strong class="verde">+5,98 M</strong></div></div>
  <div class="mq-op"><div class="mq-op-c"><em class="rojo">Clausular</em><small>hoy</small></div>
    <div class="mq-op-f">${cara(3091, 'Oyarzabal', 16, 'rojo')}<div><b>Oyarzabal</b><small>de Iván · cláusula abierta</small></div><strong class="rojo">−35,85 M</strong></div></div>`;

const fila = (lid, eq, pos, nombre, de, clau, abierta, pts) => `<div class="mq-fila">${cara(lid, nombre, eq, pos === 'DEL' ? 'rojo' : 'oro')}
  <div><div><i class="pos ${pos}">${pos}</i><b>${esc(nombre)}</b></div><small>${esc(de)}</small>
  ${clau ? `<span class="mq-b">${icono('rayo')}Clausular hoy</span>` : ''}<span class="mq-c">${abierta} abierta</span></div>
  <strong>${abierta}<small><u></u>${pts}</small></strong></div>`;

const CLAUSULAS = `
  <div class="mq-k">Liga de ejemplo</div>
  <div class="mq-t">Rivales</div>
  <div class="mq-chips"><span class="on">Te llegan</span><span>Se abren pronto</span><span>Todas</span></div>
  <p class="mq-x">Puedes gastar hasta <b>39,16 M</b>. La barra es lo que te interesa.</p>
  ${fila(2457, 18, 'POR', 'Dimitrievski', 'de Javi · vale 11,88 M', true, '12,61 M', 71)}
  ${fila(2755, 11, 'POR', 'Ryan', 'de Javi · vale 13,20 M', false, '13,94 M', 69)}
  ${fila(3091, 16, 'DEL', 'Oyarzabal', 'de Iván · vale 33,43 M', true, '35,85 M', 65)}`;

const CHAT = `
  <div class="mq-k">Pregunta</div>
  <div class="mq-t">Tu director deportivo</div>
  <div class="mq-yo">¿Clausulo a Oyarzabal o espero a mañana?</div>
  <div class="mq-ia">
    <p><b>Clausúlalo hoy.</b> Su cláusula está abierta (35,85 M) y mañana Iván puede subirla o blindarlo.</p>
    <ul><li>Entra directo en tu once por Iñigo Vicente: <b>+2,4 pts por jornada</b>.</li><li>Te quedas con <b>2,2 M</b> de saldo y empiezas la jornada en positivo.</li></ul></div>
  <div class="mq-in"><span>Pregunta o cuéntale algo</span><i>${icono('enviar')}</i></div>`;

/** los tres pasos de «Cómo funciona»: [pestaña activa, pantalla, título, texto, detalles] */
const PIES = [
  [0, PLAN, 'Qué hacer hoy', 'Abres la app y el plan ya está hecho: vender, clausular y pujar, en orden y con el saldo que te queda después de cada operación.',
    ['Con la hora límite de cada cosa', 'Lo que ya has hecho se marca solo', 'Compártelo con tu liga como imagen']],
  [3, CLAUSULAS, 'Cláusulas a tiro', 'Las cláusulas de tus rivales que te llegan con tu dinero y cuándo se abren las que están protegidas.',
    ['Aviso al minuto cuando se abre una que te interesa', 'Quién puede ir a por las tuyas', 'Lo que suele pagar cada rival']],
  ['ia', CHAT, 'Pregúntale lo que quieras', 'Una IA gratis que lee lesiones, convocatorias y alineaciones antes de contestar. También entiende capturas.',
    ['Conoce tu plantilla y tu dinero', 'La app comprueba sus cuentas', 'Con tu propia clave gratuita']],
];

/* ---------- 2. tu once ----------
   [id en LaLiga, nombre, equipo, posición, valor, cláusula, media, % de titular, lo que dice la app]. Caras y equipos
   reales; valor, cláusula, % y consejo, de la liga de ejemplo */
const ONCE = [
  [[3104, 'Lamine Yamal', 4, 'DEL', 124.7, 131.2, 10, 96, 'Su cláusula está cerrada 5 días más. Nada que hacer: alinéalo y a sumar.'],
    [3103, 'Mbappé', 15, 'DEL', 118.8, 121.4, 10, 98, 'Cláusula abierta y a tiro de dos rivales. Súbela a 133,9 M: te cuesta 6,25 M y ya no le llega a nadie.'],
    [2522, 'Raphinha', 4, 'DEL', 114.8, 126.3, 10, 88, '88 % de ser titular en la próxima jornada. Entra en tu once sin pensarlo.']],
  [[2534, 'Álex Baena', 2, 'MED', 64.7, 71.2, 8, 90, 'Saca 8 puntos de media por jornada. Ni se te ocurra venderlo.'],
    [3101, 'Bellingham', 15, 'MED', 87.1, 87.1, 10, 94, 'El valor ha pasado su cláusula y LaLiga la ha subido sola hasta su valor: no te ha costado nada.'],
    [1715, 'Fermín', 4, 'MED', 67.3, 70.6, 8.5, 72, 'Con Champions entre semana, la app le baja la probabilidad de ser titular por la rotación. Ten a mano un suplente.']],
  [[3155, 'Grimaldo', 2, 'DEF', 61.4, 64.5, 8.6, 91, '8,6 puntos de media: el que más suma de tu defensa. El más caro, y lo vale.'],
    [1775, 'Cubarsí', 4, 'DEF', 44.2, 52.1, 4.2, 85, 'Media baja para lo que vale. Si te ofrecen más de 50 M, la app te dirá que lo vendas.'],
    [2530, 'Huijsen', 15, 'DEF', 22.4, 24.9, 4.9, 64, '64 % de ser titular. El once confirmado sale una hora antes del partido: si no está, la app te avisa.'],
    [3106, 'Cucurella', 15, 'DEF', 24.4, 27.0, 3.8, 82, 'Ha bajado 7 días seguidos, pero juega mañana de titular: la app no te manda venderlo por eso.']],
  [[230, 'Courtois', 15, 'POR', 33.7, 37.1, 7.1, 99, 'Titular fijo y su cláusula no le llega a ningún rival. Tranquilo.']],
];

function campo() {
  let k = 0;
  const lineas = ONCE.map((l) => `<div class="pc-linea">${l.map(([lid, n, eq, pos], i) => `<button class="pc-j" style="--i:${k++}" data-pj="${lid}" aria-label="${esc(n)}"${l === ONCE[0] && i === 1 ? ' aria-pressed="true"' : ''}>
    ${cara(lid, n, eq, pos === 'DEL' ? 'rojo' : pos === 'POR' ? 'oro' : '')}<b>${esc(n)}</b></button>`).join('')}</div>`).join('');
  return `<div class="pc-campo">${lineas}</div>`;
}
function fichaOnce(lid) {
  const x = ONCE.flat().find((y) => String(y[0]) === String(lid));
  if (!x) return '';
  const [id, n, eq, pos, v, c, media, tit, dice] = x;
  return `<div class="pc-ficha-c">${cara(id, n, eq, `grande ${pos === 'DEL' ? 'rojo' : pos === 'POR' ? 'oro' : ''}`)}<div><i class="pos ${pos}">${pos}</i><b>${esc(n)}</b></div></div>
    <dl><div><dt>Valor</dt><dd>${mM(v)}</dd></div><div><dt>Cláusula</dt><dd>${mM(c)}</dd></div><div><dt>Media</dt><dd>${NF1.format(media)} pts</dd></div><div><dt>Titular</dt><dd>${tit} %</dd></div></dl>
    <p>${icono('ia')}${esc(dice)}</p>`;
}

/* ---------- 3. qué hace por dentro (dos voces: por diversión y a por la liga) ---------- */
const FUNCIONES = [
  ['rayo', 'El plan del día', 'Abres la app y ya sabes qué hacer hoy, sin echar cuentas.', 'Vender, clausular y pujar en el orden bueno, con el saldo que te queda tras cada paso y la hora límite de cada cosa.'],
  ['diana', 'Cláusulas', 'Te avisa cuando se abre una cláusula que te interesa.', 'Qué cláusulas te llegan con tu saldo, cuándo se abren y quién puede ir a por las tuyas. Aviso al minuto, también con el móvil en silencio.'],
  ['rivales', 'Rivales', 'Ves qué hace cada uno de tu liga.', 'Dinero de cada rival, lo que suele pagar por una cláusula y si le llega a alguno de los tuyos.'],
  ['mercado', 'Mercado', 'Quién sube, quién baja y si un jugador está barato.', 'Tendencia de cada jugador, cuánto se paga de verdad en tu liga y cuánto pujar para llevártelo sin regalar dinero.'],
  ['equipo', 'Tu once', 'Te dice quién juega y quién no antes de cerrar la alineación.', 'Probabilidad de ser titular, rival de cada jornada, rotaciones por Europa o Copa y el once confirmado en cuanto sale.'],
  ['ia', 'La IA', 'Le preguntas lo que quieras, como a un amigo que sabe de esto.', 'Lee lesiones, convocatorias y alineaciones antes de contestar, y la app comprueba sus cuentas antes de enseñártelas.'],
];
const funciones = (modo, vis = '') => FUNCIONES.map(([ic, t, a, b], i) => `<article class="pf-c rv${vis}"><span class="pf-n">${String(i + 1).padStart(2, '0')}</span>${icono(ic)}<h3>${t}</h3><p>${esc(modo === 'liga' ? b : a)}</p></article>`).join('');

/* ---------- 4. así decide ---------- */
const CASOS = [
  {
    id: 'baja', chip: 'Un titular baja de valor', lid: 3106, eq: 15, nombre: 'Cucurella',
    ves: 'Cucurella lleva 7 días bajando: ha perdido un 6 % de su valor.',
    mira: ['Juega mañana y es titular probable (82 %).', 'Hoy ha subido un 1,2 %: el bajón se está frenando.', 'Su cláusula está abierta por encima de lo que da LaLiga si lo vendes.'],
    dice: 'Espera. Vender un titular el día antes de que juegue es tirar puntos por unos pocos euros.', tipo: 'oro',
  },
  {
    id: 'clausula', chip: 'Se abre una cláusula', lid: 3091, eq: 16, nombre: 'Oyarzabal',
    ves: 'La cláusula de Oyarzabal (35,85 M) se ha abierto y tienes 38,10 M de saldo.',
    mira: ['Una cláusula solo se paga con saldo: el margen de deuda no vale para esto.', 'Nadie puede clausular en las 24 h antes del primer partido de la jornada, y falta un día.', 'Iván, su dueño, tiene dinero para subirle la cláusula mañana.'],
    dice: 'Clausúlalo hoy, antes de que se cierre la ventana. Te quedas con 2,25 M de saldo.', tipo: 'rojo',
  },
  {
    id: 'blindar', chip: 'Van a por uno de los tuyos', lid: 3103, eq: 15, nombre: 'Mbappé',
    ves: 'La cláusula de Mbappé (121,4 M) está abierta y dos rivales tienen dinero para pagarla.',
    mira: ['El rival más rico puede gastar 130 M.', 'En tu liga, nadie ha pagado nunca más de un 45 % por encima del valor de un jugador.', 'Subir la cláusula cuesta la mitad de lo que la subes, y no compensa gastar más de una cuarta parte de lo que vale.'],
    dice: 'Súbela a 133,9 M. Te cuesta 6,25 M y ya no le llega a nadie.', tipo: 'verde',
  },
  {
    id: 'puja', chip: 'Quieres pujar', lid: 3076, eq: 26, nombre: 'Yeremay',
    ves: 'Yeremay sale en el mercado a 23,76 M y te gusta para tu delantera.',
    mira: ['Puedes pujar hasta 39,16 M: tu saldo más el margen de deuda de tu liga, menos lo que ya tienes pujado.', 'En tu liga, los jugadores de su precio se los lleva quien puja un 8 % por encima.', 'Tiene 3 pujas: con lo justo, lo pierdes.'],
    dice: 'Puja 25,66 M. Más es regalar dinero; menos, quedarte sin él.', tipo: 'verde',
  },
];
function caso(id) {
  const c = CASOS.find((x) => x.id === id) || CASOS[0];
  return `<div class="pd-ves">${cara(c.lid, c.nombre, c.eq, 'grande')}<p><small>Lo que ves</small>${esc(c.ves)}</p></div>
    <div class="pd-mira"><small>Lo que mira la app</small><ul>${c.mira.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>
    <div class="pd-dice ${c.tipo}"><small>Lo que te dice</small><b>${esc(c.dice)}</b></div>`;
}

/* ---------- 5. calculadoras (las mismas cuentas que motor.js) ---------- */
const hasta = (v) => Math.ceil(Math.max(v, 0) * 1.03 * 10 - 1e-6) / 10;
/** el blindaje justo: subir la cláusula hasta donde no le llegue al rival más rico, sin pasar de lo que se paga en tu
    liga por una cláusula (+5 %); subir X cuesta X/2 y no compensa si cuesta más de 1/4 de su valor (motor.js) */
export function blindaje(valor, clausula, rico, pagaPct) {
  const techo = hasta(valor * (1 + pagaPct / 100 + 0.05));
  const T0 = hasta(rico), T = Math.min(T0, techo);
  if (clausula >= techo) return { ok: true, txt: `Ya está a salvo: nadie en tu liga paga tanto por encima de su valor.` };
  if (T <= clausula) return { ok: true, txt: `Ya está a salvo: al más rico no le llega.` };
  const coste = Math.ceil((T - clausula) / 2 * 100 - 1e-6) / 100;
  const caro = coste > valor / 4;
  return {
    ok: !caro, objetivo: T, coste,
    txt: caro
      ? `No compensa: subirla a ${mM(T)} cuesta ${mM(coste)}, más de una cuarta parte de lo que vale (${mM(valor / 4)}).`
      : `Súbela a ${mM(T)}. Te cuesta ${mM(coste)}${T < T0 ? `: no hace falta llegar a lo que tiene el más rico, en tu liga nadie paga tanto` : ' y ya no le llega a nadie'}.`,
  };
}
export function gastar(saldo, valorEq, deudaPct, pujas) {
  const deuda = Math.floor(valorEq * deudaPct) / 100;
  return { puja: saldo + deuda - pujas, clausula: Math.max(0, saldo) };
}
const deslizador = (id, t, min, max, paso, v, suf = ' M') => `<label class="pk-d"><span>${t}<output data-o="${id}">${NF1.format(v)}${suf}</output></span>
  <input type="range" data-k="${id}" min="${min}" max="${max}" step="${paso}" value="${v}"></label>`;
const CALC = {
  blindaje: () => `${deslizador('v', 'Lo que vale tu jugador', 1, 150, 0.5, 40)}${deslizador('c', 'Su cláusula ahora', 1, 200, 0.5, 44)}${deslizador('r', 'Lo que puede gastar el rival más rico', 0, 250, 0.5, 60)}${deslizador('p', 'Lo más que se paga en tu liga por una cláusula', 5, 100, 5, 50, ' % sobre su valor')}`,
  gastar: () => `${deslizador('s', 'Tu saldo', -20, 150, 0.5, 12)}${deslizador('e', 'Lo que vale tu equipo', 20, 600, 5, 180)}${deslizador('d', 'Margen de deuda de tu liga', 0, 50, 1, 20, ' % del equipo')}${deslizador('u', 'Lo que ya tienes pujado', 0, 100, 0.5, 0)}`,
};
/** la regla de la calculadora del blindaje: cada cifra es una marca en la línea y una fila de la leyenda (así los
    nombres no se pisan cuando dos cifras están cerca) */
function regla(marcas, tramo) {
  const max = Math.max(...marcas.map((m) => m[0])) * 1.1 || 1;
  const pc = (v) => Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="pk-regla">${tramo ? `<span class="pk-tramo" style="--a:${pc(tramo[0])}%;--b:${pc(tramo[1])}%"></span>` : ''}
    ${marcas.map(([v, , cls]) => `<span class="pk-m ${cls}" style="--x:${pc(v)}%"><i></i></span>`).join('')}</div>
    <div class="pk-ley2">${marcas.map(([v, t, cls]) => `<span class="${cls}"><i></i>${t}<b>${mM(v)}</b></span>`).join('')}</div>`;
}
function resultado(tipo, k) {
  if (tipo === 'blindaje') {
    const r = blindaje(k.v, k.c, k.r, k.p);
    const techo = hasta(k.v * (1 + k.p / 100 + 0.05));
    // (la marca roja es desde dónde ya no le llega al más rico: con 60 M decía «Le llega al más rico 61,80 M»)
    const marcas = [[k.c, 'Su cláusula ahora', 'gris'], [hasta(k.r), k.c >= hasta(k.r) ? 'Ya no le llega al más rico' : 'Para que no le llegue al más rico', 'rojo'], [techo, 'Lo más que se paga en tu liga', 'oro']];
    if (r.objetivo) marcas.push([r.objetivo, 'Súbela a', 'verde']);
    return `${regla(marcas, r.objetivo ? [k.c, r.objetivo] : null)}<b class="pk-dice ${r.ok ? 'verde' : 'rojo'}">${esc(r.txt)}</b>`;
  }
  const g = gastar(k.s, k.e, k.d, k.u);
  const deuda = g.puja - k.s + k.u, total = Math.max(1, Math.max(0, k.s) + deuda);
  return `<div class="pk-barra"><span class="v" style="--w:${(Math.max(0, k.s) / total) * 100}%"></span><span class="o" style="--w:${(deuda / total) * 100}%"></span>${k.u ? `<span class="u" style="--w:${Math.min(100, (k.u / total) * 100)}%"></span>` : ''}</div>
    <div class="pk-ley"><span class="v">Saldo</span><span class="o">Margen de deuda</span>${k.u ? '<span class="u">Ya pujado</span>' : ''}</div>
    <div class="pk-dos"><div><small>Para pujar</small><b class="${g.puja > 0 ? 'verde' : 'rojo'}">${mM(Math.max(0, g.puja))}</b></div><div><small>Para clausular</small><b>${mM(g.clausula)}</b></div></div>
    <p>Una cláusula solo se paga con saldo; el margen de deuda solo vale para pujar o comprar en el mercado.</p>`;
}

/* ---------- 6. preguntas y privacidad ---------- */
const PREGUNTAS = [
  ['¿Es la app oficial de LaLiga Fantasy?', 'No. Fantasy Manager no es de LaLiga ni tiene relación con LaLiga, LaLiga Fantasy ni sus patrocinadores. Lee tu liga con tu propia cuenta y hace las cuentas que el juego no te enseña.'],
  ['¿Cuánto cuesta?', 'Nada. Se paga con anuncios de Google en esta web (y en la versión de Google Play, cuando salga). No hay plan de pago y no se venden datos de nadie.'],
  ['¿La app ve mi contraseña?', 'No. Entras en la página oficial de LaLiga, como siempre (también con Google), y LaLiga le da a la app una sesión para leer tu liga.'],
  ['¿Dónde se guardan los datos de mi liga?', 'Solo en tu móvil o en tu navegador. Lo que se guarda y dónde está contado en la política de privacidad.'],
  ['¿Funciona en iPhone y en el ordenador?', 'En Android, con la app, que se instala desde esta web. En el ordenador, desde esta web: con la app del móvil entras escaneando un QR, y sin ella la web te explica cómo entrar. En iPhone no hay app, pero la web funciona: la primera vez hay que entrar desde un ordenador, porque LaLiga no deja hacerlo en el iPhone; ya dentro, en Ajustes → Abrir en otro dispositivo sacas un código para el iPhone. Antes puedes verla con la liga de ejemplo.'],
  ['¿Qué hace la IA y qué necesito para usarla?', 'Lee lesiones, convocatorias y alineaciones antes de proponerte el plan o de contestar lo que le preguntes. Usa una clave gratuita tuya; la app te enseña a sacarla en un par de minutos. Lo que propone pasa antes por la app, que comprueba que las cuentas de dinero salen.'],
  ['¿De dónde salen los datos de fútbol?', 'Los de tu liga, de LaLiga Fantasy con tu sesión. Las alineaciones probables, lesiones, estadísticas y noticias, de páginas públicas.'],
];
const PRIVACIDAD = [
  ['candado', 'Tu contraseña, nunca', 'Entras en la página de LaLiga. La app solo recibe una sesión para leer tu liga.'],
  ['equipo', 'Tu liga, en tu móvil', 'Plantillas, saldo y movimientos se guardan en tu móvil o tu navegador, no en un servidor.'],
  ['ojo', 'Nada en venta', 'La app se paga con anuncios. No hay plan de pago y no se venden datos de nadie.'],
];

/** las páginas públicas (HTML sin JavaScript, de .github/paginas.py). «Guías» entra cuando haya alguna publicada */
const ENLACES = [['guias/', 'Guías'], ['quienes-somos.html', 'Quiénes somos'], ['contacto.html', 'Contacto'], ['privacidad.html', 'Privacidad'], ['instalar.html', 'Instalar']];
const APK = 'https://fantasymanagerapp.com/descargas/fantasy-manager.apk';

// <guias>
/** las guías publicadas, en orden: [archivo en guias/, nombre corto] (las escribe .github/paginas.py) */
const TODAS_GUIAS = [
  ["empezar-liga.html", "Empezar una liga"],
  ["puntos-laliga-fantasy.html", "Puntos"],
  ["glosario.html", "Glosario"],
  ["clausulas-laliga-fantasy.html", "Cláusulas"],
  ["subir-clausula.html", "Subir la cláusula"],
  ["blindaje-laliga-fantasy.html", "Blindaje"],
  ["cuando-clausular.html", "Cuándo clausular"],
  ["hora-mercado-laliga-fantasy.html", "Hora del mercado"],
  ["valor-de-mercado.html", "Valor de mercado"],
  ["cuanto-pujar.html", "Cuánto pujar"],
  ["cuando-vender.html", "Cuándo vender"],
  ["saldo-negativo.html", "Saldo negativo"],
  ["ganar-dinero.html", "Ganar dinero"],
  ["alineacion.html", "Alineación"],
  ["puntos-porteros-laliga-fantasy.html", "Puntos de los porteros"],
  ["puntos-dazn-laliga-fantasy.html", "Puntos DAZN"],
  ["lesionados-sancionados.html", "Lesionados"],
  ["apercibidos-laliga.html", "Apercibidos"],
];
const FAQ_GUIA = "preguntas-frecuentes.html";
// </guias>

/** las guías con tarjeta en la portada: [archivo en guias/, icono, título, de qué va]. El resto sale en «También:» */
const GUIAS = [
  ['empezar-liga.html', 'bandera', 'Empezar una liga', 'El equipo inicial, el primer mercado y los errores que más cuestan.'],
  ['puntos-laliga-fantasy.html', 'estrella', 'Cómo se puntúa', 'La tabla de puntos por posición, los tramos y la valoración DAZN.'],
  ['clausulas-laliga-fantasy.html', 'candado', 'Cláusulas', 'Cuándo sube sola, los 14 días de protección y el cierre de 24 h.'],
  ['subir-clausula.html', 'escudo', 'Subir la cláusula', 'Cuánto cuesta, hasta dónde compensa y cuándo basta el blindaje.'],
  ['cuando-clausular.html', 'diana', 'Cuándo clausular', 'Lo que pagas de más, lo que sube y lo que te deja en caja.'],
  ['hora-mercado-laliga-fantasy.html', 'reloj', 'A qué hora cambia el mercado', 'El cambio de cada noche y lo que cierra antes de la jornada.'],
  ['valor-de-mercado.html', 'grafico', 'Valor de mercado', 'Qué lo mueve y cómo leer una racha.'],
  ['cuanto-pujar.html', 'euro', 'Cuánto pujar', 'Pujas a ciegas, margen de deuda y cómo pujan tus rivales.'],
  ['cuando-vender.html', 'baja', 'Cuándo vender', 'A LaLiga o a un rival, y cuándo esperar un día más.'],
].filter(([h]) => TODAS_GUIAS.some(([x]) => x === h));
/** «También: …», con enlace: las publicadas que no tienen tarjeta y las preguntas frecuentes */
function otrasGuias() {
  const otras = TODAS_GUIAS.filter(([h]) => !GUIAS.some(([x]) => x === h)).map(([h, t]) => `<a href="guias/${h}">${esc(t.charAt(0).toLowerCase() + t.slice(1))}</a>`);
  if (FAQ_GUIA) otras.push(`<a href="guias/${FAQ_GUIA}">las preguntas frecuentes</a>`);
  return otras.length > 1 ? `${otras.slice(0, -1).join(', ')} y ${otras[otras.length - 1]}` : otras.join('');
}

/** la cabecera de cada sección: a la izquierda lo que es y el título, a la derecha (en el ordenador) la entradilla */
const seccion = (id, kicker, titulo, cuerpo, intro = '', clase = '') => `<section class="ps ${clase}" id="${id}" aria-labelledby="${id}T">
  <header class="ps-c rv"><div><div class="ps-k">${kicker}</div><h2 id="${id}T">${titulo}</h2></div>${intro ? `<p class="ps-i">${intro}</p>` : ''}</header>${cuerpo}</section>`;

const MENU = [['pAsi', 'Cómo funciona'], ['pOnce', 'Tu once'], ['pDentro', 'Qué hace'], ['pDecide', 'Así decide'], ['pCalc', 'Calculadoras'], ['pGuias', 'Guías'], ['pFaq', 'Preguntas']];

/** «Cómo funciona»: en el ordenador, el móvil se queda quieto a la derecha y cambia de pantalla según bajas; en el
    móvil, uno detrás de otro deslizando de lado */
function comoFunciona() {
  const pasos = PIES.map(([a, p, t, x, det], i) => `<article class="ph-paso${i === 0 ? ' on' : ''}" data-paso="${i}">
      <div class="ph-solo">${movil(a, p)}</div>
      <span class="ph-n">${String(i + 1).padStart(2, '0')}</span><h3>${t}</h3><p>${x}</p>
      <ul>${det.map((d) => `<li>${icono('ok')}${esc(d)}</li>`).join('')}</ul></article>`).join('');
  const pantallas = PIES.map(([a, p], i) => `<div class="ph-pant${i === 0 ? ' on' : ''}" data-pant="${i}">${movil(a, p)}</div>`).join('');
  return `<div class="ph-g"><p class="ph-desliza" aria-hidden="true">Desliza para ver los 3 pasos${icono('flecha')}</p><div class="ph-pasos">${pasos}</div>
    <div class="ph-puntos ph-puntos-m">${PIES.map((x, i) => `<button type="button" data-ir-paso="${i}" aria-label="Paso ${i + 1}"${i === 0 ? ' class="on"' : ''}></button>`).join('')}</div>
    <div class="ph-fijo" aria-hidden="true"><div class="ph-marco">${pantallas}</div><div class="ph-puntos">${PIES.map((x, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div></div></div>`;
}

/** todo lo que va debajo de la entrada */
export function seccionMoviles() {
  return `<div class="portada-m">
  <div class="pt-baja"><a class="pt-baja-a" href="#pAsi"><span>Mira cómo funciona</span>${icono('abajo')}</a><a class="pt-baja-g" href="#pGuias">${icono('nota')}<span>Guías del juego</span></a></div>
  <div class="pt-bar" aria-hidden="true"><div class="pt-in">
    <a class="pt-marca" href="#" data-arriba>${LOGO_P}<span>Fantasy <b>Manager</b></span></a>
    <nav class="pt-menu" aria-label="Secciones">${MENU.map(([id, t]) => `<a href="#${id}" data-ir-a="${id}" tabindex="-1">${t}</a>`).join('')}</nav>
    <a class="btn sec pt-web" href="#" tabindex="-1" title="Fantasy Manager funciona también en el navegador, sin descargar nada"><span class="pt-largo">Usar en la web</span><span class="pt-corto">Web</span></a>
    <a class="btn pt-cta" href="${APK}" tabindex="-1">${icono('descargar')}<span>Descargar<span class="pt-largo"> la app</span></span></a></div><i class="pt-prog"></i></div>

  ${seccion('pAsi', 'La app', 'Cómo funciona', comoFunciona(), 'Fantasy Manager es una app para LaLiga Fantasy. Estas son las tres pantallas que vas a abrir cada día.', 'ph')}

  ${seccion('pOnce', 'Tu equipo', 'Tu once, de un vistazo', `<div class="pc"><div class="pc-campo-w rv">${campo()}</div><div class="pc-ficha rv" aria-live="polite">${fichaOnce(3103)}</div></div>`,
    'Toca un jugador: lo que vale, su cláusula, si va a jugar y qué te aconseja la app.')}

  ${seccion('pDentro', 'Por dentro', 'Qué hace por ti', `<div class="pf-sw rv" role="group" aria-label="Cómo juegas">
      <button data-modo="diversion" aria-pressed="true">Juego por diversión</button><button data-modo="liga" aria-pressed="false">Voy a por la liga</button></div>
    <div class="pf-g">${funciones('diversion')}</div>
    <div class="pf-cifras rv"><div><b data-cuenta="20">20</b><span>equipos de LaLiga</span></div><div><b data-cuenta="800" data-antes="+">+800</b><span>jugadores, con su valor de cada día</span></div><div><b data-cuenta="1" data-despues=" min">1 min</b><span>lo que tarda en avisarte de una cláusula</span></div></div>`,
    'Lo mismo sirve para echar un rato que para ganar la liga. Elige cómo juegas tú.')}

  ${seccion('pDecide', 'El motor', 'Así decide', `<div class="pd-chips rv" role="tablist">${CASOS.map((c, i) => `<button role="tab" data-caso="${c.id}" aria-selected="${i === 0}"><span>${esc(c.chip)}</span><i></i></button>`).join('')}</div>
    <div class="pd rv" aria-live="polite">${caso(CASOS[0].id)}</div>`,
    'Cuatro situaciones de cada semana y lo que tiene en cuenta antes de decirte nada.')}

  ${seccion('pCalc', 'Haz tus cuentas', 'Calculadoras', `<div class="pk-chips rv" role="tablist"><button role="tab" data-calc="blindaje" aria-selected="true">¿Cuánto subo la cláusula?</button><button role="tab" data-calc="gastar" aria-selected="false">¿Cuánto puedo gastar?</button></div>
    <div class="pk rv" data-tipo="blindaje"><div class="pk-in">${CALC.blindaje()}</div><div class="pk-r" aria-live="polite"></div></div>`,
    'Las mismas cuentas que hace la app con tu liga. Mueve los números y mira qué cambia.')}

  ${seccion('pGuias', 'Aprende', 'Guías del juego', `<div class="pg">${GUIAS.map(([h, ic, t, x], i) => `<a class="pg-c rv" href="guias/${h}"><span class="pg-ic">${icono(ic)}</span><span class="pg-n">${String(i + 1).padStart(2, '0')}</span><h3>${t}</h3><p>${esc(x)}</p><span class="pg-ir">Leer la guía${icono('flecha')}</span></a>`).join('')}</div>
    <div class="pg-todas rv"><a class="btn sec" href="guias/">${icono('lista')}Ver las ${TODAS_GUIAS.length + (FAQ_GUIA ? 1 : 0)} guías</a><span>También: ${otrasGuias()}.</span></div>`,
    'Cómo funcionan las cláusulas, el mercado y el dinero de LaLiga Fantasy, explicado con números. Gratis y sin entrar.')}

  ${seccion('pFaq', 'Dudas', 'Preguntas frecuentes', `<div class="pq">${PREGUNTAS.map(([p, r]) => `<details class="rv"><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}</div>`)}

  ${seccion('pPriv', 'Privacidad', 'Tus datos, tuyos', `<div class="pp">${PRIVACIDAD.map(([ic, t, x]) => `<article class="rv">${icono(ic)}<h3>${t}</h3><p>${x}</p></article>`).join('')}</div>`)}

  <section class="pz-fin rv" aria-labelledby="pzT"><h2 id="pzT">Empieza hoy</h2>
    <p class="ps-i">Gratis. En Android, con la app. En el ordenador se usa desde esta misma web, sin descargar nada, y en el iPhone también, después de entrar una vez desde un ordenador.</p>
    <div class="pz-b"><a class="btn" href="${APK}">${icono('descargar')}Descargar la app para Android</a><a class="btn sec" href="#">Usar en la web</a><button class="btn sec" data-accion="entrarDemo">Ver con una liga de ejemplo</button></div>
    ${proxPlay()}
    <p class="pz-x"><a href="https://x.com/Fantasyman_app" rel="noopener" target="_blank">@Fantasyman_app</a> en X: bajas, onces y los mejores de cada jornada.</p>
  </section>

  <footer class="pm-fin">
    <p class="pm-nota">Liga de ejemplo: las caras y los equipos son los de LaLiga; valores, cláusulas y consejos son inventados. Tu liga se carga al entrar con tu cuenta de LaLiga.</p>
    <p class="pm-pie">App no oficial: no es de LaLiga ni tiene relación con LaLiga.</p>
    <nav class="pm-pie pm-enlaces" aria-label="Más">${ENLACES.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  </footer>
  </div>`;
}

/* ---------- lo que se mueve ---------- */
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let quitar = [];
const escuchar = (el, ev, f, op) => { el.addEventListener(ev, f, op); quitar.push(() => el.removeEventListener(ev, f, op)); };
const observar = (f, op) => { const o = new IntersectionObserver(f, op); quitar.push(() => o.disconnect()); return o; };
const relojes = [];
const cadaTanto = (f, ms) => { const t = setInterval(f, ms); relojes.push(t); return t; };

/** un número que sube de 0 a su valor */
function contar(el) {
  const fin = +el.dataset.cuenta, antes = el.dataset.antes || '', despues = el.dataset.despues || '';
  if (sinMovimiento() || !fin) return;
  const t0 = performance.now(), dura = 1100;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dura), e = 1 - (1 - k) ** 3;
    el.textContent = `${antes}${Math.round(fin * e)}${despues}`;
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** lo interactivo de la portada (se llama tras pintarla) */
export function activarPortada() {
  quitar.forEach((f) => f()); quitar = [];
  relojes.forEach(clearInterval); relojes.length = 0;
  const raiz = document.querySelector('.portada-m');
  if (!raiz) return;
  const portada = raiz.closest('.portada');
  const hayIO = typeof IntersectionObserver === 'function';
  if (hayIO && !sinMovimiento()) portada.classList.add('pr-js');

  // al aparecer: cada cosa entra al llegar a ella (con un poco de retraso entre las de un mismo grupo)
  if (hayIO) {
    const vista = observar((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('vis');
      e.target.querySelectorAll('[data-cuenta]').forEach(contar);
      vista.unobserve(e.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    raiz.querySelectorAll('.rv').forEach((el) => {
      const hermanos = [...el.parentElement.children].filter((x) => x.classList.contains('rv'));
      el.style.setProperty('--d', `${Math.min(6, hermanos.indexOf(el)) * 70}ms`);
      vista.observe(el);
    });
  } else raiz.querySelectorAll('.rv').forEach((el) => el.classList.add('vis'));

  // la barra de arriba: sale al pasar la entrada, marca la sección en la que estás y lo leído
  const barra = raiz.querySelector('.pt-bar'), prog = raiz.querySelector('.pt-prog');
  const entrada = portada.querySelector('.pantalla');
  const secciones = MENU.map(([id]) => raiz.querySelector(`#${id}`)).filter(Boolean);
  const menu = barra.querySelector('.pt-menu');
  let pedido = false, ultimaSec = null;
  const alBajar = () => {
    pedido = false;
    // (fuera de la portada, al entrar en la app, se deja de escuchar)
    if (!document.body.contains(raiz)) { quitar.forEach((f) => f()); quitar = []; relojes.forEach(clearInterval); relojes.length = 0; return; }
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    const fuera = entrada ? entrada.getBoundingClientRect().bottom < 40 : y > 300;
    barra.classList.toggle('on', fuera);
    barra.querySelectorAll('a').forEach((a) => (a.tabIndex = fuera ? 0 : -1));
    barra.setAttribute('aria-hidden', String(!fuera));
    prog.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
    let actual = '';
    for (const s of secciones) if (s.getBoundingClientRect().top < innerHeight * 0.4) actual = s.id;
    barra.querySelectorAll('[data-ir-a]').forEach((a) => a.classList.toggle('on', a.dataset.irA === actual));
    if (actual !== ultimaSec) {
      ultimaSec = actual;
      const a = actual && menu.querySelector(`[data-ir-a="${actual}"]`);
      if (a && menu.scrollWidth > menu.clientWidth) menu.scrollTo({ left: a.offsetLeft - (menu.clientWidth - a.offsetWidth) / 2, behavior: sinMovimiento() ? 'auto' : 'smooth' });
    }
  };
  escuchar(window, 'scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(alBajar); } }, { passive: true });
  alBajar();
  // los enlaces de dentro: suaves y sin dejar el # en la dirección (la app usa el hash para sus pestañas)
  raiz.querySelectorAll('a[href^="#"]').forEach((a) => escuchar(a, 'click', (ev) => {
    ev.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = id && raiz.querySelector(`#${id}`);
    const top = el ? el.getBoundingClientRect().top + scrollY - (barra.offsetHeight || 56) - 8 : 0;
    scrollTo({ top, behavior: sinMovimiento() ? 'auto' : 'smooth' });
  }));

  // «Cómo funciona»: el paso que está en el centro de la pantalla manda en el móvil fijo
  const pasos = [...raiz.querySelectorAll('.ph-paso')];
  const pantallas = [...raiz.querySelectorAll('.ph-pant')], puntos = [...raiz.querySelectorAll('.ph-puntos i')];
  const ponerPaso = (i) => {
    pasos.forEach((p, k) => p.classList.toggle('on', k === i));
    pantallas.forEach((p, k) => { p.classList.toggle('on', k === i); p.classList.toggle('antes', k < i); });
    puntos.forEach((p, k) => p.classList.toggle('on', k === i));
  };
  const carril = raiz.querySelector('.ph-pasos'), puntosM = [...raiz.querySelectorAll('.ph-puntos-m button')];
  const deLado = () => carril && carril.scrollWidth > carril.clientWidth + 4;
  if (carril) {
    escuchar(carril, 'scroll', () => {
      if (!deLado()) return;
      const ancho = pasos[1] ? pasos[1].offsetLeft - pasos[0].offsetLeft : carril.clientWidth;
      const i = Math.max(0, Math.min(pasos.length - 1, Math.round(carril.scrollLeft / ancho)));
      puntosM.forEach((p, k) => p.classList.toggle('on', k === i));
      if (i > 0) raiz.querySelector('.ph-desliza')?.classList.add('visto');
    }, { passive: true });
    puntosM.forEach((b) => escuchar(b, 'click', () => {
      const p = pasos[+b.dataset.irPaso];
      if (p) carril.scrollTo({ left: p.offsetLeft - (carril.clientWidth - p.offsetWidth) / 2, behavior: sinMovimiento() ? 'auto' : 'smooth' });
    }));
  }
  if (hayIO) {
    const centro = observar((es) => es.forEach((e) => { if (e.isIntersecting) ponerPaso(+e.target.dataset.paso); }), { rootMargin: '-45% 0px -45% 0px' });
    pasos.forEach((p) => centro.observe(p));
  }

  // el once: va pasando de jugador en jugador mientras se ve, hasta que tocas uno
  const jugadores = [...raiz.querySelectorAll('.pc-j')];
  const ficha = raiz.querySelector('.pc-ficha');
  const elegir = (b) => {
    jugadores.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ficha.classList.remove('cambia'); void ficha.offsetWidth; ficha.classList.add('cambia');
    ficha.innerHTML = fichaOnce(b.dataset.pj);
    ponerCarasPortada(ultimas);
  };
  let tocado = false, verOnce = false;
  jugadores.forEach((b) => escuchar(b, 'click', () => { tocado = true; elegir(b); }));
  if (hayIO && !sinMovimiento()) {
    observar((es) => es.forEach((e) => { verOnce = e.isIntersecting; }), { threshold: 0.5 }).observe(raiz.querySelector('.pc'));
    const orden = ['3103', '2534', '3106', '230', '3104', '1715'];
    let k = 0;
    cadaTanto(() => {
      if (tocado || !verOnce || document.hidden) return;
      k = (k + 1) % orden.length;
      const b = jugadores.find((x) => x.dataset.pj === orden[k]);
      if (b) elegir(b);
    }, 3800);
  }
  // el campo se inclina un poco siguiendo el ratón
  const campoW = raiz.querySelector('.pc-campo-w');
  if (campoW && !sinMovimiento() && matchMedia('(hover: hover)').matches) {
    escuchar(campoW, 'pointermove', (e) => {
      const r = campoW.getBoundingClientRect();
      campoW.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
      campoW.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
    });
    escuchar(campoW, 'pointerleave', () => { campoW.style.setProperty('--rx', '0deg'); campoW.style.setProperty('--ry', '0deg'); });
  }

  // qué hace por ti: el interruptor y una luz que sigue al ratón en cada tarjeta
  const grid = raiz.querySelector('.pf-g');
  raiz.querySelectorAll('.pf-sw button').forEach((b) => escuchar(b, 'click', () => {
    raiz.querySelectorAll('.pf-sw button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    grid.classList.add('cambia');
    setTimeout(() => { grid.innerHTML = funciones(b.dataset.modo, ' vis'); grid.classList.remove('cambia'); }, sinMovimiento() ? 0 : 160);
  }));
  escuchar(grid, 'pointermove', (e) => {
    const c = e.target.closest('.pf-c');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });

  // así decide: los casos pasan solos (con su barra) mientras se ven, hasta que eliges uno
  const chips = [...raiz.querySelectorAll('.pd-chips button')], pd = raiz.querySelector('.pd');
  const ponerCaso = (b, solo) => {
    chips.forEach((x) => { x.setAttribute('aria-selected', String(x === b)); x.classList.remove('corre'); });
    if (solo) { void b.offsetWidth; b.classList.add('corre'); }
    pd.classList.remove('cambia'); void pd.offsetWidth; pd.classList.add('cambia');
    pd.innerHTML = caso(b.dataset.caso);
    ponerCarasPortada(ultimas);
  };
  let elegido = false, iCaso = 0;
  const filaChips = raiz.querySelector('.pd-chips');
  chips.forEach((b, i) => {
    escuchar(b, 'click', () => { elegido = true; iCaso = i; filaChips.classList.remove('auto'); ponerCaso(b, false); });
    // al acabar su barra, el siguiente
    escuchar(b, 'animationend', () => {
      if (elegido) return;
      iCaso = (iCaso + 1) % chips.length;
      ponerCaso(chips[iCaso], true);
    });
  });
  if (hayIO && !sinMovimiento()) {
    filaChips.classList.add('auto', 'pausa');
    chips[0].classList.add('corre');
    observar((es) => es.forEach((e) => filaChips.classList.toggle('pausa', !e.isIntersecting)), { threshold: 0.35 }).observe(pd);
  }

  // calculadoras
  const pk = raiz.querySelector('.pk');
  const calcular = () => {
    const k = {};
    pk.querySelectorAll('input[data-k]').forEach((i) => {
      k[i.dataset.k] = +i.value;
      const o = pk.querySelector(`output[data-o="${i.dataset.k}"]`);
      if (o) o.textContent = o.textContent.replace(/^[−\-\d.,]+/, NF1.format(+i.value).replace('-', '−'));
      i.style.setProperty('--p', `${((+i.value - +i.min) / (+i.max - +i.min)) * 100}%`);
    });
    pk.querySelector('.pk-r').innerHTML = resultado(pk.dataset.tipo, k);
  };
  escuchar(pk, 'input', calcular);
  const pkChips = [...raiz.querySelectorAll('.pk-chips button')];
  pkChips.forEach((b) => escuchar(b, 'click', () => {
    pkChips.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    pk.dataset.tipo = b.dataset.calc;
    pk.querySelector('.pk-in').innerHTML = CALC[b.dataset.calc]();
    calcular();
  }));
  calcular();
}

let ultimas = null;
/** pone en la portada las caras y los escudos que hayan llegado de LaLiga (los de caras-demo.js) */
export function ponerCarasPortada(g) {
  if (!g) return;
  ultimas = g;
  const porLid = {};
  for (const d of jugadoresDemo()) if (g.caras && g.caras[d.id]) porLid[d.lid] = g.caras[d.id];
  const img = (cls, u) => `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`;
  document.querySelectorAll('.portada [data-lid]').forEach((el) => {
    const u = porLid[el.dataset.lid];
    if (u && !el.querySelector('img.f')) el.insertAdjacentHTML('beforeend', img('f', u));
  });
  document.querySelectorAll('.portada [data-eq]').forEach((el) => {
    const u = g.escudos && g.escudos[el.dataset.eq];
    if (u && !el.querySelector('img.e')) el.insertAdjacentHTML('beforeend', img('e', u));
  });
}
