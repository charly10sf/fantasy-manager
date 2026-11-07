// La carta (diseño propio, Carlos, 3 nov 10:44-11:11; en HD desde el 7 nov, más abajo) para las tarjetas que hablan de UN jugador concreto:
// la de jugador (MVP y directo) y la de una baja o novedad de un solo jugador. Las demás (tarjetas.mjs) llevan desde el 5 nov su
// misma letra y estética (estilo.mjs). Letra Barlow Condensed (OFL, en fuentes/; tarjetas.mjs la carga en aPng) y titulares en dorado.
// El metal de la carta va por lo bueno que es el jugador, medido por su valor de mercado (`metalDe`): leyenda (negra con oro,
// 90 M o más: Lamine Yamal, Mbappé…), oro (35-90 M), plata (10-35 M) y bronce (menos de 10 M: un reserva del Málaga).
// Mismos datos que antes (datos-tarjetas.mjs) y mismo validador: las palabras nuevas están en PALABRAS_FIJAS.
// Las piezas comunes (letra, fondo, degradados, marca, etiquetas de estado) están en estilo.mjs, compartidas con tarjetas.mjs.
import { coloresClub } from './colores.mjs';
import { ANCHO, ROJO, VERDE, MALO, TINTA, TENUE, FONDO, B, num1, millones, signo, medir, texto, id, lineal, radial, marco,
  escudo, fondo, dorado, marca, ESTADO_TARJETA, pildoraTit, chip, caja, caraHD, panel, R_MAX } from './estilo.mjs';

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


// 7 nov (Carlos: «rediseña todas las tarjetas para HD»): la carta deja de ser una carta recortada con la foto a 350 lógicos (la foto de
// LaLiga, de 256 px, salía a ~700 en el PNG a 2400 y se veía blanda) y pasa al estilo de la de onces: un panel con el brillo del club y
// el filo del metal, la cara con la cabeza entera (radio 64, ~294 px en el PNG) y el halo del club, el nombre grande y las cifras debajo.
// El metal (por el valor de mercado) sigue: es el filo del panel y el aro de la cara. El valor y su % van solo a la derecha, con la
// gráfica (antes salían también en la carta). 1200 x 860.
export const ALTO_CARTA = 860;
const ALTO_CARTA_CORTA = 820;

/** el degradado del metal (para el aro y el filo) */
function gradMetal(t) { const g = id('mt'); return { g, defs: `<defs>${lineal(g, t.borde, { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` }; }

/** el panel del jugador: escudo, puesto, la cara, el nombre y `cifras` ([[valor, etiqueta, color]] en filas de dos) o `abajo` (SVG) */
function panelJugador(x, y, w, h, o) {
  const t = o.metal, gm = gradMetal(t), cx = x + w / 2, cy = y + 150, R = R_MAX;
  let s = gm.defs + panel(x, y, w, h, o.club.vivo, { rx: 32, brillo: 0.5, borde: `url(#${gm.g})` })
    + caraHD(o.cara, cx, cy, R, o.club.vivo, { aro: `url(#${gm.g})`, grosor: 6, halo: 1.9, haloOp: 0.5 });
  if (o.escudo) s += escudo(o.escudo, x + 58, y + 62, 70);
  if (o.puesto) s += chip(o.puesto, x + w - 58, y + 58, 26, { relleno: '#ffffff', tinta: '#120f16', pad: 1.6, espacio: 1.5 }).s;
  const yN = cy + R + 76;
  s += texto(cx, yN, String(o.nombre).toUpperCase(), { px: 56, peso: 800, ancla: 'middle', max: w - 48, espacio: 0.5 })
    + (o.linea ? texto(cx, yN + 40, o.linea, { px: 26, peso: 700, color: TENUE, ancla: 'middle', espacio: 1.5, max: w - 48 }) : '')
    + `<rect x="${x + 40}" y="${yN + (o.linea ? 62 : 24)}" width="${w - 80}" height="1.5" fill="#fff" fill-opacity="0.12"/>`;
  const filas = [];
  for (let i = 0; i < (o.cifras || []).length; i += 2) filas.push(o.cifras.slice(i, i + 2));
  const y0 = yN + (o.linea ? 62 : 24) + 64;
  filas.forEach((f, r) => {
    const yc = y0 + r * 92;
    f.forEach(([v, et, color], k) => {
      const xc = f.length === 1 ? cx : x + w * (k ? 0.73 : 0.27);
      s += texto(xc, yc, v, { px: 48, peso: 900, color: color || TINTA, ancla: 'middle', max: w / 2 - 30 })
        + texto(xc, yc + 30, et, { px: 21, peso: 700, color: TENUE, ancla: 'middle', espacio: 1.5, max: w / 2 - 30 });
    });
  });
  if (filas.length) s += `<rect x="${cx - 0.75}" y="${y0 - 40}" width="1.5" height="${filas.length * 92 - 20}" fill="#fff" fill-opacity="0.12"/>`;
  return s + (o.abajo ? o.abajo(filas.length ? y0 + filas.length * 92 - 50 : y0 - 58) : '');
}

