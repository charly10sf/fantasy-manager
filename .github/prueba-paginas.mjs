// Las páginas públicas (rework de la web, 21 nov): la cabecera con los 20 escudos, el menú de cinco, las pastillas de cada
// sección, el buscador y el movimiento, en un móvil y en un ordenador, con JS y sin él, y con «reducir movimiento». Sirve web/
// tal cual está en el disco y corta todo lo de fuera (los escudos y las caras de LaLiga no se piden).
// node .github/prueba-paginas.mjs   (PW_MODULO y CHROME como en prueba-web)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PW_MODULO || 'playwright');
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
let mal = 0;
const bien = (ok, txt, extra = '') => { if (!ok) mal++; console.log(`${ok ? 'BIEN' : 'MAL '} ${txt}${ok || !extra ? '' : ` → ${extra}`}`); };
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const srv = http.createServer(async (q, r) => {
  let ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (ruta.endsWith('/')) ruta += 'index.html';
  try { const b = await readFile(join(WEB, ruta)); r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } catch { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage', '--no-sandbox'] });

async function pagina({ movil = true, js = true, reducir = false } = {}) {
  const ctx = await nav.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: movil, hasTouch: movil, javaScriptEnabled: js, reducedMotion: reducir ? 'reduce' : 'no-preference', locale: 'es-ES' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort('blockedbyclient')));
  const p = await ctx.newPage();
  p.errores = [];
  p.on('pageerror', (e) => p.errores.push(String(e)));
  if (js) await p.addInitScript(() => { try { localStorage.setItem('fm-prueba', 'true'); } catch { /* nada */ } });
  return p;
}
const RUTAS = ['mercado/', 'jornada/', 'jornada/onces.html', 'equipos/', 'equipos/barca.html', 'jugadores/', 'jugadores/mbappe.html', 'guias/', 'guias/cuanto-pujar.html',
  'guias/clausulas-laliga-fantasy.html', 'clausulas/', 'bajas/', 'metodo.html', 'instalar.html', 'privacidad.html'];

// 1. en todas: la tira con los 20 escudos arriba del todo, el menú de cinco con su sección marcada, sin desbordes y sin errores
for (const movil of [true, false]) {
  const p = await pagina({ movil });
  for (const r of RUTAS) {
    await p.goto(`${BASE}/${r}`, { waitUntil: 'load' });
    const d = await p.evaluate(() => {
      const tira = document.querySelector('nav.tira'), cab = document.querySelector('header.cab'), menu = [...document.querySelectorAll('.menu a')];
      const enlaces = tira ? [...tira.querySelectorAll('a')] : [];
      return { escudos: enlaces.length, conFicha: enlaces.filter((a) => /equipos\/[\w-]+\.html$/.test(a.getAttribute('href'))).length, siglas: enlaces.filter((a) => /^[A-Z]{3}$/.test(a.dataset.a || '')).length,
        alt: enlaces.filter((a) => a.querySelector('img[alt][width][height][loading=lazy]') && a.title).length,
        orden: tira && cab ? tira.getBoundingClientRect().top < cab.getBoundingClientRect().top : false, arriba: tira ? tira.getBoundingClientRect().top : -1,
        menu: menu.map((a) => a.textContent).join('|'), marcada: menu.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent).join('|'),
        suyo: (tira && tira.querySelector('a[aria-current]') || {}).title || '', desborda: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll('main h1').length, salto: !!document.querySelector('a.salto[href="#contenido"]') && !!document.getElementById('contenido'),
        secnav: [...document.querySelectorAll('.secnav a')].map((a) => a.textContent), secAct: document.querySelectorAll('.secnav a[aria-current="page"]').length,
        pie: document.querySelectorAll('.pie-c a').length };
    });
    const donde = `[${movil ? 'móvil' : 'ordenador'}] ${r}`;
    bien(d.escudos === 20 && d.conFicha === 20 && d.siglas === 20 && d.alt === 20, `${donde}: 20 escudos, cada uno a su ficha, con nombre y tres letras`, JSON.stringify(d));
    bien(d.orden && d.arriba === 0, `${donde}: la tira, arriba del todo y encima de la barra`, JSON.stringify([d.orden, d.arriba]));
    bien(d.menu === 'Mercado|Jornada|Equipos|Jugadores|Guías', `${donde}: el menú, cinco secciones`, d.menu);
    const espera = /^mercado/.test(r) ? 'Mercado' : /^(jornada|clausulas|bajas)/.test(r) ? 'Jornada' : /^equipos\/$/.test(r) ? 'Equipos' : /^equipos\//.test(r) ? 'Equipos' : /^jugadores/.test(r) ? 'Jugadores' : /^guias/.test(r) ? 'Guías' : '';
    bien(d.marcada === espera, `${donde}: marcada «${espera || 'ninguna'}»`, d.marcada);
    bien(d.desborda <= 0, `${donde}: no desborda de lado`, String(d.desborda));
    bien(d.h1 === 1 && d.salto && d.pie >= 10, `${donde}: un h1, salto al contenido y pie`, JSON.stringify([d.h1, d.salto, d.pie]));
    if (/^(mercado|jornada|guias|clausulas|bajas|equipos\/$|jugadores\/$)/.test(r)) bien(d.secnav.length >= 2 && d.secAct <= 1, `${donde}: las pastillas de la sección`, JSON.stringify(d.secnav));
    if (r === 'equipos/barca.html') bien(d.suyo === 'Barça' && !d.secnav.length, `${donde}: su escudo marcado en la tira (y sin pastillas)`, d.suyo);
    if (r === 'jugadores/mbappe.html') bien(d.suyo === 'Real Madrid', `${donde}: el escudo de su equipo, marcado`, d.suyo);
  }
  bien(!p.errores.length, `[${movil ? 'móvil' : 'ordenador'}] sin errores de la página`, p.errores.join(' · '));
  await p.context().close();
}

