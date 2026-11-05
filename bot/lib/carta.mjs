// La carta de coleccionista (diseño propio, Carlos, 3 nov 10:44-11:11) para las tarjetas que hablan de UN jugador concreto:
// la de jugador (MVP y directo) y la de una baja o novedad de un solo jugador. Las demás (tarjetas.mjs) llevan desde el 5 nov su
// misma letra y estética (estilo.mjs). Letra Barlow Condensed (OFL, en fuentes/; tarjetas.mjs la carga en aPng) y titulares en dorado.
// El metal de la carta va por lo bueno que es el jugador, medido por su valor de mercado (`metalDe`): leyenda (negra con oro,
// 90 M o más: Lamine Yamal, Mbappé…), oro (35-90 M), plata (10-35 M) y bronce (menos de 10 M: un reserva del Málaga).
// Mismos datos que antes (datos-tarjetas.mjs) y mismo validador: las palabras nuevas están en PALABRAS_FIJAS.
// Las piezas comunes (letra, fondo, degradados, marca, etiquetas de estado) están en estilo.mjs, compartidas con tarjetas.mjs.
import { coloresClub } from './colores.mjs';
import { ANCHO, ROJO, VERDE, MALO, TINTA, TENUE, FONDO, PANEL, LINEA, B, num1, millones, signo, medir, texto, id, lineal, radial, marco,
  escudo, caraFundida, fondo, dorado, marca, ESTADO_TARJETA, pildora } from './estilo.mjs';

const ABREV = { Portero: 'POR', Defensa: 'DEF', Centrocampista: 'MED', Delantero: 'DEL', Entrenador: 'ENT' };

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
    + historial(x0, wd, d, oro.g);
  s += marca(x0, 636);
  return marco(s);
}



/** un solo jugador: la carta grande a la izquierda y, a la derecha, su estado en grande, el equipo y el próximo rival */
/** a la derecha de una carta: los puntos de las últimas jornadas y el valor de los últimos días con su gráfica */
function historial(x0, wd, d, gOro) {
  const yv = 478, colV = d.cambio > 0 ? VERDE : d.cambio < 0 ? MALO : TENUE;
  return texto(x0, 296, 'PUNTOS EN LAS ÚLTIMAS JORNADAS', { px: 20, peso: 700, color: TENUE, espacio: 3 })
    + miniJornadas(x0, 312, d.ultimas, gOro)
    + texto(x0, yv, `VALOR · ${d.dias} DÍAS`, { px: 20, peso: 700, color: TENUE, espacio: 3 })
    + texto(x0, yv + 50, millones(d.valorHoy), { px: 52, peso: 800 })
    + texto(x0 + 170, yv + 46, `${signo(d.cambio)} %`, { px: 34, peso: 800, color: colV })
    + graficaValor(x0 + 290, yv + 6, wd - 290, 62, d.valor, d.cambio < 0 ? MALO : '#e2bd5a');
}

// Baja o novedad de un solo jugador: la carta (media, puntos totales, valor y su estado) y, a la derecha, el estado en grande, el
// equipo y la jornada, el próximo rival, los puntos de las últimas jornadas y el valor (Carlos, 3 nov 11:24). Si no llegan las
// últimas jornadas (no se encontró al jugador), solo el estado y el próximo rival en grande.
export function svgBajaSola(d) {
  const f = d.filas[0];
  const e = ESTADO_TARJETA[f.estado], club = coloresClub(f.club || f.equipo);
  const g = id('ge'), oro = dorado();
  const metal = METAL[metalDe(f.valorHoy || f.valor)];
  let s = oro.defs + `<defs>${lineal(g, [[0, '#ffffff'], [0.45, e.color], [1, e.color]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`
    + fondo([[300, 330, 560, club.vivo, 0.75], [1050, 80, 500, e.color, 0.16]]);
  const x = 96, y = 36, w = 404, h = 600, x0 = 566, wd = ANCHO - x0 - 56;
  const media = f.ultimas ? num1(f.media) : f.media;
  const grande = f.estado === 'duda' && f.leve ? 'DUDA LEVE' : f.estado === 'duda' && f.pct != null ? `DUDA · ${f.pct} %` : e.txt;
  s += texto(x0 - 4, 158, grande, { px: 140, peso: 800, italica: true, color: `url(#${g})`, max: wd })
    + texto(x0, 206, `${(f.equipo || '').toUpperCase()} · JORNADA ${d.jornada}`, { px: 34, peso: 700, espacio: 1.5, max: wd });
  if (f.ultimas) {
    const C = carta(x, y, w, h, { metal, club, cara: f.cara, escudo: f.escudo || (d.equipo && d.equipo.escudo),
      grande: media, bajoGrande: 'MEDIA', nombre: f.nombre });
    const yc = C.yNombre + 66, xs = [x + w * 0.29, x + w * 0.71];
    s += C.s
      + cifra(xs[0], yc, String(f.total), 'PUNTOS TOTALES', { px: 40, color: metal.tinta, tenue: metal.tenue, max: 160 })
      + cifra(xs[1], yc, millones(f.valorHoy), 'VALOR', { px: 40, color: metal.tinta, tenue: metal.tenue, max: 160 })
      + `<rect x="${x + w / 2 - 0.75}" y="${yc - 34}" width="1.5" height="56" fill="${metal.linea}"/>`
      + pildora(f, x + w / 2, yc + 70, 26, w - 80);
    // el próximo rival, en una línea
    if (d.rival) {
      const wr = medir('PRÓXIMO RIVAL', 20, B, 3);
      s += texto(x0, 240, 'PRÓXIMO RIVAL', { px: 20, peso: 700, color: TENUE, espacio: 3 })
        + escudo(d.rival.escudo, x0 + wr + 22, 233, 30)
        + texto(x0 + wr + (d.rival.escudo ? 44 : 14), 241, d.rival.corto.toUpperCase(), { px: 26, peso: 800, max: wd - wr - 50 });
    } else s += texto(x0, 238, 'LALIGA FANTASY', { px: 20, peso: 600, color: TENUE, espacio: 3 });
    s += historial(x0, wd, f, oro.g);
    return marco(s + marca(x0, 636));
  }
  const C = carta(x, y, w, h, { metal, club, cara: f.cara, escudo: f.escudo || (d.equipo && d.equipo.escudo),
    grande: media || null, bajoGrande: media ? 'MEDIA' : (ABREV[f.posicion] || null), nombre: f.nombre, lineas: [f.posicion].filter(Boolean), yNombre: 0.7 });
  s += C.s + pildora(f, x + w / 2, C.yNombre + 112, 30, w - 60)
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

