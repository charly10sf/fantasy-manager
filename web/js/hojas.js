/* Las ventanas que suben desde abajo: la ficha de un jugador, la de un rival, los ajustes y el diagnóstico. */
import { erroresApp } from './errores.js';
import { avisosGuardados } from './soporte.js';
import { esc, eur, pct, dura, cuenta, cuando, icono, clase, POS_LARGO, POS_PLURAL, num, horaDe, LS, DIA, diaDe, norm, fechaCorta, firmaDe } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, filaJugador, nada, oncePill, filaNoticia, nivelCls, calendarioHTML, dineroCorto, dineroLargo, candado, candadosJuntos, enCasaDe, BLOQUEO, ventasDe, campoVivo, estiloClub, caraManager } from './comunes.js';
import { linea, barra, mini } from './graficos.js';
import { filaActividad, PELIGRO, PELIGRO_TXT, ventaHTML, puntosUltimaJornada, descartePlan } from './vistas.js';
import { hayClave, clave, cfgIA, nombreModelo, intentosIA, notasDe, seudonimos } from './ia.js';
import { cfgAvisos, programados, OPC_ANTES, antesTxt } from './avisos.js';
import { nativo, enApp, enWeb, enIPhone, enInicio, estadoProxy } from './puente.js';
import { hayAnunciosWeb } from './anuncios-web.js';
import { registro } from './api.js';
import { qrSVG } from './qr.js';
import { quien, sesion } from './auth.js';
import { EVENTOS } from './eventos.js';
import { VERSION, cmpVer } from './version.js';
import { enDemo } from './datos.js';
import { cfgFondo, ultimoFondo } from './fondo.js';
import { hayImportantes, ultimaImportante } from './presentacion.js';
import { estadoLimite, novedadesPara, bloqueada, POR_JORNADA, faltanAnuncios, usosQuedan, usosPorJornada, minutosPorVez } from './limite.js';
import { jornadaJugadorHTML } from './directo.js';
import { aviso, avisoDeTexto, parrafos, inerciaPlanHTML } from './avisos-ficha.js';
import { muestrasVivo } from './vivo.js';
import { esFav } from './favoritos.js';

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
  const vender = mias.filter((x) => x.ventaInercia).sort((a, b) => b.ventaInercia.perder - a.ventaInercia.perder);
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
    <div class="dato"><div class="et">Puedes gastar</div><div class="v">${eur(M.pujaMax)}<small>con el 20 % de deuda${num(M.misPujas) ? ', ya sin lo pujado' : ''}</small></div></div>
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
  if (op && !planDentro) h += avisoDeTexto(S, { k: 'plan', pid, ico: 'rayo', texto: op.motivo || '', t: `Plan de hoy: ${op.etiqueta || ACC[op.accion] || op.accion}${op.importe ? ` por ${eur(op.importe)}` : ''}${op.puja_max && eur(op.puja_max) !== eur(op.importe) ? ` (puja hasta ${eur(op.puja_max)})` : ''}` });
  // si el plan lo descarta (por dinero o por pagar de más), también aquí: la puja del mercado no es una recomendación
  const dpl = !op && descartePlan(S, pid);
  if (dpl) h += avisoDeTexto(S, { k: 'descarte', pid, cls: 'oro', ico: 'alerta', t: `Plan de hoy: no ${dpl.accion === 'comprar' ? 'lo compres' : 'pujes'}`, texto: dpl.aviso || '' });
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
    const gratis = mia.abierta && S.M.paraEscudo && S.M.paraEscudo.includes(pid) ? `<b>Blíndalo gratis</b> (en LaLiga, viendo un anuncio): ${S.M.ESCUDO_H} h protegido. Te quedan ${S.M.escudosMios.quedan} esta jornada.` : '';
    const liga = !ol || S.M.enVenta.has(pid) ? ''
      : `Si lo pones a la venta, LaLiga te da unos <b>${eur(ol.v)}</b>${gana != null ? ` (<b class="${clase(gana)}">${eur(gana, { signo: true })}</b> sobre ${mia.compra ? 'lo que pagaste' : 'lo que valía al empezar'})` : ''}. ${ol.sinDatos ? 'Aún no hay ventas a LaLiga en tu liga: el cálculo va cerca de su valor.' : `En tu liga da entre ${eur(ol.min)} y ${eur(ol.max)}, de mediana un ${pct(ol.med * 100)} sobre el valor.`}`;
    if (gratis || liga) h += `<div class="aviso-ficha verde peq">${icono('escudo')}<div>${[gratis, liga].filter(Boolean).join(' ')}</div></div>`;
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
        // (37) «Lo vende…»: a la vista, lo que pide y lo que hay que ofrecerle; dentro, cómo funciona la venta
        const sobre = `${pct((m.sobrePide || 0) * 100)} sobre su valor`;
        const ofrece = m.ofertaMin && !m.noVende && !vb;
        const oL = m.ofertaLiga;
        const liga = !oL ? '' : oL.sinDatos || vb ? 'LaLiga también le hace su oferta y se queda con la mejor: lo que pide no basta.'
          : `LaLiga también le hace su oferta, que solo ve él: en tu liga suele rondar <b>${eur(oL.v)}</b> (de mediana un ${pct(oL.med * 100)} sobre el valor, en ${oL.n} ventas). Se queda con la mejor${m.precio >= oL.v ? ': aquí pide más que eso, así que manda su precio' : ': por menos lo normal es que no te lo venda'}.`;
        h += aviso(S, { k: 'vende', pid, cls: 'oro', ico: 'usuario', t: `Lo vende ${esc(m.vendedor || 'otro manager')}`,
          l: m.noVende ? `Pide ${eur(m.precio)}, pero lo normal es que no te lo venda` : ofrece ? (eur(m.puja || m.ofertaMin) === eur(m.precio) ? `Pide ${eur(m.precio)} (${sobre}): ofrécele eso` : `Pide ${eur(m.precio)} (${sobre}) · ofrécele ${eur(m.puja || m.ofertaMin)}`) : `Pide ${eur(m.precio)} (${sobre})`,
          d: parrafos(`Sigue siendo suyo: solo es tuyo si acepta tu oferta. No es un jugador libre de la liga.${m.ofertas ? ` Lleva ${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''} (cuánto, solo lo ve él).` : ''}`,
            liga,
            m.noVende ? `<b>Pero ${esc(m.noVende)}:</b> si lo vendiera no podría alinear un once, así que lo normal es que no te lo venda (lo tendrá a la venta para ver qué le da LaLiga).` : '',
            ofrece && m.ofertaAlta > m.ofertaMin ? (m.puja === m.ofertaAlta ? `Esa oferta es la más probable: con ${eur(m.ofertaMin)} tienes opciones, pero puede que LaLiga le dé más.` : `Con ${eur(m.ofertaAlta)} es muy probable que te lo venda.`) : '',
            m.miPuja ? `Tu oferta: ${eur(m.miPuja)}${m.ofertaMin && m.miPuja < m.ofertaMin ? ', por debajo de lo que suele dar LaLiga: súbela o lo normal es que no la acepte' : ''}.` : '') });
        if (vb && m.ofertaMin && !m.noVende) h += candado('ventasRivales');
      } else {
        // (37) «Libre en el mercado»: a la vista, desde cuánto y lo que haría la app; dentro, la subasta y lo que se paga en tu liga
        const noPuja = cc && !cc.ok && !espX;
        const PV = M.pagaLiga && m.j.valor ? M.pagaLiga(m.j.valor) : null;
        const lineaL = m.miPuja ? `Desde ${eur(m.precio)} · tu puja: ${eur(m.miPuja)}` : cc && !cc.ok && espX ? `Desde ${eur(m.precio)} · para revender, la app pujaría ${eur(espX)}` : noPuja ? `Desde ${eur(m.precio)} · con su calendario, la app no pujaría` : `Desde ${eur(m.precio)} · la app pujaría ${eur(m.puja)} (${pct((m.puja / m.precio - 1) * 100)})`;
        const cal = m.miPuja ? '' : cc && !cc.ok && espX ? 'Para revender da igual su calendario.' : noPuja ? `Con su calendario no pujaría por él${cc.parche ? `: sale ya a un ${pct(cc.sobre * 100)} sobre su valor y de parche no pagaría más de un ${pct(cc.cal.maxSobre * 100, 0, false)}` : ' salvo que te haga falta de parche'}.` : '';
        const liga = PV ? `Por los más parecidos que se han comprado en tu liga (de ${eur(PV.desde)} a ${eur(PV.hasta)}) se ha pagado de mediana un ${pct(PV.med * 100)} sobre su valor, y el 90 % hasta un ${pct(PV.p90 * 100)}.` : M.pujasLiga && !M.pujasLiga.poco ? `En tu liga se paga de mediana un ${pct(M.pujasLiga.med * 100)} sobre el valor.` : '';
        const tope = m.topeCal && (!cc || cc.ok) ? `La app la deja en un ${pct(((cc && cc.cal && cc.cal.maxSobre) || 0.05) * 100, 0, false)} sobre su valor como mucho por su calendario: es solo de parche.` : m.recortada ? 'La app la deja más baja para no pagar de más por lo que te aporta.' : '';
        h += aviso(S, { k: 'libre', pid, cls: 'azul', ico: 'mercado', t: 'Libre en el mercado de la liga', l: lineaL,
          d: parrafos(`Subasta a ciegas${m.cierra ? ` hasta ${esc(cuando(m.cierra))}` : ''}: gana la puja más alta. ${m.pujas ? `${m.pujas} puja${m.pujas > 1 ? 's' : ''}.` : 'Sin pujas.'}`, cal, liga, tope) });
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
  } else h += `<div class="aviso-ficha">${icono('info')}<div>Es entrenador: en la versión gratis no se alinea ni puntúa. Si es tuyo, véndelo y usa el dinero en jugadores.</div></div>`;
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
  const tDinero = bloqueada('dineroRivales')
    ? `<button class="eq2-t rival-bloq" data-accion="bloqueada" data-clave="dineroRivales"><b>${icono('candado')}</b><span>su dinero · función top ›</span></button>`
    : `<button class="eq2-t" ${ir('clausulas', 'quita')}><b>${conDinero ? dineroCorto(r.dinero) : '?'}</b><span>${conDinero ? (r.dinero.exacto ? 'su dinero, exacto' : `su dinero · ± ${eur(r.dinero.margen)}`) : 'su dinero: no se sabe'} ›</span></button>`;
  const teLlegan = r.fichas.filter((x) => x.abierta && x.meLlega).length;
  const tiles = [
    tDinero,
    `<button class="eq2-t" ${ir('juego', 'movs')}><b>${eur(e.valor, { dec: 1 })}</b><span>su plantilla ›</span>${dV}</button>`,
    `<button class="eq2-t" ${ir('clausulas', 'quitas')}><b>${r.abiertas}</b><span>cláusulas abiertas${r.abiertas ? `, ${teLlegan} te llega${teLlegan === 1 ? '' : 'n'}` : ''} ›</span></button>`,
    `<button class="eq2-t" ${ir('juego', 'movs')}><b>${eur(r.gastado, { dec: 1 })}</b><span>gastado en 7 días · ${r.movs} movimiento${r.movs === 1 ? '' : 's'} ›</span></button>`,
  ];
  let h = `<div class="hoja-cab rival-cab">${caraManager(e, 'g')}<h2>${esc(e.nombre)}</h2><span class="amenaza ${r.nivel}" title="${esc(PELIGRO_TXT)}">Peligro ${PELIGRO[r.nivel]}</span></div>
  <p class="t2 rival-sub">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${e.pos}º con ${e.puntos} puntos</p>
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
    if (bloqueada('dineroRivales')) cerradas.push('dineroRivales');
    h += `<div class="eq2-tiles">${bloqueada('dineroRivales') ? '' : `<div class="eq2-t"><b>${r.dinero && r.dinero.v != null ? dineroCorto(r.dinero) : '?'}</b><span>${r.dinero && r.dinero.v != null ? (r.dinero.exacto ? 'su dinero, exacto' : `su dinero · ± ${eur(r.dinero.margen)}`) : 'su dinero: no se sabe'}</span></div>`}
      <div class="eq2-t"><b>${r.paga ? pct(r.paga.med * 100) : '–'}</b><span>${r.paga ? `paga en el mercado · ${r.paga.n} compra${r.paga.n > 1 ? 's' : ''}` : 'sin compras al mercado'}</span></div></div>`;
    if (!bloqueada('dineroRivales')) h += `<p class="t2 peq">${esc(dineroLargo(r.dinero))}</p>`;
    // si te ha dicho cuánto tiene, se apunta: desde entonces su dinero sale de eso más lo que mueva
    if (!(r.dinero && r.dinero.exacto) && !bloqueada('dineroRivales')) {
      const dc = r.dinero && r.dinero.dicho, cu = M.dineroCuenta ? M.dineroCuenta(tid) : null;
      h += `<div class="dicho">`;
      if (dc) h += `<p class="t2 peq">${dc.est != null ? `Cuando te lo dijo, la cuenta con los movimientos daba ${eur(dc.est)} (${eur(dc.v - dc.est, { signo: true })} de diferencia).` : ''}${cu && cu.v != null && (dc.est == null || Math.abs(cu.v - dc.est) >= 1e5) ? ` Ahora daría ${eur(cu.v)}.` : ''} <button class="enlace" data-accion="borrarDicho" data-tid="${esc(tid)}">Olvidar lo que te dijo</button></p>`;
      h += `<details class="dicho-f"><summary>${icono('euro')}${dc ? 'Te ha dicho otra cifra' : '¿Te ha dicho cuánto tiene?'}</summary>
        <div class="dicho-in"><span>Entre</span><input id="dichoMin" type="text" inputmode="decimal" placeholder="50" autocomplete="off" aria-label="Mínimo, en millones"><span>y</span><input id="dichoMax" type="text" inputmode="decimal" placeholder="60" autocomplete="off" aria-label="Máximo, en millones"><span>M</span><button class="btn chico" data-accion="guardarDicho" data-tid="${esc(tid)}">Apuntar</button></div>
        <p class="t2 peq">En millones. Si te dijo una cifra, ponla en los dos. A partir de ahora su dinero sale de esto más lo que mueva, y la app aprende cuánto fallaba la cuenta.</p>
      </details></div>`;
    }
    if (r.leLlegan && r.leLlegan.length && bloqueada('quienPaga')) cerradas.push('quienPaga');
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
      h += `<p class="t2 peq" style="margin:0 0 6px">Lo que pide y lo que suele dar LaLiga por uno así (una estimación con lo vendido en tu liga: lo de hoy solo lo ve él). Se lo queda quien dé más: para que te lo venda a ti, supera la de LaLiga.</p>`;
      h += vs.map((m) => {
        const ol = m.ofertaLiga, conLiga = ol && !ol.sinDatos && ol.v;
        return filaJugador(m, {
          sub: `${esc(m.j.equipo)} · vale ${eur(m.j.valor)} · pide ${eur(m.precio)}${m.ofertas ? ` · ${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''}` : ''}`,
          pills: [m.noVende ? `<span class="pill mal" title="${esc(`No te lo venderá: ${m.noVende}`)}">No lo venderá</span>` : '', m.miPuja ? `<span class="pill abierta">Tu oferta ${eur(m.miPuja)}</span>` : '', estadoPill(m.j)],
          derecha: `<div class="v">${conLiga ? `~${eur(ol.v, { dec: 1 })}` : '?'}</div><div class="d apag">${conLiga ? 'suele dar LaLiga' : 'sin datos'}</div>${m.ofertaMin && !m.noVende ? `<div class="d apag">ofrece ${eur(m.puja || m.ofertaMin, { dec: 1 })}</div>` : ''}`, op: S.opPorPid[m.pid],
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
  return h + candadosJuntos(cerradas);
}

/* ================= ANUNCIO BONIFICADO ================= */
/** antes de ver un anuncio para desbloquear algo (de momento, otro plan de la IA cuando ya llevas 3 hoy) */
export function anuncioHTML(S, para) {
  const A = S.anuncio || {};
  if (para === 'top') return anuncioTopHTML(A);
  let h = `<div class="hoja-cab"><h2>Otro plan</h2></div>`;
  h += `<p class="t2" style="margin:0 0 14px">Hoy ya le has pedido otro plan a la IA 3 veces. Para uno más, mira un anuncio corto. Mañana vuelves a tener 3 gratis, sin contar el primer plan del día.</p>`;
  if (A.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(A.error)}</div></div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="btn" data-accion="verAnuncio" data-para="${esc(para)}"${A.cargando ? ' disabled' : ''}>${A.cargando ? 'Cargando el anuncio…' : 'Ver el anuncio'}</button><button class="btn sec" data-accion="cerrarHoja">Ahora no</button></div>`;
  h += `<p class="t2 peq" style="margin-top:14px">Con los anuncios la app sigue siendo gratis. El plan automático, sin IA, no tiene límite.</p>`;
  return h;
}

