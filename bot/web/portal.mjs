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

// el encuadre de cada cara (dónde está la cabeza en la foto: { x, y, s }), calculado al generar por .github/portal/encuadres.py con
// el mismo cálculo que hace la app (web/js/caras.js). Sin él, la foto entera centrada arriba.
let ENCUADRES = null;
export function cargarEncuadres() {
  try { ENCUADRES = JSON.parse(readFileSync(path.join(RAIZ, '.github', 'portal', 'encuadres.json'), 'utf8')); } catch { ENCUADRES = {}; }
  return ENCUADRES;
}
const encuadre = (u) => { if (!ENCUADRES) cargarEncuadres(); const c = ENCUADRES[String(u).split('?')[0]]; return c && c.s ? c : null; };

/**
 * La cara con su aro del color del puesto y, si se pasa, el escudo en la esquina: como `ava` de la app (web/js/comunes.js), el
 * círculo recorta la foto encuadrada en la cabeza y el escudo va fuera del círculo. tam: 'p' (36), 'm' (48) o 'g' (88)
 */
export function cara({ caraUrl, escudoUrl = null, nombre = '', pos = null, equipo = '' }, tam = 'm') {
  const px = { p: 36, m: 48, g: 88 }[tam] || 48;
  const u = img(caraUrl), es = img(escudoUrl);
  const c = u ? encuadre(u) : null;
  const k = c ? 100 / c.s : 0;
  const estilo = c ? ` style="width:${+k.toFixed(1)}%;height:${+k.toFixed(1)}%;left:${+(-c.x * k).toFixed(1)}%;top:${+(-c.y * k).toFixed(1)}%"` : '';
  return `<span class="ava-w ava-${tam}"><span class="ava${pos ? ` p${pos}` : ''}"><span class="ini" aria-hidden="true">${e(iniciales(nombre))}</span>`
    + (u ? `<img class="cara${c ? ' enc' : ''}" src="${e(u)}" alt="" width="${px}" height="${px}"${estilo} loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '')
    + '</span>'
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

/** lo mismo en una chapita (tarjetas de jugador y cabeceras) */
export const chip = (x, txt) => `<span class="chip ${x > 0 ? 'sube' : x < 0 ? 'baja' : 'igual'}">${x > 0 ? '▲' : x < 0 ? '▼' : '='} ${e(txt)}</span>`;

/**
 * Las tarjetas de jugador (rework de la web): foto con su aro y el escudo, nombre, puesto y club, el valor y lo que sube o baja.
 * En el móvil van en una fila que se desliza; en el ordenador, cinco por fila. xs: [{ x (la fila del jugador), enlace, valor (texto),
 * mueve: [número, texto], sub }]. Con enlace, la tarjeta entera lleva a su ficha.
 */
export function tarjetasJug(xs, { numeros = true } = {}) {
  return `  <div class="jcs">${xs.map(({ x, enlace = null, valor = '', mueve = null, sub = null }, i) => {
    const dentro = `${numeros ? `<span class="jc-n">${i + 1}</span>` : ''}${cara(x, 'm')}<b>${e(x.nombre)}</b><small>${e(sub ?? `${POS[x.pos] || ''} · ${x.equipo || ''}`)}</small>`
      + `${valor ? `<span class="jc-v">${e(valor)}</span>` : ''}${mueve ? chip(mueve[0], mueve[1]) : ''}`;
    return enlace ? `<a class="jc" href="${e(enlace)}">${dentro}</a>` : `<div class="jc">${dentro}</div>`;
  }).join('')}</div>`;
}

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

/** un paso «redondo» (1, 2 o 5 por una potencia de diez) para los límites de una gráfica */
const pasoRedondo = (x) => { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

/**
 * La gráfica grande de valor de la temporada (ficha de jugador y de equipo). (Rework de la web, 21 nov) Pintada para que de una noche
 * a otra el SVG casi no cambie: era el 90 % de lo que cambiaba cada noche en una ficha (el camino entero se recalculaba) y lo que hacía
 * crecer el repo. Cada día ocupa un hueco fijo, con el ancho pensado para un múltiplo de 14 días (el punto de hoy se añade al final y
 * los de antes no se mueven; cada dos semanas se recoloca), y arriba y abajo van límites redondos, que solo cambian cuando el valor
 * los cruza. El máximo y el mínimo exactos, con su fecha, van en las cifras de al lado y en la etiqueta accesible.
 */
export function graficaValor(serie, { ancho = 640, alto = 180, fecha = (t) => new Date(t).toISOString().slice(0, 10) } = {}) {
  const s = (serie || []).filter((x) => x && Number.isFinite(x.v));
  if (s.length < 2) return '';
  const min = Math.min(...s.map((x) => x.v)), max = Math.max(...s.map((x) => x.v));
  const paso = pasoRedondo((max - min) / 4 || max * 0.02 || 1);
  const abajo = Math.floor(min / paso) * paso, arriba = Math.max(Math.ceil(max / paso) * paso, abajo + paso), r = arriba - abajo;
  // a la izquierda, un hueco para los dos límites (así no pisan la línea)
  const izq = 50, der = 4, arr = 8, aba = 20, w = ancho - izq - der, h = alto - arr - aba;
  const dias = Math.max(14, Math.ceil(s.length / 14) * 14) - 1;
  const P = s.map((x, i) => [izq + (i * w) / dias, arr + h - ((x.v - abajo) * h) / r]);
  const d = P.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const clase = s[s.length - 1].v >= s[0].v ? 'sube' : 'baja';
  const fin = P[P.length - 1][0];
  return `<svg class="graf ${clase}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${e(`Valor de mercado: de ${dinero(s[0].v)} el ${fecha(s[0].t)} a ${dinero(s[s.length - 1].v)} el ${fecha(s[s.length - 1].t)}; máximo ${dinero(max)} y mínimo ${dinero(min)}`)}">`
    + `<path class="eje" d="M${izq} ${arr}H${ancho - der}M${izq} ${arr + h}H${ancho - der}"/>`
    + `<text x="${izq - 6}" y="${arr + 4}" text-anchor="end">${e(dinero(arriba))}</text><text x="${izq - 6}" y="${arr + h + 4}" text-anchor="end">${e(dinero(abajo))}</text>`
    + `<text x="${izq}" y="${alto - 3}">${e(fecha(s[0].t))}</text>`
    + `<path class="a" d="${d}V${arr + h}H${izq}Z"/><path class="l" d="${d}"/>`
    + `<text x="${fin.toFixed(1)}" y="${alto - 3}" text-anchor="end">${e(fecha(s[s.length - 1].t))}</text></svg>`;
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

/** un bloque del portal: título con franja, el contenido y, si hay, una línea pequeña DEBAJO (qué es cada cifra: primero los datos) */
export const bloque = (titulo, cuerpo, { id = null, linea = '' } = {}) => `\n  <section class="bq"${id ? ` id="${e(id)}"` : ''}>\n  <h2>${e(titulo)}</h2>\n${cuerpo}${linea ? `\n  <p class="bq-l">${linea}</p>` : ''}\n  </section>`;

// ---------------------------------------------------------------- fase 2b: cabeceras compactas, tablas densas y pestañas sin JS

/** la celda de un jugador en una tabla: cara pequeña con su aro y escudo, el nombre (enlazado si tiene ficha) y una línea debajo */
export function celdaJug(x, { enlace = null, sub = null, tam = 'p' } = {}) {
  const nombre = enlace ? `<a href="${e(enlace)}">${e(x.nombre)}</a>` : e(x.nombre);
  const s = sub ?? `${x.pos ? `${POS[x.pos] || ''} · ` : ''}${x.equipo || ''}`;
  return `<td class="c-j"><div class="tjug">${cara(x, tam)}<span class="tjug-t"><b>${nombre}</b>${s ? `<small>${e(s)}</small>` : ''}</span></div></td>`;
}

/**
 * Una tabla compacta. cols: [{ t: 'Valor', c: 'n' (cifra, a la derecha) | 'm' (se esconde en el móvil) | 'j' (jugador), titulo }];
 * filas: cada una, el HTML de sus <td> (o { td, attrs }). Con `grupos`, [{ t, filas }]: una fila de título por grupo (la plantilla por puestos).
 */
export function tabla(cols, filas, { clase = '', grupos = null, id = null, cap = '' } = {}) {
  const th = cols.map((c) => `<th${c.c ? ` class="${c.c}"` : ''}${c.titulo ? ` title="${e(c.titulo)}"` : ''} scope="col">${c.t}</th>`).join('');
  const tr = (f) => (typeof f === 'string' ? `      <tr>${f}</tr>` : `      <tr${f.attrs || ''}>${f.td}</tr>`);
  const cuerpo = grupos
    ? grupos.filter((g) => g.filas.length).map((g) => `    <tbody>\n      <tr class="grp"><th colspan="${cols.length}" scope="rowgroup">${e(g.t)}</th></tr>\n${g.filas.map(tr).join('\n')}\n    </tbody>`).join('\n')
    : `    <tbody>\n${filas.map(tr).join('\n')}\n    </tbody>`;
  return `  <div class="tabla-scroll ts"><table class="td${clase ? ` ${clase}` : ''}"${id ? ` id="${e(id)}"` : ''}>${cap ? `<caption>${cap}</caption>` : ''}\n    <thead><tr>${th}</tr></thead>\n${cuerpo}\n  </table></div>`;
}

/** las cifras clave en una tira compacta (cabecera de ficha y de lista): [{ v: html, l: 'qué es', s: html debajo }] */
export const kpis = (xs, clase = '') => `  <div class="kpi${clase ? ` ${clase}` : ''}">${xs.filter(Boolean).map((x) => `<div><b>${x.v}</b><span>${x.l}</span>${x.s ? `<small>${x.s}</small>` : ''}</div>`).join('')}</div>`;

/** la barra de saltos de una página larga (sin JS: enlaces a las secciones). [[id, texto]] */
export const subnav = (xs) => `  <nav class="subnav" aria-label="En esta página">${xs.filter(Boolean).map(([id, t]) => `<a href="#${e(id)}">${e(t)}</a>`).join('')}</nav>`;

/**
 * Pestañas sin JavaScript (radios y CSS): todo el contenido va en el HTML y Google lo lee; sin CSS se ve todo seguido.
 * En el ordenador, si son dos, van una al lado de la otra con su título (h3) y sin pestañas.
 * id: único en la página; xs: [[etiqueta, html]]
 */
export function pestanas(id, xs) {
  const ok = xs.filter(([, h]) => h);
  if (!ok.length) return '';
  if (ok.length === 1) return ok[0][1];
  const r = ok.map(([t], i) => `<input type="radio" name="pt-${e(id)}" id="pt-${e(id)}-${i}"${i ? '' : ' checked'}><label for="pt-${e(id)}-${i}">${e(t)}</label>`).join('');
  return `  <div class="pest pest-${ok.length}">${r}\n${ok.map(([t, h]) => `  <div class="pest-p" role="group" aria-label="${e(t)}">\n  <h3 class="pest-h">${e(t)}</h3>\n${h}\n  </div>`).join('\n')}\n  </div>`;
}

/** la racha de resultados de un equipo: G, E, P de colores (y con la letra: nunca solo color) */
export const forma = (rs) => `<span class="forma" aria-label="${e(`Últimos resultados: ${rs.map((r) => (r.r === 'G' ? 'ganó' : r.r === 'E' ? 'empató' : 'perdió')).join(', ')}`)}">${rs.map((r) => `<span class="res-c res-${r.r}" title="J${r.J}: ${r.gf}-${r.gc} ${r.casa ? 'en casa' : 'fuera'} contra ${e(r.rival)}">${r.r}</span>`).join('')}</span>`;

/** el puesto escrito en su chapita de color (POR amarillo, DEF azul, MED verde, DEL rojo, como el aro de las caras) */
export const chapaPos = (p) => (POS[p] ? `<span class="chapa p${p}">${POS[p]}</span>` : '');

/** la dificultad de un rival (fácil, media, difícil) */
const NIVEL_C = { 'fácil': 'facil', media: 'media', 'difícil': 'dificil' };
export const nivelChip = (n) => `<span class="niv niv-${NIVEL_C[n] || 'media'}">${e(n || 'media')}</span>`;

/**
 * Las fichas de las jornadas, con la forma de las de la app (web/js/hojas.js, `jornadasPtsHTML`):
 * [{ J, pts (null si no jugó), abajo, icono, titulo }]. `mini`: la tira corta de la cabecera (sin minutos).
 */
export function fichasJornada(xs, { mini = false } = {}) {
  const nivel = (p) => (p >= 10 ? 'top' : p >= 6 ? 'bien' : p >= 2 ? 'medio' : 'mal');
  return `<div class="jt-fila${mini ? ' jt-mini' : ''}">${xs.map((x) => `<div class="jt ${x.pts == null ? 'nada' : nivel(x.pts)}" title="${e(x.titulo)}">${x.icono ? `<i class="gol" aria-hidden="true">${x.icono}</i>` : ''}`
    + `<span class="jt-n">J${x.J}</span><b>${x.pts == null ? '–' : x.pts}</b>${mini ? '' : x.pts == null ? '<small class="nj">no<br>jugó</small>' : `<small>${e(x.abajo || '')}</small>`}</div>`).join('')}</div>`;
}

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
