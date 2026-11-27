import json, sys, re
from PIL import Image
car = sys.argv[1] if len(sys.argv) > 1 else 'contraste'
def lum(c):
    r = []
    for v in c[:3]:
        v /= 255; r.append(v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]
peor = {}
for s in json.load(open(f'{car}/cajas.json')):
    im = Image.open(s['f']).convert('RGB')
    for c in s['cajas']:
        m = re.findall(r'[\d.]+', c['c']); col = [float(x) for x in m[:3]]; a = float(m[3]) if len(m) > 3 else 1
        x0, y0, x1, y1 = max(0, int(c['x'])), max(0, int(c['y'])), min(im.width, int(c['x'] + c['w']) + 1), min(im.height, int(c['y'] + c['h']) + 1)
        if x1 <= x0 or y1 <= y0: continue
        px = list(im.crop((x0, y0, x1, y1)).getdata())
        # lo peor: el píxel de fondo que menos contrasta (el texto es claro: el fondo más claro), con un percentil para no contar un píxel suelto
        ls = sorted(lum(q) for q in px); lf = ls[int(len(ls) * 0.9)]
        fondo = sorted(px, key=lum)[int(len(px) * 0.9)]
        tx = [a * col[i] + (1 - a) * fondo[i] for i in range(3)]
        lt = lum(tx); r = (max(lt, lf) + 0.05) / (min(lt, lf) + 0.05)
        if c['tipo'] not in peor or r < peor[c['tipo']][0]: peor[c['tipo']] = (r, s['f'], c['t'], fondo)
for k, (r, f, t, fondo) in sorted(peor.items(), key=lambda x: x[1][0]):
    print(f"{k:16} {r:5.2f}:1  {f.split('/')[-1]:16} «{t}» fondo {fondo}")
