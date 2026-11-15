// El mercado de hoy en la web (/mercado/), los 20 equipos (/equipos/) y lo que lee la portada (mercado/hoy.json). Los datos son los
// mismos que usa el bot para el tuit de mercado de cada noche (tipos/mercado.mjs): la lista de jugadores y el histórico de valor de cada
// uno, de la API de LaLiga Fantasy sin token. Nada de la liga de nadie. El texto sale de reglas sobre los datos, sin IA.
import { enParalelo } from '../lib/http.mjs';
import { corto } from '../lib/texto.mjs';
import { equiposDe } from '../lib/laliga.mjs';
import { chollo } from '../tipos/mercado.mjs';
import { fechaHora, fecha } from './vista.mjs';
import { e, coma, dinero, dif, pct, cara, escudo, cambio, minigrafica, filaJugador, bloque, lista, tarjetas, diaMadrid, fechaCorta, POS } from './portal.mjs';

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

// ---------------------------------------------------------------- el HTML

const derechaDia = (f) => `${cambio(f.dif, dif(f.dif))}<small>${e(pct(f.pct))} · ${e(dinero(f.nuevo))}</small>`;
const derecha7 = (f) => `${cambio(f.dif7, dif(f.dif7))}<small>${e(pct(f.pct7))} · ${e(dinero(f.nuevo))}</small>`;
const conMini = (f, d) => `${minigrafica(f.serie, { etiqueta: `${f.nombre}, valor en los últimos ${f.serie.length} días: de ${dinero(f.serie[0])} a ${dinero(f.nuevo)}` })}<span class="fj-n">${d}</span>`;

/** el texto de arriba: lo que ha pasado hoy, en dos o tres frases con las cifras de la tabla */
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

