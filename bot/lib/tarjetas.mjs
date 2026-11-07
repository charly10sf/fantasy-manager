// Tarjetas con imagen para los tweets del bot: dibujo en SVG y paso a PNG con @resvg/resvg-js.
// Las que hablan de UN jugador concreto (la de jugador y la de bajas con un solo jugador) van en carta de coleccionista (lib/carta.mjs,
// Carlos, 3 nov 11:11). Las demás (final de partido, resumen de la jornada, posibles onces, mercado y bajas o novedades de varios)
// estaban en el estilo «noche» con letra Inter; desde el 5 nov (Carlos, 06:41: «que se parezcan en tipografía, estética y demás a las
// de jugadores») llevan las piezas de la carta (lib/estilo.mjs): Barlow Condensed, el fondo con rayos, titulares en cursiva con
// degradado, cajas inclinadas, la cifra destacada en oro, etiquetas de estado rellenas y la misma marca. Los textos son los mismos
// de antes (o en mayúsculas), así que el validador y las palabras fijas no cambian.
// 7 nov (HD): todas con el estilo moderno de la de onces (piezas HD más abajo y en estilo.mjs), caras grandes con la cabeza entera
// (radio de hasta 64: la foto de LaLiga, de 256 px, no pasa de ~300 px en el PNG a 2400) y alto según lo que lleve cada una.
// Aquí solo se dibuja: los datos llegan ya montados (datos-tarjetas.mjs) y validar.mjs comprueba que todo lo escrito esté en ellos.
import { coloresClub, luz } from './colores.mjs';
import { svgJugadorCarta, svgBajaSola, svgGolAsistencia } from './carta.mjs';
import { ANCHO, ALTO, VERDE, MALO, AMBAR, TENUE, TINTA, PANEL, LINEA, num1, millones, medir, B, texto, id, lineal, radial, marco,
  escudo, caraCirculo, fondo, dorado, rojizo, aColor, caja, marca, pildora, anchoPildora, pildoraTit, anchoPildoraTit, colPct, ESTADO_TARJETA,
  chip, flecha, medalla, distinto, nombreAjustado, tamano, caraHD, pastilla, panel, titular, R_MAX, chipPuesto, abrevPuesto, colorPuesto, PUESTOS } from './estilo.mjs';

export { ANCHO, ALTO, num1, millones };
const FUENTES = ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'InterDisplay-Black.otf',
  'BarlowCondensed_600SemiBold.ttf', 'BarlowCondensed_700Bold.ttf', 'BarlowCondensed_800ExtraBold.ttf', 'BarlowCondensed_800ExtraBold_Italic.ttf', 'BarlowCondensed_900Black.ttf'].map((f) => new URL(`../fuentes/${f}`, import.meta.url).pathname);

const OSCURO = '#2a1c04', OSCURO2 = '#5a420f';      // la letra encima del oro (la de la última jornada en la carta)
const mayus = (s) => String(s || '').toUpperCase();

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas
/** cabecera de las tarjetas en lista: el titular grande en cursiva a la izquierda (como «MVP» en la carta) y dos líneas a la derecha */
function cabecera(titulo, grad, linea1, linea2, { maxTitulo = 680, px = 118, y = 132 } = {}) {
  return texto(44, y, titulo, { px, peso: 800, italica: true, color: `url(#${grad})`, max: maxTitulo })
    + (linea1 ? texto(1152, y - 34, linea1, { px: 36, peso: 700, espacio: 1.5, ancla: 'end', max: 1060 - maxTitulo }) : '')
    + (linea2 ? texto(1152, y - 2, linea2, { px: 22, peso: 600, color: TENUE, espacio: 3, ancla: 'end' }) : '');
}

const ORO_TXT = '#f2cf6b';

