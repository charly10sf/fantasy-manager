/* Fantasy Manager: arranque, navegación, carga de datos y todo lo que pasa al tocar algo. */
import { esc, icono, LOGO, $, $$, LS, eur, rel, dura, cuando, MIN } from './util.js';
import { enApp, nativo } from './puente.js';
import { haySesion, empezarLogin, terminarLogin, cerrarSesion } from './auth.js';
import { actualizar, foto, historico, cfg, guardarCfg, enDemo, pasosCarga, borrarTodo } from './datos.js';
import { analizar } from './motor.js';
import * as V from './vistas.js';
import * as Hj from './hojas.js';
import { programar, cfgAvisos, guardarCfgAvisos } from './avisos.js';
import { analisisDelDia, charlar, guardarClave, probarClave, guardarCfgIA, cfgIA, borrarConversacion } from './ia.js';
import { ultimaVersion, api } from './api.js';
import { detalleJugador } from './normalizar.js';
import { linea } from './graficos.js';
import { VERSION, NOVEDADES } from './version.js';

const S = { det: {}, D: null, H: null, M: null, c: cfg(), vista: 'inicio', seg: {}, filtro: {}, cargando: false, analizando: false, errorIA: null, hoja: null, charlando: false, parcial: '', nueva: null };
window.S = S;
const VISTAS = { inicio: V.inicio, equipo: V.equipo, rivales: V.rivales, mercado: V.mercado, analisis: V.analisis };
const NAV = [['inicio', 'inicio', 'Inicio'], ['equipo', 'equipo', 'Equipo'], ['rivales', 'rivales', 'Rivales'], ['mercado', 'mercado', 'Mercado'], ['analisis', 'ia', 'Análisis']];
const raiz = () => document.getElementById('app');

