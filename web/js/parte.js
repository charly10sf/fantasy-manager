/* El parte de los rivales (26 nov; idea 2 de claude/propuesta-funciones-top.md, ampliada por Carlos a las 12:32: «si tiene
   en cuenta muchas cosas, como posiciones de las que le sobran o faltan jugadores»). De cada rival, SOLO lo que cambia lo
   que puedes hacer tú, y cada línea con su acción. Si una línea no lleva a nada que hacer, no sale.

   Dos partes, separadas para poder medir la primera con una liga de verdad (.github/ia/medir-parte.mjs):
     hechosRival(M, r)   lo que se sabe de un rival, sin textos: si le llega para empezar la jornada en positivo, si tiene
                         la plantilla llena, qué puestos no le llegan para su once, quién no le cabe y sus blindajes
     parte(M, D, opc)    las líneas que se enseñan, con su acción y con la llave que las abre

   REGLAS DE LALIGA QUE SE USAN (todas confirmadas por Carlos; claude/ESTADO-reglas.md): quien empieza la jornada en negativo
   no puntúa en toda la jornada (26 nov); con la plantilla llena (24, `M.TOPE`) no se puede pujar ni clausular (26 nov); una
   cláusula y una compra a otro mánager solo se pagan con saldo (19 nov); 2 blindajes por jornada, que se recargan al acabar
   una (22 nov); a un mánager se le oferta desde el valor de mercado, nunca menos, y lo que él pida no cuenta (22 nov).

   LAS LLAVES: lo que sale del dinero de un rival (`llave: 'dinero'`: que no le llega para empezar la jornada) solo se enseña
   con el dinero de ESE rival abierto; lo demás son hechos de LaLiga (`llave: 'parte'`) y va con la llave del parte. Aquí no
   se mira ninguna llave: lo hace `visibles`, que es lo ÚNICO que puede leer quien pinta (vistas.js) o quien se lo cuente a la
   IA. OJO: el orden de los rivales se decide en `visibles`, con lo que se ve; ordenar antes dejaba arriba al que está en
   negativo aunque su línea no saliera (revisión de fuera, 26 nov).

   LA APP NO SE CONTRADICE: el parte no decide comprar ni vender. La oferta por lo que un rival tiene a la venta es la misma
   cifra que dan Mercado y la ficha (`m.puja` de `M.mercado`, o la del paso del plan si lo lleva); no manda fichar lo que el
   plan descarta (`M.decisionFichar`) ni ofertar por encima de una cláusula abierta; y lo tuyo que nombra para vender es lo
   que ya vende la decisión (`M.decision`).

   LO MEDIDO con la liga de Carlos (J4-J13) decide qué líneas salen y cuándo: está encima de LINEAS y en claude/nota-parte.md. */
import { num, eur, antesDe, DIA } from './util.js';
import { esClausulable } from './motor.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
export const PUESTO_P = { 1: ['portero', 'porteros'], 2: ['defensa', 'defensas'], 3: ['centrocampista', 'centrocampistas'], 4: ['delantero', 'delanteros'] };
const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const enLista = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);
/** el parte sale desde estos días antes del primer partido (lo medido va de 1 a 4 días antes) y nunca con una jornada en juego */
export const DIAS_ANTES = 4;
/** lo que se le deja de más a un rival antes de darlo por «en negativo»: las recompensas diarias pueden ser más de lo que se
    cuenta (en algún parón LaLiga las ha subido a 500 mil al día) */
const HOLGURA_ROJO = 1.5e6;

/** los equipos que juegan la jornada (sin los partidos aplazados): null si no se sabe */
export function equiposQueJuegan(jo) {
  if (!jo || !Array.isArray(jo.partidos) || !jo.partidos.length) return null;
  const fuera = new Set((jo.aplazados || []).map((p) => `${p.localId}|${p.visitanteId}`));
  const s = new Set();
  for (const p of jo.partidos) if (!fuera.has(`${p.localId}|${p.visitanteId}`)) { s.add(String(p.localId)); s.add(String(p.visitanteId)); }
  return s.size ? s : null;
}

