# Pendiente de la revisión del 23 oct (para parches)

Lo que encontraron los agentes y no se ha tocado todavía, de más a menos importante:

- Noticias en la web: Google Noticias da 503 a todo lo que pasa por el Worker (visto en todos los diagnósticos de Domy). Desde la 0.6.3g la app no insiste y la IA lo sabe, pero la web sigue sin noticias: probarlo con el segundo proxy fuera de Cloudflare o buscar otra fuente
- Alineaciones confirmadas: en la web pasan por el Worker; si SofaScore bloquea esas peticiones, en la web no salen (en la app de Android van directas). En los diagnósticos de Domy, SofaScore da 403 desde la web
- La pestaña Directo con LaLiga de verdad: el diagnóstico de Domy del 25 oct a las 11:03 (J10) da partidos con puntos y estado, su once y los equipos: funciona. Las jugadas son de SofaScore, que da 403 desde el móvil de Carlos y desde la web

- El chat en la app de Android no va escribiendo la respuesta (el puente nativo no tiene streaming): pide APK nuevo, para la próxima vez que se toque android/
- Partidos adelantados descuadran el inicio y fin de cada jornada (los aplazados, arreglados en la 0.6.3c). Lo que hace LaLiga Fantasy (mirado el 5 nov 2026): con el Real Sociedad-Celta de la J6 de la 26/27, adelantado al 3 sep, «se ha optado por hacer las alineaciones para la jornada 6, cuando este encuentro adelantado ya se haya disputado» (Jornada Perfecta, 3 sep 2026: https://www.jornadaperfecta.com/blog/real-sociedad-celta-partido-adelantado-j6-fantasy/), así que la jornada en el juego empieza con el bloque normal y no con el adelantado. En motor.js (`jornadas`, ~298) el inicio es el primer partido, adelantado incluido: lo lógico sería apartar los adelantados como los aplazados (más de 6 días antes del bloque). Falta saber si la veda de cláusulas de 24 h va con el bloque normal (casi seguro) o con el adelantado: mirarlo en la app oficial la próxima vez que haya uno antes de tocarlo
- Temporada 2027-28: los resultados de la temporada anterior se reutilizan (vaciar al cambiar de temporada)

De la sección «Estado» del COMO-TRABAJAMOS viejo:

- Quedan de las revisiones del 25 oct (sin tocar): la fecha de un plan usa la hora del móvil, no la de Madrid (solo falla con el móvil en otra zona; `deNoche` y `callado` de fondo.js van bien con la hora del móvil); en el prompt de la IA, lo de que te clausulen sigue repetido en tres sitios y el bloque CALENDARIO repite las previas.

- 0.7i (6 nov 2026, 22:41): portada con el botón fijo «Baja: hay mucho más» (portada.js, `.pt-pista`) y guía de iPhone en pasos (app.js, `entrarWebHTML`), con «Añadir a la pantalla de inicio» detallado en instalar.html (#iphone y #anadir), fila en Ajustes y manifest.webmanifest con metas de iOS (nombre e icono al añadirla). Probado solo con Playwright (iPhone 14 simulado). SIN PROBAR en un iPhone de verdad: que la web del icono se abra a pantalla completa y que su sesión sea aparte de la de Safari (la guía dice que el código se escribe en la del icono); si no fuera así, quitar el manifest y las metas `apple-mobile-web-app-*` de index.html. El QR de «Abrir en otro dispositivo» (enlace con #codigo=) se escanea con la cámara del iPhone; el QR de «Escanea con la app» de la portada de escritorio es solo para la app de Android
