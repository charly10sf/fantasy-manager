// El once ideal de Fantasy Manager (Carlos, 6 nov 08:45: «entre 24 y 36 h antes de que empiece la jornada, subir el once ideal de
// Fantasy Manager, con una tarjeta, combinando precio, puntos, rivales, equipo… todas las variables, numéricas y no numéricas»).
// Aquí solo está la cuenta, sin red (tipos/onceideal.mjs pide los datos y escribe el tweet):
//   1. puntos esperados de cada jugador en SU partido de la jornada = % de titularidad de la app × lo que rinde cuando juega
//      (la media de la temporada mezclada con la de sus últimas jornadas) × lo difícil que es el rival (fácil, media o difícil) ×
//      lo que marca o encaja ese rival (para porteros y defensas cuenta lo que marca; para medios y delanteros, lo que encaja) ×
//      casa o fuera;
//   2. una puntuación para elegir = esos puntos + un empujón pequeño a los baratos (hasta 0,3 puntos: a igualdad, el más barato);
//   3. la mejor de las formaciones posibles, con un portero y un máximo de 3 jugadores por club (si no, saldrían 5 del Barça);
//      solo entran los que tienen un 60 % de titularidad o más (si con eso no se llena ninguna formación, un 30 %).
// El precio no decide quién entra (lo que importa es sumar puntos): sale en la tarjeta (lo que vale el once) y en el texto (el chollo).
import { fmt } from './texto.mjs';

export const FORMACIONES = [[4, 3, 3], [4, 4, 2], [4, 5, 1], [3, 5, 2], [3, 4, 3], [5, 3, 2], [5, 4, 1]];
export const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
export const AJUSTES = { maxPorClub: 3, minP: 0.6, minPRelajado: 0.3, bonusPrecio: 0.3, topeBarato: 60e6, chollo: 12e6 };

/** los puntos de las últimas `k` jornadas jugadas antes de `ultima` (la jornada anterior a la que se juega): { n, media } */
export function rachaReciente(j, ultima, k = 4) {
  const xs = (j.weekPoints || []).filter((w) => Number(w.weekNumber) > ultima - k && Number(w.weekNumber) <= ultima).map((w) => Number(w.points)).filter(Number.isFinite);
  return { n: xs.length, media: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 };
}

/**
 * Lo que cambia el rival y el campo: { nivel, goles, casa } (multiplicadores). riv: lo que da `info.rival()` ({ pos, n, nivel, gf, gc, rgf, rgc },
 * o null si aún no hay tabla); enCasa: true, false o null.
 */
export function factoresRival({ pos, riv = null, enCasa = null }) {
  let nivel = 1, goles = 1;
  if (riv) {
    nivel = { 'fácil': 1.08, media: 1, 'difícil': 0.92 }[riv.nivel] ?? 1;
    const atras = pos === 'POR' || pos === 'DEF';
    // rgf: el puesto del rival en goles a favor por partido y rgc en contra (1 = el que más marca / el que más encaja)
    const rk = atras ? riv.rgf : riv.rgc, n = riv.n || 20;
    if (rk != null) goles = atras ? (rk <= 4 ? 0.94 : rk >= n - 3 ? 1.06 : 1) : (rk <= 4 ? 1.06 : rk >= n - 3 ? 0.94 : 1);
  }
  return { nivel, goles, casa: enCasa == null ? 1 : enCasa ? 1.04 : 0.97 };
}

/** los puntos que se esperan de un jugador ({ e, base, media, racha, f }). j: el jugador de la lista de LaLiga; p: su % de titularidad (0-1) */
export function esperados(j, { p, riv = null, enCasa = null, ultima = 0 }) {
  const pos = POS[Number(j.positionId)];
  const media = Number(j.averagePoints) || 0;
  const racha = rachaReciente(j, ultima);
  // lo reciente pesa más cuanto más partidos hay: con 3 o más, un 40 %; con uno solo, un 15 %
  const w = racha.n >= 3 ? 0.4 : racha.n === 2 ? 0.3 : racha.n === 1 ? 0.15 : 0;
  const base = (1 - w) * media + w * racha.media;
  const f = factoresRival({ pos, riv, enCasa });
  return { e: Math.max(0, (Number(p) || 0) * base * f.nivel * f.goles * f.casa), base, media, racha, f };
}

