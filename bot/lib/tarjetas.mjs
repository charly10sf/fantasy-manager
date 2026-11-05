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
import { ANCHO, ALTO, VERDE, MALO, AMBAR, TENUE, PANEL, LINEA, num1, millones, medir, B, texto, id, lineal, marco,
  escudo, caraCirculo, fondo, dorado, rojizo, aColor, caja, marca, pildora, anchoPildora, ESTADO_TARJETA } from './estilo.mjs';

export { ANCHO, ALTO, num1, millones };
const FUENTES = ['Inter-Regular.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'InterDisplay-Black.otf',
  'BarlowCondensed_600SemiBold.ttf', 'BarlowCondensed_700Bold.ttf', 'BarlowCondensed_800ExtraBold.ttf', 'BarlowCondensed_800ExtraBold_Italic.ttf', 'BarlowCondensed_900Black.ttf'].map((f) => new URL(`../fuentes/${f}`, import.meta.url).pathname);

const OSCURO = '#2a1c04', OSCURO2 = '#5a420f';      // la letra encima del oro (la de la última jornada en la carta)
const mayus = (s) => String(s || '').toUpperCase();

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas
/** cabecera de las tarjetas en lista: el titular grande en cursiva a la izquierda (como «MVP» en la carta) y dos líneas a la derecha */
function cabecera(titulo, grad, linea1, linea2, { maxTitulo = 680 } = {}) {
  return texto(44, 132, titulo, { px: 118, peso: 800, italica: true, color: `url(#${grad})`, max: maxTitulo })
    + (linea1 ? texto(1152, 98, linea1, { px: 34, peso: 700, espacio: 1.5, ancla: 'end', max: 1060 - maxTitulo }) : '')
    + (linea2 ? texto(1152, 130, linea2, { px: 20, peso: 600, color: TENUE, espacio: 3, ancla: 'end' }) : '');
}

/** caja inclinada con una cifra grande y su etiqueta debajo (la de la última jornada en la carta) */
function cajaCifra(x, y, w, h, valor, etiqueta, { relleno, tinta = OSCURO, tenue = OSCURO2, px = 60 } = {}) {
  const cx = x + w / 2, yv = y + h * 0.58;
  return caja(x, y, w, h, { relleno, borde: null })
    + texto(cx, yv, valor, { px, peso: 900, color: tinta, ancla: 'middle', max: w - 26 })
    + texto(cx, yv + px * 0.46, etiqueta, { px: Math.round(px * 0.3), peso: 700, color: tenue, ancla: 'middle', espacio: 1 });
}

/** una fila grande de jugador (resumen y bajas en lista): caja inclinada, puesto, cara, nombre y debajo el escudo y el equipo (o `sub`).
    `derecha` es lo que va al final (la caja de los puntos o la etiqueta del estado) y `wDer`, lo que ocupa */
function filaJugador(x, y, w, h, j, { puesto = null, derecha = '', wDer = 0, sub = null } = {}) {
  const k = Math.round(h * 0.12), club = coloresClub(j.club || j.equipo);
  const r = Math.round(h * 0.4), cx = x + (puesto != null ? 40 : 30) + r, cy = y + h / 2, tx = cx + r + 22;
  const maxT = x + w - k - 20 - wDer - 18 - tx;
  return caja(x, y, w, h, { k })
    + (puesto != null ? texto(x + k + 12, y + 34, String(puesto), { px: 26, peso: 900, color: TENUE }) : '')
    + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 3 })
    + texto(tx, cy - 2, mayus(j.nombre), { px: 42, peso: 800, max: maxT })
    + escudo(j.escudo, tx + 12, cy + 30, 28)
    + texto(tx + (j.escudo ? 32 : 0), cy + 38, mayus(sub ?? j.equipo), { px: 22, peso: 700, color: TENUE, espacio: 1, max: maxT - (j.escudo ? 32 : 0) })
    + derecha;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de final de partido
// d = { jornada, local, visitante } con cada lado { nombre, corto, goles, escudo (PNG), mejores: [{nombre, pts, cara}] (3),
//       peores: [...] (hasta 3, de más a menos malo: el primero es el que menos puntos ha sacado) }

