// Segunda pasada de la prueba de fuentes (solo lectura, sin claves): mira qué trae lo que vino vacío o bloqueado,
// prueba rutas alternativas y enseña la forma de los datos de ESPN (eventos con minuto, plantillas) para el directo.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const get = async (url, h = {}) => {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...h }, signal: AbortSignal.timeout(25000) });
    const b = await r.text();
    return { s: r.status, b, ms: Date.now() - t0, ct: r.headers.get('content-type') || '', u: r.url };
  } catch (e) { return { s: 0, b: '', ms: Date.now() - t0, ct: '', u: url, err: String(e.cause?.code || e.message) }; }
};
const head = (b, n = 220) => b.replace(/\s+/g, ' ').slice(0, n);
const items = (b) => (b.match(/<item[ >]/g) || []).length + (b.match(/<entry[ >]/g) || []).length;
const j = (b) => { try { return JSON.parse(b); } catch { return null; } };
const linea = (t) => console.log(t);

linea('## RSS / webs que vinieron vacías o con error');
const RSS = { Accept: 'application/rss+xml, application/xml, text/xml, */*' };
for (const u of [
  'https://www.sport.es/es/rss/last-news/rss.xml', 'https://www.sport.es/es/rss/futbol/rss.xml', 'https://www.sport.es/es/rss/barca/rss.xml',
  'https://www.sport.es/es/rss/real-madrid/rss.xml', 'https://www.sport.es/es/rss/', 'https://www.sport.es/rss/futbol.xml',
  'https://as.com/rss/tags/ultimas_noticias.xml', 'https://as.com/rss/futbol/portada.xml', 'https://as.com/rss/futbol/primera.xml', 'https://as.com/rss/diarioas/portada.xml',
  'https://www.sevillafc.es/', 'https://www.sevillafc.es/es/noticias', 'https://www.athletic-club.eus/es/', 'https://www.athletic-club.eus/es/noticias/',
  'https://www.realbetisbalompie.es/noticias/', 'https://www.valenciacf.com/es/noticias', 'https://www.realsociedad.eus/es/noticias',
]) {
  const r = await get(u, RSS);
  linea(`- ${u} → ${r.s || r.err} · ${(r.b.length / 1024).toFixed(1)} KB · ${r.ms} ms · ${r.ct.split(';')[0]} · items=${items(r.b)}${r.u !== u ? ` · final=${r.u}` : ''} · «${head(r.b, 140)}»`);
}

linea('\n## SofaScore: rutas alternativas');
const SF = { Referer: 'https://www.sofascore.com/', Origin: 'https://www.sofascore.com', Accept: 'application/json' };
for (const u of [
  'https://api.sofascore.com/api/v1/unique-tournament/8/seasons', 'https://www.sofascore.com/api/v1/unique-tournament/8/seasons',
  'https://api.sofascore.app/api/v1/unique-tournament/8/seasons', 'https://api.sofascore.com/api/v1/sport/football/events/live',
]) {
  const r = await get(u, SF);
  linea(`- ${u} → ${r.s || r.err} · ${r.b.length} B · «${head(r.b, 120)}»`);
}

linea('\n## ESPN: forma de los datos');
const E = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const sb = await get(`${E}/scoreboard?dates=20261101`);
const jb = j(sb.b);
const ev = (jb?.events || [])[0];
if (ev) {
  const c = ev.competitions?.[0] || {};
  linea(`- partido ${ev.id} ${ev.shortName} estado=${ev.status?.type?.name} (${ev.status?.type?.detail}) marcador=${c.competitors?.map((x) => x.score).join('-')}`);
  linea(`- competitions[0].details (${(c.details || []).length}): ${JSON.stringify((c.details || []).slice(0, 4)).slice(0, 900)}`);
  linea(`- claves del partido: ${Object.keys(ev).join(',')} | competitions: ${Object.keys(c).join(',')}`);
  const sm = await get(`${E}/summary?event=${ev.id}`);
  const s = j(sm.b);
  if (s) {
    linea(`- summary claves: ${Object.keys(s).join(',')}`);
    linea(`- keyEvents[0..5]: ${JSON.stringify((s.keyEvents || []).slice(0, 6)).slice(0, 1400)}`);
    const r0 = s.rosters?.[0];
    linea(`- rosters[0]: formación=${r0?.formation} jugadores=${(r0?.roster || []).length} clave jugador=${Object.keys(r0?.roster?.[0] || {}).join(',')}`);
    
    const bx = s.boxscore?.players?.[0];
    linea(`- boxscore.players[0] claves=${Object.keys(bx || {}).join(',')} estadísticas=${String(JSON.stringify(bx?.statistics?.[0]?.names || bx?.statistics?.[0])).slice(0, 500)}`);
    linea(`- rosters[0].roster[0].stats: ${String(JSON.stringify((r0?.roster?.[0]?.stats || []).map((x) => `${x.name}=${x.value}`))).slice(0, 900)}`);
    linea(`- rosters[0].roster[3] subbedIn/Out: ${String(JSON.stringify([r0?.roster?.find((x) => x.subbedIn)?.subbedIn, r0?.roster?.find((x) => x.subbedOut)?.subbedOut])).slice(0, 400)}`);
    linea(`- commentary[0..2]: ${JSON.stringify((s.commentary || []).slice(0, 2)).slice(0, 700)}`);
  } else linea(`- summary ${sm.s} ${head(sm.b)}`);
} else linea(`- scoreboard ${sb.s} ${head(sb.b)}`);
for (const u of [`${E}/news`, `${E}/teams`, 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/standings', 'https://site.web.api.espn.com/apis/v2/sports/soccer/esp.1/standings']) {
  const r = await get(u);
  const x = j(r.b);
  linea(`- ${u} → ${r.s || r.err} · ${(r.b.length / 1024).toFixed(1)} KB · claves=${x ? Object.keys(x).slice(0, 8).join(',') : head(r.b, 80)}${x?.articles ? ` · artículos=${x.articles.length} «${x.articles[0]?.headline}»` : ''}`);
}

linea('\n## futbolfantasy: enlaces de la portada que huelen a directo, puntos, lesiones o noticias, y robots.txt');
const pf = await get('https://www.futbolfantasy.com/');
const hrefs = [...new Set([...pf.b.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]).filter((h) => /directo|punt|jornada|lesion|alineac|noticia|once|mercado|analytics/i.test(h)))];
linea(hrefs.slice(0, 40).map((h) => `- ${h}`).join('\n'));
for (const d of ['https://www.futbolfantasy.com/robots.txt', 'https://www.marca.com/robots.txt', 'https://news.google.com/robots.txt']) {
  const r = await get(d);
  linea(`- ${d} → ${r.s} · «${head(r.b, 700)}»`);
}
