package es.fantasymanager.app;

import android.os.Handler;
import android.os.Looper;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
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
 * - Desde la 0.8 (Carlos, 16 nov) ya no hay banner debajo de la web: la pantalla se ve entera. En su lugar, un
 *   intersticial (pantalla completa, se cierra con la X) que la web pide solo en una pausa natural (al cambiar de
 *   pestaña o al cerrar una ficha) y con sus tiempos (intersticial.js y «intersticial» de limites.json). Aquí se vuelve
 *   a comprobar lo que solo sabe Android: la app a la vista, sin teclado, sin la IA trabajando (Puente.ocupada), sin un
 *   bonificado en pantalla o recién visto y con un mínimo de minutos desde el anterior, pase lo que pase en la web. Si no
 *   hay uno cargado, contesta que no y lo carga para la próxima pausa; si la carga falla, espera cada vez más (hasta
 *   media hora) antes de probar otra vez, y solo cuando la web vuelve a pedir uno: nada de reintentos en bucle.
 * - Anuncios solo con la sesión de la liga iniciada (Carlos, 8 nov; revisión total, A1): hasta la primera vez que la web
 *   dice zona(true) (solo con tu liga cargada: nunca en la entrada, la carga, la demo ni la pantalla del límite) no se
 *   carga ni se precarga nada. Después, el intersticial y el bonificado se dejan precargados para que no hagan esperar.
 * - Un bonificado para lo que la web quiera desbloquear («plan», «preg», «top»…). La web recibe anuncioVisto(para,
 *   visto, motivo) al acabar, pase lo que pase. Si lo pide antes del primer zona(true), se carga en ese momento (lo ha
 *   pedido el usuario con un botón), sin dejar otro precargado.
 * La versión de GitHub (src/github) no lleva nada de esto.
 */
final class Anuncios {
    static final boolean HAY = true;
    /** un anuncio cargado caduca (Google dice una hora): se pide otro pasados 50 minutos */
    private static final long CADUCA = 50 * 60 * 1000L;
    /** el suelo de Android entre dos intersticiales, diga lo que diga la web (la web pide más: «cadaMin», 5 min) */
    private static final long ENTRE_INTERSTICIALES = 3 * 60 * 1000L;
    /** ni un intersticial en el minuto después de cerrar un bonificado (la web espera más: «trasBonificadoMin») */
    private static final long TRAS_BONIFICADO = 60 * 1000L;
    /** el tope de Android al día, por si la web fallara (la web pide menos: «maxDia», 6) */
    private static final int TOPE_DIA = 10;
    /** el bloque de la web («bloque» de limites.json) solo vale si es de la cuenta de AdMob de Fantasy Manager */
    private static final String CUENTA = "ca-app-pub-3175956326240112/";
    private static final Handler reloj = new Handler(Looper.getMainLooper());
    private static Principal act;
    private static ConsentInformation consentimiento;
    private static boolean pidiendo;
    /** iniciado: ya se ha llamado a AdMob; listo: AdMob ya ha arrancado */
    private static volatile boolean iniciado, listo;
    /** activado: la web de esta pantalla ya ha dicho alguna vez que su liga está cargada; quiere: lo dice ahora;
        conIntersticiales: a esta cuenta le tocan (al dueño y a los de su liga, no: ni se cargan) */
    private static boolean activado, quiere, teclado, conIntersticiales;
    private static RewardedAd bonificado;
    private static long bonificadoT, bonificadoFin;
    private static boolean cargandoBonificado, ensenando;
    /** lo que espera al bonificado que se está cargando */
    private static String pendiente;
    private static InterstitialAd intersticial;
    private static long intersticialT, ultimoIntersticial, esperaHasta;
    private static boolean cargandoIntersticial, ensenandoIntersticial;
    private static int fallosIntersticial, hoyN;
    private static long hoyDia;
    /** el bloque que manda la web, si la app no lleva uno puesto (BuildConfig.INTERSTICIAL) */
    private static String bloqueWeb = "";

    private Anuncios() {
    }

