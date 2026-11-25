import Foundation
import Network

/// Las peticiones que la web le pide a la app (http() e imagen() del puente): lo que un navegador no deja hacer desde
/// otra página (la API de LaLiga Fantasy, su inicio de sesión, las webs de datos). Lo mismo que Puente.java y Red.java:
/// solo https, solo a los sitios de `hosts`, sin cookies ni caché, y contesta { s: estado, b: cuerpo, t: tipo } o
/// { s: 0, e: motivo }.
enum Red {
    /// los mismos sitios que Puente.java (HOSTS). Si se cambia allí, cambiarlo aquí
    static let hosts: Set<String> = [
        "fantasy-api.llt-services.com",
        "api-fantasy.llt-services.com",
        "login.laliga.es",
        "www.futbolfantasy.com",
        "raw.githubusercontent.com",
        "fantasymanagerapp.com",
        "generativelanguage.googleapis.com",
        "news.google.com",
        "understat.com",
        "www.understat.com",
        "api.sofascore.com",
        "www.sofascore.com",
        "fantasy-manager.fantasymanager-web-app.workers.dev",
    ]
    private static let lenta = "generativelanguage.googleapis.com"
    private static let maximo = 16 * 1024 * 1024
    private static let maximoImagen = 3 * 1024 * 1024
    /// si la web no dice quién pide, un navegador normal (lo mismo que hace el servidor de la web)
    private static let agente = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

