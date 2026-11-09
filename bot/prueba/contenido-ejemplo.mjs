// Pruebas sin red del contenido del bot (revisión total, sesión 7: A10, M12, M13 y M14).
// A10: lo inventado que pasaba (los 7 casos del Valencia 0-3 Madrid del 7 nov) y el revisor que fallaba abierto.
// M12: lo bueno que el validador tiraba («colista» y «líder» verdaderos, «lo ha comunicado el club», «baja los brazos», «Partido
// redondo»), la regla única de la prensa y los puntos «de momento» en directo. M14: respeto, ausencias personales y BOT_SIN_FOTOS.
import { revisar, decimalesSinHechos, cifrasCambiadas, conMayuscula, prompt as pedido } from '../lib/redaccion.mjs';
import { revisarConIA, prompt as pedidoRevisor, SISTEMA } from '../lib/revisor.mjs';
import { reglaPrensa, PRENSA_SIN_MEDIO } from '../lib/prensa.mjs';
import { nombresDe } from '../lib/pulir.mjs';
import { clubes, jugador } from '../lib/hechos.mjs';
import { esPersonal, motivoPersonal, fijarLimite } from '../lib/texto.mjs';
import { lesionTxt } from '../lib/partes.mjs';
import { sinFotos, sinFotosDe } from '../lib/con-tarjetas.mjs';
import { GUIA } from '../lib/voz.mjs';
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
fijarLimite(1000);
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));

// los de LaLiga que pueden salir (nombres de verdad; Redondo es del Elche y Hugo Duro del Valencia)
const jugadoresLL = ['Mbappé', 'Valverde', 'Arda Güler', 'Gayá', 'Redondo', 'Mendy', 'Hugo Duro', 'Vinícius Jr.', 'Pepelu'].map((nickname) => ({ nickname }));
const equipos = { 1: 'Valencia CF', 2: 'Real Madrid', 3: 'Elche CF', 4: 'Getafe CF' };
const todos = nombresDe(jugadoresLL, equipos);

// el final del Valencia 0-3 Madrid (7 nov), como lo monta tipos/final.mjs
const hFinal = {
  tipo: 'final', jornada: 12,
  partido: { partido: 'Valencia-Madrid', local: 'Valencia', visitante: 'Madrid', estadio: 'Mestalla', marcador: '0-3' },
  goles: [{ minuto: "36'", para: 'Madrid', goleador: 'Arda Güler', marcador: '0-1' }, { minuto: "58'", para: 'Madrid', goleador: 'Mbappé', marcador: '0-2' },
    { minuto: "75'", para: 'Madrid', goleador: 'Mbappé', marcador: '0-3' }],
  incidencias: [],
  jugadores: [
    { nombre: 'Mbappé', club: 'Madrid', puntos: 16, mediaPuntos: '8,4', principal: true, tambienSeLeLlama: ['la Tortuga'] },
    { nombre: 'Arda Güler', club: 'Madrid', puntos: 11, mediaPuntos: '4,7', principal: false },
    { nombre: 'Valverde', club: 'Madrid', puntos: 5, mediaPuntos: '6,3', principal: false },
  ],
  antesDelPartido: { Valencia: '20º', Madrid: '1º' },
  clubes: clubes('Valencia', 'Madrid'), etiqueta: '',
};
const rf = (t, h = hFinal) => revisar(t, { hechos: h, todos, numeros: [] });
const pasa = (t, h) => { const e = rf(t, h); return e.length ? e.join(' | ') : ''; };

