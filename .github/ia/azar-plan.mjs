// El plan a prueba de azar (15 nov, tras el «no cuadra» de Carlos): la liga de ejemplo, removida al azar cientos de veces
// (saldo, pujas puestas, cláusulas y protecciones tuyas y de los rivales, lo comprado para revender, lesionados, plantilla
// casi llena), en cada momento de la semana. No hay IA ni red. En cada liga removida se comprueba lo que no puede fallar:
//   1. el motor monta su plan sin romperse (no cae al plan de antes) y con las cuentas de verdad;
//   2. lo que se enseña no lleva nada tachado por la app;
//   3. una IA que no cambia nada NUNCA tira el plan, y el plan sale con los mismos pasos, sin tener que rehacerlo; tampoco
//      si solo cambia el orden de los pasos (17 nov);
//   4. una IA que quita y mete al azar tampoco lo tira, y lo que sale no lleva nada tachado;
//   5. si la IA tarda (20 min, 3 h, 26 h: el mercado cambia, las cláusulas se cierran), el plan sale igual;
//   7. el árbitro de banco.mjs (las reglas de LaLiga, con una cuenta aparte) da por bueno el plan de la app y el que
//      sale de los cambios de la IA; la única excepción, cuando no hay forma de empezar la jornada en positivo (saldo en
//      negativo sin cambios de mercado por delante): ahí el plan tiene que avisarlo («Ni con este plan llegas…»).
//   6. si el plan de la app ya no vale para la liga de ahora (el de la liga removida anterior: otro saldo, otros
//      jugadores, otras cláusulas), el plan sale igual, sin nada tachado y con el árbitro de acuerdo. Primero se ajusta (el
//      mismo plan sin lo que ya no cabe, o con lo que haga falta de más) y solo si ni así, se rehace; si se rehace, la
//      situación es la de la app y el titular no nombra a quien ha salido (17 nov). Se cuentan los ajustados y los rehechos.
//   8. (17 nov) el plan recogido de un pedido anterior (la app se cerró mientras la IA contestaba y el plan de ahora es
//      otro): sus ids se pasan a los de ahora por lo que era cada paso (traducirIds). No se rehace y cada frase va con su
//      jugador. Se cuenta cuántas frases habrían ido a otro jugador sin traducir (lo que pasaba antes).
// Además, los casos (17 nov): cada uno, una liga removida como las demás y con algo forzado encima, y lo suyo que
// comprobar (`CASOS`, abajo): parón con dinero de sobra, plantilla de 24 (llena), saldo negativo entre semana, cláusula recién
// pagada (14 días protegido), puja ya hecha por el mismo jugador, jornada empezada y rival que acaba de clausularte.
// Uso: node .github/ia/azar-plan.mjs [vueltas por escenario, 40] [semilla, 1]   (PW_MODULO como en prueba-web.mjs)
// Sale con 1 si algo falla, y dice la semilla y la vuelta para repetirlo.
import { pagina, cerrar, arbitro } from './banco.mjs';

const N = Number(process.argv[2]) || 40, SEMILLA = Number(process.argv[3]) || 1;
// [escena de banco.mjs, caso] (sin caso: solo el azar)
const ESCENAS_AZAR = [['martes'], ['veda'], ['enjuego'], ['paron'], ['m-cierre'], ['m-reventa'],
  ['paron', 'paron-rico'], ['m-limpio', 'lleno-24'], ['martes', 'negativo'], ['martes', 'clausula-pagada'], ['martes', 'puja-hecha'], ['enjuego', 'jornada-empezada'], ['martes', 'rival-clausulo'],
  // (19 nov, tercera parte) el sábado del partido con el cambio de ese mismo día, una liga con el mercado a otra hora, en
  // negativo con un solo cambio por delante, un titular lesionado largo, una cuenta nueva, una liga sin clausulazos y los
  // dos últimos días del parón
  ['sabado-justo', 'justo'], ['hora-20', 'hora-20'], ['jueves-negativo', 'negativo-ultimo'], ['martes', 'lesionado'], ['martes', 'nueva'], ['martes', 'sin-clausulazos'], ['paron-final', 'paron-final'], ['sabado'],
  // (19 nov, sesión larga) sin salida de verdad: el día antes de la jornada (sin cambios de mercado que sirvan para vender),
  // muy en negativo y sin ofertas que aceptar: el plan lo avisa y la IA no puede meter compras encima
  ['veda', 'sin-salida']];
