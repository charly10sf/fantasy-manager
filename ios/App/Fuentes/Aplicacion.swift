import UIKit

/// La app de iOS es la web de web/ (va dentro de la app) abierta en un WKWebView: lo mismo que la de Android
/// (Principal.java). Toda la pantalla es Principal; aquí solo se monta la ventana.
@main
final class Aplicacion: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        Llavero.alInstalar()
        // los avisos, antes de que la app acabe de abrirse: así llega el toque en el aviso que la abre
        Avisos.yo.alArrancar()
        return true
    }

    /// el identificador de este iPhone para los avisos del servidor (el plan y la pregunta con la app cerrada)
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Empuje.yo.tokenNuevo(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // sin identificador (sin red, o en un simulador): los avisos del servidor no llegan; todo lo demás, igual
        Empuje.yo.sinToken(error)
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let c = UISceneConfiguration(name: "Principal", sessionRole: connectingSceneSession.role)
        c.delegateClass = Escena.self
        return c
    }
}

final class Escena: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var primera = true

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.backgroundColor = Principal.fondo
        w.overrideUserInterfaceStyle = .dark
        w.rootViewController = Principal()
        window = w
        w.makeKeyAndVisible()
    }

    private var principal: Principal? { window?.rootViewController as? Principal }

    /// de vuelta a la app después de haber salido (la primera vez es el arranque: ahí no ha vuelto de ningún sitio)
    func sceneWillEnterForeground(_ scene: UIScene) {
        if primera { primera = false; return }
        principal?.alVolver()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        principal?.alSalir()
    }
}
