#!/usr/bin/env python3
"""Las páginas públicas de la web: HTML de verdad, legible sin JavaScript (AdSense y Google las leen así).

Lee .github/paginas.json y, para cada página, rehace su cabecera, menú, pie, metas y datos estructurados alrededor
del texto, que se queda donde está: dentro del propio archivo de web/, entre <!-- contenido --> y <!-- /contenido -->.
Si el archivo no existe y es un borrador, lo crea con su esquema. Escribe también web/guias/index.html (la lista de
guías publicadas), web/sitemap.xml y web/robots.txt.

Se ejecuta a mano y se sube lo que genera: python3 .github/paginas.py
Las rutas son relativas (../ en guias/): privacidad.html se abre también dentro de la app, servida desde el APK.
"""
import html
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(RAIZ, 'web')
DOMINIO = 'https://fantasymanagerapp.com/'
APK = 'https://fantasymanagerapp.com/descargas/fantasy-manager.apk'
CLIENTE_ADSENSE = 'ca-pub-3175956326240112'
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
INICIO, FIN = '<!-- contenido -->', '<!-- /contenido -->'

e = html.escape


def fecha_larga(f):
    a, m, d = f.split('-')
    return f'{int(d)} de {MESES[int(m) - 1]} de {a}'


def leer_contenido(ruta):
    """el texto de la página: lo de entre las marcas o, en una página de antes (sin marcas), lo de dentro de <main>"""
    if not os.path.exists(ruta):
        return None
    with open(ruta, encoding='utf-8') as f:
        t = f.read()
    m = re.search(re.escape(INICIO) + r'\n?(.*?)\n?\s*' + re.escape(FIN), t, re.S)
    if m:
        return m.group(1).strip('\n')
    m = re.search(r'<main[^>]*>(.*?)</main>', t, re.S)
    if m:
        return m.group(1).strip('\n')
    sys.exit(f'{ruta}: sin marcas de contenido ni <main>')


def esquema_html(p):
    """el contenido de un borrador: la búsqueda que busca y los apartados con lo que irá en cada uno"""
    filas = [f'  <h1>{e(p["h1"])}</h1>',
             '  <p class="borrador">Borrador: solo el esquema, sin el texto. No se indexa ni se enlaza hasta que esté escrita.</p>',
             f'  <p><b>Búsqueda a la que responde:</b> «{e(p["busqueda"])}»</p>']
    for titulo, nota in p['esquema']:
        filas.append(f'  <h2>{e(titulo)}</h2>\n  <p class="nota">{e(nota)}</p>')
    return '\n'.join(filas)


def publicada(p):
    return not p.get('borrador')


def menu(raiz, hay_guias):
    guias = f'<a href="{raiz}guias/">Guías</a>' if hay_guias else ''
    return (f'<header class="cab"><div class="cab-in">'
            f'<a class="marca" href="{raiz or "./"}"><img src="{raiz}img/logo.svg" alt="" width="30" height="30">Fantasy <b>Manager</b></a>'
            f'<nav class="menu" aria-label="Menú">{guias}<a href="{raiz}quienes-somos.html">Quiénes somos</a>'
            f'<a href="{raiz}contacto.html">Contacto</a><a class="menu-cta" href="{APK}">Bajar la app</a></nav>'
            f'</div></header>')


def cta(raiz):
    return (f'<aside class="cta" aria-label="La app">'
            f'<p class="cta-t">Fantasy Manager hace estas cuentas por ti con los datos de tu liga</p>'
            f'<p>Cada día te dice a quién vender, a quién comprar, cuánto pujar y a quién clausular. Gratis y sin registrarte: entras con tu cuenta de LaLiga.</p>'
            f'<div class="cta-b"><a class="btn" href="{APK}">Bajar la app para Android</a>'
            f'<a class="btn sec" href="{raiz or "./"}">Abrirla en el navegador</a></div>'
            f'<p class="peq">En el navegador puedes verla antes con una liga de ejemplo. <a href="{raiz}instalar.html">Cómo instalarla</a></p>'
            f'</aside>')


def pie(raiz, hay_guias):
    guias = f'<a href="{raiz}guias/">Guías</a>' if hay_guias else ''
    return (f'<footer class="pie"><div class="pie-in">'
            f'<nav aria-label="Pie"><a href="{raiz or "./"}">Abrir la app</a>{guias}<a href="{raiz}quienes-somos.html">Quiénes somos</a>'
            f'<a href="{raiz}contacto.html">Contacto</a><a href="{raiz}privacidad.html">Privacidad</a><a href="{raiz}instalar.html">Instalar</a></nav>'
            f'<p>Fantasy Manager es una app no oficial: no es de LaLiga ni tiene relación con LaLiga, LaLiga Fantasy ni sus patrocinadores.</p>'
            f'<p>© 2026 Fantasy Manager · <a href="mailto:contacto@fantasymanagerapp.com">contacto@fantasymanagerapp.com</a></p>'
            f'</div></footer>')


def migas(raiz, p, hay_guias):
    if p['tipo'] != 'guia' or p['ruta'] == 'guias/index.html':
        return ''
    guias = f' › <a href="{raiz}guias/">Guías</a>' if hay_guias else ''
    return f'<nav class="migas" aria-label="Estás en"><a href="{raiz or "./"}">Inicio</a>{guias}</nav>'


