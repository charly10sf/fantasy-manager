package es.fantasymanager.app;

import android.content.Context;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Baja la versión nueva de la app (el APK de las releases de GitHub) a la caché de la propia app. */
final class Actualizador {
    static final String NOMBRE = "fantasy-manager.apk";
    private static final String ORIGEN = "https://github.com/charly10sf/fantasy-manager/releases/";
    private static volatile boolean bajando;

    private Actualizador() {
    }

    static File archivo(Context c) {
        File d = new File(c.getCacheDir(), "actualizacion");
        if (!d.exists()) d.mkdirs();
        return new File(d, NOMBRE);
    }

    /** Solo acepta el APK publicado en las releases del repositorio, nunca otra dirección */
    static boolean valida(String url) {
        return url != null && url.startsWith(ORIGEN) && url.endsWith(".apk");
    }

    static void bajar(Principal act, String url) {
        if (bajando) return;
        bajando = true;
        File f = archivo(act), tmp = new File(f.getPath() + ".parte");
        HttpURLConnection con = null;
        try {
            URL u = new URL(url);
            // GitHub redirige a otro dominio de descarga: se siguen a mano hasta 5 saltos
            for (int i = 0; i < 5; i++) {
                con = (HttpURLConnection) u.openConnection();
                con.setInstanceFollowRedirects(false);
                con.setConnectTimeout(15000);
                con.setReadTimeout(30000);
                con.setRequestProperty("User-Agent", "FantasyManagerApp");
                int c = con.getResponseCode();
                if (c >= 300 && c < 400) {
                    String loc = con.getHeaderField("Location");
                    con.disconnect();
                    if (loc == null) throw new IOException("redirección sin destino");
                    u = new URL(u, loc);
                    if (!"https".equals(u.getProtocol())) throw new IOException("descarga sin https");
                    continue;
                }
                if (c != 200) throw new IOException("HTTP " + c);
                break;
            }
            long total = con.getContentLengthLong();
            int ultimo = -1;
            try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                byte[] b = new byte[65536];
                long n = 0;
                int r;
                while ((r = in.read(b)) > 0) {
                    out.write(b, 0, r);
                    n += r;
                    if (total > 0) {
                        int p = (int) (n * 100 / total);
                        if (p >= ultimo + 3) {
                            ultimo = p;
                            act.progreso(Math.min(p, 99), "");
                        }
                    }
                }
            }
            if (tmp.length() < 100000) throw new IOException("archivo incompleto");
            if (f.exists()) f.delete();
            if (!tmp.renameTo(f)) throw new IOException("no se pudo guardar");
            act.progreso(100, "instalar");
            act.runOnUiThread(() -> act.instalar(f));
        } catch (Exception e) {
            tmp.delete();
            act.progreso(-1, e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        } finally {
            if (con != null) con.disconnect();
            bajando = false;
        }
    }
}
