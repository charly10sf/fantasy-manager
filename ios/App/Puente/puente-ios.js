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

   Lo que aún no hay en iOS (avisos, anuncios, el plan con la app cerrada, fotos, QR, la alarma) NO se define: puente.js
   mira si cada cosa existe antes de usarla (hayQR, hayFotos, hayAlarma, hayAnuncios…) y, si no, no la ofrece. */
(function () {
  'use strict';
  if (window.FantasyApp || window.top !== window) return;
  var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.fm;
  if (!mh) return;
  var D = /*DATOS*/{};
  var guardado = D.guardado || {};
  var estado = { web: D.web || null, login: D.login || null, via: D.via || '' };
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
    // el dictado propio llega más adelante: mientras, el del teclado del iPhone
    voz: function () { setTimeout(function () { if (window.vozTexto) window.vozTexto(null, 'Para dictar, toca el micrófono del teclado'); }, 0); }
  };

  /* lo que usa la parte nativa para contestar (no se enumera: la web no lo ve al recorrer el puente) */
  Object.defineProperty(A, '__r', { value: function (id, json) { resp[id] = json; if (window.__http) window.__http(id); } });
  Object.defineProperty(A, '__pon', { value: function (x) { for (var k in x) if (tiene(x, k)) estado[k] = x[k]; } });

  window.FantasyApp = A;
})();
