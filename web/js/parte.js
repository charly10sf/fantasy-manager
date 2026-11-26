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

   LO MEDIDO con la liga de Carlos (J4-J13) decide qué líneas salen: está encima de LINEAS y en claude/nota-parte.md. */
import { num, eur, cuando } from './util.js';
import { ofertaDueno, esClausulable } from './motor.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
export const PUESTO_P = { 1: ['portero', 'porteros'], 2: ['defensa', 'defensas'], 3: ['centrocampista', 'centrocampistas'], 4: ['delantero', 'delanteros'] };
const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const enLista = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);

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
  // sin su plantilla (LaLiga no la ha dado, o acaba de entrar en la liga) no se sabe qué le falta: no se dice nada
  const sinPlantilla = fichas.length < 5;
  const falta = sinPlantilla ? {} : faltaDe(onceFirme), faltaDuda = sinPlantilla ? {} : faltaDe(once);
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
  return { tid, n: todas.length, sinPlantilla, lleno: todas.length >= 25, estado, once, falta, faltaDuda, titulares, suplentes, sobran, cap, rojo, rec, escudos: M.escudosDe ? M.escudosDe(tid) : null, fichas };
}

/* LO MEDIDO con la liga de Carlos (26 nov; 8 rivales, J4-J13, 85 días y 808 movimientos; .github/ia/medir-parte.mjs):
     rojo       5 veces en 80 jornadas de rival alguien estaba «en rojo seguro» de 1 a 3 días antes: las 5 vendió antes del
                primer partido (16 ventas: 10 a LaLiga y 6 a otro mánager) y las 5 puntuó. Sale.
     falta      56 casos (rival, puesto y día, en los 4 días antes de una jornada): ficha de ese puesto en 48 h el 64 % de
                las veces, frente al 20 % de quien no va corto (del mercado, 45 % frente a 16 %). Sale. Y cuando al que
                compra le faltaba el puesto, entre mánagers se pagó un +14 % sobre el valor de mediana (25 tratos; 22 de
                ellos, un +5 % o más): por eso se dice a quién ofrecerle lo que ya ibas a vender.
     sobra      NO SALE: de los que la app daría por sobrantes, en 7 días se vende el 12 % (el 1 % a otro mánager), menos
                que los titulares (26 % y 8 %). En esa liga se traspasan los titulares, no los que sobran.
     reventa    NO SALE: de 123 compras al mercado de un puesto que le faltaba a otro, 4 acabaron vendidas a ese rival en
                10 días (ganando un 6 % de mediana); 39 fueron a LaLiga y 11 de esas perdieron dinero.
     blindajes  5 de 80 jornadas de rival con los 2 gastados (y 10 con 1). Es un hecho: sale cuando pasa.
     25         ningún rival llegó a 25 en esos 85 días (van por 15 de media). Es una regla: sale cuando pasa. */
export const LINEAS = { rojo: true, falta: true, blindajes: true, sobra: false };

/** ¿puedes comprarle a otro mánager por ese importe? Solo con saldo y con sitio en la plantilla */
const puedoComprar = (M, D, importe) => importe > 0 && importe <= num(D.dinero) && (M.mias || []).length < 25;

/**
 * El parte: una entrada por rival que tenga algo, cada una con sus líneas.
 *   { tid, nombre, e, lineas: [{ tipo, llave, txt, accion, pid, pids, pos, importe, orden }] }
 * tipo: 'rojo' | 'falta' | 'blindajes' (y 'sobra', apagada). `txt` es el hecho y `accion` lo que puedes hacer tú.
 * Los rivales salen por lo que más te cambia (orden menor, antes). No se mira ninguna llave: ver `visibles`.
 * `opc.lineas` cambia qué líneas salen (LINEAS), para probar las apagadas.
 */
