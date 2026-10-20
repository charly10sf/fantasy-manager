// La versión de la app. La Action de Android la lee de aquí para nombrar el APK.
// 0.x mientras esté en pruebas: el número del medio sube con cada tanda de mejoras y el último con los arreglos.
export const VERSION = '0.4.0';

// Lo nuevo de cada versión (lo enseña la app la primera vez que se abre una versión nueva)
export const NOVEDADES = [
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
