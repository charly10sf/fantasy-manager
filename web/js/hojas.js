/* Las ventanas que suben desde abajo: la ficha de un jugador, la de un rival, los ajustes, el chat y el diagnóstico. */
import { esc, eur, pct, dura, cuando, icono, clase, POS_LARGO, num, horaDe } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, filaJugador, nada } from './comunes.js';
import { linea, barra, barras } from './graficos.js';
import { filaActividad, PELIGRO } from './vistas.js';
import { conversacion, hayClave, clave, cfgIA, NOMBRES } from './ia.js';
import { cfgAvisos, programados } from './avisos.js';
import { nativo, enApp } from './puente.js';
import { registro } from './api.js';
import { quien, sesion } from './auth.js';
import { VERSION } from './version.js';
import { enDemo } from './datos.js';

/* ================= FICHA DE JUGADOR ================= */
export function fichaJugador(S, pid) {
  const { D, M } = S;
  const j = M.J(pid), t = M.tend(pid);
  const duenoT = M.dueno[pid];
  const mia = M.mias.find((x) => x.pid === pid);
  const suya = !mia && duenoT ? (M.clausulas.find((x) => x.pid === pid) || null) : null;
  const enMercado = M.mercado.find((m) => m.pid === pid);
  const prox = M.proximoPartido(j.equipoId);
  const inter = M.interes(j, suya ? suya.clausula : enMercado ? enMercado.precio : j.valor, t);
  // para uno tuyo no tiene sentido lo de «cuesta lo que vale» o «te faltan»: solo rendimiento y tendencia
  if (mia) inter.por = inter.por.filter((x) => !/cuesta|te faltan/.test(x));
  let h = `<div class="ficha-top">${ava(j)}<div style="min-width:0"><h2>${esc(j.nombre)}</h2>
    <div class="s">${posTag(j)}<span>${esc(POS_LARGO[j.pos] || '')} · ${esc(j.equipo || '')}</span>${estadoPill(j)}</div></div></div>`;
  h += `<div class="hero-num" style="font-size:52px">${eur(j.valor)}</div><div class="linea-dato">${delta(t, { largo: true })} hoy${t.d7 != null ? ` · <span class="${clase(t.d7)}">${eur(t.d7, { signo: true })} (${pct(t.p7)})</span> en 7 días` : ''}</div>`;
  h += `<div id="graf-j">${linea(t.serie, { alto: 150 })}</div>`;

  if (mia) {
    h += `<div class="aviso-ficha ${mia.riesgo === 'alto' ? '' : mia.riesgo === 'medio' ? 'oro' : 'verde'}">${icono('escudo')}<div><b>Es tuyo.</b> Cláusula ${eur(mia.clausula)}, ${mia.abierta ? '<b>abierta</b>: te lo pueden quitar ya' : `protegido hasta ${cuando(mia.protegidoHasta)} (${dura(mia.abreEn)})`}. ${mia.riesgo === 'ninguno' ? 'Sin riesgo' : `Riesgo ${mia.riesgo}`}.${mia.compra ? ` Lo pagaste a ${eur(mia.compra)}: <b class="${clase(mia.ganado)}">${eur(mia.ganado, { signo: true })}</b>.` : ''}</div></div>`;
  } else if (suya) {
    if (suya.abierta && suya.meLlega) h += `<div class="aviso-ficha verde">${icono('diana')}<div><b>Puedes clausularlo ya</b> a ${esc(suya.rival.nombre)} por ${eur(suya.clausula)}. Te quedarías con ${eur(suya.teQueda)}${suya.teQueda < 0 ? ' (en negativo: véndete algo antes de que empiece la jornada)' : ''}.</div></div>`;
    else if (suya.abierta) h += `<div class="aviso-ficha">${icono('candado')}<div>Su cláusula está abierta (${eur(suya.clausula)}, de ${esc(suya.rival.nombre)}), pero te faltan <b>${eur(suya.clausula - M.pujaMax)}</b>.</div></div>`;
    else h += `<div class="aviso-ficha oro">${icono('reloj')}<div>Es de <b>${esc(suya.rival.nombre)}</b>. Su cláusula (${eur(suya.clausula)}) se abre <b>${cuando(suya.protegidoHasta)}</b>, en ${dura(suya.abreEn)}.${suya.meLlega ? ' Te llega el dinero.' : ` Te faltan ${eur(suya.clausula - M.pujaMax)}.`}</div></div>`;
  } else if (enMercado) {
    h += `<div class="aviso-ficha verde">${icono('mercado')}<div><b>En el mercado</b> a ${eur(enMercado.precio)}${enMercado.vendedor ? ` (lo vende ${esc(enMercado.vendedor)})` : ''}. ${enMercado.cierra ? `Cierra ${cuando(enMercado.cierra)}.` : ''} ${enMercado.pujas ? `${enMercado.pujas} puja${enMercado.pujas > 1 ? 's' : ''}.` : 'Sin pujas.'}${enMercado.miPuja ? ` Tu puja: ${eur(enMercado.miPuja)}.` : ''}</div></div>`;
  } else {
    h += `<div class="aviso-ficha verde">${icono('info')}<div>No es de nadie en tu liga: puede salir en el mercado.</div></div>`;
  }

  const f = mia || suya;
  h += `<div class="rejilla" style="margin-top:16px">
    <div class="dato"><div class="et">Puntos</div><div class="v">${num(j.puntos)}<small>${j.media ? String(j.media).replace('.', ',') + ' de media' : ''}</small></div></div>
    <div class="dato"><div class="et">Cuánto te interesa</div><div class="v">${inter.n}<small>de 100</small></div></div>
    ${f ? `<div class="dato"><div class="et">Cláusula (sobre su valor)</div><div class="v">${eur(f.clausula)}<small>${f.ratio ? pct((f.ratio - 1) * 100, 0) : ''}</small></div></div>` : ''}
    <div class="dato"><div class="et">Próximo partido</div><div class="v" style="font-size:20px">${prox ? `${prox.casa ? 'vs' : 'en'} ${esc(prox.rival)}` : '–'}<small>${prox ? cuando(prox.fecha) : ''}</small></div></div>
  </div>`;
  if (inter.por.length) h += `<p class="t2 peq">${barra(inter.n)} ${esc(inter.por.join(' · '))}</p>`;
  h += `<div id="det-j">${S.det && S.det[pid] ? detalleHTML(S.det[pid]) : '<div class="graf-vacio">Cargando sus partidos…</div>'}</div>`;
  const acts = M.actividad.filter((a) => a.pid === pid).slice(0, 6);
  if (acts.length) h += `<h2 class="sec">Sus movimientos en tu liga</h2><div class="tabla-act">${acts.map(filaActividad).join('')}</div>`;
  h += `<button class="btn sec ancho" style="margin-top:20px" data-accion="preguntarJ" data-pid="${esc(pid)}">${icono('ia')}¿Qué hago con ${esc(j.nombre)}?</button>`;
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
  let h = `<h2 class="sec">Puntos por jornada</h2>${barras(st.slice(-10).map((s) => ({ et: 'J' + s.n, v: s.pts, yo: s === st[st.length - 1] })), { alto: 130 })}`;
  h += `<p class="t2 peq">Últimas ${ult.length}: <b>${String(Math.round(media5 * 10) / 10).replace('.', ',')}</b> pts de media · ha jugado ${jugados.length} de ${st.length} (${Math.round(tot('min'))} min)${tot('gol') ? ` · ${tot('gol')} gol${tot('gol') > 1 ? 'es' : ''}` : ''}${tot('asis') ? ` · ${tot('asis')} asist.` : ''}${tot('am') ? ` · ${tot('am')} amarilla${tot('am') > 1 ? 's' : ''}` : ''}${tot('roja') ? ` · ${tot('roja')} roja` : ''}</p>`;
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
  <p class="t2" style="margin:0 0 14px">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${e.pos}º con ${e.puntos} puntos</p>
  <div class="rejilla">
    <div class="dato"><div class="et">Valor</div><div class="v">${eur(e.valor)}<small class="${clase(r.dValor)}">${r.dValor != null ? eur(r.dValor, { signo: true, dec: 1 }) + ' 7d' : ''}</small></div></div>
    <div class="dato"><div class="et">Movimientos 7 días</div><div class="v">${r.movs}</div></div>
    <div class="dato"><div class="et">Gastado 7 días</div><div class="v">${eur(r.gastado)}<small>${r.ingresado ? `+${eur(r.ingresado, { dec: 1 })} ingresado` : ''}</small></div></div>
    <div class="dato"><div class="et">Cláusulas que ha hecho</div><div class="v">${r.clausulazos}<small>en 14 días${r.contraMi ? `, ${r.contraMi} a ti` : ''}</small></div></div>
  </div>`;
  if (serie.length > 1) h += `<h2 class="sec">Su valor</h2>${linea(serie, { alto: 130 })}`;
  const fichas = [...r.fichas].sort((a, b) => (a.abierta === b.abierta ? (a.abierta ? (b.interes || 0) - (a.interes || 0) : a.abreEn - b.abreEn) : a.abierta ? -1 : 1));
  h += `<h2 class="sec">Su plantilla<span class="t2" style="font:500 15px Barlow">${r.abiertas} abiertas</span></h2>`;
  h += fichas.length ? fichas.map((x) => filaJugador(x, {
    sub: `${esc(x.j.equipo)} · vale ${eur(x.j.valor)}`,
    extra: `${clausulaPill(x)}${estadoPill(x.j)}${x.meLlega && x.abierta ? '<span class="pill bien">Te llega</span>' : ''}`,
    derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${x.interes != null ? `${barra(x.interes)}` : ''}</div>`,
  })).join('') : nada('No se ha podido leer su plantilla.');
  const acts = M.actividad.filter((a) => a.quienT === tid || a.otroT === tid).slice(0, 15);
  if (r.cambios.length || acts.length) {
    h += `<h2 class="sec">Lo que hace</h2>`;
    h += r.cambios.filter((m) => m.tipo === 'blinda').slice(0, 5).map((m) => `<div class="fila"><span class="ic-act blindaje">${icono('escudo')}</span><div class="fila-c"><div class="fila-s" style="white-space:normal;color:var(--texto)">Subió la cláusula de <b>${esc(m.j.nombre)}</b> de ${eur(m.de)} a ${eur(m.a)}</div><div class="fila-s">${cuando(m.t)}</div></div></div>`).join('');
    h += `<div class="tabla-act">${acts.map(filaActividad).join('')}</div>`;
  }
  return h;
}

