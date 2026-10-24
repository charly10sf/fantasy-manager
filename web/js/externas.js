/* Lo que se saca de fuera de LaLiga Fantasy, gratis y sin claves:
   - Onces probables de cada equipo (futbolfantasy.com): quién es titular, quién suplente y con qué probabilidad.
   - Titulares de prensa (Google Noticias): de tus jugadores, de los candidatos y de LaLiga Fantasy en general,
     que recoge lo que publican Futbol Fantasy, Jornada Perfecta, Comuniate, Analítica Fantasy, Marca, AS, Relevo…
   - Histórico de valor de cada jugador (la API de LaLiga, probando las rutas que ha tenido).
   - Las alineaciones confirmadas (SofaScore), en cuanto salen, una hora antes de cada partido.
   Todo pasa por el puente de la app (sin CORS) y se guarda un rato para no repetir. */
import { http } from './puente.js';
import { api, apuntarRegistro } from './api.js';
import { norm, LS, DIA, HORA, MIN, enParalelo, ms, num } from './util.js';

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

/* ---------------- onces probables (futbolfantasy.com) ---------------- */
// los equipos de LaLiga 26/27 con su dirección en futbolfantasy.com
const EQUIPOS_FF = {
  alaves: 'Alavés', athletic: 'Athletic', atletico: 'Atlético', barcelona: 'Barcelona', betis: 'Betis', celta: 'Celta',
  deportivo: 'Deportivo', elche: 'Elche', espanyol: 'Espanyol', getafe: 'Getafe', levante: 'Levante', malaga: 'Málaga',
  osasuna: 'Osasuna', racing: 'Racing', 'rayo-vallecano': 'Rayo', 'real-madrid': 'Real Madrid', 'real-sociedad': 'Real Sociedad',
  sevilla: 'Sevilla', valencia: 'Valencia', villarreal: 'Villarreal', girona: 'Girona', mallorca: 'Mallorca', 'real-oviedo': 'Oviedo',
};
/** a qué página de futbolfantasy corresponde cada equipo de la API */
function slugsDe(equipos) {
  const out = {};
  for (const [id, e] of Object.entries(equipos || {})) {
    const n = norm(e.nombre);
    const slug = Object.entries(EQUIPOS_FF).find(([s, nombre]) => n === norm(nombre) || n.includes(norm(nombre)) || norm(nombre).includes(n) || n.replace(/ /g, '-') === s)?.[0];
    if (slug) out[id] = slug;
  }
  return out;
}
const nombreDeSlug = (href) => { const m = href && String(href).match(/\/jugadores\/([^/?#]+)/); return m ? m[1].replace(/-/g, ' ') : ''; };

/** lee la página de un equipo: [{ nombre, corto, titular, prob, estado }] */
export function parseOnce(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const visto = new Set();
  const meter = (x) => { const k = norm(x.nombre || x.corto); if (!k || visto.has(k)) return; visto.add(k); out.push(x); };
  const estadoDe = (a) => { const l = a && a.getAttribute('data-lesion'); return l === '0' ? 'injured' : l === '1' || l === '2' ? 'doubtful' : 'ok'; };
  const probDe = (el) => {
    if (!el) return null;
    const a = el.getAttribute('data-probabilidad') || el.getAttribute('data-probability');
    if (a && /\d/.test(a)) return Math.min(100, parseInt(a, 10));
    const m = (el.textContent || '').match(/(\d{1,3})\s*%/);
    return m ? Math.min(100, parseInt(m[1], 10)) : null;
  };
  // el campo: cada camiseta lleva al titular y, detrás, sus alternativas
  const camisetas = [...doc.querySelectorAll('.camiseta-wrapper[data-onceff], .camiseta-wrapper')];
  for (const w of camisetas) {
    const titularW = String(w.getAttribute('data-onceff') || 'titular').toLowerCase() === 'titular';
    const anchors = [...w.querySelectorAll('a.juggador, a.jugador, a[href*="/jugadores/"]')];
    anchors.forEach((a, i) => {
      const corto = (a.querySelector('.truncate-name') || {}).textContent || a.getAttribute('title') || '';
      meter({ nombre: nombreDeSlug(a.getAttribute('href')), corto: corto.trim(), titular: titularW && i === 0, alternativa: i > 0, prob: probDe(a) ?? (i === 0 ? probDe(w) : null), estado: estadoDe(a) });
    });
  }
  // la lista (formato antiguo): titulares y suplentes por separado
  for (const [sel, titular] of [['[class*="jugadores-titulares"] .jugador', true], ['[class*="jugadores-suplentes"] .jugador', false]]) {
    for (const el of doc.querySelectorAll(sel)) {
      const a = el.querySelector('a[href*="/jugadores/"]') || el;
      meter({ nombre: nombreDeSlug(a.getAttribute && a.getAttribute('href')), corto: (el.getAttribute('data-nombre') || (el.querySelector('.nombre') || {}).textContent || '').trim(), titular, alternativa: !titular, prob: probDe(el), estado: estadoDe(el) });
    }
  }
  return out.filter((x) => (x.nombre || x.corto).length >= 2);
}

/** casa los jugadores del once probable con los de la API: { pid: { titular, alternativa, prob, estado } } */
function unirOnce(lista, jugadoresEquipo) {
  const out = {};
  for (const x of lista) {
    const largo = norm(x.nombre), corto = norm(x.corto);
    const j = jugadoresEquipo.find((p) => norm(p.largo) === largo || norm(p.nombre) === corto || norm(p.nombre) === largo)
      || jugadoresEquipo.find((p) => largo && (largo.includes(norm(p.nombre)) || norm(p.largo).includes(largo)))
      || jugadoresEquipo.find((p) => corto && corto.length > 3 && norm(p.nombre).includes(corto));
    if (j && !out[j.id]) out[j.id] = { titular: x.titular, alternativa: x.alternativa, prob: x.prob, estado: x.estado };
  }
  return out;
}

/** los onces probables de todos los equipos (se guardan 6 horas) */
export async function oncesProbables(D) {
  const guardado = LS.get('onces', null);
  if (guardado && Date.now() - guardado.t < 6 * HORA && guardado.n) return guardado;
  const slugs = slugsDe(D.equipos);
  const porEquipo = {};
  for (const j of Object.values(D.maestro)) (porEquipo[j.equipoId] ||= []).push(j);
  const res = {};
  let equiposOk = 0;
  await enParalelo(Object.entries(slugs), 3, async ([eqId, slug]) => {
    const t0 = Date.now();
    const r = await http('GET', `https://www.futbolfantasy.com/laliga/equipos/${slug}`, { cabeceras: { Accept: 'text/html', 'Accept-Language': 'es-ES,es;q=0.9', 'User-Agent': UA } });
    apuntarRegistro({ ruta: `futbolfantasy once ${slug}`, s: r.s, ms: Date.now() - t0, e: r.e });
    if (r.s !== 200 || !r.b) return;
    const lista = parseOnce(r.b);
    if (!lista.length) return;
    equiposOk++;
    Object.assign(res, unirOnce(lista, porEquipo[eqId] || []));
  });
  const salida = { t: Date.now(), n: Object.keys(res).length, equipos: equiposOk, de: Object.keys(slugs).length, jugadores: res };
  if (salida.n) LS.set('onces', salida);
  return salida;
}

/* ---------------- titulares de prensa (Google Noticias) ---------------- */
export function parseRSS(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].map((it) => {
    const tx = (s) => ((it.querySelector(s) || {}).textContent || '').trim();
    let titulo = tx('title');
    const fuente = tx('source');
    if (fuente && titulo.endsWith(` - ${fuente}`)) titulo = titulo.slice(0, -(fuente.length + 3));
    return { titulo, fuente, link: tx('link'), t: ms(tx('pubDate')) };
  }).filter((x) => x.titulo);
}
async function buscarNoticias(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es&gl=ES&ceid=ES:es`;
  const t0 = Date.now();
  const r = await http('GET', url, { cabeceras: { Accept: 'application/rss+xml, application/xml', 'User-Agent': UA } });
  apuntarRegistro({ ruta: `noticias «${q.slice(0, 50)}»`, s: r.s, ms: Date.now() - t0, e: r.e, forma: r.b ? `${Math.round(r.b.length / 1024)} KB` : '' });
  return r.s === 200 && r.b ? parseRSS(r.b) : [];
}

/** cómo sale un equipo en los titulares («Valencia CF» → valencia; «Real Betis» → betis; «Atlético de Madrid» → atlético) */
const STOP = new Set(['cf', 'fc', 'rcd', 'ud', 'cd', 'sad', 'club', 'de', 'futbol', 'balompie', 'ca', 'rc', 'sd', 'the']);
const ESPECIALES = [['real madrid', ['real madrid']], ['real sociedad', ['real sociedad']], ['betis', ['betis']], ['atletico', ['atletico', 'atleti']], ['athletic', ['athletic']],
  ['barcelona', ['barcelona', 'barca']], ['rayo', ['rayo']], ['celta', ['celta']], ['oviedo', ['oviedo']], ['valladolid', ['valladolid']], ['mallorca', ['mallorca']], ['alaves', ['alaves']], ['las palmas', ['las palmas']]];
export function aliasEquipo(nombre) {
  const n = norm(nombre);
  for (const [k, a] of ESPECIALES) if (n.includes(k)) return a;
  const tok = n.split(' ').filter((w) => !STOP.has(w) && w.length > 2);
  return tok.length ? [tok.join(' ')] : [n];
}

/** titulares de los últimos días: tus jugadores, los candidatos, sus equipos y LaLiga Fantasy en general (se guardan 1 hora) */
export async function noticias(D, M) {
  const guardado = LS.get('noticias', null);
  if (guardado && Date.now() - guardado.t < HORA && guardado.lista && guardado.lista.length) return guardado;
  const nombres = [];
  const add = (j) => { if (j && j.nombre && j.nombre.length > 2 && !nombres.some((x) => x.id === j.id)) nombres.push(j); };
  M.mias.forEach((x) => add(x.j));
  M.clausulas.filter((x) => x.abierta || x.abreEn < 2 * DIA).slice(0, 6).forEach((x) => add(x.j));
  M.mercado.slice(0, 6).forEach((m) => add(m.j));
  (M.especular || []).slice(0, 4).forEach((e) => add(e.j));
  // de 5 en 5 jugadores por búsqueda (con su equipo para no confundir apellidos)
  const grupos = [];
  for (let i = 0; i < nombres.length && grupos.length < 6; i += 5) {
    grupos.push(`(${nombres.slice(i, i + 5).map((j) => `"${j.nombre}"`).join(' OR ')}) when:3d`);
  }
  // los equipos de tus jugadores y de los candidatos: lesiones, convocatorias, ruedas de prensa, alineaciones
  const eqIds = [...new Set(nombres.map((j) => j.equipoId).filter(Boolean))];
  const eqAlias = eqIds.map((id) => ({ id, a: aliasEquipo((D.equipos[id] || {}).nombre || '')[0] })).filter((x) => x.a);
  const gruposEq = [];
  for (let i = 0; i < eqAlias.length && gruposEq.length < 5; i += 3) {
    gruposEq.push(`(${eqAlias.slice(i, i + 3).map((x) => `"${x.a}"`).join(' OR ')}) (lesión OR baja OR convocatoria OR "rueda de prensa" OR alineación OR entrenador OR once) when:2d`);
  }
  const consultas = [
    '"LaLiga Fantasy" when:2d',
    '(futbolfantasy OR "jornada perfecta" OR comuniate OR "analítica fantasy") when:2d',
    '(lesión OR lesionado OR baja OR convocatoria) LaLiga when:2d',
    'LaLiga (previa OR crónica OR "once probable") when:2d',
    ...grupos,
    ...gruposEq,
  ];
  const listas = await enParalelo(consultas, 3, (q) => buscarNoticias(q));
  const vistos = new Set();
  const todas = [];
  for (const l of listas) for (const n of Array.isArray(l) ? l : []) {
    const k = norm(n.titulo).slice(0, 80);
    if (vistos.has(k)) continue;
    vistos.add(k);
    todas.push(n);
  }
  // a qué jugadores se refiere cada titular
  const candidatos = Object.values(D.maestro).filter((j) => j.nombre && j.nombre.length > 3);
  const alias = Object.entries(D.equipos || {}).map(([id, e]) => ({ id, a: aliasEquipo(e.nombre || '') }));
  for (const n of todas) {
    const t = ` ${norm(n.titulo)} `;
    n.pids = candidatos.filter((j) => t.includes(` ${norm(j.nombre)} `)).map((j) => j.id).slice(0, 4);
    n.equipos = alias.filter((x) => x.a.some((a) => t.includes(` ${a} `))).map((x) => x.id).slice(0, 3);
  }
  const lista = todas.filter((n) => !n.t || Date.now() - n.t < 4 * DIA).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 140);
  const salida = { t: Date.now(), lista };
  if (lista.length) LS.set('noticias', salida);
  return salida;
}

/* ---------------- histórico de valor (API de LaLiga) ---------------- */
// rutas que ha tenido según la temporada; la primera que responde se recuerda
const RUTAS_VALOR = [(id) => `/v1/competition/1/player/${id}/market-value`, (id) => `/v3/player/${id}/market-value`, (id) => `/v4/player/${id}/market-value`, (id) => `/v5/player/${id}/market-value`];
function parseValores(r) {
  const out = [];
  const visitar = (x, prof) => {
    if (!x || prof > 4) return;
    if (Array.isArray(x)) {
      for (const v of x) {
        if (v && typeof v === 'object' && v.marketValue != null) {
          const t = ms(v.date || v.day || v.createdAt || v.marketValueDate);
          if (t) out.push([t, num(v.marketValue)]);
        } else visitar(v, prof + 1);
      }
      return;
    }
    if (typeof x === 'object') Object.values(x).forEach((y) => visitar(y, prof + 1));
  };
  visitar(r, 0);
  return out.filter(([, v]) => v > 0).sort((a, b) => a[0] - b[0]);
}
export const rutaValorFalla = () => { const t = LS.get('ruta-valor-falla', 0); return !!t && Date.now() - t < DIA; };
export async function historialValor(pid) {
  const elegida = LS.get('ruta-valor', null);
  if (elegida == null && rutaValorFalla()) return null;
  const orden = elegida != null ? [elegida] : RUTAS_VALOR.map((_, i) => i);
  for (const i of orden) {
    try {
      const v = parseValores(await api.crudo(RUTAS_VALOR[i](pid)));
      if (v.length > 2) { if (elegida == null) LS.set('ruta-valor', i); return v.slice(-90); }
    } catch (e) {
      if (e.sesion) throw e;
    }
  }
  // ninguna ruta funciona: no se vuelve a probar en un día
  if (elegida == null) LS.set('ruta-valor-falla', Date.now());
  return null;
}

/* ---------------- estadísticas avanzadas: Understat (xG, xA, tiros, pases clave) y SofaScore (notas) ----------------
   Fuera del Fantasy, para ver el rendimiento de verdad: si genera ocasiones aunque no marque, si su nota baja, cuánto
   defiende. Understat da en una sola petición todos los jugadores y equipos de LaLiga; SofaScore, jugador a jugador,
   solo para los tuyos y los mejores candidatos. Todo se guarda 12 horas. Si una web no responde o bloquea, se sigue
   sin ella. */
const HUSO = () => { const d = new Date(); return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; };
const n0 = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
/** el JSON que Understat mete en el HTML con \xNN (bytes UTF-8) */
function deUnderstat(html, variable) {
  const m = String(html || '').match(new RegExp(`${variable}\\s*=\\s*JSON\\.parse\\('([^']+)'\\)`));
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1].replace(/%/g, '%25').replace(/\\x([0-9A-Fa-f]{2})/g, '%$1'))); } catch (e) { return null; }
}
async function pedirJSON(url, cab = {}, etiqueta = url) {
  const t0 = Date.now();
  const r = await http('GET', url, { cabeceras: { Accept: 'application/json, text/plain, */*', 'User-Agent': UA, ...cab } });
  apuntarRegistro({ ruta: etiqueta, s: r.s, ms: Date.now() - t0, e: r.e, forma: r.b ? `${Math.round(r.b.length / 1024)} KB` : '' });
  if (r.s !== 200 || !r.b) { const e = new Error(r.s ? `${r.s}` : r.e || 'sin respuesta'); e.estado = r.s; throw e; }
  try { return JSON.parse(r.b); } catch (e) { return { __html: r.b }; }
}
async function understat() {
  const temp = HUSO();
  const ref = `https://understat.com/league/La_liga/${temp}`;
  let j = null;
  try { j = await pedirJSON(`https://understat.com/getLeagueData/La_liga/${temp}`, { 'X-Requested-With': 'XMLHttpRequest', Referer: ref }, `understat datos ${temp}`); } catch (e) { j = null; }
  if (!j || (!j.players && !j.teams)) {
    const h = await pedirJSON(ref, { Accept: 'text/html' }, `understat página ${temp}`);
    const html = h.__html || '';
    j = { players: deUnderstat(html, 'playersData'), teams: deUnderstat(html, 'teamsData') };
  }
  return j;
}
const mismoEquipo = (a, b) => { const x = aliasEquipo(a), y = aliasEquipo(b); return x.some((k) => y.includes(k)); };
// (para los pocos equipos, basta comparar los alias; para los cientos de jugadores, se agrupan antes)
const ult = (s) => norm(s).split(' ').pop();

