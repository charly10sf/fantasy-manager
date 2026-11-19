package es.fantasymanager.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * De dónde baja AlDia la web nueva (19 nov, el fallo de Bryan: con los datos de su operadora no llegaba a las IP de
 * GitHub Pages, y como charly10sf.github.io redirige al mismo dominio, no había respaldo de verdad).
 *
 * Primero el dominio y, si no se llega a él (no conecta, tarda, no encuentra la dirección, https roto…), el respaldo de
 * Cloudflare Pages, que la Action «Dominio» publica con el mismo paquete.json firmado. Lo que llega pero no vale (HTTP
 * 404, firma mala, demasiado grande) no pasa al respaldo: es un problema del paquete, no de la conexión. Todo el paquete
 * (paquete.json, su firma y los archivos) se baja del mismo sitio, y la firma Ed25519 se comprueba igual venga de donde
 * venga: el respaldo no abre ningún agujero.
 *
 * Sin nada de Android, para probarlo con Java a secas (android/prueba/PruebaOrigenes.java, en «Pruebas»).
 */
final class Origenes {
    static final String DOMINIO = "https://fantasymanagerapp.com/";
    static final String RESPALDO = "https://fantasy-manager-61v.pages.dev/";
    /** los sitios, en orden (el primero es «dominio», los demás «respaldo»); las pruebas los cambian por servidores locales */
    static String[] lista = {DOMINIO, RESPALDO};
    static int conectarMs = 15000, leerMs = 30000;
    static String agente = "FantasyManagerApp";
    static final long MAX_ARCHIVO = 8L << 20;

    private Origenes() {
    }

    /** lo que llega pero no vale (HTTP que no es 200, sin https, demasiado grande, firma mala): no se prueba en otro sitio */
    static final class NoVale extends IOException {
        NoVale(String m) {
            super(m);
        }
    }

    /** un paquete.json con la firma buena y de dónde ha salido */
    static final class Paquete {
        final String base, nombre, fallo;
        final byte[] json;

        Paquete(String base, String nombre, byte[] json, String fallo) {
            this.base = base;
            this.nombre = nombre;
            this.json = json;
            this.fallo = fallo;
        }

        /** se ha tenido que ir al respaldo */
        boolean respaldo() {
            return !fallo.isEmpty();
        }
    }

    static String nombre(int i) {
        return i == 0 ? "dominio" : "respaldo";
    }

    /**
     * paquete.json y su firma del primer sitio que conteste; la firma se comprueba con `clave` (32 bytes) antes de
     * devolverlo. Si ninguno contesta, IOException «sin conexión · dominio: … · respaldo: …» (cabe en los 90 caracteres
     * que guarda Quién usa la app).
     */
    static Paquete paquete(byte[] clave, long t) throws IOException {
        StringBuilder fallos = new StringBuilder();
        for (int i = 0; i < lista.length; i++) {
            String base = lista[i];
            try {
                byte[] json = bajarBytes(base, "paquete.json?t=" + t, 4L << 20);
                byte[] sig = bajarBytes(base, "paquete.json.sig?t=" + t, 1024);
                comprobarFirma(clave, json, sig);
                return new Paquete(base, nombre(i), json, fallos.toString());
            } catch (NoVale e) {
                throw new NoVale(nombre(i) + ": " + e.getMessage() + (fallos.length() > 0 ? " (" + fallos + ")" : ""));
            } catch (IOException e) {
                if (fallos.length() > 0) fallos.append(" · ");
                fallos.append(nombre(i)).append(": ").append(motivo(e));
            }
        }
        throw new IOException("sin conexión · " + fallos);
    }

    /** ¿es de la conexión (no conecta, tarda, sin dirección, https roto)? */
    static boolean deRed(Exception e) {
        return e instanceof java.net.SocketException || e instanceof SocketTimeoutException || e instanceof UnknownHostException
                || e instanceof javax.net.ssl.SSLException;
    }

    private static final Pattern IP = Pattern.compile("/([0-9]{1,3}(?:\\.[0-9]{1,3}){3}|[0-9a-fA-F:]*:[0-9a-fA-F:]+) \\(port");

    /** por qué no se ha llegado a un sitio, corto y con la IP si la dice: «no conecta (185.199.109.153)» */
    static String motivo(IOException e) {
        String m = e.getMessage() == null ? "" : e.getMessage();
        String que;
        if (e instanceof SocketTimeoutException) que = "tarda";
        else if (e instanceof ConnectException || e instanceof NoRouteToHostException) que = "no conecta";
        else if (e instanceof UnknownHostException) que = "sin dirección";
        else if (e instanceof javax.net.ssl.SSLException) que = "https roto";
        else que = (m.isEmpty() ? e.getClass().getSimpleName() : m).replaceAll("\\s+", " ");
        if (que.length() > 30) que = que.substring(0, 30) + "…";
        Matcher x = IP.matcher(m);
        return x.find() ? que + " (" + x.group(1) + ")" : que;
    }

    /** la firma de paquete.json: base64 de 64 bytes, válida con `clave`; si no, NoVale (no se baja nada) */
    static void comprobarFirma(byte[] clave, byte[] paquete, byte[] sig) throws NoVale {
        byte[] firma;
        try {
            firma = java.util.Base64.getDecoder().decode(new String(sig, StandardCharsets.US_ASCII).trim());
        } catch (IllegalArgumentException e) {
            throw new NoVale("paquete con firma ilegible");
        }
        if (!Ed25519.verificar(clave, paquete, firma)) throw new NoVale("paquete con firma mala");
    }

    private static HttpURLConnection abrir(String base, String rel) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(base + rel).openConnection();
        con.setConnectTimeout(conectarMs);
        con.setReadTimeout(leerMs);
        con.setUseCaches(false);
        con.setRequestProperty("User-Agent", agente);
        con.setRequestProperty("Cache-Control", "no-cache");
        int s = con.getResponseCode();
        if (s != 200) {
            con.disconnect();
            throw new NoVale("HTTP " + s + " en " + rel.replaceAll("\\?.*", ""));
        }
        if (!"https".equals(con.getURL().getProtocol())) {
            con.disconnect();
            throw new NoVale("sin https");
        }
        return con;
    }

    static byte[] bajarBytes(String base, String rel, long max) throws IOException {
        HttpURLConnection con = abrir(base, rel);
        try (InputStream in = con.getInputStream()) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[16384];
            int r;
            long n = 0;
            while ((r = in.read(b)) > 0) {
                n += r;
                if (n > max) throw new NoVale("demasiado grande");
                o.write(b, 0, r);
            }
            return o.toByteArray();
        } finally {
            con.disconnect();
        }
    }

    static long bajarArchivo(String base, String rel, File dest) throws IOException {
        HttpURLConnection con = abrir(base, rel);
        long n = 0;
        try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(dest)) {
            byte[] b = new byte[65536];
            int r;
            while ((r = in.read(b)) > 0) {
                n += r;
                if (n > MAX_ARCHIVO) throw new NoVale("archivo demasiado grande");
                out.write(b, 0, r);
            }
        } finally {
            con.disconnect();
        }
        return n;
    }
}
