# Cerrar una versión

Lo que se hace al acabar una versión o un parche. Los comandos de publicar están en el CLAUDE.md («Publicar»). La carpeta claude/ va en el repo y sube con el commit de la versión (no lanza ninguna Action); ESTADO.md y COMO-TRABAJAMOS.md están en el proyecto de Claude.

## El número

- Versiones: algo nuevo sube el número (0.4.5); los parches y cosas leves llevan letra (0.4.4e).
- Una versión = una cosa gorda. Si en medio sale una idea, va a la lista de después, no a la versión en curso.
- Correcciones y cosas leves: parche con letra, nunca versión nueva.
- Si un trámite de Google se atasca, el código sigue: las versiones no esperan a la burocracia, se solapan.

## Las notas (web/js/version.js)

- Cada una con su entrada en NOVEDADES (web/js/version.js), con fecha y hora de Madrid (`TZ=Europe/Madrid date +%H:%M`, justo antes del commit). Cada versión lleva su entrada en version.js con novedades y presentación, como hasta ahora.
- A quien acaba de llegar no le salen novedades de versión, solo el tutorial. Si al abrir hay más de 6 novedades pendientes, salen solo las 5 principales (presentacion.js).
- Lo nuevo y las mejoras van en cromos: al que no es el dueño (el admin de los avisos) solo lo que le afecta, ni lo que lleva `menor: true` (detalles, cosas de dentro) ni lo que es de otra versión (`para`: 'play', 'app', 'web' o 'dueño'); el dueño lo ve todo.
- Los arreglos (`tipo: 'arreglo'`) no van en cromos: salen al final, numerados («Notas de la actualización → Correcciones», como un videojuego; lo pidió Carlos el 25 oct), para todos, menos los de otra versión.
- Una versión con solo arreglos no abre la presentación: se juntan para la siguiente con algo nuevo (`version-vista2` no avanza).
- Cada novedad nueva se marca al escribirla.

## Antes de publicar

- Mirar los avisos de Fallo (comandos en el CLAUDE.md) por si alguno entra en esta versión.
- La prueba de todas las pantallas va una vez al final, en vez de tras cada cambio (Carlos se quejó de lo que tardaba, 30 oct a las 04:57).
- Nada se publica sin el OK; lo pendiente va a la rama `pendiente`.

## Publicar

- Los pasos de «Publicar» del CLAUDE.md. Si cambia worker/, también la Action «Worker».
- A Carlos se le avisa nada más subir a main y se comprueba después (Actions y paquete.json).
- El enlace del APK, solo si cambia la huella nativa.

## Después

- Contestar los avisos que arregla la versión (solo con lo ya publicado).
- claude/ESTADO.md (en el proyecto) al día: versión publicada, app.json, avisos y lo que falta. Que no pase de 30 líneas.
- Lo hecho sale de su archivo de claude/versiones/ y va a claude/historial.md, en su versión, con fecha y hora como hasta ahora. Si una versión se acaba entera, su archivo pasa al historial y se borra.
- El CLAUDE.md, por debajo de 150 líneas: como mucho una línea si cambia cómo está montado algo; la explicación larga, a claude/historial.md («Detalle por módulo»). Lo que cambies en el CLAUDE.md, cámbialo igual en COMO-TRABAJAMOS.md del proyecto.
