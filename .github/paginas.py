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
import hashlib
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
# la versión de paginas.css (sus 8 primeras cifras de sha-256): al cambiar la hoja, las páginas la piden de nuevo
with open(os.path.join(WEB, 'css', 'paginas.css'), 'rb') as _f:
    VERSION_CSS = __import__('hashlib').sha256(_f.read()).hexdigest()[:8]
# el JS ligero del portal (buscador del menú y filtros de jugadores/): web/portal/portal.js, igual con su versión
try:
    with open(os.path.join(WEB, 'portal', 'portal.js'), 'rb') as _f:
        VERSION_JS = __import__('hashlib').sha256(_f.read()).hexdigest()[:8]
except OSError:
    VERSION_JS = None
# la tira de los 20 escudos del pie (la escribe bot/portal-web.mjs): [{n, r, u}]
try:
    with open(os.path.join(RAIZ, '.github', 'portal', 'escudos.json'), encoding='utf8') as _f:
        ESCUDOS = [x for x in json.load(_f) if x.get('r') and re.fullmatch(r'https://assets-fantasy\.llt-services\.com/[\w./-]+\.png(\?v=\d+)?', x.get('u') or '')]
except (OSError, ValueError):
    ESCUDOS = []

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
    """escrita y en su sitio: sale en el menú, el índice de guías, la portada y «Sigue leyendo»"""
    return not p.get('borrador') and not p.get('redirige')


def indexable(p):
    """publicada y para Google: va al sitemap y sin noindex. Con "indexar": false sigue enlazada para los usuarios,
    pero fuera del índice de Google (guías útiles que no aportan nada que no tenga otra web)"""
    return publicada(p) and p.get('indexar', True)


def redireccion(p):
    """una página fundida en otra ("redirige": ruta de destino): GitHub Pages no hace redirecciones de servidor, así
    que va una página mínima con refresh a 0 (Google lo trata como redirección permanente) y la canónica del destino"""
    destino = p['redirige']
    url = DOMINIO + (destino[:-len('index.html')] if destino.endswith('index.html') else destino)
    rel = os.path.relpath(destino, os.path.dirname(p['ruta']) or '.')
    return f'''<!doctype html>
<!-- Generada por .github/paginas.py: esta página se fundió en {destino} -->
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{e(p['titulo'])}</title>
  <link rel="canonical" href="{url}">
  <meta http-equiv="refresh" content="0; url={rel}">
</head>
<body>
  <p>Esta guía ahora está dentro de <a href="{rel}">{url}</a>.</p>
</body>
</html>
'''


# (rework de la web, 21 nov) el menú, corto: cinco secciones. Las calculadoras van dentro de «Guías» (en sus pastillas)
SECCIONES = [('mercado', 'mercado/', 'Mercado'), ('jornada', 'jornada/', 'Jornada'), ('equipos', 'equipos/', 'Equipos'),
             ('jugadores', 'jugadores/', 'Jugadores'), ('guias', 'guias/', 'Guías')]
# las tres letras de cada equipo en la tira de arriba (por la dirección de su ficha); si llega uno nuevo, las tres primeras del nombre
SIGLAS = {'alaves': 'ALA', 'athletic': 'ATH', 'atletico': 'ATM', 'barca': 'BAR', 'betis': 'BET', 'celta': 'CEL', 'deportivo': 'DEP',
          'elche': 'ELC', 'espanyol': 'ESP', 'getafe': 'GET', 'levante': 'LEV', 'malaga': 'MLG', 'osasuna': 'OSA', 'racing': 'RAC',
          'rayo': 'RAY', 'real-madrid': 'RMA', 'real-sociedad': 'RSO', 'sevilla': 'SEV', 'valencia': 'VAL', 'villarreal': 'VIL'}


def sigla(x):
    s = os.path.basename(x['r'])[:-len('.html')]
    return SIGLAS.get(s) or re.sub(r'[^A-Z]', '', s.upper())[:3]


def seccion_de(p):
    """la sección del menú que se marca: la del portal o, en guías, «Aprende» (las calculadoras, «Calculadoras»)"""
    if p.get('grupo') in ('jugador', 'jugadores'):
        return 'jugadores'
    if p.get('seccion'):
        return p['seccion']
    if p.get('grupo') == 'calculadoras':
        return 'calculadoras'
    if p['ruta'].startswith('guias/'):
        return 'jornada' if p.get('grupo') == 'jornadas' else 'aprende'
    return ''


