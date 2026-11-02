// Saca por el log (en base64) un paquete pequeño con lo necesario para dibujar tarjetas de ejemplo fuera de Actions:
// los 3 partidos con más goles de la jornada, las fichas y el histórico de valor de sus jugadores, sus caras y todos los escudos.
// El entorno de Claude no puede bajar artefactos; tras leer el log, la ejecución se borra.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const H = 'https://fantasy-api.llt-services.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const S = 'salida', P = 'paq';
for (const d of ['', '/img', '/fichas', '/valor']) mkdirSync(P + d, { recursive: true });
const stats = JSON.parse(readFileSync(`${S}/stats.json`));
const elegidos = stats.filter((m) => m.matchState === 7).sort((a, b) => (b.localScore + b.visitorScore) - (a.localScore + a.visitorScore)).slice(0, 3);
console.log('partidos:', elegidos.map((m) => `${m.id} ${m.local.mainName} ${m.localScore}-${m.visitorScore} ${m.visitor.mainName}`).join(' | '));
const ids = elegidos.flatMap((m) => [...m.local.players, ...m.visitor.players]).map((p) => String(p.id));
const pedir = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA, 'x-app': '2' }, signal: AbortSignal.timeout(20000) }); return r.status === 200 ? Buffer.from(await r.arrayBuffer()) : null; };
for (const id of ids) {
  const f = await pedir(`${H}/api/v1/competition/1/player/${id}?x-lang=es`); if (f) writeFileSync(`${P}/fichas/${id}.json`, f);
  const v = await pedir(`${H}/api/v1/competition/1/player/${id}/market-value?x-lang=es`); if (v) writeFileSync(`${P}/valor/${id}.json`, v);
  const c = `${S}/img/cara-${id}.png`;
  if (existsSync(c)) copyFileSync(c, `${P}/img/cara-${id}.png`);
  else { const p = [...elegidos.flatMap((m) => [...m.local.players, ...m.visitor.players])].find((x) => String(x.id) === id); const u = p?.images?.transparent?.['256x256']; const b = u && await pedir(u); if (b) writeFileSync(`${P}/img/cara-${id}.png`, b); }
}
for (const f of readdirSync(`${S}/img`)) if (f.startsWith('escudo-')) copyFileSync(`${S}/img/${f}`, `${P}/img/${f}`);
for (const f of ['stats.json', 'equipos.json', 'jugadores.json']) copyFileSync(`${S}/${f}`, `${P}/${f}`);
execSync(`tar czf paq.tgz -C ${P} .`);
const b64 = readFileSync('paq.tgz').toString('base64');
console.log(`paquete ${b64.length} caracteres`);
for (let i = 0; i < b64.length; i += 8000) console.log(`PAQ:${b64.slice(i, i + 8000)}`);
