// Revalorizaciones de la temporada en el parón (Carlos, 9 nov 08:58): los que más han subido y más han bajado de valor desde el inicio
// de la temporada, con la tarjeta del mercado de la noche (tipos/mercado.mjs) con otro titular. El valor de cada uno sale de su
// histórico (`/player/{id}/market-value`, un punto por día desde finales de julio): el primero es el de inicio y el último, el de hoy.
// Se pide el de todos los que valen algo, de 25 en 25, como el mercado de cada noche. Un tuit por parón (lib/paron-tuits.mjs).
import { valorMercado } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
import { clubes as clubesH, jugador as jugadorH } from '../lib/hechos.mjs';
import { corto, fmt, partes, del, dineroTxt, hash } from '../lib/texto.mjs';
import { tweet, aparte } from '../lib/redactar.mjs';
import { ventanaParon, imagenesDe, puntosHasta } from '../lib/paron-tuits.mjs';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const puntosDe = (h) => (Array.isArray(h) ? h : []).map((v) => ({ t: Date.parse(v.date), v: Number(v.marketValue) })).filter((x) => x.t && x.v > 0).sort((a, b) => a.t - b.t);
const dinero = (x) => dineroTxt(x).t;
const diaMes = (t) => { const d = new Date(t + 36e5); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };

/** las filas (subida o bajada de cada uno desde su primer valor de la temporada) a partir de los históricos */
export function revalorizaciones(lista, hist, { hasta = 99 } = {}) {
  const filas = [];
  lista.forEach((j, i) => {
    const h = puntosDe(hist[i]);
    if (h.length < 30) return;                         // sin un mes de histórico (fichajes de última hora), no se compara
    const ini = h[0], fin = h[h.length - 1];
    const { pts, jugadas } = puntosHasta(j, hasta);
    filas.push({ j, id: String(j.id), nombre: j.nickname, pos: Number(j.positionId), teamId: String(j.teamId), inicio: ini.v, desde: ini.t, nuevo: fin.v, dif: fin.v - ini.v, pct: ((fin.v - ini.v) / ini.v) * 100, pts, jugadas });
  });
  return filas;
}

