// Prueba sin red del parón de selecciones (lib/paron.mjs; Domy y Carlos, 9 nov): las caídas de la jornada de después del parón
// no salen hasta 72 h antes de su primer partido; una semana normal no cambia.
//   node bot/prueba/paron-ejemplo.mjs
// Fechas reales de LaLiga 2026-27 (statsSemana, sacadas el 9 nov): la J12 acabó el domingo 8 nov a las 21:00 y la J13 empieza el
// viernes 20 nov a las 21:00; la J11 acabó el lunes 2 nov y la J12 empezó el viernes 6.
import { esperaParon } from '../lib/paron.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const J = (...fechas) => fechas.map((date, i) => ({ id: i + 1, date }));
const j11 = J('2026-10-30T20:00:00Z', '2026-11-01T15:00:00Z', '2026-11-02T20:00:00Z');
const j12 = J('2026-11-06T20:00:00Z', '2026-11-07T13:00:00Z', '2026-11-08T20:00:00Z');
const j13 = J('2026-11-20T20:00:00Z', '2026-11-22T17:30:00Z', '2026-11-23T20:00:00Z');
const j14 = J('2026-11-27T20:00:00Z', '2026-11-30T20:00:00Z');
const t = (s) => Date.parse(s);

const caso = (nombre, args, quiero) => {
  const r = esperaParon(args);
  const ok = r.espera === quiero;
  console.log(`${ok ? 'BIEN' : 'MAL '} ${nombre}: espera=${r.espera}${r.hueco != null ? ` · ${r.hueco.toFixed(1)} días` : ''}${r.desde ? ` · desde ${new Date(r.desde).toISOString()}` : ''}`);
  if (!ok) falla(nombre);
  return r;
};

// el caso del 9 nov: lunes del parón, 07:02 de Madrid
const r = caso('lunes del parón (9 nov, 07:02)', { siguiente: j13, anterior: j12, ahora: t('2026-11-09T06:02:00Z') }, true);
if (r.desde !== t('2026-11-17T20:00:00Z')) falla(`desde: ${new Date(r.desde).toISOString()} (quiero el martes 17 a las 21:00 de Madrid)`);
caso('jueves del parón (12 nov)', { siguiente: j13, anterior: j12, ahora: t('2026-11-12T10:00:00Z') }, true);
caso('martes 17, 20:59 de Madrid', { siguiente: j13, anterior: j12, ahora: t('2026-11-17T19:59:00Z') }, true);
caso('martes 17, 21:00 de Madrid (72 h antes)', { siguiente: j13, anterior: j12, ahora: t('2026-11-17T20:00:00Z') }, false);
caso('miércoles 18 por la mañana', { siguiente: j13, anterior: j12, ahora: t('2026-11-18T08:00:00Z') }, false);
// semanas normales: no espera nunca
caso('semana normal: martes 3 nov (J11 → J12)', { siguiente: j12, anterior: j11, ahora: t('2026-11-03T08:00:00Z') }, false);
caso('semana normal: lunes 24 nov (J13 → J14)', { siguiente: j14, anterior: j13, ahora: t('2026-11-24T08:00:00Z') }, false);
// sin datos de alguna de las dos jornadas: no se para nada
caso('sin la jornada anterior', { siguiente: j13, anterior: [], ahora: t('2026-11-09T06:02:00Z') }, false);
caso('sin la jornada siguiente', { siguiente: [], anterior: j12, ahora: t('2026-11-09T06:02:00Z') }, false);
caso('fechas raras (la siguiente antes que la anterior)', { siguiente: j12, anterior: j13, ahora: t('2026-11-09T06:02:00Z') }, false);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