def menu(raiz, hay_guias, actual=''):
    """la barra del portal: el logo, el buscador y «Descargar»; debajo (en el ordenador, en la misma fila), las cinco secciones.
    El buscador es un formulario normal (sin JS lleva a jugadores/?q=, con la tabla entera); con JS (portal.js) sugiere fichas.
    En el móvil se abre con la lupa (una casilla y CSS, sin JS)."""
    if actual in ('aprende', 'calculadoras'):
        actual = 'guias'
    enlaces = ''.join(f'<a href="{raiz}{h}"{" aria-current=\"page\"" if c == actual else ""}>{t}</a>'
                      for c, h, t in SECCIONES if hay_guias or not h.startswith('guias/'))
    lupa = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
    return (f'<header class="cab"><div class="cab-in">'
            f'<a class="marca" href="{raiz or "./"}"><img src="{raiz}img/logo.svg" alt="" width="30" height="30">Fantasy <b>Manager</b></a>'
            f'<input type="checkbox" id="busca-t" class="busca-t" aria-label="Abrir el buscador">'
            f'<div class="cab-app"><label for="busca-t" class="busca-b" title="Buscar">{lupa}</label><a class="menu-cta" href="{PLAY}" target="_blank" rel="noopener">Descargar<span class="largo"> la app</span></a></div>'
            f'<nav class="menu" aria-label="Secciones">{enlaces}</nav>'
            f'<form class="busca" role="search" action="{raiz}jugadores/" method="get" data-raiz="{raiz}"><input type="search" name="q" placeholder="Buscar jugador o equipo" aria-label="Buscar jugador o equipo" autocomplete="off" enterkeyhint="search"><button type="submit" aria-label="Buscar">{lupa}</button><ul class="busca-r" hidden></ul></form>'
            f'</div></header>')


def tira(raiz, p=None):
    """arriba del todo, los 20 equipos con su escudo: de cualquier página a cualquier equipo. En la ficha de un equipo o de uno de
    sus jugadores, el suyo va marcado. Las tres letras las pone el CSS (data-a): así no son texto repetido en todas las páginas.
    Con loading="lazy": los que se ven se piden al momento y ninguno retrasa el «load» de la página (medido: con los primeros
    sin lazy, el load de una ficha de equipo en un móvil lento pasaba de 1,6 s a 10,7 s porque arrastraba las caras de la tabla)."""
    if not ESCUDOS:
        return ''
    suyo = ''
    if p and p.get('grupo') == 'equipo':
        suyo = p['ruta']
    elif p and p.get('grupo') == 'jugador' and len(p.get('migas') or []) > 2:
        suyo = p['migas'][2][1]
    filas = ''.join(
        f'<a href="{raiz}{x["r"]}" title="{e(x["n"])}" data-a="{sigla(x)}"{" aria-current=\"true\"" if x["r"] == suyo else ""}>'
        f'<img src="{e(x["u"])}" alt="{e(x["n"])}" width="28" height="28" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>'
        for x in ESCUDOS)
    return f'<nav class="tira" aria-label="Los 20 equipos"><div class="tira-in">{filas}</div></nav>\n'


# (sesión 4 de AdSense) la frase de la llamada corta cambia de una ficha a otra (siempre la misma para la misma página): con una sola,
# era de lo que más se repetía entre las 170 fichas
CTA_CORTA = (
    '¿Lo tienes a tiro en tu liga? Fantasy Manager te lo dice con los datos de tu liga',
    'Si juegas LaLiga Fantasy, la app mira tu plantilla y tu saldo y te dice si te conviene pujar, vender o clausular',
    'Para saber cuánto pujar o si te lo pueden clausular, Fantasy Manager hace las cuentas con tu liga',
    'Fantasy Manager cruza estas cifras con tu equipo y con los de tus rivales cada mañana',
    '¿Fichar, vender o esperar? La app lo calcula con lo que pasa en tu liga, gratis',
)


