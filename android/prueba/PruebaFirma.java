package es.fantasymanager.app;

import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;

/**
 * Prueba de Ed25519.java sin Android (solo Java), la misma clase que lleva el APK.
 *
 *   javac -d /tmp/firma android/app/src/main/java/es/fantasymanager/app/Ed25519.java android/prueba/PruebaFirma.java
 *   java -cp /tmp/firma es.fantasymanager.app.PruebaFirma                      → vectores del RFC 8032 y firmas rotas
 *   java -cp /tmp/firma es.fantasymanager.app.PruebaFirma <publica-b64> <archivo> <archivo-de-firma-b64>
 *                                                                              → 0 si la firma vale, 1 si no
 * La segunda forma la usa .github/firmar-paquete.sh para comprobar cada paquete.json firmado con el mismo código
 * que lo comprobará en el móvil.
 */
public final class PruebaFirma {
    private static int mal;

    public static void main(String[] a) throws Exception {
        if (a.length == 3) {
            byte[] pub = Base64.getDecoder().decode(a[0].trim());
            byte[] msg = Files.readAllBytes(Paths.get(a[1]));
            byte[] sig = Base64.getDecoder().decode(new String(Files.readAllBytes(Paths.get(a[2])), "US-ASCII").trim());
            boolean ok = Ed25519.verificar(pub, msg, sig);
            System.out.println(ok ? "firma buena (Ed25519.java)" : "FIRMA MALA (Ed25519.java)");
            System.exit(ok ? 0 : 1);
        }
        // RFC 8032, 7.1, pruebas 1 a 3 (las 2 y 3, comprobadas también con OpenSSL 3.0)
        String[][] v = {
                {"d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "",
                        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"},
                {"3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c", "72",
                        "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00"},
                {"fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025", "af82",
                        "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a"},
        };
        long t0 = System.nanoTime();
        for (String[] x : v) {
            byte[] pub = hex(x[0]), msg = hex(x[1]), sig = hex(x[2]);
            igual("vector " + x[0].substring(0, 8), Ed25519.verificar(pub, msg, sig), true);
            // cualquier bit cambiado en la firma, el mensaje o la clave: mala
            for (int i = 0; i < 64; i += 7) {
                byte[] s2 = sig.clone();
                s2[i] ^= 1;
                igual("firma tocada " + i, Ed25519.verificar(pub, msg, s2), false);
            }
            byte[] m2 = hex(x[1] + "00");
            igual("mensaje con un byte más", Ed25519.verificar(pub, m2, sig), false);
            if (msg.length > 0) {
                byte[] m3 = msg.clone();
                m3[0] ^= (byte) 0x80;
                igual("mensaje tocado", Ed25519.verificar(pub, m3, sig), false);
            }
            byte[] p2 = pub.clone();
            p2[5] ^= 4;
            igual("clave tocada", Ed25519.verificar(p2, msg, sig), false);
            // S + L: misma ecuación, pero S fuera de rango (maleable): mala
            igual("S + L", Ed25519.verificar(pub, msg, conS(sig, le(sig, 32).add(L))), false);
        }
        System.out.printf("3 vectores con sus variantes en %d ms%n", (System.nanoTime() - t0) / 1000000);
        byte[] pub = hex(v[1][0]), sig = hex(v[1][2]), msg = hex(v[1][1]);
        igual("firma de 63 bytes", Ed25519.verificar(pub, msg, java.util.Arrays.copyOf(sig, 63)), false);
        igual("firma de 65 bytes", Ed25519.verificar(pub, msg, java.util.Arrays.copyOf(sig, 65)), false);
        igual("clave de 31 bytes", Ed25519.verificar(java.util.Arrays.copyOf(pub, 31), msg, sig), false);
        igual("nulos", Ed25519.verificar(null, msg, sig) || Ed25519.verificar(pub, null, sig) || Ed25519.verificar(pub, msg, null), false);
        igual("firma a ceros", Ed25519.verificar(pub, msg, new byte[64]), false);
        byte[] ff = new byte[32];
        java.util.Arrays.fill(ff, (byte) 0xff);
        ff[31] = 0x7f;
        igual("clave con y ≥ p", Ed25519.verificar(ff, msg, sig), false);
        // la clave del paquete que va en AlDia.java: 32 bytes en base64
        String src = new String(Files.readAllBytes(Paths.get(args0("android/app/src/main/java/es/fantasymanager/app/AlDia.java"))), "UTF-8");
        java.util.regex.Matcher mt = java.util.regex.Pattern.compile("CLAVE_PAQUETE = \"([A-Za-z0-9+/=]+)\"").matcher(src);
        igual("CLAVE_PAQUETE en AlDia.java", mt.find() && Base64.getDecoder().decode(mt.group(1)).length == 32, true);
        System.out.println(mal == 0 ? "Ed25519: todo BIEN" : "Ed25519: " + mal + " MAL");
        System.exit(mal == 0 ? 0 : 1);
    }

    private static final BigInteger L = BigInteger.ONE.shiftLeft(252).add(new BigInteger("27742317777372353535851937790883648493"));

    private static String args0(String rel) {
        return Files.exists(Paths.get(rel)) ? rel : "../" + rel;
    }

    private static void igual(String que, boolean es, boolean debe) {
        if (es != debe) {
            mal++;
            System.out.println("MAL: " + que + " (sale " + es + ")");
        }
    }

    private static BigInteger le(byte[] b, int desde) {
        byte[] be = new byte[32];
        for (int i = 0; i < 32; i++) be[i] = b[desde + 31 - i];
        return new BigInteger(1, be);
    }

    private static byte[] conS(byte[] sig, BigInteger s) {
        byte[] r = sig.clone(), be = s.toByteArray();
        java.util.Arrays.fill(r, 32, 64, (byte) 0);
        for (int i = 0; i < be.length && i < 32; i++) r[32 + i] = be[be.length - 1 - i];
        return r;
    }

    private static byte[] hex(String h) {
        byte[] b = new byte[h.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(h.substring(2 * i, 2 * i + 2), 16);
        return b;
    }
}
