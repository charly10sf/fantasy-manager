# Revisión a fondo de la IA (plan del día y chat) — 13-14 nov 2026

Pedida por Carlos el 13 nov («no quiero más parches: quiero que deje de fallar por sistema»). Versión: 0.7.9.

> **14 nov, de madrugada: el motor del plan y el plan corto.** Hecho y probado en la rama `web-motor-plan`, SIN PUBLICAR
> (falta el OK de Carlos). Está al final: «El motor del plan y el plan corto».

## El resultado, en números

| Medida | Antes (0.7.8h) | Después (0.7.9) |
|---|---|---|
| Casos sin red (la IA «contesta» el fallo real y la app tiene que pararlo): 41 | 22 bien | 41 bien |
| — de ellos, el plan (17) | 15 | 17 |
| — de ellos, el chat (24) | 7 | 24 |
| Casos con la IA de verdad (31: 26 de chat y 5 planes), una pasada | 28 bien | 31 bien |
| — el chat, lo que dice la IA sola, sin que la app revise (26) | 24 | 26 |
| Lo que lee la IA en una pregunta del chat | ~30.900 tokens | ~18.700 (−39 %) |
| Lo que lee para un plan | ~52.600 tokens | ~36.400 (−31 %) |
| Instrucciones fijas (el «sistema») | 23.900 caracteres | 9.300 |

Con qué se midió la IA de verdad: el modelo ligero (gemini-3.5-flash-lite), porque la clave de pruebas ya había gastado el
cupo del día de los tres mejores (dan unas 20 preguntas al día cada uno). Es el peor caso: lo que le toca a un usuario
que ha gastado su cupo. Es UNA pasada por caso: 28 → 31 dice que va mejor, no que no vaya a fallar nunca. Lo que sí es
firme es lo de sin red: esos 41 fallos, si la IA los repite, la app los para.

## Catálogo de fallos, por causa

Sale de los comentarios «aviso de Carlos/Domy» del código (ia.js 19, motor.js 9, operaciones.js 2), del historial y de
los 40 avisos de Fallo (14 hablan de recomendaciones).

1. **La app no revisaba el chat.** En el plan, `cuadrarPlan` comprobaba cada paso; en el chat salía tal cual lo que
   dijera la IA. De ahí: «pactasteis» y «te pide 43,5 M» (Pepelu, 13 nov), sumas mal («107 + 35 = 75», 7 nov), horquillas
   que cambiaban de un mensaje a otro («33-35 M» y luego «26 M»), el escudo a una hora inventada (7 nov), repetir el plan
   en cada respuesta. Era la causa de 17 de los 19 casos que fallaban sin red.
2. **La IA elegía entre cosas que la app iba a tachar.** El catálogo le ofrecía 14 cláusulas con su ficha entera y la
   app descartaba después casi todas (en la liga de ejemplo, 60 de las 61 cláusulas). De ahí los «Descartado por la app» y el titular
   que mandaba lo contrario de lo que había debajo (Fornals, 13 nov; Oyarzabal, Ibañez y Javi Guerra, 3 nov; Huijsen, 9
   nov; De Jong).
3. **Reglas de LaLiga mal explicadas o que se contradecían en el prompt.**
   - «Un jugador de un rival que no está a la venta NO se puede comprar» y, tres párrafos después, «se cierra haciéndole
     una oferta directa desde la ficha». La buena (Carlos, 13 nov): se le puede ofertar siempre; decide él.
   - «Lo que pide» para el precio que un rival pone en el mercado (no pide nada a nadie: es el mínimo para ofertar).
   - Las mismas reglas repetidas en cuatro sitios con palabras distintas (la cláusula con saldo, el cierre de 24 h, el
     blindaje), y 24.000 caracteres de «cómo calcular» que la IA aplicaba a medias.
4. **Cuentas que hacía la IA y tenía que hacer el motor.** Cuándo vender (cinco casos en orden), cuánto es pagar de
   más, la salida de un clausulazo, la puja, la subida de cláusula: todo estaba escrito en el prompt y, además, en
   `cuadrarPlan`. Dos sitios para la misma regla: cuando no coincidían, salía el fallo.
5. **Datos que no le llegaban o le llegaban mal.** El parón en una línea (7 y 9 nov), la cláusula de los suyos en el
   chat (7 nov), el once cerrado con la jornada en juego (Domy, 31 oct), el rival en la alineación (Domy, 30 oct), lo
   que pagó por cada jugador (Domy, 23-25 oct). Arreglados antes, uno a uno; ahora, además, cada jugador suyo lleva lo
   que haría la app si lo vende.
6. **La memoria del chat (las notas).** Apuntaba decisiones que él no había tomado («rechazó el trueque», 7 nov) y
   precios que él no había dicho (13 nov). Ya estaba acotado (`notaValida`, sin cifra suya no hay importe); se queda.
7. **Fallos de la propia app al revisar.** El «Ojo: ya no es tuyo» sin venir a cuento (13 nov), el titular que
   nombraba un blindaje que la app había quitado, el paso de alinear que nombraba a uno que no era suyo, y la regla de
   no vender lo que sube, que no saltaba al «poner a la venta» si tenía pujas hechas (eso último es correcto: con las
   pujas ganadas el dinero sí haría falta; el caso de prueba se hizo con saldo de sobra).

## Las reglas de LaLiga Fantasy en las que se basa todo

Comprobadas con Carlos (las cuatro primeras, el 13 nov; el resto, de antes):

1. A un jugador de un rival que NO está a la venta se le puede hacer una oferta desde su ficha. Decide el dueño.
2. Tras CUALQUIER fichaje (mercado, clausulazo o compra a otro mánager), 14 días con la cláusula cerrada.
3. La oferta de LaLiga por lo que pones a la venta llega en el SIGUIENTE cambio de mercado, y hay una nueva en cada uno.
4. El tope de deuda (20 % del valor del equipo) cuenta la SUMA de todas las pujas abiertas.
5. Una cláusula solo se paga con saldo: ni con deuda ni con lo que está en venta sin aceptar.
6. Por debajo del precio que un rival pone en el mercado no se puede ofertar (13 nov).
7. Nadie clausula en las 24 h antes del primer partido de la jornada; se reabren a esa hora.
8. El once se cierra con el primer partido de la jornada.
9. Blindaje: 2 por jornada, 24 h (48 h en Premium), solo con la cláusula ya abierta.
10. Empezar una jornada en negativo es no puntuar.
11. Un cambio entre mánagers son dos compras, cada una a su precio.
12. Plantilla: 25 como mucho. Versión gratis: sin entrenador y con las formaciones gratis.
13. Si el valor pasa la cláusula, LaLiga la sube sola. Subirla pagando: pagar X la sube 2X.

14. Al vender, el dinero entra en el momento (Carlos, 13 nov, 23:37).
15. Los dos blindajes de cada jornada se ponen cuando uno quiera dentro de ella, también en las 24 h de cierre (Carlos,
    13 nov, 23:37; lo de «solo con la cláusula ya abierta» es de antes, del 7 nov, y sigue valiendo).

16. Cada punto de la jornada son 100.000 €: con 64 puntos, LaLiga paga 6,4 M al acabarla (Carlos, 14 nov, 10:58).
17. Con 25 jugadores no se puede pujar por nadie más (Carlos, 14 nov).
18. Uno alineado que se vende ANTES del primer partido de la jornada no cuenta para ella. Vendido con la jornada ya
    empezada (a las 21:01 de un viernes con partido a las 21:00), cuenta para toda la jornada (Carlos, 14 nov).
19. Una puja se puede retirar cuando se quiera (Carlos, 14 nov).

Ya no queda ninguna regla sin comprobar de las que usa la app.

## La arquitectura: la app decide, la IA elige y explica, la app revisa

- **Antes de preguntar (`veredictos`, ia.js).** Cada operación posible de hoy pasa, una a una, por el mismo
  `cuadrarPlan` que luego revisa la respuesta (14-19 ms para 90 operaciones). Lo que la app descartaría ya no se le
  ofrece a la IA: va en un bloque corto, agrupado por motivo, para que sepa explicarlo si le preguntan. Lo que vale
  lleva «→ LA APP: vale para el once / para revender» y su aviso. Cada jugador suyo lleva «LA APP: NO LO VENDERÍA HOY:
  …» o el aviso que toque. Una sola regla en un solo sitio: lo que se le dice a la IA sale del validador, no de un
  párrafo aparte que pueda decir otra cosa.
