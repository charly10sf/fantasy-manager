// Pruebas sin red de la redacción desde los hechos: lib/claude.mjs (API falsa), lib/ia.mjs (quién contesta, topes y gasto),
// lib/redaccion.mjs (el validador y el bucle de redactar), lib/cronicas.mjs (qué prensa es de un partido) y los apodos sin «conjunto».
import { preguntarJson, esquemaJson, coste, SONNET, HAIKU } from '../lib/claude.mjs';
import { preguntar, sinCupo, cuentaHoy } from '../lib/ia.mjs';
import { revisar, redactar, parecido, cuerpoDe, apuntarReciente, recientesDe, sucesosSinHechos } from '../lib/redaccion.mjs';
import { incidenciasDe } from '../lib/relato.mjs';
import { EJEMPLOS } from '../lib/voz.mjs';
import { elegir } from '../lib/cronicas.mjs';
import { APODOS, variarEquipos, fijarLimite } from '../lib/texto.mjs';
import { nombresDe } from '../lib/pulir.mjs';
import { clubes, golesRival } from '../lib/hechos.mjs';
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
fijarLimite(1000);

// --- lib/claude.mjs ---
const e = esquemaJson({ type: 'OBJECT', required: ['a'], properties: { a: { type: 'STRING' }, b: { type: 'ARRAY', items: { type: 'INTEGER' } } } });
ok(e.type === 'object' && e.additionalProperties === false && e.properties.a.type === 'string' && e.properties.b.items.type === 'integer', 'el esquema de Gemini pasa a JSON Schema');
ok(Math.abs(coste(SONNET, { input_tokens: 6000, output_tokens: 450 }) - 0.0165) < 1e-9, 'Sonnet: 6.000 de entrada y 450 de salida, 0,0165 $');
ok(Math.abs(coste(HAIKU, { input_tokens: 2000, output_tokens: 500 }) - 0.00045) < 1e-9, 'Haiku: 2.000 y 500, 0,00045 $');
const resp = (status, cuerpo) => ({ status, text: async () => JSON.stringify(cuerpo) });
const bien = (datos, u = { input_tokens: 100, output_tokens: 20 }) => resp(200, { content: [{ type: 'thinking', thinking: '…' }, { type: 'text', text: JSON.stringify(datos) }], usage: u, stop_reason: 'end_turn' });
let vistos = [];
let r = await preguntarJson({ clave: 'k', prompt: 'hola', esquema: { type: 'OBJECT' }, sistema: 'guía', cache: true,
  pedir: async (url, op) => { vistos.push(JSON.parse(op.body)); return bien({ texto: 'ok' }); } });
ok(r.ok && r.datos.texto === 'ok' && r.modelo === SONNET, 'contesta con el JSON del bloque de texto (salida estructurada)');
ok(vistos[0].system[0].cache_control && vistos[0].output_config.format.type === 'json_schema' && !('temperature' in vistos[0]) && !vistos[0].tool_choice, 'el sistema va en caché, la salida es json_schema y sin temperatura ni tool_choice');
ok(!JSON.stringify(vistos[0]).includes('"k"'), 'la clave no va en el cuerpo');
let n = 0;
r = await preguntarJson({ clave: 'k', prompt: 'x', esquema: {}, pedir: async () => (++n === 1 ? resp(529, { error: { message: 'Overloaded' } }) : bien({ texto: 'otra vez' })) });
ok(r.ok && n === 2, 'un 529 se reintenta una vez');
r = await preguntarJson({ clave: 'k', prompt: 'x', esquema: {}, pedir: async () => resp(401, { error: { message: 'invalid x-api-key' } }) });
ok(!r.ok && /401/.test(r.error), 'un 401 no se reintenta');
vistos = [];
r = await preguntarJson({ clave: 'k', prompt: 'x', esquema: {}, temperatura: 0.2, pedir: async (u, op) => { const b = JSON.parse(op.body); vistos.push(b); return 'temperature' in b ? resp(400, { error: { message: 'temperature is not supported for this model' } }) : bien({ texto: 'sin temp' }); } });
ok(r.ok && vistos.length === 2 && !('temperature' in vistos[1]), 'si el modelo no admite la temperatura, se pregunta sin ella');
r = await preguntarJson({ clave: '', prompt: 'x', esquema: {} });
ok(!r.ok, 'sin clave no pregunta');

