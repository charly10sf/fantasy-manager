// Los hechos de la previa de una jornada para la web (guias/jornada-N.html). Solo datos que ya usa el bot: la API de LaLiga sin
// token (calendario, estados, fichas, histórico de valor) y las listas de sancionados, apercibidos y lesionados de la web de previas
// (lib/disciplina.mjs, lib/partes.mjs; nunca se nombra la web). Nada de la liga de nadie: es lo mismo para todas las ligas.
// Sale un objeto JSON que guarda .github/previas/N.json; el texto lo escribe otro paso (web/texto.mjs) a partir de esto.
import { semanaActual, jugadores as pedirJugadores, statsSemana, equiposDe, ficha as pedirFicha, valorMercado } from '../lib/laliga.mjs';
import { disciplina, casar, amarillasDe } from '../lib/disciplina.mjs';
import { lesionados, parteDe, motivoSancion } from '../lib/partes.mjs';
import { baseTitular } from '../tipos/caidas.mjs';
import { enParalelo } from '../lib/http.mjs';
import { corto } from '../lib/texto.mjs';
import { tablaDe, nivelDe } from '../lib/info-jugador.mjs';
import { PROB } from './mercado.mjs';

const HORA = 36e5, DIA = 24 * HORA;
export const VEDA_H = 24;   // el cierre de cláusulas: 24 h antes del primer partido (motor.js, M.VEDA_H)
const POS = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero' };
const num = (x) => Number(x) || 0;
// pesa en el fantasy (lo mismo que tipos/sancionados.mjs): titular habitual, buena media o mucho valor
const pesa = (j, b) => (b && b.p >= 0.5) || num(j.averagePoints) >= 3 || num(j.marketValue) >= 8e6;
// (sesión 3 de AdSense, idea 6) los chollos de la jornada: baratos, titulares, con racha al alza y rival asequible. El corte de «barato»
// sale de los datos del 16 nov: de los 139 titulares de entonces (60 minutos o más en 4 de sus 5 últimos partidos), el 25 % más barato
// valía menos de 6,1 M (y 5,95 M para que «6,0 M» no salga en la tabla con el corte en «menos de 6 M»). Si se cambia, cambiar también metodo.html#chollos
export const CHOLLO = { valor: 6e6, media: 3, racha: 3, ult5: 4 };
const puntosValor = (h) => (Array.isArray(h) ? h : []).map((v) => ({ t: Date.parse(v.date), v: num(v.marketValue) })).filter((x) => x.t && x.v > 0).sort((a, b) => a.t - b.t);

/** los días de cambio de mercado (hacia las 00:15 de Madrid) entre dos momentos: [t, …] */
export function cambiosMercado(desde, hasta) {
  const out = [];
  // 00:15 de Madrid es 23:15 UTC del día de antes en invierno y 22:15 en verano: se busca hora a hora
  for (let t = Math.ceil(desde / HORA) * HORA; t < hasta; t += HORA) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t));
    if (p === '00' && t + 15 * 6e4 < hasta && t + 15 * 6e4 > desde) out.push(t + 15 * 6e4);
  }
  return out;
}

/** el partido de cada equipo en esa jornada: { teamId: { rival, casa, t } } */
function partidosPorEquipo(stats, equipos) {
  const r = {};
  for (const m of stats) {
    const t = Date.parse(m.date), l = String(m.local.id), v = String(m.visitor.id);
    r[l] = { rival: corto(equipos[v] || m.visitor.mainName), rivalId: v, casa: true, t };
    r[v] = { rival: corto(equipos[l] || m.local.mainName), rivalId: l, casa: false, t };
  }
  return r;
}

/**
 * Los hechos de la jornada `jornada` (por defecto, la que viene). `ahora` para las pruebas. Devuelve null si la jornada ya ha
 * empezado (la previa no tiene sentido) o no hay calendario.
 */
