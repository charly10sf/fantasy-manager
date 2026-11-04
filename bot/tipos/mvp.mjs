// MVP de cada partido acabado: un tweet aparte con la tarjeta de jugador. Solo existe con la tarjeta de jugador encendida
// (config.tarjetas.jugador): sin imagen repetiría lo que ya dice el tweet del final, así que ejecutar.mjs no lo publica sin ella.
import { corto, elegir, fmt, partes, del, el, largo } from '../lib/texto.mjs';
import { tweet, segunda, cap, proximoPartido, cuando } from '../lib/redactar.mjs';

export async function generar({ stats, jornada, jugadores, config, desdeFinal = 0, forzarTarjetas = false, dazn = null }) {
  if (!(config.tarjetas && config.tarjetas.jugador) && !forzarTarjetas) return [];
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
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
    const ideas = [{ t: elegir([`🔥 ${nombre} se va a ${pts} puntos`, `🔥 ${pts} puntos para ${nombre}`, `🔥 ${nombre} se lleva el partido con ${pts} puntos`], `mvpt${m.id}`), prio: 9 }];
    if (otro) ideas.push({ t: `🤝 Empata con él ${otro.p.nickname || otro.p.name}`, prio: 7 });
    ideas.push({ t: largo() ? elegir([`📊 ${cap(segunda(j.positionId, nombre))} ${del(equipo)} lleva ${j.points} puntos en la temporada y ${fmt(j.averagePoints)} de media`,
      `📊 En lo que va de temporada suma ${j.points} puntos, a ${fmt(j.averagePoints)} por partido`, `📊 Con esto llega a ${j.points} puntos en la temporada y una media de ${fmt(j.averagePoints)}`], `mvps${m.id}`)
      : `📊 ${cap(segunda(j.positionId, nombre))} ${del(equipo)} lleva ${j.points} puntos en la temporada y ${fmt(j.averagePoints)} de media`, prio: 6 });
    num.push(Number(j.points), ...partes(j.averagePoints));
    // con tweets largos (X Premium): lo que vale y cuándo vuelve a jugar, cada MVP contado a su manera. Lo de «más del doble de su media»
    // ya lo dice el tweet del final, que sale justo antes: aquí no se repite
    if (largo()) {
      const valor = Number(j.marketValue) || 0;
      const v = valor >= 1e6 ? valor / 1e6 : valor / 1e3, u = valor >= 1e6 ? 'M' : 'K';
      const pp = await proximoPartido(eq.id, { jornada: jornada + 1 }).catch(() => null);
      const c = pp && pp.fecha ? cuando(pp.fecha) : null;
      const cuandoTxt = pp ? (c ? c.t : `en la jornada ${pp.jornada}`) : null;
      if (pp) num.push(...(c ? c.numeros : [pp.jornada]));
      if (valor > 0) num.push(...partes(v));
      const t = valor > 0 && pp ? elegir([`💸 Vale ${fmt(v)} ${u} en el mercado y vuelve a jugar ${cuandoTxt}, contra ${el(pp.rival)}`,
        `💸 En el mercado está a ${fmt(v)} ${u}. Su próximo partido, ${cuandoTxt} ante ${el(pp.rival)}`,
        `🗓️ El siguiente, ${cuandoTxt} contra ${el(pp.rival)}. Por si alguien se lo piensa: vale ${fmt(v)} ${u}`], `mvpl${m.id}`)
        : valor > 0 ? `💸 Vale ${fmt(v)} ${u} en el mercado` : pp ? `🗓️ Vuelve a jugar ${cuandoTxt}, contra ${el(pp.rival)}` : null;
      if (t) ideas.push({ t, prio: 2 });
    }
    const { usadas, texto } = tweet(cab, ideas);
    if (!usadas.length) continue;
    out.push({ tipo: 'mvp', clave: `mvp|${m.id}`, jornada, texto, numeros: num, partido: m.id, jugadorId: p.id, motivo: 'mvp', soloConImagen: true });
  }
  return out;
}
