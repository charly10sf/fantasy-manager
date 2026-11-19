package es.fantasymanager.app;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Prueba de Origenes.java (de dónde baja AlDia la web nueva) sin Android, con servidores https locales: uno bueno, uno
 * cerrado (no conecta), un agujero negro (conecta y no contesta), uno que da 404 y uno con la firma mala.
 *
 *   javac -d /tmp/origenes android/app/src/main/java/es/fantasymanager/app/{Ed25519,Origenes}.java android/prueba/PruebaOrigenes.java
 *   java -cp /tmp/origenes es.fantasymanager.app.PruebaOrigenes
 *
 * Necesita keytool (para el certificado de mentira). La clave Ed25519 es una de prueba, no la de verdad.
 */
public final class PruebaOrigenes {
    private static int mal, bien;
    private static byte[] pub, json, sig, mala;
    private static final List<HttpsServer> servidores = new ArrayList<>();
    private static SSLContext ssl;

    public static void main(String[] a) throws Exception {
        preparar();
        Origenes.conectarMs = 2000;
        Origenes.leerMs = 1500;
        AtomicInteger nBueno = new AtomicInteger(), nBueno2 = new AtomicInteger(), n404 = new AtomicInteger(), nFirma = new AtomicInteger();
        String bueno = servidor(nBueno, json, sig, 200), bueno2 = servidor(nBueno2, json, sig, 200);
        String de404 = servidor(n404, json, sig, 404);
        String firmaMala = servidor(nFirma, json, mala, 200);
        String cerrado = cerrado(), cerrado2 = cerrado(), agujero = agujero();

        // 1. el dominio no conecta: al respaldo, y de ahí el paquete
        Origenes.lista = new String[]{cerrado, bueno};
        Origenes.Paquete p = Origenes.paquete(pub, 1);
        igual("1 no conecta → respaldo", p.nombre, "respaldo");
        igual("1 mismo paquete", Arrays.equals(p.json, json), true);
        igual("1 base del respaldo", p.base, bueno);
        igual("1 dice qué falló", p.fallo.startsWith("dominio: no conecta"), true);
        igual("1 respaldo()", p.respaldo(), true);
        // y los archivos, del mismo sitio
        File f = File.createTempFile("origenes", ".js");
        Origenes.bajarArchivo(p.base, "js/a.js?v=1", f);
        igual("1 archivo del respaldo", new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8), "hola");

        // 2. el dominio contesta: ni se mira el respaldo
        nBueno.set(0);
        Origenes.lista = new String[]{bueno, bueno2};
        p = Origenes.paquete(pub, 2);
        igual("2 dominio", p.nombre, "dominio");
        igual("2 sin fallo", p.respaldo(), false);
        igual("2 respaldo sin tocar", nBueno2.get(), 0);

        // 3. el dominio da 404: no es la conexión, no se va al respaldo
        Origenes.lista = new String[]{de404, bueno2};
        falla("3 404", () -> Origenes.paquete(pub, 3), true, "dominio: HTTP 404 en paquete.json");
        igual("3 respaldo sin tocar", nBueno2.get(), 0);

        // 4. firma mala en el dominio: tampoco
        Origenes.lista = new String[]{firmaMala, bueno2};
        falla("4 firma mala", () -> Origenes.paquete(pub, 4), true, "dominio: paquete con firma mala");
        igual("4 respaldo sin tocar", nBueno2.get(), 0);

        // 5. firma mala en el respaldo (tras no conectar con el dominio): no se da por bueno
        Origenes.lista = new String[]{cerrado, firmaMala};
        falla("5 firma mala en el respaldo", () -> Origenes.paquete(pub, 5), true, "respaldo: paquete con firma mala (dominio: no conecta");

        // 6. ninguno conecta: el motivo dice los dos y cabe en lo que guarda Quién usa la app
        Origenes.lista = new String[]{cerrado, cerrado2};
        String m = falla("6 ninguno", () -> Origenes.paquete(pub, 6), false, "sin conexión · dominio: no conecta · respaldo: no conecta");
        igual("6 cabe en 90", m != null && m.length() <= 90, true);

        // 7. el dominio conecta y no contesta (agujero negro): al respaldo cuando se cansa de esperar
        Origenes.lista = new String[]{agujero, bueno};
        long t0 = System.currentTimeMillis();
        p = Origenes.paquete(pub, 7);
        igual("7 agujero → respaldo", p.nombre, "respaldo");
        igual("7 tarda", p.fallo.startsWith("dominio: tarda"), true);
        igual("7 no espera de más", System.currentTimeMillis() - t0 < 6000, true);

        // 8. el motivo, con el mensaje que da Android (el de Bryan)
        igual("8 motivo Android", Origenes.motivo(new ConnectException("failed to connect to fantasymanagerapp.com/185.199.109.153 (port 443) from /10.85.35.168 (port 41234) after 15000ms")), "no conecta (185.199.109.153)");
        String largo = "sin conexión · dominio: " + Origenes.motivo(new java.net.SocketTimeoutException("failed to connect to fantasymanagerapp.com/185.199.109.153 (port 443) from /10.85.35.168 (port 41234) after 15000ms"))
                + " · respaldo: " + Origenes.motivo(new ConnectException("failed to connect to fantasy-manager-61v.pages.dev/172.66.44.155 (port 443) from /10.85.35.168 (port 41235) after 15000ms"));
        igual("8 el peor caso cabe en 90 (" + largo.length() + ")", largo.length() <= 90, true);

