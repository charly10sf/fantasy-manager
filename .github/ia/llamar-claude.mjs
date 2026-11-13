// Lo mismo que llamar.mjs, pero con Claude (solo en Actions, rama pruebas-ia, con el secreto ANTHROPIC_API_KEY): manda los
// pedidos de pedidos-b.json (lo que la app manda hoy) a cada modelo de MODELOS y guarda las respuestas con la forma de las
// de Google en respuestas-claude.json, para puntuarlas igual (LOTE=<modelo> node .github/ia/puntuar.mjs …). Sin
// razonamiento largo (esfuerzo «low»). Al final, los tokens y lo que ha costado con los precios de PRECIO (por millón, entrada/salida).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const K = process.env.ANTHROPIC_API_KEY;
if (!K) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const PRECIO = { 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5-5': [2, 10] };
const MODELOS = (process.env.MODELOS || 'claude-haiku-5-5,claude-sonnet-5-5').split(',');
const f = existsSync(new URL('./pedidos-b.json', import.meta.url)) ? './pedidos-b.json' : './pedidos.json';
const pedidos = JSON.parse(readFileSync(new URL(f, import.meta.url)));
const solo = (process.env.SOLO || '').split(',').filter(Boolean);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const out = [], gasto = {};
for (const modelo of MODELOS) {
  gasto[modelo] = { entra: 0, sale: 0, n: 0, chat: [0, 0, 0], plan: [0, 0, 0] };
  for (const p of pedidos) {
    if (solo.length && !solo.some((s) => p.id.includes(s))) continue;
    const c = p.cuerpo;
    const cuerpo = {
      // (estos modelos piensan antes de contestar y eso cuenta como salida: con 8.000 de tope los planes llegaban vacíos;
      // como en la app con Gemini: 16.000 de tope y pensando poco)
      model: modelo, max_tokens: 16000, output_config: { effort: process.env.ESFUERZO || 'low' },
      system: c.systemInstruction ? c.systemInstruction.parts.map((x) => x.text).join('\n') : undefined,
      messages: c.contents.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts.map((x) => x.text || '').join('\n') })),
    };
    let j = null, ms = 0;
    for (let n = 0; n < 4 && !j; n++) {
      const t0 = Date.now();
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': K, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(170000) });
        const x = await r.json();
        ms = Date.now() - t0;
        if (r.ok && x.content) j = x;
        else { console.log(`  ${p.id}: ${modelo} ${r.status} ${String((x.error && x.error.message) || '').slice(0, 120)}`); if (r.status === 400 && /effort|output_config/i.test(JSON.stringify(x)) && cuerpo.output_config) { delete cuerpo.output_config; continue; } if (r.status === 400 || r.status === 401 || r.status === 404) break; await espera(r.status === 429 ? 30000 : 8000); }
      } catch (e) { console.log(`  ${p.id}: ${modelo} ${e.message}`); await espera(5000); }
    }
    const texto = j ? j.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : null;
    const u = (j && j.usage) || {};
    const g = gasto[modelo], k = p.id.startsWith('ia-plan') ? g.plan : g.chat;
    if (j) { g.entra += u.input_tokens || 0; g.sale += u.output_tokens || 0; g.n++; k[0] += u.input_tokens || 0; k[1] += u.output_tokens || 0; k[2]++; }
    console.log(`${j ? 'OK ' : 'MAL'} ${modelo} ${p.id} · ${Math.round(ms / 1000)} s · entra ${u.input_tokens || '?'} · escribe ${u.output_tokens || '?'} · ${j ? j.stop_reason : ''}`);
    out.push({ id: p.id, lote: modelo, modelo, ms, respuesta: texto == null ? null : { candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: j.stop_reason === 'max_tokens' ? 'MAX_TOKENS' : 'STOP' }], usageMetadata: { promptTokenCount: u.input_tokens, candidatesTokenCount: u.output_tokens } } });
    writeFileSync(new URL('./respuestas-claude.json', import.meta.url), JSON.stringify(out));
    await espera(800);
  }
}
for (const [m, g] of Object.entries(gasto)) {
  const [pe, ps] = PRECIO[m] || [0, 0], usd = (e, s) => ((e * pe + s * ps) / 1e6);
  const media = (k) => (k[2] ? `${Math.round(k[0] / k[2])} de entrada y ${Math.round(k[1] / k[2])} de salida, ${usd(k[0] / k[2], k[1] / k[2]).toFixed(4)} $ cada uno` : 'ninguno');
  console.log(`GASTO ${m}: ${g.n} respuestas, ${g.entra} tokens de entrada y ${g.sale} de salida = ${usd(g.entra, g.sale).toFixed(3)} $ · chat: ${media(g.chat)} · plan: ${media(g.plan)}`);
}
