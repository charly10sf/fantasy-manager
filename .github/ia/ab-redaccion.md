# Redacción con la guía de antes y con la nueva (2026-11-22 23:09 UTC)

26 tuits reales de ahora (los hechos de `ejecutar.mjs --volcar`), redactados con Sonnet cada uno con su segunda lectura, como en el bot, y con los últimos tuits de cada tipo del registro de bot-estado. Antes: el código de f8df132 (`pendiente` del 22 nov). Ahora: `bot-redaccion`.

| | antes | ahora |
|---|---|---|
| redactados | 11 de 26 | 8 de 26 |
| llamadas a la IA | 52 | 51 |
| gasto | 1.2806 $ | 1.1832 $ |
| por tuit | 0.0493 $ | 0.0455 $ |
| por tuit redactado | 0.1164 $ | 0.1479 $ |
| instrucciones fijas (final) | 24186 car. | 14885 car. |
| palabras por tuit | 66 | 61 |
| emojis por tuit | 2.1 | 0.9 |
| sin emoji arriba | 0 | 8 |
| «si lo tienes» / «quien lo tenga» | 4 | 0 |
| «ya suma» | 3 | 0 |
| «de momento» / «por ahora» | 0 | 3 |
| «el pase es de» | 2 | 1 |
| «la mete» / «la manda dentro» | 2 | 1 |
| «más del doble» / «de lo que suele» | 8 | 4 |
| «Liga, Champions…» / «primer gol» | 3 | 0 |
| «en racha» / «jornadas seguidas» | 1 | 1 |
| «el mejor de los dos equipos» | 0 | 0 |
| «se va» con marcador | 0 | 0 |
| «se va a N» | 4 | 0 |
| «sin sorpresas» | 0 | 0 |
| la hora del reloj | 11 | 12 |
| inicial con punto («Y. Zabiri») | 9 | 0 |

## 1. directo · `directo|128|Tajon Buchanan|gol1`

**Antes** (redactado, 1 llamada, 0.0252 $)

> ⚽ ¡GOLAZO DE LEJOS! Buchanan la cuelga desde unos 25 metros en el 5' y el Villarreal 🚢 se adelanta en el campo del Barça: 0-1.
> 
> El canadiense ya suma 8 puntos, más del doble de su media.

**Ahora** (redactado, 1 llamada, 0.0183 $)

> ⚽ ¡GOLAZO DE LEJOS! Buchanan arma la pierna desde unos 25 metros y el Villarreal se adelanta en el 5': 0-1 al Barça.
> 
> El canadiense lleva 8 puntos de momento, más del doble de su media.

## 2. directo · `directo|128|Tani Oluwaseyi|gol1`

**Antes** (redactado, 1 llamada, 0.0255 $)

> ⚽ Oluwaseyi la mete en el 7' y el Villarreal 🚢 amplía: 0-2 en el campo del Barça.
> 
> Ya lleva 7 puntos, y es su cuarto gol entre Liga, Champions y Copa. Moleiro da el pase y suma 5.

**Ahora** (redactado, 1 llamada, 0.0186 $)

> ⚽ Oluwaseyi pone el 0-2 en el marcador en el 7' y el Villarreal amplía su ventaja en el Barça.
> 
> El delantero canadiense se mete en 7 puntos de momento. Moleiro, autor del pase, va por 5.

## 3. directo · `directo|128|Gerard Martín|gol1`

**Antes** (redactado, 1 llamada, 0.0255 $)

> ⚽ Gerard Martín recorta para el Barça de cabeza en el 57': 1-2 contra el Villarreal 🚢.
> 
> Es su primer gol entre Liga, Champions y Copa, y el defensa ya suma 10 puntos, casi el doble de su media. El pase es de Pedri, que se lleva 11.

**Ahora** (plantilla (rechazada), 2 llamadas, 0.038 $)

