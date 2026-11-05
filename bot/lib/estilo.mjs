// El estilo común de todas las tarjetas del bot. Sale de la carta de coleccionista (carta.mjs, Carlos, 3 nov 10:44-11:11) y desde el
// 5 nov (Carlos, 06:41: «que las tarjetas de novedades, mercado y demás se parezcan en tipografía y estética a las de jugadores») lo
// usan también las de final, resumen, mercado, onces y bajas (tarjetas.mjs): letra Barlow Condensed (OFL, en fuentes/; tarjetas.mjs la
// carga en aPng), fondo casi negro con el brillo de los clubes y rayos en diagonal, titulares en cursiva con degradado (oro, rojo o el
// color del estado), cajas inclinadas como las de las últimas jornadas de la carta, etiquetas de estado rellenas y la misma marca.
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
/** el tamaño al que se queda un texto con `max` (para colocar algo justo detrás) */
export function tamano(s, px, max, espacio = 0) { let p = px; const min = Math.round(px * 0.5); while (p > min && medir(s, p, B, espacio) > max) p--; return p; }

// ---------------------------------------------------------------------------------------------------------------------------
// Piezas
let n = 0;
export const id = (p) => `${p}${++n}`;
export const lineal = (g, paradas, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) => `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${paradas.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
export const radial = (cx, cy, r, color, op) => { const g = id('r'); return `<defs><radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="${ANCHO}" height="${ALTO}" fill="url(#${g})"/>`; };
export const marco = (cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}"><rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>${cuerpo}<rect width="${ANCHO}" height="6" fill="${ROJO}"/></svg>`;

/** el escudo (78x105 en LaLiga) encajado en una caja de alto h, centrado en (cx, cy) */
export function escudo(buf, cx, cy, h) {
  if (!buf) return '';
  const w = Math.round(h * 78 / 105);
  return `<image href="${uri(buf)}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}
/** cara en círculo con aro. Las fotos de LaLiga (256x256) van del pelo (y ≈ 45) a la barbilla (y ≈ 210) con el cuello debajo: la foto se
    dibuja a 2,8 veces el radio con el centro de la cara (y ≈ 130) en el del círculo, para que la cara lo llene y se vea bien en pequeño
    (Carlos, 5 nov 07:04: «que su cara se vea bien y esté bien visible»; antes, a 2,16 veces, salían medio cuello y camiseta) */
export function caraCirculo(buf, cx, cy, r, { aro = '#fff', grosor = 3 } = {}) {
  const c = id('cc'), S = r * 2.8;
  return `<defs><clipPath id="${c}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1f1c27"/>`
    + (buf ? `<image href="${uri(buf)}" x="${cx - S / 2}" y="${cy - S * 130 / 256}" width="${S}" height="${S}" clip-path="url(#${c})" preserveAspectRatio="xMidYMid meet"/>` : '')
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${aro}" stroke-width="${grosor}"/>`;
}
/** la cara suelta (256x256 sin fondo) que se funde hacia abajo, sin corte duro donde acaba la foto */
export function caraFundida(buf, x, y, lado, { desde = 0.7 } = {}) {
  if (!buf) return '';
  const mk = id('m'), g = id('mg');
  return `<defs>${lineal(g, [[0, '#fff'], [desde, '#fff'], [1, '#fff', 0]])}<mask id="${mk}"><rect x="${x}" y="${y}" width="${lado}" height="${lado}" fill="url(#${g})"/></mask></defs>`
    + `<image href="${uri(buf)}" x="${x}" y="${y}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMax meet" mask="url(#${mk})"/>`;
}

/** fondo común: casi negro, el brillo de los clubes que salen y rayos en diagonal */
export function fondo(brillos = []) {
  let s = brillos.map(([cx, cy, r, color, op]) => radial(cx, cy, r, color, op)).join('');
  for (let k = 0; k < 9; k++) s += `<polygon points="${120 + k * 150},0 ${200 + k * 150},0 ${-80 + k * 150},${ALTO} ${-160 + k * 150},${ALTO}" fill="#fff" opacity="${(0.018 + (k % 3) * 0.008).toFixed(3)}"/>`;
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

/** caja inclinada, como las de las últimas jornadas de la carta: arriba corrida `k` px a la derecha */
export function caja(x, y, w, h, { relleno = PANEL, borde = LINEA, k = Math.round(h * 0.12), grosor = 1.5 } = {}) {
  return `<path d="M${x + k},${y} L${x + w},${y} L${x + w - k},${y + h} L${x},${y + h} Z" fill="${relleno}"${borde ? ` stroke="${borde}" stroke-width="${grosor}"` : ''}/>`;
}

/** la marca de la app: barra roja, «FANTASY MANAGER» y la cuenta */
export function marca(x, y, { ancla = 'start' } = {}) {
  const w1 = medir('FANTASY MANAGER', 24, B, 2), w2 = medir('@Fantasyman_app', 22, B);
  const total = 16 + w1 + 18 + w2;
  const x0 = ancla === 'middle' ? x - total / 2 : x;
  return `<rect x="${x0}" y="${y - 17}" width="6" height="22" rx="2" fill="${ROJO}"/>`
    + texto(x0 + 16, y, 'FANTASY MANAGER', { px: 24, peso: 800, espacio: 2 })
    + texto(x0 + 16 + w1 + 18, y, '@Fantasyman_app', { px: 22, peso: 600, color: TENUE });
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
  let p = px; while (p > 12 && medir(txt, p, B, 1) + p * 2.6 > wMax) p--;
  const w = medir(txt, p, B, 1) + p * 2.6, h = p * 1.75, x = cx - w / 2;
  return `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${e.color}"/>`
    + iconoEstado(f.estado, x + p * 0.95, cy, p * 0.9, '#120f16')
    + texto(x + p * 1.75, cy + p * 0.36, txt, { px: p, peso: 800, color: '#120f16', espacio: 1 });
}
/** ancho de la etiqueta del estado (para colocarla a la derecha) */
export const anchoPildora = (f, px) => medir(txtEstado(f), px, B, 1) + px * 2.6;
