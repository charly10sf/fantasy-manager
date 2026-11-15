// Piezas comunes del portal de datos de la web (mercado, jornada, equipos y, en la fase 2, una página por equipo y por jugador).
// HTML sin JavaScript: caras y escudos oficiales de LaLiga (assets-fantasy, enlazados, sin bajarlos), minigráficas en SVG pintadas
// en el propio HTML y fichas de puntos con los cortes de la app (10+, 6-9, 2-5, 1 o menos). Lo de alrededor (cabecera, menú, pie,
// metas) lo pone .github/paginas.py; aquí solo el contenido que va entre sus marcas y la entrada de la página en paginas.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dinero, dif, pct } from './vista.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const coma = (x, d = 1) => (Math.round(Number(x) * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',').replace(/,0$/, '');
export { dinero, dif, pct };
export const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL', 5: 'ENT' };
export const PUESTO = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero', 5: 'entrenador' };

/** solo imágenes del servidor de LaLiga Fantasy (como bot/lib/laliga.mjs `imagen`) */
const IMG_OK = /^https:\/\/assets-fantasy\.llt-services\.com\/[\w./-]+\.png(\?v=\d+)?$/;
const img = (u) => (u && IMG_OK.test(u) ? u : null);
const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** la cara con su aro del color del puesto y, si se pasa, el escudo en la esquina. tam: 'p' (36), 'm' (48) o 'g' (88) */
export function cara({ caraUrl, escudoUrl = null, nombre = '', pos = null, equipo = '' }, tam = 'm') {
  const px = { p: 36, m: 48, g: 88 }[tam] || 48;
  const u = img(caraUrl), es = img(escudoUrl);
  return `<span class="ava ava-${tam}${pos ? ` p${pos}` : ''}"><span class="ini" aria-hidden="true">${e(iniciales(nombre))}</span>`
    + (u ? `<img src="${e(u)}" alt="" width="${px}" height="${px}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '')
    + (es ? `<img class="esc" src="${e(es)}" alt="${e(equipo)}" width="20" height="20" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '')
    + '</span>';
}

/** el escudo solo (en tablas de equipos y partidos) */
export function escudo(url, nombre = '', px = 24) {
  const u = img(url);
  return u ? `<img class="escudo" src="${e(u)}" alt="${e(nombre)}" width="${px}" height="${px}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
}

/** la ficha de puntos de una jornada, con los cortes fijos de la app */
export const clasePuntos = (p) => (p >= 10 ? 'p10' : p >= 6 ? 'p6' : p >= 2 ? 'p2' : 'p1');
export const chipPuntos = (p, titulo = '') => `<span class="pts ${clasePuntos(p)}"${titulo ? ` title="${e(titulo)}"` : ''}>${e(String(p))}</span>`;

/** subida o bajada escrita con su signo y una flecha (nunca solo con color) */
export const cambio = (x, txt) => `<span class="${x > 0 ? 'sube' : x < 0 ? 'baja' : 'igual'}">${x > 0 ? '▲' : x < 0 ? '▼' : '='} ${e(txt)}</span>`;

/**
 * La minigráfica de valor: [{t, v}] o [v]. Una línea con su área, de 96 × 28 (o lo que se pida). Sin texto dentro: la cifra va al lado.
 * Con `etiqueta` se pone un título accesible («Valor en los últimos 30 días: de 12,1 M a 14,3 M»).
 */
export function minigrafica(serie, { ancho = 96, alto = 28, etiqueta = '' } = {}) {
  const v = (serie || []).map((x) => (typeof x === 'number' ? x : x.v)).filter((x) => Number.isFinite(x));
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), r = max - min || 1, m = 2;
  const pts = v.map((y, i) => [m + (i * (ancho - 2 * m)) / (v.length - 1), alto - m - ((y - min) * (alto - 2 * m)) / r]);
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const area = `${linea}L${pts[pts.length - 1][0].toFixed(1)} ${alto}L${pts[0][0].toFixed(1)} ${alto}Z`;
  const clase = v[v.length - 1] > v[0] ? 'sube' : v[v.length - 1] < v[0] ? 'baja' : 'igual';
  const t = etiqueta || `Valor: de ${dinero(v[0])} a ${dinero(v[v.length - 1])}`;
  return `<svg class="mini ${clase}" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${e(t)}"><path class="a" d="${area}"/><path class="l" d="${linea}"/></svg>`;
}