> ⚽ Gol de Gerard Martín y el Barça se mete en el partido: Barça 1-2 Villarreal. Gerard Martín suma 10 puntos y Pedri, que da el pase, 11.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) directo|128|Gerard Martín|gol1, intento 1:
-   (redactar) directo|128|Gerard Martín|gol1, intento 2: palabras con mayúscula que no están en los hechos: Camp, Nou; los puntos frente a su media («más del doble»,
-   (redactar) directo|128|Gerard Martín|gol1: no ha pasado la redacción (rechazada)
</details>

## 4. directo · `directo|128|Fermín López|gol1`

**Antes** (redactado, 1 llamada, 0.0257 $)

> ⚽ Fermín llega desde segunda línea y la mete en el 61': el Barça empata 2-2 contra el Villarreal 🚢.
> 
> Ya suma 6 puntos y es su noveno gol entre Liga, Champions y Copa. El pase es de Lamine Yamal, que se lleva 9.

**Ahora** (redactado, 1 llamada, 0.0186 $)

> ⚽ El Barça empata en el 61': Fermín se planta en el área desde segunda línea y la manda dentro para el 2-2 ante el Villarreal.
> 
> Lleva 6 puntos de momento. El pase es de Lamine Yamal, que va por 9.

## 5. directo · `directo|128|Fermín López|roja`

**Antes** (redactado, 1 llamada, 0.0251 $)

> 🟥 Roja a Fermín en el 75': el Barça se queda con diez, aunque va ganando 3-2 al Villarreal 🚢.
> 
> El centrocampista se queda en 6 puntos. Si lo tienes, ahí se corta.

**Ahora** (redactado, 2 llamadas, 0.0365 $)

> 🟥 Roja a Fermín en el 75' y el Barça se queda con diez, con el 3-2 al Villarreal todavía en el marcador.
> 
> El centrocampista se va con 6 puntos. Los azulgranas tendrán que aguantar el resultado con un jugador menos.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) directo|128|Fermín López|roja, intento 1: dice
</details>

## 6. directo · `directo|128|Pau Navarro|roja`

**Antes** (redactado, 1 llamada, 0.0252 $)

> 🟥 Roja a Pau Navarro en el 90+3': el Villarreal 🚢 se queda con diez cuando el partido ya está perdido, 3-2 para el Barça.
> 
> El defensa se queda en -3 puntos. Si lo tienes, jornada para olvidar.

**Ahora** (plantilla (rechazada), 2 llamadas, 0.0365 $)

> 🟥 Roja para Pau Navarro en el 90+3': Barça 3-2 Villarreal. El Villarreal se queda con diez y encima va perdiendo. Se queda en -3 puntos.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) directo|128|Pau Navarro|roja, intento 1: los dos últimos tuits de este tipo ya empiezan por el nombre de un jugador: empieza por otra cosa (el equipo, el minuto, lo que supone)
-   (redactar) directo|128|Pau Navarro|roja, intento 2: en directo solo van las cifras del tuit de partida: 1 no sale en él
-   (redactar) directo|128|Pau Navarro|roja: no ha pasado la redacción (rechazada)
</details>

## 7. final · `final|123`

**Antes** (plantilla (rechazada), 4 llamadas, 0.1369 $)

> 🏁 Rayo 0-1 Valencia. El Valencia gana por la mínima. Copete acaba con 15 puntos. Detrás, Tárrega y Dimitrievski, con 13 cada uno. De Frutos suma 6 aunque el Rayo Vallecano pierde.
> 
> ✅ Tarde redonda de Copete
> 
> Fantasy Manager · enlace en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|123, intento 1: el revisor no lo publicaría:
-   (redactar) final|123, intento 2: nombra un club o un jugador con una palabra vaga («el equipo»); copia un ejemplo de la guía («puntos mas del doble de su media y…»): dilo con tus palabras
-   (redactar) final|123, intento 3: el revisor no lo publicaría:
-   (redactar) final|123, intento 4: copia un ejemplo de la guía («puntos mas del doble de su media y…»): dilo con tus palabras
-   (redactar) final|123: no ha pasado la redacción (rechazada)
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0998 $)

