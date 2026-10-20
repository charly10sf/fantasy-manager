/* Las cinco pestañas: Inicio, Equipo, Rivales, Mercado y Análisis. Cada una devuelve su HTML. */
import { esc, eur, eurPartido, pct, dura, cuando, icono, clase, POS_PLURAL, num, DIA, HORA, rel } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, partidoTxt, filaJugador, nada } from './comunes.js';
import { linea, barra, campo } from './graficos.js';
import { hayClave, ultimoAnalisis, NOMBRES } from './ia.js';

const ICO_ACT = { compra: 'mercado', clausula: 'diana', venta: 'euro', blindaje: 'escudo', premio: 'hucha', alineacion: 'alerta', entra: 'usuario', otro: 'cambio' };
const VERBO = { compra: 'fichó a', clausula: 'clausuló a', venta: 'vendió a', blindaje: 'blindó a', premio: 'cobró por la jornada', alineacion: 'no puntuó por alineación incorrecta', entra: 'entró en la liga', otro: 'movió a' };
const VERBO_TU = { compra: 'fichaste a', clausula: 'clausulaste a', venta: 'vendiste a', blindaje: 'blindaste a', premio: 'cobraste por la jornada', alineacion: 'no puntuaste por alineación incorrecta', entra: 'entraste en la liga', otro: 'moviste a' };
export const PELIGRO = { alta: 'alto', media: 'medio', baja: 'bajo' };

export function filaActividad(a) {
  const quien = a.esYo ? 'Tú' : esc(a.quien || 'Alguien');
  const jug = a.nombreJ ? ` <b>${esc(a.nombreJ)}</b>` : '';
  const a2 = a.otro ? ` ${a.clase === 'clausula' ? 'de' : 'a'} ${a.contraMi ? '<b class="rojo">ti</b>' : esc(a.otro)}` : '';
  const imp = a.importe ? `<div class="v">${eur(a.importe)}</div>` : '';
  const pid = a.pid ? `data-j="${esc(a.pid)}"` : '';
  return `<button class="fila" ${pid}>
    <span class="ic-act ${a.clase}">${icono(ICO_ACT[a.clase] || 'cambio')}</span>
    <div class="fila-c"><div class="fila-s" style="white-space:normal;color:var(--texto)"><b>${quien}</b> ${(a.esYo ? VERBO_TU : VERBO)[a.clase] || 'movió a'}${jug}${a2}</div><div class="fila-s">${a.t ? cuando(a.t) : ''}</div></div>
    <div class="fila-d">${imp}</div></button>`;
}

function insignia(M) {
  const ahora = Date.now();
  if (M.enParon) return `<span class="insignia paron">${icono('bandera')}Parón <small>vuelve ${cuando(M.paron.fin, { hora: false })}</small></span>`;
  if (M.enJuego) return `<span class="insignia">${icono('balon')}Jornada ${M.enJuego.n} <small>en juego</small></span>`;
  if (M.proxima) return `<span class="insignia">${icono('balon')}Jornada ${M.proxima.n} <small>${dura(M.proxima.ini - ahora)}</small></span>`;
  return '';
}

