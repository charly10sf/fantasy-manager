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

   LAS LLAVES (Carlos, 26 nov, 18:34: «debería salir quién está en negativo. Solo eso, no por cuánto»): todo va con la llave
   del parte (`llave: 'parte'`), también QUIÉN está en negativo; lo único que pide el dinero de ESE rival abierto es su CIFRA
   (`dato` con `datoDinero`). (`llave: 'dinero'` sigue valiendo para una línea que no deba verse sin su dinero: hoy, ninguna.) Aquí no
   se mira ninguna llave: lo hace `visibles`, que es lo ÚNICO que puede leer quien pinta (vistas.js) o quien se lo cuente a la
   IA. OJO: el orden de los rivales se decide en `visibles`, con lo que se ve; ordenar antes dejaba arriba al que está en
   negativo aunque su línea no saliera (revisión de fuera, 26 nov).

   LA APP NO SE CONTRADICE: el parte no decide comprar ni vender. La oferta por lo que un rival tiene a la venta es la misma
   cifra que dan Mercado y la ficha (`m.puja` de `M.mercado`, o la del paso del plan si lo lleva); no manda fichar lo que el
   plan descarta (`M.decisionFichar`) ni ofertar por encima de una cláusula abierta; y lo tuyo que nombra para vender es lo
   que ya vende la decisión (`M.decision`).

   LO MEDIDO con la liga de Carlos (J4-J13) decide qué líneas salen y cuándo: está encima de LINEAS y en claude/nota-parte.md. */
