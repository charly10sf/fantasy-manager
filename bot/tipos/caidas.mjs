// Caídas probables de la jornada que viene: titulares habituales con baja o duda (Carlos, 2 nov 16:16: «es probable que no vaya a jugar»).
// % de titularidad parcial: minutos de las últimas jornadas (peso 0,3) y partidos de más de 60' de la temporada (0,2), sin el once probable
// de futbolfantasy (0,5, aún no portado); doblado a ×0,6 si es duda; 0 si está lesionado o sancionado.
import { corto, elegir, fmt, partes, el, del } from '../lib/texto.mjs';
import { tweet, cap, segunda, enPalabras, proximoPartido, paraLa } from '../lib/redactar.mjs';
import { ficha, ESTADOS } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';

export function baseTitular(playerStats, hasta) {
  const s = (playerStats || []).filter((x) => x.weekNumber <= hasta && x.stats && x.stats.mins_played).sort((a, b) => a.weekNumber - b.weekNumber);
  if (s.length < 3) return null;
  const min = (x) => Number(x.stats.mins_played[0]) || 0;
  const ult = s.slice(-5);
  const a = ult.filter((x) => min(x) >= 60).length / ult.length;
  const b = s.filter((x) => min(x) >= 60).length / s.length;
  return { p: (0.3 * a + 0.2 * b) / 0.5, ult: ult.length, temporada: s.length };
}

export async function generar({ jugadores, equipos, jornada, ultimaJugada, config, semana = null, soloSeguras = false }) {
  const malos = jugadores
    .filter((j) => ESTADOS[j.playerStatus] && j.playerStatus !== 'out_of_league' && j.positionId >= 1 && j.positionId <= 4)
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
    caidas.push({ id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo: corto(equipos[String(j.teamId)] || '?'), estado: ESTADOS[j.playerStatus], p, pct: Math.round(p * 100), media: Number(j.averagePoints) || 0 });
  });
  // Cómo se escriben (guía de estilo del 3 nov, el formato de @JoseCarrasco_98): un equipo con dos o más caídas, en su propio tweet
  // («🚨 El Villarreal puede perder a…» y una línea por jugador); uno o dos sueltos, un tweet cada uno con la etiqueta final
  // («❌ Baja Fantasy para la jornada 12 contra el Valencia»); más sueltos, en una lista.
  const out = [];
  const pp = new Map();
  for (const c of caidas) if (!pp.has(String(c.teamId))) pp.set(String(c.teamId), await proximoPartido(c.teamId, { jornada, semana }).catch(() => null));
  const seguro = (c) => c.estado !== 'duda';
  const estadoTxt = (c) => (c.estado === 'duda' ? `duda: ${c.pct} % de titularidad` : c.estado);
  const icono = (c) => (c.estado === 'sancionado' ? '🟥' : c.estado === 'duda' ? '⁉️' : '❌');
  const conMedia = (c) => (c.media >= 3 && c.estado !== 'duda' ? ` (${fmt(c.media)} de media)` : '');
  const numDe = (c) => [...(c.estado === 'duda' ? [c.pct] : []), ...(c.media >= 3 && c.estado !== 'duda' ? partes(c.media) : [])];
  const porEquipo = new Map();
  for (const c of caidas) { const k = String(c.teamId); if (!porEquipo.has(k)) porEquipo.set(k, []); porEquipo.get(k).push(c); }
  const sueltos = [];
  for (const [k, cs] of porEquipo) {
    if (cs.length < 2) { sueltos.push(...cs); continue; }
    const xs = cs.slice(0, 4);
    const eq = xs[0].equipo, pr = pp.get(k);
    const nombres = xs.length === 2 ? `${xs[0].nombre} y ${xs[1].nombre}` : `${xs.slice(0, -1).map((c) => c.nombre).join(', ')} y ${xs[xs.length - 1].nombre}`;
    const cab = `🚨 ${cap(el(eq))} ${xs.every(seguro) ? 'pierde' : 'puede perder'} a ${nombres}`;
    const ideas = [{ t: xs.map((c) => `${icono(c)} ${c.nombre}, ${estadoTxt(c)}${conMedia(c)}`).join('\n'), prio: 9 },
      { t: `‼️ ${xs.length === 2 ? 'Los dos son' : 'Todos son'} titulares habituales`, prio: 5 },
      { t: `${xs.every(seguro) ? '❌ Baja' : '⁉️ Duda'} Fantasy ${paraLa(pr, jornada)}`, prio: 8 }];
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) continue;
    out.push({ tipo: 'caidas', clave: `caidas|${jornada}|${xs.map((c) => c.id).join('-')}`, jornada, texto, numeros: [jornada, pr ? pr.jornada : jornada, ...xs.flatMap(numDe)] });
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
      out.push({ tipo: 'caidas', clave: `caidas|${jornada}|${c.id}`, jornada, texto, numeros: [jornada, pr ? pr.jornada : jornada, ...numDe(c)] });
    }
    return out;
  }
  // más de dos sueltos: en lista, llenando cada tweet con todos los que caben (por orden de valor)
  let i = 0, k = 0;
  while (i < sueltos.length && out.length < 12) {
    const cab = elegir([`🚨 Bajas fantasy para la jornada ${jornada}`, `🚨 Ojo a tu once fantasy: caídas para la jornada ${jornada}`, `🚨 Los que se caen del once para la jornada ${jornada} de LaLiga Fantasy`], `caidas${jornada}${k}`);
    const resto = sueltos.slice(i, i + 6);
    let n = resto.length, texto = null;
    for (; n >= 1; n--) {
      const ideas = [resto.slice(0, n).map((c) => `${icono(c)} ${c.nombre} (${c.equipo}), ${estadoTxt(c)}`).join('\n'), { t: `‼️ ${n > 1 ? 'Todos son titulares habituales' : 'Es titular habitual'}: revisa tu alineación`, prio: 5 }];
      const r = tweet(cab, ideas);
      if (r.usadas.length) { texto = r.texto; break; }
    }
    if (!texto) break;
    const quienes = resto.slice(0, n);
    out.push({ tipo: 'caidas', clave: `caidas|${jornada}|${quienes.map((c) => c.id).join('-')}`, jornada, texto, numeros: [jornada, ...quienes.flatMap((c) => (c.estado === 'duda' ? [c.pct] : []))] });
    i += n; k++;
  }
  return out;
}
