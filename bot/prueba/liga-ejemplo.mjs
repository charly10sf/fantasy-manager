// Prueba de las noticias de la competición sin red: RSS y Gemini falsos.
//   node bot/prueba/liga-ejemplo.mjs
// Casos: con un solo medio espera; con dos sale «se estudia» con tono sobrio (luto); al confirmarse sale la decisión y lo que se
// estudiaba no se repite; lo de Segunda sola no cuenta; un aplazamiento de un partido con sus dos clubes; lo que no habla de
// suspensiones ni horarios no se pregunta a Gemini; el horario con «del».
import { generar, clubesDe, objeto, TEMA, redactar } from '../tipos/liga.mjs';
import { validar } from '../lib/validar.mjs';
import { Registro } from '../lib/registro.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const ok = (c, m) => { if (!c) falla(m); };
const ver = (titulo, ts) => {
  console.log(`\n=== ${titulo}`);
  for (const t of ts) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) falla(`${t.clave}: ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}\n${t.texto}`); }
};

const equipos = { 1: 'Sevilla FC', 2: 'Deportivo Alavés', 3: 'FC Barcelona', 4: 'Real Sociedad', 5: 'CA Osasuna', 6: 'Athletic Club' };
ok(JSON.stringify(clubesDe(['Sevilla', 'Alavés'], equipos)) === '["1","2"]', `clubesDe: ${clubesDe(['Sevilla', 'Alavés'], equipos)}`);
ok(JSON.stringify(clubesDe(['Barcelona'], equipos)) === '["3"]', `clubesDe Barcelona: ${clubesDe(['Barcelona'], equipos)}`);
ok(objeto({ clubes: [], jornada: 12, segunda: true }, equipos).texto === 'la jornada 12 de Primera y Segunda', 'objeto jornada');
ok(objeto({ clubes: ['4'], jornada: 0 }, equipos).texto === 'el partido de la Real Sociedad', `objeto un club: ${objeto({ clubes: ['4'], jornada: 0 }, equipos).texto}`);
ok(objeto({ clubes: ['1', '2'], jornada: 0 }, equipos).texto === 'el Sevilla-Alavés', `objeto partido: ${objeto({ clubes: ['1', '2'], jornada: 0 }, equipos).texto}`);
ok(TEMA.test('LaLiga estudia suspender la jornada') && TEMA.test('El Sevilla-Alavés se aplaza') && !TEMA.test('Lamine Yamal vuelve a entrenar'), 'TEMA');

const ahora = Date.parse('2026-11-04T12:00:00Z');
let nid = 0;
const n = (medio, titulo, entradilla, hace = 1) => ({ medio, titulo, entradilla, url: `https://medio.example/${++nid}`, guid: `${medio}|https://medio.example/${nid}`, t: ahora - hace * 36e5 });
// lo que contesta el Gemini falso, por titular
const R = {
  'LaLiga estudia suspender la jornada': { tipo: 'suspension', estado: 'se_estudia', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial: false,
    contexto: 'Tras el fallecimiento de Jesús de Miguel', detalle: 'La decisión se tomará en las próximas horas' },
  'Se plantea parar el fútbol este fin de semana': { tipo: 'suspension', estado: 'se_estudia', primera: true, segunda: true, jornada: 0, equipos: [], luto: true, oficial: false,
    contexto: 'Tras la muerte de Jesús de Miguel', detalle: '' },
  'Comunicado: suspendida la jornada': { tipo: 'suspension', estado: 'confirmado', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial: true,
    contexto: 'Tras el fallecimiento de Jesús de Miguel', detalle: 'LaLiga fijará las nuevas fechas más adelante' },
  'Aplazado el partido de Segunda': { tipo: 'aplazamiento', estado: 'confirmado', primera: false, segunda: true, jornada: 0, equipos: [], luto: false, oficial: true, contexto: '', detalle: '' },
  'El Sevilla-Alavés se aplaza por el temporal': { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 0, equipos: ['Sevilla', 'Alavés'], luto: false, oficial: false,
    contexto: 'El temporal obliga a mover el partido', detalle: '' },
  'Aplazado el Sevilla-Alavés': { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 0, equipos: ['Sevilla FC', 'Alavés'], luto: false, oficial: false,
    contexto: 'Se aplaza el partido por el fuerte temporal de lluvia', detalle: '' },
};
let preguntas = 0, leidas = [];
const pedirIA = async ({ prompt }) => {
  preguntas++;
  const tit = [...prompt.matchAll(/^\[(\d+)\] (.*)$/gm)].map((m) => [Number(m[1]), m[2]]);
  leidas.push(...tit.map((x) => x[1]));
  return { ok: true, modelo: 'falso', datos: { noticias: tit.map(([i, t]) => ({ i, ...(R[t] || { tipo: 'nada', estado: 'confirmado', primera: false, segunda: false, jornada: 0, equipos: [], luto: false, oficial: false, contexto: '', detalle: '' }) })) } };
};
const config = { topes: { liga: 6 }, topeDiario: 40, maxPorEjecucion: 6, ligaPorEjecucion: 2, ligaGeminiDia: 20 };
const reg = new Registro(config);
const base = { equipos, jornada: 12, config, registro: reg, ventanas: false, ahora, log: () => {}, pedirIA, clave: 'falsa' };
const publicar = (ts) => { for (const t of ts) if (reg.decidir(t) === 'ok') reg.marcar(t, 'x'); };

