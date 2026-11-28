// (28 nov) El dinero de un rival, lo primero de su ficha y con su desglose (Carlos: «si un usuario desbloquea lo del dinero
// con 2 anuncios, que le salga una pestaña mejor, más avanzada… un desglose de todos los gastos que ha ido haciendo», y «no
// debería estar el dinero ahí [Cláusulas → Te quita él], debería estar más a la vista en el perfil, lo primero que te
// salga»). Con la liga de ejemplo retocada dentro de la prueba:
//  (a) la suma de las partes del desglose es la cifra de arriba, al euro, para todos los rivales
//  (b) cada movimiento de la actividad sale una vez en la línea del tiempo, con su jugador y con quién
//  (c) una subida de cláusula con su día y otra sin él
//  (d) con lo que te dijo, la cifra parte de ahí y las partes siguen sumando la cifra
//  (e) la gráfica del saldo acaba en la cifra de arriba con su ±
//  (f) CERRADO: la tarjeta sale la primera, antes de las pestañas, y no lleva ninguna cifra suya ni nada distinto de un
//      rival a otro salvo su nombre; nada del desglose
//  (g) ABIERTO: la tarjeta con la cifra y su ±, y el desglose (se despliega en ella) con las partes, la línea del tiempo y
//      la gráfica
//  (h) Cláusulas (ya en una sola lista: Carlos, «juntar en una»), sin el dinero dentro
// Uso: PW_MODULO=… node .github/ia/caso-desglose-dinero.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('martes');
const r = await P.page.evaluate(async () => {
  const Mo = await import('./js/motor.js');
  const S = window.S, DIA = 864e5, ahora = Date.now();
  const copia = () => ({ D: JSON.parse(JSON.stringify(S.D)), H: JSON.parse(JSON.stringify(S.H)) });
  const monta = (retoca, dichosDe) => {
    const { D, H } = copia();
    D.demo = false; D.dineros = {};
    const desde = ahora - 100 * DIA;
    D.actividad.push({ id: 'x0', t: desde, tipo: 1, clase: 'venta', quien: D.yo.nombre, quienId: D.yo.userId, otro: '', otroId: '', pid: Object.keys(D.maestro)[0], importe: 1000 });
    const det = {};
    if (retoca) retoca({ D, H, det, desde });
    const ext = { actHist: { lista: D.actividad, completa: true, desde }, det };
    let M = Mo.analizar(D, H, S.c, ext);
    D.dinero = 103e6 + M.baseDinero.mov - M.baseDinero.subidas;
    M = Mo.analizar(D, H, S.c, ext);
    if (dichosDe) { ext.dichos = dichosDe(M); M = Mo.analizar(D, H, S.c, ext); }
    return { M, D, ext };
  };
  const suma = (g) => g.partes.reduce((t, p) => t + p.v, 0);
  const base = monta();
  const out = { a: base.M.rivalesTid.map((tid) => { const g = base.M.desgloseDinero(tid); return g ? { tid, total: g.total, suma: suma(g), d: Math.round(base.M.dineroDe(tid).v), enteras: g.partes.every((p) => Number.isInteger(p.v)) } : { tid, nulo: true }; }) };
  // (b) cada movimiento una vez: los de `flujos` de cada rival, uno por uno, y con su jugador
  out.b = base.M.rivalesTid.map((tid) => { const g = base.M.desgloseDinero(tid), f = base.M.flujos[tid] || { n: 0 }; const mv = g.movs.filter((m) => m.clase !== 'subida'); return { n: f.n, movs: mv.length, sinPid: mv.filter((m) => m.clase !== 'premio' && !m.pid).length, clases: [...new Set(mv.map((m) => m.clase))] }; });
  // un traspaso entre dos rivales: sale en los dos, con el otro como «con»
  const R = base.M.rivalesTid[0], R2 = base.M.rivalesTid[1];
  const eR = base.D.clasif.find((e) => e.teamId === R), eR2 = base.D.clasif.find((e) => e.teamId === R2);
  const pidT = (base.D.plantillas[R2] || [])[0].pid;
  const tr = monta(({ D }) => { D.actividad.push({ id: 'x9', t: ahora - 5 * DIA, tipo: 1, clase: 'compra', quien: eR.manager || eR.nombre, quienId: eR.userId, otro: eR2.manager || eR2.nombre, otroId: eR2.userId, pid: pidT, importe: 12345678 }); });
  const mR = tr.M.desgloseDinero(R).movs.find((m) => m.pid === pidT && m.v === -12345678), mR2 = tr.M.desgloseDinero(R2).movs.find((m) => m.pid === pidT && m.v === 12345678);
  out.tr = { paga: mR ? { clase: mR.clase, con: mR.con } : null, cobra: mR2 ? { clase: mR2.clase, con: mR2.con } : null, R, R2, suma: suma(tr.M.desgloseDinero(R)) === tr.M.desgloseDinero(R).total };
  // (c) dos subidas: una del principio (+6 M sobre 5/3, sin día) y otra de uno comprado que un día valió 20 M (+10 M ese día)
  const ini = (base.D.plantillas[R] || []).filter((f) => !base.D.actividad.some((a) => ['compra', 'clausula'].includes(a.clase) && String(a.pid) === String(f.pid) && base.M.teamDeUsuario(a.quienId, a.quien) === R));
  const [p1, p2] = [ini[0].pid, ini[1].pid];
  const tSub = ahora - 10 * DIA;
  const cs = monta(({ D, H, det, desde }) => {
    for (const pid of [p1, p2]) if (H.v) delete H.v[pid];
    const f1 = D.plantillas[R].find((f) => f.pid === p1), v0 = 9e6;
    det[p1] = { t: ahora, stats: [], valores: [[desde - DIA, v0], [desde + 20 * DIA, v0 * 0.9], [ahora - DIA, v0 * 0.6]] }; D.maestro[p1].valor = v0 * 0.6; f1.clausula = Math.round(v0 * 5 / 3) + 6e6;
    const f2 = D.plantillas[R].find((f) => f.pid === p2), t1 = ahora - 30 * DIA;
    D.actividad.push({ id: 'x2', t: t1, tipo: 31, clase: 'compra', quien: eR.manager || eR.nombre, quienId: eR.userId, otro: '', otroId: '', pid: p2, importe: 15000123 });
    det[p2] = { t: ahora, stats: [], valores: [[t1 - DIA, 14e6], [tSub, 20e6], [ahora - DIA, 18000321]] }; D.maestro[p2].valor = 18000321; f2.clausula = 30e6;
  });
  const gc = cs.M.desgloseDinero(R);
  const s1 = gc.movs.find((m) => m.clase === 'subida' && m.pid === p1), s2 = gc.movs.find((m) => m.clase === 'subida' && m.pid === p2);
  out.c = { s1: s1 && { t: s1.t, v: s1.v, exacta: s1.exacta }, s2: s2 && { hace: s2.t ? Math.round((ahora - s2.t) / DIA) : null, v: s2.v, exacta: s2.exacta, de: s2.de, a: s2.a }, ultima: gc.movs[gc.movs.length - 1].t, suma: suma(gc) === gc.total, sub: gc.partes.find((p) => p.clave === 'subidas'), movsSub: gc.movs.filter((m) => m.clase === 'subida').reduce((t, m) => t + m.v, 0), nSub: gc.movs.filter((m) => m.clase === 'subida').length };
  // (d) lo que te dijo
  const cA = base.M.dineroCuentaBruta(R);
  const dd = monta(null, () => ({ [R]: { v: Math.round(cA.v + 1.234567e6), r: 0, min: 0, max: 0, t: ahora - 3600e3, est: cA.v, cu: Mo.CUENTA_DINERO } }));
  const gd = dd.M.desgloseDinero(R);
  out.d = { total: gd.total, suma: suma(gd), v: Math.round(dd.M.dineroDe(R).v), rec: gd.partes.find((p) => p.clave === 'rec'), aj: gd.partes.find((p) => p.clave === 'ajuste') };
  // (e) la gráfica
  const g0 = base.M.desgloseDinero(R), u = g0.saldo[g0.saldo.length - 1];
  out.e = { n: g0.saldo.length, ult: u, total: g0.total, margen: g0.margen, primero: g0.saldo[0].v, crece: g0.saldo.every((x, i) => i === 0 || x.t > g0.saldo[i - 1].t) };
  return out;
});
const m = (v) => (v == null ? '?' : (Math.round(v / 1e4) / 100).toFixed(2));
const malA = r.a.filter((x) => x.nulo || x.total !== x.suma || x.total !== x.d || !x.enteras);
ok(r.a.length >= 3 && !malA.length, `(a) la suma de las partes es la cifra de arriba, al euro, en los ${r.a.length} rivales (${malA.length ? JSON.stringify(malA) : r.a.map((x) => x.total).join(', ')})`);
const malB = r.b.filter((x) => x.n !== x.movs || x.sinPid);
ok(!malB.length, `(b) cada movimiento de la actividad sale una vez, con su jugador (${r.b.map((x) => `${x.movs}/${x.n}`).join(', ')}; clases: ${[...new Set(r.b.flatMap((x) => x.clases))].join(', ')})`);
ok(r.tr.paga && r.tr.paga.clase === 'manager' && r.tr.paga.con === r.tr.R2 && r.tr.cobra && r.tr.cobra.clase === 'ventaManager' && r.tr.cobra.con === r.tr.R && r.tr.suma, `(b) un traspaso entre dos rivales sale en los dos, cada uno con el otro (${JSON.stringify([r.tr.paga, r.tr.cobra])})`);
ok(r.c.s1 && r.c.s1.t == null && r.c.s1.v === -3e6 && r.c.ultima == null, `(c) la subida del principio, sin día (va al final): −3 M (${JSON.stringify(r.c.s1)})`);
ok(r.c.s2 && r.c.s2.hace === 10 && r.c.s2.v === -5e6 && r.c.s2.exacta && r.c.s2.a - r.c.s2.de === 10e6, `(c) la otra, con su día: subió 10 M hace 10 días y pagó 5 M (${JSON.stringify(r.c.s2)})`);
ok(r.c.suma && r.c.sub && r.c.sub.n === r.c.nSub && r.c.sub.v === r.c.movsSub && r.c.nSub >= 2, `(c) y la parte de subidas es la suma de las de la línea del tiempo: ${r.c.sub && r.c.sub.n}, ${m(r.c.sub && r.c.sub.v)} M`);
ok(r.d.total === r.d.suma && r.d.total === r.d.v && r.d.rec && r.d.rec.nota === 'de lo que te dijo', `(d) con lo que te dijo, la cifra parte de ahí y las partes la suman (${m(r.d.total)}; recompensas ${m(r.d.rec && r.d.rec.v)}${r.d.aj ? `, ajuste ${m(r.d.aj.v)}` : ''})`);
ok(r.e.n > 90 && r.e.crece && r.e.primero === 100e6 && r.e.ult.v === r.e.total && r.e.ult.max - r.e.ult.v === r.e.margen, `(e) la gráfica: ${r.e.n} días, de 100 M a ${m(r.e.ult.v)} ± ${m(r.e.margen)}`);

