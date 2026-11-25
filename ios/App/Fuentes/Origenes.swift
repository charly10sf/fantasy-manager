import Foundation
import CryptoKit

/// De dónde baja AlDia la web nueva: lo mismo que Origenes.java. Primero el dominio y, si no se llega a él por la
/// conexión (no conecta, tarda, no encuentra la dirección, https roto…), el respaldo de Cloudflare Pages, con todo el
/// paquete del mismo sitio. Lo que llega pero no vale (HTTP que no es 200, firma mala, demasiado grande) no pasa al
/// respaldo: es un problema del paquete, no de la conexión. La firma Ed25519 se comprueba igual venga de donde venga.
enum Origenes {
    static let dominio = "https://fantasymanagerapp.com/"
    static let respaldo = "https://fantasy-manager-61v.pages.dev/"
    /// los sitios, en orden (el primero es «dominio», los demás «respaldo»); las pruebas lo cambian por un servidor local
    static var lista = [dominio, respaldo]
    static var agente = "FantasyManagerApp"
    /// solo en las pruebas (un servidor local sin https)
    static var sinHttps = false

    /// lo que llega pero no vale: no se prueba en otro sitio
    struct NoVale: Error { let m: String }
    /// no se ha llegado a ningún sitio
    struct SinConexion: Error { let m: String }

    /// un paquete.json con la firma buena y de dónde ha salido
    struct Paquete {
        let base: String
        let nombre: String
        let json: Data
        let fallo: String
        /// se ha tenido que ir al respaldo
        var deRespaldo: Bool { !fallo.isEmpty }
    }

    private static let sesion: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieStorage = nil
        c.httpShouldSetCookies = false
        c.urlCache = nil
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 120
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    static func nombre(_ i: Int) -> String { i == 0 ? "dominio" : "respaldo" }

    /// paquete.json y su firma del primer sitio que conteste; la firma se comprueba con `clave` (32 bytes) antes de
    /// devolverlo. Si ninguno contesta, SinConexion «sin conexión · dominio: … · respaldo: …»
    static func paquete(clave: Data, t: Int64) async throws -> Paquete {
        var fallos: [String] = []
        for (i, base) in lista.enumerated() {
            do {
                let json = try await bajar(base, "paquete.json?t=\(t)", max: 4 << 20)
                let sig = try await bajar(base, "paquete.json.sig?t=\(t)", max: 1024)
                try comprobarFirma(clave: clave, paquete: json, sig: sig)
                return Paquete(base: base, nombre: nombre(i), json: json, fallo: fallos.joined(separator: " · "))
            } catch let e as NoVale {
                throw NoVale(m: "\(nombre(i)): \(e.m)" + (fallos.isEmpty ? "" : " (\(fallos.joined(separator: " · ")))"))
            } catch {
                fallos.append("\(nombre(i)): \(motivo(error))")
            }
        }
        throw SinConexion(m: "sin conexión · " + fallos.joined(separator: " · "))
    }

    /// por qué no se ha llegado a un sitio, corto
    static func motivo(_ e: Error) -> String {
        guard let u = e as? URLError else {
            let m = e.localizedDescription
            return m.count > 30 ? String(m.prefix(30)) + "…" : m
        }
        switch u.code {
        case .timedOut: return "tarda"
        case .cannotConnectToHost, .networkConnectionLost: return "no conecta"
        case .cannotFindHost, .dnsLookupFailed: return "sin dirección"
        case .notConnectedToInternet, .dataNotAllowed: return "sin internet"
        case .secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate, .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid: return "https roto"
        default:
            let m = u.localizedDescription
            return m.count > 30 ? String(m.prefix(30)) + "…" : m
        }
    }

    /// la firma de paquete.json: base64 de 64 bytes, válida con `clave`; si no, NoVale (no se baja nada)
    static func comprobarFirma(clave: Data, paquete: Data, sig: Data) throws {
        let texto = String(decoding: sig, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let firma = Data(base64Encoded: texto), firma.count == 64 else { throw NoVale(m: "paquete con firma ilegible") }
        guard let publica = try? Curve25519.Signing.PublicKey(rawRepresentation: clave), publica.isValidSignature(firma, for: paquete) else {
            throw NoVale(m: "paquete con firma mala")
        }
    }

    /// un archivo del sitio `base`, entero en memoria (como mucho `max` bytes)
    static func bajar(_ base: String, _ rel: String, max: Int) async throws -> Data {
        let corta = rel.components(separatedBy: "?")[0]
        guard let u = URL(string: base + rel) else { throw NoVale(m: "dirección rara: \(corta)") }
        var req = URLRequest(url: u)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.setValue(agente, forHTTPHeaderField: "User-Agent")
        req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        let (datos, resp) = try await sesion.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw NoVale(m: "sin respuesta en \(corta)") }
        if http.statusCode != 200 { throw NoVale(m: "HTTP \(http.statusCode) en \(corta)") }
        if !sinHttps && http.url?.scheme != "https" { throw NoVale(m: "sin https") }
        if datos.count > max { throw NoVale(m: "demasiado grande") }
        return datos
    }
}
