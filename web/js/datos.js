/* Baja todo lo de tu liga de una vez y lo guarda: la foto del momento (D) y el histórico (H) que se va
   llenando cada vez que abres la app (valores de cada jugador por día, valor y puntos de cada rival,
   y los cambios que se ven en sus plantillas aunque la actividad de la liga no los cuente). */
import { api, paginaMercado } from './api.js';
import * as N from './normalizar.js';
import { LS, diaDe, enParalelo, num, DIA } from './util.js';
import { enApp } from './puente.js';
import { demo } from './demo.js';

export const cfg = () => ({ deuda: 20, ligaId: null, miEquipo: null, ...LS.get('cfg', {}) });
export const guardarCfg = (c) => LS.set('cfg', { ...cfg(), ...c });

/** ¿se usa la demostración? fuera de la app siempre; dentro, si la has pedido en el inicio o en Ajustes */
export const enDemo = () => !enApp || !!LS.get('demo', false);
// la demostración guarda aparte para no mezclar sus datos con los tuyos
export const K = (k) => (enDemo() ? `${k}-demo` : k);

export const foto = () => LS.get(K('datos'), null);
export const historico = () => LS.get(K('hist'), { v: {}, eq: {}, yo: [], mov: [] });

const PASOS = ['Tu cuenta', 'Tu liga', 'Clasificación', 'Jugadores de LaLiga', 'Plantillas', 'Tu dinero', 'Mercado', 'Jornada y partidos', 'Movimientos de la liga', 'Subidas y bajadas del día'];
export const pasosCarga = PASOS;

/**
 * Actualiza todo. alPaso(i, texto) cuenta por dónde va. Devuelve la foto nueva.
 * Si falla algo imprescindible (la cuenta, la liga, la clasificación) lanza el error; lo demás se apunta
 * en D.avisos y la app sigue con lo que tenga.
 */
