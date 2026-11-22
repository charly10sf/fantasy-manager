import fs from 'node:fs';
import { abrir, demo } from './comun.mjs';
const CRUZ = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/></svg>';
const CSS = `.nuevo{outline:2px dashed #ff4d6a;outline-offset:5px}
.cruz-b{position:relative;display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:16px;border:1.5px solid rgba(255,77,106,.55);background:rgba(238,28,60,.10);color:#ff6b84;flex:none}
.cruz-b svg{width:26px;height:26px}
.cruz-n{position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#f4f4f6;color:#0b0b0d;font:700 14px/22px 'Barlow Condensed',sans-serif;text-align:center}
.tit-fila{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cruz-fab{position:fixed;right:16px;bottom:78px;width:60px;height:60px;border-radius:50%;z-index:40;background:#17171b;box-shadow:0 8px 24px rgba(0,0,0,.6)}
.cruz-fab svg{width:30px;height:30px}`;
const { nav, page } = await abrir();
await demo(page);
await page.addStyleTag({ content: CSS });
const ir = async (p, seg) => { await page.evaluate((x) => document.querySelector(`[data-ir="${x}"]`).click(), p); await page.waitForTimeout(600); if (seg) { await page.evaluate((x) => document.querySelector(`#vista [data-seg="${x}"]`).click(), seg); await page.waitForTimeout(700); } };
const cajas = {};
const foto = async (n) => { await page.waitForTimeout(1300); cajas[n] = await page.evaluate(() => [...document.querySelectorAll('.nuevo')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })); await page.screenshot({ path: `img/bajas-${n}.png` }); };
// filas de verdad, para la hoja
await ir('mercado', 'mercado:tendencias');
await page.evaluate(() => { window.__filas = [...document.querySelectorAll('#vista .fila')].map((x) => x.outerHTML); });
const limpia = () => page.evaluate(() => document.querySelectorAll('.nuevo, .cruz-b').forEach((e) => e.remove()));

// A. La cruz junto al título de Clubes
await ir('clubes');
await page.evaluate((CRUZ) => {
  const h1 = document.querySelector('#vista h1.titulo'); const f = document.createElement('div'); f.className = 'tit-fila'; h1.before(f); f.appendChild(h1);
  const b = document.createElement('button'); b.className = 'cruz-b nuevo'; b.style.borderRadius = '16px'; b.innerHTML = CRUZ + '<span class="cruz-n">7</span>'; f.appendChild(b);
}, CRUZ);
await page.evaluate(() => scrollTo(0, 0));
await foto('A');

// B. La cruz flotante, encima de las pestañas
await page.evaluate(() => { const f = document.querySelector('.tit-fila'); const h1 = f.querySelector('h1'); f.before(h1); f.remove(); });
await page.evaluate((CRUZ) => { const b = document.createElement('button'); b.className = 'cruz-b cruz-fab nuevo'; b.style.borderRadius = '50%'; b.innerHTML = CRUZ + '<span class="cruz-n">7</span>'; document.body.appendChild(b); }, CRUZ);
await foto('B');
await limpia();

// C. La cruz en la barra de arriba, en todas las pestañas
const cabe = await page.evaluate((CRUZ) => {
  const aj = document.querySelector('#bAjustes'); const b = aj.cloneNode(true); b.removeAttribute('id'); b.removeAttribute('data-accion'); b.dataset.et = 'Bajas'; b.setAttribute('aria-label', 'Bajas');
  b.innerHTML = CRUZ + '<span class="gl">7</span>'; b.classList.add('nuevo'); b.style.color = '#ff6b84'; aj.before(b);
  const s = document.querySelector('header.sup'), l = document.querySelector('.sup-liga b'); return { desborda: s.scrollWidth > s.clientWidth, liga: l.getBoundingClientRect().width, texto: l.scrollWidth };
}, CRUZ);
console.log('barra con cuatro', JSON.stringify(cabe));
await foto('C');
await limpia();

// D. Lo que se abre: la hoja de bajas
await page.evaluate(() => document.querySelector('#vista [data-club]').click()); await page.waitForTimeout(1800);
await page.evaluate(() => {
  const h = [...document.querySelectorAll('.hoja')].pop();
  [...h.children].forEach((c) => { if (!c.classList.contains('asa') && !c.classList.contains('cerrar-flota')) c.remove(); });
  const tmp = document.createElement('div'); tmp.innerHTML = window.__filas.join('');
  const fs = [...tmp.querySelectorAll('.fila')];
  const sub = (x) => x.querySelector('.fila-s').textContent;
  const tuyo = fs.find((x) => /Tuyo/.test(sub(x))), riv = fs.filter((x) => !/Libre|Tuyo/.test(sub(x)));
  const mk = (x, cls, est, extra) => { const c = x.querySelector('.fila-c'); let fx = c.querySelector('.fila-x'); if (!fx) { fx = document.createElement('div'); fx.className = 'fila-x'; c.appendChild(fx); } fx.innerHTML = `<span class="pill ${cls}">${est}</span><span class="pill">${extra}</span>`; const tb = x.querySelector('.tit-b'); if (tb) tb.remove(); const sv = x.querySelector('.fila-d svg'); if (sv) sv.remove(); return x.outerHTML; };
  const d = document.createElement('div'); d.style.padding = '6px 16px 24px';
  d.innerHTML = `<div class="eti">Jornada 10 · cierra el viernes</div><h1 class="titulo" id="hojaTit">Bajas</h1>
   <div class="filtros"><button class="activo">Tuyas y rivales</button><button>Libres</button><button>Apercibidos</button><button>Todas</button></div>
   <div class="sec"><h2>Tuyas</h2><span class="sub">1</span></div>
   ${mk(tuyo, 'mal', 'Lesionado', 'Vuelve en ~3 semanas')}
   <div class="sec"><h2>De tus rivales</h2><span class="sub">6</span></div>
   ${mk(riv[0], 'duda', 'Duda', 'Golpe · se prueba el viernes')}
   ${mk(riv[1], 'mal', 'Sancionado', 'Se pierde la J10')}
   ${mk(riv[2], 'mal', 'Lesionado', 'Vuelve en ~10 días')}
   ${mk(riv[3] || riv[0], 'duda', 'Duda', 'Sobrecarga · entrena aparte')}`;
  h.appendChild(d); h.scrollTop = 0;
});
await foto('D');
fs.writeFileSync('img/bajas-cajas.json', JSON.stringify(cajas));
await nav.close();
