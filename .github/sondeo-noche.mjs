// Sondeo del partido Osasuna-Deportivo (2 nov 2026, 21:00 hora de Madrid = 20:00Z). Solo lee, sin claves ni token.
// Mide: cuándo salen las alineaciones en ESPN, en la API de LaLiga y en futbolfantasy; cuándo ve cada una de las dos
// fuentes (ESPN y LaLiga) cada gol, tarjeta y cambio de marcador; y si los puntos (weekPoints) de LaLiga se mueven en directo.
// Uso: node sondeo-noche.mjs --hasta=2026-11-02T18:30:00Z   (el estado pasa de un paso al siguiente en estado-sondeo.json)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const HASTA = Date.parse(arg('hasta')) || Date.now() + 60000;
const FICHERO = arg('estado') || 'estado-sondeo.json';
const FUERA_FF = arg('sinff') === '1';
const KICK = Date.parse('2026-11-02T20:00:00Z');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const LAL = 'https://fantasy-api.llt-services.com';
const MATCH_LAL = '108';

const E = existsSync(FICHERO) ? JSON.parse(readFileSync(FICHERO, 'utf8')) : { vistos: {}, lal: {}, espn: {}, ff: {}, ms: [], fallos: 0, eventos: [], ciclos: 0 };
const guardar = () => writeFileSync(FICHERO, JSON.stringify(E));
const hora = () => new Date().toISOString().slice(11, 19) + 'Z';
const log = (s) => console.log(`[${hora()}] ${s}`);
const evento = (fuente, tipo, texto) => { E.eventos.push({ t: hora(), fuente, tipo, texto }); log(`${fuente} · ${tipo} · ${texto}`); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (b) => { try { return JSON.parse(b); } catch { return null; } };

async function get(url, h = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...h }, signal: AbortSignal.timeout(20000) });
    const b = await r.text();
    const ms = Date.now() - t0;
    E.ms.push(ms); if (E.ms.length > 400) E.ms.shift();
    if (r.status !== 200) { E.fallos++; log(`HTTP ${r.status} en ${url.replace(/\?.*/, '').slice(-60)}`); }
    return { s: r.status, b, ms };
  } catch (e) { E.fallos++; log(`ERROR ${String(e.cause?.code || e.message)} en ${url.replace(/\?.*/, '').slice(-60)}`); return { s: 0, b: '', ms: Date.now() - t0 }; }
}

// ESPN: marcador, estado y `details` (goles, tarjetas con minuto) y, desde una hora antes, el resumen (alineaciones)
async function espn(conSumario) {
  const sb = await get(`${ESPN}/scoreboard`);
  const j = J(sb.b);
  const ev = (j?.events || []).find((e) => /OSA/.test(e.shortName || '') && /DEP/.test(e.shortName || ''));
  if (!ev) { if (E.ciclos % 10 === 0) log('ESPN: no veo Osasuna-Deportivo en el scoreboard'); return; }
  if (!E.espn.id) log(`ESPN: partido encontrado id=${ev.id} ${ev.shortName} ${ev.date} estado=${ev.status?.type?.name}`);
  E.espn.id = ev.id;
  const c = ev.competitions?.[0] || {};
  const estado = `${ev.status?.type?.name}|${ev.status?.displayClock || ''}|${(c.competitors || []).map((x) => x.score).join('-')}`;
  if (E.espn.estado !== estado) { if (E.espn.estado) evento('ESPN', 'estado', estado); E.espn.estado = estado; }
  for (const d of c.details || []) {
    const sig = `${d.type?.text}|${d.clock?.displayValue}|${(d.athletesInvolved || []).map((a) => a.displayName).join('+')}`;
    if (!E.vistos[sig]) { E.vistos[sig] = hora(); evento('ESPN', 'detalle', sig); }
  }
  if (conSumario) {
    const sm = await get(`${ESPN}/summary?event=${ev.id}`);
    const s = J(sm.b);
    if (s) {
      const ros = s.rosters || [];
      const n = ros.reduce((a, r) => a + (r.roster || []).length, 0);
      const tit = ros.reduce((a, r) => a + (r.roster || []).filter((x) => x.starter).length, 0);
      const k = `${n}/${tit}`;
      if (E.espn.ros !== k) { evento('ESPN', 'alineaciones', `jugadores=${n} titulares=${tit} formaciones=${ros.map((r) => r.formation).join(',')}`); E.espn.ros = k; }
      const ke = (s.keyEvents || []).length;
      if (E.espn.ke !== ke) { evento('ESPN', 'keyEvents', `${E.espn.ke ?? 0}→${ke}`); E.espn.ke = ke; }
    }
  }
}

