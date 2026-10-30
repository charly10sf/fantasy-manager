/* Las operaciones que de verdad se pueden hacer hoy, cada una con su referencia (P-, M-, T-, C-, A-, V-, B- y el id
   del jugador). La IA solo puede recomendar operaciones de esta lista, y el plan se comprueba contra ella: así no
   salen cosas imposibles como comprarle a un rival un jugador que no vende o pujar por uno que ya tiene dueño.
   P  pujar por un jugador LIBRE de la liga (subasta a ciegas al cambiar el mercado)
   M  comprar a otro manager un jugador que TIENE A LA VENTA (decide él si acepta)
   T  un trato con otro manager que le has contado a la IA
   C  clausular a un rival (cláusula abierta ya o que se puede pagar antes de la jornada o justo al empezar: LaLiga
      cierra las cláusulas las 24 h antes del primer partido y las reabre a esa hora)
   A  aceptar la mejor oferta por un jugador tuyo que ya tienes en venta
   V  poner a la venta (o vender) un jugador tuyo
   B  proteger a un jugador tuyo con la cláusula abierta o a punto: con el blindaje gratis de LaLiga (24 h, 2 por
      jornada) o subiéndole la cláusula */
import { eur, pct, cuando, POS, DIA, HORA, num } from './util.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
const nombreDe = (M, tid) => { const e = tid && M.equipo[tid]; return (e && (e.manager || e.nombre)) || 'un rival'; };

