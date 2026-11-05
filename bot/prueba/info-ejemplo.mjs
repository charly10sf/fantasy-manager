// Prueba sin red de lo que se añade a los tweets de un jugador (lib/info-jugador.mjs, Carlos, 5 nov 13:33) y de la fuente de las
// noticias (fuenteDe en tipos/noticias.mjs):
//   node bot/prueba/info-ejemplo.mjs
// Casos: la tabla y el nivel del rival como la app; el % de titularidad se pide una vez por equipo y un 0 % no sale; Zaid Romero
// (vuelve con un medio y LaLiga ya lo da disponible): la fuente es LaLiga, no AS, y lleva el % y el rival; solo prensa: el medio;
// oficial: el club; una baja no lleva ni % ni rival; «según» nunca detrás de una cifra; las frases rotan; y todo pasa el validador.
import { tablaDe, nivelDe, crearInfo, ideasInfo, fraseRival, fraseGoles, fraseTitularidad, vecesHoy } from '../lib/info-jugador.mjs';
import { generar as noticias, fuenteDe } from '../tipos/noticias.mjs';
import { generar as novedades } from '../tipos/novedades.mjs';
import { validar } from '../lib/validar.mjs';
import { revisar, segunTrasCifra } from '../lib/pulir.mjs';
import { Registro } from '../lib/registro.mjs';
import { fijarLimite, largo, turno } from '../lib/texto.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const ok = (c, m) => { if (!c) falla(m); };
const enModo = (lim) => fijarLimite(lim);
const limiteInicial = largo() ? 1000 : 280;

// 1) la tabla, con el desempate de la app (puntos, diferencia de goles, goles a favor) y sin contar partidos sin acabar ni repetidos
const P = (id, l, v, gl, gv, st = 7) => ({ id, matchState: st, local: { id: l }, visitor: { id: v }, localScore: gl, visitorScore: gv });
{
  const t = tablaDe([P(1, 'A', 'B', 2, 0), P(2, 'C', 'D', 1, 1), P(3, 'A', 'C', 0, 0), P(4, 'B', 'D', 3, 1), P(5, 'D', 'A', 0, 1), P(6, 'B', 'C', 0, 0, 1), P(1, 'A', 'B', 2, 0)]);
  const pos = ['A', 'B', 'C', 'D'].map((x) => `${x}${t.porId[x].pos}`).join(' ');
  ok(pos === 'A1 B2 C3 D4', `tabla: ${pos}`);
  ok(t.porId.A.pj === 3 && t.porId.A.pts === 7 && t.porId.B.pj === 2, 'tabla: sin el partido sin acabar ni el repetido');
  ok(t.porId.B.rgf === 1 && t.porId.D.rgc === 1, `puesto en goles por partido: B ${t.porId.B.rgf}, D ${t.porId.D.rgc}`);
  ok(nivelDe({ pj: 2, pts: 6, pos: 1 }, t) === null, 'menos de 3 partidos: sin nivel');
}
// nivel como `nivelDe` de motor.js: los 4 primeros o 1,25 veces la media, difícil; los 4 últimos o 0,8 veces, fácil
{
  const T = { n: 20, mediaPts: 1.4 };
  const r = (pos, pts, pj = 11) => nivelDe({ pos, pts, pj }, T);
  ok(r(3, 15) === 'difícil' && r(6, 20) === 'difícil' && r(8, 16) === 'media' && r(17, 15) === 'fácil' && r(9, 12) === 'fácil' && r(12, 13) === 'media',
    `niveles: ${[r(3, 15), r(6, 20), r(8, 16), r(17, 15), r(9, 12), r(12, 13)].join(',')}`);
}

