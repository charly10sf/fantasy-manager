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
export function sistemaCorto({ tono = 'broma', bloq = [], anuncio = false, alias = null } = {}) {
  return SISTEMA_CORTO.replace('{{CHISTES}}', CHISTES[tono === 'serio' ? 'serio' : 'broma']) + bloqueoTxt(bloq, !!anuncio) + (alias ? avisoAlias(!!alias.puesto, !!alias.ex) : '');
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
const lista = (x, n, f) => (Array.isArray(x) ? x.slice(0, n).map((y) => (y && typeof y === 'object' ? f(y) : null)).filter(Boolean) : []);
/** el plan corto con solo sus campos y cada texto con su tope; null si no trae ni pasos ni titular */
export function planLimpio(j) {
  if (!j || typeof j !== 'object') return null;
  const id = (y) => txt(y.id, 8);
  const P = {
    pasos: lista(j.pasos, 20, (y) => (id(y) ? { id: id(y), frase: txt(y.frase, 500) } : null)),
    quita: lista(j.quita, 20, (y) => (id(y) ? { id: id(y), motivo: txt(y.motivo, 300) } : null)),
    mete: lista(j.mete, 10, (y) => (id(y) ? { id: id(y), frase: txt(y.frase, 500) } : null)),
    situacion: txt(j.situacion, 600),
    noticias: lista(j.noticias, 6, (y) => ({ jugador: txt(y.jugador, 60), texto: txt(y.texto, 400), efecto: ['sube', 'baja', 'neutro'].includes(y.efecto) ? y.efecto : 'neutro' })),
    rivales: lista(j.rivales, 5, (y) => ({ manager: txt(y.manager, 60), texto: txt(y.texto, 400) })),
    titular: txt(j.titular, 200),
  };
  return P.pasos.length || P.titular ? P : null;
}
