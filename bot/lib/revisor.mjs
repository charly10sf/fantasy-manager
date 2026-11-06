// El revisor: una segunda lectura con IA de cada tuit redactado (lib/redaccion.mjs) o pulido (lib/pulir.mjs), ANTES de publicarlo.
//
// Por qué (Carlos, 7 nov: «hoy he tenido que borrar y editar bastantes tweets porque no tenían sentido, tenían cosas erróneas o se notaba
// que estaba hecho con una IA mal»): el validador de código (redaccion.mjs, `revisar`) para nombres, cifras, estados, medios y sucesos,
// pero no lo que solo se ve leyendo: una comparación que no sale de ningún dato («es de los porteros que mejor han rentado esta jornada»
// con un solo partido jugado), una frase que se contradice («partido asequible… eso sí, de los que menos encajan»), una que no se entiende
// a la primera («16º clasificado en un duelo asequible ante uno de los rivales que más encajan») o una frase de relleno que delata a la IA
// («es de los que sostienen una plantilla»). El revisor lee el tuit con los hechos al lado, como un editor exigente, y dice si se puede
// publicar; si no, por qué, frase a frase, y la redacción lo vuelve a intentar con eso.
//
// Con Claude (lib/ia.mjs, uso «revisar»). Si no hay Claude o no contesta, el tuit sigue (ya ha pasado el validador de código): el revisor
// suma, nunca bloquea por estar caído.
import { preguntar, conClaude } from './ia.mjs';

const ESQUEMA = {
  type: 'OBJECT', required: ['publicable', 'problemas'],
  properties: {
    publicable: { type: 'BOOLEAN' },
    problemas: { type: 'ARRAY', items: { type: 'OBJECT', required: ['frase', 'motivo'], properties: { frase: { type: 'STRING' }, motivo: { type: 'STRING' } } } },
  },
};

export const SISTEMA = `Eres el editor de @Fantasyman_app, una cuenta de X sobre LaLiga Fantasy que lee gente de España que juega cada semana. Antes de publicar, lees cada tuit con los datos de los que sale y decides si sale tal cual o no. Eres exigente: un tuit con un dato falso, una frase que no se entiende o que suena a máquina hace que la cuenta pierda credibilidad, y el dueño los está borrando a mano.

Un tuit NO se publica si tiene cualquiera de estas cosas:

1. ALGO QUE NO SALE DE LOS DATOS. Cada afirmación tiene que poder señalarse en los datos que te paso. Marca:
   - comparaciones o superlativos sin base: «de los mejores de la jornada», «de los porteros que más puntúan», «el mejor partido de su temporada», «de los que sostienen una plantilla», cuando los datos no traen esa comparación. Si los datos son de un solo partido, no se sabe nada del resto de la jornada;
   - contexto inventado: rachas, historia, ascensos, derbis, el entrenador, motivos, lesiones, sensaciones del partido («muy igualado», «dominó», «salvó al equipo») que no vienen;
   - una cifra puesta a quien no es, o distinta de la de los datos;
   - un suceso del partido (gol, penalti, parada, roja, VAR) que no viene en los datos.
   Una valoración para el mánager («si lo tienes, al once», «mejor esperar a los onces», «puede salir barato», «buena jornada para quien lo tenga») sí vale si se sigue de los datos; una predicción como si fuera un hecho, no.
   Lo que viene en PRENSA (si te la paso) también es un dato, pero solo con su medio pegado («según AS…») y solo en noticias y previas.
   Las cifras dichas con palabras valen si cuadran a grandes rasgos con esta escala de la cuenta (es orientativa: no marques un matiz cerca del límite, solo lo que esté claramente mal, como llamar «fijo» a uno con un 40 %): titularidad de 75 % o más, «fijo», «juega», «seguro»; de 50 a 74, «lo normal es que salga»; de 30 a 49, «en el aire», «duda»; menos de 30, «lo tiene difícil». Una media de puntos alta (7 o más), «de los que más puntos dan». Los puntos de hoy frente a su media: lo que diga «hoyFrenteASuMedia» si viene. Una lectura razonable de la tabla también vale («el 4º parte como favorito ante el 17º»). Las etiquetas de los datos («papel», «alcance», «horario», «cruce», «dificultad», «valoracion») son datos.

2. ALGO QUE SE CONTRADICE O ESTÁ AL REVÉS. Por ejemplo: «partido asequible» y a la vez «eso sí, el rival es de los que menos encajan» sin explicar; «lesión» y «no está descartado» en frases sueltas; quién juega en casa y quién fuera cambiado; leer al revés los goles del rival (a un portero o defensa le viene mal que el rival marque mucho; a un medio o delantero le viene bien que el rival encaje mucho).

3. UNA FRASE QUE NO SE ENTIENDE A LA PRIMERA. Leída una vez en el móvil: sujeto claro, un dato o dos por frase, sin datos amontonados («16º clasificado en un duelo asequible ante uno de los rivales que más encajan, con 2,6 goles por encuentro»), sin «el equipo», «el rival», «el conjunto» o «enfrente» cuando no está claro de quién se habla, sin frases a medias.

4. QUE SUENE A IA, A TRADUCCIÓN O A PLANTILLA. Un aficionado de España que escribe bien no diría: frases de relleno sin información o grandilocuentes («deja su sello», «firma una actuación», «una noche para el recuerdo», «es de los que sostienen una plantilla»), castellano raro o calcado del inglés, «16º clasificado», «promedia», «el encuentro», «duelo» a cada rato, «conjunto + gentilicio», cierres moralizantes o de anuncio, telegrama de frases de tres palabras, enumerar datos sin decir qué significan. Una expresión normal del fútbol («la noche fue de Sivera», «se salva», «no se toca») NO es un problema.

5. UN DATO CONTADO A MEDIAS QUE LLEVA A ERROR (un porcentaje suelto sin decir de qué, una media sin decir que es de puntos si no se entiende).

Marca solo lo GRAVE, lo que un lector notaría como falso, contradictorio, incomprensible o hecho por una máquina. No marques gustos ni matices: si una frase es verdad, se entiende y suena natural, no la toques aunque tú la escribirías de otra forma. No pidas añadir datos. Si dudas, es publicable. La etiqueta final del tuit (✅ Disponible…, ❌ Baja…, «Fantasy Manager · enlace en la bio») la pone el sistema: no la juzgues.

Devuelve publicable (true o false). Si es true, problemas va vacío: no apuntes lo que está bien. Si es false, cada problema grave con la frase exacta del tuit (o el trozo) y el motivo en una línea, dicho para que quien lo reescriba sepa qué cambiar.`;

