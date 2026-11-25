import AVFoundation
import ImageIO
import PhotosUI
import Speech
import UIKit
import UniformTypeIdentifiers
import VisionKit

/// (iOS 3) Lo que en Android hacen Fotos.java y escanearQR/escuchar de Principal.java: las fotos para la IA, el QR del
/// ordenador y dictar la pregunta. Las tres contestan a la web igual que en Android: fotosApp([...], error),
/// qrLeido(texto) o qrLeido(null, motivo) (null sin motivo es que se ha cancelado) y vozTexto(texto) o vozTexto(null, motivo).

/* ---------------- las fotos ---------------- */

/// Las fotos y capturas que se mandan a la IA: giradas como se ven, como mucho 1600 px por el lado largo, sobre blanco si
/// tienen transparencia y en JPEG (85 %) en base64. Lo mismo que Fotos.java: una captura se lee bien y pesa poco.
enum Fotos {
    static let lado = 1600

    static func jpegB64(_ url: URL) -> String? {
        guard let f = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return jpegB64(f)
    }

    static func jpegB64(datos: Data) -> String? {
        guard let f = CGImageSourceCreateWithData(datos as CFData, nil) else { return nil }
        return jpegB64(f)
    }

    /// (con la miniatura del propio sistema: no abre la foto entera en memoria, aunque sea de 48 Mpx, y aplica el giro)
    static func jpegB64(_ f: CGImageSource) -> String? {
        let op: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: lado,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(f, 0, op as CFDictionary) else { return nil }
        let w = cg.width, h = cg.height
        guard w > 0, h > 0 else { return nil }
        let formato = UIGraphicsImageRendererFormat()
        formato.scale = 1
        formato.opaque = true
        let caja = CGRect(x: 0, y: 0, width: w, height: h)
        let img = UIGraphicsImageRenderer(size: caja.size, format: formato).image { c in
            UIColor.white.setFill()
            c.fill(caja)
            UIImage(cgImage: cg).draw(in: caja)
        }
        return img.jpegData(compressionQuality: 0.85)?.base64EncodedString()
    }

    /// lo que se le pasa a la web: la lista en JSON y el error (o null)
    @MainActor static func paraLaWeb(_ lista: [String], mal: Int) -> String {
        let l = (try? JSONSerialization.data(withJSONObject: lista)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        let e = mal == 0 ? "null" : Principal.cadena(mal == 1 ? "Una de las fotos no se ha podido abrir" : "\(mal) fotos no se han podido abrir")
        return "window.fotosApp && fotosApp(\(l), \(e))"
    }
}

/// las fotos que van llegando del selector (cada una en su hilo)
final class CajaFotos: @unchecked Sendable {
    private var l: [String?]
    private let candado = NSLock()
    init(_ n: Int) { l = [String?](repeating: nil, count: n) }
    func poner(_ i: Int, _ b: String?) { candado.lock(); l[i] = b; candado.unlock() }
    func todas() -> [String] { candado.lock(); defer { candado.unlock() }; return l.compactMap { $0 } }
}

extension Principal: PHPickerViewControllerDelegate {
    /// El selector de fotos del iPhone. No pide permiso de la galería: la app solo recibe lo que eliges
    func elegirFotos(_ maximo: Int) {
        var c = PHPickerConfiguration()
        c.filter = .images
        c.selectionLimit = max(1, min(4, maximo))
        let p = PHPickerViewController(configuration: c)
        p.delegate = self
        presentar(p)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        let elegidas = Array(results.prefix(4)).map { $0.itemProvider }
        // (como en Android: si no eliges nada, no se dice nada)
        if elegidas.isEmpty { return }
        let caja = CajaFotos(elegidas.count)
        let grupo = DispatchGroup()
        for (i, ip) in elegidas.enumerated() where ip.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
            grupo.enter()
            // (el archivo solo existe mientras dura esta llamada: se prepara aquí mismo, fuera del hilo de la pantalla)
            ip.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
                caja.poner(i, url.flatMap { Fotos.jpegB64($0) })
                grupo.leave()
            }
        }
        grupo.notify(queue: .main) { [weak self] in
            let buenas = caja.todas()
            self?.js(Fotos.paraLaWeb(buenas, mal: elegidas.count - buenas.count))
        }
    }
}

/* ---------------- el QR del ordenador ---------------- */

extension Principal: DataScannerViewControllerDelegate {
    /// ¿puede este iPhone leer QR con la cámara desde la app? (DataScanner: los iPhone con A12 o más, iOS 16 o más; en el
    /// simulador, no). Si no, la web no lo ofrece y queda el código de 8 letras
    static var hayQR: Bool { DataScannerViewController.isSupported }
    static let sinCamara = "Sin permiso para la cámara no se puede leer el QR. Actívalo en Ajustes del iPhone → Fantasy Manager → Cámara, o usa el código de 8 letras."

