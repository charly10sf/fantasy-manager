import UIKit
import UserNotifications

/// Los avisos del iPhone. La web calcula cuándo pasa cada cosa (se abre la cláusula de un rival, se acaba la protección
/// de uno tuyo, cierra el mercado, empieza la jornada…) y se lo pasa aquí como una lista, igual que en Android
/// (Avisos.java): [{ id, t, titulo, texto, hash, cada, alarma }]. Cada uno es una notificación local del sistema, que
/// llega aunque la app esté cerrada.
///
/// Lo que cambia en el iPhone:
/// - El sistema guarda como mucho 64 avisos pendientes por app. Se programan los más cercanos (`maximo`) y la lista se
///   rehace cada vez que se abre la app o se vuelve a ella. Los que repiten (el recordatorio diario) se programan día a
///   día, hasta dos semanas.
/// - Los de «alarma» (el clausulazo que manda tu plan, 1 minuto antes): en iOS 26 o más, una alarma del sistema
///   (AlarmKit, Alarma.swift), que suena aunque el iPhone esté en silencio o en un modo de concentración. Si no se puede
///   (un iPhone más antiguo, o sin ese permiso), un aviso «urgente», que pasa los modos de concentración pero respeta el
///   silencio.
/// - Tocar un aviso abre la app en su pestaña (el `hash`), como en Android.
@MainActor
final class Avisos: NSObject, UNUserNotificationCenterDelegate {
    static let yo = Avisos()
    /// de los 64 que deja el iPhone, los que se usan para la lista (el resto, para los que se ponen al momento)
    static let maximo = 56
    /// las alarmas del sistema a la vez (solo las más cercanas)
    static let maximoAlarmas = 8
    private static let claveLista = "avisos", clavePermiso = "avisos_ok"
    private static let prefijo = "av:"
    /// los avisos de «listo» que ya no hacen falta si lo estás viendo en la app
    static let deListo = ["fm-plan", "fm-preg", "web:Tu plan de hoy está listo", "web:No ha salido el plan de hoy"]

    weak var act: Principal?
    /// si el iPhone deja enseñar notificaciones (lo último que se sabe: la web lo lee al momento)
    private(set) var permitidos = UserDefaults.standard.bool(forKey: Avisos.clavePermiso)
    /// la pestaña del aviso con el que se ha abierto la app, hasta que la página la recoge
    var hashPendiente: String?
    private var programando = false, otraVez = false
    private var centro: UNUserNotificationCenter { UNUserNotificationCenter.current() }

    /// ¿hay alarma del sistema en este iPhone? (iOS 26 o más)
    static var hayAlarma: Bool {
        if #available(iOS 26.0, *) { return true }
        return false
    }

    /// al arrancar la app (antes de que acabe de abrirse: así llega el toque en un aviso que la abre)
    func alArrancar() {
        centro.delegate = self
        mirarPermiso()
    }

    /// de vuelta a la app: el permiso puede haber cambiado en los ajustes del iPhone, y hay hueco para más avisos
    func alVolver() {
        mirarPermiso(avisar: true)
        reprogramar()
        centro.removeDeliveredNotifications(withIdentifiers: Avisos.deListo)
    }

    /* ---------------- el permiso ---------------- */

    private static func vale(_ e: UNAuthorizationStatus) -> Bool { e == .authorized || e == .provisional || e == .ephemeral }

    /// Pregunta al iPhone cómo está el permiso y se lo cuenta a la web. Con `avisar`, si se acaba de dar (en los ajustes
    /// del iPhone), la web se entera como si lo hubiera dado en la pregunta
    func mirarPermiso(avisar: Bool = false, luego: ((UNAuthorizationStatus) -> Void)? = nil) {
        centro.getNotificationSettings { [weak self] s in
            let estado = s.authorizationStatus
            DispatchQueue.main.async {
                guard let self else { return }
                let antes = self.permitidos
                self.permitidos = Avisos.vale(estado)
                if antes != self.permitidos { UserDefaults.standard.set(self.permitidos, forKey: Avisos.clavePermiso) }
                self.act?.ponerEstadoNativo()
                if self.permitidos {
                    // el identificador de este iPhone para los avisos del servidor (el plan y la pregunta con la app cerrada)
                    UIApplication.shared.registerForRemoteNotifications()
                    if !antes {
                        self.reprogramar()
                        if avisar { self.act?.js("window.permisoAvisos && permisoAvisos(true)") }
                    }
                }
                luego?(estado)
            }
        }
    }

