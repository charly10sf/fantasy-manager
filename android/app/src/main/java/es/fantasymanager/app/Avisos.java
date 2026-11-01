package es.fantasymanager.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Los avisos del móvil. La web calcula cuándo pasa cada cosa (se abre la cláusula de un rival, se acaba la
 * protección de uno tuyo, cierra el mercado, empieza la jornada...) y se lo pasa aquí como una lista. Cada
 * aviso es una alarma del sistema, así llega aunque la app esté cerrada. Los que repiten (el recordatorio
 * diario) se vuelven a programar solos para el día siguiente. Los que llevan «alarma» (el clausulazo que manda tu
 * plan, 1 minuto antes) suenan como una alarma: con el volumen de alarma, aunque el móvil esté en silencio, hasta que
 * los tocas o bajas las notificaciones.
 */
public class Avisos extends BroadcastReceiver {
    static final String ACCION = "es.fantasymanager.app.AVISO";
    static final String CANAL = "avisos";
    static final String CANAL_ALARMA = "alarma";
    // la alarma deja de sonar sola a los 3 minutos (la cláusula ya se ha abierto hace 2)
    private static final long ALARMA_MS = 3 * 60 * 1000L;

    @Override
    public void onReceive(Context c, Intent i) {
        if (i == null || !ACCION.equals(i.getAction())) return;
        String id = i.getStringExtra("id");
        mostrar(c, id == null ? "aviso" : id, i.getStringExtra("titulo"), i.getStringExtra("texto"), i.getStringExtra("hash"),
                i.getBooleanExtra("alarma", false));
        // los que repiten (cada > 0), al siguiente
        if (i.getLongExtra("cada", 0) > 0) reprogramar(c);
    }

    static SharedPreferences prefs(Context c) {
        return Puente.prefs(c);
    }