console.log('--- A10: lo inventado ya no pasa ---');
const base = 'El Madrid gana 0-3 en Mestalla con doblete de Mbappé, que se va a 16 puntos.';
ok(!pasa(base), `de partida, un final correcto pasa (${pasa(base)})`);
// 1 y 2. los puntos cambiados entre Valverde y Arda, en la misma frase y en dos
let e = rf(`${base} Arda Güler se queda en 5 y Valverde suma 11.`);
ok(e.some((x) => /cada cifra con su jugador/.test(x)), `puntos cambiados en una frase (${e.join(' | ')})`);
e = rf(`${base} Valverde firmó 11 puntos. Arda Güler, 5.`);
ok(e.some((x) => /cada cifra con su jugador/.test(x)), `puntos cambiados en dos frases (${e.join(' | ')})`);
ok(!pasa(`${base} Arda Güler, que abrió el marcador, se va a 11 y Valverde se queda en 5.`), 'cada uno con sus puntos, vale');
ok(!pasa(`${base} Arda Güler y Valverde suman 11 y 5.`), 'una lista de nombres con sus cifras detrás, vale');
// 3. «Mbappé se marchó lesionado» sin lesión en los hechos
e = rf(`${base} Eso sí, Mbappé se marchó lesionado.`);
ok(e.some((x) => /lesión/.test(x)), `una lesión que no está en los hechos (${e.join(' | ')})`);
// 4. «Arda Güler, sin marcar» con su gol en los hechos
e = rf(`${base} Arda Güler, sin marcar, se queda en 11.`);
ok(e.some((x) => /no marcó/.test(x)), `«sin marcar» de uno que marca (${e.join(' | ')})`);
// 5. «3,6 de media» por 6,3
e = rf(`${base} Valverde, con 3,6 de media, se queda en 5.`);
ok(e.some((x) => /decimales/.test(x)), `«3,6» por 6,3 (${e.join(' | ')})`);
ok(decimalesSinHechos('con 6,3 de media', hFinal).length === 0 && decimalesSinHechos('con 3,6 de media', hFinal)[0] === '3,6', 'decimalesSinHechos: el 6,3 sí, el 3,6 no');
// 6. «Es oficial» con solo AS
const hNot = { tipo: 'noticias', noticia: 'Gayá tiene molestias en el aductor', fuente: 'prensa: AS',
  jugadores: [{ nombre: 'Gayá', club: 'Valencia', estado: 'duda', motivo: 'molestias en el aductor', principal: true }], clubes: clubes('Valencia'), etiqueta: '⁉️ Duda para la jornada 13' };
e = revisar('Es oficial: Gayá arrastra molestias en el aductor, según AS.', { hechos: hNot, todos });
ok(e.some((x) => /oficial/.test(x)), `«Es oficial» con solo AS (${e.join(' | ')})`);
ok(!revisar('Gayá arrastra molestias en el aductor, según AS.', { hechos: hNot, todos }).some((x) => /oficial/.test(x)), 'sin «oficial», la misma noticia vale');
// 7. «entrada criminal»
e = rf(`${base} La roja a Gayá llegó por una entrada criminal.`);
ok(e.some((x) => /respeto/.test(x)), `«entrada criminal» (${e.join(' | ')})`);
ok(!rf(`${base} Valverde se queda en 5 tras una entrada muy dura.`).some((x) => /respeto/.test(x)), '«una entrada muy dura» sí vale');
// la primera palabra de una frase también es un nombre
e = rf(`${base} Mendy se quedó en el banquillo.`);
ok(e.some((x) => /Mendy|mendy/.test(x)), `un nombre de LaLiga de arranque que no está en los hechos (${e.join(' | ')})`);

console.log('--- A10: el revisor falla cerrado ---');
let rr = await revisarConIA({ texto: 'x', hechos: hFinal, config, pedir: async () => ({ ok: false, error: '529 Overloaded' }) });
ok(!rr.ok && rr.caido, 'con el revisor devolviendo 529, «Mbappé se marchó lesionado» ya no sale');
rr = await revisarConIA({ texto: 'x', hechos: hFinal, config: { ...config, ia: { ...config.ia, proveedor: 'gemini' } } });
ok(!rr.ok && rr.caido, 'sin Claude, tampoco sale sin segunda lectura');
rr = await revisarConIA({ texto: 'x', hechos: hFinal, config: { ...config, revisor: { activo: false } } });
ok(rr.ok && !rr.revisado, 'solo con revisor.activo a false sale sin revisar');
ok(/RESPETO/.test(SISTEMA) && /entrada criminal/.test(SISTEMA), 'el revisor marca las faltas de respeto');

