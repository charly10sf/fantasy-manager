// Pruebas sin red de lib/pulir.mjs: Gemini falso; cada reescritura mala tiene que quedarse con la plantilla.
import { pulir, revisar, nombresDe } from '../lib/pulir.mjs';
import { Registro } from '../lib/registro.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } };
const config = JSON.parse((await import('node:fs')).readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const jugadores = [{ nickname: 'Lemar' }, { nickname: 'Aspas' }, { nickname: 'Mingueza' }, { nickname: 'Kubo' }, { nickname: 'Budimir' }, { nickname: 'Mario Soriano' }];
const equipos = { 1: 'Elche CF', 2: 'RC Celta', 3: 'Real Sociedad', 4: 'C.A. Osasuna', 5: 'RC Deportivo' };
const nombres = nombresDe(jugadores, equipos);

const orig = `🚨 El Celta se queda sin dos titulares

❌ Aspas se cae por lesión

🟥 Mingueza cumple sanción

‼️ El que más pesa es Aspas: 6,1 puntos de media

❌ Baja Fantasy para la jornada 12 contra el Sevilla`;
const numeros = [6, 1, 12];
const bueno = `🚨 El Celta pierde a dos titulares

❌ Aspas, lesionado

🟥 Mingueza está sancionado

‼️ Aspas es el que más pesa: 6,1 puntos de media

❌ Baja Fantasy para la jornada 12 contra el Sevilla`;
const r = (n) => revisar(orig, n, { numeros, nombres });
ok(r(bueno).length === 0, `bueno: ${r(bueno)}`);
ok(r(bueno.replace('6,1', '6,2')).length > 0, 'cifra cambiada');
ok(r(bueno.replace(' de media', ' de media en 11 partidos')).length > 0, 'cifra nueva');
ok(r(bueno.replace('🟥 Mingueza está sancionado\n\n', '')).length > 0, 'pierde a Mingueza');
ok(r(bueno.replace('Aspas, lesionado', 'Aspas y Kubo, lesionados')).length > 0, 'añade a Kubo');
ok(r(bueno.replace('contra el Sevilla', 'ante el Sevilla')).length > 0, 'última línea cambiada');
ok(r(bueno.replace('🟥 Mingueza', '😱 Mingueza')).length > 0, 'emoji nuevo');
ok(r(bueno.replace('Aspas, lesionado', 'Aspas, lesionado 🤕')).length > 0, 'emoji dentro');
ok(r(bueno.replace('Aspas, lesionado', 'Aspas, lesionado según Iago')).length > 0, 'palabra nueva con mayúscula');
ok(r(bueno.replace('pierde a dos titulares', 'pierde a dos titulares, mi lectura')).length > 0, 'primera persona');
ok(r(bueno.replace('🚨 El Celta pierde', '🚨 El Celta, @RCCelta, pierde')).length > 0, 'mención');
ok(r(bueno.replace('Baja Fantasy', 'Baja')).length > 0, 'sin fantasy');

// el ciclo con un Gemini falso
const dir = mkdtempSync(`${tmpdir()}/pulir-`);
const reg = new Registro(config, `${dir}/registro.json`);
const tw = () => [{ tipo: 'caidas', clave: 'c1', jornada: 12, texto: orig, numeros }, { tipo: 'caidas', clave: 'c2', jornada: 12, texto: orig, numeros }];
const falso = (respuestas) => async () => ({ ok: true, modelo: 'falso', datos: { tweets: respuestas.map((texto, i) => ({ i, texto })) } });
let ts = tw();
let n = await pulir(ts, { tipo: 'caidas', registro: reg, config, jugadores, equipos, clave: 'x', pedirIA: falso([bueno, bueno.replace('6,1', '7')]), log: () => {} });
ok(n === 1 && ts[0].texto === bueno && ts[0].plantilla === orig && ts[1].texto === orig && !ts[1].plantilla, `ciclo: ${n}`);
ts = tw();
n = await pulir(ts, { tipo: 'directo', registro: reg, config, jugadores, equipos, clave: 'x', pedirIA: falso([bueno, bueno]), log: () => {} });
ok(n === 0 && ts[0].texto === orig, 'directo no se pule');
ts = tw();
n = await pulir(ts, { tipo: 'caidas', registro: reg, config, jugadores, equipos, clave: 'x', pedirIA: async () => ({ ok: false, error: '503' }), log: () => {} });
ok(n === 0 && ts[0].texto === orig, 'Gemini caído: plantilla');
ts = tw();
n = await pulir(ts, { tipo: 'caidas', registro: reg, config, jugadores, equipos, clave: '', pedirIA: falso([bueno]), log: () => {} });
ok(n === 0, 'sin clave');
ts = tw();
n = await pulir(ts, { tipo: 'caidas', registro: new Registro(config, null), config, jugadores, equipos, clave: 'x', pedirIA: falso([bueno]), log: () => {} });
ok(n === 0, 'sin registro guardado no gasta');
reg.datos.pulido.n = config.pulir.porDia;
ts = tw();
n = await pulir(ts, { tipo: 'caidas', registro: reg, config, jugadores, equipos, clave: 'x', pedirIA: falso([bueno]), log: () => {} });
ok(n === 0, 'tope diario');

// final con podio (emojis dentro de la línea en la plantilla)
const fin = `🏁 Deportivo 2-1 Osasuna

⭐ Mario Soriano, el mejor fantasy: 13 puntos

🥈 Budimir 11 · 🥉 Mario Soriano 13

Fantasy Manager · enlace en la bio`;
const finBueno = fin.replace('⭐ Mario Soriano, el mejor fantasy: 13 puntos', '⭐ Mario Soriano se va a 13 puntos fantasy');
ok(revisar(fin, finBueno, { numeros: [2, 1, 13, 11], nombres }).length === 0, `final: ${revisar(fin, finBueno, { numeros: [2, 1, 13, 11], nombres })}`);
ok(revisar(fin, finBueno.replace('Mario Soriano se va', 'Soriano se va').replace('🥉 Mario Soriano 13', '🥉 Soriano 13'), { numeros: [2, 1, 13, 11], nombres }).length > 0, 'final: pierde el nombre entero');

console.log(`\n${fallos ? `${fallos} FALLOS` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