/** la gráfica grande de valor de la temporada (fase 2: ficha de jugador). Ejes con el máximo, el mínimo y las fechas de los extremos */
export function graficaValor(serie, { ancho = 640, alto = 180, fecha = (t) => new Date(t).toISOString().slice(0, 10) } = {}) {
  const s = (serie || []).filter((x) => x && Number.isFinite(x.v));
  if (s.length < 2) return '';
  const min = Math.min(...s.map((x) => x.v)), max = Math.max(...s.map((x) => x.v)), r = max - min || 1;
  const izq = 4, der = 4, arr = 14, aba = 20, w = ancho - izq - der, h = alto - arr - aba;
  const P = s.map((x, i) => [izq + (i * w) / (s.length - 1), arr + h - ((x.v - min) * h) / r]);
  const d = P.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const clase = s[s.length - 1].v >= s[0].v ? 'sube' : 'baja';
  return `<svg class="graf ${clase}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${e(`Valor de mercado: de ${dinero(s[0].v)} el ${fecha(s[0].t)} a ${dinero(s[s.length - 1].v)} el ${fecha(s[s.length - 1].t)}; máximo ${dinero(max)} y mínimo ${dinero(min)}`)}">`
    + `<path class="a" d="${d}L${P[P.length - 1][0].toFixed(1)} ${arr + h}L${P[0][0].toFixed(1)} ${arr + h}Z"/><path class="l" d="${d}"/>`
    + `<text x="${izq}" y="10">${e(dinero(max))}</text><text x="${izq}" y="${arr + h - 3}">${e(dinero(min))}</text>`
    + `<text x="${izq}" y="${alto - 4}">${e(fecha(s[0].t))}</text><text x="${ancho - der}" y="${alto - 4}" text-anchor="end">${e(fecha(s[s.length - 1].t))}</text></svg>`;
}

/** barras de puntos por jornada (fase 2: ficha de jugador y de equipo): [[jornada, puntos], …] */
export function barrasPuntos(jornadas, { ancho = 640, alto = 120, clase = clasePuntos } = {}) {
  // una jornada con null (no jugó) deja su hueco con el número debajo, sin barra
  const xs = (jornadas || []).filter(([, p]) => p === null || Number.isFinite(p));
  const ys = xs.filter(([, p]) => p !== null);
  if (!ys.length) return '';
  const max = Math.max(10, ...ys.map(([, p]) => p)), min = Math.min(0, ...ys.map(([, p]) => p));
  const aba = 16, h = alto - aba - 4, cero = 4 + (h * max) / (max - min), paso = ancho / xs.length, bw = Math.max(4, paso * 0.62);
  const barras = xs.map(([j, p], i) => {
    const x = i * paso + (paso - bw) / 2;
    if (p === null) return `<text class="nj" x="${(x + bw / 2).toFixed(1)}" y="${alto - 3}" text-anchor="middle">${j}</text>`;
    const y = p >= 0 ? cero - (p * h) / (max - min) : cero, hh = Math.abs(p * h) / (max - min) || 1;
    return `<rect class="${clase(p, j)}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}"><title>J${j}: ${p} puntos</title></rect>`
      + `<text x="${(x + bw / 2).toFixed(1)}" y="${alto - 3}" text-anchor="middle">${j}</text>`;
  }).join('');
  return `<svg class="barras" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${e(`Puntos por jornada: ${xs.map(([j, p]) => `J${j} ${p === null ? 'no jugó' : p}`).join(', ')}`)}">${barras}</svg>`;
}

/** una fila de jugador: cara, nombre, equipo y puesto, y a la derecha lo que se pida (cifras ya en HTML) */
export function filaJugador(x, derecha = '', { enlace = null, sub = null } = {}) {
  const nombre = enlace ? `<a href="${e(enlace)}">${e(x.nombre)}</a>` : e(x.nombre);
  return `<li class="fj">${cara(x, 'm')}<span class="fj-c"><b>${nombre}</b><span>${e(sub ?? `${x.equipo}${x.pos ? ` · ${POS[x.pos] || ''}` : ''}`)}</span></span><span class="fj-d">${derecha}</span></li>`;
}

/** la cabecera de un bloque del portal: título con franja y, si hay, una línea debajo */
export const bloque = (titulo, cuerpo, { id = null, linea = '' } = {}) => `\n  <section class="bq"${id ? ` id="${e(id)}"` : ''}>\n  <h2>${e(titulo)}</h2>${linea ? `\n  <p class="bq-l">${linea}</p>` : ''}\n${cuerpo}\n  </section>`;
export const tarjetas = (xs, clase = '') => `  <div class="tj${clase ? ` ${clase}` : ''}">${xs.join('')}</div>`;
export const lista = (filas, clase = '') => (filas.length ? `  <ul class="lj${clase ? ` ${clase}` : ''}">${filas.join('')}</ul>` : '');

/** para las URL de la fase 2 (/jugadores/fermin.html, /equipos/barca.html): sin tildes, minúsculas y guiones */
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
export const diaMadrid = (t = Date.now()) => DIA.format(new Date(t));
const MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «6 jul» */
export const fechaCorta = (t) => { const [, m, d] = diaMadrid(t).split('-').map(Number); return `${d} ${MESC[m - 1]}`; };

