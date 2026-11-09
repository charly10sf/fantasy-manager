// Prueba sin red de los datos variados del jugador (lib/datos-jugador.mjs; Carlos, 9 nov 09:12: «lo de que siempre diga los puntos de
// media no es bueno tampoco. Podría dar otros datos»).
//   node bot/prueba/datos-ejemplo.mjs
// Con una liga inventada de 10 jugadores (puntos de cada jornada, fichas y valores falsos): qué dato sale de cada uno, que en 10 tuits
// seguidos la media no salga más de 3 veces ni dos seguidas, que la plantilla tampoco tire de la media y que el validador tumbe la
// segunda media seguida del mismo tipo.
import { fijarDatos, prepararDatos, perfil, candidatos, limitarDatos, tiposEnTexto, datoPlantilla, apuntarTexto } from '../lib/datos-jugador.mjs';
import { jugador as jugadorH } from '../lib/hechos.mjs';
import { revisar } from '../lib/redaccion.mjs';
import { fraseJugador } from '../lib/info-jugador.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const bien = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) falla(m); };

// 12 jornadas jugadas; cada jugador con su perfil
const wp = (xs) => xs.map((points, i) => ({ weekNumber: i + 1, points }));
const J = (id, nickname, positionId, teamId, puntos, valor) => ({ id: String(id), nickname, positionId: String(positionId), teamId: String(teamId), playerStatus: 'ok',
  marketValue: String(valor), points: puntos.reduce((a, b) => a + b, 0), averagePoints: puntos.reduce((a, b) => a + b, 0) / puntos.length, weekPoints: wp(puntos) });
const lista = [
  J(1, 'Racha', 4, 10, [3, 4, 2, 5, 3, 4, 2, 3, 4, 14, 12, 15], 30e6),           // en racha las tres últimas
  J(2, 'Pico', 3, 11, [4, 5, 22, 4, 5, 3, 4, 6, 4, 5, 3, 4], 20e6),              // una jornada de 22
  J(3, 'Goleador', 4, 12, [6, 7, 5, 8, 6, 7, 6, 5, 7, 6, 8, 7], 60e6),           // goles en la ficha
  J(4, 'Muro', 1, 13, [6, 5, 7, 6, 5, 6, 7, 6, 5, 6, 7, 6], 15e6),               // porterías a cero
  J(5, 'Subidón', 2, 14, [4, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4], 12e6),            // valor disparado
  J(6, 'Normal', 3, 15, [4, 4, 4, 5, 4, 4, 5, 4, 4, 4, 5, 4], 8e6),              // nada destaca
  J(7, 'Bajón', 3, 16, [8, 9, 7, 8, 9, 8, 7, 9, 8, 1, 0, 2], 25e6),              // mala racha
  J(8, 'Crack', 4, 17, [12, 14, 9, 13, 11, 12, 10, 14, 12, 13, 11, 12], 150e6),  // el delantero que más lleva
  J(9, 'Lateral', 2, 18, [5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6], 18e6),
  J(10, 'Medio', 3, 19, [5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 6], 22e6),
];
// fichas: playerStats con goles, asistencias, minutos y goles encajados
const st = (g, a, min, gc) => ({ goals: [g, 0], goal_assist: [a, 0], mins_played: [min, 0], goals_conceded: [gc, 0] });
const ficha = (id) => {
  const pj = (f) => Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, stats: f(i) }));
  const F = { 3: pj((i) => st(i % 2, i % 4 === 0 ? 1 : 0, 90, 1)), 4: pj((i) => st(0, 0, 90, i % 3 === 0 ? 1 : 0)), 8: pj((i) => st(i % 3 === 0 ? 1 : 0, 0, 85, 1)) };
  return Promise.resolve({ playerStats: F[id] || pj(() => st(0, 0, 70, 1)) });
};
const valor = (id) => {
  const hoy = Date.parse('2026-11-09T00:00:00+01:00');
  const dia = (k, v) => ({ marketValue: v, date: new Date(hoy - k * 864e5).toISOString() });
  return Promise.resolve(id === '5' ? [dia(120, 4e6), dia(31, 5e6), dia(0, 12e6)] : [dia(120, Number(lista.find((x) => x.id === id).marketValue)), dia(0, Number(lista.find((x) => x.id === id).marketValue))]);
};
const equipos = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(10 + i), `Equipo ${i}`]));
fijarDatos({ jugadores: lista, equipos, hasta: 12, registro: { datos: { recientes: {} } }, pedir: { ficha, valor } });
await prepararDatos(lista.map((x) => x.id));

// 1) el dato más fuerte de cada uno
const quiero = { Racha: 'racha', Pico: 'mejor', Goleador: 'goles', Muro: 'porterias', Subidón: 'valor', Bajón: 'racha', Crack: 'ranking' };
for (const j of lista) {
  const cs = candidatos(perfil(j)).sort((a, b) => b.fuerza - a.fuerza);
  console.log(`  ${j.nickname}: ${cs.slice(0, 3).map((c) => `${c.que} ${c.fuerza.toFixed(2)} («${c.dice}»)`).join(' · ')}`);
  if (quiero[j.nickname]) bien(cs[0] && cs[0].que === quiero[j.nickname], `${j.nickname}: el dato más fuerte es ${quiero[j.nickname]} (sale ${cs[0] && cs[0].que})`);
}
bien(!candidatos(perfil(lista[5])).some((c) => c.fuerza >= 0.5), 'Normal: nada fuerte (en una liga de 10, solo su puesto entre los centrocampistas)');

