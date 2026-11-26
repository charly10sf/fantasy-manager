/* Las operaciones que de verdad se pueden hacer hoy, cada una con su referencia (P-, M-, T-, C-, A-, V-, B- y el id
   del jugador). La IA solo puede recomendar operaciones de esta lista, y el plan se comprueba contra ella: así no
   salen cosas imposibles como comprarle a un rival un jugador que no vende o pujar por uno que ya tiene dueño.
   P  pujar por un jugador LIBRE de la liga (subasta a ciegas al cambiar el mercado)
   M  comprar a otro manager un jugador que TIENE A LA VENTA (decide él si acepta)
   T  un trato con otro manager que le has contado a la IA
   C  clausular a un rival (cláusula abierta ya o que se puede pagar antes de la jornada o justo al empezar: LaLiga
      cierra las cláusulas las 24 h antes del primer partido y las reabre a esa hora; y siempre en las próximas 48 h,
      LIMITE_C: lo de dentro de varios días no se planea hoy)
   A  aceptar la mejor oferta por un jugador tuyo que ya tienes en venta
   V  poner a la venta (o vender) un jugador tuyo
   B  proteger a un jugador tuyo con la cláusula abierta o a punto: con el blindaje gratis de LaLiga (24 h, 2 por
      jornada) o subiéndole la cláusula */
import { eur, pct, cuando, POS, DIA, HORA, num, dura } from './util.js';
import { bloqueada } from './limite.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
const nombreDe = (M, tid) => { const e = tid && M.equipo[tid]; return (e && (e.manager || e.nombre)) || 'un rival'; };

/** hasta dónde se miran las cláusulas que aún no se han abierto: hoy y mañana (48 h) */
export const LIMITE_C = 2 * DIA;

/** (19, aviso de Domy, 9 nov) el parón con la jornada de vuelta a más de 3 días (o la última antes del parón en juego):
 * nadie puntúa hasta la vuelta, así que el plan va de dinero (especular, revalorizar, vender en lo alto) y una cláusula
 * para el once solo vale si es un chollo claro o se hace en los dos o tres días antes de la jornada de vuelta */
export const PARON_VUELTA = 3 * DIA;
/** (11 nov) la cláusula no pasa la regla de Hoy y las alarmas (mereceClausula, motor.js): la IA no la propone para el once */
export const noMerece = (M, o) => {
  if (!M || !M.mereceClausula || !o || !o.pid) return false;
  const x = (M.clausulas || []).find((c) => c.pid === o.pid);
  return !!x && !M.mereceClausula(x);
};

export function paronLejos(M, ahora = Date.now()) {
  return !!(M && M.paron && M.proxima && M.paron.ini <= M.proxima.ini && M.paron.fin > ahora && M.proxima.ini - ahora > PARON_VUELTA);
}
/** un chollo claro en el parón: a un 5 % de su valor como mucho y sin bajar (ni girado, ni parado, ni cayendo en 7 días) */
export function cholloParon(M, j, precio) {
  if (!j || !j.valor || !precio || precio > j.valor * 1.05) return false;
  const ine = M.inercia ? M.inercia(j.id) : null, t = M.tend ? M.tend(j.id) : null;
  if (ine && ['giro', 'baja', 'parado'].includes(ine.fase)) return false;
  return !(t && t.p7 != null && t.p7 < -1);
}

/** (0.7.13p, Carlos 16 nov: «Pepe, Unai López y Valverde como mínimo deberían ser recomendación», con 114 M y 13
    jugadores) en el parón, uno del mercado que sale a su valor (o menos), es bueno (interés 55 o más, o 4 puntos de media)
    y no está bajando también vale para el once si se paga con el saldo que tienes, sin deuda: con dinero de sobra, tenerlo
    parado no cuesta nada. `m` es el del mercado (M.mercado), `puja` lo que se pagaría y `dinero` el saldo de ahora */
export function aSuValorParon(M, m, puja, dinero) {
  if (!m || !m.j || !m.j.valor || !puja || !(dinero > 0) || puja > dinero) return false;
  if (!(m.precio <= m.j.valor * 1.02)) return false;
  if (!((m.interes || 0) >= 55 || num(m.j.media) >= 4)) return false;
  const ine = M.inercia ? M.inercia(m.j.id) : null, t = M.tend ? M.tend(m.j.id) : null;
  if (ine && ['giro', 'baja', 'parado'].includes(ine.fase)) return false;
  return !(t && t.p7 != null && t.p7 < -1);
}

/** (0.7.13p; está aquí para que lo usen el plan de la app y el de la IA) en el parón, ¿sube lo bastante hasta la vuelta para que comprarlo a este precio sea ganar dinero? Si la app lo
    tiene para revender (M.especular), con su cuenta; si no, si sube con fuerza (sube o acelera, +1,5 % hoy o más y +4 % o
    más en 7 días) y no ha girado. { futuro, txt } o null */
