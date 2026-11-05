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
import { statsSemana } from '../lib/laliga.mjs';
import { tweet, cap } from '../lib/redactar.mjs';
import { lista as enLista } from '../lib/agrupar.mjs';
import { noticiasPrensaUnaVez } from '../lib/prensa.mjs';
import { preguntarJson } from '../lib/gemini.mjs';
import { frase, copia } from './noticias.mjs';

const HORA = 36e5;
const ahoraReal = () => Date.now();
import { horaMadrid, horas } from '../lib/horario.mjs';   // entre semana, desde las 7 (lib/horario.mjs)
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
// de qué tiene que hablar una noticia para preguntar a Gemini (estrecho a propósito: cada lote gasta una pregunta)
export const TEMA = /suspend|suspensi[oó]n|aplaz|par(a|an|ar) (la )?competici[oó]n|no habr[aá] partidos|habr[aá] f[uú]tbol|mant(iene|ener|ienen) la (jornada|competici[oó]n)|puerta cerrada|sin p[uú]blico|(cambi\w*|nuevo|modifica\w*) (de |el )?horario|horario (nuevo|definitivo)|no se jugar[aá]|se (jugar|disputar)[aá]n? (el|la|los|las|a|sin|todos)|(jornada|partidos)( \d+)? se (jugar|disputar)[aá]n?|haya f[uú]tbol|habr[aá] liga|se (juegue|jueguen|dispute|disputen|juega|disputa) (la jornada|todos|toda)|habr[aá] (partidos|jornada)|huelga|paro de (los )?futbolistas|parar (el )?f[uú]tbol|sin f[uú]tbol (este|el) fin de semana|no habr[aá] f[uú]tbol/i;
const TIPOS = ['suspension', 'aplazamiento', 'horario', 'puertaCerrada', 'nada'];
// de qué tiene que hablar una noticia sin clubes para contar como la jornada entera (y lo que dice que es de un partido)
const JORNADA = /jornada|\bj\d{1,2}\b|competici[oó]n|tod[oa]s (los|las) (partidos|encuentros)|(partidos|encuentros) de (primera|segunda|laliga)|primera y segunda|no habr[aá] (f[uú]tbol|liga|partidos)|f[uú]tbol (profesional|español|en españa)/i;
const UNO = /\b(el|su) (partido|encuentro|duelo)\b/i;
// cuándo una noticia de varios partidos es en realidad de la jornada (y los partidos, la excepción): «mantiene la jornada… ya estaban
// aplazados el Sevilla-Alavés y…». Más estrecho que JORNADA: «LaLiga aplaza el Valencia-Real Madrid y el Villarreal-Getafe de la
// jornada 12» son dos partidos (auditoría del 5 nov)
const EXCEPCION = /ya (estaba|estaban|fueron|hab[ií]an sido) aplazad|salvo (el|los) (ya )?aplazad|(mantien\w*|suspend\w*|aplaz\w*|se (jugar|disputar)[aá]n?|habr[aá]) (toda )?la (jornada|competici[oó]n)|(la )?jornada( \d+)? se (jugar|disputar)[aá]|tod[oa]s (los|las) (partidos|encuentros)|haya f[uú]tbol|habr[aá] f[uú]tbol/i;
// (de EXCEPCION, lo que dice que los partidos son viejos o que cae la jornada entera: ahí los partidos no son la noticia)
const YA = /ya (estaba|estaban|fueron|hab[ií]an sido) aplazad|salvo (el|los) (ya )?aplazad|(suspend\w*|aplaz\w*) (toda )?la (jornada|competici[oó]n)/i;
const ESTADOS = ['se_estudia', 'confirmado', 'descartado'];
const GRANDES = ['COPE', 'Cadena SER', 'SPORT', 'Mundo Deportivo', 'AS', 'MARCA'];
const OFICIAL = /comunicado|oficial|ha anunciado|anuncia(do)? (laliga|la rfef|la federaci[oó]n|el csd)|(laliga|la rfef|la federaci[oó]n|el csd|el comit[eé]) (ha )?(decidido|confirmado|anunciado|comunicado)/i;