- **El prompt.** Las reglas de LaLiga, una vez, numeradas. Lo de «cómo calcular» fuera (lo calcula la app); queda cómo
  elegir entre lo que vale y cómo explicarlo.
- **Después, en el chat (`revisarChat`, ia.js).** Nuevo. La IA añade a su bloque de notas lo que recomienda hacer
  («recomiendo») y la app lo pasa por `cuadrarPlan`, como en el plan; si no lo pone, se miran las órdenes claras del
  texto («clausúlalo», «puja por X»). Además: las cifras que da de un jugador (valor, cláusula) y del saldo se comparan
  con los datos; las cuentas escritas («a + b − c = d») se rehacen; y hay cosas que no puede decir (cláusula con
  deuda, «te viene bien que te clausulen» a uno a su valor, un precio de mercado como si fuera un trato, el nombre del
  modelo, otras webs). Lo que no cuadra no se borra (el texto ya se ha visto mientras llegaba): debajo sale «Revisado
  por la app» con lo que es de verdad. Una respuesta correcta sale tal cual (cinco casos de control lo vigilan).
- **Después, en el plan.** `cuadrarPlan` sigue igual, con dos agujeros tapados (el titular con un blindaje quitado y el paso de alinear con uno ajeno).

Modelo, temperatura y razonamiento: se quedan como estaban (el mejor modelo que tenga la clave, pensando «poco», sin
temperatura en los 3.x como pide Google). Con la app decidiendo, pensar más no arregla nada y tarda el doble. Lo que sí
ha salido en la medida: los tres mejores modelos dan unas 20 preguntas al día con la clave gratis, así que un usuario
que tire mucho del chat acaba en el ligero (es lo visto el 13 nov con la clave de pruebas: 21 preguntas y Google cortó
por cupo diario; no he comprobado si el tope va por preguntas o por tokens, así que no sé si leer menos lo alarga).

## Claude en vez de Gemini: lo medido (14 nov, 00:0x-01:1x)

Carlos preguntó cuánto costaría quitar la clave de Google de cada usuario y poner Claude, o un híbrido (Claude en el
plan y Gemini en las preguntas). Mismos 31 casos, lo que manda la 0.7.9, UNA pasada por modelo, con la clave del bot.
Gastado en la medida: 3,71 $.

| | Chat (26 casos) | Planes (5) | Coste por pregunta | Coste por plan | Lo que tarda un plan |
|---|---|---|---|---|---|
| Gemini ligero (flash-lite, gratis) | 26 | 5 (1-3 operaciones, 0 descartadas) | 0 | 0 | 3-4 s |
| Haiku 5.5 | 25 | 1 | 0,0038 $ | 0,011 $ | ~75 s |
| Sonnet 5.5 | 26 | 4 (2-6 operaciones, 1 descartada) | 0,07 $ | 0,13 $ | 17-56 s |

- Los tokens de Claude salen más: el mismo texto son ~26.800 en el chat y ~42.500 en el plan (con Gemini, 18.700 y
  36.400). Y lo que piensa antes de contestar se cobra como salida.
- Haiku en el plan no vale tal como se probó: se gasta los 16.000 tokens de salida pensando y el plan llega cortado o
  vacío (4 de 5), con «pensar poco» (`output_config.effort: low`) y también pidiendo que no piense
  (`thinking: between_tools`, que Haiku 5.5 rechaza). Puede haber otra forma de apagárselo que no he encontrado.
- Sonnet hace planes más completos que el Gemini ligero, pero estos casos miden fallos, no si el consejo es mejor: con
  una pasada no se puede decir que Sonnet «acierte más». El que falló fue en el parón: aceptó la oferta por Baena junto
  a tres ventas más, y la app la descartó porque con las otras ya no hacía falta el dinero.
- Las cuentas por usuario activo al mes: híbrido (plan con Sonnet, preguntas con la clave de Gemini de cada uno), 3,95 $
  con un plan al día y 7,90 $ con dos; todo Sonnet con dos planes y 40 preguntas, 10,70 $; chat con Haiku, 0,15 $.
  Un plan de Sonnet (0,13 $) no lo paga un anuncio.
- Conclusión: hoy, quitar la clave de Google no sale. Haiku, que es el que se podría pagar, no saca el plan; Sonnet lo
  saca pero cuesta 4-8 $ por usuario al mes solo en planes. Lo que queda por probar: Haiku con el plan ya hecho por el
  motor (punto 2 de «Lo que queda»: escribiría mucho menos) y una clave de Gemini de pago de Carlos para todos.
- Cómo se repite: `.github/ia/llamar-claude.mjs` en la rama `pruebas-ia` (`MODELOS`, `SOLO`, `ESFUERZO`, `PENSAR=no`) y
  `LOTE=<modelo> node .github/ia/puntuar.mjs respuestas-claude.json`.

## Las pruebas

- `.github/ia/casos.mjs`: 116 casos, cada uno con el fallo de donde sale. 57 llevan escrita la respuesta de la IA (41
  de la 0.7.9 y 16 del plan corto), 28 son del motor (sin IA) y 31 se preguntan a la IA de verdad.
- `.github/prueba-ia.mjs` (sin red; va en la Action «Pruebas» en cada push): los 41 y, desde el motor del plan, los 28
  del motor y los 16 del plan corto (85). Google es de mentira
  (`.github/ia/banco.mjs`): la app corre entera, con la liga de ejemplo a una hora fija, y se mira lo que acaba viendo
  el mánager.
- Con la IA de verdad: `node .github/ia/montar.mjs` (lo que la app mandaría), rama `pruebas-ia` (no se fusiona; su
  Action lo manda a Gemini y deja `respuestas.json` de artefacto) y `node .github/ia/puntuar.mjs respuestas.json`.
  Con dos lotes (`pedidos.json` y `pedidos-b.json`) pregunta cada caso dos veces con el mismo modelo, para comparar
  antes y después. Gasta 31 preguntas por lote: con el cupo gratis, una pasada al día con los modelos buenos.

## El motor del plan y el plan corto (14 nov, 01:25-03:15; rama `web-motor-plan`, sin publicar)

Encargo: claude/prompt-motor-plan.md. Sesión de noche, sin Carlos (las dudas, decididas con las 15 reglas y con cómo juega;
están en «Para confirmar con Carlos»). Vista previa: https://web-motor-plan.fantasy-manager-61v.pages.dev

### El antes y el después

| Medida | Antes (0.7.9) | Después (`web-motor-plan`) |
|---|---|---|
| Casos del motor (28, en 13 escenarios, sin IA y con árbitro de reglas) | 13 bien (`planAuto`) | 28 bien |
| A fondo: la liga de ejemplo movida al azar, 540 ligas en 9 momentos de la semana | 307 bien (57 %) | 540 bien (y con cuatro semillas, 2.160 ligas: todas bien) |
| Operaciones por plan (media, a fondo) | 9,0 | 4,4 |
| Planes del motor con algo «Descartado por la app» | sí, en 8 de los 13 escenarios (Cubarsí, Natan…) | ninguno: lo que la app tacharía no sale |
| Lo que tarda el motor | 2 ms | 12 ms de media, 56 ms el que más (con la CPU ×4 más lenta, 30-60 ms) |
| Casos sin red en total (los para la app sola) | 41 | 85: los 41 de antes, 28 del motor y 16 del plan corto |
| Lo que lee la IA para un plan | ~36.400 tokens (Gemini), ~42.500 (Claude) | ~3.700 (Gemini), ~5.200 (Claude): un 90 % menos |
| Lo que escribe | 3.000-5.000 tokens (Haiku, hasta 16.000) | 630-710 (Gemini ligero), ~1.000 (Sonnet), ~2.500 (Haiku, con lo que piensa) |
| Planes con la IA de verdad, dos pasadas por modelo (5 escenarios) | Gemini ligero 5 de 5 · Haiku 1 de 5 · Sonnet 4 de 5 (una pasada) | Gemini ligero 10 de 10 · Haiku 10 de 10 · Sonnet 10 de 10 |
| Operaciones de esos planes descartadas por la app | 1 (Sonnet) | 0 de 133 |
| Lo que tarda un plan | 3-4 s (ligero), ~75 s (Haiku), 17-56 s (Sonnet) | 2,8 s (ligero), 11,7 s (Haiku), 6,9 s (Sonnet) |
| Lo que cuesta un plan | 0,011 $ (Haiku, y fallaba), 0,13 $ (Sonnet) | 0,0018 $ (Haiku), 0,0204 $ (Sonnet) |

