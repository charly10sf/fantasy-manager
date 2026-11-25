/* window.FantasyApp en la app de iOS: la misma interfaz que Puente.java de Android, para que la web (web/js/puente.js)
   no note la diferencia. Principal.swift lo inyecta al empezar cada documento, antes que cualquier script de la página,
   con los datos de ese momento en el lugar de DATOS.

   En Android el puente contesta al momento (es Java llamado desde JS). Aquí lo nativo solo se alcanza con mensajes
   (webkit.messageHandlers.fm), que no devuelven nada, así que:
   - lo que la web lee al momento (leer, version, canal, nativo, web, loginPendiente, respuesta…) sale de una copia en
     JS: la de DATOS al cargar y lo que lo nativo va poniendo después con __pon y __r;
   - lo que la web manda (guardar, http, abrirLogin, copiar…) cambia la copia y sale como mensaje.
   Las respuestas de las peticiones vuelven como en Android: lo nativo deja el resultado y llama a window.__http(id), y
   la web lo recoge con respuesta(id).

   Lo que no puede haber (la IA en segundo plano cada 3 horas: programarFondo, estadoFondo y fondoTerminado) NO se define:
   puente.js mira si cada cosa existe antes de usarla (hayQR, hayFotos, hayVoz…) y, si no, no la ofrece. Lo que depende del
   iPhone solo se define donde lo hay: la alarma del clausulazo (probarAlarma, iOS 26 o más), el lector de QR (escanearQR,
   los iPhone con DataScanner) y el dictado (voz, si el iPhone reconoce el español sin sacar el audio del móvil). */
