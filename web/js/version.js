// La versión de la app. La Action de Android la lee de aquí para nombrar el APK.
// 0.x mientras esté en pruebas: el número del medio sube con cada tanda de mejoras y el último con los arreglos.
export const VERSION = '0.7.1';

// Lo nuevo de cada versión (lo enseña la app la primera vez que se abre una versión nueva)
export const NOVEDADES = [
  {
    v: '0.7.1',
    cosas: [
      'Gráfica del valor de mercado en la ficha de cada jugador (7 días, 1 mes o 3 meses), con lo que ha subido o bajado y su máximo y mínimo. Si no es tuyo, la app pide su histórico a LaLiga al abrir la ficha',
      'La media de puntos sale con un decimal',
    ],
  },
  {
    v: '0.7.0',
    cosas: [
      'La IA ya no se corta a medias: mientras prepara el plan, la app sigue con internet aunque salgas de ella o se apague la pantalla, y te avisa con una notificación cuando está listo',
      'Si se cae la conexión con Google, espera y vuelve a probar sola en vez de rendirse',
      'Tu once en la pestaña Equipo, como en el Fantasy: césped, cromos con la cara, el nombre y los puntos esperados, el valor o la forma, y el banquillo debajo',
      'El rival cuenta: cada jugador lleva su próximo rival en verde, ámbar o rojo según lo difícil que es, y la ficha enseña sus tres próximos partidos',
      'La IA y la app esperan menos puntos contra el Barça que contra el colista, aunque el jugador sea titular, y miran las rachas de rivales para comprar o vender',
    ],
  },
  {
    v: '0.6.0',
    cosas: [
      'Onces probables de cada equipo (futbolfantasy): cada jugador dice si sale de titular, suplente o fuera, y cuenta para tu once y para la IA',
      'Titulares de prensa de los últimos días (Google Noticias): de tus jugadores, de los candidatos y de las webs de fantasy',
      'Histórico de valor de la API de LaLiga para tus jugadores y los candidatos, sin esperar a acumular días',
      'La IA busca también lo de webs y cuentas especializadas en fantasy y lo que publican los periodistas de cada club',
      'Especular con un colchón: aunque lo comprado baje un 8 %, al venderlo vuelves a positivo',
    ],
  },
  {
    v: '0.5.0',
    cosas: [
      'Dos tipos de fichaje: para tu once o para revender. Cada paso del plan dice cuál es',
      'Especular entre semana: comprar lo que sube aunque no te haga falta, bajando hasta el límite de deuda, y venderlo el día antes de la jornada',
      'Nueva pestaña Mercado → Especular, con el beneficio esperado de cada candidato y cuándo venderlo',
      'Lo que compras para revender queda apuntado y el plan te dice cuándo venderlo (o márcalo tú desde la ficha)',
      'La IA sabe que puede usar la deuda entre semana y que solo hay que empezar la jornada en positivo',
    ],
  },
  {
    v: '0.4.0',
    cosas: [
      'La IA ya funciona: las preguntas a Gemini salen por la parte nativa de la app (el WebView las cortaba)',
      'Posiciones y formaciones gratuitas: el plan solo te ficha jugadores que entren en tu once y tapa antes los huecos',
      'Tu mejor once con las formaciones gratis, cuántos tienes por puesto y si te faltan o te sobran',
      'Cada fichaje dice cuántos puntos por jornada sumaría a tu once',
      'Para vender, primero los suplentes que no juegan',
      'En los movimientos de la liga sale el nombre de quién hace cada cosa',
    ],
  },
  {
    v: '0.3.0',
    cosas: [
      'Tus jugadores en venta con todas sus ofertas (la de LaLiga y las de otros managers): cuánto sacas sobre su valor y si te conviene aceptar o esperar',
      'El plan del día incluye «aceptar la oferta de…» como un paso más, y la IA lo tiene en cuenta',
      'Aviso una hora antes de que caduque la mejor oferta',
      'Las caras se encuadran solas: la app mira cada foto y centra la cabeza en el círculo',
    ],
  },
  {
    v: '0.2.0',
    cosas: [
      'Nueva pestaña Hoy: el plan del día paso a paso (qué vender, a quién clausular, cuánto pujar), con tu saldo después de cada operación',
      'La IA hace el plan sola al abrir la app, lee la forma de cada jugador en las últimas jornadas y sigue el hilo de lo que te recomendó ayer',
      'La IA prueba todos los modelos gratuitos de tu clave y sigue sin búsqueda si se acaba la de Google, en vez de pararse',
      'Las caras de los jugadores se ven bien y con el escudo de su equipo',
      'En los movimientos de la liga sale quién hace cada cosa',
      'Diseño nuevo y el chat como pestaña propia',
    ],
  },
  {
    v: '0.1.0',
    cosas: ['Primera versión'],
  },
];
