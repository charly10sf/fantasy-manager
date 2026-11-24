// (24 nov, aviso de Domy) ¿Sale a cuenta comprar a uno que sube fuerte pagando lo que se paga en una liga por él (un
// +13-20 % sobre su valor) si se aguanta unos días? Con el histórico de valor de TODA LaLiga (la API de LaLiga sin token,
// un punto por día y jugador), mide:
//   1) si la proyección del motor (`proyectar` de motor.js: la subida diaria de ahora, que se frena un 15 % cada día)
//      casa con lo que pasó de verdad a 3, 5, 7, 10 y 14 días;
//   2) qué pasa pagando una prima y saliendo como hace la app con lo comprado para revender (`M.aguantaReventa`): se
//      vende el primer día que baja más de un 1 %, o que deja de subir valiendo ya más de lo pagado, o a los 12 días.
// Es lo que justifica `M.aguantar` (recuperar lo pagado de más en 7 días o menos y ganar un 2,5 % a los 10).
// Uso: node .github/ia/medir-aguantar.mjs [carpeta para guardar lo bajado]   (unas 880 peticiones, 6 a la vez)
import fs from 'node:fs';

const H = 'https://fantasy-api.llt-services.com', CAB = { headers: { 'x-app': '2' }, signal: undefined };
const dir = process.argv[2] || '/tmp/medir-aguantar';
fs.mkdirSync(`${dir}/h`, { recursive: true });
const json = async (u) => { const r = await fetch(u, { headers: CAB.headers, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${r.status}`); return r.json(); };
const ids = (await json(`${H}/api/v1/competition/1/players?x-lang=es`)).map((p) => p.id);
{
  let i = 0, mal = 0;
  const uno = async () => { while (i < ids.length) { const id = ids[i++], f = `${dir}/h/${id}.json`; if (fs.existsSync(f)) continue; try { fs.writeFileSync(f, JSON.stringify(await json(`${H}/api/v1/competition/1/player/${id}/market-value?x-lang=es`))); } catch (e) { mal++; } } };
  await Promise.all(Array.from({ length: 6 }, uno));
  if (mal) console.log(`sin histórico: ${mal}`);
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const orden = (l) => [...l].sort((a, b) => a - b);
const q = (l, p) => { const o = orden(l); return o.length ? o[Math.floor((o.length - 1) * p)] : NaN; };
const med = (l) => q(l, 0.5), media = (l) => l.reduce((a, b) => a + b, 0) / (l.length || 1);
const pc = (x) => `${(x * 100).toFixed(1)} %`;
/** la proyección del motor: la subida de hoy, frenándose un 15 % cada día */
const modelo = (r, k, f = 0.85) => { let v = 1; for (let j = 0; j < k; j++) v *= 1 + r * Math.pow(f, j); return v - 1; };
const DESDE = 75;   // desde mediados de septiembre (el histórico empieza el 29 de junio)
const casos = [];
for (const id of ids) {
  let h; try { h = JSON.parse(fs.readFileSync(`${dir}/h/${id}.json`, 'utf8')).map((x) => x.marketValue); } catch (e) { continue; }
  for (let i = DESDE; i < h.length - 3; i++) {
    const v0 = h[i], v7 = h[i - 7]; if (!v0 || !v7) continue;
    const sub = []; for (let k = i - 8; k <= i; k++) sub.push(h[k] / h[k - 1] - 1);
    let racha = 0; for (let k = sub.length - 1; k >= 0 && sub[k] > 0.004; k--) racha++;
    if (racha < 1) continue;
    // la subida diaria como en `proyectar`: la de 7 días o, con 2 o más días subiendo, la de esos días rebajada un 10 %
    const rRec = racha >= 2 ? sub.slice(-Math.min(racha, 3)).reduce((a, x) => a + x, 0) / Math.min(racha, 3) * 0.9 : null;
    const r = clamp(Math.max((v0 / v7 - 1) / 7, rRec == null ? -1 : rRec), -0.03, 0.04);
    if (r > 0.008) casos.push({ id, v0, r, racha, h: h.slice(i, i + 15) });
  }
}
console.log(`\n1) LA PROYECCIÓN FRENTE A LO QUE PASÓ (suben más de un 0,8 % al día): ${casos.length} casos, ${new Set(casos.map((c) => c.id)).size} jugadores`);
for (const [n, f] of [['todos', () => true], ['de 10 M o más', (c) => c.v0 >= 10e6], ['de 30 M o más', (c) => c.v0 >= 30e6], ['de 30 M o más y un 2,5 % al día o más', (c) => c.v0 >= 30e6 && c.r >= 0.025], ['de 30 M o más, entre un 1,3 y un 2,3 % al día', (c) => c.v0 >= 30e6 && c.r >= 0.013 && c.r <= 0.023]]) {
  const L = casos.filter(f);
  console.log(`- ${n} (${L.length}): ${[3, 5, 7, 10, 14].map((k) => { const S = L.filter((c) => c.h[k]); return `a ${k} d, proyección ${pc(med(S.map((c) => modelo(c.r, k))))} y real ${pc(med(S.map((c) => c.h[k] / c.v0 - 1)))} (p25 ${pc(q(S.map((c) => c.h[k] / c.v0 - 1), 0.25))})`; }).join(' · ')}`);
}
const salida = (c, prima) => { const pagado = c.v0 * (1 + prima); for (let k = 1; k <= 12; k++) { const d = c.h[k] / c.h[k - 1] - 1; if (d < -0.01 || (d <= 0 && c.h[k] > pagado) || k === 12) return c.h[k] / pagado - 1; } return 0; };
const recupera = (r, prima) => { for (let k = 1; k <= 30; k++) if (modelo(r, k) >= prima) return k; return null; };
const S2 = casos.filter((c) => c.v0 >= 10e6 && c.racha >= 2 && c.h.length >= 13);
console.log(`\n2) PAGANDO UNA PRIMA Y SALIENDO COMO LA APP (de 10 M o más, 2 o más días subiendo): ${S2.length} casos`);
for (const prima of [0.10, 0.13, 0.155, 0.17]) {
  console.log(`- prima +${pc(prima)}`);
  for (const [n, f] of [['la regla de la app (se recupera en 7 d o menos y +2,5 % a los 10)', (c) => { const d = recupera(c.r, prima); return d != null && d <= 7 && (1 + modelo(c.r, 10)) / (1 + prima) - 1 >= 0.025; }], ['se recupera en 8-10 d', (c) => { const d = recupera(c.r, prima); return d != null && d >= 8 && d <= 10; }], ['no se recupera en 10 d', (c) => { const d = recupera(c.r, prima); return d == null || d > 10; }]]) {
    const R = S2.filter(f).map((c) => salida(c, prima));
    console.log(`    ${n}: ${R.length} casos · gana en el ${pc(R.filter((x) => x > 0).length / (R.length || 1))} · media ${pc(media(R))} · mediana ${pc(med(R))} · p25 ${pc(q(R, 0.25))} · p10 ${pc(q(R, 0.1))}`);
  }
}
