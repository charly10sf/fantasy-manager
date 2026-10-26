/* Las ventanas que suben desde abajo: la ficha de un jugador, la de un rival, los ajustes y el diagnóstico. */
import { erroresApp } from './errores.js';
import { avisosGuardados } from './soporte.js';
import { esc, eur, pct, dura, cuando, icono, clase, POS_LARGO, POS_PLURAL, num, horaDe, LS, DIA, diaDe, norm } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, filaJugador, nada, oncePill, filaNoticia, nivelCls, calendarioHTML, dineroCorto, dineroLargo, candado, BLOQUEO, ventasDe, campoVivo, estiloClub } from './comunes.js';
import { linea, barra, barras, mini } from './graficos.js';
import { filaActividad, PELIGRO, ventaHTML, puntosUltimaJornada } from './vistas.js';
import { hayClave, clave, cfgIA, nombreModelo, intentosIA, notasDe } from './ia.js';
import { cfgAvisos, programados } from './avisos.js';
import { nativo, enApp, enWeb } from './puente.js';
import { registro } from './api.js';
import { quien, sesion } from './auth.js';
import { VERSION } from './version.js';
import { enDemo } from './datos.js';
import { cfgFondo, ultimoFondo } from './fondo.js';
import { estadoLimite, bloqueada, POR_JORNADA, faltanAnuncios, usosQuedan, usosPorJornada, minutosPorVez } from './limite.js';
import { jornadaJugadorHTML } from './directo.js';
import { muestrasVivo } from './vivo.js';
import { esFav } from './favoritos.js';

const ACC = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };

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
  if (p.length < 2) return `<div class="graf-vacio">${cargando ? 'Cargando su histórico de valor…' : 'LaLiga no da su histórico de valor y la app aún no ha apuntado bastantes días.'}</div>`;
  let q = p.filter(([t]) => t >= Date.now() - dias * DIA - 12 * 3600e3);
  if (q.length < 2) q = p.slice(-2);
  const v0 = q[0][1], v1 = q[q.length - 1][1], d = v1 - v0;
  const vs = q.map((x) => x[1]);
  const span = Math.max(1, Math.round((q[q.length - 1][0] - q[0][0]) / DIA));
  return `${linea(q, { alto: 150, color: d >= 0 ? 'var(--sube)' : 'var(--baja)' })}
    <div class="graf-pie"><b class="${clase(d)}">${eur(d, { signo: true })} (${pct((v1 / v0 - 1) * 100)})</b> en ${span} día${span > 1 ? 's' : ''} · máx ${eur(Math.max(...vs))} · mín ${eur(Math.min(...vs))}</div>`;
}

