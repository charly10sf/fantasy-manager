// (26 nov, encargo 3 de claude/prompts-26nov-premium-ligas-parte.md) El parte de los rivales (web/js/parte.js): de cada rival,
// solo lo que cambia lo que puedes hacer tú. Una comprobación por regla:
//  - los hechos: le falta gente en un puesto (sin jugadores, con el único lesionado, con el único dudoso, con su equipo sin
//    partido en la jornada), tiene 25, ha gastado los blindajes, y «en rojo» solo si es seguro: negativo también con el margen
//    y con las recompensas que le quedan por coger, y nunca con el premio de la última jornada sin pagar;
//  - las líneas: «le falta» solo sale si te toca (pujas tú por un libre de ese puesto, o vendes uno de ese puesto); con 25
//    dice que no puede pujar; «en rojo» solo con uno suyo que te sirve y que puedes pagar; «sin blindajes» solo si hay algo
//    suyo que clausularías hoy; lo que el plan descarta no sale nunca; «le sobra» está apagada (lo medido: no se cumple);
//  - las llaves: lo del dinero no se ve con el dinero de ese rival cerrado, y el candado del dinero sale igual haya o no algo
//    detrás; con el parte cerrado no se ve nada; se abre con 2 anuncios y hasta que empieza la jornada;
//  - la pantalla: Rivales → Parte, cerrada (ni una palabra de dentro) y abierta.
// Sin IA ni red. Uso: node .github/ia/caso-parte.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import { pagina, cerrar } from './banco.mjs';

