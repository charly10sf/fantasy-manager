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

export function analizar(D, H, c) {
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

  /* ---------- tendencias de valor ---------- */
  const cacheT = {};
  M.tend = (pid) => {
    if (cacheT[pid]) return cacheT[pid];
    const s = (H.v && H.v[pid]) || [];
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

  /* ---------- cuánto interesa un jugador (0 a 100) ---------- */
  const misFichasRaw = (D.plantillas || {})[yoTid] || [];
  const cuantosPorPos = {};
  for (const f of misFichasRaw) { const p = J(f.pid).pos; cuantosPorPos[p] = (cuantosPorPos[p] || 0) + 1; }
  const minimo = { 1: 2, 2: 5, 3: 5, 4: 3 };
  M.interes = (j, precio, t = M.tend(j.id)) => {
    const partes = [];
    const rend = clamp(num(j.media) / 7, 0, 1.3) * 40;
    if (j.media) partes.push(`${String(Math.round(j.media * 10) / 10).replace('.', ',')} pts de media`);
    const mov = t.p7 != null ? t.p7 : t.p1 != null ? t.p1 * 3 : 0;
    const momentum = clamp(mov / 10, -1, 1) * 15;
    if (t.p7 != null && Math.abs(t.p7) >= 2) partes.push(`${t.p7 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p7), 1, false)} en 7 días`);
    else if (t.p1 != null && Math.abs(t.p1) >= 1) partes.push(`${t.p1 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p1), 1, false)} hoy`);
    const ratio = j.valor ? precio / j.valor : 2;
    const barato = clamp((1.6 - ratio) / 0.6, 0, 1) * 25;
    if (ratio <= 1.05) partes.push('cuesta lo que vale');
    else if (ratio < 1.35) partes.push(`cuesta un ${Math.round((ratio - 1) * 100)} % más de lo que vale`);
    let pen = 0;
    if (MALOS.has(j.estado)) { pen = j.estado === 'out_of_league' ? 80 : 35; partes.push(j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga'); }
    else if (j.estado === 'doubtful') { pen = 12; partes.push('es duda'); }
    const falta = j.pos && minimo[j.pos] && (cuantosPorPos[j.pos] || 0) < minimo[j.pos] ? 8 : 0;
    if (falta) partes.push(`te faltan ${POS[j.pos] === 'POR' ? 'porteros' : POS[j.pos] === 'DEF' ? 'defensas' : POS[j.pos] === 'MED' ? 'medios' : 'delanteros'}`);
    return { n: Math.round(clamp(rend + momentum + barato + 10 - pen + falta, 0, 100)), por: partes };
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
      if (!f.clausula) continue;
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
  M.mercado = (D.mercado || []).map((m) => {
    const j = J(m.pid), t = M.tend(m.pid);
    const i = M.interes(j, m.precio, t);
    const sobre = j.valor ? m.precio / j.valor - 1 : 0;
    let veredicto = 'normal';
    if (MALOS.has(j.estado)) veredicto = 'evitar';
    else if (sobre <= 0.02 && ((t.p7 != null && t.p7 > 2) || (t.p1 != null && t.p1 > 0.8) || num(j.media) >= 5)) veredicto = 'chollo';
    else if (t.p1 != null && t.p1 > 1) veredicto = 'sube';
    else if (sobre > 0.15) veredicto = 'caro';
    else if (t.p7 != null && t.p7 < -4) veredicto = 'baja';
    return { ...m, j, tend: t, sobre, interes: i.n, por: i.por, veredicto, meLlega: m.precio <= M.pujaMax, prox: M.proximoPartido(j.equipoId), dueno: M.dueno[m.pid] || null };
  }).sort((a, b) => b.interes - a.interes);
  M.cierreMercado = Math.min(...M.mercado.map((m) => m.cierra || Infinity).filter((x) => x > ahora), Infinity);
  if (!Number.isFinite(M.cierreMercado)) M.cierreMercado = null;

  /* ---------- quién sube y quién baja en toda LaLiga ---------- */
  const todos = Object.values(D.maestro).filter((j) => j && j.valor && j.pos && j.pos < 5);
  const conT = todos.map((j) => ({ j, t: M.tend(j.id), dueno: M.dueno[j.id] || null })).filter((x) => x.t.d1 != null || x.t.d7 != null);
  const clave = (x) => (x.t.d1 != null ? x.t.d1 : x.t.d7 / 7);
  M.suben = [...conT].sort((a, b) => clave(b) - clave(a)).slice(0, 40);
  M.bajan = [...conT].sort((a, b) => clave(a) - clave(b)).slice(0, 40);
  M.libresBuenos = todos.filter((j) => !M.dueno[j.id]).map((j) => ({ j, t: M.tend(j.id), i: M.interes(j, j.valor) })).sort((a, b) => b.i.n - a.i.n).slice(0, 30);

  /* ---------- actividad de la liga, con nombres ---------- */
  M.actividad = (D.actividad || []).map((a) => {
    const quienT = M.teamDeManager(a.quien), otroT = M.teamDeManager(a.otro);
    return { ...a, quienT, otroT, nombreJ: a.jugador || (a.pid && D.maestro[a.pid] ? D.maestro[a.pid].nombre : ''), esYo: quienT === yoTid, contraMi: otroT === yoTid };
  });
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
    const mio = (D.yo && D.yo.userId && a.quienId === D.yo.userId) || misNombres.has(norm(a.quien));
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
