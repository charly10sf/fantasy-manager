const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const URLS = [
 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml','https://e00-marca.uecdn.es/rss/portada.xml','https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml',
 'https://as.com/rss/futbol/primera.xml','https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/primera/','https://as.com/rss/tags/ultimas_noticias.xml',
 'https://www.mundodeportivo.com/rss/futbol','https://www.mundodeportivo.com/feed/rss/futbol','https://www.mundodeportivo.com/rss/home','https://www.mundodeportivo.com/rss/futbol/laliga',
 'https://www.sport.es/es/rss/futbol/rss.xml','https://www.sport.es/es/rss/last-news/news.xml','https://www.sport.es/es/rss/laliga/rss.xml','https://www.sport.es/es/rss/barca/rss.xml'];
for (const u of URLS) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const b = await r.text();
    const items = b.split(/<item[\s>]/).slice(1);
    const t = (x, k) => ((x.match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)</${k}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`@@ ${r.status} ${u} -> ${r.url === u ? '' : r.url} · ${(r.headers.get('content-type')||'').slice(0,30)} · ${b.length} B · ${items.length} items`);
    for (const x of items.slice(0, 4)) console.log(`@@    · ${t(x,'pubDate')} | ${t(x,'title').slice(0,110)} | desc ${t(x,'description').length} c: ${t(x,'description').slice(0,140)} | cat ${t(x,'category').slice(0,40)}`);
    if (items[0]) console.log(`@@    tags: ${[...new Set([...items[0].matchAll(/<([a-z:]+)[\s>]/g)].map(m=>m[1]))].join(' ')}`);
  } catch (e) { console.log(`@@ ERR ${u} ${e.message}`); }
}
const k = process.env.GEMINI_API_KEY;
if (!k) console.log('@@ sin GEMINI_API_KEY');
else {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${k}`);
  const j = await r.json().catch(() => ({}));
  console.log(`@@ gemini models HTTP ${r.status}: ${(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/','')).join(' ')}`);
}
