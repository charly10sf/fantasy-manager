// Simulacro sin red de noticias y novedades en el parón (Carlos, 9 nov: el tuit de Lamine Yamal de las 22:36, clave
// noticias|3104:mala, con la J13 a 11 días). Comprueba:
//   - una sola fuente (La Voz de Galicia) y LaLiga en duda no basta: hacen falta dos medios o el club;
//   - con dos medios, la plantilla y los hechos dicen cuándo vuelve la liga («tras el parón», la fecha) y si se pierde la selección;
//   - el % va a secas, sin «en Fantasy Manager»;
//   - el validador tira el texto que salió («lo normal es que salga contra el Villarreal», «mejor esperar a los onces») y deja uno bueno;
//   - con el partido a 2 días (semana normal), «esperar a los onces» sigue valiendo;
//   - el bucle de redactar, con una IA falsa que contesta primero lo de anoche y luego algo bueno, se queda con lo bueno;
//   - novedades en el parón también llevan la fecha.
//   node bot/prueba/paron-noticias-ejemplo.mjs
import { generar as noticias } from '../tipos/noticias.mjs';
import { generar as novedades } from '../tipos/novedades.mjs';
import { revisar, redactar, erroresLejos } from '../lib/redaccion.mjs';
import { paronActual } from '../lib/paron.mjs';
import { validar } from '../lib/validar.mjs';
import { Registro } from '../lib/registro.mjs';
import { fijarLimite } from '../lib/texto.mjs';
import { SONNET } from '../lib/claude.mjs';
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
const config0 = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
fijarLimite(1000);

// el parón de verdad: la J12 acabó el domingo 8 nov a las 21:00 y la J13 empieza el viernes 20 a las 21:00 (lib/paron.mjs)
const J = (...fechas) => fechas.map((date, i) => ({ id: i + 1, date }));
const j12 = J('2026-11-06T20:00:00Z', '2026-11-08T20:00:00Z'), j13 = J('2026-11-20T20:00:00Z', '2026-11-22T17:30:00Z');
const ahora = Date.parse('2026-11-09T21:36:00Z');   // lunes 9, 22:36 en Madrid
const paron = paronActual({ anterior: j12, siguiente: j13, jugada: 12, ahora });
ok(paron && paron.activo && paron.siguiente === 13, 'estamos en el parón entre la J12 y la J13');

const equipos = { 4: 'FC Barcelona', 9: 'Villarreal CF' };
const lamine = { id: '3104', nickname: 'Lamine Yamal', name: 'Lamine Yamal Nasraoui', teamId: 4, playerStatus: 'doubtful', averagePoints: 8.4, positionId: 4, marketValue: 180e6 };
const proximo = async () => ({ jornada: 13, rival: 'Villarreal', rivalId: '9', enCasa: true, fecha: '2026-11-20T20:00:00Z' });
const info = { titularidad: async () => ({ p: 0.58, pct: 58 }), rival: async () => ({ pos: 8, n: 20, nivel: 'media', gf: 1.4, gc: 1.1, rgf: 9, rgc: 8 }) };
const N = (medio, guid, titulo, entradilla, h = 1) => ({ medio, guid: `${medio}|${guid}`, titulo, entradilla, url: guid, t: ahora - h * 36e5 / 4 });
const vozGalicia = N('La Voz de Galicia', 'v1', 'Lamine Yamal se recupera en Barcelona', 'El jugador deja la concentración de la selección por molestias en la rodilla derecha');
const sport = N('SPORT', 's1', 'Lamine Yamal se queda en Barcelona', 'Molestias en la rodilla: no estará con la selección en este parón');
const R = {
  'Lamine Yamal se recupera en Barcelona': { que: 'molestias', seleccion: 'pierde', hecho: 'Lamine Yamal se recupera de molestias en la rodilla', motivo: 'molestias en la rodilla derecha', plazo: '' },
  'Lamine Yamal se queda en Barcelona': { que: 'molestias', seleccion: 'pierde', hecho: 'Lamine Yamal se queda en Barcelona por molestias', motivo: 'molestias en la rodilla', plazo: '' },
};
let lotes = [];
const pedirIA = async ({ prompt }) => {
  const lote = JSON.parse(prompt.slice(prompt.indexOf('Noticias:\n') + 10));
  lotes.push(prompt);
  return { ok: true, modelo: 'falso', datos: { noticias: lote.map((x) => ({ i: x.i, jugadorId: x.candidatos[0].id, otraCompeticion: false, seguro: true, oficial: false, personal: false, ...(R[x.titular] || { que: 'nada', seleccion: 'no dice', hecho: '', motivo: '', plazo: '' }) })) } };
};
const config = { ...config0, topes: { noticias: 15, novedades: 20, caidas: 9 }, topeDiario: 40, maxPorEjecucion: 6, noticiasPorEjecucion: 4, geminiDia: 60 };
const base = { jugadores: [lamine], equipos, jornada: 13, config, ventanas: false, ahora, log: () => {}, proximo, pedirIA, clave: 'falsa', listaPartes: [], info, paron };