export function contenidoMercado(h, { previa = null, resumen = null, rutas = SIN } = {}) {
  const fj = (f, d) => filaJugador(f, d, { enlace: en(rutas.jugador(f.id)) });
  const o = [];
  o.push(`  <h1>Mercado de <span>LaLiga Fantasy</span> hoy</h1>`);
  o.push(`  <p class="lead">${e(lectura(h).join(' '))}</p>`);
  o.push(`  <p class="peq">Valores del ${e(fechaDia(h.dia))}, después del cambio de mercado de las 00:15. Esta página se rehace sola cada noche.</p>`);
  o.push(tarjetas([
    `<div class="cifra-c"><b>${h.nSuben}</b><span>suben hoy</span></div>`,
    `<div class="cifra-c"><b>${h.nBajan}</b><span>bajan hoy</span></div>`,
    `<div class="cifra-c"><b>${h.nRachaSube}</b><span>llevan 3 días o más subiendo</span></div>`,
    `<div class="cifra-c"><b>${h.nMaximos}</b><span>en su máximo de la temporada</span></div>`,
  ], 'cifras'));
  if (h.proxima) o.push(proximaCaja(h.proxima, { previa, resumen }));

  o.push(`  <div class="dos dos-bq">${bloque('Los que más suben hoy', lista(h.suben.map((f) => fj(f, conMini(f, derechaDia(f))))),
    { id: 'suben', linea: 'Lo ganado en el último cambio de mercado y su valor de los últimos 30 días.' })}${bloque('Los que más bajan hoy', lista(h.bajan.map((f) => fj(f, conMini(f, derechaDia(f))))),
    { id: 'bajan', linea: 'Lo perdido en el último cambio de mercado y su valor de los últimos 30 días.' })}</div>`);

  const ch = h.chollo;
  if (ch) {
    o.push(bloque('Barato, en forma y subiendo', `  <div class="dest">${cara(ch, 'g')}<div><p class="dest-n">${rutas.jugador(ch.id) ? `<a href="${e(en(rutas.jugador(ch.id)))}">${e(ch.nombre)}</a>` : e(ch.nombre)} <small>${e(ch.equipo)} · ${e(POS[ch.pos] || '')}</small></p>`
      + `<p>Vale ${e(dinero(ch.nuevo))}, lleva ${e(coma(ch.media))} puntos de media y ${e(String(ch.puntos))} en la temporada, y hoy sube un ${e(pct(ch.pct))}. Es el que más puntos de media da por cada millón entre los que suben hoy, valen 8 M o menos y están disponibles.</p></div></div>`,
    { id: 'chollo' }));
  }

  // rachas: lo que dicen los datos de la temporada (guía de valor de mercado, .github/datos-guias)
  const rs = h.rachaSube;
  o.push(bloque('Rachas: los que no paran de subir', lista(rs.map((f) => fj(f, `<span class="fj-n"><b class="racha">${e(dif(f.rachaDif))}</b><small>${f.racha} días, desde el ${e(fechaCorta(f.rachaDesde))}</small></span>`))),
    { id: 'rachas', linea: e(`Esta temporada, de los que llevan tres días seguidos subiendo, el 87,3 % sube también el cuarto, y una racha que llega a tres días dura una mediana de ocho. Hoy hay ${h.nRachaSube} jugadores con tres días o más; aquí, los que más llevan ganado en su racha.`) + ' <a href="../guias/valor-de-mercado.html">Cómo se mueve el valor</a>.' }));
  if (h.rachaBaja.length) o.push(bloque('Rachas a la baja', lista(h.rachaBaja.map((f) => fj(f, `<span class="fj-n"><b class="racha baja-t">${e(dif(f.rachaDif))}</b><small>${-f.racha} días, desde el ${e(fechaCorta(f.rachaDesde))}</small></span>`))),
    { linea: 'Los que más llevan perdido en su racha. Tras tres días bajando, el 88,4 % baja también el cuarto.' }));

  o.push(bloque('La semana: más suben y más bajan en 7 días', `  <div class="dos"><div><h3>Suben</h3>${lista(h.suben7.slice(0, 8).map((f) => fj(f, `<span class="fj-n">${derecha7(f)}</span>`)))}</div><div><h3>Bajan</h3>${lista(h.bajan7.slice(0, 8).map((f) => fj(f, `<span class="fj-n">${derecha7(f)}</span>`)))}</div></div>`,
    { id: 'semana', linea: 'Valor de hoy frente al de hace siete cambios de mercado.' }));

  if (h.maximos.length) o.push(bloque('En su máximo de la temporada', lista(h.maximos.map((f) => fj(f, `<span class="fj-n">${e(dinero(f.nuevo))}<small>mínimo ${e(dinero(f.min))}</small></span>`))),
    { linea: `Hoy valen más que nunca desde que empezó la temporada. Comprar arriba es caro: mira cuánto pujar con <a href="../guias/cuanto-pujar.html">la calculadora de puja</a>.` }));

  const top5 = h.equipos.slice().sort((x, y) => y.dif - x.dif);
  const eqFila = (q) => `<li class="fe">${escudo(q.escudoUrl, q.nombre, 28)}<b>${rutas.equipo(q.id) ? `<a href="${e(en(rutas.equipo(q.id)))}">${e(q.nombre)}</a>` : e(q.nombre)}</b>${cambio(q.dif, dif(q.dif))}</li>`;
  o.push(bloque('Los equipos que más ganan y pierden hoy', `  <div class="dos"><ul class="le">${top5.slice(0, 5).map(eqFila).join('')}</ul><ul class="le">${top5.slice(-5).reverse().map(eqFila).join('')}</ul></div>\n  <p class="peq">Sumando el cambio de todos sus jugadores. El valor de cada plantilla, en <a href="../equipos/">los 20 equipos</a>.</p>`));

  o.push(bloque('De dónde salen los datos', `  <p>El valor de cada jugador es el que publica LaLiga Fantasy cada noche, hacia las 00:15, para todas las ligas. Aquí se compara con el del día anterior y con el de hace siete cambios, entre los ${h.jugadores} jugadores que siguen en LaLiga. Una racha cuenta los días seguidos que el valor sube (o baja) hasta hoy. Las cifras de cuánto duran las rachas salen de 52.302 cambios de valor de esta temporada (<a href="../guias/valor-de-mercado.html">la guía de valor de mercado</a>).</p>`));
  o.push(bloque('Con Fantasy Manager', `  <p>La app cruza este mercado con tu liga: te dice cuáles de los que suben tienes a la venta en tu mercado, cuánto pujar sin quedarte en negativo y cuándo vender a uno de los tuyos que empieza a bajar.</p>`));
  return o.join('\n');
}