def cta(raiz, p=None):
    # (16 nov) en las fichas de jugador y equipo, la versión corta: el bloque entero, igual en 170 páginas, era la mitad del texto repetido
    # (sesión 4) también en los resúmenes de jornada, que desde la J1 son 12
    # (sesión 3) y en las previas y las páginas del portal (mercado/, equipos/, jornada/, bajas/…), que se rehacen cada semana o cada noche
    if p and (p.get('grupo') in ('jugador', 'equipo', 'resumenes', 'jornadas') or p.get('tipo') == 'portal'):
        return (f'<aside class="cta" aria-label="La app">'
                f'<p class="cta-t">{CTA_CORTA[int(hashlib.md5(p["ruta"].encode()).hexdigest(), 16) % len(CTA_CORTA)]}</p>'
                f'<div class="cta-b"><a class="btn" href="{PLAY}" target="_blank" rel="noopener">Descargar en Google Play</a>'
                f'<a class="btn sec" href="{raiz or "./"}">Abrirla en el navegador</a></div>'
                f'</aside>')
    return (f'<aside class="cta" aria-label="La app">'
            f'<p class="cta-t">Fantasy Manager hace estas cuentas por ti con los datos de tu liga</p>'
            f'<p>Cada día te dice a quién vender, a quién comprar, cuánto pujar y a quién clausular. Gratis y sin registrarte: entras con tu cuenta de LaLiga.</p>'
            f'<div class="cta-b"><a class="btn" href="{PLAY}" target="_blank" rel="noopener">Descargar en Google Play</a>'
            f'<a class="btn sec" href="{raiz or "./"}">Abrirla en el navegador</a></div>'
            f'<p class="peq">En el ordenador se usa desde la web, sin descargar nada. En el iPhone también, después de entrar una vez desde un ordenador. Y puedes verla antes con una liga de ejemplo. <a href="{raiz}instalar.html">Cómo instalarla</a></p>'
            f'</aside>')


def pie(raiz, hay_guias):
    """el pie, por columnas: los datos de cada día, la jornada, las guías y lo de la app"""
    def col(titulo, enlaces):
        # el título de cada columna lo pinta el CSS (aria-label): así no es texto repetido en las 600 páginas
        return f'<div role="group" aria-label="{titulo}">' + ''.join(f'<a href="{raiz}{h}">{t}</a>' for h, t in enlaces if h is not None) + '</div>'
    datos = col('Datos', [('mercado/', 'Mercado'), ('equipos/', 'Equipos'), ('jugadores/', 'Jugadores')])
    jornada = col('Jornada', [('jornada/', 'Jornadas'), ('jornada/onces.html', 'Onces probables') if existe('jornada/onces.html') else (None, ''),
                              ('bajas/', 'Bajas') if existe('bajas/index.html') else (None, ''), ('clausulas/', 'Cláusulas') if existe('clausulas/index.html') else (None, '')])
    guias = col('Aprende', [('guias/', 'Guías') if hay_guias else (None, ''), ('guias/#calculadoras', 'Calculadoras') if hay_guias else (None, ''), ('metodo.html', 'Cómo calculamos')])
    app = col('Fantasy Manager', [('', 'Abrir la app'), ('instalar.html', 'Instalar'), ('quienes-somos.html', 'Quiénes somos'), ('contacto.html', 'Contacto')])
    return (f'<footer class="pie"><div class="pie-in">'
            f'<nav class="pie-c" aria-label="Pie">{datos}{jornada}{guias}{app}</nav>'
            f'<p><a href="{raiz}privacidad.html">Privacidad</a> · <a href="{raiz}condiciones.html">Condiciones</a> · <a href="{raiz}aviso-legal.html">Aviso legal</a></p>'
            f'<p>Fantasy Manager es una app no oficial: no es de LaLiga ni tiene relación con LaLiga, LaLiga Fantasy ni sus patrocinadores.</p>'
            f'<p>© 2026 Fantasy Manager · <a href="mailto:fantasymanager.web.app@gmail.com">fantasymanager.web.app@gmail.com</a></p>'
            f'</div></footer>')


RUTAS = set()  # las rutas publicadas (la rellena main): para no enlazar desde el pie o las pastillas lo que no existe


def existe(ruta):
    return ruta in RUTAS


