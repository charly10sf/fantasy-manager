// Tarjetas con imagen para los tweets del bot: dibujo en SVG y paso a PNG con @resvg/resvg-js.
// Estilo «carta» (Carlos, 3 nov 10:44, elegido entre «carta» y «oro»; antes, desde el 2 nov, «noche»): cartas de coleccionista
// con diseño propio, fondo casi negro con el brillo del color de cada club y rayos en diagonal, letra Barlow Condensed (OFL, en
// fuentes/) y titulares en dorado. El metal de cada carta sale de los puntos: élite (15 o más, negra con oro), oro (10-14),
// plata (5-9), bronce (0-4) y roja (negativos); las que no van de puntos (mercado, bajas) son oscuras con el borde de su color.
// Seis tarjetas: final, jugador, resumen, onces, mercado y bajas.
// Aquí solo se dibuja: los datos llegan ya montados (datos-tarjetas.mjs o el propio tipo) y validar.mjs comprueba que todo lo
// escrito esté en ellos o en PALABRAS_FIJAS.
import { coloresClub, luz } from './colores.mjs';

export const ANCHO = 1200, ALTO = 675;
const ROJO = '#ee1c3c', VERDE = '#2fd27f', MALO = '#ff4d5e', AMBAR = '#f2b33d';
const TINTA = '#f4f2f3', TENUE = '#8c869a', FONDO = '#0b0a0f', PANEL = '#17151d', LINEA = '#2c2834';
const B = 'Barlow Condensed';
const FUENTES = ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'InterDisplay-Black.otf',
  'BarlowCondensed_600SemiBold.ttf', 'BarlowCondensed_700Bold.ttf', 'BarlowCondensed_800ExtraBold.ttf',
  'BarlowCondensed_800ExtraBold_Italic.ttf', 'BarlowCondensed_900Black.ttf'].map((f) => new URL(`../fuentes/${f}`, import.meta.url).pathname);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uri = (buf) => (buf ? `data:image/png;base64,${Buffer.from(buf).toString('base64')}` : null);
/** 7.25 -> «7,3»; enteros sin decimales */
export const num1 = (x) => (Math.round(Number(x) * 10) / 10).toString().replace('.', ',');
/** valor de mercado: 101970432 -> «102 M», 8450000 -> «8,5 M», 640000 -> «0,6 M» */
export const millones = (v) => `${num1(v / 1e6)} M`;
const signo = (n) => (n > 0 ? `+${n}` : String(n));

