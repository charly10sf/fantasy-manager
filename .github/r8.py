"""Comprueba lo que R8 no puede romper en lo compilado (lo usa la Action «App Android» después de compilar).

- El puente con la web: cada método con @JavascriptInterface de Puente.java tiene que seguir en el dex con su nombre
  y con la anotación (si no, la web llama a FantasyApp.<método> y no existe, o Android no la deja llamarlo).
- Las clases que Android abre por su nombre (las del manifiesto y el trabajo en segundo plano) siguen con su nombre.
- El AAB lleva el mapping dentro, para que Google Play traduzca los fallos él solo.

Uso: python3 .github/r8.py <dexdump> <apk>... [--aab <aab>]. Escribe el resultado por la salida y sale con 1 si algo falla.
"""
import os
import re
import subprocess
import sys
import tempfile
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUENTE = os.path.join(RAIZ, 'android/app/src/main/java/es/fantasymanager/app/Puente.java')
PAQ = 'Les/fantasymanager/app/'
# las que Android crea por su nombre: actividad, receptores y el Worker de WorkManager; en la de GitHub, también el
# servicio en primer plano (Trabajo: la de Play lo quita del manifiesto) y el proveedor de archivos
POR_NOMBRE = ['Principal', 'Avisos', 'Arranque', 'Fondo']
SOLO_GITHUB = ['Trabajo', 'Archivos']
MAPPING_AAB = 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map'


def metodos_js():
    """los nombres de los métodos con @JavascriptInterface en Puente.java"""
    nombres, marcado = [], False
    for linea in open(PUENTE, encoding='utf-8'):
        s = linea.strip()
        if s.startswith('@JavascriptInterface'):
            marcado = True
            continue
        if marcado and s and not s.startswith('@') and not s.startswith('//'):
            m = re.search(r'(\w+)\s*\(', s)
            if m:
                nombres.append(m.group(1))
            marcado = False
    return nombres


def leer_dex(dexdump, apk):
    """{clase: set(métodos)} y {clase: set(métodos con @JavascriptInterface)} de todos los classes*.dex del APK"""
    metodos, anotados = {}, {}
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(apk) as z:
        for n in z.namelist():
            if not re.fullmatch(r'classes\d*\.dex', n):
                continue
            ruta = z.extract(n, tmp)
            salida = subprocess.run([dexdump, '-a', ruta], capture_output=True, text=True, check=True).stdout
            num_clase = {}
            clase = ann = None
            for linea in salida.splitlines():
                m = re.match(r"Class #(\d+) annotations:", linea)
                if m:
                    ann, metodo = m.group(1), None
                    continue
                m = re.match(r"Class #(\d+)\s+-", linea)
                if m:
                    ann, clase = None, m.group(1)
                    continue
                m = re.match(r"\s+Class descriptor\s+: '(.+)'", linea)
                if m and clase is not None:
                    num_clase[clase] = m.group(1)
                    metodos.setdefault(m.group(1), set())
                    continue
                m = re.match(r"\s+name\s+: '(.+)'", linea)
                if m and clase in num_clase:
                    metodos[num_clase[clase]].add(m.group(1))
                    continue
                m = re.match(r"Annotations on method #\d+ '(.+)'", linea)
                if m and ann is not None:
                    metodo = m.group(1)
                    continue
                if ann is not None and 'Landroid/webkit/JavascriptInterface;' in linea and metodo:
                    anotados.setdefault(ann, set()).add(metodo)
            # las anotaciones van por número de clase: se pasan a su nombre al acabar cada dex
            for num, ms in list(anotados.items()):
                if num in num_clase:
                    anotados.setdefault(num_clase[num], set()).update(ms)
                    del anotados[num]
    return metodos, anotados


def main():
    args = sys.argv[1:]
    aab = None
    if '--aab' in args:
        i = args.index('--aab')
        aab = args[i + 1]
        del args[i:i + 2]
    dexdump, apks = args[0], args[1:]
    js = metodos_js()
    fallos = []
    print(f'Puente.java: {len(js)} métodos con @JavascriptInterface')
    if len(js) < 10:
        fallos.append(f'solo se han encontrado {len(js)} métodos en Puente.java: revisar r8.py')
    for apk in apks:
        nombre = os.path.basename(apk)
        metodos, anotados = leer_dex(dexdump, apk)
        puente = PAQ + 'Puente;'
        faltan = [m for m in js if m not in metodos.get(puente, set())]
        sin_anot = [m for m in js if m not in anotados.get(puente, set())]
        clases = POR_NOMBRE + (SOLO_GITHUB if 'github' in nombre else [])
        sin_clase = [c for c in clases if PAQ + c + ';' not in metodos]
        print(f'{nombre}: {os.path.getsize(apk):,} bytes · {len(metodos):,} clases · '
              f'puente {len(js) - len(faltan)}/{len(js)} con nombre, {len(js) - len(sin_anot)}/{len(js)} con la anotación · '
              f'clases por nombre {len(clases) - len(sin_clase)}/{len(clases)}')
        if faltan:
            fallos.append(f'{nombre}: al puente le faltan {", ".join(faltan)}')
        if sin_anot:
            fallos.append(f'{nombre}: sin @JavascriptInterface: {", ".join(sin_anot)}')
        if sin_clase:
            fallos.append(f'{nombre}: no están con su nombre: {", ".join(sin_clase)}')
    if aab:
        with zipfile.ZipFile(aab) as z:
            dentro = MAPPING_AAB in z.namelist()
        print(f'{os.path.basename(aab)}: mapping dentro {"sí" if dentro else "NO"}')
        if not dentro:
            fallos.append(f'el AAB no lleva {MAPPING_AAB}')
    for f in fallos:
        print('FALLO:', f)
    print('R8: todo bien' if not fallos else f'R8: {len(fallos)} fallos')
    sys.exit(1 if fallos else 0)


if __name__ == '__main__':
    main()
