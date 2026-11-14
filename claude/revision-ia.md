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
- 14: que la IA vuelva a buscar en Google. SIN HACER en esta sesión (sesión aparte): toca el Worker (`tools` con
  `web_search_20250305`, `max_uses`, 0,01 $ por búsqueda más los tokens de los resultados; hay que tenerlo activado en la
  consola de Anthropic), las instrucciones del plan corto, `planLimpio` (que deje pasar las fuentes) y `aplicarCorto`
  (que una noticia con fuente de la búsqueda valga para quitar o meter). Medirlo en `pruebas-ia` antes de prometer nada:
  hoy un plan cuesta ~0,0018 $; con 2 búsquedas, del orden de 0,02-0,03 $.

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
