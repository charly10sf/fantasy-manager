#!/usr/bin/env bash
# Firma web/paquete.json con Ed25519 (revisión total, A5) y deja la firma en web/paquete.json.sig (base64 de los
# 64 bytes, de los bytes exactos del archivo). La app (AlDia.java) la comprueba con la clave pública CLAVE_PAQUETE
# antes de bajar nada.
#
# La clave privada solo existe como secreto de Actions PAQUETE_FIRMA (el PEM PKCS#8 en base64; también vale el PEM
# tal cual). La generó Carlos en su ordenador: ni esta Action ni nadie la crea ni la guarda. Se escribe en
# RUNNER_TEMP solo lo que dura este script.
#
# Antes de dar la firma por buena, tres comprobaciones; si falla cualquiera, sale con error y no se publica:
#  1. la pública que sale de la privada es la misma que CLAVE_PAQUETE de AlDia.java (si no, las apps no la aceptarían);
#  2. OpenSSL verifica la firma con CLAVE_PAQUETE;
#  3. la verifica también Ed25519.java, el mismo código que lleva el APK (android/prueba/PruebaFirma.java).
#
# Uso: PAQUETE_FIRMA=… bash .github/firmar-paquete.sh [web/paquete.json]
set -euo pipefail

PAQ="${1:-web/paquete.json}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ALDIA="$RAIZ/android/app/src/main/java/es/fantasymanager/app/AlDia.java"
TMP="${RUNNER_TEMP:-/tmp}/firma-paquete.$$"

if [ -z "${PAQUETE_FIRMA:-}" ]; then
  echo "::error::Falta el secreto de Actions PAQUETE_FIRMA (la clave privada Ed25519 que firma paquete.json). Sin firma no se publica: las apps nuevas no bajarían la web. Añádelo en Settings > Secrets and variables > Actions."
  exit 1
fi
[ -f "$PAQ" ] || { echo "::error::No existe $PAQ (¿se ha ejecutado paquete.py?)"; exit 1; }

PUB=$(grep -oP 'CLAVE_PAQUETE = "\K[A-Za-z0-9+/=]+' "$ALDIA" | head -1 || true)
[ -n "$PUB" ] || { echo "::error::No encuentro CLAVE_PAQUETE en AlDia.java"; exit 1; }

mkdir -p "$TMP"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
umask 077

# la privada: el PEM en base64 (lo normal) o el PEM tal cual
case "$PAQUETE_FIRMA" in
  *-----BEGIN*) printf '%s\n' "$PAQUETE_FIRMA" > "$TMP/k.pem" ;;
  *) printf '%s' "$PAQUETE_FIRMA" | tr -d ' \r\n' | base64 -d > "$TMP/k.pem" 2>/dev/null || { echo "::error::PAQUETE_FIRMA no es base64 válido"; exit 1; } ;;
esac
TIPO=$(openssl pkey -in "$TMP/k.pem" -noout -text 2>/dev/null | head -1 || true)
if [ "$TIPO" != "ED25519 Private-Key:" ]; then
  echo "::error::PAQUETE_FIRMA no es una clave privada Ed25519 (PEM PKCS#8)"
  exit 1
fi

# 1. la pública de la privada = CLAVE_PAQUETE
DERIVADA=$(openssl pkey -in "$TMP/k.pem" -pubout -outform DER | tail -c 32 | base64 -w0)
if [ "$DERIVADA" != "$PUB" ]; then
  echo "::error::La clave privada de PAQUETE_FIRMA no casa con CLAVE_PAQUETE de AlDia.java (su pública es $DERIVADA). No se publica."
  exit 1
fi

openssl pkeyutl -sign -inkey "$TMP/k.pem" -rawin -in "$PAQ" -out "$TMP/firma.bin"
rm -f "$TMP/k.pem"
[ "$(wc -c < "$TMP/firma.bin")" -eq 64 ] || { echo "::error::La firma no mide 64 bytes"; exit 1; }
base64 -w0 "$TMP/firma.bin" > "$TMP/firma.b64"

# 2. OpenSSL, con la pública de AlDia.java (SubjectPublicKeyInfo de Ed25519: 12 bytes fijos y los 32 de la clave)
{ printf '\x30\x2a\x30\x05\x06\x03\x2b\x65\x70\x03\x21\x00'; printf '%s' "$PUB" | base64 -d; } > "$TMP/pub.der"
openssl pkeyutl -verify -pubin -inkey "$TMP/pub.der" -keyform DER -rawin -in "$PAQ" -sigfile "$TMP/firma.bin" > /dev/null \
  || { echo "::error::OpenSSL no da por buena la firma con CLAVE_PAQUETE"; exit 1; }

# 3. el código de la app
JAVAC="${JAVA_HOME:+$JAVA_HOME/bin/}javac"
JAVA="${JAVA_HOME:+$JAVA_HOME/bin/}java"
command -v "$JAVAC" > /dev/null || { echo "::error::Sin javac para comprobar la firma con Ed25519.java"; exit 1; }
"$JAVAC" -nowarn -d "$TMP/clases" "$RAIZ/android/app/src/main/java/es/fantasymanager/app/Ed25519.java" "$RAIZ/android/prueba/PruebaFirma.java"
"$JAVA" -cp "$TMP/clases" es.fantasymanager.app.PruebaFirma "$PUB" "$PAQ" "$TMP/firma.b64" \
  || { echo "::error::Ed25519.java no da por buena la firma: no se publica"; exit 1; }

cp "$TMP/firma.b64" "$PAQ.sig"
chmod 644 "$PAQ.sig"
echo "paquete.json firmado: $(wc -c < "$PAQ") bytes, clave $PUB"
