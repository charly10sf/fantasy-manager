/*
 * Las búsquedas en Google de los planes, compartidas (25 nov; Carlos: «haz tú solo todos los puntos»). El día viral la
 * búsqueda ya era la mitad de lo que costaba la IA de los planes (167 búsquedas, 1,67 $ hasta las 19:00;
 * claude/medida-25nov-tarde.md del proyecto), y casi todos tienen a los mismos jugadores: cada plan buscaba lo mismo
 * que el de al lado.
 *
 * Ahora cada búsqueda que hace la IA (la consulta y lo que encontró: título, url y antigüedad) se guarda unas horas en un
 * solo Durable Object, «busq|todos»:
 *   b|<t en base 36, 9 cifras>|<azar> → { q, t, res: [{ u, t, a }] }
 * y a cada plan se le pasan las de las últimas BUSQ_HORAS que hablan de algo que sale en su pedido (un jugador, un club),
 * con sus url, que valen como fuente igual que las suyas (fuentesDe). Con eso:
 *  - si la cuenta ya hizo un plan con búsqueda hace menos de BUSQ_REPITE_H, este va sin buscar (sus búsquedas y las de
 *    los demás le llegan por aquí); se apunta en su objeto del día («plan|día|uid», clave «webt»);
 *  - si no, puede buscar, pero se le dice que antes mire lo que ya hay y que busque solo lo que falte.
 * Lo que lleva más de BUSQ_GUARDA_H se borra al guardar. Nada de esto lleva cuentas ni nombres de nadie: solo lo que se
 * buscó y lo que salió, que es público.
 */
export const BUSQ_HORAS = 3, BUSQ_REPITE_H = 3, BUSQ_GUARDA_H = 6;
// cuántas búsquedas recientes se le pasan a un plan como mucho, cuántos resultados de cada una y cuántas se leen
export const BUSQ_MAX = 12, BUSQ_RES = 5, BUSQ_LEER = 400;
const H = 3600e3;
const clave = (t) => `b|${Math.max(0, Math.round(t)).toString(36).padStart(9, '0')}|`;
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();
// (las palabras de una consulta que no dicen de quién va: si solo coinciden estas, no es del pedido)
const VACIAS = new Set(('lesion lesiones lesionado baja bajas noticia noticias ultima ultimas hora horas once onces probable probables '
  + 'alineacion alineaciones convocatoria convocado convocados sancion sancionado partido partidos jornada jornadas laliga liga '
  + 'fantasy futbol primera division hoy manana ayer semana titular titulares suplente rotacion vuelve vuelta parte medico '
  + 'entrenamiento entrena equipo equipos jugador jugadores estado ultimo ultimos noviembre diciembre enero 2026 2027 contra '
  + 'para sobre desde hasta como cuando donde esta este esta estos real club deportivo atletico union').split(' '));
/** las palabras de una consulta que sirven para saber de quién habla (4 letras o más y no vacías) */
export const palabrasBusq = (q) => [...new Set(norm(q).split(' ').filter((w) => w.length >= 4 && !VACIAS.has(w)))];

/** una búsqueda de la respuesta de Claude, limpia: { q, res } o null */
export function busqLimpia(x, urlFuente) {
  const q = String((x && x.q) || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!q) return null;
  const res = [], ya = new Set();
  for (const r of Array.isArray(x.res) ? x.res : []) {
    const u = urlFuente(r && r.u);
    if (!u || ya.has(u)) continue;
    ya.add(u);
    res.push({ u, t: String((r && r.t) || '').replace(/\s+/g, ' ').trim().slice(0, 140), a: String((r && r.a) || '').slice(0, 40) });
    if (res.length >= 8) break;
  }
  return res.length ? { q, res } : null;
}

/** (en el objeto «busq|todos») { op: 'poner', xs: [{ q, res }] } | { op: 'leer', desde } */
export async function busqObjeto(st, b, urlFuente, ahora = Date.now()) {
  if (b && b.op === 'poner') {
    const xs = (Array.isArray(b.xs) ? b.xs : []).map((x) => busqLimpia(x, urlFuente)).filter(Boolean).slice(0, 6);
    if (xs.length) await st.put(Object.fromEntries(xs.map((x, i) => [clave(ahora) + Math.random().toString(36).slice(2, 8) + i, { ...x, t: ahora }])));
    // lo de más de BUSQ_GUARDA_H, fuera (de 128 en 128, lo que deja delete)
    const viejos = [...(await st.list({ prefix: 'b|', end: clave(ahora - BUSQ_GUARDA_H * H), limit: 512 })).keys()];
    for (let i = 0; i < viejos.length; i += 128) await st.delete(viejos.slice(i, i + 128));
    return { ok: true, n: xs.length };
  }
  const desde = Math.max(Number(b && b.desde) || 0, ahora - BUSQ_GUARDA_H * H);
  const m = await st.list({ prefix: 'b|', start: clave(desde), reverse: true, limit: BUSQ_LEER });
  return { xs: [...m.values()] };
}

/**
 * Las búsquedas recientes que hablan de algo del pedido, las más útiles primero (más palabras que coinciden y, a igualdad,
 * la más nueva), sin repetir consulta, como mucho `max`
 */
export function busqRelevantes(xs, pedido, max = BUSQ_MAX) {
  const ped = ` ${norm(pedido)} `;
  const vistas = new Set(), out = [];
  for (const x of Array.isArray(xs) ? xs : []) {
    if (!x || !x.q || !Array.isArray(x.res) || !x.res.length) continue;
    const k = norm(x.q);
    if (vistas.has(k)) continue;
    const n = palabrasBusq(x.q).filter((w) => ped.includes(` ${w} `)).length;
    if (!n) continue;
    vistas.add(k);
    out.push({ x, n });
  }
  return out.sort((a, b) => b.n - a.n || (Number(b.x.t) || 0) - (Number(a.x.t) || 0)).slice(0, max).map((o) => o.x);
}

const horaMadrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
/** el bloque que se añade al pedido con las búsquedas recientes; puede: si este plan puede buscar */
export function bloqueBusq(xs, puede) {
  if (!xs.length) return puede ? '' : '\n\nESTA VEZ NO PUEDES BUSCAR EN GOOGLE: haz el plan con lo que tienes.';
  const lineas = xs.map((x) => `- «${x.q}» (buscado a las ${horaMadrid.format(new Date(Number(x.t) || Date.now()))}):\n${x.res.slice(0, BUSQ_RES).map((r) => `  · ${r.t || 'sin título'}${r.a ? ` [${r.a}]` : ''} ${r.u}`).join('\n')}`);
  return `\n\nBÚSQUEDAS RECIENTES EN GOOGLE (de planes de hace menos de ${BUSQ_HORAS} h; lo que ponen los títulos es lo que se sabe, y sus url valen como «fuente» igual que las tuyas):\n${lineas.join('\n')}\n`
    + (puede
      ? 'ANTES DE BUSCAR, MIRA ESTAS: si ya dicen lo que necesitas de los jugadores del plan, NO busques; busca solo lo que no esté aquí.'
      : 'ESTA VEZ NO PUEDES BUSCAR EN GOOGLE: usa solo estas búsquedas (con su url como «fuente») y lo que ya tienes.');
}

/** las url de las búsquedas recientes, como las «vistas» de una respuesta ({ u, t }), para fuentesDe */
export const vistasBusq = (xs) => xs.flatMap((x) => x.res.slice(0, BUSQ_RES).map((r) => ({ u: r.u, t: r.t })));