(function () {
  'use strict';
  if (window.FantasyApp || window.top !== window) return;
  var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.fm;
  if (!mh) return;
  var D = /*DATOS*/{};
  var guardado = D.guardado || {};
  var estado = { web: D.web || null, login: D.login || null, via: D.via || '', avisos: !!D.avisos, privacidad: !!D.privacidad, vista: D.vista !== false };
  var resp = {};
  var tiene = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var txt = function (x) { return x == null ? '' : String(x); };
  function enviar(a, d) {
    var m = d || {};
    m.a = a;
    try { mh.postMessage(m); } catch (e) { /* sin puente: como si no contestara */ }
  }

  var A = {
    /* ---- peticiones (sin CORS, solo a los sitios de la lista de Red.swift) ---- */
    http: function (id, metodo, url, cabeceras, cuerpo) { enviar('http', { id: txt(id), m: txt(metodo), u: txt(url), h: txt(cabeceras), c: txt(cuerpo) }); },
    imagen: function (id, url) { enviar('imagen', { id: txt(id), u: txt(url) }); },
    respuesta: function (id) {
      var r = resp[id];
      delete resp[id];
      return r == null ? '{"s":0,"e":"sin respuesta"}' : r;
    },

    /* ---- la entrada con LaLiga ---- */
    abrirLogin: function (url) { enviar('abrirLogin', { u: txt(url) }); },
    // la vuelta la recoge la propia ventana de entrar: el iPhone no pregunta con qué app abrir (como Auth Tab en Android)
    authTab: function () { return true; },
    loginVia: function () { return estado.via || ''; },
    loginPendiente: function () {
      var l = estado.login;
      estado.login = null;
      if (l) enviar('loginRecogido');
      return l || null;
    },

    /* ---- lo que se guarda en el móvil (el llavero) ---- */
    guardar: function (clave, valor) { guardado[txt(clave)] = txt(valor); enviar('guardar', { k: txt(clave), v: txt(valor) }); },
    leer: function (clave) { return tiene(guardado, clave) ? guardado[clave] : null; },
    borrar: function (clave) { delete guardado[clave]; enviar('borrar', { k: txt(clave) }); },

    /* ---- la versión y la web al día ---- */
    version: function () { return D.version || 0; },
    nombreVersion: function () { return D.nombre || ''; },
    canal: function () { return 'ios'; },
    nativo: function () { return D.nativo || ''; },
    webViva: function () { enviar('webViva'); },
    web: function () { return JSON.stringify(estado.web); },
    buscarWeb: function () { enviar('buscarWeb'); },

    /* ---- varios ---- */
    copiar: function (texto) { enviar('copiar', { t: txt(texto) }); },
    compartir: function (texto) { enviar('compartir', { t: txt(texto) }); },
    compartirImagen: function (datos, texto) {
      var d = txt(datos);
      // lo mismo que mira Android antes de decir que sí: que haya algo y que no pase de 16 MB (en base64, un tercio más)
      if (d.length < 16 || d.length > 22e6) return false;
      enviar('compartirImagen', { d: d, t: txt(texto) });
      return true;
    },
    abrir: function (url) { if (/^https:\/\//.test(txt(url))) enviar('abrir', { u: txt(url) }); },
    toque: function () { enviar('toque'); },
    teclado: function () { enviar('teclado'); },
    trabajando: function (si, texto) { enviar('trabajando', { si: !!si, titulo: '', texto: txt(texto) }); },
    trabajandoCon: function (si, titulo, texto) { enviar('trabajando', { si: !!si, titulo: txt(titulo), texto: txt(texto) }); },
    aLaVista: function () { return estado.vista !== false; },

    /* ---- los avisos (Avisos.swift): la lista de la web, el permiso y los que se ponen al momento ---- */
    programarAvisos: function (json) { enviar('programarAvisos', { j: txt(json) }); },
    avisosPermitidos: function () { return !!estado.avisos; },
    pedirPermisoAvisos: function () { enviar('pedirPermisoAvisos'); },
    // en el iPhone los avisos llegan siempre a su minuto: no hay un permiso aparte, como en Android
    alarmasExactas: function () { return true; },
    pedirAlarmasExactas: function () {},
    notificar: function (titulo, texto, hash) { enviar('notificar', { t: txt(titulo), x: txt(texto), h: txt(hash) }); },

    /* ---- el plan y la pregunta a la IA si sales de la app a medias: avisa el servidor (Empuje, en Avisos.swift) ---- */
    planEnMarcha: function (rid, tk) { enviar('planEnMarcha', { rid: txt(rid), tk: txt(tk) }); },
    planAcabado: function () { enviar('planAcabado'); },
    // (la vuelta de los alias y lo preguntado no salen del móvil ni hacen falta aquí: el aviso con los nombres lo pone
    // la app cuando la respuesta le llega a ella, con el resumen que le pasa la web)
    preguntaEnMarcha: function (rid, tk) { enviar('preguntaEnMarcha', { rid: txt(rid), tk: txt(tk) }); },
    preguntaAcabada: function (ok, resumen) { enviar('preguntaAcabada', { ok: !!ok, r: txt(resumen) }); },

    /* ---- los anuncios (Anuncios.swift): lo mismo que en la app de Google Play ---- */
    hayAnuncios: function () { return true; },
    zonaAnuncios: function (si, bloque, inter) { enviar('zonaAnuncios', { si: !!si, b: txt(bloque), inter: !!inter }); },
    intersticial: function (bloque) { enviar('intersticial', { b: txt(bloque) }); },
    aperturaAnuncios: function (toca, bloque) { enviar('aperturaAnuncios', { toca: !!toca, b: txt(bloque) }); },
    verAnuncio: function (para) { enviar('verAnuncio', { p: txt(para) }); },
    cancelarAnuncio: function () { enviar('cancelarAnuncio'); },
    hayPrivacidadAnuncios: function () { return !!estado.privacidad; },
    privacidadAnuncios: function () { enviar('privacidadAnuncios'); },

    /* ---- (iOS 3) fotos, la versión nueva (Medios.swift y Principal.swift) ---- */
    // fotos o capturas para la IA, con el selector de fotos del iPhone (sin permiso de la galería: solo lo que eliges);
    // llegan con fotosApp([...base64], error), como en Android
    fotos: function (max) { enviar('fotos', { n: Math.max(1, Math.min(4, +max || 1)) }); },
    // la versión nueva de la app está en la App Store: se abre su ficha
    actualizar: function () { enviar('tienda'); },
    instalar: function () { enviar('tienda'); }
  };

  /* lo que usa la parte nativa para contestar (no se enumera: la web no lo ve al recorrer el puente) */
  Object.defineProperty(A, '__r', { value: function (id, json) { resp[id] = json; if (window.__http) window.__http(id); } });
  Object.defineProperty(A, '__pon', { value: function (x) { for (var k in x) if (tiene(x, k)) estado[k] = x[k]; } });

  // la alarma del clausulazo, de prueba: solo donde hay alarmas del sistema (la web la ofrece si existe)
  if (D.alarma) A.probarAlarma = function (seg, titulo, texto) { enviar('probarAlarma', { s: Math.round(+seg) || 10, t: txt(titulo), x: txt(texto) }); };
  // (iOS 3) el QR del ordenador, con la cámara (contesta qrLeido(texto) o qrLeido(null, motivo); null solo: cancelado)
  if (D.qr) A.escanearQR = function () { enviar('escanearQR'); };
  // (iOS 3) dictar la pregunta: el iPhone lo pasa a texto sin sacar el audio del móvil (contesta vozTexto(texto))
  if (D.voz) A.voz = function () { enviar('voz'); };

  window.FantasyApp = A;
})();
