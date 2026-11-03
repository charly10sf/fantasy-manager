// El once probable de las webs de previas (Carlos, 3 nov 11:52: «¿cómo puedes poner como once probable a jugadores que tienen
// un 30-40 % de jugar?»). Es la misma fuente y el mismo lector que la app (`parseOnce` y `unirOnce` de web/js/externas.js),
// con el DOMParser de linkedom porque en Node no hay navegador. En la app pesa 0,5 en la titularidad; aquí igual (lib/onces.mjs).
// Nunca se nombra la web en los tweets ni en las tarjetas.
import { DOMParser } from 'linkedom';
import { get } from './http.mjs';

// los equipos de LaLiga 26/27 con su dirección en la web (los mismos que EQUIPOS_FF de la app)
export const EQUIPOS_FF = {
  alaves: 'Alavés', athletic: 'Athletic', atletico: 'Atlético', barcelona: 'Barcelona', betis: 'Betis', celta: 'Celta',
  deportivo: 'Deportivo', elche: 'Elche', espanyol: 'Espanyol', getafe: 'Getafe', levante: 'Levante', malaga: 'Málaga',
  osasuna: 'Osasuna', racing: 'Racing', 'rayo-vallecano': 'Rayo', 'real-madrid': 'Real Madrid', 'real-sociedad': 'Real Sociedad',
  sevilla: 'Sevilla', valencia: 'Valencia', villarreal: 'Villarreal', girona: 'Girona', mallorca: 'Mallorca', 'real-oviedo': 'Oviedo',
};
// como `norm` de web/js/util.js
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** la página de un equipo por su nombre de LaLiga («RC Celta» → celta, «FC Barcelona» → barcelona) */
export function slugDe(nombre) {
  const n = norm(nombre);
  if (!n) return null;
  const e = Object.entries(EQUIPOS_FF).find(([s, x]) => n === norm(x) || n.includes(norm(x)) || norm(x).includes(n) || n.replace(/ /g, '-') === s);
  return e ? e[0] : null;
}

