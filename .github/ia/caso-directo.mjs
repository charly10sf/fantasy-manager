// Lo medido con la liga de Carlos el 20-21 nov (claude/medida-ia-2026-11-20.md), sin red, con la liga de ejemplo:
//  (a) el que se frena después de subir ya no se manda vender «antes del giro» y se espera que siga subiendo (medido:
//      +265 mil en 3 días); el que ya gira, sí se vende
//  (b) el partido que acaba de jugar mueve lo que se espera de su valor: tras 12 puntos, más; el que venía subiendo y
//      hace 1, menos (Berenguer, 20 nov); el día siguiente queda una parte; antes de acabar el partido, nada
//  (c) `efectoTras`: más puntos, más subida, y en porcentaje más en los baratos
//  (d) en Hoy, «Clausula a X» de uno que acaba de hacer un partidazo lo dice
// Uso: PW_MODULO=… node .github/ia/caso-directo.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('martes');
const r = await P.page.evaluate(async () => {
  const S = window.S, Mo = await import('./js/motor.js'), U = await import('./js/util.js');
  const out = {};
  const hoy = U.diaDe(Date.now());
  const serie = (vals) => vals.map((v, i) => [U.otroDia(hoy, i - vals.length + 1), v]);
  // (a) una serie que sube cada vez menos (+1 M, +0,8 M, +0,5 M) y otra que ya baja tras subir
  const base = (S.M.mias || []).find((x) => x.j && x.j.pos && x.j.pos < 5 && x.j.valor > 5e6) || S.M.mias[0];
  const pid = base.pid, D = JSON.parse(JSON.stringify(S.D)), H = JSON.parse(JSON.stringify(S.H));
  const v0 = 20e6;
  // (sin puntos de jornadas recientes: un partidazo de la liga de ejemplo no deja vender por la bajada, como debe ser)
  D.maestro[pid].semanas = (D.maestro[pid].semanas || []).map((w) => ({ ...w, pts: 3 }));
  const frenaS = [v0, v0 + 1.2e6, v0 + 2.4e6, v0 + 3.4e6, v0 + 4.2e6, v0 + 4.7e6];
  D.maestro[pid].valor = frenaS[frenaS.length - 1];
  H.v[pid] = serie(frenaS);
  D.tendencias = {};
  let M = Mo.analizar(D, H, S.c, {});
  const iF = M.inercia(pid);
  out.frena = { fase: iF && iF.fase, p7: iF && iF.proy(7), vende: !!M.ventaPorInercia(pid) };
  const giroS = [v0, v0 + 1.2e6, v0 + 2.4e6, v0 + 3.4e6, v0 + 4.2e6, v0 + 3.6e6];
  D.maestro[pid].valor = giroS[giroS.length - 1];
  H.v[pid] = serie(giroS);
  M = Mo.analizar(D, H, S.c, {});
  const iG = M.inercia(pid);
  out.giro = { fase: iG && iG.fase, p7: iG && iG.proy(7), pJ: iG && iG.proyJ, hJ: iG && iG.hastaJ, vende: !!M.ventaPorInercia(pid), pz: M.partidazo(pid), ef: iG && iG.partido };
  // (b) venía subiendo (+3 % al día) y su partido de hoy ya ha acabado
  const subeS = [v0, v0 * 1.03, v0 * 1.03 ** 2, v0 * 1.03 ** 3, v0 * 1.03 ** 4, v0 * 1.03 ** 5];
  D.maestro[pid].valor = Math.round(subeS[subeS.length - 1]);
  H.v[pid] = serie(subeS.map(Math.round));
  const j = D.maestro[pid];
  const n = 30;
  const conPartido = (pts, haceH, diasAtras = 0) => {
    const D2 = JSON.parse(JSON.stringify(D));
    D2.partidos = [...(D2.partidos || []).filter((p) => Number(p.jornada) !== n), { jornada: n, localId: j.equipoId, visitanteId: 'x', local: 'A', visitante: 'B', fecha: Date.now() - diasAtras * 864e5 - haceH * 3600e3 }];
    D2.maestro[pid].semanas = [...(j.semanas || []).filter((w) => w.n !== n), { n, pts }];
    const M2 = Mo.analizar(D2, H, S.c, {});
    const i = M2.inercia(pid);
    return { p7: i ? i.proy(7) : null, p3: i ? i.proy3 : null, ef: i && i.partido ? { pts: i.partido.pts, etapa: i.partido.etapa, e3: i.partido.e3 } : null };
  };
  const D0 = JSON.parse(JSON.stringify(D)); D0.maestro[pid].semanas = (j.semanas || []).filter((w) => w.n !== n);
  const M0 = Mo.analizar(D0, H, S.c, {}), i0 = M0.inercia(pid);
  out.sin = { p7: i0 ? i0.proy(7) : null };
  out.doce = conPartido(12, 3);
  out.uno = conPartido(1, 3);
  out.jugando = conPartido(12, 1);
  out.ayer = conPartido(12, 1, 1);
  // (c)
  out.tabla = { b1: Mo.efectoTras(1, 'sube', 20e6).e3, b7: Mo.efectoTras(6, 'sube', 20e6).e3, b10: Mo.efectoTras(12, 'sube', 20e6).e3, barato: Mo.efectoTras(12, 'plano', 1e6).e3, caro: Mo.efectoTras(12, 'plano', 60e6).e3 };
  // (d) el primero de los «Clausula a» de Hoy, con un partidazo hoy
  const c = (S.M.acciones || []).find((a) => a.tipo === 'clausular');
  out.hayClausular = !!c;
  if (c) {
    const D3 = JSON.parse(JSON.stringify(S.D)), jc = D3.maestro[c.pid];
    D3.partidos = [...(D3.partidos || []).filter((p) => Number(p.jornada) !== n), { jornada: n, localId: jc.equipoId, visitanteId: 'x', local: 'A', visitante: 'B', fecha: Date.now() - 3 * 3600e3 }];
    jc.semanas = [...(jc.semanas || []).filter((w) => w.n !== n), { n, pts: 14 }];
    const M3 = Mo.analizar(D3, S.H, S.c, {});
    const c3 = (M3.acciones || []).find((a) => a.tipo === 'clausular' && a.pid === c.pid);
    out.clausular = c3 ? { texto: c3.texto.slice(0, 160), primero: (M3.acciones.find((a) => a.tipo === 'clausular') || {}).pid === c.pid } : null;
  }
  return out;
});
await P.cerrar();
await cerrar();
const M_ = (x) => (x == null ? '?' : `${(x / 1e6).toFixed(2)} M`);
ok(r.frena.fase === 'frena' && !r.frena.vende && r.frena.p7 > 0, `el que sube cada vez menos: no se vende antes del giro y se espera que siga subiendo (fase ${r.frena.fase}, ${M_(r.frena.p7)} en 7 días, vender ${r.frena.vende})`);
ok(['giro', 'baja'].includes(r.giro.fase) && r.giro.vende && r.giro.p7 < 0, `el que ya gira, sí (fase ${r.giro.fase}, ${M_(r.giro.p7)}, vender ${r.giro.vende}, ${JSON.stringify({ pJ: r.giro.pJ, hJ: r.giro.hJ, pz: r.giro.pz, ef: r.giro.ef })})`);
ok(r.doce.ef && r.doce.ef.pts === 12 && r.doce.ef.etapa === 0 && r.doce.p7 > r.sin.p7, `con 12 puntos hoy, partido acabado: se espera más (${M_(r.sin.p7)} → ${M_(r.doce.p7)})`);
ok(r.uno.ef && r.uno.p7 < r.sin.p7, `venía subiendo y hace 1: se espera menos (${M_(r.sin.p7)} → ${M_(r.uno.p7)})`);
ok(!r.jugando.ef && Math.abs(r.jugando.p7 - r.sin.p7) < 1, `con el partido aún en juego, nada (${M_(r.jugando.p7)})`);
ok(r.ayer.ef && r.ayer.ef.etapa === 1 && r.ayer.ef.e3 > 0 && r.ayer.ef.e3 < r.doce.ef.e3 + 0.02, `el día siguiente, lo que queda (${(r.ayer.ef && r.ayer.ef.e3 * 100).toFixed(1)} % frente a ${(r.doce.ef.e3 * 100).toFixed(1)} %)`);
ok(r.tabla.b1 < 0 && r.tabla.b1 < r.tabla.b7 && r.tabla.b7 < r.tabla.b10 && r.tabla.barato > r.tabla.caro, `más puntos, más subida, y más en los baratos (${Object.entries(r.tabla).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}`).join(', ')})`);
ok(!r.hayClausular || (r.clausular && /Acaba de hacer 14 puntos/.test(r.clausular.texto) && r.clausular.primero), r.hayClausular ? `Hoy: «${r.clausular ? r.clausular.texto : 'no sale'}»` : 'Hoy: la liga de ejemplo no trae ningún «Clausula a»');
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
