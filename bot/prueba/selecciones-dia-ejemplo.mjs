// Prueba sin red del resumen diario de selecciones (tipos/selecciones-dia.mjs; Carlos, 9 nov 10:13): con respuestas de FotMob inventadas
// (con la forma de las de verdad: nota y cambios en `performance`), los mejores y los peores de ayer, los minutos y la carga del parón, la
// bandera en el texto y en la tarjeta, la ventana (uno por día, por la mañana, no el día del resumen del parón) y el validador de banderas.
//   node bot/prueba/selecciones-dia-ejemplo.mjs [--png=/tmp/seldia.png]
import { writeFileSync } from 'node:fs';
import { generar, elDia } from '../tipos/selecciones-dia.mjs';
import { leerActa } from '../lib/actas-selecciones.mjs';
import { ventanaSeleccionesDia } from '../lib/paron-tuits.mjs';
import { erroresBanderas } from '../lib/redaccion.mjs';
import { bandera } from '../lib/nacionalidad.mjs';
import { svgMercado, svgSeleccion, aPng } from '../lib/tarjetas.mjs';
import { validarTarjeta, validar } from '../lib/validar.mjs';
import { PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';

let fallos = 0;
const bien = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || null;
const fin = { finished: true, cancelled: false };
const P = (id, name, club, code, performance = {}) => ({ id, name, primaryTeamName: club, countryCode: code, performance });
const sale = (t, reason = 'tactical') => ({ substitutionEvents: [{ time: t, type: 'subOut', reason }] });
const entra = (t) => ({ substitutionEvents: [{ time: t, type: 'subIn', reason: 'tactical' }] });
const ev = (...xs) => ({ events: xs.map((type) => ({ type })) });
// día 1 (jueves 12): España-Georgia y Francia-Ucrania; día 2 (viernes 13, «ayer»): España-Turquía, Marruecos-Ghana y un sub-21 que no cuenta
const dias = {
  20261112: { leagues: [{ name: 'World Cup Qualification UEFA', matches: [{ id: 1, home: { name: 'Spain' }, away: { name: 'Georgia' }, status: fin }, { id: 2, home: { name: 'France' }, away: { name: 'Ukraine' }, status: fin }] }] },
  20261113: { leagues: [
    { name: 'World Cup Qualification UEFA', matches: [{ id: 3, home: { name: 'Turkiye' }, away: { name: 'Spain' }, status: fin }] },
    { name: 'Friendlies', matches: [{ id: 4, home: { name: 'Morocco' }, away: { name: 'Ghana' }, status: fin }] },
    { name: 'U21 Friendlies', matches: [{ id: 5, home: { name: 'Spain U21' }, away: { name: 'Italy U21' }, status: fin }] }] },
};
const det = {
  1: { header: { teams: [{ name: 'Spain', id: 6720, score: 2 }, { name: 'Georgia', id: 8473, score: 0 }] }, content: {
    lineup: { homeTeam: { name: 'Spain', starters: [P(10, 'Lamine Yamal', 'Barcelona', 'ESP', { rating: 8.1, ...ev('goal') }), P(11, 'Pedri', 'Barcelona', 'ESP', { rating: 7.2, ...sale(80) }), P(12, 'Dean Huijsen', 'Real Madrid', 'ESP', { rating: 7.0 })],
      subs: [P(13, 'Fermín López', 'Barcelona', 'ESP', { rating: 6.8, ...entra(80) })] },
    awayTeam: { name: 'Georgia', starters: [P(20, 'Giorgi Mamardashvili', 'Liverpool', 'GEO', { rating: 6.5 })], subs: [] } },
    matchFacts: { events: { events: [] } } } },
  2: { header: { teams: [{ name: 'France', id: 6723, score: 1 }, { name: 'Ukraine', id: 6708, score: 1 }] }, content: {
    lineup: { homeTeam: { name: 'France', starters: [P(30, 'Kylian Mbappé', 'Real Madrid', 'FRA', { rating: 7.6, ...ev('goal') })], subs: [] },
      awayTeam: { name: 'Ukraine', starters: [P(31, 'Artem Dovbyk', 'Roma', 'UKR', { rating: 6.4 })], subs: [] } },
    matchFacts: { events: { events: [] } } } },
  3: { header: { teams: [{ name: 'Turkiye', id: 6595, score: 1 }, { name: 'Spain', id: 6720, score: 3 }] }, content: {
    lineup: { homeTeam: { name: 'Turkiye', starters: [P(40, 'Arda Güler', 'Real Madrid', 'TUR', { rating: 5.6, ...sale(61) }), P(41, 'Kerem Aktürkoğlu', 'Fenerbahçe', 'TUR', { rating: 6.9, ...ev('goal') })], subs: [] },
      awayTeam: { name: 'Spain', starters: [P(10, 'Lamine Yamal', 'Barcelona', 'ESP', { rating: 9.1, ...ev('goal', 'goal', 'assist'), ...sale(75), playerOfTheMatch: true }), P(11, 'Pedri', 'Barcelona', 'ESP', { rating: 7.8, ...ev('assist') }),
        P(12, 'Dean Huijsen', 'Real Madrid', 'ESP', { rating: 6.1, ...sale(34, 'injury') })], subs: [P(13, 'Fermín López', 'Barcelona', 'ESP', { rating: 7.0, ...entra(75) }), P(14, 'Dani Olmo', 'Barcelona', 'ESP', {})] } },
    matchFacts: { events: { events: [{ type: 'Card', card: 'Red', time: 70, player: { id: 41 } }] } } } },
  4: { header: { teams: [{ name: 'Morocco', id: 6262, score: 0 }, { name: 'Ghana', id: 6714, score: 0 }] }, content: {
    lineup: { homeTeam: { name: 'Morocco', starters: [P(50, 'Brahim Díaz', 'Real Madrid', 'MAR', { rating: 5.8 }), P(51, 'Ez Abde', 'Real Betis', 'MAR', { rating: 7.6 })], subs: [] },
      awayTeam: { name: 'Ghana', starters: [P(52, 'Iñaki Williams', 'Athletic Club', 'GHA', { rating: 6.6 })], subs: [] } },
    matchFacts: { events: { events: [] } } } },
};
const equipos = { 1: 'FC Barcelona', 2: 'Athletic Club', 5: 'Real Betis', 6: 'Real Madrid' };
const J = (id, nickname, teamId, pos, valor) => ({ id: String(id), nickname, teamId: String(teamId), positionId: String(pos), marketValue: String(valor * 1e6), playerStatus: 'ok', weekPoints: [] });
const jugadores = [J(1, 'Lamine Yamal', 1, 4, 180), J(2, 'Pedri', 1, 3, 120), J(3, 'Huijsen', 6, 2, 60), J(4, 'Fermín', 1, 3, 70), J(5, 'Olmo', 1, 3, 55), J(6, 'Mbappé', 6, 4, 190),
  J(7, 'Arda Güler', 6, 3, 90), J(8, 'Brahim', 6, 3, 40), J(9, 'Ez Abde', 5, 4, 30), J(10, 'Iñaki Williams', 2, 4, 15)];
const stats = [{ id: 1, matchState: 1, date: '2026-11-20T20:00:00Z', local: { id: 1, mainName: 'FC Barcelona' }, visitor: { id: 2, mainName: 'Athletic Club' } }];
let pedidas = 0;
const pedir = (url) => { pedidas++; return Promise.resolve(/matches\?date=(\d+)/.test(url) ? dias[url.match(/date=(\d+)/)[1]] : det[(url.match(/matchId=(\d+)/) || [])[1]] || null); };

// el acta: minutos, nota, roja de los sucesos, lesión por el motivo del cambio
const a3 = leerActa(det[3], new Set(['Barça', 'Real Madrid']));
const de = (n) => a3.jugadores.find((x) => x.nombre === n);
bien(de('Lamine Yamal').min === 75 && de('Lamine Yamal').goles === 2 && de('Lamine Yamal').mejor && de('Fermín López').min === 15 && de('Dani Olmo').min === 0, 'minutos: titular hasta que sale (75), suplente desde que entra (15), el que no entra 0');
bien(de('Dean Huijsen').lesion === 34 && a3.fuera.idFm === 6720, 'Huijsen se retira lesionado en el 34 (motivo «injury»); la bandera de España, del id de FotMob');

const registro = { datos: { enviados: [] }, claves: new Set(), fichero: null };
const base = { conValor: false, ahora: Date.parse('2026-11-14T08:00:00Z'), jugadores, stats, equipos, jornada: 13, config: {}, paron: { jugada: 12, siguiente: 13, ini: Date.parse('2026-11-20T20:00:00Z') }, pedir, registro, log: (s) => console.log(s) };
const [t] = await generar({ ...base, ventanas: false, fechasSelecciones: ['20261112', '20261113'] });
bien(t && t.clave === 'selecciones-dia|12|20261113', `un tuit con la clave del día: ${t && t.clave}`);
const h = t.hechos;
bien(h.losMejores[0].nombre === 'Lamine Yamal' && h.losMejores[0].notaFotMob === '9,1' && h.losMejores[0].valeAhora === '180 M' && !h.losMejores.slice(1).some((x) => x.notaFotMob) && h.losMejores[0].marcador === '3-1' && h.losMejores[0].resultado === 'ganó' && h.losMejores[0].bandera === bandera('ESP') && h.losMejores[0].banderaRival === bandera('TUR'),
  `el mejor: ${JSON.stringify(h.losMejores[0])}`);
bien(!/\d,\d/.test(t.texto.split('\n')[2] || ''), `la plantilla sin notas: ${(t.texto.split('\n')[2] || '').slice(0, 80)}`);
bien(h.losMejores.some((x) => x.nombre === 'Ez Abde') && !h.losMejores.some((x) => x.nombre === 'Huijsen'), 'Ez Abde (7,6) entre los mejores; Huijsen (lesionado) no');
bien(h.losPeores[0].nombre === 'Huijsen' && /minuto 34/.test(h.losPeores[0].queLePaso) && h.losPeores.some((x) => x.nombre === 'Arda Güler') && h.losPeores.some((x) => x.nombre === 'Brahim'), `los peores: ${h.losPeores.map((x) => `${x.nombre} (${x.queLePaso})`).join(', ')}`);
bien(h.masMinutosEnElParon && h.masMinutosEnElParon[0].nombre === 'Pedri' && h.masMinutosEnElParon[0].minutosEnElParon === 170, `la carga: ${JSON.stringify(h.masMinutosEnElParon)}`);
bien(h.ayerSinJugar && h.ayerSinJugar[0].nombre === 'Olmo', 'Olmo, en el banquillo sin jugar');
bien(!JSON.stringify(h).includes('Mamardashvili') && !JSON.stringify(h.losMejores).includes('Mbappé'), 'ni los de fuera de LaLiga ni lo de anteayer entre los mejores de ayer');
const v = validar(t.texto, { numeros: t.numeros, max: 1000 });
bien(v.ok, `la plantilla pasa el validador${v.ok ? '' : `: ${v.errores.join('; ')}`}`);
bien(!erroresBanderas(t.texto, h).length, `las banderas de la plantilla, bien puestas${erroresBanderas(t.texto, h).join('; ')}`);
console.log(t.texto.replace(/^/gm, '     '));

// la tarjeta, con la bandera de cada uno (un PNG de mentira: un cuadrado de color)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const [tj, ...paises] = t.tarjeta;
const d = structuredClone(tj.d);
for (const f of d.paneles.flatMap((p) => p.filas)) { f.bandera = f.banderaUrl ? PNG : null; }
bien(d.paneles.map((p) => p.titulo).join(' · ') === 'LOS MEJORES · LOS PEORES · MÁS MINUTOS EN EL PARÓN', `paneles: ${d.paneles.map((p) => p.titulo).join(' · ')}`);
bien(d.paneles[0].filas.every((f) => /teamlogo\/\d+\.png$/.test(f.banderaUrl)), 'cada fila con la bandera de FotMob');
const svg = svgMercado(d);
const vt = validarTarjeta(svg, tj.permitidos, PALABRAS_FIJAS);
bien(vt.ok, `la tarjeta pasa el validador${vt.ok ? '' : `: ${vt.errores.slice(0, 3).join('; ')}`}`);
bien((svg.match(/clip-path="url\(#bd/g) || []).length === d.paneles.flatMap((p) => p.filas).length, 'una bandera por cara');
if (arg('png')) { writeFileSync(arg('png'), await aPng(svg)); console.log(`     tarjeta en ${arg('png')}`); }
// la tarjeta de España (la única de ayer con 3 o más de LaLiga que jugaron), con sus colores
bien(paises.length === 1 && paises[0].tipo === 'seleccion' && paises[0].d.pais === 'ESPAÑA' && paises[0].d.colores[1] === '#ffc400' && paises[0].d.marcador === '3-1' && paises[0].d.rival.nombre === 'TURQUÍA',
  `una tarjeta de selección: ${paises.map((x) => `${x.d.pais} ${x.d.marcador} ante ${x.d.rival.nombre}`).join(', ')}`);
const dp = structuredClone(paises[0].d); dp.bandera = PNG; dp.rival.bandera = PNG;
bien(dp.filas[0].nombre === 'Lamine Yamal' && dp.filas.some((f) => f.nombre === 'Huijsen' && f.dif === 'LESIÓN' && f.bueno === false) && dp.filas.some((f) => f.nombre === 'Olmo' && f.dif === 'SIN JUGAR'), `sus filas: ${dp.filas.map((f) => `${f.nombre} ${f.dif}${f.pct ? ` (${f.pct})` : ''}`).join(' · ')}`);
const svgP = svgSeleccion(dp), vp = validarTarjeta(svgP, paises[0].permitidos, PALABRAS_FIJAS);
bien(vp.ok, `la tarjeta de España pasa el validador${vp.ok ? '' : `: ${vp.errores.slice(0, 3).join('; ')}`}`);
if (arg('png')) { writeFileSync(arg('png').replace(/\.png$/, '-pais.png'), await aPng(svgP)); }

// la caché: los días pasados se guardan en el registro y no se vuelven a pedir
const antes = pedidas;
bien(registro.datos.actasSelecciones && registro.datos.actasSelecciones['20261113'].length === 2, 'los días pasados, guardados en el registro');
await generar({ ...base, ventanas: false, fechasSelecciones: ['20261112', '20261113'], log: () => {} });
bien(pedidas === antes, `la segunda vez no pide nada a FotMob (${pedidas - antes} peticiones)`);

// la ventana: el parón de noviembre (la J12 acaba el domingo 8; la J13 empieza el viernes 20 a las 21:00 y las caídas, el martes 17 a las 21:00)
const paron = { jugada: 12, siguiente: 13, fin: Date.parse('2026-11-08T22:30:00Z'), ini: Date.parse('2026-11-20T20:00:00Z'), hasta: Date.parse('2026-11-17T20:00:00Z'), activo: true };
const cfg = { inicioEntreSemana: 7, paronTuits: { selecciones: 0.9, margenHoras: 12 }, horasParon: [9, 23] };
const W = (iso, extra = {}) => ventanaSeleccionesDia({ paron, config: cfg, ahora: Date.parse(iso), jornada: 13, stats, registro: { claves: new Set() }, ...extra });
bien(W('2026-11-13T06:30:00Z').ok && W('2026-11-13T06:30:00Z').ayer === '20261112', 'viernes 13 a las 7:30: sale el de ayer (jueves 12)');
bien(!W('2026-11-14T07:30:00Z').ok && W('2026-11-14T08:30:00Z').ok, 'sábado 14: a las 8:30 no (fin de semana, desde las 9); a las 9:30 sí');
bien(!W('2026-11-13T13:30:00Z').ok, 'viernes 13 a las 14:30, fuera de horario (hasta las 14)');
bien(!W('2026-11-13T06:30:00Z', { registro: { claves: new Set(['selecciones-dia|12|20261112']) } }).ok, 'el de ayer ya ha salido: no se repite');
bien(!W('2026-11-17T06:30:00Z').ok && /todo el parón/.test(W('2026-11-17T06:30:00Z').motivo), `martes 17: sale el de todo el parón, el diario no (${W('2026-11-17T06:30:00Z').motivo})`);
bien(!W('2026-11-18T08:30:00Z').ok, 'miércoles 18: ya han empezado las caídas de la J13');

// el validador de banderas: solo en los de selecciones, de los hechos, detrás de su selección y una vez
bien(erroresBanderas('🏁 El Madrid gana 🇪🇸', { tipo: 'final' }).length === 1, 'en un final, ninguna bandera');
bien(erroresBanderas(`⭐ Yamal ${bandera('ESP')} la lía`, h).length === 1, 'detrás del jugador, no');
bien(erroresBanderas(`⭐ Con España ${bandera('ESP')} y luego España ${bandera('ESP')}`, h).length === 1, 'la misma dos veces, no');
bien(erroresBanderas(`⭐ Con Francia ${bandera('FRA')}`, h).length === 1, 'una de una selección que no está en los hechos, no');
bien(erroresBanderas(`⭐ Con España ${bandera('ESP')} ante Turquía ${bandera('TUR')}`, h).length === 0, 'detrás de su selección, sí');
bien(bandera('ENG') && bandera('NIR') === null, 'Inglaterra con su bandera; Irlanda del Norte, sin emoji');

console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
