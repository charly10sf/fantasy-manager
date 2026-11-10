"""Las capturas de la ficha de Google Play (1080 x 1920) con la liga de ejemplo.
Uso: en web/, `python3 -m http.server 8765`; desde la raíz del repo, `python3 .github/capturas-play.py [archivo…]`
(PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers en el entorno de Claude). Las deja en play/; con nombres, solo esas.
Sin fotos de LaLiga: todo lo que no es localhost se corta y salen las iniciales (lo que queremos en Play).
El chat de la IA no gasta cuota: la respuesta de Google es la de RESPUESTA_IA, escrita a mano con los datos de la demo
(si cambia la demo, revisar las cifras). La cabecera del mensaje dice «IA», sin nombre de modelo."""
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright

PREGUNTA_IA = '¿Clausulo hoy a Kang-In Lee o espero?'
RESPUESTA_IA = """**Clausúlalo hoy, pero después de vender.** Su cláusula es de 55,32 M y vale 52,77 M: pagas 2,55 M de más (un 4,8 %).

- Entra en tu once y te da unos **4,6 pts por jornada**. Lleva 6,8 de media y acaba de hacer 13 en la J9.
- Con lo que sube, recuperas esos 2,55 M en **unos 27 días**.
- Si se tuerce, se lo vendes a LaLiga por unos 54,73 M y casi no pierdes.

Con 6,43 M de saldo no te llega: primero acepta lo de Álex Baena y vende a Raphinha. Después de clausular te quedan unos **154,6 M** para pujar por Unai Simón."""

# la sección «Tu once» de Equipo, arriba (debajo de la cabecera)
TU_ONCE = "(() => { const e = [...document.querySelectorAll('h2, h3, .sec-t, .titulo2, div, span')].find((x) => x.children.length === 0 && /^tu once$/i.test(x.textContent.trim())); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 150); })()"
# la ficha de Raphinha: es la que lleva el recuadro del plan de hoy (ojo: la línea de la cláusula salta y deja «más» sola)
FICHA = "(() => { const e = [...document.querySelectorAll('[data-j]')].find((x) => x.offsetParent && /raphinha/i.test(x.textContent)); if (e) e.click(); })()"
import re as _re
RESPUESTA_IA = _re.sub(r'(\d) (M|mil|%|pts)', '\\1\u00a0\\2', RESPUESTA_IA)
# (archivo, título, subtítulo, pasos[, modo]). Modo: 'normal' (como la ve cualquiera, con los candados), 'abierto'
# (limites.json sin `bloqueadas`: las funciones de anuncio, abiertas) o 'paron' (abierto y la demo en el parón: la J10 a
# 12 días, como en prueba-web). Pasos: ('ir', vista), ('seg', 'vista:seg'), ('clic', selector), ('js', código),
# ('scroll', selector), ('chat', pregunta), ('espera', ms)
PANTALLAS = [
  ('captura-1-hoy', 'QUÉ HACER HOY', 'paso a paso, nada más abrirla', [('ir', 'hoy')]),
  ('captura-2-clubes', 'CLUB A CLUB', 'quién sube y quién baja en cada equipo', [('ir', 'clubes'), ('clic', '.club-card[data-club]'), ('clic', '[data-accion="segClub"][data-s="suben"]')]),
  ('captura-3-clausulas', 'CLÁUSULAS A TU ALCANCE', 'cuáles te llegan y cuándo se abren', [('ir', 'rivales'), ('seg', 'rivales:clausulas')]),
  ('captura-4-mercado', 'CUÁNTO PUJAR', 'según lo que se paga en tu liga', [('ir', 'mercado')]),
  ('captura-5-equipo', 'TU MEJOR ONCE', 'con el calendario de cada jugador', [('ir', 'equipo'), ('seg', 'equipo:plantilla'), ('js', TU_ONCE)]),
  ('captura-6-chat', 'PREGÚNTALE A LA IA', 'lo que quieras, gratis, también con capturas', [('chat', PREGUNTA_IA)]),
  ('captura-7-ficha', 'CADA JUGADOR, A FONDO', 'valor, cláusula, rival y qué hacer con él', [('ir', 'equipo'), ('seg', 'equipo:plantilla'), ('js', FICHA)]),
  ('captura-8-dinero', 'EL DINERO DE CADA RIVAL', 'quién puede pagar tus cláusulas', [('ir', 'rivales'), ('seg', 'rivales:clasif')], 'abierto'),
  ('captura-9-paron', 'PARÓN DE SELECCIONES', 'qué comprar para revender antes de la vuelta', [('ir', 'directo'), ('scroll', '.pnz-hero')], 'paron'),
]

