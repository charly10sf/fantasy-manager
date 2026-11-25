import { pagina, cerrar } from '../ia/banco.mjs';
const P = await pagina('martes');
const url = P.page.url();
const ctx = P.page.context();
const page = await ctx.newPage();
await page.addInitScript(() => { Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' }); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1'); });
await page.goto(url);
await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
const out = [];
const P2 = await page.evaluate(async () => { const p = await import('./js/puente.js'); return { enIPhone: p.enIPhone, enApp: p.enApp }; });
out.push(`enIPhone ${P2.enIPhone}, enApp ${P2.enApp}`);
for (const vista of ['equipo', 'mercado', 'rivales', 'hoy']) {
  await page.evaluate((v) => { location.hash = '#' + v; }, vista); await page.waitForTimeout(600);
  const claves = await page.evaluate(() => [...new Set([...document.querySelectorAll('#app [data-accion="bloqueada"]')].map((e) => e.dataset.clave + (e.dataset.como ? '/' + e.dataset.como : '')))]);
  for (const k of claves) {
    const [clave] = k.split('/');
    await page.evaluate((clave) => { const e = [...document.querySelectorAll('#app [data-accion="bloqueada"]')].find((x) => x.dataset.clave === clave); if (e) e.click(); }, clave);
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => { const h = document.querySelector('.hoja .bloq-hoja'); return h ? { txt: h.innerText.replace(/\s+/g, ' ').slice(0, 300), play: !!h.querySelector('a[href*="play.google.com"], [data-abrir*="play.google.com"]'), inv: !!h.querySelector('[data-accion="invitarAmigo"]') } : null; });
    out.push(`${vista} · ${k}: ${t ? `«${t.txt}» · botón de Play: ${t.play ? 'sí' : 'no'} · botón de invitar: ${t.inv ? 'sí' : 'no'}` : 'no abre la hoja del candado'}`);
    await page.evaluate(() => window.atras && window.atras()); await page.waitForTimeout(350);
  }
}
console.log([...new Set(out)].join('\n'));
await cerrar();