// --- lib/ia.mjs ---
const reg = { datos: { enviados: [] }, fichero: null, guardar() {} };
const viejo = { ...process.env };
process.env.ANTHROPIC_API_KEY = 'falsa'; process.env.BOT_IA = 'claude';
const cfgIa = { ...config, ia: { ...config.ia, topeDolaresDia: 0.05 } };
let quien = [];
const claudeF = async (op) => { quien.push(['claude', op.modelo]); return { ok: true, datos: { x: 1 }, modelo: op.modelo, uso: { entrada: 1000, salida: 100, cacheLee: 0, cacheEscribe: 0 }, dolares: 0.03 }; };
const geminiF = async () => { quien.push(['gemini']); return { ok: true, datos: { x: 2 }, modelo: 'gemini-x' }; };
r = await preguntar({ uso: 'clasificar', registro: reg, config: cfgIa, prompt: 'p', esquema: {}, claude: claudeF, gemini: geminiF });
ok(r.proveedor === 'claude' && quien[0][1] === HAIKU, 'clasificar va a Haiku');
r = await preguntar({ uso: 'redactar', registro: reg, config: cfgIa, prompt: 'p', esquema: {}, claude: claudeF, gemini: geminiF });
ok(r.proveedor === 'claude' && quien[1][1] === SONNET, 'redactar va a Sonnet');
ok(cuentaHoy(reg).dolares === 0.06 && cuentaHoy(reg).llamadas.redactar === 1 && cuentaHoy(reg).entrada === 2000, 'el gasto del día se apunta en el registro');
ok(/tope/.test(sinCupo('redactar', { registro: reg, config: cfgIa })), 'pasado el tope de dólares del día, sin cupo');
quien = [];
r = await preguntar({ uso: 'clasificar', registro: reg, config: cfgIa, prompt: 'p', esquema: {}, claude: claudeF, gemini: geminiF });
ok(quien.length === 1 && quien[0][0] === 'gemini', 'sin cupo, clasificar vuelve a Gemini');
r = await preguntar({ uso: 'redactar', registro: reg, config: cfgIa, prompt: 'p', esquema: {}, claude: claudeF, gemini: geminiF });
ok(!r.ok && quien.length === 1, 'sin cupo, redactar no pregunta a nadie (sale la plantilla)');
reg.datos.ia.dia = '2000-01-01';
cuentaHoy(reg);
ok(reg.datos.iaDias.length === 1 && reg.datos.iaDias[0].dia === '2000-01-01' && reg.datos.ia.dolares === 0, 'el día de antes pasa a iaDias');
process.env.BOT_IA = 'gemini'; quien = [];
r = await preguntar({ uso: 'clasificar', registro: reg, config, prompt: 'p', esquema: {}, claude: claudeF, gemini: geminiF });
ok(quien[0][0] === 'gemini', 'con el proveedor «gemini», Gemini como siempre');

// --- los apodos ---
ok(Object.values(APODOS).every((a) => a.a.every((x) => !/conjunto|equipo|CF$|de Vigo|de Santander/.test(x))), 'los apodos ya no llevan «el conjunto…» ni nombres oficiales largos');
ok(!/🟢|🔵|🔴/.test(variarEquipos('El Racing recibe al Barça y el Racing gana al Barça', { semilla: 'z' })), 'sin círculos de colores');

// --- el validador ---
const jugadores = [{ nickname: 'Eric' }, { nickname: 'Pedri' }, { nickname: 'Koke' }, { nickname: 'Budimir' }, { nickname: 'Blanco' }];
const equipos = { 1: 'FC Barcelona', 2: 'Atlético de Madrid', 3: 'C.A. Osasuna', 4: 'Deportivo Alavés' };
const todos = nombresDe(jugadores, equipos).filter((x) => x !== 'blanco');
const hechos = { tipo: 'noticias', noticia: 'Eric vuelve a la convocatoria', fuente: 'prensa: AS, MARCA',
  jugadores: [{ nombre: 'Eric', puesto: 'defensa', club: 'Barça', estado: 'disponible', mediaPuntos: '5,6', titularidadFantasyManager: '37 %', principal: true }],
  partido: { jornada: 12, partido: 'Atlético-Barça', local: 'Atlético', visitante: 'Barça', juega: 'fuera', rival: 'el Atlético', cuando: 'el domingo a las 21:00', rivalVa: '2º de 20', dificultad: 'difícil',
    golesRival: golesRival({ gf: 2, gc: 0.8, rgf: 2, rgc: 18, n: 20 }, 2, 'Atlético') },
  clubes: clubes('Barça', 'Atlético'), etiqueta: '✅ Disponible para la jornada 12 contra el Atlético' };
