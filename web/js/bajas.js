/* Las bajas de la jornada (22 nov, el diseño A que aprobó Carlos a las 10:01: «detrás de una cruz de enfermería»).
   La cruz junto al título de Clubes abre la hoja 'bajas' con los lesionados, sancionados y dudas de los 20 clubes; en
   Equipo no hay botón nuevo: el recuadro «pueden jugar» abre la misma hoja en «Tu liga», con los tuyos primero.
   Cuatro pestañas con su número: Tu liga (los tuyos y los de tus rivales), Libres, Apercibidos (a una amarilla de la
   sanción; solo si hay) y Todas (por club, en el orden de la clasificación). De cada uno, la cara, el estado, la
   lesión en pocas palabras y, si se sabe, cuándo vuelve; a los tuyos lesionados, el mejor relevo de tu mercado que te
   llega. El estado lo tiene ya la app (LaLiga y el once probable); la lesión y la vuelta las da el portal cada noche
   en bajas/partes.json (bot/web/bajas.mjs, `partesJson`), con el id de LaLiga y aparte de los demás archivos. Se lee
   como mucho cada 6 h; si no llega, la hoja sale igual, sin la vuelta. Tocar a uno abre su ficha. */
import { esc, eur, icono, cuando, num, LS, DIA, HORA } from './util.js';
import { http, enApp } from './puente.js';
import { filaJugador, nada } from './comunes.js';
import { escudo, duenoDe } from './directo.js';
import { bloqueada } from './limite.js';

const ORDEN = { injured: 0, suspended: 1, doubtful: 2 };
const PILL = {
  injured: `<span class="pill mal">${icono('lesion')}Lesionado</span>`,
  suspended: '<span class="pill mal">Sancionado</span>',
  doubtful: '<span class="pill duda">Duda</span>',
};
const may = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

/** lesionado, sancionado o duda, según LaLiga y, si LaLiga no dice nada, según el once probable (lo mismo que la ficha del club) */
export function estadoBaja(M, j) {
  if (ORDEN[j.estado] != null) return j.estado;
  const op = M.onceProb ? M.onceProb(j.id) : null;
  return op && (op.estado === 'injured' || op.estado === 'doubtful') ? op.estado : null;
}

/** la jornada de la que se habla: la que está en juego o la próxima */
const jornadaDe = (M) => M.enJuego || M.proxima || null;

/**
 * todas las bajas de los clubes de LaLiga de esta temporada, de más grave a menos y de más a menos valor, y los
 * apercibidos (4, 9, 14… amarillas, de Understat) que no están de baja. Sin entrenadores ni los que están fuera de LaLiga.
 */
export function listaBajas(S) {
  const { D, M } = S;
  const enCal = new Set();
  for (const p of D.partidos || []) { enCal.add(String(p.localId)); enCal.add(String(p.visitanteId)); }
  const bajas = [], aper = [];
  for (const j of Object.values(D.maestro || {})) {
    if (!j || !j.equipoId || !(j.pos >= 1 && j.pos <= 4) || j.estado === 'out_of_league') continue;
    if (enCal.size >= 10 && !enCal.has(String(j.equipoId))) continue;
    const k = estadoBaja(M, j);
    if (k) { bajas.push({ j, k, d: duenoDe(S, j.id) }); continue; }
    const a = M.avanzado ? M.avanzado(j.id) : null;
    const am = a && a.u ? num(a.u.am) : 0;
    if (am && am % 5 === 4) aper.push({ j, k: 'aper', am, d: duenoDe(S, j.id) });
  }
  bajas.sort((a, b) => ORDEN[a.k] - ORDEN[b.k] || b.j.valor - a.j.valor);
  aper.sort((a, b) => b.j.valor - a.j.valor);
  return { bajas, aper };
}
/** cuántas bajas hay en tu liga (tuyas y de tus rivales): el número de la cruz */
export const bajasEnTuLiga = (S) => listaBajas(S).bajas.filter((x) => x.d).length;

