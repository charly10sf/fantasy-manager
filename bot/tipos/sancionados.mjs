// Sancionados y apercibidos de la jornada que viene (cola de Carlos, 3 nov 20:17; plan de bot-x.md: «Mié y jue, tope 2 por jornada;
// apercibidos solo si son titulares habituales»). Dos tweets por jornada como mucho:
//   - sancionados: los que LaLiga da por sancionados (playerStatus) y pesan en el fantasy, con el motivo de la web de previas
//     (roja directa, quinta amarilla o «3/4» de una sanción larga) o, si no casa, el de su ficha de LaLiga (`motivoSancion`);
//   - apercibidos: con cuatro amarillas, una más y se pierden la jornada siguiente. Dos fuentes: la web los da y la ficha de LaLiga
//     cuenta 4, 9, 14… amarillas. Solo titulares habituales que no estén ya de baja.
// Sin repetir: fuera quien ya ha salido sancionado en caídas o en este tipo en la misma jornada, o en novedades en los 5 días de antes.
// Sale entre las horas de `horasSancionados` y cuando falten menos de `sancionadosAntesHoras` para el primer partido de la jornada
// (con la jornada de viernes, desde el miércoles por la tarde), nunca con partidos de la anterior a medias.
import { corto, fmt, partes, el } from '../lib/texto.mjs';
import { tweet } from '../lib/redactar.mjs';
import { statsSemana, ficha as fichaLaLiga } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { tarjetaBajas } from '../lib/datos-tarjetas.mjs';
import { motivoSancion } from '../lib/partes.mjs';
import { elQueMasPesa, enLetra, mayus, nombresPorClub } from '../lib/agrupar.mjs';
import { disciplina, casar, amarillasDe } from '../lib/disciplina.mjs';
import { baseTitular } from './caidas.mjs';

const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const HORA = 36e5;
const ORDINAL = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
const con = (eq) => `con ${el(eq)}`;
// pesa en el fantasy: titular habitual, buena media o mucho valor
const pesa = (j, b) => (b && b.p >= 0.5) || Number(j.averagePoints) >= 3 || Number(j.marketValue) >= 8e6;

/** la jornada a la que van los tweets y la hora de su primer partido (null si la anterior está a medias) */
export async function objetivo({ stats, semana, jornada, pedirSemana = statsSemana }) {
  let n = null;
  if (stats.length && stats.every((m) => m.matchState === 7)) n = semana.nextWeek;
  else if (stats.length && stats.every((m) => m.matchState === 1)) n = jornada;
  if (!n) return null;
  const ms = n === jornada ? stats : await pedirSemana(n).catch(() => []);
  const saques = ms.map((m) => Date.parse(m.date)).filter(Number.isFinite);
  if (!saques.length) return null;
  return { jornada: n, primero: Math.min(...saques), partidos: ms };
}

/** la línea de un sancionado: «❌ Vini Jr. cumple el último de sus cuatro partidos de sanción con el Real Madrid» */
export function lineaSancion(x) {
  const w = x.web, quien = `${x.nombre} ${con(x.equipo)}`;
  if (w && w.motivo === 'roja') return `❌ ${x.nombre} vio la roja directa ${con(x.equipo)}`;
  if (w && w.motivo === 'amarillas') return `❌ ${x.nombre} llegó a cinco amarillas ${con(x.equipo)}`;
  if (w && w.motivo === 'disciplinaria' && w.partido && w.de && w.de > 1 && w.de <= 10) {
    if (w.partido === w.de) return `❌ ${x.nombre} cumple el último de sus ${enLetra(w.de)} partidos de sanción ${con(x.equipo)}`;
    return `❌ ${x.nombre} cumple el ${ORDINAL[w.partido]} de sus ${enLetra(w.de)} partidos de sanción ${con(x.equipo)}`;
  }
  if (x.motivoSan) return `❌ ${quien}: ${x.motivoSan.txt.replace(/^./, (c) => c.toLowerCase())}`;
  return `❌ ${x.nombre} cumple sanción ${con(x.equipo)}`;
}

