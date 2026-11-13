// Paso 2 (solo en Actions, rama pruebas-ia, con la clave del secreto): manda cada pedido a Gemini y guarda las respuestas
// tal cual en respuestas.json, a cada paso (si la Action se corta, lo hecho no se pierde). Con dos lotes (pedidos.json, lo
// de antes, y pedidos-b.json, lo nuevo) cada caso se pregunta dos veces seguidas y con el mismo modelo, para comparar.
// La clave gratis da pocas preguntas al día por modelo (unas 20 en los mejores): el modelo que contesta 429 se deja para
// el resto de la pasada y se sigue con el siguiente de la lista de la app.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const K = process.env.GEMINI_API_KEY;
if (!K) { console.log('Falta GEMINI_API_KEY'); process.exit(1); }
const G = 'https://generativelanguage.googleapis.com/v1beta';
const BASE = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const leer = (f) => (existsSync(new URL(f, import.meta.url)) ? JSON.parse(readFileSync(new URL(f, import.meta.url))) : []);
const A = leer('./pedidos.json'), B = leer('./pedidos-b.json');
const ls = await (await fetch(`${G}/models?pageSize=200&key=${K}`)).json();
const hay = new Set((ls.models || []).map((m) => m.name.replace('models/', '')));
let vivos = (process.env.MODELOS ? process.env.MODELOS.split(',') : BASE).filter((m) => hay.has(m));
console.log('MODELOS', vivos.join(', '));
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const out = [];
const solo = (process.env.SOLO || '').split(',').filter(Boolean);
// (los modelos de antes de la 3 no conocen thinkingLevel: con ellos, su presupuesto, como hace la app)
const para = (cuerpo, modelo) => {
  if (/^gemini-3/.test(modelo)) return cuerpo;
  const c = JSON.parse(JSON.stringify(cuerpo)), g = c.generationConfig || {};
  if (g.thinkingConfig) g.thinkingConfig = { thinkingBudget: 1024 };
  if (g.temperature == null) g.temperature = 0.4;
  return c;
};
async function pedir(p, lote, primero) {
  const orden = primero && vivos.includes(primero) ? [primero, ...vivos.filter((m) => m !== primero)] : [...vivos];
  for (const modelo of orden) {
    for (let n = 0; n < 2; n++) {
      const t0 = Date.now();
      try {
        const r = await fetch(`${G}/models/${modelo}:generateContent?key=${K}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(para(p.cuerpo, modelo)), signal: AbortSignal.timeout(120000) });
        const x = await r.json();
        if (r.ok && x.candidates) {
          const u = x.usageMetadata || {};
          console.log(`OK  ${lote} ${p.id} · ${modelo} · ${Math.round((Date.now() - t0) / 1000)} s · entra ${u.promptTokenCount || '?'} · piensa ${u.thoughtsTokenCount || 0} · escribe ${u.candidatesTokenCount || '?'} · ${x.candidates[0].finishReason}`);
          return { id: p.id, lote, modelo, ms: Date.now() - t0, respuesta: x };
        }
        console.log(`  ${p.id}: ${modelo} ${r.status} ${String((x.error && x.error.message) || '').slice(0, 90)}`);
        if (r.status === 429) { if (/per day|daily|PerDay/i.test(JSON.stringify(x))) { vivos = vivos.filter((m) => m !== modelo); console.log(`  (${modelo} sin cupo: fuera para el resto)`); break; } await espera(35000); } else if (r.status === 400) break; else await espera(6000);
      } catch (e) { console.log(`  ${p.id}: ${modelo} ${e.message}`); }
    }
  }
  console.log(`MAL ${lote} ${p.id}: ningún modelo ha contestado`);
  return { id: p.id, lote, modelo: null, ms: 0, respuesta: null };
}
for (const p of A) {
  if (solo.length && !solo.some((s) => p.id.includes(s))) continue;
  const a = await pedir(p, 'a', null);
  out.push(a);
  const pb = B.find((x) => x.id === p.id);
  if (pb) { await espera(2500); out.push(await pedir(pb, 'b', a.modelo)); }
  writeFileSync(new URL('./respuestas.json', import.meta.url), JSON.stringify(out));
  if (!vivos.length) { console.log('Sin modelos con cupo: lo dejo aquí'); break; }
  await espera(+(process.env.PAUSA || 2500));
}
console.log(`${out.filter((x) => x.respuesta).length} de ${out.length} con respuesta`);
