// El resumen diario de los jugadores de LaLiga con sus selecciones durante el parón (Carlos, 9 nov 10:13: «que el bot, durante los
// partidos y demás, al final haga un resumen de los mejores y los peores de cada selección, evidentemente si están en la liga, e información
// que pueda ser valiosa»; elegidos los extras «Minutos y carga» y «Banderas» y la frecuencia (1), uno al día).
// Cada mañana del parón (lib/paron-tuits.mjs, `ventanaSeleccionesDia`), lo que hicieron AYER: los mejores (nota de FotMob, goles y
// asistencias) y los peores (nota baja, roja o se retira lesionado), con su selección y su bandera, el rival, el marcador y los minutos; y
// la carga: quién lleva más minutos en el parón y quién se quedó ayer sin jugar. Las actas, de lib/actas-selecciones.mjs. Con tarjeta (la
// del mercado con hasta tres paneles y la bandera de cada uno junto a su cara).
import { json } from '../lib/http.mjs';
import { actasDe, porJugador, fechaTxt, diaSemana, MESES, aaaammdd } from '../lib/actas-selecciones.mjs';
import { clubes as clubesH, jugador as jugadorH } from '../lib/hechos.mjs';
import { corto, hash } from '../lib/texto.mjs';
import { tweet, aparte } from '../lib/redactar.mjs';
import { lista as enLista } from '../lib/agrupar.mjs';
import { ventanaSeleccionesDia, imagenesDe } from '../lib/paron-tuits.mjs';

const nota1 = (n) => String(n).replace('.', ',');
const ga = (p) => [p.goles ? `${p.goles} ${p.goles === 1 ? 'gol' : 'goles'}` : '', p.asist ? `${p.asist} ${p.asist === 1 ? 'asistencia' : 'asistencias'}` : ''].filter(Boolean).join(' y ');
const FECHA_VUELTA = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' });

/** los mejores, los peores y la carga del día `ayer` a partir de lo de cada jugador en el parón (porJugador) */
export function elDia(por, ayer, { valorSinJugar = 20e6 } = {}) {
  const deAyer = [];
  for (const r of por.values()) for (const p of r.partidos) if (p.fecha === ayer) deAyer.push({ r, p });
  const jugaron = deAyer.filter((x) => x.p.min > 0);
  const tocado = (x) => x.p.lesion != null || x.p.roja != null;
  const mejores = jugaron.filter((x) => !tocado(x) && (x.p.goles + x.p.asist > 0 || x.p.mejor || (x.p.nota != null && x.p.nota >= 7.5)))
    .sort((a, b) => (b.p.nota ?? 7) - (a.p.nota ?? 7) || (b.p.goles * 2 + b.p.asist) - (a.p.goles * 2 + a.p.asist) || Number(b.r.j.marketValue) - Number(a.r.j.marketValue));
  const peores = jugaron.filter((x) => tocado(x) || (x.p.nota != null && x.p.nota <= 6 && x.p.min >= 30 && !mejores.includes(x)))
    .sort((a, b) => (b.p.lesion != null) - (a.p.lesion != null) || (b.p.roja != null) - (a.p.roja != null) || (a.p.nota ?? 6) - (b.p.nota ?? 6));
  // la carga: los que más minutos llevan en el parón (150 o más) y los de más valor que ayer no jugaron (en el acta, sin entrar)
  const carga = [...por.values()].filter((r) => r.min >= 150).sort((a, b) => b.min - a.min || Number(b.j.marketValue) - Number(a.j.marketValue));
  const sinJugar = deAyer.filter((x) => x.p.min === 0 && Number(x.r.j.marketValue) >= valorSinJugar).sort((a, b) => Number(b.r.j.marketValue) - Number(a.r.j.marketValue));
  return { deAyer, jugaron, mejores, peores, carga, sinJugar };
}

