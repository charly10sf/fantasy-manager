package es.fantasymanager.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.browser.auth.AuthTabColorSchemeParams;
import androidx.browser.auth.AuthTabIntent;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.core.app.ActivityOptionsCompat;

import java.util.List;

/**
 * La entrada de LaLiga por Auth Tab (21 nov; androidx.browser 1.9.0, Chrome 137 o más).
 *
 * Por qué: la vuelta del inicio de sesión es authredirect://com.lfp.laligafantasy, la misma dirección que recoge la app
 * de LaLiga Fantasy. Con una pestaña normal (Custom Tab), esa vuelta sale del navegador como un intent y, con las dos
 * apps instaladas, Android pregunta «Abrir con»: quien elige la otra se queda fuera (un 36 % de los toques a «Entrar» se
 * perdía sin rastro, análisis del 21 nov). Con Auth Tab el navegador no lanza ningún intent: al llegar a una dirección
 * con ese esquema cierra la pestaña y se la devuelve a quien la abrió como resultado de la actividad
 * (onActivityResult), así que Android no tiene nada que preguntar.
 *
 * Cómo (guía de Auth Tab de developer.chrome.com y el código de AuthTabIntent 1.9.0): AuthTabIntent.launch(lanzador,
 * url, esquema) pone la dirección y el esquema en su intent y se lo pasa al lanzador. La guía crea el lanzador con
 * registerActivityResultLauncher, que pide una ComponentActivity; Principal es una Activity normal (y no se cambia: ya
 * recibe así el dictado y las fotos), así que el lanzador de aquí hace lo mismo que el de la librería por debajo:
 * startActivityForResult con ese intent. El resultado llega a Principal.onActivityResult con RESULT_OK y la dirección
 * de vuelta en los datos del intent, o con otro código si se cerró sin terminar.
 *
 * Si ningún navegador del móvil lleva Auth Tab (sin Chrome, o con uno anterior al 137), `abrir` devuelve false y
 * Principal abre la pestaña de siempre: la vuelta llega entonces por el intent-filter del manifiesto, como hasta ahora.
 */
final class AuthTab {
    /** el número del pedido en onActivityResult (10, 12 y 14 son los avisos, el dictado y las fotos) */
    static final int PEDIDO = 16;
    /** el esquema de la vuelta: el mismo de siempre (la redirect_uri no cambia) */
    static final String ESQUEMA = "authredirect";

    private AuthTab() {
    }

    /** Chrome, el primero entre los que no son el navegador por defecto: es el que trae Auth Tab desde la 137 */
    private static final String CHROME = "com.android.chrome";

    /**
     * El navegador en el que abrir la entrada con Auth Tab, o null si no hay ninguno que lo lleve.
     * Primero el de por defecto (el mismo que usa CustomTabsIntent.launchUrl sin paquete, lo de hasta ahora). Si ese no
     * lleva Auth Tab (21 nov, el móvil de Carlos: un Samsung con Samsung Internet por defecto, y Android seguía
     * preguntando «Abrir con»), cualquier otro instalado que sí: Chrome antes que los demás. Así basta con tener Chrome
     * 137 o más en el móvil, sea o no el navegador por defecto.
     */
    static String navegador(Context c) {
        try {
            String p = CustomTabsClient.getPackageName(c, null);
            if (p != null && CustomTabsClient.isAuthTabSupported(c, p)) return p;
            String otro = null;
            List<ResolveInfo> servicios = c.getPackageManager()
                    .queryIntentServices(new Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION), 0);
            for (ResolveInfo r : servicios) {
                String q = r.serviceInfo == null ? null : r.serviceInfo.packageName;
                if (q == null || !CustomTabsClient.isAuthTabSupported(c, q)) continue;
                if (CHROME.equals(q)) return q;
                if (otro == null) otro = q;
            }
            return otro;
        } catch (Exception e) {
            return null;
        }
    }

    /** Abre la página de entrar en un Auth Tab. false si no se puede: entonces se abre como siempre. */
    static boolean abrir(Activity act, Uri url, int colorBarra) {
        String p = navegador(act);
        if (p == null) return false;
        try {
            AuthTabIntent pestana = new AuthTabIntent.Builder()
                    .setDefaultColorSchemeParams(new AuthTabColorSchemeParams.Builder()
                            .setToolbarColor(colorBarra).build())
                    .build();
            // al navegador que se ha comprobado, no a otro que pudiera recoger el intent
            pestana.intent.setPackage(p);
            pestana.launch(new Lanzador(act), url, ESQUEMA);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** De onActivityResult: la dirección de vuelta (authredirect://…), o null si la pestaña se cerró sin terminar */
    static String vuelta(int resultado, Intent datos) {
        if (resultado != AuthTabIntent.RESULT_OK || datos == null) return null;
        Uri d = datos.getData();
        return d != null && ESQUEMA.equals(d.getScheme()) ? d.toString() : null;
    }

    /** el lanzador que espera AuthTabIntent.launch, para una Activity que no es ComponentActivity */
    private static final class Lanzador extends ActivityResultLauncher<Intent> {
        private final Activity act;

        Lanzador(Activity act) {
            this.act = act;
        }

        @Override
        public void launch(Intent intent, ActivityOptionsCompat opciones) {
            act.startActivityForResult(intent, PEDIDO, opciones == null ? null : opciones.toBundle());
        }

        @Override
        public void unregister() {
        }

        @Override
        public ActivityResultContract<Intent, ?> getContract() {
            return new ActivityResultContracts.StartActivityForResult();
        }
    }
}
