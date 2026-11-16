// El chat con Haiku de verdad (16 nov): las preguntas de abajo con la liga de ejemplo, montadas como la app (pedidoChat de
// ia.js) y mandadas a Claude como el Worker (armarChat y llamarClaude de worker/src/index.js). Lo que contesta pasa por lo
// mismo que en la app (alias de vuelta, notas, revisión) y queda en .github/ia/respuestas-chat.md para leerlo.
// Solo en la rama de pruebas (Action «Pruebas chat»): necesita ANTHROPIC_API_KEY. PW_MODULO como en prueba-web.mjs.
// ESFUERZOS=medium,low  ESCENAS=martes,paron  TOPE_USD=0.4
import { writeFileSync } from 'node:fs';
import { pagina, cerrar } from './banco.mjs';
const W = await import('../../worker/src/index.js');
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.log('Falta ANTHROPIC_API_KEY'); process.exit(1); }
const MODELO = process.env.MODELO || 'claude-haiku-5-5';
const ESFUERZOS = (process.env.ESFUERZOS || 'medium').split(',').map((x) => x.trim()).filter(Boolean);
const ESCENAS = (process.env.ESCENAS || 'martes').split(',').map((x) => x.trim()).filter(Boolean);
const TOPE = Number(process.env.TOPE_USD || 0.4) * 1e6;

// {R2}: el mánager del 2º; {E2}: su equipo; {R5}/{E5}: el 5º; {MIO}: mi jugador más caro; {SUYO}: el más caro del 2º
// sigue: la pregunta va detrás de la anterior, con su respuesta de verdad en la conversación
const CASOS = [
  { id: 'venta-rival', q: '¿Qué tiene {R2} a la venta?' },
  { id: 'plantilla-rival', sigue: true, q: 'Pero no solo lo que tiene en venta, mírame toda su plantilla. ¿Qué le puedo quitar?' },
  { id: 'por-equipo', q: '¿Qué jugadores interesantes tiene {E5}?' },
  { id: 'equipo-minusculas', q: 'y el del {e5} que jugadores tiene? de toda su plantilla' },
  { id: 'puedo-clausular', q: '¿Puedo clausular a {SUYO}?' },
  { id: 'que-hago-hoy', q: '¿Qué hago hoy?' },
  { id: 'vender-mio', q: '¿Vendo a {MIO}?' },
  { id: 'trato', q: '{R2} me ofrece 15 M por {MIO}. ¿Lo acepto?' },
  { id: 'quien-me-ataca', q: '¿Quién me puede clausular a alguien esta semana?' },
  { id: 'vago', q: 'Estoy perdido, ayúdame' },
  { id: 'mas-corto', sigue: true, q: 'Dímelo más corto' },
];

