/* La IA trabajando con la app cerrada. Android abre la web sin pantalla (index.html?fondo=1) cada 3 horas y unos
   minutos después de cada cambio de mercado; aquí se decide qué contar con una notificación: el plan nuevo, las
   ofertas que llegan por tus jugadores, los que te quitan o fichas y la sesión caducada. Cada aviso, una vez. */
import { LS, eur, pct, diaDe, cuando } from './util.js';
import { bloqueada } from './limite.js';
import { cfgAvisos } from './avisos.js';
import { esFav } from './favoritos.js';

export const EN_FONDO = /[?&]fondo=1\b/.test(location.search);
export const cfgFondo = () => ({ on: true, ...LS.get('cfg-fondo', {}) });
export const guardarCfgFondo = (c) => LS.set('cfg-fondo', { ...cfgFondo(), ...c });
/** lo que pasó la última vez en segundo plano (para Ajustes y el diagnóstico) */
export const ultimoFondo = () => LS.get('fondo-ultimo', null);

/** de noche no se hace nada (de 1:00 a 7:59) y no se avisa (de 23:30 a 7:59) */
export const deNoche = (d = new Date()) => d.getHours() >= 1 && d.getHours() < 8;
export const callado = (d = new Date()) => d.getHours() < 8 || (d.getHours() === 23 && d.getMinutes() >= 30);

