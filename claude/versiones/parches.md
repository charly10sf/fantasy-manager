# Pendiente de la revisión del 23 oct (para parches)

Lo que encontraron los agentes y no se ha tocado todavía, de más a menos importante:

- Noticias en la web: Google Noticias da 503 a todo lo que pasa por el Worker (visto en todos los diagnósticos de Domy). Desde la 0.6.3g la app no insiste y la IA lo sabe, pero la web sigue sin noticias: probarlo con el segundo proxy fuera de Cloudflare o buscar otra fuente
- Alineaciones confirmadas: en la web pasan por el Worker; si SofaScore bloquea esas peticiones, en la web no salen (en la app de Android van directas). En los diagnósticos de Domy, SofaScore da 403 desde la web
- La pestaña Directo con LaLiga de verdad: el diagnóstico de Domy del 25 oct a las 11:03 (J10) da partidos con puntos y estado, su once y los equipos: funciona. Las jugadas son de SofaScore, que da 403 desde el móvil de Carlos y desde la web

- El chat en la app de Android no va escribiendo la respuesta (el puente nativo no tiene streaming): pide APK nuevo, para la próxima vez que se toque android/
- Partidos adelantados descuadran el inicio y fin de cada jornada (los aplazados, arreglados en la 0.6.3c)
- El historial de movimientos no pasa de la página 50 (en ligas largas el dinero de los rivales nunca sale «completo») y se da por completo antes de tiempo si alguien se fue de la liga
- Temporada 2027-28: los resultados de la temporada anterior se reutilizan (vaciar al cambiar de temporada)

De la sección «Estado» del COMO-TRABAJAMOS viejo:

- Quedan de las revisiones del 25 oct (sin tocar): `fondo.js` (`deNoche`, `callado`) y la fecha de un plan usan la hora del móvil, no la de Madrid (solo falla con el móvil en otra zona); `M.ventanaEsp` suma 24 h fijas; en el prompt de la IA, lo de que te clausulen sigue repetido en tres sitios y el bloque CALENDARIO repite las previas.
