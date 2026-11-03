// La carta de coleccionista (diseño propio, Carlos, 3 nov 10:44-11:11) para las tarjetas que hablan de UN jugador concreto:
// la de jugador (MVP y directo) y la de una baja o novedad de un solo jugador. Todas las demás siguen en el estilo «noche»
// (tarjetas.mjs). Letra Barlow Condensed (OFL, en fuentes/; tarjetas.mjs la carga en aPng) y titulares en dorado.
// El metal de la carta va por lo bueno que es el jugador, medido por su valor de mercado (`metalDe`): leyenda (negra con oro,
// 90 M o más: Lamine Yamal, Mbappé…), oro (35-90 M), plata (10-35 M) y bronce (menos de 10 M: un reserva del Málaga).
// Mismos datos que antes (datos-tarjetas.mjs) y mismo validador: las palabras nuevas están en PALABRAS_FIJAS.
import { coloresClub } from './colores.mjs';

const ANCHO = 1200, ALTO = 675;
const ROJO = '#ee1c3c', VERDE = '#2fd27f', MALO = '#ff4d5e', AMBAR = '#f2b33d';
const TINTA = '#f4f2f3', TENUE = '#8c869a', FONDO = '#0b0a0f', PANEL = '#17151d', LINEA = '#2c2834';
const B = 'Barlow Condensed';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uri = (buf) => (buf ? `data:image/png;base64,${Buffer.from(buf).toString('base64')}` : null);
/** 7.25 -> «7,3»; enteros sin decimales */
const num1 = (x) => (Math.round(Number(x) * 10) / 10).toString().replace('.', ',');
/** valor de mercado: 101970432 -> «102 M», 8450000 -> «8,5 M», 640000 -> «0,6 M» */
const millones = (v) => `${num1(v / 1e6)} M`;
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
const marco = (cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}"><rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>${cuerpo}<rect width="${ANCHO}" height="6" fill="${ROJO}"/></svg>`;
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
  leyenda: { fondo: [[0, '#1d1a26'], [0.55, '#0e0c13'], [1, '#2a2213']], borde: [[0, '#fff1c1'], [0.4, '#d9ad4b'], [0.7, '#8a6420'], [1, '#f3d58a']], tinta: '#f6e7b8', tenue: '#bfa66a', linea: '#5d4a22', brillo: 0.10, halo: 0.55 },
  oro: { fondo: [[0, '#fbe9a6'], [0.45, '#e2bd5a'], [1, '#a77a23']], borde: [[0, '#fff6d6'], [0.5, '#c8952f'], [1, '#7a5512']], tinta: '#2a1c04', tenue: '#5a420f', linea: '#8a6a26', brillo: 0.35, halo: 0.28 },
  plata: { fondo: [[0, '#f3f5f8'], [0.5, '#c5ccd6'], [1, '#8b94a1']], borde: [[0, '#ffffff'], [0.5, '#a2abb7'], [1, '#606875']], tinta: '#1a1e25', tenue: '#454c58', linea: '#7b8491', brillo: 0.35, halo: 0.25 },
  bronce: { fondo: [[0, '#f0c9a0'], [0.5, '#c58a55'], [1, '#86522a']], borde: [[0, '#ffe2c4'], [0.5, '#b0743f'], [1, '#6a3c19']], tinta: '#2b1607', tenue: '#5b3417', linea: '#8d5a33', brillo: 0.3, halo: 0.25 },
};
// el metal por el valor de mercado (Carlos, 3 nov 10:57: «depende de la calidad del jugador»). Con los valores del 3 nov, de 841
// jugadores de campo: unos 10 leyenda, unos 50 oro, unos 70 plata y el resto bronce
export const METALES = [['leyenda', 90e6], ['oro', 35e6], ['plata', 10e6], ['bronce', 0]];
export const metalDe = (valor) => (METALES.find(([, min]) => Number(valor) >= min) || METALES[METALES.length - 1])[0];