export async function actualizar(alPaso = () => {}) {
  if (enDemo()) {
    for (let i = 0; i < PASOS.length; i++) { alPaso(i, PASOS[i]); await new Promise((r) => setTimeout(r, 70)); }
    const { D, H } = demo();
    const h = historico();
    if (!Object.keys(h.v || {}).length) LS.set(K('hist'), H);
    return guardarFoto(D, null);
  }
  const c = cfg();
  const viejo = foto();
  const avisos = [];
  const blando = async (paso, f) => { try { return await f(); } catch (e) { if (e.sesion) throw e; avisos.push({ paso, e: e.message }); return null; } };

  alPaso(0, PASOS[0]);
  const yo = await api.yo();
  const yoD = yo && yo.data && typeof yo.data === 'object' ? yo.data : yo || {};
  const userId = String(yoD.id ?? yoD.userId ?? yoD.managerId ?? '');
  const miNombre = yoD.managerName || yoD.displayName || yoD.username || yoD.name || '';

  alPaso(1, PASOS[1]);
  const ligas = N.lista(await api.ligas()).map((l) => ({ id: String(l.id), nombre: l.name || l.leagueName || `Liga ${l.id}` })).filter((l) => l.id);
  if (!ligas.length) throw new Error('Tu cuenta no tiene ninguna liga de LaLiga Fantasy');
  const liga = ligas.find((l) => l.id === String(c.ligaId)) || ligas[0];

  // los equipos de LaLiga cambian poco: una vez al día
  let equipos = viejo && viejo.equiposT && Date.now() - viejo.equiposT < DIA && viejo.liga && viejo.equipos ? viejo.equipos : null;
  if (!equipos) equipos = (await blando('equipos', async () => N.equiposLaLiga(await api.equiposLaLiga()))) || (viejo && viejo.equipos) || {};

  alPaso(2, PASOS[2]);
  const clasif = N.clasificacion(await api.clasificacion(liga.id));
  if (!clasif.length) throw new Error('La clasificación de tu liga ha llegado vacía');
  let mio = clasif.find((e) => c.miEquipo && e.teamId === String(c.miEquipo))
    || clasif.find((e) => userId && e.userId === userId)
    || clasif.find((e) => miNombre && e.manager && e.manager === miNombre);
  clasif.forEach((e) => { e.esYo = !!mio && e.teamId === mio.teamId; });

  alPaso(3, PASOS[3]);
  const maestro = (await blando('jugadores', async () => N.jugadores(await api.jugadores(), equipos))) || {};

  alPaso(4, PASOS[4]);
  const plantillas = {};
  const infoEquipos = {};
  await enParalelo(clasif, 3, async (e) => {
    const r = await blando(`plantilla ${e.nombre}`, () => api.equipo(liga.id, e.teamId));
    if (!r) return;
    const { fichas, info } = N.plantilla(r, equipos);
    plantillas[e.teamId] = fichas.map((f) => { if (f.jugador) maestro[f.pid] = { ...(maestro[f.pid] || {}), ...f.jugador }; const { jugador, ...resto } = f; return resto; });
    infoEquipos[e.teamId] = info;
    if (!e.valor && info.valor) e.valor = info.valor;
  });

  alPaso(5, PASOS[5]);
  let dinero = null;
  if (mio) {
    dinero = await blando('dinero', async () => N.dinero(await api.dinero(mio.teamId)));
    if (dinero == null && infoEquipos[mio.teamId] && infoEquipos[mio.teamId].dinero != null) dinero = infoEquipos[mio.teamId].dinero;
  } else {
    avisos.push({ paso: 'tu equipo', e: 'No encuentro tu equipo en la clasificación: elígelo en Ajustes' });
  }

  alPaso(6, PASOS[6]);
  const mercado = (await blando('mercado', async () => N.mercado(await api.mercado(liga.id), equipos))) || [];
  for (const m of mercado) if (!maestro[m.pid]) maestro[m.pid] = m.jugador;
  mercado.forEach((m) => { delete m.jugador; });

  alPaso(7, PASOS[7]);
  let jornada = null; let partidos = [];
  await blando('jornada', async () => {
    jornada = N.semana(await api.semana());
    if (jornada == null) return;
    const semanas = [jornada - 1, jornada, jornada + 1, jornada + 2].filter((n) => n >= 1 && n <= 38);
    const listas = await enParalelo(semanas, 2, async (n) => N.partidos(await api.calendario(n), equipos, n));
    partidos = listas.filter(Array.isArray).flat();
  });

  alPaso(8, PASOS[8]);
  let act = [];
  await blando('actividad', async () => {
    for (let i = 0; i < 4; i++) {
      const pag = N.actividad(await api.actividad(liga.id, i));
      if (!pag.length) break;
      act.push(...pag);
      const masVieja = Math.min(...pag.map((a) => a.t || Date.now()));
      if (Date.now() - masVieja > 21 * DIA) break;
    }
  });
  // sin repetidos y lo nuevo arriba
  const vistos = new Set();
  act = act.filter((a) => { const k = a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}`; if (vistos.has(k)) return false; vistos.add(k); return true; }).sort((a, b) => (b.t || 0) - (a.t || 0));

  alPaso(9, PASOS[9]);
  let tendencias = {};
  const html = await blando('futbolfantasy', () => paginaMercado());
  if (html) tendencias = N.unirTendencias(N.paginaMercado(html), maestro);

  const valorEquipo = mio ? (mio.valor || sumarValor(plantillas[mio.teamId], maestro)) : 0;
  const D = {
    t: Date.now(), demo: false,
    yo: { userId, nombre: miNombre, teamId: mio ? mio.teamId : null },
    liga, ligas, equipos, equiposT: viejo && viejo.equiposT && equipos === viejo.equipos ? viejo.equiposT : Date.now(),
    clasif, plantillas, maestro, mercado, actividad: act.slice(0, 400),
    dinero, valorEquipo, jornada, partidos, tendencias, avisos,
  };
  return guardarFoto(D, viejo);
}

const sumarValor = (fichas, maestro) => (fichas || []).reduce((s, f) => s + num((maestro[f.pid] || {}).valor), 0);

/** guarda la foto y añade lo nuevo al histórico */
function guardarFoto(D, viejo = foto()) {
  const H = historico();
  const hoy = diaDe(D.t);
  // valor de cada jugador por día (60 días)
  for (const j of Object.values(D.maestro)) {
    if (!j || !j.valor) continue;
    const s = (H.v[j.id] ||= []);
    const u = s[s.length - 1];
    if (u && u[0] === hoy) u[1] = j.valor; else s.push([hoy, j.valor]);
    if (s.length > 60) s.splice(0, s.length - 60);
  }
  // valor y puntos de cada equipo de tu liga por día
  for (const e of D.clasif) {
    const s = (H.eq[e.teamId] ||= []);
    const u = s[s.length - 1];
    const fila = [hoy, e.valor, e.puntos, e.pos];
    if (u && u[0] === hoy) s[s.length - 1] = fila; else s.push(fila);
    if (s.length > 90) s.splice(0, s.length - 90);
  }
  if (D.yo.teamId) {
    const u = H.yo[H.yo.length - 1];
    const fila = [hoy, D.dinero, D.valorEquipo];
    if (u && u[0] === hoy) H.yo[H.yo.length - 1] = fila; else H.yo.push(fila);
    if (H.yo.length > 120) H.yo.splice(0, H.yo.length - 120);
  }
  // lo que ha cambiado en cada plantilla desde la última vez (entra, sale, sube la cláusula)
  if (viejo && viejo.plantillas && !viejo.demo === !D.demo && viejo.liga && D.liga && viejo.liga.id === D.liga.id) {
    for (const [tid, fichas] of Object.entries(D.plantillas)) {
      const antes = viejo.plantillas[tid];
      if (!antes) continue;
      const a = new Map(antes.map((f) => [f.pid, f])), b = new Map(fichas.map((f) => [f.pid, f]));
      for (const [pid, f] of b) {
        if (!a.has(pid)) H.mov.push({ t: D.t, teamId: tid, tipo: 'entra', pid, clausula: f.clausula });
        else if (f.clausula > a.get(pid).clausula * 1.001 && f.protegidoHasta && f.protegidoHasta > (a.get(pid).protegidoHasta || 0)) H.mov.push({ t: D.t, teamId: tid, tipo: 'blinda', pid, de: a.get(pid).clausula, a: f.clausula });
      }
      for (const [pid] of a) if (!b.has(pid)) H.mov.push({ t: D.t, teamId: tid, tipo: 'sale', pid });
    }
    H.mov = H.mov.filter((m) => D.t - m.t < 45 * DIA).slice(-600);
  }
  LS.set(K('hist'), H);
  if (!LS.set(K('datos'), D)) {
    // sin sitio: se recorta el histórico de valores a 30 días y se vuelve a probar
    for (const s of Object.values(H.v)) if (s.length > 30) s.splice(0, s.length - 30);
    LS.set(K('hist'), H);
    LS.set(K('datos'), D);
  }
  return D;
}

export function borrarTodo() {
  for (const k of ['datos', 'hist', 'ia', 'chat', 'datos-demo', 'hist-demo', 'ia-demo', 'chat-demo', 'demo']) LS.del(k);
}