/** los datos de Understat de cada jugador de LaLiga Fantasy (por nombre y equipo) y de cada equipo (xG por partido) */
function cruzarUnderstat(D, u) {
  const jugadores = {}, equipos = {};
  const players = Array.isArray(u && u.players) ? u.players : [];
  // agrupados por equipo (Understat a veces pone «Barcelona,Valencia» si cambió de equipo: cuenta el último)
  const clave = (n) => aliasEquipo(n)[0];
  const porEquipo = {};
  for (const p of players) { const t = String(p.team_title || '').split(',').pop(); (porEquipo[clave(t)] ||= []).push(p); }
  const claveEq = {};
  for (const [id, e] of Object.entries(D.equipos || {})) claveEq[id] = clave(e.nombre || '');
  for (const j of Object.values(D.maestro)) {
    if (!j.equipoId || j.pos === 5) continue;
    const lista = porEquipo[claveEq[j.equipoId]] || [];
    if (!lista.length) continue;
    const nl = norm(j.largo), nn = norm(j.nombre);
    const p = lista.find((x) => norm(x.player_name) === nl || norm(x.player_name) === nn)
      || lista.find((x) => nn.length > 3 && (norm(x.player_name).includes(nn) || nl.includes(norm(x.player_name))))
      || (() => { const c = lista.filter((x) => ult(x.player_name) === ult(j.largo || j.nombre) && norm(x.player_name)[0] === (nl || nn)[0]); return c.length === 1 ? c[0] : null; })();
    if (!p) continue;
    jugadores[j.id] = { min: n0(p.time), pj: n0(p.games), g: n0(p.goals), xg: n0(p.xG), a: n0(p.assists), xa: n0(p.xA), tiros: n0(p.shots), pc: n0(p.key_passes), npxg: n0(p.npxG), xgc: n0(p.xGChain), xgb: n0(p.xGBuildup), am: n0(p.yellow_cards), ro: n0(p.red_cards) };
  }
  const teams = u && u.teams ? Object.values(u.teams) : [];
  for (const t of teams) {
    const id = Object.keys(D.equipos || {}).find((k) => mismoEquipo(t.title || '', D.equipos[k].nombre || ''));
    const h = Array.isArray(t.history) ? t.history : [];
    if (!id || !h.length) continue;
    const media = (l, k) => (l.length ? l.reduce((s, x) => s + n0(x[k]), 0) / l.length : null);
    const u5 = h.slice(-5);
    equipos[id] = { pj: h.length, xg: media(h, 'xG'), xga: media(h, 'xGA'), xg5: media(u5, 'xG'), xga5: media(u5, 'xGA'), ppda: media(h.map((x) => ({ v: x.ppda && x.ppda.def ? n0(x.ppda.att) / Math.max(1, n0(x.ppda.def)) : 0 })), 'v') };
  }
  return { jugadores, equipos };
}

