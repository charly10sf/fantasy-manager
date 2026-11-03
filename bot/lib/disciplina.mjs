// Sancionados y apercibidos de las webs de previas (cola de Carlos, 3 nov 20:17). Las dos páginas van por equipo
// (`.disciplinary-cards`, con el club en la cabecera) y cada jugador es un `.elemento` con su nombre (`a.jugador`):
//   /laliga/sancionados: `.sancion` con «Roja directa», «Acumulación de tarjetas» (y las jornadas de las amarillas) o
//                        «Sanción disciplinaria (3/4)» (partido que cumple de los que le cayeron);
//   /laliga/apercibidos: las jornadas de sus cuatro amarillas (`.jornadaT`).
// También salen entrenadores (sin nombre en la de sancionados): se quedan fuera al casar con los jugadores de LaLiga.
// Nunca se nombra la web en los tweets.
import { DOMParser } from 'linkedom';
import { get } from './http.mjs';
import { corto } from './texto.mjs';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** [{ equipo, equipoSlug, nombre, slug, motivo: 'roja'|'amarillas'|'disciplinaria'|null, partido, de, amarillas: [jornadas] }] */
export function leerDisciplina(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  for (const sec of doc.querySelectorAll('.disciplinary-cards')) {
    const a = sec.querySelector('header a');
    const equipo = a ? a.textContent.trim() : '';
    const equipoSlug = a ? ((a.getAttribute('href') || '').match(/\/equipos\/([^/?#]+)/) || [])[1] || '' : '';
    for (const e of sec.querySelectorAll('.elemento')) {
      const j = e.querySelector('a.jugador');
      const nombre = j ? j.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!nombre) continue;
      const san = ((e.querySelector('.sancion') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      let motivo = null, partido = null, de = null, m;
      if (/roja/i.test(san)) motivo = 'roja';
      else if (/acumulaci[oó]n/i.test(san)) motivo = 'amarillas';
      else if ((m = san.match(/disciplinaria\s*\((\d+)\s*\/\s*(\d+)\)/i))) { motivo = 'disciplinaria'; partido = +m[1]; de = +m[2]; }
      else if (/disciplinaria/i.test(san)) motivo = 'disciplinaria';
      const amarillas = [...e.querySelectorAll('.jornadaT')].map((x) => Number((x.textContent.match(/\d+/) || [])[0])).filter(Boolean).sort((x, y) => x - y);
      out.push({ equipo, equipoSlug, nombre, slug: ((j.getAttribute('href') || '').match(/\/jugadores\/([^/?#]+)/) || [])[1] || '', motivo, partido, de, amarillas });
    }
  }
  return out;
}

const cache = {};
/** una página (sancionados o apercibidos), una vez por ejecución ([] si no se puede leer) */
export function disciplina(pagina, { log = () => {}, pedir = get } = {}) {
  if (!cache[pagina]) {
    cache[pagina] = pedir(`https://www.futbolfantasy.com/laliga/${pagina}`, { headers: { Accept: 'text/html' } })
      .then((r) => { if (r.s !== 200) { log(`  (disciplina) ${pagina}: HTTP ${r.s}`); return []; } const l = leerDisciplina(r.b); log(`  (disciplina) ${pagina}: ${l.length} leídos`); return l; })
      .catch((e) => { log(`  (disciplina) ${pagina}: ${e.message || e}`); return []; });
  }
  return cache[pagina];
}

/** ¿el club de la web («Real Sociedad», slug «real-sociedad») es este de LaLiga («Real Sociedad de Fútbol»)? */
export function mismoClub(web, slug, laliga) {
  const w = norm(web), c = norm(corto(laliga)), l = norm(laliga), s = norm(slug);
  if ((!w && !s) || !l) return false;
  return (w && (w === c || w === l || l.includes(w) || w.includes(c))) || (s && (s === c || s === l));
}

/**
 * ¿el nombre de la web («Yassir Zabiri», «Vinicius Junior») es el apodo de LaLiga («Y. Zabiri», «Vini Jr.»)?
 * Sin contar las palabras de dos letras («jr»): cada palabra del apodo tiene que ser el principio de una del nombre, y una inicial
 * («Y.») la de la primera palabra.
 */
export function mismoNombre(web, slug, apodo) {
  const n = norm(web), a = norm(apodo);
  if (!n || !a) return false;
  if (n === a || norm(slug) === a) return true;
  const ws = n.split(' ');
  const ini = String(apodo).match(/^\s*([A-Za-zÀ-ÿ])\.\s*(.+)$/);
  const resto = norm(ini ? ini[2] : apodo).split(' ').filter((x) => x.length >= 3);
  if (!resto.length) return false;
  if (ini && norm(ini[1]) !== ws[0][0]) return false;
  return resto.every((p) => ws.some((w) => w.startsWith(p)));
}

/** el jugador de LaLiga de una fila de la web: del mismo club y con un solo candidato (null si no) */
export function casar(fila, jugadores, equipos) {
  const del = jugadores.filter((j) => mismoClub(fila.equipo, fila.equipoSlug, equipos[String(j.teamId)] || '') && Number(j.positionId) >= 1 && Number(j.positionId) <= 4);
  const xs = del.filter((j) => mismoNombre(fila.nombre, fila.slug, j.nickname));
  return xs.length === 1 ? xs[0] : null;
}

/** las amarillas de la temporada en la ficha de LaLiga (null si no hay ficha) */
export function amarillasDe(ficha) {
  const st = ficha && Array.isArray(ficha.playerStats) ? ficha.playerStats : null;
  if (!st) return null;
  return st.reduce((s, x) => s + (Number(x.stats && x.stats.yellow_card && x.stats.yellow_card[0]) || 0), 0);
}
