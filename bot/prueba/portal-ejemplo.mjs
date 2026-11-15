// Prueba sin red del portal de datos de la web (bot/portal-web.mjs y bot/web/portal.mjs, mercado.mjs, resumen.mjs): con una API falsa,
// el mercado de hoy, los equipos, lo que lee la portada, el resumen de una jornada acabada y la página de las jornadas. Mira que no se
// cuele ningún «undefined» ni «NaN», que el HTML vaya escapado, que solo salgan imágenes de LaLiga y que las cuentas cuadren.
import assert from 'node:assert/strict';
import { hechosMercado, contenidoMercado, contenidoEquipos, hoyJson } from '../web/mercado.mjs';
import { hechosResumen, contenidoResumen, contenidoJornadas } from '../web/resumen.mjs';
import { cara, minigrafica, chipPuntos, clasePuntos, slug, graficaValor, barrasPuntos } from '../web/portal.mjs';
import { hechosFichas, contenidoEquipo, contenidoJugador, contenidoJugadores, metasEquipo, metasJugador, cuando } from '../web/fichas.mjs';

const DIA = 864e5;
const hoy = Date.parse('2026-11-15T10:00:00Z');
const medianoche = (k) => Date.parse('2026-11-14T23:00:00Z') - k * DIA;   // 00:00 de Madrid de hace k días
const EQ = ['Barça', 'Real Madrid', 'Atlético', 'Betis', 'Villarreal', 'Athletic', 'Valencia', 'Sevilla', 'Celta', 'Osasuna', 'Getafe', 'Rayo'];
const IMG = (k) => `https://assets-fantasy.llt-services.com/players/t1/p${k}/256x256/p${k}_t1_1_001_000.png?v=123`;
const ESC = (k) => `https://assets-fantasy.llt-services.com/teambadge/t${k}/color/t${k}_x.png`;

// 144 jugadores, 12 por equipo; el 0 sube 10 días seguidos y el 1 baja 5; uno con un nombre con <b> para el escape
const jug = [];
for (let k = 0; k < 144; k++) jug.push({ id: String(k), nickname: k === 7 ? 'Raro <b>&' : `Jugador ${k}`, positionId: String((k % 4) + 1), teamId: String(k % 12),
  marketValue: String(5e6 + k * 1e5), averagePoints: (k % 9) / 1.5, points: 30 + k % 40, playerStatus: k === 3 ? 'injured' : 'ok', image: k === 5 ? 'https://otra.web/x.png' : IMG(k) });
const hist = (k) => Array.from({ length: 40 }, (_, i) => {
  const d = 39 - i;   // días atrás
  const base = 5e6 + k * 1e5;
  const v = k === 0 ? base + (d < 10 ? (10 - d) * 3e5 : 0) : k === 1 ? base - (d < 5 ? (5 - d) * 2e5 : 0) : base + ((i * (k + 3)) % 7) * 1e4;
  return { date: new Date(medianoche(d)).toISOString(), marketValue: v };
});
const partido = (i, J, estado) => ({ id: i, date: new Date(Date.parse('2026-11-20T20:00:00Z') + i * 3 * 36e5 + (J - 13) * 7 * DIA).toISOString(), matchState: estado, localScore: estado === 7 ? i % 3 : null, visitorScore: estado === 7 ? 1 : null,
  local: { id: 2 * i % 12, mainName: EQ[2 * i % 12], badgeColor: ESC(2 * i % 12), players: [] }, visitor: { id: (2 * i + 1) % 12, mainName: EQ[(2 * i + 1) % 12], badgeColor: ESC((2 * i + 1) % 12), players: [] } });
const semana = (J) => {
  const estado = J <= 12 ? 7 : 1;
  const ps = Array.from({ length: 6 }, (_, i) => partido(i, J, estado));
  if (estado === 7) for (const p of ps) for (const lado of [p.local, p.visitor]) for (const j of jug.filter((x) => Number(x.teamId) === lado.id))
    lado.players.push({ id: Number(j.id), nickname: j.nickname, positionId: Number(j.positionId), weekPoints: (Number(j.id) * 7) % 17 - 2, images: { transparent: { '256x256': IMG(j.id) } } });
  return ps;
};
// los puntos de cada jornada en la lista y la ficha de cada uno (minutos, goles, paradas…), para las fichas de la fase 2
for (const j of jug) j.weekPoints = Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, points: (Number(j.id) * 7 + i) % 17 - 2 }));
const st = (v) => [v, 0];
const ficha = (id) => ({ id, name: id === '0' ? 'Jugador Cero Completo' : `Jugador ${id}`, nickname: `Jugador ${id}`, playerStats: Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1,
  totalPoints: (Number(id) * 7 + i) % 17 - 2, stats: { mins_played: st(Number(id) % 3 === 0 && i % 2 ? 0 : 90 - (Number(id) % 4) * 10), goals: st(i % 5 === 0 ? 1 : 0), goal_assist: st(0),
    yellow_card: st(i < 4 && Number(id) === 2 ? 1 : 0), red_card: st(0), second_yellow_card: st(0), saves: st(Number(id) % 4 === 0 ? 3 : 0), goals_conceded: st(i % 3) } })) });
