/* Utilidades de toda la app: números, fechas, nombres, almacenamiento e iconos. */

/* ---------- HTML ---------- */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/* ---------- números ---------- */
const nf = (min, max) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max });
const NF0 = nf(0, 0), NF1 = nf(1, 1), NF2 = nf(2, 2);
export const num = (v) => (Number.isFinite(+v) ? +v : 0);
export const entero = (v) => NF0.format(Math.round(num(v)));

/** 12.403.551 → "12,40 M"; 850.000 → "850 mil"; 4.300 → "4.300 €" */
export function eur(v, { dec = 2, signo = false } = {}) {
  const x = num(v), a = Math.abs(x), s = signo && x > 0 ? '+' : x < 0 ? '−' : '';
  if (a >= 1e6) return `${s}${(dec === 1 ? NF1 : dec === 0 ? NF0 : NF2).format(a / 1e6)} M`;
  if (a >= 1e3) return `${s}${NF0.format(Math.round(a / 1e3))} mil`;
  return `${s}${NF0.format(a)} €`;
}
/** 12.403.551 → "12.403.551 €" */
export const eurLargo = (v) => `${num(v) < 0 ? '−' : ''}${NF0.format(Math.abs(Math.round(num(v))))} €`;
/** el número grande partido: { ent: "12", dec: ",40", uni: "M" } */
export function eurPartido(v) {
  const x = num(v), a = Math.abs(x), neg = x < 0 ? '−' : '';
  if (a >= 1e6) { const [e, d] = NF2.format(a / 1e6).split(','); return { ent: neg + e, dec: ',' + d, uni: 'M' }; }
  if (a >= 1e3) return { ent: neg + NF0.format(Math.round(a / 1e3)), dec: '', uni: 'mil' };
  return { ent: neg + NF0.format(a), dec: '', uni: '€' };
}
export const pct = (v, dec = 1, signo = true) => (Number.isFinite(v) ? `${signo && v > 0 ? '+' : v < 0 ? '−' : ''}${(dec === 0 ? NF0 : dec === 2 ? NF2 : NF1).format(Math.abs(v))} %` : '—');
export const dec1 = (v) => NF1.format(num(v));
export const clase = (v) => (v > 0 ? 'sube' : v < 0 ? 'baja' : '');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- fechas ---------- */
export const ahora = () => Date.now();
export const MIN = 60e3, HORA = 3600e3, DIA = 86400e3;
const TZ = 'Europe/Madrid';
/* Los formateadores de fechas se crean una vez: crear uno en cada llamada (toLocaleDateString con zona horaria) cuesta
   mucho, y el motor pide el día de cada punto del histórico de cada jugador (decenas de miles de veces por pasada).
   Además, el día de España no cambia dentro de una hora en punto (su diferencia con UTC es de horas enteras), así que
   se guarda por hora. */
