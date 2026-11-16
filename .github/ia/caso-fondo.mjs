// Hoy y los avisos con la app cerrada dicen lo mismo de a quién vender por la inercia (17 nov: acciones.js,
// `ventasInercia`), sin red, con la liga de ejemplo: lo que Hoy manda vender por la inercia lo avisa también fondo.js, y
// fondo.js no avisa de vender a quien Hoy no lo manda (el que espera a que le paguen la cláusula, el lesionado, que
// tiene su propio aviso). Uso: PW_MODULO=… node .github/ia/caso-fondo.mjs   (sale con 1 si algo falla)
import { pagina, cerrar } from './banco.mjs';

let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };
const P = await pagina('martes');
const r = await P.page.evaluate(async () => {
  const S = window.S, F = await import('./js/fondo.js'), A = await import('./js/acciones.js'), Mo = await import('./js/motor.js');
  const antesDe = (D) => { const a = JSON.parse(JSON.stringify(D)); a.demo = false; a.t = Date.now() - 3 * 3600e3; return a; };
  const vende = (D, M) => F.avisosNuevos(antesDe(D), { ...D, demo: false }, M).filter((a) => /^vende:/.test(a.k)).map((a) => a.k.split(':')[1]);
  const lesion = (D, M) => F.avisosNuevos(antesDe(D), { ...D, demo: false }, M).filter((a) => /^lesion-venta:/.test(a.k)).map((a) => a.k.split(':')[1]);
  const out = {};
  const M0 = S.M;
  out.hoy = M0.acciones.filter((a) => a.tipo === 'vender' && /gire|girado/.test(a.titulo)).map((a) => String(a.pid));
  out.inercia = A.ventasInercia(M0).map((x) => String(x.pid));
  out.fondo = vende(S.D, M0);
  // uno que gira y se lesiona: el aviso es el de la lesión, no el de la inercia
  const x = A.ventasInercia(M0)[0];
  out.x = x ? x.j.nombre : null;
  if (x) {
    const D = JSON.parse(JSON.stringify(S.D));
    D.maestro[x.pid].estado = 'injured';
    const M = Mo.analizar(D, S.H, S.c, {});
    out.lesFondo = vende(D, M).includes(String(x.pid));
    out.lesAviso = lesion(D, M).includes(String(x.pid));
    out.lesHoy = M.acciones.some((a) => String(a.pid) === String(x.pid) && /gire|girado/.test(a.titulo));
  }
  // uno que está a punto de girar (aún no) con la cláusula a tiro de un rival: Hoy dice esperar, el aviso también
  const y = (M0.mias || []).find((z) => z.ventaInercia && z.ventaInercia.urgencia !== 'ya' && !M0.enVenta.has(z.pid)) || (M0.mias || []).find((z) => z.ventaInercia && !M0.enVenta.has(z.pid));
  out.y = y ? y.j.nombre : null;
  if (y) {
    const M = Mo.analizar(S.D, S.H, S.c, {});
    const zy = M.mias.find((z) => z.pid === y.pid);
    zy.ventaInercia = { ...zy.ventaInercia, urgencia: 'antes del giro' };
    const ev = M.esperarVenta;
    M.esperarVenta = (z) => (z.pid === y.pid ? { tipo: 'clausula', nota: '' } : ev(z));
    out.espFondo = vende(S.D, M).includes(String(y.pid));
    out.espInercia = A.ventasInercia(M).some((z) => z.pid === y.pid);
  }
  return out;
});
await P.cerrar();
await cerrar();
const nombre = (r) => r;
ok(r.inercia.length > 0, `en la liga de ejemplo hay a quién vender por la inercia (${r.inercia.length})`);
ok(r.hoy.every((p) => r.fondo.includes(p)), `lo que Hoy manda vender por la inercia lo avisa también la app cerrada (${r.hoy.length} de ${r.fondo.length})`);
ok(r.fondo.every((p) => r.inercia.includes(p)), 'la app cerrada no avisa de vender por la inercia a nadie que no salga de ventasInercia');
ok(r.x && !r.lesFondo && r.lesAviso && !r.lesHoy, `${nombre(r.x)}, que gira y se lesiona: un solo aviso, el de la lesión (inercia ${r.lesFondo}, lesión ${r.lesAviso}, Hoy ${r.lesHoy})`);
ok(r.y && !r.espFondo && !r.espInercia, `${r.y}, que aún no ha girado y espera a que le paguen la cláusula: ni Hoy ni el aviso mandan venderlo`);
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