const api = {
  ficha: async (id) => ficha(String(id)),
  jugadores: async () => jug, valorMercado: async (id) => hist(Number(id)), statsSemana: async (J) => semana(J),
  semanaActual: async () => ({ weekNumber: 13, nextWeek: 14, previousWeek: 12 }),
};

// las piezas
assert.match(cara({ caraUrl: IMG(1), escudoUrl: ESC(1), nombre: "Fermín", pos: 3, equipo: "Barça" }), /<img class="cara[^"]*" src="https:\/\/assets-fantasy[^"]+\?v=123"/);
assert.match(cara({ caraUrl: IMG(1), escudoUrl: ESC(1), nombre: "F", pos: 3 }), /<\/span><img class="esc"/, "el escudo, fuera del círculo");
assert.doesNotMatch(cara({ caraUrl: 'https://otra.web/x.png', nombre: 'A B' }), /<img/, 'solo imágenes de LaLiga');
assert.match(cara({ nombre: 'Álex Baena' }), />ÁB</, 'sin foto, las iniciales');
assert.deepEqual([10, 9, 6, 5, 2, 1, 0, -3].map(clasePuntos), ['p10', 'p6', 'p6', 'p2', 'p2', 'p1', 'p1', 'p1']);
assert.match(chipPuntos(-2), /class="pts p1"/);
assert.equal(minigrafica([1]), '', 'una sola cifra no es una gráfica');
assert.match(minigrafica([1, 2, 3]), /class="mini sube"/);
assert.match(minigrafica([3, 2, 1]), /class="mini baja"/);
assert.equal(slug('Álex Baena'), 'alex-baena');
assert.equal(slug('Vini Jr.'), 'vini-jr');
assert.match(graficaValor([{ t: hoy - DIA, v: 1e6 }, { t: hoy, v: 2e6 }]), /<svg class="graf sube"/);
assert.match(barrasPuntos([[1, 12], [2, -1], [3, 4]]), /J2: -1 puntos/);