const FDIA = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const DIA_H = new Map();
/** el día en España, "2026-10-20" */
export const diaDe = (t = Date.now()) => {
  const n = typeof t === 'number' ? t : new Date(t).getTime();
  if (!Number.isFinite(n)) return 'Invalid Date';
  const h = Math.floor(n / HORA);
  let d = DIA_H.get(h);
  if (d === undefined) {
    d = FDIA.format(new Date(h * HORA));
    if (DIA_H.size > 50000) DIA_H.clear();
    DIA_H.set(h, d);
  }
  return d;
};
export const ms = (x) => {
  if (x == null || x === '') return null;
  if (typeof x === 'number') return x < 1e12 ? x * 1000 : x;
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : null;
};
/** "3 h 12 min", "2 d 4 h", "12 min", "ahora" */
export function dura(msx) {
  const a = Math.abs(msx);
  if (a < MIN) return 'nada';
  const d = Math.floor(a / DIA), h = Math.floor((a % DIA) / HORA), m = Math.floor((a % HORA) / MIN);
  if (d >= 2) return `${d} d${h ? ` ${h} h` : ''}`;
  if (d === 1) return `${24 + h} h`;
  if (h) return `${h} h${m && h < 6 ? ` ${m} min` : ''}`;
  return `${m} min`;
}
/** "en 3 h" o "hace 2 d" */
export function rel(t) {
  if (!t) return '';
  const d = t - Date.now();
  if (Math.abs(d) < MIN) return 'ahora';
  return d > 0 ? `en ${dura(d)}` : `hace ${dura(d)}`;
}
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const FPARTES = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const FSEMANA = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const DSEM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function partes(t) {
  const o = {}, f = new Date(t);
  for (const p of FPARTES.formatToParts(f)) o[p.type] = p.value;
  return { d: +o.day, m: +o.month - 1, y: +o.year, h: o.hour === '24' ? '00' : o.hour, min: o.minute, dw: DSEM[FSEMANA.format(f)] };
}
/** "hoy 18:30", "mañana 14:00", "jue 23, 21:00", "23 oct" */
export function cuando(t, { hora = true } = {}) {
  if (!t) return '';
  const p = partes(t), hoy = diaDe(), dia = diaDe(t), man = diaDe(Date.now() + DIA), ayer = diaDe(Date.now() - DIA);
  const hh = hora ? ` ${p.h}:${p.min}` : '';
  if (dia === hoy) return `hoy${hh}`;
  if (dia === man) return `mañana${hh}`;
  if (dia === ayer) return `ayer${hh}`;
  if (Math.abs(t - Date.now()) < 6 * DIA) return `${DIAS[p.dw]} ${p.d}${hora ? `, ${p.h}:${p.min}` : ''}`;
  return `${p.d} ${MESES[p.m]}${hora ? `, ${p.h}:${p.min}` : ''}`;
}
export const fechaCorta = (t) => { const p = partes(t); return `${p.d} ${MESES[p.m]}`; };
export const horaDe = (t) => { const p = partes(t); return `${p.h}:${p.min}`; };

/* ---------- nombres ---------- */
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const iniciales = (s) => norm(s).split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';

export const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL', 5: 'ENT' };
export const POS_LARGO = { 1: 'Portero', 2: 'Defensa', 3: 'Centrocampista', 4: 'Delantero', 5: 'Entrenador' };
export const POS_PLURAL = { 1: 'Porteros', 2: 'Defensas', 3: 'Centrocampistas', 4: 'Delanteros', 5: 'Entrenador' };
export const ESTADO = {
  ok: null,
  injured: { t: 'Lesionado', c: 'mal' },
  doubtful: { t: 'Duda', c: 'duda' },
  suspended: { t: 'Sancionado', c: 'mal' },
  out_of_league: { t: 'Fuera de LaLiga', c: 'mal' },
  international: { t: 'Con su selección', c: 'duda' },
};
export const estadoDe = (e) => ESTADO[e] || (e && e !== 'ok' ? { t: e, c: 'duda' } : null);

/* ---------- almacenamiento del navegador (lo que se puede volver a bajar) ---------- */
export const LS = {
  get(k, def = null) { try { const v = localStorage.getItem('fm-' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('fm-' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('fm-' + k); } catch (e) { /* nada */ } },
};

/* ---------- varios ---------- */
export const dormir = (t) => new Promise((r) => setTimeout(r, t));
export const sumar = (a, f = (x) => x) => a.reduce((s, x) => s + num(f(x)), 0);
export const porClave = (a, f) => { const m = {}; for (const x of a) (m[f(x)] ||= []).push(x); return m; };
export const unicos = (a) => [...new Set(a)];
/** hace `n` peticiones como mucho a la vez */
export async function enParalelo(lista, n, fn) {
  const out = new Array(lista.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (i < lista.length) { const k = i++; try { out[k] = await fn(lista[k], k); } catch (e) { out[k] = { error: e }; } }
  }));
  return out;
}

