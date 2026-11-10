"""Las capturas de la ficha de Google Play (1080 x 1920) con la liga de ejemplo.
Uso: en web/, `python3 -m http.server 8765`; desde la raíz del repo, `python3 .github/capturas-play.py [archivo…]`
(PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers en el entorno de Claude). Las deja en play/; con nombres, solo esas.
Con las caras y los escudos de LaLiga, como se ve la app (Carlos, 10 nov): se piden con curl y se sirven al navegador;
lo demás que no es localhost se corta. Si no llegan, el script se para.
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
# la ficha de un rival (el más peligroso de la demo) y, en la segunda foto, su «Cómo juega»
RIVAL = "(() => { const e = [...document.querySelectorAll('[data-r=\"511\"]')].find((x) => x.offsetParent); if (e) e.click(); })()"
# hasta dónde se ve la primera foto (lo de debajo, «Cómo juega», ya sale en la segunda): la y de su título
CORTE = "(() => { const h = [...document.querySelectorAll('.sec h2')].find((x) => /Cómo juega/.test(x.textContent)); return h ? h.getBoundingClientRect().top : 770; })()"
COMO_JUEGA = "(() => { const h = [...document.querySelectorAll('.sec h2')].find((x) => /Cómo juega/.test(x.textContent)); if (!h) return; let p = h.parentElement; while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement; if (p) p.scrollTop += h.getBoundingClientRect().top - p.getBoundingClientRect().top - 24; })()"
# solo para la captura 8: el rival 511 (Club Clausulazo, Mario) con toda una temporada de movimientos inventados, como
# los de un rival de verdad (en la demo normal solo hay unos días): clausulazos (3 a ti), fichajes, ventas y escudos,
# casi siempre de 20 a 23 h. Va dentro de demo.js, después de la actividad de la demo
TEMPORADA_RIVAL = r'''
  {
    const R = clasif.find((e) => String(e.teamId) === '511'), Y = clasif.find((e) => e.esYo);
    const otros = clasif.filter((e) => e !== R && e !== Y);
    const hora = (d, k) => { const x = new Date(ahora - d * DIA); x.setHours(19 + (k % 4), (k * 17) % 60, 0, 0); return +x; };
    const ev = (id, t, tipo, pid, otro) => actividad.push({ id, t, tipo, clase: { 31: 'compra', 32: 'clausula', 33: 'venta', 4: 'blindaje' }[tipo], quien: R.manager, quienId: R.userId, otro: otro ? otro.manager : '', otroId: otro ? otro.userId : '', pid, jugador: maestro[pid].nombre, importe: Math.round(maestro[pid].valor * (tipo === 31 ? 1.04 : tipo === 33 ? 0.98 : 1) / 1000) * 1000, texto: '' });
    if (R && Y) {
      const victimas = [Y, Y, Y, otros[0], otros[1], otros[1], otros[2], otros[3], otros[4], otros[5]];
      // (lo que clausuló lo tiene ahora: de su plantilla, para no chocar con las de los demás)
      const mios = plantillas[R.teamId] || [];
      victimas.forEach((v, k) => { if (mios.length) ev('tr-c' + k, hora(9 + k * 9.3, k), 32, mios[k % mios.length].pid, v); });
      for (let k = 0; k < 40; k++) ev('tr-f' + k, hora(4 + k * 2.4, k + 1), 31, libresDemo[(k * 7) % libresDemo.length]);
      for (let k = 0; k < 34; k++) ev('tr-v' + k, hora(3 + k * 2.8, k + 2), 33, libresDemo[(k * 7 + 3) % libresDemo.length]);
      for (let k = 0; k < 8; k++) if (mios.length) ev('tr-b' + k, hora(6 + k * 11, k), 4, mios[k % mios.length].pid);
    }
  }'''
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
  ('captura-8-dinero', 'EL DINERO DE CADA RIVAL<br>Y CÓMO JUEGAN', 'quién puede pagar tus cláusulas y cómo te atacan', [('ir', 'rivales'), ('seg', 'rivales:clasif'), ('dicho', '511'), ('ir', 'rivales'), ('seg', 'rivales:clasif'), ('js', RIVAL), ('medir', CORTE), ('foto', None), ('js', COMO_JUEGA), ('foto', None)], 'abierto'),
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
CACHE = {}
async def de_fuera(route):
    """Las caras y los escudos de LaLiga (como se ve la app): la lista de jugadores y de equipos y las imágenes,
    pedidas con curl (que sale por el proxy del entorno) y servidas al navegador."""
    u = route.request.url
    if u not in CACHE:
        pr = await asyncio.create_subprocess_exec('curl', '-sS', '--compressed', '-m', '30', '-H', 'x-app: 2', '-D', '-', u, stdout=asyncio.subprocess.PIPE)
        out, _ = await pr.communicate()
        cab, _, cuerpo = out.partition(b'\r\n\r\n')
        while cuerpo.startswith(b'HTTP/'):  # 100 Continue o redirecciones
            cab, _, cuerpo = cuerpo.partition(b'\r\n\r\n')
        tipo = next((l.split(b':', 1)[1].strip().decode() for l in cab.split(b'\r\n') if l.lower().startswith(b'content-type:')), 'application/octet-stream')
        estado = int(cab.split(b' ')[1]) if cab.startswith(b'HTTP/') else 502
        CACHE[u] = (estado, tipo, cuerpo)
    estado, tipo, cuerpo = CACHE[u]
    return await route.fulfill(status=estado, content_type=tipo, body=cuerpo, headers={'access-control-allow-origin': '*'})

async def red(route):
    u = route.request.url
    if 'llt-services.com' in u: return await de_fuera(route)
    if u.startswith('http://localhost'):
        if MODO['v'] != 'normal' and u.split('?')[0].endswith('/limites.json'):
            r = await route.fetch(); d = await r.json(); d['bloqueadas'] = []
            return await route.fulfill(response=r, body=json.dumps(d))
        if MODO['v'] == 'abierto' and u.split('?')[0].endswith('/js/demo.js'):
            r = await route.fetch(); t = await r.text()
            assert '  void nombres;' in t, 'demo.js ha cambiado: revisar TEMPORADA_RIVAL'
            return await route.fulfill(response=r, body=t.replace('  void nombres;', TEMPORADA_RIVAL + '\n  void nombres;'))
        if MODO['v'] == 'paron' and u.split('?')[0].endswith('/js/demo.js'):
            r = await route.fetch(); t = await r.text()
            assert '9: base - 7 * DIA, 10: base,' in t, 'demo.js ha cambiado: revisar el truco del parón'
            return await route.fulfill(response=r, body=t.replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,'))
        return await route.continue_()
    if 'generativelanguage.googleapis.com' in u: return await google(route)
    print('cortado:', u[:120])
    return await route.abort()

async def cerrar_hoja(pg):
    await pg.evaluate("(() => { const b = document.querySelector('[data-accion=\"cerrarHoja\"], .hoja-x, [aria-label=\"Cerrar\"]'); if (b) b.click(); })()")
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)

async def main(solo):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for modo in ('normal', 'abierto', 'paron'):
            hoy = [x for x in PANTALLAS if (x[4] if len(x) > 4 else 'normal') == modo and (not solo or x[0] in solo)]
            # una sesión nueva para cada captura: con más de un minuto abierta, la cabecera pasa de «Al día» a
            # «Actualizado hace 1 min» (y a 390 px eso ocupa tres líneas); recargar no basta, la hora se guarda
            for x in hoy: await por_modo(b, modo, [x])
        await b.close()

async def por_modo(b, modo, pantallas):
        MODO['v'] = modo
        ctx = await b.new_context(viewport={'width': 390, 'height': 770}, device_scale_factor=2)
        pg = await ctx.new_page()
        await pg.route('**/*', red)
        pg.on('pageerror', lambda e: print('ERROR en la página:', e))
        await pg.add_init_script("localStorage.setItem('fm-tour','1')")
        await pg.goto('http://localhost:8765/')
        await pg.wait_for_timeout(7000)
        # las caras y los escudos de LaLiga, como en la web publicada: en localhost la app no puede pedirlos (no hay
        # Worker), así que se piden aquí con caras-demo.js y un http que va directo (lo sirve de_fuera con curl)
        n = await pg.evaluate("""(async () => {
          const CD = await import('/js/caras-demo.js'), { jugadoresDemo } = await import('/js/demo.js'), { LS } = await import('/js/util.js');
          const http = async (m, url, { cabeceras } = {}) => { const r = await fetch(url, { headers: cabeceras }); return { s: r.status, b: await r.text() }; };
          const n = await CD.traer(http, jugadoresDemo());
          if (n.casados) { LS.set(CD.CLAVE, n); window.dispatchEvent(new CustomEvent('fm-caras', { detail: n })); }
          return n.casados || 0;
        })()""")
        print('caras casadas:', n)
        if not n: raise SystemExit('Sin caras de LaLiga: no valen las capturas')
        await pg.reload(); await pg.wait_for_timeout(7000)
        for arch, tit, sub, pasos, *_ in pantallas:
            await cerrar_hoja(pg)
            fotos, cortes = [], []
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
                elif tipo == 'medir':
                    cortes.append(await pg.evaluate(x))
                elif tipo == 'dicho':
                    # «te ha dicho cuánto tiene» hace 16 días, con una cifra que deje su dinero en unos 48 M ahora
                    await pg.evaluate(f"""(async () => {{ const {{ LS }} = await import('/js/util.js'), {{ K }} = await import('/js/datos.js');
                      LS.set(K('dinero-dicho'), {{ '{x}': {{ v: 0, r: 0, min: 0, max: 0, t: Date.now() - 16 * 864e5, est: null }} }}); }})()""")
                    await pg.reload(); await pg.wait_for_timeout(6000)
                    await pg.evaluate(f"""(async () => {{ const {{ LS }} = await import('/js/util.js'), {{ K }} = await import('/js/datos.js');
                      const d = window.S.M.dineroDe('{x}'); const v = Math.round((48e6 - d.desdeDicho) / 5e5) * 5e5;
                      LS.set(K('dinero-dicho'), {{ '{x}': {{ v, r: 5e5, min: v - 5e5, max: v + 5e5, t: Date.now() - 16 * 864e5, est: v - 7.5e6 }} }}); }})()""")
                    await pg.reload(); await pg.wait_for_timeout(6000)
                elif tipo == 'foto':
                    await pg.evaluate("document.activeElement && document.activeElement.blur()")
                    try: await pg.wait_for_function("[...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width; }).every((i) => i.complete && i.naturalWidth)", timeout=20000)
                    except Exception: print('OJO: alguna imagen sin cargar en', arch)
                    await pg.wait_for_timeout(500)
                    fotos.append(await pg.screenshot())
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
            # todas las fotos cargadas antes de la foto
            try: await pg.wait_for_function("[...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width; }).every((i) => i.complete && i.naturalWidth)", timeout=20000)
            except Exception: print('OJO: alguna imagen sin cargar en', arch)
            await pg.wait_for_timeout(500)
            fotos = fotos or [await pg.screenshot()]
            await componer(b, arch, tit, sub, fotos, cortes)
            print('hecha', arch, f'({modo})')
        await ctx.close()

async def componer(b, arch, tit, sub, fotos, cortes=()):
    """Un móvil con la captura o, con dos fotos, dos móviles más pequeños, uno al lado del otro y escalonados."""
    imgs = [base64.b64encode(x).decode() for x in fotos]
    fc = base64.b64encode(open('web/fonts/barlow-condensed-700.woff2','rb').read()).decode()
    fr = base64.b64encode(open('web/fonts/barlow-400.woff2','rb').read()).decode()
    if len(imgs) == 1:
        tels = f'<div class="tel"><img src="data:image/png;base64,{imgs[0]}"></div>'
    else:
        # la primera, fundida en negro donde empieza lo que ya enseña la segunda (cortes[0], en px de la pantalla de 770)
        def fundido(i):
            if i or not cortes: return ''
            y = max(0, min(100, cortes[0] / 770 * 100))
            return f'-webkit-mask-image:linear-gradient(#000 {y - 6:.1f}%, transparent {y:.1f}%);'
        tels = ''.join(f'<div class="tel dos" style="left:{15 + i * 535}px;top:{350 + i * 310}px"><img style="{fundido(i)}" src="data:image/png;base64,{x}"></div>' for i, x in enumerate(imgs[:2]))
    html = f"""<html><head><style>
    @font-face {{ font-family: 'BC'; src: url(data:font/woff2;base64,{fc}); }}
    @font-face {{ font-family: 'B'; src: url(data:font/woff2;base64,{fr}); }}
    body {{ margin:0; width:1080px; height:1920px; position:relative; background: radial-gradient(120% 60% at 50% 0%, #4a0c18 0%, #160609 55%, #08080a 100%); color:#f4f2f3; font-family:'B', sans-serif; text-align:center; overflow:hidden }}
    h1 {{ font-family:'BC', sans-serif; font-size:104px; margin:92px 30px 0; letter-spacing:1px; line-height:1 }}
    h1.dos {{ font-size:96px; margin-top:70px }}
    p {{ font-size:44px; margin:22px 0 0; color:#d8d3da }}
    .tel {{ margin:58px auto 0; width:820px; height:1600px; border-radius:64px; background:#1a1a1f; padding:20px; box-sizing:border-box; box-shadow:0 30px 80px rgba(0,0,0,.6) }}
    .tel img {{ width:780px; height:1540px; border-radius:46px; display:block; object-fit:cover; object-position:top }}
    .tel.dos {{ position:absolute; margin:0; width:515px; height:1004px; border-radius:42px; padding:13px }}
    .tel.dos img {{ width:489px; height:966px; border-radius:30px }}
    </style></head><body><h1 class="{'dos' if '<br>' in tit else ''}">{tit}</h1><p>{sub}</p>{tels}</body></html>"""
    pg = await b.new_page(viewport={'width': 1080, 'height': 1920})
    await pg.set_content(html)
    await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'play/{arch}.png')
    await pg.close()

os.makedirs('play', exist_ok=True)
asyncio.run(main(set(sys.argv[1:])))
