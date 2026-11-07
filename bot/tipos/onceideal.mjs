// El once ideal de Fantasy Manager (Carlos, 6 nov 08:45): entre 24 y 36 h antes de que empiece la jornada, un tweet con una tarjeta
// con el once que más puntos promete, combinando titularidad, media y racha, rival, casa o fuera y precio (la cuenta, en
// lib/once-ideal.mjs). Un tweet por jornada. La ventana (`onceIdeal` en config.json): de 36 h a 24 h antes del primer partido y,
// por si una ejecución se pierde, un margen de 6 h más (hasta 18 h antes); de 9 a 23 h (entre semana, desde las 7). Si algún partido
// de la jornada ya ha empezado (o está acabado), no sale: sería un once a medias. Si se estudia suspender o aplazar la jornada, espera.
// El texto cuenta por qué (la apuesta, el rival favorable, la racha, el chollo, el que se queda fuera por la duda) en frases que cambian
// de esqueleto con la jornada; el once entero va en la tarjeta. Sin tarjeta (apagada, o no pasa el validador), el tweet sale con los
// 11 nombres por líneas (`sinTarjeta`, como los apercibidos).
import { statsSemana } from '../lib/laliga.mjs';
import { corto, el, del, al, fmt, partes, dineroTxt, hash, peso, limite } from '../lib/texto.mjs';
import { tweet, aparte, pegar } from '../lib/redactar.mjs';
import { lista } from '../lib/agrupar.mjs';
import { enParalelo } from '../lib/http.mjs';
import { enElAire } from '../lib/aire.mjs';
import { horaMadrid, horas } from '../lib/horario.mjs';
import { crearInfo } from '../lib/info-jugador.mjs';
import { clubes as clubesH, jugador as jugadorH } from '../lib/hechos.mjs';
import { candidato, elegirIdeal, motivos, AJUSTES } from '../lib/once-ideal.mjs';

const H = 36e5;

/** «va 9º», «es el líder» o «es el colista» (el rival, para «que va 9º») */
const puestoDe = (riv) => (riv.pos === 1 ? 'es el líder' : riv.pos === riv.n ? 'es el colista' : `va ${riv.pos}º`);
const goles = (g) => (fmt(g) === '1' ? 'gol' : 'goles');
/** lo que marca o encaja el rival, si destaca para este puesto: ', y solo marca 0,8 goles por partido' (null si no destaca) */
function golesDelRival(x) {
  const r = x.riv, n = r.n || 20;
  if (x.pos === 'POR' || x.pos === 'DEF') return r.rgf >= n - 3 ? { t: `solo marca ${fmt(r.gf)} ${goles(r.gf)} por partido`, numeros: partes(r.gf) } : null;
  return r.rgc <= 4 ? { t: `encaja ${fmt(r.gc)} ${goles(r.gc)} por partido`, numeros: partes(r.gc) } : null;
}

/**
 * El tweet (y su tarjeta) con el once elegido. r: lo que da `elegirIdeal`; cands: todos los candidatos (para el que se queda fuera).
 * Pura (sin red): bot/prueba/onceideal-ejemplo.mjs.
 */
