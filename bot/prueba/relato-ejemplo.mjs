// Prueba de los tweets de partido (directo y final) con un ESPN falso y partidos inventados, sin llegar a ESPN ni a LaLiga:
//   node bot/prueba/relato-ejemplo.mjs [--tarjetas=carpeta]
// Enseña los textos, los pasa por el validador de siempre y, con --tarjetas, dibuja las tarjetas de cada jugador implicado.
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
const puerto = 8791;
process.env.ESPN_BASE = `http://127.0.0.1:${puerto}`;
const { generar: directo } = await import('../tipos/directo.mjs');
const { generar: final } = await import('../tipos/final.mjs');
const { validar } = await import('../lib/validar.mjs');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];

// --- partidos inventados -------------------------------------------------------------------------------------------------
const mk = (id, [idL, nL, jugL], [idV, nV, jugV], gl, gv, detalles, fecha) => ({
  stats: { id, date: fecha, matchState: 7, localScore: gl, visitorScore: gv,
    local: { id: idL, mainName: nL, badgeColor: '', players: jugL }, visitor: { id: idV, mainName: nV, badgeColor: '', players: jugV } },
  espn: { id: String(9000 + id), date: fecha, shortName: `${nL} v ${nV}`, status: { type: { state: 'post' }, displayClock: "90'" },
    competitions: [{ competitors: [{ homeAway: 'home', score: String(gl), team: { id: String(idL), displayName: nL } }, { homeAway: 'away', score: String(gv), team: { id: String(idV), displayName: nV } }], details: detalles }] } });
const P = (id, nick, teamId, pts, pos = 3) => ({ id, name: nick, nickname: nick, teamId, positionId: pos, weekPoints: pts });
const g = (min, team, quien, asis = null, extra = {}) => ({ scoringPlay: true, clock: { value: min * 60, displayValue: `${min}'` }, team: { id: String(team) }, athletesInvolved: [{ displayName: quien }, ...(asis ? [{ displayName: asis }] : [])], ...extra });
const roja = (min, team, quien) => ({ redCard: true, clock: { value: min * 60, displayValue: `${min}'` }, team: { id: String(team) }, athletesInvolved: [{ displayName: quien }] });
const fallo = (min, team, quien) => ({ penaltyKick: true, scoringPlay: false, clock: { value: min * 60, displayValue: `${min}'` }, team: { id: String(team) }, athletesInvolved: [{ displayName: quien }] });
const rell = (n, t) => Array.from({ length: n }, (_, i) => P(500 + t * 20 + i, `Relleno ${'abcdefghijklmnopqrstuvwxyz'[t % 26]}${'abcdefghijklmnop'[i]}`, t, i % 3));

const barca = [P(1, 'Raphinha', 83, 15), P(2, 'Lamine Yamal', 83, 11), P(3, 'Lewandowski', 83, 4, 4), ...rell(8, 83)];
const alaves = [P(11, 'Guridi', 3, 5), P(12, 'Kike García', 3, -2, 4), ...rell(9, 3)];
const m1 = mk(1, [83, 'FC Barcelona', barca], [3, 'Deportivo Alavés', alaves], 3, 1,
  [g(12, 3, 'Carlos Vicente'), g(30, 83, 'Raphinha', 'Lamine Yamal'), g(41, 83, 'Raphinha', 'Lamine Yamal'), roja(55, 3, 'Kike García'), fallo(60, 83, 'Robert Lewandowski'), g(88, 83, 'Lamine Yamal', null, { penaltyKick: true })], '2026-11-01T19:00:00Z');
const atm = [P(21, 'Griezmann', 13, 9), ...rell(10, 13)], sev = [P(31, 'Isaac Romero', 4, 8, 4), ...rell(10, 4)];
const m2 = mk(2, [13, 'Atlético de Madrid', atm], [4, 'Sevilla FC', sev], 1, 2, [g(20, 13, 'Antoine Griezmann'), g(70, 4, 'Isaac Romero'), g(91, 4, 'Isaac Romero', null, { clock: { value: 91 * 60, displayValue: "90'+1'" } })], '2026-11-01T17:00:00Z');
const m3 = mk(3, [20, 'Getafe CF', rell(11, 20)], [21, 'Elche CF', rell(11, 21)], 0, 0, [], '2026-11-01T15:00:00Z');
const m4 = mk(4, [22, 'Osasuna', [P(41, 'Moncayola', 22, 7), ...rell(10, 22)]], [23, 'Real Sociedad', [P(42, 'Oyarzabal', 23, 6), ...rell(10, 23)]], 1, 1, [g(35, 22, 'Jon Moncayola'), g(89, 23, 'Mikel Oyarzabal')], '2026-11-01T13:00:00Z');
const todos = [m1, m2, m3, m4];