import { num, eur, antesDe, DIA, horaDe, diaDe } from './util.js';
import { esClausulable } from './motor.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
export const PUESTO_P = { 1: ['portero', 'porteros'], 2: ['defensa', 'defensas'], 3: ['centrocampista', 'centrocampistas'], 4: ['delantero', 'delanteros'] };
const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
// («Unai Simón e Ilaix Moriba»: «e» delante de i- o hi-, no de hie-)
const enLista = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} ${/^h?i(?!e)/i.test(String(l[l.length - 1])) ? 'e' : 'y'} ${l[l.length - 1]}`);
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
 *   porPuesto { pos: { ok, duda } }  cuántos tiene de cada puesto que seguro pueden jugar, y cuántos dudosos
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
  const porPuesto = {};
  for (const p of [1, 2, 3, 4]) porPuesto[p] = { ok: firmes.filter((j) => j.pos === p).length, duda: pueden.filter((j) => j.pos === p).length - firmes.filter((j) => j.pos === p).length };
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
  return { tid, n, sinPlantilla, lleno: n >= (M.TOPE || 24), estado, once, falta, faltaDuda, porPuesto, titulares, suplentes, sobran, cap, rojo, rec, escudos: M.escudosDe ? M.escudosDe(tid) : null, fichas };
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
 * tipo: 'rojo' | 'falta' | 'blindajes' (y 'sobra', apagada). CORTO (Carlos, 26 nov, 18:10: «menos texto y más sintetizado»):
 * `txt` es el hecho en tres o cuatro palabras, `dato` su cifra (el saldo, «0 de 2»), `accion` UNA frase con lo que puedes
 * hacer tú, `nota` la letra pequeña (hasta cuándo) y `puestos` la gráfica de «le falta»: [{ p, n, falta }] con los que tiene
 * de cada puesto que seguro pueden jugar.
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

    /* 1. EN NEGATIVO SEGURO (llave: el parte; Carlos, 26 nov, 18:34: «si alguien la desbloquea, debería salir quién está
       en negativo. Solo eso, no por cuánto»). Tiene que vender antes del primer partido o no puntúa. QUIÉN lo está sale
       siempre con el parte abierto; POR CUÁNTO (`dato`, con `datoDinero`), solo con el dinero de ESE rival abierto: lo
       quita `visibles`. Si además YA tiene a la venta algo que te sirve, que Mercado no da por «no te lo venderá», que el
       plan no descarta y que puedes pagar con tu saldo, la oferta: la cifra de Mercado (o la del plan si ya lleva ese
       paso); si su cláusula está abierta y no pasa de esa cifra, sin oferta (lo que toca es la cláusula: lo dice el plan) */
    if (L.rojo && h.rojo) {
      const cands = yoLleno ? [] : enVenta.filter((m) => !MALOS.has(m.j.estado) && !m.noVende && !planNo(m.pid) && (M.mejora(m.j) >= 0.5 || (M.puestos || []).some((p) => p.pos === m.j.pos && p.faltan > 0)))
        .map((m) => { const d = dF(m.pid), cl = (M.clausulas || []).find((x) => x.pid === m.pid); return { j: m.j, of: num(d && d.accion === 'fichar' && d.importe) || num(m.puja), gana: M.mejora(m.j), cl }; })
        .filter((x) => x.of > 0 && x.of >= num(x.j.valor) && x.of <= saldoLibre && !(x.cl && x.cl.abierta && num(x.cl.clausula) <= x.of))
        .sort((a, b) => b.gana - a.gana);
      const c = cands[0] || null;
      const base = { tipo: 'rojo', llave: 'parte', orden: 0, txt: 'En negativo', dato: h.cap.exacto ? eur(h.cap.v, { dec: 1 }) : 'estimado', datoDinero: true };
      if (c) lineas.push({ ...base, pid: c.j.id, importe: c.of,
        accion: `Tiene en venta a ${c.j.nombre}: ofértale ${eur(c.of)}${c.gana >= 0.1 ? ` (+${d1(c.gana)} pts por jornada)` : ''}.`,
        nota: `Si no vende ${antesDe(jo.ini)}, no puntúa.` });
      else lineas.push({ ...base, accion: `Tiene que vender ${antesDe(jo.ini)} o no puntúa.` });
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
        const puestos = [1, 2, 3, 4].map((p) => ({ p, n: h.porPuesto[p].ok + (seguros.length ? h.porPuesto[p].duda : 0), falta: (l.find((x) => x.p === p) && k(l.find((x) => x.p === p))) || 0 }));
        return { l, puestos, txt: `Le falta${n > 1 ? 'n' : ''} ${enLista(l.map(cuanto))}${seguros.length ? '' : ' si no llega su dudoso'}` };
      };
      if (conPuja.length) {
        const { l, txt, puestos } = frase(conPuja);
        const ms = l.length === 1 ? l[0].mios : l.slice(0, 2).map((x) => x.mios[0]);
        const nombres = ms.map((m) => m.j.nombre);
        lineas.push({ tipo: 'falta', llave: 'parte', orden: 1, pos: l[0].p, pids: ms.map((m) => m.pid), lleno: h.lleno, txt, puestos,
          sinDinero: topePuja != null && ms.every((m) => num(m.precio) > topePuja),
          accion: h.lleno ? `Plantilla llena: no puede pujar por ${nombres.join(' ni por ')} hasta que venda.`
            : `Puede pujar contra ti por ${enLista(nombres)}.` });
      } else if (conVenta.length) {
        const { l, txt, puestos } = frase(conVenta), mio = l[0].mio;
        avisados.add(mio.pid);
        const ya = !!(M.enVenta && M.enVenta.has && M.enVenta.has(mio.pid));
        lineas.push({ tipo: 'falta', llave: 'parte', orden: 2, pos: l[0].p, pid: mio.pid, vendo: true, txt, puestos,
          sinDinero: !!(h.cap && h.cap.alto != null && num(mio.j.valor) > h.cap.alto),
          accion: ya ? `Tienes en venta a ${mio.j.nombre}: díselo. Quien va corto suele pagar más.`
            : `Ofrécele a ${mio.j.nombre} antes que a LaLiga: quien va corto suele pagar más.` });
      }
    }

    /* 3. LE SOBRA GENTE EN UN PUESTO: APAGADA (lo medido, arriba). Solo el hecho, sin cifra de oferta: si un día se
       enciende, la oferta tiene que salir de donde sale la de Mercado y pasar por el plan */
    if (L.sobra && !yoLleno) {
      const cands = [1, 2, 3, 4].flatMap((p) => h.sobran[p].map((j) => ({ j, p }))).filter((x) => !planNo(x.j.id) && M.mejora(x.j) >= 0.5).map((x) => ({ ...x, gana: M.mejora(x.j) })).sort((a, b) => b.gana - a.gana);
      if (cands.length) {
        const c = cands[0], tot = h.fichas.filter((x) => x.j.pos === c.p && h.estado(x.j) !== 'baja').length;
        lineas.push({ tipo: 'sobra', llave: 'parte', orden: 2, pos: c.p, pid: c.j.id, lleno: h.lleno,
          txt: `Le sobra ${c.j.nombre}`, dato: `${tot} ${PUESTO_P[c.p][1]}`,
          accion: `Pregúntale si lo vende (+${d1(c.gana)} pts por jornada).` });
      }
    }

    /* 4. SIN BLINDAJES (llave: el parte). Con los 2 gastados no puede blindar a nadie más hasta que acabe la jornada: lo
       suyo que tú clausularías hoy (te llega y merece la pena, y el plan no lo descarta) no te lo puede blindar */
    if (L.blindajes && h.escudos && h.escudos.quedan === 0 && !yoLleno) {
      const mias = (M.clausulas || []).filter((x) => String(x.teamId) === String(tid) && x.abierta && !planNo(x.pid) && esClausulable(M, x, ahora)).slice(0, 2);
      if (mias.length) {
        lineas.push({ tipo: 'blindajes', llave: 'parte', orden: 2, pids: mias.map((x) => x.pid),
          txt: 'Ha gastado sus 2 blindajes', dato: '0 de 2',
          // (Carlos, 26 nov, 18:50, con «Si clausulas a X, no puede blindarlo»: «no se entiende») primero lo que no puede hacer él
          accion: mias.length > 1 ? `No puede proteger a ${mias[0].j.nombre} ni a ${mias[1].j.nombre}: puedes clausularlos por ${eur(mias[0].clausula)} y ${eur(mias[1].clausula)}.`
            : `No puede proteger a ${mias[0].j.nombre}: puedes clausularlo por ${eur(mias[0].clausula)}.` });
      }
    }

    // (27 nov) DE CADA RIVAL, SU FICHA, tenga o no algo que hacer: los hechos de hoy (Carlos, 27 nov, 00:42: «una persona que va
    // a ver 2 anuncios, darle una cosa así tan pobre… puede generar una mala impresión»)
    out.push({ tid, nombre, e: r.e, lleno: h.lleno, lineas, ficha: fichaRival(M, h, enVenta, ahora) });
  }
  return { ...vacio, rivales: out };
}

const POS_C = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
/**
 * (27 nov) LA FICHA de un rival: lo que es verdad HOY, sacado de lo que ya baja la app. No predice nada (por eso no necesita
 * medida) y no decide nada (las cifras de comprar o vender son las de Mercado y el plan, en las líneas). Poco texto:
 *   estado   las pastillas de una línea: en negativo (seguro) o su saldo (`datoDinero`: solo con SU dinero abierto; lo quita
 *            `visibles`), sus blindajes (quedan 0, 1 o 2), su plantilla (n de 24) y los puestos en los que va corto
 *   hechos   como mucho tres líneas cortas: lo suyo que te llega por cláusula (abierta o en menos de 48 h, con TU dinero),
 *            lo que tiene a la venta y sus bajas en el once
 *   firma    lo mismo, en corto, para ver qué ha cambiado desde la última vez que lo miraste (`novedades`); sin cifras de su dinero
 */
export function fichaRival(M, h, enVenta = [], ahora = Date.now()) {
  const tid = h.tid, estado = [], hechos = [];
  if (h.rojo) estado.push({ k: 'rojo', txt: 'En negativo', tono: 'rojo' });
  else if (h.cap && h.cap.v != null) estado.push({ k: 'saldo', txt: `${eur(h.cap.v, { dec: 1 })}${h.cap.exacto ? '' : ' aprox.'}`, tono: num(h.cap.v) < 0 ? 'rojo' : '', datoDinero: true });
  if (h.escudos && h.escudos.quedan != null) estado.push({ k: 'escudos', quedan: h.escudos.quedan, txt: `${h.escudos.quedan} de 2 blindajes`, tono: h.escudos.quedan === 0 ? 'azul' : '' });
  estado.push({ k: 'plantilla', txt: h.lleno ? `Llena · ${h.n}` : `${h.n} de ${M.TOPE || 24}`, tono: h.lleno ? 'oro' : '' });
  const corto = [1, 2, 3, 4].filter((p) => h.falta[p] || h.faltaDuda[p]);
  if (corto.length) estado.push({ k: 'corto', pos: corto, txt: `Corto en ${corto.map((p) => POS_C[p]).join(' y ')}`, tono: 'oro' });

  // lo suyo que te llega por cláusula: el mismo filtro que «Te llegan» de Cláusulas (abierta o en menos de 48 h)
  // (el que más te interesa primero, con el mismo `interes` de Cláusulas; nunca lo que el plan descarta)
  const planNo = (pid) => { const d = M.decisionFichar ? M.decisionFichar(pid) : null; return !!(d && d.accion === 'no'); };
  const cls = (M.clausulas || []).filter((x) => String(x.teamId) === String(tid) && x.meLlega && (x.abierta || num(x.abreEn) < 2 * DIA) && x.j && !planNo(x.pid))
    .sort((a, b) => (b.abierta - a.abierta) || num(b.interes) - num(a.interes) || num(b.j.valor) - num(a.j.valor));
  if (cls.length) {
    const c = cls[0], mas = cls.length > 1 ? ` (y ${cls.length - 1} más)` : '';
    // con la veda de las 24 h antes de la jornada se abren todas a la vez, al empezar: se dice la hora
    const abre = ahora + num(c.abreEn), cuandoAbre = diaDe(abre) === diaDe(ahora) ? `a las ${horaDe(abre)}` : num(c.abreEn) < DIA ? `mañana a las ${horaDe(abre)}` : `en ${durCorta(num(c.abreEn))}`;
    hechos.push({ k: 'clausula', ic: 'candado', pid: c.pid, txt: c.abierta ? `Cláusula abierta de ${c.j.nombre}: ${eur(c.clausula)}${mas}` : `Cláusula de ${c.j.nombre} ${cuandoAbre}: ${eur(c.clausula)}${mas}` });
  }
  // lo que vende: primero lo que te mejora el once (lo mismo que mira «en negativo»), con lo que te da por jornada
  const venta = enVenta.filter((m) => m.j).map((m) => ({ m, g: M.mejora ? M.mejora(m.j) : 0 })).sort((a, b) => b.g - a.g || num(b.m.j.valor) - num(a.m.j.valor)).map((x) => ({ ...x.m, gana: x.g }));
  if (venta.length) {
    const v = venta[0], buena = v.gana >= 0.5 && !planNo(v.pid);
    hechos.push({ k: 'venta', ic: 'euro', pid: v.pid, txt: `Vende a ${v.j.nombre}${buena ? ` (+${d1(v.gana)} pts por jornada)` : ''}${venta.length > 1 ? ` y ${venta.length - 1} más` : ''}` });
  }
  // sus bajas en el once: de sus 11 mejores (sanos o no), los que no le juegan seguro
  const top = h.fichas.filter((x) => x.j.pos >= 1 && x.j.pos <= 4).map((x) => x.j).sort((a, b) => M.ppEsperado(b) - M.ppEsperado(a)).slice(0, 11);
  const fuera = top.filter((j) => h.estado(j) !== 'ok');
  if (fuera.length) {
    const et = { baja: '', duda: ' (duda)', 'sin-partido': ' (sin partido)' };
    hechos.push({ k: 'bajas', ic: 'lesion', txt: `Bajas en su once: ${enLista(fuera.slice(0, 3).map((j) => `${j.nombre}${et[h.estado(j)] || ''}`))}${fuera.length > 3 ? ` y ${fuera.length - 3} más` : ''}` });
  }
  const firma = { rojo: !!h.rojo, quedan: h.escudos ? h.escudos.quedan : null, lleno: !!h.lleno, corto,
    venta: Object.fromEntries(venta.map((m) => [m.pid, m.j.nombre])), abiertas: Object.fromEntries(cls.filter((x) => x.abierta).map((x) => [x.pid, x.j.nombre])) };
  return { estado, hechos, firma };
}
const durCorta = (ms) => (ms >= DIA ? `${Math.round(ms / 3600e3)} h` : ms >= 3600e3 ? `${Math.floor(ms / 3600e3)} h` : `${Math.max(1, Math.round(ms / 60e3))} min`);

/**
 * (27 nov) Lo que ha cambiado de cada rival desde la última vez que miraste el parte (`antes`: { jornada, s: { tid: firma } }).
 * Solo lo que te importa: pasa a estar en negativo, gasta un blindaje, llena la plantilla, se queda corto de un puesto, pone a
 * alguien a la venta o se le abre una cláusula que te llega. [{ tid, k, txt }]
 */
export function novedades(antes, rivales, jornada) {
  if (!antes || !antes.s || antes.jornada !== jornada) return [];
  const out = [];
  for (const x of rivales || []) {
    const a = antes.s[x.tid], b = x.ficha && x.ficha.firma;
    if (!a || !b) continue;
    if (b.rojo && !a.rojo) out.push({ tid: x.tid, k: 'rojo', txt: 'en negativo' });
    if (b.quedan != null && a.quedan != null && b.quedan < a.quedan) out.push({ tid: x.tid, k: 'escudos', txt: b.quedan === 0 ? 'sin blindajes' : 'ha gastado un blindaje' });
    if (b.lleno && !a.lleno) out.push({ tid: x.tid, k: 'plantilla', txt: 'plantilla llena' });
    const nc = (b.corto || []).filter((p) => !(a.corto || []).includes(p));
    if (nc.length) out.push({ tid: x.tid, k: 'corto', txt: `corto en ${nc.map((p) => POS_C[p]).join(' y ')}` });
    const nv = Object.entries(b.venta || {}).filter(([pid]) => !(a.venta || {})[pid]).map(([, n]) => n);
    if (nv.length) out.push({ tid: x.tid, k: 'venta', txt: `vende a ${enLista(nv.slice(0, 2))}` });
    const na = Object.entries(b.abiertas || {}).filter(([pid]) => !(a.abiertas || {})[pid]).map(([, n]) => n);
    if (na.length) out.push({ tid: x.tid, k: 'clausula', txt: `cláusula abierta de ${enLista(na.slice(0, 2))}` });
  }
  return out;
}
/** lo que se guarda para comparar la próxima vez */
export const firmaParte = (jornada, rivales) => ({ jornada, t: Date.now(), s: Object.fromEntries((rivales || []).filter((x) => x.ficha).map((x) => [x.tid, x.ficha.firma])) });

/**
 * Lo que se puede enseñar del parte con las llaves de ahora: SOLO esto se pinta o se cuenta. `abierto`: la llave del parte;
 * `dineroAbierto(tid)`: el dinero de ese rival. Con el parte cerrado, nada. De cada rival quedan las líneas que se ven: QUIÉN
 * está en negativo se ve con el parte abierto (Carlos, 26 nov, 18:34), pero su CIFRA (`datoDinero`) solo con su dinero
 * abierto: sin él la línea sale sin `dato` y con `sinCifra`; con él abierto se quitan las que su dinero desmiente
 * (`sinDinero`). El ORDEN
 * sale de lo que se ve: primero el que tiene la línea que más te cambia, después el que más líneas tiene y, a igualdad, por
 * la clasificación. Así nada de lo que tapa una llave mueve a nadie de sitio.
 */
export function visibles(P, { abierto = false, dineroAbierto = () => false } = {}) {
  if (!P || !abierto) return [];
  // (27 nov) cada rival sale con su ficha aunque no tenga nada que hacer; su saldo (`datoDinero`), solo con su dinero abierto
  const sacar = (x) => (x.ficha ? (x.ficha.hechos.some((f) => f.k === 'clausula' && /abierta/.test(f.txt)) ? 2 : 0) + (x.ficha.hechos.some((f) => f.k === 'venta') ? 1 : 0) : 0);
  const prim = (x) => (x.lineas.length ? x.lineas[0].orden : 9);
  return P.rivales.map((x) => {
    const ab = !!dineroAbierto(x.tid);
    const ficha = x.ficha ? { ...x.ficha, estado: x.ficha.estado.filter((f) => !f.datoDinero || ab) } : null;
    return { ...x, ficha, lineas: x.lineas.filter((l) => (l.llave !== 'dinero' || ab) && !(ab && l.sinDinero)).map((l) => (l.datoDinero && !ab ? { ...l, dato: '', sinCifra: true } : l)).sort((a, b) => a.orden - b.orden) };
  }).filter((x) => x.lineas.length || x.ficha)
    // primero a quien le puedes sacar más: lo que tiene una línea que hacer, después lo suyo que te llega por cláusula y lo que vende
    .sort((a, b) => prim(a) - prim(b) || b.lineas.length - a.lineas.length || sacar(b) - sacar(a) || num(a.e && a.e.pos) - num(b.e && b.e.pos) || String(a.tid).localeCompare(String(b.tid)));
}