/** las funciones top: las de los rivales, con 2 anuncios y unas veces por jornada; cuándo gira, con 1, hasta medianoche */
function anuncioTopHTML(A) {
  const [t, x] = BLOQUEO[A.como] || BLOQUEO[A.clave] || ['Funciones top', ''];
  const rivales = POR_JORNADA.includes(A.clave), faltan = faltanAnuncios(A.clave), q = usosQuedan(A.clave), n = usosPorJornada();
  const min = minutosPorVez(), dura = min % 60 === 0 ? `${min / 60} hora${min > 60 ? 's' : ''}` : `${min} minutos`;
  let h = `<div class="bloq-hoja"><div class="hoja-cab"><span></span><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <span class="bloq-grande">${icono('candado')}</span><h2>${esc(t)}</h2>${x ? `<p>${esc(x)}</p>` : ''}`;
  if (rivales && !q) {
    h += `<p><b>Ya la has abierto las ${n} veces de esta jornada.</b> Vuelve a estar disponible en la siguiente.</p>
      <button class="btn ancho sec" data-accion="noTop">Entendido</button></div>`;
    return h;
  }
  if (rivales && faltan >= 2) h += `<p>Se abre <b>${dura}</b> viendo <b>dos anuncios cortos</b>, uno detrás de otro. Puedes hacerlo ${n} veces por jornada: te ${q === 1 ? 'queda 1' : `quedan ${q}`}.</p>`;
  else if (rivales) h += `<p><b>Llevas 1 de 2.</b> Mira el segundo y se abre ${dura}. Te ${q === 1 ? 'queda 1 vez' : `quedan ${q} veces`} esta jornada.</p>`;
  else h += `<p>Mira un anuncio corto y se abre <b>hasta medianoche</b>.</p>`;
  if (A.error) h += `<div class="aviso-ficha oro">${icono('info')}<div>${esc(A.error)}</div></div>`;
  const txt = A.cargando ? 'Cargando el anuncio…' : rivales ? (faltan >= 2 ? 'Ver el primer anuncio (1 de 2)' : 'Ver el segundo anuncio (2 de 2)') : 'Ver el anuncio';
  h += `<button class="btn ancho" data-accion="verAnuncio" data-para="top"${A.cargando ? ' disabled' : ''}>${txt}</button>
    <button class="btn ancho sec" data-accion="noTop" style="margin-top:8px">Ahora no</button></div>`;
  return h;
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
    const pend = av.admin ? av.pendientes || 0 : 0;
    const n = sinLeer + pend;
    const sub = av.admin ? (pend ? `${pend} sin contestar` : 'Los de tu liga') : sinLeer ? `${sinLeer} respuesta${sinLeer === 1 ? '' : 's'} sin leer` : 'Te contesto aquí';
    h += `<div class="aj-atajos"><button class="aj-atajo" data-accion="avisos">${icono('bicho')}<span><b>${av.admin ? 'Avisos de fallo' : 'Reportar un fallo'}</b><small>${esc(sub)}</small></span>${n ? `<em class="gl-aj">${n}</em>` : ''}</button>`
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
    c1 += fila(enApp ? 'Abrir en el ordenador' : 'Abrir en otro dispositivo', qr ? 'Escanea el QR de la web. El código, para el iPhone' : 'Con un código de un solo uso, sin el F12',
      qr ? `<span class="aj-2">${btnA('escanearQR', 'QR', { sec: false })}${btnA('vincularWeb', 'Código')}</span>` : btnA('vincularWeb', 'Código', { sec: false }), 'ordenador iphone vincular qr codigo web');
  }
  if (enIPhone && !enApp && !enInicio()) c1 += fila('Tenerla como una app', 'Safari: Compartir → Añadir a pantalla de inicio', '<a class="btn chico sec" href="instalar.html#anadir" target="_blank" rel="noopener">Cómo</a>', 'iphone instalar icono');
  if (!enDemo() && ses) c1 += fila('Invitar a tu liga', 'Un enlace para el grupo', btnA('invitar', 'Invitar', { sec: false, ic: 'enviar' }), 'compartir amigos grupo');
  h += sec('cuenta', 'usuario', 'Cuenta y liga', enDemo() ? 'Datos inventados' : `${nombreCta}${S.D && S.D.liga && S.D.liga.nombre ? ` · ${S.D.liga.nombre}` : ''}`, c1, 'sesion');

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
      c2 += tipo('pujas', 'Pujas que ganas o pierdes', 'Al cambiar el mercado', 'mercado pujas ganada perdida', false);
      c2 += tipo('enMercado', 'Te interesan y salen al mercado', 'Tus favoritos y los de interés alto', 'mercado favoritos interes sale venta', false);
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
  c3 += fila('Clave de Google AI Studio', k ? `${esc(k.slice(0, 6))}…${esc(k.slice(-4))}` : 'Sin clave: el plan sale sin noticias', k ? btnA('borrarClave', 'Quitar') : btnA('irIA', 'Poner', { sec: false }), 'gemini api key');
  if (enApp && !enDemo()) {
    const cf = cfgFondo(), uf = ultimoFondo();
    const ult = uf ? `${uf.error ? 'Falló' : 'Última'} ${cuando(uf.t)}` : 'Aún no ha trabajado sola';
    c3 += fila('Con la app cerrada', cf.on ? `Cada 3 h y al cambiar el mercado. ${!nativo.avisosPermitidos() ? '<b class="rojo">Falta el permiso de notificaciones.</b> ' : ''}${esc(ult)}` : 'Apagado: solo al abrir la app', interr(cf.on, 'fondo', '', 'Trabajar con la app cerrada'), 'segundo plano fondo trabaja sola');
  }
  if (k) {
    const lista = ((LS.get('ia-modelos', {}) || {}).lista) || [];
    const fuera = LS.get('ia-agotados', {}) || {};
    const hoyG = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const agot = Object.entries(fuera).filter(([, v]) => v && v.d === hoyG).length;
    c3 += fila('Plan automático al abrir', 'Si es de otro día o cambió el mercado', interr(ci.auto, 'iaAuto', '', 'Plan automático al abrir'), 'plan');
    c3 += fila('Buscar en Google en el chat', 'Solo si le falta algo de hoy', interr(ci.web, 'iaWeb', '', 'Buscar en Google en el chat'), 'busqueda');
    c3 += fila('Buscar en Google en el plan', 'Tarda el doble y falla más', interr(!!ci.webPlan, 'iaWebPlan', '', 'Buscar en Google en el plan'), 'busqueda');
    c3 += fila('Pullitas', 'Bromas que nunca deciden nada', selA('pullitas', [['no', 'Sin pullitas'], ['suave', 'Suaves'], ['normal', 'Normales'], ['saco', 'A saco']], ci.pullitas || 'normal', 'Pullitas de la IA'), 'bromas humor');
    c3 += fila('Versiones de la IA', lista.length ? `${lista.length} con tu clave${agot ? ` · ${agot} agotada${agot === 1 ? '' : 's'} hoy` : ''}` : 'Sin comprobar', btnA('probarIA', 'Comprobar'), 'cupo modelos');
  }
  h += sec('ia', 'ia', 'La IA', k ? `Clave puesta${ci.auto ? ' · plan automático' : ''}` : 'Sin clave', c3, 'gemini');

  /* ---- la app ---- */
  let c4 = '';
  const ew = enApp ? nativo.estadoWeb() : null;
  c4 += fila(`Versión ${VERSION}`, enApp ? `Compilación ${nativo.version()}${nativo.canal() === 'play' ? ' · Google Play' : ''}${ew && ew.activa ? ' · al día sin reinstalar' : ''}` : 'En el navegador', btnA(enApp ? 'buscarVersion' : 'buscarWeb', 'Buscar nueva'), 'actualizar version');
  if (estadoLimite.min != null) c4 += fila(`Hoy: ${Math.round(estadoLimite.usados / 60)} de ${estadoLimite.min} min`, 'Se reinicia a las 00:00', '', 'tiempo limite minutos');
  // las novedades de cada versión, solo para el dueño (o todos con «novedadesTodos» en limites.json)
  if (dueno || novedadesPara({ ligas: (S.D && S.D.ligas) || [] }) === true) c4 += fila('Novedades', 'Lo que trae y arregla cada versión', btnA('novedades', 'Ver'), 'cambios');
  // (11 nov, Carlos) a todos los demás, lo importante de cada versión (importante: true en version.js), sin arreglos
  else if (hayImportantes()) {
    const u = ultimaImportante();
    c4 += fila('Novedades', LS.get('importante-vista', null) === u ? 'Lo más importante de cada versión' : `Nuevo en la ${u}`, btnA('novedades', 'Ver'), 'cambios version');
  }
  if (dueno && !enDemo()) c4 += fila('Quién usa la app', 'Solo lo ves tú', btnA('quienUsa', 'Ver', { sec: false }), 'usuarios');
  if ((enApp || enWeb) && !enDemo()) c4 += fila('Liga de ejemplo', 'Sin tocar tus datos', btnA('entrarDemo', 'Ver'), 'demo');
  // (13 nov, Carlos) el tema de evento de index.html (TEMA_EVENTO), que se puede apagar; sin él, la fila no sale
  c4 += fila('Diagnóstico', 'Lo que han contestado LaLiga y Google', btnA('diag', 'Ver'), 'errores fallos');
  h += sec('app', 'info', 'La app', `Versión ${VERSION}`, c4, 'version');

  /* ---- datos y privacidad ---- */
  let c5 = '';
  c5 += fila('Borrar los datos guardados', 'Histórico, fichas y planes', btnA('borrarDatos', 'Borrar'), 'limpiar cache');
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
/** las capturas de un aviso recibido (el dueño): se cargan al abrirlo */
function capturasRecibidas(A, d) {
  if (!d.capturas) return '';
  const l = (A.capt && A.capt[d.id]) || [];
  const cel = [...Array(d.capturas).keys()].map((i) => (l[i] ? `<span class="ac-m"><button class="ac-ver" data-accion="verCaptura" data-id="${esc(d.id)}" data-n="${i}" aria-label="Ver la captura ${i + 1}"><img src="${esc(l[i])}" alt=""></button></span>`
    : `<span class="ac-m vacia">${l[i] === '' ? 'No se pudo' : 'Cargando…'}</span>`)).join('');
  return `<div class="aviso-capt">${cel}</div>`;
}
const avisoMio = (x) => `<div class="aviso${x.respuesta && !x.vista ? ' nuevo' : ''}">
  <div class="aviso-cab"><span>${cuando(x.t)}</span>${x.respuesta ? '<span class="pill sube">Contestado</span>' : '<span class="pill">Esperando respuesta</span>'}</div>
  <p>${esc(x.texto)}</p>${x.capturas ? `<p class="t2 peq">${icono('foto')} ${x.capturas} captura${x.capturas > 1 ? 's' : ''}</p>` : ''}
  ${x.respuesta ? `<div class="aviso-resp"><b>${esc(firmaDe(x.por) || 'Respuesta')}</b><span>${esc(x.respuesta)}</span><small>${cuando(x.respondida)}</small></div>` : ''}</div>`;
