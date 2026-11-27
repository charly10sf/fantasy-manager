// (0.9) Las caras de la liga de ejemplo: CARAS=<caras.json de caras.mjs>. Opciones nuevas: nofoto (solo comprueba), inv (la tarjeta de invitar).
// Capturas de la app de verdad (la liga de ejemplo) en cada pantalla, arriba del todo y desplazada.
//   node .github/liquid/capturas.mjs <carpeta> [pantallas=todas] [opciones: w390,h844,pc,webkit,tx160,sc,rt,cm,top,cap,sinY,soloY,e2] [BASE]
// Con la web servida en local (python3 -m http.server 8765 dentro de web/). CARAS=<caras.json>.
import fs from 'node:fs';
const PW = process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs';
const pw = await import(PW);
const [, , carpeta = 'cap', pantsA = '', opA = '', BASE = process.env.BASE || 'http://127.0.0.1:8765'] = process.argv;
export const TODAS = ['hoy', 'equipo', 'directo', 'rivales', 'mercado', 'clubes', 'ficha', 'rival', 'pregunta', 'ajustes', 'top', 'barra'];
const pants = pantsA && pantsA !== '-' ? pantsA.split(',') : TODAS;
const op = new Set(opA.split(',').filter(Boolean));
const num = (pre, d) => { const o = [...op].find((x) => new RegExp(`^${pre}\\d+$`).test(x)); return o ? +o.slice(pre.length) : d; };
const PC = op.has('pc');
const W = num('w', PC ? 1280 : 390), H = num('h', PC ? 800 : 844), TECLADO = 300, tx = num('tx', 0);
const motor = op.has('webkit') ? 'webkit' : 'chromium';
const CARAS = process.env.CARAS || new URL('./caras.json', import.meta.url).pathname;
const caras = fs.existsSync(CARAS) ? fs.readFileSync(CARAS, 'utf8') : null;
fs.mkdirSync(carpeta, { recursive: true });

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const nav = await pw[motor].launch({ proxy });
const ctx = await nav.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: PC ? 1 : num('e', 2), isMobile: !PC, hasTouch: !PC,
  userAgent: motor === 'webkit' && !PC ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1' : undefined,
  reducedMotion: 'no-preference', ...(op.has('cm') ? { contrast: 'more' } : {}),
});
await ctx.addInitScript((c) => {
  try {
    localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-prueba', '1');
    localStorage.setItem('fm-beta-aviso', String(Date.now()));
    if (c) localStorage.setItem('fm-caras-demo', c);
    if (!localStorage.getItem('fm-n-gemini')) localStorage.setItem('fm-n-gemini', 'AIzaMAQUETA-no-es-una-clave');
  } catch (e) { /* nada */ }
}, caras);
if (op.has('top')) await ctx.route(/limites\.json/, async (r) => { const res = await r.fetch(); let j = {}; try { j = await res.json(); } catch (e) { /* nada */ } j.bloqueadas = []; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
// (solo para ver la tarjeta de invitar de Ajustes en la liga de ejemplo) hojas.js con la condición de la tarjeta abierta
if (op.has('inv')) await ctx.route(/js\/hojas\.js/, async (r) => { const res = await r.fetch(); let t = await res.text(); t = t.replace("if (!enDemo() && ses && invitarOn()) {\n    const uid = S.D && S.D.yo && S.D.yo.userId, ei = estadoInv(uid)", "if (true) {\n    const uid = S.D && S.D.yo && S.D.yo.userId, ei = estadoInv(uid)"); await r.fulfill({ status: 200, contentType: 'text/javascript', body: t }); });
const QUIETO = '#vista, #vista * { animation-duration: 0s !important; animation-delay: 0s !important; } #vista .fila { content-visibility: visible !important; }';
// (solo capturas) un Chromium sin tarjeta gráfica pinta mal el desenfoque de un cristal bajo: se alarga y se recorta
const CAPTURA = fs.existsSync(new URL('./captura.css', import.meta.url)) ? fs.readFileSync(new URL('./captura.css', import.meta.url), 'utf8') : '';

const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => { errores.push(e.message); console.log('ERROR', e.message); });
if (op.has('rt')) { const s = await ctx.newCDPSession(p); await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] }); }
await p.goto(`${BASE}/index.html`);
await p.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 60000 });
if (tx) await p.evaluate((v) => { for (const k of ['text-size-adjust', '-webkit-text-size-adjust']) document.documentElement.style.setProperty(k, `${v}%`, 'important'); window.dispatchEvent(new Event('resize')); }, tx);
if (op.has('sc')) await p.evaluate(() => document.documentElement.classList.add('sin-cristal'));
await p.addStyleTag({ content: QUIETO });
if (op.has('cap') && CAPTURA && motor === 'chromium') { await p.addStyleTag({ content: CAPTURA }); await p.evaluate(() => document.documentElement.classList.add('fm-captura')); }
await p.evaluate(() => {
  const S = window.S, M = S.M, html = document.documentElement;
  const clic = (sel) => { const b = document.querySelector(sel); if (b) b.click(); return !!b; };
  const abrir = (attr, id) => { const b = document.createElement('button'); b.dataset[attr] = id; b.hidden = true; document.body.append(b); b.click(); b.remove(); };
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const suyo = [...M.mias].filter((x) => x.j && x.j.pos !== 5).sort((a, b) => b.j.valor - a.j.valor)[0];
  async function desplazar() {
    const h = document.querySelector('.hoja.on');
    const el = h || document.scrollingElement;
    const tope = el.scrollHeight - el.clientHeight;
    const y = Math.min(tope, Math.max(260, Math.round(tope * 0.34)));
    for (let i = 1; i <= 6; i++) { el.scrollTo(0, Math.round((y * i) / 6)); await espera(40); }
  }
  window.cap = async (pa, y) => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    for (let i = 0; i < 4 && document.querySelector('.hoja'); i++) { clic('[data-accion="cerrarHoja"]') || clic('.velo'); await espera(340); }
    window.scrollTo(0, 0);
    const base = { ficha: 'equipo', rival: 'rivales', ajustes: 'hoy', top: 'rivales', barra: 'mercado', pregunta: 'hoy' }[pa] || pa;
    clic(`.nav [data-ir="${base}"]`);
    await espera(150);
    if (pa === 'rivales') { clic('[data-seg="rivales:parte"]'); await espera(120); }
    if (pa === 'ficha' && suyo) abrir('j', suyo.pid);
    if (pa === 'rival' || pa === 'top') { clic('.tabs [data-seg^="rivales:"]'); await espera(120); }
    if (pa === 'rival') clic('#vista [data-r]');
    if (pa === 'ajustes') clic('#bAjustes');
    if (pa === 'pregunta') { clic('#bPregunta'); await espera(250); const t = document.querySelector('.escribe textarea'); if (t) t.focus(); }
    if (pa === 'top') clic('#vista [data-accion="bloqueada"]');
    if (['ficha', 'rival', 'ajustes', 'top'].includes(pa)) for (let i = 0; i < 25 && !document.querySelector('.hoja.on'); i++) await espera(80);
    await espera(420);
    if (y) { await desplazar(); if (pa !== 'barra') { await espera(60); document.querySelector('.nav').classList.remove('nav-min'); } }
    // (solo capturas) el cristal de las dos cápsulas de la cabecera, en dos elementos sueltos alargados y recortados
    if (html.classList.contains('fm-captura') && !html.classList.contains('escritorio')) {
      const liga = document.querySelector('.sup-liga'), btns = document.querySelector('.sup-btns');
      if (liga && btns) {
        window.__caps ||= [0, 1].map(() => { const d = document.createElement('div'); d.className = 'fm-capsula'; document.body.append(d); return d; });
        const W = window.innerWidth;
        const caja = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el, '::before'), n = (v) => parseFloat(v) || 0; return [r.left + n(c.left), r.top + n(c.top), r.right - n(c.right), r.bottom - n(c.bottom)]; };
        [caja(liga), caja(btns)].forEach(([x0, y0, x1, y1], i) => {
          const iz = Math.min(60, Math.max(0, x0)), de = Math.min(60, Math.max(0, W - x1)), ar = Math.min(60, Math.max(0, y0)), ab = 60;
          window.__caps[i].style.cssText = `left:${x0 - iz}px;top:${y0 - ar}px;width:${x1 - x0 + iz + de}px;height:${y1 - y0 + ar + ab}px;clip-path:inset(${ar}px ${de}px ${ab}px ${iz}px round 28px)`;
        });
      }
    }
    // lo que se sale de lado
    const de = document.scrollingElement;
    const prob = [];
    const W = window.innerWidth, movil = !html.classList.contains('escritorio');
    const caja2 = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el, '::before'), n = (v) => parseFloat(v) || 0; return { l: r.left + n(c.left), t: r.top + n(c.top), r: r.right - n(c.right), b: r.bottom - n(c.bottom) }; };
    if (movil) {
      const liga = document.querySelector('.sup-liga'), btns = document.querySelector('.sup-btns');
      if (liga && btns) {
        const a = caja2(liga), b = caja2(btns);
        if (a.r > b.l - 3) prob.push(`las cápsulas se pisan o se pegan (${Math.round(a.r)} / ${Math.round(b.l)})`);
        if (a.l < 3 || b.r > W - 3) prob.push(`una cápsula toca el borde (${Math.round(a.l)}, ${Math.round(W - b.r)})`);
        const tx = document.querySelector('#supEstado > .sup-tx');
        if (tx && tx.scrollWidth > tx.clientWidth + 1 && !html.classList.contains('est-corta')) prob.push('el estado sale cortado');
        const est = document.querySelector('#supEstado'), pts = document.querySelector('.sup-pts:not([hidden])');
        if (est && pts && getComputedStyle(pts).display !== 'none' && est.getBoundingClientRect().right > pts.getBoundingClientRect().left) prob.push('el estado se monta sobre los puntos');
        for (const bt of btns.querySelectorAll('.b-ico:not([hidden])')) { const r = bt.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) prob.push(`botón pequeño ${bt.id} ${Math.round(r.width)}×${Math.round(r.height)}`); }
      }
      const nav = document.querySelector('.nav-in');
      if (nav && !document.querySelector('.hoja') && !html.classList.contains('escribiendo')) {
        const r = nav.getBoundingClientRect();
        if (r.left < 2 || r.right > W - 2 || r.bottom > window.innerHeight - 2) prob.push('la barra toca el borde');
        for (const bt of nav.querySelectorAll('button')) if (bt.scrollWidth > bt.clientWidth + 1) prob.push(`etiqueta cortada en la barra: ${bt.textContent.trim()}`);
      }
    }
    for (const t of document.querySelectorAll('.tabs-in.con-pil')) {
      const act = t.querySelector('button.activo'); if (!act) continue;
      const px = parseFloat(t.style.getPropertyValue('--px')), pw = parseFloat(t.style.getPropertyValue('--pw'));
      if (Math.abs(px - act.offsetLeft) > 1 || Math.abs(pw - act.offsetWidth) > 1) prob.push(`la píldora no está en su pestaña (${px}/${act.offsetLeft})`);
    }

    // texto que se sale de su caja en lo que más se rompe
    for (const el of document.querySelectorAll('.marcador b, .marcador span, .cierre .v, .plan-eti, .eq2-num b, .tabs button, .titulo, .hoja-cab h2')) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && getComputedStyle(el).textOverflow !== 'ellipsis') prob.push(`texto cortado: ${(el.className || el.tagName)} «${el.textContent.trim().slice(0, 30)}»`);
    }
    return { fuera: de.scrollWidth - de.clientWidth, prob };
  };
});
for (const pa of pants) {
  const ys = pa === 'barra' ? [1] : pa === 'top' || pa === 'pregunta' ? [0] : op.has('sinY') ? [0] : op.has('soloY') ? [1] : [0, 1];
  for (const y of ys) {
    await p.setViewportSize({ width: W, height: pa === 'pregunta' && !PC ? H - TECLADO : H });
    const r = await p.evaluate(([a, b]) => window.cap(a, b), [pa, y]);
    await p.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(pa === 'barra' ? 700 : 350);
    const f = `${carpeta}/${pa}${y && pa !== 'barra' ? '-y' : ''}.png`;
    if (!op.has('nofoto')) await p.screenshot({ path: f });
    if (r.fuera > 1 || r.prob.length || !op.has('nofoto')) console.log(f, r.fuera > 1 ? `SE SALE DE LADO ${r.fuera}px` : '', r.prob.join(' · '));
  }
}
await nav.close();
if (errores.length) { console.log(`${errores.length} errores de la página`); process.exitCode = 1; }