const SOFA = 'https://api.sofascore.com/api/v1';
const SOFA_CAB = { Referer: 'https://www.sofascore.com/', Origin: 'https://www.sofascore.com' };
/** SofaScore para unos pocos jugadores: su nota media y las últimas, y lo que hace por 90 minutos */
async function sofascore(D, pids) {
  const ids = LS.get('sofa-ids', {});
  const out = {};
  const temp = await pedirJSON(`${SOFA}/unique-tournament/8/seasons`, SOFA_CAB, 'sofascore temporadas');
  const sid = temp && Array.isArray(temp.seasons) && temp.seasons[0] && temp.seasons[0].id;
  if (!sid) throw new Error('sin temporada');
  let bloqueado = false;
  await enParalelo(pids, 2, async (pid) => {
    if (bloqueado) return;
    const j = D.maestro[pid];
    if (!j) return;
    try {
      let sofaId = ids[pid];
      if (sofaId === undefined) {
        const r = await pedirJSON(`${SOFA}/search/all?q=${encodeURIComponent(j.nombre)}&page=0`, SOFA_CAB, `sofascore busca ${j.nombre}`);
        const eq = (D.equipos[j.equipoId] || {}).nombre || '';
        const c = ((r && r.results) || []).filter((x) => x.type === 'player' && x.entity && x.entity.team && mismoEquipo(x.entity.team.name || '', eq));
        sofaId = c.length ? c[0].entity.id : 0;
        ids[pid] = sofaId;
      }
      if (!sofaId) return;
      const st = await pedirJSON(`${SOFA}/player/${sofaId}/unique-tournament/8/season/${sid}/statistics/overall`, SOFA_CAB, `sofascore ${j.nombre}`).catch(() => null);
      const s = (st && st.statistics) || null;
      let notas = [];
      const res = await pedirJSON(`${SOFA}/player/${sofaId}/last-year-summary`, SOFA_CAB, `sofascore notas ${j.nombre}`).catch(() => null);
      if (res && Array.isArray(res.summary)) notas = res.summary.filter((x) => x.type === 'event' && x.value).slice(-5).map((x) => n0(x.value));
      if (s || notas.length) out[pid] = s ? { nota: n0(s.rating), min: n0(s.minutesPlayed), pj: n0(s.appearances), tit: n0(s.matchesStarted), g: n0(s.goals), xg: n0(s.expectedGoals), a: n0(s.assists), xa: n0(s.expectedAssists), pc: n0(s.keyPasses), tiros: n0(s.totalShots), regates: n0(s.successfulDribbles), entradas: n0(s.tackles), intercep: n0(s.interceptions), despejes: n0(s.clearances), recup: n0(s.ballRecovery), duelos: n0(s.totalDuelsWonPercentage), pases: n0(s.accuratePassesPercentage), paradas: n0(s.saves), encajados: n0(s.goalsConceded), ceros: n0(s.cleanSheet), notas } : { notas };
    } catch (e) {
      if (e.estado === 403 || e.estado === 429) bloqueado = true;
    }
  });
  LS.set('sofa-ids', ids);
  return { jugadores: out, bloqueado, sid };
}