/* ---------- lo que da el portal: la lesión y la vuelta ---------- */
const URLS_APP = ['https://fantasymanagerapp.com/bajas/partes.json', 'https://raw.githubusercontent.com/charly10sf/fantasy-manager/main/web/bajas/partes.json'];
const CADA = 6 * HORA;
const CLAVE = 'bajas-partes';
/** lo guardado, si es de los últimos 3 días (un parte más viejo ya no dice cuándo vuelve nadie) */
export function partes() {
  const g = LS.get(CLAVE, null);
  const p = g && g.datos;
  return p && p.v === 1 && p.j && Date.now() - num(p.t) < 3 * DIA ? p : null;
}
let pidiendo = null;
/** lo baja si lo guardado tiene más de 6 h; devuelve true si ha llegado algo nuevo (para repintar la hoja) */
export function cargarPartes({ forzar = false } = {}) {
  const g = LS.get(CLAVE, null);
  if (!forzar && g && Date.now() - num(g.t) < CADA) return Promise.resolve(false);
  if (pidiendo) return pidiendo;
  pidiendo = (async () => {
    let datos = null;
    try {
      if (enApp) {
        for (const u of URLS_APP) {
          const r = await http('GET', `${u}?h=${Math.floor(Date.now() / HORA)}`, { tiempo: 12000 });
          if (r && r.s === 200 && r.b) { try { datos = JSON.parse(r.b); break; } catch (e) { /* el siguiente */ } }
        }
      } else {
        const r = await fetch('bajas/partes.json', { cache: 'no-cache' });
        if (r.ok) datos = await r.json();
      }
    } catch (e) { /* sin red: lo de antes */ }
    pidiendo = null;
    if (datos && datos.v === 1 && datos.j) {
      LS.set(CLAVE, { t: Date.now(), datos });
      return !(g && g.datos && g.datos.t === datos.t);
    }
    // no ha llegado: se queda lo de antes y no se vuelve a probar hasta dentro de media hora
    LS.set(CLAVE, { t: Date.now() - CADA + 30 * 60e3, datos: g ? g.datos || null : null });
    return false;
  })();
  return pidiendo;
}

