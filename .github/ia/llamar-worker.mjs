// Los cinco planes por la ruta /plan del Worker (worker/src/index.js), con su código tal cual y la IA de verdad (solo en
// Actions, rama pruebas-ia; la clave del bot hace de CLAUDE_PLANES). LaLiga va de mentira (una cuenta por plan) y el Durable
// Object, en memoria: lo que se prueba es lo que hace el Worker con el pedido de la app (el sistema que arma, el tope, lo
// que deja pasar de la respuesta y el cupo). Deja respuestas-worker.json con la forma de las de Google, para puntuarlas
// con puntuar.mjs. Sin publicar nada.
// (14 nov, punto 14) Con la búsqueda en Google: WEB búsquedas por plan (2 si no se dice) y un tope de gasto de 0,10 $.
import { readFileSync, writeFileSync } from 'node:fs';
import { SOBRE_BLOQUEO, CHISTES, sistemaCorto } from '../../web/js/plan-sistema.js';
const W = await import('../../worker/src/index.js');
const K = process.env.ANTHROPIC_API_KEY;
const WEB = process.env.WEB != null ? Number(process.env.WEB) : 2;
const TOPE = Number(process.env.TOPE_USD || 0.1);
const SALIDA = process.env.SALIDA || 'respuestas-worker.json';
if (!K) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const pedidos = JSON.parse(readFileSync(new URL('./pedidos-b.json', import.meta.url))).filter((p) => p.id.startsWith('ia-plan-'));
const real = globalThis.fetch;
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
globalThis.fetch = async (u, o) => {
  const s = String(u);
  // (una cuenta por plan: el Worker deja 3 al minuto por cuenta)
  if (s.includes('/user/me')) return new Response(JSON.stringify({ id: 4000 + Number(new Headers(o.headers).get('authorization').slice(-2)), managerName: 'Prueba' }), { status: 200 });
  if (s.endsWith('/limites.json')) return new Response(JSON.stringify({ planes: { on: true, gratis: 20, max: 20, topeUsdDia: TOPE, web: WEB } }), { status: 200 });
  if (s.startsWith('https://api.anthropic.com/')) return real(u, o);
  throw new Error('sin red: ' + s);
};
const objetos = new Map();
const QR = { idFromName: (n) => n, get: (id) => { if (!objetos.has(id)) { const m = new Map(); objetos.set(id, new W.Emparejar({ storage: { get: async (k) => m.get(k), put: async (k, v) => { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); }, deleteAll: async () => m.clear(), setAlarm: async () => {} } })); } const o = objetos.get(id); return { fetch: (u, op) => o.fetch(new Request(u, op)) }; } };
const env = { QR, CLAUDE_PLANES: K, PLAN_TOPE_USD: String(TOPE) };
const out = [];
let igual = 0;
const PASADAS = Number(process.env.PASADAS || 1);
for (let pasada = 1; pasada <= PASADAS; pasada++) for (const p of pedidos) {
  const sis = p.cuerpo.systemInstruction.parts.map((x) => x.text).join('\n');
  const pedido = p.cuerpo.contents.map((m) => m.parts.map((x) => x.text || '').join('\n')).join('\n');
  // lo que la app le mandaría al Worker: el tono, lo cerrado y los alias, sacados de las instrucciones que llevaba el pedido
  const op = { tono: sis.includes(CHISTES.serio) ? 'serio' : 'broma', bloq: Object.keys(SOBRE_BLOQUEO).filter((k) => sis.includes(SOBRE_BLOQUEO[k])), anuncio: sis.includes('se abren viendo anuncios cortos'), alias: sis.includes('LOS DE LA LIGA VAN CON ALIAS') ? { puesto: sis.includes(', con N su puesto en la clasificación'), ex: sis.includes('«Exrival N»') } : null };
  if (pasada === 1) { const ok = sistemaCorto(op) === sis; igual += ok ? 1 : 0; console.log(`${ok ? 'IGUAL' : 'DISTINTO'} el sistema del Worker y el de la app en ${p.id}`); }
  const t0 = Date.now();
  const r = await W.default.fetch(new Request('https://w.dev/plan', { method: 'POST', headers: { Origin: 'https://fantasymanagerapp.com', 'content-type': 'application/json', Authorization: `Bearer ${'x'.repeat(38)}${String(out.length).padStart(2, '0')}`, 'cf-connecting-ip': '10.1.1.1' }, body: JSON.stringify({ pedido, ...op }) }), env, { waitUntil() {} });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
  const ms = Date.now() - t0;
  const tk = (j && j.tok) || {}, pl = (j && j.plan) || {};
  const usd = ((tk.entra || 0) * 0.1 + (tk.sale || 0) * 0.5 + (tk.web || 0) * 10000) / 1e6;
  const conF = (a) => (a || []).filter((x) => x.fuente);
  console.log(`${j && j.plan ? 'OK ' : 'MAL'} ${p.id} #${pasada} · ${r.status} · ${Math.round(ms / 100) / 10} s · ${j && j.tok ? `entra ${tk.entra}, sale ${tk.sale}, búsquedas ${tk.web || 0}, ${usd.toFixed(4)} $ · con fuente: quita ${conF(pl.quita).length}/${(pl.quita || []).length}, mete ${conF(pl.mete).length}/${(pl.mete || []).length}, noticias ${conF(pl.noticias).length}/${(pl.noticias || []).length} · fuentes ${(pl.fuentes || []).length}` : t.trim().slice(0, 160)}`);
  for (const x of [...(pl.quita || []).map((y) => ['QUITA', y.id, y.motivo, y.fuente]), ...(pl.mete || []).map((y) => ['METE', y.id, y.frase, y.fuente]), ...(pl.noticias || []).map((y) => ['NOTICIA', y.jugador, y.texto, y.fuente])]) console.log(`     ${x[0]} ${x[1]}: ${String(x[2] || '').slice(0, 160)}${x[3] ? ` [${x[3]}]` : ' [sin fuente]'}`);
  for (const f of pl.fuentes || []) console.log(`     FUENTE ${f.t} · ${f.u}`);
  out.push({ id: p.id, lote: `worker#${pasada}`, modelo: 'worker-haiku', ms, entra: tk.entra || 0, sale: tk.sale || 0, web: tk.web || 0, usd, plan: pl, respuesta: j && j.plan ? { candidates: [{ content: { role: 'model', parts: [{ text: '```json\n' + JSON.stringify(j.plan) + '\n```' }] }, finishReason: 'STOP' }] } : null });
  writeFileSync(new URL(`./${SALIDA}`, import.meta.url), JSON.stringify(out));
}
const g = out.reduce((a, x) => ({ e: a.e + x.entra, s: a.s + x.sale, w: a.w + x.web, u: a.u + x.usd, ms: a.ms + x.ms }), { e: 0, s: 0, w: 0, u: 0, ms: 0 });
const n = out.length || 1;
console.log(`WEB ${WEB} · SISTEMA igual en ${igual} de ${pedidos.length} · GASTO ${g.u.toFixed(4)} $ en ${out.length} planes (${(g.u / n).toFixed(4)} $ por plan; ${(g.w / n).toFixed(1)} búsquedas, ${Math.round(g.e / n)} tokens de entrada y ${Math.round(g.s / n)} de salida, ${Math.round(g.ms / n / 100) / 10} s de media)`);