    /// El permiso de notificaciones, solo cuando activas los avisos. El iPhone pregunta una sola vez: si ya se dijo que
    /// no, se abren sus ajustes de notificaciones de la app, que es donde se cambia
    func pedirPermiso() {
        mirarPermiso { [weak self] estado in
            guard let self else { return }
            switch estado {
            case .notDetermined:
                self.centro.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] ok, _ in
                    DispatchQueue.main.async {
                        self?.mirarPermiso()
                        self?.act?.js("window.permisoAvisos && permisoAvisos(\(ok))")
                    }
                }
            case .denied:
                if let u = URL(string: UIApplication.openNotificationSettingsURLString) { UIApplication.shared.open(u, options: [:], completionHandler: nil) }
            default:
                self.act?.js("window.permisoAvisos && permisoAvisos(true)")
            }
        }
    }

    /* ---------------- la lista de la web ---------------- */

    /// Guarda la lista nueva y programa los avisos más cercanos
    func programar(_ json: String) {
        let t = json.isEmpty ? "[]" : json
        // una lista mal formada: se queda la que había
        guard let d = t.data(using: .utf8), (try? JSONSerialization.jsonObject(with: d)) is [Any] else { return }
        UserDefaults.standard.set(t, forKey: Avisos.claveLista)
        reprogramar()
    }

    private static func numero(_ x: Any?) -> Double {
        if let n = x as? NSNumber { return n.doubleValue }
        if let s = x as? String { return Double(s) ?? 0 }
        return 0
    }

    nonisolated static func hashLimpio(_ x: Any?) -> String {
        let letras = Set("abcdefghijklmnopqrstuvwxyz0123456789/_-")
        return String((x as? String ?? "").filter { letras.contains($0) })
    }

    /// lo que toca de la lista guardada: las próximas veces de cada aviso, de la más cercana a la más lejana
    static func proximos(_ lista: [[String: Any]], ahora: Double) -> [(t: Double, id: String, a: [String: Any])] {
        var todos: [(t: Double, id: String, a: [String: Any])] = []
        let dosSemanas = ahora + 14 * 86400e3
        for a in lista {
            let id = a["id"] as? String ?? "aviso"
            var t = numero(a["t"])
            let cada = numero(a["cada"])
            if cada >= 60e3 {
                // los que repiten: sus próximas veces, una a una (el iPhone no sabe repetir «desde tal día»)
                if t <= ahora + 1000 { t += ceil((ahora + 1000 - t) / cada) * cada }
                var n = 0
                while n < 14 && t < dosSemanas {
                    todos.append((t, n == 0 ? id : "\(id)#\(n)", a))
                    t += cada
                    n += 1
                }
            } else if t > ahora {
                todos.append((t, id, a))
            }
        }
        return todos.sorted { $0.t < $1.t }
    }

    /// Programa otra vez los avisos guardados que aún no han pasado. Si se pide mientras se está haciendo, se repite al acabar
    func reprogramar() {
        if programando { otraVez = true; return }
        programando = true
        let acabar: () -> Void = { [weak self] in
            DispatchQueue.main.async {
                guard let self else { return }
                self.programando = false
                if self.otraVez { self.otraVez = false; self.reprogramar() }
            }
        }
        var lista: [[String: Any]] = []
        if let t = UserDefaults.standard.string(forKey: Avisos.claveLista), let d = t.data(using: .utf8), let l = (try? JSONSerialization.jsonObject(with: d)) as? [[String: Any]] { lista = l }
        let ahora = Date().timeIntervalSince1970 * 1000
        let elegidos = Array(Avisos.proximos(lista, ahora: ahora).prefix(Avisos.maximo))
        let prefijo = Avisos.prefijo
        centro.getPendingNotificationRequests { pendientes in
            // (lo que haya puesto la lista anterior; los que se pusieron al momento no se tocan)
            let viejos = pendientes.map { $0.identifier }.filter { $0.hasPrefix(prefijo) }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.poner(elegidos, viejos, acabar)
            }
        }
    }

    /// quita los avisos de la lista anterior que ya no están y pone los de ahora (las alarmas del sistema, primero)
    private func poner(_ elegidos: [(t: Double, id: String, a: [String: Any])], _ viejos: [String], _ acabar: @escaping () -> Void) {
        let centro = self.centro
        let nuevos = Set(elegidos.map { Avisos.prefijo + $0.id })
        centro.removePendingNotificationRequests(withIdentifiers: viejos.filter { !nuevos.contains($0) })
        let deAlarma = Array(elegidos.filter { ($0.a["alarma"] as? Bool) == true }.prefix(Avisos.maximoAlarmas))
        let conAlarmaIds = Set(deAlarma.map { $0.id })
        Avisos.ponerAlarmas(deAlarma.map { (Date(timeIntervalSince1970: $0.t / 1000), $0.a["titulo"] as? String ?? "Fantasy Manager") }) { conAlarma in
            for e in elegidos {
                let alarma = (e.a["alarma"] as? Bool) == true
                // con la alarma del sistema puesta, el aviso va callado (para leerlo y abrir la app); sin ella, urgente
                let suena = !(alarma && conAlarma && conAlarmaIds.contains(e.id))
                let c = Avisos.contenido(e.a["titulo"] as? String, e.a["texto"] as? String, Avisos.hashLimpio(e.a["hash"]), urgente: alarma, suena: suena)
                let en = max(1, (e.t - Date().timeIntervalSince1970 * 1000) / 1000)
                centro.add(UNNotificationRequest(identifier: Avisos.prefijo + e.id, content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: en, repeats: false)), withCompletionHandler: nil)
            }
            acabar()
        }
    }

    private static func contenido(_ titulo: String?, _ texto: String?, _ hash: String, urgente: Bool = false, suena: Bool = true, hilo: String = "liga") -> UNMutableNotificationContent {
        let c = UNMutableNotificationContent()
        c.title = (titulo ?? "").isEmpty ? "Fantasy Manager" : titulo!
        c.body = texto ?? ""
        c.userInfo = ["hash": hash]
        c.threadIdentifier = hilo
        if suena { c.sound = .default }
        if urgente { c.interruptionLevel = .timeSensitive }
        return c
    }

    /* ---------------- los que se ponen al momento ---------------- */

    /// un aviso ya (lo pide la web: el plan listo con la app fuera de la vista, la prueba de Ajustes…)
    func mostrar(_ clave: String, _ titulo: String, _ texto: String, _ hash: String, hilo: String = "liga") {
        guard permitidos else { return }
        let c = Avisos.contenido(titulo, texto, Avisos.hashLimpio(hash), hilo: hilo)
        centro.add(UNNotificationRequest(identifier: clave, content: c, trigger: nil), withCompletionHandler: nil)
    }

    func quitar(_ claves: [String]) { centro.removeDeliveredNotifications(withIdentifiers: claves) }

    /// La alarma del clausulazo, de prueba (Ajustes → Avisos): suena dentro de unos segundos, fuera de la lista
    func probarAlarma(_ segundos: Int, _ titulo: String, _ texto: String) {
        let en = Double(max(3, min(120, segundos)))
        let t = titulo.isEmpty ? "Fantasy Manager" : titulo
        Avisos.ponerAlarmas([(Date().addingTimeInterval(en), t)], quitarAntes: false) { [weak self] conAlarma in
            guard let self, self.permitidos else { return }
            let c = Avisos.contenido(t, texto, "hoy", urgente: true, suena: !conAlarma)
            self.centro.add(UNNotificationRequest(identifier: "prueba-alarma", content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: en, repeats: false)), withCompletionHandler: nil)
        }
    }

    /// Pone las alarmas del sistema (iOS 26 o más y con su permiso, que el iPhone pregunta la primera vez); dice si se han
    /// puesto. Antes quita las que hubiera de la lista anterior
    private static func ponerAlarmas(_ alarmas: [(Date, String)], quitarAntes: Bool = true, _ luego: @escaping (Bool) -> Void) {
        if #available(iOS 26.0, *) {
            Task {
                if quitarAntes { Alarma.quitarTodas() }
                var bien = !alarmas.isEmpty
                for (cuando, titulo) in alarmas where bien { bien = await Alarma.poner(cuando, titulo) }
                luego(bien)
            }
            return
        }
        luego(false)
    }

    /* ---------------- lo que pasa con cada aviso ---------------- */

    /// un aviso que llega con la app abierta: se enseña igual (como en Android), salvo los del servidor (el plan o la
    /// respuesta ya están en pantalla)
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if notification.request.trigger is UNPushNotificationTrigger { completionHandler([]); return }
        completionHandler([.banner, .list, .sound])
    }

    /// se ha tocado un aviso: la app se abre en su pestaña
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let h = Avisos.hashLimpio(response.notification.request.content.userInfo["hash"])
        Task { @MainActor in
            if let a = Avisos.yo.act { a.irA(h) } else { Avisos.yo.hashPendiente = h }
        }
        completionHandler()
    }
}

