// Prueba de las noticias de la web sin red (25 nov): el RSS de Google y el de Bing se leen igual (parseRSS: la fuente de
// Bing va en <News:Source> y el enlace por su redireccionador), las consultas de Google pasan a Bing con un solo grupo de
// OR y sin «when:» (consultaBing), y en la web, si Google dice 503 por el Worker, se pide a Bing por el Worker y se sigue
// con Bing 6 horas (LS «noticias-bing»); lo de fuera de los días pedidos no sale. Sirve web/ en local y hace de Worker
// con page.route: nada sale de localhost.
// Uso: node .github/prueba-noticias.mjs   (PW_MODULO: ruta del index.mjs de playwright). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').then((m) => m.default || m).catch(() => import('playwright-core').then((m) => m.default || m));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const srv = http.createServer(async (q, r) => {
  const p = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const b = await readFile(join(WEB, p.endsWith('/') ? `${p}index.html` : p)); r.writeHead(200, { 'content-type': TIPOS[extname(p)] || 'application/octet-stream' }); r.end(b); } catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };

const hace = (h) => new Date(Date.now() - h * 3600e3).toUTCString();
const GOOGLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>x</title>
<item><title>El Betis recupera a su delantero - Diario Uno</title><link>https://news.google.com/rss/articles/abc?oc=5</link><pubDate>${hace(3)}</pubDate><source url="https://diariouno.es">Diario Uno</source></item>
</channel></rss>`;
const BING = `<?xml version="1.0" encoding="utf-8" ?><rss version="2.0" xmlns:News="https://www.bing.com/news/search?q=x&amp;format=rss"><channel><title>x - BingNoticias</title>
<item><title>Doblete del delantero del Betis en su vuelta</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=1&amp;url=https%3a%2f%2fdiariodos.es%2fbetis%2fdoblete.html&amp;c=1&amp;mkt=es-es</link><description>…</description><pubDate>${hace(5)}</pubDate><News:Source>Diario Dos</News:Source></item>
<item><title>Una noticia del Betis de hace casi cuatro días</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fdiariodos.es%2fvieja.html</link><pubDate>${hace(91)}</pubDate><News:Source>Diario Dos</News:Source></item>
<item><title>El once probable de la jornada</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fwww.futbolfantasy.com%2fx</link><pubDate>${hace(2)}</pubDate><News:Source>Futbol Fantasy</News:Source></item>
</channel></rss>`;

const nav = await pw.chromium.launch();
try {
  const page = await nav.newPage();
  const pedidos = [];
  let googleDa = 503;
  await page.route('https://worker.prueba/**', async (route) => {
    const u = route.request().headers()['x-u'] || '';
    const h = JSON.parse(route.request().headers()['x-h'] || '{}');
    pedidos.push({ u, ua: h['User-Agent'] || '' });
    const cab = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-s, x-t', 'content-type': 'text/plain; charset=utf-8' };
    if (u.startsWith('https://news.google.com/')) return route.fulfill({ status: 200, headers: { ...cab, 'x-s': String(googleDa) }, body: googleDa === 200 ? GOOGLE : 'Google Noticias no contesta ahora' });
    if (u.startsWith('https://www.bing.com/news/search')) return route.fulfill({ status: 200, headers: { ...cab, 'x-s': '200', 'x-t': 'application/xml' }, body: BING });
    return route.fulfill({ status: 200, headers: { ...cab, 'x-s': '404' }, body: '' });
  });
  await page.goto(`${BASE}/robots.txt`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('fm-worker', 'https://worker.prueba'); localStorage.setItem('fm-prueba', '1'); });
  await page.goto(`${BASE}/robots.txt`);

  // 1. los dos formatos
  const p = await page.evaluate(async ({ g, b }) => {
    const E = await import('/js/externas.js');
    return { g: E.parseRSS(g), b: E.parseRSS(b) };
  }, { g: GOOGLE, b: BING });
  ok(p.g.length === 1 && p.g[0].titulo === 'El Betis recupera a su delantero' && p.g[0].fuente === 'Diario Uno' && p.g[0].link.startsWith('https://news.google.com/') && p.g[0].t > 0, `Google: título sin « - fuente», fuente y fecha (${JSON.stringify(p.g[0])})`);
  ok(p.b.length === 3 && p.b[0].fuente === 'Diario Dos' && p.b[0].link === 'https://diariodos.es/betis/doblete.html' && p.b[0].t > 0, `Bing: la fuente de <News:Source> y el enlace de verdad, sin el redireccionador (${JSON.stringify(p.b[0])})`);

  // 2. las consultas, para Bing
  const c = await page.evaluate(async () => {
    const E = await import('/js/externas.js');
    return [
      '("Vinícius" OR "Pedri") (fútbol OR LaLiga OR gol) when:3d',
      '("Real Betis" OR "Sevilla") (lesión OR baja OR "rueda de prensa") when:2d',
      '(futbolfantasy OR "jornada perfecta" OR comuniate) when:2d',
      '"LaLiga Fantasy" when:2d',
      '"Betis" (LaLiga OR lesión OR baja) when:3d',
    ].map(E.consultaBing);
  });
  ok(c[0].q === '("Vinícius" OR "Pedri") fútbol' && c[0].dias === 3, `dos grupos: el segundo, su primera palabra (${c[0].q})`);
  ok(c[1].q === '("Real Betis" OR "Sevilla") lesión' && c[1].dias === 2, `equipos: ${c[1].q}`);
  ok(c[2].q === 'LaLiga (futbolfantasy OR "jornada perfecta" OR comuniate)', `un grupo suelto lleva «LaLiga» delante (${c[2].q})`);
  ok(c[3].q === '"LaLiga Fantasy"' && c[4].q === '"Betis" (LaLiga OR lesión OR baja)', `lo que ya vale, igual salvo el «when:» (${c[3].q} | ${c[4].q})`);

  // 3. Google dice 503 por el Worker: se le pide a Bing y se sigue con Bing; lo viejo no sale; la fuente de fantasy no se enseña
  const r = await page.evaluate(async () => {
    const E = await import('/js/externas.js');
    const D = { equipos: { 1: { nombre: 'Real Betis' } }, maestro: { 9: { id: 9, nombre: 'Delantero Uno', equipoId: 1 } } };
    const l = await E.noticiasClub(D, '1');
    return { l, bing: localStorage.getItem('fm-noticias-bing') || Object.keys(localStorage).filter((k) => k.includes('noticias-bing')).map((k) => localStorage.getItem(k))[0] };
  });
  const aGoogle = pedidos.filter((x) => x.u.includes('news.google.com')).length;
  const aBing = pedidos.filter((x) => x.u.includes('www.bing.com'));
  ok(aGoogle === 1 && aBing.length === 1 && /format=rss/.test(aBing[0].u) && !/when%3A|when:/.test(aBing[0].u), `Google 503 → Bing, sin «when:» (${pedidos.map((x) => x.u.slice(8, 60)).join(' | ')})`);
  ok(aBing[0] && /Windows NT/.test(aBing[0].ua), 'a Bing se le pide como un navegador de ordenador (al de móvil le da una página)');
  ok(r.l.length >= 1 && !r.l.some((n) => /casi cuatro días/.test(n.titulo)), `lo de fuera de los días pedidos no sale (${r.l.map((n) => n.titulo).join(' | ')})`);
  ok(r.bing && +JSON.parse(r.bing) > Date.now() + 5 * 3600e3, `se sigue con Bing 6 horas (${r.bing})`);
  const fila = await page.evaluate(async () => {
    const C = await import('/js/comunes.js');
    return C.filaNoticia({ titulo: 'El once probable de la jornada', fuente: 'Futbol Fantasy', link: 'https://www.futbolfantasy.com/x', t: Date.now() });
  });
  ok(!/Futbol Fantasy/i.test(fila), 'la app no enseña como fuente una web de fantasy que llegue por Bing');

  // 4. con Bing ya elegido, la siguiente va directa a Bing sin preguntar a Google
  pedidos.length = 0;
  await page.evaluate(async () => {
    const E = await import('/js/externas.js');
    localStorage.removeItem('fm-noticias-club');
    Object.keys(localStorage).filter((k) => k.includes('noticias-club')).forEach((k) => localStorage.removeItem(k));
    await E.noticiasClub({ equipos: { 2: { nombre: 'Sevilla' } }, maestro: {} }, '2');
  });
  ok(pedidos.length === 1 && pedidos[0].u.includes('www.bing.com'), `con Bing elegido, directo a Bing (${pedidos.map((x) => x.u.slice(8, 40)).join(' | ')})`);

  // 5. si Bing deja de contestar, vuelve a probar Google
  await page.unroute('https://worker.prueba/**');
  pedidos.length = 0;
  googleDa = 200;
  await page.route('https://worker.prueba/**', async (route) => {
    const u = route.request().headers()['x-u'] || '';
    pedidos.push({ u });
    const cab = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-s, x-t' };
    if (u.startsWith('https://www.bing.com/')) return route.fulfill({ status: 200, headers: { ...cab, 'x-s': '200' }, body: '<!DOCTYPE html><html>una página, no el RSS</html>' });
    return route.fulfill({ status: 200, headers: { ...cab, 'x-s': '200' }, body: GOOGLE });
  });
  const r5 = await page.evaluate(async () => {
    const E = await import('/js/externas.js');
    Object.keys(localStorage).filter((k) => k.includes('noticias-club')).forEach((k) => localStorage.removeItem(k));
    const l = await E.noticiasClub({ equipos: { 1: { nombre: 'Real Betis' } }, maestro: {} }, '1');
    return { n: l.length, bing: Object.keys(localStorage).filter((k) => k.includes('noticias-bing')).length };
  });
  ok(pedidos.length === 2 && pedidos[0].u.includes('bing') && pedidos[1].u.includes('google') && r5.bing === 0, `Bing da una página: se deja y vuelve a Google (${pedidos.map((x) => x.u.slice(8, 30)).join(' | ')})`);
} finally {
  await nav.close();
  srv.close();
}
console.log(fallos ? `\n${fallos} MAL` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