export function subeHastaVuelta(M, j, precio) {
  if (!M || !j || !j.valor || !precio) return null;
  const e = (M.especular || []).find((x) => x.pid === j.id);
  // (0.7.13u) si a la puja que gana en tu liga revenderlo no sale, no es dinero: con menos no te lo llevas
  if (!e && M.noRevender && M.noRevender[j.id]) return null;
  if (e && e.valorFuturo > precio) return { futuro: e.valorFuturo, txt: `sube un ${String(Math.round(e.r * 1000) / 10).replace('.', ',')} % al día` };
  const ine = M.inercia ? M.inercia(j.id) : null, t = M.tend ? M.tend(j.id) : null;
  if (!ine || !t || !['sube', 'acelera'].includes(ine.fase)) return null;
  if (t.p1 == null || t.p7 == null) return null;
  // (16 nov, Carlos: «una subida de un 1 % a un jugador de 90 M es mucho más importante que una del 3 % a uno de 10 M»)
  // cuenta el % y también los euros: +1,5 % al día (+4 % en 7), o medio millón al día con +0,4 % (+2 % en 7)
  const euros = j.valor * t.p1 / 100;
  if (!((t.p1 >= 1.5 && t.p7 >= 4) || (euros >= 5e5 && t.p1 >= 0.4 && t.p7 >= 2))) return null;
  // sin la cuenta de la app, solo si lo que paga de más lo recupera con lo que sube hasta la jornada (a un 60 % de su
  // ritmo de hoy; como mínimo, un día)
  const dias = M.proxima && M.proxima.ini ? Math.max(1, (M.proxima.ini - Date.now()) / 864e5) : 1;
  if (precio > j.valor + euros * Math.max(1, dias * 0.6)) return null;
  return { futuro: null, txt: `sube cada día (${eur(Math.round(j.valor * t.p1 / 100), { signo: true })} hoy)` };
}
/** (0.7.13u) la puja con la que se mira si algo es chollo o dinero en el parón: la de la app o, si con esa casi nunca se gana
    en tu liga, la que gana (si no, uno de 86 M que sale a 83,7 M parecía un chollo con una puja que no se lleva nunca) */
export const pujaReal = (o) => (o.pGana != null && o.pGana < 0.25 && o.pujaGana > (o.puja || 0) ? o.pujaGana : o.puja || o.precio);
/** lo que el catálogo le dice a la IA de cada cláusula o puja en el parón: chollo para el once, solo para revender o nada */
function paronC(M, o, precio = o.precio, dinero = null) {
  if (!paronLejos(M) || !o.j) return '';
  const chollo = cholloParon(M, o.j, precio), sube = !!subeHastaVuelta(M, o.j, precio);
  const mm = (M.mercado || []).find((x) => x.pid === o.pid);
  if (!sube && !chollo && mm && aSuValorParon(M, mm, precio, dinero)) return '; PARÓN: SALE A SU VALOR, ES BUENO Y NO BAJA, Y TE LLEGA CON TU SALDO SIN DEUDA: vale para el once (con dinero de sobra, tenerlo parado no cuesta)';
  // (0.7.13p, aviso de Domy) lo que sube hasta la vuelta y se paga a buen precio vale para las dos cosas: es dinero en el
  // parón y llega a tiempo para el once
  if (sube) return '; PARÓN: SUBE HASTA LA VUELTA: comprarlo ahora es ganar dinero y llega a tiempo para el once (vale para revender y para el once)';
  if (chollo) return '; PARÓN: CHOLLO CLARO (a un 5 % de su valor y sin bajar), vale también para el once';
  return '; PARÓN: NO LO PROPONGAS: ni es un chollo para el once ni sube lo bastante para revender';
}

