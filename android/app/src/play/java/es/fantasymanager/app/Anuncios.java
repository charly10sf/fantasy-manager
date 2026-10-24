package es.fantasymanager.app;

import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

/**
 * Los anuncios de la versión de Google Play (AdMob):
 * - El consentimiento de la UE (UMP) cada vez que se abre la app (si falla sin red, otra vez al volver a ella); sin él
 *   no se pide ningún anuncio. Se cambia desde Ajustes («Privacidad de los anuncios»).
 * - Un banner adaptativo debajo de la web, bajo la barra de pestañas y con aire entre medias. Su hueco se reserva en
 *   cuanto AdMob arranca, para que las pestañas no salten cuando llega o se va: la web dice si se ve (en todas las
 *   pestañas menos Pregunta, nunca en la carga, la entrada ni la pantalla del límite de minutos); si no, el hueco se
 *   queda vacío. Con el teclado abierto no hay hueco.
 * - Un bonificado para lo que la web quiera desbloquear («plan»: pedir otro plan a la IA). La web recibe
 *   anuncioVisto(para, visto, motivo) al acabar, pase lo que pase.
 * La versión de GitHub (src/github) no lleva nada de esto.
 */
final class Anuncios {
    static final boolean HAY = true;
    /** un bonificado cargado caduca (Google dice una hora): se pide otro pasados 50 minutos */
    private static final long CADUCA = 50 * 60 * 1000L;
    private static Principal act;
    private static FrameLayout hueco;
    private static ConsentInformation consentimiento;
    private static boolean pidiendo;
    /** iniciado: ya se ha llamado a AdMob; listo: AdMob ya ha arrancado */
    private static volatile boolean iniciado, listo;
    private static AdView banner;
    private static int anchoBanner;
    private static boolean quiere, teclado, cargado, reintentar;
    private static int fallos;
    private static RewardedAd bonificado;
    private static long bonificadoT;
    private static boolean cargandoBonificado, ensenando;
    /** lo que espera al bonificado que se está cargando */
    private static String pendiente;

    private Anuncios() {
    }