// el mercado
assert.equal(await hechosMercado(api, { ahora: hoy + 3 * DIA }), null, 'sin el valor de hoy, nada');
const hm = await hechosMercado(api, { ahora: hoy });
assert.ok(hm, 'con el valor de hoy');
assert.equal(hm.dia, '2026-11-15');
assert.equal(hm.jugadores, 144);
assert.equal(hm.nSuben + hm.nBajan + hm.nIgual, 144);
assert.equal(hm.suben[0].id, '0', 'el 0 es el que más sube');
assert.equal(hm.suben[0].racha, 10, 'diez días subiendo');
assert.equal(hm.bajan[0].id, '1');
assert.equal(hm.bajan[0].racha, -5);
assert.equal(hm.equipos.length, 12);
assert.equal(Math.round(hm.equipos.reduce((s, q) => s + q.valor, 0)), Math.round(hm.valorTotal), 'los equipos suman todo el mercado');
assert.equal(hm.proxima.jornada, 13);
assert.equal(hm.proxima.cierre, hm.proxima.primero - 24 * 36e5, 'el cierre, 24 h antes del primer partido');
const limpio = (html, que) => {
  assert.doesNotMatch(html, /undefined|NaN|\[object/, `${que}: sin huecos`);
  assert.doesNotMatch(html, /Raro <b>/, `${que}: escapado`);
  assert.doesNotMatch(html, /otra\.web/, `${que}: solo imágenes de LaLiga`);
};
const cm = contenidoMercado(hm, { previa: 'guias/jornada-13.html', resumen: { ruta: 'jornada/resumen-jornada-12.html', jornada: 12 } });
limpio(cm, 'mercado');
assert.match(cm, /<h1>Mercado de <span>LaLiga Fantasy<\/span> hoy<\/h1>/);
assert.match(cm, /href="\.\.\/guias\/jornada-13\.html"/);
assert.match(cm, /10 días, desde el/);
const ce = contenidoEquipos(hm);
limpio(ce, 'equipos');
assert.equal((ce.match(/<tr><td>\d+<\/td>/g) || []).length, 12);
const hj = hoyJson(hm, { previa: 'guias/jornada-13.html' });
assert.equal(hj.suben.length, 5);
assert.equal(hj.jornada.n, 13);
assert.doesNotMatch(JSON.stringify(hj), /undefined|NaN/);

// el resumen
assert.equal(hechosResumen(13, semana(13), jug), null, 'una jornada sin jugar no tiene resumen');
const hr = hechosResumen(12, semana(12), jug, { ahora: hoy });
assert.ok(hr);
assert.equal(hr.partidos.length, 6);
assert.equal(hr.once.lineas.flat().length, 11, 'el once tiene once');
assert.equal(hr.once.lineas[0].length, 1, 'un portero');
assert.equal(hr.once.suma, hr.once.lineas.flat().reduce((s, x) => s + x.pts, 0));
assert.ok(hr.mejores[0].pts >= hr.mejores[9].pts);
assert.ok(hr.peores.every((x) => x.pts < 0));
for (const p of hr.partidos) assert.equal(p.mvp.pts, Math.max(...p.jugadores.map((x) => x.pts)), 'el MVP es el que más puntos saca');
const cr = contenidoResumen(hr, { previa: 'guias/jornada-12.html', siguiente: { ruta: 'guias/jornada-13.html', jornada: 13 }, tarjeta: 'img/resumen-12.webp', tarjetaAlto: 875 });
limpio(cr, 'resumen');
assert.match(cr, /Once ideal de la jornada 12/);
assert.match(cr, /height="875"/);
const cj = contenidoJornadas({ proxima: hm.proxima, previas: [{ ruta: 'guias/jornada-13.html', jornada: 13 }], resumenes: [{ ruta: 'jornada/resumen-jornada-12.html', jornada: 12 }], ultimo: { jornada: 12, mejores: hr.mejores.slice(0, 3) } });
limpio(cj, 'jornadas');
assert.match(cj, /Jornada 13<\/b><span><a href="\.\.\/guias\/jornada-13\.html">Previa<\/a><\/span>/);
assert.match(cj, /resumen-jornada-12\.html">Resumen/);
assert.doesNotMatch(cj, /Todas las jornadas<\/a>/, 'la de las jornadas no se enlaza a sí misma');
// las fichas (fase 2): equipos y jugadores
const H = await hechosFichas(api, hm, { estado: { jugadores: { 9: 'jugador-9' } }, max: 20, ahora: hoy });
assert.ok(H, 'con jornadas jugadas, fichas');
assert.equal(H.ultimaJugada, 12);
assert.equal(H.equipos.length, 12);
assert.equal(H.jugadores.length, 20, 'como mucho max');
assert.ok(H.jugadores.some((x) => x.id === '9'), 'el que ya tenía página se queda');
assert.equal(H.slugs.jugadores['9'], 'jugador-9', 'y su URL no cambia');
assert.equal(new Set(Object.values(H.slugs.jugadores)).size, Object.keys(H.slugs.jugadores).length, 'URL sin repetir');
assert.ok(H.jugadores.every((x) => x.pesa || x.id === '9'));
for (const q of H.equipos) {
  assert.equal(q.resultados.length, 12, `${q.nombre}: un partido por jornada`);
  assert.deepEqual(q.resultados.map((r) => r.J), [...q.resultados.map((r) => r.J)].sort((a, b) => a - b), 'por jornada');
  assert.ok(q.proximos.length >= 2 && q.proximos.length <= 4, 'próximos rivales');
  assert.equal(q.aCero, q.resultados.filter((r) => r.gc === 0).length);
  assert.equal(q.puntosTotal, q.ptsJ.reduce((s, [, p]) => s + p, 0));
  assert.ok(q.serie.length >= 30, 'la evolución del valor');
  const c = contenidoEquipo(q, H);
  limpio(c, `equipo ${q.nombre}`);
  assert.match(c, /Próximos rivales/);
  assert.match(metasEquipo(q).ruta, /^equipos\/[a-z0-9-]+\.html$/);
}
const x0 = H.todos.find((x) => x.id === '0');
assert.equal(x0.nombreCompleto, 'Jugador Cero Completo');
assert.equal(x0.jornadas.length, 12);
assert.equal(x0.titular, x0.jornadas.filter((r) => r.min >= 60).length);
for (const x of H.jugadores) {
  const c = contenidoJugador(x, H);
  limpio(c, `jugador ${x.nombre}`);
  assert.match(c, /Jornada a jornada/);
  assert.match(metasJugador(x).ruta, /^jugadores\/[a-z0-9-]+\.html$/);
  assert.ok(metasJugador(x).titulo.length <= 70);
}
const ix = contenidoJugadores(H);
limpio(ix, 'jugadores');
assert.equal((ix.match(/class="fj"/g) || []).length, 20, 'todos en el índice');
// con las rutas, el mercado y /equipos/ enlazan a las fichas
const cm2 = contenidoMercado(hm, { rutas: H.rutas });
assert.match(cm2, /href="\.\.\/jugadores\/[a-z0-9-]+\.html"/);
assert.match(contenidoEquipos(hm, { rutas: H.rutas, jugadores: 20 }), /href="[a-z0-9-]+\.html"/);
assert.equal(cuando(Date.parse('2026-12-06T00:00:00Z')), 'domingo 6 de diciembre, hora por confirmar');
assert.match(cuando(Date.parse('2026-12-06T20:00:00Z')), /a las 21:00/);
console.log('portal-ejemplo: todo BIEN');