def secnav(raiz, p):
    """debajo de las migas, las páginas de la sección en pastillas (lo que antes había que encontrar entre el texto): en Mercado,
    las cláusulas y las calculadoras; en Jornada, los onces, la previa, las bajas y el cierre de cláusulas; en Guías, las
    calculadoras y el método. Las fichas de jugador y de equipo no las llevan (tienen sus saltos y la tira de escudos)."""
    if p.get('grupo') in ('jugador', 'equipo') or not publicada(p):
        return ''
    s = seccion_de(p)
    previa = PREVIAS[0] if PREVIAS else None
    if s == 'mercado':
        xs = [('mercado/index.html', 'Mercado hoy'), ('clausulas/index.html', 'Cláusulas'), ('guias/cuanto-pujar.html', 'Cuánto pujar'),
              ('guias/valor-de-mercado.html', 'Cómo se mueve el valor')]
    elif s == 'jornada':
        xs = [('jornada/index.html', 'Jornadas'), ('jornada/onces.html', 'Onces probables')]
        if previa:
            xs.append((previa['ruta'], f'Previa J{previa["jornada"]}'))
        xs += [('bajas/index.html', 'Bajas'), ('clausulas/index.html', 'Cláusulas')]
    elif s in ('aprende', 'calculadoras'):
        xs = [('guias/index.html', 'Todas las guías'), ('guias/subir-clausula.html', 'Calculadora de cláusula'),
              ('guias/cuanto-pujar.html', 'Calculadora de puja'), ('metodo.html', 'Cómo calculamos'), ('guias/preguntas-frecuentes.html', 'Preguntas')]
    elif s in ('equipos', 'jugadores'):
        xs = [('equipos/index.html', 'Los 20 equipos'), ('jugadores/index.html', 'Todos los jugadores'), ('bajas/index.html', 'Bajas')]
    else:
        return ''
    xs = [(r, n) for r, n in xs if existe(r)]
    if len(xs) < 2:
        return ''
    def href(r):
        return raiz + (r[:-len('index.html')] if r.endswith('index.html') else r)
    return '<nav class="secnav" aria-label="En esta sección">' + ''.join(
        f'<a href="{href(r)}"{" aria-current=\"page\"" if r == p["ruta"] else ""}>{e(n)}</a>' for r, n in xs) + '</nav>'


def en_guias(p):
    """una guía o una página de guias/ (las preguntas frecuentes), sin contar el índice"""
    return p['ruta'].startswith('guias/') and p['ruta'] != 'guias/index.html'


def migas_de(p):
    """[(nombre, ruta desde la raíz)] de Inicio a la sección de la página (sin la propia página)"""
    if p.get('migas'):
        return [(n, r) for n, r in p['migas']]
    if p['ruta'] in ('mercado/index.html', 'jornada/index.html', 'equipos/index.html'):
        return [('Inicio', '')]
    if p.get('tipo') == 'portal':
        nombre = {'mercado': 'Mercado', 'jornada': 'Jornadas', 'equipos': 'Equipos'}.get(p.get('seccion'), '')
        return [('Inicio', ''), (nombre, p['ruta'].split('/')[0] + '/')] if nombre else [('Inicio', '')]
    if es_previa(p):
        return [('Inicio', ''), ('Jornadas', 'jornada/')]
    if en_guias(p):
        return [('Inicio', ''), ('Aprende', 'guias/')]
    return []


def migas(raiz, p, hay_guias):
    m = migas_de(p)
    if not m:
        return ''
    return '<nav class="migas" aria-label="Estás en">' + ' › '.join(f'<a href="{raiz}{r or ""}">{e(n)}</a>' if r else f'<a href="{raiz or "./"}">{e(n)}</a>' for n, r in m) + '</nav>'


# quien firma las guías y las previas (16 nov, idea 2 del plan de AdSense): una persona con nombre, no la marca
AUTOR = {'@type': 'Person', 'name': 'Carlos Díez', 'url': DOMINIO + 'quienes-somos.html'}