// 2) 10 tuits seguidos (uno por jugador, como caídas o novedades): el dato de cada uno, y la media como mucho 3 veces y nunca dos seguidas
const usados = [];
for (let i = 0; i < 10; i++) {
  const j = lista[(i * 3) % lista.length];
  const h = { tipo: 'caidas', jugadores: [jugadorH(j, { equipos, estado: 'lesionado' })] };
  const [d] = limitarDatos(h, { n: 1 });
  const que = d ? d.que : '(nada)';
  usados.push(que);
  // la IA escribe con el dato que se le da (aquí, la frase tal cual)
  const texto = `🚨 ${j.nickname} se cae. ${d ? `El delantero ${d.dice}.` : ''}`;
  apuntarTexto(texto, 'caidas');
  bien(!h.jugadores[0].mediaPuntos || que === 'media', `tuit ${i + 1} (${j.nickname}): ${que}${h.jugadores[0].mediaPuntos ? ' · con media' : ' · sin media en los hechos'}`);
}
const medias = usados.filter((x) => x === 'media').length;
bien(medias <= 3, `en 10 tuits seguidos, la media ${medias} veces (como mucho 3)`);
bien(!usados.some((x, i) => i > 0 && x === 'media' && usados[i - 1] === 'media'), 'nunca dos medias seguidas');
bien(new Set(usados).size >= 4, `tipos de dato distintos: ${[...new Set(usados)].join(', ')}`);
bien(!usados.some((x, i) => i > 0 && x === usados[i - 1]), `ningún tipo de dato dos veces seguidas: ${usados.join(' → ')}`);

// 3) varios jugadores en un tuit: un dato (dos en los largos), de tipos distintos, y sin la media de los demás
{
  const h = { tipo: 'caidas', jugadores: [jugadorH(lista[0], { equipos }), jugadorH(lista[2], { equipos, principal: false }), jugadorH(lista[3], { equipos, principal: false })] };
  const ds = limitarDatos(h, { n: 2 });
  bien(ds.length === 2 && ds[0].que !== ds[1].que, `largo con tres jugadores: dos datos distintos (${ds.map((d) => `${d.nombre} ${d.que}`).join(', ')})`);
  bien(h.jugadores.filter((x) => x.datoDestacado).length === 2 && h.jugadores.every((x) => !x.mediaPuntos || (x.datoDestacado && x.datoDestacado.que === 'media')), 'el tercero sin dato ni media');
  bien(!JSON.stringify(h).includes('candidatos'), 'los candidatos no salen en el JSON de los hechos');
}

// 4) la plantilla: el dato en vez de la media
{
  const d = datoPlantilla(lista[0]);
  const f = fraseJugador({ quien: 'El delantero del Equipo 0', media: 6.4, tit: { p: 0.8, pct: 80 }, dato: d });
  bien(!/de media/.test(f.t) && f.t.includes(d.dice), `plantilla con dato: «${f.t}»`);
  bien(d.numeros.every((n) => f.numeros.includes(n)), 'las cifras del dato van en los números del tuit');
}

// 5) qué tipos lleva un texto
const T = [['Va a 6,4 puntos de media y está fino', ['media']], ['Suma 41 puntos en las tres últimas jornadas', ['racha']], ['Lleva 6 goles y 3 asistencias en la liga', ['goles']],
  ['Vale 12 M y ha ganado 7 M en el último mes', ['valor']], ['Lleva 5 porterías a cero en 12 partidos', ['porterias']], ['Es el delantero que más puntos lleva esta temporada', ['ranking']]];
for (const [t, q] of T) { const s = tiposEnTexto(t); bien(q.every((x) => s.has(x)), `tiposEnTexto «${t}» → ${[...s].join(', ')}`); }

// 6) el validador: la media dos tuits seguidos del mismo tipo, no
{
  const hechos = { tipo: 'caidas', jugadores: [{ nombre: 'Normal', club: 'Osasuna', estado: 'lesionado', mediaPuntos: '4,3', principal: true }], clubes: { Osasuna: { nombres: ['el Osasuna'] } } };
  const texto = 'Normal se cae del once del Osasuna por lesión y no estará el domingo. Va a 4,3 puntos de media.';
  const sin = revisar(texto, { hechos, recientes: ['Otro tuit sin cifras de puntos'] });
  const con = revisar(texto, { hechos, recientes: ['Pico es baja y va a 5,1 puntos de media'] });
  bien(!sin.some((e) => /ya daba la media/.test(e)), 'una media tras un tuit sin media: pasa');
  bien(con.some((e) => /ya daba la media/.test(e)), 'una media tras otro tuit con media: no pasa');
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
