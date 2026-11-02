// Prueba de fuentes para el bot de la cuenta de X. Solo LEE: pide cada fuente una vez con un User-Agent de navegador
// y otra con uno de bot honesto, y apunta código HTTP, tamaño, tiempo y si el cuerpo parece un muro (Cloudflare, captcha).
// No usa ninguna clave ni secreto, no publica nada. Deja la tabla en el resumen del job, en anotaciones y en fuentes.json.
import { writeFileSync, appendFileSync } from 'node:fs';

const UA_NAV = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_BOT = 'FantasyManagerBot/0.1 (+https://fantasymanagerapp.com; lectura de datos publicos)';
const MURO = /just a moment|cf-chl|captcha|access denied|attention required|px-captcha|incapsula|request blocked|enable javascript/i;
const hoy = new Date();
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

async function pedir(url, ua, extra = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': ua, 'Accept-Language': 'es-ES,es;q=0.9', Accept: '*/*', ...extra },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    const b = await r.text();
    return { s: r.status, kb: +(b.length / 1024).toFixed(1), ms: Date.now() - t0, b, final: r.url !== url ? r.url : '' };
  } catch (e) {
    return { s: 0, kb: 0, ms: Date.now() - t0, b: '', err: String(e.cause?.code || e.name || e.message).slice(0, 40) };
  }
}

const cuenta = (b, re) => (b.match(re) || []).length;
const json = (b) => { try { return JSON.parse(b); } catch { return null; } };

// cada fuente: [grupo, nombre, url, cabeceras, función que mira el cuerpo y devuelve una nota corta]
const SOFA = 'https://api.sofascore.com/api/v1';
const SOFA_CAB = { Referer: 'https://www.sofascore.com/', Origin: 'https://www.sofascore.com' };
const rss = (b) => `items=${cuenta(b, /<item[ >]/g) + cuenta(b, /<entry[ >]/g)}`;
const FUENTES = [
  ['futbolfantasy', 'equipo Real Madrid', 'https://www.futbolfantasy.com/laliga/equipos/real-madrid', {}, (b) => `jugadores=${cuenta(b, /\/jugadores\//g)} data-lesion=${cuenta(b, /data-lesion=/g)} confirmada=${/Alineaci[oó]n confirmada/i.test(b)}`],
  ['futbolfantasy', 'equipo Barcelona', 'https://www.futbolfantasy.com/laliga/equipos/barcelona', {}, (b) => `jugadores=${cuenta(b, /\/jugadores\//g)} data-lesion=${cuenta(b, /data-lesion=/g)} confirmada=${/Alineaci[oó]n confirmada/i.test(b)}`],
  ['futbolfantasy', 'equipo Getafe', 'https://www.futbolfantasy.com/laliga/equipos/getafe', {}, (b) => `jugadores=${cuenta(b, /\/jugadores\//g)} data-lesion=${cuenta(b, /data-lesion=/g)}`],
  ['futbolfantasy', 'mercado', 'https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado', {}, (b) => `jugadores=${cuenta(b, /\/jugadores\//g)}`],
  ['futbolfantasy', 'portada', 'https://www.futbolfantasy.com/', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['noticias', 'Google Noticias (LaLiga)', 'https://news.google.com/rss/search?q=LaLiga+fantasy&hl=es&gl=ES&ceid=ES:es', { Accept: 'application/rss+xml' }, rss],
  ['noticias', 'Google Noticias (lesión)', 'https://news.google.com/rss/search?q=lesi%C3%B3n+LaLiga+when:1d&hl=es&gl=ES&ceid=ES:es', { Accept: 'application/rss+xml' }, rss],
  ['rss', 'Marca portada', 'https://e00-marca.uecdn.es/rss/portada.xml', {}, rss],
  ['rss', 'Marca fútbol/primera', 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml', {}, rss],
  ['rss', 'AS fútbol primera', 'https://as.com/rss/futbol/primera.xml', {}, rss],
  ['rss', 'AS últimas noticias', 'https://as.com/rss/tags/ultimas_noticias.xml', {}, rss],
  ['rss', 'Mundo Deportivo LaLiga', 'https://www.mundodeportivo.com/rss/futbol/laliga', {}, rss],
  ['rss', 'Mundo Deportivo portada', 'https://www.mundodeportivo.com/rss/home', {}, rss],
  ['rss', 'Sport portada', 'https://www.sport.es/es/rss/last-news/rss.xml', {}, rss],
  ['rss', 'Sport fútbol', 'https://www.sport.es/es/rss/futbol/rss.xml', {}, rss],
  ['clubes', 'Real Madrid noticias', 'https://www.realmadrid.com/es-ES/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['clubes', 'FC Barcelona noticias', 'https://www.fcbarcelona.es/es/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['clubes', 'Atlético noticias', 'https://www.atleticodemadrid.com/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['clubes', 'Athletic noticias', 'https://www.athletic-club.eus/es/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['clubes', 'Sevilla noticias', 'https://www.sevillafc.es/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['clubes', 'Villarreal noticias', 'https://www.villarrealcf.es/es/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['clubes', 'LaLiga noticias', 'https://www.laliga.com/noticias', {}, (b) => `enlaces=${cuenta(b, /<a /g)}`],
  ['sofascore', 'temporadas LaLiga', `${SOFA}/unique-tournament/8/seasons`, SOFA_CAB, (b) => { const j = json(b); return j ? `temporadas=${(j.seasons || []).length} primera=${j.seasons?.[0]?.year}` : 'no es JSON'; }],
  ['sofascore', 'partidos en vivo ahora', `${SOFA}/sport/football/events/live`, SOFA_CAB, (b) => { const j = json(b); return j ? `en vivo=${(j.events || []).length} laliga=${(j.events || []).filter((e) => e.tournament?.uniqueTournament?.id === 8).length}` : 'no es JSON'; }],
  ['espn', 'scoreboard LaLiga (hoy)', 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', {}, (b) => { const j = json(b); return j ? `partidos=${(j.events || []).length}` : 'no es JSON'; }],
];

const filas = [];
async function una([grupo, nombre, url, cab, mira]) {
  const nav = await pedir(url, UA_NAV, cab);
  const bot = await pedir(url, UA_BOT, cab);
  const nota = (r) => (r.s === 200 ? mira(r.b) : '');
  const muro = (r) => r.s && MURO.test(r.b.slice(0, 20000)) && r.b.length < 60000;
  filas.push({ grupo, nombre, url, nav: { s: nav.s || nav.err, kb: nav.kb, ms: nav.ms, muro: !!muro(nav), nota: nota(nav), final: nav.final }, bot: { s: bot.s || bot.err, kb: bot.kb, ms: bot.ms, muro: !!muro(bot) } });
  return { nav, bot };
}

// 1) lo fijo, de cuatro en cuatro
const cola = [...FUENTES];
await Promise.all(Array.from({ length: 4 }, async () => { while (cola.length) await una(cola.shift()); }));

// 2) lo que depende de un partido: SofaScore (alineación, incidencias, valoraciones) y ESPN (resumen con eventos)
let sofaEvento = null;
{
  const t = await pedir(`${SOFA}/unique-tournament/8/seasons`, UA_NAV, SOFA_CAB);
  const sid = json(t.b)?.seasons?.[0]?.id;
  if (sid) {
    const ult = await pedir(`${SOFA}/unique-tournament/8/season/${sid}/events/last/0`, UA_NAV, SOFA_CAB);
    const evs = json(ult.b)?.events || [];
    const ev = [...evs].reverse().find((e) => e.status?.type === 'finished') || evs[evs.length - 1];
    filas.push({ grupo: 'sofascore', nombre: 'últimos partidos de la temporada', url: `${SOFA}/unique-tournament/8/season/${sid}/events/last/0`, nav: { s: ult.s || ult.err, kb: ult.kb, ms: ult.ms, muro: false, nota: `partidos=${evs.length}` }, bot: {} });
    if (ev) {
      sofaEvento = ev.id;
      const base = `${SOFA}/event/${ev.id}`;
      const quien = `${ev.homeTeam?.shortName} ${ev.homeScore?.current}-${ev.awayScore?.current} ${ev.awayTeam?.shortName}`;
      for (const [nombre, ruta, mira] of [
        ['partido: ficha', '', (j) => `estado=${j.event?.status?.description} ${quien}`],
        ['partido: alineaciones', '/lineups', (j) => `confirmada=${j.confirmed} local=${j.home?.players?.length} visitante=${j.away?.players?.length}`],
        ['partido: incidencias (con minuto)', '/incidents', (j) => `incidencias=${(j.incidents || []).length} tipos=${[...new Set((j.incidents || []).map((i) => i.incidentType))].join(',')}`],
        ['partido: estadísticas por jugador', '/lineups', (j) => `con nota=${[...(j.home?.players || []), ...(j.away?.players || [])].filter((p) => p.statistics?.rating).length}`],
      ]) {
        const nav = await pedir(base + ruta, UA_NAV, SOFA_CAB);
        const bot = await pedir(base + ruta, UA_BOT, SOFA_CAB);
        const j = json(nav.b);
        filas.push({ grupo: 'sofascore', nombre, url: base + ruta, nav: { s: nav.s || nav.err, kb: nav.kb, ms: nav.ms, muro: false, nota: j ? mira(j) : '' }, bot: { s: bot.s || bot.err, kb: bot.kb, ms: bot.ms, muro: false } });
      }
    }
  }
}
{
  // ESPN: el marcador de los últimos días y el resumen de un partido ya jugado (goles, tarjetas, cambios con minuto)
  let id = null;
  for (let d = 0; d < 6 && !id; d++) {
    const f = ymd(new Date(hoy.getTime() - d * 86400000));
    const r = await pedir(`https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=${f}`, UA_NAV);
    const ev = (json(r.b)?.events || []).find((e) => e.status?.type?.completed);
    if (ev) {
      id = ev.id;
      filas.push({ grupo: 'espn', nombre: `scoreboard LaLiga (${f})`, url: `.../esp.1/scoreboard?dates=${f}`, nav: { s: r.s, kb: r.kb, ms: r.ms, muro: false, nota: `partidos=${json(r.b).events.length} ejemplo=${ev.shortName}` }, bot: {} });
    }
  }
  if (id) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/summary?event=${id}`;
    const nav = await pedir(url, UA_NAV);
    const bot = await pedir(url, UA_BOT);
    const j = json(nav.b);
    filas.push({ grupo: 'espn', nombre: 'resumen de un partido', url, nav: { s: nav.s || nav.err, kb: nav.kb, ms: nav.ms, muro: false, nota: j ? `claves=${Object.keys(j).slice(0, 12).join(',')} keyEvents=${(j.keyEvents || []).length} rosters=${(j.rosters || []).length} commentary=${(j.commentary || []).length}` : '' }, bot: { s: bot.s || bot.err, kb: bot.kb, ms: bot.ms, muro: false } });
  } else {
    filas.push({ grupo: 'espn', nombre: 'resumen de un partido', url: '-', nav: { s: 'sin partido en 6 días', kb: 0, ms: 0, nota: '' }, bot: {} });
  }
}

// salida
const ip = (await pedir('https://api.ipify.org', UA_NAV)).b.trim();
const cab = `Prueba desde un runner de GitHub Actions (IP ${ip}), ${hoy.toISOString()}`;
const fmt = (r) => (r.s === undefined ? '-' : `${r.s}${r.muro ? ' (muro)' : ''} · ${r.kb} KB · ${r.ms} ms`);
const md = [`### ${cab}`, '', '| Grupo | Fuente | Navegador | Bot | Nota |', '|---|---|---|---|---|', ...filas.map((f) => `| ${f.grupo} | ${f.nombre} | ${fmt(f.nav)} | ${fmt(f.bot)} | ${f.nav.nota || ''}${f.nav.final ? ` → ${f.nav.final}` : ''} |`)].join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
writeFileSync('fuentes.json', JSON.stringify({ cab, sofaEvento, filas }, null, 1));
// anotaciones: una por grupo (GitHub deja 10 por paso), para poder leerlas con la API sin bajar artefactos
const grupos = [...new Set(filas.map((f) => f.grupo))];
for (const g of grupos) {
  const t = filas.filter((f) => f.grupo === g).map((f) => `${f.nombre} | nav ${fmt(f.nav)} | bot ${fmt(f.bot)} | ${f.nav.nota || ''}`).join('%0A');
  console.log(`::notice title=${g}::${t}`);
}
