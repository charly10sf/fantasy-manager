package es.fantasymanager.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

/**
 * Mientras la IA prepara el plan (puede tardar uno o dos minutos), la app queda «en primer plano» con una
 * notificación fija. Sin esto, si sales de la app o se apaga la pantalla, Android le corta internet a la app
 * a medias («Software caused connection abort», «Unable to resolve host») y el plan no llega nunca.
 */
public class Trabajo extends Service {
    private static final String CANAL = "trabajo";
    private static final int ID = 7001;
    // por si la web no avisa de que ha terminado: como mucho 12 minutos
    private static final long MAXIMO = 12 * 60 * 1000L;
    private final Handler reloj = new Handler(Looper.getMainLooper());

    static void empezar(Context c, String titulo, String texto) {
        Intent i = new Intent(c, Trabajo.class).putExtra("titulo", titulo).putExtra("texto", texto);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
        else c.startService(i);
    }

    static void parar(Context c) {
        c.stopService(new Intent(c, Trabajo.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String texto = intent != null ? intent.getStringExtra("texto") : null;
        String titulo = intent != null ? intent.getStringExtra("titulo") : null;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "IA trabajando", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Sale mientras la IA prepara tu plan o contesta en el chat, para que no se corte aunque salgas de la app");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent abrir = new Intent(this, Principal.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, ID, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_aviso)
                .setColor(0xFFF0213B)
                .setContentTitle(titulo == null || titulo.isEmpty() ? "Preparando tu plan" : titulo)
                .setContentText(texto == null || texto.isEmpty() ? "La IA está leyendo tu liga y las noticias" : texto)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setProgress(0, 0, true)
                .setContentIntent(pi)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(ID, n);
        } catch (Exception e) {
            // Android no deja empezarlo ahora (la app ya estaba en segundo plano): se sigue sin él
            stopSelf();
            return START_NOT_STICKY;
        }
        reloj.removeCallbacksAndMessages(null);
        reloj.postDelayed(this::stopSelf, MAXIMO);
        return START_NOT_STICKY;
    }

    @Override
    public void onTimeout(int startId) {
        // Android 15 limita el tiempo de estos servicios: si se llega, se para sin más
        stopSelf();
    }

    @Override
    public void onDestroy() {
        reloj.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
