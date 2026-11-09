// Balance de la temporada en el parón (Carlos, 9 nov 08:58): de la jornada 1 a la recién jugada, los que más puntos llevan en cada
// puesto, el once ideal de la temporada (con la tarjeta del once ideal: tipos/onceideal.mjs) y los chollos (puntos por millón de
// valor, con un mínimo de partidos jugados). Un tuit por parón, el primero de los cuatro (lib/paron-tuits.mjs). Todo sale de la lista de
// jugadores de LaLiga (`weekPoints` y `marketValue`): no pide nada más.
import { corto, fmt, del, dineroTxt, hash, peso, limite } from '../lib/texto.mjs';
import { tweet, aparte } from '../lib/redactar.mjs';
import { lista as enLista } from '../lib/agrupar.mjs';
import { clubes as clubesH, jugador as jugadorH } from '../lib/hechos.mjs';
import { ventanaParon, imagenesDe, puntosHasta } from '../lib/paron-tuits.mjs';
import { statsSemana } from '../lib/laliga.mjs';

const FORMACIONES = ['4-3-3', '4-4-2', '3-5-2', '3-4-3', '4-5-1', '5-3-2', '5-4-1'];
const PUESTO = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero' };
const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };

/** los de cada puesto ordenados por puntos hasta la jornada `hasta` (sin los que ya no están en LaLiga) */
export function porPuesto(jugadores, hasta) {
  const o = { 1: [], 2: [], 3: [], 4: [] };
  for (const j of jugadores) {
    const p = Number(j.positionId);
    if (!o[p] || j.playerStatus === 'out_of_league') continue;
    const { pts, jugadas } = puntosHasta(j, hasta);
    o[p].push({ j, id: String(j.id), nombre: j.nickname, pos: p, teamId: String(j.teamId), pts, jugadas, valor: Number(j.marketValue) || 0 });
  }
  for (const k of Object.keys(o)) o[k].sort((a, b) => b.pts - a.pts || a.valor - b.valor);
  return o;
}

/** el once de la temporada: la formación que más puntos suma con los que más llevan de cada puesto */
export function onceTemporada(pp) {
  let mejor = null;
  for (const f of FORMACIONES) {
    const [d, m, dl] = f.split('-').map(Number);
    const xs = [pp[1][0], ...pp[2].slice(0, d), ...pp[3].slice(0, m), ...pp[4].slice(0, dl)];
    if (xs.some((x) => !x)) continue;
    const pts = xs.reduce((s, x) => s + x.pts, 0);
    if (!mejor || pts > mejor.pts) mejor = { formacion: f, once: xs, pts };
  }
  return mejor;
}

/** los chollos: puntos por millón de valor, con 2/3 de las jornadas jugadas y al menos 40 puntos (que no sea un partido suelto) */
export function chollos(pp, hasta, n = 3) {
  const min = Math.max(4, Math.ceil(hasta * 2 / 3));
  return Object.values(pp).flat().filter((x) => x.jugadas >= min && x.pts >= 40 && x.valor >= 1e6)
    .map((x) => ({ ...x, ppm: x.pts / (x.valor / 1e6) })).sort((a, b) => b.ppm - a.ppm).slice(0, n);
}

