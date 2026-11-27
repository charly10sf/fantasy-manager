# (rediseño «Liquid», maqueta) hojas de contacto: varias capturas en una sola imagen rotulada.
#   python3 .github/liquid/hoja.py salida.jpg <columnas> <ancho de cada una> "Título" captura.png:Rótulo …
# Una captura de Pregunta (más baja, sin el teclado) se completa con el teclado dibujado.
import sys
from PIL import Image, ImageDraw, ImageFont

sal, cols, ancho, titulo, *items = sys.argv[1:]
cols, ancho = int(cols), int(ancho)
F = '/home/claude/fantasy-manager/web/fonts/'
def letra(t, peso='600'):
    for f in (F + 'barlow-%s.ttf' % peso, '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        try: return ImageFont.truetype(f, t)
        except Exception: pass
    return ImageFont.load_default()
ft, fr = letra(34), letra(22)
M, R, T = 18, 40, 70 if titulo else 0
ims = []
for it in items:
    ruta, _, rot = it.partition(':')
    im = Image.open(ruta).convert('RGB')
    w, h = im.size
    alto_ref = round(w * 844 / 390)
    if h < alto_ref - 4:  # Pregunta: el hueco del teclado
        lienzo = Image.new('RGB', (w, alto_ref), (30, 30, 34))
        lienzo.paste(im, (0, 0))
        d = ImageDraw.Draw(lienzo)
        k = w / 390
        filas = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm', ' ']
        y = h + 10 * k
        for i, f in enumerate(filas):
            n = len(f); tw = (w - 8 * k) / 10; x0 = (w - n * tw) / 2 if i < 3 else w * 0.22
            for j, c in enumerate(f):
                ww = tw if i < 3 else w * 0.56
                d.rounded_rectangle([x0 + j * tw + 3 * k, y, x0 + j * tw + ww - 3 * k, y + 44 * k], radius=6 * k, fill=(74, 74, 80))
                if c.strip(): d.text((x0 + j * tw + ww / 2, y + 22 * k), c, font=letra(int(20 * k), '500'), fill=(240, 240, 240), anchor='mm')
            y += 56 * k
        im = lienzo
    im = im.resize((ancho, round(im.size[1] * ancho / im.size[0])), Image.LANCZOS)
    ims.append((im, rot))
filas = (len(ims) + cols - 1) // cols
alto = max(i.size[1] for i, _ in ims)
W = M + cols * (ancho + M)
Ht = T + M + filas * (alto + R + M)
hoja = Image.new('RGB', (W, Ht), (12, 12, 14))
d = ImageDraw.Draw(hoja)
if titulo: d.text((M, 18), titulo, font=ft, fill=(244, 242, 243))
for n, (im, rot) in enumerate(ims):
    x = M + (n % cols) * (ancho + M); y = T + M + (n // cols) * (alto + R + M)
    d.text((x + 2, y + 4), rot, font=fr, fill=(255, 197, 71))
    hoja.paste(im, (x, y + R))
    d.rectangle([x - 1, y + R - 1, x + ancho, y + R + im.size[1]], outline=(48, 48, 56))
hoja.save(sal, quality=88)
print(sal, hoja.size)
