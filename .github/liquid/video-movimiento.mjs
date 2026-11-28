// (0.9c, 28 nov) Los vídeos del movimiento para enseñárselos a Carlos antes de publicar: cada escena dos veces, a velocidad
// real y a cámara lenta (×4, con la velocidad de las animaciones del navegador), en un mp4 con el rótulo debajo.
//   node .github/liquid/video-movimiento.mjs <carpeta> [escenas: pestanas,largo,secciones,fichas,pregunta,abajo,pc] [BASE]
// Con la web servida en local (python3 -m http.server 8765 dentro de web/). SE GRABA CON WEBKIT: el Chromium de aquí (sin
// tarjeta gráfica, también el completo) no pinta bien una animación compuesta: la captura sale con la vista ya en su sitio y
// SIN LA BARRA DE ABAJO mientras dura (comprobado el 28 nov: elementFromPoint dice que la barra está encima, y WebKit la
// pinta bien). La cámara lenta: las animaciones de la API (`animate`) y las transiciones de la app, 4 veces más largas.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const PW = process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs';
const pw = await import(PW);
const [, , carpeta = 'videos', escA = '', BASE = process.env.BASE || 'http://127.0.0.1:8765'] = process.argv;
const TODAS = ['pestanas', 'largo', 'secciones', 'fichas', 'pregunta', 'abajo', 'pc'];
const escenas = escA ? escA.split(',') : TODAS;
fs.mkdirSync(carpeta, { recursive: true });
const tmp = fs.mkdtempSync(`${carpeta}/.crudo-`);
// a cámara lenta, las transiciones del CSS de la app (las que se ven en estas escenas), 4 veces más largas
const LENTO_CSS = (k) => `html.lq { --hoja-ms: ${400 * k}ms; --muelle-ms: ${440 * k}ms; --toque: ${150 * k}ms; }
html.lq .velo.sale { transition-duration: ${260 * k}ms !important; } html.lq .hoja.sale, html.lq:not(.escritorio) .hoja.sale { transition-duration: ${280 * k}ms !important; }
html.lq:not(.escritorio) .hoja.hoja-arriba { transition-duration: ${360 * k}ms, ${220 * k}ms !important; } html.lq:not(.escritorio) .hoja.hoja-arriba.sale { transition-duration: ${240 * k}ms, ${200 * k}ms !important; }
html.lq .aj-sec .av-fl { transition-duration: ${300 * k}ms !important; } html.lq .nav-in { animation-duration: ${240 * k}ms !important; }`;
const CARAS = process.env.CARAS || new URL('./caras.json', import.meta.url).pathname;
const caras = fs.existsSync(CARAS) ? fs.readFileSync(CARAS, 'utf8') : null;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const FUENTE = ['/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', '/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'].find((f) => fs.existsSync(f)) || '';

// el toque, como un círculo que se apaga (fuera de la app: en <body>, encima de todo, sin tocar nada)
const TOQUE = `(() => { addEventListener('click', (e) => { if (!e.isTrusted || (!e.clientX && !e.clientY)) return; const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 2px rgba(255,255,255,.8)';
  d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; document.body.append(d);
  d.animate([{ transform: 'scale(.6)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => d.remove(); }, true); })();`;

async function grabar(nombre, lento, pc = false, ls = {}) {
  const W = pc ? 1280 : 390, H = pc ? 800 : 844;
  const nav = await pw.webkit.launch({ proxy });
  const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: pc ? 1 : 2, hasTouch: !pc, reducedMotion: 'no-preference',
    recordVideo: { dir: tmp, size: pc ? { width: 1280, height: 800 } : { width: 780, height: 1688 } } });
  await ctx.addInitScript(([c, ls, lento]) => {
    try {
      localStorage.setItem('fm-demo', 'true'); localStorage.setItem('fm-tour', String(Date.now())); localStorage.setItem('fm-prueba', '1');
      localStorage.setItem('fm-beta-aviso', String(Date.now())); localStorage.setItem('fm-n-gemini', 'AIzaMAQUETA-no-es-una-clave');
      if (c) localStorage.setItem('fm-caras-demo', c);
      for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
    } catch (e) { /* nada */ }
    // a cámara lenta, lo que quita una hoja cuando ha acabado de irse también espera 4 veces más
    if (lento) {
      const st = window.setTimeout; window.setTimeout = (f, ms, ...r) => st(f, ms === 420 ? ms * lento : ms, ...r);
      const an = Element.prototype.animate;
      Element.prototype.animate = function (kf, o) { const op = typeof o === 'number' ? { duration: o } : { ...(o || {}) }; if (op.duration) op.duration *= lento; if (op.delay) op.delay *= lento; return an.call(this, kf, op); };
    }
  }, [caras, ls, lento]);
  await ctx.addInitScript(TOQUE);
  const p = await ctx.newPage();
  const tv = Date.now();
  p.on('pageerror', (e) => console.log('ERROR', nombre, e.message));
  await p.goto(`${BASE}/index.html`);
  await p.waitForFunction(() => window.S && window.S.M && document.querySelector('.nav'), null, { timeout: 60000 });
  await p.addStyleTag({ content: (lento ? LENTO_CSS(lento) : '') + '\n#vista .fila { content-visibility: visible; }' });
  const k = lento || 1;
  const espera = (ms) => p.waitForTimeout(ms * k);
  // cerrar una hoja: en el móvil, tocando el asa (el velo queda tapado por una hoja entera); en el ordenador, el velo de la izquierda
  const cerrar = async () => { if (pc) await p.mouse.click(160, 420); else await p.locator('.hoja:not(.sale) .asa').first().tap(); };
  const toca = async (sel) => { if (sel === '.velo') return cerrar(); const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (pc) await l.click(); else await l.tap(); };
  await espera(700);
  const t0 = Date.now();
  await ESCENA[nombre](p, toca, espera);
  await espera(500);
  const dur = (Date.now() - t0) / 1000;
  const v = p.video();
  await ctx.close(); await nav.close();
  return { f: await v.path(), dur, ini: (t0 - tv) / 1000 };
}

