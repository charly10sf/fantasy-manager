// Paso 1 de la prueba con la IA de verdad: saca, con el código de la app tal como está, lo que se le mandaría a Google
// en cada caso sin `ia` de casos.mjs (el sistema, los datos y la pregunta, ya con los alias de los rivales) y lo guarda en
// pedidos.json. Uso: node .github/ia/montar.mjs [salida]
import { writeFileSync } from 'node:fs';
import { chat, plan, cerrar } from './banco.mjs';
import { CASOS } from './casos.mjs';

const salida = process.argv[2] || new URL('./pedidos.json', import.meta.url).pathname;
const out = [];
for (const c of CASOS.filter((x) => !x.ia)) {
  const r = c.tipo === 'plan' ? await plan(c.escena, () => '{"operaciones":[],"titular":"x"}') : await chat(c.escena, c.pregunta, () => 'vale', c);
  const p = r.pedidos[0];
  if (!p) { console.log(`MAL  ${c.id}: la app no ha llamado a la IA (${r.error || ''})`); continue; }
  out.push({ id: c.id, stream: /stream/.test(p.url), cuerpo: p.cuerpo });
  const sis = p.cuerpo.systemInstruction ? p.cuerpo.systemInstruction.parts[0].text.length : 0;
  console.log(`${c.id}: sistema ${sis}, mensajes ${JSON.stringify(p.cuerpo.contents).length}`);
}
await cerrar();
writeFileSync(salida, JSON.stringify(out));
console.log(`${out.length} pedidos en ${salida}`);
