"""Las capturas de la ficha de Google Play (1080 x 1920) con la liga de ejemplo.
Uso: en web/, `python3 -m http.server 8765`; desde la raíz del repo, `python3 .github/capturas-play.py`.
Las deja en play/. Sin fotos de LaLiga: en local no cargan y salen las iniciales (lo que queremos en Play)."""
import asyncio, base64
from playwright.async_api import async_playwright
# (archivo, título, subtítulo, cómo llegar)
PANTALLAS = [
  ('captura-1-hoy', 'QUÉ HACER HOY', 'en tu liga, nada más abrirla', "ir:hoy"),
  ('captura-2-plan', 'PASO A PASO', 'con el saldo después de cada operación', "ir:hoy|scroll:.plan"),
  ('captura-7-ficha', 'CADA JUGADOR, A FONDO', 'forma, rival, valor y quién lo puede pagar', "ir:equipo|seg:equipo:plantilla|abrir:[data-j]"),
  ('captura-3-clausulas', 'CLÁUSULAS A TU ALCANCE', 'cuáles te llegan y cuándo se abren', "ir:rivales|seg:rivales:clausulas"),
  ('captura-4-mercado', 'CUÁNTO PUJAR', 'según lo que se paga en tu liga', "ir:mercado"),
  ('captura-5-equipo', 'TU MEJOR ONCE', 'con el calendario de cada jugador', "ir:equipo|seg:equipo:plantilla"),
  ('captura-8-rivales', 'LO QUE HACE CADA RIVAL', 'fichajes, ventas y clausulazos al momento', "ir:rivales|seg:rivales:movimientos"),
  ('captura-9-directo', 'LA JORNADA EN DIRECTO', 'tus jugadores y sus puntos, al minuto', "ir:directo"),
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 390, 'height': 770}, device_scale_factor=2)
        await pg.add_init_script("localStorage.setItem('fm-tour','1')")
        await pg.goto('http://localhost:8765/')
        await pg.wait_for_timeout(7000)
        for arch, tit, sub, como in PANTALLAS:
            pasos = dict(x.split(':', 1) for x in como.split('|'))
            if 'seg' in pasos:
                v, s_ = pasos['seg'].split(':')
                await pg.evaluate(f"window.S.seg['{v}'] = '{s_}'")
            await pg.evaluate(f"document.querySelector('[data-ir=\"{pasos['ir']}\"]').click()")
            await pg.wait_for_timeout(1200)
            if 'seg' in pasos:
                v, s = pasos['seg'].split(':')
                await pg.evaluate(f"(() => {{ const b = document.querySelector('[data-seg=\"{v}:{s}\"]') || [...document.querySelectorAll('[data-seg]')].find((x) => x.dataset.seg.endsWith(':{s}')); if (b) b.click(); }})()")
                await pg.wait_for_timeout(1000)
            await pg.evaluate("window.scrollTo(0,0)")
            if 'scroll' in pasos:
                await pg.evaluate(f"(() => {{ const e = document.querySelector('{pasos['scroll']}'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }})()")
                await pg.wait_for_timeout(500)
            if 'abrir' in pasos:
                await pg.evaluate(f"(() => {{ const e = [...document.querySelectorAll('{pasos['abrir']}')].find((x) => x.offsetParent); if (e) e.click(); }})()")
                await pg.wait_for_timeout(1500)
            png = await pg.screenshot()
            if 'abrir' in pasos:
                await pg.evaluate("(() => { const b = document.querySelector('[data-accion=\"cerrarHoja\"], .hoja-x, [aria-label=\"Cerrar\"]'); if (b) b.click(); })()")
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
            await componer(b, arch, tit, sub, png)
            print('hecha', arch)
        await b.close()
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
import os; os.makedirs('/home/claude/pruebas/play', exist_ok=True)
asyncio.run(main())
