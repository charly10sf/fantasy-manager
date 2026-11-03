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

/**
 * Lee la página de un equipo: [{ nombre, corto, titular, alternativa, prob, estado }].
 * Mirado el 3 nov con la página real: trae tres campos, el once probable (`.jugadores-titulares-N`), los suplentes con su %
 * (`.jugadores-suplentes-N`) y un «once tipo» (`#once-tipo-equipo`) sin %. El `parseOnce` de la app los lee todos como si
 * fueran el once y saca el % del texto de la camiseta, donde va pegado a la altura («1.73» + «70%» se leía 370 → 100 %).
 * Aquí: titulares del primer campo, suplentes del segundo, el once tipo fuera, y el % de `data-probabilidad` o de un
 * elemento cuyo texto sea solo «NN%».
 */
export function parseOnce(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const visto = new Map();
  const meter = (x) => {
    const k = norm(x.nombre || x.corto);
    if (!k || visto.has(k)) return;
    visto.set(k, x); out.push(x);
  };
  const SEL = 'a[href*="/jugadores/"]';
  const probDe = (w) => {
    for (const el of [w, ...w.querySelectorAll('[data-probabilidad], [data-probability]')]) {
      const a = el.getAttribute && (el.getAttribute('data-probabilidad') || el.getAttribute('data-probability'));
      if (a && /^\s*\d{1,3}\s*%?\s*$/.test(a)) return Math.min(100, parseInt(a, 10));
    }
    for (const el of w.querySelectorAll('*')) {
      if (el.children && el.children.length) continue;
      const m = String(el.textContent || '').match(/^\s*(\d{1,3})\s*%\s*$/);
      if (m) return Math.min(100, parseInt(m[1], 10));
    }
    return null;
  };
  const estadoDe = (w) => {
    const l = [w, ...w.querySelectorAll('[data-lesion]')].map((e) => e.getAttribute && e.getAttribute('data-lesion')).find((x) => x != null);
    return l === '0' ? 'injured' : l === '1' || l === '2' ? 'doubtful' : 'ok';
  };
  const camiseta = (w, titular) => {
    const as = [...w.querySelectorAll(SEL)];
    if (!as.length) return;
    const nombre = nombreDeSlug(as[0].getAttribute('href'));
    const corto = (w.querySelector('.truncate-name') || {}).textContent || as.map((a) => a.getAttribute('title')).find(Boolean) || '';
    meter({ nombre, corto: String(corto).trim(), titular, alternativa: !titular, prob: probDe(w), estado: estadoDe(w) });
  };
  const tits = doc.querySelector('[class*="jugadores-titulares"]');
  if (tits) {
    for (const w of tits.querySelectorAll('.camiseta-wrapper')) camiseta(w, true);
    const sup = doc.querySelector('[class*="jugadores-suplentes"]');
    if (sup) for (const w of sup.querySelectorAll('.camiseta-wrapper')) camiseta(w, false);
  } else {
    // otro formato: cada camiseta con data-onceff («titular» o no)
    for (const w of doc.querySelectorAll('.camiseta-wrapper[data-onceff]')) camiseta(w, String(w.getAttribute('data-onceff')).toLowerCase() === 'titular');
  }
  return out.filter((x) => (x.nombre || x.corto).length >= 2);
}

/** casa la lista con los jugadores de LaLiga del equipo (nickname y name): { [id]: { titular, alternativa, prob, estado } } (como unirOnce) */
export function unirOnce(lista, jugadoresEquipo) {
  const js = jugadoresEquipo.map((p) => ({ id: p.id, nombre: p.nickname || '', largo: p.name || p.nickname || '' }));
  const out = {}, sinCasar = [], sinTit = [];
  for (const x of lista) {
    const largo = norm(x.nombre), corto = norm(x.corto);
    const j = js.find((p) => norm(p.largo) === largo || norm(p.nombre) === corto || norm(p.nombre) === largo)
      || js.find((p) => largo && (largo.includes(norm(p.nombre)) || norm(p.largo).includes(largo)))
      || js.find((p) => corto && corto.length > 3 && norm(p.nombre).includes(corto));
    if (j && !out[j.id]) out[j.id] = { titular: x.titular, alternativa: x.alternativa, prob: x.prob, estado: x.estado };
    else if (!j) sinCasar.push(x);
  }
  // por apellido (la última palabra de 4 letras o más, como `unirTitulares` de la app), solo si hay un único candidato libre
  const apellido = (t) => { const w = norm(t).split(' ').filter((y) => y.length >= 4); return w.length ? w[w.length - 1] : ''; };
  for (const x of sinCasar) {
    const a = new Set([apellido(x.nombre), apellido(x.corto)].filter(Boolean));
    const c = js.filter((p) => !out[p.id] && norm(p.largo).split(' ').concat(norm(p.nombre).split(' ')).some((w) => w.length >= 4 && a.has(w)));
    if (c.length === 1) out[c[0].id] = { titular: x.titular, alternativa: x.alternativa, prob: x.prob, estado: x.estado };
    else if (x.titular) sinTit.push(x.corto || x.nombre);
  }
  Object.defineProperty(out, 'sinCasar', { value: sinTit });   // titulares que no casan (para el log)
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
      if (tits < 10 || tits > 12) { log(`  (once probable) ${slug}: ${tits} titulares leídos, no lo uso`); return null; }
      return lista;
    })().catch((e) => { log(`  (once probable) ${slug}: ${e.message || e}`); return null; }));
  }
  return cache.get(slug).then((lista) => {
    if (!lista) return null;
    const o = unirOnce(lista, jugadoresEquipo);
    const casados = Object.values(o).filter((x) => x.titular).length;
    if (o.sinCasar.length) log(`  (once probable) ${slug}: titulares sin casar con LaLiga: ${o.sinCasar.join(', ')}`);
    if (casados < 9) { log(`  (once probable) ${slug}: solo ${casados} titulares casados con LaLiga, no lo uso`); return null; }
    return o;
  });
}

/** el % que da el once probable a un jugador (como la app): su % si lo trae; si no, titular 0,85, suplente 0,3 y el resto 0,15 */
export const pOnce = (o) => (o && o.prob != null ? o.prob / 100 : o && o.titular ? 0.85 : o && o.alternativa ? 0.3 : 0.15);
