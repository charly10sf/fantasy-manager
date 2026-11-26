/* El parte de los rivales (26 nov; idea 2 de claude/propuesta-funciones-top.md, ampliada por Carlos a las 12:32: «si tiene
   en cuenta muchas cosas, como posiciones de las que le sobran o faltan jugadores»). De cada rival, SOLO lo que cambia lo
   que puedes hacer tú, y cada línea con su acción. Si una línea no lleva a nada que hacer, no sale.

   Dos partes, separadas para poder medir la primera con una liga de verdad (.github/ia/medir-parte.mjs):
     hechosRival(M, r)   lo que se sabe de un rival, sin textos: si le llega para empezar la jornada en positivo, si tiene
                         25, qué puestos no le llegan para su once, quién no le cabe en él y los blindajes que le quedan
     parte(M, D, opc)    las líneas que se enseñan, con su acción y con la llave que las abre

   REGLAS DE LALIGA QUE SE USAN (todas confirmadas por Carlos; claude/ESTADO-reglas.md): quien empieza la jornada en negativo
   no puntúa en toda la jornada (26 nov); con 25 jugadores no se puede pujar ni clausular (14 y 20 nov); una cláusula y una
   compra a otro mánager solo se pagan con saldo (19 nov); 2 blindajes por jornada, que se recargan al acabar una (22 nov); a
   un mánager se le oferta desde el valor de mercado, nunca menos, y lo que él pida no cuenta (22 nov); un rival no suelta a
   un titular que sube por 1 M más (20 nov: va dentro de `ofertaDueno`).

   LAS LLAVES: lo que sale del dinero de un rival (`llave: 'dinero'`: que no le llega para empezar la jornada) solo se enseña
   con el dinero de ESE rival abierto; lo demás son hechos de LaLiga (`llave: 'parte'`) y va con la llave del parte. Aquí no
   se mira ninguna llave: lo hace quien pinta (hojas.js) y quien se lo cuenta a la IA (ia.js), con `visibles`.

   LO MEDIDO con la liga de Carlos (J4-J13): arriba de cada regla y en claude/nota-parte.md del proyecto. */
import { num, DIA, HORA, eur, cuando } from './util.js';
import { ofertaDueno, esClausulable } from './motor.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
export const PUESTO_P = { 1: ['portero', 'porteros'], 2: ['defensa', 'defensas'], 3: ['centrocampista', 'centrocampistas'], 4: ['delantero', 'delanteros'] };
const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

/** los equipos que juegan la jornada (sin los partidos aplazados): null si no se sabe */
export function equiposQueJuegan(jo) {
  if (!jo || !Array.isArray(jo.partidos) || !jo.partidos.length) return null;
  const fuera = new Set((jo.aplazados || []).map((p) => `${p.localId}|${p.visitanteId}`));
  const s = new Set();
  for (const p of jo.partidos) if (!fuera.has(`${p.localId}|${p.visitanteId}`)) { s.add(String(p.localId)); s.add(String(p.visitanteId)); }
  return s.size ? s : null;
}

/**
 * Lo que se sabe de un rival para la próxima jornada, sin textos. `r` es su entrada de `M.rivales`.
 *   n, lleno            cuántos jugadores tiene y si son 25 (no puede pujar ni clausular hasta que venda)
 *   estado(j)           'ok' | 'duda' | 'baja' (lesionado, sancionado o fuera de LaLiga) | 'sin-partido' (aplazado)
 *   falta { pos: k }    los que le faltan en cada puesto para alinear once con los que seguro que pueden jugar ('ok')
 *   faltaDuda           lo mismo contando a los dudosos como si jugaran (si aquí no falta, depende de un dudoso)
 *   titulares, suplentes{pos}, sobran{pos}   su mejor once con los que pueden jugar; los suplentes de cada puesto, del mejor
 *                       al peor; y los que sobran: los que quedan tras dejarle un recambio por puesto (y uno más por cada
 *                       titular dudoso de ese puesto)
 *   rojo                no le llega para empezar la jornada en positivo ni sumándole el margen de su dinero ni las
 *                       recompensas diarias que le quedan por coger; null si no se sabe su dinero
 *   escudos             los blindajes que le quedan esta jornada (`M.escudosDe`), o null
 */