console.log('--- A10: el directo ---');
const hDir = { tipo: 'directo', subtipo: 'gol', jornada: 12, minuto: "36'",
  partido: { partido: 'Valencia-Madrid', local: 'Valencia', visitante: 'Madrid', estadio: 'Mestalla', marcadorEnEseMomento: '0-1', estadoDelPartido: 'en juego' },
  jugadores: [{ nombre: 'Arda Güler', club: 'Madrid', mediaPuntos: '4,7', queLePasa: 'marca', puntosFantasyAhora: 7, principal: true }],
  clubes: clubes('Valencia', 'Madrid'), etiqueta: '' };
const rd = (t, h = hDir) => revisar(t, { hechos: h, todos, numeros: [36, 0, 1, 7] });
ok(!rd('⚽ Arda Güler adelanta al Madrid en Mestalla en el 36\'. Ya suma 7 puntos.').length, `un gol en directo con sus cifras, vale (${rd('⚽ Arda Güler adelanta al Madrid en Mestalla en el 36\'. Ya suma 7 puntos.').join(' | ')})`);
e = rd('⚽ Arda Güler adelanta al Madrid en el 36\'. Con una media de 4,7, se va a 7 puntos de momento.');
ok(e.some((x) => /tuit de partida/.test(x)), `en directo, una cifra que la plantilla no tiene (la media), fuera (${e.join(' | ')})`);
e = rd('⚽ Doblete de Arda Güler en el 36\'. El Madrid gana 0-1 y él ya suma 7 puntos.');
ok(e.some((x) => /doblete/.test(x)), `en directo, un doblete que no es (${e.join(' | ')})`);
e = rd('⚽ Arda Güler adelanta al Madrid en el 36\' y se queda en 7 puntos.');
ok(e.some((x) => /de momento/.test(x)), `en juego, los puntos sin «de momento», fuera (${e.join(' | ')})`);
ok(!rd('⚽ Arda Güler adelanta al Madrid en el 36\' y se va a 7 puntos de momento.').some((x) => /de momento/.test(x)), 'con «de momento», vale');
ok(!rd('⚽ Arda Güler adelanta al Madrid en el 36\' y se queda en 7 puntos.', { ...hDir, partido: { ...hDir.partido, estadoDelPartido: 'acabado' } }).some((x) => /de momento/.test(x)), 'con el partido acabado, no hace falta');
ok(/SIGUE EN JUEGO/.test(pedido({ hechos: hDir, max: 260 })), 'al redactar el directo se le dice que los puntos son de momento');

console.log('--- M12: lo bueno que se tiraba ---');
ok(!pasa(`${base} El Valencia, colista, no tuvo respuesta.`), `«colista» verdadero en un final (antesDelPartido) (${pasa(`${base} El Valencia, colista, no tuvo respuesta.`)})`);
ok(!pasa(`${base} El líder no perdona.`.replace('El líder', 'El Madrid, líder,')), '«líder» verdadero en un final');
ok(rf(`${base} El Valencia, colista, no tuvo respuesta.`, { ...hFinal, antesDelPartido: { Valencia: '14º', Madrid: '1º' } }).some((x) => /colista/.test(x)), '«colista» falso, fuera');
const hOf = { ...hNot, fuente: 'lo ha comunicado el club', jugadores: [{ ...hNot.jugadores[0], estado: 'baja' }], etiqueta: '❌ Baja para la jornada 13' };
e = revisar('Gayá se pierde el próximo partido por unas molestias en el aductor, como lo ha comunicado el club.', { hechos: hOf, todos });
ok(!e.some((x) => /vaga|oficial/.test(x)), `«lo ha comunicado el club» con la fuente del club, vale (${e.join(' | ')})`);
const hGet = { tipo: 'previa', partido: { partido: 'Getafe-Valencia', local: 'Getafe', visitante: 'Valencia' },
  jugadores: [{ nombre: 'Hugo Duro', club: 'Valencia', mediaPuntos: '5,1', principal: true }], clubes: clubes('Getafe', 'Valencia'), etiqueta: '' };
