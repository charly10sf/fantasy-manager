/* UNA decisión por jugador y momento (24 nov, aviso de Senna: «me recomienda vender un jugador y luego que lo aguante»).
   Hasta aquí, vender o aguantar a uno tuyo lo decidían reglas distintas en cada sitio (la inercia en Hoy y Equipo,
   `M.ventaMia` en el chat, el consejo de la oferta en «en venta», los candidatos del plan y los vetos de `cuadrarPlan`),
   y a menudo decían cosas contrarias. Ahora la decisión se toma aquí, una vez por análisis, y todo lo demás la lee:
   plan.js, acciones.js, Equipo, la ficha, fondo.js, avisos.js, `cuadrarPlan`, `veredictos` y lo que lee la IA.

   `decidir(D, M)` corre al final de `analizar` y deja:
     M.decisionBase(pid)  la decisión sin mirar el plan (la que usan plan.js y `cuadrarPlan` para montarlo y repasarlo)
     M.decision(pid)      la que se enseña: la base y, si el plan que se ve vende a ese jugador porque hace falta el
                          dinero para empezar la jornada en positivo, «vender: hace falta el dinero»
     M.verPlan(P)         el plan que está viendo el mánager (app.js lo pone al cambiarlo)
     M.decisionFichar(pid) lo que dice el plan de fichar a uno que no es tuyo (paso vivo, o mirado y descartado)

   Una decisión: { pid, j, accion: 'vender' | 'aguantar', matiz, paso, regla, porque, porqueLargo, cifras, cuando, t }
     matiz  lo que antes no se podía decir: 'acepta' (acepta la oferta), 'esta-oferta-no', 'espera-oferta' (en venta y sin
            ofertas), 'con-recambio', 'antes-del-giro', 'otro-dia', 'por-dinero'; al aguantar: 'dicho', 'reventa', 'vuelve',
            'sube', 'busca-sustituto', 'titular', 'clausula', 'oferta-no' (tiene una oferta y no compensa) o null
     paso   qué se hace hoy: 'aceptar', 'poner' (a la venta), 'esperar' (ya está en venta: a por otra oferta), 'fichar'
            (antes, el recambio) o 'nada'

   EL ORDEN DE LAS REGLAS (la primera que se cumple decide; la tabla, también en claude/auditoria-coherencia.md):
     1 dicho         «a X no lo vendo», dicho en Pregunta                                   → aguantar
     2 entrenador    no puntúa en la versión gratuita                                        → vender
     3 baja          lesión larga, fuera de LaLiga o sancionado y cayendo (`M.vendeBaja`)    → vender
     4 reventa       comprado para revender: `M.aguantaReventa` → aguantar; si no → vender (hoy si toca, o la víspera)
     5 vuelve        el que vuelve y sigue subiendo                                          → aguantar
     6 sube          sube un 0,5 % al día o más sin frenar (Fornals, 13 nov)                 → aguantar
     7 cambio        titular que baja, sin relevo y con recambio en el mercado (`M.cambioDe`) → vender cuando llegue el recambio
     8 titular-baja  titular que baja todos los días: con relevo → vender; sin relevo → aguantar (búscale sustituto)
     9 titular-gira  titular que ha girado pero no baja todos los días (Carlos, 14 nov)      → aguantar
    10 clausula      se frena, con la cláusula abierta por encima de LaLiga y un rival que la paga → aguantar
    11 inercia       suplente que ha girado, baja o se ha parado (`M.ventaPorInercia`)       → vender
    12 desplome      suplente con beneficio que lleva un −4 % en 7 días                      → vender
    13 resto                                                                                 → aguantar
   Encima, la oferta que tenga (el consejo de `M.misVentas`, con UNA cuenta para el que sube) y, encima de todo, el dinero. */
import { eur, pct, cuando, DIA, HORA } from './util.js';

