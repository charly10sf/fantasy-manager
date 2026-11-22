// Lo que el mánager cuenta en Pregunta MANDA en el plan y se ve en él (22 nov, Carlos: «le dije a la IA que no me quedan
// blindajes; contestó "Entendido, lo quito del plan" y el plan rehecho salió con "Hoy toca blindar a Thiago gratis"»).
// Sin red, con la liga de ejemplo y un titular suyo a tiro de un rival (cláusula a su valor, abierta) para que la app
// quiera blindarlo:
//  (a) el fallo de la cuenta: sus blindajes de hace días no vienen en lo que se baja hoy, pero están en el historial
//      guardado → quedan 0 y nadie manda blindar
//  (b) «no me quedan blindajes» dicho en Pregunta, en la pantalla: se apunta antes de preguntar, la IA lee los datos ya
//      corregidos, el plan de Hoy deja de mandar blindar, sale «Lo que me has dicho» y se quita con su ×
//  (c) «a X no lo vendo» y «ya he pujado por Y»: fuera las ventas de X (plan, catálogo, Hoy, chat) y la puja por hecha
//  (d) sin nombrar al jugador («a ese no lo vendo»): manda el jugador que apunta la IA, si es suyo
//  (e) la IA promete («lo quito del plan», «lo tendré en cuenta») sin que se haya apuntado nada: la app lo dice
//  (f) una pregunta o una condición no apuntan nada
// Uso: PW_MODULO=… node .github/ia/caso-dicho.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

/* un titular suyo con la cláusula a su valor y abierta, un rival con dinero de sobra y nada suyo en venta */
const PREP = `const yo = S.D.yo.teamId;
  const f = S.D.plantillas[yo].map((x) => ({ x, j: S.D.maestro[x.pid] })).filter((y) => y.j.pos !== 5 && y.j.pos !== 1 && y.j.estado === 'ok').sort((a, b) => b.j.media - a.j.media)[0];
  f.x.clausula = Math.round(f.j.valor * 1.02); f.x.protegidoHasta = null;
  S.D.misVentas = [];
  const rival = S.D.clasif.find((e) => e.teamId !== yo).teamId;
  S.D.dineros = { ...(S.D.dineros || {}), [rival]: { v: 500e6, fuente: 'LaLiga' } };
  window.__blindable = f.x.pid;`;

/* ---------- (a) la cuenta de blindajes con el historial ---------- */
{
  const P = await pagina('martes');
  const r = await P.page.evaluate(async (prep) => {
    const S = window.S, Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js');
    // eslint-disable-next-line no-new-func
    new Function('S', prep)(S);
    const D = S.D, yo = D.yo.teamId, yoE = D.clasif.find((e) => e.teamId === yo);
    D.actividad = (D.actividad || []).filter((a) => a.clase !== 'blindaje');
    const M0 = Mo.analizar(D, S.H, S.c, {});
    const R0 = Pm.planMotor(D, M0, Dt.cfg());
    // dos blindajes suyos de hace unas horas (después de acabar la última jornada): no vienen en lo de hoy, sí en el historial guardado
    const bl = (h) => ({ id: `bl${h}`, t: Date.now() - h * 3600e3, clase: 'blindaje', tipo: 4, pid: M0.mias[3].pid, quienId: yoE.userId || yoE.managerId || null, quien: yoE.manager });
    const AH = { lista: [...D.actividad, bl(2), bl(6)], completa: true };
    const M1 = Mo.analizar(D, S.H, S.c, { actHist: AH });
    const R1 = Pm.planMotor(D, M1, Dt.cfg());
    // uno de antes de acabar la última jornada no cuenta, y el de otro mánager tampoco
    const otro = D.clasif.find((e) => e.teamId !== yo);
    const AH2 = { lista: [...D.actividad, { ...bl(2), t: M0.escudosMios.desde - 3600e3, id: 'viejo' }, { ...bl(3), id: 'otro', quienId: otro.userId || otro.managerId || null, quien: otro.manager }], completa: true };
    const M2 = Mo.analizar(D, S.H, S.c, { actHist: AH2 });
    const bli = (R) => (R.operaciones || R.ops || []).filter((o) => o.accion === 'blindar' && !o.importe).length;
    return { antes: { quedan: M0.escudosMios.quedan, pe: M0.paraEscudo.length, b: bli(R0), es: M0.paraEscudo.includes(window.__blindable) }, con: { quedan: M1.escudosMios.quedan, vistos: M1.escudosMios.vistos, pe: M1.paraEscudo.length, b: bli(R1) }, ajenos: M2.escudosMios.quedan };
  }, PREP);
  ok(r.antes.quedan === 2 && r.antes.pe >= 1 && r.antes.b >= 1, `la escena: con 2 blindajes la app quiere blindar a su titular a tiro (${r.antes.b} en el plan)`);
  ok(r.con.quedan === 0 && r.con.vistos === 2 && r.con.pe === 0 && r.con.b === 0, `dos blindajes suyos que no vienen en lo que se baja hoy, solo en el historial guardado: quedan ${r.con.quedan} y el plan no manda blindar (${r.con.b})`);
  ok(r.ajenos === 2, `uno de antes de acabar la última jornada y el de otro mánager no cuentan (quedan ${r.ajenos})`);
  ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
  await P.cerrar();
}

