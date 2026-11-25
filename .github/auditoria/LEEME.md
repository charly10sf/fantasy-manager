# Sondas de la auditoría de fallos del 25 nov

Solo enseñan fallos: no arreglan nada y no van en «Pruebas». El informe, en claude/auditoria-fallos-25nov.md del proyecto.
Se pasan como las demás (PW_MODULO y CHROME como en prueba-web.mjs), desde la raíz del repo:

- `node .github/auditoria/sonda-nav.mjs`: abre cada ficha, toca un jugador o un club de dentro y vuelve atrás. Donde sale
  MAL, el atrás cierra todo en vez de volver a la ficha de antes (hoy: el resumen de la jornada).
- `node .github/auditoria/sonda-nav2.mjs`: lo mismo con el once de una jornada de un rival, y el candado de dentro de la
  ficha de un rival en la web (tras «Entendido» se vuelve a la lista de Rivales).
- `node .github/auditoria/sonda-iphone.mjs`: lo que dice cada candado con un iPhone (el de «cuándo gira» dice que se abre
  invitando a un amigo, y con eso no se abre).
- El plan en negativo con un solo cambio de mercado:
  `AZAR_SOLO=jueves-negativo/negativo-ultimo node .github/ia/azar-plan.mjs 60 42` (también con 11, 25, 77 y 1125; con la
  semilla 1, la de «Pruebas», no sale).
