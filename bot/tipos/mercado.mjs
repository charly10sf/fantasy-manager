// Mercado de cada noche (Carlos, 2 nov 23:11; 3 nov 06:58): tras la actualización de valores (hacia las 00:15), un tweet corto con la
// fecha y una tarjeta con los 5 que más suben y los 5 que más bajan respecto al día anterior (cara, escudo, cambio, % y valor). Sale de /player/{id}/market-value (un punto por día, fechado a las 00:00
// de Madrid): el último punto es el de hoy. Lleva el cierre de «Fantasy Manager · enlace en la bio».
import { valorMercado } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { clubes as clubesH, jugador as jugadorH } from '../lib/hechos.mjs';
import { cierre, corto, fmt, partes, del, largo, hash, dineroTxt } from '../lib/texto.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const puntos = (h) => (Array.isArray(h) ? h : []).map((v) => ({ t: Date.parse(v.date), v: Number(v.marketValue) })).filter((x) => x.t && x.v > 0).sort((a, b) => a.t - b.t);
/** 1 234 567 -> «1,2 M»; por debajo del millón, en miles: «640 K» */
const dinero = (x) => dineroTxt(x).t;
/** las cifras que escribe `dinero` (para el validador): 2,1 M → [2, 1]; 640 K → [640] (5 nov: con [639, 6] el tweet no pasaba) */
const cifrasDinero = (x) => dineroTxt(x).numeros;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * ventanas: solo cuando el último valor de la lista es de HOY (Madrid) y aún no se ha publicado; sin ventanas (simulacro o forzado),
 * con el último día que haya. Pide el histórico de los 868 jugadores solo cuando el centinela (el más caro) ya trae el día nuevo.
 */
import { horaMadrid, tramos } from '../lib/horario.mjs';

