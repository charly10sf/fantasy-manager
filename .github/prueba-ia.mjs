// Prueba de la IA sin red (plan del día y chat): los casos de .github/ia/casos.mjs que llevan escrita a mano la
// respuesta de la IA (los fallos de verdad). Lo que se comprueba es que la app (cuadrarPlan en el plan, la revisión del
// chat) los para o los corrige antes de que los vea el mánager. No sale nada de la máquina: Google es de mentira.
// Uso: node .github/prueba-ia.mjs [trozo del id]   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import { chat, plan, juzgar, cerrar } from './ia/banco.mjs';
import { CASOS } from './ia/casos.mjs';

const filtro = process.argv[2] || '';
const casos = CASOS.filter((c) => c.ia && c.id.includes(filtro));
let mal = 0;
for (const c of casos) {
  let visto = null, err = null;
  try {
    const r = c.tipo === 'plan' ? await plan(c.escena, () => c.ia) : await chat(c.escena, c.pregunta, () => c.ia, c);
    visto = r.vista ?? null; err = r.error || (r.errores || [])[0] || null;
  } catch (e) { err = e.message; }
  const f = err ? [`error: ${String(err).slice(0, 160)}`] : juzgar(c, visto);
  if (f.length) { mal++; console.log(`MAL  ${c.id} (${c.de})\n     ${f.join('\n     ')}${process.env.VER ? `\n${String(visto).replace(/^/gm, '       | ')}` : ''}`); }
  else console.log(`BIEN ${c.id}`);
}
await cerrar();
console.log(`${casos.length - mal} de ${casos.length} BIEN${mal ? `, ${mal} MAL` : ''}`);
process.exit(mal ? 1 : 0);
