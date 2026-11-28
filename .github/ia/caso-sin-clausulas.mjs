// Liga sin cláusulas (28 nov, aviso de Neoplatel: «en las ligas donde estén desactivadas las cláusulas, que no te
// notifique blindar ni pagar cláusulas rivales»). El administrador de una liga puede quitar las cláusulas
// (`config.features.buyoutClause` = false en /leagues; normalizar.js, `clausulasDe`). Sin red, con la liga de ejemplo:
//  (a) con cláusulas (como siempre) la prueba ve cláusulas en pantalla: si no, la búsqueda de abajo no valdría
//  (b) la misma liga con `D.liga.clausulas = false`: el motor sin cláusulas de rivales, sin riesgo, sin nada que blindar ni
//      proteger y sin subidas de cláusula en la cuenta del dinero; el catálogo de la IA sin C- ni B-; el plan sin
//      clausular, blindar ni «a la venta para ver ofertas»; la IA lee que la liga no tiene cláusulas; el repaso tacha un
//      «blindar» o «clausular» que proponga la IA; y NINGUNA pestaña, sección ni ficha (tuya, de un rival o de un jugador
//      de un rival) dice «cláusula», «blindar», «blindaje», «escudo» ni «clausulazo»
//  (c) sin el campo (null: liga guardada de antes o que LaLiga no lo mande) todo sigue como en (a)
//  (d) normalizar.js: false, true y sin campo
// Uso: PW_MODULO=… node .github/ia/caso-sin-clausulas.mjs   (sale con 1 si algo falla; VER=1 enseña los textos que fallan)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const PALABRAS = /cl[aá]usul|blind|escudo/i;

// todas las pestañas con sus secciones, las fichas de tus jugadores, las de los rivales y las de unos jugadores suyos
const recorrer = (page) => page.evaluate(async () => {
  const S = window.S, esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const quitarHojas = () => { for (const e of document.querySelectorAll('.hoja, .velo, .hoja-velo')) e.remove(); S.pila = []; };
  const out = [];
  // los nombres de los equipos y mánagers no cuentan (en la liga de ejemplo hay un «Unión Clausulera» y un «Club Clausulazo»)
  const nombres = (S.D.clasif || []).flatMap((e) => [e.nombre, e.manager]).filter(Boolean).sort((a, b) => b.length - a.length);
  const limpio = (t) => nombres.reduce((s, n) => s.split(n).join('·').split(n.toUpperCase()).join('·'), t || '');
  const push0 = out.push.bind(out);
  out.push = (o) => push0({ ...o, txt: limpio(o.txt) });
  const nav = [...document.querySelectorAll('.nav button[data-ir]')].map((b) => b.dataset.ir).filter((k) => k !== 'ia');
  for (const k of nav) {
    document.querySelector(`.nav button[data-ir="${k}"]`).click();
    await esperar(250);
    const v = document.querySelector('#vista');
    out.push({ donde: k, txt: v ? v.innerText : '' });
    const segs = [...document.querySelectorAll('#vista [data-seg]')].map((b) => b.dataset.seg);
    for (const s of [...new Set(segs)]) {
      const b = document.querySelector(`#vista [data-seg="${s}"]`);
      if (!b) continue;
      b.click();
      await esperar(250);
      out.push({ donde: `${k} → ${s}`, txt: (document.querySelector('#vista') || {}).innerText || '' });
    }
  }
  quitarHojas();
  const abrir = async (attr, id) => {
    const b = document.createElement('button');
    b.setAttribute(attr, id);
    document.body.appendChild(b);
    b.click();
    await esperar(300);
    const segs = [...document.querySelectorAll('.hoja [data-seg], .hoja [data-pest], .hoja .tabs button')];
    let txt = [...document.querySelectorAll('.hoja')].map((h) => h.innerText).join('\n');
    for (const sb of segs) { try { sb.click(); await esperar(150); txt += `\n${[...document.querySelectorAll('.hoja')].map((h) => h.innerText).join('\n')}`; } catch (e) { /* nada */ } }
    b.remove();
    quitarHojas();
    return txt;
  };
  for (const x of S.M.mias) out.push({ donde: `ficha de ${x.j.nombre} (tuyo)`, txt: await abrir('data-j', x.pid) });
  for (const tid of S.M.rivalesTid || []) out.push({ donde: `ficha del rival ${tid}`, txt: await abrir('data-r', tid) });
  const suyos = Object.entries(S.D.plantillas || {}).filter(([tid]) => tid !== String(S.D.yo.teamId)).flatMap(([, fs]) => fs.slice(0, 3).map((f) => f.pid));
  for (const pid of suyos.slice(0, 12)) out.push({ donde: `ficha de ${(S.D.maestro[pid] || {}).nombre} (de un rival)`, txt: await abrir('data-j', pid) });
  return out;
});

