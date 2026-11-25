import Foundation
import CryptoKit

/// La web al día sin reinstalar: lo mismo que AlDia.java de Android.
///
/// La web (web/) va dentro de la app, pero cada vez que cambia se publica también con un paquete.json: la versión, la
/// huella de la parte nativa con la que funciona y la huella sha-256 de cada archivo. Al abrir la app se mira ese
/// paquete.json y, si es para la misma parte de iOS que esta app (el campo «nativoIos»; el «nativo» de siempre es el de
/// Android y aquí no se mira), se bajan solo los archivos que no son iguales que los de dentro, se comprueba la huella
/// de cada uno y se guardan. Desde entonces la app los sirve a ellos en vez de los suyos. Si la parte de iOS ha
/// cambiado no se baja nada: hace falta la app nueva de la App Store. Si la web bajada no llega a arrancar (dos
/// aperturas seguidas, o 20 segundos sin dar señal), se descarta y se vuelve a la de dentro. Con «parar» en el
/// paquete.json se vuelve a la de dentro en todos los móviles.
///
/// paquete.json va firmado con Ed25519 (paquete.json.sig); aquí se comprueba con la misma clave pública que en Android
/// antes de hacer nada con él. Como las huellas de cada archivo salen de ese paquete.json firmado, todo lo bajado queda
/// cubierto por la firma.
enum AlDia {
    /// La clave pública Ed25519 que firma paquete.json: LA MISMA que CLAVE_PAQUETE de AlDia.java (ios.yml comprueba que
    /// coinciden). Si se cambia allí, cambiarla aquí y sacar app nueva.
    static let clavePaquete = "dRa4pAlCCX1c+V4ek6gfNHDty6UhoMsrVCKCl2QRiCc="
    private static let maxArchivo = 8 << 20, maxTotal = 40 << 20
    private static let cerrojo = NSRecursiveLock()
    private static var buscando = false
    /// la web bajada en uso: nil sin mirar todavía; vacío, la de dentro de la app
    private static var enUso: [String: Any]?
    /// cuándo se miró por última vez, cuándo empezó a cargarse la página y cuándo dio señal de vida la web (ms)
    static var ultimaBusqueda: Int64 = 0
    static var cargaT: Int64 = 0
    static var vivaT: Int64 = 0

    static func ahora() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
    /// el número de compilación de esta app
    static var compilacion: Int { Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0 }
    /// la versión de la web con la que se compiló (con su letra: 0.8.4a)
    static var nombreVersion: String { Bundle.main.object(forInfoDictionaryKey: "FMVersion") as? String ?? "" }
    /// la huella de la parte de iOS de esta app (la calcula .github/paquete.py y la pone la compilación)
    static var nativo: String { Bundle.main.object(forInfoDictionaryKey: "FMNativo") as? String ?? "local" }

    private static var prefs: UserDefaults { .standard }
    private static let fm = FileManager.default

    static var raiz: URL {
        fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("web", isDirectory: true)
    }

