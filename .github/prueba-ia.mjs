// Prueba de la IA sin red (plan del día y chat): los casos de .github/ia/casos.mjs que llevan escrita a mano la
// respuesta de la IA (los fallos de verdad). Lo que se comprueba es que la app (cuadrarPlan en el plan, la revisión del
// chat) los para o los corrige antes de que los vea el mánager. No sale nada de la máquina: Google es de mentira.
// Y los casos del motor del plan (`tipo: 'motor'`): el plan sin IA en cada escenario, con el árbitro de banco.mjs.
// Uso: node .github/prueba-ia.mjs [trozo del id]   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
// MOTOR=viejo mide el plan sin IA de antes (planAuto) con los mismos casos.
import { chat, plan, motor, juzgar, cerrar } from './ia/banco.mjs';
import { CASOS } from './ia/casos.mjs';

const filtro = process.argv[2] || '';
const casos = CASOS.filter((c) => (c.ia || c.tipo === 'motor') && c.id.includes(filtro));
// (el plan del motor en un escenario es siempre el mismo: se calcula una vez por escenario)
const delMotor = new Map();
const planMotor = (e) => { if (!delMotor.has(e)) delMotor.set(e, motor(e)); return delMotor.get(e); };
let mal = 0;
for (const c of casos) {
  let visto = null, err = null;
  try {
    const r = c.tipo === 'motor' ? await planMotor(c.escena) : c.tipo === 'plan' ? await plan(c.escena, () => c.ia) : await chat(c.escena, c.pregunta, () => c.ia, c);
    visto = r.vista ?? null; err = r.error || (r.errores || [])[0] || null;
  } catch (e) { err = e.message; }
  const f = err ? [`error: ${String(err).slice(0, 160)}`] : juzgar(c, visto);
  if (f.length) { mal++; console.log(`MAL  ${c.id} (${c.de})\n     ${f.join('\n     ')}${process.env.VER ? `\n${String(visto).replace(/^/gm, '       | ')}` : ''}`); }
  else console.log(`BIEN ${c.id}`);
}
await cerrar();
const nM = casos.filter((c) => c.tipo === 'motor').length;
console.log(`${casos.length - mal} de ${casos.length} BIEN${mal ? `, ${mal} MAL` : ''}${nM ? ` (del motor: ${nM})` : ''}`);
process.exit(mal ? 1 : 0);
