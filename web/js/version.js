// La versión de la app. La Action de Android la lee de aquí para nombrar el APK.
// Numeración: la 0.1.0 es la primera completa (las anteriores pasaron a ser la 0.0.1 a la 0.0.11). A partir de
// aquí, cada versión sube el último número (0.1.1, 0.1.2…) y el del medio solo con un cambio grande.
// Los parches (correcciones y cosas pequeñas) no suben el número: llevan una letra detrás de la versión a la que
// arreglan (0.3.3a, 0.3.3b, 0.3.3c…).
export const VERSION = '0.6.10';

// Lo nuevo de cada versión, de la más nueva a la más vieja. Al abrir una versión nueva se presenta bajando
// (presentacion.js); la lista entera está en Ajustes.
// Cada cosa: tipo (nuevo | mejora | arreglo), d (el dibujo, de dibujos.js), t (título), x (texto) e ir (a dónde
// lleva «Verlo»: { v: pestaña, seg: 'pestaña:sección' }).
// A los que no son el dueño solo les sale lo que les cambia algo (el filtro, en app.js): ni los arreglos, ni lo que lleva
// menor: true (detalles, cosas de dentro), ni lo que es de otra versión: para 'play' (Google Play), 'app' (Android),
// 'web' (iPhone y ordenador) o 'dueño' (solo Carlos).
export const NOVEDADES = [
  {
    v: '0.6.10', f: '2026-10-30', h: '04:58', t: 'Tu equipo, más claro',
    cosas: [
      { tipo: 'mejora', d: 'camiseta', t: 'Tu equipo, más claro', x: 'Arriba, tu cara y cuatro números: el valor (con lo que ha cambiado en la semana), tu puesto, tu saldo y la plantilla. Las pestañas caben todas sin moverlas. En Plantilla, unas casillas con cuántos pueden jugar, cuántos suben y bajan hoy y tus cláusulas abiertas, y «Pide atención»: cada lesionado, suplente o cláusula en riesgo con su botón para buscarle sustituto o verla. Y la plantilla se puede ordenar por puesto, valor, lo que sube hoy o puntos.', ir: { v: 'equipo' } },
      { tipo: 'mejora', d: 'escudo', t: 'Tus cláusulas, de un vistazo', x: 'En Equipo → Cláusulas, arriba cuántas están abiertas, cuántas se abren en 48 horas, cuántas están protegidas y los blindajes que te quedan. Cada jugador lleva una barra con lo que está su cláusula por encima de su valor: pasada la raya (un 30 %), sin riesgo. La explicación va plegada en «Cómo funcionan».', ir: { v: 'equipo', seg: 'equipo:clausulas' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Las etiquetas de cada jugador', x: 'La etiqueta roja del plan («Vender hoy», «Proteger hoy») salía más abajo que las demás de la misma fila.' },
    ],
  },
  {
    v: '0.6.9a', f: '2026-10-30', h: '04:30', t: 'Fotos de rivales y Europa',
    cosas: [
      { tipo: 'mejora', d: 'cara', t: 'Las fotos de tus rivales', x: 'LaLiga solo le da a cada uno su propia foto. Ahora, la de cada rival que usa Fantasy Manager y tiene foto en LaLiga Fantasy sale en Rivales, en su ficha, en Directo y en el plan; los demás llevan sus iniciales. Tu foto también la ven los de tu liga que usan la app.', ir: { v: 'rivales' } },
      { tipo: 'mejora', d: 'camiseta', t: 'Clubes: quién juega en Europa', x: 'En la clasificación de Clubes, el color de cada fila ya no es el del club: dice qué competición europea juega esta temporada (azul Champions, naranja Europa League, verde Conference) y el rojo, el descenso. Esos equipos juegan también entre semana y rotan más. En la ficha de cada club sale al lado de su puesto.', ir: { v: 'clubes' } },
    ],
  },
  {
    v: '0.6.9', f: '2026-10-30', h: '03:57', t: 'Hoy, al grano',
    cosas: [
      { tipo: 'mejora', d: 'plan', t: 'Hoy, al grano', x: 'Cada paso del plan va en una fila: qué hacer, con quién, el dinero, cuándo y por qué en dos líneas. Al tocarlo se abre el resto (los datos, lo que pagaste, los avisos, la confianza y «Hecho»). Arriba dice cuántos te quedan, ya no hay que abrir «Ver los otros pasos», el botón de pedir otro plan va pequeño en la cabecera y «Lo que llevas hoy» va plegado debajo de las cuentas. En el ordenador, los próximos días van a la derecha.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'cara', t: 'Cada rival, con su cara', x: 'En Rivales, en su ficha, en la clasificación de la jornada y en el plan, cada mánager lleva un círculo con sus iniciales en un color suyo, siempre el mismo: se distinguen de un vistazo.', ir: { v: 'rivales' } },
    ],
  },
  {
    v: '0.6.8b', f: '2026-10-30', h: '02:07', t: 'Clubes con sus colores',
    cosas: [
      { tipo: 'mejora', d: 'camiseta', t: 'Clubes, con sus colores de verdad', x: 'Arriba, «Tus clubes»: los equipos en los que tienes jugadores, con su camiseta, tus caras y su próximo partido. Debajo, la clasificación con el puesto marcado según la zona (Champions, Europa, Conference o descenso) y los colores de cada club al lado. En el ordenador, también la racha, los ganados, empatados y perdidos y los goles. Y cada club lleva sus colores de verdad: el Madrid, blanco y morado.', ir: { v: 'clubes' } },
      { tipo: 'mejora', d: 'plan', t: 'Hoy, sin lo que venden tus rivales', x: 'El plan ya no te propone comprar lo que tus rivales tienen a la venta: casi siempre lo ponen solo para ver la oferta de LaLiga y no lo quieren vender. Lo tienes en Mercado → Fichar, en «En venta de tus rivales».' },
    ],
  },
  {
    v: '0.6.8a', f: '2026-10-29', h: '20:26', t: 'Anuncios de prueba para ti',
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'oferta', t: 'Tú también ves los anuncios de la web', x: 'En la web te salen los mismos anuncios que a los demás, pero de prueba («Publicidad · prueba»): no cuentan para AdSense, así que puedes ver cómo quedan y si algo se descoloca sin riesgo. Se quitan poniendo «anunciosWebDueno» a false en limites.json. Aun así, no los toques.' },
    ],
  },
  {
    v: '0.6.8', f: '2026-10-29', h: '20:11', t: 'Anuncios en la web',
    cosas: [
      { para: 'web', tipo: 'nuevo', d: 'oferta', t: 'La web lleva anuncios', x: 'Para que la app siga siendo gratis, la web lleva un anuncio pequeño encima de las pestañas en el móvil (en el ordenador, a la derecha si cabe). Nunca en Pregunta. En la UE, la primera vez te pregunta si pueden usar tus datos para personalizarse, y lo puedes cambiar en Ajustes → Privacidad de los anuncios.' },
    ],
  },
  {
    v: '0.6.7a', f: '2026-10-29', h: '20:11', t: 'Aviso del once y fichajes recientes',
    cosas: [
      { para: 'app', tipo: 'mejora', d: 'campana', t: 'Te avisa si uno de tu once no es titular', x: 'Con la app cerrada, unos 50 y 20 minutos antes de cada partido en que juega alguno de tu alineación, la app mira el once confirmado. Si uno de los tuyos sale de suplente o no va convocado, te llega una notificación para que lo cambies antes de que empiece su partido, y con quién de tu plantilla meter.' },
      { para: 'web', tipo: 'arreglo', d: 'scroll', t: 'La barra de abajo, en su sitio en el iPhone', x: 'En el iPhone, Safari a veces dejaba la barra de las pestañas a media pantalla al bajar por la página, sobre todo después de escribir algo (es un fallo de Safari desde iOS 26). Ahora la app lo nota y la vuelve a poner abajo.' },
      { tipo: 'arreglo', d: 'cara', t: 'Otra cuenta en el mismo móvil no ve lo de la anterior', x: 'Si en el mismo móvil o navegador entra otra cuenta de LaLiga, se borra lo de la anterior (su liga, su histórico, sus planes, su chat y sus notas) antes de enseñar nada. Se quedan los ajustes y la clave de Gemini. Y «Borrar datos» borra ya también lo de las otras ligas.' },
      { tipo: 'arreglo', d: 'oferta', t: 'Los fichajes de hace un rato cuentan ya', x: 'LaLiga tarda en poner en la plantilla un fichaje o un clausulazo recién hecho. Ahora, si los movimientos de la liga dicen que un jugador ya es de otro (o tuyo), la app no te propone clausularlo ni lo pone en la lista del que lo tenía.' },
      { menor: true, tipo: 'arreglo', d: 'arreglo', t: 'Sin sitio para guardar, la app hace hueco', x: 'Si se llena lo que el navegador deja guardar (unos 5 MB), la app borra lo que vuelve a pedir sola (noticias, onces, muestras) y, si no basta, acorta el histórico de valores, en vez de dejar de guardar tu liga sin decir nada.' },
      { para: 'dueño', menor: true, tipo: 'arreglo', d: 'conexion', t: 'El servidor ya no hace de proxy para cualquiera', x: 'Lo que la web pide a LaLiga y a las demás webs por el servidor (y las imágenes) solo pasa si viene de la web de Fantasy Manager, y ya no sigue redirecciones a sitios que no están en la lista.' },
      { para: 'dueño', menor: true, tipo: 'arreglo', d: 'conexion', t: 'El código para entrar desde el ordenador, más seguro', x: 'Si se acaban las escrituras gratis del servidor, el código para entrar desde el ordenador o el iPhone sigue funcionando, y «Quién usa la app» escribe como mucho una vez por hora por cuenta.' },
    ],
  },
  {
    v: '0.6.7', f: '2026-10-29', h: '17:50', t: 'Clausulazos con salida y sustitutos',
    cosas: [
      { tipo: 'nuevo', d: 'lupa', t: 'Buscar sustituto y quitar lo urgente', x: 'En Hoy, cada cosa de «Ahora mismo» lleva una X para quitarla hasta mañana. Si es uno tuyo que hay que vender o que no puede jugar, también «Buscar sustituto»: los de su puesto que ya tienes, los del mercado y las cláusulas que te llegan, de más a menos puntos esperados.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'semaforo', t: 'Clausulazos que se pueden deshacer', x: 'Antes de proponerte un clausulazo, la app mira su salida: si el jugador se tuerce y empieza a bajar, ¿lo podrías vender a LaLiga sin perder dinero? Si no, solo te lo propone si es titular seguro y se espera un buen partido. En el plan, en los avisos y en lo que lee la IA, con lo que perderías.' },
      { tipo: 'mejora', d: 'oferta', t: 'La puja, con lo que se paga en tu liga', x: 'Si la IA propone pujar menos de lo que la app sabe que se suele pagar en tu liga por un libre, el plan la sube a la puja de la app (sin pasar de lo que te llega) y te dice por qué: con menos, lo normal es perderlo.' },
      { tipo: 'arreglo', d: 'campo', t: 'El once confirmado no salía en algunos equipos', x: 'Con el once confirmado, la página trae también el probable de antes y la app leía 12 o 13 titulares y lo daba por malo. Ahora se queda con los 11 que van al 100 %, no cuenta al entrenador y no confunde a dos jugadores por el nombre de pila. Si sale con la ficha de un partido abierta, se ve al momento, y al empezar el partido el once sigue en el campo hasta que llegan los puntos.' },
      { tipo: 'arreglo', d: 'ia', t: 'La IA no se queda escribiendo ni mezcla respuestas', x: 'En la web, una respuesta que se quedaba a medias ya no se queda «escribiendo» para siempre ni se da por buena. Cuando contesta antes el modelo de relevo, el otro se corta y ya no se cuela en la pregunta siguiente. El plan entero no pasa de 5 minutos, el chat sin búsqueda ya no intenta buscar y un corte de conexión ya no se toma por un modelo lento.' },
      { tipo: 'arreglo', d: 'plan', t: 'Las cuentas del plan, más justas', x: 'El plan reconoce al jugador por la operación y no por un nombre parecido, y lo que pagas en cláusulas también baja lo que te queda para pujar.' },
    ],
  },
  {
    v: '0.6.6e', f: '2026-10-26', h: '12:33', t: 'El plan sale aunque salgas de la app',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'El plan de la IA ya no se queda esperando fuera de la app', x: 'Con la app en segundo plano, el móvil retrasaba los relojes de la app y el plan se quedaba minutos esperando a un modelo de Google que no contestaba (hoy, 4 minutos con el 3.8). Ahora los relojes de la IA siguen andando fuera de la app, y si un modelo tarda más de 45 segundos se pregunta a la vez al siguiente y vale la primera respuesta. Los modelos saturados se recuerdan aunque la app se actualice.' },
    ],
  },
  {
    v: '0.6.6d', f: '2026-10-26', h: '12:14', t: 'El plan de la IA sale aunque Google falle',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'El plan de la IA no se atasca con los modelos que fallan', x: 'Hoy los modelos nuevos de Google (3.8 y 3.7) estaban saturados y el siguiente contestaba vacío a los 100 segundos porque la búsqueda en Google le hacía una llamada rota. Ahora, sin búsqueda, ya no le manda buscar; si la búsqueda le hace fallar, lo repite sin ella y se acuerda una hora; un modelo saturado se salta 5 minutos; y el último que contestó bien va el primero durante 3 horas, sin volver a esperar por los demás.' },
    ],
  },
  {
    v: '0.6.6c', f: '2026-10-26', h: '11:59', t: 'La IA ya no se queda esperando',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'El plan de la IA no se cuelga minutos', x: 'Si Google no contestaba (un modelo saturado, sobre todo con la búsqueda en Google), la app esperaba hasta 5 minutos y repetía con el mismo modelo. Ahora cada intento espera como mucho 110 segundos (90 sin búsqueda): el modelo que no contesta se salta un rato y los siguientes van sin búsqueda. Si en unos 4 minutos no hay respuesta, te lo dice en vez de quedarse pensando.' },
    ],
  },
  {
    v: '0.6.6b', f: '2026-10-25', h: '22:46', t: 'Sin nombres de otras webs',
    cosas: [
      { tipo: 'arreglo', d: 'lupa', t: 'Otras webs de fantasy ya no salen como fuente', x: 'Las noticias, las fuentes del plan y las respuestas de la IA ya no nombran a otras webs de fantasy. Si una noticia viene de una de ellas, sale solo con su hora, y la IA habla de «la prensa» o «los onces probables».' },
    ],
  },
  {
    v: '0.6.6a', f: '2026-10-25', h: '21:26', t: 'El once confirmado de cada equipo',
    cosas: [
      { tipo: 'arreglo', d: 'campo', t: 'El once confirmado no salía de un equipo', x: 'Esta noche, antes del Clásico, el once confirmado del Barça salía y el del Madrid no, aunque ya estaba publicado desde las 19:41. La app daba por bueno un once solo si le casaban los 11 nombres con los de LaLiga y a un equipo le bastaba un nombre raro para quedarse sin él. Ahora casa los nombres uno a uno con más margen, vale con 10 si uno no se parece a ninguno, mira todas las veces que la página dice «confirmada» (no solo la primera) y pide los datos sin quedarse con una copia vieja.' },
      { para: 'dueño', menor: true, tipo: 'arreglo', d: 'lupa', t: 'El diagnóstico de los onces confirmados', x: 'Si un once confirmado no se lee, el diagnóstico dice por qué (cuántos titulares ha casado, cuál no y si la «confirmada» es de otro partido) y deja una muestra.' },
    ],
  },
  {
    v: '0.6.6', f: '2026-10-25', h: '20:32', t: 'Los onces antes del partido',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'Los onces de cada partido, antes de que empiece', x: 'Toca un partido que aún no ha empezado y salen los dos onces en el campo: el probable, con el % de cada uno, y, en cuanto sale el oficial (una hora antes), los 11 que van a jugar con «Titular». En la lista de Directo, el partido lleva «Onces confirmados» cuando ya están los dos. El oficial ahora sale también en la web y en los móviles donde antes no llegaba. Con la app abierta se mira cada 3 minutos, y «Tu equipo hoy» te avisa de los tuyos que se quedan fuera.', ir: { v: 'directo' } },
      { para: 'dueño', menor: true, tipo: 'mejora', d: 'lupa', t: 'El diagnóstico con lo que da LaLiga en directo', x: 'El diagnóstico lleva ahora una muestra de lo que devuelve LaLiga con la jornada en juego (la lista de cada partido y la ficha de un jugador, con sus minutos si los trae), para saber de verdad qué datos hay en directo en vez de suponerlo.' },
    ],
  },
  {
    v: '0.6.5a', f: '2026-10-25', h: '20:01', t: 'El once de cada partido en directo',
    cosas: [
      { tipo: 'arreglo', d: 'campo', t: 'El once de un partido en directo', x: 'En la ficha de un partido empezado, el campo podía salir con solo 5 o 7 jugadores en vez de los 11: LaLiga solo da los minutos de cada jugador cuando ya ha puntuado, y se dibujaba a los que ya se conocían. Ahora se piden también los minutos del once probable de cada equipo y, si aún faltan, el campo se completa hasta 11 con ese once probable (la nota de debajo dice cuántos son seguros).' },
    ],
  },
  {
    v: '0.6.5', f: '2026-10-25', h: '16:11', t: 'Radar de subidas y cómo juega cada rival',
    cosas: [
      { para: 'play', tipo: 'nuevo', d: 'grafica', t: 'Radar de subidas', x: 'Arriba de Mercado → Fichar: los 10 jugadores de toda LaLiga que más van a subir los próximos 3 días si siguen al ritmo de ahora, con cuánto, de quién es cada uno y si lo puedes fichar hoy (en el mercado o con la cláusula abierta). Debajo, los que acaban de hacer un partidazo, que suelen subir los días siguientes. Se abre junto con «Cuándo gira un jugador».', ir: { v: 'mercado', seg: 'mercado:venta' } },
      { para: 'play', tipo: 'nuevo', d: 'cara', t: 'Cómo juega cada rival', x: 'En la ficha de cada rival (tócalo en Rivales), con todo lo que ha hecho en la liga: cuántos clausulazos ha hecho, a quién y cuánto pagó sobre el valor, cuántos días tiene a un jugador antes de venderlo, qué puestos ficha, si se protege con escudos o subiendo cláusulas y a qué hora suele moverse. Con dos anuncios, 1 hora y 2 veces por jornada, como las otras de los rivales.', ir: { v: 'rivales' } },
      { tipo: 'mejora', d: 'plan', t: 'Lo que dice el plan, entero', x: 'Lo que la IA dice de cada rival y de cada jugador en el plan (Tus rivales, Vigila, Noticias y los descartados) ya no se corta a las dos líneas. Y al tocar a ese rival o a ese jugador, su ficha lo enseña arriba en pequeño, para no perderlo de vista.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'ia', t: 'La IA sabe quién clausula', x: 'Para decirte quién puede ir a por tus jugadores, la IA mira cómo juega cada rival: el que clausula a menudo y le llega es el peligro de verdad; el que no ha clausulado nunca, mucho menos. Y si alguien suele moverse a una hora, te avisa antes.' },
      { para: 'dueño', menor: true, tipo: 'arreglo', d: 'lupa', t: 'La liga de ejemplo', x: 'En la liga de ejemplo, un rival podía salir clausulándose a sí mismo.' },
    ],
  },
  {
    v: '0.6.4a', f: '2026-10-25', h: '15:44', t: 'La oferta de LaLiga, como lo que es: una estimación',
    cosas: [
      { tipo: 'arreglo', d: 'dinero', t: 'La oferta de LaLiga a un rival es una estimación', x: 'La IA podía decir «LaLiga le va a ofrecer hoy X» por un jugador que un rival tiene a la venta. Esa oferta solo la ve el vendedor: lo que da la app es lo que suele pagar LaLiga en tu liga (la mediana de lo que se le ha vendido), y un día puede ser menos o más. Ahora la ficha, el Mercado y la IA lo dicen así («suele rondar X, normalmente entre X e Y») y la IA ya no promete que vaya a aceptar.' },
    ],
  },
  {
    v: '0.6.4', f: '2026-10-25', h: '15:19', t: 'Favoritos, eventos en directo y una IA con las cuentas hechas',
    cosas: [
      { tipo: 'nuevo', d: 'cara', t: 'Favoritos', x: 'Toca la estrella «Seguir» en la ficha de cualquier jugador y lo tendrás en Mercado → Favoritos: arriba los que puedes fichar hoy (libres, a la venta o con la cláusula abierta) y debajo el resto, con de quién es cada uno y su cláusula. En todas las listas llevan una estrellita, y la IA sabe a quién sigues.', ir: { v: 'mercado', seg: 'mercado:favoritos' } },
      { tipo: 'nuevo', d: 'directo', t: 'Los eventos de cada partido', x: 'En Directo, toca un partido empezado: arriba salen los goles, asistencias, penaltis y tarjetas de cada jugador con los puntos que le dan o le quitan y de quién es en tu liga. Y en el campo, los once que de verdad salieron de titular (los que más minutos llevan) y debajo los que han entrado.', ir: { v: 'directo' } },
      { tipo: 'nuevo', d: 'campana', t: 'Aviso al momento si marca uno que te interesa', x: 'Con la jornada en juego y la app abierta, si un jugador de un rival que te conviene clausular (cláusula abierta, te llega y no pagas de más) marca o da una asistencia, te avisa al momento con su cláusula y lo que te quedaría: tras un partido así suele subir de valor.', ir: { v: 'rivales', seg: 'rivales:clausulas' } },
      { tipo: 'mejora', d: 'ia', t: 'Pregunta, arriba y en rojo', x: 'La IA ya no va en la barra de abajo: es el botón rojo de arriba, siempre a mano, y abajo quedan seis pestañas. «Reportar un fallo» es ahora lo primero de Ajustes.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'plan', t: 'Un plan de la IA con las cuentas hechas', x: 'La IA recibe la caja de verdad (también lo que tendrías aceptando las ofertas que ya tienes), sabe qué jugadores son imprescindibles para alinear y cuánto pierde tu once si vendes a cada uno, y con la jornada en juego, quién ha jugado ya. La app comprueba su alineación y te avisa si las ventas te dejan el once cojo. Y busca en Google solo lo que puede cambiar una decisión, así que el plan llega antes.' },
      { tipo: 'mejora', d: 'versiones', t: 'Las notas de cada actualización', x: 'Al final de las novedades, como en un videojuego, todas las correcciones numeradas. También en Ajustes → Novedades, versión a versión.' },
      { tipo: 'arreglo', d: 'campo', t: 'El próximo partido, sin aplazados', x: 'Un partido aplazado de una jornada pasada ya no sale como el próximo partido de su equipo (ni cambia el rival, la previa ni el calendario de sus jugadores).' },
      { tipo: 'arreglo', d: 'dinero', t: 'Tus pujas hechas cuentan en el plan', x: 'El plan da por gastado lo que ya tienes pujado para saber si empiezas la jornada en positivo, y una cláusula que te llega aceptando una oferta que ya tienes ya no sale como imposible.' },
      { tipo: 'arreglo', d: 'dinero', t: '«Te llega» con tu propia puja', x: 'En el Mercado, un jugador por el que ya has pujado podía salir como que no te llega, porque tu puja se descontaba dos veces. Y el plan ya no te propone pujar por uno que ya tiene tu puja.' },
      { tipo: 'arreglo', d: 'grafica', t: 'La inercia, sin exagerar', x: 'Una bajada pequeña ya no se proyecta como una caída enorme hasta la jornada, y dos subidas pequeñas ya no cuentan como «se ha estancado tras subir». Y el plan automático no vende a uno sin el que no puedes alinear si la jornada está cerca.' },
      { tipo: 'arreglo', d: 'escudo', t: 'Blindajes solo si hay riesgo', x: 'Ya no sale «súbela a…» para jugadores que nadie va a clausular, y el riesgo y el blindaje usan el mismo tope de lo que se paga en tu liga por una cláusula.' },
      { tipo: 'arreglo', d: 'noche', t: 'El cambio de hora', x: '«Ayer», «mañana» y lo que ha cambiado un jugador en un día ya no se descuadran el día del cambio de hora, y el aviso diario llega a su hora (este domingo llegaba una hora antes).' },
      { tipo: 'arreglo', d: 'directo', t: 'Puntos en directo con nombres repetidos', x: 'Un jugador ya no se lleva los puntos de otro que se llama igual en otro equipo.' },
      { tipo: 'arreglo', d: 'campo', t: 'El puesto en Jornadas', x: 'Si una vez fallaba la lectura de los puntos de una jornada acabada, se quedaba sin puesto para siempre. Ahora se vuelve a pedir.' },
      { para: 'dueño', menor: true, tipo: 'arreglo', d: 'lupa', t: 'El buscador y las funciones cerradas', x: 'El buscador del Mercado ya no dice que un rival tiene a uno a la venta si «lo que venden los rivales» está cerrado.' },
    ],
  },
  {
    v: '0.6.3g', f: '2026-10-25', h: '13:13', t: 'Cláusulas y fichajes con el último partido',
    cosas: [
      { tipo: 'mejora', d: 'grafica', t: 'Cláusulas y fichajes con el último partido', x: 'Si el jugador de un rival venía bajando pero acaba de hacer un buen partido, las cláusulas que te propone la app y el Mercado ya no lo dan por perdido: con 8 o 9 puntos la bajada puede frenarse y con 10 o más lo normal es que suba estos días, así que lo ves más arriba y con el motivo («acaba de hacer 12 pts»). Lo mismo con los tuyos en venta: tras un partidazo, la app te dice que esperes al cambio de mañana.', ir: { v: 'rivales', seg: 'rivales:clausulas' } },
      { para: 'web', tipo: 'arreglo', d: 'periodico', t: 'Las noticias en la web', x: 'En la web, Google Noticias no contesta y la app lo intentaba con 14 búsquedas cada vez. Ahora, si no contesta, lo deja estar media hora, usa los titulares de la última vez si los hay y la IA sabe que no ha podido mirarlos (antes creía que no había noticias de nadie).' },
    ],
  },
  {
    v: '0.6.3f', f: '2026-10-25', h: '11:16', t: 'Siempre en la última versión',
    cosas: [
      { para: 'web', tipo: 'mejora', d: 'versiones', t: 'Siempre en la última versión', x: 'En la web (iPhone y ordenador), cuando sale una versión nueva aparece una ventana en mitad de la pantalla con «Actualizar ahora»: un toque y la tienes. Así nadie se queda con una versión vieja.' },
    ],
  },
  {
    v: '0.6.3e', f: '2026-10-25', h: '02:12', t: 'La liga de ejemplo, al día',
    cosas: [
      { tipo: 'arreglo', d: 'campo', t: 'La liga de ejemplo, al día', x: 'En la liga de ejemplo, los partidos de la jornada en juego que ya se han jugado salen con su resultado, y Clubes, Directo y la ficha de cada club cuentan lo mismo.' },
      { menor: true, tipo: 'arreglo', d: 'escudo', t: 'Detalles del escudo y del plan', x: 'El escudo dice las horas que da tu liga (48 en las Premium), la IA ya no llama «plan de hoy» a uno de otro día, y lo que puedes gastar sale con la misma cifra en Hoy y en Mercado.' },
    ],
  },
  {
    v: '0.6.3d', f: '2026-10-25', h: '02:07', t: 'Un plan de la IA que se puede hacer',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'El plan no se pasa de lo que puedes gastar', x: 'Si la IA proponía pujas por más de lo que puedes gastar (tu saldo más el margen de deuda, menos lo que ya tienes pujado) o una cláusula que no te llega con tu saldo, salía con un aviso. Ahora la app las descarta y no las cuenta en el saldo final.' },
      { tipo: 'arreglo', d: 'escudo', t: 'Los blindajes, con cuentas que cuadran', x: 'Una cláusula que ya está por encima de lo que se suele pagar en tu liga ya no sale con «súbela», y el texto ya no dice «no le llega a nadie» cuando sí le llega a alguno. Un escudo para una cláusula que aún no se ha abierto va para cuando se abra.' },
      { tipo: 'arreglo', d: 'campo', t: 'Detalles de Equipo e IA', x: 'En Jornadas ya no sale una formación inventada cuando faltan jugadores; la IA ya no confunde nombres de managers con jugadores ni se contradice con el motor sobre las cláusulas a su valor, y «Le llega a N» de Cláusulas va dentro de «quién puede pagar tu cláusula».' },
    ],
  },
  {
    v: '0.6.3c', f: '2026-10-25', h: '02:48', t: 'Los partidazos, por escalones',
    cosas: [
      { tipo: 'mejora', d: 'grafica', t: 'Los partidazos, por escalones', x: 'Si un jugador viene bajando y acaba de hacer un buen partido, la app lo tiene en cuenta según cuánto: con 6 o 7 puntos te avisa de que puede suavizar la bajada; con 8 o 9 ya no te dice que lo vendas con prisa; con 10 o más no te manda venderlo por la bajada, porque lo normal es que suba los días siguientes.' },
      { tipo: 'arreglo', d: 'campo', t: 'Los partidos aplazados', x: 'Un partido aplazado ya no deja su jornada «en juego» durante semanas ni la junta con las siguientes.' },
      { para: 'play', tipo: 'arreglo', d: 'escudo', t: 'Lo abierto con anuncios dura lo que tiene que durar', x: 'Si abrías una función de los rivales justo antes de que acabara la jornada, se cerraba al empezar la siguiente. Ahora dura su hora entera, y al pasar la hora se cierra también en la ficha que tengas abierta.' },
    ],
  },
  {
    v: '0.6.3b', f: '2026-10-25', h: '01:46', t: 'Lo que pagaste y los partidazos',
    cosas: [
      { tipo: 'arreglo', d: 'dinero', t: 'Lo que pagaste, aunque lo fichases hace tiempo', x: 'Para decirte cuánto ganas o pierdes al vender, la app solo miraba los últimos movimientos de la liga: si lo fichaste hace tiempo no encontraba la compra y decía que venía en tu equipo inicial. Ahora mira todos, desde el principio de la liga, y cuenta desde que lo fichaste hasta que lo vendes.' },
      { tipo: 'arreglo', d: 'grafica', t: 'Un partidazo puede frenar la bajada', x: 'Si un jugador viene bajando pero acaba de hacer 9 puntos o más, la app ya no te dice que lo vendas ya: tras un partido así LaLiga suele subirle el valor los días siguientes. Lo avisa en su ficha, en el plan y la IA lo tiene en cuenta.' },
    ],
  },
  {
    v: '0.6.3a', f: '2026-10-25', h: '01:26', t: 'Las funciones top, con más cabeza',
    cosas: [
      { para: 'play', tipo: 'mejora', d: 'escudo', t: 'Las funciones top, con más cabeza', x: 'El dinero de los rivales, lo que venden y cuánto les da LaLiga, y quién puede pagar tus cláusulas se abren cada una 1 hora con dos anuncios cortos, y como mucho 2 veces por jornada: así son una ventaja de verdad y no algo que tiene todo el mundo siempre. Cuándo gira un jugador sigue con uno, hasta medianoche. En «quién puede pagar tu cláusula» ya no sale el dinero de cada rival, solo si le llega o no.', ir: { v: 'rivales' } },
      { menor: true, tipo: 'mejora', d: 'versiones', t: 'Novedades, solo lo que te afecta', x: 'Al estrenar versión, a cada uno le salen solo las novedades que le cambian algo: sin los arreglos, los detalles ni lo que es de otra versión de la app (la de Google Play, la web). El dueño lo sigue viendo todo, y la lista entera está en Ajustes → Novedades.' },
    ],
  },
  {
    v: '0.6.3', f: '2026-10-25', h: '00:23', t: 'Funciones top con un anuncio',
    cosas: [
      { para: 'dueño', tipo: 'nuevo', d: 'escudo', t: 'Las funciones top, viendo un anuncio', x: 'En la versión de Google Play, las cuatro funciones top (el dinero de cada rival, quién puede pagar tus cláusulas, cuándo gira un jugador y lo que venden los rivales) se abren viendo un anuncio corto: toca cualquier candado y quedan abiertas hasta medianoche. En la versión de la liga, que no lleva anuncios, siguen como estaban.', ir: { v: 'rivales' } },
    ],
  },
  {
    v: '0.6.2e', f: '2026-10-24', h: '23:55', t: 'La web ya no se queda en una versión vieja',
    cosas: [
      { tipo: 'arreglo', d: 'versiones', t: 'La web se queda en una versión vieja', x: 'En el iPhone y en el navegador del móvil la web se podía quedar en una versión de antes aunque hubiera salido otra. Ahora cada archivo va con su huella y el navegador ya no los mezcla. Si aún ves una versión anterior a esta, cierra la web del todo y vuelve a abrirla una vez.' },
      { para: 'web', tipo: 'mejora', d: 'versiones', t: '«Buscar nueva» en la web', x: 'En Ajustes, al lado de la versión, la web también tiene «Buscar nueva»: si la hay, la pone al momento.' },
    ],
  },
  {
    v: '0.6.2d', f: '2026-10-24', h: '23:43', t: 'La web, al día',
    cosas: [
      { para: 'web', tipo: 'mejora', d: 'versiones', t: 'Aviso de versión nueva en la web', x: 'En la web (iPhone y ordenador), cuando sale una versión nueva aparece una banda arriba con «Recargar»: un toque y la tienes, sin esperar a que el navegador suelte la de antes.' },
    ],
  },
  {
    v: '0.6.2c', f: '2026-10-24', h: '23:36', t: 'El once de la jornada, el que puntúa',
    cosas: [
      { tipo: 'arreglo', d: 'campo', t: 'Tu once de la jornada en juego', x: 'Con la jornada en juego salía el once que tienes puesto ahora, y si habías cambiado algo después de que empezara no era el que puntúa. Ahora sale el de la jornada, en Equipo → Jornadas, en «Tu once» y en Directo.', ir: { v: 'equipo', seg: 'equipo:jornadas' } },
    ],
  },
  {
    v: '0.6.2b', f: '2026-10-24', h: '23:28', t: 'Las jornadas, más a mano',
    cosas: [
      { menor: true, tipo: 'mejora', d: 'campo', t: 'Pasar de una jornada a otra', x: 'En Equipo → Jornadas, junto al título salen ‹ y › para ir a la jornada anterior o a la siguiente. Los botones de arriba (J1, J2…) siguen ahí, pero al bajar se quedan tapados por las pestañas.', ir: { v: 'equipo', seg: 'equipo:jornadas' } },
    ],
  },
  {
    v: '0.6.2a', f: '2026-10-24', h: '23:09', t: 'Todas tus jornadas',
    cosas: [
      { tipo: 'arreglo', d: 'campo', t: 'Desde la jornada 1', x: 'En Equipo → Jornadas solo salían la jornada pasada y la que se juega. Ahora salen todas, de la 1 a la de ahora.', ir: { v: 'equipo', seg: 'equipo:jornadas' } },
      { tipo: 'arreglo', d: 'foto', t: 'Las capturas de los avisos, a la vista', x: 'En la bandeja de avisos, las capturas de los que estaban sin contestar se quedaban en «Cargando…». Ya se ven.' },
    ],
  },
  {
    v: '0.6.2', f: '2026-10-24', h: '22:53', t: 'Tus jornadas',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'El once de cada jornada', x: 'En Equipo → Jornadas, como en la app oficial: eliges la jornada (de la 1 a la que se juega, o la próxima) y ves el once que pusiste, con lo que sumó cada uno, tus puntos y en qué puesto quedaste en la jornada. En la que se juega, al minuto; en la próxima, el once que tienes puesto ahora y cuándo juega cada uno.', ir: { v: 'equipo', seg: 'equipo:jornadas' } },
    ],
  },
  {
    v: '0.6.1c', f: '2026-10-24', h: '22:53', t: 'Menos avisos al cargar',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: 'Sin el aviso de las subidas y bajadas', x: 'Si al actualizar no se podían leer las subidas y bajadas del mercado, salía un aviso arriba. Ahora la app usa las que ya había leído ese día y no te dice nada; el aviso solo sale si ese día no las ha podido leer ninguna vez.' },
    ],
  },
  {
    v: '0.6.1b', f: '2026-10-24', h: '22:39', t: 'Tu once de la jornada',
    cosas: [
      { tipo: 'mejora', d: 'foto', t: 'Capturas en los avisos de fallo', x: 'Al avisar de un fallo (arriba, «Fallo») puedes añadir hasta tres capturas de lo que ves. Me ayudan mucho a encontrarlo.' },
      { tipo: 'arreglo', d: 'campo', t: 'Tu once de LaLiga, aunque le falte alguien', x: 'Con la jornada en juego, en Equipo sale el once que tienes puesto en LaLiga con los puntos de cada uno. Si te faltaba alguien en el once, salía el mejor según la app en vez del tuyo. Ahora sale el tuyo, con los huecos vacíos y un aviso: los huecos no puntúan. En Directo, en «Tu once», también avisa.', ir: { v: 'equipo' } },
    ],
  },
  {
    v: '0.6.1a', f: '2026-10-24', h: '22:20', t: 'Clubes, con sus colores',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'Clubes, como una clasificación de verdad', x: 'Solo salen los 20 de esta temporada (antes se colaban equipos de otros años y de Segunda), con partidos jugados, diferencia de goles y puntos, los puestos de Champions, Europa, Conference y descenso, y las caras de tus jugadores en cada club. La ficha de cada club lleva sus colores, su próximo partido con los dos escudos y los que más puntúan con su foto.' },
      { tipo: 'arreglo', d: 'directo', t: 'El campo de un partido en juego, entero', x: 'Cuando LaLiga no da los minutos, en la ficha de un partido salían solo los que ya habían sumado o restado puntos. Ahora sale el once probable de cada equipo con lo que lleva cada uno, y debajo los demás que ya puntúan.' },
    ],
  },
  {
    v: '0.6.1', f: '2026-10-24', h: '21:53', t: 'Clubes',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'Clubes: los 20 de LaLiga', x: 'Pestaña nueva, al lado de Mercado: los 20 equipos por la clasificación, con su racha y su próximo rival. Toca uno y ves su once probable en el campo (de quién es cada jugador en tu liga y lo probable que es que salga), las bajas, los partidos que le vienen y su plantilla con lo que vale cada uno, si está libre y si está en el mercado.' },
      { tipo: 'mejora', d: 'periodico', t: 'Sus noticias, y de un sitio a otro', x: 'En la ficha de cada club salen sus titulares de los últimos días. Desde la ficha de un jugador, tocando su equipo, vas a su club, y desde un partido de Directo, tocando un escudo. Con «‹ Volver», arriba, regresas a la ficha de antes.' },
    ],
  },
  {
    v: '0.6.0a', f: '2026-10-24', h: '20:24', t: 'Tus datos',
    cosas: [
      { menor: true, tipo: 'mejora', d: 'escudo', t: 'Cómo borrar tus datos', x: 'La política de privacidad (Ajustes → Privacidad) explica ahora cómo se borra lo que se guarda en el servidor de Fantasy Manager, que es quién usa la app y tus avisos de fallo: se borra solo con el tiempo o, si lo pides en contacto@fantasymanagerapp.com, en 30 días como mucho.' },
    ],
  },
  {
    v: '0.6.0', f: '2026-10-24', h: '19:03', t: 'Camino de Google Play',
    cosas: [
      { para: 'dueño', tipo: 'nuevo', d: 'versiones', t: 'Fantasy Manager, camino de Google Play', x: 'La app se prepara para salir en Google Play. Allí será gratis, con un anuncio pequeño debajo de las pestañas, y para pedirle a la IA más de 3 planes en el mismo día habrá que ver un anuncio corto. La versión de nuestra liga, la que te instalas desde aquí, sigue sin anuncios y sin límite.' },
      { para: 'web', tipo: 'mejora', d: 'conexion', t: 'La web, en fantasymanagerapp.com', x: 'La versión web (la del iPhone y el ordenador) tiene su propia dirección: fantasymanagerapp.com. Si entras por la de antes, arriba te sale «Llevarme»: un toque y entras en la nueva con tu cuenta, tu liga y tu clave de la IA, sin volver a hacer nada. En Android, la app se pone al día desde ahí a partir de esta versión: instala el APK nuevo cuando te salga el aviso arriba.' },
    ],
  },
  {
    v: '0.5.4a', f: '2026-10-24', h: '15:27', t: 'Cada partido, en su campo',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'Cada partido, en su campo', x: 'Al tocar un partido en Directo, cada equipo sale en su campo, como un once, en vez de en una lista: cada jugador en su línea con los puntos que lleva, arriba de quién es en tu liga («TUYO» o el nombre del rival) y un balón o una tarjeta si ha marcado o le han sacado una. Si se sabe quién salió de titular, los que entraron desde el banquillo van debajo. Antes de empezar, el once probable de cada equipo con el % de que salga cada uno.', ir: { v: 'directo' } },
      { para: 'app', tipo: 'mejora', d: 'campana', t: 'La respuesta a tu aviso, en una notificación', x: 'Cuando te contestan a un aviso de fallo, te llega una notificación al móvil aunque tengas la app cerrada (mientras esperas respuesta, la app mira cada 40 minutos más o menos; de madrugada, no). Al tocarla se abre la respuesta. Con la app abierta, sale sola en unos minutos sin tener que tocar nada. En la web y el iPhone, solo con la web abierta.' },
    ],
  },
  {
    v: '0.5.4', f: '2026-10-24', h: '15:04', t: 'Directo',
    cosas: [
      { tipo: 'nuevo', d: 'directo', t: 'Una pestaña para la jornada en directo', x: 'Abajo hay una pestaña nueva, Directo. Con la jornada en juego salen todos los partidos con su marcador y por dónde van (en juego, descanso, acabados y los que faltan con su hora), y debajo de cada uno tus jugadores con los puntos que llevan y cuántos de tus rivales juegan en él. Arriba, lo que llevas, tu puesto en la jornada y cuántos de tu once ya han jugado, juegan ahora o faltan. Se pone al día sola cada minuto mientras la miras. Gracias, Domy.', ir: { v: 'directo' } },
      { tipo: 'nuevo', d: 'campo', t: 'Cada partido, jugador a jugador', x: 'Toca un partido y ves a todos los que han jugado con sus puntos y de quién es cada uno en tu liga. Cuando se puede, también las jugadas con su minuto (goles, tarjetas y cambios) y quién las hizo. Antes de empezar, quién de tu liga juega en él y lo probable que es que salga de titular.', ir: { v: 'directo' } },
      { tipo: 'nuevo', d: 'cara', t: 'Tu liga en la jornada', x: 'En Directo > Tu liga, la clasificación de la jornada mientras se juega, con cuántos jugadores le quedan por jugar a cada uno, para saber quién puede remontar. En Tu once, tu once de LaLiga con los puntos de cada uno y lo que habrían sumado los del banquillo. Y en la ficha de cada jugador, lo que lleva en la jornada: sus puntos, minutos, goles y tarjetas.', ir: { v: 'directo', seg: 'directo:liga' } },
    ],
  },
  {
    v: '0.5.3d', f: '2026-10-24', h: '14:19', t: 'Cláusulas con cabeza',
    cosas: [
      { tipo: 'arreglo', d: 'escudo', t: 'Blindajes con cifras de verdad', x: 'Para decirte hasta dónde subir una cláusula, la app miraba el dinero del rival más rico, y con uno de 88 M salía «súbela a 88 M» por un jugador de 41 M. Ahora mira también lo que de verdad se paga en tu liga por una cláusula (nadie paga el doble de lo que vale un jugador): por encima de lo más que se suele pagar ya está a salvo. Y solo te propone subirla si cuesta como mucho una cuarta parte de lo que vale (antes, un tercio).', ir: { v: 'equipo', seg: 'equipo:clausulas' } },
      { tipo: 'arreglo', d: 'ia', t: 'Que te clausulen a su valor no es un regalo', x: 'La IA podía decirte que si te clausulaban a uno por su valor «le pusieras un lacito». Está mal: te lo quitan sin pagar nada de más, pierdes sus puntos y lo que iba a subir, venderlo a LaLiga te daría más y reponerlo te costaría más. Ahora lo sabe, y no rebaja el riesgo que calcula la app sin un dato nuevo. Y un suplente con la cláusula a su valor ya no sale «sin riesgo»: solo si la cláusula pasa de lo que te daría LaLiga.', ir: { v: 'ia' } },
    ],
  },
  {
    v: '0.5.3c', f: '2026-10-24', h: '06:44', t: 'Los puntos, en tu once',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'Los puntos de la jornada, en tu once', x: 'Con la jornada en juego, en Equipo, «Tu once» pasa a ser el que tienes puesto en LaLiga, con su forma, y debajo de cada jugador los puntos que lleva (verde si suma, rojo si resta) o la hora de su partido si aún no ha jugado. Arriba, lo que llevas y tu puesto en la jornada. En Hoy ya no sale nada aparte.', ir: { v: 'equipo' } },
    ],
  },
  {
    v: '0.5.3b', f: '2026-10-24', h: '06:36', t: 'Tu once en directo, en su campo',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'El directo, en el campo', x: 'Los puntos en directo salen ahora en un campo con tu once de LaLiga en su forma de verdad (4-3-3, 3-5-2…), cada uno en su línea con los puntos que lleva, y el que aún no ha jugado con la hora de su partido. El de cada rival, igual en su ficha.', ir: { v: 'equipo' } },
      { menor: true, tipo: 'mejora', d: 'versiones', t: 'Si te has perdido muchas versiones, lo principal', x: 'Si abres la app después de varias actualizaciones, ya no te cuenta todo una por una: te enseña lo nuevo más importante (hasta cinco cosas) y el resto, sobre todo arreglos, queda en la lista de versiones de Ajustes.' },
    ],
  },
  {
    v: '0.5.3a', f: '2026-10-24', h: '06:01', t: 'Menos «no se ha podido leer»',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: 'Si se corta la conexión, lo vuelve a probar', x: 'Con datos móviles, a veces una petición a LaLiga no llega a conectar y salía «No se ha podido leer: ofertas Fornals». Ahora cada lectura que falla por la conexión se prueba otra vez, y si las ofertas de uno no se pueden leer, se usan las de la última vez (no cambian hasta el cambio de mercado) sin avisarte. Si aun así falla, el aviso dice que es la conexión y te deja actualizar.' },
      { menor: true, tipo: 'mejora', d: 'campo', t: 'Los puntos en directo, más seguros', x: 'Los puntos de cada equipo de tu liga en la jornada salen directamente de la clasificación de LaLiga, y si las estadísticas de los partidos no responden, los de cada jugador salen de la lista de jugadores.' },
    ],
  },
  {
    v: '0.5.3', f: '2026-10-24', h: '05:56', t: 'La jornada en directo',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'Tus puntos en directo', x: 'Mientras se juega la jornada, en Hoy y en Equipo ves los puntos que llevas y los de cada jugador de tu once de LaLiga, y en qué puesto vas de la jornada en tu liga. En cada lista, al lado del nombre, los puntos de los que ya han jugado, y en el campo de Tu once también. Se pone al día solo cada 2 minutos con la app abierta.', ir: { v: 'equipo' } },
      { tipo: 'nuevo', d: 'cara', t: 'Y los de tus rivales', x: 'En Rivales, al lado de los puntos de cada uno, lo que lleva en la jornada. Y en su ficha, su once con los puntos de cada jugador.', ir: { v: 'rivales', seg: 'rivales:clasif' } },
      { tipo: 'nuevo', d: 'lupa', t: 'Buscador de jugadores', x: 'Arriba del Mercado, busca cualquier jugador de LaLiga por su nombre o por su equipo: sale de quién es, si está en el mercado, su cláusula y cómo va su valor. Tócalo y se abre su ficha.', ir: { v: 'mercado' } },
    ],
  },
  {
    v: '0.5.2d', f: '2026-10-24', h: '05:07', t: 'Más rápida',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', t: 'Sin parones ni tirones', x: 'La app se quedaba parada unos segundos al cargar y cada minuto, mientras rehacía sus cuentas: sacar el día de cada valor guardado de cada jugador era lentísimo en el móvil. Ahora esas cuentas van unas 30 veces más rápido, así que carga antes, cambiar de pestaña va fino y ya no da tirones.' },
      { tipo: 'arreglo', d: 'arreglo', t: 'Los avisos de fallos se abren al momento', x: 'Para el dueño: al tocar un aviso a veces no se abría nada y parecía pillado (el servidor tardaba en darlo y un segundo toque lo cerraba). Ahora sale su texto en el acto, los que están sin contestar se cargan solos al abrir la lista y el servidor responde antes.' },
    ],
  },
  {
    v: '0.5.2c', f: '2026-10-24', h: '02:32', t: 'Lo que pagaste, siempre',
    cosas: [
      { tipo: 'arreglo', d: 'dinero', t: 'Cada venta, con lo que pagaste', x: 'Si de un jugador no sale lo que pagaste en los movimientos de la liga, la venta ya no se queda callada: si venía en tu equipo inicial, la compara con lo que valía al empezar la liga; si no, te dice que no se sabe. Y donde pone «+3,22 M» ahora dice «te entran», para que no se confunda con lo que ganas, que va debajo («ganas» o «pierdes»). Gracias, Domy.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'escudo', t: 'Las cláusulas que sube LaLiga sola', x: 'Cuando el valor de un jugador pasa su cláusula, LaLiga se la sube sola hasta su valor. La app lo tomaba por una subida pagada por su dueño: salía en Rivales > Movimientos y le restaba ese dinero. Ahora solo cuenta la que deja la cláusula por encima de su valor, la que paga el entrenador. Gracias, Domy.', ir: { v: 'rivales', seg: 'rivales:movimientos' } },
    ],
  },
  {
    v: '0.5.2b', f: '2026-10-24', h: '01:07', t: 'Contestado al momento',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', t: 'Los avisos contestados, como contestados', x: 'Para el dueño: un aviso de fallo que acababas de contestar seguía saliendo «Sin contestar» en la lista hasta un minuto después (el servidor lista con retraso). Ahora sale contestado al momento, y el numerito de Fallo baja a la vez.' },
    ],
  },
  {
    v: '0.5.2a', f: '2026-10-24', h: '00:46', t: 'Lo que te da LaLiga y lo que pagaste',
    cosas: [
      { tipo: 'mejora', d: 'dinero', t: 'Lo que te daría LaLiga por cada uno', x: 'En la ficha de cada jugador tuyo sale lo que te daría LaLiga si lo pones a la venta: lo que suele ofrecer en tu liga sobre su valor (entre cuánto y cuánto) y lo que ganarías o perderías frente a lo que pagaste. En Equipo > Beneficio, al lado de cada uno. Gracias, Domy.', ir: { v: 'equipo', seg: 'equipo:dinero' } },
      { tipo: 'mejora', d: 'plan', t: 'Las ventas, con lo que pagaste', x: 'Cada venta del plan dice ahora cuánto ganas o pierdes frente a lo que pagaste. Si venderías perdiendo dinero sin que te haga falta y el jugador no está bajando, te avisa de que puede esperar; si está bajando, lo que pagaste no cambia nada (esperar solo pierde más). La IA también lo tiene en cuenta. Gracias, Domy.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'ia', t: 'Pregunta, sin clave', x: 'Sin la clave de Google, la pestaña Pregunta solo enseñaba la guía y no quedaba claro por qué no se podía preguntar. Ahora lo dice arriba: para hacerle preguntas primero hace falta tu clave, que se saca una vez y es gratis.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'arreglo', t: 'Copiar los avisos para Claude', x: 'Para el dueño: en «Avisos de fallos», un botón copia los que están sin contestar, enteros y con su diagnóstico, para pegarlos en el chat de Claude y que los revise y los arregle.' },
    ],
  },
  {
    v: '0.5.2', f: '2026-10-23', h: '21:28', t: '¿Juega o no juega?',
    cosas: [
      { tipo: 'nuevo', d: 'semaforo', t: 'Su % de titular, al lado del nombre', x: 'En todas las listas (tu equipo, el mercado, las cláusulas y las plantillas de los rivales) sale al lado de cada jugador el % de que sea titular en su próximo partido: verde de 75 % para arriba, amarillo de 45 a 75 y rojo por debajo. Junta el once probable de la prensa, sus minutos de las últimas jornadas y lo que ha jugado en la temporada, y baja si es duda o si su equipo juega Champions o Copa cerca. En su ficha ves de dónde sale.', ir: { v: 'equipo' } },
      { tipo: 'arreglo', d: 'plan', t: 'Nada de poner el once con la jornada empezada', x: 'Un plan hecho antes de que empezara la jornada seguía diciéndote que pusieras tu once cuando ya se estaba jugando. Ahora, en cuanto empieza la jornada, ese paso y el once de la IA se quitan, el plan se da por viejo (con la jornada empezada se reabren las cláusulas) y te sale para pedir otro.', ir: { v: 'hoy' } },
      { tipo: 'nuevo', d: 'campo', t: 'Alineaciones confirmadas', x: 'Cuando salen los onces oficiales, una hora antes de cada partido, el % cambia por lo que hay de verdad: «Titular», «Suplente» o «No convocado». En el campo de Tu once lo ves en cada cromo, y «Tu equipo hoy» te avisa de quién se queda en el banquillo o no juega, para que lo cambies antes de que empiece su partido. Con la app abierta se mira cada 3 minutos, y la IA también lo tiene en cuenta.', ir: { v: 'equipo' } },
    ],
  },
  {
    v: '0.5.1a', f: '2026-10-23', h: '20:48', t: 'Blindajes que te quedan',
    cosas: [
      { tipo: 'arreglo', d: 'oferta', t: 'Lo que venden los rivales, en su ficha', x: 'La lista de lo que tiene en venta cada rival ya no ocupa la clasificación de Rivales: está dentro de su ficha, con lo que pide, lo que le da LaLiga y cuánto ofrecerle.', ir: { v: 'rivales', seg: 'rivales:clasif' } },
      { tipo: 'arreglo', d: 'escudo', t: 'No más blindajes de los que tienes', x: 'El plan de la IA podía pedirte blindar a dos a la vez aunque solo te quedara uno esta jornada. Ahora los que pasan de los que te quedan salen tachados con «No lo hagas» y te dice por qué.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'especular', t: 'El mercado del día de la jornada no cuenta', x: 'Para revender antes de la jornada, la app contaba también el cambio de mercado del mismo día en que empieza (una hora antes, por ejemplo), y te proponía comprar para vender cuando ya no daba tiempo. Ahora ese cambio no cuenta, ni los de mientras se juega la jornada: te dice cuántos quedan de verdad, a qué hora ponerlo a la venta y en qué cambio aceptar la oferta. Si no queda ninguno, la IA no te propone especular. Gracias, Domy.', ir: { v: 'mercado', seg: 'mercado:especular' } },
      { tipo: 'mejora', d: 'camiseta', t: 'Quién frena, quién está en duda', x: 'En «Tu equipo hoy», en vez de «1 frenando» o «2 en duda» sale el nombre de cada uno (los tres primeros), y al tocarlo se abre su ficha.', ir: { v: 'equipo' } },
    ],
  },
  {
    v: '0.5.1', f: '2026-10-23', h: '20:29', t: 'La IA, más rápida',
    cosas: [
      { tipo: 'mejora', d: 'ia', t: 'Respuestas y plan más rápidos', x: 'La IA piensa menos rato antes de contestar (con la mitad de tiempo el plan sale igual, y la app comprueba cada paso), en el chat le llegan la mitad de datos (tus jugadores enteros, los candidatos en resumen) y solo busca en Google si la pregunta lo necesita. Si un modelo falla por algo pasajero, las siguientes preguntas se lo saltan un rato en vez de esperarlo cada vez. Mientras piensa, dice qué está haciendo.', ir: { v: 'ia' } },
      { tipo: 'nuevo', d: 'oferta', t: 'Lo que venden los rivales', x: 'En la ficha de cada rival (tócalo en Rivales), los jugadores que tiene en el mercado con lo que pide, lo que le da LaLiga y cuánto ofrecerle para que te lo venda a ti. Es una función top: se desbloqueará viendo un anuncio.', ir: { v: 'rivales', seg: 'rivales:clasif' } },
      { tipo: 'arreglo', d: 'plan', t: 'Nada de vender sin necesidad', x: 'El plan te mandaba aceptar una oferta «para hacer caja» por un suplente aunque estuvieras en positivo y no hiciera falta el dinero. Ahora, si no entra en tu once y la oferta no es buena, te dice que puede quedarse hasta que llegue una mejor (salvo que caiga deprisa o esté lesionado). Si la IA lo propone igual, el paso te avisa.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'scroll', t: 'Todo lleva a donde dice', x: 'Los chips de arriba de Hoy llevan una flecha y te llevan a lo que dicen: «Se abre Denis Suárez» abre su ficha, «Mercado nuevo» el mercado y «Parón» te cuenta cuándo es. En el plan, los nombres de jugadores de «Los próximos días» y del resumen salen subrayados: tócalos y se abre su ficha.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'plan', t: 'Lo que llevas hoy, con todos los planes', x: '«Del plan» ahora cuenta cualquier plan de hoy, no solo el último: si haces algo que te propuso el primero y luego pides otro, sigue saliendo como del plan. Y la caja está un poco más separada de los chips de arriba.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Etiquetas dentro de la tarjeta', x: 'En los pasos del plan, una etiqueta larga como «Para revender · +200 mil · vender mañana sábado 24» se salía por la derecha. Ahora baja de línea.' },
    ],
  },
  {
    v: '0.5.0d', f: '2026-10-23', h: '19:40', t: 'Las cláusulas, con tu saldo',
    cosas: [
      { tipo: 'arreglo', d: 'dinero', t: 'Cláusulas sin deuda', x: 'LaLiga no deja clausular quedándote en negativo: eso solo se puede pujando o comprando en el mercado. La app contaba el margen de deuda también para las cláusulas y te decía «te llega» cuando no. Ahora una cláusula te llega solo si la pagas con tu saldo, la IA lo sabe y, si un plan te propone una que no cabe, te avisa en ese paso.', ir: { v: 'rivales', seg: 'rivales:clausulas' } },
      { tipo: 'mejora', d: 'cara', t: 'Quién usa la app, más fiable', x: 'Para el dueño: si el número de cuenta de alguien no cuadra con el de la clasificación, se le encuentra por el nombre de su equipo o de mánager. Y si alguien entra con su cuenta pero no le carga la liga, sale como «no le carga la liga».' },
    ],
  },
  {
    v: '0.5.0c', f: '2026-10-23', h: '19:32', t: 'Revisión a fondo',
    cosas: [
      { tipo: 'arreglo', d: 'campana', t: 'El interruptor de los avisos', x: 'En Ajustes, tocar el interruptor de «Avisos» abría «Avisar de un fallo» en vez de encenderlos o apagarlos. Ya funciona: actívalos para que te lleguen las cláusulas que se abren y el cambio de mercado.' },
      { tipo: 'arreglo', d: 'plan', t: 'Cláusulas con el dinero que tienes', x: 'El plan automático sumaba al saldo lo que te mandaba poner en venta y con eso te proponía clausular «ahora», cuando ese dinero no entra hasta que aceptas la oferta en el cambio de mercado. Ahora las cláusulas de ahora se pagan con lo que tienes ya, y si te llega solo con lo de las ventas te lo dice. Tampoco te propone subir una cláusula si no tienes el dinero.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'camiseta', t: 'Puntos esperados más justos', x: 'A los jugadores de los que aún no se había bajado la ficha se les restaba un 30 % de sus puntos esperados por error, así que fichajes buenos salían como que no entraban en tu once.' },
      { tipo: 'arreglo', d: 'ia', t: 'La IA no se queda sin modelos por nada', x: 'Hacer dos preguntas seguidas, o mandar una captura que Google no puede leer, daba por gastado el modelo bueno hasta el día siguiente. Ahora solo pasa cuando de verdad se acaba el cupo del día, y te dice a qué hora vuelve (las 8:00 o las 9:00, según el cambio de hora).', ir: { v: 'ia' } },
      { tipo: 'arreglo', d: 'nota', t: 'Lo que escribes no se borra', x: 'Si llegaba el plan o se ponía al día la liga mientras escribías una pregunta, la caja se quedaba vacía. Además, la clave de la IA ahora se prueba antes de guardarla y, si pegas una encima de otra, vale la última.', ir: { v: 'ia' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Más arreglos', x: 'Actualizar con un plan en marcha ya no pide otro a la vez. Si LaLiga falla con la plantilla de un equipo, se usa la de la última vez en vez de desaparecer (y de avisarte de que se han ido todos tus jugadores). Sin calendario, se usa el de la última vez, para no dar las cláusulas por abiertas durante el cierre. Cambiar de liga mientras carga ya no mezcla los datos de las dos. Lo marcado como «Hecho» va por liga. La liga de ejemplo ya no se queda vieja: su jornada es siempre la del próximo sábado. Una nota tuya del chat como «he clausulado a X» ya no lo da por vendido.' },
    ],
  },
  {
    v: '0.5.0b', f: '2026-10-23', h: '19:22', t: 'La app ya no se congela',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', t: 'Sin congelarse al contar los minutos', x: 'Con el límite de minutos activo, si la app comprobaba tu tiempo mientras aún esperaba la respuesta del servidor, entraba en un bucle y se quedaba congelada. Ahora espera a esa respuesta. Además, con la pantalla de «Se acabó por hoy» ya no sigue contando ni mandando tu tiempo al servidor cada minuto.' },
    ],
  },
  {
    v: '0.5.0a', f: '2026-10-23', h: '19:00', t: 'Arreglos de la 0.5.0',
    cosas: [
      { tipo: 'arreglo', d: 'ia', t: 'La guía de la IA, desde arriba', x: 'Al abrir Pregunta sin clave, la pantalla bajaba sola hasta el final y te saltabas los pasos. Ahora empieza por el paso 1. Lo que hayas pegado en la casilla ya no se borra si la app se actualiza mientras tanto, y al volver de AI Studio a la app te lleva a la casilla.', ir: { v: 'ia' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Botones en su sitio', x: 'Los botones grises (en Ajustes, en los avisos de error de la IA o «Anteriores» en el chat) salían más abajo de la cuenta, con un hueco encima. Ya están alineados.' },
      { tipo: 'arreglo', d: 'oferta', t: 'El mercado ya cabe en la pantalla', x: 'Cuando un rival vende a uno que no te va a vender, la etiqueta «No lo venderá: …» era tan larga que la pantalla del Mercado se podía mover de lado. Ahora el texto baja de línea.', ir: { v: 'mercado' } },
      { tipo: 'arreglo', d: 'cara', t: 'Cerrar fichas en el ordenador', x: 'En la web, las fichas de jugador y de rival no tenían botón de cerrar: había que tocar fuera. Ahora llevan la X arriba a la derecha, y la tecla Esc cierra cualquier ficha.' },
    ],
  },
  {
    v: '0.5.0', f: '2026-10-23', h: '18:25', t: 'Activar la IA, paso a paso',
    cosas: [
      { tipo: 'nuevo', d: 'ia', t: 'La clave de la IA, paso a paso', x: 'Sin clave, en Pregunta sale una guía con lo que vas a ver en la web de Google en cada paso y dónde tocar: entrar con tu cuenta, aceptar las condiciones, buscar tu clave y copiarla. El botón abre AI Studio y, al volver, te lleva a la casilla. En cuanto pegas la clave se prueba sola y te hace el plan. Vale la clave nueva de Google (empieza por AQ.) y la de antes (AIza). Si algo no sale igual, abajo está la ayuda.', ir: { v: 'ia' } },
      { tipo: 'mejora', d: 'ajustes', t: 'Lista para otras ligas', x: 'La cuenta atrás de apertura y el límite de minutos al día son solo para la liga de los amigos. Quien instale la app y juegue en otra liga entra sin esperar y sin límite.' },
    ],
  },
  {
    v: '0.4.4e', f: '2026-10-23', h: '17:08', t: 'Cláusulas cerradas antes de la jornada',
    cosas: [
      { tipo: 'arreglo', d: 'escudo', t: 'Nada de clausular en el cierre', x: 'LaLiga no deja clausular a nadie en las 24 h antes del primer partido de la jornada, y las reabre a la hora de ese partido. La app no lo tenía en cuenta y te proponía clausular a uno cuya protección vencía dentro de ese cierre. Ahora esas cláusulas salen cerradas hasta la hora del primer partido, el plan y la IA te dicen que es a esa hora, en Hoy se avisa de cuándo se cierran y se reabren, y te llega un aviso 15 min antes de que se reabran.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.4.4d', f: '2026-10-23', h: '12:50', t: 'El código, también antes de abrir',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: 'Pasar al iPhone con la cuenta atrás', x: 'Mientras la app está cerrada hasta la hora de apertura, en la pantalla de la cuenta atrás sale «Abrir en el iPhone u otro dispositivo» (en la app, «Abrir en el ordenador»). Te da el código de 8 letras para entrar allí sin esperar a que se abra.' },
    ],
  },
  {
    v: '0.4.4c', f: '2026-10-23', h: '12:44', t: 'El calendario, más claro',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'Cómo llega cada rival', x: 'En el calendario de la ficha de cada jugador, cada rival lleva sus últimos 5 partidos en bolitas (verde ganó, amarilla empató, roja perdió) y arriba sale cómo llega su equipo. Debajo, «Cómo puntúa»: su media en casa, fuera, contra los 6 primeros y contra los 6 últimos, en verde o en rojo si se sale de su media.' },
    ],
  },
  {
    v: '0.4.4b', f: '2026-10-23', h: '12:03', t: 'La web, desde el móvil',
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
      { tipo: 'arreglo', d: 'oferta', t: 'Ofertas que sí te puede aceptar', x: 'Cuando otro manager pone a uno a la venta, LaLiga también le hace su oferta y él se queda con la mejor. La app te proponía ofrecerle lo que pide (a veces justo su valor), y así nunca te lo iba a vender. Ahora calcula lo que suele dar LaLiga en tu liga y te propone ofrecer por encima: lo ves en el mercado («ofrece…»), en su ficha y en el plan de la IA, que ya no te pide menos de eso.', ir: { v: 'mercado', seg: 'mercado:venta' } },
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
      { tipo: 'nuevo', d: 'semaforo', t: 'V, E y D contra cada rival', x: 'En el calendario de la ficha de cada jugador, debajo de cada rival salen sus últimos enfrentamientos: V si ganó su equipo, E si empató y D si perdió, de la más vieja a la más reciente (idea de Domy). Salen con todas las competiciones; si no hay, lo de esta temporada en LaLiga. Cuenta poco en la dificultad del partido (como mucho un 4 %), porque pesa más cómo están ahora los dos equipos, y la IA también lo ve.' },
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
      { tipo: 'nuevo', d: 'semaforo', t: 'Riesgo de rotación', x: 'Los partidos de Champions, Europa League, Conference y Copa de cada equipo. Si le toca uno pegado a la jornada, le baja la titularidad (más con la Champions que con la Copa) y te lo avisa en la ficha.' },
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
      { tipo: 'nuevo', d: 'grafica', t: 'Más allá del Fantasy', x: 'Estadísticas avanzadas (xG, xA, tiros y pases clave de cada jugador, y el xG que genera y concede cada equipo) y más (nota media, las últimas notas y lo que hace en defensa o bajo palos). La IA las usa para afinar: si genera ocasiones aunque no marque, si su nota baja, cuánto recupera un defensa. También en la ficha, en «Rendimiento a fondo».' },
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
      { tipo: 'nuevo', d: 'camiseta', t: 'Onces probables', x: 'Cada jugador dice si sale de titular, suplente o fuera, y cuenta para tu once y para la IA.' },
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
