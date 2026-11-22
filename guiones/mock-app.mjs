import fs from 'node:fs';
import { abrir, demo } from './comun.mjs';
const { nav, page } = await abrir();
await demo(page);
await page.addStyleTag({ content: `.nuevo{outline:2px dashed #ff4d6a;outline-offset:5px;border-radius:12px}
.nuevo-f .pill.xnv, .pill.xnv{outline:2px dashed #ff4d6a;outline-offset:2px}
.sel-f{display:flex;gap:8px;margin:10px 0 2px}.sel-f span{flex:1;display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:12px;background:var(--s2,#1b1b20);border:1px solid var(--linea,#2a2a31);font-size:14px;color:var(--texto,#fff)}
.sel-f span i{font-style:normal;opacity:.6;margin-left:6px}` });
const ir = async (p, seg) => { await page.evaluate((x) => document.querySelector(`[data-ir="${x}"]`).click(), p); await page.waitForTimeout(600); if (seg) { await page.evaluate((x) => document.querySelector(`#vista [data-seg="${x}"]`).click(), seg); await page.waitForTimeout(700); } };
const cajas = {};
const foto = async (n) => { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1200); cajas[n] = await page.evaluate(() => [...document.querySelectorAll('.nuevo, .pill.xnv')].map((e) => { const r = e.getBoundingClientRect(); return { k: e.dataset.k || '', x: r.x, y: r.y, w: r.width, h: r.height }; }).filter((r) => r.y < 844 - 70 && r.h > 0)); await page.screenshot({ path: `img/app-${n}.png` }); };

// A. Mercado → Tendencias: explorar toda LaLiga con filtros
await ir('mercado', 'mercado:tendencias');
await page.evaluate(() => {
  const v = document.querySelector('#vista'), f = v.querySelector('.filtros');
  window.__filas = [...v.querySelectorAll('.fila')].map((x) => x.outerHTML);
  f.innerHTML = ['Suben', 'Bajan', '7 días', 'Rachas', 'Máximos', 'Sin dueño'].map((t, i) => `<button class="${i === 0 ? 'activo' : ''}${i >= 2 && i <= 4 ? ' nv2' : ''}">${t}</button>`).join('');
  f.style.cssText = 'flex-wrap:nowrap;overflow:hidden';
  const s = document.createElement('div'); s.className = 'sel-f nuevo'; s.dataset.k = 'A1';
  s.innerHTML = '<span>Puesto <i>▾</i></span><span>Equipo <i>▾</i></span><span>Libres <i>▾</i></span>';
  f.after(s);
  const p = v.querySelector('p.t2.peq'); p.innerHTML = 'Toda LaLiga, <b>38 libres en tu liga</b> · orden: sube hoy ▾';
  // solo los libres, como si el filtro estuviera puesto
  for (const x of v.querySelectorAll('.fila')) if (!/Libre/.test(x.querySelector('.fila-s').textContent)) x.remove();
});
await foto('A');

// B. Rachas y máximos, con los tuyos arriba
await ir('mercado', 'mercado:venta'); await ir('mercado', 'mercado:tendencias');
await page.evaluate(() => {
  const v = document.querySelector('#vista'), f = v.querySelector('.filtros');
  f.innerHTML = ['Suben', 'Bajan', '7 días', 'Rachas', 'Máximos', 'Sin dueño'].map((t, i) => `<button class="${i === 3 ? 'activo' : ''}">${t}</button>`).join('');
  f.style.cssText = 'flex-wrap:nowrap;overflow:hidden'; f.classList.add('nuevo'); f.dataset.k = 'B1';
  const p = v.querySelector('p.t2.peq'); p.innerHTML = 'Días seguidos subiendo. <b>Los tuyos, arriba</b>: en máximos de la temporada puede ser el momento de vender.';
  const filas = [...v.querySelectorAll('.fila')];
  const tuyos = filas.filter((x) => /Tuyo/.test(x.querySelector('.fila-s').textContent));
  const otros = filas.filter((x) => !tuyos.includes(x));
  const orden = [...tuyos, ...otros];
  const datos = [['11 días subiendo', '+9,8 M', 1], ['6 días subiendo', '+2,1 M', 0], ['14 días subiendo', '+21,4 M', 1], ['9 días subiendo', '+12,0 M', 0], ['8 días subiendo', '+4,3 M', 0], ['7 días subiendo', '+3,9 M', 1]];
  const ancla = p;
  orden.reverse().forEach((x) => ancla.after(x));
  orden.reverse().forEach((x, i) => {
    const d = datos[i % datos.length], c = x.querySelector('.fila-c');
    let fx = c.querySelector('.fila-x'); if (!fx) { fx = document.createElement('div'); fx.className = 'fila-x'; c.appendChild(fx); }
    fx.innerHTML = `<span class="pill bien${i < 3 ? ' xnv' : ''}" data-k="${i === 0 ? 'B2' : ''}">${d[0]} · ${d[1]}</span>${d[2] ? `<span class="pill chollo${i < 3 ? ' xnv' : ''}" data-k="${i === 0 ? 'B3' : ''}">Máximo de la temporada</span>` : ''}`;
  });
});
await foto('B');

