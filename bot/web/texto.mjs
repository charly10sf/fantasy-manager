// El texto de la previa de la web: Claude escribe unas líneas de análisis por apartado a partir de los hechos (web/hechos.mjs), un
// validador de código mira que cada cifra y cada jugador salgan de los hechos, y el revisor (otra pregunta a Claude) lo lee entero.
// El apartado que no pasa después de un segundo intento sale sin análisis, solo con los datos: nunca con algo inventado.
// Va con la clave del bot (ANTHROPIC_API_KEY) y su cuenta de gasto (lib/ia.mjs), con un tope propio por previa.
import { preguntarJson as claudeJson, SONNET, coste } from '../lib/claude.mjs';
import { norm } from '../lib/texto.mjs';
import { vista, APARTADOS } from './vista.mjs';

const REGLAS = 'Reglas del juego que se pueden usar aunque no estén en los hechos: desde 24 horas antes del primer partido de la jornada nadie puede pagar una cláusula, y se reabren cuando empieza ese partido; una cláusula solo se paga con saldo, no con deuda; empezar la jornada con el saldo en negativo deja sin puntos toda la jornada; con 5 amarillas se cumple un partido de sanción; el valor de mercado cambia cada noche, hacia las 00:15. Una racha de subidas no garantiza que siga.';

const SISTEMA = `Escribes el análisis de la previa de una jornada de LaLiga Fantasy para la web de Fantasy Manager. Lo lee un mánager que quiere saber qué hacer antes del cierre de cláusulas.

Reglas:
- Solo lo que viene en los HECHOS. Nada de lesiones, rivales, rachas, formas de jugar o cifras que no estén. Si un dato no está, no lo supongas ni lo menciones.
- Las cifras se copian tal cual vienen escritas en los hechos («132,2 M», «17,2 %», «21:00», «jornada 14»). No hagas cuentas nuevas ni redondees a otra cosa.
- Cada apartado lleva de 2 a 4 frases (5 como mucho si hay muchos jugadores) y no pasa de 700 caracteres. Di qué significa para quien juega: a quién vender, aguantar o no fichar, qué vigilar y cuándo moverse. Con nombres, en concreto.
- Debajo de cada apartado la página ya lleva una tabla con todos los datos: no los enumeres. Elige a uno, dos o tres jugadores que importen y cuenta qué significa para quien juega. Una frase como «Le siguen X (+18,0 M, +27,4 %, 10 días), Y (…)» es volcar la tabla: prohibido. Como mucho dos cifras por frase.
- Prosa normal, castellano de España, cercano pero serio. Nada de frases hechas («poner en el punto de mira», «echar a rodar», «piezas clave», «cupo de titularidad»). Sin listas, negritas, emojis ni guiones largos. Frases de longitud variada.
- Cada apartado empieza de forma distinta y no repite la estructura de otro. Prohibido: «cabe destacar», «es importante», «en resumen», «sin duda», «no solo… sino también», «a tener en cuenta», «ojo al dato», frases de cierre genéricas y exageraciones.
- No nombres webs, medios, fuentes ni «expertos». No hables de inteligencia artificial.
- ${REGLAS}
- Un sancionado no juega esta jornada. Un apercibido sí juega, pero si ve una amarilla se pierde la siguiente.
- Si un jugador sale en dos apartados (apercibido y duda, por ejemplo), dilo una vez y bien.`;

const ESQUEMA = (claves) => ({ type: 'OBJECT', properties: Object.fromEntries(claves.map((k) => [k, { type: 'STRING' }])), required: claves });

const REVISOR = `Revisas el análisis de la previa de una jornada de LaLiga Fantasy antes de publicarlo en una web. Tienes los HECHOS (lo único que se sabe) y el TEXTO de cada apartado.

${REGLAS} La reapertura de cláusulas es a la hora del primer partido de la jornada (viene en los hechos).

Marca un apartado como no publicable solo si pasa algo grave de esto:
- dice algo que no está en los hechos o lo contradice (una lesión, un rival, una cifra, un equipo o un estado cambiados o inventados);
- da un consejo que los datos no sostienen o que es peligroso para quien juega (por ejemplo, fichar a un sancionado para esta jornada);
- suena a plantilla o a texto automático, o repite la estructura de otro apartado;
- nombra webs, fuentes o «expertos».
Si solo es mejorable o es cuestión de estilo, es publicable. Si dudas, es publicable: marca solo errores de hecho claros, comparando con los hechos palabra por palabra antes de decidir. Devuelve cada apartado con ok y, si no está bien, el motivo en una frase.`;

