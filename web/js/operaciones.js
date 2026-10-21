/* Las operaciones que de verdad se pueden hacer hoy, cada una con su referencia (P-, M-, T-, C-, A-, V-, B- y el id
   del jugador). La IA solo puede recomendar operaciones de esta lista, y el plan se comprueba contra ella: así no
   salen cosas imposibles como comprarle a un rival un jugador que no vende o pujar por uno que ya tiene dueño.
   P  pujar por un jugador LIBRE de la liga (subasta a ciegas al cambiar el mercado)
   M  comprar a otro manager un jugador que TIENE A LA VENTA (decide él si acepta)
   T  un trato con otro manager que le has contado a la IA
   C  clausular a un rival (cláusula abierta ya o que se abre antes de la jornada)
   A  aceptar la mejor oferta por un jugador tuyo que ya tienes en venta
   V  poner a la venta (o vender) un jugador tuyo
   B  blindar (subir la cláusula de) un jugador tuyo con la cláusula abierta o a punto */
import { eur, pct, cuando, POS, DIA, HORA } from './util.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
const nombreDe = (M, tid) => { const e = tid && M.equipo[tid]; return (e && (e.manager || e.nombre)) || 'un rival'; };

/** el catálogo de hoy: { lista, ref: { 'C-123': op } } */
export function catalogo(D, M, notas = []) {
  const lista = [];
  const add = (op) => { if (op.j) lista.push(op); };
  const yo = D.yo && D.yo.teamId;
  const ahora = Date.now();
  const limiteC = M.proxima ? M.proxima.ini : ahora + 3 * DIA;

  // A y V: lo tuyo
  for (const v of M.misVentas || []) {
    if (v.mejor) add({ ref: `A-${v.pid}`, tipo: 'aceptar', pid: v.pid, j: v.j, precio: v.mejor.importe, de: v.mejor.de, caduca: v.mejor.caduca, sobre: v.mejor.sobre, consejo: v.consejo });
  }
  for (const x of M.mias) {
    if (!x.j || (M.enVenta && M.enVenta.has(x.pid))) continue;
    add({ ref: `V-${x.pid}`, tipo: 'vender', pid: x.pid, j: x.j, precio: x.j.valor, compra: x.compra || null, ganado: x.ganado });
    if (x.clausula && (x.abierta || x.abreEn < 2 * DIA)) add({ ref: `B-${x.pid}`, tipo: 'blindar', pid: x.pid, j: x.j, clausula: x.clausula, abierta: x.abierta, abre: x.protegidoHasta, riesgo: x.riesgo, pagan: x.pagan, blindaje: x.blindaje });
  }
  // P: libres de la liga
  for (const m of M.mercado) {
    if (m.tipo === 'liga') add({ ref: `P-${m.pid}`, tipo: 'pujar', pid: m.pid, j: m.j, precio: m.precio, puja: m.puja, pujaLiga: m.pujaLiga, recortada: m.recortada, pujas: m.pujas, miPuja: m.miPuja, cierra: m.cierra, interes: m.interes, sobre: m.sobre });
  }
  // M: lo que venden otros managers
  for (const m of M.mercado) {
    if (m.tipo !== 'manager' || m.vendedorTeamId === yo || (M.enVenta && M.enVenta.has(m.pid))) continue;
    add({ ref: `M-${m.pid}`, tipo: 'comprar', pid: m.pid, j: m.j, precio: m.precio, vendedor: m.vendedor || nombreDe(M, m.vendedorTeamId), vendedorTeamId: m.vendedorTeamId, miPuja: m.miPuja, interes: m.interes, sobre: m.sobre });
  }
  // T: tratos que le has contado (jugador de otro manager con precio)
  for (const n of notas) {
    const tid = n.pid && M.dueno[n.pid];
    if (!tid || tid === yo || !n.importe || lista.some((o) => o.ref === `M-${n.pid}`) || (M.J(n.pid) || {}).pos === 5) continue;
    add({ ref: `T-${n.pid}`, tipo: 'comprar', trato: true, pid: n.pid, j: M.J(n.pid), precio: n.importe, vendedor: nombreDe(M, tid), vendedorTeamId: tid, nota: n.texto });
  }
  // C: cláusulas abiertas o que se abren antes de la jornada
  for (const x of M.clausulas) {
    if (!x.abierta && x.protegidoHasta > limiteC) continue;
    add({ ref: `C-${x.pid}`, tipo: 'clausular', pid: x.pid, j: x.j, precio: x.clausula, abierta: x.abierta, abre: x.protegidoHasta, de: x.rival.manager || x.rival.nombre, teamId: x.teamId, meLlega: x.meLlega, interes: x.interes, ratio: x.ratio });
  }
  const ref = Object.fromEntries(lista.map((o) => [o.ref, o]));
  return { lista, ref };
}

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
  return `NO DISPONIBLE: es de ${nombreDe(M, tid)}${fa ? `, que lo ${fa.clase === 'clausula' ? 'clausuló' : 'fichó'} ${cuando(fa.t)}` : ''}, no lo vende${x && x.clausula ? ` y su cláusula (${eur(x.clausula)}) no se abre hasta ${cuando(x.protegidoHasta)}` : ''}`;
}

