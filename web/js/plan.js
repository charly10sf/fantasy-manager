/* El motor del plan del día (14 nov 2026; claude/revision-ia.md, «El motor del plan»).

   Antes, el plan sin IA (planAuto, motor.js) iba operación a operación: vendía todo lo que tenía un motivo, compraba
   mientras quedara dinero y lo que saliera se pasaba después por cuadrarPlan, que tachaba lo que no cuadraba. Aquí el
   plan se elige ENTERO:

   1. Candidatos: las operaciones del catálogo de hoy que la app daría por buenas (veredictos, ia.js), cada una con lo
      que aporta en euros (lo que te pagan de más, lo que deja de bajar, lo que se espera ganar revendiendo, lo que se
      paga de más al fichar) y con a quién saca o mete en el once.
   2. La combinación: se prueban todas las combinaciones de los candidatos (son pocos) y se queda la que más vale,
      sumando los euros y los puntos del once (con `valorPunto`, la equivalencia entre los dos), entre las que cumplen
      las reglas de LaLiga: una cláusula solo con saldo, la suma de pujas dentro del tope de deuda, 25 jugadores,
      formaciones gratis, dos blindajes, los cambios de mercado que quedan para revender y empezar la jornada en
      positivo aunque los valores bajen (lo de revender cuenta al 92 % y lo puesto en venta al 90 %).
   3. El orden: primero lo que mete dinero, luego las cláusulas, las pujas, proteger y alinear.
   4. La red: el plan pasa por cuadrarPlan como cualquier otro. Si la app descartara algo, ese candidato se quita y se
      elige otra vez: lo que sale del motor no lleva «Descartado por la app».

   Una venta siempre tiene un motivo (está de baja, ha girado, le pagan de más, es de revender y toca, o hace falta para
   empezar la jornada en positivo): nunca «por hacer caja». Si este motor falla, sale el plan de antes (planAuto). */
import { num, clamp, DIA, HORA, diaDe, eur, pct, dura, cuando, antesDe, elDia } from './util.js';
import { planAuto, rematarAuto, mereceClausula, mejorOnce } from './motor.js';
import { paronLejos, cholloParon } from './operaciones.js';
import { cuadrarPlan, veredictos } from './ia.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
const P7 = (t) => (!t ? null : t.p7e !== undefined ? t.p7e : t.p7);
const d1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/** lo que se puede ajustar del motor (cfg().plan lo pisa: { eurPunto, jornadas, … }) */
export const AJUSTES = {
  jornadas: 5,        // a cuántas jornadas vista se cuenta lo que cambia el once
  paron: 0.4,         // en el parón, con la vuelta lejos, los puntos del once pesan menos (dinero antes que once)
  margenRev: 0.92,    // lo comprado para revender se cuenta al 92 %: si baja un 8 %, aún se empieza en positivo
  margenVenta: 0.9,   // lo puesto en venta, al 90 % (la oferta de LaLiga llega en el siguiente cambio de mercado)
  topeDeuda: 0.9,     // especulando, nunca más allá del 90 % de la deuda permitida
  ganaPuja: 0.7,      // una puja no es segura: sus puntos cuentan al 70 %
  friccion: 60000,    // cada paso tiene que valer al menos esto para ir en el plan
  maxOnce: 2,         // cláusulas y pujas para el once, como mucho, de cada clase
  // el freno de lo de revender: si con el histórico de la liga lo que el motor habría comprado no gana a no hacer nada,
  // no se especula. Apagado hasta medirlo con una liga de verdad (la de ejemplo tiene valores al azar)
  frenoReventa: false,
};
const ajustes = (c) => ({ ...AJUSTES, ...((c && c.plan) || {}) });

/**
 * La equivalencia entre puntos y euros: cuánto vale un punto esperado en UNA jornada. Sale de la liga: lo que vale un
 * jugador con dueño por cada punto que se espera de él (la mediana), repartido en 10 jornadas. cfg().plan.eurPunto la fija.
 */
export function valorPunto(D, M, c) {
  const fijo = c && c.plan && +c.plan.eurPunto;
  if (fijo > 0) return { v: fijo, de: 'ajuste' };
  if (M._vp) return M._vp;
  const xs = [];
  for (const fs of Object.values(D.plantillas || {})) {
    for (const f of fs || []) {
      const j = M.J(f.pid);
      if (!j || !j.valor || j.pos === 5 || MALOS.has(j.estado)) continue;
      const pp = M.ppEsperado(j);
      if (pp >= 2) xs.push(j.valor / pp);
    }
  }
  xs.sort((a, b) => a - b);
  const med = xs.length ? xs[Math.floor(xs.length / 2)] : 0;
  return (M._vp = xs.length < 12 ? { v: 300000, de: 'por defecto' } : { v: clamp(Math.round(med / 10 / 1e4) * 1e4, 100000, 1500000), de: 'liga', n: xs.length, porPunto: med });
}

/* ---------- los candidatos ---------- */
function contextoDe(D, M, c, ahora) {
  const A = ajustes(c);
  const inicio = M.proxima ? M.proxima.ini : null;
  const ventana = M.ventanaEsp || null;
  const paron = paronLejos(M, ahora);
  const cierre = !!M.vedaAhora || (!!inicio && inicio > ahora && inicio - ahora < DIA);
  // los días que le quedan al valor para moverse antes de la jornada (hasta la víspera)
  const dias = inicio ? clamp(Math.ceil((inicio - ahora) / DIA) - 1, 1, 14) : 3;
  const vp = valorPunto(D, M, c);
  return {
    D, M, c, A, ahora, inicio, ventana, paron, cierre, dias, vp,
    ciclos: (ventana && ventana.ciclos) || 0,
    pujasAntes: !M.cierreMercado || !inicio || M.cierreMercado < inicio,
    enJuego: !!M.enJuego,
    cerca: !!M.enJuego || (!!inicio && inicio - ahora < 3 * DIA),
    V: veredictos(D, M),
    // lo que vale un punto del once en este plan (en el parón, menos: dinero antes que once)
    punto: vp.v * A.jornadas * (paron ? A.paron : 1),
    mias: M.mias.map((x) => x.j),
    yo: D.yo && D.yo.teamId,
  };
}

/** lo que se espera que cambie su valor: lo que cae si ha girado o frena (a 14 días), lo que sube hasta la víspera si sube */
function mueve(X, pid) {
  const ine = X.M.inercia(pid);
  if (!ine) return { ine: null, hold: 0, cae: false };
  const cae = ['giro', 'baja', 'parado', 'frena'].includes(ine.fase);
  return { ine, cae, hold: cae ? ine.proy(14) : ine.proy(X.dias) };
}

