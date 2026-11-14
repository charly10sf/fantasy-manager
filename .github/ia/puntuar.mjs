// Paso 3: pasa cada respuesta de verdad (respuestas.json, de la Action) por la app, como si acabara de llegar de Google,
// y mira lo que acaba viendo el mánager. Uso: node .github/ia/puntuar.mjs respuestas.json [trozo del id]   (VER=1 enseña
// lo que se ve en los que fallan; TODO=1, en todos)
import { readFileSync } from 'node:fs';
import { chat, plan, juzgar, cerrar } from './banco.mjs';
import { CASOS } from './casos.mjs';

// LOTE=a (lo de antes) o b (lo nuevo) si la Action preguntó los dos; la app con la que se puntúa es la del árbol de trabajo
const resp = JSON.parse(readFileSync(process.argv[2])).filter((x) => !process.env.LOTE || (x.lote || 'a') === process.env.LOTE);
const filtro = process.argv[3] || '';
let bien = 0, total = 0, sinApp = 0, descartadas = 0, opsPlan = 0;
// (14 nov) por lote (modelo y pasada): cuántos bien, tokens y tiempo de media, y lo que la IA cambió del plan del motor
const porLote = {};
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
  const cam = r.crudo && r.crudo.cambios ? r.crudo.cambios : null;
  const L = (porLote[`${x.modelo || '?'} · lote ${x.lote || 'a'}`] ||= { n: 0, bien: 0, entra: 0, sale: 0, piensa: 0, ms: 0, quita: 0, mete: 0, no: 0, sinFrase: 0 });
  L.n++; if (!f.length) L.bien++; L.entra += x.entra || 0; L.sale += x.sale || 0; L.piensa += x.piensa || 0; L.ms += x.ms || 0;
  if (cam) { L.quita += cam.quita.length; L.mete += cam.mete.length; L.no += cam.noAplicado.length; L.sinFrase += cam.sinFrase || 0; }
  console.log(`${f.length ? 'MAL ' : 'BIEN'} ${c.id} [${x.modelo}]${crudo ? (crudo.length ? ' (la IA sola: MAL)' : ' (la IA sola: BIEN)') : ''}${c.tipo === 'plan' && !r.error ? ` · ${r.n} operaciones, ${r.descartadas} descartadas por la app` : ''}${cam ? ` · la IA quita [${cam.quita.join(', ')}], mete [${cam.mete.join(', ')}]${cam.noAplicado.length ? `, no aplicado [${cam.noAplicado.join(', ')}]` : ''}${cam.sinFrase ? `, ${cam.sinFrase} frases con cifras que no están (sale la de la app)` : ''}` : ''}${x.entra ? ` · ${Math.round((x.ms || 0) / 100) / 10} s, entra ${x.entra}, sale ${x.sale}${x.piensa ? ` (+${x.piensa} pensando)` : ''}` : ''}${f.length ? `\n     ${f.join('\n     ')}` : ''}`);
  if ((f.length && process.env.VER) || process.env.TODO) console.log(String(r.vista || '').replace(/^/gm, '       | '));
  if (process.env.FRASES && cam && cam.frasesNo) for (const z of cam.frasesNo) console.log(`       FRASE NO (${z.jugador}; no encuentro ${z.cifra}): ${z.frase}`);
}
await cerrar();
for (const [k, L] of Object.entries(porLote)) console.log(`${k}: ${L.bien} de ${L.n} BIEN · de media ${Math.round(L.ms / L.n / 100) / 10} s, entra ${Math.round(L.entra / L.n)}, sale ${Math.round(L.sale / L.n)}${L.piensa ? ` (+${Math.round(L.piensa / L.n)} pensando)` : ''} · la IA quitó ${L.quita}, metió ${L.mete}, no aplicado ${L.no}, frases de la app ${L.sinFrase}`);
console.log(`\n${bien} de ${total} BIEN · chat, la IA sola (sin revisar): ${sinApp} BIEN · operaciones de los planes: ${opsPlan}, descartadas por la app: ${descartadas}`);