const P = await pagina('martes');
let mal = 0;
const ok = (c, t) => { console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); if (!c) mal++; };
try {
  const r = await P.page.evaluate(async () => {
    const Mo = await import('./js/motor.js'), Pa = await import('./js/parte.js'), Li = await import('./js/limite.js'), Vi = await import('./js/vistas.js'), U = await import('./js/util.js');
    const S = window.S, DIA = 864e5, HORA = 36e5, ahora = Date.now();
    const copia = (x) => JSON.parse(JSON.stringify(x));
    const yo = S.D.yo.teamId;
    const riv = S.D.clasif.filter((e) => e.teamId !== yo).map((e) => e.teamId);
    const tid = riv[0], tid2 = riv[1];
    const montar = (toca = () => {}) => { const D = copia(S.D), H = copia(S.H); toca(D, H); const M = Mo.analizar(D, H, S.c, { det: S.det }); return { D, H, M }; };
    const hechos = (A, t = tid) => Pa.hechosRival(A.M, A.M.rivales.find((x) => x.e.teamId === t));
    const parteDe = (A, opc) => Pa.parte(A.M, A.D, { ahora: T, ...(opc || {}) });
    const lineasDe = (A, t = tid, opc) => (parteDe(A, opc).rivales.find((x) => x.tid === t) || { lineas: [] }).lineas;
    const pos = (D, pid) => (D.maestro[pid] || {}).pos;
    const out = {};
    const base = montar();
    const jo = base.M.proxima;
    out.hayJornada = !!jo;
    // el parte sale desde 4 días antes del primer partido: las líneas se miran como si faltaran 2 días
    const T = jo.ini - 2 * DIA;
    const conReloj = (t, f) => { const real = Date.now; Date.now = () => t; try { return f(); } finally { Date.now = real; } };
    out.ventana = { antes: Pa.ventanaParte(base.M, jo.ini - 5 * DIA).toca === false && Pa.parte(base.M, base.D, { ahora: jo.ini - 5 * DIA }).rivales.length === 0, dentro: Pa.ventanaParte(base.M, T).toca === true, empezada: Pa.ventanaParte(base.M, jo.ini + HORA).toca === false,
      enJuego: Pa.ventanaParte(Object.assign(Object.create(base.M), { enJuego: { n: jo.n - 1, ini: T - DIA, fin: T + HORA } }), T).toca === false, sinJornada: Pa.ventanaParte(Object.assign(Object.create(base.M), { proxima: null }), T).toca === false && Pa.parte(Object.assign(Object.create(base.M), { proxima: null }), base.D).rivales.length === 0 };

    /* ---- los hechos: le falta gente en un puesto ---- */
    const sinPorteros = (D) => { D.plantillas[tid] = D.plantillas[tid].filter((f) => pos(D, f.pid) !== 1); };
    const unPortero = (D) => { const ps = D.plantillas[tid].filter((f) => pos(D, f.pid) === 1); if (!ps.length) { const libre = Object.values(D.maestro).find((j) => j.pos === 1 && j.estado === 'ok' && !Object.values(D.plantillas).some((l) => l.some((f) => f.pid === j.id))); D.plantillas[tid].push({ pid: libre.id, clausula: Math.max(1e6, libre.valor) }); return libre.id; } D.plantillas[tid] = D.plantillas[tid].filter((f) => pos(D, f.pid) !== 1 || f.pid === ps[0].pid); return ps[0].pid; };
    {
      const A = montar(sinPorteros), h = hechos(A);
      const B = montar((D) => { const p = unPortero(D); D.maestro[p].estado = 'injured'; }), hb = hechos(B);
      const C = montar((D) => { const p = unPortero(D); D.maestro[p].estado = 'doubtful'; }), hc = hechos(C);
      const E = montar((D) => { const p = unPortero(D); D.maestro[p].estado = 'ok'; }), he = hechos(E);
      // su equipo no juega la jornada: sin su partido en el calendario
      const F = montar((D) => { const p = unPortero(D); D.maestro[p].estado = 'ok'; const eq = D.maestro[p].equipoId; const n = jo.n; D.partidos = D.partidos.filter((x) => !(x.jornada === n && (x.localId === eq || x.visitanteId === eq))); }), hf = hechos(F);
      const Z = montar((D) => { D.plantillas[tid] = []; }), hz = hechos(Z);
      out.sinPlantilla = hz.sinPlantilla && !Object.keys(hz.falta).length && !lineasDe(Z).length;
      out.falta = { sin: h.falta[1] === 1, lesionado: hb.falta[1] === 1, dudoso: hc.falta[1] === 1 && !hc.faltaDuda[1], sano: !he.falta[1], sinPartido: hf.falta[1] === 1, misma: F.M.proxima && F.M.proxima.n === jo.n };
    }

    /* ---- la línea «le falta»: solo si te toca ---- */
    const porteroLibre = (D) => D.mercado.find((m) => m.tipo === 'liga' && pos(D, m.pid) === 1 && D.maestro[m.pid].estado === 'ok');
    const meterPorteroLibre = (D) => { if (porteroLibre(D)) return porteroLibre(D); const libre = Object.values(D.maestro).find((j) => j.pos === 1 && j.estado === 'ok' && j.valor > 0 && !Object.values(D.plantillas).some((l) => l.some((f) => f.pid === j.id))); const m0 = D.mercado.find((m) => m.tipo === 'liga'); const m = { ...m0, id: 'prueba-por', pid: libre.id, precio: libre.valor, pujas: 0, miPuja: null }; D.mercado.push(m); return m; };
    {
      const A = montar((D) => { sinPorteros(D); const m = meterPorteroLibre(D); m.miPuja = null; for (const x of D.mercado) if (pos(D, x.pid) === 1) x.miPuja = null; });
      const la = lineasDe(A).filter((l) => l.tipo === 'falta' && l.pos === 1);
      const planPuja = (A.M.mercado || []).some((m) => m.tipo === 'liga' && m.j.pos === 1 && (A.M.decisionFichar(m.pid) || {}).accion === 'fichar');
      const vendoPortero = (A.M.mias || []).some((x) => x.j.pos === 1 && (A.M.decision(x.pid) || {}).accion === 'vender');
      let pidPuja = null;
      const B = montar((D) => { sinPorteros(D); const m = meterPorteroLibre(D); for (const x of D.mercado) if (pos(D, x.pid) === 1) x.miPuja = null; m.miPuja = m.precio; pidPuja = m.pid; });
      const lb = lineasDe(B).filter((l) => l.tipo === 'falta' && l.pos === 1);
      const C = montar((D) => { sinPorteros(D); const m = meterPorteroLibre(D); m.miPuja = m.precio; const mol = Object.values(D.maestro).find((j) => j.pos === 2 && j.estado === 'ok'); for (let i = 0; D.plantillas[tid].length < 24; i++) { const id = `prueba-def-${i}`; D.maestro[id] = { ...mol, id, nombre: `Relleno ${i}` }; D.plantillas[tid].push({ pid: id, clausula: Math.max(1e6, mol.valor) }); } window.__n25 = D.plantillas[tid].length; });
      const lc = lineasDe(C).filter((l) => l.tipo === 'falta' && l.pos === 1);
      out.lineaFalta = {
        sinTocarte: planPuja || vendoPortero ? null : la.length === 0,
        conMiPuja: lb.length === 1 && lb[0].llave === 'parte' && lb[0].pids.includes(pidPuja) && /^Le faltan? .*\bun portero\b/.test(lb[0].txt) && /^Vas a por /.test(lb[0].accion) && /puede ser uno de los que pujen contra ti/.test(lb[0].accion), txtB: lb[0] ? `${lb[0].txt} ${lb[0].accion}` : '',
        yoLleno: lineasDe(montar((D) => { sinPorteros(D); const m = meterPorteroLibre(D); for (const x of D.mercado) if (pos(D, x.pid) === 1) x.miPuja = null; m.miPuja = m.precio; const mol = Object.values(D.maestro).find((j) => j.pos === 2 && j.estado === 'ok'); for (let i = 0; D.plantillas[yo].length < 24; i++) { const id = `prueba-mio-${i}`; D.maestro[id] = { ...mol, id, nombre: `Mío ${i}` }; D.plantillas[yo].push({ pid: id, clausula: Math.max(1e6, mol.valor) }); } })).filter((l) => l.tipo === 'falta' && !l.vendo).length === 0,
        con25: window.__n25 < 24 ? null : hechos(C).lleno && lc.length === 1 && /tiene la plantilla llena/.test(lc[0].accion) && !/pujen contra ti/.test(lc[0].accion), txtC: lc[0] ? lc[0].accion : '',
      };
    }

    /* ---- en rojo: solo si es seguro ---- */
    {
      const ult = base.M.jornadas.filter((j) => j.fin <= ahora).pop();
      const premio = (D, t = tid) => { const e = D.clasif.find((x) => x.teamId === t); D.actividad.unshift({ id: `prueba-premio-${t}`, t: (ult ? ult.fin : ahora - 3 * DIA) + HORA, clase: 'premio', tipo: 6, quienId: e.userId || e.managerId || null, quien: e.manager, importe: 5e6 }); };
      const rec = base.M.recompensas(ahora, jo.ini);
      const A = montar((D) => { D.dineros = { [tid]: { v: -30e6 } }; premio(D); });
      // la última jornada acabó hace 3 horas y LaLiga aún no ha pagado el premio (lo paga a las 5-6 h); y días después, sin premio
      const recien = (D) => { for (const x of [...(D.partidos || []), ...(D.resultados || [])]) if (ult && x.jornada === ult.n) x.fecha = ahora - 5 * HORA; };
      const B = montar((D) => { D.dineros = { [tid]: { v: -30e6 } }; D.actividad = D.actividad.filter((a) => a.clase !== 'premio'); recien(D); });
      const viejo = (D) => { for (const x of [...(D.partidos || []), ...(D.resultados || [])]) if (ult && x.jornada === ult.n) x.fecha = ahora - 3 * DIA; };
      const B2 = montar((D) => { D.dineros = { [tid]: { v: -30e6 } }; D.actividad = D.actividad.filter((a) => a.clase !== 'premio'); viejo(D); });
      const C = montar((D) => { D.dineros = { [tid]: { v: -Math.max(1e4, rec / 2) } }; premio(D); });
      const E = montar((D) => { D.dineros = { [tid]: { v: 5e6 } }; premio(D); });
      // con el dinero estimado: negativo en el centro pero no con el margen
      const F = montar((D) => { premio(D); premio(D, tid2); });
      const capF = F.M.capacidad(tid2);
      out.rojo = { seguro: hechos(A).rojo === true, premioSinPagar: ult ? hechos(B).rojo === false && B.M.premioPagado(tid) === false : null, premioYaNo: ult ? hechos(B2).rojo === true && B2.M.premioPagado(tid) === null : null, conRecompensas: rec > 0 ? hechos(C).rojo === false : null, positivo: hechos(E).rojo === false,
        estimado: (() => { const r = F.M.rivales.find((x) => x.e.teamId === tid2); const h = (cap) => Pa.hechosRival(F.M, { ...r, cap }).rojo; return h({ v: -2e6, alto: 3e6, margen: 5e6 }) === false && h({ v: -1e6, alto: -1e6 - rec, margen: 0 }) === false && h({ v: -12e6, alto: -5e6, margen: 7e6 }) === true && h(null) === null; })(),
        enJuego: Pa.hechosRival(Object.assign(Object.create(A.M), { enJuego: { n: jo.n - 1, ini: ahora - DIA, fin: ahora + DIA } }), A.M.rivales.find((x) => x.e.teamId === tid)).rojo === false };
      // la línea: con uno suyo que te sirve y que puedes pagar
      const G = montar((D) => { D.dineros = { [tid]: { v: -30e6 } }; premio(D); D.dinero = 900e6; });
      const lg = lineasDe(G).filter((l) => l.tipo === 'rojo');
      // lo que tiene a la venta y te sirve, con la cifra de Mercado (`m.puja`, o la del paso del plan)
      const cifra = (m) => { const d = G.M.decisionFichar(m.pid); return (d && d.accion === 'fichar' && d.importe) || m.puja; };
      const vende = G.M.mercado.filter((m) => m.tipo === 'manager' && m.vendedorTeamId === tid && !m.noVende && !['injured', 'suspended', 'out_of_league'].includes(m.j.estado) && G.M.mejora(m.j) >= 0.5 && (G.M.decisionFichar(m.pid) || {}).accion !== 'no' && cifra(m) <= G.D.dinero - Math.max(0, G.M.misPujas || 0) && !G.M.clausulas.some((x) => x.pid === m.pid && x.abierta && x.clausula <= cifra(m)));
      const sirve = vende.length > 0;
      const soloSuyos = lg.every((l) => G.M.mercado.some((m) => m.tipo === 'manager' && m.pid === l.pid && m.vendedorTeamId === tid));
      const H2 = montar((D) => { D.dineros = { [tid]: { v: -30e6 } }; premio(D); D.dinero = 1e4; });
      out.lineaRojo = { sale: sirve ? lg.length === 1 && soloSuyos && lg[0].llave === 'dinero' && vende.some((m) => m.pid === lg[0].pid && cifra(m) === lg[0].importe) && /^Está en negativo/.test(lg[0].txt) && /no puntúa/.test(lg[0].txt) && /a la venta/.test(lg[0].accion) && /ofértale/.test(lg[0].accion) : lg.length === 0, sirve, sinSaldo: lineasDe(H2).filter((l) => l.tipo === 'rojo').length === 0, txt: lg[0] ? `${lg[0].txt} ${lg[0].accion}` : '' };
      // las llaves: con su dinero cerrado no se ve, y el candado sale igual con y sin línea detrás
      // el mismo caso con ese rival en positivo: con su dinero cerrado, todo tiene que salir IGUAL (también el orden)
      const G0 = montar((D) => { D.dineros = { [tid]: { v: 5e6 } }; premio(D); D.dinero = 900e6; });
      const PG = parteDe(G), PE = parteDe(G0);
      const vg = Pa.visibles(PG, { abierto: true, dineroAbierto: () => false }), ve = Pa.visibles(PE, { abierto: true, dineroAbierto: () => false });
      const va = Pa.visibles(PG, { abierto: true, dineroAbierto: (t) => t === tid });
      out.llaves = { cerradoNada: Pa.visibles(PG, { abierto: false, dineroAbierto: () => true }).length === 0, sinDinero: !JSON.stringify(vg).includes('"rojo"') && !/negativo|no puntúa/.test(JSON.stringify(vg)), ordenIgual: JSON.stringify(vg.map((x) => [x.tid, x.lineas.map((l) => l.txt + l.accion)])) === JSON.stringify(ve.map((x) => [x.tid, x.lineas.map((l) => l.txt + l.accion)])), primero: !sirve || va[0].tid === tid,
        abierto: !sirve || (va.find((x) => x.tid === tid) || { lineas: [] }).lineas.some((l) => l.tipo === 'rojo') };
      window.__G = G; window.__G0 = G0;
    }

    /* ---- los blindajes de un rival ---- */
    {
      const ult = base.M.jornadas.filter((j) => j.fin <= ahora).pop();
      const desde = ult ? ult.fin : 0;
      const blinda = (D, n) => { const e = D.clasif.find((x) => x.teamId === tid); const fs = D.plantillas[tid]; for (let i = 0; i < n; i++) D.actividad.unshift({ id: `prueba-b${i}`, t: Math.max(desde + HORA, ahora - (i + 1) * HORA), clase: 'blindaje', tipo: 4, pid: fs[i].pid, quienId: e.userId || e.managerId || null, quien: e.manager }); };
      const A = montar((D) => blinda(D, 2)), B = montar((D) => blinda(D, 1));
      const ha = hechos(A), hb = hechos(B), h0 = hechos(base);
      const la = lineasDe(A).filter((l) => l.tipo === 'blindajes');
      const hay = A.M.clausulas.some((x) => x.teamId === tid && x.abierta && (A.M.decisionFichar(x.pid) || {}).accion !== 'no' && Mo.esClausulable(A.M, x));
      // la línea, con algo suyo que clausularías: todas las cláusulas abiertas y saldo de sobra; los 2 blindajes, en otros dos suyos
      const abre = (D) => { D.dinero = 900e6; for (const l of Object.values(D.plantillas)) for (const f of l) f.protegidoHasta = null; };
      const C0 = montar(abre), obj = C0.M.clausulas.find((x) => x.abierta && (C0.M.decisionFichar(x.pid) || {}).accion !== 'no' && Mo.esClausulable(C0.M, x));
      let lineaSi = null;
      if (obj) {
        const C = montar((D) => { abre(D); const e = D.clasif.find((x) => x.teamId === obj.teamId); const otros = D.plantillas[obj.teamId].filter((f) => f.pid !== obj.pid).slice(0, 2); otros.forEach((f, i) => D.actividad.unshift({ id: `prueba-c${i}`, t: Math.max(desde + HORA, ahora - (i + 1) * HORA), clase: 'blindaje', tipo: 4, pid: f.pid, quienId: e.userId || e.managerId || null, quien: e.manager })); });
        const lc = lineasDe(C, obj.teamId).filter((l) => l.tipo === 'blindajes');
        lineaSi = lc.length === 1 && lc[0].llave === 'parte' && lc[0].pids.includes(obj.pid) && /no puede blindarlo/.test(lc[0].accion);
        out.txtBlind = lc[0] ? `${lc[0].txt} ${lc[0].accion}` : '';
      }
      out.lineaBlind = lineaSi;
      // uno puesto en las 6 h siguientes al final de la jornada no se cuenta (no se sabe de qué jornada gasta)
      const Z6 = montar((D) => { const e = D.clasif.find((x) => x.teamId === tid); D.plantillas[tid].slice(0, 2).forEach((f, i) => D.actividad.unshift({ id: `prueba-z${i}`, t: desde + (i + 1) * HORA, clase: 'blindaje', tipo: 4, pid: f.pid, quienId: e.userId || e.managerId || null, quien: e.manager })); });
      out.blindaHueco = desde && ahora - desde > 8 * HORA ? hechos(Z6).escudos.quedan === 2 : null;
      out.blindajes = { cero: ha.escudos.quedan === 0 && ha.escudos.completo, uno: hb.escudos.quedan === 1, dos: h0.escudos.quedan === 2, linea: la.length === (hay ? 1 : 0), conUno: lineasDe(B).filter((l) => l.tipo === 'blindajes').length === 0, hay };
    }

    /* ---- «le sobra»: apagada; el plan manda ---- */
    {
      const A = montar((D) => { const libres = Object.values(D.maestro).filter((j) => j.pos === 1 && j.estado === 'ok' && !Object.values(D.plantillas).some((l) => l.some((f) => f.pid === j.id))); while (D.plantillas[tid].filter((f) => pos(D, f.pid) === 1).length < 3) { const j = libres.pop(); D.plantillas[tid].push({ pid: j.id, clausula: Math.max(1e6, j.valor) }); } D.dinero = 900e6; });
      const todas = parteDe(A).rivales.flatMap((x) => x.lineas), conSobra = parteDe(A, { lineas: { sobra: true } }).rivales.flatMap((x) => x.lineas);
      const pids = (l) => l.flatMap((x) => [x.pid, ...(x.pids || [])].filter(Boolean));
      out.sobra = { hecho: hechos(A).sobran[1].length === 1, apagada: !todas.some((l) => l.tipo === 'sobra'), planManda: [...pids(todas), ...pids(conSobra)].every((p) => (A.M.decisionFichar(p) || {}).accion !== 'no') };
    }

    /* ---- la llave del parte: 2 anuncios, hasta que empieza la jornada ---- */
    {
      U.LS.del('top-parte');
      Li.fijarJornada(jo.n, jo.ini);
      const antes = Li.bloqueada('parteRivales'), f0 = Li.faltanAnuncios('parteRivales');
      const a1 = Li.anuncioTopVisto('parteRivales'), medio = Li.bloqueada('parteRivales'), f1 = Li.faltanAnuncios('parteRivales');
      const a2 = Li.anuncioTopVisto('parteRivales'), despues = Li.bloqueada('parteRivales');
      out.llave = { antes, f0, a1, medio, f1, a2, despues, hasta: Li.abiertaHasta('parteRivales') === jo.ini, cierre: Li.proximoCierreTop() > 0 && Li.proximoCierreTop() <= jo.ini, dineroSigue: Li.bloqueada('dineroRivales', tid), pagaSigue: Li.bloqueada('quienPaga') };
      const raro = (v) => { U.LS.set('top-parte', v); return Li.bloqueada('parteRivales') && Li.faltanAnuncios('parteRivales') >= 1 && Li.faltanAnuncios('parteRivales') <= 2 && Li.abiertaHasta('parteRivales') === 0; };
      out.llave.raros = raro({ hasta: 'Infinity', n: -5, t: Date.now() }) && raro({ hasta: 1e300, n: 99, t: Date.now() }) && raro({ hasta: Date.now() + 40 * DIA }) && raro('x') && raro([1]);
      U.LS.set('top-parte', { hasta: 0, n: 1, t: Date.now() }); Li.abrirTopGratis('parteRivales');
      out.llave.gratis = !Li.bloqueada('parteRivales') && Li.abiertaHasta('parteRivales') - Date.now() <= 31 * 60e3;
      U.LS.del('top-parte');
      out.llave.cerradaOtraVez = Li.bloqueada('parteRivales');
    }

    /* ---- la pantalla: Rivales → Parte ---- */
    {
      const G = window.__G, G0 = window.__G0, antesD = S.D, antesM = S.M, seg0 = S.seg.rivales;
      const pinta = (A) => { S.D = A.D; S.M = A.M; S.seg.rivales = 'parte'; return conReloj(T, () => Vi.rivales(S)); };
      const trozo = (h) => h.slice(h.indexOf('data-seg="rivales:parte"'));
      const boton = (h) => { const t = trozo(h); return t.slice(0, t.indexOf('</button>')); };
      U.LS.del('top-parte'); U.LS.del('top-rivales');
      S.D = G.D; S.M = G.M; S.seg.rivales = 'parte';
      const fuera = Vi.rivales(S); // a la hora de verdad de la escena (martes por la mañana): aún no toca
      const cerrada = pinta(G);
      U.LS.set('top-parte', { hasta: T + DIA, n: 0, t: T });
      const abierta = pinta(G), abierta0 = pinta(G0);
      U.LS.set('top-rivales', { j: null, usos: 1, abiertos: { [tid]: T + 5 * 60e3 }, uno: null });
      const conDinero = pinta(G);
      U.LS.del('top-rivales'); U.LS.del('top-parte');
      S.D = antesD; S.M = antesM; S.seg.rivales = seg0;
      const dentro = /Le faltan? (un|\d)|Está en negativo|no puntúa|[Oo]fértale|blindajes de esta jornada|Vas a por|plantilla llena/;
      out.pantalla = { pestaña: /data-seg="rivales:parte"/.test(cerrada), fuera: /El parte de la jornada \d+ sale/.test(fuera) && !/data-clave="parteRivales"/.test(fuera) && !dentro.test(trozo(fuera)),
        cerrada: /data-clave="parteRivales"/.test(cerrada) && !dentro.test(trozo(cerrada)), sinNumero: !/tab-n/.test(boton(cerrada)) && !/tab-n/.test(boton(fuera)),
        abiertaSinRojo: !/data-clave="parteRivales"/.test(abierta) && !/Está en negativo|no puntúa/.test(abierta) && /parte-pie/.test(abierta) && /data-clave="dineroRivales"/.test(abierta),
        igualCerrado: trozo(abierta) === trozo(abierta0),
        conDinero: !out.lineaRojo.sirve || (/Está en negativo/.test(conDinero) && /ofértale/.test(conDinero)), pieSiempre: /parte-pie/.test(conDinero) };
    }
    return out;
  });
  ok(r.hayJornada, 'hay una jornada por delante en la liga de ejemplo');
  ok(r.ventana.antes && r.ventana.dentro && r.ventana.empezada, 'el parte sale desde 4 días antes de la jornada y hasta que empieza');
  ok(r.ventana.enJuego, 'con una jornada en juego no sale');
  ok(r.ventana.sinJornada, 'sin jornada por delante no sale (ni falla)');
  ok(r.falta.sin, 'le falta un portero: no tiene ninguno');
  ok(r.falta.lesionado, 'le falta un portero: el único está lesionado');
  ok(r.falta.dudoso, 'le falta un portero si no llega su dudoso (y contándolo, no)');
  ok(r.falta.sano, 'con su portero sano no le falta');
  ok(r.sinPlantilla, 'de un rival sin plantilla no se dice nada');
  ok(r.falta.sinPartido && r.falta.misma, 'le falta un portero: el equipo del suyo no juega la jornada');
  ok(r.lineaFalta.sinTocarte !== false, `«le falta» no sale si no te toca${r.lineaFalta.sinTocarte === null ? ' (aquí el plan ya puja o vende un portero: sin probar)' : ''}`);
  ok(r.lineaFalta.conMiPuja, `«le falta» sale si pujas por un libre de ese puesto: ${r.lineaFalta.txtB}`);
  ok(r.lineaFalta.con25 === true, `con la plantilla llena (24) dice que no puede pujar: ${r.lineaFalta.txtC}`);
  ok(r.lineaFalta.yoLleno, 'contigo con la plantilla llena no sale lo de tu puja');
  ok(r.rojo.seguro, 'en rojo seguro: negativo con el saldo exacto');
  ok(r.rojo.premioSinPagar !== false, 'recién acabada la jornada, con el premio aún por pagar, no se da a nadie por en rojo');
  ok(r.rojo.premioYaNo !== false, 'pasadas 12 horas sin premio, ya no se espera: en rojo');
  ok(r.rojo.conRecompensas !== false, 'si con las recompensas diarias que le quedan sale del rojo, no es seguro');
  ok(r.rojo.positivo, 'en positivo no está en rojo');
  ok(r.rojo.estimado, 'con el dinero estimado, solo si es negativo también con el margen y la holgura; sin su dinero, no se sabe');
  ok(r.rojo.enJuego, 'con una jornada en juego nadie está «en negativo»: cobrará sus puntos al acabarla');
  ok(r.lineaRojo.sale, `«en negativo» sale solo con algo que tiene a la venta, te sirve y puedes pagar, con la cifra de Mercado (${r.lineaRojo.sirve ? 'lo hay' : 'no lo hay: no sale'}): ${r.lineaRojo.txt}`);
  ok(r.lineaRojo.sinSaldo, '«en rojo» no sale si no puedes pagar la oferta con tu saldo');
  ok(r.llaves.cerradoNada, 'con el parte cerrado no se enseña nada');
  ok(r.llaves.sinDinero, 'con el dinero de ese rival cerrado no sale que está en negativo');
  ok(r.llaves.ordenIgual, 'con su dinero cerrado, el parte sale igual (mismas líneas y mismo orden) esté o no en negativo');
  ok(r.llaves.primero, 'con su dinero abierto, el que está en negativo sale el primero');
  ok(r.llaves.abierto, 'con el dinero de ese rival abierto, sale');
  ok(r.blindajes.cero && r.blindajes.uno && r.blindajes.dos, 'los blindajes de un rival se cuentan con sus movimientos de esta jornada (0, 1 y 2 gastados)');
  ok(r.blindajes.linea, `«sin blindajes» sale solo si hay algo suyo que clausularías hoy (${r.blindajes.hay ? 'lo hay' : 'no lo hay'})`);
  ok(r.blindajes.conUno, 'con un blindaje por gastar no se dice nada');
  ok(r.blindaHueco !== false, 'un blindaje de las 6 h siguientes al final de la jornada no se cuenta');
  ok(r.lineaBlind !== false, `«sin blindajes», con uno suyo que clausularías${r.lineaBlind === null ? ' (en la liga de ejemplo no hay ninguno: sin probar)' : `: ${r.txtBlind}`}`);
  ok(r.sobra.hecho, 'con tres porteros, uno sobra (el hecho se calcula)');
  ok(r.sobra.apagada, '«le sobra» está apagada: no sale');
  ok(r.sobra.planManda, 'ninguna línea manda fichar lo que el plan descarta');
  ok(r.llave.antes && r.llave.f0 === 2, 'el parte está cerrado y pide 2 anuncios');
  ok(r.llave.a1 === false && r.llave.medio && r.llave.f1 === 1, 'con el primer anuncio sigue cerrado y falta 1');
  ok(r.llave.a2 === true && !r.llave.despues, 'con el segundo se abre');
  ok(r.llave.hasta && r.llave.cierre, 'abierto hasta que empieza la jornada');
  ok(r.llave.dineroSigue && r.llave.pagaSigue, 'abrir el parte no abre el dinero de los rivales ni quién paga');
  ok(r.llave.raros, 'con valores raros en lo guardado sigue cerrado y pide 1 o 2 anuncios');
  ok(r.llave.gratis, 'si no hay anuncio se abre media hora');
  ok(r.llave.cerradaOtraVez, 'sin lo guardado, cerrado otra vez');
  ok(r.pantalla.pestaña, 'Rivales tiene la pestaña Parte');
  ok(r.pantalla.fuera, 'antes de los 4 días dice cuándo sale, sin candado y sin nada de dentro');
  ok(r.pantalla.cerrada, 'cerrado: el candado y ni una palabra de lo de dentro');
  ok(r.pantalla.sinNumero, 'cerrado, la pestaña no lleva número');
  ok(r.pantalla.igualCerrado, 'con su dinero cerrado, la pantalla es idéntica esté o no en negativo');
  ok(r.pantalla.abiertaSinRojo, 'abierto con el dinero cerrado: sin «negativo» y con el candado del dinero al pie');
  ok(r.pantalla.conDinero, 'con el dinero de ese rival abierto: «Está en negativo» y la oferta por lo que vende');
  ok(r.pantalla.pieSiempre, 'el candado del pie sigue mientras algún rival tenga el dinero cerrado');
} finally { await cerrar(); }
console.log(mal ? `\n${mal} MAL` : '\nTodo BIEN');
process.exit(mal ? 1 : 0);