/** el marcador de un partido (final y onces): un panel ancho con el color de cada club a su lado, que se apaga hacia el centro */
function marcador(y, h, cL, cV) {
  const c = id('mk'), a = id('ma'), b = id('mb'), r = 24, x = 44, w = 1112;
  return `<defs><clipPath id="${c}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`
    + lineal(a, [[0, cL, 0.62], [1, cL, 0]], { x1: 0, y1: 0, x2: 1, y2: 0 }) + lineal(b, [[0, cV, 0], [1, cV, 0.62]], { x1: 0, y1: 0, x2: 1, y2: 0 }) + `</defs>`
    + caja(x, y, w, h, { rx: r, borde: false })
    + `<g clip-path="url(#${c})"><rect x="${x}" y="${y}" width="${w / 2}" height="${h}" fill="url(#${a})"/><rect x="${x + w / 2}" y="${y}" width="${w / 2}" height="${h}" fill="url(#${b})"/></g>`
    + `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="#fff" stroke-opacity="0.16"/>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas HD (7 nov, Carlos: «rediseña todas las tarjetas para HD»): todas llevan el estilo de la de onces (PR #74) con las piezas de
// estilo.mjs (`caraHD`, `pastilla`, `panel`, `titular`): caras con la cabeza entera y el halo del club, nombres en pastilla, paneles casi
// negros con el brillo del club y la rejilla de puntos, cabecera sin banda, letra más grande y menos cosas en cada una. Alto según lo que
// lleven (X enseña entera una imagen vertical).

/** los centros de n huecos de ancho `hueco`, centrados en [x, x + w] */
const centros = (x, w, n, hueco) => { const x0 = x + (w - n * hueco) / 2; return Array.from({ length: n }, (_, k) => x0 + hueco * (k + 0.5)); };
/** base del nombre bajo una cara de radio R */
const bajoCara = (cy, R, pxN) => cy + R + pxN + 14;
/** un jugador como en la tarjeta de onces: halo, cara con la cabeza entera, una etiqueta en la esquina (puntos, %) y el nombre en pastilla */
function jugadorHD(j, cx, cy, R, club, { aro = null, wN, pxN = 30, etiqueta = null, escudoBuf = null, puesto = null } = {}) {
  let s = caraHD(j.cara, cx, cy, R, club.vivo, { aro: aro || club.vivo, grosor: aro && aro !== club.vivo ? Math.max(5, Math.round(R * 0.09)) : null });
  if (escudoBuf) s += escudo(escudoBuf, cx - R * 0.84, cy + R * 0.7, Math.round(R * 0.52));
  if (etiqueta) s += chip(etiqueta.txt, cx + R * 0.96, cy - R * 0.9, etiqueta.px || 24, { relleno: etiqueta.relleno, tinta: etiqueta.tinta || '#120f16', pad: 1.4, espacio: 0.5, peso: 900 }).s;
  // el puesto en su color, abajo a la derecha de la cara (7 nov 15:31): arriba va la etiqueta (puntos, %) y abajo a la izquierda el escudo
  if (puesto !== false) s += chipPuesto(puesto || j.pos || j.posicion, cx + R * 0.86, cy + R * 0.74, Math.max(16, Math.round(R * 0.32)));
  return s + pastilla(nombreAjustado(j.nombre, pxN, wN - pxN * 0.6, 0.5, { apellido: true }), cx, bajoCara(cy, R, pxN), pxN, wN);
}
/** rótulo de una sección: el triángulo del sentido (o una barra) y el texto, en el color */
const rotuloHD = (x, y, txt, color, sube = null) => (sube == null
  ? `<rect x="${x}" y="${y - 22}" width="7" height="28" rx="3.5" fill="${color}"/>` + texto(x + 18, y, txt, { px: 29, peso: 800, color, espacio: 3 })
  : flecha(sube, x + 12, y - 10, 22, color) + texto(x + 32, y, txt, { px: 29, peso: 800, color, espacio: 3 }));
/** el escudo y un texto en línea, centrados en cx (el equipo bajo un nombre) */
function escudoTexto(buf, cx, y, txt, px, { color = TENUE, max = 400, h = null } = {}) {
  const hh = h || Math.round(px * 1.2), we = buf ? Math.round(hh * 78 / 105) + 10 : 0, p = tamano(txt, px, max - we, 1), tw = medir(txt, p, B, 1);
  const x0 = cx - (we + tw) / 2;
  return (buf ? escudo(buf, x0 + (we - 10) / 2, y - p * 0.36, hh) : '') + texto(x0 + we, y, txt, { px: p, peso: 700, color, espacio: 1 });
}
/** una cifra grande y su unidad al lado, centradas en cx («16 PTS») */
function cifraUnidad(cx, y, valor, unidad, px, color, { colorU = TENUE, pu = Math.round(px * 0.4) } = {}) {
  const w1 = medir(valor, px, B) * 0.9, w2 = medir(unidad, pu, B, 1), x0 = cx - (w1 + 8 + w2) / 2;
  return texto(x0, y, valor, { px, peso: 900, color }) + texto(x0 + w1 + 8, y - 2, unidad, { px: pu, peso: 700, color: colorU, espacio: 1 });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de final de partido
// d = { jornada, local, visitante } con cada lado { nombre, corto, goles, escudo (PNG), mejores: [{nombre, pts, cara}] (3),
//       peores: [...] (hasta 3, de más a menos malo: el primero es el que menos puntos ha sacado) }
// 7 nov (HD): el marcador arriba y debajo un panel por equipo con el brillo de su club; en cada uno, MEJORES y PEORES en dos filas de
// tres caras grandes (radio 58, antes 36) con los puntos en la esquina y el nombre en pastilla, como en la de onces. 1200 x ~820.
const RF = 58, PXF = 30;
const altoSeccionFinal = 44 + RF * 2 + 4 + PXF + 14 + 13 + 24;
export const altoFinal = (d) => { const p = Math.max(d.local.peores.length, d.visitante.peores.length); return 222 + 18 + altoSeccionFinal * (p ? 2 : 1) + 8 + 78; };

function columnaFinal(x, y, w, lado, club, nPeores) {
  const hP = 18 + altoSeccionFinal * (nPeores ? 2 : 1) + 8;
  let s = panel(x, y, w, hP, club.vivo, { brillo: 0.3 });
  const hueco = (w - 24) / 3;
  const seccion = (ys, lista, bueno) => {
    const acento = bueno ? VERDE : MALO, cy = ys + 44 + RF + 4;
    let t = rotuloHD(x + 26, ys + 30, bueno ? 'MEJORES' : 'PEORES', acento, bueno);
    centros(x, w, lista.length, hueco).forEach((cx, k) => {
      const j = lista[k];
      t += jugadorHD(j, cx, cy, RF, club, { wN: hueco - 8, pxN: PXF, etiqueta: { txt: `${j.pts} PTS`, relleno: acento, px: 25 } });
    });
    return t;
  };
  s += seccion(y + 18, lado.mejores.slice(0, 3), true);
  if (nPeores && lado.peores.length) s += seccion(y + 18 + altoSeccionFinal, lado.peores.slice(0, 3), false);
  return s;
}

export function svgFinal(d) {
  const L = d.local, V = d.visitante, H = altoFinal(d);
  const cL = coloresClub(L.nombre), cV0 = coloresClub(V.nombre);
  const cV = { ...cL, ...cV0, vivo: distinto(cV0, cL) };                     // dos clubes rojos no salen idénticos
  const oro = dorado();
  const yM = 62, hM = 138, cy = yM + hM / 2;
  let s = oro.defs + fondo([[220, 120, 700, cL.vivo, 0.34], [980, 120, 700, cV.vivo, 0.34]], H)
    + texto(600, 42, `LALIGA FANTASY · JORNADA ${d.jornada} · FINAL`, { px: 24, peso: 700, color: TENUE, ancla: 'middle', espacio: 3 })
    + marcador(yM, hM, cL.vivo, cV.vivo)
    + escudo(L.escudo, 116, cy, 112) + escudo(V.escudo, 1084, cy, 112)
    + texto(184, cy + 22, mayus(L.corto), { px: 62, peso: 800, max: 270 })
    + texto(1016, cy + 22, mayus(V.corto), { px: 62, peso: 800, ancla: 'end', max: 270 })
    + `<rect x="470" y="${yM + 14}" width="260" height="${hM - 28}" rx="24" fill="#07080b" fill-opacity="0.72" stroke="${ORO_TXT}" stroke-opacity="0.45" stroke-width="1.5"/>`
    + texto(600, cy + 42, `${L.goles}-${V.goles}`, { px: 122, peso: 800, italica: true, color: `url(#${oro.g})`, ancla: 'middle' });
  const nP = Math.max(L.peores.length, V.peores.length);
  s += columnaFinal(22, 222, 570, L, cL, nP) + columnaFinal(608, 222, 570, V, cV, nP);
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de jugador (MVP y directo): la carta, en lib/carta.mjs.
// d = { jornada, etiqueta ('MVP · Barça 6-1 Alavés' o '¡DOBLETE! · …'), nombre, posicion, club: {nombre, corto, escudo},
//       cara, ptsJornada, total, media, ultimas: [[jornada, pts], …] (5), valor: [[ms, €], …] (30 días), valorHoy, cambio (% en 30 días) }
export const svgJugador = (d) => svgJugadorCarta(d);
export { svgGolAsistencia };

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del resumen de la jornada (Carlos, 2 nov 23:28): los 6 mejores o los 6 peores.
// 7 nov (HD): seis fichas en dos filas de tres, cada una con su medalla, la cara grande, el nombre en pastilla, el equipo y los puntos.
// La primera, con el filo de oro (o rojo). 1200 x 930.
// d = { jornada, clave: 'mejores'|'peores', filas: [{ nombre, equipo, club (nombre largo), pts, cara (PNG), escudo (PNG) }] (6) }
const FICHA = { w: 369, h: 340, gap: 16, x0: 30, y0: 196, R: 64, pxN: 32 };
export const altoResumen = (n) => FICHA.y0 + Math.ceil(Math.min(6, n) / 3) * (FICHA.h + FICHA.gap) - FICHA.gap + 80;
function fichaResumen(x, y, j, n, bueno) {
  const { w, h, R, pxN } = FICHA, club = coloresClub(j.club || j.equipo), cx = x + w / 2, cy = y + 36 + R, acento = bueno ? '#e2bd5a' : MALO;
  return panel(x, y, w, h, club.vivo, { rx: 26, brillo: 0.34, borde: n === 1 ? acento : null })
    + jugadorHD(j, cx, cy, R, club, { wN: w - 30, pxN })
    + medalla(n, x + 40, y + 40, 22, { premio: bueno })
    + escudoTexto(j.escudo, cx, bajoCara(cy, R, pxN) + 46, mayus(j.equipo), 24, { max: w - 40 })
    + cifraUnidad(cx, y + h - 26, String(j.pts), 'PTS', 66, bueno ? ORO_TXT : MALO);
}
export function svgResumen(d) {
  const bueno = d.clave === 'mejores', f = d.filas.slice(0, 6), H = altoResumen(f.length);
  const tit = bueno ? dorado() : rojizo();
  let s = tit.defs + fondo(bueno ? [[300, 60, 700, VERDE, 0.16], [950, 60, 620, '#e2bd5a', 0.14]] : [[300, 60, 700, MALO, 0.2], [950, 60, 620, MALO, 0.1]], H)
    + titular(bueno ? 'LOS MEJORES' : 'LOS PEORES', tit.g, 'DE LA JORNADA', { px: 84, sub2: `LALIGA FANTASY · JORNADA ${d.jornada}` });
  const filas = Math.ceil(f.length / 3);
  for (let r = 0; r < filas; r++) {
    const fila = f.slice(r * 3, r * 3 + 3), w0 = fila.length * FICHA.w + (fila.length - 1) * FICHA.gap, x0 = (ANCHO - w0) / 2;
    fila.forEach((j, k) => { s += fichaResumen(x0 + k * (FICHA.w + FICHA.gap), FICHA.y0 + r * (FICHA.h + FICHA.gap), j, r * 3 + k + 1, bueno); });
  }
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
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
// 6 nov (Carlos, con el Sevilla-Alavés: «el diseño es horrible y apenas se ven las caras»): la tarjeta pasa a vertical (1200x1420) con un
// campo alto por equipo. Arriba de cada campo, una franja con el escudo, el nombre y el dibujo; en el césped, cada línea con caras de
// hasta 62 de radio (antes 32: el doble de grande en pantalla) y el nombre en una pastilla. Líneas del campo muy suaves, para que no
// compitan con las caras. El orden de cada línea es el que llega (con los confirmados de ESPN, de izquierda a derecha según se mira).
// 20:19: la cara a 2,25 veces el radio (cabeza entera, sin cortar) y en los posibles onces un solo jugador por puesto, el de más %.
export const ALTO_ONCES = 1420;
// 20:27 (Carlos: «que sean más modernas»): campo casi negro con el brillo del club arriba y una rejilla de puntos, líneas finas, sin
// franjas de césped; cabecera limpia (escudo, nombre y el dibujo en una etiqueta con filo), un filete de luz del color del club debajo,
// halo suave detrás de cada cara y nombres en pastilla translúcida.
function campo(x, y, w, h, lado, club, confirmados) {
  const g = id('cp'), gv = id('cv'), gb = id('cb'), cl = id('cc'), pt = id('pt');
  const lc = 'stroke="#ffffff" stroke-opacity="0.11" stroke-width="2" fill="none"';
  const HB = 104;                                    // la cabecera del club
  let s = `<defs><clipPath id="${cl}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30"/></clipPath>${lineal(g, [[0, '#13221b'], [0.55, '#0c1612'], [1, '#090f0c']])}`
    + `<radialGradient id="${gv}" cx="0.5" cy="0" r="0.75"><stop offset="0" stop-color="${club.vivo}" stop-opacity="0.38"/><stop offset="1" stop-color="${club.vivo}" stop-opacity="0"/></radialGradient>`
    + `${lineal(gb, [[0, club.vivo, 0], [0.5, club.vivo, 1], [1, club.vivo, 0]], { x1: 0, y1: 0, x2: 1, y2: 0 })}`
    + `<pattern id="${pt}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="#fff" fill-opacity="0.05"/></pattern></defs>`
    + `<rect x="${x}" y="${y + 10}" width="${w}" height="${h}" rx="30" fill="#000" opacity="0.5"/>`
    + `<g clip-path="url(#${cl})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.7}" fill="url(#${gv})"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pt})"/>`;
  const yc = y + HB;
  // líneas: medio campo con su círculo arriba, área grande y pequeña abajo
  s += `<path d="M${x + w * 0.3},${yc} A${w * 0.2},${w * 0.2} 0 0 0 ${x + w * 0.7},${yc}" ${lc}/>`
    + `<rect x="${x + w * 0.2}" y="${y + h - 150}" width="${w * 0.6}" height="170" rx="6" ${lc}/>`
    + `<rect x="${x + w * 0.35}" y="${y + h - 62}" width="${w * 0.3}" height="80" rx="4" ${lc}/>`
    + `<path d="M${x + w * 0.39},${y + h - 150} A${w * 0.12},${w * 0.08} 0 0 1 ${x + w * 0.61},${y + h - 150}" ${lc}/>`
    + `<rect x="${x}" y="${yc - 1}" width="${w}" height="2" fill="url(#${gb})"/></g>`
    + `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="29" fill="none" stroke="#fff" stroke-opacity="0.09" stroke-width="2"/>`;
  const fw = lado.formacion ? medir(lado.formacion, 26, B, 2) + 30 : 0;
  const xNom = x + 26 + (lado.escudo ? 70 : 0), maxNom = w - (xNom - x) - 26 - (fw ? fw + 14 : 0);
  s += escudo(lado.escudo, x + 58, y + HB / 2, 64)
    + texto(xNom, y + HB / 2 + 17, mayus(lado.corto || lado.nombre), { px: 50, peso: 800, max: maxNom });
  if (fw) {
    const fx = x + w - 24 - fw;
    s += `<rect x="${fx}" y="${y + HB / 2 - 23}" width="${fw}" height="46" rx="23" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1.5"/>`
      + texto(fx + fw / 2, y + HB / 2 + 9, lado.formacion, { px: 26, peso: 800, ancla: 'middle', espacio: 2 });
  }
  // los jugadores, línea a línea (la delantera arriba)
  const lineas = lineasDe(lado).reverse();
  const arriba = yc + 22, abajo = y + h - 34;
  const alto = (abajo - arriba) / lineas.length;
  // el nombre (6 nov 20:19, Carlos: «el nombre más legible»): a 30, en negrita gruesa sobre una pastilla casi opaca. Si no cabe en su
  // hueco, antes que encoger la letra se acorta: inicial y apellido («J. IGLESIAS») y, si aun así no cabe, solo el apellido
  const PXN = 30;
  const pastilla = (t, cx, cy, wMax) => {
    const pp = tamano(t, PXN, wMax - 18), wt = Math.min(wMax, medir(t, pp, B, 0.5) + 26);
    return `<rect x="${cx - wt / 2}" y="${cy - PXN * 1.0}" width="${wt}" height="${PXN * 1.42}" rx="${PXN * 0.71}" fill="#0b0f0d" fill-opacity="0.82"/>`
      + `<rect x="${cx - wt / 2 + 0.75}" y="${cy - PXN * 1.0 + 0.75}" width="${wt - 1.5}" height="${PXN * 1.42 - 1.5}" rx="${PXN * 0.71}" fill="#ffffff" fill-opacity="0.07" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>`
      + texto(cx, cy, t, { px: PXN, peso: 800, color: '#ffffff', ancla: 'middle', max: wMax - 18, espacio: 0.5 });
  };
  lineas.forEach((ls, i) => {
    const n = ls.length, U = n >= 4 ? w - 12 : w * n / (n + 1), x0 = x + (w - U) / 2, hueco = U / n;
    const R = Math.max(26, Math.min(62, hueco / 2 - 9, (alto - 60) / 2));
    const cy = arriba + alto * i + R + 6, yN = cy + R + 32, ancho = hueco - 4;
    ls.forEach((j, k) => {
      const cx = x0 + hueco * (k + 0.5);
      const pctCol = colPct(j.pct);
      const hl = id('hl');
      s += `<defs><radialGradient id="${hl}"><stop offset="0.55" stop-color="${club.vivo}" stop-opacity="0.32"/><stop offset="1" stop-color="${club.vivo}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${R * 1.45}" fill="url(#${hl})"/>`;
      s += (j.cara ? caraCirculo(j.cara, cx, cy, R, { aro: j.duda ? AMBAR : club.vivo, grosor: Math.max(3, R * 0.06), fondoColor: club.vivo, zoom: 2.25 })
        : `<circle cx="${cx}" cy="${cy + 3}" r="${R + 1}" fill="#000" opacity="0.4"/><circle cx="${cx}" cy="${cy}" r="${Math.round(R * 0.62)}" fill="${club.vivo}" stroke="${j.duda ? AMBAR : '#ffffff'}" stroke-width="3"/>`)
        + pastilla(nombreAjustado(j.nombre, PXN, ancho - 18, 0.5, { apellido: true }), cx, yN, ancho);
      if (pctCol && !confirmados) s += chip(`${j.pct} %`, cx + R * 0.78, cy - R * 0.8, 21, { relleno: pctCol, pad: 1.4, espacio: 0.5 }).s;
      s += chipPuesto(j.pos, cx + R * 0.86, cy + R * 0.74, Math.max(15, Math.round(R * 0.31)));
    });
  });
  return s;
}
// el banquillo de los posibles onces (Carlos, 6 nov 20:34): el suplente con más % de delantero, medio y defensa, en un panel bajo el campo
const ALTO_BANCO = 214;
function banco(x, y, w, sup, club) {
  const h = ALTO_BANCO, gb = id('bk');
  let s = `<defs>${lineal(gb, [[0, '#121c17'], [1, '#0a100d']])}</defs><rect x="${x}" y="${y + 8}" width="${w}" height="${h}" rx="26" fill="#000" opacity="0.45"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="url(#${gb})"/>`
    + `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="25" fill="none" stroke="#fff" stroke-opacity="0.09" stroke-width="2"/>`
    + texto(x + 26, y + 34, 'SUPLENTES', { px: 22, peso: 800, color: '#ffffff', espacio: 4 })
    + `<rect x="${x + 26}" y="${y + 42}" width="${w - 52}" height="1.5" fill="#ffffff" fill-opacity="0.08"/>`;
  const hueco = (w - 20) / 3, R = 44, cy = y + 114;
  sup.slice(0, 3).forEach((j, k) => {
    const cx = x + 10 + hueco * (k + 0.5), hl = id('hl'), pctCol = colPct(j.pct);
    s += `<defs><radialGradient id="${hl}"><stop offset="0.55" stop-color="${club.vivo}" stop-opacity="0.3"/><stop offset="1" stop-color="${club.vivo}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${R * 1.45}" fill="url(#${hl})"/>`
      + (j.cara ? caraCirculo(j.cara, cx, cy, R, { aro: j.duda ? AMBAR : club.vivo, grosor: 3, fondoColor: club.vivo, zoom: 2.25 })
        : `<circle cx="${cx}" cy="${cy}" r="${Math.round(R * 0.62)}" fill="${club.vivo}" stroke="#ffffff" stroke-width="3"/>`)
      + chipPuesto(j.pos, cx, y + 62, 16, { largo: true });
    if (pctCol) s += chip(`${j.pct} %`, cx + R * 0.82, cy - R * 0.78, 19, { relleno: pctCol, pad: 1.4, espacio: 0.5 }).s;
    const ancho = hueco - 8, t = nombreAjustado(j.nombre, 26, ancho - 18, 0.5, { apellido: true }), pp = tamano(t, 26, ancho - 18), wt = Math.min(ancho, medir(t, pp, B, 0.5) + 24);
    s += `<rect x="${cx - wt / 2}" y="${cy + R + 34 - 26}" width="${wt}" height="37" rx="18.5" fill="#ffffff" fill-opacity="0.07" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>`
      + texto(cx, cy + R + 34, t, { px: 26, peso: 800, ancla: 'middle', max: ancho - 18, espacio: 0.5 });
  });
  return s;
}
export function svgOnces(d) {
  const L = d.local, V = d.visitante, H = ALTO_ONCES;
  const cL = coloresClub(L.nombre), cV0 = coloresClub(V.nombre);
  const cV = { ...cV0, vivo: distinto(cV0, cL) };
  const tit = d.confirmados ? aColor(VERDE) : dorado();
  let s = tit.defs + fondo([[250, 120, 700, cL.vivo, 0.28], [950, 120, 700, cV.vivo, 0.28]], H)
    + texto(600, 86, d.confirmados ? 'ONCES CONFIRMADOS' : 'POSIBLES ONCES', { px: 72, peso: 800, italica: true, color: `url(#${tit.g})`, ancla: 'middle', max: 900 })
    + texto(600, 124, `JORNADA ${d.jornada}`, { px: 24, peso: 700, color: TENUE, ancla: 'middle', espacio: 4 });
  const conBanco = !d.confirmados && [L, V].some((x) => x.suplentes && x.suplentes.length), hc = H - 222 - (conBanco ? ALTO_BANCO + 16 : 0);
  s += campo(22, 150, 570, hc, L, cL, d.confirmados) + campo(608, 150, 570, hc, V, cV, d.confirmados);
  if (conBanco) s += banco(22, 150 + hc + 16, 570, L.suplentes || [], cL) + banco(608, 150 + hc + 16, 570, V.suplentes || [], cV);
  return marco(s + marca(600, H - 26, { ancla: 'middle' }), H);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del once ideal de la jornada (Carlos, 6 nov 08:45): los 11 en un solo campo, cada uno con su cara, el escudo de su club, el
// nombre y los puntos que Fantasy Manager espera de él (chapa dorada). Aro dorado grueso: la apuesta (el que más puntos se espera);
// aro verde: el chollo (el barato que más da).
// 7 nov (HD): en vertical (1200 x 1300) con el campo de la tarjeta de onces (casi negro, brillo dorado arriba, rejilla de puntos, líneas
// finas) y caras de radio 64 con la cabeza entera (antes 29).
// d = { jornada, formacion: '4-3-3', valor: '387 M', apuesta: bool, chollo: bool, once: [{ pos, nombre, club, pts: '7,4', rol: 'apuesta'|'chollo'|null,
//       cara (PNG), escudo (PNG) }] (11, de portero a delanteros) }
const AURO = '#fbe9a6';
export const ALTO_ONCE_IDEAL = 1300;
/** el campo (el de la tarjeta de onces, entero para un solo equipo): medio campo arriba, áreas abajo */
function cesped(x, y, w, h, color) {
  const g = id('cp'), gv = id('cv'), cl = id('cc'), pt = id('pt');
  const lc = 'stroke="#ffffff" stroke-opacity="0.11" stroke-width="2" fill="none"';
  return `<defs><clipPath id="${cl}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30"/></clipPath>${lineal(g, [[0, '#13221b'], [0.55, '#0c1612'], [1, '#090f0c']])}`
    + `<radialGradient id="${gv}" cx="0.5" cy="0" r="0.75"><stop offset="0" stop-color="${color}" stop-opacity="0.3"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
    + `<pattern id="${pt}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="#fff" fill-opacity="0.05"/></pattern></defs>`
    + `<rect x="${x}" y="${y + 10}" width="${w}" height="${h}" rx="30" fill="#000" opacity="0.5"/>`
    + `<g clip-path="url(#${cl})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.6}" fill="url(#${gv})"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pt})"/>`
    + `<path d="M${x + w * 0.38},${y} A${w * 0.12},${w * 0.12} 0 0 0 ${x + w * 0.62},${y}" ${lc}/>`
    + `<rect x="${x + w * 0.27}" y="${y + h - 170}" width="${w * 0.46}" height="190" rx="6" ${lc}/>`
    + `<rect x="${x + w * 0.38}" y="${y + h - 70}" width="${w * 0.24}" height="90" rx="4" ${lc}/>`
    + `<path d="M${x + w * 0.42},${y + h - 170} A${w * 0.09},${w * 0.06} 0 0 1 ${x + w * 0.58},${y + h - 170}" ${lc}/></g>`
    + `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="29" fill="none" stroke="#e2bd5a" stroke-opacity="0.35" stroke-width="2"/>`;
}
export function svgOnceIdeal(d) {
  const H = ALTO_ONCE_IDEAL, oro = dorado();
  let s = oro.defs + fondo([[260, 80, 700, '#e2bd5a', 0.16], [940, 80, 700, VERDE, 0.12]], H)
    + titular('ONCE IDEAL', oro.g, `JORNADA ${d.jornada}`, { px: 84, sub2: `PUNTOS ESPERADOS · ${d.formacion}` });
  const x = 22, y = 196, w = 1156, h = H - y - 128;
  s += cesped(x, y, w, h, '#e2bd5a');
  // las líneas de jugadores: delanteros arriba y portero abajo
  const once = d.once.slice(0, 11);
  const f = String(d.formacion || '').split('-').map(Number).filter((n) => n > 0);
  const lineas = [once.slice(0, 1)]; let i = 1;
  for (const c of f) { lineas.push(once.slice(i, i + c)); i += c; }
  lineas.reverse();
  const alto = (h - 36) / lineas.length, pxN = 30;
  lineas.forEach((ls, fila) => {
    const n = ls.length, U = n >= 4 ? w - 24 : w * n / (n + 1), hueco = U / n;
    const R = Math.max(30, Math.min(R_MAX, hueco / 2 - 14, (alto - 84) / 2));
    const cy = y + 24 + alto * fila + R + 8;
    centros(x, w, n, hueco).forEach((cx, k) => {
      const j = ls[k], club = coloresClub(j.club || '');
      const aro = j.rol === 'apuesta' ? AURO : j.rol === 'chollo' ? VERDE : null;
      s += jugadorHD(j, cx, cy, R, club, { aro, wN: Math.min(hueco - 10, 290), pxN, escudoBuf: j.escudo,
        etiqueta: { txt: j.pts, relleno: '#e2bd5a', tinta: OSCURO, px: 25 } });
    });
  });
  // el pie: qué es el aro dorado y el verde, y lo que vale el once
  const yl = y + h + 50;
  let lx = 40;
  const leyenda = (color, txt) => { s += `<circle cx="${lx + 11}" cy="${yl - 9}" r="11" fill="none" stroke="${color}" stroke-width="5"/>` + texto(lx + 32, yl, txt, { px: 26, peso: 800, color: TINTA, espacio: 2 }); lx += 32 + medir(txt, 26, B, 2) + 34; };
  if (d.apuesta) leyenda(AURO, 'APUESTA');
  if (d.chollo) leyenda(VERDE, 'CHOLLO');
  s += texto(1160, yl, `VALOR DEL ONCE ${d.valor}`, { px: 26, peso: 800, color: TINTA, ancla: 'end', espacio: 2 });
  return marco(s + marca(600, H - 26, { ancla: 'middle' }), H);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del mercado de cada noche (Carlos, 3 nov 06:56: «top 5 subidas y bajadas»): SUBEN en verde y BAJAN en rojo.
// 7 nov (HD): un panel ancho por lado, uno encima del otro, con los cinco en fila: cara grande, nombre en pastilla, lo que sube o baja
// en grande y debajo el % y su valor. 1200 x 1024.
// d = { fecha: '3 de noviembre', suben: [fila] (5), bajan: [fila] (5) } con fila = { nombre, equipo, club, cara (PNG), escudo (PNG),
//       dif: '+2,3 M', pct: '+2,3 %', valor: '102 M' }
const MK = { y0: 196, h: 372, gap: 16, R: 60, pxN: 30 };
export const ALTO_MERCADO = MK.y0 + 2 * MK.h + MK.gap + 76;
function panelMercado(x, y, w, lista, bueno) {
  const acento = bueno ? VERDE : MALO, { R, pxN } = MK;
  let s = panel(x, y, w, MK.h, acento, { brillo: 0.22 });
  const t = bueno ? 'SUBEN' : 'BAJAN', wc = medir(t, 30, B, 3) + 76;
  s += `<rect x="${x + 22}" y="${y + 20}" width="${wc}" height="46" rx="23" fill="${acento}"/>`
    + flecha(bueno, x + 50, y + 43, 22, '#06130d') + texto(x + 72, y + 54, t, { px: 30, peso: 900, color: '#06130d', espacio: 3 });
  const n = Math.min(5, lista.length), hueco = (w - 24) / 5, cy = y + 96 + R;
  centros(x, w, n, hueco).forEach((cx, k) => {
    const f = lista[k], club = coloresClub(f.club || f.equipo), yb = bajoCara(cy, R, pxN);
    s += jugadorHD(f, cx, cy, R, club, { wN: hueco - 10, pxN, escudoBuf: f.escudo })
      + texto(cx, yb + 54, f.dif, { px: 48, peso: 900, color: acento, ancla: 'middle', max: hueco - 16 })
      + texto(cx, yb + 88, `${f.pct} · ${f.valor}`, { px: 24, peso: 700, color: TENUE, ancla: 'middle', max: hueco - 16 });
  });
  return s;
}
export function svgMercado(d) {
  const oro = dorado(), H = ALTO_MERCADO;
  let s = oro.defs + fondo([[260, 60, 700, VERDE, 0.16], [940, 60, 700, MALO, 0.16]], H)
    + titular('MERCADO', oro.g, mayus(d.fecha), { px: 84, sub2: 'LALIGA FANTASY' })
    + panelMercado(22, MK.y0, 1156, d.suben, true) + panelMercado(22, MK.y0 + MK.h + MK.gap, 1156, d.bajan, false);
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de bajas y novedades (Carlos, 3 nov 09:33: «acompañarlo de una tarjeta del Getafe»; las caídas y los sancionados «de forma
// más gráfica»). Dos formas:
//   - de un equipo (todas las filas del mismo club): escudo grande y el titular en cursiva arriba, el próximo rival a la derecha y,
//     en un panel con el brillo del club, de 2 a 4 caras en fila con el puesto, la media y la etiqueta de su estado;
//   - de varios equipos: fichas como las del resumen (hasta 4 en una fila; 5 y 6, en dos filas de 3) con el escudo de cada uno.
// Con un solo jugador, la carta (lib/carta.mjs). 7 nov (HD): caras de radio 60-64 (antes 30-50) y nombres en pastilla.
// d = { jornada, titulo ('BAJAS'|'BAJAS Y DUDAS'|'NOVEDADES'), equipo: { nombre, corto, escudo } | null,
//       rival: { corto, nombre, escudo } | null,
//       filas: [{ nombre, equipo, club, posicion, cara, escudo, estado: 'lesionado'|'sancionado'|'duda'|'disponible', pct, media ('5,2'|null) }] }
const ALTO_PANEL_EQUIPO = 420;
const BJ = { y0: 196, h: 322, gap: 16, R: 60, pxN: 32 };
export function altoBajas(d) {
  if (d.filas.length === 1) return ALTO;
  if (d.equipo) return 206 + ALTO_PANEL_EQUIPO + 78;
  const n = Math.min(6, d.filas.length), filas = n <= 4 ? 1 : 2;
  return BJ.y0 + filas * (BJ.h + BJ.gap) - BJ.gap + 80;
}
export function svgBajas(d) {
  if (d.filas.length === 1) return svgBajaSola(d);          // un solo jugador: la carta (lib/carta.mjs)
  const filas = d.filas.slice(0, d.equipo ? 4 : 6), H = altoBajas(d);
  const tono = d.titulo === 'NOVEDADES' ? VERDE : d.titulo === 'DUDAS' ? AMBAR : MALO;
  const tit = aColor(tono);
  // (Carlos, 5 nov 17:08) lo que va bajo cada jugador: si el título ya dice el estado de todos (DUDAS, SANCIONADOS), no se repite: el %
  // de titularidad si lo hay (y si no, nada); en NOVEDADES, el % si lo hay; si no (BAJAS, BAJAS Y DUDAS), el estado, que es lo que
  // distingue a unos de otros
  const dicho = d.titulo === 'DUDAS' || d.titulo === 'SANCIONADOS';
  const derecha = (f, cx, cy, px, wMax) => (f.pct != null && (dicho || d.titulo === 'NOVEDADES') ? pildoraTit(f.pct, cx, cy, px, wMax)
    : dicho ? '' : pildora(f, cx, cy, px, wMax));
  let s = tit.defs;
  if (d.equipo) {
    const club = coloresClub(d.equipo.nombre || d.equipo.corto);
    const cR = d.rival ? coloresClub(d.rival.nombre || d.rival.corto) : null;
    s += fondo([[200, 120, 700, club.vivo, 0.32], ...(cR ? [[1060, 90, 360, cR.vivo, 0.2]] : [])], H)
      + escudo(d.equipo.escudo, 104, 108, 124);
    const xt = d.equipo.escudo ? 190 : 44;
    s += texto(xt - 4, 118, d.titulo, { px: 100, peso: 800, italica: true, color: `url(#${tit.g})`, max: d.rival ? 640 : 960 })
      + texto(xt, 164, `${mayus(d.equipo.corto)} · JORNADA ${d.jornada}`, { px: 34, peso: 700, espacio: 1.5, max: d.rival ? 600 : 960 });
    if (d.rival) {
      s += texto(1156, 70, 'PRÓXIMO RIVAL', { px: 24, peso: 700, color: TENUE, ancla: 'end', espacio: 3 })
        + escudo(d.rival.escudo, 1126, 124, 60)
        + texto(d.rival.escudo ? 1086 : 1156, 140, mayus(d.rival.corto), { px: 46, peso: 800, ancla: 'end', max: 300 });
    }
    const y = 206, w = 1156, x = 22, R = 64, pxN = 34, n = filas.length, hueco = Math.min(n === 2 ? 440 : 380, (w - 24) / n), cy = y + 40 + R;
    s += panel(x, y, w, ALTO_PANEL_EQUIPO, club.vivo, { brillo: 0.32 });
    centros(x, w, n, hueco).forEach((cx, k) => {
      const f = filas[k], yb = bajoCara(cy, R, pxN);
      // el puesto y, debajo, la media en oro (antes en una línea: «CENTROCAMPISTA · 5,5 PTS DE MEDIA» no cabía a un tamaño legible)
      s += jugadorHD(f, cx, cy, R, club, { wN: hueco - 12, pxN })
        + (f.posicion ? texto(cx, yb + 40, mayus(f.posicion), { px: 25, peso: 700, color: colorPuesto(f.posicion) || TENUE, ancla: 'middle', espacio: 1.5, max: hueco - 20 }) : '')
        + (f.media ? cifraUnidad(cx, yb + 86, f.media, 'PTS DE MEDIA', 40, ORO_TXT, { pu: 22 }) : '')
        + derecha(f, cx, yb + 136, 28, hueco - 16);
    });
  } else {
    s += fondo([[300, 60, 700, tono, 0.18], [950, 60, 620, tono, 0.1]], H)
      + titular(d.titulo, tit.g, `JORNADA ${d.jornada}`, { px: 84, sub2: 'LALIGA FANTASY' });
    const n = filas.length, porFila = n <= 4 ? n : 3, enUna = n <= 3, { R, pxN } = BJ;
    for (let r = 0; r * porFila < n; r++) {
      const fila = filas.slice(r * porFila, r * porFila + porFila), w = (1140 - (porFila - 1) * BJ.gap) / porFila;
      const w0 = fila.length * w + (fila.length - 1) * BJ.gap, x0 = (ANCHO - w0) / 2;
      fila.forEach((f, k) => {
        const x = x0 + k * (w + BJ.gap), y = BJ.y0 + r * (BJ.h + BJ.gap), cx = x + w / 2, cy = y + 36 + R, club = coloresClub(f.club || f.equipo);
        const yb = bajoCara(cy, R, pxN), sub = f.media && enUna ? `${f.equipo} · ${f.media} pts de media` : f.equipo;
        s += panel(x, y, w, BJ.h, club.vivo, { rx: 26, brillo: 0.32 })
          + `<rect x="${x + 24}" y="${y}" width="${w - 48}" height="5" rx="2.5" fill="${ESTADO_TARJETA[f.estado].color}"/>`
          + jugadorHD(f, cx, cy, R, club, { wN: w - 28, pxN })
          + escudoTexto(f.escudo, cx, yb + 44, mayus(sub), 24, { max: w - 30 })
          + derecha(f, cx, y + BJ.h - 40, 26, w - 30);
      });
    }
  }
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de apercibidos: los jugadores separados por equipo (Carlos, 5 nov 08:14). Un panel por equipo (escudo, nombre y sus
// jugadores con cara, puesto y media) en dos columnas, en el orden en que llegan (de arriba abajo y de izquierda a derecha).
// 7 nov (HD): cada panel, con el brillo del club y su cabecera como en la de onces; los jugadores, en filas de tres caras grandes
// (radio 58). Si no caben, filas de cuatro o de cinco con caras más pequeñas; alto según lo que lleve, hasta 1500.
// d = { jornada, equipos: [{ nombre, corto, escudo, jugadores: [{ nombre, posicion, media, cara }] }] }
const AP = { y0: 196, max: 1500 - 196 - 80, gap: 16, cab: 84 };
const opcionAp = (w, porFila) => { const hueco = (w - 24) / porFila, R = Math.min(58, Math.floor(hueco / 2 - 24)), pxN = hueco >= 170 ? 28 : hueco >= 130 ? 25 : 22; return { porFila, hueco, R, pxN, filaH: 2 * R + 30 + pxN + 27 + 44 }; };
const altoBloque = (e, o) => AP.cab + Math.ceil(e.jugadores.length / o.porFila) * o.filaH + 6;
/** cómo se reparten los bloques: en 1, 2 o 3 columnas (sin cambiar el orden) y con 1 a 8 caras por fila, la opción con las caras más
    grandes con la que cabe todo (a igualdad, menos columnas y luego menos alto), o null si no cabe ni con la más pequeña */
export function planApercibidos(equipos) {
  if (!equipos || !equipos.length) return null;
  const n = equipos.length;
  let mejor = null;
  for (const nc of [1, 2, 3]) {
    if (nc > n || (nc === 1 && n > 1)) continue;
    const w = (1156 - (nc - 1) * AP.gap) / nc;
    for (let porFila = 1; porFila <= 8; porFila++) {
      const o = opcionAp(w, porFila);
      if (o.R < 28) break;
      const alto = (xs) => xs.reduce((s, e) => s + altoBloque(e, o), 0) + AP.gap * Math.max(0, xs.length - 1);
      // los cortes que dejan las columnas más parejas
      const cortes = nc === 1 ? [[equipos]] : nc === 2 ? equipos.slice(1).map((_, k) => [equipos.slice(0, k + 1), equipos.slice(k + 1)])
        : equipos.slice(1).flatMap((_, a) => equipos.slice(a + 2).map((__, b) => [equipos.slice(0, a + 1), equipos.slice(a + 1, a + 2 + b), equipos.slice(a + 2 + b)]));
      for (const cols of cortes) {
        const max = Math.max(...cols.map(alto));
        if (max > AP.max) continue;
        const c = { ...o, w, cols, max };
        if (!mejor || c.R > mejor.R || (c.R === mejor.R && (nc < mejor.cols.length || (nc === mejor.cols.length && max < mejor.max)))) mejor = c;
      }
    }
  }
  return mejor;
}
export const altoApercibidos = (plan) => Math.max(ALTO, AP.y0 + (plan ? plan.max : 0) + 80);

function bloqueEquipo(x, y, e, o, oro) {
  const club = coloresClub(e.nombre || e.corto), w = o.w, h = altoBloque(e, o);
  let s = panel(x, y, w, h, club.vivo, { rx: 26, brillo: 0.34, linea: AP.cab });
  s += escudo(e.escudo, x + 50, y + AP.cab / 2, 56)
    + texto(e.escudo ? x + 90 : x + 28, y + AP.cab / 2 + 15, mayus(e.corto), { px: 42, peso: 800, max: w - 220 });
  if (e.jugadores.some((j) => j.media)) s += texto(x + w - 26, y + AP.cab / 2 + 9, 'MEDIA', { px: 22, peso: 700, color: '#fff', ancla: 'end', espacio: 2, opacidad: 0.7 });
  const filas = Math.ceil(e.jugadores.length / o.porFila);
  for (let r = 0; r < filas; r++) {
    const ls = e.jugadores.slice(r * o.porFila, r * o.porFila + o.porFila), cy = y + AP.cab + r * o.filaH + 30 + o.R;
    centros(x, w, ls.length, Math.min(o.hueco, 210)).forEach((cx, k) => {
      const j = ls[k], yb = bajoCara(cy, o.R, o.pxN) + 40;
      s += jugadorHD(j, cx, cy, o.R, club, { wN: Math.min(o.hueco, 210) - 8, pxN: o.pxN });
      // el puesto va en su chapa de color sobre la cara; debajo, solo la media
      if (j.media) s += texto(cx, yb + 1, j.media, { px: 32, peso: 900, color: `url(#${oro})`, ancla: 'middle' });
    });
  }
  return s;
}

export function svgApercibidos(d) {
  const plan = planApercibidos(d.equipos), H = altoApercibidos(plan);
  const tit = aColor(AMBAR), oro = dorado();
  let s = tit.defs + oro.defs + fondo([[300, 60, 700, AMBAR, 0.16], [950, 60, 620, AMBAR, 0.08]], H)
    + titular('APERCIBIDOS', tit.g, `JORNADA ${d.jornada}`, { px: 84, sub2: 'A UNA AMARILLA DE LA SANCIÓN' });
  if (plan) {
    plan.cols.forEach((col, c) => {
      const x = 22 + c * (plan.w + AP.gap);
      let y = AP.y0;
      for (const e of col) { s += bloqueEquipo(x, y, e, plan, oro.g); y += altoBloque(e, plan) + AP.gap; }
    });
  }
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}
// ---------------------------------------------------------------------------------------------------------------------------
let Resvg = null;
// Se dibujan al DOBLE (2400 de ancho): a 1200, X las enseñaba borrosas (Carlos, 7 nov: «salen muy borrosas, que salgan en HD»). X las
// pasa a JPEG y las sirve hasta 2048 de ancho, así que con 2400 baja de tamaño en vez de estirarlas. Si el PNG pasa de 4,8 MB (X no
// acepta más de 5), se prueba a 1,6 y, si aun así no, al tamaño original.
const ESCALAS = [2, 1.6, 1], MAX_BYTES = 4.8 * 1024 * 1024;
/** SVG -> PNG (Buffer). @resvg/resvg-js se carga solo si hace falta: el bot sin tarjetas no lo necesita */
export async function aPng(svg, { escalas = ESCALAS } = {}) {
  if (!Resvg) ({ Resvg } = await import('@resvg/resvg-js'));
  let png = null;
  for (const z of escalas) {
    const r = new Resvg(svg, { font: { fontFiles: FUENTES, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: z === 1 ? { mode: 'original' } : { mode: 'zoom', value: z }, imageRendering: 0, shapeRendering: 2, textRendering: 2 });
    png = Buffer.from(r.render().asPng());
    if (png.length <= MAX_BYTES) return png;
  }
  return png;
}
export { luz };
