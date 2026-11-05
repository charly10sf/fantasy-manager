// Prueba de novedades y caídas sin red (Carlos, 3 nov 12:06): textos agrupados, sin repetir jugador y con separación entre los dos tipos.
//   node bot/prueba/bajas-ejemplo.mjs
// El caso de partida es el de las 11:51 y 11:52 del 3 nov: tres vuelven y Lemar se lesiona; luego caídas con Lemar otra vez.
import { generar as novedades } from '../tipos/novedades.mjs';
import { escribir as caidas } from '../tipos/caidas.mjs';
import { validar } from '../lib/validar.mjs';
import { Registro } from '../lib/registro.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const ver = (titulo, ts) => {
  console.log(`\n=== ${titulo}`);
  for (const t of ts) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) falla(`${t.clave}: ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}\n${t.texto}`); }
};
const equipos = { 15: 'Real Madrid', 9: 'Valencia CF', 20: 'Villarreal CF', 30: 'Elche CF', 5: 'RC Celta', 2: 'Athletic Club', 4: 'FC Barcelona' };
const RIVAL = { 15: 'Rayo Vallecano', 9: 'Getafe CF', 20: 'Real Betis', 30: 'Girona FC', 5: 'Sevilla FC', 2: 'Osasuna', 4: 'Atlético de Madrid' };
const proximo = async (t) => ({ jornada: 12, rival: RIVAL[t] ? RIVAL[t].replace(/ (CF|FC)$/, '') : 'Mallorca' });
const J = (id, nickname, teamId, playerStatus, averagePoints, positionId = 3, marketValue = 20e6) => ({ id, nickname, teamId, playerStatus, averagePoints, marketValue, positionId });
const config = { topes: { novedades: 20, caidas: 9 }, topeDiario: 40, maxPorEjecucion: 6, separacionBajasMin: 75 };
const reg = new Registro(config);   // sin fichero: todo en memoria
reg.datos.estados = { 1: 'injured', 2: 'ok', 3: 'injured', 4: 'doubtful', 5: 'ok', 6: 'injured', 7: 'ok' };
const ahora = Date.now();
// partes de ejemplo (la lista de lesionados de la web; aquí no hay red) y una ficha con la roja en la J11
const listaPartes = [{ nombre: 'Thomas Lemar', slug: 'thomas-lemar', lesion: 'Rotura fibrilar en el aductor', dia: 1, mes: 11, dias: 2, estado: 'baja', hasta: 'finales de noviembre', jornada: null },
  { nombre: 'Pedro González', slug: 'pedri', lesion: 'Molestias en el isquiotibial', dia: 30, mes: 10, dias: 4, estado: 'duda', hasta: null, jornada: 12 },
  { nombre: 'Federico Valverde', slug: 'federico-valverde', lesion: 'Molestias en los isquiotibiales', dia: 25, mes: 10, dias: 9, estado: 'disponible', hasta: null, jornada: 12 }];
const fichaDe = async () => ({ playerStats: [{ weekNumber: 10, stats: { mins_played: [90, 2], yellow_card: [1, -1] } }, { weekNumber: 11, stats: { mins_played: [70, 2], red_card: [1, -3] } }] });

// 1) novedades: tres vuelven y Lemar se lesiona → un solo tweet agrupado
const jug = [J(1, 'Valverde', 15, 'ok', 5.5), J(2, 'Lemar', 30, 'injured', 5.5), J(3, 'Sadiq', 9, 'ok', 4.8, 4), J(4, 'Gueye', 20, 'ok', 4.1),
  J(5, 'M. Román', 5, 'ok', 4.6, 2), J(6, 'Sancet', 2, 'injured', 6.0), J(7, 'Pedri', 4, 'ok', 7.2)];
const n1 = await novedades({ jugadores: jug, equipos, jornada: 12, registro: reg, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe });
ver('novedades de las 11:51 (tres vuelven y Lemar se lesiona)', n1);
if (n1.length !== 1) falla(`debía salir un tweet agrupado y salen ${n1.length}`);
if (n1.some((t) => /\(Elche\)|\(Real Madrid\)|de media\)/.test(t.texto))) falla('sigue con el formato de lista (paréntesis)');
for (const t of n1) { if (reg.decidir(t) !== 'ok') falla(`no deja publicar ${t.clave}`); reg.reservar(t); }

