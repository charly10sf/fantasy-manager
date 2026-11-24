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

async function pagina({ movil = true, js = true, reducir = false, ua = undefined } = {}) {
  const ctx = await nav.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: movil, hasTouch: movil, javaScriptEnabled: js, userAgent: ua, reducedMotion: reducir ? 'reduce' : 'no-preference', locale: 'es-ES' });
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
        orden: tira && cab ? tira.getBoundingClientRect().top >= cab.getBoundingClientRect().bottom - 1 : false, arriba: cab ? cab.getBoundingClientRect().top : -1,
        menu: menu.map((a) => a.textContent).join('|'), marcada: menu.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent).join('|'),
        suyo: (tira && tira.querySelector('a[aria-current]') || {}).title || '', desborda: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll('main h1').length, salto: !!document.querySelector('a.salto[href="#contenido"]') && !!document.getElementById('contenido'),
        secnav: [...document.querySelectorAll('.secnav a')].map((a) => a.textContent), secAct: document.querySelectorAll('.secnav a[aria-current="page"]').length,
        pie: document.querySelectorAll('.pie-c a').length };
    });
    const donde = `[${movil ? 'móvil' : 'ordenador'}] ${r}`;
    bien(d.escudos === 20 && d.conFicha === 20 && d.siglas === 20 && d.alt === 20, `${donde}: 20 escudos, cada uno a su ficha, con nombre y tres letras`, JSON.stringify(d));
    bien(d.orden && d.arriba === 0, `${donde}: la barra, arriba del todo, y la tira de escudos debajo`, JSON.stringify([d.orden, d.arriba]));
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
  const d = await p.evaluate(() => { const r = (s) => [...document.querySelectorAll(s)].find((e) => e.getClientRects().length).getBoundingClientRect(); const c = [...document.querySelectorAll('.menu-cta')].find((e) => e.getClientRects().length); return { cab: r('.cab').top, menu: r('.menu').top, marca: r('.marca').top, cta: r('.menu-cta').top, ctaB: r('.menu-cta').bottom, rojo: getComputedStyle(c).backgroundColor, sub: r('.subnav').top, menuB: r('.menu').bottom, linea: !!document.querySelector('a.app-l[data-t]') }; });
  bien(Math.abs(d.cab) <= 1 && d.marca >= 0 && d.cta >= 0 && d.ctaB <= d.menu + 1 && d.menuB <= 110, '[móvil] al bajar, la barra queda fija arriba con el botón rojo a la vista y el menú debajo', JSON.stringify(d));
  bien(/rgb\(22[0-9], 2[0-9], 5[0-9]\)/.test(d.rojo), '[móvil] el botón de la barra es el rojo relleno', d.rojo);
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