function candidatos(X, vetados) {
  const { D, M, V, ahora, paron, ciclos, inicio, ventana } = X;
  const out = [], fijos = [];
  const nuevo = (o) => { if (!vetados.has(o.k)) (o.fijo ? fijos : out).push(o); };
  const enVenta = M.enVenta || new Set();
  const revPids = new Set((M.paraRevender || []).map((x) => x.pid));
  const pierdeTxt = (pid) => { const p = M.perdida(pid); return p >= 0.3 ? ` Es titular en tu once (${d1(p)} pts por jornada).` : ' No entra en tu once: no pierdes puntos.'; };
  const pagasteTxt = (x, imp) => (x && x.compra ? ` Lo pagaste a ${eur(x.compra)} (${eur((imp || x.j.valor) - x.compra, { signo: true })}).` : '');

  /* A. aceptar las ofertas por lo que ya tienes en venta */
  for (const v of M.misVentas || []) {
    if (!v.mejor || !v.j) continue;
    const ver = V[`A-${v.pid}`];
    const x = M.mias.find((y) => y.pid === v.pid);
    const { ine, hold, cae } = mueve(X, v.pid);
    const prima = v.mejor.importe - v.j.valor;
    // lo comprado para revender se acepta cuando toca (la víspera del último cambio de mercado, o ya si ha empezado a bajar)
    const esRev = revPids.has(v.pid) && (!ventana || ahora >= ventana.ponerVenta - 6 * HORA || (v.tend && v.tend.p1 != null && v.tend.p1 < -1));
    // (te pagan de más, pero si sube fuerte y aguantándolo hasta la jornada valdría aún más, no es un motivo: Fornals, 13 nov)
    const subeMas = !!ine && !cae && hold > prima && num(ine.ult) >= v.j.valor * 0.005;
    const motivo = esRev ? 'revender' : v.consejo === 'aceptar' && !subeMas ? (cae || M.vendeBaja({ j: v.j, tend: v.tend }) ? 'baja' : 'prima') : null;
    const base = { clase: 'aceptar', pid: v.pid, j: v.j, importe: v.mejor.importe, cajaHoy: v.mejor.importe, sale: v.pid, euros: prima - hold, ref: `A-${v.pid}` };
    const op = (extra) => ({ accion: 'vender', ref: `A-${v.pid}`, pid: v.pid, jugador: v.j.nombre, donde: `acepta la oferta de ${v.mejor.de}`, importe: v.mejor.importe, cuando: v.mejor.caduca ? antesDe(v.mejor.caduca) : 'hoy', confianza: v.mejor.sobre >= 0.02 ? 'alta' : 'media', ...extra });
    if (motivo && ver && ver.ok) {
      nuevo({ ...base, k: `A-${v.pid}`, motivo,
        op: () => op({ objetivo: esRev ? 'revender' : null,
          motivo: `${v.porque} Vale ${eur(v.j.valor)}${v.ganado != null ? ` y lo pagaste a ${eur(v.compra)} (${eur(v.ganado, { signo: true })})` : ''}.${ine && hold > 0 ? ` Aguantándolo ${X.dias} día${X.dias === 1 ? '' : 's'} subiría unos ${eur(hold)}: te pagan ya más que eso.` : ''}${pierdeTxt(v.pid)} Si no la aceptas, caduca${v.mejor.caduca ? ` ${cuando(v.mejor.caduca)}` : ''} y LaLiga te hará otra en el siguiente cambio de mercado.`,
          datos: { porque: v.porque, cuanto: `${eur(v.mejor.importe)} (${eur(prima, { signo: true })} sobre su valor)`, cuando: v.mejor.caduca ? antesDe(v.mejor.caduca) : 'hoy', siNo: 'la oferta caduca y llega otra de LaLiga en el siguiente cambio de mercado' } }) });
    }
    // por si hace falta el dinero (solo entra en el plan si sin él no se empieza la jornada en positivo)
    if (!ver || ver.ok || ver.sinPrisa || X.cierre) {
      nuevo({ ...base, k: `FA-${v.pid}`, forzada: true, motivo: 'jornada', x,
        op: (cu) => op({ objetivo: 'caja', confianza: 'alta',
          motivo: `Hace falta para empezar la jornada en positivo (en negativo no puntúas) y es dinero que entra en el momento. ${v.mejor.sobre >= 0 ? `Te pagan ${eur(prima, { signo: true })} sobre lo que vale` : `La oferta se queda ${eur(-prima)} por debajo de lo que vale`} (${eur(v.j.valor)}).${pierdeTxt(v.pid)}${cu.resto}`,
          datos: { porque: 'hace falta para empezar la jornada en positivo', cuanto: eur(v.mejor.importe), cuando: v.mejor.caduca ? antesDe(v.mejor.caduca) : 'hoy', siNo: 'empezarías la jornada en negativo y no puntuarías' } }) });
    }
  }

  /* V. poner a la venta lo que tiene un motivo */
  for (const x of M.mias) {
    if (!x.j || enVenta.has(x.pid)) continue;
    const ver = V[`V-${x.pid}`];
    const { ine, hold, cae } = mueve(X, x.pid);
    const ol = M.ofertaLigaDe ? M.ofertaLigaDe(x.j) : null;
    const cobra = ol && !ol.sinDatos ? Math.min(ol.v, x.j.valor * 1.02) : x.j.valor;
    const base = { clase: 'vender', pid: x.pid, j: x.j, importe: x.j.valor, futura: x.j.valor, sale: x.pid, ref: `V-${x.pid}` };
    const op = (extra) => ({ accion: 'vender', ref: `V-${x.pid}`, pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy', confianza: 'media', ...extra });
    const llega = ' La oferta de LaLiga llega en el siguiente cambio de mercado.';
    // el entrenador no puntúa en la versión gratuita: dinero parado
    if (x.j.pos === 5) {
      nuevo({ ...base, k: `V-${x.pid}`, fijo: true, motivo: 'entrenador', euros: 0,
        op: () => op({ objetivo: 'caja', confianza: 'alta', motivo: `Es entrenador y en la versión gratuita no se alinea ni puntúa: son ${eur(x.j.valor)} parados que puedes usar en jugadores.${llega}`,
          datos: { porque: 'es entrenador: no puntúa en la versión gratuita', cuanto: eur(x.j.valor), cuando: 'hoy', siNo: 'ese dinero sigue parado' } }) });
      continue;
    }
    // lo comprado para revender: el día antes de la jornada (o ya, si ha empezado a bajar)
    if (revPids.has(x.pid)) {
      const r = M.paraRevender.find((y) => y.pid === x.pid);
      const baja = x.tend && x.tend.p1 != null && x.tend.p1 < -1;
      if (!ventana || ahora >= ventana.ponerVenta - 6 * HORA || baja) {
        nuevo({ ...base, k: `V-${x.pid}`, fijo: true, motivo: 'revender', euros: Math.max(0, r.beneficioYa),
          op: () => op({ objetivo: 'revender', confianza: 'alta', cuando: inicio ? antesDe(inicio) : 'hoy',
            motivo: `Lo compraste para revender a ${eur(r.rev.precio)} y ahora vale ${eur(x.j.valor)} (${eur(r.beneficioYa, { signo: true })}).${baja ? ' Ha empezado a bajar: mejor salir ya.' : ' Toca ponerlo a la venta para aceptar la oferta del último cambio de mercado y empezar la jornada en positivo.'}`,
            datos: { porque: 'lo compraste para revender y toca', cuanto: `${eur(x.j.valor)} (${eur(r.beneficioYa, { signo: true })})`, cuando: inicio ? antesDe(inicio) : 'hoy', siNo: 'podrías empezar la jornada en negativo' } }) });
      }
      continue;
    }
    const okHoy = !!ver && ver.ok;
    const vi = x.ventaInercia;
    let motivo = null, porque = '', conf = 'media', euros = cobra - x.j.valor - hold;
    if (M.vendeBaja(x)) {
      motivo = 'baja'; conf = 'alta'; euros = Math.max(euros, x.j.valor * 0.02);
      porque = `${M.deBaja(x.j) ? M.bajaTxt(x.j) : 'Sancionado una jornada, pero su valor cae deprisa'}: no te va a puntuar${x.tend.p7 != null && x.tend.p7 < 0 ? ` y ya ha perdido un ${pct(Math.abs(x.tend.p7), 1, false)} en 7 días` : ''}. Mejor venderlo antes de que baje más.`;
    } else if (vi && !(vi.urgencia !== 'ya' && M.esperarVenta(x).tipo === 'clausula')) {
      motivo = 'inercia'; conf = vi.urgencia === 'ya' ? 'alta' : 'media';
      euros = Math.max(euros, cobra - x.j.valor + (vi.perder || 0));
      const nota = M.esperarVenta(x).nota;
      porque = `${vi.texto}${nota && !/^Su cláusula está abierta en/.test(nota) ? ` ${nota}` : ''}`;
    } else if (((M.partidazo(x.pid) || {}).nivel || 0) < 2 && x.ganado > 0 && P7(x.tend) != null && P7(x.tend) < -4 && !M.esperarVenta(x).tipo) {
      motivo = 'desplome';
      euros = Math.max(euros, x.j.valor * Math.min(0.05, Math.abs(P7(x.tend)) / 100 / 2));
      porque = `Lo pagaste a ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}), pero lleva un ${pct(Math.abs(x.tend.p7), 1, false)} de bajada en 7 días. Asegura el beneficio.`;
    }
    if (motivo && okHoy) {
      nuevo({ ...base, k: `V-${x.pid}`, motivo, euros,
        op: () => op({ confianza: conf, motivo: `${porque}${pierdeTxt(x.pid)}${llega}${cae && hold < 0 ? ` Si no lo vendes, en dos semanas puede valer unos ${eur(-hold)} menos.` : ''}`,
          datos: { porque, cuanto: `vale ${eur(x.j.valor)}${x.compra ? `; lo pagaste a ${eur(x.compra)}` : ''}`, cuando: 'hoy', siNo: cae && hold < 0 ? `en dos semanas puede valer unos ${eur(-hold)} menos` : 'sigue en tu equipo' } }) });
    }
    // por si hace falta el dinero: cualquiera de los tuyos, con lo que cuesta soltarlo (lo decide la combinación)
    if (!motivo || !okHoy) {
      // sin prisa (quedan dos cambios de mercado o más y no está bajando): se pone a la venta el día antes del último
      // cambio, no hoy (Carlos, 3 nov: en negativo entre semana no hay que malvender ya)
      const luego = ciclos >= 2 && !cae && !!ventana && ventana.ponerVenta > ahora + 6 * HORA;
      nuevo({ ...base, k: `FV-${x.pid}`, forzada: true, motivo: 'jornada', euros: cobra - x.j.valor - (luego ? 0 : Math.max(0, hold)), luego, x,
        op: (cu) => op({ objetivo: 'caja', confianza: 'alta', ...(luego ? { dia: diaDe(ventana.ponerVenta), cuando: `${elDia(ventana.ponerVenta)}, para aceptar la oferta de ${cuando(ventana.limite)}` } : { cuando: inicio ? antesDe(ventana && ventana.limite ? ventana.limite : inicio) : 'hoy' }),
          motivo: `Hace falta para empezar la jornada en positivo (en negativo no puntúas). ${M.perdida(x.pid) < 0.3 ? 'No entra en tu once: no pierdes puntos.' : `Es de los que menos resta a tu once (${d1(M.perdida(x.pid))} pts por jornada).`}${pagasteTxt(x)}${luego ? ` Sin prisa: quedan ${ciclos} cambios de mercado antes de la jornada${ine && hold > 0 ? ` y sigue subiendo (${eur(ine.ult, { signo: true })} al día)` : ''}; ponlo a la venta ${elDia(ventana.ponerVenta)} y acepta la oferta que llegue ${cuando(ventana.limite)}.` : llega}${cu.resto}`,
          datos: { porque: 'hace falta para empezar la jornada en positivo', cuanto: eur(x.j.valor), cuando: luego ? elDia(ventana.ponerVenta) : 'hoy', siNo: 'empezarías la jornada en negativo y no puntuarías' } }) });
    }
  }

  /* C. cláusulas para el once: la misma regla que Hoy y las alarmas (mereceClausula) */
  const abiertas = M.clausulas.filter((x) => x.abierta && x.j && mereceClausula(M, x, ahora))
    .sort((a, b) => (b.interes + (b.teQueda >= 0 ? 8 : 0)) - (a.interes + (a.teQueda >= 0 ? 8 : 0))).slice(0, 5);
  for (const x of abiertas) {
    const ver = V[`C-${x.pid}`];
    // vale si la app la da por buena para el once, o si lo único que le falta es el dinero (lo puede poner una oferta aceptada)
    const soloDinero = ver && !ver.ok && /No te llega: una cláusula solo se paga con saldo/.test(ver.aviso || '');
    if (!ver || !((ver.ok && /^el once/.test(ver.para || '')) || soloDinero)) continue;
    const cc = M.compraCal(x.j, x.clausula);
    if (!cc.ok) continue;
    nuevo({ k: `C-${x.pid}`, clase: 'clausular', objetivo: 'titular', pid: x.pid, j: x.j, importe: x.clausula, cajaHoy: -x.clausula, entra: x.j, euros: -(x.clausula - x.j.valor), ref: `C-${x.pid}`, interes: x.interes,
      op: (cu) => ({ accion: 'clausular', ref: `C-${x.pid}`, objetivo: 'titular', pid: x.pid, jugador: x.j.nombre, donde: `cláusula a ${x.rival.manager || x.rival.nombre}`, importe: x.clausula, cuando: 'ahora',
        confianza: x.interes >= 70 && (!cc.cal || cc.cal.riesgo !== 'alto') ? 'alta' : 'media',
        motivo: `${paron ? 'En el parón solo merece la pena clausular para el once un chollo así, a su valor y sin bajar. ' : ''}Vale ${eur(x.j.valor)} y su cláusula es ${eur(x.clausula)}. ${cu.gana >= 0.3 ? `Entra en tu once y suma unos ${d1(cu.gana)} pts por jornada` : 'Refuerza tu plantilla'}${x.por.length ? `; ${x.por.filter((p) => !/once|hueco|sobran/.test(p)).slice(0, 2).join(', ')}` : ''}.${cc.txt ? ` ${cc.txt}` : ''} Se paga con saldo, en el momento${cu.caja != null ? ` (te quedan ${eur(cu.caja)} en caja)` : ''}. Si esperas, cualquier rival con dinero te lo puede quitar.`,
        datos: { porque: cu.gana >= 0.3 ? `entra en tu once: +${d1(cu.gana)} pts por jornada` : 'refuerza tu plantilla a su valor', cuanto: `${eur(x.clausula)} (vale ${eur(x.j.valor)})`, cuando: 'ahora', siNo: 'otro rival con dinero te lo puede quitar' } }) });
  }

  /* P. pujas del mercado para el once */
  for (const m of M.mercado.filter((y) => y.tipo === 'liga' && !y.miPuja && !M.dueno[y.pid] && y.puja && (y.veredicto === 'chollo' || (y.veredicto === 'sube' && y.interes >= 55)) && (!paron || cholloParon(M, y.j, y.puja || y.precio))).slice(0, 5)) {
    const ver = V[`P-${m.pid}`];
    if (!ver || !ver.ok || !/^el once/.test(ver.para || '')) continue;
    const cm = M.compraCal(m.j, m.puja);
    if (!cm.ok) continue;
    nuevo({ k: `P-${m.pid}`, clase: 'pujar', objetivo: 'titular', pid: m.pid, j: m.j, importe: m.puja, puja: m.puja, entra: m.j, incierta: true, euros: -(m.puja - m.j.valor), ref: `P-${m.pid}`, interes: m.interes,
      op: (cu) => ({ accion: 'pujar', ref: `P-${m.pid}`, objetivo: 'titular', pid: m.pid, jugador: m.j.nombre, donde: 'en el mercado', importe: m.precio, puja_max: m.puja, cuando: M.cierreMercado ? antesDe(M.cierreMercado) : 'hoy',
        motivo: `Sale a ${eur(m.precio)}${m.sobre <= 0.01 ? ', lo que vale' : ''}. ${cu.gana >= 0.3 ? `Mejora tu once unos ${d1(cu.gana)} pts por jornada` : 'Refuerza tu plantilla'}${m.por.length ? `; ${m.por.filter((p) => !/once|hueco|sobran/.test(p)).slice(0, 2).join(', ')}` : ''}.${m.pujas ? ` Lleva ${m.pujas} puja${m.pujas > 1 ? 's' : ''}, por eso subo la oferta.` : ''}${cm.txt ? ` ${cm.txt}` : ''} Es una subasta a ciegas: si no la ganas, no pagas nada.`,
        datos: { porque: cu.gana >= 0.3 ? `mejora tu once: +${d1(cu.gana)} pts por jornada` : 'refuerza tu plantilla', cuanto: `puja de ${eur(m.puja)} (sale a ${eur(m.precio)})`, cuando: M.cierreMercado ? antesDe(M.cierreMercado) : 'hoy', siNo: 'se lo lleva otro o vuelve a LaLiga' } }) });
  }

  /* E. especular: comprar lo que sube y venderlo antes de la jornada (con el margen de deuda) */
  if (ventana && ciclos >= 1 && (paron || !M.paraRevender.length || M.especular.some((e) => e.vuelve))) {
    const CONF = { alta: 0.8, media: 0.6, baja: 0.4 };
    let n = 0;
    for (const e of M.especular) {
      if (n >= 5) break;
      if (M.dueno[e.pid] === X.yo || (!paron && M.paraRevender.length && !e.vuelve)) continue;
      const esM = e.origen === 'mercado';
      const ver = V[`${esM ? 'P' : 'C'}-${e.pid}`];
      const soloDinero = ver && !ver.ok && /No te llega: una cláusula solo se paga con saldo|no puedes pujar ni comprar por más de/.test(ver.aviso || '');
      if (!ver || !((ver.ok && /revender/.test(ver.para || '')) || soloDinero)) continue;
      n++;
      const diaVenta = cuando(e.vender, { hora: false }), elDiaVenta = elDia(e.vender);
      nuevo({ k: `E-${e.pid}`, clase: esM ? 'pujar' : 'clausular', objetivo: 'revender', rev: true, pid: e.pid, j: e.j, importe: e.precio, ...(esM ? { puja: e.precio } : { cajaHoy: -e.precio }), euros: e.beneficio * (CONF[e.confianza] || 0.5) * X.fiable, ref: `${esM ? 'P' : 'C'}-${e.pid}`, vuelve: !!e.vuelve,
        op: () => ({ accion: esM ? 'pujar' : 'clausular', ref: `${esM ? 'P' : 'C'}-${e.pid}`, objetivo: 'revender', pid: e.pid, jugador: e.j.nombre,
          donde: esM ? 'en el mercado' : `cláusula a ${e.rival.manager || e.rival.nombre}`, importe: esM ? e.precioMercado : e.precio, puja_max: esM ? e.puja : null,
          cuando: esM ? (M.cierreMercado ? antesDe(M.cierreMercado) : 'hoy') : 'ahora', vender_el: diaVenta, beneficio_esperado: Math.round(e.beneficio), confianza: e.confianza,
          motivo: `Para revender, no para tu once: ${e.vuelve ? `llegó a valer ${eur(e.vuelve.max)} esta temporada, vuelve a jugar y lleva ${e.vuelve.racha} días subiendo (un ${pct(e.r * 100, 1, false)} al día)` : `sube un ${pct(e.r * 100, 1, false)} al día`}. Si sigue así, ${elDiaVenta} valdrá unos ${eur(e.valorFuturo)} (${eur(e.beneficio, { signo: true })}). Ponlo a la venta ${elDiaVenta} para estar en positivo antes de la jornada.${X.backtest && X.backtest.n >= 8 && X.backtest.media > 0 ? ` En esta liga, lo que la app habría comprado así en las últimas semanas salió bien ${X.backtest.bien} de ${X.backtest.n} veces (${eur(X.backtest.media, { signo: true })} de media).` : ''}`,
          datos: { porque: `sube un ${pct(e.r * 100, 1, false)} al día`, cuanto: `${eur(e.precio)}; ${elDiaVenta} valdría unos ${eur(e.valorFuturo)} (${eur(e.beneficio, { signo: true })})`, cuando: esM ? 'hoy' : 'ahora', siNo: 'te pierdes la subida; no afecta a tu once', vender: elDiaVenta } }) });
    }
  }
  return { libres: out, fijos };
}

/* ---------- elegir la combinación ---------- */
/** las cuentas de una combinación, con las reglas de LaLiga. Devuelve null si no se puede hacer */
function cuentas(X, lista) {
  const { D, M, A, ciclos } = X;
  let caja = num(D.dinero), margen = num(D.dinero) + M.deuda - num(M.misPujas), n = M.mias.length;
  let vuelve = 0, ventas = 0, hayRev = false, nC = 0, nP = 0, nE = 0;
  for (const o of lista) if (o.clase === 'aceptar') { caja += o.importe; margen += o.importe; n--; }
  // las cláusulas, por orden de lo que valen: cada una tiene que caber en lo que hay en caja en ese momento
  for (const o of lista) {
    if (o.clase !== 'clausular') continue;
    if (o.importe > caja) return null;
    caja -= o.importe; margen -= o.importe; n++;
    if (o.rev) { hayRev = true; vuelve += o.importe * A.margenRev; nE++; } else nC++;
    // y con lo que ya hay pujado no puede pasar el tope de deuda: el saldo que se gasta en la cláusula deja de respaldarlo
    if (margen < 0) return null;
  }
  for (const o of lista) {
    if (o.clase !== 'pujar') continue;
    if (o.importe > margen) return null;
    margen -= o.importe; n++;
    if (o.rev) { hayRev = true; vuelve += o.importe * A.margenRev; nE++; } else nP++;
  }
  for (const o of lista) if (o.clase === 'vender' && (ciclos >= 1)) ventas += o.futura * A.margenVenta;
  if (n > 25 || nC > A.maxOnce || nP > A.maxOnce || nE > (X.paron ? 3 : 2)) return null;
  const fin = margen - M.deuda;   // el saldo al acabar el día, contando como gastado todo lo pujado
  if (hayRev && fin < -M.deuda * A.topeDeuda) return null;
  // lo pujado se cobra en el cambio de mercado: si el próximo es después de que empiece la jornada (el mismo día del
  // partido, de madrugada ya ha pasado), para empezar ESTA jornada en positivo solo cuenta lo que hay en caja
  const jornada = X.pujasAntes ? fin + vuelve + ventas : caja + ventas;
  return { caja, margen, n, fin, jornada, vuelve, ventas };
}

function elegir(X, libres, fijos) {
  const { D, M, A, ciclos } = X;
  // los puntos esperados de cada uno, una vez (el once se rehace cientos de veces)
  const pps = new Map();
  const pp = (j) => { let v = pps.get(j.id); if (v === undefined) { v = M.ppEsperado(j); pps.set(j.id, v); } return v; };
  const onceDe = (lista) => mejorOnce(lista, M.formaciones, pp);
  const antes = onceDe(X.mias);
  const N = libres.length, T = 1 << N;
  // lo que cambia el once solo depende de quién sale y quién entra: se guarda por combinación de esos
  let tocanM = 0, forzM = 0;
  libres.forEach((o, i) => { if (o.sale || o.entra) tocanM |= 1 << i; if (o.forzada) forzM |= 1 << i; });
  const fueraFijos = new Set(fijos.filter((o) => o.sale).map((o) => o.sale));
  const memo = new Map();
  const once = (mask) => {
    const key = mask & tocanM;
    let r = memo.get(key);
    if (r) return r;
    const fuera = new Set(fueraFijos), seguro = [], quiza = [];
    for (let i = 0; i < N; i++) {
      if (!(key & (1 << i))) continue;
      const o = libres[i];
      if (o.sale) fuera.add(o.sale);
      if (o.entra) (o.incierta ? quiza : seguro).push(o.entra);
    }
    const resto = X.mias.filter((j) => !fuera.has(j.id));
    const cierto = onceDe([...resto, ...seguro]);
    const todo = quiza.length ? onceDe([...resto, ...seguro, ...quiza]) : cierto;
    r = { cierto, todo, nota: quiza.length ? A.ganaPuja * todo.nota + (1 - A.ganaPuja) * cierto.nota : cierto.nota };
    memo.set(key, r);
    return r;
  };
  const base0 = onceDe(X.mias.filter((j) => !fueraFijos.has(j.id)));
  /* las cuentas de las 2^N combinaciones, cada una a partir de la que tiene un candidato menos (las mismas reglas que
     `cuentas`, sin montar listas: son miles) */
  const sAcc = new Float64Array(T), sCl = new Float64Array(T), sBid = new Float64Array(T), sRev = new Float64Array(T), sVen = new Float64Array(T), sEur = new Float64Array(T), jor = new Float64Array(T);
  const nAcc = new Uint8Array(T), nC = new Uint8Array(T), nP = new Uint8Array(T), nE = new Uint8Array(T), nOps = new Uint8Array(T), mala = new Uint8Array(T), cabe = new Uint8Array(T);
  // un jugador, una operación
  const choca = libres.map((o, i) => libres.reduce((m, p, k) => (k !== i && (p.pid === o.pid || fijos.some((f) => f.pid === o.pid)) ? m | (1 << k) : m), fijos.some((f) => f.pid === o.pid) ? 1 << i : 0));
  const dinero = num(D.dinero), margen0 = dinero + M.deuda - num(M.misPujas), n0 = M.mias.length;
  const venFijas = fijos.reduce((t, o) => t + (o.clase === 'vender' ? o.futura : 0), 0);
  const maxE = X.paron ? 3 : 2;
  let mejor = null;
  for (let mask = 0; mask < T; mask++) {
    if (mask) {
      const bajo = mask & -mask, i = 31 - Math.clz32(bajo), r = mask ^ bajo, o = libres[i];
      sAcc[mask] = sAcc[r] + (o.clase === 'aceptar' ? o.importe : 0);
      sCl[mask] = sCl[r] + (o.clase === 'clausular' ? o.importe : 0);
      sBid[mask] = sBid[r] + (o.clase === 'pujar' ? o.importe : 0);
      sRev[mask] = sRev[r] + (o.rev ? o.importe : 0);
      sVen[mask] = sVen[r] + (o.clase === 'vender' ? o.futura : 0);
      sEur[mask] = sEur[r] + o.euros;
      nAcc[mask] = nAcc[r] + (o.clase === 'aceptar' ? 1 : 0);
      nC[mask] = nC[r] + (o.clase === 'clausular' && !o.rev ? 1 : 0);
      nP[mask] = nP[r] + (o.clase === 'pujar' && !o.rev ? 1 : 0);
      nE[mask] = nE[r] + (o.rev ? 1 : 0);
      nOps[mask] = nOps[r] + 1;
      mala[mask] = mala[r] || (r & choca[i]) || (choca[i] & bajo) ? 1 : 0;
    }
    if (mala[mask]) continue;
    const acc = sAcc[mask], cl = sCl[mask], bid = sBid[mask];
    const caja = dinero + acc - cl;
    let margen = margen0 + acc - cl;
    // cada cláusula tiene que caber en la caja y, con lo ya pujado, no pasar el tope de deuda; las pujas, en el margen
    if (cl > 0 && (caja < 0 || margen < 0)) continue;
    margen -= bid;
    if (bid > 0 && margen < 0) continue;
    if (n0 - nAcc[mask] + nC[mask] + nP[mask] + nE[mask] > 25 || nC[mask] > A.maxOnce || nP[mask] > A.maxOnce || nE[mask] > maxE) continue;
    const fin = margen - M.deuda;
    if (nE[mask] && fin < -M.deuda * A.topeDeuda) continue;
    const ventas = ciclos >= 1 ? (sVen[mask] + venFijas) * A.margenVenta : 0;
    const jornada = X.pujasAntes ? fin + sRev[mask] * A.margenRev + ventas : caja + ventas;
    cabe[mask] = 1; jor[mask] = jornada;
    let valor;
    // empezar la jornada en negativo es no puntuar: lo primero. Si no hay forma, lo que más se acerque
    if (jornada < 0) valor = -1e12 + jornada;
    else {
      // lo vendido «por si hace falta» solo vale si de verdad hace falta (sin ello, la jornada empezaría en negativo), y
      // solo para eso: no para hacer sitio en la plantilla ni para pagar otra cosa. Y ninguna de más
      const fz = mask & forzM;
      if (fz) {
        const sin = mask & ~forzM;
        if (!cabe[sin] || jor[sin] >= 0) continue;
        let sobra = false;
        if (fz & (fz - 1)) for (let b = fz; b; b &= b - 1) { const m1 = mask ^ (b & -b); if (cabe[m1] && jor[m1] >= 0) { sobra = true; break; } }
        if (sobra) continue;
      }
      const on = once(mask);
      valor = sEur[mask] - A.friccion * nOps[mask] + X.punto * (on.nota - base0.nota);
      // cerca de la jornada no se abre un hueco en el once que no tape una cláusula (una puja puede no ganarse), y con
      // las cláusulas cerradas no se toca a un titular: no hay con qué reponerlo
      if (X.cerca && (on.cierto.huecos || 0) > (base0.huecos || 0)) valor -= 1e9;
      if (X.cierre) valor -= X.punto * 10 * Math.max(0, base0.nota - on.cierto.nota);
    }
    if (!mejor || valor > mejor.valor) mejor = { mask, valor };
  }
  if (!mejor) return { lista: null, antes, base0 };
  const lista = [...fijos, ...libres.filter((o, i) => mejor.mask & (1 << i))];
  return { ...mejor, lista, cu: cuentas(X, lista), on: once(mejor.mask), antes, base0 };
}

/* ---------- el plan ---------- */
/**
 * El plan del día del motor, sin cuadrar todavía (con la forma del plan de la IA, como planAuto). `vetados`: candidatos
 * que no pueden ir (los que la app descartó en la vuelta anterior).
 */
export function planMotor(D, M, c, { vetados = new Set(), ahora = Date.now() } = {}) {
  const X = contextoDe(D, M, c, ahora);
  X.backtest = reventasPasadas(D, M);
  // si en esta liga lo que la app habría comprado para revender no ha ganado a no hacer nada, no se especula
  X.fiable = X.A.frenoReventa && X.backtest && X.backtest.n >= 8 ? (X.backtest.media <= 0 ? 0 : clamp(X.backtest.bien / X.backtest.n / 0.6, 0.5, 1.1)) : 1;
  const { paron, inicio, ventana, ciclos } = X;
  const { libres: todos, fijos } = candidatos(X, vetados);
  // ¿hace falta vender para empezar la jornada en positivo? Solo entonces entran los «por si hace falta»
  const base = cuentas(X, fijos) || { jornada: -1, caja: num(D.dinero), fin: num(D.dinero) - num(M.misPujas) };
  const conMotivo = todos.filter((o) => !o.forzada && o.euros > -1e11);
  const sinForzar = cuentas(X, [...fijos, ...conMotivo.filter((o) => o.clase === 'vender' || (o.clase === 'aceptar'))]);
  const apuro = base.jornada < 0;
  // los candidatos que entran en la búsqueda: como mucho 13 (8.192 combinaciones); de cada clase, los mejores
  const mejores = (xs, n, f) => [...xs].sort((a, b) => f(b) - f(a)).slice(0, n);
  const porValor = (o) => o.euros + (o.entra ? X.punto * M.mejora(o.entra) : 0) - (o.sale ? X.punto * M.perdida(o.sale) : 0);
  let libres = [
    ...mejores(conMotivo.filter((o) => o.clase === 'aceptar' || o.clase === 'vender'), 4, porValor),
    ...mejores(conMotivo.filter((o) => o.objetivo === 'titular' && o.clase === 'clausular'), 3, (o) => o.interes),
    ...mejores(conMotivo.filter((o) => o.objetivo === 'titular' && o.clase === 'pujar'), 2, (o) => o.interes),
    ...mejores(conMotivo.filter((o) => o.rev), 3, (o) => o.euros * (o.vuelve ? 1.5 : 1)),
  ];
  if (apuro) {
    // lo que menos cuesta soltar (en euros y en puntos); con las cláusulas cerradas y sin cambios de mercado, solo vale
    // el dinero que entra hoy: las ofertas que ya tienes
    const forz = todos.filter((o) => o.forzada && (ciclos >= 1 || o.clase === 'aceptar') && !libres.some((l) => l.pid === o.pid && l.clase === o.clase));
    libres = [...libres.slice(0, 9), ...mejores(forz, 13 - Math.min(9, libres.length), porValor)];
  }
  void sinForzar;
  // en apuros y sin cambios de mercado antes de la jornada, lo que se ponga a la venta no llega a tiempo: hoy solo cuenta
  // el dinero que entra ya. Lo demás se deja para cuando empiece la jornada (y así la app, al cuadrar, no da por cobrado
  // lo que aún no ha entrado)
  if (apuro && ciclos === 0) {
    libres = libres.filter((o) => o.clase !== 'vender');
    for (let i = fijos.length - 1; i >= 0; i--) if (fijos[i].clase === 'vender') fijos.splice(i, 1);
  }
  const E = elegir(X, libres, fijos);
  const lista = E.lista || fijos;
  const cu = E.cu || base;

  /* el orden: lo que mete dinero ya, lo que se pone a la venta, las cláusulas, las pujas (el once antes que revender) */
  const ORDEN = (o) => (o.clase === 'aceptar' ? 0 : o.clase === 'vender' ? (o.luego ? 6 : 1) : o.clase === 'clausular' ? (o.rev ? 3 : 2) : o.rev ? 5 : 4);
  const orden = [...lista].sort((a, b) => ORDEN(a) - ORDEN(b) || b.euros - a.euros);
  const ops = [];
  let plantilla = X.mias.filter((j) => !lista.some((o) => o.sale === j.id));
  let onceAhora = M.mejorOnce(plantilla);
  // (lo seguro: lo tuyo que no vendes y lo que clausulas; una puja puede no ganarse y no va en el once que se propone)
  let cierta = plantilla;
  let caja = num(D.dinero);
  const faltaba = base.jornada < 0 ? ` Sin vender, empezarías la jornada con ${eur(base.jornada)} (contando lo que ya tienes pujado).` : '';
  for (const o of orden) {
    let gana = 0;
    if (o.entra) { const con = M.mejorOnce([...plantilla, o.entra]); gana = con.nota - onceAhora.nota; plantilla = [...plantilla, o.entra]; onceAhora = con; if (!o.incierta) cierta = [...cierta, o.entra]; }
    if (o.cajaHoy) caja += o.cajaHoy;
    ops.push({ confianza: 'media', ...o.op({ gana, caja: o.clase === 'clausular' ? caja : null, resto: faltaba }), _k: o.k });
  }

  /* lo mejor que no te llega todavía, para que sepas cuánto te falta */
  const enPlan = new Set(ops.map((o) => o.pid));
  const hueco = (j) => M.mejorOnce([...plantilla, j]).nota - onceAhora.nota >= 0.5;
  const fuera = paron ? null : M.clausulas.find((x) => !enPlan.has(x.pid) && x.abierta && x.interes >= 70 && x.clausula > caja && x.clausula <= M.pujaMax && !MALOS.has(x.j.estado) && mereceClausula(M, x, ahora) && hueco(x.j) && M.compraCal(x.j, x.clausula).ok);
  if (fuera && lista.filter((o) => o.clase === 'clausular' && !o.rev).length < X.A.maxOnce) {
    ops.push({ accion: 'esperar', pid: fuera.pid, jugador: fuera.j.nombre, donde: `cláusula de ${eur(fuera.clausula)} a ${fuera.rival.manager || fuera.rival.nombre}`, importe: null, cuando: 'si entra dinero', confianza: 'baja',
      motivo: `Es el mejor a tiro (interés ${fuera.interes}), pero te faltan ${eur(fuera.clausula - caja)}: una cláusula solo se paga con saldo, sin deuda, y lo que pones en venta no entra hasta que aceptas la oferta. Si entra ese dinero y sigue abierta, ve a por él.` });
  }

  /* proteger a los tuyos: primero el blindaje gratis (2 por jornada), luego subir la cláusula si compensa y hay saldo */
  const vendidos = new Set(lista.filter((o) => o.sale).map((o) => o.sale));
  let escudos = 0;
  for (const pid of (M.paraEscudo || []).filter((p) => !vendidos.has(p) && !vetados.has(`B-${p}`))) {
    const x = M.mias.find((y) => y.pid === pid);
    if (!x) continue;
    escudos++;
    const quien = x.pagan ? [...x.pagan.seguro, ...x.pagan.quiza].length : 0;
    ops.push({ accion: 'blindar', ref: `B-${x.pid}`, objetivo: 'proteger', pid: x.pid, jugador: x.j.nombre, donde: 'con el blindaje de LaLiga (gratis, viendo un anuncio)', importe: 0, cuando: 'ahora', confianza: 'media', _k: `B-${x.pid}`,
      motivo: `Su cláusula (${eur(x.clausula)}) está abierta y ${quien ? `le llega a ${quien} rival${quien > 1 ? 'es' : ''}` : 'algún rival la puede pagar'}; ${x.pierde >= 0.5 ? `te da ${d1(x.pierde)} pts por jornada` : 'aunque no te puntúe, te lo quitarían casi a su valor: vendiéndolo a LaLiga sacarías más y reponerlo cuesta más'}. El blindaje la protege ${M.ESCUDO_H} h sin gastar nada (te quedan ${(M.escudosMios || {}).quedan} esta jornada). Si no, te lo pueden quitar pagando la cláusula.`,
      datos: { porque: `cláusula abierta a tiro de ${quien || 'algún'} rival${quien === 1 ? '' : 'es'}`, cuanto: 'gratis (un anuncio)', cuando: 'ahora', siNo: `te lo pueden quitar por ${eur(x.clausula)}` } });
  }
  let cajaB = cu.caja, jorB = cu.jornada, margenB = cu.margen != null ? cu.margen : num(D.dinero) + M.deuda - num(M.misPujas);
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.riesgo === 'alto' && y.importa && !y.escudo && !(M.paraEscudo || []).includes(y.pid) && !(y.blindaje && (y.blindaje.caro || y.blindaje.yaVale)) && !y.ventaInercia && !vetados.has(`S-${y.pid}`)).sort((a, b) => b.pierde - a.pierde).slice(0, 2)) {
    const b = x.blindaje;
    // subirla cuesta saldo en el momento, y no puede dejarte en negativo para la jornada
    if (!b || !b.coste || b.coste > cajaB || jorB - b.coste < 0 || margenB - b.coste < 0) continue;
    cajaB -= b.coste; jorB -= b.coste; margenB -= b.coste;
    ops.push({ accion: 'blindar', ref: `B-${x.pid}`, objetivo: 'proteger', pid: x.pid, jugador: x.j.nombre, donde: `subir su cláusula a ${eur(b.objetivo)}`, importe: b.coste, cuando: x.abierta ? 'ahora' : antesDe(x.protegidoHasta), confianza: 'media', _k: `S-${x.pid}`,
      motivo: `Su cláusula (${eur(x.clausula)}) ${x.ratio < 1.05 ? 'está en su valor' : `solo pasa un ${pct((x.ratio - 1) * 100, 0)} de su valor`} (${eur(x.j.valor)}), ${x.abierta ? 'ya está abierta' : `se abre en ${dura(x.abreEn)}`} y te da ${d1(x.pierde)} pts por jornada. Con ${eur(b.coste)} no le llegaría a ningún rival${escudos ? '' : ' (no te quedan blindajes gratis para él)'}.`,
      datos: { porque: 'cláusula casi a su valor y es importante en tu once', cuanto: eur(b.coste), cuando: x.abierta ? 'ahora' : antesDe(x.protegidoHasta), siNo: `te lo pueden quitar por ${eur(x.clausula)}` } });
  }

  /* la alineación, si la jornada empieza pronto (con otra en juego, no: el once está cerrado) */
  const onceFijo = M.mejorOnce(cierta);
  const pujados = lista.filter((o) => o.incierta && o.entra && onceAhora.lineas.flat().some((j) => j.id === o.entra.id)).map((o) => o.entra.nombre);
  if (inicio && inicio - ahora < 30 * HORA && inicio > ahora && !M.enJuego) {
    const tocados = onceFijo.lineas.flat().filter((j) => j.estado === 'doubtful');
    const sancionados = M.mias.filter((x) => !vendidos.has(x.pid) && M.sancionCorta(x.j));
    ops.push({ accion: 'alinear', jugador: '', donde: `jornada ${M.proxima.n}`, importe: null, cuando: antesDe(inicio), confianza: 'media',
      motivo: `Pon el ${onceFijo.nombre}: ${onceFijo.lineas.flat().map((j) => j.nombre).join(', ')}.${onceFijo.huecos ? ` Te faltan ${onceFijo.huecos} para completarlo.` : ''}${pujados.length ? ` Si ganas la puja por ${pujados.join(' y ')}, mételo${pujados.length > 1 ? 's' : ''} en el once antes de que empiece la jornada.` : ''}${tocados.length ? ` Ojo con ${tocados.map((j) => j.nombre).join(', ')}, que son duda.` : ''}${sancionados.length ? ` ${sancionados.map((x) => x.j.nombre).join(', ')} ${sancionados.length === 1 ? 'está sancionado y se pierde' : 'están sancionados y se pierden'} la jornada: ${sancionados.length === 1 ? 'aguántalo, vuelve' : 'aguántalos, vuelven'} a la siguiente.` : ''}` });
  }
  if (!ops.length) {
    ops.push({ accion: 'esperar', jugador: '', donde: '', importe: null, cuando: 'hoy', confianza: 'media',
      motivo: M.vedaAhora ? `Las cláusulas están cerradas hasta que empiece la jornada ${M.vedaAhora.n} y no hay nada en el mercado que mejore tu once sin pagar de más. Hoy, quieto.` : 'Hoy no hay ninguna operación clara: ni cláusulas que merezcan la pena abiertas, ni chollos en el mercado, ni nada tuyo que haya que vender. Mejor guardar el dinero.' });
  }

  /* lo que el motor dejó fuera y también vale (para que la IA pueda cambiar algo): cada una cabe añadida al plan */
  const dentro = new Set(lista.map((o) => o.k));
  const alternativas = todos.filter((o) => !o.forzada && !dentro.has(o.k) && !lista.some((l) => l.pid === o.pid))
    .filter((o) => { const c2 = cuentas(X, [...lista, o]); return !!c2 && c2.jornada >= 0; })
    .sort((a, b) => porValor(b) - porValor(a)).slice(0, 4)
    .map((o) => ({ ...o.op({ gana: o.entra ? Math.max(0, M.mejorOnce([...plantilla, o.entra]).nota - onceAhora.nota) : 0, caja: null, resto: '' }), _k: o.k }));

  /* lo que Hoy enseña como «toca» (M.acciones) y el plan no lleva: mirado y descartado, con el porqué. Así Hoy y el plan
     no se contradicen: lo que el motor ha dejado fuera no sale arriba como urgente (vistas.js, urgentesDe) */
  const limpio = (t) => String(t || '').replace(/La app lo descarta[.:]?\s*/g, '').replace(/\s+/g, ' ').trim();
  const corto = (t, n = 230) => { const x = limpio(t); if (x.length <= n) return x; const c2 = x.slice(0, n), i = Math.max(c2.lastIndexOf('. '), c2.lastIndexOf('; ')); return `${(i > 80 ? c2.slice(0, i) : c2.slice(0, c2.lastIndexOf(' '))).replace(/[\s,;:.]+$/, '')}…`; };
  const porQueNo = (a) => {
    const cand = todos.find((o) => o.pid === a.pid && !o.forzada);
    if (a.tipo === 'vender') {
      const ver = X.V[`A-${a.pid}`] || X.V[`V-${a.pid}`], p = M.perdida(a.pid);
      if (ver && !ver.ok) return corto(ver.aviso) || 'la app no lo vendería hoy';
      if (cand && X.cierre && p >= 0.3) return `Con las cláusulas cerradas no se toca a un titular: no habría con qué reponerlo antes de la jornada${M.proxima ? ` ${M.proxima.n}` : ''}.`;
      if (cand && p >= 0.3) return `Te da ${d1(p)} pts por jornada y hoy eso pesa más que lo que puede bajar${cand.euros > 0 ? ` (unos ${eur(cand.euros)})` : ''}: se aguanta y se vuelve a mirar mañana.`;
      return cand ? 'Hoy no compensa: lo que dejaría de bajar no paga el paso.' : 'Hoy no hay motivo para venderlo.';
    }
    const ver = X.V[`${a.tipo === 'pujar' ? 'P' : 'C'}-${a.pid}`];
    if (ver && !ver.ok) return corto(ver.aviso) || 'la app no la haría hoy';
    if (llena) return 'Tienes la plantilla llena (25): no cabe nadie más sin vender antes.';
    if (cand && !cuentas(X, [...lista, cand])) return a.tipo === 'pujar' ? 'No cabe hoy: con lo que ya llevas pujado y el resto del plan pasarías del tope de deuda.' : 'No cabe hoy: una cláusula solo se paga con saldo y el del plan ya está gastado.';
    return 'Con el resto del plan ya no mejora tu once lo bastante para lo que cuesta.';
  };
  const llena = M.mias.length >= 25;
  const descartes = (M.acciones || []).filter((a) => a.pid && ['vender', 'clausular', 'pujar'].includes(a.tipo) && !enPlan.has(a.pid) && !lista.some((o) => o.pid === a.pid))
    .filter((a, i, xs) => xs.findIndex((b) => b.pid === a.pid) === i).slice(0, 6)
    .map((a) => ({ pid: a.pid, jugador: (M.J(a.pid) || {}).nombre || '', motivo: porQueNo(a) })).filter((d) => d.jugador);

  /* los próximos días: cláusulas que se abren, mercado, jornada y parón */
  const dias = {};
  const add = (t, prio, texto, rev) => { const d = diaDe(t); (dias[d] ||= { t, cosas: [] }).cosas.push(rev ? { prio, texto, rev } : { prio, texto }); };
  const hora = (t) => cuando(t).split(' ').pop();
  for (const x of M.clausulas.filter((y) => !y.abierta && y.abreEn < 4 * DIA && y.meLlega && y.interes >= 55)) add(x.protegidoHasta, x.interes, `${hora(x.protegidoHasta)} se abre ${x.j.nombre} (${eur(x.clausula)}, de ${x.rival.manager || x.rival.nombre})`);
  for (const x of M.mias.filter((y) => !y.abierta && y.abreEn < 4 * DIA && y.riesgo !== 'ninguno')) add(x.protegidoHasta, 90, `${hora(x.protegidoHasta)} se acaba la protección de tu ${x.j.nombre}`);
  if (inicio) add(inicio, 100, `${hora(inicio)} empieza la jornada ${M.proxima.n}: saldo en positivo y once revisado antes`);
  if (inicio && inicio - M.VEDA_H * HORA > ahora) add(inicio - M.VEDA_H * HORA, 97, `${hora(inicio - M.VEDA_H * HORA)} se cierran las cláusulas hasta que empiece la jornada: lo que quieras clausular, antes o a las ${hora(inicio)}`);
  const aRevender = [...lista.filter((o) => o.rev).map((o) => ({ pid: o.pid, nombre: o.j.nombre })), ...M.paraRevender.filter((x) => !vendidos.has(x.pid)).map((x) => ({ pid: x.pid, nombre: x.j.nombre }))];
  if (aRevender.length && ventana) add(ventana.ponerVenta, 99, '', aRevender);
  if (M.paron && M.paron.ini > ahora) add(M.paron.ini, 95, 'empieza el parón: los valores se paran, vende a los que estén en lo alto');
  const diasAuto = Object.values(dias).sort((a, b) => a.t - b.t);

  const modo = paron ? 'paron' : M.enJuego ? 'enjuego' : M.vedaAhora ? 'cierre' : num(D.dinero) < 0 ? 'negativo' : 'normal';
  const situacion = `Tienes ${eur(D.dinero)} y puedes gastar hasta ${eur(M.pujaMax)}${num(M.misPujas) ? ` (ya descontados los ${eur(M.misPujas)} que tienes pujados)` : ''}. Vas ${M.yo ? `${M.yo.pos}º con ${M.yo.puntos} puntos` : ''}${M.proxima ? ` y la jornada ${M.proxima.n} empieza ${cuando(M.proxima.ini)}` : ''}.`
    + (llena ? ` Tienes la plantilla llena (${M.mias.length} de 25): no cabe nadie más sin vender antes.` : M.mias.length >= 23 ? ` Tienes ${M.mias.length} de 25 jugadores: te ${25 - M.mias.length === 1 ? 'queda 1 sitio' : `quedan ${25 - M.mias.length} sitios`}.` : '')
    + (modo === 'paron' ? ' Estamos en el parón: nadie puntúa hasta la vuelta, así que hoy manda el dinero (comprar lo que sube para venderlo antes de la jornada y vender lo que ha girado). Las cláusulas para el once, en los dos o tres días antes de la vuelta.' : '')
    + (modo === 'cierre' ? ` Las cláusulas están cerradas hasta que empiece la jornada ${M.vedaAhora.n} (${cuando(M.vedaAhora.fin)}): hoy no se toca a los titulares, que no habría con qué reponerlos.` : '')
    + (modo === 'enjuego' ? ` La jornada ${M.enJuego.n} está en juego y tu once está cerrado: el plan ya mira a la siguiente.` : '')
    + (base.jornada < 0 ? ` Contando lo que tienes pujado, sin vender empezarías la jornada con ${eur(base.jornada)}: en negativo no se puntúa, así que el plan dice qué vender y cuándo.` : '');
  return {
    auto: true, motor: true, t: ahora, dia: diaDe(ahora), modo,
    titular: '', situacion, operaciones: ops, alternativas, descartes,
    proximos_dias: [], diasAuto,
    alineacion: onceFijo.formacion ? { formacion: onceFijo.nombre, titulares: onceFijo.lineas.flat().map((j) => j.nombre), dudas: onceFijo.lineas.flat().filter((j) => j.estado === 'doubtful').map((j) => `${j.nombre}: es duda`) } : null,
    cuentas: { ...cu, sinVender: base.jornada, punto: X.vp, valor: E.valor, candidatos: todos.length, probados: libres.length, claves: libres.map((o) => o.k), backtest: X.backtest },
  };
}

