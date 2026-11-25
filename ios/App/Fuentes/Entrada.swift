import AuthenticationServices
import UIKit

/// La entrada con la cuenta de LaLiga: su página se abre en la ventana de inicio de sesión del sistema
/// (ASWebAuthenticationSession, que es Safari: ahí sí deja Google iniciar sesión y vale la sesión que ya haya) y la
/// vuelta, authredirect://com.lfp.laligafantasy?code=…, la recoge esa misma ventana y se la da a la app. Es lo mismo
/// que Auth Tab en Android (AuthTab.java).
///
/// El esquema authredirect NO se registra en Info.plist: lo recoge la propia sesión, y registrarlo chocaría con la app
/// de LaLiga Fantasy, que es de quien es esa dirección.
final class Entrada: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let esquema = "authredirect"
    private var sesion: ASWebAuthenticationSession?
    private var turno = 0
    private weak var ancla: UIWindow?
    /// para el diagnóstico de las pruebas: la última página que se ha abierto para entrar
    private(set) var ultimaAbierta = ""

    var abierta: Bool { sesion != nil }

    /// Abre la página de entrar. `fin` llega en el hilo de la pantalla con la dirección de vuelta, o nil si se cerró sin
    /// terminar (o no se pudo abrir)
    func abrir(_ url: URL, en ventana: UIWindow?, fin: @escaping (String?) -> Void) {
        // una sola a la vez: la de antes se cierra sin avisar a nadie
        turno += 1
        let mio = turno
        sesion?.cancel()
        ancla = ventana
        let s = ASWebAuthenticationSession(url: url, callbackURLScheme: Entrada.esquema) { [weak self] vuelta, _ in
            DispatchQueue.main.async {
                guard let self, self.turno == mio else { return }
                self.sesion = nil
                if let v = vuelta, v.scheme?.lowercased() == Entrada.esquema { fin(v.absoluteString) } else { fin(nil) }
            }
        }
        s.presentationContextProvider = self
        // con la sesión de Safari: quien ya entró en LaLiga (o en Google) ahí no tiene que escribir la contraseña otra vez
        s.prefersEphemeralWebBrowserSession = false
        sesion = s
        ultimaAbierta = url.host ?? ""
        if !s.start() {
            sesion = nil
            DispatchQueue.main.async { if self.turno == mio { fin(nil) } }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ancla ?? ASPresentationAnchor()
    }
}
