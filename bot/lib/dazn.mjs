// Los puntos DAZN (la valoración de 0 a 4 que LaLiga Fantasy da a cada jugador) llegan un rato DESPUÉS del final del partido: hasta
// entonces los puntos de stats/week/{n} van cortos (Mario Soriano salió con 9 en el tuit y eran 13). Un tweet o una tarjeta con los
// puntos de un partido acabado solo sale cuando están. Se mira en la ficha de los que más puntúan del partido (player/{id}, stats de
// la jornada, `marca_points: [-1, puntos]`): los mejores sacan 3 o 4 de valoración, así que si la mayoría ya la tiene, el partido
// está repartido. Si pasan `esperaHoras` desde el saque sin verla, se da por listo (mejor un tweet tarde que ninguno).
const TOP = 6, MINIMO = 3;

/** puntos de valoración de un jugador en la jornada, o null si la ficha aún no los trae */
export function puntosValoracion(ficha, jornada) {
  const s = ((ficha && ficha.playerStats) || []).find((x) => Number(x.weekNumber) === Number(jornada));
  const mp = s && s.stats && s.stats.marca_points;
  return Array.isArray(mp) && Number.isFinite(Number(mp[1])) ? Number(mp[1]) : null;
}

/** Devuelve una función (partido de stats/week) => { listo, con, de, porPlazo }. Guarda el resultado de cada partido listo. */
export function crearDazn({ ficha, jornada, esperaHoras = 6, ahora = () => Date.now(), log = () => {} }) {
  const listos = new Map();
  return async (m) => {
    if (listos.has(m.id)) return listos.get(m.id);
    const jugadores = [...(m.local.players || []), ...(m.visitor.players || [])].filter((p) => p.weekPoints != null)
      .sort((a, b) => Number(b.weekPoints) - Number(a.weekPoints) || Number(a.id) - Number(b.id)).slice(0, TOP);
    let con = 0;
    for (const p of jugadores) {
      const v = puntosValoracion(await ficha(p.id).catch(() => null), jornada);
      if (v != null && v > 0) con++;
    }
    const hace = jugadores.length ? Math.min(MINIMO, Math.ceil(jugadores.length / 2)) : 0;
    const porPlazo = ahora() - Date.parse(m.date) > esperaHoras * 3600e3;
    const r = { listo: con >= hace && hace > 0 ? true : porPlazo, con, de: jugadores.length, porPlazo: porPlazo && !(con >= hace && hace > 0) };
    log(`  (DAZN) partido ${m.id}: ${con} de ${jugadores.length} con valoración${r.listo ? (r.porPlazo ? ` · paso de esperar (más de ${esperaHoras} h desde el saque)` : ' · listo') : ' · espero a los puntos DAZN'}`);
    if (r.listo) listos.set(m.id, r);
    return r;
  };
}
