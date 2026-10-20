/* Lo que se saca de fuera de LaLiga Fantasy, gratis y sin claves:
   - Onces probables de cada equipo (futbolfantasy.com): quién es titular, quién suplente y con qué probabilidad.
   - Titulares de prensa (Google Noticias): de tus jugadores, de los candidatos y de LaLiga Fantasy en general,
     que recoge lo que publican Futbol Fantasy, Jornada Perfecta, Comuniate, Analítica Fantasy, Marca, AS, Relevo…
   - Histórico de valor de cada jugador (la API de LaLiga, probando las rutas que ha tenido).
   Todo pasa por el puente de la app (sin CORS) y se guarda un rato para no repetir. */
import { http } from './puente.js';
import { api, apuntarRegistro } from './api.js';
import { norm, LS, DIA, HORA, enParalelo, ms, num } from './util.js';

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