/** el catálogo de hoy: { lista, ref: { 'C-123': op } } */
export function catalogo(D, M, notas = []) {
  const lista = [];
  const add = (op) => { if (op.j) lista.push(op); };
  const yo = D.yo && D.yo.teamId;
  const ahora = Date.now();
  // hasta el primer partido de la jornada (lo que se abre en las 24 h de antes ya viene con la hora del primer partido)
  const limiteC = M.proxima ? M.proxima.ini : ahora + 3 * DIA;

  // A y V: lo tuyo
  for (const v of M.misVentas || []) {
    if (v.mejor) add({ ref: `A-${v.pid}`, tipo: 'aceptar', pid: v.pid, j: v.j, precio: v.mejor.importe, de: v.mejor.de, caduca: v.mejor.caduca, sobre: v.mejor.sobre, consejo: v.consejo });
  }
  for (const x of M.mias) {
    if (!x.j || (M.enVenta && M.enVenta.has(x.pid))) continue;
    add({ ref: `V-${x.pid}`, tipo: 'vender', pid: x.pid, j: x.j, precio: x.j.valor, compra: x.compra || null, ganado: x.ganado });
    // (sin riesgo, ni se ofrece: con la cláusula lejos de su valor no hace falta blindarlo; lo vio Carlos el 30 oct)
    if (x.clausula && x.riesgo !== 'ninguno' && (x.abierta || x.abreEn < 2 * DIA)) add({ ref: `B-${x.pid}`, tipo: 'blindar', pid: x.pid, j: x.j, clausula: x.clausula, abierta: x.abierta, abre: x.protegidoHasta, riesgo: x.riesgo, pagan: x.pagan, blindaje: x.blindaje, escudo: x.escudo, escudoGratis: x.abierta && !x.escudo && !!(M.escudosMios && M.escudosMios.quedan), sugerido: (M.paraEscudo || []).includes(x.pid) });
  }
  // P: libres de la liga
  for (const m of M.mercado) {
    if (m.tipo === 'liga') add({ ref: `P-${m.pid}`, tipo: 'pujar', pid: m.pid, j: m.j, precio: m.precio, puja: m.puja, pujaLiga: m.pujaLiga, recortada: m.recortada, pujas: m.pujas, miPuja: m.miPuja, cierra: m.cierra, interes: m.interes, sobre: m.sobre });
  }
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
      // (lo que se paga en esta liga por los libres va entero una sola vez, en su bloque; aquí, lo de los de su valor,
      // que es con lo que hay que comparar: un +100 % por uno de 600 mil puede ser lo normal; Carlos, 30 oct)
      const PV = M && M.pagaLiga && j && j.valor ? M.pagaLiga(j.valor) : null;
      const enE = (s) => eur(j.valor * (1 + s));
      const pvTxt = PV ? `; en esta liga, por los libres de su valor (${PV.n} compras de ${eur(PV.desde)} a ${eur(PV.hasta)}) se paga de mediana un ${pct(PV.med * 100)} (para él, ${enE(PV.med)}), 3 de cada 4 hasta ${pct(PV.p75 * 100)} (${enE(PV.p75)}) y el 90 % hasta ${pct(PV.p90 * 100)} (${enE(PV.p90)})` : '';
      return `PUJAR por ${j.nombre}, LIBRE en el mercado de la liga: subasta a ciegas, puja mínima ${eur(o.precio)}${o.pujas ? `, lleva ${o.pujas} pujas` : ''}${o.cierra ? `, se resuelve ${cuando(o.cierra)}` : ''}${o.miPuja ? `; MI PUJA ACTUAL ${eur(o.miPuja)}` : ''}${pvTxt}; la app pujaría ${eur(o.puja)} (${pct((o.puja / o.precio - 1) * 100)})${o.recortada ? ', recortada para no pagar de más por lo que aporta' : ''}`;
    }
    case 'M': {
      const ol = o.ofertaLiga || (M && M.ofertaLigaDe ? M.ofertaLigaDe(j) : null);
      const pide = j && j.valor ? ` (${pct((o.precio / j.valor - 1) * 100)} sobre su valor de ${eur(j.valor)})` : '';
      const laliga = ol && !ol.sinDatos
        ? `; LaLiga TAMBIÉN le hace su oferta por él, que SOLO VE ÉL (yo no sé cuánto es hoy): por lo vendido a LaLiga en esta liga (${ol.n} ventas) suele rondar ${eur(ol.v)}, normalmente entre ${eur(ol.min)} y ${eur(ol.max)}, y él se queda con la mejor${o.precio >= ol.max ? ': pide más de lo que le suele dar LaLiga, así que con lo que pide le compensa' : ', así que lo que pide es solo el suelo: por debajo de lo que suele darle LaLiga lo normal es que NO TE LO VENDA'}`
        : '; LaLiga TAMBIÉN le hace su oferta por él (aún no sé cuánto suele dar en esta liga) y él se queda con la mejor, así que ofrecer solo lo que pide no basta';
      const min = o.ofertaMin ? `; OFERTA MÍNIMA CON OPCIONES ${eur(o.ofertaMin)}${o.ofertaAlta && o.ofertaAlta > o.ofertaMin ? `, con muchas opciones (sin garantía: puede tener otras ofertas) ${eur(o.ofertaAlta)}` : ''}; la app ofrecería ${eur(o.puja || o.ofertaMin)}` : '';
      const sc = M && M.sobrecoste && j && o.puja ? M.sobrecoste(j, o.puja) : null;
      const scTxt = sc && j.valor && o.puja > j.valor * 1.02 ? ` (${pct((o.puja / j.valor - 1) * 100)} sobre su valor: ÍNDICE DE SOBRECOSTE ${sc.indice}/100, aguantable hasta ~${M.tolerancia(j)})` : '';
      return `COMPRAR ${j.nombre} a ${o.vendedor}, que LO TIENE A LA VENTA y pide ${eur(o.precio)}${pide}; es suyo hasta que ACEPTE una oferta, no es seguro${laliga}${min}${scTxt}${o.miPuja ? `; MI OFERTA ACTUAL ${eur(o.miPuja)}${o.ofertaMin && o.miPuja < o.ofertaMin ? ' (POR DEBAJO DE LO QUE LE DA LALIGA: no la va a aceptar)' : ''}` : ''}`;
    }
    case 'T': return `COMPRAR ${j.nombre} a ${o.vendedor} por ${eur(o.precio)}${sobreTxt} por el TRATO que me contaste («${o.nota}»)`;
    case 'C': return `CLAUSULAR ${j.nombre} (de ${o.de}) pagando su cláusula de ${eur(o.precio)}${sobreTxt}${(() => { const s = M && M.salida ? M.salida(j, o.precio) : null; return s ? `; SALIDA: ${s.txt}${s.ok ? '' : ' → NO LO PROPONGAS: sin salida y sin ser titular seguro'}` : ''; })()}; ${o.abierta ? 'ABIERTA YA' : o.veda ? `CERRADA hasta que empiece la jornada ${o.veda.n}: se puede pagar ${cuando(o.abre)}, ni un minuto antes` : `se abre ${cuando(o.abre)}`}${o.meLlega ? '' : o.conA ? `; ME LLEGA SI ANTES ACEPTO LAS OFERTAS QUE TENGO (con mi saldo de ahora me faltan ${eur(o.falta)})` : `; NO ME LLEGA: faltan ${eur(o.falta)} y lo que ponga a la venta no entra hasta aceptar una oferta`}`;
    case 'A': return `ACEPTAR la oferta de ${o.de} por ${j.nombre}: ${eur(o.precio)} (${pct((o.sobre || 0) * 100)} sobre su valor)${o.caduca ? `, caduca ${cuando(o.caduca)}` : ''}`;
    case 'V': return `VENDER ${j.nombre} (vale ${eur(j.valor)}${o.compra ? `, lo pagué a ${eur(o.compra)}` : ''})`;
    case 'B': {
      const p = o.pagan, b = o.blindaje;
      const quien = p && (p.seguro.length || p.quiza.length || p.hayDatos) ? `; le llega a ${p.seguro.length ? p.seguro.map((x) => x.nombre).join(', ') : 'nadie seguro'}${p.quiza.length ? ` (quizá a ${p.quiza.map((x) => x.nombre).join(', ')})` : ''}${p.sinSaber.length ? ` (de ${p.sinSaber.length} no se sabe el dinero)` : ''}` : '';
      const justo = b ? (b.yaVale ? '; ya está por encima de lo que se suele pagar en esta liga por una cláusula: no hace falta subirla' : b.caro ? `; dejarla fuera del alcance de todos costaría ${eur(b.coste)}: no compensa${b.parcial ? `; subirla a ${eur(b.parcial.objetivo)} (${eur(b.parcial.coste)}) deja fuera a todos menos a ${b.parcial.quedan.join(', ')}` : ''}` : `; blindaje justo: subirla a ${eur(b.objetivo)} cuesta ${eur(b.coste)} y ${b.porTecho ? 'quedaría por encima de lo que se suele pagar aquí por una cláusula' : 'no le llegaría a nadie'}`) : '';
      const gratis = o.escudo ? '; YA BLINDADO con el escudo' : o.escudoGratis ? `; se puede BLINDAR GRATIS con el escudo de LaLiga (anuncio, ${(M && M.ESCUDO_H) || 24} h)${o.sugerido ? ': CONVIENE HOY' : ''}` : '';
      return `PROTEGER ${j.nombre}: su cláusula (${eur(o.clausula)}) ${o.abierta ? 'está ABIERTA' : `se abre ${cuando(o.abre)}`}, riesgo ${o.riesgo || '?'}${quien}${gratis}${justo.replace('blindaje justo: subirla', 'o pagando: subirla')}`;
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
    return `Su cláusula no se abre hasta ${cuando(x.protegidoHasta)}, después de la próxima jornada`;
  }
  const venta = (M.mercado || []).find((m) => m.pid === pid && m.tipo === 'manager' && m.noVende);
  if (venta) return `Lo tiene a la venta, pero ${venta.noVende}: ${venta.vendedor || nombreDe(M, tid)} no te lo va a vender`;
  if (tid) {
    const fa = M.fichadoPor && M.fichadoPor(pid);
    return `No lo tiene a la venta y su dueño (${nombreDe(M, tid)}) no tiene por qué vendértelo${fa ? `: lo ${fa.clase === 'clausula' ? 'clausuló' : 'fichó'} ${cuando(fa.t)}` : ''}. Solo se le puede quitar con la cláusula`;
  }
  return 'No está hoy en el mercado';
}

