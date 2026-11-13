# Revisión a fondo de la IA (plan del día y chat) — 13-14 nov 2026

Pedida por Carlos el 13 nov («no quiero más parches: quiero que deje de fallar por sistema»). Versión: 0.7.9.

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
   app descartaba después casi todas (en la liga de ejemplo, 61 de 62). De ahí los «Descartado por la app» y el titular
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

Sin comprobar (la app las usa, pero nadie las ha confirmado): que el blindaje se pueda poner durante el cierre de 24 h
y que al aceptar una oferta el dinero entre al instante.

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
  por la app» con lo que es de verdad. Una respuesta correcta sale tal cual (cuatro casos de control lo vigilan).
- **Después, en el plan.** `cuadrarPlan` sigue igual, con tres agujeros tapados (catálogo, 7).

Modelo, temperatura y razonamiento: se quedan como estaban (el mejor modelo que tenga la clave, pensando «poco», sin
temperatura en los 3.x como pide Google). Con la app decidiendo, pensar más no arregla nada y tarda el doble. Lo que sí
ha salido en la medida: los tres mejores modelos dan unas 20 preguntas al día con la clave gratis, así que un usuario
que tire mucho del chat acaba en el ligero. Con menos tokens por pregunta eso no cambia (el tope es por pregunta).

## Las pruebas

- `.github/ia/casos.mjs`: 72 casos, cada uno con el fallo de donde sale. 41 llevan escrita la respuesta mala de la IA
  y 31 se preguntan a la IA de verdad.
- `.github/prueba-ia.mjs` (sin red; va en la Action «Pruebas» en cada push): los 41. Google es de mentira
  (`.github/ia/banco.mjs`): la app corre entera, con la liga de ejemplo a una hora fija, y se mira lo que acaba viendo
  el mánager.
- Con la IA de verdad: `node .github/ia/montar.mjs` (lo que la app mandaría), rama `pruebas-ia` (no se fusiona; su
  Action lo manda a Gemini y deja `respuestas.json` de artefacto) y `node .github/ia/puntuar.mjs respuestas.json`.
  Con dos lotes (`pedidos.json` y `pedidos-b.json`) pregunta cada caso dos veces con el mismo modelo, para comparar
  antes y después. Gasta 31 preguntas por lote: con el cupo gratis, una pasada al día con los modelos buenos.

## Lo que queda (por orden de lo que más daría)

1. Repetir la pasada con la IA con los modelos buenos (cuando vuelva el cupo, a partir de las 9:00) y dos o tres veces,
   para tener un porcentaje y no una sola tirada.
2. Que el plan nazca del motor: hoy la IA aún escribe la lista de operaciones. El paso siguiente es que la app proponga
   el plan (`planAuto` ya existe) y la IA solo lo ordene, lo recorte y lo explique. Quitaría del todo los descartes.
3. Recortar las fichas de los jugadores en el plan (31.000 caracteres los suyos y 25.000 los del mercado): son ya más
   de la mitad de lo que lee.
4. Si «Revisado por la app» sale a menudo con su liga, pedirle a la IA que reescriba la respuesta con las correcciones
   (una pregunta más de cupo) en vez de añadirlas debajo. Decidirlo con Carlos.
5. Casos nuevos: cada fallo que avise Carlos o Domy entra primero en `casos.mjs` y después se arregla.
