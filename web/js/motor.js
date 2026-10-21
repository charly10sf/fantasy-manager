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

  /* ---------- lo que ya no es tuyo: vendidos y clausulados estos días ---------- */
  // La plantilla de la API a veces tarda en enterarse. Si los movimientos dicen que lo vendiste (o que te lo
  // clausularon) y no lo has vuelto a fichar, o si me has contado en el chat que ya lo has vendido, deja de contar
  // como tuyo en todo: el once, el plan, las ventas y lo que se le pasa a la IA.
  const vendidos = {};
  {
    const ev = [];
    for (const a of D.actividad || []) if (a.pid && a.t && ahora - a.t < 10 * DIA) ev.push({ t: a.t, a });
    for (const m of H.mov || []) if (m.teamId === yoTid && ahora - m.t < 10 * DIA && (m.tipo === 'sale' || m.tipo === 'entra')) ev.push({ t: m.t, m });
    ev.sort((x, y) => x.t - y.t);
    for (const { t, a, m } of ev) {
      if (m) {
        if (m.tipo === 'sale' && !vendidos[m.pid]) vendidos[m.pid] = { t, como: 'salió de tu equipo' };
        else if (m.tipo === 'entra') delete vendidos[m.pid];
        continue;
      }
      const q = M.teamDeUsuario(a.quienId, a.quien), o = a.otroId || a.otro ? M.teamDeUsuario(a.otroId, a.otro) : null;
      if (a.clase === 'venta' && q === yoTid) vendidos[a.pid] = { t, como: 'lo vendiste', importe: a.importe || null };
      else if ((a.clase === 'compra' || a.clase === 'clausula') && o === yoTid && q && q !== yoTid) vendidos[a.pid] = { t, como: a.clase === 'clausula' ? `te lo clausuló ${nombreEquipo(q)}` : `se lo vendiste a ${nombreEquipo(q)}`, importe: a.importe || null, aTid: q, evId: a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}|${a.importe}` };
      else if ((a.clase === 'compra' || a.clase === 'clausula') && q === yoTid) delete vendidos[a.pid];
    }
    for (const n of extra.notas || []) {
      if (n.pid && !vendidos[n.pid] && /hecho/.test(n.tipo || '') && /vend|clausul|traspas/i.test(n.texto || '') && n.t && ahora - n.t < 4 * DIA) vendidos[n.pid] = { t: n.t, como: 'me contaste que ya lo vendiste' };
    }
  }
  const enMiPlantilla = new Set(((D.plantillas || {})[yoTid] || []).map((f) => f.pid));
  M.vendidos = Object.entries(vendidos).map(([pid, v]) => ({ pid, ...v, j: J(pid), seguiaEnLaApi: enMiPlantilla.has(pid) })).sort((a, b) => b.t - a.t);
  for (const v of M.vendidos) if (M.dueno[v.pid] === yoTid) { if (v.aTid) M.dueno[v.pid] = v.aTid; else delete M.dueno[v.pid]; }

  /* ---------- forma reciente (de la ficha de cada jugador, si se ha bajado) ---------- */
  const det = extra.det || {};
  /** lo que valía un jugador en un momento (de su ficha si se ha bajado; si no, de lo que se ha ido guardando) */
  const valorEn = (pid, t) => {
    const dv = det[pid] && det[pid].valores;
    let v = null;
    if (dv && dv.length) for (const [tt, vv] of dv) { if (tt <= t) v = vv; else break; }
    if (v == null) { const d = diaDe(t); for (const [dd, vv] of (H.v && H.v[pid]) || []) { if (dd <= d) v = vv; else break; } }
    if (v == null && ahora - t < 2 * DIA) v = J(pid).valor;
    return v;
  };
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

  /* ---------- la inercia del valor: si sube cada vez menos va a girar, y si ya ha girado hay que vender ---------- */
  // Con lo que ha cambiado su valor cada día (hasta los últimos 7). Si sube 1 M, luego 800 mil y luego 500 mil, se
  // está frenando: con lo que se frena cada día se calcula cuándo deja de subir. Si después de varios días subiendo
  // se para o ya baja, ha girado: lo normal es que siga bajando unos días, así que se vende antes de perder más.
  const cacheI = {};
  M.inercia = (pid) => {
    if (cacheI[pid] !== undefined) return cacheI[pid];
    const j = J(pid), t = M.tend(pid);
    if (!j.valor) return (cacheI[pid] = null);
    // un valor por día (el de hoy, el que hay ahora)
    const porDia = new Map();
    for (const [ts, v] of t.serie || []) if (v) porDia.set(diaDe(ts), v);
    porDia.set(diaDe(ahora), j.valor);
    const dias = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-9);
    const R = [], F = [];
    for (let i = 1; i < dias.length; i++) {
      const gap = Math.round((Date.parse(dias[i][0] + 'T12:00:00') - Date.parse(dias[i - 1][0] + 'T12:00:00')) / DIA);
      if (gap < 1 || gap > 3) { R.length = 0; F.length = 0; continue; }
      R.push((dias[i][1] - dias[i - 1][1]) / gap); F.push(dias[i][0]);
    }
    // si hoy aún no se ha guardado el cambio y futbolfantasy lo da, se usa
    const ff = (D.tendencias || {})[pid];
    if (ff && ff.d1 != null && F[F.length - 1] !== diaDe(ahora)) { R.push(ff.d1); F.push(diaDe(ahora)); }
    if (R.length < 3) return (cacheI[pid] = null);
    const Rs = R.slice(-7), v = j.valor;
    const n = Rs.length, ult = Rs[n - 1], pen = Rs[n - 2];
    // por debajo de esto se considera que no se mueve
    const quieto = Math.max(25000, v * 0.0012);
    let subia = 0; for (let i = n - 2; i >= 0 && Rs[i] > quieto; i--) subia++;
    let baja = 0; for (let i = n - 1; i >= 0 && Rs[i] < -quieto; i--) baja++;
    // lo que cambia la subida cada día (pendiente de los últimos 4 cambios)
    const u4 = Rs.slice(-4), mx = (u4.length - 1) / 2, my = u4.reduce((s, x) => s + x, 0) / u4.length;
    const pend = u4.reduce((s, x, i) => s + (i - mx) * (x - my), 0) / Math.max(1e-9, u4.reduce((s, x, i) => s + (i - mx) ** 2, 0));
    let fase = 'plano', giroEn = null, frenazo = null;
    // antes de empezar a bajar, ¿venía subiendo? (puede haber uno o dos días quieto entre medias)
    const antes = Rs.slice(0, n - Math.max(baja, 1));
    const subioAntes = antes.slice(-5).filter((x) => x > quieto).length >= 2 && antes.slice(-5).reduce((s0, x) => s0 + x, 0) > 2 * quieto;
    if (ult < -quieto && (subia >= 2 || (subioAntes && baja <= 3))) fase = 'giro';   // venía subiendo y ya baja
    else if (ult < -quieto) fase = 'baja';
    else if (Math.abs(ult) <= quieto && subia >= 2) fase = 'parado';      // se ha estancado después de subir
    else if (ult > quieto) {
      const u3 = Rs.slice(-3);
      const frena = u3.every((x) => x > 0) && u3[2] < u3[1] && u3[1] <= u3[0] && u3[2] < u3[0] * 0.8;
      // cuánto se frena cada día desde el pico (pesa más lo último: si el frenazo se acelera, gira antes)
      const fr = 0.6 * (u3[2] - u3[1]) + 0.4 * (u3[1] - u3[0]);
      if (frena && fr < 0) { fase = 'frena'; frenazo = fr; giroEn = ult / -fr; }
      else fase = Rs.slice(-3).every((x) => x > quieto) && pend >= 0 ? 'acelera' : 'sube';
    }
    // lo que se espera los próximos días: el frenazo sigue al mismo ritmo, la bajada se suaviza poco a poco
    const hastaJ = M.proxima ? clamp(Math.ceil((M.proxima.ini - ahora) / DIA), 1, 7) : 3;
    const proy = (k) => {
      let x = 0, r = ult;
      for (let i = 1; i <= k; i++) {
        if (fase === 'frena' || fase === 'parado') r = r + Math.min(frenazo != null ? frenazo : pend, -quieto * 0.6);
        else if (fase === 'giro' || fase === 'baja') r = r * 0.9;
        else r = r * 0.8;
        x += r;
      }
      return x;
    };
    const fmt = (x) => eur(x, { signo: true });
    const subida = (subia >= 2 ? Rs.slice(Math.max(0, n - 1 - subia), n - 1) : antes.slice(-5)).filter((r) => r > quieto);
    let texto = '';
    if (fase === 'giro') texto = `Ha girado a la baja: venía subiendo (${subida.slice(-4).map(fmt).join(', ')} al día) y ${baja >= 2 ? `ya lleva ${baja} días bajando (hoy ${fmt(ult)})` : `hoy ${fmt(ult)}`}. Si sigue así, en ${hastaJ} día${hastaJ > 1 ? 's' : ''} pierde unos ${eur(-proy(hastaJ))}.`;
    else if (fase === 'parado') texto = `Se ha estancado después de subir (${subida.slice(-4).map(fmt).join(', ')} y hoy ${fmt(ult)}): lo normal es que ahora empiece a bajar.`;
    else if (fase === 'frena') texto = `Sube cada vez menos (${Rs.slice(-3).map(fmt).join(', ')} al día): a este ritmo deja de subir en unos ${Math.max(1, Math.round(giroEn))} día${Math.round(giroEn) > 1 ? 's' : ''} y luego bajará.`;
    else if (fase === 'baja') texto = `Baja ${fmt(ult)} al día${baja >= 2 ? ` (${baja} días seguidos)` : ''}: en ${hastaJ} día${hastaJ > 1 ? 's' : ''} perdería unos ${eur(-proy(hastaJ))}.`;
    else if (fase === 'acelera') texto = `Sube cada vez más (${Rs.slice(-3).map(fmt).join(', ')} al día).`;
    else if (fase === 'sube') texto = `Sube ${fmt(ult)} al día.`;
    return (cacheI[pid] = { R: Rs, dias: F.slice(-7), ult, pend, fase, giroEn, subia, baja, proy3: proy(3), proyJ: proy(hastaJ), hastaJ, texto, quieto });
  };
  /** ¿hay que venderlo ya por la inercia? (ha girado o se ha parado tras subir, o está a punto) */
  M.ventaPorInercia = (pid) => {
    const x = M.inercia(pid);
    if (!x) return null;
    const j = J(pid), perder = -x.proyJ;
    if ((x.fase === 'giro' || x.fase === 'baja') && perder >= Math.max(150000, j.valor * 0.012)) return { urgencia: 'ya', ...x, perder };
    if (x.fase === 'parado' || (x.fase === 'frena' && x.giroEn != null && x.giroEn <= 2.5)) return { urgencia: 'antes del giro', ...x, perder: Math.max(0, perder) };
    return null;
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

  /* ---------- el dinero de cada rival ---------- */
  // LaLiga solo da el tuyo. El de los demás se reconstruye con los movimientos de la liga desde el principio:
  //   100 M de salida + recompensas diarias + ventas + lo que cobra (traspasos y cláusulas) + premios por jornada
  //   − compras − traspasos y cláusulas que paga − lo que gasta en subir cláusulas
  // En los movimientos de LaLiga: 31 compra al mercado, 33 venta al mercado, 1 traspaso entre managers (paga user1,
  // cobra user2; los clausulazos también salen así), 6 premio de la jornada, 4 escudo (se paga con un anuncio: no
  // cuesta dinero). Lo que no sale:
  //  - las subidas de cláusula (pagar X la sube 2X): se sacan de sus plantillas, comparando la cláusula de ahora con
  //    la que tenía al ficharlo (lo que pagó, o su valor si era más, y nunca menos de 1 M), y de las subidas que se
  //    ven de un día a otro;
  //  - la recompensa diaria (100 mil por día que se coge): en vez de suponerla, la base común se mide con tu saldo
  //    (tu saldo − tus movimientos + tus subidas de cláusula) y el margen cubre la diferencia entre lo que coge cada uno.
  const AH0 = extra.actHist && extra.actHist.lista && extra.actHist.lista.length ? extra.actHist
    : { lista: D.actividad || [], completa: !!D.demo, desde: (D.actividad || []).length ? Math.min(...D.actividad.map((a) => a.t || ahora)) : null };
  const tidDe = (id, nombre) => (id || nombre ? M.teamDeUsuario(id, nombre) : null);
  const idAct = (a) => a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}|${a.importe}`;
  const plantillaDe = (tid) => (D.plantillas || {})[tid] || [];
  // el último fichaje de cada jugador por cada equipo (antes de un momento)
  const fichajes = {};
  for (const a of AH0.lista) {
    if (!a.pid || !a.t || !(a.clase === 'compra' || a.clase === 'clausula')) continue;
    const q = tidDe(a.quienId, a.quien);
    if (q) (fichajes[`${q}|${a.pid}`] ||= []).push(a);
  }
  for (const l of Object.values(fichajes)) l.sort((x, y) => x.t - y.t);
  const fichajeAntes = (tid, pid, t) => { let r = null; for (const a of fichajes[`${tid}|${pid}`] || []) { if (a.t < t) r = a; else break; } return r; };
  /** la cláusula con la que llega un fichaje: lo que pagó o lo que valía si era más, nunca menos de 1 M */
  const clausulaAlFichar = (a) => Math.max(Math.abs(num(a.importe)), valorEn(a.pid, a.t) || 0, 1e6);

  /* los clausulazos: LaLiga los apunta como un traspaso más. Lo es si se pagó justo la cláusula que tenía el
     vendedor (la de cuando lo fichó o la que se le vio después) y ya no estaba protegido */
  const czIds = new Set();
  {
    const vistas = {}; // cláusulas vistas de cada jugador en cada equipo
    for (const m of H.mov || []) {
      const c = m.tipo === 'blinda' ? m.a : m.clausula;
      if (c && m.teamId && m.pid) (vistas[`${m.teamId}|${m.pid}`] ||= []).push(c);
    }
    for (const [tid, fichas] of Object.entries(D.plantillas || {})) for (const f of fichas) if (f.clausula) (vistas[`${tid}|${f.pid}`] ||= []).push(f.clausula);
    const PROTEGIDO = 336 * HORA;
    for (const a of AH0.lista) {
      if (a.clase !== 'compra' || !(a.otroId || a.otro) || !a.pid || !a.importe || !a.t) continue;
      const vend = tidDe(a.otroId, a.otro);
      if (!vend) continue;
      const imp = Math.abs(num(a.importe));
      const suyo = fichajeAntes(vend, a.pid, a.t);
      if (suyo && a.t - suyo.t < PROTEGIDO - HORA) continue; // aún estaba protegido: fue un trato
      const cands = [...(vistas[`${vend}|${a.pid}`] || [])];
      if (suyo) cands.push(clausulaAlFichar(suyo));
      else if (AH0.completa && AH0.desde) { const v0 = valorEn(a.pid, AH0.desde); if (v0) cands.push(Math.max(v0, 1e6)); }
      if (cands.some((c) => Math.abs(imp - c) <= Math.max(1000, c * 0.002))) czIds.add(idAct(a));
    }
  }
  const marcarCz = (a) => (czIds.has(idAct(a)) ? { ...a, clase: 'clausula', cz: true } : a);
  const AH = { ...AH0, lista: AH0.lista.map(marcarCz) };
  for (const v of M.vendidos) if (v.evId && czIds.has(v.evId) && v.aTid) v.como = `te lo clausuló ${nombreEquipo(v.aTid)}`;

  const flujos = {};
  {
    const fl = (tid) => (flujos[tid] ||= { v: 0, n: 0, gastado: 0, ingresado: 0, premios: 0, raros: 0, ev: [] });
    const mover = (tid, x, t, k) => { const f = fl(tid); f.v += x; f.n++; f.ev.push([t || 0, x]); if (k) f[k] += Math.abs(x); };
    // una venta a otro manager que saliera también como compra suya: no se cuenta dos veces
    const compraDe = new Set();
    for (const a of AH.lista) if ((a.clase === 'compra' || a.clase === 'clausula') && (a.otroId || a.otro)) compraDe.add(`${a.pid}|${Math.abs(num(a.importe))}|${tidDe(a.otroId, a.otro)}`);
    for (const a of AH.lista) {
      const imp = Math.abs(num(a.importe));
      if (!imp) continue;
      const q = tidDe(a.quienId, a.quien), o = tidDe(a.otroId, a.otro);
      if (a.clase === 'compra' || a.clase === 'clausula') {
        if (q) mover(q, -imp, a.t, 'gastado');
        if (o && o !== q) mover(o, imp, a.t, 'ingresado');
      } else if (a.clase === 'venta') {
        if (q && !compraDe.has(`${a.pid}|${imp}|${q}`)) mover(q, imp, a.t, 'ingresado');
      } else if (a.clase === 'premio') {
        if (q) mover(q, imp, a.t, 'premios');
      } else if (a.clase === 'otro' && q) fl(q).raros++; // un movimiento con dinero de un tipo que no se conoce: al margen
    }
  }
  M.flujos = flujos;
  M.histMov = { desde: AH.desde || null, completa: !!AH.completa, n: AH.lista.length };
  // cuántos de cada tipo (para el diagnóstico)
  M.histTipos = AH.lista.reduce((o, a) => { const k = a.tipo != null ? `${a.tipo}` : a.clase; o[k] = o[k] || { n: 0, conImporte: 0 }; o[k].n++; if (num(a.importe)) o[k].conImporte++; return o; }, {});
  M.czDetectados = czIds.size;

  // lo que ha gastado cada uno en subir cláusulas
  const subidas = {};
  {
    const sb = (tid) => (subidas[tid] ||= { v: 0, n: 0, dudas: 0, sinBase: 0, vistas: 0, lista: [] });
    for (const [tid, fichas] of Object.entries(D.plantillas || {})) for (const f of fichas) {
      if (!f.clausula) continue;
      const a = fichajeAntes(tid, f.pid, ahora + DIA);
      let base;
      if (a) base = clausulaAlFichar(a);
      else {
        // de su plantilla del principio: entonces su cláusula era lo que valía
        const v0 = AH.completa && AH.desde ? valorEn(f.pid, AH.desde) : null;
        if (v0 == null) {
          const posible = Math.max(0, f.clausula - Math.max(J(f.pid).valor, 1e6)) / 2;
          if (posible > 2e5) { sb(tid).sinBase++; sb(tid).dudas += posible; }
          continue;
        }
        base = Math.max(v0, 1e6);
      }
      const subio = f.clausula - base;
      // lo poco puede ser que valiera algo más al ficharlo que lo que se sabe
      if (subio < Math.max(2e5, 0.03 * base)) continue;
      sb(tid).v += subio / 2; sb(tid).n++;
      sb(tid).lista.push({ pid: f.pid, de: base, a: f.clausula, pago: subio / 2 });
    }
    // las subidas que se vieron en jugadores que ya no tiene (el dinero se gastó igual)
    for (const m of H.mov || []) {
      if (m.tipo !== 'blinda' || !m.teamId || !(m.a > m.de)) continue;
      if (plantillaDe(m.teamId).some((f) => f.pid === m.pid)) continue;
      sb(m.teamId).v += (m.a - m.de) / 2; sb(m.teamId).n++; sb(m.teamId).vistas++;
    }
  }
  M.subidas = subidas;

  const diasMov = AH.desde ? Math.max(1, (ahora - AH.desde) / DIA) : 0;
  // la base común: lo que tendrías sin moverte (100 M de salida más las recompensas diarias que has cogido)
  const miF = flujos[yoTid] || { v: 0, raros: 0 }, miSub = subidas[yoTid] || { v: 0, dudas: 0 };
  const baseV = D.dinero != null ? num(D.dinero) - miF.v + miSub.v : null;
  const baseMin = 100e6 - 0.5e6, baseMax = 100e6 + diasMov * 0.1e6 + 0.5e6;
  const desvio = baseV == null || !AH.completa || D.demo ? 0 : baseV < baseMin ? baseMin - baseV : baseV > baseMax ? baseV - baseMax : 0;
  M.baseDinero = baseV == null ? null : { v: baseV, min: baseMin, max: baseMax, desvio, saldo: num(D.dinero), mov: miF.v, subidas: miSub.v, dias: diasMov };
  const dichos = extra.dichos || {};
  /** la cuenta con los movimientos, sin lo que te haya dicho */
  M.dineroCuenta = (tid) => {
    if (!tid || tid === yoTid) return null;
    if (D.dinero == null) return { v: null, exacto: false, fiable: 'no', motivo: 'no se sabe tu saldo' };
    if (!AH.completa) return { v: null, exacto: false, fiable: 'no', motivo: `faltan los movimientos del principio de la liga (hay desde ${AH.desde ? cuando(AH.desde, { hora: false }) : '?'})` };
    const f = flujos[tid] || { v: 0, n: 0, raros: 0 }, s = subidas[tid] || { v: 0, n: 0, dudas: 0 };
    const v = baseV + f.v - s.v;
    const valorR = num((M.equipo[tid] || {}).valor);
    // en una liga con mucho movimiento se puede tener bastante más dinero que equipo, así que arriba no hay tope;
    // lo que no puede ser es deber mucho más de lo que deja la deuda (el 20 % de su equipo)
    if (v < -0.4 * valorR - 15e6) return { v: null, exacto: false, fiable: 'no', motivo: `la cuenta da ${eur(v)}, más deuda de la que permite el juego` };
    // la recompensa diaria que uno coge y otro no, las subidas que no se pueden medir, lo raro y lo que no cuadra en la base
    const margen = Math.round((1e6 + Math.min(diasMov, 150) * 0.05e6 + s.dudas + num(miSub.dudas) + desvio + (num(f.raros) + num(miF.raros)) * 1e6) / 1e5) * 1e5;
    return { v, exacto: false, margen, fiable: 'media', desde: AH.desde, n: f.n, cuenta: { base: baseV, mov: f.v, subidas: s.v, nSubidas: s.n } };
  };
  /**
   * { v, exacto: true, fuente } si LaLiga lo da; si te ha dicho cuánto tiene, eso más lo que ha movido desde entonces;
   * si no, la cuenta con los movimientos { v, exacto: false, margen, fiable, desde }. Sin los movimientos desde el
   * principio de la liga no se puede estimar: entonces { v: null, fiable: 'no', motivo }.
   */
  M.dineroDe = (tid) => {
    if (!tid) return null;
    if (tid === yoTid) return D.dinero != null ? { v: num(D.dinero), exacto: true, fuente: 'tu cuenta' } : null;
    const ex = (D.dineros || {})[tid];
    if (ex && ex.v != null) return { v: num(ex.v), exacto: true, fuente: ex.fuente || 'LaLiga' };
    const dc = dichos[tid];
    if (dc && dc.v != null && dc.t && ahora - dc.t < 45 * DIA) {
      const f = flujos[tid] || { ev: [], n: 0 };
      const mov = f.ev.filter(([t]) => t > dc.t).reduce((x, [, d]) => x + d, 0);
      const sub = (H.mov || []).filter((m) => m.tipo === 'blinda' && m.teamId === tid && m.t > dc.t && m.a > m.de).reduce((x, m) => x + (m.a - m.de) / 2, 0);
      const dias = (ahora - dc.t) / DIA;
      const margen = Math.round((num(dc.r) + 0.3e6 + dias * 0.1e6) / 1e5) * 1e5;
      return { v: dc.v + mov - sub, exacto: false, margen, fiable: 'alta', dicho: dc, desdeDicho: mov - sub, n: f.n };
    }
    return M.dineroCuenta(tid);
  };
  /** lo que puede gastar de golpe en una cláusula: su saldo (con el margen si es estimado); null si no se sabe */
  M.capacidad = (tid) => {
    const d = M.dineroDe(tid);
    if (!d || d.v == null) return null;
    const seguro = d.exacto ? d.v : d.v - d.margen, alto = d.exacto ? d.v : d.v + d.margen;
    return { ...d, seguro, alto };
  };
  M.rivalesTid = D.clasif.filter((e) => e.teamId !== yoTid).map((e) => e.teamId);
  M.dineroExacto = M.rivalesTid.length > 0 && M.rivalesTid.every((tid) => { const d = M.dineroDe(tid); return d && d.exacto; });
  M.conDinero = M.rivalesTid.filter((tid) => M.capacidad(tid)).length;
  /**
   * quién puede pagar una cláusula: seguro (le sobra) o quizá (le llega con el margen de la estimación).
   * sinSaber: los rivales de los que no se sabe el dinero. Para pagar una cláusula hace falta tenerlo en el saldo.
   */
  M.quienPaga = (importe, sinTid = null) => {
    const out = { seguro: [], quiza: [], sinSaber: [] };
    for (const tid of M.rivalesTid) {
      if (tid === sinTid) continue;
      const c = M.capacidad(tid);
      if (!c) { out.sinSaber.push({ tid, nombre: nombreEquipo(tid) }); continue; }
      const x = { tid, nombre: nombreEquipo(tid), c };
      if (c.seguro >= importe) out.seguro.push(x);
      else if (c.alto >= importe) out.quiza.push(x);
    }
    // solo cuenta si se sabe el de casi todos (si no, «no le llega a nadie» sería mentira)
    out.hayDatos = M.rivalesTid.length > 0 && out.sinSaber.length <= Math.floor(M.rivalesTid.length * 0.2);
    return out;
  };

  /* ---------- lo que se paga en tu liga por los libres del mercado ---------- */
  // cada compra a LaLiga de las últimas semanas frente a lo que valía el jugador ese día
  {
    const clausulasAhora = new Set();
    for (const fichas of Object.values(D.plantillas || {})) for (const f of fichas) if (f.clausula) clausulasAhora.add(`${f.pid}|${f.clausula}`);
    const pujas = [];
    for (const a of AH.lista) {
      if (a.clase !== 'compra' || a.otroId || a.otro || !a.pid || !a.importe || !a.t || ahora - a.t > 45 * DIA) continue;
      const imp = Math.abs(num(a.importe));
      if (clausulasAhora.has(`${a.pid}|${imp}`)) continue;
      const v = valorEn(a.pid, a.t - 3 * HORA);
      if (!v) continue;
      const s = imp / v - 1;
      if (s < -0.1 || s > 1) continue;
      pujas.push({ s, tid: M.teamDeUsuario(a.quienId, a.quien), v, imp, t: a.t, pid: a.pid });
    }
    const cuantil = (l, q) => { const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * q, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
    if (pujas.length >= 4) {
      const ss = pujas.map((x) => x.s);
      const porEquipo = {};
      for (const x of pujas) if (x.tid) (porEquipo[x.tid] ||= []).push(x.s);
      // los caros (más de 10 M) se pagan distinto que los baratos
      const caros = pujas.filter((x) => x.v >= 10e6).map((x) => x.s), baratos = pujas.filter((x) => x.v < 10e6).map((x) => x.s);
      M.pujasLiga = {
        n: pujas.length, p25: cuantil(ss, 0.25), med: cuantil(ss, 0.5), p75: cuantil(ss, 0.75), p90: cuantil(ss, 0.9),
        caros: caros.length >= 3 ? cuantil(caros, 0.5) : null, baratos: baratos.length >= 3 ? cuantil(baratos, 0.5) : null,
        porEquipo: Object.fromEntries(Object.entries(porEquipo).map(([tid, l]) => [tid, { n: l.length, med: cuantil(l, 0.5), max: Math.max(...l) }])),
        ult: pujas.sort((a, b) => b.t - a.t).slice(0, 10),
      };
    } else M.pujasLiga = pujas.length ? { n: pujas.length, poco: true, med: cuantil(pujas.map((x) => x.s), 0.5), porEquipo: {}, ult: pujas } : null;
  }

  /* ---------- lo que ofrece LaLiga por lo que se pone a la venta ---------- */
  // Las ofertas de los rivales por un jugador en venta solo las ve su dueño, pero lo que paga LaLiga se sabe: las
  // ventas a LaLiga de tu liga (y las ofertas de LaLiga que tienes ahora) frente a lo que valía el jugador ese día.
  // Sirve para saber cuánto le darán a un rival si nadie le compra (por menos no tiene por qué venderte) y lo que te
  // llegará a ti.
  {
    const q = (l, p) => { const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
    const r = [];
    // una venta que es también la compra de otro manager (mismo jugador y mismo importe) no fue a LaLiga
    const comprasManager = new Set();
    for (const a of AH.lista) if ((a.clase === 'compra' || a.clase === 'clausula') && a.pid) comprasManager.add(`${a.pid}|${Math.abs(num(a.importe))}`);
    for (const a of AH.lista) {
      if (a.clase !== 'venta' || !a.pid || !a.importe || !a.t || ahora - a.t > 60 * DIA) continue;
      const imp = Math.abs(num(a.importe));
      if (comprasManager.has(`${a.pid}|${imp}`)) continue;
      const v = valorEn(a.pid, a.t - 3 * HORA);
      if (!v) continue;
      const s0 = imp / v - 1;
      if (s0 >= -0.25 && s0 <= 0.25) r.push(s0);
    }
    for (const v of D.misVentas || []) for (const o of v.ofertas || []) if (o.deLiga && o.importe && J(v.pid).valor) r.push(o.importe / J(v.pid).valor - 1);
    M.ofertaLiga = r.length ? { n: r.length, med: q(r, 0.5), p25: q(r, 0.25), p75: q(r, 0.75), poco: r.length < 3 } : null;
  }
  /* ---------- lo que se paga en tu liga en los clausulazos ---------- */
  // cada cláusula pagada frente a lo que valía el jugador ese día: dice hasta dónde llega la gente de tu liga
  {
    const q = (l, p) => { const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
    const r = [];
    for (const a of AH.lista) {
      if (a.clase !== 'clausula' || !a.pid || !a.importe || !a.t) continue;
      const v = valorEn(a.pid, a.t - 3 * HORA);
      if (!v) continue;
      const s0 = Math.abs(num(a.importe)) / v - 1;
      if (s0 > -0.1 && s0 < 3) r.push(s0);
    }
    M.clausulazos = r.length ? { n: r.length, med: q(r, 0.5), p75: q(r, 0.75), p90: q(r, 0.9), max: Math.max(...r) } : null;
  }

  /** lo que ofrecería LaLiga por un jugador: su valor ajustado con lo que suele ofrecer en tu liga */
  M.ofertaLigaDe = (j) => {
    if (!j || !j.valor) return null;
    const OL = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga : null;
    const med = OL ? OL.med : 0;
    return { v: Math.round((j.valor * (1 + med)) / 1e4) * 1e4, med, n: OL ? OL.n : 0, sinDatos: !OL, min: OL ? Math.round((j.valor * (1 + OL.p25)) / 1e4) * 1e4 : null, max: OL ? Math.round((j.valor * (1 + OL.p75)) / 1e4) * 1e4 : null };
  };

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
  const misFichasRaw = ((D.plantillas || {})[yoTid] || []).filter((f) => !vendidos[f.pid]);
  M.formaciones = (D.formaciones && D.formaciones.length ? D.formaciones : FORMACIONES).map(partirFormacion).filter(Boolean);
  const onces = (extra.onces && extra.onces.jugadores) || {};
  M.hayOnces = Object.keys(onces).length > 0;
  M.onceProb = (pid) => onces[pid] || null;
  M.noticias = (extra.noticias && extra.noticias.lista) || [];
  M.noticiasDe = (pid) => M.noticias.filter((n) => n.pids && n.pids.includes(pid));

  /* ---------- riesgo de rotación: si su equipo juega otra competición pegada a la jornada ---------- */
  // (los partidos de todas las competiciones de cada equipo vienen de SofaScore; una Champions dos días antes
  // o después hace rotar más que una eliminatoria de Copa, donde los que descansan son los de la Copa)
  const calEx = av.calendario || {};
  M.rotacion = (eqId) => {
    const p = M.proximoPartido(eqId);
    const lista = calEx[eqId] || [];
    if (!p || !lista.length) return null;
    const cerca = lista.filter((x) => x.t && !x.liga && Math.abs(x.t - p.fecha) <= 4.2 * DIA && Math.abs(x.t - p.fecha) > 8 * HORA)
      .map((x) => ({ ...x, antes: x.t < p.fecha, dias: Math.abs(x.t - p.fecha) / DIA }));
    let riesgo = 0;
    for (const x of cerca) {
      const peso = /champions/i.test(x.comp) ? 0.14 : /europa|conference/i.test(x.comp) ? 0.11 : /copa|supercopa|cup/i.test(x.comp) ? 0.04 : 0.06;
      riesgo += peso * (x.dias <= 3.2 ? 1 : 0.6);
    }
    return { p, cerca, riesgo: clamp(riesgo, 0, 0.3) };
  };

  /* ---------- la titularidad de cada jugador, juntando fuentes ---------- */
  // el once probable de futbolfantasy, sus minutos de las últimas jornadas y lo que ha jugado en la temporada
  // (SofaScore o Understat); luego la duda, la lesión y el riesgo de rotación
  M.titularidad = (j) => {
    if (!j || !j.pos || j.pos === 5) return null;
    if (MALOS.has(j.estado)) return { p: 0, base: 0, fuentes: [{ f: j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga', p: 0, w: 1 }], rot: null, pRot: 0 };
    const fuentes = [];
    const op = M.hayOnces ? onces[j.id] || null : null;
    if (op && op.estado === 'injured') return { p: 0, base: 0, fuentes: [{ f: 'futbolfantasy: lesionado', p: 0, w: 1 }], rot: null, pRot: 0 };
    if (M.hayOnces) fuentes.push({ f: 'once probable', p: op && op.titular ? (op.prob != null ? op.prob / 100 : 0.85) : op && op.alternativa ? 0.3 : 0.15, w: 0.5 });
    const st = det[j.id] && det[j.id].stats ? det[j.id].stats.slice(-5) : [];
    if (st.length >= 3 && st.some((s) => s.min != null)) fuentes.push({ f: `últimas ${st.length}`, p: st.filter((s) => s.min >= 60).length / st.length, w: 0.3 });
    const a = M.avanzado(j.id), tE = tabla[j.equipoId];
    if (a && a.s && a.s.pj && a.s.tit != null && tE && tE.pj >= 3) fuentes.push({ f: 'temporada', p: clamp(a.s.tit / tE.pj, 0, 1), w: 0.2 });
    else if (a && a.u && a.u.min && tE && tE.pj >= 3) fuentes.push({ f: 'temporada', p: clamp((a.u.min / (tE.pj * 90)) * 1.08, 0, 1), w: 0.2 });
    if (!fuentes.length) return null;
    const W = fuentes.reduce((s, x) => s + x.w, 0);
    let p = fuentes.reduce((s, x) => s + x.p * x.w, 0) / W;
    const base = p;
    if (j.estado === 'doubtful' || (op && op.estado === 'doubtful')) p *= 0.6;
    const rot = M.rotacion(j.equipoId);
    // al indiscutible se le rota menos; al que está en el filo, más
    const pRot = rot && rot.riesgo ? rot.riesgo * (p >= 0.9 ? 0.6 : p >= 0.5 ? 1.2 : 0.5) : 0;
    p *= 1 - pRot;
    return { p: clamp(p, 0, 0.98), base, fuentes, rot, pRot };
  };

  /* ---------- los puntos esperados por partes, como puntúa LaLiga Fantasy ---------- */
  // minutos (2 si juega 60', 1 si menos), gol (6 portero y defensa, 5 medio, 4 delantero) con su xG, asistencia (3)
  // con su xA, portería a cero (4 portero y defensa, 1 medio) con lo que marca el rival, goles encajados (−2 cada
  // dos), paradas (1 cada 3), tarjetas, y el resto (nota de DAZN, recuperaciones, tiros…) de lo que suele sacar
  const PG = { 1: 6, 2: 6, 3: 5, 4: 4 }, PC = { 1: 4, 2: 4, 3: 1, 4: 0 };
  // xG y xA por 90' típicos de cada puesto, si no hay datos suyos
  const RITMO = { 1: [0, 0.01], 2: [0.05, 0.07], 3: [0.12, 0.13], 4: [0.36, 0.12] };
  const cacheDes = {};
  M.desglose = (j) => {
    if (!j || !j.pos || j.pos === 5) return null;
    if (cacheDes[j.id] !== undefined) return cacheDes[j.id];
    const T = M.titularidad(j), pr = M.previa(j);
    if (!T || !pr || pr.golesFavor == null) return (cacheDes[j.id] = null);
    const pT = T.p, pS = (1 - pT) * 0.45;
    const min = pT * 80 + pS * 22, f90 = min / 90;
    const a = M.avanzado(j.id) || {}, u = a.u, s = a.s;
    const conU = !!(u && u.min >= 270), conS = !!(s && s.min >= 270 && s.xg != null);
    const xg90 = conU ? (u.xg * 90) / u.min : conS ? (s.xg * 90) / s.min : RITMO[j.pos][0];
    const xa90 = conU ? (u.xa * 90) / u.min : conS && s.xa != null ? (s.xa * 90) / s.min : RITMO[j.pos][1];
    const tE = tabla[j.equipoId], xt = M.xgEquipo(j.equipoId);
    const mediaEq = xt && xt.xg != null ? xt.xg : tE && tE.pj ? tE.gf / tE.pj : mediaGoles;
    const mediaContra = xt && xt.xga != null ? xt.xga : tE && tE.pj ? tE.gc / tE.pj : mediaGoles;
    // lo que se espera que marque su equipo en ESTE partido frente a lo que marca normalmente
    const fAt = clamp(pr.golesFavor / Math.max(0.4, mediaEq), 0.5, 1.8);
    const partes = {
      min: pT * 2 + pS,
      gol: xg90 * f90 * fAt * PG[j.pos],
      asis: xa90 * f90 * fAt * 3,
      cero: (pr.cero || 0) * pT * 0.92 * PC[j.pos],
      encaja: j.pos <= 2 ? -(pr.golesContra || 0) * f90 * 0.85 : 0,
    };
    if (j.pos === 1) {
      const par90 = s && s.min >= 270 && s.paradas != null ? (s.paradas * 90) / s.min : 2.6;
      partes.paradas = (par90 * f90 * clamp((pr.golesContra || mediaContra) / Math.max(0.4, mediaContra), 0.6, 1.6)) / 3;
    }
    const am90 = conU && u.am != null ? (num(u.am) * 90) / u.min : 0.2, ro90 = conU && u.ro != null ? (num(u.ro) * 90) / u.min : 0.01;
    partes.tarjetas = -(am90 + ro90 * 3) * f90;
    // el resto: lo que saca de media por partido menos lo que explican sus minutos, goles, asistencias, ceros y tarjetas
    let resto90 = 1.4;
    const pj = s && s.pj ? s.pj : u && u.pj ? u.pj : null;
    if (num(j.media) > 0 && pj >= 3) {
      const g = conU ? u.g : s ? num(s.g) : 0, as = conU ? u.a : s ? num(s.a) : 0;
      const minPj = conU ? u.min / pj : s && s.min ? s.min / pj : 75;
      const tit = s && s.tit != null ? s.tit / pj : clamp(minPj / 90, 0, 1);
      const ceros = tE && tE.pj ? tE.ult.filter((x) => x.gc === 0).length / tE.pj : 0.25;
      const encajados = tE && tE.pj ? tE.gc / tE.pj : mediaGoles;
      const expl = tit * 2 + (1 - tit) + (g / pj) * PG[j.pos] + (as / pj) * 3 + ceros * tit * PC[j.pos]
        - (j.pos <= 2 ? encajados * (minPj / 90) * 0.85 : 0) - (conU && u.am != null ? (num(u.am) + num(u.ro) * 3) / pj : 0.2)
        + (j.pos === 1 && s && s.paradas ? s.paradas / pj / 3 : 0);
      resto90 = clamp(num(j.media) - expl, -1, 5) / Math.max(0.35, minPj / 90);
    }
    partes.resto = resto90 * f90;
    for (const k of Object.keys(partes)) if (!Number.isFinite(partes[k])) partes[k] = 0;
    const total = Math.max(0, Object.values(partes).reduce((x, y) => x + y, 0));
    return (cacheDes[j.id] = { total, partes, pT, min, T, fAt, xg90, xa90, fuente: conU ? 'Understat' : conS ? 'SofaScore' : 'medias del puesto' });
  };

  /* ---------- los puntos esperados: la fórmula de siempre y el desglose, corregidos con lo que se ha fallado ---------- */
  // calib (de aprende.js): cuánto pesa el desglose frente a la fórmula de siempre según cuál ha acertado más, y el
  // sesgo de cada puesto (si a los delanteros se les espera de más, se baja)
  const cal = extra.calib || null;
  M.calib = cal;
  const wDes = cal && cal.w != null ? cal.w : 0.5;
  const cachePP = {};
  M.ppDetalle = (j) => {
    if (!j || !j.id) return null;
    if (cachePP[j.id]) return cachePP[j.id];
    const T = j.pos && j.pos !== 5 ? M.titularidad(j) : null;
    let base = puntosEsperados(j, M.forma(j.id), M.hayOnces ? (onces[j.id] || { fuera: true }) : null) * M.factorRival(j).f;
    if (T && T.pRot) base *= 1 - T.pRot;
    const d = M.desglose(j);
    const crudo = d ? wDes * d.total + (1 - wDes) * base : base;
    const sesgo = cal && cal.sesgo && cal.sesgo[j.pos] ? cal.sesgo[j.pos] : 1;
    return (cachePP[j.id] = { base, desg: d ? d.total : null, crudo, final: crudo * sesgo, sesgo, w: d ? wDes : 0, d, T });
  };
  M.ppEsperado = (j) => (M.ppDetalle(j) || { final: 0 }).final;

  /* ---------- el calendario de riesgo: sus próximos partidos de una vez ---------- */
  // Un jugador vale lo que puntúa mientras lo tienes. Se miran sus próximos 5 partidos (o todos los de los 14 días
  // que un fichaje tiene la cláusula protegida, si son más): contra quién, lo difícil que es, en casa o fuera, lo que
  // se espera que puntúe en cada uno y si será titular (con la rotación si su equipo juega otra competición cerca).
  // Con un calendario duro, fichar solo compensa de parche y sin pagar de más.
  const factorContra = (j, rid, casa) => {
    const r = tabla[rid];
    if (!r || r.pj < 3) return { f: casa ? 1.04 : 0.96, r: r || null, nivel: null };
    const ataque = r.gf / r.pj / mediaGoles, defensa = r.gc / r.pj / mediaGoles, fuerza = r.pts / r.pj / mediaPts;
    const base = j.pos <= 2 ? 1 / Math.max(0.4, ataque) : defensa;
    let f = 0.55 + 0.25 * base + 0.2 / Math.max(0.4, fuerza);
    f *= casa ? 1.05 : 0.95;
    return { f: clamp(f, 0.75, 1.25), r, nivel: nivelDe(r) };
  };
  /** lo que le resta la rotación en un partido concreto (si su equipo juega otra competición a menos de 4 días) */
  const rotacionEn = (eqId, t, p) => {
    const lista = calEx[eqId] || [];
    let riesgo = 0;
    const cerca = [];
    for (const x of lista) {
      if (!x.t || x.liga) continue;
      const dias = Math.abs(x.t - t) / DIA;
      if (dias > 4.2 || dias < 8 / 24) continue;
      const peso = /champions/i.test(x.comp) ? 0.14 : /europa|conference/i.test(x.comp) ? 0.11 : /copa|supercopa|cup/i.test(x.comp) ? 0.04 : 0.06;
      riesgo += peso * (dias <= 3.2 ? 1 : 0.6);
      cerca.push(x.comp);
    }
    riesgo = clamp(riesgo, 0, 0.3) * (p >= 0.9 ? 0.6 : p >= 0.5 ? 1.2 : 0.5);
    return { riesgo, cerca };
  };
  const cacheCal = {};
  M.calendarioRiesgo = (j) => {
    if (!j || !j.equipoId || !j.pos || j.pos === 5) return null;
    if (cacheCal[j.id] !== undefined) return cacheCal[j.id];
    const lista = [];
    for (const jo of jornadas) for (const p of jo.partidos) {
      if (!p.fecha || p.fecha + 2 * HORA < ahora) continue;
      const casa = p.localId === j.equipoId;
      if (!casa && p.visitanteId !== j.equipoId) continue;
      lista.push({ jornada: jo.n, fecha: p.fecha, casa, rivalId: casa ? p.visitanteId : p.localId, rival: casa ? p.visitante : p.local });
    }
    lista.sort((a, b) => a.fecha - b.fecha);
    const enProteccion = lista.filter((x) => x.fecha <= ahora + 14 * DIA).length;
    const ps = lista.slice(0, Math.max(Math.min(5, lista.length), enProteccion));
    if (!ps.length) return (cacheCal[j.id] = null);
    // lo que puntúa sin contar el rival (los puntos esperados del próximo partido, quitado su rival)
    const T = M.titularidad(j);
    const fr1 = M.factorRival(j);
    const pp1 = M.ppEsperado(j);
    const sinRival = pp1 > 0 ? pp1 / Math.max(0.5, fr1.f || 1) : num(j.media);
    const p1 = T ? T.p : null;
    const out = ps.map((x, i) => {
      const fc = factorContra(j, x.rivalId, x.casa);
      // la titularidad: la del próximo partido tal cual; para los siguientes, la de base con la rotación de ese día
      let pTit = p1, rot = null;
      if (T && i > 0) {
        const ro = rotacionEn(j.equipoId, x.fecha, T.base);
        pTit = clamp(T.base * (1 - ro.riesgo), 0, 0.98);
        rot = ro.cerca.length ? ro.cerca : null;
      } else if (T && T.rot && T.rot.cerca && T.rot.cerca.length) rot = T.rot.cerca.map((c) => c.comp);
      const ratio = p1 && pTit != null ? clamp(pTit / Math.max(0.05, p1), 0, 1.5) : 1;
      const pts = Math.max(0, sinRival * fc.f * (i === 0 ? 1 : ratio));
      return { ...x, f: fc.f, nivel: fc.nivel, pos: fc.r ? fc.r.pos : null, pts, pTit, rot };
    });
    const n = out.length;
    const fAvg = out.reduce((a, x) => a + x.f, 0) / n;
    const nDif = out.filter((x) => x.nivel === 'difícil').length, nFac = out.filter((x) => x.nivel === 'fácil').length, nMed = out.filter((x) => x.nivel === 'media').length;
    const pts = out.reduce((a, x) => a + x.pts, 0);
    const conTit = out.filter((x) => x.pTit != null);
    const pTit = conTit.length ? conTit.reduce((a, x) => a + x.pTit, 0) / conTit.length : null;
    const tipo = fAvg <= 0.95 || nDif >= Math.ceil(n / 2) ? 'duro' : fAvg >= 1.05 || (nFac >= Math.ceil(n / 2) && nDif === 0) ? 'favorable' : 'normal';
    const riesgo = MALOS.has(j.estado) || tipo === 'duro' || (pTit != null && pTit < 0.5) ? 'alto' : (pTit != null && pTit < 0.75) || (tipo === 'normal' && nDif >= 2) ? 'medio' : 'bajo';
    const maxSobre = riesgo === 'alto' ? 0.05 : null;
    const consejo = riesgo === 'alto'
      ? (tipo === 'duro' ? 'Calendario duro: ficharlo solo de parche y sin pagar más de un 5 % sobre su valor.' : 'Poco seguro que juegue: solo de parche y sin pagar de más.')
      : tipo === 'favorable' && (pTit == null || pTit >= 0.75) ? 'Calendario favorable: si es titular, se puede pagar algo más por él.' : riesgo === 'medio' ? 'Riesgo medio: mira el precio y si de verdad entra en tu once.' : 'Sin pegas de calendario.';
    const d1c = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
    const texto = `${n} partido${n === 1 ? '' : 's'}${enProteccion > 5 ? ' (los de sus 14 días protegido)' : ''}: ${[nDif && `${nDif} difícil${nDif > 1 ? 'es' : ''}`, nMed && `${nMed} de nivel medio`, nFac && `${nFac} fácil${nFac > 1 ? 'es' : ''}`].filter(Boolean).join(', ') || 'rivales sin datos'}. ~${d1c(pts)} pts (${d1c(pts / n)} por partido${j.media ? `; su media es ${d1c(num(j.media))}` : ''})${pTit != null ? `, titular ~${Math.round(pTit * 100)} %` : ''}.`;
    return (cacheCal[j.id] = { partidos: out, n, fAvg, nDif, nMed, nFac, pts, pTit, tipo, riesgo, maxSobre, consejo, texto, hasta: out[out.length - 1].fecha });
  };
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

  /* ---------- lo que se paga de más: en euros, no solo en porcentaje, y en una escala continua ---------- */
  // un +25 % por uno de 3 M son 750 mil; por uno de 40 M, 10 M. El índice (0 a 100) crece poco a poco con:
  // - los euros que pierdes de verdad (lo pagado de más menos la mitad de lo que recuperarías en una semana),
  //   comparados con el valor de tu equipo;
  // - y, un poco, el porcentaje (pagar casi el doble no es serio aunque sea poco dinero)
  const valorEq = Math.max(num(D.valorEquipo), 50e6);
  M.sobrecoste = (j, precio, t = j ? M.tend(j.id) : null) => {
    if (!j || !j.valor || !precio) return { extra: 0, sobre: 0, indice: 0, dias: null, efectivo: 0, recTxt: '' };
    const extra = precio - j.valor, sobre = precio / j.valor - 1;
    const diario = t ? (t.d7 != null && t.d7 > 0 ? t.d7 / 7 : t.d1 != null && t.d1 > 0 ? t.d1 : 0) : 0;
    const dias = extra > 0 && diario > 0 ? extra / diario : extra > 0 ? Infinity : 0;
    // lo que sube no está garantizado: se descuenta solo la mitad de lo que recuperaría en una semana
    const efectivo = Math.max(0, extra - diario * 7 * 0.5);
    const x = efectivo / valorEq / 0.02 + Math.max(0, sobre - 0.1) / 1.2;
    const indice = extra <= 0 ? 0 : Math.round(100 * (1 - Math.exp(-x)));
    const recTxt = extra <= 0 ? '' : !Number.isFinite(dias) ? 'no sube: no lo recuperas' : dias > 30 ? 'con lo que sube tardarías más de un mes en recuperarlo' : `lo recuperas en ${Math.max(1, Math.round(dias))} día${Math.round(dias) <= 1 ? '' : 's'} con lo que sube`;
    return { extra, sobre, dias, diario, efectivo, indice, recTxt };
  };
  /**
   * cuánto sobrecoste se aguanta por un jugador: de 60 si no aporta nada a tu once a 95 si lo mejora mucho
   * (también en escala continua, con lo que suma por jornada)
   */
  M.tolerancia = (j) => {
    const g = j && M.mejora ? Math.max(0, M.mejora(j)) : 0;
    return Math.round(60 + 35 * (1 - Math.exp(-g / 3)));
  };

  /* ---------- cuánto interesa un jugador (0 a 100) ---------- */
  M.interes = (j, precio, t = M.tend(j.id)) => {
    const partes = [];
    const rend = clamp(num(j.media) / 7, 0, 1.3) * 30;
    if (j.media) partes.push(`${String(Math.round(j.media * 10) / 10).replace('.', ',')} pts de media`);
    const mov = t.p7 != null ? t.p7 : t.p1 != null ? t.p1 * 3 : 0;
    let momentum = clamp(mov / 10, -1, 1) * 15;
    // lo que importa es hacia dónde va ahora: un +10 % en 7 días que ya ha girado no es una subida
    const ine = M.inercia(j.id);
    if (ine) {
      if (ine.fase === 'giro' || ine.fase === 'baja') { momentum = Math.min(momentum, 0) - 8; partes.push(ine.fase === 'giro' ? 'ha girado a la baja' : `baja ${eur(Math.abs(ine.ult))} al día`); }
      else if (ine.fase === 'parado') { momentum = Math.min(momentum, 3) - 4; partes.push('se ha estancado tras subir'); }
      else if (ine.fase === 'frena') { momentum -= 5; partes.push(`sube cada vez menos (gira en ~${Math.max(1, Math.round(ine.giroEn))} d)`); }
      else if (ine.fase === 'acelera') momentum += 3;
    }
    const ine0 = M.inercia(j.id), giro0 = ine0 && ['giro', 'baja', 'parado'].includes(ine0.fase);
    if (giro0) { /* lo dice la inercia, más abajo */ }
    else if (t.p7 != null && Math.abs(t.p7) >= 2) partes.push(`${t.p7 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p7), 1, false)} en 7 días`);
    else if (t.p1 != null && Math.abs(t.p1) >= 1) partes.push(`${t.p1 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p1), 1, false)} hoy`);
    const ratio = j.valor ? precio / j.valor : 2;
    const barato = clamp((1.6 - ratio) / 0.6, 0, 1) * 20;
    // pagar de más se pierde en el valor del equipo: lo que castiga es el dinero que se pierde, no el porcentaje
    const sc = M.sobrecoste(j, precio, t);
    const caro = sc.indice * 0.5;
    if (ratio <= 1.05) partes.push('cuesta lo que vale');
    else partes.push(`cuesta ${eur(sc.extra)} más de lo que vale (${pct(sc.sobre * 100)}${sc.recTxt ? `; ${sc.recTxt}` : ''})`);
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
    // y los partidos que vienen detrás: con un calendario duro interesa menos, con uno favorable, más
    const cal = j.pos && j.pos < 5 ? M.calendarioRiesgo(j) : null;
    if (cal && cal.n >= 3) {
      rival = Math.round(rival * 0.4 + (cal.fAvg - 1) * 45);
      if (cal.tipo === 'duro') partes.push(`calendario duro (${cal.nDif} difícil${cal.nDif === 1 ? '' : 'es'} en ${cal.n})`);
      else if (cal.tipo === 'favorable') partes.push(`calendario favorable (${cal.nFac} fácil${cal.nFac === 1 ? '' : 'es'} en ${cal.n})`);
    }
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
  const valorMedioLiga = (() => { const v = D.clasif.map((e) => num(e.valor)).filter(Boolean).sort((a, b) => a - b); return v.length ? Math.max(50e6, v[Math.floor(v.length / 2)]) : Math.max(50e6, num(D.valorEquipo)); })();
  const misCompras = compras(D, M, yoTid);
  M.mias = misFichasRaw.map((f) => {
    const x = enriquecer(f, yoTid);
    const compra = f.compra || misCompras[f.pid] || null;
    x.compra = compra;
    x.ganado = compra ? x.j.valor - compra : null;
    // riesgo de que te lo quiten. Si te lo clausulan, cobras su cláusula: lo que pierdes de verdad son sus puntos en tu
    // once (y lo que fuera a subir). Así que cuenta lo cerca que está la cláusula de su valor y lo que te aporta
    // ¿quién pagaría su cláusula? Cuenta el porcentaje de más (por encima de un 30 % nadie), los EUROS de más (un 20 %
    // son 1 M en uno de 5 M y 16 M en uno de 80 M; se comparan con lo que vale un equipo de tu liga) y lo bueno que es
    // (por uno muy bueno se paga algo más). Sale un número de 0 a 1,3, sin saltos, que se pasa a ninguno/bajo/medio/alto
    let r = 0;
    x.atractivo = 0;
    if (x.ratio != null && x.clausula && (x.abierta || x.abreEn < 36 * HORA)) {
      const pctMas = Math.max(0, x.ratio - 1), eurMas = Math.max(0, x.clausula - x.j.valor);
      const fp = clamp(1 - pctMas / 0.3, 0, 1);
      const fe = clamp(1 - eurMas / (0.04 * valorMedioLiga), 0, 1);
      const fa = clamp(0.6 + num(x.j.media) / 10, 0.6, 1.3);
      x.atractivo = fp * fe * fa;
      r = x.atractivo >= 0.6 ? 3 : x.atractivo >= 0.35 ? 2 : x.atractivo >= 0.15 ? 1 : 0;
      if (!x.abierta) r = Math.max(0, r - 1);
    }
    const CZ = M.clausulazos;
    if (r && CZ && CZ.n >= 3 && x.ratio - 1 > Math.max(CZ.p90, 0.05) + 0.03) r = 0;
    // y si está bajando, menos: nadie paga de más por uno que pierde valor
    const ineR = M.inercia(x.pid);
    if (r && ineR && ['giro', 'baja', 'parado'].includes(ineR.fase)) r = Math.max(0, r - 1);
    x.pierde = M.perdida(x.pid);
    // o uno que está subiendo bien: si te lo quitan a su valor, pierdes lo que iba a subir
    const sube = (() => { const ine = M.inercia(x.pid); return !!ine && (ine.fase === 'sube' || ine.fase === 'acelera') && ine.proyJ >= Math.max(400000, x.j.valor * 0.04); })();
    x.importa = x.pierde >= 0.8 || (sube && x.ratio != null && x.ratio < 1.15);
    // uno que no juega en tu once: que te lo clausulen es casi como venderlo por su cláusula
    if (r && !x.importa) r = x.pierde < 0.3 && x.ratio >= 1 ? 0 : Math.min(r, 1);
    // y quién tiene dinero para pagarla: si no le llega a nadie, el riesgo baja (aunque pueden vender y juntarlo)
    x.pagan = x.clausula ? M.quienPaga(x.clausula) : null;
    if (r && x.pagan) {
      const p = x.pagan;
      if (p.seguro.length >= 2 && x.atractivo >= 0.35) r = Math.min(3, r + 1);
      else if (p.hayDatos && !p.seguro.length && !p.quiza.length) r = Math.min(r, p.sinSaber.length ? 2 : 1);
    }
    x.riesgo = ['ninguno', 'bajo', 'medio', 'alto'][r];
    // el blindaje justo: hasta dónde subir la cláusula para que no le llegue a nadie (subir X cuesta X/2)
    if (x.clausula && (x.abierta || x.abreEn < 2 * DIA) && x.pagan && M.conDinero) {
      const caps = M.rivalesTid.map((tid) => ({ tid, nombre: nombreEquipo(tid), c: M.capacidad(tid) })).filter((y) => y.c).sort((a, b) => b.c.alto - a.c.alto);
      const hasta = (v) => Math.ceil((Math.max(v, 0) * 1.03 + 1) / 1e5) * 1e5;
      if (caps.length) {
        const T = hasta(caps[0].c.alto);
        const coste = (t) => Math.ceil((t - x.clausula) / 2 / 1e4) * 1e4;
        // no compensa gastar en blindarlo más de un tercio de lo que vale
        const tope = x.j.valor / 3;
        x.blindaje = T > x.clausula ? { objetivo: T, coste: coste(T), rico: caps[0].nombre, caro: coste(T) > tope } : { objetivo: x.clausula, coste: 0, rico: caps[0].nombre, yaVale: true };
        // si dejarlo fuera del alcance de todos no compensa: la subida más barata que deja fuera a casi todos
        if (x.blindaje.caro) {
          // (solo si deja fuera a casi todos: con más de dos que aún pueden, no protege)
          for (let k = 1; k <= Math.min(2, caps.length - 1); k++) {
            const Tk = hasta(caps[k].c.alto);
            if (Tk <= x.clausula) break;
            if (coste(Tk) <= tope) { x.blindaje.parcial = { objetivo: Tk, coste: coste(Tk), quedan: caps.slice(0, k).map((y) => y.nombre) }; break; }
          }
        }
        x.blindaje.sinSaber = x.pagan.sinSaber.map((y) => y.nombre);
      }
    }
    x.prox = M.proximoPartido(x.j.equipoId);
    x.inercia = M.inercia(x.pid);
    x.ventaInercia = M.ventaPorInercia(x.pid);
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
  M.mercado = (D.mercado || []).filter((m) => (m.tipo === 'manager' || !M.dueno[m.pid]) && !esEnt(m.pid) && !(m.tipo === 'manager' && vendidos[m.pid] && (!m.vendedorTeamId || m.vendedorTeamId === yoTid))).map((m0) => {
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
    // la inercia manda sobre la tendencia de la semana
    const ineM = M.inercia(m.pid);
    if (ineM && veredicto !== 'evitar') {
      if (ineM.fase === 'giro' || ineM.fase === 'baja') veredicto = 'baja';
      else if ((ineM.fase === 'frena' || ineM.fase === 'parado') && ['chollo', 'sube', 'normal'].includes(veredicto)) veredicto = 'frena';
    }
    // la puja que pondría: el precio y un margen por las pujas que lleva y por si está subiendo
    let margen = 0.02 + Math.min(m.pujas, 5) * 0.025 + (t.p1 != null && t.p1 > 0 ? Math.min(t.p1, 4) / 100 : 0) + (i.n >= 70 ? 0.03 : 0);
    // y lo que de verdad hace falta en TU liga para llevarse a uno así: cuanto más interesa, más arriba de lo que
    // se suele pagar (los caros se pagan distinto que los baratos)
    const PL = M.pujasLiga;
    let pujaLiga = null;
    if (m.tipo !== 'manager' && PL && !PL.poco) {
      const tramo = j.valor >= 10e6 ? PL.caros : PL.baratos;
      const ajuste = tramo != null ? tramo - PL.med : 0;
      const q = (i.n >= 75 ? PL.p75 : i.n >= 55 ? PL.med : PL.p25) + ajuste;
      pujaLiga = Math.max(0, q) + Math.min(m.pujas, 5) * 0.01;
      margen = 0.35 * margen + 0.65 * pujaLiga;
    }
    if (m.tipo === 'manager') margen = 0;
    let puja = Math.ceil(m.precio * (1 + margen) / 10000) * 10000;
    // sin pasar de lo que se aguanta pagar por lo que aporta a tu once
    let recortada = false;
    if (m.tipo !== 'manager') {
      const tope = M.tolerancia(j) - 15;
      for (let k = 0; k < 60 && puja > m.precio && M.sobrecoste(j, puja, t).indice > tope; k++) { puja = Math.max(m.precio, puja - Math.max(10000, Math.round(puja * 0.01 / 10000) * 10000)); recortada = true; }
    }
    return { ...m, j, tend: t, sobre, interes: i.n, por: i.por, veredicto, meLlega: m.precio <= M.pujaMax, puja, pujaLiga, recortada, ofertaLiga: m.tipo === 'manager' && m.vendedorTeamId !== yoTid ? M.ofertaLigaDe(j) : null, prox: M.proximoPartido(j.equipoId), dueno: M.dueno[m.pid] || null };
  }).sort((a, b) => b.interes - a.interes);
  {
    // la hora a la que caducan casi todos los libres es el cambio de mercado; lo que pone a la venta un manager
    // (o tú) caduca a su propia hora y no cuenta
    const libres = (D.mercado || []).filter((m) => m.tipo !== 'manager' && m.cierra && m.cierra > ahora);
    const veces = {};
    for (const m of libres) { const k = Math.round(m.cierra / 60000); veces[k] = (veces[k] || 0) + 1; }
    const comun = Object.entries(veces).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    M.cierreMercado = comun ? +comun[0] * 60000 : Math.min(...M.mercado.map((m) => m.cierra || Infinity).filter((x) => x > ahora), Infinity);
  }
  if (!Number.isFinite(M.cierreMercado)) M.cierreMercado = null;

  /* ---------- tus jugadores en venta y sus ofertas ---------- */
  M.misVentas = (D.misVentas || []).filter((v) => !vendidos[v.pid]).map((v) => {
    const j = J(v.pid), t = M.tend(v.pid);
    const mia = (D.plantillas[yoTid] || []).find((f) => f.pid === v.pid);
    const compra = mia && (mia.compra || null);
    const ofertas = (v.ofertas || []).map((o) => ({ ...o, sobre: j.valor ? o.importe / j.valor - 1 : 0 }));
    const mejor = ofertas[0] || null;
    // ¿aceptar? si paga más que su valor, o si está bajando y la oferta no se queda muy corta
    let consejo = 'esperar', porque = '';
    const bajando = (t.p1 != null && t.p1 < -0.5) || (t.p7 != null && t.p7 < -2);
    const subiendo = (t.p1 != null && t.p1 > 0.5) || (t.p7 != null && t.p7 > 2);
    const ine = M.inercia(v.pid);
    // La oferta de LaLiga se renueva en cada cambio de mercado. Si la de hoy es de las más bajas que da en tu liga y no
    // hay prisa, lo normal es que mañana llegue una mejor aunque el jugador baje un poco: venderlo hoy es hacerlo por lo
    // mínimo. Se cuenta con algo menos que la mediana, porque las que se aceptan son las buenas.
    const OL = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga : null;
    let liga = null;
    if (mejor && mejor.deLiga && OL && j.valor) {
      const normal = (OL.p25 + OL.med) / 2;
      const dia = ine ? Math.min(num(ine.ult), num(t.d1) || 0) : num(t.d1);
      const valorMan = j.valor + dia;
      const esperado = Math.round(valorMan * (1 + normal) / 1e4) * 1e4;
      // prisa: empezar la jornada en negativo si no se vende antes de la próxima oferta, o que esté de baja
      const jornadaAntes = M.proxima && (!M.cierreMercado || M.proxima.ini < M.cierreMercado);
      const prisa = (num(D.dinero) < 0 && jornadaAntes) ? 'negativo' : MALOS.has(j.estado) ? 'baja' : null;
      liga = { posicion: mejor.sobre < OL.p25 ? 'baja' : mejor.sobre > OL.p75 ? 'alta' : 'normal', normal, p25: OL.p25, p75: OL.p75, med: OL.med, dia, esperado, gana: esperado - mejor.importe, prisa };
    }
    if (!mejor) { consejo = 'sin ofertas'; porque = 'Aún no tienes ofertas.'; }
    else if (liga && liga.posicion === 'baja' && !liga.prisa && liga.gana >= Math.max(150000, j.valor * 0.01)) {
      consejo = 'esperar';
      porque = `La de LaLiga es de las más bajas que da (${pct(mejor.sobre * 100)} sobre su valor; en tu liga suele ofrecer entre ${pct(liga.p25 * 100)} y ${pct(liga.p75 * 100)}). Mañana te hará otra: ${liga.dia < 0 ? `aunque baje ${eur(-liga.dia)}, ` : ''}lo normal sería unos ${eur(liga.esperado)} (${eur(liga.gana, { signo: true })}). Espera, salvo que necesites el dinero hoy.`;
    }
    else if (mejor.sobre >= 0.02) { consejo = 'aceptar'; porque = `Te pagan un ${Math.round(mejor.sobre * 100)} % más de lo que vale.`; }
    // la inercia manda: si ha girado, cada día vale menos; si se está frenando, no se espera a que gire
    else if (ine && (ine.fase === 'giro' || ine.fase === 'baja') && mejor.sobre >= -0.05) { consejo = 'aceptar'; porque = `Ha girado a la baja (hoy ${eur(ine.ult, { signo: true })}): cada día que esperes vale menos, y la oferta casi iguala su valor.`; }
    else if (ine && (ine.fase === 'frena' || ine.fase === 'parado') && mejor.sobre >= -0.02) { consejo = 'aceptar'; porque = ine.fase === 'parado' ? 'Ya ha dejado de subir: lo normal es que ahora baje. No esperes.' : `Sube cada vez menos y gira en unos ${Math.max(1, Math.round(ine.giroEn))} días: no esperes a que baje.`; }
    else if (bajando && mejor.sobre >= -0.04) { consejo = 'aceptar'; porque = `Está bajando${t.p7 != null ? ` (${pct(t.p7)} en 7 días)` : ''} y la oferta casi iguala su valor.`; }
    else if (MALOS.has(j.estado) && mejor.sobre >= -0.1) { consejo = 'aceptar'; porque = 'Está lesionado o sancionado: mejor venderlo ya.'; }
    else if (subiendo) { consejo = 'esperar'; porque = 'Está subiendo: mañana puede llegar una oferta mejor.'; }
    else { consejo = 'esperar'; porque = `La oferta se queda un ${Math.round(Math.abs(mejor.sobre) * 100)} % por debajo de lo que vale.`; }
    const deLiga = ofertas.some((o) => o.deLiga);
    return { ...v, j, tend: t, compra, ofertas, mejor, consejo, porque, liga, ganado: mejor && compra ? mejor.importe - compra : null, ligaEst: deLiga ? null : M.ofertaLigaDe(j) };
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
  M.actividad = (D.actividad || []).map((a0) => {
    const a = marcarCz(a0);
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
    // su dinero (exacto o estimado) y cuáles de tus cláusulas le llegan
    const dinero = M.dineroDe(e.teamId), cap = M.capacidad(e.teamId);
    const leLlegan = M.mias.filter((x) => x.clausula && (x.abierta || x.abreEn < 3 * DIA) && x.pagan && [...x.pagan.seguro, ...x.pagan.quiza].some((y) => y.tid === e.teamId));
    const leLleganYa = leLlegan.filter((x) => x.abierta);
    const amenaza = clamp(clausulazos * 22 + contraMi * 25 + sem.filter((a) => suyo(a) && a.clase === 'compra').length * 6 + gastado / 2e6 + leLleganYa.length * 10, 0, 100);
    const paga = M.pujasLiga && M.pujasLiga.porEquipo ? M.pujasLiga.porEquipo[e.teamId] || null : null;
    return {
      e, serie, fichas, dinero, cap, leLlegan, leLleganYa, paga, flujo: flujos[e.teamId] || null,
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
      // para revender tiene que seguir subiendo hasta el día de vender: fuera lo que se frena o ya ha girado
      const ine = M.inercia(j.id);
      if (ine && (['giro', 'baja', 'parado'].includes(ine.fase) || (ine.fase === 'frena' && ine.giroEn != null && ine.giroEn < M.ventanaEsp.ciclos + 1))) return;
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

  const abiertas = M.clausulas.filter((x) => x.abierta && x.meLlega && x.interes >= 50 && !MALOS.has(x.j.estado)
    && M.sobrecoste(x.j, x.clausula, x.tend).indice <= M.tolerancia(x.j) - 30
    && (M.mejora(x.j) >= 0.5 || (x.ratio != null && x.ratio <= 1.05)))
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

  M.mias.filter((x) => x.riesgo === 'alto' && x.importa && !(x.blindaje && (x.blindaje.caro || x.blindaje.yaVale)) && !(x.pagan && x.pagan.hayDatos && !x.pagan.seguro.length && !x.pagan.quiza.length))
    .sort((a, b) => b.pierde - a.pierde).slice(0, 2).forEach((x, k) => {
      const cerca = x.ratio < 1.05 ? `está en su valor (${eur(x.j.valor)})` : `solo pasa un ${pct((x.ratio - 1) * 100, 0)} de su valor (${eur(x.j.valor)})`;
      const quien = x.pagan && (x.pagan.seguro.length || x.pagan.quiza.length) ? ` Le llega a ${[...x.pagan.seguro, ...x.pagan.quiza].slice(0, 3).map((y) => y.nombre).join(', ')}${x.pagan.seguro.length + x.pagan.quiza.length > 3 ? ' y más' : ''}.` : '';
      const justo = x.blindaje && !x.blindaje.yaVale ? ` Subirla a ${eur(x.blindaje.objetivo)} te cuesta ${eur(x.blindaje.coste)}.` : '';
      add({
        tipo: 'blindar', prio: 80 - k * 2, icono: 'escudo', pid: x.pid, cuando: x.abierta ? 'Ahora' : cuando(x.protegidoHasta),
        titulo: `Protege a ${x.j.nombre}`,
        texto: `${x.abierta ? 'Cláusula abierta' : `Se abre en ${dura(x.abreEn)}`}: ${eur(x.clausula)}, que ${cerca}, y te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada.${quien}${justo}`,
      });
    });

  // la inercia: lo que ha girado a la baja se vende ya; lo que está a punto de girar, antes de que gire
  // (los que ya están en venta no: ahí manda la oferta que tengan, en «Tus jugadores en venta»)
  M.mias.filter((x) => x.ventaInercia && !MALOS.has(x.j.estado) && !M.enVenta.has(x.pid)).sort((a, b) => b.ventaInercia.perder - a.ventaInercia.perder).slice(0, 3).forEach((x, k) => {
    const vi = x.ventaInercia, pierde = M.perdida(x.pid);
    add({
      tipo: 'vender', prio: (vi.urgencia === 'ya' ? 86 : 68) - k, icono: 'hucha', pid: x.pid, cuando: vi.urgencia === 'ya' ? 'Hoy' : 'Antes de que gire',
      titulo: vi.urgencia === 'ya' ? `Vende a ${x.j.nombre}: ha girado a la baja` : `Vende a ${x.j.nombre} antes de que gire`,
      texto: `${vi.texto}${pierde >= 0.3 ? ` Es titular en tu once (${String(Math.round(pierde * 10) / 10).replace('.', ',')} pts por jornada): busca quién lo sustituya.` : ' No es imprescindible en tu once.'}${x.compra ? ` Lo pagaste a ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}).` : ''}`,
    });
  });

  // los importantes que están a tiro pero cuyo blindaje no compensa: para que lo sepas, sin urgencias
  M.mias.filter((x) => x.riesgo === 'alto' && x.importa && x.blindaje && x.blindaje.caro && x.abierta).sort((a, b) => b.pierde - a.pierde).slice(0, 2).forEach((x) => add({
    tipo: 'riesgo', prio: 58, icono: 'escudo', pid: x.pid, cuando: 'Ojo',
    titulo: `${x.j.nombre} está a tiro de ${x.pagan.seguro.length + x.pagan.quiza.length} rivales`,
    texto: `Cláusula ${eur(x.clausula)} (vale ${eur(x.j.valor)}). Blindarlo del todo costaría ${eur(x.blindaje.coste)}: no compensa. Si te lo quitan, cobras la cláusula; ten pensado su sustituto (te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada).`,
  }));

  M.mias.filter((x) => MALOS.has(x.j.estado)).slice(0, 2).forEach((x) => add({
    tipo: 'vender', prio: 60, icono: 'lesion', pid: x.pid, cuando: 'Esta semana',
    titulo: `${x.j.nombre}: ${x.j.estado === 'injured' ? 'lesionado' : x.j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga'}`,
    texto: `No te va a puntuar${x.tend.p7 != null && x.tend.p7 < 0 ? ` y baja ${pct(Math.abs(x.tend.p7), 1, false)} en 7 días` : ''}. Plantéate venderlo antes de que pierda más valor.`,
  }));

  M.mias.filter((x) => !x.ventaInercia && x.ganado > 0 && x.tend.p7 != null && x.tend.p7 < -3 && !MALOS.has(x.j.estado)).slice(0, 2).forEach((x) => add({
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

  // 1b. la inercia: lo que ha girado a la baja, fuera ya; lo que está a punto de girar, si no es clave en el once
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.ventaInercia && y.j.pos !== 5 && !M.enVenta.has(y.pid))) {
    const vi = x.ventaInercia;
    if (vi.urgencia !== 'ya' && M.perdida(x.pid) >= 1.5) continue;
    op({ accion: 'vender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `${vi.texto}${M.perdida(x.pid) >= 0.3 ? ` Te quita unos ${String(Math.round(M.perdida(x.pid) * 10) / 10).replace('.', ',')} pts por jornada: ficha a quien lo sustituya.` : ''}`, confianza: vi.urgencia === 'ya' ? 'alta' : 'media' });
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
  const abiertas = M.clausulas.filter((x) => x.abierta && x.interes >= 55 && !MALOS.has(x.j.estado) && M.sobrecoste(x.j, x.clausula, x.tend).indice <= M.tolerancia(x.j) - 30).slice(0, 8);
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
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.riesgo === 'alto' && y.importa && !(y.blindaje && (y.blindaje.caro || y.blindaje.yaVale))).sort((a, b) => b.pierde - a.pierde).slice(0, 2)) {
    const b = x.blindaje;
    op({ accion: 'blindar', pid: x.pid, jugador: x.j.nombre, donde: b ? `subir su cláusula a ${eur(b.objetivo)}` : 'subir su cláusula', importe: b ? b.coste : null, cuando: x.abierta ? 'ahora' : `antes de ${cuando(x.protegidoHasta)}`,
      motivo: `Su cláusula (${eur(x.clausula)}) ${x.ratio < 1.05 ? 'está en su valor' : `solo pasa un ${pct((x.ratio - 1) * 100, 0)} de su valor`} (${eur(x.j.valor)}), ${x.abierta ? 'ya está abierta' : `se abre en ${dura(x.abreEn)}`} y te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada.${b ? ` Con ${eur(b.coste)} no le llegaría a ningún rival.` : ''}` });
    if (b) saldo -= b.coste;
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
