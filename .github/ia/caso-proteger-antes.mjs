// Proteger a un jugador ANTES de que se le abra la cláusula (27 nov, Carlos con El Hilali, 20:27: «Los jugadores hay que
// protegerlos, ya sea blindándolos o incluso vendiéndolos al mercado antes de que salga la cláusula para que no te lo
// roben. Si has comprado un jugador por 40 millones y va por 60 y le quedan 2 días de cláusula, te tendría que decir:
// ponlo en el mercado para ver si llega una muy buena oferta, y blíndalo. Una de las dos o las dos a la vez»).
// La regla es de decide.js («protege»): el que sube con la cláusula en su valor, a tiro de un rival y al que se le acaba
// la protección en 2 días o menos → aguantar, a la venta solo para ver ofertas, y el blindaje en cuanto LaLiga lo deje.
// Sin red, con la liga de ejemplo y un titular tuyo que sube un 1 % al día con la cláusula en su valor:
//  (a) martes 10:00, los 14 días se le acaban mañana a las 13:05, con blindajes: la decisión, los dos pasos del plan (a la
//      venta hoy; el blindaje, mañana en cuanto se abra, en «Para luego»), el titular, lo que lee la IA, Equipo, «Ahora
//      mismo», la ficha y el árbitro; y «Los próximos días» ya no lo repite
//  (b) se le acaban HOY a las 13:05: los dos pasos son de hoy, el blindaje dice la hora y en Hoy suben a «Antes de nada»
//  (c) sin blindajes: solo el paso de ponerlo a la venta
//  (d) ya está a la venta sin ofertas: el paso no sale (está hecho), la decisión dice «en venta para ver ofertas» y «Lo que
//      llevas hoy» dice «Del plan»
//  (e) con una oferta floja (+4 %): no se acepta; con una muy buena (+12 %): se acepta y el plan la lleva
//  (f) si la IA manda «venderlo», el repaso lo deja en ponerlo a la venta para ver ofertas (no es una venta: no entra
//      dinero); y si manda aceptar la oferta floja, la saca (o, si hace falta el dinero, avisa)
//  (g) no es para todos: al que no sube, al que se le abre dentro de 3 días y al que ya la tiene abierta, no
//  (h) el día de la jornada, cerrada solo por la jornada: con blindajes manda el blindaje de hoy (lo de El Hilali) y no se
//      pone a la venta; sin blindajes, a la venta para ver ofertas
// Uso: PW_MODULO=… node .github/ia/caso-proteger-antes.mjs   (sale con 1 si algo falla)
import { pagina, cerrar, arbitro } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const ARB = `(${arbitro.toString()})`;

