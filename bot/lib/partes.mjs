// El motivo de cada baja (Carlos, 3 nov 13:15: «no puedes poner literalmente "aparece como lesionado en LaLiga Fantasy" y ya está;
// tiene que haber un motivo»). La lista de lesionados de las webs de previas trae, por jugador, la lesión, desde cuándo y lo que se
// espera («Duda para la jornada 12», «Baja hasta finales de noviembre», «Disponible para la jornada 12»). Las sanciones salen de la
// ficha de LaLiga (roja o amarillas de la última jornada). Se cuenta con palabras propias y sin nombrar la web.
import { DOMParser } from 'linkedom';
import { get } from './http.mjs';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const minus = (s) => String(s).replace(/^./, (c) => c.toLowerCase());

/** lee la página de lesionados: [{ nombre, lesion, dia, mes, dias, estado: 'duda'|'baja'|'disponible'|null, hasta, jornada }] */
export function leerLesionados(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  for (const d of doc.querySelectorAll('.elemento .datos')) {
    const a = d.querySelector('a.jugador, a[href*="/jugadores/"]');
    if (!a) continue;
    const tx = (s) => ((d.querySelector(s) || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const lesion = tx('.lesion');
    const fecha = tx('.rounded-card__date').match(/(\d{1,2})\/(\d{1,2})(?:\s*\((\d+)\s*d[ií]as?\))?/);
    const st = tx('.rounded-card__status');
    let estado = null, hasta = null, jornada = null;
    let m;
    if ((m = st.match(/^Duda para la jornada (\d+)/i))) { estado = 'duda'; jornada = +m[1]; }
    else if ((m = st.match(/^Disponible para la jornada (\d+)/i))) { estado = 'disponible'; jornada = +m[1]; }
    else if ((m = st.match(/^Baja hasta (.+)$/i))) { estado = 'baja'; hasta = m[1].trim().replace(/\bmediadios\b/gi, 'mediados'); }   // la web lo escribe mal a veces
    else if (/^Baja/i.test(st)) estado = 'baja';
    out.push({ nombre: (a.textContent || '').trim(), slug: ((a.getAttribute('href') || '').match(/\/jugadores\/([^/?#]+)/) || [])[1] || '',
      lesion, dia: fecha ? +fecha[1] : null, mes: fecha ? +fecha[2] : null, dias: fecha && fecha[3] ? +fecha[3] : null, estado, hasta, jornada });
  }
  return out;
}

let cache = null;
/** la lista de lesionados, una vez por ejecución ([] si no se puede leer) */
export function lesionados({ log = () => {}, pedir = get } = {}) {
  if (!cache) {
    cache = pedir('https://www.futbolfantasy.com/laliga/lesionados', { headers: { Accept: 'text/html' } })
      .then((r) => { if (r.s !== 200) { log(`  (partes) lesionados: HTTP ${r.s}`); return []; } const l = leerLesionados(r.b); log(`  (partes) ${l.length} lesionados leídos`); return l; })
      .catch((e) => { log(`  (partes) lesionados: ${e.message || e}`); return []; });
  }
  return cache;
}

/** el parte de un jugador de LaLiga ({ nickname, name }) en la lista: por nombre completo y, si no, por apodo con un solo candidato */
export function parteDe(j, lista) {
  const largo = norm(j.name), corto = norm(j.nickname);
  const igual = lista.filter((x) => { const n = norm(x.nombre), s = norm(x.slug); return (largo && (n === largo || s === largo || largo.includes(n) || n.includes(largo))) || (corto && (n === corto || s === corto)); });
  if (igual.length === 1) return igual[0];
  if (igual.length > 1) return null;
  if (corto.length < 4) return null;
  const parte = lista.filter((x) => ` ${norm(x.nombre)} `.includes(` ${corto} `));
  return parte.length === 1 ? parte[0] : null;
}

/** «desde el 21 de octubre» */
export const desdeTxt = (p) => (p && p.dia && p.mes ? `desde el ${p.dia} de ${MESES[p.mes - 1]}` : '');
/** «rotura fibrilar en el aductor» */
export const lesionTxt = (p) => (p && p.lesion ? minus(p.lesion) : '');
/** las cifras que el texto puede llevar (para el validador) */
export const numerosDe = (p) => (p ? [p.dia, p.dias, p.jornada, ...(String(p.hasta || '').match(/\d+/g) || []).map(Number)].filter((x) => x != null) : []);

/**
 * El motivo de una sanción, de la ficha de LaLiga: la roja o la quinta amarilla en su último partido jugado.
 * Devuelve { txt, numeros } o null. «Vio la roja en la jornada 11» / «Llegó a 5 amarillas en la jornada 11».
 */
export function motivoSancion(ficha) {
  const st = (ficha && ficha.playerStats ? ficha.playerStats : []).filter((x) => x.stats).sort((a, b) => a.weekNumber - b.weekNumber);
  if (!st.length) return null;
  const v = (x, k) => Number(x.stats[k] && x.stats[k][0]) || 0;
  const ult = [...st].reverse().find((x) => v(x, 'mins_played') > 0);
  if (!ult) return null;
  if (v(ult, 'red_card') > 0 || v(ult, 'second_yellow_card') > 0) return { txt: `Vio la roja en la jornada ${ult.weekNumber}`, numeros: [ult.weekNumber] };
  const amarillas = st.reduce((s, x) => s + v(x, 'yellow_card'), 0);
  if (v(ult, 'yellow_card') > 0 && amarillas > 0 && amarillas % 5 === 0) return { txt: `Llegó a ${amarillas} amarillas en la jornada ${ult.weekNumber}`, numeros: [amarillas, ult.weekNumber] };
  return null;
}

/**
 * Días que faltan hasta la vuelta que da el parte («Baja hasta finales de noviembre», «hasta enero», «hasta el 20 de diciembre»,
 * «final de temporada»), o null si no se entiende. Principios = día 5, mediados = 15, finales = 25 y un mes a secas, el día 1;
 * si esa fecha ya ha pasado este año, es la del año siguiente.
 */
export function diasHastaVuelta(p, ahora = Date.now()) {
  const t = norm(p && p.hasta);
  if (!t) return null;
  if (/temporada/.test(t)) return 200;
  const mes = MESES.findIndex((m) => new RegExp(`\\b${m}\\b`).test(t));
  if (mes < 0) return null;
  const n = t.match(/\b(\d{1,2})\b/);
  const dia = n ? Number(n[1]) : /principio/.test(t) ? 5 : /mediado/.test(t) ? 15 : /final/.test(t) ? 25 : 1;
  const hoy = new Date(ahora);
  let f = Date.UTC(hoy.getUTCFullYear(), mes, dia);
  if (f < ahora - 15 * 864e5) f = Date.UTC(hoy.getUTCFullYear() + 1, mes, dia);
  return Math.round((f - ahora) / 864e5);
}
/** «Venta Fantasy Obligatoria»: una baja larga (5 semanas o más según el parte) */
export const ventaObligatoria = (p, ahora = Date.now()) => !!(p && p.estado === 'baja' && (diasHastaVuelta(p, ahora) ?? 0) >= 35);