const sinFecha = (k, v) => (k === 'fecha' || k === 'etiqueta' ? undefined : v);

export function prompt({ texto, hechos = null, fuenteTexto = '', tipo = '', cronicas = [] }) {
  return [
    `Tuit de tipo «${tipo || (hechos && hechos.tipo) || '?'}».`,
    hechos ? `DATOS (lo único que se sabe):\n${JSON.stringify(hechos, sinFecha, 1)}` : '',
    cronicas.length ? `PRENSA (también vale, con el medio pegado al hecho):\n${cronicas.map((c) => `- ${c.medio}: ${c.titulo}. ${c.entradilla || ''}`).join('\n')}` : '',
    fuenteTexto ? `DATOS (el texto de partida, sacado de los datos; lo único que se sabe):\n"""${fuenteTexto}"""` : '',
    `TUIT:\n"""${texto}"""`,
  ].filter(Boolean).join('\n\n');
}

/**
 * Lee un tuit con sus datos. Devuelve { ok, problemas: ['«frase»: motivo'], revisado: bool, modelo }.
 * `hechos` (redactados) o `fuenteTexto` (pulidos: la plantilla). Sin Claude o si no contesta: { ok: true, revisado: false }.
 */
export async function revisarConIA({ texto, hechos = null, fuenteTexto = '', tipo = '', cronicas = [], registro = null, config = {}, log = () => {}, pedir = preguntar }) {
  if ((config.revisor || {}).activo === false) return { ok: true, problemas: [], revisado: false };
  if (pedir === preguntar && !conClaude(config)) return { ok: true, problemas: [], revisado: false };
  const r = await pedir({ uso: 'revisar', registro, config, sistema: SISTEMA, cache: true, esquema: ESQUEMA, log,
    prompt: prompt({ texto, hechos, fuenteTexto, tipo, cronicas }), tiempo: 30000, hasta: Date.now() + ((config.revisor || {}).segundos ?? 40) * 1000 });
  if (!r.ok || !r.datos) { log(`  (revisor) no contesta (${r.error || 'sin datos'}): sigue sin revisar`); return { ok: true, problemas: [], revisado: false }; }
  const problemas = (Array.isArray(r.datos.problemas) ? r.datos.problemas : [])
    .map((p) => (p && typeof p === 'object' ? `«${String(p.frase || '').slice(0, 140)}»: ${String(p.motivo || '').slice(0, 220)}` : String(p)))
    .filter((p) => p.length > 6);
  // manda el «publicable»: si lo da por bueno, lo que apunte de más no bloquea (el 7 nov listaba hasta lo que estaba bien)
  const ok = r.datos.publicable === true;
  return { ok, problemas: ok ? [] : (problemas.length ? problemas : ['el editor no lo publicaría (sin motivo concreto): reescríbelo más claro y solo con los datos']), revisado: true, modelo: r.modelo };
}