const nombreDeSlug = (href) => { const m = href && String(href).match(/\/jugadores\/([^/?#]+)/); return m ? m[1].replace(/-/g, ' ') : ''; };

/** lee la página de un equipo: [{ nombre, corto, titular, alternativa, prob, estado }] (copia de parseOnce de la app) */
export function parseOnce(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const visto = new Map();
  const meter = (x) => {
    const k = norm(x.nombre || x.corto);
    if (!k) return;
    const e = visto.get(k);
    if (!e) { visto.set(k, x); out.push(x); return; }
    if (x.titular) { e.titular = true; e.alternativa = false; }
    if (x.prob != null && (e.prob == null || x.prob > e.prob)) e.prob = x.prob;
    if (!e.nombre && x.nombre) e.nombre = x.nombre;
  };
  const noJugador = (a) => { const h = a && a.getAttribute && a.getAttribute('href'); return !!h && !/\/jugadores\//.test(h); };
  const estadoDe = (a) => { const l = a && a.getAttribute && a.getAttribute('data-lesion'); return l === '0' ? 'injured' : l === '1' || l === '2' ? 'doubtful' : 'ok'; };
  const probDe = (el) => {
    if (!el) return null;
    const a = el.getAttribute('data-probabilidad') || el.getAttribute('data-probability');
    if (a && /\d/.test(a)) return Math.min(100, parseInt(a, 10));
    const m = (el.textContent || '').match(/(\d{1,3})\s*%/);
    return m ? Math.min(100, parseInt(m[1], 10)) : null;
  };
  const SEL = 'a.juggador, a.jugador, a[href*="/jugadores/"]';
  for (const w of doc.querySelectorAll('.camiseta-wrapper')) {
    const titularW = String(w.getAttribute('data-onceff') || 'titular').toLowerCase() === 'titular';
    const anchors = [...w.querySelectorAll(SEL)].filter((a) => !noJugador(a));
    let probW = null;
    if (anchors.length) {
      const c = w.cloneNode(true);
      [...c.querySelectorAll(SEL)].slice(1).forEach((x) => x.remove());
      probW = probDe(c);
    }
    anchors.forEach((a, i) => {
      const corto = (a.querySelector('.truncate-name') || {}).textContent || a.getAttribute('title') || '';
      meter({ nombre: nombreDeSlug(a.getAttribute('href')), corto: corto.trim(), titular: titularW && i === 0, alternativa: i > 0, prob: probDe(a) ?? (i === 0 ? probW : null), estado: estadoDe(a) });
    });
  }
  for (const [sel, titular] of [['[class*="jugadores-titulares"] .jugador', true], ['[class*="jugadores-suplentes"] .jugador', false]]) {
    for (const el of doc.querySelectorAll(sel)) {
      const a = el.querySelector('a[href*="/jugadores/"]') || el;
      if (!el.querySelector('a[href*="/jugadores/"]') && el.querySelector('a[href*="/entrenador"]')) continue;
      meter({ nombre: nombreDeSlug(a.getAttribute && a.getAttribute('href')), corto: (el.getAttribute('data-nombre') || (el.querySelector('.nombre') || {}).textContent || '').trim(), titular, alternativa: !titular, prob: probDe(el), estado: estadoDe(el) });
    }
  }
  return out.filter((x) => (x.nombre || x.corto).length >= 2);
}

/** casa la lista con los jugadores de LaLiga del equipo (nickname y name): { [id]: { titular, alternativa, prob, estado } } (como unirOnce) */
export function unirOnce(lista, jugadoresEquipo) {
  const js = jugadoresEquipo.map((p) => ({ id: p.id, nombre: p.nickname || '', largo: p.name || p.nickname || '' }));
  const out = {};
  for (const x of lista) {
    const largo = norm(x.nombre), corto = norm(x.corto);
    const j = js.find((p) => norm(p.largo) === largo || norm(p.nombre) === corto || norm(p.nombre) === largo)
      || js.find((p) => largo && (largo.includes(norm(p.nombre)) || norm(p.largo).includes(largo)))
      || js.find((p) => corto && corto.length > 3 && norm(p.nombre).includes(corto));
    if (j && !out[j.id]) out[j.id] = { titular: x.titular, alternativa: x.alternativa, prob: x.prob, estado: x.estado };
  }
  return out;
}

// una lectura por equipo y ejecución (cada página pesa unos 2,5 MB)
const cache = new Map();
/**
 * El once probable de un equipo casado con LaLiga, o null si la página no se lee o trae menos de 10 titulares
 * (así un cambio de la web no mete ceros a todo el equipo: el % vuelve a salir solo de los minutos).
 */
export function onceProbable(nombreEquipo, jugadoresEquipo, { log = () => {}, pedir = get } = {}) {
  const slug = slugDe(nombreEquipo);
  if (!slug) { log(`  (once probable) ${nombreEquipo}: sin página`); return Promise.resolve(null); }
  if (!cache.has(slug)) {
    cache.set(slug, (async () => {
      const r = await pedir(`https://www.futbolfantasy.com/laliga/equipos/${slug}`, { headers: { Accept: 'text/html' } });
      if (r.s !== 200 || !r.b) { log(`  (once probable) ${slug}: HTTP ${r.s}`); return null; }
      const lista = parseOnce(r.b);
      const tits = lista.filter((x) => x.titular).length;
      if (tits < 10) { log(`  (once probable) ${slug}: ${tits} titulares leídos, no lo uso`); return null; }
      return lista;
    })().catch((e) => { log(`  (once probable) ${slug}: ${e.message || e}`); return null; }));
  }
  return cache.get(slug).then((lista) => {
    if (!lista) return null;
    const o = unirOnce(lista, jugadoresEquipo);
    const casados = Object.values(o).filter((x) => x.titular).length;
    if (casados < 9) { log(`  (once probable) ${slug}: solo ${casados} titulares casados con LaLiga, no lo uso`); return null; }
    return o;
  });
}

/** el % que da el once probable a un jugador (como la app): titular con su % o 0,85; alternativa 0,3; el resto 0,15 */
export const pOnce = (o) => (o && o.titular ? (o.prob != null ? o.prob / 100 : 0.85) : o && o.alternativa ? 0.3 : 0.15);
