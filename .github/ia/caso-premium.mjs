// Las Ligas Premium de LaLiga, parte A (26 nov): que la app ENTIENDA una liga premium. Sin red, con la liga de ejemplo
// convertida en premium solo dentro de la prueba (la liga de ejemplo no es premium; nada de datos de usuarios aquí).
// Una comprobación por regla (las fuentes, en claude/nota-premium.md del proyecto):
//  (1) la liga solo es premium con `premium: true`, y cada función solo cuenta con su campo a true
//  (2) liga estándar con un entrenador en plantilla: como siempre (vender, paso del plan, texto de la IA)
//  (3) liga premium con entrenador: se aguanta, el plan no lo vende, la IA lee que puntúa 5/2/0 y va en el once
//  (4) entrenador destituido en premium: vender (ya no puntúa) y no se alinea
//  (5) el tope de 24: en premium con entrenador, los entrenadores no cuentan
//  (6) recompensa diaria: 100 mil en estándar, 200 mil en premium; blindaje 24 h y 48 h
//  (7) la alineación de LaLiga con entrenador, capitán y banquillo: los once son once; el capitán solo si es uno de ellos
//  (8) una foto de la liga guardada antes de esta versión (premium sin `pf`): ninguna función activa
// Parte B (26 nov): que AYUDE a jugarla, con lo medido antes (claude/nota-premium-parte-b.md del proyecto)
//  (9) las 5 formaciones de más, solo con esa función encendida; una línea vacía (4-6-0) se lee y se alinea
//  (10) el capitán: el de más puntos esperados del once, nunca el entrenador, y nada con la función apagada
//  (11) el banquillo: uno por puesto, de los que no alineas, solo de los puestos de tu formación
//  (12) el entrenador: de dos, el de mejor partido; los del mercado, aparte; sin ninguno, cuál fichar
//  (13) la IA lee lo que propone la app (solo en premium) y Equipo lo pinta con la misma cuenta
// Uso: PW_MODULO=… node .github/ia/caso-premium.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const P = await pagina('martes');
const r = await P.page.evaluate(async () => {
  const S = window.S, Mo = await import('./js/motor.js'), N = await import('./js/normalizar.js'), V = await import('./js/vivo.js');
  const I = await import('./js/ia.js'), Pm = await import('./js/plan.js'), Vi = await import('./js/vistas.js');
  const out = {};
  // (1) los campos de la liga, como los da LaLiga en /leagues
  const cfg = (f) => ({ features: { buyoutClause: true }, premiumFeatures: { formations: false, captain: false, bench: false, loan: false, ideal: false, coach: false, ...f },
    premiumConfigurations: { loan: { duration: 1, maxLoans: 3, enableConclude: true, minPercentage: 0.25 }, ideal: { reward: 100000 } } });
  out.l = {
    sinCampo: N.premiumDe({ id: '1', name: 'x' }),
    estandar: N.premiumDe({ id: '1', premium: false, config: cfg({ coach: true, captain: true }) }),
    premium: N.premiumDe({ id: '1', premium: true, config: cfg({ coach: true, ideal: true }) }),
    premiumSinConfig: N.premiumDe({ id: '1', premium: true }),
    premiumRaro: N.premiumDe({ id: '1', premium: 'true', config: cfg({ coach: true }) }),
  };

  const yo = S.D.yo.teamId;
  const montar = ({ premium = false, pf = null, sinPf = false, estado = 'ok', jugadores = null, dos = false, oferta = false, sinEnt = false, otroEq = false, soloMedios = false } = {}) => {
    const D = JSON.parse(JSON.stringify(S.D));
    const eqId = Object.values(D.maestro).find((j) => j.pos === 2 && j.equipoId).equipoId;
    const ent = (id, nombre, media) => ({ id, pos: 5, nombre, largo: nombre, valor: 900000, estado, equipoId: eqId, media, puntos: Math.round(media * 13), equipo: (D.maestro[Object.keys(D.maestro)[0]] || {}).equipo || '' });
    D.maestro.ent1 = ent('ent1', 'Míster Uno', 2.4);
    if (!sinEnt) D.plantillas[yo] = [...D.plantillas[yo], { pid: 'ent1', ptId: 'pt-ent1', clausula: 1500000, protegidoHasta: 0 }];
    if (dos) { D.maestro.ent2 = { ...ent('ent2', 'Míster Dos', 3.5), estado: 'ok' }; D.plantillas[yo].push({ pid: 'ent2', ptId: 'pt-ent2', clausula: 1500000, protegidoHasta: 0 }); }
    // (parte B) el segundo entrenador, de menos media pero en otro equipo: se le pone más abajo el mejor partido
    if (otroEq) { const eq2 = Object.values(D.maestro).find((j) => j.pos === 2 && j.equipoId && j.equipoId !== eqId).equipoId; D.maestro.ent2 = { ...ent('ent2', 'Míster Dos', 1.2), estado: 'ok', equipoId: eq2 }; D.plantillas[yo].push({ pid: 'ent2', ptId: 'pt-ent2', clausula: 1500000, protegidoHasta: 0 }); }
    // (parte B) una plantilla sin delanteros sanos y con medios de sobra: solo cabe entera en un 4-6-0
    if (soloMedios) {
      const de = (p) => D.plantillas[yo].filter((f) => (D.maestro[f.pid] || {}).pos === p);
      const mios2 = new Set(Object.values(D.plantillas).flat().map((f) => String(f.pid)));
      const medios = Object.values(D.maestro).filter((j) => j.pos === 3 && j.valor && j.estado === 'ok' && !mios2.has(String(j.id))).sort((a, b) => b.media - a.media).slice(0, 6);
      D.plantillas[yo] = [...de(1).slice(0, 2), ...de(2).slice(0, 5), ...de(3), ...medios.map((j) => ({ pid: j.id, ptId: `pt-${j.id}`, clausula: Math.round(j.valor * 1.5), protegidoHasta: 0 })), ...de(5)];
    }
    if (jugadores != null) {
      // la plantilla con ese número de JUGADORES (sin contar entrenadores): se rellena con libres o se recorta
      const mios = new Set(Object.values(D.plantillas).flat().map((f) => String(f.pid)));
      const libres = Object.values(D.maestro).filter((j) => j.pos >= 1 && j.pos <= 4 && j.valor && j.estado === 'ok' && !mios.has(String(j.id)));
      const jug = D.plantillas[yo].filter((f) => (D.maestro[f.pid] || {}).pos !== 5), ents = D.plantillas[yo].filter((f) => (D.maestro[f.pid] || {}).pos === 5);
      while (jug.length < jugadores && libres.length) { const j = libres.pop(); jug.push({ pid: j.id, ptId: `pt-${j.id}`, clausula: Math.round(j.valor * 1.5), protegidoHasta: 0 }); }
      D.plantillas[yo] = [...jug.slice(0, jugadores), ...ents];
    }
    // un entrenador libre en el mercado de la liga (salen en todas las ligas): la app no lo mezcla con los jugadores
    const libre0 = (D.mercado || []).find((m) => m.tipo !== 'manager');
    D.maestro.ent3 = ent('ent3', 'Míster Libre', 3);
    if (libre0) D.mercado.push({ ...libre0, id: 'm-ent3', pid: 'ent3', miPuja: null });
    // una oferta de LaLiga un 8 % por encima de su valor por el entrenador, puesto en venta
    if (oferta) {
      const fin = Date.now() + 20 * 3600e3, v = D.maestro.ent1.valor;
      D.misVentas = [{ marketId: 'vt', pid: 'ent1', ptId: 'pt-ent1', precio: Math.round(v * 1.1), cierra: fin, ofertas: [{ id: 'ot', importe: Math.round(v * 1.08), estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true }] }];
      D.mercado = (D.mercado || []).filter((m) => !(m.tipo === 'manager' && m.vendedorTeamId === yo));
      D.mercado.push({ id: 'vt', pid: 'ent1', tipo: 'manager', precio: D.misVentas[0].precio, cierra: fin, pujas: 0, ofertas: 1, vendedorTeamId: yo, vendedor: D.yo.manager, miPuja: null, clausula: null });
    }
    D.liga = { ...D.liga, premium };
    if (premium && !sinPf) { D.liga.pf = { formations: false, captain: false, bench: false, loan: false, ideal: false, coach: true, ...(pf || {}) }; D.liga.pc = { ideal: 100000, cesionMax: 3, cesionMin: 0.25, cesionJornadas: 1, cesionAcabar: true }; }
    const M = Mo.analizar(D, S.H, S.c, {});
    let R = null, errPlan = null;
    try { R = Pm.planDeHoy(D, M, S.c); } catch (e) { errPlan = String(e.message || e); }
    const d = M.decisionBase('ent1');
    let ctx = '';
    try { ctx = I.contexto(D, M, S.c, { chat: true }); } catch (e) { ctx = `ERROR ${e.message}`; }
    const dv = M.decision ? M.decision('ent1') : null;
    return {
      accion: d && d.accion, regla: d && d.regla, porque: d && d.porque,
      conOferta: dv ? { accion: dv.accion, matiz: dv.matiz, oferta: dv.oferta, porque: dv.porque } : null, crudoEnt3: (D.mercado || []).some((m) => m.pid === 'ent3'),
      ctxTit: (ctx.match(/^.*Míster Uno.*$/m) || [''])[0].slice(0, 400), ctxForm: /LIGA PREMIUM\. Formaciones que puede usar/.test(ctx), ctxGratis: /JUEGA CON LA VERSIÓN GRATUITA/.test(ctx),
      vendePlan: !!(R && (R.ops || []).some((o) => o.accion === 'vender' && String(o.pid) === 'ent1' && !o.descartada)),
      vendeAuto: (() => { try { return (Mo.planAuto(D, M, S.c).operaciones || []).some((o) => o.accion === 'vender' && String(o.pid) === 'ent1'); } catch (e) { return `ERROR ${e.message}`; } })(),
      errPlan, acciones: (M.acciones || []).filter((a) => String(a.pid) === 'ent1').map((a) => a.tipo),
      ctxPrem: (ctx.match(/^LIGA PREMIUM.*$/m) || [''])[0], ctxLargo: ctx.length,
      ctxNoPuntua: /ENTRENADOR: no se alinea ni puntúa/.test(ctx), ctxPuntua: /ENTRENADOR: en esta liga premium se alinea uno y puntúa 5/.test(ctx), ctxDest: /ENTRENADOR DESTITUIDO/.test(ctx), ctxErr: /^ERROR/.test(ctx) ? ctx : null,
      entOnce: M.once && M.once.entrenador ? M.once.entrenador.id : null, onceN: M.once.lineas.flat().length, total: M.once.total,
      n: M.nPlantilla, fichas: M.mias.length, llena: M.llena, rec: M.RECOMPENSA, escudo: M.ESCUDO_H, premium: M.premium,
      noFichar: (() => { const libre = (M.mercado || []).find((m) => m.tipo !== 'manager' && !m.miPuja); const f = libre && M.decisionFichar ? M.decisionFichar(libre.pid) : null; return f ? `${f.accion}: ${f.porque || ''}` : null; })(),
      enMercado: (M.mercado || []).some((m) => (D.maestro[m.pid] || {}).pos === 5),
      // --- parte B ---
      b: (() => {
        const once = M.once.lineas.flat(), ids = new Set(once.map((j) => String(j.id)));
        const pps = once.map((j) => M.ppEsperado(j)), tope = Math.max(...pps);
        const cap = M.once.capitan, ban = M.once.banquillo;
        const mias = new Set(M.mias.map((x) => String(x.pid)));
        const pm = Vi.premiumOnce(M, M.once.lineas, null);
        if (otroEq) { M.ppEntrenador = (j) => (j.id === 'ent2' ? 4 : 1); }
        const dosPartido = otroEq ? M.mejorOnce(M.mias.map((x) => x.j)).entrenador : null;
        return {
          formas: M.formaciones.map((f) => f.join('-')), gratis: M.formacionesGratis.length, vale460: M.formacionVale('4-6-0'), vale433: M.formacionVale([4, 3, 3]), valeRara: M.formacionVale('9-9-9'),
          onceForma: M.once.nombre, onceHuecos: M.once.huecos, onceLineas: M.once.lineas.map((l) => l.length),
          cap: cap ? { id: cap.j.id, pos: cap.j.pos, pp: cap.pp, esTope: Math.abs(cap.pp - tope) < 1e-9, enOnce: ids.has(String(cap.j.id)) } : null,
          ban: ban ? ban.map((x) => ({ pos: x.pos, jpos: x.j.pos, enOnce: ids.has(String(x.j.id)), mio: mias.has(String(x.j.id)), estado: x.j.estado })) : null,
          alin: M.premiumAlinTxt(M.once, M.mias.map((x) => x.j)),
          entMerc: (M.entrenadoresMercado || []).map((m) => m.pid), fichar: (() => { const f = M.ficharEntrenador(); return f ? f.pid : null; })(), dosPartido: dosPartido ? dosPartido.id : null,
          pm: pm ? { cap: !!pm.cap, ban: pm.ban.length, ent: pm.ent ? pm.ent.j.id : null, fichar: pm.fichar ? pm.fichar.pid : null } : null,
          ctxCap: /LA APP PROPONE DE CAPITÁN A /.test(ctx), ctxBan: /LA APP PROPONE EN EL BANQUILLO: /.test(ctx), ctxFichar: /NO TIENE ENTRENADOR y fichar uno compensa/.test(ctx), ctxCapNombre: cap ? ctx.includes(`CAPITÁN A ${cap.j.nombre}`) : null,
        };
      })(),
    };
  };
  out.est = montar();
  out.pre = montar({ premium: true });
  out.preDos = montar({ premium: true, dos: true });
  out.preSinEnt = montar({ premium: true, pf: { coach: false, captain: true } });
  out.dest = montar({ premium: true, estado: 'out_of_league' });
  out.viejo = montar({ premium: true, sinPf: true });
  out.estOferta = montar({ oferta: true });
  out.preOferta = montar({ premium: true, oferta: true });
  out.e23 = montar({ jugadores: 23 });               // estándar: 23 jugadores + 1 entrenador = 24 fichas
  out.p23 = montar({ premium: true, jugadores: 23 });   // premium: los mismos, y no está llena
  out.p24 = montar({ premium: true, jugadores: 24 });   // premium con 24 jugadores: llena
  // --- parte B ---
  const TODO = { coach: true, captain: true, bench: true, formations: true, loan: true, ideal: true };
  out.todo = montar({ premium: true, pf: TODO });
  out.todoDos = montar({ premium: true, pf: TODO, otroEq: true });
  out.todoSinEnt = montar({ premium: true, pf: TODO, sinEnt: true });
  out.medios = montar({ premium: true, pf: TODO, soloMedios: true });
  out.mediosSinForm = montar({ premium: true, pf: { ...TODO, formations: false }, soloMedios: true });
  out.f460 = { lee: V.formaOnce({ formation: { tacticalFormation: [4, 6, 0] } }), mala: V.formaOnce({ formation: { tacticalFormation: [0, 6, 4] } }), suma: V.formaOnce({ formation: { tacticalFormation: [4, 4, 1] } }) };

  // (7) la alineación, como viene de /teams/{equipo}/lineup
  const jug = (id, pt) => ({ playerMaster: { id: String(id), positionId: 1 }, buyoutClause: 1, playerTeamId: String(pt) });
  const linea = (ids) => ids.map((i) => jug(i, 1000 + i));
  const formation = (mas) => ({ goalkeeper: linea([1]), defender: linea([2, 3, 4, 5]), midfield: linea([6, 7, 8]), striker: linea([9, 10, 11]), tacticalFormation: [4, 3, 3], ...mas });
  const A = (mas) => { const r = { formation: formation(mas), id: 1, team: { id: 1 } }; return { a: V.alineacionDe(r), ids: V.idsOnce(r), forma: V.formaOnce(r) }; };
  out.al = {
    estandar: A({ coach: [], bench: {} }),
    capObjeto: A({ coach: [jug(50, 1050)], bench: { goalkeeper: jug(20, 1020), defender: [jug(21, 1021)] }, captain: jug(9, 1009) }),
    capId: A({ coach: [jug(50, 1050)], bench: { striker: jug(22, 1022) }, captain: '7' }),
    capFicha: A({ coach: [], bench: {}, captain: 1006 }),
    capFichaObj: A({ coach: [], bench: {}, captain: { playerTeamId: '1003' } }),
    capRaro: A({ coach: [jug(50, 1050)], bench: { goalkeeper: 'x' }, captain: { id: 999 } }),
    banqTitular: A({ coach: [], bench: { defender: jug(3, 1003) } }),
    vieja: { ids: V.idsOnce({ formation: [jug(1, 1), jug(2, 2)] }), a: V.alineacionDe({ formation: [jug(1, 1)] }), nada: V.alineacionDe(null) },
  };
  return out;
});
if (P.errores.length) ok(false, `errores en la página: ${P.errores.join(' | ')}`);
await P.cerrar();