/**
 * Los partidos de todas las competiciones de cada equipo de LaLiga (Champions, Europa League, Conference, Copa…),
 * para ver quién juega pegado a la jornada y puede rotar. Cambian poco: se guardan 20 horas.
 * { [equipoId]: [{ t, comp, liga, rival, casa }] }
 */
async function calendarioSofa(D, sid) {
  const guardado = LS.get('sofa-cal', null);
  if (guardado && guardado.v === 2 && Date.now() - guardado.t < 20 * HORA && Object.keys(guardado.equipos || {}).length) return guardado.equipos;
  const ids = LS.get('sofa-equipos', {});
  if (Object.keys(ids).length < 15) {
    const st = await pedirJSON(`${SOFA}/unique-tournament/8/season/${sid}/standings/total`, SOFA_CAB, 'sofascore clasificación');
    const filas = (st && Array.isArray(st.standings) && st.standings[0] && st.standings[0].rows) || [];
    for (const f of filas) {
      const t = f.team || {};
      const id = Object.keys(D.equipos || {}).find((k) => mismoEquipo(t.name || '', D.equipos[k].nombre || '') || (t.shortName && mismoEquipo(t.shortName, D.equipos[k].nombre || '')));
      if (id && t.id) ids[id] = t.id;
    }
    LS.set('sofa-equipos', ids);
  }
  const equipos = {};
  let bloqueado = false;
  await enParalelo(Object.entries(ids), 2, async ([eq, sofaId]) => {
    if (bloqueado) return;
    try {
      const r = await pedirJSON(`${SOFA}/team/${sofaId}/events/next/0`, SOFA_CAB, `sofascore partidos ${(D.equipos[eq] || {}).nombre || eq}`);
      const lista = [];
      for (const ev of (r && r.events) || []) {
        const t = n0(ev.startTimestamp) * 1000;
        const ut = (ev.tournament && ev.tournament.uniqueTournament) || {};
        // los de otras competiciones, para la rotación (los próximos 25 días); los de LaLiga, todos (para el historial)
        if (!t || (ut.id !== 8 && t > Date.now() + 25 * DIA)) continue;
        const casa = ev.homeTeam && ev.homeTeam.id === sofaId;
        const otro = casa ? ev.awayTeam : ev.homeTeam;
        lista.push({ t, comp: ut.name || (ev.tournament && ev.tournament.name) || '', liga: ut.id === 8, rival: (otro && (otro.shortName || otro.name)) || '', casa, cid: ev.customId || null, yoS: sofaId, rivalS: (otro && otro.id) || null });
      }
      // los que ya tenía guardados de los últimos días (un partido de anteayer también cansa)
      const viejos = ((guardado && guardado.equipos && guardado.equipos[eq]) || []).filter((x) => x.t < Date.now() && Date.now() - x.t < 6 * DIA && !lista.some((y) => Math.abs(y.t - x.t) < HORA));
      equipos[eq] = [...viejos, ...lista].sort((a, b) => a.t - b.t);
    } catch (e) {
      if (e.estado === 403 || e.estado === 429) bloqueado = true;
    }
  });
  if (Object.keys(equipos).length) LS.set('sofa-cal', { v: 2, t: Date.now(), equipos });
  return equipos;
}

