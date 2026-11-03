// Rediseño premium de las tarjetas (Carlos, 3 nov 10:35): dos direcciones para que elija, primero con la tarjeta de jugador.
//   «carta»: carta de coleccionista de videojuego de fútbol (diseño propio): carta con la media grande, posición, escudo, cara y
//            seis cifras; el color de la carta sale de los puntos de la jornada (élite, oro, plata, bronce).
//   «oro»:   sobrio, negro y dorado, con serifa (Playfair Display) y cifras en «botones de cuota».
// Recibe los mismos datos que svgJugador (datos-tarjetas.mjs) y pasa por el mismo validador.
import { coloresClub } from './colores.mjs';
import { num1, millones, ANCHO, ALTO } from './tarjetas.mjs';

const ROJO = '#ee1c3c', VERDE = '#16c172', MALO = '#ff4d5e';
const FUENTES = ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'InterDisplay-Black.otf',
  'BarlowCondensed_600SemiBold.ttf', 'BarlowCondensed_700Bold.ttf', 'BarlowCondensed_800ExtraBold.ttf', 'BarlowCondensed_800ExtraBold_Italic.ttf',
  'BarlowCondensed_900Black.ttf', 'PlayfairDisplay_400Regular.ttf', 'PlayfairDisplay_600SemiBold.ttf', 'PlayfairDisplay_400Regular_Italic.ttf']
  .map((f) => new URL(`../fuentes/${f}`, import.meta.url).pathname);