export async function generar(ctx) {
  const { jugadores = [], stats = [], log = console.log, pedirValor = valorMercado } = ctx;
  const v = ventanaParon('revalorizaciones', ctx);
  if (!v.ok) { log(`  (revalorizaciones) ${v.motivo}`); return []; }
  const J = v.jugada;
  const im = imagenesDe(jugadores, stats, ctx.paron && ctx.paron.statsSiguiente);
  const eq = (x) => corto(im.equipos[x.teamId] || '?');
  const lista = jugadores.filter((j) => Number(j.marketValue) > 0 && j.playerStatus !== 'out_of_league');
  log(`  (revalorizaciones) pido el histórico de valor de ${lista.length} jugadores`);
  const hist = await enParalelo(lista, 25, (j) => pedirValor(j.id).catch(() => null));
  const filas = revalorizaciones(lista, hist, { hasta: J });
  if (filas.length < 200) { log(`  (revalorizaciones) solo ${filas.length} con histórico: espero`); return []; }
  const suben = [...filas].filter((f) => f.dif > 0).sort((a, b) => b.dif - a.dif);
  const bajan = [...filas].filter((f) => f.dif < 0).sort((a, b) => a.dif - b.dif);
  // la sorpresa: el que más ha subido en % de los que valían poco al empezar (5 M o menos)
  const sorpresa = [...filas].filter((f) => f.inicio <= 5e6 && f.dif > 0 && !suben.slice(0, 5).includes(f)).sort((a, b) => b.pct - a.pct)[0] || null;
  if (suben.length < 5 || bajan.length < 5) { log('  (revalorizaciones) menos de 5 que suban o que bajen'); return []; }
  const desde = diaMes(Math.min(...filas.map((f) => f.desde)));
  const s = suben[0], b = bajan[0];
  const V = (xs, k) => xs[hash(`reval${J}${k}`) % xs.length];

  // la plantilla (último recurso)
  const num = [1, J, ...[s.dif, s.nuevo, -b.dif, b.nuevo].flatMap((x) => dineroTxt(x).numeros), ...partes(s.pct), ...partes(-b.pct)];
  const cab = V([`💸 Las revalorizaciones de la temporada, de la jornada 1 a la ${J}`, `💸 Parón y balance del mercado: quién ha ganado y quién ha perdido valor desde el inicio`], 'cab');
  const ideas = [
    { t: aparte(`📈 Nadie ha subido tanto como ${s.nombre} ${del(eq(s))}: +${dinero(s.dif)} desde el inicio, y ya vale ${dinero(s.nuevo)}`), prio: 9 },
    { t: aparte(`📉 En el otro lado, ${b.nombre} ${del(eq(b))} ha perdido ${dinero(-b.dif)} (-${fmt(-b.pct)} %) y se queda en ${dinero(b.nuevo)}`), prio: 8 },
    sorpresa ? { t: aparte(`🛒 La sorpresa es ${sorpresa.nombre} ${del(eq(sorpresa))}: valía ${dinero(sorpresa.inicio)} y ahora ${dinero(sorpresa.nuevo)}`), prio: 6 } : null,
  ];
  if (sorpresa) num.push(...[sorpresa.inicio, sorpresa.nuevo].flatMap((x) => dineroTxt(x).numeros));
  const { texto } = tweet(cab, ideas);

  // la tarjeta: la del mercado con dos paneles (los 5 que más suben y los 5 que más bajan desde el inicio)
  const fila = (f) => ({ nombre: f.nombre, pos: f.pos, equipo: eq(f), club: im.equipos[f.teamId] || '', caraUrl: im.cara(f.j), escudoUrl: im.escudoDe(f.teamId),
    dif: `${f.dif > 0 ? '+' : '-'}${dinero(Math.abs(f.dif))}`, pct: `${f.dif > 0 ? '+' : '-'}${fmt(Math.abs(f.pct))} %`, valor: dinero(f.nuevo) });
  const d = { titulo: 'REVALORIZACIÓN', sub: `TEMPORADA · JORNADAS 1-${J}`, sub2: 'DESDE EL INICIO · LALIGA FANTASY',
    paneles: [{ titulo: 'SUBEN', bueno: true, filas: suben.slice(0, 5).map(fila) }, { titulo: 'BAJAN', bueno: false, filas: bajan.slice(0, 5).map(fila) }] };
  const todas = d.paneles.flatMap((p) => p.filas);
  const tarjeta = { tipo: 'mercado', nombre: `revalorizaciones-${J}`, d,
    permitidos: { numeros: [1, J, ...todas.flatMap((f) => [f.dif, f.pct, f.valor])].map(String),
      palabras: ['REVALORIZACIÓN', 'TEMPORADA', 'JORNADAS', 'DESDE', 'EL', 'INICIO', 'SUBEN', 'BAJAN', 'M', 'K', ...todas.flatMap((f) => [f.nombre, f.equipo])] } };

  // los hechos para la IA
  const jug = (f, extra, principal = false) => jugadorH(f.j, { equipos: im.equipos, principal, sinDatos: ['valor'], extra: { valorAlEmpezar: dinero(f.inicio), valorAhora: dinero(f.nuevo),
    cambio: `${f.dif > 0 ? '+' : '-'}${dinero(Math.abs(f.dif))}`, porcentaje: `${f.dif > 0 ? '+' : '-'}${fmt(Math.abs(f.pct))} %`, puntosTemporada: f.pts, ...extra } });
  const hechos = { tipo: 'revalorizaciones', noticia: `lo que más ha subido y bajado de valor en el mercado fantasy desde el inicio de la temporada (primer valor: ${desde}) hasta hoy, en el parón de selecciones`,
    momento: `de la jornada 1 a la ${J}; la liga vuelve con la jornada ${v.siguiente}`,
    aviso: 'la imagen adjunta lista los 5 que más suben y los 5 que más bajan: el texto no los enumera; cuenta el que más sube, el que más baja y lo que se ve (por qué, si sus puntos lo explican)',
    queMasSube: { nombre: s.nombre, club: eq(s), cambio: `+${dinero(s.dif)}`, porcentaje: `+${fmt(s.pct)} %`, valorAhora: dinero(s.nuevo), puntos: s.pts },
    queMasBaja: { nombre: b.nombre, club: eq(b), cambio: `-${dinero(-b.dif)}`, porcentaje: `-${fmt(-b.pct)} %`, valorAhora: dinero(b.nuevo), puntos: b.pts },
    ...(sorpresa ? { sorpresa: { nombre: sorpresa.nombre, club: eq(sorpresa), valia: dinero(sorpresa.inicio), valeAhora: dinero(sorpresa.nuevo), porcentaje: `+${fmt(sorpresa.pct)} %` } } : {}),
    jugadores: [jug(s, { rol: 'el que más sube' }, true), jug(b, { rol: 'el que más baja' }, true), ...(sorpresa ? [jug(sorpresa, { rol: 'la sorpresa (valía poco)' })] : [])],
    clubes: clubesH(eq(s), eq(b), ...(sorpresa ? [eq(sorpresa)] : [])) };
  log(`  (revalorizaciones) suben ${suben.slice(0, 5).map((f) => `${f.nombre} +${dinero(f.dif)}`).join(', ')} · bajan ${bajan.slice(0, 5).map((f) => `${f.nombre} -${dinero(-f.dif)}`).join(', ')}`);
  return [{ tipo: 'revalorizaciones', clave: `revalorizaciones|${J}`, jornada: J, texto, hechos, numeros: num, partido: null, tarjeta, soloConImagen: true }];
}