// 2) caídas justo después: espera por la separación, y Lemar no se repite
const c = [{ id: 2, nombre: 'Lemar', teamId: 30, pos: 3, equipo: 'Elche', estado: 'lesionado', p: 0, pct: 0, media: 5.5, parte: listaPartes[0] },
  { id: 8, nombre: 'Aspas', teamId: 5, pos: 4, equipo: 'Celta', estado: 'lesionado', p: 0, pct: 0, media: 6.1 },
  { id: 9, nombre: 'Mingueza', teamId: 5, pos: 2, equipo: 'Celta', estado: 'sancionado', p: 0, pct: 0, media: 4.4 },
  { id: 10, nombre: 'Raíllo', teamId: 31, pos: 2, equipo: 'Mallorca', estado: 'sancionado', p: 0, pct: 0, media: 3.9 },
  { id: 11, nombre: 'Kubo', teamId: 16, pos: 3, equipo: 'Real Sociedad', estado: 'lesionado', p: 0, pct: 0, media: 5.0 },
  { id: 12, nombre: 'Lukébakio', teamId: 17, pos: 4, equipo: 'Sevilla', estado: 'lesionado', p: 0, pct: 0, media: 4.2 }];
const cub = new Set(reg.cubiertos().filter((x) => x.tipo === 'novedades').map((x) => String(x.id)));
const c1 = await caidas(c.filter((x) => !cub.has(String(x.id))), { jornada: 12, proximo });
ver('caídas de las 11:52 (sin Lemar)', c1);
if (c1.some((t) => /Lemar/.test(t.texto))) falla('Lemar sale otra vez en caídas');
if (!c1.length) falla('no sale ninguna caída');
for (const t of c1) if (!/^espera/.test(reg.decidir(t))) falla(`caídas no espera tras novedades: ${reg.decidir(t)}`);
console.log(`\n(decidir) ${reg.decidir(c1[0])}`);

// 3) pendientes: la segunda ejecución no inventa nada, y si se pierde lo publicado vuelve a salir
const reg2 = new Registro(config);
reg2.datos.estados = { 1: 'injured', 2: 'ok', 3: 'injured', 4: 'doubtful', 5: 'ok', 6: 'injured', 7: 'ok' };
const p1 = await novedades({ jugadores: jug, equipos, jornada: 12, registro: reg2, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe });
const p2 = await novedades({ jugadores: jug, equipos, jornada: 12, registro: reg2, ventanas: false, ahora: ahora + 5 * 60e3, log: () => {}, proximo, listaPartes, fichaDe });
if (!p1.length || p2.length !== p1.length || p2[0].clave !== p1[0].clave) falla('un cambio que no se publicó no queda pendiente para la siguiente ejecución');
reg2.reservar(p2[0]);
const p3 = await novedades({ jugadores: jug, equipos, jornada: 12, registro: reg2, ventanas: false, ahora: ahora + 10 * 60e3, log: () => {}, proximo, listaPartes, fichaDe });
if (p3.length) falla('lo ya publicado vuelve a salir');

