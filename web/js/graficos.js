/* Gráficos en SVG, dibujados a mano: la línea de valor de un jugador o de tu equipo, la minilínea de las
   listas, las barras de puntos y el campo con la alineación. Los colores salen de las variables de CSS. */
import { eur, fechaCorta, esc } from './util.js';

let uid = 0;

/** línea con área: puntos = [[t, v], ...] */
export function linea(puntos, { alto = 150, color = 'var(--rojo)', etiquetas = true, formato = (v) => eur(v, { dec: 1 }), marca = null } = {}) {
  const p = (puntos || []).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
  if (p.length < 2) return `<div class="graf-vacio">Aún no hay histórico: cada día que abras la app se apunta un punto.</div>`;
  const W = 340, H = alto, mx = 4, arr = 14, aba = etiquetas ? 22 : 6;
  const ts = p.map((x) => x[0]), vs = p.map((x) => x[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const rango = v1 - v0 || Math.abs(v1) * 0.05 || 1;
  const X = (t) => mx + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * mx);
  const Y = (v) => arr + (1 - (v - v0 + rango * 0.08) / (rango * 1.16)) * (H - arr - aba);
  const pts = p.map(([t, v]) => [X(t), Y(v)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const id = `g${++uid}`;
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H - aba} L${pts[0][0].toFixed(1)},${H - aba} Z`;
  const [ux, uy] = pts[pts.length - 1];
  const imax = vs.indexOf(v1), imin = vs.indexOf(v0);
  const lbl = (i, arriba) => {
    const [x, y] = pts[i];
    const anc = x < 40 ? 'start' : x > W - 40 ? 'end' : 'middle';
    return `<text x="${x.toFixed(1)}" y="${(arriba ? y - 6 : y + 14).toFixed(1)}" text-anchor="${anc}" class="g-et">${esc(formato(vs[i]))}</text>`;
  };
  // marca: { desde, texto }: una franja desde ese momento hasta el final (los días que salen en las barras de debajo)
  const xm = marca && marca.desde > t0 && marca.desde < t1 ? X(marca.desde) : null;
  const franja = xm == null ? '' : `<rect class="g-franja" x="${xm.toFixed(1)}" y="${arr - 10}" width="${(W - mx - xm).toFixed(1)}" height="${H - aba - arr + 10}"/><line class="g-franja-l" x1="${xm.toFixed(1)}" y1="${arr - 10}" x2="${xm.toFixed(1)}" y2="${H - aba}"/>${marca.texto ? `<text class="g-franja-t" x="${(xm + 5).toFixed(1)}" y="${(H - aba - 5).toFixed(1)}">${esc(marca.texto)}</text>` : ''}`;
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`Gráfica: de ${formato(vs[0])} a ${formato(vs[vs.length - 1])}; máximo ${formato(v1)}, mínimo ${formato(v0)}`)}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${franja}<path d="${area}" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="4" fill="${color}"/><circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="8" fill="${color}" opacity=".18"/>
    ${etiquetas ? `${imax !== p.length - 1 ? lbl(imax, true) : ''}${imin !== imax && imin !== p.length - 1 ? lbl(imin, false) : ''}
    <text x="${mx}" y="${H - 5}" class="g-eje">${fechaCorta(t0)}</text><text x="${W - mx}" y="${H - 5}" text-anchor="end" class="g-eje">${fechaCorta(t1)}</text>` : ''}
  </svg>`;
}

/** la minilínea de 7 días para las listas */
export function mini(puntos, sube) {
  const p = (puntos || []).slice(-10);
  if (p.length < 2) return '';
  const W = 56, H = 22, vs = p.map((x) => x[1]), v0 = Math.min(...vs), v1 = Math.max(...vs), r = v1 - v0 || 1;
  const pts = p.map(([, v], i) => `${((i / (p.length - 1)) * (W - 2) + 1).toFixed(1)},${(H - 2 - ((v - v0) / r) * (H - 4)).toFixed(1)}`).join(' ');
  return `<svg class="mini ${sube == null ? '' : sube ? 'sube' : 'baja'}" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** barra de 0 a 100 (el interés de un jugador) */
export const barra = (n) => `<span class="barra" style="--n:${Math.max(0, Math.min(100, n))}"><i></i></span>`;

/** barras verticales: [{ et, v, yo }] */
export function barras(datos, { alto = 120, formato = (v) => String(v) } = {}) {
  if (!datos || !datos.length) return '';
  const W = 340, H = alto, max = Math.max(...datos.map((d) => d.v), 1), n = datos.length, ancho = (W - 8) / n;
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(datos.map((d) => `${d.et}: ${formato(d.v)}`).join(', '))}">${datos.map((d, i) => {
    const h = Math.max(3, (d.v / max) * (H - 34)), x = 4 + i * ancho + ancho * 0.18, w = ancho * 0.64;
    return `<rect x="${x.toFixed(1)}" y="${(H - 18 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" class="${d.yo ? 'b-yo' : 'b'}"/>
      <text x="${(x + w / 2).toFixed(1)}" y="${(H - 22 - h).toFixed(1)}" text-anchor="middle" class="g-et">${esc(formato(d.v))}</text>
      <text x="${(x + w / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="g-eje">${esc(d.et)}</text>`;
  }).join('')}</svg>`;
}

/** el campo con la alineación: formación "4-3-3" y los nombres por líneas (portero primero) */
export function campo(formacion, lineas) {
  const W = 340, H = 420;
  const filas = [1, ...String(formacion || '4-3-3').split('-').map(Number)].filter((x) => x > 0);
  const ys = filas.map((_, i) => H - 52 - i * ((H - 104) / Math.max(1, filas.length - 1)));
  let jug = '';
  filas.forEach((n, f) => {
    const nombres = (lineas[f] || []).slice(0, n);
    for (let i = 0; i < n; i++) {
      const x = (W / (n + 1)) * (i + 1), y = ys[f], nom = nombres[i] || '—';
      jug += `<g class="c-jug"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" class="c-ini">${esc(nom.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase())}</text><text x="${x.toFixed(1)}" y="${(y + 31).toFixed(1)}" text-anchor="middle" class="c-nom">${esc(nom.length > 13 ? nom.slice(0, 12) + '.' : nom)}</text></g>`;
    }
  });
  return `<svg class="campo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Alineación en el campo">
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="18" class="c-cesped"/>
    <path d="M2 ${H / 2}H${W - 2}" class="c-linea"/><circle cx="${W / 2}" cy="${H / 2}" r="42" class="c-linea"/>
    <path d="M${W / 2 - 70} 2v52h140V2M${W / 2 - 70} ${H - 2}v-52h140v52" class="c-linea"/>
    ${jug}</svg>`;
}

