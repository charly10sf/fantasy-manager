// Los cinco planes por la ruta /plan del Worker (worker/src/index.js), con su código tal cual y la IA de verdad (solo en
// Actions, rama pruebas-ia; la clave del bot hace de CLAUDE_PLANES). LaLiga va de mentira (la cuenta 4242) y el Durable
// Object, en memoria: lo que se prueba es lo que hace el Worker con el pedido de la app (el sistema que arma, el tope, lo
// que deja pasar de la respuesta y el cupo). Deja respuestas-worker.json con la forma de las de Google, para puntuarlas
// con puntuar.mjs. Sin publicar nada.
import { readFileSync, writeFileSync } from 'node:fs';
import { SOBRE_BLOQUEO, CHISTES, sistemaCorto } from '../../web/js/plan-sistema.js';
const W = await import('../../worker/src/index.js');
const K = process.env.ANTHROPIC_API_KEY;
if (!K) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const pedidos = JSON.parse(readFileSync(new URL('./pedidos-b.json', import.meta.url))).filter((p) => p.id.startsWith('ia-plan'));
const real = globalThis.fetch;
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (s.includes('/user/me')) return new Response(JSON.stringify({ id: 4242, managerName: 'Prueba' }), { status: 200 });
  if (s.endsWith('/limites.json')) return new Response(JSON.stringify({ planes: { on: true, gratis: 20, max: 20, topeUsdDia: 1 } }), { status: 200 });
  if (s.startsWith('https://api.anthropic.com/')) return real(u, o);
  throw new Error('sin red: ' + s);
};
const objetos = new Map();
const QR = { idFromName: (n) => n, get: (id) => { if (!objetos.has(id)) { const m = new Map(); objetos.set(id, new W.Emparejar({ storage: { get: async (k) => m.get(k), put: async (k, v) => { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); }, deleteAll: async () => m.clear(), setAlarm: async () => {} } })); } const o = objetos.get(id); return { fetch: (u, op) => o.fetch(new Request(u, op)) }; } };
const env = { QR, CLAUDE_PLANES: K, PLAN_TOPE_USD: '1' };
const out = [];
let igual = 0;
for (let pasada = 1; pasada <= 2; pasada++) for (const p of pedidos) {
  const sis = p.cuerpo.systemInstruction.parts.map((x) => x.text).join('\n');
  const pedido = p.cuerpo.contents.map((m) => m.parts.map((x) => x.text || '').join('\n')).join('\n');
  // lo que la app le mandaría al Worker: el tono, lo cerrado y los alias, sacados de las instrucciones que llevaba el pedido
  const op = { tono: sis.includes(CHISTES.serio) ? 'serio' : 'broma', bloq: Object.keys(SOBRE_BLOQUEO).filter((k) => sis.includes(SOBRE_BLOQUEO[k])), anuncio: sis.includes('se abren viendo anuncios cortos'), alias: sis.includes('LOS DE LA LIGA VAN CON ALIAS') ? { puesto: sis.includes(', con N su puesto en la clasificación'), ex: sis.includes('«Exrival N»') } : null };
  if (pasada === 1) { const ok = sistemaCorto(op) === sis; igual += ok ? 1 : 0; console.log(`${ok ? 'IGUAL' : 'DISTINTO'} el sistema del Worker y el de la app en ${p.id}`); }
  const t0 = Date.now();
  const r = await W.default.fetch(new Request('https://w.dev/plan', { method: 'POST', headers: { Origin: 'https://fantasymanagerapp.com', 'content-type': 'application/json', Authorization: `Bearer ${'x'.repeat(40)}`, 'cf-connecting-ip': '10.1.1.1' }, body: JSON.stringify({ pedido, ...op }) }), env, { waitUntil() {} });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
  const ms = Date.now() - t0;
  console.log(`${j && j.plan ? 'OK ' : 'MAL'} ${p.id} #${pasada} · ${r.status} · ${Math.round(ms / 100) / 10} s · ${j && j.tok ? `entra ${j.tok.entra}, sale ${j.tok.sale}` : t.trim().slice(0, 160)}`);
  out.push({ id: p.id, lote: `worker#${pasada}`, modelo: 'worker-haiku', ms, entra: (j && j.tok && j.tok.entra) || 0, sale: (j && j.tok && j.tok.sale) || 0, respuesta: j && j.plan ? { candidates: [{ content: { role: 'model', parts: [{ text: '```json\n' + JSON.stringify(j.plan) + '\n```' }] }, finishReason: 'STOP' }] } : null });
  writeFileSync(new URL('./respuestas-worker.json', import.meta.url), JSON.stringify(out));
}
const g = out.reduce((a, x) => ({ e: a.e + x.entra, s: a.s + x.sale }), { e: 0, s: 0 });
console.log(`SISTEMA igual en ${igual} de ${pedidos.length} · GASTO ${((g.e * 0.1 + g.s * 0.5) / 1e6).toFixed(4)} $ en ${out.length} planes`);