async def google(route):
    """La IA de Google, de mentira: la lista de modelos y una respuesta escrita a mano (en trozos, como de verdad)."""
    url = route.request.url
    if '/models?' in url:
        return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'models': [{'name': 'models/gemini-3.5-flash', 'supportedGenerationMethods': ['generateContent']}]}))
    trozos = [RESPUESTA_IA[i:i + 120] for i in range(0, len(RESPUESTA_IA), 120)]
    pieza = lambda t, fin=None: 'data: ' + json.dumps({'candidates': [{'content': {'role': 'model', 'parts': [{'text': t}]}, **({'finishReason': fin} if fin else {})}], 'usageMetadata': {'promptTokenCount': 9000, 'candidatesTokenCount': 220}}) + '\r\n\r\n'
    cuerpo = ''.join(pieza(t, 'STOP' if i == len(trozos) - 1 else None) for i, t in enumerate(trozos))
    if 'alt=sse' in url:
        return await route.fulfill(status=200, content_type='text/event-stream', body=cuerpo)
    return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates': [{'content': {'role': 'model', 'parts': [{'text': RESPUESTA_IA}]}, 'finishReason': 'STOP'}]}))

MODO = {'v': 'normal'}
async def red(route):
    u = route.request.url
    if u.startswith('http://localhost'):
        if MODO['v'] != 'normal' and u.split('?')[0].endswith('/limites.json'):
            r = await route.fetch(); d = await r.json(); d['bloqueadas'] = []
            return await route.fulfill(response=r, body=json.dumps(d))
        if MODO['v'] == 'paron' and u.split('?')[0].endswith('/js/demo.js'):
            r = await route.fetch(); t = await r.text()
            assert '9: base - 7 * DIA, 10: base,' in t, 'demo.js ha cambiado: revisar el truco del parón'
            return await route.fulfill(response=r, body=t.replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,'))
        return await route.continue_()
    if 'generativelanguage.googleapis.com' in u: return await google(route)
    return await route.abort()

async def cerrar_hoja(pg):
    await pg.evaluate("(() => { const b = document.querySelector('[data-accion=\"cerrarHoja\"], .hoja-x, [aria-label=\"Cerrar\"]'); if (b) b.click(); })()")
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)

async def main(solo):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for modo in ('normal', 'abierto', 'paron'):
            hoy = [x for x in PANTALLAS if (x[4] if len(x) > 4 else 'normal') == modo and (not solo or x[0] in solo)]
            if hoy: await por_modo(b, modo, hoy)
        await b.close()

