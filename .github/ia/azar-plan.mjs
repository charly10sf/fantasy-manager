// El plan a prueba de azar (15 nov, tras el «no cuadra» de Carlos): la liga de ejemplo, removida al azar cientos de veces
// (saldo, pujas puestas, cláusulas y protecciones tuyas y de los rivales, lo comprado para revender, lesionados, plantilla
// casi llena), en cada momento de la semana. No hay IA ni red. En cada liga removida se comprueba lo que no puede fallar:
//   1. el motor monta su plan sin romperse (no cae al plan de antes) y con las cuentas de verdad;
//   2. lo que se enseña no lleva nada tachado por la app;
//   3. una IA que no cambia nada NUNCA tira el plan, y el plan sale con los mismos pasos, sin tener que rehacerlo;
//   4. una IA que quita y mete al azar tampoco lo tira, y lo que sale no lleva nada tachado;
//   5. si la IA tarda (20 min, 3 h, 26 h: el mercado cambia, las cláusulas se cierran), el plan sale igual;
//   6. si el plan de la app ya no vale para la liga de ahora (el de la liga removida anterior: otro saldo, otros
//      jugadores, otras cláusulas), el plan sale igual: se rehace con el motor y no lleva nada tachado.
// Uso: node .github/ia/azar-plan.mjs [vueltas por escenario, 40] [semilla, 1]   (PW_MODULO como en prueba-web.mjs)
// Sale con 1 si algo falla, y dice la semilla y la vuelta para repetirlo.
import { pagina, cerrar } from './banco.mjs';

