# Rasgos a mano: propuesta (7 nov 2026), pendiente de que Carlos la apruebe

Nada de esto está en el código todavía: en `bot/lib/apodos-jugadores.mjs` solo está Valverde (ya aprobado). Cada rasgo lleva su fuente. Si Carlos aprueba una línea, se pasa tal cual al campo `rasgos` del jugador (por su nickname exacto de LaLiga); lo que no apruebe, no entra. Los rasgos van a los hechos de un gol como `suEstilo` y la IA los cuenta con sus palabras, como mucho uno por tuit. Ninguno lleva cifras que caduquen: las cifras de la temporada salen de los contadores calculados.

| Jugador (nickname LaLiga) | Rasgo propuesto | Fuente |
|---|---|---|
| Lamine Yamal (id 3104) | recorta hacia la zurda y dispara desde fuera del área, a segundo palo | Mediotiempo, «Arjen Robben, el creador del característico disparo de Lamine Yamal» (describe sus goles como perfilarse a la zurda, normalmente fuera del área, y buscar el segundo palo); Goal, tras el gol al Villarreal de 2025 (el tiro curvado desde justo fuera del área, «por segunda vez en cuatro días») |
| Álex Baena (id 2534) | marca de falta directa | RFEF, «Álex Baena, el francotirador» (16 oct 2024: el tercer gol a Serbia, de lanzamiento de falta); Soccerway, «Baena recuerda en Córdoba su gol en la final olímpica» (otra falta, el 1-3 a Francia) |
| Raphinha (id 2522) | buen lanzador de faltas | fcbarcelona.es, ficha del jugador («su pierna natural es la zurda… es un buen lanzador de faltas»); fcbarcelona.es, noticia de su fichaje (especialista en balón parado, peligroso en faltas desde la frontal) |
| Isco (id 3090) | lanza los penaltis del Betis | Flashscore, crónica Betis-Osasuna del 11 oct 2026 (su penalti de la jornada, con el que lleva 9 de 10 con el Betis); Plano Informativo, 21 oct 2026 (el penalti al Feyenoord en Champions) |
| Isco (id 3090) | saca las faltas del Betis | El Gol Digital, 31 oct 2026, Betis-Málaga (dos goles que salen de faltas botadas por él) |
| Budimir (id 3084) | uno de los grandes rematadores de cabeza de LaLiga | Noticias de Navarra, 22 oct 2022 (el máximo realizador de cabeza de la Liga desde 2018-19) y 16 feb 2025 (21 goles de cabeza en Liga) |
| Budimir (id 3084) | lanza los penaltis de Osasuna | Noticias de Navarra, 16 feb 2025 (once goles de penalti en doce lanzamientos desde que llegó a Osasuna) |
| Grimaldo | especialista en balón parado: faltas directas y centros precisos | Libertad Digital, ficha de Grimaldo (lo describe como uno de los mejores en su posición a balón parado, con faltas directas y centros precisos) |
| Grimaldo | llega al área desde el lateral y golpea con precisión | El Gol Digital, «Por qué Atlético y Barcelona quieren a Grimaldo» (su llegada al área rival y la precisión en centros y disparos a puerta) |
| Marc Bartra | central que remata de cabeza a balón parado | El Universal (Colombia), 8 sep 2026 (sus dos goles al Lille en Champions; el primero, de cabeza a un centro tras córner); FotMob, su ficha de LaLiga 2026/27 (sus dos goles de la temporada: de cabeza, a balón parado) |
| Fermín López | llega desde segunda línea a posiciones de remate | fcbarcelona.es, ficha del jugador («destaca por su llegada y su capacidad goleadora»); Comuniate, 6 sep 2026 (su capacidad para llegar desde segunda línea y aparecer en posiciones de remate) |
| Jude Bellingham | llega al área desde segunda línea | realmadrid.com, rueda de prensa de Ancelotti tras el Madrid-Unión Berlín de 2023 («llegando desde segunda línea es más listo que otros»); ESPN Deportes (sus goles encarnan lo que en España se llama «llegada») |