    static boolean permitidos(Context c) {
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    /** Guarda la lista nueva, cancela las alarmas de la anterior y programa las de esta */
    static synchronized void programar(Context c, String json) {
        try {
            JSONArray viejos = new JSONArray(prefs(c).getString("avisos", "[]"));
            AlarmManager am = c.getSystemService(AlarmManager.class);
            for (int k = 0; am != null && k < viejos.length(); k++) {
                JSONObject a = viejos.getJSONObject(k);
                am.cancel(intencion(c, a));
            }
            JSONArray nuevos = new JSONArray(json == null || json.isEmpty() ? "[]" : json);
            prefs(c).edit().putString("avisos", nuevos.toString()).apply();
            reprogramar(c);
        } catch (Exception e) {
            // una lista mal formada: se queda la que había
        }
    }

    /** Programa otra vez todas las alarmas guardadas que aún no han pasado */
    static synchronized void reprogramar(Context c) {
        try {
            AlarmManager am = c.getSystemService(AlarmManager.class);
            if (am == null) return;
            JSONArray lista = new JSONArray(prefs(c).getString("avisos", "[]"));
            long ahora = System.currentTimeMillis();
            boolean exactas = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            JSONArray quedan = new JSONArray();
            for (int k = 0; k < lista.length(); k++) {
                JSONObject a = lista.getJSONObject(k);
                long t = a.optLong("t", 0), cada = a.optLong("cada", 0);
                if (cada > 0) {
                    while (t <= ahora + 1000) t += cada;
                    a.put("t", t);
                }
                if (t <= ahora) continue;
                quedan.put(a);
                exactas = poner(c, am, a, t, exactas);
            }
            prefs(c).edit().putString("avisos", quedan.toString()).apply();
        } catch (Exception e) {
            // sin permiso de alarmas exactas a mitad de camino u otro fallo: la próxima vez que se abra la app
        }
    }

    /** pone la alarma de un aviso; devuelve si se pueden seguir poniendo exactas */
    private static boolean poner(Context c, AlarmManager am, JSONObject a, long t, boolean exactas) {
        PendingIntent pi = intencion(c, a);
        try {
            // las de «alarma», como las del reloj: Android las da a su hora aunque el móvil esté en reposo
            if (exactas && a.optBoolean("alarma", false)) am.setAlarmClock(new AlarmManager.AlarmClockInfo(t, abrir(c, "ver:" + a.optString("id", "aviso"), a.optString("hash", ""))), pi);
            else if (exactas) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            return exactas;
        } catch (SecurityException e) {
            // el permiso de alarmas exactas se quitó a mitad: con unos minutos de margen
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            return false;
        }
    }

    /** para probar la alarma (Ajustes → Avisos): suena dentro de unos segundos, fuera de la lista de avisos */
    static void probarAlarma(Context c, int segundos, String titulo, String texto) {
        try {
            AlarmManager am = c.getSystemService(AlarmManager.class);
            if (am == null) return;
            JSONObject a = new JSONObject().put("id", "prueba-alarma").put("titulo", titulo).put("texto", texto)
                    .put("hash", "hoy").put("alarma", true);
            poner(c, am, a, System.currentTimeMillis() + Math.max(3, Math.min(120, segundos)) * 1000L,
                    Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms());
        } catch (Exception e) {
            // nada
        }
    }

    private static PendingIntent intencion(Context c, JSONObject a) {
        String id = a.optString("id", "aviso");
        Intent i = new Intent(c, Avisos.class).setAction(ACCION)
                .putExtra("id", id)
                .putExtra("titulo", a.optString("titulo", "Fantasy Manager"))
                .putExtra("texto", a.optString("texto", ""))
                .putExtra("hash", a.optString("hash", ""))
                .putExtra("cada", a.optLong("cada", 0))
                .putExtra("alarma", a.optBoolean("alarma", false));
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** abrir la app en una pestaña (lo que se toca en la notificación o en el icono de la alarma) */
    private static PendingIntent abrir(Context c, String clave, String hash) {
        String h = hash == null ? "" : hash.replaceAll("[^a-z0-9/_-]", "");
        Intent i = new Intent(c, Principal.class).putExtra("hash", h).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, clave.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void mostrar(Context c, String clave, String titulo, String texto, String hash) {
        mostrar(c, clave, titulo, texto, hash, false);
    }

    static void mostrar(Context c, String clave, String titulo, String texto, String hash, boolean alarma) {
        if (!permitidos(c)) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Avisos de tu liga", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Cláusulas que se abren, protección que se acaba, mercado que cierra y jornada que empieza");
            nm.createNotificationChannel(ch);
        }
        // el canal de la alarma: el sonido va por el volumen de alarma (no lo calla el modo silencio ni el «No molestar»
        // si deja pasar las alarmas, que es lo normal). El sonido de un canal no se puede cambiar después de crearlo
        if (alarma && nm.getNotificationChannel(CANAL_ALARMA) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_ALARMA, "Alarma de clausulazos", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("1 minuto antes del clausulazo que manda tu plan. Suena con el volumen de alarma, aunque tengas el móvil en silencio");
            Uri sonido = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (sonido == null) sonido = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            ch.setSound(sonido, new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 700, 500, 700, 500, 700});
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        String cuerpo = texto == null ? "" : texto;
        Notification.Builder b = new Notification.Builder(c, alarma ? CANAL_ALARMA : CANAL)
                .setSmallIcon(R.drawable.ic_aviso)
                .setColor(0xFFEE1C3C)
                .setContentTitle(titulo == null ? "Fantasy Manager" : titulo)
                .setContentText(cuerpo)
                .setStyle(new Notification.BigTextStyle().bigText(cuerpo))
                .setContentIntent(abrir(c, clave, hash))
                .setAutoCancel(true);
        if (alarma) b.setCategory(Notification.CATEGORY_ALARM).setTimeoutAfter(ALARMA_MS);
        Notification n = b.build();
        // sigue sonando hasta que la tocas, la quitas o bajas las notificaciones
        if (alarma) n.flags |= Notification.FLAG_INSISTENT;
        nm.notify(clave.hashCode(), n);
    }
}
