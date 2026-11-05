// Noticias de la competición (Carlos, 4 nov 13:01): lo que afecta a la jornada entera o a un partido de Primera, no a un jugador.
// Su ejemplo: tras la muerte de Jesús de Miguel se estudiaba suspender la jornada de Primera y Segunda de ese fin de semana.
// Cómo va (igual que tipos/noticias.mjs, con los mismos feeds de lib/prensa.mjs):
//   1. Las noticias nuevas de las últimas 30 h que hablan de suspender, aplazar, cambiar el horario o jugar a puerta cerrada.
//   2. Gemini las clasifica: qué pasa (suspensión, aplazamiento, horario, puerta cerrada), si está confirmado, se estudia o se
//      descarta, si toca a Primera, la jornada, los clubes y si hay un fallecimiento o una tragedia detrás. Escribe el contexto y
//      el detalle con palabras propias; lo que copia, trae cifras que no están en la noticia o nombra a un medio se tira.
//   3. Dos fuentes o una oficial, como las noticias de jugadores. «Se estudia» sale como tal, sin darlo por hecho, y cuando se
//      confirma o se descarta sale otro tweet. Lo que «se estudia» ya no sale si ya salió la decisión.
//   4. Con un fallecimiento o una tragedia detrás, tono sobrio: sin emojis de alarma ni líneas de fantasy.
// Solo Primera (Segunda no está en LaLiga Fantasy). Sin tarjeta. En el registro (público) no se guardan titulares.
import { corto, del, norm } from '../lib/texto.mjs';
import { tweet, cap } from '../lib/redactar.mjs';
import { lista as enLista } from '../lib/agrupar.mjs';
import { noticiasPrensaUnaVez } from '../lib/prensa.mjs';
import { preguntarJson } from '../lib/gemini.mjs';
import { frase, copia } from './noticias.mjs';

const HORA = 36e5;
const ahoraReal = () => Date.now();
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
// de qué tiene que hablar una noticia para preguntar a Gemini (estrecho a propósito: cada lote gasta una pregunta)
export const TEMA = /suspend|suspensi[oó]n|aplaz|puerta cerrada|sin p[uú]blico|(cambi\w*|nuevo|modifica\w*) (de |el )?horario|horario (nuevo|definitivo)|no se jugar[aá]|se jugar[aá] (el|a|sin)|huelga|paro de (los )?futbolistas|parar (el )?f[uú]tbol|sin f[uú]tbol (este|el) fin de semana|no habr[aá] f[uú]tbol/i;
const TIPOS = ['suspension', 'aplazamiento', 'horario', 'puertaCerrada', 'nada'];
const ESTADOS = ['se_estudia', 'confirmado', 'descartado'];
const GRANDES = ['COPE', 'Cadena SER', 'SPORT', 'Mundo Deportivo', 'AS', 'MARCA'];
const OFICIAL = /comunicado|oficial|ha anunciado|anuncia(do)? (laliga|la rfef|la federaci[oó]n|el csd)|(laliga|la rfef|la federaci[oó]n|el csd|el comit[eé]) (ha )?(decidido|confirmado|anunciado|comunicado)/i;

const ESQUEMA = { type: 'OBJECT', required: ['noticias'], properties: { noticias: { type: 'ARRAY', items: { type: 'OBJECT',
  required: ['i', 'tipo', 'estado', 'primera', 'segunda', 'jornada', 'equipos', 'luto', 'oficial', 'contexto', 'detalle'],
  properties: { i: { type: 'INTEGER' }, tipo: { type: 'STRING', enum: TIPOS }, estado: { type: 'STRING', enum: ESTADOS }, primera: { type: 'BOOLEAN' },
    segunda: { type: 'BOOLEAN' }, jornada: { type: 'INTEGER' }, equipos: { type: 'ARRAY', items: { type: 'STRING' } }, luto: { type: 'BOOLEAN' },
    oficial: { type: 'BOOLEAN' }, contexto: { type: 'STRING' }, detalle: { type: 'STRING' } } } } } };

