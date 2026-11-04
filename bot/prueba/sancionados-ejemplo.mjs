// Prueba de sancionados y apercibidos sin red (cola de Carlos, 3 nov 20:17): leer las dos páginas, casar con LaLiga, las dos
// fuentes de los apercibidos, sin repetir con caídas y los textos.
//   node bot/prueba/sancionados-ejemplo.mjs
// Las filas imitan las páginas reales del 3 nov (jornada 12).
import { leerDisciplina, casar, mismoNombre, mismoClub } from '../lib/disciplina.mjs';
import { generar } from '../tipos/sancionados.mjs';
import { validar } from '../lib/validar.mjs';
import { Registro } from '../lib/registro.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const igual = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falla(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

const fila = (nombre, slug, dentro) => `<div class="elemento sancionado col-12"><div class="datos"><a href="https://www.futbolfantasy.com/jugadores/${slug}" class="jugador">${nombre}</a>${dentro}</div></div>`;
const amar = (js) => `<div class="tarjetascontainer d-flex"><span class="cicloA c1r">1r ciclo</span>${js.map((j) => `<span class="tarjetasA"><span class="jornadaT">J${j}</span></span>`).join('')}</div>`;
const sec = (eq, slug, filas) => `<section><div class="row block-new disciplinary-cards"><header class="title"><span><a href="https://www.futbolfantasy.com/laliga/equipos/${slug}">${eq}</a></span></header>${filas.join('')}</div></section>`;
const SAN = `<html><body>${[
  sec('Betis', 'betis', [fila('Facundo Bernal', 'facundo-bernal', '<span class="sancion">Sanción disciplinaria (3/4)</span>')]),
  sec('Espanyol', 'espanyol', [fila('Roger Hinojo', 'roger-hinojo', `<span class="sancion">Acumulación de tarjetas ${amar([11, 9, 8, 5, 3])}</span>`), '<div class="elemento"><div class="datos"><span class="sancion">Sanción disciplinaria (2/2)</span></div></div>']),
  sec('Real Madrid', 'real-madrid', [fila('Vinicius Junior', 'vinicius-junior', '<span class="sancion">Sanción disciplinaria (4/4)</span>')]),
  sec('Sevilla', 'sevilla', [fila('Manu Bueno', 'manu-bueno', '<span class="sancion">Roja directa</span>')]),
].join('')}</body></html>`;
const APE = `<html><body>${[
  sec('Racing', 'racing', [fila('Yassir Zabiri', 'yassir-zabiri', amar([7, 6, 5, 4])), fila('Pablo Ramón', 'pablo-ramon', amar([10, 8, 7, 1]))]),
  sec('Celta', 'celta', [fila('Yoel Lago', 'yoel-lago', amar([8, 7, 5, 6]))]),
  sec('Getafe', 'getafe', [fila('Ramón Terrats', 'ramon-terrats', amar([10, 8, 7, 4]))]),
  sec('Espanyol', 'espanyol', [fila('Clemens Riedel', 'clemens-riedel', amar([8, 7, 5, 2]))]),
  sec('Real Sociedad', 'real-sociedad', [fila('Jon Aramburu', 'jon-aramburu', amar([11, 4, 1, 2]))]),
].join('')}</body></html>`;

// 1) leer las páginas
const san = leerDisciplina(SAN), ape = leerDisciplina(APE);
igual(san.map((x) => [x.nombre, x.motivo, x.partido, x.de]), [['Facundo Bernal', 'disciplinaria', 3, 4], ['Roger Hinojo', 'amarillas', null, null], ['Vinicius Junior', 'disciplinaria', 4, 4], ['Manu Bueno', 'roja', null, null]], 'sancionados leídos (sin el entrenador sin nombre)');
igual(ape[0].amarillas, [4, 5, 6, 7], 'jornadas de las amarillas, ordenadas');

// 2) casar nombres y clubes
igual(['Vini Jr.', 'Y. Zabiri', 'R. Terrats', 'Hinojo', 'Yoel Lago'].map((a, i) => mismoNombre(['Vinicius Junior', 'Yassir Zabiri', 'Ramón Terrats', 'Roger Hinojo', 'Yoel Lago'][i], '', a)), [true, true, true, true, true], 'apodos de LaLiga');
igual([mismoNombre('Ramón Terrats', '', 'Ramon'), mismoNombre('Pablo Ramón', '', 'Ramon'), mismoNombre('Yassir Zabiri', '', 'J. Zabiri')], [true, true, false], 'apodos (con «Ramon» valen los dos: lo decide el club en casar)');
igual([mismoClub('Real Sociedad', 'real-sociedad', 'Real Sociedad de Fútbol'), mismoClub('Barcelona', 'barcelona', 'FC Barcelona'), mismoClub('Betis', 'betis', ''), mismoClub('Racing', 'racing', 'Real Betis')], [true, true, false, false], 'clubes');