Con qué se midió la IA de verdad: 14 nov, 02:41 (primera versión del contrato) y 02:55 (la final, la de la tabla), rama `pruebas-ia`, los cinco planes dos veces con cada modelo
(gemini-3.5-flash-lite con la clave gratis de pruebas; Haiku 5.5 y Sonnet 5.5 con la clave del bot). Gastado esta noche:
0,48 $ (tope puesto: 3 $). FALTA la pasada con los Gemini buenos: su cupo gratis vuelve a las 9:00 (cómo, abajo).
Son 5 escenarios de la liga de ejemplo y miden que el plan no se salte reglas ni lleve nada tachado; no miden si el
consejo es mejor que el de antes.

### Diagnóstico: qué hacía `planAuto` y por qué no valía

`planAuto` (motor.js) iba operación a operación, en orden fijo, y lo que salía se pasaba por `cuadrarPlan`:
1. **Vendía todo lo que tenía un motivo, sin mirar el conjunto.** En el martes de ejemplo: 5 ventas (175 M) para pagar 56 M
   de cláusulas; en el cierre vendía a Catena y a Raphinha a un día de la jornada (el once, de 43,9 a 31 puntos); en el
   parón dejaba el once con 2 huecos y 110 M parados.
2. **Contaba como dinero lo que solo estaba puesto a la venta**, y con eso pujaba para el once sin tirar de deuda «de
   verdad»; lo ya pujado (36,3 M en la liga de ejemplo) lo restaba, pero no decía que con eso se empezaba la jornada en −29,87 M.
3. **Proponía lo que la app tachaba después**: pujas que no cabían en el margen de deuda, especular sin margen.
4. **No sabía esperar**: en negativo vendía hoy perdiendo aunque quedaran tres cambios de mercado (Ibañez, 3 nov), y
   aceptaba la oferta por uno que sube más de lo que le pagan (Fornals, 13 nov).
5. **Sí especulaba** (el prompt decía que no): hasta el 90 % de la deuda y 2 a la vez, pero después de todo lo demás y sin
   comprobar el conjunto.
6. **25 jugadores**: no lo miraba (en la prueba, la plantilla se iba a 28).

### Cómo es el motor (web/js/plan.js)

- **Candidatos**: las operaciones del catálogo que pasan `veredictos`, cada una con lo que aporta en euros (lo que te pagan
  de más, lo que deja de bajar en dos semanas, el beneficio esperado de revender según la confianza, lo que se paga de más
  al fichar) y con a quién saca o mete en el once. Una venta siempre tiene motivo: de baja, ha girado, le pagan más de lo
  que subiría, es de revender y toca, o hace falta para empezar la jornada en positivo. Nunca «por hacer caja».
- **La equivalencia** (`valorPunto`): un punto en una jornada vale la mediana de valor/puntos esperados de los jugadores con
  dueño de la liga, repartida en 10 jornadas (en la liga de ejemplo, 440 mil). Lo que cambia el once se cuenta a 5
  jornadas; en el parón, al 40 %. Se ajusta con `cfg().plan` (`eurPunto`, `jornadas`…), sin pantalla todavía.
- **La combinación**: se prueban todas las combinaciones de hasta 13 candidatos (8.192) con las reglas: cláusulas solo con
  lo que hay en caja y sin que lo ya pujado pase el tope de deuda (reglas 4 y 5), 25 jugadores (12), dos blindajes (9),
  los cambios de mercado que quedan para revender (3), y empezar la jornada en positivo (10) contando lo de revender al
  92 % y lo puesto en venta al 90 %. Lo pujado solo cuenta para la jornada si se cobra antes de que empiece. Gana la que
  más vale (euros + puntos del once); cerca de la jornada no se abre un hueco que no tape una cláusula, y con las
  cláusulas cerradas no se toca a un titular.
- **Las ventas «por si hace falta»** solo entran si sin ellas la jornada empezaría en negativo, las justas, y la que menos
  duele; con dos cambios de mercado o más y sin estar bajando, se programan para la víspera del último («sin prisa»).
- **La red**: el plan pasa por `cuadrarPlan`; si la app tacha algo, ese candidato se veta y se elige otra vez (hasta 6
  vueltas). Si el motor falla, sale el plan de antes (`planAuto`).
- **Modos**: normal, en negativo, cierre, en juego y parón, con `paronLejos`, `M.vedaAhora` y `M.ventanaEsp`.
- **Una sola verdad, hasta donde llega hoy**: las cláusulas para el once usan `mereceClausula` (la de Hoy y las alarmas);
  lo que el motor mira y deja fuera va en «Mirados y descartados» con su porqué y Hoy ya no lo enseña arriba como urgente.
  Sin plan de la IA de hoy (no hay, está pensando o ha fallado) se ve el del motor de hoy, no el de ayer. Las alarmas salen
  del plan que se ve, como antes. SIGUE APARTE: la lista `M.acciones` de Hoy y el aviso de inercia en segundo plano (fondo.js).
- **El histórico** (`reventasPasadas`): con los valores de cada día que guarda la app, lo que el motor habría comprado para
  revender y cómo le fue a los 4 días. Está hecho, pero el freno (`frenoReventa`) va APAGADO: no se pudo medir con la liga
  de Carlos (ordenador apagado) y en la de ejemplo los valores son al azar (0 señales con el filtro del motor).

### El contrato corto con la IA (web/js/ia.js: `planDelDia`, `pedidoCorto`, `aplicarCorto`)

A la IA le llegan los pasos del motor (cada uno con su id, por qué, cuánto, cuándo, qué pasa si no se hace y la ficha
corta del jugador con su prensa), las alternativas que también valen (hasta 4), lo mirado y descartado, la prensa de los
demás, lo que el mánager le ha contado, la clasificación y los movimientos de 3 días. Devuelve: `pasos` (en su orden, con
una o dos frases), `quita`, `mete`, `situacion`, `noticias`, `rivales` y `titular`. La app:
- rehace con el motor lo que quita o mete (`planMotor` con la combinación fijada) y lo cuadra, de uno en uno: lo que no
  cuadra no entra y lo que hace falta para la jornada no se va;
- solo deja quitar o meter si de ese jugador hay prensa, un estado, una nota del mánager o un partidazo reciente (el modelo
  ligero quitaba pasos «porque sobra margen»), o meter para cubrir algo quitado;
- no usa una frase con una cifra que no esté en los datos del paso (ni como suma o resta de dos): sale la de la app;
- no deja noticias de quien no tiene prensa, estado ni nota (el ligero se inventó «un baile en el vestuario»), ni el
  nombre del modelo ni otras webs; el titular no nombra lo quitado; en el parón, la situación lo dice siempre.
El plan largo de siempre queda como `planLargo` (si el motor no puede, o con `cfg-ia.planLargo`). En el corto no se busca
en Google aunque esté puesto en Ajustes.

### Las cuentas de quitar la clave de Google (con lo medido)

- Un plan cuesta 0,0018 $ con Haiku (10 de 10) y 0,0204 $ con Sonnet. Una pregunta del chat sigue leyendo ~18.700 tokens:
  0,0038 $ con Haiku (medido el 14 nov, 25 de 26). Ahora lo caro es el chat, no el plan.
- Por usuario que entra TODOS los días (2 planes al día y 40 preguntas al mes): todo Haiku, 0,26 $ al mes (100 usuarios,
  26 $; 250, 65 $); plan con Sonnet y chat con Haiku, 1,38 $ (138 $ y 344 $).