// Ancho aproximado de un texto (resvg no lo da): medido para Inter; Barlow Condensed es un 26 % más estrecha.
function ancho(s, px, fam = 'Inter') {
  let w = 0;
  for (const ch of String(s)) {
    if (ch === ' ') w += 0.27;
    else if (/[0-9]/.test(ch)) w += 0.62;
    else if (/[A-ZÁÉÍÓÚÑÜ]/.test(ch)) w += 0.7;
    else if (/[iljtfrI.,'·:]/.test(ch)) w += 0.32;
    else if (/[mwMW]/.test(ch)) w += 0.88;
    else w += 0.58;
  }
  return w * px * (fam === B ? 0.74 : 1);
}
const medir = (s, px, fam, espacio = 0) => ancho(s, px, fam) + [...String(s)].length * espacio;

function texto(x, y, s, { px = 24, peso = 700, color = TINTA, ancla = 'start', fam = B, espacio = 0, opacidad = 1, max = null, italica = false } = {}) {
  let p = px;
  if (max) { const min = Math.round(px * 0.5); while (p > min && medir(s, p, fam, espacio) > max) p--; }
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${peso}" font-size="${p}" fill="${color}" text-anchor="${ancla}"`
    + `${espacio ? ` letter-spacing="${espacio}"` : ''}${opacidad < 1 ? ` opacity="${opacidad}"` : ''}${italica ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas
let n = 0;
const id = (p) => `${p}${++n}`;
const lineal = (g, paradas, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) => `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${paradas.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
const radial = (cx, cy, r, color, op) => { const g = id('r'); return `<defs><radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="${ANCHO}" height="${ALTO}" fill="url(#${g})"/>`; };
const marco = (cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}"><rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>${cuerpo}</svg>`;
const ABREV = { Portero: 'POR', Defensa: 'DEF', Centrocampista: 'MED', Delantero: 'DEL', Entrenador: 'ENT' };

/** el escudo (78x105 en LaLiga) encajado en una caja de alto h, centrado en (cx, cy) */
function escudo(buf, cx, cy, h) {
  if (!buf) return '';
  const w = Math.round(h * 78 / 105);
  return `<image href="${uri(buf)}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}
/** cara en círculo con aro */
function caraCirculo(buf, cx, cy, r, { aro = '#fff', grosor = 3 } = {}) {
  const c = id('cc');
  return `<defs><clipPath id="${c}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1f1c27"/>`
    + (buf ? `<image href="${uri(buf)}" x="${cx - r * 1.08}" y="${cy - r * 0.92}" width="${r * 2.16}" height="${r * 2.16}" clip-path="url(#${c})" preserveAspectRatio="xMidYMin slice"/>` : '')
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${aro}" stroke-width="${grosor}"/>`;
}
/** la cara suelta (256x256 sin fondo) que se funde hacia abajo, sin corte duro donde acaba la foto */
function caraFundida(buf, x, y, lado, { desde = 0.7 } = {}) {
  if (!buf) return '';
  const mk = id('m'), g = id('mg');
  return `<defs>${lineal(g, [[0, '#fff'], [desde, '#fff'], [1, '#fff', 0]])}<mask id="${mk}"><rect x="${x}" y="${y}" width="${lado}" height="${lado}" fill="url(#${g})"/></mask></defs>`
    + `<image href="${uri(buf)}" x="${x}" y="${y}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMax meet" mask="url(#${mk})"/>`;
}

/** fondo común: casi negro, el brillo de los clubes que salen y rayos en diagonal */
function fondo(brillos = []) {
  let s = brillos.map(([cx, cy, r, color, op]) => radial(cx, cy, r, color, op)).join('');
  for (let k = 0; k < 9; k++) s += `<polygon points="${120 + k * 150},0 ${200 + k * 150},0 ${-80 + k * 150},${ALTO} ${-160 + k * 150},${ALTO}" fill="#fff" opacity="${(0.018 + (k % 3) * 0.008).toFixed(3)}"/>`;
  return s;
}

// degradados de oro y de rojo para los titulares (uno por tarjeta)
function dorado() {
  const g = id('go');
  return { g, defs: `<defs>${lineal(g, [[0, '#fbe9a6'], [0.5, '#e2bd5a'], [1, '#b88a2c']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` };
}
function rojizo() {
  const g = id('gr');
  return { g, defs: `<defs>${lineal(g, [[0, '#ffb3b3'], [0.5, '#ff4d5e'], [1, '#b3122a']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` };
}

/** la marca de la app: barra roja, «FANTASY MANAGER» y la cuenta */
function marca(x, y, { ancla = 'start' } = {}) {
  const w1 = medir('FANTASY MANAGER', 24, B, 2), w2 = medir('@Fantasyman_app', 22, B);
  const total = 16 + w1 + 18 + w2;
  const x0 = ancla === 'middle' ? x - total / 2 : x;
  return `<rect x="${x0}" y="${y - 17}" width="6" height="22" rx="2" fill="${ROJO}"/>`
    + texto(x0 + 16, y, 'FANTASY MANAGER', { px: 24, peso: 800, espacio: 2 })
    + texto(x0 + 16 + w1 + 18, y, '@Fantasyman_app', { px: 22, peso: 600, color: TENUE });
}

// --- metales -----------------------------------------------------------------------------------------------------------------
const METAL = {
  elite: { fondo: [[0, '#1d1a26'], [0.55, '#0e0c13'], [1, '#2a2213']], borde: [[0, '#fff1c1'], [0.4, '#d9ad4b'], [0.7, '#8a6420'], [1, '#f3d58a']], tinta: '#f6e7b8', tenue: '#bfa66a', linea: '#5d4a22', brillo: 0.10, halo: 0.55 },
  oro: { fondo: [[0, '#fbe9a6'], [0.45, '#e2bd5a'], [1, '#a77a23']], borde: [[0, '#fff6d6'], [0.5, '#c8952f'], [1, '#7a5512']], tinta: '#2a1c04', tenue: '#5a420f', linea: '#8a6a26', brillo: 0.35, halo: 0.28 },
  plata: { fondo: [[0, '#f3f5f8'], [0.5, '#c5ccd6'], [1, '#8b94a1']], borde: [[0, '#ffffff'], [0.5, '#a2abb7'], [1, '#606875']], tinta: '#1a1e25', tenue: '#454c58', linea: '#7b8491', brillo: 0.35, halo: 0.25 },
  bronce: { fondo: [[0, '#f0c9a0'], [0.5, '#c58a55'], [1, '#86522a']], borde: [[0, '#ffe2c4'], [0.5, '#b0743f'], [1, '#6a3c19']], tinta: '#2b1607', tenue: '#5b3417', linea: '#8d5a33', brillo: 0.3, halo: 0.25 },
  roja: { fondo: [[0, '#3a0d16'], [0.55, '#1a070b'], [1, '#2b0a10']], borde: [[0, '#ffb3b3'], [0.5, '#d22b40'], [1, '#6e0f1d']], tinta: '#ffe1e4', tenue: '#d98a95', linea: '#6e2430', brillo: 0.08, halo: 0.4 },
};
/** el metal por los puntos */
export const metalDe = (pts) => (pts >= 15 ? 'elite' : pts >= 10 ? 'oro' : pts >= 5 ? 'plata' : pts >= 0 ? 'bronce' : 'roja');
/** carta oscura con el borde de un color (mercado, bajas) */
const oscura = (color) => ({ fondo: [[0, '#1f1c27'], [0.6, '#121017'], [1, '#191620']], borde: [[0, '#ffffff'], [0.35, color], [1, '#2a2632']], tinta: TINTA, tenue: TENUE, linea: LINEA, brillo: 0.07, halo: 0.4 });

/** silueta de la carta: esquinas de arriba con muesca en el centro, lados rectos y punta suave abajo (todo a escala del ancho) */
function silueta(x, y, w, h) {
  const k = w / 404, c = 26 * k, r = 34 * k, mu = 40 * k, pu = 30 * k;
  return `M${x + c},${y} L${x + w / 2 - mu},${y} Q${x + w / 2},${y + 18 * k} ${x + w / 2 + mu},${y} L${x + w - c},${y} Q${x + w},${y} ${x + w},${y + c + 10 * k}`
    + ` L${x + w},${y + h - 90 * k} Q${x + w},${y + h - 60 * k} ${x + w - r},${y + h - 44 * k} L${x + w / 2 + pu},${y + h - 6 * k} Q${x + w / 2},${y + h + 6 * k} ${x + w / 2 - pu},${y + h - 6 * k}`
    + ` L${x + r},${y + h - 44 * k} Q${x},${y + h - 60 * k} ${x},${y + h - 90 * k} L${x},${y + c + 10 * k} Q${x},${y} ${x + c},${y} Z`;
}

/**
 * Una carta. o = { metal (objeto de METAL u oscura()), club (coloresClub), cara, escudo, grande ('19'), bajoGrande ('DEL'),
 *   nombre, lineas: [texto] (bajo el nombre), pie (SVG extra, ya colocado), caraAlto (fracción del ancho), esquina (texto arriba a la derecha) }
 * Devuelve { s, yNombre } para que quien la usa pueda colocar más cosas.
 */
function carta(x, y, w, h, o) {
  const t = o.metal, k = w / 404;
  const gF = id('cf'), gB = id('cb'), gS = id('cs'), gC = id('cg'), cl = id('cl');
  const borde = Math.max(4, 9 * k);
  const ruta = silueta(x, y, w, h), rutaIn = silueta(x + borde, y + borde, w - borde * 2, h - borde * 2);
  let s = `<defs>${lineal(gF, t.fondo, { x1: 0, y1: 0, x2: 0.6, y2: 1 })}${lineal(gB, t.borde, { x1: 0, y1: 0, x2: 1, y2: 1 })}`
    + lineal(gS, [[0, '#fff', 0], [0.45, '#fff', 0], [0.5, '#fff', t.brillo], [0.56, '#fff', 0], [1, '#fff', 0]], { x1: 0, y1: 0, x2: 1, y2: 0.55 })
    + lineal(gC, [[0, (o.club || {}).vivo || '#6b6b78', t.halo], [1, (o.club || {}).vivo || '#6b6b78', 0]])
    + `<clipPath id="${cl}"><path d="${rutaIn}"/></clipPath></defs>`
    + `<path d="${ruta}" transform="translate(0 ${Math.round(14 * k + 4)})" fill="#000" opacity="0.45"/>`
    + `<path d="${ruta}" fill="url(#${gB})"/><path d="${rutaIn}" fill="url(#${gF})"/>`;
  let dentro = `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.62}" fill="url(#${gC})"/>`;
  for (let i = -6; i < 14; i++) dentro += `<rect x="${x + i * 44 * k}" y="${y - 40}" width="${Math.max(1, 2 * k)}" height="${h + 80}" fill="${t.tinta}" opacity="0.05" transform="rotate(28 ${x + i * 44 * k} ${y})"/>`;
  const lado = w * (o.caraAlto || 0.86);
  dentro += caraFundida(o.cara, x + w * (o.caraCx || 0.63) - lado / 2, y + 30 * k, lado, { desde: 0.68 });
  dentro += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${gS})"/>`;
  s += `<g clip-path="url(#${cl})">${dentro}</g>`;
  // arriba a la izquierda: la cifra grande, lo que es y el escudo
  const xi = x + 62 * k;
  if (o.grande != null) s += texto(xi, y + 128 * k, o.grande, { px: Math.round(104 * k), peso: 900, color: t.tinta, ancla: 'middle', max: 92 * k });
  if (o.bajoGrande) s += texto(xi, y + 162 * k, o.bajoGrande, { px: Math.round(30 * k), peso: 700, color: t.tinta, ancla: 'middle', espacio: 1 * k })
    + `<rect x="${xi - 22 * k}" y="${y + 176 * k}" width="${44 * k}" height="${Math.max(1, 2 * k)}" fill="${t.linea}"/>`;
  if (o.escudo) s += escudo(o.escudo, xi, y + 218 * k, 58 * k);
  if (o.esquina) s += texto(x + w - 30 * k, y + 64 * k, o.esquina, { px: Math.round(40 * k), peso: 900, color: t.tinta, ancla: 'end', opacidad: 0.55 });
  // nombre y líneas
  const yN = y + (o.yNombre || 0.63) * h;
  s += texto(x + w / 2, yN, String(o.nombre).toUpperCase(), { px: Math.round(Math.max(46 * k, 25)), peso: 800, color: t.tinta, ancla: 'middle', max: w - 40 * k, espacio: 0.5 * k })
    + `<rect x="${x + 40 * k}" y="${yN + 16 * k}" width="${w - 80 * k}" height="${Math.max(1, 1.5 * k)}" fill="${t.linea}"/>`;
  (o.lineas || []).forEach((l, i) => {
    const [txt, color] = Array.isArray(l) ? l : [l, t.tenue];
    s += texto(x + w / 2, yN + Math.max(54 * k, 30) + i * Math.max(38 * k, 24), txt, { px: Math.round(Math.max(30 * k, 19)), peso: 700, color, ancla: 'middle', max: w - 40 * k, espacio: 0.5 * k });
  });
  return { s: s + (o.pie || ''), yNombre: yN, k };
}

/** cifra grande con su etiqueta debajo, centradas en cx */
function cifra(cx, y, valor, etiqueta, { px = 40, color = TINTA, tenue = TENUE, max = null } = {}) {
  return texto(cx, y, valor, { px, peso: 800, color, ancla: 'middle', max })
    + texto(cx, y + px * 0.62, etiqueta, { px: Math.round(px * 0.46), peso: 700, color: tenue, ancla: 'middle', espacio: 1, max });
}

/** cabecera de partido: escudos y nombres a los lados y lo de en medio (marcador o VS) */
function cabeceraPartido(L, V, centro, { arriba, colorArriba = TENUE, y = 118 } = {}) {
  return texto(600, 46, arriba, { px: 22, peso: 700, color: colorArriba, ancla: 'middle', espacio: 3 })
    + escudo(L.escudo, 92, y - 12, 92) + escudo(V.escudo, 1108, y - 12, 92)
    + texto(152, y + 2, L.corto.toUpperCase(), { px: 48, peso: 800, max: 300 })
    + texto(1048, y + 2, V.corto.toUpperCase(), { px: 48, peso: 800, ancla: 'end', max: 300 })
    + centro;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de final de partido: marcador, los 3 mejores de cada equipo en carta y los 3 peores en fichas.
// d = { jornada, local, visitante } con cada lado { nombre, corto, goles, escudo (PNG), mejores: [{nombre, pts, cara}] (3),
//       peores: [...] (hasta 3, de más a menos malo: el primero es el que menos puntos ha sacado) }
function fichaPeor(x, y, w, j, club) {
  const r = 19, cx = x + 8 + r, cy = y + 28;
  return `<rect x="${x}" y="${y}" width="${w}" height="56" rx="10" fill="${PANEL}" stroke="${LINEA}" stroke-width="1.2"/>`
    + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 2 })
    + texto(cx + r + 8, cy + 8, String(j.nombre).toUpperCase(), { px: 22, peso: 700, max: w - (cx + r + 8 - x) - 42 })
    + texto(x + w - 10, cy + 11, String(j.pts), { px: 32, peso: 900, color: j.pts < 0 ? MALO : TINTA, ancla: 'end' });
}
export function svgFinal(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  const oro = dorado();
  let s = oro.defs + fondo([[200, 60, 560, cL.vivo, 0.6], [1000, 60, 560, cV.vivo, 0.6]]);
  s += cabeceraPartido(L, V, texto(600, 156, `${L.goles}-${V.goles}`, { px: 132, peso: 900, color: `url(#${oro.g})`, ancla: 'middle', italica: true }),
    { arriba: `FINAL · LALIGA FANTASY · JORNADA ${d.jornada}` });
  const lado = (x0, eq, club) => {
    let t = texto(x0 + 2, 210, 'MEJORES', { px: 20, peso: 700, color: VERDE, espacio: 3 });
    const w = 166, gap = 14;
    eq.mejores.slice(0, 3).forEach((j, i) => {
      t += carta(x0 + i * (w + gap), 222, w, 274, { metal: METAL[metalDe(j.pts)], club, cara: j.cara, grande: String(j.pts), bajoGrande: 'PTS', nombre: j.nombre, yNombre: 0.83 }).s;
    });
    if (eq.peores.length) {
      t += texto(x0 + 2, 540, 'PEORES', { px: 20, peso: 700, color: MALO, espacio: 3 });
      eq.peores.slice(0, 3).forEach((j, i) => { t += fichaPeor(x0 + i * 181, 552, 172, j, club); });
    }
    return t;
  };
  s += lado(48, L, cL) + lado(612, V, cV) + marca(600, 650, { ancla: 'middle' });
  return marco(s);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de jugador: la carta grande a la izquierda y, a la derecha, el motivo, el marcador, las últimas jornadas y el valor.
// d = { jornada, etiqueta ('MVP · Barça 6-1 Alavés' o '¡DOBLETE! · …'), nombre, posicion, club: {nombre, corto, escudo},
//       cara, ptsJornada, total, media, ultimas: [[jornada, pts], …] (5), valor: [[ms, €], …] (30 días), valorHoy, cambio (% en 30 días), dias }
function miniJornadas(x, y, ultimas, gOro) {
  let s = '';
  const w = 98, h = 116, paso = 112;
  ultimas.forEach(([jn, p], i) => {
    const x0 = x + i * paso, ult = i === ultimas.length - 1;
    s += `<path d="M${x0 + 14},${y} L${x0 + w},${y} L${x0 + w - 14},${y + h} L${x0},${y + h} Z" fill="${ult ? `url(#${gOro})` : PANEL}" stroke="${ult ? 'none' : LINEA}" stroke-width="1.5"/>`
      + texto(x0 + w / 2, y + 64, String(p), { px: 54, peso: 900, color: ult ? '#2a1c04' : p < 0 ? MALO : TINTA, ancla: 'middle' })
      + texto(x0 + w / 2, y + 96, `J${jn}`, { px: 20, peso: 700, color: ult ? '#5a420f' : TENUE, ancla: 'middle', espacio: 1 });
  });
  return s;
}
function graficaValor(x, y, w, h, valor, color) {
  if (!valor || valor.length < 2) return texto(x, y + h / 2, 'Sin histórico de valor', { px: 22, peso: 600, color: TENUE });
  const vs = valor.map(([, v]) => v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
  const t0 = valor[0][0], t1 = valor[valor.length - 1][0];
  const px = (t) => x + (t - t0) / ((t1 - t0) || 1) * w, py = (v) => y + h - (v - min) / rango * h;
  const pts = valor.map(([t, v]) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const g = id('gv');
  const [ux, uy] = [px(t1), py(vs[vs.length - 1])];
  return `<defs>${lineal(g, [[0, color, 0.35], [1, color, 0]])}</defs>`
    + `<polygon points="${x},${y + h} ${pts} ${ux},${y + h}" fill="url(#${g})"/>`
    + `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<circle cx="${ux}" cy="${uy}" r="6.5" fill="${color}" stroke="${FONDO}" stroke-width="3"/>`;
}
export function svgJugador(d) {
  const c = coloresClub(d.club.nombre);
  const oro = dorado(), metal = METAL[metalDe(d.ptsJornada)];
  let s = oro.defs + fondo([[300, 330, 560, c.vivo, 0.75], [1050, 80, 500, c.vivo, 0.18]]);
  // la carta: debajo del nombre, cuatro cifras con su etiqueta (Carlos, 3 nov 10:44: que se entienda qué es cada una)
  const x = 96, y = 36, w = 404, h = 600;
  const C = carta(x, y, w, h, { metal, club: c, cara: d.cara, escudo: d.club.escudo, grande: String(d.ptsJornada), bajoGrande: ABREV[d.posicion] || d.posicion, nombre: d.nombre });
  s += C.s;
  const colC = d.cambio > 0 ? (metal === METAL.elite || metal === METAL.roja ? VERDE : '#0f7a43') : d.cambio < 0 ? (metal === METAL.elite || metal === METAL.roja ? MALO : '#a3172a') : metal.tenue;
  const yc = C.yNombre + 66, xs = [x + w * 0.29, x + w * 0.71];
  s += cifra(xs[0], yc, num1(d.media), 'PUNTOS DE MEDIA', { px: 40, color: metal.tinta, tenue: metal.tenue, max: 160 })
    + cifra(xs[1], yc, String(d.total), 'PUNTOS TOTALES', { px: 40, color: metal.tinta, tenue: metal.tenue, max: 160 })
    + cifra(xs[0], yc + 74, millones(d.valorHoy), 'VALOR', { px: 40, color: metal.tinta, tenue: metal.tenue, max: 160 })
    + cifra(xs[1], yc + 74, `${signo(d.cambio)} %`, `EN ${d.dias} DÍAS`, { px: 40, color: colC, tenue: metal.tenue, max: 160 })
    + `<rect x="${x + w / 2 - 0.75}" y="${yc - 34}" width="1.5" height="128" fill="${metal.linea}"/>`;
  // derecha
  const x0 = 566, wd = ANCHO - x0 - 56;
  const [motivo, ...resto] = d.etiqueta.split(' · ');
  s += texto(x0 - 4, 158, motivo.toUpperCase(), { px: 150, peso: 800, italica: true, color: `url(#${oro.g})`, max: wd })
    + texto(x0, 206, resto.join(' · ').toUpperCase(), { px: 34, peso: 700, espacio: 1.5, max: wd })
    + texto(x0, 238, `LALIGA FANTASY · JORNADA ${d.jornada}`, { px: 20, peso: 600, color: TENUE, espacio: 3 })
    + texto(x0, 296, 'PUNTOS EN LAS ÚLTIMAS JORNADAS', { px: 20, peso: 700, color: TENUE, espacio: 3 })
    + miniJornadas(x0, 312, d.ultimas, oro.g);
  const yv = 478, colV = d.cambio > 0 ? VERDE : d.cambio < 0 ? MALO : TENUE;
  s += texto(x0, yv, `VALOR · ${d.dias} DÍAS`, { px: 20, peso: 700, color: TENUE, espacio: 3 })
    + texto(x0, yv + 50, millones(d.valorHoy), { px: 52, peso: 800 })
    + texto(x0 + 170, yv + 46, `${signo(d.cambio)} %`, { px: 34, peso: 800, color: colV })
    + graficaValor(x0 + 290, yv + 6, wd - 290, 62, d.valor, d.cambio < 0 ? MALO : '#e2bd5a');
  s += marca(x0, 636);
  return marco(s);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del resumen de la jornada: los 6 mejores o los 6 peores, seis cartas en fila.
// d = { jornada, clave: 'mejores'|'peores', filas: [{ nombre, equipo, club (nombre largo), pts, cara (PNG), escudo (PNG) }] (6) }
export function svgResumen(d) {
  const bueno = d.clave === 'mejores';
  const tit = bueno ? dorado() : rojizo();
  let s = tit.defs + fondo([[600, -80, 760, bueno ? '#e2bd5a' : MALO, 0.22]]);
  s += texto(44, 126, bueno ? 'LOS MEJORES' : 'LOS PEORES', { px: 104, peso: 800, italica: true, color: `url(#${tit.g})` })
    + texto(1156, 84, `JORNADA ${d.jornada}`, { px: 40, peso: 800, ancla: 'end', espacio: 1 })
    + texto(1156, 118, 'LALIGA FANTASY', { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 3 });
  const filas = d.filas.slice(0, 6), w = 174, gap = 15, x0 = (ANCHO - (filas.length * w + (filas.length - 1) * gap)) / 2;
  filas.forEach((j, i) => {
    const club = coloresClub(j.club || j.equipo);
    s += carta(x0 + i * (w + gap), 176, w, 400, { metal: METAL[metalDe(j.pts)], club, cara: j.cara, escudo: j.escudo, grande: String(j.pts), bajoGrande: 'PTS',
      nombre: j.nombre, lineas: [j.equipo], esquina: String(i + 1), yNombre: 0.72, caraAlto: 1.25, caraCx: 0.58 }).s;
  });
  return marco(s + marca(600, 648, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de los onces de un partido (posibles, con el % de titularidad de la app, o confirmados): un campo por equipo con sus
// jugadores colocados por líneas según la formación.
// d = { jornada, confirmados, local, visitante } con cada lado { nombre, corto, escudo (PNG), formacion ('4-3-3'),
//       once: [{ pos: 'POR'|'DEF'|'MED'|'DEL', nombre, pct (0-100) | null, duda: bool }] (11, de portero a delanteros) }
function lineasDe(lado) {
  const once = lado.once.slice(0, 11);
  const f = String(lado.formacion || '').split('-').map(Number).filter((x) => x > 0);
  if (f.reduce((a, b) => a + b, 0) === once.length - 1) {
    const out = [once.slice(0, 1)]; let i = 1;
    for (const c of f) { out.push(once.slice(i, i + c)); i += c; }
    return out;
  }
  // sin formación que cuadre, por puestos
  return ['POR', 'DEF', 'MED', 'DEL'].map((p) => once.filter((j) => j.pos === p)).filter((l) => l.length);
}
function campo(x, y, w, h, lado, club, confirmados) {
  const g = id('cp'), gl = id('cl');
  let s = `<defs>${lineal(g, [[0, club.vivo, 0.32], [1, '#121017', 0.95]])}</defs>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#121017"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="url(#${g})"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${club.vivo}" stroke-opacity="0.55" stroke-width="2"/>`;
  // líneas del campo, finas: área grande y pequeña abajo, medio campo arriba
  const lc = 'stroke="#ffffff" stroke-opacity="0.13" stroke-width="2" fill="none"';
  s += `<rect x="${x + w * 0.22}" y="${y + h - 92}" width="${w * 0.56}" height="92" ${lc}/><rect x="${x + w * 0.37}" y="${y + h - 36}" width="${w * 0.26}" height="36" ${lc}/>`
    + `<path d="M${x + w * 0.38},${y + h - 92} A${w * 0.12},${w * 0.07} 0 0 1 ${x + w * 0.62},${y + h - 92}" ${lc}/>`
    + `<path d="M${x + w * 0.32},${y} A${w * 0.18},${w * 0.18} 0 0 0 ${x + w * 0.68},${y}" ${lc}/>`;
  void gl;
  const lineas = lineasDe(lado).reverse();             // delanteros arriba, portero abajo
  const hl = (h - 30) / lineas.length;
  lineas.forEach((ls, i) => {
    const cy = y + 22 + hl * i + hl / 2;
    const anchoF = Math.min(ls.length <= 3 ? 130 : 112, (w - 24) / ls.length - 6);
    ls.forEach((j, k) => {
      const cx = x + (w / (ls.length + 1)) * (k + 1);
      const pctCol = j.pct == null ? null : j.pct >= 75 ? VERDE : j.pct >= 50 ? AMBAR : MALO;
      const borde = j.duda ? AMBAR : pctCol && !confirmados ? pctCol : '#e2bd5a';
      s += `<rect x="${cx - anchoF / 2}" y="${cy - 28}" width="${anchoF}" height="${pctCol ? 56 : 42}" rx="9" fill="${PANEL}" stroke="${borde}" stroke-opacity="0.8" stroke-width="1.6"/>`
        + texto(cx, cy - 3, String(j.nombre).toUpperCase(), { px: 21, peso: 700, ancla: 'middle', max: anchoF - 10 })
        + (pctCol ? texto(cx, cy + 20, `${j.pct} %`, { px: 19, peso: 800, color: pctCol, ancla: 'middle' }) : '');
    });
  });
  s += texto(x + 18, y + 36, lado.formacion || '', { px: 26, peso: 800, color: TINTA, espacio: 1 });
  return s;
}
export function svgOnces(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  const oro = dorado();
  let s = oro.defs + fondo([[200, 40, 520, cL.vivo, 0.55], [1000, 40, 520, cV.vivo, 0.55]]);
  s += cabeceraPartido(L, V, texto(600, 134, 'VS', { px: 64, peso: 900, italica: true, color: `url(#${oro.g})`, ancla: 'middle' }),
    { arriba: `${d.confirmados ? 'ONCES CONFIRMADOS' : 'POSIBLES ONCES'} · JORNADA ${d.jornada}`, colorArriba: d.confirmados ? VERDE : '#e2bd5a', y: 112 });
  s += campo(40, 168, 550, 448, L, cL, d.confirmados) + campo(610, 168, 550, 448, V, cV, d.confirmados);
  return marco(s + marca(600, 652, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del mercado de cada noche: top 5 que suben (izquierda) y que bajan (derecha), en fichas con borde de metal.
// d = { fecha: '3 de noviembre', suben: [fila] (5), bajan: [fila] (5) } con fila = { nombre, equipo, club, cara (PNG), escudo (PNG),
//       dif: '+2,3 M', pct: '+2,3 %', valor: '102 M' }
function fichaMercado(x, y, w, h, f, i, bueno) {
  const acento = bueno ? VERDE : MALO;
  const club = coloresClub(f.club || f.equipo);
  const gB = id('fb'), gF = id('ff'), cl = id('fc');
  let s = `<defs>${lineal(gB, [[0, '#ffffff'], [0.35, acento], [1, '#2a2632']], { x1: 0, y1: 0, x2: 1, y2: 1 })}`
    + `${lineal(gF, [[0, club.vivo, 0.35], [0.5, '#17151d', 1], [1, '#121017', 1]], { x1: 0, y1: 0, x2: 1, y2: 0 })}`
    + `<clipPath id="${cl}"><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="13"/></clipPath></defs>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="url(#${gB})"/>`
    + `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="13" fill="url(#${gF})"/>`
    + `<g clip-path="url(#${cl})">${caraFundida(f.cara, x + 34, y + 2, h + 10, { desde: 0.78 })}</g>`
    + texto(x + 20, y + 34, String(i + 1), { px: 30, peso: 900, color: TINTA, ancla: 'middle', opacidad: 0.6 });
  const xt = x + 34 + h + 18;
  s += texto(xt, y + h / 2 - 2, String(f.nombre).toUpperCase(), { px: 30, peso: 800, max: w - (xt - x) - 150 })
    + escudo(f.escudo, xt + 11, y + h / 2 + 22, 24)
    + texto(xt + (f.escudo ? 28 : 0), y + h / 2 + 30, `${f.equipo} · ${f.valor}`, { px: 21, peso: 600, color: TENUE, max: w - (xt - x) - 175 })
    + texto(x + w - 18, y + h / 2 + 4, f.dif, { px: 40, peso: 900, color: acento, ancla: 'end' })
    + texto(x + w - 18, y + h / 2 + 30, f.pct, { px: 22, peso: 700, color: acento, ancla: 'end', opacidad: 0.85 });
  return s;
}
export function svgMercado(d) {
  const oro = dorado();
  let s = oro.defs + fondo([[260, -40, 620, VERDE, 0.22], [940, -40, 620, MALO, 0.22]]);
  s += texto(44, 118, 'MERCADO', { px: 104, peso: 800, italica: true, color: `url(#${oro.g})` })
    + texto(1156, 84, d.fecha.toUpperCase(), { px: 40, peso: 800, ancla: 'end', espacio: 1 })
    + texto(1156, 118, 'LALIGA FANTASY', { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 3 });
  const w = 548, h = 78, gap = 10, y0 = 186;
  const col = (x, lista, bueno) => {
    const acento = bueno ? VERDE : MALO;
    let t = `<path d="M${x + 2},${y0 - 22} l9,${bueno ? -12 : 12} l9,${bueno ? 12 : -12} z" fill="${acento}" transform="translate(0 ${bueno ? 2 : -10})"/>`
      + texto(x + 28, y0 - 16, bueno ? 'SUBEN' : 'BAJAN', { px: 24, peso: 800, color: acento, espacio: 3 });
    lista.slice(0, 5).forEach((f, i) => { t += fichaMercado(x, y0 + i * (h + gap), w, h, f, i, bueno); });
    return t;
  };
  s += col(44, d.suben, true) + col(608, d.bajan, false);
  return marco(s + marca(600, 652, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de bajas y novedades. Dos formas:
//   - de un equipo (todas las filas del mismo club): escudo y nombre grandes arriba, el próximo rival a la derecha y una carta
//     por jugador (1 a 4) con cara, puesto, media y la etiqueta de su estado;
//   - de varios equipos: hasta 6 cartas en fila, con el escudo de cada uno.
// d = { jornada, titulo ('BAJAS'|'BAJAS Y DUDAS'|'DUDAS'|'NOVEDADES'), equipo: { nombre, corto, escudo } | null,
//       rival: { corto, nombre, escudo } | null,
//       filas: [{ nombre, equipo, club, posicion, cara, escudo, estado: 'lesionado'|'sancionado'|'duda'|'disponible', pct, media ('5,2'|null) }] }
const ESTADO_TARJETA = {
  lesionado: { txt: 'LESIONADO', color: MALO },
  sancionado: { txt: 'SANCIONADO', color: MALO },
  duda: { txt: 'DUDA', color: AMBAR },
  disponible: { txt: 'DISPONIBLE', color: VERDE },
};
/** el dibujo pequeño del estado: cruz (lesión), tarjeta roja (sanción), círculo con punto (duda) o visto (disponible) */
function iconoEstado(estado, cx, cy, s, c) {
  if (estado === 'sancionado') return `<rect x="${cx - s * 0.32}" y="${cy - s * 0.45}" width="${s * 0.64}" height="${s * 0.9}" rx="${s * 0.08}" fill="${c}" transform="rotate(12 ${cx} ${cy})"/>`;
  if (estado === 'lesionado') { const a = s * 0.16, b = s * 0.46; return `<rect x="${cx - a}" y="${cy - b}" width="${a * 2}" height="${b * 2}" rx="${a * 0.5}" fill="${c}"/><rect x="${cx - b}" y="${cy - a}" width="${b * 2}" height="${a * 2}" rx="${a * 0.5}" fill="${c}"/>`; }
  if (estado === 'disponible') return `<path d="M${cx - s * 0.4} ${cy} L${cx - s * 0.1} ${cy + s * 0.3} L${cx + s * 0.42} ${cy - s * 0.32}" fill="none" stroke="${c}" stroke-width="${s * 0.18}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${s * 0.42}" fill="none" stroke="${c}" stroke-width="${s * 0.14}"/><circle cx="${cx}" cy="${cy}" r="${s * 0.11}" fill="${c}"/>`;
}
const txtEstado = (f) => (f.estado === 'duda' && f.pct != null ? `DUDA · ${f.pct} %` : ESTADO_TARJETA[f.estado].txt);
/** la etiqueta del estado, centrada en cx, en el color del estado y con la letra oscura */
function pildora(f, cx, cy, px, wMax) {
  const e = ESTADO_TARJETA[f.estado], txt = txtEstado(f);
  let p = px; while (p > 12 && medir(txt, p, B, 1) + p * 2.6 > wMax) p--;
  const w = medir(txt, p, B, 1) + p * 2.6, h = p * 1.75, x = cx - w / 2;
  return `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${e.color}"/>`
    + iconoEstado(f.estado, x + p * 0.95, cy, p * 0.9, '#120f16')
    + texto(x + p * 1.75, cy + p * 0.36, txt, { px: p, peso: 800, color: '#120f16', espacio: 1 });
}
function cartaBaja(x, y, w, h, f, { conEscudo }) {
  const e = ESTADO_TARJETA[f.estado], club = coloresClub(f.club || f.equipo);
  const C = carta(x, y, w, h, { metal: oscura(e.color), club, cara: f.cara, escudo: conEscudo ? f.escudo : null,
    grande: f.media || null, bajoGrande: f.media ? 'MEDIA' : (ABREV[f.posicion] || null), nombre: f.nombre,
    lineas: [conEscudo ? f.equipo : f.posicion].filter(Boolean), yNombre: conEscudo && w < 200 ? 0.7 : 0.66, caraAlto: w < 200 ? 1.25 : 1.0, caraCx: w < 200 ? 0.58 : 0.6 });
  return C.s + pildora(f, x + w / 2, C.yNombre + Math.max(100 * C.k, 62), Math.round(Math.max(32 * C.k, 16)), w - 40 * C.k);
}
export function svgBajas(d) {
  const filas = d.filas.slice(0, d.equipo ? 4 : 6);
  const tono = d.titulo === 'NOVEDADES' ? VERDE : d.titulo === 'DUDAS' ? AMBAR : MALO;
  const tit = d.titulo === 'NOVEDADES' ? dorado() : rojizo();
  let s = tit.defs;
  if (d.equipo) {
    const club = coloresClub(d.equipo.nombre || d.equipo.corto);
    s += fondo([[140, 60, 640, club.vivo, 0.6]])
      + escudo(d.equipo.escudo, 96, 92, 112)
      + texto(d.equipo.escudo ? 172 : 44, 66, `${d.titulo} · JORNADA ${d.jornada}`, { px: 26, peso: 800, italica: true, color: d.titulo === 'DUDAS' ? AMBAR : `url(#${tit.g})`, espacio: 2 })
      + texto(d.equipo.escudo ? 170 : 42, 136, d.equipo.corto.toUpperCase(), { px: 84, peso: 900, max: d.rival ? 620 : 980 });
    if (d.rival) {
      const cR = coloresClub(d.rival.nombre || d.rival.corto);
      s += radial(1080, 80, 300, cR.vivo, 0.3)
        + texto(1156, 62, 'PRÓXIMO RIVAL', { px: 20, peso: 700, color: TENUE, ancla: 'end', espacio: 3 })
        + escudo(d.rival.escudo, 1126, 112, 54)
        + texto(d.rival.escudo ? 1088 : 1156, 128, d.rival.corto.toUpperCase(), { px: 40, peso: 800, ancla: 'end', max: 300 });
    }
    const nn = filas.length, w = nn === 1 ? 300 : 250, h = nn === 1 ? 420 : 420, gap = 30;
    const x0 = (ANCHO - (nn * w + (nn - 1) * gap)) / 2;
    filas.forEach((f, i) => { s += cartaBaja(x0 + i * (w + gap), 176, w, h, f, { conEscudo: false }); });
  } else {
    s += fondo([[600, -80, 760, tono, 0.22]])
      + texto(44, 118, d.titulo, { px: 104, peso: 800, italica: true, color: d.titulo === 'DUDAS' ? AMBAR : `url(#${tit.g})`, max: 760 })
      + texto(1156, 84, `JORNADA ${d.jornada}`, { px: 40, peso: 800, ancla: 'end', espacio: 1 })
      + texto(1156, 118, 'LALIGA FANTASY', { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 3 });
    const nn = filas.length, w = nn <= 3 ? 250 : nn === 4 ? 220 : 174, gap = nn <= 4 ? 26 : 15;
    const x0 = (ANCHO - (nn * w + (nn - 1) * gap)) / 2;
    filas.forEach((f, i) => { s += cartaBaja(x0 + i * (w + gap), 170, w, Math.min(420, w * 2.3), f, { conEscudo: true }); });
  }
  return marco(s + marca(600, 652, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
let Resvg = null;
/** SVG -> PNG (Buffer). @resvg/resvg-js se carga solo si hace falta: el bot sin tarjetas no lo necesita */
export async function aPng(svg) {
  if (!Resvg) ({ Resvg } = await import('@resvg/resvg-js'));
  const r = new Resvg(svg, { font: { fontFiles: FUENTES, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'original' } });
  return Buffer.from(r.render().asPng());
}
export { luz };
