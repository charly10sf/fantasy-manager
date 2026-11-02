// Sonda: ¿cómo se ve en la API de LaLiga que ya están los puntos DAZN de un partido? Solo lee.
import * as LL from '../lib/laliga.mjs';
const stats = await LL.statsSemana(11);
for (const m of stats) {
  const { local, visitor, ...resto } = m;
  console.log(`\n## partido ${m.id} ${local.mainName} ${m.localScore}-${m.visitorScore} ${visitor.mainName}`, JSON.stringify(resto));
  console.log('  claves de local sin jugadores:', JSON.stringify(Object.fromEntries(Object.entries(local).filter(([k]) => k !== 'players'))).slice(0, 400));
}
const pedir = [106, 108, 105];
const claves = new Set();
for (const id of pedir) {
  const m = stats.find((x) => Number(x.id) === id); if (!m) continue;
  const ps = [...m.local.players, ...m.visitor.players].sort((a, b) => b.weekPoints - a.weekPoints).slice(0, 4);
  for (const p of ps) {
    const f = await LL.ficha(p.id).catch((e) => ({ error: String(e) }));
    const s = (f.playerStats || []).find((x) => Number(x.weekNumber) === 11);
    console.log(`\n# ${id} ${p.nickname || p.name} weekPoints=${p.weekPoints}`, s ? JSON.stringify(s) : 'sin stats de la J11');
    if (s) Object.keys(s.stats || {}).forEach((k) => claves.add(k));
  }
}
console.log('\nclaves vistas:', [...claves].sort().join(', '));
