# Maquetas del 22 nov (rama aparte: NO se fusiona ni se publica)

Imágenes rotuladas que se enseñaron a Carlos el 22 nov, con la liga de ejemplo, y los guiones con que se montaron.

- comparacion-propuesta-app.png y comparacion-propuesta-web.png: la propuesta de claude/comparacion-web-app.md (proyecto).
- bajas-variantes.png: dónde va la cruz de las bajas (A, B, C). Carlos eligió la A.
- bajas-diseno-a.png: el diseño A afinado, con la hoja que se abre. Visto bueno de Carlos (10:01). Es la referencia para hacerlo.
- tus-clubes-variantes.png: cuatro tarjetas para «Tus clubes» (1 limpia, 2 el partido delante, 3 con nombres, 4 compacta). Falta que elija.
- clubes-antes-ahora.png: los tres retoques de la 0.8r, antes y después.

guiones/: Playwright sobre la app en local (`python3 -m http.server 8765` en web/). comun.mjs abre la liga de ejemplo con el
aspecto normal (pide un caras-demo.json que no se guarda aquí: ESTADO.md, «Dónde estamos», dice cómo sacarlo); lamina.mjs
monta la lámina rotulada; mock-bajas2.mjs es el diseño A de las bajas; mock-clubes.mjs, las tarjetas; antes-ahora.mjs, el
antes y después. Las rutas (/home/claude/trabajo, /home/claude/charly10sf/…) son las de aquella sesión: hay que cambiarlas.
