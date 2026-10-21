package es.fantasymanager.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Le deja al instalador de Android leer el APK descargado (y nada más) con un permiso temporal. */
public class Archivos extends ContentProvider {
    static final String AUTORIDAD = "es.fantasymanager.app.archivos";
    private static final String TIPO = "application/vnd.android.package-archive";

    static Uri uri() {
        return Uri.parse("content://" + AUTORIDAD + "/" + Actualizador.NOMBRE);
    }

    private File archivo(Uri u) {
        if (u == null || !Actualizador.NOMBRE.equals(u.getLastPathSegment()) || getContext() == null) return null;
        File f = Actualizador.archivo(getContext());
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
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{f.getName(), f.length()});
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