// palabras fijas nuevas de estas tarjetas (se suman a PALABRAS_FIJAS)
export const FIJAS_PREMIUM = ['PTS', 'TOTAL', 'VALOR', 'MEDIA', 'PUNTOS', 'TEMPORADA', 'ÚLTIMAS', 'JORNADAS', 'DÍAS', 'JORNADA', 'EN', 'LA', 'DE', 'LOS'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uri = (buf) => (buf ? `data:image/png;base64,${Buffer.from(buf).toString('base64')}` : null);
const signo = (n) => (n > 0 ? `+${n}` : String(n));
let n = 0;
const id = (p) => `${p}${++n}`;

// ancho aproximado por familia (resvg no mide): Inter como base, Barlow Condensed más estrecha, Playfair algo más ancha
const FACTOR = { Inter: 1, 'Inter Display': 1.04, 'Barlow Condensed': 0.74, 'Playfair Display': 1.02 };
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
  return w * px * (FACTOR[fam] || 1);
}
function texto(x, y, s, { px = 24, peso = 700, color = '#fff', ancla = 'start', fam = 'Inter', espacio = 0, opacidad = 1, max = null, estilo = '', trazo = '' } = {}) {
  let p = px;
  if (max) { const min = Math.round(px * 0.5); while (p > min && ancho(s, p, fam) + String(s).length * espacio > max) p--; }
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${peso}" font-size="${p}" fill="${color}" text-anchor="${ancla}"`
    + `${espacio ? ` letter-spacing="${espacio}"` : ''}${opacidad < 1 ? ` opacity="${opacidad}"` : ''}${estilo ? ` font-style="${estilo}"` : ''}${fam === 'Playfair Display' ? ` font-feature-settings="'lnum'" style="font-feature-settings:'lnum'"` : ''}${trazo}>${esc(s)}</text>`;
}
const imagen = (buf, x, y, w, h, extra = '') => (buf ? `<image href="${uri(buf)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${extra}/>` : '');
const escudo = (buf, cx, cy, h) => { const w = Math.round(h * 78 / 105); return imagen(buf, cx - w / 2, cy - h / 2, w, h); };
const marco = (fondo, cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}"><rect width="${ANCHO}" height="${ALTO}" fill="${fondo}"/>${cuerpo}</svg>`;
const radial = (cx, cy, r, color, op) => { const g = id('r'); return `<defs><radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="${ANCHO}" height="${ALTO}" fill="url(#${g})"/>`; };
const lineal = (g, paradas, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) => `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${paradas.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
const ABREV = { Portero: 'POR', Defensa: 'DEF', Centrocampista: 'MED', Delantero: 'DEL', Entrenador: 'ENT' };

// ===========================================================================================================================
// A · «carta»
// el color de la carta por los puntos de la jornada: 15 o más, élite (negra con oro); 10-14, oro; 5-9, plata; menos, bronce
function tier(pts) {
  if (pts >= 15) return { nombre: 'elite', fondo: [[0, '#1d1a26'], [0.55, '#0e0c13'], [1, '#2a2213']], borde: [[0, '#fff1c1'], [0.4, '#d9ad4b'], [0.7, '#8a6420'], [1, '#f3d58a']], tinta: '#f6e7b8', tenue: '#bfa66a', linea: '#5d4a22' };
  if (pts >= 10) return { nombre: 'oro', fondo: [[0, '#fbe9a6'], [0.45, '#e2bd5a'], [1, '#a77a23']], borde: [[0, '#fff6d6'], [0.5, '#c8952f'], [1, '#7a5512']], tinta: '#2a1c04', tenue: '#5a420f', linea: '#8a6a26' };
  if (pts >= 5) return { nombre: 'plata', fondo: [[0, '#f3f5f8'], [0.5, '#c5ccd6'], [1, '#8b94a1']], borde: [[0, '#ffffff'], [0.5, '#a2abb7'], [1, '#606875']], tinta: '#1a1e25', tenue: '#454c58', linea: '#7b8491' };
  return { nombre: 'bronce', fondo: [[0, '#f0c9a0'], [0.5, '#c58a55'], [1, '#86522a']], borde: [[0, '#ffe2c4'], [0.5, '#b0743f'], [1, '#6a3c19']], tinta: '#2b1607', tenue: '#5b3417', linea: '#8d5a33' };
}

/** silueta de la carta: esquinas de arriba cortadas en curva y punta suave abajo */
function silueta(x, y, w, h) {
  const r = 34, c = 26;
  return `M${x + c},${y} L${x + w / 2 - 40},${y} Q${x + w / 2},${y + 18} ${x + w / 2 + 40},${y} L${x + w - c},${y} Q${x + w},${y} ${x + w},${y + c + 10}`
    + ` L${x + w},${y + h - 90} Q${x + w},${y + h - 60} ${x + w - r},${y + h - 44} L${x + w / 2 + 30},${y + h - 6} Q${x + w / 2},${y + h + 6} ${x + w / 2 - 30},${y + h - 6}`
    + ` L${x + r},${y + h - 44} Q${x},${y + h - 60} ${x},${y + h - 90} L${x},${y + c + 10} Q${x},${y} ${x + c},${y} Z`;
}

function carta(d, x, y, w, h) {
  const t = tier(d.ptsJornada), c = coloresClub(d.club.nombre);
  const gF = id('cf'), gB = id('cb'), gS = id('cs'), cl = id('cc'), gC = id('cg');
  const ruta = silueta(x, y, w, h), rutaIn = silueta(x + 9, y + 9, w - 18, h - 18);
  let s = `<defs>${lineal(gF, t.fondo, { x1: 0, y1: 0, x2: 0.6, y2: 1 })}${lineal(gB, t.borde, { x1: 0, y1: 0, x2: 1, y2: 1 })}`
    + `${lineal(gS, [[0, '#ffffff', 0], [0.45, '#ffffff', 0], [0.5, '#ffffff', t.nombre === 'elite' ? 0.10 : 0.35], [0.56, '#ffffff', 0], [1, '#ffffff', 0]], { x1: 0, y1: 0, x2: 1, y2: 0.55 })}`
    + `${lineal(gC, [[0, c.vivo, t.nombre === 'elite' ? 0.55 : 0.28], [1, c.vivo, 0]])}`
    + `<clipPath id="${cl}"><path d="${rutaIn}"/></clipPath></defs>`;
  // sombra, borde metálico, cuerpo
  s += `<path d="${ruta}" transform="translate(0 14)" fill="#000" opacity="0.45"/>`
    + `<path d="${ruta}" fill="url(#${gB})"/>`
    + `<path d="${rutaIn}" fill="url(#${gF})"/>`;
  // dentro de la carta (recortado): halo del club, líneas finas en diagonal, la cara y el brillo
  let dentro = `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.62}" fill="url(#${gC})"/>`;
  for (let k = -6; k < 14; k++) dentro += `<rect x="${x + k * 44}" y="${y - 40}" width="2" height="${h + 80}" fill="${t.tinta}" opacity="0.05" transform="rotate(28 ${x + k * 44} ${y})"/>`;
  // la cara se funde hacia abajo con una máscara (sin corte duro donde acaba la foto)
  if (d.cara) {
    const mk = id('cm'), gM = id('cmg'), iy = y + 30, iw = w * 0.86;
    dentro += `<defs>${lineal(gM, [[0, '#fff'], [0.72, '#fff'], [1, '#fff', 0]])}<mask id="${mk}"><rect x="${x}" y="${iy}" width="${w}" height="${iw}" fill="url(#${gM})"/></mask></defs>`
      + `<image href="${uri(d.cara)}" x="${x + w * 0.2}" y="${iy}" width="${iw}" height="${iw}" preserveAspectRatio="xMidYMax meet" mask="url(#${mk})"/>`;
  }
  dentro += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${gS})"/>`;
  s += `<g clip-path="url(#${cl})">${dentro}</g>`;
  // media (los puntos de la jornada), posición y escudo, arriba a la izquierda
  const xi = x + 62;
  s += texto(xi, y + 128, String(d.ptsJornada), { px: 104, peso: 900, fam: 'Barlow Condensed', color: t.tinta, ancla: 'middle' })
    + texto(xi, y + 162, ABREV[d.posicion] || d.posicion, { px: 32, peso: 700, fam: 'Barlow Condensed', color: t.tinta, ancla: 'middle', espacio: 1 })
    + `<rect x="${xi - 22}" y="${y + 176}" width="44" height="2" fill="${t.linea}"/>`
    + escudo(d.club.escudo, xi, y + 218, 58);
  // nombre
  const yN = y + h * 0.63;
  s += texto(x + w / 2, yN, d.nombre.toUpperCase(), { px: 46, peso: 800, fam: 'Barlow Condensed', color: t.tinta, ancla: 'middle', max: w - 60, espacio: 0.5 })
    + `<rect x="${x + 40}" y="${yN + 16}" width="${w - 80}" height="1.5" fill="${t.linea}"/>`;
  // seis cifras en dos columnas, estilo carta
  const ult = d.ultimas.slice(0, -1).slice(-2).reverse(); // las dos jornadas antes de esta
  const cifras = [[num1(d.media), 'MEDIA'], [String(d.total), 'TOTAL'], [`${num1(d.valorHoy / 1e6)}M`, 'VALOR'],
    [`${signo(d.cambio)}%`, `${d.dias} DÍAS`], ...ult.map(([jn, p]) => [String(p), `J${jn}`])];
  const col = [x + w * 0.27, x + w * 0.73];
  cifras.forEach(([v, et], i) => {
    const cx = col[i % 2], cy = yN + 66 + Math.floor(i / 2) * 44;
    s += texto(cx - 6, cy, v, { px: 34, peso: 800, fam: 'Barlow Condensed', color: t.tinta, ancla: 'end' })
      + texto(cx + 4, cy, et, { px: 22, peso: 600, fam: 'Barlow Condensed', color: t.tenue, espacio: 0.5 });
  });
  s += `<rect x="${x + w / 2 - 0.75}" y="${yN + 36}" width="1.5" height="124" fill="${t.linea}"/>`;
  return s;
}

