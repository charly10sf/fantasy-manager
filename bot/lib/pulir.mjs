// Gemini pule los textos de las plantillas (Carlos, 3 nov 17:52: «hazlo aquí», tras ofrecerle que la IA reescribiera final,
// caídas, novedades y previa para que suenen más humanos). Gemini solo cambia la forma: cada tweet pulido se compara con el de
// la plantilla y, si cambia algo de lo que cuenta, se queda el de la plantilla. Se exige:
//   - las mismas cifras (ni una más ni una menos) y el validador de siempre (280, «fantasy», sin enlaces, cifras de los datos);
//   - los mismos jugadores y equipos: ninguno nuevo y ninguno perdido (se buscan los de LaLiga en los dos textos);
//   - ninguna palabra con mayúscula que no esté en la plantilla (salvo al principio de una línea);
//   - la misma última línea (la etiqueta «❌ Baja para la jornada…» o el cierre «Fantasy Manager · enlace en la bio»);
//   - solo emojis de la plantilla o de la guía de estilo, un emoji al principio de cada línea y nada de @, # ni primera persona.
// Una pregunta a Gemini por tipo y ejecución, con todos los tweets de ese tipo que van a salir. Tope diario propio (`pulir.porDia`).
import { norm, corto, peso, limite, largo, esEtiquetaFinal } from './texto.mjs';
import { validar } from './validar.mjs';
import { preguntarJson } from './gemini.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
const CIFRAS = /\d+(?:[.,]\d+)?/g;
const EMOJI = /\p{Extended_Pictographic}/gu;
// los emojis de la guía de estilo (claude/estilo-tweets.md) y los que ya usan las plantillas
const EMOJIS_GUIA = new Set([...'🚨⚠‼👀⁉✅❌🗣🗞🗓⭐📊🔥🏁⚽🟥🟨📈📉💸🔄ℹ💔🤕🚑🥇🥈🥉'.matchAll(EMOJI)].map((m) => m[0]));
const PROHIBIDO = /@|#|https?:|www\.|\b(mi|mis|nuestro|nuestra|nosotros|bot|brutal|espectacular|incre[ií]ble|no te lo pierdas)\b/i;

