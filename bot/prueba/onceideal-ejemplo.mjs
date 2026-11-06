// El once ideal, sin red: con 6 equipos inventados comprueba la cuenta (puntos esperados, cupo por club, formación), que el tweet largo y
// el de 280 pasan el validador, que la tarjeta pasa el validador de imágenes, el texto sin tarjeta y la ventana de 24-36 h.
//   node bot/prueba/onceideal-ejemplo.mjs
import { fijarLimite, peso } from '../lib/texto.mjs';
import { validar, validarTarjeta } from '../lib/validar.mjs';
import { PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';
import { svgOnceIdeal } from '../lib/tarjetas.mjs';
import { candidato, elegirIdeal, esperados, factoresRival, bonusPrecio, rachaReciente } from '../lib/once-ideal.mjs';
import { montar, generar } from '../tipos/onceideal.mjs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };

// --- la cuenta
const fila = (pos, pts, gf, gc, rgf, rgc, nivel) => ({ pos, n: 20, nivel, gf, gc, rgf, rgc, pts });
const facil = fila(18, 0, 0.8, 2.1, 18, 2, 'fácil'), dificil = fila(2, 0, 1.9, 0.7, 2, 19, 'difícil');
ok(factoresRival({ pos: 'DEL', riv: facil, enCasa: true }).goles === 1.06 && factoresRival({ pos: 'DEL', riv: facil, enCasa: true }).nivel === 1.08, 'delantero contra un rival que encaja mucho: 1,06 y fácil 1,08');
ok(factoresRival({ pos: 'DEF', riv: facil, enCasa: true }).goles === 1.06, 'defensa contra un rival que marca poco: 1,06');
ok(factoresRival({ pos: 'DEF', riv: dificil, enCasa: false }).goles === 0.94 && factoresRival({ pos: 'DEF', riv: dificil, enCasa: false }).casa === 0.97, 'defensa contra un ataque que marca mucho y fuera: 0,94 y 0,97');
ok(factoresRival({ pos: 'MED', riv: null, enCasa: null }).nivel === 1, 'sin tabla, todo 1');
ok(Math.abs(bonusPrecio(0) - 0.3) < 1e-9 && bonusPrecio(60e6) === 0 && bonusPrecio(150e6) === 0, 'el empujón al barato: 0,3 y 0 a partir de 60 M');
const wp = (xs) => xs.map(([w, p]) => ({ weekNumber: w, points: p }));
ok(rachaReciente({ weekPoints: wp([[3, 2], [8, 10], [9, 12], [11, 14]]) }, 11).n === 3, 'la racha solo mira las últimas 4 jornadas');
const J = (id, nombre, pos, teamId, media, valor, semanas = []) => ({ id, nickname: nombre, positionId: String(pos), teamId, averagePoints: media, marketValue: valor, weekPoints: wp(semanas), image: null });
const x = (p, o = {}) => ({ p, duda: false, estado: 'ok', ...o });
const e1 = esperados(J(1, 'A', 4, 1, 8, 50e6, [[9, 14], [10, 14], [11, 14]]), { p: 0.9, riv: facil, enCasa: true, ultima: 11 });
ok(Math.abs(e1.base - (0.6 * 8 + 0.4 * 14)) < 1e-9, `la base mezcla temporada y racha (${e1.base.toFixed(2)})`);
ok(Math.abs(e1.e - 0.9 * e1.base * 1.08 * 1.06 * 1.04) < 1e-9, `los puntos esperados multiplican titularidad y factores (${e1.e.toFixed(2)})`);

// --- una liga pequeña: 6 equipos con 2 porteros, 6 defensas, 6 medios y 5 delanteros cada uno
let id = 0;
const letras = (n) => [...n.toString(26)].map((c) => String.fromCharCode(97 + parseInt(c, 26))).join('');   // los nombres, sin cifras
const nombres = ['Alfa', 'Beta', 'Gama', 'Delta', 'Eps', 'Zeta'];
const clubes = nombres.map((n, i) => ({ id: i + 1, club: `Club ${n}`, corto: n }));
const jugadores = [], cands = [];
const pp = (i) => ({ rival: nombres[(i + 1) % 6], enCasa: i % 2 === 0, riv: i % 3 === 0 ? facil : i % 3 === 1 ? dificil : fila(9, 0, 1.3, 1.3, 10, 10, 'media') });
clubes.forEach((c, i) => {
  [['POR', 1, 2], ['DEF', 2, 5], ['MED', 3, 5], ['DEL', 4, 4]].forEach(([pos, posId, cuantos]) => {
    for (let k = 0; k < cuantos; k++) {
      id++;
      const media = 3 + ((id * 7) % 9) + (pos === 'DEL' ? 1 : 0);
      const valor = (1 + ((id * 13) % 60)) * 1e6;
      const j = J(id, `${c.corto} ${pos} ${letras(id)}`, posId, c.id, media, valor, [[9, media + 3], [10, media - 1], [11, media + 5]]);
      jugadores.push(j);
      // el segundo de cada puesto, con dudas
      const p = k === 0 ? 0.95 : k === 1 ? 0.7 : 0.2;
      cands.push(candidato(j, x(p, { duda: k === 1 && id % 5 === 0, estado: k === 1 && id % 5 === 0 ? 'doubtful' : 'ok' }), { ...pp(i), ultima: 11, equipo: c.corto, club: c.club, escudoUrl: null }));
    }
  });
});
const r = elegirIdeal(cands);
ok(r && r.once.length === 11, `sale un once de 11 (${r && r.formacion})`);
const por = (p) => r.once.filter((y) => y.pos === p).length;
ok(por('POR') === 1, 'un portero');
const [d, m, f] = r.formacion.split('-').map(Number);
ok(por('DEF') === d && por('MED') === m && por('DEL') === f, 'la formación cuadra con los puestos');
const porClub = {};
for (const y of r.once) porClub[y.teamId] = (porClub[y.teamId] || 0) + 1;
ok(Math.max(...Object.values(porClub)) <= 3, `como mucho 3 por club (${Object.values(porClub).join(',')})`);
ok(r.once.every((y) => y.p >= 0.6), 'todos con 60 % de titularidad o más');
ok(r.once[0].pos === 'POR' && r.once[r.once.length - 1].pos === 'DEL', 'ordenado de portero a delanteros');
// ninguna otra formación suma más con los mismos cupos
const mejorSuma = r.suma;
ok(['4-3-3', '4-4-2', '4-5-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1'].every((fm) => { const q = elegirIdeal(cands, { formaciones: [fm.split('-').map(Number)] }); return !q || q.suma <= mejorSuma + 1e-9; }), 'ninguna otra formación suma más');
ok(!elegirIdeal(cands.filter((y) => y.pos !== 'POR')), 'sin porteros no sale once');
// con muy pocos con 60 %, se relaja el corte
const flojos = cands.map((y) => ({ ...y, p: y.p * 0.5 }));
const rr = elegirIdeal(flojos);
ok(rr && rr.corte < 0.6, 'si con el 60 % no se llena ningún once, baja al 30 %');

// --- el tweet largo y el de 280
const comprobar = (t, max, etiqueta) => {
  const v = validar(t.texto, { numeros: t.numeros, max });
  ok(v.ok, `${etiqueta}: pasa el validador (peso ${v.peso}) ${v.errores.join('; ')}`);
  ok(!/undefined|NaN|\[object/.test(t.texto), `${etiqueta}: sin undefined ni NaN`);
  ok(/once ideal/i.test(t.texto) && /Fantasy Manager/.test(t.texto), `${etiqueta}: dice qué es`);
  ok(!/(\[|\]|¶|¦)/.test(t.texto), `${etiqueta}: sin marcas internas`);
};
fijarLimite(1000);
const formas = new Set();
for (const j of [12, 13, 14, 15, 16, 17]) {
  const t = montar({ jornada: j, r, cands });
  comprobar(t, 1000, `largo J${j}`);
  formas.add(t.texto.split('\n\n').map((p) => p.split(/[ ,:;]/).slice(0, 3).join(' ')).join('|'));
  if (j === 12) console.log(`\n${t.texto}\n`);
}
ok(formas.size >= 4, `6 jornadas, ${formas.size} esqueletos distintos`);
fijarLimite(280);
for (const j of [12, 13, 14]) { const t = montar({ jornada: j, r, cands }); comprobar(t, 280, `280 J${j}`); ok(peso(t.texto) <= 280, `280 J${j}: cabe (${peso(t.texto)})`); if (j === 12) console.log(`\n${t.texto}\n`); }
fijarLimite(1000);

// --- la tarjeta
const t0 = montar({ jornada: 12, r, cands });
const svg = svgOnceIdeal(t0.tarjeta.d);
const vt = validarTarjeta(svg, t0.tarjeta.permitidos, PALABRAS_FIJAS);
ok(vt.ok, `la tarjeta pasa el validador ${vt.errores.join('; ')}`);
ok(t0.tarjeta.d.once.length === 11 && t0.tarjeta.d.once.filter((y) => y.rol === 'apuesta').length === 1, 'la tarjeta lleva 11 y una apuesta');
// un nombre con un número o una palabra que no está en los datos no pasa
const mala = svg.replace('ONCE IDEAL', 'ONCE IDEAL 77');
ok(!validarTarjeta(mala, t0.tarjeta.permitidos, PALABRAS_FIJAS).ok, 'una cifra que no está en los datos no pasa');

// --- sin tarjeta
ok(t0.sinTarjeta && validar(t0.sinTarjeta.texto, { numeros: t0.sinTarjeta.numeros, max: 1000 }).ok, 'el texto sin tarjeta pasa el validador');
ok(r.once.every((y) => t0.sinTarjeta.texto.includes(y.nombre)), 'el texto sin tarjeta nombra a los once');
console.log(`\n${t0.sinTarjeta.texto}\n`);

// --- la ventana: 36 a 24 h antes (y 6 h de margen), de 9 a 23 h, una vez, y no si ya ha empezado la jornada
// (con partidos falsos y sin red: generar solo mira la ventana antes de pedir nada, así que basta con ver si devuelve algo o no)
const HORA = 36e5, cfg = { onceIdeal: { activo: true }, horasOnceIdeal: [0, 24] };   // sin límite de horas, para probar solo la ventana
const base = Date.parse('2026-11-13T20:00:00Z');                          // viernes 13 nov, 21:00 en Madrid: el primer partido
const stats = [{ id: 1, date: new Date(base).toISOString(), matchState: 1, local: { id: 1, mainName: 'Club Alfa' }, visitor: { id: 2, mainName: 'Club Beta' } }];
const aire = { claves: new Set(), datos: { enviados: [] } };
const sem = { weekNumber: 13, nextWeek: null };
const corre = async (ahora, extra = {}) => {
  // si pasa la ventana, intenta pedir los datos (no hay red ni equipos: no sale nada), pero antes loguea; lo que miramos es si llega ahí
  let llego = false;
  const inf = { probsDe: async () => { llego = true; return null; }, rival: async () => null };
  await generar({ semana: sem, jugadores, stats, jornada: 13, config: cfg, registro: aire, ventanas: true, forzar: false, ahora, info: inf, log: () => {}, ...extra });
  return llego;
};
ok(!(await corre(base - 40 * HORA)), 'a 40 h del primer partido: todavía no');
ok(await corre(base - 30 * HORA + 0), 'a 30 h: sí');
ok(await corre(base - 25 * HORA), 'a 25 h: sí');
ok(await corre(base - 20 * HORA), 'a 20 h (margen): sí');
ok(!(await corre(base - 10 * HORA)), 'a 10 h: ya no');
ok(!(await corre(base - 30 * HORA, { registro: { claves: new Set(['onceideal|13']), datos: { enviados: [] } } })), 'ya publicado: no se repite');
ok(!(await corre(base - 30 * HORA, { stats: [{ ...stats[0], matchState: 7 }] })), 'con un partido ya jugado: no sale');
ok(await corre(base - 30 * HORA, { ventanas: false }), 'sin ventanas (simulacro): sale cuando se pide');
// de 9 a 23 h (Madrid): a las 03:00 del jueves 12 nov, con el primer partido 30 h después, no sale; con 0-24 h, sí
const tres = Date.parse('2026-11-12T02:00:00Z');
const stats3 = [{ ...stats[0], date: new Date(tres + 30 * HORA).toISOString() }];
ok(!(await corre(tres, { stats: stats3, config: { onceIdeal: { activo: true } } })), 'a las 3 de la madrugada: no');
ok(await corre(tres, { stats: stats3 }), 'a las 3 de la madrugada con horas de 0 a 24: sí (era la hora, no la ventana)');
ok(!(await corre(base - 30 * HORA, { config: { onceIdeal: { activo: false } } })), 'apagado en config.json: no sale');

if (fallos) { console.log(`\n${fallos} fallos`); process.exit(1); }
console.log('\nTodo bien');
