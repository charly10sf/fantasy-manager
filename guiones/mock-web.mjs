import fs from 'node:fs';
import { pw } from './comun.mjs';
const CAL = JSON.parse(fs.readFileSync('img/calendario.json', 'utf8'));
const ESC = JSON.parse(fs.readFileSync('/home/claude/charly10sf/fantasy-manager/.github/portal/escudos.json', 'utf8'));
const SIG = { 'Alavés': 'ALA', Athletic: 'ATH', 'Atlético': 'ATM', 'Barça': 'BAR', Betis: 'BET', Celta: 'CEL', Deportivo: 'DEP', Elche: 'ELC', Espanyol: 'ESP', Getafe: 'GET', Levante: 'LEV', 'Málaga': 'MLG', Osasuna: 'OSA', Racing: 'RAC', Rayo: 'RAY', 'Real Madrid': 'RMA', 'Real Sociedad': 'RSO', Sevilla: 'SEV', Valencia: 'VAL', Villarreal: 'VIL' };
const CSS = `.nuevo{outline:2px dashed #ff4d6a;outline-offset:5px;border-radius:14px}
.en-app{display:flex;gap:12px;align-items:center;margin:14px 0 6px;padding:13px 14px;border-radius:14px;border:1px solid var(--linea);border-left:4px solid var(--rojo);background:linear-gradient(90deg,rgba(238,28,60,.14),rgba(238,28,60,.03) 70%),var(--s1);text-decoration:none}
.en-app .k{font:700 13px/1 var(--cond);letter-spacing:1px;text-transform:uppercase;color:var(--rojo-l);display:block;margin-bottom:5px}
.en-app .x{color:var(--texto);font-size:15.5px;line-height:1.35;display:block}
.en-app .ir{flex:none;font:700 15px/1 var(--cond);text-transform:uppercase;color:var(--rojo-l);white-space:nowrap}
.atajos{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px}.atajos a{padding:9px 13px 8px;border-radius:999px;border:1px solid var(--linea,#2a2a31);background:#17171b;color:#fff;font:700 16px/1 'Barlow Condensed',sans-serif;letter-spacing:.4px;text-transform:uppercase;text-decoration:none}
.hoy-tabs{display:flex;gap:6px;margin-bottom:6px}.hoy-tabs b{padding:7px 12px 6px;border-radius:9px;font:700 15px/1 'Barlow Condensed',sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#b9b5b8;background:#1c1c21}.hoy-tabs b.on{color:#fff;background:#2a2a31;box-shadow:inset 0 -2px 0 #ee1c3c}
.cal20{width:100%;border-collapse:separate;border-spacing:0 4px;margin-top:8px}.cal20 th{font:700 13px/1 var(--cond);letter-spacing:.8px;color:var(--apagado);text-align:center;padding:2px}
.cal20 td{padding:0 2px;text-align:center}.cal20 td.e{text-align:left;white-space:nowrap;font:700 16px/1 var(--cond);color:var(--texto)}.cal20 td.e img{width:22px;height:22px;vertical-align:middle;margin-right:6px}
.cal20 .niv{display:block;padding:7px 1px 6px;border-radius:8px;border:1px solid;font:700 13.5px/1 var(--cond);letter-spacing:.2px}.cal20 .niv small{opacity:.7;font-size:11px;margin-left:1px}
.mas-todos{display:inline-flex;margin:10px 0 0;padding:10px 14px 9px;border-radius:10px;border:1px solid var(--linea);background:var(--s2);color:var(--texto);font:700 16px/1 var(--cond);text-transform:uppercase;letter-spacing:.4px;text-decoration:none}`;
const nav = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
const page = await ctx.newPage();
await page.addInitScript(`localStorage.setItem('fm-prueba','true'); localStorage.setItem('fm-sin-tema','1'); localStorage.setItem('fm-worker','https://worker.prueba');`);
const cajas = {};
const abre = async (ruta, espera = 1500) => { await page.goto(`http://127.0.0.1:8765/${ruta}`, { waitUntil: 'load' }); await page.waitForTimeout(espera); await page.addStyleTag({ content: CSS + ' *{animation:none!important;transition:none!important} .bq,.cta{opacity:1!important;transform:none!important}' }); };
const foto = async (n, y = 0) => { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(1300); cajas[n] = await page.evaluate(() => [...document.querySelectorAll('.nuevo')].map((e) => { const r = e.getBoundingClientRect(); return { k: e.dataset.k || '', x: r.x, y: r.y, w: r.width, h: r.height }; })); await page.screenshot({ path: `img/web-${n}.png` }); };

