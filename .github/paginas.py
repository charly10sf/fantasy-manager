#!/usr/bin/env python3
"""Las páginas públicas de la web: HTML de verdad, legible sin JavaScript (AdSense y Google las leen así).

Lee .github/paginas.json y, para cada página, rehace su cabecera, menú, pie, metas y datos estructurados alrededor
del texto, que se queda donde está: dentro del propio archivo de web/, entre <!-- contenido --> y <!-- /contenido -->.
Si el archivo no existe y es un borrador, lo crea con su esquema. Escribe también web/guias/index.html (la lista de
guías publicadas, por grupos), web/sitemap.xml y web/robots.txt, y pone la lista de guías en dos sitios de la portada
para que no se queden atrás: los enlaces del bloque .sin-js de web/index.html (entre <!-- guias --> y <!-- /guias -->)
y TODAS_GUIAS en web/js/portada.js (entre // <guias> y // </guias>), de donde sale «Ver las N guías».

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
PLAY = 'https://play.google.com/store/apps/details?id=es.fantasymanager.app'  # desde la 0.7.1h, con la app en la tienda
CLIENTE_ADSENSE = 'ca-pub-3175956326240112'
IMAGEN = DOMINIO + 'img/compartir.jpg'  # la de compartir (1200 × 630)
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
            f'<a href="{raiz}contacto.html">Contacto</a><a class="menu-web" href="{raiz or "./"}">Usar en la web</a><a class="menu-cta" href="{PLAY}" target="_blank" rel="noopener">Descargar en Google Play</a></nav>'
            f'</div></header>')


def cta(raiz):
    return (f'<aside class="cta" aria-label="La app">'
            f'<p class="cta-t">Fantasy Manager hace estas cuentas por ti con los datos de tu liga</p>'
            f'<p>Cada día te dice a quién vender, a quién comprar, cuánto pujar y a quién clausular. Gratis y sin registrarte: entras con tu cuenta de LaLiga.</p>'
            f'<div class="cta-b"><a class="btn" href="{PLAY}" target="_blank" rel="noopener">Descargar en Google Play</a>'
            f'<a class="btn sec" href="{raiz or "./"}">Abrirla en el navegador</a></div>'
            f'<a class="play-badge" href="{PLAY}" target="_blank" rel="noopener"><img src="{raiz}img/google-play.png" alt="Disponible en Google Play" width="646" height="250"></a>'
            f'<p class="peq">En el ordenador se usa desde la web, sin descargar nada. En el iPhone también, después de entrar una vez desde un ordenador. Y puedes verla antes con una liga de ejemplo. <a href="{raiz}instalar.html">Cómo instalarla</a></p>'
            f'</aside>')


def pie(raiz, hay_guias):
    guias = f'<a href="{raiz}guias/">Guías</a>' if hay_guias else ''
    return (f'<footer class="pie"><div class="pie-in">'
            f'<nav aria-label="Pie"><a href="{raiz or "./"}">Abrir la app</a>{guias}<a href="{raiz}quienes-somos.html">Quiénes somos</a>'
            f'<a href="{raiz}contacto.html">Contacto</a><a href="{raiz}privacidad.html">Privacidad</a><a href="{raiz}condiciones.html">Condiciones</a>'
            f'<a href="{raiz}aviso-legal.html">Aviso legal</a><a href="{raiz}instalar.html">Instalar</a></nav>'
            f'<p>Fantasy Manager es una app no oficial: no es de LaLiga ni tiene relación con LaLiga, LaLiga Fantasy ni sus patrocinadores.</p>'
            f'<p>© 2026 Fantasy Manager · <a href="mailto:fantasymanager.web.app@gmail.com">fantasymanager.web.app@gmail.com</a></p>'
            f'</div></footer>')


def en_guias(p):
    """una guía o una página de guias/ (las preguntas frecuentes), sin contar el índice"""
    return p['ruta'].startswith('guias/') and p['ruta'] != 'guias/index.html'


def migas(raiz, p, hay_guias):
    if not en_guias(p):
        return ''
    guias = f' › <a href="{raiz}guias/">Guías</a>' if hay_guias else ''
    return f'<nav class="migas" aria-label="Estás en"><a href="{raiz or "./"}">Inicio</a>{guias}</nav>'


def datos_estructurados(p, url):
    """en las guías: el artículo (con la imagen de compartir) y las migas Inicio › Guías › guía"""
    if not publicada(p) or p['tipo'] != 'guia' or p['ruta'] == 'guias/index.html':
        return ''
    titulo = p.get('h1') or p['titulo']
    articulo = {'@type': 'Article', 'headline': titulo,
                'description': p['descripcion'], 'inLanguage': 'es-ES', 'mainEntityOfPage': url,
                'image': {'@type': 'ImageObject', 'url': IMAGEN, 'width': 1200, 'height': 630},
                'datePublished': p.get('publicada', p['fecha']), 'dateModified': p['fecha'],
                'author': {'@type': 'Organization', 'name': 'Fantasy Manager', 'url': DOMINIO},
                'publisher': {'@type': 'Organization', 'name': 'Fantasy Manager', 'url': DOMINIO,
                              'logo': {'@type': 'ImageObject', 'url': DOMINIO + 'img/icono-180.png'}}}
    migas_ld = {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': DOMINIO},
        {'@type': 'ListItem', 'position': 2, 'name': 'Guías', 'item': DOMINIO + 'guias/'},
        {'@type': 'ListItem', 'position': 3, 'name': titulo, 'item': url}]}
    d = {'@context': 'https://schema.org', '@graph': [articulo, migas_ld]}
    return f'\n  <script type="application/ld+json">{json.dumps(d, ensure_ascii=False)}</script>'


GUIAS_PUB = []  # las guías publicadas, en orden (la rellena main)


def mas_guias(p):
    """al final de cada guía publicada, tres para seguir leyendo: las de su «relacionadas» (rutas en paginas.json) o,
    si no tiene, las tres siguientes (dando la vuelta)"""
    if p['tipo'] != 'guia' or p['ruta'] == 'guias/index.html' or not publicada(p) or len(GUIAS_PUB) < 2:
        return ''
    por_ruta = {g['ruta']: g for g in GUIAS_PUB}
    sig = [por_ruta[r] for r in p.get('relacionadas', []) if r in por_ruta and r != p['ruta']][:3]
    if not sig:
        i = next((k for k, g in enumerate(GUIAS_PUB) if g['ruta'] == p['ruta']), -1)
        sig = [GUIAS_PUB[(i + k) % len(GUIAS_PUB)] for k in range(1, min(4, len(GUIAS_PUB)))]
    filas = ''.join(f'<li><a href="{g["ruta"].split("/", 1)[1]}"><b>{e(g["h1"])}</b><span>{e(g["descripcion"])}</span></a></li>' for g in sig)
    return f'\n  <nav class="mas-guias" aria-label="Más guías"><h2>Sigue leyendo</h2><ul class="lista-guias">{filas}</ul><p><a href="./">Todas las guías</a></p></nav>'


def pagina(p, contenido, hay_guias):
    raiz = '../' * p['ruta'].count('/')
    url = DOMINIO + (p['ruta'][:-len('index.html')] if p['ruta'].endswith('index.html') else p['ruta'])
    robots = '' if publicada(p) else '\n  <meta name="robots" content="noindex, follow">'
    fecha = ''
    if p['tipo'] == 'guia' and p['ruta'] != 'guias/index.html' and publicada(p):
        fecha = f'\n  <p class="fecha">Actualizada el {fecha_larga(p["fecha"])}</p>'
    pie_guia = f'\n  {cta(raiz)}' if p['tipo'] == 'guia' or en_guias(p) else ''
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
  <meta property="og:image" content="{IMAGEN}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
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
{FIN}{fecha}{mas_guias(p)}{pie_guia}
</main>
{pie(raiz, hay_guias)}
</body>
</html>
'''


# los grupos del índice de guías, en orden: [clave de «grupo» en paginas.json, título, una línea de qué hay]
GRUPOS = [
    ('empezar', 'Para empezar', 'Las reglas básicas: cómo se puntúa, qué significa cada palabra del juego y qué hacer los primeros días.'),
    ('clausulas', 'Cláusulas', 'Cómo funcionan, cuánto subir las de tus jugadores y cuándo pagar la de un rival.'),
    ('mercado', 'Mercado y dinero', 'Cuándo cambia el mercado, cuánto pujar, cuándo vender y cómo no quedarte en negativo.'),
    ('once', 'Tu once', 'Quién juega, cómo puntúa cada puesto y qué hacer con lesionados y sancionados.'),
]


def fila_guia(g, sangria='    '):
    nombre = g['ruta'].split('/', 1)[1]
    return f'{sangria}<li><a href="{nombre}"><b>{e(g["h1"])}</b><span>{e(g["descripcion"])}</span></a></li>'


def indice_guias(guias, faq=None):
    filas = ['  <h1>Guías de <span>LaLiga Fantasy</span></h1>',
             '  <p>Las guías de Fantasy Manager: cómo funcionan las cláusulas, el mercado, la alineación y el dinero en LaLiga Fantasy, explicado con números. Al final de cada una, lo que hace la app por ti en ese tema.</p>']
    if not guias:
        filas.append('  <p class="borrador">Todavía no hay ninguna guía publicada.</p>')
        return '\n'.join(filas)
    claves = [c for c, _, _ in GRUPOS]
    sueltas = [g for g in guias if g.get('grupo') not in claves]
    for clave, titulo, linea in GRUPOS + ([('', 'Más guías', '')] if sueltas else []):
        del_grupo = [g for g in guias if g.get('grupo') == clave] if clave else sueltas
        if not del_grupo:
            continue
        filas.append(f'\n  <h2>{e(titulo)}</h2>')
        if linea:
            filas.append(f'  <p>{e(linea)}</p>')
        filas.append('  <ul class="lista-guias">')
        filas += [fila_guia(g) for g in del_grupo]
        filas.append('  </ul>')
    if faq:
        filas.append(f'\n  <h2>Sobre la app</h2>\n  <p>Si es oficial, cuánto cuesta, cómo se entra y qué hace con tus datos: <a href="{faq["ruta"].split("/", 1)[1]}">preguntas frecuentes de Fantasy Manager</a>.</p>')
    return '\n'.join(filas)


def poner_entre(ruta, inicio, fin, nuevo):
    """cambia lo que haya entre dos marcas de un archivo que no genera este script (la portada)"""
    with open(ruta, encoding='utf-8') as f:
        t = f.read()
    m = re.search(re.escape(inicio) + r'.*?' + re.escape(fin), t, re.S)
    if not m:
        sys.exit(f'{ruta}: faltan las marcas {inicio} … {fin}')
    t2 = t[:m.start()] + inicio + nuevo + fin + t[m.end():]
    if t2 != t:
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write(t2)


def portada(guias, faq):
    """la lista de guías de la portada: los enlaces para rastreadores de index.html y TODAS_GUIAS de portada.js"""
    def corto(g):
        return g.get('corto') or g['h1']
    enlaces = ''.join(f'\n        <li><a href="{g["ruta"]}">{e(g["h1"])}</a></li>' for g in guias)
    if faq:
        enlaces += f'\n        <li><a href="{faq["ruta"]}">{e(faq["titulo"])}</a></li>'
    poner_entre(os.path.join(WEB, 'index.html'), '<!-- guias -->', '<!-- /guias -->',
                f'\n      <ul>{enlaces}\n      </ul>\n      ')
    lista = ',\n'.join(f'  [{json.dumps(g["ruta"].split("/", 1)[1])}, {json.dumps(corto(g), ensure_ascii=False)}]' for g in guias)
    faq_js = f'\nconst FAQ_GUIA = {json.dumps(faq["ruta"].split("/", 1)[1]) if faq else "null"};\n'
    poner_entre(os.path.join(WEB, 'js', 'portada.js'), '// <guias>', '// </guias>',
                f'\n/** las guías publicadas, en orden: [archivo en guias/, nombre corto] (las escribe .github/paginas.py) */\nconst TODAS_GUIAS = [\n{lista},\n];{faq_js}')


def main():
    with open(os.path.join(RAIZ, '.github', 'paginas.json'), encoding='utf-8') as f:
        paginas = json.load(f)['paginas']
    guias = [p for p in paginas if p['tipo'] == 'guia' and publicada(p)]
    GUIAS_PUB[:] = guias
    faq = next((p for p in paginas if p['ruta'] == 'guias/preguntas-frecuentes.html' and publicada(p)), None)
    hay_guias = bool(guias)
    hoy = max((p['fecha'] for p in guias), default='2026-11-02')
    indice = {'ruta': 'guias/index.html', 'tipo': 'guia', 'h1': 'Guías de LaLiga Fantasy',
              'titulo': 'Guías de LaLiga Fantasy: cláusulas, mercado y pujas',
              'descripcion': 'Guías para LaLiga Fantasy: cómo funcionan las cláusulas, cuándo vender, cuánto pujar y cómo hacer el once.',
              'fecha': hoy}
    if not hay_guias:
        indice['borrador'] = True

    escritas = []
    for p in paginas + [indice]:
        ruta = os.path.join(WEB, p['ruta'])
        if p is indice:
            contenido = indice_guias(guias, faq)
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
    portada(guias, faq)
    largos = [p['ruta'] for p in escritas if len(p['titulo']) > 60]
    if largos:
        print('Títulos de más de 60 caracteres:', ', '.join(largos))
    with open(os.path.join(WEB, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write(f'User-agent: *\nAllow: /\n\nSitemap: {DOMINIO}sitemap.xml\n')
    borradores = sum(1 for p in escritas if not publicada(p))
    print(f'{len(escritas)} páginas ({borradores} borradores), {len(urls)} direcciones en el sitemap')


if __name__ == '__main__':
    main()
