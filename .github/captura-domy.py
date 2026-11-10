"""La captura de la ficha de Domy (C.A.D Domyngas) para la tarjeta 8 de Play, a partir de las dos de Carlos (10 nov):
- arriba.jpg (cabecera, valor, movimientos, gastado, cláusulas, dinero) y juega.jpg («Cómo juega»), en una sola pantalla:
  lo de arriba hasta «estimado» y, debajo, «Cómo juega» hasta «Ficha / Se protege».
- Lo único que cambia es el dinero: «≈ 96,60 M» en vez del de verdad, con la letra y el estilo de la app (.dato .v).
- Fuera, a petición de Carlos, el aviso de «te dijo que tenía…» (queda fuera del recorte), la barra del móvil y la de
  navegación.
Uso: con el servidor de web/ en el 8765, `DOMY=<carpeta> python3 .github/captura-domy.py 391.6` → <carpeta>/domy-8.png (1189 × 2348); luego `CAPTURA_8=<carpeta>/domy-8.png python3 .github/capturas-play.py captura-8-dinero`."""
import asyncio, base64, io, os
from PIL import Image
from playwright.async_api import async_playwright

ESC = 1189 / 390
D = os.environ.get('DOMY', '.') + '/'  # la carpeta con arriba.jpg y juega.jpg (las capturas de Carlos; no van al repo)
ARRIBA = (105, 1398)      # de la barra del móvil fuera a justo debajo de «estimado / compras»
ALTO = round(1189 * 1540 / 780)  # lo que cabe en el móvil de la tarjeta
img = base64.b64encode(open(D + 'arriba.jpg', 'rb').read()).decode()

HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/app.css"><style>
html, body {{ margin:0; padding:0; background:#131217; width:390px; height:845px; overflow:hidden }}
.fondo {{ position:absolute; left:0; top:0; width:390px; }}
.tapa {{ position:absolute; background:rgb(19,18,23) }}
</style></head><body>
<img class="fondo" src="/__domy.jpg">
<div class="tapa" style="left:12px;top:{1200/ESC:.2f}px;width:186px;height:{(1372-1200)/ESC:.2f}px"></div>
<div class="dato" style="position:absolute;left:16.4px;top:TOPpx;width:176px;padding:0;margin:0;border:0;background:none;text-align:left"><div class="v">≈ 96,60 M<small>± 2,50 M · estimado</small></div></div>
</body></html>"""

async def main(top=396.0):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 390, 'height': 845}, device_scale_factor=ESC)
        await pg.route('http://localhost:8765/__domy.html', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=HTML.replace('TOP', str(top))))
        await pg.route('http://localhost:8765/__domy.jpg', lambda r: r.fulfill(status=200, content_type='image/jpeg', body=open(D + 'arriba.jpg', 'rb').read()))
        await pg.goto('http://localhost:8765/__domy.html')
        await pg.evaluate('document.fonts.ready'); await pg.wait_for_function('[...document.images].every((i) => i.complete && i.naturalWidth)'); await pg.wait_for_timeout(800)
        png = await pg.screenshot()
        await b.close()
    a = Image.open(io.BytesIO(png)).convert('RGB').resize((1189, 2576))
    j = Image.open(D + 'juega.jpg').convert('RGB')
    arriba = a.crop((0, ARRIBA[0], 1189, ARRIBA[1]))
    falta = ALTO - arriba.height
    juega = j.crop((0, 1428 - falta, 1189, 1428))  # «Cómo juega» hasta la fila de «Ficha / Se protege»
    out = Image.new('RGB', (1189, ALTO), (19, 18, 23))
    out.paste(arriba, (0, 0)); out.paste(juega, (0, arriba.height))
    out.save(D + 'domy-8.png')
    a.crop((0, 1130, 1189, 1420)).save(D + 'dinero-nuevo.png')  # para comparar con el original
    print('hecho', out.size, 'juega desde', 1428 - falta)

import sys
asyncio.run(main(float(sys.argv[1]) if len(sys.argv) > 1 else 396.0))
