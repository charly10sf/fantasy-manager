package es.fantasymanager.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/**
 * (15 nov) El plan con la IA cuando sales de la app a medias. La versión de Google Play no lleva el servicio en primer
 * plano (Trabajo), así que al salir Android congela la app y corta su conexión. El servidor sigue con el plan y lo guarda
 * con el id del pedido; aquí, un trabajo urgente de Android (sin servicio en primer plano ni declaración en Play) enseña
 * «Preparando tu plan», pregunta al servidor cada pocos segundos y, cuando está, avisa con «Tu plan de hoy está listo».
 * Al volver a la app, la web lo recoge con el mismo id (ia.js, planPorApp) y este trabajo se cancela.
 * (16 nov) Lo mismo con una pregunta del chat a la IA de la app: «Pensando tu respuesta» con lo que has preguntado y,
 * cuando el servidor la tiene (/pregunta/res), «Tu director deportivo ha contestado» con el principio de la respuesta.
 * Los rivales van con alias en el servidor («Rival 2»): la web pasa la vuelta (alias → nombre) para poner los nombres.
 */
public class Recoger extends Worker {
    static final String NOMBRE = "recoger-plan";
    static final String NOMBRE_P = "recoger-pregunta";
    private static final String CANAL_P = "pregunta";
    private static final int ID_PENSANDO = 7004;
    private static final int ID_CONTESTADO = 7005;
    private static final String RUTA_P = "https://fantasy-manager.fantasymanager-web-app.workers.dev/pregunta/res?rid=";
    private static final String CANAL = "plan";
    private static final String CANAL_MARCHA = "plan-marcha";
    private static final int ID_PREPARANDO = 7002;
    private static final int ID_LISTO = 7003;
    private static final String RUTA = "https://fantasy-manager.fantasymanager-web-app.workers.dev/plan/res?rid=";
    private static final long MAXIMO_MS = 4 * 60 * 1000L;

    /** el pedido en marcha (lo pone la web al pedir el plan y lo quita al acabar) */
    static volatile String rid;
    static volatile String token;
    /** la pregunta en marcha: su id, la sesión, la vuelta de los alias (JSON) y lo que se ha preguntado */
    static volatile String ridP;
    static volatile String tokenP;
    static volatile String vueltaP;
    static volatile String textoP;

    public Recoger(@NonNull Context c, @NonNull WorkerParameters p) {
        super(c, p);
    }

