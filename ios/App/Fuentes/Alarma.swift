#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import SwiftUI

/// La alarma del clausulazo en iOS 26 o más: una alarma del sistema (AlarmKit), como las del reloj. Suena aunque el
/// iPhone esté en silencio o en un modo de concentración, y se para con su botón. Es lo que en Android hace el canal
/// «Alarma de clausulazos» (Avisos.java). Solo lleva el título (el sistema no deja más texto): el detalle va en el aviso
/// que llega a la vez (Avisos.swift). El iPhone pregunta una vez si la app puede poner alarmas; si se dice que no, el
/// clausulazo llega como un aviso urgente.
@available(iOS 26.0, *)
enum Alarma {
    /// (el sistema pide un tipo para los datos de más de cada alarma: no lleva ninguno)
    struct Datos: AlarmMetadata {}

    /// fuera las alarmas que hubiera puestas por la app
    static func quitarTodas() {
        guard let puestas = try? AlarmManager.shared.alarms else { return }
        for a in puestas { try? AlarmManager.shared.cancel(id: a.id) }
    }

    /// pone una alarma para ese momento; dice si se ha podido (sin permiso, no)
    static func poner(_ cuando: Date, _ titulo: String) async -> Bool {
        do {
            if AlarmManager.shared.authorizationState == .notDetermined {
                guard try await AlarmManager.shared.requestAuthorization() == .authorized else { return false }
            }
            guard AlarmManager.shared.authorizationState == .authorized else { return false }
            // (el título es un texto con formato: un % suelto se leería como una orden)
            let texto = LocalizedStringResource(String.LocalizationValue(titulo.replacingOccurrences(of: "%", with: "％")))
            let parar = AlarmButton(text: "Parar", textColor: .white, systemImageName: "stop.circle")
            let alerta = AlarmPresentation.Alert(title: texto, stopButton: parar, secondaryButton: nil, secondaryButtonBehavior: nil)
            let atributos = AlarmAttributes<Datos>(presentation: AlarmPresentation(alert: alerta), metadata: Datos(), tintColor: Color(red: 0.93, green: 0.11, blue: 0.24))
            let conf = AlarmManager.AlarmConfiguration<Datos>(countdownDuration: nil, schedule: .fixed(cuando), attributes: atributos, stopIntent: nil, secondaryIntent: nil, sound: .default)
            _ = try await AlarmManager.shared.schedule(id: UUID(), configuration: conf)
            return true
        } catch {
            return false
        }
    }
}
#endif
