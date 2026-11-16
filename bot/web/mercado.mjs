// El mercado de hoy en la web (/mercado/), los 20 equipos (/equipos/) y lo que lee la portada (mercado/hoy.json). Los datos son los
// mismos que usa el bot para el tuit de mercado de cada noche (tipos/mercado.mjs): la lista de jugadores y el histórico de valor de cada
// uno, de la API de LaLiga Fantasy sin token. Nada de la liga de nadie. El texto sale de reglas sobre los datos, sin IA.
import { enParalelo } from '../lib/http.mjs';
import { corto } from '../lib/texto.mjs';
import { equiposDe } from '../lib/laliga.mjs';
import { chollo } from '../tipos/mercado.mjs';
import { fechaHora, fecha, diaCorto, hora } from './vista.mjs';
import { e, coma, dinero, dif, pct, cara, escudo, cambio, minigrafica, bloque, diaMadrid, fechaCorta, POS, celdaJug, tabla, kpis, subnav, pestanas } from './portal.mjs';

const HORA = 36e5, DIA = 24 * HORA;
const num = (x) => Number(x) || 0;
const serieDe = (h) => (Array.isArray(h) ? h : []).map((v) => ({ t: Date.parse(v.date), v: num(v.marketValue) })).filter((x) => x.t && x.v > 0).sort((a, b) => a.t - b.t);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaDia = (d) => { const [, m, dd] = d.split('-').map(Number); return `${dd} de ${MESES[m - 1]}`; };

/** la jornada que viene (o la que se juega) con sus partidos y su cierre de cláusulas */
export async function proximaJornada(api) {
  const sem = await api.semanaActual();
  let J = sem.weekNumber, st = await api.statsSemana(J);
  const empezada = st.some((m) => m.matchState !== 1);
  const acabada = st.length && st.every((m) => m.matchState === 7);
  if (acabada) { J = sem.nextWeek; st = await api.statsSemana(J); }
  if (!st.length) return null;
  const eq = equiposDe(st);
  const esc = {};
  for (const m of st) for (const l of [m.local, m.visitor]) esc[String(l.id)] = l.badgeColor;
  const ps = [...st].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).map((m) => ({ t: Date.parse(m.date), local: corto(eq[String(m.local.id)]), visitante: corto(eq[String(m.visitor.id)]),
    escL: esc[String(m.local.id)], escV: esc[String(m.visitor.id)], estado: m.matchState, gl: m.localScore, gv: m.visitorScore }));
  const primero = ps[0].t;
  return { jornada: J, primero, ultimo: ps[ps.length - 1].t, cierre: primero - 24 * HORA, enJuego: empezada && !acabada, partidos: ps };
}

/**
 * Los hechos del mercado de hoy. api: { jugadores, valorMercado, statsSemana, semanaActual }. Devuelve null si aún no ha llegado
 * el valor de hoy (con `exigirHoy`) o si faltan datos.
 */
