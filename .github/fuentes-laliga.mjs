// Cuarta pasada (solo lectura): qué trae la API de LaLiga Fantasy SIN token, sobre todo los puntos por jugador de un partido.
const H = 'https://fantasy-api.llt-services.com';
const get = async (url, h = {}) => {
  const t0 = Date.now();
  try { const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(25000) }); const b = await r.text(); return { s: r.status, b, ms: Date.now() - t0 }; }
  catch (e) { return { s: 0, b: '', ms: Date.now() - t0, err: String(e.cause?.code || e.message) }; }
};
const J = (b) => { try { return JSON.parse(b); } catch { return null; } };
const L = (t) => console.log(t);
const cut = (x, n) => String(JSON.stringify(x)).slice(0, n);

L('## cabeceras mínimas');
for (const [n, h] of [['sin cabeceras', {}], ['solo x-app', { 'x-app': '2' }], ['x-app + UA navegador', { 'x-app': '2', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' }]]) {
  const r = await get(`${H}/stats/v1/competition/1/stats/week/11?x-lang=es`, h);
  L(`- ${n} → ${r.s || r.err} · ${r.b.length} B · ${r.ms} ms`);
}

L('\n## semana actual');
for (const u of ['/api/v1/competition/1/week/current', '/api/v1/competition/1/calendar?weekNumber=12']) {
  const r = await get(`${H}${u}${u.includes('?') ? '&' : '?'}x-lang=es`, { 'x-app': '2' });
  L(`- ${u} → ${r.s} · ${r.b.length} B · «${r.b.replace(/\s+/g, ' ').slice(0, 300)}»`);
}

for (const n of [11, 12]) {
  L(`\n## stats/week/${n}`);
  const r = await get(`${H}/stats/v1/competition/1/stats/week/${n}?x-lang=es`, { 'x-app': '2' });
  const j = J(r.b);
  const ms = Array.isArray(j) ? j : j?.matches || j?.data || [];
  L(`- ${r.s} · ${(r.b.length / 1024).toFixed(0)} KB · partidos=${ms.length}`);
  for (const m of ms) {
    const loc = m.local || m.homeTeam || {}, vis = m.visitor || m.awayTeam || {};
    const pl = [...(loc.players || []), ...(vis.players || [])];
    const conPts = pl.filter((p) => p.points != null || p.pts != null);
    L(`  · id=${m.id} fecha=${m.date} estado=${m.matchState} marcador=${m.localScore ?? loc.score}-${m.visitorScore ?? vis.score} jugadores=${pl.length} con puntos=${conPts.length}`);
  }
  const m0 = ms.find((m) => ((m.local || {}).players || []).length);
  if (m0) {
    L(`- claves del partido: ${Object.keys(m0).join(',')}`);
    L(`- claves de local: ${Object.keys(m0.local).join(',')}`);
    const ps = [...m0.local.players, ...m0.visitor.players];
    L(`- jugador 0: ${cut({ ...ps[0], images: undefined }, 700)}`);
    const top = [...ps].filter((p) => p.points != null).sort((a, b) => b.points - a.points).slice(0, 3);
    L(`- top puntos: ${top.map((p) => `${p.nickname || p.name}=${p.points}`).join(', ')}`);
    const goleador = ps.find((p) => p.stats && p.stats.goals);
    if (goleador) L(`- uno con gol: ${cut({ ...goleador, images: undefined }, 900)}`);
  }
}

L('\n## lista de jugadores (sin token)');
const pr = await get(`${H}/api/v1/competition/1/players?x-lang=es`, { 'x-app': '2' });
const pj = J(pr.b);
L(`- ${pr.s} · ${(pr.b.length / 1024).toFixed(0)} KB · jugadores=${pj?.length}`);
if (pj?.[0]) {
  L(`- claves: ${Object.keys(pj[0]).join(',')}`);
  const x = pj.find((p) => p.weekPoints?.length) || pj[0];
  L(`- ejemplo: ${cut(x, 900)}`);
  const est = {};
  for (const p of pj) est[p.playerStatus] = (est[p.playerStatus] || 0) + 1;
  L(`- estados: ${JSON.stringify(est)}`);
}
L('\n## ficha de un jugador (sin token)');
for (const u of ['/api/v1/competition/1/player/68', '/api/v3/player/68', '/api/v4/player/68']) {
  const r = await get(`${H}${u}?x-lang=es`, { 'x-app': '2' });
  const j = J(r.b);
  L(`- ${u} → ${r.s} · ${r.b.length} B · claves=${j ? Object.keys(j.playerMaster || j).slice(0, 18).join(',') : r.b.slice(0, 100)}`);
  const ps = (j?.playerMaster || j)?.playerStats;
  if (Array.isArray(ps) && ps.length) L(`  playerStats[última]: ${cut(ps[ps.length - 1], 900)}`);
}
