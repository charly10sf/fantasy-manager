// Los planes del día con Haiku de verdad (19 nov, tercera parte de la revisión de la IA): en cada escena de banco.mjs, el
// plan del motor y el pedido corto tal cual los monta la app (pedidoCorto, opSistemaCorto, alias), el sistema que arma el
// Worker (sistemaCorto), Claude como en /plan (llamarClaude, jsonDe, planLimpio) y lo que contesta, aplicado como en la
// app (aplicarCorto y cuadrarPlan). Cuenta lo que importa: cuántas veces la app rehace o ajusta el plan, cuánto tacha o no
// aplica de lo que pide la IA, las frases que no valen, y lo que dice el árbitro. Deja .github/ia/respuestas-planes.md y
// .json para leerlos. Solo en la rama de pruebas (necesita ANTHROPIC_API_KEY).
//   ESCENAS=martes,veda,…  TOPE_USD=0.4  WEB=1 (búsquedas en Google por plan, como «planes.web» de limites.json)
import { writeFileSync } from 'node:fs';
import { pagina, cerrar, arbitro } from './banco.mjs';
import { sistemaCorto, jsonDe, planLimpio, fuentesDe } from '../../web/js/plan-sistema.js';
const W = await import('../../worker/src/index.js');
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const ESCENAS = (process.env.ESCENAS || 'martes,veda,sabado,sabado-justo,enjuego,paron,paron-final,m-negativo,jueves-negativo,holgado,hora-20,m-oferta-sube,m-25,m-clausula-mia').split(',');
const TOPE = Number(process.env.TOPE_USD || 0.4) * 1e6;
const WEB = Number(process.env.WEB ?? 1);
let gastado = 0;
const out = [`# Los planes con Haiku de verdad\n\n${new Date().toISOString()} · ${ESCENAS.length} escenas · ${WEB} búsqueda(s) por plan\n`];
const filas = [];
for (const escena of ESCENAS) {
  if (gastado > TOPE) { out.push('\n(Tope de gasto: paro aquí.)\n'); break; }
  const P = await pagina(escena);
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const prep = await P.page.evaluate(async () => {
      const I = await import('./js/ia.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js');
      const { D, M } = window.S;
      const c = Dt.cfg();
      const R = Pm.planDeHoy(D, M, c);
      window.__R = R;
      const sd = I.seudonimos(D);
      const pedido = I.pedidoCorto(D, M, c, R);
      return { pedido: sd.n ? sd.tapar(pedido) : pedido, op: I.opSistemaCorto(), alias: sd.n ? { puesto: !!sd.porPuesto, ex: !!sd.ex } : null, motor: { titular: R.titular, modo: R.modo, ops: (R.ops || []).filter((o) => !o.descartada).map((o) => `${o.accion} ${o.jugador || ''}`.trim()) } };
    });
    const sistema = sistemaCorto({ ...prep.op, alias: prep.alias, web: WEB });
    const t0 = Date.now();
    let r = null, err = null;
    try { r = await W.llamarClaude({ CLAUDE_PLANES: KEY }, W.PLAN_MODELO, sistema, prep.pedido, fetch, { web: WEB }); } catch (e) { err = String(e.message || e); }
    const ms = Date.now() - t0;
    if (!r) { out.push(`\n## ${escena}\n\n**ERROR** ${err}\n`); continue; }
    const coste = W.costeDe(r, W.PLAN_MODELO);
    gastado += coste;
    const j = jsonDe(r.texto);
    const plan = planLimpio(j ? fuentesDe(j, r.vistas, r.citadas) : null);
    const vista = await P.page.evaluate(async ({ plan }) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
      const { D, M } = window.S, R = window.__R;
      if (!plan) return { sinFormato: true };
      const sd = I.seudonimos(D);
      const json = sd.n ? JSON.parse(sd.destapar(JSON.stringify(plan), { json: true })) : plan;
      const A = I.aplicarCorto(json, R, D, M, Dt.cfg());
      const cu = I.cuadrarPlan(A, D, M);
      const tachados = (cu.ops || []).filter((o) => o._k && (o.descartada || o.sugerencia)).map((o) => `${o.accion} ${o.jugador}: ${String(o.aviso || '').slice(0, 120)}`);
      const reglas = window.__arbitro(cu, D, M, U.eur).filter((x) => /^(REGLAS|VENDE_POR_CAJA|ONCE_BAJA)/.test(x));
      return {
        titular: A.titular, situacion: A.situacion, cambios: A.cambios, tachados, reglas,
        pasos: (A.operaciones || []).map((o) => `${o.accion} ${o.jugador || ''}${o.importe ? ` ${U.eur(o.importe)}` : ''} (${o.cuando || ''}): ${o.motivo || ''}`),
        rivales: (A.rivales || []).map((x) => `${x.manager || x.nombre || x.rival || ''}: ${x.texto || ''}`), noticias: (A.noticias || []).map((x) => `${x.jugador || ''}: ${x.texto || ''}`),
        json,
      };
    }, { plan });
    filas.push({ escena, ms, coste, entra: r.entra, sale: r.sale, busquedas: r.busquedas || 0, crudo: r.texto, motor: prep.motor, ...vista });
    const malas = [];
    if (vista.sinFormato) malas.push('sin formato');
    if (vista.cambios && vista.cambios.rehecho) malas.push(`rehecho: ${vista.cambios.rehecho}`);
    if (vista.cambios && vista.cambios.ajustado) malas.push(`ajustado: ${vista.cambios.ajustado.join('; ')}`);
    if (vista.cambios && vista.cambios.noAplicado && vista.cambios.noAplicado.length) malas.push(`no aplicado: ${vista.cambios.noAplicado.join('; ')}`);
    if (vista.cambios && vista.cambios.frasesNo && vista.cambios.frasesNo.length) malas.push(`frases que no valen: ${vista.cambios.frasesNo.length}`);
    if (vista.tachados && vista.tachados.length) malas.push(`tachados: ${vista.tachados.join('; ')}`);
    if (vista.reglas && vista.reglas.some((x) => !/^REGLAS: ok/.test(x))) malas.push(vista.reglas.filter((x) => !/^REGLAS: ok/.test(x)).join(' | '));
    out.push(`\n## ${escena} (${prep.motor.modo || ''})\n\n${ms} ms · ${r.entra} tokens de entrada, ${r.sale} de salida, ${r.busquedas || 0} búsquedas · ${(coste / 1e4).toFixed(2)} céntimos${malas.length ? ` · **${malas.join(' · ')}**` : ''}\n\nEl motor: ${prep.motor.titular} → ${prep.motor.ops.join('; ')}\n\n**${vista.titular || '(sin titular)'}**\n\n${vista.situacion || ''}\n\n${(vista.pasos || []).map((x) => `- ${x}`).join('\n')}${vista.rivales && vista.rivales.length ? `\n\nRivales:\n${vista.rivales.map((x) => `- ${x}`).join('\n')}` : ''}${vista.noticias && vista.noticias.length ? `\n\nNoticias:\n${vista.noticias.map((x) => `- ${x}`).join('\n')}` : ''}\n\nCambios de la IA: quita [${((vista.cambios || {}).quita || []).join(', ')}], mete [${((vista.cambios || {}).mete || []).join(', ')}]\n`);
    console.log(`${malas.length ? 'OJO ' : 'BIEN'} ${escena} ${ms} ms ${(coste / 1e4).toFixed(2)} c${malas.length ? ` (${malas.join(' · ').slice(0, 300)})` : ''}`);
  } finally { await P.cerrar(); }
}
await cerrar();
const con = (f) => filas.filter(f).length;
out.splice(1, 0, `\n**Resumen:** ${filas.length} planes; ${con((x) => x.cambios && x.cambios.rehecho)} rehechos, ${con((x) => x.cambios && x.cambios.ajustado)} ajustados, ${con((x) => x.cambios && x.cambios.noAplicado && x.cambios.noAplicado.length)} con algo de la IA no aplicado, ${con((x) => x.tachados && x.tachados.length)} con algo tachado, ${con((x) => x.reglas && x.reglas.some((l) => !/^REGLAS: ok/.test(l)))} que el árbitro no da por buenos; ${(gastado / 1e4).toFixed(2)} céntimos (${filas.length ? (gastado / filas.length / 1e4).toFixed(2) : 0} por plan).\n`);
writeFileSync(new URL('./respuestas-planes.md', import.meta.url), out.join('\n'));
writeFileSync(new URL('./respuestas-planes.json', import.meta.url), JSON.stringify(filas, null, 1));
console.log(`Gastado: ${(gastado / 1e4).toFixed(2)} céntimos · ${filas.length} planes`);
