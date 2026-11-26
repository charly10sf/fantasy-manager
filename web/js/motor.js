/* El cerebro sin IA: con la foto de la liga (D) y el histórico (H) calcula todo lo que la app enseña.
   Cláusulas de los rivales y cuánto interesa cada una, el riesgo de las tuyas, el mercado, quién sube y
   quién baja, lo que has ganado con tus compras, cómo se mueve cada rival, la jornada, los parones y la
   lista de lo que toca hacer ahora. Todo con números que se pueden comprobar. */
import { paronLejos, cholloParon, subeHastaVuelta, aSuValorParon } from './operaciones.js';
import { acciones } from './acciones.js';
import { decidir } from './decide.js';
import { pTitularMinutos } from './titular.js';
import { textoInercia } from './inercia-texto.js';
import { correcciones, dichoTxt } from './dicho.js';
import { crearQuienPuja } from './quien-puja.js';
import { ajenasDe } from './pujas-vistas.js';
import { num, clamp, DIA, HORA, MIN, diaDe, otroDia, mediodia, masDias, eur, pct, dura, cuando, antesDe, elDia, POS, norm, esDeFutbol, horaDe as horaReloj, TOPE_PLANTILLA } from './util.js';

// parones de selecciones conocidos de la temporada 26/27 (FIFA). Los demás se sacan del calendario.
const PARONES = [
  { ini: Date.parse('2026-11-09T00:00:00+01:00'), fin: Date.parse('2026-11-17T23:59:00+01:00'), nombre: 'Parón de selecciones de noviembre' },
];
const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
// los tramos de valor en los que se cuenta lo que se paga en la liga por los libres (motor y contexto de la IA)
const TRAMOS_PUJA = [[0, 1e6], [1e6, 3e6], [3e6, 10e6], [10e6, 30e6], [30e6, Infinity]];
// (0.7.13) lo que apunta la gente del dinero de los rivales (calDinero del servidor): desde cuántos apuntes cuenta, en total o en un tramo
const CAL_MIN = 8;

const EFECTO_PARTIDO = {
  sube: { b1: [-0.032, -0.101, -0.023, -0.08], b4: [-0.01, -0.026, -0.002, -0.005], b7: [0.027, 0.091, 0.027, 0.09], b9: [0.038, 0.114, 0.034, 0.104], b10: [0.072, 0.203, 0.052, 0.156] },
  plano: { b1: [-0.01, -0.028, -0.007, -0.022], b4: [-0.012, -0.026, -0.006, -0.013], b7: [0.01, 0.038, 0.014, 0.046], b9: [0.031, 0.092, 0.03, 0.092], b10: [0.045, 0.128, 0.034, 0.106] },
  baja: { b1: [-0.014, -0.041, -0.007, -0.029], b4: [-0.008, -0.02, -0.002, -0.01], b7: [0.008, 0.022, 0.011, 0.027], b9: [0.027, 0.083, 0.028, 0.086], b10: [0.053, 0.145, 0.047, 0.134] },
};
/** cómo venía antes del partido, por lo que subió su valor los 3 días de antes (en tanto por uno) */
export const comoVenia = (antes) => (antes > 0.03 ? 'sube' : antes < -0.03 ? 'baja' : 'plano');
/** lo que se espera de más (o de menos) en su valor por el partido que acaba de jugar, por encima de la inercia: { e3, e7 }
 *  (etapa 0, el día del partido: a 3 y 7 días; etapa 1, el día siguiente: lo que queda a 2 y 6), en tanto por uno */
export function efectoTras(pts, como, valor, etapa = 0) {
  const b = pts <= 1 ? 'b1' : pts <= 4 ? 'b4' : pts <= 7 ? 'b7' : pts <= 9 ? 'b9' : 'b10';
  const e = (EFECTO_PARTIDO[como] || EFECTO_PARTIDO.plano)[b];
  // y por lo que vale: en porcentaje, al barato le mueve más un buen partido (tras 10 o más, +8,7 % en 3 días con menos
  // de 3 M y +3,5 % con más de 30 M) y menos uno malo (−0,9 frente a −1,9/−2,5)
  const fp = valor < 3e6 ? [1.6, 0.55] : valor < 10e6 ? [1.45, 1.4] : valor < 30e6 ? [1.07, 1.4] : [0.63, 1.2];
  const pv = (x) => x * (x > 0 ? fp[0] : fp[1]);
  return etapa === 0 ? { e3: pv(e[0]), e7: pv(e[1]) } : { e3: pv(e[2]), e7: pv(e[3]) };
}

/* (24 nov, Carlos: «no es lo mismo uno que sube y ha hecho 15, 14 y 16 que uno que en la última ha hecho 5») lo que FRENA
   un mal partido a uno que viene subiendo, por debajo de lo que dice `proyectar` (la subida de ahora, frenándose un 15 % al
   día). Medido con TODA LaLiga (.github/ia/medir-puntos.mjs y claude/medida-puntos-24nov.md: 3.930 días de 311 jugadores que
   subían más de un 0,8 % al día, jornadas 1-14), en tanto por uno a [3, 7, 10] días, por los puntos del último partido y los
   días que han pasado desde él con el valor de ese día ([0-1], [2], [3-6]; 0 es el día del partido, con el valor aún de
   antes). Solo lo de menos: lo de más tras un buen partido (de 5 puntos para arriba, hasta +18 % a 7 días) se ha quedado en
   la mitad de la primera mitad de la temporada a la segunda, y sumado, la regla de aguantar pasaba a coger muchos más y
   ganaban solo el 56 %; quitando lo de menos, aprendido con una mitad y probado con la otra, gana el 82-96 % en vez del
   76-88 % (los que quita ganaban el 49-72 %). Lo de la caída frente a los partidos de antes (15, 14, 16 y luego 5) sale
   casi entero en los puntos del último: con 5 o más puntos se queda en lo que dice `proyectar`, y con 4 o menos, que
   viniera de muchos o pocos cambia de una mitad a la otra, así que no se cuenta aparte */
const FRENO_PARTIDO = {
  b1: [[-0.040, -0.089, -0.116], [-0.036, -0.072, -0.088], [-0.030, -0.058, -0.067]],
  b4: [[-0.026, -0.049, -0.059], [-0.018, -0.027, -0.025], [-0.014, -0.019, -0.015]],
};
/** lo que frena el último partido: { e3, e7, e10 } (en tanto por uno, ≤ 0) o null. `s`: días desde el partido (0-6) */
export function frenoTras(pts, s) {
  if (pts == null || !(s >= 0) || s > 6) return null;
  const b = pts <= 1 ? 'b1' : pts <= 4 ? 'b4' : null;
  if (!b) return null;
  const [e3, e7, e10] = FRENO_PARTIDO[b][s <= 1 ? 0 : s === 2 ? 1 : 2];
  return { e3, e7, e10 };
}
/** lo de `frenoTras` a k días (de 0 a 3, de 3 a 7 y de 7 a 10, en línea; más allá, lo de 10) */
export const frenoA = (e, k) => (!e || !(k > 0) ? 0 : k <= 3 ? (e.e3 * k) / 3 : k <= 7 ? e.e3 + ((e.e7 - e.e3) * (k - 3)) / 4 : k <= 10 ? e.e7 + ((e.e10 - e.e7) * (k - 7)) / 3 : e.e10);
/** el valor a k días con el freno: no baja de un 3 % por debajo de lo que vale (lo que se vio de peor a 10 días, de media),
    ni sube lo que `proyectar` ya daba por debajo */
const conFreno = (valor, v, e) => (e < 0 ? Math.min(v, Math.max(valor * 0.97, v + valor * e)) : v);

// la tendencia de 7 días para decidir: con 2 o más días subiendo seguidos, la de esos días (`p7e` de M.tend, 0.7n)
const P7 = (t) => (!t ? null : t.p7e !== undefined ? t.p7e : t.p7);

export function analizar(D, H, c, extra = {}) {
  const M = { t: Date.now() };
  if (!D) return M;
  const ahora = Date.now();
  /* (22 nov, Carlos) lo que el mánager ha contado en Pregunta y es un hecho claro corrige lo que llega de LaLiga (dicho.js):
     los blindajes que le quedan, a quién ha blindado ya, a quién no vende y por quién ha pujado ya. Lo aplicado se apunta
     en M.dicho para que Hoy lo enseñe dentro del plan («Lo que me has dicho») y la IA lo lea igual que la app */
  const DICHO = correcciones(extra.notas, ahora);
  M.dicho = [];
  M.noVender = new Map();
  // una puja que dice que ya ha hecho y que LaLiga aún no trae: se da por hecha (con su importe, o el que proponía la app)
  const pujasDichas = [];
  if (DICHO.pujas.size && Array.isArray(D.mercado) && D.mercado.some((m) => DICHO.pujas.has(m.pid) && !m.miPuja)) {
    D = { ...D, mercado: D.mercado.map((m) => {
      const n = DICHO.pujas.get(m.pid);
      if (!n || m.miPuja || !(Number(n.importe) > 0)) return m;
      pujasDichas.push(n);
      return { ...m, miPuja: Number(n.importe), pujaDicha: n.id };
    }) };
  }
  const J = (pid) => D.maestro[pid] || { id: pid, nombre: 'Jugador', valor: 0, media: 0, puntos: 0, pos: 0, estado: 'ok' };
  M.J = J;
  const yoTid = D.yo && D.yo.teamId;
  /* (26 nov) Las Ligas Premium de LaLiga. `D.liga.premium` y `D.liga.pf` salen de los campos de la liga (normalizar.js,
     `premiumDe`); el administrador enciende y apaga cada función por separado, así que se mira una a una. Una foto de la
     liga guardada antes de esta versión no trae `pf`: hasta que se actualice, ninguna función cuenta (solo el blindaje de
     48 h, que va con `premium`). Reglas: la ayuda oficial de LaLiga Fantasy («Ligas premium», «Entrenador», «Cesiones»). */
  {
    const L = D.liga || {}, pf = (L.premium === true && L.pf) || {}, pc = (L.premium === true && L.pc) || {};
    M.premium = {
      liga: L.premium === true, leido: L.premium === true && !!L.pf,
      entrenador: pf.coach === true, capitan: pf.captain === true, banquillo: pf.bench === true,
      formaciones: pf.formations === true, cesiones: pf.loan === true, ideal: pf.ideal === true,
      idealPremio: pc.ideal || null, cesionMax: pc.cesionMax || null, cesionMin: pc.cesionMin || null, cesionJornadas: pc.cesionJornadas || null,
    };
  }
  /** el tope de la plantilla, 24 (`TOPE_PLANTILLA`; Carlos, 14 y 20 nov: lleno, no se puja ni se clausula). En una liga premium con entrenador,
   *  los entrenadores (2 como mucho) no cuentan en ese tope (ayuda de LaLiga, «Entrenador», ago 2026) */
  M.TOPE = TOPE_PLANTILLA;
  M.cuentaPlantilla = (js) => (js || []).filter((j) => j && !(M.premium.entrenador && j.pos === 5)).length;
  const yoEntrada = D.clasif.find((e) => e.teamId === yoTid) || null;
  M.yo = yoEntrada;

  /* ---------- quién es de quién ---------- */
  M.dueno = {};
  for (const [tid, fichas] of Object.entries(D.plantillas || {})) for (const f of fichas) M.dueno[f.pid] = tid;
  // (22 nov) lo dicho en Pregunta: a quién no vende (mientras siga siendo suyo) y las pujas que se dan por hechas
  for (const [pid, n] of DICHO.noVender) if (yoTid && M.dueno[pid] === yoTid) { M.noVender.set(pid, n); M.dicho.push({ ...n, txt: dichoTxt(n, J(pid).nombre), hasta: n.caduca || null }); }
  for (const n of pujasDichas) M.dicho.push({ ...n, txt: `${dichoTxt(n, J(n.pid).nombre)} (${eur(n.importe)})`, hasta: n.caduca || null });
  M.equipo = Object.fromEntries(D.clasif.map((e) => [e.teamId, e]));
  const porManager = {};
  // (un nombre solo con emojis o en otro alfabeto se queda vacío al normalizar: esos no se buscan por nombre, o todos
  // chocarían en el mismo)
  for (const e of D.clasif) { if (norm(e.manager)) porManager[norm(e.manager)] = e.teamId; if (norm(e.nombre)) porManager[norm(e.nombre)] = e.teamId; }
  M.teamDeManager = (nombre) => (norm(nombre) && porManager[norm(nombre)]) || null;
  const porUsuario = {};
  for (const e of D.clasif) { if (e.userId) porUsuario[e.userId] = e.teamId; if (e.managerId) porUsuario[e.managerId] = e.teamId; }
  if (D.yo && D.yo.userId && yoTid) porUsuario[D.yo.userId] = yoTid;
  M.teamDeUsuario = (id, nombre) => (id && porUsuario[id]) || M.teamDeManager(nombre);
  const nombreEquipo = (tid) => { const e = tid && M.equipo[tid]; return e ? e.manager || e.nombre : ''; };

  /* ---------- lo que ya no es tuyo: vendidos y clausulados estos días ---------- */
  // La plantilla de la API a veces tarda en enterarse. Si los movimientos dicen que lo vendiste (o que te lo
  // clausularon) y no lo has vuelto a fichar, o si me has contado en el chat que ya lo has vendido, deja de contar
  // como tuyo en todo: el once, el plan, las ventas y lo que se le pasa a la IA.
  const vendidos = {};
  const comprados = {};
  {
    const ev = [];
    for (const a of D.actividad || []) if (a.pid && a.t && ahora - a.t < 10 * DIA) ev.push({ t: a.t, a });
    for (const m of H.mov || []) if (m.teamId === yoTid && ahora - m.t < 10 * DIA && (m.tipo === 'sale' || m.tipo === 'entra')) ev.push({ t: m.t, m });
    ev.sort((x, y) => x.t - y.t);
    for (const { t, a, m } of ev) {
      if (m) {
        if (m.tipo === 'sale' && !vendidos[m.pid]) vendidos[m.pid] = { t, como: 'salió de tu equipo' };
        else if (m.tipo === 'entra') { delete vendidos[m.pid]; comprados[m.pid] = t; }
        continue;
      }
      const q = M.teamDeUsuario(a.quienId, a.quien), o = a.otroId || a.otro ? M.teamDeUsuario(a.otroId, a.otro) : null;
      if (yoTid && a.clase === 'venta' && q === yoTid) vendidos[a.pid] = { t, como: 'lo vendiste', importe: a.importe || null };
      else if (yoTid && (a.clase === 'compra' || a.clase === 'clausula') && o === yoTid && q && q !== yoTid) vendidos[a.pid] = { t, como: a.clase === 'clausula' ? `te lo clausuló ${nombreEquipo(q)}` : `se lo vendiste a ${nombreEquipo(q)}`, importe: a.importe || null, aTid: q, evId: a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}|${a.importe}` };
      else if (yoTid && (a.clase === 'compra' || a.clase === 'clausula') && q === yoTid) { delete vendidos[a.pid]; comprados[a.pid] = t; }
    }
    for (const n of extra.notas || []) {
      // «ya lo he vendido», «me lo han clausulado»; no «he clausulado a X» ni «fiché a X, que vendía Juan»
      const tx = n.texto || '';
      const sale = /(\bhe vendido|\bvend[ií]\b|\bya (lo )?vend|\blo he vendido|\bvendido\b|me (lo )?(han )?clausulad|me lo han quitado|\btraspas[eé]\b)/i.test(tx);
      const entra = /(\bhe fichado|\bfich[eé]\b|\bhe clausulado|\bclausul[eé]\b|\bhe comprado|\bcompr[eé]\b|\bme lo he llevado)/i.test(tx);
      if (n.pid && !vendidos[n.pid] && /hecho/.test(n.tipo || '') && sale && !entra && n.t && ahora - n.t < 4 * DIA && !(comprados[n.pid] > n.t - HORA)) vendidos[n.pid] = { t: n.t, como: 'me contaste que ya lo vendiste' };
    }
  }
  // la plantilla de la API tarda en enterarse de un fichaje: si la actividad de los últimos días dice que un jugador ha
  // cambiado de dueño después (lo ha fichado o clausulado otro, o lo han vendido a LaLiga), manda la actividad. Antes
  // proponía clausular a uno que ya era tuyo o que acababa de fichar otro (pendiente de la revisión del 23 oct)
  M.recienCambiado = {};
  {
    const ult = {};
    for (const a of D.actividad || []) if (a.pid && a.t && ahora - a.t < 4 * DIA && ['compra', 'clausula', 'venta'].includes(a.clase) && (!ult[a.pid] || a.t > ult[a.pid].t)) ult[a.pid] = a;
    for (const [pid, a] of Object.entries(ult)) {
      const q = M.teamDeUsuario(a.quienId, a.quien);
      if (!q) continue;
      const nuevo = a.clase === 'venta' ? (a.otroId || a.otro ? M.teamDeUsuario(a.otroId, a.otro) : null) : q;
      if (a.clase === 'venta' && (a.otroId || a.otro) && !nuevo) continue;
      if ((M.dueno[pid] || null) === (nuevo || null)) continue;
      // (si quien sale en la actividad no es el dueño que dice la plantilla, la plantilla va por detrás)
      if (a.clase === 'venta' && M.dueno[pid] !== q) continue;
      M.recienCambiado[pid] = { de: M.dueno[pid] || null, a: nuevo, t: a.t, clase: a.clase };
      if (nuevo) M.dueno[pid] = nuevo; else delete M.dueno[pid];
    }
  }
  const enMiPlantilla = new Set(((D.plantillas || {})[yoTid] || []).map((f) => f.pid));
  M.vendidos = Object.entries(vendidos).map(([pid, v]) => ({ pid, ...v, j: J(pid), seguiaEnLaApi: enMiPlantilla.has(pid) })).sort((a, b) => b.t - a.t);
  for (const v of M.vendidos) if (M.dueno[v.pid] === yoTid) { if (v.aTid) M.dueno[v.pid] = v.aTid; else delete M.dueno[v.pid]; }

  /* ---------- forma reciente (de la ficha de cada jugador, si se ha bajado) ---------- */
  const det = extra.det || {};
  /** lo que valía un jugador en un momento (de su ficha si se ha bajado; si no, de lo que se ha ido guardando) */
  const valorEn = (pid, t) => {
    const dv = det[pid] && det[pid].valores;
    let v = null;
    if (dv && dv.length) for (const [tt, vv] of dv) { if (tt <= t) v = vv; else break; }
    if (v == null) { const d = diaDe(t); for (const [dd, vv] of (H.v && H.v[pid]) || []) { if (dd <= d) v = vv; else break; } }
    if (v == null && ahora - t < 2 * DIA) v = J(pid).valor;
    return v;
  };
  /** lo más que ha valido desde t (con lo que se sabe: su ficha y el histórico de la app) */
  const maxValorDesde = (pid, t) => {
    let m = J(pid).valor || 0;
    for (const [tt, vv] of (det[pid] && det[pid].valores) || []) if (tt >= t && vv > m) m = vv;
    const d = diaDe(t);
    for (const [dd, vv] of (H.v && H.v[pid]) || []) if (dd >= d && vv > m) m = vv;
    return m;
  };
  /* (0.7.13u, Carlos 16 nov: «los top o los que suben mucho se pagan bastante por encima de la media») cómo venía un
     jugador en un momento: lo que subía al día en los 3 días de antes (en tanto por uno), con su ficha y el histórico de
     la app, sin fiarse de un valor de hace más de un día del que toca. null si no hay valores de esos días */
  const cacheSerie = {};
  const serieDe = (pid) => {
    if (cacheSerie[pid]) return cacheSerie[pid];
    const porDia = new Map((H.v && H.v[pid]) || []);
    for (const [tt, vv] of (det[pid] && det[pid].valores) || []) if (vv) porDia.set(diaDe(tt), vv);
    return (cacheSerie[pid] = porDia);
  };
  const valorDia = (pid, d, margen) => { const S = serieDe(pid); for (let k = 0; k <= margen; k++) { const x = S.get(otroDia(d, -k)); if (x) return x; } return null; };
  M.subidaEn = (pid, t = ahora) => {
    const d = diaDe(t);
    const v0 = ahora - t < 2 * HORA ? J(pid).valor : valorDia(pid, d, 1);
    if (!v0) return null;
    for (const n of [3, 2, 1]) { const vn = valorDia(pid, otroDia(d, -n), 0); if (vn) return clamp(Math.pow(v0 / vn, 1 / n) - 1, -0.2, 0.3); }
    return null;
  };
  // los top: los 30 que más valen de LaLiga (y como poco 25 M)
  {
    const vs = Object.values(D.maestro || {}).map((j) => num(j.valor)).filter((v) => v > 0).sort((a, b) => b - a);
    M.corteTop = Math.max(25e6, vs[Math.min(vs.length - 1, 29)] || 0);
  }
  /** cómo viene un jugador ahora, para comparar con las compras de la liga: { r (subida al día), top } */
  M.perfilPuja = (pid) => ({ r: M.subidaEn(pid), top: num(J(pid).valor) >= M.corteTop });

  /* LaLiga sube sola la cláusula cuando el valor del jugador la pasa: la pone igual que el valor (confirmado por Carlos).
     Eso no lo ha pagado nadie. Una subida de cláusula vista entre dos cargas solo cuenta como pagada si la cláusula queda
     por encima de lo que vale (más de un 2 %) */
  const autoClausula = (m) => {
    if (m.auto) return true;
    const v = m.vA || valorEn(m.pid, m.t);
    return !!(v && m.a <= v * 1.02);
  };
  M.blindaPagada = (m) => m.tipo === 'blinda' && m.a > m.de && !autoClausula(m);
  M.forma = (pid) => {
    const d = det[pid];
    if (!d || !d.stats || !d.stats.length) {
      const sem = (D.maestro[pid] || {}).semanas;
      if (!sem || !sem.length) return null;
      const u = sem.slice(-5);
      return { pts: u.map((x) => x.pts), media: u.reduce((a, x) => a + x.pts, 0) / u.length, jugados: null, de: u.length, min: null };
    }
    const ult = d.stats.slice(-5);
    return { pts: ult.map((x) => x.pts), media: ult.reduce((a, x) => a + x.pts, 0) / ult.length, jugados: ult.filter((x) => x.min > 0).length, de: ult.length, min: ult.reduce((a, x) => a + x.min, 0) };
  };

  /* ---------- tendencias de valor ---------- */
  const cacheT = {}, hoyM = diaDe(ahora);
  /* (21 nov, 00:14, con la liga de Carlos) el valor de ahora es el del último cambio de LaLiga (a las 00:16): con la liga
     bajada antes de medianoche, o entre las 00:00 y el cambio, aún es el de ayer. Contarlo como el de hoy les daba a todos
     un día «a 0» y ponía «estancados» a todos los que suben (Hoy mandaba vender a Berenguer, Giuliano y Huijsen «antes de que
     gire»). Si casi todos los que valen algo valen hoy justo lo mismo que ayer (con la liga bajada a las 23:59, los 882;
     un día normal, un 32 % de todos y menos de los de 2 M o más), los valores son los de ayer: `hoyV` */
  const hoyV = (() => {
    const ayer = otroDia(hoyM, -1);
    let n = 0, igual = 0;
    for (const j of Object.values(D.maestro || {})) {
      if (!(j && j.valor >= 2e6)) continue;
      const s = H.v && H.v[j.id];
      if (!s || !s.length) continue;
      let va = null;
      for (let i = s.length - 1; i >= 0; i--) { if (s[i][0] === ayer) { va = s[i][1]; break; } if (s[i][0] < ayer) break; }
      if (va == null) continue;
      n++;
      if (va === j.valor) igual++;
    }
    return n >= 30 && igual / n >= 0.8 ? ayer : hoyM;
  })();
  M.valoresDe = hoyV;
  M.tend = (pid) => {
    if (cacheT[pid]) return cacheT[pid];
    // el histórico de la app (un valor por cada día que se abrió) y el de LaLiga (el de la ficha, sin huecos) juntos,
    // mandando el de LaLiga. Antes se usaba el más largo: el de la app tiene huecos los días que no se abre, y con uno de
    // esos huecos ayer no había «valor de ayer» y la ficha solo enseñaba lo de 7 días (aviso de Domy, 10 nov)
    let s = (H.v && H.v[pid]) || [];
    const dv = det[pid] && det[pid].valores;
    if (dv && dv.length) {
      const porDia = new Map(s);
      for (const [t, v] of dv) if (v) porDia.set(diaDe(t), v);
      s = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    }
    const ff = (D.tendencias || {})[pid] || {};
    const valor = J(pid).valor;
    // el valor de hace n días, solo si hay un dato de esos días (con margen): con un histórico que acaba en agosto (uno
    // que se fue de LaLiga), «hace 1 día» era el de agosto y salía subiendo 1,2 M hoy (Arriaga, aviso de Domy, 8 nov)
    const hace = (dias, margen) => {
      const objetivo = otroDia(hoyV, -dias), minimo = otroDia(hoyV, -dias - margen);
      let mejor = null;
      for (const [d, v] of s) if (d <= objetivo) mejor = d >= minimo ? v : null;
      return mejor;
    };
    const v1 = hace(1, 1), v7 = hace(7, 3), v30 = hace(30, 7);
    // lo de hoy, con el histórico si lo hay (va con el mismo valor que se enseña); la página de mercado de fuera, solo
    // si no: de madrugada puede traer aún las subidas de ayer o no traer a alguno (Aubameyang, mismo aviso)
    const d1 = v1 ? valor - v1 : ff.d1 != null ? ff.d1 : null;
    const p1 = v1 ? (valor / v1 - 1) * 100 : ff.p1 != null ? ff.p1 : null;
    const d7 = v7 ? valor - v7 : ff.d7 != null ? ff.d7 : null;
    const p7 = v7 ? (valor / v7 - 1) * 100 : ff.p7 != null ? ff.p7 : null;
    const serie = s.map(([d, v]) => [mediodia(d), v]);
    // lo que ha subido cada uno de los últimos días y, si lleva 2 o más días subiendo (más de un 0,4 % cada uno), el
    // ritmo de esos días (como mucho los 3 últimos, rebajado un 10 %). La de 7 días lleva dentro los días de bajada
    // de antes: con el que empezó a subir hace 2 o 3 días decía «baja» y lo dejaba fuera (0.7n, el caso De Jong).
    // `p7e` y `diaE` son la tendencia de la semana y la subida diaria con eso en cuenta
    const ult9 = ultimosDias(s, valor);
    const sub = valor ? subidasDe(ult9) : [];
    let racha = 0; for (let i = sub.length - 1; i >= 0 && sub[i] > 0.004; i--) racha++;
    const rRec = racha >= 2 ? (sub.slice(-Math.min(racha, 3)).reduce((a, x) => a + x, 0) / Math.min(racha, 3)) * 0.9 : null;
    const p7e = rRec != null ? Math.max(p7 != null ? p7 : -Infinity, rRec * 7 * 100) : p7;
    const diaE = rRec != null ? Math.max(d7 != null ? d7 / 7 : -Infinity, valor * rRec) : null;
    return (cacheT[pid] = { d1, p1, d7, p7, p7e, diaE, sub, racha, rRec, d30: v30 ? valor - v30 : null, serie, dias: s, ult9 });
  };
  /** al llegar el histórico de LaLiga de un jugador (al abrir su ficha), que su tendencia se vuelva a calcular con él */
  M.olvidarTend = (pid) => { delete cacheT[pid]; };
  // lo que ha subido cada uno de los últimos días (en tanto por uno), del más viejo al de hoy (con el valor de ahora)
  // los 9 últimos días con valor (el de hoy, el que hay ahora), del más viejo al de hoy. Una vez por jugador para la
  // tendencia y la inercia, con los días tal cual: pasar cada uno a hora y de vuelta a día era lo que más pesaba de la
  // pasada (revisión total, M7)
  function ultimosDias(dias, valor) {
    const L = dias || [];
    // (el histórico va por días y en orden: basta con la cola; si no, entero)
    let enOrden = true;
    for (let i = 1; i < L.length && enOrden; i++) if (!(L[i - 1][0] < L[i][0])) enOrden = false;
    const porDia = new Map();
    for (const [d, x] of enOrden && L.length > 20 ? L.slice(-20) : L) if (x && d <= hoyV) porDia.set(d, x);
    porDia.set(hoyV, valor);
    return [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-9);
  }
  function subidasDe(ult9) {
    const d = ult9.slice(-8).map(([, x]) => x);
    const r = [];
    for (let i = 1; i < d.length; i++) r.push(d[i] / d[i - 1] - 1);
    return r;
  }
  // VUELVE: uno que valía mucho más esta temporada, se hundió (lesión, sin jugar) y ahora juega otra vez y sube varios
  // días seguidos. Es el chollo más claro para revender: le queda muchísimo recorrido y la subida no se frena enseguida.
  // Lo pidió Carlos el 7 nov: De Jong, de 44,5 M en julio a 5,6 M, sumando minutos y subiendo un 5 % al día a 9 M, y el
  // plan no lo propuso (la jornada estaba en juego y especular estaba apagado entero). Desde la 0.7n se mira antes que
  // la inercia: mientras vuelve y sigue subiendo, ni la ficha, ni la salida, ni el plan lo tratan como uno que se frena
  const cacheV = {};
  M.vuelve = (pid) => {
    if (cacheV[pid] !== undefined) return cacheV[pid];
    const j = J(pid), t = M.tend(pid);
    if (!j.valor) return (cacheV[pid] = null);
    const serie = (t.serie || []).map(([, x]) => x).filter(Boolean);
    if (serie.length < 10) return (cacheV[pid] = null);
    const max = Math.max(...serie);
    if (max < j.valor * 2) return (cacheV[pid] = null);
    const sub = t.sub || [];
    if (t.racha < 3) return (cacheV[pid] = null);
    const ritmo = sub.slice(-3).reduce((s, x) => s + x, 0) / 3;
    if (ritmo < 0.012) return (cacheV[pid] = null);
    // que esté jugando otra vez (si hay ficha con minutos): minutos en alguna de las 2 últimas jornadas
    const st = det[j.id] && det[j.id].stats;
    if (st && st.length && !st.slice(-2).some((x) => x.min >= 20)) return (cacheV[pid] = null);
    return (cacheV[pid] = { max, racha: t.racha, ritmo, techo: max / j.valor });
  };

  /* ---------- el partido que acaba de jugar ---------- */
  // Lo que cambia su valor los días siguientes por los puntos que ha hecho, por encima de lo que diga la inercia. Medido
  // con la liga de Carlos (1.672 jugador-jornadas de la J4 a la J12, claude/medida-ia-2026-11-20.md): tras 10 puntos o más,
  // +5,5 puntos porcentuales en 3 días; tras 1 o menos, −1,6; y más si venía subiendo (el que sube y hace 1, −3,2 en 3 días
  // y −10 en 7; el que sube y hace 10, +7,2 y +20). El día del partido (con sus puntos del directo o de la jornada, ya
  // acabado) y el día siguiente, con lo que queda (el primer cambio de valor no se lo lleva todo). Por cómo venía (lo que
  // subió los 3 días antes del partido: más de un 3 %, sube; menos de −3 %, baja) y sus puntos: [3 días, 7 días] el día del
  // partido y [2, 6] el siguiente, en tanto por uno
  const cachePart = {};
  function efectoPartido(pid, j, t) {
    if (pid in cachePart) return cachePart[pid];
    if (!j || !j.pos || j.pos > 4 || !j.valor) return (cachePart[pid] = null);
    const ayer = otroDia(hoyV, -1);
    const partidoDe = (n) => (D.partidos || []).find((p) => Number(p.jornada) === Number(n) && p.fecha && (p.localId === j.equipoId || p.visitanteId === j.equipoId)) || null;
    let pts = null, p = null;
    // el del directo, si su partido ya ha acabado (con un partido ya acabado salen sus puntos)
    const vivo = M.vivo && M.vivo.puntos ? M.vivo.puntos[pid] : null;
    if (vivo != null && M.vivo.n != null) { const q = partidoDe(M.vivo.n); if (q && q.fecha + 2 * HORA <= ahora) { pts = num(vivo); p = q; } }
    if (pts == null) {
      const s = [...(j.semanas || [])].filter((w) => w.pts != null).sort((a, b) => b.n - a.n)[0];
      const q = s ? partidoDe(s.n) : null;
      if (q && q.fecha + 2 * HORA <= ahora) { pts = num(s.pts); p = q; }
    }
    if (!p) return (cachePart[pid] = null);
    const dP = diaDe(p.fecha);
    const etapa = dP === hoyV ? 0 : dP === ayer ? 1 : null;
    if (etapa == null) return (cachePart[pid] = null);
    // cómo venía: su valor el día del partido frente al de 3 días antes
    const porDia = new Map(t.dias || []);
    const vP = etapa === 0 ? j.valor : porDia.get(dP), v3 = porDia.get(otroDia(dP, -3));
    if (!vP || !v3) return (cachePart[pid] = null);
    const como = comoVenia(vP / v3 - 1);
    const { e3: c, e7: l } = efectoTras(pts, como, j.valor, etapa), kc = etapa === 0 ? 3 : 2, kl = etapa === 0 ? 7 : 6;
    const f = (k) => (k <= kc ? (c * k) / kc : k <= kl ? c + ((l - c) * (k - kc)) / (kl - kc) : l);
    return (cachePart[pid] = { pts, n: Number(p.jornada), fecha: p.fecha, como, etapa, e3: c, e7: l, f, vivo: vivo != null && pts === num(vivo) });
  }
  M.efectoPartido = (pid) => efectoPartido(pid, J(pid), M.tend(pid));
  /** (24 nov) el último partido que ha jugado (de los 6 últimos días, con el valor de `hoyV`) si fue malo (4 puntos o
      menos): lo que frena su subida (`frenoTras`), para `proyectar`. { pts, n, s, e } o null. Como en la medida, el último
      en el que sale con puntos (el del directo, si su partido ya ha acabado) */
  const cacheMal = {};
  M.malPartido = (pid) => {
    if (pid in cacheMal) return cacheMal[pid];
    const j = J(pid);
    if (!j || !j.pos || j.pos > 4 || !j.valor) return (cacheMal[pid] = null);
    const partidoDe = (n) => (D.partidos || []).find((p) => Number(p.jornada) === Number(n) && p.fecha && (p.localId === j.equipoId || p.visitanteId === j.equipoId)) || null;
    let pts = null, p = null;
    const vivo = M.vivo && M.vivo.puntos ? M.vivo.puntos[pid] : null;
    if (vivo != null && M.vivo.n != null) { const q = partidoDe(M.vivo.n); if (q && q.fecha + 2 * HORA <= ahora) { pts = num(vivo); p = q; } }
    if (pts == null) {
      const w = [...(j.semanas || [])].filter((x) => x.pts != null).sort((a, b) => b.n - a.n)[0];
      const q = w ? partidoDe(w.n) : null;
      if (q && q.fecha + 2 * HORA <= ahora) { pts = num(w.pts); p = q; }
    }
    if (!p) return (cacheMal[pid] = null);
    const s = Math.round((mediodia(hoyV) - mediodia(diaDe(p.fecha))) / DIA);
    const e = frenoTras(pts, s);
    return (cacheMal[pid] = e ? { pts, n: Number(p.jornada), s, e } : null);
  };
  /** lo que hay que ofrecerle a su dueño para que te venda a uno (ofertaDueno), para el árbitro y el chat */
  M.ofertaDuenoDe = (j) => (j ? ofertaDueno(M, j, M.tend(j.id) || {}) : null);

  /* ---------- la inercia del valor: si sube cada vez menos va a girar, y si ya ha girado hay que vender ---------- */
  // Con lo que ha cambiado su valor cada día (hasta los últimos 7). Si sube 1 M, luego 800 mil y luego 500 mil, se
  // está frenando: con lo que se frena cada día se calcula cuándo deja de subir. Si después de varios días subiendo
  // se para o ya baja, ha girado: lo normal es que siga bajando unos días, así que se vende antes de perder más.
  const cacheI = {};
  M.inercia = (pid) => {
    if (cacheI[pid] !== undefined) return cacheI[pid];
    const j = J(pid), t = M.tend(pid);
    if (!j.valor) return (cacheI[pid] = null);
    // un valor por día (el de hoy, el que hay ahora)
    const dias = t.ult9 || ultimosDias(t.dias, j.valor);
    const R = [], F = [];
    for (let i = 1; i < dias.length; i++) {
      const gap = Math.round((mediodia(dias[i][0]) - mediodia(dias[i - 1][0])) / DIA);
      if (gap < 1 || gap > 3) { R.length = 0; F.length = 0; continue; }
      R.push((dias[i][1] - dias[i - 1][1]) / gap); F.push(dias[i][0]);
    }
    // si hoy aún no se ha guardado el cambio y futbolfantasy lo da, se usa
    const ff = (D.tendencias || {})[pid];
    if (ff && ff.d1 != null && hoyV === hoyM && F[F.length - 1] !== hoyM) { R.push(ff.d1); F.push(hoyM); }
    if (R.length < 3) return (cacheI[pid] = null);
    const Rs = R.slice(-7), v = j.valor;
    const n = Rs.length, ult = Rs[n - 1], pen = Rs[n - 2];
    // por debajo de esto se considera que no se mueve
    const quieto = Math.max(25000, v * 0.0012);
    let subia = 0; for (let i = n - 2; i >= 0 && Rs[i] > quieto; i--) subia++;
    let baja = 0; for (let i = n - 1; i >= 0 && Rs[i] < -quieto; i--) baja++;
    // lo que cambia la subida cada día (pendiente de los últimos 4 cambios)
    const u4 = Rs.slice(-4), mx = (u4.length - 1) / 2, my = u4.reduce((s, x) => s + x, 0) / u4.length;
    const pend = u4.reduce((s, x, i) => s + (i - mx) * (x - my), 0) / Math.max(1e-9, u4.reduce((s, x, i) => s + (i - mx) ** 2, 0));
    let fase = 'plano', giroEn = null, frenazo = null;
    // antes de empezar a bajar, ¿venía subiendo? (puede haber uno o dos días quieto entre medias)
    const antes = Rs.slice(0, n - Math.max(baja, 1));
    const subioAntes = antes.slice(-5).filter((x) => x > quieto).length >= 2 && antes.slice(-5).reduce((s0, x) => s0 + x, 0) > 2 * quieto;
    if (ult < -quieto && (subia >= 2 || (subioAntes && baja <= 3))) fase = 'giro';   // venía subiendo y ya baja
    else if (ult < -quieto) fase = 'baja';
    else if (Math.abs(ult) <= quieto && subia >= 2 && Rs.slice(n - 1 - subia, n - 1).reduce((t, x) => t + x, 0) >= v * 0.02) fase = 'parado';      // se ha estancado después de subir (de verdad: un 2 % o más)
    else if (ult > quieto) {
      const u3 = Rs.slice(-3);
      const frena = u3.every((x) => x > 0) && u3[2] < u3[1] && u3[1] <= u3[0] && u3[2] < u3[0] * 0.8;
      // cuánto se frena cada día desde el pico (pesa más lo último: si el frenazo se acelera, gira antes)
      const fr = 0.6 * (u3[2] - u3[1]) + 0.4 * (u3[1] - u3[0]);
      if (frena && fr < 0) { fase = 'frena'; frenazo = fr; giroEn = ult / -fr; }
      else fase = Rs.slice(-3).every((x) => x > quieto) && pend >= 0 ? 'acelera' : 'sube';
    }
    // lo de las últimas semanas: si viene de bajar mucho y la «subida» de estos días es un rebote pequeño (menos de
    // un 30 % de lo que había caído), que se pare o se frene no es girar: no hay una subida que se dé la vuelta.
    // Puede estar tocando fondo o seguir bajando, así que eso solo no es motivo para venderlo
    let rebote = null;
    {
      const mes = (t.serie || []).filter(([ts]) => ts >= ahora - 35 * DIA).map(([, x]) => x).filter(Boolean);
      mes.push(v);
      if (mes.length >= 10) {
        let iMax = 0;
        mes.forEach((x, i) => { if (x > mes[iMax]) iMax = i; });
        const max = mes[iMax], min = Math.min(...mes.slice(iMax));
        if (max - min >= v * 0.08 && v - min < (max - min) * 0.3 && iMax <= mes.length - 6) rebote = { max, min, caida: (max - min) / max };
      }
    }
    if (rebote && (fase === 'parado' || fase === 'frena')) { fase = 'rebote'; giroEn = null; frenazo = null; }
    // el que vuelve (se hundió y ahora juega y sube varios días seguidos): aunque un día suba algo menos que el
    // anterior, no se está frenando de verdad, le queda mucho para su valor de antes. Mientras siga subiendo, 'sube'
    // (0.7n: la ficha decía «No es momento de comprarlo» y el plan lo podía mandar vender)
    const vu = M.vuelve(pid);
    let frenaba = false;
    if (vu && ult > quieto && ['frena', 'parado', 'rebote'].includes(fase)) { frenaba = fase === 'frena'; fase = 'sube'; giroEn = null; frenazo = null; }
    // lo que se espera los próximos días: el frenazo sigue al mismo ritmo, la bajada se suaviza poco a poco
    const hastaJ = M.proxima ? clamp(Math.ceil((M.proxima.ini - ahora) / DIA), 1, 7) : 3;
    // (21 nov, medido con la liga de Carlos en 20.718 jugador-días: claude/medida-ia-2026-11-20.md) lo que se pierde de
    // ritmo cada día, ajustado a la vez a 3, 7 y 14 días: el que sube pierde un 5 % (antes un 20 %: se esperaba la mitad de
    // lo que subía), el que acelera un 4 % y el que ha girado un 6 %; el que baja, el 10 % de siempre. El que «se frena» no
    // gira: sigue subiendo, cada vez menos (un 14 % al día); con el giro a ese ritmo se esperaban −140 mil en 7 días y
    // fueron +1,5 M
    const RITMO = { sube: 0.95, acelera: 0.96, frena: 0.86, giro: 0.94, baja: 0.9 };
    // (24 nov, Fran: «la app sigue sin entender las tendencias»; medido con el valor público de 373 jugadores en 58 días,
    // 16.862 jugador-días: .github/ia/medir-inercia-publico.mjs y claude/medida-tendencias-24nov.md) EL PRIMER DÍA DE UN
    // GIRO se quedaba corto a la mitad: ese día el jugador acaba de cruzar el cero (−0,6 % de media) y los siguientes baja
    // un 1,1-1,2 % cada día; se esperaba −3,4 % en 7 días y fueron −7,4 % (el 87 % bajó). El ritmo del primer día es lo de
    // hoy más el 70 % de lo que se ha frenado desde ayer, sin pasar de un 2 % al día: el error a 3 días baja de 2,1 a 1,4
    // puntos y a 7 de 5,4 a 3,9, sin sesgo. Desde el segundo día de bajada ya se acertaba (sesgo de +0,2 y −0,2): igual
    const r0 = fase === 'giro' && baja === 1 && pen > ult ? Math.max(ult + 0.7 * (ult - pen), Math.min(ult, -0.02 * v)) : ult;
    const proy = (k) => {
      let x = 0, r = fase === 'giro' ? r0 / RITMO.giro : ult;
      for (let i = 1; i <= k; i++) {
        // (cada día baja un poco más, pero no sin fin: con el ruido de los datos la pendiente salía disparada y un
        // −23 mil de hoy se proyectaba en −929 mil hasta la jornada)
        if (fase === 'parado') r = Math.max(r + Math.min(frenazo != null ? frenazo : pend, -quieto * 0.6), -Math.max(quieto, v * 0.006));
        // (el que vuelve se frena más despacio, como en Especular)
        else r = r * (RITMO[fase] || (vu ? 0.92 : 0.8));
        x += r;
      }
      return x;
    };
    // (21 nov, Carlos: «Berenguer venía de subir una barbaridad y ha hecho un punto: se va a estancar», y «si uno hace
    // muchísimos puntos… que te salga cláusulalo ya») el partido que acaba de jugar: lo que se espera de más (o de menos)
    // por sus puntos, por encima de la inercia
    const ef = efectoPartido(pid, j, t);
    // (un mal partido frena al que sube, pero no le da la vuelta: el que venía subiendo y hace 1 punto sube de media un
    // 40-55 % de lo que esperaba la inercia, no baja; así que lo de menos no pasa del 60 % de lo que se esperaba que subiera)
    const proyP = ef ? (k) => { const p0 = proy(k), e = v * ef.f(k); return p0 + (e < 0 && p0 > 0 ? Math.max(e, -0.6 * p0) : e); } : proy;
    const subida = (subia >= 2 ? Rs.slice(Math.max(0, n - 1 - subia), n - 1) : antes.slice(-5)).filter((r) => r > quieto);
    // (19 nov, sesión larga) el texto, aparte (inercia-texto.js): aquí solo las cuentas
    const texto = textoInercia({ fase, Rs, ult, subida, baja, giroEn, rebote, quieto, hastaJ, perdidaJ: proyP(hastaJ), vu, frenaba });
    // (21) `proy(k)`: lo que se espera que cambie su valor en k días, con la misma cuenta (la pestaña Parón la usa hasta la
    // vuelta, que puede quedar a más de los 7 días de `proyJ`)
    return (cacheI[pid] = { R: Rs, dias: F.slice(-7), ult, pend, fase, giroEn, subia, baja, proy3: proyP(3), proyJ: proyP(hastaJ), hastaJ, proy: (k) => proyP(clamp(Math.round(k), 1, 14)), texto, quieto, rebote, vuelve: vu && (fase === 'sube' || fase === 'acelera') ? vu : null, partido: ef });
  };
  // la hora del partido de cada equipo en cada jornada, hecha una vez (M.partidazo se llama con cientos de jugadores
  // desde M.interes)
  let horaPartido = null;
  const horaDe = (n, eqId) => {
    if (!horaPartido) {
      horaPartido = {};
      for (const q of [...(D.partidos || []), ...(D.resultados || [])]) {
        if (!q.fecha) continue;
        for (const id of [q.localId, q.visitanteId]) { const k = `${Number(q.jornada)}|${id}`; if (!(k in horaPartido)) horaPartido[k] = q.fecha; }
      }
    }
    return horaPartido[`${n}|${eqId}`] || null;
  };
  /** un partidazo reciente: 9 puntos o más en un partido de hace menos de 3 días (en juego, los de ahora). Tras uno así
      LaLiga suele subirle el valor los días siguientes, así que una bajada puede frenarse o girar al alza (lo avisó
      Domy el 25 oct: Grimaldo salía «perdiendo valor» la noche que hizo más de 10). Sin caché: los puntos en directo
      entran sin rehacer el motor */
  M.partidazo = (pid) => {
    const j = J(pid);
    if (!j || !j.pos || j.pos > 4) return null;
    const vivo = M.puntosVivo ? M.puntosVivo(pid) : null;
    let n = null, pts = null;
    if (vivo != null && M.enJuego) { n = M.enJuego.n; pts = vivo; }
    else { const s = [...(j.semanas || [])].filter((w) => w.pts != null).sort((a, b) => b.n - a.n)[0]; if (s) { n = s.n; pts = s.pts; } }
    if (n == null || pts == null || pts < 6) return null;
    const jo = (M.jornadas || []).find((x) => x.n === n);
    const fue = horaDe(n, j.equipoId) || (jo ? jo.ini : null);
    const ahoraP = Date.now();
    if (!(fue && fue <= ahoraP && ahoraP - fue < 3 * DIA)) return null;
    // por escalones (lo pidió Carlos el 25 oct): 6-7 un buen partido (solo se avisa), 8-9 muy bueno (no se manda
    // vender con prisa), 10 o más un partidazo (no se manda vender por la bajada)
    return { pts, n, nivel: pts >= 10 ? 3 : pts >= 8 ? 2 : 1 };
  };
  /** ¿hay que venderlo ya por la inercia? (ha girado o se ha parado tras subir, o está a punto) */
  /** lo más alto y lo más bajo que ha valido esta temporada (el histórico desde julio): cuánto margen le queda para bajar */
  const cacheRango = {};
  M.rango = (pid) => {
    if (pid in cacheRango) return cacheRango[pid];
    const t = M.tend(pid), j = J(pid);
    const vs = ((t && t.dias) || []).map((x) => +x[1]).filter((v) => v > 0);
    if (j && j.valor) vs.push(j.valor);
    return (cacheRango[pid] = vs.length >= 5 ? { min: Math.min(...vs), max: Math.max(...vs) } : null);
  };
  /** si baja todos los días (Carlos, 14 nov): 3 o más días seguidos bajando. { dias, p7, min, max } o null */
  M.bajaSeguido = (pid) => {
    const t = M.tend(pid);
    if (!t || !Array.isArray(t.sub) || !t.sub.length) return null;
    // (24 nov, Carlos con Thiago: seis días bajando con un +0,15 % en medio, «me debía decir que lo vendiese») un día
    // casi plano en medio (menos de un 0,25 % arriba o abajo; dos como mucho) no corta la racha, pero hoy tiene que bajar
    let dias = 0, planos = 0;
    for (let i = t.sub.length - 1; i >= 0; i--) {
      const x = t.sub[i];
      if (x < -0.001) dias++;
      else if (i < t.sub.length - 1 && x < 0.0025 && planos < 2 && dias) planos++;
      else break;
    }
    return dias >= 3 ? { dias, planos, p7: t.p7, ...(M.rango(pid) || {}) } : null;
  };
  M.ventaPorInercia = (pid) => {
    // (22 nov) «a este no lo vendo», dicho en Pregunta: ni por la inercia
    if (M.noVender.has(pid)) return null;
    const x = M.inercia(pid);
    if (!x) return null;
    // tras un partidazo (10 o más) no se manda vender por la bajada: lo normal es que mañana suba; tras uno muy bueno
    // (8-9), sin prisa: «antes del giro» en vez de «ya»
    const pz = M.partidazo(pid), nivel = pz ? pz.nivel : 0;
    if (nivel >= 3 && ['giro', 'baja', 'parado', 'frena'].includes(x.fase)) return null;
    const j = J(pid), perder = -x.proyJ;
    // (24 nov, Carlos: «no me puedo creer que no me recomiende vender a ninguno… el defensa del Depor, que ni jugó») el
    // corte en euros era 150 mil para todos: uno de 1,6 M que baja 26 mil al día nunca llegaba (pierde ~100 mil, un 6 %).
    // Ahora, un 3 % de lo que vale (40 mil como poco, 150 mil como mucho) o el 1,2 % de siempre en los caros
    const umbral = Math.max(j.valor * 0.012, Math.min(150000, Math.max(40000, j.valor * 0.03)));
    if ((x.fase === 'giro' || x.fase === 'baja') && perder >= umbral) return { urgencia: nivel >= 2 ? 'antes del giro' : 'ya', ...x, perder };
    // (21 nov, medido: el que se frena y «gira» en 2 días o menos subió +265 mil de media en los 3 días siguientes y se
    // quedó igual a los 7: venderlo ese día es venderlo antes de tiempo. Se vende cuando gira de verdad)
    if (x.fase === 'parado') return { urgencia: 'antes del giro', ...x, perder: Math.max(0, perder) };
    return null;
  };

  /* ---------- jornada, partidos y parones ---------- */
  const porJornada = {};
  for (const p of D.partidos || []) if (p.fecha) (porJornada[p.jornada] ||= []).push(p);
  // la jornada es su bloque de fechas: los partidos se agrupan cuando entre uno y el siguiente hay 3 días o menos, y
  // manda el grupo con más partidos. Lo de antes del bloque va a «adelantados» y lo de después a «aplazados», y
  // ninguno alarga la jornada ni mueve su inicio (ni el cierre de cláusulas, que cuelga de él). Antes se tomaba el
  // primer partido como inicio: con un adelantado, el bloque entero pasaba a aplazados y el cierre caía días antes
  // (revisión total, M6). Un aplazado tampoco deja la jornada «en juego» semanas (lo avisó Carlos el 25 oct)
  const bloqueDe = (ps) => {
    const o = [...ps].sort((a, b) => a.fecha - b.fecha), grupos = [[o[0]]];
    for (let i = 1; i < o.length; i++) {
      if (o[i].fecha - o[i - 1].fecha > 3 * DIA) grupos.push([]);
      grupos[grupos.length - 1].push(o[i]);
    }
    let k = 0;
    for (let i = 1; i < grupos.length; i++) if (grupos[i].length > grupos[k].length) k = i;
    return { bloque: grupos[k], antes: grupos.slice(0, k).flat(), despues: grupos.slice(k + 1).flat() };
  };
  const jornadas = Object.entries(porJornada).map(([n, ps]) => {
    const { bloque, antes, despues } = bloqueDe(ps);
    return { n: +n, ini: bloque[0].fecha, fin: bloque[bloque.length - 1].fecha + 2 * HORA, partidos: ps, adelantados: antes, aplazados: despues };
  }).sort((a, b) => a.ini - b.ini);
  M.jornadas = jornadas;
  // si dos se solapan (una jornada entre semana pegada a otra), manda la última que ha empezado
  M.enJuego = [...jornadas].reverse().find((j) => j.ini <= ahora && ahora <= j.fin) || null;
  M.proxima = jornadas.find((j) => j.ini > ahora) || null;
  // (los puntos del directo, ya aquí: la inercia los usa para el partido que acaba de jugar; abajo, M.ponerVivo)
  M.vivo = extra.vivo && M.enJuego && extra.vivo.n === M.enJuego.n ? extra.vivo : null;
  // el cierre de cláusulas: LaLiga no deja clausular a nadie en las 24 h antes del primer partido de cada jornada; se
  // reabren justo a la hora de ese primer partido
  M.VEDA_H = 24;
  M.vedas = jornadas.map((j) => ({ n: j.n, ini: j.ini - M.VEDA_H * HORA, fin: j.ini }));
  const vedaEn = (t) => M.vedas.find((v) => t >= v.ini && t < v.fin) || null;
  M.vedaAhora = vedaEn(ahora);
  /** si una cláusula que LaLiga deja de proteger en t cae en el cierre de una jornada: cuál y cuándo se puede pagar */
  M.vedaDe = (t) => {
    let x = Math.max(t || 0, ahora), v = vedaEn(x), primera = v;
    while (v) { x = v.fin; v = vedaEn(x); }
    return primera ? { n: primera.n, cierra: primera.ini, abre: x } : null;
  };
  // la liga de ejemplo tiene su propio calendario (con su parón entre la 12 y la 13): los parones reales no casan con él
  const PAR = D.demo ? [] : PARONES;
  const parones = [...PAR];
  for (let i = 1; i < jornadas.length; i++) {
    const a = jornadas[i - 1], b = jornadas[i];
    if (b.ini - a.fin > 9 * DIA && !parones.some((p) => p.ini < b.ini && p.fin > a.fin)) parones.push({ ini: a.fin, fin: b.ini, nombre: 'Parón de selecciones', delCalendario: true });
  }
  // (0.7.12) la recompensa diaria: 100 mil por día, y 2 de 100 mil en los parones (Carlos, 14 nov). Para los días de
  // parón vale todo el hueco entre jornadas (más de 9 días sin partidos), no solo las fechas FIFA de PARONES
  const huecos = [...PAR];
  for (let i = 1; i < jornadas.length; i++) { const a = jornadas[i - 1], b = jornadas[i]; if (b.ini - a.fin > 9 * DIA) huecos.push({ ini: a.fin, fin: b.ini }); }
  const enHueco = (t) => huecos.some((p) => t >= p.ini && t < p.fin);
  // (26 nov) en una liga premium son 200 mil (LaLiga, «La Recompensa Diaria aterriza en LALIGA FANTASY», 16 dic 2025)
  M.RECOMPENSA = M.premium.liga ? 0.2e6 : 0.1e6;
  /** la recompensa diaria de un día (lo que da LaLiga si la coges): el doble en un parón */
  M.recompensaDia = (t) => (enHueco(t) ? 2 : 1) * M.RECOMPENSA;
  /** lo que suman las recompensas diarias entre dos momentos (cada día con la suya; el trozo del final, en proporción) */
  M.recompensas = (t0, t1) => {
    if (!t0 || !t1 || t1 <= t0) return 0;
    let x = 0, t = t0;
    for (; t + DIA <= t1; t += DIA) x += M.recompensaDia(t + DIA / 2);
    return x + ((t1 - t) / DIA) * M.recompensaDia((t + t1) / 2);
  };
  M.paron = parones.filter((p) => p.fin > ahora).sort((a, b) => a.ini - b.ini)[0] || null;
  M.enParon = !!(M.paron && M.paron.ini <= ahora);
  // los partidos por fecha, no por jornada: un aplazado de una jornada pasada (o de la que se juega) no se cuela como
  // «próximo partido» delante del de verdad (revisión del 25 oct). Cada equipo, una vez: se llama cientos de veces
  const porFecha = jornadas.flatMap((jo) => jo.partidos.map((p) => ({ p, n: jo.n }))).sort((a, b) => a.p.fecha - b.p.fecha);
  const cacheProx = {};
  M.proximoPartido = (eqId) => {
    if (eqId in cacheProx) return cacheProx[eqId];
    for (const { p } of porFecha) {
      if (p.fecha + 2 * HORA < ahora) continue;
      if (p.localId === eqId) return (cacheProx[eqId] = { ...p, casa: true, rival: p.visitante, rivalId: p.visitanteId });
      if (p.visitanteId === eqId) return (cacheProx[eqId] = { ...p, casa: false, rival: p.local, rivalId: p.localId });
    }
    return (cacheProx[eqId] = null);
  };

  /**
   * la sanción de un jugador. LaLiga solo dice «suspended», sin cuántos partidos (ni la lista de jugadores ni su ficha
   * lo traen). Casi todas son de un partido (cinco amarillas, doble amarilla y la mayoría de las rojas directas), así que
   * se trata como de uno salvo que un dato diga más: que viera una roja (su ficha trae las de cada jornada), no haya
   * vuelto a jugar desde entonces, su equipo ya haya jugado algún partido de liga sin él (hace más de 36 h: LaLiga
   * tarda en quitar la sanción) y siga sancionado. Entonces es larga y cuenta como una baja (la guía de lesionados y
   * sancionados: con una de un partido se aguanta)
   */
  const cacheSancion = {};
  M.sancion = (j) => {
    if (!j || j.estado !== 'suspended') return null;
    if (cacheSancion[j.id]) return cacheSancion[j.id];
    const st = (det[j.id] && det[j.id].stats) || [];
    const ir = st.map((s) => num(s.roja) > 0).lastIndexOf(true);
    const roja = ir >= 0 && !st.slice(ir + 1).some((s) => num(s.min) > 0) ? st[ir].n : null;
    const suyo = (p) => p.localId === j.equipoId || p.visitanteId === j.equipoId;
    // (los partidos tienen fecha; los resultados viejos, no: esos ya se jugaron hace días)
    const fecha = {};
    for (const p of D.partidos || []) if (suyo(p) && p.fecha) fecha[p.jornada] = p.fecha;
    const sin = new Set();
    if (roja != null) {
      for (const p of [...(D.resultados || []), ...(D.partidos || [])]) {
        if (!suyo(p) || !(p.jornada > roja)) continue;
        const f = fecha[p.jornada];
        if (f != null ? f + 2 * HORA < ahora - 36 * HORA : p.gl != null) sin.add(p.jornada);
      }
    }
    const pp = M.proximoPartido(j.equipoId);
    return (cacheSancion[j.id] = { larga: sin.size > 0, roja, sin: sin.size, jornada: pp ? pp.jornada : null, rival: pp ? pp.rival : null });
  };
  /** de baja para venderlo: lesionado, fuera de LaLiga o con una sanción larga (la de un partido se aguanta) */
  M.deBaja = (j) => !!j && MALOS.has(j.estado) && !(j.estado === 'suspended' && !M.sancion(j).larga);
  M.sancionCorta = (j) => !!j && j.estado === 'suspended' && !M.sancion(j).larga;
  /**
   * ¿toca venderlo por estar de baja? Lesionado, fuera de LaLiga o con una sanción larga, sí. Con una sanción de un
   * partido, solo si además su valor cae fuerte (más de un 5 % en 7 días o de un 2 % hoy); si no, se pierde la jornada y
   * se aguanta. Lo demás que hace vender (la inercia, asegurar un beneficio, una buena oferta) va por su lado, como con
   * cualquier otro
   */
  M.vendeBaja = (x) => !!x && !!x.j && !M.noVender.has(x.j.id) && (M.deBaja(x.j) || (M.sancionCorta(x.j) && !!x.tend && ((P7(x.tend) != null && P7(x.tend) < -5) || (x.tend.p1 != null && x.tend.p1 < -2))));
  /** el porqué de venderlo por la baja, para empezar la frase: «Lesionado», «Sancionado más de un partido»… */
  M.bajaTxt = (j) => {
    if (j.estado === 'injured') return 'Lesionado';
    if (j.estado === 'out_of_league') return 'Fuera de LaLiga';
    const s = M.sancion(j);
    return s && s.larga ? `Sancionado para más de un partido (su equipo ya ha jugado ${s.sin === 1 ? 'uno' : s.sin} sin él y sigue sancionado)` : 'Sancionado una jornada';
  };
  /** lo que se dice de una sanción de un partido: se pierde la jornada y se aguanta */
  M.sancionCortaTxt = (j) => {
    const s = M.sancion(j) || {};
    return `Sancionado: se pierde ${s.jornada ? `la jornada ${s.jornada}` : 'la próxima jornada'}${s.rival ? ` (contra ${s.rival})` : ''} y vuelve a la siguiente. Una sanción de un partido no es motivo para venderlo: baja poco y vuelve enseguida, así que se aguanta.`;
  };

  /* ---------- la clasificación de LaLiga y lo difícil que es cada rival ---------- */
  const tabla = {};
  for (const p of [...(D.resultados || [])].sort((a, b) => (a.jornada || 0) - (b.jornada || 0))) {
    for (const [id, gf, gc, rid, casa] of [[p.localId, p.gl, p.gv, p.visitanteId, true], [p.visitanteId, p.gv, p.gl, p.localId, false]]) {
      const t = (tabla[id] ||= { id, pj: 0, pts: 0, gf: 0, gc: 0, ult: [] });
      t.pj++; t.gf += gf; t.gc += gc; t.pts += gf > gc ? 3 : gf === gc ? 1 : 0;
      t.ult.push({ r: gf > gc ? 'V' : gf === gc ? 'E' : 'D', gf, gc, rid, casa, jornada: p.jornada });
    }
  }
  const filas = Object.values(tabla).filter((t) => t.pj > 0).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
  filas.forEach((t, i) => { t.pos = i + 1; t.nombre = (D.equipos[t.id] || {}).nombre || t.id; });
  M.tabla = filas;
  const totPj = filas.reduce((s, t) => s + t.pj, 0);
  const mediaGoles = totPj ? filas.reduce((s, t) => s + t.gf, 0) / totPj : 1.3;
  const mediaPts = totPj ? filas.reduce((s, t) => s + t.pts, 0) / totPj : 1.4;
  M.equipoLiga = (id) => tabla[id] || null;
  /** cómo le va a un equipo: sus últimos partidos (V/E/D, goles) */
  M.racha = (id, n = 5) => {
    const t = tabla[id];
    if (!t || !t.ult.length) return null;
    const u = t.ult.slice(-n);
    return { txt: u.map((x) => x.r).join('-'), gf: u.reduce((s, x) => s + x.gf, 0), gc: u.reduce((s, x) => s + x.gc, 0), pts: u.reduce((s, x) => s + (x.r === 'V' ? 3 : x.r === 'E' ? 1 : 0), 0), de: u.length, ult: u };
  };
  /* ---------- el historial de cada jugador contra quién jugó, y la previa de su próximo partido ---------- */
  const resPor = {};
  for (const p of D.resultados || []) {
    resPor[`${p.jornada}:${p.localId}`] = { rivalId: p.visitanteId, casa: true, gf: p.gl, gc: p.gv };
    resPor[`${p.jornada}:${p.visitanteId}`] = { rivalId: p.localId, casa: false, gf: p.gv, gc: p.gl };
  }
  const nombreEq = (id) => (D.equipos[id] || {}).nombre || id;
  /** sus últimas jornadas: puntos, minutos, rival, en casa o fuera y el resultado */
  M.historial = (j, n = 6) => {
    if (!j) return [];
    const d = det[j.id];
    const base = d && d.stats && d.stats.length ? d.stats : (j.semanas || []).map((w) => ({ n: w.n, pts: w.pts, min: null }));
    return base.slice(-n).map((s) => {
      const r = resPor[`${s.n}:${j.equipoId}`];
      const t = r && tabla[r.rivalId];
      return { ...s, rival: r ? nombreEq(r.rivalId) : null, rivalId: r ? r.rivalId : null, casa: r ? r.casa : null, gf: r ? r.gf : null, gc: r ? r.gc : null, posRival: t ? t.pos : null };
    });
  };
  /** cuánto rinde en casa y fuera, y contra los de arriba y los de abajo de la tabla */
  M.rendimiento = (j) => {
    const h = M.historial(j, 38).filter((x) => x.rivalId && (x.min == null || x.min > 0));
    if (h.length < 3) return null;
    const m = (l) => (l.length ? { m: l.reduce((s, x) => s + x.pts, 0) / l.length, n: l.length } : null);
    const nT = filas.length || 20;
    return { casa: m(h.filter((x) => x.casa)), fuera: m(h.filter((x) => x.casa === false)), arriba: m(h.filter((x) => x.posRival && x.posRival <= 6)), abajo: m(h.filter((x) => x.posRival && x.posRival > nT - 6)) };
  };
  /* ---------- estadísticas avanzadas (Understat y SofaScore) ---------- */
  const av = extra.avanzadas || {};
  M.avanzado = (pid) => { const u = (av.jugadores || {})[pid], s = (av.sofa || {})[pid]; return u || s ? { u: u || null, s: s || null } : null; };
  M.xgEquipo = (id) => (av.equipos || {})[id] || null;
  M.fuentesAv = av.fuentes || null;
  const xgMedia = (() => { const l = Object.values(av.equipos || {}).filter((e) => e.xg != null); return l.length ? l.reduce((s, e) => s + e.xg, 0) / l.length : null; })();

  /** la previa de su próximo partido: cómo llegan los dos equipos, los goles que se esperan y la portería a cero */
  M.previa = (j) => {
    const p = j && M.proximoPartido(j.equipoId);
    if (!p) return null;
    const tu = tabla[j.equipoId], ri = tabla[p.rivalId];
    const out = { p, rival: p.rival, casa: p.casa, posRival: ri ? ri.pos : null, nivel: nivelDe(ri), rachaTu: M.racha(j.equipoId), rachaRi: M.racha(p.rivalId) };
    if (tu && ri && tu.pj >= 3 && ri.pj >= 3) {
      out.golesFavor = (tu.gf / tu.pj) * (ri.gc / ri.pj) / mediaGoles * (p.casa ? 1.1 : 0.9);
      out.golesContra = (ri.gf / ri.pj) * (tu.gc / tu.pj) / mediaGoles * (p.casa ? 0.9 : 1.1);
      out.cero = Math.exp(-out.golesContra);
      out.rivalMarca = ri.gf / ri.pj; out.rivalEncaja = ri.gc / ri.pj;
      // cómo le va al rival jugando donde le toca (fuera si tú juegas en casa)
      // con el xG de Understat (lo que generan y conceden de verdad) si lo hay, que dice más que los goles
      const xt = M.xgEquipo(j.equipoId), xr = M.xgEquipo(p.rivalId);
      if (xt && xr && xgMedia && xt.xg != null && xr.xga != null) {
        out.xg = { tu: xt, ri: xr };
        out.golesFavor = (xt.xg * xr.xga) / xgMedia * (p.casa ? 1.1 : 0.9);
        out.golesContra = (xr.xg * xt.xga) / xgMedia * (p.casa ? 0.9 : 1.1);
        out.cero = Math.exp(-out.golesContra);
      }
      const sitio = ri.ult.filter((x) => x.casa === !p.casa);
      if (sitio.length) out.rivalSitio = { v: sitio.filter((x) => x.r === 'V').length, e: sitio.filter((x) => x.r === 'E').length, d: sitio.filter((x) => x.r === 'D').length, gf: sitio.reduce((s, x) => s + x.gf, 0), gc: sitio.reduce((s, x) => s + x.gc, 0) };
    }
    return out;
  };

  /** los resultados de la última jornada jugada */
  const jUlt = Math.max(0, ...(D.resultados || []).map((p) => p.jornada || 0));
  M.ultimaJornada = jUlt ? { n: jUlt, partidos: (D.resultados || []).filter((p) => p.jornada === jUlt) } : null;
  /**
   * lo que cambia lo que se espera de un jugador según su próximo rival (0,75 a 1,25):
   * porteros y defensas, según lo que marca el rival; medios y delanteros, según lo que encaja; más la fuerza
   * general del rival (puntos por partido) y si juega en casa
   */
  M.factorRival = (j) => {
    const p = j && M.proximoPartido(j.equipoId);
    if (!p) return { f: 1, p: null };
    const r = tabla[p.rivalId];
    if (!r || r.pj < 3) return { f: p.casa ? 1.04 : 0.96, p, nivel: null };
    return { f: fuerzaContra(j.pos, r, p.casa), p, r, nivel: nivelDe(r) };
  };
  // (aviso de Domy, 30 oct: «me recomienda alinear un defensa del Racing jugando contra el Madrid») a porteros y defensas
  // el rival les pesa más que al resto: casi todo lo que puntúan (portería a cero, goles encajados, la nota) depende de
  // lo que les ataquen. Con un rival normal da 1 igual que antes; contra uno que marca mucho baja más (el Madrid de
  // ahora, de 0,84 a 0,77) y el tope de abajo pasa de 0,75 a 0,65
  function fuerzaContra(pos, r, casa) {
    const ataque = r.gf / r.pj / mediaGoles, defensa = r.gc / r.pj / mediaGoles, fuerza = r.pts / r.pj / mediaPts;
    const atras = pos <= 2;
    const base = atras ? 1 / Math.max(0.4, ataque) : defensa;
    let f = (atras ? 0.4 + 0.4 * base : 0.55 + 0.25 * base) + 0.2 / Math.max(0.4, fuerza);
    f *= casa ? 1.05 : 0.95;
    return clamp(f, atras ? 0.65 : 0.75, 1.25);
  }
  function nivelDe(r) {
    if (!r || r.pj < 3) return null;
    const fuerza = r.pts / r.pj / mediaPts;
    return fuerza >= 1.25 || r.pos <= 4 ? 'difícil' : fuerza <= 0.8 || r.pos >= filas.length - 3 ? 'fácil' : 'media';
  }
  /** los próximos partidos de un equipo con lo difícil que es cada rival (para ver rachas) */
  M.calendarioDe = (eqId, n = 3) => {
    const out = [];
    for (const { p, n: jn } of porFecha) {
      if (out.length >= n) break;
      if (p.fecha + 2 * HORA < ahora) continue;
      const casa = p.localId === eqId;
      if (!casa && p.visitanteId !== eqId) continue;
      const rid = casa ? p.visitanteId : p.localId, r = tabla[rid];
      out.push({ jornada: jn, fecha: p.fecha, casa, rival: casa ? p.visitante : p.local, rivalId: rid, pos: r && r.pos, nivel: nivelDe(r) });
    }
    return out;
  };

  /* ---------- dinero ---------- */
  M.misPujas = (D.mercado || []).reduce((s, m) => s + num(m.miPuja), 0);
  M.deuda = Math.floor(num(D.valorEquipo) * num(c.deuda) / 100);
  M.pujaMax = num(D.dinero) + M.deuda - M.misPujas;
  M.negativo = D.dinero != null && D.dinero < 0;

  /* ---------- el dinero de cada rival ---------- */
  // LaLiga solo da el tuyo. El de los demás se reconstruye con los movimientos de la liga desde el principio:
  //   100 M de salida + recompensas diarias + ventas + lo que cobra (traspasos y cláusulas) + premios por jornada
  //   − compras − traspasos y cláusulas que paga − lo que gasta en subir cláusulas
  // En los movimientos de LaLiga: 31 compra al mercado, 33 venta al mercado, 1 traspaso entre managers (paga user1,
  // cobra user2; los clausulazos también salen así), 6 premio de la jornada, 4 escudo (se paga con un anuncio: no
  // cuesta dinero). Lo que no sale:
  //  - las subidas de cláusula (pagar X la sube 2X): se sacan de sus plantillas, comparando la cláusula de ahora con
  //    la que tenía al ficharlo (lo que pagó, o su valor si era más, y nunca menos de 1 M), y de las subidas que se
  //    ven de un día a otro;
  //  - la recompensa diaria (100 mil por día que se coge): en vez de suponerla, la base común se mide con tu saldo
  //    (tu saldo − tus movimientos + tus subidas de cláusula) y el margen cubre la diferencia entre lo que coge cada uno.
  const AH0 = extra.actHist && extra.actHist.lista && extra.actHist.lista.length ? extra.actHist
    : { lista: D.actividad || [], completa: !!D.demo, desde: (D.actividad || []).length ? Math.min(...D.actividad.map((a) => a.t || ahora)) : null };
  const tidDe = (id, nombre) => (id || nombre ? M.teamDeUsuario(id, nombre) : null);
  const idAct = (a) => a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}|${a.importe}`;
  const plantillaDe = (tid) => (D.plantillas || {})[tid] || [];
  // el último fichaje de cada jugador por cada equipo (antes de un momento)
  const fichajes = {};
  for (const a of AH0.lista) {
    if (!a.pid || !a.t || !(a.clase === 'compra' || a.clase === 'clausula')) continue;
    const q = tidDe(a.quienId, a.quien);
    if (q) (fichajes[`${q}|${a.pid}`] ||= []).push(a);
  }
  for (const l of Object.values(fichajes)) l.sort((x, y) => x.t - y.t);
  const fichajeAntes = (tid, pid, t) => { let r = null; for (const a of fichajes[`${tid}|${pid}`] || []) { if (a.t < t) r = a; else break; } return r; };
  /** la cláusula con la que llega un fichaje: lo que pagó o lo que valía si era más, nunca menos de 1 M */
  const clausulaAlFichar = (a) => Math.max(Math.abs(num(a.importe)), valorEn(a.pid, a.t) || 0, 1e6);

  /* los clausulazos: LaLiga los apunta como un traspaso más. Lo es si se pagó justo la cláusula que tenía el
     vendedor (la de cuando lo fichó o la que se le vio después) y ya no estaba protegido */
  const czIds = new Set();
  {
    const vistas = {}; // cláusulas vistas de cada jugador en cada equipo
    for (const m of H.mov || []) {
      const c = m.tipo === 'blinda' ? m.a : m.clausula;
      if (c && m.teamId && m.pid) (vistas[`${m.teamId}|${m.pid}`] ||= []).push(c);
    }
    for (const [tid, fichas] of Object.entries(D.plantillas || {})) for (const f of fichas) if (f.clausula) (vistas[`${tid}|${f.pid}`] ||= []).push(f.clausula);
    const PROTEGIDO = 336 * HORA;
    for (const a of AH0.lista) {
      if (a.clase !== 'compra' || !(a.otroId || a.otro) || !a.pid || !a.importe || !a.t) continue;
      const vend = tidDe(a.otroId, a.otro);
      if (!vend) continue;
      const imp = Math.abs(num(a.importe));
      const suyo = fichajeAntes(vend, a.pid, a.t);
      if (suyo && a.t - suyo.t < PROTEGIDO - HORA) continue; // aún estaba protegido: fue un trato
      const cands = [...(vistas[`${vend}|${a.pid}`] || [])];
      if (suyo) cands.push(clausulaAlFichar(suyo));
      else if (AH0.completa && AH0.desde) { const v0 = valorEn(a.pid, AH0.desde); if (v0) cands.push(Math.max(v0, 1e6)); }
      if (cands.some((c) => Math.abs(imp - c) <= Math.max(1000, c * 0.002))) czIds.add(idAct(a));
    }
  }
  const marcarCz = (a) => (czIds.has(idAct(a)) ? { ...a, clase: 'clausula', cz: true } : a);
  const AH = { ...AH0, lista: AH0.lista.map(marcarCz) };
  for (const v of M.vendidos) if (v.evId && czIds.has(v.evId) && v.aTid) v.como = `te lo clausuló ${nombreEquipo(v.aTid)}`;

  const flujos = {};
  {
    const fl = (tid) => (flujos[tid] ||= { v: 0, n: 0, gastado: 0, ingresado: 0, premios: 0, raros: 0, ev: [] });
    const mover = (tid, x, t, k) => { const f = fl(tid); f.v += x; f.n++; f.ev.push([t || 0, x]); if (k) f[k] += Math.abs(x); };
    // una venta a otro manager que saliera también como compra suya: no se cuenta dos veces
    const compraDe = new Set();
    for (const a of AH.lista) if ((a.clase === 'compra' || a.clase === 'clausula') && (a.otroId || a.otro)) compraDe.add(`${a.pid}|${Math.abs(num(a.importe))}|${tidDe(a.otroId, a.otro)}`);
    for (const a of AH.lista) {
      const imp = Math.abs(num(a.importe));
      if (!imp) continue;
      const q = tidDe(a.quienId, a.quien), o = tidDe(a.otroId, a.otro);
      if (a.clase === 'compra' || a.clase === 'clausula') {
        if (q) mover(q, -imp, a.t, 'gastado');
        if (o && o !== q) mover(o, imp, a.t, 'ingresado');
      } else if (a.clase === 'venta') {
        if (q && !compraDe.has(`${a.pid}|${imp}|${q}`)) mover(q, imp, a.t, 'ingresado');
      } else if (a.clase === 'premio') {
        if (q) mover(q, imp, a.t, 'premios');
      } else if (a.clase === 'otro' && q) fl(q).raros++; // un movimiento con dinero de un tipo que no se conoce: al margen
    }
  }
  M.flujos = flujos;
  /** (26 nov, el parte de los rivales) ¿LaLiga ya le ha pagado el premio de la última jornada acabada? true: pagado; false:
   *  aún puede llegarle; null: no ha acabado ninguna o ya no se espera. El dinero de cada rival no cuenta el premio hasta que
   *  sale en los movimientos, así que con él por llegar no se puede dar a nadie por «en rojo»: le entra de golpe (100 mil
   *  por punto). LaLiga lo paga entre 5 y 6 horas después de `fin` (131 premios de la liga de Carlos: de 4,9 a 5,8 h) y no
   *  todos lo cobran cada jornada: pasadas 12 horas, el que no lo tiene ya no lo va a tener */
  M.premioPagado = (tid) => {
    const ult = jornadas.filter((jo) => jo.fin <= ahora).pop();
    if (!ult) return null;
    if (AH.lista.some((x) => x.clase === 'premio' && x.t > ult.ini && tidDe(x.quienId, x.quien) === tid)) return true;
    return ahora - ult.fin < 12 * HORA ? false : null;
  };
  M.histMov = { desde: AH.desde || null, completa: !!AH.completa, n: AH.lista.length };
  // cuántos de cada tipo (para el diagnóstico)
  M.histTipos = AH.lista.reduce((o, a) => { const k = a.tipo != null ? `${a.tipo}` : a.clase; o[k] = o[k] || { n: 0, conImporte: 0 }; o[k].n++; if (num(a.importe)) o[k].conImporte++; return o; }, {});
  M.czDetectados = czIds.size;

  // lo que ha gastado cada uno en subir cláusulas
  const subidas = {}, sinBase = [];
  {
    const sb = (tid) => (subidas[tid] ||= { v: 0, n: 0, dudas: 0, sinBase: 0, vistas: 0, lista: [] });
    for (const [tid, fichas] of Object.entries(D.plantillas || {})) for (const f of fichas) {
      if (!f.clausula) continue;
      const a = fichajeAntes(tid, f.pid, ahora + DIA);
      let base;
      if (a) base = clausulaAlFichar(a);
      else {
        // de su plantilla del principio: entonces su cláusula era lo que valía
        let v0 = AH.completa && AH.desde ? valorEn(f.pid, AH.desde) : null;
        // si su histórico de valor empieza después de crearse la liga (el juego abre antes que LaLiga), su primer valor,
        // si es de las 3 semanas siguientes
        if (v0 == null && AH.completa && AH.desde) { const p0 = ((det[f.pid] && det[f.pid].valores) || [])[0]; if (p0 && p0[0] - AH.desde < 21 * DIA) v0 = p0[1]; }
        if (v0 == null) {
          const posible = Math.max(0, f.clausula - Math.max(J(f.pid).valor, 1e6)) / 2;
          if (posible > 2e5) { sb(tid).sinBase++; sb(tid).dudas += posible; sinBase.push(f.pid); }
          continue;
        }
        base = Math.max(v0, 1e6);
      }
      // lo que sube sola la cláusula con el valor del jugador no cuenta: si está en lo más que ha valido desde entonces,
      // la ha puesto LaLiga al pasarla el valor
      const tBase = a ? a.t : AH.desde;
      if (f.clausula <= maxValorDesde(f.pid, tBase) * 1.02) continue;
      const subio = f.clausula - base;
      // lo poco puede ser que valiera algo más al ficharlo que lo que se sabe
      if (subio < Math.max(2e5, 0.03 * base)) continue;
      sb(tid).v += subio / 2; sb(tid).n++;
      sb(tid).lista.push({ pid: f.pid, de: base, a: f.clausula, pago: subio / 2 });
    }
    // las subidas que se vieron en jugadores que ya no tiene (el dinero se gastó igual)
    for (const m of H.mov || []) {
      if (!M.blindaPagada(m) || !m.teamId) continue;
      if (plantillaDe(m.teamId).some((f) => f.pid === m.pid)) continue;
      sb(m.teamId).v += (m.a - m.de) / 2; sb(m.teamId).n++; sb(m.teamId).vistas++;
    }
  }
  M.subidas = subidas;
  M.sinBase = sinBase;

  const diasMov = AH.desde ? Math.max(1, (ahora - AH.desde) / DIA) : 0;
  // la base común: lo que tendrías sin moverte (100 M de salida más las recompensas diarias que has cogido)
  const miF = flujos[yoTid] || { v: 0, raros: 0 }, miSub = subidas[yoTid] || { v: 0, dudas: 0 };
  const baseV = D.dinero != null ? num(D.dinero) - miF.v + miSub.v : null;
  const recTotal = AH.desde ? M.recompensas(AH.desde, ahora) : 0;
  const baseMin = 100e6 - 0.5e6, baseMax = 100e6 + recTotal + 0.5e6;
  const desvio = baseV == null || !AH.completa || D.demo ? 0 : baseV < baseMin ? baseMin - baseV : baseV > baseMax ? baseV - baseMax : 0;
  M.baseDinero = baseV == null ? null : { v: baseV, min: baseMin, max: baseMax, desvio, saldo: num(D.dinero), mov: miF.v, subidas: miSub.v, dias: diasMov };
  const dichos = extra.dichos || {};
  /** la cuenta con los movimientos, sin lo que te haya dicho ni corregir (con esta se apunta cuánto fallaba) */
  M.dineroCuentaBruta = (tid) => {
    if (!tid || tid === yoTid) return null;
    if (D.dinero == null) return { v: null, exacto: false, fiable: 'no', motivo: 'no se sabe tu saldo' };
    if (!AH.completa) return { v: null, exacto: false, fiable: 'no', motivo: `faltan los movimientos del principio de la liga (hay desde ${AH.desde ? cuando(AH.desde, { hora: false }) : '?'})` };
    const f = flujos[tid] || { v: 0, n: 0, raros: 0 }, s = subidas[tid] || { v: 0, n: 0, dudas: 0 };
    const v = baseV + f.v - s.v;
    const valorR = num((M.equipo[tid] || {}).valor);
    // en una liga con mucho movimiento se puede tener bastante más dinero que equipo, así que arriba no hay tope;
    // lo que no puede ser es deber mucho más de lo que deja la deuda (el 20 % de su equipo)
    if (v < -0.4 * valorR - 15e6) return { v: null, exacto: false, fiable: 'no', motivo: `la cuenta da ${eur(v)}, más deuda de la que permite el juego` };
    // la recompensa diaria que uno coge y otro no, las subidas que no se pueden medir, lo raro y lo que no cuadra en la base
    // (0.7.13z) el margen, por partes (el Diagnóstico las enseña): 1 M fijo, la mitad de las recompensas de la liga (cada
    // rival ha cogido entre 0 y todas), las subidas de cláusula que no se miden, lo que no cuadra en tu base y lo raro
    const partes = { fija: 1e6, rec: Math.min(recTotal, 15e6) * 0.5, dudas: num(s.dudas) + num(miSub.dudas), desvio, raros: (num(f.raros) + num(miF.raros)) * 1e6 };
    const margen = Math.round((partes.fija + partes.rec + partes.dudas + partes.desvio + partes.raros) / 1e5) * 1e5;
    return { v, exacto: false, margen, partes, fiable: 'media', desde: AH.desde, n: f.n, cuenta: { base: baseV, mov: f.v, subidas: s.v, nSubidas: s.n } };
  };
  /* (0.7.12, Carlos 14 nov: «con el dinero que apunta la gente… se tendría que retroalimentar y mejorar la predicción»)
     lo que te han dicho los rivales corrige la cuenta de los demás. Cada vez que apuntas lo que tiene uno, se guarda lo
     que daba la cuenta en ese momento (est): la diferencia es lo que la cuenta no ve (recompensas diarias que no coge,
     subidas de cláusula que no se ven, la base). Para un rival que te lo dijo hace tiempo (ya no vale como punto de
     partida), se usa su propia diferencia; para los demás, la mediana de las de todos, a medias con 2 y entera con 5.
     Solo cuenta lo apuntado en los últimos 120 días */
  const errores = Object.entries(dichos).filter(([, dc]) => dc && dc.v != null && dc.est != null && dc.t && ahora - dc.t < 120 * DIA).map(([tid, dc]) => ({ tid, e: dc.v - dc.est }));
  const medianaE = (() => { const xs = errores.map((x) => x.e).sort((a, b) => a - b); if (!xs.length) return 0; const m = Math.floor(xs.length / 2); return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2; })();
  const pesoG = errores.length >= 2 ? Math.min(1, (errores.length - 1) / 4) : 0;
  M.correccionDinero = { n: errores.length, mediana: Math.round(medianaE), peso: pesoG };
  /* (0.7.13, Carlos 15 nov: «el dinero que apuntan quiero que se use para autoalimentarse y mejorarse la app e IA, da igual
     la liga que sea») lo que falla la cuenta en TODAS las ligas, de lo que apunta la gente (extra.calDinero, la mediana y el
     reparto, en total y por días de liga). Va por debajo de lo de tu liga: lo tuyo pesa más (con 5 apuntes tuyos ya no
     cuenta lo de todos), y lo de todos pesa entero con 40 apuntes en su tramo. Con datos, el margen se acerca a lo que de
     verdad falla la cuenta (la mitad del p10-p90): se estrecha si la cuenta acierta y se abre si no */
  const calD = extra.calDinero && Number(extra.calDinero.n) >= CAL_MIN ? extra.calDinero : null;
  M.calDinero = calD ? { n: calD.n, med: calD.med, margen: Math.max(5e5, Math.round((calD.p90 - calD.p10) / 2 / 1e5) * 1e5) } : null;
  const deTodos = (c) => {
    if (!calD) return null;
    const dl = c.desde ? (ahora - c.desde) / DIA : 0;
    const tr = (calD.porDias || []).find((x) => dl >= x.desde && dl < x.hasta && x.n >= CAL_MIN);
    const b = tr || calD;
    return { v: num(b.med), w: Math.min(1, b.n / 40), margen: Math.max(5e5, (num(b.p90) - num(b.p10)) / 2), n: calD.n };
  };
  /** la cuenta con los movimientos, corregida con lo que te han dicho (el suyo o el de todos) y con lo de todas las ligas */
  M.dineroCuenta = (tid) => {
    const c = M.dineroCuentaBruta(tid);
    if (!c || c.v == null) return c;
    const propio = errores.find((x) => x.tid === String(tid));
    const g = propio ? null : deTodos(c), wg = g ? (1 - pesoG) * g.w : 0;
    const corr = propio ? propio.e : medianaE * pesoG + (g ? wg * g.v : 0);
    let margen = propio || !pesoG ? c.margen : Math.max(5e5, Math.round((c.margen * 0.85) / 1e5) * 1e5);
    if (wg) margen = Math.max(5e5, Math.round((margen * (1 - wg) + g.margen * wg) / 1e5) * 1e5);
    /* (0.7.13z, Carlos 16 nov: «el ± es la mitad, y la cifra tiene que estar en medio») la cuenta parte de TU saldo, o sea,
       da por hecho que el rival ha cogido tantas recompensas diarias como tú; pero ha podido coger desde ninguna hasta todas
       y el ± ya es la mitad de ese hueco. Sin datos de nadie, la cifra se pone en el punto medio de lo que puede ser su base
       (de 100 M a 100 M + las recompensas de la liga); con lo que te han dicho, lo aprendido pesa y el punto medio, menos. */
    const pesoDatos = propio ? 1 : Math.min(1, pesoG + wg);
    const centro = baseV == null || D.demo ? 0 : Math.round(((baseMin + baseMax) / 2 - baseV) * (1 - pesoDatos) / 1e5) * 1e5;
    const cc = Math.abs(corr) < 1e5 ? 0 : corr;
    if (!cc && !centro && margen === c.margen) return c;
    const out = { ...c, v: c.v + cc + centro, margen, centro };
    if (cc || margen !== c.margen) out.correccion = { v: Math.round(cc), propio: !!propio, n: errores.length, todos: wg ? g.n : 0 };
    return out;
  };
  /**
   * { v, exacto: true, fuente } si LaLiga lo da; si te ha dicho cuánto tiene, eso más lo que ha movido desde entonces;
   * si no, la cuenta con los movimientos { v, exacto: false, margen, fiable, desde }. Sin los movimientos desde el
   * principio de la liga no se puede estimar: entonces { v: null, fiable: 'no', motivo }.
   */
  M.dineroDe = (tid) => {
    if (!tid) return null;
    if (tid === yoTid) return D.dinero != null ? { v: num(D.dinero), exacto: true, fuente: 'tu cuenta' } : null;
    const ex = (D.dineros || {})[tid];
    if (ex && ex.v != null) return { v: num(ex.v), exacto: true, fuente: ex.fuente || 'LaLiga' };
    const dc = dichos[tid];
    if (dc && dc.v != null && dc.t && ahora - dc.t < 45 * DIA) {
      const f = flujos[tid] || { ev: [], n: 0 };
      const mov = f.ev.filter(([t]) => t > dc.t).reduce((x, [, d]) => x + d, 0);
      const sub = (H.mov || []).filter((m) => M.blindaPagada(m) && m.teamId === tid && m.t > dc.t).reduce((x, m) => x + (m.a - m.de) / 2, 0);
      // (0.7.12) más las recompensas diarias desde que te lo dijo (el doble en el parón), que antes solo iban al margen
      const rec = M.recompensas(dc.t, ahora);
      const margen = Math.round((num(dc.r) + 0.3e6 + rec * 0.5) / 1e5) * 1e5;
      // (0.7.13z) desde que te lo dijo ha podido coger entre 0 y `rec`: la cifra va en medio (rec / 2) y el margen es esa mitad
      return { v: dc.v + mov - sub + rec * 0.5, exacto: false, margen, fiable: 'alta', dicho: dc, desdeDicho: mov - sub + rec * 0.5, n: f.n };
    }
    return M.dineroCuenta(tid);
  };
  /** lo que puede gastar de golpe en una cláusula: su saldo (con el margen si es estimado); null si no se sabe */
  M.capacidad = (tid) => {
    const d = M.dineroDe(tid);
    if (!d || d.v == null) return null;
    const seguro = d.exacto ? d.v : d.v - d.margen, alto = d.exacto ? d.v : d.v + d.margen;
    return { ...d, seguro, alto };
  };
  M.rivalesTid = D.clasif.filter((e) => e.teamId !== yoTid).map((e) => e.teamId);
  M.dineroExacto = M.rivalesTid.length > 0 && M.rivalesTid.every((tid) => { const d = M.dineroDe(tid); return d && d.exacto; });
  M.conDinero = M.rivalesTid.filter((tid) => M.capacidad(tid)).length;
  /**
   * quién puede pagar una cláusula: seguro (le sobra) o quizá (le llega con el margen de la estimación).
   * sinSaber: los rivales de los que no se sabe el dinero. Para pagar una cláusula hace falta tenerlo en el saldo.
   */
  M.quienPaga = (importe, sinTid = null) => {
    const out = { seguro: [], quiza: [], sinSaber: [] };
    for (const tid of M.rivalesTid) {
      if (tid === sinTid) continue;
      const c = M.capacidad(tid);
      if (!c) { out.sinSaber.push({ tid, nombre: nombreEquipo(tid) }); continue; }
      const x = { tid, nombre: nombreEquipo(tid), c };
      if (c.seguro >= importe) out.seguro.push(x);
      else if (c.alto >= importe) out.quiza.push(x);
    }
    // solo cuenta si se sabe el de casi todos (si no, «no le llega a nadie» sería mentira)
    out.hayDatos = M.rivalesTid.length > 0 && out.sinSaber.length <= Math.floor(M.rivalesTid.length * 0.2);
    return out;
  };

  /* ---------- lo que se paga en tu liga por los libres del mercado ---------- */
  // cada compra a LaLiga de las últimas semanas frente a lo que valía el jugador ese día
  {
    const clausulasAhora = new Set();
    for (const fichas of Object.values(D.plantillas || {})) for (const f of fichas) if (f.clausula) clausulasAhora.add(`${f.pid}|${f.clausula}`);
    const pujas = [];
    for (const a of AH.lista) {
      if (a.clase !== 'compra' || a.otroId || a.otro || !a.pid || !a.importe || !a.t || ahora - a.t > 45 * DIA) continue;
      const imp = Math.abs(num(a.importe));
      if (clausulasAhora.has(`${a.pid}|${imp}`)) continue;
      const v = valorEn(a.pid, a.t - 3 * HORA);
      if (!v) continue;
      const s = imp / v - 1;
      // (los baratos se pagan muy por encima en porcentaje: uno de 600 mil por 1,5 M es normal; Carlos, 30 oct. Antes
      // se tiraba todo lo de más de un +100 % y la liga parecía pagar por ellos mucho menos de lo que paga. Solo se tira
      // lo que no puede ser: más de 6 veces su valor, o más del doble con más de 3 M de más)
      if (s < -0.1 || s > 5 || (s > 1 && imp - v > 3e6)) continue;
      // (0.7.13u) y cómo venía: lo que subía esos días y si era de los top
      pujas.push({ s, tid: M.teamDeUsuario(a.quienId, a.quien), v, imp, t: a.t, pid: a.pid, r: M.subidaEn(a.pid, a.t - 3 * HORA), top: v >= M.corteTop });
    }
    M.comprasLiga = pujas;
    const cuantil = (l, q) => { const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * q, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
    if (pujas.length >= 4) {
      const ss = pujas.map((x) => x.s);
      const porEquipo = {};
      // (lo de cada rival, como antes: sin lo de más de un +100 %, que en los baratos es lo normal y lo haría parecer manirroto)
      for (const x of pujas) if (x.tid && x.s <= 1) (porEquipo[x.tid] ||= []).push(x.s);
      // por tramos de valor: cuanto más barato, más se paga en porcentaje (para el contexto de la IA y el diagnóstico;
      // las cuentas de cada jugador van con `M.pagaLiga`, con los de su valor)
      const tramos = TRAMOS_PUJA.map(([desde, hasta]) => {
        const l = pujas.filter((x) => x.v >= desde && x.v < hasta).map((x) => x.s);
        return l.length >= 3 ? { desde, hasta, n: l.length, med: cuantil(l, 0.5), p75: cuantil(l, 0.75), p90: cuantil(l, 0.9) } : null;
      }).filter(Boolean);
      M.pujasLiga = {
        n: pujas.length, p25: cuantil(ss, 0.25), med: cuantil(ss, 0.5), p75: cuantil(ss, 0.75), p90: cuantil(ss, 0.9), tramos,
        todas: pujas.map((x) => ({ s: x.s, v: x.v, r: x.r, top: x.top })),
        porEquipo: Object.fromEntries(Object.entries(porEquipo).map(([tid, l]) => [tid, { n: l.length, med: cuantil(l, 0.5), max: Math.max(...l) }])),
        ult: pujas.sort((a, b) => b.t - a.t).slice(0, 10),
      };
    } else M.pujasLiga = pujas.length ? { n: pujas.length, poco: true, med: cuantil(pujas.map((x) => x.s), 0.5), porEquipo: {}, ult: pujas } : null;
    /* lo que se paga en tu liga por los libres de un valor parecido al suyo (Carlos, 30 oct: «no puede aplicar el mismo
       porcentaje a uno de 600 mil que a uno de 80 M»). Las compras más cercanas en valor, en escala logarítmica (de 600
       mil a 1,5 M hay lo mismo que de 20 M a 50 M): las que estén entre la mitad y el doble y medio de su valor (hasta
       20) y, si no llegan a 6, las 6 más cercanas sin pasar de 5 veces arriba o abajo. Con menos de 4, nada de tu liga.
       (0.7.13u, Carlos 16 nov: «en mi liga los top o los que suben mucho se pagan bastante por encima de la media») con
       el perfil del jugador ({ r, top }, o su id), además del valor cuenta cómo venía cada compra: un punto de subida al
       día de diferencia aleja lo mismo que el doble y medio de valor, y ser o no de los top, la mitad. Las más parecidas
       pesan más. Si tu liga tiene pocas compras parecidas, se mezcla con lo que se paga en todas las ligas por los de su
       valor y su subida (`M.pagaTodos`): con 12 parecidas de tu liga, solo lo tuyo.
       Devuelve los cuantiles sobre el valor (`q(p)` da cualquiera), `f(s)`, la parte de esas compras que se pagaron por
       s o menos (lo que se acerca a las veces que ganas pujando eso), y entre qué valores están las de tu liga */
    const calP = extra.calPujas && Number(extra.calPujas.n) >= CAL_MIN && Array.isArray(extra.calPujas.celdas) ? extra.calPujas : null;
    M.calPujas = calP ? { n: calP.n } : null;
    const interp = (pts, x, de = 0, a = 1) => {
      if (x <= pts[0][de]) return pts[0][a];
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][de]) { const p0 = pts[i - 1], p1 = pts[i]; return p0[a] + (p1[a] - p0[a]) * (x - p0[de]) / ((p1[de] - p0[de]) || 1); }
      return pts[pts.length - 1][a];
    };
    const tramoDe = (tr, x) => (tr || []).findIndex(([lo, hi]) => x >= lo && x < hi);
    /** lo que se paga en TODAS las ligas por uno de su valor y su subida (y de los top, si lo es); null sin datos */
    M.pagaTodos = (v, pf = {}) => {
      if (!calP || !(v > 0)) return null;
      const iv = tramoDe(calP.tv, v), ir = pf.r == null ? -1 : tramoDe(calP.tr, pf.r);
      const cel = (k) => calP.celdas.find((x) => x.k === k && Number(x.n) >= CAL_MIN);
      const c = (pf.top && ir >= 0 && cel(`top|${ir}`)) || (ir >= 0 && cel(`${iv}|${ir}`)) || cel(`${iv}|*`);
      if (!c) return null;
      const pts = [[0.1, +c.p10], [0.25, +c.p25], [0.5, +c.med], [0.75, +c.p75], [0.9, +c.p90]];
      return { n: c.n, k: c.k, q: (p) => interp(pts, p), f: (s) => clamp(interp(pts, s, 1, 0), 0.03, 0.97) };
    };
    const ln25 = Math.log(2.5), SUBE_PASO = 0.01;
    const cachePaga = new Map();
    M.pagaLiga = (v, x) => {
      if (!(v > 0)) return null;
      const pf = x == null ? {} : typeof x === 'object' ? x : M.perfilPuja(x);
      const conPerfil = pf.r != null || pf.top != null;
      const k = `${Math.round(Math.log(v) * 40)}|${pf.r == null ? 'x' : Math.round(pf.r * 400)}|${pf.top == null ? 'x' : pf.top ? 1 : 0}`;
      if (cachePaga.has(k)) return cachePaga.get(k);
      const PL = M.pujasLiga;
      let L = null;
      if (PL && !PL.poco && PL.todas) {
        const lv = Math.log(v);
        const cerca = PL.todas.map((y) => {
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
          // (sin perfil, los mismos cuantiles de siempre; con perfil, con pesos)
          const pts = o.map((y) => { const c2 = (acc + y.w / 2) / W; acc += y.w; return [c2, y.s]; });
          const ss = o.map((y) => y.s), vs = sel.map((y) => y.v);
          const q = conPerfil ? (p) => interp(pts, p) : (p) => cuantil(ss, p);
          const f = (s) => o.reduce((s2, y) => s2 + (y.s <= s + 1e-9 ? y.w : 0), 0) / W;
          L = { n: sel.length, nCerca: sel.filter((y) => y.d <= 1).length, q, f, desde: Math.min(...vs), hasta: Math.max(...vs), sube: sel.filter((y) => y.r != null && y.r > 0.008).length };
        }
      }
      const G = M.pagaTodos(v, pf);
      let r = null;
      if (L || G) {
        const wL = !L ? 0 : !G ? 1 : clamp((L.nCerca + 0.4 * (L.n - L.nCerca)) / 12, 0.2, 1);
        const q = (p) => (L ? wL * L.q(p) : 0) + (G && wL < 1 ? (1 - wL) * G.q(p) : 0);
        const f = (s) => (L ? wL * L.f(s) : 0) + (G && wL < 1 ? (1 - wL) * G.f(s) : 0);
        r = { n: L ? L.n : 0, nCerca: L ? L.nCerca : 0, todos: G && wL < 1 ? G.n : 0, wL, p25: q(0.25), med: q(0.5), p75: q(0.75), p90: q(0.9), q, f,
          desde: L ? L.desde : null, hasta: L ? L.hasta : null, sube: L ? L.sube : 0, pf };
      }
      cachePaga.set(k, r);
      return r;
    };
    /** de dónde sale lo de `pagaLiga`, en palabras: «por los 14 más parecidos de tu liga (de 20 M a 90 M)» */
    M.pagaTxt = (P) => {
      if (!P) return '';
      const como = P.pf && P.pf.r != null && P.pf.r > 0.008 ? ', subiendo como él' : '';
      const liga = P.n ? `${P.n} compras de tu liga parecidas${como || ' en valor'} (de ${eur(P.desde)} a ${eur(P.hasta)})` : '';
      const todos = P.todos ? `${P.todos} de todas las ligas${como ? `, de su valor y subiendo como él` : ', de su valor'}` : '';
      return [liga, todos].filter(Boolean).join(' y ');
    };

    /* (0.7.13u) tus pujas: las que ganaste y las que perdiste, y por cuánto se lo llevó otro. Cada puja que la app ha visto
       puesta (`extra.pujasMias`, la apunta app.js) se cruza con la compra de ese jugador en la actividad de la liga al
       cerrarse el mercado. Si pierdes muchas, tu liga paga más de lo que la app cree: la puja sube de cuantil; si las
       ganas todas, baja un poco. Con pocas pujas cuenta menos */
    {
      const res = [];
      for (const p of Object.values(extra.pujasMias || {})) {
        if (!p || !p.pid || !(p.puja > 0) || !p.cierra || p.cierra > ahora - 10 * MIN || ahora - p.cierra > 45 * DIA) continue;
        const c = AH.lista.find((a) => a.clase === 'compra' && !a.otroId && !a.otro && String(a.pid) === String(p.pid) && a.t && Math.abs(a.t - p.cierra) < 12 * HORA && a.importe);
        if (!c) continue;
        const v = num(p.valor) || valorEn(p.pid, p.cierra - 3 * HORA);
        if (!v) continue;
        const imp = Math.abs(num(c.importe)), gana = M.teamDeUsuario(c.quienId, c.quien) === yoTid;
        res.push({ pid: p.pid, t: p.cierra, puja: p.puja, v, gana, imp, sMia: p.puja / v - 1, sGana: imp / v - 1 });
      }
      res.sort((a, b) => b.t - a.t);
      const ult = res.slice(0, 30), n = ult.length, perdidas = ult.filter((x) => !x.gana);
      const faltas = perdidas.map((x) => x.sGana - x.sMia).filter((d) => d > 0).sort((a, b) => a - b);
      const ajuste = n >= 3 ? clamp((perdidas.length / n - 0.4) * 0.3, -0.06, 0.12) * (n / (n + 4)) : 0;
      M.misPujasRes = n ? { n, ganadas: n - perdidas.length, perdidas: perdidas.length, ajuste, falta: faltas.length ? cuantil(faltas, 0.5) : null, ult: ult.slice(0, 8) } : null;
    }
  }
  /* el cuantil de las compras parecidas con el que se gana la puja: el de 6 de cada 10, más lo que diga cómo te va con tus
     pujas. (21 nov, medido con la liga de Carlos: 222 compras, claude/medida-ia-2026-11-20.md) con los top se queda corto:
     el de 6 de cada 10 ganaba 4 de cada 10 (los de más de 30 M se pagan cada vez más por encima de las compras de antes),
     y hace falta el de 7 de cada 10 y pico; con los demás, 6 de cada 10 ganaba ~6 */
  M.qPujaGana = (pid) => clamp(0.6 + (M.perfilPuja(pid).top ? 0.12 : 0) + (M.misPujasRes ? M.misPujasRes.ajuste : 0), 0.5, 0.85);
  // lo que es normal pagar de más, en porcentaje, por uno de ese valor en tu liga: lo que pagan 3 de cada 4 por los de
  // su valor, y como poco un 10 % (lo de antes para todos). A partir de ahí el porcentaje empieza a contar como sobrecoste
  M.sobreNormal = (v) => { const P = M.pagaLiga(v); return P ? Math.max(0.1, P.p75) : 0.1; };
  // con un calendario de riesgo alto, solo de parche y por lo bajo de lo que se paga por los de su valor: un 5 % sobre
  // uno de 600 mil no se lo lleva nadie. Como poco un 5 % (lo de antes para todos) y, por encima de eso, sin pasar de
  // medio punto del valor de tu equipo en euros de más (lo que importa es el dinero que se pierde: con un equipo de
  // 150 M, 750 mil; así a uno de 9 M no se le sube de un 5 % a un 13 %, pero a uno de 600 mil sí se le deja pujar)
  M.sobreParche = (v) => {
    const P = M.pagaLiga(v);
    if (!P || !(v > 0)) return 0.05;
    return Math.max(0.05, Math.min(P.p25, (Math.max(num(D.valorEquipo), 50e6) * 0.005) / v));
  };

  /* ---------- lo que ofrece LaLiga por lo que se pone a la venta ---------- */
  // Las ofertas de los rivales por un jugador en venta solo las ve su dueño, pero lo que paga LaLiga se sabe: las
  // ventas a LaLiga de tu liga (y las ofertas de LaLiga que tienes ahora) frente a lo que valía el jugador ese día.
  // Sirve para saber cuánto le darán a un rival si nadie le compra (por menos no tiene por qué venderte) y lo que te
  // llegará a ti.
  {
    const q = (l, p) => { const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
    const r = [];
    // una venta que es también la compra de otro manager (mismo jugador y mismo importe) no fue a LaLiga
    const comprasManager = new Set();
    for (const a of AH.lista) if ((a.clase === 'compra' || a.clase === 'clausula') && a.pid) comprasManager.add(`${a.pid}|${Math.abs(num(a.importe))}`);
    for (const a of AH.lista) {
      if (a.clase !== 'venta' || !a.pid || !a.importe || !a.t || ahora - a.t > 60 * DIA) continue;
      const imp = Math.abs(num(a.importe));
      if (comprasManager.has(`${a.pid}|${imp}`)) continue;
      const v = valorEn(a.pid, a.t - 3 * HORA);
      if (!v) continue;
      const s0 = imp / v - 1;
      if (s0 >= -0.25 && s0 <= 0.25) r.push(s0);
    }
    for (const v of D.misVentas || []) for (const o of v.ofertas || []) if (o.deLiga && o.importe && J(v.pid).valor) r.push(o.importe / J(v.pid).valor - 1);
    M.ofertaLiga = r.length ? { n: r.length, med: q(r, 0.5), p25: q(r, 0.25), p75: q(r, 0.75), poco: r.length < 3 } : null;
  }
  /* ---------- lo que se paga en tu liga en los clausulazos ---------- */
  // cada cláusula pagada frente a lo que valía el jugador ese día: dice hasta dónde llega la gente de tu liga
  {
    const q = (l, p) => { const o = [...l].sort((a, b) => a - b); const i = (o.length - 1) * p, b = Math.floor(i); return o[b] + (o[Math.min(o.length - 1, b + 1)] - o[b]) * (i - b); };
    const r = [];
    for (const a of AH.lista) {
      if (a.clase !== 'clausula' || !a.pid || !a.importe || !a.t) continue;
      const v = valorEn(a.pid, a.t - 3 * HORA);
      if (!v) continue;
      const s0 = Math.abs(num(a.importe)) / v - 1;
      if (s0 > -0.1 && s0 < 3) r.push(s0);
    }
    M.clausulazos = r.length ? { n: r.length, med: q(r, 0.5), p75: q(r, 0.75), p90: q(r, 0.9), max: Math.max(...r) } : null;
  }

  /* (24 nov, Fran: «se cree que la liga da un 7 % en las ofertas; puede dar de −10 a +10»; Carlos, 20 nov: «LaLiga da más o
     menos un ±10 % y es suerte») `M.ofertaLiga` sale de las ventas a LaLiga que se ven en la liga, y esas son las ofertas que
     alguien ACEPTÓ (las buenas): su mediana (+7 % en su liga) no es lo que LaLiga ofrece cada vez, sino lo que se acaba
     sacando esperando a una buena. CADA oferta es una lotería entre −10 % y +10 % de lo que vale el jugador ese día, con una
     nueva en cada cambio de mercado. Desde aquí todo lo que la app y la IA DICEN de «lo que dará LaLiga» usa las dos cosas
     por separado: `una` (la siguiente oferta) y lo que se acepta (`v`, `min`, `max`, como antes, para las cuentas del plan) */
  M.RANGO_LIGA = 0.10;
  /** Lo que se saca de LaLiga pudiendo esperar hasta `n` ofertas (una por cambio de mercado), con el valor moviéndose `delta`
   * (tanto por uno) cada día. La oferta de ayer ya no está cuando llega la de hoy, así que no es «la mejor de n»: es quedarse
   * con la primera que supere lo que se espera de seguir esperando (la última se acepta como venga). Devuelve `gana` (sobre
   * el valor del día de la primera oferta) y `corte` (desde qué tanto por uno se acepta la primera). Con el valor quieto:
   * 0 con una, +2,5 % con dos, +3,9 % con tres, +4,8 % con cuatro, +6,5 % con siete */
  M.esperarOferta = (n, delta = 0) => {
    const r = M.RANGO_LIGA;
    n = Math.max(1, Math.round(n));
    let W = (n - 1) * delta, corte = -r;
    for (let k = n - 1; k >= 1; k--) {
      const base = (k - 1) * delta, c = W - base;
      corte = clamp(c, -r, r);
      if (c < r) W = base + (r + corte) ** 2 / (4 * r);
    }
    return { gana: W, corte: n > 1 ? corte : -r };
  };
  /** de cada 10 ofertas, cuántas mejoran una de `s` sobre su valor */
  M.pMejorOferta = (s) => clamp((M.RANGO_LIGA - s) / (2 * M.RANGO_LIGA), 0, 1);
  /** lo de LaLiga por un jugador: `una` = la siguiente oferta (entre −10 % y +10 % de su valor); `v`, `min` y `max` = lo que se
   * acaba sacando en tu liga esperando a una buena (la mediana y la mitad central de las ventas a LaLiga que se ven) */
  M.ofertaLigaDe = (j) => {
    if (!j || !j.valor) return null;
    const una = { min: Math.round((j.valor * (1 - M.RANGO_LIGA)) / 1e4) * 1e4, max: Math.round((j.valor * (1 + M.RANGO_LIGA)) / 1e4) * 1e4 };
    const OL = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga : null;
    const med = OL ? OL.med : 0;
    return { una, v: Math.round((j.valor * (1 + med)) / 1e4) * 1e4, med, n: OL ? OL.n : 0, sinDatos: !OL, min: OL ? Math.round((j.valor * (1 + OL.p25)) / 1e4) * 1e4 : null, max: OL ? Math.round((j.valor * (1 + OL.p75)) / 1e4) * 1e4 : null };
  };

  /* ---------- los blindajes (el escudo de LaLiga, viendo un anuncio) ---------- */
  // protegen la cláusula de un jugador 24 h (48 h en las ligas Premium); cada equipo tiene 2 por jornada, desde que
  // acaba una jornada hasta que acaba la siguiente, y solo para jugadores con la cláusula abierta. Se ven en la
  // actividad de la liga; si después el jugador cambia de dueño, el escudo ya no cuenta
  M.ESCUDO_H = D.liga && D.liga.premium ? 48 : 24;
  const ESCUDO = M.ESCUDO_H * HORA;
  const escudos = {};
  for (const a of D.actividad || []) {
    if (a.clase !== 'blindaje' || !a.pid || !a.t || ahora - a.t >= ESCUDO) continue;
    if ((D.actividad || []).some((b) => b.pid === a.pid && b.t > a.t && ['compra', 'clausula', 'venta'].includes(b.clase))) continue;
    escudos[a.pid] = Math.max(escudos[a.pid] || 0, a.t + ESCUDO);
  }
  // (22 nov) «ya he blindado a X», dicho en Pregunta: protegido desde que lo dijo, si sigue siendo suyo y LaLiga no lo trae aún
  for (const [pid, n] of DICHO.blindados) {
    if (M.dueno[pid] !== yoTid || ahora - n.t >= ESCUDO || escudos[pid]) continue;
    if ((D.actividad || []).some((b) => b.pid === pid && b.t > n.t && ['compra', 'clausula', 'venta'].includes(b.clase))) continue;
    escudos[pid] = n.t + ESCUDO;
  }
  M.escudoHasta = (pid) => (escudos[pid] && escudos[pid] > ahora ? escudos[pid] : null);

  /* ---------- fichas (jugador en un equipo de tu liga) ---------- */
  const enriquecer = (f, tid) => {
    const j = J(f.pid), t = M.tend(f.pid);
    // protegida por los 14 días de fichaje o por un blindaje: la que acabe más tarde
    const esc = M.escudoHasta(f.pid);
    const protLiga = Math.max(f.protegidoHasta || 0, esc || 0) || null;
    // y si se abre (o ya está abierta) dentro del cierre de una jornada, no se puede pagar hasta que empiece
    const veda = M.vedaDe(protLiga);
    const prot = veda ? veda.abre : protLiga;
    const abierta = !prot || prot <= ahora;
    return {
      ...f, j, teamId: tid, tend: t, abierta, protegidoHasta: prot, protLiga, veda, escudo: esc && esc >= (f.protegidoHasta || 0) ? esc : null,
      abreEn: abierta ? 0 : prot - ahora,
      ratio: j.valor ? f.clausula / j.valor : null,
      sobre: f.clausula - j.valor,
    };
  };

  /* ---------- tu once: posiciones, formaciones gratuitas y huecos ---------- */
  const misFichasRaw = ((D.plantillas || {})[yoTid] || []).filter((f) => !vendidos[f.pid]);
  M.formaciones = (D.formaciones && D.formaciones.length ? D.formaciones : FORMACIONES).map(partirFormacion).filter(Boolean);
  const onces = (extra.onces && extra.onces.jugadores) || {};
  M.hayOnces = Object.keys(onces).length > 0;
  M.onceProb = (pid) => onces[pid] || null;
  // (19 nov) de qué equipos hay once probable: el que no está en el once de su equipo es suplente o no va, pero si la página
  // de su equipo no ha llegado no se sabe nada (antes se le daba por fuera del once: El Hilali al 47 % y con «SUP»)
  const ffEq = new Set(Array.isArray(extra.onces && extra.onces.leidos) ? extra.onces.leidos.map(String)
    : Object.entries(onces).map(([pid, x]) => (x && x.eq) || (J(pid) || {}).equipoId).filter((x) => x != null).map(String));
  M.hayOnceDe = (j) => !!(j && M.hayOnces && ffEq.has(String(j.equipoId)));
  // la jornada en directo (vivo.js): los puntos de cada uno, solo si su partido de esta jornada ya ha empezado
  // (M.vivo se cambia sin rehacer todo cuando llegan puntos nuevos: M.ponerVivo)
  M.ponerVivo = (v) => { M.vivo = v && M.enJuego && v.n === M.enJuego.n ? v : null; return M.vivo; };
  M.ponerVivo(extra.vivo);
  M.puntosVivo = (pid) => {
    const vivo = M.vivo;
    if (!vivo || !vivo.puntos || vivo.puntos[pid] == null) return null;
    const j = J(pid);
    if (!j) return vivo.puntos[pid];
    const p = (D.partidos || []).find((x) => x.jornada === vivo.n && (x.localId === j.equipoId || x.visitanteId === j.equipoId));
    if (p && p.fecha && p.fecha > Date.now()) return null;
    return vivo.puntos[pid];
  };
  // la alineación confirmada (SofaScore, una hora antes del partido): mientras dura su partido, manda sobre todo lo demás
  const alin = (extra.alineaciones && extra.alineaciones.jugadores) || {};
  M.alineacion = (pid) => { const a = alin[pid]; return a && Date.now() > a.ini - 2 * HORA && Date.now() < a.ini + 2.5 * HORA ? a : null; };
  M.noticias = ((extra.noticias && extra.noticias.lista) || []).filter(esDeFutbol);
  // si Google Noticias no ha contestado: sin titulares no es lo mismo que «no hay noticias»
  M.noticiasFallo = extra.noticias && extra.noticias.fallo ? { fallo: extra.noticias.fallo, viejas: !!extra.noticias.viejas, t: extra.noticias.t } : null;
  M.noticiasDe = (pid) => M.noticias.filter((n) => n.pids && n.pids.includes(pid));

  /* ---------- riesgo de rotación: si su equipo juega otra competición pegada a la jornada ---------- */
  // (los partidos de todas las competiciones de cada equipo vienen de SofaScore; una Champions dos días antes
  // o después hace rotar más que una eliminatoria de Copa, donde los que descansan son los de la Copa)
  const calEx = av.calendario || {};
  M.rotacion = (eqId) => {
    const p = M.proximoPartido(eqId);
    const lista = calEx[eqId] || [];
    if (!p || !lista.length) return null;
    const cerca = lista.filter((x) => x.t && !x.liga && Math.abs(x.t - p.fecha) <= 4.2 * DIA && Math.abs(x.t - p.fecha) > 8 * HORA)
      .map((x) => ({ ...x, antes: x.t < p.fecha, dias: Math.abs(x.t - p.fecha) / DIA }));
    let riesgo = 0;
    for (const x of cerca) {
      const peso = /champions/i.test(x.comp) ? 0.14 : /europa|conference/i.test(x.comp) ? 0.11 : /copa|supercopa|cup/i.test(x.comp) ? 0.04 : 0.06;
      riesgo += peso * (x.dias <= 3.2 ? 1 : 0.6);
    }
    return { p, cerca, riesgo: clamp(riesgo, 0, 0.3) };
  };

  /* ---------- la titularidad de cada jugador, juntando fuentes ---------- */
  // (rehecha el 19 nov, Carlos: «revisa a fondo los porcentajes de titularidad»). Dos fuentes:
  // 1. Sus minutos en LaLiga (`pTitularMinutos`, abajo): los de sus 3 últimas convocatorias, los de la temporada y lo que
  //    vale frente al que más vale de su puesto en su equipo. Ajustado con las 12 primeras jornadas de la 26/27 (4.082 casos
  //    de jugador convocado y jornada): con lo de las jornadas 4-9 acierta en las 10-12 un 13 % mejor que la cuenta de
  //    antes (Brier 0,137 frente a 0,158) y lo que dice se cumple (de los que da al 80-90 %, juegan de titular el 84 %).
  // 2. El once probable de futbolfantasy, con el % que da para ese partido (también a los suplentes), solo si la página
  //    de su equipo ha llegado (`M.hayOnceDe`). Pesa la mitad.
  // La duda: ×0,6 a los minutos (el % del once probable ya la cuenta si la trae). La rotación por partidos de Europa o Copa,
  // solo a los minutos (el once probable ya es el de ese partido).
  const CONF = { titular: 'titular', suplente: 'suplente', nosale: 'no sale de titular', fuera: 'no convocado', baja: 'baja' };
  // el que más vale de cada puesto en cada equipo, de los que pueden jugar
  let topPuesto = null;
  const topDe = (j) => {
    if (!topPuesto) {
      topPuesto = {};
      for (const x of Object.values(D.maestro || {})) {
        if (!x || !x.pos || x.pos > 4 || MALOS.has(x.estado)) continue;
        const k = `${x.equipoId}|${x.pos}`;
        if ((x.valor || 0) > (topPuesto[k] || 0)) topPuesto[k] = x.valor || 0;
      }
    }
    return topPuesto[`${j.equipoId}|${j.pos}`] || 0;
  };
  M.titularidad = (j) => {
    if (!j || !j.pos || j.pos === 5) return null;
    const al = M.alineacion(j.id);
    if (al) { const p = al.estado === 'titular' ? 0.98 : 0; return { p, base: p, fuentes: [{ f: `alineación confirmada: ${CONF[al.estado] || al.estado}`, p, w: 1 }], rot: null, pRot: 0, confirmada: al.estado }; }
    if (MALOS.has(j.estado)) return { p: 0, base: 0, fuentes: [{ f: j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga', p: 0, w: 1 }], rot: null, pRot: 0 };
    const conFF = M.hayOnceDe(j);
    const op = conFF ? onces[j.id] || null : null;
    if (op && op.estado === 'injured') return { p: 0, base: 0, fuentes: [{ f: 'lesionado, según la prensa', p: 0, w: 1 }], rot: null, pRot: 0 };
    const duda = j.estado === 'doubtful' || !!(op && op.estado === 'doubtful');
    const fuentes = [];
    // sus minutos
    const d = det[j.id];
    const top = topDe(j);
    const vrel = top ? clamp((j.valor || 0) / top, 0, 1) : 0.5;
    let pm = d && !d.error && Array.isArray(d.stats) && d.stats.length ? pTitularMinutos(d.stats.map((x) => x.min), vrel) : null;
    let fMin = 'sus minutos';
    // sin su ficha de LaLiga (solo se pide la de los tuyos, el mercado y las cláusulas), sus minutos de la temporada de
    // SofaScore o Understat, si los hay: la misma cuenta con su media en todas (sin saber cómo van las últimas)
    if (pm == null) {
      const a = M.avanzado(j.id), tE = tabla[j.equipoId];
      const media = a && a.s && a.s.pj && a.s.tit != null && tE && tE.pj >= 3 ? clamp(a.s.tit / tE.pj, 0, 1)
        : a && a.u && a.u.min && tE && tE.pj >= 3 ? clamp(a.u.min / (tE.pj * 90), 0, 1) : null;
      if (media != null) { pm = pTitularMinutos(Array(Math.min(tE.pj, 10)).fill(media * 90), vrel); fMin = 'temporada'; }
    }
    if (pm != null) fuentes.push({ f: fMin, p: pm, w: 0.5 });
    // el once probable de su equipo: su % si lo trae; si no, titular 85 %, suplente 30 % y, si no sale ni en la lista, 8 %
    let pf = null;
    if (conFF) {
      pf = op && op.prob != null ? op.prob / 100 : op && op.titular ? 0.85 : op && op.alternativa ? 0.3 : 0.08;
      fuentes.push({ f: op && op.titular ? 'once probable' : op ? 'suplente en el once probable' : 'fuera del once probable', p: pf, w: 0.5 });
      if (duda && !(op && op.prob != null)) pf *= 0.6;
    }
    if (!fuentes.length) return null;
    const W = fuentes.reduce((s, x) => s + x.w, 0);
    const base = fuentes.reduce((s, x) => s + x.p * x.w, 0) / W;
    const rot = M.rotacion(j.equipoId);
    // al indiscutible se le rota menos; al que está en el filo, más (solo a la parte de los minutos)
    let pmAj = pm;
    let pRot = 0;
    if (pm != null) {
      if (duda) pmAj *= 0.6;
      pRot = rot && rot.riesgo ? rot.riesgo * (pmAj >= 0.85 ? 0.6 : pmAj >= 0.5 ? 1.2 : 0.5) : 0;
      pmAj *= 1 - pRot;
    }
    const p = pm != null && pf != null ? (pmAj + pf) / 2 : pm != null ? pmAj : pf;
    // pRot: lo que quita la rotación al total (para el aviso de la ficha)
    // pMin: lo de sus minutos con la duda y sin la rotación (para los partidos de después del próximo: el once probable es
    // solo el del próximo)
    return { p: clamp(p, 0, 0.98), base, fuentes, rot, pRot: pm != null && pf != null ? pRot / 2 : pRot, pMin: pm != null ? clamp(pm * (duda ? 0.6 : 1), 0, 0.98) : null };
  };

  /* ---------- ¿conviene esperar antes de mandar vender a uno tuyo que baja? (aviso de Domy, 2 nov) ---------- */
  // Las ventas por bajada de Hoy y del plan solo miraban cuánto ha caído en 7 días. Domy pidió que cuenten también
  // los días de cláusula que le quedan, lo que ha subido el último día y cuándo juega. Devuelve el motivo para esperar
  // (y la nota con los días de cláusula, que sale siempre) o null si se puede vender ya. Con la cláusula protegida
  // (14 días de fichaje o blindaje) nadie lo clausula: no hay prisa por ese lado, pero tampoco cobras cláusula
  // Qué dice la cláusula ABIERTA de uno tuyo frente a venderlo a LaLiga (aviso de Domy, 6 nov: «cuando te recomiende una
  // venta, tiene que tener en cuenta en qué valor se encuentra la cláusula abierta»). Antes solo salía «su cláusula está
  // abierta» sin cifras. Ahora dice cuánto es, cuánto sobre su valor, cuánto daría LaLiga y qué sale mejor. `espera`: la
  // cláusula está por encima de LaLiga y a algún rival le llega (si te lo clausulan cobras más que vendiéndolo)
  M.ventaClausula = (x) => {
    if (!x || !x.j || !x.abierta || !x.clausula || !x.j.valor) return null;
    const vLiga = M.ofertaLiga && !M.ofertaLiga.poco ? Math.max(0, M.ofertaLiga.med) : 0.05;
    const liga = x.j.valor * (1 + vLiga), sobre = x.clausula / x.j.valor - 1;
    const pg = x.pagan, llega = !!(pg && pg.seguro && pg.seguro.length), nadie = !!(pg && pg.hayDatos && !llega && !(pg.quiza && pg.quiza.length));
    // (24 nov, «menos texto») más corto: la cláusula, lo que da LaLiga y qué sale mejor
    const cab = `Su cláusula abierta: ${eur(x.clausula)} (${sobre >= 0.005 ? `+${pct(sobre * 100, 0, false)}` : 'a su valor'}); a LaLiga, esperando a una buena oferta, unos ${eur(liga)}`;
    if (x.clausula >= liga) {
      if (llega && ['medio', 'alto'].includes(x.riesgo)) return { tipo: 'clausula', espera: true, txt: `${cab}. A algún rival le llega: si te lo clausulan, cobras más que vendiéndolo.` };
      if (nadie) return { tipo: 'nadie', espera: false, txt: `${cab}. No le llega a ningún rival: no te lo van a quitar.` };
      return { tipo: 'alta', espera: false, txt: `${cab}. Paga más, pero no es seguro que alguien la pague.` };
    }
    if (x.riesgo && x.riesgo !== 'ninguno') return { tipo: 'baja', espera: false, txt: `${cab}. Te lo pueden clausular por menos: si lo vendes, mejor a LaLiga.` };
    return { tipo: 'baja', espera: false, txt: `${cab}.` };
  };
  M.esperarVenta = (x) => {
    // (de baja no hay nada que esperar; con una sanción de un partido, como cualquier otro. Antes devolvía null y quien
    // miraba .tipo de uno de baja fallaba)
    if (!x || !x.j || M.deBaja(x.j)) return { tipo: null, nota: '', texto: '' };
    const diasProt = x.abreEn > 0 ? Math.max(1, Math.ceil(x.abreEn / DIA)) : 0;
    const notaClausula = diasProt
      ? `Su cláusula sigue protegida ${diasProt} día${diasProt > 1 ? 's' : ''} más: nadie te lo puede clausular hasta entonces.`
      : (M.ventaClausula(x) || {}).txt || (x.clausula ? `Su cláusula (${eur(x.clausula)}) está abierta.` : '');
    // 1. juega pronto y es titular: lo normal es esperar a ver cómo puntúa antes de venderlo a LaLiga
    const p = M.proximoPartido(x.j.equipoId);
    const tit = M.titularidad(x.j);
    if (p && p.fecha > ahora && p.fecha - ahora < 2 * DIA && tit && tit.p >= 0.7) {
      return { tipo: 'juega', nota: notaClausula, texto: `Juega ${cuando(p.fecha)} contra ${p.rival} y es titular probable (${Math.round(tit.p * 100)} %): espera al partido, si puntúa bien la bajada se frena.` };
    }
    // 2. ha subido el último día: la bajada de la semana ya se está frenando
    if (x.tend && x.tend.p1 != null && x.tend.p1 >= 1) {
      return { tipo: 'sube', nota: notaClausula, texto: `Hoy ha subido ${pct(x.tend.p1, 1, false)}: la bajada de la semana se está frenando, mejor esperar un día.` };
    }
    // 3. cláusula abierta, por encima de lo que da LaLiga y con quien pueda pagarla: si te lo clausulan cobras más
    const vc = M.ventaClausula(x);
    if (vc && vc.espera) return { tipo: 'clausula', nota: notaClausula, texto: vc.txt };
    return { tipo: null, nota: notaClausula, texto: '' };
  };

  /* ---------- ¿lo vendo o me lo quedo? (Carlos y Fran, 20 nov) ----------
     «Lo único que controlo es el dinero»: el valor cambia una vez al día y sigue una tendencia; los puntos nunca se saben.
     Lo que hace perder es vender tarde uno que baja (o pagar por subirle la cláusula, como con Diomande) y dejar que un
     rival se lleve a su valor uno que sube. A LaLiga se le vende en el siguiente cambio de mercado, con su ± y algo de
     suerte; a un rival, al momento, y se le puede pedir más que a LaLiga cuando la cláusula se abre pronto y le llega
     (se ahorra pelearla en el minuto en que se abre y lo estrena con 14 días protegido). Por encima de la cláusula, si se
     la puede pagar, no paga nadie. La IA mezclaba la oferta de LaLiga con la cláusula y no miraba la tendencia: aquí van
     las cuentas hechas y un veredicto, como con las ofertas. */
  M.ventaMia = (x) => {
    if (!x || !x.j || !x.j.valor || x.j.pos === 5) return null;
    const v = x.j.valor, ine = x.inercia || M.inercia(x.pid), t = x.tend || M.tend(x.pid) || {};
    const r10 = (y) => Math.round(y / 1e4) * 1e4;
    const hoy = ine ? ine.ult : t.d1 != null ? t.d1 : null;
    const p7 = ine ? ine.proy(7) : t.d7 != null ? t.d7 : null, p14 = ine ? ine.proy(14) : p7 != null ? p7 * 2 : null;
    // LaLiga: lo que suele dar en esta liga (sin datos, ±10 % de su valor, lo que ha visto Carlos)
    const OL = M.ofertaLigaDe(x.j) || {};
    const liga = { v: OL.v || v, min: OL.min != null ? OL.min : r10(v * 0.9), max: OL.max != null ? OL.max : r10(v * 1.1), sinDatos: !!OL.sinDatos, cuando: M.cierreMercado || null, med: OL.med || 0, una: OL.una || { min: r10(v * 0.9), max: r10(v * 1.1) } };
    const fase = ine ? ine.fase : null;
    const baja = ['giro', 'baja'].includes(fase) || !!x.ventaInercia || (p7 != null && p7 < -Math.max(300000, v * 0.015));
    const sube = !baja && ['sube', 'acelera', 'frena'].includes(fase) && p7 != null && p7 > Math.max(300000, v * 0.015);
    // la cláusula: cuándo se puede pagar y si está cerca de su valor (o lo estará cuando se abra: si el valor la pasa,
    // LaLiga la sube sola hasta el valor)
    const abreEn = x.abierta ? 0 : Math.max(0, x.abreEn || 0);
    const pronto = !!x.clausula && (x.abierta || abreEn < 3 * DIA);
    const diasAbre = abreEn / DIA;
    const valorAbre = v + (ine && diasAbre >= 1 ? ine.proy(diasAbre) : 0);
    const cz = M.clausulazos && M.clausulazos.n >= 3 ? M.clausulazos : null, med = cz ? cz.med : 0.2;
    const sobreAbre = x.clausula ? Math.max(x.clausula, valorAbre) / Math.max(1, valorAbre) - 1 : null;
    const presa = sobreAbre != null && sobreAbre <= med;
    const pg = x.pagan || (x.clausula ? M.quienPaga(x.clausula) : null);
    const pagan = pg ? pg.seguro.map((y) => y.nombre) : [], quiza = pg ? pg.quiza.map((y) => y.nombre) : [];
    const leLlega = pagan.length > 0 || quiza.length > 0;
    // a un rival: como poco lo que daría LaLiga en una buena oferta (si no, mejor LaLiga); como mucho, la cláusula si se
    // la puede pagar pronto, o su valor más lo que suba en los 14 días que lo estrena protegido
    // a un rival: desde lo que daría LaLiga de normal (es lo mismo, pero al momento y sin suerte) hasta una oferta alta de
    // LaLiga o, si sube, su valor más lo que suba en los 14 días que lo estrena protegido
    const piso = Math.max(liga.v, v);
    let techo = Math.max(liga.max, piso, sube && p14 > 0 ? v + p14 : 0);
    // si un rival puede pagar la cláusula ya o en unos días, por encima de ella no paga: es su otra vía (y se le puede
    // pedir hasta ella: se ahorra pelearla en el minuto en que se abre), sin pasar de lo que se paga aquí por un clausulazo
    if (x.clausula && leLlega && (pronto || techo > x.clausula)) techo = Math.min(x.clausula, Math.max(techo, v * (1 + (cz ? cz.p90 : 0.3))));
    const rival = { piso: r10(Math.min(piso, techo)), techo: r10(techo), corto: techo <= piso * 1.005 };
    // lo que le aporta al once (puntos por jornada que pierde sin él)
    const pts = M.perdida ? M.perdida(x.pid) : 0;
    const espera = M.esperarVenta ? M.esperarVenta(x) : { tipo: null, texto: '' };
    const veredicto = baja ? 'vender' : sube && pronto && presa && leLlega ? 'proteger' : sube ? 'quedar' : pts >= 1 ? 'quedar' : 'da-igual';
    // protegerlo: el escudo si está abierta y quedan (gratis); subir la cláusula solo si cuesta menos de lo que va a subir
    let proteger = null;
    if (veredicto === 'proteger') {
      const ES = M.escudosMios || { quedan: 0 };
      if (x.escudo) proteger = { como: 'ya' };
      else if (ES.quedan && x.abierta) proteger = { como: 'escudo' };
      else if (x.blindaje && !x.blindaje.yaVale && x.blindaje.coste > 0 && x.blindaje.coste <= Math.max(0, p14 || 0) / 2) proteger = { como: 'subir', objetivo: x.blindaje.objetivo, coste: x.blindaje.coste };
      else if (ES.quedan && !x.abierta) proteger = { como: 'escudo-al-abrir' };
      else proteger = { como: 'caro', coste: x.blindaje && x.blindaje.coste ? x.blindaje.coste : null };
    }
    // una oferta por encima de su cláusula: es más de lo que cobras si te lo clausulan. Solo no compensa si sube tanto
    // que en 14 días valdrá más (y LaLiga le subirá la cláusula sola hasta su valor)
    const aceptarDesde = x.clausula ? r10(Math.max(x.clausula, sube && p14 > 0 ? v + p14 : 0, piso)) : rival.piso;
    return { pid: x.pid, j: x.j, v, hoy, p7, p14, fase, liga, clausula: x.clausula || null, abierta: !!x.abierta, abre: x.abierta ? null : x.protegidoHasta || null, veda: !!x.veda, sobre: x.ratio != null ? x.ratio - 1 : null, presa, pagan, quiza, sinSaber: !pg || !pg.hayDatos, rival, pts, veredicto, proteger, sube, baja, pronto, espera: espera && espera.tipo ? espera : null, aceptarDesde, blindaje: x.blindaje || null, escudo: !!x.escudo };
  };

  /* ---------- los puntos esperados por partes, como puntúa LaLiga Fantasy ---------- */
  // minutos (2 si juega 60', 1 si menos), gol (6 portero y defensa, 5 medio, 4 delantero) con su xG, asistencia (3)
  // con su xA, portería a cero (4 portero, 3 defensa, 2 medio, 1 delantero, solo con 60' o más) con lo que marca el rival,
  // goles encajados (−2 cada dos a porteros y defensas, −1 cada dos a medios y delanteros; tabla comprobada el 3 nov con 4.072
  // fichas de jornada de LaLiga: guias/puntos-laliga-fantasy.html), paradas (1 cada 2), tarjetas,
  // y el resto (nota de DAZN, recuperaciones, tiros…) de lo que suele sacar
  const PG = { 1: 6, 2: 6, 3: 5, 4: 4 }, PC = { 1: 4, 2: 3, 3: 2, 4: 1 }, PE = { 1: 0.85, 2: 0.85, 3: 0.42, 4: 0.42 };
  // xG y xA por 90' típicos de cada puesto, si no hay datos suyos
  const RITMO = { 1: [0, 0.01], 2: [0.05, 0.07], 3: [0.12, 0.13], 4: [0.36, 0.12] };
  const cacheDes = {};
  M.desglose = (j) => {
    if (!j || !j.pos || j.pos === 5) return null;
    if (cacheDes[j.id] !== undefined) return cacheDes[j.id];
    const T = M.titularidad(j), pr = M.previa(j);
    if (!T || !pr || pr.golesFavor == null) return (cacheDes[j.id] = null);
    // (el que no va convocado o está de baja no sale ni de suplente)
    const pT = T.p, pS = T.confirmada === 'fuera' || T.confirmada === 'baja' ? 0 : (1 - pT) * 0.45;
    const min = pT * 80 + pS * 22, f90 = min / 90;
    const a = M.avanzado(j.id) || {}, u = a.u, s = a.s;
    const conU = !!(u && u.min >= 270), conS = !!(s && s.min >= 270 && s.xg != null);
    const xg90 = conU ? (u.xg * 90) / u.min : conS ? (s.xg * 90) / s.min : RITMO[j.pos][0];
    const xa90 = conU ? (u.xa * 90) / u.min : conS && s.xa != null ? (s.xa * 90) / s.min : RITMO[j.pos][1];
    const tE = tabla[j.equipoId], xt = M.xgEquipo(j.equipoId);
    const mediaEq = xt && xt.xg != null ? xt.xg : tE && tE.pj ? tE.gf / tE.pj : mediaGoles;
    const mediaContra = xt && xt.xga != null ? xt.xga : tE && tE.pj ? tE.gc / tE.pj : mediaGoles;
    // lo que se espera que marque su equipo en ESTE partido frente a lo que marca normalmente
    const fAt = clamp(pr.golesFavor / Math.max(0.4, mediaEq), 0.5, 1.8);
    const partes = {
      min: pT * 2 + pS,
      gol: xg90 * f90 * fAt * PG[j.pos],
      asis: xa90 * f90 * fAt * 3,
      cero: (pr.cero || 0) * pT * 0.92 * PC[j.pos],
      encaja: -(pr.golesContra || 0) * f90 * (PE[j.pos] || 0),
    };
    if (j.pos === 1) {
      const par90 = s && s.min >= 270 && s.paradas != null ? (s.paradas * 90) / s.min : 2.6;
      partes.paradas = (par90 * f90 * clamp((pr.golesContra || mediaContra) / Math.max(0.4, mediaContra), 0.6, 1.6)) / 2;
    }
    const am90 = conU && u.am != null ? (num(u.am) * 90) / u.min : 0.2, ro90 = conU && u.ro != null ? (num(u.ro) * 90) / u.min : 0.01;
    partes.tarjetas = -(am90 + ro90 * 3) * f90;
    // el resto: lo que saca de media por partido menos lo que explican sus minutos, goles, asistencias, ceros y tarjetas
    let resto90 = 1.4;
    const pj = s && s.pj ? s.pj : u && u.pj ? u.pj : null;
    if (num(j.media) > 0 && pj >= 3) {
      const g = conU ? u.g : s ? num(s.g) : 0, as = conU ? u.a : s ? num(s.a) : 0;
      const minPj = conU ? u.min / pj : s && s.min ? s.min / pj : 75;
      const tit = s && s.tit != null ? s.tit / pj : clamp(minPj / 90, 0, 1);
      const ceros = tE && tE.pj ? tE.ult.filter((x) => x.gc === 0).length / tE.pj : 0.25;
      const encajados = tE && tE.pj ? tE.gc / tE.pj : mediaGoles;
      const expl = tit * 2 + (1 - tit) + (g / pj) * PG[j.pos] + (as / pj) * 3 + ceros * tit * PC[j.pos]
        - encajados * (minPj / 90) * (PE[j.pos] || 0) - (conU && u.am != null ? (num(u.am) + num(u.ro) * 3) / pj : 0.2)
        + (j.pos === 1 && s && s.paradas ? s.paradas / pj / 2 : 0);
      resto90 = clamp(num(j.media) - expl, -1, 5) / Math.max(0.35, minPj / 90);
    }
    // el resto (la nota del partido, recuperaciones, tiros, duelos…) también depende de cómo le vaya a su equipo: contra
    // uno muy superior se defiende más, se pierde y las notas bajan. Antes contaba igual contra cualquiera (aviso de
    // Domy, 30 oct: un defensa del Racing contra el Madrid). Se mueve con la diferencia de goles que se espera en ESTE
    // partido frente a la que suele tener su equipo: un gol peor que lo normal, un 20 % menos
    const fRes = clamp(1 + 0.2 * ((pr.golesFavor - (pr.golesContra || 0)) - (mediaEq - mediaContra)), 0.55, 1.35);
    partes.resto = resto90 * f90 * (resto90 > 0 ? fRes : 1);
    for (const k of Object.keys(partes)) if (!Number.isFinite(partes[k])) partes[k] = 0;
    const total = Math.max(0, Object.values(partes).reduce((x, y) => x + y, 0));
    return (cacheDes[j.id] = { total, partes, pT, min, T, fAt, fRes, xg90, xa90, fuente: conU || conS ? 'datos' : 'medias del puesto' });
  };

  /* ---------- los puntos esperados: la fórmula de siempre y el desglose, corregidos con lo que se ha fallado ---------- */
  // calib (de aprende.js): cuánto pesa el desglose frente a la fórmula de siempre según cuál ha acertado más, y el
  // sesgo de cada puesto (si a los delanteros se les espera de más, se baja)
  const cal = extra.calib || null;
  M.calib = cal;
  const wDes = cal && cal.w != null ? cal.w : 0.5;
  const cachePP = {};
  M.ppDetalle = (j) => {
    if (!j || !j.id) return null;
    if (cachePP[j.id]) return cachePP[j.id];
    const T = j.pos && j.pos !== 5 ? M.titularidad(j) : null;
    const al = T && T.confirmada;
    const onceJ = al ? (al === 'titular' ? { titular: true, prob: 100 } : al === 'suplente' || al === 'nosale' ? { alternativa: true } : { estado: 'injured' }) : M.hayOnceDe(j) ? (onces[j.id] || { fuera: true }) : null;
    let base = puntosEsperados(j, M.forma(j.id), onceJ) * M.factorRival(j).f;
    if (T && T.pRot) base *= 1 - T.pRot;
    const d = M.desglose(j);
    const crudo = d ? wDes * d.total + (1 - wDes) * base : base;
    const sesgo = cal && cal.sesgo && cal.sesgo[j.pos] ? cal.sesgo[j.pos] : 1;
    return (cachePP[j.id] = { base, desg: d ? d.total : null, crudo, final: crudo * sesgo, sesgo, w: d ? wDes : 0, d, T });
  };
  M.ppEsperado = (j) => (M.ppDetalle(j) || { final: 0 }).final;

  /* ---------- el calendario de riesgo: sus próximos partidos de una vez ---------- */
  // Un jugador vale lo que puntúa mientras lo tienes. Se miran sus próximos 5 partidos (o todos los de los 14 días
  // que un fichaje tiene la cláusula protegida, si son más): contra quién, lo difícil que es, en casa o fuera, lo que
  // se espera que puntúe en cada uno y si será titular (con la rotación si su equipo juega otra competición cerca).
  // Con un calendario duro, fichar solo compensa de parche y sin pagar de más.
  const factorContra = (j, rid, casa) => {
    const r = tabla[rid];
    if (!r || r.pj < 3) return { f: casa ? 1.04 : 0.96, r: r || null, nivel: null };
    const f = fuerzaContra(j.pos, r, casa);
    // lo difícil que es PARA ÉL (un defensa sufre con el que marca mucho; un delantero, con el que no encaja), en
    // casa o fuera: no basta con la tabla
    return { f, r, nivel: f <= 0.93 ? 'difícil' : f >= 1.07 ? 'fácil' : 'media' };
  };
  /** lo que le resta la rotación en un partido concreto (si su equipo juega otra competición a menos de 4 días) */
  const rotacionEn = (eqId, t, p) => {
    const lista = calEx[eqId] || [];
    let riesgo = 0;
    const cerca = [];
    for (const x of lista) {
      if (!x.t || x.liga) continue;
      const dias = Math.abs(x.t - t) / DIA;
      if (dias > 4.2 || dias < 8 / 24) continue;
      const peso = /champions/i.test(x.comp) ? 0.14 : /europa|conference/i.test(x.comp) ? 0.11 : /copa|supercopa|cup/i.test(x.comp) ? 0.04 : 0.06;
      riesgo += peso * (dias <= 3.2 ? 1 : 0.6);
      cerca.push(x.comp);
    }
    riesgo = clamp(riesgo, 0, 0.3) * (p >= 0.9 ? 0.6 : p >= 0.5 ? 1.2 : 0.5);
    return { riesgo, cerca };
  };
  /**
   * cómo le fue a un equipo las últimas veces contra otro (SofaScore, todas las competiciones; si no hay, lo de esta
   * temporada en LaLiga): de la más vieja a la más nueva, [{ r: 'V'|'E'|'D', gf, gc, casa, t, comp }]
   */
  const h2hSofa = av.h2h || {}, sofaEq = av.sofaEquipos || {};
  M.h2h = (eqId, rivalId, n = 5) => {
    const a = sofaEq[eqId], b = sofaEq[rivalId];
    let out = [];
    const par = a && b ? h2hSofa[[a, b].sort((x, y) => x - y).join('-')] : null;
    if (par && par.ev && par.ev.length) {
      out = par.ev.filter((e) => e.h === a || e.a === a).map((e) => {
        const casa = e.h === a, gf = casa ? e.gh : e.ga, gc = casa ? e.ga : e.gh;
        return { r: gf > gc ? 'V' : gf === gc ? 'E' : 'D', gf, gc, casa, t: e.t, comp: e.comp };
      });
    } else {
      const t = tabla[eqId];
      out = t ? t.ult.filter((u) => u.rid === rivalId).map((u) => ({ r: u.r, gf: u.gf, gc: u.gc, casa: u.casa, t: null, comp: 'LaLiga', jornada: u.jornada })).reverse() : [];
    }
    return out.slice(0, n).reverse();
  };
  const cacheCal = {};
  // la fecha de una jornada sin fecha: una semana por jornada desde la última con fecha, y otra más si hay parón
  const iniJ = {};
  for (const jo of jornadas) iniJ[jo.n] = jo.ini;
  const fechaEstimada = (n) => {
    if (!n) return null;
    if (iniJ[n]) return iniJ[n];
    const antes = Object.keys(iniJ).map(Number).filter((k) => k < n);
    if (!antes.length) return null;
    const k = Math.max(...antes);
    let t = iniJ[k] + (n - k) * 7 * DIA;
    for (const pa of PAR) if (pa.ini > iniJ[k] && pa.ini < t) t += 7 * DIA;
    return t;
  };
  M.calendarioRiesgo = (j) => {
    if (!j || !j.equipoId || !j.pos || j.pos === 5) return null;
    if (cacheCal[j.id] !== undefined) return cacheCal[j.id];
    const lista = [];
    for (const p of D.partidos || []) {
      const casa = p.localId === j.equipoId;
      if (!casa && p.visitanteId !== j.equipoId) continue;
      // las jornadas lejanas a veces vienen sin fecha (LaLiga aún no la ha puesto): se calcula una aproximada
      const fecha = p.fecha || fechaEstimada(p.jornada);
      if (!fecha || fecha + 2 * HORA < ahora) continue;
      lista.push({ jornada: p.jornada, fecha, sinFecha: !p.fecha, casa, rivalId: casa ? p.visitanteId : p.localId, rival: casa ? p.visitante : p.local });
    }
    lista.sort((a, b) => a.fecha - b.fecha);
    const enProteccion = lista.filter((x) => x.fecha <= ahora + 14 * DIA).length;
    const ps = lista.slice(0, Math.max(Math.min(5, lista.length), enProteccion));
    if (!ps.length) return (cacheCal[j.id] = null);
    // lo que puntúa sin contar el rival (los puntos esperados del próximo partido, quitado su rival)
    const T = M.titularidad(j);
    const fr1 = M.factorRival(j);
    const pp1 = M.ppEsperado(j);
    const sinRival = pp1 > 0 ? pp1 / Math.max(0.5, fr1.f || 1) : num(j.media);
    const p1 = T ? T.p : null;
    const out = ps.map((x, i) => {
      const fc = factorContra(j, x.rivalId, x.casa);
      // el historial cuenta poco (pesa más cómo están ahora): como mucho un 4 % arriba o abajo
      const h2h = M.h2h(j.equipoId, x.rivalId);
      if (h2h.length >= 3) {
        const saldo = h2h.reduce((a, e) => a + (e.r === 'V' ? 1 : e.r === 'D' ? -1 : 0), 0) / h2h.length;
        fc.f = clamp(fc.f * (1 + 0.04 * saldo), 0.75, 1.25);
        if (fc.nivel) fc.nivel = fc.f <= 0.93 ? 'difícil' : fc.f >= 1.07 ? 'fácil' : 'media';
      }
      // la titularidad: la del próximo partido tal cual; para los siguientes, la de base con la rotación de ese día
      let pTit = p1, rot = null;
      if (T && i > 0) {
        const b0 = T.pMin != null ? T.pMin : T.base;
        const ro = rotacionEn(j.equipoId, x.fecha, b0);
        pTit = clamp(b0 * (1 - ro.riesgo), 0, 0.98);
        rot = ro.cerca.length ? ro.cerca : null;
      } else if (T && T.rot && T.rot.cerca && T.rot.cerca.length) rot = T.rot.cerca.map((c) => c.comp);
      const ratio = p1 && pTit != null ? clamp(pTit / Math.max(0.05, p1), 0, 1.5) : 1;
      const pts = Math.max(0, sinRival * fc.f * (i === 0 ? 1 : ratio));
      return { ...x, f: fc.f, nivel: fc.nivel, pos: fc.r ? fc.r.pos : null, pts, pTit, rot, h2h };
    });
    const n = out.length;
    const fAvg = out.reduce((a, x) => a + x.f, 0) / n;
    const nDif = out.filter((x) => x.nivel === 'difícil').length, nFac = out.filter((x) => x.nivel === 'fácil').length, nMed = out.filter((x) => x.nivel === 'media').length;
    const pts = out.reduce((a, x) => a + x.pts, 0);
    const conTit = out.filter((x) => x.pTit != null);
    const pTit = conTit.length ? conTit.reduce((a, x) => a + x.pTit, 0) / conTit.length : null;
    const mitad = Math.ceil(n / 2);
    const tipo = fAvg <= 0.94 || (nDif >= mitad && fAvg < 1) ? 'duro' : (fAvg >= 1.06 && nDif <= Math.floor(n / 3)) || (nFac >= mitad && nDif === 0) ? 'favorable' : 'normal';
    const riesgo = MALOS.has(j.estado) || tipo === 'duro' || (pTit != null && pTit < 0.5) ? 'alto' : (pTit != null && pTit < 0.75) || (tipo === 'normal' && nDif >= 2) ? 'medio' : 'bajo';
    // (un 5 % sobre su valor, o lo bajo de lo que se paga en tu liga por los de su valor si es más: `M.sobreParche`)
    const maxSobre = riesgo === 'alto' ? M.sobreParche(j.valor) : null;
    const consejo = riesgo === 'alto'
      ? (tipo === 'duro' ? `Calendario duro: ficharlo solo de parche y sin pagar más de un ${pct(maxSobre * 100, 0, false)} sobre su valor.` : 'Poco seguro que juegue: solo de parche y sin pagar de más.')
      : tipo === 'favorable' && (pTit == null || pTit >= 0.75) ? 'Calendario favorable: si es titular, se puede pagar algo más por él.' : riesgo === 'medio' ? 'Riesgo medio: mira el precio y si de verdad entra en tu once.' : 'Sin pegas de calendario.';
    const d1c = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
    const trozos = [nDif && `${nDif} difícil${nDif > 1 ? 'es' : ''}`, nMed && `${nMed} de nivel medio`, nFac && `${nFac} fácil${nFac > 1 ? 'es' : ''}`].filter(Boolean);
    const resumen = trozos.length > 1 ? `${trozos.slice(0, -1).join(', ')} y ${trozos[trozos.length - 1]}` : trozos[0] || 'rivales sin datos';
    // «5 partidos (2 difíciles y 3 fáciles): ~33 pts (6,7 por partido; su media es 6,1), titular ~80 %.»
    const texto = `${n} partido${n === 1 ? '' : 's'}${enProteccion > 5 ? ', los de sus 14 días con la cláusula protegida,' : ''} (${resumen}): ~${d1c(pts)} pts (${d1c(pts / n)} por partido${j.media ? `; su media es ${d1c(num(j.media))}` : ''})${pTit != null ? `, titular ~${Math.round(pTit * 100)} %` : ''}.`;
    return (cacheCal[j.id] = { partidos: out, n, fAvg, nDif, nMed, nFac, pts, pTit, tipo, riesgo, maxSobre, consejo, texto, resumen, hasta: out[out.length - 1].fecha });
  };
  M.mejorOnce = (lista) => mejorOnce(lista, M.formaciones, M.ppEsperado, { entrenador: M.premium.entrenador });
  const misJs = misFichasRaw.map((f) => J(f.pid));
  M.once = M.mejorOnce(misJs);
  /** cuántos puntos por jornada gana tu once si fichas a j (0 si se quedaría en el banquillo) */
  const cacheMejora = {};
  M.mejora = (j) => {
    if (!j || !j.pos) return 0;
    if (misJs.some((x) => x.id === j.id)) return 0;
    if (cacheMejora[j.id] != null) return cacheMejora[j.id];
    return (cacheMejora[j.id] = Math.max(0, M.mejorOnce([...misJs, j]).total - M.once.total));
  };
  /** cuántos puntos pierde tu once si vendes a j (0 si es suplente) */
  const cachePerdida = {};
  M.perdida = (pid) => {
    if (cachePerdida[pid] != null) return cachePerdida[pid];
    return (cachePerdida[pid] = Math.max(0, M.once.total - M.mejorOnce(misJs.filter((x) => x.id !== pid)).total));
  };
  // por puesto: cuántos tienes sanos, cuántos necesitas en tu mejor formación y si te sobran
  const MAXIMO = { 1: 1, 2: 5, 3: 5, 4: 3, 5: 1 };
  const DEL_IDEAL = 2;
  M.puestos = [1, 2, 3, 4].map((p) => {
    const sanos = misJs.filter((j) => j.pos === p && !MALOS.has(j.estado)).length;
    const total = misJs.filter((j) => j.pos === p).length;
    const necesita = M.once.formacion ? (p === 1 ? 1 : M.once.formacion[p - 2]) : 0;
    const minimo = p === 1 ? 1 : Math.min(...M.formaciones.map((f) => f[p - 2]));
    const faltan = Math.max(0, minimo - sanos);
    // no obligatorio: con 1 delantero se puede jugar (4-5-1, 5-4-1), pero conviene tener 2 por si se lesiona o no juega
    const conviene = p === 4 && !faltan ? Math.max(0, DEL_IDEAL - sanos) : 0;
    return { pos: p, sanos, total, necesita, faltan, conviene, sobran: Math.max(0, sanos - (MAXIMO[p] + 1)) };
  });

  /**
   * ¿compensa ficharlo con su calendario? Con riesgo alto (calendario duro, poco seguro que juegue o tocado) solo
   * de parche (te falta gente sana en su puesto) y pagando como mucho `cal.maxSobre` sobre su valor (un 5 %, o lo
   * bajo de lo que se paga en tu liga por los de su valor: `M.sobreParche`)
   */
  M.compraCal = (j, precio) => {
    const cal = j ? M.calendarioRiesgo(j) : null;
    if (!cal) return { ok: true, cal: null, txt: '' };
    const puesto = M.puestos.find((p) => p.pos === j.pos);
    const parche = !!(puesto && puesto.faltan > 0);
    const sobre = j.valor && precio ? precio / j.valor - 1 : 0;
    const ok = cal.riesgo !== 'alto' || (parche && sobre <= cal.maxSobre);
    const txt = cal.tipo === 'normal' && cal.riesgo !== 'alto' ? ''
      : `${cal.tipo === 'normal' ? (MALOS.has(j.estado) ? 'No juega, y en' : 'Poco seguro que juegue en') : `Calendario ${cal.tipo} en`} sus próximos ${cal.texto}${cal.riesgo === 'alto' && ok ? ` Solo de parche, y por eso sin pagar más de un ${pct(cal.maxSobre * 100, 0, false)} sobre su valor.` : ''}`;
    return { ok, cal, parche, sobre, txt };
  };

  /* ---------- lo que se paga de más: en euros, no solo en porcentaje, y en una escala continua ---------- */
  // un +25 % por uno de 3 M son 750 mil; por uno de 40 M, 10 M. El índice (0 a 100) crece poco a poco con:
  // - los euros que pierdes de verdad (lo pagado de más menos la mitad de lo que recuperarías en una semana),
  //   comparados con el valor de tu equipo;
  // - y, un poco, el porcentaje por encima de lo que se suele pagar en tu liga por los de su valor (`M.sobreNormal`):
  //   por uno de 40 M, pagar el doble no es serio; por uno de 600 mil puede ser lo normal (Carlos, 30 oct)
  const valorEq = Math.max(num(D.valorEquipo), 50e6);
  M.sobrecoste = (j, precio, t = j ? M.tend(j.id) : null) => {
    if (!j || !j.valor || !precio) return { extra: 0, sobre: 0, indice: 0, dias: null, efectivo: 0, recTxt: '' };
    const extra = precio - j.valor, sobre = precio / j.valor - 1;
    let diario = t ? (t.d7 != null && t.d7 > 0 ? t.d7 / 7 : t.d1 != null && t.d1 > 0 ? t.d1 : 0) : 0;
    // (con 2 o más días subiendo, lo que sube estos días: la de 7 días se queda corta con el que acaba de empezar, 0.7n)
    if (t && t.diaE != null && t.diaE > diario) diario = t.diaE;
    const dias = extra > 0 && diario > 0 ? extra / diario : extra > 0 ? Infinity : 0;
    // lo que sube no está garantizado: se descuenta solo la mitad de lo que recuperaría en una semana
    const efectivo = Math.max(0, extra - diario * 7 * 0.5);
    const x = efectivo / valorEq / 0.02 + Math.max(0, sobre - M.sobreNormal(j.valor)) / 1.2;
    const indice = extra <= 0 ? 0 : Math.round(100 * (1 - Math.exp(-x)));
    const recTxt = extra <= 0 ? '' : !Number.isFinite(dias) ? 'no sube: no lo recuperas' : dias > 30 ? 'con lo que sube tardarías más de un mes en recuperarlo' : `lo recuperas en ${Math.max(1, Math.round(dias))} día${Math.round(dias) <= 1 ? '' : 's'} con lo que sube`;
    return { extra, sobre, dias, diario, efectivo, indice, recTxt };
  };
  /**
   * cuánto sobrecoste se aguanta por un jugador: de 60 si no aporta nada a tu once a 95 si lo mejora mucho
   * (también en escala continua, con lo que suma por jornada)
   */
  M.tolerancia = (j) => {
    const g = j && M.mejora ? Math.max(0, M.mejora(j)) : 0;
    return Math.round(60 + 35 * (1 - Math.exp(-g / 3)));
  };

  /* ---------- la salida de un fichaje caro (aviso de Domy, 29 oct) ---------- */
  // si pagas por uno más de lo que te daría LaLiga al venderlo y luego se tuerce, pierdes la diferencia. Un clausulazo así
  // solo compensa si: lo podrías vender sin perder (o casi), o sube lo bastante para cubrirlo en pocos días sin señales
  // de bajar, o lo fichas por los puntos porque es titular seguro y se espera un buen partido
  M.salida = (j, precio, t = j ? M.tend(j.id) : null) => {
    if (!j || !j.valor || !precio) return null;
    // (lo que suele dar LaLiga por la parte baja: si se tuerce, mejor no contar con la oferta buena)
    const ol = M.ofertaLigaDe(j);
    const venta = ol ? (ol.min || ol.v) : j.valor;
    const pierde = Math.max(0, precio - venta);
    let diario = t ? (t.d7 != null && t.d7 > 0 ? t.d7 / 7 : t.d1 != null && t.d1 > 0 ? t.d1 : 0) : 0;
    // (con 2 o más días subiendo, lo que sube estos días: la de 7 días se queda corta con el que acaba de empezar, 0.7n)
    if (t && t.diaE != null && t.diaE > diario) diario = t.diaE;
    const dias = pierde > 0 ? (diario > 0 ? pierde / diario : Infinity) : 0;
    const ine = M.inercia(j.id);
    // (frenando con 5 días o más de subida por delante no es señal de bajar: lo cubre antes; Carlos, 30 oct)
    const tuerce = !!(ine && (['giro', 'baja'].includes(ine.fase) || (ine.fase === 'frena' && !(ine.giroEn >= 5)))) || !!(t && t.p1 != null && t.p1 < 0);
    const T = M.titularidad(j), des = M.desglose(j);
    const seguro = !!(T && T.p >= 0.9 && !MALOS.has(j.estado) && (des ? des.total >= 5 : num(j.media) >= 6));
    const casiNada = pierde <= j.valor * 0.02;
    const margen = casiNada || (!tuerce && dias <= 5);
    const d = Math.max(1, Math.round(dias));
    const txt = casiNada ? `si se tuerce, lo vendes a LaLiga por unos ${eur(venta)} sin perder`
      : `si se tuerce, venderlo a LaLiga te daría unos ${eur(venta)}: perderías ${eur(pierde)}${tuerce ? ' (y ya da señales de bajar)' : Number.isFinite(dias) ? ` (con lo que sube lo cubre en ${d} día${d === 1 ? '' : 's'})` : ' (y no está subiendo)'}${!margen && seguro ? '; solo compensa por los puntos: titular seguro y se espera un buen partido' : ''}`;
    return { venta, pierde, dias, tuerce, seguro, margen, ok: margen || seguro, txt };
  };
  M.conSalida = (j, precio, t) => { const s = M.salida(j, precio, t); return !s || s.ok; };
  // (11 nov) la regla de clausular de Hoy y las alarmas, para operaciones.js e ia.js (que no importan motor.js)
  M.mereceClausula = (x, ahora) => mereceClausula(M, x, ahora);

  /* ---------- cuánto interesa un jugador (0 a 100) ---------- */
  M.interes = (j, precio, t = M.tend(j.id)) => {
    const partes = [];
    const rend = clamp(num(j.media) / 7, 0, 1.3) * 30;
    if (j.media) partes.push(`${String(Math.round(j.media * 10) / 10).replace('.', ',')} pts de media`);
    const mov = P7(t) != null ? P7(t) : t.p1 != null ? t.p1 * 3 : 0;
    // (16 nov, Carlos) y en euros: un +1 % al día de uno de 90 M (900.000 €) pesa más que un +3 % de uno de 10 M; hasta
    // 6 puntos más (o menos) con un millón al día
    const eurosDia = j.valor ? j.valor * (P7(t) != null ? P7(t) / 7 : num(t.p1)) / 100 : 0;
    const mom0 = clamp(mov / 10, -1, 1) * 15 + clamp(eurosDia / 1e6, -1, 1) * 6;
    let momentum = mom0;
    // lo que importa es hacia dónde va ahora: un +10 % en 7 días que ya ha girado no es una subida
    const ine = M.inercia(j.id);
    // y lo que acaba de puntuar: tras un buen partido LaLiga suele subirle el valor los días siguientes, así que una
    // bajada puede frenarse o darse la vuelta. Antes las cláusulas y el mercado lo miraban como si fuera a seguir
    // bajando (lo avisó Domy el 25 oct). Por escalones, como en la venta: 6-7 suaviza, 8-9 frena, 10 o más da la vuelta
    const pz = M.partidazo(j.id), pzN = pz ? pz.nivel : 0;
    const abajo = !!ine && ['giro', 'baja', 'parado', 'frena'].includes(ine.fase);
    let txtIne = null;
    if (ine) {
      if (ine.fase === 'giro' || ine.fase === 'baja') { momentum = Math.min(momentum, 0) - 8; txtIne = ine.fase === 'giro' ? 'ha girado a la baja' : `baja ${eur(Math.abs(ine.ult))} al día`; }
      else if (ine.fase === 'parado') { momentum = Math.min(momentum, 3) - 4; txtIne = 'se ha estancado tras subir'; }
      else if (ine.fase === 'frena') { momentum -= 5; txtIne = `sube cada vez menos (gira en ~${Math.max(1, Math.round(ine.giroEn))} d)`; }
      else if (ine.fase === 'acelera') momentum += 3;
    }
    const pzTxt = pz ? `acaba de hacer ${pz.pts} pts (J${pz.n})` : '';
    // (si ya ha vuelto a subir estos días, la semana en negativo no cuenta como bajada)
    const cae = abajo || (mom0 < 0 && !(ine && ['sube', 'acelera'].includes(ine.fase)));
    if (pz && cae) {
      // lo que se le quita por bajar: con 10 o más, nada; con 8 o 9, el 40 %; con 6 o 7, el 75 %
      const queda = [1, 0.75, 0.4, 0][pzN];
      if (momentum < 0) momentum *= queda;
      if (pzN >= 3) momentum += 3;
      txtIne = pzN >= 3 ? `venía bajando, pero ${pzTxt}: lo normal es que suba estos días`
        : pzN === 2 ? `venía bajando, pero ${pzTxt}: la bajada puede frenarse`
        : `${txtIne || 'viene bajando'}, aunque ${pzTxt}: puede suavizar la bajada`;
    } else if (pz) momentum += [0, 1, 2, 4][pzN];
    if (txtIne) partes.push(txtIne);
    if (pz && cae) { /* ya lo dice el texto de arriba */ }
    else if (abajo && ine.fase !== 'frena') { /* lo dice la inercia */ }
    else if (t.rRec != null && t.racha >= 2 && t.p7 != null && t.p7 < 2) partes.push(`lleva ${t.racha} días subiendo (un ${pct(t.rRec / 0.9 * 100, 1, false)} al día)`);
    else if (t.p7 != null && Math.abs(t.p7) >= 2) partes.push(`${t.p7 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p7), 1, false)} en 7 días`);
    else if (t.p1 != null && Math.abs(t.p1) >= 1) partes.push(`${t.p1 > 0 ? 'sube' : 'baja'} ${pct(Math.abs(t.p1), 1, false)} hoy`);
    if (pz && !cae) partes.push(pzTxt);
    const ratio = j.valor ? precio / j.valor : 2;
    const barato = clamp((1.6 - ratio) / 0.6, 0, 1) * 20;
    // pagar de más se pierde en el valor del equipo: lo que castiga es el dinero que se pierde, no el porcentaje
    const sc = M.sobrecoste(j, precio, t);
    const caro = sc.indice * 0.5;
    if (ratio <= 1.05) partes.push('cuesta lo que vale');
    else partes.push(`cuesta ${eur(sc.extra)} más de lo que vale (${pct(sc.sobre * 100)}${sc.recTxt ? `; ${sc.recTxt}` : ''})`);
    let pen = 0;
    if (MALOS.has(j.estado)) { pen = j.estado === 'out_of_league' ? 80 : 35; partes.push(j.estado === 'injured' ? 'lesionado' : j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga'); }
    else if (j.estado === 'doubtful') { pen = 12; partes.push('es duda'); }
    // titular o no en su equipo (once probable de futbolfantasy)
    const op = M.onceProb(j.id), alj = M.alineacion(j.id);
    let fueraOnce = 0;
    if (alj) { if (alj.estado === 'titular') partes.push('titular en la alineación confirmada'); else { fueraOnce = alj.estado === 'suplente' || alj.estado === 'nosale' ? 10 : 12; partes.push(alj.estado === 'suplente' ? 'suplente en la alineación confirmada' : alj.estado === 'nosale' ? 'no sale de titular en la alineación confirmada' : 'no va convocado'); } }
    // (25 nov, hallazgo 4) el % es el de la app (`M.titularidad`, el que sale junto al nombre), no el del once probable de
    // fuera: el motivo decía «titular probable (70 %)» y Mercado y la ficha, 66 %
    else if (op && op.titular) { const Tt = M.titularidad(j); partes.push(`titular probable${Tt && Tt.p != null ? ` (${Math.round(Tt.p * 100)} %)` : op.prob != null ? ` (${op.prob} %)` : ''}`); }
    else if (op && op.alternativa) { fueraOnce = 10; partes.push('suplente en el once probable'); }
    else if (M.hayOnceDe(j) && j.pos !== 5 && !op) { fueraOnce = 6; partes.push('no sale en el once probable'); }
    // el próximo rival: no es lo mismo el Barça que el colista
    const fr = M.factorRival(j);
    let rival = 0;
    if (fr.p && fr.nivel) { rival = Math.round((fr.f - 1) * 30); partes.push(`${fr.p.casa ? 'recibe' : 'visita'} al ${fr.p.rival} (${fr.r.pos}º, ${fr.nivel})`); }
    // y los partidos que vienen detrás: con un calendario duro interesa menos, con uno favorable, más
    const cal = j.pos && j.pos < 5 ? M.calendarioRiesgo(j) : null;
    if (cal && cal.n >= 3) {
      rival = Math.round(rival * 0.4 + (cal.fAvg - 1) * 45);
      if (cal.tipo === 'duro') partes.push(`calendario duro (${cal.nDif} difícil${cal.nDif === 1 ? '' : 'es'} en ${cal.n})`);
      else if (cal.tipo === 'favorable') partes.push(`calendario favorable (${cal.nFac} fácil${cal.nFac === 1 ? '' : 'es'} en ${cal.n})`);
    }
    // lo que aporta a TU once: si entra de titular, cuánto suma; si no, si el puesto ya está lleno
    let once = 0;
    const mio = misJs.some((x) => x.id === j.id);
    if (!mio && j.pos && j.pos < 5) {
      const gana = M.mejora(j);
      const puesto = M.puestos.find((p) => p.pos === j.pos);
      if (gana >= 0.3) { once = clamp(gana * 5, 4, 25); partes.push(puesto && puesto.faltan ? `te tapa un hueco en ${NOMBRE_POS[j.pos]} (+${dec1(gana)} pts/jornada)` : `mejora tu once +${dec1(gana)} pts/jornada`); }
      else if (puesto && puesto.conviene) { once = 3; partes.push('te da un segundo delantero de recambio (no entra de titular)'); }
      else { once = puesto && puesto.sobran ? -18 : -6; partes.push(puesto && puesto.sobran ? `te sobran ${NOMBRE_POS[j.pos]}` : 'no entraría en tu once'); }
    }
    return { n: Math.round(clamp(rend + momentum + barato + 12 - pen - fueraOnce + once + rival - caro, 0, 100)), por: partes, once };
  };

  /* ---------- tus jugadores ---------- */
  const valorMedioLiga = (() => { const v = D.clasif.map((e) => num(e.valor)).filter(Boolean).sort((a, b) => a - b); return v.length ? Math.max(50e6, v[Math.floor(v.length / 2)]) : Math.max(50e6, num(D.valorEquipo)); })();
  const misCompras = compras(D, M, yoTid, AH.lista);
  M.mias = misFichasRaw.map((f) => {
    const x = enriquecer(f, yoTid);
    const compra = f.compra || misCompras[f.pid] || null;
    x.compra = compra;
    x.ganado = compra ? x.j.valor - compra : null;
    // sin compra en los movimientos, y con los movimientos completos desde el principio de la liga: venía en tu equipo
    // inicial. No lo pagaste, pero lo que valía entonces es con lo que se compara
    if (!compra && AH.completa && AH.desde) { const v0 = valorEn(f.pid, AH.desde); if (v0) { x.inicial = v0; x.ganadoIni = x.j.valor - v0; } }
    // riesgo de que te lo quiten. Si te lo clausulan, cobras su cláusula: lo que pierdes de verdad son sus puntos en tu
    // once (y lo que fuera a subir). Así que cuenta lo cerca que está la cláusula de su valor y lo que te aporta
    // ¿quién pagaría su cláusula? Cuenta el porcentaje de más (por encima de un 30 % nadie), los EUROS de más (un 20 %
    // son 1 M en uno de 5 M y 16 M en uno de 80 M; se comparan con lo que vale un equipo de tu liga) y lo bueno que es
    // (por uno muy bueno se paga algo más). Sale un número de 0 a 1,3, sin saltos, que se pasa a ninguno/bajo/medio/alto
    let r = 0;
    x.atractivo = 0;
    if (x.ratio != null && x.clausula && (x.abierta || x.abreEn < 36 * HORA)) {
      const pctMas = Math.max(0, x.ratio - 1), eurMas = Math.max(0, x.clausula - x.j.valor);
      const fp = clamp(1 - pctMas / 0.3, 0, 1);
      const fe = clamp(1 - eurMas / (0.04 * valorMedioLiga), 0, 1);
      const fa = clamp(0.6 + num(x.j.media) / 10, 0.6, 1.3);
      x.atractivo = fp * fe * fa;
      r = x.atractivo >= 0.6 ? 3 : x.atractivo >= 0.35 ? 2 : x.atractivo >= 0.15 ? 1 : 0;
      if (!x.abierta) r = Math.max(0, r - 1);
    }
    const CZ = M.clausulazos;
    if (r && CZ && CZ.n >= 3 && x.ratio - 1 > Math.max(CZ.p90, 0.05) + 0.03) r = 0;
    // (17 nov, Baena con la cláusula al +11 % y «riesgo ninguno» cuando en su liga los clausulazos se pagan al +21,8 % de
    // mediana: los euros de más, 7 M, pesaban como si nadie los pagara) con lo que se paga de verdad en tu liga, una
    // cláusula por debajo de la mediana de los clausulazos es una presa (medio), y hasta el p90, posible (bajo). Luego
    // siguen contando la inercia, si te importa y si a alguien le llega el dinero
    if (CZ && CZ.n >= 3 && x.ratio != null && x.clausula && (x.abierta || x.abreEn < 36 * HORA)) {
      const sobre = x.ratio - 1, minimo = sobre <= CZ.med ? 2 : sobre <= CZ.p90 ? 1 : 0;
      r = Math.max(r, x.abierta ? minimo : Math.max(0, minimo - 1));
    }
    // y si está bajando, menos: nadie paga de más por uno que pierde valor (salvo que acabe de hacer 8 puntos o más: ahí
    // lo normal es que la bajada se frene, y es justo cuando los demás lo miran)
    const ineR = M.inercia(x.pid);
    if (r && ineR && ['giro', 'baja', 'parado'].includes(ineR.fase) && ((M.partidazo(x.pid) || {}).nivel || 0) < 2) r = Math.max(0, r - 1);
    x.pierde = M.perdida(x.pid);
    // o uno que está subiendo bien: si te lo quitan a su valor, pierdes lo que iba a subir
    const sube = (() => { const ine = M.inercia(x.pid); return !!ine && (ine.fase === 'sube' || ine.fase === 'acelera') && ine.proyJ >= Math.max(400000, x.j.valor * 0.04); })();
    x.importa = x.pierde >= 0.8 || (sube && x.ratio != null && x.ratio < 1.15);
    // uno que no juega en tu once: que te lo clausulen es como venderlo por su cláusula
    // (solo si la cláusula pasa de lo que da LaLiga al venderlo: si no, te lo quitan más barato de lo que lo venderías)
    const vLiga = M.ofertaLiga && !M.ofertaLiga.poco ? Math.max(0, M.ofertaLiga.med) : 0.05;
    if (r && !x.importa) r = x.pierde < 0.3 && x.ratio >= 1 + vLiga ? 0 : Math.min(r, 1);
    // y quién tiene dinero para pagarla: si no le llega a nadie, el riesgo baja (aunque pueden vender y juntarlo)
    x.pagan = x.clausula ? M.quienPaga(x.clausula) : null;
    if (r && x.pagan) {
      const p = x.pagan;
      if (p.seguro.length >= 2 && x.atractivo >= 0.35) r = Math.min(3, r + 1);
      else if (p.hayDatos && !p.seguro.length && !p.quiza.length) r = Math.min(r, p.sinSaber.length ? 2 : 1);
    }
    x.riesgo = ['ninguno', 'bajo', 'medio', 'alto'][r];
    // el blindaje justo: hasta dónde subir la cláusula para que no le llegue a nadie (subir X cuesta X/2)
    if (x.clausula && (x.abierta || x.abreEn < 2 * DIA) && x.pagan && M.conDinero) {
      const caps = M.rivalesTid.map((tid) => ({ tid, nombre: nombreEquipo(tid), c: M.capacidad(tid) })).filter((y) => y.c).sort((a, b) => b.c.alto - a.c.alto);
      const hasta = (v) => Math.ceil((Math.max(v, 0) * 1.03 + 1) / 1e5) * 1e5;
      if (caps.length) {
        // tampoco hace falta pasar de lo que de verdad se paga en tu liga por una cláusula: nadie paga el doble de lo que
        // vale un jugador por mucho dinero que tenga. Por encima de lo más que se suele pagar (el 90 % de los clausulazos
        // de tu liga, con un 5 % de margen; un +50 % si aún no hay bastantes) está a salvo
        const czP = M.clausulazos && M.clausulazos.n >= 3 ? Math.max(0.25, M.clausulazos.p90) : 0.5;
        const techo = hasta(x.j.valor * (1 + czP + 0.05));
        const T0 = hasta(caps[0].c.alto), T = Math.min(T0, techo);
        const coste = (t) => Math.ceil((t - x.clausula) / 2 / 1e4) * 1e4;
        // (20 nov, Carlos: «las cláusulas en el fantasy no se suben casi nunca; gastarte 10 millones en subir la cláusula
        // a un tío no es nada real») pagar por subirla solo compensa si cuesta muy poco: un 5 % de lo que vale como mucho
        // (antes, un 25 %: con Berenguer salían 10,91 M), y nunca a uno que ya se frena o baja (se vende pronto)
        const ineB = M.inercia ? M.inercia(x.pid) : null;
        const tope = ineB && ['frena', 'giro', 'baja', 'parado'].includes(ineB.fase) ? 0 : x.j.valor * 0.05;
        const aSalvo = x.ratio != null && x.ratio >= 1 + czP + 0.05;
        x.blindaje = T > x.clausula && !aSalvo ? { objetivo: T, coste: coste(T), rico: caps[0].nombre, caro: coste(T) > tope, porTecho: T < T0, techoPct: czP } : { objetivo: x.clausula, coste: 0, rico: caps[0].nombre, yaVale: true };
        // si dejarlo fuera del alcance de todos no compensa: la subida más barata que deja fuera a casi todos
        if (x.blindaje.caro) {
          // (solo si deja fuera a casi todos: con más de dos que aún pueden, no protege)
          for (let k = 1; k <= Math.min(2, caps.length - 1); k++) {
            const Tk = Math.min(hasta(caps[k].c.alto), techo);
            if (Tk <= x.clausula) break;
            if (coste(Tk) <= tope) { x.blindaje.parcial = { objetivo: Tk, coste: coste(Tk), quedan: caps.slice(0, k).map((y) => y.nombre) }; break; }
          }
        }
        x.blindaje.sinSaber = x.pagan.sinSaber.map((y) => y.nombre);
      }
    }
    // sin riesgo, nada que blindar: salía «súbela a X» para jugadores que nadie va a clausular (revisión del 25 oct)
    if (x.riesgo === 'ninguno' && x.blindaje && !x.blindaje.yaVale) x.blindaje = null;
    x.prox = M.proximoPartido(x.j.equipoId);
    x.inercia = M.inercia(x.pid);
    x.ventaInercia = M.ventaPorInercia(x.pid);
    // (23 nov, Carlos con Thiago: baja, 1 punto en la última y la cláusula al +24 %; «no tiene sentido que me diga que lo
    // blinde») al que está bajando, que te lo clausulen es venderlo por más de lo que te da LaLiga: no se blinda ni se
    // sube su cláusula (salvo tras un partido de 8 o más, que suele frenar la bajada)
    {
      const olB = M.ofertaLigaDe(x.j), bs = M.bajaSeguido(x.pid);
      const bajando = ((ineR && ['giro', 'baja', 'parado'].includes(ineR.fase)) || !!bs) && ((M.partidazo(x.pid) || {}).nivel || 0) < 2;
      x.noBlindar = bajando && x.clausula && olB && x.clausula >= olB.v && !M.noVender.has(x.pid)
        // (25 nov, hallazgo 8: «te pagan 1,65 M, más que vendiéndolo a LaLiga (1,65 M)», con 1.654.843 contra 1.650.000) si
        // las dos cifras se leen igual, «lo mismo que»
        ? { texto: `si te lo clausulan te pagan ${eur(x.clausula)}, ${eur(x.clausula) === eur(olB.v) ? 'lo mismo que' : 'más que'} vendiéndolo a LaLiga (${eur(olB.v)}), y está bajando`, ol: olB.v, igual: eur(x.clausula) === eur(olB.v) } : null;
    }
    return x;
  }).sort((a, b) => a.j.pos - b.j.pos || b.j.valor - a.j.valor);
  /** los que cuentan en el tope de tu plantilla (sin los entrenadores en una liga premium que los tiene) y si está llena */
  M.nPlantilla = M.cuentaPlantilla(M.mias.map((x) => x.j));
  M.llena = M.nPlantilla >= M.TOPE;
  M.ganadoTotal = M.mias.reduce((s, x) => s + (x.ganado || 0), 0);
  M.conCompra = M.mias.filter((x) => x.compra).length;

  /* ---------- cláusulas de los rivales ---------- */
  M.clausulas = [];
  for (const [tid, fichas] of Object.entries(D.plantillas || {})) {
    if (tid === yoTid) continue;
    for (const f of fichas) {
      if (!f.clausula || (D.maestro[f.pid] || {}).pos === 5) continue;
      // (ya no es suyo: la actividad dice que lo ha fichado otro o que lo has fichado tú)
      if (M.dueno[f.pid] !== tid) continue;
      const x = enriquecer(f, tid);
      x.rival = M.equipo[tid] || { nombre: 'Rival' };
      // una cláusula solo se paga con saldo: LaLiga no deja clausular quedándote en negativo (solo pujando en el mercado)
      x.meLlega = x.clausula <= num(D.dinero);
      x.teQueda = num(D.dinero) - x.clausula;
      const i = M.interes(x.j, x.clausula, x.tend);
      x.interes = i.n; x.por = i.por;
      x.prox = M.proximoPartido(x.j.equipoId);
      M.clausulas.push(x);
    }
  }
  M.clausulas.sort((a, b) => b.interes - a.interes);

  /* ---------- mercado ---------- */
  // un «libre de la liga» que ya tiene dueño en la liga no está a la venta: es que alguien lo acaba de fichar
  // (la API lo sigue devolviendo un rato); se quita, no se toma por una venta de ese manager
  M.mercadoFantasma = (D.mercado || []).filter((m) => m.tipo !== 'manager' && M.dueno[m.pid]).map((m) => m.pid);
  // en la versión gratuita no se alinea entrenador: no cuentan para fichar
  const esEnt = (pid) => (D.maestro[pid] || {}).pos === 5;
  // lo que le quedaría al que vende: si se queda sin portero, o con menos defensas, medios o delanteros de los que
  // pide la formación gratuita más justa, no podría alinear un once y no te lo va a vender (aunque lo tenga a la venta:
  // será para ver qué le ofrece LaLiga)
  const minimoPos = { 1: 1 };
  for (const k of [2, 3, 4]) minimoPos[k] = Math.min(...(M.formaciones.length ? M.formaciones : [[3, 3, 1]]).map((f) => f[k - 2]));
  const NOMBRES_POS = { 1: ['portero', 'porteros'], 2: ['defensa', 'defensas'], 3: ['medio', 'medios'], 4: ['delantero', 'delanteros'] };
  const sinRelevo = (tid, j) => {
    if (!tid || tid === yoTid || !(j.pos >= 1 && j.pos <= 4)) return null;
    const quedan = ((D.plantillas || {})[tid] || []).filter((f) => f.pid !== j.id && (D.maestro[f.pid] || {}).pos === j.pos).length;
    if (quedan >= minimoPos[j.pos]) return null;
    const [uno, varios] = NOMBRES_POS[j.pos];
    return quedan === 0 ? `es su único ${uno}` : `se quedaría con ${quedan} ${quedan === 1 ? uno : varios} y no podría alinear`;
  };
  M.mercado = (D.mercado || []).filter((m) => (m.tipo === 'manager' || !M.dueno[m.pid]) && !esEnt(m.pid) && !(m.tipo === 'manager' && vendidos[m.pid] && (!m.vendedorTeamId || m.vendedorTeamId === yoTid))).map((m0) => {
    const dueno0 = M.dueno[m0.pid];
    const m = { ...m0 };
    if (m.tipo === 'manager') {
      const tid = m.vendedorTeamId || dueno0 || (m.vendedorManagerId && M.teamDeUsuario(m.vendedorManagerId, m.vendedor));
      const e = tid && M.equipo[tid];
      if (tid) m.vendedorTeamId = tid;
      if (!m.vendedor && e) m.vendedor = e.manager || e.nombre;
    }
    const j = J(m.pid), t = M.tend(m.pid);
    /* (22 nov, Carlos: «lo que ponga un mánager de precio de venta, que no se tenga en cuenta para nada… si pone 200 millones
       por un jugador de 20, tú puedes ofrecerle 21») EL PRECIO QUE UN MÁNAGER LE PONE A UNO SUYO EN EL MERCADO NO CUENTA PARA
       NADA: se le puede ofertar desde el valor de mercado, nunca menos. Desde aquí `precio` es el valor del jugador, y lo que
       él puso queda en `pide` solo para el diagnóstico y para corregir a la IA si lo da por bueno: no se enseña ni entra en
       ninguna cuenta */
    if (m.tipo === 'manager' && m.vendedorTeamId !== yoTid && j.valor) { m.pide = m.precio; m.precio = j.valor; }
    // si lo vende otro manager, LaLiga también le hace su oferta y él se queda con la mejor. Para que te lo venda hay que
    // superar lo que le da LaLiga (lo normal en tu liga; con más interés, la parte alta, para no quedarte a medias)
    const r10 = (x) => Math.ceil(x / 1e4) * 1e4;
    let ofertaLiga = null, ofertaMin = null, ofertaAlta = null;
    if (m.tipo === 'manager' && m.vendedorTeamId !== yoTid && j.valor) {
      ofertaLiga = M.ofertaLigaDe(j);
      if (ofertaLiga && !ofertaLiga.sinDatos) {
        ofertaMin = Math.max(m.precio, r10(Math.max(ofertaLiga.v, j.valor) * 1.01));
        ofertaAlta = Math.max(ofertaMin, r10(Math.max(ofertaLiga.max, j.valor) * 1.01));
      } else {
        // sin ventas a LaLiga en tu liga para saber cuánto da: algo por encima de su valor
        ofertaMin = Math.max(m.precio, r10(j.valor * 1.05));
        ofertaAlta = Math.max(ofertaMin, r10(j.valor * 1.1));
      }
    }
    const precioReal = ofertaMin || m.precio;
    const i = M.interes(j, precioReal, t);
    const noVende = m.tipo === 'manager' ? sinRelevo(m.vendedorTeamId, j) : null;
    if (noVende) { i.n = Math.min(i.n, 20); i.por = [`No te lo venderá: ${noVende}`, ...(i.por || [])]; }
    const sobre = j.valor ? precioReal / j.valor - 1 : 0;
    let veredicto = 'normal';
    if (MALOS.has(j.estado)) veredicto = 'evitar';
    // (16 nov, Carlos) la subida cuenta en % y en euros: +1 % de uno de 90 M pesa más que +3 % de uno de 10 M
    else if (sobre <= 0.02 && !(t.p1 != null && t.p1 < -0.5) && ((P7(t) != null && P7(t) > 2) || (t.p1 != null && (t.p1 > 0.8 || (t.p1 > 0.3 && j.valor * t.p1 / 100 >= 4e5))) || num(j.media) >= 5)) veredicto = 'chollo';
    else if (t.p1 != null && (t.p1 > 1 || (t.p1 > 0.4 && j.valor * t.p1 / 100 >= 5e5))) veredicto = 'sube';
    else if (sobre > 0.15) veredicto = 'caro';
    else if (P7(t) != null && P7(t) < -4) veredicto = 'baja';
    // la inercia manda sobre la tendencia de la semana
    const ineM = M.inercia(m.pid);
    // tras un partido de 8 puntos o más, «Bajando» no es lo que va a pasar: lo normal es que se frene o suba
    const pzM = (M.partidazo(m.pid) || {}).nivel || 0;
    if (ineM && veredicto !== 'evitar' && pzM < 2) {
      if (ineM.fase === 'giro' || ineM.fase === 'baja') veredicto = 'baja';
      else if ((ineM.fase === 'frena' || ineM.fase === 'parado') && ['chollo', 'sube', 'normal'].includes(veredicto)) veredicto = 'frena';
    }
    if (pzM >= 2 && veredicto === 'baja') veredicto = 'normal';
    // la puja que pondría: el precio y un margen por las pujas que lleva y por si está subiendo. Cada puja de otro
    // suma un 2,5 %, pero como poco 100 mil: por uno de 600 mil, un 2,5 % son 15 mil y con eso no se lo lleva nadie
    // (Carlos, 30 oct). Esto solo pesa entero si tu liga aún no tiene compras de jugadores de su valor
    const porPuja = m.precio > 0 ? Math.max(0.025, 100000 / m.precio) : 0.025;
    let margen = 0.02 + Math.min(m.pujas, 5) * porPuja + (t.p1 != null && t.p1 > 0 ? Math.min(t.p1, 4) / 100 : 0) + (i.n >= 70 ? 0.03 : 0);
    // y lo que de verdad hace falta en TU liga para llevarse a uno así: lo que se ha pagado por los de su valor
    // (`M.pagaLiga`: un barato se paga mucho más en porcentaje que uno de 40 M), más arriba cuanto más interesa y
    // cuantas más pujas lleva (cada una, 5 puntos más de cuantil, hasta el 90 %)
    // (0.7.13u) con los que venían como él (su subida y si es de los top), no solo los de su valor, y un cuantil más
    // arriba o abajo según las pujas tuyas que se han perdido o ganado (`M.misPujasRes`)
    const PV = m.tipo !== 'manager' && j.valor ? M.pagaLiga(j.valor, m.pid) : null;
    let pujaLiga = null;
    if (PV) {
      const nivel = clamp((i.n >= 75 ? 0.75 : i.n >= 55 ? 0.5 : 0.25) + Math.min(m.pujas, 5) * 0.05 + (M.misPujasRes ? M.misPujasRes.ajuste : 0), 0.15, 0.85);
      pujaLiga = Math.max(0, PV.q(nivel));
      // (los cuantiles van sobre el valor; el margen, sobre la puja mínima)
      const enPrecio = m.precio > 0 ? (j.valor * (1 + pujaLiga)) / m.precio - 1 : pujaLiga;
      const w = PV.n >= 8 || PV.todos >= 30 ? 0.8 : 0.65;
      margen = (1 - w) * margen + w * enPrecio;
    }
    if (m.tipo === 'manager') margen = 0;
    let puja = Math.ceil(m.precio * (1 + margen) / 10000) * 10000;
    if (ofertaMin) puja = i.n >= 70 ? ofertaAlta : ofertaMin;
    // la que hace falta en tu liga para llevárselo de verdad (la de 6 de cada 10 compras parecidas, o más si la app ya pujaba
    // más), antes de los recortes por lo que aporta a tu once: para revender cuenta esta
    const pujaGana = m.tipo === 'manager' ? null : PV && j.valor ? Math.max(puja, Math.ceil(j.valor * (1 + Math.max(0, PV.q(M.qPujaGana(m.pid)))) / 10000) * 10000) : puja;
    // sin pasar de lo que se aguanta pagar por lo que aporta a tu once
    let recortada = false;
    if (m.tipo !== 'manager') {
      const tope = M.tolerancia(j) - 15;
      for (let k = 0; k < 60 && puja > m.precio && M.sobrecoste(j, puja, t).indice > tope; k++) { puja = Math.max(m.precio, puja - Math.max(10000, Math.round(puja * 0.01 / 10000) * 10000)); recortada = true; }
    }
    // con un calendario de riesgo alto, como mucho `calR.maxSobre` sobre su valor (y solo de parche)
    const calR = j.pos < 5 ? M.calendarioRiesgo(j) : null;
    let topeCal = null;
    if (calR && calR.riesgo === 'alto' && m.tipo !== 'manager' && j.valor) {
      const tope = Math.max(m.precio, Math.floor(j.valor * (1 + calR.maxSobre) / 10000) * 10000);
      if (puja > tope) { puja = tope; topeCal = tope; }
    }
    // con cuánto se gana: la parte de las compras parecidas que se pagaron por lo mismo o menos
    const ganaCon = (p) => (PV && j.valor ? PV.f(p / j.valor - 1) : null);
    return { ...m, j, tend: t, sobre, interes: i.n, por: i.por, noVende, veredicto, meLlega: precioReal - num(m.miPuja) <= M.pujaMax, puja, pujaLiga, recortada, topeCal, pujaGana, pGana: ganaCon(puja), pGanaLiga: pujaGana ? ganaCon(pujaGana) : null, ofertaLiga, ofertaMin, ofertaAlta, prox: M.proximoPartido(j.equipoId), dueno: M.dueno[m.pid] || null };
  }).sort((a, b) => b.interes - a.interes);
  {
    // la hora a la que caducan casi todos los libres es el cambio de mercado; lo que pone a la venta un manager
    // (o tú) caduca a su propia hora y no cuenta
    const libres = (D.mercado || []).filter((m) => m.tipo !== 'manager' && m.cierra && m.cierra > ahora);
    const veces = {};
    for (const m of libres) { const k = Math.round(m.cierra / 60000); veces[k] = (veces[k] || 0) + 1; }
    const comun = Object.entries(veces).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    M.cierreMercado = comun ? +comun[0] * 60000 : Math.min(...M.mercado.map((m) => m.cierra || Infinity).filter((x) => x > ahora), Infinity);
  }
  if (!Number.isFinite(M.cierreMercado)) M.cierreMercado = null;

  /* ---------- quién puede estar detrás de cada puja de un libre (0.8.2, 24 nov; quien-puja.js) ---------- */
  // LaLiga solo da cuántas pujas lleva cada libre. `extra.pujasVistas` (pujas-vistas.js, lo apunta app.js) dice cuándo ha
  // entrado cada una; con eso y lo que se sabe de cada rival sale quién es más probable, lo que pujaría y con cuánto se le
  // gana. Es una estimación: cada libre lleva `ajenas` (las pujas de otros), `pujasEv` (cuándo entraron) y `quien`
  {
    const reg = extra.pujasVistas && extra.pujasVistas.m ? extra.pujasVistas : null;
    M.pujasVistas = reg;
    const comprasQ = [], manualQ = [], yaQ = new Set();
    const hecho = (tid, t, clase, pid) => { const k = `${tid}|${pid}|${clase}|${Math.round(t / MIN)}`; if (tid && !yaQ.has(k)) { yaQ.add(k); manualQ.push({ tid, t, clase, pid }); } };
    for (const a of AH.lista) {
      if (!a.t || !a.pid) continue;
      const q = tidDe(a.quienId, a.quien), conOtro = !!(a.otroId || a.otro), o = conOtro ? tidDe(a.otroId, a.otro) : null;
      if (a.clase === 'compra' && !conOtro) {
        const imp = Math.abs(num(a.importe));
        if (!q || !imp) continue;
        const v = valorEn(a.pid, a.t - 3 * HORA), s = v ? imp / v - 1 : null;
        // (de las de hace más de dos meses no queda lo que valía: unos 12 puntos menos de lo pagado, lo normal)
        comprasQ.push({ tid: q, t: a.t, pid: a.pid, v: v || imp / 1.12, s: s != null && s > -0.1 && s <= 5 ? s : null });
      } else if (a.clase === 'clausula') { hecho(q, a.t, 'clausula', a.pid); if (o && o !== q) hecho(o, a.t, 'pierde', a.pid); }
      // (un trato entre mánagers lo cierra quien vende, al aceptar la oferta)
      else if (a.clase === 'compra') hecho(o, a.t, 'venta', a.pid);
      else if (a.clase === 'venta' || a.clase === 'blindaje') hecho(q, a.t, a.clase, a.pid);
    }
    const qp = crearQuienPuja({
      ahora, rivales: M.rivalesTid, todos: D.clasif.map((e) => e.teamId), nombre: nombreEquipo, J,
      plantilla: (tid) => (D.plantillas || {})[tid] || [], valorEquipo: (tid) => num((M.equipo[tid] || {}).valor),
      capacidad: M.capacidad, compras: comprasQ, manual: manualQ, paga: (v, pid) => (M.pagaLiga ? M.pagaLiga(v, pid) : null),
      deudaPct: num(c.deuda) / 100, minimoPos, tope: M.TOPE, cuenta: (tid) => M.cuentaPlantilla(((D.plantillas || {})[tid] || []).map((f) => J(f.pid))),
    });
    M.quienPuja = qp;
    for (const m of M.mercado) {
      if (m.tipo !== 'liga') continue;
      const e = reg ? reg.m[m.id] : null;
      m.ajenas = ajenasDe(m, reg);
      m.pujasEv = e && e.ev ? e.ev.filter((x) => x[0] > 0 && x[2] > 0) : [];
      m.quien = m.ajenas > 0 ? qp.para(m, m.ajenas, e && e.ev ? e.ev : []) : null;
    }
    // lo que ha acertado: cada lista que la app enseñó (`extra.quienVisto`, la apunta app.js antes de cerrarse el mercado)
    // frente a quien se lo llevó (la compra de ese jugador en la actividad). Las que ganaste tú no dicen nada
    let nQ = 0, top1 = 0, top3 = 0;
    for (const g of Object.values(extra.quienVisto || {})) {
      if (!g || !g.pid || !g.c || g.c > ahora - 10 * MIN || !Array.isArray(g.top) || !g.top.length) continue;
      const cmp = AH.lista.find((a) => a.clase === 'compra' && !a.otroId && !a.otro && String(a.pid) === String(g.pid) && a.t && Math.abs(a.t - g.c) < 12 * HORA);
      const gana = cmp ? tidDe(cmp.quienId, cmp.quien) : null;
      if (!gana || gana === yoTid) continue;
      nQ++;
      if (String(g.top[0]) === String(gana)) top1++;
      if (g.top.slice(0, 3).some((t) => String(t) === String(gana))) top3++;
    }
    M.quienAcierto = nQ ? { n: nQ, top1, top3 } : null;
  }

  /* ---------- tus jugadores en venta y sus ofertas ---------- */
  // (23 nov) sin relevo: el que lo sustituiría en tu once puntúa mucho menos (la misma regla que plan.js, sinRelevo)
  const sinRelevoV = (pid, j) => { const p = M.perdida(pid); return p >= 1 && p >= 0.5 * (M.ppEsperado(j) || 0); };
  const PUESTO_V = { 1: 'portero', 2: 'defensa', 3: 'centrocampista', 4: 'delantero' };
  // la jornada empieza antes de la siguiente oferta (el cambio de mercado del mismo día que empieza no da tiempo)
  // hoy sube o se queda igual (lo de hoy, con el histórico; si no lo hay, la página de mercado)
  const noBajaV = (t) => (t.d1 != null ? num(t.d1) >= 0 : t.p1 != null && t.p1 >= 0);
  const jornadaAntesV = !!M.proxima && (!M.cierreMercado || M.proxima.ini < M.cierreMercado || diaDe(M.cierreMercado) === diaDe(M.proxima.ini));
  // (24 nov) los cambios que propuso el plan (quién sale → quién entra, LS «cambios»): con el recambio ya en tu plantilla,
  // el que sale tiene relevo y su oferta se acepta (10 días)
  const CAMB = extra.cambios || {};
  M.cambioHecho = (pid) => { const c = CAMB[pid]; return !!c && !!c.entra && M.dueno[c.entra] === yoTid && ahora - (c.t || 0) < 10 * DIA; };
  // (repaso del 24 nov) «no te hace falta el dinero (tienes 6,43 M)» con 36 M pujados y el plan vendiendo para no empezar en
  // negativo: la cifra del saldo solo se dice si de verdad sobra (contando lo pujado); y «no entra en tu once», solo si no va en él
  const tienesTxt = num(D.dinero) - num(M.misPujas) >= 0 ? ` (tienes ${eur(D.dinero)})` : ' hoy';
  const enOnceV = (pid) => !!(M.once && M.once.lineas && M.once.lineas.flat().some((y) => y && y.id === pid));
  M.misVentas =(D.misVentas || []).filter((v) => !vendidos[v.pid]).map((v) => {
    const j = J(v.pid), t = M.tend(v.pid);
    const mia = (D.plantillas[yoTid] || []).find((f) => f.pid === v.pid);
    const compra = mia && (mia.compra || null);
    const ofertas = (v.ofertas || []).map((o) => ({ ...o, sobre: j.valor ? o.importe / j.valor - 1 : 0 }));
    const mejor = ofertas[0] || null;
    // ¿aceptar? si paga más que su valor, o si está bajando y la oferta no se queda muy corta
    let consejo = 'esperar', porque = '', protege = false, porqueCorto = '';
    const bajando = (t.p1 != null && t.p1 < -0.5) || (P7(t) != null && P7(t) < -2);
    const subiendo = (t.p1 != null && t.p1 > 0.5) || (P7(t) != null && P7(t) > 2);
    const ine = M.inercia(v.pid), pzV = M.partidazo(v.pid);
    // La oferta de LaLiga se renueva en cada cambio de mercado. Si la de hoy es de las más bajas que da en tu liga y no
    // hay prisa, lo normal es que mañana llegue una mejor aunque el jugador baje un poco: venderlo hoy es hacerlo por lo
    // mínimo. Se cuenta con algo menos que la mediana, porque las que se aceptan son las buenas.
    const OL = M.ofertaLiga && !M.ofertaLiga.poco ? M.ofertaLiga : null;
    let liga = null;
    if (mejor && mejor.deLiga && OL && j.valor) {
      const normal = (OL.p25 + OL.med) / 2;
      const dia = ine ? Math.min(num(ine.ult), num(t.d1) || 0) : num(t.d1);
      const valorMan = j.valor + dia;
      const esperado = Math.round(valorMan * (1 + normal) / 1e4) * 1e4;
      // prisa: empezar la jornada en negativo si no se vende antes de la próxima oferta, o que esté de baja
      // (el cambio de mercado del mismo día que empieza la jornada no cuenta: no da tiempo a contar con él)
      const jornadaAntes = M.proxima && (!M.cierreMercado || M.proxima.ini < M.cierreMercado || diaDe(M.cierreMercado) === diaDe(M.proxima.ini));
      const prisa = (num(D.dinero) < 0 && jornadaAntes) ? 'negativo' : M.vendeBaja({ j, tend: t }) ? 'baja' : null;
      liga = { posicion: mejor.sobre < OL.p25 ? 'baja' : mejor.sobre > OL.p75 ? 'alta' : 'normal', normal, p25: OL.p25, p75: OL.p75, med: OL.med, dia, esperado, gana: esperado - mejor.importe, prisa };
    }
    if (!mejor) { consejo = 'sin ofertas'; porque = 'Aún no tienes ofertas.'; }
    else if (liga && liga.posicion === 'baja' && !liga.prisa && liga.gana >= Math.max(150000, j.valor * 0.01)) {
      consejo = 'esperar';
      // (24 nov, Fran) «de las más bajas que da» no era verdad: es floja frente a las que se aceptan. Cada oferta va de −10 % a +10 %
      porque = `La de LaLiga es floja (${pct(mejor.sobre * 100)} sobre su valor). Te hace otra en cada cambio de mercado, de −10 % a +10 % de su valor, a suerte; esperando a una buena lo normal es sacar unos ${eur(liga.esperado)} (${eur(liga.gana, { signo: true })}). Espera, salvo que necesites el dinero hoy.`;
    }
    // el que vuelve y sigue subiendo: mañana vale más de lo que te ofrecen hoy (salvo que haga falta el dinero, esté de
    // baja o sea uno para revender sin otro cambio de mercado antes de la jornada; 0.7n)
    else if (ine && ine.vuelve && num(D.dinero) >= 0 && !M.vendeBaja({ j, tend: t }) && mejor.sobre < ine.vuelve.ritmo * 2
      && !((extra.reventa || {})[v.pid] && M.proxima && (!M.cierreMercado || M.proxima.ini < M.cierreMercado || diaDe(M.cierreMercado) === diaDe(M.proxima.ini)))) {
      consejo = 'esperar';
      porque = `Vuelve y sigue subiendo (un ${pct(ine.vuelve.ritmo * 100, 1, false)} al día; llegó a valer ${eur(ine.vuelve.max)}): mañana valdrá más de lo que te ofrecen hoy. Aguántalo mientras siga subiendo, salvo que necesites el dinero.`;
    }
    // sigue subiendo y no te hace falta el dinero: lo que te pagan de más lo gana solo en pocos días (Carlos, 17 nov:
    // Fornals subiendo 1,1 M al día, titular y con 16 M en positivo, y el plan mandaba aceptar un 6 % «para la liquidez»).
    // Si es de tu once se aguanta más, que venderlo además quita puntos. Salvo la oferta alta de LaLiga o el de revender
    // sin otro cambio de mercado antes de la jornada
    else if (num(D.dinero) >= 0 && !M.vendeBaja({ j, tend: t }) && mejor.sobre > 0 && j.valor && !(liga && liga.posicion === 'alta')
      && (ine ? ['sube', 'acelera'].includes(ine.fase) && num(ine.ult) > 0 : subiendo && num(t.d1) > 0)
      && !((extra.reventa || {})[v.pid] && M.proxima && (!M.cierreMercado || M.proxima.ini < M.cierreMercado || diaDe(M.cierreMercado) === diaDe(M.proxima.ini)))
      && (() => { const r = ine ? num(ine.ult) : num(t.d1), dias = (mejor.importe - j.valor) / r; return dias <= (M.perdida(v.pid) >= 0.3 ? 6 : 3); })()) {
      const r = ine ? num(ine.ult) : num(t.d1), prima = mejor.importe - j.valor, dias = Math.max(1, Math.round(prima / r)), once = M.perdida(v.pid) >= 0.3;
      consejo = 'esperar';
      porque = `Sigue subiendo (${eur(r, { signo: true })} al día${P7(t) != null ? `, ${pct(P7(t))} en 7 días` : ''}) y no te hace falta el dinero${tienesTxt}: los ${eur(prima)} que te pagan de más los gana solo en ${dias === 1 ? 'un día' : `unos ${dias} días`}${once ? ', y es de tu once' : ''}. Aguántalo; acéptala solo si quieres hacer caja.`;
    }
    // (23 nov, Carlos: Gulácsi, portero titular al 92 %, con buenos puntos, partido fácil y que hoy deja de bajar, y la app
    // mandaba aceptar un 7 % «porque te pagan más de lo que vale») aceptar una oferta es venderlo. Por poco más de lo que
    // vale (menos de un 10 %, lo más alto que suele dar LaLiga; Carlos, 17 nov: «la de un 12 % por encima, aunque suba un
    // 1 % al día, sí») no se vende: (1) a uno de tu once, salvo que baje todos los días y tenga relevo (la regla del 14 nov
    // para ponerlo a la venta); (2) a ninguno que hoy suba o se quede igual (20:32, otra vez Gulácsi con 16,01 M: «ha
    // cambiado la tendencia de ir hacia abajo a ir hacia arriba… no tiene sentido la venta»). Salvo que esté de baja, que
    // sea para revender o que haga falta el dinero DE VERDAD: en negativo (o con lo pujado) y sin otro cambio de mercado
    // antes de la jornada. Entre semana hay tiempo de hacer caja con otra cosa (en negativo no se malvende); el plan no la
    // acepta «porque hace falta» mientras queden cambios de mercado (`protege`, plan.js y cuadrarPlan)
    else if (!(jornadaAntesV && (num(D.dinero) < 0 || num(D.dinero) - num(M.misPujas) < 0)) && !M.vendeBaja({ j, tend: t }) && !(extra.reventa || {})[v.pid]
      && mejor.sobre < 0.1 && !M.cambioHecho(v.pid) && ((M.perdida(v.pid) >= 0.3 && !(M.bajaSeguido(v.pid) && !sinRelevoV(v.pid, j))) || noBajaV(t))) {
      const titular = M.perdida(v.pid) >= 0.3, pierde = String(Math.round(M.perdida(v.pid) * 10) / 10).replace('.', ','), bs = M.bajaSeguido(v.pid);
      const por = mejor.sobre > 0 ? `Por un ${Math.max(1, Math.round(mejor.sobre * 100))} % más` : 'Por lo que te ofrecen';
      // hoy sube después de N días bajando: «ha dejado de bajar»
      const sub = Array.isArray(t.sub) ? t.sub : [];
      let antes = 0;
      for (let k = sub.length - 2; k >= 0 && sub[k] < -0.001; k--) antes++;
      const giro = noBajaV(t) ? `hoy ${num(t.d1) > 0 ? `sube (${eur(t.d1, { signo: true })})` : 'no baja'}${antes >= 2 ? ` tras ${antes} días bajando: ha dejado de bajar` : ''}` : '';
      const Giro = giro.charAt(0).toUpperCase() + giro.slice(1);
      const luego = `Acéptala solo si te hace falta el dinero${mejor.deLiga ? ': LaLiga te hará otra' : ''}.`;
      consejo = 'esperar'; protege = true;
      // (24 nov, «menos texto») corto; `porqueCorto`, sin la última frase, para cuando el plan lo descarta
      porqueCorto = bs && titular
        ? `Baja ${bs.planos ? 'casi todos los días' : `${bs.dias} días seguidos`}, pero es titular en tu once (${pierde} pts por jornada) y no tienes otro ${PUESTO_V[j.pos] || 'en su puesto'} como él: antes hace falta un sustituto.`
        : titular
          ? `Es titular en tu once (${pierde} pts por jornada) y ${giro || 'no baja todos los días'}. ${por} no compensa.`
          : `${Giro}${antes >= 2 ? '' : ': no está bajando'}. ${por} no compensa venderlo.`;
      porque = `${porqueCorto} ${luego}`;
    }
    else if (mejor.sobre >= 0.02) { consejo = 'aceptar'; porque = `Te pagan un ${Math.round(mejor.sobre * 100)} % más de lo que vale.`; }
    // si no te hace falta el dinero y no te quita puntos, no hay prisa: puede quedarse hasta que llegue una oferta
    // mejor (LaLiga hace una nueva en cada cambio de mercado). Salvo que caiga deprisa (más de un 3 % al día),
    // esté de baja o la oferta sea de las altas
    // (con una sanción de un partido, igual: se pierde la jornada y se aguanta; por eso no entra en el once de esta)
    else if (num(D.dinero) >= 0 && M.perdida(v.pid) < 0.3 && !M.vendeBaja({ j, tend: t }) && !(liga && liga.posicion === 'alta')
      && !(ine && j.valor && num(ine.ult) < -0.03 * j.valor) && !(t.p1 != null && t.p1 < -3)) {
      consejo = 'esperar';
      porque = M.sancionCorta(j) ? `${M.sancionCortaTxt(j)} No te hace falta el dinero${tienesTxt}: puede quedarse hasta que LaLiga te haga una oferta mejor.` : `No te hace falta el dinero${tienesTxt} y ${enOnceV(v.pid) ? 'en tu once tiene relevo' : 'no entra en tu once'}: puede quedarse hasta que LaLiga te haga una oferta mejor${ine && ine.ult < 0 ? ` (baja unos ${eur(-ine.ult)} al día, poco para lo que varía la oferta de un día a otro)` : ''}.`;
    }
    // salvo que acabe de hacer 8 puntos o más: ahí lo normal es que la bajada se frene o se dé la vuelta, y venderlo hoy
    // es hacerlo en el peor momento (con dinero en positivo no hay prisa)
    else if (pzV && pzV.nivel >= 2 && num(D.dinero) >= 0 && !M.vendeBaja({ j, tend: t }) && ((ine && ['giro', 'baja', 'parado', 'frena'].includes(ine.fase)) || bajando)) {
      consejo = 'esperar';
      porque = `Venía bajando, pero acaba de hacer ${pzV.pts} puntos: ${pzV.nivel >= 3 ? 'lo normal es que suba estos días' : 'la bajada puede frenarse'}. Espera al cambio de mañana, salvo que necesites el dinero hoy.`;
    }
    // la inercia manda: si ha girado, cada día vale menos; si se está frenando, no se espera a que gire
    else if (ine && (ine.fase === 'giro' || ine.fase === 'baja') && mejor.sobre >= -0.05) { consejo = 'aceptar'; porque = `Ha girado a la baja (hoy ${eur(ine.ult, { signo: true })}): cada día que esperes vale menos, y la oferta casi iguala su valor.`; }
    else if (ine && (ine.fase === 'frena' || ine.fase === 'parado') && mejor.sobre >= -0.02) { consejo = 'aceptar'; porque = ine.fase === 'parado' ? 'Ya ha dejado de subir: lo normal es que ahora baje. No esperes.' : `Sube cada vez menos y gira en unos ${Math.max(1, Math.round(ine.giroEn))} días: no esperes a que baje.`; }
    else if (bajando && mejor.sobre >= -0.04) { consejo = 'aceptar'; porque = `Está bajando${t.p7 != null ? ` (${pct(t.p7)} en 7 días)` : ''} y la oferta casi iguala su valor.`; }
    else if (M.vendeBaja({ j, tend: t }) && mejor.sobre >= -0.1) { consejo = 'aceptar'; porque = M.deBaja(j) ? `${M.bajaTxt(j)}: mejor venderlo ya.` : `Sancionado una jornada, pero su valor cae deprisa${t.p7 != null && t.p7 < -5 ? ` (${pct(t.p7)} en 7 días)` : ''}: mejor venderlo ya.`; }
    else if (subiendo) { consejo = 'esperar'; porque = 'Está subiendo: mañana puede llegar una oferta mejor.'; }
    else { consejo = 'esperar'; porque = `La oferta se queda un ${Math.round(Math.abs(mejor.sobre) * 100)} % por debajo de lo que vale.`; }
    const deLiga = ofertas.some((o) => o.deLiga);
    return { ...v, j, tend: t, compra, ofertas, mejor, consejo, porque, porqueCorto: porqueCorto || porque, protege, liga, ganado: mejor && compra ? mejor.importe - compra : null, ligaEst: deLiga ? null : M.ofertaLigaDe(j) };
  });
  M.enVenta = new Set(M.misVentas.map((v) => v.pid));

  /* ---------- quién sube y quién baja en toda LaLiga ---------- */
  // (sin los que ya no están en LaLiga)
  const todos = Object.values(D.maestro).filter((j) => j && j.valor && j.pos && j.pos < 5 && j.estado !== 'out_of_league');
  const conT = todos.map((j) => ({ j, t: M.tend(j.id), dueno: M.dueno[j.id] || null })).filter((x) => x.t.d1 != null || x.t.d7 != null);
  const clave = (x) => (x.t.d1 != null ? x.t.d1 : x.t.d7 / 7);
  M.suben = [...conT].sort((a, b) => clave(b) - clave(a)).slice(0, 40);
  M.bajan = [...conT].sort((a, b) => clave(a) - clave(b)).slice(0, 40);
  M.libresBuenos = todos.filter((j) => !M.dueno[j.id]).map((j) => ({ j, t: M.tend(j.id), i: M.interes(j, j.valor) })).sort((a, b) => b.i.n - a.i.n).slice(0, 30);

  /* ---------- actividad de la liga, con nombres ---------- */
  M.actividad = (D.actividad || []).map((a0) => {
    const a = marcarCz(a0);
    const quienT = M.teamDeUsuario(a.quienId, a.quien), otroT = M.teamDeUsuario(a.otroId, a.otro);
    return {
      ...a, quienT, otroT,
      quien: a.quien || nombreEquipo(quienT), otro: a.otro || nombreEquipo(otroT),
      nombreJ: a.jugador || (a.pid && D.maestro[a.pid] ? D.maestro[a.pid].nombre : ''),
      esYo: !!yoTid && quienT === yoTid, contraMi: !!yoTid && otroT === yoTid,
      // el jugador, para su cara en la lista (Mercado → Movimientos, 0.7.3)
      j: a.pid && D.maestro[a.pid] ? D.maestro[a.pid] : null,
    };
  });
  // tus blindajes de esta jornada: 2, desde que acabó la última jornada hasta que acabe la que viene
  {
    const acabadas = jornadas.filter((jo) => jo.fin <= ahora);
    const desde = acabadas.length ? Math.max(...acabadas.map((jo) => jo.fin)) : 0;
    /* (22 nov, Carlos: sin blindajes y el plan mandaba blindar) Antes solo se contaban los de D.actividad, que es lo que se
       ha bajado en ESTA actualización: lo de los últimos 2 días y poco más (datos.js deja de pedir páginas al llegar a lo
       que ya tenía). Un blindaje de hace 4 días, en un parón de dos semanas, no estaba ahí y la app creía que quedaban 2.
       Ahora se cuentan también los del historial guardado (extra.actHist, todo lo visto desde el principio) */
    const vistos = new Set(), mios = [], blindaRival = {};
    const idB = (a) => a.id || `${a.t}|${a.pid}|${a.quienId}`;
    for (const a of [...(D.actividad || []), ...((extra.actHist && extra.actHist.lista) || [])]) {
      if (a.clase !== 'blindaje' || !a.t || a.t <= desde || vistos.has(idB(a))) continue;
      vistos.add(idB(a));
      const q = M.teamDeUsuario(a.quienId, a.quien);
      if (yoTid && q === yoTid) mios.push(a);
      else if (q) (blindaRival[q] ||= []).push(a);
    }
    // «ya he blindado a X» cuenta como uno gastado si LaLiga no lo trae (el mismo jugador, desde 3 h antes de decirlo)
    const dichos = [...DICHO.blindados.values()].filter((n) => n.t > desde && !mios.some((a) => a.pid === n.pid && a.t > n.t - 3 * HORA));
    let usados = Math.min(2, mios.length + dichos.length);
    const sig = M.enJuego || M.proxima;
    // y lo que dice que le queda manda sobre la cuenta, hasta que se recarguen: de ahí se restan los que gaste después
    const nb = DICHO.blindajes && DICHO.blindajes.t > desde ? DICHO.blindajes : null;
    if (nb) {
      const despues = mios.filter((a) => a.t > nb.t).length + dichos.filter((n) => n.t > nb.t).length;
      usados = Math.min(2, 2 - Math.max(0, nb.n - despues));
    }
    /** (26 nov, el parte de los rivales) los blindajes de un rival esta jornada, contados como los tuyos: los que se ven en
     *  los movimientos desde que acabó la última. `completo`: el historial guardado llega hasta entonces (si no, puede
     *  haber gastado alguno que no se ha visto y no se dice nada) */
    M.escudosDe = (tid) => {
      // (los de las 6 h siguientes al final de la jornada no se cuentan: LaLiga cierra la jornada y paga el premio 5-6 h
      // después, y no se sabe si uno puesto en ese rato gasta de la jornada vieja o de la nueva; contarlo de menos calla)
      const n = Math.min(2, (blindaRival[tid] || []).filter((a) => a.t > (desde || 0) + 6 * HORA).length);
      const hist = extra.actHist || null;
      return { usados: n, quedan: 2 - n, desde, completo: !!D.demo || !!(hist && hist.lista && hist.lista.length && (hist.completa || (hist.desde && hist.desde <= (desde || 0) + HORA))) };
    };
    M.escudosMios = { usados, quedan: Math.max(0, 2 - usados), desde, hasta: sig ? sig.fin : null, horas: M.ESCUDO_H, vistos: mios.length, ...(nb ? { dicho: nb.id } : {}) };
    if (nb) M.dicho.push({ ...nb, txt: dichoTxt(nb), hasta: nb.caduca || (sig ? sig.fin : null) });
    for (const n of dichos) if (M.dueno[n.pid] === yoTid) M.dicho.push({ ...n, txt: dichoTxt(n, J(n.pid).nombre), hasta: n.t + ESCUDO });
  }
  /** cuándo y por cuánto fichó su dueño actual a un jugador (compra o cláusula), si está en la actividad */
  M.fichadoPor = (pid) => {
    const tid = M.dueno[pid];
    if (!tid) return null;
    return M.actividad.find((a) => a.pid === pid && a.quienT === tid && ['compra', 'clausula'].includes(a.clase)) || null;
  };
  // los cambios de plantilla que la actividad no cuenta (blindajes)
  // (las subidas de cláusula que hace LaLiga sola, al subir el valor, no son movimientos de nadie)
  M.cambios = (H.mov || []).filter((m) => ahora - m.t < 21 * DIA && (m.tipo !== 'blinda' || M.blindaPagada(m))).map((m) => ({ ...m, j: J(m.pid), equipo: M.equipo[m.teamId] })).reverse();

  /* ---------- rivales ---------- */
  /** lo que han subido o bajado de valor los jugadores de una plantilla (d1: hoy, d7: en 7 días); null si no hay datos */
  const pctMov = (fichas, k) => {
    let n = 0, suma = 0;
    for (const f of fichas) { const t = M.tend(f.pid); if (t && t[k] != null) { n++; suma += num(t[k]); } }
    return n ? suma : null;
  };
  // (20 nov, Carlos: «todos los rivales me pone peligro bajo») el peligro de un rival sale de dos preguntas: qué PUEDE
  // hacerte ahora (sus cuentas frente a tus cláusulas que se pagan en esta liga) y qué SUELE hacer (sus clausulazos de toda
  // la temporada, más los hechos a ti, y lo que se mueve esta semana). Antes solo contaba lo de 7-14 días y cualquier
  // cláusula a la que le llegara el dinero, aunque a ese precio no la pague nadie
  const czDe = {};
  for (const a of AH.lista) {
    if (a.clase !== 'clausula' || !a.t) continue;
    const q = tidDe(a.quienId, a.quien);
    if (!q || q === yoTid) continue;
    const v = a.pid ? valorEn(a.pid, a.t - 3 * HORA) : null, imp = Math.abs(num(a.importe));
    (czDe[q] ||= []).push({ t: a.t, pid: a.pid, aMi: !!yoTid && tidDe(a.otroId, a.otro) === yoTid, s: v && imp ? imp / v - 1 : null });
  }
  const yoClasif = D.clasif.find((e) => e.teamId === yoTid) || null;
  const MIN_PUESTO = { 1: 1, 2: 3, 3: 3, 4: 1 };
  const CZp = M.clausulazos;
  /** cuánto apetece una cláusula tuya: hasta la mediana de lo que se paga en tu liga, 1; hasta el p90 (o lo más que ha
   * pagado ese rival), 0,6; 5 puntos más, 0,25; por encima, nada. Sin 3 clausulazos en la liga, el 30 % de siempre */
  const apetito = (x, suyoMax) => {
    const s = x.ratio - 1;
    if (CZp && CZp.n >= 3) { const p90 = Math.max(CZp.p90, suyoMax != null ? suyoMax : -1); return s <= CZp.med ? 1 : s <= p90 ? 0.6 : s <= p90 + 0.05 ? 0.25 : 0; }
    return clamp(1 - s / 0.3, 0, 1);
  };
  // cuándo se puede pagar: abierta, en menos de un día, en 3 o en 7. En veda, `reabre` la cuenta como abierta si se abre
  // al acabar la veda (para decir cómo queda al reabrirse)
  const cuandoPaga = (x, reabre) => {
    if (x.abierta) return 1;
    if (reabre && M.vedaAhora && x.veda && x.protegidoHasta <= M.vedaAhora.fin + MIN) return 1;
    const h = (x.abreEn || 0) / HORA;
    return h < 24 ? 0.7 : h < 72 ? 0.4 : h < 168 ? 0.2 : 0;
  };
  // lo que te duele perderlo (20 nov, tarde, con la liga de Carlos: a los 8 rivales les llegaban Thiago, Morcillo o Macià,
  // de 1-2 M, y por los puntos que dan salían todos «alto»): sobre todo el dinero en juego, su valor frente a los tuyos
  // que más valen (p75, mínimo 10 M); los puntos pesan menos y solo del todo en los que no se reponen con 5 M
  const valMios = M.mias.map((x) => num(x.j && x.j.valor)).sort((a, b) => a - b);
  const REF_DUELE = Math.max(10e6, valMios.length ? valMios[Math.floor(valMios.length * 0.75)] : 0);
  const duele = (x) => {
    const v = num(x.j && x.j.valor), din = clamp(v / REF_DUELE, 0, 1);
    const pts = clamp(num(x.pierde) / 3, 0, 1) * clamp(v / 5e6, 0, 1);
    return clamp(0.1 + 0.9 * (0.6 * din + 0.4 * pts), 0.1, 1);
  };
  // si le llega: con el dinero exacto, sí o no; estimado, de 0 a 1 a lo largo del margen (sin saltos de un día a otro)
  const llega = (c, cl) => (!c ? 0 : c.exacto ? (c.v >= cl ? 1 : 0) : clamp((c.v + c.margen - cl) / (2 * Math.max(c.margen, 1e5)), 0, 1));
  // lo rico que es cada rival frente a los demás de la liga: su saldo y una cuarta parte de su equipo (lo que podría sacar
  // vendiendo). Carlos (20 nov): «¿cómo puede ser peligro medio gente con un patrimonio de 600 M igual que otro con 90 M?»
  const riqDe = {};
  // (sin saber su dinero, solo la cuarta parte de su equipo)
  for (const e of D.clasif) if (e.teamId !== yoTid) { const c = M.capacidad(e.teamId); riqDe[e.teamId] = Math.max(0, (c ? num(c.v) : 0) + 0.25 * num(e.valor)); }
  const riqMax = Math.max(0, ...Object.values(riqDe));
  // (20 nov, 18:39, Carlos: «haz otra escala con muy alto») cuatro escalones: muy alto desde 70, alto desde 50, medio
  // desde 30 y bajo por debajo
  const nivelPel = (n) => (n >= 70 ? 'muyalta' : n >= 50 ? 'alta' : n >= 30 ? 'media' : 'baja');
  M.rivales = D.clasif.filter((e) => e.teamId !== yoTid).map((e) => {
    const serie = (H.eq && H.eq[e.teamId]) || [];
    const hace7 = serie.filter(([d]) => d <= otroDia(diaDe(ahora), -7)).pop();
    const ayer = serie.filter(([d]) => d <= otroDia(diaDe(ahora), -1)).pop();
    const acts = M.actividad.filter((a) => a.quienT === e.teamId || a.otroT === e.teamId);
    const sem = acts.filter((a) => a.t && ahora - a.t < 7 * DIA);
    const quince = acts.filter((a) => a.t && ahora - a.t < 14 * DIA);
    const suyo = (a) => a.quienT === e.teamId;
    const gastado = sem.filter((a) => suyo(a) && ['compra', 'clausula'].includes(a.clase)).reduce((s, a) => s + num(a.importe), 0);
    const ingresado = sem.filter((a) => (a.clase === 'venta' && suyo(a)) || (a.clase === 'clausula' && a.otroT === e.teamId)).reduce((s, a) => s + num(a.importe), 0);
    const clausulazos = quince.filter((a) => a.clase === 'clausula' && suyo(a)).length;
    const contraMi = quince.filter((a) => a.clase === 'clausula' && suyo(a) && a.contraMi).length;
    // (sin los que la actividad dice que ya no son suyos: la plantilla de la API va por detrás)
    const fichas = ((D.plantillas || {})[e.teamId] || []).filter((f) => !M.recienCambiado[f.pid] || M.dueno[f.pid] === e.teamId).map((f) => M.clausulas.find((x) => x.pid === f.pid && x.teamId === e.teamId) || enriquecer(f, e.teamId));
    // su dinero (exacto o estimado) y cuáles de tus cláusulas le llegan
    const dinero = M.dineroDe(e.teamId), cap = M.capacidad(e.teamId);
    const leLlegan = M.mias.filter((x) => x.clausula && (x.abierta || x.abreEn < 3 * DIA) && x.pagan && [...x.pagan.seguro, ...x.pagan.quiza].some((y) => y.tid === e.teamId));
    const leLleganYa = leLlegan.filter((x) => x.abierta);
    const peligro = (() => {
      const czs = czDe[e.teamId] || [];
      const sS = czs.map((z) => z.s).filter((s) => s != null && s > -0.1 && s < 3);
      const suyoMax = sS.length ? Math.max(...sS) : null;
      // los puestos en los que no tiene bastantes sanos (ahí un clausulazo le arregla más)
      const js = fichas.map((x) => x.j).filter(Boolean);
      const falta = {};
      for (const p of [1, 2, 3, 4]) falta[p] = js.filter((j) => j.pos === p && !MALOS.has(j.estado)).length < MIN_PUESTO[p];
      // con la plantilla llena no puede clausular: tendría que vender antes (Carlos, 20 nov)
      const lleno = M.cuentaPlantilla(js) >= M.TOPE;
      // (20 nov, tarde, Carlos: «¿cómo puede ser peligro medio gente con un patrimonio de 600 M igual que otro con 90 M?»)
      // lo que puede sacar vendiendo: sus jugadores fuera de los 11 más caros, a lo que suele dar LaLiga (≈ su valor). Una
      // cláusula que solo paga vendiendo antes cuenta la mitad: vende en el cambio de mercado y clausula al día siguiente
      const vendible = js.slice().sort((a, b) => num(b.valor) - num(a.valor)).slice(11).reduce((t, j) => t + 0.95 * num(j.valor), 0);
      const cap2 = cap ? { ...cap, v: cap.v + vendible } : null;
      const alcance = (cl) => Math.max(llega(cap, cl), 0.5 * llega(cap2, cl));
      // PUEDE: cada cláusula tuya pesa apetito × cuándo × lo que te duele × si le llega; juntas, como probabilidades
      const calc = (reabre) => {
        let no = 1;
        const l = [];
        for (const x of M.mias) {
          if (!x.clausula || x.ratio == null) continue;
          const ap = apetito(x, suyoMax), cu = cuandoPaga(x, reabre);
          if (!ap || !cu) continue;
          const w = Math.min(1, ap * (falta[x.j.pos] ? 1.25 : 1)) * cu * duele(x) * alcance(x.clausula) * (lleno ? 0.3 : 1);
          if (w < 0.02) continue;
          no *= 1 - 0.6 * w;
          l.push({ pid: x.pid, nombre: x.j.nombre, w, abierta: x.abierta, riesgo: x.riesgo, vendiendo: llega(cap, x.clausula) < 0.5 });
        }
        return { puede: 100 * (1 - no), l: l.sort((a, b) => b.w - a.w) };
      };
      // SUELE: sus clausulazos de toda la temporada (uno de hace un mes pesa 0,37; los hechos a ti, el doble) y lo que se
      // mueve esta semana (poco: fichar en el mercado no es clausular)
      let hist = 0;
      for (const z of czs) hist += Math.exp(-(ahora - z.t) / (30 * DIA)) * (z.aMi ? 2 : 1);
      const compras7 = sem.filter((a) => suyo(a) && a.clase === 'compra').length;
      const act = Math.min(1, compras7 * 0.15 + gastado / 40e6);
      const suele = 100 * (1 - Math.exp(-(0.25 + 0.8 * hist + 0.4 * act)));
      // si le llega (con lo que tiene o vendiendo) para alguna cláusula tuya que se paga en esta liga y se abre en 3 días
      const aTiro = M.mias.some((x) => x.clausula && x.ratio != null && apetito(x, suyoMax) > 0 && (x.abierta || x.veda || (x.abreEn || 0) < 3 * DIA) && alcance(x.clausula) >= 0.25 && duele(x) >= 0.3);
      // quien te pelea el puesto gana más quitándote a un titular
      const cerca = yoClasif ? clamp(1 - Math.abs(num(e.puntos) - num(yoClasif.puntos)) / Math.max(60, 0.15 * num(yoClasif.puntos)), 0, 1) : 0;
      // EL NIVEL (20 nov, 20:19, Carlos, tercera vez: «hazlo bien»): antes mandaba lo que puede quitarte esta semana, y con
      // una sola cláusula tuya a tiro (Gulácsi) salían siete de ocho igual y el 1º, con 534 M de equipo y cuatro
      // clausulazos a ti, «bajo» por tener poco saldo hoy. Ahora, como lo ve él: PUEDE PAGAR (lo rico que es frente al más
      // rico de la liga: su saldo y la cuarta parte de su equipo) × SUELE CLAUSULAR, y lo que tiene a tiro ahora lo mueve
      // de ×0,85 (nada) a ×1,35 (todo). Con la plantilla llena, ×0,7 (tiene que vender antes); quien te pelea el puesto, hasta un 10 % más
      const riq = riqMax > 0 ? riqDe[e.teamId] / riqMax : 0.5;
      const nivelDe = (p) => Math.min(100, 100 * Math.pow(riq, 0.6) * (lleno ? 0.7 : 1) * (0.4 + 0.6 * suele / 100) * (0.85 + 0.5 * (p / 100) ** 2) * (1 + 0.1 * cerca));
      const ah = calc(false);
      let n = nivelDe(ah.puede);
      // lo mismo que dice el riesgo de tus cláusulas: si uno tuyo está en riesgo alto y este rival lo paga, no es «bajo»
      // (solo si le llega de verdad: el «quizá» de una estimación con mucho margen no basta)
      const enAlto = M.mias.filter((x) => x.riesgo === 'alto' && x.pagan && (x.pagan.seguro.some((y) => y.tid === e.teamId) || (x.pagan.quiza.some((y) => y.tid === e.teamId) && llega(cap, x.clausula) >= 0.5)));
      if (enAlto.length) n = Math.max(n, 30);
      // en la veda nadie clausula, pero dura menos de un día: se enseña el peligro de cuando se reabra (antes bajaba un
      // escalón a todos y en la veda salían todos «medio», Carlos, 20 nov) y el porqué dice que están cerradas
      let veda = null, lista = ah.l, puede = ah.puede;
      if (M.vedaAhora) {
        const re = calc(true);
        n = Math.max(nivelDe(re.puede), n, enAlto.length ? 30 : 0);
        veda = { hasta: M.vedaAhora.fin, nivel: nivelPel(n), l: re.l };
        lista = re.l; puede = re.puede;
      }
      const ult = czs.filter((z) => z.aMi).sort((a, b) => b.t - a.t)[0] || null;
      return {
        n, puede: Math.round(puede), suele: Math.round(suele), riq: Math.round(riq * 100) / 100, hist: Math.round(hist * 100) / 100, cerca: Math.round(cerca * 100) / 100,
        llegan: lista, aTiro, vendiendo: lista.some((x) => x.w >= 0.25 && x.vendiendo), czTotal: czs.length, czAMi: czs.filter((z) => z.aMi).length, ultAMi: ult ? { pid: ult.pid, nombre: ult.pid && D.maestro[ult.pid] ? D.maestro[ult.pid].nombre : null, t: ult.t } : null,
        lleno, veda, enAlto: enAlto.map((x) => x.pid),
        // tiene dinero (se sabe) pero tus cláusulas que se abren pronto están por encima de lo que se paga aquí
        caras: !!cap && !lista.some((x) => x.w >= 0.25) && M.mias.some((x) => x.clausula && (x.abierta || x.veda || x.abreEn < 3 * DIA) && alcance(x.clausula) > 0.5),
        sinDinero: !!cap && !lista.some((x) => x.w >= 0.25) && !M.mias.some((x) => x.clausula && (x.abierta || x.veda || x.abreEn < 3 * DIA) && alcance(x.clausula) > 0.5),
      };
    })();
    const amenaza = peligro.n;
    const paga = M.pujasLiga && M.pujasLiga.porEquipo ? M.pujasLiga.porEquipo[e.teamId] || null : null;
    return {
      e, serie, fichas, dinero, cap, leLlegan, leLleganYa, paga, flujo: flujos[e.teamId] || null,
      // lo que se ha movido de mercado lo que tiene ahora (sin contar lo que entra y sale por fichajes, ventas o
      // clausulazos: vender a uno de 60 M no es «bajar» 60 M); y el valor del equipo de verdad, aparte
      dValor: pctMov(fichas, 'd7'), dValor1: pctMov(fichas, 'd1'),
      dValorEquipo: hace7 ? e.valor - hace7[1] : null, dValorEquipo1: ayer ? e.valor - ayer[1] : null,
      dPos: hace7 ? hace7[3] - e.pos : null,
      movs: sem.length, gastado, ingresado, clausulazos, contraMi,
      abiertas: fichas.filter((x) => x.abierta && x.clausula).length,
      meLlegan: fichas.filter((x) => x.abierta && x.meLlega).length,
      amenaza: Math.round(amenaza), nivel: nivelPel(amenaza), peligro,
      ultima: acts[0] || null,
      cambios: M.cambios.filter((m) => m.teamId === e.teamId),
    };
  });

  /* ---------- lo que toca hacer ---------- */
  /* ---------- especular: comprar entre semana lo que sube y venderlo antes de la jornada ---------- */
  // lo único obligatorio es empezar la jornada con saldo >= 0; entre medias se puede bajar hasta la deuda permitida
  const inicioJ = M.proxima ? M.proxima.ini : null;
  M.ventanaEsp = null;
  if (inicioJ) {
    // los cambios de mercado que sirven para vender antes de la jornada: los de antes de su primer partido, sin el del
    // mismo día (con una o dos horas de margen no se puede contar con él: aviso de Domy, 23 oct) ni los de mientras
    // se juega la jornada de ahora
    const diaJ = diaDe(inicioJ);
    const fueraJuego = (t) => !(M.enJuego && t <= M.enJuego.fin);
    const vale = (t) => t > ahora && t < inicioJ && diaDe(t) !== diaJ && fueraJuego(t);
    const cambios = [];
    // (17 nov, Carlos) el del mismo día que el primer partido (cada liga tiene su hora: en la de Carlos, las 20:00 con la
    // jornada a las 21:00; en otras puede ser de madrugada, con muchas horas de margen) cuenta
    // para vender lo de revender, con aviso, pero el plan no depende de él para llegar en positivo: el negativo tiene que
    // quedar tapado con el cambio de antes (`limite`, `ciclos` y `cambios` siguen sin él). Con menos de 30 min de margen,
    // ni eso. Va con la hora de cambio de cada liga (`M.cierreMercado`); sin saberla, no se cuenta
    let justo = null;
    // día a día a la misma hora de Madrid (con masDias: la semana del cambio de hora un día dura 23 o 25 h)
    if (M.cierreMercado) {
      for (let k = 0; k < 14; k++) {
        const t = masDias(M.cierreMercado, k); if (t >= inicioJ) break;
        if (vale(t)) cambios.push(t);
        else if (t > ahora && diaDe(t) === diaJ && t <= inicioJ - 30 * MIN && fueraJuego(t)) justo = t;
      }
    } else { for (let k = 1, t = masDias(inicioJ, -1); t > ahora && k <= 14; k++, t = masDias(inicioJ, -k)) if (vale(t)) cambios.unshift(t); }
    const ultimo = cambios.length ? cambios[cambios.length - 1] : null;
    // se pone a la venta después del penúltimo cambio, para aceptar la oferta que llega en el último
    const ponerVentaSeguro = cambios.length >= 2 ? cambios[cambios.length - 2] + 5 * MIN : ahora;
    // lo ya comprado para revender, si ahora estás en positivo contando lo pujado (venderlo no te hace falta para llegar
    // en positivo): se puede apurar hasta el cambio del día del partido (un día más de subida)
    const pujado = (M.mercado || []).reduce((s, m) => s + (m.miPuja ? num(m.miPuja) : 0), 0);
    const apura = !!justo && num(D.dinero) - pujado >= 0;
    const ponerVenta = apura ? (ultimo || ahora) + 5 * MIN : ponerVentaSeguro;
    // los días que se mueve su valor hasta venderlo: todos, también los de la jornada en juego (el valor cambia cada día
    // aunque esos cambios no valgan para vender)
    const diasValor = ultimo ? clamp(Math.round((ultimo - ahora) / DIA), 1, 14) : 0;
    const margenJ = justo ? Math.round((inicioJ - justo) / MIN) : null;
    M.ventanaEsp = {
      ponerVenta, ponerVentaSeguro, limite: ultimo, ultimoMercado: apura ? justo : ultimo, ciclos: cambios.length, cambios, diasValor, justo, apura,
      // lo que se dice cuando se apura hasta ese cambio
      avisoJusto: apura ? `El último cambio de mercado es ${cuando(justo)} y la jornada empieza ${cuando(inicioJ)}: tendrás ${margenJ >= 90 ? `${Math.round(margenJ / 60)} h` : `${margenJ} min`} para aceptar la oferta.${ultimo ? ` Si no vas a poder, acepta la de ${cuando(ultimo)}.` : ''}` : '',
    };
  }
  M.reventa = extra.reventa || {};
  const vuelve = (j) => M.vuelve(j.id);
  const proyectar = (j, t, dias, vu) => {
    // la subida diaria reciente (7 días si hay, si no la de hoy rebajada) y que se va frenando
    let r = t.p7 != null ? t.p7 / 100 / 7 : t.p1 != null ? (t.p1 / 100) * 0.5 : 0;
    // si ha empezado a subir hace pocos días (2 o más), la de 7 días lleva dentro los de bajada: vale el ritmo de
    // esos días (`rRec` de M.tend)
    if (t.rRec != null) r = Math.max(r, t.rRec);
    r = clamp(r, -0.03, 0.04);
    // el que vuelve se frena más despacio (le queda mucho para su valor de antes). En el parón, sin partidos, las subidas
    // se apagan antes (lo que se le dice a la IA en el contexto): se frena algo más, para no prometer de más (19, 9 nov)
    const enParonLejos = paronLejos(M, ahora);
    const freno = vu ? (enParonLejos ? 0.89 : 0.92) : (enParonLejos ? 0.8 : 0.85);
    let v = j.valor;
    for (let k = 0; k < dias; k++) v *= 1 + r * Math.pow(freno, k);
    // (24 nov, Carlos) lo que frena un mal partido reciente (4 puntos o menos), por debajo de esto (`frenoTras`)
    const mal = dias > 0 ? M.malPartido(j.id) : null;
    if (mal) v = conFreno(j.valor, v, frenoA(mal.e, dias));
    return { r, v, mal };
  };
  /** (0.7.13u) para tenerlo: en cuántos días recupera lo que se paga de más sobre su valor si sigue subiendo como ahora
      (frenándose igual que en `proyectar`), mirando hasta 30 días. { dias (null si no llega), deMas, r } */
  M.tener = (j, t, puja, vu) => {
    const deMas = puja - num(j.valor);
    if (!(deMas > 0)) return { dias: 0, deMas: Math.max(0, deMas), r: null };
    const { r } = proyectar(j, t || M.tend(j.id), 0, vu);
    if (!(r > 0)) return { dias: null, deMas, r };
    const freno = vu ? (paronLejos(M, ahora) ? 0.89 : 0.92) : (paronLejos(M, ahora) ? 0.8 : 0.85);
    // (24 nov) con lo que frena un mal partido reciente, igual que en `proyectar`
    const mal = M.malPartido(j.id), valor = num(j.valor);
    let v = valor, vk = v;
    for (let k = 0; k < 30; k++) { v *= 1 + r * Math.pow(freno, k); vk = mal ? conFreno(valor, v, frenoA(mal.e, k + 1)) : v; if (vk >= puja) return { dias: k + 1, deMas, r }; }
    return { dias: null, deMas, r, max: vk };
  };
  /** (24 nov, aviso de Domy: «no puede ser que la app te descarte jugadores que están subiendo millones»; con 324 M de
      saldo, Bartra, +3,6 % al día, salía en «Mirados y descartados» porque a la puja que gana en su liga no da tiempo a
      revenderlo antes de la jornada) comprarlo para AGUANTARLO: pagado con saldo no hace falta venderlo antes de la
      jornada, y lleva 14 días con la cláusula cerrada. Sale a cuenta si lo pagado de más se recupera en `AGUANTA_RECUPERA`
      días o menos y a los `AGUANTA_DIAS` días se gana lo mismo que se pide para revender, y solo al que sube sin frenarse.
      Medido el 24 nov con el histórico de valor de toda LaLiga (.github/ia/medir-aguantar.mjs y
      claude/medida-aguantar-24nov.md; 5.002 casos desde mediados de septiembre de jugadores que subían más de un 0,8 %
      al día): la proyección casa (mediana real a 7 días +9,8 % frente a +9,4 %) y, pagando un +13-17 % y saliendo como
      la app (`M.aguantaReventa`), los que cumplen esta regla ganan en 8 de cada 10 casos (mediana +14-15 %, el peor 10 %
      pierde un 5-6 %); si lo pagado de más tarda 8-10 días en recuperarse, 6 de cada 10 (mediana +3-5 %), y si tarda
      más, se pierde en 6 de cada 10: por eso 7 días y no 10. (24 nov, Carlos) Con un mal partido reciente (4 puntos o menos)
      la proyección y los días de recuperar llevan su freno (`M.malPartido`): así ganan el 85-95 % de los que quedan.
      { dias, valorFuturo, beneficio, recupera } o null */
  const AGUANTA_DIAS = 10, AGUANTA_RECUPERA = 7;
  M.aguantar = (j, t, puja, vu, te = M.tener(j, t, puja, vu)) => {
    if (!te || te.dias == null || te.dias > AGUANTA_RECUPERA || !(te.r > 0.008) || !(te.deMas > 0)) return null;
    const ine = M.inercia(j.id);
    if (ine && !['sube', 'acelera', 'rebote'].includes(ine.fase)) return null;
    const v = proyectar(j, t || M.tend(j.id), AGUANTA_DIAS, vu).v, beneficio = v - puja;
    if (beneficio < Math.max(250000, puja * 0.025)) return null;
    return { dias: AGUANTA_DIAS, valorFuturo: v, beneficio, recupera: te.dias };
  };
  /** (24 nov) lo que se espera que suba en `AGUANTA_DIAS` días uno que sube sin frenarse (0 si no sube): lo que vuelve de lo
      pagado de más si te lo quedas. El plan lo cuenta al fichar para el once (antes lo pagado de más contaba entero,
      subiera o no: al que mejoraba el once y recuperaba la prima en una semana lo descartaba igual) */
  M.subeTeniendo = (j, t) => {
    if (!j || !j.valor) return 0;
    const ine = M.inercia(j.id);
    if (ine && !['sube', 'acelera', 'rebote'].includes(ine.fase)) return 0;
    const p = proyectar(j, t || M.tend(j.id), AGUANTA_DIAS, vuelve(j));
    return p.r > 0.004 ? Math.max(0, p.v - num(j.valor)) : 0;
  };
  // (0.7.13u) si la puja que gana en tu liga se recorta por lo que aporta a tu once, pero lo pagado de más se recupera
  // teniéndolo en 10 días o menos (sube fuerte), se puja la que gana: con la recortada casi nunca te lo llevas
  for (const m of M.mercado) {
    if (m.tipo !== 'liga' || !m.recortada || !(m.pujaGana > m.puja) || m.topeCal) continue;
    const te = M.tener(m.j, m.tend, m.pujaGana);
    if (te.dias != null && te.dias <= 10) { m.puja = m.pujaGana; m.pGana = m.pGanaLiga; m.recortada = false; m.porTener = te.dias; }
  }
  M.noRevender = {};
  M.especular = [];
  // (también con la jornada en juego: con un parón detrás hay dos semanas para revender; lo que no vale para vender
  // son los cambios de mercado de mientras se juega, y esos ya no cuentan en `ciclos`)
  if (M.ventanaEsp && M.ventanaEsp.ciclos >= 1) {
    const add = (j, t, origen, precio, extraInfo) => {
      if (MALOS.has(j.estado)) return;
      // para revender tiene que seguir subiendo hasta el día de vender: fuera lo que se frena o ya ha girado
      const ine = M.inercia(j.id);
      if (ine && (['giro', 'baja', 'parado'].includes(ine.fase) || (ine.fase === 'frena' && ine.giroEn != null && ine.giroEn < M.ventanaEsp.ciclos + 1))) return;
      // lo del mercado llega en el próximo cambio y luego hay que ponerlo a la venta: hacen falta 2 cambios
      if (M.ventanaEsp.ciclos < (origen === 'mercado' ? 2 : 1)) return;
      const dias = Math.max(M.ventanaEsp.ciclos, M.ventanaEsp.diasValor || 0);
      const vu = vuelve(j, t);
      const { r, v } = proyectar(j, t, dias, vu);
      let beneficio = v - precio;
      // (16 nov, Carlos: «Valverde, Pepe y Unai López son compras claras por cómo se revalorizan») la puja es la que de
      // verdad gana en tu liga por uno que viene como él (`m.pujaGana`). Si con esa ya no compensa revenderlo, la más
      // alta que aún sale a cuenta («puja como mucho X»), pero solo si con ella se ganan al menos la mitad de los
      // parecidos de tu liga (17 nov, Carlos, con Soriano: 1 de cada 4 era proponer una puja que casi nunca gana) y
      // siempre diciendo las dos cifras; si no, no se propone y se dice por qué (`M.noRevender`)
      let pujaJusta = false, pGana = extraInfo && extraInfo.pGana != null ? extraInfo.pGana : null;
      if (origen === 'mercado' && extraInfo && extraInfo.precioMercado && r > 0.004 && beneficio < Math.max(250000, precio * 0.025)) {
        const tope = Math.floor(Math.min(v / 1.025, v - 250000) / 10000) * 10000;
        const PVt = M.pagaLiga(j.valor, j.id), pT = PVt ? PVt.f(tope / j.valor - 1) : null;
        if (tope >= extraInfo.precioMercado && tope < precio && pT != null && pT >= 0.5) {
          extraInfo = { ...extraInfo, puja: tope, pujaLiga: precio }; precio = tope; beneficio = v - tope; pujaJusta = true; pGana = pT;
        } else {
          const te = M.tener(j, t, precio, vu);
          M.noRevender[j.id] = { pid: j.id, j, puja: precio, valorFuturo: v, beneficio, r, dias, tope: tope >= extraInfo.precioMercado ? tope : null, pTope: pT, tener: te, aguantar: M.aguantar(j, t, precio, vu, te) };
          return;
        }
      }
      if (r <= 0.004 || beneficio < Math.max(250000, precio * 0.025)) return;
      const confianza = vu && r > 0.01 ? 'alta' : t.p7 != null && r > 0.008 ? 'media' : 'baja';
      M.especular.push({ j, pid: j.id, tend: t, origen, precio, valorFuturo: v, beneficio, pct: beneficio / precio, r, dias, vender: M.ventanaEsp.ponerVentaSeguro, confianza: pujaJusta && confianza === 'alta' ? 'media' : confianza, vuelve: vu, pujaJusta, ...extraInfo, pGana, tener: origen === 'mercado' ? M.tener(j, t, precio, vu) : null });
    };
    // la puja es la misma que en Mercado → Fichar y en el plan (`m.puja`: lo que hace falta en tu liga para llevártelo).
    // Antes, para revender, se pujaba un 1,2 % más por puja sobre el precio, pero al cuadrar el plan se subía a `m.puja`
    // (con menos, en tu liga lo normal es perderlo) y el beneficio salía contado con la puja baja (3 nov: Cubarsí, 43,96 M
    // en Especular y 45,87 M en Hoy). Con la misma puja, el beneficio es el de verdad y si no compensa no sale
    // (0.7.13u) para revender, la que gana en tu liga (`pujaGana`): los recortes de `m.puja` son por lo que aporta a tu once
    for (const m of M.mercado) if (m.tipo === 'liga' && !m.miPuja && m.puja) { const pg = Math.max(m.puja, m.pujaGana || 0); add(m.j, m.tend, 'mercado', pg, { puja: pg, precioMercado: m.precio, pGana: pg === m.puja ? m.pGana : m.pGanaLiga }); }
    for (const x of M.clausulas) if (x.abierta) add(x.j, x.tend, 'clausula', x.clausula, { rival: x.rival });
    // el que vuelve va delante aunque el beneficio calculado sea algo menor (la tendencia se queda corta con él)
    const peso = (e) => e.beneficio * (e.vuelve ? 1.5 : 1);
    M.especular.sort((a, b) => peso(b) - peso(a));
  }
  // lo que compraste para revender y sigue en tu equipo
  M.paraRevender = M.mias.filter((x) => M.reventa[x.pid]).map((x) => ({ ...x, rev: M.reventa[x.pid], beneficioYa: x.j.valor - (M.reventa[x.pid].precio || x.compra || x.j.valor) }));
  /** (19 nov, Mario Soriano: el plan lo mandaba vender «para revender» perdiendo 6,89 M, con la cláusula cerrada 12 días
   * más y aún subiendo) lo comprado para revender se aguanta mientras le queden más de 1,5 días de cláusula cerrada, no
   * esté bajando y siga subiendo (también si la subida se frena pero aún sube) o valga menos de lo que se pagó: venderlo
   * así es tirar dinero. Si hace falta el dinero para empezar la jornada en positivo, el plan lo sigue pudiendo vender por eso */
  M.aguantaReventa = (x) => {
    if (!x || !x.protegidoHasta || x.protegidoHasta - ahora <= 1.5 * DIA) return false;
    const ine = M.inercia(x.pid), t = x.tend || {};
    if ((t.p1 != null && t.p1 < -1) || (ine && ['giro', 'baja'].includes(ine.fase))) return false;
    const sube = !!ine && (['sube', 'acelera', 'rebote'].includes(ine.fase) || (ine.fase === 'frena' && num(ine.ult) > 0));
    const r = M.reventa[x.pid], pagado = (r && r.precio) || x.compra || 0;
    return sube || (pagado > 0 && x.j.valor < pagado);
  };

  /* ---------- cómo juega cada rival (función top «perfilRival», 0.6.5) ---------- */
  // con todo el historial de la liga (AH): sus clausulazos (a quién y con cuánto sobre el valor), lo que ficha y vende
  // (a LaLiga o a otros managers), cuántos días tiene a un jugador antes de venderlo, qué puestos ficha, cuántas veces
  // se protege y a qué hora se mueve. Se calcula al pedirlo (su ficha y la IA), una vez por análisis
  const cachePerfil = {};
  const mediana = (l) => { if (!l.length) return null; const o = [...l].sort((x, y) => x - y), m = (o.length - 1) / 2; return (o[Math.floor(m)] + o[Math.ceil(m)]) / 2; };
  M.perfil = (tid) => {
    if (!tid) return null;
    if (tid in cachePerfil) return cachePerfil[tid];
    const de = (a) => tidDe(a.quienId, a.quien), otroDe = (a) => tidDe(a.otroId, a.otro);
    const lista = AH.lista.filter((a) => a.t && (de(a) === tid || otroDe(a) === tid)).sort((x, y) => y.t - x.t);
    const suyos = lista.filter((a) => de(a) === tid);
    const imp = (a) => Math.abs(num(a.importe));
    const sobre = (a) => { const v = valorEn(a.pid, a.t - 3 * HORA); return v && imp(a) ? imp(a) / v - 1 : null; };
    // los clausulazos que ha hecho y a quién
    const czs = suyos.filter((a) => a.clase === 'clausula' && a.pid).map((a) => ({ pid: a.pid, t: a.t, imp: imp(a), s: sobre(a), a: otroDe(a) }));
    const czS = czs.map((x) => x.s).filter((x) => x != null && x > -0.1 && x < 3);
    const victimas = {};
    for (const x of czs) if (x.a && x.a !== tid) victimas[x.a] = (victimas[x.a] || 0) + 1;
    const recibidos = lista.filter((a) => a.clase === 'clausula' && otroDe(a) === tid && de(a) !== tid).length;
    // lo que ficha: del mercado (a LaLiga) o a otro manager; y lo que paga sobre el valor en el mercado
    const comprasL = suyos.filter((a) => a.clase === 'compra' && a.pid && !(a.otroId || a.otro));
    const comprasM = suyos.filter((a) => a.clase === 'compra' && a.pid && (a.otroId || a.otro));
    const pagaS = comprasL.map(sobre).filter((x) => x != null && x >= -0.1 && x <= 1);
    // lo que vende: a LaLiga (una venta que no es la compra de otro manager) o a otro manager (la compra de otro con él
    // de vendedor; los clausulazos que le hacen no cuentan: no los decide él)
    const deManager = new Set(AH.lista.filter((a) => (a.clase === 'compra' || a.clase === 'clausula') && a.pid && (a.otroId || a.otro)).map((a) => `${a.pid}|${imp(a)}`));
    const ventasL = suyos.filter((a) => a.clase === 'venta' && a.pid && !deManager.has(`${a.pid}|${imp(a)}`));
    const ventasM = lista.filter((a) => a.clase === 'compra' && a.pid && otroDe(a) === tid && de(a) !== tid);
    // cuántos días tiene a un jugador desde que lo ficha hasta que lo vende
    const dias = [];
    for (const a of [...ventasL, ...ventasM]) { const f = fichajeAntes(tid, a.pid, a.t); if (f) dias.push((a.t - f.t) / DIA); }
    const puestos = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const a of [...comprasL, ...comprasM, ...czs]) { const q = J(a.pid).pos; if (puestos[q] != null) puestos[q]++; }
    // se protege: el escudo de LaLiga y las subidas de cláusula que paga (las que hace LaLiga sola no cuentan; esas se
    // guardan desde que se usa la app en este dispositivo)
    const escudos = suyos.filter((a) => a.clase === 'blindaje').length;
    const subidas = (H.mov || []).filter((m) => m.teamId === tid && M.blindaPagada(m)).length;
    // a qué hora se mueve: lo que hace él al momento (clausular, vender, blindar); las compras del mercado se cierran
    // todas en el cambio de mercado y no dicen nada de cuándo entra
    const propios = suyos.filter((a) => ['clausula', 'venta', 'blindaje'].includes(a.clase));
    let franja = null;
    if (propios.length >= 5) {
      const horas = new Array(24).fill(0);
      for (const a of propios) horas[Number(horaReloj(a.t).slice(0, 2)) % 24]++;
      let mejor = -1, ini = 0;
      for (let h = 0; h < 24; h++) { const n = horas[h] + horas[(h + 1) % 24] + horas[(h + 2) % 24]; if (n > mejor) { mejor = n; ini = h; } }
      franja = { ini, fin: (ini + 3) % 24, n: mejor, de: propios.length, pct: mejor / propios.length };
    }
    const sem = AH.desde ? Math.max(1, (ahora - AH.desde) / (7 * DIA)) : null;
    const dMed = mediana(dias), pagaMed = mediana(pagaS);
    // en dos palabras, solo lo que se sale de lo normal
    const rasgos = [];
    if (yoTid && victimas[yoTid] >= 2) rasgos.push(['mal', 'Va a por ti', `te ha clausulado a ${victimas[yoTid]}`]);
    if (czs.length >= 3 && sem && czs.length / sem >= 0.4) rasgos.push(['mal', 'Clausula mucho', `${czs.length} en ${Math.round(sem)} semanas`]);
    else if (!czs.length && suyos.length >= 10) rasgos.push(['bien', 'No clausula', 'no ha pagado ninguna cláusula']);
    if (dias.length >= 3 && dMed < 7) rasgos.push(['duda', 'Vende rápido', `los tiene unos ${Math.max(1, Math.round(dMed))} días`]);
    else if (dias.length >= 3 && dMed > 25) rasgos.push(['bien', 'Aguanta a los suyos', `los tiene unos ${Math.round(dMed)} días`]);
    if (pagaS.length >= 3 && pagaMed >= 0.15) rasgos.push(['duda', 'Puja fuerte', `paga un ${pct(pagaMed * 100)} sobre el valor`]);
    if (escudos + subidas >= 3) rasgos.push(['', 'Se protege', `${escudos + subidas} veces`]);
    if (suyos.length < 5) rasgos.push(['', 'Casi no se mueve', `${suyos.length} movimiento${suyos.length === 1 ? '' : 's'}`]);
    return (cachePerfil[tid] = {
      n: suyos.length, desde: AH.desde || null, completa: !!AH.completa, sem,
      cz: { n: czs.length, med: mediana(czS), max: czS.length ? Math.max(...czS) : null, victimas, ult: czs.slice(0, 5) }, recibidos,
      compras: { liga: comprasL.length, manager: comprasM.length, paga: pagaMed, nPaga: pagaS.length },
      ventas: { liga: ventasL.length, manager: ventasM.length, dias: dMed, nDias: dias.length },
      puestos, escudos, subidas, franja, rasgos,
    });
  };

  /* ---------- el radar de subidas (Mercado → Fichar, con la función top «inercia», 0.6.5) ---------- */
  // los que más van a subir los próximos 3 días según su inercia (suben o aceleran), con de quién es cada uno, y los
  // que acaban de hacer un partidazo (tras uno así LaLiga suele subirles el valor). Lo de la inercia, una vez por
  // análisis; los partidazos, cada vez (los puntos en directo entran sin rehacer el motor)
  let radarSuben = null;
  const enRadar = (j) => {
    const tid = M.dueno[j.id] || null;
    return {
      j, pid: j.id, tid, mio: !!tid && tid === yoTid, tend: M.tend(j.id),
      mercado: M.mercado.find((m) => m.pid === j.id && !(m.tipo === 'manager' && m.vendedorTeamId === yoTid)) || null,
      cl: tid && tid !== yoTid ? M.clausulas.find((x) => x.pid === j.id) || null : null,
    };
  };
  M.radar = () => {
    const base = Object.values(D.maestro).filter((j) => j && j.valor && j.pos && j.pos < 5 && !MALOS.has(j.estado));
    if (!radarSuben) {
      const l = [];
      for (const j of base) {
        const x = M.inercia(j.id);
        // los que vuelven (misma regla que en Especular) entran siempre, aunque la inercia aún no tenga días bastantes
        // o lleven poco subiendo; lo que suben en 3 días se calcula como en Especular (se frenan más despacio)
        // (0.7n: De Jong, a 9 M y +5 % al día, no salía entre los 10 que más suben en euros)
        const vu = M.vuelve(j.id);
        if (vu) {
          const p = proyectar(j, M.tend(j.id), 3, vu);
          const proy3 = Math.max(p.v - j.valor, x && x.proy3 > 0 ? x.proy3 : 0);
          if (proy3 > 0) { l.push({ j, proy3, fase: x ? x.fase : 'sube', ult: x ? x.ult : j.valor * vu.ritmo, vuelve: vu }); continue; }
        }
        if (!x || !['sube', 'acelera'].includes(x.fase) || !(x.proy3 > 0)) continue;
        l.push({ j, proy3: x.proy3, fase: x.fase, ult: x.ult, vuelve: null });
      }
      // los que vuelven, primero (como mucho 3; en euros uno de 9 M no le gana nunca a uno de 60 M, pero es la compra
      // más clara para revender) y luego los 10 que más suben
      l.sort((a, b) => b.proy3 - a.proy3);
      const vuelven = l.filter((x) => x.vuelve).slice(0, 3);
      const top = [...vuelven, ...l.filter((x) => !vuelven.includes(x)).slice(0, 10)];
      radarSuben = top.map((x) => ({ ...enRadar(x.j), proy3: x.proy3, pct3: x.proy3 / x.j.valor, fase: x.fase, ult: x.ult, vuelve: x.vuelve }));
    }
    const pz = [];
    for (const j of base) { const p = M.partidazo(j.id); if (p && p.nivel >= 2) pz.push({ j, p }); }
    pz.sort((a, b) => b.p.pts - a.p.pts || b.j.valor - a.j.valor);
    return { suben: radarSuben, partidazos: pz.slice(0, 8).map((x) => ({ ...enRadar(x.j), pz: x.p })) };
  };

  // (17 nov) a quién blindar gratis (el escudo, viendo un anuncio): los importantes con la cláusula abierta y algún rival
  // que la puede pagar; antes que gastar en subirla. Lo usan el plan, Hoy y la ficha
  {
    const ES = M.escudosMios || { quedan: 0 };
    M.paraEscudo = ES.quedan ? M.mias.filter((x) => x.abierta && !x.escudo && x.importa && x.riesgo !== 'ninguno' && !x.ventaInercia && !x.noBlindar && !MALOS.has(x.j.estado) && x.pagan && (x.pagan.seguro.length || x.pagan.quiza.length) && !M.enVenta.has(x.pid)).sort((a, b) => b.pierde - a.pierde).slice(0, ES.quedan).map((x) => x.pid) : [];
  }
  /* ---------- el cambio: vender a un titular que baja y fichar su recambio (24 nov, Carlos con Alti) ----------
     «puedo tener un jugador en el 11 titular porque no tengo otro… este jugador hay que venderlo aunque no tienes todavía
     recambios, y que la aplicación te proponga qué suplente buscar». Un titular de tu once que baja (todos los días, o ha
     girado y juega «de relleno») y sin nadie en tu plantilla que puntúe como él: se propone venderlo y pujar por el mejor
     de su puesto del mercado que te llega. La oferta de LaLiga por el que sale no se acepta hasta tener el recambio
     (`misVentas` lo protege mientras sigue siendo titular sin relevo). Lo usan el plan, Equipo y la ficha */
  {
    // de relleno: está en tu once pero da poco (3 puntos esperados o menos) o juega poco con su equipo (menos del 65 %)
    M.relleno = (x) => {
      if (!x || M.perdida(x.pid) < 0.3) return false;
      const T = M.titularidad ? M.titularidad(x.j) : null;
      return (M.ppEsperado(x.j) || 0) <= 3 || (!!T && T.p != null && T.p < 0.65);
    };
    const sinRelevoC = (x) => { const p = M.perdida(x.pid); return p >= 1 && p >= 0.5 * (M.ppEsperado(x.j) || 0); };
    const cacheR = {};
    /** los mejores del mercado (de LaLiga) de su puesto que te llegan y puntúan más que él, de más a menos puntos */
    M.recambios = (pid, n = 3) => {
      if (pid in cacheR) return cacheR[pid].slice(0, n);
      const x = M.mias.find((y) => y.pid === pid);
      if (!x) return [];
      const ppX = M.ppEsperado(x.j) || 0;
      const l = (M.mercado || []).filter((m) => m.tipo === 'liga' && !m.miPuja && !M.dueno[m.pid] && m.j && m.j.pos === x.j.pos && !MALOS.has(m.j.estado) && m.puja && m.puja <= M.pujaMax)
        .map((m) => {
          const pp = M.ppEsperado(m.j) || 0, T = M.titularidad ? M.titularidad(m.j) : null, ine = M.inercia(m.pid);
          return { pid: m.pid, j: m.j, puja: m.puja, precio: m.precio, pp, gana: pp - ppX, tit: T && T.p != null ? T.p : null, prox: M.proximoPartido(m.j.equipoId), sube: !!ine && ['sube', 'acelera'].includes(ine.fase) };
        })
        .filter((r) => r.gana >= 0.5 && (r.tit == null || r.tit >= 0.6))
        .sort((a, b) => b.gana - a.gana || a.puja - b.puja);
      cacheR[pid] = l;
      return l.slice(0, n);
    };
    /** el cambio de un tuyo: { x, rec } o null */
    M.cambioDe = (pid) => {
      const x = M.mias.find((y) => y.pid === pid);
      if (!x || M.noVender.has(pid) || M.vendeBaja(x) || (M.reventa || {})[pid] || M.perdida(pid) < 0.3 || M.cambioHecho(pid)) return null;
      const baja = !!M.bajaSeguido(pid) || (!!x.ventaInercia && M.relleno(x));
      if (!baja || !sinRelevoC(x)) return null;
      const rec = M.recambios(pid);
      return rec.length ? { x, rec } : null;
    };
  }
  /* ---------- un trato entre managers (19 nov, el trueque de Carlos con Domy) ----------
     Uno o dos jugadores míos y del mismo rival, cada uno con su precio. Son dos compras, una detrás de otra, y el dinero
     de la primera entra al momento: aquí se mira quién puede pagar primero (yo con mi saldo o él con el suyo), el saldo de
     cada paso, mi valor antes y después, el precio frente a lo que pide un dueño por él (ofertaDueno), los puntos, lo que
     sube cada uno, los 14 días de cláusula cerrada y la otra vía (su cláusula). Antes la IA hacía estas cuentas sola y
     salían mal (el dinero «no entraba hasta el cambio de mercado», «cambio a valores»...): ahora las hace la app y la IA
     las explica, como con las ofertas.
     spec: { mios: [{ pid, precio }], suyos: [{ pid, precio }], sinClausula } → null si no es un trato válido */
  M.trato = (spec) => {
    if (!spec) return null;
    const lado = (l) => (l || []).map((x) => ({ ...x, j: J(x.pid) })).filter((x) => x.j && x.j.valor);
    const mios = lado(spec.mios).filter((x) => M.dueno[x.pid] === yoTid), suyos = lado(spec.suyos).filter((x) => M.dueno[x.pid] && M.dueno[x.pid] !== yoTid);
    if (!mios.length || !suyos.length || mios.length > 2 || suyos.length > 2) return null;
    const tid = M.dueno[suyos[0].pid];
    if (suyos.some((x) => M.dueno[x.pid] !== tid)) return null;
    const ritmo = (j) => { const t = M.tend(j.id) || {}; return t.diaE != null ? t.diaE : t.d7 != null ? t.d7 / 7 : num(t.d1); };
    for (const x of [...mios, ...suyos]) {
      x.valor = x.j.valor;
      x.precio = Math.round(num(x.precio) || x.valor);
      x.ritmo = ritmo(x.j);
      x.pp = M.ppEsperado ? M.ppEsperado(x.j) : 0;
      x.ine = M.inercia(x.pid);
    }
    for (const x of mios) { const m = (M.mias || []).find((y) => y.pid === x.pid) || {}; x.riesgo = m.riesgo || 'ninguno'; x.abierta = !!m.abierta; x.protegidoHasta = m.protegidoHasta || null; x.clausula = m.clausula || null; x.compra = m.compra || null; }
    for (const x of suyos) {
      x.of = ofertaDueno(M, x.j, M.tend(x.pid) || {});
      const c = (M.clausulas || []).find((y) => y.pid === x.pid);
      x.cl = c ? { clausula: c.clausula, abierta: !!c.abierta, abre: c.abierta ? null : c.protegidoHasta, veda: c.veda || null } : null;
    }
    const saldo = num(D.dinero);
    const cobro = mios.reduce((s, x) => s + x.precio, 0), pago = suyos.reduce((s, x) => s + x.precio, 0);
    const vMios = mios.reduce((s, x) => s + x.valor, 0), vSuyos = suyos.reduce((s, x) => s + x.valor, 0);
    // (Carlos, 19 nov: con deuda solo se puja en el mercado; todo lo demás, también comprarle a otro mánager, solo con saldo)
    // el dinero de él: seguro (le sobra con el margen de la estimación), quiza (le llega con el margen) o null si no se sabe
    const cap = M.capacidad(tid);
    const leLlega = (imp) => (!cap ? 'nose' : cap.seguro >= imp ? 'si' : cap.alto >= imp ? 'quiza' : 'no');
    // él primero: me compra lo mío con su saldo, me entra al momento y luego pago yo
    const suyo1 = leLlega(cobro), elPrimero = suyo1 !== 'no' && saldo + cobro >= pago;
    // con su dinero estimado (no el de LaLiga), «no le llega» puede fallar: el trato vale si le llega (dudaEl)
    const dudaEl = suyo1 === 'no' && cap && !cap.exacto && saldo + cobro >= pago;
    // yo primero: pago con mi saldo y él me paga con lo suyo más lo que le acabo de dar
    const yoPrimero = saldo >= pago && (!cap || leLlega(Math.max(0, cobro - pago)) !== 'no');
    const orden = elPrimero ? 'el' : yoPrimero ? 'yo' : dudaEl ? 'el' : null;
    const saldoFin = saldo + cobro - pago;
    const valorAntes = saldo + (M.mias || []).reduce((s, x) => s + num(x.j && x.j.valor), 0);
    const dValor = cobro - pago + vSuyos - vMios;
    const normal = suyos.reduce((s, x) => s + (x.of ? x.of.v : x.valor), 0);
    const deMas = pago - vSuyos, cedo = vMios - cobro;
    // los puntos de mi once por jornada, con el cambio hecho
    let dPts = 0;
    try { const base = (M.mias || []).map((x) => x.j).filter((j) => !mios.some((m) => m.pid === j.id)); dPts = M.mejorOnce([...base, ...suyos.map((x) => x.j)]).total - M.once.total; } catch (e) { dPts = 0; }
    // lo que suben de más los que recibo en los 14 días que los tengo seguros, y lo que valen esos puntos (100 mil cada uno)
    const dRitmo = suyos.reduce((s, x) => s + x.ritmo, 0) - mios.reduce((s, x) => s + x.ritmo, 0);
    const jornadas14 = Math.max(1, jornadas.filter((jo) => jo.ini > ahora && jo.ini < ahora + 14 * DIA).length);
    const gana14 = dRitmo * 14 + dPts * jornadas14 * 1e5;
    const neto = gana14 + dValor;
    // la otra vía: su cláusula (si él no dice que se la blindan o la suben), con mi saldo de ahora y quedándome lo mío
    let via = null;
    if (suyos.length === 1 && suyos[0].cl) {
      const c = suyos[0].cl;
      via = { ...c, meLlega: c.clausula <= saldo, ahorro: pago - c.clausula - cobro + vMios, fuera: !!spec.sinClausula, antesJornada: !M.proxima || c.abierta || (c.abre && c.abre < M.proxima.ini) };
      via.vale = !via.fuera && via.meLlega && via.antesJornada && c.clausula < pago;
    }
    const enRiesgo = mios.filter((x) => x.riesgo === 'medio' || x.riesgo === 'alto');
    let veredicto, motivo, si = '';
    const caro = pago > normal * 1.03;
    if (!orden) { veredicto = 'NO SE PUEDE'; motivo = 'no os llega el dinero ni pagando tú primero ni él'; }
    else if (caro && neto < 0) { veredicto = 'NO CONVIENE'; motivo = 'pagas por encima de lo normal entre managers y no lo recuperas con puntos ni con lo que sube'; }
    else if (neto >= 0 && dPts >= -0.3) { veredicto = 'CONVIENE'; motivo = dPts > 0.3 ? 'ganas puntos en el once y lo que pagas de más lo recuperas' : 'lo que pagas de más lo recuperas con lo que sube y sus 14 días protegido'; }
    else if (dPts > 0.3) { veredicto = 'CONVIENE SI'; si = 'lo quieres para el once'; motivo = 'te da más puntos, pero pierdes algo de valor'; }
    else if (neto > -Math.max(1e6, vSuyos * 0.03) && enRiesgo.length) { veredicto = 'CONVIENE SI'; si = 'temes que te clausulen lo tuyo'; motivo = 'casi te quedas igual y te quitas el riesgo de cláusula'; }
    else { veredicto = 'NO CONVIENE'; motivo = dPts < -0.3 ? 'pierdes puntos en el once y valor' : 'pierdes valor y no lo recuperas con lo que sube'; }
    if ((veredicto === 'CONVIENE' || veredicto === 'CONVIENE SI') && orden === 'el' && !elPrimero) { veredicto = 'CONVIENE SI'; si = `le llega el dinero para pagarte primero${si ? ` y ${si}` : ''}`; }
    if ((veredicto === 'CONVIENE' || veredicto === 'CONVIENE SI') && via && via.vale) { veredicto = 'CONVIENE SI'; si = `no te da tiempo a pagar su cláusula${si ? ` y ${si}` : ''}`; motivo = `por su cláusula te sale ${eur(Math.abs(via.ahorro))} ${via.ahorro >= 0 ? 'mejor' : 'peor'} y te quedas lo tuyo, pero no es seguro`; }
    return { tid, mios, suyos, saldo, cobro, pago, orden, suyo1, dudaEl, yoPrimero, elPrimero, cap, saldoFin, valorAntes, valorDespues: valorAntes + dValor, dValor, normal, deMas, cedo, barato: pago <= normal, dPts, dRitmo, jornadas14, gana14, neto, via, enRiesgo, veredicto, motivo, si };
  };

  // la lista de «lo que toca» de Hoy: sus textos, en acciones.js (aquí, solo cálculos)
  // (24 nov) UNA decisión por jugador (decide.js): la leen «Ahora mismo», el plan, Equipo, los avisos y la IA
  decidir(D, M, c);
  M.acciones = acciones(D, M, c);
  // el próximo momento en que algo cambia solo por la hora (se abre una cláusula, cierra el mercado, empieza o acaba un
  // partido, una jornada, un cierre de cláusulas o el parón, o cambia el día): el refresco de cada minuto de app.js solo
  // rehace el motor al pasar por aquí; entre medias pone al día las cuentas atrás (revisión total, M7)
  {
    let h = Infinity;
    const mira = (t) => { if (t && t > ahora && t < h) h = t; };
    for (const v of M.vedas) { mira(v.ini); mira(v.fin); }
    for (const jo of jornadas) { mira(jo.ini); mira(jo.fin); for (const p of jo.partidos) { mira(p.fecha); mira(p.fecha + 2 * HORA); } }
    for (const x of M.mias || []) mira(x.protegidoHasta);
    for (const x of M.clausulas || []) mira(x.protegidoHasta);
    mira(M.cierreMercado);
    for (const m of M.mercado || []) mira(m.cierra);
    if (M.paron) { mira(M.paron.ini); mira(M.paron.fin); }
    let t = Math.ceil(ahora / HORA) * HORA;
    for (let i = 0; i < 26 && diaDe(t) === hoyM; i++) t += HORA;
    mira(t);
    M.proximoHito = h;
  }
  return M;
}

/** lo que pagaste por cada jugador tuyo, sacado de la actividad de la liga */
function compras(D, M, yoTid, historial = []) {
  const out = {};
  const yo = M.equipo[yoTid];
  const misNombres = new Set([yo && norm(yo.manager), yo && norm(yo.nombre), D.yo && norm(D.yo.nombre)].filter(Boolean));
  // todos los movimientos: los guardados desde el principio de la liga y los de ahora (antes solo los de ahora, unos 80:
  // lo fichado hace tiempo no salía y se daba por hecho que venía en el equipo inicial; lo avisó Domy el 25 oct)
  const vistos = new Map();
  for (const a of [...historial, ...(D.actividad || [])]) vistos.set(a.id || `${a.t}|${a.tipo}|${a.pid}|${a.quienId}|${a.importe}`, a);
  const acts = [...vistos.values()].sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const a of acts) {
    if (!a.pid || !a.importe) continue;
    const mio = (yoTid && M.teamDeUsuario(a.quienId, a.quien) === yoTid) || (D.yo && D.yo.userId && a.quienId === D.yo.userId) || misNombres.has(norm(a.quien));
    if (mio && (a.clase === 'compra' || a.clase === 'clausula')) out[a.pid] = Math.abs(a.importe);
  }
  return out;
}

/** la lista de lo que toca, de más a menos urgente; cada cosa con su porqué en números */
/** si una cláusula merece la pena (abierta o por abrir): la misma regla para el plan, el chip de «Hoy» y los avisos,
 * para que la app no anuncie una cláusula que luego la IA desaconseja (Revivo, 9 nov) */
/* (11 nov) Si una cláusula merece la pena, sin mirar el dinero: la misma regla para Hoy, las alarmas (esClausulable,
   que además pide que te llegue con el saldo de ahora) y el plan sin IA (planAuto, que mira el dinero con lo que vende
   antes). Antes planAuto llevaba su propio filtro (interés 55, sin `mejora` ni el calendario) y podía mandar clausular a
   uno que Hoy no enseñaba, o al revés. */
/**
 * cuánto hay que ofrecerle a un rival para que te venda a j (aviso de leao, 17 nov: el chat ofrecía un 10 % fijo, sin
 * mirar si sube): lo que le daría LaLiga en el próximo cambio de mercado (la parte alta de lo que da en tu liga) sobre lo
 * que valdrá para entonces con lo que sube al día. Si sube fuerte (más de un 1 % al día o un 8 % en 7 días), lo normal es
 * que su dueño pida más. null si no hay valor
 */
export function ofertaDueno(M, j, t = {}, ahora = Date.now()) {
  if (!j || !j.valor) return null;
  const ine = M.inercia ? M.inercia(j.id) : null;
  const subiendo = !!ine && ['sube', 'acelera', 'frena'].includes(ine.fase);
  const dia = subiendo ? num(ine.ult) : num(t.d1);
  const OL = M.ofertaLigaDe ? M.ofertaLigaDe(j) : null;
  const alta = OL && !OL.sinDatos && OL.max ? OL.max / j.valor - 1 : 0.1;
  let v = (j.valor + Math.max(0, dia)) * (1 + Math.max(0.02, alta));
  const sube = dia > j.valor * 0.01 || (t.p7 != null && t.p7 > 8);
  // (20 nov, Carlos con Revivo, defensa titular que sube un 20 % en la semana, a dos horas de la jornada: «por solo un
  // millón más evidentemente no me lo va a aceptar») si sube, su dueño no lo suelta por menos de lo que ganaría
  // quedándoselo una semana; y si la jornada empieza en menos de dos días y lo tiene para puntuar, por los puntos que
  // perdería (cada uno, 100 mil)
  if (sube) {
    // (lo que se espera que suba, o tres cuartos de lo que subió la última semana: su dueño mira lo que ha subido)
    const visto = t.p7 != null && t.p7 > 0 ? (0.75 * j.valor * t.p7) / 100 : 0;
    const p7 = Math.max(subiendo ? Math.max(0, ine.proy(7)) : 0, visto);
    v = Math.max(v, (j.valor + p7) * 1.03);
  }
  const pp = M.proxima && M.proxima.ini - ahora < 2 * DIA && M.ppEsperado ? num(M.ppEsperado(j)) : 0;
  if (pp >= 2) v += pp * 1e5;
  return { v: Math.ceil(v / 1e4) * 1e4, sube, conPuntos: pp >= 2 };
}

export function mereceClausula(M, x, ahora = Date.now()) {
  return !!(x && x.j && x.interes >= 50 && !MALOS.has(x.j.estado)
    && M.sobrecoste(x.j, x.clausula, x.tend).indice <= M.tolerancia(x.j) - 30
    && (M.mejora(x.j) >= 0.5 || (x.ratio != null && x.ratio <= 1.05))
    && M.compraCal(x.j, x.clausula).ok && M.conSalida(x.j, x.clausula, x.tend)
    // (19) en el parón, con la vuelta lejos, solo los chollos claros: si no, «Clausula a X» salía como urgente
    && (!paronLejos(M, ahora) || cholloParon(M, x.j, x.clausula)));
}
/** la cláusula se puede y merece la pena clausular hoy: te llega con tu saldo y pasa mereceClausula */
export const esClausulable = (M, x, ahora = Date.now()) => !!(x && x.meLlega && mereceClausula(M, x, ahora));



/**
 * El plan del día sin IA: las mismas reglas de «lo que toca», pero ordenadas como operaciones para que el
 * dinero cuadre (primero vender, luego clausular y pujar, después proteger y alinear). Tiene la misma forma
 * que el plan de la IA, así que se pinta igual.
 */
/**
 * (17 nov, Carlos: «el negativo no preocupa el martes; a partir del miércoles, y sobre todo jueves y viernes») con qué
 * fuerza se avisa de ir en negativo, según los cambios de mercado que quedan para vender antes de la jornada (los que
 * cuentan: el del día del partido no, `M.ventanaEsp.ciclos`). 3 o más: sin prisa; 2: ojo; 1: hoy hay que ponerlo a la
 * venta; 0: solo queda, si acaso, el del día del partido. { nivel: 'calma'|'ojo'|'ya'|'tarde', tipo: 'plan'|'mal', txt }
 */
export function prisaNegativo(M) {
  const v = M.ventanaEsp;
  if (!v) return { nivel: 'tarde', tipo: 'mal', txt: '' };
  const c = v.cambios || [], n = c.length;
  if (n >= 3) return { nivel: 'calma', tipo: 'plan', txt: `Sin prisa: quedan ${n} cambios de mercado para vender, el último que cuenta ${cuando(v.limite)}.` };
  if (n === 2) return { nivel: 'ojo', tipo: 'plan', txt: `Quedan dos cambios de mercado para vender (${cuando(c[0])} y ${cuando(c[1])}): ponlo a la venta antes del primero y, si la oferta no te convence, te queda el segundo.` };
  if (n === 1) return { nivel: 'ya', tipo: 'mal', txt: `Solo queda un cambio de mercado para vender, ${cuando(c[0])}: ponlo a la venta hoy y acepta la oferta que llegue.` };
  return { nivel: 'tarde', tipo: 'mal', txt: v.justo ? `Ya solo queda el cambio de ${cuando(v.justo)}, ${M.proxima && M.proxima.ini - v.justo < 3 * HORA ? 'muy pegado al primer partido' : 'el mismo día del primer partido'}: ponlo a la venta ya y acepta la oferta en cuanto llegue.` : 'Ya no queda ningún cambio de mercado antes de la jornada: solo puedes aceptar una oferta que ya tengas.' };
}

/** (0.7.13u) de cada 10 compras parecidas de tu liga, en cuántas habría bastado esa puja */
export const vecesTxt = (p) => (Math.round(p * 10) <= 0 ? 'casi nunca te lo llevas' : Math.round(p * 10) >= 10 ? 'te lo llevas casi seguro' : `te lo llevas más o menos ${Math.round(p * 10)} de cada 10 veces`);

/** (0.7.13u) lo que se dice de la puja para revender: la que gana en tu liga o, si con esa no sale, el tope */
export function pujaRevTxt(M, e) {
  if (!e || e.origen !== 'mercado') return '';
  const ganas = e.pGana != null ? ` Con ${eur(e.puja)}, ${vecesTxt(e.pGana)}.` : '';
  // (17 nov, Carlos) siempre las dos: la que hace falta para llevártelo y el tope para que revenderlo salga a cuenta
  if (e.pujaJusta) return `Para llevártelo, en tu liga hacen falta unos ${eur(e.pujaLiga)}; para que revenderlo te salga a cuenta, puja como mucho ${eur(e.puja)}.${ganas} `;
  const P = M.pagaLiga ? M.pagaLiga(e.j.valor, e.pid) : null;
  return P && P.pf && P.pf.r != null && P.pf.r > 0.008 ? `En tu liga, a los que suben así se los llevan con un ${pct(P.med * 100)} sobre su valor de mediana: por eso la puja es de ${eur(e.puja)}.${ganas} ` : '';
}

/** (0.7.13u) por qué uno que sube fuerte no va para revender: a la puja que gana en tu liga ya no sale, y si tenerlo sí */
/** (24 nov) si a la proyección de uno le resta un mal partido reciente (`M.malPartido`), una frase para decirlo; si no, '' */
export function malPartidoTxt(M, pid) {
  const m = M && M.malPartido ? M.malPartido(pid) : null;
  return m ? `Ya cuento que en su último partido hizo ${m.pts} punto${m.pts === 1 ? '' : 's'}: tras uno así, el que sube se frena.` : '';
}

export function noRevenderTxt(M, nr) {
  const P = M.pagaLiga ? M.pagaLiga(nr.j.valor, nr.pid) : null;
  const tope = nr.tope && nr.pTope != null ? `; pujando como mucho ${eur(nr.tope)} sí ganarías, pero en tu liga así ${vecesTxt(nr.pTope)}` : '';
  const te = nr.tener, ag = nr.aguantar;
  const antes = `Para revender antes de la jornada no sale: sube un ${pct(nr.r * 100, 1, false)} al día, pero en tu liga a uno que viene como él se lo llevan con unos ${eur(nr.puja)}${P ? ` (${pct((nr.puja / nr.j.valor - 1) * 100)} sobre su valor)` : ''} y antes de la jornada valdría unos ${eur(nr.valorFuturo)} (${eur(nr.beneficio, { signo: true })})${tope}.${malPartidoTxt(M, nr.pid) ? ` ${malPartidoTxt(M, nr.pid)}` : ''}`;
  // (24 nov, aviso de Domy) aguantándolo sí sale: el plan lo propone si se paga con el saldo. Si está aquí es porque hoy no
  // te llega (o ya van dos para revender, que lo añade el plan): se dice eso, no «para tenerlo, sí» en una lista de descartados
  if (ag) {
    const libre = M.pujaMax != null && M.deuda != null ? M.pujaMax - M.deuda : null;
    const falta = libre != null && nr.puja > libre ? ` Hoy no te llega: tienes ${eur(Math.max(0, libre))} sin tirar de deuda.` : '';
    return `${antes} Aguantándolo sí: lo pagado de más (${eur(te.deMas)}) lo recuperas en ${ag.recupera} día${ag.recupera === 1 ? '' : 's'} y en ${ag.dias} valdría unos ${eur(ag.valorFuturo)} (${eur(ag.beneficio, { signo: true })}) si sigue subiendo así, pero solo pagándolo con tu saldo, sin deuda.${falta}`;
  }
  const tener = !te || !(te.deMas > 2e5) ? '' : te.dias ? ` Y para tenerlo, lo pagado de más (${eur(te.deMas)}) tarda ${te.dias} día${te.dias === 1 ? '' : 's'} en recuperarse si sigue subiendo así${te.dias <= 7 ? ' y después ganarías poco' : ''}: solo si lo quieres para tu once.` : ` Y para tenerlo, lo pagado de más (${eur(te.deMas)}) no se recupera en un mes al ritmo de ahora: solo si lo quieres para tu once.`;
  // (17 nov) para quedártelo con esa puja: si te llega con tu margen de puja
  const llega = te && te.deMas > 2e5 && M.pujaMax != null ? (nr.puja <= M.pujaMax ? ` Te llega para pujar ${eur(nr.puja)}.` : ` Ahora mismo no te llega: puedes pujar como mucho ${eur(Math.max(0, M.pujaMax))}.`) : '';
  return `${antes}${tener}${llega}`;
}

/** (24 nov, Carlos: «hay una cantidad ingente de texto… menos texto y más al grano») lo mismo en UNA frase, para «Mirados
    y descartados»: lo que decide y su cifra. Las cuentas enteras (`noRevenderTxt`) quedan para la IA. `topeRev`: ya van
    los que se pueden tener para revender a la vez. Si mejora tu once se dice (Equipo lo enseñaba como fichaje para lo flojo
    del once y aquí salía descartado sin nombrarlo: Pepelu) */
export function noRevenderCorto(M, nr, { topeRev = 0 } = {}) {
  const te = nr.tener || {}, ag = nr.aguantar;
  const d1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (ag) {
    const libre = M.pujaMax != null && M.deuda != null ? M.pujaMax - M.deuda : null;
    const pero = libre != null && nr.puja > libre ? `, pero se paga con saldo (${eur(nr.puja)}) y tienes ${eur(Math.max(0, libre))}` : topeRev ? `, pero ya van ${topeRev} para revender a la vez` : `, pagando ${eur(nr.puja)} con tu saldo`;
    return `Aguantándolo ${ag.dias} días ganarías unos ${eur(ag.beneficio)}${pero}.`;
  }
  const g = M.mejora ? M.mejora(nr.j) : 0;
  const deMas = te.deMas > 0 ? `${eur(te.deMas)} de más que ${te.dias ? `tardas ${te.dias} días en recuperar` : 'no recuperas'}` : 'y antes de la jornada no da tiempo a revenderlo';
  // (24 nov) si un mal partido reciente frena la cuenta, se dice: es lo que cambia el veredicto
  const mal = M.malPartido ? M.malPartido(nr.pid) : null;
  if (mal) {
    const pts = `${mal.pts} punto${mal.pts === 1 ? '' : 's'}`;
    return g >= 0.3 ? `Mejoraría tu once (+${d1(g)} pts), pero hizo ${pts} en el último y se frena: ${deMas}.` : `Hizo ${pts} en su último partido y eso frena su subida: ${deMas}.`;
  }
  return g >= 0.3
    ? `Mejoraría tu once (+${d1(g)} pts), pero se paga a unos ${eur(nr.puja)}: ${deMas}.`
    : `Sube un ${pct(nr.r * 100, 1, false)} al día, pero se paga a unos ${eur(nr.puja)}: ${deMas}.`;
}

/**
 * (0.7.13u, Carlos 16 nov) de una puja para el once: lo que hace falta en tu liga por uno que viene como él, con cuánto
 * se gana, si lo pagado de más se recupera teniéndolo y si revenderlo sale a cuenta
 */
export function pujaOnceTxt(M, m) {
  if (!m || !m.j || !m.j.valor) return '';
  const P = M.pagaLiga ? M.pagaLiga(m.j.valor, m.pid) : null, pf = (P && P.pf) || {};
  const L = [];
  if (P && (pf.top || (pf.r != null && pf.r > 0.008))) L.push(`En tu liga, a los que ${pf.top ? 'son de los top' : 'valen como él'}${pf.r != null && pf.r > 0.008 ? ' y suben así' : ''} se los llevan con un ${pct(P.med * 100)} sobre su valor de mediana.`);
  if (m.recortada && m.pujaGana > m.puja) L.push(`La dejo en ${eur(m.puja)} por lo que aporta a tu once; para llevártelo casi seguro harían falta unos ${eur(m.pujaGana)}.`);
  if (m.pGana != null && P) L.push(`Con ${eur(m.puja)}, ${vecesTxt(m.pGana)}.`);
  const te = M.tener ? M.tener(m.j, m.tend, m.puja) : null;
  if (te && te.deMas > 2e5) L.push(te.dias && te.dias <= 10 ? `Pagas ${eur(te.deMas)} más de lo que vale; si sigue subiendo así, lo recuperas en ${te.dias} día${te.dias === 1 ? '' : 's'}: tenerlo sale a cuenta.` : te.dias ? `Pagas ${eur(te.deMas)} más de lo que vale y tarda ${te.dias} días en recuperarse si sigue subiendo así: es para tu once, no para ganar dinero.` : `Pagas ${eur(te.deMas)} más de lo que vale y, al ritmo de ahora, no lo recuperas en un mes: es para tu once, no para ganar dinero.`);
  const nr = (M.noRevender || {})[m.pid], esp = (M.especular || []).find((e) => e.pid === m.pid);
  if (nr) L.push(`Para revender antes de la jornada no sale: con ${eur(nr.puja)}, valdría unos ${eur(nr.valorFuturo)} (${eur(nr.beneficio, { signo: true })}).${nr.aguantar ? ` Aguantándolo ${nr.aguantar.dias} días, sí: valdría unos ${eur(nr.aguantar.valorFuturo)} (${eur(nr.aguantar.beneficio, { signo: true })}).` : ''}`);
  else if (esp && !esp.pujaJusta) L.push(`Si al final no lo quieres, revenderlo también sale a cuenta (${eur(esp.beneficio, { signo: true })}).`);
  else if (esp && esp.pujaJusta) L.push(`Para revender, en cambio, solo sale pujando como mucho ${eur(esp.puja)}.`);
  return L.length ? ` ${L.join(' ')}` : '';
}

export function planAuto(D, M, c) {
  const ahora = Date.now();
  const ops = [];
  // lo que ya tienes pujado se cobra al cambiar el mercado si ganas: ya está comprometido (revisión del 25 oct)
  let saldo = num(D.dinero) - num(M.misPujas);
  // lo que hay en caja ya: lo que pones en venta no entra hasta que aceptas una oferta (en el próximo cambio de
  // mercado), así que una cláusula de «ahora» solo se puede pagar con esto (las pujas no se cobran hasta el cambio)
  let caja = num(D.dinero);
  const limite = -M.deuda;
  const inicio = M.proxima ? M.proxima.ini : null;
  const jornadaCerca = inicio && inicio - ahora < 2 * DIA;
  const vendidos = new Set();
  const op = (o) => ops.push({ confianza: 'media', ...o });

  // 0. aceptar las ofertas buenas por lo que ya tienes en venta
  for (const v of M.misVentas.filter((y) => y.consejo === 'aceptar')) {
    op({ accion: 'vender', pid: v.pid, jugador: v.j.nombre, donde: `acepta la oferta de ${v.mejor.de}`, importe: v.mejor.importe, cuando: v.mejor.caduca ? antesDe(v.mejor.caduca) : 'hoy',
      motivo: `${v.porque} Vale ${eur(v.j.valor)}${v.ganado != null ? ` y lo pagaste a ${eur(v.compra)} (${eur(v.ganado, { signo: true })})` : ''}.`, confianza: v.mejor.sobre >= 0.02 ? 'alta' : 'media' });
    saldo += v.mejor.importe; caja += v.mejor.importe; vendidos.add(v.pid);
  }

  // 0b. los entrenadores no puntúan en la versión gratuita: dinero parado (en una liga premium con entrenador sí puntúan)
  for (const x of M.mias.filter((y) => y.j.pos === 5 && !vendidos.has(y.pid) && !(M.premium.entrenador && y.j.estado !== 'out_of_league'))) {
    op({ accion: 'vender', objetivo: 'caja', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: M.premium.entrenador ? `Ya no entrena en LaLiga y no puntúa: son ${eur(x.j.valor)} parados.` : `Es entrenador y en la versión gratuita no se alinea ni puntúa: son ${eur(x.j.valor)} parados que puedes usar en jugadores.`, confianza: 'alta' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // 1. vender lo que no va a puntuar o se está desplomando con beneficio
  // (una sanción de un partido no: se pierde la jornada y se aguanta, salvo que su valor caiga fuerte; M.vendeBaja)
  for (const x of M.mias.filter((y) => M.vendeBaja(y) && !vendidos.has(y.pid))) {
    op({ accion: 'vender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `${M.deBaja(x.j) ? M.bajaTxt(x.j) : 'Sancionado una jornada, pero su valor cae deprisa'}: no te va a puntuar${x.tend.p7 != null && x.tend.p7 < 0 ? ` y ya ha perdido un ${pct(Math.abs(x.tend.p7), 1, false)} en 7 días` : ''}. Mejor venderlo antes de que baje más.`, confianza: 'alta' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }
  // si al venderlo tu once se queda con un hueco más (no hay otro sano en su puesto) y la jornada está cerca (menos de 3
  // días, o en juego), no se vende: no da tiempo a reponerlo y no puntúas en ese sitio (revisión del 25 oct: el plan
  // vendía medio once por la inercia)
  const cercaJornada = !!M.enJuego || (M.proxima && M.proxima.ini - ahora < 3 * DIA);
  const dejaHueco = (x) => {
    if (!cercaJornada || MALOS.has(x.j.estado)) return false;
    const resto = M.mias.filter((y) => !vendidos.has(y.pid)).map((y) => y.j);
    return (M.mejorOnce(resto.filter((j) => j.id !== x.pid)).huecos || 0) > (M.mejorOnce(resto).huecos || 0);
  };
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && ((M.partidazo(y.pid) || {}).nivel || 0) < 2 && y.ganado > 0 && P7(y.tend) != null && P7(y.tend) < -4 && !M.esperarVenta(y).tipo).slice(0, 2)) {
    if (dejaHueco(x)) continue;
    op({ accion: 'vender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `Lo pagaste a ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}), pero lleva un ${pct(Math.abs(x.tend.p7), 1, false)} de bajada en 7 días. Asegura el beneficio.${M.esperarVenta(x).nota ? ` ${M.esperarVenta(x).nota}` : ''}` });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // 1b. la inercia: lo que ha girado a la baja, fuera ya; lo que está a punto de girar, si no es clave en el once
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.ventaInercia && y.j.pos !== 5 && !M.enVenta.has(y.pid))) {
    const vi = x.ventaInercia;
    // (19) en el parón, con la vuelta lejos, se vende en lo alto aunque juegue (salvo que sea muy importante): hay días
    // de sobra para reponerlo y lo que baje hasta la vuelta se pierde
    if (vi.urgencia !== 'ya' && M.perdida(x.pid) >= (paronLejos(M, ahora) ? 3 : 1.5)) continue;
    if (vi.urgencia !== 'ya' && M.esperarVenta(x).tipo === 'clausula') continue;
    if (dejaHueco(x)) continue;
    op({ accion: 'vender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: 'hoy',
      motivo: `${vi.texto}${M.perdida(x.pid) >= 0.3 ? ` Te quita unos ${String(Math.round(M.perdida(x.pid) * 10) / 10).replace('.', ',')} pts por jornada: ficha a quien lo sustituya.` : ''}${M.esperarVenta(x).nota ? ` ${M.esperarVenta(x).nota}` : ''}`, confianza: vi.urgencia === 'ya' ? 'alta' : 'media' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // ¿le hace falta a tu once? solo fichajes que entren de titular en una formación gratuita (o que tapen un hueco)
  let plantilla = M.mias.filter((x) => !vendidos.has(x.pid)).map((x) => x.j);
  let onceAhora = M.mejorOnce(plantilla);
  const gana = (j) => M.mejorOnce([...plantilla, j]).total - onceAhora.total;
  const hueco = (j) => gana(j) >= 0.5;
  const fichar = (j) => { plantilla = [...plantilla, j]; onceAhora = M.mejorOnce(plantilla); };
  const yaHoy = new Set();
  // sin IA el plan no tira de deuda: solo con el dinero que tienes y lo que vendes
  const presupuesto = () => saldo;

  // 2. clausular lo mejor que esté abierto y te llegue
  // nunca una cláusula mucho más cara de lo que vale el jugador (lo de más se pierde en el valor del equipo)
  // (19) en el parón, con la vuelta lejos, para el once solo los chollos claros: el resto son días sin puntuar con el
  // dinero parado (aviso de Domy, 9 nov). Lo que sube va por «especular», más abajo
  const paron = paronLejos(M, ahora);
  // (11 nov) el filtro, el mismo que Hoy y las alarmas (mereceClausula); el dinero, con lo que vendes antes, abajo
  const abiertas = M.clausulas.filter((x) => x.abierta && mereceClausula(M, x, ahora))
    .sort((a, b) => (b.interes + (b.teQueda >= 0 ? 8 : 0)) - (a.interes + (a.teQueda >= 0 ? 8 : 0))).slice(0, 8);
  let clausulas = 0;
  for (const x of abiertas) {
    if (clausulas >= 2 || x.clausula > presupuesto() || x.clausula > caja || yaHoy.has(x.j.pos) || !hueco(x.j)) continue;
    const cc = M.compraCal(x.j, x.clausula);
    if (!cc.ok) continue;
    const g = gana(x.j);
    op({ accion: 'clausular', objetivo: 'titular', pid: x.pid, jugador: x.j.nombre, donde: `cláusula a ${x.rival.manager || x.rival.nombre}`, importe: x.clausula, cuando: 'ahora',
      motivo: `${paron ? 'En el parón solo merece la pena clausular para el once un chollo así, a su valor y sin bajar. ' : ''}Vale ${eur(x.j.valor)} y su cláusula es ${eur(x.clausula)}. Entra en tu once (${M.mejorOnce([...plantilla, x.j]).nombre}) y suma unos ${String(Math.round(g * 10) / 10).replace('.', ',')} pts por jornada${x.por.length ? `; ${x.por.filter((p) => !/once|hueco|sobran/.test(p)).slice(0, 2).join(', ')}` : ''}.${cc.txt ? ` ${cc.txt}` : ''}`, confianza: x.interes >= 70 && (!cc.cal || cc.cal.riesgo !== 'alto') ? 'alta' : 'media' });
    saldo -= x.clausula; caja -= x.clausula; clausulas++; yaHoy.add(x.j.pos); fichar(x.j);
  }

  // 3. pujar por los chollos del mercado
  let pujas = 0;
  // (19) en el parón, para el once nada del mercado que no sea un chollo claro: lo que sube va por «especular»
  // (0.7.13p, aviso de Domy) ni lo que sube hasta la vuelta y se paga a buen precio: en el parón es dinero y llega al once
  for (const m of M.mercado.filter((y) => !y.miPuja && !M.dueno[y.pid] && ((y.veredicto === 'chollo' || (y.veredicto === 'sube' && y.interes >= 55)) && (!paron || cholloParon(M, y.j, y.puja || y.precio) || subeHastaVuelta(M, y.j, y.puja || y.precio) || aSuValorParon(M, y, y.puja || y.precio, Math.min(saldo, caja)))
    // (0.7.13p) en el parón, con dinero de sobra, también el que está a su valor aunque la app no lo vea chollo (ni frenando)
    || (paron && ['normal', 'frena'].includes(y.veredicto) && aSuValorParon(M, y, y.puja || y.precio, Math.min(saldo, caja)))))) {
    // (0.7.13p) en el parón, el que entra por estar a su valor se paga con el saldo que queda, sin deuda; con eso, hasta 3
    // pujas y sin el tope de uno por puesto (Carlos, 16 nov: Pepe, Unai López y Valverde, dos de ellos centrocampistas)
    const porValor = paron && !cholloParon(M, m.j, m.puja || m.precio) && !subeHastaVuelta(M, m.j, m.puja || m.precio);
    if (pujas >= (paron ? 3 : 2) || m.puja > presupuesto() || (yaHoy.has(m.j.pos) && !paron) || !hueco(m.j)) continue;
    if (porValor && (m.puja || m.precio) > saldo) continue;
    const cm = M.compraCal(m.j, m.puja);
    if (!cm.ok) continue;
    op({ accion: 'pujar', objetivo: 'titular', pid: m.pid, jugador: m.j.nombre, donde: 'en el mercado', importe: m.precio, puja_max: m.puja, cuando: M.cierreMercado ? antesDe(M.cierreMercado) : 'hoy',
      motivo: `${porValor ? 'En el parón, pero sale a su valor, no baja y lo pagas con tu saldo, sin deuda: con dinero de sobra, tenerlo ya no cuesta nada. ' : ''}Sale a ${eur(m.precio)}${m.sobre <= 0.01 ? ', lo que vale' : ''}. Mejora tu once unos ${String(Math.round(gana(m.j) * 10) / 10).replace('.', ',')} pts por jornada${m.por.length ? `; ${m.por.filter((p) => !/once|hueco|sobran/.test(p)).slice(0, 2).join(', ')}` : ''}.${m.pujas ? ` Lleva ${m.pujas} puja${m.pujas > 1 ? 's' : ''}, por eso subo la oferta.` : ''}${cm.txt ? ` ${cm.txt}` : ''}${pujaOnceTxt(M, m)}` });
    saldo -= m.puja; pujas++; yaHoy.add(m.j.pos); fichar(m.j);
  }
  // lo mejor que no te llega todavía, para que sepas cuánto te falta
  const enPlan = new Set(ops.map((o) => o.pid));
  const fuera = paron ? null : M.clausulas.find((x) => !enPlan.has(x.pid) && x.abierta && x.interes >= 70 && x.clausula > Math.min(saldo, caja) && x.clausula <= M.pujaMax && !MALOS.has(x.j.estado) && hueco(x.j) && M.compraCal(x.j, x.clausula).ok);
  if (fuera && clausulas < 2) {
    // con lo que pones en venta te llegaría, pero ese dinero aún no ha entrado
    const conVentas = fuera.clausula <= saldo;
    op({ accion: 'esperar', pid: fuera.pid, jugador: fuera.j.nombre, donde: `cláusula de ${eur(fuera.clausula)} a ${fuera.rival.manager || fuera.rival.nombre}`, importe: null, cuando: conVentas ? 'cuando entre lo de las ventas' : 'si vendes algo',
      motivo: conVentas
        ? `Es el mejor a tiro (interés ${fuera.interes}) y con lo que pones en venta te llega, pero ese dinero entra cuando aceptes las ofertas, en el próximo cambio de mercado. Ahora tienes ${eur(caja)}: si sigue abierta entonces, ve a por él.`
        : `Es el mejor a tiro (interés ${fuera.interes}), pero te faltan ${eur(fuera.clausula - saldo)}: una cláusula solo se paga con saldo, sin deuda. Si vendes a alguien que no juegue, ve a por él.`, confianza: 'baja' });
  }

  // 4. si te quedas en negativo, vender lo que menos aporta antes de que empiece la jornada (o no puntúas)
  if (saldo < 0) {
    const fichados = new Set(ops.filter((o) => o.accion !== 'vender').map((o) => o.pid));
    const perdida = (x) => onceAhora.total - M.mejorOnce(plantilla.filter((j) => j.id !== x.pid)).total;
    const candidatos = M.mias.filter((x) => !vendidos.has(x.pid) && !fichados.has(x.pid))
      .map((x) => ({ ...x, pierde: perdida(x) }))
      .sort((a, b) => (a.pierde - b.pierde) || (b.j.valor - a.j.valor));
    for (const x of candidatos) {
      if (saldo >= 0) break;
      op({ accion: 'vender', objetivo: 'caja', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: inicio ? antesDe(inicio) : 'hoy',
        motivo: `Para no empezar la jornada en negativo (no puntuarías). ${x.pierde < 0.3 ? 'No entra en tu once: no pierdes puntos.' : `Es el que menos resta a tu once (−${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts/jornada).`}`, confianza: 'alta' });
      saldo += x.j.valor; vendidos.add(x.pid);
      plantilla = plantilla.filter((j) => j.id !== x.pid); onceAhora = M.mejorOnce(plantilla);
    }
  }

  // 4b. lo que compraste para revender: ponerlo a la venta el día antes de la jornada (o ya, si se acerca)
  const ventana = M.ventanaEsp;
  for (const x of M.paraRevender.filter((y) => !vendidos.has(y.pid))) {
    const toca = !ventana || ahora >= ventana.ponerVenta - 6 * HORA || (x.tend.p1 != null && x.tend.p1 < -1);
    if (!toca || (saldo >= 0 && M.aguantaReventa(x))) continue;
    op({ accion: 'vender', objetivo: 'revender', pid: x.pid, jugador: x.j.nombre, donde: 'ponlo en venta', importe: x.j.valor, cuando: inicio ? antesDe(inicio) : 'hoy',
      motivo: `Lo compraste para revender a ${eur(x.rev.precio)} y ahora vale ${eur(x.j.valor)} (${eur(x.beneficioYa, { signo: true })}).${x.tend.p1 != null && x.tend.p1 < -1 ? ' Ha empezado a bajar: mejor salir ya.' : ` Toca venderlo para empezar la jornada en positivo.${ventana && ventana.apura ? ` ${ventana.avisoJusto}` : ''}`}`, confianza: 'alta' });
    saldo += x.j.valor; vendidos.add(x.pid);
  }

  // 4c. especular: entre semana se puede bajar hasta el límite de deuda si lo que compras lo vendes antes de la jornada
  const especula = [];
  // (con algo ya comprado para revender, solo los que VUELVEN: no se deja pasar uno así por tener otro)
  // (19) en el parón, el dinero manda: hasta 3 y aunque ya tengas algo para revender (el saldo y la deuda lo frenan igual)
  if (ventana && ventana.ciclos >= 1 && (paron || !M.paraRevender.length || M.especular.some((e) => e.vuelve))) {
    const ya = new Set(ops.map((o) => o.pid));
    let espSaldo = saldo;
    for (const e of M.especular) {
      if (especula.length >= (paron ? 3 : 2) || ya.has(e.pid) || M.dueno[e.pid] === D.yo.teamId || (!paron && M.paraRevender.length && !e.vuelve)) continue;
      // nunca más allá del 90 % de la deuda permitida, y que al vender lo especulado se vuelva a positivo
      const tras = espSaldo - e.precio;
      if (tras < limite * 0.9) continue;
      // una cláusula se paga con lo que hay en caja ya (la puja del mercado se paga al cambiar el mercado)
      if (e.origen !== 'mercado' && e.precio > caja) continue;
      // aunque lo especulado baje un 8 % en vez de subir, al venderlo tienes que volver a positivo
      if (tras + [...especula, e].reduce((s2, x) => s2 + x.precio * 0.92, 0) < 0) continue;
      especula.push(e); espSaldo = tras;
      if (e.origen !== 'mercado') caja -= e.precio;
      const diaVenta = cuando(e.vender, { hora: false }), elDiaVenta = elDia(e.vender);
      op({ accion: e.origen === 'mercado' ? 'pujar' : 'clausular', objetivo: 'revender', pid: e.pid, jugador: e.j.nombre,
        donde: e.origen === 'mercado' ? 'en el mercado' : `cláusula a ${e.rival.manager || e.rival.nombre}`, importe: e.origen === 'mercado' ? e.precioMercado : e.precio, puja_max: e.origen === 'mercado' ? e.puja : null,
        cuando: e.origen === 'mercado' ? (M.cierreMercado ? antesDe(M.cierreMercado) : 'hoy') : 'ahora',
        vender_el: diaVenta, beneficio_esperado: Math.round(e.beneficio),
        motivo: `${pujaRevTxt(M, e)}Para revender, no para tu once: ${e.vuelve ? `llegó a valer ${eur(e.vuelve.max)} esta temporada, vuelve a jugar y lleva ${e.vuelve.racha} días subiendo (un ${pct(e.r * 100, 1, false)} al día)` : `sube un ${pct(e.r * 100, 1, false)} al día`}. Si sigue así, ${elDiaVenta} valdrá unos ${eur(e.valorFuturo)} (${eur(e.beneficio, { signo: true })}). Ponlo a la venta ${elDiaVenta} para estar en positivo antes de la jornada.`,
        confianza: e.confianza });
    }
    saldo = espSaldo;
  }

  // 5. proteger a los tuyos más expuestos: primero con el blindaje gratis (2 por jornada), luego subiendo la cláusula
  for (const pid of (M.paraEscudo || []).filter((p) => !vendidos.has(p))) {
    const x = M.mias.find((y) => y.pid === pid);
    if (!x) continue;
    op({ accion: 'blindar', pid: x.pid, jugador: x.j.nombre, donde: 'con el blindaje de LaLiga (gratis, viendo un anuncio)', importe: 0, cuando: 'ahora',
      motivo: `Su cláusula (${eur(x.clausula)}) está abierta y algún rival la puede pagar; ${x.pierde >= 0.5 ? `te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada` : 'aunque no te puntúe, te lo quitarían casi a su valor: vendiéndolo a LaLiga sacarías más y reponerlo cuesta más'}. El blindaje la protege ${M.ESCUDO_H} h sin gastar nada (te quedan ${(M.escudosMios || {}).quedan} esta jornada).` });
  }
  for (const x of M.mias.filter((y) => !vendidos.has(y.pid) && y.riesgo === 'alto' && y.importa && !y.escudo && !y.noBlindar && !(M.paraEscudo || []).includes(y.pid) && !(y.blindaje && (y.blindaje.caro || y.blindaje.yaVale))).sort((a, b) => b.pierde - a.pierde).slice(0, 2)) {
    const b = x.blindaje;
    // subirla cuesta dinero al momento: si no lo hay, te dejaría en negativo antes de la jornada
    if (b && b.coste > Math.min(saldo, caja)) continue;
    op({ accion: 'blindar', pid: x.pid, jugador: x.j.nombre, donde: b ? `subir su cláusula a ${eur(b.objetivo)}` : 'subir su cláusula', importe: b ? b.coste : null, cuando: x.abierta ? 'ahora' : antesDe(x.protegidoHasta),
      motivo: `Su cláusula (${eur(x.clausula)}) ${x.ratio < 1.05 ? 'está en su valor' : `solo pasa un ${pct((x.ratio - 1) * 100, 0)} de su valor`} (${eur(x.j.valor)}), ${x.abierta ? 'ya está abierta' : `se abre en ${dura(x.abreEn)}`} y te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada.${b ? ` Con ${eur(b.coste)} no le llegaría a ningún rival.` : ''}` });
    if (b) { saldo -= b.coste; caja -= b.coste; }
  }

  // 6. alineación si la jornada empieza pronto (con otra en juego, no: su «próximo partido» mezcla las dos)
  if (inicio && inicio - ahora < 30 * HORA && inicio > ahora && !M.enJuego) {
    const tocados = M.mias.filter((x) => !vendidos.has(x.pid) && x.j.estado === 'doubtful');
    const sancionados = M.mias.filter((x) => !vendidos.has(x.pid) && M.sancionCorta(x.j));
    op({ accion: 'alinear', jugador: '', donde: `jornada ${M.proxima.n}`, importe: null, cuando: antesDe(inicio),
      motivo: `Pon el ${onceAhora.nombre}: ${onceAhora.lineas.flat().map((j) => j.nombre).join(', ')}.${onceAhora.huecos ? ` Te faltan ${onceAhora.huecos} para completarlo.` : ''}${tocados.length ? ` Ojo con ${tocados.map((x) => x.j.nombre).join(', ')}, que son duda.` : ''}${sancionados.length ? ` ${sancionados.map((x) => x.j.nombre).join(', ')} ${sancionados.length === 1 ? 'está sancionado y se pierde' : 'están sancionados y se pierden'} la jornada: ${sancionados.length === 1 ? 'aguántalo, vuelve' : 'aguántalos, vuelven'} a la siguiente.` : ''}` });
  }
  if (!ops.length) op({ accion: 'esperar', jugador: '', donde: '', importe: null, cuando: 'hoy', motivo: 'Hoy no hay ninguna operación clara: ni cláusulas que merezcan la pena abiertas ni chollos en el mercado. Mejor guardar el dinero.', confianza: 'media' });

  // los próximos días: cláusulas que se abren, mercado, jornada y parón (lo más importante de cada día)
  const dias = {};
  const add = (t, prio, texto, rev) => { const d = diaDe(t); (dias[d] ||= { t, cosas: [] }).cosas.push(rev ? { prio, texto, rev } : { prio, texto }); };
  const hora = (t) => cuando(t).split(' ').pop();
  for (const x of M.clausulas.filter((y) => !y.abierta && y.abreEn < 4 * DIA && y.meLlega && y.interes >= 55)) {
    add(x.protegidoHasta, x.interes, `${hora(x.protegidoHasta)} se abre ${x.j.nombre} (${eur(x.clausula)}, de ${x.rival.manager || x.rival.nombre})`);
  }
  for (const x of M.mias.filter((y) => !y.abierta && y.abreEn < 4 * DIA && y.riesgo !== 'ninguno')) add(x.protegidoHasta, 90, `${hora(x.protegidoHasta)} se acaba la protección de tu ${x.j.nombre}`);
  if (inicio) add(inicio, 100, `${hora(inicio)} empieza la jornada ${M.proxima.n}: saldo en positivo y once revisado antes`);
  if (inicio && inicio - M.VEDA_H * HORA > ahora) add(inicio - M.VEDA_H * HORA, 97, `${hora(inicio - M.VEDA_H * HORA)} se cierran las cláusulas hasta que empiece la jornada: lo que quieras clausular, antes o a las ${hora(inicio)}`);
  // (lo de revender lleva quién es: rematarAuto quita a los que la app descarte al cuadrar el plan)
  const aRevender = [...especula.map((e) => ({ pid: e.pid, nombre: e.j.nombre })), ...M.paraRevender.filter((x) => !vendidos.has(x.pid)).map((x) => ({ pid: x.pid, nombre: x.j.nombre }))];
  if (aRevender.length && ventana) add(ventana.ponerVenta, 99, '', aRevender);
  if (M.paron && M.paron.ini > ahora) add(M.paron.ini, 95, 'empieza el parón: los valores se paran, vende a los que estén en lo alto');
  const diasAuto = Object.values(dias).sort((a, b) => a.t - b.t);
  return {
    auto: true, t: ahora, dia: diaDe(ahora),
    titular: titularAuto(ops),
    situacion: `Tienes ${eur(D.dinero)} y puedes gastar hasta ${eur(M.pujaMax)}${num(M.misPujas) ? ` (ya descontados los ${eur(M.misPujas)} que tienes pujados)` : ''}. Vas ${M.yo ? `${M.yo.pos}º con ${M.yo.puntos} puntos` : ''}${M.proxima ? ` y la jornada ${M.proxima.n} empieza ${cuando(M.proxima.ini)}` : ''}.${paron ? ' Estamos en el parón: nadie puntúa hasta la vuelta, así que hoy toca sacar dinero (comprar lo que sube para venderlo antes de la jornada y vender en lo alto). Las cláusulas para el once, en los dos o tres días antes de la vuelta.' : ''}`,
    operaciones: ops, proximos_dias: proximosAuto(diasAuto), diasAuto,
    alineacion: onceAhora.formacion ? { formacion: onceAhora.nombre, titulares: onceAhora.lineas.flat().map((j) => j.nombre), dudas: onceAhora.lineas.flat().filter((j) => j.estado === 'doubtful').map((j) => `${j.nombre}: es duda`) } : null,
  };
}

/**
 * el titular del plan automático: cuántas de cada cosa toca hoy. Sin los descartados ni lo de otro día, y lo de especular
 * (pujas o cláusulas para revender) aparte, no contado otra vez como puja o cláusula
 */
function titularAuto(ops) {
  const vivos = ops.filter((o) => !o.descartada && !o.sugerencia && o.hoy !== false);
  const esp = (o) => o.objetivo === 'revender' && ['pujar', 'clausular', 'comprar'].includes(o.accion);
  const n = (a) => vivos.filter((o) => o.accion === a && !esp(o)).length;
  const e = vivos.filter(esp).length;
  const partes = [n('vender') && `vender ${n('vender')}`, n('clausular') && `clausular ${n('clausular')}`, n('pujar') && `pujar por ${n('pujar')}`, n('blindar') && `proteger ${n('blindar')}`, e && `especular con ${e} para revender`].filter(Boolean);
  return partes.length ? `Hoy toca ${partes.join(', ')}` : vivos.some((o) => o.accion === 'alinear') ? 'Hoy solo toca preparar la jornada' : 'Hoy, quieto: guarda el dinero';
}
/** los próximos días del plan automático (lo más importante de cada día); fuera de lo de revender, los que no van */
function proximosAuto(dias, fuera = new Set()) {
  const texto = (c) => {
    if (!c.rev) return c.texto;
    const quien = c.rev.filter((x) => !fuera.has(String(x.pid))).map((x) => x.nombre);
    return quien.length ? `lo de revender (${quien.join(', ')}): a la venta si ha dejado de subir o te hace falta para empezar la jornada en positivo; si sigue subiendo, lo puedes aguantar` : '';
  };
  return dias.map((d) => ({ t: d.t, cosas: d.cosas.map((c) => ({ prio: c.prio, texto: texto(c) })).filter((c) => c.texto) })).filter((d) => d.cosas.length).slice(0, 5).map((d) => {
    const cosas = d.cosas.sort((a, b) => b.prio - a.prio);
    const resto = cosas.length - 3;
    return { dia: cuando(d.t, { hora: false }), texto: cosas.slice(0, 3).map((c) => c.texto).join('. ') + (resto > 0 ? `. Y ${resto} cláusula${resto > 1 ? 's' : ''} más` : '') + '.' };
  });
}
/** el plan automático ya cuadrado (con lo que la app descarta): el titular y los próximos días, sin los descartados */
export function rematarAuto(P) {
  if (!P || !P.auto || !Array.isArray(P.ops)) return P;
  const fuera = new Set(P.ops.filter((o) => o.descartada && o.pid).map((o) => String(o.pid)));
  return { ...P, titular: titularAuto(P.ops), proximos_dias: Array.isArray(P.diasAuto) ? proximosAuto(P.diasAuto, fuera) : P.proximos_dias };
}

/* ---------- el once: formaciones gratuitas, puntos esperados y el mejor once posible ---------- */
// las formaciones gratuitas de LaLiga Fantasy, por si la API no las da
const FORMACIONES = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'];
const NOMBRE_POS = { 1: 'portería', 2: 'defensa', 3: 'el medio', 4: 'delantera' };
const dec1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
export function partirFormacion(f) {
  const m = String(f).match(/(\d)\D?(\d)\D?(\d)/);
  return m && +m[1] + +m[2] + +m[3] === 10 ? [+m[1], +m[2], +m[3]] : null;
}
/** los puntos que se esperan de un jugador en la próxima jornada: su forma (últimas 5) o su media, y si puede jugar */
export function puntosEsperados(j, forma, once = null) {
  if (!j || MALOS.has(j.estado)) return 0;
  if (once && once.estado === 'injured') return 0;
  let pp = forma && forma.de >= 3 ? forma.media * 0.6 + num(j.media) * 0.4 : num(j.media);
  if (forma && forma.de >= 3 && forma.jugados != null && forma.jugados / forma.de < 0.5) pp *= 0.7;
  if (j.estado === 'doubtful' || (once && once.estado === 'doubtful')) pp *= 0.55;
  // el once probable de su equipo (futbolfantasy): titular, alternativa o fuera de la convocatoria
  if (once && j.pos !== 5) {
    if (once.titular) pp *= once.prob != null ? Math.max(0.5, once.prob / 100) : 1;
    else if (once.alternativa) pp *= 0.35;
    else if (once.fuera) pp *= 0.45;
  }
  return Math.max(0, pp);
}
/** el mejor once con esos jugadores entre las formaciones dadas: { formacion, lineas: [[POR],[DEF],[MED],[DEL]], entrenador, total, huecos } */
export function mejorOnce(lista, formaciones, pp, op = {}) {
  const por = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const j of lista || []) if (j && por[j.pos]) por[j.pos].push({ j, p: pp(j), ok: !MALOS.has(j.estado) });
  for (const k of Object.keys(por)) por[k].sort((a, b) => b.p - a.p);
  let mejor = null;
  for (const f of formaciones.length ? formaciones : [[4, 3, 3]]) {
    const pide = { 1: 1, 2: f[0], 3: f[1], 4: f[2] };
    let total = 0, huecos = 0;
    const lineas = [1, 2, 3, 4].map((pos) => {
      const disp = por[pos].filter((x) => x.ok).slice(0, pide[pos]);
      huecos += pide[pos] - disp.length;
      total += disp.reduce((s, x) => s + x.p, 0);
      return disp.map((x) => x.j);
    });
    // la versión gratuita no alinea entrenador; en una liga premium que los tiene, uno: de dos, el que más puntos lleva
    // por jornada (cuál conviene con el partido de cada uno se elige en la parte B). No entra en el total ni en la nota
    const ent = (op.entrenador && por[5].filter((x) => x.ok).sort((a, b) => (Number(b.j.media) || 0) - (Number(a.j.media) || 0))[0]) || null;
    const nota = total - huecos * 4;
    if (!mejor || nota > mejor.nota) mejor = { formacion: f, nombre: f.join('-'), lineas, entrenador: ent ? ent.j : null, total, huecos, nota };
  }
  return mejor || { formacion: null, nombre: '', lineas: [[], [], [], []], entrenador: null, total: 0, huecos: 11, nota: 0 };
}


/**
 * el porqué del peligro de un rival, en una línea corta (ficha del rival y la IA). Sin cifras de su dinero: vale aunque
 * tengas cerrado el dinero de ese rival. Con «quién paga» cerrado (`quien: false`) no dice qué cláusulas tuyas le llegan
 */
export function motivoPeligro(r, { quien = true } = {}) {
  const p = r && r.peligro;
  if (!p) return '';
  const partes = [];
  const llegaTxt = (l) => {
    const de = l.filter((x) => x.w >= 0.25);
    if (!quien || !de.length) return null;
    return de.length === 1 ? `le llega la cláusula de ${de[0].nombre}` : `le llegan ${de.length} cláusulas tuyas (${de.slice(0, 2).map((x) => x.nombre).join(', ')}${de.length > 2 ? '…' : ''})`;
  };
  const ll = llegaTxt(p.llegan);
  if (ll) partes.push(ll);
  // el dinero, sin cifras (20 nov, 20:19: el nivel sale sobre todo de lo rico que es y de lo que suele clausular)
  const pobreSin = p.riq < 0.3 && p.sinDinero && quien && !ll && !p.lleno && !p.caras;
  const riqueza = p.riq == null || pobreSin ? null : p.riq >= 0.75 ? 'es de los que más dinero tienen de la liga' : p.riq < 0.3 ? 'tiene poco dinero frente al resto de la liga' : p.sinDinero && quien && !ll ? 'tiene poco saldo, pero un equipo que puede vender' : null;
  const ricoPobre = riqueza && (p.riq >= 0.75 || p.riq < 0.3);
  if (ricoPobre && !ll) partes.push(riqueza);
  if (p.czAMi >= 2) partes.push(`te ha clausulado a ${p.czAMi}`);
  else if (p.ultAMi) partes.push(p.ultAMi.nombre ? `ya te clausuló a ${p.ultAMi.nombre}` : 'ya te ha clausulado a uno');
  else if (p.czTotal >= 2) partes.push(`ha clausulado ${p.czTotal} esta temporada`);
  else if (p.czTotal === 1 && p.hist >= 0.3) partes.push('ya ha clausulado a uno hace poco');
  else if (!p.czTotal && ll) partes.push('~no ha clausulado en toda la temporada');
  if (riqueza && (!ricoPobre || ll)) partes.push(riqueza);
  if (p.cerca >= 0.5) partes.push('te pelea el puesto');
  if (p.lleno) partes.push('con la plantilla llena no puede clausular sin vender antes');
  if (!ll && !p.lleno && quien) {
    if (p.caras) partes.push('las cláusulas tuyas que puede pagar están caras para esta liga');
    else if (pobreSin || (p.sinDinero && p.riq == null)) partes.unshift(p.czTotal ? 'suele clausular, pero no le llega para ninguna cláusula tuya que se abre pronto' : 'no le llega para tus cláusulas que se abren pronto');
  }
  if (ll && p.vendiendo && quien) partes[0] += ' (vendiendo antes)';
  // sin dinero para ninguna, lo de que suele clausular ya va en esa frase
  if ((pobreSin || (p.sinDinero && p.riq == null && !ll && quien)) && p.czTotal) for (let i = partes.length - 1; i > 0; i--) if (/^(ha clausulado|ya ha clausulado)/.test(partes[i])) partes.splice(i, 1);
  // con «quién paga» cerrado, lo de tus cláusulas sin decir si le llega el dinero
  if (!quien && p.llegan.some((x) => x.w >= 0.25)) partes.unshift('tienes cláusulas a precio de esta liga abiertas o a punto');
  let t = partes.slice(0, 2).join(' y ').replace(/ y ~/, ', pero ').replace(/^~/, '');
  if (!t) t = !quien ? (p.czTotal ? 'no destaca por nada ahora mismo' : 'no ha clausulado en toda la temporada') : p.czTotal ? 'ahora no tiene a tiro ninguna cláusula tuya' : 'no clausula y ahora no tiene a tiro ninguna cláusula tuya';
  if (p.veda) return `Cláusulas cerradas hasta ${cuando(p.veda.hasta)}; al reabrirse, ${t}.`;
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}