const num = (x) => +x || 0;
const P7 = (t) => (!t ? null : t.p7e !== undefined ? t.p7e : t.p7);
const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const PUESTO = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero' };
/** un titular sin relevo: sin él, el once pierde casi todo lo que él da (la misma regla que plan.js y motor.js) */
export const sinRelevo = (M, x) => { const p = M.perdida(x.pid); return p >= 1 && p >= 0.5 * (M.ppEsperado(x.j) || 0); };
/** los días que le quedan al valor para moverse antes de la jornada (hasta la víspera) */
const diasVispera = (M, ahora) => (M.proxima ? Math.min(14, Math.max(1, Math.ceil((M.proxima.ini - ahora) / DIA) - 1)) : 3);

/** lo de revender: ¿toca venderlo ya? (la víspera del último cambio de mercado, si ha empezado a bajar o si se le acaba
 * la protección de la cláusula) */
export function tocaRevender(M, x, ahora = Date.now()) {
  const ventana = M.ventanaEsp || null, t = x.tend || {};
  const baja = t.p1 != null && t.p1 < -1;
  const protege = !!x.protegidoHasta && x.protegidoHasta - ahora <= 1.5 * DIA;
  return { toca: !ventana || ahora >= ventana.ponerVenta - 6 * HORA || baja || protege, baja, protege, cuando: ventana ? ventana.ponerVenta : null };
}