/** silueta de la carta: esquinas de arriba con muesca en el centro, lados rectos y punta suave abajo (todo a escala del ancho) */
function silueta(x, y, w, h) {
  const k = w / 404, c = 26 * k, r = 34 * k, mu = 40 * k, pu = 30 * k;
  return `M${x + c},${y} L${x + w / 2 - mu},${y} Q${x + w / 2},${y + 18 * k} ${x + w / 2 + mu},${y} L${x + w - c},${y} Q${x + w},${y} ${x + w},${y + c + 10 * k}`
    + ` L${x + w},${y + h - 90 * k} Q${x + w},${y + h - 60 * k} ${x + w - r},${y + h - 44 * k} L${x + w / 2 + pu},${y + h - 6 * k} Q${x + w / 2},${y + h + 6 * k} ${x + w / 2 - pu},${y + h - 6 * k}`
    + ` L${x + r},${y + h - 44 * k} Q${x},${y + h - 60 * k} ${x},${y + h - 90 * k} L${x},${y + c + 10 * k} Q${x},${y} ${x + c},${y} Z`;
}

/**
 * Una carta. o = { metal (objeto de METAL), club (coloresClub), cara, escudo, grande ('19'), bajoGrande ('DEL'),
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
export function svgJugadorCarta(d) {
  const c = coloresClub(d.club.nombre);
  const oro = dorado(), metal = METAL[metalDe(d.valorHoy)];
  let s = oro.defs + fondo([[300, 330, 560, c.vivo, 0.75], [1050, 80, 500, c.vivo, 0.18]]);
  // la carta: debajo del nombre, cuatro cifras con su etiqueta (Carlos, 3 nov 10:44: que se entienda qué es cada una)
  const x = 96, y = 36, w = 404, h = 600;
  const C = carta(x, y, w, h, { metal, club: c, cara: d.cara, escudo: d.club.escudo, grande: String(d.ptsJornada), bajoGrande: ABREV[d.posicion] || d.posicion, nombre: d.nombre });
  s += C.s;
  const oscuro = metal === METAL.leyenda;
  const colC = d.cambio > 0 ? (oscuro ? VERDE : '#0f7a43') : d.cambio < 0 ? (oscuro ? MALO : '#a3172a') : metal.tenue;
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
/** ancho de la etiqueta del estado (para colocarla a la derecha) */
const anchoPildora = (f, px) => medir(txtEstado(f), px, B, 1) + px * 2.6;

/** un solo jugador: la carta grande a la izquierda y, a la derecha, su estado en grande, el equipo y el próximo rival */
export function svgBajaSola(d) {
  const f = d.filas[0];
  const e = ESTADO_TARJETA[f.estado], club = coloresClub(f.club || f.equipo);
  const g = id('ge');
  let s = `<defs>${lineal(g, [[0, '#ffffff'], [0.45, e.color], [1, e.color]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`
    + fondo([[300, 330, 560, club.vivo, 0.75], [1050, 80, 500, e.color, 0.16]]);
  const x = 96, y = 36, w = 404, h = 600;
  const C = carta(x, y, w, h, { metal: METAL[metalDe(f.valor)], club, cara: f.cara, escudo: f.escudo || (d.equipo && d.equipo.escudo),
    grande: f.media || null, bajoGrande: f.media ? 'MEDIA' : (ABREV[f.posicion] || null), nombre: f.nombre, lineas: [f.posicion].filter(Boolean), yNombre: 0.7 });
  s += C.s + pildora(f, x + w / 2, C.yNombre + 112, 30, w - 60);
  const x0 = 566, wd = ANCHO - x0 - 56;
  const grande = f.estado === 'duda' && f.pct != null ? `DUDA · ${f.pct} %` : e.txt;
  s += texto(x0 - 4, 158, grande, { px: 140, peso: 800, italica: true, color: `url(#${g})`, max: wd })
    + texto(x0, 206, `${(f.equipo || '').toUpperCase()} · JORNADA ${d.jornada}`, { px: 34, peso: 700, espacio: 1.5, max: wd })
    + texto(x0, 238, 'LALIGA FANTASY', { px: 20, peso: 600, color: TENUE, espacio: 3 });
  if (d.rival) {
    const cR = coloresClub(d.rival.nombre || d.rival.corto);
    s += radial(1000, 440, 320, cR.vivo, 0.35)
      + texto(x0, 360, 'PRÓXIMO RIVAL', { px: 22, peso: 700, color: TENUE, espacio: 3 })
      + escudo(d.rival.escudo, x0 + 44, 444, 96)
      + texto(x0 + (d.rival.escudo ? 110 : 0), 470, d.rival.corto.toUpperCase(), { px: 72, peso: 800, max: wd - 110 });
  }
  return marco(s + marca(x0, 636));
}

