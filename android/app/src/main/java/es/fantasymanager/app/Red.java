package es.fantasymanager.app;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Dns;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okhttp3.dnsoverhttps.DnsOverHttps;

/**
 * Peticiones cuando el DNS del móvil no encuentra una dirección (pasa con bloqueadores de anuncios, algunos DNS
 * privados o redes que filtran). La dirección se pregunta por https a Cloudflare (1.1.1.1) y, si falla, a Google
 * (8.8.8.8); la conexión sigue siendo https normal con el mismo certificado.
 */
final class Red {
    private static volatile OkHttpClient cliente;

    private Red() {
    }

    private static OkHttpClient cliente() {
        if (cliente != null) return cliente;
        synchronized (Red.class) {
            if (cliente != null) return cliente;
            try {
                OkHttpClient base = new OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).build();
                DnsOverHttps cloudflare = new DnsOverHttps.Builder().client(base)
                        .url(HttpUrl.get("https://1.1.1.1/dns-query"))
                        .bootstrapDnsHosts(InetAddress.getByName("1.1.1.1"), InetAddress.getByName("1.0.0.1"))
                        .build();
                DnsOverHttps google = new DnsOverHttps.Builder().client(base)
                        .url(HttpUrl.get("https://dns.google/dns-query"))
                        .bootstrapDnsHosts(InetAddress.getByName("8.8.8.8"), InetAddress.getByName("8.8.4.4"))
                        .build();
                Dns dns = host -> {
                    List<UnknownHostException> fallos = new ArrayList<>();
                    for (Dns d : new Dns[]{cloudflare, google, Dns.SYSTEM}) {
                        try {
                            List<InetAddress> l = d.lookup(host);
                            if (!l.isEmpty()) return l;
                        } catch (UnknownHostException e) {
                            fallos.add(e);
                        }
                    }
                    throw fallos.isEmpty() ? new UnknownHostException(host) : fallos.get(0);
                };
                cliente = new OkHttpClient.Builder()
                        .dns(dns)
                        .connectTimeout(15, TimeUnit.SECONDS)
                        .readTimeout(180, TimeUnit.SECONDS)
                        .writeTimeout(60, TimeUnit.SECONDS)
                        .build();
            } catch (Exception e) {
                cliente = new OkHttpClient();
            }
            return cliente;
        }
    }

    static JSONObject pedir(String metodo, String url, String cabeceras, String cuerpo, int max) {
        JSONObject r = new JSONObject();
        try {
            Request.Builder b = new Request.Builder().url(url);
            String tipo = "application/json";
            if (cabeceras != null && !cabeceras.isEmpty()) {
                JSONObject h = new JSONObject(cabeceras);
                for (Iterator<String> it = h.keys(); it.hasNext(); ) {
                    String k = it.next();
                    if ("content-type".equalsIgnoreCase(k)) tipo = h.optString(k);
                    b.header(k, h.optString(k));
                }
            }
            String m = metodo == null || metodo.isEmpty() ? "GET" : metodo.toUpperCase();
            RequestBody body = cuerpo != null && !cuerpo.isEmpty() ? RequestBody.create(cuerpo, MediaType.parse(tipo)) : ("POST".equals(m) || "PUT".equals(m) ? RequestBody.create(new byte[0]) : null);
            b.method(m, body);
            try (Response res = cliente().newCall(b.build()).execute()) {
                ResponseBody rb = res.body();
                String texto = "";
                if (rb != null) {
                    try (InputStream in = rb.byteStream(); ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                        byte[] x = new byte[65536];
                        int n, total = 0;
                        while ((n = in.read(x)) > 0) {
                            total += n;
                            if (total > max) throw new Exception("respuesta demasiado grande");
                            buf.write(x, 0, n);
                        }
                        texto = buf.toString("UTF-8");
                    }
                }
                r.put("s", res.code());
                r.put("b", texto);
                String t = res.header("Content-Type");
                if (t != null) r.put("t", t);
                r.put("dns", "https");
            }
        } catch (Exception e) {
            try {
                r.put("s", 0);
                r.put("e", "sin conexión ni con DNS por https (" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()) + ")");
            } catch (Exception ignorada) {
                // no puede fallar
            }
        }
        return r;
    }
}