/** el titular del plan del motor: lo que toca hoy, con nombres si son pocos */
function titularMotor(P) {
  const vivos = (P.ops || []).filter((o) => !o.descartada && !o.sugerencia && o.hoy !== false);
  const rev = (o) => o.objetivo === 'revender' && ['pujar', 'clausular', 'comprar'].includes(o.accion);
  const de = (a) => vivos.filter((o) => o.accion === a && !rev(o));
  const quien = (xs) => (xs.length <= 2 ? xs.map((o) => (o.j && o.j.nombre) || o.jugador).join(' y ') : `${xs.length}`);
  const acepta = de('vender').filter((o) => o.etiqueta === 'Aceptar oferta'), vende = de('vender').filter((o) => o.etiqueta !== 'Aceptar oferta');
  const partes = [
    acepta.length && `aceptar la oferta por ${quien(acepta)}`,
    vende.length && `poner a la venta a ${quien(vende)}`,
    de('clausular').length && `clausular a ${quien(de('clausular'))}`,
    de('pujar').length && `pujar por ${quien(de('pujar'))}`,
    de('blindar').length && `proteger a ${quien(de('blindar'))}`,
    vivos.filter(rev).length && `especular con ${quien(vivos.filter(rev))} para revender`,
  ].filter(Boolean);
  const pre = P.modo === 'paron' ? 'Parón: ' : '';
  if (partes.length) return `${pre}${pre ? 'hoy' : 'Hoy'} toca ${partes.slice(0, 4).join(', ')}${partes.length > 4 ? ' y más' : ''}`;
  if ((P.ops || []).some((o) => !o.descartada && o.hoy === false && o.accion === 'vender')) return `${pre}${pre ? 'hoy' : 'Hoy'}, quieto: lo de vender, más cerca de la jornada`;
  return vivos.some((o) => o.accion === 'alinear') ? `${pre}${pre ? 'hoy' : 'Hoy'} solo toca preparar la jornada` : `${pre}${pre ? 'hoy' : 'Hoy'}, quieto: guarda el dinero`;
}