// 2) crearInfo: la tabla de las jornadas 1 a la actual y el % una vez por equipo
const equiposIds = Array.from({ length: 20 }, (_, i) => String(i + 1));
// 20 equipos: el 1 gana todo, el 20 pierde todo; jornadas de 10 partidos con resultados fijos
function jornadaFalsa(n) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    const a = equiposIds[(i + n) % 20], b = equiposIds[(19 - i + n) % 20];
    const [x, y] = Number(a) < Number(b) ? [a, b] : [b, a];
    out.push(P(n * 100 + i, x, y, Number(x) <= 4 ? 3 : 1, Number(y) >= 17 ? 0 : 1));
  }
  return out;
}
let pedidas = 0, probsPedidas = 0;
const pedirSemana = async (n) => { pedidas++; return n <= 11 ? jornadaFalsa(n) : jornadaFalsa(n).map((m) => ({ ...m, matchState: 1 })); };
const jug = (id, nickname, name, teamId, playerStatus, averagePoints, positionId, extra = {}) => ({ id, nickname, name, teamId, playerStatus, averagePoints, positionId, marketValue: 12e6, ...extra });
const jugadores = [jug('500', 'Zaid Romero', 'Zaid Romero', '13', 'ok', 5.9, 2), jug('501', 'Mayoral', 'Borja Mayoral', '13', 'doubtful', 4.6, 4),
  jug('502', 'Arambarri', 'Mauro Arambarri', '13', 'ok', 4.8, 3), jug('503', 'Uche', 'Christantus Uche', '13', 'injured', 4.1, 3),
  jug('504', 'Pepe', 'José Pepe', '20', 'ok', 4.2, 3)];
const equipos = Object.fromEntries(equiposIds.map((id) => [id, id === '13' ? 'Getafe CF' : id === '20' ? 'Málaga CF' : id === '9' ? 'Villarreal CF' : id === '1' ? 'FC Barcelona' : `Equipo ${id}`]));
const probs = async (teamId) => { probsPedidas++; return { 500: { p: 0.72 }, 501: { p: 0.33 }, 502: { p: 0.9 }, 503: { p: 0 }, 504: { p: 0.4 } }; };
const info = crearInfo({ jugadores, equipos, semana: { weekNumber: 12 }, pedirSemana, probs });
{
  const r1 = await info.rival({ rivalId: '1' }), r20 = await info.rival({ rivalId: '20' });
  ok(r1 && r1.pos === 1 && r1.nivel === 'difícil' && r20 && r20.pos === 20 && r20.nivel === 'fácil', `rival: ${JSON.stringify(r1)} ${JSON.stringify(r20)}`);
  ok(pedidas === 12, `la tabla pide las jornadas 1 a 12 una vez (${pedidas})`);
  await info.rival({ rivalId: '9' });
  ok(pedidas === 12, 'la tabla no se vuelve a pedir');
  const t1 = await info.titularidad(jugadores[0], { jornada: 12 }), t2 = await info.titularidad(jugadores[3], { jornada: 12 });
  await info.titularidad(jugadores[2], { jornada: 12 });
  ok(t1 && t1.pct === 72 && t2 === null && probsPedidas === 1, `titularidad: ${JSON.stringify(t1)} ${JSON.stringify(t2)} (${probsPedidas} pedidas)`);
  ok(await info.rival(null) === null && await info.rival({ rival: 'X' }) === null, 'sin partido o sin id de rival: nada');
}

