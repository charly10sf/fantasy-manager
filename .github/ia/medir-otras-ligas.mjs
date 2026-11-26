// Mide si lo que se ve juntando todas las ligas (worker/src/ligas.js) SIRVE, antes de enseñar nada (26 nov; Carlos: «que se
// trabaje cometiendo 0 errores»; claude/prompts-26nov-premium-ligas-parte.md del proyecto, encargo 2):
//  (a) lo pagado: ¿lo que se pagó por un jugador en OTRAS ligas en los 3 días de antes predice lo que se paga en una liga
//      mejor que lo que usa hoy la app (`M.pagaLiga`: las compras parecidas de esa liga, mezcladas con las de todas por tramo)?
//  (b) la demanda: ¿las pujas que lleva hoy un libre en las demás ligas explican lo que sube o baja esta noche MÁS ALLÁ de lo
//      que ya dice cómo venía (lo que subía al día en los 3 días de antes)? Si no, la demanda no se enseña.
//  (c) las cláusulas: de las que se abren, cuántas se pagan en 24 h, por tramo (solo la tabla: es la recogida de la idea 6).
//
// Los datos salen de GET /ligas/medida (solo el dueño) y GET /pujas/cal. No llevan ligas ni mánagers: de la liga, un alias
// que solo sirve para agrupar. Dos formas de usarlo:
//
//  1) DENTRO DE LA APP, en el Chrome de Carlos con su web abierta (`?prueba=1`): los datos no salen del navegador y a la
//     sesión solo vuelve el resumen. En la consola (o con la herramienta de JavaScript del navegador):
//       const X = await import(URL.createObjectURL(new Blob([CÓDIGO DE ESTE ARCHIVO], { type: 'text/javascript' })));
//       const So = await import('/js/soporte.js');
//       const v = await X.traer((ruta) => So.pedirWorker('GET', ruta), '2026-11-26');     // desde ese día hasta hoy
//       X.resumen(v)                          // cuánto ha llegado, por día (para mirar a los 3-4 días que llegan datos)
//       X.medirPagado(v.pago, v.cal)          // (a)
//       X.medirDemanda(v.dem, window.S.H.v)   // (b), con los valores de cada día que guarda la app
//       X.medirClausulas(v.cla)               // (c)
//  2) EN NODE, con el volcado guardado en un archivo ({ pago, dem, cla, cal }):
//       node .github/ia/medir-otras-ligas.mjs <volcado.json> [carpeta-caché]
//     Los valores de cada jugador los baja de la API pública de LaLiga (sin sesión) a la carpeta de caché.
//
// REGLAS PARA DECIDIR (escritas antes de ver los datos, para no elegirlas después):
//  (a) lo pagado en otras ligas «sirve para la puja» si, en las compras que tienen dato (3 ligas o más), su error mediano es
//      al menos un 10 % menor que el de la app y acierta más cerca que ella en más de la mitad; y eso mismo en los de más de
//      30 M (donde la app gana el 42 % de las pujas). Con menos de 60 compras con dato (o 20 de más de 30 M), aún no se sabe.
//      Si no sirve para la puja, se puede enseñar como dato (es lo pagado de verdad), sin tocar la puja.
//  (b) la demanda «sirve» si, en la segunda mitad de los días (la primera solo ajusta), baja el error de predecir la subida
//      de esa noche al menos un 5 % frente a «sigue como venía», y los de más demanda suben más que los de menos en las dos
//      mitades. Con menos de 300 casos por mitad, aún no se sabe.
// EL TIPO DE LIGA: cada fila lleva el de su liga («private|8|n»: acceso, clase y si es Premium). No se mezclan: si no se dice
// cuál (`{ tipo }`), se mide el que más filas tiene, y `resumen` dice cuántas hay de cada uno.
// La réplica de `M.pagaLiga` de aquí está copiada de web/js/motor.js el 26 nov de 2026: si cambia allí, cambiar aquí.

