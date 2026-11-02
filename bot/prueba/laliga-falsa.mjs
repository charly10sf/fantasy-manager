// API de LaLiga falsa, para probar el bot sin llegar a LaLiga (desde el entorno de Claude no se llega): sirve una jornada
// guardada en una carpeta (stats.json, jugadores.json, equipos.json, fichas/<id>.json, valor/<id>.json, img/cara-<id>.png,
// img/escudo-<idEquipo>.png). Para usarla, una copia de bot/ con el host de lib/laliga.mjs cambiado a http://127.0.0.1:8789.
//   DATOS=carpeta node bot/prueba/laliga-falsa.mjs
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
const D = process.env.DATOS;
const leer = (f) => (existsSync(`${D}/${f}`) ? readFileSync(`${D}/${f}`) : null);
const equipos = JSON.parse(leer('equipos.json'));
const stats = JSON.parse(leer('stats.json'));
const porEscudo = new Map(equipos.map((e) => [new URL(e.badgeColor).pathname, e.id]));
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  const env = (s, b, tipo = 'application/json') => { res.writeHead(s, { 'Content-Type': tipo }); res.end(b); };
  let m;
  if (p === '/api/v1/competition/1/week/current') return env(200, JSON.stringify({ isLive: false, weekNumber: 11, nextWeek: 12 }));
  if (p === '/api/v1/competition/1/players') return env(200, leer('jugadores.json'));
  if (p === '/api/v3/teams-master') return env(200, leer('equipos.json'));
  if ((m = p.match(/^\/stats\/v1\/competition\/1\/stats\/week\/(\d+)$/))) return env(200, JSON.stringify(stats));
  if ((m = p.match(/^\/api\/v1\/competition\/1\/player\/(\d+)\/market-value$/))) { const b = leer(`valor/${m[1]}.json`); return b ? env(200, b) : env(404, '{}'); }
  if ((m = p.match(/^\/api\/v1\/competition\/1\/player\/(\d+)$/))) { const b = leer(`fichas/${m[1]}.json`); return b ? env(200, b) : env(404, '{}'); }
  if ((m = p.match(/^\/players\/t\d+\/p(\d+)\//))) { const b = leer(`img/cara-${m[1]}.png`); return b ? env(200, b, 'image/png') : env(404, ''); }
  if (p.startsWith('/teambadge/') && porEscudo.has(p)) { const b = leer(`img/escudo-${porEscudo.get(p)}.png`); return b ? env(200, b, 'image/png') : env(404, ''); }
  env(404, '{}');
}).listen(8789, '127.0.0.1');