/** una fila de la lista de un equipo: cara pequeña, nombre y puntos */
function fila(x, y, w, j, bueno, club) {
  const h = 56, k = 7, r = 25, cx = x + k + 10 + r, cy = y + h / 2;
  return caja(x, y, w, h, { k })
    + caraCirculo(j.cara, cx, cy, r, { aro: club.vivo, grosor: 2.5 })
    + texto(cx + r + 16, cy + 11, mayus(j.nombre), { px: 31, peso: 700, max: w - (cx + r + 16 - x) - 116 })
    + texto(x + w - 66, cy + 16, String(j.pts), { px: 46, peso: 900, color: bueno ? VERDE : MALO, ancla: 'end' })
    + texto(x + w - 22, cy + 14, 'PTS', { px: 17, peso: 700, color: TENUE, ancla: 'end', espacio: 1 });
}

/** la columna de un equipo: MEJORES (hasta 3) y PEORES (hasta 3) */
function columna(x, y, w, lado, club) {
  let s = texto(x + 8, y + 18, 'MEJORES', { px: 20, peso: 700, color: VERDE, espacio: 3 });
  lado.mejores.forEach((j, i) => { s += fila(x, y + 26 + i * 62, w, j, true, club); });
  const y2 = y + 26 + 3 * 62 + 4;
  if (lado.peores.length) {
    s += texto(x + 8, y2 + 18, 'PEORES', { px: 20, peso: 700, color: MALO, espacio: 3 });
    lado.peores.forEach((j, i) => { s += fila(x, y2 + 26 + i * 62, w, j, false, club); });
  }
  return s;
}

