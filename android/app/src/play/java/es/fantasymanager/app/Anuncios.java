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
 * - El consentimiento de la UE (UMP) la primera vez que se abre la app; sin él no se pide ningún anuncio. Se puede
 *   cambiar después desde Ajustes («Privacidad de los anuncios»).
 * - Un banner adaptativo debajo de la web, bajo la barra de pestañas. Solo en las pestañas que dice la web (nunca en
 *   Pregunta ni mientras carga), solo cuando ya hay anuncio (si no, no deja hueco) y nunca con el teclado abierto.
 * - Un bonificado para lo que la web quiera desbloquear («plan»: pedir otro plan a la IA). La web recibe
 *   anuncioVisto(para, visto, motivo) al acabar.
 * La versión de GitHub (src/github) no lleva nada de esto.
 */
final class Anuncios {
    static final boolean HAY = true;
    private static Principal act;
    private static FrameLayout hueco;
    private static ConsentInformation consentimiento;
    /** iniciado: ya se ha llamado a AdMob; listo: AdMob ya ha arrancado */
    private static volatile boolean iniciado, listo;
    private static AdView banner;
    private static boolean quiere, teclado, cargado;
    private static int fallos;
    private static RewardedAd bonificado;
    private static boolean cargandoBonificado;
    /** lo que espera al bonificado que se está cargando */
    private static String pendiente;

    private Anuncios() {
    }

    /** al abrir la app: el consentimiento y, con él, AdMob */
    static void alCrear(Principal a, FrameLayout h) {
        act = a;
        hueco = h;
        // (si Android ha vuelto a crear la pantalla, AdMob ya está en marcha: solo falta el banner nuevo)
        if (listo) {
            cargarBanner();
            cargarBonificado();
        }
        try {
            consentimiento = UserMessagingPlatform.getConsentInformation(a);
            ConsentRequestParameters p = new ConsentRequestParameters.Builder().build();
            consentimiento.requestConsentInfoUpdate(a, p,
                    () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(a, error -> empezar()),
                    error -> empezar());
            // si ya lo dio otra vez, no hace falta esperar a que conteste
            if (consentimiento.canRequestAds()) empezar();
        } catch (Throwable t) {
            // sin consentimiento no hay anuncios: la app sigue igual
        }
    }

    private static void empezar() {
        if (act == null || iniciado || consentimiento == null || !consentimiento.canRequestAds()) return;
        iniciado = true;
        final Principal a = act;
        new Thread(() -> {
            try {
                MobileAds.initialize(a, estado -> a.runOnUiThread(() -> {
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
        float px = hueco.getWidth() > 0 ? hueco.getWidth() : m.widthPixels;
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(act, (int) (px / m.density));
    }

    private static void cargarBanner() {
        if (act == null || hueco == null || !listo || BuildConfig.BANNER.isEmpty()) return;
        if (banner == null) {
            banner = new AdView(act);
            banner.setAdUnitId(BuildConfig.BANNER);
            banner.setAdSize(tamano());
            banner.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    cargado = true;
                    fallos = 0;
                    colocar();
                }

                @Override
                public void onAdFailedToLoad(LoadAdError e) {
                    cargado = false;
                    colocar();
                    // sin anuncio ahora: se vuelve a probar en un rato (cada vez más tarde, hasta 10 minutos)
                    fallos++;
                    long espera = Math.min(600000L, 30000L * (1L << Math.min(fallos, 5)));
                    if (hueco != null) hueco.postDelayed(() -> {
                        if (banner != null) banner.loadAd(new AdRequest.Builder().build());
                    }, espera);
                }
            });
            hueco.addView(banner, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL));
        }
        banner.loadAd(new AdRequest.Builder().build());
    }

    private static void colocar() {
        if (hueco == null) return;
        int v = quiere && !teclado && cargado ? View.VISIBLE : View.GONE;
        if (hueco.getVisibility() != v) hueco.setVisibility(v);
    }

    /** la web dice si en la pantalla de ahora va el banner */
    static void banner(boolean si) {
        quiere = si;
        if (act != null) act.runOnUiThread(Anuncios::colocar);
    }

    /** con el teclado abierto, sin banner (lo llama la pantalla, en su hilo) */
    static void teclado(boolean abierto) {
        teclado = abierto;
        colocar();
    }

    static void alPausar() {
        if (banner != null) banner.pause();
    }

    static void alVolver() {
        if (banner != null) banner.resume();
    }

    static void alCerrar() {
        if (banner != null) banner.destroy();
        banner = null;
        cargado = false;
        pendiente = null;
        act = null;
        hueco = null;
    }

    /* ---------------- el bonificado ---------------- */

    private static void cargarBonificado() {
        if (act == null || !listo || bonificado != null || cargandoBonificado || BuildConfig.BONIFICADO.isEmpty()) return;
        cargandoBonificado = true;
        RewardedAd.load(act, BuildConfig.BONIFICADO, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(RewardedAd ad) {
                bonificado = ad;
                cargandoBonificado = false;
                if (pendiente != null) {
                    String para = pendiente;
                    pendiente = null;
                    ensenar(para);
                }
            }

            @Override
            public void onAdFailedToLoad(LoadAdError e) {
                bonificado = null;
                cargandoBonificado = false;
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
            if (!listo) {
                responder(para, false, iniciado ? "sin anuncio" : "sin consentimiento");
                return;
            }
            if (bonificado != null) {
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

    private static void ensenar(String para) {
        RewardedAd ad = bonificado;
        bonificado = null;
        if (ad == null || act == null) {
            responder(para, false, "sin anuncio");
            return;
        }
        final boolean[] premio = {false};
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                responder(para, premio[0], premio[0] ? "" : "cerrado antes de tiempo");
                cargarBonificado();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError e) {
                responder(para, false, "no se pudo enseñar");
                cargarBonificado();
            }
        });
        ad.show(act, item -> premio[0] = true);
    }

    private static void responder(String para, boolean visto, String motivo) {
        if (act != null) act.js("window.anuncioVisto && anuncioVisto(" + JSONObject.quote(para) + "," + visto + "," + JSONObject.quote(motivo) + ")");
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
