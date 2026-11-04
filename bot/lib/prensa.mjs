// Los RSS de la prensa deportiva (Carlos, 2-3 nov: novedades de prensa en el bot). Feeds comprobados desde Actions el 3 nov
// (ramas pruebas-noticias y pruebas-feeds): MARCA (Primera y un feed por club), AS (Primera), Mundo Deportivo (fútbol, LaLiga y
// Madrid, Barça y Atlético), SPORT (últimas), Cadena SER, COPE, Europa Press, La Vanguardia, ABC y El Mundo, y la prensa de cada
// zona (La Voz de Galicia, Superdeporte, Diario de Sevilla, El Correo y Diario Sur). Más medios = más noticias con dos fuentes.
// Sin feed que funcione (3 nov): Relevo, El País, El Desmarque (403), Estadio Deportivo, la web de los clubes, LaLiga y el MARCA del
// Rayo (404); 20minutos sí funciona, pero su nombre lleva una cifra y el validador la tomaría por un dato.
// De cada noticia solo se usa el titular y la entradilla, y nunca se copian: el tweet lo escribe el bot (tipos/noticias.mjs).
import { get } from './http.mjs';

export const FEEDS = [
  { medio: 'MARCA', url: 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml' },
  { medio: 'MARCA', url: 'https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml' },
  { medio: 'MARCA', url: 'https://e00-marca.uecdn.es/rss/futbol/barcelona.xml' },
  { medio: 'MARCA', url: 'https://e00-marca.uecdn.es/rss/futbol/atletico.xml' },
  { medio: 'AS', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/primera/' },
  { medio: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/rss/futbol/laliga' },
  { medio: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/rss/futbol' },
  { medio: 'SPORT', url: 'https://www.sport.es/es/rss/last-news/news.xml' },
  ...['sevilla', 'betis', 'valencia', 'athletic', 'real-sociedad', 'villarreal', 'celta', 'osasuna', 'deportivo', 'racing-santander', 'getafe',
    'alaves', 'espanyol', 'levante', 'elche', 'malaga'].map((c) => ({ medio: 'MARCA', url: `https://e00-marca.uecdn.es/rss/futbol/${c}.xml` })),
  ...['real-madrid', 'fc-barcelona', 'atletico-madrid'].map((c) => ({ medio: 'Mundo Deportivo', url: `https://www.mundodeportivo.com/rss/futbol/${c}` })),
  { medio: 'Cadena SER', url: 'https://cadenaser.com/arc/outboundfeeds/rss/category/deportes/futbol/?outputType=xml' },
  { medio: 'COPE', url: 'https://www.cope.es/rss/deportes.xml' },
  { medio: 'Europa Press', url: 'https://www.europapress.es/rss/rss.aspx?ch=00110' },
  { medio: 'La Vanguardia', url: 'https://www.lavanguardia.com/rss/deportes/futbol.xml' },
  { medio: 'ABC', url: 'https://www.abc.es/rss/2.0/deportes/futbol/' },
  { medio: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundodeporte/rss/futbol.xml' },
  { medio: 'La Voz de Galicia', url: 'https://www.lavozdegalicia.es/deportes/index.xml' },
  { medio: 'Superdeporte', url: 'https://www.superdeporte.es/rss/' },
  { medio: 'Diario de Sevilla', url: 'https://www.diariodesevilla.es/rss/deportes/' },
  { medio: 'El Correo', url: 'https://www.elcorreo.com/rss/2.0/?section=athletic' },
  { medio: 'Diario Sur', url: 'https://www.diariosur.es/rss/2.0/?section=malagacf' },
];
/** los nombres de todos los medios (para que Gemini no los cite) */
export const NOMBRES_MEDIOS = [...new Set([...FEEDS.map((f) => f.medio), 'Relevo', 'El País', 'El Desmarque', 'Estadio Deportivo', '20minutos'])];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', iexcl: '¡', iquest: '¿',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', ccedil: 'ç' };
const desEnt = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, k) => (k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : Number(k.slice(1))) : ENT[k] ?? m));
/** texto limpio: sin CDATA, con las entidades resueltas (dos veces: Marca y MD las traen dobles) y sin etiquetas */
export const limpio = (s) => desEnt(desEnt(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, ''))).replace(/<[^>]+>/g, ' ').replace(/\s*Leer\s*$/, '').replace(/\s+/g, ' ').trim();
const campo = (x, k) => ((x.match(new RegExp(`<${k}(?:\\s[^>]*)?>([\\s\\S]*?)</${k}>`)) || [])[1] || '');

/** [{ medio, titulo, entradilla, url, guid, t }] de un RSS */
export function leerRss(xml, medio) {
  const out = [];
  for (const x of String(xml).split(/<item[\s>]/).slice(1)) {
    const titulo = limpio(campo(x, 'title'));
    if (!titulo) continue;
    const url = limpio(campo(x, 'link')) || '';
    const guid = limpio(campo(x, 'guid')) || url || titulo;
    const fecha = limpio(campo(x, 'pubDate')) || limpio(campo(x, 'dc:created')) || limpio(campo(x, 'dc:date')) || limpio(campo(x, 'dcterms:modified'));
    const t = Date.parse(fecha) || null;
    out.push({ medio, titulo, entradilla: limpio(campo(x, 'description')).slice(0, 400), url, guid: `${medio}|${guid}`, t });
  }
  return out;
}

/** todas las noticias de todos los feeds, sin repetir (un feed caído no para nada) */
export async function noticiasPrensa({ log = () => {}, pedir = get, feeds = FEEDS } = {}) {
  const vistas = new Set(), out = [];
  const res = await Promise.all(feeds.map((f) => pedir(f.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' }, reintentos: 1 })
    .then((r) => (r.s === 200 ? leerRss(r.b, f.medio) : (log(`  (prensa) ${f.medio}: HTTP ${r.s} en ${f.url}`), [])))
    .catch((e) => { log(`  (prensa) ${f.medio}: ${e.message || e}`); return []; })));
  for (const lista of res) for (const n of lista) {
    const k = n.url || n.guid;
    if (vistas.has(k)) continue;
    vistas.add(k); out.push(n);
  }
  const medios = [...new Set(out.map((n) => n.medio))];
  log(`  (prensa) ${out.length} noticias leídas de ${medios.length} medios (${medios.join(', ') || 'ninguno'})`);
  return out;
}

// noticias y liga leen los mismos feeds en la misma ejecución: una sola lectura por proceso
let unaVez = null;
export const noticiasPrensaUnaVez = (op = {}) => (unaVez ||= noticiasPrensa(op).catch((e) => { unaVez = null; throw e; }));
