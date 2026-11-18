package es.fantasymanager.app;

import android.content.SharedPreferences;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * (16 nov, Carlos: «que sea fácil actualizar») Si Google Play tiene una versión más nueva de la app, se ofrece dentro de
 * la propia app con la pantalla de Google («Actualizar»), sin ir a la tienda. Hasta ahora, a quien tenía la parte del
 * móvil vieja no le llegaba la web nueva y nada le decía que actualizase. Una vez cada 12 h por versión si la deja para
 * luego; si una actualización se quedó a medias, se retoma al volver a la app.
 */
final class ActualizarPlay {
    static final int PEDIDO = 31;
    private static final long CADA = 12 * 3600_000L;
    private static long ultimaMirada;

    private ActualizarPlay() {
    }

    static void mirar(Principal act) {
        long ahora = System.currentTimeMillis();
        if (ahora - ultimaMirada < 60_000L) return;
        ultimaMirada = ahora;
        final AppUpdateManager m;
        try {
            m = AppUpdateManagerFactory.create(act.getApplicationContext());
        } catch (Throwable t) {
            return;
        }
        m.getAppUpdateInfo().addOnSuccessListener(info -> {
            try {
                if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    lanzar(m, info, act);
                    return;
                }
                if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE || !info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) return;
                SharedPreferences p = act.getSharedPreferences("actualizar-play", 0);
                int codigo = info.availableVersionCode();
                if (p.getInt("codigo", 0) == codigo && System.currentTimeMillis() - p.getLong("t", 0) < CADA) return;
                p.edit().putInt("codigo", codigo).putLong("t", System.currentTimeMillis()).apply();
                lanzar(m, info, act);
            } catch (Throwable t) {
                // nada: si Google Play no deja, la app sigue como siempre
            }
        });
    }

    private static void lanzar(AppUpdateManager m, AppUpdateInfo info, Principal act) {
        if (act.isFinishing()) return;
        try {
            m.startUpdateFlowForResult(info, act, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(), PEDIDO);
        } catch (Throwable t) {
            // nada
        }
    }

    static boolean resultado(int pedido) {
        return pedido == PEDIDO;
    }
}
