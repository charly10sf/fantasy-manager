// Mide, con una liga de verdad y las jornadas ya jugadas, lo que la app propondría en una liga premium ANTES de enseñarlo
// (claude/premium-sesion-b.md del proyecto): el capitán (puntúa doble) y el banquillo (uno por puesto; entra si un titular
// de su puesto no juega ni un minuto). Para cada jornada rehace el motor como habría salido 3 h antes del primer partido
// (medir-motor.mjs: `motorEn`) y, con el once que alineó de verdad cada mánager (/teams/{eq}/lineup/week/N), compara:
//   capitán  → el de más puntos esperados de la app, «el de más media que juegue seguro» y el mejor posible;
//   banquillo → cuántas veces habría entrado el suplente y cuántos puntos habría salvado.
// Se usa DENTRO de la app, con la liga cargada (los datos no salen del navegador). Los módulos de la app, con el `?v=` con el
// que ya están cargados (para que sean los mismos); este archivo y medir-motor.mjs, por Blob:
//   const B = await import(blob de medir-motor.mjs), MP = await import(blob de este archivo);
//   window.__mp = await MP.medir({ B, analizar, U, api, N, V, Dt, calib, S: window.S })
// Lo que devuelve son cifras agregadas (ningún nombre de mánager). OJO: el estado de cada jugador (lesionado, duda) y los
// onces probables de la prensa de entonces no se guardan: se mide con todos «disponibles» y la titularidad por sus minutos.
const HORA = 36e5;
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);
const desv = (l) => { if (l.length < 2) return null; const m = media(l); return Math.sqrt(l.reduce((s, x) => s + (x - m) ** 2, 0) / (l.length - 1)); };
const mejorPor = (l, f) => l.reduce((m, x) => (m == null || f(x) > f(m) ? x : m), null);

