// Noticias de prensa (Carlos, 2-3 nov): lesiones, molestias, descartes y vueltas que cuenta la prensa (lib/prensa.mjs: MARCA, AS, Mundo Deportivo, SPORT, SER, COPE y más)
// antes de que salgan en LaLiga Fantasy. Cómo va:
//   1. Se leen los RSS (lib/prensa.mjs) y se quedan las noticias que nombran a un jugador que importa (media de 4 o más, o 10 M o
//      más) y hablan de lesión, entrenamiento, convocatoria o alta. Solo las nuevas (las ya vistas se guardan en el registro).
//   2. Gemini (lib/gemini.mjs, secreto GEMINI_API_KEY) las clasifica (lesión, molestias, descartado, vuelve o nada) y las resume
//      con palabras propias. Lo que escribe se comprueba: frases cortas, con el nombre del jugador, sin copiar 6 palabras seguidas
//      de la noticia, sin cifras que no estén en ella y sin enlaces. Lo que no pasa se tira y el tweet usa una plantilla.
//   3. Regla de las dos fuentes (Carlos, 2 nov): sale si lo da el club (parte médico, comunicado) o si lo cuentan dos medios, o un
//      medio y además LaLiga Fantasy (su estado) o la lista de lesionados de las webs de previas (lib/partes.mjs) dicen lo mismo.
//   4. Un tweet por jugador con el formato de Carrasco (claude/estilo-tweets.md, «novedades / caídas»). Sin repetir a quien ya ha
//      salido en novedades, caídas o noticias (cubiertos() del registro).
// Solo se guardan en el registro (rama bot-estado, repo público) los datos sacados, nunca los titulares ni las entradillas.
import { corto, fmt, partes, elegir, el, del, norm, turno, largo as esLargo } from '../lib/texto.mjs';
import { tweet, cap, segunda, proximoPartido, paraLa, cuando, pegar } from '../lib/redactar.mjs';
import { tarjetaBajas } from '../lib/datos-tarjetas.mjs';
import { lista as enLista } from '../lib/agrupar.mjs';
import { lesionados, parteDe } from '../lib/partes.mjs';
import { noticiasPrensaUnaVez, NOMBRES_MEDIOS } from '../lib/prensa.mjs';
import { clasificador, claveClasificar } from '../lib/ia.mjs';
import { clubes, partido, jugador, fuente as fuenteH } from '../lib/hechos.mjs';
import { ideasInfo, vecesHoy } from '../lib/info-jugador.mjs';

