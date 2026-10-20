package es.fantasymanager.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * La IA trabajando sin la app abierta. Cada 3 horas, y aparte unos minutos después de cada cambio de mercado,
 * Android despierta a la app con internet; aquí se abre la misma web en un WebView sin pantalla
 * (index.html?fondo=1), que actualiza tu liga, rehace el plan con Gemini y avisa con notificaciones de lo
 * importante (el plan nuevo, ofertas, cláusulas, fichajes). Cuando acaba llama a fondoTerminado().
 * Android da como mucho 10 minutos a cada pasada; aquí se cortan a los 9.
 */
public class Fondo extends Worker {
    static final String PERIODICO = "fondo";
    static final String MERCADO = "fondo-mercado";
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final CountDownLatch fin = new CountDownLatch(1);
    private volatile WebView web;

    public Fondo(@NonNull Context c, @NonNull WorkerParameters p) {
        super(c, p);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        SharedPreferences p = Puente.prefs(c);
        if (!p.getBoolean("fondo_on", true)) return Result.success();
        // con la app abierta (o la IA ya trabajando en ella) no hace falta: lo hace la propia app
        if (Principal.abierta || Puente.ocupada) return Result.success();
        p.edit().putLong("fondo_ini", System.currentTimeMillis()).remove("fondo_error").apply();
        ui.post(() -> {
            try {
                WebView w = new WebView(c);
                Web.preparar(w);
                w.addJavascriptInterface(new Puente(c, this), "FantasyApp");
                w.setWebViewClient(Web.clienteFondo(c));
                w.loadUrl(Principal.INICIO + "?fondo=1");
                web = w;
            } catch (Throwable e) {
                p.edit().putString("fondo_error", String.valueOf(e)).apply();
                fin.countDown();
            }
        });
        try {
            if (!fin.await(9, TimeUnit.MINUTES)) p.edit().putString("fondo_error", "sin terminar a los 9 minutos").apply();
        } catch (InterruptedException e) {
            // Android ha parado el trabajo
        }
        ui.post(() -> {
            WebView w = web;
            web = null;
            if (w != null) {
                w.stopLoading();
                w.destroy();
            }
        });
        p.edit().putLong("fondo_fin", System.currentTimeMillis()).apply();
        reprogramar(c);
        return Result.success();
    }

    @Override
    public void onStopped() {
        fin.countDown();
    }

    /** ejecuta algo en la web sin pantalla (las respuestas del Puente) */
    void js(String codigo) {
        ui.post(() -> {
            WebView w = web;
            if (w != null) w.evaluateJavascript(codigo, null);
        });
    }

    void terminar() {
        fin.countDown();
    }

    /**
     * Cada 3 horas (con internet) y una pasada suelta unos minutos después del próximo cambio de mercado, que la
     * web apunta en fondo_prox. Con la opción apagada, nada.
     */
    static void reprogramar(Context c) {
        try {
            SharedPreferences p = Puente.prefs(c);
            WorkManager wm = WorkManager.getInstance(c);
            if (!p.getBoolean("fondo_on", true)) {
                wm.cancelUniqueWork(PERIODICO);
                wm.cancelUniqueWork(MERCADO);
                p.edit().remove("fondo_prog").apply();
                return;
            }
            Constraints red = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
            wm.enqueueUniquePeriodicWork(PERIODICO, ExistingPeriodicWorkPolicy.KEEP,
                    new PeriodicWorkRequest.Builder(Fondo.class, 3, TimeUnit.HOURS, 30, TimeUnit.MINUTES).setConstraints(red).build());
            long prox = p.getLong("fondo_prox", 0), prog = p.getLong("fondo_prog", 0), ahora = System.currentTimeMillis();
            if (prox > ahora && prox != prog) {
                wm.enqueueUniqueWork(MERCADO, ExistingWorkPolicy.REPLACE,
                        new OneTimeWorkRequest.Builder(Fondo.class).setInitialDelay(prox - ahora, TimeUnit.MILLISECONDS).setConstraints(red).build());
                p.edit().putLong("fondo_prog", prox).apply();
            }
        } catch (Exception e) {
            // WorkManager no está listo: la próxima vez que se abra la app
        }
    }
}
