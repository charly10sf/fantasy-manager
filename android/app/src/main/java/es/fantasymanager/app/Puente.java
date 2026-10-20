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
            "raw.githubusercontent.com",
            // Gemini: por aquí y no desde la web, porque el WebView corta las peticiones POST a Google
            "generativelanguage.googleapis.com",
            // titulares de prensa (Google Noticias, RSS)
            "news.google.com"
    ));
    private static final String GEMINI = "generativelanguage.googleapis.com";
    private static final int MAX = 16 * 1024 * 1024;
    private static final ExecutorService HILOS = Executors.newFixedThreadPool(4);
    private final Map<String, String> respuestas = new ConcurrentHashMap<>();
    private final Context ctx;
    /** la pantalla de la app; null cuando la web trabaja en segundo plano (Fondo) */
    private final Principal act;
    private final Fondo fondo;
    /** la IA está trabajando en la app abierta: el trabajo en segundo plano no arranca */
    static volatile boolean ocupada;

    Puente(Principal a) {
        act = a;
        fondo = null;
        ctx = a.getApplicationContext();
    }

    Puente(Context c, Fondo f) {
        act = null;
        fondo = f;
        ctx = c.getApplicationContext();
    }

    /** ejecuta algo en la web, esté en pantalla o en segundo plano */
    private void js(String codigo) {
        if (act != null) act.js(codigo);
        else if (fondo != null) fondo.js(codigo);
    }

    /** algo que solo tiene sentido con la pantalla (abrir el login, pedir permisos...) */
    private void enPantalla(Runnable r) {
        if (act != null) act.runOnUiThread(r);
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
                if (GEMINI.equalsIgnoreCase(u.getHost())) {
                    // Gemini va por OkHttp: HTTP/2 con pings mientras piensa y DNS por https si hace falta
                    r = Red.pedir(metodo, url, cabeceras, cuerpo, MAX);
                    respuestas.put(id, r.toString());
                    js("window.__http && window.__http(" + JSONObject.quote(id) + ")");
                    return;
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
            } catch (java.net.UnknownHostException e) {
                // el DNS del móvil o de la red no encuentra la dirección (un bloqueador, el DNS privado…):
                // se repite preguntando la dirección a Cloudflare y a Google por https
                if (con != null) con.disconnect();
                con = null;
                r = Red.pedir(metodo, url, cabeceras, cuerpo, MAX);
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
            js("window.__http && window.__http(" + JSONObject.quote(id) + ")");
        });
    }

    /**
     * Baja una imagen (la foto de un jugador) y la devuelve en base64, para que la web pueda mirar dónde está la
     * cara y encuadrarla. Cualquier dirección https, pero solo si lo que llega es una imagen y pesa menos de 3 MB.
     */
    @JavascriptInterface
    public void imagen(String id, String url) {
        HILOS.execute(() -> {
            JSONObject r = new JSONObject();
            HttpURLConnection con = null;
            try {
                URL u = new URL(url);
                if (!"https".equals(u.getProtocol())) throw new Exception("sin https");
                con = (HttpURLConnection) u.openConnection();
                con.setConnectTimeout(10000);
                con.setReadTimeout(15000);
                con.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36");
                int estado = con.getResponseCode();
                String tipo = con.getContentType();
                if (estado != 200 || tipo == null || !tipo.startsWith("image/")) throw new Exception("no es una imagen (" + estado + ")");
                try (InputStream in = con.getInputStream(); ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                    byte[] b = new byte[32768];
                    int n, total = 0;
                    while ((n = in.read(b)) > 0) {
                        total += n;
                        if (total > 3 * 1024 * 1024) throw new Exception("imagen demasiado grande");
                        buf.write(b, 0, n);
                    }
                    r.put("s", estado);
                    r.put("t", tipo);
                    r.put("b", android.util.Base64.encodeToString(buf.toByteArray(), android.util.Base64.NO_WRAP));
                }
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
            js("window.__http && window.__http(" + JSONObject.quote(id) + ")");
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
        enPantalla(() -> act.abrirLogin(url));
    }

    /** La dirección de vuelta del inicio de sesión, si ha llegado (y se olvida) */
    @JavascriptInterface
    public String loginPendiente() {
        if (act == null) return null;
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
        enPantalla(() -> act.pedirPermisoAvisos());
    }

    @JavascriptInterface
    public boolean alarmasExactas() {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    @JavascriptInterface
    public void pedirAlarmasExactas() {
        enPantalla(() -> act.pedirAlarmasExactas());
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
        if (act == null) return;
        if (!Actualizador.valida(url)) {
            act.progreso(-1, "dirección no válida");
            return;
        }
        new Thread(() -> Actualizador.bajar(act, url)).start();
    }

    @JavascriptInterface
    public void instalar() {
        enPantalla(() -> act.instalar(Actualizador.archivo(ctx)));
    }

    /* ---------------- varios ---------------- */

    @JavascriptInterface
    public void copiar(String texto) {
        enPantalla(() -> {
            ClipboardManager cm = ctx.getSystemService(ClipboardManager.class);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Fantasy Manager", texto));
        });
    }

    @JavascriptInterface
    public void compartir(String texto) {
        enPantalla(() -> {
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
        enPantalla(() -> act.abrirFuera(Uri.parse(url)));
    }

    /**
     * La IA empieza o termina de trabajar: mientras trabaja, la pantalla no se apaga sola y la app queda en primer
     * plano con una notificación fija, para que Android no le corte internet si sales de la app.
     */
    @JavascriptInterface
    public void trabajando(boolean si, String texto) {
        ocupada = si;
        if (act == null) return;
        act.runOnUiThread(() -> {
            if (si) act.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else act.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        try {
            if (si) Trabajo.empezar(ctx, texto);
            else Trabajo.parar(ctx);
        } catch (Exception e) {
            // Android no deja empezarlo ahora: se sigue sin él
        }
    }

    /** si la app está a la vista (para avisar con una notificación cuando el plan llega con la app cerrada) */
    @JavascriptInterface
    public boolean aLaVista() {
        return act != null && act.aLaVista;
    }

    /** un toque suave (la vibración de las teclas) al cambiar de pestaña */
    @JavascriptInterface
    public void toque() {
        enPantalla(() -> act.getWindow().getDecorView().performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP));
    }

    /** preguntar con la voz (el dictado de Google); el texto llega a la web con vozTexto() */
    @JavascriptInterface
    public void voz() {
        enPantalla(() -> act.escuchar());
    }

    /* ---------------- la IA en segundo plano ---------------- */

    /**
     * Enciende o apaga el trabajo en segundo plano y apunta cuándo cambia el mercado (milisegundos), para pasar
     * unos minutos después. En segundo plano no se toca nada hasta que acaba la pasada (Fondo lo hace al final).
     */
    @JavascriptInterface
    public void programarFondo(boolean on, double prox) {
        prefs(ctx).edit().putBoolean("fondo_on", on).putLong("fondo_prox", (long) prox).apply();
        if (fondo == null) Fondo.reprogramar(ctx);
    }

    /** la web en segundo plano ha terminado su pasada */
    @JavascriptInterface
    public void fondoTerminado() {
        if (fondo != null) fondo.terminar();
    }

    /** cuándo empezó y acabó la última pasada en segundo plano y si falló algo, para el diagnóstico */
    @JavascriptInterface
    public String estadoFondo() {
        SharedPreferences p = prefs(ctx);
        JSONObject r = new JSONObject();
        try {
            r.put("on", p.getBoolean("fondo_on", true));
            r.put("ini", p.getLong("fondo_ini", 0));
            r.put("fin", p.getLong("fondo_fin", 0));
            r.put("prog", p.getLong("fondo_prog", 0));
            r.put("error", p.getString("fondo_error", null));
        } catch (Exception e) {
            // no puede fallar
        }
        return r.toString();
    }
}