export async function hechosMercado(api, { ahora = Date.now(), exigirHoy = true, log = () => {} } = {}) {
  const todos = await api.jugadores();
  const lista0 = todos.filter((j) => num(j.marketValue) > 0 && j.playerStatus !== 'out_of_league');
  const centinela = [...lista0].sort((a, b) => num(b.marketValue) - num(a.marketValue))[0];
  const hc = serieDe(await api.valorMercado(centinela.id));
  const dia = hc.length ? diaMadrid(hc[hc.length - 1].t) : null;
  if (exigirHoy && dia !== diaMadrid(ahora)) { log(`  (portal) el último valor es del ${dia}: aún no ha llegado el de hoy`); return null; }
  const sem = await api.semanaActual();
  // nombres y escudos de los 20: de la jornada actual (y de la siguiente por si falta alguno)
  const st = [...await api.statsSemana(sem.weekNumber), ...await api.statsSemana(sem.nextWeek).catch(() => [])];
  const eqNombre = equiposDe(st), eqEscudo = {};
  for (const m of st) for (const l of [m.local, m.visitor]) eqEscudo[String(l.id)] = l.badgeColor;
  log(`  (portal) valores del ${dia}: histórico de ${lista0.length} jugadores`);
  const hist = await enParalelo(lista0, 25, (j) => api.valorMercado(j.id).catch(() => null));
  const filas = [];
  lista0.forEach((j, i) => {
    const s = serieDe(hist[i]);
    if (s.length < 2 || diaMadrid(s[s.length - 1].t) !== dia) return;
    const v = s[s.length - 1].v, a = s[s.length - 2].v, h7 = s[Math.max(0, s.length - 8)].v;
    const signo = Math.sign(v - a);
    let racha = 0;
    for (let k = s.length - 1; signo && k >= 1 && Math.sign(s[k].v - s[k - 1].v) === signo; k--) racha++;
    const desde = s[s.length - 1 - racha];
    const temp = s.filter((x) => x.t >= Date.parse('2026-08-01'));
    filas.push({ id: String(j.id), nombre: j.nickname, pos: Number(j.positionId), teamId: String(j.teamId), equipo: corto(eqNombre[String(j.teamId)] || '?'),
      caraUrl: j.image || null, escudoUrl: eqEscudo[String(j.teamId)] || null, estado: j.playerStatus || 'ok', ok: !j.playerStatus || j.playerStatus === 'ok',
      media: num(j.averagePoints), puntos: num(j.points), nuevo: v, valor: v, antes: a, dif: v - a, pct: ((v - a) / a) * 100,
      dif7: v - h7, pct7: ((v - h7) / h7) * 100, racha: signo * racha, rachaDif: v - desde.v, rachaDesde: desde.t,
      max: Math.max(...temp.map((x) => x.v), v), min: Math.min(...temp.map((x) => x.v), v),
      serie: s.slice(-30).map((x) => x.v), temporada: temp });
  });
  if (filas.length < 100) { log(`  (portal) solo ${filas.length} jugadores con el valor de ${dia}`); return null; }
  const ord = (k, s, f = () => true) => filas.filter(f).sort((x, y) => s * (y[k] - x[k]));
  const suben = ord('dif', 1, (f) => f.dif > 0), bajan = ord('dif', -1, (f) => f.dif < 0);
  const suben7 = ord('dif7', 1, (f) => f.dif7 > 0), bajan7 = ord('dif7', -1, (f) => f.dif7 < 0);
  // rachas: por lo que llevan ganado (o perdido) en ella, no por los días (si no, salen suplentes que suben 5 mil al día desde julio)
  const rachaSube = filas.filter((f) => f.racha >= 3).sort((x, y) => y.rachaDif - x.rachaDif);
  const rachaBaja = filas.filter((f) => f.racha <= -3).sort((x, y) => x.rachaDif - y.rachaDif);
  // en máximos: los que hoy marcan su valor más alto de la temporada (y valen algo)
  const maximos = filas.filter((f) => f.dif > 0 && f.nuevo >= f.max && f.nuevo >= 2e6).sort((x, y) => y.dif - x.dif);
  // por equipo: lo que vale la plantilla y lo que ha ganado o perdido hoy y en 7 días
  const eqs = {};
  for (const f of filas) {
    const q = eqs[f.teamId] || (eqs[f.teamId] = { id: f.teamId, nombre: f.equipo, club: eqNombre[f.teamId] || f.equipo, escudoUrl: f.escudoUrl, valor: 0, dif: 0, dif7: 0, n: 0, suben: 0, bajan: 0, top: null, media: null });
    q.valor += f.nuevo; q.dif += f.dif; q.dif7 += f.dif7; q.n++;
    if (f.dif > 0) q.suben++; if (f.dif < 0) q.bajan++;
    if (!q.top || f.nuevo > q.top.nuevo) q.top = f;
    if (f.puntos >= 20 && (!q.media || f.media > q.media.media)) q.media = f;
  }
  const equipos = Object.values(eqs).filter((q) => q.n >= 10).sort((x, y) => y.valor - x.valor);
  const prox = await proximaJornada(api).catch(() => null);
  return {
    dia, generada: ahora, jugadores: filas.length, nSuben: suben.length, nBajan: bajan.length, nIgual: filas.length - suben.length - bajan.length,
    movido: filas.reduce((s, f) => s + f.dif, 0), valorTotal: filas.reduce((s, f) => s + f.nuevo, 0),
    suben: suben.slice(0, 10), bajan: bajan.slice(0, 10), suben7: suben7.slice(0, 10), bajan7: bajan7.slice(0, 10),
    rachaSube: rachaSube.slice(0, 8), rachaBaja: rachaBaja.slice(0, 6), nRachaSube: rachaSube.length, maximos: maximos.slice(0, 6), nMaximos: maximos.length,
    chollo: chollo(suben), equipos, proxima: prox, todas: filas, eqNombre, eqEscudo,
  };
}

