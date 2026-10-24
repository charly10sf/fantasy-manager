#!/usr/bin/env python3
"""Las huellas para que la app se ponga al día sin reinstalar (android/.../AlDia.java).

Escribe web/paquete.json con la versión de la web, la huella de cada archivo de web/ (sha-256), la huella de
todo junto y la huella de la parte Android (android/app/src). Lo usan las dos Actions sobre el mismo commit, así
que salen idénticas: la de la app lo mete en el APK (lo que trae dentro) y la de la web lo publica en GitHub
Pages (lo último). La app compara las dos y baja solo lo que ha cambiado, y solo si la parte Android es la misma.

Imprime NATIVO=<huella> para añadirlo a $GITHUB_ENV (la compilación la mete en BuildConfig.NATIVO).
Con --parar, el paquete.json publicado le dice a todas las apps que vuelvan a la web de su APK.
"""
import hashlib
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(RAIZ, 'web')
NATIVA = os.path.join(RAIZ, 'android', 'app', 'src')


def sha(ruta):
    h = hashlib.sha256()
    with open(ruta, 'rb') as f:
        for trozo in iter(lambda: f.read(65536), b''):
            h.update(trozo)
    return h.hexdigest()


def arbol(base):
    for carpeta, dirs, archivos in os.walk(base):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.'))
        for a in sorted(archivos):
            if a.startswith('.'):
                continue
            yield os.path.relpath(os.path.join(carpeta, a), base).replace(os.sep, '/')


def junta(pares):
    return hashlib.sha256(''.join(f'{k} {v}\n' for k, v in sorted(pares)).encode()).hexdigest()[:16]


def versionar_index():
    """
    En index.html, cada módulo con su huella en la dirección (js/x.js?v=…), con un mapa de importaciones: así el
    navegador y las cachés de GitHub y Cloudflare no pueden mezclar archivos de una versión con los de otra (un
    index.html viejo pide los suyos y uno nuevo, los nuevos). Se puede ejecutar más de una vez: quita lo de la vez
    anterior antes de ponerlo.
    """
    ruta = os.path.join(WEB, 'index.html')
    with open(ruta, encoding='utf-8') as f:
        html = f.read()
    html = re.sub(r'\s*<script type="importmap">.*?</script>', '', html, flags=re.S)
    html = re.sub(r'((?:src|href)="(?:js|css)/[A-Za-z0-9._/-]+)\?v=[0-9a-f]+"', r'\1"', html)
    corta = lambda rel: sha(os.path.join(WEB, rel))[:12]
    mods = {rel: corta(rel) for rel in arbol(WEB) if rel.startswith('js/') and rel.endswith('.js')}
    mapa = {'imports': {f'./{rel}': f'./{rel}?v={h}' for rel, h in sorted(mods.items())}}
    entrada = '<script type="module" src="js/app.js"></script>'
    if entrada not in html:
        sys.exit('index.html: no encuentro la entrada de js/app.js')
    html = html.replace(entrada, f'<script type="importmap">{json.dumps(mapa, separators=(",", ":"))}</script>\n  '
                        f'<script type="module" src="js/app.js?v={mods["js/app.js"]}"></script>', 1)
    for rel in arbol(WEB):
        if rel.startswith('css/') and rel.endswith('.css'):
            html = html.replace(f'href="{rel}"', f'href="{rel}?v={corta(rel)}"')
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(html)


def main():
    versionar_index()
    archivos = {rel: sha(os.path.join(WEB, rel)) for rel in arbol(WEB) if rel != 'paquete.json'}
    raras = [r for r in archivos if not re.fullmatch(r'[A-Za-z0-9._/-]+', r)]
    if raras:
        sys.exit(f'Archivos con nombres que la app no bajaría: {raras}')
    nativo = junta((rel, sha(os.path.join(NATIVA, rel))) for rel in arbol(NATIVA))
    with open(os.path.join(WEB, 'js', 'version.js'), encoding='utf-8') as f:
        version = re.search(r"VERSION = '([^']+)'", f.read()).group(1)
    paquete = {'version': version, 'nativo': nativo, 'huella': junta(archivos.items()), 'archivos': archivos}
    if '--parar' in sys.argv:
        paquete['parar'] = True
    with open(os.path.join(WEB, 'paquete.json'), 'w', encoding='utf-8') as f:
        json.dump(paquete, f, separators=(',', ':'), sort_keys=True)
    print(f'NATIVO={nativo}')
    print(f'web {version}: {len(archivos)} archivos, huella {paquete["huella"]}', file=sys.stderr)


if __name__ == '__main__':
    main()
