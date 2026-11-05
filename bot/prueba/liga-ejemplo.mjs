// Prueba de las noticias de la competición sin red: RSS y Gemini falsos.
//   node bot/prueba/liga-ejemplo.mjs
// Casos: con un solo medio espera; con dos sale «se estudia» con tono sobrio (luto); al confirmarse sale la decisión y lo que se
// estudiaba no se repite; lo de Segunda sola no cuenta; un aplazamiento de un partido con sus dos clubes; lo que no habla de
// suspensiones ni horarios no se pregunta a Gemini; el horario con «del».
import { generar, clubesDe, objeto, TEMA, DECISIVA, hechoSeJuega, redactar, numeroDe } from '../tipos/liga.mjs';
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
  const tit = [...prompt.matchAll(/^\[(\d+)\](?: \([\d-]+\))? (.*)$/gm)].map((m) => [Number(m[1]), m[2]]);
  leidas.push(...tit.map((x) => x[1]));
  return { ok: true, modelo: 'falso', datos: { noticias: tit.map(([i, t]) => ({ i, ...(R[t] || { tipo: 'nada', estado: 'confirmado', primera: false, segunda: false, jornada: 0, equipos: [], luto: false, oficial: false, contexto: '', detalle: '' }) })) } };
};
// (ligaJuntar 1: estas pruebas preguntan en cuanto hay algo; lo de juntar noticias se prueba en el 9)
const config = { topes: { liga: 6 }, topeDiario: 40, maxPorEjecucion: 6, ligaPorEjecucion: 2, ligaGeminiDia: 20, ligaJuntar: 1 };
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
ok(ts[0] && /Lo cuentan (MARCA y AS|AS y MARCA)/.test(ts[0].texto), "fuente con los dos medios");
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
// (con la jornada entera suspendida, el aplazamiento de un partido no se repite: ya lo dice la jornada)
ok(!ts.some((t) => /Se aplaza el Sevilla-Alavés/.test(t.texto)), 'con la jornada suspendida, el partido no sale aparte');
{
  const r3 = new Registro(config);
  const t3 = await generar({ ...base, registro: r3, leer: async () => [n('MARCA', 'El Sevilla-Alavés se aplaza por el temporal', 'La lluvia obliga a mover el partido'),
    n('Diario de Sevilla', 'Aplazado el Sevilla-Alavés', 'El fuerte temporal de lluvia obliga a aplazar el encuentro')] });
  ok(t3.some((t) => /🚨 Se aplaza el Sevilla-Alavés/.test(t.texto) && /Atentos a cómo lo aplica LaLiga Fantasy/.test(t.texto)), 'sale el aplazamiento del partido (solo)');
}
ok(!ts.some((t) => /Segunda/.test(t.texto) && !/Primera/.test(t.texto)), 'lo de Segunda sola no sale');
publicar(ts);
ts = await generar({ ...base, leer: async () => prensa });
ok(ts.length === 0, `nada repetido después: ${ts.map((t) => t.clave)}`);

// 4) horario: «del», no «de el»
const t4 = redactar({ tipo: 'horario', estado: 'confirmado', obj: 'el Barça-Osasuna', luto: false, contexto: '', detalle: '', medios: ['MARCA', 'AS'], oficial: false });
ok(t4.startsWith('🕐 Cambia el horario del Barça-Osasuna'), `horario: ${t4}`);
console.log(`\n--- horario\n${t4}`);
ok(preguntas <= 4, `preguntas a Gemini: ${preguntas}`);
// 5) un partido de Segunda que Gemini marca como de Primera, y un aplazamiento sin clubes ni jornada: ninguno es «la jornada»
R['Aplazado el Granada-Tenerife'] = { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: true, jornada: 0, equipos: ['Granada', 'Tenerife'], luto: true, oficial: false, contexto: '', detalle: '' };
R['Tras el aplazamiento del partido'] = { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 0, equipos: [], luto: true, oficial: false, contexto: '', detalle: '' };
const reg5 = new Registro(config);
const p5 = [n('SPORT', 'Aplazado el Granada-Tenerife', 'Por el fallecimiento de Jesús de Miguel'), n('AS', 'Aplazado el Granada-Tenerife', 'Por el fallecimiento'),
  n('SPORT', 'Tras el aplazamiento del partido', 'El club informa del aplazamiento'), n('MARCA', 'Tras el aplazamiento del partido', 'Aplazado el encuentro')];
