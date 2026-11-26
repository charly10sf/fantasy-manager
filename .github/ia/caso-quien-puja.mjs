// (24 nov, la idea de un amigo de Carlos: «ver lo que pujan los rivales») LaLiga no dice quién puja ni cuánto: solo cuántas
// pujas lleva cada libre. La app apunta cuándo entra cada una (web/js/pujas-vistas.js) y estima quién puede estar detrás y
// cuánto (web/js/quien-puja.js). Lo que tiene que pasar:
//  - el registro: una puja que ya estaba al verlo por primera vez no tiene hora; la que entra entre dos lecturas, sí; la tuya
//    no cuenta como de otro (y aprende sola si el número de LaLiga la incluye); una retirada se descuenta; nada dos veces;
//  - el motor: cada libre con pujas de otros lleva `quien`, con todos los rivales o en la lista o descartados, las
//    probabilidades de una sola puja suman 1, va del más probable al menos y lo que rondaría cada uno no baja del mínimo;
//  - se descarta al que tiene 24 jugadores (la plantilla llena) y al que no le llega ni con la deuda;
//  - el rival que hizo algo en la liga en el rato en que entró la puja sube en la lista, y se dice;
//  - la tarjeta de la ficha dice que es una estimación y no cuenta el dinero de un rival con el dinero cerrado;
//  - el aviso de puja nueva, solo por un libre por el que has pujado o que sigues, y sin decir quién si la función está cerrada;
//  - nada de esto mueve la puja que propone la app.
// Sin IA ni red. Uso: node .github/ia/caso-quien-puja.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import { pagina, cerrar } from './banco.mjs';