export function montar({ jornada, r, cands = [], minP = AJUSTES.minP }) {
  const once = r.once, form = r.formacion, fd = form.split('-').map(Number);
  const sem = `onceideal${jornada}`;
  const V = (xs, s) => xs[hash(`${sem}${s}`) % xs.length];
  const num = [jornada, ...fd];
  const vs = (x) => `${x.enCasa ? 'recibe' : 'visita'} ${al(x.rival)}`;

  // quién cuenta qué: la apuesta (el que más se espera), el chollo (el barato que más da), el del cruce más favorable, el que va en racha
  const mejor = [...once].sort((a, b) => b.e - a.e)[0];
  const chollo = once.filter((x) => x !== mejor && x.valor > 0 && x.valor <= AJUSTES.chollo).sort((a, b) => b.e - a.e)[0] || null;
  const usados = new Set([mejor, chollo].filter(Boolean));
  const fav = once.filter((x) => !usados.has(x) && x.riv && x.riv.nivel === 'fácil').sort((a, b) => b.f.nivel * b.f.goles - a.f.nivel * a.f.goles || b.e - a.e)[0] || null;
  if (fav) usados.add(fav);
  const enRacha = once.filter((x) => !usados.has(x)).map((x) => ({ x, m: motivos(x).find((y) => y.k === 'racha') })).filter((y) => y.m).sort((a, b) => b.m.fuerza - a.m.fuerza)[0];
  const racha = enRacha ? enRacha.x : null;
  // el que se queda fuera por la duda: de media alta, pero sin la titularidad que se pide
  const fuera = cands.filter((c) => !once.includes(c) && c.p < minP && c.p > 0.1 && c.media >= 6 && c.estado !== 'injured' && c.estado !== 'suspended').sort((a, b) => b.media - a.media)[0] || null;
  const total = once.reduce((s, x) => s + x.valor, 0);
  const tot = dineroTxt(total);

  const cab = V([`⭐ El once ideal de Fantasy Manager para la jornada ${jornada}: un ${form}`,
    `⭐ Así sería el once ideal de la jornada ${jornada} según Fantasy Manager, con un ${form}`,
    `⭐ Once ideal de Fantasy Manager para la jornada ${jornada}, en un ${form}`], 'cab');
  const ideas = [];

  // la apuesta
  const M = mejor, E = fmt(M.e), MD = fmt(M.media);
  num.push(...partes(M.e), ...partes(M.media), M.pct);
  ideas.push({ t: V([`${M.nombre} ${del(M.equipo)} es la gran apuesta: Fantasy Manager le calcula ${E} puntos, con ${MD} de media y un ${M.pct} % de titularidad`,
    `Nadie suma más que ${M.nombre} ${del(M.equipo)} en las cuentas de Fantasy Manager: ${E} puntos esperados, ${MD} de media y un ${M.pct} % de titularidad`,
    `La gran baza es ${M.nombre} ${del(M.equipo)}: ${MD} de media, un ${M.pct} % de titularidad y ${E} puntos esperados`], 'a'), prio: 9 });
  if (M.riv && M.rival) { ideas.push({ t: pegar(`y ${el(M.equipo)} ${vs(M)}, que ${puestoDe(M.riv)}`), prio: 8 }); if (!/líder|colista/.test(puestoDe(M.riv))) num.push(M.riv.pos); }

  // el cruce más favorable
  if (fav) {
    const g = golesDelRival(fav), gt = g ? ` y ${g.t}` : '';
    if (g) num.push(...g.numeros);
    num.push(fav.riv.pos);
    ideas.push({ t: aparte(V([`${fav.nombre} ${del(fav.equipo)} tiene el partido más agradecido: ${el(fav.equipo)} ${vs(fav)}, que ${puestoDe(fav.riv)}${gt}`,
      `Buen cruce para ${fav.nombre}: ${el(fav.equipo)} ${vs(fav)}, que ${puestoDe(fav.riv)}${gt}, así que el partido pinta bien`,
      `${fav.nombre} se mide ${al(fav.rival)}, que ${puestoDe(fav.riv)}${gt}: un rival asequible`], 'b')), prio: 7 });
  }

  // el chollo
  if (chollo) {
    const v = dineroTxt(chollo.valor), Ec = fmt(chollo.e);
    num.push(...v.numeros, ...partes(chollo.e));
    ideas.push({ t: aparte(V([`El chollo del once es ${chollo.nombre} ${del(chollo.equipo)}: vale ${v.t} y Fantasy Manager le calcula ${Ec} puntos`,
      `Por ${v.t}, ${chollo.nombre} ${del(chollo.equipo)} es el fichaje barato del once: ${Ec} puntos esperados`,
      `Y para el que busque algo barato, ${chollo.nombre} ${del(chollo.equipo)}: ${v.t} y ${Ec} puntos esperados`], 'c')), prio: 7 });
  }

  // la racha
  if (racha) {
    const RM = fmt(racha.racha.media), RD = fmt(racha.media), n = racha.racha.n;
    num.push(...partes(racha.racha.media), ...partes(racha.media), n);
    ideas.push({ t: aparte(V([`${racha.nombre} ${del(racha.equipo)} llega en racha: ${RM} de media en sus últimos ${n} partidos, frente a los ${RD} de toda la temporada`,
      `${racha.nombre} atraviesa un buen momento: ${RM} puntos de media en las últimas ${n} jornadas, por encima de sus ${RD} de la temporada`,
      `En racha también ${racha.nombre}, con ${RM} de media en sus últimos ${n} partidos (${RD} en toda la temporada)`], 'd')), prio: 6 });
  }

  // el que se queda fuera
  if (fuera) {
    num.push(...partes(fuera.media), fuera.pct);
    ideas.push({ t: aparte(V([`Se queda fuera ${fuera.nombre} ${del(fuera.equipo)}, con ${fmt(fuera.media)} de media: solo un ${fuera.pct} % de titularidad`,
      `${fuera.nombre} ${del(fuera.equipo)} tiene ${fmt(fuera.media)} de media, pero con un ${fuera.pct} % de titularidad no entra`], 'e')), prio: 4 });
  }

  // lo que vale
  num.push(...tot.numeros);
  ideas.push({ t: aparte(V([`El once completo vale ${tot.t}`, `Entre los once suman ${tot.t} de valor`], 'f')), prio: 3 });

  const { texto } = tweet(cab, ideas);

  // la tarjeta
  const pts = (x) => fmt(x.e);
  const d = { jornada, formacion: form, valor: tot.t, apuesta: true, chollo: !!chollo,
    once: once.map((x) => ({ id: x.id, pos: x.pos, nombre: x.nombre, equipo: x.equipo, club: x.club, pts: pts(x), rol: x === mejor ? 'apuesta' : x === chollo ? 'chollo' : null, caraUrl: x.caraUrl, escudoUrl: x.escudoUrl })) };
  const tarjeta = { tipo: 'onceideal', nombre: `onceideal-${jornada}`, d,
    permitidos: { numeros: [jornada, ...fd, ...once.map(pts), tot.t].map(String),
      palabras: ['ONCE', 'IDEAL', 'FORMACIÓN', 'PUNTOS', 'ESPERADOS', 'APUESTA', 'CHOLLO', 'VALOR', ...once.flatMap((x) => [x.nombre])] } };

  // sin tarjeta: los once nombres por líneas
  const L = (p) => once.filter((x) => x.pos === p).map((x) => x.nombre);
  const sinT = [`⭐ El once ideal de Fantasy Manager para la jornada ${jornada} (${form})`, '',
    `🧤 ${L('POR')[0]}`, `🛡️ ${lista(L('DEF'))}`, `⚙️ ${lista(L('MED'))}`, `🎯 ${lista(L('DEL'))}`].join('\n');
  const sinTarjeta = peso(sinT) <= limite() ? { texto: sinT, numeros: [jornada, ...fd] } : null;

  // los hechos para la IA que redacta (lib/redaccion.mjs): la apuesta, el chollo, el cruce, la racha y el que se queda fuera, cada uno con lo suyo;
  // el once entero va en la tarjeta
  const PUESTO = { POR: 'portero', DEF: 'defensa', MED: 'centrocampista', DEL: 'delantero' };
  const jug = (x, rol, principal = false) => jugadorH({ nickname: x.nombre, equipo: x.equipo, averagePoints: x.media }, { tit: { pct: x.pct }, principal,
    extra: { puesto: PUESTO[x.pos], rolEnElOnce: rol, ...(x.e != null ? { puntosEsperadosFantasyManager: fmt(x.e) } : {}), ...(x.valor > 0 ? { valor: dineroTxt(x.valor).t } : {}),
      ...(x.riv && x.rival ? { partido: `${x.enCasa ? 'recibe' : 'visita'} ${al(x.rival)}`, rival: { va: puestoDe(x.riv), dificultad: x.riv.nivel, ...(golesDelRival(x) ? { dato: golesDelRival(x).t } : {}) } } : {}),
      ...(rol === 'en racha' && racha ? { racha: `${fmt(racha.racha.media)} de media en sus últimos ${racha.racha.n} partidos` } : {}) } });
  const hechos = { tipo: 'onceideal', jornada, noticia: `el once ideal de Fantasy Manager para la jornada ${jornada}, calculado con titularidad, media, racha, rival, casa o fuera y precio`,
    formacion: form, valorDelOnce: tot.t, aviso: 'el once entero va en la imagen adjunta: el texto no lo enumera, cuenta por qué y destaca a unos pocos',
    jugadores: [jug(M, 'la gran apuesta', true), ...(chollo ? [jug(chollo, 'el chollo')] : []), ...(fav ? [jug(fav, 'el mejor cruce')] : []), ...(racha ? [jug(racha, 'en racha')] : []),
      ...(fuera ? [{ ...jug(fuera, 'se queda fuera por la duda'), estado: undefined }] : [])],
    clubes: clubesH(...[M, chollo, fav, racha, fuera].filter(Boolean).flatMap((x) => [x.equipo, x.rival])) };
  return { tipo: 'onceideal', clave: `onceideal|${jornada}`, jornada, texto, hechos, numeros: num, partido: null, tarjeta, ...(sinTarjeta ? { sinTarjeta } : {}),
    elegidos: { mejor: M.nombre, chollo: chollo && chollo.nombre, fav: fav && fav.nombre, racha: racha && racha.nombre, fuera: fuera && fuera.nombre } };
}

