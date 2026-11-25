#!/usr/bin/env python3
"""Deja en ios/Recursos/web la web que va dentro de la app de iOS.

Antes hay que ejecutar .github/paquete.py, que escribe web/paquete.json (las huellas) y pone en index.html cada módulo
con su huella. Aquí se copian a ios/Recursos/web los archivos que lista ese paquete.json (los mismos que baja AlDia: la
app, sin las páginas públicas) y el propio paquete.json, comprobando la huella de cada uno. El proyecto de Xcode
(project.yml) mete esa carpeta tal cual en la app.

Imprime FM_VERSION (la versión de la web, con su letra) y FM_MARKETING (solo los números, que es lo que admite Apple
como versión) para añadirlos a $GITHUB_ENV.
"""
import hashlib
import json
import os
import re
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(os.path.dirname(AQUI), 'web')
DESTINO = os.path.join(AQUI, 'Recursos', 'web')


def main():
    ruta = os.path.join(WEB, 'paquete.json')
    if not os.path.isfile(ruta):
        sys.exit('Falta web/paquete.json: ejecuta antes python3 .github/paquete.py')
    with open(ruta, encoding='utf-8') as f:
        paquete = json.load(f)
    shutil.rmtree(DESTINO, ignore_errors=True)
    total = 0
    for rel, huella in sorted(paquete['archivos'].items()):
        if not re.fullmatch(r'[A-Za-z0-9._/-]+', rel) or '..' in rel.split('/'):
            sys.exit(f'Ruta rara en paquete.json: {rel}')
        origen, destino = os.path.join(WEB, rel), os.path.join(DESTINO, rel)
        with open(origen, 'rb') as f:
            datos = f.read()
        if hashlib.sha256(datos).hexdigest() != huella:
            sys.exit(f'{rel} no es el de paquete.json: vuelve a ejecutar .github/paquete.py')
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, 'wb') as f:
            f.write(datos)
        total += len(datos)
    shutil.copyfile(ruta, os.path.join(DESTINO, 'paquete.json'))
    version = paquete['version']
    numeros = re.match(r'\d+(\.\d+){0,2}', version)
    print(f'FM_VERSION={version}')
    print(f'FM_MARKETING={numeros.group(0) if numeros else "0.0.0"}')
    print(f'web {version}: {len(paquete["archivos"])} archivos, {total / 1e6:.1f} MB, en ios/Recursos/web', file=sys.stderr)


if __name__ == '__main__':
    main()
