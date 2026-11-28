# Tarjetas de las tiendas con el rediseño «Liquid» (27 nov 2026)

Sin subir a ninguna tienda (Carlos: se suben cuando Apple apruebe la 0.8.5, a la vez en Apple con la 0.9 y en Play).
Tres variantes: app-store-6.9 y app-store-6.3 (sin caras ni escudos), app-store-con-caras-6.9 y -6.3, y google-play.
Cómo se rehacen con la app final: claude/tarjetas-tienda.md del proyecto (pantallas.mjs y componer.mjs, aquí también).
Esta rama no se fusiona: solo guarda las tarjetas.

## 28 nov: rehechas con la app final (0.9 publicada, d06771c)

Las ocho pantallas de dentro ya no salen de la maqueta: `pantallas.mjs` abre la app de verdad (web/ servida en local, liga de
ejemplo), navega como un usuario y fija el reloj (viernes 27 nov, 18:40 de Madrid; `RELOJ=<fecha ISO>` lo cambia) para que
las ocho pantallas y la respuesta escrita a mano del chat cuenten lo mismo. `captura.css` (copia de .github/liquid/captura.css)
alarga el cristal solo para la foto: un Chromium sin tarjeta gráfica pinta mal el desenfoque de un cristal bajo.
El diseño de las tarjetas (titulares, líneas, marco, pie) no ha cambiado: `componer.mjs` es el mismo (WEB=ruta de web/).

    CARAS=caras.json node pantallas.mjs p-con 393 852 ; node pantallas.mjs p-sin 393 852 sinfotos
    WEB=<repo>/web node componer.mjs p-sin app-store-6.9 1320 2868   (y 6.3, con-caras y google-play, como arriba)

Siguen SIN SUBIR a ninguna tienda: falta el visto bueno de Carlos y que Apple apruebe la 0.8.5.

Carlos (28 nov, 01:05): lo primero es el dinero de los rivales («es el gamechanger de la app»), por delante del plan. La primera
tarjeta es la lista de Rivales con el dinero de cada uno abierto; orden: dinero, plan, parte, suben, ficha, once, IA, clubes.

VISTO BUENO DE CARLOS (28 nov, 02:38) a las tarjetas y a los textos. EN LA APP STORE VAN CON CARAS: se suben
tienda/app-store-con-caras-6.9 y tienda/app-store-con-caras-6.3 (si Apple pone pegas por las caras, las de sin caras).
En Google Play, tienda/google-play. Siguen sin subir: a la vez en las dos tiendas, cuando Apple apruebe la 0.8.5.