/** la cifra grande de arriba a la derecha, en una placa de oro: los puntos de la jornada (PTS) o la media (MEDIA) */
function placa(valor, etiqueta, gOro) {
  const x = 950, y = 44, w = 206, h = 196;
  return `<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="30" fill="#000" opacity="0.4"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" fill="url(#${gOro})"/>`
    + `<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="28.5" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="2"/>`
    + texto(x + w / 2, y + 128, valor, { px: 120, peso: 900, color: '#2a1c04', ancla: 'middle', max: w - 30 })
    + (etiqueta ? texto(x + w / 2, y + 170, etiqueta, { px: 28, peso: 800, color: '#5a420f', ancla: 'middle', espacio: 3 }) : '');
}

/** la placa de un partido en juego: el minuto grande y «EN JUEGO» con el punto rojo de directo (sin oro: no es un dato del jugador) */
function placaVivo(minuto, { x = 950, y = 44, w = 206, h = 196 } = {}) {
  const wt = medir('EN JUEGO', 26, B, 3), x0 = x + w / 2 - (wt + 26) / 2;
  return `<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="30" fill="#000" opacity="0.4"/>`
    + caja(x, y, w, h, { rx: 30, relleno: '#16141c', borde: ROJO, grosor: 2.5, sombra: false })
    + texto(x + w / 2, y + 120, minuto, { px: 96, peso: 900, ancla: 'middle', max: w - 30 })
    + `<circle cx="${x0 + 8}" cy="${y + 160}" r="8" fill="${ROJO}"/>`
    + texto(x0 + 26, y + 169, 'EN JUEGO', { px: 26, peso: 800, color: ROJO, espacio: 3 });
}

