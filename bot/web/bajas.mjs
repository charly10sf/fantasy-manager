// Las bajas de la jornada en una URL fija (bajas/, idea 5 del plan de AdSense, sesión 4): lesionados y dudas con el parte, sancionados
// con su motivo, apercibidos titulares con el partido que se perderían y los que vuelven tras 10 días o más fuera. De cada uno, su valor,
// lo que lleva bajando y qué suele compensar hacer según la guía de cuándo vender (guias/cuando-vender.html, «Lesionados y sancionados:
// vender o aguantar»). Los datos, de `hechosJornada` (web/hechos.mjs, lo mismo que la previa) con el mercado de esa noche. Se rehace
// cada noche con «Portal web». Texto con reglas, sin IA; el resumen por equipo, solo de los que tienen algo que contar.
import { hechosJornada } from './hechos.mjs';
import { diasHastaVuelta, desdeTxt, lesionTxt } from '../lib/partes.mjs';
import { el, al } from '../lib/texto.mjs';
import { fechaHora } from './vista.mjs';
import { e, bloque, tabla, kpis, celdaJug, coma, dinero, dif, cambio, fechaCorta, diaMadrid } from './portal.mjs';

const DIA = 864e5;
const POSN = { portero: 1, defensa: 2, centrocampista: 3, delantero: 4 };

