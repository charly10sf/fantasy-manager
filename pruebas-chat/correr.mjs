// Prueba del chat del director deportivo: las 4 preguntas del caso de Fran, en una conversación, con Gemini
import { readFileSync } from 'fs';
const K = process.env.GEMINI_API_KEY;
const { preguntas, sistemas } = JSON.parse(readFileSync(new URL('./caso.json', import.meta.url)));
const G = 'https://generativelanguage.googleapis.com/v1beta';
const BASE = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
const ls = await (await fetch(`${G}/models?pageSize=200&key=${K}`)).json();
const hay = new Set((ls.models || []).map((m) => m.name.replace('models/', '')));
const modelo = process.env.MODELO || BASE.find((m) => hay.has(m));
console.log('MODELO', modelo);
const sinWeb = (s) => s.replace(/EN EL CHAT, BUSCA EN GOOGLE SOLO SI HACE FALTA:[^\n]*/, 'EN EL CHAT NO TIENES BÚSQUEDA EN GOOGLE: contesta con los datos que te paso y, si para contestar falta algo de hoy (una lesión, un once), dilo.');
const contents = [];
for (let i = 0; i < preguntas.length; i++) {
  contents.push({ role: 'user', parts: [{ text: preguntas[i] }] });
  const cuerpo = { systemInstruction: { parts: [{ text: sinWeb(sistemas[i]) }] }, contents, generationConfig: { maxOutputTokens: 16000, temperature: 0.4, ...(/gemini-3/.test(modelo) ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) } };
  let j;
  for (let n = 0; n < 4; n++) {
    const r = await fetch(`${G}/models/${modelo}:generateContent?key=${K}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    j = await r.json();
    if (r.ok) break;
    console.log('reintento', r.status, JSON.stringify(j).slice(0, 300));
    await new Promise((x) => setTimeout(x, 15000));
  }
  const t = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  console.log(`\n================ PREGUNTA ${i + 1}: ${preguntas[i]}\n${t}\n`);
  contents.push({ role: 'model', parts: [{ text: t.replace(/```notas[\s\S]*$/, '').trim() }] });
}
