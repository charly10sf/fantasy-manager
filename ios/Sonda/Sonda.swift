#if DEBUG
import UIKit
import UserNotifications
import WebKit

/// Solo en las compilaciones de prueba (Debug), y solo si la app se abre con «-fmPrueba 1» (lo hace
/// ios/Pruebas/PruebasUI.swift en el simulador): nada de esto va en la app que se publica.
///
/// Como nadie tiene un iPhone para mirar, la app cuenta por dentro cómo está y la prueba lo lee: una etiqueta invisible
/// («fm-sonda») con un JSON que se rehace cada segundo: lo que ve la página (si hay puente, la pestaña abierta, si hay
/// errores pintados), lo que se comprobó al cargar (sitio seguro, crypto.subtle, módulos, fetch, localStorage,
/// IndexedDB y lo que quedaba guardado de la apertura anterior) y lo de la parte nativa (el llavero, la entrada, AlDia,
/// los avisos, los anuncios y el aviso del servidor).
/// Con «-fmHaz <cosa>» la app hace además, ella sola, lo que la prueba no puede hacer desde fuera (llamar al puente):
/// «avisos» (pide el permiso, programa una lista larga y pone un aviso), «pregunta» (una pregunta a la IA en marcha que
/// acaba con la app fuera de la vista), «anuncio» (un bonificado), «inter» (un intersticial) y «apertura» (el de apertura).
extension Principal {
    private var dePrueba: Bool { UserDefaults.standard.bool(forKey: "fmPrueba") }

    /// la dirección con la marca de las pruebas (?prueba=1: sus pasos no cuentan en «Antes de entrar») y, si la prueba
    /// lo pide, AlDia contra un servidor local
    func prepararPruebas(_ direccion: String) -> String {
        guard dePrueba else { return direccion }
        if let o = UserDefaults.standard.string(forKey: "fmOrigen"), !o.isEmpty {
            Origenes.lista = [o]
            Origenes.sinHttps = true
        }
        montarSonda()
        Empuje.yo.tokenDePrueba()
        return direccion + "?prueba=1"
    }

