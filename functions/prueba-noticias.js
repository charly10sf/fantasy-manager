// Rama de prueba, NO se fusiona: mira si Bing Noticias y Google Noticias contestan a las IP de Cloudflare (25 nov)
const QS = ['"Real Betis" lesión', '"Vinicius" LaLiga', '"LaLiga Fantasy"', '(lesión OR baja) LaLiga', '"Athletic Club" convocatoria', '"Lamine Yamal"', 'LaLiga previa', '"Rayo Vallecano" entrenador'];
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
export async function onRequest({ request }) {
  const u = new URL(request.url);
  if (u.searchParams.get('k') !== 'fm25nov') return new Response('no', { status: 404 });
  const solo = u.searchParams.get('solo');
  const o = [`colo ${(request.cf || {}).colo || '?'}`];
  await Promise.all(QS.map(async (q) => {
    for (const [n, x] of [['bing', `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=es&cc=ES`], ['google', `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es&gl=ES&ceid=ES:es`]]) {
      if (solo && solo !== n) continue;
      const t = Date.now();
      try {
        const s = await fetch(x, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml' }, signal: AbortSignal.timeout(9000) });
        const b = await s.text();
        o.push(`${n} ${s.status} ${Date.now() - t}ms items=${b.split('<item>').length - 1} ${q}`);
      } catch (e) { o.push(`${n} ERR ${Date.now() - t}ms ${String(e).slice(0, 40)} ${q}`); }
    }
  }));
  return new Response(o.sort().join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
