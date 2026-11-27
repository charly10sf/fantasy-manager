// (rediseño «Liquid», maqueta) rendimiento con la CPU frenada ×6, en cada dirección y en la app de hoy (M, la capa vacía):
//  1. el cambio de pestaña, como en el overhaul (claude/overhaul.md, tanda 8): 80 cambios seguidos entre Hoy, Equipo,
//     Mercado y Rivales; mediana del tiempo hasta el segundo fotograma y tiempo de CPU por cambio (Performance.getMetrics);
//  2. los fotogramas por segundo desplazando Mercado con la barra encima (requestAnimationFrame), 4 s bajando y subiendo.
//   node .github/liquid/medir.mjs [dirs=M,D,B,A,C] [opciones de la dirección, p. ej. bl=12 o sc=1] [densidad=2]
// OJO: aquí Chromium compone por software (sin tarjeta gráfica): el desenfoque lo paga la CPU y sale MÁS caro que en un
// móvil, donde lo hace la GPU. Vale para comparar direcciones entre sí, no como cifra de un móvil.
const PW = process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const [, , dirsA = 'M,D,B,A,C', extra = '', dsf = '2'] = process.argv;
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const nav = await chromium.launch();
const mediana = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
for (const d of dirsA.split(',')) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +dsf, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('fm-prueba', '1'); } catch (e) { /* nada */ } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/maqueta-liquid.html?dentro=1&d=${d}&p=hoy&top=1${extra ? `&${extra}` : ''}`);
  await p.waitForFunction(() => document.documentElement.classList.contains('maq-lista'), null, { timeout: 60000 });
  await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const cpu = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const v = (n) => m.find((x) => x.name === n).value; return { tarea: v('TaskDuration'), guion: v('ScriptDuration'), estilo: v('RecalcStyleDuration') + v('LayoutDuration') }; };
  // 1. cambio de pestaña
  const c0 = await cpu();
  const ts = await p.evaluate(async () => {
    const orden = ['equipo', 'mercado', 'rivales', 'hoy'], out = [];
    const dos = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    for (let i = 0; i < 80; i++) { const b = document.querySelector(`.nav [data-ir="${orden[i % 4]}"]`); const t = performance.now(); b.click(); await dos(); out.push(performance.now() - t); }
    return out;
  });
  const c1 = await cpu();
  // 2. desplazar Mercado
  await p.evaluate(() => document.querySelector('.nav [data-ir="mercado"]').click());
  await p.waitForTimeout(900);
  const fps = await p.evaluate(() => new Promise((ok) => {
    const el = document.scrollingElement, tope = Math.min(el.scrollHeight - el.clientHeight, 2600), dur = 4000, fr = []; let t0 = 0, ult = 0;
    const paso = (t) => {
      if (!t0) { t0 = t; ult = t; } else { fr.push(t - ult); ult = t; }
      const k = (t - t0) / dur; el.scrollTop = tope * (k < 0.5 ? k * 2 : 2 - k * 2);
      if (k < 1) requestAnimationFrame(paso); else { const s = [...fr].sort((a, b) => a - b); ok({ fps: Math.round((fr.length / dur) * 10000) / 10, p95: Math.round(s[Math.floor(s.length * 0.95)]), largos: fr.filter((x) => x > 25).length, n: fr.length }); }
    };
    requestAnimationFrame(paso);
  }));
  const mem = await p.evaluate(() => `${navigator.deviceMemory} GB · ${navigator.hardwareConcurrency} núcleos`);
  console.log(`${d}${extra ? ` (${extra})` : ''}: pestaña ${Math.round(mediana(ts))} ms de mediana · CPU por cambio ${Math.round(((c1.tarea - c0.tarea) / 80) * 1000)} ms (guion ${Math.round(((c1.guion - c0.guion) / 80) * 1000)}, estilo y maquetado ${Math.round(((c1.estilo - c0.estilo) / 80) * 1000)}) · Mercado ${fps.fps} fps (p95 ${fps.p95} ms, ${fps.largos} de ${fps.n} fotogramas de más de 25 ms) · ${mem}`);
  await ctx.close();
}
await nav.close();
