/* Las ventanas que suben desde abajo: la ficha de un jugador, la de un rival, los ajustes y el diagnóstico. */
import { erroresApp } from './errores.js';
import { avisosGuardados, mejorarIA } from './soporte.js';
import { diagAnuncios } from './intersticial.js';
import { esc, eur, pct, dura, cuenta, cuando, icono, clase, POS_LARGO, POS_PLURAL, num, horaDe, LS, DIA, diaDe, norm, fechaCorta, firmaDe } from './util.js';
import { lineaPaso, pujaLinea, noCompensaTxt, vecesCorto, pujaDe } from './puja-txt.js';
import { ava, posTag, estadoPill, clausulaPill, delta, filaJugador, nada, oncePill, filaNoticia, nivelCls, calendarioHTML, dineroCorto, candado, candadosJuntos, enCasaDe, BLOQUEO, ventasDe, campoVivo, estiloClub, caraManager, selloTop } from './comunes.js';
import { linea, barra, mini, columnasSem, areaSem } from './graficos.js';
import { filaActividad, PELIGRO, PELIGRO_TXT, ventaHTML, puntosUltimaJornada, descartePlan } from './vistas.js';
import { hayClave, planesApp, cupoPlanes, preguntasApp, cupoPreguntas, clave, cfgIA, nombreModelo, intentosIA, notasDe, seudonimos, enAppIos, permisoIA } from './ia.js';
import { cfgAvisos, programados, OPC_ANTES, antesTxt } from './avisos.js';
import { nativo, enApp, enWeb, enIPhone, enInicio, estadoProxy } from './puente.js';
import { hayAnunciosWeb } from './anuncios-web.js';
import { registro } from './api.js';
import { qrSVG } from './qr.js';
import { quien, sesion } from './auth.js';
import { EVENTOS } from './eventos.js';
import { VERSION, cmpVer } from './version.js';
import { enDemo, K } from './datos.js';
import { dichoDe, fichaDichoHTML, tileDicho } from './dinero-dicho.js';
import { apodosDe, apodosLiga, listaApodos } from './apodos.js';
import { cfgFondo, ultimoFondo } from './fondo.js';
import { cfgHoras, horasPlan, horasDefecto, proximoTurno } from './planes-hora.js';
import { hayImportantes, ultimaImportante } from './presentacion.js';
import { parteFin, estadoLimite, novedadesPara, importantesPara, bloqueada, otrasLigasCfg, topConAnuncio, planesCfg, preguntasCfg, POR_JORNADA, faltanAnuncios, usosQuedan, usosPorJornada, anunciosPorVez, rivalesAbiertos, rivalAbiertoHasta, minutosRival, horasQuien } from './limite.js';
import { jornadaJugadorHTML } from './directo.js';
import { motivoPeligro } from './motor.js';
import { aviso, avisoDeTexto, parrafos, inerciaPlanHTML } from './avisos-ficha.js';
import { pagadoTxt, demandaTxt, otrasLinea } from './otras-ligas.js';
import { muestrasVivo } from './vivo.js';
import { esFav } from './favoritos.js';
import { estadoInv, contadorTxt, porElegir, cfgInv, PREMIO_TXT, premioHasta, puedeCanjear, rivalesInvitados, invitarOn } from './invitar.js';

/* (0.8.2) «Quién puja»: los rivales que pueden estar detrás de las pujas de un libre, del más probable al menos, lo que
   rondaría la puja de cada uno y si la tuya (o la de la app) la pasa. Es una estimación (quien-puja.js): se dice. El dinero
   de un rival cerrado no se cuenta (ni su tope ni que lo paga sin deuda) */
const ratoTxt = (a, b) => (diaDe(a) === diaDe() && diaDe(b) === diaDe() ? `las ${horaDe(a)} y las ${horaDe(b)}` : `${cuando(a)} y ${cuando(b)}`);
export function quienPujaHTML(S, m) {
  const M = S.M, q = m.quien, n = q.n;
  const pc = (p) => `${Math.max(1, Math.round(p * 100))} %`;
  const vis = q.cands.filter((c, i) => i < 4 && (i < 2 || c.p >= 0.08));
  const top = vis[0];
  const fila = (c) => {
    const abierto = !bloqueada('dineroRivales', c.tid);
    const mot = c.motivos.filter((x) => abierto || !x.dinero).map((x) => esc(x.t));
    const ronda = c.est ? (c.alto > c.est ? `rondaría ${eur(c.est)}–${eur(c.alto)}` : `rondaría ${eur(c.est)}`) : '';
    const tope = abierto && c.tope != null && c.alto && c.tope < c.alto * 1.15 ? ` · no pasa de ${eur(Math.max(0, c.tope))}` : '';
    return `<b>${esc(c.nombre)}</b> · ${pc(c.p)}${mot.length ? `<br><span class="t2">${mot.join(' · ')}</span>` : ''}${ronda ? `<br>Si es suya, ${ronda}${tope}.` : ''}`;
  };
  const evs = (q.ev || []).filter((e) => e[0] > 0);
  const u = evs[evs.length - 1];
  const entro = u ? `${u[2] > 1 ? `${u[2]} entraron` : n > 1 ? 'La última entró' : 'Entró'} entre ${esc(ratoTxt(u[0], u[1]))}.` : '';
  const fuera = q.fuera.length ? `No pueden pujar: ${q.fuera.map((f) => `${esc(f.nombre)}${f.por === 'llena' ? ' (plantilla llena)' : !bloqueada('dineroRivales', f.tid) ? ' (no le llega)' : ''}`).join(', ')}.` : '';
  // ¿la pasa tu puja, o la de la app? Sin otra cifra de «N de cada 10»: esa ya la da «Libre en el mercado»
  const mia = Number(m.miPuja) > 0, ref = mia ? Number(m.miPuja) : m.puja, p = mia ? q.pMia : q.pApp;
  const de = mia ? 'Tu puja' : 'La puja de la app';
  let pasa = '';
  if (p != null && ref) {
    const llega = q.paraPasar && q.paraPasar - num(m.miPuja) <= M.pujaMax;
    pasa = p >= 0.65 ? `<b>${de} (${eur(ref)}) la${n > 1 ? 's' : ''} pasa casi seguro.</b>`
      : `<b>${de} (${eur(ref)}) ${p >= 0.4 ? 'va justa' : 'se queda corta'}.</b>${q.paraPasar && q.paraPasar > ref ? ` Para pasarla${n > 1 ? 's' : ''} casi seguro, ${eur(q.paraPasar)}${llega ? '' : ' (no te llega)'}.` : ''}`;
  }
  const ac = M.quienAcierto && M.quienAcierto.n >= 5 ? ` En tu liga, de ${M.quienAcierto.n} veces, quien se lo llevó era el primero de la lista en ${M.quienAcierto.top1} y estaba entre los tres primeros en ${M.quienAcierto.top3}.` : '';
  const claro = q.conf !== 'baja' && top;
  return aviso(S, { k: 'quien', pid: m.pid, cls: 'oro', ico: 'rivales',
    t: n === 1 ? 'Quién puede ser la otra puja' : `Quién puede estar detrás de las ${n} pujas`,
    l: claro ? `Lo más probable: ${esc(top.nombre)} (${pc(top.p)})${vis[1] ? ` · ${esc(vis[1].nombre)} (${pc(vis[1].p)})` : ''}` : `No está claro: ${vis.slice(0, 3).map((c) => `${esc(c.nombre)} (${pc(c.p)})`).join(' · ')}`,
    d: parrafos(entro, ...vis.map(fila), fuera, pasa, `<span class="t2">Es una estimación: LaLiga no dice quién puja ni cuánto.${esc(ac)}</span>`) });
}

/* (26 nov) Lo de las demás ligas que usan la app, en la ficha de un libre del mercado: lo pagado por él en 3 días y su nivel
   de demanda (otras-ligas.js). APAGADO mientras «otrasLigas» de limites.json no lo encienda: entonces no sale nada, ni se
   pide. Nunca con lo leído para otra liga tuya, ni con algo de hace más de medio día o de otro día (lo de «hoy» y «ayer» ya
   sería otro). No toca la puja de la app: es un dato. UNA línea, sin nada que desplegar (Carlos, 26 nov, 18:53: «textos
   más reducidos y mejor integrados… tampoco 60 pestañas para cada texto») y, desde las 19:31 («lo dejaría gratis, y mejor
   integrado con la pestaña de arriba y abajo»), SIN TARJETA PROPIA Y SIN CANDADO: la segunda línea de la tarjeta «Libre
   en el mercado de la liga» (devuelve solo esa línea) */
export function otrasLigasHTML(S, m) {
  const on = otrasLigasCfg(), ot = S.otras;
  if ((!on.pagado && !on.demanda) || !ot || !m || m.tipo === 'manager' || !S.D || !S.D.liga || ot.liga !== S.D.liga.id || Date.now() - num(ot.t) > DIA / 2 || ot.dia !== diaDe()) return '';
  const l = otrasLinea(on.pagado ? pagadoTxt(ot.p && ot.p[m.pid]) : null, on.demanda ? demandaTxt(ot.d && ot.d[m.pid]) : null);
  // (Carlos, 26 nov, 19:31) sin tarjeta propia: la segunda línea de «Libre en el mercado de la liga»
  return l ? `<span class="av-l2">${icono('grafico')}${esc(l)}</span>` : '';
}

const ACC = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Blindar', alinear: 'Alinear', esperar: 'Esperar' };

/* ================= FICHA DE JUGADOR ================= */
/* ---------- la gráfica del precio ---------- */
export const RANGOS = [[7, '7 días'], [30, '1 mes'], [90, '3 meses']];
/** el histórico de valor más largo que haya: el de la API de LaLiga o el que apunta la app cada día */
export function serieValor(S, pid) {
  if (pid === '__equipo') return serieEquipo(S);
  const a = (S.M.tend(pid).serie || []), b = (S.det && S.det[pid] && S.det[pid].valores) || [];
  const s = (b.length > a.length ? b : a).slice();
  const j = S.M.J(pid);
  // el valor de hoy al final, si el histórico no lo trae todavía
  if (j && j.valor && s.length && Date.now() - s[s.length - 1][0] > 20 * 3600e3) s.push([Date.now(), j.valor]);
  return s;
}
export const cargandoValor = (S, pid) => pid !== '__equipo' && !S.D.demo && !(S.det && S.det[pid] && (S.det[pid].valores || S.det[pid].sinValores || S.det[pid].error));
export function grafValor(serie, dias, cargando = false) {
  const p = (serie || []).filter(([t, v]) => Number.isFinite(t) && v > 0);
  if (p.length < 2) return `<div class="graf-vacio${cargando ? ' esq esq-graf' : ''}">${cargando ? 'Cargando su histórico de valor…' : 'LaLiga no da su histórico de valor y la app aún no ha apuntado bastantes días.'}</div>`;
  let q = p.filter(([t]) => t >= Date.now() - dias * DIA - 12 * 3600e3);
  if (q.length < 2) q = p.slice(-2);
  const v0 = q[0][1], v1 = q[q.length - 1][1], d = v1 - v0;
  const vs = q.map((x) => x[1]);
  const span = Math.max(1, Math.round((q[q.length - 1][0] - q[0][0]) / DIA));
  // (10 nov, Carlos: la línea y las barras, juntas y claras) las barras de cada día son los últimos días de la línea:
  // van en la misma tarjeta y esos días se marcan en la línea con una franja
  const c = cambiosDiarios(p);
  const desde = c.length >= 2 ? Date.parse(`${c[0].dia}T00:00:00`) - DIA / 2 : null;
  const conFranja = desde && desde > q[0][0] + DIA;
  return `<div class="val-card">${linea(q, { alto: 150, color: d >= 0 ? 'var(--sube)' : 'var(--baja)', marca: conFranja ? { desde, texto: `${c.length} días` } : null })}
    <div class="graf-pie"><b class="${clase(d)}">${eur(d, { signo: true })} (${pct((v1 / v0 - 1) * 100)})</b> en ${span} día${span > 1 ? 's' : ''} · máx ${eur(Math.max(...vs))} · mín ${eur(Math.min(...vs))}</div>${diasHTML(p, conFranja)}</div>`;
}
/** lo que ha cambiado su valor cada uno de los últimos días: [{ dia: 'AAAA-MM-DD', d }] (el último valor de cada día) */
export function cambiosDiarios(serie, n = 7) {
  const porDia = new Map();
  for (const [t, v] of [...(serie || [])].sort((a, b) => a[0] - b[0])) if (Number.isFinite(t) && v > 0) porDia.set(diaDe(t), v);
  const dias = [...porDia.keys()].sort();
  const out = [];
  for (let i = 1; i < dias.length; i++) out.push({ dia: dias[i], d: porDia.get(dias[i]) - porDia.get(dias[i - 1]) });
  return out.slice(-n);
}
/* las barras de cada día, siempre debajo de la gráfica (Carlos, 9 nov: las de la inercia solo salían en algunos jugadores) */
function diasHTML(serie, conFranja = false) {
  const c = cambiosDiarios(serie);
  if (c.length < 2) return '';
  const max = Math.max(...c.map((x) => Math.abs(x.d)), 1);
  // (10 nov, Pedro Díaz) en millones con dos decimales, a un jugador de 700 mil todo le salía «0»: si ninguno de los días
  // llega a 100 mil, en miles; y un cambio que redondeado da cero se dice «≈0», no «0»
  const enMiles = max < 100000;
  const corto = (r) => {
    if (!r) return '0';
    const s = r > 0 ? '+' : '−', a = Math.abs(r);
    const t = enMiles ? (a < 10000 ? (a / 1000).toFixed(1) : String(Math.round(a / 1000))) : (a / 1e6).toFixed(2);
    return /^0[.,]0+$/.test(t) ? '≈0' : s + t.replace('.', ',');
  };
  const fdia = (s) => { const f = new Date(s + 'T12:00:00'); return `${f.toLocaleDateString('es-ES', { weekday: 'narrow' })} ${f.getDate()}`; };
  const barras = c.map((x) => {
    const h = !x.d ? 0 : Math.max(6, Math.round((Math.abs(x.d) / max) * 100));
    const cls = x.d > 0 ? 'sube' : x.d < 0 ? 'baja' : '';
    return `<div class="d7" title="${esc(eur(x.d, { signo: true }))}"><span class="d7-v ${cls}">${corto(x.d)}</span><div class="d7-z"><div class="d7-up">${x.d > 0 && h ? `<i style="--h:${h}%"></i>` : ''}</div><div class="d7-dw">${x.d < 0 && h ? `<i style="--h:${h}%"></i>` : ''}</div></div><em>${fdia(x.dia)}</em></div>`;
  }).join('');
  return `<div class="dias7"><div class="d7-cab"><span>Cada día</span><span class="t2">${conFranja ? 'la zona marcada' : `últimos ${c.length} días`}, en ${enMiles ? 'miles de €' : 'M'}</span></div><div class="d7-b">${barras}</div></div>`;
}

/* los puntos de las últimas jornadas, justo debajo de «Cada día» y con su misma forma (Carlos, 10 nov: antes iban
   mucho más abajo, en otra gráfica). Una columna por jornada: los puntos, coloreados por lo buenos que son, su barra
   (arriba lo positivo, abajo lo negativo), la jornada y los minutos; las que no jugó, con «–» */
export function jornadasPtsHTML(det) {
  if (!det || det.error) return '';
  const st = (det.stats || []).filter((s) => s.n > 0).sort((a, b) => a.n - b.n);
  if (!st.length) return '';
  const por = new Map(st.map((s) => [s.n, s]));
  const ult = st[st.length - 1].n;
  const L = [];
  for (let n = Math.max(st[0].n, ult - 6); n <= ult; n++) L.push(por.get(n) || { n, pts: null, min: 0 });
  const nivel = (s) => (s.pts == null || (!(s.min > 0) && !s.pts) ? 'nada' : s.pts >= 10 ? 'top' : s.pts >= 6 ? 'bien' : s.pts >= 2 ? 'medio' : 'mal');
  const extra = (s) => [s.gol ? `${s.gol} gol${s.gol > 1 ? 'es' : ''}` : '', s.asis ? `${s.asis} asist.` : '', s.roja ? 'roja' : s.am ? 'amarilla' : ''].filter(Boolean).join(', ');
  const fichas = L.map((s) => {
    const p = s.pts || 0, jugo = s.min > 0 || !!p;
    const tit = s.pts == null ? `J${s.n}: no jugó` : `J${s.n}: ${p} pts${s.min > 0 ? ` · ${s.min} min` : ''}${extra(s) ? ` · ${extra(s)}` : ''}`;
    // (el balón va en la esquina: junto a los minutos se cortaba) y «no jugó» en dos líneas
    const ic = s.gol ? '⚽' : s.roja ? '🟥' : '';
    return `<div class="jt ${nivel(s)}" title="${esc(tit)}">${ic ? `<i class="gol" aria-hidden="true">${ic}</i>` : ''}<span class="jt-n">J${s.n}</span><b>${jugo ? p : '–'}</b>${jugo ? `<small>${s.min > 0 ? `${s.min}'` : ''}</small>` : '<small class="nj">no<br>jugó</small>'}</div>`;
  }).join('');
  return `<div class="jor7"><div class="d7-cab"><span>Cada jornada</span><span class="t2">puntos de las últimas ${L.length}</span></div><div class="jt-fila">${fichas}</div></div>`;
}
/** la caja de las jornadas y, debajo, el resumen (media de las últimas, partidos y minutos, goles) */
export const jornadasFichaHTML = (det) => jornadasPtsHTML(det) + detalleHTML(det);