> Rayo 0-1 Valencia. El Valencia gana por la mínima. Copete acaba con 15 puntos. Detrás, Tárrega y Dimitrievski, con 13 cada uno. De Frutos suma 6 aunque el Rayo Vallecano pierde.
> 
> Tarde redonda de Copete
> 
> Fantasy Manager · enlace en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|123, intento 1: el revisor no lo publicaría:
-   (redactar) final|123, intento 2: el revisor no lo publicaría:
-   (redactar) final|123, intento 3: los puntos frente a su media («más del doble»,
-   (redactar) final|123, intento 4: habla de
-   (redactar) final|123: no ha pasado la redacción (rechazada)
</details>

## 8. final · `final|121`

**Antes** (redactado, 3 llamadas, 0.0903 $)

> 🏁 1-1 en el Sánchez-Pizjuán entre el Sevilla y el Betis, con el empate sevillista en el 90+1' de Kike Salas. Antony había puesto por delante a los béticos en el 50'.
> 
> Antony es el que más puntos saca de los dos equipos: 14, más del doble de su media de 5,5. Kike Salas se va a 13, casi el doble de lo que suele dar, e Isco pone 9: buena noche para quien tenga bético o a Salas.
> 
> Lo malo, también en el Betis: Cucho y Junior se quedan en -1, lo peor del partido.
> 
> 📲 Fantasy Manager (enlace en la bio)

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|121, intento 1: copia un ejemplo de la guía («se va a 14 puntos mas del doble…»): dilo con tus palabras
-   (redactar) final|121, intento 2:
</details>

**Ahora** (redactado, 3 llamadas, 0.0735 $)

> Empate 1-1 entre el Sevilla y el Betis en el Sánchez-Pizjuán, con el gol del empate en el último suspiro. Antony adelantó a los béticos en el 50' y Kike Salas igualó en el 90+1'.
> 
> Antony acaba con 14 puntos y es quien más saca de los dos equipos. Kike Salas se queda a uno, con 13, y Isco, el Mago, aporta 9.
> 
> Lo peor, para Cucho y Junior, con -1 cada uno.
> 
> 📲 Fantasy Manager (enlace en la bio)

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|121, intento 1: el revisor no lo publicaría:
-   (redactar) final|121, intento 2:
</details>

## 9. final · `final|122`

**Antes** (redactado, 2 llamadas, 0.0632 $)

> 🏁 Remontada del Madrid ⚪ en el Bernabéu: 2-1 al Celta con gol de Carlos Espí en el 85'. Pablo Durán había adelantado a los celestes en el 6'.
> 
> Bellingham empató en el 66' y se va a 13 puntos, el que más saca de los dos equipos y su tercera jornada seguida con 8 o más. Mbappé falló un penalti en el 39' y se queda en 9, por debajo de lo que suele dar.
> 
> Del Celta se salva Durán, con 10 puntos pese a perder, más del doble de su media. Lo peor de la noche, Javi Rodríguez, con -1.
> 
> Fantasy Manager: la app, enlace en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|122, intento 1: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
</details>

**Ahora** (redactado, 1 llamada, 0.0259 $)

> 🏁 El Madrid le da la vuelta al Celta en el Bernabéu: 2-1 con goles de Bellingham en el 66' y Carlos Espí en el 85', después de que Mbappé fallara un penalti en el 39' y Pablo Durán adelantara a los celestes en el 6'.
> 
> Bellingham acaba con 13 puntos, el que más saca de los dos equipos, y ya van tres jornadas seguidas con 8 o más. Durán se lleva 10 con su gol, más del doble de su media. Mbappé se queda en 9, por debajo de lo suyo.
> 
> Lo peor, para Javi Rodríguez, con -1.
> 
> Fantasy Manager: la app, enlace en la bio

## 10. final · `final|128`

**Antes** (redactado, 1 llamada, 0.0351 $)

> 🏁 El Barça remonta un 0-2 y le gana 3-2 al Villarreal 🚢. Gerard Martín, Fermín y un gol en propia de Pau Navarro dieron la vuelta en apenas diez minutos, entre el 57' y el 67'.
> 
> Pedri es el que más puntos ha sacado de los dos equipos: 11, casi el doble de su media. Gerard Martín se va a 10 y Lamine Yamal se queda en 9, por debajo de lo que suele dar, con un penalti fallado en el 23'.
> 
> Del Villarreal se salva Buchanan, 8 puntos pese a perder. Lo peor, Pau Navarro: -3 por el gol en propia y la roja en el descuento.
> 
> 👉 Fantasy Manager, enlace en la bio

**Ahora** (redactado, 1 llamada, 0.0266 $)

> 🏁 El Barça remonta un 0-2 en veinte minutos y gana 3-2 al Villarreal, con goles de Gerard Martín, Fermín y uno en propia de Pau Navarro en el 67'.
> 
> Pedri es el que más saca de los dos equipos, con 11 puntos. Gerard Martín se lleva 10 y Lamine, 9 aunque falló un penalti en el 23'.
> 
> Pau Navarro cierra el partido con -3, y además vio la roja en el 90+3'. Buchanan suma 8 pese a perder.
> 
> 👉 Fantasy Manager, enlace en la bio

## 11. final · `final|129`

**Antes** (redactado, 3 llamadas, 0.097 $)

> 🏁 El Espanyol gana 0-1 en San Mamés con un gol de Roberto en el 66'. Los pericos venían 14º y se llevan los tres puntos ante un Athletic que era 8º.
> 
> Fortuño es el que más puntos saca de los dos equipos: 14, y ya son tres jornadas seguidas con 8 o más. Roberto, el del gol, se va a 11, más del doble de su media.
> 
> Nico Williams, del Athletic 🦁, suma 10 pese a perder.
> 
> Fantasy Manager · todo en el enlace de la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|129, intento 1: el emoji 🦁 va justo detrás del nombre de su club, no suelto
-   (redactar) final|129, intento 2: el revisor no lo publicaría:
</details>

**Ahora** (plantilla (rechazada), 3 llamadas, 0.0805 $)

> 🏁 Athletic 0-1 Espanyol. Victoria por la mínima del Espanyol. Fortuño es el que más puntúa: 14 puntos. Más del doble de lo que suele: 4,8 de media.
> 
> Tercera jornada seguida con 8 o más: 13, 11 y 14 tras él, Roberto con 11 y El Hilali con 10. En el Athletic se salva Nico Williams: 10 puntos.
> 
> Sorpresa: el Espanyol, que iba 14º, gana al Athletic Club, 8º.
> 
> Fortuño pagó la confianza
> 
> Fantasy Manager · todo en el enlace de la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|129, intento 1: el revisor no lo publicaría:
-   (redactar) final|129, intento 2: el revisor no lo publicaría:
-   (redactar) final|129, intento 3: el revisor no lo publicaría:
-   (redactar) final|129: no ha pasado la redacción (rechazada)
</details>

## 12. final · `final|130`

**Antes** (plantilla (rechazada), 4 llamadas, 0.1204 $)

> 🏁 Alavés 3-1 Deportivo. Victoria del Alavés sin muchos apuros. 14 puntos para Ángel Pérez. El centrocampista suele sacar 6,4 de media: hoy, más del doble.
> 
> Le siguen Lucas Boyé, con 12, y Blanco, con 11. Leo Román saca 9 puntos pese a la derrota del Deportivo.
> 
> ✅ Buena jornada para el que alineó a Ángel Pérez
> 
> Fantasy Manager · app en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|130, intento 1:
-   (redactar) final|130, intento 2:
-   (redactar) final|130, intento 3:
-   (redactar) final|130, intento 4:
-   (redactar) final|130: no ha pasado la redacción (rechazada)
</details>

**Ahora** (plantilla (rechazada), 3 llamadas, 0.0953 $)

> 🏁 Alavés 3-1 Deportivo. Victoria del Alavés sin muchos apuros. 14 puntos para Ángel Pérez. El centrocampista suele sacar 6,4 de media: hoy, más del doble.
> 
> Le siguen Lucas Boyé, con 12, y Blanco, con 11. Leo Román saca 9 puntos pese a la derrota del Deportivo.
> 
> Buena jornada para el que alineó a Ángel Pérez
> 
> Fantasy Manager · app en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) final|130, intento 1: el revisor no lo publicaría:
-   (redactar) final|130, intento 2: el revisor no lo publicaría:
-   (redactar) final|130, intento 3: el revisor no lo publicaría:
-   (redactar) final|130: no ha pasado la redacción (rechazada)
</details>

