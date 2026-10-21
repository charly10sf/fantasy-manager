/* Las pestañas: Hoy (el plan del día), Equipo, Rivales, Mercado y Pregunta (el chat). Cada una devuelve su HTML. */
import { esc, eur, pct, dura, cuando, icono, clase, POS_PLURAL, num, DIA, HORA, rel, LS } from './util.js';
import { ava, posTag, estadoPill, clausulaPill, delta, partidoTxt, filaJugador, nada, oncePill, filaNoticia, cromo, rivalSub, dineroCorto } from './comunes.js';
import { linea, barra } from './graficos.js';
import { hayClave, nombreModelo, conversacion, notasVigentes } from './ia.js';
import { md } from './texto.js';
import { enApp, nativo } from './puente.js';

const ICO_ACT = { compra: 'mercado', clausula: 'diana', venta: 'euro', blindaje: 'escudo', premio: 'hucha', alineacion: 'alerta', entra: 'usuario', otro: 'cambio' };
const VERBO = { compra: 'fichó a', clausula: 'clausuló a', venta: 'vendió a', blindaje: 'blindó a', premio: 'cobró por la jornada', alineacion: 'no puntuó por alineación incorrecta', entra: 'entró en la liga', otro: 'movió a' };
const VERBO_TU = { compra: 'fichaste a', clausula: 'clausulaste a', venta: 'vendiste a', blindaje: 'blindaste a', premio: 'cobraste por la jornada', alineacion: 'no puntuaste por alineación incorrecta', entra: 'entraste en la liga', otro: 'moviste a' };
export const PELIGRO = { alta: 'alto', media: 'medio', baja: 'bajo' };

export function filaActividad(a) {
  const quien = a.esYo ? '<span class="quien yo">Tú</span>' : `<span class="quien">${esc(a.quien || 'Un rival')}</span>`;
  const jug = a.nombreJ ? ` <b>${esc(a.nombreJ)}</b>` : '';
  const a2 = a.otro && a.clase !== 'premio' ? ` ${a.clase === 'clausula' ? 'de' : 'a'} ${a.contraMi ? '<b class="rojo">ti</b>' : esc(a.otro)}` : '';
  const imp = a.importe ? `<div class="v">${eur(a.importe)}</div>` : '';
  return `<button class="fila" ${a.pid ? `data-j="${esc(a.pid)}"` : ''}>
    <span class="ic-act ${a.clase}">${icono(ICO_ACT[a.clase] || 'cambio')}</span>
    <div class="fila-c"><div class="act-t">${quien} ${(a.esYo ? VERBO_TU : VERBO)[a.clase] || 'movió a'}${jug}${a2}</div><div class="fila-s">${a.t ? cuando(a.t) : ''}</div></div>
    <div class="fila-d">${imp}</div></button>`;
}

/* ================= EL MARCADOR (arriba de Hoy) ================= */
function marcador(S) {
  const { D, M } = S;
  const yo = M.yo || {};
  const ahora = Date.now();
  let fila = '';
  if (M.enParon) fila = `<span>${icono('bandera')} Parón de selecciones</span><span class="der">vuelve ${cuando(M.paron.fin, { hora: false })}</span>`;
  else if (M.enJuego) fila = `<span class="vivo">Jornada ${M.enJuego.n} en juego</span><span class="der">hasta ${cuando(M.enJuego.fin)}</span>`;
  else if (M.proxima) fila = `<span>Jornada ${M.proxima.n}</span><span class="der">${cuando(M.proxima.ini)} · ${dura(M.proxima.ini - ahora)}</span>`;
  else fila = `<span>${esc(D.liga.nombre)}</span>`;
  const dEq = M.mias.reduce((s, x) => s + num(x.tend.d1), 0);
  let h = `<div class="marcador" data-accion="resumen" role="button" tabindex="0" aria-label="Ver el detalle de tu equipo"><div class="fila-j">${fila}</div>
    <div class="cols">
      <div class="col"><div class="et">Saldo</div><div class="v ${D.dinero < 0 ? 'neg' : ''}">${eur(D.dinero)}</div><div class="d apag">gastas hasta ${eur(M.pujaMax, { dec: 1 })}</div></div>
      <div class="col"><div class="et">Equipo</div><div class="v">${eur(D.valorEquipo, { dec: 1 })}</div><div class="d ${clase(dEq)}">${dEq ? `${eur(dEq, { signo: true, dec: 1 })} hoy` : '<span class="apag">= hoy</span>'}</div></div>
      <div class="col"><div class="et">Puesto</div><div class="v">${yo.pos || '–'}º<small>/${D.clasif.length}</small></div><div class="d apag">${num(yo.puntos)} pts</div></div>
    </div><div class="marcador-mas">Ver el detalle ${icono('flecha')}</div>`;
  if (M.negativo && M.proxima) h += `<div class="alerta-m">${icono('alerta')}En negativo: si la jornada empieza así, no puntúas.</div>`;
  return h + '</div>';
}

/* ================= EL PLAN DEL DÍA ================= */
const ACCION = { vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', comprar: 'Comprar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };

/** ¿ya lo has hecho? lo marcas tú o se ve en la actividad de la liga */
export const claveHechos = (P) => (P.auto ? `auto-${P.dia}` : String(P.t));
export function hecho(S, P, o) {
  const marcados = (LS.get('hechos', {})[claveHechos(P)] || {}).n || [];
  if (marcados.includes(o.n)) return true;
  if (!o.pid) return false;
  const clase = { vender: 'venta', clausular: 'clausula', pujar: 'compra', comprar: 'compra' }[o.accion];
  const desde = P.auto ? Date.parse(P.dia + 'T00:00:00') : P.t;
  return !!clase && S.M.actividad.some((a) => a.esYo && a.pid === o.pid && a.t > desde && (a.clase === clase || (clase === 'compra' && a.clase === 'clausula')));
}

const OBJ = { titular: ['bien', 'Para tu once'], revender: ['oro', 'Para revender'], caja: ['', 'Para hacer caja'] };
function objetivoPill(o) {
  const k = String(o.objetivo || '').toLowerCase().replace(/^revend.*/, 'revender');
  const x = OBJ[k];
  if (!x || ['blindar', 'alinear', 'esperar'].includes(o.accion)) return '';
  return `<span class="pill ${x[0]}">${x[1]}${k === 'revender' && o.beneficio_esperado ? ` · ${eur(o.beneficio_esperado, { signo: true })}` : ''}${k === 'revender' && o.vender_el ? ` · vender ${esc(o.vender_el)}` : ''}</span>`;
}

