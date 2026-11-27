/* (0.8.4o, 26 nov; Carlos, 25 nov, 23:36-23:58: «quiero que todo el mundo pueda poner el dinero de los rivales en caso
   de que se lo hayan dicho, de forma fácil, intuitiva y sencilla» y «el dinero es una función top, que esto solo sea para
   apuntar y ya. Que en ningún caso revele datos que son viendo anuncios»; claude/nota-dinero-rivales.md del proyecto)
   Lo que te ha dicho un rival que tiene: LS «dinero-dicho» (por liga), { tid: { v, r, min, max, t, est } }.
   LA REGLA DE ORO: con el dinero de ese rival cerrado (bloqueada('dineroRivales', tid)) solo se enseña la cifra que puso
   el usuario, tal cual, y cuándo. Y el motor no la recibe mientras está cerrado (`dichosMotor`, en extraM de app.js): así
   nada de lo que sale del dinero calculado (quién paga, el peligro, quién puja, el plan, lo que lee la IA, los avisos)
   cambia por haberla apuntado. Abierto (anuncio o invitar), entra en la cuenta como siempre; al cerrarse, vuelve a salir.
   Lo apuntado se sigue mandando para aprender (apunteDinero, con «Ayudar a mejorar la IA»). La app no lo pide sola: solo
   la novedad, una vez. (Carlos, 26 nov, 03:34-03:35: nada de «aprende a calcular mejor», que daba a entender que sus
   cuentas fallan: «ayudas a afinar aún más»; 03:50: «ya lo calcula exactamente a falta de la recompensa diaria».) Prueba: .github/ia/caso-dinero-dicho.mjs */
import { LS, esc, icono, cuando } from './util.js';
import { K } from './datos.js';
import { bloqueada } from './limite.js';
import { caraManager } from './comunes.js';

/** lo apuntado, de todos los rivales de esta liga */
export const dichos = () => { const d = LS.get(K('dinero-dicho'), {}); return d && typeof d === 'object' ? d : {}; };
/** lo que te dijo ese rival, o null */
export const dichoDe = (tid) => { const d = tid != null ? dichos()[String(tid)] : null; return d && Number.isFinite(Number(d.v)) ? d : null; };
/** lo que se le pasa al motor: solo lo de los rivales con su dinero abierto */
export function dichosMotor() {
  const o = {};
  for (const [tid, d] of Object.entries(dichos())) if (d && !bloqueada('dineroRivales', tid)) o[tid] = d;
  return o;
}
/** para saber si hay que rehacer el análisis al abrirse o cerrarse el dinero de un rival con una cifra apuntada */
export const firmaDichos = () => Object.entries(dichosMotor()).map(([tid, d]) => `${tid}:${d.t || 0}`).sort().join(',');

/** 48000000 → «48»; 48500000 → «48,5» */
export const mill = (v) => String(Math.round(Number(v) / 1e5) / 10).replace('.', ',');
/** la cifra tal cual la puso: «70 M» o «48-58 M» */
export const cifraDicho = (d) => (!d ? '' : d.min != null && d.max != null && Math.round(d.min / 1e5) !== Math.round(d.max / 1e5) ? `${mill(d.min)}-${mill(d.max)} M` : `${mill(d.v)} M`);
/** «hoy a las 12:40», «ayer a las 9:10», «lun 23, 18:00» */
export const cuandoDicho = (t) => cuando(t).replace(/^(hoy|ayer) (\d)/, '$1 a las $2');
/** lo escrito, en euros: en millones («48», «48,5»); si escribe la cifra entera («48.000.000»), se entiende igual */
export function leerCifra(s) {
  const x = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.abs(x) >= 10000 ? Math.round(x) : Math.round(x * 1e6);
}
/** «Más o menos» son 5 M arriba o abajo */
export const MARGEN = 5e6;
/** lo que se guarda, con el mismo formato de siempre (est: lo que daba la cuenta en ese momento, para aprender) */
export function entradaDicho(v, aprox, est = null, t = Date.now()) {
  const min = aprox ? Math.max(0, v - MARGEN) : v, max = aprox ? v + MARGEN : v;
  return { v: Math.round((min + max) / 2), r: Math.round((max - min) / 2), min: Math.round(min), max: Math.round(max), t, est: est != null ? Math.round(est) : null };
}
/** la línea de debajo de la cifra */
export function notaModo(v, aprox) {
  if (v == null) return 'Toca una cifra o escríbela, en millones.';
  return aprox ? `Lo contamos entre ${mill(Math.max(0, v - MARGEN))} y ${mill(v + MARGEN)} M.` : 'Lo contamos tal cual.';
}