function detalleAviso(A, x) {
  const d = A.detalle;
  // mientras llega el aviso entero, su texto (el de la lista) y que se está cargando
  if (!d) return `<div class="aviso-det"><p class="aviso-texto">${esc((x && x.txt) || '')}</p><p class="t2 peq cargando-av">${icono('reloj')}Cargando el aviso entero…</p></div>`;
  if (d.error) return `<div class="error-c">${esc(d.error)}</div>`;
  return `<div class="aviso-det">
    <p class="aviso-texto">${esc(d.texto)}</p>
    ${capturasRecibidas(A, d)}
    <p class="t2 peq">${esc([d.liga, d.app].filter(Boolean).join(' · '))}</p>
    ${d.diag ? `<details><summary>Diagnóstico</summary><pre class="diag" tabindex="0">${esc(d.diag)}</pre></details>` : '<p class="t2 peq">Sin diagnóstico.</p>'}
    ${d.respuesta ? `<div class="aviso-resp"><b>Le contestaste</b><span>${esc(d.respuesta)}</span><small>${cuando(d.respondida)}${d.vista ? ' · leído' : ' · sin leer'}</small></div>` : ''}
    <textarea id="respTxt" class="campo-t aviso-t" rows="3" maxlength="2000" placeholder="${d.respuesta ? 'Cambiar la respuesta' : 'Tu respuesta: le llega en la app'}">${esc(A.respBorrador || '')}</textarea>
    <button class="btn chico" data-accion="responderAviso" data-id="${esc(d.id)}"${A.respondiendo ? ' disabled' : ''}>${A.respondiendo ? 'Mandando…' : `${icono('enviar')}Responder`}</button></div>`;
}
export function avisos(S) {
  const A = S.av || {};
  let h = `<div class="hoja-cab"><h2>${A.admin ? 'Avisos de fallos' : 'Reportar un fallo'}</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (A.admin) h += bandejaAvisos(A);
  if (A.admin) h += '<div class="grupo"><span>Mandar uno tú</span><span></span></div>';
  if (A.sinSesion) {
    h += `<p class="t2">Para mandarme un aviso y que te pueda contestar hace falta entrar con tu cuenta de LaLiga${enDemo() ? ' (ahora estás viendo la liga de ejemplo)' : ''}. Mientras, puedes escribirme desde la página de contacto y pegar el diagnóstico.</p>
      <button class="btn ancho" data-abrir="https://fantasymanagerapp.com/contacto.html">${icono('enviar')}Ir a contacto</button>
      <button class="btn sec ancho" data-accion="compartirDiag" style="margin-top:8px">${icono('copiar')}${enApp ? 'Mandar el diagnóstico' : 'Copiar el diagnóstico'}</button>`;
  } else {
    h += `<p class="t2 peq" style="margin-top:0">Cuéntame qué ha pasado y qué estabas haciendo. Me llega a mí y te contesto aquí mismo: te aviso cuando haya respuesta.</p>
      <textarea id="avisoTxt" class="campo-t aviso-t" rows="4" maxlength="4000" placeholder="Por ejemplo: al abrir Mercado se queda en blanco">${esc(A.borrador || '')}</textarea>
      ${capturasHTML(A)}
      <label class="aviso-diag"><input type="checkbox" id="avisoDiag"${A.sinDiag ? '' : ' checked'}><span>Mandar también el diagnóstico (versión, lo que ha contestado LaLiga…). No lleva tu sesión, tu clave de la IA ni los nombres de los demás de tu liga.</span></label>
      <button class="btn ancho" data-accion="mandarAviso"${A.enviando ? ' disabled' : ''}>${A.enviando ? 'Mandando…' : `${icono('enviar')}Mandar el aviso`}</button>
      ${A.error ? `<div class="error-c" style="margin-top:10px">${esc(A.error)}</div>` : ''}`;
  }
  const mios = A.lista || avisosGuardados().lista || [];
  if (mios.length) h += `<div class="grupo"><span>Tus avisos</span><span>${mios.length}</span></div>${mios.map(avisoMio).join('')}`;
  else if (A.cargando) h += '<p class="t2 peq">Mirando tus avisos…</p>';
  return h;
}
function bandejaAvisos(A) {
  const todos = A.todos || [];
  let h = `<div class="grupo"><span>Avisos recibidos</span><span>${A.pendientes || 0} sin contestar</span></div>`;
  if (!todos.length) h += `<p class="t2 peq">${A.cargandoTodos ? 'Cargando…' : 'Ninguno todavía.'}</p>`;
  // para revisarlos con Claude: los sin contestar, enteros y con su diagnóstico, listos para pegar en el chat
  else h += `<div class="avisos-claude"><button class="btn chico sec" data-accion="copiarAvisos">${icono('copiar')}Copiar avisos</button><span class="t2 peq">${A.pendientes ? 'Los que están sin contestar' : 'Los últimos 5'}, con su diagnóstico. Pégalos en el chat.</span></div>${A.paraClaude ? `<div class="para-claude"><textarea class="campo-t aviso-t" rows="5" readonly>${esc(A.paraClaude)}</textarea><button class="btn chico" data-accion="copiarParaClaude">${icono('copiar')}Copiar otra vez</button></div>` : ''}`;
  h += todos.map((x) => `<div class="aviso recibido${x.r ? '' : ' nuevo'}${A.abierto === x.id ? ' abierto' : ''}">
    <button class="aviso-cab" data-accion="abrirAviso" data-id="${esc(x.id)}"><b>${esc(x.quien || '¿?')}</b><span>${esc(x.equipo || '')}</span><span class="aviso-t2">${cuando(x.t)}</span>${x.r ? '<span class="pill sube">Contestado</span>' : '<span class="pill pronto">Sin contestar</span>'}</button>
    ${A.abierto === x.id ? detalleAviso(A, x) : `<p>${esc(x.txt || '')}</p>`}</div>`).join('');
  return h;
}

/* ================= QUIÉN USA LA APP (el dueño) ================= */
export function quienUsaHTML(S) {
  const Q = S.quien || {};
  let h = `<div class="hoja-cab"><h2>Quién usa la app</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (Q.cargando) return `${h}<p class="t2">Mirando…</p>`;
  if (Q.error) return `${h}<div class="error-c">${esc(Q.error)}</div>`;
  const lista = Q.lista || [], ahora = Q.ahora || Date.now();
  const porUid = new Map(lista.map((x) => [String(x.uid), x]));
  const D = S.D;
  const tabla = D ? [...D.clasif].sort((a, b) => a.pos - b.pos) : [];
  const deLiga = new Set();
  const DENTRO = 12 * 60e3;
  const fila = (nombre, equipo, x) => {
    const dentro = x && ahora - x.ultima < DENTRO;
    const donde = x ? (x.canal === 'web' ? 'web' : x.canal === 'play' ? 'Google Play' : 'Android') : '';
    const fallo = x && / !$/.test(x.v || '');
    const sub = !x ? 'Aún no ha entrado'
      : `${dentro ? 'Dentro ahora' : `Entró ${cuando(x.ultima)}`} · ${donde} ${esc(String(x.v || '').replace(/ !$/, ''))}${fallo ? ' · <b class="rojo">no le carga la liga</b>' : ''}${x.ad && x.v && cmpVer(String(x.v).replace(/ !$/, ''), VERSION) < 0 ? ` · <b class="rojo">no se actualiza: ${esc(x.ad)}</b>` : ''}${x.segHoy ? ` · ${tiempoTxt(x.segHoy)} hoy` : ''}`;
    return `<div class="quien-f ${x ? (dentro ? 'dentro' : 'si') : 'no'}"><span class="qf-p" aria-hidden="true"></span><div class="qf-c"><b>${esc(nombre)}</b><span>${esc(equipo || '')}${equipo ? ' · ' : ''}${sub}</span></div>${x && x.primera ? `<small>desde ${esc(cuando(x.primera, { hora: false }))}</small>` : ''}</div>`;
  };
  let filas = '';
  // por su número de cuenta; si no cuadra (LaLiga no siempre da el mismo id en la clasificación que en la cuenta),
  // por el nombre de su equipo en esta liga o por su nombre de mánager
  const ligaId = D && D.liga ? String(D.liga.id) : '';
  const buscar = (e) => porUid.get(String(e.managerId)) || porUid.get(String(e.userId))
    || lista.find((x) => !deLiga.has(String(x.uid)) && x.equipo && String(x.liga || '') === ligaId && norm(x.equipo) === norm(e.nombre))
    || lista.find((x) => !deLiga.has(String(x.uid)) && x.nombre && e.manager && norm(x.nombre) === norm(e.manager));
  for (const e of tabla) {
    const x = buscar(e);
    if (x) deLiga.add(String(x.uid));
    filas += fila(e.manager || e.nombre, e.manager ? e.nombre : '', x);
  }
  const conApp = deLiga.size;
  const dentro = lista.filter((x) => ahora - x.ultima < DENTRO).length;
  if (Q.registro) h += registradosHTML(Q.registro, lista, ahora);
  h += tiempoHTML(lista, Q.dias);
  if (Q.registro) h += `<div class="grupo"><span>Tu liga</span></div>`;
  h += `<p class="quien-res"><b>${conApp} de ${tabla.length}</b> de tu liga han entrado en la app${dentro ? ` · <b>${dentro}</b> dentro ahora` : ''}.</p>`;
  h += `<div class="quien-l">${filas}</div>`;
  const fuera = lista.filter((x) => !deLiga.has(String(x.uid)));
  if (fuera.length) h += `<div class="grupo"><span>De fuera de tu liga</span></div><div class="quien-l">${fuera.map((x) => fila(x.nombre || 'Sin nombre', x.equipo, x)).join('')}</div>`;
  h += `<p class="peq apag" style="margin-top:14px">«Dentro ahora» es que ha tenido la app abierta en los últimos 12 minutos. Se apunta al abrirla con su cuenta de LaLiga: quien solo ha visto la liga de ejemplo, o tiene una versión anterior a la 0.4.4, no sale.</p>`;
  return h;
}