let gastado = 0;
const out = [`# El chat con ${MODELO} de verdad\n\n${new Date().toISOString()} · escenas ${ESCENAS.join(', ')} · esfuerzo ${ESFUERZOS.join(', ')}\n`];
const resumen = [];
for (const escena of ESCENAS) {
  const P = await pagina(escena);
  try {
    for (const esf of ESFUERZOS) {
      out.push(`\n## Escena «${escena}», esfuerzo ${esf}\n`);
      let hist = [];
      for (const caso of CASOS) {
        if (gastado > TOPE) { out.push('\n(Tope de gasto: paro aquí.)\n'); break; }
        if (!caso.sigue) hist = [];
        const prep = await P.page.evaluate(async ({ q, hist }) => {
          const I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js');
          const { D, M } = window.S;
          const rv = (n) => M.rivales.find((x) => x.e.pos === n) || M.rivales[Math.min(n - 1, M.rivales.length - 1)];
          const caro = (l) => [...l].sort((a, b) => (b.j.valor || 0) - (a.j.valor || 0))[0];
          const mio = caro(M.mias || []), suyo = caro((rv(2).fichas || []).filter((x) => x.j && x.j.pos !== 5));
          const pre = q.replace(/\{R2\}/g, rv(2).e.manager).replace(/\{E2\}/g, rv(2).e.nombre).replace(/\{R5\}/g, rv(5).e.manager).replace(/\{E5\}/g, rv(5).e.nombre).replace(/\{e5\}/g, rv(5).e.nombre.toLowerCase()).replace(/\{MIO\}/g, mio.j.nombre).replace(/\{SUYO\}/g, suyo.j.nombre);
          // la conversación como la guarda la app (con la pregunta de ahora la última)
          U.LS.set(Dt.K('chat'), [...hist, { r: 'yo', t: pre, ts: Date.now() }]);
          const h = I.conversacion();
          const cuerpo = I.pedidoChat(pre, D, M, Dt.cfg(), h, [], { rid: 'pruebahaiku01' });
          return { pre, cuerpo };
        }, { q: caso.q, hist });
        const armado = W.armarChat(prep.cuerpo);
        if (!armado) { out.push(`\n### ${caso.id}\n\n**MAL: el Worker no acepta el pedido.**\n`); continue; }
        const t0 = Date.now();
        let r = null, err = null;
        try { r = await W.llamarClaude({ CLAUDE_PLANES: KEY }, MODELO, armado.sistema, null, fetch, { mensajes: armado.mensajes, tokens: W.PREGUNTA_TOKENS, esfuerzo: esf }); } catch (e) { err = String(e.message || e); }
        const ms = Date.now() - t0;
        if (!r) { out.push(`\n### ${caso.id}: ${prep.pre}\n\n**ERROR** ${err} (${ms} ms)\n`); continue; }
        const coste = W.costeDe(r, MODELO);
        gastado += coste;
        const vista = await P.page.evaluate(async ({ texto, pre, hist }) => {
          const I = await import('./js/ia.js');
          const { D, M } = window.S;
          const sd = I.seudonimos(D);
          const t = sd.n ? sd.destapar(texto) : texto;
          const n = I.aplicarNotas(t, D, pre);
          let rev = { texto: n.texto, notas: [] };
          try { rev = I.revisarChat(n.texto, pre, D, M, { rec: n.recomiendo, hist }); } catch (e) { /* como en la app */ }
          return { texto: rev.texto, revisadas: rev.notas.length, apuntadas: n.apuntadas.map((x) => x.texto) };
        }, { texto: r.texto, pre: prep.pre, hist });
        const malas = [];
        if (/no (tengo|veo) (acceso|la plantilla|el listado)|p[áa]same (la lista|sus jugadores)|no puedo ver/i.test(vista.texto)) malas.push('dice que no ve datos');
        if (!vista.texto.trim()) malas.push('VACÍA');
        if (/\b(mi saldo|mi once|tengo de saldo|mi medio)\b/i.test(vista.texto)) malas.push('habla como si fuera el mánager');
        if (/funci[óo]n top/i.test(vista.texto)) malas.push('dice «función top»');
        if (/\b[PMTCAVB]-\d{2,6}\b|índice de sobrecoste|OPERACIONES POSIBLES|CUENTAS HECHAS|```|\bnotas\b\s*\{/i.test(vista.texto)) malas.push('restos internos');
        if (/Rival \d+|Equipo \d+/.test(vista.texto)) malas.push('alias sin destapar');
        if (/¡Claro!|Espero que te ayude|Aquí tienes|En resumen/i.test(vista.texto)) malas.push('frases de asistente');
        resumen.push({ escena, esf, id: caso.id, ms, coste, malas, car: vista.texto.length });
        out.push(`\n### ${caso.id}: «${prep.pre}»\n\n${ms} ms · ${r.entra} tokens de entrada (con caché) y ${r.sale} de salida · ${(coste / 1e4).toFixed(3)} céntimos${vista.revisadas ? ` · la app revisó ${vista.revisadas}` : ''}${malas.length ? ` · **MAL: ${malas.join(', ')}**` : ''}${vista.apuntadas.length ? ` · apuntó: ${vista.apuntadas.join(' | ')}` : ''}\n\n${vista.texto.split('\n').map((l) => `> ${l}`).join('\n')}\n`);
        hist = [...hist, { r: 'yo', t: prep.pre, ts: Date.now() }, { r: 'ia', t: vista.texto, ts: Date.now() }];
        console.log(`${malas.length ? 'MAL ' : 'BIEN'} ${escena}/${esf}/${caso.id} ${ms} ms ${(coste / 1e4).toFixed(3)} c${malas.length ? ` (${malas.join(', ')})` : ''}`);
      }
    }
  } finally { await P.cerrar(); }
}
await cerrar();
const media = (l) => (l.length ? Math.round(l.reduce((s, x) => s + x, 0) / l.length) : 0);
out.splice(1, 0, `\n**Resumen:** ${resumen.length} respuestas, ${resumen.filter((x) => x.malas.length).length} con fallos de forma; ${(gastado / 1e4).toFixed(2)} céntimos en total; tiempo medio ${media(resumen.map((x) => x.ms))} ms (${ESFUERZOS.map((e) => `${e}: ${media(resumen.filter((x) => x.esf === e).map((x) => x.ms))} ms`).join(', ')}); largo medio ${media(resumen.map((x) => x.car))} caracteres.\n`);
writeFileSync(new URL('./respuestas-chat.md', import.meta.url), out.join('\n'));
console.log(`Gastado: ${(gastado / 1e4).toFixed(2)} céntimos`);
