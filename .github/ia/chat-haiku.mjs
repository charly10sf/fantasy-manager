// El chat con Haiku de verdad (16 nov; batería ampliada y comprobador el 19 nov): las preguntas de chat-casos.mjs con la
// liga de ejemplo, montadas como la app (pedidoChat de ia.js) y mandadas a Claude como el Worker (armarChat y llamarClaude
// de worker/src/index.js). Lo que contesta pasa por lo mismo que en la app (alias de vuelta, notas, revisión), lo coteja
// cotejar-chat.mjs con lo que se le mandó y queda en .github/ia/respuestas-chat.md (para leerlo) y respuestas-chat.json.
// Solo en la rama de pruebas (Action «Pruebas chat»): necesita ANTHROPIC_API_KEY. PW_MODULO como en prueba-web.mjs.
//   ESFUERZOS=medium,low  ESCENAS=martes,paron,sabado  TOPE_USD=0.4  SOLO=id1,id2 (solo esas preguntas y las que siguen)
//   SECO=1: sin IA; dice cuánto se le mandaría en cada pregunta (para medir el recorte de lo que lee el chat)
//   REPASO=archivo.json: sin IA; vuelve a pasar las respuestas guardadas por la revisión y el comprobador de ahora
import { writeFileSync, readFileSync } from 'node:fs';
import { pagina, cerrar } from './banco.mjs';
import { CASOS, PREP_LIGA, prepararEnPagina, vistaEnPagina, conMarcas } from './chat-casos.mjs';
import { cotejar } from './cotejar-chat.mjs';
const W = await import('../../worker/src/index.js');
const SECO = !!process.env.SECO, REPASO = process.env.REPASO ? JSON.parse(readFileSync(process.env.REPASO, 'utf8')) : null;
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY && !SECO && !REPASO) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const MODELO = process.env.MODELO || 'claude-haiku-5-5';
const ESFUERZOS = (process.env.ESFUERZOS || 'low').split(',').map((x) => x.trim()).filter(Boolean);
const ESCENAS = (process.env.ESCENAS || 'martes,paron,sabado').split(',').map((x) => x.trim()).filter(Boolean);
const TOPE = Number(process.env.TOPE_USD || 0.4) * 1e6;
const SOLO = process.env.SOLO ? new Set(process.env.SOLO.split(',')) : null;
const SALIDA = process.env.SALIDA || new URL('./respuestas-chat', import.meta.url).pathname;
// con SOLO, una pregunta que sigue a otra arrastra a la de antes (si no, no tiene conversación)
const casos = SOLO ? CASOS.filter((c, i) => SOLO.has(c.id) || CASOS.slice(i + 1).some((d, k) => SOLO.has(d.id) && CASOS.slice(i + 1, i + 1 + k + 1).every((e) => e.sigue))) : CASOS;

