// «Que la IA escriba menos en los planes», medido con Haiku de verdad (25 nov, parte 2 de claude/prompt-cerrar-auditoria-1.md).
// CUESTA DINERO: no se lanza sin que Carlos diga cuánto se puede gastar. Solo en la rama de pruebas (ANTHROPIC_API_KEY).
// En cada escena de banco.mjs, el MISMO plan del motor pedido de tres formas:
//   A. como está publicado: las instrucciones de antes (plan-sistema-antes.js, copia de main) y el formato de antes del pedido;
//   B. las instrucciones nuevas (frases de 16 palabras, situación de una frase, 3 noticias y 2 rivales sin relleno), razonando;
//   C. las nuevas y SIN razonar antes de contestar (`thinking: disabled`, lo que hace «planes.pensar»: false en limites.json).
// De cada uno: los tokens de salida, los caracteres que escribe de verdad (lo demás es razonamiento), lo que tarda, las
// búsquedas que hace (sin razonar puede saltárselas), lo que cuesta y, aplicado como en la app (aplicarCorto y cuadrarPlan),
// si los pasos y lo que quita o mete son los mismos que en A, las palabras de cada frase y lo que dice el árbitro.
// Deja .github/ia/planes-corto.md (la tabla y los tres planes de cada escena, para leerlos uno al lado del otro) y .json.
//   ESCENAS=martes,veda,…   VARIANTES=A,B,C   TOPE_USD=0.35   WEB=1 (búsquedas por plan, como «planes.web»)
// Con las 8 escenas y las 3 variantes son 24 planes: unos 16 céntimos de dólar (a 0,68 por plan, lo medido el 22 nov).
import { writeFileSync } from 'node:fs';
import { pagina, cerrar, arbitro } from './banco.mjs';
import { sistemaCorto, jsonDe, planLimpio, fuentesDe } from '../../web/js/plan-sistema.js';
import { sistemaCorto as sistemaAntes } from './plan-sistema-antes.js';
const W = await import('../../worker/src/index.js');
// SECO=1: sin IA y sin gastar (contesta una respuesta de mentira que deja el plan como está): para probar que el guion funciona
const SECO = !!process.env.SECO;
const KEY = process.env.ANTHROPIC_API_KEY || (SECO ? 'seco' : '');
if (!KEY) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const deMentira = async (u, o) => {
  const b = JSON.parse(o.body), ids = [...String(b.messages[0].content).matchAll(/^\[(p\d+)\] /gm)].map((m) => m[1]);
  const corto = !/una o dos frases/.test(b.messages[0].content);
  const texto = '```json\n' + JSON.stringify({ pasos: ids.map((id) => ({ id, frase: corto ? 'Es lo que toca hoy.' : 'Es lo que toca hoy, y además lo explico con muchas más palabras de las que hacen falta para decirlo.' })), quita: [], mete: [], situacion: 'Vas bien.', noticias: [], rivales: [], titular: 'Plan de hoy, sin cambios' }) + '\n```';
  return new Response(JSON.stringify({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 8000, output_tokens: b.thinking ? 300 : 3000 }, stop_reason: 'end_turn' }), { status: 200 });
};
const pedir = SECO ? deMentira : fetch;
const ESCENAS = (process.env.ESCENAS || 'martes,veda,enjuego,paron,m-negativo,jueves-negativo,hora-20,m-clausula-mia').split(',');
const VARIANTES = (process.env.VARIANTES || 'A,B,C').split(',');
const TOPE = Number(process.env.TOPE_USD || 0.35) * 1e6;
const WEB = Number(process.env.WEB ?? 1);
// el final del pedido como va publicado (ia.js de main, pedidoCorto): la variante A lo lleva así
const FORMATO_ANTES = ` "pasos": [{"id": "p1", "frase": "una o dos frases: por qué, con las cifras de arriba y la noticia si la hay"}],
 "quita": [{"id": "p3", "motivo": "la noticia o lo que me contaste que lo desaconseja"}],
 "mete": [{"id": "a1", "frase": "por qué entra, en una o dos frases"}],
 "situacion": "2 frases: cómo está mi equipo y qué buscamos hoy, con cifras",
 "noticias": [{"jugador": "nombre", "texto": "qué ha pasado y cómo afecta", "efecto": "sube|baja|neutro"}],
 "rivales": [{"manager": "nombre", "texto": "qué está haciendo y si va a por mis jugadores"}],
 "titular": "8 a 16 palabras con lo más importante de hoy"
}
"pasos" lleva, EN EL ORDEN en que los harías, los pasos del plan que se quedan (todos los que no quites). "quita" y "mete", vacíos si no hay un motivo claro. Como mucho 4 noticias y 3 rivales.`;
const pedidoAntes = (p) => { const i = p.lastIndexOf(' "pasos": [{"id": "p1"'); if (i < 0) throw new Error('el pedido no trae el formato donde se esperaba'); return p.slice(0, i) + FORMATO_ANTES; };
const NOMBRE = { A: 'A, como está publicado', B: 'B, instrucciones nuevas', C: 'C, nuevas y sin razonar' };
let gastado = 0;
const filas = [], out = [];
const pal = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
for (const escena of ESCENAS) {
  if (gastado > TOPE) { out.push('\n(Tope de gasto: paro aquí.)\n'); break; }
  const P = await pagina(escena);
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const prep = await P.page.evaluate(async () => {
      const I = await import('./js/ia.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js');
      const { D, M } = window.S, c = Dt.cfg();
      const R = Pm.planDeHoy(D, M, c);
      window.__R = R;
      const sd = I.seudonimos(D);
      const pedido = I.pedidoCorto(D, M, c, R);
      return { pedido: sd.n ? sd.tapar(pedido) : pedido, op: I.opSistemaCorto(), alias: sd.n ? { puesto: !!sd.porPuesto, ex: !!sd.ex } : null, motor: { titular: R.titular, modo: R.modo, ops: (R.ops || []).filter((o) => !o.descartada).map((o) => `${o.accion} ${o.jugador || ''}`.trim()) } };
    });
    out.push(`\n## ${escena} (${prep.motor.modo || ''})\n\nEl motor: ${prep.motor.titular} → ${prep.motor.ops.join('; ')}\n`);
    for (const v of VARIANTES) {
      if (gastado > TOPE) break;
      const sistema = (v === 'A' ? sistemaAntes : sistemaCorto)({ ...prep.op, alias: prep.alias, web: WEB });
      const pedido = v === 'A' ? pedidoAntes(prep.pedido) : prep.pedido;
      const t0 = Date.now();
      let r = null, err = null;
      try { r = await W.llamarClaude({ CLAUDE_PLANES: KEY }, W.PLAN_MODELO, sistema, pedido, pedir, { web: WEB, pensar: v !== 'C' }); } catch (e) { err = String(e.message || e); }
      const ms = Date.now() - t0;
      if (!r) { out.push(`\n### ${NOMBRE[v]}\n\n**ERROR** ${err}\n`); filas.push({ escena, v, error: err }); continue; }
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
        return {
          titular: A.titular, situacion: A.situacion, cambios: A.cambios,
          claves: (A.operaciones || []).filter((o) => o._k).map((o) => o._k),
          frases: (A.operaciones || []).filter((o) => o._k && o.motivoApp).map((o) => o.motivo),
          pasos: (A.operaciones || []).map((o) => `${o.accion} ${o.jugador || ''}${o.importe ? ` ${U.eur(o.puja_max || o.importe)}` : ''}: ${o.motivo || ''}`),
          tachados: (cu.ops || []).filter((o) => o._k && (o.descartada || o.sugerencia)).map((o) => `${o.accion} ${o.jugador}`),
          reglas: window.__arbitro(cu, D, M, U.eur).filter((x) => /^REGLAS/.test(x) && !/^REGLAS: ok/.test(x)),
          rivales: (A.rivales || []).map((x) => `${x.manager || ''}: ${x.texto || ''}`), noticias: (A.noticias || []).map((x) => `${x.jugador || ''}: ${x.texto || ''}`),
        };
      }, { plan });
      const crudas = plan ? plan.pasos.map((x) => x.frase).filter(Boolean) : [];
      const f = { escena, v, ms, coste, entra: r.entra, sale: r.sale, texto: r.texto.length, busquedas: r.busquedas || 0, fin: r.fin, sinPensar: !!r.sinPensar, palFrase: crudas.length ? Math.round(crudas.reduce((s, x) => s + pal(x), 0) / crudas.length * 10) / 10 : 0, maxFrase: crudas.length ? Math.max(...crudas.map(pal)) : 0, palSit: plan ? pal(plan.situacion) : 0, palTit: plan ? pal(plan.titular) : 0, nRiv: plan ? plan.rivales.length : 0, nNot: plan ? plan.noticias.length : 0, crudo: r.texto, ...vista };
      filas.push(f);
      out.push(`\n### ${NOMBRE[v]}\n\n${ms} ms · ${r.entra}/${r.sale} tokens (escribe ${r.texto.length} caracteres) · ${r.busquedas || 0} búsquedas · ${(coste / 1e4).toFixed(2)} céntimos · fin ${r.fin}${vista.sinFormato ? ' · **SIN FORMATO**' : ''}${vista.cambios && vista.cambios.rehecho ? ` · **rehecho: ${vista.cambios.rehecho}**` : ''}${vista.tachados && vista.tachados.length ? ` · **tachados: ${vista.tachados.join('; ')}**` : ''}${vista.reglas && vista.reglas.length ? ` · **${vista.reglas.join(' | ')}**` : ''}\n\n**${vista.titular || '(sin titular)'}**\n\n${vista.situacion || ''}\n\n${(vista.pasos || []).map((x) => `- ${x}`).join('\n')}${vista.noticias && vista.noticias.length ? `\n\nNoticias:\n${vista.noticias.map((x) => `- ${x}`).join('\n')}` : ''}${vista.rivales && vista.rivales.length ? `\n\nRivales:\n${vista.rivales.map((x) => `- ${x}`).join('\n')}` : ''}${vista.cambios ? `\n\nQuita [${(vista.cambios.quita || []).join(', ')}], mete [${(vista.cambios.mete || []).join(', ')}]${(vista.cambios.noAplicado || []).length ? `, no aplicado [${vista.cambios.noAplicado.join('; ')}]` : ''}${vista.cambios.sinFrase ? `, ${vista.cambios.sinFrase} frases que no valen` : ''}` : ''}\n`);
      console.log(`${escena} ${v}: ${ms} ms, ${r.sale} tokens de salida, ${r.texto.length} caracteres, ${(coste / 1e4).toFixed(2)} c${vista.sinFormato ? ' SIN FORMATO' : ''}`);
    }
  } finally { await P.cerrar(); }
}
await cerrar();

