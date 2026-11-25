import UIKit
import WebKit

/// Lo que la web puede pedirle a la app: la parte nativa de window.FantasyApp (la de JS es Puente/puente-ios.js, que se
/// inyecta en cada documento con los datos de ese momento). Lo mismo que Puente.java, con lo de esta sesión: peticiones,
/// lo guardado en el llavero, la entrada con LaLiga, la web al día, copiar, compartir, abrir fuera y el toque.
extension Principal: WKScriptMessageHandler {
    /// el JS del puente, con lo que la web lee al momento: lo guardado, la versión, la huella y la vuelta pendiente
    private func guion() -> String {
        guard let u = Bundle.main.url(forResource: "puente-ios", withExtension: "js"), let base = try? String(contentsOf: u, encoding: .utf8) else { return "" }
        var datos: [String: Any] = [
            "guardado": Llavero.todo(),
            "version": AlDia.compilacion,
            "nombre": AlDia.nombreVersion,
            "nativo": AlDia.nativo,
            "web": AlDia.estado(),
            "via": loginVia,
        ]
        if let l = loginPendiente { datos["login"] = l }
        guard let d = try? JSONSerialization.data(withJSONObject: datos), var j = String(data: d, encoding: .utf8) else { return base }
        j = j.replacingOccurrences(of: "\u{2028}", with: "\\u2028").replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        return base.replacingOccurrences(of: "/*DATOS*/{}", with: j)
    }

    /// Deja el puente listo para el próximo documento que se cargue. Se llama antes de cada carga (también al recargar):
    /// así la página nueva empieza con lo que haya guardado la anterior
    func ponerGuion() {
        let c = web.configuration.userContentController
        c.removeAllUserScripts()
        c.addUserScript(WKUserScript(source: guion(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #if DEBUG
        ponerGuionPruebas(c)
        #endif
    }

    /// el estado de la web al día, a la página que está abierta (lo lee con web())
    func ponerEstadoWeb() {
        guard let d = try? JSONSerialization.data(withJSONObject: AlDia.estado()), let j = String(data: d, encoding: .utf8) else { return }
        js("window.FantasyApp && window.FantasyApp.__pon({ web: \(j) })")
    }

    /// la respuesta de una petición: se deja en la página y se la avisa con __http(id), como en Android
    private func responder(_ id: String, _ json: String) {
        DispatchQueue.main.async { [weak self] in
            self?.web?.callAsyncJavaScript("window.FantasyApp && window.FantasyApp.__r(id, r);", arguments: ["id": id, "r": json], in: nil, in: .page, completionHandler: nil)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // solo la página de la app, nunca un marco de otro sitio
        let origen = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origen.protocol == Principal.esquema, origen.host == Principal.host else { return }
        guard let m = message.body as? [String: Any], let a = m["a"] as? String else { return }
        let texto = { (k: String) -> String in m[k] as? String ?? "" }
        switch a {
        case "http":
            let id = texto("id")
            Red.pedir(metodo: texto("m"), url: texto("u"), cabeceras: texto("h"), cuerpo: texto("c")) { [weak self] r in self?.responder(id, r) }
        case "imagen":
            let id = texto("id")
            Red.imagen(url: texto("u")) { [weak self] r in self?.responder(id, r) }
        case "guardar":
            if !texto("k").isEmpty { Llavero.guardar(texto("k"), texto("v")) }
        case "borrar":
            if !texto("k").isEmpty { Llavero.borrar(texto("k")) }
        case "abrirLogin":
            abrirLogin(texto("u"))
        case "loginRecogido":
            loginPendiente = nil
        case "webViva":
            AlDia.viva()
        case "buscarWeb":
            buscarWeb(true)
        case "copiar":
            UIPasteboard.general.string = texto("t")
        case "compartir":
            compartir([texto("t")])
        case "compartirImagen":
            compartirImagen(texto("d"), texto("t"))
        case "abrir":
            if let u = URL(string: texto("u")), u.scheme?.lowercased() == "https" { abrirFuera(u) }
        case "toque":
            UISelectionFeedbackGenerator().selectionChanged()
        case "teclado":
            if !web.isFirstResponder { web.becomeFirstResponder() }
        case "trabajando":
            trabajando(m["si"] as? Bool ?? false)
        default:
            break
        }
    }

    /* ---------------- compartir ---------------- */

    private func compartir(_ cosas: [Any]) {
        let hoja = UIActivityViewController(activityItems: cosas, applicationActivities: nil)
        // (en un iPad, la hoja sale de un punto: el centro de abajo de la pantalla)
        hoja.popoverPresentationController?.sourceView = view
        hoja.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 40, width: 1, height: 1)
        presentar(hoja)
    }

    /// una tarjeta (un PNG que dibuja la web, en base64 o como data:image/png;base64,…) con la app que elijas
    private func compartirImagen(_ datos: String, _ texto: String) {
        var b64 = datos
        if datos.hasPrefix("data:"), let coma = datos.firstIndex(of: ",") { b64 = String(datos[datos.index(after: coma)...]) }
        guard let png = Data(base64Encoded: b64, options: .ignoreUnknownCharacters), png.count >= 8 else {
            if !texto.isEmpty { compartir([texto]) }
            return
        }
        // como archivo, para que la hoja de compartir enseñe la imagen y las apps la reciban con nombre
        let f = FileManager.default.temporaryDirectory.appendingPathComponent("fantasy-manager.png")
        do {
            try png.write(to: f, options: .atomic)
            compartir(texto.isEmpty ? [f] : [f, texto])
        } catch {
            if let img = UIImage(data: png) { compartir(texto.isEmpty ? [img] : [img, texto]) }
        }
    }

    /* ---------------- mientras la IA trabaja ---------------- */

    /// La IA empieza o termina de trabajar: mientras trabaja, la pantalla no se apaga sola y, si sales de la app, el
    /// sistema le deja un rato más (unos 30 s) para acabar lo que tenía a medias. Lo de avisar cuando acabe con la app
    /// cerrada llega con los avisos (más adelante)
    private func trabajando(_ si: Bool) {
        UIApplication.shared.isIdleTimerDisabled = si
        if si {
            if tareaFondo != .invalid { return }
            tareaFondo = UIApplication.shared.beginBackgroundTask(withName: "ia") { [weak self] in self?.soltarFondo() }
        } else {
            soltarFondo()
        }
    }

    private func soltarFondo() {
        if tareaFondo == .invalid { return }
        UIApplication.shared.endBackgroundTask(tareaFondo)
        tareaFondo = .invalid
    }
}
