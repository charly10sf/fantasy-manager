import w, { tocaPortal, CRON_PORTAL, lanzarBot } from '../src/index.js';
const t = (s) => Date.parse(s);
const casos = [
  ['2026-11-16T23:47:00Z', true], ['2026-11-16T22:47:00Z', false],   // invierno: 00:47 / 23:47
  ['2026-07-16T22:47:00Z', true], ['2026-07-16T23:47:00Z', false],   // verano: 00:47 / 01:47
  ['2026-11-16T06:13:00Z', true], ['2026-11-16T05:13:00Z', false],   // invierno 07:13 / 06:13
  ['2026-07-16T05:13:00Z', true], ['2026-07-16T06:13:00Z', false],   // verano
];
let mal = 0;
for (const [f, e] of casos) if (tocaPortal(t(f)) !== e) { mal++; console.log('MAL', f); }
// scheduled: lanza solo en su hora, al flujo del portal y sin inputs
const llamadas = [];
globalThis.fetch = async (u, o) => { llamadas.push([u, o.body]); return new Response(null, { status: 204 }); };
const env = { BOT_DISPATCH_TOKEN: 'x' };
const run = async (cron, f) => { const ps = []; await w.scheduled({ cron, scheduledTime: t(f) }, env, { waitUntil: (p) => ps.push(p) }); await Promise.all(ps); };
await run(CRON_PORTAL[0], '2026-11-16T23:47:00Z');
await run(CRON_PORTAL[0], '2026-11-16T22:47:00Z');
await run(CRON_PORTAL[1], '2026-11-16T06:13:00Z');
await run('*/5 * * * *', '2026-11-16T23:45:00Z');
await run('13-30 22,23 * * *', '2026-11-16T23:16:00Z');
console.log(llamadas.map(([u, b]) => u.split('/workflows/')[1] + ' ' + b).join('\n'));
if (mal || llamadas.length !== 4 || !llamadas[0][0].includes('portal-web.yml') || !llamadas[1][0].includes('portal-web.yml') || !llamadas[2][0].includes('bot.yml') || llamadas[3][1] !== '{"ref":"main","inputs":{"tipos":"mercado"}}') { console.log('FALLA'); process.exit(1); }
console.log('Todo BIEN');
