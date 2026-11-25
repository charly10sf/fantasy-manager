import XCTest

/// La app en el simulador (.github/workflows/ios.yml). Nadie tiene un iPhone para probarla, así que esto es lo que la
/// mira de verdad: arranca, la web servida por el esquema propio es un sitio seguro y guarda bien, «Entrar» abre la
/// página de LaLiga en la ventana de inicio de sesión del sistema, la liga de ejemplo pinta las 7 pestañas y lo
/// guardado sigue ahí al volver a abrir. La app se abre con «-fmPrueba 1»: enseña por dentro cómo está en una etiqueta
/// invisible (ios/Sonda/Sonda.swift) y aquí se lee. Las capturas quedan en el resultado de la prueba.
final class PruebasUI: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launchArguments = ["-fmPrueba", "1", "-AppleLanguages", "(es)", "-AppleLocale", "es_ES"]
    }

    /* ---------------- lo que cuenta la app ---------------- */

    private func sonda() -> [String: Any] {
        let e = app.staticTexts["fm-sonda"]
        guard e.exists, let d = e.label.data(using: .utf8), let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return [:] }
        return j
    }

    private func texto(_ j: [String: Any]) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: j, options: [.sortedKeys, .prettyPrinted]), let t = String(data: d, encoding: .utf8) else { return "\(j)" }
        return t
    }

    /// espera a que la app cuente lo que se pide; si no llega, falla diciendo lo último que contó
    @discardableResult
    private func esperar(_ que: String, _ segundos: TimeInterval = 45, falla: Bool = true, _ vale: ([String: Any]) -> Bool) -> [String: Any] {
        let fin = Date().addingTimeInterval(segundos)
        var ultimo: [String: Any] = [:]
        while Date() < fin {
            ultimo = sonda()
            if vale(ultimo) { return ultimo }
            Thread.sleep(forTimeInterval: 0.5)
        }
        if falla {
            captura("fallo")
            XCTFail("No ha llegado: \(que). La app cuenta: \(texto(ultimo))")
        }
        return ultimo
    }

    private func captura(_ nombre: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = nombre
        a.lifetime = .keepAlways
        add(a)
    }

    private func apuntar(_ nombre: String, _ j: [String: Any]) {
        let a = XCTAttachment(string: texto(j))
        a.name = nombre
        a.lifetime = .keepAlways
        add(a)
        print("=== \(nombre) ===\n\(texto(j))")
    }

    private func comprobado(_ s: [String: Any]) -> [String: Any] { s["s"] as? [String: Any] ?? [:] }
    private func nativa(_ s: [String: Any]) -> [String: Any] { s["n"] as? [String: Any] ?? [:] }
    private func si(_ x: Any?) -> Bool { (x as? Bool) == true }

    /// un botón de la página por lo que pone
    private func boton(_ rotulo: String) -> XCUIElement {
        let exacto = app.webViews.buttons[rotulo]
        if exacto.waitForExistence(timeout: 15) { return exacto }
        return app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", rotulo)).firstMatch
    }

    /// abre la app y espera a la pantalla de entrar. Si la prueba anterior dejó la entrada a medias, la app pregunta a
    /// los pocos segundos «¿No has vuelto solo?»: se le dice que ahora no
    private func abrirEnEntrar() -> [String: Any] {
        app.launch()
        esperar("la app abierta, con todo comprobado", 90) { (self.si($0["entrar"]) || self.si($0["noVuelto"])) && !self.comprobado($0).isEmpty }
        Thread.sleep(forTimeInterval: 5)
        if si(sonda()["noVuelto"]) { boton("Ahora no").tap() }
        return esperar("la pantalla de entrar", 30) { self.si($0["entrar"]) }
    }

    /* ---------------- las pruebas ---------------- */

    /// arranca y la página servida por fmapp:// es un sitio seguro que guarda bien
    func test1Arranque() {
        let s = abrirEnEntrar()
        apuntar("1-arranque", s)
        captura("1-entrada")
        let c = comprobado(s), n = nativa(s)
        XCTAssertTrue(si(s["puente"]), "sin window.FantasyApp")
        XCTAssertEqual(s["canal"] as? String, "ios")
        XCTAssertTrue(si(s["enApp"]), "la web no se ve dentro de la app")
        XCTAssertEqual(s["errores"] as? Int, 0, "hay errores pintados")
        XCTAssertTrue(si(c["seguro"]), "la página no es un sitio seguro")
        XCTAssertTrue(si(c["subtle"]), "crypto.subtle: \(c["subtle"] ?? "nada")")
        XCTAssertTrue(si(c["modulo"]), "módulos: \(c["modulo"] ?? "nada")")
        XCTAssertTrue(si(c["fetch"]), "fetch: \(c["fetch"] ?? "nada")")
        XCTAssertEqual(c["fetch404"] as? Int, 404, "lo que no existe tiene que dar 404")
        XCTAssertTrue(si(c["ls"]), "localStorage: \(c["ls"] ?? "nada")")
        XCTAssertNotNil(c["idb"] as? [String: Any], "IndexedDB: \(c["idb"] ?? "nada")")
        XCTAssertTrue(si(c["llavero"]), "lo guardado: \(c["llavero"] ?? "nada")")
        XCTAssertEqual(n["llaveroFallo"] as? Int, 0, "el llavero ha fallado")
        XCTAssertEqual(c["margenArriba"] as? Int, 0, "la web no puede quedar debajo de la hora")
        // AlDia ha mirado el paquete publicado: sea lo que sea lo que haya, la firma tiene que haber valido
        let fin = esperar("AlDia mira el paquete publicado", 60, falla: false) { self.nativa($0)["alDia"] != nil }
        apuntar("1-aldia", fin)
        let aldia = nativa(fin)["alDia"] as? String ?? ""
        XCTAssertFalse(aldia.contains("firma"), "AlDia no da por buena la firma del paquete publicado: \(aldia)")
    }

    /// «Entrar» abre la página de LaLiga en la ventana de inicio de sesión del sistema; al cerrarla sin entrar, la app lo dice
    func test2Entrar() {
        _ = abrirEnEntrar()
        let entrar = boton("Entrar con mi cuenta de LaLiga")
        XCTAssertTrue(entrar.exists, "no encuentro el botón de entrar")
        entrar.tap()
        // el iPhone pregunta si la app puede usar laliga.es para iniciar sesión
        let sistema = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for _ in 0..<20 {
            let seguir = sistema.buttons.matching(NSPredicate(format: "label IN %@", ["Continuar", "Continue"])).firstMatch
            if seguir.exists { seguir.tap(); break }
            if si(nativa(sonda())["loginAbierto"]) && app.webViews.count > 1 { break }
            Thread.sleep(forTimeInterval: 0.5)
        }
        let s = esperar("la ventana de entrar abierta con la página de LaLiga") { self.si(self.nativa($0)["loginAbierto"]) }
        XCTAssertEqual(nativa(s)["loginSitio"] as? String, "login.laliga.es")
        // que cargue la página de LaLiga (va por internet)
        Thread.sleep(forTimeInterval: 12)
        captura("2-laliga")
        apuntar("2-entrar", sonda())
        // se cierra sin entrar: la app tiene que enterarse y preguntar qué ha pasado
        let cerrar = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancelar", "Cancel", "Aceptar", "Done", "OK", "Cerrar", "Close"])).firstMatch
        if cerrar.waitForExistence(timeout: 10) {
            cerrar.tap()
            let v = esperar("«¿No has vuelto solo?» al cerrar sin entrar", 20) { self.si($0["noVuelto"]) && !self.si(self.nativa($0)["loginAbierto"]) }
            captura("3-cerrada-sin-entrar")
            apuntar("3-cerrada", v)
        } else {
            apuntar("3-sin-boton-de-cerrar", ["botones": app.buttons.allElementsBoundByIndex.prefix(12).map { $0.label }])
        }
    }

    /// la liga de ejemplo pinta las 7 pestañas, y lo guardado sigue ahí al volver a abrir la app
    func test3Ejemplo() {
        _ = abrirEnEntrar()
        let ejemplo = boton("Ver con una liga de ejemplo")
        XCTAssertTrue(ejemplo.exists, "no encuentro el botón de la liga de ejemplo")
        ejemplo.tap()
        let s = esperar("la liga de ejemplo cargada", 120) { self.si($0["liga"]) && ($0["nav"] as? Int) == 6 && !self.si($0["cargando"]) && ($0["texto"] as? Int ?? 0) > 50 }
        apuntar("4-ejemplo", s)
        let ventana = app.windows.firstMatch.frame
        let abajo = (comprobado(s)["margenAbajo"] as? Double) ?? 34
        let pestanas = ["hoy", "equipo", "directo", "rivales", "mercado", "clubes"]
        let rotulos = ["hoy": "Hoy", "equipo": "Equipo", "directo": "Directo", "rivales": "Rivales", "mercado": "Mercado", "clubes": "Clubes"]
        var orden = Array(pestanas.dropFirst())
        orden.append("hoy")
        for k in orden {
            // la barra de abajo: seis botones iguales a lo ancho, encima de la raya de inicio
            let i = pestanas.firstIndex(of: k)!
            let x = ventana.minX + ventana.width * (CGFloat(i) + 0.5) / 6
            let y = ventana.maxY - CGFloat(abajo) - 30
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
            var v = esperar("la pestaña \(k)", 8, falla: false) { ($0["vista"] as? String) == k }
            if (v["vista"] as? String) != k {
                // por si la barra no está donde se espera: por su nombre
                let todos = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", rotulos[k]!))
                if todos.count > 0 { todos.element(boundBy: todos.count - 1).tap() }
                v = esperar("la pestaña \(k)", 15) { ($0["vista"] as? String) == k }
            }
            v = esperar("la pestaña \(k) pintada", 20) { ($0["vista"] as? String) == k && ($0["texto"] as? Int ?? 0) > 50 }
            XCTAssertEqual(v["errores"] as? Int, 0, "la pestaña \(k) pinta un error")
            Thread.sleep(forTimeInterval: 1)
            captura("5-\(k)")
        }
        // la séptima, Pregunta, va arriba
        let pregunta = boton("Pregunta")
        XCTAssertTrue(pregunta.exists, "no encuentro Pregunta")
        pregunta.tap()
        let p = esperar("la pestaña Pregunta", 20) { ($0["vista"] as? String) == "ia" && ($0["texto"] as? Int ?? 0) > 20 }
        XCTAssertEqual(p["errores"] as? Int, 0, "Pregunta pinta un error")
        Thread.sleep(forTimeInterval: 1)
        captura("5-pregunta")

        // se cierra y se vuelve a abrir: la liga de ejemplo sigue (localStorage) y lo demás que se guardó, también
        app.terminate()
        app.launch()
        let r = esperar("la app abierta otra vez con la liga de ejemplo", 120) { self.si($0["liga"]) && !self.comprobado($0).isEmpty }
        apuntar("6-reabierta", r)
        let c = comprobado(r)
        XCTAssertNotNil(c["lsAntes"] as? String, "localStorage no ha aguantado")
        XCTAssertNotNil((c["idb"] as? [String: Any])?["antes"] as? NSNumber, "IndexedDB no ha aguantado")
        XCTAssertNotNil(c["llaveroAntes"] as? String, "lo guardado en el llavero no ha aguantado")
        captura("6-reabierta")
    }
}