// ---- la ficha del rival, pintada ----
const v = await P.page.evaluate(async () => {
  const S = window.S;
  const H = await import('./js/hojas.js');
  const U = await import('./js/util.js');
  const tids = S.M.rivalesTid;
  const pinta = (tid, seg, sub) => { S.segRival = seg ? { tid, seg, sub } : null; const div = document.createElement('div'); div.innerHTML = H.fichaRival(S, tid); return div; };
  const quitaNombre = (html, tid) => { const e = S.D.clasif.find((x) => x.teamId === tid); let h = html; for (const n of [e.nombre, e.manager].filter(Boolean)) h = h.split(n).join('·'); return h.replace(/data-(rival|tid)="[^"]*"/g, ''); };
  // CERRADO: en la liga de ejemplo las funciones top van cerradas salvo que se abran (el dueño lo ve todo abierto)
  U.LS.del('top-rivales');
  const cerr = tids.map((tid) => {
    const div = pinta(tid);
    const card = div.querySelector('.dn-card');
    const tabs = div.querySelector('.rival-tabs');
    const antes = card && tabs ? !!(card.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    return { hay: !!card, antes, cerrada: !!(card && card.classList.contains('cerrada')), html: card ? quitaNombre(card.outerHTML, tid) : '', txt: card ? card.textContent : '', desg: !!div.querySelector('.dn-desg'), boton: !!(card && card.querySelector('[data-accion="bloqueada"][data-clave="dineroRivales"]')), viejaT: !!div.querySelector('.rival-tiles .rival-bloq') };
  });
  const quita = pinta(tids[0], 'clausulas', 'quita');
  const quitaTxt = quita.querySelector('.dn-card') ? quita.innerHTML.replace(quita.querySelector('.dn-card').outerHTML, '') : quita.innerHTML;
  // ABIERTO: el dinero de todos, como si hubiera visto los anuncios
  U.LS.set('top-rivales', { j: null, usos: tids.length, abiertos: Object.fromEntries(tids.map((t) => [String(t), Date.now() + 5 * 60e3])), uno: null });
  const abr = tids.map((tid) => {
    const div = pinta(tid);
    const card = div.querySelector('.dn-card');
    return { hay: !!card, cerrada: !!(card && card.classList.contains('cerrada')), txt: card ? card.textContent : '', cifra: S.M.desgloseDinero(tid) ? S.M.desgloseDinero(tid).total : null };
  });
  // el desglose, desplegado dentro de la tarjeta
  // (28 nov, 11:26) la gráfica va fuera del desglose, siempre a la vista, y los movimientos, en su propio desplegable y todos
  const sinNada = pinta(tids[0]).querySelector('.dn-card');
  const fuera = { graf: !!sinNada.querySelector(':scope > .dn-graf svg.g-banda'), movs: sinNada.querySelectorAll('.dn-mov').length };
  S.dnAbierto = { [tids[0]]: true };
  const dh = pinta(tids[0]).querySelector('.dn-card .dn-desg') || document.createElement('div');
  S.dnAbierto = {};
  // (13:26) sus movimientos van dentro del desglose: 6 al abrirlo, sin número en ningún botón, y la lista entera al desplegarla
  const botones = [...dh.querySelectorAll('button')].map((b) => b.textContent.trim()).concat([...pinta(tids[0]).querySelectorAll('.dn-card button')].map((b) => b.textContent.trim()));
  S.dnAbierto = { [tids[0]]: true }; S.dnMovs = { [tids[0]]: true };
  const dm = pinta(tids[0]).querySelector('.dn-card .dn-desg');
  const movsTodos = dm.querySelectorAll('.dn-movs .dn-mov').length, nMovs = S.M.desgloseDinero(tids[0]).movs.length;
  S.dnMovs = {}; S.dnAbierto = {};
  const quitaA = pinta(tids[0], 'clausulas', 'quita');
  const quitaATxt = quitaA.querySelector('.dn-card') ? quitaA.innerHTML.replace(quitaA.querySelector('.dn-card').outerHTML, '') : quitaA.innerHTML;
  S.segRival = null;
  U.LS.del('top-rivales');
  // (28 nov) en la liga de ejemplo todo va abierto sin anuncios; cerrado solo con la marca de las pruebas
  localStorage.removeItem('fm-demo-cerrada');
  const demoAbierta = tids.every((tid) => { const c = pinta(tid).querySelector('.dn-card'); return !!c && !c.classList.contains('cerrada'); });
  localStorage.setItem('fm-demo-cerrada', '1');
  return { demoAbierta, cerr, abr, quitaCerr: /su dinero|dd-ficha|dd-cerr/.test(quitaTxt), quitaAbr: /su dinero|dd-ficha|dd-cerr/.test(quitaATxt), d: { partes: dh.querySelectorAll('.dn-parte').length, movs: dh.querySelectorAll('.dn-mov').length, graf: !!dh.querySelector('svg.g-banda'), total: (dh.querySelector('.dn-total b') || {}).textContent || '', lista: !!dh.querySelector('.dn-movs-b') }, fuera, movsTodos, nMovs, botones };
});
ok(v.demoAbierta, '(f0) en la liga de ejemplo, el dinero de todos los rivales abierto sin anuncios');
ok(v.cerr.every((x) => x.hay && x.antes && x.cerrada && x.boton && !x.desg && !x.viejaT), `(f) cerrado, la tarjeta sale la primera, antes de las pestañas, con el botón de los anuncios y sin desglose (${JSON.stringify(v.cerr.map((x) => [x.hay, x.antes, x.cerrada, x.boton, x.desg, x.viejaT]))})`);
ok(v.cerr.every((x) => !/\d+,\d+ ?M|\d{1,3}(\.\d{3}){2}|±/.test(x.txt)), `(f) cerrado, ninguna cifra en la tarjeta (${v.cerr.map((x) => x.txt.replace(/\s+/g, ' ').trim().slice(0, 60)).join(' | ')})`);
ok(new Set(v.cerr.map((x) => x.html)).size === 1, `(f) cerrado, la tarjeta es igual en todos los rivales salvo su nombre (${new Set(v.cerr.map((x) => x.html)).size} distintas)`);
ok(v.abr.every((x) => x.hay && !x.cerrada && x.cifra != null && /±|Exacto/.test(x.txt)), `(g) abierto, la tarjeta con la cifra y su ± (o «Exacto» si LaLiga lo da) (${v.abr.map((x) => x.txt.replace(/\s+/g, ' ').trim().slice(0, 40)).join(' | ')})`);
ok(v.d.partes >= 4 && v.d.movs === Math.min(6, v.nMovs) && !v.d.graf && /M/.test(v.d.total) && v.d.lista === v.nMovs > 6, `(g) el desglose, desplegado en la tarjeta: de dónde sale y sus 6 últimos movimientos, sin la gráfica (${v.d.partes} partes, ${v.d.movs} de ${v.nMovs} movimientos, gráfica ${v.d.graf}, lista ${v.d.lista}, hoy ${v.d.total})`);
ok(v.fuera.graf && !v.fuera.movs, `(g) la gráfica de su saldo, a la vista sin desplegar nada, y ningún movimiento fuera del desglose (${JSON.stringify(v.fuera)})`);
ok(v.nMovs > 6 && v.movsTodos === v.nMovs, `(g) al desplegar la lista salen todos (${v.movsTodos} de ${v.nMovs})`);
ok(v.botones.every((t) => !/\d/.test(t)), `(g) ningún número en los botones (${v.botones.join(' | ')})`);
ok(!v.quitaCerr && !v.quitaAbr, `(h) Cláusulas, sin el dinero dentro (cerrado ${v.quitaCerr}, abierto ${v.quitaAbr})`);
ok(!P.errores || !P.errores.length, `sin errores en la página${P.errores && P.errores.length ? `: ${P.errores.join(' | ')}` : ''}`);
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
