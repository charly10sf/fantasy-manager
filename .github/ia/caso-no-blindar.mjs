// No se blinda al que baja (23 nov, Carlos con Thiago: 1,41 M, bajando, 1 punto en la última jornada y la cláusula a
// 1,75 M, un +24 %; la ficha decía «Blíndalo gratis»). Si te lo clausulan cobras más de lo que te daría LaLiga por él,
// así que ni el escudo gratis ni subirle la cláusula. Sin red, con la liga de ejemplo y uno de tu once:
//  (a) bajando una semana, con la cláusula a +24 %: noBlindar; fuera de «a quién blindar», sin B- entre las
//      operaciones, sin «Blíndalo gratis» en la ficha (sale «No lo blindes»), lo que lee la IA dice NO LO BLINDES y si la
//      IA lo propone igual, el plan lo quita
//  (b) el mismo bajando con la cláusula casi a su valor (menos de lo que da LaLiga): sí se puede blindar
//  (c) el mismo subiendo, con la cláusula a su valor: se blinda gratis
// Uso: PW_MODULO=… node .github/ia/caso-no-blindar.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

const escena = (P, op) => P.page.evaluate(async (op) => {
  const S = window.S, Mo = await import('./js/motor.js'), Dt = await import('./js/datos.js'), I = await import('./js/ia.js'), Op = await import('./js/operaciones.js'), Ho = await import('./js/hojas.js');
  const D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H || {}));
  const yo = D.yo.teamId, M0 = S.M;
  const quien = [...M0.mias].filter((x) => x.j.pos !== 5 && M0.perdida(x.pid) >= 0.8 && x.j.valor > 1e6).sort((a, b) => a.j.valor - b.j.valor)[0];
  if (!quien) return { falta: true };
  const j = quien.j, pid = quien.pid;
  // la serie: tres semanas subiendo un 1 % al día y luego una semana bajando (o subiendo)
  const ultimos = op.sube ? [0.01, 0.011, 0.009, 0.012, 0.01, 0.011, 0.012] : [-0.007, -0.006, -0.003, -0.0005, 0.0015, -0.01, -0.014];
  const vals = [j.valor];
  for (let k = ultimos.length - 1; k >= 0; k--) vals.unshift(Math.round(vals[0] / (1 + ultimos[k])));
  for (let k = 0; k < 21; k++) vals.unshift(Math.round(vals[0] / 1.01));
  const n = vals.length;
  H.v = H.v || {};
  H.v[pid] = vals.slice(0, n - 1).map((v, i) => [new Date(Date.now() - (n - 1 - i) * 864e5 + 3600e3).toISOString().slice(0, 10), v]);
  if (S.det && S.det[pid]) delete S.det[pid].valores;
  // su cláusula, abierta; sin blindajes gastados
  const f = (D.plantillas[yo] || []).find((y) => String(y.pid) === String(pid));
  f.clausula = Math.round(j.valor * (1 + op.sobre) / 1e4) * 1e4;
  f.protegidoHasta = 0;
  // los demás, con la cláusula cerrada: así es el único candidato al escudo
  for (const g of D.plantillas[yo] || []) if (g !== f) g.protegidoHasta = Date.now() + 5 * 864e5;
  D.actividad = (D.actividad || []).filter((a) => a.clase !== 'blindaje');
  const F = S.fuentes || {};
  const M = Mo.analizar(D, H, S.c, { det: S.det, onces: F.onces, noticias: F.noticias, avanzadas: F.avanzadas, alineaciones: F.alineaciones });
  const x = M.mias.find((y) => y.pid === pid);
  const cat = Op.catalogo(D, M);
  const conB = cat.lista ? cat.lista.some((o) => o.ref === `B-${pid}`) : Object.keys(cat.ref || {}).includes(`B-${pid}`);
  const linea = (t) => t.split('\n').find((l) => l.includes(j.nombre) && /EN MI ONCE|TITULAR|suplente/.test(l)) || '';
  const lineaIA = linea(I.contexto(D, M, Dt.cfg()));
  // la IA lo propone igual
  const cu = I.cuadrarPlan({ dia: new Date().toISOString().slice(0, 10), t: Date.now(), titular: 'Plan', situacion: 'x', operaciones: [{ accion: 'blindar', ref: `B-${pid}`, jugador: j.nombre, importe: 0, cuando: 'ahora', motivo: 'Protégelo.' }] }, D, M);
  const queda = (cu.ops || []).some((o) => o.pid === pid && o.accion === 'blindar' && !o.descartada);
  const quitado = [...(cu.descartes || [])].map((d) => d.motivo || d.aviso || '').find((t) => /no lo blindes/.test(t)) || '';
  // la ficha
  const S2 = { ...S, D, H, M };
  let ficha = '';
  try { ficha = Ho.fichaJugador(S2, pid) || ''; } catch (e) { ficha = `ERROR ${e.message}`; }
  if (typeof ficha !== 'string') ficha = String(ficha && ficha.html || '');
  return { dbg: JSON.stringify({ ab: x.abierta, esc: x.escudo, imp: x.importa, pierde: x.pierde, vi: !!x.ventaInercia, est: x.j.estado, venta: M.enVenta.has(pid) }), n: j.nombre, fase: (M.inercia(pid) || {}).fase, abierta: x.abierta, riesgo: x.riesgo, noBlindar: x.noBlindar && x.noBlindar.texto, para: (M.paraEscudo || []).includes(pid), quedan: (M.escudosMios || {}).quedan, conB, lineaIA: (lineaIA.match(/\| (NO LO BLINDES|CONVIENE BLINDARLO)[^|]*/) || [''])[0], pagan: x.pagan ? x.pagan.seguro.length + x.pagan.quiza.length : 0, queda, quitado, fichaNo: /No lo blindes/.test(ficha), fichaSi: /Blíndalo gratis/.test(ficha), fichaErr: ficha.startsWith('ERROR') ? ficha : '' };
}, op);

