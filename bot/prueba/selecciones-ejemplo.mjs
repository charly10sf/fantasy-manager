// Prueba sin red de los jugadores de LaLiga con sus selecciones (tipos/selecciones.mjs; Carlos, 9 nov): con respuestas de FotMob
// inventadas (con la forma de las de verdad), qué partidos cuentan (ni femenino, ni sub-21, ni Copa), goles, asistencias, el que se
// retira lesionado, el cruce con la lista de LaLiga por club y nombre, el tuit y la tarjeta.
//   node bot/prueba/selecciones-ejemplo.mjs
import { generar, deSelecciones, leerPartido } from '../tipos/selecciones.mjs';
import { svgMercado } from '../lib/tarjetas.mjs';
import { validarTarjeta, validar } from '../lib/validar.mjs';
import { PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';

let fallos = 0;
const bien = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const fin = { finished: true, cancelled: false };
const dia = { leagues: [
  { name: 'UEFA Nations League A Grp. 3', parentLeagueName: 'UEFA Nations League A', matches: [{ id: 1, home: { name: 'Spain' }, away: { name: 'Czechia' }, status: fin }, { id: 9, home: { name: 'England' }, away: { name: 'Croatia' }, status: { finished: false } }] },
  { name: 'Friendlies', matches: [{ id: 2, home: { name: 'Spain (W)' }, away: { name: 'USA (W)' }, status: fin }] },
  { name: 'Friendlies U21', matches: [{ id: 3, home: { name: 'Spain U21' }, away: { name: 'Italy U21' }, status: fin }] },
  { name: 'Copa del Rey', matches: [{ id: 4, home: { name: 'Barcelona' }, away: { name: 'Guadalajara' }, status: fin }] },
  { name: 'Friendlies', matches: [{ id: 5, home: { name: 'Morocco' }, away: { name: 'Ghana' }, status: fin }] },
] };
const P = (id, name, club, code) => ({ id, name, primaryTeamName: club, countryCode: code });
const det = {
  1: { header: { teams: [{ name: 'Spain', score: 3 }, { name: 'Czechia', score: 1 }] }, content: {
    lineup: { homeTeam: { name: 'Spain', starters: [P(10, 'Lamine Yamal', 'Barcelona', 'ESP'), P(11, 'Dani Olmo', 'Barcelona', 'ESP'), P(12, 'Rodri', 'Manchester City', 'ESP'), P(13, 'Mikel Merino', 'Arsenal', 'ESP'), P(14, 'Aymeric Laporte', 'Athletic Club', 'ESP')], subs: [P(15, 'Víctor Muñoz', 'Osasuna', 'ESP')] },
      awayTeam: { name: 'Czechia', starters: [P(20, 'Adam Hložek', 'Hoffenheim', 'CZE'), P(21, 'Ladislav Krejcí', 'Girona', 'CZE')], subs: [P(22, 'Pavel Šulc', 'Lyon', 'CZE')] } },
    matchFacts: { events: { events: [
      { type: 'Goal', time: 6, player: { id: 10, name: 'Lamine Yamal' }, assistInput: 'Dani Olmo', isHome: true },
      { type: 'Goal', time: 35, player: { id: 12, name: 'Rodri' }, isHome: true },
      { type: 'Goal', time: 50, player: { id: 21, name: 'Ladislav Krejcí' }, isHome: false, ownGoal: true },
      { type: 'Substitution', time: 57, injuredPlayerOut: true, isHome: true, swap: [{ id: '15', name: 'Víctor Muñoz' }, { id: '14', name: 'Aymeric Laporte' }] },
      { type: 'Goal', time: 89, player: { id: 15, name: 'Víctor Muñoz' }, assistInput: 'Lamine Yamal', isHome: true },
    ] } } } },
  5: { header: { teams: [{ name: 'Morocco', score: 2 }, { name: 'Ghana', score: 0 }] }, content: {
    lineup: { homeTeam: { name: 'Morocco', starters: [P(30, 'Ez Abde', 'Real Betis', 'MAR'), P(31, 'Brahim Díaz', 'Real Madrid', 'MAR')], subs: [] }, awayTeam: { name: 'Ghana', starters: [P(40, 'Iñaki Williams', 'Athletic Club', 'GHA')], subs: [] } },
    matchFacts: { events: { events: [{ type: 'Goal', time: 20, player: { id: 31, name: 'Brahim Díaz' }, assistInput: 'Ez Abde', isHome: true }, { type: 'Goal', time: 70, player: { id: 31, name: 'Brahim Díaz' }, isHome: true }] } } } },
};
bien(dia.leagues.flatMap((l) => l.matches.filter((m) => deSelecciones(l, m)).map((m) => m.id)).join(',') === '1,9,5', 'cuentan Nations League y amistosos de absolutos; ni femenino, ni sub-21, ni Copa');
const clubes = new Set(['Barça', 'Athletic', 'Osasuna', 'Girona', 'Betis', 'Real Madrid']);
const p1 = leerPartido(det[1], clubes);
bien(p1.jugadores.size === 5 && !p1.jugadores.has('12'), 'del Spain-Czechia, solo los de LaLiga (Rodri y Merino, no)');
bien(p1.goles.length === 3 && p1.asist.length === 2 && p1.lesiones.map((x) => x.id).join() === '14', 'goles sin el de propia puerta, dos asistencias y Laporte que se retira lesionado (sale el titular, no el que entra)');

const equipos = { 1: 'FC Barcelona', 2: 'Athletic Club', 3: 'CA Osasuna', 4: 'Girona FC', 5: 'Real Betis', 6: 'Real Madrid' };
const J = (id, nickname, teamId, pos = 4) => ({ id: String(id), nickname, teamId: String(teamId), positionId: String(pos), marketValue: String(1e6 * (100 - id)), playerStatus: 'ok', weekPoints: [] });
const jugadores = [J(1, 'Lamine Yamal', 1), J(2, 'Olmo', 1, 3), J(3, 'Laporte', 2, 2), J(4, 'Víctor Muñoz', 3), J(5, 'Ez Abde', 5), J(6, 'Brahim', 6, 3), J(7, 'Iñaki Williams', 2)];
const stats = [{ id: 1, matchState: 1, date: '2026-11-20T20:00:00Z', local: { id: 1, mainName: 'FC Barcelona' }, visitor: { id: 2, mainName: 'Athletic Club' } }];
const pedir = (url) => Promise.resolve(/matches\?date=/.test(url) ? dia : det[(url.match(/matchId=(\d+)/) || [])[1]] || null);
const [t] = await generar({ jugadores, stats, equipos, jornada: 13, ventanas: false, config: {}, paron: { jugada: 12, siguiente: 13 }, fechasSelecciones: ['20261112'], pedir, log: (s) => console.log(s) });
bien(t && t.clave === 'selecciones|12', 'un tuit con la clave del parón');
const gs = t.hechos.golesYAsistencias;
bien(gs[0].nombre === 'Brahim' && gs.some((x) => x.nombre === 'Lamine Yamal' && x.loQueHizo === '1 gol y 1 asistencia') && gs.some((x) => x.nombre === 'Brahim' && x.seleccion === 'Marruecos'), `goles y asistencias cruzados con LaLiga: ${gs.map((x) => `${x.nombre} (${x.seleccion}) ${x.loQueHizo}`).join(' · ')}`);
bien(t.hechos.seRetiranTocados.length === 1 && /minuto 57 ante Chequia/.test(t.hechos.seRetiranTocados[0].queLePaso), `el tocado, tal cual: ${t.hechos.seRetiranTocados[0].nombre}, ${t.hechos.seRetiranTocados[0].queLePaso}`);
bien(!JSON.stringify(t.hechos).includes('Rodri'), 'Rodri (Manchester City) no sale');
const v = validar(t.texto, { numeros: t.numeros, max: 1000 });
bien(v.ok, `la plantilla pasa el validador${v.ok ? '' : `: ${v.errores.join('; ')}`}`);
console.log(t.texto.replace(/^/gm, '     '));
const svg = svgMercado(t.tarjeta.d);
const vt = validarTarjeta(svg, t.tarjeta.permitidos, PALABRAS_FIJAS);
bien(vt.ok, `la tarjeta pasa el validador${vt.ok ? '' : `: ${vt.errores.slice(0, 3).join('; ')}`}`);
bien(/SELECCIONES/.test(svg) && /SE RETIRAN TOCADOS/.test(svg), 'la tarjeta con goles y tocados');
const no = await generar({ jugadores, stats, equipos, jornada: 13, ventanas: true, config: {}, paron: null, pedir: () => { throw new Error('no debería pedir nada'); }, log: () => {} });
bien(!no.length, 'sin parón no sale (ni pide nada)');
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