/**
 * El plan de hoy sin IA, ya cuadrado por la app (lo que pinta Hoy). El motor elige, cuadrarPlan lo revisa y, si descarta
 * algo o lo deja «sin prisa», ese candidato se veta y se elige otra vez (como mucho 6 vueltas). Si algo falla, el de antes.
 */
export function planDeHoy(D, M, c) {
  if (M._planHoy && M._planHoy.dia === diaDe() && M._planHoy.dinero === D.dinero) return M._planHoy.plan;
  let R = null;
  try {
    const vetados = new Set(), vetos = [];
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      const P = planMotor(D, M, c, { vetados });
      R = cuadrarPlan(P, D, M);
      const mal = (R.ops || []).filter((o) => o._k && (o.descartada || o.sugerencia));
      if (!mal.length) break;
      for (const o of mal) { vetados.add(o._k); vetos.push({ k: o._k, jugador: (o.j && o.j.nombre) || o.jugador, aviso: o.aviso || '' }); }
    }
    // (lo que la app no dejó pasar al cuadrar, con su motivo: para el diagnóstico y las pruebas)
    if (vetos.length) { R.vueltas = vetos.length; R.vetos = vetos; }
    // (red de seguridad: si tras las vueltas quedara algo descartado, fuera)
    if ((R.ops || []).some((o) => o.descartada || o.sugerencia)) R = cuadrarPlan({ ...R, operaciones: (R.operaciones || []).filter((o) => !(R.ops || []).some((x) => x._k && x._k === o._k && (x.descartada || x.sugerencia))) }, D, M);
    R = rematarMotor(R, M);
  } catch (e) {
    try { console.warn('plan.js:', e); } catch (e2) { /* sin consola */ }
    R = rematarAuto(cuadrarPlan(planAuto(D, M, c), D, M));
  }
  M._planHoy = { dia: diaDe(), dinero: D.dinero, plan: R };
  return R;
}

