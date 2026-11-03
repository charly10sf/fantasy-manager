// Tarjetas con imagen para los tweets del bot: dibujo en SVG y paso a PNG con @resvg/resvg-js.
// Dos tarjetas (Carlos, 2 nov): la de final de partido (escudos, marcador y los 3 mejores y los 3 peores de cada equipo) y la de
// jugador (MVP o doblete: cara, escudo, puntos, últimas jornadas y gráfica de valor). Estilo «noche» (el negro y rojo de la app
// con el brillo del color de cada club), elegido por Carlos el 2 nov a las 21:13 entre tres ejemplos (noche, papel y cromo).
// Desde el 3 nov (Carlos, 11:11), las que hablan de UN jugador concreto (la de jugador y la de bajas con un solo jugador) van en
// carta de coleccionista: lib/carta.mjs. Todo lo demás sigue en «noche».
// Aquí solo se dibuja: los datos llegan ya montados (datos-tarjetas.mjs) y validar.mjs comprueba que todo lo escrito esté en ellos.
import { coloresClub, luz } from './colores.mjs';
import { svgJugadorCarta, svgBajaSola } from './carta.mjs';

export const ANCHO = 1200, ALTO = 675;
const ROJO = '#ee1c3c', VERDE = '#16c172', MALO = '#ff4d5e';
const FUENTES = ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'InterDisplay-Black.otf',
  'BarlowCondensed_600SemiBold.ttf', 'BarlowCondensed_700Bold.ttf', 'BarlowCondensed_800ExtraBold.ttf', 'BarlowCondensed_800ExtraBold_Italic.ttf', 'BarlowCondensed_900Black.ttf'].map((f) => new URL(`../fuentes/${f}`, import.meta.url).pathname);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uri = (buf) => (buf ? `data:image/png;base64,${Buffer.from(buf).toString('base64')}` : null);
/** 7.25 -> «7,3»; enteros sin decimales */
export const num1 = (x) => (Math.round(Number(x) * 10) / 10).toString().replace('.', ',');
/** valor de mercado: 101970432 -> «102 M», 8450000 -> «8,5 M», 640000 -> «0,6 M» */
export const millones = (v) => `${num1(v / 1e6)} M`;
const signo = (n) => (n > 0 ? `+${n}` : String(n));

