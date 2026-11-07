// El estilo común de todas las tarjetas del bot. Sale de la carta de coleccionista (carta.mjs, Carlos, 3 nov 10:44-11:11) y desde el
// 5 nov (Carlos, 06:41: «que las tarjetas de novedades, mercado y demás se parezcan en tipografía y estética a las de jugadores») lo
// usan también las de final, resumen, mercado, onces y bajas (tarjetas.mjs): letra Barlow Condensed (OFL, en fuentes/; tarjetas.mjs la
// carga en aPng), fondo casi negro con el brillo de los clubes y rayos en diagonal, titulares en cursiva con degradado (oro, rojo o el
// color del estado), cajas inclinadas como las de las últimas jornadas de la carta, etiquetas de estado rellenas y la misma marca.
// 6 nov (Carlos: «un reworkeo y una mejora visual de todas las tarjetas, más claras y con más calidad percibida»): textos de 21-22 px o más
// (se ven en el móvil), paneles con degradado, filo de luz y sombra, viñeteado en el fondo, caras con sombra y doble aro, medallas del 1 al 3,
// flechas de subida y bajada, etiquetas redondas (`chip`), colores distintos para dos clubes parecidos (`distinto`) y nombres que no caben
// con la inicial del nombre de pila (`nombreAjustado`) en vez de encogidos a la mitad. Prueba con todas: bot/prueba/tarjetas-todas.mjs.
// Aquí solo están las piezas; cada tarjeta se monta en carta.mjs o en tarjetas.mjs.

export const ANCHO = 1200, ALTO = 675;
export const ROJO = '#ee1c3c', VERDE = '#2fd27f', MALO = '#ff4d5e', AMBAR = '#f2b33d';
export const TINTA = '#f4f2f3', TENUE = '#8c869a', FONDO = '#0b0a0f', PANEL = '#17151d', LINEA = '#2c2834';
export const B = 'Barlow Condensed';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const uri = (buf) => (buf ? `data:image/png;base64,${Buffer.from(buf).toString('base64')}` : null);
/** 7.25 -> «7,3»; enteros sin decimales */
export const num1 = (x) => (Math.round(Number(x) * 10) / 10).toString().replace('.', ',');
/** valor de mercado: 101970432 -> «102 M», 8450000 -> «8,5 M», 640000 -> «0,6 M» */
export const millones = (v) => `${num1(v / 1e6)} M`;
export const signo = (n) => (n > 0 ? `+${n}` : String(n));