// ---------------------------------------------------------------- el HTML (fase 2b: cifras arriba, tablas con pestañas, el texto abajo)

/** el texto de análisis: lo que ha pasado hoy, en dos o tres frases con las cifras de las tablas */
function lectura(h) {
  const s = h.suben[0], b = h.bajan[0];
  const o = [];
  o.push(`LaLiga ha actualizado los valores de mercado del ${fechaDia(h.dia)}: de ${h.jugadores} jugadores, suben ${h.nSuben}${h.nIgual ? `, bajan ${h.nBajan} y ${h.nIgual} se quedan igual` : ` y bajan ${h.nBajan}`}. Entre todos, el mercado ${h.movido >= 0 ? 'gana' : 'pierde'} ${dinero(Math.abs(h.movido))} en un día.`);
  if (s) o.push(`El que más sube es ${s.nombre} (${s.equipo}): ${dif(s.dif)}, un ${pct(s.pct)}, hasta ${dinero(s.nuevo)}${s.racha >= 3 ? `, y ya lleva ${s.racha} días seguidos subiendo` : ''}.`);
  if (b) o.push(`En el otro lado, ${b.nombre} (${b.equipo}) pierde ${dinero(-b.dif)} y se queda en ${dinero(b.nuevo)}${b.racha <= -3 ? ` tras ${-b.racha} días seguidos bajando` : ''}.`);
  return o;
}

/** las rutas de las fichas (fase 2): { jugador(id), equipo(teamId) } desde la raíz de la web, o null si no hay página */
const SIN = { jugador: () => null, equipo: () => null };
const en = (r) => (r ? `../${r}` : null);
/** una cifra con su línea pequeña debajo, a la derecha (para tablas estrechas en el móvil) */
const dosL = (arriba, abajo) => `<span class="dos-l">${arriba}<small>${abajo}</small></span>`;

