import UIKit
import WebKit

/// Lo que la web puede pedirle a la app: la parte nativa de window.FantasyApp (la de JS es Puente/puente-ios.js, que se
/// inyecta en cada documento con los datos de ese momento). Lo mismo que Puente.java: peticiones, lo guardado en el
/// llavero, la entrada con LaLiga, la web al día, copiar, compartir, abrir fuera, el toque, los avisos (Avisos.swift), el
/// plan y la pregunta con la app cerrada (Empuje, en Avisos.swift) y los anuncios (Anuncios.swift).
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
            // lo que la web lee al momento de los avisos y los anuncios (después, ponerEstadoNativo)
            "avisos": Avisos.yo.permitidos,
            "alarma": Avisos.hayAlarma,
            "privacidad": Anuncios.yo.hayPrivacidad,
            "anuncios": Anuncios.yo.estado(),
            "vista": UIApplication.shared.applicationState != .background,
            // (iOS 3) lo que depende del iPhone: si lee QR con la cámara y si dicta sin sacar el audio del móvil
            "qr": Principal.hayQR,
            "voz": Principal.hayVoz,
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

    /// lo que la web lee al momento y cambia con la app abierta: si hay permiso de notificaciones, si hay que dejar
    /// cambiar el consentimiento de los anuncios y si la app está a la vista
    func ponerEstadoNativo(vista deVuelta: Bool = false) {
        // (al volver a la app el iPhone aún la da por «en segundo plano» un instante: se dice desde fuera)
        let vista = deVuelta || UIApplication.shared.applicationState != .background
        js("window.FantasyApp && window.FantasyApp.__pon({ avisos: \(Avisos.yo.permitidos), privacidad: \(Anuncios.yo.hayPrivacidad), vista: \(vista) })")
        ponerEstadoAnuncios()
    }

    /// (iOS 5, 27 nov) cómo están los anuncios por dentro, para el diagnóstico de la web (estadoAnuncios)
    func ponerEstadoAnuncios() {
        guard let d = try? JSONSerialization.data(withJSONObject: Anuncios.yo.estado()), let j = String(data: d, encoding: .utf8) else { return }
        js("window.FantasyApp && window.FantasyApp.__pon({ anuncios: \(j) })")
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

        /* ---- los avisos ---- */
        case "programarAvisos":
            Avisos.yo.programar(texto("j"))
        case "pedirPermisoAvisos":
            Avisos.yo.pedirPermiso()
        case "notificar":
            Avisos.yo.mostrar("web:" + texto("t"), texto("t"), texto("x"), texto("h"))
        case "probarAlarma":
            Avisos.yo.probarAlarma(m["s"] as? Int ?? 10, texto("t"), texto("x"))

        /* ---- el plan y la pregunta con la app cerrada ---- */
        case "planEnMarcha":
            Empuje.yo.planEnMarcha(texto("rid"), texto("tk"))
        case "planAcabado":
            Empuje.yo.planAcabado()
            if UIApplication.shared.applicationState == .active { Avisos.yo.quitar(Avisos.deListo) }
        case "preguntaEnMarcha":
            Empuje.yo.preguntaEnMarcha(texto("rid"), texto("tk"))
        case "preguntaAcabada":
            preguntaAcabada(m["ok"] as? Bool ?? false, texto("r"))

        /* ---- los anuncios ---- */
        case "zonaAnuncios":
            Anuncios.yo.zona(m["si"] as? Bool ?? false, texto("b"), m["inter"] as? Bool ?? false)
        case "intersticial":
            Anuncios.yo.pedirIntersticial(texto("b"))
        case "aperturaAnuncios":
            Anuncios.yo.apertura(m["toca"] as? Bool ?? false, texto("b"))
        case "verAnuncio":
            Anuncios.yo.ver(texto("p"))
        case "cancelarAnuncio":
            Anuncios.yo.cancelar()
        case "privacidadAnuncios":
            Anuncios.yo.privacidad()

        /* ---- (iOS 3) fotos, QR, dictar y la App Store (Medios.swift) ---- */
        case "fotos":
            elegirFotos(m["n"] as? Int ?? 1)
        case "escanearQR":
            escanearQR()
        case "voz":
            escuchar()
        case "tienda":
            abrirTienda()
        #if DEBUG
        case "fotosPrueba":
            fotosDePrueba()
        #endif
        default:
            break
        }
    }

    /* ---------------- la App Store ---------------- */

    static let tienda = "itms-apps://apps.apple.com/app/id6839220127"
    static let tiendaWeb = "https://apps.apple.com/app/id6839220127"

    /// la ficha de la app en la App Store (para actualizarla); si no se puede abrir la tienda, su página en Safari
    func abrirTienda() {
        guard let u = URL(string: Principal.tienda), let w = URL(string: Principal.tiendaWeb) else { return }
        UIApplication.shared.open(u, options: [:]) { ok in if !ok { UIApplication.shared.open(w, options: [:], completionHandler: nil) } }
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

    /* ---------------- la respuesta de la IA ---------------- */

    /// La respuesta ha llegado a la web (o ha fallado): el servidor ya no tiene que avisar. Con la app fuera de la vista,
    /// el aviso lo pone la app, con el principio de la respuesta ya con los nombres (los mismos textos que Recoger.java)
    private func preguntaAcabada(_ ok: Bool, _ resumen: String) {
        Empuje.yo.preguntaAcabada()
        if UIApplication.shared.applicationState != .background {
            Avisos.yo.quitar(["fm-preg"])
            return
        }
        let r = resumen.trimmingCharacters(in: .whitespacesAndNewlines)
        if ok {
            Avisos.yo.mostrar("fm-preg", "Tu director deportivo ha contestado", r.isEmpty ? "Entra para leer la respuesta" : Principal.corto(r, 230), "ia", hilo: "pregunta")
        } else {
            Avisos.yo.mostrar("fm-preg", "No ha podido contestar", r.isEmpty ? "Entra y vuelve a preguntar" : Principal.corto(r, 200), "ia", hilo: "pregunta")
        }
    }

    static func corto(_ t: String, _ n: Int) -> String {
        if t.count <= n { return t }
        let trozo = String(t.prefix(n - 1))
        if let i = trozo.lastIndex(of: " "), trozo.distance(from: trozo.startIndex, to: i) > n / 2 { return String(trozo[..<i]) + "…" }
        return trozo + "…"
    }

    /* ---------------- mientras la IA trabaja ---------------- */

    /// La IA empieza o termina de trabajar: mientras trabaja, la pantalla no se apaga sola y, si sales de la app, el
    /// sistema le deja un rato más (unos 30 s) para acabar lo que tenía a medias. Lo de avisar cuando acabe con la app
    /// cerrada lo hace el servidor (Empuje, en Avisos.swift)
    private func trabajando(_ si: Bool) {
        // (con la IA trabajando, ningún anuncio encima)
        Anuncios.yo.ocupada = si
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
