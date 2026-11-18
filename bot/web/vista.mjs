// Los hechos de la previa escritos como se leen (fechas en castellano, dinero en M, porcentajes con coma): lo que recibe quien
// redacta y lo que enseña la página. Así las cifras del texto se pueden comprobar contra lo que de verdad sale en la página.
export const APARTADOS = ['intro', 'clausulas', 'chollos', 'sancionados', 'apercibidos', 'bajas', 'vuelven', 'mercado'];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const F = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const SEM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** las piezas de una fecha en Madrid */
export function enMadrid(t) {
  const p = Object.fromEntries(F.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { dia: +p.day, mes: +p.month, anio: +p.year, sem: SEM[p.weekday], hora: `${p.hour}:${p.minute}` };
}
/** «jueves 19 de noviembre a las 21:00» */
export const fechaHora = (t) => { const d = enMadrid(t); return `${DIAS[d.sem]} ${d.dia} de ${MESES[d.mes - 1]} a las ${d.hora}`; };
/** «jueves 19 de noviembre» */
export const fecha = (t) => { const d = enMadrid(t); return `${DIAS[d.sem]} ${d.dia} de ${MESES[d.mes - 1]}`; };
/** «vie 20» y «21:00» para la tabla de partidos */
export const diaCorto = (t) => { const d = enMadrid(t); return `${DIAS[d.sem].slice(0, 3)} ${d.dia}`; };
export const hora = (t) => enMadrid(t).hora;

const coma = (x, d = 1) => (Math.round(Number(x) * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
/** «132,2 M» o «735 mil» */
export const dinero = (x) => { const a = Math.abs(Number(x)) || 0; return a >= 1e6 ? `${coma(a / 1e6).replace(/^(\d+)(\d{3})(?=,|$)/, '$1.$2')} M` : `${Math.round(a / 1e3)} mil`; };
/** «+19,4 M» / «-9,6 M» */
export const dif = (x) => `${x >= 0 ? '+' : '-'}${dinero(x)}`;
export const pct = (x) => `${x >= 0 ? '+' : ''}${coma(x)} %`;

const jug = (x, extra = {}) => ({ nombre: x.nombre, equipo: x.equipo, puesto: x.pos, media: coma(x.media), valor: dinero(x.valor),
  ...(x.rival ? { rivalEnLaJornada: `${x.rival} (${x.casa ? 'en casa' : 'fuera'})` } : {}), ...(x.titularPct != null ? { titularTemporada: `${x.titularPct} % de los partidos con más de 60 minutos` } : {}), ...extra });

// lo que suele pasar con una racha así, en palabras (las cifras, de PROB en web/mercado.mjs)
const QUE_PASA = { sube3: (p) => `de los que llevan 3 días subiendo, el ${p} sube también el cuarto`, sube4: (p) => `de los que llevan 4 días o más subiendo, el ${p} sube también el siguiente`,
  acelera: (p) => `cuando la subida de hoy es mayor que la de ayer, sigue subiendo el ${p}`, frena: (p) => `cuando la subida de hoy es menos de la mitad que la de ayer, solo sigue el ${p}` };
export const quePasa = (x) => (QUE_PASA[x.por] || QUE_PASA.sube3)(`${String(x.prob).replace('.', ',')} %`);
/** el criterio de los chollos, como se lee en la página */
export const criterioChollos = (c) => `valen menos de ${String(c.valor / 1e6).replace('.', ',')} M, han jugado 60 minutos o más en al menos ${c.ult5} de sus 5 últimos partidos, llevan ${c.media} puntos de media o más, su valor sube desde hace ${c.racha} días o más y su rival de esta jornada no está entre los difíciles`;

/** la vista de los hechos (lo que lee quien redacta). Solo cadenas: cada cifra, como va escrita en la página */
export function vista(h) {
  const J = h.jornada;
  const cambios = h.cambiosAntesDelCierre || [];
  return {
    jornada: `jornada ${J} (la de esta previa: todavía no ha empezado)`,
    siguiente: `jornada ${J + 1} (la de después; la que se perdería un apercibido que vea amarilla en la ${J})`,
    primerPartido: `${h.primerPartido.local}-${h.primerPartido.visitante}, el ${fechaHora(h.primero)}`,
    ultimoPartido: `el ${fechaHora(h.ultimo)}`,
    ...(h.diasDesdeAnterior > 9 ? { paron: `antes de la jornada ${J} hay un parón: ${h.diasDesdeAnterior} días sin partidos desde que acabó la ${J - 1}` } : {}),
    clausulas: {
      cierre: `el ${fechaHora(h.cierre)} (24 horas antes del primer partido)`, reapertura: `el ${fechaHora(h.reapertura)} (cuando empieza el primer partido)`,
      cambiosDeMercadoAntesDelCierre: cambios.length ? `${cambios.length}: las noches del ${cambios.map((t) => fecha(t - 36e5)).join(', ')}` : 'ninguno',
    },
    partidos: h.partidos.map((p) => `${fechaHora(p.t)}: ${p.local}-${p.visitante}`),
    ...(h.chollos ? { chollos: { criterio: `chollos: los que ${criterioChollos(h.chollos.criterio)}`, lista: h.chollos.lista.map((x) => jug(x, {
      diasSeguidosSubiendo: `${x.diasSubiendo}`, ...(x.diasSubiendo >= 10 ? { rachaLarga: 'de las rachas que llegan a tres días, solo el 42,2 % llega a diez' } : {}), hoy: dif(x.ultimoDia), titularUltimos5: `${x.ult5} de sus 5 últimos partidos con 60 minutos o más`, nivelDelRival: x.nivelRival, queSuelePasar: quePasa(x) })) } } : {}),
    sancionados: { lista: h.sancionados.map((x) => jug(x, { motivo: x.motivo })) },
    apercibidos: { lista: h.apercibidos.map((x) => jug(x, { amarillas: `${x.amarillas} amarillas`, ...(x.rivalSiguiente ? { seLaPerderiaContra: `${x.rivalSiguiente} en la jornada ${J + 1}` } : {}) })) },
    bajas: {
      lista: h.bajas.map((x) => jug(x, { estado: 'lesionado (LaLiga lo da de baja)', ...(x.lesion ? { parte: x.lesion } : {}), ...(x.hasta ? { vueltaPrevista: x.hasta } : {}), ...(x.desdeDias ? { fuera: `${x.desdeDias} días` } : {}), ...(x.parteEstado && x.parteEstado !== 'baja' ? { elParteDice: x.parteEstado === 'duda' ? `duda para la jornada ${J}` : `disponible para la jornada ${J}` } : {}) })),
      dudas: h.dudas.map((x) => jug(x, { estado: 'duda (LaLiga)', ...(x.lesion ? { parte: x.lesion } : {}) })),
    },
    vuelven: { lista: h.vuelven.map((x) => jug(x, { parte: x.lesion, fuera: `${x.diasFuera} días`, estadoLaLiga: x.estadoLaLiga })) },
    mercado: {
      queEs: 'subida o bajada de valor en los últimos 7 cambios de mercado (LaLiga Fantasy)',
      suben: h.suben.map((x) => ({ nombre: x.nombre, equipo: x.equipo, valor: dinero(x.valor), en7dias: dif(x.dif7), porcentaje: pct(x.pct7), diasSeguidosSubiendo: `${x.diasSubiendo}`, ...(x.estado !== 'ok' ? { estado: x.estado } : {}) })),
      bajan: h.bajan.map((x) => ({ nombre: x.nombre, equipo: x.equipo, valor: dinero(x.valor), en7dias: dif(x.dif7), porcentaje: pct(x.pct7), diasSeguidosBajando: `${x.diasBajando}`, ...(x.estado !== 'ok' ? { estado: { injured: 'lesionado', doubtful: 'duda', suspended: 'sancionado' }[x.estado] || x.estado } : {}) })),
    },
  };
}
