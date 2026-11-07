// Medida de las fuentes del directo (Carlos, 7 nov, 22:43: «un par de jornadas apunta en el log cuándo ve cada fuente cada gol, para medir
// retraso y fiabilidad desde Actions»). Cada ejecución apunta, de cada gol, la PRIMERA vez que lo ve ESPN y la primera que lo ve FotMob
// (en `registro.datos.medidaFuentes`, que va a la rama bot-estado) y además lo deja en el log con la etiqueta «(medida)». El bot corre
// cada 5 min, así que la resolución es de una ejecución: dice quién lo ve antes y por cuántas vueltas, no los segundos. Para afinar
// guarda también el reloj de cada fuente en ese momento (`reloj` de ESPN y de FotMob) y la hora de la jugada que da ESPN (`wallclock`).
// Los números salen con `node bot/prueba/medida-fuentes.mjs <registro.json>`. Aquí solo hay minutos y nombres que ya salen en los tuits.

const MAX = 150;

const iso = (t) => new Date(t).toISOString();
/** `clave`: la del gol (directo|id|jugador|gol1) o la de uno que solo ha visto FotMob (fm|id|idJugador|min).
    `vio`: { espn, fotmob } quién lo ve ahora; `reloj`: { espn, fotmob } el reloj del partido en cada fuente; devuelve { ficha, nuevo }
    (nuevo: esta ejecución ha apuntado algo que no estaba) */
export function apuntarVista(registro, clave, { jugador = '', minuto = '', vio = {}, reloj = {}, espnWall = null, ahora = Date.now() } = {}) {
  if (!registro || !registro.datos) return { ficha: null, nuevo: false };
  const tabla = (registro.datos.medidaFuentes ||= {});
  const f = (tabla[clave] ||= { j: jugador, m: minuto });
  const antes = JSON.stringify(f);
  if (jugador && !f.j) f.j = jugador;
  if (vio.espn && !f.e) { f.e = iso(ahora); if (reloj.espn) f.re = reloj.espn; if (espnWall) f.w = espnWall; }
  if (vio.fotmob && !f.f) { f.f = iso(ahora); if (reloj.fotmob) f.rf = reloj.fotmob; }
  const claves = Object.keys(tabla);
  if (claves.length > MAX) for (const k of claves.slice(0, claves.length - MAX)) delete tabla[k];
  return { ficha: f, nuevo: JSON.stringify(f) !== antes };
}

/** ¿ya se sabe cuándo lo ven las dos fuentes? */
export const completa = (f) => !!(f && f.e && f.f);

/** una línea para el log de Actions */
export function lineaMedida(partido, f) {
  if (!f) return '';
  const dif = f.e && f.f ? Math.round((Date.parse(f.f) - Date.parse(f.e)) / 6e4) : null;
  const quien = f.e && f.f ? (dif === 0 ? 'las dos en la misma vuelta' : dif < 0 ? `FotMob ${-dif} min antes` : `ESPN ${dif} min antes`) : f.e ? 'solo ESPN, FotMob aún no' : 'solo FotMob, ESPN aún no';
  return `  (medida) ${partido} ${f.j} ${f.m}: ${quien} · ESPN ${f.e ? f.e.slice(11, 19) + 'Z' : '—'}${f.re ? ` (reloj ${f.re})` : ''}${f.w ? ` [jugada ${f.w.slice(11, 19)}Z]` : ''} · FotMob ${f.f ? f.f.slice(11, 19) + 'Z' : '—'}${f.rf ? ` (reloj ${f.rf})` : ''}`;
}

/** apunta cómo ha ido la ejecución con FotMob (peticiones bien y mal, tiempo medio) en `registro.datos.fuentesSalud.fotmob` */
export function apuntarSalud(registro, salud, ahora = Date.now()) {
  if (!registro || !registro.datos || !salud || !(salud.ok || salud.fallos)) return;
  const t = ((registro.datos.fuentesSalud ||= {}).fotmob ||= { ok: 0, fallos: 0, ejecuciones: 0, ejecucionesConFallo: 0, desde: iso(ahora), mediaMs: 0 });
  const n0 = t.ok;
  t.ok += salud.ok; t.fallos += salud.fallos; t.ejecuciones++;
  if (salud.fallos) { t.ejecucionesConFallo++; t.ultimoFallo = salud.ultimoFallo; }
  if (salud.ok) t.mediaMs = Math.round(((t.mediaMs * n0) + salud.mediaMs * salud.ok) / t.ok);
  t.ultima = iso(ahora);
}

const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** los números: cuántos goles ve cada fuente, quién antes y la salud de FotMob desde Actions */
export function resumenMedidas(datos) {
  const fichas = Object.entries((datos && datos.medidaFuentes) || {}).filter(([k]) => k.startsWith('directo|'));
  const r = { goles: fichas.length, soloEspn: 0, soloFotmob: 0, ambas: 0, fotmobAntes: 0, mismaVuelta: 0, espnAntes: 0, difMin: [], espnTrasJugadaMin: [] };
  for (const [, f] of fichas) {
    if (f.e && f.f) {
      r.ambas++;
      const d = Math.round((Date.parse(f.f) - Date.parse(f.e)) / 6e4);
      r.difMin.push(d);
      if (d < 0) r.fotmobAntes++; else if (d === 0) r.mismaVuelta++; else r.espnAntes++;
    } else if (f.e) r.soloEspn++;
    else if (f.f) r.soloFotmob++;
    if (f.e && f.w) r.espnTrasJugadaMin.push((Date.parse(f.e) - Date.parse(f.w)) / 6e4);
  }
  // los goles que solo vio FotMob (fm|…) y que ESPN nunca tuvo
  r.fotmobSinEspn = Object.entries((datos && datos.medidaFuentes) || {}).filter(([k, f]) => k.startsWith('fm|') && f.f && !f.casado).length;
  r.medianaDifMin = mediana(r.difMin);
  r.medianaEspnTrasJugadaMin = mediana(r.espnTrasJugadaMin);
  r.salud = (datos && datos.fuentesSalud && datos.fuentesSalud.fotmob) || null;
  return r;
}
