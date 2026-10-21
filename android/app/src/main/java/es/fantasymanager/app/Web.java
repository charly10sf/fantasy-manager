package es.fantasymanager.app;

import android.content.Context;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/** Lo que comparten el WebView de la pantalla y el que trabaja en segundo plano (Fondo). */
final class Web {
    private Web() {
    }

    static void preparar(WebView w) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        // sin zoom: ni pellizcando ni con doble toque
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " FantasyManagerApp/" + BuildConfig.VERSION_CODE);
        CookieManager.getInstance().setAcceptCookie(true);
    }

    /** web/ va en los assets y se sirve como https://appassets.androidplatform.net/assets/... */
    static WebViewAssetLoader cargador(Context c) {
        return new WebViewAssetLoader.Builder()
                .setDomain(Principal.HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(c))
                .build();
    }

    /** el cliente del WebView sin pantalla: solo sirve los assets y no abre nada fuera */
    static WebViewClient clienteFondo(Context c) {
        final WebViewAssetLoader cargador = cargador(c);
        return new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return cargador.shouldInterceptRequest(r.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !Principal.HOST.equalsIgnoreCase(r.getUrl().getHost());
            }
        };
    }
}