/** ¿toca el parte ahora? De 4 días antes del primer partido hasta que empieza, y sin jornada en juego. { jo, toca, desde } */
export function ventanaParte(M, ahora = Date.now()) {
  const jo = M.proxima || null;
  if (!jo) return { jo: null, toca: false, desde: null };
  const desde = jo.ini - DIAS_ANTES * DIA;
  return { jo, toca: !M.enJuego && ahora >= desde && ahora < jo.ini, desde: M.enJuego ? Math.max(desde, num(M.enJuego.fin)) : desde };
}

/**
 * Lo que se sabe de un rival para la próxima jornada, sin textos. `r` es su entrada de `M.rivales`.
 *   n, lleno            cuántos jugadores le cuentan en el tope (`M.cuentaPlantilla`) y si tiene la plantilla llena
 *   estado(j)           'ok' | 'duda' | 'baja' (lesionado, sancionado o fuera de LaLiga) | 'sin-partido' (aplazado)
 *   falta { pos: k }    los que le faltan SEGURO en cada puesto con los que seguro que pueden jugar ('ok'): lo menos que le
 *                       falta de ese puesto en cualquiera de las formaciones (si con una le llega, no le falta)
 *   faltaDuda           lo mismo contando a los dudosos como si jugaran (si aquí no falta, depende de un dudoso)
 *   titulares, suplentes{pos}, sobran{pos}   su mejor once con los que pueden jugar; los suplentes de cada puesto, del mejor
 *                       al peor; y los que sobran: los que quedan tras dejarle un recambio por puesto (y uno más por cada
 *                       titular dudoso de ese puesto)
 *   rojo                no le llega para empezar la jornada en positivo ni sumándole el margen de su dinero, las recompensas
 *                       diarias que le quedan y una holgura; nunca con el premio de la jornada por llegar ni con una jornada
 *                       en juego (cobrará sus puntos al acabarla); null si no se sabe su dinero
 *   escudos             los blindajes que le quedan esta jornada (`M.escudosDe`), o null
 */
export function hechosRival(M, r, ahora = Date.now()) {
  const tid = r.e.teamId;
  const todas = (r.fichas || []).filter((x) => x && x.j);
  const fichas = todas.filter((x) => x.j.pos >= 1 && x.j.pos <= 4);
  const jo = M.proxima || null;
  const juegan = equiposQueJuegan(jo);
  const estado = (j) => (MALOS.has(j.estado) ? 'baja' : juegan && !juegan.has(String(j.equipoId)) ? 'sin-partido' : j.estado === 'doubtful' ? 'duda' : 'ok');
  const pueden = fichas.filter((x) => ['ok', 'duda'].includes(estado(x.j))).map((x) => x.j);
  const firmes = fichas.filter((x) => estado(x.j) === 'ok').map((x) => x.j);
  // sin su plantilla (LaLiga no la ha dado, o acaba de entrar en la liga) no se sabe qué le falta: no se dice nada
  const sinPlantilla = fichas.length < 5;
  const formas = Array.isArray(M.formaciones) && M.formaciones.length ? M.formaciones : [[4, 3, 3]];
  const faltaDe = (lista) => {
    const f = {};
    if (sinPlantilla) return f;
    for (const p of [1, 2, 3, 4]) {
      const tiene = lista.filter((j) => j.pos === p).length;
      const k = Math.min(...formas.map((fo) => Math.max(0, (p === 1 ? 1 : num(fo[p - 2])) - tiene)));
      if (k > 0) f[p] = k;
    }
    return f;
  };
  const falta = faltaDe(firmes), faltaDuda = faltaDe(pueden);
  const once = M.mejorOnce(pueden);
  const lineasOnce = [0, 1, 2, 3].map((i) => (once.lineas && once.lineas[i]) || []);
  const titulares = new Set(lineasOnce.flat().map((j) => j.id));
  const suplentes = {}, sobran = {};
  for (const p of [1, 2, 3, 4]) {
    const sup = pueden.filter((j) => j.pos === p && !titulares.has(j.id)).sort((a, b) => M.ppEsperado(b) - M.ppEsperado(a));
    const dudosos = lineasOnce[p - 1].filter((j) => estado(j) === 'duda').length;
    suplentes[p] = sup;
    sobran[p] = sup.slice(1 + dudosos);
  }
  const cap = r.cap || null;
  const rec = jo ? M.recompensas(ahora, jo.ini) : 0;
  const premioFalta = M.premioPagado ? M.premioPagado(tid) === false : false;
  const rojo = cap && cap.alto != null ? !M.enJuego && !premioFalta && cap.alto + rec + HOLGURA_ROJO < 0 : null;
  const n = M.cuentaPlantilla ? M.cuentaPlantilla(todas.map((x) => x.j)) : todas.length;
  return { tid, n, sinPlantilla, lleno: n >= (M.TOPE || 24), estado, once, falta, faltaDuda, titulares, suplentes, sobran, cap, rojo, rec, escudos: M.escudosDe ? M.escudosDe(tid) : null, fichas };
}

