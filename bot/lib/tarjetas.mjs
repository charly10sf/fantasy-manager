// Tarjetas con imagen para los tweets del bot: dibujo en SVG y paso a PNG con @resvg/resvg-js.
// Dos tarjetas (Carlos, 2 nov): la de final de partido (escudos, marcador y los 3 mejores y los 3 peores de cada equipo) y la de
// jugador (MVP o doblete: cara, escudo, puntos, últimas jornadas y gráfica de valor). Estilo «noche» (el negro y rojo de la app
// con el brillo del color de cada club), elegido por Carlos el 2 nov a las 21:13 entre tres ejemplos (noche, papel y cromo).
// Aquí solo se dibuja: los datos llegan ya montados (datos-tarjetas.mjs) y validar.mjs comprueba que todo lo escrito esté en ellos.
import { coloresClub, luz } from './colores.mjs';

export const ANCHO = 1200, ALTO = 675;
const ROJO = '#ee1c3c', VERDE = '#16c172', MALO = '#ff4d5e';
const FUENTES = ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'InterDisplay-Black.otf'].map((f) => new URL(`../fuentes/${f}`, import.meta.url).pathname);

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
// Tarjeta de jugador
// d = { jornada, etiqueta ('MVP · Barça 6-1 Alavés' o '¡DOBLETE! · …'), nombre, posicion, club: {nombre, corto, escudo},
//       cara, ptsJornada, total, media, ultimas: [[jornada, pts], …] (5), valor: [[ms, €], …] (30 días), valorHoy, cambio (% en 30 días) }

function barras(x, y, w, h, ultimas, tema) {
  // y es la línea del 0; las barras crecen hacia arriba (h) y las negativas hacia abajo (h/3)
  const max = Math.max(4, ...ultimas.map(([, p]) => Math.abs(p)));
  const paso = w / ultimas.length, bw = Math.min(56, paso - 18);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="1.5" fill="${tema.linea}"/>`;
  ultimas.forEach(([jn, p], i) => {
    const cx = x + paso * i + paso / 2;
    const alto = Math.max(4, Math.abs(p) / max * (p >= 0 ? h : h / 3));
    const col = p < 0 ? MALO : i === ultimas.length - 1 ? tema.acento : tema.barra;
    s += `<rect x="${cx - bw / 2}" y="${p >= 0 ? y - alto : y}" width="${bw}" height="${alto}" rx="6" fill="${col}"/>`
      + texto(cx, p >= 0 ? y - alto - 10 : y + alto + 26, String(p), { px: 22, peso: 700, color: tema.tinta, ancla: 'middle' })
      + texto(cx, y + (p < 0 ? alto + 52 : 30), `J${jn}`, { px: 15, peso: 600, color: tema.tenue, ancla: 'middle' });
  });
  return s;
}

function grafica(x, y, w, h, valor, tema, color) {
  if (!valor || valor.length < 2) return texto(x, y + h / 2, 'Sin histórico de valor', { px: 18, peso: 600, color: tema.tenue });
  const vs = valor.map(([, v]) => v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
  const t0 = valor[0][0], t1 = valor[valor.length - 1][0];
  const px = (t) => x + (t - t0) / ((t1 - t0) || 1) * w, py = (v) => y + h - (v - min) / rango * h;
  const pts = valor.map(([t, v]) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const g = id('ga');
  const [ux, uy] = [px(t1), py(vs[vs.length - 1])];
  return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`
    + `<polygon points="${x},${y + h} ${pts} ${ux},${y + h}" fill="url(#${g})"/>`
    + `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<circle cx="${ux}" cy="${uy}" r="7" fill="${color}" stroke="${tema.fondo}" stroke-width="3"/>`;
}

