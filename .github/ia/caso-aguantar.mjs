// (24 nov, aviso de Domy: «no puede ser que la app te descarte jugadores que están subiendo millones») Su liga un martes,
// reproducida con la de ejemplo: 324 M de saldo y, libres en el mercado, Bartra (39,5 M, +3,6 % al día) y Pepelu (58,4 M,
// +1,8 %). En su liga a los que suben así se los llevan con un +13-20 % sobre su valor: a esa puja no da tiempo a
// revenderlos antes de la jornada y los dos salían en «Mirados y descartados», Bartra con un «para tenerlo, sí».
// Lo que tiene que pasar ahora:
//  - Bartra va en el plan, para aguantarlo (pagado con saldo; se revende cuando deje de subir), con sus cuentas;
//  - Pepelu sigue descartado: lo pagado de más no se recupera;
//  - con poco saldo (habría que tirar de deuda), Bartra no va en el plan y «Mirados» dice que hoy no llega;
//  - al día siguiente, con Bartra ya fichado, el plan no lo manda vender antes de la jornada.
// Y lo de Carlos del mismo día (11:58, con capturas: «una cantidad ingente de texto» y «¿cómo puede recomendar a Pepelu en
// Equipo y descartarlo en el plan?»):
//  - cada «Mirado y descartado» es UNA frase de 125 caracteres como mucho (las cuentas enteras quedan en `detalle`, para la IA);
//  - Equipo → «Lo flojo de tu once» no propone como fichaje a quien el plan ha descartado.
// Sin IA ni red. Uso: node .github/ia/caso-aguantar.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import { pagina, cerrar, arbitro } from './banco.mjs';