def firma(p, raiz):
    """debajo del h1 de una guía: quién la firma y cuándo se puso al día; en las previas, que se hacen con los datos y cómo"""
    if p['tipo'] != 'guia' or p['ruta'] == 'guias/index.html' or not publicada(p):
        return ''
    quien = f'<a href="{raiz}quienes-somos.html">Carlos Díez</a>'
    if es_previa(p):
        return (f'<p class="firma">Preparada por {quien} con los datos de LaLiga Fantasy · actualizada el {fecha_larga(p["fecha"])} · '
                f'<a href="{raiz}metodo.html#previas">cómo se hace</a></p>')
    return f'<p class="firma">Por {quien} · actualizada el {fecha_larga(p["fecha"])}</p>'


def poner_firma(contenido, p, raiz):
    # la firma va dentro de las marcas de contenido: la de la vez anterior se quita para poner la fecha de hoy
    contenido = re.sub(r'\n?[ \t]*<p class="firma">.*?</p>', '', contenido)
    f = firma(p, raiz)
    if not f:
        return contenido
    if '</h1>' in contenido:
        return contenido.replace('</h1>', f'</h1>\n  {f}', 1)
    return f'  {f}\n{contenido}'


def datos_estructurados(p, url):
    """en las guías, el artículo; en el portal, la página con su fecha; en las dos, las migas"""
    if not indexable(p) or p['ruta'] == 'guias/index.html' or p['tipo'] not in ('guia', 'portal'):
        return ''
    titulo = p.get('h1') or p['titulo']
    org = {'@type': 'Organization', 'name': 'Fantasy Manager', 'url': DOMINIO, 'logo': {'@type': 'ImageObject', 'url': DOMINIO + 'img/icono-180.png'}}
    if p['tipo'] == 'guia':
        principal = {'@type': 'Article', 'headline': titulo,
                     'description': p['descripcion'], 'inLanguage': 'es-ES', 'mainEntityOfPage': url,
                     'image': {'@type': 'ImageObject', 'url': IMAGEN, 'width': 1200, 'height': 630},
                     'datePublished': p.get('publicada', p['fecha']), 'dateModified': p['fecha'],
                     'author': AUTOR, 'publisher': org}
    else:
        principal = {'@type': 'WebPage', 'name': titulo, 'description': p['descripcion'], 'inLanguage': 'es-ES', 'url': url,
                     'datePublished': p.get('publicada', p['fecha']), 'dateModified': p['fecha'], 'publisher': org}
        if p.get('sobre'):
            principal['about'] = p['sobre']
    items = [(n, DOMINIO + r) for n, r in migas_de(p)] + [(titulo, url)]
    migas_ld = {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(items)]}
    d = {'@context': 'https://schema.org', '@graph': [principal, migas_ld]}
    return f'\n  <script type="application/ld+json">{json.dumps(d, ensure_ascii=False)}</script>'


GUIAS_PUB = []  # las guías publicadas, en orden (la rellena main)
PREVIAS = []  # las previas de jornada publicadas, de la más nueva a la más vieja (la rellena main)
RESUMENES = {}  # jornada -> página del resumen (jornada/resumen-jornada-N.html; la rellena main)


def es_previa(p):
    return p.get('grupo') == 'jornadas' and p.get('jornada') is not None


def aviso_previa(p):
    """en una previa vieja: que esa jornada ya se jugó, su resumen y dónde está la de la siguiente"""
    if not es_previa(p) or not PREVIAS or PREVIAS[0]['ruta'] == p['ruta'] or PREVIAS[0]['jornada'] < p['jornada']:
        r = RESUMENES.get(p.get('jornada')) if es_previa(p) else None
        return f'\n  <p class="aviso">Esta jornada ya se ha jugado: <a href="../{r["ruta"]}">el resumen de la jornada {p["jornada"]}</a>, con los mejores, el once ideal y el MVP de cada partido.</p>' if r else ''
    u = PREVIAS[0]
    r = RESUMENES.get(p['jornada'])
    resumen = f' Cómo fue: <a href="../{r["ruta"]}">el resumen de la jornada {p["jornada"]}</a>.' if r else ''
    return f'\n  <p class="aviso">Esta jornada ya se ha jugado.{resumen} La previa de la siguiente: <a href="{u["ruta"].split("/", 1)[1]}">{e(u["h1"])}</a>.</p>'