/* ---------- la tabla ---------- */
const med = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
const p90 = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.9))] : 0; };
const igual = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
const tabla = ['| | Planes | Salida media | Salida 90 % | Lo que escribe (caracteres) | Segundos | Búsquedas | Céntimos por plan | Palabras por frase (media, máx.) | Situación (palabras) | Rivales | Mismos pasos que A | Sin formato o cortados | Tachados o árbitro |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const v of VARIANTES) {
  const xs = filas.filter((f) => f.v === v && !f.error);
  if (!xs.length) continue;
  const conA = xs.filter((f) => { const a = filas.find((g) => g.v === 'A' && g.escena === f.escena && !g.error && !g.sinFormato); return a && !f.sinFormato; });
  const mismos = conA.filter((f) => igual(f.claves, filas.find((g) => g.v === 'A' && g.escena === f.escena).claves)).length;
  tabla.push(`| ${NOMBRE[v]} | ${xs.length} | ${med(xs.map((f) => f.sale))} | ${p90(xs.map((f) => f.sale))} | ${med(xs.map((f) => f.texto))} | ${(med(xs.map((f) => f.ms)) / 1000).toFixed(1)} | ${xs.reduce((s, f) => s + f.busquedas, 0)} | ${(med(xs.map((f) => f.coste)) / 1e4).toFixed(2)} | ${(xs.reduce((s, f) => s + f.palFrase, 0) / xs.length).toFixed(1)}, ${Math.max(...xs.map((f) => f.maxFrase))} | ${med(xs.map((f) => f.palSit))} | ${(xs.reduce((s, f) => s + f.nRiv, 0) / xs.length).toFixed(1)} | ${v === 'A' ? '—' : `${mismos} de ${conA.length}`} | ${xs.filter((f) => f.sinFormato || f.fin === 'max_tokens').length} | ${xs.filter((f) => (f.tachados || []).length || (f.reglas || []).length).length} |`);
}
const cab = `# Que la IA escriba menos en los planes: antes y después, con Haiku de verdad\n\n${new Date().toISOString()} · ${ESCENAS.length} escenas · ${WEB} búsqueda(s) por plan · gastado ${(gastado / 1e4).toFixed(2)} céntimos\n\n${tabla.join('\n')}\n\nQué mirar: que B y C lleven los mismos pasos que A y que el árbitro no proteste; que C haga las mismas búsquedas que A (sin razonar puede saltárselas); y, leyendo los tres planes de cada escena, que las frases cortas sigan diciendo el motivo que decide.\n`;
writeFileSync(new URL('./planes-corto.md', import.meta.url), cab + out.join('\n'));
writeFileSync(new URL('./planes-corto.json', import.meta.url), JSON.stringify(filas, null, 1));
console.log(tabla.join('\n'));
console.log(SECO ? `En seco: ${filas.length} planes de mentira, nada gastado` : `Gastado: ${(gastado / 1e4).toFixed(2)} céntimos · ${filas.length} planes`);