## 13. mvp · `mvp|123`

**Antes** (plantilla (rechazada), 4 llamadas, 0.1117 $)

> ⭐ MVP fantasy del Rayo Vallecano ⚡ 0-1 Valencia. 15 puntos para Copete. En lo que va de temporada suma 15 puntos, a 7,5 por partido.
> 
> 💸 Vale 694 K en el mercado y vuelve a jugar el domingo a las 14:00, contra el Osasuna 🐂

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|123, intento 1: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|123, intento 2: el revisor no lo publicaría:
-   (redactar) mvp|123, intento 3: palabras con mayúscula que no están en los hechos: Marcó; el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|123, intento 4: habla de
-   (redactar) mvp|123: no ha pasado la redacción (rechazada)
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0883 $)

> MVP fantasy del Rayo Vallecano 0-1 Valencia. 15 puntos para Copete. En lo que va de temporada suma 15 puntos, a 7,5 por partido.
> 
> Vale 694 K en el mercado y vuelve a jugar el domingo a las 14:00, contra el Osasuna

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|123, intento 1: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|123, intento 2: el revisor no lo publicaría:
-   (redactar) mvp|123, intento 3: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|123, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|123: no ha pasado la redacción (rechazada)
</details>

## 14. mvp · `mvp|121`

**Antes** (plantilla (rechazada), 4 llamadas, 0.1126 $)