ok(hechos.partido.golesRival.paraEste === 'le viene mal', 'a un defensa le viene mal un rival que marca mucho');
const bueno = `✅ El Barça recupera a Eric para el domingo, según AS y MARCA.

Pero el Atleti, 2º y de los que más marcan, no es el mejor partido para un defensa, y Fantasy Manager solo le da un 37 % de titularidad. Si lo tienes, mejor esperar a los onces.`;
const rv = (t, extra = {}) => revisar(t, { hechos, todos, numeros: [], ...extra });
ok(rv(bueno).length === 0, `un texto bueno pasa (${rv(bueno).join('; ')})`);
const malos = [
  ['El Atleti va 2º y recibe al equipo el domingo. Eric, disponible.', /vaga/],
  ['Eric vuelve con el conjunto azulgrana. Disponible.', /conjunto/],
  ['Eric vuelve y Pedri también, según AS.', /no está en los hechos: pedri/],
  ['Eric vuelve, según AS. Lleva 7 goles.', /número 7/],
  ['Eric sigue siendo baja para el domingo, según AS.', /baja/],
  ['Eric vuelve, según AS, para jugar contra Atlético el domingo.', /sin artículo/],
  ['Eric vuelve y LaLiga Fantasy ya lo da como disponible.', /LaLiga Fantasy ya lo da/],
  ['Eric vuelve, según AS. 🟢', /círculos/],
  ['Eric vuelve, según el Mundo Deportivo.', /medio que no es la fuente/],
  ['Eric vuelve, según AS. El defensa promedia 5,6 puntos.', /muletilla/],
  ['Eric vuelve. Tiene un 37 % de titularidad, según AS.', /según/],
  ['Eric vuelve, según AS, y lo celebra Simeone.', /mayúscula/],
  ['Eric vuelve, según AS, pero no lo nombra.', null],
];
for (const [t, re] of malos) {
  const errs = rv(t);
  if (re) ok(errs.some((x) => re.test(x)), `tira «${t.slice(0, 50)}…» (${errs.slice(0, 2).join('; ')})`);
}
ok(rv('Vuelve, según AS, al once del Barça.').some((x) => /no nombra a Eric/.test(x)), 'el protagonista tiene que salir');
ok(rv('Eric vuelve, según AS, y el domingo le espera un Atlético que marca mucho.').length === 0, '«un Atlético» también lleva artículo');
ok(rv('Eric vuelve, según AS, y el domingo juega en Mestalla.').some((x) => /mayúscula/.test(x)), 'un estadio que no está en los hechos, fuera');
ok(rv('Eric vuelve, según AS. Y el Atlético es duro. 🦁').some((x) => /emoji|guía/.test(x)), 'un emoji suelto, fuera');
ok(revisar('El Levante, colista, recibe al Celta.', { hechos: { tipo: 'previa', jugadores: [], equipos: [{ club: 'Levante', va: '18º de 20' }], clubes: clubes('Levante', 'Celta') }, todos }).some((x) => /colista/.test(x)), '«colista» solo si va último');
ok(rv('Eric vuelve, según AS. Tiene un 37 % y antes un 37 %.').some((x) => /porcentajes/.test(x)), 'en noticias, un solo porcentaje');
ok(rv('Eric vuelve, según AS. Si dudas, mejor esperar a los onces.', { recientes: ['Pedri juega. Si dudas, mejor esperar a los onces del sábado.', 'Koke no está. Si dudas, mejor esperar a los onces.', 'Budimir juega. Si dudas, mejor esperar a los onces de mañana.'] }).some((x) => /muletilla/.test(x)), 'una muletilla que ya va en dos recientes, fuera');
ok(rv('Eric vuelve, según AS. Fantasy Manager le da un 37 %.').some((x) => /de titularidad/.test(x)), 'un % sin «de titularidad», fuera');
const h2 = { ...hechos, tipo: 'previa', jugadores: [...hechos.jugadores, { nombre: 'Pedri', club: 'Barça', titularidadFantasyManager: '52 %', principal: false }] };
ok(revisar('Eric vuelve, según AS, con un 37 % de titularidad. Pedri, con un 52 %, tampoco lo tiene cerrado.', { hechos: h2, todos }).length === 0, 'el primer % con «de titularidad» y el segundo sin él, vale');
ok(revisar('Eric vuelve, según AS, con un 37 % de titularidad. Pedri, con un 52 % de titularidad, tampoco.', { hechos: h2, todos }).some((x) => /solo con el primer/.test(x)), '«de titularidad» repetido en el segundo %, fuera');
ok(rv('Eric ya no es baja y vuelve, según AS.').length === 0, '«ya no es baja» no es llamarle baja');
const cron = [{ medio: 'MARCA', titulo: 'El Barça recupera a Eric para el Metropolitano', entradilla: 'El central vuelve a la lista de Flick tras superar sus molestias en el tobillo derecho' }];
ok(rv('Eric vuelve a la lista de Flick tras superar sus molestias en el tobillo derecho.', { cronicas: cron }).some((x) => /copia 6/.test(x)), 'copiar 6 palabras de una crónica, fuera');
ok(rv('✅ Eric vuelve a la lista, cuenta MARCA: Flick lo recupera tras el problema en el tobillo.', { cronicas: cron }).length === 0, 'usar un hecho de la crónica con palabras propias, vale (y Flick sale de la crónica)');
const reciente = 'El Barça recupera a Eric para el domingo, según AS y MARCA. Pero el Atleti es difícil para un defensa.';
const parecidoA = 'El Barça recupera a Eric para el domingo, según AS y MARCA. Y el Atleti es complicado para un defensa.';
ok(rv(parecidoA, { recientes: [reciente] }).some((x) => /empieza igual|parece/.test(x)), 'no puede repetir la entrada ni el esqueleto de un reciente');
ok(parecido('A B C D E F', 'A B C D E F') === 1 && parecido('uno dos tres cuatro cinco', 'seis siete ocho nueve diez') === 0, 'parecido() de 0 a 1');
ok(cuerpoDe('Hola\n\nqué tal\n\n✅ Disponible para la jornada 12 contra el Atlético') === 'Hola\n\nqué tal', 'el cuerpo sin la etiqueta');

