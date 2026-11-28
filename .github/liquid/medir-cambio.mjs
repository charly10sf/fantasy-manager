// (0.9b, 28 nov) El cambio de pantalla con movimiento, contra main, con la CPU ×6, alternando vueltas (el ruido entre
// vueltas es grande). Por vuelta y por cada lado: lo que tarda en dejar tocar (de tocar a dos fotogramas pintados, mediana
// de 24 cambios seguidos), el hilo principal por cambio y, cambiando de uno en uno con pausa, los fotogramas de los 500 ms
// de después (cuántos pasan de 50 ms y el más largo). Lo mismo con las sub-pestañas y abriendo y cerrando una ficha.
//   node .github/liquid/medir-cambio.mjs <BASE_main> <BASE_rama> [vueltas=10]
const { chromium } = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , A = 'http://127.0.0.1:8766', B = 'http://127.0.0.1:8765', vueltas = '10'] = process.argv;
const nav = await chromium.launch();
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
async function vuelta(BASE) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('fm-prueba', '1'); localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-beta-aviso', String(Date.now())); } catch (e) { /* nada */ } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await p.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const tarea = async () => (await cdp.send('Performance.getMetrics')).metrics.find((x) => x.name === 'TaskDuration').value;
  const t0 = await tarea();
  const r = await p.evaluate(async () => {
    const dos = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const orden = ['equipo', 'mercado', 'rivales', 'hoy'], seg = [];
    for (let i = 0; i < 24; i++) { const b = document.querySelector(`.nav [data-ir="${orden[i % 4]}"]`); const t = performance.now(); b.click(); await dos(); seg.push(performance.now() - t); }
    // de uno en uno: los fotogramas de los 500 ms de después
    const marcos = async (hacer) => {
      await new Promise((ok) => setTimeout(ok, 700));
      const fr = []; let ult = 0, fin = 0;
      await new Promise((ok) => { const paso = (t) => { if (ult) fr.push(t - ult); ult = t; if (!fin) { fin = t + 500; hacer(); } if (t < fin) requestAnimationFrame(paso); else ok(); }; requestAnimationFrame(paso); });
      return fr;
    };
    const fPest = [], fSec = [], fHoja = [];
    for (let i = 0; i < 6; i++) fPest.push(...await marcos(() => document.querySelector(`.nav [data-ir="${orden[i % 4]}"]`).click()));
    document.querySelector('.nav [data-ir="equipo"]').click();
    for (let i = 0; i < 6; i++) fSec.push(...await marcos(() => { const bs = [...document.querySelectorAll('#vista .tabs-in button[data-seg]')]; const a = bs.findIndex((b) => b.classList.contains('activo')); (bs[(a + 1) % bs.length]).click(); }));
    const M = window.S.M, suyo = [...M.mias].filter((x) => x.j && x.j.pos !== 5)[0];
    const abrir = () => { const b = document.createElement('button'); b.dataset.j = suyo.pid; b.hidden = true; document.body.append(b); b.click(); b.remove(); };
    for (let i = 0; i < 4; i++) { fHoja.push(...await marcos(abrir)); fHoja.push(...await marcos(() => document.querySelector('.velo').click())); }
    const res = (fr) => ({ largos: fr.filter((x) => x > 50).length, max: Math.round(Math.max(0, ...fr)) });
    return { ms: seg, pest: res(fPest), sec: res(fSec), hoja: res(fHoja) };
  });
  const t1 = await tarea();
  await ctx.close();
  return { ms: med(r.ms), cpu: Math.round(((t1 - t0) * 1000) / 24), pest: r.pest, sec: r.sec, hoja: r.hoja };
}
const R = { a: [], b: [] };
for (let v = 0; v < +vueltas; v++) {
  for (const [k, base] of v % 2 ? [['b', B], ['a', A]] : [['a', A], ['b', B]]) { const x = await vuelta(base); R[k].push(x); console.log(v, k === 'a' ? 'main' : 'rama', JSON.stringify(x)); }
}
const sum = (l) => ({ ms: med(l.map((x) => x.ms)), cpu: med(l.map((x) => x.cpu)), largos: { pest: l.reduce((s, x) => s + x.pest.largos, 0), sec: l.reduce((s, x) => s + x.sec.largos, 0), hoja: l.reduce((s, x) => s + x.hoja.largos, 0) }, max: { pest: med(l.map((x) => x.pest.max)), sec: med(l.map((x) => x.sec.max)), hoja: med(l.map((x) => x.hoja.max)) } });
console.log('MAIN', JSON.stringify(sum(R.a)));
console.log('RAMA', JSON.stringify(sum(R.b)));
await nav.close();