def poner_previa(contenido, p):
    """las marcas <!-- previa --> … <!-- /previa --> de cualquier página: el enlace a la previa de la jornada que viene"""
    if '<!-- previa -->' not in contenido:
        return contenido
    if PREVIAS:
        u = PREVIAS[0]
        enlace = f'<p class="aviso"><b>Jornada {u["jornada"]}:</b> los apercibidos, sancionados y lesionados de esta semana, con la hora del cierre de cláusulas, en <a href="{os.path.relpath(u["ruta"], os.path.dirname(p["ruta"]) or ".")}">la previa de la jornada {u["jornada"]}</a>.</p>'
    else:
        enlace = ''
    return re.sub(r'<!-- previa -->.*?<!-- /previa -->', lambda m: f'<!-- previa -->{enlace}<!-- /previa -->', contenido, flags=re.S)


def mas_guias(p):
    """al final de cada guía publicada, tres para seguir leyendo: las de su «relacionadas» (rutas en paginas.json) o,
    si no tiene, las tres siguientes (dando la vuelta)"""
    if p['tipo'] != 'guia' or p['ruta'] == 'guias/index.html' or not publicada(p) or len(GUIAS_PUB) < 2:
        return ''
    por_ruta = {g['ruta']: g for g in GUIAS_PUB}
    sig = [por_ruta[r] for r in p.get('relacionadas', []) if r in por_ruta and r != p['ruta']][:3]
    if not sig:
        normales = [g for g in GUIAS_PUB if not es_previa(g)]
        i = next((k for k, g in enumerate(normales) if g['ruta'] == p['ruta']), -1)
        sig = [normales[(i + k) % len(normales)] for k in range(1, min(4, len(normales)))]
    filas = ''.join(f'<li><a href="{g["ruta"].split("/", 1)[1]}"><b>{e(g["h1"])}</b><span>{e(g["descripcion"])}</span></a></li>' for g in sig)
    return f'\n  <nav class="mas-guias" aria-label="Más guías"><h2>Sigue leyendo</h2><ul class="lista-guias">{filas}</ul><p><a href="./">Todas las guías</a></p></nav>'