/* ---------- iconos (trazo de 1,8 sobre 24x24) ---------- */
const I = {
  inicio: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  equipo: '<path d="M8.5 3.5 4 6 2.5 10.5l3 1.4V20.5h13v-8.6l3-1.4L20 6l-4.5-2.5c0 1.6-1.6 2.9-3.5 2.9s-3.5-1.3-3.5-2.9z"/>',
  rivales: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.3 3.1-5.4 6.2-5.4s5.6 2.1 6.2 5.4"/><circle cx="17.2" cy="8.6" r="2.7"/><path d="M16.6 14.4c2.6.2 4.4 2.1 4.8 4.9"/>',
  mercado: '<path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.6 8.6a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.6"/>',
  ia: '<path d="M11.5 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  ajustes: '<path d="M4 6.5h9M17.5 6.5H20M4 12h3M11.5 12H20M4 17.5h11M19.5 17.5h.5"/><circle cx="15.2" cy="6.5" r="2.1"/><circle cx="9.3" cy="12" r="2.1"/><circle cx="17.3" cy="17.5" r="2.1"/>',
  refrescar: '<path d="M19.5 11A7.6 7.6 0 0 0 6 6.8L4.5 8.5"/><path d="M4.5 3.8v4.7h4.7"/><path d="M4.5 13A7.6 7.6 0 0 0 18 17.2l1.5-1.7"/><path d="M19.5 20.2v-4.7h-4.7"/>',
  campana: '<path d="M6.2 9.5a5.8 5.8 0 0 1 11.6 0c0 5.6 2.4 7 2.4 7H3.8s2.4-1.4 2.4-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  candado: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/>',
  abierto: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.3-1.5"/>',
  sube: '<path d="M3.5 16.5l6-6 4 4 7-7"/><path d="M15 7.5h5.5V13"/>',
  baja: '<path d="M3.5 7.5l6 6 4-4 7 7"/><path d="M15 16.5h5.5V11"/>',
  cerrar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  flecha: '<path d="M9.5 6l6 6-6 6"/>',
  atras: '<path d="M14.5 6l-6 6 6 6"/>',
  buscar: '<circle cx="11" cy="11" r="6.8"/><path d="M20 20l-4-4"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.2M12 7.8h.01"/>',
  reloj: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 2"/>',
  escudo: '<path d="M12 3.2l7.8 2.9v6c0 4.4-3.3 7.9-7.8 8.9-4.5-1-7.8-4.5-7.8-8.9v-6z"/>',
  club: '<path d="M12 3.2l7.8 2.9v6c0 4.4-3.3 7.9-7.8 8.9-4.5-1-7.8-4.5-7.8-8.9v-6z"/><path d="M4.4 10.4h15.2M12 3.4v17.4"/>',
  euro: '<path d="M17.5 6.6A7 7 0 1 0 17.5 17.4"/><path d="M4 10h9.5M4 14h9.5"/>',
  copiar: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>',
  enviar: '<path d="M4 12.2 20 4.5l-5.6 15.5-2.7-6.3z"/><path d="M11.7 13.7 20 4.5"/>',
  parar: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/>',
  micro: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/>',
  bicho: '<path d="M9.2 7.6a2.8 2.8 0 0 1 5.6 0"/><rect x="7.2" y="7.6" width="9.6" height="12.4" rx="4.8"/><path d="M12 11.5V20M7.2 13.2H3.8M20.2 13.2h-3.4M7.6 9.6 5 7.4M16.4 9.6 19 7.4M7.6 17.2 5 19.6M16.4 17.2l2.6 2.4"/>',
  abajo: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
  foto: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-4.8-4.8a1 1 0 0 0-1.4 0L5 20"/>',
  nota: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M14.5 3.5V7.5h4M9 12h6M9 15.5h6"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  balon: '<circle cx="12" cy="12" r="8.8"/><path d="M12 8.2l3.2 2.3-1.2 3.8h-4l-1.2-3.8z"/><path d="M12 8.2V3.4M15.2 10.5l4.5-1.4M14 14.3l2.8 3.8M10 14.3l-2.8 3.8M8.8 10.5 4.3 9.1"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alerta: '<path d="M12 3.8 2.8 19.8h18.4z"/><path d="M12 10v4.4M12 17.2h.01"/>',
  fuego: '<path d="M12 21c-3.9 0-6.8-2.8-6.8-6.6 0-3.4 2.3-5.4 3.9-7.5.4 1.9 1.4 3.1 2.6 3.5.1-2.9 1.6-5.4 3.1-6.9.4 3.4 4.4 5.7 4.4 10.9 0 3.8-3.2 6.6-7.2 6.6z"/>',
  cambio: '<path d="M7 7.5h13l-4-4M17 16.5H4l4 4"/>',
  salir: '<path d="M14.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4.5M9.5 16.5l4.5-4.5-4.5-4.5M14 12H3.5"/>',
  descargar: '<path d="M12 4v11.5M7 10.5l5 5 5-5M5 20h14"/>',
  grafico: '<path d="M4 20V11M10 20V5M16 20v-7M21.5 20h-19"/>',
  diana: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2"/>',
  estrella: '<path d="M12 3.6l2.55 5.2 5.75.85-4.15 4.05.98 5.72L12 16.73l-5.13 2.69.98-5.72L3.7 9.65l5.75-.85z"/>',
  ojo: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  hucha: '<path d="M4.5 11.5c0-3.3 3.4-5.8 7.6-5.8 1.6 0 3 .3 4.2.9l2.7-1.4-.6 3.1c.9.9 1.5 2 1.6 3.2h1.5v3.2h-1.9a6.7 6.7 0 0 1-2.6 2.6V20h-3v-1.2a9.7 9.7 0 0 1-3.3 0V20h-3v-2.3c-2-1.3-3.2-3.5-3.2-6.2z"/><path d="M9.5 5.9V5a2.5 2.5 0 0 1 5 0"/>',
  bandera: '<path d="M5 21V4M5 4.5c4-2 6.5 2 11 0v8.5c-4.5 2-7-2-11 0"/>',
  lesion: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8M8 12h8"/>',
  rayo: '<path d="M13 2.8 5 13.2h6l-1 8 8-10.4h-6z"/>',
  directo: '<circle cx="12" cy="12" r="2.3"/><path d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>',
  lista: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
  campo: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h17"/><circle cx="12" cy="12" r="2.8"/><path d="M8.5 3.5v3.2h7V3.5M8.5 20.5v-3.2h7v3.2"/>',
  usuario: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.5 20.5c.8-3.9 3.8-6.3 7.5-6.3s6.7 2.4 7.5 6.3"/>',
  google: '<path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.2 4.2 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5z"/><path d="M12 21c2.4 0 4.4-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z"/><path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8z"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/>',
};
export const icono = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

