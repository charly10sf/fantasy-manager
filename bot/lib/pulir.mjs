// Gemini pule los textos de las plantillas (Carlos, 3 nov 17:52: «hazlo aquí», tras ofrecerle que la IA reescribiera final,
// caídas, novedades y previa para que suenen más humanos). Gemini solo cambia la forma: cada tweet pulido se compara con el de
// la plantilla y, si cambia algo de lo que cuenta, se queda el de la plantilla. Se exige:
//   - las mismas cifras (ni una más ni una menos) y el validador de siempre (280, «fantasy», sin enlaces, cifras de los datos);
//   - los mismos jugadores y equipos: ninguno nuevo y ninguno perdido (se buscan los de LaLiga en los dos textos);
//   - ninguna palabra con mayúscula que no esté en la plantilla (salvo al principio de una línea);
//   - la misma última línea (la etiqueta «Baja Fantasy…» o el cierre «Fantasy Manager · enlace en la bio»);
//   - solo emojis de la plantilla o de la guía de estilo, un emoji al principio de cada línea y nada de @, # ni primera persona.
// Una pregunta a Gemini por tipo y ejecución, con todos los tweets de ese tipo que van a salir. Tope diario propio (`pulir.porDia`).
import { norm, corto } from './texto.mjs';
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
  'empat', 'remont', 'victori', 'derrot', 'porteria', 'cero', 'sube', 'subid', 'baj', 'chollo', 'vend', 'compr', 'ficha', 'clausul'];