    func qrLeido(_ texto: String?, _ motivo: String?) {
        let t = texto.map { Principal.cadena($0) } ?? "null"
        let m = motivo.map { ", " + Principal.cadena($0) } ?? ""
        js("window.qrLeido && qrLeido(\(t)\(m))")
    }

    func escanearQR() {
        guard DataScannerViewController.isSupported else { qrLeido(nil, "Este iPhone no puede leer el QR desde la app. Usa el código de 8 letras."); return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            abrirEscaner()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { ok in
                DispatchQueue.main.async { [weak self] in ok ? self?.abrirEscaner() : self?.qrLeido(nil, Principal.sinCamara) }
            }
        default:
            qrLeido(nil, Principal.sinCamara)
        }
    }

    private func abrirEscaner() {
        guard DataScannerViewController.isAvailable else { qrLeido(nil, Principal.sinCamara); return }
        let s = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])], qualityLevel: .balanced, recognizesMultipleItems: false, isHighFrameRateTrackingEnabled: false, isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true)
        s.delegate = self
        s.navigationItem.title = "El QR del ordenador"
        let nav = UINavigationController(rootViewController: s)
        nav.modalPresentationStyle = .fullScreen
        s.navigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .cancel, primaryAction: UIAction { [weak self, weak s] _ in
            s?.stopScanning()
            s?.navigationController?.dismiss(animated: true)
            self?.qrLeido(nil, nil)
        })
        qrHecho = false
        arriba().present(nav, animated: true) { [weak self, weak s] in
            do { try s?.startScanning() } catch {
                s?.navigationController?.dismiss(animated: true)
                self?.qrLeido(nil, "No se ha podido abrir la cámara (\(error.localizedDescription)). Usa el código de 8 letras.")
            }
        }
    }

    func dataScanner(_ s: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
        guard !qrHecho else { return }
        for it in items {
            if case .barcode(let b) = it, let t = b.payloadStringValue, !t.isEmpty {
                qrHecho = true
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                s.stopScanning()
                s.navigationController?.dismiss(animated: true)
                qrLeido(t, nil)
                return
            }
        }
    }

    func dataScanner(_ s: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
        guard !qrHecho else { return }
        qrHecho = true
        s.navigationController?.dismiss(animated: true)
        qrLeido(nil, Principal.sinCamara)
    }
}

/* ---------------- dictar la pregunta ---------------- */

extension Principal {
    /// ¿se puede dictar sin que el audio salga del iPhone? (reconocimiento de español en el propio móvil). Si no, la web no
    /// enseña el micrófono y se dicta con el del teclado
    static var hayVoz: Bool {
        guard let r = SFSpeechRecognizer(locale: Dictado.idioma) else { return false }
        return r.supportsOnDeviceRecognition
    }

    func vozTexto(_ texto: String?, _ motivo: String? = nil) {
        let t = texto.map { Principal.cadena($0) } ?? "null"
        let m = motivo.map { ", " + Principal.cadena($0) } ?? ""
        js("window.vozTexto && vozTexto(\(t)\(m))")
    }

    /// Los dos permisos (el reconocimiento de voz y el micrófono), la primera vez, y la ventanita que escucha
    func escuchar() {
        SFSpeechRecognizer.requestAuthorization { estado in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard estado == .authorized else { self.vozTexto(nil, "Sin permiso para reconocer la voz no se puede dictar. Actívalo en Ajustes del iPhone → Fantasy Manager, o usa el micrófono del teclado."); return }
                AVAudioSession.sharedInstance().requestRecordPermission { ok in
                    DispatchQueue.main.async { [weak self] in
                        guard let self else { return }
                        guard ok else { self.vozTexto(nil, "Sin permiso para el micrófono no se puede dictar. Actívalo en Ajustes del iPhone → Fantasy Manager → Micrófono."); return }
                        let d = Dictado()
                        d.alAcabar = { [weak self] texto, motivo in
                            // (cancelar no dice nada, como en Android)
                            if texto != nil || motivo != nil { self?.vozTexto(texto, motivo) }
                        }
                        self.presentar(d)
                    }
                }
            }
        }
    }
}

/// La ventanita de dictar: escucha, enseña lo que va entendiendo y, al callarte (o con «Listo»), lo manda. El
/// reconocimiento se hace en el propio iPhone (requiresOnDeviceRecognition): el audio no sale del móvil.
final class Dictado: UIViewController {
    static let idioma = Locale(identifier: "es-ES")
    /// (texto, motivo): el texto entendido; nil y un motivo si ha fallado; nil y nil si se ha cancelado
    var alAcabar: ((String?, String?) -> Void)?