/* ---------- (b) «no me quedan blindajes», en la pantalla ---------- */
{
  const dicho = [];
  const P = await pagina('martes', (cuerpo) => {
    dicho.push(JSON.stringify(cuerpo));
    return 'Entendido, lo quito del plan. Para la próxima vez, el plan no debe depender de un blindaje.';
  });
  await P.page.evaluate(async (prep) => {
    const S = window.S, Mo = await import('./js/motor.js');
    // eslint-disable-next-line no-new-func
    new Function('S', prep)(S);
    S.D.actividad = (S.D.actividad || []).filter((a) => a.clase !== 'blindaje');
    S.M = Mo.analizar(S.D, S.H, S.c, {});
  }, PREP);
  // Hoy, antes: el plan manda blindar
  await P.page.evaluate(() => document.querySelector('[data-ir="hoy"], [data-v="hoy"]')?.click());
  // (el plan de la pantalla se rehace al entrar la primera nota; antes se mira el del motor)
  const antes = await P.page.evaluate(async () => { const Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js'); const R = Pm.planDeHoy(window.S.D, window.S.M, Dt.cfg()); return { b: R.ops.filter((o) => !o.descartada && o.accion === 'blindar').map((o) => o.jugador || o.j.nombre), tit: R.titular }; });
  ok(antes.b.length >= 1 && /blind|proteg/i.test(antes.tit), `antes de decir nada, el plan manda blindar: «${antes.tit}»`);
  await P.page.evaluate(() => document.querySelector('[data-ir="ia"], #bPregunta')?.click());
  await P.page.waitForSelector('#pregunta', { timeout: 8000 });
  await P.page.fill('#pregunta', 'No me quedan más blindajes, tenlo en cuenta la próxima vez que rehagas el plan');
  await P.page.click('[data-accion="enviar"]');
  await P.page.waitForFunction(() => !window.S.charlando && document.querySelectorAll('.msg.ia').length >= 1, null, { timeout: 30000 });
  const tras = await P.page.evaluate(async () => {
    const S = window.S, I = await import('./js/ia.js'), Dt = await import('./js/datos.js');
    const ult = [...document.querySelectorAll('.msg.ia')].pop();
    return { quedan: S.M.escudosMios.quedan, dicho: (S.M.dicho || []).map((n) => `${n.corr}:${n.txt}`), pe: S.M.paraEscudo.length, notas: I.notasVigentes().filter((n) => n.corr).map((n) => `${n.corr}:${n.n}:${n.caduca === S.M.escudosMios.hasta}`),
      planB: (S.plan.ops || []).filter((o) => !o.descartada && o.accion === 'blindar' && !o.importe).length, tit: S.plan.titular, msg: ult ? ult.innerText : '',
      ctx: I.contexto(S.D, S.M, Dt.cfg(), { chat: true }).split('\n').find((l) => l.startsWith('BLINDAJES')) || '' };
  });
  ok(tras.quedan === 0 && tras.pe === 0 && tras.notas.join() === 'blindajes:0:true', `se apunta al leer su mensaje y el motor lo cuenta: quedan ${tras.quedan}, hasta que se recarguen (${tras.notas.join()})`);
  ok(tras.planB === 0 && !/blind|proteg/i.test(tras.tit), `el plan de Hoy ya no manda blindar: «${tras.tit}»`);
  ok(/Apuntado:.*No te quedan blindajes/s.test(tras.msg) && !/no se ha apuntado nada/i.test(tras.msg), 'debajo de la respuesta sale «Apuntado: No te quedan blindajes…» y la app no la desmiente');
  ok(dicho.length === 1 && /LO QUE ACABA DE CONTARTE EN ESTE MENSAJE Y LA APP YA HA APUNTADO[^"]*No le quedan blindajes/.test(dicho[0]) && /me quedan 0 de 2 \(me lo ha dicho él/.test(dicho[0]) && !/CONVIENE BLINDARLO HOY/.test(dicho[0]), 'la IA lee los datos ya corregidos (0 de 2, nadie por blindar) y que la app ya lo ha apuntado');
  ok(/me quedan 0 de 2 \(me lo ha dicho él/.test(tras.ctx), 'el chat y el plan leen lo mismo que la app: 0 de 2, dicho por él');
  // Hoy: el bloque dentro del plan, y quitarlo con su ×
  await P.page.evaluate(() => document.querySelector('[data-ir="hoy"], [data-v="hoy"], .tabs [data-vista="hoy"]')?.click());
  await P.page.waitForSelector('.plan-dicho', { timeout: 8000 }).catch(() => {});
  const hoy = await P.page.evaluate(() => { const b = document.querySelector('.plan-dicho'); return { bloque: b ? b.innerText.replace(/\s+/g, ' ') : '', dentro: !!(b && b.closest('.plan')), pasos: [...document.querySelectorAll('.plan .paso-op')].map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 60)) }; });
  ok(hoy.dentro && /LO QUE ME HAS DICHO.*No te quedan blindajes.*hasta/i.test(hoy.bloque), `en Hoy, dentro del plan: «${hoy.bloque}»`);
  ok(!hoy.pasos.some((p) => /blind/i.test(p)), `ningún paso de Hoy manda blindar (${hoy.pasos.length} pasos)`);
  await P.page.click('.plan-dicho [data-accion="borrarNota"]');
  await P.page.waitForFunction(() => !document.querySelector('.plan-dicho'), null, { timeout: 8000 }).catch(() => {});
  const quitado = await P.page.evaluate(() => ({ quedan: window.S.M.escudosMios.quedan, bloque: !!document.querySelector('.plan-dicho'), b: (window.S.plan.ops || []).filter((o) => !o.descartada && o.accion === 'blindar').length }));
  ok(quitado.quedan === 2 && !quitado.bloque && quitado.b >= 1, `al quitarlo con su ×, vuelve a contar lo de LaLiga (quedan ${quitado.quedan}) y el plan vuelve a blindar`);
  ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
  await P.cerrar();
}

/* ---------- (c) (d) (e) (f) lo demás, sin pantalla ---------- */
{
  let MIO = '';
  const P = await pagina('martes', (cuerpo) => {
    const t = JSON.stringify(cuerpo);
    if (/a ese no lo vendo/.test(t)) return `Hecho, me lo apunto.\n\`\`\`notas\n{"recomiendo": [], "apuntar": [{"texto": "No quiere vender a ${MIO}", "jugador": "${MIO}", "tipo": "preferencia", "importe": null, "dias": null}], "olvidar": []}\n\`\`\``;
    if (/no me fio/.test(t)) return 'Apuntado, lo tendré en cuenta para la próxima vez que rehagas el plan.';
    return 'Vale.';
  });
  const r = await P.page.evaluate(async (prep) => {
    const S = window.S, Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js'), Op = await import('./js/operaciones.js'), Ac = await import('./js/acciones.js'), U = await import('./js/util.js');
    // eslint-disable-next-line no-new-func
    new Function('S', prep)(S);
    const D = S.D, c = Dt.cfg();
    const an = () => Mo.analizar(D, S.H, S.c, { notas: I.notasVigentes() });
    let M = an();
    const out = {};
    // (c1) a quién vendería hoy el plan: a ese «no lo vendo»
    const R0 = Pm.planDeHoy(D, M, c);
    const venta = R0.ops.find((o) => !o.descartada && o.accion === 'vender' && o.pid && M.mias.some((x) => x.pid === o.pid));
    out.habiaVenta = !!venta;
    const jv = venta ? M.J(venta.pid) : M.mias[0].j;
    const n1 = I.apuntarDicho(`A ${jv.nombre} no lo vendo`, D, M, R0);
    M = an();
    const R1 = Pm.planDeHoy(D, M, c);
    const cat = Op.catalogo(D, M, I.notasVigentes());
    out.noVender = { nota: n1.map((n) => `${n.corr}:${n.pid === jv.id}:${Math.round((n.caduca - Date.now()) / 864e5)}`).join(), motor: M.noVender.has(jv.id), plan: R1.ops.filter((o) => !o.descartada && o.accion === 'vender' && o.pid === jv.id).length,
      cat: cat.lista.filter((o) => o.pid === jv.id && ['vender', 'aceptar'].includes(o.tipo)).length, inercia: Ac.ventasInercia(M).some((x) => x.pid === jv.id), hoy: (M.acciones || []).filter((a) => a.tipo === 'vender' && a.pid === jv.id).length,
      chat: (I.ventasMiasTxt(D, M, [jv], c).split('\n').find((l) => l.includes(jv.nombre)) || '').slice(0, 600), linea: /NO LO VENDE \(me lo ha dicho él\)/.test(I.contexto(D, M, c, { chat: true })), bloque: (M.dicho || []).map((n) => n.txt).join(' | ') };
    // un plan de la IA guardado que lo vendía: cuadrarPlan lo descarta
    const viejo = I.cuadrarPlan({ titular: 'x', situacion: '', operaciones: [{ accion: 'vender', pid: jv.id, jugador: jv.nombre, donde: 'ponlo en venta', importe: jv.valor, cuando: 'hoy', motivo: 'baja' }] }, D, M);
    out.noVender.cuadra = (viejo.ops || []).filter((o) => o.pid === jv.id).map((o) => `${o.descartada ? 'descartada' : 'viva'}:${/no lo vendes/.test(o.aviso || '') || String(o.aviso || '').slice(0, 90)}`).join();
    // (c2) «ya he pujado por Y (12,5 M)»: uno libre del mercado sin puja suya
    const libre = M.mercado.find((m) => m.tipo === 'liga' && !m.miPuja && !M.dueno[m.pid]);
    const pujas0 = M.misPujas;
    // (una cifra por debajo de su precio de salida no puede ser: se deja en el precio de salida)
    const bajo = I.apuntarDicho(`Ya he pujado 0,1 M por ${libre.j.nombre}`, D, M, R1);
    const imp = Math.ceil(libre.precio / 1e6) + 2;
    const n2 = I.apuntarDicho(`Ya he pujado ${imp} M por ${libre.j.nombre}`, D, M, R1);
    M = an();
    const R2 = Pm.planDeHoy(D, M, c);
    const m2 = M.mercado.find((m) => m.pid === libre.pid);
    out.puja = { imp: imp * 1e6, bajo: bajo.length === 1 && bajo[0].importe === libre.precio, nota: n2.map((n) => `${n.corr}:${n.importe}`).join(), motor: m2.miPuja, dicha: !!m2.pujaDicha, suma: M.misPujas - pujas0, plan: R2.ops.filter((o) => !o.descartada && o.accion === 'pujar' && o.pid === libre.pid && !o.ya).length,
      ctx: /MIS PUJAS YA PUESTAS[^\n]*\(me ha dicho él que ya la ha hecho\)/.test(I.contexto(D, M, c, { chat: true })), intacto: !D.mercado.find((m) => m.pid === libre.pid).miPuja, bloque: (M.dicho || []).map((n) => n.txt).join(' | ') };
    // (d) «a ese no lo vendo», sin nombre: manda el jugador que apunta la IA si es suyo
    const otro = M.mias.find((x) => x.pid !== jv.id && x.j.pos !== 5);
    window.__mio = otro.j.nombre;
    return { ...out, otro: otro.j.nombre, otroId: otro.pid, jv: jv.nombre };
  }, PREP);
  ok(r.noVender.nota === 'no-vender:true:14' && r.noVender.motor, `«A ${r.jv} no lo vendo»: apuntado para 14 días y el motor lo sabe`);
  ok(r.noVender.plan === 0 && r.noVender.cat === 0 && !r.noVender.inercia && r.noVender.hoy === 0, `ni el plan, ni el catálogo de la IA, ni Hoy, ni los avisos lo venden${r.habiaVenta ? ' (antes el plan lo vendía)' : ''}`);
  ok(/NO SE VENDE \(LO HA DICHO ÉL\)/.test(r.noVender.chat) && r.noVender.linea, 'el chat lo lee: «NO SE VENDE (LO HA DICHO ÉL)» y en su línea de la plantilla');
  ok(r.noVender.cuadra === 'descartada:true', `un plan guardado que lo vendía: la venta sale descartada con su porqué (${r.noVender.cuadra})`);
  ok(r.puja.nota === `puja:${r.puja.imp}` && r.puja.motor === r.puja.imp && r.puja.dicha && r.puja.suma === r.puja.imp && r.puja.plan === 0 && r.puja.ctx, `«Ya he pujado N M por…»: se da por hecha (${r.puja.motor}), cuenta en lo comprometido y no se vuelve a mandar`);
  ok(r.puja.bajo, 'una puja dicha por debajo del precio de salida se deja en el precio de salida');
  ok(r.puja.intacto, 'lo que llegó de LaLiga no se toca: la puja dicha solo vive en el análisis');
  ok(/no lo vendes/.test(r.noVender.bloque) && /Ya has pujado por .* \(\d/.test(r.puja.bloque), `el bloque de Hoy: «${r.puja.bloque}»`);

  // (d) por el chat de verdad (con la IA de mentira, que apunta al jugador)
  MIO = r.otro;
  const d = await P.page.evaluate(async () => {
    const S = window.S, Mo = await import('./js/motor.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js'), U = await import('./js/util.js');
    const D = S.D, c = Dt.cfg();
    const an = () => Mo.analizar(D, S.H, S.c, { notas: I.notasVigentes() });
    let M = an();
    // con su pregunta de antes («¿Vendo a X?») se sabe quién es «ese»; con dos nombres, o con uno que no es suyo, no
    const suyo = M.mias.find((x) => x.j.pos !== 5 && !M.noVender.has(x.pid) && x.j.nombre !== window.__mio), ajeno = M.clausulas[0].j;
    const h = (t) => [{ r: 'yo', t, ts: Date.now() - 60e3 }, { r: 'ia', t: 'Yo lo aguantaría.', ts: Date.now() - 30e3 }];
    const conv = { dos: I.apuntarDicho('a ese no lo vendo', D, M, null, h(`¿Vendo a ${suyo.j.nombre} o a ${window.__mio}?`)).length, ajeno: I.apuntarDicho('a ese no lo vendo', D, M, null, h(`¿Qué tal ${ajeno.nombre}?`)).length,
      uno: I.apuntarDicho('Pues a ese no lo vendo ni loco', D, M, null, h(`¿Vendo a ${suyo.j.nombre}?`)).map((n) => `${n.corr}:${n.pid === suyo.pid}`).join() };
    for (const n of I.notasVigentes().filter((x) => x.pid === suyo.pid)) I.borrarNota(n.id);
    M = an();
    const pre = I.apuntarDicho('a ese no lo vendo', D, M, null);
    const datos = I.datosChat('a ese no lo vendo', D, M, c, {});
    // lo de «acaba de contarte» es solo de ese mensaje: en la pregunta siguiente ya no va
    I.apuntarDicho('No me quedan blindajes', D, M, null);
    const fuga = { suya: /LO QUE ACABA DE CONTARTE EN ESTE MENSAJE/.test(I.datosChat('No me quedan blindajes', D, M, c, {})), otra: /LO QUE ACABA DE CONTARTE/.test(I.datosChat('¿Qué hago hoy?', D, M, c, {})) };
    for (const n of I.notasVigentes().filter((x) => x.corr === 'blindajes')) I.borrarNota(n.id);
    I.apuntarDicho('a ese no lo vendo', D, M, null);
    const x = await I.charlar('a ese no lo vendo', D, M, c, null, null, [], null, { dicho: pre });
    M = an();
    const prometida = await I.charlar('De Kang-In Lee no me fio mucho, la verdad', D, M, c, null, null, [], null, { dicho: [] });
    // (f) preguntas y condiciones: nada
    const nada = ['¿Me quedan blindajes?', `¿Vendo a ${window.__mio}?`, `No vendo a ${window.__mio} por menos de 30 M`, '¿Qué hago hoy?', 'voy a pujar por alguno'].map((q) => I.apuntarDicho(q, D, M, null).length);
    return { conv, fuga, pre: pre.length, pide: /SIN DECIR A QUIÉN/.test(datos), ap: (x.apuntadas || []).map((n) => `${n.corr}:${n.jugador}`).join(), motor: [...M.noVender.keys()].length, texto: prometida.texto, nada: nada.join('') };
  });
  ok(d.conv.uno === 'no-vender:true' && d.conv.dos === 0 && d.conv.ajeno === 0, `«¿Vendo a X?» y después «a ese no lo vendo»: es X (${d.conv.uno}); con dos nombres o con uno de otro, no se adivina`);
  ok(d.fuga.suya && !d.fuga.otra, 'a la IA se le dice que está apuntado solo en ese mensaje, no en la pregunta siguiente');
  ok(d.pre === 0 && d.pide, '«a ese no lo vendo»: sin nombre no se apunta nada a ciegas y a la IA se le dice que pregunte o ponga el nombre');
  ok(d.ap === `no-vender:${r.otro}` && d.motor === 2, `con el jugador que apunta la IA (${r.otro}, suyo), manda: ${d.ap}`);
  ok(/De esto no se ha apuntado nada/.test(d.texto), 'la IA dice «Apuntado, lo tendré en cuenta» sin que se guarde nada: la app lo dice debajo');
  ok(d.nada === '00000', 'una pregunta, una condición («por menos de 30 M») o una intención no apuntan nada');
  ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
  await P.cerrar();
}

await cerrar();
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
