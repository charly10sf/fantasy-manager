package es.fantasymanager.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * La web al día sin reinstalar. La web (web/) va dentro del APK, pero cada vez que cambia se publica también en
 * GitHub Pages con un paquete.json: la versión, la huella de la parte Android con la que funciona («nativo») y la
 * huella sha-256 de cada archivo. Al abrir la app (y en las pasadas en segundo plano) se mira ese paquete.json y,
 * si es para la misma parte Android que este APK, se bajan solo los archivos que no son iguales que los del APK,
 * se comprueba la huella de cada uno y se guardan en files/web/. Desde entonces la app los sirve a ellos en vez
 * de los del APK. Si la parte Android ha cambiado no se baja nada: hace falta el APK nuevo (el aviso de siempre).
 * Si la web bajada no llega a arrancar (dos aperturas seguidas, o 20 segundos sin dar señal), se descarta y se
 * vuelve a la del APK. Con «parar» en el paquete.json se vuelve a la del APK en todos los móviles.
 */
final class AlDia {
    static final String ORIGEN = "https://charly10sf.github.io/fantasy-manager/";
    /** de dónde se baja (siempre ORIGEN; las pruebas lo cambian por un servidor local) */
    static String origen = ORIGEN;
    private static final long MAX_ARCHIVO = 8L << 20, MAX_TOTAL = 40L << 20;
    private static final Object CERROJO = new Object();
    private static volatile boolean buscando;
    /** la web bajada en uso: null sin mirar todavía; vacío, la del APK */
    private static volatile JSONObject activa;
    static volatile long ultimaBusqueda;
    /** cuándo empezó a cargarse la página y cuándo dio señal de vida la web (para el vigilante de Principal) */
    static volatile long cargaT, vivaT;

    private AlDia() {
    }

    static File raiz(Context c) {
        return new File(c.getFilesDir(), "web");
    }

    private static SharedPreferences prefs(Context c) {
        return Puente.prefs(c);
    }

    /* ---------------- la que está en uso ---------------- */

    /** el paquete.json que va dentro del APK (null si no lo hay: compilado sin la Action) */
    static JSONObject propio(Context c) {
        try (InputStream in = c.getAssets().open("paquete.json")) {
            return new JSONObject(leer(in, 4L << 20));
        } catch (Exception e) {
            return null;
        }
    }

    /** la web bajada que se sirve ahora (null: la del APK) */
    static JSONObject activa(Context c) {
        JSONObject a = activa;
        if (a == null) {
            synchronized (CERROJO) {
                a = activa;
                if (a == null) {
                    a = new JSONObject();
                    try {
                        File f = new File(raiz(c), "activa.json");
                        if (f.isFile()) {
                            JSONObject j = new JSONObject(leer(new FileInputStream(f), 4L << 20));
                            // solo vale para este APK: con otro (aunque sea más nuevo) se vuelve a mirar desde cero
                            boolean vale = j.optInt("base") == BuildConfig.VERSION_CODE
                                    && BuildConfig.NATIVO.equals(j.optString("nativo"))
                                    && new File(raiz(c), j.optString("dir", "-")).isDirectory();
                            if (vale) a = j;
                            else borrarActiva(c);
                        }
                    } catch (Exception e) {
                        a = new JSONObject();
                    }
                    activa = a;
                }
            }
        }
        return a.length() == 0 ? null : a;
    }

