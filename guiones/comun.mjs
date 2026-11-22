import fs from 'node:fs';
export const pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs');
export const CARAS = fs.readFileSync('/home/claude/trabajo/caras-demo.json', 'utf8');
export async function abrir({ ancho = 390, alto = 844, movil = true, escala = 2 } = {}) {
  const nav = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'] });
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala, isMobile: movil, hasTouch: movil, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 200)));
  await page.addInitScript(`localStorage.setItem('fm-tour','1'); localStorage.setItem('fm-prueba','true'); localStorage.setItem('fm-sin-tema','1'); localStorage.setItem('fm-beta-aviso', String(Date.now())); localStorage.setItem('fm-caras-demo', ${JSON.stringify(CARAS)});`);
  return { nav, ctx, page };
}
export async function demo(page) {
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForSelector('#vista', { timeout: 30000 });
  await page.waitForTimeout(3000);
}