const escena = (P, op) => P.page.evaluate(async ({ op, ARB }) => {
  const S = window.S, Mo = await import('./js/motor.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js'), Ho = await import('./js/hojas.js'), Pl = await import('./js/plan.js'),
    De = await import('./js/decide.js'), Vi = await import('./js/vistas.js'), U = await import('./js/util.js');
  // eslint-disable-next-line no-eval
  const arb = (0, eval)(ARB);
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M;
  const quien = [...M0.mias].filter((x) => x.j.pos !== 5 && M0.perdida(x.pid) >= 0.8 && x.j.valor > 8e6 && x.j.estado === 'ok' && !M0.enVenta.has(x.pid)).sort((a, b) => a.j.valor - b.j.valor)[0];
  if (!quien) return { falta: true };
  const j = quien.j, pid = quien.pid;
  // cuatro semanas subiendo un 1 % al día (o plano, si no sube)
  const vals = [j.valor];
  for (let k = 0; k < 28; k++) vals.unshift(Math.round(vals[0] / (op.plano ? 1 : 1.01)));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  const f = (D.plantillas[yo] || []).find((y) => String(y.pid) === String(pid));
  f.clausula = Math.round(j.valor / 1e4) * 1e4;
  f.protegidoHasta = op.prot === 'abierta' ? Date.now() - 3600e3 : op.prot === 0 ? 0 : new Date(op.prot).getTime();
  for (const g of D.plantillas[yo] || []) if (g !== f) g.protegidoHasta = Date.now() + 9 * 864e5;
  D.actividad = (D.actividad || []).filter((a) => a.clase !== 'blindaje');
  if (op.sinEscudos) { const t0 = Date.now() - 3600e3; for (const k of [1, 2]) D.actividad.unshift({ id: `bl${k}`, t: t0 - k * 60000, tipo: 4, clase: 'blindaje', pid: (D.plantillas[yo].filter((g) => g !== f)[k] || {}).pid, quien: D.yo.nombre, quienId: D.yo.userId, otro: '', otroId: '', importe: 0, texto: '' }); }
  // en venta (sin ofertas o con la de LaLiga a `oferta` sobre su valor)
  if (op.enVenta) {
    const fin = Date.now() + 20 * 3600e3;
    const of = op.oferta != null ? [{ id: 'o1', importe: Math.round(j.valor * (1 + op.oferta) / 1000) * 1000, estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true }] : [];
    D.misVentas = [...(D.misVentas || []).filter((v) => v.pid !== pid), { marketId: 'vP', pid, ptId: 'ptP', precio: Math.round(j.valor * 1.2), cierra: fin, ofertas: of }];
    D.mercado = [...(D.mercado || []), { id: 'vP', pid, tipo: 'manager', precio: Math.round(j.valor * 1.2), cierra: fin, pujas: 0, ofertas: of.length, vendedorTeamId: yo, vendedor: D.yo.manager, miPuja: null, clausula: null }];
  }
  const F = S.fuentes || {};
  const M = Mo.analizar(D, H, S.c, { det: S.det, onces: F.onces, noticias: F.noticias, avanzadas: F.avanzadas, alineaciones: F.alineaciones });
  const x = M.mias.find((y) => y.pid === pid);
  const d0 = M.decisionBase(pid);
  let plan = null, err = '';
  try { plan = Pl.planDeHoy(D, M, S.c); } catch (e) { err = e.message; }
  M.verPlan(plan);
  const d = M.decision(pid);
  const pasos = plan ? (plan.ops || []).filter((o) => o.pid === pid) : [];
  const pT = pasos.find((o) => o.accion === 'tantear') || null, pB = pasos.find((o) => o.accion === 'blindar') || null, pV = pasos.find((o) => o.accion === 'vender') || null;
  const paso = (o) => (o ? { cuando: o.cuando, hoy: o.hoy, descartada: !!o.descartada, etiqueta: o.etiqueta || '', aviso: o.aviso || '', motivo: o.motivo || '', importe: o.importe || 0, signo: o.signo || 0, saldo: o.saldo } : null);
  const S2 = { ...S, D, H, M, plan, opPorPid: {} };
  for (const o of (plan && plan.ops) || []) if (o.pid && !o.descartada && !S2.opPorPid[o.pid]) S2.opPorPid[o.pid] = o;
  // lo que lee la IA
  const ctx = I.contexto(D, M, Dt.cfg());
  const lineaIA = ctx.split('\n').find((l) => l.includes(j.nombre) && /TITULAR|suplente/.test(l)) || '';
  let chat = ''; try { chat = I.ventasMiasTxt(D, M, [j], Dt.cfg()) || ''; } catch (e) { chat = `ERROR ${e.message}`; }
  const vv = De.ventaVista(M, x);
  const urg = (M.acciones || []).find((a) => a.pid === pid && a.tipo === 'proteger') || null;
  let ficha = ''; try { ficha = Ho.fichaJugador(S2, pid) || ''; } catch (e) { ficha = `ERROR ${e.message}`; }
  if (typeof ficha !== 'string') ficha = String((ficha && ficha.html) || '');
  const txt = (h) => { const e = document.createElement('div'); e.innerHTML = h; return (e.innerText || e.textContent || '').replace(/\s+/g, ' '); };
  let hoyTxt = ''; try { hoyTxt = txt(Vi.hoy(S2) || ''); } catch (e) { hoyTxt = `ERROR ${e.message}`; }
  // el pedido corto que se le manda a la IA (el paso, con su nombre)
  let corto = ''; try { corto = I.pedidoCorto(D, M, Dt.cfg(), plan); } catch (e) { corto = `ERROR ${e.message}`; }
  // la IA manda venderlo (o aceptar su oferta): el repaso
  const v = (M.misVentas || []).find((y) => y.pid === pid);
  const mandaIA = (acc, ref) => { const C = I.cuadrarPlan({ dia: U.diaDe(), t: Date.now(), modelo: 'x', titular: `Hoy toca vender a ${j.nombre}`, situacion: 'x', operaciones: [{ accion: acc, ref, jugador: j.nombre, importe: v && v.mejor ? v.mejor.importe : null, cuando: 'hoy', motivo: 'Véndelo.' }] }, D, M); const o = (C.ops || [])[0] || null; return o ? { accion: o.accion, descartada: !!o.descartada, signo: o.signo || 0, importe: o.importe || 0, etiqueta: o.etiqueta || '', aviso: o.aviso || '', final: C.final, titular: C.titular || '' } : null; };
  const iaVende = v ? null : mandaIA('vender', `V-${pid}`);
  const iaAcepta = v && v.mejor ? mandaIA('aceptar_oferta', `A-${pid}`) : null;
  // «Lo que llevas hoy», con lo que el plan de hoy pidió ya apuntado
  let llevas = '';
  if (op.pidio) { U.LS.set(Dt.K('plan-pidio'), { dia: U.diaDe(), l: op.pidio.map((a) => `${a}:${pid}`) }); try { llevas = txt(Vi.llevasHTML(S2)); } catch (e) { llevas = `ERROR ${e.message}`; } U.LS.set(Dt.K('plan-pidio'), null); }
  let faltas = []; try { faltas = (arb(plan, D, M, U.eur) || []).filter((l) => /^REGLAS: /.test(l) && l !== 'REGLAS: ok'); } catch (e) { faltas = [`ERROR ${e.message}`]; }
  const pa = d0 && d0.protege;
  return {
    n: j.nombre, valor: j.valor, err, abierta: x.abierta, soloVeda: !!x.soloVeda, riesgo: x.riesgo, quedan: (M.escudosMios || {}).quedan, para: (M.paraEscudo || []).includes(pid),
    veredicto: (M.ventaMia(x) || {}).veredicto,
    regla: d0 ? d0.regla : null, accion: d0 ? d0.accion : null, matiz: d0 ? d0.matiz : null, paso: d0 ? d0.paso : null, corta: d0 ? d0.corta : '', porque: d0 ? d0.porque : '', oferta: d0 ? d0.oferta || '' : '',
    dPlan: d ? `${d.accion}/${d.regla}/${d.matiz || ''}` : '', consejo: v ? v.consejo : null,
    corte: pa ? pa.corte : null, escudo: pa ? pa.escudo : null, hh: pa ? pa.hh : '', txtAbre: pa ? pa.txt : '',
    pT: paso(pT), pB: paso(pB), pV: paso(pV), titular: plan ? plan.titular : '', dias: plan ? JSON.stringify(plan.proximos_dias || plan.diasAuto || []) : '',
    lineaIA, chat, corto: (corto.split('\n').find((l) => l.includes(j.nombre) && /^\[p\d+\]/.test(l)) || ''),
    pill: vv ? `${vv.pill} | ${vv.largo}` : '', urg: urg ? { titulo: urg.titulo, cuando: urg.cuando, prio: urg.prio } : null,
    fichaPlan: (txt(ficha).match(/Plan de hoy: [^.]{0,60}/) || [''])[0], fichaErr: /^ERROR/.test(ficha) ? ficha : '',
    hoyFase: /Protege/.test(hoyTxt), hoyPaso: (hoyTxt.match(new RegExp(`A la venta ?${j.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^·]{0,40}`)) || [''])[0], hoyErr: /^ERROR/.test(hoyTxt) ? hoyTxt : '',
    iaVende, iaAcepta, llevas: (llevas.match(new RegExp(`${j.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} a la venta[^.]{0,60}?(Del plan|Por tu cuenta)`)) || [llevas.slice(0, 160)])[0],
    faltas, eur: (z) => z,
    corteTxt: pa ? U.eur(pa.corte) : '', eurV: U.eur(j.valor), clausula: x.clausula,
    // «Antes de nada», arriba del todo y con el paso dentro (antes que «Haz caja»)
    hoyUrg: (() => { const i = hoyTxt.indexOf('Antes de nada'), k = hoyTxt.indexOf(`A la venta${j.nombre}`), k2 = hoyTxt.indexOf(`A la venta ${j.nombre}`), c = hoyTxt.indexOf('Haz caja'); const kk = k >= 0 ? k : k2; return i >= 0 && kk > i && (c < 0 || kk < c); })(),
  };
}, { op, ARB });

