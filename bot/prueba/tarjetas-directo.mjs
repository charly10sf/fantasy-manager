// Las tarjetas del directo con datos reales (7 nov): la carta suelta de un gol, la de gol y asistencia y una roja del partido que se
// pida (o del primero que esté en juego), como si el partido siguiera en juego (--vivo=1, por defecto) o acabado (--vivo=0).
//   node bot/prueba/tarjetas-directo.mjs --salida=/tmp/directo --jornada=12 [--partido=<id>] [--vivo=1] [--cero=1]
// --cero=1 pone los puntos de hoy a 0 (LaLiga aún no ha sumado la jugada): sin placa de PTS, el minuto «EN JUEGO».
import { mkdirSync, writeFileSync } from 'node:fs';
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const salida = arg('salida') || '/tmp/directo', jornada = Number(arg('jornada') || 12), vivo = arg('vivo') !== '0', cero = arg('cero') === '1';
mkdirSync(salida, { recursive: true });
const LL = await import('../lib/laliga.mjs');
const { tarjetasDe } = await import('../lib/con-tarjetas.mjs');
const [stats, jugadores] = await Promise.all([LL.statsSemana(jornada), LL.jugadores()]);
const m = stats.find((x) => String(x.id) === String(arg('partido'))) || stats.find((x) => ![1, 7].includes(Number(x.matchState))) || stats.find((x) => x.matchState === 7);
if (!m) { console.log('no hay partido'); process.exit(1); }
m.matchState = vivo ? 4 : 7;
const ps = [...m.local.players, ...m.visitor.players].sort((a, b) => b.weekPoints - a.weekPoints);
if (cero) for (const p of ps) p.weekPoints = 0;
console.log(`${m.local.mainName} ${m.localScore}-${m.visitorScore} ${m.visitor.mainName} (${vivo ? 'en juego' : 'acabado'})`);
const ctx = { stats, jugadores, jornada, config: { tarjetas: {} }, forzar: true };
const base = { tipo: 'directo', partido: m.id, minutoTxt: "64'", marcador: [m.localScore, m.visitorScore] };
const casos = [
  ['gol-asis', [{ jugadorId: ps[0].id, motivo: 'gol' }, { jugadorId: ps[1].id, motivo: 'asistencia' }]],
  ['gol', [{ jugadorId: ps[0].id, motivo: 'doblete' }]],
  ['roja', [{ jugadorId: ps[ps.length - 1].id, motivo: 'roja' }]],
];
let malas = 0;
for (const [n, tarjetas] of casos) for (const t of await tarjetasDe({ ...base, tarjetas }, ctx)) {
  writeFileSync(`${salida}/${n}.png`, t.png || Buffer.alloc(0));
  if (!t.ok) { malas++; writeFileSync(`${salida}/${n}.svg`, t.svg); }
  console.log(t.ok ? 'ok   ' : 'FALLA', n, t.ok ? '' : t.errores.slice(0, 4));
}
process.exit(malas ? 1 : 0);
