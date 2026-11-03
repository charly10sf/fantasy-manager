// Prueba de las noticias de prensa sin red: RSS y Gemini falsos.
//   node bot/prueba/noticias-ejemplo.mjs
// Casos: una sola fuente espera; dos medios publican; un medio + LaLiga publica; lo de Champions no cuenta; una frase de Gemini que
// copia el titular se tira; quien ya salió en novedades no se repite; y novedades no repite a quien ya contó la prensa.
import { generar as noticias, frase, candidatos, copia, yaJugo } from '../tipos/noticias.mjs';
import { generar as novedades } from '../tipos/novedades.mjs';
import { leerRss } from '../lib/prensa.mjs';
import { validar } from '../lib/validar.mjs';
import { ordenar } from '../lib/gemini.mjs';
import { Registro } from '../lib/registro.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const ok = (c, m) => { if (!c) falla(m); };
const ver = (titulo, ts) => {
  console.log(`\n=== ${titulo}`);
  for (const t of ts) { const v = validar(t.texto, { numeros: t.numeros }); if (!v.ok) falla(`${t.clave}: ${v.errores.join('; ')}`); console.log(`--- ${t.clave} · peso ${v.peso}${t.tarjeta ? ` · tarjeta ${t.tarjeta.d.filas[0].estado}` : ''}\n${t.texto}`); }
};

// 1) el RSS: entidades dobles, CDATA y etiquetas dentro de la entradilla
const xml = `<rss><channel><item><title><![CDATA[Andrés Martín se ha roto]]></title><link>https://as.com/a</link><guid>a1</guid><pubDate>Tue, 03 Nov 2026 13:14:17 GMT</pubDate>
<description>&lt;b&gt;El extremo&lt;/b&gt; sufre una rotura de fibras&amp;nbsp;y estará 4 semanas de baja</description></item></channel></rss>`;
const r = leerRss(xml, 'AS');
ok(r.length === 1 && r[0].titulo === 'Andrés Martín se ha roto' && r[0].entradilla === 'El extremo sufre una rotura de fibras y estará 4 semanas de baja' && r[0].t === Date.parse('2026-11-03T13:14:17Z'), `leerRss: ${JSON.stringify(r)}`);

// 2) frases de Gemini
const fuente = 'Andrés Martín se ha roto. El extremo sufre una rotura de fibras en los isquiotibiales y estará 4 semanas de baja';
ok(frase('Andrés Martín se rompe y estará un mes fuera', { fuente, debeLlevar: ['andres martin'] }) !== '', 'frase buena');
ok(frase('Andrés Martín sufre una rotura de fibras en los isquiotibiales', { fuente, debeLlevar: ['andres martin'] }) === '', 'copia 6 palabras');
ok(frase('Estará 6 semanas fuera', { fuente }) === '', 'cifra que no está');
ok(frase('Estará 4 semanas fuera', { fuente }) !== '', 'cifra que sí está');
ok(frase('Según MARCA, se rompe', { fuente }) === '', 'nombra al medio');
ok(frase('Se rompe y estará fuera', { fuente, debeLlevar: ['andres martin'] }) === '', 'sin el nombre');
ok(copia('uno dos tres cuatro cinco seis', 'x uno dos tres cuatro cinco seis y'), 'copia');

// 3) el ciclo entero
const equipos = { 1: 'Real Racing Club', 2: 'Real Madrid', 3: 'Villarreal CF', 4: 'FC Barcelona' };
const J = (id, nickname, name, teamId, playerStatus, averagePoints, positionId = 3) => ({ id, nickname, name, teamId, playerStatus, averagePoints, positionId, marketValue: 20e6 });
const jug = [J('10', 'Andrés Martín', 'Andrés Martín García', 1, 'ok', 6.2), J('11', 'Güler', 'Arda Güler', 2, 'ok', 5.1), J('12', 'G. Moreno', 'Gerard Moreno Balagueró', 3, 'injured', 5.8, 4),
  J('13', 'Pedri', 'Pedro González López', 4, 'doubtful', 6.5), J('14', 'Ayoze', 'Ayoze Pérez Gutiérrez', 3, 'ok', 4.4, 4), J('15', 'Cucho', 'Juan Camilo Hernández', 3, 'injured', 5.2, 4)];
