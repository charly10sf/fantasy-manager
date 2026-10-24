package es.fantasymanager.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import java.io.File;

/**
 * La versión que se instala desde GitHub: la propia app baja el APK nuevo de las releases y abre el instalador
 * de Android. La de Google Play (src/play) no tiene nada de esto: se actualiza desde la tienda.
 */
final class Canal {
    static final String NOMBRE = "github";
    /** con el servicio en primer plano mientras la IA trabaja (Trabajo) */
    static final boolean TRABAJO = true;
    private static final int PERMISO_INSTALAR = 8;
    private static File pendiente;

    private Canal() {
    }

    /** baja el APK de la dirección (solo las releases del repositorio) */
    static void actualizar(Principal act, String url) {
        if (!Actualizador.valida(url)) {
            act.progreso(-1, "dirección no válida");
            return;
        }
        new Thread(() -> Actualizador.bajar(act, url)).start();
    }

    /** instala lo que se haya bajado */
    static void instalar(Principal act) {
        instalar(act, Actualizador.archivo(act));
    }

    /** abre el instalador de Android con el APK; la primera vez pide permiso para instalar desde la app */
    static void instalar(Principal act, File f) {
        if (f == null || !f.exists()) {
            act.progreso(-1, "no hay nada descargado");
            return;
        }
        if (!act.getPackageManager().canRequestPackageInstalls()) {
            pendiente = f;
            act.progreso(100, "permiso");
            try {
                act.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName())), PERMISO_INSTALAR);
            } catch (Exception e) {
                act.progreso(-1, "no se pudo abrir el permiso");
            }
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(Archivos.uri(), "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            act.startActivity(i);
        } catch (Exception e) {
            act.progreso(-1, "no se pudo abrir el instalador");
        }
    }

    /** la vuelta del permiso de instalar: si lo ha dado, se instala */
    static boolean resultado(Principal act, int pedido) {
        if (pedido != PERMISO_INSTALAR) return false;
        File f = pendiente;
        pendiente = null;
        if (f != null && act.getPackageManager().canRequestPackageInstalls()) instalar(act, f);
        else act.progreso(100, "permiso");
        return true;
    }
}
