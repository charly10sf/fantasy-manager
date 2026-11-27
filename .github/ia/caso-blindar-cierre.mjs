// El blindaje en el cierre de la jornada (27 nov, Carlos con El Hilali: 29,92 M, +0,9 M al día, la cláusula en su valor,
// 7 rivales con dinero para pagarla y «se abre en 40 min»; el plan decía «no toques nada antes de las 21:00»).
// En las 24 h de antes del primer partido nadie puede clausular, pero el blindaje SÍ se pone (regla 15 de
// claude/revision-ia.md), y hay que ponerlo ANTES de que empiece la jornada: a esa hora se reabren todas las cláusulas.
// La app daba por cerrada igual la que solo espera a la jornada que la que aún tiene los 14 días del fichaje, así que en
// el cierre no proponía blindar a nadie. Sin red, con la liga de ejemplo y un titular tuyo que sube con la cláusula en su valor:
//  (a) el día del primer partido (sábado 10:30, se reabren a las 14:00): está en «a quién blindar», el plan lleva el paso
//      «hoy antes de las 14:00» y lo dice en el titular, la IA lo lee, el repaso no lo manda a «cuando se abra», la ficha
//      dice «Blíndalo gratis antes de las 14:00» y el árbitro no lo da por falta
//  (b) la víspera (viernes 16:00, se reabren mañana a las 14:00): hoy no (el blindaje se gastaría con todo cerrado); va en
//      «Los próximos días» como «antes de las 14:00»
//  (c) al que aún le quedan los 14 días (se le acaban dentro del cierre, a las 12:00): no se puede blindar todavía
//  (d) sin blindajes: no se propone
// Uso: PW_MODULO=… node .github/ia/caso-blindar-cierre.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const escena = (P, op) => P.page.evaluate(async (op) => {
  const S = window.S, Mo = await import('./js/motor.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js'), Op = await import('./js/operaciones.js'), Ho = await import('./js/hojas.js'), Pl = await import('./js/plan.js'), Ac = await import('./js/acciones.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M;
  const quien = [...M0.mias].filter((x) => x.j.pos !== 5 && M0.perdida(x.pid) >= 0.8 && x.j.valor > 1e6 && x.j.estado === 'ok').sort((a, b) => a.j.valor - b.j.valor)[0];
  if (!quien) return { falta: true };
  const j = quien.j, pid = quien.pid;
  // cuatro semanas subiendo un 1 % al día
  const vals = [j.valor];
  for (let k = 0; k < 28; k++) vals.unshift(Math.round(vals[0] / 1.01));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  // su cláusula, en su valor; LaLiga ya no la protege (o le quedan los 14 días hasta op.prot)
  const f = (D.plantillas[yo] || []).find((y) => String(y.pid) === String(pid));
  f.clausula = Math.round(j.valor / 1e4) * 1e4;
  f.protegidoHasta = op.prot ? new Date(op.prot).getTime() : 0;
  for (const g of D.plantillas[yo] || []) if (g !== f) g.protegidoHasta = Date.now() + 9 * 864e5;
  D.actividad = (D.actividad || []).filter((a) => a.clase !== 'blindaje');
  const F = S.fuentes || {};
  const M = Mo.analizar(D, H, S.c, { det: S.det, onces: F.onces, noticias: F.noticias, avanzadas: F.avanzadas, alineaciones: F.alineaciones });
  if (op.sinEscudos) { M.escudosMios = { ...(M.escudosMios || {}), quedan: 0, usados: 2 }; M.paraEscudo = []; }
  const x = M.mias.find((y) => y.pid === pid);
  const cat = Op.catalogo(D, M);
  const b = (cat.ref || {})[`B-${pid}`] || null;
  const lineaIA = (I.contexto(D, M, Dt.cfg()).split('\n').find((l) => l.includes(j.nombre) && /TITULAR|suplente/.test(l)) || '');
  const ctx = I.contexto(D, M, Dt.cfg());
  const regla = (ctx.split('\n').find((l) => /^CLÁUSULAS CERRADAS/.test(l)) || '');
  // el plan del motor, como lo pinta Hoy
  let plan = null, err = '';
  try { plan = Pl.planDeHoy(D, M, S.c); } catch (e) { err = e.message; }
  const paso = plan ? (plan.ops || []).find((o) => o.pid === pid && o.accion === 'blindar') : null;
  const dias = plan ? JSON.stringify(plan.proximos_dias || plan.diasAuto || []) : '';
  // la IA lo propone «ahora»: el repaso
  const cu = I.cuadrarPlan({ dia: new Date().toISOString().slice(0, 10), t: Date.now(), titular: 'Plan', situacion: 'x', operaciones: [{ accion: 'blindar', ref: `B-${pid}`, jugador: j.nombre, importe: 0, cuando: 'ahora', motivo: 'Protégelo.' }] }, D, M);
  const pIA = (cu.ops || []).find((o) => o.pid === pid && o.accion === 'blindar') || null;
  const S2 = { ...S, D, H, M };
  let ficha = '';
  try { ficha = Ho.fichaJugador(S2, pid) || ''; } catch (e) { ficha = `ERROR ${e.message}`; }
  if (typeof ficha !== 'string') ficha = String((ficha && ficha.html) || '');
  // Hoy: el contador de arriba y el plan
  let hoyTxt = '';
  try { const Vi = await import('./js/vistas.js'); const d = document.createElement('div'); d.innerHTML = Vi.hoy({ ...S2, plan: null }) || ''; hoyTxt = d.innerText || d.textContent || ''; } catch (e) { hoyTxt = `ERROR ${e.message}`; }
  let tarjeta = null;
  try { const acc = (M.acciones && M.acciones.length ? M.acciones : (Ac.acciones ? Ac.acciones(D, M, S.c) : [])) || []; tarjeta = acc.find((a) => a.tipo === 'escudo' && a.pid === pid) || null; } catch (e) { tarjeta = { error: e.message }; }
  return {
    n: j.nombre, abierta: x.abierta, soloVeda: !!x.soloVeda, escudoYa: !!x.escudoYa, veda: x.veda ? x.veda.n : null, abre: x.protegidoHasta, riesgo: x.riesgo, importa: x.importa,
    pagan: x.pagan ? x.pagan.seguro.length + x.pagan.quiza.length : null, quedan: (M.escudosMios || {}).quedan, para: (M.paraEscudo || []).includes(pid),
    gratis: b ? !!b.escudoGratis : null, hayB: !!b, lineaIA, regla, err,
    paso: paso ? { cuando: paso.cuando, hoy: paso.hoy, descartada: !!paso.descartada, aviso: paso.aviso || '', motivo: paso.motivo || '' } : null,
    titular: plan ? plan.titular : '', dias,
    pIA: pIA ? { cuando: pIA.cuando, hoy: pIA.hoy, descartada: !!pIA.descartada, aviso: pIA.aviso || '' } : null,
    fichaAntes: (ficha.match(/Blíndalo gratis antes de las \d\d:\d\d/) || [''])[0], fichaErr: /^ERROR/.test(ficha) ? ficha : '',
    tarjeta: tarjeta ? { cuando: tarjeta.cuando, texto: tarjeta.texto || '', error: tarjeta.error || '' } : null,
    hoyChip: (hoyTxt.match(/Blinda a [^\n]{0,40}/) || [''])[0], hoySeAbre: /Se abre /.test(hoyTxt), hoyErr: /^ERROR/.test(hoyTxt) ? hoyTxt : '',
    hh: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(x.protegidoHasta || 0)),
  };
}, op);

