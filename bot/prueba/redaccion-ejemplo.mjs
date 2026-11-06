// Pruebas sin red de la redacción desde los hechos: lib/claude.mjs (API falsa), lib/ia.mjs (quién contesta, topes y gasto),
// lib/redaccion.mjs (el validador y el bucle de redactar), lib/cronicas.mjs (qué prensa es de un partido) y los apodos sin «conjunto».
import { preguntarJson, esquemaJson, coste, SONNET, HAIKU } from '../lib/claude.mjs';
import { preguntar, sinCupo, cuentaHoy } from '../lib/ia.mjs';
import { revisar, redactar, parecido, cuerpoDe, apuntarReciente, recientesDe } from '../lib/redaccion.mjs';
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

Pero el Atleti, 2º y de los que más marcan, no es el mejor partido para un defensa, y Fantasy Manager solo le da un 37 %. Si lo tienes, mejor esperar a los onces.`;
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

process.env = viejo;
console.log(`\n${fallos ? `${fallos} FALLOS` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