let mal = 0, total = 0;
const resumen = {};
const sum = { rehechos: 0, ajustados: 0, viejos: 0, cruzadas: 0, recogidos: 0 };
// (19 nov) AZAR_SOLO=martes/negativo,veda: solo esas escenas (para mirar una deprisa)
const SOLO_AZAR = process.env.AZAR_SOLO ? new Set(process.env.AZAR_SOLO.split(',')) : null;
for (const [escena, caso] of ESCENAS_AZAR) {
  const nombre = caso ? `${escena}/${caso}` : escena;
  if (SOLO_AZAR && !SOLO_AZAR.has(nombre)) continue;
  const P = await pagina(escena);
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const r = await P.page.evaluate(async ({ N, SEMILLA, escena, caso, DEPURA }) => {
      const U = await import('./js/util.js');
      const lineas = (X, D, M) => window.__arbitro(X, D, M, U.eur);
      const reglas = (X, D, M) => lineas(X, D, M).filter((x) => /^REGLAS:/.test(x) && !/^REGLAS: ok/.test(x)).join(' | ');
      const I = await import('./js/ia.js'), Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js');
      const S = window.S;
      for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
      const f = S.fuentes || {};
      const D0 = JSON.stringify(S.D), H0 = JSON.stringify(S.H);
      const sinSalidaDet = [];
      const fallos = [], cuenta = { planes: 0, pasos: 0, vetos: 0, rehechos: 0, viejos: 0, ajustados: 0, cruzadas: 0, recogidos: 0, quita: 0, mete: 0, sinSalida: 0, caso: 0 };
      const avisos = [];
      const warn = console.warn; console.warn = (...a) => { avisos.push(a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 400)); };
      const ahora0 = Date.now();
      const vivas = (X) => (X.ops || []).filter((o) => !o.descartada && !o.sugerencia && !o.ya);
      const idsDe = (X) => I.idsCorto(X).lista.map((x) => [x.id, x.k]);
      let Rantes = null;
      for (let v = 0; v < N; v++) {
        // un azar que se puede repetir (mulberry32)
        let s = (SEMILLA * 1000003 + v * 7919 + escena.length * 31 + (caso ? caso.length * 977 : 0)) >>> 0;
        const az = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const uno = (xs) => xs[Math.floor(az() * xs.length)];
        const D = JSON.parse(D0), H = JSON.parse(H0);
        const yo = D.yo.teamId, mios = D.plantillas[yo];
        const cambios = [];
        D.dinero = Math.round((az() < 0.25 ? -30 + az() * 30 : az() * 150) * 1e6); cambios.push(`saldo ${D.dinero}`);
        // (19 nov) nunca una puja por uno tuyo que tienes en venta: LaLiga no deja, y era lo que daba los «sin salida» de veda,
        // m-cierre y sabado-justo (1 o 2 de cada 60: ni retirando las pujas de verdad ni vendiendo salía en positivo)
        const mioEnVenta = (m) => m.tipo === 'manager' && String(m.vendedorTeamId || '') === String(D.yo.teamId);
        for (const m of D.mercado) { if (az() < 0.5 || mioEnVenta(m)) m.miPuja = null; else if (az() < 0.15 && m.precio) { m.miPuja = Math.round(m.precio * (1 + az() * 0.2)); cambios.push(`puja ${m.pid}`); } }
        const prot = () => uno([null, ahora0 + 3600e3, ahora0 + 20 * 3600e3, ahora0 + 30 * 3600e3, ahora0 + 5 * 864e5, ahora0 + 12 * 864e5]);
        for (const [tid, fs] of Object.entries(D.plantillas)) for (const x of fs) {
          const j = D.maestro[x.pid];
          if (!j) continue;
          if (az() < (tid === yo ? 0.5 : 0.25)) { x.clausula = Math.round(j.valor * uno([1, 1.02, 1.05, 1.15, 1.4, 1.8])); x.protegidoHasta = prot(); }
          if (az() < 0.06) j.estado = uno(['injured', 'doubtful', 'suspended']);
        }
        // lo comprado para revender: de 0 a 5, subiendo o no
        const reventa = {};
        const nRev = uno([0, 0, 1, 2, 3, 4, 5]);
        for (const x of [...mios].sort(() => az() - 0.5).slice(0, nRev)) {
          const j = D.maestro[x.pid];
          reventa[j.id] = { t: ahora0 - Math.round(az() * 12) * 864e5, precio: Math.round(j.valor * (0.85 + az() * 0.25)) };
          if (az() < 0.7) { const serie = []; const sube = az() < 0.7; for (let k = 40; k >= 1; k--) serie.push([new Date(ahora0 - k * 864e5 + 3600e3).toISOString().slice(0, 10), Math.round(sube ? j.valor / Math.pow(1.01, k) : j.valor * Math.pow(1.012, Math.min(k, 6)))]); H.v = H.v || {}; H.v[j.id] = serie; }
        }
        if (nRev) cambios.push(`reventa ${nRev}`);
        // jugadores libres (de nadie y fuera del mercado), los más baratos primero
        const libres = (n) => { const con = new Set(Object.values(D.plantillas).flat().map((x) => x.pid)), enM = new Set(D.mercado.map((m) => m.pid)); return Object.values(D.maestro).filter((j) => !con.has(j.id) && !enM.has(j.id) && j.pos !== 5).sort((a, b) => a.valor - b.valor).slice(0, n); };
        const meter = (js) => { for (const j of js) mios.push({ pid: j.id, ptId: `pt${j.id}`, clausula: Math.round(j.valor * 1.6), protegidoHasta: ahora0 + 10 * 864e5, compra: j.valor }); };
        // a veces, la plantilla casi llena
        // (26 nov) la plantilla casi llena o llena, sin pasar del tope de LaLiga Fantasy (24)
        if (!caso && az() < 0.15) { meter(libres(Math.min(uno([7, 8, 9]), Math.max(0, 24 - mios.length)))); cambios.push(`plantilla ${mios.length}`); }
        /* --- el caso: lo forzado y lo que se apunta para comprobarlo después --- */
        const C = {};
        const rivales = Object.keys(D.plantillas).filter((t) => t !== yo);
        const yoC = (D.clasif || []).find((e) => e.teamId === yo) || {};
        // (de sobra: 60 a 150 M libres además de lo que ya tenga pujado)
        if (caso === 'paron-rico') { D.dinero = Math.round((60 + az() * 90) * 1e6) + D.mercado.reduce((t, m) => t + (+m.miPuja || 0), 0); cambios.push(`saldo ${D.dinero}`); }
        if (caso === 'lleno-24') { for (const m of D.mercado) m.miPuja = null; meter(libres(Math.max(0, 24 - mios.length))); mios.length = Math.min(mios.length, 24); cambios.push(`plantilla ${mios.length}`); }
        if (caso === 'negativo' || caso === 'negativo-ultimo') { D.dinero = -Math.round((0.5 + az() * 29.5) * 1e6); cambios.push(`saldo ${D.dinero}`); }
        if (caso === 'clausula-pagada' || caso === 'rival-clausulo') {
          // el mejor de un rival viene a mí (o uno de mis titulares se va a un rival), pagando su cláusula hace una hora
          const deTid = caso === 'clausula-pagada' ? uno(rivales) : yo, aTid = caso === 'clausula-pagada' ? yo : uno(rivales);
          const de = D.plantillas[deTid];
          const x = [...de].filter((y) => D.maestro[y.pid]).sort((a, b) => D.maestro[b.pid].valor - D.maestro[a.pid].valor)[caso === 'clausula-pagada' ? 0 : Math.floor(az() * 4)];
          const j = D.maestro[x.pid];
          const importe = Math.round(j.valor * (1.05 + az() * 0.4));
          D.plantillas[deTid] = de.filter((y) => y.pid !== x.pid);
          D.plantillas[aTid].push({ ...x, clausula: Math.round(importe * 1.0), protegidoHasta: ahora0 + 14 * 864e5, compra: importe });
          const e = (tid) => (D.clasif || []).find((y) => y.teamId === tid) || {};
          D.actividad = [{ id: 'cl-caso', t: ahora0 - 3600e3, tipo: 32, clase: 'clausula', quien: e(aTid).manager, quienId: e(aTid).userId, otro: e(deTid).manager, otroId: e(deTid).userId, pid: x.pid, jugador: j.nombre, importe, texto: '' }, ...(D.actividad || [])];
          C.pid = x.pid; C.nombre = j.nombre;
          cambios.push(`${caso === 'clausula-pagada' ? 'he clausulado' : 'me clausulan'} a ${j.nombre}`);
        }
        if (caso === 'puja-hecha') {
          const m = uno(D.mercado.filter((y) => y.precio && y.tipo !== 'rival' && !(Object.values(D.plantillas).flat().some((z) => z.pid === y.pid))).sort((a, b) => b.precio - a.precio).slice(0, 6));
          if (m) { m.miPuja = Math.round(m.precio * (1.02 + az() * 0.15)); C.pid = m.pid; C.nombre = (D.maestro[m.pid] || {}).nombre; cambios.push(`puja ya hecha por ${C.nombre}`); }
        }
        if (caso === 'lesionado') {
          // uno de mis titulares (de los cinco más caros), lesionado largo
          const x = [...mios].filter((y) => D.maestro[y.pid] && D.maestro[y.pid].pos !== 5).sort((a, b) => D.maestro[b.pid].valor - D.maestro[a.pid].valor)[Math.floor(az() * 5)];
          const j = D.maestro[x.pid]; j.estado = 'injured'; j.lesion = { dias: 45, texto: 'rotura muscular' };
          C.pid = x.pid; C.nombre = j.nombre; cambios.push(`${j.nombre} lesionado`);
        }
        if (caso === 'nueva') {
          // el primer día con la app: sin histórico, sin movimientos de la liga y sin saber lo que pagó por cada uno
          D.actividad = []; H.v = {}; for (const x of mios) x.compra = null; cambios.push('cuenta nueva');
        }
        if (caso === 'sin-salida') {
          D.dinero = -Math.round((15 + az() * 40) * 1e6);
          for (const m of D.mercado) m.miPuja = null;
          D.misVentas = [];
          cambios.push(`sin salida: saldo ${D.dinero}, sin ofertas`);
        }
        if (caso === 'sin-clausulazos') { D.actividad = (D.actividad || []).filter((a) => a.clase !== 'clausula'); cambios.push('sin clausulazos'); }
        void yoC;
        const donde = `${caso ? `${escena}/${caso}` : escena} · semilla ${SEMILLA} · vuelta ${v} (${cambios.join(', ')})`;
        const falla = (t) => fallos.push(`${donde}: ${t}`);
        let M, R;
        const c = Dt.cfg();
        avisos.length = 0;
        try { M = Mo.analizar(D, H, S.c, { det: S.det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, reventa }); } catch (e) { falla(`el motor de la liga se rompe: ${e.message}`); continue; }
        try { R = Pm.planDeHoy(D, M, c); } catch (e) { falla(`planDeHoy se rompe: ${e.message}`); continue; }
        cuenta.planes++;
        // 1
        if (avisos.length) falla(`el motor del plan se ha roto y sale el plan de antes: ${avisos[0]}`);
        if (!R || !R.motor) { falla('no hay plan del motor'); continue; }
        if (!R.cuentas || R.cuentas.jornada === -1) falla('las cuentas del plan no son de verdad (jornada -1)');
        // 2
        const tach = (X) => (X.ops || []).filter((o) => o._k && (o.descartada || o.sugerencia)).map((o) => `${o._k} (${String(o.aviso || '').slice(0, 90)})`);
        if (tach(R).length) falla(`el plan de la app lleva algo tachado: ${tach(R).join('; ')}`);
        const ks = (X) => (X.operaciones || []).filter((o) => o._k).map((o) => o._k).sort().join(' ');
        // 7 (el del motor)
        const rR = reglas(R, D, M), sinSalida = /^REGLAS: MAL r10:[^|]*$/.test(rR) && /Ni con este plan llegas en positivo/.test(R.avisoSaldo || '');
        if (rR && !sinSalida) falla(`el árbitro no da por bueno el plan de la app: ${rR.slice(0, 260)}`);
        if (sinSalida) cuenta.sinSalida++;
        // (25 nov) DEPURA=1: del plan que el árbitro no da por bueno, las cuentas, los pasos, los vetos y lo que ve el árbitro
        if (rR && !sinSalida && DEPURA) sinSalidaDet.push(`ARBITRO ${donde}: saldo ${D.dinero}, deuda ${M.deuda}, pujado ${M.misPujas}, cuentas ${JSON.stringify(R.cuentas)}, aviso «${R.avisoSaldo || ''}» ${R.final || ''}, ciclos ${M.ventanaEsp && M.ventanaEsp.ciclos}\n  ops ${(R.ops || []).map((o) => `${o._k || '-'}:${o.accion}:${o.jugador}:${o.importe}:hoy=${o.hoy}:${o.descartada ? 'DESC' : ''}${o.sugerencia ? 'SUG' : ''}${o.ya ? 'YA' : ''}${o.retira ? 'RET' : ''}`).join(' | ')}\n  vetos ${(R.vetos || []).map((v) => `${v.k} (${String(v.aviso).slice(0, 120)})`).join(' ; ')}\n  árbitro ${lineas(R, D, M).join(' ¦ ').slice(0, 1500)}`);
        if (sinSalida && DEPURA) sinSalidaDet.push(`SIN SALIDA ${donde}: saldo ${D.dinero}, deuda ${M.deuda}, cuentas ${JSON.stringify(R.cuentas)}, ciclos ${M.ventanaEsp && M.ventanaEsp.ciclos}, ops ${(R.ops || []).filter((o) => o._k).map((o) => `${o.accion}:${o.jugador}:${o.importe}:${o.hoy}`).join(' | ')} · vetos ${(R.vetos || []).map((v) => v.k).join(',')} · pujas ${(M.misPujasL || []).length || M.misPujas} · pujadas ${(D.mercado || []).filter((m) => m.miPuja).map((m) => `${m.pid}:${m.tipo}:${m.vendedorTeamId || ''}:${m.miPuja}:${Object.values(D.plantillas).some((pl) => pl.some((z) => z.pid === m.pid)) ? 'de alguien' : 'libre'}`).join(' ')} · yo ${D.yo.teamId}`);
        cuenta.pasos += (R.ops || []).filter((o) => o._k).length; cuenta.vetos += (R.vetos || []).length;
        /* --- lo de cada caso, sobre el plan de la app y luego sobre el de la IA al azar --- */
        // (19 nov) en negativo sin salida, si la IA mete compras de más, el aviso que sale es el del límite de deuda: también vale
        const revisaCaso = (X, quien) => {
          const vv = vivas(X), de = (pid) => vv.filter((o) => o.pid === pid);
          const hoyEntra = vv.some((o) => o.hoy !== false && ((o.accion === 'vender' && o.etiqueta === 'Aceptar oferta') || o.retira));
          if (caso === 'paron-rico') {
            if (X.modo !== 'paron') falla(`${quien}: en el parón el plan no va en modo parón (${X.modo})`);
            const vc = lineas(X, D, M).filter((l) => /^VENDE_POR_CAJA/.test(l));
            if (vc.length) falla(`${quien}: con dinero de sobra vende por caja: ${vc.join('; ')}`);
            if (vv.some((o) => o.hace_falta)) falla(`${quien}: con dinero de sobra hay una venta «hace falta»: ${vv.filter((o) => o.hace_falta).map((o) => o.jugador).join(', ')}`);
          }
          if (caso === 'lleno-24') {
            if (M.mias.length !== 24) falla(`el caso no ha dejado 24 jugadores (${M.mias.length})`);
            const ficha = vv.filter((o) => ['pujar', 'comprar', 'clausular'].includes(o.accion) && o.hoy !== false);
            if (ficha.length && !hoyEntra) falla(`${quien}: con 24 jugadores ficha a ${ficha.map((o) => o.jugador).join(', ')} sin vender antes`);
          }
          if (caso === 'negativo') {
            if (X.modo !== 'negativo') falla(`${quien}: en negativo entre semana el plan no va en modo negativo (${X.modo})`);
            if (X.cuentas && X.cuentas.jornada < 0 && !/Ni con este plan llegas|Te pasarías del límite de deuda/.test(X.avisoSaldo || '')) falla(`${quien}: acaba en negativo y no lo avisa`);
          }
          if (caso === 'clausula-pagada') {
            const b = de(C.pid).filter((o) => o.accion === 'blindar' || o.accion === 'clausular');
            if (b.length) falla(`${quien}: recién clausulado y protegido 14 días, y aun así ${b.map((o) => o.accion).join(', ')} a ${C.nombre}`);
          }
          if (caso === 'rival-clausulo') {
            if (de(C.pid).length) falla(`${quien}: ${C.nombre} ya no es mío (me lo han clausulado) y el plan lo mueve: ${de(C.pid).map((o) => o.accion).join(', ')}`);
            if (X.alineacion && (X.alineacion.titulares || []).includes(C.nombre)) falla(`${quien}: ${C.nombre} ya no es mío y va en el once`);
          }
          if (caso === 'puja-hecha' && C.pid) {
            const p = de(C.pid).filter((o) => o.accion === 'pujar');
            if (p.length) falla(`${quien}: ya hay una puja por ${C.nombre} y el plan puja otra vez`);
            if (de(C.pid).length > 1) falla(`${quien}: dos pasos con ${C.nombre}`);
          }
          if (caso === 'justo') {
            if (!M.ventanaEsp || !M.ventanaEsp.justo) falla('el caso no tiene el cambio de mercado del día del partido');
            if (vv.some((o) => /00:15/.test(String(o.cuando || '') + String(o.motivo || '')))) falla(`${quien}: habla de las 00:15 en una liga con el mercado a las 12:00`);
          }
          if (caso === 'hora-20') {
            if (vv.some((o) => /00:15/.test(String(o.cuando || '') + String(o.motivo || '')))) falla(`${quien}: habla de las 00:15 en una liga con el mercado a las 20:00: ${vv.filter((o) => /00:15/.test(String(o.cuando || '') + String(o.motivo || ''))).map((o) => o.jugador).join(', ')}`);
          }
          if (caso === 'negativo-ultimo') {
            if (X.modo !== 'negativo') falla(`${quien}: en negativo con un solo cambio por delante el plan no va en modo negativo (${X.modo})`);
            if (X.cuentas && X.cuentas.jornada < 0 && !/Ni con este plan llegas|Te pasarías del límite de deuda/.test(X.avisoSaldo || '')) falla(`${quien}: acaba en negativo y no lo avisa`);
            if (vv.some((o) => o.accion === 'vender' && o.hoy === false)) falla(`${quien}: con un solo cambio por delante deja una venta para otro día: ${vv.filter((o) => o.accion === 'vender' && o.hoy === false).map((o) => o.jugador).join(', ')}`);
          }
          if (caso === 'lesionado') {
            if (X.alineacion && (X.alineacion.titulares || []).includes(C.nombre)) falla(`${quien}: ${C.nombre} está lesionado y va en el once`);
            if (de(C.pid).some((o) => o.accion === 'blindar')) falla(`${quien}: blinda o sube la cláusula a ${C.nombre}, lesionado largo`);
          }
          if (caso === 'sin-salida') {
            if (X.cuentas && X.cuentas.jornada < 0 && !/Ni con este plan llegas|Acabarías en negativo/.test(X.avisoSaldo || '')) falla(`${quien}: sin salida y no lo avisa (${X.avisoSaldo || 'sin aviso'})`);
            const compra = vv.filter((o) => ['pujar', 'comprar', 'clausular'].includes(o.accion) && o.hoy !== false);
            if (compra.length) falla(`${quien}: sin salida y aun así ficha a ${compra.map((o) => o.jugador).join(', ')}`);
          }
          if (caso === 'paron-final') {
            if (X.modo === 'paron') falla(`${quien}: a dos días de la vuelta el plan sigue en modo parón`);
          }
          if (['pujar', 'comprar', 'clausular'].some((a) => vv.some((o) => o.accion === a && o.objetivo === 'titular' && o.j && ['injured', 'out'].includes(o.j.estado)))) falla(`${quien}: ficha para el once a uno lesionado: ${vv.filter((o) => o.objetivo === 'titular' && o.j && ['injured', 'out'].includes(o.j.estado)).map((o) => o.jugador).join(', ')}`);
          if (caso === 'jornada-empezada') {
            if (!M.enJuego) falla('el caso no tiene la jornada en juego');
            if (X.modo !== 'enjuego' && X.modo !== 'paron') falla(`${quien}: con la jornada empezada el plan no lo sabe (${X.modo})`);
            if (vv.some((o) => o.accion === 'alinear') || X.alineacion) falla(`${quien}: con la jornada empezada propone un once`);
          }
        };
        if (caso) { cuenta.caso++; revisaCaso(R, 'el de la app'); }
        // 3
        const { lista } = I.idsCorto(R);
        const neutra = { titular: 'Plan de hoy', situacion: 'Todo en orden.', pasos: lista.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: 'Vale la pena.' })), quita: [], mete: [] };
        let A = null;
        try { A = I.aplicarCorto(neutra, R, D, M, c); } catch (e) { falla(`aplicarCorto se rompe sin que la IA cambie nada: ${e.message}`); }
        if (!A) falla('la IA no cambia nada y el plan no sale');
        else {
          if (A.cambios && (A.cambios.rehecho || A.cambios.ajustado)) falla(`la IA no cambia nada y el plan hay que rehacerlo: ${A.cambios.rehecho || A.cambios.ajustado}`);
          else if (ks(A) !== ks(R)) falla(`la IA no cambia nada y los pasos cambian: [${ks(R)}] → [${ks(A)}]`);
          const cu = I.cuadrarPlan(A, D, M);
          if (tach(cu).length) falla(`el plan con la IA lleva algo tachado: ${tach(cu).join('; ')}`);
        }
        // 3b: solo cambia el orden
        if (neutra.pasos.length > 1) {
          let Ab = null;
          try { Ab = I.aplicarCorto({ ...neutra, pasos: [...neutra.pasos].reverse() }, R, D, M, c); } catch (e) { falla(`aplicarCorto se rompe con los pasos en otro orden: ${e.message}`); }
          if (Ab && (Ab.cambios.rehecho || Ab.cambios.ajustado)) falla(`con los pasos en otro orden hay que rehacer el plan: ${Ab.cambios.rehecho || Ab.cambios.ajustado}`);
          else if (Ab && ks(Ab) !== ks(R)) falla('con los pasos en otro orden, los pasos cambian');
        }
        // 4 (con una «fuente» de la búsqueda para cada cosa, que es lo que deja quitar y meter)
        const u = 'https://www.ejemplo.es/noticia';
        const loca = { titular: 'Cambio cosas', situacion: 'A ver.', fuentes: [{ t: 'Ejemplo', u }], pasos: lista.filter((x) => !x.alt && az() < 0.6).map((x) => ({ id: x.id, frase: 'Sube 3,21 M y cuesta 999,99 M.' })),
          quita: lista.filter((x) => !x.alt && az() < 0.5).map((x) => ({ id: x.id, motivo: 'Lesionado.', fuente: u })), mete: lista.filter((x) => x.alt && az() < 0.6).map((x) => ({ id: x.id, frase: 'Entra.', fuente: u })) };
        let B = null;
        try { B = I.aplicarCorto(loca, R, D, M, c); } catch (e) { falla(`aplicarCorto se rompe con cambios al azar: ${e.message}`); }
        if (!B) falla('la IA quita y mete al azar y el plan no sale');
        else {
          cuenta.quita += B.cambios.quita.length; cuenta.mete += B.cambios.mete.length;
          if (B.cambios.rehecho || B.cambios.ajustado) falla(`con cambios al azar hay que rehacer el plan: ${B.cambios.rehecho || B.cambios.ajustado}`);
          const cu = I.cuadrarPlan(B, D, M);
          if (tach(cu).length) falla(`el plan con cambios al azar lleva algo tachado: ${tach(cu).join('; ')}`);
          if (R.cuentas && R.cuentas.jornada >= 0 && B.cuentas && B.cuentas.jornada < 0) falla('con los cambios de la IA la jornada empezaría en negativo');
          // (19 nov) y si el de la app ya no llegaba en positivo, la IA no lo deja aún más en negativo (antes metía compras encima)
          if (R.cuentas && R.cuentas.jornada < 0 && B.cuentas && B.cuentas.jornada < R.cuentas.jornada - 1e4) falla(`con los cambios de la IA, aún más en negativo para la jornada (${R.cuentas.jornada} → ${B.cuentas.jornada})`);
          // 7 (el de la IA): si el de la app pasaba, este también
          const rB = reglas(cu, D, M);
          if (rB && !rR) falla(`el árbitro no da por bueno el plan con los cambios de la IA: ${rB.slice(0, 260)}`);
          if (caso) revisaCaso(cu, 'el de la IA');
        }
        // 5 (el reloj de la página es de mentira: se adelanta y se vuelve a poner)
        for (const salto of [20 * 60e3, 3 * 3600e3, 26 * 3600e3]) {
          const real = Date.now;
          Date.now = () => real() + salto;
          let T = null;
          try { T = I.aplicarCorto(neutra, R, D, M, c); if (T && T.cambios.rehecho) cuenta.rehechos++; if (T && T.cambios.ajustado) cuenta.ajustados++; } catch (e) { falla(`+${salto / 60e3} min: aplicarCorto se rompe: ${e.message}`); }
          if (!T) falla(`+${salto / 60e3} min: el plan no sale`);
          else { try { const cu = I.cuadrarPlan(T, D, M); if (tach(cu).length) falla(`+${salto / 60e3} min: lleva algo tachado: ${tach(cu).join('; ')}`); } catch (e) { falla(`+${salto / 60e3} min: cuadrarPlan se rompe: ${e.message}`); } }
          Date.now = real;
        }
        if (Rantes) {
          // 6: el plan de la liga anterior, sobre la de ahora
          const li = I.idsCorto(Rantes).lista;
          const primero = (li.find((x) => !x.alt) || {}).o;
          const vieja = { titular: primero && primero.jugador ? `Hoy, ${primero.jugador}` : 'Plan de hoy', situacion: 'Todo en orden.', pasos: li.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: 'Vale la pena.' })), quita: li.filter((x) => !x.alt && az() < 0.3).map((x) => ({ id: x.id, motivo: 'Lesionado.' })), mete: [] };
          let V = null;
          try { V = I.aplicarCorto(vieja, Rantes, D, M, c); } catch (e) { falla(`con un plan que ya no vale, aplicarCorto se rompe: ${e.message}`); }
          if (!V) falla('con un plan que ya no vale, el plan no sale');
          else {
            if (V.cambios.rehecho) cuenta.viejos++;
            else if (V.cambios.ajustado) cuenta.ajustados++;
            try {
              const cu = I.cuadrarPlan(V, D, M);
              if (tach(cu).length) falla(`con un plan que ya no vale, lleva algo tachado: ${tach(cu).join('; ')}`);
              const rV = reglas(cu, D, M);
              if (rV && !rR) falla(`con un plan que ya no vale, el árbitro no lo da por bueno: ${rV.slice(0, 260)}`);
              if (V.cambios.rehecho && V.situacion === 'Todo en orden.') falla('se ha rehecho el plan y la situación sigue siendo la de la IA (era de otro plan)');
              const enV = new Set((V.operaciones || []).map((o) => o.pid));
              if (primero && primero.jugador && primero.pid && !enV.has(primero.pid) && V.titular.includes(primero.jugador)) falla(`el titular nombra a ${primero.jugador}, que ya no está en el plan`);
            } catch (e) { falla(`con un plan que ya no vale, cuadrarPlan se rompe: ${e.message}`); }
          }
          // 8: lo mismo que contestaría la IA a aquel pedido, recogido ahora (los ids de entonces) sobre el plan de ahora
          const frase = (o) => `Paso de ${o.jugador || o.accion}.`;
          const recogida = () => ({ titular: 'Plan de hoy', situacion: 'Todo en orden.', pasos: li.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: frase(x.o) })), quita: [], mete: [] });
          const cruzadas = (X) => (X.operaciones || []).filter((o) => /^Paso de /.test(o.motivo || '') && o.motivo !== frase(o)).length;
          try {
            const sin = I.aplicarCorto(recogida(), R, D, M, c);
            cuenta.cruzadas += cruzadas(sin);
            const j = recogida();
            if (I.traducirIds(j, idsDe(Rantes), idsDe(R))) cuenta.recogidos++;
            const Rc = I.aplicarCorto(j, R, D, M, c);
            if (Rc.cambios.rehecho || Rc.cambios.ajustado) falla(`el plan recogido de un pedido anterior hay que rehacerlo: ${Rc.cambios.rehecho || Rc.cambios.ajustado}`);
            if (cruzadas(Rc)) falla(`el plan recogido de un pedido anterior pone ${cruzadas(Rc)} frases a otro jugador`);
            if (ks(Rc) !== ks(R)) falla('el plan recogido cambia los pasos del plan de ahora');
          } catch (e) { falla(`el plan recogido de un pedido anterior se rompe: ${e.message}`); }
        }
        Rantes = R;
      }
      console.warn = warn;
      return { fallos, cuenta, sinSalidaDet };
    }, { N, SEMILLA, escena, caso: caso || null, DEPURA: !!process.env.DEPURA });
    total += r.cuenta.planes; mal += r.fallos.length; resumen[nombre] = r.cuenta;
    for (const k of Object.keys(sum)) sum[k] += r.cuenta[k] || 0;
    for (const f of r.fallos.slice(0, 12)) console.log(`MAL  ${f}`);
    for (const f of r.sinSalidaDet || []) console.log(f);
    if (r.fallos.length > 12) console.log(`     … y ${r.fallos.length - 12} más en ${nombre}`);
    const k = r.cuenta;
    console.log(`${r.fallos.length ? 'MAL ' : 'BIEN'} ${nombre}: ${k.planes} ligas, ${k.pasos} pasos, ${k.vetos} vetos, ${k.quita}/${k.mete} quitados/metidos por la «IA»; con un plan de otra liga ${k.ajustados} ajustados y ${k.viejos} rehechos (${k.rehechos} por el paso del tiempo); recogidos ${k.recogidos} (sin traducir, ${k.cruzadas} frases a otro jugador); ${k.sinSalida} sin salida (avisado)${P.errores.length ? ` · errores de la página: ${P.errores.slice(0, 2).join(' | ')}` : ''}`);
  } finally { await P.cerrar(); }
}
await cerrar();
console.log(`${total} ligas al azar, ${mal} fallos · rehechos ${sum.viejos + sum.rehechos}, ajustados ${sum.ajustados}, recogidos ${sum.recogidos} (${sum.cruzadas} frases cruzadas sin traducir)`);
process.exit(mal ? 1 : 0);
