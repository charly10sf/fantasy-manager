package es.fantasymanager.app;

import android.app.AlarmManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Lo que la web puede pedirle a la app. Todo lo que no puede hacer un navegador normal:
 * - http(): peticiones a la API de LaLiga Fantasy, a su inicio de sesión y a futbolfantasy.com (sin CORS).
 *   Solo a esas direcciones, nunca a otras.
 * - abrirLogin(): la página de LaLiga para entrar, en una pestaña de Chrome.
 * - guardar()/leer(): la sesión de LaLiga y la clave de Gemini, en el almacenamiento privado de la app.
 * - avisos, versión nueva, copiar y compartir.
 */
public class Puente {
    private static final Set<String> HOSTS = new HashSet<>(Arrays.asList(
            "fantasy-api.llt-services.com",
            "api-fantasy.llt-services.com",
            "login.laliga.es",
            "www.futbolfantasy.com",
            "raw.githubusercontent.com"
    ));
    private static final int MAX = 16 * 1024 * 1024;
    private static final ExecutorService HILOS = Executors.newFixedThreadPool(4);
    private final Map<String, String> respuestas = new ConcurrentHashMap<>();
    private final Context ctx;
    private final Principal act;

    Puente(Principal a) {
        act = a;
        ctx = a.getApplicationContext();
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("fm", Context.MODE_PRIVATE);
    }

    /* ---------------- peticiones ---------------- */

    /** Lanza una petición; cuando acaba, avisa a la web con __http(id) y la web la recoge con respuesta(id) */
    @JavascriptInterface
    public void http(String id, String metodo, String url, String cabeceras, String cuerpo) {
        HILOS.execute(() -> {
            JSONObject r = new JSONObject();
            HttpURLConnection con = null;
            try {
                URL u = new URL(url);
                if (!"https".equals(u.getProtocol()) || !HOSTS.contains(u.getHost().toLowerCase())) {
                    throw new Exception("dirección no permitida: " + u.getHost());
                }
                con = (HttpURLConnection) u.openConnection();
                con.setRequestMethod(metodo == null || metodo.isEmpty() ? "GET" : metodo.toUpperCase());
                con.setConnectTimeout(15000);
                con.setReadTimeout(30000);
                con.setInstanceFollowRedirects(true);
                if (cabeceras != null && !cabeceras.isEmpty()) {
                    JSONObject h = new JSONObject(cabeceras);
                    for (Iterator<String> it = h.keys(); it.hasNext(); ) {
                        String k = it.next();
                        con.setRequestProperty(k, h.optString(k));
                    }
                }
                if (cuerpo != null && !cuerpo.isEmpty()) {
                    con.setDoOutput(true);
                    byte[] b = cuerpo.getBytes(StandardCharsets.UTF_8);
                    con.setFixedLengthStreamingMode(b.length);
                    try (OutputStream out = con.getOutputStream()) {
                        out.write(b);
                    }
                }
                int estado = con.getResponseCode();
                InputStream in = estado >= 400 ? con.getErrorStream() : con.getInputStream();
                String texto = "";
                if (in != null) {
                    try (InputStream i = in; ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                        byte[] b = new byte[65536];
                        int n, total = 0;
                        while ((n = i.read(b)) > 0) {
                            total += n;
                            if (total > MAX) throw new Exception("respuesta demasiado grande");
                            buf.write(b, 0, n);
                        }
                        texto = buf.toString("UTF-8");
                    }
                }
                r.put("s", estado);
                r.put("b", texto);
                String tipo = con.getContentType();
                if (tipo != null) r.put("t", tipo);
            } catch (Exception e) {
                try {
                    r.put("s", 0);
                    r.put("e", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
                } catch (Exception ignorada) {
                    // no puede fallar
                }
            } finally {
                if (con != null) con.disconnect();
            }
            respuestas.put(id, r.toString());
            act.js("window.__http && window.__http(" + JSONObject.quote(id) + ")");
        });
    }

    /** La respuesta de una petición ya terminada (y se olvida) */
    @JavascriptInterface
    public String respuesta(String id) {
        String r = respuestas.remove(id);
        return r == null ? "{\"s\":0,\"e\":\"sin respuesta\"}" : r;
    }

    /* ---------------- inicio de sesión de LaLiga ---------------- */

    @JavascriptInterface
    public void abrirLogin(String url) {
        act.runOnUiThread(() -> act.abrirLogin(url));
    }

    /** La dirección de vuelta del inicio de sesión, si ha llegado (y se olvida) */
    @JavascriptInterface
    public String loginPendiente() {
        String l = act.loginPendiente;
        act.loginPendiente = null;
        return l;
    }

    /* ---------------- almacenamiento privado ---------------- */

    @JavascriptInterface
    public void guardar(String clave, String valor) {
        prefs(ctx).edit().putString("w:" + clave, valor).apply();
    }

    @JavascriptInterface
    public String leer(String clave) {
        return prefs(ctx).getString("w:" + clave, null);
    }

    @JavascriptInterface
    public void borrar(String clave) {
        prefs(ctx).edit().remove("w:" + clave).apply();
    }

    /* ---------------- avisos ---------------- */

    /** Sustituye todos los avisos programados por los de esta lista: [{id, t, titulo, texto, hash, cada}] */
    @JavascriptInterface
    public void programarAvisos(String json) {
        Avisos.programar(ctx, json);
    }

    @JavascriptInterface
    public boolean avisosPermitidos() {
        return Avisos.permitidos(ctx);
    }

    @JavascriptInterface
    public void pedirPermisoAvisos() {
        act.runOnUiThread(act::pedirPermisoAvisos);
    }

    @JavascriptInterface
    public boolean alarmasExactas() {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    @JavascriptInterface
    public void pedirAlarmasExactas() {
        act.runOnUiThread(act::pedirAlarmasExactas);
    }

    @JavascriptInterface
    public void notificar(String titulo, String texto, String hash) {
        Avisos.mostrar(ctx, "web:" + titulo, titulo == null ? "Fantasy Manager" : titulo, texto == null ? "" : texto, hash == null ? "" : hash);
    }

    /* ---------------- versión nueva ---------------- */

    @JavascriptInterface
    public int version() {
        return BuildConfig.VERSION_CODE;
    }

    @JavascriptInterface
    public String nombreVersion() {
        return BuildConfig.VERSION_NAME;
    }

    @JavascriptInterface
    public void actualizar(String url) {
        if (!Actualizador.valida(url)) {
            act.progreso(-1, "dirección no válida");
            return;
        }
        new Thread(() -> Actualizador.bajar(act, url)).start();
    }

    @JavascriptInterface
    public void instalar() {
        act.runOnUiThread(() -> act.instalar(Actualizador.archivo(ctx)));
    }

    /* ---------------- varios ---------------- */

    @JavascriptInterface
    public void copiar(String texto) {
        act.runOnUiThread(() -> {
            ClipboardManager cm = ctx.getSystemService(ClipboardManager.class);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Fantasy Manager", texto));
        });
    }

    @JavascriptInterface
    public void compartir(String texto) {
        act.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto);
            try {
                act.startActivity(Intent.createChooser(i, "Compartir"));
            } catch (Exception e) {
                // sin apps para compartir
            }
        });
    }

    @JavascriptInterface
    public void abrir(String url) {
        if (url == null || !url.startsWith("https://")) return;
        act.runOnUiThread(() -> act.abrirFuera(Uri.parse(url)));
    }

    /** un toque suave (la vibración de las teclas) al cambiar de pestaña */
    @JavascriptInterface
    public void toque() {
        act.runOnUiThread(() -> act.getWindow().getDecorView().performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP));
    }
}
