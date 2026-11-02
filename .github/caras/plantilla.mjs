// Saca de LaLiga (sin token) los 20 equipos de esta temporada y 7 jugadores por equipo (portero, 2 def, 2 med, 2 del,
// los de más valor) para rehacer la liga de ejemplo con jugadores que estén de verdad. Solo nombres, ids y cifras.
const UA = { 'x-app': '2', 'x-lang': 'es', Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/130.0' };
const get = async (r) => (await fetch('https://fantasy-api.llt-services.com' + r + '?x-lang=es', { headers: UA })).json();
const jug = await get('/api/v1/competition/1/players');
const eqs = await get('/api/v3/teams-master');
const porEq = {};
for (const p of jug) (porEq[p.teamId] = porEq[p.teamId] || []).push(p);
const ids = Object.keys(porEq).filter((id) => porEq[id].length > 20);
console.log('EQUIPOS');
for (const id of ids) { const t = eqs.find((e) => String(e.id) === id); console.log(`  ${id}: ${JSON.stringify([t && t.name, t && t.shortName, t && t.slug])},`); }
console.log('J');
for (const id of ids) {
  const l = porEq[id].filter((p) => p.playerStatus !== 'out_of_league').sort((a, b) => +b.marketValue - +a.marketValue);
  const coge = [];
  for (const [pos, n] of [[1, 1], [2, 2], [3, 2], [4, 2]]) coge.push(...l.filter((p) => +p.positionId === pos).slice(0, n));
  console.log('  ' + coge.map((p) => JSON.stringify([p.nickname, +id, +p.positionId, Math.max(1, Math.round(+p.marketValue / 1e6)), Math.round(Math.min(10, Math.max(2, +p.averagePoints || 0)) * 10) / 10, +p.id])).join(', ') + ',');
}