// --- redactar (el bucle) ---
const reg2 = { datos: { enviados: [], recientes: { noticias: [{ t: '', texto: 'Algo de antes' }] } }, fichero: null, guardar() {} };
process.env.BOT_IA = 'claude';
const t1 = { tipo: 'noticias', clave: 'n1', texto: '✅ plantilla\n\n✅ Disponible para la jornada 12 contra el Atlético', numeros: [12], hechos };
const respuestas = ['El Atleti va 2º y recibe al equipo. Eric vuelve.', bueno];
let preguntas = [];
const pedirF = async (op) => { preguntas.push(op); return { ok: true, datos: { texto: respuestas.shift(), cronicas: [] }, modelo: SONNET }; };
let hechosN = await redactar([t1], { tipo: 'noticias', registro: reg2, config: { ...config, redactar: { ...config.redactar, activo: true } }, jugadores, equipos, log: () => {}, pedir: pedirF });
ok(hechosN === 1 && t1.texto.startsWith('✅ El Barça recupera') && t1.texto.endsWith(hechos.etiqueta), 'el primero no vale, se pregunta otra vez y sale el bueno con la etiqueta debajo');
ok(preguntas.length === 2 && /no vale/.test(preguntas[1].prompt) && /vaga/.test(preguntas[1].prompt), 'la segunda pregunta lleva los errores de la primera');
ok(/Algo de antes/.test(preguntas[0].prompt) && !/"fecha"/.test(preguntas[0].prompt) && preguntas[0].uso === 'redactar', 'la pregunta lleva los recientes y no la fecha cruda');
ok(t1.plantilla.startsWith('✅ plantilla') && t1.redactado === SONNET, 'la plantilla queda guardada');
const t2 = { tipo: 'noticias', clave: 'n2', texto: '✅ plantilla dos', numeros: [12], hechos };
hechosN = await redactar([t2], { tipo: 'noticias', registro: reg2, config: { ...config, redactar: { ...config.redactar, activo: true } }, jugadores, equipos, log: () => {},
  pedir: async () => ({ ok: true, datos: { texto: 'Eric sigue de baja.' }, modelo: SONNET }) });
ok(hechosN === 0 && t2.texto === '✅ plantilla dos' && !t2.redactado, 'si las dos versiones fallan, sale la plantilla');
// la prensa es un adorno: si la redacción de ese tuit ya ha fallado, se prueba sin ella (`sinPrensaTrasFallos`)
let pedidasPrensa = 0;
const prensaEspia = () => { pedidasPrensa++; return cron; };
const cfgPrensa = { ...config, redactar: { ...config.redactar, activo: true, sinPrensaTrasFallos: 1 } };
const salePrensa = async (clave, fallosPrevios) => {
  const regP = { datos: { enviados: [], fallosRedaccion: fallosPrevios ? { [clave]: { n: fallosPrevios } } : {} }, fichero: null, guardar() {} };
  pedidasPrensa = 0;
  await redactar([{ tipo: 'noticias', clave, texto: '✅ plantilla', numeros: [12], hechos }], { tipo: 'noticias', registro: regP, config: cfgPrensa, jugadores, equipos, log: () => {}, cronicasDe: prensaEspia,
    pedir: async () => ({ ok: true, datos: { texto: 'Eric sigue de baja.' }, modelo: SONNET }) });
  return pedidasPrensa;
};
ok(await salePrensa('p1', 0) === 1, 'sin fallos previos, el tuit se redacta con la prensa');
ok(await salePrensa('p2', 1) === 0, 'con un fallo previo, se redacta sin pedir la prensa');
hechosN = await redactar([{ ...t2 }], { tipo: 'noticias', registro: reg2, config, jugadores, equipos, log: () => {}, pedir: pedirF });
ok(hechosN === 0, 'con redactar.activo a false no hace nada');
hechosN = await redactar([{ ...t2 }], { tipo: 'mercado', registro: reg2, config: { ...config, redactar: { ...config.redactar, activo: true } }, jugadores, equipos, log: () => {}, pedir: pedirF });
ok(hechosN === 0, 'el mercado no se redacta');
apuntarReciente(reg2, 'noticias', t1.texto);
ok(recientesDe(reg2, 'noticias').slice(-1)[0] === bueno, 'al publicar, el cuerpo queda entre los recientes del tipo (sin la etiqueta)');
for (let i = 0; i < 7; i++) apuntarReciente(reg2, 'noticias', `t${i}`);
ok(reg2.datos.recientes.noticias.length === 5, 'solo se guardan los 5 últimos');

