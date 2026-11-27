// rendimiento con la CPU ×6: cambio de pestaña y fps desplazando Mercado. node .github/liquid/medir.mjs <BASE> [veces=1] [sc]
const { chromium } = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , BASE = 'http://127.0.0.1:8765', veces = '1', opc = ''] = process.argv;
const nav = await chromium.launch();
const mediana = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const R = [];
for (let v = 0; v < +veces; v++) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((o) => { try { localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-beta-aviso', String(Date.now())); if (o === 'sc') localStorage.setItem('fm-cristal', 'no'); } catch (e) { /* nada */ } }, opc);
  await ctx.route(/limites\.json/, async (r) => { const res = await r.fetch(); let j = {}; try { j = await res.json(); } catch (e) { /* nada */ } j.bloqueadas = []; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
  if (process.env.CSS) await ctx.route(/css\/app\.css/, async (r) => r.fulfill({ status: 200, contentType: 'text/css', body: (await import('node:fs')).readFileSync(process.env.CSS, 'utf8') }));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await p.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const cpu = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = (n) => m.find((x) => x.name === n).value; return { tarea: g('TaskDuration'), guion: g('ScriptDuration'), estilo: g('RecalcStyleDuration') + g('LayoutDuration') }; };
  const c0 = await cpu();
  const ts = await p.evaluate(async () => {
    const orden = ['equipo', 'mercado', 'rivales', 'hoy'], out = [];
    const dos = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    for (let i = 0; i < 80; i++) { const b = document.querySelector(`.nav [data-ir="${orden[i % 4]}"]`); const t = performance.now(); b.click(); await dos(); out.push(performance.now() - t); }
    return out;
  });
  const c1 = await cpu();
  await p.evaluate(() => document.querySelector('.nav [data-ir="mercado"]').click());
  await p.waitForTimeout(900);
  const fps = await p.evaluate(() => new Promise((ok) => {
    const el = document.scrollingElement, tope = Math.min(el.scrollHeight - el.clientHeight, 2600), dur = 4000, fr = []; let t0 = 0, ult = 0;
    const paso = (t) => {
      if (!t0) { t0 = t; ult = t; } else { fr.push(t - ult); ult = t; }
      const k = (t - t0) / dur; el.scrollTop = tope * (k < 0.5 ? k * 2 : 2 - k * 2);
      if (k < 1) requestAnimationFrame(paso); else ok({ fps: Math.round((fr.length / dur) * 10000) / 10, largos: fr.filter((x) => x > 25).length });
    };
    requestAnimationFrame(paso);
  }));
  const r = { ms: Math.round(mediana(ts)), cpu: Math.round(((c1.tarea - c0.tarea) / 80) * 1000), guion: Math.round(((c1.guion - c0.guion) / 80) * 1000), estilo: Math.round(((c1.estilo - c0.estilo) / 80) * 1000), fps: fps.fps, largos: fps.largos };
  R.push(r); console.log(BASE.slice(-4), opc, JSON.stringify(r));
  await ctx.close();
}
if (R.length > 1) console.log(BASE.slice(-4), opc, 'MEDIANA', JSON.stringify(Object.fromEntries(Object.keys(R[0]).map((k) => [k, mediana(R.map((x) => x[k]))]))));
await nav.close();