// (sesión 4, idea 4) quién sube y quién baja mañana: la probabilidad de seguir de cada jugador en racha, con nuestras cifras de la
// temporada (guía de valor de mercado, 52.302 cambios): tras 3 días subiendo sigue el 87,3 %, tras 4 el 92,2 %; si la subida de hoy
// es menos de la mitad que la de ayer, el 61,9 %, y si es mayor, el 98,2 %; tras 3 días bajando, el 88,4 %. Solo rachas de 3 o más.
export const PROB = { sube3: 87.3, sube4: 92.2, frena: 61.9, acelera: 98.2, baja3: 88.4 };
const N_PREV = 40;
/** la previsión de mañana: { dia, suben: [{ id, p, por }], bajan: [...] } (las 40 más probables de cada lado) */
export function prevision(h) {
  const conAyer = (f) => (f.serie && f.serie.length >= 3 ? f.serie[f.serie.length - 2] - f.serie[f.serie.length - 3] : null);
  const suben = h.todas.filter((f) => f.racha >= 3 && f.pos >= 1 && f.pos <= 4).map((f) => {
    const ay = conAyer(f);
    const [p, por] = ay > 0 && f.dif > ay ? [PROB.acelera, 'acelera'] : ay > 0 && f.dif < ay / 2 ? [PROB.frena, 'frena'] : f.racha >= 4 ? [PROB.sube4, `${f.racha} días`] : [PROB.sube3, '3 días'];
    return { id: f.id, p, por };
  }).sort((a, b) => b.p - a.p || (h.todas.find((f) => f.id === b.id).dif - h.todas.find((f) => f.id === a.id).dif)).slice(0, N_PREV);
  const bajan = h.todas.filter((f) => f.racha <= -3 && f.pos >= 1 && f.pos <= 4).map((f) => ({ id: f.id, p: PROB.baja3, por: `${-f.racha} días` }))
    .sort((a, b) => h.todas.find((f) => f.id === a.id).dif - h.todas.find((f) => f.id === b.id).dif).slice(0, N_PREV);
  return { dia: h.dia, suben, bajan };
}
/** cuántas de las previstas ayer se cumplieron hoy: { dia, sN, sOk, bN, bOk } (null si la previsión no es de la víspera) */
export function acierto(prev, h) {
  if (!prev || !prev.dia || prev.dia >= h.dia) return null;
  const dif = new Map(h.todas.map((f) => [f.id, f.dif]));
  const ok = (xs, signo) => xs.filter((x) => dif.has(x.id) && Math.sign(dif.get(x.id)) === signo).length;
  const vale = (xs) => xs.filter((x) => dif.has(x.id));
  return { dia: h.dia, de: prev.dia, sN: vale(prev.suben).length, sOk: ok(prev.suben, 1), bN: vale(prev.bajan).length, bOk: ok(prev.bajan, -1) };
}
const pctA = (a, b) => (b ? Math.round((a / b) * 100) : 0);
/** el bloque de arriba de /mercado/: mañana, con el acierto de ayer y el acumulado */
function bloqueManana(h, cj, { prev, aciertos = [] }) {
  const fila = new Map(h.todas.map((f) => [f.id, f]));
  const t = (xs) => (xs.length ? tabla([{ t: 'Jugador', c: 'j' }, { t: 'Sigue', c: 'n' }, { t: 'Racha', c: 'n m' }], xs.slice(0, 10).map((x) => {
    const f = fila.get(x.id);
    return `${cj(f)}<td class="n"><b>${e(coma(x.p))} %</b></td><td class="n m">${dosL(e(x.por), e(dif(f.rachaDif)))}</td>`;
  })) : '');
  const ay = aciertos[aciertos.length - 1];
  const ult = aciertos.filter((a) => a.sN + a.bN > 0).slice(-30);
  const tot = ult.reduce((s, a) => s + a.sN + a.bN, 0), okT = ult.reduce((s, a) => s + a.sOk + a.bOk, 0);
  const fr = [];
  if (ay && ay.dia === h.dia && ay.sN + ay.bN) fr.push(`Ayer dimos ${ay.sN} subidas y ${ay.bN} bajadas para hoy: subieron ${ay.sOk} y bajaron ${ay.bOk} (${pctA(ay.sOk + ay.bOk, ay.sN + ay.bN)} % de acierto).`);
  if (ult.length >= 3) fr.push(`En los últimos ${ult.length} cambios de mercado, ${pctA(okT, tot)} % de acierto (${okT} de ${tot}).`);
  if (!fr.length) fr.push('La previsión se guarda cada noche y al día siguiente se compara con lo que pasó: el acierto sale aquí desde el segundo día.');
  const n1 = h.todas.filter((f) => f.racha >= 3 && f.pos >= 1 && f.pos <= 4).length, n2 = h.todas.filter((f) => f.racha <= -3 && f.pos >= 1 && f.pos <= 4).length;
  const nAc = prev.suben.filter((x) => x.por === 'acelera').length, nFr = prev.suben.filter((x) => x.por === 'frena').length;
  const lead = `${n1} jugadores llevan tres días o más subiendo y ${n2} bajando. Con lo que ha pasado esta temporada en rachas así, esta es la probabilidad de que mañana sigan igual${nAc || nFr ? `: entre los ${prev.suben.length} de arriba, ${nAc} han acelerado hoy y ${nFr} han frenado` : ''}. La previsión guarda los ${N_PREV} más probables de cada lado.`;
  return bloque('Mañana: quién sube y quién baja', `  <p>${e(lead)}</p>\n${pestanas('manana', [['Suben', t(prev.suben)], ['Bajan', t(prev.bajan)]])}\n  <p>${e(fr.join(' '))}</p>`,
    { id: 'manana', linea: `«Frena»: hoy subió menos de la mitad que ayer; «acelera»: más que ayer. De dónde sale cada porcentaje, en <a href="../guias/valor-de-mercado.html">valor de mercado</a>. Es una tendencia, no una garantía.` });
}