const num = (x) => (Number.isFinite(+x) ? +x : 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const cuantil = (l, q) => { const o = [...l].sort((a, b) => a - b); if (!o.length) return NaN; const i = (o.length - 1) * q, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : NaN);
const red = (x, d = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const otroDia = (dia, n) => { const t = new Date(`${dia}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** el tipo de liga que más filas tiene (el suyo va en la posición `i` de cada fila); '' si no lo traen */
export function tipoMas(filas, i) {
  const n = new Map();
  for (const x of filas || []) n.set(x[i] || '', (n.get(x[i] || '') || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || '';
}
const porTipo = (filas, i) => { const n = {}; for (const x of filas || []) n[x[i] || '(sin tipo)'] = (n[x[i] || '(sin tipo)'] || 0) + 1; return n; };

/* ---------- traer lo guardado (el dueño), por meses ---------- */
/** `pedir(ruta)` devuelve el JSON de esa ruta del Worker; desde y hasta, en AAAA-MM-DD (hasta: hoy) */
export async function traer(pedir, desde, hasta = new Date().toISOString().slice(0, 10)) {
  const v = { pago: [], dem: [], cla: [], cal: null, hay: null, cortas: 0 };
  for (let d = desde; d <= hasta; d = otroDia(d, 31)) {
    const h = otroDia(d, 30) < hasta ? otroDia(d, 30) : hasta;
    const x = await pedir(`/ligas/medida?desde=${d}&hasta=${h}`);
    v.pago.push(...(x.pago || [])); v.dem.push(...(x.dem || [])); v.cla.push(...(x.cla || []));
    v.hay = x.hay || v.hay;
    if (x.corta) v.cortas++;
  }
  try { v.cal = await pedir('/pujas/cal'); } catch (e) { v.cal = null; }
  return v;
}
/** cuánto ha llegado, por día: compras con jugador, ligas distintas que las mandan, libres con demanda y cláusulas */
export function resumen(v) {
  const dias = {};
  const d = (k) => (dias[k] ||= { compras: 0, ligas: new Set(), libres: 0, libres5: 0, clausulas: 0 });
  for (const x of v.pago || []) { const y = d(x[0]); y.compras++; y.ligas.add(x[6]); }
  for (const x of v.dem || []) { const y = d(x[0]); y.libres++; if (x[2] >= 5) y.libres5++; }
  for (const x of v.cla || []) d(x[0]).clausulas++;
  const porJug = new Map();
  for (const x of v.pago || []) porJug.set(x[1], (porJug.get(x[1]) || 0) + 1);
  return {
    hay: v.hay || null, cortas: v.cortas || 0, comprasPorTipoDeLiga: porTipo(v.pago, 7), libresPorTipoDeLiga: porTipo(v.dem, 6),
    porDia: Object.keys(dias).sort().map((k) => ({ dia: k, compras: dias[k].compras, ligas: dias[k].ligas.size, libres: dias[k].libres, libresEn5Ligas: dias[k].libres5, clausulas: dias[k].clausulas })),
    jugadoresCon3Compras: [...porJug.values()].filter((n) => n >= 3).length, jugadores: porJug.size,
  };
}

/* ---------- (a) lo pagado en otras ligas frente a lo que usa la app ---------- */
// (copiado de motor.js: TRAMOS_PUJA, CAL_MIN, `M.pagaTodos` y `M.pagaLiga`)
const CAL_MIN = 8, ln25 = Math.log(2.5), SUBE_PASO = 0.01;
const interp = (pts, x, de = 0, a = 1) => {
  if (x <= pts[0][de]) return pts[0][a];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][de]) { const p0 = pts[i - 1], p1 = pts[i]; return p0[a] + (p1[a] - p0[a]) * (x - p0[de]) / ((p1[de] - p0[de]) || 1); }
  return pts[pts.length - 1][a];
};
const tramoDe = (tr, x) => (tr || []).findIndex(([lo, hi]) => x >= lo && x < (hi == null ? Infinity : hi));
/** lo que se paga en todas las ligas por uno de su valor y su subida (la tabla de /pujas/cal); null sin datos */
export function pagaTodos(cal, v, pf = {}) {
  const calP = cal && Number(cal.n) >= CAL_MIN && Array.isArray(cal.celdas) ? cal : null;
  if (!calP || !(v > 0)) return null;
  const iv = tramoDe(calP.tv, v), ir = pf.r == null ? -1 : tramoDe(calP.tr, pf.r);
  const cel = (k) => calP.celdas.find((x) => x.k === k && Number(x.n) >= CAL_MIN);
  const c = (pf.top && ir >= 0 && cel(`top|${ir}`)) || (ir >= 0 && cel(`${iv}|${ir}`)) || cel(`${iv}|*`);
  if (!c) return null;
  const pts = [[0.1, +c.p10], [0.25, +c.p25], [0.5, +c.med], [0.75, +c.p75], [0.9, +c.p90]];
  return { n: c.n, q: (p) => interp(pts, p) };
}
/** lo que usa la app: las compras parecidas de la liga (`propias`: [{ s, v, r, top }], las de antes) mezcladas con las de todas */
export function pagaLiga(propias, cal, v, pf = {}) {
  if (!(v > 0)) return null;
  const conPerfil = pf.r != null || pf.top != null;
  let L = null;
  if (propias && propias.length >= 4) {
    const lv = Math.log(v);
    const cerca = propias.map((y) => {
      const dv = Math.abs(Math.log(y.v) - lv) / ln25;
      const dr = pf.r == null ? 0 : y.r == null ? 0.6 : Math.abs(y.r - pf.r) / SUBE_PASO;
      const dt = pf.top == null ? 0 : !!y.top !== !!pf.top ? 0.5 : 0;
      return { s: y.s, v: y.v, r: y.r, dv, d: dv + dr + dt };
    }).sort((a, b) => a.d - b.d);
    let sel = cerca.filter((y) => y.dv <= 1 && y.d <= 1.6).slice(0, 20);
    if (sel.length < 6) sel = cerca.filter((y) => y.dv <= Math.log(5) / ln25).slice(0, 6);
    if (sel.length >= 4) {
      const o = sel.map((y) => ({ s: y.s, w: conPerfil ? 1 / Math.pow(1 + y.d, 2) : 1 })).sort((a, b) => a.s - b.s);
      const W = o.reduce((s2, y) => s2 + y.w, 0);
      let acc = 0;
      const pts = o.map((y) => { const c2 = (acc + y.w / 2) / W; acc += y.w; return [c2, y.s]; });
      const ss = o.map((y) => y.s);
      L = { n: sel.length, nCerca: sel.filter((y) => y.d <= 1).length, q: conPerfil ? (p) => interp(pts, p) : (p) => cuantil(ss, p) };
    }
  }
  const G = pagaTodos(cal, v, pf);
  if (!L && !G) return null;
  const wL = !L ? 0 : !G ? 1 : clamp((L.nCerca + 0.4 * (L.n - L.nCerca)) / 12, 0.2, 1);
  const q = (p) => (L ? wL * L.q(p) : 0) + (G && wL < 1 ? (1 - wL) * G.q(p) : 0);
  return { n: L ? L.n : 0, wL, med: q(0.5), q };
}
/**
 * pago: [[día, id del jugador, pagado sobre el valor, valor, lo que subía, top, alias de la liga], …]; cal: /pujas/cal.
 * Para cada compra, lo que habría dicho cada uno ANTES de ese día: la app (las compras de esa liga de los 45 días de antes y
 * la tabla de todas) y las demás ligas (las de ese jugador en los 3 días de antes, una por liga, con 3 o más).
 */
export function medirPagado(pago, cal, { dias = 3, minimo = 3, tipo = tipoMas(pago, 7) } = {}) {
  const filas = (pago || []).filter((x) => (x[7] || '') === tipo).map((x) => ({ d: x[0], pid: x[1], s: num(x[2]), v: num(x[3]), r: x[4] == null ? null : num(x[4]), top: !!x[5], lg: x[6] })).filter((x) => x.d && x.v > 0).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const porLiga = new Map(), porJug = new Map();
  for (const x of filas) { (porLiga.get(x.lg) || porLiga.set(x.lg, []).get(x.lg)).push(x); (porJug.get(x.pid) || porJug.set(x.pid, []).get(x.pid)).push(x); }
  const casos = [];
  for (const x of filas) {
    const propias = porLiga.get(x.lg).filter((y) => y.d < x.d && diasEntre(y.d, x.d) <= 45);
    const P = pagaLiga(propias, cal, x.v, { r: x.r, top: x.top });
    const G = pagaTodos(cal, x.v, { r: x.r, top: x.top });
    const deOtras = new Map();
    for (const y of porJug.get(x.pid)) if (y.lg !== x.lg && y.d < x.d && diasEntre(y.d, x.d) <= dias) deOtras.set(y.lg, y.s);
    const o = [...deOtras.values()];
    casos.push({ s: x.s, v: x.v, top: x.top, app: P ? P.med : null, appGana: P ? P.q(clamp(0.6 + (x.top ? 0.12 : 0), 0.5, 0.85)) : null, todas: G ? G.q(0.5) : null, otras: o.length >= minimo ? cuantil(o, 0.5) : null, otrasMax: o.length >= minimo ? Math.max(...o) : null, nOtras: o.length });
  }
  const mide = (l, nombre) => {
    const con = l.filter((c) => c.otras != null && c.app != null);
    if (!con.length) return { quien: nombre, compras: l.length, conDato: 0 };
    const eA = con.map((c) => Math.abs(c.s - c.app)), eO = con.map((c) => Math.abs(c.s - c.otras)), eG = con.filter((c) => c.todas != null).map((c) => Math.abs(c.s - c.todas));
    // pujando lo que hoy propone la app (el cuantil de 6 de cada 10, o de 7 y pico con los top) frente a pujar lo más pagado
    // en las otras ligas, o su mediana más 3 puntos: cuántas se habrían ganado y cuánto se habría pagado de más al ganar
    const puja = (f) => { const g = con.filter((c) => f(c) >= c.s); return { gana: red(g.length / con.length, 3), deMas: red(media(g.map((c) => f(c) - c.s)), 4) }; };
    return {
      quien: nombre, compras: l.length, conDato: con.length,
      errorApp: { mediana: red(cuantil(eA, 0.5)), media: red(media(eA)) }, errorOtras: { mediana: red(cuantil(eO, 0.5)), media: red(media(eO)) }, errorTodas: eG.length ? { mediana: red(cuantil(eG, 0.5)), media: red(media(eG)) } : null,
      otrasMasCerca: red(con.filter((c) => Math.abs(c.s - c.otras) < Math.abs(c.s - c.app)).length / con.length, 3),
      pujaApp: puja((c) => c.appGana), pujaLoMasDeOtras: puja((c) => c.otrasMax), pujaMedianaOtrasMas3: puja((c) => c.otras + 0.03),
    };
  };
  const todos = mide(casos, 'todas las compras'), caros = mide(casos.filter((c) => c.v >= 30e6), 'los de más de 30 M'), baratos = mide(casos.filter((c) => c.v < 3e6), 'los de menos de 3 M');
  const sirve = (m, minN) => (m.conDato < minN ? 'aún no se sabe' : m.errorOtras.mediana <= m.errorApp.mediana * 0.9 && m.otrasMasCerca > 0.5 ? 'sí' : 'no');
  return { tipoDeLiga: tipo, n: filas.length, ligas: porLiga.size, jugadores: porJug.size, todos, caros, baratos, veredicto: { paraLaPuja: sirve(todos, 60), paraLaPujaDeLosCaros: sirve(caros, 20) }, regla: 'sirve si el error mediano de «otras» es al menos un 10 % menor que el de la app y acierta más cerca en más de la mitad; con menos de 60 compras con dato (20 de más de 30 M), aún no se sabe' };
}

/* ---------- (b) la demanda de hoy frente a lo que sube esta noche ---------- */
/**
 * dem: [[día, id del jugador, ligas en las que está libre, ligas con pujas, pujas], …]; valores: { [id]: [[día, valor], …] }
 * (los que guarda la app, `S.H.v`, o los de la API pública). Para cada jugador y día con 5 ligas o más: lo que cambió su
 * valor esa noche (el del día siguiente frente al de ese día) frente a lo que venía cambiando al día en los 3 días de antes.
 */
export function medirDemanda(dem, valores, { minLigas = 5, tipo = tipoMas(dem, 6) } = {}) {
  const serie = new Map();
  const vDe = (pid) => { if (!serie.has(pid)) serie.set(pid, new Map(((valores && (valores[pid] || valores[String(pid)])) || []).map(([d, v]) => [String(d).slice(0, 10), num(v)]))); return serie.get(pid); };
  const porDia = new Map();
  for (const x of dem || []) {
    const [d, pid, ligas, con, pujas] = x;
    if ((x[6] || '') !== tipo || !(ligas >= minLigas)) continue;
    const S = vDe(pid), v0 = S.get(d), v1 = S.get(otroDia(d, 1));
    if (!v0 || !v1) continue;
    let venia = null;
    for (const n of [3, 2, 1]) { const vn = S.get(otroDia(d, -n)); if (vn) { venia = Math.pow(v0 / vn, 1 / n) - 1; break; } }
    if (venia == null) continue;
    (porDia.get(d) || porDia.set(d, []).get(d)).push({ d, pid, x: pujas / ligas, parte: con / ligas, y: v1 / v0 - 1, venia, v: v0 });
  }
  const dias = [...porDia.keys()].sort();
  // dentro de cada día, el puesto de cada uno por pujas por liga (de 0, el que menos, a 1, el que más)
  for (const d of dias) { const l = porDia.get(d).sort((a, b) => a.x - b.x); l.forEach((c, i) => { c.z = l.length > 1 ? i / (l.length - 1) : 0.5; }); }
  const mitad = Math.floor(dias.length / 2);
  const A = dias.slice(0, mitad).flatMap((d) => porDia.get(d)), B = dias.slice(mitad).flatMap((d) => porDia.get(d));
  if (A.length < 20 || B.length < 20) return { tipoDeLiga: tipo, n: A.length + B.length, dias: dias.length, veredicto: 'aún no se sabe', falta: 'hacen falta casos en las dos mitades de los días' };
  // en la primera mitad se ajusta cuánto de más (o de menos) sube uno según su puesto de demanda: resto = a + b·z
  const ajusta = (l) => { const mz = media(l.map((c) => c.z)), mr = media(l.map((c) => c.y - c.venia)); const b = l.reduce((s, c) => s + (c.z - mz) * (c.y - c.venia - mr), 0) / (l.reduce((s, c) => s + (c.z - mz) ** 2, 0) || 1); return { a: mr - b * mz, b }; };
  const tercios = (l) => { const t = (lo, hi) => { const g = l.filter((c) => c.z >= lo && c.z < hi); return { n: g.length, sube: red(media(g.map((c) => c.y)), 5), sobreLoQueVenia: red(media(g.map((c) => c.y - c.venia)), 5) }; }; return { baja: t(0, 1 / 3), media: t(1 / 3, 2 / 3), alta: t(2 / 3, 1.0001) }; };
  const m = ajusta(A);
  const e0 = B.map((c) => Math.abs(c.y - c.venia)), e1 = B.map((c) => Math.abs(c.y - (c.venia + m.a + m.b * c.z)));
  const eur0 = B.map((c) => Math.abs(c.y - c.venia) * c.v), eur1 = B.map((c) => Math.abs(c.y - (c.venia + m.a + m.b * c.z)) * c.v);
  const tA = tercios(A), tB = tercios(B);
  const mejora = 1 - media(e1) / media(e0);
  const mismoSentido = Math.sign(tA.alta.sobreLoQueVenia - tA.baja.sobreLoQueVenia) === Math.sign(tB.alta.sobreLoQueVenia - tB.baja.sobreLoQueVenia) && tB.alta.sobreLoQueVenia > tB.baja.sobreLoQueVenia;
  return {
    tipoDeLiga: tipo, n: A.length + B.length, dias: dias.length, primeraMitad: { n: A.length, ajuste: { a: red(m.a, 5), b: red(m.b, 5) }, tercios: tA }, segundaMitad: { n: B.length, tercios: tB },
    errorComoVenia: { media: red(media(e0), 5), enEuros: Math.round(media(eur0)) }, errorConDemanda: { media: red(media(e1), 5), enEuros: Math.round(media(eur1)) }, mejora: red(mejora, 3),
    veredicto: A.length < 300 || B.length < 300 ? 'aún no se sabe' : mejora >= 0.05 && mismoSentido ? 'sí' : 'no',
    regla: 'sirve si en la segunda mitad de los días el error baja un 5 % o más frente a «sigue como venía» y los de más demanda suben más que los de menos en las dos mitades; con menos de 300 casos por mitad, aún no se sabe',
    ojo: 'esto mira si la demanda añade algo a cómo venía el valor; si sale que sí, lo siguiente es meterla en la inercia del motor y medirla con medir-inercia-publico.mjs (los 216 mil de error a 3 días son de esa medida)',
  };
}

/* ---------- (c) las cláusulas que se abren: cuántas se pagan en 24 h ---------- */
/** cla: [[día, valor, cláusula sobre el valor, lo que subía, puesto, % de titular, se la llevaron, la blindaron, tipo de liga], …] */
export function medirClausulas(cla, { tipo = tipoMas(cla, 8) } = {}) {
  const l = (cla || []).filter((x) => (x[8] || '') === tipo).map((x) => ({ v: num(x[1]), cs: num(x[2]), r: x[3], pos: x[4], tit: x[5], ida: !!x[6], bl: !!x[7] }));
  const sin = l.filter((x) => !x.bl);
  const grupo = (g) => ({ n: g.length, pagadas: g.filter((x) => x.ida).length, parte: g.length ? red(g.filter((x) => x.ida).length / g.length, 3) : null });
  const por = (f, cortes) => Object.fromEntries(cortes.map(([nombre, ok]) => [nombre, grupo(sin.filter((x) => ok(f(x))))]));
  return {
    tipoDeLiga: tipo, n: l.length, blindadas: l.length - sin.length, sinBlindar: grupo(sin),
    porValor: por((x) => x.v, [['menos de 5 M', (v) => v < 5e6], ['5 a 20 M', (v) => v >= 5e6 && v < 20e6], ['20 a 40 M', (v) => v >= 20e6 && v < 40e6], ['más de 40 M', (v) => v >= 40e6]]),
    porClausula: por((x) => x.cs, [['a su valor (hasta +3 %)', (c) => c <= 0.03], ['+3 a +15 %', (c) => c > 0.03 && c <= 0.15], ['más de +15 %', (c) => c > 0.15]]),
    porTendencia: por((x) => x.r, [['subía', (r) => r != null && r > 0.004], ['parado', (r) => r != null && r >= -0.004 && r <= 0.004], ['bajaba', (r) => r != null && r < -0.004]]),
    porTitular: por((x) => x.tit, [['titular (60 % o más)', (t) => t != null && t >= 60], ['no titular', (t) => t != null && t < 60]]),
  };
}

/* ---------- en node: con el volcado en un archivo ---------- */
const enNode = typeof process !== 'undefined' && process.argv && process.argv[1] && /medir-otras-ligas\.mjs$/.test(process.argv[1]);
if (enNode) {
  const fs = await import('node:fs'), path = await import('node:path');
  const [arch, dir] = process.argv.slice(2);
  if (!arch) { console.error('uso: node .github/ia/medir-otras-ligas.mjs <volcado.json> [carpeta-caché]'); process.exit(1); }
  const v = JSON.parse(fs.readFileSync(arch, 'utf8'));
  const out = { resumen: resumen(v), pagado: medirPagado(v.pago, v.cal), clausulas: medirClausulas(v.cla) };
  // los valores de cada día, de la API pública de LaLiga (sin sesión), guardados en la carpeta de caché
  const ids = [...new Set((v.dem || []).filter((x) => x[2] >= 5 && (x[6] || '') === tipoMas(v.dem, 6)).map((x) => x[1]))];
  if (dir && ids.length) {
    fs.mkdirSync(path.join(dir, 'mv'), { recursive: true });
    const valores = {};
    const traerV = async (id) => {
      const f = path.join(dir, 'mv', `${id}.json`);
      let j = null;
      if (fs.existsSync(f) && fs.statSync(f).size > 2) j = JSON.parse(fs.readFileSync(f, 'utf8'));
      else { const r = await fetch(`https://fantasy-api.llt-services.com/api/v1/competition/1/player/${id}/market-value?x-lang=es`, { headers: { 'x-app': '2' }, signal: AbortSignal.timeout(30000) }); if (!r.ok) return; const t = await r.text(); fs.writeFileSync(f, t); j = JSON.parse(t); }
      valores[id] = (Array.isArray(j) ? j : []).map((x) => [String(x.date || '').slice(0, 10), num(x.marketValue)]).filter((x) => x[0] && x[1]);
    };
    for (let i = 0; i < ids.length; i += 8) await Promise.all(ids.slice(i, i + 8).map((id) => traerV(id).catch(() => {})));
    out.demanda = medirDemanda(v.dem, valores);
  } else out.demanda = { veredicto: 'sin medir', falta: 'pasa una carpeta de caché para bajar los valores de cada día' };
  console.log(JSON.stringify(out, null, 1));
}
