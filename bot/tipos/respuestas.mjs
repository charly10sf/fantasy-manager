// Respuestas para los tuits de resultado final que sube cada club. NO se publican: X no deja responder por API a quien no te ha
// mencionado antes, y el bot nunca responde. El bot solo prepara el texto de cada club y se lo manda a Carlos por Telegram para
// que lo copie y lo ponga él a mano (bot/LEEME.md). Todo sale de los datos de LaLiga (stats/week/{n}, puntos oficiales).
import { cierre, corto, elegir } from '../lib/texto.mjs';
import { esc } from '../lib/telegram.mjs';

const nombreDe = (p) => p.nickname || p.name;
/** el jugador con más puntos de la lista, solo si saca más de 0 (empates: el primero) */
function mejorDe(players) {
  let mejor = null;
  for (const p of players || []) {
    const pts = Number(p.weekPoints);
    if (p.weekPoints == null || !Number.isFinite(pts) || pts <= 0) continue;
    if (!mejor || pts > mejor.pts) mejor = { nombre: nombreDe(p), pts };
  }
  return mejor;
}

/** el texto de la respuesta de un club, desde su punto de vista (g = goles suyos, c = goles del rival). `semilla` fija la variante
 *  (la misma para el mismo partido y club). El tuit del club ya enseña el resultado: aquí solo va el marcador corto y el rival. */
function textoDe({ club, rival, g, c, mejor, semilla }) {
  const n = mejor && mejor.nombre, pts = mejor && mejor.pts;
  let t;
  if (g === c) {
    t = mejor
      ? elegir([
        `Empate ${g}-${c} con ${rival}: un punto para cada uno. En LaLiga Fantasy, ${n} fue lo mejor de ${club} con ${pts} puntos.`,
        `Reparto de puntos (${g}-${c}) con ${rival}. ${n} puntúa ${pts} en LaLiga Fantasy, lo mejor de ${club}.`,
      ], semilla)
      : `Empate ${g}-${c} con ${rival}, ${club}. En LaLiga Fantasy no hay mucho que rascar.`;
  } else if (g > c) {
    t = mejor
      ? elegir([
        `Enhorabuena, ${club}: ${g}-${c} contra ${rival}. En LaLiga Fantasy, ${n} fue el que más puntuó de los vuestros: ${pts}.`,
        `${g}-${c} y tres puntos para ${club}. En LaLiga Fantasy, ${n} puntúa ${pts}, lo mejor de su equipo.`,
        `¡Victoria ante ${rival}, ${g}-${c}! ${n} manda en LaLiga Fantasy con ${pts} puntos.`,
      ], semilla)
      : `Enhorabuena, ${club}: ${g}-${c} contra ${rival}. Tres puntos importantes.`;
  } else {
    t = mejor
      ? elegir([
        `Ánimo, ${club}. Perder ${g}-${c} duele, pero ${n} se salva en LaLiga Fantasy con ${pts} puntos.`,
        `Día para olvidar el ${g}-${c}. Lo mejor de ${club} en LaLiga Fantasy: ${n}, ${pts} puntos.`,
      ], semilla)
      : elegir([
        `Ánimo, ${club}: ${g}-${c} contra ${rival}. Toca pasar página y pensar ya en la próxima jornada de LaLiga Fantasy.`,
        `Un ${g}-${c} ante ${rival} no es lo que queríais, ${club}. A pasar página, que en LaLiga Fantasy hay otra jornada por delante.`,
      ], semilla);
  }
  return `${t}\n\n${cierre(semilla)}`;
}

/**
 * Un elemento por partido acabado: { tipo, clave, jornada, fecha, titulo, respuestas: [{club, cuenta, texto, numeros}] }.
 * Con `desdeFinal` solo cuenta los partidos que empezaron después (al activarlo no se sueltan los de días atrás). Si LaLiga aún no
 * ha puesto los puntos (menos de `minJugadoresConPuntos` jugadores con algo distinto de 0), espera a la siguiente ejecución.
 */
export function generar({ stats, jornada, config = {}, desdeFinal = 0, log = () => {} }) {
  const tg = config.telegram || {};
  const minimo = tg.minJugadoresConPuntos ?? 12;
  const cuentas = tg.cuentasX || {};
  const out = [];
  const acabados = stats.filter((m) => m.matchState === 7 && Date.parse(m.date) >= desdeFinal).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  for (const m of acabados) {
    const todos = [...(m.local.players || []), ...(m.visitor.players || [])];
    const conPuntos = todos.filter((p) => p.weekPoints != null && Number(p.weekPoints) !== 0).length;
    const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
    const gl = Number(m.localScore), gv = Number(m.visitorScore);
    if (conPuntos < minimo) { log(`respuestas: ${L}-${V} acabado, pero solo ${conPuntos} jugadores con puntos (hacen falta ${minimo}): espero`); continue; }
    const marcador = `${L} ${gl}-${gv} ${V}`;
    const lados = [
      { club: L, rival: V, goles: gl, contra: gv, players: m.local.players, lado: 'l' },
      { club: V, rival: L, goles: gv, contra: gl, players: m.visitor.players, lado: 'v' },
    ];
    const respuestas = lados.map((s) => {
      const mejor = mejorDe(s.players);
      const texto = textoDe({ club: s.club, rival: s.rival, g: s.goles, c: s.contra, mejor, semilla: `resp${m.id}${s.lado}` });
      const cuenta = String(cuentas[s.club] || '').replace(/^@/, '') || null;
      return { club: s.club, cuenta, texto, numeros: [s.goles, s.contra, ...(mejor ? [mejor.pts] : [])] };
    });
    out.push({ tipo: 'respuestas', clave: `respuestas|${m.id}`, jornada, fecha: m.date, titulo: `${marcador} · J${jornada}`, respuestas });
  }
  return out;
}

/** el mensaje de Telegram (HTML) de un partido: cada respuesta en <code>, que con un toque se copia */
export function mensaje(item) {
  const partes = [`🏁 <b>${esc(item.titulo)}</b>`, 'Respuestas para el tuit de resultado de cada club (toca una para copiarla):'];
  for (const r of item.respuestas) {
    partes.push('', `<b>${esc(r.club)}</b>${r.cuenta ? ` · @${esc(r.cuenta)}` : ''}`, `<code>${esc(r.texto)}</code>`);
  }
  return partes.join('\n');
}