export async function generar({ semana, jugadores, stats: statsCtx = [], jornada: jornadaCtx, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), info = null, log = console.log }) {
  const cfg = config.onceIdeal || {};
  if (cfg.activo === false) return [];
  const libre = !ventanas || forzar;
  const [hD, hH] = horas(config, 'horasOnceIdeal', [9, 23], ahora);
  if (!libre && !(horaMadrid(ahora) >= hD && horaMadrid(ahora) < hH)) return [];
  const desde = (cfg.desdeHoras ?? 36) * H, hasta = ((cfg.hastaHoras ?? 24) - (cfg.margenHoras ?? 6)) * H;
  const jornadas = [...new Set([semana.weekNumber, semana.nextWeek, jornadaCtx].filter(Boolean))].sort((a, b) => a - b);
  for (const n of jornadas) {
    if (ventanas && !forzar && registro && registro.claves.has(`onceideal|${n}`)) continue;
    const st = n === jornadaCtx && statsCtx.length ? statsCtx : await statsSemana(n).catch(() => []);
    const fechas = st.map((m) => Date.parse(m.date)).filter(Number.isFinite);
    if (!st.length || !fechas.length) continue;
    const primer = Math.min(...fechas), falta = primer - ahora;
    if (ventanas && !forzar) {
      if (st.some((m) => m.matchState !== 1)) continue;                 // ya ha empezado (o hay partidos acabados): un once a medias no sirve
      if (!(falta <= desde && falta > hasta)) continue;
    }
    const m1 = st.find((m) => Date.parse(m.date) === primer);
    const aire = enElAire(registro, { jornada: n, m: m1, ahora });
    if (aire.espera && !forzar) { log(`  (onceideal) jornada ${n}: ${aire.motivo}`); continue; }

    // el partido de cada equipo en esa jornada
    const equipos = {}, escudos = {}, pps = {};
    for (const m of st) for (const [lado, rival, casa] of [[m.local, m.visitor, true], [m.visitor, m.local, false]]) {
      if (!lado || lado.id == null || pps[String(lado.id)]) continue;
      const id = String(lado.id);
      equipos[id] = lado.mainName; escudos[id] = lado.badgeColor || null;
      pps[id] = { jornada: n, rivalId: rival.id, rival: corto(rival.mainName), rivalNombre: rival.mainName, enCasa: casa, fecha: m.date || null };
    }
    const inf = info || crearInfo({ jugadores, equipos, semana, log });
    const ids = Object.keys(pps);
    log(`  (onceideal) jornada ${n}: pido el % de titularidad de ${ids.length} equipos`);
    const probs = await enParalelo(ids, 4, (id) => inf.probsDe(id, pps[id]));
    const rivs = await enParalelo(ids, 4, (id) => inf.rival(pps[id]));
    const porId = new Map(jugadores.map((j) => [String(j.id), j]));
    const cands = [], sin = [];
    ids.forEach((id, i) => {
      const pm = probs[i];
      if (!pm || pm.error) { sin.push(equipos[id]); return; }
      const riv = rivs[i] && !rivs[i].error ? rivs[i] : null;
      for (const x of Object.values(pm)) {
        const j = porId.get(String(x.id));
        if (j) cands.push(candidato(j, x, { riv, enCasa: pps[id].enCasa, ultima: n - 1, rival: pps[id].rival, equipo: corto(equipos[id]), club: equipos[id], escudoUrl: escudos[id] }));
      }
    });
    // con varios equipos sin datos, el once saldría cojo: mejor esperar a la siguiente ejecución
    if (sin.length > 3) { log(`  (onceideal) sin datos de ${sin.length} equipos (${sin.join(', ')}): espero`); continue; }
    if (sin.length) log(`  (onceideal) sin datos de ${sin.join(', ')}`);
    const r = elegirIdeal(cands, { maxPorClub: cfg.maxPorClub ?? AJUSTES.maxPorClub, minP: cfg.minTitularidad ?? AJUSTES.minP });
    if (!r) { log(`  (onceideal) jornada ${n}: no sale ningún once`); continue; }
    const t = montar({ jornada: n, r, cands, minP: cfg.minTitularidad ?? AJUSTES.minP });
    log(`  (onceideal) ${r.formacion} (corte ${Math.round(r.corte * 100)} %): ${r.once.map((x) => `${x.nombre} ${fmt(x.e)}`).join(', ')}`);
    return [t];
  }
  return [];
}
