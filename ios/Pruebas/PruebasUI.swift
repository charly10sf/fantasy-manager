import XCTest

/// La app en el simulador (.github/workflows/ios.yml). Nadie tiene un iPhone para probarla, así que esto es lo que la
/// mira de verdad: arranca, la web servida por el esquema propio es un sitio seguro y guarda bien, «Entrar» abre la
/// página de LaLiga en la ventana de inicio de sesión del sistema, la liga de ejemplo pinta las 7 pestañas y lo
/// guardado sigue ahí al volver a abrir. La app se abre con «-fmPrueba 1»: enseña por dentro cómo está en una etiqueta
/// invisible (ios/Sonda/Sonda.swift) y aquí se lee. Las capturas quedan en el resultado de la prueba.
/// (iOS 2) Y además: la pregunta del rastreo, los avisos (el permiso, los 64 que deja el iPhone, uno al momento y tocarlo),
/// la alarma del clausulazo, la pregunta a la IA que acaba con la app fuera, el aviso del servidor (de mentira, con
/// `simctl push` desde ios.yml) y los tres anuncios, con los bloques de prueba de Google.
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

    private func enLinea(_ j: [String: Any]) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: j, options: [.sortedKeys]), let t = String(data: d, encoding: .utf8) else { return "\(j)" }
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
            print("=== FALLO: \(que) === \(enLinea(ultimo))")
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
        print("=== \(nombre) === \(enLinea(j))")
    }

    private func comprobado(_ s: [String: Any]) -> [String: Any] { s["s"] as? [String: Any] ?? [:] }
    private func nativa(_ s: [String: Any]) -> [String: Any] { s["n"] as? [String: Any] ?? [:] }
    private func si(_ x: Any?) -> Bool { (x as? Bool) == true }

    /// un botón de la página por lo que pone
    private func boton(_ rotulo: String) -> XCUIElement {
        let exacto = app.webViews.buttons.matching(NSPredicate(format: "label == %@", rotulo)).firstMatch
        if exacto.waitForExistence(timeout: 15) { return exacto }
        return app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", rotulo)).firstMatch
    }

    private let sistema = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    /// Una pregunta del iPhone (rastreo, notificaciones, alarmas…): si sale en ese rato, se contesta con el primero de
    /// esos botones que haya. Devuelve lo que ponía el botón tocado (o nil si no ha salido)
    @discardableResult
    private func contestar(_ rotulos: [String], _ segundos: TimeInterval, captura nombre: String? = nil) -> String? {
        let fin = Date().addingTimeInterval(segundos)
        repeat {
            for r in rotulos {
                let b = sistema.buttons[r]
                if b.exists {
                    if let nombre { captura(nombre) }
                    b.tap()
                    return r
                }
            }
            Thread.sleep(forTimeInterval: 0.5)
        } while Date() < fin
        return nil
    }

    /// Lo primero que sale al abrir la app por primera vez: el mensaje de Google que explica el permiso de rastreo (con la
    /// app de prueba de Google, la del simulador, sale siempre; tapa la pantalla hasta que se contesta) y, después, la
    /// pregunta del iPhone, con nuestro texto. Se sigue y se dice que no. Las demás veces no sale nada
    private func sinRastreo(_ segundos: TimeInterval = 12) {
        let rastreo = ["Pedir a la app que no rastree", "Ask App Not to Track"]
        let seguir = app.webViews.buttons.matching(NSPredicate(format: "label IN %@", ["Continue", "Continuar"])).firstMatch
        let fin = Date().addingTimeInterval(segundos)
        repeat {
            if seguir.exists {
                captura("0-mensaje-rastreo")
                seguir.tap()
                let r = contestar(rastreo, 20, captura: "0-rastreo")
                print("=== rastreo === mensaje de Google y \(r ?? "sin pregunta del iPhone")")
                return
            }
            if let r = contestar(rastreo, 0.1, captura: "0-rastreo") { print("=== rastreo === \(r)"); return }
            Thread.sleep(forTimeInterval: 0.5)
        } while Date() < fin
    }

    /// busca un aviso del iPhone por lo que pone (en la tira de arriba o, si ya se ha ido, bajando la lista de avisos) y
    /// lo toca. Dice si lo ha encontrado
    private func tocarAviso(_ texto: String, _ segundos: TimeInterval, captura nombre: String) -> Bool {
        let aviso = sistema.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", texto)).firstMatch
        let fin = Date().addingTimeInterval(segundos)
        var bajada = false
        while Date() < fin {
            if aviso.exists && aviso.isHittable {
                captura(nombre)
                aviso.tap()
                return true
            }
            // a mitad del tiempo, si no está a la vista, se baja la lista de avisos
            if !bajada && Date().addingTimeInterval(segundos / 2) > fin {
                bajada = true
                let arriba = sistema.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.0))
                arriba.press(forDuration: 0.1, thenDragTo: sistema.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.85)))
            }
            Thread.sleep(forTimeInterval: 0.4)
        }
        captura("fallo-\(nombre)")
        return false
    }

    /// abre la app con algo que hacer ella sola («-fmHaz», ios/Sonda/Sonda.swift) y espera a que la web haya arrancado
    private func abrirHaciendo(_ que: String) {
        app.launchArguments = ["-fmPrueba", "1", "-AppleLanguages", "(es)", "-AppleLocale", "es_ES", "-fmHaz", que]
        app.launch()
        sinRastreo(4)
        esperar("la app abierta (\(que))", 90) { (self.si($0["entrar"]) || self.si($0["noVuelto"]) || self.si($0["liga"])) && ($0["haz"] as? [String: Any]) != nil }
    }

    private func haz(_ s: [String: Any]) -> [String: Any] { s["haz"] as? [String: Any] ?? [:] }
    private func pasos(_ s: [String: Any]) -> [String] { haz(s)["pasos"] as? [String] ?? [] }
    private func anuncios(_ s: [String: Any]) -> [String: Any] { nativa(s)["anuncios"] as? [String: Any] ?? [:] }

    /// abre la app y espera a la pantalla de entrar. Si la prueba anterior dejó la entrada a medias, la app pregunta a
    /// los pocos segundos «¿No has vuelto solo?»: se le dice que ahora no
    private func abrirEnEntrar() -> [String: Any] {
        app.launch()
        esperar("la app abierta, con todo comprobado", 90) { (self.si($0["entrar"]) || self.si($0["noVuelto"])) && !self.comprobado($0).isEmpty }
        // (la primera vez que se abre, el iPhone pregunta por el rastreo: se dice que no y se sigue)
        sinRastreo(5)
        if si(sonda()["noVuelto"]) { boton("Ahora no").tap() }
        return esperar("la pantalla de entrar", 30) { self.si($0["entrar"]) }
    }

    /* ---------------- las pruebas ---------------- */

    /// arranca y la página servida por fmapp:// es un sitio seguro que guarda bien
    func test1Arranque() {
        app.launch()
        // (iOS 2) lo primero que hace la app al abrirse por primera vez: el consentimiento de los anuncios y, después, la
        // pregunta del rastreo del iPhone, con nuestro texto
        esperar("la app abierta", 90) { self.si($0["entrar"]) || self.si($0["noVuelto"]) }
        sinRastreo(25)
        app.terminate()
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
        let seguir = sistema.buttons.matching(NSPredicate(format: "label IN %@", ["Continuar", "Continue"])).firstMatch
        XCTAssertTrue(seguir.waitForExistence(timeout: 20), "el iPhone no ha preguntado si se puede usar laliga.es para iniciar sesión")
        captura("2-permiso")
        seguir.tap()
        let s = esperar("la ventana de entrar abierta con la página de LaLiga") { self.si(self.nativa($0)["loginAbierto"]) }
        XCTAssertEqual(nativa(s)["loginSitio"] as? String, "login.laliga.es")
        // que cargue la página de LaLiga (va por internet)
        Thread.sleep(forTimeInterval: 12)
        captura("2-laliga")
        apuntar("2-entrar", sonda())
        // se cierra sin entrar: la app tiene que enterarse y preguntar qué ha pasado
        let cerrar = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancelar", "Cancel", "Done", "OK", "Cerrar", "Close"])).firstMatch
        XCTAssertTrue(cerrar.waitForExistence(timeout: 15), "no encuentro cómo cerrar la ventana de entrar. Botones: \(app.buttons.allElementsBoundByIndex.prefix(20).map { $0.label })")
        cerrar.tap()
        let v = esperar("«¿No has vuelto solo?» al cerrar sin entrar", 20) { self.si($0["noVuelto"]) && !self.si(self.nativa($0)["loginAbierto"]) }
        captura("3-cerrada-sin-entrar")
        apuntar("3-cerrada", v)
        boton("Ahora no").tap()
        esperar("la pantalla de entrar otra vez", 15) { self.si($0["entrar"]) }
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
        let pregunta = app.webViews.buttons.matching(NSPredicate(format: "label == %@", "Pregunta")).firstMatch
        XCTAssertTrue(pregunta.waitForExistence(timeout: 15), "no encuentro Pregunta")
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

    /// AlDia de punta a punta contra una web «publicada» de mentira (un servidor local de ios.yml con la web de esta
    /// rama en otra versión, firmada con la clave de verdad): la baja, la pone y sigue ahí al volver a abrir
    func test4AlDia() throws {
        guard let remota = ProcessInfo.processInfo.environment["FM_REMOTA"], !remota.isEmpty else {
            throw XCTSkip("sin la web de mentira firmada (falta el secreto de la firma): AlDia no se prueba de punta a punta")
        }
        app.launchArguments += ["-fmOrigen", remota]
        app.launch()
        // la primera mirada va a los 4 s de cargar: baja la 99.9.9, la web la pone recargando y arranca con ella
        let s = esperar("la web nueva bajada y puesta", 120) {
            (($0["web"] as? [String: Any])?["activa"] as? String) == "99.9.9" && (self.comprobado($0)["versionWeb"] as? String) == "99.9.9" && (self.si($0["entrar"]) || self.si($0["liga"]))
        }
        apuntar("7-aldia-nueva", s)
        XCTAssertEqual(s["errores"] as? Int, 0)
        XCTAssertGreaterThan((s["web"] as? [String: Any])?["archivos"] as? Int ?? 0, 0, "no ha bajado ningún archivo")
        XCTAssertNil((s["web"] as? [String: Any])?["error"], "AlDia cuenta un fallo")
        captura("7-aldia-nueva")
        // al volver a abrir, sigue con la bajada (y la da por buena: no vuelve a la de dentro)
        app.terminate()
        app.launch()
        let r = esperar("la app abierta otra vez con la web bajada", 90) {
            (self.comprobado($0)["versionWeb"] as? String) == "99.9.9" && (self.si($0["entrar"]) || self.si($0["liga"])) && self.nativa($0)["alDia"] != nil
        }
        apuntar("8-aldia-reabierta", r)
        XCTAssertEqual(nativa(r)["alDia"] as? String, "igual", "con la misma web publicada, AlDia tiene que decir que ya la tiene")
        XCTAssertEqual((r["web"] as? [String: Any])?["activa"] as? String, "99.9.9")
    }

    /* ---------------- iOS 2: avisos, el aviso del servidor y anuncios ---------------- */

    /// Los avisos: el permiso (la pregunta del iPhone), la lista de la web (el iPhone guarda 64 como mucho: se programan los
    /// más cercanos), un aviso al momento con la app abierta y, al tocarlo, la app va a su pestaña
    func test5Avisos() {
        abrirHaciendo("avisos")
        // la pregunta de las notificaciones y, en iOS 26, la de las alarmas (la lista lleva un clausulazo)
        let permiso = contestar(["Permitir", "Allow"], 30, captura: "9-permiso-avisos")
        print("=== permiso de avisos === \(permiso ?? "no ha salido la pregunta")")
        var s = esperar("el permiso de notificaciones dado", 20) { self.si($0["permitidos"]) && self.si(self.nativa($0)["avisos"]) }
        if let alarmas = contestar(["Permitir", "Allow", "Continuar", "Continue"], 12, captura: "9-permiso-alarmas") { print("=== permiso de alarmas === \(alarmas)") }
        // 70 avisos, uno diario (14 días), uno ya pasado y un clausulazo: se quedan los 56 más cercanos
        s = esperar("la lista de avisos programada", 40) { (self.nativa($0)["avisosLista"] as? Int ?? 0) >= 56 }
        apuntar("9-avisos", s)
        XCTAssertEqual(nativa(s)["avisosLista"] as? Int, 56, "de la lista de la web se programan los 56 avisos más cercanos")
        XCTAssertLessThanOrEqual(nativa(s)["avisosTodos"] as? Int ?? 99, 64, "el iPhone no guarda más de 64 avisos pendientes")
        XCTAssertTrue(pasos(s).contains("aviso puesto"), "la app no ha llegado a poner el aviso: \(pasos(s))")
        // el aviso al momento sale también con la app abierta; al tocarlo, a su pestaña
        if tocarAviso("Así te llegarán los avisos", 14, captura: "9-aviso") {
            let v = esperar("la app en la pestaña del aviso", 15, falla: false) { ($0["hash"] as? String) == "#mercado" }
            print("=== tocar el aviso === \(v["hash"] ?? "sin hash")")
            XCTAssertEqual(v["hash"] as? String, "#mercado", "tocar un aviso tiene que abrir la app en su pestaña")
        } else {
            print("=== tocar el aviso === no se ha encontrado el aviso en pantalla")
        }
        // el identificador del iPhone para los avisos del servidor (un simulador puede no darlo: se apunta lo que diga)
        apuntar("9-identificador", ["empuje": nativa(sonda())["empuje"] ?? "nada"])
        app.terminate()

        // la alarma del clausulazo, de prueba (iOS 26 o más): se apunta lo que se ve
        abrirHaciendo("alarma")
        let a = esperar("la alarma de prueba pedida", 20, falla: false) { !self.pasos($0).isEmpty }
        print("=== alarma === \(pasos(a)) hayAlarma=\(a["hayAlarma"] ?? "?")")
        if pasos(a).contains("alarma puesta") {
            contestar(["Permitir", "Allow", "Continuar", "Continue"], 6, captura: "9-permiso-alarmas")
            Thread.sleep(forTimeInterval: 9)
            captura("9-alarma")
            // (que no se quede sonando para las pruebas siguientes)
            contestar(["Parar", "Stop", "Detener"], 6)
        }
        app.terminate()
    }

    /// El plan y la pregunta con la app cerrada. (1) Una pregunta a la IA en marcha: al salir de la app, se le dice al
    /// servidor a quién avisar; la respuesta llega con la app aún viva, así que el aviso lo pone la app y al servidor se
    /// le dice que ya no avise; al tocar el aviso, a la pestaña de la IA. (2) El aviso del servidor (de mentira: lo manda
    /// ios.yml con `simctl push` cada pocos segundos): con la app fuera se ve y, al tocarlo, a Hoy
    func test6AvisoDelServidor() {
        abrirHaciendo("pregunta")
        var s = esperar("la pregunta en marcha", 20) { self.pasos($0).contains("en marcha") }
        XCUIDevice.shared.press(.home)
        let visto = tocarAviso("director deportivo", 30, captura: "10-aviso-respuesta")
        XCTAssertTrue(visto, "con la app fuera, al llegar la respuesta tiene que salir el aviso «Tu director deportivo ha contestado»")
        s = esperar("la app en la pestaña de la IA", 20, falla: false) { ($0["hash"] as? String) == "#ia" }
        apuntar("10-respuesta", s)
        XCTAssertEqual(s["hash"] as? String, "#ia", "tocar el aviso de la respuesta tiene que abrir la IA")
        let llamadas = (nativa(s)["empuje"] as? [String: Any])?["llamadas"] as? [String] ?? []
        XCTAssertEqual(llamadas, ["preg:avisar", "preg:quitar"], "al salir se le dice al servidor a quién avisar y, al recibir la app la respuesta, que ya no")
        XCTAssertTrue(pasos(s).contains("acabada"), "la web no ha seguido viva con la app fuera: \(pasos(s))")

        // el aviso del servidor: con la app abierta no se enseña (ya está en pantalla); con la app fuera, sí
        Thread.sleep(forTimeInterval: 8)
        captura("10-abierta-sin-aviso")
        XCUIDevice.shared.press(.home)
        if tocarAviso("Tu plan de hoy está listo", 40, captura: "10-aviso-servidor") {
            let v = esperar("la app en Hoy", 20, falla: false) { ($0["hash"] as? String) == "#hoy" }
            apuntar("10-servidor", v)
            XCTAssertEqual(v["hash"] as? String, "#hoy", "tocar el aviso del plan tiene que abrir Hoy")
        } else {
            print("=== aviso del servidor === no ha salido el aviso de mentira (¿simctl push?)")
        }
        app.terminate()
    }

    /// El anuncio bonificado, con el bloque de prueba de Google: se carga, se enseña y la web recibe la respuesta
    func test7Bonificado() {
        abrirHaciendo("anuncio")
        var s = esperar("AdMob arrancado", 60, falla: false) { self.si(self.anuncios($0)["listo"]) }
        apuntar("11-admob", ["anuncios": anuncios(s), "pasos": pasos(s)])
        XCTAssertTrue(si(anuncios(s)["listo"]), "AdMob no ha arrancado: \(anuncios(s))")
        s = esperar("el bonificado en pantalla", 70, falla: false) { self.si(self.anuncios($0)["enPantalla"]) }
        apuntar("11-bonificado", ["anuncios": anuncios(s), "haz": haz(s)])
        XCTAssertTrue(si(anuncios(s)["enPantalla"]), "el bonificado de prueba no ha salido: \(anuncios(s)) \(haz(s))")
        Thread.sleep(forTimeInterval: 4)
        captura("11-bonificado")
        // a ver si se deja cerrar al acabar (el de prueba dura unos segundos): se apunta lo que conteste la app a la web
        Thread.sleep(forTimeInterval: 32)
        captura("11-bonificado-fin")
        let cerrar = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Cerrar", "Close Ad", "Cerrar anuncio", "Close ad"])).firstMatch
        if cerrar.waitForExistence(timeout: 5) {
            cerrar.tap()
            let fin = esperar("la respuesta del bonificado", 15, falla: false) { self.haz($0)["anuncio"] is [String: Any] }
            apuntar("11-bonificado-visto", ["anuncio": haz(fin)["anuncio"] ?? "sin respuesta"])
        } else {
            print("=== bonificado === no encuentro el botón de cerrar. Botones: \(app.buttons.allElementsBoundByIndex.prefix(12).map { $0.label })")
        }
        app.terminate()
    }

    /// El intersticial y el de apertura, con los bloques de prueba de Google
    func test8IntersticialYApertura() {
        abrirHaciendo("inter")
        var s = esperar("el intersticial en pantalla", 90, falla: false) { self.si(self.anuncios($0)["enPantalla"]) }
        apuntar("12-intersticial", ["anuncios": anuncios(s), "haz": haz(s)])
        if si(anuncios(s)["enPantalla"]) { Thread.sleep(forTimeInterval: 3); captura("12-intersticial") }
        XCTAssertTrue(si(anuncios(s)["enPantalla"]), "el intersticial de prueba no ha salido: \(anuncios(s)) \(haz(s))")
        app.terminate()

        // el de apertura: la primera vez la app apunta que a esta cuenta le toca y lo pide; si llega tarde, queda para la
        // siguiente apertura, en la que ya se pide por adelantado
        for vez in 1...2 {
            abrirHaciendo("apertura")
            s = esperar("el de apertura en pantalla", 45, falla: false) { self.si(self.anuncios($0)["enPantalla"]) }
            apuntar("13-apertura-\(vez)", ["anuncios": anuncios(s), "haz": haz(s)])
            if si(anuncios(s)["enPantalla"]) {
                Thread.sleep(forTimeInterval: 3)
                captura("13-apertura")
                break
            }
            app.terminate()
        }
        print("=== apertura === \(si(anuncios(s)["enPantalla"]) ? "ha salido" : "no ha salido en dos aperturas")")
        app.terminate()
    }
}