/* ================= AJUSTES ================= */
const interr = (on, accion, extra = '') => `<button class="interr ${on ? 'on' : ''}" data-accion="${accion}" ${extra} aria-pressed="${on}"></button>`;
export function ajustes(S) {
  const c = S.c, ca = cfgAvisos(), ci = cfgIA();
  const q = quien();
  const ses = sesion();
  const k = clave();
  const prog = programados();
  let h = `<div class="hoja-cab"><h2>Ajustes</h2><button class="b-ico" data-accion="cerrarHoja">${icono('cerrar')}</button></div>`;

  h += `<div class="grupo"><span>Tu cuenta de LaLiga</span></div>`;
  if (enDemo()) h += `<div class="ajuste"><div class="c"><b>Liga de ejemplo</b><span>Los datos son inventados</span></div>${enApp ? '<button class="btn chico" data-accion="salirDemo">Usar la mía</button>' : ''}</div>`;
  else h += `<div class="ajuste"><div class="c"><b>${esc((q && (q.nombre || q.correo)) || 'Conectado')}</b><span>${esc(q && q.correo ? q.correo : '')}${ses && ses.desde ? ` · desde ${cuando(ses.desde, { hora: false })}` : ''}</span></div><button class="btn chico sec" data-accion="salir">${icono('salir')}Salir</button></div>`;
  if (S.D && S.D.ligas && S.D.ligas.length > 1) h += `<div class="ajuste"><div class="c"><b>Liga</b></div><select data-cambia="liga">${S.D.ligas.map((l) => `<option value="${esc(l.id)}" ${S.D.liga.id === l.id ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}</select></div>`;
  if (S.D && S.D.clasif) h += `<div class="ajuste"><div class="c"><b>Tu equipo</b><span>Lo busco solo; cámbialo si me equivoco</span></div><select data-cambia="miEquipo"><option value="">Automático</option>${S.D.clasif.map((e) => `<option value="${esc(e.teamId)}" ${String(c.miEquipo) === e.teamId ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></div>`;
  h += `<div class="ajuste"><div class="c"><b>Deuda permitida en tu liga</b><span>Cuánto puedes quedarte en negativo, en % del valor de tu equipo</span></div><select data-cambia="deuda">${[0, 5, 10, 15, 20, 25, 30, 40, 50].map((n) => `<option value="${n}" ${+c.deuda === n ? 'selected' : ''}>${n} %</option>`).join('')}</select></div>`;

  h += `<div class="grupo"><span>IA (Gemini, gratis)</span></div>`;
  h += `<div class="ajuste"><div class="c"><b>Clave de Google AI Studio</b><span>${k ? `${esc(k.slice(0, 6))}…${esc(k.slice(-4))}` : 'Sin clave: la IA está apagada'}</span></div>${k ? '<button class="btn chico sec" data-accion="borrarClave">Quitar</button>' : '<button class="btn chico" data-ir="analisis" data-accion="cerrarHoja">Poner</button>'}</div>`;
  if (k) {
    const modelos = [...new Set(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', ...(JSON.parse(localStorage.getItem('fm-ia-modelos') || '[]'))])];
    h += `<div class="ajuste"><div class="c"><b>Modelo</b><span>Si gasta su cupo del día, salta solo al siguiente</span></div><select data-cambia="modelo">${modelos.map((m) => `<option value="${esc(m)}" ${ci.modelo === m ? 'selected' : ''}>${esc(NOMBRES[m] || m)}</option>`).join('')}</select></div>`;
    h += `<div class="ajuste"><div class="c"><b>Buscar noticias en Google</b><span>Lesiones, convocatorias, alineaciones probables</span></div>${interr(ci.web, 'iaWeb')}</div>`;
  }

  h += `<div class="grupo"><span>Avisos en el móvil</span></div>`;
  h += `<div class="ajuste"><div class="c"><b>Avisos</b><span>${ca.on ? (nativo.avisosPermitidos() || !enApp ? `${prog.length} programados` : 'Falta el permiso de notificaciones') : 'Apagados'}</span></div>${interr(ca.on, 'avisos')}</div>`;
  if (ca.on) {
    if (enApp && !nativo.alarmasExactas()) h += `<div class="ajuste"><div class="c"><b>Al minuto exacto</b><span>Sin este permiso pueden llegar unos minutos tarde: para las cláusulas importa</span></div><button class="btn chico" data-accion="exactas">Dar permiso</button></div>`;
    h += [['rivales', 'Cláusulas de rivales que se abren', 'Las que te interesan y te llegan'], ['mias', 'Protección de los tuyos', '2 horas antes de que se acabe'], ['mercado', 'El mercado cambia', '1 hora antes'], ['jornada', 'Empieza la jornada', '3 horas antes: alineación y saldo'], ['diario', 'Resumen diario', 'Para abrir la app y ponerla al día']]
      .map(([kk, t, s]) => `<div class="ajuste"><div class="c"><b>${t}</b><span>${s}</span></div>${kk === 'diario' && ca.diario ? `<input type="time" value="${esc(ca.hora)}" data-cambia="horaAviso" style="margin-right:6px">` : ''}${interr(ca[kk], 'avisoTipo', `data-k="${kk}"`)}</div>`).join('');
    h += `<div class="ajuste"><div class="c"><b>Interés mínimo</b><span>Solo avisar de cláusulas que te interesen al menos esto</span></div><select data-cambia="interes">${[30, 40, 50, 55, 60, 70, 80].map((n) => `<option value="${n}" ${+ca.interes === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    const prox = prog.filter((a) => a.id !== 'diario').slice(0, 6);
    if (prox.length) h += `<p class="t2 peq" style="margin:10px 0 0">Próximos: ${prox.map((a) => `${esc(a.titulo)} (${cuando(a.t)})`).join(' · ')}</p>`;
    h += `<button class="btn chico sec" style="margin-top:10px" data-accion="probarAviso">Probar un aviso</button>`;
  }

  h += `<div class="grupo"><span>App</span></div>`;
  h += `<div class="ajuste"><div class="c"><b>Versión ${VERSION}</b><span>${enApp ? `Compilación ${nativo.version()}` : 'En el navegador (demostración)'}</span></div>${enApp ? '<button class="btn chico sec" data-accion="buscarVersion">Buscar nueva</button>' : ''}</div>`;
  h += `<div class="ajuste"><div class="c"><b>Diagnóstico</b><span>Lo que ha contestado LaLiga, para mandármelo si algo falla</span></div><button class="btn chico sec" data-accion="diag">Ver</button></div>`;
  if (enApp && !enDemo()) h += `<div class="ajuste"><div class="c"><b>Ver la liga de ejemplo</b><span>Sin tocar tus datos</span></div><button class="btn chico sec" data-accion="entrarDemo">Ver</button></div>`;
  h += `<div class="ajuste"><div class="c"><b>Borrar los datos guardados</b><span>El histórico de valores y el análisis (tu sesión no)</span></div><button class="btn chico sec" data-accion="borrarDatos">Borrar</button></div>`;
  h += `<p class="peq apag" style="margin-top:18px">App no oficial: usa la API de LaLiga Fantasy (la de su app, no es pública) y la página de mercado de futbolfantasy.com. Tu sesión y tu clave se quedan en este móvil.</p>`;
  return h;
}

/* ================= CHAT ================= */
export function md(t) {
  const lineas = esc(t || '').split('\n');
  let h = '', lista = false;
  for (let l of lineas) {
    l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
    const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (m) { if (!lista) { h += '<ul>'; lista = true; } h += `<li>${m[1]}</li>`; continue; }
    if (lista) { h += '</ul>'; lista = false; }
    if (/^#{1,4}\s/.test(l)) { h += `<p><b>${l.replace(/^#+\s/, '')}</b></p>`; continue; }
    if (l.trim()) h += `<p>${l}</p>`;
  }
  if (lista) h += '</ul>';
  return h;
}
export function chat(S) {
  const msgs = conversacion();
  let h = `<div class="hoja-cab" style="flex:none"><h2>${icono('ia', 'rojo')} Pregúntale</h2>${msgs.length ? '<button class="btn chico sec" data-accion="borrarChat">Nueva</button>' : ''}<button class="b-ico" data-accion="cerrarHoja">${icono('cerrar')}</button></div>`;
  h += `<div class="chat" id="chat">`;
  if (!hayClave()) h += `<p class="t2">Para preguntarle necesitas la clave gratuita de Gemini. Ve a la pestaña Análisis y sigue los 3 pasos.</p>`;
  else if (!msgs.length) {
    h += `<p class="t2">Sabe todo lo de tu liga ahora mismo (plantillas, cláusulas, mercado, movimientos, calendario) y busca noticias en Google.</p><div class="sugerencias">${['¿A quién clausulo hoy?', '¿Qué vendo antes del parón?', '¿Qué once pongo esta jornada?', '¿Qué rival me puede quitar jugadores?', '¿Cómo saco más beneficio del mercado?'].map((s) => `<button data-sugerencia="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  }
  h += msgs.map((m) => (m.r === 'yo' ? `<div class="msg yo">${esc(m.t)}</div>` : `<div class="msg ia">${md(m.t)}${m.fuentes && m.fuentes.length ? `<div class="fuentes">${m.fuentes.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>` : ''}</div>`)).join('');
  if (S.charlando) h += `<div class="msg ia" id="respuesta">${S.parcial ? md(S.parcial) : '<span class="pensando"><i></i><i></i><i></i></span>'}</div>`;
  h += `</div><div class="escribe"><textarea id="pregunta" rows="1" placeholder="Pregunta lo que quieras de tu liga" ${hayClave() ? '' : 'disabled'}></textarea><button data-accion="enviar" aria-label="Enviar">${icono('enviar')}</button></div>`;
  return h;
}

/* ================= DIAGNÓSTICO ================= */
export function textoDiagnostico(S) {
  const s = sesion();
  const L = [
    `Fantasy Manager ${VERSION} · compilación ${nativo.version()} · ${enApp ? 'app' : 'navegador'}${enDemo() ? ' · DEMO' : ''}`,
    `Sesión: ${s ? `caduca ${new Date(s.caduca).toISOString()} · renovar ${s.renovar ? 'sí' : 'no'}` : 'no'}`,
    S.D ? `Datos: ${new Date(S.D.t).toISOString()} · liga ${S.D.liga && S.D.liga.id} · equipos ${S.D.clasif.length} · mío ${S.D.yo.teamId || '¿?'} · jugadores ${Object.keys(S.D.maestro).length} · mercado ${S.D.mercado.length} · actividad ${S.D.actividad.length} · partidos ${S.D.partidos.length} · tendencias ${Object.keys(S.D.tendencias || {}).length} · dinero ${S.D.dinero}` : 'Sin datos',
    S.D && S.D.avisos && S.D.avisos.length ? `Fallos: ${S.D.avisos.map((a) => `${a.paso}: ${a.e}`).join(' | ')}` : 'Sin fallos',
    '',
    ...registro.slice(0, 60).map((r) => `${horaDe(r.t)} ${r.s} ${r.ms}ms ${r.ruta}${r.e ? ' ✗ ' + r.e : ''}${r.forma ? ' → ' + r.forma : ''}${r.nota ? ' (' + r.nota + ')' : ''}`),
  ];
  return L.join('\n');
}
export function diagnostico(S) {
  return `<div class="hoja-cab"><h2>Diagnóstico</h2><button class="b-ico" data-accion="cerrarHoja">${icono('cerrar')}</button></div>
  <p class="t2 peq">Lo que ha contestado LaLiga en esta sesión (sin tus datos personales). Si algo no funciona, cópialo y pásamelo.</p>
  <pre class="diag">${esc(textoDiagnostico(S))}</pre>
  <div style="display:flex;gap:10px;margin-top:12px"><button class="btn chico" data-accion="copiarDiag">${icono('copiar')}Copiar</button><button class="btn chico sec" data-accion="compartirDiag">Compartir</button></div>`;
}

