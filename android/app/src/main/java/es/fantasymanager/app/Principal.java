package es.fantasymanager.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * La app es la web de web/ (va dentro del APK) en un WebView, servida con https desde
 * appassets.androidplatform.net para que el navegador la trate como segura. El Puente le da a la web lo que
 * un navegador no puede: hablar con la API de LaLiga Fantasy sin CORS, abrir el inicio de sesión de LaLiga
 * en una pestaña de Chrome, guardar la sesión en el móvil y programar avisos.
 */
public class Principal extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String INICIO = "https://" + HOST + "/assets/index.html";
    private static final int PERMISO_AVISOS = 10;
    private static final int VOZ = 12;
    private static final int FOTOS = 14;
    private WebView web;
    private boolean cargada;
    volatile boolean aLaVista;
    /** la app está en pantalla: el trabajo en segundo plano no arranca */
    static volatile boolean abierta;
    /** la dirección authredirect://... con el código de LaLiga, hasta que la web la recoge */
    volatile String loginPendiente;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0A0B);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        // Desde Android 15 la app se dibuja de borde a borde, también debajo de la barra de arriba, de la de
        // abajo y del teclado. La web va en una caja que deja el hueco justo de lo que ocupan en cada momento.
        // Debajo de la web, el hueco del banner de los anuncios (solo en la versión de Google Play; si no, no se ve).
        FrameLayout caja = new FrameLayout(this);
        caja.setBackgroundColor(0xFF0A0A0B);
        android.widget.LinearLayout columna = new android.widget.LinearLayout(this);
        columna.setOrientation(android.widget.LinearLayout.VERTICAL);
        columna.addView(web, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        FrameLayout hueco = new FrameLayout(this);
        hueco.setBackgroundColor(0xFF050506);
        // aire entre las pestañas y el anuncio, y otro color, para no tocarlo sin querer
        int aire = Math.round(12 * getResources().getDisplayMetrics().density);
        hueco.setPadding(0, aire, 0, 0);
        hueco.setVisibility(android.view.View.GONE);
        columna.addView(hueco, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        caja.addView(columna, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(caja);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.setOnApplyWindowInsetsListener(caja, (v, ins) -> {
            Insets b = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets t = ins.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, Math.max(b.bottom, t.bottom));
            // con el teclado abierto, sin banner
            Anuncios.teclado(t.bottom > b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        // el botón y el gesto de atrás: desde Android 13 se registran así (en Android 16 onBackPressed ya no llega)
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::atras);
        }

        Web.preparar(web);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        final WebViewAssetLoader cargador = Web.cargador(this);

        web.addJavascriptInterface(new Puente(this), "FantasyApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                // primero lo que se haya bajado para tener la web al día (AlDia); si no, lo del APK
                WebResourceResponse nueva = AlDia.servir(Principal.this, r.getUrl());
                return nueva != null ? nueva : cargador.shouldInterceptRequest(r.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equalsIgnoreCase(u.getHost())) return false;
                abrirFuera(u);
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap icono) {
                AlDia.cargaT = System.currentTimeMillis();
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                boolean primera = !cargada;
                cargada = true;
                entregarLogin();
                vigilar();
                if (primera) web.postDelayed(() -> buscarWeb(false), 4000);
            }
        });
        web.setWebChromeClient(new WebChromeClient());

        loginPendiente = loginDe(getIntent());
        // si la web bajada no arrancó las dos últimas veces, se vuelve a la del APK
        AlDia.alAbrir(this);
        if (guardado != null) web.restoreState(guardado);
        else web.loadUrl(direccion(getIntent()));
        // los avisos se vuelven a programar por si el sistema los borró al actualizar la app
        Avisos.reprogramar(this);
        // y el trabajo de la IA en segundo plano
        Fondo.reprogramar(this);
        // los anuncios (solo en la versión de Google Play): primero el consentimiento
        Anuncios.alCrear(this, hueco);
    }

    @Override
    protected void onDestroy() {
        Anuncios.alCerrar(this);
        super.onDestroy();
    }

    /** La vuelta del inicio de sesión: authredirect://com.lfp.laligafantasy?code=... */
    private static String loginDe(Intent i) {
        Uri d = i == null ? null : i.getData();
        if (d != null && "authredirect".equals(d.getScheme())) return d.toString();
        return null;
    }

    /** Un aviso abre la app en una sección concreta (#mercado, #rivales...) */
    private String direccion(Intent i) {
        String h = i != null ? i.getStringExtra("hash") : null;
        return h != null && !h.isEmpty() ? INICIO + "#" + h.replaceAll("[^a-z0-9/_-]", "") : INICIO;
    }

    private void entregarLogin() {
        if (loginPendiente == null || !cargada) return;
        js("window.vueltaLogin && window.vueltaLogin()");
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        String l = loginDe(i);
        if (l != null) {
            loginPendiente = l;
            entregarLogin();
            return;
        }
        String h = i != null ? i.getStringExtra("hash") : null;
        if (h != null && !h.isEmpty()) js("location.hash = " + JSONObject.quote(h.replaceAll("[^a-z0-9/_-]", "")));
    }

    /** La página de LaLiga para entrar, en una pestaña de Chrome: ahí sí deja Google iniciar sesión */
    void abrirLogin(String url) {
        Uri u = Uri.parse(url);
        try {
            CustomTabsIntent pestana = new CustomTabsIntent.Builder()
                    .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder()
                            .setToolbarColor(0xFF0A0A0B).build())
                    .setShowTitle(true)
                    .build();
            pestana.launchUrl(this, u);
        } catch (Exception e) {
            abrirFuera(u);
        }
    }

    void abrirFuera(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception e) {
            Toast.makeText(this, "No se puede abrir " + u, Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * La web bajada tiene 20 segundos para dar señal de vida (webViva); si no, se descarta y se vuelve a cargar la
     * del APK. Así un fallo en una web publicada nunca deja la app en blanco.
     */
    private void vigilar() {
        final long t0 = AlDia.cargaT;
        if (AlDia.activa(this) == null) return;
        web.postDelayed(() -> {
            if (web != null && AlDia.cargaT == t0 && AlDia.sinSenal(this)) {
                AlDia.descartar(this, "no daba señal a los 20 segundos");
                web.reload();
            }
        }, 20000);
    }

    /**
     * Mira si hay web nueva publicada y la baja (en otro hilo). Al acabar se lo dice a la web con webBuscada(estado):
     * «nueva» (lista para ponerla), «igual», «apk» (hace falta el APK nuevo), «parada» o «error: …».
     */
    void buscarWeb(boolean aunqueReciente) {
        if (!aunqueReciente && System.currentTimeMillis() - AlDia.ultimaBusqueda < 60000) return;
        final Context app = getApplicationContext();
        new Thread(() -> {
            String r = AlDia.buscar(app);
            js("window.webBuscada && webBuscada(" + JSONObject.quote(r) + ")");
        }, "aldia").start();
    }

    /** Ejecuta algo en la web desde cualquier hilo */
    void js(String codigo) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(codigo, null);
        });
    }

    /** Cuenta a la web cómo va la descarga de la versión nueva (-1 si falla) */
    void progreso(int pct, String estado) {
        js("window.progresoApp && progresoApp(" + pct + "," + JSONObject.quote(estado == null ? "" : estado) + ")");
    }

    /**
     * Preguntar con la voz: el dictado de Google (el mismo del teclado) escucha y devuelve el texto a la web con
     * vozTexto(texto). No necesita permiso de micrófono: lo pide la app de Google.
     */
    void escuchar() {
        Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
                .putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Cuéntale a tu director deportivo");
        try {
            startActivityForResult(i, VOZ);
        } catch (Exception e) {
            js("window.vozTexto && vozTexto(null, 'Este móvil no tiene dictado por voz (instala la app de Google)')");
        }
    }

    /**
     * Fotos y capturas para la IA: el selector de fotos de Android (desde Android 13; antes, el de archivos). No
     * necesita permiso de la galería: solo se lee lo que eliges. Llegan a la web con fotosApp([...]).
     */
    void elegirFotos(int max) {
        int n = Math.max(1, Math.min(4, max));
        Intent i;
        if (Build.VERSION.SDK_INT >= 33) {
            i = new Intent(android.provider.MediaStore.ACTION_PICK_IMAGES).setType("image/*");
            if (n > 1) i.putExtra(android.provider.MediaStore.EXTRA_PICK_IMAGES_MAX, Math.min(n, android.provider.MediaStore.getPickImagesMaxLimit()));
        } else {
            i = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
            if (n > 1) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        try {
            startActivityForResult(i, FOTOS);
        } catch (Exception e) {
            try {
                Intent j = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                if (n > 1) j.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(j, FOTOS);
            } catch (Exception e2) {
                js("window.fotosApp && fotosApp([], 'Este móvil no deja elegir fotos')");
            }
        }
    }

    /** lo elegido en el selector: se prepara fuera del hilo de la pantalla (puede tardar un segundo) */
    private void fotosElegidas(int resultado, Intent datos) {
        final java.util.ArrayList<Uri> uris = new java.util.ArrayList<>();
        if (resultado == RESULT_OK && datos != null) {
            android.content.ClipData c = datos.getClipData();
            if (c != null) {
                for (int k = 0; k < c.getItemCount(); k++) if (c.getItemAt(k).getUri() != null) uris.add(c.getItemAt(k).getUri());
            } else if (datos.getData() != null) {
                uris.add(datos.getData());
            }
        }
        if (uris.isEmpty()) return;
        final android.content.ContentResolver cr = getContentResolver();
        new Thread(() -> {
            org.json.JSONArray lista = new org.json.JSONArray();
            int mal = 0;
            for (int k = 0; k < uris.size() && k < 4; k++) {
                try {
                    String b = Fotos.jpegB64(cr, uris.get(k));
                    if (b != null) lista.put(b);
                    else mal++;
                } catch (Throwable t) {
                    mal++;
                }
            }
            String error = mal == 0 ? "null" : JSONObject.quote(mal == 1 ? "Una de las fotos no se ha podido abrir" : mal + " fotos no se han podido abrir");
            js("window.fotosApp && fotosApp(" + lista + "," + error + ")");
        }, "fotos").start();
    }

    /**
     * El teclado para escribir en la web. Al volver de otra pantalla (el selector de fotos, el dictado) Android a
     * veces deja el WebView sin foco y, aunque toques la caja de escribir, el teclado no sale: se le devuelve el
     * foco y se pide el teclado.
     */
    void teclado() {
        if (web == null) return;
        if (!web.hasFocus()) web.requestFocus();
        android.view.inputmethod.InputMethodManager imm = (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.showSoftInput(web, 0);
        try {
            WindowCompat.getInsetsController(getWindow(), web).show(WindowInsetsCompat.Type.ime());
        } catch (Exception e) {
            // con el de antes basta
        }
    }

    /** Android 13 o más: el permiso de notificaciones, solo cuando activas los avisos */
    void pedirPermisoAvisos() {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, PERMISO_AVISOS);
        } else {
            js("window.permisoAvisos && permisoAvisos(true)");
        }
    }

    /** Android 12 o más: el permiso de avisos al minuto exacto se da en los ajustes del sistema */
    void pedirAlarmasExactas() {
        if (android.os.Build.VERSION.SDK_INT >= 31) {
            try {
                startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
            } catch (Exception e) {
                Toast.makeText(this, "No se pudo abrir el ajuste", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permisos, int[] resultados) {
        if (pedido == PERMISO_AVISOS) {
            boolean ok = resultados.length > 0 && resultados[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            js("window.permisoAvisos && permisoAvisos(" + ok + ")");
            return;
        }
        super.onRequestPermissionsResult(pedido, permisos, resultados);
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        if (pedido == VOZ) {
            java.util.ArrayList<String> r = datos == null ? null : datos.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
            String t = r != null && !r.isEmpty() ? r.get(0) : null;
            js("window.vozTexto && vozTexto(" + (t == null ? "null" : JSONObject.quote(t)) + ")");
            return;
        }
        if (pedido == FOTOS) {
            fotosElegidas(resultado, datos);
            return;
        }
        if (Canal.resultado(this, pedido)) return;
        super.onActivityResult(pedido, resultado, datos);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        atras();
    }

    /** primero cierra lo que haya abierto en la web (una ficha, los ajustes); si no hay nada, sale */
    private void atras() {
        if (web == null) {
            finish();
            return;
        }
        web.evaluateJavascript("window.atras ? window.atras() : false", r -> {
            if (!"true".equals(r)) {
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle salida) {
        super.onSaveInstanceState(salida);
        web.saveState(salida);
    }

    @Override
    protected void onPause() {
        Anuncios.alPausar();
        aLaVista = false;
        abierta = false;
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        aLaVista = true;
        abierta = true;
        web.onResume();
        Anuncios.alVolver();
        // de vuelta de otra pantalla, el foco otra vez al WebView (sin él no sale el teclado)
        if (!web.hasFocus()) web.requestFocus();
        js("window.alVolver && alVolver()");
        // de vuelta tras un rato: ¿hay web nueva?
        if (cargada && System.currentTimeMillis() - AlDia.ultimaBusqueda > 20 * 60000) buscarWeb(false);
    }
}
