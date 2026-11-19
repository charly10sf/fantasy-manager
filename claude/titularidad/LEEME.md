# Ajuste de la titularidad por minutos (19 nov)

`pTitularMinutos` (web/js/titular.js) es una regresión logística ajustada con las jornadas 4-12 de la 26/27.
Para rehacerla con más jornadas (en una carpeta de /tmp, no aquí):

1. `node claude/titularidad/baja.mjs` desde esa carpeta: baja jugadores.json y fichas.json de la API de LaLiga (~5 min).
2. `python3 bt.py` (filas jugador-jornada: solo convocados, con lo de antes de esa jornada) y `python3 ev2.py` (Brier
   frente a la cuenta vieja, coeficientes finales y calibración). Titular = 50 minutos o más; con 45, medio caso.
3. Copiar los coeficientes a titular.js.

Resultado del 19 nov: con J4-J9 acierta en J10-J12 con Brier 0,137 (la cuenta vieja, 0,158). Coeficientes:
z = −1,784 + 1,985·m3 + 0,691·ms + 1,783·vrel − 0,888·[ms = 0] − 0,251·[m3 = 0]
(m3, ms: minutos/90 de las 3 últimas convocatorias y de la temporada; vrel: valor / el que más vale de su puesto en su equipo).