- Con una clave de Gemini de pago de Carlos (precios de lista vistos el 14 nov en webs que copian la de Google; la página
  oficial, ai.google.dev/gemini-api/docs/pricing, no se pudo abrir desde aquí: comprobarlos antes de decidir):
  gemini-3.5-flash-lite a 0,30 $ / 2,50 $ por millón (entrada / salida) saldría a ~0,0028 $ el plan y ~0,007 $ la
  pregunta, unos 0,45 $ por usuario y mes (45 $ y 113 $); gemini-2.5-flash-lite a 0,10 $ / 0,40 $, ~0,0006 $ el plan y
  ~0,002 $ la pregunta, unos 0,12 $ (12 $ y 30 $). Son estimaciones con los tokens medidos, no una medida con clave de pago.
- Lectura: por el plan, ya se puede (500 planes de Haiku por 1 $). Lo que queda para decidirlo es el chat (recortar lo que
  lee, o un tope gratis al día) y la pasada con los Gemini buenos.

### Para confirmar con Carlos

**Contestado el 14 nov, 10:58 (puntos 1, 4, 7 y 10) y ya en la rama:**
- 1. Un punto vale 100.000 € (lo que paga LaLiga), no los 440 mil que salían de la liga de ejemplo. `AJUSTES.eurPunto`
  en plan.js; `cfg().plan.eurPunto` lo cambia. Consecuencia medida: con el punto a 100 mil el dinero pesa más que el
  once. El martes de la liga de ejemplo el plan vende también a Catena (titular, 4,7 puntos, bajando) y el once pasa de
  43,9 a 39,3 puntos; en negativo, a 34,8. Con 440 mil se quedaba a Catena. Si eso es demasiado vender, se sube el
  número (un punto vale también por la clasificación, no solo por lo que paga).
- 4. Las pujas se pueden retirar: en el cierre, con una puja viva que te deja en negativo, el plan dice «Retirar puja»
  (Courtois) en vez de aceptar la oferta por un titular (Baena). Caso `motor-cierre-retira-la-puja`.
- 7. Con 25 no se puja: el plan no propone pujas y lo dice («LaLiga no te deja pujar por nadie más hasta que vendas a uno»).
- 10. Vender con la jornada empezada no quita los puntos: el plan lo dice en la venta. Antes del primer partido sí se
  pierden, y eso ya lo contaba (el once que queda). Sin hacer: aprovecharlo a propósito («espera a que empiece la
  jornada para vender al titular que baja: te puntúa igual»).
- Aparte: los planes los paga Carlos con Claude (2 al día por usuario) y las preguntas siguen con la IA de cada uno.
  Hace falta una ruta en el Worker con la clave como secreto y el tope por cuenta: sesión nueva.

De paso salió un fallo: en apuros (en negativo al empezar la jornada) lo de revender se quedaba fuera de la búsqueda. Arreglado.

**Contestado el 14 nov, 15:10-15:40 (segunda vuelta, rama `web-motor-2`, mirando su liga en su Chrome):**

Su liga ese día (parón, 99,45 M, 15 jugadores): el motor decía «quieto» (13 candidatos, todos ventas «por si hace falta»;
nada que especular), sin descartes. Histórico de reventas: 633 de 700 bien, +1,57 M de media a 4 días. Cupo de la IA gastado
(3 planes). Lo raro: Pedrosa, con una oferta un 6 % sobre su valor y bajando un 1,1 % al día, no se aceptaba porque
«perderías 267 mil de lo que pagaste» (la regla de no malvender).

- 2. Titular que baja: solo cuando baja TODOS los días (3 o más seguidos, `M.bajaSeguido`), a la venta «por si llega una
  oferta mejor» (no hay que aceptarla), y lo que puede bajar se mira con lo más bajo que ha valido esta temporada
  (`M.rango`; por debajo del mínimo, la mitad: `mueve`). Si no tiene relevo en su puesto (sin él el once pierde 1 pt o más y
  la mitad de lo que da: `sinRelevo`), NO se vende: sale en «Mirados y descartados» que sería bueno venderlo pero hace falta
  sustituto (Carlos con Pedrosa: «Solo avisar, sin vender»). Un titular que solo acaba de girar ya no se vende por la
  inercia (antes: Raphinha y Catena en cuanto giraban). La regla de no malvender (cuadrarPlan) no frena la venta de uno
  que baja todos los días por su valor o más. En el cierre, como antes, nunca. «Esperar a que empiece la jornada para
  venderlo» no lo eligió.
- 3. En negativo entre semana: como estaba (no malvender hoy).
- 5. Como estaba (90 % de la deuda, 2 a la vez y 3 en el parón) y además A MÁS DE UNA JORNADA: lo de revender que sigue
  subiendo y tiene más de día y medio de protección (14 días desde que se ficha) no se vende a la fuerza antes de la
  jornada (`aguanta`): solo si hace falta para empezar en positivo (lo decide la combinación). Se vende cuando deja de
  subir o antes de que se le acabe la protección. «2 a la vez» cuenta lo que ya tienes para revender (`revVivos`); antes,
  fuera del parón, no se especulaba con algo ya comprado. SIN HACER: comprar pensando ya en venderlo después de la
  jornada (el beneficio esperado sigue calculado hasta la víspera).
- 6, 8 y 12: como estaban.
- 7 (qué hace LaLiga si ganas dos pujas con 24): no lo sabe. Por si acaso, las pujas que tienes puestas ocupan sitio: con
  24 y una puja viva no se ficha a nadie más (ni puja ni cláusula); vender, sí.
- 9: «depende de la situación» y las 24 h de antes están cerradas. Se queda como estaba y en «Los próximos días» sale, a
  la hora en que empieza la jornada, que se reabren las cláusulas y, si te queda un blindaje gratis, en quién usarlo
  (titulares con la cláusula a menos de un 10 % de su valor y sin protección para entonces).
- 11: freno encendido (`frenoReventa: true`). Carlos: los precios son los mismos en todas las ligas; lo único de cada una
  es lo que se paga de más al pujar, así que el histórico mide si la regla funciona.
- 13: mientras la IA piensa, si falla o sin cupo, se ve el último plan de la IA SI ES DE HOY, con «de hoy 10:32 (hace 2 h)»
  y una banda «puede que no esté al día» (también si tiene más de 3 h). Si no hay de hoy, el automático (ya era así).
- 14: que la IA vuelva a buscar en Google. HECHO Y PUBLICADO en la 0.7.11a (14 nov, tarde), con 1 búsqueda por plan.
  - Worker: `llamarClaude` lleva `web_search_20250305` con `max_uses` = «planes.web» de limites.json (0-3; 0 apagado) y
    `user_location` España; junta los bloques de texto (vienen partidos y con citas), sigue si vuelve a medias
    (`pause_turn`, dos veces como mucho) y, si la consola no tiene la búsqueda activada (400/403), repite sin ella. El
    gasto suma 0,01 $ por búsqueda (`costeDe`). Devuelve `tok.web` (las búsquedas hechas).
  - Las fuentes nunca salen de la IA: `fuentesDe` (plan-sistema.js) deja en cada `fuente` de quita, mete y noticias solo
    urls que salieron de verdad en la búsqueda y pone en `fuentes` las usadas y las citadas (6 como mucho); lo que la IA
    escriba en su propio «fuentes» se tira. `planLimpio` deja pasar `fuente` y `fuentes` (https y título corto).
  - Sistema: `webTxt(n)` se añade a `sistemaCorto` solo por el Worker (busca solo noticias de última hora de los del plan
    y titulares dudosos; la fuente, la url tal cual; si no hay nada claro y reciente, no cambia nada).
  - App (`aplicarCorto`): una noticia con fuente de la búsqueda vale para quitar o meter (como prensa, estado, nota o
    partidazo); sin fuente, no. `P.web` (si buscó) y `P.fuentes` (sin webs de fantasy; para quitar sí valen). Casos
    nuevos: corto-quita-por-busqueda, corto-busqueda-sin-fuente, corto-fuentes-fantasy. Worker: 16 casos nuevos en datos.mjs.
  - La consola de Anthropic ya tenía activada la búsqueda web (org Toisón, Capacidades, sin restricciones).
  - Medido en `pruebas-ia` con Haiku por el Worker (los 5 planes, 2 pasadas): con 1 como mucho, 0,0117 $ por plan (0,8
    búsquedas, 21.000 tokens de entrada, 3.100 de salida, 16,5 s) y 4 noticias con fuente en 10 planes; con 2, 0,0163 $
    (1,2 búsquedas, 17,8 s) y 5 noticias. Sin búsqueda, ~0,0022 $. Ninguno quitó ni metió pasos (la liga de ejemplo, en el
    parón); las noticias, reales y con sentido (Raphinha sin lesión con Brasil, Baena convocado). Carlos eligió 1: ~0,70 $
    por usuario al mes con 2 planes al día; el tope de 3 $ al día da para ~250 planes.

