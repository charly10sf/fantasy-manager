/* Baja todo lo de tu liga de una vez y lo guarda: la foto del momento (D) y el histórico (H) que se va
   llenando cada vez que abres la app (valores de cada jugador por día, valor y puntos de cada rival,
   y los cambios que se ven en sus plantillas aunque la actividad de la liga no los cuente). */
import { api, paginaMercado } from './api.js';
import * as N from './normalizar.js';
import { LS, diaDe, enParalelo, num, DIA } from './util.js';
import { enApp, enWeb } from './puente.js';
import { demo } from './demo.js';
import { historialValor, oncesProbables, noticias, avanzadas } from './externas.js';

// la deuda permitida en LaLiga Fantasy es siempre el 20 % del valor del equipo
// (tu equipo no se elige: sale de la cuenta con la que entras; lo de miEquipo que quedara guardado no cuenta)
export const cfg = () => ({ ligaId: null, ...LS.get('cfg', {}), miEquipo: null, deuda: 20 });
export const guardarCfg = (c) => LS.set('cfg', { ...cfg(), ...c });

/** ¿se usa la demostración? en un navegador sin el Worker, siempre; en la app y en la web, si la has pedido */
export const enDemo = () => (!enApp && !enWeb) || !!LS.get('demo', false);
// la demostración guarda aparte para no mezclar sus datos con los tuyos
export const K = (k) => (enDemo() ? `${k}-demo` : k);

export const foto = () => LS.get(K('datos'), null);
export const historico = () => LS.get(K('hist'), { v: {}, eq: {}, yo: [], mov: [] });