> ⭐ MVP fantasy del Sevilla 1-1 Betis. Antony se lleva el partido con 14 puntos. El delantero del Betis lleva 71 puntos en la temporada.
> 
> El siguiente, el sábado a las 14:00 contra el Rayo. Ahora mismo vale 35,1 M.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|121, intento 1: copia un ejemplo de la guía («14 puntos mas del doble de su media…»): dilo con tus palabras
-   (redactar) mvp|121, intento 2: habla de
-   (redactar) mvp|121, intento 3: palabras con mayúscula que no están en los hechos: Marcó
-   (redactar) mvp|121, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|121: no ha pasado la redacción (rechazada)
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0879 $)

> ⭐ MVP fantasy del Sevilla 1-1 Betis. Antony se lleva el partido con 14 puntos. El delantero del Betis lleva 71 puntos en la temporada.
> 
> El siguiente, el sábado a las 14:00 contra el Rayo. Ahora mismo vale 35,1 M.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|121, intento 1: el revisor no lo publicaría:
-   (redactar) mvp|121, intento 2: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|121, intento 3: el revisor no lo publicaría:
-   (redactar) mvp|121, intento 4: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|121: no ha pasado la redacción (rechazada)
</details>

## 15. mvp · `mvp|122`

**Antes** (plantilla (rechazada), 4 llamadas, 0.1235 $)

> ⭐ MVP fantasy del Real Madrid 2-1 Celta. Nadie saca más que Bellingham: 13 puntos. En lo que va de temporada suma 131 puntos, a 10,1 por partido.
> 
> 💸 Vale 155 M en el mercado y vuelve a jugar el sábado a las 21:00, contra el Alavés

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|122, intento 1: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|122, intento 2: palabras con mayúscula que no están en los hechos: Marcó
-   (redactar) mvp|122, intento 3: el revisor no lo publicaría:
-   (redactar) mvp|122, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|122: no ha pasado la redacción (rechazada)
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0929 $)

> MVP fantasy del Real Madrid 2-1 Celta. Nadie saca más que Bellingham: 13 puntos. En lo que va de temporada suma 131 puntos, a 10,1 por partido.
> 
> Vale 155 M en el mercado y vuelve a jugar el sábado a las 21:00, contra el Alavés

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|122, intento 1: el revisor no lo publicaría:
-   (redactar) mvp|122, intento 2: palabras con mayúscula que no están en los hechos: Marcó
-   (redactar) mvp|122, intento 3: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|122, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|122: no ha pasado la redacción (rechazada)
</details>

## 16. mvp · `mvp|128`

**Antes** (redactado, 2 llamadas, 0.0587 $)

> ⭐ Pedri es el mejor del Barça-Villarreal: 11 puntos, casi el doble de lo que suele sacar, y nadie de los dos equipos hizo más.
> 
> El Barça le dio la vuelta al 0-2 con tres goles entre el 57' y el 67'. Pedri vale 80,5 M y el domingo visita al Deportivo: si lo tienes, no se toca.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|128, intento 1: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0926 $)

> ⭐ MVP fantasy del Barça 3-2 Villarreal. Pedri se lleva el partido con 11 puntos. Con esto llega a 79 puntos en la temporada y una media de 6,1.
> 
> En el mercado está a 80,5 Su próximo partido, el domingo a las 16:15 ante el Dépor

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|128, intento 1: el revisor no lo publicaría:
-   (redactar) mvp|128, intento 2: palabras con mayúscula que no están en los hechos: Riazor; el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|128, intento 3: habla de
-   (redactar) mvp|128, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|128: no ha pasado la redacción (rechazada)
</details>

## 17. mvp · `mvp|129`

**Antes** (plantilla (rechazada), 4 llamadas, 0.12 $)

> ⭐ MVP fantasy del Athletic Club 0-1 Espanyol. A. Fortuño se lleva el partido con 14 puntos. Con esto llega a 63 puntos en la temporada.
> 
> El siguiente, en la jornada 14 contra el Getafe. Ahora mismo vale 4,5 M.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|129, intento 1: copia un ejemplo de la guía («14 puntos mas del doble de su media…»): dilo con tus palabras
-   (redactar) mvp|129, intento 2: el revisor no lo publicaría:
-   (redactar) mvp|129, intento 3: copia un ejemplo de la guía («14 puntos mas del doble de su media…»): dilo con tus palabras
-   (redactar) mvp|129, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|129: no ha pasado la redacción (rechazada)
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0937 $)