/* LO MEDIDO con la liga de Carlos (26 nov; 8 rivales, J4-J13, 85 días y 808 movimientos; .github/ia/medir-parte.mjs):
     rojo       5 veces en 80 jornadas de rival alguien estaba «en rojo seguro» de 1 a 3 días antes: las 5 vendió antes del
                primer partido (16 ventas: 10 a LaLiga y 6 a otro mánager) y las 5 puntuó. Sale.
     falta      56 casos (rival, puesto y día, en los 4 días antes de una jornada): ficha de ese puesto en 48 h el 64 % de
                las veces, frente al 20 % de quien no va corto (del mercado, 45 % frente a 16 %). Sale, pero NO se dice que
                vaya a pujar por un libre en concreto: eso no se ha medido (y es lo que estima «quién puja»). Y cuando al que
                compra le faltaba el puesto, entre mánagers se pagó un +14 % sobre el valor de mediana (25 tratos; 22 de
                ellos, un +5 % o más): por eso se dice a quién avisar de lo que ya ibas a vender.
     sobra      NO SALE: de los que la app daría por sobrantes, en 7 días se vende el 12 % (el 1 % a otro mánager), menos
                que los titulares (26 % y 8 %). En esa liga se traspasan los titulares, no los que sobran.
     reventa    NO SALE: de 123 compras al mercado de un puesto que le faltaba a otro, 4 acabaron vendidas a ese rival en
                10 días (ganando un 6 % de mediana); 39 fueron a LaLiga y 11 de esas perdieron dinero.
     blindajes  5 de 80 jornadas de rival con los 2 gastados (y 10 con 1). Es un hecho: sale cuando pasa.
     llena      ningún rival llenó la plantilla en esos 85 días (van por 15 de media). Es una regla: sale cuando pasa. */
export const LINEAS = { rojo: true, falta: true, blindajes: true, sobra: false };

/**
 * El parte: una entrada por rival que tenga algo, cada una con sus líneas. SIN ORDENAR y sin mirar llaves: lo que se
 * enseña sale de `visibles`.
 *   { jornada, ini, toca, desde, rivales: [{ tid, nombre, e, lineas: [{ tipo, llave, txt, accion, pid, pids, pos, importe, orden, sinDinero }] }] }
 * tipo: 'rojo' | 'falta' | 'blindajes' (y 'sobra', apagada). `txt` es el hecho y `accion` lo que puedes hacer tú.
 * `sinDinero`: con lo que tiene (y lo que puede endeudarse) no le llega para lo que dice la línea; quien la enseñe la quita
 * si el dinero de ese rival está abierto (cerrado no se puede saber, y se deja). `opc.lineas` cambia qué líneas salen.
 */
