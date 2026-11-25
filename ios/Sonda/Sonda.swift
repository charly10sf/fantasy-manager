#if DEBUG
import UIKit
import WebKit

/// Solo en las compilaciones de prueba (Debug), y solo si la app se abre con «-fmPrueba 1» (lo hace
/// ios/Pruebas/PruebasUI.swift en el simulador): nada de esto va en la app que se publica.
///
/// Como nadie tiene un iPhone para mirar, la app cuenta por dentro cómo está y la prueba lo lee: una etiqueta invisible
/// («fm-sonda») con un JSON que se rehace cada segundo: lo que ve la página (si hay puente, la pestaña abierta, si hay
/// errores pintados), lo que se comprobó al cargar (sitio seguro, crypto.subtle, módulos, fetch, localStorage,
/// IndexedDB y lo que quedaba guardado de la apertura anterior) y lo de la parte nativa (el llavero, la entrada, AlDia).
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
          sesion: !!(window.FantasyApp && window.FantasyApp.leer('sesion')), s: window.__sonda || null
        });
      } catch (e) { return JSON.stringify({ error: String(e) }); }
    })()
    """

    private func mirar() {
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

    func alCargarPruebas() {
        guard dePrueba else { return }
        web.callAsyncJavaScript(Principal.comprobar, arguments: [:], in: nil, in: .page) { [weak self] r in
            if case .failure(let e) = r { self?.sondaNativa["comprobarFallo"] = "\(e)" }
        }
    }
}
#endif