/** la caja de la próxima jornada (mercado, portada y jornada): cuándo empieza, el cierre de cláusulas y la previa */
export function proximaCaja(p, { previa = null, resumen = null, raiz = '../', todas = true } = {}) {
  const J = p.jornada;
  const lineas = [];
  if (p.enJuego) lineas.push(`<p><b>La jornada ${J} se está jugando.</b> Acaba el ${e(fechaHora(p.ultimo))}.</p>`);
  else lineas.push(`<p>Empieza el <b>${e(fechaHora(p.primero))}</b> con el ${e(p.partidos[0].local)}-${e(p.partidos[0].visitante)}. Las cláusulas se cierran el <b>${e(fechaHora(p.cierre))}</b>.</p>`);
  const enl = [];
  if (previa) enl.push(`<a class="btn sec" href="${raiz}${e(previa)}">Previa de la jornada ${J}</a>`);
  if (resumen) enl.push(`<a class="btn sec" href="${raiz}${e(resumen.ruta)}">Resumen de la jornada ${resumen.jornada}</a>`);
  if (todas) enl.push(`<a class="btn sec" href="${raiz}jornada/">Todas las jornadas</a>`);
  return `  <aside class="prox"><p class="prox-t">Jornada ${J}</p>${lineas.join('')}<div class="cta-b">${enl.join('')}</div></aside>`;
}

/** /equipos/: los 20, con lo que vale su plantilla y su mejor jugador; cada uno enlaza a su página (bot/web/fichas.mjs) */
export function contenidoEquipos(h, { rutas = SIN, jugadores = null } = {}) {
  const o = [];
  const nom = (q) => (rutas.equipo(q.id) ? `<a href="${e(rutas.equipo(q.id).split('/').pop())}">${e(q.nombre)}</a>` : e(q.nombre));
  const jn = (f) => (rutas.jugador(f.id) ? `<a href="${e(en(rutas.jugador(f.id)))}">${e(f.nombre)}</a>` : e(f.nombre));
  const caro = h.equipos[0], barato = h.equipos[h.equipos.length - 1];
  const masGana = [...h.equipos].sort((x, y) => y.dif7 - x.dif7)[0];
  o.push(`  <h1>Equipos de <span>LaLiga Fantasy</span></h1>`);
  o.push(`  <p class="lead">${e(`Lo que vale la plantilla de cada equipo en el mercado de LaLiga Fantasy, sumando a todos sus jugadores. La más cara es la del ${caro.nombre}, ${dinero(caro.valor)}; la más barata, la del ${barato.nombre}, ${dinero(barato.valor)}. En la última semana, la que más ha ganado es la del ${masGana.nombre}: ${dif(masGana.dif7)}.`)}</p>`);
  o.push(`  <p class="peq">Valores del ${e(fechaDia(h.dia))}. Se rehace sola cada noche.</p>`);
  const filas = h.equipos.map((q, i) => `      <tr><td>${i + 1}</td><td class="eq">${escudo(q.escudoUrl, q.nombre, 24)}<b>${nom(q)}</b></td><td>${e(dinero(q.valor))}</td><td>${cambio(q.dif, dif(q.dif))}</td><td>${cambio(q.dif7, dif(q.dif7))}</td><td><span class="w">${jn(q.top)}</span> <small>${e(dinero(q.top.nuevo))}</small></td><td>${q.media ? `<span class="w">${jn(q.media)}</span> <small>${e(coma(q.media.media))}</small>` : ''}</td></tr>`);
  o.push(bloque('Valor de cada plantilla', `  <div class="tabla-scroll"><table class="tabla-eq">\n    <thead><tr><th>#</th><th>Equipo</th><th>Plantilla</th><th>Hoy</th><th>7 días</th><th>El que más vale</th><th>Mejor media</th></tr></thead>\n    <tbody>\n${filas.join('\n')}\n    </tbody>\n  </table></div>`,
    { linea: '«Mejor media»: el de más puntos de media entre los que llevan 20 puntos o más en la temporada.' }));
  if (jugadores) o.push(`  <p>Cada equipo tiene su página con la plantilla, los puntos de cada jornada y los próximos rivales, y los jugadores que más pesan en el juego, la suya: <a href="../jugadores/">los ${jugadores} jugadores con ficha</a>.</p>`);
  o.push(bloque('De dónde salen los datos', `  <p>Los valores son los que publica LaLiga Fantasy cada noche para todas las ligas, de los ${h.jugadores} jugadores que siguen en LaLiga. La plantilla suma a todos los que tiene cada club en el juego, jueguen o no.</p>`));
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