// completo (la página de bajas/, sesión 4 de AdSense): las listas enteras, sin recortar, y el parte de cada uno; sinMercado: sin bajar el
// histórico de valor de todos (bajas/ ya lo tiene del mercado de esa noche)
export async function hechosJornada({ jornada = null, ahora = Date.now(), log = () => {}, api = {}, completo = false, sinMercado = false } = {}) {
  const semana = api.semanaActual || semanaActual, jugadores = api.jugadores || pedirJugadores, semanaStats = api.statsSemana || statsSemana;
  const ficha = api.ficha || pedirFicha, valor = api.valorMercado || valorMercado, pagina = api.disciplina || disciplina, partes = api.lesionados || lesionados;
  const sem = await semana();
  let J = jornada || sem.weekNumber;
  let stats = await semanaStats(J);
  // si la actual ya ha empezado, la siguiente
  if (!jornada && stats.some((m) => m.matchState !== 1)) { J = sem.nextWeek; stats = await semanaStats(J); }
  if (!stats.length) return null;
  const orden = [...stats].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const primero = Date.parse(orden[0].date);
  const equipos = equiposDe(stats);
  const nombreClub = (id) => corto(equipos[String(id)] || '?');
  const partidos = orden.map((m) => ({ t: Date.parse(m.date), local: nombreClub(m.local.id), visitante: nombreClub(m.visitor.id), jugado: m.matchState === 7 }));
  const pp = partidosPorEquipo(stats, equipos);
  const sig = await semanaStats(J + 1).catch(() => []);
  const ant = J > 1 ? await semanaStats(J - 1).catch(() => []) : [];
  const finAnterior = ant.length ? Math.max(...ant.map((m) => Date.parse(m.date))) : null;
  const pp2 = sig.length ? partidosPorEquipo(sig, { ...equipos, ...equiposDe(sig) }) : {};

  const todos = await jugadores();
  const enLiga = todos.filter((j) => j.playerStatus !== 'out_of_league' && j.positionId >= 1 && j.positionId <= 4);
  const base = (j) => ({ id: String(j.id), nombre: j.nickname, equipo: nombreClub(j.teamId), pos: POS[j.positionId] || '',
    media: Math.round(num(j.averagePoints) * 10) / 10, valor: num(j.marketValue), rival: (pp[String(j.teamId)] || {}).rival || null,
    casa: (pp[String(j.teamId)] || {}).casa ?? null });

  // fichas: las de sancionados, lesionados y dudas, y las de los que la web da por apercibidos o disponibles tras una lesión
  const [webSan, webAp, listaPartes] = await Promise.all([pagina('sancionados', { log }), pagina('apercibidos', { log }), partes({ log })]);
  const cand = new Map();
  for (const j of enLiga) if (['suspended', 'injured', 'doubtful'].includes(j.playerStatus)) cand.set(String(j.id), j);
  for (const w of webAp) { const j = casar(w, enLiga, equipos); if (j) cand.set(String(j.id), j); }
  const partesDe = new Map();
  for (const j of enLiga) { const p = parteDe(j, listaPartes); if (p) { partesDe.set(String(j.id), p); if (p.estado === 'disponible' && (p.dias || 0) >= 10) cand.set(String(j.id), j); } }
  const lista = [...cand.values()];
  const fs = await enParalelo(lista, 6, (j) => ficha(j.id).catch(() => null));
  const fichaDe = new Map(lista.map((j, i) => [String(j.id), fs[i]]));
  log(`  (previa web) jornada ${J}: ${lista.length} fichas`);
  const titular = (j) => { const f = fichaDe.get(String(j.id)); return f ? baseTitular(f.playerStats, J - 1) : null; };
  const pct = (b) => (b ? Math.round(b.b * 100) : null);   // partidos de más de 60' en la temporada, en %

  // sancionados: LaLiga dice quién; la web, el motivo (o la ficha)
  const sancionados = [];
  for (const j of enLiga.filter((x) => x.playerStatus === 'suspended')) {
    const b = titular(j);
    if (!pesa(j, b)) continue;
    const w = webSan.find((x) => casar(x, [j], equipos)) || null;
    const ms = motivoSancion(fichaDe.get(String(j.id)));
    const motivo = w && w.motivo === 'roja' ? 'roja directa' : w && w.motivo === 'amarillas' ? 'quinta amarilla'
      : w && w.motivo === 'disciplinaria' && w.partido && w.de ? `sanción de ${w.de} partidos (cumple el ${w.partido}.º)` : ms ? ms.txt.toLowerCase() : 'sanción';
    sancionados.push({ ...base(j), motivo, titularPct: pct(b), ...(completo && w && w.motivo === 'disciplinaria' && w.de ? { partidos: Number(w.de), cumple: Number(w.partido) || null } : {}) });
  }
  // apercibidos: la web los da y la ficha de LaLiga cuenta 4, 9, 14… amarillas; solo titulares habituales que juegan
  const apercibidos = [];
  for (const w of webAp) {
    const j = casar(w, enLiga, equipos);
    if (!j || !['ok', 'doubtful'].includes(j.playerStatus || 'ok') || apercibidos.some((x) => x.id === String(j.id))) continue;
    const am = amarillasDe(fichaDe.get(String(j.id)));
    const b = titular(j);
    if (am == null || am % 5 !== 4 || !b || b.p < 0.6) continue;
    const s2 = pp2[String(j.teamId)];
    apercibidos.push({ ...base(j), amarillas: am, titularPct: pct(b), rivalSiguiente: s2 ? s2.rival : null });
  }
  // bajas y dudas que pesan, con el parte
  const conParte = (j) => { const p = partesDe.get(String(j.id)); return p ? { lesion: p.lesion || null, desdeDias: p.dias ?? null, hasta: p.hasta || null, parteEstado: p.estado || null } : {}; };
  const bajas = [], dudas = [];
  for (const j of enLiga.filter((x) => x.playerStatus === 'injured' || x.playerStatus === 'doubtful')) {
    const b = titular(j);
    if (!pesa(j, b)) continue;
    (j.playerStatus === 'injured' ? bajas : dudas).push({ ...base(j), ...conParte(j), titularPct: pct(b), ...(completo ? { parte: partesDe.get(String(j.id)) || null } : {}) });
  }
  // vuelven: el parte los da disponibles para esta jornada tras 10 días o más fuera y LaLiga ya no los tiene de baja
  const vuelven = [];
  for (const j of enLiga) {
    const p = partesDe.get(String(j.id));
    if (!p || p.estado !== 'disponible' || (p.dias || 0) < 10 || (p.jornada && p.jornada !== J) || j.playerStatus === 'injured' || j.playerStatus === 'suspended') continue;
    const b = titular(j);
    if (!pesa(j, b)) continue;
    vuelven.push({ ...base(j), lesion: p.lesion || null, diasFuera: p.dias, titularPct: pct(b), estadoLaLiga: j.playerStatus === 'doubtful' ? 'duda' : 'disponible' });
  }

  // el mercado de los últimos 7 días: de todos los que valen 1 M o más
  const conValor = sinMercado ? [] : enLiga.filter((j) => num(j.marketValue) >= 1e6);
  const hist = await enParalelo(conValor, 25, (j) => valor(j.id).catch(() => null));
  const filas = [];
  conValor.forEach((j, i) => {
    const h = puntosValor(hist[i]);
    if (h.length < 9) return;
    const fin = h[h.length - 1], ini = h[h.length - 8];
    let racha = 0;
    for (let k = h.length - 1; k > 0 && h[k].v > h[k - 1].v; k--) racha++;
    let rachaBaja = 0;
    for (let k = h.length - 1; k > 0 && h[k].v < h[k - 1].v; k--) rachaBaja++;
    filas.push({ ...base(j), teamId: String(j.teamId), valor: fin.v, dif7: fin.v - ini.v, pct7: Math.round(((fin.v - ini.v) / ini.v) * 1000) / 10,
      ultimoDia: fin.v - h[h.length - 2].v, diaAnterior: h[h.length - 2].v - h[h.length - 3].v, diasSubiendo: racha, diasBajando: rachaBaja, estado: j.playerStatus || 'ok', fechaValor: fin.t });
  });
  const ord = (k, s) => [...filas].sort((a, b) => s * (b[k] - a[k]));
  const suben = ord('dif7', 1).filter((x) => x.dif7 > 0).slice(0, 6);
  const bajan = ord('dif7', -1).filter((x) => x.dif7 < 0).slice(0, 6);
  const fechaValor = filas.length ? Math.max(...filas.map((x) => x.fechaValor)) : null;

  // los chollos (idea 6): primero lo que no pide fichas (precio, media, racha, estado y rival); luego, la ficha de los que quedan
  const chollos = { criterio: CHOLLO, lista: [], mirados: 0 };
  if (!sinMercado) {
    const jugadas = (await enParalelo(Array.from({ length: Math.max(0, J - 1) }, (_, i) => i + 1), 4, (k) => semanaStats(k).catch(() => []))).flat();
    const tabla = tablaDe(jugadas);
    const nivel = (x) => { const p = pp[x.teamId]; return p ? nivelDe(tabla.porId[String(p.rivalId)], tabla) || 'media' : null; };
    const previos = filas.filter((x) => x.estado === 'ok' && x.valor < CHOLLO.valor - 5e4 && x.media >= CHOLLO.media && x.diasSubiendo >= CHOLLO.racha && x.rival && nivel(x) !== 'difícil');
    const sinFicha = previos.filter((x) => !fichaDe.has(x.id));
    const fs2 = await enParalelo(sinFicha, 6, (x) => ficha(x.id).catch(() => null));
    sinFicha.forEach((x, i) => fichaDe.set(x.id, fs2[i]));
    chollos.mirados = previos.length;
    for (const x of previos) {
      const f = fichaDe.get(x.id);
      const b = f ? baseTitular(f.playerStats, J - 1) : null;
      if (!b || b.ult < 5 || Math.round(b.a * 5) < CHOLLO.ult5) continue;
      // lo que suele pasar con una racha así (las cifras de guias/valor-de-mercado.html, como «Mañana» en /mercado/)
      const [prob, por] = x.diaAnterior > 0 && x.ultimoDia > x.diaAnterior ? [PROB.acelera, 'acelera'] : x.diaAnterior > 0 && x.ultimoDia < x.diaAnterior / 2 ? [PROB.frena, 'frena']
        : x.diasSubiendo >= 4 ? [PROB.sube4, 'sube4'] : [PROB.sube3, 'sube3'];
      chollos.lista.push({ ...x, nivelRival: nivel(x), ult5: Math.round(b.a * 5), titularPct: pct(b), prob, por });
    }
    chollos.lista.sort((a, b) => b.media - a.media || a.valor - b.valor);
    chollos.lista = chollos.lista.slice(0, 6);
    log(`  (previa web) chollos: ${previos.length} sin mirar la ficha, ${chollos.lista.length} cumplen todo`);
  }

  const porValor = (a, b) => b.valor - a.valor;
  const cierre = primero - VEDA_H * HORA;
  return {
    jornada: J, generada: ahora, primero, ultimo: Date.parse(orden[orden.length - 1].date), cierre, reapertura: primero,
    partidos, primerPartido: partidos[0], cambiosAntesDelCierre: cambiosMercado(ahora, cierre),
    diasDesdeAnterior: finAnterior ? Math.round((primero - finAnterior) / DIA) : null,
    sancionados: sancionados.sort(porValor), apercibidos: apercibidos.sort(porValor),
    bajas: bajas.sort(porValor).slice(0, completo ? 99 : 10), dudas: dudas.sort(porValor).slice(0, completo ? 99 : 8), vuelven: vuelven.sort(porValor).slice(0, completo ? 99 : 8),
    suben, bajan, fechaValor, jugadoresMirados: filas.length, chollos,
  };
}

/** ¿la previa se puede (re)hacer ahora? solo antes del cierre de cláusulas */
export const antesDelCierre = (h, ahora = Date.now()) => ahora < h.cierre;
export { DIA, HORA };