export function contenidoMercado(h, { previa = null, resumen = null, rutas = SIN, prev = null, aciertos = [] } = {}) {
  const cj = (f, sub) => celdaJug(f, { enlace: en(rutas.jugador(f.id)), sub });
  const o = [];
  o.push(`  <h1>Mercado de <span>LaLiga Fantasy</span> hoy</h1>`);
  o.push(`  <p class="fresco">Valores del ${e(fechaDia(h.dia))} · tras el cambio de mercado de las 00:15 · se rehace cada noche</p>`);
  o.push(kpis([
    { v: String(h.nSuben), l: 'Suben', s: 'hoy' },
    { v: String(h.nBajan), l: 'Bajan', s: 'hoy' },
    { v: String(h.nRachaSube), l: 'En racha', s: '3 días o más subiendo' },
    { v: String(h.nMaximos), l: 'En máximos', s: 'de la temporada' },
  ], 'k4'));
  if (h.proxima) o.push(proximaCaja(h.proxima, { previa, resumen }));
  const ch = h.chollo;
  if (prev && (prev.suben.length || prev.bajan.length)) o.push(bloqueManana(h, cj, { prev, aciertos }));
  o.push(subnav([prev && ['manana', 'Mañana'], ['hoy', 'Hoy'], ['semana', '7 días'], ['rachas', 'Rachas'], h.maximos.length && ['maximos', 'Máximos'], ch && ['chollo', 'Chollo'], ['equipos', 'Equipos'], ['analisis', 'Análisis']]));

  // hoy: los diez que más suben y bajan, con su minigráfica de 30 días
  const tHoy = (xs) => (xs.length ? tabla([{ t: '#', c: 'n m' }, { t: 'Jugador', c: 'j' }, { t: 'Hoy', c: 'n' }, { t: '30 días', c: 'd' }], xs.map((f, i) => `<td class="n m">${i + 1}</td>${cj(f)}`
    + `<td class="n">${dosL(cambio(f.dif, dif(f.dif)), `${e(pct(f.pct))} · ${e(dinero(f.nuevo))}`)}</td><td class="d">${minigrafica(f.serie, { ancho: 72, alto: 26, etiqueta: `${f.nombre}, valor en los últimos ${f.serie.length} días: de ${dinero(f.serie[0])} a ${dinero(f.nuevo)}` })}</td>`), { clase: 'td-merc' }) : '');
  o.push(bloque('Los que más suben y bajan hoy', pestanas('hoy', [['Suben', tHoy(h.suben)], ['Bajan', tHoy(h.bajan)]]),
    { id: 'hoy', linea: 'Lo ganado o perdido en el último cambio de mercado, en millones y en porcentaje, el valor de hoy y la línea de los últimos 30 días.' }));

  const t7 = (xs) => (xs.length ? tabla([{ t: '#', c: 'n m' }, { t: 'Jugador', c: 'j' }, { t: '7 días', c: 'n' }, { t: 'Valor', c: 'n m' }], xs.map((f, i) => `<td class="n m">${i + 1}</td>${cj(f)}`
    + `<td class="n">${dosL(cambio(f.dif7, dif(f.dif7)), e(pct(f.pct7)))}</td><td class="n m">${e(dinero(f.nuevo))}</td>`)) : '');
  o.push(bloque('La semana: más suben y más bajan en 7 días', pestanas('semana', [['Suben', t7(h.suben7)], ['Bajan', t7(h.bajan7)]]),
    { id: 'semana', linea: 'Valor de hoy frente al de hace siete cambios de mercado.' }));

  // rachas: lo que dicen los datos de la temporada (guía de valor de mercado, .github/datos-guias)
  const tR = (xs, signo) => (xs.length ? tabla([{ t: 'Jugador', c: 'j' }, { t: 'En la racha', c: 'n' }, { t: 'Valor', c: 'n m' }], xs.map((f) => cj(f)
    + `<td class="n">${dosL(`<b class="racha${signo < 0 ? ' baja-t' : ''}">${e(dif(f.rachaDif))}</b>`, `${signo * f.racha} días, desde el ${e(fechaCorta(f.rachaDesde))}`)}</td><td class="n m">${e(dinero(f.nuevo))}</td>`)) : '');
  o.push(bloque('Rachas', pestanas('rachas', [['Al alza', tR(h.rachaSube, 1)], ['A la baja', tR(h.rachaBaja, -1)]]),
    { id: 'rachas', linea: e(`Esta temporada, de los que llevan tres días seguidos subiendo, el 87,3 % sube también el cuarto, y una racha que llega a tres días dura una mediana de ocho; tras tres días bajando, el 88,4 % baja también el cuarto. Hoy hay ${h.nRachaSube} jugadores con tres días o más subiendo; aquí, los que más llevan ganado (o perdido) en su racha.`) + ' <a href="../guias/valor-de-mercado.html">Cómo se mueve el valor</a>.' }));

  if (h.maximos.length) o.push(bloque('En su máximo de la temporada', tabla([{ t: 'Jugador', c: 'j' }, { t: 'Hoy', c: 'n' }, { t: 'Valor', c: 'n' }, { t: 'Mínimo', c: 'n m' }],
    h.maximos.map((f) => cj(f) + `<td class="n">${cambio(f.dif, dif(f.dif))}</td><td class="n">${e(dinero(f.nuevo))}</td><td class="n m">${e(dinero(f.min))}</td>`)),
  { id: 'maximos', linea: `Hoy valen más que nunca desde que empezó la temporada. Comprar arriba es caro: mira cuánto pujar con <a href="../guias/cuanto-pujar.html">la calculadora de puja</a>.` }));

  if (ch) {
    o.push(bloque('Barato, en forma y subiendo', `  <div class="destac">${cara(ch, 'g')}<div><p class="dest-n">${rutas.jugador(ch.id) ? `<a href="${e(en(rutas.jugador(ch.id)))}">${e(ch.nombre)}</a>` : e(ch.nombre)} <small>${e(ch.equipo)} · ${e(POS[ch.pos] || '')}</small></p>`
      + `<p>Vale ${e(dinero(ch.nuevo))}, lleva ${e(coma(ch.media))} puntos de media y ${e(String(ch.puntos))} en la temporada, y hoy sube un ${e(pct(ch.pct))}.</p></div></div>`,
    { id: 'chollo', linea: 'Es el que más puntos de media da por cada millón entre los que suben hoy, valen 8 M o menos y están disponibles.' }));
  }

  const top5 = h.equipos.slice().sort((x, y) => y.dif - x.dif);
  const tE = (xs) => tabla([{ t: 'Equipo', c: 'j' }, { t: 'Hoy', c: 'n' }, { t: 'Plantilla', c: 'n m' }], xs.map((q) => celdaEquipo(q, rutas.equipo(q.id) ? en(rutas.equipo(q.id)) : null, `${q.suben} suben · ${q.bajan} bajan`)
    + `<td class="n">${cambio(q.dif, dif(q.dif))}</td><td class="n m">${e(dinero(q.valor))}</td>`));
  o.push(bloque('Los equipos que más ganan y pierden hoy', pestanas('equipos', [['Ganan', tE(top5.slice(0, 5))], ['Pierden', tE(top5.slice(-5).reverse())]]),
    { id: 'equipos', linea: 'Sumando el cambio de todos sus jugadores. El valor de cada plantilla, en <a href="../equipos/">los 20 equipos</a>.' }));

  o.push(bloque('El mercado de hoy', lectura(h).map((x) => `  <p>${e(x)}</p>`).join('\n'), { id: 'analisis',
    linea: `${e(`Valor de LaLiga Fantasy de los ${h.jugadores} jugadores que siguen en LaLiga.`)} <a href="../metodo.html#valor">Cómo leemos el valor y las rachas</a> · <a href="../jugadores/">todos los jugadores</a>.` }));
  // (sesión 3) sin «De dónde salen los datos» ni «Con Fantasy Manager», iguales cada noche: el método, en metodo.html#valor
  return o.join('\n');
}