const ATAJOS = [40, 60, 80, 100, 150];
/** la cifra con − y +, los atajos (en la hoja) y «Esa cifra» / «Más o menos». Lo mueve app.js sin repintar (ddPaso…) */
function formCifra({ v = null, aprox = false, atajos = true, modos = ['Esa cifra', 'Más o menos'], id = 'ddCant', grande = true } = {}) {
  const val = v != null ? mill(v) : '';
  return `<div class="dd-cifra${grande ? ' grande' : ''}">
      <button type="button" class="dd-pm" data-accion="ddPaso" data-n="-1" aria-label="Un millón menos">−</button>
      <label class="dd-caja"><span class="solo-lector">Millones que te dijo</span><input id="${id}" class="dd-in" type="text" inputmode="decimal" autocomplete="off" value="${esc(val)}" placeholder="${grande ? '0' : '50'}"><span class="dd-m">M</span></label>
      <button type="button" class="dd-pm" data-accion="ddPaso" data-n="1" aria-label="Un millón más">+</button>
    </div>
    ${atajos ? `<div class="dd-atajos">${ATAJOS.map((n) => `<button type="button" data-accion="ddAtajo" data-v="${n}" aria-pressed="${v === n * 1e6}">${n} M</button>`).join('')}</div>` : ''}
    ${atajos ? '<div class="dd-eti">Cómo te lo dijo</div>' : ''}
    <div class="dd-modo" role="group" aria-label="Cómo te lo dijo"><button type="button" data-accion="ddModo" data-m="exacto" aria-pressed="${!aprox}">${esc(modos[0])}</button><button type="button" data-accion="ddModo" data-m="aprox" aria-pressed="${aprox}">${esc(modos[1])}</button></div>
    <p class="dd-nota" aria-live="polite">${esc(notaModo(v, aprox))}</p>`;
}

/** la hoja para apuntar (diseño «Hoja»), desde la ficha del rival o desde Rivales */
export function hojaDichoHTML(S, tid) {
  const e = ((S.D && S.D.clasif) || []).find((x) => String(x.teamId) === String(tid));
  if (!e) return '<div class="hoja-cab"><h2>Ese rival ya no está</h2></div>';
  const quien = e.manager || e.nombre, d = dichoDe(tid);
  const cerrado = bloqueada('dineroRivales', tid);
  const aprox = !!(d && d.max > d.min);
  return `<div class="dd-hoja" data-tid="${esc(tid)}">
    <h2 class="dd-tit">¿Cuánto te ha dicho ${esc(quien)}?</h2>
    <p class="dd-sub">${cerrado ? 'Si te lo ha dicho él, apúntalo. Verás solo tu cifra: su dinero sigue cerrado.' : 'Si te lo ha dicho él, apúntalo. Desde ahora su dinero sale de esto más lo que mueva.'}</p>
    ${formCifra({ v: d ? d.v : null, aprox })}
    <button type="button" class="dd-v-pri dd-ok" data-accion="dichoGuardar" data-tid="${esc(tid)}">Guardar</button>
  </div>`;
}

/** en la ficha del rival (pestaña Cláusulas): lo apuntado o el botón para apuntarlo (diseño «Apuntado») */
export function fichaDichoHTML(tid, { cerrado }) {
  const d = dichoDe(tid);
  if (!d) return `<div class="dd-ficha vacio"><p>¿Te ha dicho cuánto dinero tiene?</p><button type="button" class="btn chico sec" data-accion="abrirDicho" data-tid="${esc(tid)}">${icono('euro')}Apuntar</button></div>`;
  return `<div class="dd-ficha"><p>Te dijo <b>${esc(cifraDicho(d))}</b> ${esc(cuandoDicho(d.t))}.</p>
    <div class="dd-acc"><button type="button" class="enlace" data-accion="abrirDicho" data-tid="${esc(tid)}">Cambiar la cifra</button><button type="button" class="enlace apag" data-accion="borrarDicho" data-tid="${esc(tid)}">Olvidar lo que te dijo</button></div></div>
    ${cerrado ? '<p class="t2 peq dd-pie">Es la cifra que pusiste tú: su dinero en la app sigue cerrado.</p>' : ''}`;
}
/** la casilla de la cifra apuntada, al lado de la del dinero cerrado */
export const tileDicho = (d) => `<div class="eq2-t dd-tile"><b>${esc(cifraDicho(d))}</b><span>lo que te dijo</span></div>`;

