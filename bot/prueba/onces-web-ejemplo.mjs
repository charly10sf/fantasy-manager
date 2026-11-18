// Los onces probables de la web (sesión 3 de AdSense, idea 12), sin red: el % de cada uno, la formación del último once, las dudas
// («X o Y, 55/45»), quién no juega y quién vuelve, los cambios frente a la jornada anterior, el once confirmado con su acierto, el texto
// (sin frases calcadas) y cuándo toca mirar los oficiales.   node bot/prueba/onces-web-ejemplo.mjs
import assert from 'node:assert/strict';
import { probTitular, mejorOnce, hechosOnces, confirmar, aciertoDe, textoEquipo, contenidoOnces, bloqueFicha, apartadoPrevia, lineaResumen } from '../web/onces.mjs';
import { pendientes, tocaOnces, casarTitulares } from '../web/confirmados.mjs';

// un equipo inventado: 4-3-3 la jornada pasada; un lateral lesionado, un medio en duda, dos delanteros a la par y uno que vuelve
const H = 36e5, ahora = Date.parse('2026-11-18T12:00:00Z'), saque = Date.parse('2026-11-21T15:15:00Z');
const jor = (min) => [8, 9, 10, 11, 12].map((J, i) => ({ J, min: min[i] }));
const b = (a, bb) => ({ p: 0.6 * a + 0.4 * bb, a, b: bb });
let n = 0;
const x = (nombre, pos, a, bb, min, extra = {}) => ({ id: String(++n), nombre, pos, b: b(a, bb), jugados: 10, estado: 'ok', ok: true, valor: 10e6 - n * 1e5, jornadas: jor(min), ...extra });
const plantilla = [
  x('Portero Uno', 1, 1, 1, [90, 90, 90, 90, 90]), x('Portero Dos', 1, 0, 0.1, [0, 0, 0, 0, 0]),
  x('Lateral A', 2, 1, 0.9, [90, 90, 90, 90, 90]), x('Central B', 2, 1, 1, [90, 90, 90, 90, 90]), x('Central C', 2, 0.8, 0.8, [90, 90, 0, 90, 90]),
  x('Lateral D', 2, 1, 0.9, [90, 90, 90, 90, 90], { estado: 'injured', ok: false }), x('Lateral E', 2, 0.4, 0.3, [0, 70, 0, 0, 65]),
  x('Medio F', 3, 1, 1, [90, 90, 90, 90, 90]), x('Medio G', 3, 1, 0.9, [90, 90, 90, 90, 90], { estado: 'doubtful', ok: false }), x('Medio H', 3, 0.8, 0.7, [90, 0, 90, 90, 80]),
  x('Medio I', 3, 0.2, 0.3, [20, 10, 70, 0, 15]),
  x('Delantero J', 4, 1, 1, [90, 90, 90, 90, 90]), x('Delantero K', 4, 0.6, 0.6, [70, 0, 75, 0, 80]), x('Delantero L', 4, 0.6, 0.5, [0, 75, 0, 80, 10]),
  x('Delantero M', 4, 0.6, 0.6, [61, 62, 0, 63, 85]), x('Delantero Vuelve', 4, 0, 0.8, [0, 0, 0, 0, 0]),
];
assert.equal(probTitular(plantilla.find((y) => y.nombre === 'Lateral D')), null, 'el lesionado no entra');
assert.ok(Math.abs(probTitular(plantilla.find((y) => y.nombre === 'Medio G')) - 0.6 * 0.96) < 1e-9, 'la duda, por 0,6');
assert.equal(probTitular(plantilla[0]), 0.95, 'nadie pasa del 95 %');
// la formación: la del último once si cabe; si no, la que más suma
const cands = (xs) => xs.map((y) => ({ ...y, p: probTitular(y) })).filter((y) => y.p).sort((a, c) => c.p - a.p);
assert.equal(mejorOnce(cands(plantilla), [4, 3, 3]).formacion, '4-3-3');
assert.equal(mejorOnce(cands(plantilla), [5, 4, 1]).formacion !== '5-4-1', true, 'si no hay cinco defensas, otra');

const q = { id: '7', nombre: 'Osasuna', slug: 'osasuna', escudoUrl: null, jugadores: plantilla, resultados: [10, 11, 12].map((J) => ({ J })),
  proximos: [{ J: 13, t: saque, rival: 'Málaga', rivalId: '8', casa: true }] };
