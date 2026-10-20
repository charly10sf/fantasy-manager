package es.fantasymanager.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al reiniciar el móvil o actualizar la app, Android borra las alarmas: aquí se vuelven a poner. */
public class Arranque extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Avisos.reprogramar(c);
    }
}