// 1) solo La Voz de Galicia, con LaLiga en duda desde esa tarde: espera (antes salía)
let reg = new Registro(config); reg.fichero = null;
reg.datos.noticias = { vistas: {}, hechos: [], gemini: { dia: '', n: 0 }, desde: { 3104: { e: 'doubtful', t: Date.parse('2026-11-09T13:51:14Z') } } };
let logs = [];
let ts = await noticias({ ...base, registro: reg, leer: async () => [vozGalicia], log: (s) => logs.push(s) });
ok(ts.length === 0, 'una sola fuente y LaLiga en duda: no sale');
ok(logs.some((l) => /La Voz de Galicia \(y LaLiga, que no cuenta\), espero a una segunda fuente/.test(l)), 'el log dice por qué espera');
ok(/"seleccion"/.test(JSON.stringify(R)) && /seleccion: "pierde"/.test(lotes[0]), 'el clasificador pregunta por la selección');

// 2) con SPORT, dos medios: sale, con la fecha, «tras el parón» y la selección
ts = await noticias({ ...base, registro: reg, leer: async () => [vozGalicia, sport] });
const t = ts[0];
console.log(`--- plantilla\n${t && t.texto}`);
ok(t && t.clave === 'noticias|3104:mala|2026-11-09', `con dos medios sale (${t && t.clave})`);
const v = t ? validar(t.texto, { numeros: t.numeros, max: 1000 }) : { ok: false, errores: [] };
ok(v.ok, `la plantilla pasa el validador ${v.errores.join('; ')}`);
ok(t && /tras el parón, el viernes 20 de noviembre/.test(t.texto), 'la plantilla dice «tras el parón, el viernes 20 de noviembre»');
ok(t && /selección/.test(t.texto), 'la plantilla dice que se pierde la selección');
ok(t && /58 % de titularidad/.test(t.texto) && !/Fantasy Manager/.test(t.texto), 'el % a secas, sin «Fantasy Manager»');
ok(t && !/onces/.test(t.texto), 'nada de onces');
ok(t && /La Voz de Galicia|SPORT/.test(t.texto), 'nombra los medios');
const p = t && t.hechos.partido;
ok(p && p.faltanDias === 11 && p.trasElParon && /no hay liga hasta la jornada 13, el viernes 20 de noviembre/.test(p.sinLigaHastaEntonces), `los hechos dicen cuándo vuelve la liga (${p && p.faltanDias} días)`);
ok(t && t.hechos.jugadores[0].seleccion === 'se pierde los partidos con su selección' && t.hechos.jugadores[0].titularidad === '58 %', 'los hechos llevan la selección y el % sin «Fantasy Manager»');