function pasoOp(S, P, o) {
  const j = o.j;
  const ok = hecho(S, P, o);
  const imp = o.importe ? `<div class="imp ${o.signo > 0 ? 'mas' : 'menos'}">${o.signo > 0 ? '+' : o.signo < 0 ? '−' : ''}${eur(o.importe)}</div>` : '';
  const puja = o.accion === 'pujar' && o.puja_max ? `<div class="puja">puja hasta ${eur(o.puja_max)}</div>` : '';
  const sub = j ? `${esc(j.equipo || '')}${o.donde ? ` · ${esc(o.donde)}` : ''}` : esc(o.donde || '');
  return `<div class="paso-op ${esc(o.accion)} ${ok ? 'hecho' : ''} ${o.descartada ? 'descartada' : ''}"><span class="num">${ok ? icono('ok') : o.n}</span>
    <div class="op ${ok ? 'hecho' : ''}">
      <div class="op-top"><span class="accion-t ${esc(o.accion)}">${esc(o.etiqueta || ACCION[o.accion] || o.accion)}</span>${o.descartada ? '<span class="pill mal">No lo hagas</span>' : ''}${objetivoPill(o)}${o.cuando ? `<span class="cuando">${icono('reloj')}${esc(o.cuando)}</span>` : ''}</div>
      ${j ? `<button class="op-j" data-j="${esc(j.id)}">${ava(j, 'm')}<div style="min-width:0"><div class="n">${esc(j.nombre)}</div><div class="s">${sub}</div></div><div class="der">${imp}${puja}</div></button>`
        : o.jugador || o.importe ? `<div class="op-j"><div style="min-width:0"><div class="n">${esc(o.jugador || '')}</div><div class="s">${sub}</div></div><div class="der">${imp}${puja}</div></div>` : ''}
      ${o.motivo ? `<p class="motivo">${esc(o.motivo)}</p>` : ''}
      ${Array.isArray(o.claves) && o.claves.length ? `<div class="claves">${o.claves.slice(0, 5).map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      ${o.aviso ? `<div class="aviso-op ${o.descartada ? 'mal' : ''}">${icono(o.descartada ? 'alerta' : 'info')}${esc(o.aviso)}</div>` : ''}
      <div class="op-pie">${o.confianza ? `<span class="conf ${esc(o.confianza)}">Confianza ${esc(o.confianza)}</span>` : ''}
        <button data-accion="hecho" data-n="${o.n}">${icono(ok ? 'cerrar' : 'ok')}${ok ? 'Deshacer' : 'Hecho'}</button>
        ${o.saldo != null ? `<span class="saldo ${o.saldo < 0 ? 'neg' : ''}">saldo ${eur(o.saldo)}</span>` : ''}</div>
    </div></div>`;
}

function planHTML(S) {
  const { M } = S;
  const P = S.plan;
  const E = S.planEstado || {};
  let h = '';
  const esIA = P && !P.auto;
  h += `<div class="plan"><div class="plan-cab"><div><div class="eti">Plan de hoy</div>
    ${P ? `<span class="ia">${icono(esIA ? 'ia' : 'lista')}${esIA ? `${esc(nombreModelo(P.modelo))}${P.web ? ' + Google' : ''} · ${rel(P.t)}` : 'Automático, sin IA'}</span>` : ''}</div>
    ${hayClave() && !E.cargando ? `<button class="btn chico sec der" data-accion="plan">${icono('refrescar')}${esIA ? 'Rehacer' : 'Con IA'}</button>` : ''}</div>`;
  if (hayClave() && !E.cargando) {
    const ns = notasVigentes();
    h += `<div class="plan-voz"><button class="btn chico sec" data-accion="voz">${icono('micro')}Cuéntale algo</button>${ns.length ? `<button class="t2 peq" data-ir="ia">${icono('nota')}${ns.length} cosa${ns.length > 1 ? 's' : ''} que le has contado</button>` : ''}</div>`;
  }
  if (E.cargando) h += `<div class="cargando-ia"><div class="t">${icono('ia', 'rojo')} Preparando tu plan</div><div class="p" id="paso-ia">${esc(E.paso || 'Leyendo noticias de tus jugadores y de los que te interesan…')}</div><div class="barra-ia"><i></i></div>${enApp ? '<div class="p2">Tarda uno o dos minutos. Puedes salir de la app: te aviso cuando esté.</div>' : ''}<button class="btn chico sec parar-ia" data-accion="pararPlan">${icono('parar')}Parar</button></div>`;
  if (E.error) h += `<div class="error-c"><b>La IA no ha podido hacer el plan.</b> ${esc(E.error)}${P && P.auto ? '<br>Mientras, tienes el plan automático.' : ''}<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn chico" data-accion="plan">Reintentar</button><button class="btn chico sec" data-accion="diag">Ver qué ha pasado</button></div></div>`;
  if (!P) return h + '</div>';
  if (esIA && P.dia && P.viejo) h += `<div class="banda">${icono('reloj')}<span>Este plan es de ${cuando(P.t)}.</span>${hayClave() && !E.cargando ? '<button data-accion="plan">Hacer el de hoy</button>' : ''}</div>`;
  h += `<div class="plan-titular">${esc(P.titular || '')}</div>${P.situacion ? `<p class="plan-sit">${esc(P.situacion)}</p>` : ''}`;
  h += `<div class="pasos">${P.ops.map((o) => pasoOp(S, P, o)).join('')}</div>`;
  if (P.final != null && P.ops.some((o) => o.signo && o.importe)) h += `<div class="cierre ${P.avisoTipo === 'mal' ? 'mal' : P.avisoTipo === 'plan' ? 'oro' : ''}">${icono(P.avisoTipo === 'mal' ? 'alerta' : P.avisoTipo === 'plan' ? 'cambio' : 'euro')}<span>${P.avisoSaldo ? esc(P.avisoSaldo) : 'Te quedas con'}</span><span class="v">${eur(P.final)}</span></div>`;
  if (Array.isArray(P.descartes) && P.descartes.length) h += `<details class="descartes"><summary>${icono('buscar')}Mirados y descartados (${P.descartes.length})</summary>${P.descartes.map((d) => notaJugador(S, d.jugador, d.motivo)).join('')}</details>`;
  if (!hayClave()) h += `<div class="caja" style="margin-top:14px"><b>Este plan sale de los números, sin noticias.</b><p class="t2" style="margin:4px 0 10px">Con la IA (gratis) lee las noticias, las lesiones, las convocatorias y el calendario antes de decidir.</p><button class="btn chico" data-ir="ia">${icono('ia')}Activar la IA</button></div>`;
  if (Array.isArray(P.proximos_dias) && P.proximos_dias.length) h += `<div class="sec"><h2>Los próximos días</h2></div><div class="dias">${P.proximos_dias.map((d) => `<div class="dia"><b>${esc(d.dia)}</b><span>${esc(d.texto)}</span></div>`).join('')}</div>`;
  if (P.paron) h += `<div class="caja">${icono('bandera', 'oro')} <b>El parón.</b> <span class="t2">${esc(P.paron)}</span></div>`;
  h += onceHTML(S, P.alineacion);
  if (Array.isArray(P.vigilar) && P.vigilar.length) h += `<div class="sec"><h2>Vigila</h2></div>${P.vigilar.map((v) => notaJugador(S, v.jugador, v.texto)).join('')}`;
  if (Array.isArray(P.noticias) && P.noticias.length) h += `<div class="sec"><h2>Noticias que te afectan</h2></div>${P.noticias.map((n) => notaJugador(S, n.jugador, n.texto, n.efecto)).join('')}`;
  if (Array.isArray(P.rivales) && P.rivales.length) h += `<div class="sec"><h2>Tus rivales</h2></div>${P.rivales.map((r) => { const tid = M.teamDeManager(r.manager); return `<button class="fila" ${tid ? `data-r="${esc(tid)}"` : ''}><span class="ic-act">${icono('rivales')}</span><div class="fila-c"><div class="fila-n">${esc(r.manager || '')}</div><div class="fila-s" style="white-space:normal">${esc(r.texto || '')}</div></div></button>`; }).join('')}`;
  h += aciertosHTML(M);
  if (P.fuentes && P.fuentes.length) h += `<div class="sec"><h2>Fuentes</h2></div><div class="fuentes">${P.fuentes.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>`;
  return h + '</div>';
}

/** cómo van las recomendaciones de la IA y los puntos esperados de la app (de aprende.js) */
export function aciertosHTML(M) {
  const A = M && M.aprende;
  if (!A) return '';
  const q = A.planes, p = A.prev && !A.prev.poco ? A.prev : null;
  if (!(q && q.n) && !p) return '';
  const d1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  let h = `<details class="descartes aciertos"><summary>${icono('diana')}Cómo van sus aciertos${q && q.n ? `: <b>${q.bien} de ${q.n}</b> (${q.pct} %)` : ''}</summary>`;
  if (q && q.n) {
    h += `<p class="t2 peq">Lo que te recomendó la IA hace entre 2 y 30 días y cómo salió: comprar está bien si no ha perdido valor o si saca 6 puntos o más por jornada; vender, si ha bajado o no puntuaba.${q.hechas ? ` De lo que hiciste, ${q.bienHechas} de ${q.hechas} bien.` : ''}</p>`;
    h += q.lista.slice(0, 10).map((x) => `<button class="fila" data-j="${esc(x.pid)}"><span class="ic-act ${x.bien ? 'compra' : 'clausula'}">${icono(x.bien ? 'ok' : 'alerta')}</span><div class="fila-c"><div class="fila-n">${esc({ pujar: 'Pujar', comprar: 'Comprar', clausular: 'Clausular', vender: 'Vender' }[x.accion] || x.accion)} ${esc(x.nombre || '')}</div><div class="fila-s">${cuando(x.t, { hora: false })} a ${eur(x.valor)} · ahora ${eur(x.ahora)}${x.ppj != null ? ` · ${d1(x.ppj)} pts/jornada` : ''}${x.hecho ? '' : ' · no lo hiciste'}</div></div><div class="fila-d"><div class="v ${x.bien ? 'sube' : 'baja'}">${pct(x.dv * 100)}</div><div class="d apag">${x.accion === 'vender' ? 'bajar es bien' : 'subir es bien'}</div></div></button>`).join('');
  }
  if (p) {
    h += `<p class="t2 peq" style="margin-top:10px"><b>Los puntos esperados</b> fallan de media ${d1(p.mae.final)} pts por jugador; en el ${p.dentro2} % se acierta con ±2 (${p.pares} jugadores en ${p.jornadas} jornada${p.jornadas > 1 ? 's' : ''}). Con eso se corrigen solos: ${p.mae.desg != null ? `el desglose por partes pesa un ${Math.round(p.w * 100)} %` : 'aún sin datos del desglose'}${Object.keys(p.sesgo || {}).length ? `; por puestos ${Object.entries(p.sesgo).map(([pos, f]) => `${['', 'POR', 'DEF', 'MED', 'DEL'][pos]} ×${String(Math.round(f * 100) / 100).replace('.', ',')}`).join(', ')}` : ''}.</p>`;
    if (p.porJornada && p.porJornada.length) h += `<div class="previa">${p.porJornada.map((x) => `<span>J${x.n}: esperados <b>${d1(x.previsto)}</b> · sacaste <b>${x.real}</b></span>`).join('')}</div>`;
  }
  return h + '</details>';
}

/** el once: el que propone la IA si es una formación gratuita y cuadra con tus jugadores; si no, el mejor que sale de los números */
export function onceHTML(S, al, { conBanquillo = false } = {}) {
  const { M } = S;
  const gratis = M.formaciones.map((f) => f.join('-'));
  const todos = Object.values(S.D.maestro);
  const k = (n) => String(n || '').toLowerCase().trim();
  const buscar = (n) => M.mias.map((x) => x.j).find((j) => k(j.nombre) === k(n)) || todos.find((j) => k(j.nombre) === k(n)) || M.mias.map((x) => x.j).find((j) => k(n).includes(k(j.nombre)));
  let form = null, lineas = null, deIA = false, dudas = [];
  if (al && Array.isArray(al.titulares) && gratis.includes(String(al.formacion || '').replace(/\s/g, ''))) {
    const tit = al.titulares.map(buscar).filter(Boolean);
    const f = String(al.formacion).split('-').map(Number);
    const ls = [1, 2, 3, 4].map((p) => tit.filter((j) => j.pos === p));
    if (ls[0].length === 1 && ls[1].length === f[0] && ls[2].length === f[1] && ls[3].length === f[2]) { form = al.formacion; lineas = ls; deIA = true; dudas = al.dudas || []; }
  }
  if (!lineas && M.once && M.once.formacion) { form = M.once.nombre; lineas = M.once.lineas; dudas = M.once.lineas.flat().filter((j) => j.estado === 'doubtful').map((j) => `${j.nombre}: es duda`); }
  if (!lineas) return '';
  const huecos = !deIA && M.once.huecos;
  const banquillo = conBanquillo;
  const modo = S.filtro.campo || 'pp';
  const f = String(form).split('-').map(Number);
  const tit = lineas.flat();
  const total = tit.reduce((s, j) => s + (j.pos < 5 ? M.ppEsperado(j) : 0), 0);
  let h = `<div class="sec"><h2>Tu once</h2><span class="sub">${deIA ? 'el de la IA' : 'el mejor según la app'}</span></div>`;
  h += `<div class="campo-cab"><span class="form">${esc(form)}</span><span class="pp"><b>${String(Math.round(total * 10) / 10).replace('.', ',')}</b> pts</span>
    <div class="campo-modo">${[['pp', 'Puntos'], ['valor', 'Valor'], ['forma', 'Forma']].map(([k, t]) => `<button data-filtro="campo:${k}" class="${modo === k ? 'activo' : ''}">${t}</button>`).join('')}</div></div>`;
  // de arriba abajo: delanteros, medios, defensas y el portero; los huecos que falten, como cromos vacíos
  const filas = [3, 2, 1, 0].map((i) => {
    const n = i === 0 ? 1 : f[i - 1] || 0;
    const js = (lineas[i] || []).slice(0, n);
    while (js.length < n) js.push(null);
    return `<div class="linea-c${n >= 5 ? ' cinco' : ''}">${js.map((j) => cromo(M, j, { modo })).join('')}</div>`;
  });
  const ent = M.once && M.once.entrenador;
  h += `<div class="cancha"><i class="l-borde"></i><i class="l-medio"></i><i class="l-circ"></i><i class="l-area arriba"></i><i class="l-area abajo"></i>
    ${filas.join('')}${ent ? `<div class="cr-ent">${cromo(M, ent, { modo, chico: true, ent: true })}</div>` : ''}</div>`;
  if (banquillo) {
    const dentro = new Set([...tit.map((j) => j.id), ent && ent.id]);
    const resto = M.mias.map((x) => x.j).filter((j) => !dentro.has(j.id) && j.pos !== 5).sort((a, b) => a.pos - b.pos || b.valor - a.valor);
    if (resto.length) h += `<div class="banquillo"><div class="banq-t">Banquillo <span>${resto.length}</span></div><div class="banq-l">${resto.map((j) => cromo(M, j, { modo, chico: true })).join('')}</div></div>`;
  }
  h += `<div class="puestos-c">${M.puestos.map((p) => `<span class="pz p${p.pos}${p.faltan ? ' falta' : p.sobran ? ' sobra' : ''}"><b>${['', 'POR', 'DEF', 'MED', 'DEL'][p.pos]}</b> ${p.sanos}${p.faltan ? ` · faltan ${p.faltan}` : p.sobran ? ' · sobran' : ''}</span>`).join('')}</div>`;
  const notas = [];
  if (huecos) notas.push(`<b class="rojo">${huecos > 1 ? `Te faltan ${huecos} jugadores sanos` : 'Te falta un jugador sano'} para completarlo.</b>`);
  if (dudas.length) notas.push(`Dudas: ${esc(dudas.join(' · '))}`);
  notas.push('<span class="leyenda"><i class="facil"></i>rival fácil <i class="media"></i>medio <i class="dificil"></i>difícil · @ fuera de casa</span>');
  h += `<p class="t2 peq">${notas.join('<br>')}</p>`;
  return h;
}

function notaJugador(S, nombre, texto, efecto) {
  const k = String(nombre || '').toLowerCase();
  const j = Object.values(S.D.maestro).find((x) => x.nombre.toLowerCase() === k) || Object.values(S.D.maestro).find((x) => k && x.nombre.toLowerCase().includes(k));
  const mio = j && S.M.mias.some((x) => x.pid === j.id);
  return `<button class="fila" ${j ? `data-j="${esc(j.id)}"` : ''}>${j ? ava(j, 'm') : `<span class="ic-act">${icono('info')}</span>`}<div class="fila-c"><div class="fila-n">${esc(nombre || '')}${mio ? '<span class="pill abierta">Tuyo</span>' : ''}</div><div class="fila-s" style="white-space:normal">${esc(texto || '')}</div></div>${efecto ? `<div class="fila-d cifra ${efecto === 'sube' ? 'sube' : efecto === 'baja' ? 'baja' : 'apag'}">${efecto === 'sube' ? '▲' : efecto === 'baja' ? '▼' : '•'}</div>` : ''}</button>`;
}

/* ================= HOY ================= */
export function hoy(S) {
  const { D, M } = S;
  let h = '';
  if (D.demo) h += `<div class="banda">${icono('info')}<span>Liga de ejemplo con datos inventados.</span><button data-accion="salirDemo">Usar la mía</button></div>`;
  if (D.avisos && D.avisos.length) h += `<div class="banda">${icono('alerta')}<span>No se ha podido leer: ${esc(D.avisos.map((a) => a.paso).slice(0, 3).join(', '))}.</span><button data-accion="diag">Ver</button></div>`;
  h += marcador(S);
  h += planHTML(S);
  if (M.misVentas.length) h += `<div class="sec"><h2>Tus jugadores en venta</h2><button class="mas" data-ir="equipo" data-seg="equipo:venta">Ver</button></div>${M.misVentas.map(ventaHTML).join('')}`;
  const parar = M.clausulas.filter((x) => x.meLlega && x.interes >= 45 && (x.abierta || x.abreEn < 2 * DIA))
    .sort((a, b) => (a.abierta === b.abierta ? (a.abierta ? b.interes - a.interes : a.abreEn - b.abreEn) : a.abierta ? -1 : 1)).slice(0, 10);
  if (parar.length) {
    h += `<div class="sec"><h2>Cláusulas a tiro</h2><button class="mas" data-ir="rivales" data-seg="rivales:clausulas">Todas</button></div><div class="carril">`;
    h += parar.map((x) => `<button class="tj" data-j="${esc(x.pid)}"><span class="esq">${x.interes}</span>${ava(x.j)}
      <div class="n">${esc(x.j.nombre)}</div><div class="s">de ${esc(x.rival.manager || x.rival.nombre)}</div>
      <div class="gr">${eur(x.clausula)}</div>
      <div class="cuenta ${x.abierta ? 'ya' : ''}">${icono(x.abierta ? 'abierto' : 'reloj')}${x.abierta ? 'Abierta' : cuando(x.protegidoHasta)}</div></button>`).join('');
    h += '</div>';
  }
  if (M.noticias.length) {
    const mios = new Set(M.mias.map((x) => x.pid));
    const tuyas = M.noticias.filter((n) => (n.pids || []).some((p) => mios.has(p)));
    const resto = M.noticias.filter((n) => !tuyas.includes(n));
    h += `<div class="sec"><h2>Noticias</h2><span class="sub">${tuyas.length ? `${tuyas.length} de los tuyos` : 'Google Noticias'}</span></div>${[...tuyas.slice(0, 4), ...resto.slice(0, 6 - Math.min(4, tuyas.length))].map(filaNoticia).join('')}`;
  }
  const act = M.actividad.filter((a) => a.clase !== 'premio').slice(0, 5);
  if (act.length) h += `<div class="sec"><h2>Últimos movimientos</h2><button class="mas" data-ir="rivales" data-seg="rivales:movimientos">Todos</button></div>${act.map(filaActividad).join('')}`;
  return h;
}

/* ================= TUS JUGADORES EN VENTA ================= */
const CONSEJO = { aceptar: '<span class="pill bien">Acepta</span>', esperar: '<span class="pill duda">Espera</span>', 'sin ofertas': '<span class="pill">Sin ofertas</span>' };
export function ventaHTML(v) {
  const m = v.mejor;
  const ofs = v.ofertas.map((o) => `<div class="oferta"><span class="de ${o.deLiga ? 'liga' : ''}">${esc(o.de)}</span><span class="cifra">${eur(o.importe)}</span><span class="${o.sobre >= 0 ? 'sube' : 'baja'} cifra">${pct(o.sobre * 100)}</span>${o.caduca ? `<span class="apag">${icono('reloj')}${cuando(o.caduca)}</span>` : ''}</div>`).join('');
  return `<div class="venta"><button class="fila" data-j="${esc(v.pid)}">${ava(v.j)}
      <div class="fila-c"><div class="fila-n">${posTag(v.j)}<span>${esc(v.j.nombre)}</span></div>
        <div class="fila-s">Puesto a ${eur(v.precio)} · vale ${eur(v.j.valor)}${v.compra ? ` · pagaste ${eur(v.compra)}` : ''}</div>
        <div class="fila-x">${CONSEJO[v.consejo] || ''}${v.ofertas.length ? `<span class="pill">${v.ofertas.length} oferta${v.ofertas.length === 1 ? '' : 's'}</span>` : ''}</div></div>
      <div class="fila-d">${m ? `<div class="v ${m.sobre >= 0 ? 'sube' : ''}">${eur(m.importe)}</div><div class="d apag">mejor oferta</div>` : '<div class="d apag">sin ofertas</div>'}</div></button>
    ${ofs ? `<div class="ofertas">${ofs}</div>` : ''}${v.porque ? `<p class="t2 peq" style="margin:6px 0 0">${esc(v.porque)}${v.ganado != null ? ` Con la mejor oferta ganas <b class="${clase(v.ganado)}">${eur(v.ganado, { signo: true })}</b> sobre lo que pagaste.` : ''}</p>` : ''}</div>`;
}

/* ================= EQUIPO ================= */
const tabs = (v, actual, lista) => `<div class="tabs">${lista.map(([k, t]) => `<button data-seg="${v}:${k}" class="${actual === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;

export function equipo(S) {
  const { M, H, D } = S;
  const seg = S.seg.equipo || 'plantilla';
  const op = (pid) => S.opPorPid[pid];
  let h = `<div class="eti">Tu equipo</div><div class="titulo">${esc((M.yo && M.yo.nombre) || 'Tu equipo')}</div><p class="entradilla">${M.mias.length} jugadores · ${eur(D.valorEquipo)}${M.yo ? ` · ${M.yo.pos}º con ${M.yo.puntos} pts` : ''}</p>`;
  h += tabs('equipo', seg, [['plantilla', 'Plantilla'], ['venta', `En venta${M.misVentas.length ? ` (${M.misVentas.length})` : ''}`], ['clausulas', 'Cláusulas'], ['dinero', 'Beneficio']]);
  if (!M.mias.length) return h + nada('No encuentro tu plantilla. Si tienes varias ligas o equipos, elige el tuyo en Ajustes.');

  if (seg === 'plantilla') {
    h += onceHTML(S, null, { conBanquillo: true });
    const titulares = new Set((M.once ? M.once.lineas.flat() : []).map((j) => j.id));
    for (const p of [1, 2, 3, 4, 5]) {
      const xs = M.mias.filter((x) => x.j.pos === p);
      if (!xs.length) continue;
      h += `<div class="grupo"><span>${POS_PLURAL[p]}${p === 5 ? ' · no puntúan en la versión gratis' : ''}</span><span>${eur(xs.reduce((s, x) => s + x.j.valor, 0))}</span></div>`;
      h += xs.map((x) => {
        const f = M.forma(x.pid);
        return filaJugador(x, {
          sub: `${esc(x.j.equipo)}${x.prox ? ` · ${rivalSub(M, x.j)}` : ''}`,
          extra: `${x.ventaInercia ? `<span class="pill ${x.ventaInercia.urgencia === 'ya' ? 'mal' : 'duda'}">${icono(x.ventaInercia.urgencia === 'ya' ? 'baja' : 'reloj')}${x.ventaInercia.urgencia === 'ya' ? 'Ha girado: vender' : 'Frenando: vender'}</span>` : ''}${M.reventa[x.pid] ? '<span class="pill oro">Para revender</span>' : ''}${titulares.has(x.pid) ? '<span class="pill plan">En tu once</span>' : ''}${oncePill(M, x.j)}${M.enVenta.has(x.pid) ? '<span class="pill abierta">En venta</span>' : ''}${estadoPill(x.j)}${clausulaPill(x)}${f ? `<span class="pill">${f.pts.slice(-3).join(' · ')} pts</span>` : x.j.media ? `<span class="pill">${String(x.j.media).replace('.', ',')} pts/p</span>` : ''}`,
          conMini: true, op: op(x.pid),
        });
      }).join('');
    }
  } else if (seg === 'venta') {
    h += M.misVentas.length ? M.misVentas.map(ventaHTML).join('') : nada('No tienes a nadie en venta. Cuando pongas a alguien en el mercado, aquí verás sus ofertas (la de LaLiga y las de otros managers) y si te conviene aceptar.');
  } else if (seg === 'clausulas') {
    const xs = [...M.mias].sort((a, b) => (a.abierta === b.abierta ? a.abreEn - b.abreEn : a.abierta ? -1 : 1));
    const abiertas = xs.filter((x) => x.abierta).length;
    h += `<p class="t2 peq">${abiertas ? `<b>${abiertas}</b> de tus jugadores se pueden clausular ya.` : 'Todos tus jugadores están protegidos ahora.'} El riesgo sube cuanto más cerca está la cláusula de lo que vale y mejor es el jugador.</p>`;
    h += xs.map((x) => filaJugador(x, {
      sub: x.abierta ? `<span class="rojo">Abierta</span> · cláusula ${eur(x.clausula)}` : `Se abre ${cuando(x.protegidoHasta)} · ${eur(x.clausula)}`,
      extra: `<span class="pill ${x.riesgo === 'alto' ? 'mal' : x.riesgo === 'medio' ? 'duda' : ''}">${x.riesgo === 'ninguno' ? 'Sin riesgo' : `Riesgo ${x.riesgo}`}</span>${x.ratio ? `<span class="pill">${pct((x.ratio - 1) * 100, 0)} sobre su valor</span>` : ''}`,
      derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d apag">${x.abierta ? 'abierta' : dura(x.abreEn)}</div>`, op: op(x.pid),
    })).join('');
  } else {
    const con = M.mias.filter((x) => x.compra).sort((a, b) => b.ganado - a.ganado);
    const serie = (H.yo || []).map(([d, , v]) => [Date.parse(d + 'T12:00:00'), v]).filter(([, v]) => v);
    h += `<div class="rejilla"><div class="dato"><div class="et">Ganado sobre lo pagado</div><div class="v ${clase(M.ganadoTotal)}">${M.conCompra ? eur(M.ganadoTotal, { signo: true }) : '–'}</div></div>
      <div class="dato"><div class="et">Con precio de compra</div><div class="v">${con.length}<small>de ${M.mias.length}</small></div></div></div>`;
    h += `<div class="sec"><h2>Valor del equipo</h2></div>${linea(serie, { alto: 150 })}`;
    h += `<div class="sec"><h2>Jugador a jugador</h2></div>`;
    h += con.length ? con.map((x) => filaJugador(x, {
      sub: `Pagaste ${eur(x.compra)} · vale ${eur(x.j.valor)}`,
      derecha: `<div class="v ${clase(x.ganado)}">${eur(x.ganado, { signo: true })}</div><div class="d ${clase(x.ganado)}">${pct((x.j.valor / x.compra - 1) * 100)}</div>`, op: op(x.pid),
    })).join('') : nada('Aún no sé lo que pagaste por tus jugadores: sale de los movimientos de la liga, que guardan unas semanas.');
  }
  return h;
}

/* ================= RIVALES ================= */
export function rivales(S) {
  const { M } = S;
  const seg = S.seg.rivales || 'clasif';
  let h = `<div class="eti">${esc(S.D.liga.nombre)}</div><div class="titulo">Rivales</div>`;
  h += tabs('rivales', seg, [['clasif', 'Clasificación'], ['clausulas', 'Cláusulas'], ['movimientos', 'Movimientos']]);

  if (seg === 'clasif') {
    h += S.D.clasif.map((e) => {
      const r = M.rivales.find((x) => x.e.teamId === e.teamId);
      const yo = !r;
      return `<button class="fila ${yo ? 'yo-fila' : ''}" ${yo ? 'data-ir="equipo"' : `data-r="${esc(e.teamId)}"`}>
        <span class="posn ${yo ? 'yo' : ''}">${e.pos}</span>
        <div class="fila-c"><div class="fila-n">${esc(e.nombre)}</div>
          <div class="fila-s">${esc(e.manager && e.manager !== e.nombre ? e.manager + ' · ' : '')}${eur(e.valor)}${r && r.dValor != null ? ` · <span class="${clase(r.dValor)}">${eur(r.dValor, { signo: true, dec: 1 })} 7d</span>` : ''}</div>
          ${r ? `<div class="fila-x">${r.dinero && r.dinero.v != null ? `<span class="pill ${r.dinero.exacto ? '' : 'estim'}" title="${r.dinero.exacto ? 'Saldo exacto' : 'Saldo estimado'}">${icono('euro')}${dineroCorto(r.dinero)}</span>` : ''}${r.nivel !== 'baja' ? `<span class="amenaza ${r.nivel}">Peligro ${PELIGRO[r.nivel]}</span>` : ''}${r.leLleganYa && r.leLleganYa.length ? `<span class="pill mal">Te puede quitar ${r.leLleganYa.length}</span>` : ''}${r.meLlegan ? `<span class="pill abierta">${r.meLlegan} a tiro</span>` : ''}${r.movs ? `<span class="pill">${r.movs} mov. 7d</span>` : ''}</div>` : ''}
        </div>
        <div class="fila-d"><div class="v">${e.puntos}</div><div class="d apag">pts${e.puntosJornada ? ` · ${e.puntosJornada} últ.` : ''}</div></div></button>`;
    }).join('');
  } else if (seg === 'clausulas') {
    const f = S.filtro.cl || 'llegan';
    h += `<div class="filtros">${[['llegan', 'Te llegan'], ['abiertas', 'Abiertas'], ['hoy', 'Se abren hoy'], ['semana', 'Esta semana'], ['todas', 'Todas']].map(([k, t]) => `<button data-filtro="cl:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.clausulas;
    if (f === 'llegan') xs = xs.filter((x) => x.meLlega && (x.abierta || x.abreEn < 2 * DIA));
    if (f === 'abiertas') xs = xs.filter((x) => x.abierta);
    if (f === 'hoy') xs = xs.filter((x) => !x.abierta && x.abreEn < 24 * HORA).sort((a, b) => a.abreEn - b.abreEn);
    if (f === 'semana') xs = xs.filter((x) => !x.abierta && x.abreEn < 7 * DIA).sort((a, b) => a.abreEn - b.abreEn);
    h += `<p class="t2 peq">Puedes gastar hasta <b>${eur(M.pujaMax)}</b>. La barra es lo que te interesa: rendimiento, si sube y lo que cuesta sobre su valor.</p>`;
    h += xs.length ? xs.slice(0, 80).map((x) => filaJugador(x, {
      sub: `de ${esc(x.rival.manager || x.rival.nombre)} · vale ${eur(x.j.valor)}`,
      extra: `${clausulaPill(x)}${oncePill(M, x.j)}${estadoPill(x.j)}${x.meLlega ? '' : '<span class="pill">No te llega</span>'}`,
      derecha: `<div class="v">${eur(x.clausula)}</div><div class="d">${barra(x.interes)} <span class="t2">${x.interes}</span></div>`, op: S.opPorPid[x.pid],
    })).join('') : nada('Ninguna con este filtro.');
  } else {
    const f = S.filtro.mov || 'todos';
    h += `<div class="filtros">${[['todos', 'Todo'], ['clausula', 'Cláusulas'], ['compra', 'Fichajes'], ['venta', 'Ventas'], ['blindaje', 'Blindajes']].map(([k, t]) => `<button data-filtro="mov:${k}" class="${f === k ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
    let xs = M.actividad.filter((a) => a.clase !== 'premio');
    if (f !== 'todos') xs = xs.filter((a) => a.clase === f);
    const cambios = f === 'todos' || f === 'blindaje' ? M.cambios.filter((m) => m.tipo === 'blinda') : [];
    if (cambios.length) {
      h += `<div class="grupo"><span>Vistos en sus plantillas</span></div>` + cambios.slice(0, 8).map((m) => `<button class="fila" data-j="${esc(m.pid)}"><span class="ic-act blindaje">${icono('escudo')}</span><div class="fila-c"><div class="act-t"><span class="quien">${esc((m.equipo || {}).manager || (m.equipo || {}).nombre || 'Un rival')}</span> subió la cláusula de <b>${esc(m.j.nombre)}</b></div><div class="fila-s">${cuando(m.t)} · de ${eur(m.de)} a ${eur(m.a)}</div></div></button>`).join('');
      h += `<div class="grupo"><span>Actividad de la liga</span></div>`;
    }
    h += xs.length ? xs.slice(0, 120).map(filaActividad).join('') : nada('Sin movimientos con este filtro.');
  }
  return h;
}

/* ================= MERCADO ================= */
export function mercado(S) {
  const { M } = S;
  const seg = S.seg.mercado || 'venta';
  let h = `<div class="eti">${M.cierreMercado ? `Cambia ${cuando(M.cierreMercado)} · en ${dura(M.cierreMercado - Date.now())}` : 'Mercado de hoy'}</div><div class="titulo">Mercado</div><p class="entradilla">Puedes gastar hasta <b>${eur(M.pujaMax)}</b>.</p>`;
  h += tabs('mercado', seg, [['venta', 'En venta'], ['especular', 'Especular'], ['suben', 'Suben'], ['bajan', 'Bajan'], ['libres', 'Libres']]);
  const tagV = { chollo: '<span class="pill chollo">Chollo</span>', sube: '<span class="pill bien">Subiendo</span>', caro: '<span class="pill duda">Caro</span>', evitar: '<span class="pill mal">Evitar</span>', baja: '<span class="pill mal">Bajando</span>', frena: '<span class="pill duda">Frenando</span>', normal: '' };
  const dueno = (pid) => { const t = M.dueno[pid]; if (!t) return 'Libre'; if (t === S.D.yo.teamId) return '<span class="rojo">Tuyo</span>'; return esc((M.equipo[t] || {}).manager || (M.equipo[t] || {}).nombre || 'Rival'); };

  if (seg === 'venta') {
    const liga = M.mercado.filter((m) => m.tipo === 'liga'), man = M.mercado.filter((m) => m.tipo === 'manager' && !M.enVenta.has(m.pid));
    if (M.misVentas.length) h += `<div class="grupo"><span>Los tuyos en venta</span><span>${M.misVentas.length}</span></div>${M.misVentas.map(ventaHTML).join('')}`;
    const fila = (m) => filaJugador(m, {
      sub: `${esc(m.j.equipo)}${m.prox ? ` · ${rivalSub(M, m.j)}` : ''}`,
      extra: `${m.tipo === 'manager' ? `<span class="pill vende">${icono('usuario')}Lo vende ${esc(m.vendedor || 'un manager')}</span>` : '<span class="pill libre">Libre</span>'}${tagV[m.veredicto] || ''}${oncePill(M, m.j)}${estadoPill(m.j)}${m.tipo === 'liga' && m.pujas ? `<span class="pill">${m.pujas} puja${m.pujas > 1 ? 's' : ''}</span>` : ''}${m.tipo === 'manager' && m.ofertas ? `<span class="pill">${m.ofertas} oferta${m.ofertas > 1 ? 's' : ''}</span>` : ''}${m.miPuja ? `<span class="pill abierta">${m.tipo === 'manager' ? 'Tu oferta' : 'Tu puja'} ${eur(m.miPuja)}</span>` : m.tipo === 'liga' ? `<span class="pill">Puja ${eur(m.puja)}</span>` : ''}`,
      derecha: `<div class="v">${eur(m.precio)}</div><div class="d">${delta(m.tend)}</div><div class="d">${barra(m.interes)}</div>`, op: S.opPorPid[m.pid],
    });
    const PL = M.pujasLiga;
    const pagaTxt = PL && !PL.poco ? `<p class="t2 peq" style="margin:4px 0 2px">En tu liga los libres se llevan de mediana con un <b>${pct(PL.med * 100)}</b> sobre su valor (la mitad entre ${pct(PL.p25 * 100)} y ${pct(PL.p75 * 100)}; ${PL.n} compras de las últimas semanas). La puja que te propongo sale de ahí y de lo que te interesa cada uno.</p>` : '';
    h += liga.length ? `<div class="grupo"><span>Libres de la liga · subasta a ciegas</span><span>${liga.length}</span></div>${pagaTxt}${liga.map(fila).join('')}` : nada('No hay jugadores libres en el mercado ahora.');
    if (man.length) h += `<div class="grupo"><span>Con dueño · los vende otro manager</span><span>${man.length}</span></div><p class="t2 peq" style="margin:4px 0 2px">Siguen siendo suyos: el precio lo pone él y solo son tuyos si acepta tu oferta.</p>${man.map(fila).join('')}`;
  } else if (seg === 'especular') {
    const v = M.ventanaEsp;
    if (!v || v.ciclos < 1) h += nada(M.enJuego ? 'Con la jornada en juego no se especula: espera a que acabe.' : 'No da tiempo a comprar y vender antes de la jornada.');
    else {
      h += `<p class="t2 peq">Comprar ahora lo que sube y venderlo antes de la jornada, aunque no te haga falta. Entre medias puedes bajar hasta <b>${eur(-M.deuda)}</b>; lo único obligatorio es empezar la jornada en positivo. Ponlo a la venta el <b>${cuando(v.ponerVenta, { hora: false })}</b>. Cuenta con la tendencia de los últimos días, que puede cambiar.</p>`;
      if (M.paraRevender.length) h += `<div class="grupo"><span>Ya tienes para revender</span></div>${M.paraRevender.map((x) => filaJugador(x, { sub: `Comprado a ${eur(x.rev.precio)} · vale ${eur(x.j.valor)}`, derecha: `<div class="v ${clase(x.beneficioYa)}">${eur(x.beneficioYa, { signo: true })}</div><div class="d">${delta(x.tend)}</div>` })).join('')}`;
      h += M.especular.length ? `<div class="grupo"><span>Candidatos</span><span>${M.especular.length}</span></div>` + M.especular.slice(0, 30).map((e) => filaJugador({ j: e.j, tend: e.tend }, {
        sub: `${e.origen === 'mercado' ? `Mercado · puja ${eur(e.puja)}` : `Cláusula ${eur(e.precio)} a ${esc(e.rival.manager || e.rival.nombre)}`}`,
        extra: `<span class="pill bien">${pct(e.r * 100)}/día</span><span class="pill">${e.dias} día${e.dias > 1 ? 's' : ''}</span><span class="pill ${e.confianza === 'media' ? 'duda' : ''}">Confianza ${e.confianza}</span>`,
        derecha: `<div class="v sube">${eur(e.beneficio, { signo: true })}</div><div class="d apag">${pct(e.pct * 100)}</div>`, op: S.opPorPid[e.pid],
      })).join('') : nada('Ahora mismo nada sube lo bastante como para sacarle beneficio antes de la jornada.');
    }
  } else if (seg === 'suben' || seg === 'bajan') {
    const xs = seg === 'suben' ? M.suben : M.bajan;
    h += `<p class="t2 peq">Toda LaLiga. ${seg === 'suben' ? 'Comprar antes de que suban es cómo se saca beneficio.' : 'Si tienes alguno, piensa en venderlo antes de que pierda más.'}</p>`;
    h += xs.length ? xs.map((x) => filaJugador({ j: x.j, tend: x.t }, { sub: `${esc(x.j.equipo)} · ${dueno(x.j.id)}`, conMini: true, op: S.opPorPid[x.j.id] })).join('') : nada('Aún no hay subidas: futbolfantasy.com no ha contestado y la app necesita un par de días de histórico.');
  } else {
    h += `<p class="t2 peq">Nadie los tiene en tu liga. Ordenados por lo que interesan: pueden salir en el mercado cualquier día.</p>`;
    h += M.libresBuenos.map((x) => filaJugador({ j: x.j, tend: x.t }, { extra: `${estadoPill(x.j)}${x.j.media ? `<span class="pill">${String(x.j.media).replace('.', ',')} pts/p</span>` : ''}`, derecha: `<div class="v">${eur(x.j.valor)}</div><div class="d">${barra(x.i.n)}</div>` })).join('') || nada('Sin datos.');
  }
  return h;
}

/* ================= PREGUNTA (el chat) ================= */
const SUGERENCIAS = ['¿A quién clausulo hoy y por qué?', '¿Qué vendo para tener dinero sin perder puntos?', '¿Cuánto pujo por el mejor del mercado?', '¿Qué once pongo esta jornada?', '¿Qué hago antes del parón?', '¿Qué rival va a por mis jugadores?'];
export function ia(S) {
  if (!hayClave()) {
    return `<div class="eti">Inteligencia artificial</div><div class="titulo">Activa la IA</div>
      <p class="entradilla">Gemini, de Google, gratis con tu propia clave. Hace el plan de cada día leyendo las noticias y contesta lo que le preguntes de tu liga.</p>
      <div class="paso"><i>1</i><span>Abre <a href="#" data-abrir="https://aistudio.google.com/apikey">aistudio.google.com/apikey</a> con tu cuenta de Google.</span></div>
      <div class="paso"><i>2</i><span>Pulsa <b>Create API key</b>. Mejor en un proyecto nuevo, para que no comparta el cupo gratis con otras apps.</span></div>
      <div class="paso"><i>3</i><span>Cópiala y pégala aquí:</span></div>
      <input class="campo-t" id="claveIA" placeholder="AIza…" autocomplete="off" spellcheck="false">
      <button class="btn ancho" style="margin-top:12px" data-accion="guardarClave">${icono('ok')}Guardar y hacer el plan</button>`;
  }
  const msgs = conversacion();
  let h = `<div class="chat"><div class="eti">Pregunta</div><div class="titulo">Tu director deportivo</div>`;
  const ns = notasVigentes();
  if (ns.length) h += `<details class="notas"><summary>${icono('nota')}Tiene en cuenta ${ns.length} cosa${ns.length > 1 ? 's' : ''} que le has contado</summary>${ns.map((n) => `<div class="nota"><span>${esc(n.texto)}<small>${cuando(n.t)}${n.caduca ? ` · hasta ${cuando(n.caduca, { hora: false })}` : ''}</small></span><button data-accion="borrarNota" data-id="${esc(n.id)}" aria-label="Olvidar">${icono('cerrar')}</button></div>`).join('')}</details>`;
  if (!msgs.length && !S.charlando) h += `<p class="entradilla">Sabe todo lo de tu liga ahora mismo y busca noticias en Google antes de contestar. Cuéntale también lo que no sale en la app (un amigo te ofrece un jugador, a quién no quieres vender): lo apunta y lo tiene en cuenta en el plan. Puedes hablarle con el micro.</p><div class="sugerencias">${SUGERENCIAS.map((s) => `<button data-sugerencia="${esc(s)}">${icono('ia')}${esc(s)}</button>`).join('')}</div>`;
  else if (msgs.length) h += `<div style="text-align:right"><button class="btn chico sec" data-accion="borrarChat">Empezar de nuevo</button></div>`;
  const ultimaIA = [...msgs].reverse().find((m) => m.r === 'ia');
  h += msgs.map((m) => (m.r === 'yo' ? `<div class="msg yo">${esc(m.t)}</div>` : `<div class="msg ia"><div class="quien-ia">${esc(nombreModelo(m.modelo) || 'IA')}</div>${md(m.t)}${m.fuentes && m.fuentes.length ? `<div class="fuentes">${m.fuentes.map((f) => `<button data-abrir="${esc(f.u)}">${esc(f.t)}</button>`).join('')}</div>` : ''}${(m.apuntadas && m.apuntadas.length) || m.olvidadas ? `<div class="apuntado">${icono('nota')}<div>${(m.apuntadas || []).map((t) => `<b>Apuntado:</b> ${esc(t)}`).join('<br>')}${m.olvidadas ? `${m.apuntadas && m.apuntadas.length ? '<br>' : ''}Olvidado${m.olvidadas > 1 ? `s ${m.olvidadas}` : ''} lo que ya no vale.` : ''}${m === ultimaIA ? '<button class="btn chico" data-accion="planYa">Rehacer el plan con esto</button>' : ''}</div></div>` : ''}</div>`)).join('');
  // la pregunta que se está contestando, aunque aún no esté guardada en el chat
  if (S.charlando && S.preguntaActual && !(msgs.length && msgs[msgs.length - 1].r === 'yo' && msgs[msgs.length - 1].t === S.preguntaActual)) h += `<div class="msg yo">${esc(S.preguntaActual)}</div>`;
  if (S.charlando) h += `<div class="msg ia" id="respuesta"><div class="quien-ia">Pensando…</div>${S.parcial ? md(S.parcial) : `<span class="pensando"><i></i><i></i><i></i></span> <span class="t2 peq" id="paso-chat">${esc(S.pasoChat || '')}</span>`}</div><div class="parar-chat"><button class="btn chico sec" data-accion="pararChat">${icono('parar')}Parar la respuesta</button></div>`;
  h += `</div><div class="escribe"><div class="escribe-in"><textarea id="pregunta" rows="1" placeholder="Pregunta o cuéntale algo"></textarea>${S.charlando ? `<button class="parar" data-accion="pararChat" aria-label="Parar">${icono('parar')}</button>` : `${nativo.hayVoz() ? `<button class="micro" data-accion="voz" aria-label="Hablar">${icono('micro')}</button>` : ''}<button data-accion="enviar" aria-label="Enviar">${icono('enviar')}</button>`}</div></div>`;
  return h;
}
