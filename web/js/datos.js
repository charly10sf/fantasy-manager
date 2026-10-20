/* Baja todo lo de tu liga de una vez y lo guarda: la foto del momento (D) y el histórico (H) que se va
   llenando cada vez que abres la app (valores de cada jugador por día, valor y puntos de cada rival,
   y los cambios que se ven en sus plantillas aunque la actividad de la liga no los cuente). */
import { api, paginaMercado } from './api.js';
import * as N from './normalizar.js';
import { LS, diaDe, enParalelo, num, DIA } from './util.js';
import { enApp } from './puente.js';
import { demo } from './demo.js';
import { historialValor, oncesProbables, noticias } from './externas.js';

// la deuda permitida en LaLiga Fantasy es siempre el 20 % del valor del equipo
export const cfg = () => ({ ligaId: null, miEquipo: null, ...LS.get('cfg', {}), deuda: 20 });
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
  const muestras = {};
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

  // las formaciones gratuitas cambian poco: una vez al día
  let formaciones = viejo && viejo.formaciones && viejo.formacionesT && Date.now() - viejo.formacionesT < DIA ? viejo.formaciones : null;
  let formacionesT = formaciones ? viejo.formacionesT : Date.now();
  if (!formaciones) formaciones = (await blando('formaciones', async () => { const r = await api.formaciones(); muestras.formaciones = recorte(r); return N.formaciones(r); })) || (viejo && viejo.formaciones) || [];

  alPaso(2, PASOS[2]);
  const clasif = N.clasificacion(await api.clasificacion(liga.id));
  if (!clasif.length) throw new Error('La clasificación de tu liga ha llegado vacía');
  let mio = clasif.find((e) => c.miEquipo && e.teamId === String(c.miEquipo))
    || clasif.find((e) => userId && (e.userId === userId || e.managerId === userId))
    || clasif.find((e) => miNombre && e.manager && e.manager === miNombre);
  clasif.forEach((e) => { e.esYo = !!mio && e.teamId === mio.teamId; });

  alPaso(3, PASOS[3]);
  const maestro = (await blando('jugadores', async () => {
    const r = await api.jugadores();
    const l = N.lista(r);
    if (l[0]) muestras.jugador = recorte(l.find((x) => x && x.images) || l[0]);
    return N.jugadores(r, equipos);
  })) || {};

  alPaso(4, PASOS[4]);
  const plantillas = {};
  const infoEquipos = {};
  await enParalelo(clasif, 3, async (e) => {
    const r = await blando(`plantilla ${e.nombre}`, () => api.equipo(liga.id, e.teamId));
    if (!r) return;
    if (!muestras.plantilla) { const l = (r && (r.players || (r.data && r.data.players))) || N.lista(r); if (l && l[0]) muestras.plantilla = recorte(l[0]); }
    const { fichas, info } = N.plantilla(r, equipos);
    plantillas[e.teamId] = fichas.map((f) => { if (f.jugador) maestro[f.pid] = mezclar(maestro[f.pid], f.jugador); const { jugador, ...resto } = f; return resto; });
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
  const mercado = (await blando('mercado', async () => { const r = await api.mercado(liga.id); const l = N.lista(r); if (l[0]) muestras.mercado = recorte(l[0]); const dm = l.find((x) => x && !/league/i.test(String(x.discr || ''))); if (dm) muestras.mercadoManager = recorte(dm); return N.mercado(r, equipos); })) || [];
  for (const m of mercado) maestro[m.pid] = mezclar(maestro[m.pid], m.jugador);

  // tus jugadores en venta y las ofertas que tienes por ellos
  const misVentas = [];
  if (mio) {
    const mias = mercado.filter((m) => m.vendedorTeamId === mio.teamId || (m.tipo === 'manager' && (plantillas[mio.teamId] || []).some((f) => f.pid === m.pid)));
    await enParalelo(mias, 3, async (m) => {
      let lista = m.ofertasLista;
      const ptId = m.ptId || ((plantillas[mio.teamId] || []).find((f) => f.pid === m.pid) || {}).ptId;
      if (!lista && ptId) {
        lista = await blando(`ofertas ${m.jugador.nombre}`, async () => {
          const r = await api.ofertas(liga.id, ptId);
          if (!muestras.ofertas) muestras.ofertas = recorte(r);
          return N.ofertas(r);
        });
      }
      const ofs = (lista || []).filter((o) => !/reject|declin|cancel|expired/.test(o.estado));
      // la de LaLiga viene aparte (directOffer) si no está en la lista
      if (m.ofertaLiga && !ofs.some((o) => o.deLiga || o.importe === m.ofertaLiga)) ofs.push({ id: 'liga', importe: m.ofertaLiga, estado: 'pending', caduca: m.cierra, de: 'LaLiga', deLiga: true });
      ofs.sort((a, b) => b.importe - a.importe);
      misVentas.push({ marketId: m.id, pid: m.pid, ptId, precio: m.precio, cierra: m.cierra, ofertas: ofs });
    });
  }
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

  // los resultados de las jornadas jugadas, para saber lo fuerte que es cada rival (los de jornadas pasadas no cambian)
  let resultados = (viejo && Array.isArray(viejo.resultados)) ? viejo.resultados : [];
  await blando('resultados', async () => {
    if (jornada == null) return;
    const tengo = new Set(resultados.map((p) => p.jornada));
    const faltan = [];
    for (let n = 1; n < jornada; n++) if (!tengo.has(n)) faltan.push(n);
    const listas = await enParalelo(faltan.slice(0, 38), 3, async (n) => { const r = await api.calendario(n); if (!muestras.calendario) muestras.calendario = recorte(N.lista(r)[0]); return N.partidos(r, equipos, n); });
    const nuevos = listas.filter(Array.isArray).flat();
    resultados = [...resultados, ...nuevos].filter((p) => p.gl != null && p.gv != null)
      .map(({ jornada: j, localId, visitanteId, gl, gv }) => ({ jornada: j, localId, visitanteId, gl, gv }));
    // los de la jornada pasada y la actual que ya se han jugado, de lo que acaba de llegar
    for (const p of partidos) if (p.gl != null && p.gv != null && p.fecha && p.fecha < Date.now() - 2 * 3600e3 && !resultados.some((r) => r.localId === p.localId && r.visitanteId === p.visitanteId && r.jornada === p.jornada)) resultados.push({ jornada: p.jornada, localId: p.localId, visitanteId: p.visitanteId, gl: p.gl, gv: p.gv });
  });

  alPaso(8, PASOS[8]);
  let act = [];
  await blando('actividad', async () => {
    for (let i = 0; i < 4; i++) {
      const r = await api.actividad(liga.id, i);
      if (i === 0) muestras.actividad = recorte(r);
      const pag = N.actividad(r);
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

  // las caras que ya se sacaron de la ficha de cada jugador (la lista general a veces trae la silueta)
  const caras = LS.get('caras', {});
  for (const j of Object.values(maestro)) if (j && !j.img && caras[j.id]) j.img = caras[j.id];

  const valorEquipo = mio ? (mio.valor || sumarValor(plantillas[mio.teamId], maestro)) : 0;
  const D = {
    t: Date.now(), demo: false,
    yo: { userId, nombre: miNombre, teamId: mio ? mio.teamId : null },
    liga, ligas, equipos, equiposT: viejo && viejo.equiposT && equipos === viejo.equipos ? viejo.equiposT : Date.now(),
    clasif, plantillas, maestro, mercado, actividad: act.slice(0, 400),
    dinero, valorEquipo, jornada, partidos, resultados, tendencias, avisos, muestras, misVentas, formaciones, formacionesT,
  };
  return guardarFoto(D, viejo);
}

/** une dos versiones de un jugador sin que los huecos de una borren lo que trae la otra */
function mezclar(a, b) {
  if (!a) return b;
  if (!b) return a;
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v == null || v === '' || (typeof v === 'number' && !v && a[k]) || (Array.isArray(v) && !v.length && a[k])) continue;
    if (k === 'nombre' && v === 'Jugador') continue;
    if (k === 'estado' && v === 'ok' && a.estado && a.estado !== 'ok') continue;
    o[k] = v;
  }
  return o;
}

/** un trozo pequeño de una respuesta, para el diagnóstico (forma y nombres de campos) */
function recorte(x) {
  try { const t = JSON.stringify(x); return t.length > 900 ? t.slice(0, 900) + '…' : t; } catch (e) { return String(x); }
}

/* ---------- la ficha de cada jugador que importa: puntos por jornada, minutos y foto ---------- */
export const detalles = () => LS.get(K('det'), {});

/**
 * Baja la ficha de tus jugadores y de los que más te interesan (cláusulas y mercado). Se guarda un día.
 * Sirve para la forma reciente (la usa la IA) y para rellenar las caras que faltan.
 */
export async function completar(D, M, alListo = () => {}) {
  if (!D || !M || D.demo) return null;
  const det = detalles();
  const ahora = Date.now();
  const pids = [];
  const add = (pid) => { if (pid && !pids.includes(pid)) pids.push(pid); };
  M.mias.forEach((x) => add(x.pid));
  M.mercado.slice(0, 14).forEach((m) => add(m.pid));
  M.clausulas.filter((x) => x.abierta || x.abreEn < 3 * DIA).slice(0, 16).forEach((x) => add(x.pid));
  M.suben.slice(0, 6).forEach((x) => add(x.j.id));
  (M.especular || []).slice(0, 8).forEach((e) => add(e.pid));
  const faltan = pids.filter((pid) => !det[pid] || ahora - det[pid].t > 20 * 3600e3).slice(0, 60);
  if (!faltan.length) return det;
  const caras = LS.get('caras', {});
  await enParalelo(faltan, 3, async (pid) => {
    try {
      const d = N.detalleJugador(await api.jugador(pid, D.liga.id));
      // el histórico de valor: si no viene en la ficha, de la ruta de valores de la API
      let valores = d.valores ? d.valores.slice(-90) : null;
      if (!valores) valores = await historialValor(pid).catch((e) => { if (e.sesion) throw e; return null; });
      det[pid] = { t: Date.now(), stats: d.stats.slice(-10), valores };
      if (d.img) { caras[pid] = d.img; if (D.maestro[pid] && !D.maestro[pid].img) D.maestro[pid].img = d.img; }
    } catch (e) {
      if (e.sesion) throw e;
      det[pid] = { t: Date.now(), error: e.message, stats: [] };
    }
  });
  LS.set(K('det'), det);
  LS.set('caras', caras);
  LS.set(K('datos'), D);
  alListo(det);
  return det;
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
  for (const k of ['datos', 'hist', 'ia', 'chat', 'det', 'planes', 'reventa', 'datos-demo', 'hist-demo', 'ia-demo', 'chat-demo', 'det-demo', 'planes-demo', 'reventa-demo', 'demo']) LS.del(k);
}

/* ---------- fuentes de fuera: onces probables y titulares de prensa ---------- */
export async function fuentesExternas(D, M) {
  if (!D || !M) return null;
  if (D.demo) return { onces: onceDemo(D), noticias: { t: Date.now(), lista: [] } };
  const [onces, nots] = await Promise.all([
    oncesProbables(D).catch((e) => ({ error: e.message, jugadores: {} })),
    noticias(D, M).catch((e) => ({ error: e.message, lista: [] })),
  ]);
  return { onces, noticias: nots };
}
export const fuentesGuardadas = () => (enDemo() ? null : { onces: LS.get('onces', null), noticias: LS.get('noticias', null) });

/** en la demostración, un once probable inventado: los de más media de cada equipo */
function onceDemo(D) {
  const porEq = {};
  for (const j of Object.values(D.maestro)) (porEq[j.equipoId] ||= []).push(j);
  const jugadores = {};
  for (const l of Object.values(porEq)) {
    l.sort((a, b) => b.media - a.media).forEach((j, i) => { jugadores[j.id] = { titular: i < 4 && j.estado !== 'injured', alternativa: i >= 4, prob: i < 4 ? 90 - i * 8 : 25, estado: j.estado === 'injured' ? 'injured' : 'ok' }; });
  }
  return { t: Date.now(), n: Object.keys(jugadores).length, equipos: Object.keys(porEq).length, de: Object.keys(porEq).length, jugadores };
}