/** el catálogo para la IA, por grupos (lo más interesante primero) */
export function catalogoTxt(D, M, cat, { corto = false, chat = false, datos = null } = {}) {
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
  // (cada candidato va con su ficha entera: con más, la IA tarda mucho más y no decide mejor)
  g('PUJAR (jugadores LIBRES de la liga, subasta a ciegas):', t('P').sort(por), chat ? 10 : corto ? 12 : 14);
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
    const cs = t('C').sort(por), llegan = cs.filter((o) => o.meLlega || o.conA), no = cs.filter((o) => !o.meLlega && !o.conA);
    g('CLAUSULAR (cláusulas de rivales abiertas o que se abren antes de la jornada, que me llegan con mi saldo o aceptando antes las ofertas que tengo):', llegan, chat ? 10 : corto ? 12 : 14);
    if (no.length) L.push(`\nCLÁUSULAS QUE NO ME LLEGAN HOY (ni aceptando las ofertas que tengo; solo para saber que existen): ${no.slice(0, 4).map((o) => `[${o.ref}] ${o.j.nombre} (de ${o.de}) ${eur(o.precio)}, faltan ${eur(o.falta)}`).join('; ')}${no.length > 4 ? ` y ${no.length - 4} más` : ''}.`);
  }
  g('BLINDAR (mis cláusulas abiertas o a punto):', t('B'), 12);
  L.push(`VENDER: cualquiera de mis jugadores con [V-<id>] (ids: ${t('V').map((o) => `${o.j.nombre} V-${o.pid}`).join(', ')}).`);
  L.push('Cualquier jugador de un rival que no esté arriba NO SE PUEDE CONSEGUIR HOY: ni comprándoselo ni de otra forma.');
  return L.join('\n');
}

export const esMalo = (j) => j && MALOS.has(j.estado);
export { POS, HORA };