> MVP fantasy del Athletic Club 0-1 Espanyol. Fortuño se lleva el partido con 14 puntos. Con esto llega a 63 puntos en la temporada.
> 
> El siguiente, en la jornada 14 contra el Getafe. Ahora mismo vale 4,5 M.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|129, intento 1: el revisor no lo publicaría:
-   (redactar) mvp|129, intento 2: el revisor no lo publicaría:
-   (redactar) mvp|129, intento 3: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|129, intento 4: el revisor no lo publicaría:
-   (redactar) mvp|129: no ha pasado la redacción (rechazada)
</details>

## 18. mvp · `mvp|130`

**Antes** (plantilla (sin-ia), 3 llamadas, 0.059 $)

> ⭐ MVP fantasy del Alavés 3-1 Deportivo. Nadie saca más que Ángel Pérez: 14 puntos. El centrocampista del Alavés lleva 77 puntos en la temporada.
> 
> 💸 En el mercado está a 30,1 M. Su próximo partido, el sábado a las 21:00 ante el Real Madrid

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|130, intento 1: palabras con mayúscula que no están en los hechos: Marcó; nombra un club o un jugador con una palabra vaga («el rival»); copia un ejemplo de la guía («14 puntos mas del doble de su media…»): dilo con tus palabras
-   (redactar) mvp|130, intento 2: el revisor no lo publicaría:
-   (redactar) mvp|130: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (rechazada), 4 llamadas, 0.0777 $)

> ⭐ MVP fantasy del Alavés 3-1 Deportivo. Nadie saca más que Ángel Pérez: 14 puntos. El centrocampista del Alavés lleva 77 puntos en la temporada.
> 
> En el mercado está a 30,1 Su próximo partido, el sábado a las 21:00 ante el Real Madrid

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mvp|130, intento 1: nombra un club o un jugador con una palabra vaga («el rival»)
-   (redactar) mvp|130, intento 2: habla de
-   (redactar) mvp|130, intento 3: nombra un club o un jugador con una palabra vaga («ese rival»)
-   (redactar) mvp|130, intento 4: el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) mvp|130: no ha pasado la redacción (rechazada)
</details>

## 19. mercado · `mercado|2026-11-23`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 💸 Subidas y bajadas del mercado fantasy de hoy, 22/11
> 
> 📈 Nadie sube más que Vini Jr.: +2,4 M en un día (+3 %), y ya vale 80,8 M.
> 
> 📉 Diomande del Madrid ⚪ va en sentido contrario: cae 1,1 M, un 0,9 %, hasta los 124,5 M.
> 
> 🛒 Chollo Fantasy: Redondo del Elche 🌴 vale 3,1 M, suma 4,5 de media y hoy sube un 2,2 %
> 
> Tu Fantasy con Fantasy Manager · enlace en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mercado|2026-11-23: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (redactado, 2 llamadas, 0.0572 $)

> 📈 El Real Madrid manda en el mercado de esta noche: los blancos ganan 7 M sumando a todos sus jugadores, mientras que el Villarreal cede 2,6 M.
> 
> Vini Jr. repite como el que más sube, +2,4 M hasta los 80,8 M, y encadena 14 días al alza. Diomande, también del Madrid, repite como el que más baja: 1,1 M menos y seis días seguidos bajando.
> 
> De barato, Redondo, del Elche, vale 3,1 M y sube un 2,2 %.
> 
> Tu Fantasy con Fantasy Manager · enlace en la bio

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) mercado|2026-11-23, intento 1: el revisor no lo publicaría:
</details>

## 20. previa · `previa|126`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ Posibles onces de Levante-Elche, hoy a las 21:00
> 
> Lo que no está claro: Ifeanyi Ndukwe, Etta Eyong y Nacho Perez en el Levante 🐸; Cepeda (53 %) y Lemar (54 %) en el Elche 🌴. Al Elche le falta M. Aguado, lesionado.
> 
> Lo seguro: Ryan (94 %, 6,8 de media) y Revivo (81 %).
> 
> En la tabla hay poco que separe al Levante (18º) y al Elche (19º).

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|126: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (rechazada), 1 llamada, 0.0246 $)

