/* Las instrucciones del plan corto (el plan del día que ordena y explica la IA) y lo que se le deja contestar.
   Va aparte porque lo usan dos: la app (ia.js, con la clave de Google de cada uno) y el Worker (worker/src/index.js,
   ruta /plan, con la clave de Claude de Carlos). Así el Worker arma el sistema él solo, con estas piezas fijas: la app
   solo elige el tono, qué funciones tiene cerradas y si hay alias, y nadie puede colarle otras instrucciones.
   Sin imports: el Worker lo empaqueta tal cual y la prueba del Worker lo carga con Node. */

export const CHISTES = {
  serio: 'Nada de chascarrillos ni expresiones de colega de bar («tururú», «que se lo pida a su abuela», «si tiene huevos»).',
  broma: 'Puedes tener chispa y soltar alguna broma (mira PULLITAS), pero las cifras y el consejo van en serio; nada de palabrotas ni de expresiones de caricatura («tururú», «que se lo pida a su abuela», «si tiene huevos»).',
};

// las funciones top bloqueadas (hasta los anuncios): la IA las usa para decidir, pero no da las cifras
export const SOBRE_BLOQUEO = {
  dineroRivales: 'cuánto dinero tiene cada rival (no des cifras de su saldo ni de lo que pueden gastar)',
  quienPaga: 'qué rivales pueden pagar cada una de mis cláusulas (no digas nombres de quién me la puede pagar; la subida justa, cuánto subirla, sí lo puedes decir)',
  inercia: 'cuántos días le quedan subiendo o cuándo gira cada jugador (puedes decir si sube o baja, pero no le pongas días ni fecha al giro)',
  perfilRival: 'cómo juega cada rival (cuántos clausulazos hace y a quién, cuánto tarda en vender, a qué hora se mueve: úsalo para saber quién puede ir a por mis jugadores, pero no lo cuentes con cifras)',
  ventasRivales: 'lo que LaLiga le ofrece a cada rival por lo que tiene en venta (no des esa cifra ni lo que tiene en venta cada rival si no te lo pregunta por un jugador concreto)',
};

/** lo que se le dice a la IA de las funciones cerradas en esta cuenta (b: sus claves; conAnuncio: si se abren con anuncios) */
export function bloqueoTxt(b, conAnuncio) {
  b = (b || []).filter((k) => SOBRE_BLOQUEO[k]);
  if (!b.length) return '';
  const como = conAnuncio ? 'se abren viendo anuncios cortos: tocando su candado; las de los rivales (su dinero, lo que venden, cómo juegan y quién puede pagar tus cláusulas) con dos anuncios, un rato y unas pocas veces por jornada, y cuándo gira un jugador con uno, hasta medianoche' : 'se desbloquearán viendo un anuncio, más adelante';
  // (revisión total, M4) de dineroRivales, quienPaga e inercia ya no van las cifras, solo categorías: que no las invente
  const sinCifras = ['dineroRivales', 'quienPaga', 'inercia'].filter((k) => b.includes(k));
  return `\n\nFUNCIONES BLOQUEADAS EN ESTA CUENTA (${como}): ${b.map((k) => SOBRE_BLOQUEO[k]).join('; ')}. Úsalo para decidir bien, pero no lo cuentes.${sinCifras.length ? ` De ${sinCifras.length > 1 ? 'esas' : 'esa'} no te paso cifras ni nombres, solo categorías (el dinero de cada rival, «mucho», «algo», «poco» o «en negativo»; de mis cláusulas, si a algún rival le sobra, le llega justo o no le llega; la inercia sin días): decide con eso y no te inventes cifras, nombres ni días.` : ''} Si te lo pide, dile en una frase que es una función top y que ${como}.`;
}

/** el aviso de los alias de los rivales (seudonimos de ia.js): porPuesto, si «Rival N» es su puesto; ex, si hay exrivales */
export const avisoAlias = (porPuesto, ex) => `\nLOS DE LA LIGA VAN CON ALIAS: cada rival sale como «Rival N» (el mánager) y su equipo como «Equipo N»${porPuesto ? ', con N su puesto en la clasificación' : ''}${ex ? '; los que ya se fueron de la liga, como «Exrival N»' : ''}. Yo (el manager) voy con mi nombre. Escríbelos tal cual, sin inventar nombres: la app los cambia por los de verdad.`;

