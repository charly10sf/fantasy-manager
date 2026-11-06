// Tarjetas con imagen para los tweets del bot: dibujo en SVG y paso a PNG con @resvg/resvg-js.
// Las que hablan de UN jugador concreto (la de jugador y la de bajas con un solo jugador) van en carta de coleccionista (lib/carta.mjs,
// Carlos, 3 nov 11:11). Las demás (final de partido, resumen de la jornada, posibles onces, mercado y bajas o novedades de varios)
// estaban en el estilo «noche» con letra Inter; desde el 5 nov (Carlos, 06:41: «que se parezcan en tipografía, estética y demás a las
// de jugadores») llevan las piezas de la carta (lib/estilo.mjs): Barlow Condensed, el fondo con rayos, titulares en cursiva con
// degradado, cajas inclinadas, la cifra destacada en oro, etiquetas de estado rellenas y la misma marca. Los textos son los mismos
// de antes (o en mayúsculas), así que el validador y las palabras fijas no cambian.
// Aquí solo se dibuja: los datos llegan ya montados (datos-tarjetas.mjs) y validar.mjs comprueba que todo lo escrito esté en ellos.
import { coloresClub, luz } from './colores.mjs';
import { svgJugadorCarta, svgBajaSola } from './carta.mjs';
import { ANCHO, ALTO, VERDE, MALO, AMBAR, TENUE, TINTA, PANEL, LINEA, num1, millones, medir, B, texto, id, lineal, radial, marco,
  escudo, caraCirculo, fondo, dorado, rojizo, aColor, caja, marca, pildora, anchoPildora, pildoraTit, anchoPildoraTit, colPct, ESTADO_TARJETA,
  chip, flecha, medalla, distinto, nombreAjustado, tamano } from './estilo.mjs';

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
/** un rótulo de lista: el triángulo del sentido (o una barra) y el texto, en el color */
const rotulo = (x, y, txt, color, sube = null) => (sube == null
  ? `<rect x="${x + 4}" y="${y - 19}" width="6" height="25" rx="3" fill="${color}"/>` + texto(x + 20, y, txt, { px: 25, peso: 800, color, espacio: 3 })
  : flecha(sube, x + 14, y - 8, 20, color) + texto(x + 34, y, txt, { px: 25, peso: 800, color, espacio: 3 }));

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
// Tarjeta de final de partido
// d = { jornada, local, visitante } con cada lado { nombre, corto, goles, escudo (PNG), mejores: [{nombre, pts, cara}] (3),
//       peores: [...] (hasta 3, de más a menos malo: el primero es el que menos puntos ha sacado) }

// 7 nov (Carlos: «que se vean un poco mejor las caras de los jugadores, se ven muy mal»): la tarjeta crece de 675 a 880 de alto para
// que cada fila mida 80 (antes 58) y la cara pase de 24 a 36 de radio, dibujada a 2,4 veces (cabe la cabeza entera, como en la de onces).
export const ALTO_FINAL = 880;
const FILA_H = 80, FILA_PASO = 88, CARA_R = 36;

/** una fila de la lista de un equipo: panel con un tinte verde o rojo, cara, nombre y los puntos en una pastilla */
function fila(x, y, w, j, bueno, club) {
  const h = FILA_H, r = CARA_R, cx = x + 16 + r, cy = y + h / 2, acento = bueno ? VERDE : MALO, maxN = w - (cx + r + 18 - x) - 156;
  return caja(x, y, w, h, { rx: 18, sombra: false, tinte: acento, tinteOp: 0.2 })
    + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 3, fondoColor: club.vivo, zoom: 2.4 })
    + texto(cx + r + 18, cy + 13, nombreAjustado(j.nombre, 40, maxN), { px: 40, peso: 700, max: maxN })
    + `<rect x="${x + w - 134}" y="${y + 12}" width="122" height="${h - 24}" rx="14" fill="${acento}" fill-opacity="0.16"/>`
    + texto(x + w - 72, cy + 17, String(j.pts), { px: 50, peso: 900, color: acento, ancla: 'end' })
    + texto(x + w - 24, cy + 15, 'PTS', { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 1 });
}