> 🗓️ Posibles onces de Levante-Elche, hoy a las 21:00
> 
> Lo que no está claro: Ifeanyi Ndukwe, Etta Eyong y Nacho Perez en el Levante; Cepeda (53 % de titularidad) y Lemar (54 %) en el Elche. Al Elche le falta Aguado, lesionado.
> 
> Lo seguro: Ryan (94 %, 6,8 de media) y Revivo (81 %).
> 
> En la tabla hay poco que separe al Levante (18º) y al Elche (19º).

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|126, intento 1: número 50 que no está en los datos; el último tuit de este tipo ya daba la media de puntos: cuenta otro dato del jugador (el de
-   (redactar) previa|126: no ha pasado la redacción (rechazada)
</details>

## 21. previa · `previa|135`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ Levante-Racing (el viernes a las 21:00): así llegan los dos a la jornada 14
> 
> En el Racing hay una fija: Y. Zabiri, con 7,2 de media y un 93 % de titularidad. No estarán Andrés Martín, Maguette y Mantilla, lesionados.
> 
> En el Levante, Ifeanyi Ndukwe, Etta Eyong y Nacho Perez, con entre un 56 y un 58 %, tienen papeletas, pero nada asegurado. Con Ryan no hay discusión: 94 %.
> 
> Sobre el papel, el Racing lo tiene más fácil: va 7º y el Levante, 18º.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|135: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (sin-tiempo), 0 llamadas, 0 $)

> Levante-Racing (el viernes a las 21:00): así llegan los dos a la jornada 14
> 
> En el Racing hay una fija: Yassir Zabiri, con 7,2 de media y un 93 % de titularidad. No estarán Andrés Martín, Maguette y Mantilla, lesionados.
> 
> En el Levante, Ifeanyi Ndukwe, Etta Eyong y Nacho Perez, con entre un 56 y un 58 %, tienen papeletas, pero nada asegurado. Con Ryan no hay discusión: 94 %.
> 
> Sobre el papel, el Racing lo tiene más fácil: va 7º y el Levante, 18º.

## 22. previa · `previa|140`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ Betis-Rayo, el sábado a las 14:00: posibles onces para la jornada 14
> 
> Cucho, en el Betis, es quien más en el aire está: 54 %. Detrás vienen Isi, Álvaro García y Pedrosa en el Rayo Vallecano.
> 
> El Rayo no tendrá a A. Batalla, Luiz Felipe y Kumbulla, lesionados. Los que no fallan: Á. Valles (94 %, 9,1 de media) y Camello (85 %).
> 
> El partido pinta mejor para el Betis (4º) que para el Rayo Vallecano (15º).

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|140: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (sin-tiempo), 0 llamadas, 0 $)

> 🗓️ Betis-Rayo, el sábado a las 14:00: posibles onces para la jornada 14
> 
> Cucho, en el Betis, es quien más en el aire está: 54 % de titularidad. Detrás vienen Isi, Álvaro García y Pedrosa en el Rayo Vallecano.
> 
> El Rayo no tendrá a Batalla, Luiz Felipe y Kumbulla, lesionados. Los que no fallan: Valles (94 %, 9,1 de media) y Camello (85 %).
> 
> El partido pinta mejor para el Betis (4º) que para el Rayo Vallecano (15º).

## 23. previa · `previa|134`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ El sábado a las 16:15 juegan el Málaga 🐟 y el Athletic 🦁: posibles onces de la jornada 14
> 
> Al Athletic Club le faltan Vivian, Guruzeta y Egiluz, lesionados. Al Málaga, Aznou, sancionado, y Rafita y F. Calero, lesionados. Lo seguro: Unai Simón (94 %, 7,4 de media) y Niño (81 %).
> 
> Lo que no está claro: Yeray (42 %), De Galarreta (45 %) y Gerenabarrena en el Athletic, y Joaquín, C. Puga y Ramon en el Málaga.
> 
> El Athletic Club, 8º, parte como favorito frente al Málaga, que es 20º. Pocos goles a la vista: el Athletic encaja solo 1 por partido y el Málaga marca 0,7.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|134: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (sin-tiempo), 0 llamadas, 0 $)

> El sábado a las 16:15 juegan el Málaga 🐟 y el Athletic 🦁: posibles onces de la jornada 14
> 
> Al Athletic Club le faltan Vivian, Guruzeta y Egiluz, lesionados. Al Málaga, Aznou, sancionado, y Rafita y Calero, lesionados. Lo seguro: Unai Simón (94 % de titularidad, 7,4 de media) y Niño (81 %).
> 
> Lo que no está claro: Yeray (42 %), De Galarreta (45 %) y Gerenabarrena en el Athletic, y Joaquín, Puga y Ramon en el Málaga.
> 
> El Athletic Club, 8º, parte como favorito frente al Málaga, que es 20º. Pocos goles a la vista: el Athletic encaja solo 1 por partido y el Málaga marca 0,7.

