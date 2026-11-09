// El resumen diario de los jugadores de LaLiga con sus selecciones durante el parón (Carlos, 9 nov 10:13: «que el bot, durante los
// partidos y demás, al final haga un resumen de los mejores y los peores de cada selección, evidentemente si están en la liga, e información
// que pueda ser valiosa»; elegidos los extras «Minutos y carga» y «Banderas» y la frecuencia (1), uno al día).
// Cada mañana del parón (lib/paron-tuits.mjs, `ventanaSeleccionesDia`), lo que hicieron AYER: los mejores (nota de FotMob, goles y
// asistencias) y los peores (nota baja, roja o se retira lesionado), con su selección y su bandera, el rival, el marcador y los minutos; y
// la carga: quién lleva más minutos en el parón y quién se quedó ayer sin jugar. Las actas, de lib/actas-selecciones.mjs. Con tarjeta (la
// del mercado con hasta tres paneles y la bandera de cada uno junto a su cara).
import { json } from '../lib/http.mjs';
import { actasDe, porJugador, fechaTxt, diaSemana, MESES, aaaammdd } from '../lib/actas-selecciones.mjs';
import { clubes as clubesH, jugador as jugadorH, franja } from '../lib/hechos.mjs';
import { corto, hash, dineroTxt } from '../lib/texto.mjs';
import { prepararDatos, perfil, _ctx as datosCtx } from '../lib/datos-jugador.mjs';
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
  const { jugadores = [], stats = [], equipos: equiposCtx = {}, log = console.log, ahora = Date.now(), paron = null, fechasSelecciones = null, pedir = json, registro = null, conValor = true } = ctx;
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
  const { deAyer, jugaron, mejores, peores, carga, sinJugar } = elDia(por, v.ayer);
  log(`  (selecciones-dia) ${v.ayer}: ${actas.filter((a) => a.fecha === v.ayer).length} partidos con jugadores de LaLiga, ${jugaron.length} jugaron · mejores: ${mejores.slice(0, 5).map((x) => `${x.r.j.nickname} ${x.p.nota ?? '-'}`).join(', ') || 'nadie'} · peores: ${peores.slice(0, 4).map((x) => `${x.r.j.nickname} ${x.p.lesion != null ? 'lesión' : x.p.roja != null ? 'roja' : x.p.nota}`).join(', ') || 'nadie'} · carga: ${carga.slice(0, 4).map((r) => `${r.j.nickname} ${r.min}'`).join(', ') || 'nadie'}`);
  if (jugaron.length < 3 || !mejores.length || mejores.length + peores.length < 2) { log('  (selecciones-dia) poco que contar de ayer: no sale'); return []; }

  // el valor de cada uno y lo que ha subido o bajado en el parón (Carlos, 9 nov 11:01: «al jugador fantasy promedio le importa que un
  // jugador se valorice, valga y que salga titular»; la nota de FotMob, solo para elegir a los mejores y a los peores y, en el texto,
  // como mucho una vez)
  const protas = [...mejores.slice(0, 4).map((x) => x.r), ...peores.slice(0, 3).map((x) => x.r), ...carga.slice(0, 4)];
  if (conValor) await prepararDatos(protas.map((r) => r.j.id), { ficha: false, valor: true }).catch(() => {});
  const desdeParon = paron && paron.fin ? paron.fin : Date.parse(`${dias[0].slice(0, 4)}-${dias[0].slice(4, 6)}-${dias[0].slice(6)}T00:00:00Z`);
  const valorDe = (r) => {
    const pf = perfil(r.j) || {}, vale = Number(pf.valor) || Number(r.j.marketValue) || 0;
    const xs = [...(datosCtx.valores.get(String(r.j.id)) || [])].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const antes = [...xs].reverse().find((x) => Date.parse(x.date) <= desdeParon);
    const dif = antes && xs.length ? Number(xs[xs.length - 1].marketValue) - Number(antes.marketValue) : null;
    const o = vale ? { valeAhora: dineroTxt(vale).t } : {};
    // lo que ha cambiado en el parón, solo si se nota (un 2 % o 300 mil)
    if (dif != null && vale && Math.abs(dif) >= Math.max(3e5, vale * 0.02)) o.suValorEnElParon = `${dif > 0 ? '+' : '-'}${dineroTxt(dif).t}`;
    if (pf.cambio30 != null && vale && Math.abs(pf.cambio30) >= Math.max(5e5, vale * 0.05)) o.suValorEnElUltimoMes = `${pf.cambio30 > 0 ? '+' : '-'}${dineroTxt(pf.cambio30).t}`;
    return o;
  };
  const valores = new Map(protas.map((r) => [r, valorDe(r)]));
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
  const linea = (x) => { const { r, p } = x; const vl = valores.get(r) || {}; cifras(p.min, p.marcador, p.goles, p.asist, vl.valeAhora, vl.suValorEnElParon);
    return `${r.j.nickname} (${eq(r)}), ${ga(p) ? `${ga(p)} ` : ''}con ${conBandera(r.sel)} ante ${conBandera(p.rival)}${p.marcador ? ` (${p.marcador})` : ''} en ${p.min} minutos${vl.valeAhora ? `. Vale ${vl.valeAhora}${vl.suValorEnElParon ? ` (${vl.suValorEnElParon} en el parón)` : ''}` : ''}`; };
  ideas.push({ t: aparte(`⭐ ${linea(mejores[0])}`), prio: 9 });
  if (mejores[1]) ideas.push({ t: aparte(`También destacan ${enLista(mejores.slice(1, 3).map((x) => `${x.r.j.nickname} (${conBandera(x.r.sel)})`))}`), prio: 7 });
  const malo = peores[0];
  if (malo) {
    const { r, p } = malo;
    cifras(p.lesion, p.roja, p.nota != null ? nota1(p.nota) : null);
    const que = p.lesion != null ? `se retiró lesionado en el minuto ${p.lesion}` : p.roja != null ? `vio la roja en el minuto ${p.roja}` : `tuvo un mal partido ante ${p.rival.nombre}`;
    ideas.push({ t: aparte(`🚑 ${r.j.nickname} (${eq(r)}) ${que} con ${conBandera(r.sel)}`), prio: 8 });
  }
  if (carga[0]) { cifras(carga[0].min, carga[0].jugados); ideas.push({ t: aparte(`El que más minutos lleva en el parón: ${carga[0].j.nickname}, ${carga[0].min} en ${carga[0].jugados} ${carga[0].jugados === 1 ? 'partido' : 'partidos'}`), prio: 5 }); }
  const { texto } = tweet(cab, ideas);

  // la tarjeta: la del mercado con LOS MEJORES, LOS PEORES y MÁS MINUTOS EN EL PARÓN (si hay), con la bandera junto a cada cara
  const fila = (r, dif, pct, valor) => ({ nombre: r.j.nickname, pos: Number(r.j.positionId), equipo: eq(r), club: equipos[String(r.j.teamId)] || '', caraUrl: im.cara(r.j), escudoUrl: im.escudoDe(r.j.teamId),
    banderaUrl: r.sel.banderaUrl, dif, pct, valor });
  const corto2 = (p) => [p.goles ? `${p.goles} ${p.goles === 1 ? 'GOL' : 'GOLES'}` : '', p.asist ? `${p.asist} ASIST.` : ''].filter(Boolean).join(' Y ');
  const ante = (p) => `ANTE ${String(p.rival.nombre).toUpperCase()}`;
  // (lo grande: goles y asistencias si los hay; si no, la nota. Debajo, los minutos y lo que vale)
  const valeTxt = (r) => { const v = Number((perfil(r.j) || {}).valor) || Number(r.j.marketValue) || 0; return v ? `VALE ${dineroTxt(v).t}` : null; };
  const paneles = [{ titulo: 'LOS MEJORES', bueno: true, flecha: false,
    filas: mejores.slice(0, 5).map(({ r, p }) => fila(r, corto2(p) || (p.nota != null ? `NOTA ${nota1(p.nota)}` : `${p.min} MIN`), `${p.min} MIN`, valeTxt(r) || ante(p))) }];
  if (peores.length) paneles.push({ titulo: 'LOS PEORES', bueno: false, flecha: false,
    filas: peores.slice(0, 5).map(({ r, p }) => fila(r, p.lesion != null ? 'LESIÓN' : p.roja != null ? 'ROJA' : `NOTA ${nota1(p.nota)}`, p.lesion != null ? `MIN. ${p.lesion}` : p.roja != null ? `MIN. ${p.roja}` : `${p.min} MIN`, ante(p))) });
  if (carga.length >= 2) paneles.push({ titulo: 'MÁS MINUTOS EN EL PARÓN', bueno: true, flecha: false,
    filas: carga.slice(0, 5).map((r) => fila(r, `${r.min} MIN`, `${r.jugados} ${r.jugados === 1 ? 'PARTIDO' : 'PARTIDOS'}`, String(r.sel.nombre).toUpperCase())) });
  const d = { titulo: 'SELECCIONES', sub: `${diaSemana(v.ayer)} ${fechaTxt(v.ayer)}`.toUpperCase(), sub2: 'JUGADORES DE LALIGA', paneles };
  const todas = paneles.flatMap((x) => x.filas);
  const tarjeta = { tipo: 'mercado', nombre: `selecciones-dia-${v.ayer}`, d,
    permitidos: { numeros: [Number(v.ayer.slice(6)), ...todas.flatMap((f) => [f.dif, f.pct, f.valor])].map(String),
      palabras: ['SELECCIONES', 'JUGADORES', 'DE', 'LALIGA', 'LOS', 'MEJORES', 'NOTA', 'VALE', 'M', 'K', 'PEORES', 'MÁS', 'MINUTOS', 'EN', 'EL', 'PARÓN', 'MIN', 'ANTE', 'GOL', 'GOLES', 'ASIST', 'Y',
        'LESIÓN', 'ROJA', 'PARTIDO', 'PARTIDOS', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO', ...MESES.map((m) => m.toUpperCase()),
        ...todas.flatMap((f) => [f.nombre, f.equipo, f.valor])] } };

  // una tarjeta más por cada una de las selecciones de ayer con más jugadores de LaLiga (3 o más que jugaran; España primero), con los
  // colores de su bandera y sus jugadores (Carlos, 9 nov 11:03); como mucho 2, para que el tuit no pase de 3 imágenes
  const grupos = new Map();
  for (const x of deAyer) { const k = `${x.p.idPartido}|${x.r.sel.nombre}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); }
  const jugaronEn = (xs) => xs.filter((x) => x.p.min > 0).length;
  const valorDe2 = (xs) => xs.reduce((n, x) => n + (Number(x.r.j.marketValue) || 0), 0);
  const grandes = [...grupos.values()].filter((xs) => jugaronEn(xs) >= 3)
    .sort((a, b) => (b[0].r.sel.codigo === 'ESP') - (a[0].r.sel.codigo === 'ESP') || jugaronEn(b) - jugaronEn(a) || valorDe2(b) - valorDe2(a)).slice(0, 2);
  const deUnPais = grandes.map((xs) => {
    const s0 = xs[0].r.sel, p0 = xs[0].p;
    const filas = [...xs].sort((a, b) => (b.p.goles * 2 + b.p.asist) - (a.p.goles * 2 + a.p.asist) || b.p.min - a.p.min || Number(b.r.j.marketValue) - Number(a.r.j.marketValue)).slice(0, 8)
      .map(({ r, p }) => {
        const g = corto2(p), vl = valeTxt(r);
        const dif = p.lesion != null ? 'LESIÓN' : p.roja != null ? 'ROJA' : g || (p.min ? `${p.min} MIN` : 'SIN JUGAR');
        const pct = p.lesion != null ? `MIN. ${p.lesion}` : p.roja != null ? `MIN. ${p.roja}` : g ? `${p.min} MIN${vl ? ` · ${vl}` : ''}` : vl;
        return { ...fila(r, dif, pct, null), bueno: p.lesion == null && p.roja == null };
      });
    const d1 = { pais: String(s0.nombre).toUpperCase(), colores: s0.colores, banderaUrl: s0.banderaUrl, sub: 'LOS DE LALIGA', fecha: `${diaSemana(v.ayer)} ${fechaTxt(v.ayer)}`.toUpperCase(),
      marcador: p0.marcador, rival: { nombre: String(p0.rival.nombre).toUpperCase(), banderaUrl: p0.rival.banderaUrl }, filas };
    return { tipo: 'seleccion', nombre: `seleccion-${s0.codigo || 'x'}-${v.ayer}`, d: d1,
      permitidos: { numeros: [Number(v.ayer.slice(6)), p0.marcador, ...filas.flatMap((f) => [f.dif, f.pct])].filter(Boolean).map(String),
        palabras: ['LOS', 'DE', 'LALIGA', 'ANTE', 'MIN', 'VALE', 'M', 'K', 'GOL', 'GOLES', 'ASIST', 'Y', 'SIN', 'JUGAR', 'LESIÓN', 'ROJA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO',
          ...MESES.map((m) => m.toUpperCase()), d1.pais, d1.rival.nombre, ...filas.flatMap((f) => [f.nombre, f.equipo])] } };
  });
  if (deUnPais.length) log(`  (selecciones-dia) tarjetas de selección: ${deUnPais.map((x) => `${x.d.pais} (${x.d.filas.length})`).join(', ')}`);

  // los hechos para la IA: cada uno con lo que hizo, contra quién, el marcador, los minutos y la nota; las lesiones, solo las que marca FotMob
  const sel = (s) => ({ seleccion: s.nombre, ...(s.bandera ? { bandera: s.bandera } : {}) });
  // la nota, solo la que llama la atención (9 o más, 5,5 o menos) y la de los peores, que es su motivo: el resto no la lleva.
  // `cuando`: mediodía, tarde o noche (el revisor tiraba «noche» sin el dato)
  const partido = (p, { conNota = false } = {}) => ({ ...(p.hora && franja(p.hora) ? { cuando: franja(p.hora) } : {}), rival: p.rival.nombre, ...(p.rival.bandera ? { banderaRival: p.rival.bandera } : {}), ...(p.marcador ? { marcador: p.marcador, resultado: p.resultado } : {}),
    minutos: p.min, ...(p.titular ? {} : { entroDesdeElBanquillo: true }), ...(p.nota != null && (conNota || p.nota >= 9 || p.nota <= 5.5) ? { notaFotMob: nota1(p.nota) } : {}), ...(p.mejor ? { mejorDelPartido: true } : {}) });
  const jug = (r, extra, principal = false) => { const h = jugadorH(r.j, { equipos, principal, datos: false, extra: { club: eq(r), ...sel(r.sel), ...extra } }); delete h.mediaPuntos; return h; };
  const vuelta = paron && paron.ini ? FECHA_VUELTA.format(new Date(paron.ini)) : null;
  const hechos = { tipo: 'selecciones-dia', noticia: `lo que hicieron ayer (${ayerTxt}) los jugadores de LaLiga con sus selecciones: los mejores, los peores y los minutos que llevan`,
    momento: `parón de selecciones; la liga vuelve con la jornada ${v.siguiente}${vuelta ? ` el ${vuelta}` : ''}`,
    aviso: 'los partidos fueron ayer: cuéntalos en pasado. Lo que más le importa al mánager es lo que vale cada uno, si se ha revalorizado o ha bajado y los minutos; la nota de FotMob (de 0 a 10) solo viene cuando llama la atención o explica por qué alguien está entre los peores: úsala como mucho dos veces en todo el tuit («un 9,3», «un 4,6»), nunca la de todos.' + '  Una lesión, solo la que viene en «losPeores» y tal como está: ni gravedad ni plazos. Nada de convocatorias ni de partidos que no estén aquí. La bandera va justo detrás del nombre de su selección y solo la que trae cada una. La carga (minutos en el parón) sirve para pensar en la jornada de vuelta, sin dar por hecho que vaya a descansar. La imagen adjunta lleva a los mejores, los peores y los que más minutos llevan.',
    losMejores: mejores.slice(0, 4).map(({ r, p }) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel), ...(ga(p) ? { loQueHizo: ga(p) } : {}), ...partido(p), ...valores.get(r) })),
    ...(peores.length ? { losPeores: peores.slice(0, 3).map(({ r, p }) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel),
      queLePaso: p.lesion != null ? `se retiró lesionado en el minuto ${p.lesion}` : p.roja != null ? `le echaron con roja en el minuto ${p.roja}` : 'tuvo una nota baja', ...partido(p, { conNota: p.lesion == null && p.roja == null }), ...valores.get(r) })) } : {}),
    ...(carga.length ? { masMinutosEnElParon: carga.slice(0, 4).map((r) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel), minutosEnElParon: r.min, partidosJugados: r.jugados, ...valores.get(r) })) } : {}),
    ...(sinJugar.length ? { ayerSinJugar: sinJugar.slice(0, 3).map(({ r }) => ({ nombre: r.j.nickname, club: eq(r), ...sel(r.sel), queLePaso: 'estuvo en el banquillo y no jugó' })) } : {}),
    jugadores: [...mejores.slice(0, 3).map((x, i) => jug(x.r, {}, i === 0)), ...peores.slice(0, 2).map((x) => jug(x.r, {}, true)), ...carga.slice(0, 2).filter((r) => ![...mejores.slice(0, 3), ...peores.slice(0, 2)].some((x) => x.r === r)).map((r) => jug(r, {}))],
    clubes: clubesH(...[...mejores.slice(0, 4).map((x) => x.r), ...peores.slice(0, 3).map((x) => x.r), ...carga.slice(0, 4), ...sinJugar.slice(0, 3).map((x) => x.r)].map(eq)) };
  if (deUnPais.length) hechos.aviso += ` Además van ${deUnPais.length === 1 ? 'una imagen' : 'dos imágenes'} con los jugadores de LaLiga de ${enLista(grandes.map((xs) => xs[0].r.sel.nombre))}.`;
  return [{ tipo: 'selecciones-dia', clave: `selecciones-dia|${v.jugada}|${v.ayer}`, jornada: v.jugada, texto, hechos, numeros: num, partido: null, tarjeta: [tarjeta, ...deUnPais] }];
}