Casos nuevos (`motor-…` en casos.mjs, escenas en banco.mjs): baja-sin-relevo-avisa, baja-con-relevo-a-la-venta,
giro-titular-no-se-vende, reventa-se-aguanta, reventa-antes-de-la-proteccion, 24-no-puja-de-mas, blinda-al-arrancar y las
«reglas» de sus escenas. El motor saca ahora en las pruebas los MIRADO y los DIAS. Cambiaron 5 casos «corto» que daban por
hecho que el motor vendía a Raphinha (ahora no: no baja todos los días).

### Qué falta para publicar

1. El OK de Carlos, después de mirar la vista previa y la lista de arriba.
2. La pasada con los Gemini buenos (cupo desde las 9:00): en la rama `pruebas-ia`, cambiar `PASO: noche` por
   `PASO: buenos` en `.github/workflows/pruebas-ia.yml`, subir, bajar el artefacto `respuestas` y
   `node .github/ia/puntuar.mjs respuestas-buenos.json` (10 preguntas: caben en el cupo del día).
3. Verlo con la liga de Carlos: el plan del motor en Hoy, el número del histórico de reventas y el plan con su clave.
4. La entrada de version.js y la novedad para todos, sin datos internos (propuesta: «El plan del día, más rápido y sin
   contradicciones»). Y cerrar la versión con claude/cerrar-version.md.

### Cómo se repite

- Los casos: `PW_MODULO=… node .github/prueba-ia.mjs [motor-|corto-]` (86 casos, ~2 min; `MOTOR=viejo` mide `planAuto`).
- A fondo: `node .github/ia/a-fondo.mjs 60 <semilla>` (540 ligas, 25 s; `MOTOR=viejo` para comparar; `VER=1` enseña los fallos).
- Con la IA: `node .github/ia/montar.mjs` → los `ia-plan-*` a `pedidos.json` y `pedidos-b.json` de `pruebas-ia` → la
  Action → `FRASES=1 node .github/ia/puntuar.mjs respuestas-<lote>.json`.

## Lo que queda (por orden de lo que más daría)

1. Publicar el motor y el plan corto (arriba, «Qué falta para publicar»).
2. El chat: es lo que más lee ahora (~18.700 tokens por pregunta). Recortar las fichas y, si se quita la clave de cada
   usuario, un tope gratis al día.
3. Que `M.acciones` (la lista de Hoy) y el aviso de inercia en segundo plano salgan también del motor del plan.
4. Si «Revisado por la app» sale a menudo con su liga, pedirle a la IA que reescriba la respuesta con las correcciones
   (una pregunta más de cupo) en vez de añadirlas debajo. Decidirlo con Carlos.
5. Casos nuevos: cada fallo que avise Carlos o Domy entra primero en `casos.mjs` y después se arregla.

## Segunda parte (17 nov)

Rama `web-plan-2` (sale de `web-chat-haiku`, con lo último de main y de `web-chat-haiku` fundido antes de acabar). SIN
PUBLICAR. La entrada de version.js va dentro de la 0.8 de la otra sesión, detrás de lo del chat (h '00:00': la hora se
pone al publicar). Nada de Android: la huella nativa no cambia por esto (la 0.8 del chat sí la cambia, por el banner).

### 1. «Plan rehecho al aplicar»

Cuándo pasaba: `aplicarCorto` rehace con `planVueltas` cuando el plan del motor, sin que la IA toque nada, ya no cuadra
con la liga que tiene delante. Medido en azar-plan: con el plan recién hecho no pasa nunca (0 de 1.950 por semilla,
tampoco si la IA reordena los pasos ni con +20 min, +3 h o +26 h). Pasa cuando el plan es de otra liga o de otro momento:
el que se recoge con el mismo `rid` al volver a la app (Android la cerró mientras la IA contestaba) y la liga ya ha
cambiado. Por qué no cuadraba (60 vueltas, semilla 1): «la jornada empezaría en negativo» 89, «las cuentas no salen» 37,
la app tacharía una venta («venderías perdiendo…») 14 o una subida de cláusula 16.

Lo hecho:
- Antes de rehacer, se ajusta: el mismo plan sin lo que ya no cabe (primero lo que la app tacharía, luego de uno en uno
  y de dos en dos, como mucho 24 pruebas) y, si ni así, el mismo plan con lo que haga falta de más (`planMotor` con
  `incluir`: esos pasos van dentro y el motor busca el resto con las mismas cuentas; hasta 8 variantes y 3 vueltas). Lo
  que sale va a «Mirados y descartados» con «La app lo saca del plan: …». En el diagnóstico, `cambios.ajustado`.
- `incluir` en plan.js va como bits obligados dentro de `elegir` (no como `fijos`: los fijos no se suman en las cuentas
  de `elegir` y salían planes con tres cláusulas para el once y la jornada mal contada; lo cazó el árbitro).
- Si al final se rehace: la situación es la de la app (la de la IA hablaba de otro saldo) y el titular no nombra a
  quien ya no está en el plan. Antes pasaba (83 situaciones de otro plan y 107 titulares con alguien que ya no estaba).
- La jornada se compara con la del plan de hoy de esta liga cuando el que llega iba en negativo. Antes, un plan viejo en
  negativo pasaba tal cual aunque la liga de ahora llegara en positivo (−24 M con +8,5 M posibles: árbitro r10).
- El plan recogido: `planPorApp` guarda con el `rid` lo que era cada paso (p1 → V-123…) y `traducirIds` pasa los ids
  de aquella respuesta a los del plan de ahora. Antes las frases de la IA se pegaban por posición: en azar-plan, 5.493 /
  5.547 / 5.698 frases a otro jugador (es el peor caso, cada vuelta es una liga muy distinta); ahora 0 y sin rehacer.

| 150 vueltas × 13 escenas | Semilla 1 | 7 | 42 |
|---|---|---|---|
| Rehechos antes | 720 | 732 | 723 |
| Rehechos ahora | 40 | 34 | 37 |
| Ajustados ahora (el mismo plan, sin lo que ya no cabe o con algo de más) | 678 | 687 | 687 |
| Fallos con la prueba nueva, código de antes | 3.142 | 3.203 | 3.184 |
| Fallos ahora | 0 | 0 | 0 |

Por escena (semilla 1, rehechos antes → ahora): martes 57→1, veda 65→12, enjuego 40→5, paron 78→4, m-cierre 60→7,
m-reventa 49→0, parón con dinero 50→0, 25 jugadores 38→1, negativo 66→4, cláusula recién pagada 55→1, puja ya hecha 66→1,
jornada empezada 30→2, rival que te clausula 66→2. Lo que queda son los de veda y cierre: con las cláusulas cerradas un
plan de otro día no tiene arreglo (sus cláusulas ya no se pueden pagar y no hay cambio de mercado para vender).

### 2. Casos nuevos en azar-plan.mjs

Siete escenas con algo forzado sobre el azar, cada una con lo suyo que comprobar (en el plan de la app y en el de la IA
al azar): parón con 60-150 M libres (modo parón, sin ventas «por caja» ni «hace falta»); plantilla de 25 (no ficha sin
vender antes); negativo entre semana (modo negativo y, si no llega, lo avisa); cláusula recién pagada, 14 días
protegido (ni blindar ni clausular); puja ya hecha por el mismo jugador (no puja otra vez, un solo paso); jornada empezada
(modo en juego, sin once); rival que te acaba de clausular (no se le mueve ni va en el once). Además, para todas: los
pasos en otro orden, el plan recogido de un pedido anterior y el árbitro sobre el plan ajustado. 150 vueltas con las
semillas 1, 7 y 42: 1.950 ligas cada una, 0 fallos. En «Pruebas» sigue con 60 vueltas (13 escenas, ~1 min).

### 3. La conexión (.github/ia/caso-conexion.mjs, en «Pruebas»)

