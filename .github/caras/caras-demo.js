/* Las caras de los jugadores y los escudos de los equipos de la liga de ejemplo y de la portada (Carlos, 2 nov: «cuando
   juegas en la app salen, por lo que en la liga de ejemplo y pestañas y portada también»).
   No se guarda ninguna imagen en el repo: se pide a LaLiga la lista de jugadores (la misma que baja la app, sin sesión),
   se casa cada jugador de la demo por equipo y nombre, y se guardan solo las direcciones de sus fotos, 3 días.
   El navegador las carga de LaLiga como dentro de la app. Si LaLiga no contesta, salen las iniciales como antes.
   Sin importar nada del navegador para poder probarlo con node (`http` se pasa desde fuera). */
import * as N from './normalizar.js';
import { norm } from './util.js';

const HOST = 'https://fantasy-api.llt-services.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const CAB = { 'x-app': '2', 'x-lang': 'es', Accept: 'application/json', 'User-Agent': UA };
export const CLAVE = 'caras-demo';
export const DURA = 3 * 86400e3;

/** las palabras de un nombre: «N. Williams» → iniciales [n] y palabras [williams] */
function partes(s) {
  const p = norm(s).split(' ').filter(Boolean);
  return { ini: p.filter((x) => x.length === 1), pal: p.filter((x) => x.length > 1) };
}

/** cuánto se parece un jugador de LaLiga al nombre de la demo (0: no es él) */
export function parecido(nombre, j) {
  const n = norm(nombre);
  const apodo = norm(j.nombre), largo = norm(j.largo);
  if (n && (n === apodo || n === largo)) return 100;
  const { ini, pal } = partes(nombre);
  if (!pal.length) return 0;
  const suyas = new Set(`${apodo} ${largo}`.split(' ').filter(Boolean));
  if (!pal.every((x) => suyas.has(x))) return 0;
  if (!ini.every((i) => [...suyas].some((x) => x !== i && x.startsWith(i)))) return 0;
  // mejor si lo que casa es el apodo (lo que se ve en el juego) que si está perdido en el nombre completo
  return 50 + (pal.every((x) => apodo.split(' ').includes(x)) ? 20 : 0);
}

/**
 * casa los jugadores de la demo ([{ id, nombre, equipoId }]) con los de LaLiga ([{ id, nombre, largo, equipoId, img }],
 * de N.jugador). Devuelve { idDemo: jugadorLaLiga }. Si dos casan igual de bien, ninguno (mejor sin cara que con otra).
 */
export function casar(demo, lista) {
  const porEq = {};
  for (const j of lista) if (j && j.equipoId) (porEq[j.equipoId] = porEq[j.equipoId] || []).push(j);
  const r = {};
  for (const d of demo) {
    const cands = (porEq[d.equipoId] || []).map((j) => ({ j, p: parecido(d.nombre, j) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
    if (cands.length && !(cands[1] && cands[1].p === cands[0].p)) r[d.id] = cands[0].j;
  }
  return r;
}

/** los escudos: de la lista de equipos si LaLiga la da sin sesión y, si no, de lo que traiga cada jugador */
function escudos(equipos, crudos) {
  const m = {};
  for (const [id, e] of Object.entries(equipos || {})) if (e && e.escudo) m[id] = e.escudo;
  for (const p of crudos) {
    const pm = (p && p.playerMaster) || p;
    const t = pm && pm.team;
    if (!t || t.id == null || m[t.id]) continue;
    const u = [t.badgeColor, t.badge, t.badgeWhite, t.image].find((x) => typeof x === 'string' && /^https?:/.test(x));
    if (u) m[String(t.id)] = u;
  }
  return m;
}

const leer = async (http, ruta) => {
  const r = await http('GET', `${HOST}${ruta}${ruta.includes('?') ? '&' : '?'}x-lang=es`, { cabeceras: CAB, tiempo: 20000 });
  if (r.s !== 200 || !r.b) throw new Error(`LaLiga ${r.s || r.e || 'sin respuesta'}`);
  return JSON.parse(r.b);
};

/**
 * pide a LaLiga lo necesario y devuelve { t, caras: { idDemo: url }, escudos: { idEquipo: url } } (solo direcciones).
 * demo: [{ id, nombre, equipoId }]. http(metodo, url, { cabeceras, tiempo }) → { s, b }, el de puente.js.
 */
export async function traer(http, demo) {
  const [jug, eqs] = await Promise.allSettled([leer(http, '/api/v1/competition/1/players'), leer(http, '/api/v3/teams-master')]);
  if (jug.status !== 'fulfilled') throw jug.reason;
  const crudos = N.lista(jug.value);
  const equipos = eqs.status === 'fulfilled' ? N.equiposLaLiga(eqs.value) : {};
  const lista = crudos.map((p) => N.jugador(p, equipos)).filter(Boolean);
  const casados = casar(demo, lista);
  const caras = {};
  for (const [id, j] of Object.entries(casados)) if (j.img) caras[id] = j.img;
  return { t: Date.now(), caras, escudos: escudos(equipos, crudos), casados: Object.keys(casados).length, total: demo.length };
}

/** pone las caras y los escudos guardados en la foto de la demo (D.maestro y D.equipos); true si ha cambiado algo */
export function poner(D, g) {
  if (!D || !g) return false;
  let cambia = false;
  for (const [id, u] of Object.entries(g.caras || {})) { const j = D.maestro && D.maestro[id]; if (j && j.img !== u) { j.img = u; cambia = true; } }
  for (const [id, u] of Object.entries(g.escudos || {})) { const e = D.equipos && D.equipos[id]; if (e && e.escudo !== u) { e.escudo = u; cambia = true; } }
  return cambia;
}
