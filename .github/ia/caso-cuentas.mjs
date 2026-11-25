// Las cuentas del plan (25 nov, tanda 3 de la auditoría de fallos: hallazgos 3, 4, 7 y 8). Sin IA ni red.
//   A. UNA SOLA PUJA (4). Con la liga removida al azar: en el plan de la app, la puja de cada paso es la que lee la IA y la
//      que dicen sus pastillas («puja de X»): al repasarlo en el mismo momento, la app no la sube ni la baja.
//   B. EL TIEMPO (4). Un plan de la IA hecho con una puja y repasado después, cuando ese jugador lleva más pujas y la app
//      pujaría más (lo de Carlos el 25 nov: «unos 48,19 M al empezar la jornada» arriba y «Te quedas con 48,08 M» en el
//      paso; «puja de 1,32 M» y, debajo, «Subida de 1,32 M a 1,43 M»): el paso, sus pastillas y la frase de la IA dicen la
//      puja de ahora; la de antes solo sale en el aviso que cuenta el cambio; y la situación lleva el saldo y lo que queda
//      con las cuentas de ahora, las mismas que «Te quedas con».
//   C. EL % DE TITULAR (4). El que lee la IA de cada jugador y el del motivo de la app son el de la app (`M.titularidad`,
//      el que sale junto al nombre en Mercado y en la ficha), no el del once probable de fuera. Y en un plan de la IA
//      repasado más tarde, el que cita un paso es el de ahora.
//   D. LOS CHOLLOS DE MERCADO (7). De cada libre que Mercado llamaría «Chollo», el plan dice algo: o lo ficha, o lo ha
//      mirado y dice por qué no (`M.decisionFichar`), y entonces Mercado no lo llama «Chollo». Los que van a «Mirados y
//      descartados», con una frase.
//   E. «LO MISMO QUE» (8). Si la cláusula y lo que da LaLiga se leen igual, no dice «más que».
//   F. `cifrasAlDia` y `titularAlDia`, con textos escritos a mano (lo que cambian y, sobre todo, lo que no tocan).
// Lo del negativo con un solo cambio de mercado (3) lo prueba azar-plan.mjs con `AZAR_SOLO=jueves-negativo/negativo-ultimo`.
// Uso: PW_MODULO=… node .github/ia/caso-cuentas.mjs [vueltas por escena, 12] [semilla, 1]
import { pagina, cerrar } from './banco.mjs';

const N = Number(process.argv[2]) || 12, SEM = Number(process.argv[3]) || 1;
let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