`localStorage['fm-worker']` no llega a /plan: `pedirWorker` (soporte.js, que comparte el chat) va siempre al servidor
publicado. La prueba contesta en la propia página (Playwright), cambia `planesApp` al servir ia.js para que la demo vaya
por la IA de la app y pide el plan con el botón. 11 casos: 503, tope del día, 502 en HTML, respuesta vacía, solo los
espacios de mientras piensa, cortada a medias, sin formato, plan vacío, sin conexión, un corte y vuelve, no contesta
nunca (con el reloj de la página adelantado), 503 con tu clave y el motor roto con y sin clave.

Antes 17 MAL; ahora 0. Lo arreglado: «Tienes el plan de la app» y «Mientras, tienes el plan automático» a la vez (9
casos); el tope del día decía «en un rato» (ahora el mensaje del servidor: mañana); una respuesta cortada decía «no está
disponible» y soltaba el id, así que el reintento gastaba otro plan (ahora es un corte: se repite con el mismo id); sin
contestar, 2 intentos de 120 s = 258 s (ahora cada intento con lo que queda de los 3 min: 186 s). Lo que no se tocó: el
relevo y las pausas de `preguntar` (compartido con el chat) y `pedirWorker`.

### 4. planLargo: quitado

Quién lo usaba: con tu clave de Google, cuando el motor no montaba su plan (en 5.850 ligas al azar y 225 de a-fondo no
pasa) o con `cfg-ia.planLargo`, que no tenía interruptor. Con la IA de la app ya se decía «la IA no tiene qué ordenar».
Ahora, para todos igual. Fuera con él (−150 líneas de ia.js): `memoria`, `BUSCAR_PLAN`, `SIN_BUSCAR_PLAN`,
`ESQUEMA_PLAN`, `ACCIONES_PLAN`, `sistemaIA`, `PULLITAS`, `reglasBloqueo` y el interruptor «Buscar en Google en el plan»
de Ajustes (`webPlan`), que con el plan corto no hacía nada. Se queda `SISTEMA`: ya no se manda a ninguna IA, pero
`seudonimos` (lo comparte el chat) no elige alias que choquen con sus palabras; quitarlo cambiaría los alias del chat.
También se queda la opción `corto` de `contexto` (es código del chat). Los 17 casos de prueba-ia del contrato de antes
siguen: banco.mjs pasa lo que «contesta» la IA directamente por `cuadrarPlan` (como los planes guardados de antes).

### 5. M.acciones y el aviso de inercia, fuera del motor

`acciones` (la lista «Ahora mismo» de Hoy) está en web/js/acciones.js, tal cual; motor.js calcula `M.paraEscudo` (lo
usan el plan y la ficha) y sigue dejando `M.acciones` al final de `analizar`. `ventasInercia(M)`: a quién vender por la
inercia, lo usan Hoy y fondo.js. Antes fondo.js avisaba a todos los que giraban, también al que Hoy manda esperar a que
le paguen la cláusula y al lesionado que gira (dos avisos). Comparado con la liga de ejemplo, 8 escenas, las 6 pestañas
con sus subpestañas, Ajustes y las 15 fichas de mis jugadores, antes y después: iguales (lo único distinto, un minuto del
reloj, sale igual repitiendo la foto antes); `M.acciones`, el plan y `M.paraEscudo`, idénticos; los avisos con la app
cerrada, los mismos en otro orden (de lo que más pierde a lo que menos). .github/ia/caso-fondo.mjs (en «Pruebas»).

### Pruebas (con la 0.8 del chat ya fundida)

azar-plan 150 × semillas 1, 7 y 42: 0 fallos. a-fondo 225/225. caso-pujas, caso-chat, caso-conexion, caso-fondo y
prueba-intersticial: todo BIEN. prueba-ia sin red 106/106. prueba-web entera en Madrid y con TZ=UTC: 80 BIEN, 0 MAL en las dos.
Sin red: todo BIEN menos relato-ejemplo y robustez-ejemplo (ya fallaban antes).

### Lo que queda

- Los rehechos de veda y cierre (12 y 7 de 150): un plan de otro día con las cláusulas cerradas no tiene arreglo; si se
  quiere bajar, que el plan recogido de un pedido de antes del cierre no se aplique y se pida otro.
- `seudonimos` debería mirar las palabras del sistema del chat (chat-sistema.js) y no `SISTEMA`; tocarlo cambia los
  alias del chat: para la sesión del chat.
- El texto de la inercia (`M.inercia(...).texto`) sigue en motor.js: lo usan casi todos los módulos; sacarlo es otra
  sesión.

## Tercera parte (19 nov): las preguntas del chat y los planes

Rama `revision-ia-3` (sale de main 0a1bdf6, con origin/main fundido antes de acabar). SIN PUBLICAR. Pedido en
claude/prompt-noche-ia-19nov.md. Nada de Android: la huella nativa no cambia. Cambian web/js (ia.js, chat-sistema.js,
plan-sistema.js, plan.js, version.js) y, como el Worker arma las instrucciones con chat-sistema.js y plan-sistema.js, al
publicar sale también «Worker».

### Fase 0: lo que fallaba de verdad

- Avisos de Fallo: 48, 0 sin contestar. De la IA desde la revisión del 13-14 nov (los de antes están en «Catálogo de
  fallos»): leao (17 nov, cuánto ofrecer: +10 % fijo) → arreglado en la 0.8b, ya cubierto por chat-tratos-precio de
  casos.mjs y ahora también por `cuanto-ofrezco` de la batería; Domy (16 nov, el parón descarta un fichaje que sube
  2,5 M al día) → 0.7.13q, ya cubierto por motor-paron-dinero y la escena parón con dinero de azar-plan; Domy (16 nov, al
  acabar el parón, recomendar para la jornada siguiente) → caso nuevo: escena `paron-final` en azar-plan (a dos días de la
  vuelta el plan no va en modo parón); Domy (15 nov, «Tus rivales» desactualizado) → 0.7.13h, ya cubierto por
  corto-rivales-al-dia; Domy (8 nov, pullas y bromas) → es el tono, ya cubierto por TONO_CHAT.
- Cloudflare → Workers → Logs: NO MIRADO. El Chrome de Carlos no respondía (la extensión no estaba conectada).

### Fase 1: el chat

Batería nueva (.github/ia/chat-casos.mjs): 52 preguntas por escena (las 16 de siempre y 36 nuevas: cifras de su liga,
rivales por nombre, apodo y dictado, mercado, reglas, estrategia, ofertas, trampas, conversaciones de 3-4 mensajes y el
plan) en tres escenas: martes, parón y el sábado de partido por la mañana (escena `sabado` de banco.mjs). Comprobador
nuevo (.github/ia/cotejar-chat.mjs): cifras, porcentajes, horas, fechas, puntos y nombres que no salen de lo que se le
mandó (ni de sumar o restar dos que sí), y forma, largo, pregunta al final y contradicciones con la app y el plan.

Fallos por categoría, leídos a mano (156 respuestas por pasada; una respuesta puede tener varios):

| Categoría | Antes | Pasada 2 | Pasada 3 (final) |
|---|---|---|---|
| (a) inventa o se equivoca en una cifra o un dato | 15 | 8 | 5 |
| (b) contradice al motor o al plan | 12 | 5 | 3 |
| (c) añade motivos que la app no da | 8 | 4 | 1 |
| (d) recomienda algo que no se puede hacer hoy | 1 | 0 | 0 |
| (e) no entiende a quién se refiere | 1 | 0 | 0 |
| (f) suena a IA o a plantilla | 13 | 9 | 7 |
| (g) más de 6 frases (el comprobador) | 84 | 65 | 66 |
| (h) forma (notas, códigos, alias) | 6 | 3 | 0 |
| Acaba en pregunta (el comprobador) | 3 | 5 | 0 |
| Coste por respuesta | 0,410 céntimos | 0,378 | 0,382 (−7 %) |
| Lo que lee (tokens de entrada, con la caché) | 34.095 | 31.796 | 31.992 |
| Largo medio | 130 palabras, 7,3 frases | 122, 6,4 | 125, 6,5 |

