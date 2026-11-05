// Sancionados y apercibidos de la jornada que viene (cola de Carlos, 3 nov 20:17; plan de bot-x.md: «Mié y jue, tope 2 por jornada;
// apercibidos solo si son titulares habituales»). Dos tweets por jornada como mucho:
//   - sancionados: los que LaLiga da por sancionados (playerStatus) y pesan en el fantasy, con el motivo de la web de previas
//     (roja directa, quinta amarilla o «3/4» de una sanción larga) o, si no casa, el de su ficha de LaLiga (`motivoSancion`);
//   - apercibidos: con cuatro amarillas, una más y se pierden la jornada siguiente. Dos fuentes: la web los da y la ficha de LaLiga
//     cuenta 4, 9, 14… amarillas. Solo titulares habituales que no estén ya de baja.
// Sin repetir: fuera quien ya ha salido sancionado en caídas o en este tipo en la misma jornada, o en novedades en los 5 días de antes.
// Sale entre las horas de `horasSancionados` y cuando falten menos de `sancionadosAntesHoras` para el primer partido de la jornada
// (con la jornada de viernes, desde el miércoles por la tarde), nunca con partidos de la anterior a medias.
import { corto, fmt, partes, el, largo } from '../lib/texto.mjs';
import { tweet, segunda, proximoPartido, paraLa, cap, aparte } from '../lib/redactar.mjs';
import { statsSemana, ficha as fichaLaLiga } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { tarjetaBajas, tarjetaApercibidos } from '../lib/datos-tarjetas.mjs';
import { planApercibidos } from '../lib/tarjetas.mjs';
import { motivoSancion } from '../lib/partes.mjs';
import { elQueMasPesa, enLetra, mayus, nombresPorClub, pesos, porClub, lista } from '../lib/agrupar.mjs';
import { disciplina, casar, amarillasDe } from '../lib/disciplina.mjs';
import { baseTitular } from './caidas.mjs';

import { horaMadrid, horas } from '../lib/horario.mjs';   // entre semana, desde las 7 (lib/horario.mjs)
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
// (solo: el tweet es de él y ya lo nombra la cabecera, así que aquí va por su puesto: «el delantero»)
export function lineaSancion(x, { solo = false } = {}) {
  const w = x.web, n = solo ? cap(segunda(x.pos, x.nombre)) : x.nombre;
  if (w && w.motivo === 'roja') return `❌ ${n} vio la roja directa ${con(x.equipo)}`;
  if (w && w.motivo === 'amarillas') return `❌ ${n} llegó a cinco amarillas ${con(x.equipo)}`;
  if (w && w.motivo === 'disciplinaria' && w.partido && w.de && w.de > 1 && w.de <= 10) {
    if (w.partido === w.de) return `❌ ${n} cumple el último de sus ${enLetra(w.de)} partidos de sanción ${con(x.equipo)}`;
    return `❌ ${n} cumple el ${ORDINAL[w.partido]} de sus ${enLetra(w.de)} partidos de sanción ${con(x.equipo)}`;
  }
  if (x.motivoSan) return `❌ ${n} ${con(x.equipo)}: ${x.motivoSan.txt.replace(/^./, (c) => c.toLowerCase())}`;
  return `❌ ${n} cumple sanción ${con(x.equipo)}`;
}
const mediaDe = (x) => (x.media >= 3 ? { t: `‼️ Suma ${fmt(x.media)} puntos de media`, numeros: partes(x.media) } : null);

/** «el Racing-Real Sociedad» (el partido de un equipo, con el de casa delante) */
const partido = (eq, pr) => `el ${pr.enCasa ? `${eq}-${pr.rival}` : `${pr.rival}-${eq}`}`;

/** los tweets a partir de los datos ya calculados (aparte para probarlo sin red: bot/prueba/sancionados-ejemplo.mjs).
    pp: el próximo partido de cada equipo (la jornada de la sanción); pp2: el de la jornada siguiente (lo que se juegan los apercibidos);
    yaApercibidos: el de apercibidos de esta jornada ya ha salido */