// API de LaLiga sin token: estado, marcador, jugadores del partido y cambios de weekPoints
async function liga() {
  const r = await get(`${LAL}/stats/v1/competition/1/stats/week/11?x-lang=es`, { 'x-app': '2' });
  const j = J(r.b);
  const m = (Array.isArray(j) ? j : []).find((x) => String(x.id) === MATCH_LAL);
  if (!m) { log('LaLiga: no veo el partido 108 en stats/week/11'); return; }
  const jug = [...(m.local?.players || []), ...(m.visitor?.players || [])];
  const estado = `estado=${m.matchState} marcador=${m.localScore}-${m.visitorScore}`;
  if (E.lal.estado !== estado) { evento('LaLiga', 'estado', estado); E.lal.estado = estado; }
  if (E.lal.n !== jug.length) { evento('LaLiga', 'jugadores', `${E.lal.n ?? 0}→${jug.length}`); E.lal.n = jug.length; }
  const pts = E.lal.pts || (E.lal.pts = {});
  const cambios = [];
  for (const p of jug) {
    const v = p.weekPoints;
    if (pts[p.id] !== v) { if (pts[p.id] !== undefined) cambios.push(`${p.nickname || p.name} ${pts[p.id]}→${v}`); pts[p.id] = v; }
  }
  if (cambios.length) evento('LaLiga', 'puntos', `${cambios.length} cambios: ${cambios.slice(0, 8).join(', ')}${cambios.length > 8 ? '…' : ''}`);
  E.lal.suma = jug.reduce((a, p) => a + (Number(p.weekPoints) || 0), 0);
}

async function semana() {
  const r = await get(`${LAL}/api/v1/competition/1/week/current?x-lang=es`, { 'x-app': '2' });
  const j = J(r.b);
  const k = j ? `isLive=${j.isLive} semana=${j.weekNumber}` : '';
  if (k && E.lal.sem !== k) { evento('LaLiga', 'semana', k); E.lal.sem = k; }
}

// futbolfantasy: ¿ya pone «Alineación confirmada» para este partido? (se apunta el texto que sigue, con día y hora)
async function ff() {
  for (const slug of ['osasuna', 'deportivo']) {
    const r = await get(`https://www.futbolfantasy.com/laliga/equipos/${slug}`);
    if (r.s !== 200) continue;
    const t = r.b.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const marcas = [...t.matchAll(/.{0,50}Alineaci[oó]n confirmada.{0,110}/gi)].map((m) => m[0].trim());
    const k = marcas.join(' | ');
    if (E.ff[slug] !== k) { evento('futbolfantasy', slug, `confirmada x${marcas.length}: ${k.slice(0, 600)}`); E.ff[slug] = k; }
  }
}

log(`inicio del paso, hasta ${new Date(HASTA).toISOString().slice(11, 19)}Z`);
while (Date.now() < HASTA) {
  const antes = Date.now();
  const cerca = KICK - antes < 3600e3;     // desde una hora antes: cada 30 s y con el resumen de ESPN
  E.ciclos++;
  await Promise.all([espn(cerca), liga(), E.ciclos % 8 === 1 ? semana() : null,
    (!FUERA_FF && antes < KICK && E.ciclos % (cerca ? 6 : 2) === 1) ? ff() : null]);
  guardar();
  if (E.ciclos % (cerca ? 10 : 3) === 0) {
    const ms = [...E.ms].sort((a, b) => a - b);
    log(`latido · ciclos=${E.ciclos} fallos=${E.fallos} mediana=${ms[Math.floor(ms.length / 2)] || 0}ms · ESPN ${E.espn.estado || '-'} · LaLiga ${E.lal.estado || '-'} jugadores=${E.lal.n ?? 0} suma=${E.lal.suma ?? '-'}`);
  }
  const espera = (cerca ? 30000 : 120000) - (Date.now() - antes);
  if (Date.now() + Math.max(espera, 0) >= HASTA) break;
  await dormir(Math.max(espera, 1000));
}
if (arg('resumen') === '1') {
  log('RESUMEN de eventos, por orden de aparición:');
  for (const e of E.eventos) console.log(`  ${e.t} ${e.fuente} ${e.tipo}: ${e.texto}`);
}
log('fin del paso');