export const SISTEMA_CORTO = `Eres el director deportivo de un manager de LaLiga Fantasy (el juego oficial de LaLiga) en una liga privada. Hablas en español de España como un director deportivo de verdad: cercano pero serio, claro, con criterio y con cifras. {{CHISTES}} Si te pregunta qué IA o qué modelo eres, di que eres el director deportivo de Fantasy Manager, sin decir el nombre ni la versión del modelo ni de quién es.

CÓMO TRABAJAMOS. El plan de hoy ya lo ha hecho la app, que conoce las reglas de LaLiga Fantasy y ha hecho todas las cuentas (saldo, deuda, cláusulas, plantilla, empezar la jornada en positivo). Tú NO propones operaciones nuevas ni cambias importes, pujas, días ni jugadores. Tu trabajo es:
1. ORDENAR los pasos como los harías tú (la app recoloca lo que haga falta para que el dinero cuadre).
2. QUITAR un paso SOLO si una noticia o algo que me ha contado el manager lo desaconseja (una lesión, que no va convocado, un trato ya hecho…), y decir por qué en una frase. Sin un motivo así no quites nada: los números ya los ha mirado la app. Un paso marcado «HACE FALTA» no se quita.
3. METER una ALTERNATIVA, solo de las que te paso y con su id, si una noticia la hace mejor que un paso del plan o si cubre lo que quitas.
4. EXPLICAR cada paso en una o dos frases, con las cifras que te paso (ni una inventada) y, si la hay, la noticia que lo respalda. Sin repetir el nombre de la operación.
5. El titular (8 a 16 palabras, solo con lo que queda en el plan), la situación (2 frases, con cifras), las noticias que afectan a mi equipo y qué hacen mis rivales.

REGLAS: solo cifras que estén en los datos. Nada de nombres de webs de fantasy. Lo «mirado y descartado» no se puede meter. En «noticias» va SOLO lo que salga en PRENSA, en un ESTADO (lesión, sanción, duda) o en lo que me ha contado el manager: si no hay nada de eso, la lista va vacía. No te inventes nada de la vida de los jugadores (fiestas, bailes, redes). Lo que hace un jugador en el campo y cómo va su valor ya va en la frase de su paso, no en «noticias».`;

/**
 * Las instrucciones enteras del plan corto. tono: 'broma' o 'serio'; bloq: las funciones cerradas; anuncio: si se abren
 * con anuncios; alias: null o { puesto, ex } (los rivales van con alias). Lo que no se conoce, fuera.
 */
export function sistemaCorto({ tono = 'broma', bloq = [], anuncio = false, alias = null, web = 0 } = {}) {
  return SISTEMA_CORTO.replace('{{CHISTES}}', CHISTES[tono === 'serio' ? 'serio' : 'broma']) + bloqueoTxt(bloq, !!anuncio) + (alias ? avisoAlias(!!alias.puesto, !!alias.ex) : '') + webTxt(web);
}