export function escribir({ jornada, sancionados = [], apercibidos = [], pp = {}, pp2 = {}, yaApercibidos = false }) {
  const out = [];
  // con tweets largos (X Premium): contra quién no estará cada sancionado, la media de todos y qué partido se jugaría cada apercibido
  const L = largo();
  const peso = (xs) => { if (!L) return elQueMasPesa(xs); const r = pesos(xs, xs.map((x) => x.id).join('-')); return r && { ...r, t: aparte(r.t) }; };
  // sancionados: un tweet con todos los que caben; si no caben, los que sobran van en otro
  let resto = [...sancionados].sort((a, b) => b.media - a.media || b.valor - a.valor);
  while (resto.length && out.length < 2) {
    let hecho = null;
    for (let n = Math.min(resto.length, 5); n >= 1 && !hecho; n--) {
      const xs = resto.slice(0, n);
      const cab = n === 1 ? `🟥 ${xs[0].nombre} se pierde la jornada ${jornada} por sanción` : `🟥 ${mayus(enLetra(n))} sancionados para la jornada ${jornada}`;
      // (con tweets largos, contra quién no estará cada uno, dicho de otra forma en cada línea: no la misma coletilla en todas)
      const cola = [(r) => ` y se pierde el partido contra ${el(r.rival)}`, (r) => `, así que no estará contra ${el(r.rival)}`, (r) => `: no jugará contra ${el(r.rival)}`,
        (r) => `, por lo que se queda fuera ante ${el(r.rival)}`];
      // (cada línea, la primera forma que aún no ha salido en el tweet; si ya salieron todas, otra que la de la línea anterior. Con
      // `i % 2` para las líneas con «:», la 1.ª y la 3.ª acababan igual; auditoría del 5 nov)
      const usadas = [];
      const lineas = xs.map((x) => { const l = lineaSancion(x, { solo: n === 1 }), r = pp[String(x.teamId)];
        if (!(L && n > 1 && r)) return l;
        const ok = l.includes(':') ? [0, 1, 3] : [0, 1, 2, 3], ult = usadas[usadas.length - 1];
        const f = ok.find((i) => !usadas.includes(i)) ?? ok.find((i) => i !== ult) ?? ok[0];
        usadas.push(f);
        return `${l}${cola[f](r)}`; });
      const top = n === 1 ? mediaDe(xs[0]) : peso(xs);
      const pr = n === 1 ? pp[String(xs[0].teamId)] : null;
      const etiqueta = n === 1 ? `❌ Baja Fantasy ${paraLa(pr, jornada)}` : `❌ Bajas Fantasy para la jornada ${jornada}`;
      const r = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), top && { t: top.t, prio: 5 }, { t: etiqueta, prio: 9 }]);
      if (![...lineas, etiqueta].every((l) => r.usadas.includes(l))) continue;
      const clave = `sancionados|${jornada}|${xs.map((x) => x.id).join('-')}`;
      const numeros = [jornada, ...(pr ? [pr.jornada] : []), ...xs.flatMap((x) => (x.motivoSan ? x.motivoSan.numeros : [])), ...(top ? top.numeros : [])];
      hecho = { tipo: 'sancionados', clave, jornada, texto: r.texto, numeros, tarjeta: tarjetaBajas({ jornada, filas: xs.map((x) => ({ ...x, estado: 'sancionado' })), clave }), n };
    }
    if (!hecho) break;
    out.push(hecho);
    resto = resto.slice(hecho.n);
  }
  // apercibidos: titulares habituales a una amarilla de la sanción. Con dos o más va la tarjeta con todos separados por equipo
  // (Carlos, 5 nov 08:14: el tweet los nombraba a todos seguidos, con sus equipos, y se veía todo junto) y el texto se queda con lo
  // que importa: cuántos son, qué se juegan y los dos que más pesan. Si la tarjeta no sale (no pasa el validador o no se sube), sale el
  // texto de siempre, con los nombres (`sinTarjeta`, en ejecutar.mjs). Uno por jornada: si ya ha salido, no se repite aunque la lista cambie
  if (yaApercibidos) return out.map(({ n, ...t }) => t);
  const ap = [...apercibidos].sort((a, b) => b.media - a.media || b.valor - a.valor);
  let viejo = null;
  for (let n = Math.min(ap.length, 6); n >= 1 && !viejo; n--) viejo = textoApercibidos(ap.slice(0, n), { jornada, pp, pp2, peso, L });
  let nuevo = null;
  for (let n = Math.min(ap.length, MAX_AP_TARJETA); n >= 2 && !nuevo; n--) {
    const xs = ap.slice(0, n), clave = `apercibidos|${jornada}|${xs.map((x) => x.id).join('-')}`;
    const tarjeta = tarjetaApercibidos({ jornada, filas: xs, clave });
    if (!planApercibidos(tarjeta.d.equipos)) continue;
    const r = textoApercibidos(xs, { jornada, pp, pp2, peso, L, conNombres: false });
    if (r) nuevo = { ...r, tarjeta, sinTarjeta: viejo && { texto: viejo.texto, numeros: viejo.numeros } };
  }
  if (nuevo || viejo) out.push(nuevo || viejo);
  return out.map(({ n, ...t }) => t);
}

