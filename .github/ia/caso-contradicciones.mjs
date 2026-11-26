// La app no se contradice (24 nov, aviso de Senna: «me recomienda vender un jugador y luego que lo aguante, o viceversa»).
// LA REGLA DE ORO: en un momento dado, para cada jugador y cada tipo de decisión, la app tiene UNA decisión (decide.js) y
// todo lo que se ve dice esa misma decisión. Aquí se comprueba con las funciones de cada sitio, no con capturas:
//   A. a prueba de azar: la liga de ejemplo removida cientos de veces (saldo, valores que suben, giran y bajan, jugadores
//      en venta con ofertas de −6 % a +14 %, lesiones) en cada momento de la semana. Para cada jugador tuyo, lo que dice
//      cada sitio (el plan de la app, lo urgente de Hoy, Equipo, en venta, los avisos con la app cerrada, lo que lee la IA
//      en sus tres bloques y lo que hace la app si la IA manda venderlo) tiene que ser lo que dice su decisión. Y para cada
//      candidato a fichar, que nadie lo recomiende si el plan lo ha mirado y descartado.
//   B. el tiempo: un plan de la IA de las 06:25 que mandaba vender, repasado a las 13:48 con una oferta floja ya hecha (la
//      escena de Senna): el paso lo dice, el titular no dice «mejor aguantar», el chat recibe el plan como se ve en Hoy y
//      sabe qué ha cambiado, y «Lo que llevas hoy» dice de dónde salió.
//   C. las escenas de siempre (Senna, Rodri en lo urgente, el titular que gira, la oferta por uno que sube).
//   D. la conversación: una respuesta anterior que dijo «véndelo» y ahora la decisión es otra.
// Uso: PW_MODULO=… node .github/ia/caso-contradicciones.mjs [vueltas por escena, 12] [semilla, 1] [escenas]
// Sale con 1 si algo falla, y dice la escena y la vuelta para repetirlo.
import { pagina, cerrar } from './banco.mjs';

const N = Number(process.argv[2]) || 12, SEM = Number(process.argv[3]) || 1;
const ESC = (process.argv[4] || 'martes,m-limpio,veda,sabado,enjuego,paron,m-negativo,holgado,jueves-negativo,mercado-real,m-reventa,m-cierre,m-baja-sin-relevo,m-baja-con-relevo,m-reventa-aguanta,m-premium,sabado-premium').split(',');
let mal = 0;
const ok = (c, t) => { if (!c) mal++; console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); };

/* ---------- lo que corre en la página ---------- */
// (texto: se evalúa en la página; deja en window.__cc las piezas comunes a todas las partes)
const COMUN = `
  const Mo = await import('./js/motor.js'), Pm = await import('./js/plan.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js'),
    Vi = await import('./js/vistas.js'), De = await import('./js/decide.js'), Fo = await import('./js/fondo.js'), Av = await import('./js/avisos.js'), Co = await import('./js/comunes.js');
  const S = window.S, c = Dt.cfg();
  const norm = (t) => String(t || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  // un paso de la IA que vende a uno tuyo (acepta la oferta si la tiene), repasado por la app
  const iaVende = (D, M, x, t = Date.now()) => {
    const v = M.misVentas.find((y) => y.pid === x.pid);
    const paso = v && v.mejor ? { accion: 'aceptar_oferta', ref: 'A-' + x.pid, jugador: x.j.nombre, importe: v.mejor.importe, motivo: 'x', dia: 'hoy', cuando: 'ahora' } : { accion: 'vender', ref: 'V-' + x.pid, jugador: x.j.nombre, motivo: 'x', dia: 'hoy', cuando: 'ahora' };
    const C = I.cuadrarPlan({ operaciones: [paso], titular: 'Hoy toca vender a ' + x.j.nombre, situacion: '', modelo: 'x', t }, D, M);
    return { o: (C.ops || [])[0] || null, titular: C.titular || '', acepta: !!(v && v.mejor) };
  };
  // lo que dice cada sitio de un jugador tuyo, pasado a 'V' (vender), 'A' (aguantar) o null (no dice nada)
  const sitios = (D, M, x, R, Sx, datos, avisosF) => {
    const pid = x.pid, nom = x.j.nombre, d = M.decision(pid), v = M.misVentas.find((y) => y.pid === pid);
    const s = {};
    const opV = (R.ops || []).find((o) => !o.descartada && !o.sugerencia && String(o.pid) === String(pid) && o.accion === 'vender');
    const mir = [...(R.descartes || []), ...(R.avisos || [])].find((z) => String(z.pid) === String(pid));
    s.plan = opV ? 'V' : mir && !(R.ops || []).some((o) => String(o.pid) === String(pid) && !o.descartada) ? 'A' : null;
    const u = Vi.urgentesDe(Sx).urg.find((a) => String(a.pid) === String(pid) && ['vender', 'sustituto'].includes(a.tipo));
    s.hoy = u ? (u.tipo === 'vender' ? 'V' : 'A') : null;
    const vv = De.ventaVista(M, x);
    s.equipo = vv ? (/[Vv]ender|[Vv]éndelo|Acepta|En venta|A la venta|[Rr]evender|a la venta/.test(vv.pill + ' ' + vv.largo) && !/titular: se aguanta|no la aceptes|búscale sustituto/.test(vv.largo) ? 'V' : 'A') : null;
    s.enVenta = v && v.mejor ? (v.consejo === 'aceptar' ? 'V' : 'no-aceptar') : null;
    const fa = avisosF.filter((a) => (a.k || '').split(':')[1] === String(pid));
    s.fondo = fa.some((a) => /^(vende|lesion-venta|revender)$/.test(a.k.split(':')[0]) || /^Acepta la oferta/.test(a.titulo)) ? 'V' : null;
    // la IA: el bloque de ventas, la línea de MI EQUIPO y la de MIS JUGADORES EN VENTA
    let ch = ''; try { ch = I.ventasMiasTxt(D, M, [x.j], c) || ''; } catch (e) { ch = 'ERROR ' + e.message; }
    const mv = /LA DECISIÓN DE LA APP: ([^:]+)/.exec(ch), VV = mv ? mv[1] : (/ERROR/.test(ch) ? 'ERROR' : '');
    s.chat = !VV ? null : /^(VENDER|ERROR)/.test(VV) ? (VV === 'ERROR' ? 'ERROR' : 'V') : 'A';
    s.chatTxt = VV;
    const lin = datos.split('\\n').filter((l) => l.startsWith('- ') && (l.includes(' | ' + nom + ' |') || l.startsWith('- ' + nom + ' ')));
    const eqL = lin.find((l) => /EN MI ONCE|TITULAR|suplente/.test(l)) || '';
    s.chatEquipo = /VENDER POR INERCIA|LA APP: (VENDER|A LA VENTA)/.test(eqL) ? 'V' : /PERO EL PLAN DE HOY NO LO VENDE/.test(eqL) ? 'A' : null;
    const veL = lin.find((l) => /puesto a /.test(l)) || '';
    s.chatVenta = /→ la app aconseja ACEPTAR/.test(veL) ? 'V' : /→ la app aconseja ESPERAR/.test(veL) ? 'no-aceptar' : null;
    const ia = iaVende(D, M, x);
    s.ia = !ia.o || ia.o.ya ? null : ia.o.descartada ? (ia.o.cambia ? 'no-aceptar' : 'A') : ia.o.porDinero ? '$' : ia.o.sugerencia ? null : 'V';
    return { d, s, ia, v };
  };
  // ¿qué tendría que decir cada sitio, según la decisión?
  const choca = (d, k, val, v) => {
    if (val == null) return false;
    if (val === 'ERROR') return true;
    const vende = d.accion === 'vender';
    if (val === '$') return false;                                   // se queda solo porque hace falta el dinero: lo dice
    if (k === 'enVenta' || k === 'chatVenta') return (val === 'V') !== (d.oferta === 'aceptar');
    if (val === 'no-aceptar') return d.oferta === 'aceptar';
    // (si el plan de la app hoy no lo vende pero su regla sí, la IA puede meterlo: con ese paso a la vista, la decisión es vender)
    if (k === 'ia') return val === 'V' ? !vende && !(d.regla === 'plan' && d.antes && d.antes.accion === 'vender') : (vende && d.paso !== 'nada' && d.paso !== 'fichar' && d.paso !== 'esperar');
    return (val === 'V') !== vende;
  };
  window.__cc = { Mo, Pm, I, Dt, U, Vi, De, Fo, Av, Co, S, c, norm, iaVende, sitios, choca };
`;