/* ---------- tu equipo hoy (al tocar el marcador de Hoy) ---------- */
/** el valor de tu equipo día a día (lo que apunta la app cada día) */
export function serieEquipo(S) {
  const s = (S.H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
  // sumando el histórico de valor de cada uno de tus jugadores de hoy (de LaLiga o lo apuntado por la app)
  const suma = sumaJugadores(S);
  const base = suma && suma.length > s.length ? suma : s;
  if (S.D.valorEquipo && (!base.length || Date.now() - base[base.length - 1][0] > 20 * 3600e3)) base.push([Date.now(), S.D.valorEquipo]);
  return base;
}
/** el valor de tus jugadores de hoy, día a día, sumando la serie de cada uno (null si falta la de muchos) */
export function sumaJugadores(S, dias = 90) {
  const { M } = S;
  const series = M.mias.filter((x) => x.j).map((x) => {
    const dv = (S.det && S.det[x.pid] && S.det[x.pid].valores) || [];
    const t = M.tend(x.pid).serie || [];
    return { v: x.j.valor, s: (dv.length > t.length ? dv : t).filter(([ts, v]) => Number.isFinite(ts) && v > 0).sort((a, b) => a[0] - b[0]) };
  });
  const con = series.filter((x) => x.s.length >= 3);
  if (!series.length || con.length < series.length * 0.7) return null;
  const DIA_MS = 864e5, hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const desde = Math.max(hoy.getTime() - (dias - 1) * DIA_MS, Math.min(...con.map((x) => x.s[0][0])));
  const out = [];
  for (let t = hoy.getTime() - (dias - 1) * DIA_MS; t <= hoy.getTime(); t += DIA_MS) {
    if (t < desde - DIA_MS / 2) continue;
    let total = 0;
    for (const x of series) {
      if (!x.s.length) { total += x.v; continue; }
      let v = x.s[0][1];
      for (const [ts, val] of x.s) { if (ts <= t + DIA_MS / 2) v = val; else break; }
      total += v;
    }
    out.push([t, total]);
  }
  return out.length >= 3 ? out : null;
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
  h += `<div class="graf-cab"><span>Valor del equipo${(S.H.yo || []).length < 7 && sumaJugadores(S) ? ' <small>(tus jugadores de hoy)</small>' : ''}</span><div class="rangos">${RANGOS.map(([n, txt]) => `<button data-accion="rango" data-n="${n}" data-pid="__equipo" class="${rango === n ? 'activo' : ''}">${txt}</button>`).join('')}</div></div>`;
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
    <div class="dato"><div class="et">Puedes gastar</div><div class="v">${eur(M.pujaMax)}<small>con el 20 % de deuda</small></div></div>
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
    <div class="s">${posTag(j)}<span>${esc(POS_LARGO[j.pos] || '')} · ${j.equipoId && S.D.equipos && S.D.equipos[j.equipoId] ? `<button class="enlace-j" data-club="${esc(j.equipoId)}">${esc(j.equipo || S.D.equipos[j.equipoId].nombre)}</button>` : esc(j.equipo || '')}</span>${estadoPill(j)}${oncePill(M, j)}</div></div>${(() => { const f = esFav(pid); return `<button class="fav-btn${f ? ' on' : ''}" data-accion="fav" data-pid="${esc(pid)}" aria-pressed="${f}" aria-label="${f ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${icono('estrella')}<span>${f ? 'Favorito' : 'Seguir'}</span></button>`; })()}</div>`;
  h += `<div class="valor-g"><span class="v">${eur(j.valor)}</span><span class="d">${delta(t, { largo: true })}</span>${t.d7 != null ? `<span class="d ${clase(t.d7)}">${eur(t.d7, { signo: true })} 7d</span>` : ''}</div>`;
  // con su partido de la jornada empezado: lo que lleva y lo que ha hecho (se pone al día solo)
  const vj = jornadaJugadorHTML(S, pid);
  if (vj) h += `<div id="vivo-j">${vj}</div>`;
  if (M.inercia && M.inercia(pid)) h += bloqueada('inercia') ? candado('inercia') : inerciaHTML(M, pid, !!mia);
  for (const n of notasDe(pid)) h += `<div class="aviso-ficha oro">${icono('nota')}<div><b>Le contaste a la IA:</b> ${esc(n.texto)} <span class="t2">(${cuando(n.t)})</span></div></div>`;
  if (op) h += `<div class="aviso-ficha">${icono('rayo')}<div><b>Plan de hoy: ${ACC[op.accion] || op.accion}${op.importe ? ` por ${eur(op.importe)}` : ''}${op.puja_max ? ` (puja hasta ${eur(op.puja_max)})` : ''}.</b> ${esc(op.motivo || '')}</div></div>`;
  for (const n of notasPlan(S, { j })) h += notaPlanHTML(n);
  const rango = S.rango || 30;
  h += `<div class="graf-cab"><span>Valor de mercado</span><div class="rangos">${RANGOS.map(([n, txt]) => `<button data-accion="rango" data-n="${n}" data-pid="${esc(pid)}" class="${rango === n ? 'activo' : ''}">${txt}</button>`).join('')}</div></div>`;
  h += `<div id="graf-j">${grafValor(serieValor(S, pid), rango, cargandoValor(S, pid))}</div>`;

  if (mia) {
    h += `<div class="aviso-ficha ${mia.riesgo === 'alto' ? '' : mia.riesgo === 'medio' ? 'oro' : 'verde'}">${icono('escudo')}<div><b>Es tuyo.</b> Cláusula ${eur(mia.clausula)}, ${mia.abierta ? '<b>abierta</b>: te lo pueden quitar ya' : mia.veda ? `a salvo mientras las cláusulas estén cerradas, hasta que empiece la jornada ${mia.veda.n} (${cuando(mia.protegidoHasta)}, en ${dura(mia.abreEn)})` : `${mia.escudo ? '<b>blindado</b>' : 'protegido'} hasta ${cuando(mia.protegidoHasta)} (${dura(mia.abreEn)})`}.${mia.abierta && S.M.paraEscudo && S.M.paraEscudo.includes(pid) ? ` <b>Blíndalo gratis</b> (en LaLiga, viendo un anuncio): ${S.M.ESCUDO_H} h protegido; te quedan ${S.M.escudosMios.quedan} esta jornada.` : ''} ${mia.riesgo === 'ninguno' ? 'Sin riesgo' : `Riesgo ${mia.riesgo}`}.${mia.compra ? ` Lo pagaste a ${eur(mia.compra)}: <b class="${clase(mia.ganado)}">${eur(mia.ganado, { signo: true })}</b>.` : mia.inicial ? ` Venía en tu equipo inicial: al empezar la liga valía ${eur(mia.inicial)} (<b class="${clase(mia.ganadoIni)}">${eur(mia.ganadoIni, { signo: true })}</b>).` : ' Lo que pagaste por él no sale en los movimientos de la liga.'}${(() => {
      // lo que le daría LaLiga si lo pones a la venta (lo que suele dar en tu liga sobre el valor)
      const ol = S.M.ofertaLigaDe ? S.M.ofertaLigaDe(j) : null;
      if (!ol || S.M.enVenta.has(pid)) return '';
      const ref = mia.compra || mia.inicial || null;
      const gana = ref ? ol.v - ref : null;
      return ` Si lo pones a la venta, LaLiga te daría unos <b>${eur(ol.v)}</b>${ol.sinDatos ? ' (cerca de su valor: aún no hay ventas a LaLiga en tu liga para afinarlo)' : ` (en tu liga da entre ${eur(ol.min)} y ${eur(ol.max)}, de mediana un ${pct(ol.med * 100)} sobre el valor)`}${gana != null ? `: <b class="${clase(gana)}">${eur(gana, { signo: true })}</b> sobre ${mia.compra ? 'lo que pagaste' : 'lo que valía al empezar'}` : ''}.`;
    })()}</div></div>`;
    const pg = mia.pagan;
    if (pg && (pg.hayDatos || pg.seguro.length || pg.quiza.length) && mia.clausula && (mia.abierta || mia.abreEn < 3 * DIA) && bloqueada('quienPaga')) h += candado('quienPaga');
    else if (pg && (pg.hayDatos || pg.seguro.length || pg.quiza.length) && mia.clausula && (mia.abierta || mia.abreEn < 3 * DIA)) {
      const nadie = !pg.seguro.length && !pg.quiza.length;
      // solo a quién le llega, sin cuánto tiene (eso es «dinero de los rivales», que va aparte)
      const lista = [...pg.seguro.map((x) => `<b>${esc(x.nombre)}</b>`), ...pg.quiza.map((x) => `${esc(x.nombre)} (justo)`)];
      const b = mia.blindaje;
      const bl = !b || b.yaVale ? '' : b.caro ? ` Dejarla fuera del alcance de todos costaría ${eur(b.coste)}: no compensa para lo que vale.${b.parcial ? ` <b>Lo que sí compensa:</b> subirla a ${eur(b.parcial.objetivo)} (te cuesta ${eur(b.parcial.coste)}) y solo le llegaría a ${esc(b.parcial.quedan.join(', '))}.` : ''}` : ` <b>Blindaje justo:</b> subirla a ${eur(b.objetivo)} te cuesta ${eur(b.coste)} y ${b.porTecho ? 'quedaría por encima de lo que se suele pagar en tu liga por una cláusula' : 'no le llegaría a nadie'}.`;
      h += `<div class="aviso-ficha ${nadie ? 'verde' : pg.seguro.length ? '' : 'oro'}">${icono('rivales')}<div>${nadie ? '<b>Ahora mismo no le llega a ningún rival.</b> Podrían juntarlo vendiendo, pero hoy no.' : `<b>Les llega:</b> ${lista.join(', ')}.`}${pg.sinSaber.length ? ` <span class="t2">(De ${pg.sinSaber.length} no se sabe el dinero.)</span>` : ''}${bl}</div></div>`;
    }
  } else {
    // en el mercado: libre de la liga (subasta a ciegas) o puesto a la venta por su dueño, otro manager
    if (enMercado) {
      const m = enMercado;
      const cc = m.tipo !== 'manager' && M.compraCal ? M.compraCal(j, m.puja || m.precio) : null;
      const vb = m.tipo === 'manager' && bloqueada('ventasRivales');
      if (m.tipo === 'manager') h += `<div class="aviso-ficha oro">${icono('usuario')}<div><b>Lo vende ${esc(m.vendedor || 'otro manager')}</b>, que lo ha puesto en el mercado y pide ${eur(m.precio)} (${pct((m.sobrePide || 0) * 100)} sobre su valor). Sigue siendo suyo: solo es tuyo si acepta tu oferta, no es un jugador libre de la liga.${m.ofertas ? ` Lleva ${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''} (cuánto, solo lo ve él).` : ''}${m.ofertaLiga ? (m.ofertaLiga.sinDatos || vb ? ' LaLiga también le hace su oferta y se queda con la mejor, así que lo que pide no basta.' : ` LaLiga también le hace su oferta, que solo ve él: en tu liga suele rondar <b>${eur(m.ofertaLiga.v)}</b> (de mediana un ${pct(m.ofertaLiga.med * 100)} sobre el valor, en ${m.ofertaLiga.n} ventas), y se queda con la mejor${m.precio >= m.ofertaLiga.v ? '. Aquí pide más que eso, así que lo que manda es su precio' : ': por menos lo normal es que no te lo venda'}.`) : ''}${m.noVende ? ` <b>Pero ${esc(m.noVende)}:</b> si lo vendiera no podría alinear un once, así que lo normal es que no te lo venda (lo tendrá a la venta para ver qué le da LaLiga).` : ''}${m.ofertaMin && !m.noVende && !vb ? ` Para que te lo venda, ofrécele <b>${eur(m.puja || m.ofertaMin)}</b>${m.ofertaAlta > m.ofertaMin ? (m.puja === m.ofertaAlta ? ` (lo más probable; con ${eur(m.ofertaMin)} tienes opciones, pero puede que LaLiga le dé más)` : ` (con ${eur(m.ofertaAlta)} es muy probable)`) : ''}.` : ''}${m.miPuja ? ` Tu oferta: ${eur(m.miPuja)}${m.ofertaMin && m.miPuja < m.ofertaMin ? ', por debajo de lo que suele dar LaLiga: súbela o lo normal es que no la acepte' : ''}.` : ''}</div></div>${vb && m.ofertaMin && !m.noVende ? candado('ventasRivales') : ''}`;
      else h += `<div class="aviso-ficha azul">${icono('mercado')}<div><b>Libre en el mercado de la liga</b> desde ${eur(m.precio)}. Subasta a ciegas${m.cierra ? ` hasta ${cuando(m.cierra)}` : ''}: se lo lleva la puja más alta. ${m.pujas ? `${m.pujas} puja${m.pujas > 1 ? 's' : ''}.` : 'Sin pujas.'}${m.miPuja ? ` Tu puja: ${eur(m.miPuja)}.` : cc && !cc.ok ? ` Con su calendario no pujaría por él${cc.parche ? `: sale ya a un ${pct(cc.sobre * 100)} sobre su valor y de parche no pagaría más de un 5 %` : ' salvo que te haga falta de parche'}.` : ` Para llevártelo, yo pujaría ${eur(m.puja)} (${pct((m.puja / m.precio - 1) * 100)}).`}${M.pujasLiga && !M.pujasLiga.poco ? ` En tu liga se paga de mediana un ${pct(M.pujasLiga.med * 100)} sobre el valor.` : ''}${m.topeCal && (!cc || cc.ok) ? ' La he dejado en un 5 % sobre su valor como mucho por su calendario: es solo de parche.' : m.recortada ? ' La he dejado más baja para no pagar de más por lo que te aporta.' : ''}</div></div>`;
    }
    if (suya) {
      if (suya.abierta && suya.meLlega) h += `<div class="aviso-ficha verde">${icono('diana')}<div><b>Puedes clausularlo ya</b> a ${esc(suya.rival.manager || suya.rival.nombre)} por ${eur(suya.clausula)}. Te quedarías con ${eur(suya.teQueda)}.</div></div>`;
      else if (suya.abierta) h += `<div class="aviso-ficha">${icono('candado')}<div>Su cláusula está abierta (${eur(suya.clausula)}, de ${esc(suya.rival.manager || suya.rival.nombre)}), pero te faltan <b>${eur(suya.clausula - num(S.D.dinero))}</b>: una cláusula solo se paga con saldo, sin deuda.</div></div>`;
      else h += `<div class="aviso-ficha oro">${icono('reloj')}<div>Es de <b>${esc(suya.rival.manager || suya.rival.nombre)}</b>. ${suya.escudo ? 'Lo ha <b>blindado</b>. ' : ''}${suya.veda ? `Las cláusulas están cerradas hasta que empiece la jornada ${suya.veda.n}: la suya (${eur(suya.clausula)}) se puede pagar <b>${cuando(suya.protegidoHasta)}</b>, en ${dura(suya.abreEn)}.` : `Su cláusula (${eur(suya.clausula)}) se abre <b>${cuando(suya.protegidoHasta)}</b>, en ${dura(suya.abreEn)}.`}${suya.meLlega ? ' Te llega con tu saldo.' : ` Con tu saldo te faltan ${eur(suya.clausula - num(S.D.dinero))} (las cláusulas no se pueden pagar con deuda).`}</div></div>`;
    } else if (!enMercado) {
      h += `<div class="aviso-ficha azul">${icono('info')}<div>No es de nadie en tu liga: puede salir en el mercado.</div></div>`;
    }
  }
  if (mia) h += `<button class="btn chico sec" data-accion="reventa" data-pid="${esc(pid)}" style="margin:2px 0 6px">${icono('cambio')}${M.reventa[pid] ? 'Quitar de «para revender»' : 'Lo tengo para revender'}</button>`;
  const venta = M.misVentas.find((v) => v.pid === pid);
  if (venta) h += `<div class="sec"><h2>En venta</h2></div>${ventaHTML(venta)}`;
  const f = mia || suya;
  h += `<div class="rejilla" style="margin-top:14px">
    <div class="dato"><div class="et">Puntos</div><div class="v">${num(j.puntos)}<small>${j.media ? String(Math.round(j.media * 10) / 10).replace('.', ',') + ' de media' : ''}</small></div></div>
    <div class="dato"><div class="et">Interés</div><div class="v">${inter.n}<small>/100</small></div></div>
    ${f ? `<div class="dato"><div class="et">Cláusula</div><div class="v">${eur(f.clausula)}<small>${f.ratio ? `${pct((f.ratio - 1) * 100, 0)}${f.clausula > j.valor ? ` · ${eur(f.clausula - j.valor)} de más` : ''}` : ''}</small></div></div>` : ''}
    <div class="dato"><div class="et">Próximo partido</div><div class="v" style="font-size:20px">${prox ? `${prox.casa ? 'vs' : 'en'} <span class="niv ${nivelCls(fr.nivel)}">${esc(prox.rival)}</span>` : '–'}<small>${prox ? `${fr.r ? `${fr.r.pos}º · ${fr.nivel} · ` : ''}${cuando(prox.fecha)}` : ''}</small></div></div>
  </div>`;
  if (j.pos < 5) {
    h += calendarioHTML(M, j, !!mia);
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
    if (tiles.length) h += `<div class="sec"><h2>Cómo puntúa</h2><span class="sub">${med ? `su media es ${d1(med)} pts` : 'puntos por partido'}</span></div><div class="rejilla rinde">${tiles.join('')}</div>`;
    h += esperadosHTML(M, j);
    // fuera del Fantasy: Understat y SofaScore
    const a = M.avanzado && M.avanzado(j.id);
    if (a) {
      const p90 = (val, min) => { if (!(min > 0)) return '–'; const x = (val * 90) / min; return String(Math.round(x * (x < 1 ? 100 : 10)) / (x < 1 ? 100 : 10)).replace('.', ','); };
      const c = [];
      if (a.u && a.u.min > 0) {
        c.push(`<span>xG <b>${d1(a.u.xg)}</b> (${a.u.g} goles)</span>`, `<span>xA <b>${d1(a.u.xa)}</b> (${a.u.a} asist.)</span>`);
        c.push(`<span>Tiros/90 <b>${p90(a.u.tiros, a.u.min)}</b></span>`, `<span>Pases clave/90 <b>${p90(a.u.pc, a.u.min)}</b></span>`);
      }
      if (a.s) {
        if (a.s.nota) c.push(`<span>Nota media <b>${String(a.s.nota).replace('.', ',')}</b></span>`);
        if (a.s.notas && a.s.notas.length) c.push(`<span>Últimas <b>${a.s.notas.map((n) => String(n).replace('.', ',')).join(' · ')}</b></span>`);
        if (j.pos === 1 && a.s.paradas && a.s.min) c.push(`<span>Paradas/90 <b>${p90(a.s.paradas, a.s.min)}</b></span>`);
        if (j.pos !== 1 && a.s.min && (a.s.recup || a.s.entradas)) c.push(`<span>Recup./90 <b>${p90(a.s.recup || a.s.entradas, a.s.min)}</b></span>`);
      }
      if (c.length) h += `<div class="sec"><h2>Rendimiento a fondo</h2><span class="sub">esta temporada</span></div><div class="previa">${c.join('')}</div>`;
    }
  } else h += `<div class="aviso-ficha">${icono('info')}<div>Es entrenador: en la versión gratis no se alinea ni puntúa. Si es tuyo, véndelo y usa el dinero en jugadores.</div></div>`;
  if (inter.por.length) h += `<p class="t2 peq">${barra(inter.n)} ${esc(inter.por.join(' · '))}</p>`;
  h += `<div id="det-j">${S.det && S.det[pid] ? detalleHTML(S.det[pid]) : '<div class="graf-vacio">Cargando sus partidos…</div>'}</div>`;
  const nots = M.noticiasDe(pid).slice(0, 6);
  if (nots.length) h += `<div class="sec"><h2>Noticias</h2></div>${nots.map(filaNoticia).join('')}`;
  const acts = M.actividad.filter((a) => a.pid === pid).slice(0, 6);
  if (acts.length) h += `<div class="sec"><h2>En tu liga</h2></div>${acts.map(filaActividad).join('')}`;
  h += `<button class="btn sec ancho" style="margin-top:18px" data-accion="preguntarJ" data-pid="${esc(pid)}">${icono('ia')}¿Qué hago con ${esc(j.nombre)}?</button>`;
  return h;
}

/** hacia dónde va su valor: lo que ha cambiado cada día y si se frena o ya ha girado */
function inerciaHTML(M, pid, mio) {
  const x = M.inercia ? M.inercia(pid) : null;
  if (!x || !['giro', 'baja', 'parado', 'frena', 'acelera', 'rebote'].includes(x.fase)) return '';
  const mal = x.fase === 'giro' || x.fase === 'baja', ojo = x.fase === 'parado' || x.fase === 'frena';
  const tit = { giro: 'Ha girado a la baja', baja: 'Está bajando', parado: 'Se ha estancado', frena: 'Se está frenando', acelera: 'Sube cada vez más', rebote: 'Rebota tras semanas bajando' }[x.fase];
  // un partidazo de hace nada cambia el consejo: lo normal es que mañana suba (lo avisó Domy el 25 oct)
  const pz = M.partidazo ? M.partidazo(pid) : null;
  // por escalones: 6-7 solo se avisa, 8-9 sin prisa por vender, 10 o más lo normal es que suba
  const pzTxt = pz ? [` <b>Ha hecho un buen partido (${pz.pts} puntos):</b> puede suavizar la bajada.`, ` <b>Ha hecho un partido muy bueno (${pz.pts} puntos):</b> lo normal es que la bajada se frene. ${mio ? 'Sin prisa: espera al cambio de mañana antes de venderlo.' : 'Si lo quieres, puede que mañana no esté más barato.'}`, ` <b>Ojo: acaba de hacer ${pz.pts} puntos.</b> Tras un partido así LaLiga suele subirle el valor los días siguientes, así que esta bajada puede frenarse o darse la vuelta. ${mio ? 'Espera a ver el cambio de mañana antes de venderlo.' : 'Si lo quieres, puede que mañana ya esté más caro.'}`][pz.nivel - 1] : '';
  const consejo = pz && pz.nivel >= 2 && (mal || ojo) ? pzTxt
    : (pz && (mal || ojo) ? pzTxt : '') + (x.fase === 'rebote' ? (mio ? ' Decide por sus puntos y su sitio en tu once.' : ' Si lo quieres, está cerca de su mínimo del mes, pero aún no ha demostrado que vaya a subir.')
    : mio ? (mal ? ' <b>Véndelo ya</b>, salvo que lo necesites sí o sí para la jornada.' : ojo ? ' <b>Véndelo antes de que gire.</b>' : '') : (mal || ojo ? ' No es momento de comprarlo.' : ''));
  const max = Math.max(...x.R.map((r) => Math.abs(r)), 1);
  const corto = (r) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${String(Math.round(Math.abs(r) / 1e4) / 100).replace('.', ',')}`;
  const barras = x.R.map((r, i) => `<div class="in-b"><i class="${r >= 0 ? 'up' : 'dw'}" style="--h:${Math.max(4, Math.round(Math.abs(r) / max * 100))}%"></i><span>${corto(r)}</span><em>${x.dias[i] ? new Date(x.dias[i] + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'narrow' }) : ''}</em></div>`).join('');
  return `<div class="inercia ${mal ? 'mal' : ojo ? 'ojo' : x.fase === 'rebote' ? 'neutra' : 'bien'}"><div class="in-cab">${icono(mal ? 'baja' : ojo ? 'reloj' : x.fase === 'rebote' ? 'cambio' : 'sube')}<b>${tit}</b><span class="t2">lo que cambia cada día, en M</span></div><div class="in-barras">${barras}</div><p>${esc(x.texto)}${consejo}</p></div>`;
}

/** los puntos esperados de su próximo partido, por partes, con la titularidad y la rotación */
function esperadosHTML(M, j) {
  const P = M.ppDetalle ? M.ppDetalle(j) : null;
  if (!P) return '';
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const prox = M.proximoPartido(j.equipoId);
  let h = `<div class="sec"><h2>Puntos esperados: ${d1(P.final)}</h2><span class="sub">${prox ? `J${prox.jornada} ${prox.casa ? 'vs' : 'en'} ${esc(prox.rival)}` : ''}</span></div>`;
  const d = P.d;
  if (d) {
    const N = { min: 'Minutos', gol: 'Gol', asis: 'Asistencia', cero: 'Portería a cero', encaja: 'Encajados', paradas: 'Paradas', tarjetas: 'Tarjetas', resto: 'Nota DAZN y extras' };
    h += `<div class="pp-partes">${Object.entries(d.partes).filter(([, v]) => Math.abs(v) >= 0.05).map(([k, v]) => `<div class="pp-p"><span>${N[k] || k}</span><i style="--w:${Math.min(100, Math.abs(v) / 4 * 100)}%" class="${v < 0 ? 'neg' : ''}"></i><b>${v < 0 ? '−' : '+'}${d1(Math.abs(v))}</b></div>`).join('')}</div>`;
    h += `<p class="t2 peq">Por partes, como puntúa LaLiga Fantasy, con ${d.fuente === 'medias del puesto' ? 'las medias de su puesto (no hay xG suyo)' : 'su xG y su xA de esta temporada'}, salen ${d1(d.total)}. Con la fórmula de siempre (media, forma y rival), ${d1(P.base)}. La cifra de arriba junta las dos${P.w && P.w !== 0.5 ? ` (el desglose pesa un ${Math.round(P.w * 100)} %, según lo que ha acertado cada una)` : ''}${P.sesgo !== 1 ? ` y se corrige ×${String(P.sesgo).replace('.', ',')} por lo que se ha fallado con su puesto` : ''}.</p>`;
  }
  const T = P.T;
  if (T) h += `<div class="previa"><span>Titular <b>~${Math.round(T.p * 100)} %</b></span>${T.fuentes.map((f) => `<span>${esc(f.f)} <b>${Math.round(f.p * 100)} %</b></span>`).join('')}</div>`;
  if (T && T.rot && T.rot.cerca.length) {
    h += `<div class="aviso-ficha oro">${icono('reloj')}<div><b>Riesgo de rotación${T.pRot ? ` (−${Math.round(T.pRot * 100)} % de titularidad)` : ''}.</b> Su equipo juega ${T.rot.cerca.map((x) => `${esc(x.comp)}${x.rival ? ` ${x.casa ? 'contra el' : 'en casa del'} ${esc(x.rival)}` : ''} ${cuando(x.t)} (${x.antes ? `${d1(x.dias)} días antes` : `${d1(x.dias)} días después`})`).join(' y ')}.</div></div>`;
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
  let h = `<div class="sec"><h2>Puntos por jornada</h2></div>${barras(st.slice(-10).map((s) => ({ et: 'J' + s.n, v: s.pts, yo: s === st[st.length - 1] })), { alto: 130 })}`;
  h += `<p class="t2 peq">Últimas ${ult.length}: <b>${String(Math.round(media5 * 10) / 10).replace('.', ',')}</b> pts de media · ha jugado ${jugados.length} de ${st.length} (${Math.round(tot('min'))} min)${tot('gol') ? ` · ${tot('gol')} gol${tot('gol') > 1 ? 'es' : ''}` : ''}${tot('asis') ? ` · ${tot('asis')} asist.` : ''}${tot('am') ? ` · ${tot('am')} amarilla${tot('am') > 1 ? 's' : ''}` : ''}${tot('roja') ? ` · ${tot('roja')} roja` : ''}</p>`;
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
const notaPlanHTML = ([et, t]) => `<div class="aviso-ficha azul peq">${icono('ia')}<div><b>${esc(et)}:</b> ${esc(t)}</div></div>`;

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
  if (P.franja) h += dato('Se mueve', `${P.franja.ini}–${P.franja.fin} h`, `${P.franja.n} de ${P.franja.de} (clausular, vender, blindar)`);
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
export function fichaRival(S, tid) {
  const { M } = S;
  const r = M.rivales.find((x) => x.e.teamId === tid);
  if (!r) return nada('No encuentro este equipo.');
  const e = r.e;
  const serie = r.serie.map(([d, v]) => [Date.parse(d + 'T12:00:00'), v]);
  let h = `<div class="hoja-cab"><h2>${esc(e.nombre)}</h2><span class="amenaza ${r.nivel}">Peligro ${PELIGRO[r.nivel]}</span></div>
  <p class="t2" style="margin:0 0 12px">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${e.pos}º con ${e.puntos} puntos</p>
  ${notasPlan(S, { tid }).map(notaPlanHTML).join('')}
  <div class="rejilla">
    <div class="dato"><div class="et">Valor</div><div class="v">${eur(e.valor)}<small class="${clase(r.dValor)}">${r.dValor != null ? eur(r.dValor, { signo: true, dec: 1 }) + ' 7d' : ''}</small></div></div>
    <div class="dato"><div class="et">Movimientos 7d</div><div class="v">${r.movs}</div></div>
    <div class="dato"><div class="et">Gastado 7d</div><div class="v">${eur(r.gastado)}<small>${r.ingresado ? `+${eur(r.ingresado, { dec: 1 })}` : ''}</small></div></div>
    <div class="dato"><div class="et">Cláusulas hechas</div><div class="v">${r.clausulazos}<small>14 d${r.contraMi ? `, ${r.contraMi} a ti` : ''}</small></div></div>
    ${bloqueada('dineroRivales') ? '' : `<div class="dato"><div class="et">Dinero</div><div class="v">${r.dinero && r.dinero.v != null ? dineroCorto(r.dinero) : '?'}<small>${r.dinero && r.dinero.v != null ? (r.dinero.exacto ? 'exacto' : `± ${eur(r.dinero.margen)} · estimado`) : 'no se sabe'}</small></div></div>`}
    <div class="dato"><div class="et">Paga en el mercado</div><div class="v">${r.paga ? pct(r.paga.med * 100) : '–'}<small>${r.paga ? `sobre el valor · ${r.paga.n} compra${r.paga.n > 1 ? 's' : ''}` : 'sin compras al mercado'}</small></div></div>
  </div>
  ${bloqueada('dineroRivales') ? candado('dineroRivales') : `<p class="t2 peq">${esc(dineroLargo(r.dinero))}</p>`}`;
  // la jornada en directo: lo que lleva y su once, jugador a jugador
  if (M.vivo && M.enJuego) {
    const V = M.vivo, tot = V.equipos && V.equipos[String(tid)];
    const o = S.oncesRival && S.oncesRival[tid] && S.oncesRival[tid].n === V.n ? S.oncesRival[tid] : null;
    const campo = o && o.ids ? campoVivo(M, o.ids) : '';
    h += `<div class="vivo-c"><div class="vivo-t"><span class="vivo-dot"></span><b>En directo · Jornada ${V.n}</b>${tot != null ? `<span class="vivo-tot">${tot} pts</span>` : ''}</div>
      ${campo || `<p class="t2 peq" style="margin:6px 0 0">${o ? 'LaLiga no enseña todavía su once de esta jornada.' : 'Cargando su once…'}</p>`}</div>`;
  }
  // si te ha dicho cuánto tiene, se apunta: desde entonces su dinero sale de eso más lo que mueva
  if (!(r.dinero && r.dinero.exacto) && !bloqueada('dineroRivales')) {
    const dc = r.dinero && r.dinero.dicho, cu = M.dineroCuenta ? M.dineroCuenta(tid) : null;
    h += `<div class="dicho">`;
    if (dc) h += `<p class="t2 peq">${dc.est != null ? `Cuando te lo dijo, la cuenta con los movimientos daba ${eur(dc.est)} (${eur(dc.v - dc.est, { signo: true })} de diferencia).` : ''}${cu && cu.v != null && (dc.est == null || Math.abs(cu.v - dc.est) >= 1e5) ? ` Ahora daría ${eur(cu.v)}.` : ''} <button class="enlace" data-accion="borrarDicho" data-tid="${esc(tid)}">Olvidar lo que te dijo</button></p>`;
    h += `<details class="dicho-f"><summary>${icono('euro')}${dc ? 'Te ha dicho otra cifra' : '¿Te ha dicho cuánto tiene?'}</summary>
      <div class="dicho-in"><span>Entre</span><input id="dichoMin" type="text" inputmode="decimal" placeholder="50" autocomplete="off"><span>y</span><input id="dichoMax" type="text" inputmode="decimal" placeholder="60" autocomplete="off"><span>M</span><button class="btn chico" data-accion="guardarDicho" data-tid="${esc(tid)}">Apuntar</button></div>
      <p class="t2 peq">En millones. Si te dijo una cifra, ponla en los dos. A partir de ahora su dinero sale de esto más lo que mueva, y la app aprende cuánto fallaba la cuenta.</p>
    </details></div>`;
  }
  if (r.leLlegan && r.leLlegan.length && bloqueada('quienPaga')) h += `<div class="sec"><h2>Tus cláusulas a su alcance</h2></div>${candado('quienPaga')}`;
  else if (r.leLlegan && r.leLlegan.length) {
    h += `<div class="sec"><h2>Tus cláusulas a su alcance</h2><span class="sub">${r.leLleganYa.length} abierta${r.leLleganYa.length === 1 ? '' : 's'}</span></div>`;
    h += r.leLlegan.map((x) => filaJugador(x, {
      sub: `Tuyo · vale ${eur(x.j.valor)}${x.blindaje && !x.blindaje.yaVale && !x.blindaje.caro ? ` · subirla a ${eur(x.blindaje.objetivo)} (${eur(x.blindaje.coste)})` : x.blindaje && x.blindaje.parcial ? ` · subirla a ${eur(x.blindaje.parcial.objetivo)} (${eur(x.blindaje.parcial.coste)})` : ''}`,
      extra: `${clausulaPill(x)}${x.abierta ? '<span class="pill mal">Te lo puede quitar ya</span>' : ''}`,
      derecha: `<div class="v">${eur(x.clausula)}</div>`, op: S.opPorPid[x.pid],
    })).join('');
  }
  // cómo juega (función top, desde la 0.6.5)
  h += bloqueada('perfilRival') ? `<div class="sec"><h2>Cómo juega</h2></div>${candado('perfilRival')}` : perfilHTML(S, tid);
  // lo que tiene en el mercado y lo que le da LaLiga por cada uno (función top)
  const vs = ventasDe(M, tid);
  if (vs.length && bloqueada('ventasRivales')) h += `<div class="sec"><h2>En el mercado</h2><span class="sub">${vs.length} en venta</span></div>${candado('ventasRivales')}`;
  else if (vs.length) {
    h += `<div class="sec"><h2>En el mercado</h2><span class="sub">${vs.length} en venta</span></div><p class="t2 peq" style="margin:0 0 6px">Lo que pide y lo que suele dar LaLiga por uno así (una estimación con lo vendido en tu liga: lo de hoy solo lo ve él). Se lo queda quien dé más: para que te lo venda a ti, supera la de LaLiga.</p>`;
    h += vs.map((m) => {
      const ol = m.ofertaLiga, conLiga = ol && !ol.sinDatos && ol.v;
      return filaJugador(m, {
        sub: `${esc(m.j.equipo)} · vale ${eur(m.j.valor)} · pide ${eur(m.precio)}${m.ofertas ? ` · ${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''}` : ''}`,
        pills: [m.noVende ? `<span class="pill mal" title="${esc(`No te lo venderá: ${m.noVende}`)}">No lo venderá</span>` : '', m.miPuja ? `<span class="pill abierta">Tu oferta ${eur(m.miPuja)}</span>` : '', estadoPill(m.j)],
        derecha: `<div class="v">${conLiga ? `~${eur(ol.v, { dec: 1 })}` : '?'}</div><div class="d apag">${conLiga ? 'suele dar LaLiga' : 'sin datos'}</div>${m.ofertaMin && !m.noVende ? `<div class="d apag">ofrece ${eur(m.puja || m.ofertaMin, { dec: 1 })}</div>` : ''}`, op: S.opPorPid[m.pid],
      });
    }).join('');
  }
  if (serie.length > 1) h += `<div class="sec"><h2>Su valor</h2></div>${linea(serie, { alto: 130 })}`;
  const fichas = [...r.fichas].sort((a, b) => (a.abierta === b.abierta ? (a.abierta ? (b.interes || 0) - (a.interes || 0) : a.abreEn - b.abreEn) : a.abierta ? -1 : 1));
  h += `<div class="sec"><h2>Su plantilla</h2><span class="sub">${r.abiertas} abiertas</span></div>`;
  h += fichas.length ? fichas.map((x) => filaJugador(x, {
    sub: `${esc(x.j.equipo)} · vale ${eur(x.j.valor)}`,
    extra: `${clausulaPill(x)}${estadoPill(x.j)}${x.meLlega && x.abierta ? '<span class="pill bien">Te llega</span>' : ''}`,
    derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${x.interes != null ? barra(x.interes) : ''}</div>`, op: S.opPorPid[x.pid],
  })).join('') : nada('No se ha podido leer su plantilla.');
  const acts = M.actividad.filter((a) => a.quienT === tid || a.otroT === tid).slice(0, 15);
  if (r.cambios.length || acts.length) {
    h += `<div class="sec"><h2>Lo que hace</h2></div>`;
    h += r.cambios.filter((m) => m.tipo === 'blinda').slice(0, 5).map((m) => `<div class="fila"><span class="ic-act blindaje">${icono('escudo')}</span><div class="fila-c"><div class="act-t">Subió la cláusula de <b>${esc(m.j.nombre)}</b> de ${eur(m.de)} a ${eur(m.a)}</div><div class="fila-s">${cuando(m.t)}</div></div></div>`).join('');
    h += acts.map(filaActividad).join('');
  }
  return h;
}

/* ================= ANUNCIO BONIFICADO ================= */
/** antes de ver un anuncio para desbloquear algo (de momento, otro plan de la IA cuando ya llevas 3 hoy) */
export function anuncioHTML(S, para) {
  const A = S.anuncio || {};
  if (para === 'top') return anuncioTopHTML(A);
  let h = `<div class="hoja-cab"><h2>Otro plan</h2></div>`;
  h += `<p class="t2" style="margin:0 0 14px">Hoy ya has pedido 3 planes a la IA. Para pedir otro, mira un anuncio corto. Mañana vuelves a tener 3 gratis.</p>`;
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
const interr = (on, accion, extra = '', nombre = '') => `<button class="interr ${on ? 'on' : ''}" data-accion="${accion}" ${extra} aria-pressed="${on}"${nombre ? ` aria-label="${esc(nombre)}"` : ''}></button>`;
export function ajustes(S) {
  const c = S.c, ca = cfgAvisos(), ci = cfgIA();
  const q = quien();
  const ses = sesion();
  const k = clave();
  const prog = programados();
  let h = `<div class="hoja-cab"><h2>Ajustes</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  // lo primero, avisar de un fallo (antes era un botón fijo arriba; lo pidió Carlos el 25 oct): con las respuestas sin
  // leer y, para el dueño, los avisos sin contestar
  {
    const av = avisosGuardados();
    const sinLeer = (av.lista || []).filter((x) => x.respuesta && !x.vista).length;
    const pend = av.admin ? av.pendientes || 0 : 0;
    const sub = av.admin ? (pend ? `${pend} sin contestar${sinLeer ? ` · ${sinLeer} respuesta${sinLeer === 1 ? '' : 's'} sin leer` : ''}` : 'Los avisos de tu liga y tus respuestas')
      : sinLeer ? `Tienes ${sinLeer} respuesta${sinLeer === 1 ? '' : 's'} sin leer` : 'Si algo no funciona o no cuadra: me llega y te contesto aquí';
    const n = sinLeer + pend;
    h += `<button class="ajuste-tour ajuste-fallo" data-accion="avisos">${icono('bicho')}<span><b>${av.admin ? 'Avisos de fallo' : 'Reportar un fallo'}</b><small>${esc(sub)}</small></span>${n ? `<em class="gl-aj">${n}</em>` : ''}${icono('flecha')}</button>`;
  }
  h += `<button class="ajuste-tour" data-accion="tutorial">${icono('info')}<span><b>Tutorial de la app</b><small>Dónde está cada cosa y para qué sirve, en un minuto</small></span>${icono('flecha')}</button>`;

  h += `<div class="grupo"><span>Tu cuenta de LaLiga</span></div>`;
  if (enDemo()) h += `<div class="ajuste"><div class="c"><b>Liga de ejemplo</b><span>Los datos son inventados</span></div>${enApp || enWeb ? '<button class="btn chico" data-accion="salirDemo">Usar la mía</button>' : ''}</div>`;
  else h += `<div class="ajuste"><div class="c"><b>${esc((q && (q.nombre || q.correo)) || 'Conectado')}</b><span>${esc(q && q.correo ? q.correo : '')}${ses && ses.desde ? ` · desde ${cuando(ses.desde, { hora: false })}` : ''}</span></div><button class="btn chico sec" data-accion="salir">${icono('salir')}Salir</button></div>`;
  // la misma liga en el ordenador: la app deja la sesión con un código de un solo uso
  if ((enApp || enWeb) && !enDemo() && ses) h += `<div class="ajuste"><div class="c"><b>${enApp ? 'Abrir en el ordenador' : 'Abrir en otro dispositivo'}</b><span>${enApp ? 'Te da un código para entrar en la versión web con tu liga, tu clave de la IA y lo que has apuntado' : 'Te da un código para entrar con tu cuenta en la web desde el iPhone u otro ordenador, sin volver a hacer lo del F12'}</span></div><button class="btn chico" data-accion="vincularWeb">Código</button></div>`;
  if (S.D && S.D.ligas && S.D.ligas.length > 1) h += `<div class="ajuste"><div class="c"><b>Liga</b></div><select data-cambia="liga">${S.D.ligas.map((l) => `<option value="${esc(l.id)}" ${S.D.liga.id === l.id ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}</select></div>`;

  h += `<div class="grupo"><span>IA (Gemini, gratis)</span></div>`;
  if (enApp && !enDemo()) {
    const cf = cfgFondo(), uf = ultimoFondo();
    const ult = uf ? `Última vez ${cuando(uf.t)}: ${uf.error ? `falló (${uf.error})` : (uf.pasos || []).slice(-1)[0] || 'bien'}` : 'Aún no ha trabajado sola';
    h += `<div class="ajuste"><div class="c"><b>Trabaja con la app cerrada</b><span>${cf.on ? `Cada 3 horas y al cambiar el mercado pone tu liga al día, rehace el plan y te avisa de ofertas, cláusulas y fichajes. ${!nativo.avisosPermitidos() ? '<b class="rojo">Falta el permiso de notificaciones.</b> ' : ''}${esc(ult)}.` : 'Apagado: solo trabaja cuando abres la app'}</span></div>${interr(cf.on, 'fondo', '', 'Trabaja con la app cerrada')}</div>`;
  }
  h += `<div class="ajuste"><div class="c"><b>Clave de Google AI Studio</b><span>${k ? `${esc(k.slice(0, 6))}…${esc(k.slice(-4))}` : 'Sin clave: el plan sale sin noticias'}</span></div>${k ? '<button class="btn chico sec" data-accion="borrarClave">Quitar</button>' : '<button class="btn chico" data-accion="irIA">Poner</button>'}</div>`;
  if (k) {
    const lista = ((LS.get('ia-modelos', {}) || {}).lista) || [];
    const fuera = LS.get('ia-agotados', {}) || {};
    const hoyG = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const agot = Object.entries(fuera).filter(([, v]) => v && v.d === hoyG).map(([m]) => m);
    h += `<div class="ajuste"><div class="c"><b>Modelos de IA</b><span>${lista.length ? `Tu clave de Google da acceso a ${lista.length} versiones de Gemini, cada una con su cupo gratis diario${agot.length ? ` (${agot.length} lo han gastado hoy)` : ''}. Si una se agota, la app pasa sola a la siguiente.` : 'Aún no he comprobado qué versiones de Gemini da tu clave'}</span></div><button class="btn chico sec" data-accion="probarIA">Comprobar</button></div>`;
    h += `<div class="ajuste"><div class="c"><b>Plan automático al abrir</b><span>Lo rehace solo si es de otro día o ha cambiado el mercado</span></div>${interr(ci.auto, 'iaAuto', '', 'Plan automático al abrir')}</div>`;
    h += `<div class="ajuste"><div class="c"><b>Buscar noticias en Google</b><span>Si se acaba su cupo, sigue sin búsqueda</span></div>${interr(ci.web, 'iaWeb', '', 'Buscar noticias en Google')}</div>`;
    const pu = ci.pullitas || 'normal';
    h += `<div class="ajuste"><div class="c"><b>Pullitas de la IA</b><span>Las bromas sobre noticias de los jugadores y sobre lo que hacen tus rivales. Nunca deciden una compra ni una venta</span></div><select data-cambia="pullitas">${[['no', 'Sin pullitas'], ['suave', 'Suaves'], ['normal', 'Normales'], ['saco', 'A saco']].map(([v, t]) => `<option value="${v}"${pu === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
  }

  h += `<div class="grupo"><span>Avisos en el móvil</span></div>`;
  if (!enApp) h += `<p class="t2 peq" style="margin:4px 0 0">Los avisos (cláusulas que se abren, el cambio de mercado, el plan del día) y la IA trabajando sola llegan en la app del móvil. En el navegador no.</p>`;
  else h += `<div class="ajuste"><div class="c"><b>Avisos</b><span>${ca.on ? (nativo.avisosPermitidos() || !enApp ? `${prog.length} programados` : 'Falta el permiso de notificaciones') : 'Apagados'}</span></div>${interr(ca.on, 'avisosOn', '', 'Avisos')}</div>`;
  if (ca.on && enApp) {
    if (!nativo.alarmasExactas()) h += `<div class="ajuste"><div class="c"><b>Al minuto exacto</b><span>Sin este permiso pueden llegar unos minutos tarde</span></div><button class="btn chico" data-accion="exactas">Dar permiso</button></div>`;
    h += [['rivales', 'Cláusulas de rivales que se abren', 'Las que te interesan y te llegan'], ['mias', 'Protección de los tuyos', '2 horas antes de que se acabe'], ['mercado', 'El mercado cambia', '1 hora antes'], ['jornada', 'Empieza la jornada', '3 horas antes'], ['diario', 'Plan del día', 'Un aviso para abrir la app y ver el plan']]
      .map(([kk, t, s]) => `<div class="ajuste"><div class="c"><b>${t}</b><span>${s}</span></div>${kk === 'diario' && ca.diario ? `<input type="time" value="${esc(ca.hora)}" data-cambia="horaAviso" style="margin-right:6px">` : ''}${interr(ca[kk], 'avisoTipo', `data-k="${kk}"`, t)}</div>`).join('');
    h += `<div class="ajuste"><div class="c"><b>Interés mínimo</b><span>Solo cláusulas que te interesen al menos esto</span></div><select data-cambia="interes">${[30, 40, 50, 55, 60, 70, 80].map((n) => `<option value="${n}" ${+ca.interes === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    const prox = prog.filter((a) => a.id !== 'diario').slice(0, 6);
    if (prox.length) h += `<p class="t2 peq" style="margin:10px 0 0">Próximos: ${prox.map((a) => `${esc(a.titulo)} (${cuando(a.t)})`).join(' · ')}</p>`;
    h += `<button class="btn chico sec" style="margin-top:10px" data-accion="probarAviso">Probar un aviso</button>`;
  }

  h += `<div class="grupo"><span>App</span></div>`;
  if (estadoLimite.min != null) h += `<div class="ajuste"><div class="c"><b>Tiempo de hoy: ${Math.round(estadoLimite.usados / 60)} de ${estadoLimite.min} min</b><span>Tienes un límite de ${estadoLimite.min} minutos al día con la app abierta. Se reinicia a las 00:00.</span></div></div>`;
  const ew = enApp ? nativo.estadoWeb() : null;
  h += `<div class="ajuste"><div class="c"><b>Versión ${VERSION}</b><span>${enApp ? `Compilación ${nativo.version()}${nativo.canal() === 'play' ? ' · Google Play' : ''}${ew && ew.activa ? ' · puesta al día sola, sin reinstalar' : ''}` : enWeb ? 'En el navegador' : 'En el navegador (ejemplo)'}</span></div>${enApp ? '<button class="btn chico sec" data-accion="buscarVersion">Buscar nueva</button>' : '<button class="btn chico sec" data-accion="buscarWeb">Buscar nueva</button>'}</div>`;
  h += `<div class="ajuste"><div class="c"><b>Novedades</b><span>Lo que trae cada versión y lo que arregla</span></div><button class="btn chico sec" data-accion="novedades">Ver</button></div>`;
  if (avisosGuardados().admin && !enDemo()) h += `<div class="ajuste"><div class="c"><b>Quién usa la app</b><span>Solo lo ves tú: quién de tu liga la tiene, cuándo entró y quién está dentro ahora</span></div><button class="btn chico" data-accion="quienUsa">Ver</button></div>`;
  h += `<div class="ajuste"><div class="c"><b>Diagnóstico</b><span>Lo que han contestado LaLiga y Google en esta sesión</span></div><button class="btn chico sec" data-accion="diag">Ver</button></div>`;
  if ((enApp || enWeb) && !enDemo()) h += `<div class="ajuste"><div class="c"><b>Ver la liga de ejemplo</b><span>Sin tocar tus datos</span></div><button class="btn chico sec" data-accion="entrarDemo">Ver</button></div>`;
  h += `<div class="ajuste"><div class="c"><b>Borrar los datos guardados</b><span>Histórico, fichas y planes (tu sesión y tu clave no)</span></div><button class="btn chico sec" data-accion="borrarDatos">Borrar</button></div>`;
  h += `<div class="ajuste"><div class="c"><b>Privacidad</b><span>Qué datos usa la app y dónde se quedan</span></div><a class="btn chico sec" href="privacidad.html">Ver</a></div>`;
  // (solo en la versión de Google Play, si Google pide dejar cambiarlo: en la UE, sí)
  if (enApp && nativo.hayPrivacidadAnuncios()) h += `<div class="ajuste"><div class="c"><b>Privacidad de los anuncios</b><span>Cambia si los anuncios pueden usar tus datos para personalizarse</span></div><button class="btn chico sec" data-accion="privAnuncios">Cambiar</button></div>`;
  h += `<p class="peq apag" style="margin-top:16px">Fantasy Manager es una app no oficial: no es de LaLiga ni tiene relación con LaLiga. Lee tu liga con tu cuenta, como su app, y usa datos públicos de fútbol. Tu sesión y tu clave se quedan en ${enApp ? 'este móvil' : 'este navegador'}.</p>`;
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
  ${x.respuesta ? `<div class="aviso-resp"><b>${esc(x.por || 'Respuesta')}</b><span>${esc(x.respuesta)}</span><small>${cuando(x.respondida)}</small></div>` : ''}</div>`;
function detalleAviso(A, x) {
  const d = A.detalle;
  // mientras llega el aviso entero, su texto (el de la lista) y que se está cargando
  if (!d) return `<div class="aviso-det"><p class="aviso-texto">${esc((x && x.txt) || '')}</p><p class="t2 peq cargando-av">${icono('reloj')}Cargando el aviso entero…</p></div>`;
  if (d.error) return `<div class="error-c">${esc(d.error)}</div>`;
  return `<div class="aviso-det">
    <p class="aviso-texto">${esc(d.texto)}</p>
    ${capturasRecibidas(A, d)}
    <p class="t2 peq">${esc([d.liga, d.app].filter(Boolean).join(' · '))}</p>
    ${d.diag ? `<details><summary>Diagnóstico</summary><pre class="diag">${esc(d.diag)}</pre></details>` : '<p class="t2 peq">Sin diagnóstico.</p>'}
    ${d.respuesta ? `<div class="aviso-resp"><b>Le contestaste</b><span>${esc(d.respuesta)}</span><small>${cuando(d.respondida)}${d.vista ? ' · leído' : ' · sin leer'}</small></div>` : ''}
    <textarea id="respTxt" class="campo-t aviso-t" rows="3" maxlength="2000" placeholder="${d.respuesta ? 'Cambiar la respuesta' : 'Tu respuesta: le llega en la app'}">${esc(A.respBorrador || '')}</textarea>
    <button class="btn chico" data-accion="responderAviso" data-id="${esc(d.id)}"${A.respondiendo ? ' disabled' : ''}>${A.respondiendo ? 'Mandando…' : `${icono('enviar')}Responder`}</button></div>`;
}
export function avisos(S) {
  const A = S.av || {};
  let h = `<div class="hoja-cab"><h2>${A.admin ? 'Avisos de fallos' : 'Avisar de un fallo'}</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (A.admin) h += bandejaAvisos(A);
  if (A.admin) h += '<div class="grupo"><span>Mandar uno tú</span><span></span></div>';
  if (A.sinSesion) {
    h += `<p class="t2">Para mandarme un aviso y que te pueda contestar hace falta entrar con tu cuenta de LaLiga${enDemo() ? ' (ahora estás viendo la liga de ejemplo)' : ''}. Mientras, puedes mandarme el diagnóstico por WhatsApp.</p>
      <button class="btn sec ancho" data-accion="compartirDiag">${icono('copiar')}${enApp ? 'Mandar el diagnóstico' : 'Copiar el diagnóstico'}</button>`;
  } else {
    h += `<p class="t2 peq" style="margin-top:0">Cuéntame qué ha pasado y qué estabas haciendo. Me llega a mí y te contesto aquí mismo: te aviso cuando haya respuesta.</p>
      <textarea id="avisoTxt" class="campo-t aviso-t" rows="4" maxlength="4000" placeholder="Por ejemplo: al abrir Mercado se queda en blanco">${esc(A.borrador || '')}</textarea>
      ${capturasHTML(A)}
      <label class="aviso-diag"><input type="checkbox" id="avisoDiag"${A.sinDiag ? '' : ' checked'}><span>Mandar también el diagnóstico (versión, lo que ha contestado LaLiga…). No lleva tu sesión ni tu clave de la IA.</span></label>
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
  else h += `<div class="avisos-claude"><button class="btn chico sec" data-accion="copiarAvisos">${icono('copiar')}Copiar para Claude</button><span class="t2 peq">${A.pendientes ? 'Los que están sin contestar' : 'Los últimos 5'}, con su diagnóstico. Pégalos en el chat.</span></div>${A.paraClaude ? `<div class="para-claude"><textarea class="campo-t aviso-t" rows="5" readonly>${esc(A.paraClaude)}</textarea><button class="btn chico" data-accion="copiarParaClaude">${icono('copiar')}Copiar otra vez</button></div>` : ''}`;
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
      : `${dentro ? 'Dentro ahora' : `Entró ${cuando(x.ultima)}`} · ${donde} ${esc(String(x.v || '').replace(/ !$/, ''))}${fallo ? ' · <b class="rojo">no le carga la liga</b>' : ''}${x.segHoy ? ` · ${Math.round(x.segHoy / 60)} min hoy` : ''}`;
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
  h += `<p class="quien-res"><b>${conApp} de ${tabla.length}</b> de tu liga han entrado en la app${dentro ? ` · <b>${dentro}</b> dentro ahora` : ''}.</p>`;
  h += `<div class="quien-l">${filas}</div>`;
  const fuera = lista.filter((x) => !deLiga.has(String(x.uid)));
  if (fuera.length) h += `<div class="grupo"><span>De fuera de tu liga</span></div><div class="quien-l">${fuera.map((x) => fila(x.nombre || 'Sin nombre', x.equipo, x)).join('')}</div>`;
  h += `<p class="peq apag" style="margin-top:14px">«Dentro ahora» es que ha tenido la app abierta en los últimos 12 minutos. Se apunta al abrirla con su cuenta de LaLiga: quien solo ha visto la liga de ejemplo, o tiene una versión anterior a la 0.4.4, no sale.</p>`;
  return h;
}

/* ================= DIAGNÓSTICO ================= */
export function textoDiagnostico(S) {
  const s = sesion();
  const D = S.D;
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
    S.errorCarga ? `Última carga: ✗ ${S.errorCarga.tipo} · ${S.errorCarga.detalle} (${horaDe(S.errorCarga.t)})` : 'Última carga: bien',
    `Ligas: ${D && D.ligas ? D.ligas.map((l) => `${l.id}${l.premium ? ' (premium)' : ''}${D.liga && l.id === D.liga.id ? ' ←' : ''}`).join(', ') : '¿?'} · pantalla ${typeof innerWidth !== 'undefined' ? `${innerWidth}×${innerHeight}` : '?'} · ${typeof navigator !== 'undefined' && navigator.onLine === false ? 'SIN RED' : 'con red'}`,
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
    S.M ? `Clausulazos: ${S.M.clausulazos ? `${S.M.clausulazos.n}, mediana ${pct(S.M.clausulazos.med * 100)}, p90 ${pct(S.M.clausulazos.p90 * 100)}` : 'ninguno medible'} · Ofertas de LaLiga: ${S.M.ofertaLiga ? `${S.M.ofertaLiga.n} ventas, mediana ${pct(S.M.ofertaLiga.med * 100)}${S.M.ofertaLiga.poco ? ' (pocas)' : ''}` : 'sin ventas a LaLiga medibles'} · Pujas de la liga: ${S.M.pujasLiga ? `${S.M.pujasLiga.n} compras, mediana ${pct(S.M.pujasLiga.med * 100)}${S.M.pujasLiga.poco ? ' (pocas)' : `, p25 ${pct(S.M.pujasLiga.p25 * 100)}, p75 ${pct(S.M.pujasLiga.p75 * 100)}`}` : 'sin compras al mercado medibles'} · aprendizaje: ${S.M.aprende && S.M.aprende.prev ? (S.M.aprende.prev.poco ? `${S.M.aprende.prev.pares} pares (pocos)` : `${S.M.aprende.prev.pares} pares, error ${S.M.aprende.prev.mae.final}, peso desglose ${S.M.aprende.prev.w}, sesgo ${JSON.stringify(S.M.aprende.prev.sesgo)}`) : 'sin jornadas evaluadas'}${S.M.aprende && S.M.aprende.planes ? ` · planes ${S.M.aprende.planes.bien}/${S.M.aprende.planes.n}` : ''}` : '',
    `IA: clave ${hayClave() ? 'sí' : 'no'} · modelos ${(((LS.get('ia-modelos', {}) || {}).lista) || []).join(', ') || '¿?'}`,
    ...intentosIA.slice(0, 20).map((x) => `  ${horaDe(x.t)} ${x.modelo}${x.web ? ' +web' : ''}${x.nivel ? ` ·${x.nivel}` : ''}${x.relevo ? ' (relevo)' : ''} ${x.ok ? `OK${x.fin && x.fin !== 'STOP' ? ` ${x.fin}` : ''}${x.car != null ? ` ${x.car} car.` : ''}${x.tok ? ` (tokens: ${x.tok.p} entran, ${x.tok.th} pensando, ${x.tok.r} escritos)` : ''}` : `✗ ${x.s} ${x.e}`}${x.google ? ` «${x.google}»` : ''} ${x.ms}ms`),
    (() => {
      const uf = ultimoFondo(), nf = nativo.estadoFondo() || {};
      return `Segundo plano: ${cfgFondo().on ? 'sí' : 'no'}${nf.ini ? ` · empezó ${new Date(nf.ini).toISOString()}` : ''}${nf.fin ? ` · acabó ${new Date(nf.fin).toISOString()}` : ''}${nf.prog ? ` · próxima tras el mercado ${new Date(nf.prog).toISOString()}` : ''}${nf.error ? ` · ✗ ${nf.error}` : ''}${uf ? ` · web: ${(uf.pasos || []).join(' / ')}${uf.error ? ` ✗ ${uf.error}` : ''} (${Math.round((uf.ms || 0) / 1000)} s${uf.avisos != null ? `, ${uf.avisos} avisos` : ''})` : ''}`;
    })(),
    ...((ultimoFondo() || {}).ia || []).map((x) => `  [fondo] ${horaDe(x.t)} ${x.modelo}${x.web ? ' +web' : ''} ${x.ok ? 'OK' : `✗ ${x.s} ${x.e}`} ${x.ms}ms`),
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
export function diagnostico(S) {
  return `<div class="hoja-cab"><h2>Diagnóstico</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>
  <p class="t2 peq">Lo que han contestado LaLiga y Google en esta sesión. Si algo no funciona, cópialo y pásamelo.</p>
  <pre class="diag">${esc(textoDiagnostico(S))}</pre>
  <div style="display:flex;gap:10px;margin-top:12px"><button class="btn chico" data-accion="copiarDiag">${icono('copiar')}Copiar</button><button class="btn chico sec" data-accion="compartirDiag">Compartir</button></div>`;
}