    /** al abrir la app: el consentimiento y, con él, AdMob */
    static void alCrear(Principal a) {
        // si Android ha vuelto a crear la pantalla, lo de la anterior no vale
        if (act != null && act != a) soltar();
        act = a;
        // pantalla nueva, web nueva: hasta que diga zona(true), nada (aunque AdMob ya estuviera arrancado)
        quiere = false;
        activado = false;
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
                    // si la web ya lo había dicho mientras AdMob arrancaba; si no, se espera a su zona(true)
                    if (activado) {
                        cargarIntersticial();
                        cargarBonificado();
                    }
                }));
            } catch (Throwable t) {
                iniciado = false;
            }
        }, "anuncios").start();
    }

    private static AdRequest pedido() {
        return new AdRequest.Builder().build();
    }

    /** la web dice si su liga está cargada (y no está la pantalla del límite): hasta la primera vez, ningún anuncio */
    static void zona(boolean si, String bloque, boolean inter) {
        Principal a = act;
        if (a == null) return;
        a.runOnUiThread(() -> {
            if (a != act) return;
            if (bloque != null && bloque.startsWith(CUENTA) && bloque.matches("ca-app-pub-\\d{16}/\\d{10}")) bloqueWeb = bloque;
            quiere = si;
            boolean antes = conIntersticiales;
            conIntersticiales = si && inter;
            if (!conIntersticiales) intersticial = null;
            if (si && !activado) {
                // la primera vez: ahora sí, el intersticial (si le tocan) y el bonificado precargados
                activado = true;
                cargarIntersticial();
                cargarBonificado();
            } else if (conIntersticiales && !antes) cargarIntersticial();
        });
    }

    /** con el teclado abierto, ningún intersticial (lo llama la pantalla, en su hilo) */
    static void teclado(boolean abierto) {
        teclado = abierto;
    }

    static void alPausar() {
    }

    static void alVolver() {
        // si al abrir no hubo red para el consentimiento, se prueba otra vez
        if (!iniciado) pedirConsentimiento();
    }

    /** la pantalla se cierra: solo si es la de ahora (Android puede crear la nueva antes de cerrar la vieja) */
    static void alCerrar(Principal a) {
        if (a != act) return;
        soltar();
        act = null;
    }

    private static void soltar() {
        quiere = false;
        conIntersticiales = false;
        activado = false;
        pendiente = null;
        bonificado = null;
        ensenando = false;
        intersticial = null;
        ensenandoIntersticial = false;
    }

    /* ---------------- el intersticial ---------------- */

    /** el bloque: el de la app si lo lleva (el de prueba de Google con fm.anunciosReales=false); si no, el de la web */
    private static String bloqueIntersticial() {
        return !BuildConfig.INTERSTICIAL.isEmpty() ? BuildConfig.INTERSTICIAL : bloqueWeb;
    }

    private static void cargarIntersticial() {
        if (act == null || !listo || !activado || !conIntersticiales || cargandoIntersticial || ensenandoIntersticial) return;
        long ahora = System.currentTimeMillis();
        if (intersticial != null && ahora - intersticialT < CADUCA) return;
        String id = bloqueIntersticial();
        if (id.isEmpty() || ahora < esperaHasta) return;
        intersticial = null;
        cargandoIntersticial = true;
        final Principal a = act;
        InterstitialAd.load(a.getApplicationContext(), id, pedido(), new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(InterstitialAd ad) {
                cargandoIntersticial = false;
                if (a != act) return;
                intersticial = ad;
                intersticialT = System.currentTimeMillis();
                fallosIntersticial = 0;
            }

            @Override
            public void onAdFailedToLoad(LoadAdError e) {
                cargandoIntersticial = false;
                intersticial = null;
                // no se vuelve a probar solo: en la próxima pausa, y cada vez más tarde (1, 2, 4… hasta 30 minutos)
                fallosIntersticial++;
                esperaHasta = System.currentTimeMillis() + Math.min(30 * 60000L, 60000L * (1L << Math.min(fallosIntersticial - 1, 5)));
            }
        });
    }

    /** por qué no se puede enseñar ahora (null: se puede) */
    private static String porQueNo(Principal a) {
        long ahora = System.currentTimeMillis();
        if (!listo) return iniciado ? "sin anuncio" : "sin consentimiento";
        if (!activado || !quiere) return "pantalla";
        if (!conIntersticiales) return "no a esta cuenta";
        if (!a.aLaVista) return "fuera";
        if (teclado) return "teclado";
        if (Puente.ocupada) return "la IA trabaja";
        if (ensenando || pendiente != null || ensenandoIntersticial) return "otro anuncio";
        if (ahora - bonificadoFin < TRAS_BONIFICADO) return "tras un bonificado";
        if (ahora - ultimoIntersticial < ENTRE_INTERSTICIALES) return "muy seguido";
        long dia = ahora / 86400000L;
        if (dia != hoyDia) {
            hoyDia = dia;
            hoyN = 0;
        }
        if (hoyN >= TOPE_DIA) return "tope del día";
        return null;
    }

    /** la web lo pide en una pausa natural; contesta con intersticialVisto(ok, motivo) */
    static void intersticial(String bloque) {
        Principal a = act;
        if (a == null) return;
        a.runOnUiThread(() -> {
            if (a != act) return;
            if (bloque != null && bloque.startsWith(CUENTA) && bloque.matches("ca-app-pub-\\d{16}/\\d{10}")) bloqueWeb = bloque;
            String no = porQueNo(a);
            if (no != null) {
                responderIntersticial(false, no);
                return;
            }
            InterstitialAd ad = intersticial;
            if (ad == null || System.currentTimeMillis() - intersticialT >= CADUCA) {
                // sin uno listo no pasa nada: se carga para la próxima pausa
                intersticial = null;
                responderIntersticial(false, "sin anuncio");
                cargarIntersticial();
                return;
            }
            intersticial = null;
            ensenandoIntersticial = true;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    ultimoIntersticial = System.currentTimeMillis();
                    hoyN++;
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    ensenandoIntersticial = false;
                    ultimoIntersticial = System.currentTimeMillis();
                    responderIntersticial(true, "");
                    cargarIntersticial();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError e) {
                    ensenandoIntersticial = false;
                    responderIntersticial(false, "no se pudo enseñar");
                    cargarIntersticial();
                }
            });
            ad.show(a);
        });
    }

    private static void responderIntersticial(boolean visto, String motivo) {
        Principal a = act;
        if (a != null) a.js("window.intersticialVisto && intersticialVisto(" + visto + "," + JSONObject.quote(motivo) + ")");
    }

    /* ---------------- el bonificado ---------------- */

    private static void cargarBonificado() {
        // precargado solo después del primer zona(true); antes, solo si lo acaba de pedir el usuario (ver)
        if (act == null || !listo || cargandoBonificado || BuildConfig.BONIFICADO.isEmpty() || (!activado && pendiente == null)) return;
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
            if (ensenando || pendiente != null || ensenandoIntersticial) return;
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
            reloj.postDelayed(() -> {
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
                bonificadoFin = System.currentTimeMillis();
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