// 4) más casos de texto: un club con dos que vuelven, uno solo, cuatro bajas de varios clubes
const reg3 = new Registro(config);
reg3.datos.estados = { 1: 'injured', 13: 'suspended', 2: 'ok' };
ver('un club, dos que vuelven', await novedades({ jugadores: [J(1, 'Valverde', 15, 'ok', 5.5), J(13, 'Tchouaméni', 15, 'ok', 5.1)], equipos, jornada: 12, registro: reg3, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe }));
const reg4 = new Registro(config);
reg4.datos.estados = { 2: 'ok' };
ver('uno solo, sancionado (roja en la J11)', await novedades({ jugadores: [J(3, 'Sancet', 2, 'suspended', 6.0)], equipos, jornada: 12, registro: (() => { const r = new Registro(config); r.datos.estados = { 3: 'ok' }; return r; })(), ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe }));
const regV = new Registro(config); regV.datos.estados = { 1: 'injured' };
ver('uno solo, vuelve', await novedades({ jugadores: [J(1, 'Valverde', 15, 'ok', 5.5)], equipos, jornada: 12, registro: regV, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe }));
const regS = new Registro(config); regS.datos.estados = { 5: 'ok' };
const sinParte = await novedades({ jugadores: [J(5, 'M. Román', 5, 'injured', 4.6, 2)], equipos, jornada: 12, registro: regS, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe, soloSeguras: true });
if (sinParte.length) falla('una lesión sin parte sale publicando');
if (!regS.datos.novedadesPend.length) falla('la lesión sin parte no queda pendiente');
ver('uno solo', await novedades({ jugadores: [J(2, 'Lemar', 30, 'injured', 5.5)], equipos, jornada: 12, registro: reg4, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe }));
const reg5 = new Registro(config);
reg5.datos.estados = { 2: 'ok', 5: 'ok', 6: 'ok', 7: 'ok' };
ver('cuatro bajas nuevas', await novedades({ jugadores: [J(2, 'Lemar', 30, 'injured', 5.5), J(5, 'M. Román', 5, 'injured', 4.6, 2), J(6, 'Sancet', 2, 'suspended', 6.0), J(7, 'Pedri', 4, 'injured', 7.2)], equipos, jornada: 12, registro: reg5, ventanas: false, ahora, log: () => {}, proximo, listaPartes, fichaDe }));
ver('caídas: dos del mismo club y sueltos', await caidas([...c, { id: 14, nombre: 'Iago', teamId: 5, pos: 4, equipo: 'Celta', estado: 'lesionado', p: 0, pct: 0, media: 3.2 }], { jornada: 12, proximo }));
ver('caídas: uno solo con parte (duda en la web)', await caidas([{ id: 20, nombre: 'Joaquín', teamId: 32, pos: 4, equipo: 'Málaga', estado: 'lesionado', p: 0, pct: 0, media: 3, parte: { lesion: 'Lesión en el sóleo', dia: 21, mes: 10, dias: 13, estado: 'duda', jornada: 12 } }], { jornada: 12, proximo: async () => ({ jornada: 12, rival: 'Racing' }) }));
ver('caídas: uno solo sancionado', await caidas([{ id: 21, nombre: 'Vini Jr.', teamId: 15, pos: 4, equipo: 'Real Madrid', estado: 'sancionado', p: 0, pct: 0, media: 6.3, motivoSan: { txt: 'Vio la roja en la jornada 11', numeros: [11] } }], { jornada: 12, proximo }));
ver('caídas: con dudas (solo simulacro)', await caidas([{ id: 15, nombre: 'Oblak', teamId: 1, pos: 1, equipo: 'Atlético', estado: 'duda', p: 0.36, pct: 36, media: 5.5 }, ...c.slice(3)], { jornada: 12, proximo }));
// baja larga (5 semanas o más según el parte): «Venta obligatoria»; una de 3 semanas sigue siendo «Baja»
const larga = (hasta) => caidas([{ id: 22, nombre: 'Miguel Sierra', teamId: 9, pos: 3, equipo: 'Sevilla', estado: 'lesionado', p: 0, pct: 0, media: 4.1, parte: { lesion: 'Luxación acromioclavicular', dia: 28, mes: 10, dias: 6, estado: 'baja', hasta } }], { jornada: 12, proximo, ahora: Date.parse('2026-11-03T20:00:00Z') });
const vl = await larga('enero'), vc = await larga('finales de noviembre');
ver('caídas: baja larga', vl);
if (!/💸 Venta obligatoria/.test(vl[0].texto) || !/(No se le espera|Estará fuera) hasta enero/.test(vl[0].texto)) falla('baja larga: Venta obligatoria con la fecha');
if (/Venta obligatoria/.test(vc[0].texto)) falla('baja de 3 semanas: no es venta obligatoria');

console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien'); process.exit(fallos ? 1 : 0);