const P = await pagina('martes');
let mal = 0;
const ok = (c, t) => { console.log(`${c ? 'BIEN' : 'MAL '} ${t}`); if (!c) mal++; };
try {
  const r = await P.page.evaluate(async () => {
    const Mo = await import('./js/motor.js'), Pv = await import('./js/pujas-vistas.js'), Fo = await import('./js/fondo.js'), Hj = await import('./js/hojas.js'), Li = await import('./js/limite.js'), Av = await import('./js/avisos.js');
    const S = window.S, HORA = 36e5, ahora = Date.now();
    const out = {};
    // ---- el registro, solo ----
    {
      const t0 = ahora - 6 * HORA;
      const foto = (t, l) => ({ t, mercado: l.map(([id, pujas, miPuja]) => ({ id, pid: `p${id}`, tipo: 'liga', pujas, miPuja: miPuja || null, cierra: t0 + 20 * HORA })) });
      const r1 = Pv.registrarPujas(null, foto(t0, [['a', 0], ['b', 1]]));
      const r2 = Pv.registrarPujas(r1.reg, foto(t0 + HORA, [['a', 1], ['b', 1]]));
      const r2b = Pv.registrarPujas(r2.reg, foto(t0 + HORA, [['a', 1], ['b', 1]]));
      const r3 = Pv.registrarPujas(r2.reg, foto(t0 + 2 * HORA, [['a', 2, 5e6], ['b', 1]]));
      const r4 = Pv.registrarPujas(r3.reg, foto(t0 + 3 * HORA, [['a', 3, 5e6], ['b', 0]]));
      out.reg = {
        primera: r1.reg.m.b.a === 1 && r1.reg.m.b.ev.length === 1 && r1.reg.m.b.ev[0][0] === 0 && !Object.keys(Pv.nuevasEn(r1.reg)).length,
        entra: JSON.stringify(r2.reg.m.a.ev) === JSON.stringify([[t0, t0 + HORA, 1]]) && Pv.nuevasEn(r2.reg).a === 1,
        dosVeces: r2b.cambia === false && r2b.reg === r2.reg,
        laMia: r3.reg.m.a.a === 1 && r3.reg.m.a.mia === 1 && r3.reg.cal.si === 1 && !Pv.nuevasEn(r3.reg).a,
        otra: r4.reg.m.a.a === 2 && r4.reg.m.a.ev.length === 2 && Pv.nuevasEn(r4.reg).a === 1,
        retirada: r4.reg.m.b.a === 0 && r4.reg.m.b.ev.length === 0,
        sinTocar: r1.reg.m.a.n === 0 && r2.reg.m.a.ev.length === 1,
        ajenas: Pv.ajenasDe({ id: 'a', pujas: 3, miPuja: 5e6 }, r4.reg) === 2 && Pv.ajenasDe({ id: 'z', pujas: 2, miPuja: 1 }, r4.reg) === 1 && Pv.ajenasDe({ id: 'z', pujas: 2 }, null) === 2,
      };
    }
    // ---- el motor, con la liga de ejemplo ----
    const copia = (x) => JSON.parse(JSON.stringify(x));
    const yo = S.D.yo.teamId;
    const rivales = S.D.clasif.filter((e) => e.teamId !== yo);
    const libre0 = S.M.mercado.find((m) => m.tipo === 'liga' && m.j && m.j.pos >= 1 && m.j.pos <= 4 && !m.miPuja);
    const montar = ({ pujas = 1, miPuja = null, reg = null, toca = () => {} } = {}) => {
      const D = copia(S.D), H = copia(S.H);
      for (const m of D.mercado) if (m.tipo === 'liga') { m.pujas = m.id === libre0.id ? pujas : 0; m.miPuja = m.id === libre0.id ? miPuja : null; }
      toca(D, H);
      const M = Mo.analizar(D, H, S.c, { det: S.det, pujasVistas: reg });
      return { D, H, M, x: M.mercado.find((m) => m.id === libre0.id) };
    };
    const A = montar();
    const q = A.x.quien;
    const suma = q ? q.cands.reduce((s, c) => s + c.p, 0) : 0;
    out.motor = {
      jugador: libre0.j.nombre, ajenas: A.x.ajenas, hay: !!q, suma: Math.round(suma * 1000) / 1000,
      todos: !!q && q.cands.length + q.fuera.length === rivales.length,
      orden: !!q && q.cands.every((c, i) => !i || q.cands[i - 1].p >= c.p),
      ronda: !!q && q.cands.every((c) => c.est == null || (c.est >= A.x.precio && c.alto >= c.est)),
      conMotivo: !!q && q.cands.some((c) => c.motivos.length),
      lista: q ? q.cands.slice(0, 3).map((c) => `${c.nombre} ${Math.round(c.p * 100)} % [${c.motivos.map((y) => y.t).join('; ')}]`) : [],
      medios: rivales.slice(0, 3).map((e) => A.M.quienPuja.plantillaDe(e.teamId)), formaciones: A.M.formaciones,
      sinPujas: A.M.mercado.filter((m) => m.tipo === 'liga' && m.id !== libre0.id).every((m) => m.ajenas === 0 && m.quien === null),
    };
    // ---- no puede pujar: 24 jugadores, o no le llega ni con la deuda; y el que va sobrado ----
    const [R1, R2, R3, R4] = rivales.map((e) => e.teamId);
    const nombre = (tid) => { const e = rivales.find((y) => y.teamId === tid); return e.manager || e.nombre; };
    const B = montar({ toca: (D) => {
      const deAlguien = new Set(Object.values(D.plantillas).flat().map((f) => f.pid));
      const sueltos = Object.values(D.maestro).filter((j) => !deAlguien.has(j.id) && j.pos >= 1 && j.pos <= 4 && j.id !== libre0.pid).map((j) => j.id);
      while (D.plantillas[R1].length < 24 && sueltos.length) D.plantillas[R1].push({ ...D.plantillas[R1][0], pid: sueltos.pop() });
      D.dineros = { [R2]: { v: -900e6 }, [R3]: { v: 900e6 } };
    } });
    const qb = B.x.quien;
    out.fuera = {
      llena: !!qb && qb.fuera.some((f) => f.tid === R1 && f.por === 'llena'),
      dinero: !!qb && qb.fuera.some((f) => f.tid === R2 && f.por === 'dinero'),
      suma: qb ? Math.round(qb.cands.reduce((s, c) => s + c.p, 0) * 1000) / 1000 : 0,
      sobrado: !!qb && (qb.cands.find((c) => c.tid === R3) || { motivos: [] }).motivos.some((y) => y.dinero),
    };
    // la tarjeta: es una estimación, y del rival con el dinero cerrado (en la liga de ejemplo, todos) no se cuenta el dinero
    const html = Hj.quienPujaHTML({ ...S, D: B.D, M: B.M }, B.x);
    out.html = {
      estimacion: /Es una estimación: LaLiga no dice quién puja ni cuánto/.test(html),
      nombres: qb.cands.slice(0, 2).every((c) => html.includes(c.nombre.replace(/&/g, '&amp;'))),
      sinDinero: !/sin tirar de deuda|\(no le llega\)|no pasa de/.test(html),
      cerradoDinero: Li.bloqueada('dineroRivales', R3) === true,
      fuera: /No pueden pujar: /.test(html) && /\(24 jugadores\)/.test(html),
      largo: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length,
    };
    // en la ficha del jugador, con la función cerrada (la liga de ejemplo): el candado dorado, no la lista
    const SB = { ...S, D: B.D, M: B.M };
    const ficha = Hj.fichaJugador(SB, libre0.pid);
    out.ficha = { cerrada: Li.bloqueada('quienPuja') === true, candado: /data-clave="quienPuja"/.test(ficha) && /Quién puja por él/.test(ficha), sinLista: !/Quién puede ser la otra puja/.test(ficha) };
    // ---- la hora: R4 vendió a uno en el rato en que entró la puja ----
    const reg = { t: S.D.t, cal: { si: 0, no: 0 }, m: { [libre0.id]: { pid: libre0.pid, c: libre0.cierra, n: 1, mia: 0, a: 1, t0: ahora - 5 * HORA, tl: S.D.t, ev: [[ahora - 2 * HORA, ahora - HORA, 1]] } } };
    const conVenta = (D) => { const f = D.plantillas[R4][0]; D.actividad.unshift({ id: 'vx', t: ahora - 1.5 * HORA, tipo: 33, clase: 'venta', quien: nombre(R4), quienId: rivales.find((y) => y.teamId === R4).userId, otro: '', otroId: '', pid: f.pid, jugador: '', importe: 3e6 }); };
    const C0 = montar({ toca: conVenta }), C1 = montar({ reg, toca: conVenta });
    const p0 = (C0.x.quien.cands.find((c) => c.tid === R4) || {}).p || 0, c1 = C1.x.quien.cands.find((c) => c.tid === R4) || { p: 0, motivos: [] };
    out.hora = { sin: Math.round(p0 * 100), con: Math.round(c1.p * 100), sube: c1.p > p0 * 1.2, dice: c1.motivos.some((y) => /andaba por la liga a esa hora/.test(y.t)), ev: C1.x.pujasEv.length === 1 && C1.x.quien.ev.length === 1,
      tarjeta: /Entró entre /.test(Hj.quienPujaHTML({ ...S, D: C1.D, M: C1.M }, C1.x)) };
    // ---- el aviso de puja nueva: por uno por el que has pujado, sin decir quién con la función cerrada ----
    const miPuja = Math.round(libre0.precio * 1.05);
    const regN = { t: S.D.t, cal: { si: 1, no: 0 }, m: { [libre0.id]: { pid: libre0.pid, c: libre0.cierra, n: 2, mia: 1, a: 1, t0: ahora - 5 * HORA, tl: S.D.t, ev: [[S.D.t - HORA, S.D.t, 1]] } } };
    const N = montar({ pujas: 2, miPuja, reg: regN });
    const cfgA = { on: true, pujas: true, jugadores: {} };
    const av = Fo.pujasNuevas(N.M, cfgA);
    const N0 = montar({ pujas: 1, reg: { ...regN, m: { [libre0.id]: { ...regN.m[libre0.id], n: 1, mia: 0 } } } });
    out.aviso = {
      ajenas: N.x.ajenas, uno: av.length === 1, titulo: av[0] ? av[0].titulo : '', texto: av[0] ? av[0].texto : '',
      sinQuien: !!av[0] && !/Lo más probable/.test(av[0].texto),
      noSigues: Fo.pujasNuevas(N0.M, cfgA).length === 0,
      sigues: Fo.pujasNuevas(N0.M, { ...cfgA, jugadores: { [libre0.pid]: { antes: 60 } } }).length === 1,
      apagado: Fo.pujasNuevas(N.M, { ...cfgA, pujas: false }).length === 0,
      enTodos: (() => { const antes = Av.cfgAvisos(); Av.guardarCfgAvisos({ on: true, pujas: true }); const l = Fo.avisosNuevos(null, N.D, N.M); Av.guardarCfgAvisos({ on: antes.on, pujas: antes.pujas }); return l.some((a) => /^puja-nueva:/.test(a.k)); })(),
    };
    // ---- nada de esto mueve la puja de la app ----
    out.igual = A.M.mercado.filter((m) => m.tipo === 'liga').every((m) => { const y = C1.M.mercado.find((z) => z.id === m.id); return y && y.puja === m.puja && y.pujaGana === m.pujaGana; });
    return out;
  });
  const g = r.reg;
  ok(g.primera, 'el registro: una puja que ya estaba la primera vez no tiene hora ni cuenta como nueva');
  ok(g.entra, 'la que entra entre dos lecturas se apunta con ese rato, y es nueva');
  ok(g.dosVeces, 'la misma foto no se apunta dos veces');
  ok(g.laMia, 'tu puja no cuenta como de otro (y queda aprendido que el número de LaLiga la incluye)');
  ok(g.otra && g.retirada, 'otra de un rival se suma con su rato; una retirada se descuenta');
  ok(g.sinTocar, 'el registro de antes no se toca al apuntar');
  ok(g.ajenas, 'las pujas de otros de un libre: con el registro, con tu puja contada a mano y sin registro');
  const m = r.motor;
  console.log(`   ${m.jugador}: ${m.lista.join(' · ')}`);
  if (process.env.VER) console.log(JSON.stringify(m.medios), JSON.stringify(m.formaciones));
  ok(m.hay && m.ajenas === 1, `el libre con una puja de otro lleva su «quién» (${m.jugador})`);
  ok(Math.abs(m.suma - 1) < 0.01, `con una sola puja, las probabilidades suman 1 (${m.suma})`);
  ok(m.todos && m.orden, 'todos los rivales están en la lista o descartados, del más probable al menos');
  ok(m.ronda, 'lo que rondaría la puja de cada uno no baja del mínimo');
  ok(m.conMotivo, 'alguno lleva su porqué');
  ok(m.sinPujas, 'los libres sin pujas no llevan nada');
  ok(r.fuera.llena && r.fuera.dinero, 'se descarta al que tiene 24 jugadores y al que no le llega ni con la deuda');
  ok(Math.abs(r.fuera.suma - 1) < 0.01 && r.fuera.sobrado, `y el resto sigue sumando 1 (${r.fuera.suma}); el que va sobrado lleva su motivo de dinero`);
  ok(r.html.estimacion && r.html.nombres && r.html.fuera, `la tarjeta dice que es una estimación, nombra a los primeros y a los que no pueden (${r.html.largo} caracteres)`);
  ok(r.html.cerradoDinero && r.html.sinDinero, 'y con el dinero de los rivales cerrado no cuenta nada de su dinero');
  ok(r.ficha.cerrada && r.ficha.candado && r.ficha.sinLista, 'con la función cerrada, la ficha enseña el candado dorado y no la lista');
  ok(r.hora.sube && r.hora.dice && r.hora.ev && r.hora.tarjeta, `el rival que vendió a uno en el rato en que entró la puja sube (del ${r.hora.sin} % al ${r.hora.con} %), se dice y la tarjeta da el rato`);
  console.log(`   aviso · ${r.aviso.titulo}: ${r.aviso.texto}`);
  ok(r.aviso.ajenas === 1 && r.aviso.uno && /^Nueva puja por /.test(r.aviso.titulo) && /Ya hay 1 puja de otros\. /.test(r.aviso.texto) && /Tu puja es de |Con tu puja de /.test(r.aviso.texto), 'el aviso de puja nueva por un libre por el que has pujado');
  ok(r.aviso.sinQuien, 'con la función cerrada el aviso no dice quién puede ser');
  ok(r.aviso.noSigues && r.aviso.sigues && r.aviso.apagado, 'no avisa de uno que ni sigues ni has pujado; sí del que tienes en «Avisarme»; y nada con los avisos de pujas apagados');
  ok(r.aviso.enTodos, 'y sale con el resto de los avisos');
  ok(r.igual, 'nada de esto mueve la puja que propone la app');
  ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores.slice(0, 2).join(' | ')}` : ''}`);
} finally { await P.cerrar(); await cerrar(); }
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
