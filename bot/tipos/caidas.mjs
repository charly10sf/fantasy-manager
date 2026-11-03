// Caídas probables de la jornada que viene: titulares habituales con baja o duda (Carlos, 2 nov 16:16: «es probable que no vaya a jugar»).
// % de titularidad parcial: minutos de las últimas jornadas (peso 0,3) y partidos de más de 60' de la temporada (0,2), sin el once probable
// de futbolfantasy (0,5, aún no portado); doblado a ×0,6 si es duda; 0 si está lesionado o sancionado.
import { corto, elegir, fmt, partes, el, del } from '../lib/texto.mjs';
import { tweet, cap, segunda, enPalabras, proximoPartido, paraLa } from '../lib/redactar.mjs';
import { ficha, ESTADOS } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { tarjetaBajas } from '../lib/datos-tarjetas.mjs';
import { lineasPorEstado, elQueMasPesa, enLetra, mayus } from '../lib/agrupar.mjs';

export function baseTitular(playerStats, hasta) {
  const s = (playerStats || []).filter((x) => x.weekNumber <= hasta && x.stats && x.stats.mins_played).sort((a, b) => a.weekNumber - b.weekNumber);
  if (s.length < 3) return null;
  const min = (x) => Number(x.stats.mins_played[0]) || 0;
  const ult = s.slice(-5);
  const a = ult.filter((x) => min(x) >= 60).length / ult.length;
  const b = s.filter((x) => min(x) >= 60).length / s.length;
  return { p: (0.3 * a + 0.2 * b) / 0.5, ult: ult.length, temporada: s.length };
}

export async function generar({ jugadores, equipos, jornada, ultimaJugada, config, stats = [], semana = null, soloSeguras = false, registro = null, ahora = Date.now(), log = console.log }) {
  // Sin repetir (Carlos, 3 nov 12:06: Lemar salió en novedades a las 11:51 y en caídas a las 11:52): fuera quien ya ha salido en un
  // tweet de caídas de esta jornada o en uno de novedades de las últimas 24 h. Así, además, un grupo publicado no vuelve a salir
  // con otra forma cuando se le suma o se le quita alguien.
  const cub = registro && registro.cubiertos ? registro.cubiertos() : [];
  const yaSalio = new Set(cub.filter((c) => (c.tipo === 'caidas' && c.jornada === jornada) || (c.tipo === 'novedades' && ahora - c.t < 24 * 36e5)).map((c) => String(c.id)));
  // escudos por equipo, de la jornada que hay en memoria (juegan los 20)
  const escudos = {};
  for (const m of stats || []) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const malos = jugadores
    .filter((j) => ESTADOS[j.playerStatus] && j.playerStatus !== 'out_of_league' && j.positionId >= 1 && j.positionId <= 4)
    .filter((j) => { if (!yaSalio.has(String(j.id))) return true; log(`  (caídas) ${j.nickname} ya ha salido: no lo repito`); return false; })
    .sort((a, b) => Number(b.marketValue) - Number(a.marketValue))
    .slice(0, 36);
  const fichas = await enParalelo(malos, 5, (j) => ficha(j.id));
  const caidas = [];
  malos.forEach((j, i) => {
    const f = fichas[i];
    if (!f || f.error) return;
    const b = baseTitular(f.playerStats, ultimaJugada);
    if (!b || b.p < 0.6) return;                      // solo titulares habituales
    // publicando, solo bajas seguras (lesionado o sancionado): una duda necesita una segunda fuente que aún no está
    if (soloSeguras && j.playerStatus === 'doubtful') return;
    const p = j.playerStatus === 'doubtful' ? b.p * 0.6 : 0;
    if (p >= config.umbralCaida) return;
    caidas.push({ id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo: corto(equipos[String(j.teamId)] || '?'), club: equipos[String(j.teamId)] || '', caraUrl: j.image || null, escudoUrl: escudos[String(j.teamId)] || null, estado: ESTADOS[j.playerStatus], p, pct: Math.round(p * 100), media: Number(j.averagePoints) || 0, valor: Number(j.marketValue) || 0 });
  });
  return escribir(caidas, { jornada, semana });
}