    private let reconocedor = SFSpeechRecognizer(locale: Dictado.idioma)
    private let motor = AVAudioEngine()
    private var peticion: SFSpeechAudioBufferRecognitionRequest?
    private var tarea: SFSpeechRecognitionTask?
    private var entendido = ""
    private var acabado = false
    private var silencio: Timer?
    private var tope: Timer?
    private let texto = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 22 / 255, green: 22 / 255, blue: 26 / 255, alpha: 1)
        if let s = sheetPresentationController {
            s.detents = [.medium()]
            s.prefersGrabberVisible = true
        }
        let titulo = UILabel()
        titulo.text = "Te escucho…"
        titulo.font = .systemFont(ofSize: 22, weight: .bold)
        titulo.textColor = .white
        let pie = UILabel()
        pie.text = "Cuéntale a tu director deportivo. Al callarte, se manda."
        pie.font = .systemFont(ofSize: 15)
        pie.textColor = UIColor(white: 0.7, alpha: 1)
        pie.numberOfLines = 0
        texto.font = .systemFont(ofSize: 19)
        texto.textColor = .white
        texto.numberOfLines = 0
        texto.text = " "
        var listoC = UIButton.Configuration.filled()
        listoC.title = "Listo"
        listoC.baseBackgroundColor = UIColor(red: 238 / 255, green: 28 / 255, blue: 60 / 255, alpha: 1)
        listoC.cornerStyle = .capsule
        let listo = UIButton(configuration: listoC, primaryAction: UIAction { [weak self] _ in self?.terminar() })
        var cancelarC = UIButton.Configuration.plain()
        cancelarC.title = "Cancelar"
        cancelarC.baseForegroundColor = .white
        let cancelar = UIButton(configuration: cancelarC, primaryAction: UIAction { [weak self] _ in self?.cerrar(nil, nil) })
        let botones = UIStackView(arrangedSubviews: [cancelar, listo])
        botones.distribution = .fillEqually
        botones.spacing = 12
        let pila = UIStackView(arrangedSubviews: [titulo, pie, texto, UIView(), botones])
        pila.axis = .vertical
        pila.spacing = 12
        pila.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pila)
        NSLayoutConstraint.activate([
            pila.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 28),
            pila.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            pila.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            pila.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            listo.heightAnchor.constraint(equalToConstant: 50),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        do { try empezar() } catch { cerrar(nil, "No se ha podido empezar a escuchar (\(error.localizedDescription))") }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // (cerrada arrastrando hacia abajo: como cancelar)
        if !acabado { cerrar(nil, nil) }
    }

    private func empezar() throws {
        guard let r = reconocedor, r.isAvailable, r.supportsOnDeviceRecognition else {
            cerrar(nil, "Ahora mismo el iPhone no puede reconocer la voz. Usa el micrófono del teclado.")
            return
        }
        let sesion = AVAudioSession.sharedInstance()
        try sesion.setCategory(.record, mode: .measurement, options: .duckOthers)
        try sesion.setActive(true, options: .notifyOthersOnDeactivation)
        let p = SFSpeechAudioBufferRecognitionRequest()
        p.shouldReportPartialResults = true
        p.requiresOnDeviceRecognition = true
        p.taskHint = .dictation
        peticion = p
        let entrada = motor.inputNode
        entrada.installTap(onBus: 0, bufferSize: 1024, format: entrada.outputFormat(forBus: 0)) { [weak p] b, _ in p?.append(b) }
        motor.prepare()
        try motor.start()
        tarea = r.recognitionTask(with: p) { [weak self] res, error in
            DispatchQueue.main.async {
                guard let self, !self.acabado else { return }
                if let res {
                    self.entendido = res.bestTranscription.formattedString
                    self.texto.text = self.entendido.isEmpty ? " " : self.entendido
                    if res.isFinal { self.cerrar(self.entendido, nil); return }
                    // al callarte 2 segundos (ya con algo dicho), se manda
                    self.silencio?.invalidate()
                    self.silencio = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { [weak self] _ in DispatchQueue.main.async { self?.terminar() } }
                } else if error != nil {
                    self.cerrar(self.entendido.isEmpty ? nil : self.entendido, self.entendido.isEmpty ? "No te he entendido" : nil)
                }
            }
        }
        // como mucho un minuto escuchando
        tope = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in DispatchQueue.main.async { self?.terminar() } }
    }

    /// deja de escuchar y espera un momento la última versión del texto
    private func terminar() {
        guard !acabado else { return }
        silencio?.invalidate()
        pararAudio()
        peticion?.endAudio()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            guard let self, !self.acabado else { return }
            self.cerrar(self.entendido.isEmpty ? nil : self.entendido, self.entendido.isEmpty ? "No te he entendido" : nil)
        }
    }

    private func pararAudio() {
        if motor.isRunning { motor.stop() }
        motor.inputNode.removeTap(onBus: 0)
    }

    private func cerrar(_ t: String?, _ motivo: String?) {
        guard !acabado else { return }
        acabado = true
        silencio?.invalidate()
        tope?.invalidate()
        pararAudio()
        tarea?.cancel()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        let limpio = t?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cb = alAcabar
        alAcabar = nil
        if presentingViewController != nil { dismiss(animated: true) }
        cb?(limpio?.isEmpty == false ? limpio : nil, limpio?.isEmpty == false ? nil : motivo)
    }
}