/// El plan y la pregunta a la IA cuando sales de la app a medias. El iPhone congela la app a los pocos segundos de salir
/// (en Android se queda Recoger.java preguntando al servidor), así que quien avisa es el servidor, con una notificación
/// push: al salir con un pedido en marcha, la app le dice a quién avisar (POST /push del Worker: el id del pedido y el
/// identificador de este iPhone para los avisos, que da Apple). Si al final el plan o la respuesta le llegan a la propia
/// app (sigue viva unos segundos, o has vuelto), se lo dice para que no avise y, si estás fuera, pone ella el aviso.
/// Al volver, la web recoge el plan o la respuesta como siempre, con el mismo id.
@MainActor
final class Empuje {
    static let yo = Empuje()
    private static let servidor = "https://fantasy-manager.fantasymanager-web-app.workers.dev/push"
    private static let claveToken = "push_tk"
    #if DEBUG
    private static let ambiente = "dev"
    #else
    private static let ambiente = "prod"
    #endif

    private struct Pedido {
        let rid: String
        var sesion: String
        var avisado = false
    }

    /// el identificador de este iPhone para los avisos (se guarda solo cuando cambia)
    private(set) var token = UserDefaults.standard.string(forKey: Empuje.claveToken) ?? ""
    private var plan: Pedido?, pregunta: Pedido?
    /// por qué no hay identificador, para el diagnóstico de las pruebas
    private(set) var fallo = ""
    #if DEBUG
    private(set) var llamadas: [String] = []
    #endif

