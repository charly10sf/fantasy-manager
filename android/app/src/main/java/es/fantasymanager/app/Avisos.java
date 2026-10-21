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
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Los avisos del móvil. La web calcula cuándo pasa cada cosa (se abre la cláusula de un rival, se acaba la
 * protección de uno tuyo, cierra el mercado, empieza la jornada...) y se lo pasa aquí como una lista. Cada
 * aviso es una alarma del sistema, así llega aunque la app esté cerrada. Los que repiten (el recordatorio
 * diario) se vuelven a programar solos para el día siguiente.
 */
public class Avisos extends BroadcastReceiver {
    static final String ACCION = "es.fantasymanager.app.AVISO";
    static final String CANAL = "avisos";

    @Override
    public void onReceive(Context c, Intent i) {
        if (i == null || !ACCION.equals(i.getAction())) return;
        String id = i.getStringExtra("id");
        mostrar(c, id == null ? "aviso" : id, i.getStringExtra("titulo"), i.getStringExtra("texto"), i.getStringExtra("hash"));
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
                PendingIntent pi = intencion(c, a);
                try {
                    if (exactas) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                    else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                } catch (SecurityException e) {
                    // el permiso de alarmas exactas se quitó a mitad: con unos minutos de margen
                    exactas = false;
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                }
            }
            prefs(c).edit().putString("avisos", quedan.toString()).apply();
        } catch (Exception e) {
            // sin permiso de alarmas exactas a mitad de camino u otro fallo: la próxima vez que se abra la app
        }
    }

    private static PendingIntent intencion(Context c, JSONObject a) {
        String id = a.optString("id", "aviso");
        Intent i = new Intent(c, Avisos.class).setAction(ACCION)
                .putExtra("id", id)
                .putExtra("titulo", a.optString("titulo", "Fantasy Manager"))
                .putExtra("texto", a.optString("texto", ""))
                .putExtra("hash", a.optString("hash", ""))
                .putExtra("cada", a.optLong("cada", 0));
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void mostrar(Context c, String clave, String titulo, String texto, String hash) {
        if (!permitidos(c)) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Avisos de tu liga", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Cláusulas que se abren, protección que se acaba, mercado que cierra y jornada que empieza");
            nm.createNotificationChannel(ch);
        }
        String h = hash == null ? "" : hash.replaceAll("[^a-z0-9/_-]", "");
        Intent i = new Intent(c, Principal.class).putExtra("hash", h).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, clave.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String cuerpo = texto == null ? "" : texto;
        Notification n = new Notification.Builder(c, CANAL)
                .setSmallIcon(R.drawable.ic_aviso)
                .setColor(0xFFEE1C3C)
                .setContentTitle(titulo == null ? "Fantasy Manager" : titulo)
                .setContentText(cuerpo)
                .setStyle(new Notification.BigTextStyle().bigText(cuerpo))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify(clave.hashCode(), n);
    }
}