export function parte(M, D, opc = {}) {
  const ahora = opc.ahora || Date.now();
  const L = { ...LINEAS, ...(opc.lineas || {}) };
  const V = ventanaParte(M, ahora), jo = V.jo;
  const vacio = { jornada: jo ? jo.n : null, ini: jo ? jo.ini : null, toca: V.toca, desde: V.desde, rivales: [] };
  if (!D || !Array.isArray(M.rivales) || !jo || !V.toca) return vacio;
  const libres = (M.mercado || []).filter((m) => m.tipo === 'liga' && m.j && m.j.pos >= 1 && m.j.pos <= 4 && !MALOS.has(m.j.estado));
  const dF = (pid) => (M.decisionFichar ? M.decisionFichar(pid) : null);
  // lo que dice el plan de fichar a uno (decide.js): el parte nunca manda fichar lo que el plan descarta
  const planNo = (pid) => { const d = dF(pid); return !!(d && d.accion === 'no'); };
  const planSi = (pid) => { const d = dF(pid); return !!(d && d.accion === 'fichar'); };
  // tú con la plantilla llena no puedes pujar, clausular ni comprar: nada de eso sale
  const yoLleno = M.llena != null ? !!M.llena : (M.mias || []).length >= (M.TOPE || 24);
  // lo que puedes pagarle a otro mánager: solo con saldo, y sin contar lo que ya tienes en pujas
  const saldoLibre = num(D.dinero) - Math.max(0, num(M.misPujas));
  // lo tuyo que la app ya manda vender (la misma decisión que en Equipo, la ficha y el plan)
  const misVentas = (M.mias || []).filter((x) => x.j && x.j.pos >= 1 && x.j.pos <= 4 && !MALOS.has(x.j.estado) && M.decision && (M.decision(x.pid) || {}).accion === 'vender');
  const avisados = new Set(); // cada jugador tuyo en venta, a un solo rival: el primero al que más le falta
  const suma = (o) => Object.values(o).reduce((s, x) => s + x, 0);
  const out = [];
  const porFalta = M.rivales.map((r) => ({ r, h: hechosRival(M, r, ahora) })).sort((a, b) => suma(b.h.falta) - suma(a.h.falta));
  for (const { r, h } of porFalta) {
    const tid = h.tid, lineas = [];
    const nombre = r.e.manager || r.e.nombre || 'Rival';
    // hasta dónde le llega para pujar en el mercado (con su margen de deuda); null si no se sabe su dinero
    const topePuja = h.cap && h.cap.alto != null ? h.cap.alto + 0.2 * num(r.e.valor) : null;
    const enVenta = (M.mercado || []).filter((m) => m.tipo === 'manager' && String(m.vendedorTeamId) === String(tid) && m.j);

    /* 1. EN NEGATIVO SEGURO (llave: su dinero). Tiene que vender antes del primer partido o no puntúa. Solo sale si tú
       puedes aprovecharlo: algo que YA tiene a la venta, que te sirve, que Mercado no da por «no te lo venderá», que el plan
       no descarta y que puedes pagar con tu saldo. La cifra, la de Mercado (o la del plan si ya lleva ese paso); si su
       cláusula está abierta y no pasa de esa cifra, no sale (lo que toca es la cláusula, y eso lo dice el plan) */
    if (L.rojo && h.rojo && !yoLleno) {
      const cands = enVenta.filter((m) => !MALOS.has(m.j.estado) && !m.noVende && !planNo(m.pid) && (M.mejora(m.j) >= 0.5 || (M.puestos || []).some((p) => p.pos === m.j.pos && p.faltan > 0)))
        .map((m) => { const d = dF(m.pid), cl = (M.clausulas || []).find((x) => x.pid === m.pid); return { j: m.j, of: num(d && d.accion === 'fichar' && d.importe) || num(m.puja), gana: M.mejora(m.j), cl }; })
        .filter((x) => x.of > 0 && x.of >= num(x.j.valor) && x.of <= saldoLibre && !(x.cl && x.cl.abierta && num(x.cl.clausula) <= x.of))
        .sort((a, b) => b.gana - a.gana);
      if (cands.length) {
        const c = cands[0];
        lineas.push({ tipo: 'rojo', llave: 'dinero', orden: 0, pid: c.j.id, importe: c.of,
          txt: `${h.cap.exacto ? 'Está en negativo' : 'Por sus movimientos, está en negativo'}: si no vende ${antesDe(jo.ini)}, no puntúa en la jornada.`,
          accion: `Tiene a la venta a ${c.j.nombre}: ofértale ${eur(c.of)}${c.gana >= 0.1 ? ` (te da ${d1(c.gana)} pts más por jornada)` : ''}.` });
      }
    }

    /* 2. LE FALTA GENTE EN UN PUESTO (llave: el parte). Quien va corto ficha de ese puesto en 48 h el 64 % de las veces
       (el 20 % quien no). Sale si te toca: tienes puesta una puja por un libre de ese puesto (o el plan la manda), o
       tienes de ese puesto uno que la app ya vende. No se dice por quién va a pujar: no se sabe */
    if (L.falta) {
      const conPuja = [], conVenta = [];
      for (const p of [1, 2, 3, 4]) {
        if (!h.falta[p]) continue;
        // (primero los que ya tienen tu puja; después, los que el plan manda fichar. Nunca la puja que el plan retira)
        const mios = yoLleno ? [] : libres.filter((m) => m.j.pos === p && ((num(m.miPuja) > 0 && !(dF(m.pid) || {}).retira) || planSi(m.pid)))
          .sort((a, b) => (num(b.miPuja) > 0) - (num(a.miPuja) > 0) || num(b.j.valor) - num(a.j.valor)).slice(0, 2);
        if (mios.length) { conPuja.push({ p, mios }); continue; }
        const mio = misVentas.filter((x) => x.j.pos === p && !avisados.has(x.pid)).sort((a, b) => num(b.j.valor) - num(a.j.valor))[0];
        if (mio && !h.lleno) conVenta.push({ p, mio });
      }
      // una sola línea por rival: los puestos que le faltan seguro (o, si todos dependen de un dudoso, esos, y se dice)
      const frase = (l0) => {
        const seguros = l0.filter((x) => h.faltaDuda[x.p]), l = seguros.length ? seguros : l0, k = (x) => (seguros.length ? h.faltaDuda[x.p] : h.falta[x.p]);
        const n = l.reduce((t, x) => t + k(x), 0);
        const cuanto = (x) => (k(x) === 1 ? `un ${PUESTO_P[x.p][0]}` : `${k(x)} ${PUESTO_P[x.p][1]}`);
        return { l, txt: `Le falta${n > 1 ? 'n' : ''} ${enLista(l.map(cuanto))} para alinear once${seguros.length ? '' : ' si no llega su dudoso'}.` };
      };
      if (conPuja.length) {
        const { l, txt } = frase(conPuja);
        const ms = l.length === 1 ? l[0].mios : l.slice(0, 2).map((x) => x.mios[0]);
        const nombres = ms.map((m) => m.j.nombre);
        lineas.push({ tipo: 'falta', llave: 'parte', orden: 1, pos: l[0].p, pids: ms.map((m) => m.pid), lleno: h.lleno, txt,
          sinDinero: topePuja != null && ms.every((m) => num(m.precio) > topePuja),
          accion: h.lleno ? `Pero tiene la plantilla llena: hasta que venda a uno no puede pujar ni por ${nombres.join(' ni por ')}.`
            : `Vas a por ${enLista(nombres)}: puede ser uno de los que pujen contra ti.` });
      } else if (conVenta.length) {
        const { l, txt } = frase(conVenta), mio = l[0].mio;
        avisados.add(mio.pid);
        const ya = !!(M.enVenta && M.enVenta.has && M.enVenta.has(mio.pid));
        lineas.push({ tipo: 'falta', llave: 'parte', orden: 2, pos: l[0].p, pid: mio.pid, vendo: true, txt,
          sinDinero: !!(h.cap && h.cap.alto != null && num(mio.j.valor) > h.cap.alto),
          accion: `${ya ? `Tienes a la venta a ${mio.j.nombre}: díselo` : `Vas a vender a ${mio.j.nombre}: ponlo a la venta y díselo`} antes de aceptar la oferta de LaLiga. Quien va corto de un puesto suele pagar más.` });
      }
    }

    /* 3. LE SOBRA GENTE EN UN PUESTO: APAGADA (lo medido, arriba). Solo el hecho, sin cifra de oferta: si un día se
       enciende, la oferta tiene que salir de donde sale la de Mercado y pasar por el plan */
    if (L.sobra && !yoLleno) {
      const cands = [1, 2, 3, 4].flatMap((p) => h.sobran[p].map((j) => ({ j, p }))).filter((x) => !planNo(x.j.id) && M.mejora(x.j) >= 0.5).map((x) => ({ ...x, gana: M.mejora(x.j) })).sort((a, b) => b.gana - a.gana);
      if (cands.length) {
        const c = cands[0], tot = h.fichas.filter((x) => x.j.pos === c.p && h.estado(x.j) !== 'baja').length;
        lineas.push({ tipo: 'sobra', llave: 'parte', orden: 2, pos: c.p, pid: c.j.id, lleno: h.lleno,
          txt: `Tiene ${tot} ${PUESTO_P[c.p][1]} y ${c.j.nombre} no le cabe en el once.`,
          accion: `A ti te da ${d1(c.gana)} pts más por jornada: pregúntale si lo vende.` });
      }
    }

    /* 4. SIN BLINDAJES (llave: el parte). Con los 2 gastados no puede blindar a nadie más hasta que acabe la jornada: lo
       suyo que tú clausularías hoy (te llega y merece la pena, y el plan no lo descarta) no te lo puede blindar */
    if (L.blindajes && h.escudos && h.escudos.quedan === 0 && !yoLleno) {
      const mias = (M.clausulas || []).filter((x) => String(x.teamId) === String(tid) && x.abierta && !planNo(x.pid) && esClausulable(M, x, ahora)).slice(0, 2);
      if (mias.length) {
        lineas.push({ tipo: 'blindajes', llave: 'parte', orden: 2, pids: mias.map((x) => x.pid),
          txt: 'Ha gastado sus 2 blindajes de esta jornada.',
          accion: `Si vas a clausular a ${mias.map((x) => `${x.j.nombre} (${eur(x.clausula)})`).join(' o a ')}, no puede blindarlo${mias.length > 1 ? 's' : ''} hasta que acabe la jornada.` });
      }
    }

    if (lineas.length) out.push({ tid, nombre, e: r.e, lleno: h.lleno, lineas });
  }
  return { ...vacio, rivales: out };
}