const ESQUEMA = { type: 'OBJECT', required: ['noticias'], properties: { noticias: { type: 'ARRAY', items: { type: 'OBJECT',
  required: ['i', 'tipo', 'estado', 'primera', 'segunda', 'jornada', 'equipos', 'luto', 'oficial', 'contexto', 'detalle'],
  properties: { i: { type: 'INTEGER' }, tipo: { type: 'STRING', enum: TIPOS }, estado: { type: 'STRING', enum: ESTADOS }, primera: { type: 'BOOLEAN' },
    segunda: { type: 'BOOLEAN' }, jornada: { type: 'INTEGER' }, equipos: { type: 'ARRAY', items: { type: 'STRING' } }, luto: { type: 'BOOLEAN' },
    oficial: { type: 'BOOLEAN' }, contexto: { type: 'STRING' }, detalle: { type: 'STRING' } } } } } };

export function prompt(lote, equipos, jornada = null) {
  return `Eres redactor de una cuenta de LaLiga Fantasy. Te paso noticias de prensa (titular y entradilla). Para cada una di si cuenta una NOVEDAD sobre la celebración de la jornada o de un partido de LaLiga de Primera división:
- "tipo": "suspension" (se suspende la jornada o un partido), "aplazamiento" (se aplaza a otra fecha), "horario" (cambia la fecha o la hora de un partido), "puertaCerrada" (se juega sin público) o "nada" (cualquier otra cosa: partidos de otras competiciones, Champions, Copa, selección, fútbol femenino, crónicas, opiniones, sanciones a jugadores, rumores sin fuente).
- "estado": "se_estudia" si se está valorando o se decidirá más adelante, "confirmado" si ya está decidido, "descartado" si se ha decidido que NO (por ejemplo, la jornada se jugará).
- "primera": true si afecta a Primera división; "segunda": true si afecta también a Segunda.
- "jornada": el número de la jornada si la noticia lo dice con cifra${jornada ? `; si dice «este fin de semana», «la jornada actual» o «la próxima jornada», ${jornada} o ${jornada + 1} según la fecha de la noticia (la ${jornada} es la que se juega ahora o la siguiente que toca)` : ''}; si no, 0.
- "equipos": los clubes de un partido concreto, también si no son de Primera (y en ese caso "primera": false).
- Más sobre "equipos": si la noticia es de un partido concreto (y no de la jornada entera, aunque nombre algún partido), los dos clubes, con su nombre corto (por ejemplo ${Object.values(equipos).slice(0, 3).map((e) => `"${corto(e)}"`).join(', ')}); si es la jornada entera, lista vacía.
- "luto": true si detrás hay un fallecimiento, un accidente o una tragedia.
- "oficial": true solo si lo ha anunciado LaLiga, la RFEF, el CSD o el club (comunicado), no si son fuentes o informaciones del medio.
- "contexto": por qué, en una frase corta tuya (como mucho 100 caracteres), sin copiar la noticia, sin nombrar al medio y sin cifras que no estén en ella. Por ejemplo: "Tras el fallecimiento de X". Vacío si no lo dice.
- "detalle": lo siguiente que se sabe (quién lo decide y cuándo, la nueva fecha u hora), en una frase corta tuya con las mismas reglas. Vacío si no lo dice.
Nada de opiniones, adjetivos ni la palabra fantasy. Contesta solo con el JSON.

${lote.map((x, i) => `[${i}]${x.t ? ` (${diaMadrid(x.t)})` : ''} ${x.titulo}\n${x.entradilla}`).join('\n\n')}`;
}