    /** la respuesta para una dirección de la web, si es de un archivo que se ha bajado (si no, null: el del APK) */
    static WebResourceResponse servir(Context c, Uri u) {
        try {
            if (u == null || !Principal.HOST.equalsIgnoreCase(u.getHost())) return null;
            String p = u.getPath();
            if (p == null || !p.startsWith("/assets/")) return null;
            JSONObject a = activa(c);
            if (a == null) return null;
            String rel = p.substring("/assets/".length());
            if (rel.isEmpty()) rel = "index.html";
            JSONObject arch = a.optJSONObject("archivos");
            if (arch == null || !arch.has(rel) || !rutaValida(rel)) return null;
            File f = new File(new File(raiz(c), a.getString("dir")), rel);
            if (!f.isFile()) return null;
            String tipo = tipo(rel);
            WebResourceResponse r = new WebResourceResponse(tipo, tipo.startsWith("text/") || tipo.endsWith("json") || tipo.endsWith("xml") ? "utf-8" : null, new FileInputStream(f));
            Map<String, String> cab = new HashMap<>();
            cab.put("Cache-Control", "no-cache");
            r.setResponseHeaders(cab);
            return r;
        } catch (Exception e) {
            return null;
        }
    }

    static String tipo(String rel) {
        String x = rel.substring(rel.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (x) {
            case "js":
            case "mjs":
                return "text/javascript";
            case "css":
                return "text/css";
            case "html":
                return "text/html";
            case "json":
                return "application/json";
            case "webmanifest":
                return "application/manifest+json";
            case "svg":
                return "image/svg+xml";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            case "ico":
                return "image/x-icon";
            case "woff2":
                return "font/woff2";
            case "woff":
                return "font/woff";
            case "txt":
                return "text/plain";
            case "pdf":
                return "application/pdf";
            default:
                return "application/octet-stream";
        }
    }

    /** solo rutas normales dentro de la web: letras, números, «.», «_», «-» y «/», sin «..» ni ruta absoluta */
    static boolean rutaValida(String rel) {
        if (rel == null || rel.isEmpty() || rel.length() > 200 || rel.startsWith("/") || !rel.matches("[A-Za-z0-9._/-]+")) return false;
        for (String parte : rel.split("/")) if (parte.isEmpty() || parte.equals(".") || parte.equals("..")) return false;
        return true;
    }

    /* ---------------- que arranque ---------------- */

    /** al abrir la app: si la web bajada lleva dos aperturas sin dar señal de vida, fuera */
    static void alAbrir(Context c) {
        JSONObject a = activa(c);
        if (a == null) return;
        SharedPreferences p = prefs(c);
        int n = p.getInt("aldia_intentos", 0);
        if (n >= 2) {
            descartar(c, "no arrancaba");
            return;
        }
        p.edit().putInt("aldia_intentos", n + 1).apply();
    }

    /** la web ha arrancado bien (la llama la propia web en cuanto se ha cargado entera) */
    static void viva(Context c) {
        vivaT = System.currentTimeMillis();
        prefs(c).edit().putInt("aldia_intentos", 0).apply();
    }

    /** ¿la página de ahora sirve una web bajada que no ha dado señal de vida? */
    static boolean sinSenal(Context c) {
        return activa(c) != null && vivaT < cargaT;
    }

    /** vuelve a la web del APK (y no vuelve a bajar esa misma web si fallaba) */
    static void descartar(Context c, String motivo) {
        synchronized (CERROJO) {
            JSONObject a = activa(c);
            SharedPreferences.Editor e = prefs(c).edit().putInt("aldia_intentos", 0);
            if (a != null && motivo != null) {
                e.putString("aldia_mala", a.optString("huella")).putString("aldia_error", "descartada la " + a.optString("version") + ": " + motivo);
            }
            e.apply();
            borrarActiva(c);
            activa = new JSONObject();
        }
    }

    private static void borrarActiva(Context c) {
        new File(raiz(c), "activa.json").delete();
    }

    /* ---------------- buscar la nueva ---------------- */

    /**
     * Mira el paquete.json publicado y, si hay web nueva para este APK, la baja y la deja lista para la próxima carga.
     * Devuelve: «nueva» (bajada), «igual» (ya la tienes), «apk» (hace falta el APK nuevo), «parada» o «error: …».
     * Bloquea: llamar fuera del hilo de la pantalla.
     */
    static String buscar(Context c) {
        if (buscando) return "ocupada";
        buscando = true;
        try {
            JSONObject propio = propio(c);
            if (propio == null) return "igual";
            JSONObject remoto = new JSONObject(bajarTexto(origen + "paquete.json?t=" + System.currentTimeMillis()));
            if (remoto.optBoolean("parar")) {
                if (activa(c) != null) descartar(c, null);
                return "parada";
            }
            if (!BuildConfig.NATIVO.equals(remoto.optString("nativo"))) return "apk";
            String huella = remoto.optString("huella");
            JSONObject ya = activa(c);
            if (ya != null && huella.equals(ya.optString("huella"))) return "igual";
            if (huella.equals(propio.optString("huella"))) {
                // el APK ya trae esa web (o la publicada ha vuelto atrás): fuera la bajada
                if (ya != null) descartar(c, null);
                return "igual";
            }
            if (huella.equals(prefs(c).getString("aldia_mala", ""))) return "igual";
            JSONObject ra = remoto.getJSONObject("archivos"), pa = propio.optJSONObject("archivos");
            if (pa == null) pa = new JSONObject();
            JSONObject cambiados = new JSONObject();
            for (Iterator<String> it = ra.keys(); it.hasNext(); ) {
                String k = it.next(), h = ra.getString(k);
                if (!h.equals(pa.optString(k, ""))) cambiados.put(k, h);
            }
            String dir = "v" + System.currentTimeMillis();
            // lo que quedara a medias de otra vez (sin conexión a mitad), fuera
            File[] restos = raiz(c).listFiles((d, n) -> n.endsWith(".parte"));
            if (restos != null) for (File r : restos) borrar(r);
            File tmp = new File(raiz(c), dir + ".parte");
            if (!tmp.mkdirs()) throw new IOException("sin sitio para guardarla");
            JSONObject yaArch = ya != null ? ya.optJSONObject("archivos") : null;
            File yaDir = ya != null ? new File(raiz(c), ya.optString("dir", "-")) : null;
            long total = 0;
            for (Iterator<String> it = cambiados.keys(); it.hasNext(); ) {
                String k = it.next(), h = cambiados.getString(k);
                if (!rutaValida(k) || !h.matches("[0-9a-f]{64}")) throw new IOException("ruta rara: " + k);
                File dest = new File(tmp, k);
                File pd = dest.getParentFile();
                if (pd != null && !pd.isDirectory() && !pd.mkdirs()) throw new IOException("sin sitio para " + k);
                // lo que no ha cambiado desde la última que se bajó, se copia de ahí
                File viejo = yaArch != null && h.equals(yaArch.optString(k, "")) && yaDir != null ? new File(yaDir, k) : null;
                if (viejo != null && viejo.isFile()) copiar(viejo, dest);
                else total += bajarArchivo(origen + k + "?v=" + h.substring(0, 12), dest);
                if (total > MAX_TOTAL) throw new IOException("demasiado grande");
                if (!h.equals(sha256(dest))) throw new IOException("no cuadra la huella de " + k);
            }
            synchronized (CERROJO) {
                File fin = new File(raiz(c), dir);
                if (!tmp.renameTo(fin)) throw new IOException("no se pudo guardar");
                JSONObject nueva = new JSONObject()
                        .put("version", remoto.optString("version"))
                        .put("huella", huella)
                        .put("nativo", BuildConfig.NATIVO)
                        .put("base", BuildConfig.VERSION_CODE)
                        .put("dir", dir)
                        .put("t", System.currentTimeMillis())
                        .put("archivos", cambiados);
                File f = new File(raiz(c), "activa.json"), ft = new File(raiz(c), "activa.json.parte");
                try (OutputStream out = new FileOutputStream(ft)) {
                    out.write(nueva.toString().getBytes(StandardCharsets.UTF_8));
                }
                if (!ft.renameTo(f)) throw new IOException("no se pudo activar");
                activa = nueva;
                prefs(c).edit().putInt("aldia_intentos", 0).remove("aldia_error").apply();
                // se queda la de ahora y la anterior (la página abierta aún puede pedirle algo); lo demás, fuera
                limpiar(c, dir, ya != null ? ya.optString("dir") : null);
            }
            return "nueva";
        } catch (Exception e) {
            String m = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            prefs(c).edit().putString("aldia_error", m).apply();
            return "error: " + m;
        } finally {
            ultimaBusqueda = System.currentTimeMillis();
            buscando = false;
        }
    }

    /** para el diagnóstico y para saber si hace falta el APK nuevo */
    static JSONObject estado(Context c) {
        JSONObject r = new JSONObject();
        try {
            JSONObject a = activa(c), p = propio(c);
            r.put("nativo", BuildConfig.NATIVO);
            r.put("propia", p != null ? p.optString("version") : null);
            r.put("activa", a != null ? a.optString("version") : null);
            r.put("bajada", a != null ? a.optLong("t") : 0);
            r.put("archivos", a != null && a.optJSONObject("archivos") != null ? a.getJSONObject("archivos").length() : 0);
            r.put("mirada", ultimaBusqueda);
            r.put("error", prefs(c).getString("aldia_error", null));
        } catch (Exception e) {
            // no puede fallar
        }
        return r;
    }

    /* ---------------- archivos ---------------- */

    private static void limpiar(Context c, String deja1, String deja2) {
        File[] l = raiz(c).listFiles();
        if (l == null) return;
        Set<String> deja = new HashSet<>();
        deja.add(deja1);
        if (deja2 != null) deja.add(deja2);
        for (File f : l) if (f.isDirectory() && !deja.contains(f.getName())) borrar(f);
    }

    static void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] l = f.listFiles();
        if (l != null) for (File x : l) borrar(x);
        f.delete();
    }

    private static void copiar(File de, File a) throws IOException {
        try (InputStream in = new FileInputStream(de); OutputStream out = new FileOutputStream(a)) {
            byte[] b = new byte[65536];
            int r;
            while ((r = in.read(b)) > 0) out.write(b, 0, r);
        }
    }

    static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] b = new byte[65536];
            int r;
            while ((r = in.read(b)) > 0) md.update(b, 0, r);
        }
        StringBuilder s = new StringBuilder();
        for (byte x : md.digest()) s.append(String.format(Locale.ROOT, "%02x", x));
        return s.toString();
    }

    private static HttpURLConnection abrir(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(30000);
        con.setUseCaches(false);
        con.setRequestProperty("User-Agent", "FantasyManagerApp/" + BuildConfig.VERSION_CODE);
        con.setRequestProperty("Cache-Control", "no-cache");
        int s = con.getResponseCode();
        if (s != 200) {
            con.disconnect();
            throw new IOException("HTTP " + s + " en " + url.replace(origen, "").replaceAll("\\?.*", ""));
        }
        if (!"https".equals(con.getURL().getProtocol())) {
            con.disconnect();
            throw new IOException("sin https");
        }
        return con;
    }

    private static String bajarTexto(String url) throws IOException {
        HttpURLConnection con = abrir(url);
        try {
            return leer(con.getInputStream(), 4L << 20);
        } finally {
            con.disconnect();
        }
    }

    private static long bajarArchivo(String url, File dest) throws IOException {
        HttpURLConnection con = abrir(url);
        long n = 0;
        try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(dest)) {
            byte[] b = new byte[65536];
            int r;
            while ((r = in.read(b)) > 0) {
                n += r;
                if (n > MAX_ARCHIVO) throw new IOException("archivo demasiado grande");
                out.write(b, 0, r);
            }
        } finally {
            con.disconnect();
        }
        return n;
    }

    private static String leer(InputStream in, long max) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[16384];
            int r;
            long n = 0;
            while ((r = i.read(b)) > 0) {
                n += r;
                if (n > max) throw new IOException("demasiado grande");
                o.write(b, 0, r);
            }
            return o.toString("UTF-8");
        }
    }
}
