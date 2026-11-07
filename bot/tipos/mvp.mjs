// MVP de cada partido acabado: un tweet aparte con la tarjeta de jugador. Solo existe con la tarjeta de jugador encendida
// (config.tarjetas.jugador): sin imagen repetiría lo que ya dice el tweet del final, así que ejecutar.mjs no lo publica sin ella.
import { corto, fmt, partes, del, el, largo, rotar, ordenJornada, dineroTxt } from '../lib/texto.mjs';
import { formaMvp, chocaConFinal, relato } from './final.mjs';
import { tweet, segunda, cap, proximoPartido, cuando, puesto } from '../lib/redactar.mjs';
import { clubes as clubesH, estadio as estadioH, frenteMedia, franja } from '../lib/hechos.mjs';
import { incidenciasPartido } from '../lib/relato.mjs';
import { casarJugador } from './directo.mjs';

export async function generar({ stats, jornada, jugadores, config, desdeFinal = 0, forzarTarjetas = false, dazn = null }) {
  if (!(config.tarjetas && config.tarjetas.jugador) && !forzarTarjetas) return [];
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  const K = ordenJornada(stats);
  for (const m of stats.filter((x) => x.matchState === 7 && Date.parse(x.date) >= desdeFinal)) {
    if (dazn && !(await dazn(m)).listo) continue;   // aún sin los puntos DAZN
    const ps = [m.local, m.visitor].flatMap((l) => (l.players || []).filter((p) => p.weekPoints != null).map((p) => ({ p, eq: l })));
    if (ps.length < 10) continue;
    ps.sort((a, b) => Number(b.p.weekPoints) - Number(a.p.weekPoints) || Number(a.p.id) - Number(b.p.id));
    const { p, eq } = ps[0];
    const j = porId.get(String(p.id));
    if (!j || Number(p.weekPoints) <= 0) continue;
    const otro = ps[1] && Number(ps[1].p.weekPoints) === Number(p.weekPoints) ? ps[1] : null;
    const nombre = p.nickname || p.name, equipo = corto(eq.mainName), pts = Number(p.weekPoints);
    const marcador = `${corto(m.local.mainName)} ${m.localScore}-${m.visitorScore} ${corto(m.visitor.mainName)}`;
    const cab = `⭐ MVP fantasy del ${marcador}`;
    const num = [jornada, m.localScore, m.visitorScore, pts];
    // el partido ya está arriba: sin el equipo entre paréntesis; la segunda vez, por su puesto (guía de estilo del 3 nov)
    // la forma del final del mismo partido (tipos/final.mjs, semilla `mvp${id}`: «el mejor fantasy», «se va a», «N puntos para») no se repite
    // aquí: los dos tweets salen seguidos (auditoría del 5 nov: «Cabrera se va a 16 puntos fantasy» y, justo después, «Cabrera se va a 16 puntos»)
    // como en el final, cada forma rota por el orden del partido en la jornada (los MVP salen casi seguidos)
    const k = Math.max(0, K.indexOf(String(m.id)));
    const R = (fs, slot) => rotar(fs, `${slot}${jornada}`, k);
    const formas = [`🔥 ${nombre} se va a ${pts} puntos`, `🔥 ${pts} puntos para ${nombre}`, `🔥 ${nombre} se lleva el partido con ${pts} puntos`, `🔥 Nadie saca más que ${nombre}: ${pts} puntos`];
    // la forma (`formaMvp` en tipos/final.mjs): ni la del MVP de antes ni la que choca con su final o con el siguiente. Con un empate
    // arriba, ni «se lleva el partido» ni «nadie saca más» («Fermín se lleva el partido con 19. Empata con él Lamine Yamal»)
    let f = formaMvp(jornada, k);
    if (otro && f >= 2) { const antes = k ? formaMvp(jornada, k - 1) : -1, no = chocaConFinal(jornada, k); f = [0, 1].find((x) => x !== no && x !== antes) ?? [0, 1].find((x) => x !== no); }
    const ideas = [{ t: formas[f], prio: 9 }];
    if (otro) ideas.push({ t: `🤝 Empata con él ${otro.p.nickname || otro.p.name}`, prio: 7 });
    // si el final ya dijo su media («Su media es de 4,7…», cuando dobla), aquí solo los puntos de la temporada
    const mediaR = Math.round(Number(j.averagePoints) * 10) / 10, yaMedia = !otro && mediaR >= 3 && pts > 2 * mediaR;
    const seg = `${cap(segunda(j.positionId, nombre))} ${del(equipo)}`;
    // (también con 280: con una sola forma, la segunda frase de los diez MVP era la misma)
    ideas.push({ t: R(yaMedia ? [`📊 ${seg} lleva ${j.points} puntos en la temporada`, `📊 En lo que va de temporada suma ${j.points} puntos`, `📊 Con esto llega a ${j.points} puntos en la temporada`]
      : [`📊 ${seg} lleva ${j.points} puntos en la temporada y ${fmt(j.averagePoints)} de media`,
        `📊 En lo que va de temporada suma ${j.points} puntos, a ${fmt(j.averagePoints)} por partido`, `📊 Con esto llega a ${j.points} puntos en la temporada y una media de ${fmt(j.averagePoints)}`], 'mvps'), prio: 6 });
    num.push(Number(j.points), ...partes(j.averagePoints));
    // con tweets largos (X Premium): lo que vale y cuándo vuelve a jugar, cada MVP contado a su manera. Lo de «más del doble de su media»
    // ya lo dice el tweet del final, que sale justo antes: aquí no se repite
    let proximoH = null, valorH = null;
    if (largo()) {
      const valor = Number(j.marketValue) || 0;
      const dv = dineroTxt(valor);
      const pp = await proximoPartido(eq.id, { jornada: jornada + 1 }).catch(() => null);
      const c = pp && pp.fecha ? cuando(pp.fecha) : null;
      const cuandoTxt = pp ? (c ? c.t : `en la jornada ${pp.jornada}`) : null;
      if (pp) num.push(...(c ? c.numeros : [pp.jornada]));
      if (valor > 0) num.push(...dv.numeros);
      const t = valor > 0 && pp ? R([`💸 Vale ${dv.t} en el mercado y vuelve a jugar ${cuandoTxt}, contra ${el(pp.rival)}`,
        `💸 En el mercado está a ${dv.t}. Su próximo partido, ${cuandoTxt} ante ${el(pp.rival)}`,
        `🗓️ El siguiente, ${cuandoTxt} contra ${el(pp.rival)}. Ahora mismo vale ${dv.t}`], 'mvpl')
        : valor > 0 ? `💸 Vale ${dv.t} en el mercado` : pp ? `🗓️ Vuelve a jugar ${cuandoTxt}, contra ${el(pp.rival)}` : null;
      if (t) ideas.push({ t, prio: 2 });
      if (pp) proximoH = { club: pp.rival, rival: el(pp.rival), ...(pp.enCasa != null ? { juega: pp.enCasa ? 'en casa' : 'fuera' } : {}), ...(c ? { cuando: c.t } : { jornada: pp.jornada }) };
      if (valor > 0) valorH = dv.t;
    }
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) continue;
    // MVP compartido (Carlos, 7 nov 21:28: «debería hablar de los 2»): el otro, con los mismos datos que el primero
    let otroH = null;
    if (otro) {
      const jo = porId.get(String(otro.p.id)) || {};
      const mediaO = Math.round(Number(jo.averagePoints) * 10) / 10;
      let valorO = null, proximoO = null;
      if (largo()) {
        const vo = Number(jo.marketValue) || 0;
        if (vo > 0) { const dvo = dineroTxt(vo); valorO = dvo.t; num.push(...dvo.numeros); }
        const ppo = await proximoPartido(otro.eq.id, { jornada: jornada + 1 }).catch(() => null);
        const co = ppo && ppo.fecha ? cuando(ppo.fecha) : null;
        if (ppo) { num.push(...(co ? co.numeros : [ppo.jornada])); proximoO = { rival: el(ppo.rival), ...(ppo.enCasa != null ? { juega: ppo.enCasa ? 'en casa' : 'fuera' } : {}), ...(co ? { cuando: co.t } : { jornada: ppo.jornada }) }; }
      }
      if (jo.points != null) num.push(Number(jo.points));
      if (mediaO >= 1) num.push(...partes(jo.averagePoints));
      otroH = { nombre: otro.p.nickname || otro.p.name, puesto: puesto(otro.p.positionId || jo.positionId) || undefined, club: corto(otro.eq.mainName),
        papel: 'MVP compartido: empata con el otro como el que más puntos ha sacado del partido', puntosHoy: pts, ...(jo.points != null ? { puntosTemporada: Number(jo.points) } : {}),
        ...(mediaO >= 1 ? { mediaPuntos: fmt(jo.averagePoints), hoyFrenteASuMedia: frenteMedia(pts, jo.averagePoints) } : {}),
        ...(valorO ? { valorMercado: valorO } : {}), ...(proximoO ? { proximoPartido: proximoO } : {}), principal: true };
    }
    // los hechos para la IA que redacta (lib/redaccion.mjs). El tuit del final del mismo partido sale justo antes: no tiene que repetirlo
    const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
    // los sucesos comprobados del partido (penaltis parados o fallados, rojas): si el MVP es un portero que para un penalti, sale de aquí
    const incidencias = await incidenciasPartido(m, (n, lado, o) => casarJugador(n, lado === 'local' ? m.local : m.visitor, o));
    // y los goles (7 nov: sin ellos escribía «marcó en el Coliseum» o «decidió el 2-1» sin dato, y el revisor lo tiraba)
    const goles = await relato(m, `mvp${jornada}`).then((r) => (r && r.goles) || []).catch(() => []);
    const hechos = { tipo: 'mvp', jornada, partido: { partido: `${L}-${V}`, local: L, visitante: V, ...estadioH(L), marcador: `${m.localScore}-${m.visitorScore}`, ...(franja(m.date) ? { horario: franja(m.date) } : {}), fecha: m.date || null },
      alcance: 'datos de este partido y de este jugador: del resto de la jornada no se sabe nada',
      goles, ...(incidencias.length ? { incidencias } : {}),
      nota: otro ? 'el tuit del final de este partido acaba de salir. MVP COMPARTIDO: los dos han sacado los mismos puntos y el tuit habla de los dos por igual, con lo de cada uno (qué hizo, su media, su valor, su próximo partido si viene) y lo que significa para quien tenga a uno u otro; ninguno es el principal ni el otro un añadido del final'
        : 'el tuit del final de este partido acaba de salir: este va del mejor jugador y de lo que significa para el mánager',
      jugadores: [{ nombre, puesto: puesto(j.positionId) || undefined, club: equipo, papel: otro ? 'MVP compartido: empata con el otro como el que más puntos ha sacado del partido' : 'el que más puntos ha sacado del partido (de los dos equipos)',
        puntosHoy: pts, puntosTemporada: Number(j.points) || 0,
        ...(mediaR >= 1 ? { mediaPuntos: fmt(j.averagePoints), hoyFrenteASuMedia: frenteMedia(pts, j.averagePoints) } : {}),
        ...(valorH ? { valorMercado: valorH } : {}), ...(proximoH ? { proximoPartido: proximoH } : {}), principal: true },
        ...(otroH ? [otroH] : [])],
      clubes: clubesH(L, V, proximoH ? proximoH.club : null), etiqueta: '' };
    if (proximoH) delete proximoH.club;
    out.push({ tipo: 'mvp', clave: `mvp|${m.id}`, jornada, texto, hechos, numeros: num, partido: m.id, jugadorId: p.id, ...(otro && porId.get(String(otro.p.id)) ? { jugadorId2: otro.p.id } : {}), motivo: 'mvp', soloConImagen: true });
  }
  return out;
}