La nota a ciegas: un subagente que no había visto el código ni los cambios puntuó 30 preguntas (10 por escena), cada una
con la respuesta de antes y la de la pasada final mezcladas al azar, con los datos de la liga de ejemplo delante y con
grep para comprobar cifras. De 1 a 5:

| | Correcta | Útil | Corta | Suena a persona |
|---|---|---|---|---|
| Antes | 3,77 | 3,73 | 4,00 | 3,90 |
| Después | 4,53 | 4,33 | 4,27 | 3,93 |

Gana la de después en 20 de 30, la de antes en 6 y empatan 4. Donde la de después pierde: una cuenta mal («pagar a Niño
no cambia el saldo de mañana»: baja a −30,89 M), la última línea de «mis cláusulas» sin sentido, «Marcos no lo tiene a
la venta, así que no hay oferta» (falso: se puede ofertar) y no ver que una cláusula pagada a las 14:00 del sábado ya no
puntúa en esa jornada. En «suena a persona» casi no se mueve: las coletillas («Si quieres, seguimos…») siguen en las de
otro deporte y cocina.

Lo arreglado, por orden de lo que más pasaba:
1. En el origen (`datosChat`/`contexto`, ia.js):
   - El plan que ve en Hoy: antes el chat recibía el último plan de la IA aunque fuera de ayer y, sin plan de la IA,
     ninguno. Ahora `planQueVe` (el de la IA si es de hoy; si no, el del motor) con el cuándo y el porqué de cada paso.
     «¿Qué hago hoy?» y «¿por qué el plan me dice que venda a X?» cuadran con el plan en las tres escenas (antes, en
     las tres recomendaba pujas que el plan no llevaba; en el sábado no sabía que el plan no vendía a Raphinha).
   - «VENDER POR INERCIA» de uno que el plan aguanta (en Mirados: «se aguanta»): ahora «HA GIRADO A LA BAJA, PERO EL
     PLAN DE HOY NO LO VENDE (su porqué)». caso-coherencia.mjs lo encontró en 49 jugadores de 14 escenas; ahora 0.
   - Las pujas ya puestas, con nombre («MIS PUJAS YA PUESTAS: Courtois 36,30 M»): confundía una opción (R. Terrats) con
     la puja que tenía.
   - «EN MI ONCE: titular/suplente» en vez de «TITULAR» a secas junto a «once probable: suplente» (decía de Julián
     Álvarez que era suplente en su once). «(hasta esa hora no se le puede poner el blindaje)» en vez de «(el blindaje,
     no antes de esa hora)», que leía como «blindado». La hora a la que se cierra el once en el día del partido.
   - El rival por su apodo o con el nombre mal dictado (`rivalesAprox`): ahora le llega su plantilla entera, con
     titularidad y próximo partido.
   - Recortado: de los rivales de los que no pregunta, sin lo de hoy y sin «oferta para que te lo venda» salvo que
     pregunte por ofertas o nombre al jugador. Con lo añadido, lo que lee baja un 6 % y el coste un 7 %.
2. En chat-sistema.js: reglas 11-13 (lo que paga LaLiga por punto y la recompensa diaria; vender con la jornada
   empezada; cualquiera puede ofertar por cualquiera) — las tres comprobadas con Carlos (14 nov) y que el chat no tenía:
   a «¿cuánto me da LaLiga por punto?» contestaba «no hay ninguna regla» en las tres escenas; ahora bien en las tres.
   Como mucho 6 frases contando cada punto de una lista; nada de «Si quieres, te digo…»; con lo que no es fantasy, una
   frase (antes en el martes dio la receta de la tortilla); un equipo o jugador que no existe, en una frase y sin hablar de
   alias (antes: «en mis datos salen como «Rival N»»); con una oferta, lo que aconseja la app salvo un dato nuevo suyo
   (antes «Sí, acéptala» a la oferta de Hugo por Baena en el martes y el parón, con la app diciendo ESPERAR). En
   plan-sistema.js, que nunca le hable al mánager de los alias.