const ESCENA = {
  // Hoy → Equipo → Rivales → Mercado (a la derecha) y vuelta Equipo → Hoy (a la izquierda); de Hoy a Clubes, de golpe
  async pestanas(p, toca, espera) {
    for (const v of ['equipo', 'rivales', 'mercado', 'equipo', 'hoy', 'clubes', 'directo']) { await toca(`.nav [data-ir="${v}"]`); await espera(950); }
  },
  async largo(p, toca, espera) { await ESCENA.pestanas(p, toca, espera); },
  // las secciones: Equipo y Mercado, a un lado y al otro
  async secciones(p, toca, espera) {
    await toca('.nav [data-ir="equipo"]'); await espera(900);
    const segs = await p.$$eval('#vista .tabs-in button[data-seg]', (bs) => bs.map((b) => b.dataset.seg));
    for (const s of [segs[1], segs[2], segs[3], segs[1], segs[0]].filter(Boolean)) { await toca(`#vista .tabs-in [data-seg="${s}"]`); await espera(900); }
    await toca('.nav [data-ir="rivales"]'); await espera(900);
    const sr = await p.$$eval('#vista .tabs-in button[data-seg]', (bs) => bs.map((b) => b.dataset.seg));
    for (const s of [sr[1], sr[2], sr[0]].filter(Boolean)) { await toca(`#vista .tabs-in [data-seg="${s}"]`); await espera(900); }
  },
  // una ficha sube; desde ella, su club entra desde la derecha; «Volver», la ficha desde la izquierda; se cierra hacia abajo
  async fichas(p, toca, espera) {
    await toca('.nav [data-ir="equipo"]'); await espera(800);
    await toca('#vista [data-j]'); await espera(1300);
    await toca('.hoja [data-club]'); await espera(1300);
    await toca('.hoja [data-accion="volverHoja"]'); await espera(1300);
    await toca('.velo'); await espera(1000);
    await toca('.nav [data-ir="rivales"]'); await espera(800);
    await toca('#vista [data-r]'); await espera(1300);
    await toca('.velo'); await espera(900);
  },
  // Pregunta entra desde arriba y, al dejarla, lo nuevo sube desde abajo; Ajustes baja desde arriba y sus secciones se
  // abren hacia abajo y se cierran hacia arriba
  async pregunta(p, toca, espera) {
    await toca('#bPregunta'); await espera(1100);
    await toca('.nav [data-ir="hoy"]'); await espera(1100);
    await toca('#bAjustes'); await espera(1200);
    // (una abierta cada vez, para que el toque no tenga que desplazar la hoja)
    for (const n of [2, 2, 4, 4]) { await toca(`.hoja details.aj-sec:nth-of-type(${n}) summary`); await espera(1100); }
    await toca('.hoja [data-accion="cerrarHoja"].b-ico'); await espera(1000);
  },
  // la otra forma de Ajustes: sube desde abajo, como las demás hojas
  async abajo(p, toca, espera) {
    await toca('#bAjustes'); await espera(1300);
    await toca('.hoja details.aj-sec:nth-of-type(3) summary'); await espera(1100);
    await toca('.hoja [data-accion="cerrarHoja"].b-ico'); await espera(1000);
  },
  // el ordenador: las pestañas en vertical (arriba y abajo) y las fichas, un panel a la derecha
  async pc(p, toca, espera) {
    for (const v of ['equipo', 'mercado', 'hoy']) { await toca(`.nav [data-ir="${v}"]`); await espera(950); }
    await toca('#vista [data-j]'); await espera(1200);
    const club = await p.$('.hoja [data-club]');
    if (club) { await toca('.hoja [data-club]'); await espera(1200); await toca('.hoja [data-accion="volverHoja"]'); await espera(1200); }
    await toca('.velo'); await espera(900);
  },
};

const LS = { largo: { 'fm-anim': 'largo' }, abajo: { 'fm-ajustes-entra': '"abajo"' } };
const rotulo = (txt) => (FUENTE ? `drawtext=fontfile=${FUENTE}:text='${txt}':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=h-62` : 'null');
for (const e of escenas) {
  const pc = e === 'pc';
  const real = await grabar(e, 0, pc, LS[e] || {});
  const lento = await grabar(e, 4, pc, LS[e] || {});
  const out = `${carpeta}/${e}.mp4`;
  const anchoF = pc ? 1280 : 780;
  // cada trozo: escalado, con una franja debajo para el rótulo; después, los dos seguidos
  const filtro = (i, txt) => `[${i}:v]scale=${anchoF}:-2,pad=iw:ih+90:0:0:0x0b0b0e,${rotulo(txt)},fps=30,format=yuv420p,setsar=1[v${i}]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, real.ini - 0.2)), '-i', real.f, '-ss', String(Math.max(0, lento.ini - 0.2)), '-i', lento.f,
    '-filter_complex', `${filtro(0, 'Velocidad real')};${filtro(1, 'Cámara lenta (x4)')};[v0][v1]concat=n=2:v=1[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', out]);
  console.log(`${out}: ${real.dur.toFixed(1)} s + ${lento.dur.toFixed(1)} s`);
}
fs.rmSync(tmp, { recursive: true, force: true });