function miniJornadas(x, y, ultimas, gOro, { sinHoy = false } = {}) {
  let s = '';
  const n = ultimas.length || 1, paso = 566 / Math.max(5, n), w = paso - 14, h = 132;
  ultimas.forEach(([jn, p], i) => {
    const x0 = x + i * paso, ult = !sinHoy && i === ultimas.length - 1;   // sin puntos aún en directo, ninguna en oro
    s += caja(x0, y, w, h, { rx: 20, relleno: ult ? `url(#${gOro})` : null, sombra: true })
      + texto(x0 + w / 2, y + 76, String(p), { px: 66, peso: 900, color: ult ? '#2a1c04' : p < 0 ? MALO : TINTA, ancla: 'middle', max: w - 12 })
      + texto(x0 + w / 2, y + 112, `J${jn}`, { px: 26, peso: 700, color: ult ? '#5a420f' : TENUE, ancla: 'middle', espacio: 1 });
  });
  return s;
}
function graficaValor(x, y, w, h, valor, color) {
  if (!valor || valor.length < 2) return texto(x, y + h / 2, 'Sin histórico de valor', { px: 26, peso: 600, color: TENUE });
  const vs = valor.map(([, v]) => v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
  const t0 = valor[0][0], t1 = valor[valor.length - 1][0];
  const px = (t) => x + (t - t0) / ((t1 - t0) || 1) * w, py = (v) => y + h - (v - min) / rango * h;
  const pts = valor.map(([t, v]) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const g = id('gv');
  const [ux, uy] = [px(t1), py(vs[vs.length - 1])];
  return `<defs>${lineal(g, [[0, color, 0.35], [1, color, 0]])}</defs>`
    + [0, 0.5, 1].map((f) => `<rect x="${x}" y="${(y + h * f).toFixed(1)}" width="${w}" height="1" fill="#fff" opacity="0.08"/>`).join('')
    + `<polygon points="${x},${y + h} ${pts} ${ux},${y + h}" fill="url(#${g})"/>`
    + `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<circle cx="${ux}" cy="${uy}" r="8" fill="${color}" stroke="${FONDO}" stroke-width="3"/>`;
}
/** a la derecha del panel: los puntos de las últimas jornadas y el valor de los últimos días con su gráfica */
function historial(x0, y0, d, gOro) {
  const wd = 566, colV = d.cambio > 0 ? VERDE : d.cambio < 0 ? MALO : TENUE, yv = y0 + 240;
  const val = millones(d.valorHoy), wv = medir(val, 64, B);
  const pc = chip(`${signo(d.cambio)} %`, 0, 0, 30, { relleno: colV, pad: 1.5, espacio: 0.5 });
  return texto(x0, y0 + 24, 'PUNTOS EN LAS ÚLTIMAS JORNADAS', { px: 25, peso: 700, color: TENUE, espacio: 3, max: wd })
    + miniJornadas(x0, y0 + 44, d.ultimas, gOro, { sinHoy: !!d.sinPuntos })
    + texto(x0, yv, `VALOR · ${d.dias} DÍAS`, { px: 25, peso: 700, color: TENUE, espacio: 3 })
    + texto(x0, yv + 62, val, { px: 64, peso: 800 })
    + chip(`${signo(d.cambio)} %`, x0 + wv + 24 + pc.w / 2, yv + 44, 30, { relleno: colV, pad: 1.5, espacio: 0.5 }).s
    + graficaValor(x0, yv + 100, wd, 130, d.valor, d.cambio < 0 ? MALO : '#e2bd5a');
}

/** cabecera de la carta: el motivo en grande (MVP, ¡DOBLETE!, PENALTI PARADO, LESIONADO…) y dos líneas debajo */
function cabeceraCarta(titulo, grad, linea1, linea2 = '') {
  return texto(40, 150, titulo, { px: 140, peso: 800, italica: true, color: `url(#${grad})`, max: 880 })
    + texto(44, 204, linea1, { px: 38, peso: 700, espacio: 1.5, max: 880 })
    + (typeof linea2 === 'string' ? (linea2 ? texto(44, 244, linea2, { px: 24, peso: 700, color: TENUE, espacio: 3, max: 880 }) : '') : linea2.svg);
}

export function svgJugadorCarta(d) {
  const c = coloresClub(d.club.nombre), H = ALTO_CARTA;
  const oro = dorado(), metal = METAL[metalDe(d.valorHoy)];
  const [motivo, ...resto] = d.etiqueta.split(' · ');
  let s = oro.defs + fondo([[300, 520, 640, c.vivo, 0.6], [1000, 80, 560, c.vivo, 0.2]], H)
    + cabeceraCarta(motivo.toUpperCase(), oro.g, [...resto, ...(d.minuto && !d.sinPuntos ? [d.minuto] : [])].join(' · ').toUpperCase(), `LALIGA FANTASY · JORNADA ${d.jornada}`)
    // en directo y sin puntos todavía (LaLiga no ha sumado la jugada): arriba el minuto «EN JUEGO» en vez de un «0 PTS»
    + (d.sinPuntos ? (d.minuto ? placaVivo(d.minuto) : '') : placa(String(d.ptsJornada), 'PTS', oro.g))
    + panelJugador(44, 284, 500, 490, { metal, club: c, cara: d.cara, escudo: d.club.escudo, puesto: ABREV[d.posicion] || d.posicion, nombre: d.nombre,
      cifras: [[num1(d.media), 'PUNTOS DE MEDIA'], [String(d.total), 'PUNTOS TOTALES']] })
    + historial(590, 300, d, oro.g);
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// Baja o novedad de un solo jugador (Carlos, 3 nov 11:24): el estado en grande, el equipo y la jornada, el próximo rival, el panel del
// jugador (puntos totales, valor y, si lo hay, el % de titularidad) y a la derecha sus últimas jornadas y su valor. Si no llegan las
// últimas jornadas (no se encontró al jugador), el panel y el próximo rival en grande, en una tarjeta más baja.
// (Carlos, 5 nov 16:39 y 17:08) el estado, arriba y en grande, y una sola vez; abajo, el % de titularidad de la app (de uno que vuelve o
// de una duda), en el color del %. Sin %, abajo no va nada
export function svgBajaSola(d) {
  const f = d.filas[0];
  const e = ESTADO_TARJETA[f.estado], club = coloresClub(f.club || f.equipo);
  const g = id('ge'), oro = dorado();
  const metal = METAL[metalDe(f.valorHoy || f.valor)];
  const H = f.ultimas ? ALTO_CARTA : ALTO_CARTA_CORTA;
  let s = oro.defs + `<defs>${lineal(g, [[0, '#ffffff'], [0.45, e.color], [1, e.color]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`
    + fondo([[300, 520, 640, club.vivo, 0.6], [1000, 80, 560, e.color, 0.16]], H);
  const media = f.ultimas ? num1(f.media) : f.media;
  const grande = f.estado === 'duda' && f.leve ? 'DUDA LEVE' : e.txt;
  const abajo = (yy) => (f.pct != null ? pildoraTit(f.pct, 44 + 250, yy + 34, 28, 420) : '');
  // el próximo rival, en una línea bajo la cabecera
  let rival = texto(44, 244, 'LALIGA FANTASY', { px: 24, peso: 700, color: TENUE, espacio: 3 });
  if (d.rival && f.ultimas) {
    const wr = medir('PRÓXIMO RIVAL', 24, B, 3);
    rival = texto(44, 246, 'PRÓXIMO RIVAL', { px: 24, peso: 700, color: TENUE, espacio: 3 })
      + escudo(d.rival.escudo, 44 + wr + 26, 237, 36)
      + texto(44 + wr + (d.rival.escudo ? 52 : 16), 248, d.rival.corto.toUpperCase(), { px: 32, peso: 800, max: 860 - wr - 60 });
  }
  s += cabeceraCarta(grande, g, `${(f.equipo || '').toUpperCase()} · JORNADA ${d.jornada}`, { svg: rival });
  if (media) s += placa(String(media), 'MEDIA', oro.g);
  const escudoF = f.escudo || (d.equipo && d.equipo.escudo);
  if (f.ultimas) {
    s += panelJugador(44, 284, 500, 490, { metal, club, cara: f.cara, escudo: escudoF, puesto: ABREV[f.posicion] || null, nombre: f.nombre,
      cifras: [[String(f.total), 'PUNTOS TOTALES']], abajo })
      + historial(590, 300, f, oro.g);
    return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
  }
  s += panelJugador(44, 284, 500, 456, { metal, club, cara: f.cara, escudo: escudoF, puesto: ABREV[f.posicion] || null, nombre: f.nombre,
    linea: f.posicion ? f.posicion.toUpperCase() : null, abajo });
  if (d.rival) {
    const cR = coloresClub(d.rival.nombre || d.rival.corto);
    s += radial(880, 480, 340, cR.vivo, 0.32, H)
      + texto(600, 380, 'PRÓXIMO RIVAL', { px: 26, peso: 700, color: TENUE, espacio: 3 })
      + escudo(d.rival.escudo, 650, 480, 120)
      + texto(600 + (d.rival.escudo ? 120 : 0), 506, d.rival.corto.toUpperCase(), { px: 76, peso: 800, max: 556 - (d.rival.escudo ? 120 : 0) });
  }
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// Gol y asistencia en una sola tarjeta (Carlos, 7 nov 14:53: «no tiene sentido dos»). Arriba, el GOL (o ¡DOBLETE!) con el marcador
// y el minuto; a la derecha, en directo, la placa del minuto «EN JUEGO». Debajo, dos paneles iguales: el goleador (filo de su metal y
// chip dorado GOL) y el asistente (chip blanco ASISTENCIA), con cara, nombre, sus puntos en la jornada (si LaLiga ya los ha sumado),
// la media, el valor y sus 5 últimas jornadas. 1200 x 1010.
export const ALTO_GOL_ASIS = 1010;
function panelDuo(x, y, w, h, j, rol, gOro) {
  const t = METAL[metalDe(j.valorHoy)], gm = gradMetal(t), c = coloresClub(j.club.nombre), cx = x + w / 2, cy = y + 150, R = R_MAX;
  let s = gm.defs + panel(x, y, w, h, c.vivo, { rx: 32, brillo: 0.5, borde: `url(#${gm.g})` })
    + caraHD(j.cara, cx, cy, R, c.vivo, { aro: `url(#${gm.g})`, grosor: 6, halo: 1.9, haloOp: 0.5 });
  if (j.club.escudo) s += escudo(j.club.escudo, x + 58, y + 62, 70);
  const pu = ABREV[j.posicion] || j.posicion;
  if (pu) s += chip(pu, x + w - 58, y + 58, 26, { relleno: '#ffffff', tinta: '#120f16', pad: 1.6, espacio: 1.5 }).s;
  const yN = cy + R + 74;
  s += texto(cx, yN, String(j.nombre).toUpperCase(), { px: 56, peso: 800, ancla: 'middle', max: w - 48, espacio: 0.5 });
  const esGol = rol !== 'ASISTENCIA';
  const ch = chip(rol, cx, yN + 44, 26, esGol ? { relleno: '#e2bd5a', tinta: '#2a1c04', pad: 1.8, espacio: 2 } : { relleno: '#ffffff', tinta: '#120f16', pad: 1.8, espacio: 2 });
  s += ch.s + `<rect x="${x + 40}" y="${yN + 82}" width="${w - 80}" height="1.5" fill="#fff" fill-opacity="0.12"/>`;
  // las cifras: puntos en la jornada (solo si ya los hay), media y valor
  const cifras = [];
  if (!j.sinPuntos) cifras.push([String(j.ptsJornada), 'EN LA JORNADA', j.ptsJornada < 0 ? MALO : '#e2bd5a']);
  cifras.push([num1(j.media), 'DE MEDIA'], [millones(j.valorHoy), 'VALOR']);
  const yc = yN + 160, paso = w / cifras.length;
  cifras.forEach(([v, et, color], k) => {
    const xc = x + paso * (k + 0.5);
    s += texto(xc, yc, v, { px: 50, peso: 900, color: color || TINTA, ancla: 'middle', max: paso - 24 })
      + texto(xc, yc + 32, et, { px: 20, peso: 700, color: TENUE, ancla: 'middle', espacio: 1.5, max: paso - 16 });
    if (k) s += `<rect x="${x + paso * k - 0.75}" y="${yc - 48}" width="1.5" height="86" fill="#fff" fill-opacity="0.12"/>`;
  });
  // sus últimas jornadas, pequeñas (la de hoy en oro si ya tiene puntos)
  const yM = yc + 70, n = j.ultimas.length || 1, pasoM = (w - 64) / Math.max(5, n), wm = pasoM - 10, hm = 96;
  j.ultimas.forEach(([jn, p], i) => {
    const x0 = x + 32 + i * pasoM, hoy = !j.sinPuntos && jn === j.jornada;
    s += caja(x0, yM, wm, hm, { rx: 16, relleno: hoy ? `url(#${gOro})` : null, sombra: true })
      + texto(x0 + wm / 2, yM + 56, String(p), { px: 46, peso: 900, color: hoy ? '#2a1c04' : p < 0 ? MALO : TINTA, ancla: 'middle', max: wm - 10 })
      + texto(x0 + wm / 2, yM + 84, `J${jn}`, { px: 20, peso: 700, color: hoy ? '#5a420f' : TENUE, ancla: 'middle', espacio: 1 });
  });
  return s;
}
export function svgGolAsistencia(d) {
  const H = ALTO_GOL_ASIS, oro = dorado();
  const cg = coloresClub(d.gol.club.nombre);
  let s = oro.defs + fondo([[320, 560, 620, cg.vivo, 0.5], [900, 560, 620, cg.vivo, 0.35]], H)
    // el minuto, en la placa si está en juego; si no, junto al marcador (una sola vez)
    + cabeceraCarta(d.titulo, oro.g, [d.marcador, ...(d.minuto && !d.enJuego ? [d.minuto] : [])].join(' · ').toUpperCase(), `LALIGA FANTASY · JORNADA ${d.jornada}`)
    + (d.enJuego && d.minuto ? placaVivo(d.minuto) : '')
    + panelDuo(44, 290, 540, 640, d.gol, d.titulo.replace(/[¡!]/g, ''), oro.g)
    + panelDuo(616, 290, 540, 640, d.asis, 'ASISTENCIA', oro.g);
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}