let gastado = 0;
const out = [`# El chat con ${MODELO} ${SECO ? '(en seco)' : REPASO ? '(repaso)' : 'de verdad'}\n\n${new Date().toISOString()} · escenas ${ESCENAS.join(', ')} · esfuerzo ${ESFUERZOS.join(', ')}\n`];
const filas = [];
for (const escena of ESCENAS) {
  const P = await pagina(escena);
  try {
    // (sin rehacer el motor: rehecho sin las fichas ni los onces de la página, el once y sus puntos salen distintos)
    await P.page.evaluate((prep) => { new Function('S', prep)(window.S); }, PREP_LIGA);
    const sistemaTxt = await P.page.evaluate(async () => { const C = await import('./js/chat-sistema.js'); return C.sistemaChat({}); });
    for (const esf of ESFUERZOS) {
      out.push(`\n## Escena «${escena}», esfuerzo ${esf}\n`);
      let hist = [];
      for (const caso of casos) {
        if (gastado > TOPE) { out.push('\n(Tope de gasto: paro aquí.)\n'); break; }
        if (!caso.sigue) hist = [];
        const prep = await P.page.evaluate(prepararEnPagina, { q: caso.q, hist, prep: caso.prep || null });
        const armado = W.armarChat(prep.cuerpo, { cacheLiga: process.env.CACHE_LIGA || 'siempre' });
        if (!armado) { out.push(`\n### ${caso.id}\n\n**MAL: el Worker no acepta el pedido.**\n`); continue; }
        const largo = armado.sistema.reduce((s, b) => s + b.text.length, 0) + armado.mensajes.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : m.content.reduce((t, b) => t + (b.text || '').length, 0)), 0);
        if (SECO) {
          // (19 nov) lo que va en la caché: lo fijo y, si se repite igual que en la pregunta de antes de la conversación, lo de
          // la liga (bloques con cache_control). «Facturado»: lo de la caché que se lee cuenta 0,1; lo que se escribe, 1,25
          const conCache = armado.sistema.filter((b) => b.cache_control).map((b) => b.text);
          const prev = filas.length && caso.sigue ? filas[filas.length - 1].cacheados : [];
          let fact = 0, factAntes = 0;
          for (const b of armado.sistema) {
            const lee = b.cache_control && prev.includes(b.text), escribe = b.cache_control && !lee;
            fact += b.text.length * (lee ? 0.1 : escribe ? 1.25 : 1);
          }
          // (antes: solo lo fijo en la caché; los datos, siempre enteros)
          const fijoAntes = armado.sistema[0].text, prevFijo = filas.length && caso.sigue ? filas[filas.length - 1].fijo : '';
          factAntes = fijoAntes.length * (prevFijo === fijoAntes ? 0.1 : 1.25) + prep.cuerpo.datos.length;
          const resto = largo - armado.sistema.reduce((t, b) => t + b.text.length, 0);
          filas.push({ escena, id: caso.id, largo, datos: prep.cuerpo.datos.length, cacheados: conCache, fijo: fijoAntes, fact: Math.round(fact + resto), factAntes: Math.round(factAntes + resto), sigue: !!caso.sigue });
          console.log(`${escena}/${caso.id}: ${largo} caracteres (datos ${prep.cuerpo.datos.length}) · facturado ${Math.round(fact + resto)} (antes ${Math.round(factAntes + resto)})`);
          hist = [...hist, { r: 'yo', t: prep.pre, ts: Date.now() }, { r: 'ia', t: 'Vale.', ts: Date.now() }];
          continue;
        }
        const t0 = Date.now();
        let r = null, err = null;
        if (REPASO) {
          const g = REPASO.find((x) => x.escena === escena && x.id === caso.id && x.esf === esf);
          if (!g) { hist = []; continue; }
          r = { texto: g.crudo, entra: g.entra, sale: g.sale, cache: g.cache };
        } else {
          try { r = await W.llamarClaude({ CLAUDE_PLANES: KEY }, MODELO, armado.sistema, null, fetch, { mensajes: armado.mensajes, tokens: W.PREGUNTA_TOKENS, esfuerzo: esf }); } catch (e) { err = String(e.message || e); }
        }
        const ms = REPASO ? 0 : Date.now() - t0;
        if (!r) { out.push(`\n### ${caso.id}: ${prep.pre}\n\n**ERROR** ${err} (${ms} ms)\n`); continue; }
        const coste = REPASO ? (REPASO.find((x) => x.escena === escena && x.id === caso.id && x.esf === esf) || {}).coste || 0 : W.costeDe(r, MODELO);
        gastado += REPASO ? 0 : coste;
        const vista = await P.page.evaluate(vistaEnPagina, { texto: r.texto, pre: prep.pre, hist });
        const c = cotejar({ texto: vista.texto, pregunta: prep.pre, hist, datos: prep.datos + '\n' + sistemaTxt, nombres: prep.nombres, clubes: prep.clubes, equipos: prep.equipos, apodos: prep.apodos, plan: prep.plan, recomiendo: vista.recomiendo, planCuenta: caso.tipo === 'plan', debe: conMarcas(caso.debe, prep.marcas), noDebe: conMarcas(caso.noDebe, prep.marcas), contado: caso.contado || null, corr: vista.corr || [], promete: !!vista.promete });
        filas.push({ escena, esf, id: caso.id, tipo: caso.tipo, pre: prep.pre, hist: hist.map((m) => ({ r: m.r, t: m.t })), crudo: r.texto, texto: vista.texto, revision: vista.revision, apuntadas: vista.apuntadas || [], corr: vista.corr || [], promete: !!vista.promete, recomiendo: vista.recomiendo, ms, coste, entra: r.entra, sale: r.sale, cache: r.cache, largo, inventadas: c.inventadas, marcas: c.marcas, frases: c.frases, palabras: c.palabras });
        const malas = [...c.inventadas, ...c.marcas];
        out.push(`\n### ${caso.id} (${caso.tipo}): «${prep.pre}»\n\n${ms} ms · ${r.entra} tokens de entrada y ${r.sale} de salida · ${(coste / 1e4).toFixed(3)} céntimos · ${c.palabras} palabras, ${c.frases} frases${vista.revisadas ? ` · la app revisó ${vista.revisadas}` : ''}${malas.length ? ` · **COTEJO: ${malas.join(' · ')}**` : ''}${vista.apuntadas.length ? ` · apuntó: ${vista.apuntadas.join(' | ')}` : ''}\n\n${vista.texto.split('\n').map((l) => `> ${l}`).join('\n')}\n`);
        hist = [...hist, { r: 'yo', t: prep.pre, ts: Date.now() }, { r: 'ia', t: vista.texto, ts: Date.now() }];
        console.log(`${malas.length ? 'MAL ' : 'BIEN'} ${escena}/${esf}/${caso.id} ${ms} ms ${(coste / 1e4).toFixed(3)} c${malas.length ? ` (${malas.join(' · ')})` : ''}`);
      }
    }
  } finally { await P.cerrar(); }
}
await cerrar();
const media = (l) => (l.length ? Math.round(l.reduce((s, x) => s + x, 0) / l.length) : 0);
if (SECO) {
  console.log(`Media: ${media(filas.map((x) => x.largo))} caracteres por pregunta (datos ${media(filas.map((x) => x.datos))})`);
  const fa = filas.reduce((t, x) => t + x.fact, 0), fb = filas.reduce((t, x) => t + x.factAntes, 0), seguidas = filas.filter((x) => x.sigue);
  console.log(`Facturado (caracteres, con la caché): ${fa} frente a ${fb} antes (${Math.round((1 - fa / fb) * 100)} % menos); en las preguntas que siguen una conversación: ${Math.round((1 - seguidas.reduce((t, x) => t + x.fact, 0) / Math.max(1, seguidas.reduce((t, x) => t + x.factAntes, 0))) * 100)} % menos (${seguidas.length} de ${filas.length})`);
  for (const e of ESCENAS) console.log(`  ${e}: ${media(filas.filter((x) => x.escena === e).map((x) => x.largo))}`);
  process.exit(0);
}
const con = (f) => filas.filter(f).length;
const lee = filas.reduce((t, x) => t + ((x.cache && x.cache.lee) || 0), 0), escribe = filas.reduce((t, x) => t + ((x.cache && x.cache.escribe) || 0), 0), sinC = filas.reduce((t, x) => t + ((x.cache && x.cache.sin) || 0), 0);
out.splice(1, 0, `\n**Caché (19 nov):** ${lee} tokens leídos de la caché, ${escribe} escritos y ${sinC} sin caché; ${filas.filter((x) => x.cache && x.cache.lee > 0).length} de ${filas.length} respuestas leyeron algo de ella.\n`);
out.splice(1, 0, `\n**Resumen:** ${filas.length} respuestas; ${con((x) => x.inventadas.length)} con algo que no sale de los datos, ${con((x) => x.marcas.length)} con marcas; ${(gastado / 1e4).toFixed(2)} céntimos en total (${filas.length ? (gastado / filas.length / 1e4).toFixed(3) : 0} por respuesta); tiempo medio ${media(filas.map((x) => x.ms))} ms; ${media(filas.map((x) => x.entra || 0))} tokens de entrada de media; largo medio ${media(filas.map((x) => x.palabras))} palabras.\n`);
writeFileSync(`${SALIDA}.md`, out.join('\n'));
writeFileSync(`${SALIDA}.json`, JSON.stringify(filas, null, 1));
console.log(`Gastado: ${(gastado / 1e4).toFixed(2)} céntimos · ${filas.length} respuestas · ${con((x) => x.inventadas.length)} con inventadas · ${con((x) => x.marcas.length)} con marcas`);
