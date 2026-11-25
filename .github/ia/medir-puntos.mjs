// (24 nov, Carlos: «no es lo mismo uno que sube 2 M al día y ha hecho 15, 14 y 16 que uno que en la última ha hecho 5»)
// ¿Cambian los puntos del último partido lo que sube un jugador que viene subiendo, por encima de lo que dice `proyectar`
// (motor.js: la subida diaria de ahora, frenándose un 15 % cada día)? ¿Y pesa la caída frente a sus partidos de antes?
// Con TODA LaLiga, sin token: el histórico de valor de cada jugador (un punto por día) y los puntos de cada partido
// (/stats/v1/competition/1/stats/week/N, con la fecha de cada partido).
// Mide:
//   1) lo que se equivoca `proyectar` a 3, 7 y 10 días según los puntos del último partido y los días que han pasado
//      desde él (0 = el día del partido, con el valor aún de antes; 1 = el día siguiente, con el primer cambio ya hecho);
//   2) con los mismos puntos en el último partido, si cambia algo que en los 3 de antes hiciera muchos o pocos;
//   3) la tabla que sale de 1) (con las jornadas de la primera mitad) probada en las de la segunda: si la proyección con
//      el efecto se equivoca menos y si la regla de aguantar (`M.aguantar`) elige mejor.
// Uso: node .github/ia/medir-puntos.mjs [carpeta del histórico de valor de medir-aguantar] [carpeta para las jornadas]
import fs from 'node:fs';

