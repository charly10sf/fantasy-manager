import fs from 'node:fs';
import { abrir, pw } from './comun.mjs';
const ir = async (page, puerto) => { await page.goto(`http://127.0.0.1:${puerto}/index.html`); await page.waitForSelector('#vista', { timeout: 30000 }); await page.waitForTimeout(3000);
  await page.evaluate(() => document.querySelector('[data-ir="clubes"]').click()); await page.waitForTimeout(900); };
for (const [n, puerto] of [['antes', 8766], ['ahora', 8765]]) {
  // 1. el final de Clubes, con el aspecto normal
  let { nav, page } = await abrir();
  await ir(page, puerto);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(500);
  await page.screenshot({ path: `img/aa-clubes-${n}.png`, clip: { x: 0, y: 844 - 500, width: 390, height: 500 } });
  // 3. el resultado, con el mismo marcado de la app y un rival de nombre largo, en un móvil de 360 de ancho
  await page.setViewportSize({ width: 360, height: 760 }); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#vista .club-f[data-club]').click()); await page.waitForTimeout(900);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Partidos/.test(x.textContent.trim()) && x.offsetParent); if (b) b.click(); }); await page.waitForTimeout(700);
  const montar = (rival) => page.evaluate((rival) => {
    const sec = document.querySelector('#club-jornadas'); if (!sec) return null;
    document.querySelector('#pr-jc')?.remove(); if (sec.nextElementSibling?.classList.contains('vacio') || /ejemplo/.test(sec.nextElementSibling?.textContent || '')) sec.nextElementSibling.remove();
    const casa = '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v10H3z"/></svg>';
    const fl = (d) => `<button class="jor-fl" aria-label="x"><svg class="ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M${d ? 9 : 15} 5l${d ? 7 : -7} 7 ${d ? -7 : 7} 7"/></svg></button>`;
    sec.insertAdjacentHTML('afterend', `<div id="pr-jc" class="jor-cab">${fl(0)}<div class="jor-t"><b>Jornada 12</b><span>${casa}${rival} <b class="cp-res-t r-G">2-1</b></span></div>${fl(1)}</div>`);
    const c = document.querySelector('#pr-jc'); c.scrollIntoView({ block: 'center' });
    const r = sec.getBoundingClientRect(), k = c.getBoundingClientRect(), b = c.querySelector('.cp-res-t').getBoundingClientRect();
    return { y: Math.max(0, r.top - 10), h: k.bottom - r.top + 24, alto: Math.round(b.height), rival };
  }, rival);
  let caja = null;
  const lista = n === 'antes' ? ['Atlético de Madrid', 'Rayo Vallecano de Madrid', 'Deportivo de La Coruña', 'Real Sociedad de Fútbol', 'Real Racing Club de Santander'] : [fs.readFileSync('/tmp/rival.txt', 'utf8')];
  for (const rv of lista) { caja = await montar(rv); if (!caja || caja.alto > 25 || n === 'ahora') break; }
  if (n === 'antes' && caja) fs.writeFileSync('/tmp/rival.txt', caja.rival);
  console.log(n, 'resultado', JSON.stringify(caja));
  if (caja) await page.screenshot({ path: `img/aa-res-${n}.png`, clip: { x: 0, y: caja.y, width: 360, height: caja.h } });
  await nav.close();
  // 2. la barra de abajo con el tema del evento, que es donde sale el circulito
  ({ nav, page } = await abrir());
  await page.addInitScript(`localStorage.removeItem('fm-sin-tema'); localStorage.setItem('fm-tema-aviso', String(Date.now()))`);
  await ir(page, puerto);
  await page.waitForTimeout(2500);
  const tema = await page.evaluate(() => (document.documentElement.dataset.tema || 'sin tema') + ' velo:' + !!document.querySelector('.tour'));
  console.log(n, 'tema', tema);
  await page.screenshot({ path: `img/aa-nav-${n}.png`, clip: { x: 0, y: 844 - 150, width: 390, height: 150 } });
  await nav.close();
}
// la lámina
const F = '/home/claude/charly10sf/fantasy-manager/web/fonts', b64 = (f) => fs.readFileSync(f).toString('base64'), im = (f) => `data:image/png;base64,${b64(`img/${f}.png`)}`;
const par = (f, w) => `<div class="par">${['antes', 'ahora'].map((n) => `<figure><figcaption class="${n}">${n === 'antes' ? 'Antes' : 'Ahora'}</figcaption><img src="${im(`${f}-${n}`)}" style="width:${w}px"></figure>`).join('')}</div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:BC;font-weight:700;src:url(data:font/woff2;base64,${b64(`${F}/barlow-condensed-700.woff2`)})}
@font-face{font-family:B;font-weight:400;src:url(data:font/woff2;base64,${b64(`${F}/barlow-400.woff2`)})}
@font-face{font-family:B;font-weight:600;src:url(data:font/woff2;base64,${b64(`${F}/barlow-600.woff2`)})}
*{box-sizing:border-box;margin:0}body{background:#08080a;color:#f4f4f6;font:400 21px/1.35 B,sans-serif;padding:40px 44px;width:912px}
h1{font:700 52px/1 BC;text-transform:uppercase;display:flex;align-items:center;gap:16px}h1::before{content:'';width:18px;height:48px;background:#ee1c3c;transform:skewX(-14deg)}
.sub{color:#a9a9b3;margin:10px 0 8px 34px}
h2{font:700 34px/1.1 BC;text-transform:uppercase;margin:38px 0 6px;display:flex;gap:14px;align-items:center}h2 i{font-style:normal;background:#f4f4f6;color:#08080a;border-radius:8px;width:40px;height:40px;display:grid;place-items:center;flex:none}
p{color:#c9c9d1;margin:0 0 16px 54px}
.par{display:flex;gap:24px}figure{flex:none}figcaption{font:700 22px/1 BC;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;border-radius:8px 8px 0 0;background:#1b1b21;color:#a9a9b3}
figcaption.ahora{background:#143524;color:#5fe0a0}img{display:block;border:2px solid #1b1b21;border-top:0;border-radius:0 0 10px 10px}figcaption.ahora+img{border-color:#143524}
</style><h1>Clubes · antes y ahora</h1><div class="sub">Versión 0.8r, sin publicar. Con la liga de ejemplo.</div>
<h2><i>1</i>La clasificación, sin nada debajo</h2><p>Fuera la leyenda de colores y su frase. Cada club ya lleva escrito «Champions», «Descenso»…</p>${par('aa-clubes', 400)}
<h2><i>2</i>La barra de abajo, sin la marca</h2><p>Con el tema de estos días salía un circulito bajo la pestaña elegida (y sin el tema, una rayita, como se ve arriba).</p>${par('aa-nav', 400)}
<h2><i>3</i>El resultado, en una línea</h2><p>Ficha de un club → Partidos → Jornada a jornada. Montado con el mismo marcado de la app y un rival de nombre largo, en un móvil estrecho (360): en la liga de ejemplo ese bloque no sale.</p>${par('aa-res', 400)}`;
const nav = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome' }); const pg = await (await nav.newContext({ viewport: { width: 912, height: 800 }, deviceScaleFactor: 1.5 })).newPage();
await pg.setContent(html); await pg.waitForTimeout(500); await pg.screenshot({ path: '/mnt/user-data/outputs/clubes-antes-ahora.png', fullPage: true }); await nav.close();
