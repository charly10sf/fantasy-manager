import * as LL from '../lib/laliga.mjs';
const js = await LL.jugadores();
console.log('jugadores:', js.length);
const top = [...js].sort((a, b) => b.marketValue - a.marketValue)[0];
const { weekPoints, ...resto } = top;
console.log('un jugador (sin weekPoints):', JSON.stringify(resto));
console.log('claves de todos:', [...new Set(js.flatMap((j) => Object.keys(j)))].join(', '));
for (const j of [top, js[5], js[300]]) {
  const h = await LL.valorMercado(j.id);
  console.log(`\nvalor de ${j.nickname} (${j.id}), marketValue de la lista ${j.marketValue}; ${h.length} puntos; últimos 5:`, JSON.stringify(h.slice(-5)));
}
const t0 = Date.now();
await Promise.all(js.slice(0, 40).map((j) => LL.valorMercado(j.id).catch(() => null)));
console.log(`\n40 históricos en paralelo: ${Date.now() - t0} ms`);