// Ancho aproximado de un texto en Inter (sin medir: resvg no lo da). Sirve para encoger nombres largos.
function ancho(s, px, display = false) {
  let w = 0;
  for (const ch of String(s)) {
    if (ch === ' ') w += 0.27;
    else if (/[0-9]/.test(ch)) w += display ? 0.66 : 0.62;
    else if (/[A-ZÁÉÍÓÚÑÜ]/.test(ch)) w += display ? 0.74 : 0.7;
    else if (/[iljtfrI.,'·:]/.test(ch)) w += 0.32;
    else if (/[mwMW]/.test(ch)) w += 0.88;
    else w += 0.58;
  }
  return w * px;
}
const cabe = (s, px, max, min = Math.round(px * 0.55), display = false) => { let p = px; while (p > min && ancho(s, p, display) > max) p--; return p; };

function texto(x, y, s, { px = 24, peso = 700, color = '#fff', ancla = 'start', display = false, espacio = 0, opacidad = 1, max = null } = {}) {
  const p = max ? cabe(s, px, max, undefined, display) : px;
  const fam = display ? 'Inter Display' : 'Inter';
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${display ? 900 : peso}" font-size="${p}" fill="${color}" text-anchor="${ancla}"${espacio ? ` letter-spacing="${espacio}"` : ''}${opacidad < 1 ? ` opacity="${opacidad}"` : ''}>${esc(s)}</text>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas
let n = 0;
const id = (p) => `${p}${++n}`;

/** el escudo (78x105 en LaLiga) encajado en una caja de alto h, centrado en (cx, cy) */
function escudo(buf, cx, cy, h) {
  if (!buf) return '';
  const w = Math.round(h * 78 / 105);
  return `<image href="${uri(buf)}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

/** cara en círculo con aro del color del club */
function caraCirculo(buf, cx, cy, r, { aro = '#fff', fondo = '#1b1b21', grosor = 4 } = {}) {
  const c = id('cc');
  return `<defs><clipPath id="${c}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fondo}"/>`
    + (buf ? `<image href="${uri(buf)}" x="${cx - r * 1.08}" y="${cy - r * 0.92}" width="${r * 2.16}" height="${r * 2.16}" clip-path="url(#${c})" preserveAspectRatio="xMidYMin slice"/>` : '')
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${aro}" stroke-width="${grosor}"/>`;
}
/** cara recortada (las de LaLiga vienen sin fondo, 256x256) con su base en y */
const caraSuelta = (buf, cx, base, alto) => (buf ? `<image href="${uri(buf)}" x="${cx - alto / 2}" y="${base - alto}" width="${alto}" height="${alto}" preserveAspectRatio="xMidYMax meet"/>` : '');

function brillo(cx, cy, r, color, op) {
  const g = id('br');
  return `<defs><radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="${ANCHO}" height="${ALTO}" fill="url(#${g})"/>`;
}

function marca(x, y, { color = '#f4f2f3', ancla = 'middle', tenue = '#948f9b' } = {}) {
  // logo de texto de la app: «FANTASY MANAGER» con una barra roja delante; la cuenta, al lado
  const w = ancho('FANTASY MANAGER', 17) + 15 * 2 + 16;
  const x0 = ancla === 'middle' ? x - (w + 14 + ancho('@Fantasyman_app', 17)) / 2 : x;
  return `<rect x="${x0}" y="${y - 15}" width="6" height="19" rx="2" fill="${ROJO}"/>`
    + texto(x0 + 14, y, 'FANTASY MANAGER', { px: 17, peso: 700, color, espacio: 2 })
    + texto(x0 + 14 + w, y, '@Fantasyman_app', { px: 17, peso: 600, color: tenue });
}

const marco = (fondo, cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}"><rect width="${ANCHO}" height="${ALTO}" fill="${fondo}"/>${cuerpo}</svg>`;

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de final de partido
// d = { jornada, local, visitante } con cada lado { nombre, corto, goles, escudo (PNG), mejor: {nombre, pts, cara}, peor: {…} | null }

/** una fila de la lista de un equipo: cara pequeña, nombre y puntos */
function fila(x, y, w, j, bueno, club) {
  const acento = bueno ? VERDE : MALO;
  const r = 21, cx = x + 12 + r, cy = y + 26;
  const pts = String(j.pts);
  return `<rect x="${x}" y="${y}" width="${w}" height="52" rx="12" fill="#131317"/>`
    + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, fondo: '#1b1b21', grosor: 2.5 })
    + texto(cx + r + 16, cy + 9, j.nombre, { px: 24, peso: 700, color: '#f4f2f3', max: w - (cx + r + 16 - x) - 110 })
    + texto(x + w - 50, cy + 13, pts, { px: 38, display: true, color: acento, ancla: 'end' })
    + texto(x + w - 16, cy + 11, 'pts', { px: 14, peso: 600, color: '#948f9b', ancla: 'end' });
}

/** la columna de un equipo: MEJORES (hasta 3) y PEORES (hasta 3) */
function columna(x, y, w, lado, club) {
  let s = texto(x + 4, y + 14, 'MEJORES', { px: 14, peso: 700, color: VERDE, espacio: 2.5 });
  lado.mejores.forEach((j, i) => { s += fila(x, y + 26 + i * 58, w, j, true, club); });
  const y2 = y + 26 + 3 * 58 + 14;
  if (lado.peores.length) {
    s += texto(x + 4, y2 + 14, 'PEORES', { px: 14, peso: 700, color: MALO, espacio: 2.5 });
    lado.peores.forEach((j, i) => { s += fila(x, y2 + 26 + i * 58, w, j, false, club); });
  }
  return s;
}

// d = { jornada, local, visitante } con cada lado { nombre, corto, goles, escudo (PNG), mejores: [{nombre, pts, cara}] (3),
//       peores: [...] (hasta 3, de más a menos malo: el primero es el que menos puntos ha sacado) }
export function svgFinal(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  let s = brillo(230, 90, 520, cL.vivo, 0.55) + brillo(970, 90, 520, cV.vivo, 0.55)
    + `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`
    + texto(600, 40, `LALIGA FANTASY · JORNADA ${d.jornada} · FINAL`, { px: 16, peso: 700, color: '#948f9b', ancla: 'middle', espacio: 3 })
    + escudo(L.escudo, 150, 110, 92) + escudo(V.escudo, 1050, 110, 92)
    + texto(220, 124, L.corto, { px: 34, peso: 700, color: '#fff', max: 230 })
    + texto(980, 124, V.corto, { px: 34, peso: 700, color: '#fff', ancla: 'end', max: 230 })
    + texto(600, 158, `${L.goles}-${V.goles}`, { px: 116, display: true, color: '#fff', ancla: 'middle' })
    + `<rect x="50" y="182" width="1100" height="1" fill="#2a2a32"/>`;
  s += columna(50, 196, 535, L, cL) + columna(615, 196, 535, V, cV) + marca(600, 660);
  return marco('#08080a', s);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de jugador (MVP y directo): la carta, en lib/carta.mjs.
// d = { jornada, etiqueta ('MVP · Barça 6-1 Alavés' o '¡DOBLETE! · …'), nombre, posicion, club: {nombre, corto, escudo},
//       cara, ptsJornada, total, media, ultimas: [[jornada, pts], …] (5), valor: [[ms, €], …] (30 días), valorHoy, cambio (% en 30 días) }
export const svgJugador = (d) => svgJugadorCarta(d);

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del resumen de la jornada (Carlos, 2 nov 23:28): los 6 mejores o los 6 peores, en dos columnas de 3.
// d = { jornada, clave: 'mejores'|'peores', filas: [{ nombre, equipo, club (nombre largo), pts, cara (PNG), escudo (PNG) }] (6) }
export function svgResumen(d) {
  const bueno = d.clave === 'mejores';
  const acento = bueno ? VERDE : MALO;
  let s = brillo(600, -80, 700, bueno ? '#16c172' : '#ff4d5e', 0.22) + `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`
    + texto(60, 62, `LALIGA FANTASY · JORNADA ${d.jornada}`, { px: 17, peso: 700, color: '#948f9b', espacio: 3 })
    + texto(60, 132, bueno ? 'LOS MEJORES' : 'LOS PEORES', { px: 64, display: true, color: '#fff' })
    + texto(1140, 132, 'DE LA JORNADA', { px: 22, peso: 700, color: acento, ancla: 'end', espacio: 3 });
  const w = 525, h = 132, x0 = [60, 615], y0 = 168;
  d.filas.slice(0, 6).forEach((j, i) => {
    const x = x0[Math.floor(i / 3)], y = y0 + (i % 3) * (h + 14);
    const club = coloresClub(j.club || j.equipo);
    const r = 46, cx = x + 26 + r, cy = y + h / 2;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#131317"/>`
      + texto(x + 14, y + 30, String(i + 1), { px: 20, display: true, color: '#55525c' })
      + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, fondo: '#1b1b21', grosor: 3 })
      + texto(cx + r + 20, cy - 4, j.nombre, { px: 30, peso: 700, color: '#f4f2f3', max: w - (cx + r + 20 - x) - 130 })
      + escudo(j.escudo, cx + r + 32, cy + 30, 28)
      + texto(cx + r + (j.escudo ? 52 : 20), cy + 38, j.equipo, { px: 19, peso: 600, color: '#948f9b', max: 220 })
      + texto(x + w - 58, cy + 20, String(j.pts), { px: 58, display: true, color: acento, ancla: 'end' })
      + texto(x + w - 18, cy + 18, 'pts', { px: 16, peso: 600, color: '#948f9b', ancla: 'end' });
  });
  return marco('#08080a', s + marca(600, 650));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de la previa de un partido: los dos onces (posibles, con el % de titularidad de la app, o confirmados).
// d = { jornada, confirmados, local, visitante } con cada lado { nombre, corto, escudo (PNG), formacion ('4-3-3'),
//       once: [{ pos: 'POR'|'DEF'|'MED'|'DEL', nombre, pct (0-100) | null, duda: bool }] (11, de portero a delanteros) }
// Carlos, 3 nov 11:47: «que saliera más en el campo representado el once»: un medio campo por equipo, con cada jugador en su
// línea según la formación (portero abajo, delanteros arriba), una chapa con el color del club, el nombre y el %.
function lineasDe(lado) {
  const once = lado.once.slice(0, 11);
  const f = String(lado.formacion || '').split('-').map(Number).filter((x) => x > 0);
  if (f.length && f.reduce((a, b) => a + b, 0) === once.length - 1) {
    const out = [once.slice(0, 1)]; let i = 1;
    for (const c of f) { out.push(once.slice(i, i + c)); i += c; }
    return out;
  }
  return ['POR', 'DEF', 'MED', 'DEL'].map((p) => once.filter((j) => j.pos === p)).filter((l) => l.length);   // sin formación que cuadre, por puestos
}
function campo(x, y, w, h, lado, club, confirmados) {
  const g = id('cp');
  const lc = 'stroke="#ffffff" stroke-opacity="0.14" stroke-width="2" fill="none"';
  let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${club.vivo}" stop-opacity="0.28"/><stop offset="1" stop-color="#131317" stop-opacity="1"/></linearGradient></defs>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#131317"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#${g})"/>`;
  // franjas de césped, muy suaves
  for (let k = 0; k < 6; k++) if (k % 2) s += `<rect x="${x}" y="${y + k * h / 6}" width="${w}" height="${h / 6}" fill="#ffffff" opacity="0.025"/>`;
  // líneas: borde, medio campo arriba con su círculo, área grande, área pequeña y punto de penalti abajo
  s += `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="10" ${lc}/>`
    + `<path d="M${x + w * 0.34},${y + 10} A${w * 0.16},${w * 0.16} 0 0 0 ${x + w * 0.66},${y + 10}" ${lc}/>`
    + `<rect x="${x + w * 0.2}" y="${y + h - 10 - 96}" width="${w * 0.6}" height="96" ${lc}/>`
    + `<rect x="${x + w * 0.36}" y="${y + h - 10 - 36}" width="${w * 0.28}" height="36" ${lc}/>`
    + `<path d="M${x + w * 0.4},${y + h - 106} A${w * 0.11},${w * 0.07} 0 0 1 ${x + w * 0.6},${y + h - 106}" ${lc}/>`;
  const lineas = lineasDe(lado).reverse();
  const alto = (h - 24) / lineas.length;
  lineas.forEach((ls, i) => {
    const cy = y + 14 + alto * i + alto * 0.3;
    ls.forEach((j, k) => {
      const cx = x + (w / (ls.length + 1)) * (k + 1);
      const maxN = Math.min(124, w / ls.length - 8);
      const pctCol = j.pct == null ? null : j.pct >= 75 ? VERDE : j.pct >= 50 ? '#f2b33d' : MALO;
      const aro = j.duda ? '#f2b33d' : '#ffffff';
      s += `<circle cx="${cx}" cy="${cy + 3}" r="24" fill="#000" opacity="0.35"/>`
        + (j.cara ? caraCirculo(j.cara, cx, cy, 23, { aro: j.duda ? aro : club.vivo, fondo: '#1b1b21', grosor: 2.5 })
          : `<circle cx="${cx}" cy="${cy}" r="14" fill="${club.vivo}" stroke="${aro}" stroke-width="2.5"/>`)
        + texto(cx, cy + 43, j.nombre, { px: 17, peso: 700, color: '#f4f2f3', ancla: 'middle', max: maxN });
      if (pctCol && !confirmados) {
        const t = `${j.pct} %`, wp = ancho(t, 15) + 16;
        s += `<rect x="${cx - wp / 2}" y="${cy + 50}" width="${wp}" height="21" rx="10.5" fill="${pctCol}" fill-opacity="0.18" stroke="${pctCol}" stroke-opacity="0.6" stroke-width="1.2"/>`
          + texto(cx, cy + 66, t, { px: 15, peso: 700, color: pctCol, ancla: 'middle' });
      }
    });
  });
  s += texto(x + 24, y + h - 24, lado.formacion || '', { px: 18, peso: 700, color: '#f4f2f3', espacio: 2 });
  return s;
}
export function svgOnces(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  let s = brillo(230, 60, 520, cL.vivo, 0.5) + brillo(970, 60, 520, cV.vivo, 0.5) + `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`
    + texto(600, 44, `${d.confirmados ? 'ONCES CONFIRMADOS' : 'POSIBLES ONCES'} · JORNADA ${d.jornada}`, { px: 17, peso: 700, color: d.confirmados ? VERDE : '#948f9b', ancla: 'middle', espacio: 3 })
    + escudo(L.escudo, 92, 92, 64) + escudo(V.escudo, 1108, 92, 64)
    + texto(140, 104, L.corto, { px: 32, peso: 700, color: '#fff', max: 300 })
    + texto(1060, 104, V.corto, { px: 32, peso: 700, color: '#fff', ancla: 'end', max: 300 })
    + texto(600, 106, 'VS', { px: 26, display: true, color: '#55525c', ancla: 'middle' });
  s += campo(50, 142, 535, 486, L, cL, d.confirmados) + campo(615, 142, 535, 486, V, cV, d.confirmados);
  return marco('#08080a', s + marca(600, 660));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del mercado de cada noche (Carlos, 3 nov 06:56: «top 5 subidas y bajadas»): dos columnas, subidas en verde y bajadas en rojo.
// d = { fecha: '3 de noviembre', suben: [fila] (5), bajan: [fila] (5) } con fila = { nombre, equipo, club, cara (PNG), escudo (PNG),
//       dif: '+2,3 M', pct: '+2,3 %', valor: '102 M' }
export function svgMercado(d) {
  let s = brillo(240, -60, 560, VERDE, 0.2) + brillo(960, -60, 560, MALO, 0.2) + `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`
    + texto(60, 58, 'LALIGA FANTASY', { px: 17, peso: 700, color: '#948f9b', espacio: 3 })
    + texto(60, 118, 'MERCADO', { px: 58, display: true, color: '#fff' })
    + texto(1140, 116, d.fecha, { px: 24, peso: 700, color: '#f4f2f3', ancla: 'end' });
  const w = 525, h = 80, gap = 8, y0 = 182;
  const col = (x, lista, bueno) => {
    const acento = bueno ? VERDE : MALO;
    let t = `<rect x="${x}" y="${y0 - 34}" width="6" height="20" rx="2" fill="${acento}"/>`
      + texto(x + 16, y0 - 17, bueno ? 'SUBEN' : 'BAJAN', { px: 18, peso: 700, color: acento, espacio: 3 });
    lista.slice(0, 5).forEach((f, i) => {
      const y = y0 + i * (h + gap), cy = y + h / 2, r = 27, cx = x + 44 + r;
      const club = coloresClub(f.club || f.equipo);
      t += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#131317"/>`
        + texto(x + 16, cy + 8, String(i + 1), { px: 22, display: true, color: '#55525c' })
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, fondo: '#1b1b21', grosor: 2.5 })
        + texto(cx + r + 16, cy - 2, f.nombre, { px: 24, peso: 700, color: '#f4f2f3', max: 230 })
        + escudo(f.escudo, cx + r + 26, cy + 21, 20)
        + texto(cx + r + (f.escudo ? 42 : 16), cy + 27, f.equipo, { px: 16, peso: 600, color: '#948f9b', max: 190 })
        + texto(x + w - 18, cy + 4, f.dif, { px: 30, display: true, color: acento, ancla: 'end' })
        + texto(x + w - 18, cy + 28, `${f.pct} · ${f.valor}`, { px: 16, peso: 600, color: '#948f9b', ancla: 'end' });
    });
    return t;
  };
  s += col(60, d.suben, true) + col(615, d.bajan, false);
  return marco('#08080a', s + marca(600, 657));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de bajas y novedades (Carlos, 3 nov 09:33: «acompañarlo de una tarjeta del Getafe»; las caídas y los sancionados «de forma
// más gráfica»). Dos formas:
//   - de un equipo (todas las filas del mismo club): escudo y nombre grandes arriba, el próximo rival a la derecha y una fila grande
//     por jugador (1 a 4) con cara, puesto, media y la etiqueta de su estado;
//   - de varios equipos: dos columnas de 3, como el resumen, con el escudo de cada uno.
// d = { jornada, titulo ('BAJAS'|'BAJAS Y DUDAS'|'NOVEDADES'), equipo: { nombre, corto, escudo } | null,
//       rival: { corto, nombre, escudo } | null,
//       filas: [{ nombre, equipo, club, posicion, cara, escudo, estado: 'lesionado'|'sancionado'|'duda'|'disponible', pct, media ('5,2'|null) }] }
const ESTADO_TARJETA = {
  lesionado: { txt: 'LESIONADO', color: MALO },
  sancionado: { txt: 'SANCIONADO', color: MALO },
  duda: { txt: 'DUDA', color: '#f2b33d' },
  disponible: { txt: 'DISPONIBLE', color: VERDE },
};
/** el dibujo pequeño del estado: cruz (lesión), tarjeta roja (sanción), interrogación (duda) o visto (disponible) */
function iconoEstado(estado, cx, cy, s) {
  const c = ESTADO_TARJETA[estado].color;
  if (estado === 'sancionado') return `<rect x="${cx - s * 0.32}" y="${cy - s * 0.45}" width="${s * 0.64}" height="${s * 0.9}" rx="${s * 0.08}" fill="${c}" transform="rotate(12 ${cx} ${cy})"/>`;
  if (estado === 'lesionado') { const a = s * 0.16, b = s * 0.46; return `<rect x="${cx - a}" y="${cy - b}" width="${a * 2}" height="${b * 2}" rx="${a * 0.5}" fill="${c}"/><rect x="${cx - b}" y="${cy - a}" width="${b * 2}" height="${a * 2}" rx="${a * 0.5}" fill="${c}"/>`; }
  if (estado === 'disponible') return `<path d="M${cx - s * 0.4} ${cy} L${cx - s * 0.1} ${cy + s * 0.3} L${cx + s * 0.42} ${cy - s * 0.32}" fill="none" stroke="${c}" stroke-width="${s * 0.18}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // duda: un círculo con un punto, sin texto (el «?» no es una palabra para el validador)
  return `<circle cx="${cx}" cy="${cy}" r="${s * 0.42}" fill="none" stroke="${c}" stroke-width="${s * 0.14}"/><circle cx="${cx}" cy="${cy}" r="${s * 0.11}" fill="${c}"/>`;
}
const anchoPildora = (txt, px) => ancho(txt, px) + [...txt].length * 1.2 + px * 0.55 * 2 + px * 1.6;
const txtEstado = (f) => (f.estado === 'duda' && f.pct != null ? `DUDA · ${f.pct} %` : ESTADO_TARJETA[f.estado].txt);
/** la etiqueta del estado (con el % si es duda), alineada a la derecha en xd */
function pildora(f, xd, cy, px) {
  const e = ESTADO_TARJETA[f.estado];
  const txt = txtEstado(f);
  const w = anchoPildora(txt, px), h = px * 2;
  const x = xd - w;
  return `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${e.color}" fill-opacity="0.14" stroke="${e.color}" stroke-opacity="0.55" stroke-width="1.5"/>`
    + iconoEstado(f.estado, x + px * 0.55 + px * 0.5, cy, px)
    + texto(x + px * 0.55 + px * 1.3, cy + px * 0.36, txt, { px, peso: 700, color: e.color, espacio: 1.2 });
}
export function svgBajas(d) {
  if (d.filas.length === 1) return svgBajaSola(d);          // un solo jugador: la carta (lib/carta.mjs)
  const filas = d.filas.slice(0, d.equipo ? 4 : 6);
  const tono = d.titulo === 'NOVEDADES' ? VERDE : d.titulo === 'DUDAS' ? '#f2b33d' : MALO;
  let s = `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`;
  if (d.equipo) {
    const club = coloresClub(d.equipo.nombre || d.equipo.corto);
    s = brillo(140, 60, 620, club.vivo, 0.55) + s
      + escudo(d.equipo.escudo, 112, 112, 112)
      + texto(d.equipo.escudo ? 196 : 60, 82, `${d.titulo} · JORNADA ${d.jornada}`, { px: 18, peso: 700, color: tono, espacio: 3 })
      + texto(d.equipo.escudo ? 194 : 58, 146, d.equipo.corto.toUpperCase(), { px: 62, display: true, color: '#fff', max: d.rival ? 560 : 900 });
    if (d.rival) {
      const cR = coloresClub(d.rival.nombre || d.rival.corto);
      s += brillo(1080, 80, 300, cR.vivo, 0.3)
        + texto(1140, 82, 'PRÓXIMO RIVAL', { px: 15, peso: 700, color: '#948f9b', ancla: 'end', espacio: 2.5 })
        + escudo(d.rival.escudo, 1112, 128, 48)
        + texto(d.rival.escudo ? 1076 : 1140, 142, d.rival.corto, { px: 30, peso: 700, color: '#f4f2f3', ancla: 'end', max: 300 });
    }
    // filas grandes: 1 a 4, entre y = 196 y 618
    const n = filas.length, gap = 12, alto = 422;
    const h = n === 1 ? 190 : Math.min(134, (alto - gap * (n - 1)) / n);
    const y0 = n === 1 ? 196 + (alto - h) / 2 : 196;
    const w = 1080, x = 60;
    filas.forEach((f, i) => {
      const y = y0 + i * (h + gap), cy = y + h / 2;
      const r = Math.round(h * 0.37), cx = x + 22 + r;
      const pxN = Math.round(Math.min(40, h * 0.34)), pxS = Math.round(Math.min(22, h * 0.2));
      const sub = [f.posicion, f.media ? `${f.media} pts de media` : null].filter(Boolean).join(' · ');
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#131317"/>`
        + `<rect x="${x}" y="${y + 14}" width="5" height="${h - 28}" rx="2" fill="${ESTADO_TARJETA[f.estado].color}"/>`
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, fondo: '#1b1b21', grosor: 3 })
        + texto(cx + r + 24, cy - (sub ? pxS * 0.3 : -pxN * 0.35), f.nombre, { px: pxN, peso: 700, color: '#f4f2f3', max: 560 })
        + (sub ? texto(cx + r + 24, cy + pxS * 1.45, sub, { px: pxS, peso: 600, color: '#948f9b', max: 560 }) : '')
        + pildora(f, x + w - 24, cy, Math.round(Math.min(22, h * 0.18)));
    });
  } else {
    const acento = tono;
    s = brillo(600, -80, 700, acento, 0.2) + s
      + texto(60, 62, 'LALIGA FANTASY', { px: 17, peso: 700, color: '#948f9b', espacio: 3 })
      + texto(60, 132, d.titulo, { px: 64, display: true, color: '#fff', max: 700 })
      + texto(1140, 132, `JORNADA ${d.jornada}`, { px: 22, peso: 700, color: acento, ancla: 'end', espacio: 3 });
    const w = 525, h = 132, x0 = [60, 615], y0 = 168;
    const enUna = filas.length <= 3;              // con 3 o menos, una columna ancha
    filas.forEach((f, i) => {
      const porCol = Math.ceil(filas.length / 2);   // 4 -> 2 y 2, 5 -> 3 y 2, 6 -> 3 y 3
      const x = enUna ? 60 : x0[Math.floor(i / porCol)], y = y0 + (3 - (enUna ? filas.length : porCol)) * (h + 14) / 2 + (enUna ? i : i % porCol) * (h + 14), ww = enUna ? 1080 : w;
      const club = coloresClub(f.club || f.equipo);
      const r = 46, cx = x + 26 + r, cy = y + h / 2;
      const pil = pildora(f, x + ww - 20, cy, 17);
      const anchoPil = anchoPildora(txtEstado(f), 17);
      s += `<rect x="${x}" y="${y}" width="${ww}" height="${h}" rx="18" fill="#131317"/>`
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, fondo: '#1b1b21', grosor: 3 })
        + texto(cx + r + 20, cy - 4, f.nombre, { px: 30, peso: 700, color: '#f4f2f3', max: ww - (cx + r + 20 - x) - anchoPil - 56 })
        + escudo(f.escudo, cx + r + 32, cy + 30, 28)
        + texto(cx + r + (f.escudo ? 52 : 20), cy + 38, f.media && enUna ? `${f.equipo} · ${f.media} pts de media` : f.equipo, { px: 19, peso: 600, color: '#948f9b', max: ww - (cx + r + 52 - x) - anchoPil - 30 })
        + pil;
    });
  }
  return marco('#08080a', s + marca(600, 656));
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