// 3) el validador: el texto de anoche no pasa; uno bueno, sí
const anoche = '⁉️ Lamine Yamal se recupera en Barcelona de unas molestias en la rodilla derecha, según La Voz de Galicia y SPORT.\n\nTiene 10 goles y 8 asistencias en la liga, así que merece la pena seguirle de cerca. Con un 58 % de titularidad en Fantasy Manager, lo normal es que salga contra el Villarreal 🚢, que va 8º. Si lo tienes, mejor esperar a los onces.';
const bueno = '⁉️ Lamine Yamal se recupera en Barcelona de unas molestias en la rodilla derecha y se pierde los partidos con su selección, según La Voz de Galicia y SPORT.\n\nCon un 58 % de titularidad, lo normal es que llegue al partido contra el Villarreal 🚢 tras el parón, el viernes 20 de noviembre.';
const errA = revisar(anoche, { hechos: t.hechos, numeros: [...t.numeros, 10, 8], ahora });
ok(errA.some((x) => /esperar a los onces/.test(x)), 'tira «mejor esperar a los onces» con la J13 a 11 días');
ok(errA.some((x) => /rival de la jornada 13 sin decir cuándo/.test(x)), 'tira «salga contra el Villarreal» sin fecha');
ok(errA.some((x) => /a secas/.test(x)), 'tira «58 % de titularidad en Fantasy Manager»');
const errB = revisar(bueno, { hechos: t.hechos, numeros: t.numeros, ahora });
ok(!errB.some((x) => /onces|rival|a secas|baja/.test(x)), `el bueno pasa esas reglas ${errB.join(' | ')}`);
for (const x of ['Hasta que salgan los onces no hay que tocar nada.', 'Habrá que mirar el once del Barça.', 'Si lo tienes, este finde lo dejas en el banquillo.'])
  ok(erroresLejos(x, t.hechos, ahora).length, `tira «${x}»`);
// con el partido a 2 días, «esperar a los onces» es un consejo normal
const cerca = { ...t.hechos, partido: { ...t.hechos.partido, fecha: new Date(ahora + 2 * 864e5).toISOString() } };
ok(!erroresLejos('Si lo tienes, mejor esperar a los onces. Juega contra el Villarreal.', cerca, ahora).length, 'a 2 días, «esperar a los onces» vale');

// 4) el bucle de redactar: primero contesta lo de anoche (no vale) y luego el bueno
const tw = { ...t, texto: t.texto };
const resp = [anoche, bueno];
let preguntas = [];
const pedir = async (op) => { preguntas.push(op); return { ok: true, datos: { texto: resp.shift(), cronicas: [] }, modelo: SONNET }; };
const regR = { datos: { enviados: [] }, fichero: 'prueba.json', guardar() {} };
process.env.BOT_IA = 'claude'; process.env.ANTHROPIC_API_KEY = 'falsa';
const n = await redactar([tw], { tipo: 'noticias', registro: regR, config: { ...config, redactar: { ...config.redactar, activo: true } }, jugadores: [lamine], equipos, log: () => {}, ahora, pedir,
  revisor: async () => ({ ok: true, problemas: [], revisado: true, modelo: SONNET }) });
console.log(`--- redactado\n${tw.texto}`);
ok(n === 1 && preguntas.length === 2 && tw.texto.startsWith('⁉️ Lamine Yamal se recupera') && /tras el parón/.test(tw.texto), 'el redactado de anoche se tira y sale el bueno');
ok(preguntas[1] && /esperar a los onces/.test(preguntas[1].prompt), 'la segunda pregunta lleva el error de los onces');
ok(/sinLigaHastaEntonces/.test(preguntas[0].prompt), 'la pregunta a la IA lleva lo del parón');

// 5) novedades en el parón: Lamine pasa de duda a ok y el tuit lleva la fecha (también en 280)
fijarLimite(280);
const regN = new Registro(config); regN.fichero = null;
const nv = await novedades({ jugadores: [{ ...lamine, playerStatus: 'ok' }], equipos, jornada: 13, config, registro: regN, ventanas: false, ahora, log: () => {}, proximo, listaPartes: [], previos: { 3104: 'doubtful' }, info, paron });
const n1 = nv[0];
console.log(`--- novedades\n${n1 && n1.texto}`);
ok(n1 && /tras el parón/.test(n1.texto) && !/Fantasy Manager/.test(n1.texto), 'novedades: «tras el parón» y el % a secas');
ok(n1 && n1.hechos.partido && n1.hechos.partido.sinLigaHastaEntonces, 'novedades: los hechos dicen que no hay liga hasta la J13');
ok(n1 && validar(n1.texto, { numeros: n1.numeros, max: 280 }).ok, 'novedades: pasa el validador en 280');

console.log(fallos ? `\n${fallos} FALLOS` : '\n0 fallos');
process.exit(fallos ? 1 : 0);
