// (rediseño «Liquid», maqueta) capturas de web/maqueta-liquid.html: cada dirección en cada pantalla, arriba del todo y
// desplazada, a 390×844. Con la web servida en local (python3 -m http.server 8765 dentro de web/):
//   node .github/liquid/capturas.mjs <carpeta> [dirs=A,B,C,D,M] [motor=chromium|webkit] [pantallas] [opciones: sc,n2,tx160,w320,rt,pc]
// CARAS=<caras.json de caras.mjs> mete las caras y los escudos de la liga de ejemplo sin esperar a LaLiga.
import fs from 'node:fs';
const PW = process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs';
const pw = await import(PW);
const [, , carpeta = 'cap', dirsA = 'A,B,C,D,M', motor = 'chromium', pantsA = '', opA = ''] = process.argv;
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const TODAS = ['hoy', 'equipo', 'directo', 'rivales', 'mercado', 'clubes', 'ficha', 'rival', 'pregunta', 'ajustes', 'carga', 'top', 'barra'];
const pants = pantsA ? pantsA.split(',') : TODAS;
const op = new Set(opA.split(',').filter(Boolean));
const ancho = [...op].find((o) => /^w\d+$/.test(o)), W = ancho ? +ancho.slice(1) : 390, H = 844, TECLADO = 300;
const tx = [...op].find((o) => /^tx\d+$/.test(o));
const caras = process.env.CARAS ? fs.readFileSync(process.env.CARAS, 'utf8') : null;
fs.mkdirSync(carpeta, { recursive: true });

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const nav = await pw[motor].launch({ proxy });
const contexto = async () => { const ctx = await nav.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: motor === 'webkit' ? 3 : 2, isMobile: true, hasTouch: true,
  userAgent: motor === 'webkit' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1' : undefined,
  reducedMotion: 'no-preference',
  ...(op.has('rt') && motor === 'chromium' ? {} : {}),
  ...(op.has('pc') ? { forcedColors: 'none', contrast: 'more' } : {}),
});
await ctx.addInitScript((c) => { try { localStorage.setItem('fm-prueba', '1'); if (c) localStorage.setItem('fm-caras-demo', c); } catch (e) { /* nada */ } }, caras);
  return ctx; };
// las capturas, quietas: sin la animación de entrada de cada pestaña
const QUIETO = '#vista, #vista * { animation-duration: 0s !important; animation-delay: 0s !important; } #vista .fila { content-visibility: visible !important; }';

for (const d of dirsA.split(',')) {
  for (const top of [1, 0]) {
    const mias = pants.filter((p) => (p === 'top') === !top);
    if (!mias.length) continue;
    const ctx = await contexto(), p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('ERROR', d, e.message));
    if (op.has('rt')) { const s = await ctx.newCDPSession(p); await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] }); }
    await p.goto(`${BASE}/maqueta-liquid.html?dentro=1&d=${d}&p=hoy${top ? '&top=1' : ''}${motor === 'chromium' ? '&cap=1' : ''}${op.has('sc') ? '&sc=1' : ''}${op.has('n2') ? '&n=2' : ''}${tx ? `&tx=${tx.slice(2)}` : ''}`);
    await p.waitForFunction(() => document.documentElement.classList.contains('maq-lista'), null, { timeout: 60000 });
    await p.addStyleTag({ content: QUIETO });
    for (const pa of mias) {
      for (const y of pa === 'barra' ? [1] : pa === 'carga' || pa === 'top' || pa === 'pregunta' ? [0] : [0, 1]) {
        await p.setViewportSize({ width: W, height: pa === 'pregunta' ? H - TECLADO : H });
        await p.evaluate(([a, b]) => window.maq.ver(a, b), [pa, y]);
        await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(pa === 'barra' ? 700 : 350);
        const f = `${carpeta}/${d}-${pa}${y && pa !== 'barra' ? '-y' : ''}.png`;
        await p.screenshot({ path: f });
        console.log(f);
      }
    }
    await ctx.close();
  }
}
await nav.close();