/**
 * el historial de enfrentamientos de los próximos partidos de LaLiga (SofaScore, todas las competiciones): por
 * cada pareja de equipos, sus últimos partidos ya jugados. Cambia una vez por partido: se guarda 7 días, y cada vez
 * se piden como mucho 16 parejas nuevas (primero las de los equipos de tus jugadores y los que te interesan).
 * { [sofaA-sofaB]: { t, ev: [{ t, h, a, gh, ga, comp }] } } (h y a: ids de SofaScore del local y el visitante)
 */
async function historialSofa(D, calendario, equiposFoco) {
  const guardado = LS.get('sofa-h2h', {});
  const pares = {};
  for (const [k, v] of Object.entries(guardado)) if (v && Date.now() - v.t < 30 * DIA) pares[k] = v;
  const pendientes = [];
  const vistos = new Set();
  const orden = Object.keys(calendario || {}).sort((a, b) => (equiposFoco.has(b) ? 1 : 0) - (equiposFoco.has(a) ? 1 : 0));
  for (const eq of orden) {
    for (const x of calendario[eq] || []) {
      if (!x.liga || !x.cid || !x.yoS || !x.rivalS || x.t < Date.now() - 3 * HORA) continue;
      const clave = [x.yoS, x.rivalS].sort((a, b) => a - b).join('-');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      if (pares[clave] && Date.now() - pares[clave].t < 7 * DIA) continue;
      pendientes.push({ clave, cid: x.cid });
    }
  }
  let bloqueado = false;
  await enParalelo(pendientes.slice(0, 16), 2, async ({ clave, cid }) => {
    if (bloqueado) return;
    try {
      const r = await pedirJSON(`${SOFA}/event/${encodeURIComponent(cid)}/h2h/events`, SOFA_CAB, `sofascore historial ${clave}`);
      const ev = [];
      for (const e of (r && r.events) || []) {
        const gh = e.homeScore && e.homeScore.current, ga = e.awayScore && e.awayScore.current;
        const t = n0(e.startTimestamp) * 1000;
        if (gh == null || ga == null || !t || t > Date.now() || (e.status && e.status.type && e.status.type !== 'finished')) continue;
        const ut = (e.tournament && e.tournament.uniqueTournament) || {};
        ev.push({ t, h: e.homeTeam && e.homeTeam.id, a: e.awayTeam && e.awayTeam.id, gh: n0(gh), ga: n0(ga), comp: ut.name || '' });
      }
      ev.sort((a, b) => b.t - a.t);
      pares[clave] = { t: Date.now(), ev: ev.slice(0, 6) };
    } catch (e) {
      if (e.estado === 403 || e.estado === 429) bloqueado = true;
    }
  });
  LS.set('sofa-h2h', pares);
  return pares;
}