/** el catálogo de hoy: { lista, ref: { 'C-123': op } } */
export function catalogo(D, M, notas = []) {
  const lista = [];
  const add = (op) => { if (op.j) lista.push(op); };
  const yo = D.yo && D.yo.teamId;
  const ahora = Date.now();
  // hasta el primer partido de la jornada (lo que se abre en las 24 h de antes ya viene con la hora del primer partido), pero
  // nunca más allá de LIMITE_C: en un parón la jornada queda a 11 días y la app recomendaba clausular a Huijsen el 19 nov
  // estando a 9 (Carlos, 9 nov 10:17: «no tiene sentido que me recomiende que clausule un jugador que se libera dentro de 10 días»)
  const limiteC = Math.min(M.proxima ? M.proxima.ini : Infinity, ahora + LIMITE_C);

  // A y V: lo tuyo
  for (const v of M.misVentas || []) {
    if (v.mejor && !(M.noVender && M.noVender.has(v.pid))) add({ ref: `A-${v.pid}`, tipo: 'aceptar', pid: v.pid, j: v.j, precio: v.mejor.importe, de: v.mejor.de, caduca: v.mejor.caduca, sobre: v.mejor.sobre, consejo: v.consejo });
  }
  for (const x of M.mias) {
    if (!x.j || (M.enVenta && M.enVenta.has(x.pid))) continue;
    // (22 nov) «a este no lo vendo», dicho en Pregunta: venderlo no está entre lo que se puede hacer hoy
    if (!(M.noVender && M.noVender.has(x.pid))) add({ ref: `V-${x.pid}`, tipo: 'vender', pid: x.pid, j: x.j, precio: x.j.valor, compra: x.compra || null, ganado: x.ganado });
    // (sin riesgo, ni se ofrece: con la cláusula lejos de su valor no hace falta blindarlo; lo vio Carlos el 30 oct)
    if (x.clausula && x.riesgo !== 'ninguno' && !x.noBlindar && (x.abierta || x.abreEn < 2 * DIA)) add({ ref: `B-${x.pid}`, tipo: 'blindar', pid: x.pid, j: x.j, clausula: x.clausula, abierta: x.abierta, abre: x.protegidoHasta, riesgo: x.riesgo, pagan: x.pagan, blindaje: x.blindaje, escudo: x.escudo, escudoGratis: x.abierta && !x.escudo && !!(M.escudosMios && M.escudosMios.quedan), sugerido: (M.paraEscudo || []).includes(x.pid) });
  }
  // P: libres de la liga
  for (const m of M.mercado) {
    if (m.tipo === 'liga') add({ ref: `P-${m.pid}`, tipo: 'pujar', pid: m.pid, j: m.j, precio: m.precio, puja: m.puja, pujaLiga: m.pujaLiga, recortada: m.recortada, pujaGana: m.pujaGana, pGana: m.pGana, pujas: m.pujas, miPuja: m.miPuja, cierra: m.cierra, interes: m.interes, sobre: m.sobre, saldo: num(D.dinero) - num(M.misPujas) });
  }
  // (26 nov) P de entrenador: en una liga premium que los tiene y sin ninguno, el libre que la app ficharía
  // (`M.ficharEntrenador`: los entrenadores no van en `M.mercado`). Se paga con saldo y no ocupa sitio en la plantilla
  // (con la puja ya puesta sigue aquí, con `miPuja`: el paso de un plan guardado no sale como «no está en el mercado»)
  const fe = M.ficharEntrenador ? M.ficharEntrenador() : null;
  const ep = !fe && M.premium && M.premium.entrenador && !M.mias.some((x) => x.j && x.j.pos === 5 && x.j.estado !== 'out_of_league') ? (M.entrenadoresMercado || []).find((m) => m.miPuja) : null;
  const eo = fe || ep;
  if (eo && !lista.some((o) => o.pid === eo.pid)) add({ ref: `P-${eo.pid}`, tipo: 'pujar', entrenador: true, pid: eo.pid, j: eo.j, precio: eo.precio, puja: eo.puja, media: eo.media, miPuja: eo.miPuja || null, cierra: eo.cierra || M.cierreMercado || null, interes: 100, saldo: num(D.dinero) - num(M.misPujas) });
  // M: lo que venden otros managers
  for (const m of M.mercado) {
    if (m.tipo !== 'manager' || m.vendedorTeamId === yo || (M.enVenta && M.enVenta.has(m.pid))) continue;
    // si al venderlo se queda sin poder alinear (su único portero…), no lo va a vender: ni se propone
    if (m.noVende) continue;
    add({ ref: `M-${m.pid}`, tipo: 'comprar', pid: m.pid, j: m.j, precio: m.precio, vendedor: m.vendedor || nombreDe(M, m.vendedorTeamId), vendedorTeamId: m.vendedorTeamId, miPuja: m.miPuja, interes: m.interes, sobre: m.sobre, puja: m.puja, ofertaMin: m.ofertaMin, ofertaAlta: m.ofertaAlta, ofertaLiga: m.ofertaLiga });
  }
  // T: tratos que le has contado (jugador de otro manager con precio)
  for (const n of notas) {
    const tid = n.pid && M.dueno[n.pid];
    if (!tid || tid === yo || !n.importe || lista.some((o) => o.ref === `M-${n.pid}`) || (M.J(n.pid) || {}).pos === 5) continue;
    // (13 nov) «X vende a Pepelu por 43,50 M» no es un trato: es lo que tiene a la venta. Trato es que se lo ofrezca a él
    if (!/\b(me|te|le|nos)\b|ofrec|ofert|trato|acuerd|acord|pact|propo|cambio|trueque/i.test(String(n.texto || ''))) continue;
    add({ ref: `T-${n.pid}`, tipo: 'comprar', trato: true, pid: n.pid, j: M.J(n.pid), precio: n.importe, vendedor: nombreDe(M, tid), vendedorTeamId: tid, nota: n.texto });
  }
  // C: cláusulas abiertas o que se pueden pagar antes de la jornada o justo al empezar. La caja de una cláusula es el
  // saldo; aceptar hoy las ofertas que ya tienes lo sube (lo que pones a la venta, no: no entra hasta aceptar)
  const cajaA = cajaConOfertas(D, M);
  for (const x of M.clausulas) {
    if (!x.abierta && x.protegidoHasta > limiteC) continue;
    const falta = Math.max(0, x.clausula - num(D.dinero));
    add({ ref: `C-${x.pid}`, tipo: 'clausular', pid: x.pid, j: x.j, precio: x.clausula, abierta: x.abierta, abre: x.protegidoHasta, veda: x.veda, de: x.rival.manager || x.rival.nombre, teamId: x.teamId, meLlega: x.meLlega, conA: x.clausula <= cajaA, falta, interes: x.interes, ratio: x.ratio });
  }
  const ref = Object.fromEntries(lista.map((o) => [o.ref, o]));
  return { lista, ref };
}

/** lo que tendrías para una cláusula si aceptas hoy todas las ofertas que ya tienes por lo que vendes */
export const cajaConOfertas = (D, M) => num(D.dinero) + (M.misVentas || []).filter((v) => v.mejor).reduce((s, v) => s + num(v.mejor.importe), 0);

