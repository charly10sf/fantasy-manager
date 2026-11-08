package es.fantasymanager.app;

import java.math.BigInteger;
import java.security.MessageDigest;

/**
 * Comprobar una firma Ed25519 (RFC 8032, sección 5.1.7), solo verificar, en Java normal y sin dependencias.
 *
 * Por qué aquí y no con java.security: Android trae Ed25519 («Ed25519» en Signature/KeyFactory) solo desde la API 33
 * (Android 13), y la app funciona desde la 26 (minSdk). BouncyCastle o Tink añadirían cientos de KB y otra pieza
 * de terceros justo en lo que decide qué código entra en la app. Esto es la implementación de referencia del RFC
 * (coordenadas extendidas, BigInteger), unas pocas decenas de líneas que se pueden leer enteras. No es de tiempo
 * constante, y no hace falta: aquí no hay nada secreto (clave pública, mensaje y firma son públicos). Tarda unas
 * decenas de milisegundos por firma, una vez por cada búsqueda de web nueva, fuera del hilo de la pantalla.
 *
 * Estricta: rechaza claves y R que no se descomprimen o no son canónicas (y ≥ p), y S ≥ L (firmas maleables).
 * La prueba (android/prueba/PruebaFirma.java) la pasa contra los vectores del RFC y contra firmas de OpenSSL.
 */
final class Ed25519 {
    private static final BigInteger P = BigInteger.ONE.shiftLeft(255).subtract(BigInteger.valueOf(19));
    /** el orden del grupo: 2^252 + 27742317777372353535851937790883648493 */
    private static final BigInteger L = BigInteger.ONE.shiftLeft(252).add(new BigInteger("27742317777372353535851937790883648493"));
    private static final BigInteger D = BigInteger.valueOf(-121665).multiply(BigInteger.valueOf(121666).modInverse(P)).mod(P);
    private static final BigInteger RAIZ_M1 = BigInteger.valueOf(2).modPow(P.subtract(BigInteger.ONE).shiftRight(2), P);
    private static final BigInteger DOS = BigInteger.valueOf(2);
    /** el punto base */
    private static final BigInteger[] B;

    static {
        BigInteger y = BigInteger.valueOf(4).multiply(BigInteger.valueOf(5).modInverse(P)).mod(P);
        BigInteger x = recuperarX(y, 0);
        B = new BigInteger[]{x, y, BigInteger.ONE, x.multiply(y).mod(P)};
    }

    private Ed25519() {
    }

    /** true solo si «firma» (64 bytes) es una firma válida de «mensaje» con la clave pública «publica» (32 bytes) */
    static boolean verificar(byte[] publica, byte[] mensaje, byte[] firma) {
        try {
            if (publica == null || mensaje == null || firma == null || publica.length != 32 || firma.length != 64) return false;
            BigInteger[] a = descomprimir(publica, 0);
            if (a == null) return false;
            BigInteger[] r = descomprimir(firma, 0);
            if (r == null) return false;
            BigInteger s = numero(firma, 32, 32);
            if (s.compareTo(L) >= 0) return false;
            MessageDigest md = MessageDigest.getInstance("SHA-512");
            md.update(firma, 0, 32);
            md.update(publica);
            md.update(mensaje);
            BigInteger h = numero(md.digest(), 0, 64).mod(L);
            // [S]B = R + [h]A
            return iguales(multiplicar(s, B), sumar(r, multiplicar(h, a)));
        } catch (Exception e) {
            return false;
        }
    }

    /** entero sin signo en little-endian */
    private static BigInteger numero(byte[] b, int desde, int largo) {
        byte[] be = new byte[largo];
        for (int i = 0; i < largo; i++) be[i] = b[desde + largo - 1 - i];
        return new BigInteger(1, be);
    }

    private static BigInteger recuperarX(BigInteger y, int signo) {
        if (y.compareTo(P) >= 0) return null;
        BigInteger y2 = y.multiply(y);
        BigInteger x2 = y2.subtract(BigInteger.ONE).multiply(D.multiply(y2).add(BigInteger.ONE).modInverse(P)).mod(P);
        if (x2.signum() == 0) return signo == 1 ? null : BigInteger.ZERO;
        BigInteger x = x2.modPow(P.add(BigInteger.valueOf(3)).shiftRight(3), P);
        if (x.multiply(x).subtract(x2).mod(P).signum() != 0) x = x.multiply(RAIZ_M1).mod(P);
        if (x.multiply(x).subtract(x2).mod(P).signum() != 0) return null;
        if (x.testBit(0) != (signo == 1)) x = P.subtract(x);
        return x;
    }

    private static BigInteger[] descomprimir(byte[] b, int desde) {
        BigInteger y = numero(b, desde, 32);
        int signo = y.testBit(255) ? 1 : 0;
        y = y.clearBit(255);
        BigInteger x = recuperarX(y, signo);
        if (x == null) return null;
        return new BigInteger[]{x, y, BigInteger.ONE, x.multiply(y).mod(P)};
    }

    private static BigInteger[] sumar(BigInteger[] p, BigInteger[] q) {
        BigInteger a = p[1].subtract(p[0]).multiply(q[1].subtract(q[0])).mod(P);
        BigInteger b = p[1].add(p[0]).multiply(q[1].add(q[0])).mod(P);
        BigInteger c = DOS.multiply(p[3]).multiply(q[3]).multiply(D).mod(P);
        BigInteger d = DOS.multiply(p[2]).multiply(q[2]).mod(P);
        BigInteger e = b.subtract(a), f = d.subtract(c), g = d.add(c), h = b.add(a);
        return new BigInteger[]{e.multiply(f).mod(P), g.multiply(h).mod(P), f.multiply(g).mod(P), e.multiply(h).mod(P)};
    }

    private static BigInteger[] multiplicar(BigInteger s, BigInteger[] p) {
        BigInteger[] q = {BigInteger.ZERO, BigInteger.ONE, BigInteger.ONE, BigInteger.ZERO};
        for (int i = 0, n = s.bitLength(); i < n; i++) {
            if (s.testBit(i)) q = sumar(q, p);
            p = sumar(p, p);
        }
        return q;
    }

    private static boolean iguales(BigInteger[] p, BigInteger[] q) {
        return p[0].multiply(q[2]).subtract(q[0].multiply(p[2])).mod(P).signum() == 0
                && p[1].multiply(q[2]).subtract(q[1].multiply(p[2])).mod(P).signum() == 0;
    }
}