// --- crónicas ---
const ahora = Date.parse('2026-11-08T22:30:00Z');
const noticias = [
  { medio: 'MARCA', titulo: 'El Osasuna remonta al Alavés con un gol de Budimir', entradilla: 'Crónica del partido', t: ahora - 600e3 },
  { medio: 'AS', titulo: 'Budimir, héroe en El Sadar', entradilla: 'El delantero del Osasuna marca el gol de la victoria', t: ahora - 300e3 },
  { medio: 'SPORT', titulo: 'El Barça prepara el partido del Atlético', entradilla: 'Flick tiene dudas', t: ahora - 300e3 },
  { medio: 'AS', titulo: 'El Osasuna y el Alavés, en la previa', entradilla: 'de hace dos días', t: ahora - 50 * 3600e3 },
];
const cs = elegir(noticias, { partido: { local: 'Osasuna', visitante: 'Alavés', fecha: new Date(ahora - 2.5 * 3600e3).toISOString() }, tipo: 'final', ahora });
ok(cs.length === 2 && cs[0].medio === 'MARCA' && !cs.some((c) => c.medio === 'SPORT'), `crónicas del partido: las de los dos clubes primero y nada de otros partidos ni de antes (${cs.map((c) => c.medio).join(', ')})`);

// --- rigor con lo que pasa en el partido (6 nov, final del Sevilla-Alavés: «Cuenta COPE que Sivera ha parado un penalti») ---
// keyEvents reales del summary de ESPN de ese partido (recortados) y dos inventados (un penalti fallado y una roja)
const ke = (tipo, min, equipoId, equipo, jugador, texto) => ({ type: { text: tipo }, text: texto, clock: { displayValue: min }, team: { id: String(equipoId), displayName: equipo }, participants: [{ athlete: { displayName: jugador } }] });
const sumario = { keyEvents: [
  { type: { text: 'Yellow Card' }, clock: { displayValue: "30'" }, team: { id: '96' }, participants: [{ athlete: { displayName: 'Pablo Ibáñez' } }] },
  ke('Penalty - Saved', "32'", 243, 'Sevilla', 'Rubén Vargas', 'Penalty saved. Rubén Vargas (Sevilla) right footed shot saved in the bottom left corner by Antonio Sivera (Alaves).'),
  ke('Penalty - Missed', "45+2'", 96, 'Alavés', 'Kike García', 'Penalty missed! Kike García (Alaves) hits the bar.'),
  ke('Red Card', "80'", 243, 'Sevilla', 'Kike Salas', 'Kike Salas (Sevilla) is shown the red card.'),
  ke('Penalty - Scored', "60'", 243, 'Sevilla', 'Isaac Romero', 'Goal! Isaac Romero scores from the penalty spot.'),
  { type: { text: 'Substitution' }, clock: { displayValue: "59'" }, team: { id: '243' } },
] };
const inc = incidenciasDe(sumario, { casaId: 243, fueraId: 96, L: 'Sevilla', V: 'Alavés' });
ok(inc.length === 3, `sucesos del summary: penalti parado, penalti fallado y roja; ni tarjetas, ni cambios ni el penalti marcado (${inc.length})`);
ok(inc[0].suceso === 'penalti parado' && inc[0].minuto === "32'" && inc[0].lanzador === 'Rubén Vargas' && inc[0].equipoQueLoLanza === 'Sevilla'
  && inc[0].porteroQueLoPara === 'Antonio Sivera' && inc[0].equipoDelPortero === 'Alavés', `el penalti parado del Sevilla-Alavés: lanza Vargas, lo para Sivera, minuto 32 (${JSON.stringify(inc[0])})`);
ok(inc[1].suceso === 'penalti fallado' && inc[1].equipoQueLoLanza === 'Alavés' && !('porteroQueLoPara' in inc[1]), 'un penalti fallado no inventa portero');
ok(inc[2].suceso === 'roja' && inc[2].equipo === 'Sevilla' && inc[2].jugador === 'Kike Salas', 'la roja con su equipo y su jugador');
ok(incidenciasDe(null, { casaId: 1, fueraId: 2 }).length === 0 && incidenciasDe({}, { casaId: 1, fueraId: 2 }).length === 0, 'sin summary, sin sucesos (y sin romper)');
const casarF = (n, lado) => (/Sivera/.test(n) && lado === 'visitante' ? { nickname: 'Sivera' } : null);
ok(incidenciasDe(sumario, { casaId: 243, fueraId: 96, L: 'Sevilla', V: 'Alavés', casar: casarF })[0].porteroQueLoPara === 'Sivera', 'el portero sale con su nombre de LaLiga si se casa (el del otro equipo)');

