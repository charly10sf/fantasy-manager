package es.fantasymanager.app;

/** La versión de GitHub (la de la liga) no lleva anuncios: todo esto no hace nada. Los de verdad, en src/play. */
final class Anuncios {
    static final boolean HAY = false;

    private Anuncios() {
    }

    static void alCrear(Principal a) {
    }

    static void zona(boolean si, String bloque, boolean inter) {
    }

    static void intersticial(String bloque) {
    }

    static void apertura(boolean toca, String bloque) {
    }

    static void teclado(boolean abierto) {
    }

    static void alPausar() {
    }

    static void alVolver() {
    }

    static void alCerrar(Principal a) {
    }

    static void cancelar() {
    }

    static void ver(Principal a, String para) {
        a.js("window.anuncioVisto && anuncioVisto(" + org.json.JSONObject.quote(para) + ",false,'sin anuncios')");
    }

    static boolean hayPrivacidad() {
        return false;
    }

    static void privacidad(Principal a) {
    }
}
