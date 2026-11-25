import AppTrackingTransparency
import GoogleMobileAds
import UIKit
import UserMessagingPlatform

/// Los anuncios de la app de iOS (AdMob). Lo mismo que Anuncios.java de la versión de Google Play, con las mismas
/// reglas, y lo que solo hay en el iPhone (el permiso de rastreo):
/// - Al abrir la app, por este orden (el que pide Google): el consentimiento de la UE (UMP), después el permiso de
///   rastreo del iPhone (solo si no se ha dicho que no en el anterior) y, con eso, AdMob. Sin consentimiento no se pide
///   ningún anuncio. El consentimiento se cambia desde Ajustes («Privacidad de los anuncios»).
/// - Sin banner. Un intersticial que la web pide solo en una pausa natural y con sus tiempos (intersticial.js y
///   «intersticial» de limites.json); aquí se vuelve a comprobar lo que solo sabe la app: a la vista, sin teclado, sin la
///   IA trabajando, sin otro anuncio en pantalla o recién visto y con un mínimo de minutos desde el anterior.
/// - Anuncios solo con la sesión de la liga iniciada: hasta la primera vez que la web dice zona(true) no se carga ni se
///   precarga nada (salvo un bonificado que el usuario pida con un botón).
/// - Un bonificado para lo que la web quiera desbloquear: la web recibe anuncioVisto(para, visto, motivo) pase lo que pase.
/// - Uno de apertura al día como mucho: la web dice con apertura(toca, bloque) si a esta cuenta le toca hoy, y aquí solo
///   se enseña al abrir la app (en cuanto su liga está cargada) o al volver tras media hora fuera.
/// Los bloques de anuncios van en Info.plist (los pone project.yml: los de prueba de Google en las compilaciones de
/// prueba y los de verdad en la que se publica); si faltaran, valen los de la web («bloqueIos» de limites.json).
@MainActor
final class Anuncios: NSObject, FullScreenContentDelegate {
    static let yo = Anuncios()

    /// un anuncio cargado caduca (Google dice una hora): se pide otro pasados 50 minutos
    private static let caduca: TimeInterval = 50 * 60
    /// el suelo de la app entre dos intersticiales, diga lo que diga la web
    private static let entreIntersticiales: TimeInterval = 3 * 60
    /// ni un intersticial en el minuto después de cerrar un bonificado
    private static let trasBonificado: TimeInterval = 60
    /// el tope de la app al día, por si la web fallara
    private static let topeDia = 10
    /// el bloque de la web solo vale si es de la cuenta de AdMob de Fantasy Manager
    private static let cuenta = "ca-app-pub-3175956326240112/"
    /// el de apertura: Google dice que dura 4 horas cargado
    private static let caducaApertura: TimeInterval = 4 * 3600 - 10 * 60
    private static let ventanaApertura: TimeInterval = 12
    /// al abrir la app: lo que se espera a que la liga cargue y, cargada, a que llegue el anuncio
    private static let esperaLiga: TimeInterval = 2 * 60
    private static let trasLiga: TimeInterval = 5
    /// se pide por adelantado solo si la web dijo que a esta cuenta le tocaba en los últimos días
    private static let previstaDias: TimeInterval = 4 * 86400
    private static let otraSesion: TimeInterval = 30 * 60
    private static let pToca = "ap_toca", pVisto = "ap_visto"

    private weak var act: Principal?
    private var pidiendo = false, pidiendoRastreo = false
    /// lo que hay que hacer cuando se conteste a la pregunta del rastreo
    private var rastreoPendiente: (() -> Void)?
    /// iniciado: ya se ha llamado a AdMob; listo: AdMob ya ha arrancado
    private(set) var iniciado = false
    private(set) var listo = false
    /// activado: la web ya ha dicho alguna vez que su liga está cargada; quiere: lo dice ahora;
    /// conIntersticiales: a esta cuenta le tocan
    private var activado = false, quiere = false, conIntersticiales = false
    private var teclado = false
    /// la IA está trabajando (el plan o una pregunta): ningún anuncio encima
    var ocupada = false