const hFinal = { tipo: 'final', partido: { partido: 'Sevilla-Alavés', local: 'Sevilla', visitante: 'Alavés', marcador: '0-0' }, goles: [], incidencias: inc.slice(0, 1).map((x) => ({ ...x, porteroQueLoPara: 'Sivera', lanzador: 'Rubén Vargas' })),
  jugadores: [{ nombre: 'Sivera', puesto: 'portero', club: 'Alavés', puntosHoy: 9, principal: true }], clubes: clubes('Sevilla', 'Alavés'), etiqueta: '' };
const rf = (t, h = hFinal) => revisar(t, { hechos: h, todos, numeros: [] });
const cuenta = 'Cuenta COPE que Sivera ha parado un penalti. El Alavés empató sin goles en el Sevilla.';
ok(rf(cuenta).some((x) => /no se atribuye nada a un medio/.test(x)), `«Cuenta COPE que Sivera ha parado un penalti» en un final: fuera (${rf(cuenta).slice(0, 2).join('; ')})`);
ok(rf('Según MARCA, Sivera ha parado un penalti.').some((x) => /no se atribuye/.test(x)), '«según MARCA» en un final, fuera');
ok(rf('Informa que Sivera ha parado un penalti en el Sevilla.').length >= 0 && rf('Cuentan que Sivera paró un penalti.').some((x) => /no se atribuye/.test(x)), '«cuentan que» sin medio, también fuera');
const buenoF = '🏁 Sevilla y Alavés empatan sin goles, con un penalti parado: Sivera detuvo en el minuto 32 el que lanzó Rubén Vargas.';
ok(rf(buenoF).filter((x) => /atribuye|sucesos/.test(x)).length === 0, `el penalti parado, como hecho y con los datos de ESPN: vale (${rf(buenoF).join('; ')})`);
const sinInc = { ...hFinal, incidencias: [] };
ok(rf(buenoF, sinInc).some((x) => /sucesos que no están en los hechos \(penalti, una parada\)/.test(x)), 'el mismo texto sin el suceso en los hechos: fuera, sea de quien sea');
ok(sucesosSinHechos('Lo expulsaron y el VAR anuló un gol de penalti', sinInc).join() === 'penalti,una expulsión,el VAR', 'expulsión, VAR y penalti sin hechos, los tres sucesos');
ok(sucesosSinHechos('Sivera hizo tres paradas', sinInc).join() === 'una parada', 'unas paradas que no vienen en los hechos tampoco valen');
ok(sucesosSinHechos('Sevilla y Alavés empatan sin goles', sinInc).length === 0 && sucesosSinHechos('Gana de penalti', { ...sinInc, goles: [{ goleador: 'X', penalti: true }] }).length === 0, 'un gol de penalti en `goles` sí permite hablar del penalti');
const hMvp = { ...hFinal, tipo: 'mvp' };
ok(revisar('⭐ Según AS, Sivera es el mejor del partido con 9 puntos.', { hechos: hMvp, todos, numeros: [] }).some((x) => /no se atribuye/.test(x)), 'en un MVP tampoco se atribuye a un medio');
// en noticias y previas el medio sí es la fuente: nada cambia
ok(rv(bueno).length === 0 && rv('Eric vuelve, según AS y MARCA.').filter((x) => /atribuye|sucesos/.test(x)).length === 0, 'en una noticia, «según AS» sigue valiendo');
// la guía y la prensa
ok(!EJEMPLOS.some((x) => x.bien && (x.tipo === 'final' || x.tipo === 'mvp') && /\b(cuenta|cuentan|según|informa)\s+(MARCA|AS|COPE|SPORT|SER)\b/i.test(x.texto)), 'ningún ejemplo BIEN de final o MVP atribuye nada a un medio (en noticias y previas sí vale)');
ok(EJEMPLOS.some((x) => !x.bien && /Cuenta COPE/.test(x.texto)), 'la guía trae el «Cuenta COPE» como ejemplo MAL');
ok(JSON.stringify(config.redactar.prensa) === '["previa"]', 'la prensa solo va a la previa (en un final o un MVP lo que pasa en el campo sale de ESPN)');