export async function medir(o) {
  const { B, analizar, U, api, N, V, Dt, S, calib = null, desde = 4, hasta = 13, umbral = 0.7, paso = () => {} } = o;
  const D0 = S.D, liga = D0.liga.id;
  // todos «disponibles»: el estado de hoy no es el de entonces
  const maestro = {};
  for (const [pid, j] of Object.entries(D0.maestro || {})) maestro[pid] = { ...j, estado: 'ok' };
  const X = { sacado: Date.now(), datos: { ...D0, maestro }, hist: S.H, acthist: Dt.actHist(liga), det: { ...Dt.detalles() }, calib, cfg: Dt.cfg() };
  X.calPasado = await B.calendarioPasado({ api }, N, D0);
  let P = B.preparar(X, { analizar, U });
  const jors = P.jor.filter((j) => j.n >= desde && j.n <= hasta && j.fin < Date.now());
  const equipos = D0.clasif.map((e) => e.teamId);
  paso(`jornadas ${jors.map((j) => j.n).join(',')}; ${equipos.length} equipos`);

  // 1. los onces que alineó cada uno
  let onces = {};
  try { onces = JSON.parse(sessionStorage.getItem('mp-onces') || '{}'); } catch (e) { /* vacío */ }
  for (const jo of jors) for (const t of equipos) {
    const k = `${t}:${jo.n}`;
    if (onces[k] && onces[k].ids && onces[k].ids.length) continue;
    try { const r = await api.onceSemana(t, jo.n); onces[k] = { ids: V.idsOnce(r).map(String), forma: V.formaOnce(r) }; } catch (e) { onces[k] = { ids: [], err: String(e && e.message).slice(0, 60) }; }
    await espera(150);
  }
  try { sessionStorage.setItem('mp-onces', JSON.stringify(onces)); } catch (e) { /* sin sitio */ }
  paso('onces leídos');

  // 2. las plantillas de entonces y la ficha (puntos y minutos por jornada) de todos los que salen
  const pids = new Set(), antes = {};
  for (const jo of jors) {
    const pa = B.pasado(P, jo.ini - 3 * HORA);
    antes[jo.n] = pa.D.plantillas;
    for (const fs of Object.values(pa.D.plantillas)) for (const f of fs) pids.add(String(f.pid));
    for (const t of equipos) for (const id of (onces[`${t}:${jo.n}`] || { ids: [] }).ids) pids.add(id);
  }
  const ultima = Math.max(...jors.map((j) => j.n));
  const alDia = (d) => d && Array.isArray(d.stats) && d.stats.length && Math.max(...d.stats.map((s) => s.n)) >= ultima;
  const faltan = [...pids].filter((id) => !alDia(X.det[id]));
  let pedidas = 0, fallidas = 0;
  const cola = [...faltan];
  await Promise.all([0, 1, 2].map(async () => {
    while (cola.length) {
      const id = cola.shift();
      try { const d = N.detalleJugador(await api.jugador(id, liga)); if (d && Array.isArray(d.stats)) { X.det[id] = { ...(X.det[id] || {}), ...d }; pedidas++; } } catch (e) { fallidas++; }
      await espera(120);
    }
  }));
  paso(`fichas: ${pids.size} jugadores, ${pedidas} pedidas, ${fallidas} fallidas`);
  P = B.preparar(X, { analizar, U });

  const real = (pid, n) => {
    const st = (X.det[pid] || {}).stats;
    if (st && st.length) { const s = st.find((x) => x.n === n); return s ? { pts: num(s.pts), min: num(s.min) } : { pts: 0, min: 0 }; }
    const sem = (D0.maestro[pid] || {}).semanas, s = sem && sem.find((x) => x.n === n);
    return s ? { pts: num(s.pts), min: null } : null;
  };
  // ¿jugó su equipo en el bloque de la jornada? (un aplazado no cuenta como «no jugó ni un minuto»)
  const jugoEq = (eq, jo) => P.fixtures.some((p) => p.jornada === jo.n && (String(p.localId) === String(eq) || String(p.visitanteId) === String(eq)) && p.fecha >= jo.ini - HORA && p.fecha <= jo.fin);

  const variantes = calib ? [['sinCalib', undefined], ['conCalib', calib]] : [['sinCalib', undefined]];
  const out = { jornadas: jors.map((j) => j.n), equipos: equipos.length, fichas: { jugadores: pids.size, pedidas, fallidas }, umbral };
  for (const [nombreV, cal] of variantes) {
    const POL = ['app', 'appSeguro', 'appCerca', 'media', 'mediaSegura', 'forma5Segura', 'mejor'];
    const cap = Object.fromEntries(POL.map((k) => [k, { pts: [], acierta: 0, sinJugar: 0 }]));
    const azar = [], distintos = { n: 0, appGana: 0, mediaGana: 0, igual: 0 }, porJ = {};
    const ban = { onces: 0, conEntrada: 0, dobles: 0, aplazados: 0, riesgoAcierta: 0, riesgoDe: 0,
      pos: Object.fromEntries([1, 2, 3, 4].map((p) => [p, { huecos: 0, sinSuplente: 0, entra: 0, app: 0, media: 0, mejor: 0, appSinJugar: 0 }])) };
    const ptsOnce = { app: [], media: [], mejor: [] };
    let saltadas = 0, cortos = 0, fueraPlantilla = 0, alineados = 0;
    for (const jo of jors) {
      const { M, D } = B.motorEn(P, jo.ini - 3 * HORA, cal === undefined ? {} : { calib: cal });
      if (!M.proxima || M.proxima.n !== jo.n) { saltadas++; continue; }
      porJ[jo.n] = { n: 0, app: 0, mediaSegura: 0, mejor: 0 };
      for (const t of equipos) {
        const oc = onces[`${t}:${jo.n}`];
        if (!oc || !oc.ids || !oc.ids.length) { cortos++; continue; }
        const info = oc.ids.map((id) => D.maestro[id]).filter((j) => j && j.pos >= 1 && j.pos <= 4).map((j) => {
          const d = M.ppDetalle(j), r = real(String(j.id), jo.n), u5 = (j.semanas || []).slice(-5);
          const pT = d && d.T ? d.T.p : null;
          return { j, pp: d ? d.final : 0, pT, media: num(j.media), u5: u5.length ? u5.reduce((s, x) => s + num(x.pts), 0) / u5.length : 0,
            r: r ? r.pts : 0, min: r ? r.min : null, seguro: pT == null ? true : pT >= umbral };
        });
        if (info.length < 9) { cortos++; continue; }
        const plant = new Set((antes[jo.n][t] || []).map((f) => String(f.pid)));
        alineados += info.length; fueraPlantilla += info.filter((x) => !plant.has(String(x.j.id))).length;
        // --- el capitán ---
        const seguros = info.some((x) => x.seguro) ? info.filter((x) => x.seguro) : info;
        const orden = [...info].sort((a, b) => b.pp - a.pp);
        const cerca = orden[1] && orden[1].pp >= orden[0].pp * 0.92 && num(orden[1].pT) >= num(orden[0].pT) + 0.1 ? orden[1] : orden[0];
        const elige = {
          app: orden[0], appSeguro: mejorPor(seguros, (x) => x.pp), appCerca: cerca,
          media: mejorPor(info, (x) => x.media), mediaSegura: mejorPor(seguros, (x) => x.media), forma5Segura: mejorPor(seguros, (x) => x.u5), mejor: mejorPor(info, (x) => x.r),
        };
        const tope = elige.mejor.r;
        for (const k of POL) { const e = elige[k]; cap[k].pts.push(e.r); if (e.r >= tope) cap[k].acierta++; if (e.min === 0) cap[k].sinJugar++; }
        azar.push(media(info.map((x) => x.r)));
        if (elige.app.j.id !== elige.mediaSegura.j.id) { distintos.n++; if (elige.app.r > elige.mediaSegura.r) distintos.appGana++; else if (elige.app.r < elige.mediaSegura.r) distintos.mediaGana++; else distintos.igual++; }
        porJ[jo.n].n++; porJ[jo.n].app += elige.app.r; porJ[jo.n].mediaSegura += elige.mediaSegura.r; porJ[jo.n].mejor += tope;
        // --- el banquillo: uno por puesto, de los de su plantilla de entonces que no alineó ---
        ban.onces++;
        let entradas = 0;
        const suma = { app: 0, media: 0, mejor: 0 };
        for (const p of [1, 2, 3, 4]) {
          const tit = info.filter((x) => x.j.pos === p);
          if (!tit.length) continue;
          const B_ = ban.pos[p];
          B_.huecos++;
          const cands = [...plant].filter((id) => !oc.ids.includes(id)).map((id) => D.maestro[id]).filter((j) => j && j.pos === p).map((j) => {
            const d = M.ppDetalle(j), r = real(String(j.id), jo.n);
            return { j, pp: d ? d.final : 0, media: num(j.media), r: r ? r.pts : 0, min: r ? r.min : null };
          });
          if (!cands.length) { B_.sinSuplente++; continue; }
          const fuera = tit.filter((x) => x.min === 0);
          const fueraJug = fuera.filter((x) => jugoEq(x.j.equipoId, jo));
          if (fuera.length && !fueraJug.length) ban.aplazados++;
          if (!fueraJug.length) continue;
          if (fueraJug.length > 1) ban.dobles++;
          // ¿el que no jugó era el titular de su puesto al que la app daba menos opciones de jugar?
          if (tit.length > 1) { ban.riesgoDe++; const flojo = mejorPor(tit, (x) => -num(x.pT == null ? 1 : x.pT)); if (fueraJug.includes(flojo)) ban.riesgoAcierta++; }
          const a = mejorPor(cands, (x) => x.pp), m = mejorPor(cands, (x) => x.media), mj = mejorPor(cands, (x) => x.r);
          B_.entra++; entradas++;
          B_.app += a.r; B_.media += m.r; B_.mejor += mj.r;
          suma.app += a.r; suma.media += m.r; suma.mejor += mj.r;
          if (a.min === 0) B_.appSinJugar++;
        }
        if (entradas) ban.conEntrada++;
        for (const k of Object.keys(suma)) ptsOnce[k].push(suma[k]);
      }
    }
    const n = cap.app.pts.length;
    const res = { onces: n, saltadas, cortos, alineadosFueraDePlantilla: alineados ? r2(fueraPlantilla / alineados) : null, capitan: {}, banquillo: null };
    for (const k of POL) res.capitan[k] = { media: r2(media(cap[k].pts)), total: cap[k].pts.reduce((s, x) => s + x, 0), acierta: r2(cap[k].acierta / n), sinJugar: cap[k].sinJugar };
    res.capitan.alAzar = { media: r2(media(azar)) };
    const par = (a, b) => { const d = cap[a].pts.map((x, i) => x - cap[b].pts[i]); const s = desv(d); return { media: r2(media(d)), error: s == null ? null : r2(s / Math.sqrt(d.length)), gana: d.filter((x) => x > 0).length, igual: d.filter((x) => x === 0).length, pierde: d.filter((x) => x < 0).length }; };
    res.capitan.appMenosMediaSegura = par('app', 'mediaSegura');
    res.capitan.appSeguroMenosMediaSegura = par('appSeguro', 'mediaSegura');
    res.capitan.appCercaMenosMediaSegura = par('appCerca', 'mediaSegura');
    res.capitan.appMenosMedia = par('app', 'media');
    res.capitan.cuandoNoCoinciden = distintos;
    res.capitan.porJornada = Object.fromEntries(Object.entries(porJ).map(([k, v]) => [k, v.n ? [r2(v.app / v.n), r2(v.mediaSegura / v.n), r2(v.mejor / v.n)] : null]));
    res.banquillo = {
      onces: ban.onces, conAlgunaEntrada: ban.conEntrada, parte: ban.onces ? r2(ban.conEntrada / ban.onces) : null, dosDelMismoPuesto: ban.dobles, soloAplazado: ban.aplazados,
      elDeMasRiesgo: ban.riesgoDe ? `${ban.riesgoAcierta}/${ban.riesgoDe}` : null,
      puntosPorOnceYJornada: { app: r2(media(ptsOnce.app)), media: r2(media(ptsOnce.media)), mejor: r2(media(ptsOnce.mejor)) },
      porPuesto: Object.fromEntries(Object.entries(ban.pos).map(([p, v]) => [p, { huecos: v.huecos, sinSuplente: v.sinSuplente, entra: v.entra, app: v.app, media: v.media, mejor: v.mejor, appSinJugar: v.appSinJugar }])),
    };
    out[nombreV] = res;
  }
  return out;
}