/** estadísticas avanzadas de los tuyos y los candidatos (se guardan 12 horas) */
export async function avanzadas(D, M, pidsFoco = []) {
  const guardado = LS.get('avanzadas', null);
  // (lo guardado antes del historial de enfrentamientos se rehace una vez para traerlo)
  if (guardado && guardado.h2h && Date.now() - guardado.t < 12 * HORA && guardado.liga === (D.liga && D.liga.id)) return guardado;
  const out = { t: Date.now(), liga: D.liga && D.liga.id, jugadores: {}, sofa: {}, equipos: {}, fuentes: {}, h2h: {} };
  try {
    const u = await understat();
    const c = cruzarUnderstat(D, u);
    out.jugadores = c.jugadores; out.equipos = c.equipos;
    out.fuentes.understat = `${Object.keys(c.jugadores).length} jugadores, ${Object.keys(c.equipos).length} equipos`;
  } catch (e) { out.fuentes.understat = `no responde (${e.message})`; }
  let sid = null;
  try {
    const s = await sofascore(D, pidsFoco.slice(0, 32));
    out.sofa = s.jugadores; sid = s.sid;
    out.fuentes.sofascore = `${Object.keys(s.jugadores).length} jugadores${s.bloqueado ? ' (cortado: bloquea)' : ''}`;
  } catch (e) { out.fuentes.sofascore = `no responde (${e.message})`; }
  if (sid) {
    try {
      out.calendario = await calendarioSofa(D, sid);
      const otros = Object.values(out.calendario).reduce((n, l) => n + l.filter((x) => !x.liga).length, 0);
      out.fuentes.calendario = `${Object.keys(out.calendario).length} equipos, ${otros} partidos fuera de LaLiga`;
    } catch (e) { out.fuentes.calendario = `no responde (${e.message})`; }
    try {
      // primero los equipos de los tuyos y de los que te interesan
      const foco = new Set(pidsFoco.map((pid) => (D.maestro[pid] || {}).equipoId).filter(Boolean));
      out.h2h = await historialSofa(D, out.calendario || {}, foco);
      out.sofaEquipos = LS.get('sofa-equipos', {});
      out.fuentes.historial = `${Object.keys(out.h2h).length} parejas de equipos`;
    } catch (e) { out.fuentes.historial = `no responde (${e.message})`; }
  }
  if (Object.keys(out.jugadores).length || Object.keys(out.sofa).length || Object.keys(out.calendario || {}).length) LS.set('avanzadas', out);
  return out;
}

/* ---------------- alineaciones confirmadas (SofaScore) ----------------
   Una hora antes de cada partido salen los onces de verdad. SofaScore los da marcados con «confirmed»: los titulares,
   los del banquillo y los que faltan (lesionados, sancionados); el que no sale en ninguna lista no va convocado.
   Antes de eso, lo que da SofaScore es su once probable (sin «confirmed») y no se usa: para eso está el de
   futbolfantasy. Solo se piden los partidos de LaLiga que empiezan en menos de 75 minutos o se están jugando, y uno
   ya confirmado no se vuelve a pedir.
   { t, partidos: { [ev]: { t, ini, local, visitante, conf, jug: { pid: estado } } },
     jugadores: { [pid]: { estado: 'titular'|'suplente'|'fuera'|'baja', ini } } } */
