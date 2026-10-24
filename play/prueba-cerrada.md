# Prueba cerrada en Google Play — paso a paso

Para que la app pueda salir en Google Play, una cuenta personal de desarrollador creada después del 13 de noviembre de 2023 tiene que pasar antes una prueba cerrada: al menos **12 testers apuntados 14 días seguidos**. Después se pide el acceso a producción y Google contesta en unos 7 días.

Los textos e imágenes de la ficha y las respuestas de cada formulario están en [ficha.md](ficha.md). Aquí va el orden.

## 0. Antes de empezar

- La cuenta de Play Console verificada (identidad y teléfono). Si Play Console pide comprobar un móvil Android, se hace con la app de Play Console en el móvil.
- El correo de contacto de la ficha: contacto@fantasymanagerapp.com (Email Routing de Cloudflare, llega a la Gmail de la app). Lo ve todo el mundo en Google Play.
- Una lista de 15 o 16 correos de Gmail para los testers (12 es el mínimo y alguno se da de baja). Cuentan los apuntados, no los que han instalado. Aun así, Google pregunta luego cómo la han usado, así que conviene que la instalen y la abran.
- Ojo con los de la liga que ya tienen la app de GitHub: la de Google Play va firmada por Google, así que para instalarla tienen que desinstalar antes la de GitHub (y volver a entrar con LaLiga y poner su clave de la IA). Si prefieren seguir con la de GitHub, que se apunten igual: cuentan como apuntados, aunque Google valora que la usen.

## 1. Crear la app

Play Console → **Crear aplicación**:

- Nombre: `Fantasy Manager: tu míster IA`
- Idioma predeterminado: Español (España)
- App, Gratis
- Aceptar las dos declaraciones (políticas y leyes de exportación de EE. UU.)

## 2. Configurar la app (Panel → «Configura tu aplicación»)

Uno por uno, con las respuestas de [ficha.md](ficha.md):

1. **Política de privacidad**: https://fantasymanagerapp.com/privacidad.html
2. **Acceso a la aplicación**: «Todas o algunas funciones están restringidas», con las instrucciones de ficha.md (la liga de ejemplo; no hace falta usuario).
3. **Anuncios**: Sí, tiene anuncios.
4. **Clasificación de contenido**: el cuestionario de ficha.md (categoría: la que no es juego ni red social).
5. **Público objetivo**: 18 años o más.
6. **Aplicaciones de noticias**: No.
7. **Seguridad de los datos**: la tabla de ficha.md.
8. **Aplicaciones gubernamentales**: No. **Funciones financieras**: Ninguna. **Salud**: No.
9. **ID de publicidad**: Sí → Publicidad o marketing, Analítica, Prevención del fraude.

Si sale alguna declaración más (permisos, por ejemplo), copiar aquí la pregunta y la resuelvo.

## 3. Ficha de Play Store

Crecer → Presencia en Play Store → **Ficha principal**: descripción breve y completa de ficha.md, icono (icono-512.png), gráfico destacado (grafico-destacado-1024x500.png) y las 8 capturas. Categoría Deportes, el correo de contacto y, como web, https://fantasymanagerapp.com.

## 4. AdMob

En https://admob.google.com:

1. **Privacidad y mensajes → RGPD (Europa)**: crear un mensaje para la app Fantasy Manager (idioma español; las opciones por defecto valen) y publicarlo. Sin él, la app no puede pedir el consentimiento y en la UE apenas salen anuncios.
2. Cuando la app ya esté en Google Play (la prueba cerrada vale): **Aplicaciones → Fantasy Manager → Configuración de la aplicación → Añadir tienda** y vincularla con la ficha de Play. Así AdMob comprueba el app-ads.txt en la web de la ficha (https://fantasymanagerapp.com/app-ads.txt, lo sube la Action «Dominio»).

Desde la 0.6.0a la versión de Google Play enseña anuncios de verdad ya en la prueba cerrada (`fm.anunciosReales=true` en android/gradle.properties; con false salen los de prueba de Google, marcados «Test Ad»). Hay que avisar a los amigos de que no toquen nunca un anuncio: Google cierra cuentas de AdMob por clics de gente cercana. Hasta que la app esté vinculada en AdMob y revisada, AdMob sirve pocos anuncios.

## 5. La prueba cerrada

Probar y publicar → Probar → **Prueba cerrada**:

1. Canal: el que viene creado (Closed testing - Alpha) o uno nuevo.
2. **Países**: España (y los que quieras).
3. **Testers**: crear una lista de correo con los 15 o 16 correos. En «Comentarios», un correo o enlace donde contestar (puede ser el mismo de contacto).
4. **Crear versión**:
   - Firma de apps de Google Play: aceptar la que propone Google (la clave la genera y guarda Google; la nuestra, subida.p12 de la rama `claves`, cifrada con el secreto PLAY_CLAVE, queda como clave de subida; la de la app de GitHub es otra).
   - Subir el AAB: en GitHub → Actions → «App Android» → la última ejecución en verde → abajo, en Artifacts, `fantasy-manager-<versión>-<número>` (un zip). Dentro va `app-play-release.aab`. Si al lado viene NO-SUBIR-A-GOOGLE-PLAY.txt, ese AAB va con una clave de prueba: no se sube. Los artefactos duran 14 días: si ha caducado, se vuelve a lanzar la Action.
   - Nombre de la versión: el que pone (el número de compilación) o `0.6.0`.
   - Notas de la versión: «Primera versión de prueba. Si algo falla, toca «Fallo», arriba en la app».
5. **Guardar → Revisar versión → Lanzar en prueba cerrada**, y luego, en «Resumen de la publicación», **Enviar cambios a revisión**. La primera revisión suele tardar de 1 a 7 días.

## 6. Cuando Google la apruebe

- En la prueba cerrada → Testers → **Copiar enlace** («Unirse en la Web»). Mandarlo a los testers por WhatsApp.
- Cada tester: abre el enlace con su cuenta de Gmail de la lista → «Convertirse en tester» → «Descargar en Google Play» → instalar y abrirla.
- Los 14 días cuentan desde que hay 12 apuntados a la vez. Si alguien se da de baja, sus días dejan de contar: que nadie se borre hasta que Google dé el acceso.
- Durante la prueba se pueden subir versiones nuevas (cada AAB nuevo, otra versión en el mismo canal): no reinicia los 14 días.

## 7. Día 15: acceso a producción

Panel → **Solicitar acceso a producción**. Tres bloques de preguntas:

- **La prueba cerrada**: lo fácil que fue encontrar testers, cómo la usaron (si probaron todas las funciones y si el uso se parece al de verdad) y qué opinaron y cómo se recogió (el botón «Fallo» de la app y el grupo de WhatsApp).
- **La app**: a quién va dirigida (jugadores de LaLiga Fantasy con liga privada), qué aporta (el plan diario de fichajes, ventas y cláusulas) y cuántas instalaciones esperas el primer año.
- **Lista para producción**: qué cambió con lo que dijeron los testers (las versiones que hayan salido en esas dos semanas) y cómo se decidió que estaba lista.

Si contesta que faltan testers o uso, se sigue con la prueba y se vuelve a pedir.