/** cómo se consigue un jugador (o por qué no se puede), en una frase */
export function comoConseguir(D, M, pid, cat) {
  const yo = D.yo && D.yo.teamId;
  const tid = M.dueno[pid];
  if (tid === yo) return 'ES MÍO';
  const ops = cat.lista.filter((o) => o.pid === pid && ['pujar', 'comprar', 'clausular'].includes(o.tipo));
  if (ops.length) return ops.map((o) => `[${o.ref}] ${textoOp(o, M)}`).join(' · ');
  if (!tid) return 'LIBRE pero no está hoy en el mercado: no se puede fichar hasta que salga';
  const x = M.clausulas.find((c) => c.pid === pid);
  const fa = M.fichadoPor && M.fichadoPor(pid);
  return `NO ESTÁ A LA VENTA: es de ${nombreDe(M, tid)}${fa ? `, que lo ${fa.clase === 'clausula' ? 'clausuló' : 'fichó'} ${cuando(fa.t)}` : ''}${x && x.clausula ? `; su cláusula (${eur(x.clausula)}) no se abre hasta ${cuando(x.protegidoHasta)}` : ''}. Se le puede hacer una oferta desde la ficha del jugador (LaLiga lo deja con cualquier jugador de un rival), pero decide su dueño y lo normal es que no acepte por menos de lo que le daría LaLiga`;
}

/** una operación del catálogo en texto, con lo que cuesta y cómo funciona */
/** (24 nov) el titular que baja y no tiene relevo: venderlo va junto con la puja por su recambio, y su oferta no se acepta
 *  hasta tener al nuevo (`M.cambioDe`; lo mismo que hace el plan de la app y que comprueba `cuadrarPlan`) */