export const ANTES_ONCE = 75 * MIN, DURA_PARTIDO = 2.5 * HORA;
const casaEquipo = (a, b) => {
  if (mismoEquipo(a, b)) return true;
  const x = aliasEquipo(a)[0], y = aliasEquipo(b)[0];
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x));
};
/** los partidos que importan ahora: los que empiezan en menos de 75 minutos o se están jugando */
export const partidosConOnce = (D, ahora = Date.now()) => ((D && D.partidos) || []).filter((p) => p.fecha && p.fecha - ahora < ANTES_ONCE && ahora - p.fecha < DURA_PARTIDO);
/** ¿hay alguno de esos sin alineación confirmada todavía? (para mirar cada pocos minutos) */
export function faltaOnce(D) {
  const g = LS.get('alineaciones', null);
  const P = Object.values((g && g.partidos) || {});
  return partidosConOnce(D).some((p) => !P.some((x) => x.conf && x.local === p.localId && x.visitante === p.visitanteId));
}
async function temporadaSofa() {
  const g = LS.get('sofa-sid', null);
  if (g && g.id && Date.now() - g.t < 7 * DIA) return g.id;
  const temp = await pedirJSON(`${SOFA}/unique-tournament/8/seasons`, SOFA_CAB, 'sofascore temporadas');
  const id = temp && Array.isArray(temp.seasons) && temp.seasons[0] && temp.seasons[0].id;
  if (!id) throw new Error('sin temporada');
  LS.set('sofa-sid', { id, t: Date.now() });
  return id;
}
/** los partidos de una jornada en SofaScore, con los equipos ya casados con los de LaLiga (se guardan 3 horas) */
async function rondaSofa(D, n) {
  const g = LS.get('sofa-ronda', {});
  if (g[n] && Date.now() - g[n].t < 3 * HORA && g[n].ev.length) return g[n].ev;
  const sid = await temporadaSofa();
  const r = await pedirJSON(`${SOFA}/unique-tournament/8/season/${sid}/events/round/${n}`, SOFA_CAB, `sofascore jornada ${n}`);
  const ids = LS.get('sofa-equipos', {});
  const eqDe = (t) => {
    if (!t) return null;
    const porId = Object.keys(ids).find((k) => ids[k] === t.id);
    if (porId) return porId;
    return Object.keys(D.equipos || {}).find((k) => casaEquipo(t.name || '', D.equipos[k].nombre || '') || (t.shortName && casaEquipo(t.shortName, D.equipos[k].nombre || ''))) || null;
  };
  const ev = ((r && r.events) || []).map((e) => ({ id: e.id, t: n0(e.startTimestamp) * 1000, local: eqDe(e.homeTeam), visitante: eqDe(e.awayTeam), nombre: `${(e.homeTeam && e.homeTeam.shortName) || ''}-${(e.awayTeam && e.awayTeam.shortName) || ''}` })).filter((e) => e.id && e.local && e.visitante);
  const otro = {};
  for (const [k, v] of Object.entries(g)) if (Number(k) >= n - 2 && Number(k) <= n + 2) otro[k] = v;
  LS.set('sofa-ronda', { ...otro, [n]: { t: Date.now(), ev } });
  return ev;
}
/** casa los convocados de SofaScore con los jugadores de LaLiga Fantasy: { pid: estado } */
export function cruzarOnce(D, e, r) {
  const sofaIds = LS.get('sofa-ids', {});
  const out = {};
  for (const [lado, eq] of [['home', e.local], ['away', e.visitante]]) {
    const L = (r && r[lado]) || {};
    // (sin la lista de ese equipo no se puede decir quién no va)
    if (!(L.players || []).length) continue;
    const nuestros = Object.values(D.maestro || {}).filter((j) => String(j.equipoId) === String(eq) && j.pos !== 5);
    const entradas = [
      ...(L.players || []).map((x) => ({ p: x.player || {}, estado: x.substitute ? 'suplente' : 'titular' })),
      ...(L.missingPlayers || []).map((x) => ({ p: x.player || {}, estado: 'baja' })),
    ].map((x) => ({ ...x, nm: norm(x.p.name), sn: norm(String(x.p.shortName || '').replace(/^\S{1,3}\.\s*/, '')), ln: norm(x.p.lastName || ''), casado: null }));
    const libres = new Set(nuestros.map((j) => j.id));
    // de lo más seguro a lo menos: el id de SofaScore, el nombre entero, el apellido (si solo hay uno), parte del nombre
    const pasos = [
      (x, j) => sofaIds[j.id] && sofaIds[j.id] === x.p.id,
      (x, j) => norm(j.largo) === x.nm || norm(j.nombre) === x.nm,
      (x, j) => norm(j.nombre) === x.sn || (x.ln && norm(j.nombre) === x.ln) || (x.ln && norm(j.largo) === x.ln),
      (x, j) => { const a = norm(j.nombre), b = norm(j.largo); return (a.length > 3 && x.nm.includes(a)) || (b.length > 3 && (b.includes(x.nm) || x.nm.includes(b))); },
      (x, j) => ult(j.largo || j.nombre) === ult(x.p.name || '') && ult(x.p.name || '').length > 3,
    ];
    for (const [i, f] of pasos.entries()) {
      for (const x of entradas) {
        if (x.casado) continue;
        const c = nuestros.filter((j) => libres.has(j.id) && f(x, j));
        if (c.length === 1 || (i < 2 && c.length)) { x.casado = c[0]; libres.delete(c[0].id); out[c[0].id] = x.estado; }
      }
    }
    // los que no salen en ninguna lista no van convocados; salvo que se parezcan a alguno que no se ha podido casar
    const sueltos = new Set(entradas.filter((x) => !x.casado && x.estado !== 'baja').flatMap((x) => x.nm.split(' ').filter((w) => w.length >= 4)));
    for (const pid of libres) {
      const j = D.maestro[pid];
      const suyos = norm(`${j.nombre} ${j.largo || ''}`).split(' ').filter((w) => w.length >= 4);
      if (!suyos.some((w) => sueltos.has(w))) out[pid] = 'fuera';
    }
  }
  return out;
}
/** las alineaciones de los partidos que empiezan ya (o se están jugando) */
export async function alineaciones(D) {
  const g = LS.get('alineaciones', null);
  const ahora = Date.now();
  const P = {};
  for (const [id, p] of Object.entries((g && g.partidos) || {})) if (p.ini > ahora - DIA) P[id] = p;
  const faltan = partidosConOnce(D, ahora).filter((p) => !Object.values(P).some((x) => x.conf && x.local === p.localId && x.visitante === p.visitanteId));
  if (faltan.length && !D.demo) {
    try {
      const evs = [];
      for (const n of [...new Set(faltan.map((p) => p.jornada).filter(Boolean))]) evs.push(...(await rondaSofa(D, n)));
      const pedir = faltan.map((p) => evs.find((e) => e.local === p.localId && e.visitante === p.visitanteId))
        .filter((e) => e && (!P[e.id] || ahora - P[e.id].t > 3 * MIN));
      let bloqueado = false;
      await enParalelo(pedir, 2, async (e) => {
        if (bloqueado) return;
        const base = { t: Date.now(), ini: e.t, local: e.local, visitante: e.visitante, conf: false, jug: {} };
        try {
          // (con la hora en la dirección: si no, la caché de SofaScore da un rato el once probable de antes)
          const r = await pedirJSON(`${SOFA}/event/${e.id}/lineups?_=${Math.floor(ahora / (2 * MIN))}`, SOFA_CAB, `sofascore once ${e.nombre}`);
          P[e.id] = r && r.confirmed === true ? { ...base, conf: true, jug: cruzarOnce(D, e, r) } : base;
        } catch (er) {
          // un 404: aún no hay nada
          if (er.estado === 403 || er.estado === 429) bloqueado = true;
          P[e.id] = { ...base, e: er.message };
        }
      });
    } catch (er) { /* sin la jornada de SofaScore no se sabe qué partido es: se sigue sin alineaciones */ }
  }
  const jugadores = {};
  for (const p of Object.values(P)) if (p.conf) for (const [pid, estado] of Object.entries(p.jug || {})) jugadores[pid] = { estado, ini: p.ini };
  const out = { t: Date.now(), partidos: P, jugadores };
  if (!D.demo) LS.set('alineaciones', out);
  return out;
}