// 3) las frases: con el puesto, el líder y el colista, y lo que marca o encaja solo si está entre los 4 de arriba o de abajo
{
  const R = (pos, nivel, extra = {}) => ({ pos, n: 20, nivel, gf: 2.4, gc: 0.6, rgf: 2, rgc: 19, ...extra });
  const d = { equipo: 'Getafe', rival: 'Barça', casa: false };
  ok(fraseRival(R(1, 'difícil'), d, 0) === '📉 Partido duro: el Getafe visita al Barça, el líder', fraseRival(R(1, 'difícil'), d, 0));
  ok(fraseRival(R(9, 'media'), { equipo: 'Getafe', rival: 'Villarreal', casa: true }, 1) === 'ℹ️ Partido de mitad de tabla: el Villarreal va 9º y el Getafe juega en casa', fraseRival(R(9, 'media'), { equipo: 'Getafe', rival: 'Villarreal', casa: true }, 1));
  ok(/: a domicilio, ante el Málaga \(colista\)$/.test(fraseRival(R(20, 'fácil'), { equipo: 'Getafe', rival: 'Málaga', casa: false }, 2)), fraseRival(R(20, 'fácil'), { equipo: 'Getafe', rival: 'Málaga', casa: false }, 2));
  ok(/uno de los de abajo/.test(fraseRival(R(18, 'fácil'), d, 2)) && /un rival asequible/.test(fraseRival(R(9, 'fácil'), d, 2)), 'de abajo solo si va abajo');
  ok(/marca 2,4 goles/.test(fraseGoles(R(1, 'difícil'), 2, 0).t) && fraseGoles(R(1, 'difícil'), 4, 0) && /menos encajan|solo encaja/.test(fraseGoles(R(1, 'difícil'), 4, 0).t), 'goles: al defensa lo que marca; al delantero lo que encaja');
  ok(fraseGoles(R(9, 'media', { rgf: 8, rgc: 10 }), 2, 0) === null, 'goles: nada si está en mitad de tabla');
  ok(/^📊 De momento|^📊 Otra cosa|^📊 Eso sí/.test(fraseTitularidad({ p: 0.3, pct: 30 }, 'vuelve', 0)), 'titularidad baja tras volver');
  // rotan: dos seguidos nunca con la misma forma
  const fs = Array.from({ length: 7 }, (_, k) => ideasInfo({ posId: 2, equipo: 'Getafe', pp: { rival: 'Barça', enCasa: false }, tit: { p: 0.72, pct: 72 }, riv: R(1, 'difícil'), k, dia: 'd' }).ideas.map((x) => x.t));
  for (let k = 1; k < fs.length; k++) ok(fs[k][0] !== fs[k - 1][0] && fs[k][1] !== fs[k - 1][1], `rotan (${k}): ${fs[k][0]} | ${fs[k][1]}`);
}

// 4) la fuente: club > LaLiga (si dice lo mismo que el tweet) > prensa
{
  const C = (x) => ({ medios: ['AS'], oficial: false, laliga: false, fam: 'buena', est: 'ok', ...x });
  ok(fuenteDe(C({ laliga: true })).quien === 'laliga' && !/AS/.test(fuenteDe(C({ laliga: true })).t), 'vuelve, un medio y LaLiga disponible: LaLiga, sin el medio');
  ok(fuenteDe(C({ oficial: true, medios: ['AS', 'MARCA'] })).quien === 'club' && !/AS|MARCA/.test(fuenteDe(C({ oficial: true })).t), 'oficial: el club');
  ok(fuenteDe(C({ medios: ['AS', 'MARCA'] })).quien === 'prensa' && /AS y MARCA/.test(fuenteDe(C({ medios: ['AS', 'MARCA'] })).t), 'solo prensa: los medios');
  ok(fuenteDe(C({ fam: 'mala', est: 'doubtful', laliga: true })).quien === 'laliga' && /duda/.test(fuenteDe(C({ fam: 'mala', est: 'doubtful', laliga: true })).t), 'duda en la prensa y en LaLiga: LaLiga');
  const m = fuenteDe(C({ fam: 'mala', est: 'doubtful', laliga: true }), { baja: true });
  ok(m.quien === 'prensa' && /AS; en LaLiga Fantasy ya sale como duda/.test(m.t), `baja en la prensa y duda en LaLiga: el medio y lo de LaLiga (${m.t})`);
  const ts = Array.from({ length: 6 }, (_, k) => fuenteDe(C({ medios: ['AS', 'MARCA'] }), { k, dia: 'd' }));
  for (let k = 1; k < ts.length; k++) ok(ts[k].t !== ts[k - 1].t, `la fuente rota (${k})`);
  ok(new Set(ts.map((x) => x.arriba)).size === 2, 'y cambia de sitio');
}