3. En la revisión de la app: «de el Tito» → «del Tito» (`destapar`); el bloque de notas suelto en mitad del texto y el
   código al principio de un paréntesis («(P-1015, 44,70 M…»), fuera (`separarNotas`, `sinCodigos`); `revisarChat` ya no
   salta con una orden condicional para otro día («Si sigue cayendo…, véndelo entonces»).

Tres respuestas que fallaban (liga de ejemplo):
- «¿Cuánto dinero me da LaLiga por cada punto?» (martes). Antes: «No tengo ninguna regla que pague dinero por punto…
  tienes una recompensa diaria, pero no sé cuánto da». Ahora: «Por cada punto que haga tu equipo al acabar la jornada,
  LaLiga te paga 100.000 €. Así que 64 puntos son 6,4 M… sin contar la recompensa diaria de 100.000 €».
- «¿Por qué el plan me dice que venda a Raphinha?» (sábado; el plan no lo vende). Antes: «La app lo marca como «vender
  por inercia»… Yo no lo vendería hoy». Ahora: «El plan de hoy no te dice que vendas a Raphinha. Su único paso es alinear
  el 4-4-2, y Raphinha va en ese once como titular».
- «Hugo me ha ofrecido 66 M por Álex Baena. ¿Acepto?» (martes; la app: ESPERAR). Antes: «Sí, acéptala ahora… si ganas
  tus pujas, tu saldo queda en −29,87 M». Ahora: «No la aceptaría todavía… Baena es titular en tu once… no necesitas
  caja».

Lo que queda flojo en la pasada final: el largo (66 de 156 pasan de 6 frases, muchas listas que se piden enteras);
ofrecimientos al final en las de otro deporte y cocina; alguna posición o fecha mal leída (Dituro como medio,
«titular ~70 %» de uno al 82 %); en el sábado, a la oferta por Baena dice «acéptala después del partido» (ver
preguntas); en el parón, «cuánto pujo por Cubarsí» mezcla la puja de «tenerlo» (44,70 M) con la del plan para revender
(49,81 M), que vienen así de los datos.

Prueba aparte, solo para decidir (las 10 más difíciles, martes, `low` frente a `medium`): `medium` cuesta 0,49
céntimos por respuesta frente a 0,38 (+29 %) y tarda más (hasta 35 s frente a 12 s); la calidad, parecida, y en la oferta
por Baena `medium` volvió a decir «acéptala» contra la app. Se queda `low`.

### Fase 2: los planes

1. El árbitro (banco.mjs), con las reglas de Carlos y de este archivo. Comprobadas antes: r2 (cláusula abierta), r3
   (tiempo para revender), r4 (tope de deuda con todas las pujas), r5 (cláusula con saldo), r7 (cierre de 24 h), r8 (once
   con la jornada en juego), r9 (blindajes), r10 (empezar en negativo), r12 (25), la regla de Hoy y las alarmas para
   clausular, lo que no es mío, vender por caja. Nuevas: r17 (con 25 no se puja, contado en el orden del plan), r6
   (comprar por debajo de lo que pide), pujar por uno que no está en el mercado, rH (nada «para hoy» con el día de otro:
   lo de Huijsen), rM (la hora de mercado de cada liga), rN (en negativo entre semana, con dos cambios o más por
   delante, ni vender hoy «por caja» lo que no cae ni aceptar por debajo de su valor), rP (en el parón, para el once solo
   lo que sube, un chollo o uno bueno a su valor con saldo), r18 (uno vendido hoy no va en el once) y el titular que
   nombra a uno descartado. Lo de «solo de operaciones.js» va dentro: cada paso tiene que ser una operación real (su
   cláusula, estar en el mercado, ser mío). «No vender lo que sube fuerte ni aceptar una oferta que gana subiendo» sigue
   como VENDE_POR_CAJA. .github/ia/caso-arbitro.mjs: un plan hecho a mano que se salta cada regla sale MAL (16 casos).
2. azar-plan.mjs, 8 escenas nuevas (21): el sábado del partido con el cambio de ese mismo día (`sabado-justo`, mercado a
   las 12:00), una liga con el mercado a las 20:00, jueves en negativo con un solo cambio por delante, un titular
   lesionado largo, una cuenta nueva (sin histórico ni lo pagado), una liga sin clausulazos, los dos últimos días del
   parón y el sábado sin más. 150 vueltas × semillas 1, 7 y 42: 3.150 ligas por semilla. Lo que encontró: en el parón,
   la IA podía meter de alternativa a uno «bueno a su valor» (Courtois, 39,95 M) cuando con el resto del plan ya no se
   pagaba con saldo: arreglado en plan.js (`conSaldo` en el candidato, en `cuentas` y en `elegir`). Antes 3-4 fallos
   por semilla; ahora 0. Sin hacer: el mercado real de hoy con una plantilla inventada.
3. Coherencia entre pantallas (.github/ia/caso-coherencia.mjs, 14 escenas, 79 jugadores): Hoy (lo urgente fuera del
   plan), Equipo (el consejo de cada uno en venta), el plan del motor, el plan con la IA sin cambios y lo que se le pasa
   al chat. 49 contradicciones antes (la inercia, arriba); ahora 0. Lo que sigue saliendo en Hoy «aparte del plan» (no
   es contradicción, va con «decide tú»): Niño (liga con el mercado a las 20:00) y Foyth y G. Villar (con 30-60 M): ver
   preguntas.
4. Planes con Haiku de verdad (.github/ia/planes-haiku.mjs, rama `pruebas-ia`, 14 escenas, con 1 búsqueda en Google por
   plan como en producción): antes 0 rehechos, 0 ajustados, nada de la IA sin aplicar ni tachado, 1 con ONCE_BAJA (el
   parón vende a Raphinha, del motor); 0,64 céntimos por plan. Después, igual (1,07 céntimos: hizo más búsquedas). Leídos
   a mano: una frase con una cifra corregida a medias («once puntos… no, con 110 pts», holgado), una venta del parón
   explicada como «imprescindible» cuando el motor la da por el giro y una frase repetida en la situación. Los planes
   estaban bien: no se ha tocado SISTEMA_CORTO.
5. Lo de (72): el plan recogido de un pedido de antes del cierre de cláusulas ya no se aplica (caso nuevo en
   caso-conexion: lo dice y no gasta otro; el pedido ya con el cierre sí se aplica). `seudonimos` mira las palabras de
   las instrucciones del chat y del plan; fuera `SISTEMA` (−44 líneas de ia.js; los alias, iguales con la liga de
   ejemplo y con nombres que chocan). El texto de la inercia fuera de motor.js: SIN HACER (no daba tiempo a compararlo
   pantalla a pantalla).
6. Conexión y reloj: caso-conexion entero (13 casos) bien; prueba-web en Madrid y con TZ=UTC bien. prueba-web fallaba
   (también en main) en «plan y Hoy se contradicen» porque comparaba con planAuto, el plan de antes, que según el día
   esperaba a Niño por las pujas: ahora compara con el plan del motor, que es el que se ve.

### Gasto en IA de la noche

Chat: 3 pasadas × 156 respuestas (0,64 + 0,59 + 0,60 $) y las 10 con medium (0,05 $). Planes: 2 pasadas × 14 (0,09 +
0,15 $). Total ≈ 2,12 $ (tope 3 $).

### Pruebas

prueba-web en Madrid y TZ=UTC: Todo BIEN. prueba-ia 111/111 (3 casos nuevos de chat). azar-plan 150 × 1, 7 y 42: 0
fallos. a-fondo 225/225. caso-pujas, caso-chat, caso-fondo, caso-conexion, caso-apodos, caso-arbitro (nuevo),
caso-coherencia (nuevo): Todo BIEN. worker/prueba/datos.mjs: BIEN. caso-arbitro y caso-coherencia van en «Pruebas».

### Preguntas para Carlos

1. EL PLAN RECOGIDO DE ANTES DEL CIERRE. Ahora no se aplica y la app dice «pide otro si quieres»: no se pide solo,
   porque gastaría otro plan del día. Opciones: así; que se pida solo (gasta uno); o que el servidor no cuente ese
   segundo. Por defecto, así.
2. LA OFERTA EL DÍA DEL PARTIDO. Con una oferta por un titular el sábado por la mañana (Baena), la app dice ESPERAR (sube
   y lo gana en 4 días) y la IA dice «acéptala después del partido»: vendido con la jornada empezada cuenta entera, así
   que aceptar a partir de las 14:00 no pierde puntos. ¿Quieres que la app lo diga así ese día (si la oferta compensa,
   aceptarla ya empezada la jornada)? Por defecto, no se ha tocado: la IA a veces lo dice por su cuenta.
3. LO URGENTE DE HOY QUE EL PLAN DEJA FUERA. En 3 de 14 escenas Hoy enseña arriba una cláusula que el plan no lleva y
   que cabría (Niño con el mercado a las 20:00; Foyth y G. Villar con 30-60 M), con «es un aviso aparte, decide tú».
   Opciones: que el plan la meta; que vaya a «Mirados» con el porqué y no salga arriba; o como ahora. Por defecto, como
   ahora.
4. COSTE FRENTE A CALIDAD. Se queda `low` (medium: +29 % de coste, el doble de tiempo y la misma nota). Lo que lee el
   chat ha bajado un 6 %. Se podría bajar bastante más en conversaciones de varios mensajes guardando los datos de la
   liga en la caché entre una pregunta y la siguiente, pero hay que tocar el servidor y cómo se ordenan los datos: ¿lo
   hago en otra sesión? Por defecto, no.
5. LO LARGO. 66 de 156 respuestas siguen pasando de 6 frases, casi todas listas que se piden enteras (la plantilla de un
   rival, todas tus cláusulas). Opciones: aceptarlo; o pedir listas de una línea y como mucho 8. Por defecto, aceptarlo.
6. DOS PUJAS PARA EL MISMO JUGADOR. En el parón, con Cubarsí, la app da 44,70 M «para tenerlo» y el plan 49,81 M «para
   revender»; el chat a veces dice «no pujes tanto» contra el plan. ¿Que en el chat la puja del plan mande cuando el
   jugador está en el plan? Por defecto, sin tocar (es de los datos, no de la IA).

### Respuestas de Carlos (19 nov, 05:2x)

1. Plan recogido de antes del cierre: como está (avisa y lo pide él).
2. Oferta el día del partido: 30 M por uno de 28 M que sube +1 M al día es malvenderlo; la app hace bien en decir ESPERAR.
   Hecho: chat-sistema.js le prohíbe a la IA proponer «aceptarla después del partido» cuando la app dice ESPERAR.
3. Lo urgente de Hoy que el plan no lleva: se queda como está.
4. La caché de los datos de la liga entre preguntas: sí, en otra sesión (apuntado en ESTADO.md).
5. Lo largo: preguntó si cuesta mucho. No: casi todo el coste es lo que lee la IA (~32.000 tokens por pregunta) y no
   lo que escribe (~200-400); recortar listas apenas cambia el gasto. Se queda como está salvo que él diga otra cosa.
6. Manda la puja del plan. Hecho: en la línea de cada P- va «PARA REVENDERLO la app puja X: si EL PLAN DE HOY lo lleva,
   la puja que vale es la del plan» (Cubarsí en el parón, 49,81 M) y chat-sistema.js dice que la cifra del plan manda.
   Probado: prueba-ia 111, caso-chat, caso-coherencia, worker datos, azar-plan 40 × semilla 7, 0 fallos.

### Lo que tiene que probar Carlos con su liga y en el móvil

- En Pregunta: «¿qué hago hoy?» y «¿por qué el plan me dice que venda a X?» con un plan que haya hecho la app (sin pedir
  el de la IA): tiene que contestar con ese plan.
- «¿Cuánto me da LaLiga por punto?», «¿qué le puedo fichar al <apodo>?» (con un apodo puesto) y por voz «leao ere
  espabilado»: tiene que saber de quién hablas y darte su plantilla con titulares y próximo partido.
- Uno tuyo que haya girado a la baja y el plan aguante: «¿lo vendo?» no tiene que decir «véndelo».
- Una oferta que la app manda esperar: «¿la acepto?» tiene que decir que esperes (o darte un motivo nuevo).
- Pedir un plan con la IA justo antes del cierre de cláusulas, salir de la app y volver ya cerradas: sale el de la app y
  el aviso «se pidió antes de que se cerraran las cláusulas… pide otro».
- Que no salgan notas, códigos ni «Rival N» en las respuestas, y que las de cosas que no son fantasy sean de una línea.
