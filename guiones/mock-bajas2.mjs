import fs from 'node:fs';
import { abrir, demo } from './comun.mjs';
const CRUZ = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="9.1" y="3" width="5.8" height="18" rx="1.7" fill="currentColor"/><rect x="3" y="9.1" width="18" height="5.8" rx="1.7" fill="currentColor"/></svg>';
const CSS = `.nav button.activo::before{display:none!important}
.nuevo{outline:2px dashed rgba(255,77,106,.9);outline-offset:6px}
.tit-fila{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cz{display:flex;align-items:center;gap:10px;background:none;border:0;padding:0;color:inherit}
.cz-l{text-align:right;font:700 13px/1.15 var(--cond);letter-spacing:1.2px;text-transform:uppercase;color:#bdb8c0}
.cz-l b{display:block;color:var(--texto);font-size:15px;letter-spacing:.8px}
.cz-t{position:relative;display:inline-flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:15px;color:var(--rojo-l);
 background:radial-gradient(120% 120% at 28% 18%,rgba(255,82,105,.26),rgba(238,28,60,.07) 62%),var(--s2);border:1px solid rgba(255,82,105,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 20px rgba(238,28,60,.16)}
.cz-t svg{width:25px;height:25px}
.cz-n{position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--texto);color:#0b0b0d;font:700 14px/22px var(--cond);text-align:center;box-shadow:0 0 0 3px var(--fondo)}
.eq2-quien{position:relative}.eq2-quien .cz{margin-left:auto}
/* la hoja */
.bj{padding:4px 16px 28px}
.bj-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.bj-cab .cz-t{width:44px;height:44px;border-radius:13px;box-shadow:none;margin-bottom:6px}.bj-cab .cz-t svg{width:22px;height:22px}
.bj-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 6px}
.bj-tab{padding:10px 4px 9px;border-radius:14px;background:var(--s2);border:1px solid var(--linea);text-align:center;color:#bdb8c0}
.bj-tab b{display:block;font:700 26px/1 var(--cond);color:var(--texto)}
.bj-tab span{display:block;margin-top:5px;font:600 12px/1 Barlow,sans-serif}
.bj-tab.on{background:linear-gradient(180deg,rgba(238,28,60,.20),rgba(238,28,60,.06));border-color:rgba(255,82,105,.55);color:var(--texto)}
.bj-tab.on b{color:var(--rojo-l)}
.bj .fila{align-items:flex-start}
.bj .fila-d{min-width:74px;text-align:right}
.bj .fila-d .v{font:700 22px/1 var(--cond)}
.bj .fila-d .d{margin-top:5px;font-size:12.5px;color:#9a959d}
.bj-parte{display:block;margin-top:6px;font-size:13.5px;line-height:1.3;color:#bdb8c0}
.bj-rel{display:flex;align-items:center;gap:10px;margin:2px 0 10px 62px;padding:9px 12px;border-radius:12px;background:var(--s2);border:1px solid var(--linea);font-size:14px;color:#bdb8c0}
.bj-rel b{color:var(--texto);font-weight:600}.bj-rel i{margin-left:auto;font-style:normal;color:var(--rojo-l);font:700 15px/1 var(--cond);text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
.bj-rel .fl{font:700 12px/1 var(--cond);letter-spacing:1px;text-transform:uppercase;color:#9a959d}
.bj-pie{margin-top:16px;font-size:12.5px;color:#8a868d;text-align:center}`;
const { nav, page } = await abrir();
await demo(page);
await page.addStyleTag({ content: CSS });
const ir = async (p, seg) => { await page.evaluate((x) => document.querySelector(`[data-ir="${x}"]`).click(), p); await page.waitForTimeout(600); if (seg) { await page.evaluate((x) => document.querySelector(`#vista [data-seg="${x}"]`).click(), seg); await page.waitForTimeout(700); } };
const cajas = {};
const foto = async (n) => { await page.waitForTimeout(1300); cajas[n] = await page.evaluate(() => [...document.querySelectorAll('.nuevo')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })); await page.screenshot({ path: `img/bajas2-${n}.png` }); };
const boton = (CRUZ, etiq) => `${etiq ? '<span class="cz-l">Bajas<b>J10</b></span>' : ''}<span class="cz-t">${CRUZ}<span class="cz-n">7</span></span>`;
// filas de verdad (los que suben y los que bajan), para la hoja
await ir('mercado', 'mercado:tendencias');
await page.evaluate(() => { window.__filas = [...document.querySelectorAll('#vista .fila')].map((x) => x.outerHTML); });
await page.evaluate(() => { const b = [...document.querySelectorAll('#vista .filtros button')].find((x) => /Bajan/.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(700);
await page.evaluate(() => { window.__filas = window.__filas.concat([...document.querySelectorAll('#vista .fila')].map((x) => x.outerHTML)); });

// 1. Clubes
await ir('clubes');
await page.evaluate(({ h }) => {
  const h1 = document.querySelector('#vista h1.titulo'); const f = document.createElement('div'); f.className = 'tit-fila'; h1.before(f); f.appendChild(h1);
  const b = document.createElement('button'); b.className = 'cz nuevo'; b.innerHTML = h; f.appendChild(b);
}, { h: boton(CRUZ, true) });
await page.evaluate(() => scrollTo(0, 0));
await foto('1');

// 2. Equipo: no hace falta botón, el recuadro «pueden jugar» abre la misma hoja
await ir('equipo', 'equipo:plantilla');
await page.evaluate(({ CRUZ }) => {
  const v = document.querySelector('#vista');
  const t = [...v.querySelectorAll('button, a, div')].filter((e) => /pueden jugar/.test(e.textContent) && e.textContent.length < 40).pop();
  const caja = t.closest('button') || t;
  caja.classList.add('nuevo'); caja.style.position = 'relative';
  const b = caja.querySelector('b'); if (b) b.innerHTML = b.innerHTML.replace('15', '14');
  caja.insertAdjacentHTML('beforeend', `<span class="cz-t" style="position:absolute;right:10px;top:10px;width:34px;height:34px;border-radius:10px;box-shadow:none">${CRUZ.replace('width="24" height="24"', 'width="17" height="17" style="width:17px;height:17px"')}</span>`);
  const ok = [...v.querySelectorAll('div, p')].filter((e) => /^\s*Todo en orden/.test(e.textContent) && e.textContent.length < 200).pop(); if (ok) ok.remove();
}, { CRUZ });
await page.evaluate(() => scrollTo(0, 0));
await foto('2');
await page.evaluate(() => document.querySelectorAll('.cz').forEach((e) => e.remove()));

// la hoja
const hoja = async (vista) => {
  await ir('clubes');
  await page.evaluate(() => document.querySelector('#vista [data-club]').click()); await page.waitForTimeout(1800);
  await page.evaluate(({ CRUZ, vista }) => {
    const h = [...document.querySelectorAll('.hoja')].pop();
    [...h.children].forEach((c) => { if (!c.classList.contains('asa') && !c.classList.contains('cerrar-flota')) c.remove(); });
    const tmp = document.createElement('div'); tmp.innerHTML = window.__filas.join('');
    const vistos = new Set(); const fs = [...tmp.querySelectorAll('.fila')].filter((x) => { const n = x.querySelector('.nom').textContent; if (vistos.has(n)) return false; vistos.add(n); return true; });
    const sub = (x) => x.querySelector('.fila-s').textContent;
    const tuyos = fs.filter((x) => /Tuyo/.test(sub(x))), riv = fs.filter((x) => !/Libre|Tuyo/.test(sub(x))), lib = fs.filter((x) => /Libre/.test(sub(x)));
    const mk = (x, cls, est, parte, v, d) => { x = x.cloneNode(true); const c = x.querySelector('.fila-c'); let fx = c.querySelector('.fila-x'); if (fx) fx.remove(); const tb = x.querySelector('.tit-b'); if (tb) tb.remove(); c.insertAdjacentHTML('beforeend', `<div class="fila-x"><span class="pill ${cls}">${est}</span></div><span class="bj-parte">${parte}</span>`); x.querySelector('.fila-d').innerHTML = `<div class="v">${v}</div><div class="d">${d}</div>`; return x.outerHTML; };
    const nomLib = lib[0] ? lib[0].querySelector('.nom').textContent : 'Uno libre';
    const d = document.createElement('div'); d.className = 'bj';
    const tabs = (on) => `<div class="bj-tabs">${[['7', 'Tu liga'], ['14', 'Libres'], ['5', 'Apercibidos'], ['26', 'Todas']].map((t, i) => `<div class="bj-tab${i === on ? ' on' : ''}"><b>${t[0]}</b><span>${t[1]}</span></div>`).join('')}</div>`;
    const cab = `<div class="bj-cab"><div><div class="eti">Jornada 10 · cierra vie 21:00</div><h1 class="titulo" id="hojaTit">Bajas</h1></div><span class="cz-t">${CRUZ}</span></div>`;
    if (vista === 'liga') d.innerHTML = `${cab}${tabs(0)}
      <div class="sec"><h2>Tuyas</h2><span class="sub">1 · te falta un titular</span></div>
      ${mk(tuyos[0] || fs[0], 'mal', 'Lesionado', 'Rotura en el isquio. Baja para la J10 y la J11.', '~3 sem.', 'vuelve')}
      <div class="bj-rel"><span class="fl">Relevo</span><span><b>${nomLib}</b> · libre en tu mercado</span><i>Ver ›</i></div>
      <div class="sec"><h2>De tus rivales</h2><span class="sub">6 · a Hugo le faltan 2</span></div>
      ${mk(riv[0], 'duda', 'Duda', 'Golpe en el tobillo. Se prueba el viernes.', '40 %', 'de jugar')}
      ${mk(riv[1], 'mal', 'Sancionado', 'Quinta amarilla. Se pierde la J10.', 'J11', 'vuelve')}
      ${mk(riv[2], 'mal', 'Lesionado', 'Sobrecarga. Entrena aparte.', '~10 días', 'vuelve')}
      <p class="bj-pie">Partes de hoy, 07:13</p>`;
    else d.innerHTML = `${cab}${tabs(2)}
      <div class="sec"><h2>Tuyos</h2><span class="sub">2 · a una amarilla</span></div>
      ${mk(tuyos[1] || tuyos[0] || fs[1], 'duda', '4 amarillas', 'Si la ve en la J10, se pierde el partido contra el Sevilla.', 'J11', 'se la perdería')}
      ${mk(tuyos[2] || fs[2], 'duda', '4 amarillas', 'Si la ve en la J10, se pierde el partido en Valencia.', 'J11', 'se la perdería')}
      <div class="sec"><h2>De tus rivales</h2><span class="sub">3</span></div>
      ${mk(riv[3] || riv[0], 'duda', '9 amarillas', 'Segundo ciclo: a una de la sanción.', 'J11', 'se la perdería')}
      ${mk(riv[4] || riv[1], 'duda', '4 amarillas', 'Si la ve en la J10, se pierde el derbi.', 'J11', 'se la perdería')}
      <p class="bj-pie">Tarjetas hasta la J9</p>`;
    h.appendChild(d); h.scrollTop = 0;
  }, { CRUZ, vista });
};
await hoja('liga'); await foto('3');
await page.evaluate(() => { const b = document.querySelector('.hoja [data-accion="cerrarHoja"]'); if (b) b.click(); }); await page.waitForTimeout(700);
await hoja('aper'); await foto('4');
fs.writeFileSync('img/bajas2-cajas.json', JSON.stringify(cajas));
await nav.close();