    private var bonificado: RewardedAd?
    private var bonificadoT: TimeInterval = 0, bonificadoFin: TimeInterval = 0
    private var cargandoBonificado = false
    /// lo que espera al bonificado que se está cargando
    private var pendiente: String?
    /// el bonificado en pantalla: para qué es y si ya se ha ganado el premio
    private var ensenando: (ad: RewardedAd, para: String, premio: Bool)?

    private var intersticial: InterstitialAd?
    private var intersticialT: TimeInterval = 0, ultimoIntersticial: TimeInterval = 0, esperaHasta: TimeInterval = 0
    private var cargandoIntersticial = false
    private var ensenandoIntersticial: InterstitialAd?
    private var fallosIntersticial = 0, hoyN = 0, hoyDia = 0
    private var bloqueWeb = ""

    private var apertura: AppOpenAd?
    private var aperturaT: TimeInterval = 0, momentoHasta: TimeInterval = 0, pausadoDesde: TimeInterval = 0, esperaAperturaHasta: TimeInterval = 0
    private var aperturaDia = -1
    private var cargandoApertura = false, aperturaToca = false, abriendo = false, aperturaPrevista = false
    private var ensenandoApertura: AppOpenAd?
    private var fallosApertura = 0
    private var bloqueAperturaWeb = ""
    /// lo último que ha fallado al cargar, para el diagnóstico de las pruebas
    private(set) var ultimoFallo = ""