const todas = (pf) => Object.values(pf).every((v) => v === false);
// (1)
ok(r.l.sinCampo.premium === false && todas(r.l.sinCampo.pf), '(1) sin el campo `premium`: no es premium y ninguna función');
ok(r.l.estandar.premium === false && todas(r.l.estandar.pf) && !r.l.estandar.pc, '(1) premium false con funciones a true: ninguna cuenta');
ok(r.l.premium.premium === true && r.l.premium.pf.coach === true && r.l.premium.pf.ideal === true && r.l.premium.pf.captain === false && r.l.premium.pf.bench === false, '(1) premium true: cuentan solo las funciones a true (entrenador y 11 ideal; capitán y banquillo no)');
ok(r.l.premium.pc && r.l.premium.pc.ideal === 100000 && r.l.premium.pc.cesionMax === 3 && r.l.premium.pc.cesionMin === 0.25, '(1) lo configurado: 11 ideal 100.000, cesiones 3 como mucho y 25 % de mínimo');
ok(r.l.premiumSinConfig.premium === true && todas(r.l.premiumSinConfig.pf), '(1) premium true sin `config`: premium, pero ninguna función encendida');
ok(r.l.premiumRaro.premium === false, '(1) `premium` que no es true exacto: no es premium');
// (2)
ok(r.est.accion === 'vender' && r.est.regla === 'entrenador', `(2) estándar: el entrenador se vende (${r.est.porque})`);
ok(r.est.vendePlan === true && r.est.vendeAuto === true, '(2) estándar: el plan lleva su venta, como siempre');
ok(r.est.ctxNoPuntua && !r.est.ctxPuntua, '(2) estándar: la IA lee que no se alinea ni puntúa');
ok(r.est.entOnce === null && r.est.rec === 100000 && r.est.escudo === 24 && !r.est.premium.liga, '(2) estándar: sin entrenador en el once, recompensa de 100 mil, blindaje de 24 h');
// (3)
ok(r.pre.accion === 'aguantar' && r.pre.regla === 'entrenador', `(3) premium con entrenador: se aguanta (${r.pre.porque})`);
ok(r.pre.vendePlan === false && r.pre.vendeAuto === false && !r.pre.errPlan, `(3) premium: el plan no lo vende${r.pre.errPlan ? ` (${r.pre.errPlan})` : ''}`);
ok(!r.pre.acciones.includes('vender'), `(3) premium: «Ahora mismo» no manda venderlo (${r.pre.acciones.join(',') || 'nada'})`);
ok(r.pre.ctxPuntua && !r.pre.ctxNoPuntua && !r.pre.ctxErr, `(3) premium: la IA lee que puntúa 5, 2 o 0${r.pre.ctxErr ? ` (${r.pre.ctxErr})` : ''}`);
ok(r.pre.entOnce === 'ent1' && r.pre.onceN === r.est.onceN && Math.abs(r.pre.total - r.est.total) < 1e-9, '(3) premium: el entrenador va en el once, y los once jugadores y su total son los mismos');
ok(r.preDos.entOnce === 'ent2', `(3) premium con dos entrenadores: se alinea uno, el que más puntos lleva por jornada (${r.preDos.entOnce})`);
ok(r.preSinEnt.accion === 'vender' && r.preSinEnt.entOnce === null && r.preSinEnt.premium.capitan === true, '(3) premium con el entrenador APAGADO por el administrador: no se alinea, como en estándar');
ok(r.pre.crudoEnt3 && r.pre.enMercado === false && r.est.enMercado === false, '(3) un entrenador libre en el mercado de LaLiga no se mezcla con los jugadores en el de la app (parte B)');
ok(r.estOferta.conOferta && r.estOferta.conOferta.accion === 'vender', `(3) estándar, entrenador con oferta: vender, como siempre (${r.estOferta.conOferta && r.estOferta.conOferta.matiz})`);
ok(r.preOferta.conOferta && r.preOferta.conOferta.accion === 'aguantar' && r.preOferta.conOferta.oferta === 'esperar' && /No aceptes la oferta/.test(r.preOferta.conOferta.porque), `(3) premium, entrenador con una oferta un 8 % por encima: no se acepta sola (${r.preOferta.conOferta && r.preOferta.conOferta.porque})`);
ok(r.preOferta.vendePlan === false && r.estOferta.vendePlan === true, `(3) y el plan dice lo mismo que la decisión: en premium no lleva «aceptar la oferta» por el entrenador (estándar: ${r.estOferta.vendePlan}, premium: ${r.preOferta.vendePlan})`);
ok(r.pre.ctxForm && !r.pre.ctxGratis && r.est.ctxGratis && !r.est.ctxForm, '(3) la IA ya no lee «juega con la versión gratuita» en una liga premium (y sí en estándar)');
ok(!/suplente/i.test(r.pre.ctxTit), `(3) premium: el entrenador alineado no le sale a la IA como suplente (${r.pre.ctxTit.slice(0, 160)})`);
ok(/^LIGA PREMIUM/.test(r.pre.ctxPrem) && /ENTRENADOR: se alinea 1/.test(r.pre.ctxPrem) && /APAGADO: capitán, banquillo, formaciones de más, cesiones, premio del 11 ideal\./.test(r.pre.ctxPrem) && /200 mil/.test(r.pre.ctxPrem) && /48 h/.test(r.pre.ctxPrem), `(3) premium: la IA lee las reglas de lo encendido y qué está apagado (${r.pre.ctxPrem.length} caracteres)`);
ok(/CAPITÁN: uno del once puntúa doble/.test(r.preSinEnt.ctxPrem) && /APAGADO: entrenador \(no se alinea ni puntúa\)/.test(r.preSinEnt.ctxPrem), '(3) premium con capitán y sin entrenador: lo dice así');
ok(r.est.ctxPrem === '' && r.viejo.ctxPrem === '', '(3) en una liga estándar (y en una premium guardada sin sus funciones) la IA no lee nada de premium');
ok(r.pre.ctxLargo - r.est.ctxLargo < 900, `(3) lo que crece lo que lee la IA en premium: ${r.pre.ctxLargo - r.est.ctxLargo} caracteres (0 en estándar)`);
// (4)
ok(r.dest.accion === 'vender' && /no puntúa/.test(r.dest.porque) && r.dest.entOnce === null, `(4) destituido en premium: vender y fuera del once (${r.dest.porque})`);
ok(r.dest.vendePlan === true && r.dest.ctxDest, '(4) destituido: el plan lleva su venta y la IA lo lee como destituido');
// (5)
ok(r.e23.fichas === 24 && r.e23.n === 24 && r.e23.llena === true, `(5) estándar, 23 jugadores y 1 entrenador: cuenta 24 y está llena (${r.e23.n})`);
ok(r.p23.fichas === 24 && r.p23.n === 23 && r.p23.llena === false, `(5) premium, 23 jugadores y 1 entrenador: cuenta 23 y NO está llena (${r.p23.n})`);
ok(r.p24.n === 24 && r.p24.llena === true, `(5) premium, 24 jugadores y 1 entrenador: llena (${r.p24.n})`);
ok(/plantilla llena \(24\)/.test(r.e23.noFichar || '') && !/plantilla llena/.test(r.p23.noFichar || '') && /plantilla llena \(24\)/.test(r.p24.noFichar || ''), `(5) «no puedes fichar: plantilla llena» sale con la misma cuenta (estándar: ${(r.e23.noFichar || '').slice(0, 40)}… / premium 23: ${(r.p23.noFichar || 'nada').slice(0, 40)})`);
// (6)
ok(r.pre.rec === 200000 && r.pre.escudo === 48 && r.pre.premium.liga, '(6) premium: recompensa diaria de 200 mil y blindaje de 48 h');
// (7)
const al = r.al;
ok(al.estandar.a.once.length === 11 && al.estandar.ids.length === 11 && al.estandar.a.capitan === null && al.estandar.a.entrenador === null && !al.estandar.a.hay.capitan && !al.estandar.a.hay.banquillo, '(7) alineación estándar (coach [] y bench {}): once de 11, sin capitán, banquillo ni entrenador');
ok(al.capObjeto.a.capitan === '9' && al.capObjeto.a.entrenador === '50' && al.capObjeto.a.banquillo[1] === '20' && al.capObjeto.a.banquillo[2] === '21' && al.capObjeto.a.once.length === 11, '(7) capitán como jugador entero, banquillo con un jugador o una lista por puesto, entrenador alineado');
ok(al.capObjeto.ids.length === 12 && al.capObjeto.ids.includes('50') && !al.capObjeto.ids.includes('20') && !al.capObjeto.ids.includes('21'), '(7) los ids de la alineación: los once y el entrenador, nunca el banquillo');
ok(al.capId.a.capitan === '7' && al.capId.a.banquillo[4] === '22', '(7) capitán como id de jugador');
ok(al.capFicha.a.capitan === '6' && al.capFichaObj.a.capitan === '3', '(7) capitán como `playerTeamId` (suelto o dentro de un objeto)');
ok(al.capRaro.a.capitan === null && al.capRaro.a.hay.capitan === true && !al.capRaro.ids.includes('999') && al.capRaro.ids.length === 12, '(7) capitán que no se reconoce: null (y se sabe que había uno), sin colar su id en el once');
ok(Object.keys(al.capRaro.a.banquillo).length === 1 && al.capRaro.a.banquillo[1] === 'x', '(7) hueco del banquillo como id suelto');
ok(Object.keys(al.banqTitular.a.banquillo).length === 0, '(7) uno del once no puede estar a la vez en el banquillo');
ok(al.vieja.ids.length === 2 && al.vieja.a.once.length === 0 && al.vieja.nada.once.length === 0, '(7) una alineación con otra forma: `idsOnce` como antes y `alineacionDe` vacío, sin romperse');
ok(Array.isArray(al.capObjeto.forma) && al.capObjeto.forma.join() === '4,3,3', '(7) la formación se sigue leyendo');
// (8)
ok(r.viejo.accion === 'vender' && r.viejo.premium.liga === true && r.viejo.premium.entrenador === false && r.viejo.escudo === 48 && r.viejo.n === r.viejo.fichas, '(8) liga premium guardada sin `pf`: ninguna función activa hasta actualizar (solo el blindaje de 48 h y la recompensa)');