/** el empujón al barato: de 0,3 puntos (casi gratis) a 0 (60 M o más) */
export const bonusPrecio = (valor) => AJUSTES.bonusPrecio * (1 - Math.min(Math.max(Number(valor) || 0, 0), AJUSTES.topeBarato) / AJUSTES.topeBarato);

/** el jugador listo para elegir: lo de la lista de LaLiga, su % y sus puntos esperados */
export function candidato(j, x, { riv = null, enCasa = null, ultima = 0, rival = null, equipo = '', club = '', escudoUrl = null } = {}) {
  const r = esperados(j, { p: x.p, riv, enCasa, ultima });
  const valor = Number(j.marketValue) || 0;
  return { id: j.id, nombre: j.nickname, pos: POS[Number(j.positionId)], posId: Number(j.positionId), teamId: String(j.teamId), equipo, club, escudoUrl,
    caraUrl: j.image || (j.images && j.images.transparent && j.images.transparent['256x256']) || null,
    p: x.p, pct: Math.round(x.p * 100), duda: !!x.duda, estado: x.estado, valor, media: r.media, base: r.base, racha: r.racha, f: r.f, e: r.e,
    score: r.e + bonusPrecio(valor), riv, rival, enCasa };
}

function llenar(pool, [d, m, f], maxPorClub) {
  const cupo = { POR: 1, DEF: d, MED: m, DEL: f }, porClub = {}, once = [];
  for (const x of pool) {
    if (!(cupo[x.pos] > 0) || (porClub[x.teamId] || 0) >= maxPorClub) continue;
    once.push(x); cupo[x.pos]--; porClub[x.teamId] = (porClub[x.teamId] || 0) + 1;
  }
  return Object.values(cupo).every((c) => c === 0) ? once : null;
}

/**
 * El once ideal: { formacion: '4-3-3', once: [...] (portero, defensas, medios y delanteros, de más a menos puntuación en cada línea),
 * suma, corte } o null si no sale ningún once. Voraz por formación (se llena con los de más puntuación respetando los cupos) y se queda
 * la formación que más suma.
 */
export function elegirIdeal(cands, { maxPorClub = AJUSTES.maxPorClub, minP = AJUSTES.minP, formaciones = FORMACIONES } = {}) {
  for (const corte of [minP, AJUSTES.minPRelajado]) {
    const pool = cands.filter((x) => x.p >= corte && x.e > 0 && x.pos)
      .sort((a, b) => b.score - a.score || b.e - a.e || String(a.id).localeCompare(String(b.id)));
    let mejor = null;
    for (const f of formaciones) {
      const once = llenar(pool, f, maxPorClub);
      if (!once) continue;
      const suma = once.reduce((s, x) => s + x.score, 0);
      if (!mejor || suma > mejor.suma + 1e-9) mejor = { formacion: f.join('-'), once, suma };
    }
    if (mejor) {
      const orden = ['POR', 'DEF', 'MED', 'DEL'];
      mejor.once = [...mejor.once].sort((a, b) => orden.indexOf(a.pos) - orden.indexOf(b.pos) || b.score - a.score);
      return { ...mejor, corte };
    }
  }
  return null;
}

/** una idea de por qué está cada uno, de más a menos fuerte: racha, rival favorable, fijo */
export function motivos(x) {
  const m = [];
  if (x.racha.n >= 2 && x.racha.media >= x.media * 1.2 && x.racha.media - x.media >= 1.5) m.push({ k: 'racha', fuerza: x.racha.media - x.media });
  const favorable = x.riv && (x.f.nivel > 1 || x.f.goles > 1);
  if (favorable) m.push({ k: 'rival', fuerza: (x.f.nivel * x.f.goles - 1) * 10 });
  if (x.p >= 0.9) m.push({ k: 'fijo', fuerza: 0.5 });
  return m.sort((a, b) => b.fuerza - a.fuerza);
}