/** un número fijo por texto (FNV-1a): la forma de decir algo, siempre la misma para el mismo caso */
function huella(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const elige = (semilla, formas) => formas[huella(semilla) % formas.length];
const may = (f) => f.charAt(0).toUpperCase() + f.slice(1);
const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');

/** el valor de un jugador un día (el último conocido hasta ese día) */
function valorEn(serie, t) {
  let v = serie && serie.length ? serie[0].v : null;
  for (const x of serie || []) { if (x.t > t) break; v = x.v; }
  return v;
}

/**
 * Qué suele compensar, con la tabla de la guía de cuándo vender: un partido (sanción o molestia), aguantar; dos o tres semanas,
 * depende; un mes o más, vender pronto. { k: 'aguanta'|'depende'|'vende'|'sin', txt }
 */
export function consejo(x, ahora = Date.now()) {
  if (x.tipo === 'sancion') return x.partidos >= 3 ? { k: 'depende', txt: `Depende: son ${x.partidos} partidos` } : { k: 'aguanta', txt: 'Aguantar: es un partido' };
  if (x.tipo === 'duda') return { k: 'aguanta', txt: 'Aguantar y mirar la convocatoria' };
  const d = x.parte && x.parte.estado === 'baja' ? diasHastaVuelta(x.parte, ahora) : null;
  if (d == null) return { k: 'sin', txt: 'Sin fecha de vuelta: mira el parte del club' };
  if (d < 14) return { k: 'aguanta', txt: d <= 3 ? 'Aguantar: ya casi vuelve' : 'Aguantar: menos de dos semanas' };
  if (d < 30) return { k: 'depende', txt: 'Depende: dos o tres semanas fuera' };
  return { k: 'vende', txt: d >= 150 ? 'Vender ya: no vuelve hasta el final' : 'Vender pronto: un mes o más fuera' };
}

/**
 * Los hechos de la página. api: la del portal (con `ficha`, `statsSemana`…); hm: lo de `hechosMercado` (el valor y la racha de esa
 * noche de todos, por id). Devuelve null si no hay jornada por delante.
 */
export async function hechosBajas(api, hm, { ahora = Date.now(), log = () => {}, rutas = null } = {}) {
  const h = await hechosJornada({ api, ahora, log, completo: true, sinMercado: true });
  if (!h) return null;
  const fila = new Map((hm ? hm.todas : []).map((f) => [String(f.id), f]));
  const junta = (x, tipo) => {
    const f = fila.get(String(x.id)) || {};
    const p = x.parte || null;
    // lo que ha perdido desde que se lesionó (el día del parte), si hay serie y parte con fecha
    let desde = null;
    if (p && p.dia && p.mes && f.temporada && f.temporada.length) {
      const hoy = new Date(ahora);
      let t = Date.UTC(hoy.getUTCFullYear(), p.mes - 1, p.dia, 12);
      if (t > ahora) t = Date.UTC(hoy.getUTCFullYear() - 1, p.mes - 1, p.dia, 12);
      const v0 = valorEn(f.temporada, t);
      if (v0 && ahora - t >= 3 * DIA) desde = { t, v: v0, dif: (f.valor || x.valor) - v0 };
    }
    const y = { ...x, tipo, pos: POSN[x.pos] || f.pos || null, posTxt: x.pos, teamId: f.teamId || null, caraUrl: f.caraUrl || null, escudoUrl: f.escudoUrl || null,
      valor: f.valor || x.valor, dif7: f.dif7 ?? null, pct7: f.pct7 ?? null, racha: f.racha ?? 0, rachaDif: f.rachaDif ?? 0, desde,
      vuelta: p && p.estado === 'baja' ? diasHastaVuelta(p, ahora) : null, ruta: rutas ? rutas.jugador(x.id) : null };
    y.consejo = consejo(y, ahora);
    return y;
  };
  const bajas = h.bajas.map((x) => junta(x, 'baja')), dudas = h.dudas.map((x) => junta(x, 'duda'));
  const sancionados = h.sancionados.map((x) => junta(x, 'sancion')), apercibidos = h.apercibidos.map((x) => junta(x, 'apercibido'));
  const vuelven = h.vuelven.map((x) => junta(x, 'vuelve'));
  // por equipo: los que tienen dos o más bajas, dudas o sancionados entre los que pesan
  const porEq = {};
  for (const x of [...bajas, ...dudas, ...sancionados]) (porEq[x.equipo] ||= []).push(x);
  const equipos = Object.entries(porEq).filter(([, xs]) => xs.length >= 3 || (xs.length >= 2 && xs.reduce((s, x) => s + (x.valor || 0), 0) >= 30e6)).map(([equipo, xs]) => ({ equipo, xs, valor: xs.reduce((s, x) => s + (x.valor || 0), 0),
    ap: apercibidos.filter((a) => a.equipo === equipo), vuelven: vuelven.filter((v) => v.equipo === equipo) })).sort((a, b) => b.xs.length - a.xs.length || b.valor - a.valor);
  return { jornada: h.jornada, ahora, dia: diaMadrid(ahora), primero: h.primero, partido: h.primerPartido, cierre: h.cierre, bajas, dudas, sancionados, apercibidos, vuelven, equipos,
    partesApp: h.partesApp || [] };
}

// ---------------------------------------------------------------- el texto

/** la frase de un equipo con varias bajas: quién falta, lo que vale entre todos y, si hay, apercibidos y quien vuelve. Las formas van
    rotando según el orden (i), para que dos equipos seguidos no se cuenten con la misma frase */
function fraseEquipo(q, J, i) {
  const nombres = q.xs.map((x) => `${x.nombre}${x.tipo === 'duda' ? ' (duda)' : x.tipo === 'sancion' ? ' (sancionado)' : ''}`);
  const n = q.xs.length, vale = dinero(q.valor), E = el(q.equipo);
  const largas = q.xs.filter((x) => x.consejo.k === 'vende').length;
  const extra = [largas ? `${largas === 1 ? 'una de ellas es larga' : `${largas} de ellas son largas`} (un mes o más)` : '',
    q.ap.length ? `${q.ap.length === 1 ? `${q.ap[0].nombre} está` : `${lista(q.ap.map((a) => a.nombre))} están`} a una amarilla de la sanción` : '',
    q.vuelven.length ? `${lista(q.vuelven.map((v) => v.nombre))} ${q.vuelven.length === 1 ? 'vuelve' : 'vuelven'}` : ''].filter(Boolean);
  const cola = extra.length ? ` ${may(lista(extra))}.` : '';
  const formas = [
    `${may(E)} es el más castigado: ${n} bajas o dudas que pesan en el fantasy, ${vale} entre todos: ${lista(nombres)}.${cola}`,
    `En ${E} faltan o están en el aire ${lista(nombres)}: ${vale} en valor de mercado.${cola}`,
    `${lista(nombres)}: ${n} problemas para ${E}, que suman ${vale}.${cola}`,
    `${may(E)} tampoco llega entero a la jornada ${J}: ${lista(nombres)}.${cola}`,
    `${may(al(q.equipo))} le faltan ${n === 2 ? 'dos' : n}, ${lista(nombres)}, que juntos valen ${vale}.${cola}`,
  ];
  return i === 0 ? formas[0] : formas[1 + ((i - 1) % (formas.length - 1))];
}

/** lo de arriba de la página, contado con los datos del día */
function entrada(b) {
  const fr = [];
  const tot = b.bajas.length + b.dudas.length + b.sancionados.length;
  const cuando = b.primero ? `, que empieza el ${fechaHora(b.primero)} con el ${b.partido.local}-${b.partido.visitante}` : '';
  fr.push(`Para la jornada ${b.jornada}${cuando}, LaLiga Fantasy da ${b.bajas.length} ${b.bajas.length === 1 ? 'lesionado' : 'lesionados'}, ${b.dudas.length} ${b.dudas.length === 1 ? 'duda' : 'dudas'} y ${b.sancionados.length} ${b.sancionados.length === 1 ? 'sancionado' : 'sancionados'} entre los jugadores que pesan en el juego: titulares habituales, con 3 puntos de media o más, o que valen 8 M o más.`);
  const caro = [...b.bajas, ...b.sancionados].sort((x, y) => y.valor - x.valor)[0];
  if (caro) fr.push(`La baja que más vale es la de ${caro.nombre} (${caro.equipo}, ${dinero(caro.valor)})${caro.tipo === 'sancion' ? `, sancionado por ${caro.motivo}` : caro.lesion ? `, con ${lesionTxt(caro)}` : ''}.`);
  const largas = b.bajas.filter((x) => x.consejo.k === 'vende');
  if (largas.length) fr.push(`${largas.length === 1 ? `Uno tiene` : `${largas.length} tienen`} para un mes o más según el parte: ${lista(largas.slice(0, 4).map((x) => x.nombre))}${largas.length > 4 ? ' y otros' : ''}.`);
  const pierde = [...b.bajas].filter((x) => x.desde && x.desde.dif < 0).sort((x, y) => x.desde.dif - y.desde.dif)[0];
  if (pierde) fr.push(`Desde que se lesionó, el ${fechaCorta(pierde.desde.t)}, ${pierde.nombre} ha perdido ${dinero(-pierde.desde.dif)} de valor: es el que más se ha dejado de los que están de baja.`);
  if (b.apercibidos.length) fr.push(`Además, ${b.apercibidos.length === 1 ? 'un titular está' : `${b.apercibidos.length} titulares están`} a una amarilla de perderse la jornada ${b.jornada + 1}.`);
  if (!tot) fr.push('Es raro, pero no hay ninguna baja importante.');
  return fr;
}

const celda = (x, raiz, sub) => celdaJug({ ...x, nombre: x.nombre, equipo: x.equipo }, { enlace: x.ruta ? `${raiz}${x.ruta}` : null, sub });
const v7 = (x) => (x.dif7 == null ? '—' : cambio(x.dif7, dif(x.dif7)));
const rachaTxt = (x) => (x.racha <= -3 ? `${-x.racha} días bajando` : x.racha >= 3 ? `${x.racha} días subiendo` : '');
const chipC = (c) => `<span class="cons cons-${c.k}">${e(c.txt)}</span>`;

/** bajas/index.html */
export function contenidoBajas(b, { previa = null } = {}) {
  const raiz = '../', J = b.jornada;
  const o = [];
  o.push(`  <h1>Bajas de la jornada <span>${J}</span></h1>`);
  o.push(`  <p class="fresco">Estados de LaLiga Fantasy y partes médicos del ${e(fechaHora(b.ahora))} · se rehace cada noche</p>`);
  o.push(kpis([
    { v: String(b.bajas.length), l: 'Lesionados' }, { v: String(b.dudas.length), l: 'Dudas' },
    { v: String(b.sancionados.length), l: 'Sancionados' }, { v: String(b.apercibidos.length), l: 'Apercibidos' },
  ], 'k4'));
  o.push(entrada(b).map((f) => `  <p>${e(f)}</p>`).join('\n'));

  // lesionados
  const filaB = (x) => celda(x, raiz, `${x.posTxt} · ${x.equipo}`) + `<td>${e(x.lesion ? may(lesionTxt(x)) : '—')}${x.parte && desdeTxt(x.parte, b.ahora) ? `<br><small>${e(desdeTxt(x.parte, b.ahora))}</small>` : ''}</td>`
    + `<td>${e(x.hasta || (x.tipo === 'duda' ? 'Puede jugar' : 'Sin fecha'))}</td><td class="n">${e(dinero(x.valor))}</td><td class="n m">${v7(x)}${rachaTxt(x) ? `<br><small>${e(rachaTxt(x))}</small>` : ''}</td><td>${chipC(x.consejo)}</td>`;
  const colsB = [{ t: 'Jugador', c: 'j' }, { t: 'Parte' }, { t: 'Vuelta' }, { t: 'Valor', c: 'n' }, { t: '7 días', c: 'n m' }, { t: 'Qué suele compensar' }];
  if (b.bajas.length) {
    const vende = b.bajas.filter((x) => x.consejo.k === 'vende').length, aguanta = b.bajas.filter((x) => x.consejo.k === 'aguanta').length;
    o.push(bloque('Lesionados', tabla(colsB, b.bajas.map(filaB), { clase: 'td-bajas' }), { id: 'lesionados',
      linea: e(`${aguanta ? `${aguanta} vuelven en menos de dos semanas según el parte` : 'Ninguno vuelve en menos de dos semanas según el parte'}${vende ? `; ${vende} tienen para un mes o más` : ''}. `) + `Por qué cada consejo, en <a href="${raiz}guias/cuando-vender.html">cuándo vender a un lesionado</a>.` }));
  } else o.push(bloque('Lesionados', '  <p>Ningún jugador que pese en el fantasy está lesionado ahora mismo.</p>', { id: 'lesionados' }));

  if (b.dudas.length) o.push(bloque('Dudas', tabla(colsB, b.dudas.map(filaB), { clase: 'td-bajas' }), { id: 'dudas',
    linea: e(`Pueden jugar o no: lo dice la convocatoria, que la mayoría de equipos publica la víspera o el día del partido.`) }));

  // sancionados
  if (b.sancionados.length) o.push(bloque(`Sancionados para la jornada ${J}`, tabla([{ t: 'Jugador', c: 'j' }, { t: 'Motivo' }, { t: 'Rival' }, { t: 'Media', c: 'n' }, { t: 'Valor', c: 'n' }, { t: 'Qué suele compensar' }],
    b.sancionados.map((x) => celda(x, raiz, `${x.posTxt} · ${x.equipo}`) + `<td>${e(may(x.motivo))}</td><td>${e(x.rival ? `${x.casa ? 'vs' : 'en'} ${x.rival}` : '')}</td><td class="n">${e(coma(x.media))}</td><td class="n">${e(dinero(x.valor))}</td><td>${chipC(x.consejo)}</td>`), { clase: 'td-bajas' }),
  { id: 'sancionados', linea: e(`Solo los que pesan en el fantasy. Con la quinta amarilla o una roja directa se pierde un partido; una sanción de varios, los que diga el Comité.`) }));
  else o.push(bloque(`Sancionados para la jornada ${J}`, '  <p>LaLiga no tiene a ningún jugador importante sancionado para esta jornada.</p>', { id: 'sancionados' }));

  // apercibidos
  if (b.apercibidos.length) o.push(bloque('Apercibidos', tabla([{ t: 'Jugador', c: 'j' }, { t: `Jornada ${J}` }, { t: `Se perdería (J${J + 1})` }, { t: 'Titular', c: 'n' }, { t: 'Valor', c: 'n' }],
    b.apercibidos.map((x) => celda(x, raiz, `${x.posTxt} · ${x.equipo}`) + `<td>${e(x.rival ? `${x.casa ? 'vs' : 'en'} ${x.rival}` : '')}</td><td>${e(x.rivalSiguiente || '—')}</td><td class="n">${x.titularPct != null ? `${x.titularPct} %` : '—'}</td><td class="n">${e(dinero(x.valor))}</td>`), { clase: 'td-bajas' }),
  { id: 'apercibidos', linea: `Titulares habituales con cuatro amarillas: si ven otra en la jornada ${J}, no juegan la ${J + 1}. No es una baja ni hay que venderlos por eso: <a href="${raiz}guias/apercibidos-laliga.html">qué hacer con un apercibido</a>.` }));

  // vuelven
  if (b.vuelven.length) o.push(bloque('Los que vuelven', tabla([{ t: 'Jugador', c: 'j' }, { t: 'Tenía' }, { t: 'Días fuera', c: 'n' }, { t: 'LaLiga lo da', c: 'm' }, { t: 'Valor', c: 'n' }, { t: '7 días', c: 'n m' }],
    b.vuelven.map((x) => celda(x, raiz, `${x.posTxt} · ${x.equipo}`) + `<td>${e(x.lesion ? may(lesionTxt(x)) : '—')}</td><td class="n">${x.diasFuera}</td><td class="m">${e(x.estadoLaLiga)}</td><td class="n">${e(dinero(x.valor))}</td><td class="n m">${v7(x)}</td>`), { clase: 'td-bajas' }),
  { id: 'vuelven', linea: e(`Disponibles para la jornada ${J} según el parte, después de diez días o más fuera.`) }));

  // por equipo, solo los que tienen algo que contar
  if (b.equipos.length) o.push(bloque('Por equipos', b.equipos.map((q, i) => `  <p>${e(fraseEquipo(q, J, i))}</p>`).join('\n'), { id: 'equipos' }));

  o.push(`  <p class="bq-l">${previa ? `El cierre de cláusulas, el calendario y el mercado de la semana, en <a href="${raiz}${e(previa.ruta)}">la previa de la jornada ${previa.jornada}</a>. ` : ''}<a href="${raiz}metodo.html#bajas">Cómo hacemos esta página</a>.</p>`);
  return o.join('\n');
}

export const metasBajas = (b) => ({ ruta: 'bajas/index.html', seccion: 'jornada',
  titulo: `Lesionados y sancionados de LaLiga Fantasy, jornada ${b.jornada}`, h1: `Bajas de la jornada ${b.jornada}`,
  descripcion: `Las bajas de la jornada ${b.jornada} de LaLiga Fantasy: lesionados con su parte y su vuelta, dudas, sancionados con el motivo, apercibidos y los que vuelven, con su valor y qué suele compensar hacer. Se pone al día cada noche.`,
  migas: [['Inicio', ''], ['Jornadas', 'jornada/']] });

/**
 * bajas/partes.json (22 nov): lo que la app no tiene de cada baja y le da el portal, con el id de LaLiga, aparte de los archivos que
 * ya hay. La app lo lee una vez cada pocas horas para la hoja de las bajas de Clubes (web/js/bajas.js). Por jugador, solo lo que
 * sabe: e, lo que dice el parte (b: baja, d: duda, v: disponible); l, la lesión en pocas palabras; d, los días hasta la vuelta
 * contados desde `t`; j, la jornada para la que está en duda o vuelve; s, los partidos de sanción que le quedan; a, las
 * amarillas de un titular a una de la sanción. Sin nombres
 * (la app ya los tiene) ni nada de otras webs.
 */
export function partesJson(hb) {
  const j = {};
  for (const x of hb.partesApp || []) {
    const p = x.parte, o = {};
    if (p) {
      const e = { baja: 'b', duda: 'd', disponible: 'v' }[p.estado];
      if (e) o.e = e;
      const l = lesionTxt(p);
      if (l) o.l = l.length > 60 ? `${l.slice(0, 59).replace(/\s+\S*$/, '')}…` : l;
      const d = p.estado === 'baja' ? diasHastaVuelta(p, hb.ahora) : null;
      // (más de 250 días es un «hasta noviembre» dicho en noviembre, que diasHastaVuelta lleva al año que viene: mejor sin fecha)
      if (d != null && d >= 0 && d <= 250) o.d = d;
      if (p.jornada && p.estado !== 'baja') o.j = p.jornada;
    }
    if (x.quedan) o.s = x.quedan;
    if (Object.keys(o).length) j[x.id] = o;
  }
  // los apercibidos titulares (4, 9, 14… amarillas): a, las amarillas
  for (const x of hb.apercibidos || []) if (x.amarillas) j[x.id] = { ...(j[x.id] || {}), a: x.amarillas };
  return { v: 1, t: hb.ahora, jornada: hb.jornada, j };
}