/** mini carta de una jornada (barra de puntos): rombo inclinado con la cifra */
function miniJornadas(x, y, ultimas, tema) {
  let s = '';
  const w = 98, h = 116, paso = 112;
  const max = Math.max(4, ...ultimas.map(([, p]) => Math.abs(p)));
  ultimas.forEach(([jn, p], i) => {
    const x0 = x + i * paso, ult = i === ultimas.length - 1;
    const relleno = ult ? tema.oro : '#17151d';
    s += `<path d="M${x0 + 14},${y} L${x0 + w},${y} L${x0 + w - 14},${y + h} L${x0},${y + h} Z" fill="${ult ? `url(#${tema.gOro})` : relleno}" stroke="${ult ? 'none' : '#2c2834'}" stroke-width="1.5"/>`;
    s += texto(x0 + w / 2, y + 64, String(p), { px: 54, peso: 900, fam: 'Barlow Condensed', color: ult ? '#2a1c04' : p < 0 ? MALO : '#f4f2f3', ancla: 'middle' })
      + texto(x0 + w / 2, y + 96, `J${jn}`, { px: 20, peso: 700, fam: 'Barlow Condensed', color: ult ? '#5a420f' : '#8c869a', ancla: 'middle', espacio: 1 });
  });
  return s;
}

function graficaValor(x, y, w, h, valor, color, fondo, grosor = 4, area = 0.4) {
  if (!valor || valor.length < 2) return '';
  const vs = valor.map(([, v]) => v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
  const t0 = valor[0][0], t1 = valor[valor.length - 1][0];
  const px = (t) => x + (t - t0) / ((t1 - t0) || 1) * w, py = (v) => y + h - (v - min) / rango * h;
  const pts = valor.map(([t, v]) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const g = id('gv');
  const [ux, uy] = [px(t1), py(vs[vs.length - 1])];
  return `<defs>${lineal(g, [[0, color, area], [1, color, 0]])}</defs>`
    + `<polygon points="${x},${y + h} ${pts} ${ux},${y + h}" fill="url(#${g})"/>`
    + `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<circle cx="${ux}" cy="${uy}" r="${grosor + 3}" fill="${color}" stroke="${fondo}" stroke-width="3"/>`;
}

function marcaCarta(x, y, color = '#f4f2f3', tenue = '#8c869a') {
  return `<rect x="${x}" y="${y - 17}" width="6" height="22" rx="2" fill="${ROJO}"/>`
    + texto(x + 16, y, 'FANTASY MANAGER', { px: 24, peso: 800, fam: 'Barlow Condensed', color, espacio: 2 })
    + texto(x + 16 + ancho('FANTASY MANAGER', 24, 'Barlow Condensed') + 15 * 2 + 14, y, '@Fantasyman_app', { px: 22, peso: 600, fam: 'Barlow Condensed', color: tenue });
}

export function svgJugadorCarta(d) {
  const c = coloresClub(d.club.nombre);
  const gOro = id('go');
  const tema = { oro: '#e2bd5a', gOro };
  let s = `<defs>${lineal(gOro, [[0, '#fbe9a6'], [0.5, '#e2bd5a'], [1, '#b88a2c']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  // fondo: halo del club detrás de la carta, rayos en diagonal y el nombre del club gigante, casi transparente
  s += radial(300, 330, 560, c.vivo, 0.75) + radial(1050, 80, 500, c.vivo, 0.18);
  for (let k = 0; k < 9; k++) s += `<polygon points="${120 + k * 150},0 ${200 + k * 150},0 ${-80 + k * 150},${ALTO} ${-160 + k * 150},${ALTO}" fill="#fff" opacity="${0.018 + (k % 3) * 0.008}"/>`;
  s += carta(d, 96, 36, 404, 600);
  // derecha
  const x0 = 566, w = ANCHO - x0 - 56;
  const [motivo, ...resto] = d.etiqueta.split(' · ');
  s += texto(x0 - 4, 158, motivo.toUpperCase(), { px: 150, peso: 800, fam: 'Barlow Condensed', estilo: 'italic', color: `url(#${gOro})`, max: w })
    + texto(x0, 206, resto.join(' · ').toUpperCase(), { px: 34, peso: 700, fam: 'Barlow Condensed', color: '#f4f2f3', espacio: 1.5, max: w })
    + texto(x0, 238, `LALIGA FANTASY · JORNADA ${d.jornada}`, { px: 20, peso: 600, fam: 'Barlow Condensed', color: '#8c869a', espacio: 3 });
  s += texto(x0, 296, 'ÚLTIMAS JORNADAS', { px: 20, peso: 700, fam: 'Barlow Condensed', color: '#8c869a', espacio: 3 })
    + miniJornadas(x0, 312, d.ultimas, tema);
  // valor
  const yv = 478, colC = d.cambio > 0 ? VERDE : d.cambio < 0 ? MALO : '#8c869a';
  s += texto(x0, yv, `VALOR · ${d.dias} DÍAS`, { px: 20, peso: 700, fam: 'Barlow Condensed', color: '#8c869a', espacio: 3 })
    + texto(x0, yv + 50, millones(d.valorHoy), { px: 52, peso: 800, fam: 'Barlow Condensed', color: '#f4f2f3' })
    + texto(x0 + 170, yv + 46, `${signo(d.cambio)} %`, { px: 34, peso: 800, fam: 'Barlow Condensed', color: colC })
    + graficaValor(x0 + 290, yv + 6, w - 290, 62, d.valor, d.cambio < 0 ? MALO : '#e2bd5a', '#0b0a0f', 3.5, 0.35);
  s += marcaCarta(x0, 636);
  return marco('#0b0a0f', s);
}

// ===========================================================================================================================
// B · «oro»: negro cálido, oro fino, serifa y aire
const ORO = [[0, '#f6e3a6'], [0.35, '#d7b25b'], [0.65, '#a98132'], [1, '#efd38a']];

function cuota(x, y, w, h, arriba, abajo, { activo = false, gOro, malo = false } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${activo ? `url(#${gOro})` : '#16150f'}" stroke="${activo ? 'none' : '#3b3423'}" stroke-width="1.2"/>`
    + texto(x + w / 2, y + 24, abajo, { px: 13, peso: 600, color: activo ? '#3a2b0c' : '#857a5f', ancla: 'middle', espacio: 2.5 })
    + texto(x + w / 2, y + h - 18, arriba, { px: 34, peso: 600, fam: 'Playfair Display', color: activo ? '#1a1305' : malo ? MALO : '#efe6cf', ancla: 'middle' });
}

export function svgJugadorOro(d) {
  const c = coloresClub(d.club.nombre);
  const gOro = id('oo'), gOroH = id('oh');
  let s = `<defs>${lineal(gOro, ORO, { x1: 0, y1: 0, x2: 1, y2: 1 })}${lineal(gOroH, [[0, '#d7b25b', 0], [0.5, '#d7b25b', 1], [1, '#d7b25b', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 })}`
    + `</defs>`;
  // fondo: negro cálido, luz cálida suave y un toque muy leve del club
  s += radial(300, 300, 520, '#d7b25b', 0.13) + radial(300, 420, 360, c.vivo, 0.14);
  // marco fino dorado
  s += `<rect x="22" y="22" width="${ANCHO - 44}" height="${ALTO - 44}" rx="18" fill="none" stroke="url(#${gOro})" stroke-width="1.2" opacity="0.55"/>`;
  // izquierda: círculo fino, la cifra de la jornada en grande y hueca detrás, y la cara
  s += `<circle cx="300" cy="330" r="232" fill="none" stroke="url(#${gOro})" stroke-width="1.2" opacity="0.7"/>`
    + `<circle cx="300" cy="330" r="214" fill="#12110d" opacity="0.8"/>`;
  if (d.cara) {
    const cl = id('oc'), mk = id('om'), gM = id('omg');
    s += `<defs><clipPath id="${cl}"><path d="M68,${ALTO - 23} L68,330 A232,232 0 0 1 532,330 L532,${ALTO - 23} Z"/></clipPath>`
      + `${lineal(gM, [[0, '#fff'], [0.7, '#fff'], [1, '#fff', 0]])}<mask id="${mk}"><rect x="80" y="${ALTO - 23 - 440}" width="440" height="440" fill="url(#${gM})"/></mask></defs>`
      + `<g clip-path="url(#${cl})"><image href="${uri(d.cara)}" x="80" y="${ALTO - 23 - 440}" width="440" height="440" preserveAspectRatio="xMidYMax meet" mask="url(#${mk})"/></g>`;
  }
  // derecha
  const x0 = 620, w = ANCHO - x0 - 70;
  s += texto(x0, 92, `${d.etiqueta.toUpperCase()}`, { px: 15, peso: 600, color: '#d7b25b', espacio: 4, max: w })
    + texto(x0, 172, d.nombre, { px: 76, peso: 400, fam: 'Playfair Display', color: '#f6f0e1', max: w })
    + escudo(d.club.escudo, x0 + 13, 204, 34)
    + texto(x0 + 38, 211, `${d.posicion} · ${d.club.nombre}`, { px: 18, peso: 400, color: '#9c9480', espacio: 1, max: w - 38 })
    + `<rect x="${x0}" y="238" width="72" height="1.5" fill="url(#${gOro})"/>`;
  // tres cifras con filetes verticales
  const tres = [[String(d.ptsJornada), `PUNTOS J${d.jornada}`, true], [String(d.total), 'TEMPORADA'], [num1(d.media), 'MEDIA']];
  const wc = w / 3;
  tres.forEach(([v, et, oro], i) => {
    const x = x0 + i * wc;
    if (i) s += `<rect x="${x - 1}" y="266" width="1" height="78" fill="#3b3423"/>`;
    s += texto(x + (i ? 28 : 0), 318, v, { px: 64, peso: 400, fam: 'Playfair Display', color: oro ? `url(#${gOro})` : '#f6f0e1' })
      + texto(x + (i ? 30 : 2), 344, et, { px: 12, peso: 600, color: '#857a5f', espacio: 2.5 });
  });
  // últimas jornadas como botones de cuota
  s += texto(x0, 392, 'ÚLTIMAS JORNADAS', { px: 12, peso: 600, color: '#857a5f', espacio: 3 });
  const nb = d.ultimas.length, gap = 12, wb = (w - gap * (nb - 1)) / nb;
  d.ultimas.forEach(([jn, p], i) => { s += cuota(x0 + i * (wb + gap), 406, wb, 76, String(p), `J${jn}`, { activo: i === nb - 1, gOro, malo: p < 0 }); });
  // valor: cifra, cambio y línea fina
  const yv = 516, colC = d.cambio > 0 ? '#7fd3a0' : d.cambio < 0 ? MALO : '#9c9480';
  s += texto(x0, yv, `VALOR · ${d.dias} DÍAS`, { px: 12, peso: 600, color: '#857a5f', espacio: 3 })
    + texto(x0, yv + 44, millones(d.valorHoy), { px: 38, peso: 400, fam: 'Playfair Display', color: '#f6f0e1' })
    + texto(x0, yv + 72, `${signo(d.cambio)} %`, { px: 16, peso: 600, color: colC, espacio: 1 })
    + graficaValor(x0 + 190, yv + 8, w - 190, 62, d.valor, '#d7b25b', '#0c0b09', 2, 0.22);
  // marca
  s += `<rect x="${x0}" y="${ALTO - 66}" width="${w}" height="1" fill="url(#${gOroH})" opacity="0.6"/>`
    + texto(x0, ALTO - 38, 'FANTASY MANAGER', { px: 13, peso: 600, color: '#d7b25b', espacio: 4 })
    + texto(x0 + w, ALTO - 38, '@Fantasyman_app', { px: 13, peso: 400, color: '#857a5f', ancla: 'end', espacio: 1 });
  return marco('#0c0b09', s);
}

let Resvg = null;
export async function aPngPremium(svg) {
  if (!Resvg) ({ Resvg } = await import('@resvg/resvg-js'));
  const r = new Resvg(svg, { font: { fontFiles: FUENTES, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'original' } });
  return Buffer.from(r.render().asPng());
}