// --- el revisor (lib/revisor.mjs): segunda lectura con IA, con los hechos al lado ---
{
  const { revisarConIA, SISTEMA } = await import('../lib/revisor.mjs');
  const { pulir } = await import('../lib/pulir.mjs');
  const cfgR = { ...config, redactar: { ...config.redactar, activo: true } };
  // 1. el revisor tira la primera versión; la segunda pregunta lleva sus motivos y sale la segunda
  const textos = ['✅ El Barça recupera a Eric para el domingo, según AS y MARCA. Es de los defensas que mejor han rentado esta jornada.', bueno];
  const preg = [];
  const pedirR = async (op) => { preg.push(op); return { ok: true, datos: { texto: textos.shift(), cronicas: [] }, modelo: SONNET }; };
  let lecturas = 0;
  const revisorF = async ({ texto }) => { lecturas++; return /mejor han rentado/.test(texto) ? { ok: false, problemas: ['«Es de los defensas que mejor han rentado esta jornada»: los hechos no traen nada de la jornada'], revisado: true, modelo: SONNET } : { ok: true, problemas: [], revisado: true, modelo: SONNET }; };
  const ta = { tipo: 'noticias', clave: 'rv1', texto: '✅ plantilla', numeros: [12], hechos };
  const n1 = await redactar([ta], { tipo: 'noticias', registro: { datos: {}, fichero: null }, config: cfgR, jugadores, equipos, log: () => {}, pedir: pedirR, revisor: revisorF });
  ok(n1 === 1 && ta.texto.startsWith(bueno.split('\n')[0]) && ta.revisado === SONNET && lecturas === 2, 'revisor: tira la versión con una comparación sin base y sale la segunda, revisada');
  ok(preg.length === 2 && /editor/.test(preg[1].prompt) && /mejor han rentado/.test(preg[1].prompt), 'revisor: la segunda pregunta lleva lo que dijo el editor');
  // 2. si el revisor tira las tres, sale la plantilla
  const tb = { tipo: 'noticias', clave: 'rv2', texto: '✅ plantilla tres', numeros: [12], hechos };
  const n2 = await redactar([tb], { tipo: 'noticias', registro: { datos: {}, fichero: null }, config: cfgR, jugadores, equipos, log: () => {},
    pedir: async () => ({ ok: true, datos: { texto: bueno }, modelo: SONNET }), revisor: async () => ({ ok: false, problemas: ['«x»: no se entiende'], revisado: true }) });
  ok(n2 === 0 && tb.texto === '✅ plantilla tres', 'revisor: si no publicaría ninguna de las tres, sale la plantilla');
  // 3. revisor caído: el tuit sigue (ya pasó el validador de código)
  const tc = { tipo: 'noticias', clave: 'rv3', texto: '✅ plantilla', numeros: [12], hechos };
  const n3 = await redactar([tc], { tipo: 'noticias', registro: { datos: {}, fichero: null }, config: cfgR, jugadores, equipos, log: () => {},
    pedir: async () => ({ ok: true, datos: { texto: bueno }, modelo: SONNET }), revisor: async () => ({ ok: true, problemas: [], revisado: false }) });
  ok(n3 === 1 && !tc.revisado, 'revisor caído: sale redactado, sin la marca de revisado');
  // 4. revisarConIA: lo que contesta la IA
  const contesta = (datos) => async (op) => ({ ok: true, datos, modelo: SONNET, op });
  let rr = await revisarConIA({ texto: 'x', hechos, config, pedir: contesta({ publicable: true, problemas: [] }) });
  ok(rr.ok && rr.revisado, 'revisarConIA: publicable sin problemas, vale');
  rr = await revisarConIA({ texto: 'x', hechos, config, pedir: contesta({ publicable: true, problemas: [{ frase: 'Es de los que sostienen una plantilla', motivo: 'relleno' }] }) });
  ok(rr.ok, 'revisarConIA: manda «publicable» (lo que apunte de más no bloquea)');
  rr = await revisarConIA({ texto: 'x', hechos, config, pedir: contesta({ publicable: false, problemas: [{ frase: 'Es de los que sostienen una plantilla', motivo: 'relleno' }] }) });
  ok(!rr.ok && /sostienen/.test(rr.problemas[0]), 'revisarConIA: no publicable, con su motivo');
  rr = await revisarConIA({ texto: 'x', hechos, config, pedir: contesta({ publicable: false, problemas: [] }) });
  ok(!rr.ok && rr.problemas.length === 1, 'revisarConIA: no publicable sin motivo, con un motivo genérico para reescribir');
  rr = await revisarConIA({ texto: 'x', hechos, config, pedir: async () => ({ ok: false, error: '529' }) });
  ok(rr.ok && !rr.revisado, 'revisarConIA: si no contesta, no bloquea');
  rr = await revisarConIA({ texto: 'x', hechos, config: { ...config, revisor: { activo: false } }, pedir: contesta({ publicable: false, problemas: [] }) });
  ok(rr.ok && !rr.revisado, 'revisarConIA: con revisor.activo a false no pregunta');
  let vistoR = null;
  await revisarConIA({ texto: 'el tuit', hechos, config, pedir: async (op) => { vistoR = op; return { ok: true, datos: { publicable: true, problemas: [] } }; } });
  ok(vistoR.uso === 'revisar' && /el tuit/.test(vistoR.prompt) && /Eric vuelve/.test(vistoR.prompt) && !/"fecha"/.test(vistoR.prompt) && vistoR.sistema === SISTEMA, 'revisarConIA: pregunta con uso «revisar», el tuit y los hechos sin la fecha cruda');
  ok(/resto de la jornada/.test(SISTEMA) && /16º clasificado/.test(SISTEMA), 'el revisor trae los fallos del 6 nov (comparación con la jornada, «16º clasificado»)');
  // 5. pulir: si el revisor no publicaría el pulido, se queda la plantilla
  const pl = '🚨 Budimir, baja para la jornada 12: lesión muscular.\n\n❌ Baja para la jornada 12';
  const tp = { tipo: 'caidas', clave: 'p1', texto: pl, numeros: [12] };
  const nP = await pulir([tp], { tipo: 'caidas', registro: { datos: {}, fichero: null }, config, jugadores, equipos, forzar: true, clave: 'x', log: () => {},
    pedirIA: async () => ({ ok: true, proveedor: 'claude', modelo: SONNET, datos: { tweets: [{ i: 0, texto: '🚨 Budimir se cae para la jornada 12: lesión muscular.\n\n❌ Baja para la jornada 12' }] } }),
    revisor: async () => ({ ok: false, problemas: ['«x»: no se entiende'], revisado: true }) });
  ok(nP === 0 && tp.texto === pl, 'pulir: si el revisor no lo publicaría, se queda la plantilla');
  const tq = { tipo: 'caidas', clave: 'p2', texto: pl, numeros: [12] };
  const nQ = await pulir([tq], { tipo: 'caidas', registro: { datos: {}, fichero: null }, config, jugadores, equipos, forzar: true, clave: 'x', log: () => {},
    pedirIA: async () => ({ ok: true, proveedor: 'claude', modelo: SONNET, datos: { tweets: [{ i: 0, texto: '🚨 Budimir se cae para la jornada 12: lesión muscular.\n\n❌ Baja para la jornada 12' }] } }),
    revisor: async () => ({ ok: true, problemas: [], revisado: true, modelo: SONNET }) });
  ok(nQ === 1 && tq.revisado === SONNET, 'pulir: con el visto bueno del revisor, sale pulido y revisado');
}
// la guía trae lo del 7 nov
{
  const { GUIA } = await import('../lib/voz.mjs');
  ok(/SOLO LO QUE SABES/.test(GUIA) && /DELATA A UNA IA/.test(GUIA), 'la guía trae «solo lo que sabes» y «lo que delata a una IA»');
  ok(EJEMPLOS.some((x) => !x.bien && /rentado esta jornada/.test(x.texto)), 'la guía trae como MAL la comparación con la jornada');
}

