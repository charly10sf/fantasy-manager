package es.fantasymanager.app;

import android.net.Uri;

/**
 * La versión de Google Play: las actualizaciones las hace la tienda. Si la web pide actualizar, se abre la ficha
 * de la app en Google Play; la app nunca baja ni instala nada por su cuenta.
 */
final class Canal {
    static final String NOMBRE = "play";
    /** sin el servicio en primer plano de la IA (Google Play pide justificarlo con un vídeo): src/play/AndroidManifest.xml */
    static final boolean TRABAJO = false;

    private Canal() {
    }

    static void actualizar(Principal act, String url) {
        act.runOnUiThread(() -> act.abrirFuera(Uri.parse("https://play.google.com/store/apps/details?id=" + act.getPackageName())));
    }

    static void instalar(Principal act) {
        actualizar(act, null);
    }

    static boolean resultado(Principal act, int pedido) {
        return false;
    }
}