export function hechosRival(M, r, ahora = Date.now()) {
  const tid = r.e.teamId;
  const todas = r.fichas || [];
  const fichas = todas.filter((x) => x && x.j && x.j.pos >= 1 && x.j.pos <= 4);
  const jo = M.proxima || null;
  const juegan = equiposQueJuegan(jo);
  const estado = (j) => (MALOS.has(j.estado) ? 'baja' : juegan && !juegan.has(String(j.equipoId)) ? 'sin-partido' : j.estado === 'doubtful' ? 'duda' : 'ok');
  const pueden = fichas.filter((x) => ['ok', 'duda'].includes(estado(x.j))).map((x) => x.j);
  const firmes = fichas.filter((x) => estado(x.j) === 'ok').map((x) => x.j);
  const once = M.mejorOnce(pueden), onceFirme = M.mejorOnce(firmes);
  const faltaDe = (o) => {
    const f = {};
    if (!o || !o.formacion) return f;
    [1, 2, 3, 4].forEach((p, i) => { const k = (p === 1 ? 1 : o.formacion[p - 2]) - o.lineas[i].length; if (k > 0) f[p] = k; });
    return f;
  };
  const falta = faltaDe(onceFirme), faltaDuda = faltaDe(once);
  const titulares = new Set(once.lineas.flat().map((j) => j.id));
  const suplentes = {}, sobran = {};
  for (const p of [1, 2, 3, 4]) {
    const sup = pueden.filter((j) => j.pos === p && !titulares.has(j.id)).sort((a, b) => M.ppEsperado(b) - M.ppEsperado(a));
    const dudosos = once.lineas[p - 1].filter((j) => estado(j) === 'duda').length;
    suplentes[p] = sup;
    sobran[p] = sup.slice(1 + dudosos);
  }
  // su dinero: en rojo seguro solo si no le llega ni con el margen ni con las recompensas diarias de aquí al primer partido,
  // y nunca con el premio de la última jornada sin cobrar (entra de golpe y puede sacarle del rojo)
  const cap = r.cap || null;
  const rec = jo ? M.recompensas(ahora, jo.ini) : 0;
  const premioFalta = M.premioPagado ? M.premioPagado(tid) === false : false;
  const rojo = cap && cap.alto != null ? cap.alto + rec < 0 && !premioFalta : null;
  return { tid, n: todas.length, lleno: todas.length >= 25, estado, once, falta, faltaDuda, titulares, suplentes, sobran, cap, rojo, rec, escudos: M.escudosDe ? M.escudosDe(tid) : null, fichas };
}

/** ¿puedes comprarle a otro mánager por ese importe? Solo con saldo y con sitio en la plantilla */
const puedoComprar = (M, D, importe) => importe > 0 && importe <= num(D.dinero) && (M.mias || []).length < 25;

/**
 * El parte: una entrada por rival que tenga algo, cada una con sus líneas.
 *   { tid, nombre, e, lineas: [{ tipo, llave, txt, accion, pid, pids, pos, importe, orden }] }
 * tipo: 'rojo' | 'falta' | 'sobra' | 'blindajes'. `txt` es el hecho y `accion` lo que puedes hacer tú.
 * Los rivales salen por lo que más te cambia (orden menor, antes). No se mira ninguna llave: ver `visibles`.
 */