/** la columna de un equipo: MEJORES (hasta 3) y PEORES (hasta 3), con sitio fijo para que las dos columnas queden a la par */
function columna(x, y, w, lado, club) {
  let s = rotulo(x, y + 21, 'MEJORES', VERDE, true);
  lado.mejores.forEach((j, i) => { s += fila(x, y + 34 + i * FILA_PASO, w, j, true, club); });
  const y2 = y + 34 + 3 * FILA_PASO + 14;
  if (lado.peores.length) {
    s += rotulo(x, y2 + 21, 'PEORES', MALO, false);
    lado.peores.forEach((j, i) => { s += fila(x, y2 + 34 + i * FILA_PASO, w, j, false, club); });
  }
  return s;
}

export function svgFinal(d) {
  const L = d.local, V = d.visitante, H = ALTO_FINAL;
  const cL = coloresClub(L.nombre), cV0 = coloresClub(V.nombre);
  const cV = { ...cL, ...cV0, vivo: distinto(cV0, cL) };                     // dos clubes rojos no salen idénticos
  const oro = dorado();
  const yM = 52, hM = 120, cy = yM + hM / 2;
  let s = oro.defs + fondo([[200, 100, 640, cL.vivo, 0.34], [1000, 100, 640, cV.vivo, 0.34]], H)
    + texto(600, 36, `LALIGA FANTASY · JORNADA ${d.jornada} · FINAL`, { px: 22, peso: 700, color: TENUE, ancla: 'middle', espacio: 3 })
    + marcador(yM, hM, cL.vivo, cV.vivo)
    + escudo(L.escudo, 112, cy, 100) + escudo(V.escudo, 1088, cy, 100)
    + texto(176, cy + 20, mayus(L.corto), { px: 58, peso: 800, max: 250 })
    + texto(1024, cy + 20, mayus(V.corto), { px: 58, peso: 800, ancla: 'end', max: 250 })
    + `<rect x="478" y="${yM + 14}" width="244" height="${hM - 28}" rx="22" fill="#07080b" fill-opacity="0.72" stroke="${ORO_TXT}" stroke-opacity="0.45" stroke-width="1.5"/>`
    + texto(600, cy + 38, `${L.goles}-${V.goles}`, { px: 112, peso: 800, italica: true, color: `url(#${oro.g})`, ancla: 'middle' });
  s += columna(36, 192, 556, L, cL) + columna(608, 192, 556, V, cV);
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de jugador (MVP y directo): la carta, en lib/carta.mjs.
// d = { jornada, etiqueta ('MVP · Barça 6-1 Alavés' o '¡DOBLETE! · …'), nombre, posicion, club: {nombre, corto, escudo},
//       cara, ptsJornada, total, media, ultimas: [[jornada, pts], …] (5), valor: [[ms, €], …] (30 días), valorHoy, cambio (% en 30 días) }
export const svgJugador = (d) => svgJugadorCarta(d);

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del resumen de la jornada (Carlos, 2 nov 23:28): los 6 mejores o los 6 peores. 6 nov, segunda vuelta: el primero, en grande
// a la izquierda (cara, nombre, equipo y los puntos en una pastilla de oro o roja), y los otros cinco en una lista a la derecha.
// d = { jornada, clave: 'mejores'|'peores', filas: [{ nombre, equipo, club (nombre largo), pts, cara (PNG), escudo (PNG) }] (6) }
function heroe(x, y, w, h, j, bueno, gradPts) {
  const club = coloresClub(j.club || j.equipo), cx = x + w / 2, acento = bueno ? '#e2bd5a' : MALO;
  const nom = nombreAjustado(j.nombre, 62, w - 40), tw = medir(j.equipo, 26, B, 1);
  const x0 = cx - (36 + tw) / 2, pw = medir(String(j.pts), 88, B), tot = pw + 14 + medir('PTS', 30, B, 1), px0 = cx - tot / 2, ypts = y + h - 100;
  return caja(x, y, w, h, { rx: 28, tinte: club.vivo, tinteOp: 0.6, borde: acento, grosor: 2.5 })
    + caraCirculo(j.cara, cx, y + 150, 104, { aro: club.vivo, grosor: 6 })
    + medalla(1, cx - 80, y + 78, 27, { premio: bueno })
    + texto(cx, y + 306, nom, { px: 62, peso: 800, ancla: 'middle', max: w - 40 })
    + escudo(j.escudo, x0 + 15, y + 332, 32) + texto(x0 + (j.escudo ? 40 : 0), y + 341, mayus(j.equipo), { px: 26, peso: 700, color: TENUE, espacio: 1, max: w - 90 })
    + `<rect x="${x + 22}" y="${ypts}" width="${w - 44}" height="82" rx="20" fill="url(#${gradPts})"/>`
    + texto(px0, ypts + 66, String(j.pts), { px: 88, peso: 900, color: bueno ? OSCURO : '#fff' })
    + texto(px0 + pw + 14, ypts + 64, 'PTS', { px: 30, peso: 800, color: bueno ? OSCURO2 : '#ffd3d8', espacio: 1 });
}
export function svgResumen(d) {
  const bueno = d.clave === 'mejores';
  const tit = bueno ? dorado() : rojizo();
  const gR = id('rc');
  let s = tit.defs + `<defs>${lineal(gR, [[0, '#ff6b78'], [1, '#b3122a']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`
    + fondo(bueno ? [[300, 40, 660, VERDE, 0.16], [1050, 60, 520, '#e2bd5a', 0.12]] : [[300, 40, 660, MALO, 0.2], [1050, 60, 520, MALO, 0.08]])
    + cabecera(bueno ? 'LOS MEJORES' : 'LOS PEORES', tit.g, 'DE LA JORNADA', `LALIGA FANTASY · JORNADA ${d.jornada}`);
  const f = d.filas.slice(0, 6);
  if (f[0]) s += heroe(44, 164, 384, 456, f[0], bueno, bueno ? tit.g : gR);
  const x = 452, w = 704, h = 82, gap = 11, y0 = 165, color = bueno ? ORO_TXT : MALO;
  f.slice(1).forEach((j, i) => {
    const y = y0 + i * (h + gap), cy = y + h / 2, club = coloresClub(j.club || j.equipo), r = 32, cx = x + 96, tx = cx + r + 20, maxT = x + w - 170 - tx;
    s += caja(x, y, w, h, { rx: 20, tinte: club.vivo, tinteOp: 0.34 })
      + medalla(i + 2, x + 38, cy, 20, { premio: bueno })
      + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 3 })
      + texto(tx, cy - 3, nombreAjustado(j.nombre, 42, maxT), { px: 42, peso: 800, max: maxT })
      + escudo(j.escudo, tx + 12, cy + 25, 26) + texto(tx + (j.escudo ? 32 : 0), cy + 32, mayus(j.equipo), { px: 22, peso: 700, color: TENUE, espacio: 1, max: maxT - 34 })
      + texto(x + w - 82, cy + 19, String(j.pts), { px: 58, peso: 900, color, ancla: 'end' })
      + texto(x + w - 28, cy + 17, 'PTS', { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 1 });
  });
  return marco(s + marca(600, 650, { ancla: 'middle' }));
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
    });
  });
  return s;
}
// el banquillo de los posibles onces (Carlos, 6 nov 20:34): el suplente con más % de delantero, medio y defensa, en un panel bajo el campo
const ALTO_BANCO = 214;
const PUESTO_BANCO = { DEL: 'DELANTERO', MED: 'MEDIO', DEF: 'DEFENSA', POR: 'PORTERO' };
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
      + texto(cx, y + 60, PUESTO_BANCO[j.pos] || j.pos, { px: 17, peso: 700, color: TENUE, ancla: 'middle', espacio: 2.5 });
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
// d = { jornada, formacion: '4-3-3', valor: '387 M', apuesta: bool, chollo: bool, once: [{ pos, nombre, club, pts: '7,4', rol: 'apuesta'|'chollo'|null,
//       cara (PNG), escudo (PNG) }] (11, de portero a delanteros) }
const AURO = '#fbe9a6';
export function svgOnceIdeal(d) {
  const oro = dorado();
  const x = 44, y = 134, w = 1112, h = 462, g = id('cp'), gs = id('cs'), cl = id('cc');
  const lc = 'stroke="#ffffff" stroke-opacity="0.45" stroke-width="2.5" fill="none"';
  let s = oro.defs + fondo([[260, 60, 640, '#e2bd5a', 0.14], [980, 60, 640, VERDE, 0.12]])
    + cabecera('ONCE IDEAL', oro.g, `JORNADA ${d.jornada}`, `PUNTOS ESPERADOS · ${d.formacion}`, { px: 100, y: 114, maxTitulo: 640 });
  // el césped, con franjas, y sus líneas (las mismas de los posibles onces, con el campo entero para un solo equipo)
  s += `<defs><clipPath id="${cl}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/></clipPath>${lineal(g, [[0, '#23744a'], [1, '#124a2b']])}${lineal(gs, [[0, '#fff', 0.08], [1, '#fff', 0]])}</defs>`
    + `<rect x="${x}" y="${y + 5}" width="${w}" height="${h}" rx="22" fill="#000" opacity="0.4"/>`
    + `<g clip-path="url(#${cl})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>`;
  for (let k = 0; k < 10; k++) if (k % 2) s += `<rect x="${x}" y="${y + k * h / 10}" width="${w}" height="${h / 10}" fill="#000" opacity="0.1"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.3}" fill="url(#${gs})"/></g>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="#e2bd5a" stroke-opacity="0.8" stroke-width="3"/>`
    + `<rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" rx="12" ${lc}/>`
    + `<path d="M${x + w * 0.43},${y + 14} A${w * 0.07},${w * 0.07} 0 0 0 ${x + w * 0.57},${y + 14}" ${lc}/>`
    + `<rect x="${x + w * 0.3}" y="${y + h - 14 - 92}" width="${w * 0.4}" height="92" ${lc}/>`
    + `<rect x="${x + w * 0.4}" y="${y + h - 14 - 34}" width="${w * 0.2}" height="34" ${lc}/>`;
  // las líneas de jugadores: delanteros arriba y portero abajo
  const once = d.once.slice(0, 11);
  const f = String(d.formacion || '').split('-').map(Number).filter((n) => n > 0);
  const lineas = [once.slice(0, 1)]; let i = 1;
  for (const c of f) { lineas.push(once.slice(i, i + c)); i += c; }
  lineas.reverse();
  const alto = (h - 30) / lineas.length;
  const R = 29;
  lineas.forEach((ls, fila) => {
    const cy = y + 18 + alto * fila + alto * 0.33;
    ls.forEach((j, k) => {
      const n = ls.length, paso = w / (n + 1), cx = x + paso * (k + 1), maxN = Math.min(200, paso - 14);
      const club = coloresClub(j.club || '');
      const aro = j.rol === 'apuesta' ? AURO : j.rol === 'chollo' ? VERDE : club.vivo, grosor = j.rol ? 6 : 3.5;
      const nom = nombreAjustado(j.nombre, 24, maxN), pw = Math.min(maxN, medir(nom, tamano(nom, 24, maxN), B)) * 0.94 + 20;
      s += `<circle cx="${cx}" cy="${cy + 3}" r="${R + 1}" fill="#000" opacity="0.4"/>`
        + (j.cara ? caraCirculo(j.cara, cx, cy, R, { aro, grosor, fondoColor: club.vivo })
          : `<circle cx="${cx}" cy="${cy}" r="${Math.round(R * 0.6)}" fill="${club.vivo}" stroke="${aro}" stroke-width="3"/>`)
        + escudo(j.escudo, cx - R * 0.95, cy + R * 0.7, 28)
        + `<rect x="${cx - pw / 2}" y="${cy + R + 4}" width="${pw}" height="35" rx="17.5" fill="#06080a" fill-opacity="0.82"/>`
        + texto(cx, cy + R + 29, nom, { px: 24, peso: 700, ancla: 'middle', max: maxN })
        + chip(j.pts, cx + R * 0.95, cy - R * 0.62, 21, { relleno: '#e2bd5a', tinta: OSCURO, pad: 1.5, espacio: 0.5, peso: 900 }).s;
    });
  });
  // el pie: qué es el aro dorado y el verde, y lo que vale el once
  let lx = 48;
  const leyenda = (color, txt) => { s += `<circle cx="${lx + 8}" cy="623" r="8" fill="${color}"/>` + texto(lx + 24, 631, txt, { px: 23, peso: 700, color: TENUE, espacio: 2 }); lx += 24 + medir(txt, 23, B, 2) + 28; };
  if (d.apuesta) leyenda(AURO, 'APUESTA');
  if (d.chollo) leyenda(VERDE, 'CHOLLO');
  s += texto(1152, 631, `VALOR DEL ONCE ${d.valor}`, { px: 23, peso: 700, color: TENUE, ancla: 'end', espacio: 2 });
  return marco(s + marca(600, 662, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del mercado de cada noche (Carlos, 3 nov 06:56: «top 5 subidas y bajadas»): dos paneles, SUBEN en verde y BAJAN en rojo,
// cada uno con su cabecera de color y cinco filas.
// d = { fecha: '3 de noviembre', suben: [fila] (5), bajan: [fila] (5) } con fila = { nombre, equipo, club, cara (PNG), escudo (PNG),
//       dif: '+2,3 M', pct: '+2,3 %', valor: '102 M' }
export function svgMercado(d) {
  const oro = dorado();
  let s = oro.defs + fondo([[260, 40, 640, VERDE, 0.17], [980, 40, 640, MALO, 0.17]])
    + cabecera('MERCADO', oro.g, mayus(d.fecha), 'LALIGA FANTASY', { px: 104, y: 118 });
  const w = 544, y0 = 162, hP = 458, hf = 76, yf = y0 + 64;
  const col = (x, lista, bueno) => {
    const acento = bueno ? VERDE : MALO;
    let t = caja(x, y0, w, hP, { rx: 24, tinte: acento, tinteOp: 0.22 })
      + `<rect x="${x + 12}" y="${y0 + 12}" width="${w - 24}" height="42" rx="21" fill="${acento}"/>`
      + flecha(bueno, x + 44, y0 + 33, 22, '#06130d')
      + texto(x + 68, y0 + 44, bueno ? 'SUBEN' : 'BAJAN', { px: 30, peso: 900, color: '#06130d', espacio: 3 });
    lista.slice(0, 5).forEach((f, i) => {
      const y = yf + i * hf, cy = y + hf / 2, r = 30, cx = x + 82;
      const club = coloresClub(f.club || f.equipo), xd = x + w - 24, xa = xd - 152;
      if (i === 0) t += `<rect x="${x + 10}" y="${y + 3}" width="${w - 20}" height="${hf - 6}" rx="16" fill="${acento}" fill-opacity="0.14" stroke="${acento}" stroke-opacity="0.55" stroke-width="1.5"/>`;
      else t += `<rect x="${x + 24}" y="${y}" width="${w - 48}" height="1" fill="#fff" fill-opacity="0.07"/>`;
      t += medalla(i + 1, x + 38, cy, 15, { premio: bueno })
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, grosor: 3 })
        + texto(cx + r + 16, cy - 2, nombreAjustado(f.nombre, 34, xa - 24 - (cx + r + 16)), { px: 34, peso: 800, max: xa - 24 - (cx + r + 16) })
        + escudo(f.escudo, cx + r + 28, cy + 22, 24)
        + texto(cx + r + (f.escudo ? 46 : 16), cy + 29, mayus(f.equipo), { px: 22, peso: 700, color: TENUE, espacio: 1, max: 150 })
        + flecha(bueno, xa, cy - 8, 20, acento)
        + texto(xd, cy + 6, f.dif, { px: 46, peso: 900, color: acento, ancla: 'end' })
        + texto(xd, cy + 30, `${f.pct} · ${f.valor}`, { px: 21, peso: 700, color: TENUE, ancla: 'end' });
    });
    return t;
  };
  s += col(44, d.suben, true) + col(612, d.bajan, false);
  return marco(s + marca(600, 656, { ancla: 'middle' }));
}

/** una fila grande de jugador (bajas en lista): panel con el tinte del club, cara, nombre y debajo el escudo y el equipo (o `sub`).
    `derecha` es lo que va al final (la etiqueta del estado) y `wDer`, lo que ocupa */
function filaJugador(x, y, w, h, j, { derecha = '', wDer = 0, sub = null, acento = null } = {}) {
  const club = coloresClub(j.club || j.equipo), r = Math.round(h * 0.37), cx = x + 30 + r, cy = y + h / 2, tx = cx + r + 20;
  const maxT = x + w - 20 - wDer - 16 - tx;
  return caja(x, y, w, h, { tinte: club.vivo, tinteOp: 0.36 })
    + (acento ? `<rect x="${x + 11}" y="${y + 14}" width="6" height="${h - 28}" rx="3" fill="${acento}"/>` : '')
    + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 3 })
    + texto(tx, cy - 2, nombreAjustado(j.nombre, 44, maxT), { px: 44, peso: 800, max: maxT })
    + escudo(j.escudo, tx + 13, cy + 31, 30)
    + texto(tx + (j.escudo ? 34 : 0), cy + 40, mayus(sub ?? j.equipo), { px: 24, peso: 700, color: TENUE, espacio: 1, max: maxT - (j.escudo ? 34 : 0) })
    + derecha;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de bajas y novedades (Carlos, 3 nov 09:33: «acompañarlo de una tarjeta del Getafe»; las caídas y los sancionados «de forma
// más gráfica»). Dos formas:
//   - de un equipo (todas las filas del mismo club): escudo grande y el titular en cursiva arriba, el próximo rival a la derecha y una
//     fila grande por jugador (1 a 4) con cara, puesto, media y la etiqueta de su estado;
//   - de varios equipos: dos columnas de 3, como el resumen, con el escudo de cada uno.
// Con un solo jugador, la carta (lib/carta.mjs).
// d = { jornada, titulo ('BAJAS'|'BAJAS Y DUDAS'|'NOVEDADES'), equipo: { nombre, corto, escudo } | null,
//       rival: { corto, nombre, escudo } | null,
//       filas: [{ nombre, equipo, club, posicion, cara, escudo, estado: 'lesionado'|'sancionado'|'duda'|'disponible', pct, media ('5,2'|null) }] }
export function svgBajas(d) {
  if (d.filas.length === 1) return svgBajaSola(d);          // un solo jugador: la carta (lib/carta.mjs)
  const filas = d.filas.slice(0, d.equipo ? 4 : 6);
  const tono = d.titulo === 'NOVEDADES' ? VERDE : d.titulo === 'DUDAS' ? AMBAR : MALO;
  const tit = aColor(tono);
  // (Carlos, 5 nov 17:08) lo que va a la derecha de cada fila: si el título ya dice el estado de todos (DUDAS, SANCIONADOS), no se
  // repite: el % de titularidad si lo hay (y si no, nada); en NOVEDADES, el % si lo hay; si no (BAJAS, BAJAS Y DUDAS), el estado, que
  // es lo que distingue a unos de otros
  const dicho = d.titulo === 'DUDAS' || d.titulo === 'SANCIONADOS';
  const derecha = (f, cx, cy, px, wMax) => (f.pct != null && (dicho || d.titulo === 'NOVEDADES') ? { s: pildoraTit(f.pct, cx, cy, px, wMax), w: anchoPildoraTit(f.pct, px) }
    : dicho ? { s: '', w: 0 } : { s: pildora(f, cx, cy, px, wMax), w: anchoPildora(f, px) });
  const anchoDer = (f, px) => (f.pct != null && (dicho || d.titulo === 'NOVEDADES') ? anchoPildoraTit(f.pct, px) : dicho ? 0 : anchoPildora(f, px));
  let s = tit.defs;
  if (d.equipo) {
    const club = coloresClub(d.equipo.nombre || d.equipo.corto);
    const cR = d.rival ? coloresClub(d.rival.nombre || d.rival.corto) : null;
    s += fondo([[160, 80, 660, club.vivo, 0.3], ...(cR ? [[1080, 100, 320, cR.vivo, 0.2]] : [])])
      + caja(44, 22, 1112, 150, { rx: 26, tinte: club.vivo, tinteOp: 0.55, borde: false })
      + `<rect x="44.5" y="22.5" width="1111" height="149" rx="26" fill="none" stroke="#fff" stroke-opacity="0.16"/>`
      + escudo(d.equipo.escudo, 112, 98, 116);
    const xt = d.equipo.escudo ? 190 : 72;
    s += texto(xt - 4, 108, d.titulo, { px: 92, peso: 800, italica: true, color: `url(#${tit.g})`, max: d.rival ? 640 : 960 })
      + texto(xt, 152, `${mayus(d.equipo.corto)} · JORNADA ${d.jornada}`, { px: 32, peso: 700, espacio: 1.5, max: d.rival ? 600 : 960 });
    if (d.rival) {
      s += texto(1128, 68, 'PRÓXIMO RIVAL', { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 3 })
        + escudo(d.rival.escudo, 1102, 116, 52)
        + texto(d.rival.escudo ? 1066 : 1128, 131, mayus(d.rival.corto), { px: 42, peso: 800, ancla: 'end', max: 300 });
    }
    // filas grandes: 1 a 4, entre y = 188 y 616
    const n = filas.length, gap = 12, alto = 428;
    const h = n === 1 ? 190 : Math.min(n === 2 ? 170 : 130, (alto - gap * (n - 1)) / n);
    const y0 = 188 + (alto - (n * h + gap * (n - 1))) / 2;
    const w = 1112, x = 44;
    filas.forEach((f, i) => {
      const y = y0 + i * (h + gap), cy = y + h / 2, k = Math.round(h * 0.12);
      const r = Math.round(h * 0.4), cx = x + 30 + r;
      const pxN = Math.round(Math.min(58, h * 0.39)), pxS = Math.round(Math.min(30, h * 0.21)), pxP = Math.round(Math.min(34, h * 0.235));
      const sub = [f.posicion, f.media ? `${f.media} pts de media` : null].filter(Boolean).join(' · ');
      const wp = anchoDer(f, pxP);
      s += caja(x, y, w, h, { tinte: club.vivo, tinteOp: 0.36 })
        + `<rect x="${x + 11}" y="${y + 14}" width="6" height="${h - 28}" rx="3" fill="${ESTADO_TARJETA[f.estado].color}"/>`
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, grosor: 3 })
        + texto(cx + r + 24, sub ? cy - pxS * 0.15 : cy + pxN * 0.35, mayus(f.nombre), { px: pxN, peso: 800, max: 620 })
        + (sub ? texto(cx + r + 24, cy + pxS * 1.5, mayus(sub), { px: pxS, peso: 700, color: TENUE, espacio: 1, max: 620 }) : '')
        + derecha(f, x + w - k - 24 - wp / 2, cy, pxP, 420).s;
    });
  } else {
    s += fondo([[300, 40, 660, tono, 0.18], [1050, 60, 520, tono, 0.08]])
      + cabecera(d.titulo, tit.g, `JORNADA ${d.jornada}`, 'LALIGA FANTASY');
    const h = 128, gap = 14, x0 = [44, 612], y0 = 174;
    const enUna = filas.length <= 3;              // con 3 o menos, una columna ancha
    const pxP = enUna ? 28 : 21;
    const porCol = enUna ? filas.length : Math.ceil(filas.length / 2);   // 4 -> 2 y 2, 5 -> 3 y 2, 6 -> 3 y 3
    filas.forEach((f, i) => {
      const x = enUna ? 44 : x0[Math.floor(i / porCol)], ww = enUna ? 1112 : 544;
      const y = y0 + (3 - porCol) * (h + gap) / 2 + (enUna ? i : i % porCol) * (h + gap);
      const k = Math.round(h * 0.12), wp = anchoDer(f, pxP);
      const pil = derecha(f, x + ww - k - 20 - wp / 2, y + h / 2, pxP, 400).s;
      s += filaJugador(x, y, ww, h, f, { acento: ESTADO_TARJETA[f.estado].color, derecha: pil, wDer: wp, sub: f.media && enUna ? `${f.equipo} · ${f.media} pts de media` : f.equipo });
    });
  }
  return marco(s + marca(600, 650, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de apercibidos: los jugadores separados por equipo (Carlos, 5 nov 08:14). Un bloque por equipo (escudo, nombre y sus
// jugadores con cara, puesto y media) en dos columnas, en el orden en que llegan (de arriba abajo y de izquierda a derecha).
// d = { jornada, equipos: [{ nombre, corto, escudo, jugadores: [{ nombre, posicion, media, cara }] }] }
const AP = { y0: 172, alto: 446, x: [44, 612], w: 544, gap: 12, pad: 10 };
const altoBloque = (e, R) => Math.round(R * 0.7) + e.jugadores.length * R + AP.pad + 2;
/** cómo se reparten los bloques: la fila más alta con la que caben las dos columnas, o null si no caben ni con la más baja */
export function planApercibidos(equipos) {
  if (!equipos || !equipos.length) return null;
  for (const R of [88, 78, 68, 60, 54, 48]) {
    const alto = (xs) => xs.reduce((s, e) => s + altoBloque(e, R), 0) + AP.gap * Math.max(0, xs.length - 1);
    if (equipos.length === 1) { if (alto(equipos) <= AP.alto) return { R, cols: [equipos], max: alto(equipos) }; continue; }
    // el corte que deja las dos columnas más parejas, sin cambiar el orden
    let mejor = null;
    for (let k = 1; k < equipos.length; k++) {
      const cols = [equipos.slice(0, k), equipos.slice(k)], max = Math.max(...cols.map(alto));
      if (!mejor || max < mejor.max) mejor = { R, cols, max };
    }
    if (mejor.max <= AP.alto) return mejor;
  }
  return null;
}

const ABV = { Portero: 'POR', Defensa: 'DEF', Centrocampista: 'MED', Delantero: 'DEL', Entrenador: 'ENT' };
function bloqueEquipo(x, y, w, e, R, oro) {
  const club = coloresClub(e.nombre || e.corto), H = Math.round(R * 0.7), h = altoBloque(e, R);
  let s = caja(x, y, w, h, { rx: 22, tinte: club.vivo, tinteOp: 0.3 });
  // cabecera del bloque: una banda con el color del club, el escudo y su nombre, y sobre la columna de las medias su rótulo
  const eh = H - 8, xe = x + 26 + Math.round(eh * 78 / 105) / 2, yh = y + 5 + eh / 2;
  s += `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${H - 4}" rx="16" fill="${club.vivo}" fill-opacity="0.28"/>`
    + escudo(e.escudo, xe, yh + 1, eh)
    + texto(e.escudo ? xe + eh * 0.4 + 12 : x + 28, yh + H * 0.22, mayus(e.corto), { px: Math.max(23, Math.round(H * 0.64)), peso: 800, espacio: 1.5, max: w - 190 });
  if (e.jugadores.some((j) => j.media)) s += texto(x + w - 26, yh + 8, 'MEDIA', { px: 20, peso: 700, color: '#fff', ancla: 'end', espacio: 1.5, opacidad: 0.75 });
  e.jugadores.forEach((j, i) => {
    const yy = y + H + 4 + i * R, cy = yy + R / 2, r = Math.round(R * 0.44), cx = x + 34 + r, tx = cx + r + 14;
    const pxN = Math.max(25, Math.round(R * 0.5)), pxM = Math.max(28, Math.round(R * 0.56));
    const abv = ABV[j.posicion] || j.posicion, xp = x + w - 26 - (j.media ? 80 : 0);
    s += (i ? `<rect x="${x + 24}" y="${yy}" width="${w - 48}" height="1" fill="#fff" fill-opacity="0.08"/>` : '')
      + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 2.5 })
      + texto(tx, cy + pxN * 0.34, nombreAjustado(j.nombre, pxN, xp - 70 - tx), { px: pxN, peso: 800, max: xp - 70 - tx })
      + (abv ? texto(xp, cy + 8, abv, { px: 22, peso: 700, color: TENUE, ancla: 'end', espacio: 1 }) : '');
    if (j.media) s += texto(x + w - 26, cy + pxM * 0.34, j.media, { px: pxM, peso: 900, color: `url(#${oro})`, ancla: 'end' });
  });
  return s;
}

export function svgApercibidos(d) {
  const plan = planApercibidos(d.equipos);
  const tit = aColor(AMBAR), oro = dorado();
  let s = tit.defs + oro.defs + fondo([[300, 40, 660, AMBAR, 0.16], [1050, 60, 520, AMBAR, 0.07]])
    + cabecera('APERCIBIDOS', tit.g, `JORNADA ${d.jornada}`, 'A UNA AMARILLA DE LA SANCIÓN');
  if (plan) {
    const y0 = AP.y0 + (AP.alto - plan.max) / 2;
    const una = plan.cols.length === 1;
    plan.cols.forEach((col, c) => {
      const x = una ? (ANCHO - AP.w) / 2 : AP.x[c];
      let y = y0;
      for (const e of col) { s += bloqueEquipo(x, y, AP.w, e, plan.R, oro.g); y += altoBloque(e, plan.R) + AP.gap; }
    });
  }
  return marco(s + marca(600, 650, { ancla: 'middle' }));
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