/** el plan del motor ya cuadrado: su titular, los próximos días y cómo queda el saldo para la jornada */
export function rematarMotor(R, M) {
  if (!R || !R.motor || !Array.isArray(R.ops)) return R;
  const out = rematarAuto(R);
  out.titular = titularMotor(out);
  const cu = R.cuentas || {};
  const luego = out.ops.filter((o) => !o.descartada && o.hoy === false && o.accion === 'vender');
  const rev = out.ops.filter((o) => !o.descartada && String(o.objetivo || '').startsWith('revend') && o.signo < 0);
  const venta = out.ops.filter((o) => !o.descartada && o.hoy !== false && o.accion === 'vender' && o.etiqueta !== 'Aceptar oferta');
  const nombres = (xs) => xs.map((o) => (o.j && o.j.nombre) || o.jugador).join(', ');
  // lo que se pone a la venta no ha entrado todavía: el «te quedas con» de la app lo daba ya por cobrado
  if (cu.fin != null && cu.jornada != null && (cu.fin < 0 || luego.length)) {
    const como = [rev.length && `vendas lo de revender (${nombres(rev)})`, (venta.length || luego.length) && `entre lo que pones en venta (${nombres([...venta, ...luego])})`].filter(Boolean).join(' y ');
    // (la cifra de la derecha es `final`: aquí, lo que habría al empezar la jornada, con los márgenes de seguridad)
    out.avisoSaldo = cu.jornada >= 0
      ? `${cu.fin < 0 ? `En negativo a propósito (${eur(cu.fin)} contando todo lo pujado)` : 'En positivo'}${como ? ` hasta que ${como}` : ''}. Aunque los valores bajen, a la jornada llegas con unos`
      : `Ni con este plan llegas en positivo a la jornada: vende algo más antes de que empiece${M.proxima ? ` (${cuando(M.proxima.ini)})` : ''}. Te quedarías en`;
    out.final = Math.round(cu.jornada / 1e4) * 1e4;
    out.avisoTipo = cu.jornada >= 0 ? 'plan' : 'mal';
  }
  return out;
}