/** Los tweets a partir de las caídas ya calculadas (aparte para poder probarlo sin red: bot/prueba/bajas-ejemplo.mjs) */
export async function escribir(caidas, { jornada, semana = null, proximo = proximoPartido }) {
  // Cómo se escriben (guía de estilo del 3 nov y Carlos, 3 nov 12:06: la lista con paréntesis le sonaba a máquina): un equipo con dos
  // o más caídas, en su propio tweet («🚨 El Villarreal se queda sin dos titulares» y una línea por lo que pasa); uno o dos sueltos,
  // un tweet cada uno con la etiqueta final; más sueltos, agrupados por lo que pasa («❌ Se caen por lesión Lemar en el Elche y…»),
  // con la media solo del que más pesa (lib/agrupar.mjs).
  const out = [];
  const pp = new Map();
  for (const c of caidas) if (!pp.has(String(c.teamId))) pp.set(String(c.teamId), await proximo(c.teamId, { jornada, semana }).catch(() => null));
  const seguro = (c) => c.estado !== 'duda';
  const numDe = (c) => [...(c.estado === 'duda' ? [c.pct] : []), ...(c.media >= 3 && c.estado !== 'duda' ? partes(c.media) : [])];
  const porEquipo = new Map();
  for (const c of caidas) { const k = String(c.teamId); if (!porEquipo.has(k)) porEquipo.set(k, []); porEquipo.get(k).push(c); }
  const sueltos = [];
  for (const [k, cs] of porEquipo) {
    if (cs.length < 2) { sueltos.push(...cs); continue; }
    const xs = cs.slice(0, 4);
    const eq = xs[0].equipo, pr = pp.get(k);
    const cab = `🚨 ${cap(el(eq))} ${xs.every(seguro) ? 'se queda sin' : 'puede quedarse sin'} ${enLetra(xs.length)} titulares`;
    const lineas = lineasPorEstado(xs, { club: true });
    const top = elQueMasPesa(xs.filter(seguro));
    const ideas = [...lineas.map((t) => ({ t, prio: 9 })), top && { t: top.t, prio: 5 },
      { t: `${xs.every(seguro) ? '❌ Baja' : '⁉️ Duda'} Fantasy ${paraLa(pr, jornada)}`, prio: 8 }];
    const { usadas, texto } = tweet(cab, ideas);
    if (!lineas.every((l) => usadas.includes(l))) continue;
    const clave = `caidas|${jornada}|${xs.map((c) => c.id).join('-')}`;
    out.push({ tipo: 'caidas', clave, jornada, texto, numeros: [jornada, pr ? pr.jornada : jornada, ...xs.filter((c) => c.estado === 'duda').map((c) => c.pct), ...(top ? top.numeros : [])], tarjeta: tarjetaBajas({ jornada, filas: xs, pp: pr, clave }) });
  }
  if (sueltos.length <= 2) {
    for (const c of sueltos) {
      const pr = pp.get(String(c.teamId));
      const cab = c.estado === 'duda' ? `⁉️ ${c.nombre} es duda en ${el(c.equipo)}` : `🚨 ${c.nombre} se cae del once ${del(c.equipo)}`;
      const ideas = [{ t: `⚠️ Aparece como ${c.estado === 'duda' ? `duda en LaLiga Fantasy y ${enPalabras(c.p)}: ${c.pct} %` : `${c.estado} en LaLiga Fantasy`}`, prio: 8 },
        { t: `‼️ ${cap(segunda(c.pos, c.nombre))} es titular habitual${c.media >= 3 ? ` y suma ${fmt(c.media)} de media` : ''}`, prio: 6 },
        { t: `${c.estado === 'duda' ? '⁉️ Duda' : '❌ Baja'} Fantasy ${paraLa(pr, jornada)}`, prio: 9 }];
      const { usadas, texto } = tweet(cab, ideas);
      if (!usadas.length) continue;
      const clave = `caidas|${jornada}|${c.id}`;
      out.push({ tipo: 'caidas', clave, jornada, texto, numeros: [jornada, pr ? pr.jornada : jornada, ...numDe(c)], tarjeta: tarjetaBajas({ jornada, filas: [c], pp: pr, clave }) });
    }
    return out;
  }
  // más de dos sueltos: en lista, llenando cada tweet con todos los que caben (por orden de valor)
  let i = 0, k = 0;
  while (i < sueltos.length && out.length < 12) {
    const resto = sueltos.slice(i, i + 6);
    let n = resto.length, texto = null, top = null;
    for (; n >= 1; n--) {
      const xs = resto.slice(0, n);
      const quien = `${enLetra(n)} ${n === 1 ? 'titular habitual' : 'titulares habituales'} ${xs.every(seguro) ? (n === 1 ? 'se cae' : 'se caen') : (n === 1 ? 'puede caerse' : 'pueden caerse')}`;
      const cab = elegir([`🚨 ${mayus(quien)} para la jornada ${jornada}`, `🚨 Ojo a tu once fantasy: ${quien} para la jornada ${jornada}`], `caidas${jornada}${k}`);
      const lineas = lineasPorEstado(xs);
      top = elQueMasPesa(xs.filter(seguro));
      const r = tweet(cab, [...lineas.map((t) => ({ t, prio: 9 })), top && { t: top.t, prio: 4 }, { t: `${xs.every(seguro) ? '❌ Bajas' : '⁉️ Bajas y dudas'} Fantasy para la jornada ${jornada}`, prio: 8 }]);
      if (lineas.every((l) => r.usadas.includes(l))) { texto = r.texto; break; }
    }
    if (!texto) break;
    const quienes = resto.slice(0, n);
    const clave = `caidas|${jornada}|${quienes.map((c) => c.id).join('-')}`;
    out.push({ tipo: 'caidas', clave, jornada, texto, numeros: [jornada, ...quienes.flatMap((c) => (c.estado === 'duda' ? [c.pct] : [])), ...(top ? top.numeros : [])], tarjeta: tarjetaBajas({ jornada, filas: quienes, pp: quienes.every((c) => String(c.teamId) === String(quienes[0].teamId)) ? pp.get(String(quienes[0].teamId)) : null, clave }) });
    i += n; k++;
  }
  return out;
}