export function prompt(lote, equipos) {
  return `Eres redactor de una cuenta de LaLiga Fantasy. Te paso noticias de prensa (titular y entradilla). Para cada una di si cuenta una NOVEDAD sobre la celebración de la jornada o de un partido de LaLiga de Primera división:
- "tipo": "suspension" (se suspende la jornada o un partido), "aplazamiento" (se aplaza a otra fecha), "horario" (cambia la fecha o la hora de un partido), "puertaCerrada" (se juega sin público) o "nada" (cualquier otra cosa: partidos de otras competiciones, Champions, Copa, selección, fútbol femenino, crónicas, opiniones, sanciones a jugadores, rumores sin fuente).
- "estado": "se_estudia" si se está valorando o se decidirá más adelante, "confirmado" si ya está decidido, "descartado" si se ha decidido que NO (por ejemplo, la jornada se jugará).
- "primera": true si afecta a Primera división; "segunda": true si afecta también a Segunda.
- "jornada": el número de la jornada si la noticia lo dice con cifra; si no, 0.
- "equipos": si la noticia es de un partido concreto (y no de la jornada entera, aunque nombre algún partido), los dos clubes de Primera, con su nombre corto (por ejemplo ${Object.values(equipos).slice(0, 3).map((e) => `"${corto(e)}"`).join(', ')}); si es la jornada entera, lista vacía.
- "luto": true si detrás hay un fallecimiento, un accidente o una tragedia.
- "oficial": true solo si lo ha anunciado LaLiga, la RFEF, el CSD o el club (comunicado), no si son fuentes o informaciones del medio.
- "contexto": por qué, en una frase corta tuya (como mucho 100 caracteres), sin copiar la noticia, sin nombrar al medio y sin cifras que no estén en ella. Por ejemplo: "Tras el fallecimiento de X". Vacío si no lo dice.
- "detalle": lo siguiente que se sabe (quién lo decide y cuándo, la nueva fecha u hora), en una frase corta tuya con las mismas reglas. Vacío si no lo dice.
Nada de opiniones, adjetivos ni la palabra fantasy. Contesta solo con el JSON.

${lote.map((x, i) => `[${i}] ${x.titulo}\n${x.entradilla}`).join('\n\n')}`;
}