function cambioTxt(M, pid, oferta = false) {
  const cb = M && M.cambioDe ? M.cambioDe(pid) : null;
  if (!cb) return '';
  const r = cb.rec.map((x) => `${x.j.nombre} [P-${x.pid}] (+${String(Math.round(x.gana * 10) / 10).replace('.', ',')} pts)`).join(', ');
  return oferta
    ? `; CAMBIO: es titular en mi once, baja y no tengo otro como él: NO ACEPTAR hasta tener a su recambio (${r})`
    : `; CAMBIO: es titular en mi once, baja y no tengo otro como él: venderlo SOLO junto con la puja por su recambio (${r}); si no, ni se propone`;
}
export function textoOp(o, M = null) {
  const j = o.j;
  const sobre = j && j.valor && o.precio ? o.precio / j.valor - 1 : 0;
  const sc = M && M.sobrecoste && j ? M.sobrecoste(j, o.precio) : null;
  const sobreTxt = j && j.valor && o.precio
    ? ` (${pct(sobre * 100)} sobre su valor de ${eur(j.valor)}${sobre > 0.02 ? `: ${eur(o.precio - j.valor)} de más${sc ? `; ÍNDICE DE SOBRECOSTE ${sc.indice}/100 (aguantable para este jugador hasta ~${M.tolerancia(j)})${sc.recTxt ? `, ${sc.recTxt}` : ''}` : ''}` : ''})`
    : '';
  switch (o.ref[0]) {
    case 'P': {
      // (26 nov) un entrenador (liga premium): sin lo de los jugadores (ni lo que se paga por los de su valor, ni revender)
      if (o.entrenador) return `PUJAR por ${j.nombre}, ENTRENADOR LIBRE en el mercado (no tengo entrenador; no ocupa sitio en la plantilla y puntúa 5 si su equipo gana, 2 si empata y 0 si pierde): vale ${eur(o.precio)}, ${String(Math.round(num(o.media) * 10) / 10).replace('.', ',')} puntos por jornada de media${o.cierra ? `, se resuelve ${cuando(o.cierra)}` : ''}; ${o.miPuja ? `MI PUJA ACTUAL ${eur(o.miPuja)}; ` : ''}la app pujaría ${eur(o.puja)}, lo que vale y NI UN EURO MÁS (los entrenadores casi siempre bajan de valor: no sirven para revender), pagado con saldo`;
      // (lo que se paga en esta liga por los libres va entero una sola vez, en su bloque; aquí, lo de los de su valor,
      // que es con lo que hay que comparar: un +100 % por uno de 600 mil puede ser lo normal; Carlos, 30 oct)
      const PV = M && M.pagaLiga && j && j.valor ? M.pagaLiga(j.valor, o.pid) : null;
      const enE = (s) => eur(j.valor * (1 + s));
      // (0.7.13u) por los que venían como él (subida y top), con lo de todas las ligas si en esta hay pocos
      const pvTxt = PV ? `; por ${M.pagaTxt(PV)} se paga de mediana un ${pct(PV.med * 100)} (para él, ${enE(PV.med)}), 3 de cada 4 hasta ${pct(PV.p75 * 100)} (${enE(PV.p75)}) y el 90 % hasta ${pct(PV.p90 * 100)} (${enE(PV.p90)})` : '';
      const ganaTxt = o.pGana != null ? `; con la puja de la app, ${Math.round(o.pGana * 10) <= 0 ? 'casi nunca se gana' : `se gana ${Math.round(o.pGana * 10)} de cada 10 veces`} en esta liga` : '';
      const nr = M && M.noRevender && M.noRevender[o.pid], te = M && M.tener && j ? M.tener(j, null, o.puja) : null;
      const cuentaTxt = `${nr ? `; PARA REVENDER NO SALE con la puja que gana aquí (${eur(nr.puja)}: valdría ${eur(nr.valorFuturo)}, ${eur(nr.beneficio, { signo: true })})` : ''}${te && te.deMas > 2e5 ? `; TENERLO: lo pagado de más (${eur(te.deMas)}) ${te.dias ? `se recupera en ${te.dias} días si sigue subiendo así` : 'no se recupera en un mes al ritmo de ahora'}` : ''}${nr && nr.aguantar ? `; AGUANTÁNDOLO SÍ SALE (para revender más adelante, no antes de la jornada): pujando ${eur(nr.puja)} y PAGÁNDOLO CON SALDO, sin deuda, en ${nr.aguantar.dias} días valdría unos ${eur(nr.aguantar.valorFuturo)} (${eur(nr.aguantar.beneficio, { signo: true })}); tiene 14 días la cláusula cerrada y se vende cuando deje de subir` : ''}`;
      // (19 nov, Carlos: «manda la del plan») si para revenderlo la puja es otra, se dice aquí: el plan va con esa y el chat
      // no puede decir «no pujes tanto» contra el plan (Cubarsí en el parón: 44,70 M para tenerlo, 49,81 M para revender)
      const espP = !nr && (M && M.especular || []).find((e) => e.pid === o.pid && e.origen === 'mercado');
      const revTxt = espP && espP.puja && Math.abs(espP.puja - o.puja) > 1e5 ? `; PARA REVENDERLO la app puja ${eur(espP.puja)}: si EL PLAN DE HOY lo lleva, la puja que vale es la del plan` : '';
      // (25 nov, B7) si el plan lo ha mirado y no lo ficha, la cifra es la del plan («se paga a unos 45,04 M», la que gana en
      // tu liga), no «la app pujaría 39,45 M»: eran dos pujas del motor y al chat le llegaban las dos (Xavi Espart)
      const df = M && M.decisionFichar ? M.decisionFichar(o.pid) : null;
      const gana = (nr && nr.puja) || (o.pujaGana > (o.puja || 0) ? o.pujaGana : null);
      const pujaTxt = df && df.accion === 'no' && !df.retira && gana
        ? `; para ganarlo en tu liga se paga a unos ${eur(gana)} (${pct((gana / o.precio - 1) * 100)})`
        : `; la app pujaría ${eur(o.puja)} (${pct((o.puja / o.precio - 1) * 100)})${o.recortada ? `, recortada para no pagar de más por lo que aporta${o.pujaGana > o.puja ? ` (para llevárselo casi seguro harían falta ${eur(o.pujaGana)})` : ''}` : ''}${ganaTxt}`;
      return `PUJAR por ${j.nombre}, LIBRE en el mercado de la liga${paronC(M, o, pujaReal(o), o.saldo)}: subasta a ciegas, puja mínima ${eur(o.precio)}${o.pujas ? `, lleva ${o.pujas} pujas` : ''}${o.cierra ? `, se resuelve ${cuando(o.cierra)}` : ''}${o.miPuja ? `; MI PUJA ACTUAL ${eur(o.miPuja)}` : ''}${pvTxt}${pujaTxt}${cuentaTxt}${revTxt}`;
    }
    case 'M': {
      const ol = o.ofertaLiga || (M && M.ofertaLigaDe ? M.ofertaLigaDe(j) : null);
      const laliga = ol && !ol.sinDatos
        ? `; LaLiga TAMBIÉN le hace su oferta por él, que SOLO VE ÉL (yo no sé cuánto es hoy): cada oferta de LaLiga va de −10 % a +10 % de su valor y, esperando a una buena, en esta liga (${ol.n} ventas) se le acaba sacando unos ${eur(ol.v)}, normalmente entre ${eur(ol.min)} y ${eur(ol.max)}; él se queda con la mejor: por debajo de eso lo normal es que NO TE LO VENDA, salvo que él mismo te diga un precio`
        : '; LaLiga TAMBIÉN le hace su oferta por él (aún no sé cuánto suele dar en esta liga) y él se queda con la mejor, así que ofrecerle solo su valor puede no bastar';
      const min = o.ofertaMin ? `; OFERTA MÍNIMA CON OPCIONES ${eur(o.ofertaMin)}${o.ofertaAlta && o.ofertaAlta > o.ofertaMin ? `, con muchas opciones (sin garantía: puede tener otras ofertas) ${eur(o.ofertaAlta)}` : ''}; la app ofrecería ${eur(o.puja || o.ofertaMin)}` : '';
      const sc = M && M.sobrecoste && j && o.puja ? M.sobrecoste(j, o.puja) : null;
      const scTxt = sc && j.valor && o.puja > j.valor * 1.02 ? ` (${pct((o.puja / j.valor - 1) * 100)} sobre su valor: ÍNDICE DE SOBRECOSTE ${sc.indice}/100, aguantable hasta ~${M.tolerancia(j)})` : '';
      // (22 nov, Carlos) el precio que le pone un mánager en el mercado no cuenta para nada: a la IA ni se le pasa. Se le
      // oferta desde el valor de mercado, nunca menos
      return `COMPRAR ${j.nombre} a ${o.vendedor}, que LO TIENE A LA VENTA (vale ${eur(j.valor)}; EL PRECIO QUE ÉL LE HAYA PUESTO EN EL MERCADO NO CUENTA PARA NADA, ni de mínimo ni de referencia: la gente pone cualquier cifra, y si el mánager te dice que «lo tiene por tanto» o «pide tanto», NO uses esa cifra. Se le puede ofertar desde su valor de mercado, ${eur(j.valor)}, nunca menos); es suyo hasta que ACEPTE una oferta, no es seguro${laliga}${min}${scTxt}${o.miPuja ? `; MI OFERTA ACTUAL ${eur(o.miPuja)}${o.ofertaMin && o.miPuja < o.ofertaMin ? ' (POR DEBAJO DE LO QUE LE DA LALIGA: no la va a aceptar)' : ''}` : ''}`;
    }
    case 'T': return `COMPRAR ${j.nombre} a ${o.vendedor} por ${eur(o.precio)}${sobreTxt} por el TRATO que me contaste («${o.nota}»)`;
    case 'C': return `CLAUSULAR ${j.nombre} (de ${o.de}) pagando su cláusula de ${eur(o.precio)}${sobreTxt}${paronC(M, o)}${noMerece(M, o) ? '; LA APP NO LA RECOMIENDA (Hoy y las alarmas no la enseñan): para el once NO la propongas; solo para revender con beneficio claro' : ''}${(() => { const s = M && M.salida ? M.salida(j, o.precio) : null; return s ? `; SALIDA: ${s.txt}${s.ok ? '' : ' → NO LO PROPONGAS: sin salida y sin ser titular seguro'}` : ''; })()}; ${o.abierta ? 'ABIERTA YA' : o.veda ? `CERRADA hasta que empiece la jornada ${o.veda.n}: se puede pagar ${cuando(o.abre)}, ni un minuto antes` : `se abre ${cuando(o.abre)}`}${o.meLlega ? '' : o.conA ? `; ME LLEGA SI ANTES ACEPTO LAS OFERTAS QUE TENGO (con mi saldo de ahora me faltan ${eur(o.falta)})` : `; NO ME LLEGA: faltan ${eur(o.falta)} y lo que ponga a la venta no entra hasta aceptar una oferta`}`;
    case 'A': return `ACEPTAR la oferta de ${o.de} por ${j.nombre}: ${eur(o.precio)} (${pct((o.sobre || 0) * 100)} sobre su valor)${o.caduca ? `, caduca ${cuando(o.caduca)}` : ''}${cambioTxt(M, o.pid, true)}`;
    case 'V': return `VENDER ${j.nombre} (vale ${eur(j.valor)}${o.compra ? `, lo pagué a ${eur(o.compra)}` : ''})${cambioTxt(M, o.pid)}`;
    case 'B': {
      const p = o.pagan, b = o.blindaje;
      // (revisión total, M4) con «quién puede pagar tu cláusula» cerrada, sin nombres: solo si a alguien le sobra o le llega justo
      const quien = p && bloqueada('quienPaga') ? (p.seguro.length ? '; a algún rival le sobra el dinero para pagarla' : p.quiza.length ? '; a algún rival le llega justo' : p.hayDatos ? '; no le llega a ningún rival' : '')
        : p && (p.seguro.length || p.quiza.length || p.hayDatos) ? `; le llega a ${p.seguro.length ? p.seguro.map((x) => x.nombre).join(', ') : 'nadie seguro'}${p.quiza.length ? ` (quizá a ${p.quiza.map((x) => x.nombre).join(', ')})` : ''}${p.sinSaber.length ? ` (de ${p.sinSaber.length} no se sabe el dinero)` : ''}` : '';
      const justo = b ? (b.yaVale ? '; ya está por encima de lo que se suele pagar en esta liga por una cláusula: no hace falta subirla' : b.caro ? `; dejarla fuera del alcance de todos costaría ${eur(b.coste)}: no compensa${b.parcial ? `; subirla a ${eur(b.parcial.objetivo)} (${eur(b.parcial.coste)}) deja fuera a ${bloqueada('quienPaga') ? 'casi todos' : `todos menos a ${b.parcial.quedan.join(', ')}`}` : ''}` : `; subida justa: subirla a ${eur(b.objetivo)} cuesta ${eur(b.coste)} y ${b.porTecho ? 'quedaría por encima de lo que se suele pagar aquí por una cláusula' : 'no le llegaría a nadie'}`) : '';
      const gratis = o.escudo ? '; YA BLINDADO con el escudo' : o.escudoGratis ? `; se puede BLINDAR GRATIS con el escudo de LaLiga (anuncio, ${(M && M.ESCUDO_H) || 24} h)${o.sugerido ? ': CONVIENE HOY' : ''}` : '';
      return `PROTEGER ${j.nombre}: su cláusula (${eur(o.clausula)}) ${o.abierta ? 'está ABIERTA' : `se abre ${cuando(o.abre)}`}, riesgo de cláusula ${o.riesgo || '?'}${quien}${gratis}${justo.replace('subida justa: subirla', 'o pagando: subirla')}`;
    }
    default: return '';
  }
}