const motor = (page) => page.evaluate(async () => {
  const S = window.S, I = await import('./js/ia.js'), Op = await import('./js/operaciones.js'), Pl = await import('./js/plan.js'), Dt = await import('./js/datos.js');
  const M = S.M, D = S.D;
  const cat = Op.catalogo(D, M);
  const refs = Object.keys(cat.ref || {});
  let plan = null, err = '';
  try { plan = Pl.planDeHoy(D, M, S.c); } catch (e) { err = e.message; }
  const ops = plan ? plan.ops || [] : [];
  const ctx = I.contexto(D, M, Dt.cfg());
  const x = M.mias.find((y) => y.j.pos !== 5) || M.mias[0];
  const r = I.cuadrarPlan({ dia: new Date().toISOString().slice(0, 10), t: Date.now(), titular: 'Plan', situacion: 'x', operaciones: [
    { accion: 'blindar', ref: `B-${x.pid}`, jugador: x.j.nombre, importe: 0, cuando: 'ahora', motivo: 'x' },
    { accion: 'clausular', jugador: (Object.values(D.plantillas).flat().find((f) => M.dueno[f.pid] !== String(D.yo.teamId)) || {}).pid ? D.maestro[Object.values(D.plantillas).flat().find((f) => M.dueno[f.pid] !== String(D.yo.teamId)).pid].nombre : 'Nadie', importe: 5e6, cuando: 'ahora', motivo: 'x' },
  ] }, D, M);
  const vivos = (r && r.ops || []).filter((o) => ['blindar', 'clausular'].includes(o.accion) && !o.descartada && !o.tachada);
  const subidas = Object.values(M.subidas || {}).reduce((s, v) => s + Math.abs(v.v || 0) + (v.lista || []).length + (v.idas || []).length, 0);
  return {
    sin: M.sinClausulas, rivales: M.clausulas.length, conRiesgo: M.mias.filter((y) => y.riesgo !== 'ninguno').length,
    conClausula: M.mias.filter((y) => y.clausula).length, abiertas: M.mias.filter((y) => y.abierta || y.escudoYa).length,
    escudo: (M.paraEscudo || []).length, blindajes: M.mias.filter((y) => y.blindaje).length, pagan: M.mias.filter((y) => y.pagan).length,
    czs: (M.clausulazos || {}).n || 0, subidas,
    refs: refs.filter((k) => /^[CB]-/.test(k)), err,
    pasos: ops.filter((o) => ['clausular', 'blindar', 'tantear'].includes(o.accion) || /^[CBO]-/.test(o.ref || o._k || '')).map((o) => `${o.accion} ${o.jugador}`),
    dias: (JSON.stringify((plan && (plan.proximos_dias || plan.diasAuto)) || []).match(/.{0,80}(cl[aá]usul|blind|escudo).{0,40}/i) || [''])[0],
    ctxSin: /NO TIENE CLÁUSULAS/.test(ctx), ctxProteger: [...ctx.split('\n'), ...I.contexto(D, M, Dt.cfg(), { chat: true }).split('\n')].map((l) => (D.clasif || []).flatMap((e) => [e.nombre, e.manager]).filter(Boolean).reduce((t, n) => t.split(n).join('·'), l)).filter((l) => !/NO TIENE CLÁUSULAS/.test(l) && /cl[aá]usul|blind|escudo|C-\d|B-\d/i.test(l)).slice(0, 4).map((l) => l.slice(0, 160)),
    acciones: (M.acciones || []).filter((a) => ['clausular', 'blindar', 'proteger'].includes(a.tipo)).map((a) => `${a.tipo} ${a.pid}`),
    vivos: vivos.map((o) => `${o.accion} ${o.jugador}`),
  };
  function PAL() { return /cl[aá]usul|blind|escudo/i; }
});

const sinCampo = (page, v) => page.evaluate(async (v) => {
  const S = window.S;
  if (v === 'quitar') delete S.D.liga.clausulas; else S.D.liga.clausulas = v;
  // una liga sin cláusulas no tiene clausulazos ni blindajes en sus movimientos (la de ejemplo sí): se quitan, como en una de verdad
  if (v === false) {
    window.__actAntes ||= { a: S.D.actividad, m: S.H && S.H.mov };
    S.D.actividad = (S.D.actividad || []).filter((a) => !['clausula', 'blindaje'].includes(a.clase));
    if (S.H && S.H.mov) S.H.mov = S.H.mov.filter((m) => m.tipo !== 'blinda');
  } else if (window.__actAntes) { S.D.actividad = window.__actAntes.a; if (S.H) S.H.mov = window.__actAntes.m; window.__actAntes = null; }
  window.__fmRehacer();
  await new Promise((r) => setTimeout(r, 400));
  return !!S.M.sinClausulas;
}, v);