e = revisar('🗓️ Hugo Duro llega al Getafe-Valencia en buena forma. El Valencia no baja los brazos.', { hechos: hGet, todos });
ok(!e.some((x) => /baja/.test(x)), `«no baja los brazos» no es una baja (${e.join(' | ')})`);
e = rf(`${base} Partido redondo de Mbappé.`);
ok(!e.some((x) => /redondo/i.test(x)), `«Partido redondo» no es Redondo, del Elche (${e.join(' | ')})`);
ok(rf(`${base} Redondo, del Elche, mira desde casa.`).some((x) => /redondo/i.test(x)), 'Redondo con mayúscula sí es un nombre');
ok(conMayuscula('Gran gol de Redondo', 'redondo') && !conMayuscula('partido redondo', 'redondo'), 'conMayuscula');

console.log('--- M12: una sola regla de la prensa ---');
const cron = [{ medio: 'AS', titulo: 'Ancelotti, feliz', entradilla: 'El técnico elogió a Arda' }, { medio: 'MARCA', titulo: 'Arda, la clave', entradilla: 'Ancelotti destacó al turco' }];
const pr = pedidoRevisor({ texto: 'x', hechos: hFinal, tipo: 'final', cronicas: cron });
ok(pr.includes(reglaPrensa('final')) && pedido({ hechos: hFinal, max: 500, cronicas: cron }).includes(reglaPrensa('final')), 'quien redacta y el revisor leen la misma regla en el final');
ok(!/solo en noticias y previas/.test(SISTEMA), 'el revisor ya no dice «solo en noticias y previas» (tiraba los finales que usaban bien la prensa)');
ok(PRENSA_SIN_MEDIO.has('final') && PRENSA_SIN_MEDIO.has('mvp') && !PRENSA_SIN_MEDIO.has('previa') && /medio pegado/.test(reglaPrensa('previa')) && /SIN nombrar/.test(reglaPrensa('mvp')), 'final y MVP sin medio; la previa, con el medio pegado');
ok(config.redactar.prensa.every((t) => typeof reglaPrensa(t) === 'string'), 'los tipos con prensa de config.json tienen regla');

