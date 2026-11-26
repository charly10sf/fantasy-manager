/* Mide, con los datos públicos de LaLiga (sin sesión), lo que la app diría de los entrenadores en una liga premium
   (claude/premium-sesion-b.md del proyecto). Un entrenador puntúa 5 si su equipo gana, 2 si empata y 0 si pierde.
   1) Con dos entrenadores, ¿alinear al de mejor partido (lo que se espera con los goles de cada equipo hasta entonces, en
      casa o fuera: la misma cuenta que `M.previa`) gana a alinear siempre al mismo (el que más puntos lleva por jornada)?
   2) ¿Fichar uno compensa? Lo que da cada uno por jornada frente a lo que vale.
   Uso: cd bot && node ../.github/ia/medir-entrenador.mjs [desde=4] [hasta=última acabada] */
import { jugadores, statsSemana, semanaActual } from '../../bot/lib/laliga.mjs';

const r2 = (x) => Math.round(x * 100) / 100;
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
/** lo que se espera de un entrenador con los goles que se esperan de su equipo y del rival: 5·P(gana) + 2·P(empata) */
export function esperadoEntrenador(gf, gc) {
  let pw = 0, pd = 0;
  for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) { const p = pois(gf, a) * pois(gc, b); if (a > b) pw += p; else if (a === b) pd += p; }
  return { pw, pd, pts: 5 * pw + 2 * pd };
}

const sem = await semanaActual();
const actual = Number((sem && (sem.weekNumber || (sem.data && sem.data.weekNumber))) || 14);
const desde = Number(process.argv[2]) || 4, hasta = Number(process.argv[3]) || actual - 1;
const todos = await jugadores();
const ents = todos.filter((j) => String(j.positionId) === '5');
const partidos = {};
for (let n = 1; n <= hasta; n++) partidos[n] = (await statsSemana(n)).map((m) => ({ l: String(m.local.id), v: String(m.visitor.id), gl: Number(m.localScore), gv: Number(m.visitorScore), jugado: m.localScore != null && m.visitorScore != null }));

const ptsDe = (e, n) => { const w = (e.weekPoints || []).find((x) => Number(x.weekNumber) === n); return w ? Number(w.points) : null; };
// comprobación: solo 5, 2 o 0
const raros = ents.flatMap((e) => (e.weekPoints || []).map((w) => Number(w.points))).filter((p) => ![0, 2, 5].includes(p));

function tablaAntes(n) {
  const t = {};
  let goles = 0, pj = 0;
  for (let k = 1; k < n; k++) for (const m of partidos[k] || []) {
    if (!m.jugado) continue;
    for (const [id, gf, gc] of [[m.l, m.gl, m.gv], [m.v, m.gv, m.gl]]) { const x = (t[id] ||= { pj: 0, gf: 0, gc: 0 }); x.pj++; x.gf += gf; x.gc += gc; }
    goles += m.gl + m.gv; pj += 2;
  }
  return { t, mediaGoles: pj ? goles / pj : 1.3 };
}

const filas = []; // por jornada y entrenador: lo esperado, su media hasta entonces y lo que sacó
for (let n = desde; n <= hasta; n++) {
  const { t, mediaGoles } = tablaAntes(n);
  for (const e of ents) {
    const eq = String(e.teamId || (e.team && e.team.id));
    const m = (partidos[n] || []).find((x) => x.l === eq || x.v === eq);
    const real = ptsDe(e, n);
    if (!m || !m.jugado || real == null) continue;
    const casa = m.l === eq, tu = t[eq], ri = t[casa ? m.v : m.l];
    if (!tu || !ri || tu.pj < 3 || ri.pj < 3) continue;
    const gf = (tu.gf / tu.pj) * (ri.gc / ri.pj) / mediaGoles * (casa ? 1.1 : 0.9);
    const gc = (ri.gf / ri.pj) * (tu.gc / tu.pj) / mediaGoles * (casa ? 0.9 : 1.1);
    const antes = (e.weekPoints || []).filter((w) => Number(w.weekNumber) < n).map((w) => Number(w.points));
    // ¿su equipo ganó, empató o perdió? (para comprobar que el entrenador puntuó con su equipo: si no, no entrenaba ese día)
    const debia = (casa ? m.gl - m.gv : m.gv - m.gl) > 0 ? 5 : m.gl === m.gv ? 2 : 0;
    filas.push({ n, id: e.id, nombre: e.nickname, eq, valor: Number(e.marketValue), esp: esperadoEntrenador(gf, gc).pts, media: media(antes), nAntes: antes.length, real, debia, casa });
  }
}
const coincide = filas.filter((f) => f.real === f.debia).length;