/* ================= INICIO ================= */
export function inicio(S) {
  const { D, M, H, c } = S;
  const yo = M.yo || {};
  const din = eurPartido(D.dinero);
  const serieYo = (H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
  const hoyMueve = [...M.mias].filter((x) => x.tend.d1).sort((a, b) => Math.abs(b.tend.d1) - Math.abs(a.tend.d1)).slice(0, 4);
  const dEquipo = M.mias.reduce((s, x) => s + num(x.tend.d1), 0);
  const parar = M.clausulas.filter((x) => x.meLlega && x.interes >= 45 && (x.abierta || x.abreEn < 2 * DIA)).sort((a, b) => (a.abierta === b.abierta ? (a.abierta ? b.interes - a.interes : a.abreEn - b.abreEn) : a.abierta ? -1 : 1)).slice(0, 10);
  const riesgo = M.mias.filter((x) => x.riesgo === 'alto' || x.riesgo === 'medio');
  const A = ultimoAnalisis();
  let h = '';
  if (D.demo) h += `<div class="banda">${icono('info')}<span>Estás viendo una liga de ejemplo.</span><button data-accion="salirDemo">Usar la mía</button></div>`;
  if (D.avisos && D.avisos.length) h += `<div class="banda">${icono('alerta')}<span>No se ha podido leer: ${esc(D.avisos.map((a) => a.paso).slice(0, 3).join(', '))}.</span><button data-accion="diag">Ver</button></div>`;
  h += `<div class="hero"><div><div class="hero-et">Saldo</div></div>${insignia(M)}</div>
  <div class="hero-num ${D.dinero < 0 ? 'neg' : ''}">${esc(din.ent)}<small>${esc(din.dec)} ${din.uni}</small></div>
  <div class="linea-dato">Puedes gastar hasta <b>${eur(M.pujaMax)}</b> <span class="apag">con el ${c.deuda} % de deuda${M.misPujas ? ` y tus pujas` : ''}</span></div>
  <div class="linea-dato"><b class="${clase(dEquipo)}">${dEquipo ? eur(dEquipo, { signo: true }) : '='}</b> hoy en el valor de tu equipo</div>`;
  if (hoyMueve.length) {
    h += `<div class="linea-dato" style="margin-top:14px">Lo que más mueve hoy tu equipo</div><div class="chips">${hoyMueve.map((x) => `<button class="chip ${clase(x.tend.d1)}" data-j="${esc(x.pid)}"><span class="tri">${x.tend.d1 > 0 ? '▲' : '▼'}</span>${esc(x.j.nombre)} <b>${eur(x.tend.d1, { signo: true, dec: 1 })}</b>${x.tend.p1 != null ? `<small>${pct(x.tend.p1)}</small>` : ''}</button>`).join('')}</div>`;
  }
  h += '<hr class="sep">';
  h += `<div class="rejilla">
    <div class="dato"><div class="et">Valor del equipo</div><div class="v">${eur(D.valorEquipo)}</div></div>
    <div class="dato"><div class="et">Clasificación</div><div class="v">${yo.pos || '–'}º<small>${num(yo.puntos)} pts</small></div></div>
    <div class="dato"><div class="et">Ganado con tus fichajes</div><div class="v ${clase(M.ganadoTotal)}">${M.conCompra ? eur(M.ganadoTotal, { signo: true }) : '–'}</div></div>
    <div class="dato"><div class="et">Para clausular ya</div><div class="v ${M.clausulas.some((x) => x.abierta && x.meLlega) ? 'rojo' : ''}">${M.clausulas.filter((x) => x.abierta && x.meLlega).length}<small>te llegan</small></div></div>
  </div>`;
  if (serieYo.length > 1) h += `<h2 class="sec">Valor de tu equipo</h2>${linea(serieYo, { alto: 140 })}`;

  h += `<div class="tarjeta acento"><div class="tarjeta-cab"><h3>Lo que toca ahora</h3><button data-ir="analisis">${hayClave() ? 'Análisis' : 'Con IA'}</button></div>`;
  h += M.acciones.length ? M.acciones.slice(0, 6).map((a) => `<button class="accion" ${a.pid ? `data-j="${esc(a.pid)}"` : a.hash ? `data-ir="${a.hash}"` : ''}>
      <div class="cu">${icono(a.icono || 'rayo')}${esc(a.cuando)}</div><div class="ti">${esc(a.titulo)}</div><div class="tx">${esc(a.texto)}</div></button>`).join('') : nada('Nada urgente. Cuando se abra una cláusula que te interese o pase algo con los tuyos, saldrá aquí.');
  h += '</div>';

  if (parar.length) {
    h += `<h2 class="sec">Para clausular<button class="mas" data-ir="rivales" data-seg="rivales:clausulas">Todas</button></h2><div class="carril">`;
    h += parar.map((x) => `<button class="mini-t" data-j="${esc(x.pid)}">
      <div class="cab">${ava(x.j)}<div style="min-width:0"><div class="n">${esc(x.j.nombre)}</div><div class="s">${esc(x.rival.nombre)}</div></div></div>
      <div class="gr">${eur(x.clausula)} <small>vale ${eur(x.j.valor, { dec: 1 })}</small></div>
      <div class="cuenta ${x.abierta ? 'ya' : ''}">${icono(x.abierta ? 'abierto' : 'reloj')}${x.abierta ? 'Abierta ya' : `${dura(x.abreEn)} · ${cuando(x.protegidoHasta).replace(/^.*\s(\d\d:\d\d)$/, '$1')}`}</div>
      <div style="margin-top:8px">${barra(x.interes)} <span class="peq t2">${x.interes}</span></div></button>`).join('');
    h += '</div>';
  }

  if (riesgo.length) {
    h += `<h2 class="sec">Tus jugadores en riesgo<button class="mas" data-ir="equipo" data-seg="equipo:clausulas">Tus cláusulas</button></h2>`;
    h += riesgo.slice(0, 4).map((x) => filaJugador(x, { sub: `Cláusula ${eur(x.clausula)} · vale ${eur(x.j.valor)}`, extra: `${clausulaPill(x)}<span class="pill ${x.riesgo === 'alto' ? 'mal' : 'duda'}">Riesgo ${x.riesgo}</span>` })).join('');
  }

  h += `<div class="tarjeta"><div class="tarjeta-cab"><h3>${icono('ia', 'rojo')} Análisis del día</h3><button data-ir="analisis">${A ? 'Abrir' : 'Activar'}</button></div>`;
  if (A) h += `<div class="ia-titular" style="font-size:24px;margin:8px 0 6px">${esc(A.titular)}</div><div class="ia-meta">${rel(A.t)} · ${esc(NOMBRES[A.modelo] || A.modelo)}</div>`;
  else h += `<p class="t2" style="margin:6px 0 0">${hayClave() ? 'Pide el análisis de hoy: lee las noticias de tus jugadores y de los que te interesan y te dice qué hacer.' : 'Gemini, gratis con tu clave de Google: lee las noticias, mira el calendario y los parones y te dice a quién clausular, qué vender y cómo sacar beneficio.'}</p>`;
  h += '</div>';

  const act = M.actividad.slice(0, 5);
  if (act.length) h += `<h2 class="sec">Movimientos de la liga<button class="mas" data-ir="rivales" data-seg="rivales:movimientos">Todos</button></h2><div class="tabla-act">${act.map(filaActividad).join('')}</div>`;
  return h;
}

/* ================= EQUIPO ================= */
export function equipo(S) {
  const { M, H, D } = S;
  const seg = S.seg.equipo || 'plantilla';
  let h = `<h1 class="titulo">Tu equipo</h1><p class="entradilla">${M.mias.length} jugadores · ${eur(D.valorEquipo)}${M.yo ? ` · ${M.yo.pos}º` : ''}</p>
  <div class="seg">${[['plantilla', 'Plantilla'], ['clausulas', 'Cláusulas'], ['dinero', 'Beneficio']].map(([k, t]) => `<button data-seg="equipo:${k}" class="${seg === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
  if (!M.mias.length) return h + nada('No encuentro tu plantilla. Si tienes varias ligas o equipos, elige el tuyo en Ajustes.');

  if (seg === 'plantilla') {
    for (const p of [1, 2, 3, 4, 5]) {
      const xs = M.mias.filter((x) => x.j.pos === p);
      if (!xs.length) continue;
      h += `<div class="grupo"><span>${POS_PLURAL[p]}</span><span>${eur(xs.reduce((s, x) => s + x.j.valor, 0))}</span></div>`;
      h += xs.map((x) => filaJugador(x, {
        sub: `${esc(x.j.equipo)}${x.prox ? ` · ${partidoTxt(x.prox)}` : ''}`,
        extra: `${estadoPill(x.j)}${clausulaPill(x)}${x.j.media ? `<span class="pill">${String(x.j.media).replace('.', ',')} pts/p</span>` : ''}`,
        conMini: true,
      })).join('');
    }
  } else if (seg === 'clausulas') {
    const xs = [...M.mias].sort((a, b) => (a.abierta === b.abierta ? a.abreEn - b.abreEn : a.abierta ? -1 : 1));
    const abiertas = xs.filter((x) => x.abierta).length;
    h += `<p class="t2">${abiertas ? `<b>${abiertas}</b> de tus jugadores se pueden clausular ya.` : 'Todos tus jugadores están protegidos ahora mismo.'} Ordenados por cuándo se les acaba la protección. El riesgo sube cuanto más cerca está la cláusula de lo que vale el jugador y mejor es.</p>`;
    h += xs.map((x) => filaJugador(x, {
      sub: x.abierta ? `<span class="rojo">Abierta</span> · cláusula ${eur(x.clausula)}` : `Se abre ${cuando(x.protegidoHasta)} · ${eur(x.clausula)}`,
      extra: `<span class="pill ${x.riesgo === 'alto' ? 'mal' : x.riesgo === 'medio' ? 'duda' : ''}">Riesgo ${x.riesgo}</span>${x.ratio ? `<span class="pill">${pct((x.ratio - 1) * 100, 0)} sobre su valor</span>` : ''}`,
      derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d apag">${x.abierta ? 'abierta' : dura(x.abreEn)}</div>`,
    })).join('');
  } else {
    const con = M.mias.filter((x) => x.compra).sort((a, b) => b.ganado - a.ganado);
    const serie = (H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
    h += `<div class="rejilla"><div class="dato"><div class="et">Ganado sobre lo que pagaste</div><div class="v ${clase(M.ganadoTotal)}">${eur(M.ganadoTotal, { signo: true })}</div></div>
      <div class="dato"><div class="et">Jugadores con precio de compra</div><div class="v">${con.length}<small>de ${M.mias.length}</small></div></div></div>`;
    h += `<h2 class="sec">Valor del equipo</h2>${linea(serie, { alto: 150 })}`;
    h += `<h2 class="sec">Lo que has ganado con cada uno</h2>`;
    h += con.length ? con.map((x) => filaJugador(x, {
      sub: `Pagaste ${eur(x.compra)} · vale ${eur(x.j.valor)}`,
      derecha: `<div class="v ${clase(x.ganado)}">${eur(x.ganado, { signo: true })}</div><div class="d ${clase(x.ganado)}">${pct((x.j.valor / x.compra - 1) * 100)}</div>`,
    })).join('') : nada('Aún no sé lo que pagaste por tus jugadores: sale de los movimientos de la liga, que guardan unas semanas.');
    const sin = M.mias.filter((x) => !x.compra);
    if (sin.length && con.length) h += `<p class="peq apag">Sin precio de compra (vinieron de inicio o hace tiempo): ${esc(sin.map((x) => x.j.nombre).join(', '))}.</p>`;
  }
  return h;
}

/* ================= RIVALES ================= */
export function rivales(S) {
  const { M } = S;
  const seg = S.seg.rivales || 'clasif';
  let h = `<h1 class="titulo">Rivales</h1>
  <div class="seg">${[['clasif', 'Clasificación'], ['clausulas', 'Cláusulas'], ['movimientos', 'Movimientos']].map(([k, t]) => `<button data-seg="rivales:${k}" class="${seg === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;

  if (seg === 'clasif') {
    const filas = S.D.clasif.map((e) => {
      const r = M.rivales.find((x) => x.e.teamId === e.teamId);
      const yo = !r;
      return `<button class="fila ${yo ? 'yo-fila' : ''}" ${yo ? 'data-ir="equipo"' : `data-r="${esc(e.teamId)}"`}>
        <span class="posn ${yo ? 'yo' : ''}">${e.pos}</span>
        <div class="fila-c"><div class="fila-n">${esc(e.nombre)}</div>
          <div class="fila-s">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${eur(e.valor)}${r && r.dValor != null ? ` · <span class="${clase(r.dValor)}">${eur(r.dValor, { signo: true, dec: 1 })} 7d</span>` : ''}</div>
          ${r ? `<div class="fila-x">${r.nivel !== 'baja' ? `<span class="amenaza ${r.nivel}">Peligro ${PELIGRO[r.nivel]}</span>` : ''}${r.meLlegan ? `<span class="pill abierta">${r.meLlegan} clausulable${r.meLlegan > 1 ? 's' : ''}</span>` : ''}${r.movs ? `<span class="pill">${r.movs} mov. 7d</span>` : ''}</div>` : ''}
        </div>
        <div class="fila-d"><div class="v">${e.puntos}</div><div class="d apag">pts${e.puntosJornada ? ` · ${e.puntosJornada} últ.` : ''}</div></div></button>`;
    }).join('');
    h += filas;
  } else if (seg === 'clausulas') {
    const f = S.filtro.cl || 'llegan';
    const filtros = [['llegan', 'Te llegan'], ['abiertas', 'Abiertas ya'], ['hoy', 'Se abren hoy'], ['semana', 'Esta semana'], ['todas', 'Todas']];
    h += `<div class="filtros">${filtros.map(([k, t]) => `<button data-filtro="cl:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.clausulas;
    if (f === 'llegan') xs = xs.filter((x) => x.meLlega && (x.abierta || x.abreEn < 2 * DIA));
    if (f === 'abiertas') xs = xs.filter((x) => x.abierta);
    if (f === 'hoy') xs = xs.filter((x) => !x.abierta && x.abreEn < 24 * HORA).sort((a, b) => a.abreEn - b.abreEn);
    if (f === 'semana') xs = xs.filter((x) => !x.abierta && x.abreEn < 7 * DIA).sort((a, b) => a.abreEn - b.abreEn);
    h += `<p class="t2 peq">Puedes gastar hasta <b>${eur(M.pujaMax)}</b>. El número es lo que te interesa (rendimiento, si sube y lo que cuesta sobre su valor).</p>`;
    h += xs.length ? xs.slice(0, 80).map((x) => filaJugador(x, {
      sub: `${esc(x.rival.nombre)} · vale ${eur(x.j.valor)}`,
      extra: `${clausulaPill(x)}${estadoPill(x.j)}${x.meLlega ? '' : '<span class="pill">No te llega</span>'}`,
      derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${barra(x.interes)} <span class="t2">${x.interes}</span></div>`,
    })).join('') : nada('Ninguna con este filtro.');
  } else {
    const f = S.filtro.mov || 'todos';
    const filtros = [['todos', 'Todo'], ['clausula', 'Cláusulas'], ['compra', 'Fichajes'], ['venta', 'Ventas'], ['blindaje', 'Blindajes']];
    h += `<div class="filtros">${filtros.map(([k, t]) => `<button data-filtro="mov:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.actividad.filter((a) => a.clase !== 'premio');
    if (f !== 'todos') xs = xs.filter((a) => a.clase === f);
    const cambios = f === 'todos' || f === 'blindaje' ? M.cambios.filter((m) => m.tipo === 'blinda') : [];
    if (cambios.length) {
      h += `<div class="grupo"><span>Vistos en sus plantillas</span></div>` + cambios.slice(0, 8).map((m) => `<button class="fila" data-j="${esc(m.pid)}"><span class="ic-act blindaje">${icono('escudo')}</span><div class="fila-c"><div class="fila-s" style="white-space:normal;color:var(--texto)"><b>${esc((m.equipo || {}).nombre || 'Un rival')}</b> ha subido la cláusula de <b>${esc(m.j.nombre)}</b></div><div class="fila-s">${cuando(m.t)} · de ${eur(m.de)} a ${eur(m.a)}</div></div></button>`).join('');
      h += `<div class="grupo"><span>Actividad de la liga</span></div>`;
    }
    h += xs.length ? `<div class="tabla-act">${xs.slice(0, 120).map(filaActividad).join('')}</div>` : nada('Sin movimientos con este filtro.');
  }
  return h;
}

/* ================= MERCADO ================= */
export function mercado(S) {
  const { M } = S;
  const seg = S.seg.mercado || 'venta';
  let h = `<h1 class="titulo">Mercado</h1><p class="entradilla">${M.cierreMercado ? `Cambia ${cuando(M.cierreMercado)} (${dura(M.cierreMercado - Date.now())})` : 'El mercado de hoy'} · puedes gastar <b>${eur(M.pujaMax)}</b></p>
  <div class="seg">${[['venta', 'En venta'], ['suben', 'Suben'], ['bajan', 'Bajan'], ['libres', 'Libres']].map(([k, t]) => `<button data-seg="mercado:${k}" class="${seg === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
  const tagV = { chollo: '<span class="pill chollo">Chollo</span>', sube: '<span class="pill bien">Subiendo</span>', caro: '<span class="pill duda">Caro</span>', evitar: '<span class="pill mal">Evitar</span>', baja: '<span class="pill mal">Bajando</span>', normal: '' };
  const dueno = (pid) => { const t = M.dueno[pid]; if (!t) return 'Libre'; if (t === S.D.yo.teamId) return 'Tuyo'; return esc((M.equipo[t] || {}).nombre || 'Rival'); };

  if (seg === 'venta') {
    const liga = M.mercado.filter((m) => m.tipo === 'liga'), man = M.mercado.filter((m) => m.tipo === 'manager');
    const fila = (m) => filaJugador(m, {
      sub: `${esc(m.j.equipo)}${m.prox ? ` · ${partidoTxt(m.prox)}` : ''}`,
      extra: `${tagV[m.veredicto] || ''}${estadoPill(m.j)}${m.pujas ? `<span class="pill">${m.pujas} puja${m.pujas > 1 ? 's' : ''}</span>` : ''}${m.miPuja ? `<span class="pill abierta">Tu puja ${eur(m.miPuja)}</span>` : ''}${m.sobre > 0.01 ? `<span class="pill">${pct(m.sobre * 100, 0)} sobre valor</span>` : ''}`,
      derecha: `<div class="v">${eur(m.precio)}</div><div class="d">${delta(m.tend)}</div><div class="d">${barra(m.interes)}</div>`,
    });
    h += liga.length ? `<div class="grupo"><span>Del mercado de la liga</span><span>${liga.length}</span></div>${liga.map(fila).join('')}` : nada('El mercado de la liga está vacío ahora.');
    if (man.length) h += `<div class="grupo"><span>Los venden tus rivales</span><span>${man.length}</span></div>${man.map((m) => fila({ ...m, j: { ...m.j, equipo: `${m.vendedor || 'Rival'} · ${m.j.equipo}` } })).join('')}`;
  } else if (seg === 'suben' || seg === 'bajan') {
    const xs = seg === 'suben' ? M.suben : M.bajan;
    h += `<p class="t2 peq">Toda LaLiga, ${seg === 'suben' ? 'los que más suben' : 'los que más bajan'} hoy. ${seg === 'suben' ? 'Comprar antes de que suban es la forma de sacar beneficio.' : 'Si tienes alguno, piensa si venderlo antes de que pierda más.'}</p>`;
    h += xs.length ? xs.map((x) => filaJugador({ j: x.j, tend: x.t }, { sub: `${esc(x.j.equipo)} · <span class="${x.dueno === S.D.yo.teamId ? 'rojo' : ''}">${dueno(x.j.id)}</span>`, conMini: true })).join('') : nada('Aún no hay datos de subidas: futbolfantasy.com no ha contestado y la app necesita un par de días de histórico.');
  } else {
    h += `<p class="t2 peq">Jugadores que no son de nadie en tu liga, ordenados por lo que interesan. Pueden salir en el mercado cualquier día.</p>`;
    h += M.libresBuenos.map((x) => filaJugador({ j: x.j, tend: x.t }, { extra: `${estadoPill(x.j)}${x.j.media ? `<span class="pill">${String(x.j.media).replace('.', ',')} pts/p</span>` : ''}`, derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d">${barra(x.i.n)}</div>` })).join('') || nada('Sin datos.');
  }
  return h;
}

/* ================= ANÁLISIS (IA) ================= */
const ICO_TIPO = { clausular: 'diana', pujar: 'mercado', vender: 'euro', blindar: 'escudo', alinear: 'campo', esperar: 'reloj', vigilar: 'ojo' };
export function analisis(S) {
  const A = ultimoAnalisis();
  let h = `<h1 class="titulo">Análisis</h1><p class="entradilla">Gemini lee las noticias, mira el calendario y los parones y lo cruza con los números de tu liga.</p>`;
  if (!hayClave()) {
    return h + `<div class="tarjeta acento"><h3>Activa la IA, gratis</h3>
      <p class="t2">Va con una clave gratuita de Google AI Studio, sin tarjeta. Si ya tienes la de GrowFolio, vale la misma.</p>
      <div class="paso"><i>1</i><span>Abre <a href="#" data-abrir="https://aistudio.google.com/apikey">aistudio.google.com/apikey</a> y entra con tu cuenta de Google.</span></div>
      <div class="paso"><i>2</i><span>Pulsa <b>Create API key</b> y cópiala.</span></div>
      <div class="paso"><i>3</i><span>Pégala aquí:</span></div>
      <input class="campo-t" id="claveIA" placeholder="AIza..." autocomplete="off" spellcheck="false">
      <button class="btn ancho" style="margin-top:12px" data-accion="guardarClave">${icono('ok')}Guardar y probar</button></div>`;
  }
  h += `<button class="btn ancho ${A ? 'sec' : ''}" data-accion="analizar" ${S.analizando ? 'disabled' : ''}>${S.analizando ? `<span class="pensando"><i></i><i></i><i></i></span> Leyendo noticias y pensando…` : `${icono('ia')}${A ? 'Rehacer el análisis' : 'Hacer el análisis de hoy'}`}</button>`;
  if (S.errorIA) h += `<div class="error-c">${esc(S.errorIA)}</div>`;
  if (!A) return h + `<p class="t2" style="margin-top:16px">Tarda entre 20 segundos y un minuto: busca noticias de tus jugadores y de los que te interesan antes de contestar.</p>`;
  const mios = new Set(S.M.mias.map((x) => x.j.nombre.toLowerCase()));
  const buscar = (n) => { const k = String(n || '').toLowerCase(); return Object.values(S.D.maestro).find((j) => j.nombre.toLowerCase() === k) || Object.values(S.D.maestro).find((j) => k && j.nombre.toLowerCase().includes(k)); };
  h += `<div class="ia-titular">${esc(A.titular || '')}</div><div class="ia-texto">${esc(A.resumen || '')}</div>
    <div class="ia-meta" style="margin-top:10px">${icono('reloj')}${rel(A.t)} · ${esc(NOMBRES[A.modelo] || A.modelo || '')}${A.web ? ' · con búsqueda en Google' : ''}</div>`;
  if (Array.isArray(A.acciones) && A.acciones.length) {
    h += `<h2 class="sec">Qué hacer</h2>` + A.acciones.map((a) => {
      const j = buscar(a.jugador);
      return `<div class="ia-acc" ${j ? `data-j="${esc(j.id)}" role="button"` : ''}><span class="tipo ${esc(a.tipo)}">${icono(ICO_TIPO[a.tipo] || 'rayo')}</span>
        <div style="flex:1;min-width:0"><div class="cu" style="color:var(--rojo-l);font-weight:600;font-size:14px">${esc((a.tipo || '').toUpperCase())}${a.cuando ? ` · ${esc(a.cuando)}` : ''}</div>
        <div style="font-size:18px;font-weight:500;margin:2px 0">${esc(a.jugador || '')}${a.precio ? ` <span class="cond t2">${eur(a.precio)}</span>` : ''}</div>
        <div class="t2" style="font-size:15px">${esc(a.motivo || '')}</div>${a.confianza ? `<div class="conf ${esc(a.confianza)}" style="margin-top:5px">Confianza ${esc(a.confianza)}</div>` : ''}</div></div>`;
    }).join('');
  }
  if (A.alineacion && Array.isArray(A.alineacion.titulares) && A.alineacion.titulares.length) {
    const tit = A.alineacion.titulares.map(buscar).filter(Boolean);
    const form = A.alineacion.formacion || '4-3-3';
    const lineas = [1, 2, 3, 4].map((p) => tit.filter((j) => j.pos === p).map((j) => j.nombre));
    h += `<h2 class="sec">Alineación que pondría<span class="t2" style="font:500 16px Barlow">${esc(form)}</span></h2>${campo(form, lineas)}`;
    if (Array.isArray(A.alineacion.dudas) && A.alineacion.dudas.length) h += `<p class="t2 peq">Dudas: ${esc(A.alineacion.dudas.join(' · '))}</p>`;
  }
  if (Array.isArray(A.noticias) && A.noticias.length) {
    h += `<h2 class="sec">Noticias que te afectan</h2>` + A.noticias.map((n) => {
      const j = buscar(n.jugador);
      return `<div class="fila" ${j ? `data-j="${esc(j.id)}" role="button"` : ''}>${j ? ava(j) : `<span class="ic-act">${icono('info')}</span>`}<div class="fila-c"><div class="fila-n">${esc(n.jugador || '')}${j && mios.has(j.nombre.toLowerCase()) ? '<span class="pill abierta">Tuyo</span>' : ''}</div><div class="fila-s" style="white-space:normal">${esc(n.texto || '')}</div></div><div class="fila-d ${n.efecto === 'sube' ? 'sube' : n.efecto === 'baja' ? 'baja' : 'apag'}">${n.efecto === 'sube' ? '▲' : n.efecto === 'baja' ? '▼' : '•'}</div></div>`;
    }).join('');
  }
  if (A.paron) h += `<div class="tarjeta oro"><h3>${icono('bandera', 'oro')} El parón</h3><p class="t2" style="margin:4px 0 0">${esc(A.paron)}</p></div>`;
  if (Array.isArray(A.rivales) && A.rivales.length) {
    h += `<h2 class="sec">Tus rivales</h2>` + A.rivales.map((r) => `<div class="fila"><span class="ic-act">${icono('rivales')}</span><div class="fila-c"><div class="fila-n">${esc(r.manager || '')}</div><div class="fila-s" style="white-space:normal">${esc(r.texto || '')}</div></div></div>`).join('');
  }
  if (A.fuentes && A.fuentes.length) h += `<h2 class="sec">Fuentes</h2><div class="fuentes">${A.fuentes.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>`;
  h += `<button class="btn sec ancho" style="margin-top:24px" data-accion="chat">${icono('ia')}Preguntarle algo</button>`;
  return h;
}
