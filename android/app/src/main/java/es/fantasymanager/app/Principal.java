package es.fantasymanager.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.File;

/**
 * La app es la web de web/ (va dentro del APK) en un WebView, servida con https desde
 * appassets.androidplatform.net para que el navegador la trate como segura. El Puente le da a la web lo que
 * un navegador no puede: hablar con la API de LaLiga Fantasy sin CORS, abrir el inicio de sesión de LaLiga
 * en una pestaña de Chrome, guardar la sesión en el móvil y programar avisos.
 */
public class Principal extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String INICIO = "https://" + HOST + "/assets/index.html";
    private static final int PERMISO_INSTALAR = 8;
    private static final int PERMISO_AVISOS = 10;
    private WebView web;
    private File pendiente;
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
        web.setFitsSystemWindows(true);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        setContentView(web);

        Web.preparar(web);
        final WebViewAssetLoader cargador = Web.cargador(this);

        web.addJavascriptInterface(new Puente(this), "FantasyApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return cargador.shouldInterceptRequest(r.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equalsIgnoreCase(u.getHost())) return false;
                abrirFuera(u);
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                cargada = true;
                entregarLogin();
            }
        });
        web.setWebChromeClient(new WebChromeClient());

        loginPendiente = loginDe(getIntent());
        if (guardado != null) web.restoreState(guardado);
        else web.loadUrl(direccion(getIntent()));
        // los avisos se vuelven a programar por si el sistema los borró al actualizar la app
        Avisos.reprogramar(this);
        // y el trabajo de la IA en segundo plano
        Fondo.reprogramar(this);
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

    /** Abre el instalador de Android con el APK descargado; la primera vez pide permiso para instalar desde la app */
    void instalar(File f) {
        if (f == null || !f.exists()) {
            progreso(-1, "no hay nada descargado");
            return;
        }
        if (!getPackageManager().canRequestPackageInstalls()) {
            pendiente = f;
            progreso(100, "permiso");
            try {
                startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())), PERMISO_INSTALAR);
            } catch (Exception e) {
                progreso(-1, "no se pudo abrir el permiso");
            }
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(Archivos.uri(), "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (Exception e) {
            progreso(-1, "no se pudo abrir el instalador");
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
        if (pedido == PERMISO_INSTALAR) {
            File f = pendiente;
            pendiente = null;
            if (f != null && getPackageManager().canRequestPackageInstalls()) instalar(f);
            else progreso(100, "permiso");
            return;
        }
        super.onActivityResult(pedido, resultado, datos);
    }

    @Override
    public void onBackPressed() {
        // primero cierra lo que haya abierto en la web (una ficha, los ajustes); si no hay nada, sale
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
        js("window.alVolver && alVolver()");
    }
}
