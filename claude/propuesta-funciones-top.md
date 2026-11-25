# Propuesta: funciones top nuevas (25 nov 2026, noche)

Encargo: claude/prompt-funciones-top.md del proyecto. Sin código: solo la propuesta. Repo público: aquí no van nombres de otros mánagers, solo cifras agregadas de la liga de Carlos.

## Resumen

| # | Idea | Qué decisión mejora | Coste | Fiabilidad | Horas |
|---|---|---|---|---|---|
| 1 | El contragolpe | Clausular o comprarle a un rival sin darle el dinero para quitarte un titular | 0 peticiones nuevas, 0 KV, menos de 0,1 céntimos de IA por usuario y día | Alta: lo que le pagas es exacto; lo que tenía, ±6,8 M | 3-4 |
| 2 | El parte de los rivales | Ofertar a quien tiene que vender; saber quién no puede pujar ni clausular; no pelearte por lo que otro necesita | 0 peticiones nuevas, 0 KV, 0 IA | Alta en los hechos (25 jugadores, huecos, blindajes); «en rojo» solo cuando es seguro | 4-5 |
| 3 | Quién podrá pagar y cuándo | Cuándo gastar tus 2 blindajes de la jornada | 0 peticiones nuevas, 0 KV | Media-alta: lo que se suma (puntos de la jornada, recompensas) es casi exacto; la base, ±6,8 M | 4-6 |
| 4 | Lo que se paga en otras ligas | Cuánto pujar, sobre todo por los de más de 30 M | 1 llamada al Worker por usuario y cambio de mercado; unas 750 filas al día en un objeto con 100.000 gratis | Es lo pagado de verdad; falta medir si predice tu liga. Hacen falta unas 2 semanas de datos | 1 para empezar a recoger + 3-4 |
| 5 | La demanda de todas las ligas | Comprar antes de que suba y vender antes de que baje | 1 llamada al Worker por carga; unas 15.000 filas al día; 0 IA | Por medir: solo sale si mejora a la inercia. 2-3 semanas de datos | 1 de recogida (con la 4 y la 6) + 3-4 |
| 6 | El riesgo de verdad de que te lo quiten | A quién poner los 2 blindajes | Pocas filas por liga y día; 0 IA | Frecuencia contada en todas las ligas, comprobable. 2-3 semanas | En la misma recogida + 2-3 |
| 7 | El planificador de la semana | Encadenar días sin llegar en negativo ni sin saldo | 0 | Cuentas exactas; los valores, con la inercia | 6-8 |

Las 3 que haría primero, en este orden: el contragolpe, empezar a recoger de todas las ligas lo que necesitan la 4, la 5 y la 6 (una sola sesión, sin enseñar nada todavía) y el parte de los rivales. El porqué, al final.

## Lo que ya hay (para no repetirlo)

Antes de proponer nada se miró qué existe ya: quién puede pagar tus cláusulas ahora (`M.quienPaga`), quién puja por un libre (`quien-puja.js`), la inercia y el Radar, cómo juega cada rival con la hora a la que se mueve (`M.perfil`, gratis), el peligro de cada rival (`M.rivales`), la calculadora de tratos (`M.trato`), los avisos de cláusulas (las tuyas y «Avisarme de este jugador» para las de los rivales), el blindaje que manda el plan (`M.paraEscudo`, solo con la cláusula ya abierta) y el aviso en directo de clausular al que está haciendo muchos puntos. Nada de lo de abajo pisa eso: o es una pregunta que hoy no se contesta o le añade el reloj a una que sí.

## Cifras de la liga de Carlos que se usan

De claude/medida-ia-2026-11-20.md (del 30 ago al 12 nov) y claude/medida-quien-puja-24nov.md del proyecto. Liga de 9 mánagers.