/* ---------------- avisos de abajo ---------------- */
let relojT;
export function tostada(t, ms = 3200) {
  let el = $('.tostada');
  if (!el) { el = document.createElement('div'); el.className = 'tostada'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('on');
  clearTimeout(relojT); relojT = setTimeout(() => el.classList.remove('on'), ms);
}

/* ---------------- pantallas completas ---------------- */
function pantallaEntrar(error = '') {
  raiz().innerHTML = `<div class="pantalla">${LOGO}
    <h1>Fantasy <span>Manager</span></h1>
    <p>Tu liga de LaLiga Fantasy con lupa: cláusulas, mercado, rivales y lo que toca hacer cada día.</p>
    <ul class="lista-ok">
      <li>${icono('diana')}A quién clausular y cuándo se abre cada cláusula, con aviso al momento</li>
      <li>${icono('escudo')}Cuándo caducan las tuyas y quién te las puede quitar</li>
      <li>${icono('sube')}Quién sube y quién baja, para sacar beneficio</li>
      <li>${icono('ia')}Análisis diario con IA que lee las noticias, el calendario y los parones</li>
    </ul>
    ${error ? `<div class="error-c" style="margin:0 0 16px">${esc(error)}</div>` : ''}
    <button class="btn ancho" data-accion="entrar">${icono('usuario')}Entrar con mi cuenta de LaLiga</button>
    <p class="peq apag" style="margin-top:12px">Se abre la página oficial de LaLiga en Chrome: entra como siempre (con Google, si es como lo haces). Si Android pregunta con qué app volver, elige <b>Fantasy Manager</b>.</p>
    <button class="btn sec ancho" data-accion="entrarDemo" style="margin-top:6px">Ver con una liga de ejemplo</button>
  </div>`;
}

function pantallaCarga(paso = -1, error = '') {
  raiz().innerHTML = `<div class="pantalla cargando">${LOGO}<h1 style="font-size:40px">Poniendo al día<br>tu liga</h1>
    <div class="pasos-c">${pasosCarga.map((p, i) => `<div class="${i < paso ? 'hecho' : i === paso ? 'ahora' : ''}">${icono(i < paso ? 'ok' : i === paso ? 'refrescar' : 'reloj')}${esc(p)}</div>`).join('')}</div>
    ${error ? `<div class="error-c">${esc(error)}</div><div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-accion="recargar">Volver a probar</button><button class="btn sec" data-accion="diag">Diagnóstico</button><button class="btn sec" data-accion="entrarDemo">Ver ejemplo</button></div>` : ''}
  </div>`;
}

/* ---------------- la app ---------------- */
function marco() {
  if ($('#vista')) return;
  raiz().innerHTML = `<header class="sup">${LOGO}<div class="sup-liga"><b id="supLiga"></b><span id="supEstado"></span></div>
    <button class="b-ico b-ia" data-accion="chat" aria-label="Pregúntale a la IA">${icono('ia')}</button>
    <button class="b-ico" id="bRefrescar" data-accion="recargar" aria-label="Actualizar">${icono('refrescar')}</button>
    <button class="b-ico" data-accion="ajustes" aria-label="Ajustes">${icono('ajustes')}</button></header>
    <div class="cinta" id="cinta"></div>
    <main><div id="banda"></div><div id="vista" class="vista"></div></main>
    <nav class="nav"><div class="nav-in">${NAV.map(([k, ic, t]) => `<button data-ir="${k}"><span class="ico">${icono(ic)}</span>${t}<span class="gl oculto" id="gl-${k}"></span></button>`).join('')}</div></nav>`;
}

function pintarSup() {
  const { D } = S;
  $('#supLiga').textContent = D ? D.liga.nombre : 'Fantasy Manager';
  const edad = D ? Date.now() - D.t : Infinity;
  const p = S.cargando ? 'vivo' : edad < 30 * MIN ? 'vivo' : edad < 6 * 3600e3 ? 'viejo' : 'mal';
  $('#supEstado').innerHTML = `<i class="punto ${p}"></i>${S.cargando ? 'Actualizando…' : D ? (edad < MIN ? 'Ahora mismo' : rel(D.t).replace(/^hace/, 'Hace')) : ''}`;
  $('#bRefrescar').classList.toggle('gira', S.cargando);
  const cinta = $('#cinta');
  const items = [...S.M.suben.slice(0, 8), ...S.M.bajan.slice(0, 6)].filter((x) => x.t.d1);
  if (items.length) {
    const html = items.map((x) => `<span>${esc(x.j.nombre)}<b class="${x.t.d1 > 0 ? 'sube' : 'baja'}">${x.t.d1 > 0 ? '▲' : '▼'} ${eur(Math.abs(x.t.d1), { dec: 1 })}</b></span>`).join('');
    cinta.innerHTML = `<div class="cinta-in">${html}${html}</div>`;
    cinta.classList.remove('oculto');
  } else cinta.classList.add('oculto');
  const gl = S.M.clausulas.filter((x) => x.abierta && x.meLlega && x.interes >= 50).length;
  const el = $('#gl-rivales'); el.textContent = gl; el.classList.toggle('oculto', !gl);
  const ga = S.M.mias.filter((x) => x.riesgo === 'alto').length;
  const e2 = $('#gl-equipo'); e2.textContent = ga; e2.classList.toggle('oculto', !ga);
}

function pintar({ arriba = false } = {}) {
  if (!S.D) return;
  marco();
  pintarSup();
  $$('.nav button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === S.vista));
  const v = $('#vista');
  try { v.innerHTML = VISTAS[S.vista](S); } catch (e) { v.innerHTML = `<div class="error-c">Algo ha fallado al pintar esta pantalla: ${esc(e.message)}</div>`; console.error(e); }
  $('#banda').innerHTML = S.nueva ? `<div class="banda">${icono('descargar')}<span>Hay una versión nueva (${esc(S.nueva.nombre)})</span><button data-accion="actualizarApp">Actualizar</button></div>` : '';
  if (arriba) window.scrollTo(0, 0);
}

function ir(vista, { arriba = true } = {}) {
  if (!VISTAS[vista]) vista = 'inicio';
  if (S.vista !== vista) nativo.toque();
  S.vista = vista;
  if (location.hash !== '#' + vista) history.replaceState(null, '', '#' + vista);
  pintar({ arriba });
}

/* ---------------- datos ---------------- */
function rehacer() {
  S.c = cfg();
  S.H = historico();
  S.M = analizar(S.D, S.H, S.c);
  programar(S.D, S.M);
}

async function cargar({ silencio = false } = {}) {
  if (S.cargando) return;
  S.cargando = true;
  const conPantalla = !S.D;
  if (conPantalla) pantallaCarga(0); else if ($('#vista')) pintarSup();
  try {
    S.D = await actualizar((i) => { if (conPantalla) pantallaCarga(i); });
    rehacer();
    S.cargando = false;
    pintar();
    if (!silencio && !conPantalla) tostada('Liga al día');
  } catch (e) {
    S.cargando = false;
    console.error(e);
    if (e.sesion) { S.D = null; pantallaEntrar(e.message); return; }
    if (conPantalla) pantallaCarga(-1, e.message || String(e));
    else { pintar(); tostada(`No se ha podido actualizar: ${e.message}`, 5000); }
  }
}

/* ---------------- ventanas de abajo ---------------- */
function abrirHoja(html, { llena = false } = {}) {
  cerrarHoja(true);
  const velo = document.createElement('div'); velo.className = 'velo'; velo.dataset.accion = 'cerrarHoja';
  const hoja = document.createElement('div'); hoja.className = `hoja ${llena ? 'llena' : ''}`;
  hoja.innerHTML = `<div class="asa"></div>${html}`;
  document.body.append(velo, hoja);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { velo.classList.add('on'); hoja.classList.add('on'); });
  S.hoja = hoja;
  // deslizar hacia abajo desde arriba del todo para cerrar
  let y0 = null;
  hoja.addEventListener('touchstart', (e) => { y0 = hoja.scrollTop <= 0 && !e.target.closest('.chat') ? e.touches[0].clientY : null; }, { passive: true });
  hoja.addEventListener('touchmove', (e) => { if (y0 == null) return; const d = e.touches[0].clientY - y0; if (d > 0) hoja.style.transform = `translateY(${d}px)`; }, { passive: true });
  hoja.addEventListener('touchend', (e) => { if (y0 == null) return; const d = e.changedTouches[0].clientY - y0; hoja.style.transform = ''; if (d > 110) cerrarHoja(); y0 = null; });
  return hoja;
}
function cerrarHoja(ya = false) {
  const h = $('.hoja'), v = $('.velo');
  if (!h) return false;
  S.hoja = null; S.tipoHoja = null;
  document.body.style.overflow = '';
  if (ya) { h.remove(); v && v.remove(); return true; }
  h.classList.remove('on'); v && v.classList.remove('on');
  setTimeout(() => { h.remove(); v && v.remove(); }, 260);
  return true;
}
function repintarHoja() {
  if (!S.hoja || !S.tipoHoja) return;
  const [tipo, arg] = S.tipoHoja;
  const sc = S.hoja.scrollTop;
  const html = tipo === 'ajustes' ? Hj.ajustes(S) : tipo === 'chat' ? Hj.chat(S) : tipo === 'j' ? Hj.fichaJugador(S, arg) : tipo === 'r' ? Hj.fichaRival(S, arg) : Hj.diagnostico(S);
  S.hoja.innerHTML = `<div class="asa"></div>${html}`;
  S.hoja.scrollTop = sc;
  if (tipo === 'chat') bajarChat();
}
function hoja(tipo, arg) {
  const html = tipo === 'ajustes' ? Hj.ajustes(S) : tipo === 'chat' ? Hj.chat(S) : tipo === 'j' ? Hj.fichaJugador(S, arg) : tipo === 'r' ? Hj.fichaRival(S, arg) : Hj.diagnostico(S);
  abrirHoja(html, { llena: tipo === 'chat' });
  S.tipoHoja = [tipo, arg];
  if (tipo === 'chat') { bajarChat(); }
}
const bajarChat = () => { const c = $('#chat'); if (c) c.scrollTop = c.scrollHeight; };

window.atras = () => {
  if (cerrarHoja()) return true;
  if (S.D && S.vista !== 'inicio') { ir('inicio'); return true; }
  return false;
};
window.alVolver = () => {
  if (S.D && !S.cargando && Date.now() - S.D.t > 15 * MIN && (enDemo() || haySesion())) cargar({ silencio: true });
};

/* ---------------- la ficha completa de un jugador (puntos por jornada) ---------------- */
async function cargarDetalle(pid) {
  if (S.det[pid] && Date.now() - S.det[pid].t < 30 * MIN) { pintarDetalle(pid); return; }
  let det;
  if (enDemo()) {
    const j = S.M.J(pid);
    let x = +pid || 7;
    const azar = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    det = { stats: Array.from({ length: 9 }, (_, i) => { const min = azar() < 0.15 ? 0 : Math.round(45 + azar() * 45); return { n: i + 1, pts: min ? Math.round(j.media * (0.3 + azar() * 1.4)) : 0, min, gol: j.pos === 4 && azar() < 0.4 ? 1 : 0, asis: azar() < 0.15 ? 1 : 0, am: azar() < 0.12 ? 1 : 0, roja: 0 }; }), valores: null };
  } else {
    try { det = detalleJugador(await api.jugador(pid, S.D.liga.id)); } catch (e) { det = { error: e.message }; }
  }
  S.det[pid] = { ...det, t: Date.now() };
  pintarDetalle(pid);
}
function pintarDetalle(pid) {
  if (!S.tipoHoja || S.tipoHoja[0] !== 'j' || S.tipoHoja[1] !== pid) return;
  const el = $('#det-j'); if (el) el.innerHTML = Hj.detalleHTML(S.det[pid]);
  const v = S.det[pid] && S.det[pid].valores;
  const g = $('#graf-j');
  if (v && g && v.length > (S.M.tend(pid).serie || []).length) g.innerHTML = linea(v, { alto: 150 });
}

/* ---------------- la IA ---------------- */
async function analizarIA() {
  if (S.analizando) return;
  S.analizando = true; S.errorIA = null; pintar();
  try {
    await analisisDelDia(S.D, S.M, S.c);
    tostada('Análisis listo');
  } catch (e) { S.errorIA = e.message || String(e); }
  S.analizando = false;
  if (S.vista === 'analisis' || S.vista === 'inicio') pintar();
}

async function enviarPregunta(texto) {
  const t = (texto || '').trim();
  if (!t || S.charlando) return;
  S.charlando = true; S.parcial = '';
  repintarHoja();
  let ultimo = 0;
  try {
    await charlar(t, S.D, S.M, S.c, (parcial) => {
      S.parcial = parcial;
      const ahora = Date.now();
      if (ahora - ultimo > 120) { ultimo = ahora; const r = $('#respuesta'); if (r) { r.innerHTML = Hj.md(parcial); bajarChat(); } }
    });
  } catch (e) {
    tostada(e.message || 'No ha contestado', 5000);
  }
  S.charlando = false; S.parcial = '';
  repintarHoja();
}

/* ---------------- versión nueva ---------------- */
async function buscarVersion(avisar = false) {
  if (!enApp) return;
  const v = await ultimaVersion();
  if (v && v.version > nativo.version()) { S.nueva = v; pintar(); if (avisar) tostada(`Hay una versión nueva: ${v.nombre}`); }
  else if (avisar) tostada('Tienes la última versión');
}
window.progresoApp = (pct, estado) => {
  if (pct < 0) tostada(`No se ha podido bajar: ${estado}`, 5000);
  else if (estado === 'permiso') tostada('Dale permiso para instalar y vuelve a pulsar Actualizar', 6000);
  else if (estado === 'instalar') tostada('Instalando…');
  else tostada(`Bajando la versión nueva… ${pct} %`, 1500);
};
window.permisoAvisos = (ok) => {
  if (!ok) { tostada('Sin permiso de notificaciones no te pueden llegar los avisos', 5000); }
  else { if (S.D) programar(S.D, S.M); tostada('Avisos activados'); }
  repintarHoja();
};

/* ---------------- el inicio de sesión vuelve de Chrome ---------------- */
window.vueltaLogin = async () => {
  const url = nativo.loginPendiente();
  if (!url) return;
  raiz().innerHTML = `<div class="pantalla cargando">${LOGO}<h1 style="font-size:40px">Entrando…</h1></div>`;
  try {
    await terminarLogin(url);
    LS.del('demo');
    S.D = null;
    await cargar();
  } catch (e) {
    pantallaEntrar(e.message || String(e));
  }
};

/* ---------------- toques ---------------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion],[data-ir],[data-j],[data-r],[data-seg],[data-filtro],[data-abrir],[data-sugerencia]');
  if (!el) return;
  const d = el.dataset;
  if (d.abrir) { ev.preventDefault(); nativo.abrir(d.abrir); return; }
  if (d.sugerencia) { enviarPregunta(d.sugerencia); return; }
  if (d.seg) { const [v, s] = d.seg.split(':'); S.seg[v] = s; if (!d.ir) { pintar(); return; } }
  if (d.filtro) { const [k, f] = d.filtro.split(':'); S.filtro[k] = f; pintar(); return; }
  if (d.j && S.D) { hoja('j', d.j); cargarDetalle(d.j); return; }
  if (d.r && S.D) { hoja('r', d.r); return; }
  if (d.ir && !d.accion) { cerrarHoja(); ir(d.ir); return; }
  const a = d.accion;
  switch (a) {
    case 'entrar': try { await empezarLogin(); } catch (e) { pantallaEntrar(e.message); } break;
    case 'entrarDemo': cerrarHoja(true); LS.set('demo', true); S.D = null; cargar(); break;
    case 'salirDemo': cerrarHoja(true); LS.del('demo'); S.D = null; if (!enApp) { LS.set('demo', true); tostada('Fuera de la app solo se puede ver el ejemplo'); cargar(); } else if (haySesion()) { S.D = foto(); if (S.D) { rehacer(); pintar(); cargar({ silencio: true }); } else cargar(); } else pantallaEntrar(); break;
    case 'salir': if (confirm('¿Cerrar la sesión de LaLiga en esta app?')) { cerrarSesion(); cerrarHoja(true); S.D = null; programar(null, null); pantallaEntrar(); } break;
    case 'recargar': cargar(); break;
    case 'ajustes': hoja('ajustes'); break;
    case 'chat': hoja('chat'); break;
    case 'diag': hoja('diag'); break;
    case 'cerrarHoja': cerrarHoja(); if (d.ir) ir(d.ir); break;
    case 'copiarDiag': nativo.copiar(Hj.textoDiagnostico(S)); tostada('Copiado'); break;
    case 'compartirDiag': nativo.compartir(Hj.textoDiagnostico(S)); break;
    case 'analizar': analizarIA(); break;
    case 'guardarClave': {
      const k = ($('#claveIA') || {}).value || '';
      if (!k.trim()) { tostada('Pega la clave primero'); break; }
      el.disabled = true; el.textContent = 'Probando…';
      try { await probarClave(k); guardarClave(k); tostada('Clave guardada: la IA está lista'); pintar(); analizarIA(); }
      catch (e) { tostada(e.message, 6000); el.disabled = false; el.textContent = 'Guardar y probar'; }
      break;
    }
    case 'borrarClave': if (confirm('¿Quitar la clave de Gemini?')) { guardarClave(''); repintarHoja(); pintar(); } break;
    case 'iaWeb': guardarCfgIA({ web: !cfgIA().web }); LS.del('ia-sin-web'); repintarHoja(); break;
    case 'avisos': {
      const on = !cfgAvisos().on;
      guardarCfgAvisos({ on });
      if (on && enApp && !nativo.avisosPermitidos()) nativo.pedirPermisoAvisos();
      if (S.D) programar(S.D, S.M);
      repintarHoja();
      break;
    }
    case 'avisoTipo': guardarCfgAvisos({ [d.k]: !cfgAvisos()[d.k] }); if (S.D) programar(S.D, S.M); repintarHoja(); break;
    case 'exactas': nativo.pedirAlarmasExactas(); break;
    case 'probarAviso': if (enApp) { nativo.notificar('Así te llegarán los avisos', 'Por ejemplo: «Ya puedes clausular a Pedri: 74,2 M a Patatas Bravas FC».', 'rivales'); tostada('Mira las notificaciones'); } else tostada('Los avisos solo funcionan en la app'); break;
    case 'buscarVersion': buscarVersion(true); break;
    case 'actualizarApp': if (S.nueva) { nativo.actualizar(S.nueva.apk); tostada('Bajando la versión nueva…'); } break;
    case 'borrarDatos': if (confirm('¿Borrar el histórico de valores y el análisis guardado? Se vuelve a llenar solo.')) { borrarTodo(); cerrarHoja(true); S.D = null; cargar(); } break;
    case 'borrarChat': borrarConversacion(); repintarHoja(); break;
    case 'enviar': { const ta = $('#pregunta'); if (ta) { const t = ta.value; ta.value = ''; enviarPregunta(t); } break; }
    case 'preguntarJ': { const j = S.M.J(d.pid); cerrarHoja(true); hoja('chat'); enviarPregunta(`¿Qué hago con ${j.nombre}? Dime si comprarlo, venderlo, clausularlo o esperar, cuánto pagar como mucho y por qué.`); break; }
    default: break;
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-cambia]');
  if (!el) return;
  const k = el.dataset.cambia, v = el.value;
  if (k === 'deuda') { guardarCfg({ deuda: +v }); rehacer(); pintar(); repintarHoja(); }
  if (k === 'liga') { guardarCfg({ ligaId: v, miEquipo: null }); cerrarHoja(true); S.D = null; cargar(); }
  if (k === 'miEquipo') { guardarCfg({ miEquipo: v || null }); cerrarHoja(true); cargar(); }
  if (k === 'modelo') guardarCfgIA({ modelo: v });
  if (k === 'horaAviso') { guardarCfgAvisos({ hora: v }); if (S.D) programar(S.D, S.M); }
  if (k === 'interes') { guardarCfgAvisos({ interes: +v }); if (S.D) programar(S.D, S.M); repintarHoja(); }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target && ev.target.id === 'pregunta') { ev.preventDefault(); const t = ev.target.value; ev.target.value = ''; enviarPregunta(t); }
});

window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (S.D && VISTAS[v] && v !== S.vista) ir(v); });

/* ---------------- lo nuevo de esta versión ---------------- */
function novedades() {
  const vista = LS.get('version-vista', null);
  LS.set('version-vista', VERSION);
  if (!vista || vista === VERSION) return;
  const n = NOVEDADES.find((x) => x.v === VERSION);
  if (!n) return;
  abrirHoja(`<div class="hoja-cab"><h2>Novedades de la ${VERSION}</h2><button class="b-ico" data-accion="cerrarHoja">${icono('cerrar')}</button></div><ul class="lista-ok">${n.cosas.map((c) => `<li>${icono('ok')}${esc(c)}</li>`).join('')}</ul>`);
}

/* ---------------- arranque ---------------- */
async function arrancar() {
  const h = location.hash.slice(1);
  if (VISTAS[h]) S.vista = h;
  if (enApp && !enDemo() && !haySesion()) {
    pantallaEntrar();
  } else {
    S.D = foto();
    if (S.D) {
      rehacer();
      pintar();
      if (Date.now() - S.D.t > 10 * MIN) cargar({ silencio: true });
    } else {
      await cargar();
    }
  }
  // por si la vuelta del inicio de sesión llegó antes de que la web estuviera lista
  if (enApp) setTimeout(() => window.vueltaLogin(), 300);
  novedades();
  setTimeout(() => buscarVersion(false), 4000);
  // el reloj de las cuentas atrás: repinta cada minuto si no hay nada abierto
  let toqueT = 0;
  for (const ev of ['touchstart', 'scroll', 'keydown']) window.addEventListener(ev, () => { toqueT = Date.now(); }, { passive: true });
  setInterval(() => {
    if (!S.D || S.hoja || S.cargando || S.analizando || document.visibilityState !== 'visible' || Date.now() - toqueT < 30e3) return;
    const y = window.scrollY;
    S.M = analizar(S.D, S.H, S.c);
    pintar();
    window.scrollTo(0, y);
  }, 60e3);
}

arrancar();
