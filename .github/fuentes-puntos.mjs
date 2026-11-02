// Tercera pasada (solo lectura, sin claves): ¿hay puntos fantasy sin la sesión de un usuario de LaLiga?
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const get = async (url, h = {}) => {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...h }, signal: AbortSignal.timeout(25000) });
    const b = await r.text();
    return { s: r.status, b, ms: Date.now() - t0, u: r.url };
  } catch (e) { return { s: 0, b: '', ms: Date.now() - t0, err: String(e.cause?.code || e.message) }; }
};
const txt = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const L = (t) => console.log(t);

L('## API de LaLiga Fantasy SIN token (solo estado HTTP y forma)');
for (const u of [
  'https://fantasy-api.llt-services.com/api/v1/competition/1/players?x-lang=es',
  'https://fantasy-api.llt-services.com/stats/v1/competition/1/stats/week/1?x-lang=es',
  'https://api-fantasy.llt-services.com/api/v3/players?x-lang=es',
  'https://api-fantasy.llt-services.com/api/v3/week/current?x-lang=es',
  'https://api-fantasy.llt-services.com/api/v3/stats/week/12?x-lang=es',
]) {
  const r = await get(u, { 'x-app': '2', Accept: 'application/json' });
  L(`- ${u} → ${r.s || r.err} · ${r.b.length} B · ${r.ms} ms · «${r.b.replace(/\s+/g, ' ').slice(0, 160)}»`);
}

L('\n## futbolfantasy: páginas de puntos');
for (const u of ['https://www.futbolfantasy.com/analytics/estadisticas-puntos', 'https://www.futbolfantasy.com/analytics/estadisticas-puntos/equipos', 'https://www.futbolfantasy.com/analytics/estadisticas']) {
  const r = await get(u);
  const t = txt(r.b);
  L(`- ${u} → ${r.s || r.err} · ${(r.b.length / 1024).toFixed(0)} KB · ${r.ms} ms · jugadores=${(r.b.match(/\/jugadores\//g) || []).length} · filas=${(r.b.match(/<tr[ >]/g) || []).length}`);
  L(`  título: ${(r.b.match(/<title>([^<]*)/) || [])[1]}`);
  L(`  texto: «${t.slice(0, 900)}»`);
}

L('\n## futbolfantasy: ficha de un jugador (puntos por jornada)');
const eq = await get('https://www.futbolfantasy.com/laliga/equipos/getafe');
const enl = [...new Set([...eq.b.matchAll(/href="(https:\/\/www\.futbolfantasy\.com\/jugadores\/[^"#?]+)"/g)].map((m) => m[1]))].slice(0, 3);
L(`- enlaces de jugador: ${enl.join(' | ')}`);
if (enl[0]) {
  const r = await get(enl[0]);
  const t = txt(r.b);
  L(`- ${enl[0]} → ${r.s} · ${(r.b.length / 1024).toFixed(0)} KB`);
  const i = t.search(/puntos/i);
  L(`  «${t.slice(Math.max(0, i - 200), i + 900)}»`);
  L(`  menciones: laliga-fantasy=${/laliga fantasy/i.test(t)} jornada=${(t.match(/jornada \d+/gi) || []).slice(0, 6).join(',')}`);
}

L('\n## futbolfantasy: ¿hay directo?');
for (const u of ['https://www.futbolfantasy.com/laliga/directo', 'https://www.futbolfantasy.com/directo', 'https://www.futbolfantasy.com/laliga/puntos', 'https://www.futbolfantasy.com/laliga/jornada']) {
  const r = await get(u);
  L(`- ${u} → ${r.s || r.err} · ${(r.b.length / 1024).toFixed(0)} KB · «${(r.b.match(/<title>([^<]*)/) || [])[1]}»`);
}