const P = await pagina('martes');
try {
  await P.page.waitForFunction(() => window.S && window.S.M && window.S.D, null, { timeout: 30000 });
  let r = await escena(P, { sobre: 0.24 });
  if (r.falta) ok(false, 'la liga de ejemplo no tiene un titular de más de 1 M');
  else {
    ok(r.abierta && ['giro', 'baja', 'parado'].includes(r.fase), `(a) ${r.n}: cláusula abierta y bajando (${r.fase})`);
    ok(!!r.noBlindar, `(a) noBlindar: «${r.noBlindar}»`);
    ok(!r.para, `(a) no está entre los que blindar gratis (quedan ${r.quedan})`);
    ok(!r.conB, '(a) sin B- entre las operaciones que puede recomendar la IA');
    ok(/NO LO BLINDES/.test(r.lineaIA), `(a) lo que lee la IA: «${r.lineaIA}»`);
    ok(!r.queda && !!r.quitado, `(a) si la IA lo propone, el plan lo quita («${r.quitado}»)`);
    ok(!r.fichaErr && r.fichaNo && !r.fichaSi, `(a) la ficha dice «No lo blindes» y no «Blíndalo gratis»${r.fichaErr ? ` (${r.fichaErr})` : ''}`);
  }
  r = await escena(P, { sobre: 0.02 });
  if (!r.falta) {
    ok(!r.noBlindar, `(b) bajando con la cláusula a +2 % (menos que lo que da LaLiga): se puede blindar (riesgo ${r.riesgo}, a quién blindar: ${r.para})`);
    ok(!r.fichaNo, '(b) la ficha no dice «No lo blindes»');
  }
  r = await escena(P, { sobre: 0, sube: true });
  if (!r.falta) {
    ok(!r.noBlindar && r.para, `(c) subiendo (${r.fase}) con la cláusula a su valor: entre los que blindar gratis (riesgo ${r.riesgo}, le llega a ${r.pagan}) ${r.dbg}`);
    ok(r.fichaSi && !r.fichaNo && /CONVIENE BLINDARLO/.test(r.lineaIA), `(c) la ficha dice «Blíndalo gratis» y la IA lee «${r.lineaIA}»`);
  }
} finally { await cerrar(P); }
console.log(mal ? `${mal} MAL` : 'todo BIEN');
process.exit(mal ? 1 : 0);