        for (HttpsServer s : servidores) s.stop(0);
        System.out.println(mal == 0 ? "Origenes: " + bien + " comprobaciones bien" : "Origenes: " + mal + " MAL de " + (bien + mal));
        System.exit(mal == 0 ? 0 : 1);
    }


    interface Llamada {
        Object hacer() throws Exception;
    }

    /** que falle con un mensaje que empiece así; noVale: si tiene que ser de lo que no pasa al respaldo */
    private static String falla(String que, Llamada l, boolean noVale, String empieza) {
        try {
            l.hacer();
            igual(que + " (no ha fallado)", false, true);
            return null;
        } catch (Exception e) {
            igual(que + " NoVale", e instanceof Origenes.NoVale, noVale);
            igual(que + " «" + e.getMessage() + "»", String.valueOf(e.getMessage()).startsWith(empieza), true);
            return e.getMessage();
        }
    }

    private static void igual(String que, Object es, Object debe) {
        if (es == null ? debe == null : es.equals(debe)) bien++;
        else {
            mal++;
            System.out.println("MAL " + que + ": " + es + " (debía ser " + debe + ")");
        }
    }

    /* ---------------- los servidores de mentira ---------------- */

    private static void preparar() throws Exception {
        // la clave de prueba y el paquete firmado con ella
        KeyPair kp = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        byte[] enc = kp.getPublic().getEncoded();
        pub = Arrays.copyOfRange(enc, enc.length - 32, enc.length);
        json = "{\"version\":\"0.0.1\",\"archivos\":{\"js/a.js\":\"x\"}}".getBytes(StandardCharsets.UTF_8);
        Signature s = Signature.getInstance("Ed25519");
        s.initSign(kp.getPrivate());
        s.update(json);
        byte[] firma = s.sign();
        sig = Base64.getEncoder().encode(firma);
        firma[3] ^= 1;
        mala = Base64.getEncoder().encode(firma);
        // el certificado de mentira (keytool) y un cliente que se fía de él solo en esta prueba
        File ks = File.createTempFile("origenes", ".p12");
        ks.delete();
        Process k = new ProcessBuilder("keytool", "-genkeypair", "-keystore", ks.getPath(), "-storetype", "PKCS12", "-alias", "s",
                "-keyalg", "RSA", "-keysize", "2048", "-validity", "2", "-storepass", "prueba123", "-keypass", "prueba123",
                "-dname", "CN=127.0.0.1", "-ext", "SAN=ip:127.0.0.1").redirectErrorStream(true).start();
        k.getInputStream().readAllBytes();
        if (k.waitFor() != 0) throw new IOException("keytool ha fallado");
        KeyStore st = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(ks)) {
            st.load(in, "prueba123".toCharArray());
        }
        KeyManagerFactory km = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        km.init(st, "prueba123".toCharArray());
        ssl = SSLContext.getInstance("TLS");
        ssl.init(km.getKeyManagers(), null, null);
        SSLContext cli = SSLContext.getInstance("TLS");
        cli.init(null, new TrustManager[]{new X509TrustManager() {
            public void checkClientTrusted(X509Certificate[] c, String t) {
            }

            public void checkServerTrusted(X509Certificate[] c, String t) {
            }

            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        }}, null);
        HttpsURLConnection.setDefaultSSLSocketFactory(cli.getSocketFactory());
        HttpsURLConnection.setDefaultHostnameVerifier((h, x) -> true);
    }

    /** un servidor https que da paquete.json (con `codigo`), su firma y js/a.js */
    private static String servidor(AtomicInteger n, byte[] json, byte[] sig, int codigo) throws Exception {
        HttpsServer s = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s.setHttpsConfigurator(new HttpsConfigurator(ssl));
        byte[] laFirma = sig;
        s.createContext("/", x -> {
            n.incrementAndGet();
            String p = x.getRequestURI().getPath();
            byte[] b = null;
            int c = 200;
            if (p.equals("/paquete.json")) {
                b = json;
                c = codigo;
            } else if (p.equals("/paquete.json.sig")) b = laFirma;
            else if (p.equals("/js/a.js")) b = "hola".getBytes(StandardCharsets.UTF_8);
            if (b == null) c = 404;
            byte[] cuerpo = b == null ? new byte[0] : b;
            x.sendResponseHeaders(c, cuerpo.length);
            try (OutputStream o = x.getResponseBody()) {
                o.write(cuerpo);
            }
        });
        s.start();
        servidores.add(s);
        return "https://127.0.0.1:" + s.getAddress().getPort() + "/";
    }

    /** un puerto en el que no escucha nadie */
    private static String cerrado() throws IOException {
        try (ServerSocket ss = new ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
            return "https://127.0.0.1:" + ss.getLocalPort() + "/";
        }
    }

    /** conecta y no contesta nunca */
    private static String agujero() throws IOException {
        ServerSocket ss = new ServerSocket(0, 50, java.net.InetAddress.getByName("127.0.0.1"));
        Thread t = new Thread(() -> {
            List<Socket> abiertos = new ArrayList<>();
            try {
                while (true) abiertos.add(ss.accept());
            } catch (IOException e) {
                // fin
            }
        });
        t.setDaemon(true);
        t.start();
        return "https://127.0.0.1:" + ss.getLocalPort() + "/";
    }
}