// (24 nov) lo de tener la app, según el dispositivo: el botón rojo de la barra, la línea de debajo y la llamada del final
{
  const UA = {
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  };
  const mirar = (p) => p.evaluate(() => {
    const visto = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length);
    const txt = (e, ps) => getComputedStyle(e, ps).content.replace(/^"|"$/g, '').replace(/" "/g, '');
    const pos = (e) => { const r = e.getBoundingClientRect(); return Math.round(r.top) * 10000 + Math.round(r.left); };
    const rojo = visto('.menu-cta'), linea = visto('.app-l'), cta = visto('.cta-b a').sort((x, y) => pos(x) - pos(y));
    return { d: document.documentElement.dataset.d || '', nRojo: rojo.length, rojoT: rojo[0] ? (rojo[0].textContent.trim() || txt(rojo[0], '::before') + txt(rojo[0], '::after')) : '', rojoH: rojo[0] ? rojo[0].getAttribute('href') : '',
      rojoColor: rojo[0] ? getComputedStyle(rojo[0]).backgroundColor : '', rojoFijo: rojo[0] ? Math.round(rojo[0].getBoundingClientRect().top) : -1,
      nLinea: linea.length, lineaT: linea[0] ? txt(linea[0], '::before') : '', lineaB: linea[0] ? txt(linea[0], '::after') : '', lineaH: linea[0] ? linea[0].getAttribute('href') : '',
      cta: cta.map((a) => a.textContent.trim()), ctaPlay: cta.filter((a) => /play\.google\.com/.test(a.href)).length, ancho: document.documentElement.scrollWidth <= innerWidth + 1,
      otrosRojos: [...document.querySelectorAll('main a, main button')].filter((e) => e.getClientRects().length && /rgb\(22[0-9], 2[0-9], 5[0-9]\)/.test(getComputedStyle(e).backgroundColor)).length };
  });
  for (const [disp, movil] of [['android', true], ['iphone', true], ['windows', false], ['mac', false]]) {
    const p = await pagina({ movil, ua: UA[disp] });
    for (const r of ['mercado/', 'jugadores/mbappe.html', 'guias/cuanto-pujar.html']) {
      await p.goto(`${BASE}/${r}`, { waitUntil: 'load' });
      await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(250);
      const d = await mirar(p);
      const T = `[${disp}] ${r}`;
      if (disp === 'android') {
        bien(d.d === 'a' && d.nRojo === 1 && /^Descargar/.test(d.rojoT) && /play\.google\.com/.test(d.rojoH), `${T}: el botón rojo es «Descargar» y lleva a Google Play`, JSON.stringify(d));
        bien(d.nLinea === 1 && /Descargar/i.test(d.lineaB) && /play\.google\.com/.test(d.lineaH), `${T}: la línea lleva a Google Play`, JSON.stringify(d));
        bien(d.ctaPlay === 1, `${T}: la llamada del final lleva Google Play`, d.cta.join(' | '));
      } else {
        bien(d.d === (disp === 'iphone' ? 'i' : 'p') && d.nRojo === 1 && /^Entrar/.test(d.rojoT) && /#entrar$/.test(d.rojoH) && !/play\.google/.test(d.rojoH), `${T}: el botón rojo es «${d.rojoT}» y lleva a lo de entrar, no a Google Play`, JSON.stringify(d));
        bien(movil || d.rojoT === 'Entrar con tu liga', `${T}: en el ordenador dice «Entrar con tu liga»`, d.rojoT);
        bien(d.nLinea === 1 && /Entrar/i.test(d.lineaB) && /#entrar$/.test(d.lineaH), `${T}: la línea dice «Entrar» y lleva a lo de entrar`, JSON.stringify(d));
        bien(disp === 'iphone' ? d.ctaPlay === 0 && d.cta.length === 1 : d.ctaPlay === 1 && !/Google Play/.test(d.cta[0]), `${T}: en la llamada del final, ${disp === 'iphone' ? 'nada de Google Play' : 'primero abrirla aquí'}`, d.cta.join(' | '));
      }
      bien(/datos de todos/.test(d.lineaT) && /TU equipo/.test(d.lineaT), `${T}: la línea dice que aquí están los datos de todos y dentro, los tuyos`, d.lineaT);
      bien(/rgb\(22[0-9], 2[0-9], 5[0-9]\)/.test(d.rojoColor) && d.rojoFijo >= 0 && d.rojoFijo < 60 && d.otrosRojos === 0, `${T}: el botón sigue fijo arriba y es el único rojo relleno`, JSON.stringify({ c: d.rojoColor, y: d.rojoFijo, otros: d.otrosRojos }));
      bien(d.ancho, `${T}: nada se sale de ancho`);
    }
    // el clic deja dicho de dónde sale, sin pisar una campaña de fuera
    if (disp === 'iphone') {
      await p.goto(`${BASE}/mercado/`, { waitUntil: 'load' });
      const og = async (antes) => p.evaluate((a) => { if (a) localStorage.setItem('fm-origen', JSON.stringify({ o: a, t: Date.now() })); else localStorage.removeItem('fm-origen'); const e = [...document.querySelectorAll('.app-l')].find((x) => x.getClientRects().length); e.addEventListener('click', (ev) => ev.preventDefault()); e.click(); return (JSON.parse(localStorage.getItem('fm-origen') || '{}')).o; }, antes);
      bien(await og('') === 'web-linea', `[${disp}] al pulsar la línea queda apuntado el origen «web-linea»`);
      bien(await og('x-ios') === 'x-ios', `[${disp}] y si venía de un anuncio, el anuncio sigue mandando`);
    }
    await p.context().close();
  }
  // sin JS: como estaba, «Descargar», y todo se lee
  const s = await pagina({ js: false, ua: UA.iphone });
  await s.goto(`${BASE}/mercado/`, { waitUntil: 'load' });
  const sj = await s.evaluate(() => { const v = [...document.querySelectorAll('.menu-cta')].filter((e) => e.getClientRects().length); return { n: v.length, t: v[0] ? v[0].textContent.trim() : '', linea: [...document.querySelectorAll('.app-l')].filter((e) => e.getClientRects().length).length }; }).catch(() => null);
  bien(sj === null || (sj.n === 1 && /^Descargar/.test(sj.t) && sj.linea === 1), 'sin JS se ve un solo botón, «Descargar», y una sola línea', JSON.stringify(sj));
  await s.context().close();
  // instalar.html: los tres dispositivos con su símbolo y el tuyo marcado; ninguna insignia que no sea la de Google Play
  for (const [disp, movil, id] of [['android', true, 'android'], ['iphone', true, 'iphone'], ['windows', false, 'ordenador']]) {
    const p = await pagina({ movil, ua: UA[disp] });
    await p.goto(`${BASE}/instalar.html`, { waitUntil: 'load' });
    const d = await p.evaluate(() => ({ tres: [...document.querySelectorAll('.disp a')].map((a) => `${a.dataset.d}${a.classList.contains('tuyo') ? '*' : ''}${a.querySelector('.disp-g svg') ? '' : '!'}`), primera: document.querySelector('.instalar .caja').id,
      tiendas: [...document.querySelectorAll('main img')].map((i) => i.alt).filter((a) => /store|tienda|play/i.test(a)), h1: document.querySelector('h1').textContent.trim() }));
    bien(d.tres.length === 3 && d.tres[0] === `${id}*` && d.tres.every((x) => !x.endsWith('!')) && d.primera === id, `[${disp}] instalar.html: los tres dispositivos con su símbolo y el tuyo, el primero y marcado`, JSON.stringify(d));
    bien(d.tiendas.every((a) => /Google Play/.test(a)) && /Cómo instalar/.test(d.h1), `[${disp}] instalar.html: la única insignia de tienda es la de Google Play y el título no cambia`, JSON.stringify(d));
    await p.context().close();
  }
}

await nav.close();
srv.close();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