async def por_modo(b, modo, pantallas):
        MODO['v'] = modo
        ctx = await b.new_context(viewport={'width': 390, 'height': 770}, device_scale_factor=2)
        pg = await ctx.new_page()
        await pg.route('**/*', red)
        pg.on('pageerror', lambda e: print('ERROR en la página:', e))
        await pg.add_init_script("localStorage.setItem('fm-tour','1')")
        # el escudo grande de la ficha del club, sin la foto de LaLiga, es un círculo vacío: fuera
        await pg.add_init_script("addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.pt-esc.sin.club-g{display:none}'; document.head.appendChild(s); })")
        await pg.goto('http://localhost:8765/')
        await pg.wait_for_timeout(7000)
        for arch, tit, sub, pasos, *_ in pantallas:
            await cerrar_hoja(pg)
            for tipo, x in pasos:
                if tipo == 'ir':
                    await pg.evaluate(f"document.querySelector('[data-ir=\"{x}\"]').click()")
                    await pg.wait_for_timeout(1200)
                    await pg.evaluate("window.scrollTo(0,0)")
                elif tipo == 'seg':
                    v, s = x.split(':')
                    await pg.evaluate(f"(() => {{ window.S.seg['{v}'] = '{s}'; const b = document.querySelector('[data-seg=\"{v}:{s}\"]') || [...document.querySelectorAll('[data-seg]')].find((x) => x.dataset.seg.endsWith(':{s}')); if (b) b.click(); }})()")
                    await pg.wait_for_timeout(1000)
                    await pg.evaluate("window.scrollTo(0,0)")
                elif tipo == 'clic':
                    await pg.evaluate(f"(() => {{ const e = [...document.querySelectorAll('{x}')].find((y) => y.offsetParent); if (e) e.click(); }})()")
                    await pg.wait_for_timeout(1500)
                elif tipo == 'js':
                    await pg.evaluate(x); await pg.wait_for_timeout(1500)
                elif tipo == 'scroll':
                    await pg.evaluate(f"(() => {{ const e = document.querySelector('{x}'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 82); }})()")
                    await pg.wait_for_timeout(500)
                elif tipo == 'espera':
                    await pg.wait_for_timeout(x)
                elif tipo == 'chat':
                    await pg.evaluate("(async () => { const m = await import('/js/puente.js'); m.guardar('gemini', 'AIzaSyDEMOdemoDEMOdemoDEMOdemoDEMOdem'); })()")
                    await pg.evaluate("document.querySelector('[data-ir=\"ia\"]').click()")
                    await pg.wait_for_timeout(1200)
                    await pg.fill('#pregunta', x)
                    await pg.click('[data-accion="enviar"]')
                    await pg.wait_for_function("!window.S.charlando", timeout=30000)
                    await pg.wait_for_timeout(1200)
                    # la pregunta arriba, con la respuesta entera debajo
                    await pg.evaluate("(() => { const e = document.querySelector('.msg.yo'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 86); })()")
                    await pg.wait_for_timeout(500)
            await pg.evaluate("document.activeElement && document.activeElement.blur()")
            png = await pg.screenshot()
            await componer(b, arch, tit, sub, png)
            print('hecha', arch, f'({modo})')
        await ctx.close()

async def componer(b, arch, tit, sub, png):
    img = base64.b64encode(png).decode()
    fc = base64.b64encode(open('web/fonts/barlow-condensed-700.woff2','rb').read()).decode()
    fr = base64.b64encode(open('web/fonts/barlow-400.woff2','rb').read()).decode()
    html = f"""<html><head><style>
    @font-face {{ font-family: 'BC'; src: url(data:font/woff2;base64,{fc}); }}
    @font-face {{ font-family: 'B'; src: url(data:font/woff2;base64,{fr}); }}
    body {{ margin:0; width:1080px; height:1920px; background: radial-gradient(120% 60% at 50% 0%, #4a0c18 0%, #160609 55%, #08080a 100%); color:#f4f2f3; font-family:'B', sans-serif; text-align:center; overflow:hidden }}
    h1 {{ font-family:'BC', sans-serif; font-size:104px; margin:92px 30px 0; letter-spacing:1px; line-height:1 }}
    p {{ font-size:44px; margin:22px 0 0; color:#d8d3da }}
    .tel {{ margin:58px auto 0; width:820px; height:1600px; border-radius:64px; background:#1a1a1f; padding:20px; box-sizing:border-box; box-shadow:0 30px 80px rgba(0,0,0,.6) }}
    .tel img {{ width:780px; height:1540px; border-radius:46px; display:block; object-fit:cover; object-position:top }}
    </style></head><body><h1>{tit}</h1><p>{sub}</p><div class="tel"><img src="data:image/png;base64,{img}"></div></body></html>"""
    pg = await b.new_page(viewport={'width': 1080, 'height': 1920})
    await pg.set_content(html)
    await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'play/{arch}.png')
    await pg.close()

os.makedirs('play', exist_ok=True)
asyncio.run(main(set(sys.argv[1:])))