    /// sin el tutorial de la primera vez, la entrada del tema de evento ni el cartel de la etiqueta BETA, que taparían las pestañas
    func ponerGuionPruebas(_ c: WKUserContentController) {
        guard dePrueba else { return }
        c.addUserScript(WKUserScript(source: "try { localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-sin-tema', '1'); localStorage.setItem('fm-beta-aviso', '1'); } catch (e) {}", injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    private func montarSonda() {
        let l = UILabel(frame: CGRect(x: 0, y: 0, width: 60, height: 3))
        l.accessibilityIdentifier = "fm-sonda"
        l.isAccessibilityElement = true
        l.textColor = .clear
        l.backgroundColor = .clear
        l.font = .systemFont(ofSize: 2)
        l.text = "{}"
        view.addSubview(l)
        sonda = l
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            DispatchQueue.main.async { self?.mirar() }
        }
    }

    private static let mirada = """
    (function () {
      try {
        var q = function (s) { return document.querySelector(s); };
        var n = document.querySelectorAll('.nav button[data-ir]');
        var v = document.getElementById('vista');
        var S = window.S || {};
        return JSON.stringify({
          puente: !!window.FantasyApp, canal: window.FantasyApp ? window.FantasyApp.canal() : '', url: location.href,
          enApp: document.documentElement.classList.contains('en-app'), nav: n.length, vista: S.vista || '',
          liga: !!S.D, cargando: !!S.cargando, texto: v ? v.innerText.length : 0,
          errores: document.querySelectorAll('.error-c').length, entrar: !!q('[data-accion="entrar"]'),
          noVuelto: !!q('#pantNoVuelto'), forzar: !!q('#forzar'), hoja: !!S.hoja,
          version: (window.FantasyApp && window.FantasyApp.nombreVersion()) || '', web: window.FantasyApp ? JSON.parse(window.FantasyApp.web()) : null,
          sesion: !!(window.FantasyApp && window.FantasyApp.leer('sesion')), s: window.__sonda || null,
          hash: location.hash, haz: window.__haz || null, permitidos: !!(window.FantasyApp && window.FantasyApp.avisosPermitidos && window.FantasyApp.avisosPermitidos()),
          aLaVista: !!(window.FantasyApp && window.FantasyApp.aLaVista && window.FantasyApp.aLaVista()), hayAlarma: !!(window.FantasyApp && window.FantasyApp.probarAlarma)
        });
      } catch (e) { return JSON.stringify({ error: String(e) }); }
    })()
    """

    /// La etiqueta va en una ventanita propia, por encima de todo: así se sigue leyendo con un anuncio a pantalla
    /// completa delante (que quita de en medio la pantalla de la app)
    private func subirSonda() {
        guard sondaVentana == nil, let l = sonda, let escena = view.window?.windowScene else { return }
        let w = UIWindow(windowScene: escena)
        w.frame = CGRect(x: 0, y: 0, width: 60, height: 3)
        w.windowLevel = .alert + 1
        w.isUserInteractionEnabled = false
        w.backgroundColor = .clear
        let vc = UIViewController()
        vc.view.backgroundColor = .clear
        vc.view.isUserInteractionEnabled = false
        w.rootViewController = vc
        vc.view.addSubview(l)
        w.isHidden = false
        sondaVentana = w
    }

    private func mirar() {
        subirSonda()
        // cuántos avisos tiene programados el iPhone (los de la lista de la web y todos)
        UNUserNotificationCenter.current().getPendingNotificationRequests { [weak self] r in
            let lista = r.filter { $0.identifier.hasPrefix("av:") }.count, todos = r.count
            DispatchQueue.main.async {
                self?.sondaNativa["avisosLista"] = lista
                self?.sondaNativa["avisosTodos"] = todos
            }
        }
        web.evaluateJavaScript(Principal.mirada) { [weak self] r, error in
            guard let self, let l = self.sonda else { return }
            var j: [String: Any] = [:]
            if let t = r as? String, let d = t.data(using: .utf8), let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] { j = o }
            if j["s"] is NSNull, (j["puente"] as? Bool) == true { self.alCargarPruebas() }
            if let error { j["errorJS"] = error.localizedDescription }
            var nativa = self.sondaNativa
            nativa["llaveroFallo"] = Int(Llavero.ultimoFallo)
            nativa["loginAbierto"] = self.entrada.abierta
            nativa["loginSitio"] = self.entrada.ultimaAbierta
            nativa["nativo"] = AlDia.nativo
            nativa["compilacion"] = AlDia.compilacion
            nativa["anuncios"] = Anuncios.yo.estado()
            nativa["empuje"] = Empuje.yo.estado()
            nativa["avisos"] = Avisos.yo.permitidos
            j["n"] = nativa
            if let d = try? JSONSerialization.data(withJSONObject: j, options: [.sortedKeys]), let t = String(data: d, encoding: .utf8) {
                l.text = t
                l.accessibilityLabel = t
            }
        }
    }

    /// lo que se comprueba una vez en cada carga: que la página servida por el esquema propio es un sitio seguro y que
    /// lo que guarda aguanta de una apertura a otra
    private static let comprobar = """
    if (window.__sondaEnMarcha) return 'en marcha';
    window.__sondaEnMarcha = true;
    var r = { seguro: window.isSecureContext === true, origen: location.origin };
    // cada cosa, con su tope: si algo no contesta, se dice cuál y lo demás sigue
    var con = function (p) { return Promise.race([p, new Promise(function (ok) { setTimeout(function () { ok('no contesta'); }, 8000); })]); };
    try { var d = await con(crypto.subtle.digest('SHA-256', new TextEncoder().encode('fm'))); r.subtle = d instanceof ArrayBuffer ? new Uint8Array(d).length === 32 : d; } catch (e) { r.subtle = String(e); }
    try { var m = await con(import(new URL('js/util.js', location.href).href)); r.modulo = typeof m === 'string' ? m : Object.keys(m).length > 0; } catch (e) { r.modulo = String(e); }
    try { var mv = await con(import(new URL('js/version.js', location.href).href)); r.versionWeb = typeof mv === 'string' ? mv : mv.VERSION; } catch (e) { r.versionWeb = String(e); }
    try { r.fetch = await con(fetch('limites.json?t=' + Date.now(), { cache: 'no-store' }).then(function (f) { return f.json().then(function (j) { return f.ok && typeof j === 'object'; }); })); } catch (e) { r.fetch = String(e); }
    try { r.fetch404 = await con(fetch('no-existe.json', { cache: 'no-store' }).then(function (f) { return f.status; })); } catch (e) { r.fetch404 = String(e); }
    try { r.lsAntes = localStorage.getItem('fm-sonda'); localStorage.setItem('fm-sonda', String(Date.now())); r.ls = localStorage.getItem('fm-sonda') !== null; } catch (e) { r.ls = String(e); }
    try {
      r.idb = await con(new Promise(function (ok, mal) {
        var q = indexedDB.open('fm-sonda', 1);
        q.onupgradeneeded = function () { q.result.createObjectStore('s'); };
        q.onerror = function () { mal(q.error); };
        q.onsuccess = function () {
          var db = q.result, tx = db.transaction('s', 'readwrite'), st = tx.objectStore('s'), g = st.get('k');
          g.onsuccess = function () { var antes = g.result === undefined ? null : g.result; st.put(Date.now(), 'k'); tx.oncomplete = function () { db.close(); ok({ antes: antes }); }; };
          tx.onerror = function () { mal(tx.error); };
        };
      }));
    } catch (e) { r.idb = String(e); }
    try { r.llaveroAntes = window.FantasyApp.leer('sonda'); window.FantasyApp.guardar('sonda', String(Date.now())); r.llavero = window.FantasyApp.leer('sonda') !== null; } catch (e) { r.llavero = String(e); }
    try { r.trabajador = await con(new Promise(function (ok) { var w = new Worker(URL.createObjectURL(new Blob(['postMessage(1)'], { type: 'text/javascript' }))); w.onmessage = function () { ok(true); }; w.onerror = function (e) { ok('error'); }; })); } catch (e) { r.trabajador = String(e); }
    try { r.mapa = !!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap')); } catch (e) { r.mapa = String(e); }
    try {
      r.margenAbajo = (function () { var d = document.createElement('div'); d.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:1px'; document.body.appendChild(d); var h = d.offsetHeight; d.remove(); return h; })();
      r.margenArriba = (function () { var d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);width:1px'; document.body.appendChild(d); var h = d.offsetHeight; d.remove(); return h; })();
    } catch (e) { r.margenAbajo = String(e); }
    window.__sonda = r;
    return JSON.stringify(r);
    """

    /// lo que la app hace sola en cada prueba («-fmHaz»), una vez por página y cuando la web ya ha arrancado
    private static let hacer = """
    (function (QUE) {
      if (window.__haz || !window.FantasyApp) return;
      var H = window.__haz = { que: QUE, pasos: [] }, F = window.FantasyApp;
      var paso = function (t) { H.pasos.push(t); };
      var cuando = function (cond, f, cada) { var i = setInterval(function () { try { if (cond()) { clearInterval(i); f(); } } catch (e) { clearInterval(i); paso('error: ' + e); } }, cada || 500); };
      var lista = function () { return !!window.S && typeof window.alVolver === 'function'; };
      if (QUE === 'avisos') cuando(lista, function () {
        F.pedirPermisoAvisos(); paso('permiso pedido');
        cuando(function () { return F.avisosPermitidos(); }, function () {
          var a = Date.now(), l = [];
          for (var i = 0; i < 70; i++) l.push({ id: 'p' + i, t: a + 3600e3 + i * 600e3, titulo: 'Aviso ' + i, texto: 'de prueba', hash: 'mercado' });
          l.push({ id: 'diario', t: a + 1800e3, titulo: 'Tu liga hoy', texto: 'de prueba', hash: '', cada: 86400e3 });
          l.push({ id: 'pasado', t: a - 60e3, titulo: 'Ya pasó', texto: 'no sale', hash: '' });
          l.push({ id: 'clausulazo', t: a + 7200e3, titulo: 'Clausulazo en 1 minuto', texto: 'Pedri, 74,2 M', hash: 'rivales', alarma: true });
          F.programarAvisos(JSON.stringify(l)); paso('lista puesta');
          // (el aviso al momento, varias veces: la tira de arriba dura unos segundos y puede pillar a la prueba contestando
          // a otra pregunta del iPhone; con el mismo título sustituye al anterior)
          var k = 0, poner = function () { F.notificar('Así te llegarán los avisos', 'Por ejemplo: «Ya puedes clausular a Pedri: 74,2 M a Sergio».', 'mercado'); };
          poner(); paso('aviso puesto');
          var i = setInterval(function () { if (k++ > 6 || location.hash === '#mercado') clearInterval(i); else poner(); }, 6000);
        });
      });
      if (QUE === 'alarma') cuando(lista, function () {
        if (!F.probarAlarma) { paso('sin alarma'); return; }
        F.probarAlarma(6, 'Así suena la alarma del clausulazo', 'Te llega 1 minuto antes de que se abra la cláusula que manda tu plan.'); paso('alarma puesta');
      });
      if (QUE === 'pregunta') cuando(lista, function () {
        F.trabajando(true, 'prueba'); F.preguntaEnMarcha('pregsim00001', 'sesion-de-prueba-0123456789abcdef'); paso('en marcha');
        cuando(function () { return !F.aLaVista(); }, function () {
          paso('fuera');
          setTimeout(function () { F.preguntaAcabada(true, 'Vende a Pedri: está en su pico.'); F.trabajando(false); paso('acabada'); }, 2500);
        }, 300);
      });
      if (QUE === 'anuncio') cuando(lista, function () {
        window.anuncioVisto = function (p, v, m) { H.anuncio = { para: p, visto: v, motivo: m }; };
        var n = 0, pedir = function () { n++; H.anuncio = null; F.verAnuncio('prueba'); paso('pedido ' + n); };
        pedir();
        // (si AdMob aún no había arrancado contesta que no hay anuncio: se pide otra vez, hasta 8)
        setInterval(function () { if (H.anuncio && !H.anuncio.visto && H.anuncio.motivo !== 'cerrado antes de tiempo' && n < 8) pedir(); }, 5000);
      });
      if (QUE === 'inter') cuando(lista, function () {
        window.intersticialVisto = function (ok, m) { H.inter = { ok: ok, motivo: m }; };
        var n = 0, i = setInterval(function () {
          if ((H.inter && H.inter.ok) || n++ > 25) { clearInterval(i); return; }
          F.zonaAnuncios(true, '', true); F.intersticial('');
        }, 3000);
        paso('pidiendo');
      });
      if (QUE === 'apertura') cuando(lista, function () {
        window.aperturaVista = function (ok, m) { H.apertura = { ok: ok, motivo: m }; };
        // (unos segundos después de cargar, como cuando acaba de cargar la liga)
        setTimeout(function () { F.zonaAnuncios(true, '', true); F.aperturaAnuncios(true, ''); paso('le toca'); }, 9000);
      });
    })
    """

    func alCargarPruebas() {
        guard dePrueba else { return }
        if let que = UserDefaults.standard.string(forKey: "fmHaz"), !que.isEmpty {
            web.evaluateJavaScript("\(Principal.hacer)(\(Principal.cadena(que)))", completionHandler: nil)
        }
        web.callAsyncJavaScript(Principal.comprobar, arguments: [:], in: nil, in: .page) { [weak self] r in
            if case .failure(let e) = r { self?.sondaNativa["comprobarFallo"] = "\(e)" }
        }
    }
}
#endif
