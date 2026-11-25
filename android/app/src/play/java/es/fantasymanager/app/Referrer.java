package es.fantasymanager.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;

import java.net.URLDecoder;

/**
 * (25 nov, tanda 6 de la auditoría de fallos: 6 códigos de invitar sacados y ningún canje) Quien abre el enlace de un amigo
 * en un Android acaba en Google Play y el código se perdía. La web lo manda a Play con «&referrer=inv%3D<código>» y Google
 * Play se lo guarda a la instalación: aquí se lee UNA vez, en la primera apertura (Install Referrer API), y se deja en las
 * preferencias para que la web lo recoja por el puente (Puente.invitacion) y lo canjee al entrar en la liga. Solo el
 * código (letras y números, 12 como mucho); el resto del referrer (utm de Play) no se guarda.
 */
final class Referrer {
    static final String CLAVE = "inv_ref";
    private static final String MIRADO = "inv_ref_mirado";
    private static boolean enMarcha;

    private Referrer() {
    }

    static void leer(Context ctx) {
        final Context c = ctx.getApplicationContext();
        final SharedPreferences p = Puente.prefs(c);
        if (p.getBoolean(MIRADO, false) || enMarcha) return;
        enMarcha = true;
        final InstallReferrerClient cl;
        try {
            cl = InstallReferrerClient.newBuilder(c).build();
        } catch (Throwable t) {
            enMarcha = false;
            return;
        }
        try {
            cl.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int r) {
                    try {
                        if (r == InstallReferrerClient.InstallReferrerResponse.OK) {
                            ReferrerDetails d = cl.getInstallReferrer();
                            String cod = codigo(d == null ? null : d.getInstallReferrer());
                            SharedPreferences.Editor e = p.edit().putBoolean(MIRADO, true);
                            if (cod != null) e.putString(CLAVE, cod);
                            e.apply();
                        } else if (r == InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED
                                || r == InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR) {
                            // sin Google Play que lo diga: no se vuelve a preguntar
                            p.edit().putBoolean(MIRADO, true).apply();
                        }
                        // SERVICE_UNAVAILABLE y los demás: se prueba en la próxima apertura
                    } catch (Throwable t) {
                        // nada: en la próxima apertura
                    } finally {
                        enMarcha = false;
                        try {
                            cl.endConnection();
                        } catch (Throwable t) {
                            // nada
                        }
                    }
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    enMarcha = false;
                }
            });
        } catch (Throwable t) {
            enMarcha = false;
        }
    }

    /** «inv=ABC234» (con lo demás de Play alrededor, «utm_source=…&inv=…») → «ABC234»; si no hay, null */
    static String codigo(String ref) {
        if (ref == null || ref.isEmpty()) return null;
        String s = ref;
        try {
            // por si llega sin descodificar (inv%3DABC234)
            if (!s.contains("=") && s.contains("%")) s = URLDecoder.decode(s, "UTF-8");
        } catch (Exception e) {
            return null;
        }
        for (String par : s.split("&")) {
            int i = par.indexOf('=');
            if (i <= 0 || !"inv".equals(par.substring(0, i))) continue;
            String v;
            try {
                v = URLDecoder.decode(par.substring(i + 1), "UTF-8");
            } catch (Exception e) {
                return null;
            }
            v = v.trim().toUpperCase();
            return v.matches("[A-Z0-9]{4,12}") ? v : null;
        }
        return null;
    }
}