/** segundos de app en horas y minutos: «menos de 1 min», «25 min», «1 h 05 min» */
export function tiempoTxt(seg) {
  const m = Math.floor((Number(seg) || 0) / 60);
  if (m < 1) return 'menos de 1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
/** (el dueño, 0.7t) cuánto tiempo pasa cada uno en la app al día: hoy, ayer, la media de los días que entra y los 7
    últimos días en barras. Lo manda la app al Worker (/uso); /hola/todos trae los 7 días de los que han entrado esta
    semana */
function tiempoHTML(lista, dias) {
  const ds = Array.isArray(dias) && dias.length ? dias : [diaDe()];
  const hoy = ds[0], ayer = ds[1];
  const filas = lista.map((x) => {
    const sd = x.segDias || (x.segHoy ? { [hoy]: x.segHoy } : {});
    const vals = ds.map((d) => Number(sd[d]) || 0);
    const conUso = vals.filter((v) => v > 0);
    const total = conUso.reduce((a, b) => a + b, 0);
    return { x, vals, hoy: vals[0], ayer: ayer ? vals[1] : 0, media: conUso.length ? total / conUso.length : 0, nd: conUso.length, total };
  }).filter((f) => f.total > 0).sort((a, b) => b.hoy - a.hoy || b.media - a.media);
  let h = `<div class="grupo"><span>Tiempo en la app</span></div>`;
  if (!filas.length) return `${h}<p class="quien-res">Aún no hay tiempo contado. Se cuenta para todos desde la 0.7t: sale cuando cada uno abra la app con esa versión.</p>`;
  const max = Math.max(60, ...filas.flatMap((f) => f.vals));
  const sumaHoy = filas.reduce((a, f) => a + f.hoy, 0), hoyN = filas.filter((f) => f.hoy > 0).length;
  const corto = (seg) => (seg ? tiempoTxt(seg).replace('menos de 1 min', '<1 min') : '—');
  const fd = (d) => fechaCorta(Date.parse(`${d}T12:00:00Z`));
  const barritas = (f) => `<span class="uso-b" role="img" aria-label="${esc(ds.slice().reverse().map((d, i) => `${fd(d)}: ${corto(f.vals[ds.length - 1 - i])}`).join(', '))}">${f.vals.slice().reverse().map((v, i) => `<i title="${esc(fd(ds[ds.length - 1 - i]))}: ${esc(corto(v))}" style="height:${v ? Math.max(8, Math.round((v / max) * 100)) : 0}%"></i>`).join('')}</span>`;
  h += `<p class="quien-res">Hoy han estado dentro <b>${hoyN}</b>, entre todos <b>${tiempoTxt(sumaHoy)}</b>.</p>`;
  h += `<table class="tabla reg-ev uso-t"><tr><th></th><th>Hoy</th><th>Ayer</th><th>Media</th><th>7 días</th></tr>${filas.map((f) => `<tr><td><b>${esc(f.x.nombre || 'Sin nombre')}</b>${f.x.equipo ? `<small>${esc(f.x.equipo)}</small>` : ''}</td><td><b>${corto(f.hoy)}</b></td><td>${corto(f.ayer)}</td><td>${corto(f.media)}<small>${f.nd} ${f.nd === 1 ? 'día' : 'días'}</small></td><td>${barritas(f)}</td></tr>`).join('')}</table>`;
  h += `<p class="peq apag">Solo cuenta el tiempo con la app a la vista, entre la app y la web, y el día va de 00:00 a 00:00 en Madrid. La media es de los días que ha entrado de los 7 últimos; las barras van del más antiguo (izquierda) a hoy. Desde la 0.7t se cuenta para todos (antes, solo a los que tienen límite de minutos) y lo de quien no la tiene a la vista puede tardar hasta 5 minutos en llegar.</p>`;
  return h;
}

/** (el dueño) todas las cuentas que han entrado alguna vez: total, activas, altas y desde dónde */
const CANAL_TXT = { github: 'Android (APK)', play: 'Google Play', web: 'Web' };
/** qué hace la gente (eventos.js): esta semana, las 4 anteriores y el embudo de entrada; desde la 0.7a */
function usoHTML(reg, activos) {
  const lunes = (d) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  const esta = lunes(diaDe());
  const antes = new Date(`${esta}T12:00:00Z`); antes.setUTCDate(antes.getUTCDate() - 28);
  const desde4 = antes.toISOString().slice(0, 10);
  const suma = (filtro) => { const o = {}; for (const x of reg) for (const [l, cs] of Object.entries(x.ev || {})) if (filtro(l)) for (const [k, n] of Object.entries(cs)) o[k] = (o[k] || 0) + n; return o; };
  const sem = suma((l) => l === esta), cuatro = suma((l) => l >= desde4 && l < esta);
  const con = (k) => reg.filter((x) => x.tot && x.tot[k] > 0).length;
  if (!reg.some((x) => x.tot)) return `<div class="grupo"><span>Qué hacen</span></div><p class="quien-res">Aún no hay nada contado: se cuenta desde la 0.7a (planes, preguntas, anuncios, funciones top y la entrada).</p>`;
  const fila = (k) => `<tr><td>${EVENTOS[k]}</td><td><b>${sem[k] || 0}</b></td><td>${cuatro[k] || 0}</td></tr>`;
  const porActivo = activos.d7 ? Math.round(((sem.p || 0) / activos.d7) * 10) / 10 : 0;
  return `<div class="grupo"><span>Qué hacen</span></div>
    <table class="tabla reg-ev"><tr><th></th><th>Esta semana</th><th>4 anteriores</th></tr>${['p', 'q', 'b', 't', 'e', 'c', 'n', 'i'].map(fila).join('')}</table>
    <p class="quien-res">Planes por cuenta activa esta semana: <b>${String(porActivo).replace('.', ',')}</b>.</p>
    ${(() => { const pc = (b, f) => (b + f ? `${Math.round((f / (b + f)) * 1000) / 10} %`.replace('.', ',') : '—'); return `<p class="quien-res">Cargas de la liga que fallan esta semana: <b>${pc(sem.a || 0, sem.f || 0)}</b> fuera de jornada · <b>${pc(sem.A || 0, sem.F || 0)}</b> con jornada en juego (${(sem.A || 0) + (sem.F || 0)} cargas).</p>`; })()}
    <p class="quien-res">La entrada, en cuentas: empezaron el login <b>${con('l')}</b> · entraron <b>${con('e')}</b> · vieron la guía de la clave <b>${con('v')}</b> · guardaron la clave <b>${con('c')}</b> · pidieron un plan <b>${con('p')}</b>.</p>
    <p class="peq apag">Lo de antes de entrar con la cuenta solo cuenta para quien acaba entrando. Lo de los últimos días puede tardar hasta un día en llegar.</p>`;
}
function registradosHTML(reg, lista, ahora) {
  const hace = (d) => ahora - d * DIA;
  const hoy = diaDe(ahora);
  const cuenta = (f) => reg.filter(f).length;
  const nuevos = { hoy: cuenta((x) => diaDe(x.primera) === hoy), d7: cuenta((x) => x.primera >= hace(7)), d30: cuenta((x) => x.primera >= hace(30)) };
  const activos = { d1: cuenta((x) => x.ultima >= hace(1)), d7: cuenta((x) => x.ultima >= hace(7)), d30: cuenta((x) => x.ultima >= hace(30)) };
  const porCanal = {};
  for (const x of reg) for (const c of String(x.canales || '').split(',').filter(Boolean)) porCanal[c] = (porCanal[c] || 0) + 1;
  // altas por semana (las 8 últimas, de 7 en 7 días hacia atrás desde hoy)
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const hasta = hace(7 * i), desde = hace(7 * (i + 1));
    return { desde, n: cuenta((x) => x.primera >= desde && x.primera < hasta) };
  }).reverse();
  const max = Math.max(1, ...semanas.map((x) => x.n));
  const porUid = new Map(lista.map((x) => [String(x.uid), x]));
  const ultimas = [...reg].sort((a, b) => b.primera - a.primera).slice(0, 8);
  let h = `<div class="grupo"><span>Todas las cuentas</span></div>`;
  h += `<div class="reg-cifras">
    <div><b>${reg.length}</b><span>han entrado alguna vez</span></div>
    <div><b>${activos.d7}</b><span>activas esta semana</span></div>
    <div><b>${activos.d30}</b><span>activas en 30 días</span></div>
  </div>`;
  // ligas con varios que la usan (roadmap: la unidad de captación es la liga): por la liga de /hola, últimos 30 días
  const porLiga = {};
  for (const x of lista) if (x.liga && x.ultima >= hace(30)) porLiga[x.liga] = (porLiga[x.liga] || 0) + 1;
  const nLigas = Object.keys(porLiga).length, de3 = Object.values(porLiga).filter((n) => n >= 3).length, de2 = Object.values(porLiga).filter((n) => n >= 2).length;
  if (nLigas) h += `<p class="quien-res">Ligas (30 días): <b>${nLigas}</b> con alguien que la usa · <b>${de2}</b> con 2 o más · <b>${de3}</b> con 3 o más.</p>`;
  h += `<p class="quien-res">Altas: <b>${nuevos.hoy}</b> hoy · <b>${nuevos.d7}</b> en 7 días · <b>${nuevos.d30}</b> en 30 días. Hoy han abierto la app <b>${activos.d1}</b>.</p>`;
  const canales = Object.keys(CANAL_TXT).filter((c) => porCanal[c]);
  if (canales.length) h += `<p class="quien-res">Desde dónde: ${canales.map((c) => `${CANAL_TXT[c]} <b>${porCanal[c]}</b>`).join(' · ')}</p>`;
  h += `<div class="reg-sem" role="img" aria-label="Altas por semana, las 8 últimas: ${semanas.map((x) => x.n).join(', ')}">${semanas.map((x) => `<div class="reg-b"><span class="reg-n">${x.n || ''}</span><i style="height:${Math.round((x.n / max) * 100)}%"></i><small>${esc(fechaCorta(x.desde))}</small></div>`).join('')}</div>`;
  if (ultimas.length) {
    h += `<p class="t2 peq" style="margin:12px 0 2px">Últimas altas</p><div class="quien-l">${ultimas.map((x) => {
      const p = porUid.get(String(x.uid));
      const nombre = p ? p.nombre || 'Sin nombre' : `Cuenta ${x.uid}`;
      const donde = String(x.canales || '').split(',').filter(Boolean).map((c) => CANAL_TXT[c] || c).join(', ');
      return `<div class="quien-f si"><span class="qf-p" aria-hidden="true"></span><div class="qf-c"><b>${esc(nombre)}</b><span>${esc(donde || '¿?')} · última vez ${cuando(x.ultima)}${x.dias ? ` · ${x.dias} ${x.dias === 1 ? 'día' : 'días'} con la app` : ''}</span></div><small>alta ${esc(cuando(x.primera, { hora: false }))}</small></div>`;
    }).join('')}</div>`;
  }
  h += usoHTML(reg, activos);
  h += `<p class="peq apag" style="margin-top:10px">Cuenta todas las cuentas de LaLiga que han abierto la app con su sesión desde el 3 de noviembre, más las que la habían abierto en los 90 días anteriores. El nombre solo sale si la ha abierto en los últimos 90 días.</p>`;
  return h;
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
export function textoDiagnostico(S) {
  const s = sesion();
  const D = S.D;
  const ia = nombresIA();
  const L = [
    `Fantasy Manager ${VERSION} · compilación ${nativo.version()} · ${enApp ? `app (${nativo.canal()})` : enWeb ? 'web' : 'navegador sin servidor'}${enDemo() ? ' · DEMO' : ''}`,
    `Cuenta de LaLiga: ${(D && D.yo && D.yo.userId) || (avisosGuardados().yo) || '¿?'}`,
    ...(enApp ? [(() => { const w = nativo.estadoWeb(); if (!w) return 'Web al día sola: no (APK de antes)'; return `Web al día sola: APK con la ${w.propia || '¿?'} · ${w.activa ? `puesta la ${w.activa} (${w.archivos} archivos, ${horaDe(w.bajada)})` : 'usa la del APK'} · mirado ${w.mirada ? horaDe(w.mirada) : 'aún no'} · parte Android ${w.nativo}${w.error ? ` · último fallo: ${w.error}` : ''}`; })()] : []),
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
    `Ligas: ${D && D.ligas ? D.ligas.map((l) => `${l.id}${l.premium ? ' (premium)' : ''}${D.liga && l.id === D.liga.id ? ' ←' : ''}`).join(', ') : '¿?'} · pantalla ${typeof innerWidth !== 'undefined' ? `${innerWidth}×${innerHeight}` : '?'}${medidasVista()} · ${typeof navigator !== 'undefined' && navigator.onLine === false ? 'SIN RED' : 'con red'}`,
    ...(erroresApp.length ? ['Errores de la app:', ...erroresApp.map((x) => `  ${horaDe(x.t)} ${x.m}${x.donde ? ` (${x.donde})` : ''}`)] : []),
    `Fuentes: onces ${S.M && S.M.hayOnces ? `${Object.keys(((S.fuentes || {}).onces || {}).jugadores || {}).length} jugadores, ${((S.fuentes || {}).onces || {}).equipos ?? '?'}/${((S.fuentes || {}).onces || {}).de ?? '?'} equipos` : 'no'} · noticias ${S.M ? S.M.noticias.length : 0}${S.M && S.M.noticiasFallo ? ` (${S.M.noticiasFallo.viejas ? 'las de antes: ' : ''}${S.M.noticiasFallo.fallo})` : ''} · avanzadas ${S.M && S.M.fuentesAv ? Object.entries(S.M.fuentesAv).map(([k, v]) => `${k} ${v}`).join(', ') : 'sin datos'} · histórico de valor ${LS.get('ruta-valor', null) != null ? `ruta ${LS.get('ruta-valor')}` : LS.get('ruta-valor-falla', 0) ? 'ninguna ruta' : 'sin probar'}`,
    (() => {
      const M = S.M;
      if (!D || !M || !M.dineroDe) return 'Dinero de los rivales: sin datos';
      if (bloqueada('dineroRivales')) return 'Dinero de los rivales: bloqueado en esta cuenta';
      const m1 = (v) => String(Math.round(num(v) / 1e5) / 10);
      const ex = Object.entries(D.dineros || {}).filter(([tid]) => tid !== D.yo.teamId);
      const hm = M.histMov || {};
      return `Dinero de los rivales: ${ex.length ? `${ex.length} exactos (${[...new Set(ex.map(([, x]) => x.fuente))].join(', ')})` : 'ninguno exacto'} · el resto estimado con ${hm.n || 0} movimientos desde ${hm.desde ? new Date(hm.desde).toISOString().slice(0, 10) : '?'}${hm.completa ? ' (desde el principio)' : ' (no llega al principio)'} · ${M.rivales.map((r) => `${r.e.manager || r.e.nombre} ${r.dinero && r.dinero.v != null ? `${r.dinero.exacto ? '' : '≈'}${m1(r.dinero.v)}M` : `? (${(r.dinero && r.dinero.motivo) || 'sin datos'})`}`).join(', ')}`
        // de dónde sale cada cifra: la base común, y por rival lo movido, las subidas de cláusula y lo que te dijo
        + (M.baseDinero ? `\n  base: tu saldo ${m1(M.baseDinero.saldo)}M − tus movimientos ${m1(M.baseDinero.mov)}M + tus subidas de cláusula ${m1(M.baseDinero.subidas)}M = ${m1(M.baseDinero.v)}M (debería estar entre ${m1(M.baseDinero.min)} y ${m1(M.baseDinero.max)}M${M.baseDinero.desvio ? `: NO CUADRA por ${m1(M.baseDinero.desvio)}M` : ''})` : '')
        + `\n  tipos: ${Object.entries(M.histTipos || {}).map(([k, x]) => `${k}×${x.n}${x.conImporte && x.conImporte !== x.n ? ` (${x.conImporte} con importe)` : ''}`).join(' ')} · clausulazos detectados ${M.czDetectados || 0}`
        + M.rivales.filter((r) => !(r.dinero && r.dinero.exacto)).map((r) => {
          const f = (M.flujos || {})[r.e.teamId] || {}, sb = (M.subidas || {})[r.e.teamId] || {}, dc = r.dinero && r.dinero.dicho, cu = M.dineroCuenta ? M.dineroCuenta(r.e.teamId) : null;
          return `\n  ${r.e.manager || r.e.nombre}: mov ${m1(f.v || 0)}M (gasta ${m1(f.gastado || 0)}, ingresa ${m1(f.ingresado || 0)}, premios ${m1(f.premios || 0)}${f.raros ? `, ${f.raros} raros` : ''}) · subidas −${m1(sb.v || 0)}M en ${sb.n || 0}${sb.vistas ? ` (${sb.vistas} vistas)` : ''}${sb.sinBase ? ` · ${sb.sinBase} sin base` : ''} · cuenta ${cu && cu.v != null ? `${m1(cu.v)}M ±${m1(cu.margen)}` : '?'}${dc ? ` · te dijo ${m1(dc.v)}M ${new Date(dc.t).toISOString().slice(5, 16)}${dc.est != null ? ` (la cuenta daba ${m1(dc.est)}M)` : ''}` : ''}`;
        }).join('');
    })(),
    S.M ? `Clausulazos: ${S.M.clausulazos ? `${S.M.clausulazos.n}, mediana ${pct(S.M.clausulazos.med * 100)}, p90 ${pct(S.M.clausulazos.p90 * 100)}` : 'ninguno medible'} · Ofertas de LaLiga: ${S.M.ofertaLiga ? `${S.M.ofertaLiga.n} ventas, mediana ${pct(S.M.ofertaLiga.med * 100)}${S.M.ofertaLiga.poco ? ' (pocas)' : ''}` : 'sin ventas a LaLiga medibles'} · Pujas de la liga: ${S.M.pujasLiga ? `${S.M.pujasLiga.n} compras, mediana ${pct(S.M.pujasLiga.med * 100)}${S.M.pujasLiga.poco ? ' (pocas)' : `, p25 ${pct(S.M.pujasLiga.p25 * 100)}, p75 ${pct(S.M.pujasLiga.p75 * 100)}${(S.M.pujasLiga.tramos || []).map((x) => ` · ${x.desde === 0 ? '<' : ''}${eur(x.desde === 0 ? x.hasta : x.desde, { dec: 0 })}${x.desde && x.hasta !== Infinity ? `-${eur(x.hasta, { dec: 0 })}` : x.hasta === Infinity ? '+' : ''}: ${x.n}, med ${pct(x.med * 100)}, p90 ${pct(x.p90 * 100)}`).join('')}`}` : 'sin compras al mercado medibles'} · aprendizaje: ${S.M.aprende && S.M.aprende.prev ? (S.M.aprende.prev.poco ? `${S.M.aprende.prev.pares} pares (pocos)` : `${S.M.aprende.prev.pares} pares, error ${S.M.aprende.prev.mae.final}, peso desglose ${S.M.aprende.prev.w}, sesgo ${JSON.stringify(S.M.aprende.prev.sesgo)}`) : 'sin jornadas evaluadas'}${S.M.aprende && S.M.aprende.planes ? ` · planes ${S.M.aprende.planes.bien}/${S.M.aprende.planes.n}` : ''}` : '',
    `IA: clave ${hayClave() ? 'sí' : 'no'} · modelos ${(((LS.get('ia-modelos', {}) || {}).lista) || []).map(ia.m).join(', ') || '¿?'}`,
    ...intentosIA.slice(0, 20).map((x) => `  ${horaDe(x.t)} ${ia.m(x.modelo)}${x.web ? ' +web' : ''}${x.nivel ? ` ·${x.nivel}` : ''}${x.relevo ? ' (relevo)' : ''} ${x.ok ? `OK${x.fin && x.fin !== 'STOP' ? ` ${x.fin}` : ''}${x.car != null ? ` ${x.car} car.` : ''}${x.tok ? ` (tokens: ${x.tok.p} entran, ${x.tok.th} pensando, ${x.tok.r} escritos)` : ''}` : `✗ ${x.s} ${ia.t(x.e)}`}${x.google ? ` «${ia.t(x.google)}»` : ''} ${x.ms}ms`),
    (() => {
      const uf = ultimoFondo(), nf = nativo.estadoFondo() || {};
      return `Segundo plano: ${cfgFondo().on ? 'sí' : 'no'}${nf.ini ? ` · empezó ${new Date(nf.ini).toISOString()}` : ''}${nf.fin ? ` · acabó ${new Date(nf.fin).toISOString()}` : ''}${nf.prog ? ` · próxima tras el mercado ${new Date(nf.prog).toISOString()}` : ''}${nf.error ? ` · ✗ ${nf.error}` : ''}${uf ? ` · web: ${(uf.pasos || []).join(' / ')}${uf.error ? ` ✗ ${uf.error}` : ''} (${Math.round((uf.ms || 0) / 1000)} s${uf.avisos != null ? `, ${uf.avisos} avisos` : ''})` : ''}`;
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
