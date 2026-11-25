import XCTest

/// (iOS 6) Las capturas para la ficha de la App Store: la liga de ejemplo, sin caras, escudos ni logo de LaLiga (Carlos,
/// 26 nov; norma 5.2.1), en español y con la barra de estado limpia (la pone ios.yml). No va con las pruebas de siempre:
/// ios.yml la lanza aparte («-only-testing:FantasyManagerPruebas/Tienda») en un iPhone de 6,3" y en uno de 6,9", que son
/// los tamaños que pide hoy App Store Connect. La app se abre con «-fmHaz tienda»: la sonda deja la página en
/// `html.sin-fotos`, lo mismo que hace «sinFotos» de limites.json.
final class Tienda: XCTestCase {
    private let app = XCUIApplication()
    private let sistema = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    override func setUp() {
        continueAfterFailure = false
        app.launchArguments = ["-fmPrueba", "1", "-AppleLanguages", "(es)", "-AppleLocale", "es_ES", "-fmHaz", "tienda"]
    }

    private func sonda() -> [String: Any] {
        let e = app.staticTexts["fm-sonda"]
        guard e.exists, let d = e.label.data(using: .utf8), let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return [:] }
        return j
    }

    @discardableResult
    private func esperar(_ que: String, _ segundos: TimeInterval, _ vale: ([String: Any]) -> Bool) -> [String: Any] {
        let fin = Date().addingTimeInterval(segundos)
        var ultimo: [String: Any] = [:]
        while Date() < fin {
            ultimo = sonda()
            if vale(ultimo) { return ultimo }
            Thread.sleep(forTimeInterval: 0.5)
        }
        captura("fallo")
        XCTFail("No ha llegado: \(que). La app cuenta: \(ultimo)")
        return ultimo
    }

    private func captura(_ nombre: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = nombre
        a.lifetime = .keepAlways
        add(a)
    }

    private func si(_ x: Any?) -> Bool { (x as? Bool) == true }

    private func boton(_ rotulo: String) -> XCUIElement {
        let exacto = app.webViews.buttons.matching(NSPredicate(format: "label == %@", rotulo)).firstMatch
        if exacto.waitForExistence(timeout: 15) { return exacto }
        return app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", rotulo)).firstMatch
    }

    /// el mensaje de Google del rastreo y la pregunta del iPhone, si salen: se dice que no (como en PruebasUI)
    private func sinRastreo(_ segundos: TimeInterval) {
        let rastreo = ["Pedir a la app que no rastree", "Ask App Not to Track"]
        let seguir = app.webViews.buttons.matching(NSPredicate(format: "label IN %@", ["Continue", "Continuar"])).firstMatch
        let fin = Date().addingTimeInterval(segundos)
        var tocado = false
        repeat {
            // (una sola vez: mientras se va, el botón sigue un momento en el árbol y tocarlo otra vez falla)
            if !tocado && seguir.exists && seguir.isHittable { seguir.tap(); tocado = true }
            for r in rastreo where sistema.buttons[r].exists { sistema.buttons[r].tap(); return }
            Thread.sleep(forTimeInterval: 0.5)
        } while Date() < fin
    }

    func testCapturas() {
        app.launch()
        esperar("la app abierta", 90) { self.si($0["entrar"]) || self.si($0["noVuelto"]) || self.si($0["liga"]) }
        sinRastreo(20)
        if si(sonda()["noVuelto"]) { boton("Ahora no").tap() }
        if !si(sonda()["liga"]) {
            boton("Ver con una liga de ejemplo").tap()
        }
        let s = esperar("la liga de ejemplo cargada", 120) { self.si($0["liga"]) && ($0["nav"] as? Int) == 6 && !self.si($0["cargando"]) && ($0["texto"] as? Int ?? 0) > 50 }
        let abajo = ((s["s"] as? [String: Any])?["margenAbajo"] as? Double) ?? 34
        let ventana = app.windows.firstMatch.frame
        let pestanas = ["hoy", "equipo", "directo", "rivales", "mercado", "clubes"]
        // el orden de la ficha: lo que más vende primero
        for (n, k) in ["hoy", "rivales", "mercado", "equipo", "directo"].enumerated() {
            let i = pestanas.firstIndex(of: k)!
            let x = ventana.minX + ventana.width * (CGFloat(i) + 0.5) / 6
            let y = ventana.maxY - CGFloat(abajo) - 30
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
            esperar("la pestaña \(k)", 20) { ($0["vista"] as? String) == k && ($0["texto"] as? Int ?? 0) > 50 }
            Thread.sleep(forTimeInterval: 2.5)
            captura("\(n + 1)-\(k)")
        }
    }
}