def datos_estructurados(p, url):
    if not publicada(p) or p['tipo'] != 'guia' or p['ruta'] == 'guias/index.html':
        return ''
    d = {'@context': 'https://schema.org', '@type': 'Article', 'headline': p.get('h1') or p['titulo'],
         'description': p['descripcion'], 'inLanguage': 'es-ES', 'mainEntityOfPage': url,
         'datePublished': p.get('publicada', p['fecha']), 'dateModified': p['fecha'],
         'author': {'@type': 'Organization', 'name': 'Fantasy Manager', 'url': DOMINIO},
         'publisher': {'@type': 'Organization', 'name': 'Fantasy Manager', 'url': DOMINIO}}
    return f'\n  <script type="application/ld+json">{json.dumps(d, ensure_ascii=False)}</script>'


def pagina(p, contenido, hay_guias):
    raiz = '../' * p['ruta'].count('/')
    url = DOMINIO + (p['ruta'][:-len('index.html')] if p['ruta'].endswith('index.html') else p['ruta'])
    robots = '' if publicada(p) else '\n  <meta name="robots" content="noindex, follow">'
    fecha = ''
    if p['tipo'] == 'guia' and p['ruta'] != 'guias/index.html' and publicada(p):
        fecha = f'\n  <p class="fecha">Actualizada el {fecha_larga(p["fecha"])}</p>'
    pie_guia = f'\n  {cta(raiz)}' if p['tipo'] == 'guia' else ''
    m = migas(raiz, p, hay_guias)
    migas_linea = f'\n  {m}' if m else ''
    return f'''<!doctype html>
<!-- Generada por .github/paginas.py: el texto se edita entre las marcas de contenido; lo demás se rehace al ejecutarlo -->
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#08080a">
  <title>{e(p['titulo'])}</title>
  <meta name="description" content="{e(p['descripcion'])}">{robots}
  <link rel="canonical" href="{url}">
  <meta name="google-adsense-account" content="{CLIENTE_ADSENSE}">
  <meta property="og:type" content="{'article' if p['tipo'] == 'guia' else 'website'}">
  <meta property="og:site_name" content="Fantasy Manager">
  <meta property="og:locale" content="es_ES">
  <meta property="og:title" content="{e(p.get('h1') or p['titulo'])}">
  <meta property="og:description" content="{e(p['descripcion'])}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{DOMINIO}img/compartir.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="{raiz}img/logo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="{raiz}img/icono-180.png">
  <link rel="stylesheet" href="{raiz}css/paginas.css">{datos_estructurados(p, url)}
</head>
<body>
{menu(raiz, hay_guias)}
<main>{migas_linea}
{INICIO}
{contenido}
{FIN}{fecha}{pie_guia}
</main>
{pie(raiz, hay_guias)}
</body>
</html>
'''


def indice_guias(guias):
    filas = ['  <h1>Guías de <span>LaLiga Fantasy</span></h1>',
             '  <p>Cómo funcionan las cláusulas, el mercado, los puntos y el dinero en LaLiga Fantasy, explicado con números.</p>']
    if guias:
        filas.append('  <ul class="lista-guias">')
        for g in guias:
            nombre = g['ruta'].split('/', 1)[1]
            filas.append(f'    <li><a href="{nombre}"><b>{e(g["h1"])}</b><span>{e(g["descripcion"])}</span></a></li>')
        filas.append('  </ul>')
    else:
        filas.append('  <p class="borrador">Todavía no hay ninguna guía publicada.</p>')
    return '\n'.join(filas)


def main():
    with open(os.path.join(RAIZ, '.github', 'paginas.json'), encoding='utf-8') as f:
        paginas = json.load(f)['paginas']
    guias = [p for p in paginas if p['tipo'] == 'guia' and publicada(p)]
    hay_guias = bool(guias)
    hoy = max((p['fecha'] for p in guias), default='2026-11-02')
    indice = {'ruta': 'guias/index.html', 'tipo': 'guia', 'h1': 'Guías de LaLiga Fantasy',
              'titulo': 'Guías de LaLiga Fantasy: cláusulas, mercado y puntos · Fantasy Manager',
              'descripcion': 'Guías para LaLiga Fantasy: cómo funcionan las cláusulas, cuándo vender, cuánto pujar y cómo se calculan los puntos.',
              'fecha': hoy}
    if not hay_guias:
        indice['borrador'] = True

    escritas = []
    for p in paginas + [indice]:
        ruta = os.path.join(WEB, p['ruta'])
        if p is indice:
            contenido = indice_guias(guias)
        else:
            contenido = leer_contenido(ruta)
            if contenido is None:
                if not p.get('esquema'):
                    sys.exit(f'{p["ruta"]}: no existe y no tiene esquema del que partir')
                contenido = esquema_html(p)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write(pagina(p, contenido, hay_guias))
        escritas.append(p)

    # el sitemap: la portada y solo lo publicado
    urls = [(DOMINIO, hoy)] + [(DOMINIO + (p['ruta'][:-len('index.html')] if p['ruta'].endswith('index.html') else p['ruta']), p['fecha'])
                               for p in escritas if publicada(p)]
    with open(os.path.join(WEB, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u, fe in urls:
            f.write(f'  <url><loc>{u}</loc><lastmod>{fe}</lastmod></url>\n')
        f.write('</urlset>\n')
    with open(os.path.join(WEB, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write(f'User-agent: *\nAllow: /\n\nSitemap: {DOMINIO}sitemap.xml\n')
    borradores = sum(1 for p in escritas if not publicada(p))
    print(f'{len(escritas)} páginas ({borradores} borradores), {len(urls)} direcciones en el sitemap')


if __name__ == '__main__':
    main()
