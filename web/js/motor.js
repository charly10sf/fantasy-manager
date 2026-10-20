/* El cerebro sin IA: con la foto de la liga (D) y el histórico (H) calcula todo lo que la app enseña.
   Cláusulas de los rivales y cuánto interesa cada una, el riesgo de las tuyas, el mercado, quién sube y
   quién baja, lo que has ganado con tus compras, cómo se mueve cada rival, la jornada, los parones y la
   lista de lo que toca hacer ahora. Todo con números que se pueden comprobar. */
import { num, clamp, DIA, HORA, MIN, diaDe, eur, pct, dura, cuando, POS, norm } from './util.js';

// parones de selecciones conocidos de la temporada 26/27 (FIFA). Los demás se sacan del calendario.
const PARONES = [
  { ini: Date.parse('2026-11-09T00:00:00+01:00'), fin: Date.parse('2026-11-17T23:59:00+01:00'), nombre: 'Parón de selecciones de noviembre' },
];
const MALOS = new Set(['injured', 'suspended', 'out_of_league']);

export function analizar(D, H, c, extra = {}) {
  const M = { t: Date.now() };
  if (!D) return M;
  const ahora = Date.now();
  const J = (pid) => D.maestro[pid] || { id: pid, nombre: 'Jugador', valor: 0, media: 0, puntos: 0, pos: 0, estado: 'ok' };
  M.J = J;
  const yoTid = D.yo && D.yo.teamId;
  const yoEntrada = D.clasif.find((e) => e.teamId === yoTid) || null;
  M.yo = yoEntrada;

  /* ---------- quién es de quién ---------- */
  M.dueno = {};
  for (const [tid, fichas] of Object.entries(D.plantillas || {})) for (const f of fichas) M.dueno[f.pid] = tid;
  M.equipo = Object.fromEntries(D.clasif.map((e) => [e.teamId, e]));
  const porManager = {};
  for (const e of D.clasif) { if (e.manager) porManager[norm(e.manager)] = e.teamId; if (e.nombre) porManager[norm(e.nombre)] = e.teamId; }
  M.teamDeManager = (nombre) => porManager[norm(nombre)] || null;
  const porUsuario = {};
  for (const e of D.clasif) { if (e.userId) porUsuario[e.userId] = e.teamId; if (e.managerId) porUsuario[e.managerId] = e.teamId; }
  if (D.yo && D.yo.userId && yoTid) porUsuario[D.yo.userId] = yoTid;
  M.teamDeUsuario = (id, nombre) => (id && porUsuario[id]) || M.teamDeManager(nombre);
  const nombreEquipo = (tid) => { const e = tid && M.equipo[tid]; return e ? e.manager || e.nombre : ''; };

  /* ---------- forma reciente (de la ficha de cada jugador, si se ha bajado) ---------- */
  const det = extra.det || {};
  M.forma = (pid) => {
    const d = det[pid];
    if (!d || !d.stats || !d.stats.length) {
      const sem = (D.maestro[pid] || {}).semanas;
      if (!sem || !sem.length) return null;
      const u = sem.slice(-5);
      return { pts: u.map((x) => x.pts), media: u.reduce((a, x) => a + x.pts, 0) / u.length, jugados: null, de: u.length, min: null };
    }
    const ult = d.stats.slice(-5);
    return { pts: ult.map((x) => x.pts), media: ult.reduce((a, x) => a + x.pts, 0) / ult.length, jugados: ult.filter((x) => x.min > 0).length, de: ult.length, min: ult.reduce((a, x) => a + x.min, 0) };
  };

  /* ---------- tendencias de valor ---------- */
  const cacheT = {};
  M.tend = (pid) => {
    if (cacheT[pid]) return cacheT[pid];
    let s = (H.v && H.v[pid]) || [];
    const dv = det[pid] && det[pid].valores;
    if (dv && dv.length > s.length) s = dv.map(([t, v]) => [diaDe(t), v]);
    const ff = (D.tendencias || {})[pid] || {};
    const valor = J(pid).valor;
    const hace = (dias) => {
      const objetivo = diaDe(ahora - dias * DIA);
      let mejor = null;
      for (const [d, v] of s) if (d <= objetivo) mejor = v;
      return mejor;
    };
    const v1 = hace(1), v7 = hace(7), v30 = hace(30);
    const d1 = ff.d1 != null ? ff.d1 : v1 ? valor - v1 : null;
    const p1 = ff.p1 != null ? ff.p1 : v1 ? (valor / v1 - 1) * 100 : null;
    const d7 = v7 ? valor - v7 : ff.d7 != null ? ff.d7 : null;
    const p7 = v7 ? (valor / v7 - 1) * 100 : ff.p7 != null ? ff.p7 : null;
    const serie = s.map(([d, v]) => [Date.parse(d + 'T12:00:00'), v]);
    return (cacheT[pid] = { d1, p1, d7, p7, d30: v30 ? valor - v30 : null, serie });
  };

  /* ---------- jornada, partidos y parones ---------- */
  const porJornada = {};
  for (const p of D.partidos || []) if (p.fecha) (porJornada[p.jornada] ||= []).push(p);
  const jornadas = Object.entries(porJornada).map(([n, ps]) => ({
    n: +n, ini: Math.min(...ps.map((p) => p.fecha)), fin: Math.max(...ps.map((p) => p.fecha)) + 2 * HORA, partidos: ps,
  })).sort((a, b) => a.ini - b.ini);
  M.jornadas = jornadas;
  M.enJuego = jornadas.find((j) => j.ini <= ahora && ahora <= j.fin) || null;
  M.proxima = jornadas.find((j) => j.ini > ahora) || null;
  const parones = [...PARONES];
  for (let i = 1; i < jornadas.length; i++) {
    const a = jornadas[i - 1], b = jornadas[i];
    if (b.ini - a.fin > 9 * DIA && !parones.some((p) => p.ini < b.ini && p.fin > a.fin)) parones.push({ ini: a.fin, fin: b.ini, nombre: 'Parón de selecciones', delCalendario: true });
  }
  M.paron = parones.filter((p) => p.fin > ahora).sort((a, b) => a.ini - b.ini)[0] || null;
  M.enParon = !!(M.paron && M.paron.ini <= ahora);
  M.proximoPartido = (eqId) => {
    for (const j of jornadas) for (const p of j.partidos) {
      if (p.fecha + 2 * HORA < ahora) continue;
      if (p.localId === eqId) return { ...p, casa: true, rival: p.visitante, rivalId: p.visitanteId };
      if (p.visitanteId === eqId) return { ...p, casa: false, rival: p.local, rivalId: p.localId };
    }
    return null;
  };

  /* ---------- la clasificación de LaLiga y lo difícil que es cada rival ---------- */
  const tabla = {};
  for (const p of [...(D.resultados || [])].sort((a, b) => (a.jornada || 0) - (b.jornada || 0))) {
    for (const [id, gf, gc, rid, casa] of [[p.localId, p.gl, p.gv, p.visitanteId, true], [p.visitanteId, p.gv, p.gl, p.localId, false]]) {
      const t = (tabla[id] ||= { id, pj: 0, pts: 0, gf: 0, gc: 0, ult: [] });
      t.pj++; t.gf += gf; t.gc += gc; t.pts += gf > gc ? 3 : gf === gc ? 1 : 0;
      t.ult.push({ r: gf > gc ? 'V' : gf === gc ? 'E' : 'D', gf, gc, rid, casa, jornada: p.jornada });
    }
  }
  const filas = Object.values(tabla).filter((t) => t.pj > 0).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
  filas.forEach((t, i) => { t.pos = i + 1; t.nombre = (D.equipos[t.id] || {}).nombre || t.id; });
  M.tabla = filas;
  const totPj = filas.reduce((s, t) => s + t.pj, 0);
  const mediaGoles = totPj ? filas.reduce((s, t) => s + t.gf, 0) / totPj : 1.3;
  const mediaPts = totPj ? filas.reduce((s, t) => s + t.pts, 0) / totPj : 1.4;
  M.equipoLiga = (id) => tabla[id] || null;
  /** cómo le va a un equipo: sus últimos partidos (V/E/D, goles) */
  M.racha = (id, n = 5) => {
    const t = tabla[id];
    if (!t || !t.ult.length) return null;
    const u = t.ult.slice(-n);
    return { txt: u.map((x) => x.r).join('-'), gf: u.reduce((s, x) => s + x.gf, 0), gc: u.reduce((s, x) => s + x.gc, 0), pts: u.reduce((s, x) => s + (x.r === 'V' ? 3 : x.r === 'E' ? 1 : 0), 0), de: u.length, ult: u };
  };
  /* ---------- el historial de cada jugador contra quién jugó, y la previa de su próximo partido ---------- */
  const resPor = {};
  for (const p of D.resultados || []) {
    resPor[`${p.jornada}:${p.localId}`] = { rivalId: p.visitanteId, casa: true, gf: p.gl, gc: p.gv };
    resPor[`${p.jornada}:${p.visitanteId}`] = { rivalId: p.localId, casa: false, gf: p.gv, gc: p.gl };
  }
  const nombreEq = (id) => (D.equipos[id] || {}).nombre || id;
  /** sus últimas jornadas: puntos, minutos, rival, en casa o fuera y el resultado */
  M.historial = (j, n = 6) => {
    if (!j) return [];
    const d = det[j.id];
    const base = d && d.stats && d.stats.length ? d.stats : (j.semanas || []).map((w) => ({ n: w.n, pts: w.pts, min: null }));
    return base.slice(-n).map((s) => {
      const r = resPor[`${s.n}:${j.equipoId}`];
      const t = r && tabla[r.rivalId];
      return { ...s, rival: r ? nombreEq(r.rivalId) : null, rivalId: r ? r.rivalId : null, casa: r ? r.casa : null, gf: r ? r.gf : null, gc: r ? r.gc : null, posRival: t ? t.pos : null };
    });
  };
  /** cuánto rinde en casa y fuera, y contra los de arriba y los de abajo de la tabla */
  M.rendimiento = (j) => {
    const h = M.historial(j, 38).filter((x) => x.rivalId && (x.min == null || x.min > 0));
    if (h.length < 3) return null;
    const m = (l) => (l.length ? { m: l.reduce((s, x) => s + x.pts, 0) / l.length, n: l.length } : null);
    const nT = filas.length || 20;
    return { casa: m(h.filter((x) => x.casa)), fuera: m(h.filter((x) => x.casa === false)), arriba: m(h.filter((x) => x.posRival && x.posRival <= 6)), abajo: m(h.filter((x) => x.posRival && x.posRival > nT - 6)) };
  };
  /* ---------- estadísticas avanzadas (Understat y SofaScore) ---------- */
  const av = extra.avanzadas || {};
  M.avanzado = (pid) => { const u = (av.jugadores || {})[pid], s = (av.sofa || {})[pid]; return u || s ? { u: u || null, s: s || null } : null; };
  M.xgEquipo = (id) => (av.equipos || {})[id] || null;
  M.fuentesAv = av.fuentes || null;
  const xgMedia = (() => { const l = Object.values(av.equipos || {}).filter((e) => e.xg != null); return l.length ? l.reduce((s, e) => s + e.xg, 0) / l.length : null; })();

  /** la previa de su próximo partido: cómo llegan los dos equipos, los goles que se esperan y la portería a cero */
  M.previa = (j) => {
    const p = j && M.proximoPartido(j.equipoId);
    if (!p) return null;
    const tu = tabla[j.equipoId], ri = tabla[p.rivalId];
    const out = { p, rival: p.rival, casa: p.casa, posRival: ri ? ri.pos : null, nivel: nivelDe(ri), rachaTu: M.racha(j.equipoId), rachaRi: M.racha(p.rivalId) };
    if (tu && ri && tu.pj >= 3 && ri.pj >= 3) {
      out.golesFavor = (tu.gf / tu.pj) * (ri.gc / ri.pj) / mediaGoles * (p.casa ? 1.1 : 0.9);
      out.golesContra = (ri.gf / ri.pj) * (tu.gc / tu.pj) / mediaGoles * (p.casa ? 0.9 : 1.1);
      out.cero = Math.exp(-out.golesContra);
      out.rivalMarca = ri.gf / ri.pj; out.rivalEncaja = ri.gc / ri.pj;
      // cómo le va al rival jugando donde le toca (fuera si tú juegas en casa)
      // con el xG de Understat (lo que generan y conceden de verdad) si lo hay, que dice más que los goles
      const xt = M.xgEquipo(j.equipoId), xr = M.xgEquipo(p.rivalId);
      if (xt && xr && xgMedia && xt.xg != null && xr.xga != null) {
        out.xg = { tu: xt, ri: xr };
        out.golesFavor = (xt.xg * xr.xga) / xgMedia * (p.casa ? 1.1 : 0.9);
        out.golesContra = (xr.xg * xt.xga) / xgMedia * (p.casa ? 0.9 : 1.1);
        out.cero = Math.exp(-out.golesContra);
      }
      const sitio = ri.ult.filter((x) => x.casa === !p.casa);
      if (sitio.length) out.rivalSitio = { v: sitio.filter((x) => x.r === 'V').length, e: sitio.filter((x) => x.r === 'E').length, d: sitio.filter((x) => x.r === 'D').length, gf: sitio.reduce((s, x) => s + x.gf, 0), gc: sitio.reduce((s, x) => s + x.gc, 0) };
    }
    return out;
  };

  /** los resultados de la última jornada jugada */
  const jUlt = Math.max(0, ...(D.resultados || []).map((p) => p.jornada || 0));
  M.ultimaJornada = jUlt ? { n: jUlt, partidos: (D.resultados || []).filter((p) => p.jornada === jUlt) } : null;
  /**
   * lo que cambia lo que se espera de un jugador según su próximo rival (0,75 a 1,25):
   * porteros y defensas, según lo que marca el rival; medios y delanteros, según lo que encaja; más la fuerza
   * general del rival (puntos por partido) y si juega en casa
   */
  M.factorRival = (j) => {
    const p = j && M.proximoPartido(j.equipoId);
    if (!p) return { f: 1, p: null };
    const r = tabla[p.rivalId];
    if (!r || r.pj < 3) return { f: p.casa ? 1.04 : 0.96, p, nivel: null };
    const ataque = r.gf / r.pj / mediaGoles, defensa = r.gc / r.pj / mediaGoles, fuerza = r.pts / r.pj / mediaPts;
    const base = j.pos <= 2 ? 1 / Math.max(0.4, ataque) : defensa;
    let f = 0.55 + 0.25 * base + 0.2 / Math.max(0.4, fuerza);
    f *= p.casa ? 1.05 : 0.95;
    f = clamp(f, 0.75, 1.25);
    return { f, p, r, nivel: nivelDe(r) };
  };
  function nivelDe(r) {
    if (!r || r.pj < 3) return null;
    const fuerza = r.pts / r.pj / mediaPts;
    return fuerza >= 1.25 || r.pos <= 4 ? 'difícil' : fuerza <= 0.8 || r.pos >= filas.length - 3 ? 'fácil' : 'media';
  }
  /** los próximos partidos de un equipo con lo difícil que es cada rival (para ver rachas) */
  M.calendarioDe = (eqId, n = 3) => {
    const out = [];
    for (const jo of jornadas) for (const p of jo.partidos) {
      if (out.length >= n || p.fecha + 2 * HORA < ahora) continue;
      const casa = p.localId === eqId;
      if (!casa && p.visitanteId !== eqId) continue;
      const rid = casa ? p.visitanteId : p.localId, r = tabla[rid];
      out.push({ jornada: jo.n, fecha: p.fecha, casa, rival: casa ? p.visitante : p.local, rivalId: rid, pos: r && r.pos, nivel: nivelDe(r) });
    }
    return out;
  };

  /* ---------- dinero ---------- */
  M.misPujas = (D.mercado || []).reduce((s, m) => s + num(m.miPuja), 0);
  M.deuda = Math.floor(num(D.valorEquipo) * num(c.deuda) / 100);
  M.pujaMax = num(D.dinero) + M.deuda - M.misPujas;
  M.negativo = D.dinero != null && D.dinero < 0;

  /* ---------- fichas (jugador en un equipo de tu liga) ---------- */
  const enriquecer = (f, tid) => {
    const j = J(f.pid), t = M.tend(f.pid);
    const abierta = !f.protegidoHasta || f.protegidoHasta <= ahora;
    return {
      ...f, j, teamId: tid, tend: t, abierta,
      abreEn: abierta ? 0 : f.protegidoHasta - ahora,
      ratio: j.valor ? f.clausula / j.valor : null,
      sobre: f.clausula - j.valor,
    };
  };

  /* ---------- tu once: posiciones, formaciones gratuitas y huecos ---------- */
  const misFichasRaw = (D.plantillas || {})[yoTid] || [];
  M.formaciones = (D.formaciones && D.formaciones.length ? D.formaciones : FORMACIONES).map(partirFormacion).filter(Boolean);
  const onces = (extra.onces && extra.onces.jugadores) || {};
  M.hayOnces = Object.keys(onces).length > 0;
  M.onceProb = (pid) => onces[pid] || null;
  M.noticias = (extra.noticias && extra.noticias.lista) || [];
  M.noticiasDe = (pid) => M.noticias.filter((n) => n.pids && n.pids.includes(pid));
  M.ppEsperado = (j) => puntosEsperados(j, M.forma(j.id), M.hayOnces ? (onces[j.id] || { fuera: true }) : null) * M.factorRival(j).f;
  M.mejorOnce = (lista) => mejorOnce(lista, M.formaciones, M.ppEsperado);
  const misJs = misFichasRaw.map((f) => J(f.pid));
  M.once = M.mejorOnce(misJs);
  /** cuántos puntos por jornada gana tu once si fichas a j (0 si se quedaría en el banquillo) */
  const cacheMejora = {};
  M.mejora = (j) => {
    if (!j || !j.pos) return 0;
    if (misJs.some((x) => x.id === j.id)) return 0;
    if (cacheMejora[j.id] != null) return cacheMejora[j.id];
    return (cacheMejora[j.id] = Math.max(0, M.mejorOnce([...misJs, j]).total - M.once.total));
  };
  /** cuántos puntos pierde tu once si vendes a j (0 si es suplente) */
  const cachePerdida = {};
  M.perdida = (pid) => {
    if (cachePerdida[pid] != null) return cachePerdida[pid];
    return (cachePerdida[pid] = Math.max(0, M.once.total - M.mejorOnce(misJs.filter((x) => x.id !== pid)).total));
  };
  // por puesto: cuántos tienes sanos, cuántos necesitas en tu mejor formación y si te sobran
  const MAXIMO = { 1: 1, 2: 5, 3: 5, 4: 3, 5: 1 };
  M.puestos = [1, 2, 3, 4].map((p) => {
    const sanos = misJs.filter((j) => j.pos === p && !MALOS.has(j.estado)).length;
    const total = misJs.filter((j) => j.pos === p).length;
    const necesita = M.once.formacion ? (p === 1 ? 1 : M.once.formacion[p - 2]) : 0;
    const minimo = p === 1 ? 1 : Math.min(...M.formaciones.map((f) => f[p - 2]));
    return { pos: p, sanos, total, necesita, faltan: Math.max(0, minimo - sanos), sobran: Math.max(0, sanos - (MAXIMO[p] + 1)) };
  });

  /* ---------- cuánto interesa un jugador (0 a 100) ---------- */
  M.interes = (j, precio, t = M.tend(j.id)) => {
    const partes = [];
    const rend = clamp(num(j.media) / 7, 0, 1.3) * 30;
    if (j.media) partes.push(`${String(Math.round(j.media * 10) / 10).replace('.', ',')} pts de media`);
    const mov = t.p7 != null ? t.p7 : t.p1 != null ? t.p1 * 3 : 0;
    const momentum = clamp(mov / 10, -1, 1) * 15;
    if (t.p7 != null && Math.abs(t.p7) >= 2) partes.push(`${t.p7 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p7), 1, false)} en 7 días`);
    else if (t.p1 != null && Math.abs(t.p1) >= 1) partes.push(`${t.p1 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p1), 1, false)} hoy`);
    const ratio = j.valor ? precio / j.valor : 2;
    const barato = clamp((1.6 - ratio) / 0.6, 0, 1) * 20;
    // pagar de más se pierde en el valor del equipo: castiga a partir de un 15 % y mucho a partir del 40 %
    const caro = ratio > 1.15 ? clamp((ratio - 1.15) / 0.45, 0, 1) * 45 : 0;
    if (ratio <= 1.05) partes.push('cuesta lo que vale');
    else partes.push(`cuesta un ${Math.round((ratio - 1) * 100)} % más de lo que vale (${eur(precio - j.valor, { signo: true })})`);
    let pen = 0;
    if (MALOS.has(j.estado)) { pen = j.estado === 'out_of_league' ? 80 : 35; partes.push(j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga'); }
    else if (j.estado === 'doubtful') { pen = 12; partes.push('es duda'); }
    // titular o no en su equipo (once probable de futbolfantasy)
    const op = M.onceProb(j.id);
    let fueraOnce = 0;
    if (op && op.titular) partes.push(`titular probable${op.prob != null ? ` (${op.prob} %)` : ''}`);
    else if (op && op.alternativa) { fueraOnce = 10; partes.push('suplente en el once probable'); }
    else if (M.hayOnces && j.pos !== 5 && !op) { fueraOnce = 6; partes.push('no sale en el once probable'); }
    // el próximo rival: no es lo mismo el Barça que el colista
    const fr = M.factorRival(j);
    let rival = 0;
    if (fr.p && fr.nivel) { rival = Math.round((fr.f - 1) * 30); partes.push(`${fr.p.casa ? 'recibe' : 'visita'} al ${fr.p.rival} (${fr.r.pos}º, ${fr.nivel})`); }
    // lo que aporta a TU once: si entra de titular, cuánto suma; si no, si el puesto ya está lleno
    let once = 0;
    const mio = misJs.some((x) => x.id === j.id);
    if (!mio && j.pos && j.pos < 5) {
      const gana = M.mejora(j);
      const puesto = M.puestos.find((p) => p.pos === j.pos);
      if (gana >= 0.3) { once = clamp(gana * 5, 4, 25); partes.push(puesto && puesto.faltan ? `te tapa un hueco en ${NOMBRE_POS[j.pos]} (+${dec1(gana)} pts/jornada)` : `mejora tu once +${dec1(gana)} pts/jornada`); }
      else { once = puesto && puesto.sobran ? -18 : -6; partes.push(puesto && puesto.sobran ? `te sobran ${NOMBRE_POS[j.pos]}` : 'no entraría en tu once'); }
    }
    return { n: Math.round(clamp(rend + momentum + barato + 12 - pen - fueraOnce + once + rival - caro, 0, 100)), por: partes, once };
  };

  /* ---------- tus jugadores ---------- */
  const misCompras = compras(D, M, yoTid);
  M.mias = misFichasRaw.map((f) => {
    const x = enriquecer(f, yoTid);
    const compra = f.compra || misCompras[f.pid] || null;
    x.compra = compra;
    x.ganado = compra ? x.j.valor - compra : null;
    // riesgo de que te lo quiten: cláusula abierta y barata respecto a lo que vale, y que sea bueno
    let r = 0;
    if (x.ratio != null) {
      if (x.abierta) r = x.ratio < 1.25 ? 3 : x.ratio < 1.6 ? 2 : 1;
      else if (x.abreEn < 36 * HORA) r = x.ratio < 1.25 ? 2 : 1;
    }
    if (r && num(x.j.media) >= 5) r = Math.min(3, r + 1);
    x.riesgo = ['ninguno', 'bajo', 'medio', 'alto'][r];
    x.prox = M.proximoPartido(x.j.equipoId);
    return x;
  }).sort((a, b) => a.j.pos - b.j.pos || b.j.valor - a.j.valor);
  M.ganadoTotal = M.mias.reduce((s, x) => s + (x.ganado || 0), 0);
  M.conCompra = M.mias.filter((x) => x.compra).length;

  /* ---------- cláusulas de los rivales ---------- */
  M.clausulas = [];
  for (const [tid, fichas] of Object.entries(D.plantillas || {})) {
    if (tid === yoTid) continue;
    for (const f of fichas) {
      if (!f.clausula || (D.maestro[f.pid] || {}).pos === 5) continue;
      const x = enriquecer(f, tid);
      x.rival = M.equipo[tid] || { nombre: 'Rival' };
      x.meLlega = x.clausula <= M.pujaMax;
      x.teQueda = num(D.dinero) - x.clausula;
      const i = M.interes(x.j, x.clausula, x.tend);
      x.interes = i.n; x.por = i.por;
      x.prox = M.proximoPartido(x.j.equipoId);
      M.clausulas.push(x);
    }
  }
  M.clausulas.sort((a, b) => b.interes - a.interes);

  /* ---------- mercado ---------- */
  // un «libre de la liga» que ya tiene dueño en la liga no está a la venta: es que alguien lo acaba de fichar
  // (la API lo sigue devolviendo un rato); se quita, no se toma por una venta de ese manager
  M.mercadoFantasma = (D.mercado || []).filter((m) => m.tipo !== 'manager' && M.dueno[m.pid]).map((m) => m.pid);
  // en la versión gratuita no se alinea entrenador: no cuentan para fichar
  const esEnt = (pid) => (D.maestro[pid] || {}).pos === 5;
  M.mercado = (D.mercado || []).filter((m) => (m.tipo === 'manager' || !M.dueno[m.pid]) && !esEnt(m.pid)).map((m0) => {
    const dueno0 = M.dueno[m0.pid];
    const m = { ...m0 };
    if (m.tipo === 'manager') {
      const tid = m.vendedorTeamId || dueno0 || (m.vendedorManagerId && M.teamDeUsuario(m.vendedorManagerId, m.vendedor));
      const e = tid && M.equipo[tid];
      if (tid) m.vendedorTeamId = tid;
      if (!m.vendedor && e) m.vendedor = e.manager || e.nombre;
    }
    const j = J(m.pid), t = M.tend(m.pid);
    const i = M.interes(j, m.precio, t);
    const sobre = j.valor ? m.precio / j.valor - 1 : 0;
    let veredicto = 'normal';
    if (MALOS.has(j.estado)) veredicto = 'evitar';
    else if (sobre <= 0.02 && !(t.p1 != null && t.p1 < -0.5) && ((t.p7 != null && t.p7 > 2) || (t.p1 != null && t.p1 > 0.8) || num(j.media) >= 5)) veredicto = 'chollo';
    else if (t.p1 != null && t.p1 > 1) veredicto = 'sube';
    else if (sobre > 0.15) veredicto = 'caro';
    else if (t.p7 != null && t.p7 < -4) veredicto = 'baja';
    // la puja que pondría: el precio y un margen por las pujas que lleva y por si está subiendo
    let margen = 0.02 + Math.min(m.pujas, 5) * 0.025 + (t.p1 != null && t.p1 > 0 ? Math.min(t.p1, 4) / 100 : 0) + (i.n >= 70 ? 0.03 : 0);
    if (m.tipo === 'manager') margen = 0;
    const puja = Math.ceil(m.precio * (1 + margen) / 10000) * 10000;
    return { ...m, j, tend: t, sobre, interes: i.n, por: i.por, veredicto, meLlega: m.precio <= M.pujaMax, puja, prox: M.proximoPartido(j.equipoId), dueno: M.dueno[m.pid] || null };
  }).sort((a, b) => b.interes - a.interes);
  M.cierreMercado = Math.min(...M.mercado.map((m) => m.cierra || Infinity).filter((x) => x > ahora), Infinity);
  if (!Number.isFinite(M.cierreMercado)) M.cierreMercado = null;

  /* ---------- tus jugadores en venta y sus ofertas ---------- */
  M.misVentas = (D.misVentas || []).map((v) => {
    const j = J(v.pid), t = M.tend(v.pid);
    const mia = (D.plantillas[yoTid] || []).find((f) => f.pid === v.pid);
    const compra = mia && (mia.compra || null);
    const ofertas = (v.ofertas || []).map((o) => ({ ...o, sobre: j.valor ? o.importe / j.valor - 1 : 0 }));
    const mejor = ofertas[0] || null;
    // ¿aceptar? si paga más que su valor, o si está bajando y la oferta no se queda muy corta
    let consejo = 'esperar', porque = '';
    const bajando = (t.p1 != null && t.p1 < -0.5) || (t.p7 != null && t.p7 < -2);
    const subiendo = (t.p1 != null && t.p1 > 0.5) || (t.p7 != null && t.p7 > 2);
    if (!mejor) { consejo = 'sin ofertas'; porque = 'Aún no tienes ofertas.'; }
    else if (mejor.sobre >= 0.02) { consejo = 'aceptar'; porque = `Te pagan un ${Math.round(mejor.sobre * 100)} % más de lo que vale.`; }
    else if (bajando && mejor.sobre >= -0.04) { consejo = 'aceptar'; porque = `Está bajando${t.p7 != null ? ` (${pct(t.p7)} en 7 días)` : ''} y la oferta casi iguala su valor.`; }
    else if (MALOS.has(j.estado) && mejor.sobre >= -0.1) { consejo = 'aceptar'; porque = 'Está lesionado o sancionado: mejor venderlo ya.'; }
    else if (subiendo) { consejo = 'esperar'; porque = 'Está subiendo: mañana puede llegar una oferta mejor.'; }
    else { consejo = 'esperar'; porque = `La oferta se queda un ${Math.round(Math.abs(mejor.sobre) * 100)} % por debajo de lo que vale.`; }
    return { ...v, j, tend: t, compra, ofertas, mejor, consejo, porque, ganado: mejor && compra ? mejor.importe - compra : null };
  });
  M.enVenta = new Set(M.misVentas.map((v) => v.pid));

  /* ---------- quién sube y quién baja en toda LaLiga ---------- */
  const todos = Object.values(D.maestro).filter((j) => j && j.valor && j.pos && j.pos < 5);
  const conT = todos.map((j) => ({ j, t: M.tend(j.id), dueno: M.dueno[j.id] || null })).filter((x) => x.t.d1 != null || x.t.d7 != null);
  const clave = (x) => (x.t.d1 != null ? x.t.d1 : x.t.d7 / 7);
  M.suben = [...conT].sort((a, b) => clave(b) - clave(a)).slice(0, 40);
  M.bajan = [...conT].sort((a, b) => clave(a) - clave(b)).slice(0, 40);
  M.libresBuenos = todos.filter((j) => !M.dueno[j.id]).map((j) => ({ j, t: M.tend(j.id), i: M.interes(j, j.valor) })).sort((a, b) => b.i.n - a.i.n).slice(0, 30);

  /* ---------- actividad de la liga, con nombres ---------- */
  M.actividad = (D.actividad || []).map((a) => {
    const quienT = M.teamDeUsuario(a.quienId, a.quien), otroT = M.teamDeUsuario(a.otroId, a.otro);
    return {
      ...a, quienT, otroT,
      quien: a.quien || nombreEquipo(quienT), otro: a.otro || nombreEquipo(otroT),
      nombreJ: a.jugador || (a.pid && D.maestro[a.pid] ? D.maestro[a.pid].nombre : ''),
      esYo: !!yoTid && quienT === yoTid, contraMi: !!yoTid && otroT === yoTid,
    };
  });
  /** cuándo y por cuánto fichó su dueño actual a un jugador (compra o cláusula), si está en la actividad */
  M.fichadoPor = (pid) => {
    const tid = M.dueno[pid];
    if (!tid) return null;
    return M.actividad.find((a) => a.pid === pid && a.quienT === tid && ['compra', 'clausula'].includes(a.clase)) || null;
  };
  // los cambios de plantilla que la actividad no cuenta (blindajes)
  M.cambios = (H.mov || []).filter((m) => ahora - m.t < 21 * DIA).map((m) => ({ ...m, j: J(m.pid), equipo: M.equipo[m.teamId] })).reverse();

  /* ---------- rivales ---------- */
  M.rivales = D.clasif.filter((e) => e.teamId !== yoTid).map((e) => {
    const serie = (H.eq && H.eq[e.teamId]) || [];
    const hace7 = serie.filter(([d]) => d <= diaDe(ahora - 7 * DIA)).pop();
    const ayer = serie.filter(([d]) => d <= diaDe(ahora - DIA)).pop();
    const acts = M.actividad.filter((a) => a.quienT === e.teamId || a.otroT === e.teamId);
    const sem = acts.filter((a) => a.t && ahora - a.t < 7 * DIA);
    const quince = acts.filter((a) => a.t && ahora - a.t < 14 * DIA);
    const suyo = (a) => a.quienT === e.teamId;
    const gastado = sem.filter((a) => suyo(a) && ['compra', 'clausula'].includes(a.clase)).reduce((s, a) => s + num(a.importe), 0);
    const ingresado = sem.filter((a) => (a.clase === 'venta' && suyo(a)) || (a.clase === 'clausula' && a.otroT === e.teamId)).reduce((s, a) => s + num(a.importe), 0);
    const clausulazos = quince.filter((a) => a.clase === 'clausula' && suyo(a)).length;
    const contraMi = quince.filter((a) => a.clase === 'clausula' && suyo(a) && a.contraMi).length;
    const fichas = ((D.plantillas || {})[e.teamId] || []).map((f) => M.clausulas.find((x) => x.pid === f.pid && x.teamId === e.teamId) || enriquecer(f, e.teamId));
    const amenaza = clamp(clausulazos * 22 + contraMi * 25 + sem.filter((a) => suyo(a) && a.clase === 'compra').length * 6 + gastado / 2e6, 0, 100);
    return {
      e, serie, fichas,
      dValor: hace7 ? e.valor - hace7[1] : null, dValor1: ayer ? e.valor - ayer[1] : null,
      dPos: hace7 ? hace7[3] - e.pos : null,
      movs: sem.length, gastado, ingresado, clausulazos, contraMi,
      abiertas: fichas.filter((x) => x.abierta && x.clausula).length,
      meLlegan: fichas.filter((x) => x.abierta && x.meLlega).length,
      amenaza: Math.round(amenaza), nivel: amenaza >= 60 ? 'alta' : amenaza >= 30 ? 'media' : 'baja',
      ultima: acts[0] || null,
      cambios: M.cambios.filter((m) => m.teamId === e.teamId),
    };
  });

  /* ---------- lo que toca hacer ---------- */
  /* ---------- especular: comprar entre semana lo que sube y venderlo antes de la jornada ---------- */
  // lo único obligatorio es empezar la jornada con saldo >= 0; entre medias se puede bajar hasta la deuda permitida
  const inicioJ = M.proxima ? M.proxima.ini : null;
  M.ventanaEsp = null;
  if (inicioJ) {
    const ponerVenta = inicioJ - DIA;           // el día antes, para que la oferta llegue antes de que empiece
    const ciclos = Math.floor((inicioJ - 2 * HORA - ahora) / DIA);   // cambios de mercado hasta la oferta de venta
    M.ventanaEsp = { ponerVenta, limite: inicioJ - 2 * HORA, ciclos };
  }
  M.reventa = extra.reventa || {};
  const proyectar = (j, t, dias) => {
    // la subida diaria reciente (7 días si hay, si no la de hoy rebajada) y que se va frenando
    let r = t.p7 != null ? t.p7 / 100 / 7 : t.p1 != null ? (t.p1 / 100) * 0.5 : 0;
    r = clamp(r, -0.03, 0.04);
    let v = j.valor;
    for (let k = 0; k < dias; k++) v *= 1 + r * Math.pow(0.85, k);
    return { r, v };
  };
  M.especular = [];
  if (M.ventanaEsp && M.ventanaEsp.ciclos >= 1 && !M.enJuego) {
    const add = (j, t, origen, precio, extraInfo) => {
      if (MALOS.has(j.estado)) return;
      // lo del mercado llega en el próximo cambio y luego hay que ponerlo a la venta: hacen falta 2 cambios
      const dias = M.ventanaEsp.ciclos;
      if (dias < (origen === 'mercado' ? 2 : 1)) return;
      const { r, v } = proyectar(j, t, dias);
      const beneficio = v - precio;
      if (r <= 0.004 || beneficio < Math.max(250000, precio * 0.025)) return;
      M.especular.push({ j, pid: j.id, tend: t, origen, precio, valorFuturo: v, beneficio, pct: beneficio / precio, r, dias, vender: M.ventanaEsp.ponerVenta, confianza: t.p7 != null && r > 0.008 ? 'media' : 'baja', ...extraInfo });
    };
    // para revender se puja poco por encima del precio (si no, se come el beneficio)
    for (const m of M.mercado) if (m.tipo === 'liga' && !m.miPuja) { const puja = Math.ceil(m.precio * (1 + 0.012 + 0.012 * Math.min(m.pujas, 4)) / 10000) * 10000; add(m.j, m.tend, 'mercado', puja, { puja, precioMercado: m.precio }); }
    for (const x of M.clausulas) if (x.abierta) add(x.j, x.tend, 'clausula', x.clausula, { rival: x.rival });
    M.especular.sort((a, b) => b.beneficio - a.beneficio);
  }
  // lo que compraste para revender y sigue en tu equipo
  M.paraRevender = M.mias.filter((x) => M.reventa[x.pid]).map((x) => ({ ...x, rev: M.reventa[x.pid], beneficioYa: x.j.valor - (M.reventa[x.pid].precio || x.compra || x.j.valor) }));

  M.acciones = acciones(D, M, c);
  return M;
}

/** lo que pagaste por cada jugador tuyo, sacado de la actividad de la liga */
function compras(D, M, yoTid) {
  const out = {};
  const yo = M.equipo[yoTid];
  const misNombres = new Set([yo && norm(yo.manager), yo && norm(yo.nombre), D.yo && norm(D.yo.nombre)].filter(Boolean));
  const acts = [...(D.actividad || [])].sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const a of acts) {
    if (!a.pid || !a.importe) continue;
    const mio = (yoTid && M.teamDeUsuario(a.quienId, a.quien) === yoTid) || (D.yo && D.yo.userId && a.quienId === D.yo.userId) || misNombres.has(norm(a.quien));
    if (mio && (a.clase === 'compra' || a.clase === 'clausula')) out[a.pid] = Math.abs(a.importe);
  }
  return out;
}

/** la lista de lo que toca, de más a menos urgente; cada cosa con su porqué en números */
function acciones(D, M, c) {
  const out = [];
  const ahora = Date.now();
  const add = (x) => out.push(x);
  const inicio = M.proxima ? M.proxima.ini : null;

  if (M.negativo) {
    add({
      tipo: 'saldo', prio: 100, icono: 'alerta', cuando: inicio ? `La jornada empieza ${cuando(inicio)}` : 'Ahora',
      titulo: `Estás en negativo: ${eur(D.dinero)}`,
      texto: `Si la jornada empieza con el saldo en negativo, no puntúas. Vende o espera a una oferta antes${inicio ? ` (${dura(inicio - ahora)})` : ''}.`,
      hash: 'equipo',
    });
  }

  const abiertas = M.clausulas.filter((x) => x.abierta && x.meLlega && x.interes >= 50 && !MALOS.has(x.j.estado))
    .sort((a, b) => (b.interes + (b.teQueda >= 0 ? 8 : 0)) - (a.interes + (a.teQueda >= 0 ? 8 : 0)));
  abiertas.slice(0, 3).forEach((x, k) => add({
    tipo: 'clausular', prio: 90 - k * 3 + x.interes / 20, icono: 'diana', pid: x.pid, cuando: 'Ya',
    titulo: `Clausula a ${x.j.nombre}`,
    texto: `De ${x.rival.nombre}. Cláusula ${eur(x.clausula)}, vale ${eur(x.j.valor)}${x.por.length ? `: ${x.por.slice(0, 2).join(', ')}` : ''}. ${x.teQueda >= 0 ? `Te quedarías con ${eur(x.teQueda)}.` : `Te quedarías en ${eur(x.teQueda)}: tendrías que vender antes de que empiece la jornada.`}`,
  }));

  const pronto = M.clausulas.filter((x) => !x.abierta && x.abreEn < 30 * HORA && x.meLlega && x.interes >= 50 && !MALOS.has(x.j.estado));
  pronto.sort((a, b) => a.abreEn - b.abreEn).slice(0, 3).forEach((x, k) => add({
    tipo: 'pronto', prio: 75 - k * 2, icono: 'reloj', pid: x.pid, cuando: cuando(x.protegidoHasta),
    titulo: `Se abre la cláusula de ${x.j.nombre}`,
    texto: `En ${dura(x.abreEn)}. Es de ${x.rival.nombre} y cuesta ${eur(x.clausula)} (vale ${eur(x.j.valor)}). Te aviso al momento si tienes los avisos puestos.`,
  }));

  M.mias.filter((x) => x.riesgo === 'alto').slice(0, 3).forEach((x, k) => add({
    tipo: 'blindar', prio: 80 - k * 2, icono: 'escudo', pid: x.pid, cuando: x.abierta ? 'Ahora' : cuando(x.protegidoHasta),
    titulo: `Protege a ${x.j.nombre}`,
    texto: x.abierta
      ? `Su cláusula (${eur(x.clausula)}) está abierta y casi no pasa de lo que vale (${eur(x.j.valor)}). Súbela o asume que te lo pueden quitar.`
      : `Se le acaba la protección en ${dura(x.abreEn)} y su cláusula (${eur(x.clausula)}) está muy cerca de su valor. Súbela antes.`,
  }));

  M.mias.filter((x) => MALOS.has(x.j.estado)).slice(0, 2).forEach((x) => add({
    tipo: 'vender', prio: 60, icono: 'lesion', pid: x.pid, cuando: 'Esta semana',
    titulo: `${x.j.nombre}: ${x.j.estado === 'injured' ? 'lesionado' : x.j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga'}`,
    texto: `No te va a puntuar${x.tend.p7 != null && x.tend.p7 < 0 ? ` y baja ${pct(Math.abs(x.tend.p7), 1, false)} en 7 días` : ''}. Plantéate venderlo antes de que pierda más valor.`,
  }));

  M.mias.filter((x) => x.ganado > 0 && x.tend.p7 != null && x.tend.p7 < -3 && !MALOS.has(x.j.estado)).slice(0, 2).forEach((x) => add({
    tipo: 'vender', prio: 50, icono: 'hucha', pid: x.pid, cuando: 'Antes de que baje más',
    titulo: `Vende a ${x.j.nombre} con beneficio`,
    texto: `Lo compraste por ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}), pero lleva ${pct(Math.abs(x.tend.p7), 1, false)} de bajada en 7 días.`,
  }));

  M.mercado.filter((m) => m.veredicto === 'chollo' && m.meLlega && !M.dueno[m.pid]).slice(0, 2).forEach((m, k) => add({
    tipo: 'pujar', prio: 55 - k, icono: 'mercado', pid: m.pid, cuando: m.cierra ? `Cierra ${cuando(m.cierra)}` : 'Hoy',
    titulo: `Puja por ${m.j.nombre}`,
    texto: `Está a ${eur(m.precio)}${m.sobre <= 0.005 ? ', lo que vale' : ` (un ${Math.round(m.sobre * 100)} % sobre su valor)`}${m.por.length ? `: ${m.por.slice(0, 2).join(', ')}` : ''}.${m.pujas ? ` Lleva ${m.pujas} puja${m.pujas > 1 ? 's' : ''}.` : ''}`,
  }));

  if (M.paron && M.paron.ini > ahora && M.paron.ini - ahora < 12 * DIA) add({
    tipo: 'paron', prio: 40, icono: 'bandera', cuando: `Desde ${cuando(M.paron.ini, { hora: false })}`,
    titulo: M.paron.nombre,
    texto: `Del ${cuando(M.paron.ini, { hora: false })} al ${cuando(M.paron.fin, { hora: false })}. En los parones los valores se mueven menos y hay riesgo de lesiones con las selecciones: buen momento para vender a los que están arriba y comprar barato para la vuelta.`,
  });

  if (inicio && inicio - ahora < 26 * HORA && inicio > ahora) add({
    tipo: 'alinear', prio: 70, icono: 'campo', cuando: cuando(inicio),
    titulo: `Revisa tu alineación: jornada ${M.proxima.n}`,
    texto: `Empieza en ${dura(inicio - ahora)}.${M.mias.some((x) => MALOS.has(x.j.estado) || x.j.estado === 'doubtful') ? ` Tienes ${M.mias.filter((x) => MALOS.has(x.j.estado) || x.j.estado === 'doubtful').map((x) => x.j.nombre).slice(0, 3).join(', ')} tocados.` : ''}`,
    hash: 'equipo',
  });

  return out.sort((a, b) => b.prio - a.prio);
}


/**
 * El plan del día sin IA: las mismas reglas de «lo que toca», pero ordenadas como operaciones para que el
 * dinero cuadre (primero vender, luego clausular y pujar, después proteger y alinear). Tiene la misma forma
 * que el plan de la IA, así que se pinta igual.
 */
export function planAuto(D, M, c) {
  const ahora = Date.now();
  const ops = [];
  let saldo = num(D.dinero);
  const limite = -M.deuda;
  const inicio = M.proxima ? M.proxima.ini : null;
  const jornadaCerca = inicio && inicio - ahora < 2 * DIA;
  const vendidos = new Set();
  const op = (o) => ops.push({ confianza: 'media', ...o });

  // 0. aceptar las ofertas buenas por lo que ya tienes en venta
  for (const v of M.misVentas.filter((y) => y.consejo === 'aceptar')) {
    op({ accion: 'vender', pid: v.pid, jugador: v.j.nombre, donde: `acepta la oferta de ${v.mejor.de}`, importe: v.mejor.importe, cuando: v.mejor.caduca ? `antes de ${cuando(v.mejor.caduca)}` : 'hoy',
      motivo: `${v.porque} Vale ${eur(v.j.valor)}${v.ganado != null ? ` y lo pagaste a ${eur(v.compra)} (${eur(v.ganado, { signo: true })})` : ''}.`, confianza: v.mejor.sobre >= 0.02 ? 'alta' : 'media' });
    saldo += v.mejor.importe; vendidos.add(v.pid);
  }

  // 0b. los entrenadores no puntúan en la versión gratuita: dinero parado
  for (const x of M.mias.filter((y) => y.j.pos === 5 && !vendidos.has(y.pid))) {
    op({ accion: 'vender', objetivo: 'caja', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `Es entrenador y en la versión gratuita no se alinea ni puntúa: son ${eur(x.j.valor)} parados que puedes usar en jugadores.`, confianza: 'alta' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // 1. vender lo que no va a puntuar o se está desplomando con beneficio
  for (const x of M.mias.filter((y) => MALOS.has(y.j.estado) && !vendidos.has(y.pid))) {
    op({ accion: 'vender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `${x.j.estado === 'injured' ? 'Lesionado' : x.j.estado === 'suspended' ? 'Sancionado' : 'Fuera de LaLiga'}: no te va a puntuar${x.tend.p7 != null && x.tend.p7 < 0 ? ` y ya ha perdido un ${pct(Math.abs(x.tend.p7), 1, false)} en 7 días` : ''}. Mejor venderlo antes de que baje más.`, confianza: 'alta' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.ganado > 0 && y.tend.p7 != null && y.tend.p7 < -4).slice(0, 2)) {
    op({ accion: 'vender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `Lo pagaste a ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}), pero lleva un ${pct(Math.abs(x.tend.p7), 1, false)} de bajada en 7 días. Asegura el beneficio.` });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // ¿le hace falta a tu once? solo fichajes que entren de titular en una formación gratuita (o que tapen un hueco)
  let plantilla = M.mias.filter((x) => !vendidos.has(x.pid)).map((x) => x.j);
  let onceAhora = M.mejorOnce(plantilla);
  const gana = (j) => M.mejorOnce([...plantilla, j]).total - onceAhora.total;
  const hueco = (j) => gana(j) >= 0.5;
  const fichar = (j) => { plantilla = [...plantilla, j]; onceAhora = M.mejorOnce(plantilla); };
  const yaHoy = new Set();
  // sin IA el plan no tira de deuda: solo con el dinero que tienes y lo que vendes
  const presupuesto = () => saldo;

  // 2. clausular lo mejor que esté abierto y te llegue
  // nunca una cláusula mucho más cara de lo que vale el jugador (lo de más se pierde en el valor del equipo)
  const abiertas = M.clausulas.filter((x) => x.abierta && x.interes >= 55 && !MALOS.has(x.j.estado) && x.clausula <= x.j.valor * 1.3).slice(0, 8);
  let clausulas = 0;
  for (const x of abiertas) {
    if (clausulas >= 2 || x.clausula > presupuesto() || yaHoy.has(x.j.pos) || !hueco(x.j)) continue;
    const g = gana(x.j);
    op({ accion: 'clausular', objetivo: 'titular', pid: x.pid, jugador: x.j.nombre, donde: `cláusula a ${x.rival.manager || x.rival.nombre}`, importe: x.clausula, cuando: 'ahora',
      motivo: `Vale ${eur(x.j.valor)} y su cláusula es ${eur(x.clausula)}. Entra en tu once (${M.mejorOnce([...plantilla, x.j]).nombre}) y suma unos ${String(Math.round(g * 10) / 10).replace('.', ',')} pts por jornada${x.por.length ? `; ${x.por.filter((p) => !/once|hueco|sobran/.test(p)).slice(0, 2).join(', ')}` : ''}.`, confianza: x.interes >= 70 ? 'alta' : 'media' });
    saldo -= x.clausula; clausulas++; yaHoy.add(x.j.pos); fichar(x.j);
  }

  // 3. pujar por los chollos del mercado
  let pujas = 0;
  for (const m of M.mercado.filter((y) => !y.miPuja && !M.dueno[y.pid] && (y.veredicto === 'chollo' || (y.veredicto === 'sube' && y.interes >= 55)))) {
    if (pujas >= 2 || m.puja > presupuesto() || yaHoy.has(m.j.pos) || !hueco(m.j)) continue;
    op({ accion: 'pujar', objetivo: 'titular', pid: m.pid, jugador: m.j.nombre, donde: 'en el mercado', importe: m.precio, puja_max: m.puja, cuando: M.cierreMercado ? `antes de ${cuando(M.cierreMercado)}` : 'hoy',
      motivo: `Sale a ${eur(m.precio)}${m.sobre <= 0.01 ? ', lo que vale' : ''}. Mejora tu once unos ${String(Math.round(gana(m.j) * 10) / 10).replace('.', ',')} pts por jornada${m.por.length ? `; ${m.por.filter((p) => !/once|hueco|sobran/.test(p)).slice(0, 2).join(', ')}` : ''}.${m.pujas ? ` Lleva ${m.pujas} puja${m.pujas > 1 ? 's' : ''}, por eso subo la oferta.` : ''}` });
    saldo -= m.puja; pujas++; yaHoy.add(m.j.pos); fichar(m.j);
  }
  // lo mejor que no te llega todavía, para que sepas cuánto te falta
  const enPlan = new Set(ops.map((o) => o.pid));
  const fuera = M.clausulas.find((x) => !enPlan.has(x.pid) && x.abierta && x.interes >= 70 && x.clausula > saldo && x.clausula <= M.pujaMax && !MALOS.has(x.j.estado) && hueco(x.j));
  if (fuera && clausulas < 2) {
    op({ accion: 'esperar', pid: fuera.pid, jugador: fuera.j.nombre, donde: `cláusula de ${eur(fuera.clausula)} a ${fuera.rival.manager || fuera.rival.nombre}`, importe: null, cuando: 'si vendes algo',
      motivo: `Es el mejor a tiro (interés ${fuera.interes}), pero te faltan ${eur(fuera.clausula - saldo)} sin tirar de deuda. Si vendes a alguien que no juegue, ve a por él.`, confianza: 'baja' });
  }

  // 4. si te quedas en negativo, vender lo que menos aporta antes de que empiece la jornada (o no puntúas)
  if (saldo < 0) {
    const fichados = new Set(ops.filter((o) => o.accion !== 'vender').map((o) => o.pid));
    const perdida = (x) => onceAhora.total - M.mejorOnce(plantilla.filter((j) => j.id !== x.pid)).total;
    const candidatos = M.mias.filter((x) => !vendidos.has(x.pid) && !fichados.has(x.pid))
      .map((x) => ({ ...x, pierde: perdida(x) }))
      .sort((a, b) => (a.pierde - b.pierde) || (b.j.valor - a.j.valor));
    for (const x of candidatos) {
      if (saldo >= 0) break;
      op({ accion: 'vender', objetivo: 'caja', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: inicio ? `antes de ${cuando(inicio)}` : 'hoy',
        motivo: `Para no empezar la jornada en negativo (no puntuarías). ${x.pierde < 0.3 ? 'No entra en tu once: no pierdes puntos.' : `Es el que menos resta a tu once (−${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts/jornada).`}`, confianza: 'alta' });
      saldo += x.j.valor; vendidos.add(x.pid);
      plantilla = plantilla.filter((j) => j.id !== x.pid); onceAhora = M.mejorOnce(plantilla);
    }
  }

  // 4b. lo que compraste para revender: ponerlo a la venta el día antes de la jornada (o ya, si se acerca)
  const ventana = M.ventanaEsp;
  for (const x of M.paraRevender.filter((y) => !vendidos.has(y.pid))) {
    const toca = !ventana || ahora >= ventana.ponerVenta - 6 * HORA || (x.tend.p1 != null && x.tend.p1 < -1);
    if (!toca) continue;
    op({ accion: 'vender', objetivo: 'revender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: inicio ? `antes de ${cuando(inicio)}` : 'hoy',
      motivo: `Lo compraste para revender a ${eur(x.rev.precio)} y ahora vale ${eur(x.j.valor)} (${eur(x.beneficioYa, { signo: true })}).${x.tend.p1 != null && x.tend.p1 < -1 ? ' Ha empezado a bajar: mejor salir ya.' : ' Toca venderlo para empezar la jornada en positivo.'}`, confianza: 'alta' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // 4c. especular: entre semana se puede bajar hasta el límite de deuda si lo que compras lo vendes antes de la jornada
  const especula = [];
  if (ventana && ventana.ciclos >= 1 && !M.paraRevender.length) {
    const ya = new Set(ops.map((o) => o.pid));
    let espSaldo = saldo;
    for (const e of M.especular) {
      if (especula.length >= 2 || ya.has(e.pid) || M.dueno[e.pid] === D.yo.teamId) continue;
      // nunca más allá del 90 % de la deuda permitida, y que al vender lo especulado se vuelva a positivo
      const tras = espSaldo - e.precio;
      if (tras < limite * 0.9) continue;
      // aunque lo especulado baje un 8 % en vez de subir, al venderlo tienes que volver a positivo
      if (tras + [...especula, e].reduce((s2, x) => s2 + x.precio * 0.92, 0) < 0) continue;
      especula.push(e); espSaldo = tras;
      const diaVenta = cuando(e.vender, { hora: false });
      op({ accion: e.origen === 'mercado' ? 'pujar' : 'clausular', objetivo: 'revender', pid: e.pid, jugador: e.j.nombre,
        donde: e.origen === 'mercado' ? 'en el mercado' : `cláusula a ${e.rival.manager || e.rival.nombre}`, importe: e.origen === 'mercado' ? e.precioMercado : e.precio, puja_max: e.origen === 'mercado' ? e.puja : null,
        cuando: e.origen === 'mercado' ? (M.cierreMercado ? `antes de ${cuando(M.cierreMercado)}` : 'hoy') : 'ahora',
        vender_el: diaVenta, beneficio_esperado: Math.round(e.beneficio),
        motivo: `Para revender, no para tu once: sube un ${pct(e.r * 100, 1, false)} al día. Si sigue así, el ${diaVenta} valdrá unos ${eur(e.valorFuturo)} (${eur(e.beneficio, { signo: true })}). Ponlo a la venta el ${diaVenta} para estar en positivo antes de la jornada.`,
        confianza: e.confianza });
    }
    saldo = espSaldo;
  }

  // 5. proteger a los tuyos más expuestos
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.riesgo === 'alto').slice(0, 2)) {
    op({ accion: 'blindar', pid: x.pid, jugador: x.j.nombre, donde: 'subir su cláusula', importe: null, cuando: x.abierta ? 'ahora' : `antes de ${cuando(x.protegidoHasta)}`,
      motivo: `Su cláusula (${eur(x.clausula)}) casi no pasa de lo que vale (${eur(x.j.valor)}) y ${x.abierta ? 'ya está abierta' : `se abre en ${dura(x.abreEn)}`}. Súbela o te lo quitan.` });
  }

  // 6. alineación si la jornada empieza pronto
  if (inicio && inicio - ahora < 30 * HORA && inicio > ahora) {
    const tocados = M.mias.filter((x) => !vendidos.has(x.pid) && x.j.estado === 'doubtful');
    op({ accion: 'alinear', jugador: '', donde: `jornada ${M.proxima.n}`, importe: null, cuando: `antes de ${cuando(inicio)}`,
      motivo: `Pon el ${onceAhora.nombre}: ${onceAhora.lineas.flat().map((j) => j.nombre).join(', ')}.${onceAhora.huecos ? ` Te faltan ${onceAhora.huecos} para completarlo.` : ''}${tocados.length ? ` Ojo con ${tocados.map((x) => x.j.nombre).join(', ')}, que son duda.` : ''}` });
  }
  if (!ops.length) op({ accion: 'esperar', jugador: '', donde: '', importe: null, cuando: 'hoy', motivo: 'Hoy no hay ninguna operación clara: ni cláusulas que merezcan la pena abiertas ni chollos en el mercado. Mejor guardar el dinero.', confianza: 'media' });

  // los próximos días: cláusulas que se abren, mercado, jornada y parón (lo más importante de cada día)
  const dias = {};
  const add = (t, prio, texto) => { const d = diaDe(t); (dias[d] ||= { t, cosas: [] }).cosas.push({ prio, texto }); };
  const hora = (t) => cuando(t).split(' ').pop();
  for (const x of M.clausulas.filter((y) => !y.abierta && y.abreEn < 4 * DIA && y.meLlega && y.interes >= 55)) {
    add(x.protegidoHasta, x.interes, `${hora(x.protegidoHasta)} se abre ${x.j.nombre} (${eur(x.clausula)}, de ${x.rival.manager || x.rival.nombre})`);
  }
  for (const x of M.mias.filter((y) => !y.abierta && y.abreEn < 4 * DIA && y.riesgo !== 'ninguno')) add(x.protegidoHasta, 90, `${hora(x.protegidoHasta)} se acaba la protección de tu ${x.j.nombre}`);
  if (inicio) add(inicio, 100, `${hora(inicio)} empieza la jornada ${M.proxima.n}: saldo en positivo y once revisado antes`);
  const aRevender = [...especula.map((e) => e.j.nombre), ...M.paraRevender.filter((x) => !vendidos.has(x.pid)).map((x) => x.j.nombre)];
  if (aRevender.length && ventana) add(ventana.ponerVenta, 99, `pon a la venta lo de revender (${aRevender.join(', ')}) y acepta las ofertas antes de la jornada`);
  if (M.paron && M.paron.ini > ahora) add(M.paron.ini, 95, 'empieza el parón: los valores se paran, vende a los que estén en lo alto');
  const proximos = Object.values(dias).sort((a, b) => a.t - b.t).slice(0, 5).map((d) => {
    const cosas = d.cosas.sort((a, b) => b.prio - a.prio);
    const resto = cosas.length - 3;
    return { dia: cuando(d.t, { hora: false }), texto: cosas.slice(0, 3).map((c) => c.texto).join('. ') + (resto > 0 ? `. Y ${resto} cláusula${resto > 1 ? 's' : ''} más` : '') + '.' };
  });

  const n = (a) => ops.filter((o) => o.accion === a).length;
  const partes = [n('vender') && `vender ${n('vender')}`, n('clausular') && `clausular ${n('clausular')}`, n('pujar') && `pujar por ${n('pujar')}`, n('blindar') && `proteger ${n('blindar')}`].filter(Boolean);
  if (especula.length) partes.push(`especular con ${especula.length} para revender`);
  return {
    auto: true, t: ahora, dia: diaDe(ahora),
    titular: partes.length ? `Hoy toca ${partes.join(', ')}` : ops[0].accion === 'alinear' ? 'Hoy solo toca preparar la jornada' : 'Hoy, quieto: guarda el dinero',
    situacion: `Tienes ${eur(D.dinero)} y puedes gastar hasta ${eur(M.pujaMax)}. Vas ${M.yo ? `${M.yo.pos}º con ${M.yo.puntos} puntos` : ''}${M.proxima ? ` y la jornada ${M.proxima.n} empieza ${cuando(M.proxima.ini)}` : ''}.`,
    operaciones: ops, proximos_dias: proximos,
    alineacion: onceAhora.formacion ? { formacion: onceAhora.nombre, titulares: onceAhora.lineas.flat().map((j) => j.nombre), dudas: onceAhora.lineas.flat().filter((j) => j.estado === 'doubtful').map((j) => `${j.nombre}: es duda`) } : null,
  };
}


/* ---------- el once: formaciones gratuitas, puntos esperados y el mejor once posible ---------- */
// las formaciones gratuitas de LaLiga Fantasy, por si la API no las da
const FORMACIONES = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
const NOMBRE_POS = { 1: 'portería', 2: 'defensa', 3: 'el medio', 4: 'delantera' };
const dec1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
export function partirFormacion(f) {
  const m = String(f).match(/(\d)\D?(\d)\D?(\d)/);
  return m && +m[1] + +m[2] + +m[3] === 10 ? [+m[1], +m[2], +m[3]] : null;
}
/** los puntos que se esperan de un jugador en la próxima jornada: su forma (últimas 5) o su media, y si puede jugar */
export function puntosEsperados(j, forma, once = null) {
  if (!j || MALOS.has(j.estado)) return 0;
  if (once && once.estado === 'injured') return 0;
  let pp = forma && forma.de >= 3 ? forma.media * 0.6 + num(j.media) * 0.4 : num(j.media);
  if (forma && forma.de >= 3 && forma.jugados / forma.de < 0.5) pp *= 0.7;
  if (j.estado === 'doubtful' || (once && once.estado === 'doubtful')) pp *= 0.55;
  // el once probable de su equipo (futbolfantasy): titular, alternativa o fuera de la convocatoria
  if (once && j.pos !== 5) {
    if (once.titular) pp *= once.prob != null ? Math.max(0.5, once.prob / 100) : 1;
    else if (once.alternativa) pp *= 0.35;
    else if (once.fuera) pp *= 0.45;
  }
  return Math.max(0, pp);
}
/** el mejor once con esos jugadores entre las formaciones dadas: { formacion, lineas: [[POR],[DEF],[MED],[DEL]], entrenador, total, huecos } */
export function mejorOnce(lista, formaciones, pp) {
  const por = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const j of lista || []) if (j && por[j.pos]) por[j.pos].push({ j, p: pp(j), ok: !MALOS.has(j.estado) });
  for (const k of Object.keys(por)) por[k].sort((a, b) => b.p - a.p);
  let mejor = null;
  for (const f of formaciones.length ? formaciones : [[4, 3, 3]]) {
    const pide = { 1: 1, 2: f[0], 3: f[1], 4: f[2] };
    let total = 0, huecos = 0;
    const lineas = [1, 2, 3, 4].map((pos) => {
      const disp = por[pos].filter((x) => x.ok).slice(0, pide[pos]);
      huecos += pide[pos] - disp.length;
      total += disp.reduce((s, x) => s + x.p, 0);
      return disp.map((x) => x.j);
    });
    const ent = null; // la versión gratuita no alinea entrenador
    const nota = total - huecos * 4;
    if (!mejor || nota > mejor.nota) mejor = { formacion: f, nombre: f.join('-'), lineas, entrenador: ent ? ent.j : null, total, huecos, nota };
  }
  return mejor || { formacion: null, nombre: '', lineas: [[], [], [], []], entrenador: null, total: 0, huecos: 11, nota: 0 };
}