// sinónimos (segunda prueba: «se cae por lesión» → «baja por lesión» es lo mismo en un tweet de caídas)
const IGUAL = { cae: 'baja', caen: 'baja', cayo: 'baja', lesiona: 'lesion', regres: 'vuelv', reaparec: 'vuelv', recuper: 'vuelv' };
// y una lesión o una sanción ya dicen que es baja («Aspas se cae por lesión» = «Aspas, lesionado»)
const estado = (s) => {
  const e = new Set(norm(s).split(' ').map((w) => ESTADO.find((r) => w.startsWith(r))).filter(Boolean).map((r) => IGUAL[r] || r));
  if (e.has('lesion') || e.has('sancion')) e.delete('baja');
  return [...e].sort().join(' ');
};
/** las palabras con mayúscula que no van al principio de la línea (quitado el emoji) */
const mayusculas = (s) => {
  const out = new Set();
  for (const l of lineas(s)) {
    const ws = l.replace(EMOJI, ' ').replace(/[️‍]/g, '').split(/[^\p{L}.]+/u).filter(Boolean);
    ws.slice(1).forEach((w) => { if (/^\p{Lu}/u.test(w)) out.add(norm(w)); });
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
export function revisar(orig, nuevo, { numeros = [], max = 280, nombres = [] } = {}) {
  const e = [];
  const v = validar(nuevo, { numeros, max });
  if (!v.ok) e.push(...v.errores);
  if (cifras(orig).join(' ') !== cifras(nuevo).join(' ')) e.push(`cifras distintas (${cifras(orig).join(' ')} → ${cifras(nuevo).join(' ')})`);
  const lo = lineas(orig), ln = lineas(nuevo);
  // la etiqueta («Baja Fantasy…») o el cierre, igual letra por letra
  if (/fantasy/i.test(lo[lo.length - 1] || '') && lo[lo.length - 1] !== ln[ln.length - 1]) e.push('cambia la última línea');
  // línea a línea (3 nov, primera prueba: «cumple ciclo de sanción» sin que la plantilla dijera ciclo, y Foyth «baja» siendo duda):
  // mismas líneas, en el mismo orden, con el mismo emoji, las mismas cifras, los mismos nombres y las mismas palabras de estado
  if (ln.length !== lo.length) e.push(`líneas: ${lo.length} → ${ln.length}`);
  else for (let i = 0; i < lo.length; i++) {
    const a = lo[i], b = ln[i];
    if ((emojis(a)[0] || '') !== (emojis(b)[0] || '')) { e.push(`línea ${i + 1}: cambia el emoji`); continue; }
    if (cifras(a).join(' ') !== cifras(b).join(' ')) e.push(`línea ${i + 1}: cifras`);
    if (nombresEn(a, nombres).join('|') !== nombresEn(b, nombres).join('|')) e.push(`línea ${i + 1}: jugadores o equipos`);
    const ea = estado(a), eb = estado(b);
    if (ea !== eb) e.push(`línea ${i + 1}: estado «${ea}» → «${eb}»`);
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

export function prompt(textos) {
  return `Eres el redactor de una cuenta de X de LaLiga Fantasy. Te paso tweets escritos con plantilla. Reescríbelos para que suenen a periodista que sabe de fantasy y no a máquina, cambiando SOLO la forma.
Cómo se escribe en la cuenta:
- Frases cortas: sujeto, verbo y dato («Budimir marca y se va a 11 puntos», no «El mejor fantasy del partido, Budimir, con 11 puntos»).
- Una idea por línea, una línea en blanco entre ideas y el emoji solo al principio de la línea, nunca dentro de la frase. Deja el emoji que ya lleva cada línea.
- La segunda vez que sale un jugador, por su puesto («el delantero», «el central») solo si el texto ya lo dice; si no, por su nombre.
- Dudas con palabras («en principio», «todo apunta a que», «de momento»).
- Nada de tono de anuncio: sin «¡» en cada frase, sin adjetivos grandes, sin primera persona, sin «bot», sin @ ni #.
Reglas que no se pueden saltar:
- Las mismas cifras, ni una más ni una menos, escritas igual («5,5» sigue siendo «5,5»). Nada de cifras en letra.
- Los mismos jugadores y equipos, con el nombre escrito igual. Ni uno nuevo, ni uno menos.
- Las mismas líneas, en el mismo orden y cada una con su emoji: cambia las palabras DENTRO de cada línea, pero no muevas información de una línea a otra, no juntes líneas, no quites ninguna y no añadas ninguna.
- No cambies lo que se dice de nadie: si es duda, sigue siendo duda; si es baja, baja; si está sancionado, sancionado (sin decir por qué si no lo dice); si es titular habitual, lo sigue diciendo. Las fechas y plazos se quedan.
- No añadas datos, opiniones, motivos ni predicciones que no estén en el texto. Si una línea ya suena bien, déjala igual.
- Si la última línea lleva la palabra «Fantasy», se queda exactamente igual, letra por letra.
- Como mucho 260 caracteres por tweet y la palabra «fantasy» tiene que seguir en el texto.
Devuelve cada tweet con su i.
Tweets:
${JSON.stringify(textos.map((texto, i) => ({ i, texto })))}`;
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
  const r = await pedirIA({ clave, prompt: prompt(tweets.map((t) => t.texto)), esquema: ESQUEMA, log, hasta: Date.now() + (cfg.segundos ?? 45) * 1000 });
  if (registro && registro.fichero) registro.guardar();
  if (!r.ok) { log(`  (pulir) Gemini no contesta (${r.error}): ${tipo} sale con la plantilla`); return 0; }
  const nombres = nombresDe(jugadores, equipos);
  let cambiados = 0;
  for (const a of (r.datos && r.datos.tweets) || []) {
    const t = tweets[a.i];
    if (!t || typeof a.texto !== 'string') continue;
    const nuevo = a.texto.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (nuevo === t.texto) continue;
    const malos = revisar(t.texto, nuevo, { numeros: t.numeros, max: config.tweetMax ?? 280, nombres });
    if (malos.length) { cuenta.mal++; log(`  (pulir) ${t.clave}: me quedo la plantilla (${malos.slice(0, 3).join('; ')})`); continue; }
    t.plantilla = t.texto; t.texto = nuevo; t.pulido = r.modelo; cuenta.ok++; cambiados++;
  }
  log(`  (pulir) Gemini (${r.modelo}): ${cambiados} de ${tweets.length} tweets de ${tipo} pulidos`);
  if (registro && registro.fichero) registro.guardar();
  return cambiados;
}
