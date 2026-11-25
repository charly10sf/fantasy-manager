import Foundation
import Security

/// Lo que la web guarda en el móvil con guardar()/leer()/borrar() del puente: la sesión de LaLiga, el inicio de sesión
/// a medias y la clave de la IA de cada uno. En Android va a las preferencias privadas de la app; aquí, al llavero del
/// iPhone (solo en este dispositivo, sin iCloud ni copias de seguridad).
///
/// Si el llavero no dejara guardar (no debería pasar), el valor va a un archivo privado de la app para que la sesión no
/// se pierda al cerrarla: `ultimoFallo` lo dice. Todo se usa desde el hilo de la pantalla.
enum Llavero {
    private static let servicio = "es.fantasymanager.app.web"
    private static var copia: [String: String]?
    /// el código del último fallo del llavero (0: ninguno), para el diagnóstico
    private(set) static var ultimoFallo: OSStatus = 0

    /// El llavero sobrevive a desinstalar la app: en la primera apertura de una instalación nueva se vacía, para que
    /// quien la reinstala (o estrena un móvil de segunda mano) no se encuentre una sesión que no ha abierto.
    static func alInstalar() {
        let d = UserDefaults.standard
        if d.bool(forKey: "instalada") { return }
        SecItemDelete(base() as CFDictionary)
        try? FileManager.default.removeItem(at: archivo)
        copia = [:]
        d.set(true, forKey: "instalada")
    }

    private static func base(_ clave: String? = nil) -> [String: Any] {
        var q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: servicio]
        if let clave { q[kSecAttrAccount as String] = clave }
        return q
    }

    /// el archivo de reserva (solo si el llavero falla)
    private static var archivo: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("guardado.json")
    }

    private static func leerArchivo() -> [String: String] {
        guard let d = try? Data(contentsOf: archivo), let j = try? JSONSerialization.jsonObject(with: d) as? [String: String] else { return [:] }
        return j
    }

    private static func escribirArchivo(_ m: [String: String]) {
        let fm = FileManager.default
        if m.isEmpty { try? fm.removeItem(at: archivo); return }
        guard let d = try? JSONSerialization.data(withJSONObject: m) else { return }
        try? fm.createDirectory(at: archivo.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? d.write(to: archivo, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        var u = archivo
        var v = URLResourceValues()
        v.isExcludedFromBackup = true
        try? u.setResourceValues(v)
    }

    /// todo lo guardado (se lee una vez y se lleva en memoria)
    static func todo() -> [String: String] {
        if let c = copia { return c }
        var r = leerArchivo()
        var q = base()
        q[kSecMatchLimit as String] = kSecMatchLimitAll
        q[kSecReturnAttributes as String] = true
        var res: CFTypeRef?
        let e = SecItemCopyMatching(q as CFDictionary, &res)
        if e == errSecSuccess, let lista = res as? [[String: Any]] {
            for i in lista {
                guard let k = i[kSecAttrAccount as String] as? String else { continue }
                var uno = base(k)
                uno[kSecMatchLimit as String] = kSecMatchLimitOne
                uno[kSecReturnData as String] = true
                var dato: CFTypeRef?
                if SecItemCopyMatching(uno as CFDictionary, &dato) == errSecSuccess, let d = dato as? Data, let v = String(data: d, encoding: .utf8) {
                    r[k] = v
                }
            }
        } else if e != errSecItemNotFound {
            ultimoFallo = e
        }
        copia = r
        return r
    }

    static func guardar(_ clave: String, _ valor: String) {
        var m = todo()
        m[clave] = valor
        copia = m
        let datos = Data(valor.utf8)
        var e = SecItemUpdate(base(clave) as CFDictionary, [kSecValueData as String: datos] as CFDictionary)
        if e == errSecItemNotFound {
            var nuevo = base(clave)
            nuevo[kSecValueData as String] = datos
            nuevo[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            e = SecItemAdd(nuevo as CFDictionary, nil)
        }
        var reserva = leerArchivo()
        if e == errSecSuccess {
            if reserva.removeValue(forKey: clave) != nil { escribirArchivo(reserva) }
        } else {
            ultimoFallo = e
            reserva[clave] = valor
            escribirArchivo(reserva)
        }
    }

    static func borrar(_ clave: String) {
        var m = todo()
        m.removeValue(forKey: clave)
        copia = m
        let e = SecItemDelete(base(clave) as CFDictionary)
        if e != errSecSuccess && e != errSecItemNotFound { ultimoFallo = e }
        var reserva = leerArchivo()
        if reserva.removeValue(forKey: clave) != nil { escribirArchivo(reserva) }
    }
}