// A. La portada sin entrar: más datos antes de pedir que entres
await abre('index.html?prueba=1', 5000);
const yA = await page.evaluate(() => {
  const m = document.querySelector('.pz-hoy-m'); if (!m) return -1;
  const k = m.querySelector('.pz-hoy-k'); const t = document.createElement('div'); t.className = 'hoy-tabs nuevo'; t.dataset.k = 'A2'; t.innerHTML = '<b class="on">Suben hoy</b><b>Bajan</b><b>En racha</b>'; k.replaceWith(t);
  // los atajos, encima del bloque de datos
  const caja = m.closest('.pz-hoy-d') || m.parentElement; const a = document.createElement('div'); a.className = 'atajos nuevo'; a.dataset.k = 'A1';
  a.innerHTML = '<a>Onces probables</a><a>Bajas</a><a>Cláusulas</a><a>Buscar jugador</a>'; caja.before(a);
  return a.getBoundingClientRect().top + scrollY;
});
console.log('portada y', yA);
await foto('A', Math.max(0, yA - 330));

// B. La ficha de un jugador: al lado del dato, lo que hace la app con el tuyo
await abre('jugadores/pedri.html?prueba=1');
await page.evaluate(() => {
  const sub = document.querySelector('.subnav'); const a = document.createElement('a'); a.className = 'en-app nuevo'; a.dataset.k = 'B1';
  a.innerHTML = '<span><span class="k">Con tu liga, en la app</span><span class="x"><b>¿Lo tienes?</b> Te dice qué día venderlo. <b>¿Lo tiene un rival?</b> Cuándo se abre su cláusula y si te llega el dinero.</span></span><span class="ir">Verlo ›</span>';
  // debajo de la cabecera de cifras, antes de los saltos
  const fecha = [...document.querySelectorAll('main p')].find((p) => /^Datos del/.test(p.textContent.trim()));
  (fecha || sub).before(a);
});
await foto('B', 150);

// C. El mercado: la lista entera a un toque y la frase al lado de la tabla
await abre('mercado/index.html?prueba=1');
const yC = await page.evaluate(() => {
  const sec = document.querySelector('#hoy') || [...document.querySelectorAll('main h2')][0].closest('section');
  const tabla = sec.querySelector('.tabla-scroll') || sec.querySelector('table');
  const b = document.createElement('a'); b.className = 'mas-todos nuevo'; b.dataset.k = 'C1'; b.textContent = 'Ver los 323 que suben hoy ›';
  const a = document.createElement('a'); a.className = 'en-app nuevo'; a.dataset.k = 'C2';
  a.innerHTML = '<span><span class="k">Con tu liga, en la app</span><span class="x"><b>¿Cuáles están libres en tu liga?</b> La app lo cruza con tu mercado y te dice cuánto pujar por cada uno.</span></span><span class="ir">Verlo ›</span>';
  const pie = [...sec.querySelectorAll('p')].find((p) => /Lo ganado o perdido/.test(p.textContent));
  (pie || tabla).after(b); b.after(a); if (pie) pie.remove();
  return b.getBoundingClientRect().top + scrollY;
});
await foto('C', Math.max(0, yC - 560));

// D. Equipos: el calendario de los 20 de un vistazo (con los datos de cada ficha de equipo)
await abre('equipos/index.html?prueba=1');
await page.evaluate(({ CAL, ESC, SIG }) => {
  const peso = { facil: 0, media: 1, dificil: 2 };
  const js = [...new Set(CAL.flatMap((e) => e.filas.map((f) => +f[0])))].sort((x, y) => x - y);
  const filas = CAL.map((e) => ({ ...e, d: e.filas.reduce((s, f) => s + peso[f[5]], 0) / e.filas.length })).sort((a, b) => a.d - b.d);
  const escDe = (n) => (ESC.find((x) => x.n === n) || {}).u || '';
  const sec = document.createElement('section'); sec.className = 'bq nuevo'; sec.dataset.k = 'D1';
  const celda = (e, j) => { const f = e.filas.find((x) => +x[0] === j); if (!f) return '<td><span style="color:var(--apagado);font-size:13px">–</span></td>'; return `<td><span class="niv niv-${f[5]}">${f[3] === 'vs' ? (SIG[f[2]] || f[2]) : (SIG[f[2]] || f[2]).toLowerCase()}<small>${f[4].replace('.º', 'º')}</small></span></td>`; };
  sec.innerHTML = `<h2>Calendario de los 20</h2><p style="margin:0 0 4px;font-size:15px">Los próximos rivales de cada equipo, del calendario más fácil al más duro. En mayúsculas, en casa.</p>
   <table class="cal20"><thead><tr><th></th>${js.map((j) => `<th>J${j}</th>`).join('')}</tr></thead><tbody>${filas.map((e) => `<tr><td class="e"><img src="${escDe(e.nombre)}" alt="">${SIG[e.nombre] || e.nombre}</td>${js.map((j) => celda(e, j)).join('')}</tr>`).join('')}</tbody></table>`;
  const primera = document.querySelector('main section.bq') || document.querySelector('main h2').closest('section');
  primera.before(sec);
}, { CAL, ESC, SIG });
const yD = await page.evaluate(() => document.querySelector('.nuevo').getBoundingClientRect().top + scrollY);
await foto('D', Math.max(0, yD - 120));
fs.writeFileSync('img/web-cajas.json', JSON.stringify(cajas));
await nav.close();