/** los tweets a partir de los datos ya calculados (aparte para probarlo sin red: bot/prueba/sancionados-ejemplo.mjs) */
export function escribir({ jornada, sancionados = [], apercibidos = [] }) {
  const out = [];
  // sancionados: un tweet con todos los que caben; si no caben, los que sobran van en otro
  let resto = [...sancionados].sort((a, b) => b.media - a.media || b.valor - a.valor);
  while (resto.length && out.length < 2) {
    let hecho = null;
    for (let n = Math.min(resto.length, 5); n >= 1 && !hecho; n--) {
      const xs = resto.slice(0, n);
      const cab = n === 1 ? `🟥 ${xs[0].nombre} se pierde la jornada ${jornada} por sanción` : `🟥 ${mayus(enLetra(n))} sancionados para la jornada ${jornada}`;
      const lineas = xs.map(lineaSancion);
      const top = elQueMasPesa(xs);
      const etiqueta = `❌ ${n === 1 ? 'Baja' : 'Bajas'} Fantasy para la jornada ${jornada}`;
      const r = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), top && { t: top.t, prio: 5 }, { t: etiqueta, prio: 9 }]);
      if (![...lineas, etiqueta].every((l) => r.usadas.includes(l))) continue;
      const clave = `sancionados|${jornada}|${xs.map((x) => x.id).join('-')}`;
      const numeros = [jornada, ...xs.flatMap((x) => (x.motivoSan ? x.motivoSan.numeros : [])), ...(top ? top.numeros : [])];
      hecho = { tipo: 'sancionados', clave, jornada, texto: r.texto, numeros, tarjeta: tarjetaBajas({ jornada, filas: xs.map((x) => ({ ...x, estado: 'sancionado' })), clave }), n };
    }
    if (!hecho) break;
    out.push(hecho);
    resto = resto.slice(hecho.n);
  }
  // apercibidos: titulares habituales a una amarilla de la sanción
  const ap = [...apercibidos].sort((a, b) => b.media - a.media || b.valor - a.valor);
  for (let n = Math.min(ap.length, 6); n >= 1; n--) {
    const xs = ap.slice(0, n);
    const cab = n === 1 ? `🟨 ${xs[0].nombre}, a una amarilla de la sanción` : `🟨 ${mayus(enLetra(n))} titulares habituales, a una amarilla de la sanción`;
    const nombres = n === 1 ? `👀 Es titular habitual ${con(xs[0].equipo)}` : `👀 ${nombresPorClub(xs)}`;
    const aviso = `⚠️ Si ${n === 1 ? 've' : 'ven'} una amarilla en la jornada ${jornada}, ${n === 1 ? 'se pierde' : 'se pierden'} la ${jornada + 1}`;
    const top = n === 1 ? (xs[0].media >= 3 ? { t: `‼️ Suma ${fmt(xs[0].media)} puntos de media`, numeros: partes(xs[0].media) } : null) : elQueMasPesa(xs);
    const etiqueta = `🟨 Apercibidos Fantasy de la jornada ${jornada}`;
    const r = tweet(cab, [{ t: nombres, prio: 9 }, { t: aviso, prio: 8 }, top && { t: top.t, prio: 5 }, { t: etiqueta, prio: 9 }]);
    if (![nombres, etiqueta].every((l) => r.usadas.includes(l))) continue;
    out.push({ tipo: 'sancionados', clave: `apercibidos|${jornada}|${xs.map((x) => x.id).join('-')}`, jornada, texto: r.texto, numeros: [jornada, jornada + 1, ...(top ? top.numeros : [])] });
    break;
  }
  return out.map(({ n, ...t }) => t);
}