// ---------- parte B ----------
const PREM = ['5-2-3', '4-6-0', '4-2-4', '3-6-1', '3-3-4'];
const t = r.todo.b, e = r.est.b, p = r.pre.b;
// (9)
ok(PREM.every((f) => t.formas.includes(f)) && t.formas.length === t.gratis + 5 && t.vale460 === true, `(9) premium con las formaciones encendidas: las de siempre y las 5 de más (${t.formas.length})`);
ok(!PREM.some((f) => p.formas.includes(f)) && p.vale460 === false && p.vale433 === true && !PREM.some((f) => e.formas.includes(f)) && e.vale460 === false, '(9) con esa función apagada (o en estándar): solo las de siempre, y un 4-6-0 no vale');
ok(t.valeRara === null, '(9) una formación que no se entiende: ni vale ni deja de valer');
ok(r.f460.lee && r.f460.lee.join() === '4,6,0' && r.f460.mala === null && r.f460.suma === null, '(9) la formación 4-6-0 de LaLiga se lee (y una sin defensas o que no suma 10, no)');
ok(r.medios.b.onceForma === '4-6-0' && r.medios.b.onceHuecos === 0 && r.medios.b.onceLineas.join() === '1,4,6,0', `(9) sin delanteros y con medios de sobra, el mejor once es un 4-6-0 entero (${r.medios.b.onceForma}, ${r.medios.b.onceHuecos} huecos)`);
ok(r.mediosSinForm.b.onceForma !== '4-6-0' && r.mediosSinForm.b.onceHuecos > 0, `(9) la misma plantilla con las formaciones apagadas: una de las de siempre, con huecos (${r.mediosSinForm.b.onceForma}, ${r.mediosSinForm.b.onceHuecos})`);
// (10)
ok(t.cap && t.cap.esTope && t.cap.enOnce && t.cap.pos >= 1 && t.cap.pos <= 4 && t.cap.pp > 0, '(10) el capitán: el de más puntos esperados del once, y nunca el entrenador');
ok(e.cap === null && p.cap === null && r.preSinEnt.b.cap !== null && r.preSinEnt.b.ban === null, '(10) sin la función encendida no hay capitán (ni en estándar); con solo el capitán encendido, capitán sí y banquillo no');
ok(/ Capitán: /.test(t.alin) && e.alin === '' && p.alin === '', `(10) el paso de alinear del plan lo lleva solo en premium (${t.alin.trim().slice(0, 90)})`);
// (11)
ok(Array.isArray(t.ban) && t.ban.length >= 1 && t.ban.length <= 4 && new Set(t.ban.map((x) => x.pos)).size === t.ban.length, `(11) el banquillo: uno por puesto como mucho (${t.ban && t.ban.map((x) => x.pos).join(',')})`);
ok(t.ban.every((x) => x.jpos === x.pos && !x.enOnce && x.mio && !['injured', 'suspended', 'out_of_league'].includes(x.estado)), '(11) cada suplente es de su puesto, tuyo, no está en el once ni de baja');
ok(e.ban === null && p.ban === null, '(11) sin la función encendida no hay banquillo');
ok(!r.medios.b.ban.some((x) => x.pos === 4), '(11) con un 4-6-0 no hay suplente de delantero');
ok(/ Banquillo: /.test(t.alin), '(11) el paso de alinear del plan lleva el banquillo');
// (12)
ok(r.todoDos.b.dosPartido === 'ent2', `(12) con dos entrenadores se alinea el de mejor partido, aunque lleve menos puntos por jornada (${r.todoDos.b.dosPartido})`);
ok(t.entMerc.includes('ent3') && e.entMerc.length === 0 && r.preSinEnt.b.entMerc.length === 0, '(12) los entrenadores del mercado van aparte, solo en una liga premium que los tiene');
ok(t.fichar === null && r.todoSinEnt.b.fichar === 'ent3' && e.fichar === null, `(12) con entrenador no se propone fichar otro; sin ninguno, el libre del mercado (${r.todoSinEnt.b.fichar})`);
ok(r.todoSinEnt.vendePlan === false && !r.todoSinEnt.errPlan && r.todoSinEnt.enMercado === false, '(12) y el plan sigue saliendo, con los entrenadores fuera del mercado de jugadores');
// (13)
ok(t.ctxCap && t.ctxBan && t.ctxCapNombre === true && !e.ctxCap && !e.ctxBan && !p.ctxCap, '(13) la IA lee el capitán y el banquillo que propone la app, solo con esas funciones encendidas');
ok(r.todoSinEnt.b.ctxFichar && !t.ctxFichar && !e.ctxFichar, '(13) y, sin entrenador, que fichar uno compensa y cuál');
ok(t.pm && t.pm.cap && t.pm.ban === t.ban.length && e.pm === null, '(13) Equipo pinta el mismo capitán y el mismo banquillo que el motor, y nada en estándar');
ok(r.todoSinEnt.b.pm && r.todoSinEnt.b.pm.fichar === 'ent3' && r.todoDos.b.pm && r.todoDos.b.pm.ent, '(13) Equipo: sin entrenador, el que conviene fichar; con dos, cuál alinear');
ok(r.todo.ctxLargo - r.est.ctxLargo < 1650, `(13) lo que crece lo que lee la IA con todo encendido: ${r.todo.ctxLargo - r.est.ctxLargo} caracteres (0 en estándar; solo con entrenador, ${r.pre.ctxLargo - r.est.ctxLargo})`);

await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo bien');
process.exit(mal ? 1 : 0);
