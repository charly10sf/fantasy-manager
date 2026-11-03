// Los RSS de la prensa deportiva (Carlos, 2-3 nov: novedades de prensa en el bot). Feeds comprobados desde Actions el 3 nov
// (rama pruebas-noticias): los de MARCA (Primera y por club), AS (Primera), Mundo Deportivo (fútbol y LaLiga) y SPORT (últimas).
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
];

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
  log(`  (prensa) ${out.length} noticias leídas (${[...new Set(out.map((n) => n.medio))].join(', ') || 'ningún medio'})`);
  return out;
}
