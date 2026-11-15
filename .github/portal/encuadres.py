"""Encuadre de las caras del portal de datos: dónde está la cabeza en cada foto de LaLiga, para recortarla en su círculo.

Es el mismo cálculo que hace la app en el navegador (web/js/caras.js, `calcular`), aquí hecho una vez por foto al generar
las páginas, porque el portal va sin JavaScript. Lee por la entrada una lista JSON de URL, baja las que no estén en
.github/portal/encuadres.json (solo de assets-fantasy.llt-services.com) y apunta para cada una { x, y, s } en fracciones de
la foto (esquina de arriba a la izquierda y lado del cuadrado) o 0 si no se puede. Sin Pillow o sin red no hace nada: el
portal sale con la foto entera centrada arriba.
"""
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'encuadres.json')
OK = re.compile(r'^https://assets-fantasy\.llt-services\.com/[\w./-]+\.png(\?v=\d+)?$')
N = 96


def calcular(datos):
    from PIL import Image
    im = Image.open(BytesIO(datos)).convert('RGBA')
    r = im.width / im.height if im.height else 1
    w, h = (N, round(N / r)) if r >= 1 else (round(N * r), N)
    lienzo = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    lienzo.paste(im.resize((max(1, w), max(1, h)), Image.BILINEAR), ((N - w) // 2, (N - h) // 2))
    a = lienzo.getchannel('A').load()
    opacos = 0
    filas = []
    for y in range(N):
        i = j = -1
        for x in range(N):
            if a[x, y] > 70:
                if i < 0:
                    i = x
                j = x
                opacos += 1
        filas.append(None if i < 0 else (i, j))
    if opacos > N * N * 0.96:  # foto con fondo: la cara suele estar arriba en el centro
        return {'x': 0.19, 'y': 0.02, 's': 0.62}
    y0 = next((k for k, f in enumerate(filas) if f and f[1] - f[0] >= 2), -1)
    if y0 < 0:
        return 0
    y1 = N - 1
    while y1 > y0 and not filas[y1]:
        y1 -= 1
    alto = y1 - y0 + 1
    banda = [f for f in filas[y0:y0 + max(4, round(alto * 0.22))] if f]
    centro = sum((p + q) / 2 for p, q in banda) / len(banda)
    anchos = sorted(q - p + 1 for p, q in banda)
    ancho = anchos[int(len(anchos) * 0.6)] if anchos else N * 0.3
    s = min(1, max(0.34, ancho * 2.15 / N))
    x = centro / N - s / 2
    y = y0 / N - s * 0.1
    x = max(-0.05, min(1.05 - s, x))
    y = max(-0.05, min(1 - s, y))
    return {'x': round(x, 3), 'y': round(y, 3), 's': round(s, 3)}


def uno(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return url, calcular(r.read())
    except Exception:
        return url, None  # se vuelve a intentar la próxima vez


def main():
    try:
        import PIL  # noqa: F401
    except ImportError:
        print('encuadres: sin Pillow, las caras salen sin encuadrar')
        return
    urls = sorted({u for u in json.load(sys.stdin) if u and OK.match(u)})
    cache = json.load(open(RUTA, encoding='utf-8')) if os.path.exists(RUTA) else {}
    # la clave es la foto sin el ?v= (cambia con cada versión de la foto, pero el recorte casi nunca)
    falta = [u for u in urls if u.split('?')[0] not in cache]
    if falta:
        with ThreadPoolExecutor(8) as ex:
            for u, e in ex.map(uno, falta):
                if e is not None:
                    cache[u.split('?')[0]] = e
        with open(RUTA, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(cache.items())), f, separators=(',', ':'))
            f.write('\n')
    print(f'encuadres: {len(urls)} caras, {len(falta)} nuevas')


if __name__ == '__main__':
    main()
