package es.fantasymanager.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Las tarjetas para compartir (el plan, una pullita): la web las dibuja como PNG, Puente.compartirImagen las deja en
 * la caché y este proveedor le deja leerlas a la app con la que compartes (WhatsApp...) con un permiso temporal.
 * Solo sirve los PNG de su carpeta, nada más.
 */
public class Tarjetas extends ContentProvider {
    private static final String TIPO = "image/png";
    // las de antes se borran al guardar una nueva, pasado este rato (la app a la que se mandó ya la ha leído)
    private static final long VIDA = 30 * 60 * 1000L;

    static String autoridad(Context c) {
        return c.getPackageName() + ".tarjetas";
    }

    static File carpeta(Context c) {
        File d = new File(c.getCacheDir(), "tarjetas");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    /** guarda la imagen y devuelve con qué dirección se comparte */
    static Uri guardar(Context c, byte[] png) throws IOException {
        File d = carpeta(c);
        long ahora = System.currentTimeMillis();
        File[] viejas = d.listFiles();
        if (viejas != null) for (File f : viejas) if (ahora - f.lastModified() > VIDA) f.delete();
        String nombre = "tarjeta-" + ahora + ".png";
        try (FileOutputStream o = new FileOutputStream(new File(d, nombre))) {
            o.write(png);
        }
        return Uri.parse("content://" + autoridad(c) + "/" + nombre);
    }

    private File archivo(Uri u) {
        Context c = getContext();
        if (u == null || c == null) return null;
        String n = u.getLastPathSegment();
        if (n == null || !n.matches("tarjeta-[0-9]+\\.png")) return null;
        File f = new File(carpeta(c), n);
        return f.exists() ? f : null;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri u, String modo) throws FileNotFoundException {
        File f = archivo(u);
        if (f == null) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri u) {
        return TIPO;
    }

    @Override
    public Cursor query(Uri u, String[] columnas, String sel, String[] args, String orden) {
        File f = archivo(u);
        if (f == null) return null;
        String[] cols = columnas == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : columnas;
        Object[] fila = new Object[cols.length];
        for (int k = 0; k < cols.length; k++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[k])) fila[k] = "fantasy-manager.png";
            else if (OpenableColumns.SIZE.equals(cols[k])) fila[k] = f.length();
        }
        MatrixCursor c = new MatrixCursor(cols, 1);
        c.addRow(fila);
        return c;
    }

    @Override
    public Uri insert(Uri u, ContentValues v) {
        return null;
    }

    @Override
    public int delete(Uri u, String sel, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri u, ContentValues v, String sel, String[] args) {
        return 0;
    }
}