const lista = async (escenaN, op) => {
  const P = await pagina(escenaN);
  try {
    await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
    return await escena(P, op);
  } finally { await cerrar(P); }
};

// (a) el día del primer partido
let r = await lista('sabado', {});
if (r.falta) ok(false, 'la liga de ejemplo no tiene un titular de más de 1 M');
else {
  ok(!r.abierta && r.soloVeda && r.escudoYa && r.veda, `(a) ${r.n}: cerrada solo por la jornada ${r.veda}, se reabre a las ${r.hh} (riesgo ${r.riesgo}, le llega a ${r.pagan})`);
  ok(r.para, `(a) está en «a quién blindar» (quedan ${r.quedan})`);
  ok(r.hayB && r.gratis, '(a) entre las operaciones de la IA, con el escudo gratis');
  ok(new RegExp(`CONVIENE BLINDARLO HOY \\(gratis\\), ANTES DE LAS ${r.hh}`).test(r.lineaIA), `(a) la IA lee: «${r.lineaIA.slice(r.lineaIA.indexOf('| cláusula'))}»`);
  ok(/El blindaje gratis SÍ se puede poner durante el cierre/.test(r.regla) && !/blindar tampoco hace falta/.test(r.regla), '(a) la regla del cierre que lee la IA ya no dice «blindar tampoco hace falta hasta entonces»');
  ok(r.paso && !r.paso.descartada && r.paso.hoy !== false && new RegExp(`^hoy antes de las ${r.hh}`).test(r.paso.cuando) && !r.paso.aviso, `(a) el plan lleva el paso: «${r.paso ? r.paso.cuando : 'no hay'}»${r.paso && r.paso.aviso ? ` (aviso: ${r.paso.aviso})` : ''}${r.err ? ` ERROR ${r.err}` : ''}`);
  ok(r.paso && new RegExp(`se reabre a las ${r.hh}`).test(r.paso.motivo) && /cuanto más cerca de esa hora mejor/.test(r.paso.motivo), `(a) y lo explica: «${r.paso ? r.paso.motivo : ''}»`);
  ok(new RegExp(`proteger a ${r.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(r.titular), `(a) el titular del plan: «${r.titular}»`);
  ok(r.pIA && !r.pIA.descartada && r.pIA.hoy && !/cuando se abra/.test(r.pIA.cuando) && !/solo vale con la cláusula abierta/.test(r.pIA.aviso), `(a) si la IA lo propone, el repaso lo deja para hoy: «${r.pIA ? r.pIA.cuando : 'no hay'}»${r.pIA && r.pIA.aviso ? ` (aviso: ${r.pIA.aviso})` : ''}`);
  ok(!r.fichaErr && r.fichaAntes === `Blíndalo gratis antes de las ${r.hh}`, `(a) la ficha: «${r.fichaAntes}»${r.fichaErr ? ` (${r.fichaErr})` : ''}`);
  ok(!r.hoyErr && r.hoyChip.startsWith(`Blinda a ${r.n}`), `(a) el contador de arriba de Hoy: «${r.hoyChip}»${r.hoyErr ? ` (${r.hoyErr})` : ''}`);
  ok(r.tarjeta && !r.tarjeta.error && new RegExp(`^Antes de las ${r.hh}`).test(r.tarjeta.cuando), `(a) «Ahora mismo»: ${r.tarjeta ? `«${r.tarjeta.cuando}» ${r.tarjeta.error}` : 'sin tarjeta'}`);
}

// (b) la víspera
r = await lista('veda', {});
if (!r.falta) {
  ok(r.soloVeda && !r.para && !r.paso, `(b) la víspera (se reabre mañana a las ${r.hh}): hoy no se blinda${r.paso ? ` (paso: ${r.paso.cuando})` : ''}`);
  ok(new RegExp(`antes de las ${r.hh}, blinda gratis a [^"]*${r.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(r.dias), `(b) va en «Los próximos días»: ${(r.dias.match(/antes de las[^"]*/) || ['no sale'])[0]}`);
  ok(!/CONVIENE BLINDARLO HOY/.test(r.lineaIA) && /el blindaje se le puede poner ya, y tiene que ser ANTES de esa hora/.test(r.lineaIA), '(b) la IA lee que se puede blindar antes de esa hora, sin «conviene hoy»');
}

// (c) con los 14 días hasta las 12:00 del sábado (dentro del cierre)
r = await lista('sabado', { prot: '2026-11-07T12:00:00+01:00' });
if (!r.falta) {
  ok(!r.abierta && !r.soloVeda && !r.escudoYa && !r.para, `(c) con los 14 días hasta las 12:00: todavía no se puede blindar (a quién blindar: ${r.para})`);
  ok(!r.paso || r.paso.hoy === false || !!r.paso.importe, `(c) el plan no manda el escudo para ahora${r.paso ? ` («${r.paso.cuando}»)` : ''}`);
  ok(!r.pIA || /cuando se abra/.test(r.pIA.cuando), `(c) y si la IA lo propone, sigue siendo «cuando se abra»${r.pIA ? `: «${r.pIA.cuando}»` : ''}`);
}

// (d) sin blindajes
r = await lista('sabado', { sinEscudos: true });
if (!r.falta) ok(!r.para && !(r.paso && !r.paso.descartada && r.paso.hoy !== false && !r.paso.importe) && !r.fichaAntes, '(d) sin blindajes esta jornada: no se propone');

console.log(mal ? `${mal} MAL` : 'todo BIEN');
process.exit(mal ? 1 : 0);