// 5) los tweets enteros (en 280 y en largo)
const ahora = Date.parse('2026-11-05T12:30:00Z');   // 13:30 en Madrid
const N = (medio, guid, titulo, entradilla, h = 1) => ({ medio, guid: `${medio}|${guid}`, titulo, entradilla, url: guid, t: ahora - h * 36e5 });
const prensa = [
  N('AS', 'z1', 'Zaid Romero vuelve a los planes del Getafe', 'El central recibe el alta tras un mes fuera'),
  N('MARCA', 'm1', 'Mayoral, con molestias', 'El delantero del Getafe se entrena al margen'),
  N('AS', 'm2', 'Mayoral no se entrena con el grupo', 'Molestias en el gemelo para el delantero'),
  N('AS', 'u1', 'Parte médico del Getafe: Uche', 'El club informa en un parte médico de que Uche sufre una rotura y estará 4 semanas de baja'),
  N('AS', 'a1', 'Arambarri, tocado', 'El centrocampista del Getafe arrastra molestias'),
];
const R = {
  'Zaid Romero vuelve a los planes del Getafe': { que: 'vuelve', hecho: 'Zaid Romero vuelve a los planes tras un mes', motivo: '', plazo: '', oficial: false },
  'Mayoral, con molestias': { que: 'molestias', hecho: 'Mayoral arrastra molestias', motivo: 'molestias en el gemelo', plazo: '' },
  'Mayoral no se entrena con el grupo': { que: 'molestias', hecho: 'Mayoral se entrena aparte', motivo: 'molestias en el gemelo', plazo: '' },
  'Parte médico del Getafe: Uche': { que: 'lesion', hecho: 'Uche se rompe y estará un mes fuera', motivo: 'rotura muscular', plazo: 'estará 4 semanas de baja', oficial: true },
  'Arambarri, tocado': { que: 'molestias', hecho: 'Arambarri arrastra molestias', motivo: 'molestias musculares', plazo: '' },
};
const pedirIA = async ({ prompt }) => {
  const lote = JSON.parse(prompt.slice(prompt.indexOf('Noticias:\n') + 10));
  return { ok: true, modelo: 'falso', datos: { noticias: lote.map((x) => ({ i: x.i, jugadorId: x.candidatos[0].id, otraCompeticion: false, seguro: true, oficial: false, ...(R[x.titular] || { que: 'nada', hecho: '', motivo: '', plazo: '' }) })) } };
};
const proximo = async () => ({ jornada: 12, rival: 'Villarreal', rivalId: '9', enCasa: true, fecha: '2026-11-08T17:30:00Z' });
const config = { topes: { noticias: 15, novedades: 20, caidas: 9 }, topeDiario: 40, maxPorEjecucion: 6, noticiasPorEjecucion: 6, geminiDia: 60 };
// Arambarri: un medio y la lista de lesionados de las webs de previas (no se nombra) dice duda
const listaPartes = [{ nombre: 'Mauro Arambarri', slug: 'arambarri', estado: 'duda', lesion: 'Molestias musculares' }];
const sinSegunTrasCifra = (t) => ok(!segunTrasCifra(t.texto), `${t.clave}: «según» detrás de una cifra\n${t.texto}`);