const orden = ordenar(['gemini-2.5-flash', 'gemini-3.8-flash-lite', 'gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-2.5-flash-preview-tts', 'gemini-flash-lite-latest']).join(' ');
ok(orden === 'gemini-3.8-flash gemini-3.8-flash-lite gemini-3.7-flash gemini-flash-latest gemini-flash-lite-latest gemini-3-flash-preview gemini-2.5-flash', `orden de los modelos: ${orden}`);
ok(candidatos({ titulo: 'Gerard Moreno vuelve a entrenar', entradilla: '' }, jug, equipos).length === 0, 'G. Moreno sin el club no casa');
ok(candidatos({ titulo: 'Moreno vuelve a entrenar con el Villarreal', entradilla: '' }, jug, equipos).length === 1, 'G. Moreno con el club casa');
// una convocatoria con cinco o más nombres: solo los del titular
{ const ent = 'Andrés Martín, Güler, Pedri, Ayoze y Cucho, en la lista';
  const c1 = candidatos({ titulo: 'Convocatoria: vuelven Pedri y Ayoze', entradilla: ent }, jug, equipos).map((j) => j.nickname).join(',');
  ok(c1 === 'Pedri,Ayoze', `convocatoria, solo los del titular: ${c1}`);
  ok(candidatos({ titulo: 'La lista para el miércoles', entradilla: ent }, jug, equipos).length === 0, 'convocatoria sin nadie en el titular: nada'); }
// ya jugó en un partido acabado antes de la noticia: una vuelta no es noticia
{ const st = [{ matchState: 7, date: '2026-11-02T20:00:00+00:00', local: { players: [{ id: '14', weekPoints: 6 }, { id: '11', weekPoints: 0 }] }, visitor: { players: [] } }];
  ok(yaJugo({ id: '14' }, st, Date.parse('2026-11-03T08:00:00Z')), 'yaJugo: jugó antes');
  ok(!yaJugo({ id: '14' }, st, Date.parse('2026-11-02T10:00:00Z')), 'yaJugo: la noticia es de antes del partido');
  ok(!yaJugo({ id: '11' }, st, Date.parse('2026-11-03T08:00:00Z')), 'yaJugo: convocado sin puntos'); }
const ahora = Date.parse('2026-11-03T14:00:00Z');   // 15:00 en Madrid
const N = (medio, guid, titulo, entradilla, h = 1) => ({ medio, guid: `${medio}|${guid}`, titulo, entradilla, url: guid, t: ahora - h * 36e5 });
let prensa = [
  N('AS', 'a1', 'Andrés Martín se ha roto', 'El extremo sufre una rotura de fibras en los isquiotibiales y estará 4 semanas de baja'),
  N('MARCA', 'm1', 'Mourinho da descanso a Güler para Atenas', 'Ninguno viaja para medirse al AEK en Champions'),
  N('MARCA', 'm2', 'Gerard Moreno no se entrena con el Villarreal', 'Molestias en el sóleo'),
  N('Mundo Deportivo', 'd1', 'Pedri entrena al margen', 'El canario arrastra molestias en el isquiotibial', 2),
  N('AS', 'a9', 'El Racing presenta su nueva camiseta', 'Sin jugadores'),
  N('Mundo Deportivo', 'd2', 'Ayoze vuelve a una convocatoria', 'Supera sus problemas'),
];
const respuestas = {   // lo que contestaría Gemini, por titular
  'Andrés Martín se ha roto': { que: 'lesion', hecho: 'Andrés Martín se rompe y estará un mes fuera', motivo: 'rotura de fibras en la pierna', plazo: 'estará 4 semanas de baja', oficial: false },
  'Mourinho da descanso a Güler para Atenas': { que: 'descartado', otraCompeticion: true, hecho: 'Güler descansa', motivo: '', plazo: '' },
  'Gerard Moreno no se entrena con el Villarreal': { que: 'molestias', hecho: 'Gerard Moreno no se entrena con el Villarreal', motivo: 'molestias en el sóleo', plazo: '' },
  'Pedri entrena al margen': { que: 'molestias', hecho: 'Pedri vuelve a tener molestias', motivo: 'molestias en el isquiotibial', plazo: '' },
  'Ayoze vuelve a una convocatoria': { que: 'vuelve', hecho: 'Ayoze regresa a la convocatoria', motivo: '', plazo: '' },
  'Andrés Martín, baja varias semanas': { que: 'lesion', hecho: 'Andrés Martín se pierde varias semanas', motivo: 'lesión muscular', plazo: '' },
};
let preguntas = 0;
const pedirIA = async ({ prompt }) => {
  preguntas++;
  const lote = JSON.parse(prompt.slice(prompt.indexOf('Noticias:\n') + 10));
  return { ok: true, modelo: 'falso', datos: { noticias: lote.map((x) => ({ i: x.i, jugadorId: x.candidatos[0].id, otraCompeticion: false, seguro: true, oficial: false, ...(respuestas[x.titular] || { que: 'nada', hecho: '', motivo: '', plazo: '' }) })) } };
};
const proximo = async () => ({ jornada: 12, rival: 'Girona' });
const config = { topes: { noticias: 15, novedades: 20, caidas: 9 }, topeDiario: 40, maxPorEjecucion: 6, noticiasPorEjecucion: 4, geminiDia: 60,
  separaciones: { noticias: { noticias: 30 } } };