/** la decisión de vender o aguantar a uno tuyo, sin mirar ofertas ni el plan */
function base(D, M, x, ahora) {
  const pid = x.pid, j = x.j, v = j.valor || 0;
  const ine = M.inercia(pid), t = x.tend || M.tend(pid) || {};
  const pierde = M.perdida(pid), tit = pierde >= 0.3, bs = M.bajaSeguido(pid), vi = x.ventaInercia || null;
  const out = (accion, regla, matiz, porque, mas = {}) => ({ pid, j, accion, regla, matiz, porque, ...mas });
  // 1. lo ha dicho él
  if (M.noVender && M.noVender.has(pid)) return out('aguantar', 'dicho', 'dicho', 'Me dijiste que no lo vendes.');
  // 2. el entrenador
  if (j.pos === 5) return out('vender', 'entrenador', null, `Es entrenador y no puntúa: son ${eur(v)} parados.`);
  // 3. de baja
  if (M.vendeBaja(x)) return out('vender', 'baja', null, `${M.deBaja(j) ? M.bajaTxt(j) : 'Sancionado una jornada y su valor cae deprisa'}: no te va a puntuar y pierde valor.`);
  // 4. lo comprado para revender
  const rev = (M.paraRevender || []).find((r) => r.pid === pid);
  if (rev) {
    const ben = eur(rev.beneficioYa, { signo: true });
    if (M.aguantaReventa(x)) {
      const sube = !!ine && num(ine.ult) > 0;
      return out('aguantar', 'reventa', 'reventa', `Lo compraste para revender (${ben})${sube ? ' y sigue subiendo' : ''}: aguántalo hasta que deje de subir${x.protegidoHasta ? ` o hasta el ${cuando(x.protegidoHasta - DIA, { hora: false })}, que se le abre la cláusula` : ''}.`);
    }
    const r = tocaRevender(M, x, ahora);
    if (r.toca) return out('vender', 'reventa', null, `Lo compraste para revender (${ben}) y ${r.baja ? 'ha empezado a bajar: mejor salir ya' : r.protege ? 'se le acaba la protección de la cláusula' : 'toca venderlo antes de la jornada'}.`);
    return out('vender', 'reventa', 'otro-dia', `Lo compraste para revender (${ben}): se pone a la venta ${cuando(r.cuando, { hora: false })}, para la última oferta antes de la jornada.`, { cuando: r.cuando });
  }
  // 5. el que vuelve y sigue subiendo
  if (ine && ine.vuelve) return out('aguantar', 'vuelve', 'vuelve', `Vuelve y sigue subiendo (un ${pct(ine.vuelve.ritmo * 100, 1, false)} al día): cada día que lo aguantes vale más.`);
  // 6. sube de verdad
  if (ine && !vi && ['sube', 'acelera'].includes(ine.fase) && v && num(ine.ult) >= v * 0.005) {
    const dias = diasVispera(M, ahora), gana = ine.proy ? ine.proy(dias) : ine.proyJ;
    if (gana > 0) return out('aguantar', 'sube', 'sube', `Sube ${eur(ine.ult, { signo: true })} al día: aguantándolo ${dias} día${dias === 1 ? '' : 's'} más vale unos ${eur(gana)} más.`, { gana, dias });
  }
  // 7-9. un titular
  if (tit) {
    const cb = M.cambioDe ? M.cambioDe(pid) : null;
    if (cb) {
      const r = cb.rec[0];
      return out('vender', 'cambio', 'con-recambio', `${bs ? `Baja ${bs.planos ? 'casi todos los días' : `${bs.dias} días seguidos`}` : 'Ha girado a la baja'} y no tienes otro ${PUESTO[j.pos] || 'en su puesto'} como él: ficha a ${r.j.nombre} y, cuando lo tengas, véndelo.`, { recambio: r });
    }
    if (bs) {
      const baja = `Baja ${bs.planos ? 'casi todos los días' : `${bs.dias} días seguidos`}`;
      if (sinRelevo(M, x) && !(M.cambioHecho && M.cambioHecho(pid))) return out('aguantar', 'titular-baja', 'busca-sustituto', `${baja}, pero es titular y no tienes otro ${PUESTO[j.pos] || 'en su puesto'} como él: búscale sustituto antes de venderlo.`);
      return out('vender', 'titular-baja', null, `${baja} y tienes relevo en tu plantilla: a la venta, por si llega una buena oferta.`);
    }
    if (vi) return out('aguantar', 'titular-gira', 'titular', `${vi.urgencia === 'ya' ? 'Ha girado a la baja' : 'Se está frenando'}, pero es titular en tu once (${d1(pierde)} pts por jornada) y aún no baja todos los días.`);
    return out('aguantar', 'resto', 'titular', `Es titular en tu once (${d1(pierde)} pts por jornada) y no está bajando.`);
  }
  // 10-11. un suplente, por la inercia
  if (vi) {
    if (vi.urgencia !== 'ya' && M.esperarVenta(x).tipo === 'clausula') return out('aguantar', 'clausula', 'clausula', `Se frena, pero su cláusula (${eur(x.clausula)}) paga más que LaLiga y a algún rival le llega: si te lo clausulan, cobras más.`);
    const hoy = num(vi.ult) < 0 ? ` (hoy ${eur(vi.ult, { signo: true })})` : '';
    return vi.urgencia === 'ya'
      ? out('vender', 'inercia', null, `Ha girado a la baja${hoy} y no entra en tu once: cada día vale menos.`)
      : out('vender', 'inercia', 'antes-del-giro', 'Ha dejado de subir y no entra en tu once: véndelo antes de que gire.');
  }
  // 12. con beneficio y cayendo
  if (((M.partidazo(pid) || {}).nivel || 0) < 2 && x.ganado > 0 && P7(t) != null && P7(t) < -4 && !M.esperarVenta(x).tipo) {
    return out('vender', 'desplome', null, `Lo compraste por ${eur(x.compra)} y vale ${eur(v)}, pero lleva un ${pct(Math.abs(P7(t)), 1, false)} de bajada en 7 días: asegura el beneficio.`);
  }
  // 13. el resto
  const sube = !!ine && ['sube', 'acelera', 'rebote'].includes(ine.fase) && num(ine.ult) > 0;
  return out('aguantar', 'resto', null, sube ? 'Está subiendo y no hay motivo para venderlo.' : 'Ni sube ni baja de verdad: véndelo solo si te pagan bien.');
}