    /// ¿se pueden pedir anuncios? Lo dice el consentimiento. Solo en las pruebas del simulador (con la app y los bloques de
    /// prueba de Google, que no tienen mensaje de consentimiento que enseñar), si el consentimiento da error se sigue
    private var puede: Bool {
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "fmPrueba") && consentimientoFallo { return true }
        #endif
        return ConsentInformation.shared.canRequestAds
    }
    private var consentimientoFallo = false

    private static func ahora() -> TimeInterval { Date().timeIntervalSince1970 }
    private static func bloqueDe(_ clave: String) -> String {
        let b = (Bundle.main.object(forInfoDictionaryKey: clave) as? String) ?? ""
        return valido(b) ? b : ""
    }
    private static func valido(_ b: String) -> Bool { b.range(of: "^ca-app-pub-\\d{16}/\\d{10}$", options: .regularExpression) != nil }
    private static func deLaCuenta(_ b: String) -> Bool { b.hasPrefix(cuenta) && valido(b) }

    /* ---------------- al abrir: el consentimiento, el permiso de rastreo y AdMob ---------------- */

    /// al abrir la app
    func alCrear(_ a: Principal) {
        NotificationCenter.default.removeObserver(self)
        act = a
        // abrir la app: el momento del anuncio de apertura (si a esta cuenta le toca hoy), que dura hasta que la liga
        // está cargada y unos segundos más; y si ya se sabe que le tocará, se pide en cuanto AdMob arranque
        abriendo = true
        momentoHasta = Anuncios.ahora() + Anuncios.esperaLiga
        aperturaPrevista = prevista()
        quiere = false
        activado = false
        NotificationCenter.default.addObserver(self, selector: #selector(tecladoFuera), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(tecladoDentro), name: UIResponder.keyboardDidHideNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(alActivarse), name: UIApplication.didBecomeActiveNotification, object: nil)
        pedirConsentimiento()
    }

    @objc private func tecladoFuera() { teclado = true }
    @objc private func tecladoDentro() { teclado = false }

    private func pedirConsentimiento() {
        guard let a = act, !pidiendo else { return }
        pidiendo = true
        let p = RequestParameters()
        #if DEBUG
        // en las pruebas del simulador se puede pedir como si se estuviera en la UE (los simuladores ya son de prueba)
        if UserDefaults.standard.bool(forKey: "fmUE") {
            let d = DebugSettings()
            d.geography = .EEA
            p.debugSettings = d
        }
        #endif
        ConsentInformation.shared.requestConsentInfoUpdate(with: p) { [weak self, weak a] error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.pidiendo = false
                // (la web lee al momento si hay que dejar cambiar el consentimiento desde Ajustes)
                self.act?.ponerEstadoNativo()
                if let error {
                    self.ultimoFallo = "consentimiento: \(error.localizedDescription)"
                    self.consentimientoFallo = true
                    self.seguir()
                    return
                }
                guard let a, a === self.act else { return }
                ConsentForm.loadAndPresentIfRequired(from: a) { [weak self] error in
                    DispatchQueue.main.async {
                        if let error { self?.ultimoFallo = "formulario: \(error.localizedDescription)" }
                        self?.seguir()
                    }
                }
            }
        }
        // si ya lo dio otra vez, no hace falta esperar a que conteste
        if puede { seguir() }
    }

    /// con el consentimiento ya resuelto: el permiso de rastreo (si toca) y AdMob
    private func seguir() {
        guard !iniciado, puede else { return }
        pedirRastreo { [weak self] in self?.empezar() }
    }

    /// ¿se puede preguntar por el rastreo? Solo si en el consentimiento de la UE no se ha dicho que no a guardar datos en
    /// el dispositivo (finalidad 1): quien acaba de decir que no, no recibe otra pregunta por lo mismo
    private func rastreoSePuedePedir() -> Bool {
        if ConsentInformation.shared.consentStatus != .obtained { return true }
        guard let f = UserDefaults.standard.string(forKey: "IABTCF_PurposeConsents"), !f.isEmpty else { return true }
        return f.hasPrefix("1")
    }

    /// El permiso de rastreo del iPhone (ATT), una sola vez y después del consentimiento. Si Google ya lo ha preguntado
    /// dentro de su formulario (mensaje del IDFA de AdMob), aquí ya está contestado y no se pregunta otra vez. La
    /// pregunta solo sale con la app a la vista: si no lo está, se espera a que lo esté
    private func pedirRastreo(_ luego: @escaping () -> Void) {
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined, rastreoSePuedePedir() else { luego(); return }
        if pidiendoRastreo { return }
        pidiendoRastreo = true
        rastreoPendiente = luego
        // (si no está a la vista, se pregunta al estarlo: alActivarse)
        if UIApplication.shared.applicationState == .active { preguntarRastreo() }
    }

    @objc private func alActivarse() {
        guard rastreoPendiente != nil else { return }
        // (un momento después: recién activa, el iPhone aún puede no enseñar la pregunta)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in self?.preguntarRastreo() }
    }

    private func preguntarRastreo() {
        guard let luego = rastreoPendiente else { return }
        rastreoPendiente = nil
        ATTrackingManager.requestTrackingAuthorization { [weak self] _ in
            DispatchQueue.main.async {
                self?.pidiendoRastreo = false
                luego()
            }
        }
    }

    private func empezar() {
        guard act != nil, !iniciado, puede else { return }
        iniciado = true
        MobileAds.shared.start { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.listo = true
                // si la web ya lo había dicho mientras AdMob arrancaba; si no, se espera a su zona(true)
                if self.activado {
                    self.cargarIntersticial()
                    self.cargarBonificado()
                }
                // el de apertura, también por adelantado si hoy le va a tocar (no se enseña hasta que la web lo diga)
                self.cargarApertura()
            }
        }
    }

    /// cada página empieza sin anuncios (al recargar, o al volver a la entrada)
    func paginaNueva() { zona(false, "", false) }

    /// la web dice si su liga está cargada (y no está la pantalla del límite): hasta la primera vez, ningún anuncio
    func zona(_ si: Bool, _ bloque: String, _ inter: Bool) {
        if Anuncios.deLaCuenta(bloque) { bloqueWeb = bloque }
        quiere = si
        let antes = conIntersticiales
        conIntersticiales = si && inter
        if !conIntersticiales { intersticial = nil }
        if si && !activado {
            // la primera vez: ahora sí, el intersticial (si le tocan) y el bonificado precargados
            activado = true
            cargarIntersticial()
            cargarBonificado()
            cargarApertura()
        } else if conIntersticiales && !antes {
            cargarIntersticial()
        }
    }

    func alPausar() { pausadoDesde = Anuncios.ahora() }

    func alVolver() {
        // si al abrir no hubo red para el consentimiento, se prueba otra vez
        if !iniciado { pedirConsentimiento() }
        // volver tras media hora fuera es como abrirla: otro momento para el de apertura (si hoy aún no ha salido)
        let ahora = Anuncios.ahora()
        if pausadoDesde > 0 && ahora - pausadoDesde >= Anuncios.otraSesion {
            momentoHasta = abriendo ? max(momentoHasta, ahora + Anuncios.ventanaApertura) : ahora + Anuncios.ventanaApertura
            cargarApertura()
            quizaApertura()
        }
        pausadoDesde = 0
    }

    private var aLaVista: Bool { UIApplication.shared.applicationState == .active }
    private var algoEnPantalla: Bool { ensenando != nil || pendiente != nil || ensenandoIntersticial != nil || ensenandoApertura != nil }

    /* ---------------- el intersticial ---------------- */

    /// el bloque: el de la app si lo lleva; si no, el de la web
    private func bloqueIntersticial() -> String {
        let b = Anuncios.bloqueDe("FMIntersticial")
        return b.isEmpty ? bloqueWeb : b
    }

    private func cargarIntersticial() {
        guard act != nil, listo, activado, conIntersticiales, !cargandoIntersticial, ensenandoIntersticial == nil else { return }
        let ahora = Anuncios.ahora()
        if intersticial != nil && ahora - intersticialT < Anuncios.caduca { return }
        let id = bloqueIntersticial()
        if id.isEmpty || ahora < esperaHasta { return }
        intersticial = nil
        cargandoIntersticial = true
        InterstitialAd.load(with: id, request: Request()) { [weak self] ad, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.cargandoIntersticial = false
                if let ad {
                    self.intersticial = ad
                    self.intersticialT = Anuncios.ahora()
                    self.fallosIntersticial = 0
                } else {
                    self.intersticial = nil
                    self.ultimoFallo = "intersticial: \(error?.localizedDescription ?? "sin anuncio")"
                    // no se vuelve a probar solo: en la próxima pausa, y cada vez más tarde (1, 2, 4… hasta 30 minutos)
                    self.fallosIntersticial += 1
                    self.esperaHasta = Anuncios.ahora() + min(30 * 60, 60 * Double(1 << min(self.fallosIntersticial - 1, 5)))
                }
            }
        }
    }

    /// por qué no se puede enseñar ahora (nil: se puede)
    private func porQueNo() -> String? {
        let ahora = Anuncios.ahora()
        if !listo { return iniciado ? "sin anuncio" : "sin consentimiento" }
        if !activado || !quiere { return "pantalla" }
        if !conIntersticiales { return "no a esta cuenta" }
        if !aLaVista { return "fuera" }
        if teclado { return "teclado" }
        if ocupada { return "la IA trabaja" }
        if algoEnPantalla { return "otro anuncio" }
        if ahora - bonificadoFin < Anuncios.trasBonificado { return "tras un bonificado" }
        if ahora - ultimoIntersticial < Anuncios.entreIntersticiales { return "muy seguido" }
        let dia = Int(ahora / 86400)
        if dia != hoyDia {
            hoyDia = dia
            hoyN = 0
        }
        if hoyN >= Anuncios.topeDia { return "tope del día" }
        return nil
    }

    /// la web lo pide en una pausa natural; contesta con intersticialVisto(ok, motivo)
    func pedirIntersticial(_ bloque: String) {
        guard let a = act else { return }
        if Anuncios.deLaCuenta(bloque) { bloqueWeb = bloque }
        if let no = porQueNo() {
            responderIntersticial(false, no)
            return
        }
        guard let ad = intersticial, Anuncios.ahora() - intersticialT < Anuncios.caduca else {
            // sin uno listo no pasa nada: se carga para la próxima pausa
            intersticial = nil
            responderIntersticial(false, "sin anuncio")
            cargarIntersticial()
            return
        }
        intersticial = nil
        ensenandoIntersticial = ad
        ad.fullScreenContentDelegate = self
        ad.present(from: a.arriba())
    }

    private func responderIntersticial(_ visto: Bool, _ motivo: String) {
        act?.js("window.intersticialVisto && intersticialVisto(\(visto),\(Principal.cadena(motivo)))")
    }

    /* ---------------- el de apertura ---------------- */

    /// la web dice si a esta cuenta le toca hoy el de apertura (y el bloque, si la app no lo lleva puesto)
    func apertura(_ toca: Bool, _ bloque: String) {
        guard act != nil else { return }
        if Anuncios.deLaCuenta(bloque) { bloqueAperturaWeb = bloque }
        aperturaToca = toca
        if !toca {
            // sin la liga cargada la web aún no sabe si le toca: el que se haya pedido por adelantado se guarda. Con la
            // liga cargada es un «no» de verdad: fuera, y si no es porque lo ha visto hoy, mañana no se pide por adelantado
            if !quiere { return }
            apertura = nil
            aperturaPrevista = false
            abriendo = false
            if !vistoHoy() { apuntar(Anuncios.pToca, 0) }
            return
        }
        let ahora = Anuncios.ahora()
        apuntar(Anuncios.pToca, ahora)
        // recién abierta la app: la liga acaba de cargar y le toca. Es el momento: ahora si ya está cargado, o en los
        // segundos siguientes si aún está llegando; más tarde ya no (estaría en mitad del uso)
        if abriendo {
            abriendo = false
            if ahora <= momentoHasta { momentoHasta = ahora + Anuncios.trasLiga }
        }
        cargarApertura()
        quizaApertura()
    }

    private static func diaLocal(_ t: TimeInterval) -> Int { Int((t + Double(TimeZone.current.secondsFromGMT(for: Date(timeIntervalSince1970: t)))) / 86400) }

    private func vistoHoy() -> Bool {
        let visto = UserDefaults.standard.double(forKey: Anuncios.pVisto)
        return visto > 0 && Anuncios.diaLocal(visto) == Anuncios.diaLocal(Anuncios.ahora())
    }

    private func prevista() -> Bool {
        let toca = UserDefaults.standard.double(forKey: Anuncios.pToca), ahora = Anuncios.ahora()
        return toca > 0 && ahora - toca < Anuncios.previstaDias && !vistoHoy()
    }

    private func apuntar(_ clave: String, _ valor: TimeInterval) {
        // (la web lo repite cada vez que pinta: no se escribe si ya está apuntado hace menos de una hora)
        let antes = UserDefaults.standard.double(forKey: clave)
        if valor == antes || (valor > 0 && antes > 0 && valor - antes < 3600) { return }
        UserDefaults.standard.set(valor, forKey: clave)
    }

    private func bloqueApertura() -> String {
        let b = Anuncios.bloqueDe("FMApertura")
        return b.isEmpty ? bloqueAperturaWeb : b
    }

    private func cargarApertura() {
        guard act != nil, listo, !cargandoApertura, ensenandoApertura == nil else { return }
        // con la liga cargada y la web diciendo que le toca; o, antes de eso, por adelantado si se sabe que le tocará
        if !(activado && aperturaToca) && !aperturaPrevista { return }
        let ahora = Anuncios.ahora()
        if apertura != nil && ahora - aperturaT < Anuncios.caducaApertura { return }
        let id = bloqueApertura()
        if id.isEmpty || ahora < esperaAperturaHasta { return }
        apertura = nil
        cargandoApertura = true
        AppOpenAd.load(with: id, request: Request()) { [weak self] ad, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.cargandoApertura = false
                if let ad {
                    self.apertura = ad
                    self.aperturaT = Anuncios.ahora()
                    self.fallosApertura = 0
                    // si ha llegado a tiempo (y la web ya ha dicho que le toca), ahora; si llega antes que la liga, espera
                    // a que la web lo diga; si llega tarde, queda para la próxima apertura
                    self.quizaApertura()
                } else {
                    self.apertura = nil
                    self.ultimoFallo = "apertura: \(error?.localizedDescription ?? "sin anuncio")"
                    self.fallosApertura += 1
                    self.esperaAperturaHasta = Anuncios.ahora() + min(30 * 60, 60 * Double(1 << min(self.fallosApertura - 1, 5)))
                }
            }
        }
    }

    /// se enseña solo si la web dice que toca (con la liga cargada), está cargado y estamos en el momento de abrir (o de
    /// volver tras media hora), con nada más encima
    private func quizaApertura() {
        guard let a = act, aperturaToca, let ad = apertura else { return }
        let ahora = Anuncios.ahora(), dia = Int(ahora / 86400)
        if ahora > momentoHasta || dia == aperturaDia { return }
        if ahora - aperturaT >= Anuncios.caducaApertura {
            apertura = nil
            cargarApertura()
            return
        }
        if !listo || !activado || !quiere || !aLaVista || teclado || ocupada || algoEnPantalla { return }
        apertura = nil
        ensenandoApertura = ad
        ad.fullScreenContentDelegate = self
        ad.present(from: a.arriba())
    }

    private func responderApertura(_ visto: Bool, _ motivo: String) {
        act?.js("window.aperturaVista && aperturaVista(\(visto),\(Principal.cadena(motivo)))")
    }

    /* ---------------- el bonificado ---------------- */

    private func cargarBonificado() {
        // precargado solo después del primer zona(true); antes, solo si lo acaba de pedir el usuario (ver)
        let id = Anuncios.bloqueDe("FMBonificado")
        guard act != nil, listo, !cargandoBonificado, !id.isEmpty, activado || pendiente != nil else { return }
        if bonificado != nil && Anuncios.ahora() - bonificadoT < Anuncios.caduca { return }
        bonificado = nil
        cargandoBonificado = true
        RewardedAd.load(with: id, request: Request()) { [weak self] ad, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.cargandoBonificado = false
                if let ad {
                    self.bonificado = ad
                    self.bonificadoT = Anuncios.ahora()
                    if let para = self.pendiente {
                        self.pendiente = nil
                        // si mientras tanto ha salido de la app, no se le enseña nada: va gratis
                        if self.aLaVista { self.ensenar(para) } else { self.responder(para, false, "sin anuncio") }
                    }
                } else {
                    self.bonificado = nil
                    self.ultimoFallo = "bonificado: \(error?.localizedDescription ?? "sin anuncio")"
                    if let para = self.pendiente {
                        self.pendiente = nil
                        self.responder(para, false, "sin anuncio")
                    }
                }
            }
        }
    }

    /// enseña el bonificado; si aún no ha llegado, lo espera 10 segundos
    func ver(_ para: String) {
        if algoEnPantalla { return }
        if !listo {
            responder(para, false, iniciado ? "sin anuncio" : "sin consentimiento")
            return
        }
        if bonificado != nil && Anuncios.ahora() - bonificadoT < Anuncios.caduca {
            ensenar(para)
            return
        }
        pendiente = para
        cargarBonificado()
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self, self.pendiente == para else { return }
            self.pendiente = nil
            self.responder(para, false, "sin anuncio")
        }
    }

    /// la web ya no lo quiere (ha cerrado la ventana): si se estaba cargando, no se enseña
    func cancelar() { pendiente = nil }

    private func ensenar(_ para: String) {
        guard let ad = bonificado, let a = act else {
            bonificado = nil
            responder(para, false, "sin anuncio")
            return
        }
        bonificado = nil
        ensenando = (ad, para, false)
        ad.fullScreenContentDelegate = self
        ad.present(from: a.arriba()) { [weak self] in
            DispatchQueue.main.async { self?.ensenando?.premio = true }
        }
    }

    private func responder(_ para: String, _ visto: Bool, _ motivo: String) {
        act?.js("window.anuncioVisto && anuncioVisto(\(Principal.cadena(para)),\(visto),\(Principal.cadena(motivo)))")
    }

    /* ---------------- lo que cuenta cada anuncio en pantalla ---------------- */

    func adWillPresentFullScreenContent(_ ad: FullScreenPresentingAd) {
        let ahora = Anuncios.ahora()
        if let i = ensenandoIntersticial, i === ad {
            ultimoIntersticial = ahora
            hoyN += 1
        } else if let o = ensenandoApertura, o === ad {
            aperturaDia = Int(ahora / 86400)
            aperturaPrevista = false
            apuntar(Anuncios.pVisto, ahora)
            // el intersticial espera como poco su suelo desde este
            ultimoIntersticial = ahora
        }
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        if let i = ensenandoIntersticial, i === ad {
            ensenandoIntersticial = nil
            ultimoIntersticial = Anuncios.ahora()
            responderIntersticial(true, "")
            cargarIntersticial()
        } else if let o = ensenandoApertura, o === ad {
            ensenandoApertura = nil
            responderApertura(true, "")
        } else if let b = ensenando, b.ad === ad {
            ensenando = nil
            bonificadoFin = Anuncios.ahora()
            responder(b.para, b.premio, b.premio ? "" : "cerrado antes de tiempo")
            cargarBonificado()
        }
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        ultimoFallo = "al enseñar: \(error.localizedDescription)"
        if let i = ensenandoIntersticial, i === ad {
            ensenandoIntersticial = nil
            responderIntersticial(false, "no se pudo enseñar")
            cargarIntersticial()
        } else if let o = ensenandoApertura, o === ad {
            ensenandoApertura = nil
            responderApertura(false, "no se pudo enseñar")
        } else if let b = ensenando, b.ad === ad {
            ensenando = nil
            responder(b.para, false, "no se pudo enseñar")
            cargarBonificado()
        }
    }

    /* ---------------- la privacidad ---------------- */

    /// si hay que dejar cambiar el consentimiento desde Ajustes (en la UE, sí)
    var hayPrivacidad: Bool { ConsentInformation.shared.privacyOptionsRequirementStatus == .required }

    /// el formulario para cambiar el consentimiento
    func privacidad() {
        guard let a = act else { return }
        ConsentForm.presentPrivacyOptionsForm(from: a.arriba()) { [weak self] _ in
            DispatchQueue.main.async { self?.seguir() }
        }
    }

    #if DEBUG
    /// cómo está, para las pruebas del simulador
    func estado() -> [String: Any] {
        [
            "iniciado": iniciado, "listo": listo, "activado": activado,
            "consentimiento": ConsentInformation.shared.consentStatus.rawValue, "puede": ConsentInformation.shared.canRequestAds,
            "rastreo": ATTrackingManager.trackingAuthorizationStatus.rawValue,
            "bonificado": bonificado != nil, "intersticial": intersticial != nil, "apertura": apertura != nil,
            "enPantalla": ensenando != nil || ensenandoIntersticial != nil || ensenandoApertura != nil,
            "fallo": ultimoFallo,
        ]
    }
    #endif
}
