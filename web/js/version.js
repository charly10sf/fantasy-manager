// La versión de la app. La Action de Android la lee de aquí para nombrar el APK.
// Numeración: la 0.1.0 es la primera completa (las anteriores pasaron a ser la 0.0.1 a la 0.0.11). A partir de
// aquí, cada versión sube el último número (0.1.1, 0.1.2…) y el del medio solo con un cambio grande.
// Los parches (correcciones y cosas pequeñas) no suben el número: llevan una letra detrás de la versión a la que
// arreglan (0.3.3a, 0.3.3b, 0.3.3c…).
export const VERSION = '0.4.4b';

// Lo nuevo de cada versión, de la más nueva a la más vieja. Al abrir una versión nueva se presenta bajando
// (presentacion.js); la lista entera está en Ajustes.
// Cada cosa: tipo (nuevo | mejora | arreglo), d (el dibujo, de dibujos.js), t (título), x (texto) e ir (a dónde
// lleva «Verlo»: { v: pestaña, seg: 'pestaña:sección' }).
export const NOVEDADES = [
  {
    v: '0.4.4b', f: '2026-10-23', h: '12:10', t: 'La web, desde el móvil',
    cosas: [
      { tipo: 'mejora', d: 'conexion', t: 'Desde un Android, la app', x: 'Si alguien abre la web desde un móvil Android, lo primero que ve es «Estás en un Android: instala la app», con el botón para bajarla, en vez de que le pida un código. Desde un iPhone se le explica que la primera vez hay que entrar desde un ordenador.' },
    ],
  },
  {
    v: '0.4.4a', f: '2026-10-23', h: '07:06', t: 'Los nuevos, solo el tutorial',
    cosas: [
      { tipo: 'mejora', d: 'versiones', t: 'Sin novedades para quien acaba de llegar', x: 'A quien instala la app no le salen las novedades de cada versión que le llega sola mientras espera: solo el tutorial al abrirla. Las novedades se le enseñan a partir de entonces.' },
    ],
  },
  {
    v: '0.4.4', f: '2026-10-23', h: '06:59', t: 'Funciones top y quién usa la app',
    cosas: [
      { tipo: 'nuevo', d: 'escudo', t: 'Funciones top', x: 'El dinero de cada rival, quién puede pagar tus cláusulas (y cuánto subirlas para que no le llegue a nadie) y cuándo gira un jugador son funciones top: se desbloquearán pronto viendo un anuncio corto. Mientras, salen con un candado; tócalo para ver qué hacen. El plan y la IA las siguen usando para decidir.', ir: { v: 'rivales' } },
      { tipo: 'nuevo', d: 'campana', t: 'Quién usa la app', x: 'El desarrollador ve, en Ajustes, quién de la liga tiene la app, cuándo entró por última vez y quién está dentro ahora. Está contado en la política de privacidad.' },
      { tipo: 'arreglo', d: 'grafica', t: 'Un rebote no es un giro', x: 'Un jugador que viene de bajar semanas y rebota un poco ya no sale como «estancado después de subir, véndelo antes de que gire»: es un rebote pequeño cerca de su mínimo, y eso solo no es motivo para venderlo. El plan tampoco lo cuenta como venta por inercia.' },
    ],
  },
  {
    v: '0.4.3', f: '2026-10-23', h: '05:56', t: 'Lo que llevas hoy',
    cosas: [
      { tipo: 'nuevo', d: 'plan', t: 'Lo que llevas hoy', x: 'Una lista en Hoy con lo que has hecho de verdad en LaLiga desde el último cambio de mercado: lo terminado (fichajes, ventas, cláusulas, blindajes), lo que está en marcha (pujas, ofertas, lo que tienes a la venta) y si te han clausulado a alguien. Cada cosa dice si venía en el plan o fue por tu cuenta, y abajo, lo que has movido de dinero y lo que te queda del plan.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'semaforo', t: 'El plan se tacha solo', x: 'Cuando haces en LaLiga un paso del plan, se marca solo, sin tocar «Hecho», y dice qué ha visto: «Vendido por 38 M», «Pujado 930 mil, se resuelve a las 20:00», «Cláusula subida a 16,8 M». Lo que está pendiente de resolverse sale en amarillo.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Lo ya hecho no sale como error', x: 'Antes, al vender al jugador que decía el plan, ese paso pasaba a «No lo hagas: no es tuyo» y su dinero se contaba dos veces en el saldo. Ahora queda como hecho y el saldo cuadra.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.4.2a', f: '2026-10-23', h: '05:10', t: 'Pedir otro plan más arriba y compras con sentido',
    cosas: [
      { tipo: 'arreglo', d: 'oferta', t: 'No te propone lo que no te van a vender', x: 'Si un rival tiene a la venta su único portero (o uno que le dejaría sin poder alinear un once), el plan ya no te propone comprárselo: lo normal es que lo tenga a la venta solo para ver qué le da LaLiga. En el Mercado sale marcado como «No lo venderá» y en su ficha se explica por qué.', ir: { v: 'mercado' } },
      { tipo: 'mejora', d: 'ia', t: 'El botón de la IA, a mano', x: '«Pedir otro plan a la IA» va ahora justo debajo del resumen del plan, antes de los pasos: ya no hay que bajar hasta el final. Si tenías la 0.4.2, esta versión te ha llegado sola, sin instalar nada.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.4.2', f: '2026-10-23', h: '04:28', t: 'Se pone al día sola',
    cosas: [
      { tipo: 'nuevo', d: 'versiones', t: 'Los arreglos llegan solos', x: 'Al abrir la app (y cada rato mientras la usas, y aunque esté cerrada hasta la hora de apertura) mira si hay arreglos nuevos, se los baja y se los pone sin reinstalar nada: nada más abrirla, al volver a ella o con el botón «Ponerla» si estabas en medio de algo. Si un arreglo saliera mal, vuelve sola a la versión de antes.' },
      { tipo: 'mejora', d: 'campana', t: 'Actualizar también con la app cerrada', x: 'Solo cuando cambie la parte de Android hará falta instalar una versión nueva. Su botón sale arriba y también en la cuenta atrás y en la pantalla de minutos agotados. En Ajustes, «Buscar nueva» mira las dos cosas.' },
    ],
  },
  {
    v: '0.4.1c', f: '2026-10-23', h: '04:05', t: 'Tutorial y un Hoy más claro',
    cosas: [
      { tipo: 'nuevo', d: 'versiones', t: 'Un tutorial por la app', x: 'La primera vez te enseña cada cosa sobre la app de verdad: el marcador, el plan, la IA, Actualizar, Fallo y las pestañas, y al final lo que conviene activar. Se pasa con Siguiente o deslizando la tarjeta. Lo puedes repetir cuando quieras desde Ajustes, arriba del todo.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'ia', t: 'Pedir otro plan, más a mano', x: 'El botón de la IA va ahora al final de los pasos del plan, grande, y explica en qué se diferencia de «Actualizar», que solo trae los datos de LaLiga. Si tu plantilla cambia sin que el plan lo dijera (un clausulazo, una puja que ganas), te lo avisa arriba del plan con un botón para rehacerlo.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'camiseta', t: 'El marcador, sin huecos', x: 'A cuántos puntos estás del primero va ahora en la columna del puesto, y la flecha de arriba dice que el marcador se toca para ver el detalle. Lo de la última jornada está dentro de ese detalle.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.4.1b', f: '2026-10-23', h: '03:30', t: 'Minutos en total y aviso de apertura',
    cosas: [
      { tipo: 'arreglo', d: 'noche', t: 'El límite de minutos, en total', x: 'Los minutos al día se cuentan por cuenta de LaLiga, no por dispositivo: el tiempo en la app y en la web se suma. Arriba, debajo del nombre de la liga, ves los que te quedan hoy.' },
      { tipo: 'nuevo', d: 'campana', t: 'Aviso cuando se abra', x: 'Si la app aún no se ha abierto, te llega una notificación justo a la hora de apertura. En la cuenta atrás tienes el botón «Avísame cuando se abra» para dar el permiso.' },
      { tipo: 'arreglo', d: 'camiseta', t: 'Cerrada para todos hasta la hora', x: 'Hasta la hora de apertura tampoco se puede ver la liga de ejemplo, y el cierre sale nada más cargar tu liga, sin esperar.' },
    ],
  },
  {
    v: '0.4.1a', f: '2026-10-23', h: '03:10', t: 'Hora de apertura',
    cosas: [
      { tipo: 'nuevo', d: 'noche', t: 'Todos a la vez', x: 'La app puede tener una hora de apertura: hasta entonces, a los nuevos les sale una cuenta atrás (pueden instalarla y entrar con su cuenta, pero no ver nada) y no les llega ningún aviso. A esa hora se abre sola y se pone al día.' },
    ],
  },
  {
    v: '0.4.1', f: '2026-10-23', h: '03:00', t: 'Avisos de fallos con respuesta',
    cosas: [
      { tipo: 'nuevo', d: 'campana', t: 'Avísame de un fallo y te contesto', x: 'Arriba, en «Fallo», cuentas qué ha pasado y me llega a mí con lo que necesito para arreglarlo. Te contesto desde la app y te llega la respuesta: un aviso al abrirla y el numerito en el botón. Ahí mismo ves todos tus avisos y sus respuestas.' },
      { tipo: 'nuevo', d: 'ia', t: 'Pullitas al gusto', x: 'En Ajustes, en la parte de la IA, eliges cómo quieres las pullitas: sin ellas, suaves, normales (como hasta ahora) o a saco. Nunca deciden una compra ni una venta.' },
      { tipo: 'nuevo', d: 'conexion', t: 'También en el iPhone', x: 'La web de un ordenador donde ya has entrado ahora también saca un código (Ajustes → Abrir en otro dispositivo). Escríbelo en la web desde el iPhone y entras con tu cuenta, sin repetir lo del F12.' },
      { tipo: 'nuevo', d: 'camiseta', t: 'Bienvenida para los nuevos', x: 'Quien entra por primera vez con su cuenta ve tres pasos cortos: dónde está su plan del día, cómo activar la IA gratis y cómo avisar de un fallo. A los que ya la usabais no os sale.' },
      { tipo: 'mejora', d: 'plan', t: 'Arriba, menos lío', x: 'Arriba quedan tres botones: Actualizar (trae lo último de tu liga y, si el plan se ha quedado viejo, la IA lo rehace sola), Fallo y Ajustes. Para rehacer el plan a mano, el botón está en la propia tarjeta del plan, en Hoy.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'conexion', t: 'Si LaLiga cambia algo, se nota', x: 'Si LaLiga cambia el formato de sus datos, la app ya no se queda vacía como si nada: te dice que LaLiga ha cambiado algo y te deja mandarme el fallo. Si lo que falta son los jugadores o las plantillas, sale un aviso en Hoy con el botón «Avisar».', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Una pantalla rota no rompe la app', x: 'Si una pestaña o una ficha falla al abrirse, lo dice, las demás siguen funcionando y tienes un botón para mandarme el fallo con todo lo que necesito.' },
    ],
  },
  {
    v: '0.4.0', f: '2026-10-23', h: '01:33', t: 'Lista para más ligas',
    cosas: [
      { tipo: 'mejora', d: 'conexion', t: 'Los fallos, explicados', x: 'Si no se puede cargar tu liga, ahora te dice qué pasa y qué hacer: sin internet (y lo vuelve a intentar sola en cuanto vuelve), LaLiga caída, LaLiga ha cambiado algo, una cuenta sin ligas o una liga vacía. Si ya tenías la liga guardada, la sigues viendo con un aviso de cuándo es.' },
      { tipo: 'nuevo', d: 'camiseta', t: 'Cambia de liga desde arriba', x: 'Si tu cuenta está en varias ligas, toca su nombre en la cabecera para cambiar. Cada liga guarda su plan, su chat y lo que le has contado a la IA por separado, sin mezclarse.' },
      { tipo: 'nuevo', d: 'ajustes', t: 'Avisar de un fallo', x: 'En Ajustes, «Avisar de un fallo» abre WhatsApp (o lo que uses) con todo lo que necesito para arreglarlo. Solo tienes que contar qué hacías.' },
      { tipo: 'arreglo', d: 'ia', t: 'La clave de la IA, sin líos', x: 'Si Google deja de aceptar tu clave (la borraste o se copió mal), el plan y el chat te lo dicen con un botón para poner otra, en vez de un error raro.' },
    ],
  },
  {
    v: '0.3.5a', f: '2026-10-22', h: '23:03', t: 'El teclado del chat',
    cosas: [
      { tipo: 'arreglo', d: 'voz', t: 'Ya puedes escribir', x: 'En la app, al tocar donde se escribe a la IA a veces no salía el teclado (pasaba al volver del selector de fotos o del dictado: Android dejaba la app sin foco). Ahora, al tocar la caja, la app recupera el foco y saca el teclado.', ir: { v: 'ia' } },
    ],
  },
  {
    v: '0.3.5', f: '2026-10-22', h: '22:19', t: 'Fotos y capturas en el chat',
    cosas: [
      { tipo: 'nuevo', d: 'foto', t: 'Mándale capturas a la IA', x: 'En Pregunta, el botón de la foto (a la izquierda de donde escribes) te deja mandarle hasta 4 fotos o capturas por mensaje: una oferta que te han hecho, el mercado, las cláusulas de un rival, un chat con otro manager… La IA la lee, la cruza con los datos de tu liga y te dice qué hacer. Puedes mandarla con una pregunta o sola. En el ordenador también se pueden pegar (Ctrl+V) o arrastrar al chat. Si sigues hablando de ella, se la vuelve a mandar; toca la foto para verla en grande.', ir: { v: 'ia' } },
    ],
  },
  {
    v: '0.3.4a', f: '2026-10-22', h: '21:00', t: 'Blindajes y ofertas a otros managers',
    cosas: [
      { tipo: 'arreglo', d: 'mercado', t: 'Ofertas que sí te puede aceptar', x: 'Cuando otro manager pone a uno a la venta, LaLiga también le hace su oferta y él se queda con la mejor. La app te proponía ofrecerle lo que pide (a veces justo su valor), y así nunca te lo iba a vender. Ahora calcula lo que suele dar LaLiga en tu liga y te propone ofrecer por encima: lo ves en el mercado («ofrece…»), en su ficha y en el plan de la IA, que ya no te pide menos de eso.', ir: { v: 'mercado', seg: 'mercado:venta' } },
      { tipo: 'arreglo', d: 'escudo', t: 'Los blindajes, en cuenta', x: 'El blindaje de LaLiga (el escudo que se pone viendo un anuncio) protege la cláusula de un jugador 24 h. La app no lo contaba y te decía que clausularas a uno que su dueño acababa de blindar. Ahora un jugador blindado sale como «Blindado · hasta…», no te lo propone hasta que se acabe y te avisa cuando se abra. La IA también lo sabe.', ir: { v: 'rivales', seg: 'rivales:clausulas' } },
      { tipo: 'nuevo', d: 'escudo', t: 'Tus blindajes, a tu favor', x: 'Tienes 2 blindajes gratis por jornada. Si uno de los tuyos que importa tiene la cláusula abierta y algún rival la puede pagar, la app y la IA te proponen blindarlo (gratis) antes que gastar en subirle la cláusula, y no te lo proponen con los que toca vender. En Equipo → Cláusulas ves cuántos te quedan y cuáles están blindados.', ir: { v: 'equipo', seg: 'equipo:clausulas' } },
    ],
  },
  {
    v: '0.3.4', f: '2026-10-22', h: '19:34', t: 'La carga, por fin, y tiempo para los viciados',
    cosas: [
      { tipo: 'mejora', d: 'camiseta', t: 'Pantalla de carga nueva', x: 'Al abrir la app sale el logo mientras arranca (se acabó el «0 de 10» que no se movía: eso era la pantalla de arranque, que se quedaba ahí hasta que salía la app). Cuando de verdad hay que bajar toda la liga, la camiseta se llena de rojo con la lista de los 10 pasos: los hechos con ✓, el de ahora girando (con los segundos si tarda) y los que faltan. En el ordenador, la camiseta y el título a la izquierda y los pasos a la derecha.' },
      { tipo: 'nuevo', d: 'noche', t: 'Límite de uso al día', x: 'Cada equipo de la liga puede tener un máximo de minutos al día con la app abierta. Cinco minutos antes avisa, y al pasarse sale «Se acabó por hoy» hasta las 00:00 (los avisos siguen llegando). En Ajustes se ve cuánto llevas. Son 15 minutos al día para todos menos para el admin, que los puede cambiar sin sacar versión.' },
      { tipo: 'mejora', d: 'cara', t: 'Tu equipo, el de tu cuenta', x: 'Ya no se elige el equipo en Ajustes: al entrar con tu cuenta de LaLiga, la app te lleva siempre a tu equipo de esa liga. Si estás en varias ligas, en Ajustes sigues pudiendo cambiar de liga.' },
      { tipo: 'arreglo', d: 'campo', t: 'El ordenador, a todo lo ancho', x: 'La columna de la derecha (el marcador, las cláusulas a tiro, los movimientos) iba en una caja con su propio scroll y se cortaba por abajo, los avisos de arriba se salían por el lado y en pantallas anchas quedaba un hueco negro a la derecha. Ahora todo baja con la página y ocupa el ancho entero.' },
    ],
  },
  {
    v: '0.3.3a', f: '2026-10-22', h: '01:31', t: 'Cómo le fue contra cada rival',
    cosas: [
      { tipo: 'nuevo', d: 'semaforo', t: 'V, E y D contra cada rival', x: 'En el calendario de la ficha de cada jugador, debajo de cada rival salen sus últimos enfrentamientos: V si ganó su equipo, E si empató y D si perdió, de la más vieja a la más reciente (idea de Domy). Salen de SofaScore, con todas las competiciones; si no hay, lo de esta temporada en LaLiga. Cuenta poco en la dificultad del partido (como mucho un 4 %), porque pesa más cómo están ahora los dos equipos, y la IA también lo ve.' },
    ],
  },
  {
    v: '0.3.3', f: '2026-10-21', h: '22:35', t: 'Menos cosas a la vez',
    cosas: [
      { tipo: 'mejora', d: 'lupa', t: 'Menos cosas a la vista', x: 'Cada fila de jugador lleva como mucho 3 etiquetas, las que avisan de algo (lesión, que ha girado, suplente, calendario duro…): lo normal, como ser titular o lo que pone el título de la sección, ya no se repite, y el resto está en su ficha. Hoy se queda con el marcador, lo urgente que no está en el plan, el plan y las noticias: tus ventas, las cláusulas a tiro, la clasificación y los movimientos están en su pestaña. Mercado pasa de 5 pestañas a 3 (Fichar, Especular y Tendencias, con Suben, Bajan y Sin dueño dentro), la puja que te propongo va a la derecha de cada libre, y lo tuyo en venta está solo en Equipo. En Rivales, las cláusulas tienen 3 filtros en vez de 5.', ir: { v: 'mercado' } },
      { tipo: 'arreglo', d: 'grafica', t: 'El valor de los rivales, sin las ventas', x: 'En «Valor en tu liga» salían bajadas de 20 o 67 M porque se restaba el valor del equipo de ayer al de hoy, y si un manager vende o le clausulan a uno de 60 M, su equipo «baja» 60 M aunque el mercado no se haya movido. Ahora es lo que han subido o bajado los jugadores que tiene cada uno, hoy y en 7 días, igual que el tuyo. La IA lo ve igual.', ir: { v: 'rivales' } },
      { tipo: 'mejora', d: 'ia', t: 'Rehacer el plan, arriba', x: 'El botón para rehacer el plan con la IA está ahora en la barra de arriba («Plan IA», al lado de «Actualizar» y «Ajustes», que ahora también llevan su nombre), así que lo tienes en cualquier pestaña: te lleva a Hoy y se pone a hacerlo. Mientras trabaja pone «Pensando…». Y «Cuéntale algo» sale de Hoy: para contarle cosas a la IA (un trato con un amigo, a quién no quieres vender) está el micro y la caja de Pregunta, y allí ves también lo que le has contado.' },
    ],
  },
  {
    v: '0.3.2', f: '2026-10-21', h: '21:54', t: 'Más a mano y más legible',
    cosas: [
      { tipo: 'mejora', d: 'camiseta', t: 'Pantalla de carga nueva', x: 'Al abrir la app ya no sale el escudo viejo: la camiseta se va llenando de rojo según se pone al día tu liga, con los 10 pasos debajo y por cuál va.' },
      { tipo: 'mejora', d: 'campo', t: 'Los menús, más a mano', x: 'Las pestañas de cada pantalla (Plantilla, En venta, Cláusulas…) se ven todas sin que se corte ninguna y se quedan fijas arriba al bajar. Para pasar de una a otra también puedes deslizar el dedo de lado sobre la pantalla. Y para actualizar, tira hacia abajo desde arriba del todo. Los filtros ya no se salen por la derecha y la barra de abajo tiene las letras más grandes.' },
      { tipo: 'mejora', d: 'lupa', t: 'Todo más legible', x: 'Las letras pequeñas son más grandes, los grises tienen más contraste, los títulos de cada bloque se leen mejor y la segunda línea de cada jugador ya no se corta con puntos suspensivos.' },
      { tipo: 'arreglo', d: 'semaforo', t: 'El calendario no frena una venta', x: 'Con tus jugadores, el calendario ya no te dice «no lo vendas barato» si la app te está diciendo que lo vendas porque baja. Si está bajando, manda la venta (le vengan partidos buenos o malos); si baja poco, te lo dice; y si lo tienes en venta, manda la oferta. El «riesgo» del calendario ya no sale en los tuyos, porque es el riesgo de ficharlo. La IA tiene la misma regla.', ir: { v: 'equipo' } },
      { tipo: 'arreglo', d: 'campo', t: 'Los 5 partidos, aunque no tengan fecha', x: 'Las jornadas que LaLiga aún no ha puesto en el calendario venían sin fecha y se quedaban fuera, así que salían 3 partidos en vez de 5. Ahora cuentan con una fecha aproximada (una semana por jornada, más el parón) y salen como «sin fecha».' },
    ],
  },
  {
    v: '0.3.1', f: '2026-10-21', h: '21:23', t: 'El calendario de riesgo',
    cosas: [
      { tipo: 'nuevo', d: 'semaforo', t: 'Calendario de riesgo', x: 'En la ficha de cada jugador están sus próximos 5 partidos (o todos los de los 14 días que tendría la cláusula protegida si lo fichas, si son más): contra quién, en casa o fuera, lo difícil que es para él (a un defensa le pesa el rival que marca mucho; a un delantero, el que no encaja), los puntos que se esperan en cada uno y su titularidad, con la rotación si su equipo juega Champions o Copa cerca. De ahí sale si el calendario es duro, normal o favorable y el riesgo de ficharlo. Si es duro o no es seguro que juegue, la app y la IA solo te lo proponen de parche (si te falta gente sana en ese puesto) y sin pagar más de un 5 % sobre su valor, y la puja que te sugieren se queda en ese tope. En las listas lo ves con «Calendario duro» o «Calendario favorable».', ir: { v: 'mercado' } },
      { tipo: 'nuevo', d: 'camiseta', t: 'Logo nuevo', x: 'Adiós al escudo: ahora es una camiseta roja vista de espaldas, con MANAGER donde va el nombre y el 11 de dorsal, por tu once. Sale en el icono del móvil, en el de los avisos, en la pestaña del navegador y arriba en la app. Si usas iconos con tema en Android, también tiene su versión de un color.' },
      { tipo: 'mejora', d: 'campo', t: 'En el ordenador, a lo ancho', x: 'La web ya no es el móvil estirado. Las pestañas van en una columna a la izquierda con tu liga. En Hoy, el plan ocupa el centro y a la derecha tienes el marcador, tu equipo, la liga, las cláusulas a tiro y los últimos movimientos. En Equipo, el once al lado de la plantilla; en Rivales, la clasificación con lo que te llega de ellos al lado; y las listas de jugadores, a dos columnas. Las fichas se abren de lado sin taparlo todo y el chat queda centrado, cómodo de leer. En el móvil sigue todo igual.' },
      { tipo: 'arreglo', d: 'oferta', t: 'No malvender a LaLiga', x: 'LaLiga hace una oferta nueva cada día por lo que tienes en venta. Si la de hoy es de las más bajas que suele dar en tu liga y no hay prisa (no empiezas la jornada en negativo ni está de baja), ya no te dice que vendas aunque el jugador vaya a la baja: te dice que esperes a la de mañana y cuánto ganarías, contando con lo que baje. La IA tiene la misma regla.', ir: { v: 'equipo', seg: 'equipo:venta' } },
    ],
  },
  {
    v: '0.3.0', f: '2026-10-21', h: '20:19', t: 'También en el ordenador',
    cosas: [
      { tipo: 'nuevo', d: 'conexion', t: 'La app, en el navegador', x: 'Ahora también está en charly10sf.github.io/fantasy-manager, con tu liga de verdad. Para entrar, en la app: Ajustes → Abrir en el ordenador. Te da un código de 8 letras que dura 10 minutos; lo escribes en la web y entras con tu cuenta de LaLiga, tu clave de la IA y el dinero que te han dicho los rivales. Los avisos y la IA trabajando sola siguen siendo cosa de la app del móvil.' },
      { tipo: 'mejora', d: 'ajustes', t: 'Lista para Android 16', x: 'La app apunta ya a Android 16, lo que pide Google Play. Se dibuja de borde a borde sin que la tapen las barras del sistema ni el teclado, y el gesto de atrás va con el sistema nuevo de Android.' },
      { tipo: 'nuevo', d: 'periodico', t: 'Pullitas', x: 'Cuando sale una noticia de fuera del campo con gracia (un robo en casa, una fiesta, un lío en redes), la IA te la cuenta con su pullita, y alguna se lleva también algún rival por lo que hace en el mercado. Eso sí, nunca es motivo para comprar ni vender: eso sigue saliendo de minutos, forma, rival, inercia y precio.', ir: { v: 'hoy' } },
      { tipo: 'nuevo', d: 'escudo', t: 'Privacidad', x: 'En Ajustes está la política de privacidad: qué datos usa la app y dónde se quedan (en tu móvil o en tu navegador; nada en servidores propios). Y queda claro que es una app no oficial, sin relación con LaLiga.' },
    ],
  },
  {
    v: '0.2.4', f: '2026-10-21', h: '13:41', t: 'El plan vuelve y el dinero cuadra',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'El plan ya no se queda a medias', x: 'Google está tardando mucho (hasta siete minutos) y el plan, pensando a tope, se quedaba sin sitio para escribir y llegaba cortado. Ahora piensa a medias, tiene el doble de sitio y espera hasta cinco minutos y medio. Si aun así se corta, lo vuelve a pedir más corto; y si Google no contesta a tiempo, se lo pide pensando menos o sin búsqueda en vez de darte un error.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'dinero', t: 'El dinero de los rivales, bien contado', x: 'Ahora cuenta lo que se gasta cada uno en subir cláusulas, que LaLiga no apunta en ningún sitio: se ve en su plantilla, comparando la cláusula de cada jugador con la que tenía al ficharlo (pagar X la sube 2X). Antes esto no se restaba y salían rivales con 30 M de más. Y el escudo (lo que LaLiga llama blindar) ya no se cuenta como gasto, porque se paga con un anuncio.', ir: { v: 'rivales' } },
      { tipo: 'nuevo', d: 'oferta', t: 'Lo que te dice un rival', x: 'Si un rival te dice cuánto tiene, apúntalo en su ficha («¿Te ha dicho cuánto tiene?»), con una cifra o entre dos. Desde entonces su dinero sale de eso más lo que mueva, y ves cuánto fallaba la cuenta.', ir: { v: 'rivales' } },
      { tipo: 'arreglo', d: 'escudo', t: 'Los clausulazos, a la vista', x: 'LaLiga apunta los clausulazos como un traspaso más. Ahora se detectan cuando se paga justo la cláusula que tenía el jugador, así que cuentan en la amenaza de cada rival y en lo que se paga en tu liga.', ir: { v: 'rivales' } },
    ],
  },
  {
    v: '0.2.3', f: '2026-10-21', h: '05:31', t: 'Arreglos de la 0.2.2',
    cosas: [
      { tipo: 'arreglo', d: 'escudo', t: 'Proteger solo a quien importa', x: 'Si te clausulan a un jugador, cobras su cláusula: lo que pierdes son los puntos que te da. Así que ya no te pide proteger a un suplente con la cláusula en su valor, y un titular con la cláusula un 30 % o más por encima no tiene ningún riesgo (nadie paga tanto de más, y menos si está bajando). Cuenta también los euros de más, no solo el porcentaje: un 10 % por encima son 500 mil en uno de 5 M (alguien lo paga) y 8 M en uno de 80 M (nadie). Y mira hasta dónde se ha llegado en los clausulazos de tu liga. Solo avisa si es importante en tu once, la cláusula está cerca de su valor, algún rival puede pagarla y el blindaje compensa; y dice las cifras como son (en porcentaje, nada de «casi no pasa de su valor»). Si está a tiro pero blindarlo no compensa, te lo dice sin meterlo en lo urgente.', ir: { v: 'equipo', seg: 'equipo:clausulas' } },
      { tipo: 'arreglo', d: 'campana', t: 'El mercado, a su hora', x: 'El cambio de mercado es la hora a la que caducan los libres de LaLiga. Lo que pone a la venta un manager caduca a su propia hora y ya no adelanta la cuenta atrás.', ir: { v: 'mercado' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'El saludo y la última jornada', x: 'El saludo ya no usa el nombre del equipo como si fuera el tuyo. Y los puntos de la última jornada salen del histórico de cada equipo, no los de la jornada que aún no ha empezado (que siempre son cero).', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.2.2', f: '2026-10-21', h: '04:59', t: 'Más clara y más a tiempo',
    cosas: [
      { tipo: 'nuevo', d: 'campana', t: 'Avisos para poner a la venta', x: 'Una notificación cuando toca poner a alguien en el mercado: si ha girado a la baja, si está a punto de girar, si está lesionado, si es el día de vender lo que compraste para revender o si vas en negativo antes de la jornada. Y en cuanto lo pones, otra con cuándo llega la oferta de LaLiga; cuando llega, te dice si te conviene aceptarla.', ir: { v: 'equipo' } },
      { tipo: 'nuevo', d: 'dinero', t: 'Lo que ofrece LaLiga', x: 'Las ofertas de otros managers por un jugador en venta solo las ve su dueño, pero lo que paga LaLiga se sabe por las ventas de tu liga. Con eso, en cada jugador que vende un rival ves lo que le daría LaLiga si nadie se lo compra (por menos no tiene por qué vendértelo), y en los tuyos en venta, lo que rondará su oferta antes de que llegue.', ir: { v: 'mercado' } },
      { tipo: 'mejora', d: 'plan', t: 'Una pantalla principal más clara', x: 'Arriba, tu marcador con lo que sacaste en la última jornada y a cuántos puntos estás del primero (o cuántos le sacas al segundo). Debajo, lo que va a pasar pronto (el mercado, las cláusulas que se abren, el parón), lo urgente de verdad en tres líneas y tu equipo de un vistazo: cuántos suben y bajan, los que hay que vender, bajas y cláusulas abiertas. El plan enseña los primeros pasos y pliega el resto, el once se abre solo cuando la jornada está cerca, y al final ves tu liga en corto con el dinero de cada uno.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'lupa', t: 'Subpestañas con números', x: 'Cada subpestaña dice lo que hay dentro (cláusulas abiertas, jugadores en venta, chollos para especular…). Tus cláusulas salen agrupadas en abiertas, las que se abren en 48 h y protegidas, con a cuántos rivales les llega cada una y el blindaje justo. En la clasificación, cuántos puntos te saca cada uno; en el mercado, un resumen arriba; y en «Ver el detalle», lo que hay que vender por la inercia y lo que ganaría o perdería tu equipo hasta la jornada.', ir: { v: 'equipo' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'El dinero de los rivales, sin tope', x: 'En ligas con mucho movimiento se puede tener bastante más dinero que equipo: la estimación ya no se descarta por eso, solo si sale una deuda imposible.', ir: { v: 'rivales' } },
      { tipo: 'nuevo', d: 'ia', t: 'Chat nuevo cuando quieras', x: 'Arriba del chat, «Nuevo chat» empieza de cero. El de antes no se pierde: queda en «anteriores» (los 15 últimos) y puedes volver a él. Lo que le has contado lo sigue recordando.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'voz', t: 'Un chat más cómodo', x: 'Preguntas pensadas para tu liga de hoy (si alguien ha girado a la baja, si una cláusula te llega, si tienes una oferta), botones para seguir la conversación sin escribir («Dímelo más corto», «¿Qué hago primero?»), la hora de cada mensaje y un botón para copiar cada respuesta.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'oferta', t: 'Aceptar o esperar, con la inercia', x: 'Si un jugador tuyo en venta ha girado a la baja o se está frenando, la app te dice que aceptes la oferta aunque se quede un poco por debajo de su valor: esperar sale más caro.', ir: { v: 'equipo' } },
    ],
  },
  {
    v: '0.2.1', f: '2026-10-21', h: '03:42', t: 'Vender antes de que baje',
    cosas: [
      { tipo: 'nuevo', d: 'grafica', t: 'La inercia del valor', x: 'Lo que cambia el valor de cada jugador cada día de la última semana. Si sube cada vez menos (1 M, 800 mil, 500 mil…), calcula en cuántos días dejará de subir y te dice que lo vendas antes del giro. Si después de subir se estanca o ya baja, ha girado: venta casi obligatoria, con lo que perderías hasta la jornada. En la ficha, con una barra por día; en tu equipo, marcado; y en el plan.', ir: { v: 'equipo' } },
      { tipo: 'mejora', d: 'especular', t: 'Comprar y revender, con la inercia', x: 'El mercado marca «Frenando» a los que suben cada vez menos, y para revender ya no te propone nada que se esté frenando o haya girado. La IA lo tiene en cuenta para todo: mira hacia dónde va el valor ahora, no el total de la semana.', ir: { v: 'mercado' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Lo vendido ya no cuenta', x: 'Si vendes a un jugador o te lo clausulan, sale de tu equipo en la app al momento, aunque LaLiga tarde en quitarlo de tu plantilla. También si se lo dices a la IA en el chat («ya he vendido a…»). La IA recibe la lista de los que ya no son tuyos con la orden de no contar con ellos, y lo hablado antes en el chat no manda sobre los datos de ahora. Si aun así nombra a uno, te avisa debajo de la respuesta.', ir: { v: 'ia' } },
    ],
  },
  {
    v: '0.2.0', f: '2026-10-21', h: '02:56', t: 'Cuánto tiene cada rival',
    cosas: [
      { tipo: 'nuevo', d: 'dinero', t: 'El dinero de cada rival', x: 'Si LaLiga lo da, exacto. Si no, se calcula con todos los movimientos de la liga desde el principio: como empezasteis con lo mismo, su saldo es el tuyo menos lo que has movido tú más lo que ha movido él (compras, ventas, cláusulas, blindajes y premios por jornada). La recompensa diaria no sale en los movimientos, por eso va con un margen. La primera vez la carga tarda un poco más: baja la actividad entera.', ir: { v: 'rivales' } },
      { tipo: 'nuevo', d: 'escudo', t: 'Quién puede quitarte a cada uno', x: 'En la ficha de tus jugadores con la cláusula abierta o a punto: a qué rivales les sobra el dinero y a cuáles les llega justo. Y el blindaje justo: hasta dónde subirla para que no le llegue a nadie y lo que cuesta (subir X cuesta X/2). Si no compensa, te lo dice.' },
      { tipo: 'nuevo', d: 'oferta', t: 'Pujas a la medida de tu liga', x: 'Cada compra al mercado de las últimas semanas, frente a lo que valía el jugador ese día: lo que se paga de mediana en tu liga, por los caros y por los baratos, y lo que paga cada rival. La puja que te propongo sale de ahí y de lo que te interesa el jugador, sin pasarse de lo que te aporta.', ir: { v: 'mercado' } },
      { tipo: 'nuevo', d: 'campo', t: 'Puntos esperados por partes', x: 'Como puntúa LaLiga Fantasy: minutos, gol con su xG, asistencia con su xA, portería a cero, goles encajados, paradas, tarjetas y el resto (la nota de DAZN, recuperaciones, tiros…). La titularidad junta el once probable, sus últimos partidos y lo que ha jugado en la temporada. En la ficha, con una barra por cada parte.' },
      { tipo: 'nuevo', d: 'semaforo', t: 'Riesgo de rotación', x: 'Los partidos de Champions, Europa League, Conference y Copa de cada equipo, de SofaScore. Si le toca uno pegado a la jornada, le baja la titularidad (más con la Champions que con la Copa) y te lo avisa en la ficha.' },
      { tipo: 'nuevo', d: 'grafica', t: 'Aprende de lo que falla', x: 'Antes de cada jornada apunta lo que espera de cada jugador y después lo compara con lo que sacó: si a los delanteros les espera de más, se corrige solo, y la forma de calcular que más acierta pesa más. También mira cómo salió lo que te recomendó la IA; lo tienes al final del plan y la IA lo ve para no repetir errores.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'dinero', t: 'Lo caro, en euros y sin saltos', x: 'No es lo mismo un +25 % de 3 M que de 40 M: lo que se paga de más se mide en euros frente a tu equipo y descontando parte de lo que recuperas en una semana. Un índice de 0 a 100 que crece poco a poco, y lo que se aguanta va de 60 si no le aporta nada a tu once a 95 si lo mejora mucho. El plan tacha lo que se pasa y la IA lo pesa.' },
      { tipo: 'arreglo', d: 'ajustes', t: 'Sin zoom', x: 'La app ya no se amplía al pellizcar ni con doble toque.' },
    ],
  },
  {
    v: '0.1.6', f: '2026-10-21', h: '00:11', t: 'Pregunta, espera y sigue a lo tuyo',
    cosas: [
      { tipo: 'nuevo', d: 'ajustes', t: 'Para la IA cuando quieras', x: 'Mientras prepara el plan o te contesta, tienes un botón «Parar». El plan se queda como estaba y puedes pedir otro; la pregunta vuelve a la caja para cambiarla o mandarla otra vez.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'voz', t: 'Tu pregunta, a la vista', x: 'Mientras la IA piensa, tu pregunta ya sale en el chat.' },
      { tipo: 'mejora', d: 'scroll', t: 'Una pantalla de carga de verdad', x: 'Con el escudo latiendo, una barra con el porcentaje, el paso por el que va, lo que ya tiene listo y, mientras esperas, consejos del juego que van cambiando.' },
      { tipo: 'mejora', d: 'voz', t: 'El chat sigue aunque salgas', x: 'Pregúntale algo y vete a otra app: mientras piensa sale una notificación fija y no se corta. Cuando contesta, te llega una notificación con el principio de la respuesta; tócala y vas directo al chat.', ir: { v: 'ia' } },
    ],
  },
  {
    v: '0.1.5', f: '2026-10-20', h: '23:57', t: 'El rival y el rendimiento, a fondo',
    cosas: [
      { tipo: 'mejora', d: 'semaforo', t: 'Contra quién y cómo le fue', x: 'La IA recibe las últimas jornadas de cada jugador con su rival y el resultado («J9 11 vs Getafe 19º 2-0»), y lo que rinde en casa, fuera, contra los seis primeros y contra los seis últimos.' },
      { tipo: 'nuevo', d: 'campo', t: 'La previa de cada partido', x: 'Cómo llegan los dos equipos en sus últimos cinco partidos, lo que marca y encaja el rival, cómo le va en ese campo, la portería a cero esperada para porteros y defensas, los goles esperados para medios y delanteros, y los puntos que se esperan. También en la ficha de cada jugador.' },
      { tipo: 'mejora', d: 'ia', t: 'Lo usa para decidir', x: 'Un jugador que solo puntúa contra los de abajo no es fiable contra el Madrid, y un defensa con poca portería a cero puntuará poco aunque sea titular. La IA compara lo que le toca con lo que hizo contra rivales parecidos.' },
      { tipo: 'nuevo', d: 'grafica', t: 'Más allá del Fantasy', x: 'Estadísticas avanzadas de Understat (xG, xA, tiros y pases clave de cada jugador, y el xG que genera y concede cada equipo) y de SofaScore (nota media, las últimas notas y lo que hace en defensa o bajo palos). La IA las usa para afinar: si genera ocasiones aunque no marque, si su nota baja, cuánto recupera un defensa. También en la ficha, en «Rendimiento a fondo».' },
      { tipo: 'mejora', d: 'semaforo', t: 'Partidos medidos con xG', x: 'Los goles esperados y la portería a cero de la previa se calculan con el xG de los dos equipos cuando lo hay, que dice más que los goles.' },
      { tipo: 'arreglo', d: 'camiseta', t: 'Fuera los entrenadores', x: 'En la versión gratis no se alinean ni puntúan: ya no salen en el once, en el mercado ni en las cláusulas. Si tienes alguno, el plan te dice que lo vendas.' },
    ],
  },
  {
    v: '0.1.4', f: '2026-10-20', h: '22:31', t: 'Una IA mucho más fina',
    cosas: [
      { tipo: 'mejora', d: 'escudo', t: 'Solo lo que se puede hacer', x: 'La app le da a la IA la lista de operaciones posibles hoy, cada una con su referencia: pujar por libres de la liga, comprar lo que otro manager tiene a la venta (decide él), tratos que le has contado, cláusulas abiertas o que se abren antes de la jornada, aceptar ofertas, vender y blindar. Fuera de esa lista no puede recomendar nada.' },
      { tipo: 'arreglo', d: 'oferta', t: 'Un jugador de un rival no se compra porque sí', x: 'Si no lo tiene a la venta ni es un trato tuyo, el paso sale tachado: su dueño no tiene por qué vendértelo, y menos si lo acaba de fichar. Y los recién fichados que la API sigue dando en el mercado ya no salen como libres ni como «en venta».', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'lupa', t: 'Siete preguntas antes de cada paso', x: '¿Se puede? ¿Juega? ¿Puntúa? ¿Qué cuesta? ¿Te hace falta? ¿Te llega? ¿Qué riesgo tiene? La IA las repasa con cada candidato, piensa a fondo y prefiere no hacer nada a hacer algo dudoso.' },
      { tipo: 'nuevo', d: 'periodico', t: 'Noticias de cada equipo y cómo le va', x: 'Además de las de cada jugador, titulares de cada equipo (lesiones, convocatorias, ruedas de prensa, alineaciones), los últimos cinco resultados de cada uno y la última jornada. Cada candidato llega con su prensa de los últimos días.' },
      { tipo: 'nuevo', d: 'plan', t: 'Por qué sí y por qué no', x: 'Cada paso del plan trae sus datos clave en pastillas (titular, forma, rival, lo que sube, lo que pagas de más) y al final sale lo que ha mirado y descartado, con el motivo.' },
      { tipo: 'arreglo', d: 'grafica', t: 'La gráfica del equipo, desde el primer día', x: 'Si la app aún no ha apuntado días, suma el histórico de valor de cada uno de tus jugadores y te enseña cómo ha ido tu plantilla de hoy.' },
    ],
  },
  {
    v: '0.1.3', f: '2026-10-20', h: '22:07', t: 'Ni un euro de más',
    cosas: [
      { tipo: 'arreglo', d: 'escudo', t: 'Nada de cláusulas disparatadas', x: 'Si el plan te dice que pagues más de un 40 % por encima de lo que vale un jugador (como 21 M por uno que vale 9), la app lo tacha y te dice «No lo hagas» con lo que perderías. Entre un 20 y un 40 % de más, te avisa. Solo lo deja pasar si es un trato que le has contado tú.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'oferta', t: 'A un rival se le compra, no se le puja', x: 'Si el jugador es de otro manager, el paso dice «Comprar» y a quién, con el precio y sin «puja hasta». «Pujar» queda solo para los libres de la liga.' },
      { tipo: 'mejora', d: 'ia', t: 'La IA cuenta lo que pagas de más', x: 'Cada cláusula le llega con cuánto pagarías por encima de su valor, y tiene la regla de no recomendar pagar de más salvo que el jugador lo recupere en pocos días.' },
      { tipo: 'mejora', d: 'lupa', t: 'El interés, con los pies en el suelo', x: 'Un jugador caro respecto a su valor baja mucho de interés y el plan automático no clausula nada que cueste más de un 30 % de lo que vale.' },
    ],
  },
  {
    v: '0.1.2', f: '2026-10-20', h: '21:34', t: 'Libre o con dueño',
    cosas: [
      { tipo: 'arreglo', d: 'oferta', t: 'Libre o con dueño, nunca mezclados', x: 'Un jugador en el mercado puede ser libre de la liga (subasta a ciegas, se lo lleva la puja más alta) o de otro manager que lo ha puesto a la venta (sigue siendo suyo y solo es tuyo si acepta tu oferta). La IA ya los distingue y no te dirá que compres más barato en el mercado lo que vende un amigo.' },
      { tipo: 'mejora', d: 'cara', t: 'Se ve a primera vista', x: 'En Mercado, separados en «Libres de la liga» y «Con dueño», con la pastilla «Libre» o «Lo vende …». En la ficha, quién lo vende, cuánto pide y cuánto es sobre su valor.', ir: { v: 'mercado', seg: 'mercado:venta' } },
    ],
  },
  {
    v: '0.1.1', f: '2026-10-20', h: '21:23', t: 'Tu equipo, al detalle',
    cosas: [
      { tipo: 'nuevo', d: 'grafica', t: 'Toca el marcador', x: 'En Hoy, toca donde salen tu saldo y el valor del equipo: se abre el detalle con la gráfica del valor (7 días, 1 mes o 3 meses) y lo que has ganado o perdido hoy y en la semana.', ir: { v: 'hoy' } },
      { tipo: 'nuevo', d: 'especular', t: 'Quién sube y quién baja', x: 'Tus jugadores que suben y los que bajan hoy, de más a menos, con lo que mueve cada uno, su porcentaje y su curva. Arriba, el que más sube y el que más baja.' },
      { tipo: 'nuevo', d: 'dinero', t: 'Tu dinero de un vistazo', x: 'Saldo, lo que puedes gastar con el 20 % de deuda, lo que tienes en pujas y en venta, y lo ganado sobre lo que pagaste.' },
      { tipo: 'nuevo', d: 'campo', t: 'Por puestos y en tu liga', x: 'Cuánto vale y cuánto se mueve cada línea (porteros, defensas, medios y delanteros), y el valor de cada equipo de la liga con lo que ha cambiado hoy y en 7 días.' },
    ],
  },
  {
    v: '0.1.0', f: '2026-10-20', h: '21:05', t: 'Háblale y te hace caso',
    cosas: [
      { tipo: 'nuevo', d: 'voz', t: 'Pregúntale hablando', x: 'Toca el micro en Pregunta, o «Cuéntale algo» en el plan de hoy. Usa el dictado de Google y la IA te contesta al momento.', ir: { v: 'ia' } },
      { tipo: 'nuevo', d: 'nota', t: 'Lo que le cuentas, cuenta', x: 'Si un amigo te ofrece un jugador, piensas vender a alguien o no quieres soltar a otro, díselo. Lo apunta y lo tiene en cuenta en el plan, en el chat y cuando trabaja con la app cerrada.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'lupa', t: 'Te dice si te compensa', x: 'Cuando nombras a un jugador, la IA recibe todos sus datos: lo que vale, lo que ha subido en 7 y 30 días, de quién es, su cláusula, si es titular y sus próximos rivales. Te contesta con cifras y te dice qué vender para que te llegue.' },
      { tipo: 'mejora', d: 'plan', t: 'Lo apuntado, a la vista', x: 'Arriba en Pregunta y en la ficha de cada jugador. Bórralo cuando ya no valga. Cuando apuntas algo nuevo, el plan se rehace.' },
      { tipo: 'nuevo', d: 'scroll', t: 'Novedades que se cuentan bajando', x: 'Como estas: cada versión nueva se presenta así. La lista entera está en Ajustes → Novedades.' },
      { tipo: 'mejora', d: 'versiones', t: 'Versiones sin prisa', x: 'La numeración empieza de nuevo: esta es la 0.1 y las de antes son de la 0.0.1 a la 0.0.11.' },
    ],
  },
  {
    v: '0.0.11', f: '2026-10-20', h: '20:41', t: 'La IA trabaja sola',
    cosas: [
      { tipo: 'nuevo', d: 'noche', t: 'Trabaja con la app cerrada', x: 'Cada 3 horas, y unos minutos después de cada cambio de mercado, pone tu liga al día y rehace el plan con Gemini.' },
      { tipo: 'nuevo', d: 'campana', t: 'Notificaciones de lo importante', x: 'El plan nuevo con sus pasos, las ofertas por tus jugadores, si te clausulan a alguien y lo que fichas. Cada aviso llega una vez y nunca de madrugada.' },
      { tipo: 'mejora', d: 'ajustes', t: 'Tú decides', x: 'Se apaga en Ajustes → «Trabaja con la app cerrada». Ahí ves también cuándo trabajó por última vez.' },
    ],
  },
  {
    v: '0.0.10', f: '2026-10-20', h: '20:31', t: 'El precio, en gráfica',
    cosas: [
      { tipo: 'nuevo', d: 'grafica', t: 'El valor de cada jugador', x: 'En su ficha: 7 días, 1 mes o 3 meses, con lo que ha subido o bajado y su máximo y mínimo. Si no es tuyo, se pide su histórico a LaLiga al abrirla.' },
      { tipo: 'arreglo', d: 'arreglo', t: 'Medias con un decimal', x: 'Se acabó el «5,555555555555555 de media».' },
    ],
  },
  {
    v: '0.0.9', f: '2026-10-20', h: '20:29', t: 'El once del Fantasy y el rival',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'Tu once, como en el Fantasy', x: 'Césped, cromos con la cara y el nombre, los puntos esperados, el valor o la forma, y el banquillo debajo.', ir: { v: 'equipo', seg: 'equipo:plantilla' } },
      { tipo: 'nuevo', d: 'semaforo', t: 'No es lo mismo el Barça que el colista', x: 'Cada jugador lleva su próximo rival en verde, ámbar o rojo según la clasificación de LaLiga, y la ficha enseña sus tres próximos partidos. Los puntos esperados y la IA lo tienen en cuenta.' },
      { tipo: 'arreglo', d: 'conexion', t: 'La IA ya no se corta a medias', x: 'Mientras prepara el plan, la app no pierde internet aunque salgas de ella, mantiene viva la conexión con Google y, si se corta, vuelve a probar sola. Te avisa al terminar.' },
    ],
  },
  {
    v: '0.0.8', f: '2026-10-20', h: '20:09', t: 'Gemini encuentra el camino',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: '«Unable to resolve host», resuelto', x: 'Si el DNS del móvil o del wifi no encuentra el servidor de Gemini, la app se lo pregunta por https a Cloudflare o a Google.' },
    ],
  },
  {
    v: '0.0.7', f: '2026-10-20', h: '20:05', t: 'Deuda fija y modelos explicados',
    cosas: [
      { tipo: 'mejora', d: 'dinero', t: 'La deuda, siempre al 20 %', x: 'Como en el juego: ya no hay que elegirla en Ajustes.' },
      { tipo: 'mejora', d: 'ia', t: 'Los modelos de tu clave, explicados', x: 'Ajustes te dice a cuántas versiones de Gemini te da acceso tu clave y cuántas han gastado ya el cupo de hoy.' },
    ],
  },
  {
    v: '0.0.6', f: '2026-10-20', h: '20:00', t: 'Onces, prensa e histórico',
    cosas: [
      { tipo: 'nuevo', d: 'camiseta', t: 'Onces probables', x: 'De futbolfantasy: cada jugador dice si sale de titular, suplente o fuera, y cuenta para tu once y para la IA.' },
      { tipo: 'nuevo', d: 'periodico', t: 'Titulares de prensa', x: 'De tus jugadores, de los candidatos y de las webs de fantasy, de los últimos días.' },
      { tipo: 'nuevo', d: 'grafica', t: 'Histórico de valor de LaLiga', x: 'Para tus jugadores y los candidatos, sin esperar a que la app vaya apuntando días.' },
      { tipo: 'mejora', d: 'dinero', t: 'Especular con colchón', x: 'Aunque lo comprado baje un 8 %, al venderlo vuelves a positivo.' },
    ],
  },
  {
    v: '0.0.5', f: '2026-10-20', h: '19:50', t: 'Para el once o para revender',
    cosas: [
      { tipo: 'nuevo', d: 'camiseta', t: 'Dos tipos de fichaje', x: 'Para tu once o para revender: cada paso del plan dice cuál es.' },
      { tipo: 'nuevo', d: 'especular', t: 'Especular entre semana', x: 'Comprar lo que sube aunque no te haga falta, bajando hasta el límite de deuda, y venderlo el día antes de la jornada.', ir: { v: 'mercado', seg: 'mercado:especular' } },
      { tipo: 'mejora', d: 'nota', t: 'Lo que compras para revender, apuntado', x: 'El plan te dice cuándo venderlo. También lo puedes marcar tú desde la ficha.' },
    ],
  },
  {
    v: '0.0.4', f: '2026-10-20', h: '19:43', t: 'La IA arranca',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'La IA ya contesta', x: 'Las preguntas a Gemini salen por la parte nativa de la app. Antes el navegador de dentro las cortaba con «Failed to fetch».' },
      { tipo: 'nuevo', d: 'campo', t: 'Posiciones y formaciones gratis', x: 'El plan solo te ficha jugadores que entren en tu once, tapa antes los huecos y usa las formaciones de la versión gratuita.' },
      { tipo: 'arreglo', d: 'cara', t: 'Quién hace cada movimiento', x: 'En los movimientos de la liga sale el nombre de cada manager.' },
    ],
  },
  {
    v: '0.0.3', f: '2026-10-20', h: '19:32', t: 'Tus ventas y sus ofertas',
    cosas: [
      { tipo: 'nuevo', d: 'oferta', t: 'Ofertas por tus jugadores en venta', x: 'La de LaLiga y las de otros managers, cuánto sacas sobre su valor y si te conviene aceptar o esperar.', ir: { v: 'equipo', seg: 'equipo:venta' } },
      { tipo: 'arreglo', d: 'cara', t: 'Caras encuadradas', x: 'La app mira cada foto y centra la cabeza en el círculo.' },
    ],
  },
  {
    v: '0.0.2', f: '2026-10-20', h: '19:19', t: 'El plan del día',
    cosas: [
      { tipo: 'nuevo', d: 'plan', t: 'El plan de hoy, paso a paso', x: 'Qué vender, a quién clausular y cuánto pujar, con tu saldo después de cada operación.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'ia', t: 'Todos los modelos gratis', x: 'Si un modelo de Gemini gasta su cupo, pasa al siguiente en vez de pararse.' },
      { tipo: 'arreglo', d: 'cara', t: 'Caras y nombres', x: 'Las caras se ven con el escudo de su equipo y en los movimientos sale quién hace cada cosa.' },
    ],
  },
  {
    v: '0.0.1', f: '2026-10-20', h: '18:14', t: 'Primera versión',
    cosas: [
      { tipo: 'nuevo', d: 'escudo', t: 'Tu liga en el móvil', x: 'Entras con tu cuenta de LaLiga y ves tu equipo, las cláusulas de los rivales, el mercado y los movimientos.' },
    ],
  },
];

/** compara dos versiones (0.0.10 va después de la 0.0.9) */
/** 0.3.3 < 0.3.3a < 0.3.3b < 0.3.4 (la letra es un parche de la versión que lleva delante) */
const partesVer = (v) => {
  const m = String(v || '0').trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?([a-z]?)/i) || [];
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0), (m[4] || '').toLowerCase()];
};
export function cmpVer(a, b) {
  const x = partesVer(a), y = partesVer(b);
  for (let i = 0; i < 3; i++) { const d = x[i] - y[i]; if (d) return d; }
  return x[3] === y[3] ? 0 : x[3] < y[3] ? -1 : 1;
}

// la numeración de antes (hasta la 0.9.0) en la de ahora, para saber qué versión habías visto
const VIEJAS = { '0.1.0': '0.0.1', '0.2.0': '0.0.2', '0.3.0': '0.0.3', '0.4.0': '0.0.4', '0.5.0': '0.0.5', '0.6.0': '0.0.6', '0.6.1': '0.0.7', '0.6.2': '0.0.8', '0.7.0': '0.0.9', '0.7.1': '0.0.10', '0.8.0': '0.0.11', '0.9.0': '0.0.11' };
export const deNumeracionVieja = (v) => VIEJAS[v] || null;