/* ---------- tu equipo hoy (al tocar el marcador de Hoy) ---------- */
/** el valor de tu equipo día a día (lo que apunta la app cada día) */
export function serieEquipo(S) {
  const s = (S.H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
  // sumando el histórico de valor de cada uno de tus jugadores de hoy (de LaLiga o lo apuntado por la app)
  const suma = sumaJugadores(S);
  // (la suma con la plantilla de cada día manda: el valor apuntado (H.yo) da saltos con cada fichaje, que no son subidas)
  const base = suma || s;
  if (S.D.valorEquipo && (!base.length || Date.now() - base[base.length - 1][0] > 20 * 3600e3)) base.push([Date.now(), S.D.valorEquipo]);
  return base;
}
/** el valor de tu equipo día a día. Cada día sube o baja lo que subieron o bajaron los jugadores que tenías ESE día
    (Carlos, 11 nov: antes se sumaba la serie de los de hoy hacia atrás y salían subidas que no tuviste). La plantilla de
    cada día sale de la de hoy deshaciendo tus fichajes, ventas y cláusulas (y las que te hicieron) de después de ese día;
    lo que cuesta un fichaje no cuenta como subida. Se ancla en lo que valen hoy los tuyos. null si falta la serie de
    muchos de los de hoy */
export function sumaJugadores(S, dias = 90) {
  const { M, D } = S;
  const series = new Map();
  const serieDe = (pid) => {
    if (series.has(pid)) return series.get(pid);
    const dv = (S.det && S.det[pid] && S.det[pid].valores) || [];
    const t = (M.tend(pid) || {}).serie || [];
    const s = (dv.length > t.length ? dv : t).filter(([ts, v]) => Number.isFinite(ts) && v > 0).sort((a, b) => a[0] - b[0]);
    series.set(pid, s);
    return s;
  };
  const mias = M.mias.filter((x) => x.j);
  if (!mias.length) return null;
  const con = mias.filter((x) => serieDe(String(x.pid)).length >= 3);
  if (con.length < mias.length * 0.7) return null;
  const DIA_MS = 864e5, hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const desde = Math.max(hoy.getTime() - (dias - 1) * DIA_MS, Math.min(...con.map((x) => serieDe(String(x.pid))[0][0])));
  const fijo = new Map(mias.map((x) => [String(x.pid), x.j.valor]));
  const valorEn = (pid, t) => {
    const s = serieDe(pid);
    if (!s.length) return fijo.get(pid) || (D.maestro && D.maestro[pid] && D.maestro[pid].valor) || 0;
    let v = s[0][1];
    for (const [ts, val] of s) { if (ts <= t + DIA_MS / 2) v = val; else break; }
    return v;
  };
  // lo que mete (entra) o saca a un jugador de tu equipo, del más nuevo al más viejo
  const movs = (M.actividad || [])
    .filter((a) => a.pid && a.t && a.esYo !== a.contraMi && (a.clase === 'compra' || a.clase === 'venta' || a.clase === 'clausula'))
    .map((a) => ({ t: a.t, pid: String(a.pid), entra: a.esYo ? a.clase !== 'venta' : a.clase === 'venta' }))
    .sort((a, b) => b.t - a.t);
  const plantilla = new Set(mias.map((x) => String(x.pid)));
  let k = 0;
  // del día de hoy hacia atrás: la plantilla al acabar cada día
  const dias_ = [];
  for (let t = hoy.getTime(); t >= desde - DIA_MS / 2; t -= DIA_MS) {
    while (k < movs.length && movs[k].t > t + DIA_MS / 2) { const m = movs[k++]; if (m.entra) plantilla.delete(m.pid); else plantilla.add(m.pid); }
    dias_.push({ t, ids: [...plantilla] });
  }
  if (dias_.length < 3) return null;
  // hoy, lo que valen los tuyos; cada día de antes, lo de después menos lo que subieron esa noche los que tenías
  let total = dias_[0].ids.reduce((s, pid) => s + valorEn(pid, dias_[0].t), 0);
  const out = [[dias_[0].t, total]];
  for (let i = 1; i < dias_.length; i++) {
    const { t, ids } = dias_[i], tSig = dias_[i - 1].t;
    total -= ids.reduce((s, pid) => s + (valorEn(pid, tSig) - valorEn(pid, t)), 0);
    out.push([t, total]);
  }
  return out.reverse();
}
export function resumenEquipo(S) {
  const { D, M } = S;
  const mias = M.mias.filter((x) => x.j);
  const d1 = mias.reduce((s, x) => s + num(x.tend.d1), 0);
  const d7 = mias.reduce((s, x) => s + num(x.tend.d7), 0);
  const base = D.valorEquipo - d1;
  const suben = mias.filter((x) => num(x.tend.d1) > 0).sort((a, b) => b.tend.d1 - a.tend.d1);
  const bajan = mias.filter((x) => num(x.tend.d1) < 0).sort((a, b) => a.tend.d1 - b.tend.d1);
  const quietos = mias.length - suben.length - bajan.length;
  const rango = S.rango || 30;
  let h = `<div class="hoja-cab"><h2>Tu equipo hoy</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  h += `<div class="valor-g"><span class="v">${eur(D.valorEquipo)}</span><span class="d ${clase(d1)}">${d1 ? `${d1 > 0 ? '▲' : '▼'} ${eur(Math.abs(d1), { dec: 2 })}${base > 0 ? ` (${pct((d1 / base) * 100)})` : ''} hoy` : '= hoy'}</span>${d7 ? `<span class="d ${clase(d7)}">${eur(d7, { signo: true })} 7d</span>` : ''}</div>`;
  h += `<p class="t2 peq" style="margin:2px 0 0">${suben.length} suben · ${bajan.length} bajan · ${quietos} igual${suben[0] ? ` · el que más sube, <b class="sube">${esc(suben[0].j.nombre)} ${eur(suben[0].tend.d1, { signo: true })}</b>` : ''}${bajan[0] ? ` · el que más baja, <b class="baja">${esc(bajan[0].j.nombre)} ${eur(bajan[0].tend.d1, { signo: true })}</b>` : ''}</p>`;
  // lo que antes iba debajo del marcador: la última jornada y la distancia en la clasificación
  const uj = puntosUltimaJornada(S), yo = M.yo;
  const tabla = [...D.clasif].sort((a, b) => a.pos - b.pos);
  const dist = yo ? (yo.pos === 1 ? (tabla[1] ? `Le sacas <b>${yo.puntos - tabla[1].puntos} pts</b> al 2º` : '') : tabla[0] ? `Estás a <b>${tabla[0].puntos - yo.puntos} pts</b> del 1º` : '') : '';
  if (uj || dist) h += `<div class="resumen-liga">${uj ? `<span>${uj.n ? `Jornada ${uj.n}` : 'Última jornada'}: <b>${uj.pts} pts</b>, ${uj.puesto}º de la jornada</span>` : ''}${dist ? `<span>${dist}${yo ? ` (vas ${yo.pos}º con ${num(yo.puntos)})` : ''}</span>` : ''}</div>`;
  h += `<div class="graf-cab"><span>Valor del equipo</span><div class="rangos">${RANGOS.map(([n, txt]) => `<button data-accion="rango" data-n="${n}" data-pid="__equipo" class="${rango === n ? 'activo' : ''}">${txt}</button>`).join('')}</div></div>`;
  h += `<div id="graf-j">${grafValor(serieEquipo(S), rango)}</div>`;

  // la inercia: hacia dónde va cada uno y lo que se espera hasta la jornada
  const conI = mias.filter((x) => x.inercia && x.j.pos !== 5);
  const proyJ = conI.reduce((s, x) => s + num(x.inercia.proyJ), 0);
  // (24 nov, decide.js) solo los que la decisión manda vender por la inercia (a un titular que gira no: se aguanta)
  const vender = mias.filter((x) => x.ventaInercia && ((M.decision ? M.decision(x.pid) : null) || {}).accion === 'vender').sort((a, b) => b.ventaInercia.perder - a.ventaInercia.perder);
  const sinI = bloqueada('inercia');
  if (sinI && (conI.length || vender.length)) h += candado('inercia');
  if (!sinI && M.proxima && conI.length) h += `<div class="aviso-ficha ${proyJ < 0 ? '' : 'verde'}">${icono(proyJ < 0 ? 'baja' : 'sube')}<div>Hasta la jornada ${M.proxima.n}, si cada uno sigue con su inercia, tu equipo ${proyJ >= 0 ? 'ganaría' : 'perdería'} unos <b>${eur(Math.abs(proyJ))}</b>.${vender.length ? ` Lo que más pesa: ${vender.slice(0, 3).map((x) => `${esc(x.j.nombre)} (${x.ventaInercia.urgencia === 'ya' ? 'ha girado' : 'frenando'})`).join(', ')}.` : ''}</div></div>`;
  if (!sinI && vender.length) {
    h += `<div class="sec"><h2>A vender por la inercia</h2><span class="sub">${vender.length}</span></div>`;
    h += vender.map((x) => filaJugador(x, {
      sub: esc(x.ventaInercia.urgencia === 'ya' ? 'Ha girado a la baja' : `Se frena: gira en ~${Math.max(1, Math.round(x.ventaInercia.giroEn || 1))} d`),
      extra: `<span class="pill ${x.ventaInercia.urgencia === 'ya' ? 'mal' : 'duda'}">${x.ventaInercia.R.slice(-4).map((r) => `${r >= 0 ? '+' : '−'}${String(Math.round(Math.abs(r) / 1e4) / 100).replace('.', ',')}`).join(' · ')} M/día</span>${M.enVenta.has(x.pid) ? '<span class="pill abierta">Ya en venta</span>' : ''}`,
      derecha: x.ventaInercia.perder > 0 ? `<div class="v baja">${eur(-x.ventaInercia.perder, { signo: true })}</div><div class="d apag">hasta la jornada</div>` : '<div class="d apag">gira pronto</div>',
    })).join('');
  }

  // el dinero
  const enVenta = M.misVentas.reduce((s, v) => s + num(v.j && v.j.valor), 0);
  h += `<div class="rejilla" style="margin-top:12px">
    <div class="dato"><div class="et">Saldo</div><div class="v ${D.dinero < 0 ? 'baja' : ''}">${eur(D.dinero)}</div></div>
    <div class="dato"><div class="et">Puedes gastar</div><div class="v">${eur(M.pujaMax)}<small>${eur(D.dinero)} de saldo ${M.deuda - M.misPujas >= 0 ? '+' : '−'} ${eur(Math.abs(M.deuda - M.misPujas))} en negativo${num(M.misPujas) ? ' (ya sin lo pujado)' : ''}</small></div></div>
    <div class="dato"><div class="et">En pujas</div><div class="v">${eur(M.misPujas || 0)}</div></div>
    <div class="dato"><div class="et">En venta</div><div class="v">${eur(enVenta)}<small>${M.misVentas.length} jugador${M.misVentas.length === 1 ? '' : 'es'}</small></div></div>
    ${M.conCompra ? `<div class="dato"><div class="et">Ganado sobre lo pagado</div><div class="v ${clase(M.ganadoTotal)}">${eur(M.ganadoTotal, { signo: true })}</div></div>` : ''}
  </div>`;

  const fila = (x) => filaJugador(x, {
    sub: `vale ${eur(x.j.valor)} · ${esc(x.j.equipo || '')}`,
    derecha: `<div class="v ${clase(x.tend.d1)}">${eur(x.tend.d1, { signo: true })}</div><div class="d ${clase(x.tend.d1)}">${x.tend.p1 != null ? pct(x.tend.p1) : ''}</div>${mini(x.tend.serie, x.tend.d1 >= 0)}`,
  });
  if (suben.length) h += `<div class="sec"><h2>Suben hoy</h2><span class="sub sube">${eur(suben.reduce((s, x) => s + x.tend.d1, 0), { signo: true })}</span></div>${suben.map(fila).join('')}`;
  if (bajan.length) h += `<div class="sec"><h2>Bajan hoy</h2><span class="sub baja">${eur(bajan.reduce((s, x) => s + x.tend.d1, 0), { signo: true })}</span></div>${bajan.map(fila).join('')}`;
  if (!suben.length && !bajan.length) h += nada('Hoy no se ha movido ninguno de tus jugadores (los valores cambian una vez al día, de madrugada).');

  // por puestos
  const puestos = [1, 2, 3, 4, 5].map((p) => {
    const xs = mias.filter((x) => x.j.pos === p);
    return { p, n: xs.length, v: xs.reduce((s, x) => s + x.j.valor, 0), d: xs.reduce((s, x) => s + num(x.tend.d1), 0), d7: xs.reduce((s, x) => s + num(x.tend.d7), 0) };
  }).filter((x) => x.n);
  h += `<div class="sec"><h2>Por puestos</h2></div><div class="tabla-p">${puestos.map((x) => `<div class="tp"><span class="pos p${x.p}">${({ 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL', 5: 'ENT' })[x.p]}</span><span class="n">${x.n} · ${eur(x.v, { dec: 1 })}</span><span class="${clase(x.d)}">${x.d ? eur(x.d, { signo: true }) : '='}</span><span class="${clase(x.d7)} apag7">${x.d7 ? `${eur(x.d7, { signo: true, dec: 1 })} 7d` : ''}</span></div>`).join('')}</div>`;

  // tu liga: cuánto sube el valor de cada equipo
  const filas = D.clasif.map((e) => {
    const r = M.rivales.find((x) => x.e.teamId === e.teamId);
    // lo que se mueve de mercado su plantilla, como la tuya: sin las ventas y fichajes del día
    return r ? { e, hoy: r.dValor1, d7: r.dValor, yo: false } : { e, hoy: d1, d7, yo: true };
  }).sort((a, b) => b.e.valor - a.e.valor);
  h += `<div class="sec"><h2>Valor en tu liga</h2><span class="sub">lo que suben sus jugadores</span></div><p class="t2 peq" style="margin:-4px 0 6px">Lo que han subido o bajado de valor los jugadores que tiene cada uno, hoy y en 7 días. No cuenta lo que entra o sale por fichajes, ventas o clausulazos.</p>${filas.map((f, i) => `<button class="fila ${f.yo ? 'yo-fila' : ''}" ${f.yo ? '' : `data-r="${esc(f.e.teamId)}"`}><span class="posn ${f.yo ? 'yo' : ''}">${i + 1}</span><div class="fila-c"><div class="fila-n">${esc(f.e.nombre)}</div><div class="fila-s">${eur(f.e.valor, { dec: 1 })}${f.e.manager && f.e.manager !== f.e.nombre ? ` · ${esc(f.e.manager)}` : ''}</div></div><div class="fila-d"><div class="v ${clase(f.hoy)}">${f.hoy ? eur(f.hoy, { signo: true, dec: 1 }) : '='}</div><div class="d ${clase(f.d7)}">${f.d7 != null ? `${eur(f.d7, { signo: true, dec: 1 })} 7d` : ''}</div></div></button>`).join('')}`;
  return h;
}

/** el valor de la ficha de un jugador: lo de hoy (si se sabe; si no, «hoy sin dato», nunca lo de 7 días en su sitio) y
 * lo de 7 días. Se vuelve a pintar cuando llega el histórico de LaLiga (aviso de Domy, 10 nov: solo veía el acumulado) */
export function valorFichaHTML(j, t) {
  const hoy = t && t.d1 != null ? (Math.abs(t.d1) > 0 ? `${delta({ d1: t.d1, p1: t.p1 }, { largo: true })} <span class="apag">hoy</span>` : '<span class="apag">= hoy</span>') : '<span class="apag">hoy sin dato</span>';
  return `<div class="valor-g" id="valor-j"><span class="v">${eur(j.valor)}</span><span class="d">${hoy}</span>${t && t.d7 != null ? `<span class="d ${clase(t.d7)}">${eur(t.d7, { signo: true })} 7d</span>` : ''}</div>`;
}
export function fichaJugador(S, pid) {
  const { M } = S;
  const j = M.J(pid), t = M.tend(pid);
  const duenoT = M.dueno[pid];
  const mia = M.mias.find((x) => x.pid === pid);
  const suya = !mia && duenoT ? (M.clausulas.find((x) => x.pid === pid) || null) : null;
  const enMercado = M.mercado.find((m) => m.pid === pid);
  const prox = M.proximoPartido(j.equipoId);
  const fr = M.factorRival(j);
  // la dificultad del próximo rival, la misma que en el calendario de abajo (cuenta si juega en casa o fuera)
  const cal1 = j.pos < 5 && M.calendarioRiesgo ? M.calendarioRiesgo(j) : null;
  if (cal1 && cal1.partidos[0] && cal1.partidos[0].nivel) fr.nivel = cal1.partidos[0].nivel;
  const inter = M.interes(j, suya ? suya.clausula : enMercado ? enMercado.precio : j.valor, t);
  if (mia) inter.por = inter.por.filter((x) => !/cuesta|te faltan/.test(x));
  const op = S.opPorPid[pid];
  const est = estiloClub(j.equipoId);
  let h = `<div class="ficha-top${est ? ' con-club' : ''}"${est}>${ava(j, 'g')}<div style="min-width:0"><h2>${esc(j.nombre)}</h2>
    <div class="s">${posTag(j)}<span>${esc(POS_LARGO[j.pos] || '')} · ${j.equipoId && S.D.equipos && S.D.equipos[j.equipoId] ? `<button class="enlace-j" data-club="${esc(j.equipoId)}">${esc(j.equipo || S.D.equipos[j.equipoId].nombre)}</button>` : esc(j.equipo || '')}</span>${estadoPill(j)}${oncePill(M, j)}</div></div>${(() => { const f = esFav(pid); return `<button class="fav-btn${f ? ' on' : ''}" data-accion="fav" data-pid="${esc(pid)}" aria-pressed="${f}">${icono('estrella')}<span>${f ? 'Favorito' : 'Seguir'}</span></button>`; })()}</div>`;
  h += valorFichaHTML(j, t);
  // con su partido de la jornada empezado: lo que lleva y lo que ha hecho (se pone al día solo)
  const vj = jornadaJugadorHTML(S, pid);
  if (vj) h += `<div id="vivo-j">${vj}</div>`;
  // lo básico (puntos, interés, cláusula y próximo partido), justo debajo del precio
  const f = mia || suya;
  h += `<div class="rejilla rej-j" style="margin:10px 0 4px">
    <button class="dato" data-accion="ver" data-sel="#j-puntua"><div class="et">Puntos ›</div><div class="v">${num(j.puntos)}<small>${j.media ? String(Math.round(j.media * 10) / 10).replace('.', ',') + ' de media' : ''}</small></div></button>
    <div class="dato"><div class="et">Interés</div><div class="v">${inter.n}<small>/100</small></div></div>
    ${mia && (mia.compra || mia.inicial) ? (() => {
      // (12 nov) lo que pagaste y lo que ha subido o bajado desde entonces, a la vista (antes, dentro de «Es tuyo»)
      const ref = mia.compra || mia.inicial, g = mia.compra ? mia.ganado : mia.ganadoIni;
      return `<div class="dato"><div class="et">${mia.compra ? 'Pagaste' : 'Valía al empezar'}</div><div class="v">${eur(ref)}${Number.isFinite(g) ? `<small class="cl-cuando"><b class="${clase(g)} nw">${eur(g, { signo: true })} (${pct(g / ref * 100)})</b> desde entonces</small>` : ''}</div></div>`;
    })() : ''}
    ${f ? `<button class="dato" ${mia ? 'data-ir="equipo" data-seg="equipo:clausulas"' : `data-r="${esc(duenoT || '')}"`}><div class="et">Cláusula ›</div><div class="v">${eur(f.clausula)}<small>${f.ratio ? `${pct((f.ratio - 1) * 100, 0)}${f.clausula > j.valor ? ` <span class="nw">· ${eur(f.clausula - j.valor)} de más</span>` : ''}` : ''}</small><small class="cl-cuando">${f.abierta ? `<b class="${!mia || mia.riesgo === 'alto' ? 'rojo' : ''}">Abierta${mia ? (mia.riesgo === 'ninguno' ? ' · sin riesgo' : ` · riesgo ${mia.riesgo}`) : ' ya'}</b>` : f.protegidoHasta ? `<b>${f.veda ? 'A salvo' : 'Se abre'} en ${cuenta(f.protegidoHasta)}</b>` : ''}</small></div></button>` : ''}
    <${prox && prox.rivalId ? `button class="dato" data-club="${esc(prox.rivalId)}"` : 'div class="dato"'}><div class="et">Próximo partido${prox && prox.rivalId ? ' ›' : ''}</div><div class="v" style="font-size:20px">${prox ? `${prox.casa ? 'vs' : enCasaDe(prox.rival)} <span class="niv ${nivelCls(fr.nivel)}">${esc(prox.rival)}</span>` : '–'}<small>${prox ? `${fr.r ? `${fr.r.pos}º · ${fr.nivel} · ` : ''}${cuando(prox.fecha)}` : ''}</small></div></${prox && prox.rivalId ? 'button' : 'div'}>
  </div>`;
  // (26 nov, parte B) en una liga premium, si es el capitán o un suplente del banquillo que propone la app para tu once
  // (la misma cuenta que Equipo y la IA: `M.premiumPropuesta`)
  const ppB = mia && !M.enJuego && M.premiumPropuesta ? M.premiumPropuesta() : null;
  if (ppB) {
    const capO = ppB.capitan && String(ppB.capitan.j.id) === String(pid) ? ppB.capitan : null;
    const banO = ppB.banquillo.find((x) => String(x.j.id) === String(pid)) || null;
    const u1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
    if (capO) h += `<p class="t2 peq" style="margin:8px 0 0"><b>Buen capitán esta jornada:</b> ~${u1(capO.pp)} puntos esperados, el que más de los tuyos.</p>`;
    else if (banO) h += `<p class="t2 peq" style="margin:8px 0 0"><b>Para tu banquillo:</b> ${banO.fijo ? 'de los que no alineas en su puesto, el que juega fijo con más puntos esperados' : 'de los que no alineas en su puesto, el que más opciones tiene de jugar'}${banO.cubre ? ` (por si no juega ${esc(banO.cubre.nombre)})` : ''}.</p>`;
  }
  // (40) «Avisarme»: una alarma antes de que se abra su cláusula, con la antelación que elijas (solo en la app, que es la que avisa)
  {
    const aj = cfgAvisos().jugadores[pid];
    if (enApp && !mia && (suya || aj)) {
      const est = !suya ? 'Ahora no es de ningún rival' : suya.abierta ? 'Su cláusula ya está abierta' : `Se abre ${cuando(suya.veda ? suya.veda.abre : suya.protegidoHasta)}`;
      h += `<div class="avisar-j${aj ? ' on' : ''}">${icono('campana')}<label for="avj-${esc(pid)}"><b>Avisarme de su cláusula</b><span>${esc(est)}</span></label><select id="avj-${esc(pid)}" data-cambia="avisoJ" data-pid="${esc(pid)}">${[['', 'No'], ...OPC_ANTES.jugador.map((m) => [m, antesTxt(m)])].map(([v, t]) => `<option value="${v}"${aj ? (String(aj.antes) === String(v) ? ' selected' : '') : v === '' ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
    }
  }
  // las funciones top cerradas, juntas al final de la ficha
  const cerradas = [];
  // (37) la inercia y el plan de hoy: si dicen lo mismo, una sola tarjeta; todas plegadas, con título y una línea a la vista
  let planDentro = false;
  if (M.inercia && M.inercia(pid)) { if (bloqueada('inercia')) cerradas.push('inercia'); else { const r = inerciaPlanHTML(S, pid, { mio: !!mia, op, mia }); h += r.html; planDentro = r.fundido; } }
  for (const n of notasDe(pid)) h += `<div class="aviso-ficha oro">${icono('nota')}<div><b>Le contaste a la IA:</b> ${esc(n.texto)} <span class="t2">(${cuando(n.t)})</span></div></div>`;
  // (27 nov) una puja: la misma línea que en Hoy (con cuánto ganas y lo pagado de más), sin el párrafo
  if (op && !planDentro) h += op.accion === 'pujar'
    ? avisoDeTexto(S, { k: 'plan', pid, ico: 'rayo', texto: lineaPaso(M, op), t: `Plan de hoy: pujar ${eur(num(op.puja_max || op.importe))}` })
    : avisoDeTexto(S, { k: 'plan', pid, ico: 'rayo', texto: op.motivo || '', t: `Plan de hoy: ${op.etiqueta || ACC[op.accion] || op.accion}${op.importe ? ` por ${eur(op.importe)}` : ''}${op.puja_max && eur(op.puja_max) !== eur(op.importe) ? ` (puja hasta ${eur(op.puja_max)})` : ''}` });
  // si el plan lo descarta (por dinero o por pagar de más), también aquí: la puja del mercado no es una recomendación
  const dpl = !op && descartePlan(S, pid);
  if (dpl) h += avisoDeTexto(S, { k: 'descarte', pid, cls: 'oro', ico: 'alerta', t: dpl.yaPujada ? 'Plan de hoy: no pujaría, pero tu puja sigue' : `Plan de hoy: no ${dpl.accion === 'comprar' ? 'lo compres' : (S.M.clausulas || []).some((y) => String(y.pid) === String(pid)) && !(S.M.mercado || []).some((y) => String(y.pid) === String(pid)) ? 'lo clausules' : 'pujes'}`, texto: dpl.aviso || '' });
  notasPlan(S, { j }).forEach(([et, t], n) => { h += avisoDeTexto(S, { k: `nota${n}`, pid, cls: 'azul', ico: 'ia', t: et, texto: t }); });
  const rango = S.rango || 30;
  h += `<div class="graf-cab"><span>Valor de mercado</span><div class="rangos">${RANGOS.map(([n, txt]) => `<button data-accion="rango" data-n="${n}" data-pid="${esc(pid)}" class="${rango === n ? 'activo' : ''}">${txt}</button>`).join('')}</div></div>`;
  h += `<div id="graf-j">${grafValor(serieValor(S, pid), rango, cargandoValor(S, pid))}</div>`;
  h += `<div id="jor-j">${S.det && S.det[pid] ? jornadasFichaHTML(S.det[pid]) : '<div class="graf-vacio esq esq-jor">Cargando sus jornadas…</div>'}</div>`;

  if (mia) {
    // (12 nov) sin el desplegable «Es tuyo»: lo pagado y cuándo se abre la cláusula van en la rejilla de arriba; aquí, a
    // la vista y solo si hay algo, blindarlo gratis y lo que te daría LaLiga
    const ol = S.M.ofertaLigaDe ? S.M.ofertaLigaDe(j) : null;
    const ref = mia.compra || mia.inicial || null;
    const gana = ol && ref ? ol.v - ref : null;
    // (23 nov, Carlos: «los textos, más cortos») una línea para el blindaje y otra para lo que da LaLiga; al que baja con la
    // cláusula por encima de lo que da LaLiga, «no lo blindes» (motor: noBlindar)
    const noBl = mia.abierta && !mia.escudo && mia.noBlindar;
    const gratis = noBl ? `<b>No lo blindes:</b> si te lo clausulan cobras <b>${eur(mia.clausula)}</b>, ${mia.noBlindar.igual ? 'lo mismo' : 'más'} que vendiéndolo.`
      : mia.abierta && S.M.paraEscudo && S.M.paraEscudo.includes(pid) ? `<b>Blíndalo gratis</b> con un anuncio en LaLiga: ${S.M.ESCUDO_H} h a salvo (te quedan ${S.M.escudosMios.quedan}).` : '';
    const liga = !ol || S.M.enVenta.has(pid) ? ''
      : `LaLiga te ofrecería entre <b>${eur(ol.una ? ol.una.min : ol.v)}</b> y <b>${eur(ol.una ? ol.una.max : ol.v)}</b>, a suerte, con una oferta nueva en cada cambio de mercado.`;
    if (gratis || liga) h += `<div class="aviso-ficha ${noBl ? 'oro' : 'verde'} peq">${icono('escudo')}<div>${[gratis, liga].filter(Boolean).join('<br>')}</div></div>`;
    // (24 nov) el cambio: véndelo y ficha a uno de estos (los 3 mejores de su puesto que te llegan)
    const cbF = S.M.cambioDe && ((S.M.decision ? S.M.decision(pid) : null) || { regla: 'cambio' }).regla === 'cambio' ? S.M.cambioDe(pid) : null;
    if (cbF) {
      const bsF = S.M.bajaSeguido(pid);
      h += `<div class="sec"><h2>Véndelo y ficha a otro</h2><span class="sub">${bsF ? 'baja y no tienes otro como él' : 'ha girado y juega de relleno'}</span></div>`;
      h += cbF.rec.map((r) => `<button class="fila rec-f" data-j="${esc(r.pid)}">${ava(r.j)}<div class="fila-c"><div class="fila-n">${esc(r.j.nombre)}</div><div class="fila-s">${r.tit != null ? `titular ${Math.round(r.tit * 100)} %` : ''}${r.prox && r.prox.rival ? ` · ${r.prox.casa ? 'vs' : 'en'} ${esc(r.prox.rival)}` : ''}${r.sube ? ' · ▲ sube' : ''} · <b class="sube">+${String(Math.round(r.gana * 10) / 10).replace('.', ',')} pts</b></div></div><div class="fila-d"><div class="v">${eur(r.puja)}</div><div class="d apag">puja</div></div></button>`).join('');
      h += '<p class="t2 peq">Pon a este a la venta y puja por uno de ellos. La oferta de LaLiga por él, acéptala cuando ya tengas al nuevo.</p>';
    }
    const pg = mia.pagan;
    if (pg && (pg.hayDatos || pg.seguro.length || pg.quiza.length) && mia.clausula && (mia.abierta || mia.abreEn < 3 * DIA) && bloqueada('quienPaga')) cerradas.push('quienPaga');
    else if (pg && (pg.hayDatos || pg.seguro.length || pg.quiza.length) && mia.clausula && (mia.abierta || mia.abreEn < 3 * DIA)) {
      const nadie = !pg.seguro.length && !pg.quiza.length;
      // solo a quién le llega, sin cuánto tiene (eso es «dinero de los rivales», que va aparte)
      const lista = [...pg.seguro.map((x) => `<b>${esc(x.nombre)}</b>`), ...pg.quiza.map((x) => `${esc(x.nombre)} (justo)`)];
      const n = lista.length;
      const b = mia.blindaje;
      const bl = !b || b.yaVale ? '' : b.caro ? `Dejarla fuera del alcance de todos costaría ${eur(b.coste)}: no compensa para lo que vale.${b.parcial ? ` <b>Lo que sí compensa:</b> subirla a ${eur(b.parcial.objetivo)} (te cuesta ${eur(b.parcial.coste)}) y solo le llegaría a ${esc(b.parcial.quedan.join(', '))}.` : ''}` : `<b>Para dejarla a salvo:</b> subirla a ${eur(b.objetivo)} te cuesta ${eur(b.coste)} y ${b.porTecho ? 'quedaría por encima de lo que se suele pagar en tu liga por una cláusula' : 'no le llegaría a nadie'}.`;
      h += aviso(S, { k: 'llega', pid, cls: nadie ? 'verde' : pg.seguro.length ? '' : 'oro', ico: 'rivales',
        t: nadie ? 'No le llega a ningún rival' : `Le llega a ${n} rival${n > 1 ? 'es' : ''}`,
        l: nadie ? 'Podrían juntarlo vendiendo, pero hoy no' : `${lista.slice(0, 3).join(', ')}${n > 3 ? ` y ${n - 3} más` : ''}`,
        d: parrafos(nadie || n <= 3 ? '' : `<b>Les llega:</b> ${lista.join(', ')}.`, pg.sinSaber.length ? `De ${pg.sinSaber.length} no se sabe el dinero.` : '', bl),
        chip: nadie ? null : { t: `${n}`, cls: 'baja' } });
    }
  } else {
    // en el mercado: libre de la liga (subasta a ciegas) o puesto a la venta por su dueño, otro manager
    if (enMercado) {
      const m = enMercado;
      const cc = m.tipo !== 'manager' && M.compraCal ? M.compraCal(j, m.puja || m.precio) : null;
      const vb = m.tipo === 'manager' && bloqueada('ventasRivales');
      // si el plan lo quiere para revender (o está en Especular), su calendario no cuenta: lo que se puja
      const espE = (M.especular || []).find((e) => e.pid === m.pid);
      const espX = m.tipo === 'manager' ? 0 : op && op.objetivo === 'revender' ? op.importe || m.puja : espE ? espE.precio || m.puja : 0;
      if (m.tipo === 'manager') {
        // (37) «Lo vende…»: a la vista, lo que hay que ofrecerle; dentro, cómo funciona la venta
        // (22 nov, Carlos) el precio que le pone su dueño no cuenta para nada y no se enseña: se le oferta desde su valor
        const ofrece = m.ofertaMin && !m.noVende && !vb;
        const oL = m.ofertaLiga;
        const liga = !oL ? '' : oL.sinDatos || vb ? 'LaLiga también le hace su oferta y se queda con la mejor: con ofrecerle su valor puede no bastar.'
          : `LaLiga también le hace ofertas, que solo ve él: cada una va de −10 % a +10 % de su valor, y las que se aceptan en tu liga rondan <b>${eur(oL.v)}</b> (${pct(oL.med * 100)}, en ${oL.n} ventas). Se queda con la mejor: por menos lo normal es que no te lo venda.`;
        h += aviso(S, { k: 'vende', pid, cls: 'oro', ico: 'usuario', t: `Lo vende ${esc(m.vendedor || 'otro manager')}`,
          l: m.noVende ? 'Lo normal es que no te lo venda' : ofrece ? `Vale ${eur(j.valor)} · ofrécele ${eur(m.puja || m.ofertaMin)}` : `Se le oferta desde su valor, ${eur(j.valor)}`,
          d: parrafos(`Sigue siendo suyo: solo es tuyo si acepta tu oferta. No es un jugador libre de la liga. El precio que él le haya puesto en el mercado da igual: puedes ofrecerle desde su valor.${m.ofertas ? ` Lleva ${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''} (cuánto, solo lo ve él).` : ''}`,
            liga,
            m.noVende ? `<b>Pero ${esc(m.noVende)}:</b> si lo vendiera no podría alinear un once, así que lo normal es que no te lo venda (lo tendrá a la venta para ver qué le da LaLiga).` : '',
            ofrece && m.ofertaAlta > m.ofertaMin ? (m.puja === m.ofertaAlta ? `Esa oferta es la más probable: con ${eur(m.ofertaMin)} tienes opciones, pero puede que LaLiga le dé más.` : `Con ${eur(m.ofertaAlta)} es muy probable que te lo venda.`) : '',
            m.miPuja ? `Tu oferta: ${eur(m.miPuja)}${m.ofertaMin && m.miPuja < m.ofertaMin ? ', por debajo de lo que puede sacarle a LaLiga: súbela o lo normal es que no la acepte' : ''}.` : '') });
        if (vb && m.ofertaMin && !m.noVende) h += candado('ventasRivales');
      } else {
        // (37) «Libre en el mercado»: a la vista, desde cuánto y lo que haría la app; dentro, la subasta y lo que se paga en tu liga
        const noPuja = cc && !cc.ok && !espX;
        const PV = M.pagaLiga && m.j.valor ? M.pagaLiga(m.j.valor, m.pid) : null;
        // (27 nov) la puja que gana unas 7-8 de cada 10 veces, con lo pagado de más, o que no compensa; el precio de salida
        // («Sale a», lo que valía al salir al mercado) va dentro: no es lo que se paga
        const pMia = m.miPuja && m.quien && m.quien.pMia != null ? m.quien.pMia : m.miPuja ? (pujaDe(M, m.pid, num(m.miPuja)) || {}).pGana : null;
        const lineaL = m.miPuja ? `Tu puja: ${eur(m.miPuja)}${pMia != null ? ` · ganas ${vecesCorto(pMia)}` : ''}${m.puja > m.miPuja && !m.noCompensa ? ` · la app pujaría ${eur(m.puja)}` : ''}`
          : cc && !cc.ok && espX ? `Para revender, la app pujaría ${eur(espX)}` : noPuja ? 'Con su calendario, la app no pujaría'
          : m.noCompensa && !espX ? noCompensaTxt(m, { porque: true }) : `La app pujaría ${eur(m.puja)} · ${pujaLinea(m)}`;
        const cal = m.miPuja ? '' : cc && !cc.ok && espX ? 'Para revender da igual su calendario.' : noPuja ? `Con su calendario no pujaría por él${cc.parche ? `: sale ya a un ${pct(cc.sobre * 100)} sobre su valor y de parche no pagaría más de un ${pct(cc.cal.maxSobre * 100, 0, false)}` : ' salvo que te haga falta de parche'}.` : '';
        // (0.7.13u) por los que venían como él (su subida y si es de los top) y, si tu liga tiene pocos, con todas las ligas
        const liga = PV ? `Por ${M.pagaTxt(PV)} se ha pagado de mediana un ${pct(PV.med * 100)} sobre su valor, y el 90 % hasta un ${pct(PV.p90 * 100)}.` : M.pujasLiga && !M.pujasLiga.poco ? `En tu liga se paga de mediana un ${pct(M.pujasLiga.med * 100)} sobre el valor.` : '';
        const tope = '';
        // (26 nov) debajo, en la misma tarjeta, lo pagado por él y su demanda en las demás ligas (apagado en limites.json:
        // no sale nada); gratis, sin candado (Carlos, 19:31)
        h += aviso(S, { k: 'libre', pid, cls: 'azul', ico: 'mercado', t: 'Libre en el mercado de la liga', l: lineaL + otrasLigasHTML(S, m),
          d: parrafos(`Subasta a ciegas${m.cierra ? ` hasta ${esc(cuando(m.cierra))}` : ''}: gana la puja más alta. Precio de salida ${eur(m.precio)}. ${m.pujas ? `${m.pujas} puja${m.pujas > 1 ? 's' : ''}.` : 'Sin pujas.'}`, cal, liga, tope) });
        // (0.8.2) quién puede estar detrás de las pujas de otros que lleva (función top)
        if (m.ajenas > 0 && m.quien && m.quien.cands.length) { if (bloqueada('quienPuja')) cerradas.push('quienPuja'); else h += quienPujaHTML(S, m); }
      }
    }
    if (suya) {
      const dueno = esc(suya.rival.manager || suya.rival.nombre);
      if (suya.abierta && suya.meLlega) h += aviso(S, { k: 'clausular', pid, cls: 'verde', ico: 'diana', t: 'Puedes clausularlo ya', l: `${eur(suya.clausula)} a ${dueno}: te quedas con ${eur(suya.teQueda)}` });
      else if (suya.abierta) h += aviso(S, { k: 'clausular', pid, ico: 'candado', t: 'Cláusula abierta, pero no te llega', l: `Te faltan ${eur(suya.clausula - num(S.D.dinero))}`, d: parrafos(`Es de ${dueno}. Una cláusula solo se paga con saldo, sin deuda.`) });
      else h += aviso(S, { k: 'clausular', pid, cls: 'oro', ico: 'reloj', t: `Es de ${dueno}`,
        l: `Su cláusula ${suya.veda ? 'se puede pagar' : 'se abre'} ${esc(cuando(suya.protegidoHasta))} (en ${cuenta(suya.protegidoHasta)})`,
        d: parrafos(suya.escudo ? 'Lo ha <b>blindado</b>.' : '', suya.veda ? `Las cláusulas están cerradas hasta que empiece la jornada ${suya.veda.n}.` : '', suya.meLlega ? 'Te llega con tu saldo.' : `Con tu saldo te faltan ${eur(suya.clausula - num(S.D.dinero))}: las cláusulas no se pueden pagar con deuda.`) });
    } else if (!enMercado) {
      h += `<div class="aviso-ficha azul">${icono('info')}<div>No es de nadie en tu liga: puede salir en el mercado.</div></div>`;
    }
  }
  if (mia) h += `<button class="btn chico sec" data-accion="reventa" data-pid="${esc(pid)}" style="margin:2px 0 6px">${icono('cambio')}${M.reventa[pid] ? 'Quitar de «para revender»' : 'Lo tengo para revender'}</button>`;
  const venta = M.misVentas.find((v) => v.pid === pid);
  if (venta) h += `<div class="sec"><h2>En venta</h2></div>${ventaHTML(venta)}`;
  if (j.pos < 5) {
    h += calendarioHTML(M, j, !!mia, S);
    const v = M.previa && M.previa(j), r = M.rendimiento && M.rendimiento(j);
    const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
    // cómo puntúa según dónde y contra quién (puntos por partido), comparado con su media; y lo del próximo partido
    const med = num(j.media);
    const tono = (m) => (!med ? '' : m >= med * 1.15 ? 'sube' : m <= med * 0.85 ? 'baja' : '');
    const tile = (et, val, sub, cls = '') => `<div class="dato"><div class="et">${et}</div><div class="v ${cls}">${val}<small>${sub}</small></div></div>`;
    const tiles = [];
    if (r && r.casa) tiles.push(tile('En casa', d1(r.casa.m), `pts · ${r.casa.n} partido${r.casa.n === 1 ? '' : 's'}`, tono(r.casa.m)));
    if (r && r.fuera) tiles.push(tile('Fuera', d1(r.fuera.m), `pts · ${r.fuera.n} partido${r.fuera.n === 1 ? '' : 's'}`, tono(r.fuera.m)));
    if (r && r.arriba) tiles.push(tile('Contra los 6 primeros', d1(r.arriba.m), `pts · ${r.arriba.n} partido${r.arriba.n === 1 ? '' : 's'}`, tono(r.arriba.m)));
    if (r && r.abajo) tiles.push(tile('Contra los 6 últimos', d1(r.abajo.m), `pts · ${r.abajo.n} partido${r.abajo.n === 1 ? '' : 's'}`, tono(r.abajo.m)));
    if (v && j.pos <= 2 && v.cero != null) tiles.push(tile(`Portería a cero vs ${esc(v.rival)}`, `~${Math.round(v.cero * 100)} %`, 'de probabilidad'));
    else if (v && v.golesFavor != null) tiles.push(tile(`Goles de su equipo vs ${esc(v.rival)}`, `~${d1(v.golesFavor)}`, 'esperados'));
    // (0.7.7, overhaul) el detalle va plegado: a la vista, el título de siempre y su cifra
    if (tiles.length) h += `<details class="fj-pleg" id="j-puntua" data-ancla><summary><div class="sec"><h2>Cómo puntúa</h2><span class="sub">${med ? `su media es ${d1(med)} pts` : 'puntos por partido'}</span></div></summary><div class="rejilla rinde">${tiles.join('')}</div></details>`;
    h += esperadosHTML(S, M, j);
    // fuera del Fantasy: Understat y SofaScore
    const a = M.avanzado && M.avanzado(j.id);
    if (a) {
      const p90 = (val, min) => { if (!(min > 0)) return '–'; const x = (val * 90) / min; return String(Math.round(x * (x < 1 ? 100 : 10)) / (x < 1 ? 100 : 10)).replace('.', ','); };
      const c = [];
      if (a.u && a.u.min > 0) {
        c.push(`<span>xG <b>${d1(a.u.xg)}</b> (${a.u.g} ${a.u.g === 1 ? 'gol' : 'goles'})</span>`, `<span>xA <b>${d1(a.u.xa)}</b> (${a.u.a} ${a.u.a === 1 ? 'asistencia' : 'asist.'})</span>`);
        c.push(`<span>Tiros/90 <b>${p90(a.u.tiros, a.u.min)}</b></span>`, `<span>Pases clave/90 <b>${p90(a.u.pc, a.u.min)}</b></span>`);
      }
      if (a.s) {
        if (a.s.nota) c.push(`<span>Nota media <b>${String(a.s.nota).replace('.', ',')}</b></span>`);
        if (a.s.notas && a.s.notas.length) c.push(`<span>Últimas <b>${a.s.notas.map((n) => String(n).replace('.', ',')).join(' · ')}</b></span>`);
        if (j.pos === 1 && a.s.paradas && a.s.min) c.push(`<span>Paradas/90 <b>${p90(a.s.paradas, a.s.min)}</b></span>`);
        if (j.pos !== 1 && a.s.min && (a.s.recup || a.s.entradas)) c.push(`<span>Recup./90 <b>${p90(a.s.recup || a.s.entradas, a.s.min)}</b></span>`);
      }
      if (c.length) h += `<details class="fj-pleg"><summary><div class="sec"><h2>Rendimiento a fondo</h2><span class="sub">esta temporada</span></div></summary><div class="previa">${c.join('')}</div></details>`;
    }
  }
  // (26 nov, 13:50, Carlos, con la captura de la ficha de un entrenador: «No quiero nada de ese cartel. En ningún lado»)
  // la ficha de un entrenador no lleva ningún cartel que explique qué es o cómo puntúa (ni en premium, ni destituido,
  // ni en la versión gratis)
  if (inter.por.length) h += `<p class="t2 peq">${barra(inter.n)} ${esc(inter.por.join(' · '))}</p>`;
  const nots = M.noticiasDe(pid).slice(0, 6);
  if (nots.length) h += `<div class="sec"><h2>Noticias</h2></div>${nots.map(filaNoticia).join('')}`;
  const acts = M.actividad.filter((a) => a.pid === pid).slice(0, 6);
  if (acts.length) h += `<div class="sec"><h2>En tu liga</h2></div>${acts.map(filaActividad).join('')}`;
  h += candadosJuntos(cerradas);
  h += `<button class="btn sec ancho" style="margin-top:18px" data-accion="preguntarJ" data-pid="${esc(pid)}">${icono('ia')}¿Qué hago con ${esc(j.nombre)}?</button>`;
  return h;
}

/** los puntos esperados de su próximo partido, por partes, con la titularidad y la rotación */
function esperadosHTML(S, M, j) {
  const P = M.ppDetalle ? M.ppDetalle(j) : null;
  if (!P) return '';
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const prox = M.proximoPartido(j.equipoId);
  // (0.7.7, overhaul) plegado: el título con la cifra queda a la vista; el aviso de rotación va fuera, siempre visible
  let h = `<details class="fj-pleg"><summary><div class="sec"><h2>Puntos esperados: ${d1(P.final)}</h2><span class="sub">${prox ? `J${prox.jornada} ${prox.casa ? 'vs' : 'en'} ${esc(prox.rival)}` : ''}</span></div></summary>`;
  const d = P.d;
  if (d) {
    const N = { min: 'Minutos', gol: 'Gol', asis: 'Asistencia', cero: 'Portería a cero', encaja: 'Encajados', paradas: 'Paradas', tarjetas: 'Tarjetas', resto: 'Nota DAZN y extras' };
    h += `<div class="pp-partes">${Object.entries(d.partes).filter(([, v]) => Math.abs(v) >= 0.05).map(([k, v]) => `<div class="pp-p"><span>${N[k] || k}</span><i style="--w:${Math.min(100, Math.abs(v) / 4 * 100)}%" class="${v < 0 ? 'neg' : ''}"></i><b>${v < 0 ? '−' : '+'}${d1(Math.abs(v))}</b></div>`).join('')}</div>`;
    h += `<p class="t2 peq">Por partes, como puntúa LaLiga Fantasy, con ${d.fuente === 'medias del puesto' ? 'las medias de su puesto (no hay xG suyo)' : 'su xG y su xA de esta temporada'}, salen ${d1(d.total)}. Con la fórmula de siempre (media, forma y rival), ${d1(P.base)}. La cifra de arriba junta las dos${P.w && P.w !== 0.5 ? ` (el desglose pesa un ${Math.round(P.w * 100)} %, según lo que ha acertado cada una)` : ''}${P.sesgo !== 1 ? ` y se corrige ×${String(P.sesgo).replace('.', ',')} por lo que se ha fallado con su puesto` : ''}.${d.fRes != null && Math.abs(d.fRes - 1) >= 0.08 && prox ? ` ${d.fRes < 1 ? `Contra el ${esc(prox.rival)} su equipo lo pasará peor de lo normal: la nota y los extras, un ${Math.round((1 - d.fRes) * 100)} % menos.` : `Contra el ${esc(prox.rival)} a su equipo le debería ir mejor de lo normal: la nota y los extras, un ${Math.round((d.fRes - 1) * 100)} % más.`}` : ''}</p>`;
  }
  const T = P.T;
  if (T) h += `<div class="previa"><span>Titular <b>~${Math.round(T.p * 100)} %</b></span>${T.fuentes.map((f) => `<span>${esc(f.f)} <b>${Math.round(f.p * 100)} %</b></span>`).join('')}</div>`;
  h += '</details>';
  if (T && T.rot && T.rot.cerca.length) {
    // (37) a la vista el primer partido y cuántos son; dentro, todos y lo que quita de titularidad
    const cerca = T.rot.cerca;
    const part = (x) => `${esc(x.comp)}${x.rival ? ` ${x.casa ? 'contra el' : 'en casa del'} ${esc(x.rival)}` : ''}`;
    const antes = (x) => `${d1(x.dias)} días ${x.antes ? 'antes' : 'después'}`;
    h += aviso(S, { k: 'rotacion', pid: j.id, cls: 'oro', ico: 'reloj', t: 'Riesgo de rotación', chip: T.pRot ? { t: `−${Math.round(T.pRot * 100)} %`, cls: 'oro' } : null,
      l: `${T.pRot ? `−${Math.round(T.pRot * 100)} % de titularidad · ` : ''}${esc(cerca[0].comp)}, ${antes(cerca[0])}${cerca.length > 1 ? ` y ${cerca.length - 1} más` : ''}`,
      d: parrafos(...cerca.map((x) => `${part(x)}, ${esc(cuando(x.t))} (${antes(x)}).`)) });
  }
  return h;
}

/** sus puntos por jornada, minutos y goles (de la ficha del jugador en la API) */
export function detalleHTML(det) {
  if (!det || det.error) return `<div class="graf-vacio">${det && det.error ? 'No se ha podido leer su ficha en LaLiga.' : ''}</div>`;
  const st = det.stats || [];
  if (!st.length) return '';
  const ult = st.slice(-5), jugados = st.filter((s) => s.min > 0);
  const media5 = ult.reduce((a, s) => a + s.pts, 0) / ult.length;
  const tot = (k) => st.reduce((a, s) => a + s[k], 0);
  let h = `<p class="t2 peq">Últimas ${ult.length}: <b>${String(Math.round(media5 * 10) / 10).replace('.', ',')}</b> pts de media · ha jugado ${jugados.length} de ${st.length} (${Math.round(tot('min'))} min)${tot('gol') ? ` · ${tot('gol')} gol${tot('gol') > 1 ? 'es' : ''}` : ''}${tot('asis') ? ` · ${tot('asis')} asist.` : ''}${tot('am') ? ` · ${tot('am')} amarilla${tot('am') > 1 ? 's' : ''}` : ''}${tot('roja') ? ` · ${tot('roja')} roja` : ''}</p>`;
  return h;
}

/** lo que dice el plan de hoy de un rival o de un jugador (Tus rivales, Vigila, Noticias, Mirados y descartados), para
 * verlo también en su ficha: en el plan va en una línea corta y al tocarlo no salía en ningún lado (aviso de Domy) */
function notasPlan(S, { tid, j } = {}) {
  const P = S.plan;
  if (!P) return [];
  const out = [];
  if (tid) for (const r of P.rivales || []) if (r && r.texto && S.M.teamDeManager(r.manager) === tid) out.push(['Tu plan de hoy', r.texto]);
  if (j) {
    const n = norm(j.nombre);
    const es = (x) => { const k = norm(x); return !!k && (k === n || (k.length >= 5 && (n.includes(k) || k.includes(n)))); };
    for (const v of P.vigilar || []) if (v && es(v.jugador)) out.push(['Vigila (plan de hoy)', v.texto]);
    for (const v of P.noticias || []) if (v && es(v.jugador)) out.push(['Noticia del plan de hoy', v.texto]);
    for (const v of P.descartes || []) if (v && es(v.jugador)) out.push(['Mirado y descartado hoy', v.motivo]);
  }
  return out.filter(([, t]) => t);
}

/** cómo juega un rival (M.perfil): sus clausulazos, cómo ficha y vende, si se protege y a qué hora se mueve */
function perfilHTML(S, tid) {
  const { M } = S, P = M.perfil ? M.perfil(tid) : null;
  if (!P) return '';
  const yo = S.D.yo && S.D.yo.teamId;
  const quien = (t) => (t === yo ? 'ti' : esc((M.equipo[t] || {}).manager || (M.equipo[t] || {}).nombre || 'otro'));
  const desde = P.completa ? 'toda la temporada' : P.desde ? `desde el ${cuando(P.desde, { hora: false })}` : '';
  let h = `<div class="sec"><h2>Cómo juega</h2>${desde ? `<span class="sub">${desde}</span>` : ''}</div>`;
  if (!P.n) return h + `<p class="t2 peq">No ha hecho ningún movimiento${desde ? ` (${desde})` : ''}.</p>`;
  if (P.rasgos.length) h += `<div class="perfil-r">${P.rasgos.map(([cls, t, x]) => `<span class="pill ${cls}" title="${esc(x)}">${esc(t)} <span class="apag">· ${esc(x)}</span></span>`).join('')}</div>`;
  const vic = Object.entries(P.cz.victimas).sort((a, b) => b[1] - a[1]);
  const dato = (et, v, sub) => `<div class="dato"><div class="et">${et}</div><div class="v">${v}<small>${sub || ''}</small></div></div>`;
  h += `<div class="rejilla">`;
  h += dato('Clausulazos', P.cz.n, P.cz.n ? `${P.cz.med != null ? `${pct(P.cz.med * 100)} sobre el valor` : ''}${P.recibidos ? ` · le han hecho ${P.recibidos}` : ''}` : P.recibidos ? `le han hecho ${P.recibidos}` : 'ninguno');
  const nV = P.ventas.liga + P.ventas.manager;
  const desglose = `${P.ventas.liga} a LaLiga${P.ventas.manager ? `, ${P.ventas.manager} a managers` : ''}`;
  h += dato('Vende', nV ? (P.ventas.dias != null ? `~${Math.max(1, Math.round(P.ventas.dias))} días` : nV) : '0', nV ? `${P.ventas.dias != null ? 'los tiene antes de vender' : nV === 1 ? 'venta' : 'ventas'} · ${desglose}` : 'no ha vendido');
  h += dato('Ficha', P.compras.liga + P.compras.manager, `${P.compras.liga} del mercado${P.compras.manager ? `, ${P.compras.manager} a managers` : ''}${P.compras.paga != null && P.compras.nPaga >= 2 ? ` · paga ${pct(P.compras.paga * 100)}` : ''}`);
  h += dato('Se protege', P.escudos + P.subidas, `${P.escudos} escudo${P.escudos === 1 ? '' : 's'}, ${P.subidas} subida${P.subidas === 1 ? '' : 's'} pagada${P.subidas === 1 ? '' : 's'}`);
  if (P.franja) h += dato('Se mueve', `${P.franja.ini}–${P.franja.fin || 24} h`, `${P.franja.n} de ${P.franja.de} (clausular, vender, proteger)`);
  h += `</div>`;
  const pu = Object.entries(P.puestos).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const POSC = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
  if (pu.length) h += `<p class="t2 peq" style="margin:2px 0 6px">Lo que ficha: ${pu.map(([q, n]) => `<b>${POSC[q]}</b> ${n}`).join(' · ')}.${vic.length ? ` Ha clausulado a ${vic.map(([t, n]) => `${quien(t)} (${n})`).join(', ')}.` : ''}</p>`;
  else if (vic.length) h += `<p class="t2 peq" style="margin:2px 0 6px">Ha clausulado a ${vic.map(([t, n]) => `${quien(t)} (${n})`).join(', ')}.</p>`;
  if (P.cz.ult.length) {
    h += `<div class="grupo"><span>Sus últimos clausulazos</span><span>${P.cz.n}</span></div>`;
    h += P.cz.ult.map((x) => { const j = M.J(x.pid); return j ? filaJugador({ j, tend: M.tend(x.pid) }, { sub: `a ${quien(x.a)} · ${cuando(x.t, { hora: false })}${x.s != null ? ` · ${pct(x.s * 100)} sobre su valor` : ''}`, derecha: `<div class="v">${eur(x.imp)}</div><div class="d apag">pagó</div>` }) : ''; }).join('');
  }
  return h;
}

/* ================= FICHA DE RIVAL ================= */
/* en pestañas, como la del club (Carlos, 13 nov, punto 50: «más sencillas, más intuitivas, y con subpestañas dentro»;
   eligió la opción A con retoques). Arriba solo quién es y su valor; lo clausulable baja a Cláusulas, partido en lo que
   tú le puedes quitar y lo que él te puede quitar a ti. Siempre se abre en Plantilla: S.segRival = { tid, seg, sub }
   solo vale para el rival que la eligió (app.js lo borra al abrir un rival desde fuera). */
const PEST_RIVAL = [['plantilla', 'Plantilla'], ['suben', 'Suben y bajan'], ['clausulas', 'Cláusulas'], ['juego', 'Su juego']];
const SUB_RIVAL = {
  plantilla: [['todos', 'Todos'], ['puesto', 'Por puesto']],
  suben: [['hoy', 'Hoy'], ['7d', '7 días']],
  clausulas: [['quitas', 'Le quitas tú'], ['quita', 'Te quita él']],
  juego: [['perfil', 'Perfil'], ['venta', 'En venta'], ['movs', 'Movimientos']],
};
function segDeRival(S, tid) {
  const x = S.segRival && String(S.segRival.tid) === String(tid) ? S.segRival : {};
  const seg = SUB_RIVAL[x.seg] ? x.seg : 'plantilla';
  const sub = SUB_RIVAL[seg].some(([k]) => k === x.sub) ? x.sub : SUB_RIVAL[seg][0][0];
  return { seg, sub };
}

/** suben y bajan de su plantilla, como en Equipo y en la ficha del club: hoy (`d1`) o en 7 días (`d7`), con su cláusula
    a la vista en cada fila */
function subenBajanRival(r, per) {
  const xs = r.fichas.filter((x) => x.j.valor > 0).map((x) => ({ x, d: x.tend ? (per === '7d' ? x.tend.d7 : x.tend.d1) : null, p: x.tend ? (per === '7d' ? x.tend.p7 : x.tend.p1) : null }));
  const con = xs.filter((o) => o.d != null).sort((a, b) => b.d - a.d || b.x.j.valor - a.x.j.valor);
  const sin = xs.filter((o) => o.d == null).sort((a, b) => b.x.j.valor - a.x.j.valor);
  const suben = con.filter((o) => o.d > 0), bajan = con.filter((o) => o.d < 0).sort((a, b) => a.d - b.d), igual = con.filter((o) => o.d === 0);
  const cuandoTxt = per === '7d' ? 'en 7 días' : 'hoy';
  if (!xs.length) return { tot: null, h: nada('No se ha podido leer su plantilla.') };
  if (!con.length) return { tot: null, h: nada(`Aún no tengo lo que han cambiado de valor ${cuandoTxt}. Dale a Actualizar.`) };
  const tot = con.reduce((s, o) => s + o.d, 0), max = Math.max(...con.map((o) => Math.abs(o.d)), 1);
  const fila = (o) => {
    const cls = clase(o.d);
    const barra = o.d ? `<span class="sb-barra ${cls}" style="--w:${Math.max(2, Math.round((Math.abs(o.d) / max) * 100))}%"></span>` : '';
    return filaJugador(o.x, {
      sub: `${esc(o.x.j.equipo)}${barra}`, extra: `${clausulaPill(o.x)}${estadoPill(o.x.j)}`,
      derecha: `<div class="v sb-d ${cls}">${o.d ? `${o.d > 0 ? '▲' : '▼'} ${eur(o.d, { dec: 1, signo: true })}` : '='}</div><div class="d">${o.p != null && o.d ? `<span class="${cls}">${pct(o.p)}</span> · ` : ''}${eur(o.x.j.valor, { dec: 1 })}</div>`,
    });
  };
  const grupo = (t, l, cls) => (l.length ? `<div class="grupo"><span>${t} · ${l.length}</span><span class="${cls || ''}">${cls ? eur(l.reduce((s, o) => s + o.d, 0), { dec: 1, signo: true }) : ''}</span></div>${l.map(fila).join('')}` : '');
  let h = `<p class="sb-res"><span class="sube">▲ ${suben.length} suben</span> · <span class="baja">▼ ${bajan.length} bajan</span>${igual.length ? ` · ${igual.length} igual` : ''}</p>`;
  h += grupo('Suben', suben, 'sube') + grupo('Bajan', bajan, 'baja') + grupo('Igual', igual);
  if (sin.length) h += grupo(`Sin datos ${cuandoTxt}`, sin);
  return { tot, h };
}

/** (0.8a, Carlos 17 nov) el apodo del rival, debajo de su nombre: el botón para ponerlo, la caja para escribirlo o el que tiene */
function apodoRival(S, e) {
  const tid = String(e.teamId), aps = apodosDe(tid);
  if (S.apodoEdita === tid) {
    const por = [e.manager, e.nombre].filter((x, i, a) => x && a.indexOf(x) === i).map((x) => `«${esc(x)}»`).join(' y ');
    return `<div class="apodo-ed"><label for="apodoIn">¿Cómo lo llamáis en tu liga?</label><div class="apodo-fila"><input id="apodoIn" data-tid="${esc(tid)}" value="${esc(aps.join(', '))}" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="el Tito"><button class="btn chico" data-accion="apodoGuardar" data-tid="${esc(tid)}">Guardar</button></div><small>Puedes poner varios separados por comas (el Tito, Titón). La IA y la voz lo reconocerán así, además de por ${por}. Solo lo ves tú.</small></div>`;
  }
  if (aps.length) return `<div class="apodo-l">Lo llamas <b>${aps.map((x) => `«${esc(x)}»`).join(', ')}</b><button class="apodo-chip chico" data-accion="apodoEditar" data-tid="${esc(tid)}">${icono('lapiz')}Cambiar</button></div>`;
  return `<div class="apodo-l"><button class="apodo-chip" data-accion="apodoEditar" data-tid="${esc(tid)}">${icono('lapiz')}Ponle un apodo</button><span>para la IA y la voz</span></div>`;
}

/** (26 nov, parte B) lo de premium de un rival, en su cabecera: su entrenador (o los dos) y cuántos cedidos tiene. Solo en
 *  una liga premium con esa función; '' si no hay nada que decir */
function premiumRivalTxt(S, tid, e) {
  const { M, D } = S;
  if (!M.premium || !M.premium.liga) return '';
  const ents = M.premium.entrenador ? ((D.plantillas || {})[tid] || []).map((f) => M.J(f.pid)).filter((j) => j && j.pos === 5) : [];
  const ced = M.premium.cesiones && e && e.cedidos > 0 ? e.cedidos : 0;
  return `${ents.length ? ` · entrenador${ents.length > 1 ? 'es' : ''}: ${esc(ents.map((j) => j.nombre).join(' y '))}` : ''}${ced ? ` · ${ced} cedido${ced > 1 ? 's' : ''}` : ''}`;
}
export function fichaRival(S, tid) {
  const { M } = S;
  const r = M.rivales.find((x) => x.e.teamId === tid);
  if (!r) return nada('No encuentro este equipo.');
  const e = r.e;
  const { seg, sub } = segDeRival(S, tid);
  // las funciones top cerradas, juntas en una tarjeta al final (antes, un candado en cada sección)
  const cerradas = [];
  // arriba, lo primero que se mira de un rival (Carlos, 13 nov, 19:08): su dinero (con el candado si es función top),
  // el valor de su plantilla, sus cláusulas abiertas y lo que ha gastado; cada casilla lleva a su pestaña
  const ir = (s, p) => `data-accion="segRival" data-tid="${esc(tid)}" data-s="${s}" data-p="${p}"`;
  const dV = r.dValor ? `<small class="${clase(r.dValor)} nw">${r.dValor > 0 ? '▲' : '▼'} ${eur(r.dValor, { signo: true, dec: 1 })} en 7 días</small>` : '';
  const conDinero = r.dinero && r.dinero.v != null;
  const tDinero = bloqueada('dineroRivales', tid)
    ? `<button class="eq2-t rival-bloq dorado" data-accion="bloqueada" data-clave="dineroRivales" data-rival="${esc(tid)}"><b>${icono('corona')}</b><span>su dinero ›</span></button>`
    : `<button class="eq2-t" ${ir('clausulas', 'quita')}><b>${conDinero ? dineroCorto(r.dinero) : '?'}</b><span>${conDinero ? (r.dinero.exacto ? 'su dinero, exacto' : `su dinero · ± ${eur(r.dinero.margen)} por la recompensa diaria`) : 'su dinero: no se sabe'}${rivalAbiertoHasta(tid) ? ` · hasta las ${horaDe(rivalAbiertoHasta(tid))}` : ''} ›</span></button>`;
  const teLlegan = r.fichas.filter((x) => x.abierta && x.meLlega).length;
  const tiles = [
    tDinero,
    `<button class="eq2-t" ${ir('juego', 'movs')}><b>${eur(e.valor, { dec: 1 })}</b><span>su plantilla ›</span>${dV}</button>`,
    `<button class="eq2-t" ${ir('clausulas', 'quitas')}><b>${r.abiertas}</b><span>cláusulas abiertas${r.abiertas ? `, ${teLlegan} te llega${teLlegan === 1 ? '' : 'n'}` : ''} ›</span></button>`,
    `<button class="eq2-t" ${ir('juego', 'movs')}><b>${eur(r.gastado, { dec: 1 })}</b><span>gastado en 7 días · ${r.movs} movimiento${r.movs === 1 ? '' : 's'} ›</span></button>`,
  ];
  let h = `<div class="hoja-cab rival-cab">${caraManager(e, 'g')}<h2>${esc(e.nombre)}</h2></div>
  <p class="t2 rival-sub"><span>${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${e.pos}º con ${e.puntos} puntos${premiumRivalTxt(S, tid, e)}</span><span class="amenaza ${r.nivel}" title="${esc(PELIGRO_TXT)}">Peligro ${PELIGRO[r.nivel]}</span></p>
  <p class="peligro-por">${esc(motivoPeligro(r, { quien: !bloqueada('quienPaga', tid) }))}</p>
  ${apodoRival(S, e)}
  <div class="eq2-tiles rival-tiles">${tiles.join('')}</div>
  ${notasPlan(S, { tid }).map(([et, t], n) => avisoDeTexto(S, { k: `nota${n}`, pid: `r${tid}`, cls: 'azul', ico: 'ia', t: et, texto: t })).join('')}`;
  // la jornada en directo: lo que lleva y su once, jugador a jugador (encima de las pestañas, solo con partidos)
  if (M.vivo && M.enJuego) {
    const V = M.vivo, tot = V.equipos && V.equipos[String(tid)];
    const o = S.oncesRival && S.oncesRival[tid] && S.oncesRival[tid].n === V.n ? S.oncesRival[tid] : null;
    const campo = o && o.ids ? campoVivo(M, o.ids) : '';
    h += `<div class="vivo-c"><div class="vivo-t"><span class="vivo-dot"></span><b>En directo · Jornada ${V.n}</b>${tot != null ? `<span class="vivo-tot">${tot} pts</span>` : ''}</div>
      ${campo || `<p class="t2 peq" style="margin:6px 0 0">${o ? 'LaLiga no enseña todavía su once de esta jornada.' : 'Cargando su once…'}</p>`}</div>`;
  }
  h += `<div class="tabs club-tabs rival-tabs"><div class="tabs-in" role="tablist" aria-label="Partes de la ficha del rival">${PEST_RIVAL.map(([k, txt]) => `<button data-accion="segRival" data-tid="${esc(tid)}" data-s="${k}" role="tab" aria-selected="${k === seg}" class="${k === seg ? 'activo' : ''}">${txt}</button>`).join('')}</div></div>`;
  // la subpestaña, con el selector de Clubes; en Suben y bajan, el total de toda su plantilla a la derecha
  const sb = seg === 'suben' ? subenBajanRival(r, sub) : null;
  h += `<div class="sb-cab"><div class="sb-sel" role="tablist" aria-label="${esc(PEST_RIVAL.find(([k]) => k === seg)[1])}">${SUB_RIVAL[seg].map(([k, t]) => `<button data-accion="subRival" data-tid="${esc(tid)}" data-p="${k}" role="tab" aria-selected="${k === sub}" class="${k === sub ? 'activo' : ''}">${t}</button>`).join('')}</div>
    ${sb && sb.tot != null ? `<div class="sb-tot"><b class="${clase(sb.tot)}">${sb.tot ? `${sb.tot > 0 ? '▲' : '▼'} ${eur(sb.tot, { dec: 1, signo: true })}` : '='}</b><span>entre todos ${sub === '7d' ? 'en 7 días' : 'hoy'}</span></div>` : ''}</div>`;
  const filaP = (x) => filaJugador(x, {
    sub: `${esc(x.j.equipo)} · vale ${eur(x.j.valor)}`,
    extra: `${clausulaPill(x)}${estadoPill(x.j)}${x.meLlega && x.abierta ? '<span class="pill bien">Te llega</span>' : ''}`,
    derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${x.interes != null ? barra(x.interes) : ''}</div>`, op: S.opPorPid[x.pid],
  });
  if (seg === 'plantilla') {
    if (!r.fichas.length) h += nada('No se ha podido leer su plantilla.');
    else if (sub === 'puesto') {
      for (const p of [1, 2, 3, 4, 5]) {
        const xs = r.fichas.filter((x) => x.j.pos === p).sort((a, b) => b.j.valor - a.j.valor);
        if (xs.length) h += `<div class="grupo"><span>${POS_PLURAL[p]} · ${xs.length}</span><span>${eur(xs.reduce((s, x) => s + x.j.valor, 0))}</span></div>${xs.map(filaP).join('')}`;
      }
    } else h += `<div class="grupo"><span>${r.fichas.length} jugadores · de más a menos valor</span><span>${r.abiertas} abiertas</span></div>${[...r.fichas].sort((a, b) => b.j.valor - a.j.valor).map(filaP).join('')}`;
  } else if (seg === 'suben') h += sb.h;
  else if (seg === 'clausulas' && sub === 'quitas') {
    // lo que tú le puedes quitar: las abiertas que te llegan, las que te llegarán cuando se abran y el resto
    const porAbrir = (a, b) => (a.abierta === b.abierta ? (a.abierta ? (b.interes || 0) - (a.interes || 0) : a.abreEn - b.abreEn) : a.abierta ? -1 : 1);
    const ya = r.fichas.filter((x) => x.abierta && x.meLlega).sort(porAbrir);
    const luego = r.fichas.filter((x) => !x.abierta && x.meLlega).sort(porAbrir);
    const resto = r.fichas.filter((x) => !x.meLlega).sort(porAbrir);
    const grupo = (t, xs) => (xs.length ? `<div class="grupo"><span>${t} · ${xs.length}</span><span></span></div>${xs.map(filaP).join('')}` : '');
    h += r.fichas.length ? (ya.length || luego.length ? '' : `<p class="t2 peq">Con tu dinero de ahora no te llega ninguna de sus cláusulas.</p>`) + grupo('Abiertas y te llegan', ya) + grupo('Te llegan cuando se abran', luego) + grupo('No te llegan', resto) : nada('No se ha podido leer su plantilla.');
  } else if (seg === 'clausulas') {
    // lo que él te puede quitar: su dinero (o lo que te dijo) y tus cláusulas a su alcance
    // (0.8.4o) con su dinero cerrado, solo la cifra que pusiste tú (dinero-dicho.js): la cuenta de la app, «ahora daría» y
    // la diferencia, solo con su dinero abierto
    const cerradoD = bloqueada('dineroRivales', tid), exactoD = !!(r.dinero && r.dinero.exacto), ddR = exactoD ? null : dichoDe(tid);
    if (cerradoD) cerradas.push('dineroRivales');
    h += `<div class="eq2-tiles">${cerradoD ? (ddR ? `${tileDicho(ddR)}<button type="button" class="eq2-t dd-cerr" data-accion="bloqueada" data-clave="dineroRivales" data-rival="${esc(tid)}"><b>${icono('corona')}Cerrado</b><span>su dinero en la app</span></button>` : '') : `<div class="eq2-t"><b>${r.dinero && r.dinero.v != null ? dineroCorto(r.dinero) : '?'}</b><span>${r.dinero && r.dinero.v != null ? (r.dinero.exacto ? 'su dinero, exacto' : `su dinero · ± ${eur(r.dinero.margen)} por la recompensa diaria`) : 'su dinero: no se sabe'}</span></div>`}
      <div class="eq2-t"><b>${r.paga ? pct(r.paga.med * 100) : '–'}</b><span>${r.paga ? `paga en el mercado` : 'sin compras al mercado'}</span></div></div>`;
    // si te ha dicho cuánto tiene, se apunta (la hoja «dicho»): con su dinero abierto, desde entonces sale de eso más lo que mueva
    if (!exactoD) {
      h += fichaDichoHTML(tid, { cerrado: cerradoD });
      const dc = !cerradoD && r.dinero && r.dinero.dicho, cu = dc && (M.dineroCuentaBruta || M.dineroCuenta) ? (M.dineroCuentaBruta || M.dineroCuenta)(tid) : null;
      if (dc && (dc.est != null || (cu && cu.v != null))) h += `<p class="t2 peq">${dc.est != null ? `Cuando te lo dijo, la cuenta con los movimientos daba ${eur(dc.est)} (${eur(dc.v - dc.est, { signo: true })} de diferencia).` : ''}${cu && cu.v != null && (dc.est == null || Math.abs(cu.v - dc.est) >= 1e5) ? ` Ahora daría ${eur(cu.v)}.` : ''}</p>`;
    }
    // (0.8.4o) con quién paga cerrado, su candado aunque ahora no le llegue a ninguna: «no le llega» también sale de su dinero
    if (bloqueada('quienPaga', tid)) cerradas.push('quienPaga');
    else if (r.leLlegan && r.leLlegan.length) {
      h += `<div class="grupo"><span>Tus cláusulas a su alcance · ${r.leLlegan.length}</span><span>${r.leLleganYa.length} abierta${r.leLleganYa.length === 1 ? '' : 's'}</span></div>`;
      h += r.leLlegan.map((x) => filaJugador(x, {
        sub: `Tuyo · vale ${eur(x.j.valor)}${x.blindaje && !x.blindaje.yaVale && !x.blindaje.caro ? ` · subirla a ${eur(x.blindaje.objetivo)} (${eur(x.blindaje.coste)})` : x.blindaje && x.blindaje.parcial ? ` · subirla a ${eur(x.blindaje.parcial.objetivo)} (${eur(x.blindaje.parcial.coste)})` : ''}`,
        extra: `${clausulaPill(x)}${x.abierta ? '<span class="pill mal">Te lo puede quitar ya</span>' : ''}`,
        derecha: `<div class="v">${eur(x.clausula)}</div>`, op: S.opPorPid[x.pid],
      })).join('');
    } else h += `<p class="t2 peq">Ahora no le llega para ninguna de tus cláusulas.</p>`;
  } else if (sub === 'perfil') {
    // cómo juega (función top, desde la 0.6.5)
    if (bloqueada('perfilRival')) cerradas.push('perfilRival');
    else h += perfilHTML(S, tid) || nada('Aún no hay movimientos suyos para saber cómo juega.');
  } else if (sub === 'venta') {
    // lo que tiene en el mercado y lo que le da LaLiga por cada uno (función top)
    const vs = ventasDe(M, tid);
    if (vs.length && bloqueada('ventasRivales')) cerradas.push('ventasRivales');
    else if (vs.length) {
      h += `<p class="t2 peq" style="margin:0 0 6px">Lo que se acaba sacando de LaLiga por uno así en tu liga (cada oferta suya va de −10 % a +10 %; la de hoy solo la ve él). Se lo queda quien dé más: para que te lo venda a ti, supera la de LaLiga.</p>`;
      h += vs.map((m) => {
        const ol = m.ofertaLiga, conLiga = ol && !ol.sinDatos && ol.v;
        return filaJugador(m, {
          sub: `${esc(m.j.equipo)} · vale ${eur(m.j.valor)}${m.ofertas ? ` · ${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''}` : ''}`,
          pills: [m.noVende ? `<span class="pill mal" title="${esc(`No te lo venderá: ${m.noVende}`)}">No lo venderá</span>` : '', m.miPuja ? `<span class="pill abierta">Tu oferta ${eur(m.miPuja)}</span>` : '', estadoPill(m.j)],
          derecha: `<div class="v">${conLiga ? `~${eur(ol.v, { dec: 1 })}` : '?'}</div><div class="d apag">${conLiga ? 'se saca de LaLiga' : 'sin datos'}</div>${m.ofertaMin && !m.noVende ? `<div class="d apag">ofrece ${eur(m.puja || m.ofertaMin, { dec: 1 })}</div>` : ''}`, op: S.opPorPid[m.pid],
        });
      }).join('');
    } else h += nada('No tiene a nadie en venta.');
  } else {
    // movimientos: su valor, lo que ha movido y lo que hace
    const serie = r.serie.map(([d, v]) => [Date.parse(d + 'T12:00:00'), v]);
    if (serie.length > 1) h += `<div class="sec"><h2>Su valor</h2>${r.dValor != null ? `<span class="sub ${clase(r.dValor)}">${r.dValor > 0 ? '▲ ' : r.dValor < 0 ? '▼ ' : ''}${eur(r.dValor, { signo: true, dec: 1 })} en 7 días</span>` : ''}</div>${linea(serie, { alto: 130 })}`;
    h += `<div class="eq2-tiles"><div class="eq2-t"><b>${r.movs}</b><span>movimientos en 7 días</span></div>
      <div class="eq2-t"><b>${eur(r.gastado)}</b><span>gastado en 7 días${r.ingresado ? ` · ingresó ${eur(r.ingresado, { dec: 1 })}` : ''}</span></div>
      <div class="eq2-t"><b>${r.clausulazos}</b><span>cláusulas en 14 días${r.contraMi ? `, ${r.contraMi} a ti` : ''}</span></div></div>`;
    const acts = M.actividad.filter((a) => a.quienT === tid || a.otroT === tid).slice(0, 15);
    const blinda = r.cambios.filter((m) => m.tipo === 'blinda').slice(0, 5);
    if (blinda.length || acts.length) {
      h += `<div class="sec"><h2>Lo que hace</h2></div>`;
      h += blinda.map((m) => `<div class="fila"><span class="ic-act blindaje">${icono('escudo')}</span><div class="fila-c"><div class="act-t">Subió la cláusula de <b>${esc(m.j.nombre)}</b> de ${eur(m.de)} a ${eur(m.a)}</div><div class="fila-s">${cuando(m.t)}</div></div></div>`).join('');
      h += acts.map((a) => filaActividad(a, { dentroDe: tid })).join('');
    } else h += nada('Sin movimientos en los últimos días.');
  }
  return h + candadosJuntos(cerradas, { rid: tid });
}

/* ================= ANUNCIO BONIFICADO ================= */
/** antes de ver un anuncio para desbloquear algo (de momento, otro plan de la IA cuando ya llevas 3 hoy) */
export function anuncioHTML(S, para) {
  const A = S.anuncio || {};
  if (para === 'top') return anuncioTopHTML(A, S);
  if (para === 'pregunta') return anuncioPreguntaHTML(A);
  // con la IA de la app (2 planes al día; Carlos, 14 nov): igual que las funciones top, un anuncio por cada plan de más
  if (planesApp(!!(S.D && S.D.demo))) return anuncioPlanHTML(A, cupoPlanes());
  let h = `<div class="hoja-cab"><h2>Otro plan</h2></div>`;
  h += `<p class="t2" style="margin:0 0 14px">Hoy ya le has pedido otro plan a la IA 3 veces. Para uno más, mira un anuncio corto. Mañana vuelves a tener 3 gratis, sin contar el primer plan del día.</p>`;
  if (A.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(A.error)}</div></div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="btn" data-accion="verAnuncio" data-para="${esc(para)}"${A.cargando ? ' disabled' : ''}>${A.cargando ? 'Cargando el anuncio…' : 'Ver el anuncio'}</button><button class="btn sec" data-accion="cerrarHoja">Ahora no</button></div>`;
  h += `<p class="t2 peq" style="margin-top:14px">Con los anuncios la app sigue siendo gratis. El plan automático, sin IA, no tiene límite.</p>`;
  return h;
}

/** (16 nov) preguntas de más a la IA de la app: un anuncio entero, 3 más (hasta el tope del día) */
function anuncioPreguntaHTML(A) {
  const pc = preguntasCfg(), cu = A.cupo || {};
  const g = cu.gratis ?? pc.gratis, max = cu.max ?? pc.max, por = cu.porAnuncio ?? pc.porAnuncio, usados = cu.usados ?? g;
  const q = Math.max(0, max - usados);
  let h = `<div class="bloq-hoja"><div class="hoja-cab"><span></span><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <span class="bloq-grande">${icono('ia')}</span><h2>Más preguntas a la IA</h2><p>Hoy ya has hecho tus ${usados} preguntas. Cada día tienes ${g} y, viendo un anuncio corto, ${por} más cada vez, hasta ${max}.</p>`;
  h += `<p>Mira el anuncio y la IA contesta tu pregunta. ${q ? `Hoy puedes hacer ${q === 1 ? '1 más' : `${Math.min(q, por)} más con este`}.` : ''}</p>`;
  if (A.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(A.error)}</div></div>`;
  h += `<button class="btn ancho" data-accion="verAnuncio" data-para="pregunta"${A.cargando ? ' disabled' : ''}>${A.cargando ? 'Cargando el anuncio…' : 'Ver el anuncio'}</button>
    <button class="btn ancho sec" data-accion="cerrarHoja" style="margin-top:8px">Ahora no</button>
    <p class="t2 peq" style="margin-top:14px">Tu pregunta sigue en la caja de abajo.</p></div>`;
  return h;
}

/** un plan de más con la IA de la app: un anuncio entero, uno más (hasta el tope del día). Como el candado de las top */
function anuncioPlanHTML(A, cu) {
  const g = (cu && cu.gratis) || 2, max = (cu && cu.max) || 5, usados = (cu && cu.usados) || g, q = Math.max(0, max - usados);
  let h = `<div class="bloq-hoja"><div class="hoja-cab"><span></span><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <span class="bloq-grande">${icono('ia')}</span><h2>Otro plan con la IA</h2><p>Hoy ya has hecho tus ${usados} planes con la IA. Cada día tienes ${g} y, viendo un anuncio corto, uno más cada vez, hasta ${max}.</p>`;
  h += `<p>Mira un anuncio corto y la IA te hace otro plan. Te ${q === 1 ? 'queda 1' : `quedan ${q}`} hoy.</p>`;
  if (A.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(A.error)}</div></div>`;
  h += `<button class="btn ancho" data-accion="verAnuncio" data-para="plan"${A.cargando ? ' disabled' : ''}>${A.cargando ? 'Cargando el anuncio…' : 'Ver el anuncio'}</button>
    <button class="btn ancho sec" data-accion="cerrarHoja" style="margin-top:8px">Ahora no</button>
    <p class="t2 peq" style="margin-top:14px">Mientras, el plan de la app sigue al día con tus datos, sin límite.</p></div>`;
  return h;
}

/** las funciones top: el dinero de un rival, con sus anuncios seguidos, unos minutos y unas veces por jornada; quién
    paga, con 1, unas horas; cuándo gira, con 1, hasta medianoche. El dinero sin rival (el candado de la lista): se elige */
function anuncioTopHTML(A, S) {
  const [t, x] = BLOQUEO[A.como] || BLOQUEO[A.clave] || ['Funciones top', ''];
  const rivales = POR_JORNADA.includes(A.clave), q = usosQuedan(A.clave), n = usosPorJornada(), a = anunciosPorVez(A.clave), min = minutosRival();
  const rid = A.rival != null ? String(A.rival) : null;
  const M = S && S.M, nom = (tid) => { const r = M && M.rivales.find((y) => String(y.e.teamId) === String(tid)); return r ? r.e.nombre : 'este rival'; };
  const ads = a === 1 ? 'un anuncio corto' : `<b>${a === 2 ? 'dos' : a} anuncios cortos</b>, uno detrás de otro`;
  const veces = (k) => (k === 1 ? '1 vez' : `${k} veces`);
  let h = `<div class="bloq-hoja"><div class="hoja-cab"><span></span><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <span class="bloq-grande">${icono('corona')}</span><h2>${esc(t)}</h2>${x ? `<p>${esc(x)}</p>` : ''}`;
  const yaAb = rivales ? rivalesAbiertos() : [];
  if (rivales && rid == null) {
    const rs = M ? M.rivales : [];
    h += `<p>Se abre <b>por rival</b>, ${min} minutos, con ${ads}. ${q ? `Te ${q === 1 ? 'queda 1 vez' : `quedan ${veces(q)}`} esta jornada.` : `Ya lo has abierto las ${veces(n)} de esta jornada.`}</p>`;
    h += `<div class="lista-rival-top">${rs.map((r) => {
      const ab = yaAb.includes(String(r.e.teamId));
      return `<button class="btn ancho sec" ${ab ? `data-r="${esc(r.e.teamId)}"` : q ? `data-accion="bloqueada" data-clave="${esc(A.clave)}" data-rival="${esc(r.e.teamId)}"` : 'disabled'} style="margin-top:6px">${ab ? icono('ojo') : icono('corona')}${esc(r.e.nombre)}${ab ? ' · abierto' : ''}</button>`;
    }).join('')}</div>
      ${botonInvitarTop(A.clave)}<button class="btn ancho sec" data-accion="noTop" style="margin-top:10px">Ahora no</button></div>`;
    return h;
  }
  if (rivales && !q && !yaAb.includes(rid)) {
    h += `<p><b>Ya has visto el dinero de un rival las ${veces(n)} de esta jornada.</b> En la siguiente puedes volver a abrirlo.</p>
      ${botonInvitarTop(A.clave)}<button class="btn ancho sec" data-accion="noTop" style="margin-top:8px">Entendido</button></div>`;
    return h;
  }
  const faltan = faltanAnuncios(A.clave, rid), parteT = A.clave === 'parteRivales';
  if (rivales && faltan >= a) h += `<p>Mira el dinero de <b>${esc(nom(rid))}</b> durante ${min} minutos viendo ${ads}. Puedes hacerlo ${veces(n)} por jornada: te ${q === 1 ? 'queda 1' : `quedan ${q}`}.</p>`;
  else if (rivales) h += `<p><b>Llevas ${a - faltan} de ${a}.</b> ${faltan === 1 ? 'Mira el último' : `Te faltan ${faltan}`} y verás el dinero de ${esc(nom(rid))} ${min} minutos.</p>`;
  else if (A.clave === 'quienPaga') h += `<p>Mira un anuncio corto y se abre <b>${horasQuien()} horas</b>.</p>`;
  // (0.8.5a) hasta que empiece la jornada, con la hora; sin saberla, 24 horas
  else if (parteT && faltan >= a) h += `<p>Mira ${ads}${a > 1 ? ',' : ''} y se abre ${parteFin() ? `hasta que empiece la jornada (<b>${esc(cuando(parteFin()))}</b>)` : '<b>24 horas</b>'}.</p>`;
  else if (parteT) h += `<p><b>Llevas ${a - faltan} de ${a}.</b> ${faltan === 1 ? 'Mira el último' : `Te faltan ${faltan}`} y se abre ${parteFin() ? `hasta que empiece la jornada (${esc(cuando(parteFin()))})` : '24 horas'}.</p>`;
  else h += `<p>Mira un anuncio corto y se abre <b>hasta medianoche</b>.</p>`;
  if (A.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(A.error)}</div></div>`;
  const txt = A.cargando ? 'Cargando el anuncio…' : (rivales || parteT) && a > 1 ? `Ver el anuncio (${a - faltan + 1} de ${a})` : 'Ver el anuncio';
  h += `<button class="btn ancho" data-accion="verAnuncio" data-para="top"${A.cargando ? ' disabled' : ''}>${txt}</button>
    ${rivales ? botonInvitarTop(A.clave) : ''}<button class="btn ancho sec" data-accion="noTop" style="margin-top:8px">Ahora no</button></div>`;
  return h;
}

/* ================= INVITA A UN AMIGO (19 nov) ================= */
/** en la ventana del candado del dinero: invita a un amigo y elige 2 rivales (o, si ya tienes, que te quedan por elegir) */
export function botonInvitarTop(clave) {
  if (clave !== 'dineroRivales' || enDemo() || !sesion() || !invitarOn()) return '';
  const pe = porElegir(), c = cfgInv();
  return `<div class="inv-top">${pe.length ? `<b>Tienes rivales por elegir de tus invitaciones</b>` : `<span>O invita a un amigo: por cada uno que entre, el dinero de ${c.rivales} rivales que elijas, ${c.horas} h.</span>`}
    <button class="btn ancho sec" data-accion="invitarAmigo" style="margin-top:6px">${icono('estrella')}${pe.length ? 'Elegir rivales' : 'Invita a un amigo'}</button></div>`;
}
/** lo que se gana, en una línea por premio (con los números del servidor) */
function premiosInvTxt(c) {
  const e = c.escalones.map((x) => `<li><b>Con ${x.n} amigos</b> que vuelvan otro día: ${esc((PREMIO_TXT[x.premio] || (() => ''))(x.dias))}.</li>`).join('');
  return `<ul class="inv-premios"><li><b>Por cada amigo</b> que entre: el dinero de ${c.rivales} rivales que elijas, ${c.horas} h desde que entra.</li>${e}</ul>`;
}
/** la ventana de invitar: tu código y el botón de compartir, el contador, los rivales por elegir y «¿Te ha invitado alguien?» */
export function invitarHTML(S) {
  const I = S.inv || {}, uid = S.D && S.D.yo && S.D.yo.userId, e = estadoInv(uid), c = cfgInv();
  const liga = S.D && S.D.liga && S.D.liga.id;
  let h = `<div class="hoja-cab"><h2>Invita a un amigo</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div><div class="inv">`;
  if (enDemo() || !uid) return `${h}<p>Entra con tu cuenta de LaLiga para invitar a tus amigos.</p></div>`;
  if (!invitarOn()) return `${h}<p>Las invitaciones están paradas ahora. Vuelve a mirarlo en unos días.</p></div>`;
  if (!e && I.cargando) return `${h}<p class="t2">Cargando…</p></div>`;
  if (!e) return `${h}<p>No se ha podido cargar ahora.${I.error ? ` ${esc(I.error)}` : ''}</p><button class="btn ancho" data-accion="invitarAmigo">Volver a probar</button></div>`;
  // ¿te ha invitado alguien? (cuenta nueva, sus primeros días)
  if (puedeCanjear(uid)) {
    h += `<div class="inv-canjear"><b>¿Te ha invitado alguien?</b><span>Mete el código de quien te ha pasado la app${e.canjearHasta ? ` (hasta el ${esc(cuando(e.canjearHasta, { hora: false }))})` : ''}.</span>
      <div class="codigo-in"><input id="invCod" maxlength="8" placeholder="ABC234" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="canjearInv" value="${esc(I.cod || '')}" aria-label="Código de quien te invita"><button class="btn" data-accion="canjearInv"${I.canjeando ? ' disabled' : ''}>${I.canjeando ? 'Un momento…' : 'Listo'}</button></div>
      ${I.errorCod ? `<p class="codigo-err" role="alert">${esc(I.errorCod)}</p>` : ''}</div>`;
  }
  h += `<p>Pásale la app a quien juegue a LaLiga Fantasy. Ganas tú:</p>${premiosInvTxt(c)}
    <p class="t2 peq">Cuentan las cuentas que empiezan a usar la app con tu enlace o tu código.</p>`;
  h += `<button class="btn ancho" data-accion="compartirInv"${I.compartiendo ? ' disabled' : ''}>${icono('enviar')}${I.compartiendo ? 'Un momento…' : 'Invita a un amigo'}</button>`;
  // (25 nov) el código, grande y con lo que tiene que hacer el amigo con él (desde Google Play el enlace no llega)
  if (e.cod) h += `<div class="inv-tucod"><span>Tu código</span><b>${esc(e.cod)}</b><span>Tu amigo lo pone al entrar en la app, cuando le pregunta si le ha invitado alguien.</span>
    <div class="inv-tucod-b"><button class="btn chico sec" data-accion="copiarCod">${icono('copiar')}Copiar código</button><button class="btn chico sec" data-accion="copiarInv">${icono('copiar')}Copiar enlace</button></div></div>`;
  // el contador y los premios que tienes
  const ct = contadorTxt(e);
  h += `<div class="inv-cuenta"><b>${e.entran === 1 ? '1 amigo ha entrado' : `${e.entran || 0} amigos han entrado`}</b>${e.entran ? `<span>${e.cuentan === 1 ? '1 ha vuelto otro día' : `${e.cuentan || 0} han vuelto otro día`}</span>` : ''}${ct ? `<span>${esc(ct)}</span>` : ''}</div>`;
  for (const p of ['doble', 'sinIntersticiales']) {
    const hasta = premioHasta(p);
    if (hasta) h += `<div class="aviso-ficha oro">${icono('estrella')}<div><b>${p === 'doble' ? 'Semana doble' : 'Sin anuncios a pantalla completa'}</b> hasta el ${esc(cuando(hasta))}.</div></div>`;
  }
  // los rivales por elegir (en esta liga) y los ya abiertos
  const rivs = ((S.D && S.D.clasif) || []).filter((x) => x && String(x.teamId) !== String(S.D.yo && S.D.yo.teamId)).sort((a, b) => (a.pos || 99) - (b.pos || 99));
  const abiertos = rivalesInvitados(liga);
  const pend = porElegir().filter((x) => !x.liga || String(x.liga) === String(liga));
  for (const x of pend) {
    const sel = (I.sel && I.sel[x.i]) || [];
    h += `<div class="inv-elegir"><b>Tu amigo ya ha entrado: elige ${x.quedan === 1 ? '1 rival' : `${x.quedan} rivales`}</b><span>Verás su dinero hasta ${esc(cuando(x.hasta))} (${cuenta(x.hasta)}).</span>
      <div class="inv-rivales">${rivs.map((r) => {
        const t = String(r.teamId), ya = (abiertos[t] || 0) > Date.now(), on = sel.includes(t);
        return `<button class="pill${on ? ' on' : ''}" ${ya ? 'disabled' : `data-accion="invElegir" data-i="${x.i}" data-tid="${esc(t)}"`} aria-pressed="${on}">${esc(r.nombre)}${ya ? ' · abierto' : ''}</button>`;
      }).join('')}</div>
      <button class="btn ancho" data-accion="invAbrir" data-i="${x.i}"${sel.length && !I.abriendo ? '' : ' disabled'}>${I.abriendo ? 'Abriendo…' : sel.length ? `Abrir su dinero (${sel.length})` : 'Elige rivales'}</button></div>`;
  }
  const ab = Object.entries(abiertos).filter(([, t]) => t > Date.now());
  if (ab.length) {
    const nom = (tid) => { const r = rivs.find((y) => String(y.teamId) === tid); return r ? r.nombre : 'Un rival'; };
    h += `<div class="aj-sub">Abiertos por tus invitaciones</div>${ab.map(([t, hasta]) => `<div class="ajuste"><div class="c"><b>${esc(nom(t))}</b><span>Su dinero, hasta ${esc(cuando(hasta))}</span></div><button class="btn chico sec" data-r="${esc(t)}">Ver</button></div>`).join('')}`;
  }
  if (I.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(I.error)}</div></div>`;
  return `${h}</div>`;
}
/** (25 nov) la ventana para quien acaba de entrar: solo meter el código de quien le invitó, sin lo de invitar a otros
    (antes era la misma de «Invita a un amigo» con el código arriba, y se cerraba sin leerla). Sale sola una vez
    (`invitarSiToca`), desde la banda de arriba y desde Ajustes, mientras la cuenta puede canjear */
export function invitadoHTML(S) {
  const I = S.inv || {}, uid = S.D && S.D.yo && S.D.yo.userId, e = estadoInv(uid);
  // (25 nov) con el código que propone el servidor (abrió el enlace desde esta conexión hace poco), ya puesto
  const pr = I.propuesto && I.cod === I.propuesto;
  const cab = `<div class="hoja-cab"><h2>${pr ? 'Tu amigo te ha invitado' : '¿Te ha invitado un amigo?'}</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (!uid || !puedeCanjear(uid)) return `${cab}<div class="inv"><p>Ya está: esta cuenta no tiene que poner ningún código.</p><button class="btn ancho" data-accion="cerrarHoja">Vale</button></div>`;
  return `${cab}<div class="inv invitado">
    <p>${pr ? 'Abriste su enlace hace un rato: su código ya está puesto. Dale a «Listo».' : 'Si alguien te ha pasado Fantasy Manager, pon su código. Son 6 letras y números y te lo habrá mandado con el enlace.'}</p>
    <div class="codigo-in grande"><input id="invCod" maxlength="8" placeholder="ABC234" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="canjearInv" value="${esc(I.cod || '')}" aria-label="Código de quien te invita"></div>
    ${I.errorCod ? `<p class="codigo-err" role="alert">${esc(I.errorCod)}</p>` : ''}
    <button class="btn ancho" data-accion="canjearInv"${I.canjeando ? ' disabled' : ''}>${I.canjeando ? 'Un momento…' : 'Listo'}</button>
    <p class="t2 peq">A ti no te cuesta nada y a tu amigo le das una ayuda en su liga.${e && e.canjearHasta ? ` Puedes ponerlo hasta el ${esc(cuando(e.canjearHasta, { hora: false }))}.` : ''}</p>
    <button class="btn ancho sec" data-accion="invitadoNo">Nadie, la he encontrado yo</button></div>`;
}

/* ================= AJUSTES ================= */
/*
 * (40, 10 nov) Ajustes en secciones plegables (<details>: título y una línea a la vista, sin botones en el summary) con un
 * buscador arriba. Antes era una lista plana de ~30 filas y costaba encontrar las cosas. Lo abierto se guarda en
 * S.ajAbiertas para no cerrarlo al repintar; lo que se busca, en S.ajBusca (filtrarAjustes hace lo mismo sin repintar).
 */
const interr = (on, accion, extra = '', nombre = '') => `<button class="interr ${on ? 'on' : ''}" data-accion="${accion}" ${extra} aria-pressed="${on}"${nombre ? ` aria-label="${esc(nombre)}"` : ''}></button>`;
const btnA = (accion, txt, { sec = true, extra = '', ic = '' } = {}) => `<button class="btn chico${sec ? ' sec' : ''}" data-accion="${accion}" ${extra}>${ic ? icono(ic) : ''}${txt}</button>`;
const enlA = (href, txt) => `<a class="btn chico sec" href="${href}">${txt}</a>`;
/** una fila: título, una línea corta y lo de la derecha. q: palabras de más para el buscador */
const fila = (t, s, der = '', q = '', cls = '') => `<div class="ajuste${cls ? ` ${cls}` : ''}" data-q="${esc(norm(`${t} ${s} ${q}`.replace(/<[^>]+>/g, ' ')))}"><div class="c"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div>${der}</div>`;
const selA = (cambia, opts, val, nombre, extra = '') => `<select data-cambia="${cambia}" aria-label="${esc(nombre)}" ${extra}>${opts.map(([v, t]) => `<option value="${esc(v)}"${String(val) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
const antesOpts = (k) => OPC_ANTES[k].map((m) => [m, antesTxt(m)]);

/* (0.7.13l) los dos planes que salen solos y a qué hora: «Al refrescar el mercado» (10 min después) y «12 h después»,
   o la que elija, de media en media hora */
const OPC_HORA = Array.from({ length: 48 }, (_, i) => { const t = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`; return [t, t]; });
function filasHorasPlan(S, pApp) {
  const c = cfgHoras(), hs = horasPlan(S.M), def = horasDefecto(S.M);
  // (0.7.13n) la de cada liga: 10 minutos después de que se refresque SU mercado
  const d1 = def ? `${def[0]}, 10 min después de que se refresque el mercado de tu liga` : '10 min después de que se refresque el mercado de tu liga';
  const d2 = def ? `${def[1]}, 12 h después` : '12 h después del primero';
  // (25 nov) en la app de iOS no hay pasadas con la app cerrada: salen a su hora con la app abierta y, si no, al abrirla
  const sinFondo = enApp && !nativo.hayFondo();
  const sub = !c.on ? 'Apagado: solo cuando lo pidas' : `${hs.length === 2 ? `A las ${hs[0].txt} y a las ${hs[1].txt}${pApp ? ' · cuentan en los del día' : ''}` : 'Al refrescarse el mercado de tu liga y 12 h después'}${sinFondo ? ' · con la app cerrada, al abrirla' : ''}`;
  let h = fila('Planes que salen solos', sub, interr(c.on, 'planesHora', '', 'Planes que salen solos'), 'plan automatico hora horas');
  if (c.on) {
    h += fila('Primer plan', `Por defecto, ${d1}`, selA('planH1', [['', def ? `${def[0]} (mercado)` : 'Con el mercado'], ...OPC_HORA], c.h1 || '', 'Hora del primer plan'), 'plan hora');
    h += fila('Segundo plan', `Por defecto, ${d2}`, selA('planH2', [['', def ? `${def[1]} (+12 h)` : '+12 h'], ...OPC_HORA], c.h2 || '', 'Hora del segundo plan'), 'plan hora');
  }
  return h;
}
/** los ajustes del plan, desde el plan: el tono, a qué horas sale solo y rehacerlo ya */
export function planAjustesHTML(S) {
  const ci = cfgIA(), pApp = planesApp(enDemo()), cu = pApp ? cupoPlanes() : null;
  let h = `<div class="hoja-cab"><h2>Tu plan</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  h += `<div class="plan-aj">`;
  h += fila('Pullitas', 'El tono del plan: bromas que nunca deciden nada', selA('pullitas', [['no', 'Sin pullitas'], ['suave', 'Suaves'], ['normal', 'Normales'], ['saco', 'A saco']], ci.pullitas || 'normal', 'Pullitas de la IA'));
  h += filasHorasPlan(S, pApp);
  h += `</div>`;
  if (cu && !cu.ilimitado) h += `<p class="t2 peq" style="margin:6px 2px 0">${cu.quedan > 0 ? (cu.quedan === 1 ? 'Hoy te queda 1 plan con la IA.' : `Hoy te quedan ${cu.quedan} planes con la IA.`) : 'Hoy ya no te quedan planes con la IA.'}</p>`;
  h += `<button class="btn ancho" style="margin-top:14px" data-accion="planYa">${icono('ia')}Rehacer el plan ahora</button>`;
  // (0.7.13n, Carlos 16 nov) sin imagen ni «Compartir»: en su lugar, cuántos planes hay gratis
  // (25 nov, hallazgo 6) la cifra, la de planesCfg (en la web y el iPhone son los de «gratisWeb»); los de más con un anuncio,
  // solo en la de Google Play
  if (pApp) {
    const pc = planesCfg(), conAd = enApp && ['play', 'ios'].includes(nativo.canal()) && pc.max > pc.gratis;
    const ord = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'][pc.gratis] || `${pc.gratis + 1}.º`;
    h += `<p class="plan-cupo">${icono('info')}<span>Fantasy Manager te da <b>${pc.gratis === 1 ? '1 plan gratis' : `${pc.gratis} planes gratis`}</b> cada día${conAd ? `. A partir del ${ord}, cada uno con un anuncio` : ''}.</span></p>`;
  }
  return h;
}

/** lo que busca: las filas que no casan se esconden y se abren las secciones que tienen alguna */
export function filtrarAjustes(raiz, q) {
  const b = norm(String(q || '').trim());
  let hay = 0;
  raiz.querySelectorAll('details.aj-sec').forEach((d) => {
    let n = 0;
    d.querySelectorAll('.ajuste[data-q]').forEach((f) => { const ok = !b || f.dataset.q.includes(b) || norm(d.dataset.t || '').includes(b); f.hidden = !ok; if (ok) n++; });
    d.hidden = !!b && !n;
    if (b) d.open = n > 0;
    else d.open = !!(window.S && window.S.ajAbiertas && window.S.ajAbiertas[d.dataset.k]);
    hay += n;
  });
  const v = raiz.querySelector('#aj-nada');
  if (v) { v.hidden = !b || hay > 0; v.textContent = b && !hay ? `Nada con «${String(q).trim()}». Prueba con otra palabra (avisos, clave, versión, borrar…).` : ''; }
}
export function plegarAjuste(S, k, abierto) { S.ajAbiertas ||= {}; if (abierto) S.ajAbiertas[k] = 1; else delete S.ajAbiertas[k]; }

export function ajustes(S) {
  const ca = cfgAvisos(), ci = cfgIA();
  const q = quien();
  const ses = sesion();
  const k = clave();
  const prog = programados();
  const abiertas = S.ajAbiertas || {};
  const dueno = avisosGuardados().admin;
  let h = `<div class="hoja-cab"><h2>Ajustes</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  // el buscador; debajo, avisar de un fallo y el tutorial (lo del fallo va arriba desde el 25 oct, lo pidió Carlos)
  h += `<div class="aj-busca">${icono('buscar')}<input id="buscaAj" type="search" placeholder="Buscar en Ajustes" aria-label="Buscar en Ajustes" autocomplete="off" value="${esc(S.ajBusca || '')}"></div>`;
  {
    const av = avisosGuardados();
    const sinLeer = (av.lista || []).filter((x) => x.respuesta && !x.vista).length;
    // (0.8.4) quien ayuda con los fallos ve los de todos, como el dueño, y desde la 0.8.4c también los contesta
    const ve = av.admin || av.ve;
    const pend = ve ? av.pendientes || 0 : 0;
    const n = sinLeer + pend;
    const sub = av.admin ? (pend ? `${pend} sin contestar` : 'Los de tu liga') : av.ve ? (pend ? `${pend} sin contestar` : sinLeer ? `${sinLeer} respuesta${sinLeer === 1 ? '' : 's'} sin leer` : 'Los de todos y reportar uno') : sinLeer ? `${sinLeer} respuesta${sinLeer === 1 ? '' : 's'} sin leer` : 'Te contesto aquí';
    h += `<div class="aj-atajos"><button class="aj-atajo" data-accion="avisos">${icono('bicho')}<span><b>${ve ? 'Avisos de fallo' : 'Reportar un fallo o una idea'}</b><small>${esc(sub)}</small></span>${n ? `<em class="gl-aj">${n}</em>` : ''}</button>`
      + `<button class="aj-atajo" data-accion="tutorial">${icono('info')}<span><b>Tutorial</b><small>En un minuto</small></span></button></div>`;
  }

  // el tema de evento, a la vista y fuera de las secciones (13 nov, lo pidió Carlos); sin TEMA_EVENTO no sale
  if (window.temaEvento) {
    const on = window.temaEvento.activo();
    h += `<div class="ajuste aj-tema" id="aj-tema"><span class="aj-tema-ic" aria-hidden="true"></span><div class="c"><b>Modo Vice City</b><span>${on ? 'Puesto' : 'Quitado'} · hasta el 26 nov; el 27 vuelve solo el rojo y negro</span></div>${interr(on, 'temaEvento', '', 'Modo Vice City')}</div>`;
  }

  const sec = (kk, ic, t, l, cuerpo, qx = '') => (cuerpo ? `<details class="aj-sec" data-k="${kk}" data-t="${esc(`${t} ${qx}`)}"${abiertas[kk] ? ' open' : ''}><summary data-accion="plegarAjuste" data-k="${kk}">${icono(ic)}<span class="aj-tx"><b>${t}</b><span>${esc(l)}</span></span>${icono('abajo', 'av-fl')}</summary><div class="aj-cuerpo">${cuerpo}</div></details>` : '');

  /* ---- cuenta y liga ---- */
  let c1 = '';
  const nombreCta = enDemo() ? 'Liga de ejemplo' : (q && (q.nombre || q.correo)) || 'Conectado';
  if (enDemo()) c1 += fila('Liga de ejemplo', 'Los datos son inventados', enApp || enWeb ? btnA('salirDemo', 'Usar la mía', { sec: false }) : '', 'cuenta sesion');
  else c1 += fila(esc(nombreCta), `${esc(q && q.correo ? q.correo : '')}${ses && ses.desde ? ` · desde ${cuando(ses.desde, { hora: false })}` : ''}`, btnA('salir', 'Salir', { ic: 'salir' }), 'cuenta sesion cerrar');
  if (S.D && S.D.ligas && S.D.ligas.length > 1) c1 += fila('Liga', 'La que ves en la app', selA('liga', S.D.ligas.map((l) => [l.id, l.nombre]), S.D.liga.id, 'Liga'));
  // la misma liga en el ordenador: la app deja la sesión con un código de un solo uso (y en la 0.6.12, el QR)
  if ((enApp || enWeb) && !enDemo() && ses) {
    const qr = enApp && nativo.hayQR();
    c1 += fila(enApp ? 'Abrir en el ordenador' : 'Abrir en otro dispositivo', qr ? 'El QR de «Ya tengo la app», en la web. El código, para el iPhone' : 'Con un código de un solo uso, sin el F12',
      qr ? `<span class="aj-2">${btnA('escanearQR', 'QR', { sec: false })}${btnA('vincularWeb', 'Código')}</span>` : btnA('vincularWeb', 'Código', { sec: false }), 'ordenador iphone vincular qr codigo web');
  }
  if (enIPhone && !enApp && !enInicio()) c1 += fila('Tenerla como una app', 'Safari: Compartir → Añadir a pantalla de inicio', '<a class="btn chico sec" href="instalar.html#anadir" target="_blank" rel="noopener">Cómo</a>', 'iphone instalar icono');
  if (!enDemo() && ses) c1 += fila('Invitar a tu liga', 'Un enlace para el grupo', btnA('invitar', 'Invitar', { sec: false, ic: 'enviar' }), 'compartir amigos grupo');
  // (19 nov) invita a un amigo: lo que ganas y, a una cuenta nueva, «¿Te ha invitado alguien?»
  if (!enDemo() && ses && invitarOn()) {
    const uid = S.D && S.D.yo && S.D.yo.userId, ei = estadoInv(uid), ct = ei && contadorTxt(ei), pe = porElegir().length;
    if (puedeCanjear(uid)) c1 += fila('¿Te ha invitado alguien?', 'Pon el código de quien te pasó la app', btnA('ponerCodigo', 'Poner código', { sec: false }), 'codigo invitacion amigo');
    c1 += fila('Invita a un amigo', pe ? `<b>Tienes rivales por elegir</b>` : ct ? esc(ct) : 'Por cada amigo que entra, el dinero de 2 rivales', btnA('invitarAmigo', 'Invitar', { sec: false, ic: 'estrella' }), 'invitar amigo referido premio codigo rivales dinero semana doble anuncios');
  }
  h += sec('cuenta', 'usuario', 'Cuenta y liga', enDemo() ? 'Datos inventados' : `${nombreCta}${S.D && S.D.liga && S.D.liga.nombre ? ` · ${S.D.liga.nombre}` : ''}`, c1, 'sesion');
  /* ---- (0.8a) apodos de los rivales ---- */
  if (S.D && Array.isArray(S.D.clasif)) {
    const yo = S.D.yo && S.D.yo.teamId, ap = apodosLiga();
    const rivs = S.D.clasif.filter((x) => x && x.teamId !== yo).sort((a, b) => (a.pos || 99) - (b.pos || 99));
    if (rivs.length) {
      const puestos = rivs.filter((x) => listaApodos(ap[String(x.teamId)]).length).length;
      let c9 = '<p class="apo-nota">Ponle a cada rival el nombre con el que lo llamáis. Al preguntar a la IA, por escrito o con la voz, vale su nombre de LaLiga, el de su equipo o el apodo. Solo los ves tú, en todos los dispositivos donde entres con tu cuenta.</p>';
      for (const x of rivs) {
        const v = listaApodos(ap[String(x.teamId)]).join(', ');
        c9 += `<div class="ajuste apo-fila" data-q="${esc(norm(`apodo mote ${x.nombre} ${x.manager} ${v}`))}">${caraManager(x)}<div class="c"><b>${esc(x.nombre)}</b><span>${esc(x.manager && x.manager !== x.nombre ? `${x.manager} · ` : '')}${x.pos}º</span></div><input class="${v ? 'lleno' : ''}" data-cambia="apodo" data-tid="${esc(x.teamId)}" value="${esc(v)}" placeholder="Apodo" maxlength="120" autocomplete="off" enterkeyhint="done" aria-label="Apodo de ${esc(x.nombre)}"></div>`;
      }
      h += sec('apodos', 'rivales', 'Apodos de los rivales', `${puestos ? `${puestos} puesto${puestos === 1 ? '' : 's'}` : 'Ninguno puesto'} · para la IA y la voz`, c9, 'apodo mote nombre rival voz');
    }
  }

  /* ---- avisos y alarmas ---- */
  let c2 = '';
  let l2;
  if (!enApp) {
    l2 = 'Solo en la app del móvil';
    c2 += fila('Los avisos llegan en la app', 'Cláusulas que se abren, el mercado, el once y tus alarmas. En el navegador no', '', 'notificaciones alarmas');
  } else {
    const perm = nativo.avisosPermitidos(), nj = Object.keys(ca.jugadores).length;
    // con la liga de ejemplo no se programa nada (serían datos inventados): programar() lo deja vacío
    const cuantos = enDemo() ? 'Con la liga de ejemplo no se programan' : `${prog.length} programado${prog.length === 1 ? '' : 's'}`;
    l2 = !ca.on ? 'Apagados' : !perm ? 'Falta el permiso de notificaciones' : `${enDemo() ? 'Encendidos' : cuantos}${nj ? ` · ${nj} jugador${nj === 1 ? '' : 'es'}` : ''}`;
    c2 += fila('Avisos', ca.on ? (perm ? cuantos : '<b class="rojo">Falta el permiso de notificaciones</b>') : 'Apagados', interr(ca.on, 'avisosOn', '', 'Avisos'), `notificaciones activar${ca.on ? '' : ' alarmas once clausulas rivales mercado jugadores plan'}`);
    if (ca.on) {
      if (!nativo.alarmasExactas()) c2 += fila('Al minuto exacto', 'Sin este permiso pueden llegar tarde', btnA('exactas', 'Dar permiso', { sec: false }), 'permiso exactas');
      // cada tipo: el interruptor y, encendido, cuánto antes
      const tipo = (kk, t, s, qx = '', conAntes = true) => fila(t, s,
        `${ca[kk] && conAntes ? selA('avisoAntes', antesOpts(kk), ca.antes[kk], `${t}: cuándo`, `data-k="${kk}"`) : ''}${interr(ca[kk], 'avisoTipo', `data-k="${kk}"`, t)}`, qx);
      c2 += tipo('plan', 'Clausulazos del plan', '', 'alarma plan clausular cuando se abre la clausula');
      if (ca.plan && nativo.hayAlarma()) c2 += fila('Que suene como alarma', 'Aunque estés en silencio', interr(ca.alarma, 'avisoTipo', 'data-k="alarma"', 'Que suene como alarma'), 'sonido silencio plan jugadores', 'sub');
      c2 += tipo('rivales', 'Cláusulas de rivales', 'Y al abrirse', 'clausula rival');
      if (ca.rivales) c2 += fila('Interés mínimo', 'Solo las que te interesan', selA('interes', [30, 40, 50, 55, 60, 70, 80].map((n) => [n, n]), ca.interes, 'Interés mínimo'), 'interes umbral rivales', 'sub');
      c2 += tipo('mias', 'Tus cláusulas', '', 'mis clausulas proteccion blindar se abren');
      if (ca.mias) c2 += fila('De cuáles', 'Baratas: menos de 1,6 veces su valor', selA('miasCuales', [['baratas', 'Las baratas'], ['todas', 'Todas']], ca.miasTodas ? 'todas' : 'baratas', 'De cuáles de tus cláusulas'), 'mis clausulas todas', 'sub');
      c2 += tipo('mercado', 'Cambio de mercado', '', 'mercado pujas ofertas');
      // (41) lo que pasa al cambiar el mercado: con la app cerrada, cuando trabaja sola (Ajustes → La IA)
      // (25 nov) en la app de iOS no hay pasadas con la app cerrada: se miran al abrirla
      c2 += tipo('pujas', 'Pujas que ganas o pierdes', nativo.hayFondo() ? 'Al cambiar el mercado' : 'Al abrir la app tras el cambio de mercado', 'mercado pujas ganada perdida', false);
      c2 += tipo('enMercado', 'Te interesan y salen al mercado', nativo.hayFondo() ? 'Tus favoritos y los de interés alto' : 'Tus favoritos y los de interés alto, al abrir la app', 'mercado favoritos interes sale venta', false);
      // (27 nov) el parte de los rivales con la app cerrada: solo donde la app trabaja cerrada (Android)
      if (nativo.hayFondo()) c2 += tipo('parte', 'Parte de los rivales', 'Con el parte abierto: quién se queda en negativo o sin blindajes', 'parte rivales negativo blindajes corto', false);
      c2 += tipo('jornada', 'Poner el once', 'Antes de la jornada', 'once alineacion jornada recordatorio');
      c2 += fila('Tu liga hoy', 'Un aviso al día', `${ca.diario ? `<input type="time" value="${esc(ca.hora)}" data-cambia="horaAviso" aria-label="Hora del aviso diario">` : ''}${interr(ca.diario, 'avisoTipo', 'data-k="diario"', 'Tu liga hoy')}`, 'diario plan del dia hora');
      // «Avisarme de este jugador» (desde la ficha): cada uno con cuándo y para quitarlo
      const js = Object.entries(ca.jugadores);
      c2 += `<div class="aj-sub" data-q="${esc(norm('mis avisos jugadores avisarme'))}">Tus jugadores</div>`;
      if (!js.length) c2 += fila('Ninguno todavía', 'En la ficha de un jugador de un rival: «Avisarme»', '', 'mis avisos jugadores avisarme');
      for (const [pid, a] of js) {
        const x = S.M && S.M.clausulas.find((y) => y.pid === pid);
        const nom = (S.M && S.M.J(pid) && S.M.J(pid).nombre) || a.nombre || 'Jugador';
        const est = !x ? 'Ahora no es de ningún rival' : x.abierta ? 'Cláusula abierta ya' : `Se abre ${cuando(x.veda ? x.veda.abre : x.protegidoHasta)}`;
        c2 += fila(esc(nom), esc(est), `${selA('avisoJ', antesOpts('jugador'), a.antes, `Aviso de ${nom}: cuándo`, `data-pid="${esc(pid)}"`)}<button class="b-ico aj-quitar" data-accion="quitarAvisoJ" data-pid="${esc(pid)}" aria-label="Quitar el aviso de ${esc(nom)}">${icono('cerrar')}</button>`, 'mis avisos jugadores avisarme');
      }
      const prox = prog.filter((a) => a.id !== 'diario').slice(0, 4);
      if (prox.length) c2 += `<p class="aj-prox" data-q="${esc(norm('proximos programados'))}"><b>Próximos:</b> ${prox.map((a) => `${esc(a.titulo)} (${cuando(a.t)})`).join(' · ')}</p>`;
      c2 += `<div class="aj-btns">${btnA('probarAviso', 'Probar un aviso')}${ca.alarma && nativo.hayAlarma() ? btnA('probarAlarma', 'Probar la alarma') : ''}</div>`;
    }
  }
  h += sec('avisos', 'campana', 'Avisos y alarmas', l2, c2, 'notificaciones');

  /* ---- la IA ---- */
  let c3 = '';
  // (14 nov) el plan del día, con la IA de la app: la clave queda para preguntar
  const pApp = planesApp(enDemo()), pc = planesCfg(), cuP = pApp ? cupoPlanes() : null;
  if (pApp) c3 += fila('Planes del día con la IA', `${pc.gratis} al día, sin clave${topConAnuncio() ? `; más viendo un anuncio, hasta ${pc.max}` : ''}${cuP ? ` · ${cuP.ilimitado ? 'sin límite' : cuP.quedan === 1 ? 'te queda 1 hoy' : `te quedan ${cuP.quedan} hoy`}` : ''}`, '', 'plan planes ia app');
  // (16 nov) las preguntas del chat, también con la IA de la app: la clave queda de reserva
  const qApp = preguntasApp(enDemo()), qc = preguntasCfg(), cuQ = qApp ? cupoPreguntas() : null;
  if (qApp) c3 += fila('Preguntas a la IA', `${qc.gratis} al día, sin clave${topConAnuncio() ? `; ${qc.porAnuncio} más por anuncio, hasta ${qc.max}` : ''}${cuQ ? ` · ${cuQ.ilimitado ? 'sin límite' : cuQ.quedan === 1 ? 'te queda 1 hoy' : `te quedan ${cuQ.quedan} hoy`}` : ''}`, '', 'preguntas chat ia app');
  // (iOS 3) en la app de iOS no hay clave de Google; en su lugar, el permiso para mandar tu liga a la IA
  const permIA = enAppIos() ? permisoIA() : null;
  if (permIA !== null) c3 += fila('Mandar tu liga a la IA', permIA === 'si' ? 'Sí: para el plan con la IA y tus preguntas (los rivales, con otro nombre)' : permIA === 'no' ? 'No: no se manda nada y el plan sale sin la IA' : 'Se te pregunta antes del primer plan o pregunta', permIA === 'si' ? btnA('quitarPermisoIA', 'Apagar') : btnA('permisoIA', 'Activar', { sec: false }), 'permiso privacidad datos ia');
  else c3 += fila('Clave de Google AI Studio', k ? `${esc(k.slice(0, 6))}…${esc(k.slice(-4))}` : qApp ? 'Sin clave (no hace falta): de reserva si la IA de la app falla' : pApp ? 'Sin clave: para preguntarle a la IA' : 'Sin clave: el plan sale sin noticias', k ? btnA('borrarClave', 'Quitar') : btnA('irIA', 'Poner', { sec: false }), 'gemini api key');
  if (enApp && !enDemo() && nativo.hayFondo()) {
    const cf = cfgFondo(), uf = ultimoFondo();
    const ult = uf ? `${uf.error ? 'Falló' : 'Última'} ${cuando(uf.t)}` : 'Aún no ha trabajado sola';
    c3 += fila('Con la app cerrada', cf.on ? `Cada 3 h, al cambiar el mercado y a la hora de tus planes. ${!nativo.avisosPermitidos() ? '<b class="rojo">Falta el permiso de notificaciones.</b> ' : ''}${esc(ult)}` : 'Apagado: solo al abrir la app', interr(cf.on, 'fondo', '', 'Trabajar con la app cerrada'), 'segundo plano fondo trabaja sola');
  }
  if (k || pApp) {
    const lista = ((LS.get('ia-modelos', {}) || {}).lista) || [];
    const fuera = LS.get('ia-agotados', {}) || {};
    const hoyG = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const agot = Object.entries(fuera).filter(([, v]) => v && v.d === hoyG).length;
    if (!pApp) c3 += fila('Plan automático al abrir', 'Si es de otro día o cambió el mercado', interr(ci.auto, 'iaAuto', '', 'Plan automático al abrir'), 'plan');
    c3 += filasHorasPlan(S, pApp);
    if (k && !qApp) c3 += fila('Buscar en Google en el chat', 'Solo si le falta algo de hoy', interr(ci.web, 'iaWeb', '', 'Buscar en Google en el chat'), 'busqueda');
    c3 += fila('Pullitas', 'Bromas que nunca deciden nada', selA('pullitas', [['no', 'Sin pullitas'], ['suave', 'Suaves'], ['normal', 'Normales'], ['saco', 'A saco']], ci.pullitas || 'normal', 'Pullitas de la IA'), 'bromas humor');
    if (k) c3 += fila('Versiones de la IA', lista.length ? `${lista.length} con tu clave${agot ? ` · ${agot} agotada${agot === 1 ? '' : 's'} hoy` : ''}` : 'Sin comprobar', btnA('probarIA', 'Comprobar'), 'cupo modelos');
  }
  h += sec('ia', 'ia', 'La IA', permIA !== null ? (permIA === 'no' ? 'Apagada: no se le manda nada' : qApp ? 'Planes y preguntas con la IA de la app' : pApp ? 'Plan con la IA de la app' : 'No disponible ahora') : k ? `Clave puesta${ci.auto ? ' · plan automático' : ''}` : qApp ? 'Planes y preguntas con la IA de la app' : pApp ? 'Plan con la IA de la app · sin clave para preguntar' : 'Sin clave', c3, 'gemini');

  /* ---- la app ---- */
  let c4 = '';
  const ew = enApp ? nativo.estadoWeb() : null;
  c4 += fila(`Versión ${VERSION}`, enApp ? `Compilación ${nativo.version()}${nativo.canal() === 'play' ? ' · Google Play' : nativo.canal() === 'ios' ? ' · App Store' : ''}${ew && ew.activa ? ' · al día sin reinstalar' : ''}` : 'En el navegador', btnA(enApp ? 'buscarVersion' : 'buscarWeb', 'Buscar nueva'), 'actualizar version');
  if (estadoLimite.min != null) c4 += fila(`Hoy: ${Math.round(estadoLimite.usados / 60)} de ${estadoLimite.min} min`, 'Se reinicia a las 00:00', '', 'tiempo limite minutos');
  // las novedades de cada versión, solo para el dueño (o todos con «novedadesTodos» en limites.json)
  if (dueno || novedadesPara({ ligas: (S.D && S.D.ligas) || [] }) === true) c4 += fila('Novedades', 'Lo que trae y arregla cada versión', btnA('novedades', 'Ver'), 'cambios');
  // (11 nov, Carlos) a todos los demás, lo importante de cada versión (importante: true en version.js), sin arreglos
  // (20 nov, Carlos) solo si él lo enciende («novedadesImportantes» en limites.json): si no, a los demás, nada
  else if (importantesPara() && hayImportantes()) {
    const u = ultimaImportante();
    c4 += fila('Novedades', LS.get('importante-vista', null) === u ? 'Lo más importante de cada versión' : `Nuevo en la ${u}`, btnA('novedades', 'Ver'), 'cambios version');
  }
  if (dueno && !enDemo()) c4 += fila('Quién usa la app', 'Solo lo ves tú', btnA('quienUsa', 'Ver', { sec: false }), 'usuarios');
  else if (avisosGuardados().ve && !enDemo()) c4 += fila('Quién usa la app', 'Para ayudar con los fallos', btnA('quienUsa', 'Ver', { sec: false }), 'usuarios');
  if ((enApp || enWeb) && !enDemo()) c4 += fila('Liga de ejemplo', 'Sin tocar tus datos', btnA('entrarDemo', 'Ver'), 'demo');
  // (13 nov, Carlos) el tema de evento de index.html (TEMA_EVENTO), que se puede apagar; sin él, la fila no sale
  c4 += fila('Diagnóstico', 'Lo que han contestado LaLiga y Google', btnA('diag', 'Ver'), 'errores fallos');
  h += sec('app', 'info', 'La app', `Versión ${VERSION}`, c4, 'version');

  /* ---- datos y privacidad ---- */
  let c5 = '';
  c5 += fila('Borrar los datos guardados', 'Histórico, fichas y planes', btnA('borrarDatos', 'Borrar'), 'limpiar cache');
  // (0.7.13, Carlos 15 nov: viene activado) lo de tu liga que se manda, sin nombres, para que la IA y las cuentas afinen
  c5 += fila('Ayudar a mejorar la IA', 'Compartir datos de tu liga, sin nombres, solo para afinar la IA, sus predicciones y sus planes', interr(mejorarIA(), 'mejorarIA', '', 'Ayudar a mejorar la IA'), 'compartir datos enviar mejorar ia predicciones dinero rivales pujas mercado privacidad');
  if (!enDemo() && ses) c5 += fila('Borrar mis datos del servidor', 'Uso de la app y avisos de fallo', btnA('borrarServidor', 'Borrar'), 'eliminar cuenta rgpd');
  // (en Google Play, si Google pide dejar cambiarlo: en la UE, sí; en la web, con los anuncios de AdSense)
  if ((enApp && nativo.hayPrivacidadAnuncios()) || (!enApp && hayAnunciosWeb())) c5 += fila('Privacidad de los anuncios', 'Si pueden usar tus datos', btnA('privAnuncios', 'Cambiar'), 'consentimiento');
  c5 += fila('Privacidad', 'Qué datos usa y dónde se quedan', enlA('privacidad.html', 'Ver'), 'politica');
  c5 += fila('Condiciones de uso', 'App no oficial: el riesgo es tuyo', enlA('condiciones.html', 'Ver'), 'legal terminos');
  h += sec('datos', 'escudo', 'Datos y privacidad', 'Borrar datos, privacidad y condiciones', c5, 'legal');

  h += `<p id="aj-nada" class="t2 aj-nada" hidden></p>`;
  h += `<p class="peq apag" style="margin-top:16px">Fantasy Manager es una app no oficial: no es de LaLiga ni tiene relación con LaLiga. Tu sesión y tu clave se quedan en ${enApp ? 'este móvil' : 'este navegador'}.</p>`;
  return h;
}

/* ================= EL CÓDIGO PARA ENTRAR EN EL ORDENADOR ================= */
export function vinculoWeb(S) {
  const v = S.vinculo;
  if (!v) return nada('No hay código.');
  const cod = String(v.codigo || '');
  // (21 nov) en el iPhone, para llevarla a la pantalla de inicio ya con la cuenta (pasarAInicio, en app.js)
  if (v.inicio) {
    return `<div class="hoja-cab"><h2>En la pantalla de inicio</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
  <ol class="pasos-web">
    <li>Toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba, en la barra de Safari).</li>
    <li>Elige <b>Añadir a pantalla de inicio</b> y pulsa <b>Añadir</b>.</li>
    <li>Ábrela desde su icono: entra sola con tu cuenta.</li>
  </ol>
  <p class="t2 peq" style="text-align:center">Hazlo ahora: vale durante 10 minutos. Si al abrirla te pidiera entrar, escribe este código:</p>
  <div class="codigo-grande">${esc(cod.slice(0, 4))}<span>${esc(cod.slice(4))}</span></div>
  <p class="t2 peq" style="text-align:center">Desde el icono se abre a pantalla completa y no se cierra la sesión por pasar días sin usarla. <a href="instalar.html#anadir">Guía con dibujos</a></p>
  <button class="btn sec ancho" data-accion="cerrarInicio">Ya está</button>`;
  }
  return `<div class="hoja-cab"><h2>${enApp ? 'Abrir en el ordenador' : 'Abrir en otro dispositivo'}</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
  <ol class="pasos-web">
    <li>En ${enApp ? 'el ordenador' : 'el otro dispositivo (el iPhone o el otro ordenador)'}, abre <b>fantasymanagerapp.com</b></li>
    <li>Escribe este código y pulsa Entrar:</li>
  </ol>
  <div class="codigo-grande">${esc(cod.slice(0, 4))}<span>${esc(cod.slice(4))}</span></div>
  <p class="t2 peq" style="text-align:center">Vale una sola vez y caduca ${cuando(v.caduca)}. Entras con tu cuenta de LaLiga y tu clave de la IA, como en la app.</p>
  <div class="vinc-qr">${qrSVG(`https://fantasymanagerapp.com/#codigo=${cod}`)}<p><b>¿En un iPhone u otro móvil?</b> Escanea este QR con la cámara: se abre la web y entras solo, sin escribir el código.</p></div>
  ${enApp && nativo.hayQR() ? '<button class="btn ancho" data-accion="escanearQR">Escanear el QR del ordenador</button>' : ''}
  <button class="btn sec ancho" data-accion="copiarEnlaceWeb">Copiar el enlace de la web</button>`;
}

/* ================= AVISOS DE FALLOS ================= */
/** las capturas del aviso que vas a mandar (hasta 3), con el botón para añadir otra */
function capturasHTML(A) {
  const caps = A.capturas || [];
  const minis = caps.map((c, i) => `<span class="ac-m"><button class="ac-ver" data-accion="verCaptura" data-n="${i}" aria-label="Ver la captura ${i + 1}"><img src="${esc(c.mini)}" alt=""></button><button class="ac-x" data-accion="quitarCaptura" data-i="${i}" aria-label="Quitar la captura ${i + 1}">${icono('cerrar')}</button></span>`).join('');
  const mas = caps.length < 3 ? `<button class="ac-mas${caps.length ? ' cuadro' : ''}" data-accion="capturaAviso">${icono('foto')}<span>${caps.length ? 'Otra' : 'Añadir una captura'}</span></button>` : '';
  return `<div class="aviso-capt">${minis}${mas}</div>${caps.length ? '' : '<p class="t2 peq ac-nota">Una captura de lo que ves ayuda mucho. Hasta 3.</p>'}`;
}
/* (0.8.4, fase 3; Carlos, 25 nov: «que sea una conversación») cada aviso es un hilo: el primer mensaje y, debajo, todos los
   que vayan escribiendo quien lo mandó y Fantasy Manager, en burbujas (lo tuyo a la derecha), cada uno con sus capturas, y
   abajo la caja para escribir con su botón de adjuntar captura. Audios, no. */
/** los mensajes de un aviso: los del servidor o, con uno de antes de la 0.8.4, el texto y la respuesta */
export function msgsDe(x) {
  if (x && Array.isArray(x.msgs) && x.msgs.length) return x.msgs;
  return [{ n: 0, de: 'u', t: x.t, texto: x.texto || x.txt || '', caps: x.capturas || x.c || 0 }, ...(x.respuesta ? [{ n: 1, de: 'd', t: x.respondida, texto: x.respuesta, por: x.por }] : [])];
}
/** quién escribió el último: 'u' (quien lo mandó) o 'd' (Fantasy Manager) */
export const ultimoDe = (x) => x.de || (x.respuesta || x.r ? 'd' : 'u');
/** las capturas de un mensaje: se cargan al abrir el hilo (A.capt['id:mensaje']) */
function capsMsg(A, id, m) {
  if (!m.caps) return '';
  const l = (A.capt && A.capt[`${id}:${m.n}`]) || [];
  return `<div class="aviso-capt msg-capt">${[...Array(m.caps).keys()].map((i) => (l[i] ? `<span class="ac-m"><button class="ac-ver" data-accion="verCaptura" data-id="${esc(id)}" data-m="${m.n}" data-n="${i}" aria-label="Ver la captura ${i + 1}"><img src="${esc(l[i])}" alt=""></button></span>`
    : `<span class="ac-m vacia">${l[i] === '' ? 'No se pudo' : 'Cargando…'}</span>`)).join('')}</div>`;
}
/** la conversación en burbujas. lado: 'u' la ve quien lo mandó; 'd', el dueño o quien ayuda (tuFM: es el dueño). (0.8.4c) Como
    contestan los dos, en lo de Fantasy Manager el servidor les dice quién lo escribió (`aut`: 'yo' o su nombre); sin `aut`
    (la Action y lo de antes), «Tú» para el dueño y «Fantasy Manager» para quien ayuda */
function burbujas(A, x, lado, tuFM = false) {
  const ms = msgsDe(x), ult = ms[ms.length - 1];
  // «Visto» / «Leído» debajo de lo último tuyo, si es lo último del hilo y el otro lado ya lo ha visto
  const visto = ult && ult.de === lado && (lado === 'u' ? (x.vd || 0) >= ult.t : (x.vu || 0) >= ult.t);
  const fm = (m) => (lado === 'd' && m.aut ? (m.aut === 'yo' ? 'Tú' : m.aut) : tuFM ? 'Tú' : firmaDe(m.por) || 'Fantasy Manager');
  const nombre = (m) => (m.de === 'd' ? fm(m) : lado === 'u' ? 'Tú' : x.quien || x.equipo || 'Quien lo mandó');
  return `<div class="msgs">${ms.map((m) => `<div class="msg ${m.de === lado ? 'mio' : 'suyo'}"><b>${esc(nombre(m))}</b>${m.texto ? `<p>${esc(m.texto)}</p>` : ''}${capsMsg(A, x.id, m)}<small>${cuando(m.t)}${m === ult && visto ? ` · ${lado === 'u' ? 'Visto' : 'Leído'}` : ''}</small></div>`).join('')}</div>`;
}
/** la caja de escribir del hilo abierto: el texto, las capturas que vas a mandar (hasta 3) y el botón de adjuntar */
function cajaHilo(A, id, accion, placeholder, max) {
  const caps = A.capHilo || [];
  const minis = caps.map((c, i) => `<span class="ac-m"><button class="ac-ver" data-accion="verCapturaHilo" data-n="${i}" aria-label="Ver la captura ${i + 1}"><img src="${esc(c.mini)}" alt=""></button><button class="ac-x" data-accion="quitarCapturaHilo" data-i="${i}" aria-label="Quitar la captura ${i + 1}">${icono('cerrar')}</button></span>`).join('');
  return `<div class="hilo-caja">${caps.length ? `<div class="aviso-capt">${minis}</div>` : ''}
    <div class="hilo-fila"><button class="b-ico hilo-adj" data-accion="capturaHilo" aria-label="Adjuntar una captura"${caps.length >= 3 ? ' disabled' : ''}>${icono('foto')}</button>
    <textarea id="hiloTxt" class="campo-t" rows="2" maxlength="${max}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">${esc(A.hiloBorrador || '')}</textarea>
    <button class="b-ico hilo-env" data-accion="${accion}" data-id="${esc(id)}" aria-label="Mandar"${A.escribiendo ? ' disabled' : ''}>${icono(A.escribiendo ? 'reloj' : 'enviar')}</button></div></div>`;
}
/** un aviso tuyo: cerrado, lo último; abierto, la conversación entera y la caja para seguirla */
function avisoMio(A, x) {
  const ms = msgsDe(x), ult = ms[ms.length - 1], abierto = A.hilo === x.id;
  const nuevo = !!x.respuesta && !x.vista;
  const pill = ultimoDe(x) === 'd' ? `<span class="pill sube">${nuevo ? 'Respuesta nueva' : 'Contestado'}</span>` : '<span class="pill">Esperando respuesta</span>';
  const cuerpo = abierto ? burbujas(A, x, 'u') + cajaHilo(A, x.id, 'escribirHilo', 'Escribe aquí', 4000)
    : `<p>${esc(ms[0].texto)}</p>${ms.length > 1 ? `<p class="t2 peq aviso-ult"><b>${ult.de === 'd' ? 'Fantasy Manager' : 'Tú'}:</b> ${esc(String(ult.texto || (ult.caps ? 'una captura' : '')).slice(0, 140))}</p>` : ''}${ms[0].caps && ms.length === 1 ? `<p class="t2 peq">${icono('foto')} ${ms[0].caps} captura${ms[0].caps > 1 ? 's' : ''}</p>` : ''}`;
  return `<div class="aviso hilo${nuevo ? ' nuevo' : ''}${abierto ? ' abierto' : ''}">
  <button class="aviso-cab" data-accion="abrirHilo" data-id="${esc(x.id)}" aria-expanded="${abierto}"><span>${cuando(x.t)}</span>${ms.length > 1 ? `<span class="aviso-t2">${ms.length} mensajes</span>` : ''}${pill}</button>
  ${cuerpo}</div>`;
}
/* (26 nov, Carlos: «un botón para dar un chat por finalizado para que no me salga que tengo algo por leer») el dueño y quien
   ayuda lo dan por terminado sin contestar (un «gracias», algo ya hablado): deja de salir sin contestar hasta que vuelva a
   escribir. Quien lo mandó no ve nada */
function terminarHTML(A, d) {
  if (ultimoDe(d) !== 'u') return '';
  if (d.cer && d.cer >= (d.ult || 0)) return `<p class="t2 peq av-term av-hecho">${icono('ok')}<span>Lo diste por terminado. Si vuelve a escribir, sale otra vez como sin contestar.</span></p>`;
  return `<div class="av-term"><button class="btn chico sec" data-accion="terminarAviso" data-id="${esc(d.id)}"${A.terminando ? ' disabled' : ''}>${icono(A.terminando ? 'reloj' : 'ok')}Dar por terminado</button><span class="t2 peq">Sin contestarle: deja de salir como pendiente.</span></div>`;
}
function detalleAviso(A, x) {
  const d = A.detalle;
  // mientras llega el aviso entero, su texto (el de la lista) y que se está cargando
  if (!d) return `<div class="aviso-det"><p class="aviso-texto">${esc((x && x.txt) || '')}</p><p class="t2 peq cargando-av">${icono('reloj')}Cargando el aviso entero…</p></div>`;
  if (d.error) return `<div class="error-c">${esc(d.error)}</div>`;
  return `<div class="aviso-det">
    <p class="t2 peq">${esc([d.liga, d.app].filter(Boolean).join(' · '))}</p>
    ${!A.admin ? '' : d.diag ? `<details><summary>Diagnóstico</summary><pre class="diag" tabindex="0">${esc(d.diag)}</pre></details>` : '<p class="t2 peq">Sin diagnóstico.</p>'}
    ${burbujas(A, d, 'd', !!A.admin)}
    ${A.admin || A.ve ? terminarHTML(A, d) : ''}
    ${A.admin || A.ve ? cajaHilo(A, d.id, 'responderAviso', A.admin ? 'Tu respuesta: le llega en la app' : 'Tu respuesta: le llega como Fantasy Manager', 2000) : ''}</div>`;
}
export function avisos(S) {
  const A = S.av || {};
  // (0.8.4) quien ayuda (ve) tiene la bandeja de todos y (0.8.4c) los contesta. (0.8.4c; Carlos, 25 nov: «me dice Domy que no
  // le sale para reportar fallos») lo de mandar uno quedaba debajo de toda la bandeja: ahora van en dos pestañas,
  // «Recibidos» y «Reportar un fallo» (con tus avisos), cada una con su numerito
  const ve = A.admin || A.ve;
  let h = `<div class="hoja-cab"><h2>${ve ? 'Avisos de fallos' : 'Fallos e ideas'}</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (ve) {
    const pest = A.pest === 'mios' ? 'mios' : 'todos';
    const sinLeer = (A.lista || avisosGuardados().lista || []).filter((x) => x.respuesta && !x.vista).length;
    h += `<div class="q-tabs av-pest" role="tablist" aria-label="Avisos">${[['todos', 'Recibidos', A.pendientes || 0], ['mios', 'Reportar un fallo', sinLeer]].map(([k, t, n]) => `<button role="tab" aria-selected="${k === pest}" class="${k === pest ? 'on' : ''}" data-accion="pestAvisos" data-p="${k}">${t}${n ? `<span class="av-n">${n}</span>` : ''}</button>`).join('')}</div>`;
    if (pest === 'todos') return h + bandejaAvisos(A);
  }
  if (A.sinSesion) {
    h += `<p class="t2">Para mandarme un aviso y que te pueda contestar hace falta entrar con tu cuenta de LaLiga${enDemo() ? ' (ahora estás viendo la liga de ejemplo)' : ''}. Mientras, puedes escribirme desde la página de contacto y pegar el diagnóstico.</p>
      <button class="btn ancho" data-abrir="https://fantasymanagerapp.com/contacto.html">${icono('enviar')}Ir a contacto</button>
      <button class="btn sec ancho" data-accion="compartirDiag" style="margin-top:8px">${icono('copiar')}${enApp ? 'Mandar el diagnóstico' : 'Copiar el diagnóstico'}</button>`;
  } else {
    h += `<p class="t2 peq" style="margin-top:0">La app está en beta y se mejora con lo que me cuentas. Si algo falla, dime qué ha pasado y qué estabas haciendo; si se te ocurre algo que mejorar, cuéntamelo también. Me llega a mí y te contesto aquí mismo: te aviso cuando haya respuesta.</p>
      <textarea id="avisoTxt" class="campo-t aviso-t" rows="4" maxlength="4000" placeholder="Por ejemplo: al abrir Mercado se queda en blanco, o me gustaría ver el historial de pujas">${esc(A.borrador || '')}</textarea>
      ${capturasHTML(A)}
      <label class="aviso-diag"><input type="checkbox" id="avisoDiag"${A.sinDiag ? '' : ' checked'}><span>Mandar también el diagnóstico (versión, lo que ha contestado LaLiga…). No lleva tu sesión, tu clave de la IA ni los nombres de los demás de tu liga.</span></label>
      <button class="btn ancho" data-accion="mandarAviso"${A.enviando ? ' disabled' : ''}>${A.enviando ? 'Mandando…' : `${icono('enviar')}Mandar el aviso`}</button>
      ${A.error ? `<div class="error-c" style="margin-top:10px">${esc(A.error)}</div>` : ''}`;
  }
  const mios = A.lista || avisosGuardados().lista || [];
  if (mios.length) h += `<div class="grupo"><span>Tus avisos</span><span>${mios.length}</span></div>${mios.map((x) => avisoMio(A, x)).join('')}`;
  else if (A.cargando) h += '<p class="t2 peq">Mirando tus avisos…</p>';
  return h;
}
function bandejaAvisos(A) {
  const todos = A.todos || [];
  let h = `<div class="grupo"><span>Avisos recibidos</span><span>${A.pendientes || 0} sin contestar</span></div>`;
  if (!todos.length) h += `<p class="t2 peq">${A.cargandoTodos ? 'Cargando…' : 'Ninguno todavía.'}</p>`;
  // para revisarlos con Claude: los sin contestar, enteros y con su diagnóstico, listos para pegar en el chat (solo el dueño)
  else if (A.admin) h += `<div class="avisos-claude"><button class="btn chico sec" data-accion="copiarAvisos">${icono('copiar')}Copiar avisos</button><span class="t2 peq">${A.pendientes ? 'Los que están sin contestar' : 'Los últimos 5'}, con su diagnóstico. Pégalos en el chat.</span></div>${A.paraClaude ? `<div class="para-claude"><textarea class="campo-t aviso-t" rows="5" readonly>${esc(A.paraClaude)}</textarea><button class="btn chico" data-accion="copiarParaClaude">${icono('copiar')}Copiar otra vez</button></div>` : ''}`;
  h += todos.map((x) => `<div class="aviso recibido${x.r ? '' : ' nuevo'}${A.abierto === x.id ? ' abierto' : ''}">
    <button class="aviso-cab" data-accion="abrirAviso" data-id="${esc(x.id)}" aria-expanded="${A.abierto === x.id}"><b>${esc(x.quien || '¿?')}</b><span>${esc(x.equipo || '')}</span><span class="aviso-t2">${cuando(x.ult || x.t)}${x.n > 1 ? ` · ${x.n} mensajes` : ''}</span>${x.cer ? '<span class="pill">Terminado</span>' : x.r ? '<span class="pill sube">Contestado</span>' : '<span class="pill pronto">Sin contestar</span>'}</button>
    ${A.abierto === x.id ? detalleAviso(A, x) : `<p>${esc(x.txt || '')}</p>${x.n > 1 && x.ultTxt ? `<p class="t2 peq aviso-ult"><b>${x.de === 'd' ? 'Fantasy Manager' : 'Último'}:</b> ${esc(x.ultTxt)}</p>` : ''}`}</div>`).join('');
  return h;
}

/* ================= QUIÉN USA LA APP (el dueño) ================= */
/* se abre tocando la etiqueta BETA del logo (solo el dueño) o desde Ajustes. Cómo va, más abajo (quienUsaHTML) */
const DENTRO_Q = 12 * 60e3;
const webDe = (x) => String((x && x.v) || '').replace(/ !$/, '');
/** el código de la app de Google Play a partir del cual llega la web de ahora: «playMin» de limites.json y, si no está,
    el más bajo de los que ya tienen la web de ahora (esos tienen por fuerza la parte del móvil al día) */
export function playMinimo(lista) {
  const g = LS.get('limites', null), cfg = (g && g.cfg) || {};
  const conf = Math.round(Number(cfg.playMin) || 0);
  if (conf) return conf;
  const al = (lista || []).filter((x) => x.canal === 'play' && x.app > 0 && webDe(x) === VERSION).map((x) => x.app);
  return al.length ? Math.min(...al) : 0;
}
/** lo que le pasa a una cuenta: { tipo, corto } o null (play: su app de Google Play no recibe la web nueva) */
export function problemaDe(x, minPlay) {
  if (!x) return null;
  const v = webDe(x), atras = !!v && cmpVer(v, VERSION) < 0;
  if (x.canal === 'github') return { tipo: 'github', corto: 'APK de fuera', largo: 'con la app de fuera de Play' };
  if (x.canal === 'play' && atras && minPlay && x.app > 0 && x.app < minPlay) return { tipo: 'play', corto: 'App de Play vieja', largo: 'con la app de Play vieja' };
  if (/ !$/.test(x.v || '')) return { tipo: 'carga', corto: 'No le carga', largo: 'sin cargar la liga' };
  if (atras && x.ad) return { tipo: 'web', corto: 'Web sin poner', largo: 'sin la web nueva' };
  return null;
}
/** (16 nov, Carlos: «hay uno que pone que no le carga, ¿qué significa?») por qué le pasa y qué tiene que hacer, en
    palabras de cualquiera. `fc` es el motivo que manda la app desde la 0.7.13t; `ad`, por qué no se le pone la web nueva */
/* (19 nov, Carlos: «no conozco a los usuarios y no puedo decirles nada») el segundo texto dice si se arregla solo o hace
   falta un arreglo de la app, nunca lo que tendría que hacer el usuario */
const POR_CARGA = {
  red: ['Se le cortó la conexión al cargar su liga (la red del móvil, o la operadora cortando en día de partido).', 'Se arregla solo: la app lo vuelve a intentar en cuanto tiene conexión.'],
  lento: ['Su conexión iba tan lenta que la liga no llegó a cargar.', 'Se arregla solo con mejor cobertura: la app lo vuelve a intentar al abrirla.'],
  laliga: ['LaLiga no le contestó bien al pedir su liga: es un fallo de LaLiga, no de la app.', 'Suele volver solo en un rato: no depende de la app.'],
  sinLigas: ['Su cuenta de LaLiga no tiene ninguna liga de LaLiga Fantasy.', 'No se arregla solo: hasta que se una a una liga (o entre con otra cuenta) no hay nada que enseñarle. La app ya se lo dice.'],
  vacia: ['LaLiga le da su liga vacía (sin equipos o sin datos).', 'Si es una liga recién creada, se arregla sola cuando empiece. Si no, es de la app o de LaLiga y hay que mirarlo.'],
  cambio: ['LaLiga ha cambiado algo en lo que devuelve y la app no lo entiende.', 'Es de la app: hay que mirarlo y sacar un arreglo.'],
  otro: ['Algo de la app ha fallado al cargar su liga.', 'Es de la app: hay que mirarlo y sacar un arreglo.'],
};
/** ¿el motivo de AlDia (`ad`) es de la conexión? (los de antes del respaldo traen el mensaje de Android tal cual) */
const AD_RED = /sin conexi[oó]n|no conecta|tarda|sin direcci[oó]n|https roto|failed to connect|timed? ?out|unable to resolve|resolve host|no address|connection (reset|refused|abort)|software caused|unreachable|network|ssl|handshake|\bEOF\b/i;
function queLePasa(p, x, minPlay) {
  if (!p) return null;
  if (p.tipo === 'github') return ['Tiene la app instalada desde fuera de Google Play y ya solo ve el aviso para pasarse.', 'No se arregla solo: esa app ya no se actualiza. La propia app le pide que se pase a la de Google Play.'];
  if (p.tipo === 'play') {
    const g = LS.get('limites', null), avisa = Number(((g && g.cfg) || {}).playMin) > 0;
    return [`Tiene la app ${x.app} de Google Play y la web nueva solo llega desde la ${minPlay}: se ha quedado en la ${webDe(x)}.`, `Se arregla cuando Google Play le actualice la app, que suele hacerlo solo.${avisa ? ' La app ya le avisa de que hay una nueva.' : ''}`];
  }
  if (p.tipo === 'web') {
    const ad = String(x.ad || '');
    // desde el respaldo (19 nov) la app prueba dos sitios y el motivo empieza por «sin conexión ·» si no llega a ninguno
    const dos = /^sin conexi[oó]n ·/.test(ad);
    const [por, solo] = /firma/.test(ad) ? ['la web nueva le llega con la firma mal (puede ser una red que la cambia por el camino)', 'Suele arreglarse solo con otra red: la app lo vuelve a intentar cada vez que se abre.']
      : /huella|cuadra/.test(ad) ? ['la web nueva le llega a medias o corrupta', 'Suele arreglarse solo: la app lo vuelve a intentar cada vez que se abre.']
      : /sitio|grande/.test(ad) ? ['no le queda sitio en el móvil para guardarla', 'No se arregla hasta que tenga sitio libre; la app lo vuelve a intentar cada vez que se abre.']
      : /arrancaba/.test(ad) ? ['la web nueva no le arrancaba y su móvil volvió a la de antes', 'Es de la app: esa versión ya no la vuelve a probar, se arregla con la siguiente.']
      : AD_RED.test(ad) && dos ? [`su conexión no llega a donde se descarga, ni al sitio principal ni al de respaldo («${ad}»)`, 'Se arregla solo cuando abra la app con otra red. Si dura más de un día, la propia app le enseña un aviso.']
      : AD_RED.test(ad) ? [`su conexión no llega a donde se descarga («${ad}»)`, 'Se arregla solo cuando abra la app con otra red, o cuando Google Play le actualice la app, que ya lo intenta también por otro camino.']
      : [`su móvil dice «${ad}»`, 'La app lo vuelve a intentar cada vez que se abre. Si no se va, es de la app y hay que mirarlo.'];
    return [`No se le pone la web nueva: ${por}.`, solo];
  }
  if (p.tipo === 'carga') {
    const m = String(x.fc || ''), tipo = m.split(/[ :]/)[0];
    if (!m) return ['La última vez que abrió la app no le cargó la liga. Su versión no manda el motivo (desde la 0.7.13t, sí).', 'Si vuelve a pasarle con una versión más nueva, aquí saldrá por qué.'];
    const [por, hacer] = POR_CARGA[tipo] || POR_CARGA.otro;
    return [`${por} (${m})`, hacer];
  }
  return null;
}
/* (21 nov, noche) Rehecha otra vez. Carlos: «muchísimo más sencillo, mejor compartimentado, con mejores gráficas y el
   tiempo de uso diario a la vista». Se le enseñaron tres variantes y eligió las pestañas, con las gráficas de tiempo del
   panel de detalle. Cinco pestañas, cada una con lo suyo y sus gráficas a todo el ancho:
   Hoy (tres cifras, el aviso de problemas, activos, altas y desde dónde) · Uso (tiempo por persona, entre todos, quién más
   y qué hacen) · Entrada (el embudo de cada canal y las campañas) · Invitar · Cuentas (la lista con buscador y filtros).
   La pestaña va en S.quien.tab (acción quienTab); el aviso de problemas lleva a Cuentas con el filtro «Con problema». */
const Q_TABS = [['hoy', 'Hoy'], ['uso', 'Uso'], ['entrada', 'Entrada'], ['invitar', 'Invitar'], ['cuentas', 'Cuentas']];
const DSEM_Q = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const etQ = (d, i) => (i === 0 ? 'Hoy' : DSEM_Q[new Date(`${d}T12:00:00Z`).getUTCDay()]);
const pctN = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** minutos para leer: «15 min», «6 h 45» */
const minQ = (seg) => { const m = Math.round((Number(seg) || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const tarjetaQ = (titulo, cuerpo, { cifra = '', pie = '' } = {}) => `<section class="qc"><div class="qc-cab"><h3>${titulo}</h3>${cifra ? `<span>${cifra}</span>` : ''}</div>${cuerpo}${pie ? `<p class="qc-pie">${pie}</p>` : ''}</section>`;
const kpiQ = (cifras) => `<div class="q-kpi">${cifras.map(([v, t, cls]) => `<div class="${cls || ''}"><b>${v}</b><span>${t}</span></div>`).join('')}</div>`;

export function quienUsaHTML(S) {
  const Q = S.quien || {};
  let h = `<div class="hoja-cab"><h2>Quién usa la app</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (Q.cargando) return `${h}<p class="t2">Mirando…</p>`;
  if (Q.error) return `${h}<div class="error-c">${esc(Q.error)}</div>`;
  const C = numerosQ(Q);
  const tab = Q_TABS.some(([k]) => k === Q.tab) ? Q.tab : 'hoy';
  // (23 nov) mientras llega lo nuevo sale lo de la última vez: «dentro ahora» no vale hasta que se actualiza
  const estadoQ = Q.viejo ? `Actualizando… (lo de las ${horaDe(Q.ahora)})` : Q.sinActualizar ? `No se ha podido actualizar: es de las ${horaDe(Q.ahora)}` : `${C.dentro} dentro ahora`;
  h += `<p class="q-sub"><span class="q-vivo${C.dentro && !Q.viejo && !Q.sinActualizar ? ' on' : ''}" aria-hidden="true"></span>${estadoQ} · ${C.total} cuentas en total</p>`;
  h += `<div class="q-tabs" role="tablist" aria-label="Apartados">${Q_TABS.map(([k, t]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-accion="quienTab" data-t="${k}">${t}</button>`).join('')}</div>`;
  if (tab === 'hoy') h += hoyQ(C);
  else if (tab === 'uso') h += usoQ(C);
  else if (tab === 'entrada') h += entradaQ(C);
  else if (tab === 'invitar') h += invitarQ(C, Q);
  else h += cuentasTabQ(S, Q, C);
  return h;
}

/** todos los números de la hoja, una vez */
function numerosQ(Q) {
  const lista = Q.lista || [], reg = Q.registro || [], ahora = Q.ahora || Date.now();
  const ds = (Array.isArray(Q.dias) && Q.dias.length ? Q.dias : Array.from({ length: 7 }, (_, i) => diaDe(ahora - i * DIA))).slice(0, 7);
  const segDe = (x, d, i) => Number(((x.segDias || {})[d]) || (i === 0 ? x.segHoy : 0)) || 0;
  // cada día, del más viejo a hoy: cuántos abren la app, el tiempo entre todos y por persona, y las altas
  const dias = ds.map((d, i) => {
    // activos: los que tienen tiempo ese día y los que abrieron ese día por última vez aunque su tiempo no llegara
    // (Carlos, 22 nov: la cifra «hoy» decía 49 y la barra 47; eran dos altas nuevas que salieron antes de mandar el tiempo)
    const act = lista.filter((x) => segDe(x, d, i) > 0), seg = act.reduce((t, x) => t + segDe(x, d, i), 0);
    const abren = act.length + lista.filter((x) => !(segDe(x, d, i) > 0) && diaDe(x.ultima) === d).length;
    return { et: etQ(d, i), hoy: i === 0, activos: abren, seg, media: act.length ? seg / act.length : 0, altas: reg.filter((x) => x.primera && diaDe(x.primera) === d).length };
  }).reverse();
  const minPlay = playMinimo(lista);
  const problemas = {};
  for (const x of lista.filter((y) => y.ultima >= ahora - 30 * DIA)) { const p = problemaDe(x, minPlay); if (p) (problemas[p.tipo] ||= { p, n: 0 }).n++; }
  const semL = lista.filter((x) => x.ultima >= ahora - 7 * DIA);
  const hoyD = dias[dias.length - 1] || { seg: 0, media: 0 };
  const act7 = dias.reduce((t, x) => t + x.activos, 0), seg7 = dias.reduce((t, x) => t + x.seg, 0);
  return {
    Q, lista, reg, ahora, ds, dias, minPlay, problemas, semL,
    dentro: lista.filter((x) => ahora - x.ultima < DENTRO_Q).length,
    // (23 nov, Carlos: «hoy» 50 y la barra de hoy 53) la hora de la última entrada se guarda como mucho una vez por hora
    // (para no gastar escrituras): quien entró ayer a última hora y hoy otra vez puede tenerla de ayer. Hoy cuenta igual
    // que la barra: con tiempo hoy o con la última entrada de hoy
    hoy: lista.filter((x) => segDe(x, ds[0], 0) > 0 || diaDe(x.ultima) === ds[0]).length,
    sem: (reg.length ? reg : lista).filter((x) => x.ultima >= ahora - 7 * DIA).length,
    total: (reg.length ? reg : lista).length,
    segHoy: hoyD.seg, mediaHoy: hoyD.media, mediaSem: act7 ? seg7 / act7 : 0,
    topHoy: lista.map((x) => [x.nombre || x.equipo || 'Sin nombre', segDe(x, ds[0], 0)]).filter((f) => f[1] > 0).sort((a, b) => b[1] - a[1]),
  };
}

/** el aviso de problemas: una línea que lleva a Cuentas con el filtro «Con problema» */
function avisoQ(C) {
  const ks = ['play', 'github', 'carga', 'web'].filter((k) => C.problemas[k]);
  if (!ks.length) return `<p class="q-bien">${icono('ok')}Todos al día</p>`;
  const n = ks.reduce((t, k) => t + C.problemas[k].n, 0);
  return `<button class="q-aviso" data-accion="quienFiltro" data-f="prob" data-ir-cuentas="1">${icono('alerta')}<span><b>${n} ${n === 1 ? 'cuenta' : 'cuentas'} con algún problema</b><small>${ks.map((k) => `${C.problemas[k].n} ${esc(C.problemas[k].p.largo)}`).join(' · ')}</small></span>${icono('flecha')}</button>`;
}

function hoyQ(C) {
  let h = kpiQ([[C.dentro, 'dentro ahora', C.dentro ? 'vivo' : ''], [C.hoy, 'hoy'], [C.sem, '7 días']]);
  h += avisoQ(C);
  const d = C.dias;
  if (d.some((x) => x.activos)) h += tarjetaQ('Activos cada día', columnasSem(d.map((x) => ({ et: x.et, v: x.activos, hoy: x.hoy }))));
  if (C.reg.length) {
    h += tarjetaQ('Altas nuevas', columnasSem(d.map((x) => ({ et: x.et, v: x.altas, hoy: x.hoy })), { alto: 170 }), { cifra: `<b>${d.reduce((t, x) => t + x.altas, 0)}</b> en 7 días` });
    // (21 nov, Carlos: «las altas semanales, como salían antes») las 8 últimas semanas, cada una de 7 días hacia atrás desde
    // ahora; la etiqueta es el día en que empieza
    const sem = Array.from({ length: 8 }, (_, i) => {
      const hasta = C.ahora - 7 * i * DIA, desde = hasta - 7 * DIA;
      return { et: i ? fechaCorta(desde) : 'Esta', v: C.reg.filter((x) => x.primera >= desde && x.primera < hasta).length, hoy: i === 0 };
    }).reverse();
    h += tarjetaQ('Altas por semana', columnasSem(sem, { alto: 170 }), { cifra: `<b>${sem.reduce((t, x) => t + x.v, 0)}</b> en 8 semanas` });
  }
  // desde dónde: los de 7 días por canal, en una barra. (0.8.4; Carlos, 25 nov: «si hubiera forma de diferenciar los de iOS
  // de la web de un ordenador») la web, por aparato (`disp`, lo manda la web desde la 0.8.4); «Web» a secas es quien aún
  // no ha abierto esa versión
  const partes = [['Google Play', 'play', 'var(--rojo)'], ['App de iOS', 'ios', 'var(--texto)'], ['Web en iPhone', 'web-iphone', 'var(--oro)'], ['Web en ordenador', 'web-pc', 'var(--azul)'], ['Web en Android', 'web-android', 'var(--sube)'], ['Web', 'web', 'rgba(88, 166, 255, 0.45)'], ['APK de fuera', 'github', 'var(--texto-3)']].map(([t, k, c]) => ({ t, c, v: C.semL.filter((x) => dondeQ(x) === k).length })).filter((p) => p.v);
  if (partes.length) {
    const tot = partes.reduce((t, p) => t + p.v, 0);
    h += tarjetaQ('Desde dónde', `<div class="q-pila" role="img" aria-label="${esc(partes.map((p) => `${p.t}: ${p.v}`).join(', '))}">${partes.map((p) => `<i style="flex:${p.v};background:${p.c}"></i>`).join('')}</div><div class="q-ley">${partes.map((p) => `<span><i style="background:${p.c}"></i>${esc(p.t)} <b>${p.v}</b> <small>${pctN(p.v, tot)} %</small></span>`).join('')}</div>`, { cifra: '7 días' });
  }
  return h;
}

/* (Carlos, 21 nov: «en tiempo de uso, las gráficas de la C me gustan») */
function usoQ(C) {
  const d = C.dias;
  if (!d.some((x) => x.seg)) return `<p class="q-no">Nadie ha abierto la app esta semana.</p>${versionesQ(C)}`;
  let h = kpiQ([[minQ(C.mediaHoy), 'por persona hoy'], [minQ(C.mediaSem), 'media 7 días'], [minQ(C.segHoy), 'entre todos hoy']]);
  h += tarjetaQ('Por persona, cada día', areaSem(d.map((x) => ({ et: x.et, v: Math.round(x.media / 60), hoy: x.hoy })), { formato: (v) => `${v}′` }));
  h += tarjetaQ('Entre todos, cada día', columnasSem(d.map((x) => ({ et: x.et, v: Math.round(x.seg / 60), hoy: x.hoy })), { alto: 170, formato: (v) => (v >= 60 ? `${String(Math.round(v / 6) / 10).replace('.', ',')}h` : `${Math.round(v)}′`) }));
  if (C.topHoy.length) {
    const max = C.topHoy[0][1];
    h += tarjetaQ('Quién más hoy', `<div class="q-rank">${C.topHoy.slice(0, 8).map(([n, s]) => `<div><b>${esc(n)}</b><i style="--n:${pctN(s, max)}"></i><span>${minQ(s)}</span></div>`).join('')}</div>`);
  }
  // qué hacen esta semana (de lunes a hoy)
  const lunes = (() => { const t = new Date(`${diaDe(C.ahora)}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); })();
  const ev = {};
  for (const x of C.reg) for (const [k, n] of Object.entries((x.ev || {})[lunes] || {})) ev[k] = (ev[k] || 0) + (Number(n) || 0);
  const cosas = [['planes', 'p'], ['preguntas', 'q'], ['anuncios', 'b'], ['funciones top', 't']].filter(([, k]) => ev[k]);
  if (cosas.length) {
    const malas = (ev.f || 0) + (ev.F || 0), buenas = (ev.a || 0) + (ev.A || 0);
    h += tarjetaQ('Qué hacen esta semana', kpiQ(cosas.map(([t, k]) => [ev[k], t])), { pie: buenas + malas ? `Cargas de la liga que fallan: <b>${String(Math.round((malas / (buenas + malas)) * 1000) / 10).replace('.', ',')} %</b>` : '' });
  }
  return h + versionesQ(C);
}

/* (21 nov, Carlos: «cuántas personas hay en cada versión, y la última, la de ahora») de los que han abierto la app en 30
   días, cuántos tienen cada versión de la web: de la más vieja a la de ahora, que va la última y en rojo. Debajo, por qué
   se han quedado atrás y qué app de Google Play tienen */
function versionesQ(C) {
  const v30 = C.lista.filter((x) => x.ultima >= C.ahora - 30 * DIA && webDe(x));
  if (!v30.length) return '';
  const porV = {};
  for (const x of v30) { const v = cmpVer(webDe(x), VERSION) >= 0 ? VERSION : webDe(x); porV[v] = (porV[v] || 0) + 1; }
  const viejas = Object.keys(porV).filter((v) => v !== VERSION).sort((a, b) => cmpVer(b, a));
  // como mucho 7 columnas: la de ahora y las 6 más nuevas de las de antes; lo más viejo, junto en «antes»
  const resto = viejas.slice(6).reduce((t, v) => t + porV[v], 0);
  const cols = [...(resto ? [{ et: 'antes', v: resto }] : []), ...viejas.slice(0, 6).reverse().map((v) => ({ et: v, v: porV[v] })), { et: VERSION, v: porV[VERSION] || 0, hoy: true }];
  const motivos = {};
  for (const x of v30) { const p = problemaDe(x, C.minPlay); if (p) motivos[p.corto] = (motivos[p.corto] || 0) + 1; }
  const sinMotivo = v30.filter((x) => cmpVer(webDe(x), VERSION) < 0 && !problemaDe(x, C.minPlay)).length;
  const playC = {};
  for (const x of v30) if (x.canal === 'play' && x.app > 0) playC[x.app] = (playC[x.app] || 0) + 1;
  // (iOS 3) las compilaciones de la app de iOS, igual
  const iosC = {};
  for (const x of v30) if (x.canal === 'ios' && x.app > 0) iosC[x.app] = (iosC[x.app] || 0) + 1;
  const pie = [
    Object.entries(motivos).map(([k, n]) => `${esc(k)}: <b>${n}</b>`).join(' · '),
    sinMotivo ? `Atrás sin problema a la vista: <b>${sinMotivo}</b> (se les pone sola al abrir la app)` : '',
    Object.keys(playC).length ? `App de Google Play: ${Object.entries(playC).sort((a, b) => b[0] - a[0]).map(([c, n]) => `${esc(c)}${C.minPlay && Number(c) < C.minPlay ? ' (vieja)' : ''} <b>${n}</b>`).join(' · ')}${C.minPlay ? `. La web de ahora llega desde la ${C.minPlay}` : ''}` : '',
    Object.keys(iosC).length ? `App de iOS: ${Object.entries(iosC).sort((a, b) => b[0] - a[0]).map(([c, n]) => `${esc(c)} <b>${n}</b>`).join(' · ')}` : '',
  ].filter(Boolean).join('<br>');
  return tarjetaQ('Versiones', columnasSem(cols, { alto: 170, media: false }), { cifra: `<b>${porV[VERSION] || 0}</b> de ${v30.length} con la ${esc(VERSION)}`, pie });
}

/** el embudo de un canal: barras que encogen, con el % que pasa de un paso al siguiente */
function embudoQ(c) {
  const pasos = (c.web ? [['Llegan a la web', c.llegan], ['Ven el botón de entrar', c.ven], ['Abren LaLiga', c.l], ['Vuelven de LaLiga', c.v], ['Pegan la dirección', c.p], ['Entran', c.ok]] : [['Ven el botón de entrar', c.ver], ['Abren LaLiga', c.l], ['Entran', c.ok]]).filter((p) => p[1] != null);
  const base = Math.max(1, ...pasos.map((p) => p[1]));
  return `<div class="q-emb">${pasos.map(([t, v], i) => `${i ? `<div class="q-emb-p">${icono('abajo')}${pctN(v, pasos[i - 1][1])} %</div>` : ''}<div class="q-emb-f${i === pasos.length - 1 ? ' fin' : ''}"><i style="width:${Math.max(3, (v / base) * 100)}%"></i><span>${esc(t)}</span><b>${v}</b></div>`).join('')}</div>`;
}
const notasCanal = (c) => [
  !c.web && c.vuelve ? `Vuelven sin el código: <b>${c.vuelve}</b>` : '',
  c.web && c.play ? `Tocan Google Play: <b>${c.play}</b>` : '',
  c.demo ? `Miran el ejemplo: <b>${c.demo}</b>` : '',
  c.saf ? `Tocan «Abrir en Safari»: <b>${c.saf}</b>` : '',
  c.inicio ? `Pasan a la pantalla de inicio: <b>${c.inicio}</b>` : '',
  c.laliga || c.l5xx ? `Falla LaLiga: <b>${c.laliga + c.l5xx}</b>${c.l5xx ? ` (error suyo ${c.laliga} · sin contestar bien ${c.l5xx})` : ''}` : '',
  (() => { const m = c.mal || {}, t = MAL_PEGADO.reduce((x, [k]) => x + (m[k] || 0), 0); return t ? `Pegan algo que no vale: <b>${t}</b> (${MAL_PEGADO.filter(([k]) => m[k]).map(([k, txt]) => `${txt} ${m[k]}`).join(' · ')})` : ''; })(),
  c.gastado ? `Repiten un enlace gastado: <b>${c.gastado}</b>` : '', c.cancel ? `Cancelan: <b>${c.cancel}</b>` : '', c.otros ? `Otros fallos: <b>${c.otros}</b>` : '',
  c.ok > c.l ? `Entran más de los que abren LaLiga: <b>${c.ok - c.l}</b> con un código o por otro camino` : '',
].filter(Boolean).join(' · ');
const pctCanal = (c) => { const p = pctN(c.ok, c.l); return `<span class="q-pct${!c.l || c.ok > c.l ? '' : p >= 50 ? ' bien' : p < 30 ? ' mal' : ''}">${c.l && c.ok <= c.l ? `${p} %` : '—'}<small>${c.ok} de ${c.l} entran</small></span>`; };
function entradaQ(C) {
  const { canales, origenes } = embudoDatos(C.Q.embudo, C.ahora);
  if (!canales.length) return '<p class="q-no">Nadie ha intentado entrar en los últimos 7 días.</p>';
  let h = '<p class="q-lead">De los que abren LaLiga para entrar, cuántos acaban dentro. Últimos 7 días.</p>';
  h += canales.map((c) => { const n = notasCanal(c); return `<section class="qc" data-canal="${esc(c.k)}"><div class="qc-cab"><h3>${esc(c.t)}</h3>${pctCanal(c)}</div>${embudoQ(c)}${n ? `<p class="qc-pie">${n}</p>` : ''}</section>`; }).join('');
  if (origenes.length) h += tarjetaQ('Por campaña', `<div class="q-camp">${origenes.map((c) => `<div><b>${esc(c.t)}</b><span>${c.llegan} llegan · ${c.l} abren LaLiga</span>${pctCanal(c)}</div>`).join('')}</div>`, { cifra: '?utm_source=' });
  return h;
}

function invitarQ(C, Q) {
  if (!Q.invitar && !C.reg.length) return '<p class="q-no">Sin datos de invitaciones.</p>';
  const { filas, total: T } = invitacionesDatos(Q, C.lista, C.reg, C.ahora);
  let h = kpiQ([[T.comparten, `han invitado${T.veces ? ` · ${T.veces} veces` : ''}`], [T.entran, 'amigos dentro'], [T.siguen != null ? T.siguen : T.vuelven, T.siguen != null ? 'siguen (7 días)' : 'volvieron otro día']]);
  // (25 nov) cómo llegan los amigos, en 7 días: los que abren el enlace en la web, los que copian el código para Google Play y
  // los que lo ponen en la app (solo, propuesto por el servidor o escrito a mano)
  const cnt = (Q.invitar && Q.invitar.cnt) || {}, desde = diaDe(C.ahora - 6 * DIA);
  const t7 = Object.entries(cnt).filter(([d]) => d >= desde).reduce((x, [, v]) => { for (const [k, n] of Object.entries(v || {})) x[k] = (x[k] || 0) + n; return x; }, {});
  if (Object.keys(cnt).length) {
    const fila = (n, t) => `<div class="q-emb-f"><b>${n || 0}</b><span>${t}</span></div>`;
    h += tarjetaQ('Cómo llegan (7 días)', `<div class="q-inv-lleg">${fila(t7.llega, 'abren el enlace en la web')}${fila(t7.copia, 'copian el código para Google Play')}${fila(t7.canje_enlace, 'entran con el enlace (se pone solo)')}${fila(t7.canje_play, 'entran con el código de la instalación de Google Play')}${fila(t7.canje_propuesto, 'aceptan el código que les propone la app')}${fila(t7.canje_escrito, 'lo escriben a mano')}</div>`);
  }
  if (!filas.length) return `${h}<p class="q-no">Nadie ha compartido la app ni ha sacado su código todavía.</p>`;
  const max = Math.max(1, ...filas.map((x) => x.entran));
  h += tarjetaQ('Quién invita', `<div class="q-rank q-inv">${filas.slice(0, 20).map((x) => `<div><b>${esc(x.nombre)}</b><i style="--n:${pctN(x.entran, max)}"></i><span>${x.entran} ${x.entran === 1 ? 'amigo' : 'amigos'}</span><small>${[
    x.comparte ? `compartió ${x.comparte} ${x.comparte === 1 ? 'vez' : 'veces'}` : x.codigo ? 'sacó su código' : '',
    x.entran ? `${x.vuelven} ${x.vuelven === 1 ? 'volvió' : 'volvieron'} otro día` : '',
    x.entran && x.siguen != null ? `${x.siguen} ${x.siguen === 1 ? 'sigue' : 'siguen'}` : '',
    x.premios.length ? (x.premios.length === 2 ? 'los 2 premios' : x.premios[0] === 'doble' ? 'semana doble' : 'sin anuncios') : '',
  ].filter(Boolean).join(' · ')}</small></div>`).join('')}</div>`,
  { pie: T.entran ? '' : 'Han invitado, pero ningún amigo ha entrado todavía con un código. Quien instala desde Google Play tiene que escribirlo a mano cuando la app se lo pregunta.' });
  return h;
}

const Q_FILTROS = [['', 'Todas'], ['hoy', 'Hoy'], ['sem', '7 días'], ['prob', 'Con problema'], ['play', 'Google Play'], ['ios', 'iOS'], ['web', 'Web']];
function cuentasTabQ(S, Q, C) {
  const f = Q_FILTROS.some(([k]) => k === Q.filtro) ? Q.filtro : '';
  // las versiones, en una línea: de los que han abierto la app en 30 días, cuántos tienen la de ahora
  const v30 = C.lista.filter((x) => x.ultima >= C.ahora - 30 * DIA && webDe(x));
  const alDia = v30.filter((x) => cmpVer(webDe(x), VERSION) >= 0).length;
  return `<section class="q-cuentas" id="qCuentas">
    ${v30.length ? `<p class="q-lead">Con la ${esc(VERSION)}: <b>${alDia} de ${v30.length}</b> de los que han entrado en 30 días.${C.minPlay ? ` En Google Play llega desde la ${C.minPlay}.` : ''}</p>` : ''}
    <input id="qBuscar" class="q-buscar" type="search" inputmode="search" enterkeyhint="search" placeholder="Buscar por nombre o equipo" aria-label="Buscar una cuenta por nombre o equipo" autocomplete="off" spellcheck="false">
    <div class="filtros q-filtros" role="group" aria-label="Filtrar las cuentas">${Q_FILTROS.map(([k, t]) => `<button class="${k === f ? 'activo' : ''}" aria-pressed="${k === f}" data-accion="quienFiltro" data-f="${k}">${t}</button>`).join('')}</div>
    <p class="q-cuenta"><span id="qCuenta">${C.lista.length}</span> cuentas</p>
    <div id="qLista" data-filtro="${f}">${cuentasQ(S, C.lista, C.ahora, C.minPlay)}</div>
    <p class="q-no" id="qNada" hidden>Ninguna cuenta con eso.</p></section>`;
}

/**
 * (21 nov) Invitaciones, a la vista: arriba el total y debajo cada persona. De cada una: las veces que le ha dado a
 * compartir (lo apunta la app, por semanas; no se sabe a cuánta gente llegó cada vez), los amigos que han entrado con su
 * código y, de esos, los que han vuelto otro día y los que siguen (han abierto la app en los últimos 7 días). Quien ha
 * sacado su código o ha compartido y no tiene a nadie dentro también sale: con todo a cero no se sabía si es que nadie
 * invitaba o que no entraba nadie. Ojo: el enlace de invitar lleva el código a la web; quien instala la app desde Google
 * Play lo pierde por el camino y tiene que escribirlo cuando la app se lo pregunta.
 */
export function invitacionesDatos(Q, lista, reg, ahora) {
  const I = Q.invitar || {};
  const porUid = new Map(lista.map((x) => [String(x.uid), x]));
  const nom = (u) => { const x = porUid.get(String(u)); return x ? (x.nombre || x.equipo || `Cuenta ${u}`) : `Cuenta ${u}`; };
  const comp = new Map();
  for (const x of reg) { const n = Object.values(x.ev || {}).reduce((t, s) => t + (Number((s || {}).n) || 0), 0); if (n) comp.set(String(x.uid), n); }
  const sigue = (u) => { const x = porUid.get(String(u)); return !!x && x.ultima >= ahora - 7 * DIA; };
  const filas = new Map();
  for (const k of I.lista || []) {
    const inv = Array.isArray(k.inv) ? k.inv : null;
    filas.set(String(k.uid), { uid: String(k.uid), nombre: nom(k.uid), codigo: !!k.cod, comparte: comp.get(String(k.uid)) || 0, entran: k.entran || 0, vuelven: k.cuentan || 0, siguen: inv ? inv.filter((a) => sigue(a.u)).length : null, premios: k.esc || [] });
  }
  for (const [u, n] of comp) if (!filas.has(u)) filas.set(u, { uid: u, nombre: nom(u), codigo: false, comparte: n, entran: 0, vuelven: 0, siguen: 0, premios: [] });
  const l = [...filas.values()].sort((a, b) => b.entran - a.entran || b.comparte - a.comparte);
  const conSiguen = l.some((x) => x.siguen != null);
  return { filas: l, total: { codigos: I.codigos != null ? I.codigos : l.filter((x) => x.codigo).length, comparten: l.filter((x) => x.comparte).length, veces: l.reduce((t, x) => t + x.comparte, 0), entran: I.invitados != null ? I.invitados : l.reduce((t, x) => t + x.entran, 0), vuelven: I.vuelven != null ? I.vuelven : l.reduce((t, x) => t + x.vuelven, 0), siguen: conSiguen ? l.reduce((t, x) => t + (x.siguen || 0), 0) : null } };
}

/**
 * Antes de entrar (7 días), sin saber de quién. (21 nov, tras el análisis del 21: «entra el 30 %» salía de dividir todas
 * las entradas entre todo el que veía la portada, mezclando la app con la web.) Ya no hay porcentaje global: cada canal va
 * por su lado con «entran / le dan» (de los que abren LaLiga, cuántos acaban dentro) y sus pasos uno a uno. En la web,
 * «llegan» es llegar sin sesión y «ven entrar», tener el botón de entrar en pantalla (antes del 21 nov solo había «ver»,
 * que era llegar). Debajo, lo mismo por campaña (?utm_source=…).
 */
const MAL_PEGADO = [['vacio', 'nada'], ['login', 'la página de entrar'], ['app', 'la de la app'], ['jwt', 'sin el código'], ['otro', 'otra cosa']];
const OTROS_FALLOS = ['x-caduca', 'x-redirect', 'x-perdido', 'x-red', 'x-otro'];
const EMB_CANALES = [['App de Android', 'play'], ['App de iOS', 'ios'], ['Web en iPhone', 'web-iphone'], ['Web en ordenador', 'web-pc'], ['Web en Android', 'web-android'], ['APK de fuera', 'github']];
export function embudoDatos(E, ahora) {
  const ult7 = new Set(Array.from({ length: 7 }, (_, i) => diaDe(ahora - i * DIA)));
  const dias = Object.entries((E && E.dias) || {}).filter(([d]) => ult7.has(d)).map(([, g]) => g || {});
  const de = (g) => {
    const n = (p) => dias.reduce((t, d) => t + (Number((d[g] || {})[p]) || 0), 0);
    // «llegan»: los días de antes del 21 nov no traen «llega» y su «ver» era llegar
    const llegan = dias.reduce((t, d) => { const x = d[g] || {}; return t + Math.max(Number(x.llega) || 0, Number(x.ver) || 0); }, 0);
    const ven = dias.reduce((t, d) => { const x = d[g] || {}; return t + (x.llega ? Number(x.ver) || 0 : 0); }, 0);
    const hayVen = dias.some((d) => (d[g] || {}).llega);
    return { llegan, ven: hayVen ? ven : null, ver: n('ver'), play: n('play'), demo: n('demo'), l: n('l'), v: n('v'), p: n('p'), ok: n('ok'), inicio: n('inicio'), saf: n('saf'),
      vuelve: n('x-vuelve'), laliga: n('x-laliga'), l5xx: n('x-5xx'), gastado: n('x-gastado'), cancel: n('x-cancel'), otros: OTROS_FALLOS.reduce((t, k) => t + n(k), 0),
      // (25 nov, tanda 5) lo pegado que no vale, por motivo (las webs de antes no lo mandan)
      mal: Object.fromEntries(MAL_PEGADO.map(([k]) => [k, n(`m-${k}`)])) };
  };
  const canales = EMB_CANALES.map(([t, k]) => ({ t, k, web: k.startsWith('web'), ...de(k) })).filter((c) => c.llegan || c.l || c.ok);
  const origenes = [...new Set(dias.flatMap((d) => Object.keys(d).filter((k) => k.startsWith('o:'))))].map((k) => ({ t: k.slice(2), k, web: true, ...de(k) })).sort((x, y) => y.llegan - x.llegan);
  return { canales, origenes };
}

/** (0.8.4q) todas las ligas de una cuenta: la que tenía abierta y las demás que manda (las webs de antes, solo la abierta) */
const ligasDe = (x) => [...new Set([String(x.liga || ''), ...String(x.ligas || '').split(',')].filter(Boolean))];
function cuentasQ(S, lista, ahora, minPlay) {
  const porUid = new Map(lista.map((x) => [String(x.uid), x]));
  const D = S.D;
  const tabla = D ? [...D.clasif].sort((a, b) => a.pos - b.pos) : [];
  const deLiga = new Set();
  // por su número de cuenta; si no cuadra, por el nombre de su equipo en esta liga o por su nombre de mánager
  const ligaId = D && D.liga ? String(D.liga.id) : '';
  const buscar = (e) => porUid.get(String(e.managerId)) || porUid.get(String(e.userId))
    || lista.find((x) => !deLiga.has(String(x.uid)) && x.equipo && ligasDe(x).includes(ligaId) && norm(x.equipo) === norm(e.nombre))
    || lista.find((x) => !deLiga.has(String(x.uid)) && x.nombre && e.manager && norm(x.nombre) === norm(e.manager));
  const liga = tabla.map((e) => { const x = buscar(e); if (x) deLiga.add(String(x.uid)); return { nombre: e.manager || e.nombre, equipo: e.manager ? e.nombre : '', x }; });
  const fuera = lista.filter((x) => !deLiga.has(String(x.uid))).sort((a, b) => b.ultima - a.ultima);
  let h = '';
  if (tabla.length) {
    const usan = liga.filter((f) => f.x).sort((a, b) => b.x.ultima - a.x.ultima), no = liga.filter((f) => !f.x);
    h += `<div class="grupo"><span>Tu liga · ${usan.length} de ${tabla.length}</span></div>`;
    h += `<div class="q-prog" role="img" aria-label="${usan.length} de ${tabla.length} la usan"><i style="--n:${Math.round((usan.length / Math.max(1, tabla.length)) * 100)}"></i></div>`;
    if (usan.length) h += `<div class="quien-l">${usan.map((f) => filaQuien(f.nombre, f.equipo, f.x, ahora, minPlay)).join('')}</div>`;
    if (no.length) h += `<p class="q-no">Sin la app: ${no.map((f) => esc(f.nombre)).join(', ')}</p>`;
  }
  if (fuera.length) {
    // (0.7.13za, Carlos 16 nov: «¿de las que han entrado, hay alguna de la misma liga?») las de fuera, agrupadas por la liga que
    // manda cada cuenta: las que comparten liga, juntas y primero; después, las que van solas en la suya; y al final, las que
    // aún no han dicho la suya (la app no les cargó la liga). Si el equipo se llama igual que el mánager, no se repite.
    // (0.8.4q, 26 nov, Carlos: «uno ha invitado a 2 amigos y no salen juntos») una cuenta puede estar en varias ligas y antes
    // contaba solo la que tenía abierta: ahora, todas las que manda (`ligas`; las webs de antes, solo `liga`). Se juntan por la
    // liga que más cuentas comparten: la más grande se lleva a todas las suyas, después la siguiente con las que quedan, y así.
    const cuantas = new Map();
    for (const x of fuera) for (const k of ligasDe(x)) cuantas.set(k, (cuantas.get(k) || 0) + 1);
    const orden = [...cuantas].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1] || (a[0] === ligaId ? -1 : b[0] === ligaId ? 1 : 0));
    const puesta = new Set(), porLiga = new Map();
    for (const [k] of orden) {
      const l = fuera.filter((x) => !puesta.has(x) && ligasDe(x).includes(k));
      if (l.length > 1) { porLiga.set(k, l); for (const x of l) puesta.add(x); }
    }
    for (const x of fuera) if (!puesta.has(x)) { const k = String(x.liga || '') || ligasDe(x)[0] || ''; if (!porLiga.has(k)) porLiga.set(k, []); porLiga.get(k).push(x); }
    const juntas = [...porLiga].filter(([k, l]) => k && l.length > 1).sort((a, b) => b[1].length - a[1].length || b[1][0].ultima - a[1][0].ultima);
    const solas = [...porLiga].filter(([k, l]) => k && l.length === 1).map(([, l]) => l[0]);
    const sinLiga = porLiga.get('') || [];
    const nLigas = juntas.length + solas.length;
    const fila = (x) => filaQuien(x.nombre || 'Sin nombre', x.equipo && norm(x.equipo) !== norm(x.nombre || '') ? x.equipo : '', x, ahora, minPlay);
    h += `<div class="grupo"><span>${tabla.length ? 'Otras ligas' : 'Cuentas'} · ${fuera.length}${nLigas ? ` · ${nLigas} liga${nLigas > 1 ? 's' : ''}${sinLiga.length ? ` y ${sinLiga.length} sin liga` : ''}` : ''}</span></div>`;
    h += `<p class="q-no">${juntas.length ? `${juntas.length} liga${juntas.length > 1 ? 's' : ''} con más de una cuenta (${juntas.reduce((t, [, l]) => t + l.length, 0)} cuentas).` : 'Ninguna comparte liga: cada cuenta es de una liga distinta.'}</p>`;
    for (const [k, l] of juntas) h += `<div class="grupo"><span>${k === ligaId ? 'Tu liga' : `Liga ${esc(k)}`} · ${l.length} cuentas</span></div><div class="quien-l">${l.sort((a, b) => b.ultima - a.ultima).map(fila).join('')}</div>`;
    if (solas.length) h += `<div class="grupo"><span>Una cuenta por liga · ${solas.length}</span></div><div class="quien-l">${solas.sort((a, b) => b.ultima - a.ultima).map(fila).join('')}</div>`;
    if (sinLiga.length) h += `<div class="grupo"><span>Sin liga todavía · ${sinLiga.length}</span></div><div class="quien-l">${sinLiga.sort((a, b) => b.ultima - a.ultima).map(fila).join('')}</div>`;
  }
  return h || '<p class="quien-res">Aún no ha entrado nadie.</p>';
}
const DONDE_Q = { web: 'Web', play: 'Play', ios: 'iOS', github: 'APK', 'web-iphone': 'iPhone', 'web-pc': 'Ordenador', 'web-android': 'Web Android' };
/** desde dónde entra una cuenta: play, github o, en la web, el aparato (web-iphone, web-pc, web-android; web si no se sabe) */
function dondeQ(x) { const c = x.canal || 'web'; return c === 'web' && x.disp ? x.disp : c; }
function filaQuien(nombre, equipo, x, ahora, minPlay) {
  const esta = ahora - x.ultima < DENTRO_Q;
  const v = webDe(x), atras = !!v && cmpVer(v, VERSION) < 0;
  const p = problemaDe(x, minPlay);
  const chips = [
    `<i class="q-chip">${esc(DONDE_Q[dondeQ(x)] || 'Android')}${x.canal !== 'web' && x.app > 0 ? ` ${esc(String(x.app))}` : ''}</i>`,
    v ? `<i class="q-chip${atras ? ' viejo' : ''}">${esc(v)}</i>` : '',
    p ? `<i class="q-chip mal">${esc(p.corto)}</i>` : '',
  ].join('');
  const marcas = [diaDe(x.ultima) === diaDe(ahora) || x.segHoy > 0 ? 'hoy' : '', ahora - x.ultima < 7 * DIA ? 'sem' : '', p ? 'prob' : '', x.canal === 'play' ? 'play' : '', x.canal === 'ios' ? 'ios' : '', (x.canal || 'web') === 'web' ? 'web' : ''].filter(Boolean).join(' ');
  return `<div class="quien-f ${esta ? 'dentro' : 'si'}" data-b="${esc(norm(`${nombre} ${equipo || ''} ${x.equipo || ''} ${x.nombre || ''}`))}" data-f="${marcas}"><span class="qf-p" aria-hidden="true"></span><div class="qf-c"><b>${esc(nombre)}</b><span>${esc(equipo || '')}${equipo ? ' · ' : ''}${esta ? 'ahora' : cuando(x.ultima)}${x.segHoy ? ` · ${minQ(x.segHoy)} hoy` : ''}</span><span class="q-chips">${chips}</span>${(() => { const q = queLePasa(p, x, minPlay); return q ? `<span class="qf-por">${esc(q[0])} <b>${esc(q[1])}</b></span>` : ''; })()}</div></div>`;
}

/** segundos de app en horas y minutos: «menos de 1 min», «25 min», «1 h 05 min» */
export function tiempoTxt(seg) {
  const m = Math.floor((Number(seg) || 0) / 60);
  if (m < 1) return 'menos de 1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/* ================= DIAGNÓSTICO ================= */
/* los modelos de la IA, como «IA 1», «IA 2»… para quien no es el dueño (revisión total, B3: nunca nombres de modelos en la
   app). El número es su sitio en la lista de tu clave; los que no están en ella, detrás. Tapa también los ids que vengan
   dentro de un mensaje de Google («models/gemini-…»). */
function nombresIA() {
  if (avisosGuardados().admin) return { m: (x) => x || '', t: (x) => x || '' };
  const orden = [...((((LS.get('ia-modelos', {}) || {}).lista) || []))];
  const m = (x) => {
    if (!x) return '';
    const id = String(x).replace(/^models\//, '');
    let i = orden.indexOf(id);
    if (i < 0) { orden.push(id); i = orden.length - 1; }
    return `IA ${i + 1}`;
  };
  const t = (x) => (x ? String(x).replace(/\b(?:models\/)?(?:gemini|gemma|learnlm|imagen)-[\w.-]*/gi, (y) => m(y)).replace(/\b(?:Gemini|Gemma)(?: [\d.]+)?(?: (?:Pro|Flash|Lite|Flash-Lite|Nano|Ultra|It|\(preview\)))*/g, 'la IA') : '');
  return { m, t, lista: () => orden };
}
/** (26 nov) solo en una liga premium: qué funciones tiene encendidas y CÓMO vienen de LaLiga el capitán, el banquillo, los
 *  cedidos y los movimientos (nombres de campos y tipos, sin datos de nadie). Es la manera de confirmar lo que aún no se
 *  ha visto de las ligas premium (claude/nota-premium.md del proyecto, «Por confirmar») */
function premiumDiag(D, M) {
  const L = D.liga || {}, pf = L.pf || {}, pc = L.pc || {};
  const on = Object.keys(pf).filter((k) => pf[k]);
  const g = LS.get(K('mi-once'), null), pr = (g && g.pr) || null;
  const ents = ((M && M.mias) || []).filter((x) => x.j && x.j.pos === 5).length;
  const ced = (D.clasif || []).reduce((n, e) => (e && e.cedidos != null ? (n || 0) + e.cedidos : n), null);
  return `Premium: ${on.length ? on.join(', ') : L.pf ? 'ninguna función encendida' : 'funciones sin leer (liga guardada de antes)'}`
    + ` · 11 ideal ${pc.ideal != null ? pc.ideal : '¿?'} · cesiones máx ${pc.cesionMax != null ? pc.cesionMax : '¿?'}, mín ${pc.cesionMin != null ? pc.cesionMin : '¿?'}`
    + ` · capitán ${pr ? (pr.hay && pr.hay.capitan ? `${pr.capF || '¿?'} → ${pr.cap ? 'reconocido' : 'SIN RECONOCER'}` : 'sin poner') : 'sin mirar'}`
    + ` · banquillo ${pr ? (pr.hay && pr.hay.banquillo ? `${pr.banqF || '¿?'} → ${Object.keys(pr.banq || {}).length} reconocidos` : 'vacío') : 'sin mirar'}`
    + ` · entrenador ${pr && pr.ent ? 'alineado' : 'sin alinear'} (${ents} en plantilla)`
    + ` · cedidos ${ced == null ? '¿?' : ced}${D.muestras && D.muestras.cedido ? ` ${D.muestras.cedido}` : ''}`
    + ` · tipos: ${Object.entries((M && M.histTipos) || {}).map(([k, x]) => `${k}×${x.n}${x.conImporte ? `(${x.conImporte}€)` : ''}`).join(' ') || '¿?'}`;
}
export function textoDiagnostico(S) {
  const s = sesion();
  const D = S.D;
  const ia = nombresIA();
  const L = [
    `Fantasy Manager ${VERSION} · compilación ${nativo.version()} · ${enApp ? `app (${nativo.canal()})` : enWeb ? 'web' : 'navegador sin servidor'}${enDemo() ? ' · DEMO' : ''}`,
    `Cuenta de LaLiga: ${(D && D.yo && D.yo.userId) || (avisosGuardados().yo) || '¿?'}`,
    ...(enApp ? [(() => { const w = nativo.estadoWeb(); if (!w) return 'Web al día sola: no (APK de antes)'; const ios = nativo.canal() === 'ios'; return `Web al día sola: ${ios ? 'app' : 'APK'} con la ${w.propia || '¿?'} · ${w.activa ? `puesta la ${w.activa} (${w.archivos} archivos, ${horaDe(w.bajada)})` : (ios ? 'usa la de la app' : 'usa la del APK')} · mirado ${w.mirada ? horaDe(w.mirada) : 'aún no'} · parte ${ios ? 'iOS' : 'Android'} ${w.nativo}${w.error ? ` · último fallo: ${w.error}` : ''}${w.via ? ` · bajada del ${w.via}` : ''}`; })()] : []),
    // (21 nov) por dónde entra la app en LaLiga: con Auth Tab Android no pregunta «Abrir con»
    ...(enApp ? [(() => { const v = LS.get('login-via', null); return `Entrada con LaLiga: ${nativo.canal() === 'ios' ? 'por la ventana de inicio de sesión del iPhone' : nativo.authTab() ? 'por Auth Tab (Android no pregunta «Abrir con»)' : 'por pestaña normal (Android puede preguntar «Abrir con»)'}${v && v.t ? ` · última entrada: ${v.via === 'authtab' ? 'por Auth Tab' : v.via === 'sesion-ios' ? 'por la ventana del iPhone' : v.via === 'intent' ? 'por el camino de antes (intent)' : 'no se sabe (app de antes)'}, ${horaDe(v.t)}` : ''}`; })()] : []),
    // (27 nov, iOS 5) por qué salen o no los anuncios de la app (intersticial.js)
    ...(enApp ? [(() => { try { return diagAnuncios(); } catch (e) { return `Anuncios (app): ✗ ${e.message}`; } })()] : []),
    // (25 nov, tanda 5) el último fallo al entrar, con lo que contestó LaLiga
    (() => { const f = LS.get('entrada-fallo', null); return f && f.t ? `Último fallo al entrar: ${f.paso}${f.cod ? ` · ${f.cod}` : ''} · ${horaDe(f.t)}` : 'Último fallo al entrar: ninguno'; })(),
    `Sesión: ${s ? `caduca ${new Date(s.caduca).toISOString()} · renovar ${s.renovar ? 'sí' : 'no'}` : 'no'}`,
    D ? `Datos: ${new Date(D.t).toISOString()} · liga ${D.liga && D.liga.id} · equipos ${D.clasif.length} · mío ${D.yo.teamId || '¿?'} · jugadores ${Object.keys(D.maestro).length} (con cara ${Object.values(D.maestro).filter((j) => j.img).length}) · mercado ${D.mercado.length} (${D.mercado.filter((m) => m.tipo === 'manager').length} de managers${S.M && S.M.mercadoFantasma && S.M.mercadoFantasma.length ? `, ${S.M.mercadoFantasma.length} ya con dueño quitados` : ''}) · actividad ${D.actividad.length} (con nombre ${D.actividad.filter((a) => a.quien).length}, con id ${D.actividad.filter((a) => a.quienId).length}) · partidos ${D.partidos.length} · tendencias ${Object.keys(D.tendencias || {}).length} · dinero ${D.dinero}` : 'Sin datos',
    D && D.avisos && D.avisos.length ? `Fallos: ${D.avisos.map((a) => `${a.paso}: ${a.e}`).join(' | ')}` : 'Sin fallos',
    (() => {
      // la jornada en directo (vivo.js): lo que ha llegado de LaLiga
      const v = S.vivo;
      if (!S.M || !S.M.enJuego) return 'Directo: sin jornada en juego';
      if (!v) return `Directo: J${S.M.enJuego.n} sin datos todavía`;
      const ps = Array.isArray(v.ps) ? v.ps : [];
      return `Directo: J${v.n}${S.M.vivo ? '' : ' (no es la de ahora)'} · ${horaDe(v.t)} · partidos ${ps.length} (${ps.filter((p) => p.jug && p.jug.length).length} con puntos, ${ps.filter((p) => p.st != null).length} con estado) · jugadores con puntos ${Object.keys(v.puntos || {}).length} · tu once ${v.once ? v.once.length : 'no'} · equipos ${Object.keys(v.equipos || {}).length}${S.jugadas ? ` · jugadas SofaScore ${Object.keys(S.jugadas).length}` : ''}`;
    })(),
    // en la web: por qué intermediario van los datos (el Worker de Cloudflare o, si no contesta, el de Deno)
    ...(enWeb ? [(() => { const x = estadoProxy(); if (!x) return 'Intermediario: ¿?'; return `Intermediario: ${x.ahora === 'deno' ? 'Deno (el Worker no contestaba)' : 'Worker'}${x.hay ? '' : ' · sin segundo'}${x.cambios ? ` · pasó a Deno ${x.cambios} ${x.cambios > 1 ? 'veces' : 'vez'}, la última ${horaDe(x.ultimo)} (${x.porque})` : ''}${x.usos ? ` · ${x.usos} peticiones por Deno` : ''}`; })()] : []),
    S.errorCarga ? `Última carga: ✗ ${S.errorCarga.tipo} · ${S.errorCarga.detalle} (${horaDe(S.errorCarga.t)})` : 'Última carga: bien',
    ocupado(),
    ...(D && D.liga && D.liga.premium === true ? [premiumDiag(D, S.M)] : []),
    `Ligas: ${D && D.ligas ? D.ligas.map((l) => `${l.id}${l.acceso || l.tipo ? ` [${l.acceso || '?'}/${l.tipo || '?'}]` : ''}${l.premium ? ' (premium)' : ''}${D.liga && l.id === D.liga.id ? ' ←' : ''}`).join(', ') : '¿?'} · pantalla ${typeof innerWidth !== 'undefined' ? `${innerWidth}×${innerHeight}` : '?'}${medidasVista()} · ${typeof navigator !== 'undefined' && navigator.onLine === false ? 'SIN RED' : 'con red'}`,
    // (26 nov) lo que se manda de la liga para lo de todas las ligas (otras-ligas.js) y si se enseña algo
    (() => {
      if (!D || !D.liga || enDemo()) return 'Otras ligas: nada (liga de ejemplo o sin liga)';
      const e = LS.get(K('ligas-env'), null), ap = LS.get(K('ligas-aperturas'), {}), c = LS.get(K('pujas-mandadas'), null), ah = LS.get(K('acthist'), null), o = otrasLigasCfg();
      const manda = !mejorarIA() ? 'no se manda nada («Ayudar a mejorar la IA», apagado)'
        : `último envío ${e && e.t ? `${cuando(e.t)} (${e.dia === diaDe() ? e.n || 0 : 0} hoy)` : 'ninguno'}${e && e.mal ? ` · falló ${cuando(e.mal)}` : ''}${e && e.tope && e.dia === diaDe() ? ` · por hoy no cabe más (${e.tope === 'ligas' ? 'esta cuenta ya manda de 2 ligas' : e.tope === 'ajena' ? 'LaLiga no da esta liga como de esta cuenta' : 'los envíos del día'})` : ''} · ${Object.keys(ap || {}).length} cláusulas apuntadas · compras ${c && c.jug ? 'con jugador' : 'aún sin jugador'} · movimientos sin huecos ${ah && ah.seguido ? `desde ${cuando(ah.seguido)}` : 'aún no se sabe'}`;
      return `Otras ligas: ${manda} · se enseña: ${[o.pagado ? 'lo pagado' : '', o.demanda ? 'la demanda' : ''].filter(Boolean).join(' y ') || 'nada'}`;
    })(),
    ...(erroresApp.length ? ['Errores de la app:', ...erroresApp.map((x) => `  ${horaDe(x.t)} ${x.m}${x.donde ? ` (${x.donde})` : ''}`)] : []),
    `Fuentes: onces ${S.M && S.M.hayOnces ? `${Object.keys(((S.fuentes || {}).onces || {}).jugadores || {}).length} jugadores, ${((S.fuentes || {}).onces || {}).equipos ?? '?'}/${((S.fuentes || {}).onces || {}).de ?? '?'} equipos` : 'no'} · noticias ${S.M ? S.M.noticias.length : 0}${S.M && S.M.noticiasFallo ? ` (${S.M.noticiasFallo.viejas ? 'las de antes: ' : ''}${S.M.noticiasFallo.fallo})` : ''} · avanzadas ${S.M && S.M.fuentesAv ? Object.entries(S.M.fuentesAv).map(([k, v]) => `${k} ${v}`).join(', ') : 'sin datos'} · histórico de valor ${LS.get('ruta-valor', null) != null ? `ruta ${LS.get('ruta-valor')}` : LS.get('ruta-valor-falla', 0) ? 'ninguna ruta' : 'sin probar'}`,
    (() => {
      const M = S.M;
      if (!D || !M || !M.dineroDe) return 'Dinero de los rivales: sin datos';
      if (bloqueada('dineroRivales')) return 'Dinero de los rivales: bloqueado en esta cuenta';
      const m1 = (v) => String(Math.round(num(v) / 1e5) / 10);
      const ex = Object.entries(D.dineros || {}).filter(([tid]) => tid !== D.yo.teamId);
      const hm = M.histMov || {};
      return `Dinero de los rivales: ${ex.length ? `${ex.length} exactos (${[...new Set(ex.map(([, x]) => x.fuente))].join(', ')})` : 'ninguno exacto'} · el resto estimado con ${hm.n || 0} movimientos desde ${hm.desde ? new Date(hm.desde).toISOString().slice(0, 10) : '?'}${hm.completa ? ' (desde el principio)' : ' (no llega al principio)'} · ${M.rivales.map((r) => `${r.e.manager || r.e.nombre} ${bloqueada('dineroRivales', r.e.teamId) ? 'cerrado' : r.dinero && r.dinero.v != null ? `${r.dinero.exacto ? '' : '≈'}${m1(r.dinero.v)}M` : `? (${(r.dinero && r.dinero.motivo) || 'sin datos'})`}`).join(', ')}`
        // de dónde sale cada cifra: la base común, y por rival lo movido, las subidas de cláusula y lo que te dijo
        + (M.baseDinero ? `\n  base: tu saldo ${m1(M.baseDinero.saldo)}M − tus movimientos ${m1(M.baseDinero.mov)}M + tus subidas de cláusula ${m1(M.baseDinero.subidas)}M = ${m1(M.baseDinero.v)}M (debería estar entre ${m1(M.baseDinero.min)} y ${m1(M.baseDinero.max)}M${M.baseDinero.desvio ? `: NO CUADRA por ${m1(M.baseDinero.desvio)}M` : ''})` : '')
        + `\n  tipos: ${Object.entries(M.histTipos || {}).map(([k, x]) => `${k}×${x.n}${x.conImporte && x.conImporte !== x.n ? ` (${x.conImporte} con importe)` : ''}`).join(' ')} · clausulazos detectados ${M.czDetectados || 0}`
        // (0.8.4o) de un rival con su dinero cerrado, nada: ni la cuenta ni lo que te dijo
        + M.rivales.filter((r) => !(r.dinero && r.dinero.exacto) && !bloqueada('dineroRivales', r.e.teamId)).map((r) => {
          const f = (M.flujos || {})[r.e.teamId] || {}, sb = (M.subidas || {})[r.e.teamId] || {}, dc = r.dinero && r.dinero.dicho, cu = M.dineroCuenta ? M.dineroCuenta(r.e.teamId) : null;
          return `\n  ${r.e.manager || r.e.nombre}: mov ${m1(f.v || 0)}M (gasta ${m1(f.gastado || 0)}, ingresa ${m1(f.ingresado || 0)}, premios ${m1(f.premios || 0)}${f.raros ? `, ${f.raros} raros` : ''}) · subidas −${m1(sb.v || 0)}M en ${sb.n || 0}${sb.vistas ? ` (${sb.vistas} vistas)` : ''}${sb.sinBase ? ` · ${sb.sinBase} sin base` : ''} · cuenta ${cu && cu.v != null ? `${m1(cu.v)}M ±${m1(cu.margen)}${cu.partes ? ` (fija ${m1(cu.partes.fija)} + recompensas ${m1(cu.partes.rec)} + subidas dudosas ${m1(cu.partes.dudas)} + base ${m1(cu.partes.desvio)} + raros ${m1(cu.partes.raros)}${cu.centro ? `; centro ${cu.centro > 0 ? '+' : ''}${m1(cu.centro)}` : ''})` : ''}` : '?'}${dc ? ` · te dijo ${m1(dc.v)}M ${new Date(dc.t).toISOString().slice(5, 16)}${dc.est != null ? ` (la cuenta daba ${m1(dc.est)}M)` : ''}` : ''}`;
        }).join('');
    })(),
    S.M ? `Clausulazos: ${S.M.clausulazos ? `${S.M.clausulazos.n}, mediana ${pct(S.M.clausulazos.med * 100)}, p90 ${pct(S.M.clausulazos.p90 * 100)}` : 'ninguno medible'} · Ofertas de LaLiga: ${S.M.ofertaLiga ? `${S.M.ofertaLiga.n} ventas, mediana ${pct(S.M.ofertaLiga.med * 100)}${S.M.ofertaLiga.poco ? ' (pocas)' : ''}` : 'sin ventas a LaLiga medibles'} · Pujas de la liga: ${S.M.pujasLiga ? `${S.M.pujasLiga.n} compras, mediana ${pct(S.M.pujasLiga.med * 100)}${S.M.pujasLiga.poco ? ' (pocas)' : `, p25 ${pct(S.M.pujasLiga.p25 * 100)}, p75 ${pct(S.M.pujasLiga.p75 * 100)}${(S.M.pujasLiga.tramos || []).map((x) => ` · ${x.desde === 0 ? '<' : ''}${eur(x.desde === 0 ? x.hasta : x.desde, { dec: 0 })}${x.desde && x.hasta !== Infinity ? `-${eur(x.hasta, { dec: 0 })}` : x.hasta === Infinity ? '+' : ''}: ${x.n}, med ${pct(x.med * 100)}, p90 ${pct(x.p90 * 100)}`).join('')}`}` : 'sin compras al mercado medibles'} · tus pujas: ${S.M.misPujasRes ? `${S.M.misPujasRes.ganadas} de ${S.M.misPujasRes.n} ganadas, ajuste ${pct(S.M.misPujasRes.ajuste * 100, 1)}` : 'ninguna vista'} · pujas de todas las ligas: ${S.M.calPujas ? S.M.calPujas.n : 'sin leer'} · aprendizaje: ${S.M.aprende && S.M.aprende.prev ? (S.M.aprende.prev.poco ? `${S.M.aprende.prev.pares} pares (pocos)` : `${S.M.aprende.prev.pares} pares, error ${S.M.aprende.prev.mae.final}, peso desglose ${S.M.aprende.prev.w}, sesgo ${JSON.stringify(S.M.aprende.prev.sesgo)}`) : 'sin jornadas evaluadas'}${S.M.aprende && S.M.aprende.planes ? ` · planes ${S.M.aprende.planes.bien}/${S.M.aprende.planes.n}` : ''}` : '',
    `IA: clave ${hayClave() ? 'sí' : 'no'} · modelos ${(((LS.get('ia-modelos', {}) || {}).lista) || []).map(ia.m).join(', ') || '¿?'}`,
    ...intentosIA.slice(0, 20).map((x) => `  ${horaDe(x.t)} ${ia.m(x.modelo)}${x.web ? ' +web' : ''}${x.nivel ? ` ·${x.nivel}` : ''}${x.relevo ? ' (relevo)' : ''} ${x.ok ? `OK${x.fin && x.fin !== 'STOP' ? ` ${x.fin}` : ''}${x.car != null ? ` ${x.car} car.` : ''}${x.tok ? ` (tokens: ${x.tok.p ?? x.tok.entra ?? '?'} entran, ${x.tok.th ?? 0} pensando, ${x.tok.r ?? x.tok.sale ?? '?'} escritos)` : ''}` : `✗ ${x.s} ${ia.t(x.e)}`}${x.google ? ` «${ia.t(x.google)}»` : ''} ${x.ms}ms`),
    (() => {
      const uf = ultimoFondo(), nf = nativo.estadoFondo() || {};
      return `Segundo plano: ${!nativo.hayFondo() ? 'no lo hay en esta app' : cfgFondo().on ? 'sí' : 'no'}${nf.ini ? ` · empezó ${new Date(nf.ini).toISOString()}` : ''}${nf.fin ? ` · acabó ${new Date(nf.fin).toISOString()}` : ''}${nf.prog ? ` · próxima tras el mercado ${new Date(nf.prog).toISOString()}` : ''}${nf.error ? ` · ✗ ${nf.error}` : ''}${uf ? ` · web: ${(uf.pasos || []).join(' / ')}${uf.error ? ` ✗ ${uf.error}` : ''} (${Math.round((uf.ms || 0) / 1000)} s${uf.avisos != null ? `, ${uf.avisos} avisos` : ''})` : ''}`;
    })(),
    ...((ultimoFondo() || {}).ia || []).map((x) => `  [fondo] ${horaDe(x.t)} ${ia.m(x.modelo)}${x.web ? ' +web' : ''} ${x.ok ? 'OK' : `✗ ${x.s} ${ia.t(x.e)}`} ${x.ms}ms`),
    '',
    ...registro.slice(0, 50).map((r) => `${horaDe(r.t)} ${r.s} ${r.ms}ms ${r.ruta}${r.e ? ' ✗ ' + r.e : ''}${r.forma ? ' → ' + r.forma : ''}${r.nota ? ' (' + r.nota + ')' : ''}`),
  ];
  if (D && D.muestras) {
    L.push('', 'MUESTRAS (para ver los nombres de los campos):');
    for (const [k, v] of Object.entries(D.muestras)) L.push(`${k}: ${v}`);
  }
  const mv = muestrasVivo();
  if (Object.keys(mv).length) {
    L.push('', 'MUESTRAS DE LA JORNADA EN DIRECTO (lo que da LaLiga):');
    for (const [k, v] of Object.entries(mv)) L.push(`${k} (${horaDe(v.t)}): ${v.txt}`);
  }
  return L.join('\n');
}
/** el diagnóstico que sale del móvil (aviso de fallo, copiar o compartir): los demás de tu liga van como «Rival N» y
    «Equipo N» y sin su foto, porque son datos de otras personas. El dueño (Carlos) lo ve y lo manda entero. */
export function diagnosticoParaMandar(S) {
  const t = textoDiagnostico(S);
  if (avisosGuardados().admin) return t;
  const sd = seudonimos(S.D);
  return sd.tapar(t).replace(/("(?:avatar|photo|image|foto)"\s*:\s*)"[^"]*"/gi, '$1"…"');
}
/** lo que ocupa lo guardado en este dispositivo (el navegador deja unos 5 MB): el total y lo que más pesa */
function ocupado() {
  try {
    const t = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('fm-')) t.push([k.slice(3), (localStorage.getItem(k) || '').length * 2]);
    }
    const mb = (b) => `${(b / 1048576).toFixed(2).replace('.', ',')} MB`;
    t.sort((a, b) => b[1] - a[1]);
    return `Guardado: ${mb(t.reduce((s, x) => s + x[1], 0))} en ${t.length} claves (${t.slice(0, 4).map(([k, b]) => `${k} ${mb(b)}`).join(', ')})`;
  } catch (e) { return 'Guardado: no se puede mirar'; }
}
/** para el fallo de la barra de abajo en el iPhone: lo que Safari dice que se ve y dónde acaba la barra */
function medidasVista() {
  try {
    const vv = window.visualViewport, n = document.querySelector('.nav');
    const dy = getComputedStyle(document.documentElement).getPropertyValue('--ios-dy').trim();
    return `${vv ? ` · se ve ${Math.round(vv.height)}${vv.offsetTop ? `+${Math.round(vv.offsetTop)}` : ''}` : ''}${n ? ` · barra hasta ${Math.round(n.getBoundingClientRect().bottom)}` : ''}${dy && dy !== '0px' ? ` (bajada ${dy})` : ''}`;
  } catch (e) { return ''; }
}
export function diagnostico(S) {
  return `<div class="hoja-cab"><h2>Diagnóstico</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
  <p class="t2 peq">Lo que han contestado LaLiga y Google en esta sesión. Si algo no funciona, cópialo y pásamelo.</p>
  <pre class="diag" tabindex="0">${esc(textoDiagnostico(S))}</pre>
  <div style="display:flex;gap:10px;margin-top:12px"><button class="btn chico" data-accion="copiarDiag">${icono('copiar')}Copiar</button><button class="btn chico sec" data-accion="compartirDiag">Compartir</button></div>`;
}