const ACC = { aceptar: 'Aceptar oferta', vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Blindar', alinear: 'Alinear', esperar: 'Esperar' };

/** el plan en una notificación: el titular y los pasos de hoy, numerados */
export function avisoPlan(P, conIA) {
  const ops = (P.ops || []).filter((o) => o.hoy !== false && !o.descartada && o.accion !== 'esperar').slice(0, 5);
  const pasos = ops.map((o, i) => `${i + 1}. ${o.etiqueta || ACC[o.accion] || o.accion}${o.jugador ? ` ${o.jugador}` : ''}${o.importe ? ` (${eur(o.importe)})` : ''}`);
  return {
    k: `plan:${P.t || diaDe()}`,
    titulo: conIA ? `Tu plan: ${P.titular || 'listo'}` : `Plan de hoy (sin IA): ${P.titular || ''}`.trim(),
    texto: pasos.length ? pasos.join('\n') : 'Hoy no hace falta tocar nada.',
    hash: 'hoy',
  };
}

/** lo que ha cambiado desde la última vez que se miró tu liga */
export function avisosNuevos(antes, D, M) {
  const out = [];
  const yo = D.yo && D.yo.teamId;
  const misAntes = new Set(((antes && antes.plantillas && antes.plantillas[yo]) || []).map((f) => f.pid));
  const misAhora = new Set(((D.plantillas && D.plantillas[yo]) || []).map((f) => f.pid));
  const misma = antes && antes.liga && D.liga && antes.liga.id === D.liga.id && !antes.demo && misAntes.size;
  if (misma) {
    for (const pid of misAntes) {
      if (misAhora.has(pid)) continue;
      const j = M.J(pid) || { nombre: 'un jugador' };
      const a = (M.actividad || []).find((x) => x.pid === pid && x.t >= (antes.t || 0) - 3600e3);
      if (a && a.clase === 'clausula' && !a.esYo) out.push({ k: `perdido:${pid}:${a.id}`, titulo: `Te han clausulado a ${j.nombre}`, texto: `${a.quien || 'Un rival'} ha pagado ${eur(a.importe)}. Mira el plan para reponerlo.`, hash: 'equipo' });
      else out.push({ k: `sale:${pid}:${diaDe()}`, titulo: `${j.nombre} ya no está en tu equipo`, texto: a && a.importe ? `Vendido por ${eur(a.importe)}.` : 'Se ha vendido.', hash: 'equipo' });
    }
    // (41) las pujas que había antes: si es tuyo, la ganaste; si se lo ha llevado otro, la perdiste
    const ca = cfgAvisos(), pujas = ca.on && ca.pujas !== false;
    const pujaDe = new Map(((antes.mercado || []).filter((m) => m.miPuja && m.tipo !== 'manager')).map((m) => [m.pid, m]));
    for (const pid of misAhora) {
      if (misAntes.has(pid)) continue;
      const j = M.J(pid) || { nombre: 'un jugador', valor: 0 };
      const pj = pujaDe.get(pid);
      if (pj && pujas) out.push({ k: `puja-gana:${pid}:${pj.id || diaDe()}`, titulo: `Puja ganada: ${j.nombre} es tuyo`, texto: `Pagas ${eur(pj.miPuja)} (vale ${eur(j.valor)}). Ya cuenta para tu once.`, hash: 'equipo' });
      else out.push({ k: `entra:${pid}:${diaDe()}`, titulo: `Has fichado a ${j.nombre}`, texto: `Vale ${eur(j.valor)}. Ya cuenta para tu once.`, hash: 'equipo' });
    }
    if (pujas) out.push(...pujasPerdidas(antes, D, M, pujaDe, misAhora));
  }
  // (41) los que te interesan y acaban de salir al mercado (uno por día y jugador; si son muchos, en un aviso)
  if (antes && antes.liga && D.liga && antes.liga.id === D.liga.id && !antes.demo && (antes.mercado || []).length) out.push(...interesEnMercado(antes, D, M));
  // lo que hay que poner en el mercado (y que aún no está puesto)
  const enVenta = M.enVenta || new Set();
  // y en cuanto está puesto: cuándo llega la oferta de LaLiga
  if (misma) {
    const antesEnVenta = new Set((antes.misVentas || []).map((v) => v.pid));
    for (const v of (M.misVentas || []).filter((y) => !antesEnVenta.has(y.pid) && !(y.ofertas || []).length)) {
      out.push({ k: `puesto:${v.pid}:${diaDe()}`, titulo: `${v.j.nombre} ya está en el mercado`, texto: `Puesto a ${eur(v.precio)} (vale ${eur(v.j.valor)}). La oferta de LaLiga llega con el cambio de mercado${M.cierreMercado ? ` (${cuando(M.cierreMercado)})` : ''}: la app te avisa en cuanto llegue y si te conviene aceptarla.`, hash: 'equipo' });
    }
  }
  // cuándo gira un jugador es una función top: si está bloqueada, el aviso no lo cuenta (en la app sale con candado)
  const inerciaTop = bloqueada('inercia');
  for (const x of (M.mias || []).filter((y) => y.ventaInercia && !enVenta.has(y.pid))) {
    const vi = x.ventaInercia;
    out.push({
      k: `vende:${x.pid}:${vi.urgencia}:${diaDe()}`,
      titulo: inerciaTop ? `Pon a ${x.j.nombre} en el mercado` : vi.urgencia === 'ya' ? `Pon a ${x.j.nombre} en el mercado: ha girado a la baja` : `Pon a ${x.j.nombre} en el mercado antes de que gire`,
      texto: inerciaTop ? 'Por cómo va su valor, conviene venderlo ya. Entra para ver el plan.' : vi.texto,
      hash: 'equipo',
    });
  }
  // (una sanción de un partido no hace vender: se pierde la jornada y se aguanta, salvo que su valor caiga fuerte)
  const vendeBaja = (x) => (M.vendeBaja ? M.vendeBaja(x) : ['injured', 'suspended', 'out_of_league'].includes(x.j.estado));
  for (const x of (M.mias || []).filter((y) => vendeBaja(y) && !enVenta.has(y.pid) && !y.ventaInercia)) {
    const por = x.j.estado === 'suspended' ? (!M.deBaja ? 'sancionado' : M.deBaja(x.j) ? 'sancionado para más de un partido' : 'sancionado y su valor cae deprisa') : x.j.estado === 'injured' ? 'lesionado' : 'fuera de LaLiga';
    out.push({ k: `lesion-venta:${x.pid}:${x.j.estado}`, titulo: `Pon a ${x.j.nombre} en el mercado`, texto: `Está ${por}: no te va a puntuar y puede bajar de valor.`, hash: 'equipo' });
  }
  if (M.ventanaEsp && Date.now() >= M.ventanaEsp.ponerVenta) {
    for (const x of (M.paraRevender || []).filter((y) => !enVenta.has(y.pid))) {
      out.push({ k: `revender:${x.pid}:${M.proxima ? M.proxima.n : diaDe()}`, titulo: `Hoy toca poner a ${x.j.nombre} a la venta`, texto: `Lo compraste para revender a ${eur(x.rev.precio)} y vale ${eur(x.j.valor)} (${eur(x.beneficioYa, { signo: true })}). Ponlo ya para que llegue la oferta antes de la jornada.`, hash: 'equipo' });
    }
  }
  if (M.negativo && M.proxima && M.proxima.ini - Date.now() < 36 * 3600e3) {
    out.push({ k: `negativo:${M.proxima.n}`, titulo: `Estás en negativo: pon a alguien en el mercado`, texto: `Tienes ${eur(D.dinero)} y la jornada ${M.proxima.n} empieza pronto: si empieza así, no puntúas. Pon a la venta a quien menos te aporte.`, hash: 'equipo' });
  }
  for (const v of M.misVentas || []) {
    for (const o of v.ofertas || []) {
      const mejor = v.mejor && v.mejor === o;
      out.push({
        k: `oferta:${v.pid}:${o.id || o.importe}`,
        titulo: mejor && v.consejo === 'aceptar' ? `Acepta la oferta por ${v.j.nombre}: ${eur(o.importe)}` : `Oferta por ${v.j.nombre}: ${eur(o.importe)}`,
        texto: `De ${o.de}${o.sobre != null ? ` · ${pct(o.sobre * 100)} sobre su valor` : ''}.${mejor && v.consejo === 'aceptar' ? ' Te conviene aceptarla.' : mejor && v.porque ? ` ${v.porque}` : ''}`,
        hash: 'equipo',
      });
    }
  }
  return out;
}

/** (41) las pujas que se ha llevado otro: solo si se sabe quién (si no, pudo ser que la quitaras tú) */
export function pujasPerdidas(antes, D, M, pujaDe, misAhora) {
  const out = [];
  const siguen = new Set((D.mercado || []).filter((m) => m.miPuja).map((m) => m.pid));
  for (const [pid, pj] of pujaDe) {
    if (misAhora.has(pid) || siguen.has(pid)) continue;
    const a = (M.actividad || []).find((x) => x.pid === pid && !x.esYo && x.clase === 'compra' && x.t >= (antes.t || 0) - 3600e3);
    if (!a) continue;
    const j = M.J(pid) || { nombre: 'un jugador' };
    out.push({ k: `puja-pierde:${pid}:${pj.id || diaDe()}`, titulo: `Puja perdida: ${j.nombre}`, texto: `Se lo ha llevado ${a.quien || 'otro'}${a.importe ? ` por ${eur(a.importe)}` : ''}; tú pujabas ${eur(pj.miPuja)}. Mira el plan para buscar otro.`, hash: 'mercado' });
  }
  return out;
}

/** (41) los que te interesan (favoritos, los de «Avisarme» y los de interés alto o chollos) que acaban de salir al mercado */
export function interesEnMercado(antes, D, M, c = cfgAvisos()) {
  if (!c.on || c.enMercado === false) return [];
  const yo = D.yo && D.yo.teamId;
  const habia = new Set((antes.mercado || []).map((m) => m.pid));
  const xs = (M.mercado || []).filter((m) => !habia.has(m.pid) && !m.miPuja && m.vendedorTeamId !== yo && m.j
    && (esFav(m.pid) || (c.jugadores || {})[m.pid] || m.veredicto === 'chollo' || (m.interes || 0) >= Math.max(c.interes || 55, 60)))
    .sort((a, b) => (esFav(b.pid) - esFav(a.pid)) || ((b.interes || 0) - (a.interes || 0)));
  if (!xs.length) return [];
  const de = (m) => (m.tipo === 'manager' ? ` (lo vende ${m.vendedor || 'un rival'})` : '');
  if (xs.length <= 2) {
    return xs.map((m) => ({
      k: `en-mercado:${m.pid}:${diaDe()}`,
      titulo: `${m.j.nombre}, en el mercado`,
      texto: `${esFav(m.pid) ? 'Lo sigues' : m.veredicto === 'chollo' ? 'Sale barato' : `Interés ${Math.round(m.interes)}`}: desde ${eur(m.precio)}${de(m)}, vale ${eur(m.j.valor)}.${m.puja && m.tipo !== 'manager' ? ` La app pujaría ${eur(m.puja)}.` : ''}`,
      hash: 'mercado',
    }));
  }
  const l = xs.slice(0, 3).map((m) => `${m.j.nombre} (${eur(m.precio)})`);
  return [{ k: `en-mercado:${xs.map((m) => m.pid).sort().join(',')}:${diaDe()}`, titulo: `${xs.length} que te interesan, en el mercado`, texto: `${l.join(', ')}${xs.length > 3 ? ` y ${xs.length - 3} más` : ''}.`, hash: 'mercado' }];
}

/** se queda con los que no se han avisado aún (y apunta los nuevos como avisados si no es de noche) */
export function sinAvisar(lista, { apuntar = true } = {}) {
  const vistos = LS.get('fondo-avisados', {});
  const ahora = Date.now();
  for (const k of Object.keys(vistos)) if (ahora - vistos[k] > 10 * 86400e3) delete vistos[k];
  const nuevos = lista.filter((a) => !vistos[a.k]);
  if (apuntar) { for (const a of nuevos) vistos[a.k] = ahora; LS.set('fondo-avisados', vistos); }
  return nuevos;
}

/** con la app abierta lo ves tú: se apunta como avisado para que luego no llegue la notificación */
export function marcarVistos(lista) { sinAvisar(lista, { apuntar: true }); }