/** los ids de los clubes de Primera que nombra Gemini («Barcelona», «Atlético de Madrid», «Sevilla FC»…) */
export function clubesDe(nombres, equipos) {
  const ids = [];
  for (const n of nombres || []) {
    const k = norm(n);
    if (k.length < 4) continue;
    // primero la coincidencia exacta, después el nombre corto que lo contiene y por último el largo («Deportivo» es el Dépor, no el
    // Deportivo Alavés, que salía antes por estar antes en la lista; auditoría del 5 nov)
    const ks = Object.keys(equipos), na = (t) => norm(corto(equipos[t])), nb = (t) => norm(equipos[t]);
    const id = ks.find((t) => na(t) === k || nb(t) === k) || (k.length >= 5 && (ks.find((t) => na(t).includes(k)) || ks.find((t) => nb(t).includes(k) || k.includes(na(t)))));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
/** los partidos de una lista de clubes: con los partidos de la jornada (stats), cada club con su rival, y solo si están todos; sin
    stats, por parejas en el orden de la lista. null si no cuadra */
export function emparejar(ids, stats = null) {
  if (!Array.isArray(stats) || !stats.length) return ids.length % 2 ? null : ids.reduce((ps, id, i) => (i % 2 ? ps : [...ps, [id, ids[i + 1]]]), []);
  const out = [], usados = new Set();
  for (const id of ids) {
    if (usados.has(id)) continue;
    // (de los partidos del club, el rival que está en la lista: con dos jornadas, el club juega dos veces)
    const rival = stats.filter((x) => x && x.local && x.visitor && (String(x.local.id) === id || String(x.visitor.id) === id))
      .map((m) => String(String(m.local.id) === id ? m.visitor.id : m.local.id)).find((r) => ids.includes(r) && !usados.has(r));
    if (!rival) return null;
    usados.add(id); usados.add(rival); out.push([id, rival]);
  }
  return out;
}
/** el número de jornada de un grupo de noticias: el que sale en el texto si solo hay uno; si ninguna lo trae, el que ha puesto Gemini
    por la fecha si todas coinciden; si no, 0 («la próxima jornada») */
export function numeroDe(hs) {
  const enTexto = [...new Set(hs.filter((h) => h.jTxt && h.jornada).map((h) => h.jornada))];
  if (enTexto.length) return enTexto.length === 1 ? enTexto[0] : 0;
  const puestos = [...new Set(hs.filter((h) => h.jornada).map((h) => h.jornada))];
  return puestos.length === 1 && hs.every((h) => h.jornada) ? puestos[0] : 0;
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
async function actualizar({ equipos, registro, ahora, config, log, leer, pedirIA, clave, jornada = null, stats = null, statsDe = statsSemana }) {
  let siguiente = null;
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
  const r = await pedirIA({ clave, prompt: prompt(lote, equipos, jornada), esquema: ESQUEMA, log, hasta });
  if (!r.ok) { log(`  (liga) Gemini no contesta: ${r.error}. Lo vuelvo a intentar en la próxima ejecución`); return lg; }
  log(`  (liga) Gemini (${r.modelo}) ha leído ${lote.length}`);
  for (const x of lote) lg.vistas[x.guid] = x.t;
  for (const a of (r.datos && r.datos.noticias) || []) {
    const x = lote[a.i];
    if (!x || !TIPOS.includes(a.tipo) || a.tipo === 'nada' || !ESTADOS.includes(a.estado) || !a.primera) continue;
    const fuente = `${x.titulo} ${x.entradilla}`;
    const nums = [...new Set((fuente.match(/\d+/g) || []).map(Number))].slice(0, 30);
    // si la jornada es el tema y los partidos que nombra son la excepción («se disputen todos los partidos… salvo los ya aplazados»),
    // es de la jornada aunque Gemini ponga clubes (con ellos se tiraba entera; auditoría del 5 nov)
    // Solo con «descartado» (la jornada se juega): con un partido aplazado o suspendido, «aplaza el Sevilla-Alavés y mantiene la
    // jornada» acababa en «Se suspende la jornada 12» (auditoría del 5 nov)
    if (a.estado === 'descartado' && a.equipos && a.equipos.length && EXCEPCION.test(fuente)) a.equipos = [];
    // aplazar o suspender la jornada entera es lo mismo para quien juega: un solo tema
    const tipo = a.tipo === 'aplazamiento' && !(a.equipos && a.equipos.length) ? 'suspension' : a.tipo;
    const h = { guid: x.guid, medio: x.medio, t: x.t, tipo, estado: a.estado, segunda: !!a.segunda,
      // el número: el que sale en la noticia o, si Gemini lo saca de «este fin de semana» / «la próxima jornada», esta o la siguiente
      jornada: a.jornada > 0 && a.jornada <= 38 && (nums.includes(a.jornada) || (jornada && (a.jornada === jornada || a.jornada === jornada + 1))) ? a.jornada : 0,
      // si el número sale en la noticia o lo ha puesto Gemini por la fecha (para quedarse con el del texto si los hay)
      jTxt: a.jornada > 0 && nums.includes(a.jornada), clubes: clubesDe(a.equipos, equipos).slice(0, 2),
      luto: !!a.luto, oficial: !!a.oficial && OFICIAL.test(fuente),
      contexto: frase(a.contexto, { fuente, max: 100 }), detalle: frase(a.detalle, { fuente, max: 100 }), nums };
    // un partido de un solo club no se entiende sin el rival; mejor esperar a otra noticia que lo diga. Y un club que no es de Primera
    // (un partido de Segunda: «Granada-Tenerife») no puede acabar como «la jornada» por no tener clubes casados (auditoría del 5 nov)
    // (con más de dos equipos es la jornada entera que nombra partidos ya aplazados: «ya estaban aplazados el Granada-Tenerife y…»)
    // dos clubes de Primera que no juegan entre sí ni en esta jornada ni en la siguiente no son un partido de Primera (un filial:
    // «Real Madrid Castilla-Sevilla Atlético» casaba como Real Madrid-Atlético)
    if (a.equipos && a.equipos.length === 2 && h.clubes.length === 2 && ['suspension', 'aplazamiento'].includes(tipo) && Array.isArray(stats) && stats.length && jornada && !emparejar(h.clubes, stats)) {
      siguiente ||= await statsDe(jornada + 1).then((r) => (Array.isArray(r) ? r : []), () => []);
      if (siguiente.length && !emparejar(h.clubes, siguiente)) { log(`  (liga) ${x.medio}: ${a.tipo} de dos clubes que no se enfrentan en la jornada ${jornada} ni en la ${jornada + 1}`); continue; }
    }
    if (a.equipos && a.equipos.length && a.equipos.length <= 2 && h.clubes.length < a.equipos.length) { log(`  (liga) ${x.medio}: ${a.tipo} de un partido sin casar sus clubes`); continue; }
    // con más de dos equipos y alguno de Primera, ni un partido ni seguro la jornada: mejor otra noticia («LaLiga suspende la jornada 12»
    // con Gemini dando Granada, Tenerife y Sevilla salía «Se suspende el partido del Sevilla»)
    // salvo que sean dos o tres partidos de Primera con todos sus clubes casados («Aplazados el Valencia-Real Madrid y el Villarreal-
    // Getafe»): un hecho por pareja, en el orden en que los da Gemini
    // (no si la noticia habla de la jornada: «LaLiga mantiene la jornada 12; el Sevilla-Alavés y el Málaga-Racing ya estaban aplazados»
    // no son dos partidos que se juegan. Con los partidos de la jornada, cada club con su rival de verdad, no en el orden de Gemini)
    if (a.equipos && a.equipos.length > 2) {
      const todos = clubesDe(a.equipos, equipos);
      if (!YA.test(fuente) && a.equipos.length % 2 === 0 && a.equipos.length <= 6 && todos.length === a.equipos.length) {
        // (si con los partidos de esta jornada no cuadra, con los de la siguiente: la noticia puede ser de la próxima)
        let parejas = emparejar(todos, stats);
        // (si la API de la siguiente falla, nada: sin partidos, `emparejar` iría por el orden de Gemini y saldrían partidos que no existen)
        if (!parejas && Array.isArray(stats) && stats.length && jornada) {
          siguiente ||= await statsDe(jornada + 1).then((r) => (Array.isArray(r) ? r : []), () => []);
          if (siguiente.length) parejas = emparejar(todos, siguiente) || emparejar(todos, [...stats, ...siguiente]);
        }
        if (parejas) {
          for (const par of parejas) lg.hechos.push({ ...h, clubes: par });
          log(`  (liga) ${x.medio}: ${a.tipo} · ${a.estado} de ${parejas.length} partidos`);
          continue;
        }
      }
      if (h.clubes.length || !EXCEPCION.test(fuente)) { log(`  (liga) ${x.medio}: ${a.tipo} con ${a.equipos.length} equipos: no sé si es un partido o la jornada`); continue; }
    }
    // la jornada entera, solo si la noticia habla de la jornada, la competición o los partidos de Primera; «fin de semana» vale si no
    // habla de un partido («El Tenerife no jugará este fin de semana… su partido ante el Granada» no es la jornada)
    if (!h.clubes.length && !(JORNADA.test(fuente) || (/fin de semana/i.test(fuente) && !UNO.test(fuente)))) { log(`  (liga) ${x.medio}: ${a.tipo} sin clubes ni jornada: no lo cuento como la jornada`); continue; }
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
  log = console.log, leer = noticiasPrensaUnaVez, pedirIA = preguntarJson, clave = process.env.GEMINI_API_KEY, stats = null, statsDe = statsSemana }) {
  const [hD, hH] = horas(config, 'horasLiga', [8, 24], ahora);
  if (ventanas && !forzar && (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH)) return [];
  if (ventanas && !(registro && registro.fichero)) { log('  (liga) sin registro guardado: no pregunto a Gemini'); return []; }
  const lg = await actualizar({ equipos, registro, ahora, config, log, leer, pedirIA, clave, jornada, stats, statsDe });
  if (registro) registro.guardar();
  // lo publicado en los últimos 5 días (la clave lleva la jornada: una suspensión de otra semana es otra noticia)
  const hechas = registro && registro.todos ? registro.todos().filter((e) => !e.t || ahora - Date.parse(e.t) < 5 * 24 * HORA || ahora < Date.parse(e.t)).map((e) => e.clave) : [];
  // juntar por tema (tipo + de qué se habla) y estado
  const grupos = new Map();
  for (const h of lg.hechos) {
    if (ahora - h.t > 36 * HORA) continue;
    // un «aplazamiento» sin clubes casados es un partido de otra categoría guardado antes del 5 nov (los nuevos ya no entran)
    if (h.tipo === 'aplazamiento' && !(h.clubes && h.clubes.length)) continue;
    const o = objeto(h, equipos);
    const tema = `${h.tipo}|${o.clave}`;
    const k = `${tema}|${h.estado}`;
    if (!grupos.has(k)) grupos.set(k, { tema, estado: h.estado, tipo: h.tipo, obj: o.texto, hs: [] });
    const g = grupos.get(k);
    g.hs.push(h);
    // de la jornada entera, el texto con el número y con «Primera y Segunda» si alguno lo dice
    if (o.clave === 'j') g.obj = objeto({ clubes: [], jornada: numeroDe(g.hs), segunda: g.hs.some((x) => x.segunda) }, equipos).texto;
  }
  const out = [];
  // lo decidido antes que lo que se estudia
  // (y, con el mismo estado, la jornada entera antes que un partido)
  const rango = { confirmado: 0, se_estudia: 1, descartado: 2 };
  const orden = [...grupos.values()].sort((a, b) => rango[a.estado] - rango[b.estado] || b.tema.endsWith('|j') - a.tema.endsWith('|j') || b.hs.length - a.hs.length);
  // ¿la jornada entera ya tiene (o tiene ahora) ese estado? Un partido no repite lo que ya dice la jornada: con «la jornada se jugará»,
  // «el Valencia-Real Madrid se jugará» sobra, y «se estudia suspender el Málaga-Racing» también (auditoría del 5 nov)
  // (solo una jornada que sale de verdad: oficial o con dos medios y reciente; o publicada en las últimas 36 h. Y de la misma jornada
  // que el partido: «suspendida la J13» no tapa un aplazamiento de la J12; auditoría del 5 nov)
  const sale = (g) => !!g && (g.hs.some((h) => h.oficial) || new Set(g.hs.map((h) => h.medio)).size >= 2) && ahora - Math.max(...g.hs.map((h) => h.t)) <= 12 * HORA;
  const recientes = (registro && registro.todos ? registro.todos() : []).filter((e) => e && e.t && ahora - Date.parse(e.t) < 36 * HORA).map((e) => e.clave);
  const aireJ = (tp) => Number((((registro && registro.datos && registro.datos.aire) || {})[`${tp}|j|J${jornada}`] || {}).jornada) || jornada;
  const deJ = (e, jP) => ['suspension', 'aplazamiento'].some((tp) => {
    const gj = grupos.get(`${tp}|j|${e}`);
    if (sale(gj) && (numeroDe(gj.hs) || jornada) === jP) return true;
    return recientes.includes(`liga|${tp}|j|${e}|J${jornada}`) && (e !== 'confirmado' || aireJ(tp) === jP);
  });
  for (const g of orden) {
    if (out.length >= (config.ligaPorEjecucion ?? 1)) break;
    const clave = `liga|${g.tema}|${g.estado}|J${jornada}`;
    if (hechas.includes(clave)) continue;
    // lo que se estudia ya no es noticia si ya salió (o sale ahora) la decisión
    if (g.estado === 'se_estudia' && (hechas.some((c) => c.startsWith(`liga|${g.tema}|`)) || grupos.has(`${g.tema}|confirmado`) || grupos.has(`${g.tema}|descartado`))) continue;
    if (['suspension', 'aplazamiento'].includes(g.tipo) && !g.tema.endsWith('|j')) {
      // lo que sigue saliendo: un partido suspendido con la jornada «se jugará» y uno que «se jugará» con la jornada suspendida
      const tapa = { se_estudia: ['se_estudia', 'confirmado', 'descartado'], descartado: ['descartado', 'se_estudia'], confirmado: ['confirmado'] }[g.estado] || [];
      const jP = numeroDe(g.hs) || jornada;
      // (un «se estudia» de un partido con otra causa que la de la jornada —el temporal y no el luto— sí sale)
      const mismaCausa = (e) => { const gs = ['suspension', 'aplazamiento'].map((tp) => grupos.get(`${tp}|j|${e}`)).filter(Boolean); return !gs.length || gs.some((gj) => gj.hs.some((h) => h.luto) === g.hs.some((h) => h.luto)); };
      if (tapa.some((e) => deJ(e, jP) && (g.estado !== 'se_estudia' || e === 'confirmado' || mismaCausa(e))) && !(g.estado === 'descartado' && deJ('confirmado', jP))) { log(`  (liga) ${g.tema} (${g.estado}): ya lo dice la jornada`); continue; }
    }
    const hs = g.hs.sort((a, b) => a.t - b.t);
    // una historia que sigue viva vale mientras haya noticias recientes: manda la última
    if (ahora - hs[hs.length - 1].t > 12 * HORA) { log(`  (liga) ${g.tema} (${g.estado}): la última noticia es de hace más de 12 h`); continue; }
    const medios = [...new Set(hs.map((h) => h.medio))].sort((a, b) => GRANDES.indexOf(b) - GRANDES.indexOf(a));
    const oficial = hs.some((h) => h.oficial);
    if (!oficial && medios.length < 2) { log(`  (liga) ${g.tema} (${g.estado}): solo ${medios.join(', ')}, espero a una segunda fuente`); continue; }
    const mejor = (k) => (hs.filter((h) => h[k]).sort((a, b) => b[k].length - a[k].length)[0] || {})[k] || '';
    const luto = hs.some((h) => h.luto);
    const texto = redactar({ tipo: g.tipo, estado: g.estado, obj: g.obj, luto, contexto: mejor('contexto'), detalle: mejor('detalle'), medios, oficial });
    // el mismo número para el texto y para lib/aire.mjs
    const jn = numeroDe(hs) || null;
    // jornadaAire: la jornada de la que habla la noticia, si la dice (lib/aire.mjs apunta con ella las fechas de sus partidos)
    out.push({ tipo: 'liga', clave, jornada, jornadaAire: jn, texto, numeros: [...new Set([jornada, ...(jn ? [jn] : []), ...hs.flatMap((h) => h.nums || [])])], tarjeta: null });
  }
  return out;
}