// la previa: primera frase corta y «en el aire» una sola vez (7 nov)
{
  const hp = { tipo: 'previa', jugadores: [{ nombre: 'Budimir', club: 'Osasuna', papel: 'fijo', estado: 'fijo' }], equipos: [{ club: 'Osasuna', va: '12º de 20' }, { club: 'Athletic', va: '5º de 20' }], clubes: clubes('Osasuna', 'Athletic') };
  const largo = 'El Osasuna recibe hoy a las seis y media en El Sadar al Athletic, que llega quinto, con un cruce que a sus delanteros y medios les viene mal porque el Osasuna encaja poco en casa. Budimir es fijo.';
  const corto = 'El Osasuna recibe hoy al Athletic y a los delanteros rojillos les toca un cruce cómodo. Budimir es fijo.';
  ok(revisar(largo, { hechos: hp, todos }).some((x) => /primera frase/.test(x)), 'previa: una primera frase de más de 30 palabras, fuera');
  ok(!revisar(corto, { hechos: hp, todos }).some((x) => /primera frase/.test(x)), 'previa: una primera frase corta, vale');
  ok(revisar('El Osasuna recibe hoy al Athletic. Budimir está en el aire y Herrera también está en el aire.', { hechos: hp, todos }).some((x) => /en el aire/.test(x)), 'previa: «en el aire» dos veces, fuera');
  ok(!revisar('El Osasuna recibe hoy al Athletic. Budimir está en el aire y Herrera no tiene el puesto asegurado.', { hechos: hp, todos }).some((x) => /en el aire/.test(x)), 'previa: «en el aire» una vez, vale');
  ok(revisar('La gran duda del Osasuna-Athletic está en Budimir. Es fijo.', { hechos: hp, todos }).some((x) => /fórmula de plantilla/.test(x)), 'previa: abrir con «La gran duda del X-Y», fuera');
  ok(revisar('El Osasuna recibe hoy a las seis y media en El Sadar al Athletic, que llega quinto, con un cruce que a los delanteros y medios de casa les viene bastante mal y por eso el Osasuna lo tiene más difícil: Budimir es fijo.', { hechos: hp, todos }).some((x) => /primera frase/.test(x)), 'previa: los dos puntos no cortan la primera frase');
  ok(!revisar(largo, { hechos: { ...hp, tipo: 'caidas' }, todos }).some((x) => /primera frase/.test(x)), 'solo la previa tiene tope de primera frase');
}

process.env = viejo;
console.log(`\n${fallos ? `${fallos} FALLOS` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