const reg = new Registro(config);
reg.fichero = null;
const base = { jugadores: jug, equipos, jornada: 11, config, registro: reg, ventanas: false, ahora, log: () => {}, proximo, pedirIA, clave: 'falsa', listaPartes: [] };

let ts = await noticias({ ...base, leer: async () => prensa });
ver('primera vuelta', ts);
ok(preguntas === 1, `una pregunta a Gemini (${preguntas})`);
ok(!ts.some((t) => t.clave.includes('|10:')), 'Andrés Martín, con un solo medio y LaLiga en ok, espera');
ok(!ts.some((t) => t.clave.includes('|11:')), 'Güler (Champions) no sale');
ok(!ts.some((t) => t.clave.includes('|14:')), 'Ayoze vuelve con un solo medio y en LaLiga «ok» de siempre: espera');
const gm = ts.find((t) => t.clave.includes('|12:'));
ok(!gm, 'G. Moreno, ya lesionado en LaLiga: unas molestias no son noticia');
ok(reg.datos.noticias.hechos.some((h) => h.id === '12' && h.hecho === ''), 'la frase que copia el titular se tira');
ok(ts.some((t) => t.clave.includes('|13:') && /Duda Fantasy/.test(t.texto)), 'Pedri: un medio + LaLiga en duda');
for (const t of ts) reg.marcar(t, 'x');

// segunda vuelta: lo ya leído no se vuelve a preguntar; MARCA confirma lo de Andrés Martín
prensa = [...prensa, N('MARCA', 'm3', 'Andrés Martín, baja varias semanas', 'El jugador del Racing tiene una lesión muscular'),
  N('AS', 'a4', 'Cucho causa baja', 'El delantero se lesiona'), N('MARCA', 'm4', 'Cucho, lesionado', 'El delantero se lesiona otra vez')];
respuestas['Cucho causa baja'] = respuestas['Cucho, lesionado'] = { que: 'lesion', hecho: 'Cucho se lesiona', motivo: '', plazo: '' };
preguntas = 0;
reg.enEstaEjecucion = 0;
ts = await noticias({ ...base, leer: async () => prensa });
ver('segunda vuelta', ts);
ok(preguntas === 1, `solo la nueva va a Gemini (${preguntas})`);
const am = ts.find((t) => t.clave.includes('|10:'));
ok(am && /Rotura de fibras en la pierna/.test(am.texto), 'el motivo más completo');
ok(am && /Lo cuentan AS y MARCA|Lo cuentan MARCA y AS/.test(am.texto) && /Baja Fantasy para la jornada 12 contra el Girona/.test(am.texto), 'Andrés Martín sale con dos medios y como baja');
ok(!ts.some((t) => /\|1[23]:/.test(t.clave)), 'G. Moreno y Pedri no se repiten');
ok(!ts.some((t) => t.clave.includes('|15:')), 'Cucho, lesionado en LaLiga desde antes, no sale aunque lo cuenten dos medios');
ok(!JSON.stringify(reg.datos.noticias).includes('Andrés Martín se ha roto'), 'en el registro no se guardan titulares');

// novedades: si LaLiga pasa a Andrés Martín a lesionado, no repite lo que ya contó la prensa
for (const t of ts) reg.marcar(t, 'x');
reg.datos.estados = { 10: 'ok' };
const jug2 = jug.map((j) => (j.id === '10' ? { ...j, playerStatus: 'injured' } : j));
const nv = await novedades({ jugadores: jug2, equipos, jornada: 11, config, registro: reg, ventanas: false, ahora: Date.now(), log: () => {}, proximo, listaPartes: [], soloSeguras: false });
ok(!nv.length, `novedades no repite a Andrés Martín (${nv.map((t) => t.clave).join(', ')})`);

// sin clave no hace nada (ni lee la prensa)
let leidas = 0;
ts = await noticias({ ...base, registro: new Registro(config), clave: '', leer: async () => { leidas++; return prensa; } });
ok(!ts.length && !leidas, 'sin clave no lee nada');

console.log(`\n${fallos ? `${fallos} FALLOS` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