export async function generar(ctx) {
  const { jugadores = [], stats = [], equipos: equiposCtx = {}, log = console.log, ahora = Date.now(), paron = null, fechasSelecciones = null, pedir = json, registro = null } = ctx;
  const v = ventanaSeleccionesDia(ctx);
  if (!v.ok) { log(`  (selecciones-dia) ${v.motivo}`); return []; }
  const im = imagenesDe(jugadores, stats, paron && paron.statsAnterior, paron && paron.statsSiguiente);
  const equipos = { ...equiposCtx, ...im.equipos };
  const clubesLiga = new Set(Object.values(equipos).map((n) => corto(n)));
  // los días del parón hasta ayer (para la carga) o los que se pasen para probar (--fechas-selecciones=AAAAMMDD,…; el último es «ayer»)
  let dias = fechasSelecciones;
  if (!dias) {
    dias = [];
    const desde = paron ? paron.fin : ahora - 8 * 864e5;
    for (let t = desde; aaaammdd(t) <= v.ayer && dias.length < 12; t += 864e5) dias.push(aaaammdd(t));
    if (!dias.includes(v.ayer)) dias.push(v.ayer);
  }
  const actas = await actasDe(dias, { clubesLiga, pedir, registro, ahora, log });
  const por = porJugador(actas, jugadores, equipos);
  const { jugaron, mejores, peores, carga, sinJugar } = elDia(por, v.ayer);
  log(`  (selecciones-dia) ${v.ayer}: ${actas.filter((a) => a.fecha === v.ayer).length} partidos con jugadores de LaLiga, ${jugaron.length} jugaron · mejores: ${mejores.slice(0, 5).map((x) => `${x.r.j.nickname} ${x.p.nota ?? '-'}`).join(', ') || 'nadie'} · peores: ${peores.slice(0, 4).map((x) => `${x.r.j.nickname} ${x.p.lesion != null ? 'lesión' : x.p.roja != null ? 'roja' : x.p.nota}`).join(', ') || 'nadie'} · carga: ${carga.slice(0, 4).map((r) => `${r.j.nickname} ${r.min}'`).join(', ') || 'nadie'}`);
  if (jugaron.length < 3 || !mejores.length || mejores.length + peores.length < 2) { log('  (selecciones-dia) poco que contar de ayer: no sale'); return []; }

  const eq = (r) => corto(equipos[String(r.j.teamId)] || '?');
  const V = (xs, k) => xs[hash(`seldia${v.ayer}${k}`) % xs.length];
  const num = [];
  const cifras = (...xs) => { for (const x of xs) if (x != null) for (const n of String(x).match(/\d+/g) || []) num.push(Number(n)); };
  const ayerTxt = `${diaSemana(v.ayer)} ${fechaTxt(v.ayer)}`;
  // la bandera, detrás de la selección y solo la primera vez que sale (el validador no deja repetirla)
  const puestas = new Set();
  const conBandera = (x) => { if (!x.bandera || puestas.has(x.bandera)) return x.nombre; puestas.add(x.bandera); return `${x.nombre} ${x.bandera}`; };

  // la plantilla (último recurso)
  const cab = V([`🌍 Lo que dejó el ${ayerTxt} con las selecciones`, '🌍 Los de LaLiga con sus selecciones, lo de ayer'], 'cab');
  cifras(fechaTxt(v.ayer));
  const ideas = [];
  const linea = (x) => { const { r, p } = x; cifras(p.nota != null ? nota1(p.nota) : null, p.min, p.marcador, p.goles, p.asist);
    return `${r.j.nickname} (${eq(r)}), ${ga(p) ? `${ga(p)} ` : ''}con ${conBandera(r.sel)} ante ${conBandera(p.rival)}${p.marcador ? ` (${p.marcador})` : ''}${p.nota != null ? `: un ${nota1(p.nota)} en ${p.min} minutos` : ` en ${p.min} minutos`}`; };
  ideas.push({ t: aparte(`⭐ ${linea(mejores[0])}`), prio: 9 });
  if (mejores[1]) ideas.push({ t: aparte(`También destacan ${enLista(mejores.slice(1, 3).map((x) => { cifras(x.p.nota != null ? nota1(x.p.nota) : null); return `${x.r.j.nickname} (${conBandera(x.r.sel)}${x.p.nota != null ? `, ${nota1(x.p.nota)}` : ''})`; }))}`), prio: 7 });
  const malo = peores[0];
  if (malo) {
    const { r, p } = malo;
    cifras(p.lesion, p.roja, p.nota != null ? nota1(p.nota) : null);
    const que = p.lesion != null ? `se retiró lesionado en el minuto ${p.lesion}` : p.roja != null ? `vio la roja en el minuto ${p.roja}` : `se quedó en un ${nota1(p.nota)}`;
    ideas.push({ t: aparte(`🚑 ${r.j.nickname} (${eq(r)}) ${que} con ${conBandera(r.sel)}`), prio: 8 });
  }
  if (carga[0]) { cifras(carga[0].min, carga[0].jugados); ideas.push({ t: aparte(`El que más minutos lleva en el parón: ${carga[0].j.nickname}, ${carga[0].min} en ${carga[0].jugados} ${carga[0].jugados === 1 ? 'partido' : 'partidos'}`), prio: 5 }); }
  const { texto } = tweet(cab, ideas);

  // la tarjeta: la del mercado con LOS MEJORES, LOS PEORES y MÁS MINUTOS EN EL PARÓN (si hay), con la bandera junto a cada cara
  const fila = (r, dif, pct, valor) => ({ nombre: r.j.nickname, pos: Number(r.j.positionId), equipo: eq(r), club: equipos[String(r.j.teamId)] || '', caraUrl: im.cara(r.j), escudoUrl: im.escudoDe(r.j.teamId),
    banderaUrl: r.sel.banderaUrl, dif, pct, valor });
  const corto2 = (p) => [p.goles ? `${p.goles} ${p.goles === 1 ? 'GOL' : 'GOLES'}` : '', p.asist ? `${p.asist} ASIST.` : ''].filter(Boolean).join(' Y ');
  const ante = (p) => `ANTE ${String(p.rival.nombre).toUpperCase()}`;
  const paneles = [{ titulo: 'LOS MEJORES', bueno: true, flecha: false,
    filas: mejores.slice(0, 5).map(({ r, p }) => fila(r, p.nota != null ? nota1(p.nota) : corto2(p), `${p.min} MIN`, p.nota != null && corto2(p) ? corto2(p) : ante(p))) }];
  if (peores.length) paneles.push({ titulo: 'LOS PEORES', bueno: false, flecha: false,
    filas: peores.slice(0, 5).map(({ r, p }) => fila(r, p.lesion != null ? 'LESIÓN' : p.roja != null ? 'ROJA' : nota1(p.nota), p.lesion != null ? `MIN. ${p.lesion}` : p.roja != null ? `MIN. ${p.roja}` : `${p.min} MIN`, ante(p))) });
  if (carga.length >= 2) paneles.push({ titulo: 'MÁS MINUTOS EN EL PARÓN', bueno: true, flecha: false,
    filas: carga.slice(0, 5).map((r) => fila(r, `${r.min} MIN`, `${r.jugados} ${r.jugados === 1 ? 'PARTIDO' : 'PARTIDOS'}`, String(r.sel.nombre).toUpperCase())) });
  const d = { titulo: 'SELECCIONES', sub: `${diaSemana(v.ayer)} ${fechaTxt(v.ayer)}`.toUpperCase(), sub2: 'JUGADORES DE LALIGA', paneles };
  const todas = paneles.flatMap((x) => x.filas);
  const tarjeta = { tipo: 'mercado', nombre: `selecciones-dia-${v.ayer}`, d,
    permitidos: { numeros: [Number(v.ayer.slice(6)), ...todas.flatMap((f) => [f.dif, f.pct, f.valor])].map(String),
      palabras: ['SELECCIONES', 'JUGADORES', 'DE', 'LALIGA', 'LOS', 'MEJORES', 'PEORES', 'MÁS', 'MINUTOS', 'EN', 'EL', 'PARÓN', 'MIN', 'ANTE', 'GOL', 'GOLES', 'ASIST', 'Y',
        'LESIÓN', 'ROJA', 'PARTIDO', 'PARTIDOS', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO', ...MESES.map((m) => m.toUpperCase()),
        ...todas.flatMap((f) => [f.nombre, f.equipo, f.valor])] } };

  // los hechos para la IA: cada uno con lo que hizo, contra quién, el marcador, los minutos y la nota; las lesiones, solo las que marca FotMob
  const sel = (s) => ({ seleccion: s.nombre, ...(s.bandera ? { bandera: s.bandera } : {}) });
  const partido = (p) => ({ rival: p.rival.nombre, ...(p.rival.bandera ? { banderaRival: p.rival.bandera } : {}), ...(p.marcador ? { marcador: p.marcador, resultado: p.resultado } : {}),
    minutos: p.min, ...(p.titular ? {} : { entroDesdeElBanquillo: true }), ...(p.nota != null ? { notaFotMob: nota1(p.nota) } : {}), ...(p.mejor ? { mejorDelPartido: true } : {}) });
  const jug = (r, extra, principal = false) => { const h = jugadorH(r.j, { equipos, principal, datos: false, extra: { club: eq(r), ...sel(r.sel), ...extra } }); delete h.mediaPuntos; return h; };
  const vuelta = paron && paron.ini ? FECHA_VUELTA.format(new Date(paron.ini)) : null;
  const hechos = { tipo: 'selecciones-dia', noticia: `lo que hicieron ayer (${ayerTxt}) los jugadores de LaLiga con sus selecciones: los mejores, los peores y los minutos que llevan`,
    momento: `parón de selecciones; la liga vuelve con la jornada ${v.siguiente}${vuelta ? ` el ${vuelta}` : ''}`,
    aviso: 'la nota es la de FotMob (de 0 a 10): dila como «un 8,6» o «nota de 8,6», sin decir que es «de FotMob» cada vez. Una lesión, solo la que viene en «losPeores» y tal como está: ni gravedad ni plazos. Nada de convocatorias ni de partidos que no estén aquí. La bandera va justo detrás del nombre de su selección y solo la que trae cada una. La carga (minutos en el parón) sirve para pensar en la jornada de vuelta, sin dar por hecho que vaya a descansar. La imagen adjunta lleva a los mejores, los peores y los que más minutos llevan.',
    losMejores: mejores.slice(0, 4).map(({ r, p }) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel), ...(ga(p) ? { loQueHizo: ga(p) } : {}), ...partido(p) })),
    ...(peores.length ? { losPeores: peores.slice(0, 3).map(({ r, p }) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel),
      queLePaso: p.lesion != null ? `se retiró lesionado en el minuto ${p.lesion}` : p.roja != null ? `le echaron con roja en el minuto ${p.roja}` : `nota baja`, ...partido(p) })) } : {}),
    ...(carga.length ? { masMinutosEnElParon: carga.slice(0, 4).map((r) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel), minutosEnElParon: r.min, partidosJugados: r.jugados })) } : {}),
    ...(sinJugar.length ? { ayerSinJugar: sinJugar.slice(0, 3).map(({ r }) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel), queLePaso: 'estuvo en el banquillo y no jugó' })) } : {}),
    jugadores: [...mejores.slice(0, 3).map((x, i) => jug(x.r, {}, i === 0)), ...peores.slice(0, 2).map((x) => jug(x.r, {}, true)), ...carga.slice(0, 2).filter((r) => ![...mejores.slice(0, 3), ...peores.slice(0, 2)].some((x) => x.r === r)).map((r) => jug(r, {}))],
    clubes: clubesH(...[...mejores.slice(0, 4).map((x) => x.r), ...peores.slice(0, 3).map((x) => x.r), ...carga.slice(0, 4), ...sinJugar.slice(0, 3).map((x) => x.r)].map(eq)) };
  return [{ tipo: 'selecciones-dia', clave: `selecciones-dia|${v.jugada}|${v.ayer}`, jornada: v.jugada, texto, hechos, numeros: num, partido: null, tarjeta }];
}