const P = await pagina('martes');
await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
let mal = 0;
try {
  const r = await P.page.evaluate(async () => {
    const Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js'), Vi = await import('./js/vistas.js');
    const arbitro = window.__arbitro;
    const S = window.S;
    for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
    const f = S.fuentes || {};
    const ahora = Date.now(), DIA = 864e5;
    let sem = 11;
    const az = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    const serie = (hasta, valor, sube, dias = 30) => { const s = []; let v = valor; for (let k = 0; k <= dias; k++) { s.unshift([U.diaDe(hasta - k * DIA), Math.round(v)]); v /= 1 + sube; } return s; };
    const montar = (dinero) => {
      const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H)), det = { ...(S.det || {}) };
      D.dinero = dinero;
      const yo = D.yo.teamId;
      for (const m of D.mercado) m.miPuja = null;
      D.misVentas = []; D.mercado = D.mercado.filter((m) => m.vendedorTeamId !== yo);
      const libres = D.mercado.filter((m) => m.tipo === 'liga');
      const dos = [['Bartra', 2, 39.51e6, 39.1e6, 0.036, 5.4], ['Pepelu', 3, 58.42e6, 57.9e6, 0.018, 5.8]];
      const pidDe = {};
      dos.forEach(([nombre, pos, valor, precio, sube, media], i) => {
        const m = libres[[0, 1][i]], j = D.maestro[m.pid];
        Object.assign(j, { nombre, pos, valor, media, estado: 'ok' });
        m.precio = precio; m.pujas = 1;
        // (lleva dos semanas subiendo así; antes, plano)
        H.v[m.pid] = serie(ahora - 15 * DIA, valor / Math.pow(1 + sube, 14), 0, 20).concat(serie(ahora - DIA, valor / (1 + sube), sube, 13));
        D.tendencias[m.pid] = { d1: Math.round(valor * sube / (1 + sube)), p1: sube / (1 + sube) * 100, d7: null, p7: null, ffValor: valor };
        delete det[m.pid];
        pidDe[nombre] = m.pid;
      });
      // las compras de la liga (como en caso-pujas): los que no suben, +3-8 %; los que suben fuerte, +12-20 %
      const molde = Object.values(D.maestro)[0];
      const otros = Array.from({ length: 36 }, (_, i) => (D.maestro[`9${i}00`] = { ...molde, id: `9${i}00`, nombre: `Comprado ${i}`, estado: 'ok' }));
      const rivales = D.clasif.filter((e) => e.teamId !== yo);
      D.actividad = D.actividad.filter((a) => !(a.clase === 'compra' && !a.otroId && !a.otro));
      for (let i = 0; i < 36; i++) {
        const j = otros[i], t = ahora - (5 + i) * DIA - 2 * 3600e3;
        const fuerte = i % 3 !== 0;
        const sube = fuerte ? 0.016 + az() * 0.022 : 0.001 * (az() - 0.3);
        const v = 25e6 + az() * 45e6;
        H.v[j.id] = serie(t, v, sube).concat(serie(ahora - DIA, v, 0).filter(([d]) => d > U.diaDe(t)));
        j.valor = v;
        delete det[j.id];
        const s = fuerte ? 0.12 + az() * 0.08 : 0.03 + az() * 0.05;
        const q = rivales[i % rivales.length];
        D.actividad.push({ id: `cp${i}`, t, tipo: 31, clase: 'compra', quien: q.manager, quienId: q.userId, otro: '', otroId: '', pid: j.id, jugador: j.nombre, importe: Math.round(v * (1 + s)), texto: '' });
      }
      return { D, H, det, pidDe, yo };
    };
    const ext = (det, mas = {}) => ({ det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, ...mas });
    const eur = U.eur;
    const mirar = (D, M, R, pidDe) => {
      const L = [];
      const de = (n) => {
        const pid = pidDe[n], nr = M.noRevender[pid], e = M.especular.find((x) => x.pid === pid), m = M.mercado.find((x) => x.pid === pid);
        const op = (R.ops || []).find((o) => o.pid === pid && !o.descartada);
        const mir = (R.descartes || []).find((d) => d.pid === pid);
        L.push(`${n}: vale ${eur(m.j.valor)} · puja ${eur(m.puja)} (gana ${eur(m.pujaGana)}) · ${e ? `ESPECULAR ${eur(e.puja)} → ${eur(e.valorFuturo)}` : nr ? `no revender: ${eur(nr.puja)} → ${eur(nr.valorFuturo)} (${eur(nr.beneficio, { signo: true })}), r ${(nr.r * 100).toFixed(2)} %, tener ${JSON.stringify(nr.tener && { dias: nr.tener.dias, deMas: Math.round(nr.tener.deMas) })}, aguantar ${nr.aguantar ? `${eur(nr.aguantar.valorFuturo)} (${eur(nr.aguantar.beneficio, { signo: true })}), recupera en ${nr.aguantar.recupera} d` : 'no'}` : 'ni especular ni noRevender'}`);
        if (op) L.push(`   OP ${op.accion} ${eur(op.puja_max || op.importe)} [${op.objetivo}${op.aguantar ? ', aguantar' : ''}] ${op.aviso ? `| ${op.aviso} ` : ''}— ${op.motivo}`);
        if (mir) L.push(`   MIRADO: ${Vi.breve(mir.motivo)}\n      (para la IA: ${mir.detalle || '—'})`);
        return { nr: nr ? { puja: nr.puja, aguantar: nr.aguantar || null, tener: nr.tener } : null, esp: !!e, op: op ? { accion: op.accion, objetivo: op.objetivo, aguantar: !!op.aguantar, puja: op.puja_max, ben: op.beneficio_esperado, motivo: op.motivo, vender_el: op.vender_el || null } : null, mirado: mir ? Vi.breve(mir.motivo) : null, detalle: mir ? mir.detalle || '' : null };
      };
      const x = { Bartra: de('Bartra'), Pepelu: de('Pepelu') };
      L.push(`PLAN: ${R.titular}`);
      for (const o of R.ops || []) if (!x.Bartra.op || o.pid !== pidDe.Bartra) L.push(`   op ${o.descartada ? '(descartada) ' : ''}${o.accion} ${o.jugador || ''} ${o.puja_max ? eur(o.puja_max) : o.importe ? eur(o.importe) : ''} [${o.objetivo || ''}]`);
      const arb = arbitro(R, D, M, eur);
      const reglas = arb.find((l) => l.startsWith('REGLAS')) || '', jornada = arb.find((l) => l.startsWith('JORNADA')) || '';
      L.push(`   ${reglas} · ${jornada}`);
      // lo que se ve en «Mirados y descartados»: una frase cada uno
      const vistos = (R.descartes || []).map((d) => `${d.jugador}: ${Vi.breve(d.motivo)}`);
      for (const v of vistos) L.push(`   mirado · ${v}`);
      return { ...x, titular: R.titular, reglas, L, largos: (R.descartes || []).map((d) => Vi.breve(d.motivo)).filter((t) => t.length > 125 || !t || (t.match(/\. [A-ZÁÉÍÓÚ]/g) || []).length > 0) };
    };
    const out = {};
    // 1) con 324 M: Bartra al plan, Pepelu descartado
    {
      const { D, H, det, pidDe } = montar(324e6);
      const M = Mo.analizar(D, H, S.c, ext(det));
      const R = Pm.planDeHoy(D, M, Dt.cfg());
      out.rico = mirar(D, M, R, pidDe);
      // lo que lee la IA de Bartra y el veredicto de la app
      const V = I.veredictos(D, M), v = V[`P-${pidDe.Bartra}`];
      out.rico.ver = v ? { ok: v.ok, para: v.para, aguantar: !!v.aguantar } : null;
      const ctx = I.contexto(D, M, Dt.cfg()), txt = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
      out.rico.ia = txt.split('\n').filter((l) => /PUJAR por Bartra/.test(l)).map((l) => l.slice(0, 1400));
      // Equipo → «Lo flojo de tu once»: un centrocampista suyo con pocas opciones de jugar y Pepelu como el mejor del
      // mercado en su puesto. Sin mirar el plan salía Pepelu (la captura de Carlos); con el plan, no (está descartado)
      const flojo = M.mias.map((x) => x.j).filter((j) => j.pos === 3).sort((a, b) => M.ppEsperado(b) - M.ppEsperado(a))[0];
      const tit0 = M.titularidad, pp0 = M.ppEsperado;
      M.titularidad = (j) => (j.id === flojo.id ? { p: 0.4 } : j.id === pidDe.Pepelu ? { p: 0.92 } : tit0(j));
      M.ppEsperado = (j) => (j.id === pidDe.Pepelu ? 9 : pp0(j));
      const once = M.mias.map((x) => x.j).filter((j) => j.pos < 5);
      const sin = Vi.veredictoOnce(M, once, null, null).flojos.find((x) => x.j.id === flojo.id), con = Vi.veredictoOnce(M, once, null, R).flojos.find((x) => x.j.id === flojo.id);
      M.titularidad = tit0; M.ppEsperado = pp0;
      out.rico.flojo = { quien: flojo.nombre, sinPlan: sin && sin.m ? sin.m.j.nombre : null, conPlan: con && con.m ? con.m.j.nombre : null, descartados: (R.descartes || []).map((d) => d.jugador), fichados: (R.ops || []).filter((o) => !o.descartada && ['pujar', 'clausular', 'comprar'].includes(o.accion)).map((o) => o.jugador) };
      out.rico.L.push(`EQUIPO, lo flojo: ${flojo.nombre} → sin mirar el plan ${out.rico.flojo.sinPlan}; con el plan ${out.rico.flojo.conPlan}`);
      // el recorte de frases, con las de las capturas
      out.breves = ['No hace falta hoy: venderías perdiendo 945 mil de lo que pagaste y quedan 3 cambios de mercado antes de la jornada 14 (vie 27, 21:00), con una oferta nueva de LaLiga en cada uno…', 'Te da 1,3 pts por jornada y aún no baja todos los días: se aguanta. Si sigue bajando, toca ponerlo a la venta. Esta temporada ha ido de 62,99 M a 65,64 M.', 'La app lo descarta: pagarías 6,11 M más de lo que vale (+15,5 %), sobrecoste 80/100, y para lo que aporta solo compensaría hasta 60/100.', 'Sale por C. Soler y no hay más.'].map((t) => Vi.breve(t));
    }
    // 2) con 20 M: para pujar los 46 M habría que tirar de deuda → no va; «Mirados» dice que hoy no llega
    {
      const { D, H, det, pidDe } = montar(20e6);
      const M = Mo.analizar(D, H, S.c, ext(det));
      const R = Pm.planDeHoy(D, M, Dt.cfg());
      out.pobre = mirar(D, M, R, pidDe);
      out.pobre.pujaMax = M.pujaMax;
    }
    // 3) al día siguiente, Bartra ya es suyo (pagado a la puja, apuntado para revender, 13 días de cláusula cerrada y
    //    valiendo menos de lo pagado): el plan no lo vende antes de la jornada
    {
      const { D, H, det, pidDe, yo } = montar(324e6 - 46e6);
      const pid = pidDe.Bartra;
      D.mercado = D.mercado.filter((m) => m.pid !== pid);
      const valor = D.maestro[pid].valor;
      D.plantillas[yo].push({ pid, ptId: `pt${pid}`, clausula: Math.round(valor * 1.17), protegidoHasta: ahora + 13 * DIA, compra: 46.19e6 });
      const M = Mo.analizar(D, H, S.c, ext(det, { reventa: { [pid]: { t: ahora - DIA, precio: 46.19e6 } } }));
      const R = Pm.planDeHoy(D, M, Dt.cfg());
      const x = M.mias.find((y) => y.pid === pid);
      const vende = (R.ops || []).find((o) => o.pid === pid && o.accion === 'vender' && !o.descartada);
      const arb = arbitro(R, D, M, eur);
      out.despues = { esMio: !!x, paraRevender: !!(M.paraRevender || []).find((y) => y.pid === pid), aguanta: x ? !!M.aguantaReventa(x) : null, vende: vende ? vende.motivo : null, reglas: arb.find((l) => l.startsWith('REGLAS')) || '', L: [`DESPUÉS: Bartra mío ${!!x}, aguanta ${x ? M.aguantaReventa(x) : '?'}, plan: ${R.titular}${vende ? ` · VENDE: ${vende.motivo}` : ''}`] };
    }
    return out;
  });
  for (const k of ['rico', 'pobre', 'despues']) console.log(`--- ${k} ---\n${r[k].L.join('\n')}`);
  console.log(`veredicto de Bartra: ${JSON.stringify(r.rico.ver)}`);
  console.log(`lo que lee la IA: ${r.rico.ia.join(' // ')}`);
  const ok = (c, t) => { console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); if (!c) mal++; };
  const B = r.rico.Bartra, Pe = r.rico.Pepelu;
  ok(!!(B.nr && B.nr.aguantar) && !B.esp, 'Bartra: antes de la jornada no sale revenderlo, aguantándolo sí');
  ok(B.nr && B.nr.aguantar && B.nr.aguantar.recupera <= 7 && B.nr.aguantar.beneficio >= B.nr.puja * 0.025, `Bartra: lo pagado de más se recupera en 7 días o menos y a los 10 se gana (${B.nr && B.nr.aguantar ? `${B.nr.aguantar.recupera} d, ${Math.round(B.nr.aguantar.beneficio)}` : '—'})`);
  ok(!!B.op && B.op.accion === 'pujar' && B.op.objetivo === 'revender' && B.op.aguantar, 'con 324 M, el plan puja por Bartra para aguantarlo');
  ok(!!B.op && Math.abs(B.op.puja - B.nr.puja) < 1e4 && B.op.ben > 0, `la puja es la que gana en su liga y el beneficio, el de la app (${B.op ? `${B.op.puja}, ${B.op.ben}` : '—'})`);
  ok(!!B.op && /aguantarlo/.test(B.op.motivo) && /saldo/.test(B.op.motivo) && /deje de subir/.test(B.op.motivo) && !B.op.vender_el, 'el paso dice que es para aguantarlo, que se paga con saldo y cuándo venderlo, sin día de venta');
  ok(!B.mirado, 'Bartra ya no sale en «Mirados y descartados»');
  ok(/aguantarlo/.test(r.rico.titular), `el titular lo dice (${r.rico.titular})`);
  ok(/REGLAS: ok/.test(r.rico.reglas), `el árbitro da el plan por bueno (${r.rico.reglas})`);
  ok(!!r.rico.ver && r.rico.ver.ok && r.rico.ver.aguantar && /aguantarlo/.test(r.rico.ver.para), `el veredicto de la app para la IA: vale para ${r.rico.ver && r.rico.ver.para}`);
  ok(r.rico.ia.some((l) => /AGUANTÁNDOLO SÍ SALE/.test(l)), 'la IA lee que aguantándolo sí sale');
  ok(!!(Pe.nr && !Pe.nr.aguantar) && !Pe.op && !!Pe.mirado && /no recuperas/.test(Pe.mirado) && /solo si lo quieres para tu once/.test(Pe.detalle), `Pepelu (+1,8 % al día) sigue descartado, en una frase: «${Pe.mirado}»`);
  ok(![Pe.mirado, Pe.detalle].some((t) => /Para tenerlo, sí/.test(t || '')), 'ningún descartado dice «para tenerlo, sí»');
  const b2 = r.pobre.Bartra;
  ok(!b2.op && !!b2.mirado && /Aguantándolo 10 días ganarías/.test(b2.mirado) && /tienes 20,00 M/.test(b2.mirado) && /Hoy no te llega/.test(b2.detalle), `con 20 M (puede pujar hasta ${Math.round(r.pobre.pujaMax / 1e4) / 100} M con deuda), Bartra no va en el plan y «Mirados» dice que con el saldo no llega: «${b2.mirado}»`);
  for (const k of ['rico', 'pobre']) ok(!r[k].largos.length, `${k}: cada «Mirado y descartado» es una frase de 125 caracteres como mucho${r[k].largos.length ? ` (${r[k].largos.join(' | ')})` : ''}`);
  console.log(r.breves.map((t) => `   breve · ${t}`).join('\n'));
  ok(r.breves.every((t) => t.length <= 125 && /\.$/.test(t) && !/…/.test(t)) && r.breves[0] === 'No hace falta hoy: venderías perdiendo 945 mil de lo que pagaste y quedan 3 cambios de mercado antes de la jornada 14.' && r.breves[1] === 'Te da 1,3 pts por jornada y aún no baja todos los días: se aguanta.' && /^Pagarías 6,11 M/.test(r.breves[2]) && r.breves[3] === 'Sale por C. Soler y no hay más.', 'el recorte deja una frase entera, sin puntos suspensivos ni «La app lo descarta», y no corta en la inicial de un nombre');
  const F = r.rico.flojo;
  ok(F.sinPlan === 'Pepelu' && F.conPlan !== 'Pepelu' && F.descartados.includes('Pepelu'), `Equipo no propone para lo flojo del once (${F.quien}) a quien el plan descarta: sin mirar el plan salía ${F.sinPlan}; ahora, ${F.conPlan || '«Ver sustitutos»'}`);
  ok(!F.conPlan || !F.descartados.includes(F.conPlan), 'y el que propone no está entre los descartados del plan');
  ok(/REGLAS: ok/.test(r.pobre.reglas), `con 20 M, el árbitro da el plan por bueno (${r.pobre.reglas})`);
  ok(r.despues.esMio && r.despues.paraRevender && r.despues.aguanta && !r.despues.vende, 'al día siguiente, con Bartra fichado (vale menos de lo pagado, cláusula cerrada 13 días), el plan no lo vende');
  ok(/REGLAS: ok/.test(r.despues.reglas), `y el árbitro da ese plan por bueno (${r.despues.reglas})`);
} finally { await P.cerrar(); await cerrar(); }
process.exit(mal ? 1 : 0);