Dudas:
- Isco «saca las faltas» es un rasgo para asistencias y goles tras falta, no para goles directos: sirve en un gol suyo solo si llega de jugada de balón parado. Si no se quiere, se quita.
- Yamal: la fuente describe el patrón en goles de 2024-25; no hay una cifra oficial de cuántos son de fuera del área.
- Canales (Racing) y otros con goles de lejos este año (Mariano, Boyé, Isaac Romero, Mario Soriano, Berenguer): no propongo rasgo. Con una sola jugada (Canales, la falta del 4' al Rayo) no hay rasgo, y de los demás no he encontrado una fuente que lo diga. Para ellos valen los contadores de la temporada.
- No uso «Sergio Penales» ni ningún mote de burla.
- Segunda tanda (7 nov, noche): Grimaldo, Bartra, Fermín y Bellingham van sin id porque se ponen por su nickname exacto de LaLiga al meterlos en el código (se sacan con `jugadores()` de `lib/laliga.mjs`).
- Grimaldo: dos de sus cuatro goles de este año son de penalti, pero no he encontrado fuente que diga que los lanza él en el Atlético, así que no propongo «lanza los penaltis».
- Sin propuesta por falta de fuente: Aubameyang (la búsqueda solo trajo traspasos y cifras), Gabriel Jesus (solo una nota vieja de Sopitas, de su fichaje por el Arsenal, que dice que no depende del área: floja), Mbappé (fuentes flojas) y el resto de goleadores. Los contadores de temporada de todos están en `claude/rasgos-contadores.md`.

## Motes (7 nov, 23:30, a petición de Carlos)

Con fuente y ya en el código: Isco, «el Mago» (Vavel, 17 mar 2026; El Gol Digital lo llama «el Mago de Arroyo de la Miel»); Bellingham, «Bellingol» (Fox Sports México, 7 nov 2023: mote de la afición por sus goles; el audio viral es de un narrador brasileño); Budimir, «el cisne de los Balcanes» (El Gol Digital, 2025: se lo puso la afición del Crotone, no la de Osasuna). Sin mote encontrado: Grimaldo, Raphinha, Baena, Bartra y Fermín. Yamal: «O Rei» (Fox Sports, 15 may 2025: el club lo publicó así). Carlos lo aprobó a las 23:33 y ya está en el código; «El Rey» (31 jul 2025) no, porque parte de la afición lo critica. También sale «Lord Bellingham» (AFP, 2023), que fue de una crónica y no se ha quedado.

Mbappé, «la Tortuga» (Carlos lo dio por bueno el 7 nov, 23:40; fuentes: Soccerway, «De la 'Tortuga' al 'Panda'…», y Fox Sports México, 9 ago 2023; viene de la careta de Tortuga Ninja que le regaló Thiago Silva en 2018). Va por su nickname «Mbappé», sin rasgo (sigue sin fuente).

## Nacionalidad en vez del nombre (7 nov, 23:40)

Carlos: si el tuit repite un nombre, vale «el francés», «el uruguayo»… El país sale de las alineaciones de FotMob (`countryCode`), porque la API de LaLiga no lo trae; por eso de momento solo está en el directo (goleador y asistente, campo `suNacionalidad`). Reglas: sin España, sin países que no conocemos (`lib/nacionalidad.mjs`) y, si goleador y asistente son del mismo país, ninguno lo lleva. La IA solo lo usa en una segunda mención, una vez como mucho (`lib/voz.mjs`). Final y MVP no lo tienen aún: harían falta las alineaciones de FotMob en esos tipos.

## Segunda tanda (7 nov, 23:5x, «amplía a más»), aprobada

Carlos la aprobó el 7 nov a las 23:40 («está bien así») y entró con la PR #93. Nickname exacto de LaLiga Fantasy entre « ». Fuentes flojas que conviene cambiar cuando se pueda: buscabiografias.com (Arda Güler) y laliga.com de 2021 (Iñaki Williams).

| Jugador | Rasgo / nombre | Fuente |
|---|---|---|
| «Adeyemi» (Barcelona) | es de los futbolistas más rápidos de Europa y ataca los espacios a la espalda de la defensa | El Debate, 24 jul 2026 («uno de los jugadores más rápidos de Europa»); Soccerway («se siente cómodo atacando los espacios»); Comuniate cita a Opta: 3,60 s en 30 m |
| «Iñaki Williams» (Athletic) | es uno de los jugadores más rápidos de LaLiga | laliga.com, «Nacidos para marcar», 15 sep 2021 (el artículo es viejo; la velocidad no ha cambiado) |
| «Arda Güler» (Real Madrid) | es un zurdo que corta hacia dentro para chutar o dar el último pase | Wikipedia (zurdo, mediapunta o extremo por la derecha); buscabiografias.com |
| «Chupe» (Málaga) | lanza los penaltis del Málaga | asesoriasfantasy.com/jugador/chupe («lanza penaltis»); FotMob: 3 goles de penalti en 2025/26; Flashscore, crónica de la J4 26/27: falló uno ante el Levante |
| «Giuliano» (Atlético) | nombre completo Giuliano Simeone; no da un balón por perdido y lucha hasta el final | OKDiario («no dar nunca un balón por perdido y luchar hasta el final»); Flashscore («la prolongación de Simeone en el campo») |
| «Gordon» (Barcelona) | nombre completo Anthony Gordon; es explosivo y ataca los espacios con mucha intensidad | beIN Sports, 27 may 2026 |
| «Lucas Boyé» (Alavés) | dispara con potencia desde fuera del área | fichajes.net, 8 sep 2026 y Misiones Online, 6 sep 2026: en el hat-trick al Osasuna, dos disparos desde fuera del área. Lleva 2 goles de lejos este año en el registro |
| «Roberto» (Espanyol) | nombre completo Roberto Fernández; marca goles de pícaro dentro del área | Ara, 3 may 2025 (entrevista sobre «sus goles de pícaro»; el artículo lo compara con Tamudo por su estilo pícaro) |
| «Raúl» (Osasuna) | nombre completo Raúl García; es un nueve de 1,92 m que vive dentro del área | LaLiga (192 cm); Noticias de Navarra, 18 dic 2025 («cada balón en el área como una invitación al gol»); osasuna.es, 5 jun 2026 (14 goles la temporada pasada: 7 en Liga y 7 en Copa) |
| «Ez Abde» (Betis) | nombres Abde Ezzalzouli y «Abde»; extremo izquierdo de pierna derecha, rápido y de mucha percusión | EFE vía Infobae, 30 oct 2024 («Abde renueva hasta 2029»); Wikipedia («sometimes known as Ez Abde»); FotMob (extremo izquierdo, diestro); foot-africa.com (velocidad y percusión) |

### Buscados y no incluidos (sin fuente suficiente)

- Mikautadze: El Gol Digital (2025) habla de un «plus tremendo en los penaltis», pero FotMob no le da goles de penalti en 2025/26 en Villarreal; no se pone que los lance. El club dice solo que es potente y que ve portería.
- Berenguer: ESPN tiene vídeos suyos de penaltis, sin fecha, y futbolfantasy le apunta 1 penalti en la Europa League 24/25 (fallado). No hay una fuente que diga que los lanza ahora.
- Mariano: OKDiario lo llamó «rematador fiable» en 2021, demasiado viejo para fiarse.
- Camello: ninguna fuente de su estilo. El Corriere dello Sport lo llama «il centravanti del pueblo» (25 oct 2026), una etiqueta suelta de un medio italiano; no se usa como mote.
- Güler: CNN (8 jul 2023) lo llamó «el Messi turco» al fichar. Es una etiqueta de la presentación, no un mote que se haya quedado.
- Sucic: Goal lo ve como posible sucesor de Modric (zurdo, buen control). Es una comparación, no un rasgo de gol ni un mote.
- Zabiri: nada sobre su estilo en lo que he leído (hat-trick al Elche, campeón del mundo sub-20).
- Sin buscar todavía: Mbappé (sin fuente en la primera búsqueda), Fer Niño, Adrián Nino, Brugué, Diomande, Espí, Juan Hernández.