def pagina(p, contenido, hay_guias):
    raiz = '../' * p['ruta'].count('/')
    url = DOMINIO + (p['ruta'][:-len('index.html')] if p['ruta'].endswith('index.html') else p['ruta'])
    robots = '' if indexable(p) else '\n  <meta name="robots" content="noindex, follow">'
    fecha = ''
    pie_guia = f'\n  {cta(raiz, p)}' if p['tipo'] in ('guia', 'portal') or en_guias(p) else ''
    m = migas(raiz, p, hay_guias)
    sn = secnav(raiz, p)
    migas_linea = (f'\n  {m}' if m else '') + (f'\n  {sn}' if sn else '') + aviso_previa(p)
    contenido = poner_firma(poner_previa(contenido, p), p, raiz)
    script = f'\n  <script src="{p["script"]}" defer></script>' if p.get('script') else ''
    if VERSION_JS:
        script += f'\n  <script src="{raiz}portal/portal.js?v={VERSION_JS}" defer></script>'
    return f'''<!doctype html>
<!-- Generada por .github/paginas.py: el texto se edita entre las marcas de contenido; lo demás se rehace al ejecutarlo -->
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#08080a">
  <meta name="color-scheme" content="dark">
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
  <link rel="stylesheet" href="{raiz}css/paginas.css?v={VERSION_CSS}">{script}{datos_estructurados(p, url)}
</head>
<body class="{'portal' if p['tipo'] == 'portal' else 'texto'}">
<a class="salto" href="#contenido">Saltar al contenido</a>
{tira(raiz, p)}{menu(raiz, hay_guias, seccion_de(p))}
<main id="contenido">{migas_linea}
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
    ('jornadas', 'Previas de cada jornada', 'A qué hora se cierran las cláusulas, quién no juega, quién está a una amarilla y quién sube en el mercado. Se hacen solas con los datos de LaLiga Fantasy y se ponen al día antes del cierre.'),
    ('calculadoras', 'Calculadoras', 'Mete tus números y sale la cuenta: cuánto subir una cláusula, si compensa pagar la de un rival y cuánto pujar. Sin cuenta y sin datos de nadie.'),
    ('empezar', 'Para empezar', 'Las reglas básicas: cómo se puntúa, qué significa cada palabra del juego y qué hacer los primeros días.'),
    ('clausulas', 'Cláusulas', 'Cómo funcionan, cuánto subir las de tus jugadores y cuándo pagar la de un rival.'),
    ('mercado', 'Mercado y dinero', 'Cuándo cambia el mercado, cuánto pujar, cuándo vender y cómo no quedarte en negativo.'),
    ('once', 'Tu once', 'Quién juega, cómo puntúa cada puesto y qué hacer con lesionados y sancionados.'),
]


def fila_guia(g, sangria='    '):
    nombre = g['ruta'].split('/', 1)[1]
    return f'{sangria}<li><a href="{nombre}"><b>{e(g["h1"])}</b><span>{e(g["descripcion"])}</span></a></li>'


def indice_guias(guias, faq=None):
    filas = ['  <h1>Aprende <span>LaLiga Fantasy</span></h1>',
             '  <p>Las guías de Fantasy Manager: cómo funcionan las cláusulas, el mercado, la alineación y el dinero en LaLiga Fantasy, explicado con números. Al final de cada una, lo que hace la app por ti en ese tema.</p>',
             '  <p class="peq">Los datos de cada día están en <a href="../mercado/">el mercado de hoy</a>, <a href="../jornada/">las jornadas</a> y <a href="../equipos/">los equipos</a>.</p>']
    if not guias:
        filas.append('  <p class="borrador">Todavía no hay ninguna guía publicada.</p>')
        return '\n'.join(filas)
    claves = [c for c, _, _ in GRUPOS]
    sueltas = [g for g in guias if g.get('grupo') not in claves]
    for clave, titulo, linea in GRUPOS + ([('', 'Más guías', '')] if sueltas else []):
        del_grupo = [g for g in guias if g.get('grupo') == clave] if clave else sueltas
        if clave == 'jornadas':
            del_grupo = sorted(del_grupo, key=lambda g: -g['jornada'])
        if not del_grupo:
            continue
        filas.append(f'\n  <h2 id="{clave}">{e(titulo)}</h2>' if clave else f'\n  <h2>{e(titulo)}</h2>')
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
    guias = PREVIAS[:1] + [g for g in guias if not es_previa(g)]
    enlaces = ''.join(f'\n        <li><a href="{g["ruta"]}">{e(g["h1"])}</a></li>' for g in guias)
    if faq:
        enlaces += f'\n        <li><a href="{faq["ruta"]}">{e(faq["titulo"])}</a></li>'
    poner_entre(os.path.join(WEB, 'index.html'), '<!-- guias -->', '<!-- /guias -->',
                f'\n      <ul>{enlaces}\n      </ul>\n      ')
    lista = ',\n'.join(f'  [{json.dumps(g["ruta"].split("/", 1)[1])}, {json.dumps(corto(g), ensure_ascii=False)}]' for g in guias)
    faq_js = f'\nconst FAQ_GUIA = {json.dumps(faq["ruta"].split("/", 1)[1]) if faq else "null"};\n'
    previa = json.dumps([PREVIAS[0]['ruta'].split('/', 1)[1], PREVIAS[0]['jornada']]) if PREVIAS else 'null'
    faq_js += f'/** la previa de la jornada que viene: [archivo en guias/, jornada] */\nconst PREVIA = {previa};\n'
    # (rework de la web, 21 nov) los 20 escudos también en la portada: sin JS, arriba del bloque de texto; con JS, debajo de la barra
    filas = ''.join(f'<a href="{x["r"]}" title="{e(x["n"])}" data-a="{sigla(x)}"><img src="{e(x["u"])}" alt="{e(x["n"])}" width="28" height="28" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>' for x in ESCUDOS)
    poner_entre(os.path.join(WEB, 'index.html'), '<!-- tira -->', '<!-- /tira -->',
                f'<nav class="sj-tira" aria-label="Los 20 equipos"><div class="tira-p-in">{filas}</div></nav>' if ESCUDOS else '')
    lista_e = ',\n'.join('  ' + json.dumps([x['r'], x['n'], sigla(x), x['u']], ensure_ascii=False) for x in ESCUDOS)
    poner_entre(os.path.join(WEB, 'js', 'portada.js'), '// <escudos>', '// </escudos>',
                f'\n/** los 20 equipos de la tira: [ficha, nombre, tres letras, escudo] (los escribe .github/paginas.py) */\nconst ESCUDOS = [\n{lista_e},\n];\n')
    poner_entre(os.path.join(WEB, 'js', 'portada.js'), '// <guias>', '// </guias>',
                f'\n/** las guías publicadas, en orden: [archivo en guias/, nombre corto] (las escribe .github/paginas.py) */\nconst TODAS_GUIAS = [\n{lista},\n];{faq_js}')


def main():
    with open(os.path.join(RAIZ, '.github', 'paginas.json'), encoding='utf-8') as f:
        paginas = json.load(f)['paginas']
    # las fichas de cada equipo y de cada jugador (portal, fase 2): las escribe bot/portal-web.mjs en su propio registro
    fichas = os.path.join(RAIZ, '.github', 'portal', 'fichas.json')
    if os.path.exists(fichas):
        with open(fichas, encoding='utf-8') as f:
            paginas = paginas + json.load(f)['paginas']
    guias = [p for p in paginas if p['tipo'] == 'guia' and publicada(p)]
    GUIAS_PUB[:] = guias
    PREVIAS[:] = sorted([g for g in guias if es_previa(g)], key=lambda g: -g['jornada'])
    RESUMENES.clear()
    RESUMENES.update({p['jornada']: p for p in paginas if p.get('grupo') == 'resumenes' and p.get('jornada') is not None and publicada(p)})
    faq = next((p for p in paginas if p['ruta'] == 'guias/preguntas-frecuentes.html' and publicada(p)), None)
    hay_guias = bool(guias)
    RUTAS.clear()
    RUTAS.update(p['ruta'] for p in paginas if publicada(p))
    if hay_guias:
        RUTAS.add('guias/index.html')
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
        if p.get('redirige'):
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write(redireccion(p))
            escritas.append(p)
            continue
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

    # el sitemap: la portada y solo lo publicado. Es un índice con tres (páginas, equipos y jugadores), para ver en Search Console
    # cuántas se indexan de cada tipo
    def url_de(p):
        return DOMINIO + (p['ruta'][:-len('index.html')] if p['ruta'].endswith('index.html') else p['ruta'])
    def tipo_sitemap(p):
        return 'equipos' if p.get('grupo') == 'equipo' else 'jugadores' if p.get('grupo') in ('jugador', 'jugadores') else 'paginas'
    grupos = {'paginas': [(DOMINIO, hoy)], 'equipos': [], 'jugadores': []}
    for p in escritas:
        if indexable(p):
            grupos[tipo_sitemap(p)].append((url_de(p), p['fecha']))
    urls = [u for xs in grupos.values() for u in xs]
    indice_sm = []
    for nombre, xs in grupos.items():
        archivo = os.path.join(WEB, f'sitemap-{nombre}.xml')
        if not xs:
            if os.path.exists(archivo):
                os.remove(archivo)
            continue
        with open(archivo, 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
            for u, fe in xs:
                f.write(f'  <url><loc>{u}</loc><lastmod>{fe}</lastmod></url>\n')
            f.write('</urlset>\n')
        indice_sm.append((f'{DOMINIO}sitemap-{nombre}.xml', max(fe for _, fe in xs)))
    with open(os.path.join(WEB, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u, fe in indice_sm:
            f.write(f'  <sitemap><loc>{u}</loc><lastmod>{fe}</lastmod></sitemap>\n')
        f.write('</sitemapindex>\n')
    portada(guias, faq)
    largos = [p['ruta'] for p in escritas if len(p['titulo']) > 60]
    if largos:
        print('Títulos de más de 60 caracteres:', ', '.join(largos))
    with open(os.path.join(WEB, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write(f'User-agent: *\nAllow: /\n\nSitemap: {DOMINIO}sitemap.xml\n')
    borradores = sum(1 for p in escritas if not publicada(p) and not p.get('redirige'))
    fuera = sum(1 for p in escritas if publicada(p) and not indexable(p))
    redir = sum(1 for p in escritas if p.get('redirige'))
    print(f'{len(escritas)} páginas ({borradores} borradores, {fuera} sin indexar, {redir} redirecciones), {len(urls)} direcciones en el sitemap')


if __name__ == '__main__':
    main()
