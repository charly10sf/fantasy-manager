// Cuándo da el bot por definitivos los puntos de un partido (lib/dazn.mjs). Caso real: el Sevilla-Alavés (0-0) del 6 nov, J12. A las
// 23:01, seis minutos tras el pitido, la valoración DAZN ya estaba y faltaba lo de la portería a cero: el tweet salió con Sivera 10
// (acabó con 15). Sin red: partido y fichas inventados con los números de aquella noche.
import { crearDazn, huellaPartido, faltaPorteriaCero } from '../lib/dazn.mjs';

let fallos = 0;
const ok = (c, txt) => { if (!c) fallos++; console.log(`${c ? 'ok   ' : 'FALLA'} ${txt}`); };

const SAQUE = Date.parse('2026-11-06T20:00:00Z'), FIN = SAQUE + 115 * 60e3;
const jug = (id, nick, pos, pts) => ({ id, nickname: nick, positionId: pos, weekPoints: pts });
// los puntos de las 23:01 y los de después
const provisional = { Sivera: 10, Vlachodimos: 0, 'Kike Salas': 3, 'Félix Correia': 7, Youssef: 5, 'T. Martínez': -2, Suazo: 4 };
const definitivo = { Sivera: 15, Vlachodimos: 10, 'Kike Salas': 8, 'Félix Correia': 10, Youssef: 10, 'T. Martínez': 1, Suazo: 9 };
const partido = (pts) => ({ id: 113, date: '2026-11-06T20:00:00.000Z', matchState: 7, localScore: 0, visitorScore: 0,
  local: { id: 15, mainName: 'Sevilla FC', players: [jug(2759, 'Vlachodimos', 1, pts.Vlachodimos), jug(2479, 'Kike Salas', 2, pts['Kike Salas']), jug(3262, 'Félix Correia', 3, pts['Félix Correia']), jug(2753, 'Suazo', 2, pts.Suazo)] },
  visitor: { id: 21, mainName: 'Deportivo Alavés', players: [jug(988, 'Sivera', 1, pts.Sivera), jug(2568, 'Youssef', 3, pts.Youssef), jug(3078, 'T. Martínez', 2, pts['T. Martínez'])] } });
// fichas: la valoración DAZN siempre puesta; la portería a cero, según `cero`
const fichas = (cero) => async (id) => ({ playerStats: [{ weekNumber: 12, stats: { mins_played: [90, 2], marca_points: [-1, 3], goals_conceded: [0, cero ? 4 : 0] } }] });

const correr = async ({ registro, m, cero, min }) => crearDazn({ ficha: fichas(cero), jornada: 12, registro, minTrasFinal: 90, minEstable: 40, esperaHoras: 6,
  ahora: () => FIN + min * 60e3, log: () => {} })(m);

// 1. la noche del 6 nov: cada 5 min, puntos provisionales y sin la portería a cero hasta el minuto 50; definitivos desde entonces
{
  const registro = { datos: {} };
  let primero = null;
  for (let min = 6; min <= 200; min += 5) {
    const def = min >= 50;
    const r = await correr({ registro, m: partido(def ? definitivo : provisional), cero: def, min });
    if (r.listo && primero == null) primero = min;
  }
  ok(primero != null && primero >= 90, `el Sevilla-Alavés sale a los ${primero} min del final (antes salía a los 6, con los puntos a medias)`);
  ok(primero <= 100, 'y no mucho más tarde de los 90 min con los puntos quietos');
}

// 2. a los 6 min no está listo aunque la valoración DAZN ya esté (el fallo de aquella noche)
{
  const r = await correr({ registro: { datos: {} }, m: partido(provisional), cero: false, min: 6 });
  ok(!r.listo, `recién acabado: espera (${r.motivo})`);
}

// 3. la portería a cero sin sumar frena aunque haya pasado el tiempo y los puntos no se muevan
{
  const registro = { datos: {} };
  const m = partido(provisional);
  await correr({ registro, m, cero: false, min: 0 });
  const r = await correr({ registro, m, cero: false, min: 120 });
  ok(!r.listo && /portería a cero/.test(r.motivo), `sin la portería a cero: espera (${r.motivo})`);
  const r2 = await correr({ registro, m, cero: true, min: 125 });
  ok(r2.listo, 'con la portería a cero sumada: sale');
}

// 4. un cambio de puntos a los 100 min vuelve a contar la espera de 40 min
{
  const registro = { datos: {} };
  await correr({ registro, m: partido(provisional), cero: true, min: 0 });
  const a = await correr({ registro, m: partido(definitivo), cero: true, min: 100 });
  ok(!a.listo && /sin cambiar/.test(a.motivo), `los puntos acaban de cambiar: espera (${a.motivo})`);
  const b = await correr({ registro, m: partido(definitivo), cero: true, min: 141 });
  ok(b.listo, '40 min después sin cambios: sale');
}

// 5. pasadas 6 h sale aunque falte algo (y lo dice)
{
  const registro = { datos: {} };
  await correr({ registro, m: partido(provisional), cero: false, min: 0 });
  const r = await correr({ registro, m: partido(provisional), cero: false, min: 6 * 60 + 5 });
  ok(r.listo && r.porPlazo, 'pasadas 6 h: sale con lo que haya');
}

// 6. el bot lo ve acabado tarde (estaba parado): el final se cuenta desde las 2 h del saque, no desde que lo vio
{
  const registro = { datos: {} };
  const m = partido(definitivo);
  const tarde = crearDazn({ ficha: fichas(true), jornada: 12, registro, minTrasFinal: 90, minEstable: 40, ahora: () => SAQUE + 5 * 3600e3, log: () => {} });
  const r1 = await tarde(m);
  ok(!r1.listo && /sin cambiar/.test(r1.motivo) && !/desde el final/.test(r1.motivo), `visto 5 h tras el saque: solo espera a ver los puntos quietos (${r1.motivo})`);
}

// 7. sin registro (Telegram): el final a los 115 min del saque y sin la prueba de los puntos quietos
{
  const sin = (min, cero) => crearDazn({ ficha: fichas(cero), jornada: 12, minTrasFinal: 90, ahora: () => SAQUE + min * 60e3, log: () => {} })(partido(definitivo));
  ok(!(await sin(150, true)).listo, 'Telegram, a los 35 min del final: espera');
  ok((await sin(210, true)).listo, 'Telegram, a los 95 min del final y con todo sumado: listo');
  ok(!(await sin(210, false)).listo, 'Telegram, sin la portería a cero: espera');
}

// 8. piezas
ok(huellaPartido(partido(provisional)) !== huellaPartido(partido(definitivo)), 'la huella cambia si cambia un punto');
ok(faltaPorteriaCero({ mins_played: [90, 2], goals_conceded: [0, 0] }) && !faltaPorteriaCero({ mins_played: [90, 2], goals_conceded: [0, 4] }), 'portería a cero: con y sin los puntos');
ok(!faltaPorteriaCero({ mins_played: [45, 1], goals_conceded: [0, 0] }), 'portero que jugó menos de 60 min: no cuenta');

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