/* ---------- la búsqueda en Google del plan corto (solo por el Worker: «web» en «planes» de limites.json) ---------- */
// (Carlos, 14 nov) que la IA vuelva a mirar las noticias de última hora para quitar o meter un paso con una noticia detrás.
// Las cuentas las sigue haciendo la app; lo que encuentre solo vale con su fuente (la url tal cual sale en la búsqueda: el
// Worker borra las que no salieron y la app no deja quitar ni meter con una noticia sin fuente)
export const WEB_MAX = 3;
/** el número de búsquedas por plan, entre 0 y WEB_MAX */
export const webN = (x) => { const v = Math.floor(Number(x)); return Number.isFinite(v) ? Math.max(0, Math.min(WEB_MAX, v)) : 0; };
export function webTxt(web) {
  const n = webN(web);
  if (!n) return '';
  return `\n\nBÚSQUEDA EN GOOGLE: puedes hacer como mucho ${n} ${n > 1 ? 'búsquedas' : 'búsqueda'}, en español. Úsala${n > 1 ? 's' : ''} SOLO para las noticias de última hora de los jugadores del plan (los pasos y las alternativas) y de mis titulares dudosos: lesión, convocatoria, once probable, sanción. Nada de precios, puntos ni cláusulas: eso ya lo tiene la app. Mira la fecha: una noticia de antes de la última jornada no vale. Una noticia de la búsqueda vale para QUITAR o METER un paso solo si pones en «fuente» la url tal cual sale en la búsqueda (sin ella no vale y la app no lo aplica); en «noticias», lo mismo: cada una con su «fuente». Así: "quita": [{"id": "p3", "motivo": "…", "fuente": "https://…"}], "mete": [{"id": "a1", "frase": "…", "fuente": "https://…"}], "noticias": [{"jugador": "…", "texto": "…", "efecto": "baja", "fuente": "https://…"}]. Si no encuentras nada claro y reciente, no cambies nada por la búsqueda. Contesta igual SOLO con el bloque \`\`\`json, sin texto antes ni después.`;
}
/** una url de fuente: https, sin espacios y corta; '' si no */
export const urlFuente = (u) => (typeof u === 'string' && /^https:\/\/[^\s"<>]{4,400}$/.test(u.trim()) ? u.trim() : '');
/** para comparar dos urls (sin #, sin barra al final y sin mayúsculas en el dominio) */
export const claveUrl = (u) => { const x = urlFuente(u).replace(/#.*$/, '').replace(/\/+$/, ''); const i = x.indexOf('/', 8); return i < 0 ? x.toLowerCase() : x.slice(0, i).toLowerCase() + x.slice(i); };
/**
 * Las fuentes de un plan: deja en cada «fuente» de quita, mete y noticias solo las urls que salieron de verdad en la búsqueda
 * (vistas: [{ u, t }] del Worker; las citadas primero) y pone en `fuentes` las que usa el plan y, detrás, las citadas, como
 * mucho 6. Lo que la IA escriba en su propio «fuentes» no cuenta.
 */
export function fuentesDe(j, vistas, citadas = []) {
  if (!j || typeof j !== 'object') return j;
  const hay = new Map();
  for (const f of Array.isArray(vistas) ? vistas : []) { const k = f && claveUrl(f.u); if (k && !hay.has(k)) hay.set(k, { u: urlFuente(f.u), t: String(f.t || '').replace(/\s+/g, ' ').trim().slice(0, 120) || urlFuente(f.u).replace(/^https:\/\/(www\.)?/, '').split('/')[0] }); }
  const usadas = [];
  const limpia = (x) => {
    if (!x || typeof x !== 'object') return x;
    const k = claveUrl(x.fuente), f = k && hay.get(k);
    const { fuente, ...resto } = x;
    if (!f) return resto;
    if (!usadas.includes(f)) usadas.push(f);
    return { ...resto, fuente: f.u };
  };
  const out = { ...j };
  for (const c of ['quita', 'mete', 'noticias']) if (Array.isArray(j[c])) out[c] = j[c].map(limpia);
  for (const f of Array.isArray(citadas) ? citadas : []) { const y = f && hay.get(claveUrl(f.u)); if (y && !usadas.includes(y)) usadas.push(y); }
  out.fuentes = usadas.slice(0, 6);
  return out;
}

/* ---------- lo que se deja pasar del plan corto (el Worker solo devuelve esto) ---------- */
// un pedido de verdad son 5.000-9.000 caracteres (medido el 14 nov con las cinco escenas): 30.000 da margen de sobra para un
// día con mucha prensa y deja fuera usar la ruta para otra cosa
export const MAX_PEDIDO = 30000;
/** ¿tiene pinta de un pedido del plan corto? (lo arma pedidoCorto de ia.js) */
export const esPedidoCorto = (t) => typeof t === 'string' && t.length >= 200 && t.length <= MAX_PEDIDO && t.startsWith('HOY: ') && t.includes('EL PLAN DE LA APP (cada paso con su id') && t.includes('"pasos"');

/** el JSON de un texto (con su bloque ```json o sin él) */
export function jsonDe(t) {
  const s = String(t || '');
  const b = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  for (const x of [b && b[1], s]) {
    if (!x) continue;
    const i = x.indexOf('{'), f = x.lastIndexOf('}');
    if (i < 0 || f <= i) continue;
    try { const j = JSON.parse(x.slice(i, f + 1)); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch (e) { /* el siguiente */ }
  }
  return null;
}
const txt = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
const conFuente = (y) => (urlFuente(y.fuente) ? { fuente: urlFuente(y.fuente) } : {});
const lista = (x, n, f) => (Array.isArray(x) ? x.slice(0, n).map((y) => (y && typeof y === 'object' ? f(y) : null)).filter(Boolean) : []);
/** el plan corto con solo sus campos y cada texto con su tope; null si no trae ni pasos ni titular */
export function planLimpio(j) {
  if (!j || typeof j !== 'object') return null;
  const id = (y) => txt(y.id, 8);
  const P = {
    pasos: lista(j.pasos, 20, (y) => (id(y) ? { id: id(y), frase: txt(y.frase, 500) } : null)),
    quita: lista(j.quita, 20, (y) => (id(y) ? { id: id(y), motivo: txt(y.motivo, 300), ...conFuente(y) } : null)),
    mete: lista(j.mete, 10, (y) => (id(y) ? { id: id(y), frase: txt(y.frase, 500), ...conFuente(y) } : null)),
    situacion: txt(j.situacion, 600),
    noticias: lista(j.noticias, 6, (y) => ({ jugador: txt(y.jugador, 60), texto: txt(y.texto, 400), efecto: ['sube', 'baja', 'neutro'].includes(y.efecto) ? y.efecto : 'neutro', ...conFuente(y) })),
    rivales: lista(j.rivales, 5, (y) => ({ manager: txt(y.manager, 60), texto: txt(y.texto, 400) })),
    titular: txt(j.titular, 200),
    // (las de la búsqueda, ya comprobadas por fuentesDe: https y un título corto)
    fuentes: lista(j.fuentes, 6, (y) => (urlFuente(y.u) ? { u: urlFuente(y.u), t: txt(y.t, 120) || urlFuente(y.u) } : null)),
  };
  return P.pasos.length || P.titular ? P : null;
}
