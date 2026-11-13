// Paso 3: pasa cada respuesta de verdad (respuestas.json, de la Action) por la app, como si acabara de llegar de Google,
// y mira lo que acaba viendo el mánager. Uso: node .github/ia/puntuar.mjs respuestas.json [trozo del id]   (VER=1 enseña
// lo que se ve en los que fallan; TODO=1, en todos)
import { readFileSync } from 'node:fs';
import { chat, plan, juzgar, cerrar } from './banco.mjs';
import { CASOS } from './casos.mjs';

const resp = JSON.parse(readFileSync(process.argv[2]));
const filtro = process.argv[3] || '';
let bien = 0, total = 0, sinApp = 0, descartadas = 0, opsPlan = 0;
const textoDe = (j) => ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
for (const x of resp) {
  const c = CASOS.find((y) => y.id === x.id);
  if (!c || !c.id.includes(filtro)) continue;
  total++;
  if (!x.respuesta) { console.log(`MAL  ${c.id}: Google no contestó`); continue; }
  let r;
  try { r = c.tipo === 'plan' ? await plan(c.escena, () => x.respuesta) : await chat(c.escena, c.pregunta, () => x.respuesta, c); } catch (e) { r = { error: e.message }; }
  const f = r.error ? [`error: ${String(r.error).slice(0, 160)}`] : juzgar(c, r.vista);
  // lo que habría visto sin que la app revise nada (la respuesta de la IA tal cual), para saber cuánto arregla la app
  const crudo = c.tipo === 'chat' ? juzgar(c, textoDe(x.respuesta).replace(/```notas[\s\S]*$/, '')).filter((m) => !/NOTA/.test(m)) : null;
  if (crudo && !crudo.length) sinApp++;
  if (c.tipo === 'plan' && !r.error) { descartadas += r.descartadas || 0; opsPlan += r.n || 0; }
  if (!f.length) bien++;
  console.log(`${f.length ? 'MAL ' : 'BIEN'} ${c.id}${x.v ? ` #${x.v + 1}` : ''}${c.tipo === 'plan' && !r.error ? ` · ${r.n} operaciones, ${r.descartadas} descartadas por la app` : ''}${f.length ? `\n     ${f.join('\n     ')}` : ''}`);
  if ((f.length && process.env.VER) || process.env.TODO) console.log(String(r.vista || '').replace(/^/gm, '       | '));
}
await cerrar();
console.log(`\n${bien} de ${total} BIEN · operaciones de los planes: ${opsPlan}, descartadas por la app: ${descartadas}`);