for (const lim of [280, 1000]) {
  enModo(lim);
  const reg = new Registro(config);
  reg.fichero = null;
  // LaLiga le quitó la marca de lesionado a Zaid hace una hora (desde.t reciente) y Mayoral ya sale como duda desde hace poco
  reg.datos.noticias = { vistas: {}, hechos: [], gemini: { dia: '', n: 0 }, desde: { 500: { e: 'ok', t: ahora - 36e5 }, 501: { e: 'doubtful', t: ahora - 2 * 36e5 }, 502: { e: 'ok', t: 0 }, 503: { e: 'injured', t: ahora - 36e5 } } };
  const ts = await noticias({ jugadores, equipos, jornada: 12, config, registro: reg, ventanas: false, ahora, log: () => {}, proximo, pedirIA, clave: 'falsa', listaPartes, leer: async () => prensa, info });
  console.log(`\n=== noticias en ${lim}`);
  for (const t of ts) { const v = validar(t.texto, { numeros: t.numeros, max: lim }); if (!v.ok) falla(`${t.clave} (${lim}): ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}\n${t.texto}`); sinSegunTrasCifra(t); }
  const de = (id) => ts.find((t) => t.clave.includes(`|${id}:`));
  const z = de('500'), m = de('501'), u = de('503'), a = de('502');
  ok(z && /LaLiga Fantasy/.test(z.texto) && !/\bAS\b/.test(z.texto) && /✅ Disponible para la jornada 12 contra el Villarreal/.test(z.texto), `Zaid (${lim}): la fuente es LaLiga, no AS`);
  ok(z && /72 %/.test(z.texto), `Zaid (${lim}): con su % de titularidad`);
  if (lim > 280) ok(z && /9º/.test(z.texto) && /\n\n.*72 %/s.test(z.texto), `Zaid (largo): el rival y lo del partido en su párrafo`);
  ok(m && /(Lo cuentan|Lo publican) (AS y MARCA|MARCA y AS)|(AS y MARCA|MARCA y AS) lo dan por hecho|LaLiga Fantasy/.test(m.texto) && /⁉️ Duda para/.test(m.texto), `Mayoral (${lim}): duda con su fuente`);
  ok(m && /33 %/.test(m.texto), `Mayoral (${lim}): duda en LaLiga, con el % de la app`);
  // (Carlos, 5 nov 16:39) el % también en la carta: el que vuelve, en la carta; la duda, en el estado; la baja, sin %
  const fc = (t) => t && t.tarjeta && t.tarjeta.d.filas[0];
  ok(fc(z) && fc(z).estado === 'disponible' && fc(z).pct === 72 && fc(m) && fc(m).pct === 33 && fc(u) && fc(u).pct === null, `% en la carta (${lim}): ${[z, m, u].map((t) => fc(t) && fc(t).pct).join(', ')}`);
  ok(z && z.tarjeta.permitidos.numeros.includes('72') && z.tarjeta.permitidos.palabras.includes('TITULARIDAD'), 'la carta deja el % y «TITULARIDAD» al validador');
  ok(u && /club/.test(u.texto) && !/\bAS\b/.test(u.texto) && !/ %|º/.test(u.texto) && /❌ Baja/.test(u.texto), `Uche (${lim}): oficial, el club; baja sin % ni rival`);
  ok(a && /\bAS\b/.test(a.texto) && !/LaLiga Fantasy/.test(a.texto) && !/ % de titularidad|en Fantasy Manager/.test(a.texto), `Arambarri (${lim}): un medio y el parte, el medio; en LaLiga «ok», sin %`);
  // el % y el rival no se piden para un tweet que no va a salir
  const reg2 = new Registro({ ...config, topes: { noticias: 0 } });
  reg2.fichero = null;
  reg2.datos.noticias = JSON.parse(JSON.stringify(reg.datos.noticias));
  reg2.datos.noticias.vistas = {}; reg2.datos.noticias.hechos = [];
  let pedido = 0;
  const espia = { rival: async (pp) => { pedido++; return info.rival(pp); }, titularidad: async (j, pp) => { pedido++; return info.titularidad(j, pp); } };
  await noticias({ jugadores, equipos, jornada: 12, config: reg2.config, registro: reg2, ventanas: false, ahora, log: () => {}, proximo, pedirIA, clave: 'falsa', listaPartes, leer: async () => prensa, info: espia });
  ok(pedido === 0, `con el tope gastado no se piden datos (${pedido})`);

  // novedades: vuelve con % y rival; una lesión, sin nada de eso
  const regN = new Registro(config);
  regN.fichero = null;
  regN.datos.estados = { 504: 'injured', 502: 'ok' };
  const jugN = jugadores.map((j) => (j.id === '502' ? { ...j, playerStatus: 'injured' } : j));
  const nv = await novedades({ jugadores: jugN, equipos, jornada: 12, config, registro: regN, ventanas: false, ahora, log: () => {}, proximo, listaPartes: [], soloSeguras: false, info });
  console.log(`\n=== novedades en ${lim}`);
  for (const t of nv) { const v = validar(t.texto, { numeros: t.numeros, max: lim }); if (!v.ok) falla(`${t.clave} (${lim}): ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}\n${t.texto}`); }
  // dos cambios a la vez (Pepe vuelve, Arambarri se lesiona) van juntos: el agrupado no lleva % ni rival
  ok(nv.length === 1 && !/ % de titularidad/.test(nv[0].texto), `novedades de varios: sin % ni rival (${nv.map((t) => t.clave).join(', ')})`);
  const regS = new Registro(config);
  regS.fichero = null;
  regS.datos.estados = { 504: 'injured' };
  const solo = await novedades({ jugadores, equipos, jornada: 12, config, registro: regS, ventanas: false, ahora, log: () => {}, proximo, listaPartes: [], soloSeguras: false, info });
  for (const t of solo) { const v = validar(t.texto, { numeros: t.numeros, max: lim }); if (!v.ok) falla(`${t.clave} (${lim}): ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}\n${t.texto}`); }
  ok(solo[0] && solo[0].tarjeta.d.filas[0].pct === 40, `Pepe (${lim}): el % en la carta`);
  ok(solo.length === 1 && /40 %/.test(solo[0].texto) && /✅ Disponible para la jornada 12 contra el Villarreal/.test(solo[0].texto), `Pepe vuelve (${lim}): con su %`);
  if (lim > 280) ok(solo[0] && /9º/.test(solo[0].texto) && /Se juega|Será/.test(solo[0].texto), 'Pepe (largo): el rival y la hora sin «El partido es» detrás de «Partido…»');
  // sin info (las pruebas de antes y un fallo de red): como antes
  const regV = new Registro(config);
  regV.fichero = null;
  regV.datos.estados = { 504: 'injured' };
  const viejo = await novedades({ jugadores, equipos, jornada: 12, config, registro: regV, ventanas: false, ahora, log: () => {}, proximo, listaPartes: [], soloSeguras: false });
  ok(viejo.length === 1 && !/ %/.test(viejo[0].texto), 'sin info: sin %');
}
enModo(limiteInicial);

// 6) pulir no deja pegar «según AS» detrás de la media
{
  const orig = '✅ Zaid Romero vuelve a los planes tras un mes, según AS. El defensa del Getafe suma 5,9 puntos de media.\n\n✅ Disponible para la jornada 12 contra el Villarreal';
  const malo = '✅ Zaid Romero vuelve a los planes tras un mes y el defensa del Getafe suma 5,9 puntos de media, según AS.\n\n✅ Disponible para la jornada 12 contra el Villarreal';
  const e = revisar(orig, malo, { numeros: [5, 9, 12], nombres: ['zaid romero', 'getafe', 'villarreal'], tipo: 'noticias' });
  ok(e.includes('«según» detrás de una cifra'), `pulir: ${e.join('; ')}`);
  ok(!revisar(orig, orig, { numeros: [5, 9, 12], nombres: ['zaid romero', 'getafe', 'villarreal'], tipo: 'noticias' }).includes('«según» detrás de una cifra'), 'pulir: la plantilla vale');
}
ok(vecesHoy(null, 'x') === 0, 'vecesHoy sin registro');
void turno;
console.log(`\n${fallos ? `${fallos} FALLOS` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
