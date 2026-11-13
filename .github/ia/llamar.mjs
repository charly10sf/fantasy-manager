// Paso 2 (solo en Actions, rama pruebas-ia, con la clave del secreto): manda cada pedido de pedidos.json a Gemini, con el
// primer modelo de la lista de la app que tenga la clave, y guarda las respuestas tal cual en respuestas.json.
import { readFileSync, writeFileSync } from 'node:fs';
const K = process.env.GEMINI_API_KEY;
if (!K) { console.log('Falta GEMINI_API_KEY'); process.exit(1); }
const G = 'https://generativelanguage.googleapis.com/v1beta';
const BASE = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
const pedidos = JSON.parse(readFileSync(new URL('./pedidos.json', import.meta.url)));
const ls = await (await fetch(`${G}/models?pageSize=200&key=${K}`)).json();
const hay = new Set((ls.models || []).map((m) => m.name.replace('models/', '')));
let modelos = process.env.MODELO ? [process.env.MODELO] : BASE.filter((m) => hay.has(m));
console.log('MODELOS', modelos.join(', '));
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const veces = +(process.env.REPETIR || 1);
const out = [];
for (const p of pedidos) {
  for (let v = 0; v < veces; v++) {
    let j = null, modelo = null, ms = 0;
    for (let n = 0; n < 6 && !j; n++) {
      modelo = modelos[Math.min(modelos.length - 1, Math.floor(n / 2))];
      const t0 = Date.now();
      try {
        const r = await fetch(`${G}/models/${modelo}:generateContent?key=${K}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p.cuerpo), signal: AbortSignal.timeout(170000) });
        const x = await r.json();
        ms = Date.now() - t0;
        if (r.ok && x.candidates) j = x;
        else { console.log(`  ${p.id}: ${modelo} ${r.status} ${JSON.stringify(x).slice(0, 200)}`); await espera(r.status === 429 ? 45000 : 12000); }
      } catch (e) { console.log(`  ${p.id}: ${modelo} ${e.message}`); await espera(8000); }
    }
    const u = (j && j.usageMetadata) || {};
    console.log(`${j ? 'OK ' : 'MAL'} ${p.id}${veces > 1 ? ` #${v + 1}` : ''} · ${modelo} · ${Math.round(ms / 1000)} s · entra ${u.promptTokenCount || '?'} · piensa ${u.thoughtsTokenCount || 0} · escribe ${u.candidatesTokenCount || '?'} · ${j ? j.candidates[0].finishReason : ''}`);
    out.push({ id: p.id, v, modelo, ms, respuesta: j });
    await espera(+(process.env.PAUSA || 6000));
  }
}
writeFileSync(new URL('./respuestas.json', import.meta.url), JSON.stringify(out));
console.log(`${out.filter((x) => x.respuesta).length} de ${out.length} con respuesta`);