for (const escena of ['martes', 'hora-20', 'paron', 'mercado-real', 'enjuego', 'veda']) {
  const P = await pagina(escena);
  try {
    const r = await P.page.evaluate(async ({ N, SEM, escena }) => {
      const Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js'), Vi = await import('./js/vistas.js');
      const S = window.S, c = Dt.cfg();
      for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((res) => setTimeout(res, 50));
      const f = S.fuentes || {}, D0 = JSON.stringify(S.D), H0 = JSON.stringify(S.H);
      const analizar = (D, H) => Mo.analizar(D, H, S.c, { det: S.det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, reventa: {} });
      const fallos = [], n = { planes: 0, pujas: 0, deriva: 0, tit: 0, chollos: 0, fichados: 0, mirados: 0, igual: 0 };
      const cifras = (t) => [...String(t || '').matchAll(/(\d+(?:[.,]\d+)?)\s?(M|mil)\b/g)].map((m) => m[0].replace(/\s/g, ' '));
      for (let v = 0; v < N; v++) {
        let s = (SEM * 1000003 + v * 7919 + escena.length * 31) >>> 0;
        const az = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const D = JSON.parse(D0), H = JSON.parse(H0);
        D.dinero = Math.round((az() < 0.15 ? -15 + az() * 15 : 5 + az() * 120) * 1e6);
        for (const m of D.mercado) { m.miPuja = null; if (m.tipo === 'liga') m.pujas = Math.floor(az() * 4); }
        const donde = `${escena} · semilla ${SEM} · vuelta ${v} (saldo ${D.dinero})`;
        const falla = (t) => fallos.push(`${donde}: ${t}`);
        let M, R;
        try { M = analizar(D, H); R = Pm.planDeHoy(D, M, c); } catch (e) { falla(`se rompe: ${e.message}`); continue; }
        n.planes++;
        M.verPlan(R);
        const vivas = (X) => (X.ops || []).filter((o) => !o.descartada && !o.sugerencia && !o.ya);
        const pujasDe = (X) => vivas(X).filter((o) => o.accion === 'pujar' && o._k && !o.retira);

        /* --- A: una sola puja, en el mismo momento --- */
        const pedido = I.pedidoCorto(D, M, c, R);
        for (const o of pujasDe(R)) {
          n.pujas++;
          if (/Subida de|La app la deja en|La IA pujaba/.test(o.aviso || '')) falla(`A: la app cambia la puja de su propio plan (${o.jugador}): ${String(o.aviso).slice(0, 120)}`);
          const cu = (o.datos || {}).cuanto || '';
          if (/^puja de /.test(cu) && !cu.includes(U.eur(o.importe))) falla(`A: las pastillas de ${o.jugador} dicen «${cu}» y el paso, ${U.eur(o.importe)}`);
          const linea = pedido.split('\n').find((l) => /^\[p\d+\] PUJAR/.test(l) && l.includes(o.jugador));
          if (linea && !linea.includes(U.eur(o.importe))) falla(`A: la IA lee otra puja de ${o.jugador}: «${linea}» (el paso, ${U.eur(o.importe)})`);
        }

        /* --- C: el % de titular que lee la IA y el del motivo, el de la app --- */
        const pApp = (j) => { const T = M.titularidad(j); return T && T.p != null && !M.alineacion(j.id) ? Math.round(T.p * 100) : null; };
        const lineas = pedido.split('\n');
        for (const o of (R.ops || []).filter((x) => x.j && x.j.pos < 5 && x._k && !x.descartada)) {
          const p = pApp(o.j);
          if (p == null) continue;
          n.tit++;
          const l = lineas.find((x) => x.startsWith('   ') && x.includes(` | ${o.j.nombre} | `));
          const enIA = l ? [...l.matchAll(/(?:titular|TITULAR)\s*~?(\d{1,3}) %/g)].map((m) => +m[1]) : [];
          if (enIA.some((x) => x !== p)) falla(`C: de ${o.j.nombre} la IA lee titular ${enIA.join(' y ')} % y la app enseña ${p} %`);
          const enMotivo = [...String(o.motivo || '').matchAll(/titular probable \((\d{1,3}) %\)/g)].map((m) => +m[1]);
          if (enMotivo.some((x) => x !== p)) falla(`C: el motivo de ${o.j.nombre} dice titular probable (${enMotivo.join(', ')} %) y la app enseña ${p} %`);
        }
        for (const m of M.mercado) {
          const p = m.j && m.j.pos < 5 ? pApp(m.j) : null;
          const en = [...(m.por || []).join(' ').matchAll(/titular probable \((\d{1,3}) %\)/g)].map((x) => +x[1]);
          if (p != null && en.some((x) => x !== p)) falla(`C: Mercado dice de ${m.j.nombre} «titular probable (${en.join(', ')} %)» y a su lado ${p} %`);
        }

        /* --- D: los chollos de Mercado y el plan --- */
        const Sx = { ...S, D, M, plan: R, opPorPid: Object.fromEntries(vivas(R).filter((o) => o.pid).map((o) => [o.pid, o])) };
        for (const m of M.mercado) {
          if (m.tipo !== 'liga' || m.veredicto !== 'chollo' || m.miPuja) continue;
          n.chollos++;
          const df = M.decisionFichar(m.pid);
          if (!df) { falla(`D: Mercado llama «Chollo» a ${m.j.nombre} y el plan no dice nada de él`); continue; }
          if (df.accion === 'fichar') n.fichados++; else n.mirados++;
          if (df.accion === 'no' && !String(df.porque || '').trim()) falla(`D: el plan descarta a ${m.j.nombre} sin decir por qué`);
          const eti = Vi.etiquetaFichar(Sx, m.pid);
          if (df.accion === 'no' && eti === 'chollo') falla(`D: el plan no ficha a ${m.j.nombre} y Mercado lo sigue llamando «Chollo»`);
        }
        for (const d of R.descartes || []) {
          const t = Vi.breve(d.motivo);
          if (!t || t.length > 125) falla(`D: «Mirados» de ${d.jugador}, sin frase o larga (${t.length}): ${t}`);
        }
        if ((R.descartes || []).length > 10) falla(`D: ${R.descartes.length} en «Mirados y descartados»`);
        const dup = (R.descartes || []).map((d) => String(d.pid)).filter((x, i, xs) => xs.indexOf(x) !== i);
        if (dup.length) falla(`D: en «Mirados» sale dos veces el mismo (${dup.join(', ')})`);

        /* --- E: «lo mismo que» (forzado: la cláusula de uno que baja, a 3.000 € de lo que da LaLiga por él) --- */
        let ME = M;
        const xb = M.mias.find((x) => x.noBlindar && x.noBlindar.ol);
        if (xb) {
          const DE = JSON.parse(JSON.stringify(D));
          const fx = DE.plantillas[DE.yo.teamId].find((y) => String(y.pid) === String(xb.pid));
          if (fx) { fx.clausula = Math.round(xb.noBlindar.ol) + 3000; try { ME = analizar(DE, JSON.parse(JSON.stringify(H))); } catch (e) { ME = M; } }
        }
        for (const x of ME.mias) {
          if (!x.noBlindar) continue;
          const m = x.noBlindar.texto.match(/te pagan ([\d.,]+ (?:M|mil)), (más que|lo mismo que) vendiéndolo a LaLiga \(([\d.,]+ (?:M|mil))\)/);
          if (!m) continue;
          if (m[1] === m[3]) n.igual++;
          if ((m[1] === m[3]) !== (m[2] === 'lo mismo que')) falla(`E: ${x.j.nombre}: «${x.noBlindar.texto}»`);
        }

        /* --- B: el tiempo. El plan de la IA de ahora, repasado cuando ese jugador lleva más pujas --- */
        const pj = [...pujasDe(R)].sort((a, b) => (b.objetivo === 'titular') - (a.objetivo === 'titular'))[0];
        if (!pj) { n.sinPuja = (n.sinPuja || 0) + 1; continue; }
        const { lista } = I.idsCorto(R);
        const idDe = (lista.find((x) => x.k === pj._k) || {}).id;
        const antes = pj.importe, caja0 = +D.dinero, cu0 = I.cuadrarPlan(R, D, M);
        const queda0 = cu0.final;
        const json = { titular: `Hoy toca pujar ${U.eur(antes)} por ${pj.jugador}`, situacion: `Con ${U.eur(caja0)} en caja y unos ${U.eur(queda0)} al acabar el día, hoy buscamos mejorar el once. La puja por ${pj.jugador} es de ${U.eur(antes)}.`,
          pasos: lista.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: x.id === idDe ? `Puja ${U.eur(antes)}: vale la pena y tiene un 70 % de titular.` : 'Vale la pena.' })), quita: [], mete: [] };
        let A = null;
        try { A = I.aplicarCorto(json, R, D, M, c); } catch (e) { falla(`B: aplicarCorto se rompe: ${e.message}`); continue; }
        if (!A || (A.cambios && (A.cambios.rehecho || A.cambios.ajustado))) { n.rehecho = (n.rehecho || 0) + 1; continue; }
        const PIA = { ...A, modelo: 'x', t: Date.now(), dia: U.diaDe() };
        I.sellarPlan(PIA, D, M);
        // (en el mismo momento, nada cambia: ni la puja ni una cifra del titular ni de la situación)
        const ya = I.cuadrarPlan(PIA, D, M);
        if (ya.situacion !== PIA.situacion || ya.titular !== PIA.titular) falla(`B: recién hecho, la app le cambia el texto a la IA: «${ya.situacion}» / «${ya.titular}»`);
        // más tarde: tres pujas más por él y un poco más de valor (la app pujaría más)
        const D2 = JSON.parse(JSON.stringify(D)), H2 = JSON.parse(JSON.stringify(H));
        const m2 = D2.mercado.find((x) => String(x.pid) === String(pj.pid));
        if (!m2) continue;
        m2.pujas = (m2.pujas || 0) + 4;
        let M2, C, o2;
        try { M2 = analizar(D2, H2); C = I.cuadrarPlan(PIA, D2, M2); o2 = (C.ops || []).find((x) => x._k === pj._k); } catch (e) { continue; }
        // (si con más pujas la app no puja más, que también pasa, sale más caro: sube su valor y su precio de salida un 6 %)
        if (o2 && !o2.descartada && o2.importe === antes) {
          const j2 = D2.maestro[pj.pid];
          j2.valor = Math.round(j2.valor * 1.06); m2.precio = Math.round(m2.precio * 1.06);
          try { M2 = analizar(D2, H2); C = I.cuadrarPlan(PIA, D2, M2); o2 = (C.ops || []).find((x) => x._k === pj._k); } catch (e) { continue; }
        }
        if (!o2 || o2.descartada || o2.importe === antes) { n.igualPuja = (n.igualPuja || 0) + 1; continue; }   // no ha cambiado: no hay nada que mirar
        n.deriva++;
        const ahora = o2.importe, eA = U.eur(antes), eN = U.eur(ahora);
        if (eA === eN) continue;
        if (!/Subida de|La app la deja en/.test(o2.aviso || '')) falla(`B: la puja de ${pj.jugador} pasa de ${eA} a ${eN} y el paso no lo cuenta`);
        const pastillas = [...(o2.claves || []), (o2.datos || {}).cuanto || ''].join(' | ');
        if (pastillas.includes(`puja de ${eA}`)) falla(`B: las pastillas siguen con la puja de antes: «${pastillas.slice(0, 140)}» (el paso, ${eN})`);
        if (String(o2.motivo || '').includes(eA)) falla(`B: la frase de la IA sigue con la puja de antes: «${o2.motivo}» (el paso, ${eN})`);
        if (!String(o2.motivo || '').includes(eN)) falla(`B: la frase de la IA no dice la puja de ahora (${eN}): «${o2.motivo}»`);
        const sit = String(C.situacion || ''), tit = String(C.titular || '');
        const viejas = [eA, U.eur(queda0)].filter((x) => x !== eN && x !== U.eur(C.final) && x !== U.eur(caja0));
        for (const x of viejas) { if (sit.includes(x)) falla(`B: la situación sigue con ${x}: «${sit}» (ahora, puja ${eN} y quedan ${U.eur(C.final)})`); if (tit.includes(x)) falla(`B: el titular sigue con ${x}: «${tit}»`); }
        if (!sit.includes(U.eur(C.final))) falla(`B: la situación no dice lo que queda ahora (${U.eur(C.final)}): «${sit}»`);
        if (!sit.includes(U.eur(caja0))) falla(`B: la situación ha perdido el saldo (${U.eur(caja0)}), que no ha cambiado: «${sit}»`);
        if (cifras(sit).length !== cifras(PIA.situacion).length) falla(`B: la situación ha ganado o perdido cifras: «${PIA.situacion}» → «${sit}»`);
        // el % de titular de la frase, el de ahora
        const T2 = o2.j && !M2.alineacion(o2.j.id) ? M2.titularidad(o2.j) : null;
        if (T2 && T2.p != null) { const p2 = Math.round(T2.p * 100), en = [...String(o2.motivo).matchAll(/(\d{1,3}) % de titular/g)].map((x) => +x[1]); if (en.some((x) => x !== p2)) falla(`B: la frase dice ${en.join(', ')} % de titular y la app enseña ${p2} %`); }
      }

      /* --- F: los dos ayudantes, con textos a mano --- */
      const t1 = I.cifrasAlDia('Con 49,51 M en caja y unos 48,19 M al empezar la jornada; puja 1,32 M por uno que vale 1,27 M.', [[1320000, 1430000], [48190000, 48080000]], [49510000, 1270000]);
      if (t1 !== 'Con 49,51 M en caja y unos 48,08 M al empezar la jornada; puja 1,43 M por uno que vale 1,27 M.') fallos.push(`F: cifrasAlDia: «${t1}»`);
      const t2 = I.cifrasAlDia('Tienes 1,3 M de margen y pujas 1,3 M.', [[1320000, 1430000]], [1270000]);
      if (t2 !== 'Tienes 1,3 M de margen y pujas 1,3 M.') fallos.push(`F: cifrasAlDia toca una cifra que puede ser dos (${t2})`);
      const t3 = I.cifrasAlDia('Sube 250 mil al día y vale 12 M.', [[1320000, 1430000]], []);
      if (t3 !== 'Sube 250 mil al día y vale 12 M.') fallos.push(`F: cifrasAlDia toca lo que no ha cambiado (${t3})`);
      const t4 = I.cifrasAlDia('Te quedas en −3,20 M.', [[-3200000, -3310000]], []);
      if (t4 !== 'Te quedas en −3,31 M.') fallos.push(`F: cifrasAlDia con un negativo: «${t4}»`);
      const t5 = I.cifrasAlDia('Tienes 3,20 M.', [[3200000, -100000]], []);
      if (t5 !== 'Tienes −100 mil.') fallos.push(`F: cifrasAlDia, de positivo a negativo: «${t5}»`);
      const t6 = I.cifrasAlDia('Acabas en −3,20 M y debes 3,20 M.', [[-3200000, 500000]], []);
      if (t6 !== 'Acabas en 500 mil y debes 3,20 M.') fallos.push(`F: cifrasAlDia, de negativo a positivo: «${t6}»`);
      const ta = [['Es titular probable (70 %) y juega en casa.', 'Es titular probable (66 %) y juega en casa.'], ['Con un 70 % de titular, mejora tu once.', 'Con un 66 % de titular, mejora tu once.'], ['Titular ~70 % y sube un 2,5 % al día.', 'Titular ~66 % y sube un 2,5 % al día.'],
        ['Es titular con un 5 % sobre su valor.', 'Es titular con un 5 % sobre su valor.'], ['Sube un 3 % y es titular.', 'Sube un 3 % y es titular.'], ['Tiene un 70 % de opciones de ser titular.', 'Tiene un 66 % de opciones de ser titular.']];
      for (const [a, b] of ta) { const x = I.titularAlDia(a, 66.2); if (x !== b) fallos.push(`F: titularAlDia: «${a}» → «${x}»`); }
      return { fallos, n };
    }, { N, SEM, escena });
    for (const f of r.fallos.slice(0, 14)) console.log(`MAL  ${f}`);
    if (r.fallos.length > 14) console.log(`     … y ${r.fallos.length - 14} más`);
    mal += r.fallos.length;
    const k = r.n;
    ok(!r.fallos.length, `${escena}: ${k.planes} planes, ${k.pujas} pujas (una sola cada una), ${k.deriva} repasados con la puja ya cambiada, ${k.tit} % de titular, ${k.chollos} chollos de Mercado (${k.fichados} en el plan, ${k.mirados} mirados con su porqué), ${k.igual} «lo mismo que» (${k.igualPuja || 0} sin cambio de puja, ${k.sinPuja || 0} sin ninguna puja, ${k.rehecho || 0} rehechos)${P.errores.length ? ` · errores de la página: ${P.errores.slice(0, 2).join(' | ')}` : ''}`);
  } finally { await P.cerrar(); }
}
await cerrar();
console.log(mal ? `${mal} fallos` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
