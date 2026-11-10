// La versión de la app. La Action de Android la lee de aquí para nombrar el APK.
// Numeración: la 0.1.0 es la primera completa (las anteriores pasaron a ser la 0.0.1 a la 0.0.11). A partir de
// aquí, cada versión sube el último número (0.1.1, 0.1.2…) y el del medio solo con un cambio grande.
// Los parches (correcciones y cosas pequeñas) no suben el número: llevan una letra detrás de la versión a la que
// arreglan (0.3.3a, 0.3.3b, 0.3.3c…).
export const VERSION = '0.7.1f';

// Lo nuevo de cada versión, de la más nueva a la más vieja. Al abrir una versión nueva se presenta bajando
// (presentacion.js); la lista entera está en Ajustes.
// Cada cosa: tipo (nuevo | mejora | arreglo), d (el dibujo, de dibujos.js), t (título), x (texto) e ir (a dónde
// lleva «Verlo»: { v: pestaña, seg: 'pestaña:sección' }).
// A los que no son el dueño solo les sale lo que les cambia algo (el filtro, en app.js): ni los arreglos, ni lo que lleva
// menor: true (detalles, cosas de dentro), ni lo que es de otra versión: para 'play' (Google Play), 'app' (Android),
// 'web' (iPhone y ordenador) o 'dueño' (solo Carlos).
// Una versión con todos: true se presenta a todos al actualizar (la 0.7.1, Carlos: «lleva cosas gordas»), aunque las
// novedades sean solo para el dueño; a los demás, desde la versión de antes de esa (no les salen las viejas).
export const NOVEDADES = [
  {
    v: '0.7.1f', f: '2026-11-10', h: '11:56', t: 'Lo que sube hoy cada jugador',
    cosas: [
      { tipo: 'arreglo', d: 'grafica', t: 'Lo de hoy, en la ficha del jugador', x: 'Al abrir un jugador, al lado de su valor sale lo que ha subido o bajado hoy y, aparte, lo de 7 días. Si la app no se había abierto ayer, en vez de lo de hoy salía solo lo acumulado de la semana: ahora lo saca del histórico de LaLiga. Lo avisó Domy.', ir: { v: 'equipo' } },
      { para: 'dueño', tipo: 'arreglo', d: 'reloj', t: '«Se mueve 21–24 h»', x: 'En «Cómo juega» de un rival, la franja que acaba a medianoche decía «21–0 h».', menor: true },
      { para: 'dueño', tipo: 'arreglo', d: 'candado', t: 'Política: el segundo plano viene activado', x: 'La política de privacidad decía «si activas el segundo plano»; en Android viene activado y se apaga en Ajustes → Trabaja con la app cerrada.', menor: true },
    ],
  },
  {
    v: '0.7.1e', f: '2026-11-10', h: '00:15', t: 'Cada club, por pestañas',
    cosas: [
      { tipo: 'nuevo', d: 'grafica', t: 'Suben y bajan, club a club', x: 'En la ficha de cada club, la pestaña Suben y bajan pone a toda su plantilla del que más sube arriba al que más baja abajo, con cuánto sube o baja cada uno (en euros y en %), su valor y de quién es en tu liga. Arriba, lo que se mueve el club entre todos, hoy o en 7 días.', ir: { v: 'clubes' } },
      { tipo: 'mejora', d: 'escudo', t: 'La ficha del club, por partes', x: 'Lo que antes iba todo seguido en una lista larga va ahora en cuatro pestañas: Resumen (el próximo partido, su once, las bajas y las noticias), Suben y bajan, Plantilla (con cuántos hay libres y en tu liga) y Partidos (los que le vienen, los últimos y jornada a jornada). Siempre se abre en Resumen.', ir: { v: 'clubes' } },
      { tipo: 'mejora', d: 'camiseta', t: 'Tus clubes, con lo que se mueven', x: 'Las tarjetas de arriba de Clubes son más bajas, llevan lo que suben o bajan hoy tus jugadores de ese club y el escudo de su próximo rival.', ir: { v: 'clubes' } },
    ],
  },
  {
    v: '0.7.1d', f: '2026-11-09', h: '23:56', t: 'Sin presentación al actualizar',
    cosas: [
      { tipo: 'mejora', d: 'versiones', t: 'Las novedades, solo en Ajustes', x: 'Al actualizar ya no se abre la presentación de novedades a nadie. Lo que cambia en cada versión sigue en Ajustes → Novedades, solo para ti.', ir: null },
    ],
  },
  {
    v: '0.7.1c', f: '2026-11-09', h: '23:56', t: 'El parón, sin el calendario de colores',
    cosas: [
      { tipo: 'mejora', d: 'bandera', t: 'Fuera las píldoras de los días', x: 'La cabecera de la pestaña Parón ya no lleva la fila de píldoras de colores con los días («Hoy Compra lo que sube», «Mié 18 Piensa en el once»…): solo el título y tus tres cifras, y debajo, directamente, quién se revaloriza y quién se hunde.', ir: { v: 'directo' } },
    ],
  },
  {
    v: '0.7.1b', f: '2026-11-09', h: '22:36', t: 'Las cláusulas, sin contradicciones',
    cosas: [
      { tipo: 'arreglo', d: 'balanza', t: 'Hoy y la IA dicen lo mismo', x: 'El aviso de «Cláusula de…» en Hoy y la alarma de que se abre una cláusula solo miraban el interés del jugador, así que te ponían de objetivo cláusulas que la IA luego desaconsejaba (Revivo, a un +35 % de su valor en pleno parón). Ahora usan la misma regla que el plan: lo que pagas de más, su calendario, si se puede revender y, en el parón, que sea un chollo claro.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.7.1a', f: '2026-11-09', h: '16:31', t: 'La pestaña Parón, al grano',
    cosas: [
      { tipo: 'mejora', d: 'bandera', t: 'Arriba, lo justo', x: 'La cabecera de la pestaña Parón ocupa menos de la mitad: el título en una línea, tus tres cifras (lo que puedes ganar, lo que evitas perder y lo que puedes gastar) en una franja y los días que cuentan en píldoras. Sin el texto de guía, así quién se revaloriza y quién se hunde sale en la primera pantalla.', ir: { v: 'directo' } },
    ],
  },
  {
    v: '0.7.1', f: '2026-11-09', h: '13:44', t: 'Hoy, más clara, y el parón para hacer dinero', todos: true,
    cosas: [
      { tipo: 'nuevo', d: 'plan', t: 'El plan, por fases', x: 'La pestaña Hoy enseña el plan en el orden en que cuadra el dinero: primero lo urgente, después «Haz caja» (lo que vendes o aceptas), «Ficha», «Protege» y «Alinea». Cada fase dice lo que entra o sale y con cuánto te quedas, y una barra cuenta los pasos que llevas hechos. Cada paso es una fila corta: tócala para ver el porqué y los datos.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'scroll', t: 'Pliega lo que ya tienes visto', x: 'Toca el título de una fase para plegarla; la app se acuerda mientras dure ese plan y pliega sola las que tienes hechas. Los próximos días, lo que hay que vigilar, las noticias y los rivales también van plegados en el móvil, para que lo primero que veas sea el plan.', ir: { v: 'hoy' } },
      { tipo: 'nuevo', d: 'bandera', t: 'La pestaña Parón', x: 'Mientras dura el parón, Directo se convierte en Parón: qué comprar para revender antes de la vuelta y cuánto ganarías, lo principal arriba: quién se va a revalorizar y quién se va a hundir, con la gráfica de cada uno y, en «Para ti», solo lo que te llega con tu saldo y tu margen de puja (y lo que te falta por puesto, delante); qué tienes que vender antes de que baje, qué tuyos siguen subiendo, qué cláusulas mirar para el once de la vuelta y los días que cuentan. Arriba puedes volver a Directo, y cada sección se pliega tocando su título.', ir: { v: 'directo' } },
      { tipo: 'nuevo', d: 'especular', t: 'En el parón, a por el dinero', x: 'Durante el parón de selecciones nadie puntúa, así que el plan cambia: compra lo que sube para venderlo antes de la vuelta, vende en lo alto lo que va a bajar y protege lo tuyo. Clausular para el once solo sale si es un chollo (a su valor y sin bajar) o en los dos o tres días antes de la jornada de vuelta.', ir: { v: 'hoy' } },
      { tipo: 'nuevo', d: 'calendario', t: 'El aviso del parón', x: 'Mientras dura el parón, arriba de Hoy, un aviso en amarillo con lo que falta para la jornada. Tócalo y vas a la pestaña Parón, donde está todo.', ir: { v: 'hoy' } },
      { menor: true, tipo: 'mejora', d: 'ia', t: 'La IA sabe qué cláusulas y pujas valen en el parón', x: 'Cada cláusula y puja le llega marcada como chollo, para revender o no; si propone fichar para el once algo que no es un chollo, la app lo descarta y dice por qué. Lo que se puede ganar revendiendo se calcula algo más prudente en el parón.' },
      { tipo: 'mejora', d: 'scroll', t: 'Desliza para cambiar de pestaña', x: 'En el móvil, desliza el dedo a la izquierda o a la derecha y pasas a la pestaña de abajo siguiente o anterior, sin tocar la barra.' },
      { menor: true, tipo: 'mejora', d: 'campana', t: 'Lo urgente, dentro del plan', x: '«Ahora mismo» ya no va aparte: lo urgente que el plan no recoge sale arriba, en «Antes de nada».' },
    ],
  },
  {
    v: '0.7zf', f: '2026-11-09', h: '11:35', t: 'La IA, más fina con el plan',
    cosas: [
      { tipo: 'mejora', d: 'ia', t: 'Un plan que cuadra con lo que se puede hacer', x: 'La app comprueba cada paso que propone la IA y lo pasa a una operación que existe de verdad (pujar, comprar, clausular, vender, blindar). Si propone revender, el beneficio es el que calcula la app; si propone subir una cláusula, como mucho la subida justa y sin pasarte de la caja. Con las funciones de los rivales cerradas, la IA solo sabe si tienen mucho, algo o poco dinero.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'reloj', t: 'Nada de clausular para dentro de diez días', x: 'En un parón la IA te podía proponer hoy una cláusula que no se abre hasta dentro de una semana o más. Ahora solo planea las que se abren en las próximas 48 horas; las demás salen como «Para más adelante» y vuelven al plan cuando falten un par de días.', ir: { v: 'hoy' } },
      { tipo: 'nuevo', d: 'cara', t: 'Un saludo de bienvenida', x: 'La primera vez que alguien entra con su liga le sale un mensaje tuyo: quién hace la app y que cualquier fallo o idea se manda con Reportar. Sale una vez por cuenta, aunque entre desde otro dispositivo.' },
      { menor: true, tipo: 'mejora', d: 'campana', t: 'El aviso de arriba, cada tres días', x: 'El aviso de que la app está en pruebas vuelve a salir 72 horas después de cerrarlo (antes, 24).' },
      { tipo: 'arreglo', d: 'arreglo', t: 'El lunes del parón', x: 'La IA decía «fin de semana sin partidos» justo después de una jornada recién jugada: ahora sabe cuál fue la última jornada y que viene un parón.' },
    ],
  },
  {
    v: '0.7ze', f: '2026-11-09', h: '06:20', t: 'Cada día y cada jornada',
    cosas: [
      { tipo: 'nuevo', d: 'grafica', t: 'Lo que sube o baja cada día', x: 'En la ficha de cualquier jugador, debajo de la gráfica del valor, salen siempre unas barras con lo que ha subido o bajado cada uno de los últimos 7 días (arriba en verde lo que sube, abajo en rojo lo que baja). También en Tu equipo hoy, con el valor de tu plantilla.' },
      { tipo: 'nuevo', d: 'trofeo', t: 'Los puntos de cada rival por jornada', x: 'En Directo → Por jornada tienes una tabla con lo que ha hecho cada mánager de tu liga en cada jornada, con su media, su mejor jornada y cuántas ha ganado. En verde el que más hizo cada jornada y en rojo el que menos. Toca una columna para ordenar por ella.', ir: { v: 'directo', seg: 'directo:jornadas' } },
    ],
  },
  {
    v: '0.7zd', f: '2026-11-08', h: '23:41', t: 'La app de Android, más segura',
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'candado', t: 'La web que baja la app, firmada', x: 'La app de Android solo usa una web nueva si viene firmada con nuestra clave (paquete.json.sig, Ed25519); si la firma falta o no cuadra, sigue con la que tiene. Los anuncios no se crean ni se piden hasta que la web los quiere en una pestaña con contenido. Las Actions van con versiones fijas y cada APK lleva su propio número de versión.', menor: true },
    ],
  },
  {
    v: '0.7zc', f: '2026-11-08', h: '20:00', t: 'Privacidad, más clara',
    cosas: [
      { tipo: 'mejora', d: 'escudo', t: 'Los nombres de tus rivales, mejor tapados', x: 'Cuando la IA recibe los datos de tu liga, los demás mánagers van como «Rival N» también si su nombre sale en minúsculas, sin tilde o en mayúsculas («marcos», «Alex», «RUBÉN»), y los que ya se fueron de la liga, como «Exrival N». Los jugadores que llevan dentro el nombre de un rival («Hugo Duro») se quedan como están. Las capturas que adjuntas van tal cual.' },
      { tipo: 'mejora', d: 'ia', t: 'El chat ya no busca en Google', x: 'La búsqueda en Google del chat viene apagada, como en el plan: contesta antes y con los datos de tu liga. Si la quieres, la enciendes en Ajustes → Buscar en Google en el chat.', ir: { v: 'ia' } },
      { menor: true, tipo: 'nuevo', d: 'balanza', t: 'Aviso legal y condiciones de uso', x: 'La web tiene ya su aviso legal (quién está detrás de Fantasy Manager) y unas condiciones de uso: es una app no oficial, el riesgo de usarla con tu cuenta de LaLiga lo asumes tú y las recomendaciones no son una garantía. La política de privacidad dice quién es el responsable de tus datos.' },
      { para: 'dueño', tipo: 'mejora', d: 'lupa', t: 'Sin nombres de modelos', x: 'En el Diagnóstico, quien no es el dueño ve las versiones de la IA como «IA 1», «IA 2», «IA 3» (también dentro de los mensajes de Google y en los avisos de fallo que manda). Un error de Google que la app no reconoce sale con un mensaje propio, y si le preguntan a la IA qué modelo es, dice que es el director deportivo de Fantasy Manager.' },
      { para: 'dueño', tipo: 'mejora', d: 'ajustes', t: 'Seguridad de los datos de Play, preparada', x: 'En play/ficha.md está el formulario nuevo, con lo que va a la IA de Google (el chat, las capturas y los datos de la liga, también en segundo plano) y lo que guarda hoy el Worker, y los pasos para rellenarlo en Play Console.' },
    ],
  },
  {
    v: '0.7zb', f: '2026-11-08', h: '19:12', t: 'El intermediario de Deno, al día',
    cosas: [
      { para: 'dueño', tipo: 'arreglo', d: 'conexion', t: 'La web usa el Deno de producción', x: 'La dirección de Deno que tenía la web era la de su primera compilación (30 oct) y no se actualizaba con los cambios: ahora va a la de producción, que sigue a main del intermediario, con las mismas reglas cerradas que el Worker.', menor: true },
    ],
  },
  {
    v: '0.7za', f: '2026-11-08', h: '18:49', t: 'El servidor de la web, con frenos',
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'candado', t: 'Nadie puede agotar el servidor de la web', x: 'Límites por IP en el código de 8 letras, el QR y los avisos, y por cuenta en el tiempo de uso y en «Quién usa la app»: antes, unas mil peticiones sin cuenta dejaban sin el paso al ordenador y sin avisos a todos hasta el día siguiente. El tiempo de uso se guarda como mucho cada 4 minutos, 5 avisos al día por cuenta con capturas de hasta 350 KB, y si el servidor llega a su tope lo dice claro en vez de dar un código que no funciona.', menor: true },
      { para: 'dueño', tipo: 'mejora', d: 'conexion', t: 'El Worker y Deno, cerrados', x: 'Cada sitio solo deja lo que usa la app: en login.laliga.es, pedir la sesión; en la API de LaLiga, leer con tu sesión; en el resto, leer. Sin puertos, /img solo con imágenes de LaLiga, y la dirección de Cloudflare Pages fijada a la nuestra. /caras solo da las fotos de una liga en la que estás, y la ficha para contar usuarios se borra a los 400 días sin abrir la app.', menor: true },
    ],
  },
  {
    v: '0.7z', f: '2026-11-08', h: '17:52', t: 'La app no se queda colgada',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', t: 'Nunca más en «Abriendo…»', x: 'Si la liga guardada en el móvil no se puede abrir (por ejemplo, tras una actualización), la app lo apunta, la tira y vuelve a cargar tu liga de LaLiga. Antes se quedaba en «Abriendo…» hasta borrar los datos.' },
      { tipo: 'arreglo', d: 'conexion', t: 'Con la conexión colgada, una salida en 25 segundos', x: 'Si LaLiga no contesta, la carga ya no espera minutos: a los 25 segundos te lo dice, y si lo que falta es secundario se usa lo de la última vez. A los 15 segundos sale «Usar lo guardado» si tienes la liga guardada.' },
      { tipo: 'arreglo', d: 'movil', t: 'Con el almacenamiento lleno, tu sesión va primero', x: 'Si el navegador se queda sin sitio, la app hace hueco quitando la liga de ejemplo y lo de otras ligas antes que perder tu sesión, tu clave o el chat, y si ni así cabe te avisa arriba. Las miniaturas de las fotos del chat ya no ocupan ese sitio.' },
      { tipo: 'mejora', d: 'bandera', t: 'Tu opinión cuenta', x: 'El aviso de arriba ahora dice que la app está en desarrollo y en pruebas, y que cualquier fallo o idea de mejora se manda con el botón Reportar: se lee todo y se tiene en cuenta. Si lo cierras, vuelve a salir al día siguiente.', menor: true },
      { para: 'dueño', tipo: 'mejora', d: 'lupa', t: 'La web se prueba antes de publicarse', x: 'Antes de publicar, GitHub abre la liga de ejemplo y comprueba que arranca, que las 7 pestañas pintan sin error, que una liga guardada rota no bloquea, que la red colgada tiene salida y que el almacenamiento lleno no pierde la sesión. Si algo falla, no se publica. En cada subida corren también las pruebas del Worker y del bot sin red.', menor: true },
    ],
  },
  {
    v: '0.7y', f: '2026-11-08', h: '12:54', t: 'Anuncios de la web, solo a los lados',
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'candado', t: 'En la web, anuncios solo a los lados', x: 'Se quita el banner de abajo de la web en el móvil: los anuncios de la web solo salen en el lateral del ordenador, si cabe.', menor: true },
    ],
  },
  {
    v: '0.7x', f: '2026-11-08', h: '12:50', t: 'Anuncios solo con tu liga',
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'candado', t: 'Anuncios solo con la sesión de tu liga iniciada', x: 'El banner de abajo (Google Play) y los de la web ya no salen en la liga de ejemplo ni en una pestaña vacía o cargando: solo con tu liga cargada y con contenido en pantalla.', menor: true },
    ],
  },
  {
    v: '0.7w', f: '2026-11-08', h: '12:19', t: 'Dos funciones top, gratis',
    cosas: [
      { tipo: 'mejora', d: 'candado', t: 'Lo que venden los rivales y Cómo juega cada rival, abiertas', x: 'Ya no piden anuncio: las ves siempre. Siguen con candado el dinero de los rivales, quién puede pagar tu cláusula y cuándo gira un jugador.' },
    ],
  },
  {
    v: '0.7v', f: '2026-11-08', h: '12:01', t: 'Las novedades de cada versión, solo para la liga',
    cosas: [
      { tipo: 'mejora', d: 'candado', t: 'Sin lista de novedades para los de fuera', x: 'Quien no es del dueño ni de las ligas de limites.json tampoco ve «Novedades» en Ajustes. Para enseñárselas a todos: «novedadesTodos»: true en limites.json.', menor: true },
    ],
  },
  {
    v: '0.7u', f: '2026-11-08', h: '11:59', t: 'Para los que llegan de fuera de la liga',
    cosas: [
      { tipo: 'mejora', d: 'candado', t: 'Funciones top: pronto en Google Play', x: 'Los candados dicen que las funciones top estarán disponibles muy pronto, con la salida a Google Play.', menor: true },
      { tipo: 'mejora', d: 'campana', t: 'Aviso de «App en pruebas»', x: 'El aviso de arriba ahora dice «App en pruebas», con el botón para reportar un fallo.', menor: true },
      { tipo: 'mejora', d: 'candado', t: 'Las novedades de cada versión, solo para la liga', x: 'A quien no es del dueño ni de la liga ya no se le abre solo la presentación de novedades al actualizar; la lista entera sigue en Ajustes.', menor: true },
    ],
  },
  {
    v: '0.7t', f: '2026-11-08', h: '02:13', t: 'Cuánto tiempo pasa cada uno en la app',
    cosas: [
      { para: 'dueño', tipo: 'nuevo', d: 'grafica', t: 'Tiempo en la app, por persona y por día', x: 'En Quién usa la app, el bloque «Tiempo en la app»: cuánto ha estado cada uno hoy y ayer en horas y minutos, su media de los días que entra y los 7 últimos días en barras. Se cuenta para todos, no solo para los que tienen límite de minutos.' },
      { tipo: 'mejora', d: 'candado', t: 'Privacidad, al día', x: 'La política de privacidad cuenta que se apunta el tiempo que tienes la app a la vista cada día (solo el tiempo) y que se borra a los 9 días.', menor: true },
    ],
  },
  {
    v: '0.7s', f: '2026-11-08', h: '01:39', t: 'Los cambios entre managers, como son',
    cosas: [
      { tipo: 'arreglo', d: 'balanza', t: 'Un cambio son dos compras', x: 'Si un rival te propone cambiar un jugador tuyo por uno suyo, la IA lo cuenta como lo que es: tú compras el suyo por su valor y él el tuyo por el suyo, y el que se lleva al que vale más paga la diferencia. Nadie pierde valor. Antes lo contaba como un cambio sin dinero y te decía que le regalabas millones.' },
      { tipo: 'arreglo', d: 'escudo', t: 'La protección de 14 días, en la cuenta', x: 'Cuando las cláusulas de los dos están a punto de abrirse, el cambio os deja a cada uno un jugador protegido 14 días. La IA lo pone en la balanza con lo que sube cada uno al día, además de los puntos, el estado y el calendario.' },
      { tipo: 'arreglo', d: 'lupa', t: 'Busca qué tiene un jugador tocado', x: 'Si preguntas por cambiar, vender o comprar a uno que está en duda o lesionado, la IA busca en Google qué tiene antes de contestar.', menor: true },
    ],
  },
  {
    v: '0.7r', f: '2026-11-08', h: '01:17', t: 'Los tratos con precio, bien contados',
    cosas: [
      { tipo: 'arreglo', d: 'balanza', t: 'Echa la cuenta del trato entero', x: 'Si le propones a un rival un trato con precios («le compro A por 30 M y le vendo B por 60 M»), la IA mira cómo acabas: con qué jugador y cuánto saldo, y lo compara con esperar a las cláusulas. Antes miraba cada precio por separado y decía que eran cifras inventadas.' },
      { tipo: 'arreglo', d: 'dinero', t: 'Saldo y valor, cada uno en su sitio', x: 'Un cambio de jugadores no toca tu saldo: lo que cambia es lo que vale tu equipo. La IA ya no dice que te quitan millones cuando es una diferencia de valor.' },
      { tipo: 'arreglo', d: 'ia', t: 'Bromas en castellano', x: 'Las pullas, en español de España: sin «echá» ni «afanar».', menor: true },
    ],
  },
  {
    v: '0.7q', f: '2026-11-08', h: '00:42', t: 'Tendencias: lo que sube hoy, bien contado',
    cosas: [
      { tipo: 'arreglo', d: 'grafica', t: 'Suben y Bajan, con lo de hoy de verdad', x: 'A un jugador sin datos de valor recientes (como Arriaga, que ya no está en LaLiga) le salía que subía 1,2 M hoy comparando con su valor de agosto. Ahora lo de hoy se cuenta con el valor de ayer y, si no lo hay, no se inventa. Los que se han ido de LaLiga ya no salen, y lo que sube cada uno hoy se cuenta con el valor que ves, aunque de madrugada la página de mercado de fuera aún traiga lo de ayer.', ir: { v: 'mercado', seg: 'mercado:tendencias' } },
    ],
  },
  {
    v: '0.7p', f: '2026-11-08', h: '00:38', t: 'Puntos uno a uno y la IA con chispa otra vez',
    cosas: [
      { tipo: 'nuevo', d: 'pizarra', t: 'Los puntos de cada jugador y por qué', x: 'Al acabar un partido, en su ficha (Directo → toca el partido) sale la lista de cada equipo con los puntos de cada jugador y de dónde salen: jugar, goles, asistencias, paradas, portería a cero o goles encajados, recuperaciones, tarjetas, la nota de los medios… Si LaLiga aún está ajustando los puntos y no cuadran, te lo dice.', ir: { v: 'directo' } },
      { tipo: 'mejora', d: 'ia', t: 'Las pullas vuelven al chat', x: 'Con las pullitas en «Normales» o «A saco» (Ajustes, en la parte de la IA), tu director deportivo vuelve a soltar bromas y pullas también en el chat, a los rivales y a ti. Las cuentas y el consejo siguen en serio. Si lo prefieres serio, pon «Suaves» o «Sin pullitas».' },
      { tipo: 'arreglo', d: 'balanza', t: 'Tiene en cuenta si tu jugador está en duda', x: 'Si nombras a uno tuyo que está en duda o lesionado, la IA lo dice y echa las cuentas: cuánto tendría que bajar para que te compense un cambio y qué otra salida tienes (venderlo a LaLiga cerca de su valor). Y si le das un dato nuevo o le insistes, empieza por lo que cambia en vez de repetirte lo mismo.' },
    ],
  },
  {
    v: '0.7o', f: '2026-11-07', h: '22:47', t: 'El chat de la IA, más serio y con las cuentas bien',
    cosas: [
      { tipo: 'mejora', d: 'ia', t: 'Habla como un director deportivo', x: 'Cercano pero serio: sin chascarrillos cuando habla de una operación o de un rival con el que negocias, y sin suponer lo que quieres. Si le falta saber algo, te lo pregunta. Las pullitas, para las noticias de fuera del campo.' },
      { tipo: 'arreglo', d: 'nota', t: 'Solo apunta lo que decides tú', x: 'Si preguntas por una oferta o estás negociando, apunta la oferta tal cual, no que la has rechazado o aceptado. Una decisión solo se apunta cuando la dices tú, y nunca como si fuera por su consejo.' },
      { tipo: 'arreglo', d: 'reloj', t: 'Sabe cuándo se abre la cláusula de los tuyos', x: 'Cuando nombras a uno de tus jugadores, la IA tiene su cláusula, la hora a la que se abre y desde cuándo lo puedes blindar. Antes, de los tuyos nombrados no le llegaba la cláusula.' },
      { tipo: 'arreglo', d: 'escudo', t: 'El blindaje, con su hora de verdad', x: 'El escudo de LaLiga solo se puede poner con la cláusula ya abierta y protege 24 h. La IA ya no dice que lo puedes poner antes ni cambia la hora de un mensaje a otro.' },
      { tipo: 'arreglo', d: 'bandera', t: 'Tiene en cuenta el parón', x: 'Sabe cuándo empieza y cuándo acaba, que en esos días nadie suma puntos y que las subidas se moderan.' },
      { tipo: 'arreglo', d: 'balanza', t: 'Las cuentas de un cambio, hechas', x: 'Si hablas de cambiar a uno tuyo por uno de un rival, le llegan hechas la diferencia de valor, las dos cláusulas, cuándo se abren y a quién le llega cada una, y las mantiene en las preguntas siguientes. Así no cambia las cifras de un mensaje a otro.' },
      { tipo: 'arreglo', d: 'plan', t: 'No repite el plan del día en cada respuesta', x: 'Solo lo saca si lo que preguntas va del plan o de sus jugadores.' },
      { tipo: 'arreglo', d: 'lupa', t: 'Nico Williams ya no trae a Iñaki', x: 'Al nombrar a un jugador por su nombre entero, la IA recibía también los datos de otro con el mismo apellido.', menor: true },
    ],
  },
  {
    v: '0.7n', f: '2026-11-07', h: '20:36', t: 'Los que vuelven, también en el Radar de subidas',
    cosas: [
      { tipo: 'mejora', d: 'grafica', t: '«Vuelve» en el Radar de subidas', x: 'El Radar de subidas marca a los que vuelven (valían el doble o más esta temporada, juegan otra vez y suben varios días seguidos) con «Vuelve · valía…» y los pone primero. Antes se quedaban fuera porque uno de 9 M nunca sube tantos euros como uno de 60 M.', ir: { v: 'mercado', seg: 'mercado:venta' } },
      { tipo: 'arreglo', d: 'cohete', t: 'A uno que vuelve no se le manda vender mientras siga subiendo', x: 'Si un día subía algo menos que el anterior, su ficha decía «No es momento de comprarlo», la salida lo daba como que se tuerce y el plan podía mandarlo vender. Ahora, mientras siga subiendo, la ficha dice cuánto valía y que es de los más claros para revender, y si es tuyo, que lo aguantes.' },
      { tipo: 'arreglo', d: 'grafica', t: 'El que empezó a subir hace 2 o 3 días ya no sale como que baja', x: 'La tendencia de 7 días metía los días de bajada de antes. En el mercado, las ofertas y las ventas por bajada ahora cuenta lo que sube estos días.', menor: true },
    ],
  },
  {
    v: '0.7m', f: '2026-11-07', h: '20:11', t: 'Especular también con la jornada en juego',
    cosas: [
      { tipo: 'mejora', d: 'cohete', t: 'Los que vuelven, primero para revender', x: 'Si un jugador llegó a valer el doble o más esta temporada, se hundió por una lesión o por no jugar y ahora vuelve a sumar minutos y sube varios días seguidos, sale en Especular con «Vuelve · valía…» y la IA te lo recomienda para revender aunque no te haga falta en el once. Como De Jong: de 44,5 M en julio a 5,6 M, y ahora subiendo un 5 % al día.', ir: { v: 'mercado', seg: 'mercado:especular' } },
      { tipo: 'arreglo', d: 'especular', t: 'Especular no se apaga con la jornada en juego', x: 'Mientras se jugaba una jornada, Especular se quedaba vacío y el plan no proponía nada para revender, aunque detrás hubiera un parón y dos semanas por delante. Ahora se puede comprar ya y vender antes de la siguiente jornada, y la subida cuenta todos los días hasta venderlo. Con uno que empezó a subir hace poco, cuenta lo de los últimos 3 días y no la semana entera con los días de bajada.' },
    ],
  },
  {
    v: '0.7l', f: '2026-11-06', h: '23:40', t: 'Entrar desde el iPhone y sin la app, con dibujos',
    cosas: [
      { tipo: 'mejora', d: 'movil', t: 'La portada de la web, más clara', x: 'En el ordenador, el panel de entrar tiene dos pestañas («Soy nuevo» y «Ya tengo la app») y pasos numerados, con Android y iPhone uno al lado del otro y el logo de cada uno. La columna de la izquierda se queda fija al desplegar cosas en la derecha.', para: 'web' },
      { tipo: 'nuevo', d: 'compartir', t: 'Las guías de entrar, con dibujos', x: 'La guía de iPhone, «Añadir a la pantalla de inicio» y los pasos del F12 de «No tengo la app en el móvil» llevan un dibujo por paso, con un aro rojo en lo que hay que tocar. En el F12 salen los nombres en español y en inglés (Red / Network, Conservar registro / Preserve log).', para: 'web' },
    ],
  },
  {
    v: '0.7k', f: '2026-11-06', h: '23:03', t: 'Mejor tener dos delanteros',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'Un segundo delantero, si te conviene', x: 'Con un solo delantero sano se puede jugar (4-5-1 o 5-4-1), pero si se lesiona o no juega te quedas sin nadie. Ahora, en Puestos, DEL sale con «mejor 2» y la IA y las puntuaciones del mercado tienen en cuenta que un delantero bueno y barato de recambio suma. No es obligatorio y nunca pasa por delante de tapar un hueco de verdad.' },
    ],
  },
  {
    v: '0.7j', f: '2026-11-06', h: '23:05', t: 'Novedades con más dibujos',
    cosas: [
      { tipo: 'mejora', d: 'regalo', t: 'Cada novedad con su dibujo', x: 'Las tarjetas de las novedades ya no repiten siempre los mismos dibujos: hay 19 nuevos (balón, trofeo, reloj, calendario, candado, cohete, portería, pizarra…) para que cada cosa lleve el que le toca.', menor: true },
      { tipo: 'mejora', d: 'movil', t: 'Lo de iPhone, bien a la vista en el ordenador', x: 'En la portada de la web del ordenador hay una tarjeta azul con el logo de Apple, «¿Tienes iPhone?», con un botón para entrar desde el ordenador y la guía. Antes solo salía en letra pequeña dentro de «No tengo la app en el móvil». La guía de iPhone también va en azul.', para: 'web' },
    ],
  },
  {
    v: '0.7i', f: '2026-11-06', h: '22:41', t: 'La portada y el iPhone, más claros',
    cosas: [
      { tipo: 'mejora', d: 'scroll', t: 'Se nota que hay más al bajar', x: 'En la portada de la web sale un botón «Baja: hay mucho más»: en el ordenador, debajo de los textos de la izquierda; en el móvil, abajo del todo mientras no has hecho scroll. Así no parece que solo existe la primera pantalla.', para: 'web', menor: true },
      { tipo: 'nuevo', d: 'movil', t: 'Guía para iPhone, paso a paso', x: 'La web explica en tres pasos cómo entrar desde un iPhone y cómo dejarla en la pantalla de inicio como una app, con un icono y el nombre Fantasy Manager. Hay una guía más detallada en la página de instalar y, en Ajustes, un atajo.', para: 'web' },
    ],
  },
  {
    v: '0.7h', f: '2026-11-06', h: '22:38', t: 'Ventas que miran la cláusula abierta',
    cosas: [
      { tipo: 'mejora', d: 'lupa', t: 'Cada venta dice a cuánto está su cláusula', x: 'Cuando te sugiere vender a uno tuyo con la cláusula abierta, ahora te dice a cuánto está, cuánto sobre su valor y cuánto te daría LaLiga. Si la cláusula paga más y a algún rival le llega, no te manda vender con prisa: si te lo clausulan cobras más. Si está por debajo de lo que da LaLiga, te dice que mejor vendas a LaLiga. Vale en Hoy, en el plan y en lo que lee la IA.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.7g', f: '2026-11-05', h: '23:13', t: 'Cada club, jornada a jornada',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'El once de cada jornada, con sus puntos', x: 'En la ficha de cada club, «Jornada a jornada»: eliges la jornada y sale el once que salió de verdad, en el campo y con los puntos de cada uno, el rival y el resultado. Debajo, los que entraron desde el banquillo: en qué minuto, cuántos jugaron y sus puntos.', ir: { v: 'clubes' } },
      { tipo: 'nuevo', d: 'lupa', t: 'Quién es fijo y quién rota', x: 'Debajo, «Quién juega»: cuántas veces ha salido de titular cada jugador y qué parte de los minutos de su equipo ha jugado. Fijo, rota o suplente, de un vistazo antes de fichar.', ir: { v: 'clubes' } },
    ],
  },
  {
    v: '0.7f', f: '2026-11-05', h: '22:25', t: 'Casa o fuera, de un vistazo',
    cosas: [
      { tipo: 'mejora', d: 'camiseta', t: 'Una casa o un avión en cada partido', x: 'En el calendario de cada jugador y en los partidos de cada club, delante del rival sale una casa si se juega en casa y un avión si es fuera, en vez de «vs» o «en casa del».', ir: { v: 'clubes' } },
    ],
  },
  {
    v: '0.7e', f: '2026-11-05', h: '08:00', t: 'Clubes sin relleno',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', t: 'Fuera los «Fuera de LaLiga» de cada club', x: 'La ficha de un club enseñaba en las bajas una lista larguísima de jugadores que ya no están en LaLiga (cedidos fuera, filiales, vendidos). Ya no salen ni en las bajas ni en la plantilla: solo los que juegan en LaLiga.', ir: { v: 'clubes' } },
    ],
  },
  {
    v: '0.7d', f: '2026-11-05', h: '06:04', t: 'Lo urgente, bien colocado',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', t: 'Los avisos urgentes se leían en una columna', x: 'En «Ahora mismo», cuando el aviso decía cuándo con una frase larga («La jornada empieza mañana 21:00»), el título salía con una palabra por línea. Ahora esa frase va debajo del título.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.7c', f: '2026-11-04', h: '20:52', t: 'La IA, más rápida',
    cosas: [
      { tipo: 'mejora', d: 'ia', t: 'El plan sale en la mitad de tiempo', x: 'El plan ya no manda a la IA a buscar en Google (las noticias y los onces probables ya van con él): de 40-80 s pasa a 20-30 s y falla menos. Si la quieres, en Ajustes está «Buscar en Google al hacer el plan».' },
      { tipo: 'mejora', d: 'ia', t: 'Si una versión de la IA se cuelga, otra la releva antes', x: 'A los 25 s sin respuesta la app pregunta también a otra versión, y si tampoco contesta, a otra más a la vez: vale la primera que llegue. La que contesta bien se queda la primera durante un día. Ningún intento pasa de 60-90 s ni todo junto de 3 minutos.' },
      { tipo: 'mejora', d: 'ia', menor: true, t: 'Se ve cuánto lleva pensando', x: 'Mientras la IA prepara el plan o contesta en el chat, el texto de abajo cuenta los segundos.' },
    ],
  },
  {
    v: '0.7b', f: '2026-11-04', h: '18:53', t: 'Respuestas de Fantasy Manager',
    cosas: [
      { tipo: 'arreglo', d: 'arreglo', menor: true, t: 'Las respuestas a tus avisos, de Fantasy Manager', x: 'Cuando contestamos un aviso de fallo, la respuesta sale firmada como Fantasy Manager, también las de antes.' },
    ],
  },
  {
    v: '0.7a', f: '2026-11-04', h: '18:19', t: 'Tus datos, más guardados',
    cosas: [
      { tipo: 'mejora', d: 'ia', t: 'La IA ya no ve los nombres de tus rivales', x: 'Para hacerte el plan y contestarte, la IA de Google recibía el nombre de cada mánager de tu liga y de su equipo. Ahora le llegan como «Rival 1», «Rival 2»… y la app les vuelve a poner el nombre en lo que contesta: tú lo ves igual que antes.', ir: { v: 'ia' } },
      { tipo: 'nuevo', d: 'ajustes', t: 'Borrar tus datos del servidor', x: 'En Ajustes → Borrar mis datos del servidor se borra al momento lo que Fantasy Manager guarda de ti: que usas la app, cuánto rato y tus avisos de fallo con sus capturas. Tu liga, tu sesión y tu clave están en tu dispositivo y no se tocan.' },
      { tipo: 'nuevo', d: 'tarjeta', t: 'Invita a los de tu liga', x: 'En Ajustes → Invitar a tu liga sale un enlace para mandar al grupo. Quien lo abre ve que viene de tu liga y, al entrar con su cuenta, se le abre esa liga directamente.' },
      { tipo: 'mejora', d: 'conexion', t: 'Abrir en el ordenador, cifrado', x: 'Con el QR o con el código de 8 letras, tu sesión y tu clave de la IA viajan cifradas: el servidor de la web las guarda esos minutos sin poder leerlas.' },
      { tipo: 'mejora', d: 'ia', menor: true, t: 'Antes de pegar la clave', x: 'Al activar la IA, un aviso cuenta qué datos de tu liga van a Google y qué puede hacer Google con ellos con la clave gratuita, con una casilla de mayor de 18 años.' },
      { para: 'dueño', tipo: 'nuevo', d: 'grafica', t: 'Qué hace la gente con la app', x: 'En Quién usa la app, el bloque «Qué hacen»: planes, preguntas, anuncios bonificados y funciones top de esta semana y de las 4 anteriores, la entrada paso a paso (login, entrar, guía de la clave, clave guardada, primer plan) y cuántas cargas de la liga fallan, aparte con jornada en juego. Solo números por cuenta, sin nada de la liga.' },
      { tipo: 'mejora', d: 'arreglo', menor: true, t: 'El saldo del plan, con las ventas sin prisa', x: 'Las ventas que el plan marca como «sin prisa» no cuentan en lo que te queda hoy. Ahora el pie del plan lo dice y te da también el saldo con ellas hechas.' },
      { tipo: 'mejora', d: 'arreglo', menor: true, t: 'Avisos de fallo sin los nombres de tu liga', x: 'El diagnóstico que va con un aviso de fallo ya no lleva los nombres ni las fotos de los demás de tu liga.' },
    ],
  },
  {
    v: '0.6.12o', f: '2026-11-04', h: '09:32', t: 'El dinero de los rivales, más fino',
    cosas: [
      { tipo: 'arreglo', d: 'dinero', t: 'Menos margen en el dinero de los rivales', x: 'Para los jugadores que un rival tiene desde el principio de la liga, la app no sabía con qué cláusula empezaron (guardaba solo los últimos 90 días de su valor) y lo metía todo en el margen: a un rival que casi no se mueve le salía un «± 82 M». Ahora guarda lo que valían al crearse la liga y pide la ficha de esos jugadores, así que el dinero estimado de esos rivales se afina.', ir: { v: 'rivales' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'Understat, en mantenimiento', x: 'La web de estadísticas avanzadas (Understat) está en mantenimiento y contestaba con una página vacía. La app ya no la pide en cada carga: la vuelve a probar cada 3 horas y el diagnóstico dice que está en mantenimiento.', menor: true },
    ],
  },
  {
    v: '0.6.12n', f: '2026-11-04', h: '07:00', t: 'El dinero de los rivales, con todos los movimientos',
    cosas: [
      { tipo: 'arreglo', d: 'dinero', t: 'El dinero de los rivales, con todo el historial', x: 'Si alguien se había ido de la liga, la app daba por leídos todos los movimientos antes de llegar al principio y el dinero estimado de los rivales salía con datos a medias. En ligas con mucho movimiento, además, no pasaba de la página 50. Ahora solo cuenta a los que siguen en la liga y, si no llega al principio, sigue la semana siguiente desde donde lo dejó.', ir: { v: 'rivales' } },
      { tipo: 'arreglo', d: 'arreglo', t: 'La semana del cambio de hora, bien contada', x: 'Para revender antes de la jornada, la app sumaba 24 horas justas a cada cambio de mercado. La semana del cambio de hora eso no es verdad: en octubre contaba dos cambios el mismo día y en marzo los ponía a la 01:15. Ahora va día a día a las 00:15.', menor: true },
      { para: 'web', tipo: 'arreglo', d: 'periodico', t: 'Noticias también en la web', x: 'Google Noticias no contesta casi nunca a la web por el servidor de siempre. Ahora, si falla, la web las pide por el segundo servidor y, si ahí salen, sigue por él unas horas.' },
      { tipo: 'arreglo', d: 'arreglo', t: 'Botones que no hacían nada', x: 'En los movimientos, las filas sin jugador («Fulano cobró por la jornada») parecían botones y no abrían nada: ahora abren la ficha de ese rival, y las tuyas ya no parecen un botón. El «valor ›» de la cabecera de Equipo te lleva a la gráfica del valor aunque ya estés en Beneficio. En la liga de ejemplo, la ficha de un club explica por qué no sale su once.', menor: true },
    ],
  },
  {
    v: '0.6.12m', f: '2026-11-04', h: '05:55', t: 'La web se pone al día sola',
    cosas: [
      { para: 'web', tipo: 'arreglo', d: 'conexion', t: 'La web recarga tu liga sola', x: 'Si dejabas la web abierta o volvías a la pestaña horas después, seguía enseñando lo de antes: pasadas las 00:15 salía el mercado viejo como si fuera el de hoy. Ahora recarga tu liga al volver a la pestaña y, con la app abierta, un minuto después de que cambie el mercado.' },
      { tipo: 'arreglo', d: 'conexion', t: 'Si la IA no contesta, tu pregunta no se pierde', x: 'Cuando la IA fallaba en Pregunta, solo salía un aviso unos segundos y tu pregunta se quedaba sola en el chat. Ahora vuelve a la caja de escribir (con sus fotos), el chat te dice qué ha pasado y tienes un botón para volver a preguntar.' },
      { tipo: 'mejora', d: 'conexion', t: 'Plazos del plan más claros', x: 'Los pasos del plan dicen «esta noche antes de las 00:15» o «antes del jue 5 a las 20:00» en vez de «antes de mañana 00:15», y en las reventas «Ponlo a la venta mañana».' },
      { tipo: 'arreglo', d: 'conexion', menor: true, t: 'Con la letra grande del móvil, Equipo se ve bien', x: 'Con el texto del móvil en grande, los nombres de las pestañas de Equipo se montaban unos encima de otros y se cortaban cifras. Ahora la barra se desliza de lado y las cifras se ponen en dos columnas si no caben.' },
      { tipo: 'mejora', d: 'conexion', menor: true, t: 'Carga más rápida si una web de datos no contesta', x: 'Si una de las webs de estadísticas avanzadas no responde, la app deja de esperarla un rato en vez de perder unos segundos en cada carga.' },
    ],
  },
  {
    v: '0.6.12l', f: '2026-11-03', h: '23:23', t: 'Fichar te dice lo que puedes gastar',
    cosas: [
      { tipo: 'mejora', d: 'dinero', t: 'Si no te llega, Fichar te lo dice claro', x: 'Cuando la puja que haría falta por un jugador pasa de tu dinero, Fichar ya no te enseña esa puja: te dice «Solo puedes gastar» y cuánto. Las pujas salen con el mismo formato en Fichar, Especular y la ficha.' },
      { tipo: 'mejora', d: 'especular', t: 'En la ficha, lo de revender', x: 'Si un jugador lo tienes para especular, su ficha te dice que para revenderlo da igual su calendario y cuánto pujaría la app por él.' },
      { tipo: 'arreglo', d: 'grafica', t: 'Los puntos por jornada de la ficha cuadran', x: 'La ficha de un jugador enseña los puntos de cada jornada que ha jugado y suman lo que lleva en total.' },
      { tipo: 'arreglo', d: 'nota', t: 'Adiós a «1000 mil»', x: 'Las cantidades a punto de llegar al millón salen ya como «1,00 M».' },
    ],
  },
  {
    v: '0.6.12k', f: '2026-11-03', h: '23:05', t: 'Un sancionado de un partido se aguanta',
    cosas: [
      { tipo: 'mejora', d: 'tarjeta', t: 'Un sancionado de un partido ya no se vende', x: 'Si uno de los tuyos está sancionado, la app te dice que se pierde la jornada y que se aguanta, en vez de mandarte venderlo. Solo te lo hace vender si su valor cae con fuerza o hay otra razón, y una sanción larga (una roja que ya ha durado más de un partido) sigue contando como una baja.' },
      { tipo: 'mejora', d: 'oferta', t: 'La IA ya no puja de más', x: 'Si la IA propone pujar bastante más de lo que la app ve justo para ese jugador, el plan baja la puja a la de la app y te dice por qué.' },
      { para: 'web', tipo: 'mejora', d: 'conexion', t: 'Una entrada más clara en el ordenador', x: 'Si es tu primera vez, arriba tienes la liga de ejemplo y la descarga para Android (con un QR para el móvil); el QR y el código para entrar con tu cuenta están debajo, en «¿Ya tienes la app en el móvil?».' },
      { tipo: 'arreglo', d: 'campo', t: 'Los puestos de Tu once vuelven a ser pequeños', x: 'En Equipo y en Hoy, «POR 2 · DEF 5 · MED 5 · DEL 3» salía en cajas enormes desde la versión anterior.' },
    ],
  },
  {
    v: '0.6.12j', f: '2026-11-03', h: '22:40', t: 'Una sola puja por jugador',
    cosas: [
      { tipo: 'mejora', d: 'oferta', t: 'La misma puja en toda la app', x: 'La puja que te propone la app por un jugador es la misma en Hoy, en Mercado → Fichar, en Especular y en su ficha, y el beneficio de especular se cuenta con ella. Si el plan descarta a uno porque no te llega, Fichar te dice hasta cuánto puedes pujar en vez de llamarlo chollo. Y «Puedes gastar hasta» dice que ya descuenta lo que tienes pujado.' },
      { para: 'web', tipo: 'mejora', d: 'periodico', t: 'Tres guías más', x: 'El blindaje, los apercibidos y los puntos DAZN, en la web con las demás guías.' },
      { para: 'dueño', tipo: 'mejora', d: 'ajustes', t: 'Formaciones Premium y protección de 14 días, comprobadas', x: 'Según la ayuda oficial de LaLiga Fantasy: 7 formaciones para todos y 5 más en las ligas Premium (3-6-1, 3-3-4, 4-2-4, 4-6-0 y 5-2-3), que solo valen si el administrador las tiene activadas. Corregido en la guía de alineación y el glosario (también capitán y banquillo, Premium). La protección tras fichar es de 2 semanas (14 días); la app lee la hora exacta de LaLiga.' },
    ],
  },
  {
    v: '0.6.12i', f: '2026-11-03', h: '22:34', t: 'Puntos esperados con la tabla de verdad',
    cosas: [
      { tipo: 'mejora', d: 'ia', t: 'Los puntos que esperas de cada jugador, con la tabla real', x: 'La app calculaba la portería a cero y las paradas con una tabla vieja: daba 4 puntos de portería a cero a los defensas (son 3), 1 a los medios (son 2) y nada a los delanteros (es 1), y una parada cada 3 en vez de cada 2. Ahora usa la tabla comprobada con miles de jornadas, y a medios y delanteros también les resta encajar. El once y el plan que te propone la app salen de estas cuentas.' },
      { tipo: 'mejora', d: 'plan', t: 'Un plan más claro', x: 'El titular del plan ya no cuenta lo descartado ni dos veces lo mismo, el número de Hoy coincide con lo que queda por hacer, los pasos dicen cuántos son para luego y cuántos están descartados, y lo descartado va al final con su etiqueta.' },
      { tipo: 'mejora', d: 'lupa', t: 'Menos ruido en las pantallas', x: 'Las funciones top que aún no están abiertas van juntas en una sola tarjeta al final, no una detrás de otra arriba. En Rivales, «75 en la J9» y «+1,5 M en 7 días» en vez de abreviaturas.' },
      { tipo: 'arreglo', d: 'cara', t: 'En el móvil, Clubes ya no corta los nombres', x: 'Por debajo de 420 px las caras salen solo en «Tus clubes» y el partido puede ocupar dos líneas.' },
      { tipo: 'arreglo', d: 'cara', t: 'Textos repetidos y erratas', x: '«Sin ofertas» una sola vez en En venta, «Abiertas ya» en Cláusulas, «1 gol» en singular y la errata de Especular.' },
      { para: 'web', tipo: 'mejora', d: 'periodico', t: 'Dos guías nuevas', x: 'Cómo puntúan los porteros y a qué hora cambia el mercado, en la web, con las demás guías.' },
      { para: 'dueño', tipo: 'mejora', d: 'ajustes', t: 'Repaso de la noche del 3 nov', x: 'Demo sin el equipo de Carlos, sin nombres de modelos de IA en ninguna parte, voz de «la app», liga de ejemplo con calendario creíble, guías con migas y datos estructurados, índice por grupos, instalar.html en el sitemap, zoom en la web y campos a 16 px en el iPhone.' },
    ],
  },
  {
    v: '0.6.12h', f: '2026-11-03', h: '21:12', t: 'El plan, sin esperas cuando Google se satura',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: 'El plan ya no se queda esperando si Google va saturado', x: 'Cuando la IA de Google se satura, el plan podía tardar minutos. Ahora prueba enseguida con otra versión de la IA y, si no hay ninguna libre, te lo dice en vez de seguir esperando.' },
    ],
  },
  {
    v: '0.6.12g', f: '2026-11-03', h: '21:08', t: 'Guía de puntos', menor: true,
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'periodico', t: 'Guía de puntos publicada', x: 'La guía «Cómo se calculan los puntos en LaLiga Fantasy» sale del borrador con la tabla sacada de las fichas de LaLiga (420 jugadores, 4.072 fichas de jornada): goles por posición, tramos, portería a cero con 60 minutos, lo que resta y la valoración DAZN, con el desglose de los 13 puntos de Bellingham en la jornada 2. Ya está en el sitemap y enlazada desde las demás guías.' },
    ],
  },
  {
    v: '0.6.12f', f: '2026-11-03', h: '20:40', t: 'Cuántos usan la app', menor: true,
    cosas: [
      { para: 'dueño', tipo: 'nuevo', d: 'conexion', t: 'Quién usa la app, también en la web y con todas las cuentas', x: 'En la web ya sale «Quién usa la app» en Ajustes. Arriba tienes cuántas cuentas han entrado alguna vez, cuántas están activas esta semana y este mes, las altas de hoy, de 7 y de 30 días, desde dónde la usan (APK, Google Play o web), las altas de las 8 últimas semanas y las últimas cuentas nuevas.' },
    ],
  },
  {
    v: '0.6.12e', f: '2026-11-03', h: '14:01', t: 'Once probable bien leído', menor: true,
    cosas: [
      { tipo: 'arreglo', d: 'conexion', menor: true, t: 'El once probable ya no mete suplentes ni porcentajes al 100 %', x: 'Al leer el once probable entraban también los suplentes y el once tipo (salían 13-16 titulares por equipo) y algunos salían al 100 % porque se leía mal el número (Bernardo Silva, I. Williams o Sadiq). Ahora salen los 11 con su porcentaje real.' },
    ],
  },
  {
    v: '0.6.12d', f: '2026-11-03', h: '12:40', t: 'Vender a pérdida, sin prisa', menor: true,
    cosas: [
      { tipo: 'arreglo', d: 'dinero', menor: true, t: 'En negativo entre semana, el plan ya no te hace malvender', x: 'Si estás en negativo pero quedan 2 o más cambios de mercado antes de la jornada, una venta del plan que pierde dinero frente a lo que pagaste sale como «Sugerencia · sin prisa»: no cuenta en el saldo y te dice hasta cuándo tienes para vender y empezar la jornada en positivo. Sigue saliendo como paso normal si está lesionado, cae más de un 3 % al día o hace falta para una cláusula de hoy.' },
    ],
  },
  {
    v: '0.6.12c', f: '2026-11-03', h: '09:50', t: 'Ventas que no hacen falta, fuera del plan', menor: true,
    cosas: [
      { tipo: 'arreglo', d: 'dinero', menor: true, t: 'El plan ya no manda aceptar una oferta que no te hace falta', x: 'Si no necesitas el dinero y la oferta de LaLiga es de las bajas (o venderías por debajo de su valor perdiendo lo que pagaste), el paso sale como «No lo hagas» y no cuenta en el saldo. Antes salía como recomendado con un aviso al lado.' },
    ],
  },
  {
    v: '0.6.12b', f: '2026-11-03', h: '08:55', t: 'Noticias solo de fútbol', menor: true,
    cosas: [
      { tipo: 'arreglo', d: 'conexion', menor: true, t: 'Fuera las noticias que no son de fútbol', x: 'En Noticias salían titulares que no tenían nada que ver (el tiempo, premios de música o fútbol femenino) porque un jugador se llama igual que otra persona. Ahora solo salen las de fútbol de LaLiga.' },
    ],
  },
  {
    v: '0.6.12a', f: '2026-11-02', h: '23:57', t: 'Aviso de app en desarrollo', menor: true,
    cosas: [
      { tipo: 'nuevo', d: 'conexion', menor: true, t: 'La app avisa de que sigue en desarrollo', x: 'Arriba sale que la app aún está en desarrollo, con un botón para reportar cualquier fallo. Se cierra con la × y vuelve a salir a la semana.' },
    ],
  },
  {
    v: '0.6.12', f: '2026-11-02', h: '23:03', t: 'Entrar con un QR',
    cosas: [
      { para: 'app', tipo: 'nuevo', d: 'conexion', t: 'Abre tu cuenta en el ordenador con un QR', x: 'Abre fantasymanagerapp.com en el ordenador y sale un QR. En la app: Ajustes → Abrir en el ordenador → Escanear QR, apuntas a la pantalla y el ordenador entra solo con tu liga y tu clave de la IA. Sin escribir códigos.' },
      { para: 'web', tipo: 'mejora', d: 'conexion', t: 'El iPhone entra con la cámara', x: 'Junto al código de 8 letras sale un QR: escanéalo con la cámara del iPhone y la web se abre ya con tu cuenta, sin escribir nada.' },
    ],
  },
  {
    v: '0.6.11i', f: '2026-11-02', h: '22:30', t: 'Blindar es blindar',
    cosas: [
      { tipo: 'arreglo', d: 'escudo', t: '«Blindar» y «subir la cláusula», cada uno con su nombre', x: 'Blindar es el escudo gratis de LaLiga (viendo un anuncio). Pagar para que suba la cláusula ahora sale como «Subir cláusula» en el plan, en las fichas y en lo que escribe la IA.' },
    ],
  },
  {
    v: '0.6.11h', f: '2026-11-02', h: '22:04', t: 'Un tutorial más corto',
    cosas: [
      { tipo: 'mejora', d: 'ajustes', t: 'El tutorial, a tu medida', x: 'Al empezar eliges «Lo básico» (6 pasos, un minuto) o «Verlo todo» (cada pestaña). Los textos son más cortos y el tutorial entero sigue en Ajustes.' },
      { para: 'web', tipo: 'mejora', d: 'periodico', t: 'Las guías, de Fantasy Manager', x: 'Cada guía acaba con lo que hace la app por ti en ese tema, y en la web hay un botón «Usar en la web» junto a «Descargar la app»: en el ordenador y en el iPhone se usa sin descargar nada.' },
    ],
  },
  {
    v: '0.6.11g', f: '2026-11-02', h: '21:57', t: 'Guías para jugar mejor',
    cosas: [
      { para: 'web', tipo: 'nuevo', d: 'periodico', t: '13 guías de LaLiga Fantasy', x: 'En la web hay guías con números sobre cláusulas, cuánto subir la cláusula, cuándo clausular, valor de mercado, pujas, ventas, saldo negativo, alineación, ganar dinero, lesionados, empezar una liga, un glosario y preguntas frecuentes. Se llega desde la entrada («Guías del juego»), desde su sección en la portada y desde el menú de arriba, y al final de cada guía salen las tres siguientes.' },
      { para: 'web', tipo: 'mejora', d: 'tarjeta', t: 'La portada, más fácil de recorrer', x: 'La calculadora se llama ahora «¿Cuánto subo la cláusula?»: blindar es el escudo gratis de LaLiga, otra cosa. Debajo de la entrada, dos botones grandes: «Mira cómo funciona» y «Guías del juego». En el móvil, la barra de arriba lleva también el menú de secciones, que se desliza de lado y sigue la sección en la que estás, y «Cómo funciona» avisa de que se desliza y tiene puntos para saltar de paso.' },
      { para: 'dueño', tipo: 'mejora', d: 'ajustes', t: 'Guías publicadas', x: 'Las 13 guías escritas salen del borrador (index, sitemap y menú de las páginas públicas). La de puntos sigue en borrador: falta la tabla de puntos de esta temporada comprobada.' },
    ],
  },
  {
    v: '0.6.11f', f: '2026-11-02', h: '20:51', t: 'Una portada para enseñarla',
    cosas: [
      { para: 'web', tipo: 'mejora', d: 'tarjeta', t: 'La portada, entera nueva', x: 'Antes de entrar, la web enseña cómo funciona la app según bajas, tu once con caras y escudos, cómo decide en cuatro casos de cada semana y dos calculadoras: cuánto blindar a un jugador y cuánto puedes gastar.' },
      { tipo: 'mejora', d: 'campo', t: 'La liga de ejemplo, con caras y escudos', x: 'Los jugadores de la liga de ejemplo son los de esta temporada y salen con su cara y el escudo de su equipo, como en tu liga.' },
      { para: 'dueño', tipo: 'mejora', d: 'cara', t: 'Caras de la demo, al vuelo', x: 'caras-demo.js pide a LaLiga sin sesión la lista de jugadores y los equipos, casa la demo por id y guarda solo las direcciones 3 días; ninguna imagen en el repo. La demo trae los 20 equipos de la 26/27 con sus ids y 7 jugadores reales por equipo. «Descargar la app» en vez de «Bajar la app» en la web y las páginas públicas.', menor: true },
    ],
  },
  {
    v: '0.6.11e', f: '2026-11-02', h: '20:11', t: 'La web, más clara',
    cosas: [
      { para: 'web', tipo: 'mejora', d: 'oferta', t: 'Menos anuncios en la web', x: 'En la web ya no salen anuncios en la portada, mientras carga, al entrar con el código ni en una pestaña vacía: solo en las pestañas con contenido.' },
      { para: 'web', tipo: 'nuevo', d: 'periodico', t: 'Quiénes somos, contacto y privacidad', x: 'Debajo de la portada hay enlaces a quién hace la app, cómo escribirnos y la política de privacidad, en páginas que se leen sin abrir la app.', menor: true },
      { para: 'web', tipo: 'arreglo', d: 'arreglo', t: 'La pantalla de arranque, a todo lo ancho', x: 'En el ordenador, el fondo de la pantalla que sale al abrir la web se quedaba en una franja estrecha. Ahora ocupa toda la pantalla.' },
      { para: 'dueño', tipo: 'mejora', d: 'ajustes', t: 'Páginas públicas y guías', x: 'Privacidad, quiénes somos, contacto y 14 guías en borrador, generadas con .github/paginas.py (sin JavaScript, con sitemap.xml y robots.txt). Las guías no se indexan hasta que tengan texto. Las ramas web-… tienen vista previa en Cloudflare Pages.' },
    ],
  },
  {
    v: '0.6.11d', f: '2026-11-02', h: '17:11', t: 'Vender con calma',
    cosas: [
      { tipo: 'mejora', d: 'hucha', t: 'Antes de decirte que vendas, mira más cosas', x: 'Hoy, el plan y la IA ya no te mandan vender por una bajada si el jugador juega en menos de 2 días como titular probable, si ha subido hoy un 1 % o más, o si su cláusula está abierta por encima de lo que da LaLiga y a algún rival le llega. Y cuando sí te lo proponen, te dicen los días que le quedan de cláusula protegida. Lo pidió Domy.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.6.11c', f: '2026-11-02', h: '00:04', t: '¿Es titular en su partido?',
    cosas: [
      { tipo: 'nuevo', d: 'campo', t: 'Tu plantilla, por quién es titular', x: 'En Equipo → Plantilla hay un orden nuevo, «Titular»: tus jugadores en grupos (titular confirmado, probable titular, con dudas, suplente o poco probable, no juegan y sin datos del once), cada uno con su rival y cuándo juega. Con la alineación ya confirmada sale «Titular» o «Suplente»; antes, la probabilidad con el once probable. Lo pidió Domy.', ir: { v: 'equipo', seg: 'equipo:plantilla' } },
    ],
  },
  {
    v: '0.6.11b', f: '2026-11-01', h: '13:55', t: 'La portada de la web',
    cosas: [
      { para: 'dueño', tipo: 'mejora', d: 'tarjeta', t: 'Portada nueva, sin dar vueltas', x: 'La pantalla de antes de entrar, en la web: en un Android, el botón de descargar la app va primero y lo del código queda plegado; en un iPhone, la liga de ejemplo antes del paso del ordenador; los pasos de F12 solo salen en el ordenador. Debajo, tres móviles dibujados con el plan, las cláusulas y la IA. Y al compartir el enlace sale imagen y descripción.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.6.11a', f: '2026-11-01', h: '12:24', t: 'Lo urgente, de acuerdo con tu plan',
    cosas: [
      { tipo: 'arreglo', d: 'plan', t: 'Clausulazos urgentes que el plan no decía', x: 'En «Ahora mismo» salían cláusulas para clausular ya aunque tu plan de la IA no dijera nada de ellas. Si la cláusula ya estaba abierta cuando se hizo el plan, la IA la tuvo en cuenta y no la eligió (o la descartó), así que ya no sale como urgente. Solo sale la que se ha abierto después del plan, y lo dice.', ir: { v: 'hoy' } },
      { tipo: 'arreglo', d: 'plan', t: 'La cabecera del plan, entera en el móvil', x: 'El modelo de la IA y hace cuánto se hizo el plan se cortaban en el móvil. Ahora van en su línea, debajo de «Plan de hoy», y el botón para mandar tu plan al grupo de la liga dice «Compartir» (antes era solo un icono).', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.6.11', f: '2026-11-01', h: '02:02', t: 'Al grupo de la liga',
    cosas: [
      { tipo: 'nuevo', d: 'tarjeta', t: 'Tu plan, al grupo de la liga', x: 'Con el botón de enviar de la cabecera del plan sale una imagen para el grupo de WhatsApp de tu liga: el titular y lo que ya has hecho hoy (el clausulazo y a quién se lo has quitado, la venta y quién se lo lleva). Lo que tienes en marcha no sale, va como «y 2 movimientos más que no te cuento», y si el titular nombra a alguno de esos se quita solo (lo puedes volver a poner). También puedes mandar cada noticia y cada rival del plan, con su pullita.', ir: { v: 'hoy' } },
      { para: 'app', tipo: 'mejora', d: 'campana', t: 'La alarma del clausulazo suena aunque estés en silencio', x: 'El aviso de 1 minuto antes del clausulazo de tu plan suena ahora como una alarma: con el volumen de alarma, aunque tengas el móvil en silencio, hasta que lo toques o bajes las notificaciones (3 minutos como mucho). Si rehaces el plan y ya no lo manda, se quita solo. En Ajustes → Avisos, «Que suene como una alarma» lo deja como un aviso normal y «Probar la alarma» la hace sonar a los 10 segundos.' },
    ],
  },
  {
    v: '0.6.10j', f: '2026-11-01', h: '01:25', t: 'Cuántos planes llevas',
    cosas: [
      { para: 'play', tipo: 'arreglo', d: 'ia', t: 'La cuenta de los planes, bien dicha', x: 'La ventana del anuncio para pedir otro plan decía «ya has pedido 3 planes», pero el primer plan del día no cuenta: son 3 «Otro plan» gratis además de ese. Ahora lo dice así.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.6.10i', f: '2026-10-31', h: '22:30', t: 'Con la jornada en juego, a por la siguiente',
    cosas: [
      { tipo: 'mejora', d: 'plan', t: 'Con la jornada empezada, Hoy piensa en la siguiente', x: 'LaLiga cierra tu once con el primer partido de la jornada y ya no deja cambiar a nadie hasta la siguiente, ni a los que aún no han jugado. La app daba por hecho que sí. Ahora, con la jornada en juego, el plan ya no te pone alinear ni te enseña un once para esa jornada: lo que propone (fichar, vender, clausular, proteger) es para la siguiente, o para el parón si llega antes. En Hoy, en lugar del once, te dice que está cerrado y te lleva a Directo para ver lo que lleva. Y si un clausulazo se abre después del primer partido, te avisa de que esa jornada no lo puedes alinear aunque su partido sea otro día.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'ia', t: '«¿Qué hago con…?», según de quién sea', x: 'El botón de la ficha de cada jugador ya no pregunta lo mismo para todos. Si es tuyo, le pregunta a la IA si te lo quedas, si lo vendes a LaLiga o a un rival (a quién y por cuánto) o si le subes la cláusula. Si es de un rival, si clausularlo, hacerle una oferta o dejarlo. Y si está libre en el mercado, si pujar y cuánto como mucho.', ir: { v: 'equipo' } },
      { para: 'app', tipo: 'arreglo', d: 'campana', t: 'El aviso de «no es titular», solo cuando sirve', x: 'El aviso de que uno de tu once no sale de titular llega solo antes del primer partido de la jornada, que es cuando aún lo puedes cambiar. Antes llegaba también antes de los partidos siguientes, cuando ya no había nada que hacer.' },
    ],
  },
  {
    v: '0.6.10h', f: '2026-10-31', h: '00:33', t: 'Del plan a la ficha',
    cosas: [
      { tipo: 'mejora', d: 'plan', t: 'Toca al jugador del plan y ves su ficha', x: 'En cada paso del plan, toca la cara o el nombre del jugador y se abre su ficha con todos sus datos, sin tener que ir a buscarlo al mercado. Al cerrarla sigues en el plan. Tocando el resto de la tarjeta se despliega como siempre.', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.6.10g', f: '2026-10-30', h: '20:32', t: 'Alarma para tus clausulazos',
    cosas: [
      { para: 'app', tipo: 'nuevo', d: 'campana', t: 'Alarma 1 minuto antes de cada clausulazo', x: 'Si tu plan dice clausular a uno cuya cláusula aún no se ha abierto, te salta un aviso en el móvil 1 minuto antes de que se abra, con el precio y a quién se lo quitas, para que tengas LaLiga Fantasy abierta a la hora. Si se abren varias a la vez al empezar la jornada, va un solo aviso con todas. Si rehaces el plan y ya no lo manda, o marcas el paso como hecho, el aviso se quita. Se apaga en Ajustes → Avisos, «Clausulazos de tu plan».', ir: { v: 'hoy' } },
    ],
  },
  {
    v: '0.6.10f', f: '2026-10-30', h: '20:15', t: 'Versión entera y fichajes a tiempo',
    cosas: [
      { tipo: 'arreglo', d: 'campo', t: 'Clausulazos que llegan tarde al once', x: 'El plan te mandaba alinear a uno que clausulabas justo cuando empieza su partido (cláusula a las 21:00 y partido a las 21:00): para entonces ya no se puede alinear. Ahora el paso de clausular lo avisa, el de alinear se descarta y te queda la mejor alineación con lo que tienes. Además, ese paso dice la hora real a la que se abre la cláusula, no «antes de las 21:00».' },
      { tipo: 'arreglo', d: 'arreglo', t: 'El número de versión, cortado', x: 'Con una versión de cinco casillas como la 0.6.10e, el número se salía de la pantalla del móvil y arrastraba el título y la fecha. Ahora el marcador se ajusta al ancho y se ve entero.' },
    ],
  },
  {
    v: '0.6.10e', f: '2026-10-30', h: '19:54', t: 'Pujas a la medida de cada jugador',
    cosas: [
      { tipo: 'mejora', d: 'oferta', t: 'Pujas a la medida de cada jugador', x: 'La puja que te propongo ya no aplica el mismo porcentaje a todos. Por uno de 600 mil con varias pujas, un +15 % casi nunca gana: se los suelen llevar por bastante más. Ahora miro lo que se ha pagado en tu liga por jugadores de su valor y pujo en consecuencia. Con los caros sigue igual de prudente, porque ahí un +20 % son millones. En la ficha de cada libre ves lo que se paga en tu liga por los de su valor.', ir: { v: 'mercado' } },
      { tipo: 'arreglo', d: 'ia', t: 'Fichar justo antes de la jornada', x: 'La IA decía que lo que ganaras en el mercado el mismo día de la jornada no llegaba a tiempo. Si el mercado cambia a las 20:00 y el primer partido es a las 21:00, el jugador es tuyo a las 20:00 y lo puedes alinear. Ahora lo sabe.' },
    ],
  },
  {
    v: '0.6.10d', f: '2026-10-30', h: '13:57', t: 'La web, también con partidos',
    cosas: [
      { tipo: 'mejora', d: 'conexion', para: 'web', t: 'La web, también con partidos', x: 'Con partidos, algunas operadoras cortan las direcciones de Cloudflare, por donde la web pide los datos a LaLiga. Ahora, si a los pocos segundos no contesta, la web los pide por otro camino fuera de Cloudflare, sin que tengas que hacer nada. Lo que no cambia: los avisos de fallo y el código para entrar desde otro dispositivo siguen yendo solo por el camino de siempre.' },
    ],
  },
  {
    v: '0.6.10c', f: '2026-10-30', h: '13:14', t: 'El rival, en tu once',
    cosas: [
      { tipo: 'mejora', d: 'campo', t: 'El rival cuenta en tu once', x: 'A un portero o un defensa le pesa mucho contra quién juega: contra uno que marca mucho casi nunca deja la portería a cero, resta por los goles y saca peor nota. Ahora lo que se espera de cada uno baja más cuando su equipo lo va a pasar mal (y sube cuando le toca uno flojo). Si la IA te alinea a uno así teniendo a otro mejor en el banquillo, la app lo cambia y te dice por qué, con los dos partidos. Y si no tienes con quién cambiarlo, debajo de tu once te lo avisa.', ir: { v: 'hoy' } },
      { tipo: 'mejora', d: 'camiseta', t: 'Quién va a ser titular, en el campo', x: 'En tu once, abajo a la izquierda de cada foto, lo que tiene de ser titular: en verde de 75 % para arriba, en ámbar de 50 a 74 % y en rojo por debajo. Arriba sigue su próximo rival, con el color de lo difícil que es, y ya sin la @ de fuera de casa. Con la alineación confirmada manda la marca de la derecha, y con su partido empezado el % ya no sale.', ir: { v: 'equipo' } },
    ],
  },
  {
    v: '0.6.10b', f: '2026-10-30', h: '05:46', t: 'Cada dato, a su sitio',
    cosas: [
      { tipo: 'mejora', d: 'scroll', t: 'Cada dato lleva a su sitio', x: 'Los números que llevan «›» se tocan. En Equipo: el valor te lleva a Beneficio, el puesto a la clasificación, el saldo a las cuentas de Hoy y los jugadores a la plantilla; las casillas bajan a tu once, a lo que pide atención o a cada grupo de cláusulas, y los POR, DEF, MED y DEL de debajo del once, a esos jugadores. En la ficha de un jugador: sus puntos, su cláusula (la tuya o la ficha del rival que lo tiene), su próximo rival y cada partido de su calendario. En la de un rival: su valor y sus movimientos. En la de un club: los puntos, los de tu liga y los libres. Y en Directo, lo que llevas o hiciste en la jornada.' },
    ],
  },
  {
    v: '0.6.10a', f: '2026-10-30', h: '05:17', t: 'El plan, con más cabeza',
    cosas: [
      { tipo: 'mejora', d: 'grafica', t: 'Fichar para revender', x: 'Que uno «se esté frenando» ya no es motivo para no ficharlo si aún le quedan días subiendo: su ficha te dice cuántos y cuánto puede subir en 3 días, y el plan lo tiene en cuenta para revenderlo. Y tener ya a otro en su puesto no es motivo para descartarlo si lo fichas para vender.' },
      { tipo: 'mejora', d: 'grafica', t: 'Los que suben y bajan', x: 'En Equipo, toca la casilla de los que suben y bajan hoy y bajas a la lista: primero los que suben, luego los que bajan, con lo que cambia cada grupo.', ir: { v: 'equipo' } },
      { tipo: 'arreglo', d: 'campo', t: 'Alinear lo que ya tienes', x: 'El plan te pedía alinear un once que ya tenías puesto en LaLiga. Ahora lo mira y, si cambia algo, te dice quién entra y quién sale.' },
      { tipo: 'arreglo', d: 'escudo', t: 'Blindajes sin sentido', x: 'El plan ya no te propone blindar a uno con la cláusula muy por encima de su valor: no hay riesgo. Sale en «Mirado y descartado» con el porqué.' },
      { tipo: 'arreglo', d: 'dinero', t: 'El valor de tu equipo en 7 días', x: 'Arriba en Equipo, lo que ha cambiado en 7 días es lo que han subido o bajado tus jugadores de ahora; antes restaba también a los que vendiste.' },
    ],
  },
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
      { tipo: 'arreglo', d: 'cara', t: 'Otra cuenta en el mismo móvil no ve lo de la anterior', x: 'Si en el mismo móvil o navegador entra otra cuenta de LaLiga, se borra lo de la anterior (su liga, su histórico, sus planes, su chat y sus notas) antes de enseñar nada. Se quedan los ajustes y la clave de la IA. Y «Borrar datos» borra ya también lo de las otras ligas.' },
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
      { para: 'web', tipo: 'mejora', d: 'versiones', t: 'Aviso de versión nueva en la web', x: 'En la web (iPhone y ordenador), cuando sale una versión nueva aparece una banda arriba con «Descargar»: un toque y la tienes, sin esperar a que el navegador suelte la de antes.' },
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
      { tipo: 'mejora', d: 'arreglo', t: 'Copiar los avisos', x: 'Para el dueño: en «Avisos de fallos», un botón copia los que están sin contestar, enteros y con su diagnóstico, para pegarlos en el chat y revisarlos.' },
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
      { tipo: 'arreglo', d: 'camiseta', t: 'Puntos esperados más justos', x: 'A los jugadores de los que aún no se había descargado la ficha se les restaba un 30 % de sus puntos esperados por error, así que fichajes buenos salían como que no entraban en tu once.' },
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
      { tipo: 'mejora', d: 'conexion', t: 'Desde un Android, la app', x: 'Si alguien abre la web desde un móvil Android, lo primero que ve es «Estás en un Android: instala la app», con el botón para descargarla, en vez de que le pida un código. Desde un iPhone se le explica que la primera vez hay que entrar desde un ordenador.' },
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
      { tipo: 'nuevo', d: 'versiones', t: 'Los arreglos llegan solos', x: 'Al abrir la app (y cada rato mientras la usas, y aunque esté cerrada hasta la hora de apertura) mira si hay arreglos nuevos, se los descarga y se los pone sin reinstalar nada: nada más abrirla, al volver a ella o con el botón «Descargar» si estabas en medio de algo. Si un arreglo saliera mal, vuelve sola a la versión de antes.' },
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
      { tipo: 'mejora', d: 'camiseta', t: 'Pantalla de carga nueva', x: 'Al abrir la app sale el logo mientras arranca (se acabó el «0 de 10» que no se movía: eso era la pantalla de arranque, que se quedaba ahí hasta que salía la app). Cuando de verdad hay que descargar toda la liga, la camiseta se llena de rojo con la lista de los 10 pasos: los hechos con ✓, el de ahora girando (con los segundos si tarda) y los que faltan. En el ordenador, la camiseta y el título a la izquierda y los pasos a la derecha.' },
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
      { tipo: 'nuevo', d: 'dinero', t: 'El dinero de cada rival', x: 'Si LaLiga lo da, exacto. Si no, se calcula con todos los movimientos de la liga desde el principio: como empezasteis con lo mismo, su saldo es el tuyo menos lo que has movido tú más lo que ha movido él (compras, ventas, cláusulas, blindajes y premios por jornada). La recompensa diaria no sale en los movimientos, por eso va con un margen. La primera vez la carga tarda un poco más: descarga la actividad entera.', ir: { v: 'rivales' } },
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
      { tipo: 'nuevo', d: 'noche', t: 'Trabaja con la app cerrada', x: 'Cada 3 horas, y unos minutos después de cada cambio de mercado, pone tu liga al día y rehace el plan con la IA.' },
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
    v: '0.0.8', f: '2026-10-20', h: '20:09', t: 'La IA encuentra el camino',
    cosas: [
      { tipo: 'arreglo', d: 'conexion', t: '«Unable to resolve host», resuelto', x: 'Si el DNS del móvil o del wifi no encuentra el servidor de la IA, la app se lo pregunta por https a Cloudflare o a Google.' },
    ],
  },
  {
    v: '0.0.7', f: '2026-10-20', h: '20:05', t: 'Deuda fija y modelos explicados',
    cosas: [
      { tipo: 'mejora', d: 'dinero', t: 'La deuda, siempre al 20 %', x: 'Como en el juego: ya no hay que elegirla en Ajustes.' },
      { tipo: 'mejora', d: 'ia', t: 'Tu clave, explicada', x: 'Ajustes te dice si tu clave funciona y si ha gastado ya el cupo de hoy.' },
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
      { tipo: 'arreglo', d: 'ia', t: 'La IA ya contesta', x: 'Las preguntas a la IA salen por la parte nativa de la app. Antes el navegador de dentro las cortaba con «Failed to fetch».' },
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
      { tipo: 'mejora', d: 'ia', t: 'La IA no se para por el cupo', x: 'Si una versión de la IA gasta su cupo, pasa a otra en vez de pararse.' },
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