/** cuándo vuelve, en grande a la derecha: { v, d } o null si no se sabe */
function vuelta(M, x, p, P, J) {
  if (x.k === 'aper') return J ? { v: `J${J.n + 1}`, d: 'si ve una' } : null;
  if (x.k === 'suspended') return p && p.s && J ? { v: `J${J.n + p.s}`, d: 'vuelve' } : null;
  // una duda no tiene vuelta: lo probable que es que juegue ya sale junto al nombre (el % de titular)
  if (x.k === 'doubtful') return null;
  if (!p) return null;
  if (p.e === 'v' && p.j && J && p.j >= J.n) return { v: `J${p.j}`, d: 'vuelve' };
  if (p.e !== 'b' || p.d == null) return null;
  const dias = num(p.d) - (Date.now() - num(P.t)) / DIA;
  if (dias >= 180) return { v: 'Temporada', d: 'fuera' };
  if (dias < 1) return { v: 'Pronto', d: 'vuelve' };
  if (dias < 14) return { v: `~${Math.round(dias)} ${Math.round(dias) === 1 ? 'día' : 'días'}`, d: 'vuelve' };
  if (dias < 60) return { v: `~${Math.round(dias / 7)} sem.`, d: 'vuelve' };
  return { v: may(new Date(Date.now() + dias * DIA).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')), d: 'vuelve' };
}

const duenoTxt = (d) => (d ? (d.yo ? '<b class="rojo">Tuyo</b>' : `de ${esc(d.txt)}`) : 'Libre');

function fila(S, x, P, J, { club = true } = {}) {
  const { M } = S;
  const p = P && P.j[x.j.id];
  const pill = x.k === 'aper' ? `<span class="pill duda">${x.am} amarillas</span>` : PILL[x.k];
  const les = x.k !== 'suspended' && x.k !== 'aper' && p && p.l ? `<span class="bj-les">${esc(may(p.l))}</span>` : '';
  const sub = [club ? esc(x.j.equipo || '') : '', duenoTxt(x.d)].filter(Boolean).join(' · ');
  const v = vuelta(M, x, p, P, J);
  return filaJugador({ j: x.j, tend: null }, { sub, pills: [pill, les], maxPills: 2, derecha: v ? `<div class="v">${esc(v.v)}</div><div class="d">${esc(v.d)}</div>` : '' }) + relevo(S, x);
}

/** a uno tuyo lesionado, el mejor de su puesto que hay hoy en tu mercado y te llega (el mismo criterio que «Sustitutos»).
    A un sancionado no: casi siempre es un partido y se aguanta */
function relevo(S, x) {
  const { M } = S;
  if (!(x.d && x.d.yo) || x.k !== 'injured') return '';
  const llega = (y) => !Number.isFinite(M.pujaMax) || num(y.precio) <= M.pujaMax;
  const pp = (j) => (M.ppEsperado ? M.ppEsperado(j) : num(j.media));
  const sano = (j) => !['injured', 'suspended', 'out_of_league', 'doubtful'].includes(j.estado);
  const m = (M.mercado || []).filter((y) => y.j && y.j.pos === x.j.pos && !M.enVenta.has(y.pid) && !y.noVende && sano(y.j) && llega(y) && !(y.tipo === 'manager' && bloqueada('ventasRivales')))
    .sort((a, b) => pp(b.j) - pp(a.j))[0];
  if (!m) return '';
  return `<button class="bj-rel" data-j="${esc(m.j.id)}"><span class="fl">Relevo</span><span><b>${esc(m.j.nombre)}</b> · ${m.tipo === 'manager' ? `lo vende ${esc(m.vendedor || 'un mánager')}` : 'libre'}, ${eur(m.precio)}</span><i>Ver ›</i></button>`;
}

/** la cruz: en Clubes, con «Bajas · J14» al lado y el número de bajas de tu liga; en la hoja, sola */
export function cruzHTML(S, { boton = true } = {}) {
  const J = jornadaDe(S.M);
  if (!boton) return `<span class="cz-t" aria-hidden="true">${icono('cruz')}</span>`;
  const n = bajasEnTuLiga(S);
  return `<button class="cz" data-accion="bajas" data-v="todas" aria-label="Bajas${J ? ` de la jornada ${J.n}` : ''}${n ? `: ${n} en tu liga` : ''}">
    <span class="cz-l" aria-hidden="true">Bajas${J ? `<b>J${J.n}</b>` : ''}</span><span class="cz-t" aria-hidden="true">${icono('cruz')}${n ? `<span class="cz-n">${n}</span>` : ''}</span></button>`;
}

/** la hoja: ver = 'liga' | 'libres' | 'aper' | 'todas' */
export function hojaBajas(S, ver = 'todas') {
  const { D, M } = S;
  const { bajas, aper } = listaBajas(S);
  const P = partes();
  const J = jornadaDe(M);
  const mias = bajas.filter((x) => x.d && x.d.yo), riv = bajas.filter((x) => x.d && !x.d.yo), lib = bajas.filter((x) => !x.d);
  if (ver === 'aper' && !aper.length) ver = 'todas';
  const pest = [['liga', 'Tu liga', mias.length + riv.length], ['libres', 'Libres', lib.length], ...(aper.length ? [['aper', 'Apercibidos', aper.length]] : []), ['todas', 'Todas', bajas.length]];
  const cierre = J && !M.enJuego && J.ini ? ` · cierra ${cuando(J.ini - (M.VEDA_H || 24) * HORA)}` : '';
  let h = `<div class="bj"><div class="bj-cab"><div><div class="eti">${J ? `Jornada ${J.n}${M.enJuego ? ' en juego' : cierre}` : 'LaLiga'}</div><h2 class="titulo">Bajas</h2></div>${cruzHTML(S, { boton: false })}</div>
    <div class="bj-tabs" role="tablist" aria-label="Qué bajas ver">${pest.map(([k, t, n]) => `<button class="bj-tab${k === ver ? ' on' : ''}" role="tab" aria-selected="${k === ver}" data-accion="bajas" data-v="${k}"><b>${n}</b><span>${t}</span></button>`).join('')}</div>`;
  const sec = (t, n, sub = '') => `<div class="sec"><h2>${t}</h2><span class="sub">${n}${sub ? ` · ${sub}` : ''}</span></div>`;
  if (ver === 'liga') {
    if (!mias.length && !riv.length) h += nada('Ni tú ni tus rivales tenéis a nadie de baja.');
    else if (mias.length) h += sec('Tuyas', mias.length) + mias.map((x) => fila(S, x, P, J)).join('');
    else h += `<p class="bj-ok">${icono('ok')}No tienes a nadie de baja.</p>`;
    if (riv.length) {
      // de tus rivales: a quién le faltan más
      const por = {};
      for (const x of riv) por[x.d.txt] = (por[x.d.txt] || 0) + 1;
      const top = Object.entries(por).sort((a, b) => b[1] - a[1])[0];
      h += sec('De tus rivales', riv.length, top && top[1] > 1 ? `a ${esc(top[0])} le faltan ${top[1]}` : '') + riv.map((x) => fila(S, x, P, J)).join('');
    }
  } else if (ver === 'libres') {
    h += lib.length ? lib.map((x) => fila(S, x, P, J)).join('') : nada('Ninguno de los que están libres está de baja.');
  } else if (ver === 'aper') {
    const am = aper.filter((x) => x.d), resto = aper.filter((x) => !x.d);
    h += `<p class="t2 peq">Con una amarilla más en la J${J ? J.n : ''} se pierden el partido siguiente.</p>`;
    if (am.length) h += sec('En tu liga', am.length) + am.map((x) => fila(S, x, P, J)).join('');
    if (resto.length) h += sec('Libres', resto.length) + resto.map((x) => fila(S, x, P, J)).join('');
  } else {
    // todas, por club: los clubes en el orden de la clasificación
    const por = {};
    for (const x of bajas) (por[x.j.equipoId] ||= []).push(x);
    const pos = (id) => { const t = M.equipoLiga ? M.equipoLiga(id) : null; return t ? t.pos : 99; };
    const ids = Object.keys(por).sort((a, b) => pos(a) - pos(b) || String((D.equipos[a] || {}).nombre).localeCompare((D.equipos[b] || {}).nombre, 'es'));
    if (!ids.length) h += nada('Ahora mismo no hay nadie de baja en LaLiga.');
    for (const id of ids) {
      const e = D.equipos[id] || {};
      h += `<button class="bj-club" data-club="${esc(id)}">${escudo(D, id)}<span>${esc(e.nombre || '')}</span><b>${por[id].length}</b></button>${por[id].map((x) => fila(S, x, P, J, { club: false })).join('')}`;
    }
  }
  if (P && ver !== 'aper') h += `<p class="bj-pie">Partes de ${esc(cuando(P.t))}</p>`;
  return `${h}</div>`;
}