/** en Rivales → Clasificación, con el dinero de ese rival cerrado: «Te dijo 48 M» o «Apuntar» (la fila ya es un botón:
    esto es un span con data-accion, y el clic lo coge antes que la fila) */
export function pillRival(tid) {
  const d = dichoDe(tid);
  if (d) return `<span class="pill dd-p" title="Lo que te dijo ${esc(cuandoDicho(d.t))}">Te dijo ${esc(cifraDicho(d))}</span>`;
  return `<span class="pill dd-ap" role="button" tabindex="0" data-accion="abrirDicho" data-tid="${esc(tid)}">${icono('euro')}Apuntar</span>`;
}
/** el aviso de arriba de la clasificación: sale hasta que se quita (o hasta que apuntas a alguien) y no vuelve */
// a quien ya le salió la novedad (la ventana de la 0.8.4o, LS «nov-dinero») tampoco le sale el aviso (Carlos, 26 nov, 03:35)
export const avisoRivalesVisto = () => !!LS.get('dd-aviso-rivales', 0) || !!LS.get('nov-dinero', 0);
export const quitarAvisoRivales = () => LS.set('dd-aviso-rivales', Date.now());
export const avisoRivalesHTML = () => `<div class="dd-aviso">${icono('euro')}<p>¿Alguien de tu liga te ha dicho cuánto dinero tiene? Toca <b>Apuntar</b> en su fila: lo tendrás en su ficha. La app ya calcula su dinero exacto a falta de las recompensas diarias que coja; con lo que apuntes se afina aún más.</p><button type="button" class="b-ico" data-accion="quitarAvisoDicho" aria-label="Quitar este aviso">${icono('cerrar')}</button></div>`;

/** la ventana «Quién y cuánto» (diseño «Main»), en el centro. st: { sel, v, aprox, err, fase: 'pide' | 'hecho', hecho } */
export function ventanaDineroHTML(S, st) {
  const ri = ((S.D && S.D.clasif) || []).filter((e) => !S.D.yo || e.teamId !== S.D.yo.teamId);
  if (st.fase === 'hecho') {
    const e = ri.find((x) => String(x.teamId) === String(st.sel)), q = e ? e.manager || e.nombre : '';
    return `<div class="dd-v-hecho"><span class="dd-v-ok" aria-hidden="true">${icono('ok')}</span>
      <h2 id="dd-v-t">Apuntado</h2>
      <p class="dd-v-res">${esc(q)} tiene ${st.aprox ? 'unos ' : ''}${esc(mill(st.v))} M.</p>
      <p class="dd-v-sub">Lo tienes en su ficha, y ayuda a afinar aún más la cuenta de la app.</p>
      <button type="button" class="dd-v-sec" data-accion="ddOtro">Apuntar otro rival</button>
      <button type="button" class="dd-v-pri" data-accion="ddCerrar">Listo</button></div>`;
  }
  return `<span class="dd-eti-r"><i></i>Apuntar dinero</span>
    <h2 id="dd-v-t">¿Quién te lo dijo y cuánto?</h2>
    <p class="dd-v-p">Elige al rival y pon la cifra que te dijo, en millones.</p>
    <div class="dd-eti" id="ddRivalEti">Quién</div>
    <div class="dd-sel-c">${botonRival(ri.find((e) => String(e.teamId) === String(st.sel)))}
      <div class="dd-lista" id="ddLista" role="listbox" aria-labelledby="ddRivalEti" hidden>${[...ri].sort((a, b) => String(a.manager || a.nombre).localeCompare(String(b.manager || b.nombre), 'es')).map((e) => opcionRival(e, String(st.sel) === String(e.teamId))).join('')}</div>
    </div>
    <div class="dd-eti">Cuánto</div>
    ${formCifra({ v: st.v, aprox: st.aprox, atajos: false, modos: ['Me dijo esa cifra', 'Más o menos'], id: 'ddCantV', grande: false })}
    ${st.err ? `<p class="dd-err" role="alert">${esc(st.err)}</p>` : ''}
    <button type="button" class="dd-v-pri" data-accion="ddApuntar">Apuntar</button>
    <button type="button" class="dd-v-no" data-accion="ddCerrar">Nadie me ha dicho nada</button>
    <p class="dd-v-pie">Cuando quieras, también en Rivales y en la ficha de cada uno.</p>`;
}