/** con la oferta que tiene (si está en venta): UNA cuenta para aceptarla o no */
function conOferta(D, M, x, b, ahora) {
  const pid = x.pid, v = (M.misVentas || []).find((y) => y.pid === pid);
  if (!v) return { ...b, paso: b.accion === 'vender' ? (b.matiz === 'con-recambio' ? 'fichar' : b.matiz === 'otro-dia' ? 'nada' : 'poner') : 'nada' };
  const mejor = v.mejor || null;
  if (!mejor) {
    if (b.accion === 'vender') return { ...b, matiz: b.matiz === 'con-recambio' ? b.matiz : 'espera-oferta', paso: 'esperar', enVenta: true, porque: b.matiz === 'con-recambio' ? b.porque : `${b.porque} Ya está a la venta: la oferta de LaLiga llega con el cambio de mercado.` };
    return { ...b, paso: 'nada', enVenta: true };
  }
  const j = x.j, val = j.valor || 0, prima = mejor.importe - val;
  const quien = mejor.deLiga ? 'LaLiga' : (mejor.de || 'un rival');
  const ofertaTxt = `${eur(mejor.importe)} (${pct(mejor.sobre * 100)})`;
  const cifras = { oferta: mejor.importe, sobre: mejor.sobre, de: quien };
  let consejo = v.consejoMotor || v.consejo, porque = v.porqueMotor || v.porque || '';
  // (una sola cuenta para el que sube: antes, tres) lo que sube hasta la víspera, menos 500 mil o el 1 %
  if (b.regla === 'sube' && consejo === 'aceptar' && prima < b.gana - Math.max(5e5, val * 0.01)) {
    consejo = 'esperar';
    porque = `${b.porque} Te pagan ${eur(prima, { signo: true })} sobre su valor: menos de lo que sube.`;
  }
  const esperar = (matiz, txt) => ({ ...b, matiz, paso: b.accion === 'vender' ? 'esperar' : 'nada', enVenta: true, oferta: 'esperar', porque: txt, cifras });
  const aceptar = (txt, regla = b.regla) => ({ ...b, accion: 'vender', regla, matiz: 'acepta', paso: 'aceptar', enVenta: true, oferta: 'aceptar', porque: txt, cifras });
  if (b.regla === 'dicho') return esperar('dicho', `${b.porque} No aceptes la oferta; si has cambiado de idea, quítalo en «Lo que me has dicho».`);
  if (b.accion === 'vender') {
    // lo de revender, cuando toca, se acepta: no hay otra oferta antes de la jornada
    if (b.regla === 'reventa' && b.matiz !== 'otro-dia') return aceptar(`${b.porque} Acepta la de ${quien}: ${ofertaTxt}.`);
    if (b.matiz === 'otro-dia') return esperar('otro-dia', b.porque);
    // el cambio: la oferta, solo con el recambio ya en tu plantilla
    if (b.matiz === 'con-recambio') return { ...b, paso: 'fichar', enVenta: true, oferta: 'esperar', porque: `${b.porque} La oferta, acéptala solo cuando tengas al nuevo.`, cifras };
    if (consejo === 'aceptar') return aceptar(porque || `Acepta la oferta de ${quien}: ${ofertaTxt}.`);
    // A LA VENTA, PERO ESTA OFERTA NO (Turrientes): lo que antes era «mejor aguantar» en un sitio y «vender» en otro
    const L = v.liga, esperado = mejor.deLiga ? ((L && L.esperado) || ((M.ofertaLigaDe && M.ofertaLigaDe(j)) || {}).v || null) : null;
    const luego = mejor.deLiga
      ? `LaLiga te hará otra en el siguiente cambio de mercado${esperado ? `, de unos ${eur(esperado)}` : ''}`
      : 'espera a la de LaLiga o a una mejor';
    return { ...esperar('esta-oferta-no', `${b.porque} Pero esta oferta no (${ofertaTxt}): ${luego}.`), cifras: { ...cifras, esperado } };
  }
  // aguantar, con una oferta: se acepta solo si la app la da por buena
  if (consejo === 'aceptar') return aceptar(porque || `Te pagan un ${Math.round(mejor.sobre * 100)} % más de lo que vale.`, 'oferta');
  return esperar(b.matiz === 'reventa' || b.matiz === 'vuelve' || b.matiz === 'sube' || b.matiz === 'busca-sustituto' ? b.matiz : 'oferta-no', b.matiz === 'busca-sustituto' || b.matiz === 'reventa' ? `${b.porque} No aceptes la oferta.` : (porque || `${b.porque} No aceptes la oferta.`));
}