export function parte(M, D, opc = {}) {
  const ahora = opc.ahora || Date.now();
  const L = { ...LINEAS, ...(opc.lineas || {}) };
  const jo = M.proxima || null;
  if (!D || !Array.isArray(M.rivales) || !jo) return { jornada: null, ini: null, rivales: [] };
  const libres = (M.mercado || []).filter((m) => m.tipo === 'liga' && m.j && m.j.pos >= 1 && m.j.pos <= 4 && !MALOS.has(m.j.estado));
  // lo que dice el plan de fichar a uno (decide.js): el parte nunca manda fichar lo que el plan descarta
  const planNo = (pid) => { const d = M.decisionFichar ? M.decisionFichar(pid) : null; return !!(d && d.accion === 'no'); };
  const planSi = (pid) => { const d = M.decisionFichar ? M.decisionFichar(pid) : null; return !!(d && d.accion === 'fichar'); };
  // lo tuyo que la app ya manda vender (la misma decisión que en Equipo, la ficha y el plan)
  const misVentas = (M.mias || []).filter((x) => x.j && x.j.pos >= 1 && x.j.pos <= 4 && !MALOS.has(x.j.estado) && M.decision && (M.decision(x.pid) || {}).accion === 'vender');
  const out = [];
  for (const r of M.rivales) {
    const h = hechosRival(M, r, ahora), tid = h.tid, lineas = [];
    const nombre = r.e.manager || r.e.nombre || 'Rival';
    const enVenta = (M.mercado || []).filter((m) => m.tipo === 'manager' && String(m.vendedorTeamId) === String(tid) && m.j);
    const oferta = (j) => { const m = enVenta.find((x) => x.pid === j.id); const o = ofertaDueno(M, j, M.tend(j.id) || {}, ahora); return Math.max(num(m && m.ofertaMin), num(o && o.v), num(j.valor)); };
    const meSirve = (j) => !MALOS.has(j.estado) && !planNo(j.id) && (M.mejora(j) >= 0.5 || (M.puestos || []).some((p) => p.pos === j.pos && p.faltan > 0));

    /* 1. EN ROJO SEGURO (llave: su dinero). Tiene que vender antes del primer partido o no puntúa. Solo sale si tú puedes
       aprovecharlo: uno suyo que te sirve y que puedes pagar con tu saldo */
    if (L.rojo && h.rojo) {
      const cands = h.fichas.map((x) => x.j).filter((j) => meSirve(j)).map((j) => ({ j, of: oferta(j), venta: enVenta.some((m) => m.pid === j.id), gana: M.mejora(j) }))
        .filter((x) => puedoComprar(M, D, x.of)).sort((a, b) => (b.venta - a.venta) || (b.gana - a.gana));
      if (cands.length) {
        const c = cands[0];
        lineas.push({ tipo: 'rojo', llave: 'dinero', orden: 0, pid: c.j.id, importe: c.of,
          txt: `Está en negativo: si no vende antes de ${cuando(jo.ini)}, no puntúa en la jornada.`,
          // (si no lo tiene a la venta, que lo ponga: lo que es seguro en LaLiga es ofertar por lo que está en el mercado)
          accion: `${c.venta ? `Ofértale ${eur(c.of)} por ${c.j.nombre}, que lo tiene a la venta` : `Dile que ponga a la venta a ${c.j.nombre} y ofértale ${eur(c.of)}`}${c.gana >= 0.1 ? `: te da ${d1(c.gana)} pts más por jornada` : ''}.` });
      }
    }

    /* 2. LE FALTA GENTE EN UN PUESTO (llave: el parte). Lo normal es que fiche de ese puesto en 48 h (64 % frente a 20 %).
       Sale si te toca: pujas tú (o el plan) por un libre de ese puesto, o tienes de ese puesto uno que la app ya vende */
    if (L.falta) {
      const conPuja = [], conVenta = [];
      for (const p of [1, 2, 3, 4]) {
        if (!h.falta[p]) continue;
        // (primero por los que ya has pujado; después, los que el plan manda fichar, del más caro al más barato)
        const mios = libres.filter((m) => m.j.pos === p && (num(m.miPuja) > 0 || planSi(m.pid))).sort((a, b) => (num(b.miPuja) > 0) - (num(a.miPuja) > 0) || num(b.j.valor) - num(a.j.valor)).slice(0, 2);
        if (mios.length) { conPuja.push({ p, mios }); continue; }
        const mio = misVentas.filter((x) => x.j.pos === p).sort((a, b) => num(b.j.valor) - num(a.j.valor))[0];
        if (mio && !h.lleno) conVenta.push({ p, mio });
      }
      // una sola línea por rival: los puestos que le faltan seguro (o, si todos dependen de un dudoso, esos, y se dice)
      const frase = (l0) => {
        const firmes = l0.filter((x) => h.faltaDuda[x.p]), l = firmes.length ? firmes : l0;
        const n = l.reduce((t, x) => t + h.falta[x.p], 0);
        const cuanto = (x) => (h.falta[x.p] === 1 ? `un ${PUESTO_P[x.p][0]}` : `${h.falta[x.p]} ${PUESTO_P[x.p][1]}`);
        return { l, txt: `Le falta${n > 1 ? 'n' : ''} ${enLista(l.map(cuanto))} para alinear once${firmes.length ? '' : ' si no llega su dudoso'}.` };
      };
      if (conPuja.length) {
        const { l, txt } = frase(conPuja);
        // de un solo puesto, hasta dos libres («por A o por B»: fichará uno); de varios, el mejor de cada uno («por A y por B»)
        const ms = l.length === 1 ? l[0].mios : l.slice(0, 2).map((x) => x.mios[0]);
        const nombres = ms.map((m) => m.j.nombre), une = l.length === 1 ? ' o por ' : ' y por ';
        lineas.push({ tipo: 'falta', llave: 'parte', orden: 1, pos: l[0].p, pids: ms.map((m) => m.pid), lleno: h.lleno, txt,
          accion: h.lleno ? `Pero tiene 25 jugadores: hasta que venda a uno no puede pujar ni por ${nombres.join(' ni por ')}.`
            : `Lo normal es que puje por ${nombres.join(une)}: si ${ms.length > 1 ? 'quieres a alguno' : 'lo quieres'}, cuenta con su puja al poner la tuya.` });
      } else if (conVenta.length) {
        const { l, txt } = frase(conVenta), mio = l[0].mio;
        lineas.push({ tipo: 'falta', llave: 'parte', orden: 2, pos: l[0].p, pid: mio.pid, vendo: true, txt,
          accion: `Vas a vender a ${mio.j.nombre}: ponlo a la venta y díselo antes de aceptar la oferta de LaLiga. Quien va corto de un puesto suele pagar más.` });
      }
    }

    /* 3. LE SOBRA GENTE EN UN PUESTO: APAGADA (lo medido, arriba). Uno que no le cabe en el once ni es su recambio y que a
       ti te sirve. La oferta, la de `ofertaDueno` (desde su valor; si sube, lo que ganaría quedándoselo) */
    if (L.sobra) {
      const cands = [1, 2, 3, 4].flatMap((p) => h.sobran[p].map((j) => ({ j, p }))).filter((x) => meSirve(x.j))
        .map((x) => ({ ...x, of: oferta(x.j), gana: M.mejora(x.j) })).filter((x) => puedoComprar(M, D, x.of)).sort((a, b) => b.gana - a.gana);
      if (cands.length && !lineas.some((l) => l.tipo === 'rojo' && l.pid === cands[0].j.id)) {
        const c = cands[0], tot = h.fichas.filter((x) => x.j.pos === c.p && h.estado(x.j) !== 'baja').length;
        lineas.push({ tipo: 'sobra', llave: 'parte', orden: 2, pos: c.p, pid: c.j.id, importe: c.of, lleno: h.lleno,
          txt: `Tiene ${tot} ${PUESTO_P[c.p][1]} y ${c.j.nombre} no le cabe en el once.`,
          accion: `Pídeselo: desde ${eur(c.of)}${c.gana >= 0.1 ? `. A ti te da ${d1(c.gana)} pts más por jornada` : ''}.` });
      }
    }

    /* 4. SIN BLINDAJES (llave: el parte). Con los 2 gastados no puede proteger a nadie hasta que acabe la jornada: lo suyo
       que tú clausularías hoy (te llega y merece la pena) no te lo puede cerrar (otro rival sí puede adelantarse) */
    if (L.blindajes && h.escudos && h.escudos.completo && h.escudos.quedan === 0) {
      const mias = (M.clausulas || []).filter((x) => String(x.teamId) === String(tid) && x.abierta && !planNo(x.pid) && esClausulable(M, x, ahora)).slice(0, 2);
      if (mias.length) {
        lineas.push({ tipo: 'blindajes', llave: 'parte', orden: 2, pids: mias.map((x) => x.pid),
          txt: 'Ha gastado sus 2 blindajes de esta jornada.',
          accion: `No puede blindar a ${mias.map((x) => `${x.j.nombre} (${eur(x.clausula)})`).join(' ni a ')} hasta que acabe la jornada: si vas a por él, no te lo puede cerrar.` });
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