// --- ESPN falso ---------------------------------------------------------------------------------------------------------
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (u.pathname.endsWith('/scoreboard')) return res.end(JSON.stringify({ events: todos.map((t) => t.espn) }));
  res.end(JSON.stringify({ keyEvents: [] }));
}).listen(puerto, '127.0.0.1');

const jugadores = [...barca, ...alaves, ...todos.flatMap((t) => [...t.stats.local.players, ...t.stats.visitor.players])].map((p) => ({ ...p, points: 60 + p.id % 50, averagePoints: 4 + (p.id % 5), marketValue: 8e6 + p.id * 1e5, image: '', weekPoints: [{ weekNumber: 11, points: p.weekPoints }] }));
const stats = todos.map((t) => t.stats);
let fallos = 0;
const mostrar = (t) => {
  const v = validar(t.texto, { numeros: t.numeros });
  if (!v.ok) fallos++;
  console.log(`\n--- ${t.clave} · peso ${v.peso} · ${v.ok ? 'válido' : 'FALLA: ' + v.errores.join('; ')}${t.tarjetas ? ` · tarjetas: ${t.tarjetas.map((x) => `${x.jugadorId}:${x.motivo}`).join(', ')}` : ''}\n${t.texto}`);
};
console.log('=== DIRECTO ===');
const dir = await directo({ stats: stats.map((s) => ({ ...s, local: { ...s.local, players: s.local.players.map((p) => ({ ...p })) } })), jornada: 11, fechasEspn: ['20261101'], jugadores, desdeDirecto: 0, ahora: Date.parse('2026-11-02T00:00:00Z') });
dir.forEach(mostrar);
console.log('\n=== FINAL ===');
const fin = await final({ stats, jornada: 11, jugadores, desdeFinal: 0 });
fin.forEach(mostrar);

if (arg('tarjetas')) {
  const { tarjetasDe } = await import('../lib/con-tarjetas.mjs');
  const dirOut = arg('tarjetas'); mkdirSync(dirOut, { recursive: true });
  // valor de 40 días inventado y sin imágenes (la prueba no llega a LaLiga)
  const fuentes = { ficha: async () => ({ playerStats: [] }), imagen: async () => null,
    valor: async (id) => Array.from({ length: 40 }, (_, i) => ({ date: new Date(Date.parse('2026-11-02T12:00:00Z') - (39 - i) * 864e5).toISOString(), marketValue: 8e6 + id * 1e5 + i * 80000 })) };
  for (const t of dir) {
    const hechas = await tarjetasDe(t, { stats, jugadores, jornada: 11, config: { tarjetas: { final: true, jugador: true } }, fuentes });
    for (const h of hechas) { console.log(`tarjeta ${h.nombre}: ${h.ok ? 'válida' : 'NO pasa: ' + h.errores.join('; ')}`); if (h.ok) writeFileSync(`${dirOut}/${h.nombre}.png`, h.png); else fallos++; }
  }
}

// --- espera a los puntos definitivos (lib/dazn.mjs; el detalle, en prueba/puntos-ejemplo.mjs): recién acabado no sale; con los
// puntos quietos el tiempo pedido, la valoración DAZN y la portería a cero sumada, sí; pasado el plazo, sale igual ---
{
  const { crearDazn } = await import('../lib/dazn.mjs');
  const m = stats[0];
  const ficha = (con) => async () => ({ playerStats: [{ weekNumber: 11, stats: { mins_played: [90, 2], goals_conceded: [0, 4], marca_points: con == null ? [0, 0] : [-1, con] } }] });
  const caso = async (nombre, f, desdeFinal, esperado) => {
    const t0 = Date.parse(m.date) + 2 * 3600e3;   // visto acabado a las 2 h del saque
    const registro = { datos: {} };
    await crearDazn({ ficha: f, jornada: 11, registro, ahora: () => t0, log: () => {} })(m);   // la ejecución que lo ve acabar
    const d = crearDazn({ ficha: f, jornada: 11, registro, esperaHoras: 6, minTrasFinal: 90, minEstable: 40, ahora: () => t0 + desdeFinal * 60e3, log: () => {} });
    const r = await d(m); const f1 = await final({ stats: [m], jornada: 11, jugadores, desdeFinal: 0, dazn: d });
    const ok = r.listo === esperado && (f1.length === 1) === esperado;
    if (!ok) fallos++;
    console.log(`puntos ${nombre}: listo=${r.listo} (${r.motivo || 'nada pendiente'}) tweets de final=${f1.length} ${ok ? 'ok' : 'FALLA'}`);
  };
  await caso('recién acabado, con valoración', ficha(4), 6, false);
  await caso('a los 95 min, con valoración', ficha(4), 95, true);
  await caso('a los 95 min, sin valoración', ficha(null), 95, false);
  await caso('sin valoración, pasadas 7 h', ficha(null), 7 * 60, true);
  await caso('la ficha falla, a los 120 min', async () => { throw new Error('caído'); }, 120, false);
}
srv.close();
process.exit(fallos ? 1 : 0);