export async function generar(ctx) {
  const { jugadores = [], stats = [], log = console.log, pedirSemana = statsSemana } = ctx;
  const v = ventanaParon('balance', ctx);
  if (!v.ok) { log(`  (balance) ${v.motivo}`); return []; }
  const J = v.jugada;
  const sig = ctx.paron && ctx.paron.statsSiguiente ? ctx.paron.statsSiguiente : await pedirSemana(v.siguiente).catch(() => []);
  const im = imagenesDe(jugadores, stats, sig);
  const eq = (x) => corto(im.equipos[x.teamId] || '?');
  const pp = porPuesto(jugadores, J);
  const once = onceTemporada(pp);
  if (!once) { log('  (balance) no sale el once de la temporada'); return []; }
  const chs = chollos(pp, J);
  const tops = [1, 2, 3, 4].map((p) => pp[p].slice(0, 2));
  const lider = [...tops.map((t) => t[0])].sort((a, b) => b.pts - a.pts)[0];
  const ch = chs[0] || null;
  const V = (xs, s) => xs[hash(`balance${J}${s}`) % xs.length];

  // la plantilla (último recurso): el que más lleva, los de cada puesto y el chollo
  const num = [1, J];
  const cab = V([`📊 Balance del parón: así va la temporada fantasy de la jornada 1 a la ${J}`, `📊 Parón de selecciones y hora de hacer balance: de la jornada 1 a la ${J}`], 'cab');
  const ideas = [];
  num.push(lider.pts);
  ideas.push({ t: aparte(`${lider.nombre} ${del(eq(lider))} es el que más puntos lleva: ${lider.pts}`), prio: 9 });
  for (const t of tops) {
    const a = t[0], b = t[1];
    if (a === lider) continue;
    num.push(a.pts);
    ideas.push({ t: `🏆 Entre los ${PUESTO[a.pos]}s manda ${a.nombre}, con ${a.pts}${b ? `; detrás, ${b.nombre} (${b.pts})` : ''}`, prio: 7 });
    if (b) num.push(b.pts);
  }
  if (ch) {
    const vt = dineroTxt(ch.valor);
    num.push(...vt.numeros, ch.pts);
    ideas.push({ t: aparte(`🛒 El chollo de la temporada es ${ch.nombre} ${del(eq(ch))}: ${ch.pts} puntos y vale ${vt.t}`), prio: 6 });
  }
  ideas.push({ t: aparte(`El once de la temporada va en la imagen, en un ${once.formacion}`), prio: 5 });
  num.push(...once.formacion.split('-').map(Number));
  const { texto } = tweet(cab, ideas);

  // la tarjeta: la del once ideal, con los puntos de la temporada en cada uno; el aro dorado, el que más lleva; el verde, el chollo del once
  const cholloOnce = [...once.once].map((x) => ({ x, ppm: x.pts / Math.max(1, x.valor / 1e6) })).sort((a, b) => b.ppm - a.ppm)[0].x;
  const lid = [...once.once].sort((a, b) => b.pts - a.pts)[0];
  const sub = `TEMPORADA · JORNADAS 1-${J}`, sub2 = `PUNTOS · ${once.formacion}`;
  const d = { jornada: J, formacion: once.formacion, valor: null, apuesta: true, chollo: true, titulo: 'ONCE IDEAL', sub, sub2, leyendas: { apuesta: 'MÁS PUNTOS', chollo: 'CHOLLO' },
    once: once.once.map((x) => ({ id: x.id, pos: POS[x.pos], nombre: x.nombre, equipo: eq(x), club: im.equipos[x.teamId] || '', pts: String(x.pts), rol: x === lid ? 'apuesta' : x === cholloOnce ? 'chollo' : null,
      caraUrl: im.cara(x.j), escudoUrl: im.escudoDe(x.teamId) })) };
  const tarjeta = { tipo: 'onceideal', nombre: `balance-${J}`, d,
    permitidos: { numeros: [1, J, ...once.formacion.split('-'), ...once.once.map((x) => x.pts)].map(String),
      palabras: ['ONCE', 'IDEAL', 'TEMPORADA', 'JORNADAS', 'PUNTOS', 'MÁS', 'CHOLLO', ...once.once.map((x) => x.nombre)] } };
  // sin tarjeta: el once por líneas
  const L = (p) => once.once.filter((x) => x.pos === p).map((x) => x.nombre);
  const sinT = [`📊 El once de la temporada, de la jornada 1 a la ${J} (${once.formacion})`, '', `🧤 ${L(1)[0]}`, `🛡️ ${enLista(L(2))}`, `⚙️ ${enLista(L(3))}`, `🎯 ${enLista(L(4))}`].join('\n');
  const sinTarjeta = peso(sinT) <= limite() ? { texto: sinT, numeros: [1, J, ...once.formacion.split('-').map(Number)] } : null;

  // los hechos para la IA (lib/redaccion.mjs): lo que más importa del balance; el once entero va en la imagen
  const jug = (x, rol, principal = false) => jugadorH(x.j, { equipos: im.equipos, principal, sinDatos: ['total', 'ranking'], extra: { rol, puntosTemporada: x.pts, partidosJugados: x.jugadas, valor: dineroTxt(x.valor).t } });
  const hechos = { tipo: 'balance', noticia: `balance de la temporada fantasy en el parón de selecciones: de la jornada 1 a la ${J}`,
    momento: `estamos en el parón de selecciones; la liga vuelve con la jornada ${v.siguiente}`,
    aviso: `el once de la temporada (${once.formacion}, los que más puntos llevan en cada puesto) va en la imagen adjunta: el texto no lo enumera; cuenta lo que destaca (quién manda, la sorpresa, el chollo) y lo que significa para quien juega`,
    elQueMasPuntosLleva: { nombre: lider.nombre, club: eq(lider), puesto: PUESTO[lider.pos], puntos: lider.pts },
    masPuntosPorPuesto: tops.map((t) => ({ puesto: PUESTO[t[0].pos], primero: { nombre: t[0].nombre, club: eq(t[0]), puntos: t[0].pts }, ...(t[1] ? { segundo: { nombre: t[1].nombre, club: eq(t[1]), puntos: t[1].pts } } : {}) })),
    chollos: chs.map((x) => ({ nombre: x.nombre, club: eq(x), puesto: PUESTO[x.pos], puntos: x.pts, valor: dineroTxt(x.valor).t, puntosPorMillon: fmt(x.ppm) })),
    jugadores: [jug(lider, 'el que más puntos lleva', true), ...tops.map((t) => t[0]).filter((x) => x !== lider).map((x) => jug(x, `el ${PUESTO[x.pos]} que más lleva`)),
      ...chs.filter((x) => x !== lider).slice(0, 2).map((x) => jug(x, 'chollo de la temporada'))],
    clubes: clubesH(...[lider, ...tops.flat(), ...chs].filter(Boolean).map(eq)) };
  log(`  (balance) J1-J${J}: ${lider.nombre} ${lider.pts}; once ${once.formacion} ${once.pts} pts; chollos ${chs.map((x) => `${x.nombre} ${fmt(x.ppm)}/M`).join(', ')}`);
  return [{ tipo: 'balance', clave: `balance|${J}`, jornada: J, texto, hechos, numeros: num, partido: null, tarjeta, ...(sinTarjeta ? { sinTarjeta } : {}) }];
}