/** la celda de un equipo en una tabla: escudo, nombre (enlazado a su ficha si la hay) y una línea debajo */
export const celdaEquipo = (q, enlace, sub = '') => `<td class="c-j"><div class="tjug">${escudo(q.escudoUrl, q.nombre, 28)}<span class="tjug-t"><b>${enlace ? `<a href="${e(enlace)}">${e(q.nombre)}</a>` : e(q.nombre)}</b>${sub ? `<small>${e(sub)}</small>` : ''}</span></div></td>`;

/** la caja de la próxima jornada (mercado y jornada): cuándo empieza, el cierre de cláusulas y la previa, en una franja */
export function proximaCaja(p, { previa = null, resumen = null, raiz = '../', todas = true } = {}) {
  const J = p.jornada;
  const corta = (t) => `${diaCorto(t).split(' ')[0]} ${fechaCorta(t)}, ${hora(t)}`;   // «vie 20 nov, 21:00»
  const linea = p.enJuego ? `<p><b>Se está jugando.</b> Acaba el ${e(fechaHora(p.ultimo))}.</p>`
    : `<p>Empieza: <b>${e(corta(p.primero))}</b>, ${e(p.partidos[0].local)}-${e(p.partidos[0].visitante)}</p><p>Cierre de cláusulas: <b>${e(corta(p.cierre))}</b></p>`;
  const enl = [];
  if (previa) enl.push(`<a href="${raiz}${e(previa)}">Previa de la jornada ${J}</a>`);
  if (resumen) enl.push(`<a href="${raiz}${e(resumen.ruta)}">Resumen de la jornada ${resumen.jornada}</a>`);
  enl.push(`<a href="${raiz}clausulas/">Calendario de cláusulas</a>`);
  enl.push(`<a href="${raiz}bajas/">Bajas de la jornada</a>`);
  if (todas) enl.push(`<a href="${raiz}jornada/">Todas las jornadas</a>`);
  return `  <aside class="prox2"><p class="prox-t">Jornada ${J}</p>${linea}${enl.length ? `<p class="prox-e">${enl.join(' · ')}</p>` : ''}</aside>`;
}