/* ---------------- las jugadas de un partido (SofaScore) ----------------
   Para la pestaña Directo: los goles (con quién asiste), las tarjetas y los cambios de un partido de LaLiga, con su
   minuto. SofaScore no deja a todos (desde algunos móviles responde 403): si corta, no se vuelve a probar en media hora
   y el partido se ve igual, con lo de LaLiga Fantasy. { t, ev, lista: [{ min, extra, tipo, casa, quien, asis,
   entra, sale, gl, gv }] } */
let sofaCortado = 0;
const nn = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
const nombreSofa = (p) => (p && (p.shortName || p.name)) || '';
export async function jugadasSofa(D, p) {
  if (!p || D.demo || Date.now() - sofaCortado < 30 * MIN) return null;
  try {
    const evs = await rondaSofa(D, p.jornada);
    const e = evs.find((x) => x.local === p.localId && x.visitante === p.visitanteId);
    if (!e) return null;
    const r = await pedirJSON(`${SOFA}/event/${e.id}/incidents?_=${Math.floor(Date.now() / MIN)}`, SOFA_CAB, `sofascore jugadas ${e.nombre}`);
    const lista = [];
    for (const i of (r && Array.isArray(r.incidents) ? r.incidents : [])) {
      const base = { min: nn(i.time), extra: nn(i.addedTime) || 0, casa: !!i.isHome };
      if (i.incidentType === 'goal') lista.push({ ...base, tipo: i.incidentClass === 'ownGoal' ? 'propia' : i.incidentClass === 'penalty' ? 'penalti' : 'gol', quien: nombreSofa(i.player) || i.playerName || '', asis: nombreSofa(i.assist1), gl: nn(i.homeScore), gv: nn(i.awayScore) });
      else if (i.incidentType === 'card') lista.push({ ...base, tipo: /red/i.test(i.incidentClass || '') ? 'roja' : 'amarilla', quien: nombreSofa(i.player) || i.playerName || '' });
      else if (i.incidentType === 'substitution') lista.push({ ...base, tipo: 'cambio', entra: nombreSofa(i.playerIn), sale: nombreSofa(i.playerOut) });
      else if (i.incidentType === 'varDecision' && i.confirmed === false) lista.push({ ...base, tipo: 'var', quien: nombreSofa(i.player) || '' });
    }
    lista.sort((a, b) => (a.min || 0) - (b.min || 0) || a.extra - b.extra);
    return { t: Date.now(), ev: e.id, lista };
  } catch (er) {
    if (er.estado === 403 || er.estado === 429 || er.message === 'sin temporada') sofaCortado = Date.now();
    return null;
  }
}