console.log('--- M14: ausencias personales, respeto y sin fotos ---');
ok(esPersonal('Gayá no viaja por motivos personales') && esPersonal('fallece el padre de Pepelu') && !esPersonal('rotura de fibras en el isquiotibial') && !esPersonal('gripe'), 'esPersonal');
ok(motivoPersonal('ingresado en el hospital por una arritmia') === 'motivos de salud' && motivoPersonal('asuntos familiares') === 'motivos personales', 'motivoPersonal, sin detalles');
ok(lesionTxt({ lesion: 'Fallecimiento de un familiar' }) === 'motivos personales' && lesionTxt({ lesion: 'Rotura fibrilar' }) === 'rotura fibrilar', 'el parte de lesionados no cuenta el detalle personal');
const jP = jugador({ nickname: 'Pepelu', positionId: 3, teamId: 1 }, { equipos, estado: 'baja', motivo: 'motivos personales', datos: false });
ok(/sin consejo/.test(jP.trato || ''), 'un jugador fuera por motivos personales lleva «trato» para la IA');
ok(/Respeto a las personas/.test(GUIA) && /trato/.test(GUIA), 'la guía de voz pide respeto y el trato');
const hSob = { tipo: 'noticias', noticia: 'Pepelu no estará por motivos personales', sobrio: true, fuente: 'lo ha comunicado el club', jugadores: [{ ...jP, principal: true }], clubes: clubes('Valencia'), etiqueta: '❌ Baja para la jornada 13' };
ok(revisar('🚨 Pepelu no estará por motivos personales, según ha comunicado el club.', { hechos: hSob, todos }).some((x) => /sobrio/.test(x)), 'sobrio: sin emojis');
ok(!revisar('Pepelu no estará por motivos personales, según ha comunicado el club.', { hechos: hSob, todos }).length, `sobrio y sin detalles, vale (${revisar('Pepelu no estará por motivos personales, según ha comunicado el club.', { hechos: hSob, todos }).join(' | ')})`);
{ // una noticia de una ausencia personal, de la prensa al tuit (prensa y clasificador falsos)
  const { generar: noticias } = await import('../tipos/noticias.mjs');
  const { Registro } = await import('../lib/registro.mjs');
  const ahora = Date.parse('2026-11-03T14:00:00Z');
  const N = (medio, guid, titulo, entradilla) => ({ medio, guid: `${medio}|${guid}`, titulo, entradilla, url: guid, t: ahora - 36e5 });
  const prensa = [N('AS', 'p1', 'Pepelu no viaja a Getafe', 'El centrocampista se queda en Valencia tras el fallecimiento de su abuelo'),
    N('MARCA', 'p2', 'Baja sensible en el Valencia', 'Pepelu no estará ante el Getafe por motivos familiares')];
  // la IA contesta con el detalle (lo que no debe salir) y, en una de las dos, sin marcarla como personal: las palabras la cazan igual
  const pedirIA = async ({ prompt }) => { const lote = JSON.parse(prompt.slice(prompt.indexOf('Noticias:\n') + 10));
    return { ok: true, modelo: 'falso', datos: { noticias: lote.map((x) => ({ i: x.i, jugadorId: x.candidatos[0].id, que: 'descartado', otraCompeticion: false, seguro: true, oficial: false,
      personal: x.i === 0, hecho: 'Pepelu no viaja tras la muerte de su abuelo', motivo: 'fallecimiento de su abuelo', plazo: '' })) } }; };
  const cfgN = { topes: { noticias: 15 }, topeDiario: 40, maxPorEjecucion: 6, noticiasPorEjecucion: 4, geminiDia: 60 };
  const reg = new Registro(cfgN); reg.fichero = null;
  const ts = await noticias({ jugadores: [{ id: '20', nickname: 'Pepelu', name: 'José Luis García Vayá', teamId: 1, playerStatus: 'ok', averagePoints: 5.5, positionId: 3, marketValue: 9e6 }],
    equipos, jornada: 12, config: cfgN, registro: reg, ventanas: false, ahora, log: () => {}, proximo: async () => ({ jornada: 12, rival: 'Getafe' }), pedirIA, clave: 'falsa', listaPartes: [], leer: async () => prensa });
  const t = ts[0];
  ok(t && /^Pepelu no estará por motivos personales/.test(t.texto) && !/abuelo|fallec|muerte/i.test(t.texto) && /Baja para la jornada 12/.test(t.texto), `ausencia personal: sobria, sin detalles y con la etiqueta (${t ? t.texto.replace(/\n+/g, ' / ') : 'no sale'})`);
  ok(t && t.hechos.sobrio && !/abuelo/.test(JSON.stringify(t.hechos)) && !t.tarjeta && !t.hechos.partido, 'ausencia personal: hechos sobrios, sin el detalle, sin tarjeta ni partido para el consejo');
}
{
  const viejo = process.env.BOT_SIN_FOTOS;
  process.env.BOT_SIN_FOTOS = '1';
  ok(sinFotos({}) && sinFotos({ sinFotos: true }), 'BOT_SIN_FOTOS=1 enciende el interruptor');
  delete process.env.BOT_SIN_FOTOS;
  ok(!sinFotos({}) && sinFotos({ sinFotos: true }), 'sin la variable, solo con config.sinFotos');
  if (viejo != null) process.env.BOT_SIN_FOTOS = viejo;
  const pedidas = [];
  const f = sinFotosDe({ imagen: async (u) => { pedidas.push(u); return Buffer.from('png'); } });
  const a = await f.imagen('https://assets-fantasy.llt-services.com/players/1/cara.png');
  const b = await f.imagen('https://images.fotmob.com/image_resources/logo/teamlogo/6720.png');
  ok(a === null && b && pedidas.length === 1 && /fotmob/.test(pedidas[0]), 'sin fotos: nada de assets-fantasy; las banderas de FotMob, sí');
}

console.log('--- M13 ---');
const apodos = readFileSync(new URL('../lib/apodos-jugadores.mjs', import.meta.url), 'utf8');
ok(!/pendiente del OK de Carlos/.test(apodos), 'apodos-jugadores.mjs ya no dice «pendiente del OK de Carlos»');

console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