export function parte(M, D, opc = {}) {
  const ahora = opc.ahora || Date.now();
  const jo = M.proxima || null;
  if (!D || !Array.isArray(M.rivales) || !jo) return { jornada: null, rivales: [] };
  const libres = (M.mercado || []).filter((m) => m.tipo === 'liga' && m.j && m.j.pos >= 1 && m.j.pos <= 4 && !MALOS.has(m.j.estado));
  const out = [];
  for (const r of M.rivales) {
    const h = hechosRival(M, r, ahora), tid = h.tid, lineas = [];
    const nombre = r.e.manager || r.e.nombre || 'Rival';
    const enVenta = (M.mercado || []).filter((m) => m.tipo === 'manager' && String(m.vendedorTeamId) === String(tid) && m.j);
    const oferta = (j) => { const m = enVenta.find((x) => x.pid === j.id); const o = ofertaDueno(M, j, M.tend(j.id) || {}, ahora); return Math.max(num(m && m.ofertaMin), num(o && o.v), num(j.valor)); };
    const meSirve = (j) => !MALOS.has(j.estado) && (M.mejora(j) >= 0.5 || (M.puestos || []).some((p) => p.pos === j.pos && p.faltan > 0));

    /* 1. EN ROJO SEGURO (llave: su dinero). Tiene que vender antes del primer partido o no puntúa: es cuando acepta lo que
       otro día no. Solo sale si tú puedes aprovecharlo: uno suyo que te sirve y que puedes pagar con tu saldo */
    if (h.rojo) {
      const cands = h.fichas.map((x) => x.j).filter((j) => meSirve(j)).map((j) => ({ j, of: oferta(j), venta: enVenta.some((m) => m.pid === j.id), gana: M.mejora(j) }))
        .filter((x) => puedoComprar(M, D, x.of)).sort((a, b) => (b.venta - a.venta) || (b.gana - a.gana));
      if (cands.length) {
        const c = cands[0];
        lineas.push({ tipo: 'rojo', llave: 'dinero', orden: 0, pid: c.j.id, importe: c.of,
          txt: `En rojo: si no vende antes de ${cuando(jo.ini)}, no puntúa en la jornada.`,
          accion: `Ofértale ${eur(c.of)} por ${c.j.nombre}${c.venta ? ', que lo tiene a la venta' : ''}: te da ${d1(c.gana)} pts más por jornada y a él le saca del apuro.` });
      }
    }

    /* 2. LE FALTA GENTE EN UN PUESTO (llave: el parte). Va a ir al mercado a por ese puesto, salvo que tenga 25 (entonces
       no puede pujar hasta que venda). Sale con los libres de ese puesto que hay hoy en el mercado */
    for (const p of [1, 2, 3, 4]) {
      if (!h.falta[p]) continue;
      const del = libres.filter((m) => m.j.pos === p).sort((a, b) => num(b.j.valor) - num(a.j.valor));
      if (!del.length) continue;
      const mios = del.filter((m) => num(m.miPuja) > 0 || (M.decisionFichar && (M.decisionFichar(m.pid) || {}).accion === 'fichar'));
      const cuantos = h.falta[p] === 1 ? `un ${PUESTO_P[p][0]}` : `${h.falta[p]} ${PUESTO_P[p][1]}`;
      const porque = h.faltaDuda[p] ? '' : ' (depende de un dudoso)';
      const nombres = (l) => l.slice(0, 2).map((m) => m.j.nombre).join(' y ');
      let accion;
      if (h.lleno) accion = `Tiene 25 jugadores: hasta que venda no puede pujar por ${nombres(del)}.`;
      else if (mios.length) accion = `Cuenta con su puja por ${nombres(mios)}: o subes la tuya o lo dejas pasar.`;
      else accion = `Irá a por ${nombres(del)}: si no ${del.length > 1 ? 'los' : 'lo'} necesitas, no entres en esa subasta.`;
      lineas.push({ tipo: 'falta', llave: 'parte', orden: mios.length ? 1 : 3, pos: p, pids: (mios.length ? mios : del).slice(0, 2).map((m) => m.pid), lleno: h.lleno,
        txt: `Le falta ${cuantos} para su once${porque}.`, accion });
    }

    /* 3. LE SOBRA GENTE EN UN PUESTO (llave: el parte). Uno que no le cabe en el once ni es su recambio y que a ti te
       sirve: se le puede pedir. La oferta, la de `ofertaDueno` (desde su valor; si sube, lo que ganaría quedándoselo) */
    {
      const cands = [1, 2, 3, 4].flatMap((p) => h.sobran[p].map((j) => ({ j, p }))).filter((x) => meSirve(x.j))
        .map((x) => ({ ...x, of: oferta(x.j), gana: M.mejora(x.j) })).filter((x) => puedoComprar(M, D, x.of)).sort((a, b) => b.gana - a.gana);
      if (cands.length && !(lineas[0] && lineas[0].tipo === 'rojo' && lineas[0].pid === cands[0].j.id)) {
        const c = cands[0], tot = h.fichas.filter((x) => x.j.pos === c.p && h.estado(x.j) !== 'baja').length;
        lineas.push({ tipo: 'sobra', llave: 'parte', orden: 2, pos: c.p, pid: c.j.id, importe: c.of, lleno: h.lleno,
          txt: `Tiene ${tot} ${PUESTO_P[c.p][1]} y ${c.j.nombre} no le cabe en el once${h.lleno ? '; con 25 jugadores, tiene que soltar a alguien para fichar' : ''}.`,
          accion: `Pídeselo: desde ${eur(c.of)}. A ti te da ${d1(c.gana)} pts más por jornada.` });
      }
    }

    /* 4. SIN BLINDAJES (llave: el parte). Con los 2 gastados no puede proteger a nadie hasta que acabe la jornada: lo suyo
       que tú clausularías hoy (te llega y merece la pena) no corre prisa por ese lado */
    if (h.escudos && h.escudos.completo && h.escudos.quedan === 0) {
      const mias = (M.clausulas || []).filter((x) => String(x.teamId) === String(tid) && x.abierta && !x.veda && esClausulable(M, x, ahora)).slice(0, 2);
      if (mias.length) {
        lineas.push({ tipo: 'blindajes', llave: 'parte', orden: 2, pids: mias.map((x) => x.pid),
          txt: 'Ha gastado sus 2 blindajes de esta jornada.',
          accion: `No puede blindar a ${mias.map((x) => `${x.j.nombre} (${eur(x.clausula)})`).join(' ni a ')} hasta que acabe la jornada: puedes clausular cuando te venga mejor.` });
      }
    }

    if (lineas.length) out.push({ tid, nombre, e: r.e, lleno: h.lleno, lineas: lineas.sort((a, b) => a.orden - b.orden) });
  }
  out.sort((a, b) => a.lineas[0].orden - b.lineas[0].orden || b.lineas.length - a.lineas.length);
  return { jornada: jo.n, ini: jo.ini, rivales: out };
}

/**
 * Lo que se puede enseñar del parte con las llaves de ahora. `abierto`: la llave del parte; `dineroAbierto(tid)`: el dinero
 * de ese rival. De cada rival: las líneas que se ven y si le queda algo detrás de la llave de su dinero. OJO: `cerradoDinero`
 * es true SIEMPRE que su dinero esté cerrado, tenga línea o no: el candado no puede decir si hay algo detrás.
 */
export function visibles(P, { abierto = false, dineroAbierto = () => false } = {}) {
  if (!P || !abierto) return [];
  return P.rivales.map((x) => {
    const ab = !!dineroAbierto(x.tid);
    return { ...x, lineas: x.lineas.filter((l) => l.llave !== 'dinero' || ab), cerradoDinero: !ab };
  });
}