const HORA = 36e5;
const ahoraReal = () => Date.now();
/** la fecha de la lista de lesionados («desde el 1/11») como hora: el año, el de ahora (o el anterior si saldría en el futuro) */
const fechaParte = (p, ahora) => { const y = new Date(ahora).getUTCFullYear(); let t = Date.UTC(y, p.mes - 1, p.dia, 12); if (t > ahora + 2 * 864e5) t = Date.UTC(y - 1, p.mes - 1, p.dia, 12); return t; };
export const IMPORTA = (j) => Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
import { horaMadrid, horas } from '../lib/horario.mjs';   // entre semana, desde las 7 (lib/horario.mjs)
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));
// de qué tiene que hablar una noticia para que merezca preguntar a Gemini
const TEMA = /lesi[oó]n|lesiona|baja|alta m[eé]dica|el alta|parte m[eé]dico|molesti|entren|convoca|viaj|descart|recuper|vuelve|regres|reaparec|duda|al margen|quir[oó]f|operad|rotura|se rompe|se ha roto|esguince|sobrecarga|fractura|tocado|disponible|se pierde|perder[aá]|no estar[aá]|no jugar[aá]|sancion/i;
// los medios que se nombran primero en el tweet (al revés: el último, el primero)
const GRANDES = ['COPE', 'Cadena SER', 'SPORT', 'Mundo Deportivo', 'AS', 'MARCA'];
const QUE = ['lesion', 'molestias', 'descartado', 'vuelve', 'nada'];
/** gestión de cargas, descanso o precaución: una duda leve, no una lesión */
export const esLeve = (s) => /gesti[oó]n de (la )?cargas?|carga de trabajo|cargas f[ií]sicas|dosific|descans|precauci[oó]n|rotaci[oó]n|reservad/i.test(String(s || ''));
export const familia = (que) => (que === 'vuelve' ? 'buena' : 'mala');
const MEDIOS = new RegExp(`(^|[^\\p{L}])(${[...NOMBRES_MEDIOS, 'SER'].map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'u');

/** los jugadores que importan nombrados en la noticia: por apodo entero o nombre completo; «A. Batalla», por apellido y con el club */
export function candidatos(n, jugadores, equipos = {}) {
  const todos = nombrados(` ${norm(`${n.titulo} ${n.entradilla}`)} `, jugadores, equipos);
  if (todos.length <= 4) return todos;
  // una convocatoria entera o una crónica nombra a cinco o más: entonces solo cuentan los del titular («vuelven Koke y Cuti»)
  const tit = nombrados(` ${norm(n.titulo)} `, todos, equipos);
  return tit.length <= 3 ? tit : [];
}
function nombrados(txt, jugadores, equipos) {
  const out = [];
  for (const j of jugadores) {
    const apodo = norm(j.nickname), nombre = norm(j.name);
    let si = (apodo.length >= 4 && txt.includes(` ${apodo} `)) || (nombre.split(' ').length >= 2 && txt.includes(` ${nombre} `));
    const ini = apodo.match(/^[a-z] ([a-z]{5,})$/);
    if (!si && ini && txt.includes(` ${ini[1]} `)) si = txt.includes(` ${norm(corto(equipos[String(j.teamId)] || '-'))} `);
    if (si) out.push(j);
  }
  return out;
}

// ¿copia 6 palabras seguidas de la fuente? (vive en lib/texto.mjs desde el 6 nov: también lo usa lib/redaccion.mjs)
export { copia } from '../lib/texto.mjs';
import { copia } from '../lib/texto.mjs';
/** lo que escribe Gemini, limpio y comprobado; '' si no vale */
export function frase(s, { fuente = '', max = 90, debeLlevar = null } = {}) {
  s = String(s || '').replace(/["«»“”]/g, '').replace(/\s+/g, ' ').trim().replace(/[.;:,]+$/, '');
  if (!s || s.length > max || /https?:|www\.|@|#|\bfantasy\b/i.test(s) || MEDIOS.test(s) || copia(s, fuente)) return '';
  const cifras = new Set((fuente.match(/\d+/g) || []).map((x) => String(Number(x))));
  if ((s.match(/\d+/g) || []).some((x) => !cifras.has(String(Number(x))))) return '';
  if (debeLlevar && !debeLlevar.some((k) => k && ` ${norm(s)} `.includes(` ${k} `))) return '';
  return s;
}
/** ¿jugó (puntos distintos de 0) en un partido de la jornada que ya acabó antes de la noticia? (Aubameyang, 3 nov: dos crónicas
 * del partido en el que reapareció salieron como «vuelve») */
export function yaJugo(j, stats, t) {
  for (const m of stats || []) {
    if (m.matchState !== 7 || !(Date.parse(m.date) < t)) continue;
    for (const lado of [m.local, m.visitor]) for (const p of (lado && lado.players) || []) if (String(p.id) === String(j.id) && p.weekPoints != null && Number(p.weekPoints) !== 0) return true;
  }
  return false;
}
const llaves = (j) => { const a = norm(j.nickname), b = norm(j.name).split(' '); return [a, b[b.length - 1], b.length > 2 ? b[b.length - 2] : null].filter((x) => x && x.length >= 3); };

const ESQUEMA = { type: 'OBJECT', required: ['noticias'], properties: { noticias: { type: 'ARRAY', items: { type: 'OBJECT',
  required: ['i', 'jugadorId', 'que', 'otraCompeticion', 'seguro', 'oficial', 'hecho', 'motivo', 'plazo'],
  properties: { i: { type: 'INTEGER' }, jugadorId: { type: 'INTEGER' }, que: { type: 'STRING', enum: QUE }, otraCompeticion: { type: 'BOOLEAN' },
    seguro: { type: 'BOOLEAN' }, oficial: { type: 'BOOLEAN' }, hecho: { type: 'STRING' }, motivo: { type: 'STRING' }, plazo: { type: 'STRING' } } } } } };

export function prompt(lote) {
  return `Eres redactor de una cuenta de LaLiga Fantasy. Te paso noticias de prensa (titular y entradilla) y, en cada una, los jugadores de LaLiga que podrían salir en ella. Para cada noticia di si cuenta una NOVEDAD sobre si ese jugador podrá jugar con su club en LaLiga:
- "lesion": se lesiona o el club da un parte con una lesión nueva.
- "molestias": tiene molestias, no entrena con el grupo o entrena al margen, sin lesión confirmada.
- "descartado": no viaja, no entra en la convocatoria o el entrenador lo descarta para el próximo partido de LaLiga.
- "vuelve": recibe el alta, vuelve a entrenar con el grupo o vuelve a una convocatoria después de una lesión o una sanción (también si la convocatoria es de Champions o de Copa: si está para jugar ahí, está para LaLiga).
- "nada": todo lo demás: fichajes, rumores, opiniones, una situación que la noticia solo repite, si habla de otro jugador, y las crónicas y análisis de partidos ya jugados (si la noticia cuenta que ya jugó, marcó o reapareció en un partido, es "nada": eso ya se sabe).
Reglas:
- jugadorId: el id del candidato del que habla la noticia; 0 si no es ninguno o si dudas.
- otraCompeticion: true si solo afecta a un partido de Champions, Europa League, Conference, Copa o la selección (un descanso o una rotación para un partido europeo, una lesión con la selección que no le quita jugar en LaLiga). Una vuelta a la convocatoria tras una lesión NO es otraCompeticion.
- seguro: true si la noticia lo da como un hecho; false si es una posibilidad («podría», «apunta a», «se teme», «preocupa»).
- oficial: true solo si la noticia dice que lo ha comunicado el club (parte médico o comunicado).
- hecho: una frase corta de periodista con TUS palabras, de 4 a 10 palabras, en presente, que empiece por el nombre del jugador tal como sale en los candidatos (por ejemplo «Andrés Martín se rompe y estará varias semanas fuera»). Sin comillas, sin nombrar al medio y sin copiar el titular.
- motivo: la lesión o la causa en 2 a 8 palabras, con tus palabras («rotura de fibras en el isquiotibial»); vacío si la noticia no la da.
- plazo: cuánto tiempo estará fuera, en una frase corta con tus palabras («estará fuera varias semanas»); vacío si la noticia no lo da. Cifras solo si están en la noticia.
- No añadas nada que no diga la noticia.
Noticias:
${JSON.stringify(lote.map((x, i) => ({ i, titular: x.n.titulo, entradilla: x.n.entradilla, candidatos: x.c.map((j) => ({ id: Number(j.id), nombre: j.nickname, club: x.equipos[String(j.teamId)] || '' })) })))}`;
}

/** lee la prensa, pregunta a Gemini por lo nuevo y guarda los hechos en el registro (datos.noticias) */
async function actualizar({ jugadores, equipos, registro, ahora, config, log, leer, pedirIA, clave }) {
  const datos = (registro && registro.datos) || {};
  const nt = (datos.noticias ||= { vistas: {}, hechos: [], gemini: { dia: '', n: 0 } });
  // fuera lo de más de 72 h
  for (const [g, t] of Object.entries(nt.vistas)) if (ahora - t > 72 * HORA) delete nt.vistas[g];
  nt.hechos = nt.hechos.filter((h) => ahora - h.t < 72 * HORA);
  // desde cuándo sale cada uno como sale en LaLiga Fantasy (Cucho, 3 nov: lesionado desde antes y la prensa lo repite): lo que se ve
  // por primera vez cuenta como viejo (t 0)
  const importan = (jugadores || []).filter(IMPORTA);
  const prim = !nt.desde;
  nt.desde ||= {};
  for (const j of importan) { const e = j.playerStatus || 'ok', d = nt.desde[j.id]; if (!d || d.e !== e) nt.desde[j.id] = { e, t: prim || !d ? 0 : ahora }; }
  if (!clave) { log('  (noticias) sin clave de la IA (GEMINI_API_KEY o ANTHROPIC_API_KEY): no leo la prensa'); return nt; }
  const todas = await leer({ log });
  const nuevas = [];
  for (const n of todas) {
    if (nt.vistas[n.guid]) continue;
    const t = n.t || ahora;
    if (ahora - t > 30 * HORA || t - ahora > HORA) continue;
    if (!TEMA.test(`${n.titulo} ${n.entradilla}`)) continue;
    const c = candidatos(n, importan, equipos);
    if (c.length) nuevas.push({ n: { ...n, t }, c, equipos });
  }
  log(`  (noticias) ${nuevas.length} noticias nuevas que nombran a un jugador y hablan de su estado`);
  if (!nuevas.length) return nt;
  const hoy = diaMadrid(ahora);
  if (nt.gemini.dia !== hoy) nt.gemini = { dia: hoy, n: 0 };
  const porLote = 20, maxLotes = config.noticiasLotesEjecucion ?? 2, hasta = ahoraReal() + (config.noticiasSegundos ?? 90) * 1000;
  for (let k = 0; k < Math.min(maxLotes, Math.ceil(nuevas.length / porLote)); k++) {
    if (nt.gemini.n >= (config.geminiDia ?? 60)) { log(`  (noticias) tope de ${config.geminiDia ?? 60} preguntas a Gemini hoy`); break; }
    const lote = nuevas.slice(k * porLote, (k + 1) * porLote);
    nt.gemini.n++;
    if (ahoraReal() > hasta - 10000) { log('  (noticias) sin tiempo para más preguntas en esta ejecución'); break; }
    const r = await pedirIA({ clave, prompt: prompt(lote), esquema: ESQUEMA, log, hasta });
    if (!r.ok) { log(`  (noticias) Gemini no contesta: ${r.error}. Lo vuelvo a intentar en la próxima ejecución`); break; }
    log(`  (noticias) Gemini (${r.modelo}) ha leído ${lote.length}`);
    for (const x of lote) nt.vistas[x.n.guid] = x.n.t;
    for (const a of (r.datos && r.datos.noticias) || []) {
      const x = lote[a.i];
      if (!x || !QUE.includes(a.que) || a.que === 'nada' || a.otraCompeticion || !a.seguro) continue;
      const j = x.c.find((y) => String(y.id) === String(a.jugadorId));
      if (!j) continue;
      const fuente = `${x.n.titulo} ${x.n.entradilla}`;
      const h = { guid: x.n.guid, medio: x.n.medio, t: x.n.t, id: String(j.id), que: a.que, oficial: !!a.oficial && /parte m[eé]dico|comunicad|oficial|informa(do)? el club|ha informado/i.test(fuente),
        hecho: frase(a.hecho, { fuente, max: 90, debeLlevar: llaves(j) }), motivo: frase(a.motivo, { fuente, max: 60 }), plazo: frase(a.plazo, { fuente, max: 60 }),
        nums: [...new Set((fuente.match(/\d+/g) || []).map(Number))].slice(0, 30) };
      log(`  (noticias) ${x.n.medio}: ${j.nickname} → ${a.que}${h.oficial ? ' (oficial)' : ''}${h.hecho ? '' : ' (frase descartada)'}`);
      nt.hechos.push(h);
    }
  }
  return nt;
}

// con muchos medios, los dos primeros y cuántos más (en letra: una cifra suelta no estaría en los datos)
const MAS = ['', '', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const listaMedios = (ms) => (ms.length <= 3 ? enLista(ms) : `${ms.slice(0, 2).join(', ')} y ${ms.length - 2 === 1 ? 'otro medio' : `${MAS[ms.length - 2] || 'muchos'} medios más`}`);
const EST_TXT = { injured: 'lesionado', doubtful: 'duda', suspended: 'sancionado' };
/**
 * De dónde sale la noticia (Carlos, 5 nov 13:33: dudaba si poner siempre «según AS»). Lo que manda: si lo ha comunicado el club, eso;
 * si LaLiga Fantasy ya le ha cambiado el estado a lo mismo que dice el tweet, eso, sin el medio; si solo lo da la prensa, el medio
 * (da credibilidad). Tres formas que rotan y, según el tweet, detrás de la cabecera o detrás del motivo y el plazo (`arriba`),
 * para que no salga siempre igual ni en el mismo sitio. { t, arriba, quien: 'club' | 'laliga' | 'prensa' }
 */
export function fuenteDe(c, { baja = false, k = 0, dia = '' } = {}) {
  const lis = listaMedios(c.medios || []);
  const f = turno(3, `fue${dia}`, k), arriba = turno(2, `fueP${dia}`, k) === 0;
  // (Carlos, 5 nov 17:42: menos puntos y frases más largas) va pegada con una coma a la frase de antes (`pegar`): «…tras un mes, según AS»
  if (c.oficial) return { t: pegar(['según ha comunicado el club', 'como ha confirmado el club', 'y así lo ha comunicado el club'][f]), arriba, quien: 'club' };
  const confirma = c.laliga && (c.fam === 'buena' ? c.est === 'ok' : baja ? ['injured', 'suspended'].includes(c.est) : c.est === 'doubtful');
  // (Carlos, 6 nov 12:58, con el tweet de Eric: «lo de que LaLiga Fantasy ya lo da como disponible no tiene mucho sentido»: repetía la
  // etiqueta de abajo, «✅ Disponible para la jornada 12», y no decía quién lo cuenta.) Una vuelta confirmada por LaLiga se cuenta con
  // el medio o el club, como cualquier otra; el estado del juego ya sale en la etiqueta y en la carta.
  if (confirma && c.fam !== 'buena') { const e = EST_TXT[c.est]; return { t: pegar([`y en LaLiga Fantasy ya sale como ${e}`, `y LaLiga Fantasy ya lo marca como ${e}`, `con LaLiga Fantasy marcándolo ya como ${e}`][f]), arriba, quien: 'laliga' }; }
  if ((c.medios || []).length >= 2) return { t: pegar([`según cuentan ${lis}`, `como publican ${lis}`, `según ${lis}`][f]), arriba, quien: 'prensa' };
  // un medio y la lista de lesionados de las webs de previas (que no se nombra), o LaLiga con otro estado (baja en la prensa, duda en LaLiga)
  const otro = c.laliga && c.fam === 'mala' && EST_TXT[c.est] ? `; en LaLiga Fantasy ya sale como ${EST_TXT[c.est]}` : '';
  return { t: pegar([`según ${lis}${otro}`, `como adelanta ${lis}${otro}`, `según publica ${lis}${otro}`][f]), arriba, quien: 'prensa' };
}

export async function generar({ jugadores, equipos, jornada, stats = null, semana = null, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(),
  log = console.log, proximo = proximoPartido, listaPartes = null, leer = noticiasPrensaUnaVez, pedirIA = clasificador({ registro, config }), clave = claveClasificar(config), info = null }) {
  const [hD, hH] = horas(config, 'horasNoticias', [9, 23], ahora);
  if (ventanas && !forzar && (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH)) return [];
  // sin registro guardado (simulacro del cron) no se gasta cupo de Gemini en cada ejecución
  if (ventanas && !(registro && registro.fichero)) { log('  (noticias) sin registro guardado: no pregunto a Gemini'); return []; }
  const nt = await actualizar({ jugadores, equipos, registro, ahora, config, log, leer, pedirIA, clave });
  if (registro) registro.guardar();
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  const cub = registro && registro.cubiertos ? registro.cubiertos() : [];
  const lp = listaPartes || await lesionados({ log });
  const dia = diaMadrid(ahora);
  const cands = [];
  for (const id of new Set(nt.hechos.map((h) => h.id))) {
    const j = porId.get(id);
    if (!j || !IMPORTA(j)) continue;
    const hs = nt.hechos.filter((h) => h.id === id && ahora - h.t < 36 * HORA).sort((a, b) => a.t - b.t);
    if (!hs.length) continue;
    const fam = familia(hs[hs.length - 1].que);
    // lo de la otra familia anterior no cuenta (lesionado el lunes y de vuelta el miércoles: vale lo del miércoles)
    const corte = Math.max(0, ...hs.filter((h) => familia(h.que) !== fam).map((h) => h.t));
    const mis = hs.filter((h) => familia(h.que) === fam && h.t >= corte);
    if (ahora - mis[0].t > 18 * HORA) { log(`  (noticias) ${j.nickname} (${fam}): la primera noticia es de hace más de 18 h`); continue; }
    if (fam === 'buena' && yaJugo(j, stats, mis[0].t)) { log(`  (noticias) ${j.nickname} (buena): ya ha jugado en LaLiga después de volver, no es noticia`); continue; }
    const medios = [...new Set(mis.map((h) => h.medio))].sort((a, b) => GRANDES.indexOf(b) - GRANDES.indexOf(a));
    const est = j.playerStatus || 'ok';
    const parte = parteDe(j, lp);
    // desde cuándo sale así en LaLiga (t 0 = de antes de que el bot lo mirara; entonces vale la fecha de la lesión de la lista)
    const desde = (nt.desde && nt.desde[j.id]) || { t: 0 };
    const tParte = parte && parte.dia && parte.mes ? fechaParte(parte, ahora) : 0;
    const reciente = (desde.t || tParte) >= mis[0].t - 48 * HORA;
    // LaLiga confirma una mala noticia si lo tiene tocado; una buena, solo si ha vuelto a «ok» hace poco (sano lo está cualquiera)
    const laliga = fam === 'mala' ? ['injured', 'doubtful', 'suspended'].includes(est) : est === 'ok' && desde.t >= ahora - 72 * HORA;
    const parteOk = fam === 'mala' ? !!(parte && ['baja', 'duda'].includes(parte.estado)) : !!(parte && parte.estado === 'disponible');
    const oficial = mis.some((h) => h.oficial);
    if (!(oficial || medios.length >= 2 || (medios.length && (laliga || parteOk)))) { log(`  (noticias) ${j.nickname} (${fam}): solo ${medios.join(', ')}, espero a una segunda fuente`); continue; }
    const yaSalio = cub.some((c) => String(c.id) === id && ((c.tipo === 'noticias' && c.que === fam && ahora - c.t < 48 * HORA)
      || (c.tipo === 'novedades' && familia(c.que) === fam && ahora - c.t < 24 * HORA) || ((c.tipo === 'caidas' || c.tipo === 'sancionados') && fam === 'mala' && c.jornada >= jornada)));
    if (yaSalio) { log(`  (noticias) ${j.nickname} ya ha salido: no lo repito`); continue; }
    // lo más grave manda: lesión > descartado > molestias
    const que = fam === 'buena' ? 'vuelve' : ['lesion', 'descartado', 'molestias'].find((q) => mis.some((h) => h.que === q));
    // ya lesionado o sancionado en LaLiga Fantasy: unas molestias o un descarte no cuentan nada nuevo (sigue sin estar)
    // y una lesión tampoco, si ya salía así en LaLiga desde 48 h o más antes de la primera noticia
    if (fam === 'mala' && ['injured', 'suspended'].includes(est) && (que !== 'lesion' || !reciente)) { log(`  (noticias) ${j.nickname}: ya salía como ${est} en LaLiga, nada nuevo`); continue; }
    // la frase de arriba, la última; el motivo y el plazo, los más completos
    const de = (k) => mis.filter((h) => h[k] && h.que === que).concat(mis.filter((h) => h[k]));
    const hecho = (de('hecho').reverse()[0] || {}).hecho || '';
    const largo = (k) => (de(k).sort((a, b) => b[k].length - a[k].length)[0] || {})[k] || '';
    cands.push({ j, fam, que, medios, oficial, laliga, est, parte, hecho, motivo: largo('motivo'), plazo: largo('plazo'),
      nums: [...new Set(mis.flatMap((h) => h.nums || []))] });
  }
  if (!cands.length) return [];
  cands.sort((a, b) => Number(b.j.averagePoints) - Number(a.j.averagePoints));
  const escudos = {};
  for (const m of stats || []) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const out = [];
  const vez = vecesHoy(registro, dia);
  for (const c of cands.slice(0, config.noticiasPorEjecucion ?? 2)) {
    const { j } = c;
    const equipo = corto(equipos[String(j.teamId)] || '?');
    const pp = await proximo(j.teamId, { stats, semana, jornada }).catch(() => null);
    const media = Number(j.averagePoints) || 0;
    const quien = `${cap(segunda(j.positionId, j.nickname))} ${del(equipo)}`;
    const sem = `not${j.id}${dia}`;
    // las frases que rotan: por cuántos tweets de un jugador (noticias y novedades) llevamos hoy
    const k = vez + out.length;
    const clave = `noticias|${j.id}:${c.fam}|${dia}`;
    const cab = c.hecho ? `${c.fam === 'buena' ? '✅' : '🚨'} ${cap(c.hecho)}`
      : c.que === 'lesion' ? elegir([`🚨 ${j.nickname} se lesiona`, `🚨 Saltan las alarmas con ${j.nickname}`], sem)
        : c.que === 'descartado' ? `🚨 ${j.nickname} se queda fuera de la convocatoria`
          : c.que === 'molestias' ? `🚨 Saltan las alarmas con ${j.nickname}` : elegir([`✅ ${j.nickname} está de vuelta`, `✅ ${j.nickname} vuelve`], sem);
    const baja = c.que === 'descartado' || (c.que === 'lesion' && (c.est === 'injured' || (c.parte && c.parte.estado === 'baja') || !!c.plazo));
    const fuente = fuenteDe(c, { baja, k, dia });
    // duda leve (Domy, 3 nov 22:15, con el tweet de Kike Salas): gestión de cargas, descanso o precaución, sin lesión
    const leve = c.fam === 'mala' && !baja && c.que !== 'lesion' && esLeve(`${c.motivo || ''} ${c.hecho || ''}`);
    const etiqueta = c.fam === 'buena' ? (c.est === 'ok' ? `✅ Disponible ${paraLa(pp, jornada)}` : `👀 Apunta a volver ${paraLa(pp, jornada)}`)
      : baja ? `❌ Baja ${paraLa(pp, jornada)}` : leve ? `⁉️ Duda leve ${paraLa(pp, jornada)}` : `⁉️ Duda ${paraLa(pp, jornada)}`;
    // el motivo, si dice algo (no «lesión» a secas) y no lo dice ya la cabecera; el plazo, si no lo dice ya
    const motivo = c.fam === 'mala' && c.motivo && c.motivo.split(' ').length >= 2 && !copia(c.motivo, cab, 3) ? c.motivo : '';
    const plazo = c.fam === 'mala' && c.plazo && !copia(c.plazo, cab, 3) && !copia(c.plazo, motivo, 3) ? c.plazo : '';
    const hr = esLargo() && pp && pp.fecha ? cuando(pp.fecha, ahora) : null;
    // (Carlos, 5 nov 13:33) lo que le sirve al que lo tiene o lo quiere fichar: si pinta a titular y lo difícil que es el rival.
    // Una baja no juega: ni % ni rival. El % solo si es el de la app (en LaLiga, disponible o duda); se pide solo si el tweet puede salir.
    const conInfo = info && pp && !baja && (!registro || !registro.decidir || registro.decidir({ tipo: 'noticias', clave, jornada }) === 'ok');
    const tit = conInfo && ((c.fam === 'buena' && c.est === 'ok') || (c.fam === 'mala' && c.est === 'doubtful')) ? await info.titularidad(j, pp).catch(() => null) : null;
    const riv = conInfo ? await info.rival(pp).catch(() => null) : null;
    const inf = ideasInfo({ posId: j.positionId, equipo, pp, quien, media, tit, riv, tipo: c.fam === 'buena' ? 'vuelve' : 'duda', hr, k, dia, largo: esLargo() });
    // (Carlos, 5 nov 17:42: «no hace falta que haya tantos puntos») la noticia en una frase con el motivo entre paréntesis y, pegada con
    // una coma, de dónde sale (detrás de la cabecera o detrás del plazo, según el tweet; nunca detrás de la media o del %, que no son
    // del medio); luego, el jugador y el partido en dos frases (lib/info-jugador.mjs)
    // (sin repetir: «Arambarri arrastra molestias (molestias musculares)»)
    const pal1 = norm(motivo).split(' ')[0] || '';
    const cabM = motivo && !(pal1.length >= 5 && ` ${norm(cab)} `.includes(` ${pal1} `)) ? `${cab} (${motivo.replace(/^./, (x) => x.toLowerCase())})` : cab;
    const fu = { t: fuente.t, prio: 6 };
    const ideas = [leve ? { t: pegar('aunque es por precaución, no por una lesión'), prio: 6 } : null,
      fuente.arriba ? fu : null,
      plazo ? { t: `🗓️ ${cap(plazo)}`, prio: 7 } : null,
      fuente.arriba ? null : fu,
      ...inf.ideas,
      { t: etiqueta, prio: 9 }];
    const { usadas, texto } = tweet(cabM, ideas);
    if (!usadas.includes(etiqueta)) { log(`  (noticias) ${j.nickname}: no cabe la etiqueta`); continue; }
    // (Carlos, 4 nov 12:43: De Galarreta salió sin carta) una vuelta aún sin el alta en el juego lleva carta «VUELVE»
    const estadoCarta = c.fam === 'buena' ? (c.est === 'ok' ? 'disponible' : 'vuelve') : c.que === 'descartado' ? null : baja ? 'lesionado' : 'duda';
    const fila = { id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo, club: equipos[String(j.teamId)] || '', caraUrl: j.image || null,
      escudoUrl: escudos[String(j.teamId)] || null, estado: estadoCarta, leve: estadoCarta === 'duda' && leve, media, valor: Number(j.marketValue) || 0, pct: tit ? tit.pct : null };
    // los hechos para la IA que redacta (lib/redaccion.mjs): lo mismo que usa la plantilla, sin frases hechas
    const estadoH = c.fam === 'buena' ? (c.est === 'ok' ? 'disponible' : 'vuelve') : baja ? (c.que === 'lesion' ? 'lesionado' : 'baja') : 'duda';
    const hechos = { tipo: 'noticias', noticia: c.hecho || null, ...(leve ? { matiz: 'duda leve: es por precaución o gestión de cargas, no por una lesión' } : {}),
      fuente: fuenteH({ oficial: c.oficial, medios: c.medios }),
      jugadores: [jugador(j, { equipos, estado: estadoH, motivo: c.fam === 'mala' ? c.motivo : '', plazo: c.fam === 'mala' ? c.plazo : '', tit })],
      ...(pp ? { partido: partido(pp, { equipo, riv, posId: j.positionId, ahora }) } : {}), clubes: clubes(equipo, pp && pp.rival), etiqueta };
    out.push({ tipo: 'noticias', clave, jornada, texto, hechos, numeros: [...(media >= 3 ? partes(media) : []), ...(pp ? [pp.jornada] : [jornada]), ...c.nums, ...inf.numeros],
      tarjeta: estadoCarta ? tarjetaBajas({ jornada, filas: [fila], pp, clave }) : null });
  }
  return out;
}