/** la pestaña Parón: el valor de estos días en línea y lo que se espera hasta la vuelta a trazos, con «hoy» en medio.
    pas y fut = [[t, v], ...]; fut empieza en hoy. */
export function trayecto(pas, fut, { sube = true, alto = 92, fin = '' } = {}) {
  const ok = ([t, v]) => Number.isFinite(t) && Number.isFinite(v) && v > 0;
  const a = (pas || []).filter(ok), b = (fut || []).filter(ok);
  if (a.length + b.length < 3) return '';
  const W = 340, H = alto, mx = 6, arr = 18, aba = 17;
  const todo = [...a, ...b], ts = todo.map((x) => x[0]), vs = todo.map((x) => x[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const rango = v1 - v0 || v1 * 0.04 || 1;
  const X = (t) => mx + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * mx);
  // (si baja, la cifra del final va debajo del punto: se deja hueco abajo para que no pise la fecha)
  const pb = sube ? 0 : 15;
  const Y = (v) => arr + (1 - (v - v0) / rango) * (H - arr - aba - pb);
  const camino = (p) => p.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const color = sube ? 'var(--sube)' : 'var(--baja)', id = `t${++uid}`;
  const hoy = b.length ? b[0] : a[a.length - 1], hx = X(hoy[0]);
  const ult = b.length ? b[b.length - 1] : hoy, ux = X(ult[0]), uy = Y(ult[1]);
  const base = H - aba;
  const areaF = b.length > 1 ? `${camino(b)} L${ux.toFixed(1)},${base} L${hx.toFixed(1)},${base} Z` : '';
  const areaP = a.length > 1 ? `${camino(a)} L${X(a[a.length - 1][0]).toFixed(1)},${base} L${X(a[0][0]).toFixed(1)},${base} Z` : '';
  return `<svg class="graf tray" viewBox="0 0 ${W} ${H}" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".34"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${areaP ? `<path d="${areaP}" fill="var(--texto2)" opacity=".07"/>` : ''}
    ${areaF ? `<path d="${areaF}" fill="url(#${id})"/>` : ''}
    <path d="M${hx.toFixed(1)},${arr - 6} V${base}" class="tr-hoy"/>
    ${a.length > 1 ? `<path d="${camino(a)}" fill="none" stroke="var(--texto2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${b.length > 1 ? `<path d="${camino(b)}" fill="none" stroke="${color}" stroke-width="2.6" stroke-dasharray="5 4" stroke-linecap="round"/>` : ''}
    <circle cx="${hx.toFixed(1)}" cy="${Y(hoy[1]).toFixed(1)}" r="3.5" fill="var(--texto)"/>
    <circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="4.5" fill="${color}"/><circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="9" fill="${color}" opacity=".2"/>
    <text x="${(ux - 2).toFixed(1)}" y="${(sube ? uy - 9 : uy + 16).toFixed(1)}" text-anchor="end" class="tr-v" fill="${color}">${esc(eur(ult[1], { dec: 1 }))}</text>
    ${a.length ? `<text x="${mx}" y="${H - 4}" class="g-eje">${esc(fechaCorta(a[0][0]))}</text>` : ''}
    <text x="${hx.toFixed(1)}" y="${H - 4}" text-anchor="middle" class="g-eje tr-h">hoy</text>
    <text x="${W - mx}" y="${H - 4}" text-anchor="end" class="g-eje">${esc(fin || fechaCorta(ult[0]))}</text>
  </svg>`;
}