// El logo: la camiseta roja de espaldas, con MANAGER de nombre y el 11 (tu once) de dorsal. Los textos van en
// trazos (Big Shoulders), para no depender de la fuente. LOGO_P es el de tamaño pequeño (cabecera): sin nombre.
// LOGO_D son los trazos sueltos, para la pantalla de carga (la camiseta que se llena).
export const LOGO_D = {
  camiseta: 'M74 26C84 34 116 34 126 26L154 36L190 70L168 100L150 88V178C150 183 147 186 142 186H58C53 186 50 183 50 178V88L32 100L10 70L46 36Z',
  punos: 'M10 70 L32 100 L39.5 95 L16.59 63.77Z M190 70 L168 100 L160.5 95 L183.41 63.77Z',
  cuello: 'M74 26C84 34 116 34 126 26',
  letras: 'M52.07 86.77 48.2 67.96 54.18 66.74 57.14 73.64 59.3 82.26 60.29 82.06 58.85 73.29 58.88 65.77 64.83 64.55 68.69 83.36 65.31 84.05 64.12 78.26 62.66 68.01 61.6 68.23 62.71 78.83 62.37 84.64 58.27 85.48 55.79 80.25 52.62 70.07 51.57 70.29 54.25 80.28 55.44 86.08Z M71.65 83.01 71.94 63.64 77.67 62.95 82.5 81.72 79.09 82.12 78.17 77.98 74.97 78.36 75.06 82.6ZM74.93 75.39 77.51 75.08 76.6 70.95 75.7 66.16 74.61 66.29 74.86 71.16Z M85.44 81.46 84.58 62.28 90.14 62.03 91.81 68.07 93.62 78.14 94.68 78.09 93.7 69.89 93.08 61.9 96.44 61.75 97.3 80.93 91.47 81.19 89.78 74.89 88.31 65.04 87.19 65.09 88.16 73.99 88.77 81.31Z M100.27 80.92 103.4 61.81 109.17 61.98 111.18 81.25 107.75 81.14 107.46 76.91 104.23 76.81 103.7 81.03ZM104.63 73.87 107.23 73.95 106.94 69.73 106.76 64.86 105.65 64.83 105.19 69.68Z M119.03 82.17Q117.29 82 116.24 81.43Q115.2 80.86 114.78 79.8Q114.35 78.74 114.45 77.1Q114.52 76 114.64 74.66Q114.75 73.33 114.89 71.93Q115.02 70.54 115.17 69.22Q115.32 67.91 115.46 66.85Q115.69 65.16 116.32 64.17Q116.95 63.18 118.08 62.81Q119.22 62.43 120.95 62.6Q123.48 62.85 124.52 64.02Q125.57 65.18 125.47 67.64Q125.45 68.25 125.37 69.03Q125.3 69.8 125.2 70.4L121.87 70.07Q121.98 69.27 122.06 68.5Q122.13 67.72 122.18 66.91Q122.21 66.13 121.87 65.76Q121.53 65.4 120.68 65.32Q119.8 65.23 119.38 65.52Q118.97 65.81 118.83 66.58Q118.64 67.91 118.47 69.33Q118.29 70.75 118.15 72.19Q118.01 73.64 117.91 75.06Q117.8 76.49 117.73 77.83Q117.71 78.63 118.06 78.99Q118.41 79.36 119.3 79.44Q120.22 79.53 120.65 79.25Q121.09 78.96 121.24 78.18Q121.3 77.86 121.34 77.44Q121.39 77.02 121.43 76.61Q121.46 76.2 121.47 75.87L120.07 75.73L120.36 72.83L124.99 73.29Q124.92 74.44 124.79 75.71Q124.66 76.99 124.49 78.08Q124.15 80.53 122.88 81.48Q121.61 82.42 119.03 82.17Z M127.49 82.92 130.57 63.97 138.85 65.31 138.38 68.22 133.39 67.41 132.58 72.38 137.33 73.15 136.86 76.05 132.11 75.28 131.26 80.54 136.25 81.35 135.77 84.26Z M138.88 84.86 143.09 66.13 147.63 67.15Q150.13 67.71 151.01 68.97Q151.9 70.22 151.45 72.56Q151.31 73.29 151.2 73.85Q151.08 74.41 150.95 74.95Q150.82 75.49 150.64 76.17Q150.26 77.63 149.61 78.45Q148.96 79.28 147.9 79.54L148.48 87.02L145.03 86.24L144.71 79.39L143.59 79.14L142.14 85.59ZM144.23 76.27 145.52 76.56Q146.28 76.73 146.72 76.48Q147.17 76.23 147.35 75.61Q147.53 74.97 147.69 74.31Q147.85 73.65 147.98 72.98Q148.12 72.31 148.23 71.66Q148.34 71.02 148.04 70.61Q147.75 70.2 146.99 70.03L145.7 69.74Z M81.96 170V111.22H76.72L76.37 106.55L84.78 99.6H95.64V170Z M107.39 170V111.22H102.16L101.8 106.55L110.21 99.6H121.08V170Z',
  dorsal: 'M77.86 167V94.86H71.43L71 89.13L81.32 80.6H94.65V167Z M109.07 167V94.86H102.65L102.21 89.13L112.53 80.6H125.87V167Z',
};
export const LOGO = `<svg class="logo" viewBox="6 10 188 188" aria-hidden="true"><path d="${LOGO_D.camiseta}" fill="#EE1C3C"/><path d="${LOGO_D.punos}" fill="#fff"/><path d="${LOGO_D.cuello}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="${LOGO_D.letras}" fill="#fff"/></svg>`;
export const LOGO_P = `<svg class="logo" viewBox="6 10 188 188" aria-hidden="true"><path d="${LOGO_D.camiseta}" fill="#EE1C3C"/><path d="${LOGO_D.dorsal}" fill="#fff"/></svg>`;