    /// la web que va dentro de la app
    static var dentro: URL? { Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) }

    private static func leerJSON(_ u: URL) -> [String: Any]? {
        guard let d = try? Data(contentsOf: u), d.count <= 4 << 20 else { return nil }
        return (try? JSONSerialization.jsonObject(with: d)) as? [String: Any]
    }

    /* ---------------- la que está en uso ---------------- */

    /// el paquete.json que va dentro de la app (nil si no lo hay: compilada sin la Action)
    static func propio() -> [String: Any]? {
        guard let d = dentro else { return nil }
        return leerJSON(d.appendingPathComponent("paquete.json"))
    }

    /// la web bajada que se sirve ahora (nil: la de dentro)
    static func activa() -> [String: Any]? {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        if enUso == nil {
            var a: [String: Any] = [:]
            let f = raiz.appendingPathComponent("activa.json")
            if fm.fileExists(atPath: f.path) {
                if let j = leerJSON(f) {
                    // solo vale para esta app: con otra (aunque sea más nueva) se vuelve a mirar desde cero
                    var esCarpeta: ObjCBool = false
                    let dir = j["dir"] as? String ?? "-"
                    let vale = (j["base"] as? Int) == compilacion && (j["nativo"] as? String) == nativo
                        && fm.fileExists(atPath: raiz.appendingPathComponent(dir).path, isDirectory: &esCarpeta) && esCarpeta.boolValue
                    if vale { a = j } else { borrarActiva() }
                } else {
                    borrarActiva()
                }
            }
            enUso = a
        }
        return (enUso ?? [:]).isEmpty ? nil : enUso
    }

    /// el archivo para una ruta de la web, si se ha bajado (si no, nil: el de dentro)
    static func servir(_ rel: String) -> URL? {
        guard rutaValida(rel), let a = activa(), let arch = a["archivos"] as? [String: Any], arch[rel] != nil, let dir = a["dir"] as? String else { return nil }
        let f = raiz.appendingPathComponent(dir, isDirectory: true).appendingPathComponent(rel)
        return fm.fileExists(atPath: f.path) ? f : nil
    }

    static func tipo(_ rel: String) -> String {
        let x = (rel as NSString).pathExtension.lowercased()
        switch x {
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "html": return "text/html; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "webmanifest": return "application/manifest+json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "txt": return "text/plain; charset=utf-8"
        case "pdf": return "application/pdf"
        default: return "application/octet-stream"
        }
    }

    /// solo rutas normales dentro de la web: letras, números, «.», «_», «-» y «/», sin «..» ni ruta absoluta
    static func rutaValida(_ rel: String) -> Bool {
        if rel.isEmpty || rel.count > 200 || rel.hasPrefix("/") { return false }
        if rel.range(of: "^[A-Za-z0-9._/-]+$", options: .regularExpression) == nil { return false }
        for parte in rel.components(separatedBy: "/") where parte.isEmpty || parte == "." || parte == ".." { return false }
        return true
    }

    /* ---------------- que arranque ---------------- */

    /// al abrir la app: si la web bajada lleva dos aperturas sin dar señal de vida, fuera
    static func alAbrir() {
        guard activa() != nil else { return }
        let n = prefs.integer(forKey: "aldia_intentos")
        if n >= 2 { descartar("no arrancaba"); return }
        prefs.set(n + 1, forKey: "aldia_intentos")
    }

    /// la web ha arrancado bien (la llama la propia web en cuanto se ha cargado entera)
    static func viva() {
        vivaT = ahora()
        prefs.set(0, forKey: "aldia_intentos")
    }

    /// ¿la página de ahora sirve una web bajada que no ha dado señal de vida?
    static func sinSenal() -> Bool { activa() != nil && vivaT < cargaT }

    /// vuelve a la web de dentro (y no vuelve a bajar esa misma web si fallaba)
    static func descartar(_ motivo: String?) {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        let a = activa()
        prefs.set(0, forKey: "aldia_intentos")
        if let a, let motivo {
            prefs.set(a["huella"] as? String ?? "", forKey: "aldia_mala")
            prefs.set("descartada la \(a["version"] as? String ?? ""): \(motivo)", forKey: "aldia_error")
        }
        borrarActiva()
        enUso = [:]
    }

    private static func borrarActiva() {
        try? fm.removeItem(at: raiz.appendingPathComponent("activa.json"))
    }

    /* ---------------- buscar la nueva ---------------- */

    private static func empezar() -> Bool {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        if buscando { return false }
        buscando = true
        return true
    }

    private static func terminar() {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        ultimaBusqueda = ahora()
        buscando = false
    }

    /// lo bajado y comprobado pasa a ser la web en uso
    private static func activar(tmp: URL, dir: String, version: String, huella: String, cambiados: [String: String], anterior: String?) throws {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        try fm.moveItem(at: tmp, to: raiz.appendingPathComponent(dir, isDirectory: true))
        let nueva: [String: Any] = [
            "version": version,
            "huella": huella,
            "nativo": nativo,
            "base": compilacion,
            "dir": dir,
            "t": ahora(),
            "archivos": cambiados,
        ]
        let datos = try JSONSerialization.data(withJSONObject: nueva)
        try datos.write(to: raiz.appendingPathComponent("activa.json"), options: .atomic)
        enUso = nueva
        prefs.set(0, forKey: "aldia_intentos")
        prefs.removeObject(forKey: "aldia_error")
        // nada de esto va a la copia de seguridad: se vuelve a bajar
        var r = raiz
        var v = URLResourceValues()
        v.isExcludedFromBackup = true
        try? r.setResourceValues(v)
        // se queda la de ahora y la anterior (la página abierta aún puede pedirle algo); lo demás, fuera
        limpiar(deja: [dir, anterior ?? ""])
    }

    private static func mensaje(_ e: Error) -> String {
        if let n = e as? Origenes.NoVale { return n.m }
        if let s = e as? Origenes.SinConexion { return s.m }
        if e is URLError { return Origenes.motivo(e) }
        return e.localizedDescription
    }

    /// Mira el paquete.json publicado y, si hay web nueva para esta app, la baja y la deja lista para la próxima carga.
    /// Devuelve: «nueva» (bajada), «igual» (ya la tienes), «apk» (hace falta la app nueva), «parada», «ocupada» o
    /// «error: …» (las mismas palabras que en Android: la web ya las entiende).
    static func buscar() async -> String {
        if !empezar() { return "ocupada" }
        defer { terminar() }
        var de: Origenes.Paquete?
        do {
            guard let propio = propio() else { return "igual" }
            Origenes.agente = "FantasyManagerApp/\(compilacion) iOS"
            guard let clave = Data(base64Encoded: clavePaquete) else { throw Origenes.NoVale(m: "clave rara") }
            // del dominio o, si no se llega a él, del respaldo; antes de leerlo siquiera: que lo haya firmado la Action
            let pq = try await Origenes.paquete(clave: clave, t: ahora())
            de = pq
            if pq.deRespaldo { prefs.set("respaldo (\(pq.fallo))", forKey: "aldia_via") } else { prefs.removeObject(forKey: "aldia_via") }
            guard let remoto = (try? JSONSerialization.jsonObject(with: pq.json)) as? [String: Any] else { throw Origenes.NoVale(m: "paquete ilegible") }
            if remoto["parar"] as? Bool == true {
                if activa() != nil { descartar(nil) }
                return "parada"
            }
            let huella = remoto["huella"] as? String ?? ""
            let mala = prefs.string(forKey: "aldia_mala") ?? ""
            // se ha podido mirar: el fallo de la última vez ya no vale (salvo el de una web descartada, que sigue)
            if huella != mala { prefs.removeObject(forKey: "aldia_error") }
            if (remoto["nativoIos"] as? String ?? "") != nativo { return "apk" }
            let ya = activa()
            if let ya, huella == ya["huella"] as? String { return "igual" }
            if huella == propio["huella"] as? String {
                // la app ya trae esa web (o la publicada ha vuelto atrás): fuera la bajada
                if ya != nil { descartar(nil) }
                return "igual"
            }
            if huella == mala { return "igual" }
            guard let ra = remoto["archivos"] as? [String: String] else { throw Origenes.NoVale(m: "paquete sin archivos") }
            let pa = propio["archivos"] as? [String: String] ?? [:]
            let cambiados = ra.filter { pa[$0.key] != $0.value }
            let dir = "v\(ahora())"
            try fm.createDirectory(at: raiz, withIntermediateDirectories: true)
            // lo que quedara a medias de otra vez (sin conexión a mitad), fuera
            for r in (try? fm.contentsOfDirectory(at: raiz, includingPropertiesForKeys: nil)) ?? [] where r.lastPathComponent.hasSuffix(".parte") {
                try? fm.removeItem(at: r)
            }
            let tmp = raiz.appendingPathComponent(dir + ".parte", isDirectory: true)
            try fm.createDirectory(at: tmp, withIntermediateDirectories: true)
            let yaArch = ya?["archivos"] as? [String: String]
            let yaDir = (ya?["dir"] as? String).map { raiz.appendingPathComponent($0, isDirectory: true) }
            var total = 0
            for (k, h) in cambiados {
                guard rutaValida(k), h.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else { throw Origenes.NoVale(m: "ruta rara: \(k)") }
                let dest = tmp.appendingPathComponent(k)
                try fm.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
                // lo que no ha cambiado desde la última que se bajó, se copia de ahí
                if let yaArch, yaArch[k] == h, let viejo = yaDir?.appendingPathComponent(k), fm.fileExists(atPath: viejo.path) {
                    try fm.copyItem(at: viejo, to: dest)
                } else {
                    let d = try await Origenes.bajar(pq.base, "\(k)?v=\(h.prefix(12))", max: maxArchivo)
                    total += d.count
                    try d.write(to: dest)
                }
                if total > maxTotal { throw Origenes.NoVale(m: "demasiado grande") }
                if sha256(dest) != h { throw Origenes.NoVale(m: "no cuadra la huella de \(k)") }
            }
            try activar(tmp: tmp, dir: dir, version: remoto["version"] as? String ?? "", huella: huella, cambiados: cambiados, anterior: ya?["dir"] as? String)
            return "nueva"
        } catch {
            var m = mensaje(error)
            // lo que falla después de elegir sitio, con el sitio delante si ha sido el respaldo
            if let de, de.deRespaldo { m = "respaldo: \(m)" }
            prefs.set(m, forKey: "aldia_error")
            return "error: \(m)"
        }
    }

    /// para el diagnóstico de la web y para saber si hace falta la app nueva (lo mismo que devuelve web() en Android)
    static func estado() -> [String: Any] {
        let a = activa(), p = propio()
        var r: [String: Any] = ["nativo": nativo, "bajada": (a?["t"] as? NSNumber)?.int64Value ?? 0, "archivos": (a?["archivos"] as? [String: Any])?.count ?? 0, "mirada": ultimaBusqueda]
        if let v = p?["version"] as? String { r["propia"] = v }
        if let v = a?["version"] as? String { r["activa"] = v }
        if let e = prefs.string(forKey: "aldia_error") { r["error"] = e }
        if let v = prefs.string(forKey: "aldia_via") { r["via"] = v }
        return r
    }

    /* ---------------- archivos ---------------- */

    private static func limpiar(deja: [String]) {
        for f in (try? fm.contentsOfDirectory(at: raiz, includingPropertiesForKeys: [.isDirectoryKey])) ?? [] {
            let esCarpeta = (try? f.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            if esCarpeta && !deja.contains(f.lastPathComponent) { try? fm.removeItem(at: f) }
        }
    }

    static func sha256(_ f: URL) -> String {
        guard let d = try? Data(contentsOf: f) else { return "" }
        return SHA256.hash(data: d).map { String(format: "%02x", $0) }.joined()
    }
}
