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