const P = await pagina('martes');
try {
  // (d) normalizar.js
  const n = await P.page.evaluate(async () => {
    const N = await import('./js/normalizar.js');
    return [N.clausulasDe({ config: { features: { buyoutClause: false } } }).clausulas, N.clausulasDe({ config: { features: { buyoutClause: true } } }).clausulas,
      N.clausulasDe({ config: {} }).clausulas, N.clausulasDe(null).clausulas, N.clausulasDe({ config: { features: { buyoutClause: 0 } } }).clausulas];
  });
  ok(n[0] === false && n[1] === true && n[2] === null && n[3] === null && n[4] === null, `(d) normalizar: false, true y sin campo → ${JSON.stringify(n)}`);

  // (a) con cláusulas
  await sinCampo(P.page, true);
  const A = await motor(P.page), vA = await recorrer(P.page);
  const conPal = vA.filter((v) => PALABRAS.test(v.txt));
  ok(!A.sin && A.rivales > 0 && A.conClausula > 0, `(a) con cláusulas: ${A.rivales} de rivales, ${A.conClausula} tuyas`);
  ok(conPal.length >= 5, `(a) la búsqueda vale: ${conPal.length} de ${vA.length} pantallas dicen «cláusula» o «blindar»`);

  // (c) sin el campo
  const c = await sinCampo(P.page, 'quitar');
  const C = await motor(P.page);
  ok(!c && C.rivales === A.rivales && C.conClausula === A.conClausula && C.refs.length === A.refs.length, `(c) sin el campo, como siempre: ${C.rivales} de rivales, ${C.conClausula} tuyas`);
} finally {
  await P.cerrar();
}

// (b) sin cláusulas, en varias escenas: un martes, el cierre de la jornada, con ella en juego, el parón y con una tuya abierta
for (const esc of (process.env.ESCENAS || 'martes,veda,enjuego,paron,m-clausula-mia,m-cierre').split(',')) {
  const Q = await pagina(esc);
  try {
    console.log(`\n· ${esc}`);
    const s = await sinCampo(Q.page, false);
    const B = await motor(Q.page);
    ok(s && B.sin, '(b) el motor sabe que la liga no tiene cláusulas');
    ok(B.rivales === 0 && B.conClausula === 0 && B.abiertas === 0, `(b) ni cláusulas de rivales ni tuyas: ${B.rivales}, ${B.conClausula}, ${B.abiertas} abiertas`);
    ok(B.conRiesgo === 0 && B.escudo === 0 && B.blindajes === 0 && B.pagan === 0, `(b) sin riesgo, sin nada que blindar ni quién paga: ${B.conRiesgo}, ${B.escudo}, ${B.blindajes}, ${B.pagan}`);
    ok(B.czs === 0 && B.subidas === 0, `(b) ni clausulazos ni subidas de cláusula en el dinero: ${B.czs}, ${B.subidas}`);
    ok(!B.refs.length, `(b) el catálogo de la IA sin C- ni B-: ${B.refs.join(', ') || 'ninguna'}`);
    ok(!B.err && !B.pasos.length && !B.dias, `(b) el plan sin clausular, blindar ni proteger: ${B.err || B.pasos.join(' · ') || 'nada'}${B.dias ? ` · los próximos días: ${B.dias}` : ''}`);
    ok(!B.acciones.length, `(b) «Ahora mismo» sin cláusulas: ${B.acciones.join(' · ') || 'nada'}`);
    ok(B.ctxSin && !B.ctxProteger.length, `(b) la IA lee que no hay cláusulas y nada que proteger: ${B.ctxSin} ${B.ctxProteger.join(' | ')}`);
    ok(!B.vivos.length, `(b) el repaso tacha «blindar» y «clausular» de la IA: ${B.vivos.join(' · ') || 'tachados'}`);
    const vB = await recorrer(Q.page);
    const malB = vB.filter((v) => PALABRAS.test(v.txt));
    for (const v of malB) {
      const l = v.txt.split('\n').filter((y) => PALABRAS.test(y)).slice(0, 4);
      console.log(`     ${v.donde}: ${l.map((y) => y.trim().slice(0, 140)).join(' ‖ ')}`);
    }
    ok(!malB.length, `(b) ninguna de las ${vB.length} pantallas habla de cláusulas ni blindajes (${malB.length} lo hacen)`);
    ok(!Q.errores.length, `sin errores en la página: ${Q.errores.slice(0, 3).join(' | ') || 'ninguno'}`);

  } finally {
    await Q.cerrar();
  }
}
await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