## 24. previa · `previa|137`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ Posibles onces de Elche-Atlético, el sábado a las 18:30
> 
> Sin discusión, Grimaldo (87 %, 8,5 de media) y Revivo (81 %). Dudas: Le Normand (42 %) y Johnny (46 %) en el Atleti; Cepeda y Lemar en el Elche.
> 
> Los dos llegan con bajas. El Atlético no tendrá a Cuti Romero y Lookman, lesionados, y el Elche tampoco a M. Aguado, lesionado.
> 
> El partido pinta mejor para el Atleti (3º) que para el Elche (19º).

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|137: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (sin-tiempo), 0 llamadas, 0 $)

> 🗓️ Posibles onces de Elche-Atlético, el sábado a las 18:30
> 
> Sin discusión, Grimaldo (87 % de titularidad, 8,5 de media) y Revivo (81 %). Dudas: Le Normand (42 %) y Johnny (46 %) en el Atleti; Cepeda y Lemar en el Elche.
> 
> Los dos llegan con bajas. El Atlético no tendrá a Cuti Romero y Lookman, lesionados, y el Elche tampoco a Aguado, lesionado.
> 
> El partido pinta mejor para el Atleti (3º) que para el Elche (19º).

## 25. previa · `previa|133`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ Jornada 14: Real Madrid-Alavés, el sábado a las 21:00
> 
> Donde hay más duda: Guevara (46 %) y A. Rebbach (61 %) en el Alavés. Bajas en los dos lados: en el Real Madrid no estarán Asencio y Rodrygo, lesionados, y en el Alavés, Mikel Rodriguez y F. Garcés, lesionados.
> 
> Lo seguro: Mbappé (94 %, 12 de media) y Sivera (94 %).
> 
> Sobre el papel, el Madrid lo tiene más fácil: va 2º y el Alavés, 9º.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|133: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (sin-tiempo), 0 llamadas, 0 $)

> 🗓️ Jornada 14: Real Madrid-Alavés, el sábado a las 21:00
> 
> Donde hay más duda: Guevara (46 % de titularidad) y Rebbach (61 %) en el Alavés. Bajas en los dos lados: en el Real Madrid no estarán Asencio y Rodrygo, lesionados, y en el Alavés, Mikel Rodriguez y Garcés, lesionados.
> 
> Lo seguro: Mbappé (94 %, 12 de media) y Sivera (94 %).
> 
> Sobre el papel, el Madrid lo tiene más fácil: va 2º y el Alavés, 9º.

## 26. previa · `previa|131`

**Antes** (plantilla (sin-ia), 1 llamada, 0 $)

> 🗓️ Posibles onces de Valencia-Osasuna, el domingo a las 14:00
> 
> Al Osasuna 🐂 le faltan Catena, sancionado, y Aitor Fdez, lesionado. Al Valencia 🦇, J. Vázquez y Diego López, lesionados. Los que no fallan: Budimir (93 %, 7,5 de media) y Dimitrievski (94 %).
> 
> Lo que no está claro: Kike Barja (38 %), Diego Rico (51 %) y Herrando en el Osasuna; Rioja en el Valencia.
> 
> Partido igualado: el Valencia va 16º y el Osasuna, 13º. El que más suele dar de los dos es Copete, con 7,5 de media.

<details><summary>lo que tiró el validador o el editor</summary>

-   (redactar) previa|131: no ha pasado la redacción (sin-ia)
</details>

**Ahora** (plantilla (sin-tiempo), 0 llamadas, 0 $)

> Posibles onces de Valencia-Osasuna, el domingo a las 14:00
> 
> Al Osasuna 🐂 le faltan Catena, sancionado, y Aitor Fdez, lesionado. Al Valencia 🦇, Vázquez y Diego López, lesionados. Los que no fallan: Budimir (93 % de titularidad, 7,5 de media) y Dimitrievski (94 %).
> 
> Lo que no está claro: Kike Barja (38 %), Diego Rico (51 %) y Herrando en el Osasuna; Rioja en el Valencia.
> 
> Partido igualado: el Valencia va 16º y el Osasuna, 13º. El que más suele dar de los dos es Copete, con 7,5 de media.