export async function generar({ jugadores, equipos, stats = [], jornada, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), esperarHasta = 0, log = console.log }) {
  const hoy = diaMadrid(ahora);
  // solo justo después de la actualización (hacia las 00:15): el punto de hoy existe desde esa hora, así que sin esta ventana el tweet
  // podía salir a cualquier hora del día con un cambio de hace casi 24 h (el 2 nov salió a las 23:27; Carlos, 23:29)
  // (Carlos, 3 nov 09:49: nada a las 5 de la mañana) de 0 a 1 h, que es cuando llega; si esa noche falla, de 8 a 12 h, no de madrugada
  // entre semana, el de la mañana desde las 7 (lib/horario.mjs)
  const ventanasHora = tramos(config, 'horasMercado', [[0, 1], [8, 12]], ahora);
  const h = horaMadrid(ahora);
  if (ventanas && !forzar && !ventanasHora.some(([d, hh]) => h >= d && h < hh)) return [];
  // un solo tweet por noche desde el 3 nov (antes, uno de subidas y otro de bajadas: sus claves cuentan como ya publicado)
  const clave = `mercado|${hoy}`;
  const viejas = [`mercado|${hoy}|suben`, `mercado|${hoy}|bajan`];
  if (ventanas && !forzar && registro && (registro.claves.has(clave) || viejas.some((k) => registro.claves.has(k)))) return [];
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
  const escudos = {};
  for (const m of stats || []) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const filas = [];
  lista.forEach((j, i) => {
    const h = puntos(hist[i]);
    if (h.length < 2 || diaMadrid(h[h.length - 1].t) !== dia) return;
    const nuevo = h[h.length - 1].v, antes = h[h.length - 2].v;
    filas.push({ media: Number(j.averagePoints) || 0, puntos: Number(j.points) || 0, ok: !j.playerStatus || j.playerStatus === 'ok', id: j.id, pos: j.positionId, nombre: j.nickname, equipo: corto(equipos[String(j.teamId)] || '?'), club: equipos[String(j.teamId)] || '', caraUrl: j.image || null, escudoUrl: escudos[String(j.teamId)] || null, nuevo, antes, dif: nuevo - antes, pct: (nuevo - antes) / antes * 100 });
  });
  if (filas.length < 100) { log(`  (mercado) solo ${filas.length} jugadores con el valor de ${dia}: espero`); return []; }
  const suben = [...filas].filter((f) => f.dif > 0).sort((a, b) => b.dif - a.dif);
  const bajan = [...filas].filter((f) => f.dif < 0).sort((a, b) => a.dif - b.dif);
  if (suben.length < 3 || bajan.length < 3) { log('  (mercado) menos de 3 que suban o que bajen: nada que contar'); return []; }
  const [, mes, dd] = dia.split('-').map(Number);
  const fecha = `${dd} de ${MESES[mes - 1]}`;
  // el texto, corto: todo lo demás va en la tarjeta (Carlos, 3 nov 06:58: que no diga top 3 y la imagen enseñe 5). Si la tarjeta
  // no sale, el tweet tampoco (soloConImagen): un «subidas y bajadas» sin la lista no dice nada
  // el chollo del día (etiqueta de Carrasco, claude/estilo-tweets.md): de los que suben hoy, barato (8 M o menos), disponible, con 4 o
  // más de media y 25 puntos o más en la temporada (que no sea la media de un solo partido); el de más puntos de media por millón
  const ch = chollo(suben);
  const linea = ch ? `\n\n🛒 Chollo Fantasy: ${ch.nombre} ${del(ch.equipo)} vale ${dinero(ch.nuevo)}, suma ${fmt(ch.media)} de media y hoy sube un ${fmt(ch.pct)} %` : '';
  // con X Premium (tweets largos), el que más sube y el que más baja contados con una frase (sin lista: la lista es la tarjeta)
  const num = [dd, mes, ...(ch ? [...cifrasDinero(ch.nuevo), ...partes(ch.media), ...partes(ch.pct)] : [])];
  let lectura = '';
  if (largo()) {
    const s = suben[0], b = bajan[0];
    // la subida y la bajada contadas de forma distinta (Carlos, 4 nov 23:39: nada de dos frases calcadas cambiando el nombre)
    lectura = [
      `\n\n📈 ${s.nombre} ${del(s.equipo)} es el que más sube: +${dinero(s.dif)} (+${fmt(s.pct)} %), hasta los ${dinero(s.nuevo)}.`
        + `\n\n📉 En el otro lado, ${b.nombre} ${del(b.equipo)} pierde ${dinero(-b.dif)} en un día y se queda en ${dinero(b.nuevo)} (-${fmt(-b.pct)} %).`,
      `\n\n📈 Nadie sube más que ${s.nombre}: +${dinero(s.dif)} en un día (+${fmt(s.pct)} %), y ya vale ${dinero(s.nuevo)}.`
        + `\n\n📉 ${b.nombre} ${del(b.equipo)} va en sentido contrario: cae ${dinero(-b.dif)}, un ${fmt(-b.pct)} %, hasta los ${dinero(b.nuevo)}.`,
    ][hash(dia) % 2];
    num.push(...[s.dif, s.nuevo, -b.dif, b.nuevo].flatMap(cifrasDinero), ...partes(s.pct), ...partes(-b.pct));
  }
  const texto = `💸 Subidas y bajadas del mercado fantasy de hoy, ${dd}/${mes}${lectura}${linea}\n\n${cierre(`mercado${dia}`)}`;
  // la tarjeta: top 5 de cada lado con cara, escudo, lo que cambia, el % y el valor
  const N = 5;
  const fila = (f) => ({ nombre: f.nombre, pos: f.pos, equipo: f.equipo, club: f.club, caraUrl: f.caraUrl, escudoUrl: f.escudoUrl,
    dif: `${f.dif > 0 ? '+' : '-'}${dinero(Math.abs(f.dif))}`, pct: `${f.dif > 0 ? '+' : '-'}${fmt(Math.abs(f.pct))} %`, valor: dinero(f.nuevo) });
  const d = { fecha, suben: suben.slice(0, N).map(fila), bajan: bajan.slice(0, N).map(fila) };
  const todas = [...d.suben, ...d.bajan];
  const tarjeta = { tipo: 'mercado', nombre: `mercado-${dia}`, d,
    permitidos: { numeros: [dd, 1, 2, 3, 4, 5, ...todas.flatMap((f) => [f.dif, f.pct, f.valor])].map(String),
      palabras: ['MERCADO', 'SUBEN', 'BAJAN', 'Y', 'de', 'M', 'K', MESES[mes - 1], ...todas.flatMap((f) => [f.nombre, f.equipo])] } };
  // los hechos para la IA que redacta (lib/redaccion.mjs): lo que sube y baja más, y el chollo si lo hay; el cierre de siempre va debajo
  const jug = (f, extra) => jugadorH({ nickname: f.nombre, equipo: f.equipo, averagePoints: f.media }, { principal: false, extra, sinDatos: ['valor'] });
  const sH = suben[0], bH = bajan[0];
  const hechos = { tipo: 'mercado', noticia: `LaLiga ha actualizado esta noche los valores de mercado fantasy (hoy es ${dd} de ${MESES[mes - 1]})`,
    aviso: 'la imagen adjunta lista los 5 que más suben y los 5 que más bajan: el texto no los enumera, cuenta el que más sube, el que más baja y lo que se ve en el conjunto',
    queMasSube: { nombre: sH.nombre, club: sH.equipo, cambio: `+${dinero(sH.dif)}`, porcentaje: `+${fmt(sH.pct)} %`, valorAhora: dinero(sH.nuevo) },
    queMasBaja: { nombre: bH.nombre, club: bH.equipo, cambio: `-${dinero(-bH.dif)}`, porcentaje: `-${fmt(-bH.pct)} %`, valorAhora: dinero(bH.nuevo) },
    ...(ch ? { chollo: { nombre: ch.nombre, club: ch.equipo, valor: dinero(ch.nuevo), mediaPuntos: fmt(ch.media), sube: `${fmt(ch.pct)} %` } } : {}),
    jugadores: [jug(sH, { cambioHoy: 'el que más sube' }), jug(bH, { cambioHoy: 'el que más baja' }), ...(ch && ch.id !== sH.id ? [jug(ch, { cambioHoy: 'el chollo del día' })] : [])],
    clubes: clubesH(sH.equipo, bH.equipo, ...(ch ? [ch.equipo] : [])), etiqueta: cierre(`mercado${dia}`) };
  return [{ tipo: 'mercado', clave, jornada, texto, hechos, numeros: num, tarjeta, soloConImagen: true }];
}

/** el chollo de los que suben hoy (null si no hay ninguno que cumpla) */
export function chollo(suben) {
  const xs = suben.filter((f) => f.ok && f.nuevo <= 8e6 && f.media >= 4 && f.puntos >= 25 && f.pct >= 1);
  return xs.sort((a, b) => b.media / b.nuevo - a.media / a.nuevo)[0] || null;
}
