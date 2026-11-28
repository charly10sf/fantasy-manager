# hoja de contacto: python3 hoja.py salida.jpg ancho_celda archivo1 archivo2 ... [--cols N]
import sys
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
cols = None
if '--cols' in args: i = args.index('--cols'); cols = int(args[i+1]); del args[i:i+2]
out, w = args[0], int(args[1]); fs = args[2:]
ims = []
for f in fs:
    try: im = Image.open(f).convert('RGB')
    except Exception as e: continue
    h = round(im.height * w / im.width); ims.append((f, im.resize((w, h), Image.LANCZOS)))
cols = cols or len(ims)
rows = (len(ims) + cols - 1) // cols
ch = max(i.height for _, i in ims) + 22
hoja = Image.new('RGB', (cols * (w + 8) + 8, rows * (ch + 8) + 8), (40, 40, 46))
d = ImageDraw.Draw(hoja)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
except Exception: font = ImageFont.load_default()
for n, (f, im) in enumerate(ims):
    x = 8 + (n % cols) * (w + 8); y = 8 + (n // cols) * (ch + 8)
    d.text((x + 2, y + 2), f.split('/')[-2] + '/' + f.split('/')[-1].replace('.png', ''), fill=(255, 255, 255), font=font)
    hoja.paste(im, (x, y + 22))
hoja.save(out, quality=82)
print(out, hoja.size)
