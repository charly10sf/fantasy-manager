import Foundation
import WebKit

/// Sirve la web a la página con un esquema propio, fmapp://app/…, como el appassets de Android: primero lo que AlDia
/// haya bajado para tener la web al día; si no, lo que va dentro de la app (la carpeta web). WKWebView trata el esquema
/// como un sitio seguro (crypto.subtle, módulos, almacenamiento), que con file:// no pasa.
///
/// Todo se contesta en la misma llamada (los archivos son pequeños y están en el móvil), así que no hay tareas a medias
/// que parar.
final class Esquema: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start tarea: WKURLSchemeTask) {
        guard let url = tarea.request.url else {
            tarea.didFailWithError(URLError(.badURL))
            return
        }
        var rel = url.path
        while rel.hasPrefix("/") { rel.removeFirst() }
        if rel.isEmpty { rel = "index.html" }
        var datos: Data?
        if url.host == Principal.host, AlDia.rutaValida(rel) {
            if let bajado = AlDia.servir(rel) { datos = try? Data(contentsOf: bajado) }
            if datos == nil, let dentro = AlDia.dentro { datos = try? Data(contentsOf: dentro.appendingPathComponent(rel)) }
        }
        let cuerpo = datos ?? Data()
        var cab = ["Content-Length": "\(cuerpo.count)", "Cache-Control": "no-cache"]
        cab["Content-Type"] = datos == nil ? "text/plain; charset=utf-8" : AlDia.tipo(rel)
        guard let resp = HTTPURLResponse(url: url, statusCode: datos == nil ? 404 : 200, httpVersion: "HTTP/1.1", headerFields: cab) else {
            tarea.didFailWithError(URLError(.badServerResponse))
            return
        }
        tarea.didReceive(resp)
        tarea.didReceive(cuerpo)
        tarea.didFinish()
    }

    func webView(_ webView: WKWebView, stop tarea: WKURLSchemeTask) {
        // nada: cada petición se contesta entera en start
    }
}