// Ancho aproximado de un texto (resvg no lo da): medido para Inter; Barlow Condensed es un 26 % más estrecha.
export function ancho(s, px, fam = 'Inter') {
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
export const medir = (s, px, fam, espacio = 0) => ancho(s, px, fam) + [...String(s)].length * espacio;

export function texto(x, y, s, { px = 24, peso = 700, color = TINTA, ancla = 'start', fam = B, espacio = 0, opacidad = 1, max = null, italica = false } = {}) {
  let p = px;
  if (max) { const min = Math.round(px * 0.5); while (p > min && medir(s, p, fam, espacio) > max) p--; }
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${peso}" font-size="${p}" fill="${color}" text-anchor="${ancla}"`
    + `${espacio ? ` letter-spacing="${espacio}"` : ''}${opacidad < 1 ? ` opacity="${opacidad}"` : ''}${italica ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}
/** un nombre en mayúsculas que quepa en `max` a un tamaño legible: si no cabe a un 88 % de `px`, el nombre de pila pasa a su inicial
    («MARCOS LLORENTE» -> «M. LLORENTE»), que se lee mejor que el mismo nombre encogido a la mitad */
export function nombreAjustado(nombre, px, max, espacio = 0, { apellido = false } = {}) {
  const n = String(nombre).toUpperCase(), partes = n.split(' ');
  if (medir(n, px * 0.88, B, espacio) <= max || partes.length < 2) return n;
  const ini = partes[0].length <= 2 || /\.$/.test(partes[0]) ? n : `${partes[0][0]}. ${partes.slice(1).join(' ')}`;
  // con muy poco sitio (dos opciones en una línea de cinco), solo el apellido
  return apellido && medir(ini, px * 0.88, B, espacio) > max ? partes[partes.length - 1] : ini;
}
/** el tamaño al que se queda un texto con `max` (para colocar algo justo detrás) */
export function tamano(s, px, max, espacio = 0) { let p = px; const min = Math.round(px * 0.5); while (p > min && medir(s, p, B, espacio) > max) p--; return p; }

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas
let n = 0;
export const id = (p) => `${p}${++n}`;
export const lineal = (g, paradas, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) => `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${paradas.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
// `alto`: las tarjetas son de 1200x675 salvo la de los onces, que va en vertical (6 nov) para que las caras se vean grandes
export const radial = (cx, cy, r, color, op, alto = ALTO) => { const g = id('r'); return `<defs><radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="${ANCHO}" height="${alto}" fill="url(#${g})"/>`; };
export const marco = (cuerpo, alto = ALTO) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}"><rect width="${ANCHO}" height="${alto}" fill="${FONDO}"/>${cuerpo}<rect width="${ANCHO}" height="6" fill="${ROJO}"/></svg>`;

/** el escudo (78x105 en LaLiga) encajado en una caja de alto h, centrado en (cx, cy) */
export function escudo(buf, cx, cy, h) {
  if (!buf) return '';
  const w = Math.round(h * 78 / 105);
  return `<image href="${uri(buf)}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}
/** cara en círculo con aro. Las fotos de LaLiga (256x256) van del pelo (y ≈ 45) a la barbilla (y ≈ 210) con el cuello debajo: la foto se
    dibuja a 2,8 veces el radio con el centro de la cara (y ≈ 130) en el del círculo, para que la cara lo llene y se vea bien en pequeño
    (Carlos, 5 nov 07:04: «que su cara se vea bien y esté bien visible»; antes, a 2,16 veces, salían medio cuello y camiseta).
    6 nov (rediseño de las tarjetas): fondo con un degradado del color del club, sombra debajo y un segundo filo oscuro por dentro del aro,
    para que la cara se despegue del panel y se lea mejor en pequeño */
// `zoom`: veces el radio a las que se dibuja la foto (2,8 llena el círculo con la cara; con 2,25 cabe la cabeza entera, sin cortar pelo
// ni barbilla: lo usa la tarjeta de onces desde el 6 nov, «que no se corten tanto»)
export function caraCirculo(buf, cx, cy, r, { aro = '#fff', grosor = 3, fondoColor = null, zoom = 2.8 } = {}) {
  const c = id('cc'), g = id('cf'), S = r * zoom;
  return `<defs><clipPath id="${c}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`
    + `<radialGradient id="${g}" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="${fondoColor || aro}" stop-opacity="0.55"/><stop offset="1" stop-color="#1a1721" stop-opacity="1"/></radialGradient></defs>`
    + `<circle cx="${cx}" cy="${cy + Math.max(2, r * 0.08)}" r="${r + grosor * 0.5}" fill="#000" opacity="0.4"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})"/>`
    + (buf ? `<image href="${uri(buf)}" x="${cx - S / 2}" y="${cy - S * 130 / 256}" width="${S}" height="${S}" clip-path="url(#${c})" preserveAspectRatio="xMidYMid meet"/>` : '')
    + `<circle cx="${cx}" cy="${cy}" r="${r - grosor * 0.5}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="${Math.max(1, grosor * 0.5)}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${aro}" stroke-width="${grosor}"/>`;
}
/** la cara suelta (256x256 sin fondo) que se funde hacia abajo, sin corte duro donde acaba la foto */
export function caraFundida(buf, x, y, lado, { desde = 0.7 } = {}) {
  if (!buf) return '';
  const mk = id('m'), g = id('mg');
  return `<defs>${lineal(g, [[0, '#fff'], [desde, '#fff'], [1, '#fff', 0]])}<mask id="${mk}"><rect x="${x}" y="${y}" width="${lado}" height="${lado}" fill="url(#${g})"/></mask></defs>`
    + `<image href="${uri(buf)}" x="${x}" y="${y}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMax meet" mask="url(#${mk})"/>`;
}

/** fondo común: casi negro, el brillo de los clubes que salen, una malla de puntos muy fina y un viñeteado que oscurece las esquinas.
    (6 nov, segunda vuelta: fuera los rayos en diagonal, que ensuciaban el fondo; la malla da textura sin competir con lo que se lee) */
export function fondo(brillos = [], alto = ALTO) {
  let s = brillos.map(([cx, cy, r, color, op]) => radial(cx, cy, r, color, op, alto)).join('');
  const v = id('vg'), l = id('vl'), p = id('dp');
  s += `<defs><pattern id="${p}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" fill-opacity="0.06"/></pattern>`
    + `<radialGradient id="${v}" cx="${ANCHO / 2}" cy="${alto * 0.46}" r="${Math.round(Math.max(ANCHO, alto) * 0.66)}" gradientUnits="userSpaceOnUse"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.62"/></radialGradient>`
    + lineal(l, [[0, '#fff', 0.06], [1, '#fff', 0]]) + `</defs>`
    + `<rect width="${ANCHO}" height="${alto}" fill="url(#${p})"/>`
    + `<rect width="${ANCHO}" height="${alto}" fill="url(#${v})"/><rect width="${ANCHO}" height="150" fill="url(#${l})"/>`;
  return s;
}

// degradados para los titulares y las cajas destacadas (uno por tarjeta)
export function dorado() {
  const g = id('go');
  return { g, defs: `<defs>${lineal(g, [[0, '#fbe9a6'], [0.5, '#e2bd5a'], [1, '#b88a2c']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` };
}
export function rojizo() {
  const g = id('gr');
  return { g, defs: `<defs>${lineal(g, [[0, '#ffb3b3'], [0.5, '#ff4d5e'], [1, '#b3122a']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` };
}
/** del blanco al color (el de los titulares de estado: LESIONADO, NOVEDADES…) */
export function aColor(color) {
  const g = id('gc');
  return { g, defs: `<defs>${lineal(g, [[0, '#ffffff'], [0.45, color], [1, color]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` };
}

/** panel redondeado (6 nov, segunda vuelta: antes inclinado). Sin `relleno`, un degradado oscuro con un filo de luz arriba y una sombra suave
    debajo; `tinte` le da al panel el color de un club o de un estado (de arriba a la izquierda, se apaga hacia el otro lado). Con `relleno`
    se pinta tal cual (el oro de una cifra, el rojo de una caja de malos). `borde`: un color (a tope), false/null con relleno (sin borde) o,
    si no se pasa, un filete blanco muy suave. `k` se ignora (era la inclinación) */
export function caja(x, y, w, h, { relleno = null, borde, rx = null, grosor = 1.5, sombra = true, tinte = null, tinteOp = 0.34 } = {}) {
  const r = rx ?? Math.min(20, Math.round(h * 0.22));
  let s = '', fill = relleno;
  if (sombra) s += `<rect x="${x}" y="${y + Math.max(3, Math.round(h * 0.05))}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.34"/>`;
  if (!fill) { const g = id('cj'); s += `<defs>${lineal(g, [[0, '#1d2028'], [1, '#12141a']], { x1: 0, y1: 0, x2: 0.3, y2: 1 })}</defs>`; fill = `url(#${g})`; }
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
  if (tinte && !relleno) { const g = id('ct'); s += `<defs>${lineal(g, [[0, tinte, tinteOp], [0.75, tinte, 0]], { x1: 0, y1: 0, x2: 1, y2: 0.4 })}</defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${g})"/>`; }
  if (typeof borde === 'string') s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${borde}" stroke-width="${grosor}"/>`;
  else if (borde === undefined && !relleno) s += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="1"/>`;
  if (!relleno) s += `<path d="M${x + r},${y + 1.2} L${x + w - r},${y + 1.2}" stroke="#fff" stroke-opacity="0.12" stroke-width="1.5"/>`;
  return s;
}

/** una etiqueta redonda rellena (la del estado, el % de titularidad, la formación…), centrada en cx; devuelve { s, w } */
export function chip(txt, cx, cy, px, { relleno = TINTA, tinta = '#120f16', pad = 1.8, espacio = 1, peso = 800 } = {}) {
  const w = medir(txt, px, B, espacio) + px * pad, h = px * 1.75;
  return { w, h, s: `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${relleno}"/>`
    + texto(cx, cy + px * 0.36, txt, { px, peso, color: tinta, espacio, ancla: 'middle' }) };
}
/** triángulo hacia arriba (sube) o hacia abajo (baja): el sentido, que no dependa solo del color */
export function flecha(sube, cx, cy, s, color) {
  const a = s * 0.5, b = s * 0.42;
  return sube ? `<path d="M${cx} ${cy - b} L${cx + a} ${cy + b} L${cx - a} ${cy + b} Z" fill="${color}"/>`
    : `<path d="M${cx} ${cy + b} L${cx + a} ${cy - b} L${cx - a} ${cy - b} Z" fill="${color}"/>`;
}
/** el puesto de una lista: medalla de oro, plata y bronce para los tres primeros (`premio`) y un círculo apagado para el resto */
export function medalla(n, cx, cy, r, { premio = true } = {}) {
  const g = id('md'), P = { 1: ['#fbe9a6', '#b88a2c', '#2a1c04'], 2: ['#f3f5f8', '#8b94a1', '#1a1e25'], 3: ['#f0c9a0', '#86522a', '#2b1607'] }[n];
  if (!premio || !P) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#26222e" stroke="${LINEA}" stroke-width="1.5"/>` + texto(cx, cy + r * 0.38, String(n), { px: Math.round(r * 1.15), peso: 800, color: TENUE, ancla: 'middle' });
  return `<defs>${lineal(g, [[0, P[0]], [1, P[1]]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs><circle cx="${cx}" cy="${cy + 2}" r="${r}" fill="#000" opacity="0.35"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})"/>` + texto(cx, cy + r * 0.38, String(n), { px: Math.round(r * 1.15), peso: 900, color: P[2], ancla: 'middle' });
}

// --- colores de dos clubes que no se confundan (Levante y Atlético, los dos rojos, salían idénticos en la tarjeta del partido)
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
/** aclara un color hacia el blanco (t de 0 a 1) */
export const aclarar = (h, t) => '#' + rgb(h).map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')).join('');
/** sube el brillo de un color oscuro sin quitarle el tono (el azul marino del Atlético pasa a un azul vivo, no a un gris) */
export const avivar = (h, tope = 205) => { const c = rgb(h), m = Math.max(...c); return m >= tope ? h : '#' + c.map((v) => Math.min(255, Math.round(v * tope / m)).toString(16).padStart(2, '0')).join(''); };
/** el color del segundo club, cambiado por otro suyo si el primero y él se parecen demasiado */
export function distinto(club, otro) {
  if (dist(club.vivo, otro.vivo) > 110) return club.vivo;
  const alt = [club.c1, club.c2, club.c3].filter(Boolean).map((c) => { const n = rgb(c); return { c, l: (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / 255 }; })
    .filter(({ c, l }) => l > 0.1 && l < 0.85 && dist(c, otro.vivo) > 110).sort((a, b) => dist(b.c, otro.vivo) - dist(a.c, otro.vivo))[0];
  return alt ? (alt.l < 0.4 ? avivar(alt.c) : alt.c) : club.vivo;
}

/** la marca de la app: barra roja, «FANTASY MANAGER» y la cuenta, entre dos filetes finos */
export function marca(x, y, { ancla = 'start' } = {}) {
  const w1 = medir('FANTASY MANAGER', 26, B, 3), w2 = medir('@Fantasyman_app', 23, B);
  const total = 18 + w1 + 20 + w2;
  const x0 = ancla === 'middle' ? x - total / 2 : x;
  return `<rect x="${x0}" y="${y - 19}" width="6" height="24" rx="2" fill="${ROJO}"/>`
    + texto(x0 + 18, y, 'FANTASY MANAGER', { px: 26, peso: 800, espacio: 3 })
    + texto(x0 + 18 + w1 + 20, y, '@Fantasyman_app', { px: 23, peso: 600, color: TENUE });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas HD (7 nov, rediseño de todas las tarjetas con el estilo de la de onces, PR #74). Las tarjetas se dibujan a 2400 de ancho
// (`aPng`, el doble del lógico) y las caras de LaLiga son de 256x256 como mucho: a más de ~300 px de lado en el PNG se ven blandas.
// Con la cabeza entera (zoom 2,3 veces el radio) la foto mide 2,3·R lógicos, 4,6·R en el PNG: R no pasa de 64 (294 px).
export const ZOOM_HD = 2.3, R_MAX = 64;
/** la cara con la cabeza entera, el halo del club detrás y el aro; sin foto, una silueta en el color del club */
export function caraHD(buf, cx, cy, R, color, { aro = color, grosor = null, halo = 1.5, haloOp = 0.34 } = {}) {
  const r = Math.min(R, R_MAX), gz = grosor ?? Math.max(3, Math.round(r * 0.06));
  let s = '';
  if (halo) { const h = id('hl'); s += `<defs><radialGradient id="${h}"><stop offset="0.5" stop-color="${color}" stop-opacity="${haloOp}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r * halo}" fill="url(#${h})"/>`; }
  if (buf) return s + caraCirculo(buf, cx, cy, r, { aro, grosor: gz, fondoColor: color, zoom: ZOOM_HD });
  const c = id('sc');
  return s + `<defs><clipPath id="${c}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`
    + `<circle cx="${cx}" cy="${cy + Math.max(2, r * 0.08)}" r="${r + 1}" fill="#000" opacity="0.4"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a1721"/>`
    + `<g clip-path="url(#${c})" fill="${color}" fill-opacity="0.55"><circle cx="${cx}" cy="${cy - r * 0.18}" r="${r * 0.36}"/><ellipse cx="${cx}" cy="${cy + r * 0.86}" rx="${r * 0.72}" ry="${r * 0.6}"/></g>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${aro}" stroke-width="${gz}"/>`;
}
/** el nombre (u otro texto corto) en una pastilla translúcida con filo, como en la tarjeta de onces; centrada en cx con la base en cy */
export function pastilla(t, cx, cy, px, wMax, { color = '#ffffff', peso = 800 } = {}) {
  const pp = tamano(t, px, wMax - px * 0.6, 0.5), wt = Math.min(wMax, medir(t, pp, B, 0.5) + px * 0.9), h = px * 1.42;
  return `<rect x="${cx - wt / 2}" y="${cy - px}" width="${wt}" height="${h}" rx="${h / 2}" fill="#0b0d10" fill-opacity="0.8"/>`
    + `<rect x="${cx - wt / 2 + 0.75}" y="${cy - px + 0.75}" width="${wt - 1.5}" height="${h - 1.5}" rx="${h / 2}" fill="#ffffff" fill-opacity="0.07" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>`
    + texto(cx, cy, t, { px, peso, color, ancla: 'middle', max: wMax - px * 0.6, espacio: 0.5 });
}
/** un panel moderno (el campo de la tarjeta de onces sin las líneas): casi negro, el brillo de un color arriba, la rejilla de puntos,
    filo suave y sombra. `linea`: y (relativa al panel) de un filete de luz del color, bajo una cabecera */
export function panel(x, y, w, h, color, { rx = 30, brillo = 0.36, linea = null, borde = null } = {}) {
  const g = id('pg'), gv = id('pv'), pt = id('pp'), cl = id('pc'), gb = id('pb');
  return `<defs><clipPath id="${cl}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>${lineal(g, [[0, '#15171d'], [0.55, '#0e1014'], [1, '#0a0b0e']])}`
    + `<radialGradient id="${gv}" cx="0.5" cy="0" r="0.8"><stop offset="0" stop-color="${color}" stop-opacity="${brillo}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
    + lineal(gb, [[0, color, 0], [0.5, color, 1], [1, color, 0]], { x1: 0, y1: 0, x2: 1, y2: 0 })
    + `<pattern id="${pt}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="#fff" fill-opacity="0.05"/></pattern></defs>`
    + `<rect x="${x}" y="${y + 10}" width="${w}" height="${h}" rx="${rx}" fill="#000" opacity="0.5"/>`
    + `<g clip-path="url(#${cl})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${Math.min(h, Math.max(260, h * 0.7))}" fill="url(#${gv})"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${pt})"/>`
    + (linea != null ? `<rect x="${x}" y="${y + linea - 1}" width="${w}" height="2" fill="url(#${gb})"/>` : '') + `</g>`
    + `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${rx - 1}" fill="none" stroke="${borde || '#fff'}" stroke-opacity="${borde ? 0.85 : 0.09}" stroke-width="${borde ? 2.5 : 2}"/>`;
}
/** cabecera sin banda, centrada: el titular en cursiva con su degradado y debajo una línea tenue espaciada (como «POSIBLES ONCES») */
export function titular(titulo, grad, sub, { y = 86, px = 72, sub2 = null, max = 1000 } = {}) {
  return texto(ANCHO / 2, y, titulo, { px, peso: 800, italica: true, color: `url(#${grad})`, ancla: 'middle', max })
    + (sub ? texto(ANCHO / 2, y + 40, sub, { px: 26, peso: 700, color: TINTA, ancla: 'middle', espacio: 3, max: 1080 }) : '')
    + (sub2 ? texto(ANCHO / 2, y + 74, sub2, { px: 22, peso: 700, color: TENUE, ancla: 'middle', espacio: 4, max: 1080 }) : '');
}

// ---------------------------------------------------------------------------------------------------------------------------
// Estado de un jugador (bajas y novedades)
export const ESTADO_TARJETA = {
  lesionado: { txt: 'LESIONADO', color: MALO },
  sancionado: { txt: 'SANCIONADO', color: MALO },
  duda: { txt: 'DUDA', color: AMBAR },
  disponible: { txt: 'DISPONIBLE', color: VERDE },
  vuelve: { txt: 'VUELVE', color: VERDE },
};
/** el dibujo pequeño del estado: cruz (lesión), tarjeta roja (sanción), círculo con punto (duda) o visto (disponible) */
export function iconoEstado(estado, cx, cy, s, c) {
  if (estado === 'sancionado') return `<rect x="${cx - s * 0.32}" y="${cy - s * 0.45}" width="${s * 0.64}" height="${s * 0.9}" rx="${s * 0.08}" fill="${c}" transform="rotate(12 ${cx} ${cy})"/>`;
  if (estado === 'lesionado') { const a = s * 0.16, b = s * 0.46; return `<rect x="${cx - a}" y="${cy - b}" width="${a * 2}" height="${b * 2}" rx="${a * 0.5}" fill="${c}"/><rect x="${cx - b}" y="${cy - a}" width="${b * 2}" height="${a * 2}" rx="${a * 0.5}" fill="${c}"/>`; }
  // vuelve (aún no disponible en el juego, pero apunta a volver): una flecha hacia arriba
  if (estado === 'vuelve') return `<path d="M${cx} ${cy + s * 0.42} L${cx} ${cy - s * 0.36} M${cx - s * 0.32} ${cy - s * 0.06} L${cx} ${cy - s * 0.4} L${cx + s * 0.32} ${cy - s * 0.06}" fill="none" stroke="${c}" stroke-width="${s * 0.16}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (estado === 'disponible') return `<path d="M${cx - s * 0.4} ${cy} L${cx - s * 0.1} ${cy + s * 0.3} L${cx + s * 0.42} ${cy - s * 0.32}" fill="none" stroke="${c}" stroke-width="${s * 0.18}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // duda: un círculo con un punto, sin texto (el «?» no es una palabra para el validador)
  return `<circle cx="${cx}" cy="${cy}" r="${s * 0.42}" fill="none" stroke="${c}" stroke-width="${s * 0.14}"/><circle cx="${cx}" cy="${cy}" r="${s * 0.11}" fill="${c}"/>`;
}
// (Domy, 3 nov 22:15: una gestión de cargas es «duda leve», no una duda a secas)
export const txtEstado = (f) => (f.estado === 'duda' && f.leve ? 'DUDA LEVE' : f.estado === 'duda' && f.pct != null ? `DUDA · ${f.pct} %` : ESTADO_TARJETA[f.estado].txt);
/** la etiqueta del estado, centrada en cx, en el color del estado y con la letra oscura */
export function pildora(f, cx, cy, px, wMax) {
  const e = ESTADO_TARJETA[f.estado], txt = txtEstado(f);
  let p = px; while (p > 16 && medir(txt, p, B, 1) + p * 2.6 > wMax) p--;
  const w = medir(txt, p, B, 1) + p * 2.6, h = p * 1.75, x = cx - w / 2;
  return `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${e.color}"/>`
    + iconoEstado(f.estado, x + p * 0.95, cy, p * 0.9, '#120f16')
    + texto(x + p * 1.75, cy + p * 0.36, txt, { px: p, peso: 800, color: '#120f16', espacio: 1 });
}
/** el color de un % de titularidad, como en la tarjeta de los posibles onces: verde (75 o más), ámbar (50 o más) o rojo */
export const colPct = (q) => (q == null ? null : q >= 75 ? VERDE : q >= 50 ? AMBAR : MALO);
// (Carlos, 5 nov 17:08: «si pones arriba en el título DUDA, no lo pongas abajo de nuevo; pon el porcentaje de titularidad abajo»)
// la etiqueta del % de titularidad de la app, en el color del %, en vez de repetir el estado que ya dice el título
const txtTit = (pct) => `${pct} % TITULARIDAD`;
export function pildoraTit(pct, cx, cy, px, wMax) {
  const txt = txtTit(pct);
  let p = px; while (p > 16 && medir(txt, p, B, 1) + p * 1.8 > wMax) p--;
  const w = medir(txt, p, B, 1) + p * 1.8, h = p * 1.75, x = cx - w / 2;
  return `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${colPct(pct)}"/>`
    + texto(cx, cy + p * 0.36, txt, { px: p, peso: 800, color: '#120f16', espacio: 1, ancla: 'middle' });
}
export const anchoPildoraTit = (pct, px) => medir(txtTit(pct), px, B, 1) + px * 1.8;
/** ancho de la etiqueta del estado (para colocarla a la derecha) */
export const anchoPildora = (f, px) => medir(txtEstado(f), px, B, 1) + px * 2.6;