    /** al salir de la app con un plan en marcha */
    static void empezar(Context c) {
        empezarPregunta(c);
        String r = rid, t = token;
        if (r == null || t == null) return;
        try {
            Data d = new Data.Builder().putString("rid", r).putString("tk", t).build();
            OneTimeWorkRequest.Builder b = new OneTimeWorkRequest.Builder(Recoger.class).setInputData(d)
                    .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build());
            // urgente: arranca enseguida. Antes de Android 12 eso pediría un servicio en primer plano, que esta versión no lleva
            if (Build.VERSION.SDK_INT >= 31) b.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
            WorkManager.getInstance(c).enqueueUniqueWork(NOMBRE, ExistingWorkPolicy.REPLACE, b.build());
            aviso(c, ID_PREPARANDO, "Preparando tu plan", "La IA está leyendo tu liga y las noticias. Te aviso cuando esté.", true);
        } catch (Exception e) {
            // sin el trabajo: al volver a la app la web lo recoge igual
        }
    }

    /** al salir de la app con una pregunta a la IA en marcha */
    static void empezarPregunta(Context c) {
        String r = ridP, t = tokenP;
        if (r == null || t == null) return;
        try {
            Data d = new Data.Builder().putString("rid", r).putString("tk", t).putString("tipo", "p").putString("vuelta", vueltaP == null ? "" : vueltaP).build();
            OneTimeWorkRequest.Builder b = new OneTimeWorkRequest.Builder(Recoger.class).setInputData(d)
                    .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build());
            if (Build.VERSION.SDK_INT >= 31) b.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
            WorkManager.getInstance(c).enqueueUniqueWork(NOMBRE_P, ExistingWorkPolicy.REPLACE, b.build());
            String q = textoP == null || textoP.trim().isEmpty() ? "Tu pregunta" : "«" + corto(textoP.trim(), 80) + "»";
            avisoP(c, ID_PENSANDO, "Pensando tu respuesta", q + " · Te aviso cuando conteste.", true);
        } catch (Exception e) {
            // sin el trabajo: al volver a la app la web la recoge igual
        }
    }

    /** de vuelta en la app (o el plan o la respuesta ya han llegado): la web se encarga */
    static void parar(Context c) {
        try {
            WorkManager.getInstance(c).cancelUniqueWork(NOMBRE);
            WorkManager.getInstance(c).cancelUniqueWork(NOMBRE_P);
        } catch (Exception e) {
            // nada
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) { nm.cancel(ID_PREPARANDO); nm.cancel(ID_PENSANDO); }
    }

    /** el aviso de «listo» ya no hace falta si lo estás viendo en la app */
    static void quitarListo(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) { nm.cancel(ID_LISTO); nm.cancel(ID_CONTESTADO); }
    }

    /** la respuesta ha llegado a la web con la app fuera de la vista: el aviso, con el principio ya con los nombres */
    static void contestado(Context c, String resumen, boolean ok) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(ID_PENSANDO);
        if (ok) avisoP(c, ID_CONTESTADO, "Tu director deportivo ha contestado", resumen == null || resumen.trim().isEmpty() ? "Entra para leer la respuesta" : corto(resumen.trim(), 230), false);
        else avisoP(c, ID_CONTESTADO, "No ha podido contestar", resumen == null || resumen.trim().isEmpty() ? "Entra y vuelve a preguntar" : corto(resumen.trim(), 200), false);
    }

    private static String corto(String t, int n) {
        if (t.length() <= n) return t;
        int i = t.lastIndexOf(' ', n - 1);
        return t.substring(0, i > n / 2 ? i : n - 1) + "…";
    }

    /** «Rival 2» → su nombre, con la vuelta que pasa la web ({"rival 2": "Marcos", …}) */
    static String destapar(String t, String vuelta) {
        if (t == null || vuelta == null || vuelta.isEmpty()) return t;
        try {
            JSONObject v = new JSONObject(vuelta);
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?<![\\p{L}\\p{N}])(Rival|Equipo|Exrival) (\\d{1,3})(?![\\p{L}\\p{N}])", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(t);
            StringBuffer sb = new StringBuffer();
            while (m.find()) {
                String n = v.optString(m.group(1).toLowerCase(java.util.Locale.ROOT) + " " + m.group(2), null);
                m.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(n == null ? m.group() : n));
            }
            m.appendTail(sb);
            return sb.toString();
        } catch (Exception e) {
            return t;
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        String r = getInputData().getString("rid"), t = getInputData().getString("tk");
        if (r == null || t == null) return Result.success();
        if ("p".equals(getInputData().getString("tipo"))) return pregunta(c, r, t, getInputData().getString("vuelta"));
        long ini = System.currentTimeMillis();
        boolean visto = false;
        while (!isStopped() && System.currentTimeMillis() - ini < MAXIMO_MS) {
            JSONObject j = preguntar(RUTA, r, t);
            if (j != null) {
                JSONObject fin = j.optJSONObject("fin");
                if (fin != null && fin.optJSONObject("plan") != null) {
                    String tit = fin.optJSONObject("plan").optString("titular", "");
                    terminar(c, "Tu plan de hoy está listo", tit.isEmpty() ? "Entra para ver los pasos" : tit);
                    return Result.success();
                }
                if (j.optBoolean("marcha")) visto = true;
                // ya no está en marcha y no hay plan: ha fallado (al entrar, la web lo explica)
                else if (visto || System.currentTimeMillis() - ini > 30000) {
                    terminar(c, "No ha salido el plan de hoy", "Entra y dale a Reintentar");
                    return Result.success();
                }
            }
            try {
                Thread.sleep(3000);
            } catch (InterruptedException e) {
                break;
            }
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(ID_PREPARANDO);
        return Result.success();
    }

    /** la pregunta: hasta 4 minutos preguntando cada 3 s si ya está; con la respuesta, el aviso con su principio */
    private Result pregunta(Context c, String r, String t, String vuelta) {
        long ini = System.currentTimeMillis();
        boolean visto = false;
        while (!isStopped() && System.currentTimeMillis() - ini < MAXIMO_MS) {
            JSONObject j = preguntar(RUTA_P, r, t);
            if (j != null) {
                JSONObject fin = j.optJSONObject("fin");
                if (fin != null && fin.has("resumen")) {
                    contestado(c, destapar(fin.optString("resumen", ""), vuelta), true);
                    return Result.success();
                }
                if (j.optBoolean("marcha")) visto = true;
                else if (visto || System.currentTimeMillis() - ini > 30000) {
                    contestado(c, null, false);
                    return Result.success();
                }
            }
            try {
                Thread.sleep(3000);
            } catch (InterruptedException e) {
                break;
            }
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(ID_PENSANDO);
        return Result.success();
    }

    private static void terminar(Context c, String titulo, String texto) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(ID_PREPARANDO);
        aviso(c, ID_LISTO, titulo, texto, false);
    }

    private static JSONObject preguntar(String ruta, String r, String t) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(ruta + URLEncoder.encode(r, "UTF-8")).openConnection();
            con.setConnectTimeout(10000);
            con.setReadTimeout(15000);
            con.setRequestProperty("Authorization", "Bearer " + t);
            con.setRequestProperty("Accept", "application/json");
            if (con.getResponseCode() != 200) return null;
            try (InputStream in = con.getInputStream(); ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                byte[] b = new byte[16384];
                int n, total = 0;
                while ((n = in.read(b)) > 0) {
                    total += n;
                    if (total > 512 * 1024) return null;
                    buf.write(b, 0, n);
                }
                return new JSONObject(buf.toString("UTF-8"));
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static void aviso(Context c, int id, String titulo, String texto, boolean fija) {
        avisoDe(c, id, titulo, texto, fija, CANAL, "Tu plan con la IA", "Cuando tu plan con la IA está listo y tenías la app cerrada", "hoy");
    }

    private static void avisoP(Context c, int id, String titulo, String texto, boolean fija) {
        avisoDe(c, id, titulo, texto, fija, CANAL_P, "Respuestas de la IA", "Cuando la IA contesta tu pregunta y tenías la app cerrada", "ia");
    }

    private static void avisoDe(Context c, int id, String titulo, String texto, boolean fija, String canal, String nombreCanal, String descCanal, String hash) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(canal) == null) {
            NotificationChannel ch = new NotificationChannel(canal, nombreCanal, NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription(descCanal);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        // (sin sonido: solo para que se vea que está trabajando)
        if (nm.getNotificationChannel(CANAL_MARCHA) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_MARCHA, "La IA trabajando", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Mientras la IA prepara tu plan o tu respuesta con la app cerrada");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent i = new Intent(c, Principal.class).putExtra("hash", hash).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = new Notification.Builder(c, fija ? CANAL_MARCHA : canal)
                .setSmallIcon(R.drawable.ic_aviso)
                .setColor(0xFFEE1C3C)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setStyle(new Notification.BigTextStyle().bigText(texto))
                .setContentIntent(pi);
        if (fija) {
            b.setOngoing(true).setOnlyAlertOnce(true).setProgress(0, 0, true);
        }
        else b.setAutoCancel(true);
        nm.notify(id, b.build());
    }
}