export function svgFinal(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  const oro = dorado();
  let s = oro.defs + fondo([[200, 110, 580, cL.vivo, 0.6], [1000, 110, 580, cV.vivo, 0.6]])
    + texto(600, 40, `LALIGA FANTASY · JORNADA ${d.jornada} · FINAL`, { px: 22, peso: 700, color: TENUE, ancla: 'middle', espacio: 3 })
    + escudo(L.escudo, 102, 110, 90) + escudo(V.escudo, 1098, 110, 90)
    + texto(166, 128, mayus(L.corto), { px: 54, peso: 800, max: 270 })
    + texto(1034, 128, mayus(V.corto), { px: 54, peso: 800, ancla: 'end', max: 270 })
    + texto(600, 160, `${L.goles}-${V.goles}`, { px: 140, peso: 800, italica: true, color: `url(#${oro.g})`, ancla: 'middle' })
    + `<rect x="44" y="178" width="1112" height="1.5" fill="${LINEA}"/>`;
  s += columna(44, 184, 544, L, cL) + columna(612, 184, 544, V, cV);
  return marco(s + marca(600, 652, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta de jugador (MVP y directo): la carta, en lib/carta.mjs.
// d = { jornada, etiqueta ('MVP · Barça 6-1 Alavés' o '¡DOBLETE! · …'), nombre, posicion, club: {nombre, corto, escudo},
//       cara, ptsJornada, total, media, ultimas: [[jornada, pts], …] (5), valor: [[ms, €], …] (30 días), valorHoy, cambio (% en 30 días) }
export const svgJugador = (d) => svgJugadorCarta(d);

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del resumen de la jornada (Carlos, 2 nov 23:28): los 6 mejores o los 6 peores, en dos columnas de 3. Los puntos, en la
// caja de oro de la carta (los mejores) o en una roja (los peores).
// d = { jornada, clave: 'mejores'|'peores', filas: [{ nombre, equipo, club (nombre largo), pts, cara (PNG), escudo (PNG) }] (6) }
export function svgResumen(d) {
  const bueno = d.clave === 'mejores';
  const tit = bueno ? dorado() : rojizo();
  const gR = id('rc');
  let s = tit.defs + `<defs>${lineal(gR, [[0, '#ff6b78'], [1, '#b3122a']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`
    + fondo(bueno ? [[300, 40, 660, VERDE, 0.2], [1050, 60, 520, '#e2bd5a', 0.14]] : [[300, 40, 660, MALO, 0.24], [1050, 60, 520, MALO, 0.1]])
    + cabecera(bueno ? 'LOS MEJORES' : 'LOS PEORES', tit.g, 'DE LA JORNADA', `LALIGA FANTASY · JORNADA ${d.jornada}`);
  const w = 544, h = 128, x0 = [44, 612], y0 = 174, wb = 112;
  d.filas.slice(0, 6).forEach((j, i) => {
    const x = x0[Math.floor(i / 3)], y = y0 + (i % 3) * (h + 14);
    const bx = x + w - 16 - wb;
    const pts = cajaCifra(bx, y + 14, wb, h - 28, String(j.pts), 'PTS', bueno ? { relleno: `url(#${tit.g})` } : { relleno: `url(#${gR})`, tinta: '#fff', tenue: '#ffd3d8' });
    s += filaJugador(x, y, w, h, j, { puesto: i + 1, derecha: pts, wDer: wb });
  });
  return marco(s + marca(600, 646, { ancla: 'middle' }));
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
const colPct = (q) => (q == null ? null : q >= 75 ? VERDE : q >= 50 ? AMBAR : MALO);
function campo(x, y, w, h, lado, club, confirmados) {
  const g = id('cp');
  const lc = 'stroke="#ffffff" stroke-opacity="0.13" stroke-width="2" fill="none"';
  let s = `<defs>${lineal(g, [[0, club.vivo, 0.32], [1, PANEL, 1]])}</defs>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${PANEL}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="url(#${g})" stroke="${LINEA}" stroke-width="1.5"/>`;
  // franjas de césped, muy suaves
  for (let k = 0; k < 6; k++) if (k % 2) s += `<rect x="${x}" y="${y + k * h / 6}" width="${w}" height="${h / 6}" fill="#ffffff" opacity="0.025"/>`;
  // líneas: borde, medio campo arriba con su círculo, área grande, área pequeña y punto de penalti abajo
  s += `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="8" ${lc}/>`
    + `<path d="M${x + w * 0.34},${y + 10} A${w * 0.16},${w * 0.16} 0 0 0 ${x + w * 0.66},${y + 10}" ${lc}/>`
    + `<rect x="${x + w * 0.2}" y="${y + h - 10 - 96}" width="${w * 0.6}" height="96" ${lc}/>`
    + `<rect x="${x + w * 0.36}" y="${y + h - 10 - 36}" width="${w * 0.28}" height="36" ${lc}/>`
    + `<path d="M${x + w * 0.4},${y + h - 106} A${w * 0.11},${w * 0.07} 0 0 1 ${x + w * 0.6},${y + h - 106}" ${lc}/>`;
  const lineas = lineasDe(lado).reverse();
  const alto = (h - 24) / lineas.length;
  lineas.forEach((ls, i) => {
    const cy = y + 14 + alto * i + alto * 0.3;
    ls.forEach((j, k) => {
      // con 4 o 5 en una línea, repartidos de borde a borde: con w/(n+1) los centros quedaban a 89 px y los nombres se pisaban
      // («Bernardo Silva» con Bellingham y Tchouaméni, 3 nov). El nombre, como mucho el hueco entre centros menos 10 px (con Inter
      // llevaba un 10 % de margen porque el ancho medido se quedaba corto; con Barlow en mayúsculas se pasa un poco, no hace falta)
      const n = ls.length, paso = n >= 4 ? (w - 36) / n : w / (n + 1);
      const cx = n >= 4 ? x + 18 + paso * (k + 0.5) : x + paso * (k + 1);
      const maxN = Math.min(130, paso - 10);
      const pctCol = colPct(j.pct);
      const chapa = (jj, cxx, r) => `<circle cx="${cxx}" cy="${cy + 3}" r="${r + 1}" fill="#000" opacity="0.35"/>`
        + (jj.cara ? caraCirculo(jj.cara, cxx, cy, r, { aro: jj.duda ? AMBAR : club.vivo, grosor: 2.5 })
          : `<circle cx="${cxx}" cy="${cy}" r="${Math.round(r * 0.6)}" fill="${club.vivo}" stroke="${jj.duda ? AMBAR : '#ffffff'}" stroke-width="2.5"/>`);
      if (j.alt && !confirmados) {
        // dos opciones para el mismo puesto: las dos caras y debajo cada nombre con su %
        s += chapa(j.alt, cx + 24, 22) + chapa(j, cx - 24, 22)
          + texto(cx, cy + 42, mayus(`${j.nombre} ${j.pct} %`), { px: 18, peso: 700, color: pctCol, ancla: 'middle', max: maxN })
          + texto(cx, cy + 62, mayus(`${j.alt.nombre} ${j.alt.pct} %`), { px: 18, peso: 700, color: colPct(j.alt.pct), ancla: 'middle', max: maxN });
        return;
      }
      s += chapa(j, cx, 28)
        + texto(cx, cy + 49, mayus(j.nombre), { px: 21, peso: 700, ancla: 'middle', max: maxN });
      if (pctCol && !confirmados) {
        // el %, en una etiqueta rellena con la letra oscura (como la del estado en la carta)
        const t = `${j.pct} %`, wp = medir(t, 17, B, 0.5) + 20;
        s += `<rect x="${cx - wp / 2}" y="${cy + 55}" width="${wp}" height="22" rx="11" fill="${pctCol}"/>`
          + texto(cx, cy + 72, t, { px: 17, peso: 800, color: '#120f16', ancla: 'middle', espacio: 0.5 });
      }
    });
  });
  s += texto(x + 26, y + h - 24, lado.formacion || '', { px: 28, peso: 800, espacio: 2 });
  return s;
}
export function svgOnces(d) {
  const L = d.local, V = d.visitante;
  const cL = coloresClub(L.nombre), cV = coloresClub(V.nombre);
  const tit = d.confirmados ? aColor(VERDE) : dorado();
  let s = tit.defs + fondo([[200, 70, 580, cL.vivo, 0.55], [1000, 70, 580, cV.vivo, 0.55]])
    + escudo(L.escudo, 84, 88, 76) + escudo(V.escudo, 1116, 88, 76)
    + texto(138, 108, mayus(L.corto), { px: 48, peso: 800, max: 270 })
    + texto(1062, 108, mayus(V.corto), { px: 48, peso: 800, ancla: 'end', max: 270 })
    + texto(600, 96, d.confirmados ? 'ONCES CONFIRMADOS' : 'POSIBLES ONCES', { px: 66, peso: 800, italica: true, color: `url(#${tit.g})`, ancla: 'middle', max: 330 })
    + texto(600, 128, `JORNADA ${d.jornada}`, { px: 20, peso: 700, color: TENUE, ancla: 'middle', espacio: 3 });
  s += campo(44, 146, 544, 482, L, cL, d.confirmados) + campo(612, 146, 544, 482, V, cV, d.confirmados);
  return marco(s + marca(600, 658, { ancla: 'middle' }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Tarjeta del mercado de cada noche (Carlos, 3 nov 06:56: «top 5 subidas y bajadas»): dos columnas, subidas en verde y bajadas en rojo.
// d = { fecha: '3 de noviembre', suben: [fila] (5), bajan: [fila] (5) } con fila = { nombre, equipo, club, cara (PNG), escudo (PNG),
//       dif: '+2,3 M', pct: '+2,3 %', valor: '102 M' }
export function svgMercado(d) {
  const oro = dorado();
  let s = oro.defs + fondo([[260, 40, 640, VERDE, 0.2], [980, 40, 640, MALO, 0.2]])
    + cabecera('MERCADO', oro.g, mayus(d.fecha), 'LALIGA FANTASY');
  const w = 544, h = 76, gap = 8, y0 = 188, k = Math.round(h * 0.12);
  const col = (x, lista, bueno) => {
    const acento = bueno ? VERDE : MALO;
    let t = `<rect x="${x + 4}" y="${y0 - 36}" width="6" height="22" rx="2" fill="${acento}"/>`
      + texto(x + 18, y0 - 17, bueno ? 'SUBEN' : 'BAJAN', { px: 22, peso: 700, color: acento, espacio: 3 });
    lista.slice(0, 5).forEach((f, i) => {
      const y = y0 + i * (h + gap), cy = y + h / 2, r = 32, cx = x + 42 + r;
      const club = coloresClub(f.club || f.equipo);
      const xd = x + w - k - 16;
      t += caja(x, y, w, h, { k })
        + texto(x + k + 10, cy + 9, String(i + 1), { px: 26, peso: 900, color: TENUE })
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, grosor: 2.5 })
        + texto(cx + r + 16, cy - 2, mayus(f.nombre), { px: 32, peso: 800, max: 220 })
        + escudo(f.escudo, cx + r + 26, cy + 21, 20)
        + texto(cx + r + (f.escudo ? 42 : 16), cy + 28, mayus(f.equipo), { px: 19, peso: 700, color: TENUE, espacio: 1, max: 180 })
        + texto(xd, cy + 6, f.dif, { px: 42, peso: 900, color: acento, ancla: 'end' })
        + texto(xd, cy + 29, `${f.pct} · ${f.valor}`, { px: 20, peso: 700, color: TENUE, ancla: 'end' });
    });
    return t;
  };
  s += col(44, d.suben, true) + col(612, d.bajan, false);
  return marco(s + marca(600, 650, { ancla: 'middle' }));
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
  let s = tit.defs;
  if (d.equipo) {
    const club = coloresClub(d.equipo.nombre || d.equipo.corto);
    const cR = d.rival ? coloresClub(d.rival.nombre || d.rival.corto) : null;
    s += fondo([[160, 80, 660, club.vivo, 0.6], ...(cR ? [[1080, 100, 320, cR.vivo, 0.3]] : [])])
      + escudo(d.equipo.escudo, 100, 108, 116);
    const xt = d.equipo.escudo ? 180 : 48;
    s += texto(xt - 4, 118, d.titulo, { px: 96, peso: 800, italica: true, color: `url(#${tit.g})`, max: d.rival ? 640 : 960 })
      + texto(xt, 164, `${mayus(d.equipo.corto)} · JORNADA ${d.jornada}`, { px: 32, peso: 700, espacio: 1.5, max: d.rival ? 600 : 960 });
    if (d.rival) {
      s += texto(1152, 84, 'PRÓXIMO RIVAL', { px: 20, peso: 700, color: TENUE, ancla: 'end', espacio: 3 })
        + escudo(d.rival.escudo, 1126, 130, 52)
        + texto(d.rival.escudo ? 1090 : 1152, 145, mayus(d.rival.corto), { px: 42, peso: 800, ancla: 'end', max: 300 });
    }
    // filas grandes: 1 a 4, entre y = 194 y 606
    const n = filas.length, gap = 12, alto = 412;
    const h = n === 1 ? 190 : Math.min(130, (alto - gap * (n - 1)) / n);
    const y0 = n === 1 ? 194 + (alto - h) / 2 : 194;
    const w = 1112, x = 44;
    filas.forEach((f, i) => {
      const y = y0 + i * (h + gap), cy = y + h / 2, k = Math.round(h * 0.12);
      const r = Math.round(h * 0.4), cx = x + k + 18 + r;
      const pxN = Math.round(Math.min(50, h * 0.38)), pxS = Math.round(Math.min(25, h * 0.2)), pxP = Math.round(Math.min(26, h * 0.21));
      const sub = [f.posicion, f.media ? `${f.media} pts de media` : null].filter(Boolean).join(' · ');
      const wp = anchoPildora(f, pxP);
      s += caja(x, y, w, h, { k })
        + `<path d="M${x + k},${y} L${x + k + 7},${y} L${x + 7},${y + h} L${x},${y + h} Z" fill="${ESTADO_TARJETA[f.estado].color}"/>`
        + caraCirculo(f.cara, cx, cy, r, { aro: club.vivo, grosor: 3 })
        + texto(cx + r + 24, sub ? cy - pxS * 0.15 : cy + pxN * 0.35, mayus(f.nombre), { px: pxN, peso: 800, max: 620 })
        + (sub ? texto(cx + r + 24, cy + pxS * 1.5, mayus(sub), { px: pxS, peso: 700, color: TENUE, espacio: 1, max: 620 }) : '')
        + pildora(f, x + w - k - 24 - wp / 2, cy, pxP, 420);
    });
  } else {
    s += fondo([[300, 40, 660, tono, 0.22], [1050, 60, 520, tono, 0.1]])
      + cabecera(d.titulo, tit.g, `JORNADA ${d.jornada}`, 'LALIGA FANTASY');
    const h = 128, gap = 14, x0 = [44, 612], y0 = 174;
    const enUna = filas.length <= 3;              // con 3 o menos, una columna ancha
    const pxP = enUna ? 24 : 19;
    const porCol = enUna ? filas.length : Math.ceil(filas.length / 2);   // 4 -> 2 y 2, 5 -> 3 y 2, 6 -> 3 y 3
    filas.forEach((f, i) => {
      const x = enUna ? 44 : x0[Math.floor(i / porCol)], ww = enUna ? 1112 : 544;
      const y = y0 + (3 - porCol) * (h + gap) / 2 + (enUna ? i : i % porCol) * (h + gap);
      const k = Math.round(h * 0.12), wp = anchoPildora(f, pxP);
      const pil = pildora(f, x + ww - k - 20 - wp / 2, y + h / 2, pxP, 400);
      s += filaJugador(x, y, ww, h, f, { derecha: pil, wDer: wp, sub: f.media && enUna ? `${f.equipo} · ${f.media} pts de media` : f.equipo });
    });
  }
  return marco(s + marca(600, 650, { ancla: 'middle' }));
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