const t5 = await generar({ ...base, registro: reg5, leer: async () => p5 });
ok(t5.length === 0, `Segunda o sin clubes ni jornada: no sale «la jornada» (${t5.map((t) => t.texto).join(' | ')})`);
// 6) suspensiones de la jornada entera dichas sin «jornada»: valen; un partido de Segunda con «fin de semana» y sin clubes: no
const sus = { tipo: 'suspension', estado: 'confirmado', primera: true, segunda: true, jornada: 0, equipos: [], luto: true, oficial: false, contexto: '', detalle: '' };
for (const [tit, ent, bien] of [['Suspendidos los partidos de Primera y Segunda', 'LaLiga aplaza los encuentros previstos del viernes al lunes', true],
  ['Oficial: LaLiga suspende la J12', 'Comunicado', true], ['Se suspende el fútbol en España', 'Por el luto', true],
  ['El Tenerife no jugará este fin de semana', 'Aplazado su partido ante el Granada', false]]) {
  R[tit] = sus;
  const r6 = new Registro(config);
  const t6 = await generar({ ...base, registro: r6, leer: async () => [n('SPORT', tit, ent), n('AS', tit, ent)] });
  ok(bien ? t6.length === 1 : t6.length === 0, `«${tit}»: ${bien ? 'sale' : 'no sale'} (${t6.map((t) => t.texto).join(' | ')})`);
}
// 7) «Deportivo» es el Dépor, no el Deportivo Alavés
const eq7 = { 21: 'Deportivo Alavés', 26: 'RC Deportivo', 8: 'RCD Espanyol' };
ok(JSON.stringify(clubesDe(['Deportivo', 'Espanyol'], eq7)) === '["26","8"]', `Deportivo: ${clubesDe(['Deportivo', 'Espanyol'], eq7)}`);
ok(JSON.stringify(clubesDe(['Alavés'], eq7)) === '["21"]', 'Alavés');
// 9) «la jornada se jugará» tapa «el Valencia-Real Madrid se jugará»; los descartados que no dicen suspender llegan a Gemini
R['LaLiga mantiene la jornada'] = { tipo: 'suspension', estado: 'descartado', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial: false, contexto: '', detalle: '' };
R['El Valencia prepara el partido'] = { tipo: 'suspension', estado: 'descartado', primera: true, segunda: false, jornada: 0, equipos: ['Sevilla', 'Alavés'], luto: false, oficial: false, contexto: '', detalle: '' };
ok(TEMA.test('Habrá fútbol este fin de semana') && TEMA.test('LaLiga mantiene la jornada pese a la petición de la AFE'), 'TEMA: los descartados');
{
  const r9 = new Registro(config);
  const t9 = await generar({ ...base, config: { ...config, ligaPorEjecucion: 3 }, registro: r9, leer: async () => [n('MARCA', 'LaLiga mantiene la jornada', 'La jornada 12 se jugará'), n('AS', 'LaLiga mantiene la jornada', 'Se jugará la jornada 12'),
    n('SPORT', 'El Valencia prepara el partido', 'Suspender el partido'), n('Superdeporte', 'El Valencia prepara el partido', 'Suspender el partido')] });
  ok(t9.length === 1 && /jornada 12/.test(t9[0].texto), `solo la jornada: ${t9.map((t) => t.texto).join(' | ')}`);
}
// 10) una jornada que no va a salir (un solo medio) no tapa un partido aplazado de verdad; dos partidos en una noticia, los dos
R['Se suspende la jornada (rumor)'] = { tipo: 'suspension', estado: 'confirmado', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial: false, contexto: '', detalle: '' };
R['Aplazados el Sevilla-Alavés y el Barça-Osasuna'] = { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 0, equipos: ['Sevilla', 'Alavés', 'Barcelona', 'Osasuna'], luto: false, oficial: false, contexto: '', detalle: '' };
{
  const r10 = new Registro(config);
  const t10 = await generar({ ...base, registro: r10, leer: async () => [n('Estadio Deportivo', 'Se suspende la jornada (rumor)', 'La jornada 12'),
    n('MARCA', 'El Sevilla-Alavés se aplaza por el temporal', 'La lluvia obliga a mover el partido'), n('Diario de Sevilla', 'Aplazado el Sevilla-Alavés', 'El temporal obliga a aplazar el encuentro')] });
  ok(t10.some((t) => /Se aplaza el Sevilla-Alavés/.test(t.texto)), `un solo medio de la jornada no tapa el partido: ${t10.map((t) => t.texto).join(' | ')}`);
  const r11 = new Registro(config);
  const t11 = await generar({ ...base, registro: r11, leer: async () => [n('MARCA', 'Aplazados el Sevilla-Alavés y el Barça-Osasuna', 'Por el temporal'), n('AS', 'Aplazados el Sevilla-Alavés y el Barça-Osasuna', 'Por el temporal')] });
  ok(t11.length === 2 && t11.some((t) => /Sevilla-Alavés/.test(t.texto)) && t11.some((t) => /Barça-Osasuna/.test(t.texto)), `dos partidos en una noticia: ${t11.map((t) => t.texto).join(' | ')}`);
}
// 11) la jornada que nombra partidos ya aplazados no se parte en partidos; con stats, cada club con su rival de verdad
R['LaLiga mantiene la jornada 12; ya estaban aplazados dos'] = { tipo: 'suspension', estado: 'descartado', primera: true, segunda: false, jornada: 12, equipos: ['Sevilla', 'Alavés', 'Barcelona', 'Osasuna'], luto: true, oficial: false, contexto: '', detalle: '' };
R['Aplazados los partidos del Sevilla y del Barça'] = { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 0, equipos: ['Sevilla', 'Barcelona', 'Alavés', 'Osasuna'], luto: false, oficial: false, contexto: '', detalle: '' };
{
  const t12 = await generar({ ...base, registro: new Registro(config), leer: async () => [n('MARCA', 'LaLiga mantiene la jornada 12; ya estaban aplazados dos', 'La jornada 12 se jugará'), n('AS', 'LaLiga mantiene la jornada 12; ya estaban aplazados dos', 'La jornada 12 se jugará')] });
  ok(!t12.some((t) => /Sevilla-Alavés|Barça-Osasuna/.test(t.texto)), `la jornada con partidos ya aplazados no da partidos: ${t12.map((t) => t.texto).join(' | ')}`);
  const st = [{ id: 1, local: { id: 1 }, visitor: { id: 2 } }, { id: 2, local: { id: 3 }, visitor: { id: 5 } }];
  const t13 = await generar({ ...base, stats: st, registro: new Registro(config), leer: async () => [n('MARCA', 'Aplazados los partidos del Sevilla y del Barça', 'Por el temporal ante el Alavés y Osasuna'), n('AS', 'Aplazados los partidos del Sevilla y del Barça', 'Por el temporal')] });
  ok(t13.length === 2 && t13.some((t) => /Sevilla-Alavés/.test(t.texto)) && t13.some((t) => /Barça-Osasuna/.test(t.texto)), `con stats, cada uno con su rival: ${t13.map((t) => t.texto).join(' | ')}`);
}
ok(TEMA.test('Se jugará la jornada 12') && TEMA.test('La jornada 12 se jugará') && TEMA.test('Han decidido que haya fútbol'), 'TEMA: «se jugará la jornada»');
ok(TEMA.test('LaLiga decide que se juegue la jornada 12') && TEMA.test('Habrá partidos este fin de semana'), 'TEMA: subjuntivo y presente');
// 12) dos partidos «de la jornada 12» son dos partidos; y si son de la siguiente, con sus partidos
R['LaLiga aplaza el Sevilla-Alavés y el Barça-Osasuna de la jornada 12'] = { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 12, equipos: ['Sevilla', 'Alavés', 'Barcelona', 'Osasuna'], luto: false, oficial: false, contexto: '', detalle: '' };
R['Aplazados el Sevilla-Barça y el Alavés-Athletic'] = { tipo: 'aplazamiento', estado: 'confirmado', primera: true, segunda: false, jornada: 0, equipos: ['Sevilla', 'Barcelona', 'Alavés', 'Athletic'], luto: false, oficial: false, contexto: '', detalle: '' };
{
  const st = [{ id: 1, local: { id: 1 }, visitor: { id: 2 } }, { id: 2, local: { id: 3 }, visitor: { id: 5 } }];
  const t14 = await generar({ ...base, stats: st, registro: new Registro(config), leer: async () => [n('MARCA', 'LaLiga aplaza el Sevilla-Alavés y el Barça-Osasuna de la jornada 12', 'Por el temporal'), n('AS', 'LaLiga aplaza el Sevilla-Alavés y el Barça-Osasuna de la jornada 12', 'Por el temporal')] });
  ok(t14.length === 2, `«de la jornada 12»: dos partidos (${t14.map((t) => t.texto).join(' | ')})`);
  const sig = [{ id: 3, local: { id: 1 }, visitor: { id: 3 } }, { id: 4, local: { id: 2 }, visitor: { id: 6 } }];
  const t15 = await generar({ ...base, stats: st, statsDe: async () => sig, registro: new Registro(config), leer: async () => [n('MARCA', 'Aplazados el Sevilla-Barça y el Alavés-Athletic', 'Por el temporal'), n('AS', 'Aplazados el Sevilla-Barça y el Alavés-Athletic', 'Por el temporal')] });
  ok(t15.length === 2 && t15.some((t) => /Sevilla-Barça/.test(t.texto)), `de la jornada siguiente: ${t15.map((t) => t.texto).join(' | ')}`);
  // con la API de la siguiente caída, nada (no partidos inventados en el orden de Gemini)
  const t16 = await generar({ ...base, stats: st, statsDe: async () => { throw new Error('caída'); }, registro: new Registro(config), leer: async () => [n('MARCA', 'Aplazados el Sevilla-Barça y el Alavés-Athletic', 'Por el temporal'), n('AS', 'Aplazados el Sevilla-Barça y el Alavés-Athletic', 'Por el temporal')] });
  ok(t16.length === 0, `API caída: nada (${t16.map((t) => t.texto).join(' | ')})`);
  // la de COPE con clubes puestos por Gemini: cuenta como la jornada
  R['La intención es que se disputen todos los partidos de LaLiga, salvo los ya aplazados'] = { tipo: 'suspension', estado: 'descartado', primera: true, segunda: true, jornada: 0, equipos: ['Tenerife', 'Andorra'], luto: true, oficial: false, contexto: '', detalle: '' };
  R['Se jugará la jornada 12'] = { tipo: 'suspension', estado: 'descartado', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial: false, contexto: '', detalle: '' };
  const t17 = await generar({ ...base, registro: new Registro(config), leer: async () => [n('COPE', 'La intención es que se disputen todos los partidos de LaLiga, salvo los ya aplazados', 'Han decidido que haya fútbol este fin de semana en Primera y Segunda'), n('MARCA', 'Se jugará la jornada 12', 'Habrá Liga')] });
  ok(t17.length === 1 && /se jugará/.test(t17[0].texto) && /COPE/.test(t17[0].texto), `COPE con clubes cuenta como la jornada: ${t17.map((t) => t.texto).join(' | ')}`);
  // pero un partido aplazado o suspendido que nombra la jornada sigue siendo el partido, nunca «se suspende la jornada»
  for (const [tit, ent, est] of [['No habrá fútbol en el Sánchez-Pizjuán: aplazado el Sevilla-Alavés', 'Por el temporal', 'confirmado'], ['LaLiga aplaza el Sevilla-Alavés y mantiene la jornada', 'El resto se juega', 'confirmado'],
    ['Suspendido el Sevilla-Alavés; el resto de la jornada se jugará', 'Por el temporal', 'confirmado'], ['LaLiga estudia aplazar el Sevilla-Alavés', 'No suspende la jornada', 'se_estudia']]) {
    R[tit] = { tipo: 'aplazamiento', estado: est, primera: true, segunda: false, jornada: 0, equipos: ['Sevilla', 'Alavés'], luto: false, oficial: false, contexto: '', detalle: '' };
    const tt = await generar({ ...base, registro: new Registro(config), leer: async () => [n('MARCA', tit, ent), n('AS', tit, ent)] });
    ok(!tt.some((t) => /jornada/.test(t.texto)) && tt.some((t) => /Sevilla-Alavés/.test(t.texto)), `«${tit}»: el partido (${tt.map((t) => t.texto).join(' | ')})`);
  }
}
// 10) lo contrario de la misma historia: manda lo oficial o lo que cuentan más medios; con el mismo peso, nada (5 nov: SPORT mal leído)
{
  const cf = (oficial = false) => ({ tipo: 'suspension', estado: 'confirmado', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial, contexto: '', detalle: '' });
  R['Se para el fútbol por el luto'] = cf();
  R['LaLiga suspende la jornada 12, comunicado oficial'] = cf(true);
  R['Se jugará la jornada 12'] = { tipo: 'suspension', estado: 'descartado', primera: true, segunda: true, jornada: 12, equipos: [], luto: true, oficial: false, contexto: '', detalle: '' };
  const va = (xs) => generar({ ...base, registro: new Registro(config), leer: async () => xs });
  const si = ['Se para el fútbol por el luto', 'No habrá jornada este fin de semana'], no = ['Se jugará la jornada 12', 'Habrá Liga el fin de semana'];
  const a = await va([n('SPORT', si[0], si[1]), n('COPE', no[0], no[1]), n('MARCA', no[0], no[1]), n('AS', no[0], no[1])]);
  ok(a.length === 1 && /se jugará/.test(a[0].texto) && !a.some((t) => /Se suspende/.test(t.texto)), `uno dice «se suspende» y tres «se jugará»: ${a.map((t) => t.texto).join(' | ')}`);
  const a2 = await va([n('SPORT', si[0], si[1]), n('AS', si[0], si[1]), n('COPE', no[0], no[1])]);
  ok(a2.length === 0, `dos contra uno, sin nada oficial: espero (${a2.map((t) => t.texto).join(' | ')})`);
  const b = await va([n('SPORT', si[0], si[1]), n('AS', si[0], si[1]), n('COPE', no[0], no[1]), n('MARCA', no[0], no[1])]);
  ok(b.length === 0, `dos contra dos: espero (${b.map((t) => t.texto).join(' | ')})`);
  const c = await va([n('MARCA', 'LaLiga suspende la jornada 12, comunicado oficial', 'LaLiga ha decidido suspender la jornada 12'), n('COPE', no[0], no[1]), n('AS', no[0], no[1])]);
  ok(c.length === 1 && /Se suspende la jornada 12/.test(c[0].texto) && /Es oficial/.test(c[0].texto), `lo oficial manda: ${c.map((t) => t.texto).join(' | ')}`);
}
// 8) el número de jornada: el del texto; el puesto por Gemini solo si todas coinciden
ok(numeroDe([{ jornada: 13, jTxt: false }, { jornada: 12, jTxt: true }]) === 12, 'el del texto manda');
ok(numeroDe([{ jornada: 13, jTxt: false }, { jornada: 13, jTxt: false }]) === 13 && numeroDe([{ jornada: 13, jTxt: false }, { jornada: 0 }]) === 0, 'el puesto, solo si todas lo traen igual');
// 9) (5 nov 17:46: la decisión de la J12 llegó con el tope del día gastado en goteos y en fallos de Gemini) una noticia sin decisión
// espera a juntar 3 o a llevar 20 min vista; la que trae la decisión se pregunta enseguida; los fallos de Gemini no gastan el tope
{
  const cfg = { ...config, ligaJuntar: 3, ligaGeminiDia: 2 };
  const r2 = new Registro(cfg);
  let p = 0, falla2 = false;
  const ia = async (x) => { p++; return falla2 ? { ok: false, error: '429' } : pedirIA(x); };
  const b2 = { ...base, config: cfg, registro: r2, pedirIA: ia };
  const goteo = [n('MARCA', 'La AFE pide suspender la jornada', 'El sindicato cree que no hay condiciones para jugar la jornada 12')];
  await generar({ ...b2, leer: async () => goteo });
  ok(p === 0, `una noticia sin decisión espera (${p} preguntas)`);
  await generar({ ...b2, ahora: ahora + 21 * 60e3, leer: async () => goteo });
  ok(p === 1, `a los 20 min se pregunta (${p})`);
  const decide = [n('MARCA', 'Se juega la jornada y se parará en el minuto 9', 'LaLiga y la RFEF homenajearán a Jesús de Miguel')];
  ok(DECISIVA.test(decide[0].titulo) && !DECISIVA.test(goteo[0].titulo), 'qué noticia trae una decisión');
  falla2 = true;
  await generar({ ...b2, leer: async () => decide });
  await generar({ ...b2, leer: async () => decide });
  ok(p === 3 && r2.datos.liga.gemini.n === 1 && r2.datos.liga.gemini.fallos === 2, `los fallos no gastan el tope (${p} preguntas, ${JSON.stringify(r2.datos.liga.gemini)})`);
  falla2 = false;
  await generar({ ...b2, leer: async () => decide });
  ok(p === 4 && r2.datos.liga.gemini.n === 2, 'la decisión se pregunta enseguida');
}
// 10) «se juega la jornada» sin Gemini (5 nov: el lite leyó como «nada» la de MARCA y la del comunicado): solo si lo dice claro y no es
// solo de Segunda; pedir que se suspenda no es una decisión
{
  const H = (t) => hechoSeJuega({ titulo: t, entradilla: '', guid: 'g', medio: 'MARCA', t: ahora }, 12);
  ok(H('Homenaje a Jesús de Miguel: se juega la jornada y se parará en el minuto 9') && H('Habrá fútbol y la jornada no se suspenderá') && H('LaLiga mantiene la jornada 12'), 'lo que dice claro que se juega');
  ok(!H('La AFE sigue pidiendo que se suspenda la jornada') && !H('Lo más adecuado sería suspender la jornada') && !H('En Segunda se juega la jornada 13 con normalidad'), 'pedirlo o Segunda sola, no');
  ok(H('se juega la jornada').jornada === 12 && H('se juega la jornada').estado === 'descartado' && H('LaLiga mantiene la jornada 12').jTxt, 'la jornada: la del texto o la de ahora');
  // y la que Gemini leyó como «nada» cuenta igual con dos medios
  const r3 = new Registro(config);
  const nada = async ({ prompt }) => ({ ok: true, modelo: 'falso', datos: { noticias: [...prompt.matchAll(/^\[(\d+)\]/gm)].map((m) => ({ i: Number(m[1]), tipo: 'nada', estado: 'confirmado', primera: false, segunda: false, jornada: 0, equipos: [], luto: false, oficial: false, contexto: '', detalle: '' })) } });
  const ps = [n('MARCA', 'Homenaje a Jesús de Miguel: se juega la jornada y se parará en el minuto 9', 'Los partidos recordarán al jugador fallecido'),
    n('COPE', 'Así será el homenaje', 'LaLiga y la RFEF se han unido. Habrá fútbol y la jornada no se suspenderá')];
  const t3 = await generar({ ...base, registro: r3, pedirIA: nada, leer: async () => ps });
  ok(t3.length === 1 && /✅ La jornada 12 .*se jugará/.test(t3[0].texto) && /MARCA y COPE|COPE y MARCA/.test(t3[0].texto), `la decisión sale aunque Gemini no la vea (${t3.map((t) => t.texto).join(' | ')})`);
}
console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