- 43 clausulazos, 96 traspasos entre mánagers, 163 ventas a LaLiga y 368 compras al mercado.
- El dinero estimado de un rival tiene un margen mediano de 6,8 M; en 139 pagos con saldo de rivales, la cuenta se escapó del margen en 4 (el 3 %).
- Los jugadores que la app manda quedarse subieron +2,0 M de media en 7 días, y los que manda proteger, +2,4 M. Es lo que pierdes si te los clausulan a su valor.
- La puja que propone la app gana el 54 % de las veces (se busca el 60 %); con los de más de 30 M, el 42 %.
- LaLiga paga por lo que pones a la venta +6,7 % sobre el valor de mediana (el 98 % entre ±10 %). Lo pagado entre mánagers queda en 0,95 de lo que ofrecería la app, de mediana.

## Lo que hacen otras apps

- Comuniate calcula el dinero de los rivales y su puja máxima en Biwenger, Comunio y LaLiga Fantasy, y tiene un «balance» de quién compra y vende mejor ([balance](https://www.comuniate.com/noticias/37406/herramienta-balance-comunio-descubre-quien-es-el-mejor-gestor-de-tu-comunidad)). Su «mercado inteligente» da una puja ideal con la tendencia y el histórico del valor ([mercado inteligente](https://www.comuniate.com/mercado-inteligente/laliga-fantasy)).
- Asesorías Fantasy tiene un asesor con IA que calcula la puja a partir del valor que le escribes a mano ([puja ideal](https://asesoriasfantasy.com/tu-puja-ideal-fantasy/)).
- Analítica Fantasy y futbolfantasy: onces probables, estadísticas, proyecciones de valor. Nada de tu liga.
- Lo que los usuarios hacen a mano y ninguna app les da: Comuniate cuenta como truco ofertar algo más del valor a quien tiene que vender para salir de rojos ([truco](https://www.comuniate.com/noticias/10041/truco-comunio-para-que-te-acepten-ofertas-en-tu-comunidad)) y adelantarse fichando el portero que necesita un rival para revendérselo ([buitres](https://www.comuniate.com/noticias/2450/los-buitres-del-comunio-en-fantasy-no-hay-amigos)). Es la idea 2.

Ninguna mira lo que pasa después de tu jugada (idea 1), ni el reloj de las cláusulas con el dinero que entra (idea 3), ni lo pagado de verdad en otras ligas (idea 4): todas estiman con el valor.

---

## 1. El contragolpe

**Qué ve el usuario.** Antes de clausular o de comprarle a un rival, en la ficha del jugador y en el plan: «Si se lo quitas, este rival cobra 62 M al momento y le llega para tu Huijsen (57,4 M, abierta). Blíndalo antes o espera a que se cierre». Ejemplo con cifras de la liga (el reparto es inventado): vas a clausular un jugador de 62 M a un rival que tiene unos 8 M (±6,8). Al pagar se queda con unos 70 M: aun restándole el margen, 63 M, le llega seguro para Huijsen. Y si ese rival tenía 25 jugadores, al quitarle uno le dejas el hueco que le faltaba para clausular.

**Por qué cambia el juego.** Cada clausulazo y cada compra a otro mánager le da dinero al momento, y en LaLiga una cláusula solo se paga con saldo: es justo lo que le faltaba a quien no podía. En tu liga hay un clausulazo o un traspaso casi cada día (139 en 75 días). Si te devuelve el golpe con uno que sube, pierdes lo que iba a subir (+2,4 M en 7 días de media con los que la app manda proteger), los puntos y el dinero de la cláusula que pagaste para nada. Mejora tres decisiones: clausular o no, blindar antes y en qué orden hacer las cosas (primero el blindaje, después el pago).

**Datos y coste.** Ya está todo en la app: `M.capacidad(tid)` más lo que le pagas, tus cláusulas abiertas o que se abren en las próximas 24 h (`M.mias`), los blindajes puestos y la plantilla de cada uno (los 25). Una función nueva en motor.js, `M.contragolpe(tid, importe, { quitaUno })`, que reaprovecha `quienPaga` y que leen la ficha, el plan y `M.trato`. 0 peticiones a LaLiga, 0 escrituras de KV. IA: una línea más en el plan y en el chat, unos 50-100 tokens; con Haiku, menos de 0,1 céntimos por usuario y día. No hace falta guardar nada nuevo.

**Fiabilidad.** Lo que le pagas es exacto; lo que tenía, con el margen de 6,8 M. Tres niveles: «le llega seguro» (aun restando el margen), «puede» (dentro del margen) y nada. Cómo se comprueba: con .github/ia/medir-motor.mjs sobre los 43 clausulazos y los 96 traspasos, cuántas veces el que cobró clausuló al que le pagó en las 48 h siguientes, y en cuántas fue ese cobro lo que le hizo llegar. Ese número hoy no se sabe y es la primera hora de la sesión: si en tu liga casi no pasa, la idea baja de puesto y se hace antes la idea 3.

**Por qué top.** Es la mitad de «quién paga» que hoy falta: quién paga después de tu jugada, justo antes de gastarte 30-60 M. Gratis no queda coja: el plan no te manda un clausulazo que te deja expuesto «seguro» y lo dice sin nombres ni cifras («descartado: te deja expuesto»), como ya hace con las categorías. Con anuncio: qué rival, a cuál de tus jugadores y con cuánto le llega. Mecánica: dentro de la llave de `quienPaga` (1 anuncio, 5 h), porque es la misma pregunta; si Carlos la quiere aparte, llave propia con 1 anuncio hasta medianoche, como la inercia.

**Riesgos.** Que la IA lo suelte con la función cerrada (M4): con `quienPaga` cerrado solo recibe «te expone: sí o no», se añade al mapa de ia.js de lo que no se cuenta de lo cerrado y a `sinDineroCerrado`. Ojo con una fuga menos obvia: «le llega para Huijsen» da una cota del dinero del rival (al menos 57,4 M menos lo que le pagas); con su dinero cerrado no se puede decir ni eso en abierto. Play y LaLiga: nada nuevo. Privacidad: datos de tu propia liga, en tu móvil.

**Complejidad.** Media. Opus 5.5, esfuerzo alto (toca el plan y la IA: caso-contradicciones, azar-plan con dos semillas, caso-dinero). 3-4 h: 1 de medida y 2-3 de motor, ficha, plan y pruebas.

---

## 2. El parte de los rivales

**Qué ve el usuario.** En Rivales, una hoja «Parte de la jornada» con una línea por rival y solo lo que cambia lo que puedes hacer:
- «En rojo seguro: ganó una puja de 31 M y se queda en unos −9 M. Tiene que vender antes del viernes a las 21:00. Lo que menos le quita del once: un medio de 12 M. Ofrécele 12,9 M antes del cambio de mercado.»
- «25 jugadores: no puede pujar ni clausular hasta que venda.»
- «Sin portero titular (el suyo está lesionado): va a pujar por los porteros del mercado.»
- «Le queda 1 blindaje de 2 esta jornada.»

**Por qué cambia el juego.** Quien empieza la jornada en negativo no puntúa (el motor ya lo da por hecho para ti en `prisaNegativo`), así que acepta ofertas que otro día no aceptaría. Y en rojo no puede clausular, porque la cláusula va con saldo: durante ese rato no es una amenaza. Con 25 jugadores pasa lo mismo con las pujas y las cláusulas. Saber que otro va corto de un puesto es lo que más ayuda a adivinar quién puja (en la medida de quién puja, acertar al primero sube del 34,6 % al 45,7 % solo con eso): o no te peleas por ese jugador o lo fichas tú para revendérselo. En tu liga hay casi un traspaso al día (96 en 75 días): el parte dice cuáles son los que el otro está obligado a hacer. Lo que se gana: un titular a su valor más poco en vez de por su cláusula, y pujas sin pelea.

**Datos y coste.** Todo lo baja ya la app: plantillas, estado y lesiones, `M.mejorOnce` sobre la plantilla de cada rival, las compras ganadas con su importe (actividad), `M.capacidad` y los blindajes (la actividad de tipo blindaje, con el historial guardado `extra.actHist`, como `M.escudosMios`). La oferta, la de `ofertaDueno`, pero tiene que ganarle a lo que le daría LaLiga si lo pone a la venta (+6,7 % de mediana) o llegar antes de ese cambio de mercado. 0 peticiones nuevas, 0 KV, 0 IA (si el plan lo lee, unos 100 tokens más).

**Fiabilidad.** Los 25, los huecos y los blindajes son hechos de LaLiga. «En rojo» solo se dice si es seguro: negativo incluso sumándole el margen. Si no, no se dice nada (nunca «puede que esté en rojo»). Cómo se comprueba con el banco: en J4-J13, los rivales que la app habría marcado en rojo seguro antes del primer partido, ¿vendieron antes? ¿Cuántos se quedaron sin puntuar? Y los huecos, contra quién se llevó de verdad los porteros y los puestos que le faltaban.

**Por qué top.** Es lo que sabe el mánager que lo mira todo cada día y los demás no, junto en una pantalla en vez de rival a rival. Mecánica: 2 anuncios abren el parte entero hasta que empiece la jornada. Gratis siguen «Cómo juega cada rival» y lo que venden. Solapa algo con el dinero: «en rojo» es una pista del dinero de todos los rivales con 2 anuncios, frente a 2 anuncios por rival en el dinero; por eso solo se enseña el signo, y solo cuando es seguro, nunca la cifra.

**Riesgos.** M4: la IA con el parte cerrado no dice quién está en rojo ni quién tiene 25. Privacidad: es tu liga, pero «está en rojo» de un amigo no tiene que salir en las tarjetas para el grupo ni en las pullitas. Regla que confirmar con Carlos antes de hacerla: si se empieza la jornada en negativo, ¿no puntúa toda la jornada o solo hasta que sale del rojo?

**Complejidad.** Media. Opus 5.5, esfuerzo alto (pantalla nueva y reglas del motor). 4-5 h.

---

## 3. Quién podrá pagar y cuándo

**Qué ve el usuario.** En Equipo → Cláusulas, una línea de tiempo por cada jugador tuyo que se abre en los próximos 7 días: «Huijsen se abre el martes a las 20:00. Hoy le llega a 1 rival; el lunes por la noche, con lo que cobran de la jornada (los puntos que llevan a 100 mil el punto), a 3. Blíndalo el martes a las 19:55: el blindaje dura 24 h». Y lo mismo al revés con la cláusula de un rival que quieres: quién más podrá pagarla a esa hora y si suele clausular en el primer rato (eso ya lo sabe `M.perfil`).

**Por qué cambia el juego.** Hay 2 blindajes por jornada y cada uno dura 24 h (48 en ligas premium, `M.ESCUDO_H`): puesto a mala hora se gasta sin proteger nada. Hoy el plan solo blinda lo que ya está abierto. Y el mayor ingreso de la semana entra a todos a la vez al acabar la jornada (60 puntos son 6 M): una cláusula tuya que el domingo no pagaba nadie puede pagarla medio grupo el lunes. Mejora el blindar (cuándo y a quién) y el clausular de los rivales (si merece la pena esperar a la apertura).

**Datos y coste.** `M.capacidad` más lo que va a entrar: los puntos de la jornada en directo (vivo.js y la clasificación de la jornada, que ya se piden) por 100 mil, la recompensa diaria (1 o 2 de 100 mil), la oferta de LaLiga de lo que tengan a la venta (±10 %) y las aperturas (`protegidoHasta`, `M.vedas`). El aviso, uno local a la hora buena (avisos.js; Android e iPhone; en la web no hay). 0 peticiones nuevas, 0 KV, 0 IA.

**Fiabilidad.** Lo que se suma es casi exacto: los puntos se saben en directo y al cerrar la jornada cambian pocos (1 punto son 100 mil). La base, con el margen de 6,8 M. Cómo se comprueba: con el banco, para cada cláusula tuya que se abrió en J4-J13, lo que la app habría dicho 48 h antes frente a si se pagó y quién la pagó.

**Por qué top.** Es «quién paga» con reloj, así que va con su misma llave (1 anuncio). Propuesta: que esa llave pase de 5 h a hasta medianoche, para que sirva para planear el día. Gratis sigue el aviso de que se abre una cláusula tuya y el blindaje del plan con lo que ya está abierto.

**Riesgos.** M4, igual que `quienPaga`. En el iPhone caben 64 avisos pendientes: este va entre los más cercanos. Play: notificaciones, nada nuevo.

**Complejidad.** Media-alta (la línea de tiempo del dinero de cada rival y la hora del blindaje). Opus 5.5, esfuerzo alto. 4-6 h.

---

## 4. Lo que se paga en otras ligas

**Qué ve el usuario.** En la ficha de un libre del mercado: «En los 3 últimos días se lo han llevado en 9 ligas que usan la app: +11 % sobre su valor de mediana, el que más, +19 %». Ejemplo con la liga (las cifras de otras ligas son inventadas: hoy no se guardan): por Pepelu (59,9 M) la app proponía el 24 nov 69,96 M, un +17 %. Si en otras ligas se ha pagado entre +8 y +12 %, te sobran unos 3 M; si entre +18 y +25 %, te quedas corto.

**Por qué cambia el juego.** La puja de la app gana el 54 % (se busca el 60 %) y con los de más de 30 M, el 42 %: con los caros es donde más se falla y donde más dinero se tira o se pierde. El valor de mercado es el mismo en todas las ligas, así que lo pagado estos días por ese mismo jugador en otras ligas es la mejor pista que hay. Nadie la tiene: las demás calculan su puja ideal con la tendencia del valor, no con lo que se pagó.

**Datos y coste.** Cada app ya manda al Worker las compras de su liga, sin nombres (`/pujas`, objeto «pujas|todos», 120 días), pero sin decir de qué jugador: solo el valor, lo pagado de más y la subida. Hace falta añadir el id del jugador (público, no identifica a nadie) y una ruta `GET /pujas/jug?ids=…` con lo de los 3 últimos días por jugador. Coste: una llamada por usuario y cambio de mercado (con 1.000 usuarios, unas 2.000 peticiones al objeto al día de 100.000 gratis) y unas 750 filas nuevas al día con 150 ligas de 5 compras (de 100.000). 0 peticiones a LaLiga, 0 KV, 0 IA. Empieza vacío: unas 2 semanas hasta que los que más se mueven tengan 3 compras o más.

**Fiabilidad.** Es lo pagado de verdad, no una estimación. Lo que hay que medir es si sirve para tu liga: para cada compra de tu liga, el error de `M.pagaLiga` frente al de la mediana de otras ligas de los 3 días antes. Si no mejora, se enseña como dato y no toca la puja. Con menos de 3 compras, no se enseña.

**Por qué top.** Es información que tu rival no tiene. Mecánica: 1 anuncio, hasta medianoche. Gratis sigue la puja que propone la app.

**Riesgos.** Privacidad: sin liga, sin mánager y el id de la actividad con hash; va con «Ayudar a mejorar la IA», como lo de ahora. Hay que contarlo en privacidad.html y repasar la ficha de seguridad de datos de Play y de la App Store. LaLiga: juntar datos de muchas ligas en un servidor es lo que más se parece a explotar su API, así que solo dentro de la app: ni en la web pública ni en el bot de X. Trampas: una liga que infle pujas a propósito pesa poco (mediana, y ya hay tope de 4 envíos al día por cuenta).

**Complejidad.** Media. Opus 5.5, esfuerzo alto (Worker, app y privacidad). 1 h para empezar a recoger (el id en `/pujas` y guardarlo) y 3-4 h para la ficha y la medida cuando haya datos.

---

## Segunda ronda (25 nov, 23:5x): lo que solo se ve juntando todas las ligas

Lo que más falta en España, mirando las herramientas inglesas: Fantasy Football Fix cobra por adelantar los cambios de precio con lo que compra la gente, por enseñar qué hacen los mejores mánagers antes del cierre y por un planificador de jornadas con varios borradores ([premium](https://www.fantasyfootballfix.com/premium/); [extensión](https://www.fantasyfootballfix.com/extension/)), y la Premier ha sacado su propio predictor oficial con los datos de fichajes de todos ([Premier League](https://www.premierleague.com/en/news/4680462/whats-new-in-202627-fantasy-price-change-predictor)). Aquí nadie puede hacer eso: Comuniate o Analítica solo ven el valor de cada jugador, no lo que pasa dentro de las ligas. Fantasy Manager sí, porque cada usuario entra con su liga y la app ve su mercado, sus pujas y sus cláusulas. Con unas 150 ligas distintas usando la app (las altas del 25 nov eran casi todas de ligas distintas), eso es una ventaja que no tiene nadie.

De ahí salen tres funciones que comparten la misma recogida. Las tres necesitan semanas de datos, así que lo que importa es empezar a recoger ya.

### 5. La demanda de todas las ligas (el cambio de valor de esta noche)

**Qué ve el usuario.** En la ficha y en el Radar: «Hoy pujan por él en 23 de las 140 ligas de la app (ayer en 9): lo normal con eso es que suba esta noche». Ejemplo con la liga: un libre de 12 M que tu inercia da por parado pero que se ha puesto de moda en otras ligas.

**Por qué cambia el juego.** Comprar el día antes de la subida y vender el día antes de la bajada es lo que más dinero mueve entre jornadas: en tu liga, los que la app manda vender bajaron un 79 % de las veces y −1,4 M de media en 7 días. La inercia solo mira el valor pasado. Si el valor de LaLiga se mueve con lo que puja y compra la gente, como en la Premier, la demanda de hoy dice antes que nadie quién va a subir o a bajar.

**Datos y coste.** Cada app ya apunta cuántas pujas lleva cada libre de su mercado y cuándo suben (pujas-vistas.js). Hace falta mandarlo sin liga ni nombre: id del jugador, número de pujas y hora, una llamada al Worker por carga de la liga. Con 150 ligas y 5 cargas al día, unas 15.000 filas al día, dentro de lo que incluye Workers Paid. Leerlo: una llamada por cambio de mercado. 0 IA. Útil a las 2-3 semanas.

**Fiabilidad.** Lo que no se sabe es si el valor de LaLiga depende de la demanda: hay que medirlo antes de enseñar nada. Cómo: con lo recogido, ¿la demanda de hoy explica la subida de mañana más allá de la inercia? La inercia falla hoy unos 216 mil a 3 días. Si la demanda no mejora ese error, la función no sale (y la recogida sigue sirviendo para la 4).

**Por qué top.** Es información que nadie más tiene, ni dentro ni fuera de tu liga. 1 anuncio, hasta medianoche, como la inercia; o dentro de la inercia como un dato más.

**Riesgos.** Los mismos que la 4: privacidad (sin liga ni mánager, con «Ayudar a mejorar la IA»), ni en la web pública ni en el bot de X. Una cosa más: decir «en 23 ligas» deja ver cuántas ligas usan la app; mejor un nivel («mucha demanda») que la cifra.

**Complejidad.** Media. Opus 5.5, alto. La recogida, 1 h (junto con la de la 4 y la 6). La medida y la ficha, 3-4 h a las 3 semanas.

### 6. El riesgo de verdad de que te lo quiten

**Qué ve el usuario.** En cada jugador tuyo con la cláusula a punto de abrirse: «En las ligas de la app, a un jugador como este (40 M, cláusula a su valor, subiendo) se lo llevan en las primeras 24 h el 35 % de las veces; en tu liga, el que lo puede pagar clausula mucho». Y el blindaje del plan, a los dos de más riesgo por lo que perderías.

**Por qué cambia el juego.** Tienes 2 blindajes por jornada: lo que importa es ponerlos en los dos que de verdad se van a llevar. El peligro de cada rival que calcula hoy la app separa poco (AUC 0,64 con tu liga) porque una liga de 9 da pocos casos: 43 clausulazos en 75 días. Con todas las ligas hay casos de sobra para saber qué cláusulas se pagan y cuáles no.

**Datos y coste.** Cada app ve todas las cláusulas de su liga, cuándo se abren y si alguien las paga. Al abrirse una, se apunta sin nombres: tramo de valor, cláusula sobre valor, tendencia, puesto, si es titular y si se la llevaron en 24 h. Para no contarla dos veces cuando hay varios usuarios de la misma liga, con una huella de la liga que no se puede deshacer. Unas pocas filas por liga y día. 0 IA.

**Fiabilidad.** Es una frecuencia contada, no una opinión. Se comprueba con lo que pase después: si de los que se dan al 35 % se acaban llevando unos 35 de cada 100, la cifra vale. Con tu liga sola no sirve; con las demás, en 2-3 semanas.

**Por qué top.** Junto con «quién paga» y la idea 3 dice a quién blindar y cuándo, que es donde se pierde el titular. Va con la llave de `quienPaga`.

**Riesgos.** La huella de la liga tiene que ser de verdad irreversible (con una sal del servidor que no salga de él). Contarlo en privacidad.html.

**Complejidad.** Media. Opus 5.5, alto. Recogida, dentro de la misma hora; la ficha, 2-3 h.

### 7. El planificador de la semana

**Qué ve el usuario.** Una pantalla de borradores: «el martes vendo a X, el miércoles pujo 15 M por Y, el jueves clausulo a Z». La app va diciendo día a día el saldo, si llegas en positivo al primer partido, si te pasas de 25, qué cláusulas tuyas se abren y quién podrá pagarlas, con hasta 3 borradores para comparar.

**Por qué cambia el juego.** El plan del día dice qué hacer hoy; los errores caros salen de encadenar días (llegar en negativo al viernes, quedarte sin saldo justo cuando se abre la cláusula que querías). Las herramientas inglesas cobran justo por esto.

**Datos y coste.** Todo está en el motor (`M.trato`, `M.capacidad`, `M.vedas`, las reglas del árbitro de banco.mjs). 0 peticiones, 0 KV, 0 IA. Las cuentas son exactas; lo único estimado, los valores de los próximos días (inercia).

**Por qué top.** Es para el que juega en serio. Gratis sigue el plan del día. 1 anuncio, hasta medianoche.

**Riesgos.** Que diga algo distinto del plan del día (la regla de que la app no se contradice): tiene que usar las mismas decisiones de decide.js.

**Complejidad.** Alta (pantalla nueva y mucha interacción). Opus 5.5, alto. 6-8 h. Es la última por impacto entre su coste y lo que ya cubre el plan.

## Descartadas, y por qué

- Pujar de más para que la cláusula quede alta: la cláusula al fichar es lo pagado, o el valor si es más (motor.js), y con los que suben el valor la alcanza antes de que acaben los 14 días. Solo serviría con los caros que no se mueven: poco dinero.
- Vender a un rival en vez de a LaLiga: LaLiga paga +6,7 % de mediana y entre mánagers se paga 0,95 de lo que ofrecería la app. No hay margen claro que enseñar.
- Avisar en el momento de que un rival se ha puesto a tiro: con la app cerrada, Android mira cada 3 h y el iPhone no mira. El contragolpe y el calendario lo avisan antes de que pase, que es cuando se puede hacer algo.
- El once del rival o la clasificación prevista: en LaLiga Fantasy no hay cara a cara; no cambia ninguna decisión de dinero.
- Detectar tratos raros entre dos mánagers: da para pullitas, no para jugar mejor.

## Las 3 primeras, y por qué en ese orden

1. El contragolpe. Es la más barata, no necesita datos nuevos y evita el error más caro: gastarte 60 M en un clausulazo y que te quiten un titular con tu propio dinero. Empieza midiendo; si en tu liga casi no pasa, se cambia por la idea 3.
2. Empezar a recoger de todas las ligas, en una sola sesión de unas 2 h: lo que se paga por cada jugador (4), cuántas pujas lleva cada libre (5) y qué cláusulas se abren y se pagan (6). No se ve nada todavía, pero las tres necesitan 2-3 semanas de datos y cada día sin recoger es un día más de espera. Es lo que ninguna otra app puede copiar.
3. El parte de los rivales. La que más cambia cómo se juega la semana y casi todo son hechos.

Después: la 3 (con el cambio de la llave de `quienPaga` a hasta medianoche, y ya sumando el premio de la jornada antes de que LaLiga lo pague: hoy el dinero de cada rival lo cuenta solo cuando aparece en los movimientos), y la 4, la 5 y la 6 cuando haya datos y se haya medido que aciertan. La 7, al final.

Antes del parte, preguntarle a Carlos la regla del negativo al empezar la jornada.