/** el JSON como lo escribe la gente en paginas.json (el mismo formato que bot/previa-web.mjs) */
export const bonito = (x, ind = '') => {
  const sub = `${ind}  `;
  if (Array.isArray(x)) return x.every((v) => v === null || typeof v !== 'object') ? `[${x.map((v) => JSON.stringify(v)).join(', ')}]` : `[\n${x.map((v) => sub + bonito(v, sub)).join(',\n')}\n${ind}]`;
  if (x && typeof x === 'object') { const en = Object.entries(x); return en.length ? `{\n${en.map(([k, v]) => `${sub}${JSON.stringify(k)}: ${bonito(v, sub)}`).join(',\n')}\n${ind}}` : '{}'; }
  return JSON.stringify(x);
};

/**
 * Escribe una página del portal: su contenido (entre las marcas de paginas.py) y su entrada en .github/paginas.json, que se crea o se
 * pone al día. `entrada`: { ruta, titulo, h1, descripcion, seccion, … }; la fecha es la de hoy y `publicada` se conserva.
 * No ejecuta paginas.py: eso se hace una vez al final (bot/portal-web.mjs).
 */
export function escribirPagina(entrada, html) {
  const pj = path.join(RAIZ, '.github', 'paginas.json');
  const P = JSON.parse(readFileSync(pj, 'utf8'));
  const hoy = diaMadrid();
  const vieja = P.paginas.find((p) => p.ruta === entrada.ruta);
  const nueva = { tipo: 'portal', ...entrada, fecha: hoy, publicada: (vieja && vieja.publicada) || hoy };
  if (vieja) { for (const k of Object.keys(vieja)) delete vieja[k]; Object.assign(vieja, nueva); } else {
    // las del portal van delante de las guías, detrás de las páginas legales
    const i = P.paginas.findIndex((p) => p.ruta.startsWith('guias/'));
    P.paginas.splice(i < 0 ? P.paginas.length : i, 0, nueva);
  }
  writeFileSync(pj, bonito(P) + '\n');
  const archivo = path.join(RAIZ, 'web', entrada.ruta);
  mkdirSync(path.dirname(archivo), { recursive: true });
  writeFileSync(archivo, `<!-- contenido -->\n${html}\n<!-- /contenido -->\n`);
}

/** las páginas ya registradas (para enlazar previas y resúmenes entre sí) */
export function paginas() {
  return JSON.parse(readFileSync(path.join(RAIZ, '.github', 'paginas.json'), 'utf8')).paginas;
}

/** el registro de las fichas de la fase 2 (equipos y jugadores): aparte de paginas.json para no llenarlo con 170 entradas a mano */
export const FICHAS = path.join(RAIZ, '.github', 'portal', 'fichas.json');

/**
 * Escribe de una vez muchas páginas del portal (las fichas): el contenido de cada una y sus entradas en .github/portal/fichas.json,
 * que lee paginas.py junto a paginas.json. [{ entrada, html }]. Si el contenido no cambia, se queda la fecha de antes (así el
 * sitemap no dice que han cambiado todas cada noche); `publicada` se conserva. Las que ya estaban y hoy no salen se quedan como estaban.
 */
export function escribirFichas(paginasNuevas) {
  const R = existsSync(FICHAS) ? JSON.parse(readFileSync(FICHAS, 'utf8')) : { _leeme: 'Lo escribe bot/portal-web.mjs (bot/web/fichas.mjs): las páginas de cada equipo y de cada jugador. Lo lee .github/paginas.py junto a paginas.json. No se edita a mano.', paginas: [] };
  const hoy = diaMadrid();
  const porRuta = new Map(R.paginas.map((p) => [p.ruta, p]));
  let cambiadas = 0;
  for (const { entrada, html } of paginasNuevas) {
    const archivo = path.join(RAIZ, 'web', entrada.ruta);
    const nuevo = `<!-- contenido -->\n${html}\n<!-- /contenido -->\n`;
    const vieja = porRuta.get(entrada.ruta);
    const antes = existsSync(archivo) ? readFileSync(archivo, 'utf8') : null;
    // el contenido guardado es ya la página entera (paginas.py la rehace): se compara lo que hay entre las marcas
    const m = antes && antes.match(/<!-- contenido -->\n([\s\S]*?)\n<!-- \/contenido -->/);
    const igual = vieja && m && m[1] === html;
    porRuta.set(entrada.ruta, { tipo: 'portal', ...entrada, fecha: igual ? vieja.fecha : hoy, publicada: (vieja && vieja.publicada) || hoy });
    if (!igual) { mkdirSync(path.dirname(archivo), { recursive: true }); writeFileSync(archivo, nuevo); cambiadas++; }
  }
  R.paginas = [...porRuta.values()].sort((a, b) => a.ruta.localeCompare(b.ruta));
  mkdirSync(path.dirname(FICHAS), { recursive: true });
  writeFileSync(FICHAS, bonito(R) + '\n');
  return cambiadas;
}