const Hx = { equipos: [q] };
const raw = [{ id: '16', name: 'Delantero Vuelve', nickname: 'Delantero Vuelve', teamId: '7' }];
const partes = [{ nombre: 'Delantero Vuelve', slug: 'delantero-vuelve', estado: 'disponible', dias: 24, lesion: 'Rotura fibrilar' }];
const o = hechosOnces(Hx, { J: 13, jugadores: raw, partes, ahora });
const y = o.equipos[0];
assert.equal(y.once.length, 11);
assert.equal(y.formacion, '4-3-3');
assert.ok(!y.once.some((z) => z.nombre === 'Lateral D'), 'el lesionado, fuera del once');
assert.deepEqual(y.fuera.map((z) => z.nombre), ['Lateral D']);
assert.ok(y.once.find((z) => z.nombre === 'Medio G').duda, 'la duda de LaLiga se marca');
const dDel = y.dudas.find((d) => d.linea === 4);
assert.ok(dDel, 'arriba hay duda entre los dos que van a la par');
assert.ok(dDel.pa >= 45 && dDel.pa <= 60, `${dDel.pa}`);
assert.deepEqual(y.vuelven.map((z) => z.nombre), ['Delantero Vuelve']);
assert.ok(y.cambios && y.cambios.salen.some((z) => z.nombre === 'Lateral D' && z.por === 'lesionado'), 'se cae el lesionado del once de la J12');
const t = textoEquipo(y, 13).join(' ');
assert.match(t, /Lateral D \(lesionado\)/);
assert.match(t, /\d+\/\d+/);
assert.match(t, /vuelve tras 24 días|llevaba 24 días/);
assert.doesNotMatch(t, /\.\.|\s{2}|faltan Lateral D \(/, 'sin dobles puntos ni plural con uno solo');

// otro equipo con el mismo caso: las frases no salen calcadas (cambian con el equipo)
const frases = new Set();
for (let k = 0; k < 12; k++) frases.add(textoEquipo({ ...y, id: String(100 + k) }, 13)[0].replace(/[A-Z]\w+ [A-Z]\b/g, 'N'));
assert.ok(frases.size >= 2, 'varias formas de decir la duda');

// la página: sin JS, con el % de cada uno, el ancla de cada equipo y el enlace al método
const html = contenidoOnces(o, {});
assert.ok(!/<script/i.test(html));
assert.match(html, /<h1>Onces probables de la jornada 13/);
assert.match(html, /id="osasuna"/);
assert.match(html, /95 %/);
assert.match(html, /metodo\.html#onces/);
assert.match(bloqueFicha(y, 13), /El once probable para la jornada 13/);
assert.match(apartadoPrevia(o, 13), /id="onces"/);
assert.match(apartadoPrevia(null, 13), /onces probables de la jornada/);

// el confirmado sustituye al probable y se cuenta el acierto
const once = y.once.map((z) => ({ id: z.id, nombre: z.nombre, pos: ['', 'POR', 'DEF', 'MED', 'DEL'][z.pos] }));
// el último del probable no juega: entra uno de los delanteros que no estaban
const otro = plantilla.find((z) => z.pos === 4 && z.estado === 'ok' && !once.some((w) => w.id === z.id));
const oficial = [...once.slice(0, 10), { id: otro.id, nombre: otro.nombre, pos: 'DEL' }];
assert.equal(confirmar(o, '7', oficial), true);
assert.equal(confirmar(o, '7', oficial), false, 'una vez');
const ac = aciertoDe(o);
assert.equal(ac.n, 11);
assert.equal(ac.ok, 10);
assert.match(textoEquipo(o.equipos[0], 13)[0], /confirmado|oficial|Pleno/);
assert.match(contenidoOnces(o, {}), /1 de 1 ya confirmados/);
assert.match(lineaResumen(ac, 13), new RegExp(`de 11 titulares, acertamos ${ac.ok}`));
// la noche siguiente, el confirmado no se toca
const o2 = hechosOnces(Hx, { J: 13, jugadores: raw, partes, previo: o, ahora: ahora + 12 * H });
assert.deepEqual(o2.equipos[0].confirmado, o.equipos[0].confirmado);
// la jornada siguiente: los cambios se cuentan contra el confirmado y sale el acierto de la anterior
const q14 = { ...q, proximos: [{ J: 14, t: saque + 7 * 24 * H, rival: 'Betis', rivalId: '9', casa: false }], resultados: [...q.resultados, { J: 13 }] };
const o3 = hechosOnces({ equipos: [q14] }, { J: 14, jugadores: raw, partes: [], previo: o, ahora: ahora + 7 * 24 * H });
assert.equal(o3.equipos[0].anterior.fuente, 'confirmado');
assert.equal(o3.aciertoAnterior.J, 13);
assert.match(contenidoOnces(o3, {}), /En la jornada 13 acertamos/);

// cuándo mirar los oficiales: de 70 min antes a 30 después del saque, una vez por hora de saque
const m = { id: 1, date: new Date(saque).toISOString(), local: { id: '7', mainName: 'Osasuna' }, visitor: { id: '8', mainName: 'Málaga' } };
const sinConf = hechosOnces(Hx, { J: 13, jugadores: raw, partes, ahora });
assert.equal(pendientes([m], sinConf, saque - 3 * H).length, 0, 'tres horas antes, todavía no');
assert.equal(pendientes([m], sinConf, saque - 60 * 6e4).length, 1);
assert.equal(pendientes([m], o, saque - 60 * 6e4).length, 0, 'con el confirmado ya puesto, nada');
const k = tocaOnces([m], sinConf, {}, saque - 62 * 6e4);
assert.equal(k, `13|${saque}`);
assert.equal(tocaOnces([m], sinConf, { [k]: 1 }, saque - 50 * 6e4), '', 'esa hora de saque ya se lanzó');

// casar los titulares oficiales con LaLiga: los once, o nada
const pl = plantilla.map((z) => ({ id: z.id, nickname: z.nombre, positionId: z.pos }));
const roster = { roster: once.map((z) => ({ starter: true, athlete: { displayName: z.nombre }, position: { abbreviation: z.pos === 'POR' ? 'G' : 'M' } })) };
assert.equal(casarTitulares(roster, pl).filter((z) => z.id).length, 11);
assert.equal(casarTitulares({ roster: roster.roster.slice(0, 10) }, pl), null, 'con diez, todavía no');

console.log('onces de la web: BIEN');
