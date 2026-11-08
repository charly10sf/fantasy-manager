#!/bin/sh
# Las pruebas del Worker y del bot que no necesitan red (revisión total, A13): worker/prueba/datos.mjs y las
# bot/prueba/*-ejemplo.mjs (menos tarjetas-ejemplo, que pide datos reales a LaLiga y rehace los PNG de bot/tarjetas).
# Se corre con la red cortada (en Actions, «sudo unshare --net» con lo levantado: pruebas.yml) para que ninguna llegue
# a LaLiga, ESPN, Anthropic ni X. Antes: npm ci --prefix bot. Sale con 1 si alguna falla o si la red no está cortada.
set -u
if node -e "fetch('https://www.google.com', { signal: AbortSignal.timeout(4000) }).then(() => process.exit(0), () => process.exit(1))"; then
  echo "MAL  la red no está cortada: estas pruebas tienen que ir sin red"; exit 1
fi
fallos=0
correr() {
  log="${TMPDIR:-/tmp}/prueba-$(basename "$1").log"
  if timeout 180 node "$1" > "$log" 2>&1; then echo "BIEN $1"; else echo "MAL  $1"; tail -n 25 "$log" | sed 's/^/     /'; fallos=$((fallos + 1)); fi
}
correr worker/prueba/datos.mjs
for f in bot/prueba/*-ejemplo.mjs; do
  case "$f" in */tarjetas-ejemplo.mjs) continue ;; esac
  correr "$f"
done
# lo que dejan las pruebas que dibujan tarjetas
rm -rf tarjetas
if [ "$fallos" -gt 0 ]; then echo "$fallos MAL"; exit 1; fi
echo "Todo BIEN"