export function svgJugador(d) {
  const c = coloresClub(d.club.nombre);
  const tema = { fondo: '#08080a', panel: '#131317', tinta: '#f4f2f3', tenue: '#948f9b', linea: '#2a2a32', barra: '#3a3a44', acento: VERDE };
  const izq = 470;
  let s = brillo(220, 380, 520, c.vivo, 0.6) + `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`;
  const tintaIzq = '#fff';
  // izquierda: la cara grande, el escudo y la etiqueta
  s += caraSuelta(d.cara, izq / 2 - 10, ALTO, 440)
    + escudo(d.club.escudo, 70, 88, 96)
    + texto(130, 74, d.club.corto, { px: 26, peso: 700, color: tintaIzq, max: izq - 160 })
    + texto(130, 104, `LALIGA FANTASY · J${d.jornada}`, { px: 15, peso: 700, color: tintaIzq, espacio: 2, opacidad: 0.8 });
  // derecha
  const x0 = izq + 70, wDer = ANCHO - x0 - 50;
  // la etiqueta va en mayúsculas y con 2 px entre letras: se mide así (antes se medía en minúsculas y sin el espaciado, y los
  // nombres largos, como «Osasuna» o «Real Sociedad», se salían de la píldora roja) y, si no cabe, se encoge la letra
  const et = d.etiqueta.toUpperCase();
  const medirEt = (p) => ancho(et, p) * 1.04 + et.length * 2 + 36;
  let pxEt = 16;
  while (pxEt > 10 && medirEt(pxEt) > wDer) pxEt--;
  s += `<rect x="${x0}" y="40" width="${Math.min(wDer, medirEt(pxEt))}" height="38" rx="19" fill="${ROJO}"/>`
    + texto(x0 + 18, 65, et, { px: pxEt, peso: 700, color: '#fff', espacio: 2 })
    + texto(x0, 150, d.nombre, { px: 68, display: true, color: tema.tinta, max: wDer })
    + texto(x0, 186, `${d.posicion} · ${d.club.corto}`, { px: 20, peso: 600, color: tema.tenue });
  // tres cifras: puntos de la jornada, total y media
  const cifras = [[String(d.ptsJornada), `PUNTOS J${d.jornada}`, d.ptsJornada < 0 ? MALO : VERDE], [String(d.total), 'EN LA TEMPORADA', tema.tinta], [num1(d.media), 'DE MEDIA', tema.tinta]];
  const wc = (wDer - 2 * 16) / 3;
  cifras.forEach(([v, et, col], i) => {
    const x = x0 + i * (wc + 16);
    s += `<rect x="${x}" y="212" width="${wc}" height="104" rx="16" fill="${tema.panel}"/>`
      + texto(x + 20, 270, v, { px: 50, display: true, color: col })
      + texto(x + 20, 300, et, { px: 13, peso: 700, color: tema.tenue, espacio: 1.5 });
  });
  // últimas jornadas
  const wb = 300;
  s += texto(x0, 360, 'ÚLTIMAS JORNADAS', { px: 14, peso: 700, color: tema.tenue, espacio: 2 })
    + barras(x0, 548, wb, 140, d.ultimas, { ...tema, acento: d.ptsJornada < 0 ? MALO : VERDE });
  // valor de mercado
  const xg = x0 + wb + 40, wg = ANCHO - 50 - xg;
  const colCambio = d.cambio > 0 ? VERDE : d.cambio < 0 ? MALO : tema.tenue;
  s += texto(xg, 360, `VALOR · ${d.dias} DÍAS`, { px: 14, peso: 700, color: tema.tenue, espacio: 2 })
    + texto(xg, 404, millones(d.valorHoy), { px: 36, display: true, color: tema.tinta })
    + texto(xg + wg, 404, `${signo(d.cambio)} %`, { px: 24, peso: 700, color: colCambio, ancla: 'end' })
    + grafica(xg, 430, wg, 118, d.valor, tema, d.cambio < 0 ? MALO : VERDE);
  s += marca(x0, 640, { ancla: 'start', color: tema.tinta, tenue: tema.tenue });
  return marco(tema.fondo, s);
}

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
export function svgOnces(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  let s = brillo(230, 60, 520, cL.vivo, 0.5) + brillo(970, 60, 520, cV.vivo, 0.5) + `<rect width="${ANCHO}" height="6" fill="${ROJO}"/>`
    + texto(600, 44, `${d.confirmados ? 'ONCES CONFIRMADOS' : 'POSIBLES ONCES'} · JORNADA ${d.jornada}`, { px: 17, peso: 700, color: d.confirmados ? VERDE : '#948f9b', ancla: 'middle', espacio: 3 })
    + escudo(L.escudo, 92, 92, 64) + escudo(V.escudo, 1108, 92, 64)
    + texto(140, 104, L.corto, { px: 32, peso: 700, color: '#fff', max: 300 })
    + texto(1060, 104, V.corto, { px: 32, peso: 700, color: '#fff', ancla: 'end', max: 300 })
    + texto(600, 106, 'VS', { px: 26, display: true, color: '#55525c', ancla: 'middle' });
  const col = (x, lado, club) => {
    let t = texto(x + 4, 152, lado.formacion || '', { px: 16, peso: 700, color: '#f4f2f3', espacio: 2 });
    const fh = 41;
    lado.once.slice(0, 11).forEach((j, i) => {
      const y = 164 + i * fh;
      const pctCol = j.pct == null ? null : j.pct >= 75 ? VERDE : j.pct >= 50 ? '#f2b33d' : MALO;
      t += `<rect x="${x}" y="${y}" width="525" height="${fh - 5}" rx="9" fill="#131317"/>`
        + texto(x + 14, y + 25, j.pos, { px: 14, peso: 700, color: '#948f9b', espacio: 1.5 })
        + texto(x + 70, y + 26, j.nombre, { px: 21, peso: 700, color: '#f4f2f3', max: 330 })
        + (j.duda ? texto(x + 430, y + 25, 'DUDA', { px: 13, peso: 700, color: '#f2b33d', ancla: 'end', espacio: 1.5 }) : '')
        + (pctCol ? texto(x + 510, y + 26, `${j.pct} %`, { px: 21, peso: 700, color: pctCol, ancla: 'end' }) : '');
    });
    return t;
  };
  s += col(50, L, cL) + col(625, V, cV);
  return marco('#08080a', s + marca(600, 660));
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