/** los ids de los clubes de Primera que nombra Gemini («Barcelona», «Atlético de Madrid», «Sevilla FC»…) */
export function clubesDe(nombres, equipos) {
  const ids = [];
  for (const n of nombres || []) {
    const k = norm(n);
    if (k.length < 4) continue;
    const id = Object.keys(equipos).find((t) => { const a = norm(corto(equipos[t])), b = norm(equipos[t]); return a === k || b === k || (k.length >= 5 && (b.includes(k) || k.includes(a))); });
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
/** de qué se habla: la jornada (de Primera, o de Primera y Segunda) o un partido; y la clave para juntar noticias de lo mismo */
export function objeto(h, equipos) {
  if (h.clubes.length === 2) { const [a, b] = h.clubes.map((id) => corto(equipos[id])); return { texto: `el ${a}-${b}`, clave: `p${[...h.clubes].sort().join('-')}` }; }
  if (h.clubes.length === 1) return { texto: `el partido ${del(corto(equipos[h.clubes[0]]))}`, clave: `c${h.clubes[0]}` };
  // la jornada entera: una sola clave (dos medios pueden decir «la jornada 12» y «este fin de semana»); el número, si alguno lo da
  const j = h.jornada ? `la jornada ${h.jornada}` : 'la próxima jornada';
  return { texto: `${j} de ${h.segunda ? 'Primera y Segunda' : 'LaLiga'}`, clave: 'j' };
}

/** lee la prensa, pregunta a Gemini por lo nuevo y guarda los hechos en el registro (datos.liga) */
async function actualizar({ equipos, registro, ahora, config, log, leer, pedirIA, clave }) {
  const datos = (registro && registro.datos) || {};
  const lg = (datos.liga ||= { vistas: {}, hechos: [], gemini: { dia: '', n: 0 } });
  for (const [g, t] of Object.entries(lg.vistas)) if (ahora - t > 72 * HORA) delete lg.vistas[g];
  lg.hechos = lg.hechos.filter((h) => ahora - h.t < 72 * HORA);
  if (!clave) { log('  (liga) sin GEMINI_API_KEY: no leo la prensa'); return lg; }
  const nuevas = [];
  for (const n of await leer({ log })) {
    if (lg.vistas[n.guid]) continue;
    const t = n.t || ahora;
    if (ahora - t > 30 * HORA || t - ahora > HORA) continue;
    if (TEMA.test(`${n.titulo} ${n.entradilla}`)) nuevas.push({ ...n, t });
  }
  log(`  (liga) ${nuevas.length} noticias nuevas sobre suspensiones, aplazamientos u horarios`);
  if (!nuevas.length) return lg;
  const hoy = diaMadrid(ahora);
  if (lg.gemini.dia !== hoy) lg.gemini = { dia: hoy, n: 0 };
  if (lg.gemini.n >= (config.ligaGeminiDia ?? 20)) { log(`  (liga) tope de ${config.ligaGeminiDia ?? 20} preguntas a Gemini hoy`); return lg; }
  // las más recientes primero (una historia viva trae muchas; las viejas ya no cambian nada)
  const lote = nuevas.sort((a, b) => b.t - a.t).slice(0, config.ligaPorLote ?? 30);
  lg.gemini.n++;
  const hasta = ahoraReal() + (config.ligaSegundos ?? 45) * 1000;
  const r = await pedirIA({ clave, prompt: prompt(lote, equipos), esquema: ESQUEMA, log, hasta });
  if (!r.ok) { log(`  (liga) Gemini no contesta: ${r.error}. Lo vuelvo a intentar en la próxima ejecución`); return lg; }
  log(`  (liga) Gemini (${r.modelo}) ha leído ${lote.length}`);
  for (const x of lote) lg.vistas[x.guid] = x.t;
  for (const a of (r.datos && r.datos.noticias) || []) {
    const x = lote[a.i];
    if (!x || !TIPOS.includes(a.tipo) || a.tipo === 'nada' || !ESTADOS.includes(a.estado) || !a.primera) continue;
    const fuente = `${x.titulo} ${x.entradilla}`;
    const nums = [...new Set((fuente.match(/\d+/g) || []).map(Number))].slice(0, 30);
    // aplazar o suspender la jornada entera es lo mismo para quien juega: un solo tema
    const tipo = a.tipo === 'aplazamiento' && !(a.equipos && a.equipos.length) ? 'suspension' : a.tipo;
    const h = { guid: x.guid, medio: x.medio, t: x.t, tipo, estado: a.estado, segunda: !!a.segunda,
      jornada: a.jornada > 0 && a.jornada <= 38 && nums.includes(a.jornada) ? a.jornada : 0, clubes: clubesDe(a.equipos, equipos).slice(0, 2),
      luto: !!a.luto, oficial: !!a.oficial && OFICIAL.test(fuente),
      contexto: frase(a.contexto, { fuente, max: 100 }), detalle: frase(a.detalle, { fuente, max: 100 }), nums };
    // un partido de un solo club no se entiende sin el rival; mejor esperar a otra noticia que lo diga
    if (a.equipos && a.equipos.length === 2 && h.clubes.length < 2) { log(`  (liga) ${x.medio}: ${a.tipo} de un partido sin casar los dos clubes`); continue; }
    log(`  (liga) ${x.medio}: ${a.tipo} · ${a.estado}${h.oficial ? ' (oficial)' : ''}${h.luto ? ' (luto)' : ''}`);
    lg.hechos.push(h);
  }
  return lg;
}

/** el tweet de un tema (lo de un partido o una jornada) y un estado */
export function redactar({ tipo, estado, obj, luto, contexto, detalle, medios, oficial }) {
  const O = cap(obj), deO = obj.replace(/^el /, 'del ').replace(/^(?!del )/, 'de ');
  const alarma = luto ? '📢' : estado === 'confirmado' ? '🚨' : '⚠️';
  const cab = estado === 'descartado'
    ? { suspension: `✅ ${O} se jugará`, aplazamiento: `✅ ${O} no se aplaza`, horario: `✅ ${O} mantiene su horario`, puertaCerrada: `✅ ${O} se jugará con público` }[tipo]
    : estado === 'se_estudia'
      ? { suspension: `${alarma} Se estudia suspender ${obj}`, aplazamiento: `${alarma} Se estudia aplazar ${obj}`, horario: `${alarma} Puede cambiar el horario ${deO}`, puertaCerrada: `${alarma} Se estudia jugar ${obj} a puerta cerrada` }[tipo]
      : { suspension: `${alarma} Se suspende ${obj}`, aplazamiento: `${alarma} Se aplaza ${obj}`, horario: `🕐 Cambia el horario ${deO}`, puertaCerrada: `${alarma} ${O} se jugará a puerta cerrada` }[tipo];
  const lis = medios.length <= 3 ? enLista(medios) : `${medios.slice(0, 2).join(', ')} y otros medios`;
  const fuente = oficial ? `Es oficial, según ${lis}` : `Lo cuentan ${lis}`;
  const lectura = luto ? null : estado === 'se_estudia' ? '👀 Pendientes de la decisión oficial'
    : estado === 'confirmado' && (tipo === 'suspension' || tipo === 'aplazamiento') ? '👀 Atentos a cómo lo aplica LaLiga Fantasy' : null;
  // el contexto o el detalle que repiten la cabecera («Se aplaza el partido por…» bajo «Se aplaza el Sevilla-Alavés»), fuera
  if (contexto && copia(contexto, cab, 3)) contexto = '';
  if (detalle && copia(detalle, cab, 3)) detalle = '';
  return tweet(cab, [contexto ? { t: luto ? cap(contexto) : `⚠️ ${cap(contexto)}`, prio: 8 } : null,
    detalle ? { t: `🗓️ ${cap(detalle)}`, prio: 7 } : null, { t: fuente, prio: 6 }, lectura ? { t: lectura, prio: 5 } : null]).texto;
}

export async function generar({ equipos, jornada, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(),
  log = console.log, leer = noticiasPrensaUnaVez, pedirIA = preguntarJson, clave = process.env.GEMINI_API_KEY }) {
  const [hD, hH] = config.horasLiga || [8, 24];
  if (ventanas && !forzar && (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH)) return [];
  if (ventanas && !(registro && registro.fichero)) { log('  (liga) sin registro guardado: no pregunto a Gemini'); return []; }
  const lg = await actualizar({ equipos, registro, ahora, config, log, leer, pedirIA, clave });
  if (registro) registro.guardar();
  // lo publicado en los últimos 5 días (la clave lleva la jornada: una suspensión de otra semana es otra noticia)
  const hechas = registro && registro.todos ? registro.todos().filter((e) => !e.t || ahora - Date.parse(e.t) < 5 * 24 * HORA || ahora < Date.parse(e.t)).map((e) => e.clave) : [];
  // juntar por tema (tipo + de qué se habla) y estado
  const grupos = new Map();
  for (const h of lg.hechos) {
    if (ahora - h.t > 36 * HORA) continue;
    const o = objeto(h, equipos);
    const tema = `${h.tipo}|${o.clave}`;
    const k = `${tema}|${h.estado}`;
    if (!grupos.has(k)) grupos.set(k, { tema, estado: h.estado, tipo: h.tipo, obj: o.texto, hs: [] });
    const g = grupos.get(k);
    g.hs.push(h);
    // de la jornada entera, el texto con el número y con «Primera y Segunda» si alguno lo dice
    if (o.clave === 'j') g.obj = objeto({ clubes: [], jornada: Math.max(...g.hs.map((x) => x.jornada || 0)), segunda: g.hs.some((x) => x.segunda) }, equipos).texto;
  }
  const out = [];
  // lo decidido antes que lo que se estudia
  const orden = [...grupos.values()].sort((a, b) => (a.estado === 'se_estudia') - (b.estado === 'se_estudia') || b.hs.length - a.hs.length);
  for (const g of orden) {
    if (out.length >= (config.ligaPorEjecucion ?? 1)) break;
    const clave = `liga|${g.tema}|${g.estado}|J${jornada}`;
    if (hechas.includes(clave)) continue;
    // lo que se estudia ya no es noticia si ya salió (o sale ahora) la decisión
    if (g.estado === 'se_estudia' && (hechas.some((c) => c.startsWith(`liga|${g.tema}|`)) || grupos.has(`${g.tema}|confirmado`) || grupos.has(`${g.tema}|descartado`))) continue;
    const hs = g.hs.sort((a, b) => a.t - b.t);
    // una historia que sigue viva vale mientras haya noticias recientes: manda la última
    if (ahora - hs[hs.length - 1].t > 12 * HORA) { log(`  (liga) ${g.tema} (${g.estado}): la última noticia es de hace más de 12 h`); continue; }
    const medios = [...new Set(hs.map((h) => h.medio))].sort((a, b) => GRANDES.indexOf(b) - GRANDES.indexOf(a));
    const oficial = hs.some((h) => h.oficial);
    if (!oficial && medios.length < 2) { log(`  (liga) ${g.tema} (${g.estado}): solo ${medios.join(', ')}, espero a una segunda fuente`); continue; }
    const mejor = (k) => (hs.filter((h) => h[k]).sort((a, b) => b[k].length - a[k].length)[0] || {})[k] || '';
    const luto = hs.some((h) => h.luto);
    const texto = redactar({ tipo: g.tipo, estado: g.estado, obj: g.obj, luto, contexto: mejor('contexto'), detalle: mejor('detalle'), medios, oficial });
    const jn = hs.find((h) => h.jornada) ? hs.find((h) => h.jornada).jornada : null;
    // jornadaAire: la jornada de la que habla la noticia, si la dice (lib/aire.mjs apunta con ella las fechas de sus partidos)
    out.push({ tipo: 'liga', clave, jornada, jornadaAire: jn, texto, numeros: [...new Set([jornada, ...(jn ? [jn] : []), ...hs.flatMap((h) => h.nums || [])])], tarjeta: null });
  }
  return out;
}