/* ---------- ¿habría salido bien? lo de revender, con el histórico de la liga ---------- */
/**
 * Con los valores de cada día que guarda la app (H.v, vía M.tend): cada día de las últimas semanas, lo que el motor
 * habría comprado para revender (sube más de un 0,4 % al día en los 3 días de antes y no se frena) y cómo le fue a los
 * `dias` días, pagando lo que se paga en esta liga por un libre. Devuelve { n, bien, media, nada } o null si no hay datos.
 */
export function reventasPasadas(D, M, { dias = 4 } = {}) {
  if (M._revPas !== undefined) return M._revPas;
  let n = 0, bien = 0, suma = 0;
  try {
    const sobre = M.pujasLiga && !M.pujasLiga.poco ? clamp(M.pujasLiga.med, 0, 0.3) : 0.05;
    const ids = Object.keys(D.maestro || {});
    for (const pid of ids) {
      const t = M.tend(pid);
      const s = t && (t.dias || t.serie);
      if (!Array.isArray(s) || s.length < 5 + dias) continue;
      const v = s.map((x) => +x[1]).filter((x) => x > 0);
      if (v.length < 5 + dias || v[v.length - 1] < 1e6) continue;
      // un día sí y otro no, para que las mismas subidas no cuenten varias veces
      for (let i = 3; i + dias < v.length; i += 2) {
        const r3 = Math.pow(v[i] / v[i - 3], 1 / 3) - 1, r1 = v[i] / v[i - 1] - 1;
        if (r3 <= 0.004 || r1 < r3 * 0.5) continue;
        // el mismo filtro que M.especular: la subida, frenándose un 15 % cada día, tiene que dejar al menos un 2,5 %
        const r = Math.min(r3, 0.04), precio = v[i] * (1 + sobre);
        let fut = v[i];
        for (let k = 0; k < dias; k++) fut *= 1 + r * Math.pow(0.85, k);
        if (fut - precio < Math.max(250000, precio * 0.025)) continue;
        const gana = v[i + dias] - precio;
        n++; suma += gana; if (gana > 0) bien++;
      }
    }
  } catch (e) { n = 0; }
  return (M._revPas = n ? { n, bien, media: Math.round(suma / n), dias } : null);
}