const N = Number(process.argv[2]) || 40, SEMILLA = Number(process.argv[3]) || 1;
const ESCENAS_AZAR = ['martes', 'veda', 'enjuego', 'paron', 'm-cierre', 'm-reventa'];
let mal = 0, total = 0;
const resumen = {};
for (const escena of ESCENAS_AZAR) {
  const P = await pagina(escena);
  try {
    const r = await P.page.evaluate(async ({ N, SEMILLA, escena }) => {
      const I = await import('./js/ia.js'), Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js');
      const S = window.S;
      for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
      const f = S.fuentes || {};
      const D0 = JSON.stringify(S.D), H0 = JSON.stringify(S.H);
      const fallos = [], cuenta = { planes: 0, pasos: 0, vetos: 0, rehechos: 0, viejos: 0, quita: 0, mete: 0 };
      const avisos = [];
      const warn = console.warn; console.warn = (...a) => { avisos.push(a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 400)); };
      const ahora0 = Date.now();
      let Rantes = null;
      for (let v = 0; v < N; v++) {
        // un azar que se puede repetir (mulberry32)
        let s = (SEMILLA * 1000003 + v * 7919 + escena.length * 31) >>> 0;
        const az = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const uno = (xs) => xs[Math.floor(az() * xs.length)];
        const D = JSON.parse(D0), H = JSON.parse(H0);
        const yo = D.yo.teamId, mios = D.plantillas[yo];
        const cambios = [];
        D.dinero = Math.round((az() < 0.25 ? -30 + az() * 30 : az() * 150) * 1e6); cambios.push(`saldo ${D.dinero}`);
        for (const m of D.mercado) { if (az() < 0.5) m.miPuja = null; else if (az() < 0.15 && m.precio) { m.miPuja = Math.round(m.precio * (1 + az() * 0.2)); cambios.push(`puja ${m.pid}`); } }
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
        // a veces, la plantilla casi llena
        if (az() < 0.15) {
          const con = new Set(Object.values(D.plantillas).flat().map((x) => x.pid)), enM = new Set(D.mercado.map((m) => m.pid));
          const libres = Object.values(D.maestro).filter((j) => !con.has(j.id) && !enM.has(j.id) && j.pos !== 5).sort((a, b) => a.valor - b.valor).slice(0, uno([8, 9, 10]));
          for (const j of libres) mios.push({ pid: j.id, ptId: `pt${j.id}`, clausula: Math.round(j.valor * 1.6), protegidoHasta: ahora0 + 10 * 864e5, compra: j.valor });
          cambios.push(`plantilla ${mios.length}`);
        }
        const donde = `${escena} · semilla ${SEMILLA} · vuelta ${v} (${cambios.join(', ')})`;
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
        cuenta.pasos += (R.ops || []).filter((o) => o._k).length; cuenta.vetos += (R.vetos || []).length;
        // 3
        const { lista } = I.idsCorto(R);
        const neutra = { titular: 'Plan de hoy', situacion: 'Todo en orden.', pasos: lista.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: 'Vale la pena.' })), quita: [], mete: [] };
        let A = null;
        try { A = I.aplicarCorto(neutra, R, D, M, c); } catch (e) { falla(`aplicarCorto se rompe sin que la IA cambie nada: ${e.message}`); }
        if (!A) falla('la IA no cambia nada y el plan no sale');
        else {
          if (A.cambios && A.cambios.rehecho) falla(`la IA no cambia nada y el plan hay que rehacerlo: ${A.cambios.rehecho}`);
          else if (ks(A) !== ks(R)) falla(`la IA no cambia nada y los pasos cambian: [${ks(R)}] → [${ks(A)}]`);
          const cu = I.cuadrarPlan(A, D, M);
          if (tach(cu).length) falla(`el plan con la IA lleva algo tachado: ${tach(cu).join('; ')}`);
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
          if (B.cambios.rehecho) falla(`con cambios al azar hay que rehacer el plan: ${B.cambios.rehecho}`);
          const cu = I.cuadrarPlan(B, D, M);
          if (tach(cu).length) falla(`el plan con cambios al azar lleva algo tachado: ${tach(cu).join('; ')}`);
          if (R.cuentas && R.cuentas.jornada >= 0 && B.cuentas && B.cuentas.jornada < 0) falla('con los cambios de la IA la jornada empezaría en negativo');
        }
        // 5 (el reloj de la página es de mentira: se adelanta y se vuelve a poner)
        for (const salto of [20 * 60e3, 3 * 3600e3, 26 * 3600e3]) {
          const real = Date.now;
          Date.now = () => real() + salto;
          let T = null;
          try { T = I.aplicarCorto(neutra, R, D, M, c); if (T && T.cambios.rehecho) cuenta.rehechos++; } catch (e) { falla(`+${salto / 60e3} min: aplicarCorto se rompe: ${e.message}`); }
          if (!T) falla(`+${salto / 60e3} min: el plan no sale`);
          else { try { const cu = I.cuadrarPlan(T, D, M); if (tach(cu).length) falla(`+${salto / 60e3} min: lleva algo tachado: ${tach(cu).join('; ')}`); } catch (e) { falla(`+${salto / 60e3} min: cuadrarPlan se rompe: ${e.message}`); } }
          Date.now = real;
        }
        // 6
        if (Rantes) {
          const li = I.idsCorto(Rantes).lista;
          const vieja = { titular: 'Plan de hoy', situacion: 'Todo en orden.', pasos: li.filter((x) => !x.alt).map((x) => ({ id: x.id, frase: 'Vale la pena.' })), quita: li.filter((x) => !x.alt && az() < 0.3).map((x) => ({ id: x.id, motivo: 'Lesionado.' })), mete: [] };
          let V = null;
          try { V = I.aplicarCorto(vieja, Rantes, D, M, c); } catch (e) { falla(`con un plan que ya no vale, aplicarCorto se rompe: ${e.message}`); }
          if (!V) falla('con un plan que ya no vale, el plan no sale');
          else { if (V.cambios.rehecho) cuenta.viejos++; try { const cu = I.cuadrarPlan(V, D, M); if (tach(cu).length) falla(`con un plan que ya no vale, lleva algo tachado: ${tach(cu).join('; ')}`); } catch (e) { falla(`con un plan que ya no vale, cuadrarPlan se rompe: ${e.message}`); } }
        }
        Rantes = R;
      }
      console.warn = warn;
      return { fallos, cuenta };
    }, { N, SEMILLA, escena });
    total += r.cuenta.planes; mal += r.fallos.length; resumen[escena] = r.cuenta;
    for (const f of r.fallos.slice(0, 12)) console.log(`MAL  ${f}`);
    if (r.fallos.length > 12) console.log(`     … y ${r.fallos.length - 12} más en ${escena}`);
    console.log(`${r.fallos.length ? 'MAL ' : 'BIEN'} ${escena}: ${r.cuenta.planes} ligas, ${r.cuenta.pasos} pasos, ${r.cuenta.vetos} vetos de la app, ${r.cuenta.quita} quitados y ${r.cuenta.mete} metidos por la «IA», ${r.cuenta.rehechos} rehechos por el paso del tiempo y ${r.cuenta.viejos} por venir de otra liga${P.errores.length ? ` · errores de la página: ${P.errores.slice(0, 2).join(' | ')}` : ''}`);
  } finally { await P.cerrar(); }
}
await cerrar();
console.log(`${total} ligas al azar, ${mal} fallos`);
process.exit(mal ? 1 : 0);
