import fs from 'node:fs';
import { abrir, demo } from './comun.mjs';
const CRUZ = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="9.1" y="3" width="5.8" height="18" rx="1.7" fill="currentColor"/><rect x="3" y="9.1" width="18" height="5.8" rx="1.7" fill="currentColor"/></svg>';
const CSS = `.tit-fila{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cz{display:flex;align-items:center;gap:10px;background:none;border:0;padding:0;color:inherit}
.cz-l{text-align:right;font:700 13px/1.15 var(--cond);letter-spacing:1.2px;text-transform:uppercase;color:#bdb8c0}.cz-l b{display:block;color:var(--texto);font-size:15px;letter-spacing:.8px}
.cz-t{position:relative;display:inline-flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:15px;color:var(--rojo-l);background:radial-gradient(120% 120% at 28% 18%,rgba(255,82,105,.26),rgba(238,28,60,.07) 62%),var(--s2);border:1px solid rgba(255,82,105,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 8px 20px rgba(238,28,60,.16)}
.cz-t svg{width:25px;height:25px}.cz-n{position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--texto);color:#0b0b0d;font:700 14px/22px var(--cond);text-align:center;box-shadow:0 0 0 3px var(--fondo)}
/* piezas comunes de las tarjetas nuevas */
.kc{display:flex!important;flex-direction:column;gap:9px;text-align:left;height:auto!important;min-height:0!important}
.kc .camiseta{display:none}
.kc img.e{width:30px;height:30px;object-fit:contain;flex:none}
.kc .n{font:700 19px/1 var(--cond);text-transform:uppercase;letter-spacing:.3px;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kc .p{font-size:12.5px;color:#bdb8c0;margin-top:3px;display:block}
.kc .hoy{font:700 17px/1 var(--cond);white-space:nowrap}.kc .hoy small{font:500 11.5px/1 Barlow,sans-serif;color:#9a959d;margin-left:3px}
.kc .sube{color:#2bd98a}.kc .baja{color:#ff6f61}
.kc .fila1{display:flex;align-items:center;gap:9px;min-width:0}.kc .fila1>span{min-width:0;flex:1}
.kc .caras{display:flex;align-items:center}.kc .caras .ava-w{margin-right:-6px}
.kc .prox{display:flex;align-items:center;gap:6px;font-size:13px;color:#bdb8c0;white-space:nowrap}
.kc .prox img{width:18px;height:18px;object-fit:contain}.kc .prox i{font-style:normal;color:#9a959d;margin-left:auto}
.dif{font:700 11.5px/1 var(--cond);letter-spacing:.7px;text-transform:uppercase;padding:4px 7px 3px;border-radius:7px;border:1px solid}
.dif.f{color:#2bd98a;border-color:rgba(43,217,138,.4)}.dif.m{color:#ffc547;border-color:rgba(255,197,71,.4)}.dif.d{color:#ff6f61;border-color:rgba(255,111,97,.45)}
/* 1 · limpia */
.k1{width:204px!important}.k1 .medio{display:flex;align-items:center;justify-content:space-between}
.k1 .sep{height:1px;background:rgba(255,255,255,.07);margin:0 -13px}
/* 2 · el partido delante */
.k2{width:222px!important}
.k2 .pt{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:12px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.06)}
.k2 .pt img{width:26px;height:26px;object-fit:contain}.k2 .pt u{text-decoration:none;font:700 12px/1 var(--cond);color:#9a959d;letter-spacing:1px}
.k2 .pt .q{margin-left:auto;text-align:right;font:700 15px/1.1 var(--cond);color:var(--texto);text-transform:uppercase}.k2 .pt .q small{display:block;font:500 11.5px/1.2 Barlow,sans-serif;color:#9a959d;text-transform:none}
.k2 .js{display:flex;gap:12px;align-items:flex-end}.k2 .j{display:flex;flex-direction:column;align-items:center;gap:4px}.k2 .j b{font:700 13px/1 var(--cond)}
.k2 .js .dif{margin-left:auto;margin-bottom:2px}
/* 3 · con nombres */
.k3{width:236px!important}
.k3 .jn{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--texto)}.k3 .jn .ava-w{transform:scale(.82);transform-origin:left center;margin-right:-6px}
.k3 .jn span.nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.k3 .jn b{font:700 15px/1 var(--cond);white-space:nowrap}
/* 4 · compacta */
.k4{width:118px!important;align-items:center;text-align:center;gap:7px;padding:14px 8px 11px!important}
.k4 img.e{width:44px;height:44px;filter:drop-shadow(0 6px 14px var(--cb))}.k4 .n{font-size:17px;max-width:100px}
.k4 .caras{justify-content:center}.k4 .prox{justify-content:center;font-size:12px;gap:4px}.k4 .prox img{width:15px;height:15px}`;
const { nav, page } = await abrir();
await demo(page);
await page.addStyleTag({ content: CSS });
const ir = async (p, seg) => { await page.evaluate((x) => document.querySelector(`[data-ir="${x}"]`).click(), p); await page.waitForTimeout(600); if (seg) { await page.evaluate((x) => document.querySelector(`#vista [data-seg="${x}"]`).click(), seg); await page.waitForTimeout(700); } };
// nombres y cambio de hoy de mis jugadores, por la foto
await ir('equipo', 'equipo:plantilla');
await page.evaluate(() => { const m = {}; for (const f of document.querySelectorAll('#vista .fila[data-j]')) { const img = f.querySelector('img.cara'); const id = img && (img.src.match(/\/p(\d+)\//) || [])[1]; const d = f.querySelector('.fila-d .d'); if (id) m[id] = { nom: f.querySelector('.nom').textContent, d: d ? d.textContent.trim() : '', c: d && d.querySelector('.baja') ? 'baja' : 'sube' }; } window.__mios = m; });
console.log('míos', await page.evaluate(() => Object.keys(window.__mios).length));
for (const v of [1, 2, 3, 4]) {
  await ir('rivales'); await ir('clubes');
  await page.evaluate(({ v, CRUZ }) => {
    const h1 = document.querySelector('#vista h1.titulo'); const f = document.createElement('div'); f.className = 'tit-fila'; h1.before(f); f.appendChild(h1);
    const b = document.createElement('button'); b.className = 'cz'; b.innerHTML = `<span class="cz-l">Bajas<b>J10</b></span><span class="cz-t">${CRUZ}<span class="cz-n">7</span></span>`; f.appendChild(b);
    const DIF = [['f', 'Fácil'], ['m', 'Media'], ['f', 'Fácil'], ['d', 'Difícil'], ['m', 'Media'], ['f', 'Fácil']];
    const DIA = ['sáb 16:15', 'sáb 14:00', 'dom 21:00', 'sáb 18:30', 'dom 16:15', 'lun 21:00'];
    const SIG = { Levante: 'LEV', 'Málaga': 'MLG', Sevilla: 'SEV', Valencia: 'VAL', Racing: 'RAC', Betis: 'BET', Celta: 'CEL', Elche: 'ELC', Getafe: 'GET', Athletic: 'ATH', Villarreal: 'VIL', Barcelona: 'BAR', Espanyol: 'ESP', Osasuna: 'OSA', Rayo: 'RAY', Deportivo: 'DEP', 'Alavés': 'ALA' };
    [...document.querySelectorAll('#vista .club-card')].forEach((c, i) => {
      const esc = c.querySelector('.cc-cab img').src, nom = c.querySelector('.cc-n').textContent, pos = c.querySelector('.cc-pos').textContent;
      const caras = [...c.querySelectorAll('.cc-caras .ava-w')]; const hoy = c.querySelector('.cc-hoy'); const hoyC = hoy.classList.contains('baja') ? 'baja' : 'sube'; const hoyT = hoy.childNodes[0].textContent.trim();
      const pe = c.querySelector('.cc-prox img'); const rEsc = pe ? pe.src : ''; const pt = c.querySelector('.cc-prox span').textContent; const riv = pt.split(' · ')[0]; const rNom = riv.replace(/^(vs|en casa del|en casa de la|en casa de)\s+/, '');
      const dif = DIF[i % DIF.length], dia = DIA[i % DIA.length]; const fuera = !/^vs /.test(riv); const corto = `${rNom} · ${fuera ? 'fuera' : 'casa'}`; const fl = hoyC === 'baja' ? '▼' : '▲';
      const ids = caras.map((a) => { const im = a.querySelector('img.cara'); return im ? (im.src.match(/\/p(\d+)\//) || [])[1] : ''; });
      const carasH = caras.map((a) => a.outerHTML).join('');
      const cab = `<span class="fila1"><img class="e" src="${esc}" alt=""><span><span class="n">${nom}</span><span class="p">${pos}</span></span></span>`;
      const hoyH = `<span class="hoy ${hoyC}">${fl} ${hoyT.replace(/^[−+-]/, '')}<small>hoy</small></span>`;
      const prox = `<span class="prox"><img src="${rEsc}" alt=""><span>${corto}</span><i>${dia}</i></span>`;
      let h = '';
      if (v === 1) h = `${cab}<span class="medio"><span class="caras">${carasH}</span>${hoyH}</span><span class="sep"></span>${prox}`;
      if (v === 2) h = `<span class="fila1"><span><span class="n">${nom}</span><span class="p">${pos}</span></span>${hoyH}</span><span class="pt"><img src="${esc}" alt=""><u>VS</u><img src="${rEsc}" alt=""><span class="q">${dia.split(' ')[0]} ${dia.split(' ')[1]}<small>${corto}</small></span></span><span class="js">${caras.map((a, k) => { const p = 58 + ((+ids[k] || 7) * 13) % 38; return `<span class="j">${a.outerHTML}<b class="${p >= 75 ? 'sube' : ''}" style="${p < 75 ? 'color:#ffc547' : ''}">${p} %</b></span>`; }).join('')}<span class="dif ${dif[0]}">${dif[1]}</span></span>`;
      if (v === 3) h = `${cab}${caras.map((a, k) => { const m = (window.__mios || {})[ids[k]] || { nom: 'Jugador', d: '', c: 'sube' }; return `<span class="jn">${a.outerHTML}<span class="nm">${m.nom}</span><b class="${m.c}">${m.d}</b></span>`; }).join('')}${prox}`;
      if (v === 4) h = `<img class="e" src="${esc}" alt=""><span class="n">${nom}</span><span class="caras">${carasH}</span>${hoyH.replace('<small>hoy</small>', '')}<span class="prox"><img src="${rEsc}" alt=""><span>${SIG[rNom] || rNom.slice(0, 3).toUpperCase()} · ${dia.split(' ')[0]}</span></span>`;
      c.classList.add('kc', 'k' + v); c.innerHTML = h;
    });
  }, { v, CRUZ });
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500);
  const caja = await page.evaluate(() => { const c = document.querySelector('#vista .club-carril').getBoundingClientRect(); const k = document.querySelector('#vista .club-card').getBoundingClientRect(); return { y: c.y, h: c.height, w: k.width, kh: k.height }; });
  console.log('variante', v, JSON.stringify(caja));
  await page.screenshot({ path: `img/clubes-${v}.png`, clip: { x: 0, y: 0, width: 390, height: 560 } });
}
await nav.close();