const cifras = (s) => [...new Set(String(s).replace(/[0-9#*]️?⃣/g, '').match(CIFRAS) || [])].sort();
const lineas = (s) => String(s).split('\n').map((l) => l.trim()).filter(Boolean);
const emojis = (s) => [...String(s).matchAll(EMOJI)].map((m) => m[0]);
// las palabras que cambian lo que se cuenta de un jugador o un partido: cada línea pulida tiene que llevar las mismas (por raíz)
const ESTADO = ['cae', 'caen', 'cayo', 'lesion', 'lesiona', 'sancion', 'baja', 'duda', 'molesti', 'vuelv', 'regres', 'recuper', 'reaparec', 'disponib', 'alta', 'titular',
  'suplent', 'banquillo', 'descart', 'convoca', 'rotaci', 'descans', 'habitual', 'roja', 'amarill', 'ciclo', 'expuls', 'gol', 'doblete', 'hat',
  'penalti', 'asist', 'rotura', 'operad', 'quirof', 'semana', 'mes', 'dia', 'hasta', 'seguro', 'mejor', 'peor', 'mvp',
  'empat', 'remont', 'victori', 'derrot', 'porteria', 'cero', 'sube', 'subid', 'baj', 'chollo', 'vend', 'compr', 'ficha', 'clausul', 'volv'];
// sinónimos (segunda prueba: «se cae por lesión» → «baja por lesión» es lo mismo en un tweet de caídas)
// palabras «suaves»: se pueden quitar al reescribir (no añadir). En la previa, «apunta a titular» o «sale seguro» se pueden decir de
// otra forma; en el resto, «titular» cuenta (un «se queda sin dos titulares» no puede perderlo: prueba/pulir-ejemplo.mjs)
const SUAVES_DE = { previa: ['titular', 'seguro', 'habitual', 'mejor', 'peor'] };
const SUAVES_BASE = ['seguro'];
const IGUAL = { cae: 'baja', caen: 'baja', cayo: 'baja', lesiona: 'lesion', regres: 'vuelv', reaparec: 'vuelv', recuper: 'vuelv', volv: 'vuelv' };
// y una lesión o una sanción ya dicen que es baja («Aspas se cae por lesión» = «Aspas, lesionado»)
const estado = (s) => {
  const e = new Set(norm(s).split(' ').map((w) => ESTADO.find((r) => w.startsWith(r))).filter(Boolean).map((r) => IGUAL[r] || r));
  if (e.has('lesion') || e.has('sancion')) e.delete('baja');
  return [...e].sort().join(' ');
};
/** las palabras con mayúscula que no van al principio de una frase (quitado el emoji). Desde el texto corrido (4 nov), una línea
    lleva varias frases: la primera palabra de cada una («Su media…», «Tarde…») no cuenta como nombre nuevo */
// las palabras corrientes con las que puede empezar una frase sin ser un nombre (auditoría del 5 nov: si no se mira la primera palabra,
// Gemini podía colar «Corberán no lo duda.»); una primera palabra que no esté aquí ni en la plantilla cuenta como nueva
const ARRANQUES = new Set(('el la los las lo un una unos unas en con sin pero y e o hay por para ya hoy ojo aunque tambien ademas detras despues '
  + 'al del se su sus no si que quien a de otra otro nadie todo todos esta este eso esto mientras tras sale salen juega juegan vuelve vuelven '
  + 'llega llegan cae caen sigue siguen tampoco solo nada mas menos le les lleva suma suman saca sacan va van es son era fue tiene tienen '
  + 'segun cuidado atentos alerta asi entre sobre desde hasta cuando donde como muy bien mal menudo vaya gran buena buen mala mal noche tarde '
  + 'dia partido jornada media puntos baja bajas duda dudas lesion vuelta vuelve nueva nuevo primera primero segunda segundo mejor peor ahi alli '
  // (auditoría del 5 nov: tumbaba 7 de 13 reescrituras buenas por empezar frase con «Encima», «Ahora», «Ambos», «Luego», «Pese»…)
  + 'ahora luego encima ambos ambas pese gana ganan pierde pierden marca marcan firma firman estara estaran queda quedan falta faltan cada '
  + 'ni incluso apenas casi antes ayer manana pronto nunca siempre todavia aun igual otros otras uno una dos tres cuatro cinco seis ningun '
  + 'ninguno ninguna algo alguno alguna habra sera seran podria puede pueden deberia debe parece pinta seguro vale cuesta sube suben baja '
  + 'bajan entra entran mucho mucha muchos pocos poco final empate victoria derrota goleada remontada gol goles titular titulares suplente '
  + 'banquillo once mercado precio valor racha y lo').split(' '));
const mayusculas = (s) => {
  const out = new Set();
  for (const l of lineas(s)) {
    for (const frase of l.replace(EMOJI, ' ').replace(/[️‍]/g, '').split(/(?<=[.!?:])\s+|[¿¡]/u)) {
      const ws = frase.split(/[^\p{L}.]+/u).filter(Boolean);
      ws.forEach((w, i) => { if (/^\p{Lu}/u.test(w) && (i > 0 || !ARRANQUES.has(norm(w)))) out.add(norm(w)); });
    }
  }
  return out;
};

/** los nombres de jugadores y equipos de LaLiga que salen en un texto (por apodo o nombre corto de equipo, palabra entera) */
export function nombresEn(texto, nombres) {
  const t = ` ${norm(texto)} `;
  return nombres.filter((n) => n.length >= 3 && t.includes(` ${n} `));
}
export function nombresDe(jugadores = [], equipos = {}) {
  const s = new Set();
  for (const j of jugadores) { const a = norm(j.nickname); if (a.split(' ').some((w) => w.length >= 3)) s.add(a); }
  for (const n of Object.values(equipos)) { s.add(norm(n)); s.add(norm(corto(n))); }
  return [...s].filter((x) => x.length >= 3);
}

/** ¿vale el texto pulido? [] si sí; si no, los motivos */
export function revisar(orig, nuevo, { numeros = [], max = limite(), nombres = [], tipo = '' } = {}) {
  const e = [];
  const SUAVES = new Set(SUAVES_DE[tipo] || SUAVES_BASE);
  const v = validar(nuevo, { numeros, max });
  if (!v.ok) e.push(...v.errores);
  if (cifras(orig).join(' ') !== cifras(nuevo).join(' ')) e.push(`cifras distintas (${cifras(orig).join(' ')} → ${cifras(nuevo).join(' ')})`);
  const lo = lineas(orig), ln = lineas(nuevo);
  // la etiqueta («❌ Baja para la jornada 12…») o el cierre («Fantasy Manager · enlace en la bio»), igual letra por letra
  const ult = lo[lo.length - 1] || '';
  if ((/fantasy/i.test(ult) || esEtiquetaFinal(ult)) && ult !== ln[ln.length - 1]) e.push('cambia la última línea');
  // línea a línea (3 nov, primera prueba: «cumple ciclo de sanción» sin que la plantilla dijera ciclo, y Foyth «baja» siendo duda):
  // mismas líneas, en el mismo orden, con el mismo emoji, las mismas cifras, los mismos nombres y las mismas palabras de estado
  if (ln.length !== lo.length) e.push(`líneas: ${lo.length} → ${ln.length}`);
  else for (let i = 0; i < lo.length; i++) {
    const a = lo[i], b = ln[i];
    if ((emojis(a)[0] || '') !== (emojis(b)[0] || '')) { e.push(`línea ${i + 1}: cambia el emoji`); continue; }
    if (cifras(a).join(' ') !== cifras(b).join(' ')) e.push(`línea ${i + 1}: cifras`);
    if (nombresEn(a, nombres).join('|') !== nombresEn(b, nombres).join('|')) e.push(`línea ${i + 1}: jugadores o equipos`);
    // las palabras «suaves» (titular, seguro, habitual, mejor, peor) se pueden quitar al reescribir, pero no añadir; el resto, iguales
    const ea = estado(a), eb = estado(b);
    const duras = (x) => x.split(' ').filter((w) => w && !SUAVES.has(w)).join(' '), suaves = (x) => x.split(' ').filter((w) => SUAVES.has(w));
    if (duras(ea) !== duras(eb) || suaves(eb).some((w) => !suaves(ea).includes(w))) e.push(`línea ${i + 1}: estado «${ea}» → «${eb}»`);
  }
  const no = nombresEn(orig, nombres), nn = nombresEn(nuevo, nombres);
  const faltan = no.filter((x) => !nn.includes(x)), sobran = nn.filter((x) => !no.includes(x));
  if (faltan.length) e.push(`pierde ${faltan.join(', ')}`);
  if (sobran.length) e.push(`añade ${sobran.join(', ')}`);
  const base = ` ${norm(orig)} `;
  const nuevas = [...mayusculas(nuevo)].filter((w) => w && !base.includes(` ${w} `));
  if (nuevas.length) e.push(`palabras nuevas con mayúscula: ${nuevas.join(', ')}`);
  const eo = new Set(emojis(orig));
  const raros = emojis(nuevo).filter((x) => !eo.has(x) && !EMOJIS_GUIA.has(x));
  if (raros.length) e.push(`emojis nuevos: ${raros.join(' ')}`);
  // un emoji dentro de la frase (no al principio): solo si la plantilla ya tenía tantos («🥈 Raphinha 15 · 🥉 Rodri 11»)
  const dentro = (ls) => ls.filter((l) => /\p{Extended_Pictographic}/u.test(l.replace(/^(\p{Extended_Pictographic}[\uFE0F\u200D]*)+/u, ''))).length;
  if (dentro(ln) > dentro(lo)) e.push('emoji dentro de la frase');
  if (PROHIBIDO.test(nuevo.replace(/#LaLigaFantasy/g, '')) && !PROHIBIDO.test(orig.replace(/#LaLigaFantasy/g, ''))) e.push('@, #, enlace, primera persona o adjetivo de anuncio');
  if (/#LaLigaFantasy/.test(orig) !== /#LaLigaFantasy/.test(nuevo)) e.push('cambia el hashtag');
  return [...new Set(e)];
}

const ESQUEMA = { type: 'OBJECT', required: ['tweets'], properties: { tweets: { type: 'ARRAY', items: { type: 'OBJECT', required: ['i', 'texto'],
  properties: { i: { type: 'INTEGER' }, texto: { type: 'STRING' } } } } } };

// el largo que se le deja a cada tweet: el suyo y un poco más, sin pasar de 270 (el validador corta en 280; el 4 nov
// el de apercibidos salió con 281 cuando el prompt decía «260» para todos). Con X Premium (tweets largos), un 20 % más
// (30 como poco) para que pueda unir frases con «y», «pero» o «aunque», sin pasar del límite largo.
export const maxDe = (texto) => (largo()
  ? Math.min(limite() - 20, peso(texto) + Math.max(30, Math.round(peso(texto) * 0.2)))
  : Math.min(270, peso(texto) + 10));

export function prompt(textos) {
  return `Eres el redactor de una cuenta de X de LaLiga Fantasy. Te paso tweets escritos con plantilla. Reescríbelos para que suenen a periodista que sabe de fantasy y no a máquina, cambiando SOLO la forma.
Cómo se escribe en la cuenta:
- Frases cortas: sujeto, verbo y dato («Budimir marca y se va a 11 puntos», no «El mejor fantasy del partido, Budimir, con 11 puntos»).
- Texto corrido, como lo escribiría una persona: dentro de cada párrafo puedes unir frases con «y», «pero», «aunque» o una coma, y quitar repeticiones. Deja el emoji que ya lleva el principio de cada párrafo y no pongas más.
- La segunda vez que sale un jugador, por su puesto («el delantero», «el central») solo si el texto ya lo dice; si no, por su nombre.
- Dudas con palabras («en principio», «todo apunta a que», «de momento»).
- Que no se note que es automático: si dos párrafos o dos frases tienen el mismo esqueleto y solo cambian los nombres, dale otra forma a uno (otro orden, otro verbo, otra entrada). No repitas la misma muletilla dentro del tweet.
- Nada de tono de anuncio: sin «¡» en cada frase, sin adjetivos grandes, sin primera persona, sin «bot», sin @ ni #.
Reglas que no se pueden saltar:
- Las mismas cifras, ni una más ni una menos, escritas igual («5,5» sigue siendo «5,5»). Nada de cifras en letra.
- Los mismos jugadores y equipos, con el nombre escrito igual. Ni uno nuevo, ni uno menos.
- Los mismos párrafos (separados por una línea en blanco), en el mismo orden y con el mismo emoji al principio: cambia las palabras DENTRO de cada párrafo, pero no muevas información de un párrafo a otro, no juntes párrafos, no quites ninguno y no añadas ninguno.
- No cambies lo que se dice de nadie: si es duda, sigue siendo duda; si es baja, baja; si está sancionado, sancionado (sin decir por qué si no lo dice); si es titular habitual, lo sigue diciendo. Las fechas y plazos se quedan.
- No añadas datos, opiniones, motivos ni predicciones que no estén en el texto. Si una línea ya suena bien, déjala igual.
- Si el último párrafo es la etiqueta («❌ Baja para la jornada…», «✅ Disponible para la jornada…», «💸 Venta obligatoria») o lleva la palabra «Fantasy», se queda exactamente igual, letra por letra: no le añadas «Fantasy» ni nada.
- El párrafo que dice de dónde sale la noticia («Lo cuentan…», «Según…») se queda aparte y tal cual, aunque te pida el cuerpo unirlo.
${largo() ? '- Cada tweet trae su «max»: como mucho esos caracteres, contando cada emoji como 2. Puedes usar unas palabras más que la plantilla para que se lea como lo contaría una persona (unir frases, quitar la lista), pero sin datos nuevos y sin relleno: si sobra espacio, no hace falta gastarlo.' : '- Cada tweet trae su «max»: como mucho esos caracteres, contando cada emoji como 2. Si no cabe, quita palabras; nunca lo alargues.'}
Devuelve cada tweet con su i.
Tweets:
${JSON.stringify(textos.map((texto, i) => ({ i, max: maxDe(texto), texto })))}`;
}

/**
 * Pule en el sitio los tweets que se le pasan (t.texto); deja t.plantilla con el original si lo cambia.
 * Devuelve cuántos ha cambiado. Sin clave, fuera de los tipos de config.pulir o con el tope del día gastado, no hace nada.
 */
export async function pulir(tweets, { tipo, registro = null, config = {}, jugadores = [], equipos = {}, log = console.log,
  clave = process.env.GEMINI_API_KEY, pedirIA = preguntarJson, ahora = Date.now(), forzar = false } = {}) {
  const cfg = config.pulir || {};
  if (!tweets.length || !(cfg.tipos || []).includes(tipo)) return 0;
  if (!clave) { log(`  (pulir) sin GEMINI_API_KEY: ${tipo} sale con la plantilla`); return 0; }
  // sin registro guardado (el simulacro del cron) no se gasta cupo, salvo que se fuerce
  if (!forzar && !(registro && registro.fichero)) return 0;
  const datos = (registro && registro.datos) || {};
  const hoy = diaMadrid(ahora);
  const cuenta = (datos.pulido && datos.pulido.dia === hoy) ? datos.pulido : (datos.pulido = { dia: hoy, n: 0, ok: 0, mal: 0 });
  if (cuenta.n >= (cfg.porDia ?? 40)) { log(`  (pulir) tope de ${cfg.porDia ?? 40} preguntas a Gemini hoy: ${tipo} sale con la plantilla`); return 0; }
  cuenta.n++;
  const r = await pedirIA({ clave, prompt: prompt(tweets.map((t) => t.texto)), esquema: ESQUEMA, log, tiempo: 15000, hasta: Date.now() + (cfg.segundos ?? 45) * 1000 });
  if (registro && registro.fichero) registro.guardar();
  if (!r.ok) { log(`  (pulir) Gemini no contesta (${r.error}): ${tipo} sale con la plantilla`); return 0; }
  const nombres = nombresDe(jugadores, equipos);
  let cambiados = 0;
  for (const a of (r.datos && r.datos.tweets) || []) {
    const t = tweets[a.i];
    if (!t || typeof a.texto !== 'string') continue;
    const nuevo = a.texto.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (nuevo === t.texto) continue;
    const malos = revisar(t.texto, nuevo, { numeros: t.numeros, max: limite(), nombres, tipo });
    if (malos.length) { cuenta.mal++; log(`  (pulir) ${t.clave}: me quedo la plantilla (${malos.slice(0, 3).join('; ')})`); continue; }
    t.plantilla = t.texto; t.texto = nuevo; t.pulido = r.modelo; cuenta.ok++; cambiados++;
  }
  log(`  (pulir) Gemini (${r.modelo}): ${cambiados} de ${tweets.length} tweets de ${tipo} pulidos`);
  if (registro && registro.fichero) registro.guardar();
  return cambiados;
}