// C. Directo → Por jornada: lo mejor de la jornada en toda LaLiga, cruzado con la liga
await ir('directo', 'directo:jornadas');
await page.evaluate(() => {
  const v = document.querySelector('#vista'), sec = v.querySelector('.sec');
  const caja = document.createElement('div'); caja.className = 'nuevo'; caja.dataset.k = 'C1';
  const pts = [['22', 'su media: 10'], ['19', 'su media: 8,5'], ['17', 'dobla su media'], ['16', 'su media: 7,1']];
  const tmp = document.createElement('div'); tmp.innerHTML = window.__filas.slice(0, 12).join('');
  const fs = [...tmp.querySelectorAll('.fila')]; const elig = [fs[0], fs[3], fs[4], fs[6]].filter(Boolean);
  elig.forEach((x, i) => { x.querySelector('.fila-d').innerHTML = `<div class="v">${pts[i][0]} pts</div><div class="d apag">${pts[i][1]}</div>`; const tb = x.querySelector('.tit-b'); if (tb) tb.remove(); });
  caja.innerHTML = `<div class="sec"><h2>Lo mejor de la J8</h2><span class="sub">toda LaLiga</span></div>
    <p class="t2 peq">Once ideal de la jornada: <b>2 eran tuyos</b>, 6 de tus rivales y 3 estaban libres.</p>${elig.map((x) => x.outerHTML).join('')}
    <p class="t2 peq"><b>El que se te escapó:</b> estaba libre a 34,6 M y nadie pujó.</p>`;
  sec.before(caja);
});
await foto('C');

// D. Clubes: las bajas de la jornada, las tuyas y las de tus rivales, con parte y vuelta
await ir('clubes');
await page.evaluate(() => {
  const v = document.querySelector('#vista'), sec = v.querySelector('.sec');
  const tmp = document.createElement('div'); tmp.innerHTML = window.__filas.join('');
  const fs = [...tmp.querySelectorAll('.fila')];
  const tuyo = fs.find((x) => /Tuyo/.test(x.querySelector('.fila-s').textContent)), riv = fs.filter((x) => / · (?!Libre|Tuyo)/.test(x.querySelector('.fila-s').textContent)).slice(0, 2);
  const mk = (x, sub, pills) => { const c = x.querySelector('.fila-c'); x.querySelector('.fila-s').innerHTML = sub; let fx = c.querySelector('.fila-x'); if (!fx) { fx = document.createElement('div'); fx.className = 'fila-x'; c.appendChild(fx); } fx.innerHTML = pills; const tb = x.querySelector('.tit-b'); if (tb) { tb.className = 'tit-b mal'; tb.textContent = 'Baja'; } const sv = x.querySelector('.fila-d svg'); if (sv) sv.remove(); return x.outerHTML; };
  const caja = document.createElement('div'); caja.className = 'nuevo'; caja.dataset.k = 'D1';
  caja.innerHTML = `<div class="sec"><h2>Bajas de la J10</h2><span class="sub">1 tuya · 6 de rivales</span></div>
    <div class="filtros"><button class="activo">Tuyas y rivales</button><button>Libres</button><button>Todas</button></div>
    ${mk(tuyo, 'Real Madrid · <b class="rojo">Tuyo</b>', '<span class="pill mal">Lesionado</span><span class="pill">Vuelve en ~3 semanas</span>')}
    ${mk(riv[0], riv[0].querySelector('.fila-s').textContent, '<span class="pill duda">Duda</span><span class="pill">Golpe · se prueba el viernes</span>')}
    ${mk(riv[1], riv[1].querySelector('.fila-s').textContent, '<span class="pill mal">Sancionado</span><span class="pill">Se pierde la J10</span>')}`;
  sec.before(caja);
});
await foto('D');
fs.writeFileSync('img/app-cajas.json', JSON.stringify(cajas));
await nav.close();