/**
 * Lo que se puede enseñar del parte con las llaves de ahora: SOLO esto se pinta o se cuenta. `abierto`: la llave del parte;
 * `dineroAbierto(tid)`: el dinero de ese rival. Con el parte cerrado, nada. De cada rival quedan las líneas que se ven (las
 * del dinero, solo con su dinero abierto; y con él abierto se quitan las que su dinero desmiente, `sinDinero`), y el ORDEN
 * sale de lo que se ve: primero el que tiene la línea que más te cambia, después el que más líneas tiene y, a igualdad, por
 * la clasificación. Así nada de lo que tapa una llave mueve a nadie de sitio.
 */
export function visibles(P, { abierto = false, dineroAbierto = () => false } = {}) {
  if (!P || !abierto) return [];
  return P.rivales.map((x) => {
    const ab = !!dineroAbierto(x.tid);
    return { ...x, lineas: x.lineas.filter((l) => (l.llave !== 'dinero' || ab) && !(ab && l.sinDinero)).sort((a, b) => a.orden - b.orden) };
  }).filter((x) => x.lineas.length)
    .sort((a, b) => a.lineas[0].orden - b.lineas[0].orden || b.lineas.length - a.lineas.length || num(a.e && a.e.pos) - num(b.e && b.e.pos) || String(a.tid).localeCompare(String(b.tid)));
}
