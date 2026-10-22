package es.fantasymanager.app;

import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Las fotos y capturas que se mandan a la IA: se abren desde el selector de fotos, se giran si la foto lo pide,
 * se reducen a 1600 px el lado largo y se pasan a JPEG en base64 para la web. Así una captura del móvil se lee
 * bien y no pesa (unos 200-400 KB).
 */
final class Fotos {
    static final int LADO = 1600;

    private Fotos() {
    }

    /** la imagen lista para la web (JPEG en base64) o null si no se puede abrir */
    static String jpegB64(ContentResolver cr, Uri u) throws Exception {
        BitmapFactory.Options medir = new BitmapFactory.Options();
        medir.inJustDecodeBounds = true;
        try (InputStream in = cr.openInputStream(u)) {
            if (in == null) return null;
            BitmapFactory.decodeStream(in, null, medir);
        }
        if (medir.outWidth <= 0 || medir.outHeight <= 0) return null;
        // primero se abre ya reducida (en potencias de 2) para no llenar la memoria con una foto de 50 Mpx
        int paso = 1;
        while (Math.max(medir.outWidth, medir.outHeight) / (paso * 2) >= LADO) paso *= 2;
        BitmapFactory.Options abrir = new BitmapFactory.Options();
        abrir.inSampleSize = paso;
        Bitmap b;
        try (InputStream in = cr.openInputStream(u)) {
            if (in == null) return null;
            b = BitmapFactory.decodeStream(in, null, abrir);
        }
        if (b == null) return null;
        int giro = 0;
        try (InputStream in = cr.openInputStream(u)) {
            if (in != null) {
                int o = new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                giro = o == ExifInterface.ORIENTATION_ROTATE_90 ? 90 : o == ExifInterface.ORIENTATION_ROTATE_180 ? 180 : o == ExifInterface.ORIENTATION_ROTATE_270 ? 270 : 0;
            }
        } catch (Exception e) {
            giro = 0; // sin datos de giro (las capturas no los llevan)
        }
        float f = Math.min(1f, (float) LADO / Math.max(b.getWidth(), b.getHeight()));
        if (f < 1f || giro != 0) {
            Matrix m = new Matrix();
            if (f < 1f) m.postScale(f, f);
            if (giro != 0) m.postRotate(giro);
            Bitmap b2 = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), m, true);
            if (b2 != b) b.recycle();
            b = b2;
        }
        // las que tienen transparencia, sobre blanco (el JPEG no tiene transparencia y saldría negro)
        if (b.hasAlpha()) {
            Bitmap fondo = Bitmap.createBitmap(b.getWidth(), b.getHeight(), Bitmap.Config.ARGB_8888);
            android.graphics.Canvas c = new android.graphics.Canvas(fondo);
            c.drawColor(0xFFFFFFFF);
            c.drawBitmap(b, 0, 0, null);
            b.recycle();
            b = fondo;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 85, out);
        b.recycle();
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