const CORTO = {
  acepta: 'Vender: acepta la oferta', 'esta-oferta-no': 'A la venta, pero esta oferta no', 'espera-oferta': 'A la venta: espera la oferta',
  'con-recambio': 'Vender cuando fiches recambio', 'antes-del-giro': 'Vender antes de que gire', 'otro-dia': 'Vender, pero hoy no', 'por-dinero': 'Vender: hace falta el dinero',
};
/** la decisión en dos o cinco palabras (pastillas, titulares y avisos) */
export function decisionCorta(d) {
  if (!d) return '';
  if (d.accion === 'vender') return CORTO[d.matiz] || 'Vender';
  return d.matiz === 'dicho' ? 'No se vende: lo has dicho tú' : d.matiz === 'busca-sustituto' ? 'Aguantar: búscale sustituto' : d.matiz === 'oferta-no' ? 'Aguantar: esta oferta no' : 'Aguantar';
}
/** para el titular de Hoy: «Turrientes: a la venta, pero esta oferta no» */
export const decisionTitular = (d) => (d ? `${d.j.nombre}: ${decisionCorta(d).charAt(0).toLowerCase()}${decisionCorta(d).slice(1)}` : '');
/** en la misma clase de consejo: 'V' (vender) o 'A' (aguantar), y el paso de hoy; para comparar sitios en las pruebas */
export const claseDe = (d) => (d ? `${d.accion === 'vender' ? 'V' : 'A'}:${d.paso}` : '');

/** lo que enseñan Equipo, la ficha y los avisos de vender o no a uno tuyo: { d, n ('mal' | 'duda'), pill, largo, icono } o
 * null si no hay nada que decir. Sale de su decisión; con la inercia cerrada (función top) no se cuenta lo que sale de ella */
export function ventaVista(M, x, { sinInercia = false } = {}) {
  const d = M && M.decision && x ? M.decision(x.pid) : null;
  if (!d) return null;
  if (sinInercia && ['inercia', 'titular-gira'].includes(d.regla)) return null;
  const vi = x.ventaInercia || null, ya = !vi || vi.urgencia === 'ya';
  const r = (n, pill, largo, icono = 'baja') => ({ d, n, pill, largo, icono });
  if (d.accion === 'vender') {
    switch (d.matiz) {
      case 'acepta': return r('mal', 'Acepta la oferta', 'Acepta la oferta que tiene', 'hucha');
      case 'esta-oferta-no': return r('duda', 'En venta · esta oferta no', 'A la venta, pero esta oferta no', 'reloj');
      case 'espera-oferta': return r('duda', 'En venta · espera oferta', 'A la venta: espera la oferta', 'reloj');
      case 'con-recambio': return r('mal', 'Vender · busca recambio', 'Baja: véndelo cuando fiches a su recambio', 'cambio');
      case 'antes-del-giro': return r('duda', 'Frenando: vender', 'Se está frenando: véndelo antes de que gire', 'reloj');
      case 'otro-dia': return r('duda', 'Revender: aún no', 'Para revender: todavía no toca', 'reloj');
      case 'por-dinero': return r('mal', 'Vender: hace falta dinero', 'El plan lo vende: hace falta el dinero', 'hucha');
      default: break;
    }
    if (d.regla === 'inercia') return r('mal', 'Ha girado: vender', 'Ha girado: toca venderlo');
    if (d.regla === 'titular-baja') return r('mal', 'Baja a diario: vender', 'Baja todos los días: a la venta');
    if (d.regla === 'reventa') return r('mal', 'Toca revender', 'Lo compraste para revender: toca venderlo', 'hucha');
    if (d.regla === 'desplome') return r('mal', 'Vender con beneficio', 'Baja con beneficio: véndelo', 'hucha');
    if (d.regla === 'baja' || d.regla === 'entrenador') return null;   // ya lo dice su estado
    return r('mal', 'Vender', 'Toca venderlo');
  }
  if (d.regla === 'titular-gira') return r('duda', ya ? 'Ha girado · titular' : 'Frenando · titular', ya ? 'Ha girado, pero es titular: se aguanta' : 'Se frena, pero es titular: se aguanta', ya ? 'baja' : 'reloj');
  if (d.matiz === 'busca-sustituto') return r('duda', 'Baja · búscale sustituto', 'Baja todos los días: búscale sustituto');
  if (d.enVenta && d.oferta === 'esperar') return r('duda', 'Oferta: no aceptar', 'Tiene una oferta: no la aceptes', 'reloj');
  return null;
}