const H = 'https://fantasy-api.llt-services.com', CAB = { 'x-app': '2' };
const dirV = process.argv[2] || '/tmp/medir-aguantar', dirS = process.argv[3] || '/tmp/medir-puntos';
fs.mkdirSync(dirS, { recursive: true });
const json = async (u) => { const r = await fetch(u, { headers: CAB, signal: AbortSignal.timeout(40000) }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };

/* ---------- los datos ---------- */
const sem = await json(`${H}/api/v1/competition/1/week/current?x-lang=es`).catch(() => null);
const ultima = sem && sem.weekNumber ? Number(sem.weekNumber) : 13;
const fDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
const diaDe = (iso) => fDia.format(new Date(iso));
const partidos = {};   // pid -> [{ dia, pts, n }]
for (let n = 1; n <= ultima; n++) {
  const f = `${dirS}/w${n}.json`;
  if (!fs.existsSync(f)) { try { fs.writeFileSync(f, JSON.stringify(await json(`${H}/stats/v1/competition/1/stats/week/${n}?x-lang=es`))); } catch (e) { continue; } }
  for (const m of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    if (Number(m.matchState) !== 7 || !m.date) continue;   // solo los acabados
    const dia = diaDe(m.date);
    for (const lado of ['local', 'visitor']) for (const p of (m[lado] && m[lado].players) || []) {
      if (p.weekPoints == null) continue;
      (partidos[p.id] = partidos[p.id] || []).push({ dia, pts: Number(p.weekPoints), n });
    }
  }
}
for (const l of Object.values(partidos)) l.sort((a, b) => (a.dia < b.dia ? -1 : 1));

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const orden = (l) => [...l].sort((a, b) => a - b);
const q = (l, p) => { const o = orden(l); return o.length ? o[Math.floor((o.length - 1) * p)] : NaN; };
const med = (l) => q(l, 0.5), media = (l) => l.reduce((a, b) => a + b, 0) / (l.length || 1);
const pc = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}` : '—');
const pcs = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) : '—');
const modelo = (r, k, f = 0.85) => { let v = 1; for (let j = 0; j < k; j++) v *= 1 + r * Math.pow(f, j); return v - 1; };
const tramo = (p) => (p <= 1 ? '≤1' : p <= 4 ? '2-4' : p <= 7 ? '5-7' : p <= 9 ? '8-9' : '≥10');
const TRAMOS = ['≤1', '2-4', '5-7', '8-9', '≥10'];
const KS = [3, 7, 10];

/* ---------- los casos: un jugador que sube, un día, y su último partido ---------- */
const DESDE = '2026-09-15';
const casos = [];
for (const f of fs.readdirSync(`${dirV}/h`)) {
  const pid = Number(f.replace('.json', ''));
  const P = partidos[pid]; if (!P || !P.length) continue;
  let serie; try { serie = JSON.parse(fs.readFileSync(`${dirV}/h/${f}`, 'utf8')); } catch (e) { continue; }
  const dias = serie.map((x) => x.date.slice(0, 10)), h = serie.map((x) => x.marketValue);
  const idx = new Map(dias.map((d, i) => [d, i]));
  for (let i = 8; i < h.length - 10; i++) {
    if (dias[i] < DESDE) continue;
    const v0 = h[i], v7 = h[i - 7]; if (!v0 || !v7) continue;
    const sub = []; for (let k = i - 8; k <= i; k++) sub.push(h[k] / h[k - 1] - 1);
    let racha = 0; for (let k = sub.length - 1; k >= 0 && sub[k] > 0.004; k--) racha++;
    if (racha < 1) continue;
    const rRec = racha >= 2 ? (sub.slice(-Math.min(racha, 3)).reduce((a, x) => a + x, 0) / Math.min(racha, 3)) * 0.9 : null;
    const r = clamp(Math.max((v0 / v7 - 1) / 7, rRec == null ? -1 : rRec), -0.03, 0.04);
    if (r <= 0.004) continue;
    // el último partido jugado hasta ese día (el del mismo día cuenta: es el «día del partido», con el valor de antes)
    let u = -1; for (let k = 0; k < P.length; k++) if (P[k].dia <= dias[i]) u = k;
    if (u < 0) continue;
    const iP = idx.get(P[u].dia); if (iP == null || iP < 3) continue;
    const s = i - iP;
    if (s > 6) continue;
    const prev = P.slice(Math.max(0, u - 3), u).map((x) => x.pts);
    const como = h[iP] / h[iP - 3] - 1;
    casos.push({ pid, dia: dias[i], n: P[u].n, v0, r, racha, s, pts: P[u].pts, prev3: prev.length === 3 ? media(prev) : null, como,
      real: KS.map((k) => h[i + k] / v0 - 1), proy: KS.map((k) => modelo(r, k)), h: h.slice(i, i + 15) });
  }
}
fs.writeFileSync(`${dirS}/casos.json`, JSON.stringify(casos));
const sube = casos.filter((c) => c.r > 0.008);
console.log(`Casos: ${casos.length} días de jugadores que suben (más de un 0,4 % al día), ${sube.length} de más de un 0,8 % (${new Set(sube.map((c) => c.pid)).size} jugadores), jornadas 1-${ultima}`);

/* ---------- 1) el error de la proyección por puntos y por días desde el partido ---------- */
const fila = (L) => KS.map((k, j) => `${k} d ${pc(med(L.map((c) => c.real[j] - c.proy[j])))}`).join(' · ');
console.log('\n1) LO QUE PASÓ MENOS LO PROYECTADO (mediana, puntos porcentuales), de los que suben más de un 0,8 % al día');
const SS = [[0, '0 (el día del partido)'], [1, '1'], [2, '2'], [3, '3'], [4, '4-6']];
for (const [s, nom] of SS) {
  const L = sube.filter((c) => (s === 4 ? c.s >= 4 : c.s === s));
  console.log(`- ${nom} días desde el partido (${L.length}): ${fila(L)}`);
  for (const t of TRAMOS) { const T = L.filter((c) => tramo(c.pts) === t); if (T.length >= 20) console.log(`    ${t} pts (${T.length}): ${fila(T)}`); }
}
console.log('\n   lo mismo con la MEDIA (no la mediana), 0-1 días desde el partido:');
for (const t of TRAMOS) { const T = sube.filter((c) => c.s <= 1 && tramo(c.pts) === t); console.log(`    ${t} pts (${T.length}): ${KS.map((k, j) => `${k} d ${pc(media(T.map((c) => c.real[j] - c.proy[j])))}`).join(' · ')}`); }

/* ---------- 2) la caída frente a los 3 de antes ---------- */
console.log('\n2) CON LOS MISMOS PUNTOS EN EL ÚLTIMO, ¿PESA LO QUE HIZO EN LOS 3 DE ANTES? (0-2 días desde el partido, suben más de un 0,8 %)');
for (const t of TRAMOS) {
  const T = sube.filter((c) => c.s <= 2 && tramo(c.pts) === t && c.prev3 != null);
  const altos = T.filter((c) => c.prev3 >= 9), medios = T.filter((c) => c.prev3 >= 5 && c.prev3 < 9), bajos = T.filter((c) => c.prev3 < 5);
  console.log(`- ${t} pts en el último: venía de 9 o más de media (${altos.length}): ${fila(altos)} | de 5 a 9 (${medios.length}): ${fila(medios)} | de menos de 5 (${bajos.length}): ${fila(bajos)}`);
}
{
  const caida = sube.filter((c) => c.s <= 2 && c.prev3 != null && c.prev3 >= 10 && c.pts <= c.prev3 - 7);
  const igual = sube.filter((c) => c.s <= 2 && c.prev3 != null && c.prev3 >= 10 && c.pts >= c.prev3 - 3);
  console.log(`- el caso de Carlos (venía de 10 o más de media y hace 7 o más menos): ${caida.length} casos, ${new Set(caida.map((c) => c.pid)).size} jugadores: ${fila(caida)}`);
  console.log(`  frente a los que venían igual y siguen (hacen como mucho 3 menos): ${igual.length}: ${fila(igual)}`);
}

/* ---------- 3) la tabla, aprendida en la primera mitad y probada en la segunda ---------- */
const corte = Math.ceil(ultima / 2) + 1;   // con 13 jornadas: aprender con la 1-7, probar con la 8-13
const aprender = sube.filter((c) => c.n < corte), probar = sube.filter((c) => c.n >= corte);
// por puntos del último partido y días desde él (0, 1, 2, 3+): lo que se equivoca de media a 3, 7 y 10 días
const grupo = (c) => `${tramo(c.pts)}|${Math.min(c.s, 3)}`;
const tablaDe = (L) => {
  const T = {};
  for (const t of TRAMOS) for (let s = 0; s <= 3; s++) {
    const G = L.filter((c) => grupo(c) === `${t}|${s}`);
    if (G.length >= 30) T[`${t}|${s}`] = { n: G.length, e: KS.map((k, j) => media(G.map((c) => c.real[j] - c.proy[j]))) };
  }
  return T;
};
const T1 = tablaDe(aprender);
const conEfecto = (c, T, j) => { const g = T[grupo(c)]; return c.proy[j] + (g ? g.e[j] : 0); };
console.log(`\n3) APRENDIDA CON LAS JORNADAS 1-${corte - 1} (${aprender.length} casos) Y PROBADA CON LAS ${corte}-${ultima} (${probar.length})`);
for (const [j, k] of KS.entries()) {
  const e0 = probar.map((c) => Math.abs(c.real[j] - c.proy[j])), e1 = probar.map((c) => Math.abs(c.real[j] - conEfecto(c, T1, j)));
  const s0 = media(probar.map((c) => c.proy[j] - c.real[j])), s1 = media(probar.map((c) => conEfecto(c, T1, j) - c.real[j]));
  console.log(`- a ${k} días: error medio ${pc(media(e0))} → ${pc(media(e1))} · sesgo ${pc(s0)} → ${pc(s1)}`);
}
// la regla de aguantar, con la proyección de siempre y con el efecto (prima +15,5 %, de 10 M o más, 2 o más días subiendo)
const salida = (c, prima) => { const pagado = c.v0 * (1 + prima); for (let k = 1; k <= 12; k++) { const d = c.h[k] / c.h[k - 1] - 1; if (d < -0.01 || (d <= 0 && c.h[k] > pagado) || k === 12) return c.h[k] / pagado - 1; } return 0; };
const recupera = (proyK, prima) => { for (let k = 1; k <= 30; k++) if (proyK(k) >= prima) return k; return null; };
const efK = (c, T) => { const g = T[grupo(c)]; if (!g) return () => 0; const [e3, e7, e10] = g.e; return (k) => (k <= 3 ? (e3 * k) / 3 : k <= 7 ? e3 + ((e7 - e3) * (k - 3)) / 4 : k <= 10 ? e7 + ((e10 - e7) * (k - 7)) / 3 : e10); };
const regla = (c, prima, T) => { const ef = T ? efK(c, T) : () => 0; const pk = (k) => modelo(c.r, k) + ef(k); const d = recupera(pk, prima); return d != null && d <= 7 && (1 + pk(10)) / (1 + prima) - 1 >= 0.025; };
const PR = probar.filter((c) => c.v0 >= 10e6 && c.racha >= 2 && c.h.length >= 13);
for (const prima of [0.13, 0.155, 0.17]) {
  const a = PR.filter((c) => regla(c, prima, null)), b = PR.filter((c) => regla(c, prima, T1));
  const res = (L) => { const R = L.map((c) => salida(c, prima)); return `${L.length} casos · gana el ${pcs(R.filter((x) => x > 0).length / (R.length || 1))} % · mediana ${pc(med(R))} · p10 ${pc(q(R, 0.1))}`; };
  const fuera = a.filter((c) => !b.includes(c)), dentro = b.filter((c) => !a.includes(c));
  console.log(`- aguantar con prima +${(prima * 100).toFixed(1)} %: sin el efecto ${res(a)} | con el efecto ${res(b)} | los que el efecto quita: ${res(fuera)} | los que añade: ${res(dentro)}`);
}
// la tabla con todas las jornadas (la que iría al motor)
const TT = tablaDe(sube);
console.log('\nTABLA CON TODAS LAS JORNADAS (media de lo que pasó menos lo proyectado, a 3/7/10 días; puntos|días desde el partido):');
for (const [g, x] of Object.entries(TT)) console.log(`  ${g}: n ${x.n} · ${x.e.map(pc).join(' / ')}`);
fs.writeFileSync(`${dirS}/tabla.json`, JSON.stringify({ aprender: T1, todas: TT }, null, 1));

/* ---------- 4) lo que va al motor: SOLO lo de menos (4 puntos o menos), por días desde el partido [0-1, 2, 3-6] ---------- */
// (lo de más, sumado en 3), coge muchos más para aguantar y ganan poco: se queda fuera). `FRENO_PARTIDO` de motor.js sale
// de la tabla con todas las jornadas de aquí abajo; se prueba aprendiendo con una mitad y mirando la otra, en los dos sentidos
const tramoMal = (p) => (p <= 1 ? 'b1' : p <= 4 ? 'b4' : null), sMal = (s) => (s <= 1 ? 0 : s === 2 ? 1 : 2);
const tablaMal = (L) => {
  const T = {};
  for (const b of ['b1', 'b4']) T[b] = [0, 1, 2].map((s) => { const G = L.filter((c) => tramoMal(c.pts) === b && sMal(c.s) === s); return G.length >= 20 ? KS.map((k, j) => Math.min(0, media(G.map((c) => c.real[j] - c.proy[j])))) : null; });
  return T;
};
const efMal = (c, T) => { const b = tramoMal(c.pts), e = b && T[b] && T[b][sMal(c.s)]; if (!e) return () => 0; const [e3, e7, e10] = e; return (k) => (k <= 3 ? (e3 * k) / 3 : k <= 7 ? e3 + ((e7 - e3) * (k - 3)) / 4 : k <= 10 ? e7 + ((e10 - e7) * (k - 7)) / 3 : e10); };
const reglaMal = (c, prima, T) => { const ef = T ? efMal(c, T) : () => 0; const pk = (k) => modelo(c.r, k) + ef(k); const d = recupera(pk, prima); return d != null && d <= 7 && (1 + pk(10)) / (1 + prima) - 1 >= 0.025; };
console.log('\n4) SOLO LO DE MENOS (lo que usa el motor)');
for (const [nA, fA, nP, fP] of [[`1-${corte - 1}`, (c) => c.n < corte, `${corte}-${ultima}`, (c) => c.n >= corte], [`${corte}-${ultima}`, (c) => c.n >= corte, `1-${corte - 1}`, (c) => c.n < corte]]) {
  const T = tablaMal(sube.filter(fA)), P = sube.filter(fP), A = P.filter((c) => tramoMal(c.pts));
  console.log(`- aprendida con las jornadas ${nA}, probada con las ${nP}: error medio en los ${A.length} afectados ${KS.map((k, j) => `a ${k} d ${pc(media(A.map((c) => Math.abs(c.real[j] - c.proy[j]))))} → ${pc(media(A.map((c) => Math.abs(c.real[j] - c.proy[j] - efMal(c, T)(k)))))}`).join(' · ')}`);
  const PRm = P.filter((c) => c.v0 >= 10e6 && c.racha >= 2 && c.h.length >= 13);
  for (const prima of [0.13, 0.155, 0.17]) {
    const a = PRm.filter((c) => reglaMal(c, prima, null)), b = a.filter((c) => reglaMal(c, prima, T)), fuera = a.filter((c) => !b.includes(c));
    const res = (L) => { const R = L.map((c) => salida(c, prima)); return `${L.length} · gana el ${pcs(R.filter((x) => x > 0).length / (R.length || 1))} % · mediana ${pc(med(R))}`; };
    console.log(`    aguantar con prima +${(prima * 100).toFixed(1)} %: sin el freno ${res(a)} | con el freno ${res(b)} | los que quita ${res(fuera)}`);
  }
}
const TM = tablaMal(sube);
console.log(`\nFRENO_PARTIDO (todas las jornadas, a 3/7/10 días; [0-1, 2, 3-6] días desde el partido): ${JSON.stringify(Object.fromEntries(Object.entries(TM).map(([b, l]) => [b, l.map((e) => e && e.map((x) => Math.round(x * 1000) / 1000))])))}`);
