// La liga de Carlos reproducida (16 nov, «que la puja aprenda sola»): parón, 114 M y 13 jugadores; en el mercado, Valverde
// (86 M, sale a 83,7 M, +2,9 % al día), Unai López (32,1/31,7 M, +1,3 %) y Pepe (27,3/26,9 M, +1,2 %). En su liga los
// que suben fuerte y los top se pagan bastante por encima de la media: aquí, las compras de las últimas semanas van así
// (los que no suben, +3-8 %; los que suben más de un 1,2 % al día, +12-22 %; los top que suben, +15-25 %) y de sus
// últimas 5 pujas perdió 4. Sin IA ni red. Dice la puja de la app para cada uno (con y sin lo aprendido), con cuánto se
// gana y lo que dice el plan.
// Uso: node .github/ia/caso-pujas.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si no se cumple lo de abajo.
import { pagina, cerrar } from './banco.mjs';

import { calPujas } from '../../worker/src/index.js';

const P = await pagina('paron');
{
  const regs = [];
  for (let i = 0; i < 12; i++) regs.push({ s: 0.04 + i * 0.003, v: 30e6, r: 0.001, top: false }, { s: 0.14 + i * 0.004, v: 30e6, r: 0.015, top: false }, { s: 0.2 + i * 0.004, v: 90e6, r: 0.025, top: true });
  await P.page.evaluate((cal) => { window.__calPujas = cal; }, calPujas(regs));
}
let mal = 0;
try {
  const r = await P.page.evaluate(async () => {
    const Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js');
    const S = window.S;
    for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
    const f = S.fuentes || {};
    const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H)), det = { ...(S.det || {}) };
    const ahora = Date.now(), DIA = 864e5;
    let sem = 7;
    const az = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    const serie = (pid, hasta, valor, sube) => { const s = []; let v = valor; for (let k = 0; k <= 30; k++) { s.unshift([U.diaDe(hasta - k * DIA), Math.round(v)]); v /= 1 + sube; } return s; };
    D.dinero = 114e6;
    const yo = D.yo.teamId;
    D.plantillas[yo] = D.plantillas[yo].slice(0, 13);
    for (const m of D.mercado) m.miPuja = null;
    D.misVentas = []; D.mercado = D.mercado.filter((m) => m.vendedorTeamId !== yo);
    // los tres del mercado
    const libres = D.mercado.filter((m) => m.tipo === 'liga');
    const tres = [['Valverde', 3, 86e6, 83.7e6, 0.029, 6.8, 2], ['Unai López', 3, 32.1e6, 31.7e6, 0.013, 5.6, 1], ['Pepe', 4, 27.3e6, 26.9e6, 0.012, 5.2, 1]];
    const pidDe = {};
    tres.forEach(([nombre, pos, valor, precio, sube, media, pujas], i) => {
      const m = libres[[0, 1, 8][i]], j = D.maestro[m.pid];
      Object.assign(j, { nombre, pos, valor, media, estado: 'ok' });
      m.precio = precio; m.pujas = pujas;
      H.v[m.pid] = serie(m.pid, ahora - DIA, valor / (1 + sube), sube);
      D.tendencias[m.pid] = { d1: Math.round(valor * sube / (1 + sube)), p1: sube / (1 + sube) * 100, d7: null, p7: null, ffValor: valor };
      delete det[m.pid];
      pidDe[nombre] = m.pid;
    });
    // las compras de la liga: fuera las de la demo y 36 nuevas, de hace 5 a 40 días
    // (jugadores inventados, uno por compra, para que su histórico no lo toque nada más)
    const molde = Object.values(D.maestro)[0];
    const otros = Array.from({ length: 36 }, (_, i) => (D.maestro[`9${i}00`] = { ...molde, id: `9${i}00`, nombre: `Comprado ${i}`, estado: 'ok' }));
    const rivales = D.clasif.filter((e) => e.teamId !== yo);
    D.actividad = D.actividad.filter((a) => !(a.clase === 'compra' && !a.otroId && !a.otro));
    const compras = [];
    for (let i = 0; i < 36; i++) {
      const j = otros[i], t = ahora - (5 + i) * DIA - 2 * 3600e3;
      const tipo = i % 3; // 0: no sube, 1: sube fuerte, 2: top que sube
      const sube = tipo === 0 ? 0.001 * (az() - 0.3) : 0.014 + az() * 0.016;
      const v = tipo === 2 ? 45e6 + az() * 50e6 : 8e6 + az() * 40e6;
      H.v[j.id] = serie(j.id, t, v, sube).concat(serie(j.id, ahora - DIA, v, 0).filter(([d]) => d > U.diaDe(t)));
      j.valor = v;
      delete det[j.id];
      const s = tipo === 0 ? 0.03 + az() * 0.05 : tipo === 1 ? 0.12 + az() * 0.1 : 0.15 + az() * 0.1;
      const q = rivales[i % rivales.length];
      compras.push({ id: `cp${i}`, t, tipo: 31, clase: 'compra', quien: q.manager, quienId: q.userId, otro: '', otroId: '', pid: j.id, jugador: j.nombre, importe: Math.round(v * (1 + s)), texto: '' });
    }
    D.actividad.push(...compras);
    // sus 5 últimas pujas: perdió 4 (pujó un +6 % y se lo llevaron con lo de arriba) y ganó una
    const pujasMias = {};
    compras.filter((c, i) => i % 3 !== 0).slice(0, 5).forEach((c, i) => {
      const v = H.v[c.pid].filter(([d]) => d <= U.diaDe(c.t)).pop()[1];
      if (i === 4) { c.quien = D.yo.nombre; c.quienId = D.yo.userId; }
      pujasMias[`${c.pid}|${c.t}`] = { pid: c.pid, puja: i === 4 ? c.importe : Math.round(v * 1.06), valor: v, precio: v, cierra: c.t, t: c.t - 6 * 3600e3 };
    });
    const ext = { det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones };
    const antes = Mo.analizar(D, H, S.c, ext);
    const M = Mo.analizar(D, H, S.c, { ...ext, pujasMias });
    const R = Pm.planDeHoy(D, M, Dt.cfg());
    const eur = U.eur, pc = (x) => (x == null ? '?' : `${(x * 100).toFixed(1)} %`);
    const L = [];
    L.push(`parón: ${!!M.enParon} · saldo ${eur(D.dinero)} · corte top ${eur(M.corteTop)} · mis pujas ${JSON.stringify(M.misPujasRes && { n: M.misPujasRes.n, ganadas: M.misPujasRes.ganadas, ajuste: +M.misPujasRes.ajuste.toFixed(3), falta: M.misPujasRes.falta && +M.misPujasRes.falta.toFixed(3) })}`);
    const filas = {};
    for (const [nombre] of [...tres, ['Cubarsí']]) {
      if (!pidDe[nombre]) pidDe[nombre] = Object.values(D.maestro).find((j) => j.nombre === nombre).id;
      const pid = pidDe[nombre], m = M.mercado.find((x) => x.pid === pid), mA = antes.mercado.find((x) => x.pid === pid), j = m.j;
      const PV0 = M.pagaLiga(j.valor), PV = M.pagaLiga(j.valor, pid), pf = M.perfilPuja(pid);
      const e = M.especular.find((x) => x.pid === pid), nr = M.noRevender[pid];
      filas[nombre] = { puja: m.puja, pujaGana: m.pujaGana, pujaAntes: mA.puja, pujaGanaAntes: mA.pujaGana, pGana: m.pGana, med: PV && PV.med, med0: PV0 && PV0.med, rev: e ? { puja: e.puja, beneficio: e.beneficio, pujaJusta: e.pujaJusta } : null, nr: nr ? { puja: nr.puja, beneficio: nr.beneficio } : null };
      L.push(`${nombre}: vale ${eur(j.valor)}, sale a ${eur(m.precio)}, sube ${pc(pf.r)}/día${pf.top ? ', top' : ''} · solo por valor, mediana ${pc(PV0 && PV0.med)}; como viene él, ${pc(PV && PV.med)} (${M.pagaTxt(PV)}) · puja de la app ${eur(m.puja)} (antes de aprender de tus pujas ${eur(mA.puja)}; la que gana ${eur(m.pujaGana)}${m.recortada ? ', recortada por el once' : ''}) · se gana ${pc(m.pGana)} · veredicto ${m.veredicto}, interés ${m.interes}`);
      L.push(`   revender: ${e ? `${eur(e.puja)} → ${eur(e.valorFuturo)} (${eur(e.beneficio, { signo: true })})${e.pujaJusta ? ' [tope]' : ''}` : nr ? `NO: ${eur(nr.puja)} → ${eur(nr.valorFuturo)} (${eur(nr.beneficio, { signo: true })})` : 'fuera'} · tener: ${JSON.stringify(M.tener(j, m.tend, m.puja))}`);
    }
    delete filas['Cubarsí'];
    L.push(`PLAN: ${R.titular}`);
    for (const o of R.ops || []) L.push(`OP ${o.descartada ? '(descartada) ' : ''}${o.accion} ${o.jugador || ''} ${o.puja_max ? eur(o.puja_max) : o.importe ? eur(o.importe) : ''} [${o.objetivo || ''}] ${o.aviso ? `| ${o.aviso} ` : ''}— ${o.motivo}`);
    for (const d of R.descartes || []) L.push(`MIRADO ${d.jugador}: ${d.motivo}`);
    // lo que ve la IA
    const ctx = I.contexto(D, M, Dt.cfg());
    const txt = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
    L.push(...txt.split('\n').filter((l) => /CÓMO SE PAGA SEGÚN|PUJAR por (Valverde|Unai López|Pepe)/.test(l)));
    // una liga sin compras: tira de lo que se paga en todas las ligas (lo que da /pujas/cal)
    const Dv = JSON.parse(JSON.stringify(D));
    Dv.actividad = Dv.actividad.filter((a) => !(a.clase === 'compra' && !a.otroId && !a.otro));
    const sinCal = Mo.analizar(Dv, H, S.c, ext), conCal = Mo.analizar(Dv, H, S.c, { ...ext, calPujas: window.__calPujas });
    const vS = sinCal.mercado.find((x) => x.pid === pidDe.Valverde), vC = conCal.mercado.find((x) => x.pid === pidDe.Valverde);
    const PVc = conCal.pagaLiga(vC.j.valor, pidDe.Valverde);
    const todas = { sin: vS.pujaGana, con: vC.pujaGana, txt: conCal.pagaTxt(PVc), todos: PVc && PVc.todos, n: PVc && PVc.n };
    L.push(`LIGA SIN COMPRAS: Valverde, sin lo de todas las ligas ${eur(vS.pujaGana)}; con ello ${eur(vC.pujaGana)} (${todas.txt})`);
    return { L, filas, todas, plan: (R.ops || []).filter((o) => !o.descartada).map((o) => ({ accion: o.accion, jugador: o.jugador, puja: o.puja_max, objetivo: o.objetivo, motivo: o.motivo })), mirados: (R.descartes || []).map((d) => `${d.jugador}: ${d.motivo}`) };
  });
  console.log(r.L.join('\n'));
  const ok = (c, t) => { console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); if (!c) mal++; };
  const V = r.filas.Valverde, U2 = r.filas['Unai López'], Pp = r.filas.Pepe;
  ok(V.med > V.med0 + 0.02 && U2.med > U2.med0 + 0.02, `los que suben se comparan con los que subían: Valverde ${V.med0.toFixed(3)} → ${V.med.toFixed(3)}, Unai ${U2.med0.toFixed(3)} → ${U2.med.toFixed(3)}`);
  ok(V.pujaGana >= 86e6 * 1.12 && U2.pujaGana >= 32.1e6 * 1.1 && Pp.pujaGana >= 27.3e6 * 1.1, `la puja que gana va con lo que se paga en su liga por los que suben (${V.pujaGana}, ${U2.pujaGana}, ${Pp.pujaGana})`);
  ok(V.pujaGana > V.pujaGanaAntes && Pp.pujaGana > Pp.pujaGanaAntes, `con 4 de 5 pujas perdidas, la puja sube (Valverde ${V.pujaGanaAntes} → ${V.pujaGana}, Pepe ${Pp.pujaGanaAntes} → ${Pp.pujaGana})`);
  for (const [n, x] of Object.entries(r.filas)) ok(!!(x.rev || x.nr), `${n}: el plan sabe si sale revenderlo (${x.rev ? 'sí' : 'no'})`);
  const enPlan = (n) => r.plan.some((o) => o.jugador === n) || r.mirados.some((m) => m.startsWith(`${n}:`));
  for (const n of ['Valverde', 'Unai López', 'Pepe']) ok(enPlan(n), `${n} sale en el plan o en «Mirados» con sus cuentas`);
  ok(r.plan.concat(r.mirados.map((m) => ({ motivo: m }))).some((o) => /tenerlo|recuperas/.test(o.motivo || '')), 'el plan dice si sale a cuenta tenerlo');
  ok(r.todas.todos >= 8 && r.todas.n === 0 && r.todas.con > r.todas.sin * 1.08 && /todas las ligas/.test(r.todas.txt), `una liga sin compras tira de todas las ligas (Valverde ${r.todas.sin} → ${r.todas.con})`);
} finally { await P.cerrar(); await cerrar(); }
process.exit(mal ? 1 : 0);