/* (Carlos, 26 nov, 01:34 y 01:41: «debería de ser un desplegable para seleccionar rival» y «que salga la foto si tiene»)
   el rival de la ventana, en un desplegable hecho a mano (uno del navegador no lleva fotos): el botón con la cara del
   elegido y la lista con la de cada uno (caraManager: su foto si la tiene y, si no, sus iniciales) */
const FLECHA = '<svg class="ic dd-fl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const nomRival = (e) => `<span class="dd-op-t"><b>${esc(e.manager || e.nombre)}</b>${e.manager && e.nombre && e.manager !== e.nombre ? `<small>${esc(e.nombre)}</small>` : ''}</span>`;
export const botonRival = (e) => `<button type="button" class="dd-sel${e ? '' : ' vacio'}" id="ddRival" data-accion="ddAbrirLista" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="ddRivalEti ddRival">${e ? `${caraManager(e)}${nomRival(e)}` : '<span class="dd-op-t">Elige al rival</span>'}${FLECHA}</button>`;
const opcionRival = (e, sel) => `<button type="button" class="dd-op" role="option" aria-selected="${sel}" data-accion="ddElegir" data-tid="${esc(e.teamId)}">${caraManager(e)}${nomRival(e)}</button>`;

/** la novedad (diseño «Novedad»): una vez por cuenta, a todos */
export const novedadDineroHTML = () => `<div class="nvt-velo" data-accion="novDineroNo"></div>
  <div class="nvt nvt-dd" role="dialog" aria-modal="true" aria-labelledby="nvd-t">
    <span class="dd-eti-r"><i></i>Novedad</span>
    <div class="nvd-dib" aria-hidden="true"><span class="nvd-cara">FR</span><span class="nvd-bur">«Tengo 52 kilos, tío»</span><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span class="nvd-m">52 M</span></div>
    <h2 id="nvd-t">Apunta el dinero de tus rivales</h2>
    <p>Fantasy Manager ya calcula el dinero exacto de cada rival, a falta de las recompensas diarias que coja. Si alguien de tu liga te ha dicho cuánto tiene, apúntalo: ayudas a que el motor de la app y la IA lo afinen aún más.</p>
    <ul class="nvd-l">${['Puedes apuntarlo aunque tengas su dinero cerrado.', 'Solo ves lo que has puesto tú. Lo cerrado sigue cerrado.', 'No te lo vamos a estar pidiendo: lo apuntas cuando quieras.'].map((t) => `<li>${icono('ok')}${esc(t)}</li>`).join('')}</ul>
    <button type="button" class="dd-v-pri" data-accion="novDineroSi">Apuntar ahora</button>
    <button type="button" class="dd-v-no" data-accion="novDineroNo">Ahora no</button>
    <p class="dd-v-pie">Cuando quieras, en Rivales → toca a un rival.</p>
  </div>`;

/** debajo de una respuesta del chat en la que dice una cifra de un rival (diseño «Pregunta»). dr: { tid, v, t, hecho } */
export function tarjetaChatHTML(dr, i, D) {
  const e = ((D && D.clasif) || []).find((x) => String(x.teamId) === String(dr.tid));
  if (!e) return '';
  const q = e.manager || e.nombre;
  if (dr.hecho) return `<div class="apuntado">${icono('nota')}<div><b>Apuntado en su ficha:</b> ${esc(q)} tiene ${dr.hecho === 'aprox' ? 'unos ' : ''}${esc(mill(dr.v))} M.</div></div>`;
  return `<div class="dd-chat"><div class="dd-chat-t">¿Lo apunto en su ficha?</div>
    <div class="dd-chat-q">${caraManager(e)}<div><b>${esc(q)} tiene ${esc(mill(dr.v))} M</b><span>Te lo dijo ${esc(cuando(dr.t, { hora: false }))}</span></div></div>
    <div class="dd-chat-b"><button type="button" class="dd-v-pri" data-accion="dichoChat" data-i="${i}" data-m="exacto">Apuntar</button><button type="button" class="dd-v-sec" data-accion="dichoChat" data-i="${i}" data-m="aprox">Era más o menos</button></div>
    <p class="dd-v-pie">Solo se guarda tu cifra. Lo que tengas cerrado sigue cerrado.</p></div>`;
}