const ESQUEMA_REV = (claves) => ({ type: 'OBJECT', properties: Object.fromEntries(claves.map((k) => [k, { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' }, motivo: { type: 'STRING' } }, required: ['ok', 'motivo'] }])), required: claves });

const MALAS = /cabe destacar|es importante|en resumen|en conclusi[oó]n|sin duda|no solo .{1,60} sino|a tener en cuenta|ojo al dato|expertos?|futbolfantasy|comuniate|biwenger|analitica fantasy|anal[ií]tica fantasy|jornada perfecta|sofascore|understat|marca\.com|\bas\.com|inteligencia artificial|\bIA\b|—/i;

/** las cifras de un texto: «132,2», «21:00», «17,2», «13»… (los años y las horas van enteros) */
const cifras = (s) => (String(s).match(/\d+(?:[.,:]\d+)*/g) || []).map((x) => x.replace(/\.(?=\d{3}\b)/g, ''));

/**
 * Comprueba un apartado: cifras que salen de los hechos (o pequeñas: 0 a 10), jugadores que salen en los hechos, frases de las que
 * se notan y largo. Devuelve '' si vale o el motivo.
 */
export function validar(texto, { permitidas, nombresHechos, nombresLiga }) {
  const t = String(texto || '').trim();
  if (!t) return 'vacío';
  if (t.length > 1000) return `demasiado largo (${t.length} caracteres)`;
  const frases = t.replace(/(^|[\s(])([A-ZÁÉÍÓÚÑ])\.\s/g, '$1$2· ').split(/(?<=[.!?])\s+/).filter(Boolean).length;
  if (frases > 6) return `${frases} frases`;
  const m = t.match(MALAS);
  if (m) return `frase prohibida: «${m[0]}»`;
  for (const c of cifras(t)) {
    if (/^\d+$/.test(c) && Number(c) <= 10) continue;
    if (!permitidas.has(c)) return `cifra que no sale de los hechos: ${c}`;
  }
  // un jugador de LaLiga que no está en los hechos (solo con mayúscula, para no confundir apodos que son palabras corrientes)
  const tn = ` ${norm(t)} `;
  for (const [n, original] of nombresLiga) {
    if (n.length < 4 || nombresHechos.has(n)) continue;
    if (tn.includes(` ${n} `) && new RegExp(`(^|[^\\p{L}])${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(t)) return `jugador que no sale en los hechos: ${original}`;
  }
  return '';
}

/** las cifras que se pueden escribir: las que aparecen escritas en la vista de los hechos */
export function permitidasDe(v) {
  const s = new Set(cifras(JSON.stringify(v)));
  for (const x of ['00:15', '24', '5']) s.add(x);   // los de las reglas del juego que se le dan a quien redacta
  return s;
}

/**
 * Escribe y revisa. `claude` para las pruebas. Devuelve { textos: {clave: texto|null}, fallos: {clave: motivo}, dolares, ok }.
 * ok: como mucho dos apartados se han quedado sin análisis.
 */
export async function escribir(h, { nombresLiga = [], clave = process.env.ANTHROPIC_API_KEY, claude = claudeJson, log = () => {}, topeDolares = 0.6 } = {}) {
  const v = vista(h);
  const claves = APARTADOS.filter((k) => k === 'intro' || k === 'clausulas' || (v[k] && (Array.isArray(v[k].lista) ? v[k].lista.length : true)));
  const permitidas = permitidasDe(v);
  const nombresHechos = new Set(JSON.stringify(v).match(/"nombre":"([^"]+)"/g).map((x) => norm(x.slice(10, -1))));
  const liga = nombresLiga.map((n) => [norm(n), n]);
  const ctx = { permitidas, nombresHechos, nombresLiga: liga };
  let dolares = 0;
  const pedir = async (sistema, prompt, esquema, maxTokens, pensar = false) => {
    if (dolares >= topeDolares) throw new Error(`tope de ${topeDolares} $ para la previa`);
    const r = await claude({ clave, sistema, prompt, esquema, modelo: SONNET, maxTokens, esfuerzo: 'medium', pensar, tiempo: 90000, hasta: Date.now() + 200000, log });
    dolares += r.dolares ?? (r.uso ? coste(SONNET, r.uso) : 0);
    if (!r.ok) throw new Error(r.error || 'sin respuesta');
    return r.datos || r.json || r.respuesta;
  };
  const hechosTxt = JSON.stringify(v, null, 1);
  const textos = {}, fallos = {};
  let pendientes = claves, avisos = {};
  for (let vuelta = 0; vuelta < 2 && pendientes.length; vuelta++) {
    const extra = vuelta ? `\n\nEn el intento anterior estos apartados no valían. Reescríbelos teniendo en cuenta el motivo:\n${pendientes.map((k) => `- ${k}: ${avisos[k]}`).join('\n')}` : '';
    let r;
    try { r = await pedir(SISTEMA, `HECHOS de la jornada ${h.jornada}:\n${hechosTxt}\n\nEscribe estos apartados: ${pendientes.join(', ')}. Qué va en cada uno:\n${pendientes.map((k) => `- ${k}: ${QUE[k]}`).join('\n')}${extra}`, ESQUEMA(pendientes), 2500); }
    catch (e) { log(`  (previa web) redactar: ${e.message}`); break; }
    const candidatos = {};
    for (const k of pendientes) {
      const t = String((r && r[k]) || '').trim();
      const mal = validar(t, ctx);
      if (mal) { avisos[k] = mal; log(`  (previa web) ${k}: ${mal}`); } else candidatos[k] = t;
    }
    const aRevisar = Object.keys(candidatos);
    if (aRevisar.length) {
      let rev = null;
      try { rev = await pedir(REVISOR, `HECHOS:\n${hechosTxt}\n\nTEXTO:\n${aRevisar.map((k) => `[${k}]\n${candidatos[k]}`).join('\n\n')}`, ESQUEMA_REV(aRevisar), 4000, true); }
      catch (e) { log(`  (previa web) revisor: ${e.message}`); }
      for (const k of aRevisar) {
        const x = rev && rev[k];
        if (x && x.ok) textos[k] = candidatos[k];
        else { avisos[k] = x ? `el revisor: ${x.motivo}` : 'sin revisar'; log(`  (previa web) ${k}: ${avisos[k]}`); }
      }
    }
    pendientes = pendientes.filter((k) => !(k in textos));
  }
  for (const k of claves) if (!(k in textos)) { textos[k] = null; fallos[k] = avisos[k] || 'sin texto'; }
  const sinAnalisis = Object.keys(fallos).length;
  return { textos, fallos, dolares: Math.round(dolares * 1e4) / 1e4, ok: sinAnalisis <= 2 };
}

/** qué va en cada apartado (para quien redacta) */
export const QUE = {
  intro: 'una o dos frases de entrada: qué jornada es, cuándo empieza y lo más importante de esta semana para quien juega (sin repetir lo de los apartados al detalle).',
  clausulas: 'el cierre y la reapertura de cláusulas con sus horas, cuántos cambios de mercado quedan antes del cierre y qué conviene hacer antes (proteger, clausular, cuadrar el saldo).',
  sancionados: 'quién no juega por sanción y qué hacer si lo tienes (con su media y su valor si ayudan).',
  apercibidos: 'quién está a una amarilla y qué partido de la jornada siguiente se perdería; si compensa alinearlo igual.',
  bajas: 'las bajas y dudas que más pesan, con lo que dice el parte y la vuelta prevista si viene; vender o aguantar.',
  vuelven: 'quién vuelve tras una lesión larga y si conviene mirarlo en el mercado o esperar.',
  mercado: 'los que más suben y más bajan en los últimos 7 días, la racha de días seguidos y qué leer de ello (sin prometer que siga).',
};