/** una operación del catálogo en texto, con lo que cuesta y cómo funciona */
export function textoOp(o, M = null) {
  const j = o.j;
  const sobre = j && j.valor && o.precio ? o.precio / j.valor - 1 : 0;
  const sc = M && M.sobrecoste && j ? M.sobrecoste(j, o.precio) : null;
  const sobreTxt = j && j.valor && o.precio
    ? ` (${pct(sobre * 100)} sobre su valor de ${eur(j.valor)}${sobre > 0.02 ? `: ${eur(o.precio - j.valor)} de más${sc ? `; ÍNDICE DE SOBRECOSTE ${sc.indice}/100 (aguantable para este jugador hasta ~${M.tolerancia(j)})${sc.recTxt ? `, ${sc.recTxt}` : ''}` : ''}` : ''})`
    : '';
  switch (o.ref[0]) {
    case 'P': {
      const PL = M && M.pujasLiga;
      const liga = PL && !PL.poco ? `; en esta liga los libres se llevan de mediana con un ${pct(PL.med * 100)} sobre su valor (la mitad entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}, ${PL.n} compras)` : '';
      return `PUJAR por ${j.nombre}, LIBRE en el mercado de la liga: subasta a ciegas, puja mínima ${eur(o.precio)}${o.pujas ? `, lleva ${o.pujas} pujas` : ''}${o.cierra ? `, se resuelve ${cuando(o.cierra)}` : ''}${o.miPuja ? `; MI PUJA ACTUAL ${eur(o.miPuja)}` : ''}; la app pujaría ${eur(o.puja)} (${pct((o.puja / o.precio - 1) * 100)})${o.recortada ? ', recortada para no pagar de más por lo que aporta' : ''}${liga}`;
    }
    case 'M': {
      const ol = M && M.ofertaLigaDe ? M.ofertaLigaDe(j) : null;
      return `COMPRAR a ${o.vendedor} ${j.nombre}, que LO TIENE A LA VENTA y pide ${eur(o.precio)}${sobreTxt}; es suyo hasta que ACEPTE una oferta, no es seguro${ol ? `; si nadie se lo compra, LaLiga le daría unos ${eur(ol.v)}, así que por menos de eso no tiene por qué aceptar` : ''}${o.miPuja ? `; MI OFERTA ACTUAL ${eur(o.miPuja)}` : ''}`;
    }
    case 'T': return `COMPRAR a ${o.vendedor} ${j.nombre} por ${eur(o.precio)}${sobreTxt} por el TRATO que me contaste («${o.nota}»)`;
    case 'C': return `CLAUSULAR a ${o.de} ${j.nombre} pagando su cláusula de ${eur(o.precio)}${sobreTxt}; ${o.abierta ? 'ABIERTA YA' : `se abre ${cuando(o.abre)}`}${o.meLlega ? '' : '; NO ME LLEGA el dinero'}`;
    case 'A': return `ACEPTAR la oferta de ${o.de} por ${j.nombre}: ${eur(o.precio)} (${pct((o.sobre || 0) * 100)} sobre su valor)${o.caduca ? `, caduca ${cuando(o.caduca)}` : ''}`;
    case 'V': return `VENDER ${j.nombre} (vale ${eur(j.valor)}${o.compra ? `, lo pagué a ${eur(o.compra)}` : ''})`;
    case 'B': {
      const p = o.pagan, b = o.blindaje;
      const quien = p && (p.seguro.length || p.quiza.length || p.hayDatos) ? `; le llega a ${p.seguro.length ? p.seguro.map((x) => x.nombre).join(', ') : 'nadie seguro'}${p.quiza.length ? ` (quizá a ${p.quiza.map((x) => x.nombre).join(', ')})` : ''}${p.sinSaber.length ? ` (de ${p.sinSaber.length} no se sabe el dinero)` : ''}` : '';
      const justo = b ? (b.yaVale ? '; con lo que tienen los rivales ahora no le llega a nadie' : b.caro ? `; dejarla fuera del alcance de todos costaría ${eur(b.coste)}: no compensa${b.parcial ? `; subirla a ${eur(b.parcial.objetivo)} (${eur(b.parcial.coste)}) deja fuera a todos menos a ${b.parcial.quedan.join(', ')}` : ''}` : `; blindaje justo: subirla a ${eur(b.objetivo)} cuesta ${eur(b.coste)} y no le llegaría a nadie`) : '';
      return `BLINDAR ${j.nombre}: su cláusula (${eur(o.clausula)}) ${o.abierta ? 'está ABIERTA' : `se abre ${cuando(o.abre)}`}, riesgo ${o.riesgo || '?'}${quien}${justo}`;
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
    return x ? `Su cláusula no se abre hasta ${cuando(x.protegidoHasta)}, después de la próxima jornada` : 'No tiene cláusula';
  }
  if (tid) {
    const fa = M.fichadoPor && M.fichadoPor(pid);
    return `No lo tiene a la venta y su dueño (${nombreDe(M, tid)}) no tiene por qué vendértelo${fa ? `: lo ${fa.clase === 'clausula' ? 'clausuló' : 'fichó'} ${cuando(fa.t)}` : ''}. Solo se le puede quitar con la cláusula`;
  }
  return 'No está hoy en el mercado';
}

/** el catálogo para la IA, por grupos (lo más interesante primero) */
export function catalogoTxt(D, M, cat, { corto = false, datos = null } = {}) {
  const L = [];
  const g = (titulo, ops, n) => {
    if (!ops.length) return;
    L.push(`\n${titulo}`);
    for (const o of ops.slice(0, n)) {
      L.push(`- [${o.ref}] ${textoOp(o, M)}`);
      const d = datos && datos(o);
      if (d) L.push(`    ${d}`);
    }
    if (ops.length > n) L.push(`  (y ${ops.length - n} más con menos interés)`);
  };
  const por = (a, b) => (b.interes || 0) - (a.interes || 0);
  const t = (x) => cat.lista.filter((o) => o.ref[0] === x);
  L.push('OPERACIONES POSIBLES HOY (las ÚNICAS que puedes recomendar; cada operación del plan lleva su "ref"):');
  g('ACEPTAR OFERTAS (lo que ya tengo en venta):', t('A'), 20);
  g('PUJAR (jugadores LIBRES de la liga, subasta a ciegas):', t('P').sort(por), corto ? 12 : 22);
  g('COMPRAR A OTRO MANAGER (solo lo que TIENE A LA VENTA o un TRATO que te conté; decide él):', [...t('T'), ...t('M').sort(por)], corto ? 8 : 14);
  g('CLAUSULAR (cláusulas de rivales abiertas o que se abren antes de la jornada):', t('C').sort(por), corto ? 14 : 26);
  g('BLINDAR (mis cláusulas abiertas o a punto):', t('B'), 12);
  L.push(`VENDER: cualquiera de mis jugadores con [V-<id>] (ids: ${t('V').map((o) => `${o.j.nombre} V-${o.pid}`).join(', ')}).`);
  L.push('Cualquier jugador de un rival que no esté arriba NO SE PUEDE CONSEGUIR HOY: ni comprándoselo ni de otra forma.');
  return L.join('\n');
}

export const esMalo = (j) => j && MALOS.has(j.estado);
export { POS, HORA };
