// Rama de prueba, NO se fusiona: qué devuelve cada fuente a las IP de Cloudflare (25 nov)
const UAS = { movil: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', curl: 'curl/8.5.0', pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', rss: 'Feedly/1.0 (+http://www.feedly.com/fetcher.html)' };
export async function onRequest({ request }) {
  const u = new URL(request.url);
  if (u.searchParams.get('k') !== 'fm25nov') return new Response('no', { status: 404 });
  const q = u.searchParams.get('q') || '"Real Betis" lesión';
  const e = encodeURIComponent(q);
  const fuentes = {
    bing: `https://www.bing.com/news/search?q=${e}&format=rss&setlang=es&cc=ES`,
    bingES: `https://www.bing.com/news/search?q=${e}&format=RSS&mkt=es-ES`,
    yahoo: `https://news.search.yahoo.com/rss?p=${e}`,
    yahooES: `https://es.news.search.yahoo.com/rss?p=${e}`,
  };
  const o = [`colo ${(request.cf || {}).colo || '?'}`];
  const tareas = [];
  for (const [n, x] of Object.entries(fuentes)) for (const [un, ua] of Object.entries(UAS)) tareas.push((async () => {
    const t = Date.now();
    try {
      const s = await fetch(x, { headers: { 'user-agent': ua, accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8', 'accept-language': 'es-ES,es;q=0.9' }, signal: AbortSignal.timeout(9000), redirect: 'follow' });
      const b = await s.text();
      o.push(`${n}/${un} ${s.status} ${Date.now() - t}ms items=${b.split('<item>').length - 1} ${s.headers.get('content-type')} url=${s.url.slice(0, 60)} | ${b.replace(/\s+/g, ' ').slice(0, u.searchParams.get('n') ? Number(u.searchParams.get('n')) : 160)}`);
    } catch (er) { o.push(`${n}/${un} ERR ${Date.now() - t}ms ${String(er).slice(0, 60)}`); }
  })());
  await Promise.all(tareas);
  return new Response(o.sort().join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