const lista = async (escenaN, op) => {
  const P = await pagina(escenaN);
  try {
    await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
    return await escena(P, op);
  } finally { await cerrar(P); }
};
const re = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// (a) martes 10:00; los 14 días se le acaban el miércoles a las 13:05
let r = await lista('martes', { prot: '2026-11-04T13:05:00+01:00' });
if (r.falta) ok(false, 'la liga de ejemplo no tiene un titular de más de 8 M');
else {
  ok(!r.err && r.veredicto === 'proteger' && !r.abierta && r.riesgo !== 'ninguno', `(a) ${r.n} (${r.eurV}): sube, cláusula en su valor, se abre ${r.txtAbre} (riesgo ${r.riesgo})${r.err ? ` ERROR ${r.err}` : ''}`);
  ok(r.regla === 'protege' && r.accion === 'aguantar' && r.matiz === 'ver-ofertas' && r.paso === 'tantear', `(a) la decisión: «${r.corta}» (${r.accion}/${r.regla}/${r.matiz}, paso ${r.paso})`);
  // (Carlos, 27 nov: la oferta «muy buena» es lo que valdría en 7 días, y nunca menos que su cláusula)
  ok(r.corte > r.valor * 1.03 && r.corte < r.valor * 1.12 && r.corte >= r.clausula && new RegExp(`sin aceptar menos de ${re(r.corteTxt)} \\(lo que valdría en 7 días\\)`).test(r.porque) && /blíndalo en cuanto se abra/.test(r.porque), `(a) y lo dice: «${r.porque}»`);
  ok(r.pT && !r.pT.descartada && r.pT.hoy !== false && r.pT.etiqueta === 'A la venta' && !r.pT.importe && !r.pT.signo && r.pT.saldo == null, `(a) el plan lleva el paso de ponerlo a la venta, de hoy y sin dinero: «${r.pT ? r.pT.cuando : 'no hay'}»${r.pT && r.pT.aviso ? ` (aviso: ${r.pT.aviso})` : ''}`);
  ok(r.pB && !r.pB.descartada && r.pB.hoy === false && /^mañana a las 13:05$/.test(r.pB.cuando) && /^En cuanto se abra su cláusula/.test(r.pB.motivo) && !r.pB.aviso, `(a) y el del blindaje, para mañana: «${r.pB ? r.pB.cuando : 'no hay'}»${r.pB && r.pB.aviso ? ` (aviso: ${r.pB.aviso})` : ''}`);
  ok(!r.pV, '(a) sin paso de venderlo (no es una venta)');
  ok(new RegExp(`proteger a ${re(r.n)}`).test(r.titular), `(a) el titular del plan: «${r.titular}»`);
  ok(/LA APP: PROTEGERLO \(ponerlo en el mercado solo para ver ofertas; aceptar solo desde /.test(r.lineaIA) && !/LA APP: (VENDER|A LA VENTA)/.test(r.lineaIA), `(a) la IA lee en MI EQUIPO: «${(r.lineaIA.match(/LA APP: [^|]*/) || ['nada'])[0]}»`);
  ok(/LA DECISIÓN DE LA APP: AGUANTAR Y PROTEGERLO: PONERLO EN EL MERCADO SOLO PARA VER OFERTAS/.test(r.chat) && new RegExp(`SI LE DAN ${re(r.corteTxt)} O MÁS \\(lo que valdría en 7 días`).test(r.chat), `(a) y en Pregunta: «${(r.chat.match(/LA DECISIÓN DE LA APP: [^|]{0,110}/) || [r.chat.slice(0, 80)])[0]}…»`);
  ok(/PONER A LA VENTA SOLO PARA VER OFERTAS \(no es venderlo\)/.test(r.corto), `(a) el plan que se le manda a la IA: «${r.corto.slice(0, 90)}»`);
  ok(/Se abre · ver ofertas/.test(r.pill), `(a) Equipo: «${r.pill}»`);
  ok(r.urg && r.urg.prio >= 78 && /a la venta para ver ofertas/.test(r.urg.titulo), `(a) «Ahora mismo» (sin plan): ${r.urg ? `«${r.urg.titulo}» · ${r.urg.cuando}` : 'no sale'}`);
  ok(!r.fichaErr && /Plan de hoy: A la venta/.test(r.fichaPlan), `(a) la ficha: «${r.fichaPlan}»${r.fichaErr}`);
  ok(!r.hoyErr && r.hoyFase && r.hoyPaso && !r.hoyUrg, `(a) Hoy, en «Protege» (se abre mañana: no va en «Antes de nada»): «${r.hoyPaso}»${r.hoyErr}`);
  ok(!new RegExp(`se acaba la protección de tu ${re(r.n)}`).test(r.dias), '(a) «Los próximos días» ya no lo repite');
  ok(r.iaVende && r.iaVende.accion === 'tantear' && !r.iaVende.descartada && !r.iaVende.signo && !r.iaVende.importe, `(a) si la IA manda «venderlo», el repaso lo deja en «${r.iaVende ? r.iaVende.etiqueta : '?'}», sin dinero`);
  ok(!r.faltas.length, `(a) el árbitro no pone pegas${r.faltas.length ? `: ${r.faltas.join(' | ')}` : ''}`);
}

// (b) se le acaban hoy a las 13:05
r = await lista('martes', { prot: '2026-11-03T13:05:00+01:00' });
if (!r.falta) {
  ok(r.regla === 'protege' && r.pT && r.pT.hoy !== false && /^hoy antes de las 13:05$/.test(r.pT.cuando), `(b) hoy: a la venta «${r.pT ? r.pT.cuando : 'no hay'}»`);
  ok(r.pB && !r.pB.descartada && r.pB.hoy !== false && /^hoy a las 13:05$/.test(r.pB.cuando) && /^En cuanto se abra su cláusula/.test(r.pB.motivo) && !r.pB.aviso, `(b) y el blindaje, de hoy y con su hora: «${r.pB ? r.pB.cuando : 'no hay'}»${r.pB && r.pB.aviso ? ` (aviso: ${r.pB.aviso})` : ''}`);
  ok(!r.hoyErr && r.hoyUrg, `(b) y en Hoy van arriba, en «Antes de nada» (Carlos: «ahí, si es un jugador que merezca la pena»)${r.hoyErr}`);
  ok(!r.faltas.length, `(b) el árbitro lo da por bueno${r.faltas.length ? `: ${r.faltas.join(' | ')}` : ''}`);
}

// (c) sin blindajes
r = await lista('martes', { prot: '2026-11-04T13:05:00+01:00', sinEscudos: true });
if (!r.falta) {
  ok(r.quedan === 0 && r.regla === 'protege' && r.escudo == null && r.pT && !r.pB && !/blíndalo/.test(r.porque), `(c) sin blindajes (quedan ${r.quedan}): solo a la venta para ver ofertas: «${r.porque}»`);
  ok(!r.faltas.length, `(c) el árbitro lo da por bueno${r.faltas.length ? `: ${r.faltas.join(' | ')}` : ''}`);
}

// (d) ya está a la venta, sin ofertas
r = await lista('martes', { prot: '2026-11-04T13:05:00+01:00', enVenta: true, pidio: ['tantear'] });
if (!r.falta) {
  ok(r.regla === 'protege' && r.paso === 'nada' && r.corta === 'En venta para ver ofertas' && !r.pT && !r.pV, `(d) ya en venta: «${r.corta}», sin paso de ponerlo ni de venderlo`);
  ok(r.pB && r.pB.hoy === false, `(d) el blindaje sigue: «${r.pB ? r.pB.cuando : 'no hay'}»`);
  ok(/En venta · ver ofertas/.test(r.pill) && /ya está en el mercado para ver ofertas/.test(r.lineaIA), `(d) Equipo «${r.pill.split(' | ')[0]}» y la IA lo lee igual`);
  ok(/Del plan$/.test(r.llevas), `(d) «Lo que llevas hoy»: «${r.llevas}»`);
}

// (e) con oferta
r = await lista('martes', { prot: '2026-11-04T13:05:00+01:00', enVenta: true, oferta: 0.04 });
if (!r.falta) {
  ok(r.regla === 'protege' && r.accion === 'aguantar' && r.matiz === 'oferta-no' && r.consejo === 'esperar' && !r.pV, `(e) con una oferta del +4 %: no se acepta («${r.porque}»)`);
  // (en la liga de ejemplo hace falta dinero para la jornada: entonces se queda, con el aviso; si no, sale del plan)
  ok(r.iaAcepta && (r.iaAcepta.descartada || /^Ojo: .*acepta solo desde/.test(r.iaAcepta.aviso)), `(e) y si la IA manda aceptarla, el repaso la saca o avisa: «${r.iaAcepta ? r.iaAcepta.aviso.slice(0, 120) : ''}»`);
}
r = await lista('martes', { prot: '2026-11-04T13:05:00+01:00', enVenta: true, oferta: 0.12 });
if (!r.falta) {
  ok(r.regla === 'protege' && r.accion === 'vender' && r.matiz === 'acepta' && r.consejo === 'aceptar', `(e) con una del +12 %: se acepta («${r.porque}»)`);
  ok(r.pV && !r.pV.descartada && r.pV.etiqueta === 'Aceptar oferta', `(e) y el plan lleva el paso de aceptarla${r.pV ? '' : ' (no lo lleva)'}`);
}

// (g) no es para todos
r = await lista('martes', { prot: '2026-11-04T13:05:00+01:00', plano: true });
if (!r.falta) ok(r.regla !== 'protege' && !r.pT, `(g) el que no sube: no (${r.accion}/${r.regla})`);
r = await lista('martes', { prot: '2026-11-06T12:00:00+01:00' });
if (!r.falta) ok(r.regla !== 'protege' && !r.pT, `(g) al que se le abre dentro de 3 días: todavía no (${r.accion}/${r.regla})`);
r = await lista('martes', { prot: 'abierta' });
if (!r.falta) ok(r.regla !== 'protege' && !r.pT, `(g) con la cláusula ya abierta: no es «antes» (${r.accion}/${r.regla}; a quién blindar: ${r.para})`);

// (h) el día de la jornada, cerrada solo por la jornada
r = await lista('sabado', { prot: 0 });
if (!r.falta) ok(r.soloVeda && r.para && r.regla !== 'protege' && !r.pT && r.pB && r.pB.hoy !== false, `(h) con blindajes, manda el de hoy (lo de El Hilali): «${r.pB ? r.pB.cuando : 'no hay'}», sin ponerlo a la venta`);
r = await lista('sabado', { prot: 0, sinEscudos: true });
if (!r.falta) {
  ok(r.soloVeda && !r.para && r.regla === 'protege' && r.pT && !r.pB, `(h) sin blindajes: a la venta para ver ofertas («${r.pT ? r.pT.cuando : 'no hay'}»)`);
  ok(!r.faltas.length, `(h) el árbitro lo da por bueno${r.faltas.length ? `: ${r.faltas.join(' | ')}` : ''}`);
}

console.log(mal ? `${mal} MAL` : 'todo BIEN');
process.exit(mal ? 1 : 0);
