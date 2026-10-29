/* Los anuncios de la web (Google AdSense, desde la 0.6.8). En el móvil, un banner de 320×50 encima de las pestañas;
   en el ordenador, si sobra sitio a la derecha, uno de 160×600. Solo en el navegador: dentro de la app de Android no,
   porque AdSense no deja anuncios en el navegador de una app (ahí van los de AdMob, en la versión de Google Play).
   Quién los ve lo decide limite.js (`anunciosWebModo`: «anunciosWeb» en limites.json; a los de «todoAbierto» o
   «sinLimite» —Carlos— solo con «anunciosWebDueno», y de prueba: data-adtest="on", que no cuentan); cuándo, app.js (`ponerBanner`: en las pestañas, nunca en Pregunta, la carga, la entrada ni la pantalla
   del límite). La barra solo se ve cuando Google ha puesto un anuncio (data-ad-status="filled"): mientras AdSense revisa
   la web, o si no tiene anuncio que dar, no se ve nada ni se reserva sitio. El mensaje de consentimiento de la UE lo saca
   el propio script de AdSense (Privacidad y mensajes → Reglamentos europeos, publicado el 29 oct). Los bloques se crearon
   el 29 oct en AdSense: «FM web movil abajo» y «FM web ordenador lateral», los dos adaptables y aquí con su tamaño fijo
   por CSS, como deja AdSense. */
import { enApp, enWeb } from './puente.js';

const CLIENTE = 'ca-pub-3175956326240112';
const BLOQUES = {
  movil: { slot: '3823780577', w: 320, h: 50 },
  lateral: { slot: '3681852338', w: 160, h: 600 },
};
// el ordenador necesita este ancho (con la barra de la izquierda) y este alto para el lateral sin tapar nada
const ANCHO_LATERAL = 1260, ALTO_LATERAL = 720;

let scriptPuesto = false;
const cajas = {};
let quiere = false, escritorio = false, prueba = false;

function ponerScript() {
  if (scriptPuesto) return;
  scriptPuesto = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENTE}`;
  s.onerror = () => { /* un bloqueador de anuncios o sin red: no pasa nada, la barra no sale */ };
  document.head.appendChild(s);
}

const lleno = (tipo) => { const c = cajas[tipo]; const ins = c && c.querySelector('ins'); return !!ins && ins.getAttribute('data-ad-status') === 'filled'; };

function caja(tipo) {
  // (si ha cambiado de real a prueba o al revés, por ejemplo al entrar otra cuenta, la caja se hace de nuevo)
  if (cajas[tipo] && cajas[tipo].dataset.prueba === String(prueba)) return cajas[tipo];
  if (cajas[tipo]) { cajas[tipo].remove(); document.body.classList.remove(`con-aw-${tipo}`); delete cajas[tipo]; }
  const b = BLOQUES[tipo];
  const d = document.createElement('div');
  d.className = `aw aw-${tipo}`;
  d.dataset.prueba = String(prueba);
  d.innerHTML = `<span class="aw-et">Publicidad${prueba ? ' · prueba' : ''}</span><ins class="adsbygoogle" style="display:inline-block;width:${b.w}px;height:${b.h}px" data-ad-client="${CLIENTE}" data-ad-slot="${b.slot}"${prueba ? ' data-adtest="on"' : ''}></ins>`;
  document.body.appendChild(d);
  cajas[tipo] = d;
  new MutationObserver(colocar).observe(d.querySelector('ins'), { attributes: true, attributeFilter: ['data-ad-status'] });
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* nada */ }
  return d;
}

const cabeLateral = () => window.innerWidth >= ANCHO_LATERAL && window.innerHeight >= ALTO_LATERAL;

/** enseña la barra que toca (o ninguna) y deja sitio para ella solo si ya lleva anuncio */
function colocar() {
  const tipo = !quiere ? null : escritorio ? (cabeLateral() ? 'lateral' : null) : 'movil';
  if (tipo) caja(tipo);
  for (const t of Object.keys(cajas)) {
    const si = t === tipo && lleno(t);
    cajas[t].classList.toggle('on', si);
    document.body.classList.toggle(`con-aw-${t}`, si);
  }
}

/** lo llama app.js: si ahora tocan anuncios (si), si la pantalla es la del ordenador, si el script va ya aunque no
    haya bloques (en la entrada: así Google ve su código en la página que revisa) y si son de prueba (el dueño) */
export function anunciosWeb(si, enEscritorio, script = false, dePrueba = false) {
  if (enApp || !enWeb) return;
  quiere = !!si;
  escritorio = !!enEscritorio;
  prueba = !!dePrueba;
  if (quiere || script) ponerScript();
  colocar();
}
/** ¿hay anuncios de la web en marcha? (para enseñar «Privacidad de los anuncios» en Ajustes) */
export const hayAnunciosWeb = () => scriptPuesto;

/** vuelve a sacar el mensaje de consentimiento de Google, para cambiar lo que se eligió */
export function privacidadWeb() {
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push(() => { try { window.googlefc.showRevocationMessage(); } catch (e) { /* nada */ } });
}

window.addEventListener('resize', () => { if (quiere) colocar(); });
