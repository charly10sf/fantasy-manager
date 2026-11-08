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
  // un penalti PARADO en el Getafe-Elche (0-0), que el scoreboard no trae y el summary sí (el de Sivera del 6 nov no salió por eso)
  if (u.searchParams.get('event') === '9003') return res.end(JSON.stringify({ keyEvents: [{ type: { text: 'Penalty - Saved' }, clock: { displayValue: "32'" }, team: { id: '20' },
    text: 'Penalty saved! Borja Mayoral (Getafe CF) fails to score. Saved by Iker Muñoz (Elche CF) (bottom left corner).', participants: [{ athlete: { displayName: 'Borja Mayoral' } }, { athlete: { displayName: 'Iker Muñoz' } }] }] }));
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
{
  const par = dir.find((t) => t.hechos && t.hechos.subtipo === 'penalti parado');
  if (!par) { fallos++; console.log('FALLA: el penalti parado del Getafe-Elche no sale en el directo'); }
  else {
    const h = par.hechos;
    const ok = /le para un penalti a/.test(par.texto) && /Iker Muñoz/.test(par.texto) && h.partido.marcadorEnEseMomento === '0-0' && h.minuto === "32'" && h.jugadores.length === 2 && h.jugadores[0].principal && h.etiqueta === '';
    if (!ok) { fallos++; console.log(`FALLA: penalti parado mal contado: ${par.texto} ${JSON.stringify(h)}`); } else console.log('ok: el penalti parado sale del summary, con minuto, marcador y el portero');
  }
  const gol = dir.find((t) => t.hechos && t.hechos.subtipo === 'gol' && t.hechos.jugadores.length === 2);
  if (!gol || !/pase del gol/.test(JSON.stringify(gol.hechos.jugadores[1]))) { fallos++; console.log('FALLA: un gol con asistente no lleva al asistente en los hechos'); } else console.log('ok: el gol con asistente lleva los dos en los hechos');
  // 7 nov: «Asistencia de X, que ya suma 4 puntos. Ya suma 4 puntos fantasy» (dos «ya suma» seguidos, el segundo sin nombre)
  const conAsis = dir.filter((t) => t.hechos && t.hechos.jugadores.length === 2 && /Asistencia de/.test(t.texto));
  const malo = conAsis.find((t) => (t.texto.match(/ya suma/gi) || []).length > 1 || /\. Ya suma/.test(t.texto) || !t.texto.includes(`${t.hechos.jugadores[0].nombre} ya suma`));
  if (!conAsis.length || malo) { fallos++; console.log(`FALLA: gol con asistente con los puntos mal atribuidos: ${malo ? malo.texto : 'ninguno'}`); } else console.log('ok: gol con asistente: cada cifra con su nombre y sin «ya suma» repetido');
}
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
// marcador de ESPN por detrás de sus jugadas (Catena, 7 nov: salió «0-1» cuando era el 1-1)
{
  const { reconstruir, situacion } = await import('../lib/relato.mjs');
  const d = [{ clock: { value: 5037 }, scoringPlay: true, team: { id: '93' } }, { clock: { value: 5393 }, scoringPlay: true, team: { id: '97' } }];
  const r = reconstruir(d, '97', '93', 0, 1, { vivo: true });
  const [c, f] = r.ok ? r.tras.get(d[1]).marcador : [];
  const conAutogol = reconstruir([...d, { clock: { value: 5400 }, scoringPlay: true, ownGoal: true, team: { id: '93' } }], '97', '93', 1, 1, { vivo: true });
  const ok = r.ok && r.desfase && c === 1 && f === 1 && situacion(c, f) === 'empata' && !reconstruir(d, '97', '93', 0, 1).ok && !conAutogol.ok;
  console.log(`${ok ? 'OK ' : 'MAL'} marcador de ESPN por detrás: ${c}-${f}`); if (!ok) fallos++;
}
// puntos de un gol cuando LaLiga aún no los ha sumado (Carlos, 7 nov 20:54: «súmalos tú sabiendo la posición»)
{
  const { puntosConGol } = await import('../tipos/directo.mjs');
  const c = (lal, pos, o, esp) => { const r = puntosConGol(lal, pos, o); const ok = r.pts === esp; console.log(`${ok ? 'OK ' : 'MAL'} puntos con gol: LaLiga ${lal}, puesto ${pos} → ${r.pts} (esperado ${esp})`); if (!ok) fallos++; };
  c(0, 2, { goles: 1 }, 7);                            // defensa, LaLiga a 0: 1 por jugar + 6
  c(3, 2, { goles: 1 }, 9);                            // defensa, LaLiga sin el gol: 3 + 6
  c(11, 2, { goles: 1 }, 11);                          // ya lo cuenta: lo de LaLiga
  c(null, 4, { goles: 1 }, 5);                         // delantero sin dato: 1 + 4
  c(2, 3, { asis: 1, accion: 'asistencia' }, 5);       // asistencia: 2 + 3
  c(7, 4, { goles: 2 }, 11);                           // doblete con solo el primero sumado
  c(-1, 1, { goles: 1 }, 7);                           // portero con amarilla y gol: 1 + 6
}
// los puntos del directo no bajan respecto a un tuit anterior (7 nov: Arda Güler «lleva 10» en el 36' y «se lleva 9» tras su pase del 75')
{
  const { conSuelo, puntosConGol } = await import('../tipos/directo.mjs');
  const t = {}; const k = '12|112|1674';
  const v = (x, esp, txt) => { const ok = x === esp; console.log(`${ok ? 'OK ' : 'MAL'} suelo de puntos: ${txt} → ${x} (esperado ${esp})`); if (!ok) fallos++; };
  v(conSuelo(t, k, puntosConGol(10, 3, { goles: 1 }).pts, { goles: 1, asis: 0, pos: 3, ahora: 1 }), 10, 'gol del 36\', LaLiga 10');
  v(conSuelo(t, k, puntosConGol(5, 3, { goles: 1 }).pts, { goles: 1, asis: 0, pos: 3, ahora: 2, apuntar: false }), 10, 'el mismo gol, ya publicado, otra vuelta con LaLiga a 5');
  v(conSuelo(t, k, puntosConGol(null, 3, { goles: 1, asis: 1, accion: 'asistencia' }).pts, { goles: 1, asis: 1, pos: 3, ahora: 3 }), 13, 'su pase del 75\', LaLiga sin dato: 10 + 3');
  v(conSuelo(t, k, puntosConGol(16, 3, { goles: 1, asis: 1, accion: 'asistencia' }).pts, { goles: 1, asis: 1, pos: 3, ahora: 4 }), 16, 'LaLiga ya va por encima: lo suyo');
  // partido visto ya acabado: las dos jugadas en la misma vuelta, con los 19 definitivos (sin sumar el pase dos veces)
  const t2 = {};
  conSuelo(t2, k, puntosConGol(19, 3, { goles: 1 }).pts, { goles: 1, asis: 0, pos: 3, ahora: 9 });
  v(conSuelo(t2, k, puntosConGol(19, 3, { goles: 1, asis: 1, accion: 'asistencia' }).pts, { goles: 1, asis: 1, pos: 3, ahora: 9 }), 19, 'gol y pase en la misma vuelta: los 19 de LaLiga');
  v(conSuelo(null, k, 7, { goles: 1, pos: 4 }), 7, 'sin registro: tal cual');
}
srv.close();
process.exit(fallos ? 1 : 0);