// 2. en el móvil, al bajar queda fija la barra entera, con «Descargar» a la vista (Carlos, 22 nov); los saltos de la ficha, justo debajo
{
  const p = await pagina();
  await p.goto(`${BASE}/jugadores/mbappe.html`, { waitUntil: 'load' });
  await p.evaluate(() => window.scrollTo(0, 1400));
  await p.waitForTimeout(700);
  const d = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const c = document.querySelector('.menu-cta'); return { cab: r('.cab').top, menu: r('.menu').top, marca: r('.marca').top, cta: r('.menu-cta').top, ctaB: r('.menu-cta').bottom, rojo: getComputedStyle(c).backgroundColor, sub: r('.subnav').top, menuB: r('.menu').bottom, linea: !!document.querySelector('a.app-l[data-t]') }; });
  bien(Math.abs(d.cab) <= 1 && d.marca >= 0 && d.cta >= 0 && d.ctaB <= d.menu + 1 && d.menuB <= 110, '[móvil] al bajar, la barra queda fija arriba con «Descargar» a la vista y el menú debajo', JSON.stringify(d));
  bien(/rgb\(22[0-9], 2[0-9], 5[0-9]\)/.test(d.rojo), '[móvil] «Descargar» es el rojo relleno', d.rojo);
  bien(d.linea, 'debajo de la barra, la línea de qué hace la app');
  bien(Math.abs(d.sub - d.menuB) <= 2, '[móvil] los saltos de la ficha, pegados debajo del menú', JSON.stringify(d));
  // el buscador: la lupa lo abre y sugiere fichas de jugador y de equipo
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('label.busca-b');
  await p.fill('form.busca input', 'mbap');
  await p.waitForSelector('.busca-r a', { timeout: 5000 }).catch(() => {});
  const s = await p.evaluate(() => [...document.querySelectorAll('.busca-r a')].map((a) => `${a.textContent}→${a.getAttribute('href')}`));
  bien(s.some((x) => /Mbappé.*jugadores\/mbappe\.html$/.test(x)), '[móvil] el buscador sugiere la ficha de Mbappé', s.join(' · '));
  await p.fill('form.busca input', 'osasun');
  await p.waitForTimeout(300);
  const s2 = await p.evaluate(() => [...document.querySelectorAll('.busca-r a')].map((a) => a.getAttribute('href')));
  bien(s2.some((x) => /equipos\/osasuna\.html$/.test(x)), '[móvil] y la de un equipo', s2.join(' · '));
  // todos los jugadores tienen ficha: en el índice del buscador y en la tabla
  const n = await p.evaluate(async () => { const d = await (await fetch('../jugadores/indice.json')).json(); const t = await (await fetch('../jugadores/todos.json')).json(); return [d.j.length, t.length, t.filter((x) => x[0]).length]; });
  bien(n[0] === n[1] && n[1] === n[2] && n[1] > 500, 'todos los jugadores tienen ficha (buscador y tabla)', JSON.stringify(n));
  bien(!p.errores.length, '[móvil] buscador sin errores', p.errores.join(' · '));
  await p.context().close();
}