const MAX_AP_TARJETA = 12;
/** el tweet de unos apercibidos (null si no cabe lo que tiene que ir). conNombres: el de siempre, con todos los nombres por club en
    el texto; sin ellos, para cuando los lleva la tarjeta */
function textoApercibidos(xs, { jornada, pp, pp2, peso, L, conNombres = true }) {
  const n = xs.length;
  const cab = n === 1 ? `🟨 ${xs[0].nombre}, a una amarilla de la sanción` : `🟨 ${mayus(enLetra(n))} titulares habituales, a una amarilla de la sanción`;
  const nombres = n === 1 ? `👀 Es titular habitual ${con(xs[0].equipo)}` : conNombres ? `👀 ${nombresPorClub(xs)}` : null;
  const pr = n === 1 ? pp[String(xs[0].teamId)] : null;
  // (sin la lista de nombres, la cabecera y el aviso van seguidos: «una más» para no decir «amarilla» dos veces en dos frases)
  const aviso = n === 1 && pr ? `⚠️ Si ve una amarilla contra ${el(pr.rival)}, se pierde la jornada ${jornada + 1}`
    : !nombres ? `⚠️ Si ven una más en la jornada ${jornada}, se pierden la ${jornada + 1}`
    : `⚠️ Si ${n === 1 ? 've' : 'ven'} una amarilla en la jornada ${jornada}, ${n === 1 ? 'se pierde' : 'se pierden'} la ${jornada + 1}`;
  const top = n === 1 ? mediaDe(xs[0]) : peso(xs);
  const etiqueta = `🟨 Apercibidos Fantasy de la jornada ${jornada}`;
  // con tweets largos: el partido de la jornada siguiente que se perderían los dos que más pesan (de equipos distintos), contado
  // como lo diría una persona y no como una lista (Carlos, 4 nov 23:39: nada que suene a plantilla)
  let juego = null;
  if (L && n > 1) {
    const dos = [];
    for (const x of xs) if (pp2[String(x.teamId)] && !dos.some((y) => y.teamId === x.teamId) && dos.length < 2) dos.push(x);
    const [a, b] = dos;
    if (a) juego = aparte(`⚠️ Ojo sobre todo con ${a.nombre}, que se perdería ${partido(a.equipo, pp2[String(a.teamId)])}`
      + (b ? `. Y ${b.nombre} se quedaría sin ${partido(b.equipo, pp2[String(b.teamId)])}` : ''));
  }
  // (si va el párrafo de «Ojo sobre todo con…», la media de todos sobra: nombraría otra vez a los mismos)
  const r = tweet(cab, [nombres && { t: nombres, prio: 9 }, { t: aviso, prio: 9 }, juego && { t: juego, prio: 3 }, !juego && top && { t: top.t, prio: 5 }, { t: etiqueta, prio: 9 }]);
  if (![nombres, aviso, etiqueta].filter(Boolean).every((l) => r.usadas.includes(l))) return null;
  return { tipo: 'sancionados', clave: `apercibidos|${jornada}|${xs.map((x) => x.id).join('-')}`, jornada, texto: r.texto, numeros: [jornada, jornada + 1, ...(top && !juego ? top.numeros : [])] };
}

export async function generar({ jugadores, equipos, jornada, stats = [], semana, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), log = console.log,
  pedirSemana = statsSemana, fichaDe = fichaLaLiga, pagina = disciplina, proximo = proximoPartido }) {
  const ob = await objetivo({ stats, semana, jornada, pedirSemana });
  if (!ob) { log('  (sancionados) la jornada está a medias: espero'); return []; }
  const J = ob.jornada;
  const [hD, hH] = horas(config, 'horasSancionados', [9, 23], ahora);
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
  // el rival (solo hace falta cuando el tweet es de uno: «para la jornada 12 contra el Rayo»)
  const pp = {};
  for (const x of [...sancionados, ...apercibidos]) if (!(String(x.teamId) in pp)) pp[String(x.teamId)] = await proximo(x.teamId, { jornada: J, semana, stats: ob.partidos }).catch(() => null);
  // con tweets largos, el partido de la jornada siguiente de cada apercibido (el que se perdería con una amarilla más)
  const pp2 = {};
  if (largo()) for (const x of apercibidos) if (!(String(x.teamId) in pp2)) pp2[String(x.teamId)] = await proximo(x.teamId, { jornada: J + 1 }).catch(() => null);
  // (la clave lleva los ids: si la lista cambia en la semana, la clave nueva no frenaba un segundo tweet de apercibidos)
  const yaApercibidos = !!(registro && registro.claves && [...registro.claves].some((c) => String(c).startsWith(`apercibidos|${J}|`)));
  return escribir({ jornada: J, sancionados, apercibidos, pp, pp2, yaApercibidos });
}