    private static let sesion: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieStorage = nil
        c.httpShouldSetCookies = false
        c.httpCookieAcceptPolicy = .never
        c.urlCache = nil
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 600
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    static func json(_ o: [String: Any]) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) else { return "{\"s\":0,\"e\":\"respuesta ilegible\"}" }
        return s
    }

    private static func fallo(_ m: String) -> String { json(["s": 0, "e": m]) }

    /// por qué no ha llegado, corto y en castellano (la web lo enseña tal cual entre paréntesis)
    static func motivo(_ e: Error) -> String {
        guard let u = e as? URLError else { return e.localizedDescription }
        switch u.code {
        case .timedOut: return "tiempo agotado"
        case .notConnectedToInternet, .dataNotAllowed, .internationalRoamingOff: return "sin conexión a internet"
        case .cannotFindHost, .dnsLookupFailed: return "sin conexión: no se encuentra la dirección"
        case .cannotConnectToHost: return "sin conexión: no conecta"
        case .networkConnectionLost: return "sin conexión: se ha cortado"
        case .secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate, .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid: return "sin conexión segura con el sitio"
        case .cancelled: return "cancelada"
        default: return u.localizedDescription
        }
    }

    private static func esDeDNS(_ e: Error) -> Bool {
        guard let u = e as? URLError else { return false }
        return u.code == .cannotFindHost || u.code == .dnsLookupFailed
    }

    /* ---- la dirección por https, si el DNS del móvil o de la red no la encuentra (un bloqueador, el DNS privado…) ----
       En Android (Red.java) se repite esa petición preguntando a Cloudflare y a Google. Aquí el sistema lo hace para todas
       las conexiones de la app: se enciende al primer fallo de DNS (Cloudflare; si con él tampoco, Google) y, si con
       ninguno sale, se apaga otra vez para dejarlo como estaba. */
    private static let cerrojo = NSLock()
    private static var dns = 0 // 0: el del móvil; 1: Cloudflare; 2: Google

    private static func ponerDNS(_ n: Int) {
        let contexto = NWParameters.PrivacyContext.default
        switch n {
        case 1:
            contexto.requireEncryptedNameResolution(true, fallbackResolver: .https(URL(string: "https://cloudflare-dns.com/dns-query")!, serverAddresses: [
                .hostPort(host: "1.1.1.1", port: 443), .hostPort(host: "1.0.0.1", port: 443),
            ]))
        case 2:
            contexto.requireEncryptedNameResolution(true, fallbackResolver: .https(URL(string: "https://dns.google/dns-query")!, serverAddresses: [
                .hostPort(host: "8.8.8.8", port: 443), .hostPort(host: "8.8.4.4", port: 443),
            ]))
        default:
            contexto.requireEncryptedNameResolution(false, fallbackResolver: nil)
        }
        dns = n
    }

    /// tras un fallo de DNS con el modo `visto`: pasa al siguiente (si otro hilo no lo ha hecho ya) y dice si se repite
    private static func otroDNS(_ visto: Int) -> Bool {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        if dns != visto { return dns != 0 }
        if visto >= 2 { ponerDNS(0); return false }
        ponerDNS(visto + 1)
        return true
    }

    private static func modoDNS() -> Int {
        cerrojo.lock()
        defer { cerrojo.unlock() }
        return dns
    }

    /// Lanza la petición y llama a `fin` (en cualquier hilo) con el JSON de la respuesta
    static func pedir(metodo: String, url: String, cabeceras: String, cuerpo: String, fin: @escaping (String) -> Void) {
        guard let u = URL(string: url), u.scheme == "https", let host = u.host?.lowercased(), hosts.contains(host) else {
            fin(fallo("dirección no permitida: \(URL(string: url)?.host ?? "")"))
            return
        }
        var req = URLRequest(url: u)
        req.httpMethod = metodo.isEmpty ? "GET" : metodo.uppercased()
        // la IA de cada uno puede tardar en contestar; lo demás, 30 s sin recibir nada (el tope de verdad lo pone la web)
        req.timeoutInterval = host == lenta ? 300 : 30
        var conAgente = false
        if !cabeceras.isEmpty, let d = cabeceras.data(using: .utf8), let h = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
            for (k, v) in h {
                req.setValue(v as? String ?? "\(v)", forHTTPHeaderField: k)
                if k.lowercased() == "user-agent" { conAgente = true }
            }
        }
        if !conAgente { req.setValue(agente, forHTTPHeaderField: "User-Agent") }
        if !cuerpo.isEmpty { req.httpBody = Data(cuerpo.utf8) }
        lanzar(req, intentos: 0, fin: fin)
    }

    private static func lanzar(_ req: URLRequest, intentos: Int, fin: @escaping (String) -> Void) {
        let modo = modoDNS()
        sesion.dataTask(with: req) { datos, resp, error in
            if let error {
                if esDeDNS(error), intentos < 2, otroDNS(modo) { lanzar(req, intentos: intentos + 1, fin: fin); return }
                fin(fallo(motivo(error)))
                return
            }
            guard let http = resp as? HTTPURLResponse else { fin(fallo("sin respuesta")); return }
            let d = datos ?? Data()
            if d.count > maximo { fin(fallo("respuesta demasiado grande")); return }
            var r: [String: Any] = ["s": http.statusCode, "b": String(decoding: d, as: UTF8.self)]
            if let t = http.value(forHTTPHeaderField: "Content-Type") { r["t"] = t }
            fin(json(r))
        }.resume()
    }

    /// Una imagen (la foto de un jugador) en base64, para que la web mire dónde está la cara. Cualquier dirección https,
    /// pero solo si lo que llega es una imagen y pesa menos de 3 MB
    static func imagen(url: String, fin: @escaping (String) -> Void) {
        guard let u = URL(string: url), u.scheme == "https" else { fin(fallo("sin https")); return }
        var req = URLRequest(url: u)
        req.timeoutInterval = 15
        req.setValue(agente, forHTTPHeaderField: "User-Agent")
        sesion.dataTask(with: req) { datos, resp, error in
            if let error { fin(fallo(motivo(error))); return }
            guard let http = resp as? HTTPURLResponse, let d = datos else { fin(fallo("sin respuesta")); return }
            let tipo = http.value(forHTTPHeaderField: "Content-Type") ?? ""
            if http.statusCode != 200 || !tipo.hasPrefix("image/") { fin(fallo("no es una imagen (\(http.statusCode))")); return }
            if d.count > maximoImagen { fin(fallo("imagen demasiado grande")); return }
            fin(json(["s": 200, "t": tipo, "b": d.base64EncodedString()]))
        }.resume()
    }
}