// 3. sin JS: el buscador es un formulario a jugadores/ y la tabla de jugadores enlaza a las fichas; todo se lee
{
  const p = await pagina({ js: false });
  await p.goto(`${BASE}/jugadores/`, { waitUntil: 'load' });
  const d = await p.evaluate(() => ({ accion: document.querySelector('form.busca').getAttribute('action'), filas: document.querySelectorAll('#todos tbody tr').length, enlazadas: document.querySelectorAll('#todos tbody tr .c-j a').length, pag: document.querySelectorAll('.paginas a').length }));
  bien(/jugadores\/$/.test(d.accion) && d.filas === 150 && d.enlazadas === 150 && d.pag >= 3, '[sin JS] jugadores/: 150 por página, todos con su ficha, y el buscador lleva a jugadores/', JSON.stringify(d));
  await p.goto(`${BASE}/mercado/`, { waitUntil: 'load' });
  const m = await p.evaluate(() => ({ tarjetas: document.querySelectorAll('.jcs a.jc').length, visible: [...document.querySelectorAll('.bq')].every((b) => getComputedStyle(b).opacity === '1' || getComputedStyle(b).animationName !== 'none') }));
  bien(m.tarjetas === 5, '[sin JS] mercado/: los cinco que más suben, en tarjetas enlazadas', JSON.stringify(m));
  await p.context().close();
}

// 4. el movimiento: solo transform y opacity; al bajar, cada bloque acaba en su sitio; con «reducir movimiento», nada se mueve
{
  const p = await pagina();
  await p.goto(`${BASE}/equipos/barca.html`, { waitUntil: 'load' });
  const reglas = await p.evaluate(() => {
    const malas = [];
    for (const hoja of document.styleSheets) for (const r of hoja.cssRules) {
      if (r.type === CSSRule.KEYFRAMES_RULE) for (const k of r.cssRules) for (const prop of k.style) if (!['opacity', 'transform'].includes(prop)) malas.push(`${r.name}: ${prop}`);
    }
    const tr = [];
    for (const el of document.querySelectorAll('*')) { const t = getComputedStyle(el).transitionProperty; if (t && t !== 'all' && t !== 'none') for (const x of t.split(',').map((y) => y.trim())) if (!['transform', 'opacity'].includes(x)) tr.push(`${el.className}: ${x}`); }
    return { malas, tr: [...new Set(tr)].slice(0, 5) };
  });
  bien(!reglas.malas.length, 'las animaciones solo mueven transform y opacity', reglas.malas.join(' · '));
  bien(!reglas.tr.length, 'y las transiciones también', reglas.tr.join(' · '));
  await p.waitForTimeout(500);
  const alto = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += 600) { await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y); await p.waitForTimeout(60); }
  await p.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await p.waitForTimeout(200);
  const vis = await p.evaluate(() => [...document.querySelectorAll('.bq')].filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight - 200; }).map((b) => [getComputedStyle(b).opacity, getComputedStyle(b).transform]));
  bien(vis.length > 0 && vis.every(([o, t]) => o === '1' && (t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)')), 'un bloque ya dentro de la pantalla está entero y en su sitio', JSON.stringify(vis));
  await p.context().close();
  const q = await pagina({ reducir: true });
  await q.goto(`${BASE}/equipos/barca.html`, { waitUntil: 'load' });
  const quieto = await q.evaluate(() => [...document.querySelectorAll('main, .bq, .cta, .tira img, .jc, .btn')].every((el) => { const c = getComputedStyle(el); return c.animationName === 'none' && (c.transitionDuration === '0s' || c.transitionProperty === 'none') && c.opacity === '1'; }));
  bien(quieto, 'con «reducir movimiento», ni animaciones ni transiciones, y todo visible');
  await q.context().close();
}

await nav.close();
srv.close();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