const equipos = { 1: 'Real Betis', 2: 'RCD Espanyol de Barcelona', 3: 'Real Madrid CF', 4: 'Sevilla FC', 5: 'R. Racing Club', 6: 'RC Celta', 7: 'Getafe CF', 8: 'Real Sociedad de Fútbol' };
const J = (id, nickname, teamId, playerStatus, averagePoints, marketValue, positionId = 3) => ({ id, nickname, teamId, playerStatus, averagePoints, marketValue, positionId });
const jugadores = [J(10, 'F. Bernal', 1, 'suspended', 2.7, 5.9e6), J(11, 'Hinojo', 2, 'suspended', 2, 1.7e6), J(12, 'Vini Jr.', 3, 'suspended', 6.3, 57e6, 4), J(13, 'Manu Bueno', 4, 'suspended', 1, 0.6e6),
  J(20, 'Y. Zabiri', 5, 'ok', 6, 46e6, 4), J(21, 'Pablo Ramón', 5, 'ok', 2.7, 1e6, 2), J(22, 'Ramon', 5, 'ok', 2.3, 1e6, 2), J(23, 'Yoel Lago', 6, 'ok', 6, 28e6, 2),
  J(24, 'R. Terrats', 7, 'ok', 5.3, 18e6), J(25, 'Riedel', 2, 'injured', 3.1, 4e6, 2), J(26, 'Aramburu', 8, 'ok', 2.3, 8e6, 2), J(27, 'Herrera', 99, 'ok', 4, 9e6)];
igual(ape.map((w) => (casar(w, jugadores, equipos) || {}).nickname || null), ['Y. Zabiri', null, 'Yoel Lago', 'R. Terrats', 'Riedel', 'Aramburu'], 'apercibidos casados (Pablo Ramón tiene dos candidatos: fuera)');

// fichas: titular en todo menos Hinojo y Manu Bueno (suplentes); amarillas como en la web, salvo Terrats (LaLiga le cuenta 3: no es apercibido)
const amarillas = { 20: [4, 5, 6, 7], 23: [5, 6, 7, 8], 24: [4, 7, 8], 26: [1, 2, 4, 11] };
const fichaDe = async (id) => ({ playerStats: Array.from({ length: 11 }, (_, i) => ({ weekNumber: i + 1, stats: { mins_played: [[11, 13].includes(id) ? 20 : 90, 2], yellow_card: [(amarillas[id] || []).includes(i + 1) ? 1 : 0, -1] } })) });
const pagina = async (n) => (n === 'sancionados' ? san : ape);
const stats = [{ matchState: 7, date: '2026-11-02T20:00:00Z', local: { id: 1 }, visitor: { id: 2 } }];
const pedirSemana = async () => [{ matchState: 1, date: '2026-11-06T20:00:00Z', local: { id: 1 }, visitor: { id: 2 } }];
const base = { jugadores, equipos, jornada: 11, stats, semana: { weekNumber: 11, nextWeek: 12 }, pedirSemana, fichaDe, pagina, log: () => {}, proximo: async () => ({ jornada: 12, rival: 'Rayo' }) };

// 3) horario: el martes 3 nov a las 20:00 (73 h antes) no sale; el miércoles a las 20:00 (49 h antes), sí; a las 2, no
const t = (s) => Date.parse(s);
igual((await generar({ ...base, ahora: t('2026-11-03T19:00:00Z'), config: {} })).length, 0, 'demasiado pronto');
igual((await generar({ ...base, ahora: t('2026-11-05T01:00:00Z'), config: {} })).length, 0, 'de madrugada');
const ts = await generar({ ...base, ahora: t('2026-11-04T19:00:00Z'), config: {} });
console.log('=== miércoles 20:00');
for (const x of ts) { const v = validar(x.texto, { numeros: x.numeros }); if (!v.ok) falla(`${x.clave}: ${v.errores.join('; ')}`); console.log(`--- ${x.clave} · peso ${v.peso}\n${x.texto}`); }
// fuera Hinojo y Manu Bueno (no pesan), Terrats (LaLiga no le cuenta 4 amarillas) y Riedel (lesionado)
igual(ts.map((x) => x.clave), ['sancionados|12|12-10', 'apercibidos|12|20-23-26'], 'claves');
if (!/último de sus cuatro partidos de sanción con el Real Madrid/.test(ts[0].texto)) falla('motivo de Vini Jr.');
if (!/tercero de sus cuatro/.test(ts[0].texto)) falla('motivo de F. Bernal');
if (!/se pierden la 13/.test(ts[1].texto)) falla('aviso de los apercibidos');

// 4) sin repetir: Vini Jr. ya salió en caídas de la jornada 12
const reg = new Registro({ topes: { caidas: 9, sancionados: 3 }, topeDiario: 40, maxPorEjecucion: 6 });
reg.marcar({ clave: 'caidas|12|12', tipo: 'caidas', jornada: 12 }, '1');
const ts2 = await generar({ ...base, ahora: t('2026-11-04T19:00:00Z'), config: {}, registro: reg });
igual(ts2[0].clave, 'sancionados|12|10', 'sin Vini Jr., que ya salió en caídas');
console.log(`--- ${ts2[0].clave}\n${ts2[0].texto}`);
if (!/El centrocampista cumple el tercero/.test(ts2[0].texto) || !/contra el Rayo/.test(ts2[0].texto)) falla('uno solo: por su puesto y con el rival');
// y las caídas ya no repiten a los de un tweet de sancionados
reg.marcar(ts2[0], '2'); reg.marcar(ts2[1], '3');
if (!reg.cubiertos().some((c) => c.tipo === 'sancionados' && c.id === '10')) falla('cubiertos() con sancionados');
if (reg.cubiertos().some((c) => c.tipo === 'sancionados' && c.id === '20')) falla('los apercibidos no cuentan como cubiertos');

console.log(`\n${fallos ? `${fallos} fallos` : '0 fallos'}`);
process.exit(fallos ? 1 : 0);