/** /equipos/: los 20, con lo que vale su plantilla y su mejor jugador; cada uno enlaza a su página (bot/web/fichas.mjs) */
export function contenidoEquipos(h, { rutas = SIN, jugadores = null } = {}) {
  const o = [];
  const re = (q) => (rutas.equipo(q.id) ? rutas.equipo(q.id).split('/').pop() : null);
  const jn = (f) => (rutas.jugador(f.id) ? `<a href="${e(en(rutas.jugador(f.id)))}">${e(f.nombre)}</a>` : e(f.nombre));
  const caro = h.equipos[0], barato = h.equipos[h.equipos.length - 1];
  const masGana = [...h.equipos].sort((x, y) => y.dif7 - x.dif7)[0];
  o.push(`  <h1>Equipos de <span>LaLiga Fantasy</span></h1>`);
  o.push(`  <p class="fresco">Valores del ${e(fechaDia(h.dia))} · se rehace cada noche</p>`);
  // los 20 escudos, para ir directo a cada equipo
  const alfa = [...h.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  o.push(`  <nav class="rejilla-eq" aria-label="Los equipos">${alfa.map((q) => `<a href="${e(re(q) || '#valor')}">${escudo(q.escudoUrl, '', 32)}<span>${e(q.nombre)}</span></a>`).join('')}</nav>`);
  const filas = h.equipos.map((q, i) => `<td class="n m">${i + 1}</td>${celdaEquipo(q, re(q), `${i + 1}.º · más caro: ${q.top.nombre}`)}<td class="n">${e(dinero(q.valor))}</td><td class="n m">${cambio(q.dif, dif(q.dif))}</td><td class="n">${cambio(q.dif7, dif(q.dif7))}</td>`
    + `<td class="m">${jn(q.top)} <small>${e(dinero(q.top.nuevo))}</small></td><td class="m">${q.media ? `${jn(q.media)} <small>${e(coma(q.media.media))}</small>` : ''}</td>`);
  o.push(bloque('Valor de cada plantilla', tabla([{ t: '#', c: 'n m' }, { t: 'Equipo', c: 'j' }, { t: 'Plantilla', c: 'n' }, { t: 'Hoy', c: 'n m' }, { t: '7 días', c: 'n' }, { t: 'El que más vale', c: 'm' }, { t: 'Mejor media', c: 'm' }], filas, { clase: 'td-eqs' }),
    { id: 'valor', linea: '«Mejor media»: el de más puntos de media entre los que llevan 20 puntos o más en la temporada.' }));
  o.push(bloque('Las plantillas en LaLiga Fantasy', `  <p>${e(`Lo que vale la plantilla de cada equipo en el mercado de LaLiga Fantasy, sumando a todos sus jugadores. La más cara es la del ${caro.nombre}, ${dinero(caro.valor)}; la más barata, la del ${barato.nombre}, ${dinero(barato.valor)}. En la última semana, la que más ha ganado es la del ${masGana.nombre}: ${dif(masGana.dif7)}.`)}</p>`
    + (jugadores ? `\n  <p>Cada equipo tiene su página con la plantilla, los puntos de cada jornada y los próximos rivales, y los jugadores que más pesan en el juego, la suya: <a href="../jugadores/">todos los jugadores</a>, con los ${jugadores} que tienen ficha enlazados.</p>` : ''), { id: 'analisis', linea: `La plantilla suma a todos los que tiene cada club en el juego, jueguen o no. <a href="../metodo.html#valor">Cómo leemos el valor</a>.` }));
  // (sesión 3) el párrafo de «De dónde salen los datos», en metodo.html#valor
  return o.join('\n');
}

/** lo que lee la portada de la app (web/js/portada.js) para su bloque de «Hoy» */
export function hoyJson(h, { previa = null, resumen = null } = {}) {
  const f = (x) => ({ nombre: x.nombre, equipo: x.equipo, pos: x.pos, cara: x.caraUrl, escudo: x.escudoUrl, dif: dif(x.dif), pct: pct(x.pct), valor: dinero(x.nuevo), sube: x.dif > 0 });
  const p = h.proxima;
  return { dia: h.dia, fecha: fechaDia(h.dia), nSuben: h.nSuben, nBajan: h.nBajan, suben: h.suben.slice(0, 5).map(f), bajan: h.bajan.slice(0, 3).map(f),
    jornada: p ? { n: p.jornada, enJuego: p.enJuego, primero: fechaHora(p.primero), cierre: fechaHora(p.cierre), cierreT: p.cierre, partido: `${p.partidos[0].local}-${p.partidos[0].visitante}` } : null,
    previa, resumen: resumen ? { ruta: resumen.ruta, jornada: resumen.jornada } : null };
}

export { DIA };
