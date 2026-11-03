// Mercado de cada noche (Carlos, 2 nov 23:11): tras la actualización de valores (hacia las 00:15), dos tweets, los 3 jugadores que
// más suben y los 3 que más bajan respecto al día anterior. Sale de /player/{id}/market-value (un punto por día, fechado a las 00:00
// de Madrid): el último punto es el de hoy. Los dos tweets llevan el cierre de «Fantasy Manager · enlace en la bio».
import { valorMercado } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { cierre, quepa, armar, corto, elegir, fmt, partes } from '../lib/texto.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const puntos = (h) => (Array.isArray(h) ? h : []).map((v) => ({ t: Date.parse(v.date), v: Number(v.marketValue) })).filter((x) => x.t && x.v > 0).sort((a, b) => a.t - b.t);
/** 1 234 567 -> «1,2 M»; por debajo del millón, en miles: «640 K» */
const dinero = (x) => (x >= 1e6 ? `${fmt(x / 1e6)} M` : `${Math.round(x / 1e3)} K`);
const numDinero = (x) => (x >= 1e6 ? partes(x / 1e6) : [Math.round(x / 1e3)]);
const MEDALLA = { suben: ['🥇', '🥈', '🥉'], bajan: ['🔻', '🔻', '🔻'] };

/**
 * ventanas: solo cuando el último valor de la lista es de HOY (Madrid) y aún no se ha publicado; sin ventanas (simulacro o forzado),
 * con el último día que haya. Pide el histórico de los 868 jugadores solo cuando el centinela (el más caro) ya trae el día nuevo.
 */
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));

export async function generar({ jugadores, equipos, jornada, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), esperarHasta = 0, log = console.log }) {
  const hoy = diaMadrid(ahora);
  // solo justo después de la actualización (hacia las 00:15): el punto de hoy existe desde esa hora, así que sin esta ventana el tweet
  // podía salir a cualquier hora del día con un cambio de hace casi 24 h (el 2 nov salió a las 23:27; Carlos, 23:29)
  const [hDesde, hHasta] = config.horasMercado || [0, 6];
  const h = horaMadrid(ahora);
  if (ventanas && !forzar && (h < hDesde || h >= hHasta)) return [];
  const claves = { suben: `mercado|${hoy}|suben`, bajan: `mercado|${hoy}|bajan` };
  if (ventanas && !forzar && registro && registro.claves.has(claves.suben) && registro.claves.has(claves.bajan)) return [];
  const lista = (jugadores || []).filter((j) => Number(j.marketValue) > 0 && j.playerStatus !== 'out_of_league');
  if (!lista.length) return [];
  const centinela = [...lista].sort((a, b) => Number(b.marketValue) - Number(a.marketValue))[0];
  let hc = puntos(await valorMercado(centinela.id).catch(() => null));
  let dia = hc.length ? diaMadrid(hc[hc.length - 1].t) : null;
  // ejecución solo de mercado lanzada por el Worker de 00:13 a 00:30 (3 nov, Carlos: «cada 30 s»): en vez de acabar si aún no ha
  // llegado el valor de hoy, vuelve a mirar el centinela cada 15 s hasta `esperarHasta`; así sale en cuanto LaLiga actualiza,
  // sin esperar a que arranque otra ejecución de Actions (tardan 15-30 s solo en empezar)
  while (ventanas && !forzar && dia !== hoy && esperarHasta && Date.now() + 15e3 < esperarHasta) {
    log(`  (mercado) el último valor es del ${dia}, aún no ha llegado el de hoy: vuelvo a mirar en 15 s`);
    await new Promise((r) => setTimeout(r, 15e3));
    const otra = puntos(await valorMercado(centinela.id).catch(() => null));
    if (otra.length) { hc = otra; dia = diaMadrid(hc[hc.length - 1].t); }
  }
  if (!hc.length) { log('  (mercado) sin histórico del centinela'); return []; }
  if (ventanas && !forzar && dia !== hoy) { log(`  (mercado) el último valor es del ${dia}, aún no ha llegado el de hoy (${hoy})`); return []; }
  log(`  (mercado) valores del ${dia}: pido el histórico de ${lista.length} jugadores`);
  const hist = await enParalelo(lista, 25, (j) => valorMercado(j.id));
  const filas = [];
  lista.forEach((j, i) => {
    const h = puntos(hist[i]);
    if (h.length < 2 || diaMadrid(h[h.length - 1].t) !== dia) return;
    const nuevo = h[h.length - 1].v, antes = h[h.length - 2].v;
    filas.push({ nombre: j.nickname, equipo: corto(equipos[String(j.teamId)] || '?'), nuevo, antes, dif: nuevo - antes, pct: (nuevo - antes) / antes * 100 });
  });
  if (filas.length < 100) { log(`  (mercado) solo ${filas.length} jugadores con el valor de ${dia}: espero`); return []; }
  const out = [];
  for (const [clave, quien] of [['suben', 'sube'], ['bajan', 'baja']]) {
    const ord = [...filas].filter((f) => (clave === 'suben' ? f.dif > 0 : f.dif < 0)).sort((a, b) => (clave === 'suben' ? b.dif - a.dif : a.dif - b.dif)).slice(0, 3);
    if (ord.length < 3) continue;
    const cab = clave === 'suben'
      ? elegir(['📈 Mercado fantasy · Los 3 que más suben hoy', '📈 Los 3 jugadores que más se revalorizan hoy en el mercado fantasy', '📈 Mercado fantasy de hoy: los 3 que más suben'], `mc${dia}`)
      : elegir(['📉 Mercado fantasy · Los 3 que más bajan hoy', '📉 Los 3 jugadores que más se devalúan hoy en el mercado fantasy', '📉 Mercado fantasy de hoy: los 3 que más bajan'], `mc${dia}`);
    // el «3» de la cabecera también es un número del texto: sin él, el validador tumbaba el de los que bajan cuando ninguna cifra
    // llevaba un 3 (el 3 nov, de las 00:35 a las 06:00; el de los que suben pasó porque llevaba un «+2,3 M»)
    const num = [ord.length];
    const lineas = ord.map((f, i) => {
      const s = f.dif > 0 ? '+' : '-';
      num.push(...numDinero(Math.abs(f.dif)), ...numDinero(f.nuevo), ...partes(Math.abs(f.pct)));
      return `${MEDALLA[clave][i]} ${f.nombre} (${f.equipo}) ${s}${dinero(Math.abs(f.dif))} (${s}${fmt(Math.abs(f.pct))} %), ahora ${dinero(f.nuevo)}`;
    });
    const coment = clave === 'suben'
      ? elegir(['Si los tienes, hoy sonríes.', 'Quien los fichó a tiempo, hoy gana.', 'Ojo, que la subida se cobra al venderlos.'], `mu${dia}`)
      : elegir(['Si los tienes, hoy duele un poco.', 'Toca mirar si compensa aguantarlos.', 'Ojo con los que ibas a vender mañana.'], `mu${dia}`);
    const pie = cierre(`mercado${dia}${clave}`);
    const usadas = quepa(cab, [...lineas, coment], pie);
    if (usadas.length < 3) continue;
    out.push({ tipo: 'mercado', clave: claves[clave], jornada, texto: armar(cab, usadas, pie), numeros: num });
  }
  return out;
}