    func tokenNuevo(_ datos: Data) {
        let t = datos.map { String(format: "%02x", $0) }.joined()
        fallo = ""
        if t == token { return }
        token = t
        UserDefaults.standard.set(t, forKey: Empuje.claveToken)
    }

    func sinToken(_ error: Error) { fallo = error.localizedDescription }

    private func poner(_ actual: Pedido?, _ rid: String, _ sesion: String) -> Pedido? {
        if rid.isEmpty || sesion.isEmpty { return nil }
        if var p = actual, p.rid == rid { p.sesion = sesion; return p }
        return Pedido(rid: rid, sesion: sesion)
    }

    func planEnMarcha(_ rid: String, _ sesion: String) { plan = poner(plan, rid, sesion) }
    func preguntaEnMarcha(_ rid: String, _ sesion: String) { pregunta = poner(pregunta, rid, sesion) }

    /// el plan ya ha llegado a la app (o ha fallado): nada que avisar
    func planAcabado() {
        if let p = plan, p.avisado { llamar(p, "plan", quitar: true) }
        plan = nil
    }

    /// la respuesta ya ha llegado a la app (o ha fallado): nada que avisar
    func preguntaAcabada() {
        if let p = pregunta, p.avisado { llamar(p, "preg", quitar: true) }
        pregunta = nil
    }

    /// al salir de la app: si hay un plan o una pregunta a medias, se le dice al servidor a quién avisar
    func alSalir() {
        guard !token.isEmpty, Avisos.yo.permitidos else { return }
        if let p = plan, !p.avisado { plan?.avisado = true; llamar(p, "plan", quitar: false) }
        if let p = pregunta, !p.avisado { pregunta?.avisado = true; llamar(p, "preg", quitar: false) }
    }

    private func llamar(_ p: Pedido, _ tipo: String, quitar: Bool) {
        guard let u = URL(string: Empuje.servidor) else { return }
        var cuerpo: [String: Any] = ["rid": p.rid, "tipo": tipo]
        if quitar { cuerpo["quitar"] = true } else { cuerpo["tk"] = token; cuerpo["amb"] = Empuje.ambiente }
        guard let d = try? JSONSerialization.data(withJSONObject: cuerpo) else { return }
        var r = URLRequest(url: u, timeoutInterval: 15)
        r.httpMethod = "POST"
        r.httpBody = d
        r.setValue("application/json", forHTTPHeaderField: "content-type")
        r.setValue("Bearer \(p.sesion)", forHTTPHeaderField: "authorization")
        #if DEBUG
        llamadas.append("\(tipo):\(quitar ? "quitar" : "avisar")")
        if UserDefaults.standard.bool(forKey: "fmPrueba") { return }
        #endif
        // (con la app saliendo: que el iPhone le deje acabar esta petición)
        let tarea = Tarea()
        tarea.id = UIApplication.shared.beginBackgroundTask(withName: "push") { tarea.soltar() }
        URLSession.shared.dataTask(with: r) { _, _, _ in
            DispatchQueue.main.async { tarea.soltar() }
        }.resume()
    }

    /// el rato de más que da el iPhone al salir, hasta que acaba la petición
    private final class Tarea {
        var id = UIBackgroundTaskIdentifier.invalid
        func soltar() {
            if id == .invalid { return }
            UIApplication.shared.endBackgroundTask(id)
            id = .invalid
        }
    }

    #if DEBUG
    /// en las pruebas del simulador, que puede no dar identificador: uno de mentira (con «-fmPrueba» no se llama al servidor)
    func tokenDePrueba() { if token.isEmpty { token = String(repeating: "ab", count: 32) } }
    func estado() -> [String: Any] { ["token": !token.isEmpty, "fallo": fallo, "llamadas": llamadas, "plan": plan?.rid ?? "", "pregunta": pregunta?.rid ?? ""] }
    #endif
}