/* ---------- el historial de movimientos de la liga, guardado aparte (para el dinero de los rivales) ---------- */
const claveAct = (a) => a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}|${a.importe}`;
/** { liga, lista (lo viejo sin el texto), completa (llega al principio de la liga), desde, profundo } */
export function actHist(ligaId) {
  const h = LS.get(K('acthist'), null);
  if (!h || (ligaId && h.liga !== ligaId)) return { liga: ligaId || null, lista: [], completa: false, desde: null, profundo: null };
  return h;
}
function guardarActHist(ligaId, AH, nuevas, llegoAlFinal, nEquipos = 0) {
  const m = new Map();
  for (const a of AH.lista) m.set(claveAct(a), a);
  for (const a of nuevas) { const { texto, ...resto } = a; m.set(claveAct(a), resto); }
  const lista = [...m.values()].sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 4000);
  const desde = lista.length ? Math.min(...lista.map((a) => a.t || Date.now())) : null;
  // también está completo si sale cuando entró en la liga cada uno de los managers
  const entraron = new Set(lista.filter((a) => a.clase === 'entra').map((a) => a.quienId || a.quien)).size;
  const completa = AH.completa || llegoAlFinal || (nEquipos > 1 && entraron >= nEquipos);
  const h = { liga: ligaId, lista, completa, desde, profundo: AH.profundo || null, t: Date.now() };
  // si no cabe, se quitan los campos que no hacen falta para las cuentas antes que movimientos
  if (!LS.set(K('acthist'), h)) {
    const ligera = lista.map(({ id, t, clase, quienId, quien, otroId, otro, pid, importe }) => ({ id, t, clase, quienId, quien, otroId, otro, pid, importe }));
    if (!LS.set(K('acthist'), { ...h, lista: ligera })) LS.set(K('acthist'), { ...h, lista: ligera.slice(0, 1500), completa: false });
  }
  return h;
}

const PASOS = ['Tu cuenta', 'Tu liga', 'Clasificación', 'Jugadores', 'Plantillas', 'Tu dinero', 'Mercado', 'Jornada y partidos', 'Movimientos', 'Subidas y bajadas'];
export const pasosCarga = PASOS;

/**
 * Actualiza todo. alPaso(i, texto) cuenta por dónde va. Devuelve la foto nueva.
 * Si falla algo imprescindible (la cuenta, la liga, la clasificación) lanza el error; lo demás se apunta
 * en D.avisos y la app sigue con lo que tenga.
 */
export async function actualizar(alPaso = () => {}) {
  if (enDemo()) {
    for (let i = 0; i < PASOS.length; i++) { alPaso(i, PASOS[i]); await new Promise((r) => setTimeout(r, window.__lento || 90)); }
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
  let mio = clasif.find((e) => userId && (e.userId === userId || e.managerId === userId))
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
  // el saldo de cada equipo, cuando LaLiga lo da (de la clasificación, de su plantilla o de su ruta de dinero)
  const dineros = {};
  for (const e of clasif) {
    const inf = infoEquipos[e.teamId];
    if (e.dinero != null) dineros[e.teamId] = { v: e.dinero, fuente: 'clasificación' };
    else if (inf && inf.dinero != null) dineros[e.teamId] = { v: inf.dinero, fuente: 'plantilla' };
  }
  if (mio) {
    dinero = await blando('dinero', async () => N.dinero(await api.dinero(mio.teamId)));
    if (dinero == null && dineros[mio.teamId]) dinero = dineros[mio.teamId].v;
    if (dinero != null) dineros[mio.teamId] = { v: dinero, fuente: 'tu cuenta' };
  } else {
    avisos.push({ paso: 'tu equipo', e: 'No encuentro tu equipo en la clasificación: elígelo en Ajustes' });
  }
  // el de los rivales: se prueba con uno y, si LaLiga lo da, con todos (si no, se estima con sus movimientos)
  const sinDinero = clasif.filter((e) => !e.esYo && !dineros[e.teamId]);
  if (sinDinero.length) {
    const probar = async (e) => {
      try {
        const r = await api.dinero(e.teamId);
        if (!muestras.dineroRival) muestras.dineroRival = recorte(r);
        const v = N.dinero(r);
        if (v != null) dineros[e.teamId] = { v, fuente: 'API' };
        return v != null;
      } catch (err) {
        if (err.sesion) throw err;
        if (!muestras.dineroRival) muestras.dineroRival = `no lo da: ${err.message}`;
        return false;
      }
    };
    if (await probar(sinDinero[0])) await enParalelo(sinDinero.slice(1), 3, probar);
  }
  // si la ruta devuelve lo mismo para todos, es tu saldo y no el suyo: no vale
  const deApi = Object.entries(dineros).filter(([tid, x]) => x.fuente === 'API' && tid !== (mio && mio.teamId));
  if (dinero != null && deApi.length >= 2 && deApi.every(([, x]) => x.v === dinero)) {
    for (const [tid] of deApi) delete dineros[tid];
    muestras.dineroRival = 'la ruta del dinero devuelve tu saldo para todos: no sirve para los rivales';
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
    // la pasada, la actual y las 5 siguientes (el calendario de riesgo mira los próximos 5 partidos de cada uno)
    const semanas = [jornada - 1, jornada, jornada + 1, jornada + 2, jornada + 3, jornada + 4, jornada + 5].filter((n) => n >= 1 && n <= 38);
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
  // el historial de movimientos se va guardando: la primera vez se baja hasta el principio de la liga
  // (sirve para estimar el dinero de cada rival); luego, solo lo nuevo
  const AH = actHist(liga.id);
  const conocidos = new Set(AH.lista.map(claveAct));
  let llegoAlFinal = false;
  await blando('actividad', async () => {
    // a fondo solo una vez por semana si no se llegó al principio (son muchas páginas)
    const aFondo = !AH.completa && !(AH.profundo && Date.now() - AH.profundo < 7 * DIA);
    if (aFondo) AH.profundo = Date.now();
    const paginas = aFondo ? 50 : 6;
    for (let i = 0; i < paginas; i++) {
      if (i > 3) await new Promise((ok) => setTimeout(ok, 250));
      const r = await api.actividad(liga.id, i);
      if (i === 0) muestras.actividad = recorte(r);
      const pag = N.actividad(r);
      if (!pag.length) { llegoAlFinal = true; break; }
      act.push(...pag);
      const masVieja = Math.min(...pag.map((a) => a.t || Date.now()));
      // ya se tenía guardado lo de esta página: no hace falta seguir
      if (!aFondo && pag.some((a) => conocidos.has(claveAct(a))) && Date.now() - masVieja > 2 * DIA) break;
      if (!aFondo && Date.now() - masVieja > 21 * DIA) break;
    }
  });
  // sin repetidos y lo nuevo arriba
  const vistos = new Set();
  act = act.filter((a) => { const k = claveAct(a); if (vistos.has(k)) return false; vistos.add(k); return true; }).sort((a, b) => (b.t || 0) - (a.t || 0));
  guardarActHist(liga.id, AH, act, llegoAlFinal, clasif.length);

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
    dinero, dineros, valorEquipo, jornada, partidos, resultados, tendencias, avisos, muestras, misVentas, formaciones, formacionesT,
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
        // la cláusula solo cambia si su dueño paga por subirla (o si lo vuelve a fichar, y entonces no es una subida)
        else if (f.clausula > a.get(pid).clausula * 1.001 && !(D.actividad || []).some((x) => x.pid === pid && (x.clase === 'compra' || x.clase === 'clausula') && x.t >= (viejo.t || 0) - 5 * 60e3)) H.mov.push({ t: D.t, teamId: tid, tipo: 'blinda', pid, de: a.get(pid).clausula, a: f.clausula });
      }
      for (const [pid, f] of a) if (!b.has(pid)) H.mov.push({ t: D.t, teamId: tid, tipo: 'sale', pid, clausula: f.clausula || null });
    }
    // las subidas de cláusula se guardan más tiempo: son dinero gastado y cuentan para el de cada rival
    H.mov = H.mov.filter((m) => D.t - m.t < (m.tipo === 'blinda' ? 300 : 45) * DIA).slice(-900);
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
  for (const k of ['datos', 'hist', 'ia', 'chat', 'det', 'planes', 'reventa', 'acthist', 'previs', 'chats-viejos', 'dinero-dicho', 'datos-demo', 'hist-demo', 'ia-demo', 'chat-demo', 'det-demo', 'planes-demo', 'reventa-demo', 'acthist-demo', 'previs-demo', 'chats-viejos-demo', 'dinero-dicho-demo', 'demo']) LS.del(k);
}

/* ---------- fuentes de fuera: onces probables y titulares de prensa ---------- */
export async function fuentesExternas(D, M) {
  if (!D || !M) return null;
  if (D.demo) return { onces: onceDemo(D), noticias: { t: Date.now(), lista: [] }, avanzadas: avanzadasDemo(D) };
  // las estadísticas avanzadas, de los tuyos y de los mejores candidatos; si tardan, se sigue con lo guardado
  const foco = [...new Set([
    ...M.mias.map((x) => x.pid),
    ...M.mercado.slice(0, 10).map((m) => m.pid),
    ...M.clausulas.filter((x) => x.abierta || x.abreEn < 3 * DIA).slice(0, 12).map((x) => x.pid),
    ...M.suben.slice(0, 4).map((x) => x.j.id),
  ])];
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const [onces, nots, av] = await Promise.all([
    oncesProbables(D).catch((e) => ({ error: e.message, jugadores: {} })),
    noticias(D, M).catch((e) => ({ error: e.message, lista: [] })),
    Promise.race([avanzadas(D, M, foco).catch((e) => ({ error: e.message, jugadores: {}, sofa: {}, equipos: {} })), espera(35000).then(() => LS.get('avanzadas', null) || { jugadores: {}, sofa: {}, equipos: {}, fuentes: { espera: 'tarda: se usa lo guardado' } })]),
  ]);
  return { onces, noticias: nots, avanzadas: av };
}
export const fuentesGuardadas = () => (enDemo() ? null : { onces: LS.get('onces', null), noticias: LS.get('noticias', null), avanzadas: LS.get('avanzadas', null) });

/** en la demostración, unas estadísticas avanzadas inventadas (para ver cómo salen) */
function avanzadasDemo(D) {
  let x = 11;
  const az = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const jugadores = {}, sofa = {}, equipos = {};
  for (const j of Object.values(D.maestro)) {
    if (j.pos === 5) continue;
    const min = Math.round(300 + az() * 500);
    const ata = j.pos === 4 ? 0.45 : j.pos === 3 ? 0.18 : 0.05;
    const xg = +(ata * min / 90 * (0.5 + az())).toFixed(2), xa = +((j.pos >= 3 ? 0.15 : 0.05) * min / 90 * (0.5 + az())).toFixed(2);
    jugadores[j.id] = { min, pj: Math.round(min / 80), g: Math.round(xg * (0.5 + az())), xg, a: Math.round(xa * (0.5 + az())), xa, tiros: Math.round(xg * 7 + az() * 4), pc: Math.round(xa * 9 + az() * 3) };
    sofa[j.id] = { nota: +(6.4 + az() * 1.1).toFixed(2), min, pj: Math.round(min / 80), tit: Math.round(min / 95), notas: Array.from({ length: 5 }, () => +(6 + az() * 2).toFixed(1)), entradas: Math.round(az() * 15), intercep: Math.round(az() * 10), recup: Math.round(az() * 30), regates: Math.round(az() * 12), paradas: j.pos === 1 ? Math.round(10 + az() * 20) : 0 };
  }
  for (const id of Object.keys(D.equipos || {})) equipos[id] = { pj: 9, xg: +(0.9 + az()).toFixed(2), xga: +(0.9 + az()).toFixed(2), xg5: +(0.8 + az() * 1.2).toFixed(2), xga5: +(0.8 + az() * 1.2).toFixed(2) };
  // unos cuantos con Champions, Europa League o Copa pegados a la próxima jornada (para ver la rotación)
  const calendario = {};
  const prox = (id) => (D.partidos || []).filter((p) => (p.localId === id || p.visitanteId === id) && p.fecha > Date.now() - 2 * 3600e3).sort((a, b) => a.fecha - b.fecha)[0];
  for (const [id, comp, dias, rival] of [['15', 'UEFA Champions League', -3, 'Liverpool'], ['3', 'UEFA Champions League', -3, 'Inter'], ['2', 'UEFA Champions League', 3, 'Benfica'], ['22', 'UEFA Europa League', -2, 'Ajax'], ['4', 'UEFA Conference League', 4, 'Fiorentina'], ['17', 'Copa del Rey', 3, 'CD Ebro']]) {
    const p = prox(id);
    if (p) calendario[id] = [{ t: p.fecha + dias * DIA, comp, liga: false, rival, casa: dias > 0 }, { t: p.fecha, comp: 'LaLiga', liga: true, rival: '', casa: p.localId === id }];
  }
  return { t: Date.now(), jugadores, sofa, equipos, calendario, fuentes: { understat: 'ejemplo', sofascore: 'ejemplo', calendario: 'ejemplo' } };
}

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