// 1) cada pareja de entrenadores con partido los dos esa jornada
const pol = { mejorPartido: [], masMedia: [], mejor: [], peor: [], azar: [] };
let distintos = 0, ganaPartido = 0, ganaMedia = 0;
for (let n = desde; n <= hasta; n++) {
  const fs = filas.filter((f) => f.n === n && f.nAntes >= 3);
  for (let i = 0; i < fs.length; i++) for (let k = i + 1; k < fs.length; k++) {
    const a = fs[i], b = fs[k];
    const pp = a.esp >= b.esp ? a : b, pm = a.media >= b.media ? a : b;
    pol.mejorPartido.push(pp.real); pol.masMedia.push(pm.real); pol.mejor.push(Math.max(a.real, b.real)); pol.peor.push(Math.min(a.real, b.real)); pol.azar.push((a.real + b.real) / 2);
    if (pp !== pm) { distintos++; if (pp.real > pm.real) ganaPartido++; else if (pp.real < pm.real) ganaMedia++; }
  }
}
// lo esperado frente a lo real, por tramos
const tramos = [[0, 1.5], [1.5, 2.2], [2.2, 3], [3, 5.1]].map(([a, b]) => { const l = filas.filter((f) => f.esp >= a && f.esp < b); return { esperado: `${a}-${b}`, n: l.length, esperadoMedio: r2(media(l.map((f) => f.esp))), real: r2(media(l.map((f) => f.real))) }; });
// 2) ¿compensa fichar uno? lo que dan por jornada los que hoy siguen, frente a lo que valen
const vivos = ents.filter((e) => e.playerStatus !== 'out_of_league').map((e) => {
  const ps = (e.weekPoints || []).map((w) => Number(w.points));
  return { nombre: e.nickname, valor: Number(e.marketValue), media: media(ps), n: ps.length };
}).filter((e) => e.n >= 5).sort((a, b) => b.media - a.media);
const porValor = [[0, 0.7e6], [0.7e6, 1e6], [1e6, 9e9]].map(([a, b]) => { const l = vivos.filter((e) => e.valor >= a && e.valor < b); return { valor: `${a / 1e6}-${b >= 9e9 ? '…' : b / 1e6} M`, n: l.length, mediaPorJornada: r2(media(l.map((e) => e.media))), valorMedioM: r2(media(l.map((e) => e.valor)) / 1e6) }; });

console.log(JSON.stringify({
  jornadas: [desde, hasta], entrenadores: ents.length, siguen: ents.filter((e) => e.playerStatus !== 'out_of_league').length, puntosQueNoSon5_2_0: raros.length,
  filas: filas.length, puntuaComoSuEquipo: `${coincide}/${filas.length}`,
  parejas: { n: pol.mejorPartido.length, mejorPartido: r2(media(pol.mejorPartido)), masMedia: r2(media(pol.masMedia)), alAzar: r2(media(pol.azar)), elMejor: r2(media(pol.mejor)), elPeor: r2(media(pol.peor)), noCoinciden: distintos, ahiGanaElPartido: ganaPartido, ahiGanaLaMedia: ganaMedia },
  esperadoFrenteAReal: tramos,
  todos: { mediaPorJornada: r2(media(vivos.map((e) => e.media))), valorMin: Math.min(...vivos.map((e) => e.valor)), valorMax: Math.max(...vivos.map((e) => e.valor)) },
  porValor, mejores: vivos.slice(0, 5).map((e) => `${e.nombre} ${r2(e.media)} (${r2(e.valor / 1e6)} M)`), peores: vivos.slice(-3).map((e) => `${e.nombre} ${r2(e.media)} (${r2(e.valor / 1e6)} M)`),
}, null, 1));