export async function generar({ jugadores, equipos, jornada, stats = [], semana, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), log = console.log,
  pedirSemana = statsSemana, fichaDe = fichaLaLiga, pagina = disciplina }) {
  const ob = await objetivo({ stats, semana, jornada, pedirSemana });
  if (!ob) { log('  (sancionados) la jornada está a medias: espero'); return []; }
  const J = ob.jornada;
  const [hD, hH] = config.horasSancionados || [9, 23];
  const antes = (config.sancionadosAntesHoras ?? 54) * HORA;
  if (ventanas && !forzar) {
    if (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH) { log(`  (sancionados) fuera de horario (${hD} a ${hH} h)`); return []; }
    const falta = ob.primero - ahora;
    if (falta > antes || falta < 2 * HORA) { log(`  (sancionados) jornada ${J}: faltan ${Math.round(falta / HORA)} h para el primer partido; salen cuando falten menos de ${antes / HORA} h`); return []; }
  }
  const cub = registro && registro.cubiertos ? registro.cubiertos() : [];
  const yaSalio = new Set(cub.filter((c) => ((c.tipo === 'caidas' || c.tipo === 'sancionados') && c.jornada === J)
    || (c.tipo === 'novedades' && c.que === 'sancion' && ahora - c.t < 5 * 24 * HORA)).map((c) => String(c.id)));
  const escudos = {};
  for (const m of [...(stats || []), ...(ob.partidos || [])]) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const base = (j) => ({ id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo: corto(equipos[String(j.teamId)] || '?'), club: equipos[String(j.teamId)] || '',
    caraUrl: j.image || null, escudoUrl: escudos[String(j.teamId)] || null, media: Number(j.averagePoints) || 0, valor: Number(j.marketValue) || 0 });

  // sancionados: LaLiga dice quién; la web, el motivo
  const [webSan, webAp] = await Promise.all([pagina('sancionados', { log }), pagina('apercibidos', { log })]);
  const sus = jugadores.filter((j) => j.playerStatus === 'suspended' && j.positionId >= 1 && j.positionId <= 4)
    .filter((j) => { if (!yaSalio.has(String(j.id))) return true; log(`  (sancionados) ${j.nickname} ya ha salido: no lo repito`); return false; });
  const fSus = await enParalelo(sus, 5, (j) => fichaDe(j.id).catch(() => null));
  const sancionados = [];
  sus.forEach((j, i) => {
    const f = fSus[i], b = f ? baseTitular(f.playerStats, J - 1) : null;
    if (!pesa(j, b)) { log(`  (sancionados) ${j.nickname}: no pesa en el fantasy, fuera`); return; }
    const web = webSan.find((w) => casar(w, [j], equipos)) || null;
    sancionados.push({ ...base(j), web, motivoSan: web ? null : motivoSancion(f) });
  });

  // apercibidos: la web los da y la ficha de LaLiga cuenta 4 (o 9, 14…) amarillas
  const cand = [];
  for (const w of webAp) {
    const j = casar(w, jugadores, equipos);
    if (!j) { log(`  (sancionados) apercibido sin casar con LaLiga: ${w.nombre} (${w.equipo})`); continue; }
    if (!['ok', 'doubtful'].includes(j.playerStatus || 'ok')) continue;
    cand.push(j);
  }
  const fAp = await enParalelo(cand, 5, (j) => fichaDe(j.id).catch(() => null));
  const apercibidos = [];
  cand.forEach((j, i) => {
    const am = amarillasDe(fAp[i]);
    if (am == null || am % 5 !== 4) { log(`  (sancionados) ${j.nickname}: LaLiga cuenta ${am} amarillas, no lo doy por apercibido`); return; }
    const b = baseTitular(fAp[i].playerStats, J - 1);
    if (!b || b.p < 0.6) return;
    apercibidos.push(base(j));
  });
  log(`  (sancionados) jornada ${J}: ${sancionados.length} sancionados que pesan, ${apercibidos.length} apercibidos titulares`);
  return escribir({ jornada: J, sancionados, apercibidos });
}