/** la operación del catálogo que corresponde a un paso del plan (por su referencia o, si no la trae, por jugador y acción) */
export function buscarOp(cat, o, pid) {
  const r = String(o.ref || '').trim().toUpperCase();
  if (r && cat.ref[r] && (!pid || cat.ref[r].pid === pid)) return cat.ref[r];
  if (!pid) return null;
  const acc = String(o.accion || '').toLowerCase();
  const pref = /acept/.test(acc) ? ['A'] : acc === 'vender' ? ['A', 'V'] : acc === 'pujar' ? ['P', 'M', 'T'] : /compr|ofert/.test(acc) ? ['M', 'T', 'P'] : acc === 'clausular' ? ['C'] : acc === 'blindar' ? ['B'] : [];
  for (const p of pref) if (cat.ref[`${p}-${pid}`]) return cat.ref[`${p}-${pid}`];
  return null;
}

/** por qué no se puede hacer un paso que no está en el catálogo */
export function porQueNo(D, M, o, pid, j) {
  const acc = String(o.accion || '').toLowerCase();
  const yo = D.yo && D.yo.teamId;
  const tid = pid && M.dueno[pid];
  if (!j) return 'No encuentro a ese jugador en los datos de la liga';
  if (/vender|acept/.test(acc)) return tid === yo ? 'Aún no tiene ofertas' : 'No es tuyo';
  if (tid === yo) return 'Ya es tuyo';
  if (acc === 'clausular') {
    if (!tid) return 'No es de nadie: no tiene cláusula que pagar';
    const x = M.clausulas.find((c) => c.pid === pid);
    if (!x) return 'No tiene cláusula';
    if (x.veda) {
      const ya = x.veda.cierra <= Date.now();
      return `Las cláusulas ${ya ? 'están cerradas desde' : 'se cierran'} ${cuando(x.veda.cierra)} (24 h antes del primer partido de la jornada ${x.veda.n}) y no se puede clausular a nadie hasta que empiece: la de ${x.j.nombre}, ${cuando(x.protegidoHasta)}`;
    }
    if (!x.abierta && x.protegidoHasta - Date.now() > LIMITE_C && !(M.proxima && x.protegidoHasta > M.proxima.ini)) return `Para más adelante: su cláusula no se abre hasta ${cuando(x.protegidoHasta)}, dentro de ${dura(x.protegidoHasta - Date.now())}. Hoy no se puede hacer nada; cuando falten un par de días, el plan lo tendrá en cuenta`;
    return `Su cláusula no se abre hasta ${cuando(x.protegidoHasta)}, después de la próxima jornada`;
  }
  const venta = (M.mercado || []).find((m) => m.pid === pid && m.tipo === 'manager' && m.noVende);
  if (venta) return `Lo tiene a la venta, pero ${venta.noVende}: ${venta.vendedor || nombreDe(M, tid)} no te lo va a vender`;
  if (tid) {
    const fa = M.fichadoPor && M.fichadoPor(pid);
    // (regla comprobada con Carlos, 13 nov) una oferta se le puede hacer siempre desde la ficha del jugador; que la acepte es otra cosa
    return `No lo tiene a la venta${fa ? ` (lo ${fa.clase === 'clausula' ? 'clausuló' : 'fichó'} ${cuando(fa.t)})` : ''}: se le puede hacer una oferta desde la ficha del jugador, pero ${nombreDe(M, tid)} no tiene por qué aceptarla, así que no va en el plan. Seguro, solo con su cláusula cuando se abra`;
  }
  return 'No está hoy en el mercado';
}