// el plan de la app (plan.js lo registra al cargarse: así decide.js no importa plan.js, que importa medio motor)
let planDeHoyFn = null;
export const conPlan = (f) => { planDeHoyFn = f; };

export function decidir(D, M, c = null) {
  const ahora = Date.now();
  const bases = new Map();
  const yo = D.yo && D.yo.teamId;
  for (const x of M.mias || []) {
    if (!x || !x.j) continue;
    let d = null;
    try { d = conOferta(D, M, x, base(D, M, x, ahora), ahora); } catch (e) { d = null; }
    if (!d) continue;
    d.t = ahora;
    d.cifras = { valor: x.j.valor, hoy: (M.inercia(x.pid) || {}).ult ?? null, ...(d.cifras || {}) };
    d.corta = decisionCorta(d);
    bases.set(x.pid, d);
  }
  // el consejo de la oferta que se ve en «en venta», los avisos y el chat es el de la decisión (el del motor queda en
  // `consejoMotor`): antes el plan podía aceptar una que Equipo decía esperar, y al revés
  for (const v of M.misVentas || []) {
    const d = bases.get(v.pid);
    if (!d || !v.mejor) continue;
    const motor = { consejo: v.consejo, porque: v.porque, porqueCorto: v.porqueCorto };
    v.consejoMotor = motor.consejo; v.porqueMotor = motor.porque;
    // (se leen al vuelo: con el plan delante, la decisión puede pasar a «hace falta el dinero» o a «hoy no»)
    const dd = () => (M.decision ? M.decision(v.pid) : null) || d;
    Object.defineProperty(v, 'consejo', { enumerable: true, configurable: true, get: () => (dd().oferta === 'aceptar' ? 'aceptar' : 'esperar') });
    Object.defineProperty(v, 'porque', { enumerable: true, configurable: true, get: () => dd().porque });
    Object.defineProperty(v, 'porqueCorto', { enumerable: true, configurable: true, get: () => (dd().oferta !== 'aceptar' && v.protege && motor.porqueCorto ? motor.porqueCorto : dd().porque) });
    Object.defineProperty(v, 'decision', { enumerable: false, configurable: true, get: dd });
  }
  M.decisionBase = (pid) => bases.get(pid) || bases.get(String(pid)) || null;
  // el plan que está viendo (el de la IA de hoy o el de la app): lo pone app.js; si no, el del motor ya calculado
  let visto = null;
  M.verPlan = (P) => { visto = P || null; };
  // el plan de la app para hoy (se calcula una vez por análisis; mientras se calcula, no se mira: usa `decisionBase`)
  let calculando = false;
  const planApp = () => {
    if (M._planHoy && M._planHoy.plan) return M._planHoy.plan;
    if (calculando || !planDeHoyFn || !c) return null;
    calculando = true;
    try { return planDeHoyFn(D, M, c); } catch (e) { return null; } finally { calculando = false; }
  };
  const planDe = () => visto || planApp();
  const vivas = (P) => ((P && P.ops) || []).filter((o) => o && !o.descartada && !o.sugerencia && !o.ya && o.pid);
  const cache = new Map();
  /* la que se enseña: la base y lo que añade el plan.
     - el dinero manda: el plan vende a este porque sin él no se empieza la jornada en positivo → vender: hace falta el dinero
     - los puntos pesan: el plan ha mirado esa venta y hoy no la hace (con el resto del plan, lo que da en tu once pesa más
       que lo que puede bajar) → aguantar, con el motivo de «Mirados y descartados» */
  M.decision = (pid) => {
    const d = M.decisionBase(pid);
    if (!d) return null;
    const P = planDe();
    if (!P || calculando) return d;
    const k = `${pid}|${visto ? 'v' : 'a'}`;
    if (cache.has(k) && cache.get(k).P === P) return cache.get(k).d;
    let r = d;
    const o = vivas(P).find((y) => String(y.pid) === String(pid) && y.accion === 'vender');
    if (d.paso !== 'aceptar' && d.paso !== 'poner') {
      if (o && d.regla !== 'dicho' && (o.porDinero || o.hace_falta || /caja/.test(String(o.objetivo || '')))) {
        const acepta = o.etiqueta === 'Aceptar oferta';
        r = { ...d, accion: 'vender', regla: 'dinero', matiz: 'por-dinero', paso: o.hoy === false ? 'nada' : acepta ? 'aceptar' : 'poner', antes: d, cuando: o.hoy === false ? (o.cuando || null) : null,
          porque: `Hace falta para empezar la jornada en positivo (en negativo no puntúas)${d.accion === 'aguantar' ? `. Si no, se aguantaría: ${d.porque.charAt(0).toLowerCase()}${d.porque.slice(1)}` : '.'}`, corta: CORTO['por-dinero'] };
      }
    } else if (!o) {
      const Pa = planApp();
      const dm = ((Pa && Pa.descartes) || []).find((y) => y && String(y.pid) === String(pid));
      const mo = dm ? (dm.motivo || dm.detalle) : Pa && M._noVendeHoy ? M._noVendeHoy.get(String(pid)) : null;
      if (mo && d.regla !== 'entrenador') {
        const tit = M.perdida(pid) >= 0.3;
        r = { ...d, accion: 'aguantar', regla: 'plan', matiz: d.enVenta && d.oferta ? 'oferta-no' : tit ? 'titular' : null, paso: 'nada', oferta: d.oferta ? 'esperar' : undefined, antes: d, porque: String(mo) };
      }
    }
    if (r !== d) r.corta = decisionCorta(r);
    cache.set(k, { P, d: r });
    return r;
  };
  /* FICHAR: lo que dice el plan que se ve de uno que no es tuyo. { accion: 'fichar', como, para, importe, porque } si hay un
     paso vivo; { accion: 'no', porque } si el plan lo ha mirado y descartado; null si no dice nada de él */
  M.decisionFichar = (pid) => {
    if (!pid || (M.dueno && M.dueno[pid] === yo)) return null;
    const P = planDe();
    if (!P) return null;
    const o = vivas(P).find((y) => String(y.pid) === String(pid) && ['pujar', 'comprar', 'clausular', 'ofertar'].includes(y.accion));
    if (o) return { pid, accion: 'fichar', como: o.accion, para: String(o.objetivo || 'titular'), importe: o.puja_max || o.importe || null, porque: (o.datos && o.datos.porque) || '' };
    const quita = (t) => String(t || '').replace(/^La app lo descarta[.:]?\s*/, '');
    const dm = (P.descartes || []).find((y) => y && String(y.pid) === String(pid));
    if (dm) return { pid, accion: 'no', porque: quita(dm.motivo || dm.detalle) };
    const dx = ((P && P.ops) || []).find((y) => y && y.descartada && String(y.pid) === String(pid) && ['pujar', 'comprar', 'clausular', 'ofertar'].includes(y.accion));
    if (dx) return { pid, accion: 'no', porque: quita(dx.aviso), tope: dx.tope != null ? dx.tope : null };
    // el plan de la IA no trae los «Mirados» del motor: se miran en el de la app si ya está hecho
    const Pm = M._planHoy && M._planHoy.plan;
    const d2 = Pm && Pm !== P ? (Pm.descartes || []).find((y) => y && String(y.pid) === String(pid)) : null;
    return d2 ? { pid, accion: 'no', porque: quita(d2.motivo || d2.detalle) } : null;
  };
  return M;
}