/* ---------- A. a prueba de azar ---------- */
const tot = { ligas: 0, mios: 0, fichar: 0, porRegla: {}, porSitio: {}, fallos: [] };
for (const escena of ESC) {
  const P = await pagina(escena);
  const r = await P.page.evaluate(async ({ N, SEM, escena, COMUN }) => {
    // eslint-disable-next-line no-eval
    await (0, eval)(`(async () => { ${COMUN} })()`);
    const { Mo, Pm, I, U, Vi, Fo, Av, S, c, sitios, choca } = window.__cc;
    const D0 = JSON.stringify(S.D), H0 = JSON.stringify(S.H);
    let s = (SEM * 7919 + escena.length * 104729 + escena.charCodeAt(0) * 31) >>> 0;
    const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pick = (l) => l[Math.floor(rnd() * l.length)];
    const out = { ligas: 0, mios: 0, fichar: 0, porRegla: {}, porSitio: {}, fallos: [] };
    const falla = (t) => { if (out.fallos.length < 12) out.fallos.push(t); else out.mas = (out.mas || 0) + 1; };
    for (let n = 0; n < N; n++) {
      S.D = JSON.parse(D0); S.H = JSON.parse(H0); S.det = {};
      const D = S.D, yo = D.yo.teamId, mis = D.plantillas[yo];
      if (n > 0) {
        if (!/negativo/.test(escena)) D.dinero = Math.round((rnd() < 0.2 ? -rnd() * 6e6 : rnd() * (rnd() < 0.3 ? 60e6 : 12e6)) / 1e4) * 1e4;
        // los valores: varios de los tuyos suben, giran o bajan (a veces todos los días)
        for (const f of mis) if (rnd() < 0.45) {
          const j = D.maestro[f.pid]; if (!j || j.pos === 5) continue;
          const sube = Math.floor(rnd() * 12), baja = Math.floor(rnd() * 8), rs = 1 + rnd() * 0.03, rb = 1 + rnd() * 0.025, ser = [];
          const alReves = rnd() < 0.3;
          for (let k = sube + baja; k >= 1; k--) {
            const v = alReves ? j.valor / Math.pow(rs, k) : k <= baja ? j.valor * Math.pow(rb, k) : j.valor * Math.pow(rb, baja) / Math.pow(rs, k - baja);
            ser.push([new Date(Date.now() - k * 864e5 + 3600e3).toISOString().slice(0, 10), Math.round(v)]);
          }
          S.H.v = S.H.v || {}; S.H.v[j.id] = ser;
        }
        // en venta: de 0 a 4, con la oferta de LaLiga entre −6 % y +14 %, sin oferta o con la de un rival
        D.mercado = D.mercado.filter((m) => !(m.tipo === 'manager' && String(m.vendedorTeamId) === String(yo)));
        D.misVentas = [];
        const fin = Date.now() + 20 * 3600e3;
        for (const f of [...mis].sort(() => rnd() - 0.5).slice(0, Math.floor(rnd() * 5))) {
          const j = D.maestro[f.pid]; if (!j || j.pos === 5) continue;
          const of = [];
          if (rnd() < 0.8) of.push({ id: 'o' + j.id, importe: Math.round(j.valor * (0.94 + rnd() * 0.2) / 1000) * 1000, estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true });
          if (rnd() < 0.2) { const rv = pick(D.clasif.filter((x) => x.teamId !== yo)); of.push({ id: 'r' + j.id, importe: Math.round(j.valor * (0.98 + rnd() * 0.2) / 1000) * 1000, estado: 'pending', caduca: fin, de: rv.manager, deLiga: false, deTeamId: rv.teamId }); }
          of.sort((a, b) => b.importe - a.importe);
          D.misVentas.push({ marketId: 'v' + j.id, pid: j.id, ptId: 'pt' + j.id, precio: Math.round(j.valor * 1.1), cierra: fin, ofertas: of });
          D.mercado.push({ id: 'v' + j.id, pid: j.id, tipo: 'manager', precio: Math.round(j.valor * 1.1), cierra: fin, pujas: 0, ofertas: of.length, vendedorTeamId: yo, vendedor: D.yo.manager, miPuja: null, clausula: null });
        }
        if (rnd() < 0.25) { const f = pick(mis); if (D.maestro[f.pid]) D.maestro[f.pid].estado = pick(['injured', 'suspended', 'doubtful']); }
        // cláusulas tuyas casi a su valor y abiertas (proteger)
        for (const f of mis) if (rnd() < 0.12 && D.maestro[f.pid]) { f.clausula = Math.round(D.maestro[f.pid].valor * (1.02 + rnd() * 0.1)); f.protegidoHasta = Date.now() - 3600e3; }
        // lo que ha dicho él: «a X no lo vendo»
        if (rnd() < 0.12) window.__nv = pick(mis).pid; else window.__nv = null;
      } else window.__nv = null;
      const extra = window.__nv ? { notas: [{ id: 'nv', corr: 'no-vender', pid: window.__nv, texto: 'no lo vendo', t: Date.now() - 3600e3, caduca: Date.now() + 5 * 864e5 }] } : {};
      let M;
      try { M = S.M = Mo.analizar(D, S.H, S.c, extra); } catch (e) { falla(`${escena}#${n}: el motor falla: ${e.message}`); continue; }
      out.ligas++;
      let R; try { R = Pm.planDeHoy(D, M, c); } catch (e) { falla(`${escena}#${n}: el plan falla: ${e.message}`); continue; }
      M.verPlan(R);
      const Sx = { D, M, plan: R, opPorPid: {} };
      for (const o of R.ops) if (o.pid && !o.descartada && !Sx.opPorPid[o.pid]) Sx.opPorPid[o.pid] = o;
      let datos = ''; try { datos = I.datosChat('¿Qué hago con mis jugadores?', D, M, c, {}); } catch (e) { falla(`${escena}#${n}: los datos del chat fallan: ${e.message}`); }
      let avisosF = []; try { avisosF = Fo.avisosNuevos(null, D, M); } catch (e) { falla(`${escena}#${n}: los avisos fallan: ${e.message}`); }
      for (const x of M.mias) {
        if (!x.j || x.j.pos === 5) continue;
        out.mios++;
        let q; try { q = sitios(D, M, x, R, Sx, datos, avisosF); } catch (e) { falla(`${escena}#${n} ${x.j.nombre}: ${e.message}`); continue; }
        const { d, s: sit, ia, v } = q;
        if (!d) { falla(`${escena}#${n} ${x.j.nombre}: sin decisión`); continue; }
        const clave = `${d.accion}/${d.regla}${d.matiz ? '/' + d.matiz : ''}`;
        out.porRegla[clave] = (out.porRegla[clave] || 0) + 1;
        const de = `${escena}#${n} ${x.j.nombre} (${U.eur(x.j.valor)}, ${M.perdida(x.pid) >= 0.3 ? 'titular' : 'suplente'}, saldo ${U.eur(D.dinero)}${v && v.mejor ? `, oferta ${Math.round(v.mejor.sobre * 1000) / 10} %` : v ? ', en venta sin ofertas' : ''}) → decisión «${d.corta}» (${clave})`;
        for (const k of ['plan', 'hoy', 'equipo', 'enVenta', 'fondo', 'chat', 'chatEquipo', 'chatVenta', 'ia']) {
          if (sit[k] != null) out.porSitio[k] = (out.porSitio[k] || 0) + 1;
          if (choca(d, k, sit[k], v)) falla(`${de}; ${k} dice ${sit[k]}${k === 'chat' ? ` («${sit.chatTxt}»)` : k === 'ia' ? ` (aviso: «${String((ia.o || {}).aviso || '').slice(0, 110)}»; titular: «${ia.titular}»)` : ''}`);
        }
        // «a la venta, pero esta oferta no»: el paso lo dice y el titular no dice «mejor aguantar»
        if (d.matiz === 'esta-oferta-no' && ia.o && ia.o.descartada) {
          if (/mejor aguantar a/.test(ia.titular) || !/esta oferta no/.test(ia.titular)) falla(`${de}; el titular del plan repasado dice «${ia.titular}»`);
        }
        // (Carlos, 17 nov: «la de un 12 % por encima… sí») una oferta de un 10 % o más que la regla acepta, el plan también la
        // coge: solo puede frenarla el cierre de cláusulas (no se toca a un titular sin tiempo de reponerlo) o que él lo haya dicho
        if (d.regla === 'plan' && d.antes && d.antes.oferta === 'aceptar' && v && v.mejor && v.mejor.sobre >= 0.1 && !/cláusulas cerradas|jornada ya empezada/.test(d.porque)) falla(`${de}; una oferta de un ${Math.round(v.mejor.sobre * 100)} % que la regla acepta y el plan no: «${d.porque}»`);
        // cifras: la oferta que dicen el chat y la decisión es la que tiene
        if (v && v.mejor && d.cifras && d.cifras.oferta != null && d.cifras.oferta !== v.mejor.importe) falla(`${de}; la decisión lleva otra oferta (${d.cifras.oferta} y tiene ${v.mejor.importe})`);
        if (window.__nv && String(window.__nv) === String(x.pid) && (d.accion !== 'aguantar' || d.regla !== 'dicho')) falla(`${de}; dijo que no lo vende`);
      }
      // (repaso independiente, 24 nov) PROTEGER: al que no se blinda (baja, o su cláusula paga más que venderlo) o se vende, ni
      // el plan («usa el blindaje en X») ni las alarmas («blíndalo gratis») le mandan blindar; y sin blindajes, tampoco a nadie
      const planTxt = JSON.stringify([R.diasAuto || [], R.proximos_dias || [], (R.ops || []).filter((o) => !o.descartada).map((o) => [o.accion, o.jugador, o.motivo])]);
      let alarmas = []; try { alarmas = Av.calcular(D, M, { ...Av.cfgAvisos(), on: true, mias: true, miasTodas: true, mercado: true }, R); } catch (e) { falla(`${escena}#${n}: las alarmas fallan: ${e.message}`); }
      const sinEscudos = M.escudosMios && !M.escudosMios.quedan;
      for (const x of M.mias) {
        if (!x.j) continue;
        const d = M.decision(x.pid), nom = x.j.nombre, noProt = x.noBlindar || (d && d.accion === 'vender');
        const blinda = (R.ops || []).some((o) => !o.descartada && o.accion === 'blindar' && String(o.pid) === String(x.pid));
        if (noProt && !blinda && new RegExp(`[úu]salo en [^.("]*${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(planTxt)) falla(`${escena}#${n} ${nom}: el plan manda gastar el blindaje en él y ${x.noBlindar ? 'la app no lo blindaría' : `su decisión es venderlo (${d.regla}${d.matiz ? '/' + d.matiz : ''}, ${d.paso})`}`);
        for (const a of alarmas) {
          const t = `${a.titulo} ${a.texto}`;
          if (!t.includes(nom) || !/bl[ií]nda(lo|los)? gratis|Blinda gratis/.test(t)) continue;
          const solo = (t.match(/Blinda gratis a ([^.]*)\./) || [])[1];
          if (solo ? solo.includes(nom) && (noProt || sinEscudos) : (noProt || sinEscudos || !['alto', 'medio'].includes(x.riesgo))) falla(`${escena}#${n} ${nom}: la alarma «${a.titulo}» manda blindarlo (${sinEscudos ? 'sin blindajes' : noProt ? 'la app no lo protegería' : `riesgo ${x.riesgo}`})`);
        }
        // EL ONCE: «no entra en tu once» solo de quien no va en él
        if (d && /no entra en tu once/.test(d.porque || '') && M.once && M.once.lineas && M.once.lineas.flat().some((y) => y && y.id === x.pid)) falla(`${escena}#${n} ${nom}: la decisión dice «no entra en tu once» y va en el once de la app`);
      }
      // HOY CONTRA HOY: con el plan de la app delante, lo urgente no manda clausular ni pujar por lo que el plan no lleva
      { const u2 = Vi.urgentesDe(Sx).urg.filter((a) => ['pujar', 'clausular'].includes(a.tipo)); if (u2.length) falla(`${escena}#${n}: lo urgente de Hoy manda ${u2.map((a) => a.titulo).join(' y ')} y el plan no lo lleva`); }
      // LO QUE LEE LA IA: una operación de fichar que el plan no hace (mirada y descartada, plantilla llena, puja que retira) no le llega como «vale»
      for (const m of datos.matchAll(/^- \[([PCMT])-([^\]]+)\][^\n]*→ LA APP: vale para/gm)) { const df = M.decisionFichar(m[2]); if (df && df.accion === 'no') falla(`${escena}#${n} ${(M.J(m[2]) || {}).nombre}: a la IA le llega «LA APP: vale para…» y el plan no lo ficha («${String(df.porque).slice(0, 80)}»)`); }
      // FICHAR: lo que el plan ha mirado y descartado no lo recomienda nadie
      const urg = Vi.urgentesDe(Sx).urg;
      let nuevosF = []; try { nuevosF = Fo.interesEnMercado({ mercado: [] }, D, M, { on: true, interes: 55, jugadores: {} }); } catch (e) { nuevosF = []; }
      const pids = new Set([...M.mercado.filter((m) => m.j && String(m.vendedorTeamId || '') !== String(yo)).map((m) => String(m.pid)), ...M.clausulas.filter((y) => y.abierta || y.abreEn < 2 * 864e5).map((y) => String(y.pid))]);
      for (const pid of pids) {
        out.fichar++;
        const df = M.decisionFichar(pid), j = M.J(pid);
        const no = df && df.accion === 'no';
        const enHoy = urg.some((a) => String(a.pid) === pid && ['pujar', 'clausular'].includes(a.tipo));
        const enMercado = !!Vi.etiquetaFichar && /chollo/i.test(Vi.etiquetaFichar(Sx, pid) || '');
        const enFondo = nuevosF.some((y) => (y.k || '').includes(`:${pid}:`) && /Sale barato|pujaría/.test(y.texto));
        if (no && (enHoy || enMercado || enFondo)) falla(`${escena}#${n} fichar a ${j.nombre}: el plan lo descarta («${String(df.porque).slice(0, 90)}») y ${enHoy ? 'Hoy' : enMercado ? 'Mercado' : 'un aviso'} lo recomienda`);
      }
    }
    return out;
  }, { N, SEM, escena, COMUN });
  tot.ligas += r.ligas; tot.mios += r.mios; tot.fichar += r.fichar;
  for (const [k, v] of Object.entries(r.porRegla)) tot.porRegla[k] = (tot.porRegla[k] || 0) + v;
  for (const [k, v] of Object.entries(r.porSitio)) tot.porSitio[k] = (tot.porSitio[k] || 0) + v;
  ok(!r.fallos.length, `A. ${escena}: ${r.ligas} ligas, ${r.mios} jugadores míos y ${r.fichar} candidatos a fichar${r.fallos.length ? `\n     ${r.fallos.join('\n     ')}${r.mas ? `\n     … y ${r.mas} más` : ''}` : ''}`);
  if (P.errores.length) ok(false, `A. ${escena}: errores en la página: ${P.errores.slice(0, 3).join(' | ')}`);
  await P.cerrar();
}
console.log(`     por decisión: ${Object.entries(tot.porRegla).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`     veces que habla cada sitio: ${Object.entries(tot.porSitio).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
// que el azar cubre los tipos de decisión que importan
for (const k of ['vender/inercia', 'aguantar/titular-gira/titular', 'aguantar/sube/sube', 'aguantar/dicho/dicho', 'vender/baja']) ok(Object.keys(tot.porRegla).some((x) => x.startsWith(k)), `A. el azar pasa por «${k}»`);
ok(Object.keys(tot.porRegla).some((x) => /esta-oferta-no/.test(x)) && Object.keys(tot.porRegla).some((x) => /\/acepta$/.test(x)) && Object.keys(tot.porRegla).some((x) => /oferta-no$/.test(x)), 'A. el azar pasa por «acepta la oferta», «a la venta, pero esta oferta no» y «aguantar: esta oferta no»');

/* ---------- B, C y D: la escena de Senna y el tiempo ---------- */
{
  const P = await pagina('m-limpio');
  const r = await P.page.evaluate(async ({ COMUN }) => {
    // eslint-disable-next-line no-eval
    await (0, eval)(`(async () => { ${COMUN} })()`);
    const { Mo, Pm, I, U, Vi, De, S, c, iaVende } = window.__cc;
    const D = S.D, yo = D.yo.teamId;
    // SENNA: un suplente barato (Hugo Duro) que baja un 1,7 % al día tras subir, en venta con la oferta de LaLiga un 2 % por
    // debajo de su valor, saldo en positivo y sin pujas; el plan de la IA de la mañana, «vender a Hugo Duro»
    const j = Object.values(D.maestro).find((x) => x.nombre === 'Hugo Duro');
    const ser = [];
    for (let k = 14; k >= 1; k--) ser.push([new Date(Date.now() - k * 864e5 + 3600e3).toISOString().slice(0, 10), Math.round(k <= 4 ? j.valor * Math.pow(1.017, k) : j.valor * Math.pow(1.017, 4) / Math.pow(1.012, k - 4))]);
    S.H.v = S.H.v || {}; S.H.v[j.id] = ser; S.det = {};
    D.dinero = 7260000;
    const fin = Date.now() + 10 * 3600e3, oferta = Math.round(j.valor * 0.98 / 1000) * 1000;
    D.mercado = D.mercado.filter((m) => !(m.tipo === 'manager' && String(m.vendedorTeamId) === String(yo)));
    D.misVentas = [{ marketId: 'vh', pid: j.id, ptId: 'pt' + j.id, precio: j.valor, cierra: fin, ofertas: [{ id: 'oh', importe: oferta, estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true }] }];
    D.mercado.push({ id: 'vh', pid: j.id, tipo: 'manager', precio: j.valor, cierra: fin, pujas: 0, ofertas: 1, vendedorTeamId: yo, vendedor: D.yo.manager, miPuja: null, clausula: null });
    const M = S.M = Mo.analizar(D, S.H, S.c, {});
    const x = M.mias.find((y) => y.pid === j.id), d = M.decision(j.id);
    const R = Pm.planDeHoy(D, M, c);
    // el plan de la IA de hace 7 horas: aceptar la oferta por Hugo Duro
    const t0 = Date.now() - 7 * 3600e3;
    const PIA = { operaciones: [{ accion: 'aceptar_oferta', ref: 'A-' + j.id, pid: j.id, jugador: j.nombre, importe: oferta, motivo: 'Está bajando: mejor venderlo.', dia: 'hoy', cuando: 'ahora' }], titular: 'Hoy toca vender a Hugo Duro', situacion: 'Hugo Duro baja y no entra en tu once.', modelo: 'x', t: t0, dia: U.diaDe(t0) };
    const C = I.cuadrarPlan(PIA, D, M);
    const o = C.ops[0];
    U.LS.set((await import('./js/datos.js')).K('planes'), [PIA]);
    M.verPlan(C);
    const Sx = { D, M, plan: C, opPorPid: {} };
    const vv = De.ventaVista(M, x);
    const v = M.misVentas.find((y) => y.pid === j.id);
    const ventasTxt = I.ventasMiasTxt(D, M, [j], c) || '';
    const datos = I.datosChat('me dices que lo venda y en el plan que lo aguante, ¿en qué quedamos?', D, M, c, { hist: [{ r: 'yo', t: '¿Qué hago con Hugo Duro?' }, { r: 'ia', t: 'Véndelo: está bajando y no entra en tu once.', cuando: Date.now() - 3600e3 }] });
    const llevas = Vi.llevasHTML(Sx);
    const pasoHTML = Vi.pasoCambiaTxt ? Vi.pasoCambiaTxt(C, o) : '';
    // D. la respuesta de la IA que niega lo que dijo
    const rev = I.revisarChat('Te he dicho que lo vendas, no que lo aguantes. Mi recomendación sigue igual: vender a Hugo Duro, acepta la oferta de LaLiga. Su cláusula de 15,16 M no te protege: está un +486 % y nadie paga eso.', 'me dices que lo venda y en el plan que lo aguante, ¿en qué quedamos?', D, M, { hist: [] });
    // E. (25 nov, B14) «¿Vendo a Hugo Duro?» → «Sí, véndelo: …» sin decir nada de la oferta que tiene
    const rev14 = I.revisarChat('Sí, véndelo: baja cada día y no entra en tu once. Si quieres cobrar ya, ofrécelo a un rival; si no, a la venta para la oferta de LaLiga de mañana.', '¿Vendo a Hugo Duro?', D, M, { hist: [] });
    const rev14b = I.revisarChat('Sí, véndelo, pero esta oferta no la aceptes: LaLiga te hará otra mañana.', '¿Vendo a Hugo Duro?', D, M, { hist: [] });
    const r14 = { con: (rev14.notas || []).join(' | '), sin: (rev14b.notas || []).filter((n) => /esta oferta no/.test(n)).length };
    return { r14, d: { accion: d.accion, matiz: d.matiz, corta: d.corta, porque: d.porque, esperado: d.cifras && d.cifras.esperado, oferta }, valor: j.valor,
      o: { descartada: o.descartada, cambia: !!o.cambia, aviso: o.aviso, decAhora: o.decAhora || null, dec0: o.dec0 || null }, titular: C.titular, pill: vv && vv.pill, largo: vv && vv.largo,
      consejo: v.consejo, porque: v.porque, ventasTxt, datos, llevas, pasoHTML, rev: typeof rev === 'string' ? rev : (rev && rev.texto) || JSON.stringify(rev),
      urg: Vi.urgentesDe(Sx).urg.filter((a) => String(a.pid) === String(j.id)).map((a) => a.titulo), enPlan: (R.ops || []).filter((q) => String(q.pid) === String(j.id) && !q.descartada).map((q) => q.accion) };
  }, { COMUN });
  const eurTxt = (n) => `${String(Math.round(n / 1e4) / 100).replace('.', ',')} M`;
  ok(r.d.accion === 'vender' && r.d.matiz === 'esta-oferta-no', `C. Senna: la decisión es «${r.d.corta}» (${r.d.porque})`);
  ok(r.o.descartada && r.o.cambia && !/mejor aguantar/.test(r.titular) && /Hugo Duro: a la venta, pero esta oferta no/.test(r.titular), `B. el paso «aceptar la oferta» de las 06:25 sale del plan y el titular dice la decisión: «${r.titular}»`);
  ok(/esta oferta no/.test(r.pill || '') && r.consejo === 'esperar', `C. Equipo: pastilla «${r.pill}» y en venta «${r.consejo}»`);
  ok(/LA DECISIÓN DE LA APP: VENDER, PERO ESTA OFERTA NO/.test(r.ventasTxt) && !/VEREDICTO DE LA APP/.test(r.ventasTxt), 'C. el chat lee la misma decisión: «VENDER, PERO ESTA OFERTA NO»');
  ok(/LALIGA: YA LE HA HECHO SU OFERTA/.test(r.ventasTxt) && !/su oferta llega en el siguiente cambio de mercado/.test(r.ventasTxt), 'C. la línea de LaLiga sabe que ya hay oferta');
  ok(r.ventasTxt.includes(eurTxt(r.d.oferta)), `C. con la cifra de la oferta que tiene (${eurTxt(r.d.oferta)})`);
  ok(!r.urg.length && !r.enPlan.length, `C. Hoy no manda venderlo aparte del plan (${JSON.stringify(r.urg)})`);
  ok(/Hugo Duro: a la venta, pero esta oferta no/.test(r.datos) && !/Hoy toca vender a Hugo Duro/.test(r.datos.replace(/EL PLAN DE LAS[^\n]*\n?/g, '')), 'B. al chat el plan le llega con el titular que se ve en Hoy, no con el que escribió la IA');
  ok(/HA CAMBIADO DESDE EL PLAN/.test(r.datos) && /Hugo Duro/.test((r.datos.match(/HA CAMBIADO DESDE EL PLAN[^\n]*/) || [''])[0]), `B. y se le dice qué ha cambiado desde el plan: «${(r.datos.match(/HA CAMBIADO DESDE EL PLAN[^\n]*/) || ['(nada)'])[0].slice(0, 260)}»`);
  ok(/TÚ DIJISTE ANTES/.test(r.datos), `D. y lo que ella dijo antes en la conversación y ya no vale: «${(r.datos.match(/TÚ DIJISTE ANTES[^\n]*/) || ['(nada)'])[0].slice(0, 220)}»`);
  ok(/Lo proponía el plan de las|Del plan de las/.test(r.llevas) && !/Por tu cuenta/.test((r.llevas.match(/Hugo Duro a la venta[^]*?<\/li>/) || [''])[0]), `B. «Lo que llevas hoy»: Hugo Duro a la venta sale como del plan de la mañana, no «Por tu cuenta» («${((r.llevas.match(/Hugo Duro a la venta[^]*?<\/li>/) || [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).slice(0, 160)}»)`);
  ok(/A las \d\d:\d\d/.test(r.pasoHTML) && /[Aa]hora/.test(r.pasoHTML), `B. el paso dice qué ha cambiado: «${r.pasoHTML}»`);
  ok(/Revisado por la app/.test(r.rev) && /esta oferta \([^)]*\) no|esta oferta no/.test(r.rev), `D. revisarChat corrige el «mi recomendación sigue igual: vender… acepta la oferta»: «${(r.rev.match(/Revisado por la app:[^]*/) || [''])[0].slice(0, 300)}»`);
  ok(/esta oferta[^.]{0,30} no/.test(r.r14.con) && /no la aceptes/.test(r.r14.con) && r.r14.sin === 0, `E. «¿Vendo a Hugo Duro?» → «Sí, véndelo» sin la oferta: la app añade que esa oferta no («${r.r14.con.slice(0, 200)}»); si ya lo dice, nada`);
  ok(/sí te protege|te protege/.test((r.rev.match(/Revisado por la app:[^]*/) || [''])[0]), 'D. y lo de «la cláusula no te protege» con una cláusula que nadie paga');
  await P.cerrar();
}
{
  // C. el martes de la liga de ejemplo, sin tocar nada: Rodri en lo urgente (19 nov) y el titular que gira
  const P = await pagina('martes');
  const r = await P.page.evaluate(async ({ COMUN }) => {
    // eslint-disable-next-line no-eval
    await (0, eval)(`(async () => { ${COMUN} })()`);
    const { Pm, I, Vi, De, S, c } = window.__cc;
    const { D, M } = S;
    const R = Pm.planDeHoy(D, M, c); M.verPlan(R);
    const Sx = { D, M, plan: R, opPorPid: {} };
    for (const o of R.ops) if (o.pid && !o.descartada && !Sx.opPorPid[o.pid]) Sx.opPorPid[o.pid] = o;
    const de = (n) => { const x = M.mias.find((y) => y.j.nombre === n), d = M.decision(x.pid), vv = De.ventaVista(M, x); return { corta: d.corta, regla: d.regla, pill: vv && vv.pill, largo: vv && vv.largo, chat: ((I.ventasMiasTxt(D, M, [x.j], c) || '').match(/LA DECISIÓN DE LA APP: (.{0,40})/) || [])[1] }; };
    return { catena: de('Catena'), rodri: de('Rodri'), urg: Vi.urgentesDe(Sx).urg.map((a) => a.titulo), acc: (M.acciones || []).filter((a) => a.tipo === 'vender').map((a) => a.titulo) };
  }, { COMUN });
  ok(/Aguantar/.test(r.catena.corta) && /titular/.test(r.catena.pill || '') && /se aguanta/.test(r.catena.largo || '') && /^AGUANTAR/.test(r.catena.chat || ''), `C. Catena, titular que ha girado: «${r.catena.corta}» en la pastilla («${r.catena.pill}»), en tu atención («${r.catena.largo}») y en el chat («${r.catena.chat}»)`);
  ok(!r.acc.some((t) => /Rodri/.test(t) && /beneficio/.test(t)) && !r.urg.some((t) => /Vende a Rodri/.test(t)), `C. nada de «Vende a Rodri con beneficio» mientras el plan lo aguanta (${JSON.stringify(r.acc)})`);
  ok(/hace falta el dinero/i.test(r.rodri.corta) === /HACE FALTA EL DINERO/.test(r.rodri.chat || ''), `C. Rodri: «${r.rodri.corta}» y el chat «${r.rodri.chat}»`);
  await P.cerrar();
}
// E. lo que encontró el repaso independiente (24 nov), cada cosa con su escena
for (const [escena, que] of [['m-24', 'llena'], ['veda', 'retira'], ['martes', 'pastilla']]) {
  const P = await pagina(escena);
  const r = await P.page.evaluate(async ({ COMUN, que }) => {
    // eslint-disable-next-line no-eval
    await (0, eval)(`(async () => { ${COMUN} })()`);
    const { Pm, I, Vi, Co, S, c } = window.__cc;
    const { D, M } = S;
    const R = Pm.planDeHoy(D, M, c); M.verPlan(R);
    const Sx = { D, M, plan: R, opPorPid: {} };
    for (const o of R.ops) if (o.pid && !o.descartada && !Sx.opPorPid[o.pid]) Sx.opPorPid[o.pid] = o;
    if (que === 'llena') {
      const datos = I.datosChat('¿A quién ficho?', D, M, c, {});
      const libres = M.mercado.filter((m) => m.j && !m.miPuja && String(m.vendedorTeamId || '') !== String(D.yo.teamId));
      return { n: M.mias.length, chollos: libres.filter((m) => /chollo/i.test(Vi.etiquetaFichar(Sx, m.pid))).map((m) => m.j.nombre), vale: [...datos.matchAll(/^- \[[PCMT]-[^\]]+\] [A-ZÁÉÍÓÚ ]+ (?:por |a )?([^,:]+)[^\n]*→ LA APP: vale para/gm)].map((m) => m[1].trim()).slice(0, 4) };
    }
    if (que === 'retira') {
      const o = R.ops.find((y) => y.retira && !y.descartada);
      if (!o) return { sin: true };
      const df = M.decisionFichar(o.pid), datos = I.datosChat('¿Qué hago hoy?', D, M, c, {});
      return { nom: o.jugador, df: df && df.accion, tag: Vi.etiquetaFichar(Sx, o.pid), pasoChat: (datos.match(new RegExp(`^- [^\\n]*${o.jugador}[^\\n]*$`, 'm')) || [''])[0].slice(0, 60), pill: Co.planPill(o).replace(/<[^>]+>/g, '') };
    }
    const luego = R.ops.find((y) => y.hoy === false && !y.descartada && y.accion === 'vender');
    const baena = M.misVentas.find((v) => v.j.nombre === 'Álex Baena');
    return { pill: luego ? Co.planPill(luego).replace(/<[^>]+>/g, '') : null, nom: luego && luego.jugador, baena: baena ? baena.porque : null, pujas: M.misPujas, dinero: D.dinero };
  }, { COMUN, que });
  if (que === 'llena') ok(r.n >= 24 && !r.chollos.length && !r.vale.length, `E. con la plantilla llena (${r.n}), ni Mercado llama «Chollo» a nadie (${JSON.stringify(r.chollos)}) ni a la IA le llega ningún fichaje como «vale» (${JSON.stringify(r.vale)})`);
  else if (que === 'retira') ok(r.sin || (r.df === 'no' && !/chollo/i.test(r.tag) && /Retirar puja/.test(r.pill) && !/esperar a/.test(r.pasoChat)), r.sin ? 'E. (veda: el plan no retira ninguna puja en esta escena)' : `E. la puja que el plan retira (${r.nom}): Mercado no lo llama chollo («${r.tag}»), la pastilla dice «${r.pill}» y al chat le llega «${r.pasoChat}»`);
  else {
    ok(!r.pill || !/ hoy$/.test(r.pill), `E. la pastilla de un paso para otro día (${r.nom}) no dice «hoy»: «${r.pill}»`);
    ok(!r.baena || !(r.pujas > r.dinero && /\(tienes /.test(r.baena)), `E. con más pujado (${r.pujas}) que saldo (${r.dinero}), la oferta por Baena no dice «no te hace falta el dinero (tienes…)»: «${String(r.baena).slice(0, 120)}»`);
  }
  await P.cerrar();
}
// F. (25 nov, tanda B-1) las cuatro «Quedan» de la auditoría de coherencia (B5 a B8)
for (const escena of ['martes', 'paron', 'm-cierre-negativo']) {
  const P = await pagina(escena);
  const r = await P.page.evaluate(async () => {
    const Pm = await import('./js/plan.js'), I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), Vi = await import('./js/vistas.js');
    const S = window.S, { D, M } = S, c = Dt.cfg();
    const R = Pm.planDeHoy(D, M, c); M.verPlan(R);
    const chat = I.datosChat('¿Qué hago hoy?', D, M, c, {});
    // B7: de un libre que el plan mira y no ficha, al chat le llega la cifra del plan, no «la app pujaría» otra
    const dos = [];
    for (const m of M.mercado.filter((x) => x.tipo === 'liga')) {
      const df = M.decisionFichar(m.pid);
      const cif = df && df.accion === 'no' ? [...String(df.porque || '').matchAll(/se paga a unos ([\d.,]+ M)/g)].map((x) => x[1]) : [];
      const l = chat.split('\n').find((y) => y.includes(`] PUJAR por ${m.j.nombre},`)) || '';
      const ap = (l.match(/la app pujaría ([\d.,]+ M)/) || [])[1];
      if (cif.length && ap && !cif.includes(ap)) dos.push(`${m.j.nombre}: plan ${cif[0]}, chat ${ap}`);
    }
    // B8: la palabra de la inercia que lee la IA y la de la decisión, la misma
    const palabras = [];
    for (const x of M.mias) {
      const d = M.decision(x.pid), l = chat.split('\n').find((y) => y.includes(` | ${x.j.nombre} | `)) || '';
      if (d && /INERCIA HA GIRADO/.test(l) && /se est[áa] frenando/i.test(d.porque || '')) palabras.push(x.j.nombre);
    }
    // B5: «hoy no se toca a los titulares» con un titular en el plan, con su salvedad
    const tit = (R.ops || []).filter((o) => !o.descartada && o.accion === 'vender' && o.pid && M.perdida(o.pid) >= 0.3).map((o) => o.jugador || (o.j && o.j.nombre));
    const sinSalvedad = /no se toca a los titulares/.test(R.situacion || '') && tit.length && !tit.every((n) => new RegExp(`salvo [^.]*${n}`).test(R.situacion));
    // B6: una puja ya puesta por uno que el plan no ficha y no retira: la ficha no dice «no pujes»
    const pujadas = M.mercado.filter((m) => m.miPuja).map((m) => { const dpl = Vi.descartePlan({ D, M, plan: R, opPorPid: {} }, m.pid); return { n: m.j.nombre, df: M.decisionFichar(m.pid), dpl }; })
      .filter((x) => x.df && x.df.accion === 'no' && !x.df.retira);
    return { dos, palabras, sinSalvedad, tit, sit: R.situacion, pujadas: pujadas.map((x) => ({ n: x.n, ya: !!x.df.yaPujada, sigue: /Tu puja de [^ ]+ M sigue puesta/.test(x.df.porque || ''), dpl: !!(x.dpl && x.dpl.yaPujada) })) };
  });
  ok(!r.dos.length, `F. ${escena}: de lo que el plan mira y no ficha, al chat le llega la puja del plan (${r.dos.join('; ') || 'ninguna distinta'})`);
  ok(!r.palabras.length, `F. ${escena}: la inercia y la decisión dicen lo mismo (${r.palabras.join(', ') || 'todos'})`);
  ok(!r.sinSalvedad, `F. ${escena}: «hoy no se toca a los titulares» dice quién sí (${r.tit.join(', ') || 'ninguno'})`);
  ok(r.pujadas.every((x) => x.ya && x.sigue && x.dpl), `F. ${escena}: con tu puja puesta, «no pujaría, pero tu puja sigue» (${r.pujadas.map((x) => x.n).join(', ') || 'sin pujas'})`);
  await P.cerrar();
}
await cerrar();
console.log(`\n${tot.ligas} ligas al azar, ${tot.mios} jugadores míos y ${tot.fichar} candidatos a fichar (semilla ${SEM})`);
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
