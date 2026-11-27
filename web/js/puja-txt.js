/* (27 nov) Lo que se dice de una puja por un libre, en todas partes igual y corto (Carlos: «la tarjeta en 2 líneas cortas
   como mucho, sin desplegable: la puja, la probabilidad, cuánto pago de más y en cuánto lo recupero, o que no compensa»).
   Sin nada de la app dentro: todo sale del libre de `M.mercado` (`puja`, `pGana`, `tener`, `noCompensa`, `j`), que monta
   el motor. La puja es la que gana unas 7-8 de cada 10 veces (motor.js, `M.pujaPara`). */
import { eur, num } from './util.js';

/** «8 de cada 10», «casi seguro» o '' sin datos */
export const vecesCorto = (p) => {
  if (p == null) return '';
  const n = Math.round(p * 10);
  return n >= 10 ? 'casi seguro' : `${Math.max(1, n)} de cada 10`;
};

/** lo pagado de más sobre su valor y en cuánto se recupera: «+740 mil, recuperas en 4 días», «a su valor» */
export function deMasTxt(m) {
  const deMas = num(m && m.puja) - num(m && m.j && m.j.valor);
  if (!(deMas >= 1e5)) return 'a su valor';
  const te = m.tener;
  const rec = te && te.dias ? `, recuperas en ${te.dias} día${te.dias === 1 ? '' : 's'}` : te && te.r != null ? ', no se recupera' : '';
  return `+${eur(deMas)}${rec}`;
}

/** la segunda línea de una puja que se recomienda: «Ganas 8 de cada 10 · +740 mil, recuperas en 4 días» */
export function pujaLinea(m, { corto = false } = {}) {
  if (!m) return '';
  const v = vecesCorto(m.pGana);
  return [v ? (corto ? v : `Ganas ${v}`) : 'Sin compras parecidas', deMasTxt(m)].join(' · ');
}

/** la de una que no compensa: «Para llevártelo casi seguro hay que ir a 21,40 M: no compensa» */
export function noCompensaTxt(m, { porque = false } = {}) {
  if (!m) return '';
  const por = porque && m.noCompensa && m.noCompensa.motivo === 'calendario' ? ' con su calendario' : '';
  return `Para llevártelo casi seguro hay que ir a ${eur(m.puja)}: no compensa${por}`;
}

/** la puja `puja` por el libre `pid` con las cuentas de ahora (la del paso del plan puede ser otra que la de Mercado: la de
    revender o la de aguantar): { j, puja, pGana, tener, noCompensa } o null */
export function pujaDe(M, pid, puja) {
  if (!M || !pid || !(puja > 0)) return null;
  const m = (M.mercado || []).find((y) => String(y.pid) === String(pid) && y.tipo === 'liga');
  const j = (m && m.j) || (M.J ? M.J(pid) : null);
  if (!j || !j.valor) return null;
  if (m && Math.abs(num(m.puja) - puja) < 1e4) return { j, puja, pGana: m.pGana, tener: m.tener, noCompensa: m.noCompensa };
  const PV = M.pagaLiga ? M.pagaLiga(j.valor, pid) : null;
  const pGana = PV && M.ganaReal ? M.ganaReal(PV.f(puja / j.valor - 1), M.perfilPuja ? M.perfilPuja(pid).top : false) : null;
  return { j, puja, pGana, tener: M.tener ? M.tener(j, m && m.tend, puja) : null, noCompensa: null };
}

/** la segunda línea de un paso de pujar del plan (la tarjeta de Hoy y la ficha del jugador dicen lo mismo): para el once y
    para aguantarlo, con cuánto ganas y lo pagado de más; para revender, cuándo venderlo y lo que ganarías; un entrenador, a
    su valor */
export function lineaPaso(M, o, { corto = false } = {}) {
  const x = pujaDe(M, o.pid, num(o.puja_max || o.importe));
  if (!x) return o.datos && o.datos.porque ? o.datos.porque : '';
  const v0 = vecesCorto(x.pGana), v = v0 && !corto ? `Ganas ${v0}` : v0;
  if (o.objetivo === 'entrenador') return `${v ? `${v} · ` : ''}a su valor, sin pagar de más`;
  if (String(o.objetivo || '').startsWith('revend') && !o.aguantar) return `${v ? `${v} · ` : ''}vende ${o.vender_el ? `${/^(hoy|mañana|pasado|esta|este)/i.test(o.vender_el) ? '' : 'el '}${o.vender_el}` : 'antes de la jornada'}${o.beneficio_esperado ? `: ${eur(o.beneficio_esperado, { signo: true })}` : ''}`;
  return pujaLinea(x, { corto });
}
