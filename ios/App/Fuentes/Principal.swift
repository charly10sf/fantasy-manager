import UIKit
import WebKit

/// La pantalla de la app: la web de web/ en un WKWebView, servida por Esquema (fmapp://app/…), con el puente
/// window.FantasyApp (Puente.swift y Puente/puente-ios.js). Lo mismo que Principal.java de Android.
final class Principal: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let fondo = UIColor(red: 10 / 255, green: 10 / 255, blue: 11 / 255, alpha: 1)
    static let esquema = "fmapp"
    static let host = "app"
    static let inicio = "fmapp://app/index.html"
    /// la web publicada: ahí se abren las páginas que no son la app (privacidad, guías…)
    static let dominio = "https://fantasymanagerapp.com/"

    private(set) var web: WKWebView!
    private var cargada = false
    let entrada = Entrada()
    /// la dirección authredirect://… con el código de LaLiga, hasta que la web la recoge
    var loginPendiente: String?
    /// por dónde llegó la última vuelta del inicio de sesión (para el diagnóstico de la web)
    var loginVia = ""
    /// lo que hay que hacer mientras la IA trabaja (Puente.swift)
    var tareaFondo: UIBackgroundTaskIdentifier = .invalid
    /// la pestaña del aviso que se ha tocado, si la página aún no ha cargado
    private var hashPendiente: String?
    #if DEBUG
    var sonda: UILabel?
    var sondaNativa: [String: Any] = [:]
    #endif

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Principal.fondo

        let conf = WKWebViewConfiguration()
        conf.setURLSchemeHandler(Esquema(), forURLScheme: Principal.esquema)
        conf.userContentController.add(self, name: "fm")
        // como en Android: el navegador de siempre y, detrás, la app y su compilación
        conf.applicationNameForUserAgent = "Mobile/15E148 FantasyManagerApp/\(AlDia.compilacion)"
        conf.allowsInlineMediaPlayback = true
        conf.mediaTypesRequiringUserActionForPlayback = .all
        conf.websiteDataStore = .default()

        web = WKWebView(frame: .zero, configuration: conf)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = Principal.fondo
        web.underPageBackgroundColor = Principal.fondo
        web.scrollView.backgroundColor = Principal.fondo
        // la web ya lleva lo suyo para tirar hacia abajo y para los bordes: sin rebote ni huecos puestos por el sistema
        web.scrollView.bounces = false
        web.scrollView.alwaysBounceVertical = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.showsHorizontalScrollIndicator = false
        web.scrollView.showsVerticalScrollIndicator = false
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        #if DEBUG
        web.isInspectable = true
        #endif
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        // arriba, debajo de la hora y la isla (como en Android, donde la web empieza debajo de la barra de estado); abajo,
        // hasta el borde: la web deja ella el hueco de la raya de inicio (env(safe-area-inset-bottom))
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // si la web bajada no arrancó las dos últimas veces, se vuelve a la de dentro
        AlDia.alAbrir()
        Avisos.yo.act = self
        Anuncios.yo.alCrear(self)
        var direccion = Principal.inicio
        // abierta tocando un aviso: en su pestaña
        if let h = Avisos.yo.hashPendiente, !h.isEmpty { direccion += "#" + h }
        Avisos.yo.hashPendiente = nil
        #if DEBUG
        direccion = prepararPruebas(direccion)
        #endif
        ponerGuion()
        web.load(URLRequest(url: URL(string: direccion)!))
    }

    /* ---------------- la página ---------------- */

    /// Ejecuta algo en la web (desde cualquier hilo)
    func js(_ codigo: String) {
        DispatchQueue.main.async { [weak self] in
            self?.web?.evaluateJavaScript(codigo, completionHandler: nil)
        }
    }

    /// un texto como cadena de JavaScript
    static func cadena(_ s: String) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: s, options: .fragmentsAllowed), let t = String(data: d, encoding: .utf8) else { return "\"\"" }
        return t.replacingOccurrences(of: "\u{2028}", with: "\\u2028").replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    }

    func webView(_ webView: WKWebView, decidePolicyFor accion: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = accion.request.url else { decisionHandler(.cancel); return }
        let principal = accion.targetFrame?.isMainFrame ?? true
        if !principal {
            // un marco dentro de la página: lo que pida, menos salirse a otros esquemas
            decisionHandler(["https", "about", "blob", "data", Principal.esquema].contains(url.scheme?.lowercased() ?? "") ? .allow : .cancel)
            return
        }
        if esLaApp(url) {
            // cada documento nuevo (también al recargar) empieza con el puente al día: lo guardado, la web en uso, la vuelta
            ponerGuion()
            decisionHandler(.allow)
            return
        }
        abrirFuera(url)
        decisionHandler(.cancel)
    }

    /// window.open y los enlaces que abren pestaña nueva: fuera de la app
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for accion: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = accion.request.url { abrirFuera(url) }
        return nil
    }

    /// ¿es la página de la app (y no otra página de la web, como la privacidad o una guía)?
    private func esLaApp(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == Principal.esquema, url.host == Principal.host else { return false }
        return url.path.isEmpty || url.path == "/" || url.path == "/index.html"
    }

    /// Lo que no es la app se abre fuera, en Safari (dentro de la app no se navega por internet). Las otras páginas de la
    /// web (privacidad, condiciones, guías), que en Android se abren dentro y se sale de ellas con «atrás», aquí también
    /// van a Safari, desde la web publicada
    func abrirFuera(_ url: URL) {
        let e = url.scheme?.lowercased() ?? ""
        var destino = url
        if e == Principal.esquema {
            guard url.host == Principal.host, var c = URLComponents(string: Principal.dominio) else { return }
            c.path = url.path.hasPrefix("/") ? url.path : "/" + url.path
            c.query = url.query
            c.fragment = url.fragment
            guard let publica = c.url else { return }
            destino = publica
        } else if !["https", "http", "mailto", "tel", "sms"].contains(e) {
            return
        }
        UIApplication.shared.open(destino, options: [:], completionHandler: nil)
    }

    /// lo que hay encima de todo en pantalla (desde ahí se enseña lo siguiente)
    func arriba() -> UIViewController {
        var arriba: UIViewController = self
        while let p = arriba.presentedViewController, !p.isBeingDismissed { arriba = p }
        return arriba
    }

    /// enseña algo encima de lo que haya en pantalla
    func presentar(_ vc: UIViewController) {
        arriba().present(vc, animated: true)
    }

    /// Un aviso abre la app en una pestaña concreta (#mercado, #rivales…), como en Android
    func irA(_ hash: String) {
        if hash.isEmpty { return }
        if cargada { js("location.hash = \(Principal.cadena(hash))") } else { hashPendiente = hash }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        AlDia.cargaT = AlDia.ahora()
        // cada página empieza sin anuncios (al recargar, o al volver a la entrada): hasta que la web nueva diga que su
        // liga está cargada, nada de anuncios encima de la carga
        Anuncios.yo.paginaNueva()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let primera = !cargada
        cargada = true
        entregarLogin()
        if let h = hashPendiente { hashPendiente = nil; irA(h) }
        vigilar()
        if primera {
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in self?.buscarWeb(false) }
        }
        #if DEBUG
        alCargarPruebas()
        #endif
    }

    /// el sistema ha cerrado la página por dentro (falta de memoria con la app en segundo plano): se vuelve a cargar
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        ponerGuion()
        if webView.url != nil { webView.reload() } else { webView.load(URLRequest(url: URL(string: Principal.inicio)!)) }
    }

    /* ---------------- los cuadros de la página (alert, confirm, prompt) ---------------- */

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in completionHandler() })
        presentar(a)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in completionHandler(true) })
        presentar(a)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "Aceptar", style: .default) { [weak a] _ in completionHandler(a?.textFields?.first?.text ?? "") })
        presentar(a)
    }

    /* ---------------- la entrada con LaLiga ---------------- */

    /// La página de LaLiga para entrar, en la ventana de inicio de sesión del sistema. La vuelta se entrega a la web igual
    /// que en Android: loginPendiente y window.vueltaLogin(); si se cerró sin terminar, window.loginCerrado()
    func abrirLogin(_ direccion: String) {
        guard let url = URL(string: direccion), url.scheme?.lowercased() == "https" else { return }
        entrada.abrir(url, en: view.window) { [weak self] vuelta in
            guard let self else { return }
            if let vuelta {
                self.loginPendiente = vuelta
                self.loginVia = "sesion-ios"
                self.entregarLogin()
            } else if self.loginPendiente == nil {
                self.js("window.loginCerrado && loginCerrado()")
            }
            self.js("window.alVolver && alVolver()")
        }
    }

    private func entregarLogin() {
        guard let l = loginPendiente, cargada else { return }
        js("window.FantasyApp && window.FantasyApp.__pon({ login: \(Principal.cadena(l)), via: \(Principal.cadena(loginVia)) }); window.vueltaLogin && window.vueltaLogin()")
    }

    /* ---------------- la web al día ---------------- */

    /// La web bajada tiene 20 segundos para dar señal de vida (webViva); si no, se descarta y se vuelve a cargar la de
    /// dentro. Así un fallo en una web publicada nunca deja la app en blanco.
    private func vigilar() {
        let t0 = AlDia.cargaT
        guard AlDia.activa() != nil else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, AlDia.cargaT == t0, AlDia.sinSenal() else { return }
            AlDia.descartar("no daba señal a los 20 segundos")
            self.ponerGuion()
            self.web.reload()
        }
    }

    /// Mira si hay web nueva publicada y la baja (fuera del hilo de la pantalla). Al acabar se lo dice a la web con
    /// webBuscada(estado): «nueva», «igual», «apk» (hace falta la app nueva), «parada», «ocupada» o «error: …»
    func buscarWeb(_ aunqueReciente: Bool) {
        if !aunqueReciente && AlDia.ahora() - AlDia.ultimaBusqueda < 60000 { return }
        // (AlDia.buscar no es de la pantalla: corre fuera de su hilo y aquí se vuelve a él con el resultado)
        Task { [weak self] in
            let r = await AlDia.buscar()
            self?.buscada(r)
        }
    }

    private func buscada(_ r: String) {
        #if DEBUG
        sondaNativa["alDia"] = r
        sondaNativa["alDiaVeces"] = (sondaNativa["alDiaVeces"] as? Int ?? 0) + 1
        #endif
        ponerEstadoWeb()
        js("window.webBuscada && webBuscada(\(Principal.cadena(r)))")
    }

    /* ---------------- salir y volver ---------------- */

    /// de vuelta a la app (Escena). Con la ventana de entrar abierta no: se avisa cuando se cierre (abrirLogin)
    func alVolver() {
        // (primero, que la web sepa que vuelve a estar a la vista; y los avisos y los anuncios, lo suyo)
        ponerEstadoNativo(vista: true)
        Avisos.yo.alVolver()
        Anuncios.yo.alVolver()
        if entrada.abierta { return }
        js("window.alVolver && alVolver()")
        // de vuelta tras un rato: ¿hay web nueva?
        if cargada && AlDia.ahora() - AlDia.ultimaBusqueda > 20 * 60000 { buscarWeb(false) }
    }

    /// La app sale de la vista (Escena). Si hay un plan o una pregunta a medias, se le dice al servidor a quién avisar
    /// cuando estén: el iPhone congela la app a los pocos segundos
    func alSalir() {
        js("window.FantasyApp && window.FantasyApp.__pon({ vista: false })")
        Anuncios.yo.alPausar()
        Empuje.yo.alSalir()
    }
}