// 1) un solo medio: espera; lo que no habla de suspensiones no se pregunta
let prensa = [n('MARCA', 'LaLiga estudia suspender la jornada', 'Tras la muerte de Jesús de Miguel, LaLiga y la RFEF valoran no disputar la jornada 12 de Primera y Segunda'),
  n('AS', 'Lamine Yamal vuelve a entrenar', 'El extremo ya trabaja con el grupo')];
let ts = await generar({ ...base, leer: async () => prensa });
ver('un solo medio', ts);
ok(ts.length === 0, 'con un solo medio no sale');
ok(!leidas.includes('Lamine Yamal vuelve a entrenar'), 'lo que no es de la competición no va a Gemini');

// 2) segundo medio: sale «se estudia», sobrio (luto): sin 🚨 ni la línea de fantasy
prensa = [...prensa, n('AS', 'Se plantea parar el fútbol este fin de semana', 'La muerte de Jesús de Miguel puede dejar sin fútbol a Primera y Segunda')];
ts = await generar({ ...base, leer: async () => prensa });
ver('dos medios, se estudia', ts);
ok(ts.length === 1 && /Se estudia suspender la jornada 12 de Primera y Segunda/.test(ts[0].texto), 'sale «se estudia» de la jornada 12');
ok(ts[0] && ts[0].texto.startsWith('📢') && !/🚨|Fantasy|Pendientes/.test(ts[0].texto), 'tono sobrio con luto');
ok(ts[0] && /Lo cuentan MARCA y AS|Lo cuentan AS y MARCA/.test(ts[0].texto), 'fuente con los dos medios');
publicar(ts);
ok(!JSON.stringify(reg.datos.liga).includes('LaLiga estudia'), 'en el registro no se guardan titulares');

// 3) confirmación oficial: sale la decisión y no se repite lo que se estudiaba; Segunda sola no cuenta; el aplazamiento de un partido
prensa = [...prensa, n('Europa Press', 'Comunicado: suspendida la jornada', 'LaLiga ha anunciado en un comunicado que la jornada 12 no se disputará'),
  n('COPE', 'Aplazado el partido de Segunda', 'Comunicado oficial del club'),
  n('MARCA', 'El Sevilla-Alavés se aplaza por el temporal', 'La lluvia obliga a mover el partido'),
  n('Diario de Sevilla', 'Aplazado el Sevilla-Alavés', 'El fuerte temporal de lluvia obliga a aplazar el encuentro')];
ts = await generar({ ...base, leer: async () => prensa });
ver('confirmaciones', ts);
ok(ts.some((t) => /^📢 Se suspende la jornada 12 de Primera y Segunda/.test(t.texto) && /Es oficial/.test(t.texto)), 'sale la suspensión oficial');
ok(ts.some((t) => /🚨 Se aplaza el Sevilla-Alavés/.test(t.texto) && /Atentos a cómo lo aplica LaLiga Fantasy/.test(t.texto)), 'sale el aplazamiento del partido');
ok(!ts.some((t) => /Segunda/.test(t.texto) && !/Primera/.test(t.texto)), 'lo de Segunda sola no sale');
publicar(ts);
ts = await generar({ ...base, leer: async () => prensa });
ok(ts.length === 0, `nada repetido después: ${ts.map((t) => t.clave)}`);

// 4) horario: «del», no «de el»
const t4 = redactar({ tipo: 'horario', estado: 'confirmado', obj: 'el Barça-Osasuna', luto: false, contexto: '', detalle: '', medios: ['MARCA', 'AS'], oficial: false });
ok(t4.startsWith('🕐 Cambia el horario del Barça-Osasuna'), `horario: ${t4}`);
console.log(`\n--- horario\n${t4}`);
ok(preguntas <= 3, `preguntas a Gemini: ${preguntas}`);
console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