    /** al abrir la app: el consentimiento y, con él, AdMob */
    static void alCrear(Principal a, FrameLayout h) {
        // si Android ha vuelto a crear la pantalla, lo de la anterior no vale: banner nuevo en el hueco nuevo
        if (act != null && act != a) soltar();
        act = a;
        hueco = h;
        h.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
            // girar el móvil o abrir un plegable cambia el ancho: el banner se hace otra vez a su medida
            if (banner != null && Math.abs((r - l) - anchoBanner) > 2 && r - l > 0) v.post(Anuncios::rehacerBanner);
        });
        if (listo) {
            cargarBanner();
            cargarBonificado();
        }
        pedirConsentimiento();
    }

    private static void pedirConsentimiento() {
        final Principal a = act;
        if (a == null || pidiendo) return;
        try {
            consentimiento = UserMessagingPlatform.getConsentInformation(a);
            pidiendo = true;
            ConsentRequestParameters p = new ConsentRequestParameters.Builder().build();
            consentimiento.requestConsentInfoUpdate(a, p,
                    () -> {
                        pidiendo = false;
                        if (a.isFinishing() || a.isDestroyed() || a != act) return;
                        UserMessagingPlatform.loadAndShowConsentFormIfRequired(a, error -> empezar());
                    },
                    error -> {
                        pidiendo = false;
                        empezar();
                    });
            // si ya lo dio otra vez, no hace falta esperar a que conteste
            if (consentimiento.canRequestAds()) empezar();
        } catch (Throwable t) {
            pidiendo = false;
            // sin consentimiento no hay anuncios: la app sigue igual
        }
    }

    private static void empezar() {
        if (act == null || iniciado || consentimiento == null || !consentimiento.canRequestAds()) return;
        iniciado = true;
        final Principal a = act;
        new Thread(() -> {
            try {
                MobileAds.initialize(a.getApplicationContext(), estado -> a.runOnUiThread(() -> {
                    listo = true;
                    cargarBanner();
                    cargarBonificado();
                }));
            } catch (Throwable t) {
                iniciado = false;
            }
        }, "anuncios").start();
    }

    /* ---------------- el banner ---------------- */

    private static AdSize tamano() {
        DisplayMetrics m = act.getResources().getDisplayMetrics();
        int px = hueco.getWidth() > 0 ? hueco.getWidth() : m.widthPixels;
        anchoBanner = px;
        return AdSize.getLargeAnchoredAdaptiveBannerAdSize(act, (int) (px / m.density));
    }

    private static AdRequest pedido() {
        return new AdRequest.Builder().build();
    }

    private static void cargarBanner() {
        if (act == null || hueco == null || !listo || BuildConfig.BANNER.isEmpty()) return;
        if (banner == null) {
            final AdView b = new AdView(act);
            AdSize s = tamano();
            b.setAdUnitId(BuildConfig.BANNER);
            b.setAdSize(s);
            b.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    if (b != banner) return;
                    cargado = true;
                    fallos = 0;
                    colocar();
                }

                @Override
                public void onAdFailedToLoad(LoadAdError e) {
                    if (b != banner) return;
                    // si ya había uno, se queda el de antes; si no, se vuelve a probar en un rato (cada vez más
                    // tarde, hasta 10 minutos) y solo con la app y el banner a la vista
                    if (cargado) return;
                    fallos++;
                    long espera = Math.min(600000L, 30000L * (1L << Math.min(fallos, 5)));
                    if (hueco != null) hueco.postDelayed(Anuncios::probarOtraVez, espera);
                }
            });
            // el hueco se reserva ya, con la altura del banner: así las pestañas no se mueven cuando llega
            hueco.addView(b, new FrameLayout.LayoutParams(s.getWidthInPixels(act), s.getHeightInPixels(act), Gravity.CENTER_HORIZONTAL));
            banner = b;
            colocar();
        }
        banner.loadAd(pedido());
    }

    private static void probarOtraVez() {
        if (banner == null || cargado) return;
        if (act != null && act.aLaVista && quiere && !teclado) banner.loadAd(pedido());
        else reintentar = true;
    }

    private static void rehacerBanner() {
        if (banner == null || hueco == null) return;
        hueco.removeView(banner);
        banner.destroy();
        banner = null;
        cargado = false;
        cargarBanner();
    }

    private static void colocar() {
        if (hueco == null) return;
        int v = banner == null || teclado ? View.GONE : quiere && cargado ? View.VISIBLE : View.INVISIBLE;
        if (hueco.getVisibility() != v) hueco.setVisibility(v);
        if (banner != null) {
            if (v == View.VISIBLE) banner.resume();
            else banner.pause();
        }
        if (v == View.VISIBLE && reintentar && banner != null && !cargado) {
            reintentar = false;
            banner.loadAd(pedido());
        }
    }

    /** la web dice si en la pantalla de ahora va el banner */
    static void banner(boolean si) {
        quiere = si;
        Principal a = act;
        if (a != null) a.runOnUiThread(Anuncios::colocar);
    }

    /** con el teclado abierto, sin banner ni hueco (lo llama la pantalla, en su hilo) */
    static void teclado(boolean abierto) {
        if (teclado == abierto) return;
        teclado = abierto;
        colocar();
    }

    static void alPausar() {
        if (banner != null) banner.pause();
    }

    static void alVolver() {
        colocar();
        // si al abrir no hubo red para el consentimiento, se prueba otra vez
        if (!iniciado) pedirConsentimiento();
    }

    /** la pantalla se cierra: solo si es la de ahora (Android puede crear la nueva antes de cerrar la vieja) */
    static void alCerrar(Principal a) {
        if (a != act) return;
        soltar();
        act = null;
        hueco = null;
    }

    private static void soltar() {
        if (banner != null) {
            if (hueco != null) hueco.removeView(banner);
            banner.destroy();
        }
        banner = null;
        cargado = false;
        reintentar = false;
        pendiente = null;
        bonificado = null;
        ensenando = false;
    }

    /* ---------------- el bonificado ---------------- */

    private static void cargarBonificado() {
        if (act == null || !listo || cargandoBonificado || BuildConfig.BONIFICADO.isEmpty()) return;
        if (bonificado != null && System.currentTimeMillis() - bonificadoT < CADUCA) return;
        bonificado = null;
        cargandoBonificado = true;
        final Principal a = act;
        RewardedAd.load(a.getApplicationContext(), BuildConfig.BONIFICADO, pedido(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(RewardedAd ad) {
                cargandoBonificado = false;
                if (a != act) return;
                bonificado = ad;
                bonificadoT = System.currentTimeMillis();
                if (pendiente != null) {
                    String para = pendiente;
                    pendiente = null;
                    // si mientras tanto ha salido de la app, no se le enseña nada: va gratis
                    if (act.aLaVista) ensenar(para);
                    else responder(para, false, "sin anuncio");
                }
            }

            @Override
            public void onAdFailedToLoad(LoadAdError e) {
                cargandoBonificado = false;
                bonificado = null;
                if (pendiente != null) {
                    String para = pendiente;
                    pendiente = null;
                    responder(para, false, "sin anuncio");
                }
            }
        });
    }

    /** enseña el bonificado; si aún no ha llegado, lo espera 10 segundos */
    static void ver(Principal a, String para) {
        a.runOnUiThread(() -> {
            if (ensenando || pendiente != null) return;
            if (!listo) {
                responder(para, false, iniciado ? "sin anuncio" : "sin consentimiento");
                return;
            }
            if (bonificado != null && System.currentTimeMillis() - bonificadoT < CADUCA) {
                ensenar(para);
                return;
            }
            pendiente = para;
            cargarBonificado();
            if (hueco != null) hueco.postDelayed(() -> {
                if (para.equals(pendiente)) {
                    pendiente = null;
                    responder(para, false, "sin anuncio");
                }
            }, 10000);
        });
    }

    /** la web ya no lo quiere (ha cerrado la ventana): si se estaba cargando, no se enseña */
    static void cancelar() {
        Principal a = act;
        if (a != null) a.runOnUiThread(() -> pendiente = null);
    }

    private static void ensenar(String para) {
        RewardedAd ad = bonificado;
        bonificado = null;
        if (ad == null || act == null) {
            responder(para, false, "sin anuncio");
            return;
        }
        ensenando = true;
        final boolean[] premio = {false};
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                ensenando = false;
                responder(para, premio[0], premio[0] ? "" : "cerrado antes de tiempo");
                cargarBonificado();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError e) {
                ensenando = false;
                responder(para, false, "no se pudo enseñar");
                cargarBonificado();
            }
        });
        ad.show(act, item -> premio[0] = true);
    }

    private static void responder(String para, boolean visto, String motivo) {
        Principal a = act;
        if (a != null) a.js("window.anuncioVisto && anuncioVisto(" + JSONObject.quote(para) + "," + visto + "," + JSONObject.quote(motivo) + ")");
    }

    /* ---------------- la privacidad ---------------- */

    /** si hay que dejar cambiar el consentimiento desde Ajustes (en la UE, sí) */
    static boolean hayPrivacidad() {
        return consentimiento != null && consentimiento.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    /** el formulario para cambiar el consentimiento */
    static void privacidad(Principal a) {
        a.runOnUiThread(() -> {
            try {
                UserMessagingPlatform.showPrivacyOptionsForm(a, error -> empezar());
            } catch (Throwable t) {
                // sin formulario
            }
        });
    }
}
