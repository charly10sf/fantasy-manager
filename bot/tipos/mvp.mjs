// MVP de cada partido acabado: un tweet aparte con la tarjeta de jugador. Solo existe con la tarjeta de jugador encendida
// (config.tarjetas.jugador): sin imagen repetiría lo que ya dice el tweet del final, así que ejecutar.mjs no lo publica sin ella.
import { cierre, quepa, armar, corto, elegir, fmt, partes } from '../lib/texto.mjs';

export async function generar({ stats, jornada, jugadores, config, desdeFinal = 0, forzarTarjetas = false }) {
  if (!(config.tarjetas && config.tarjetas.jugador) && !forzarTarjetas) return [];
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  for (const m of stats.filter((x) => x.matchState === 7 && Date.parse(x.date) >= desdeFinal)) {
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
    const lineas = [elegir([`${nombre} (${equipo}) se sale: ${pts} puntos.`, `${nombre} (${equipo}) se lleva la jornada con ${pts} puntos.`, `${pts} puntos para ${nombre} (${equipo}).`], `mvpt${m.id}`)];
    if (otro) lineas.push(`Empata con él ${otro.p.nickname || otro.p.name} (${corto(otro.eq.mainName)}).`);
    lineas.push(`Lleva ${j.points} puntos en la temporada, con ${fmt(j.averagePoints)} de media.`);
    num.push(Number(j.points), ...partes(j.averagePoints));
    const pie = cierre(`mvp${m.id}`);
    const usadas = quepa(cab, lineas, pie, config.tweetMax);
    if (!usadas.length) continue;
    out.push({ tipo: 'mvp', clave: `mvp|${m.id}`, jornada, texto: armar(cab, usadas, pie), numeros: num, partido: m.id, jugadorId: p.id, motivo: 'mvp', soloConImagen: true });
  }
  return out;
}