/** el catálogo para la IA, por grupos (lo más interesante primero) */
export function catalogoTxt(D, M, cat, { corto = false, chat = false, datos = null, ver = null } = {}) {
  const L = [];
  // (revisión de la IA, 14 nov) `ver`: lo que haría la app con cada operación (veredictos, ia.js). Lo que descartaría no
  // se ofrece: va aparte, en una línea con el motivo; lo que vale lleva su aviso
  const v = (o) => (ver && ver[o.ref]) || null;
  const vale = (o) => { const x = v(o); return !x || x.ok; };
  const corta = (t, n = 150) => { const x = String(t || '').replace(/La app lo descarta[.:]?\s*/g, '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, x.lastIndexOf(' ', n))}…` : x; };
  const fuera = [];
  const g = (titulo, ops, n) => {
    if (!ops.length) return;
    L.push(`\n${titulo}`);
    for (const o of ops.slice(0, n)) {
      let x = v(o);
      // (24 nov, repaso) fichar: lo que dice el plan que se ve manda (mirado y descartado, plantilla llena, puja que se retira)
      const df = M && M.decisionFichar && /^[PCMT]-/.test(o.ref) ? M.decisionFichar(o.pid) : null;
      if (df && df.accion === 'no' && x && x.ok) x = { ok: false, aviso: df.porque };
      L.push(`- [${o.ref}] ${textoOp(o, M)}${x && x.ok && x.para ? ` → LA APP: vale para ${x.para}${x.aviso ? `. ${corta(x.aviso, 220)}` : ''}` : x && x.ok && x.aviso ? ` → LA APP: ${corta(x.aviso, 220)}` : x && !x.ok ? ` → LA APP NO LA HARÍA HOY${x.sinPrisa ? ' (sin prisa)' : ''}: ${corta(x.aviso, 220)}` : ''}`);
      const d = datos && datos(o);
      if (d) L.push(`    ${d}`);
    }
    if (ops.length > n) L.push(`  (y ${ops.length - n} más con menos interés)`);
  };
  const por = (a, b) => (b.interes || 0) - (a.interes || 0);
  const t = (x) => cat.lista.filter((o) => o.ref[0] === x);
  L.push('OPERACIONES POSIBLES HOY (las ÚNICAS que puedes recomendar; cada operación del plan lleva su "ref"):');
  g('ACEPTAR OFERTAS (lo que ya tengo en venta):', t('A'), 20);
  // (cada candidato va con su ficha entera: con más, la IA tarda mucho más y no decide mejor)
  for (const o of [...t('P'), ...t('C').filter((c) => c.meLlega || c.conA)]) if (!vale(o)) fuera.push(o);
  g('PUJAR (jugadores LIBRES de la liga, subasta a ciegas):', t('P').filter(vale).sort(por), chat ? 10 : corto ? 7 : 14);
  // en el plan, solo los tratos: lo que un rival tiene a la venta casi siempre está solo para ver la oferta de LaLiga
  // (aviso de Domy, 29 oct); en el chat, si se pregunta por ellos, sí van
  if (chat) g('COMPRAR A OTRO MANAGER (solo lo que TIENE A LA VENTA o un TRATO que te conté; decide él):', [...t('T'), ...t('M').sort(por)], 8);
  else {
    g('COMPRAR A OTRO MANAGER (solo un TRATO que te conté; decide él):', t('T'), 10);
    if (t('M').length) L.push(`\nLO QUE MIS RIVALES TIENEN A LA VENTA (${t('M').length}) NO VA EN EL PLAN: casi siempre lo ponen solo para ver la oferta de LaLiga y no lo quieren vender. No lo propongas ni lo nombres (ni en operaciones, ni en descartes, ni en vigilar, ni en rivales).`);
  }
  {
    // con ficha, las que me llegan (o me llegan aceptando las ofertas de hoy); las demás, como mucho 4 y en una línea:
    // eran casi todo el bloque y no se pueden hacer hoy
    const cs = t('C').sort(por), llegan = cs.filter((o) => (o.meLlega || o.conA) && vale(o)), no = cs.filter((o) => !o.meLlega && !o.conA);
    g('CLAUSULAR (cláusulas de rivales abiertas o que se abren en las próximas 48 h y antes de la jornada, que me llegan con mi saldo o aceptando antes las ofertas que tengo):', llegan, chat ? 10 : corto ? 7 : 14);
    if (no.length) L.push(`\nCLÁUSULAS QUE NO ME LLEGAN HOY (ni aceptando las ofertas que tengo; solo para saber que existen): ${no.slice(0, 4).map((o) => `[${o.ref}] ${o.j.nombre} (de ${o.de}) ${eur(o.precio)}, faltan ${eur(o.falta)}`).join('; ')}${no.length > 4 ? ` y ${no.length - 4} más` : ''}.`);
  }
  g('PROTEGER (mis cláusulas abiertas o a punto: blindar gratis con el escudo o subir la cláusula pagando):', t('B'), 12);
  if (fuera.length) {
    // el motivo de verdad es lo último que dice la app; los que comparten motivo van juntos
    const motivo = (o) => {
      const t = String(v(o).aviso || ''), i = t.lastIndexOf('La app lo descarta');
      const x = (i >= 0 ? t.slice(i) : t).replace(/La app lo descarta[.:]?\s*/, '').replace(/\s+/g, ' ').trim();
      if (/no es una cláusula que la app recomiende/.test(x)) return 'no compensa para el once (se paga de más, calendario duro o apenas mejora mi once)';
      if (/No te llega: una cláusula solo se paga con saldo/.test(x)) return 'no me llega: una cláusula solo se paga con saldo';
      if (/no puedes pujar ni comprar por más de/.test(x)) return x.replace(/^.*?(no puedes pujar)/, '$1').replace(/\.$/, '');
      if (/estamos en el parón/.test(x)) return 'estamos en el parón: para el once, días sin puntuar con el dinero parado';
      return corta(x, 150).replace(/\.$/, '');
    };
    const grupos = new Map();
    for (const o of fuera.sort(por)) { const m = motivo(o); if (!grupos.has(m)) grupos.set(m, []); grupos.get(m).push(o); }
    const n = chat ? 8 : 6;
    L.push(`\nLO QUE LA APP YA HA DESCARTADO HOY (${fuera.length}; NO lo propongas: no va en operaciones. Si te preguntan por alguno, este es el motivo):`);
    for (const [m, os] of grupos) L.push(`- ${os.slice(0, n).map((o) => `${o.j.nombre} [${o.ref}]`).join(', ')}${os.length > n ? ` y ${os.length - n} más` : ''}: ${m}.`);
  }
  L.push(`VENDER: cualquiera de mis jugadores con [V-<id>] (ids: ${t('V').map((o) => `${o.j.nombre} V-${o.pid}`).join(', ')}).`);
  // (24 nov) los del cambio, aparte: su venta va junto con la puja por el recambio
  for (const o of t('V')) { const tx = cambioTxt(M, o.pid); if (tx) L.push(`- [V-${o.pid}] VENDER ${o.j.nombre}${tx}`); }
  L.push('Cualquier jugador de un rival que no esté arriba NO SE PUEDE CONSEGUIR HOY: ni comprándoselo ni de otra forma.');
  return L.join('\n');
}

export const esMalo = (j) => j && MALOS.has(j.estado);
export { POS, HORA };
