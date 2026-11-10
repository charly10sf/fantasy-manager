/*
 * Los avisos de la ficha del jugador, plegados (tarea 37, 10 nov): título y una línea con el dato clave a la vista;
 * lo demás, dentro de un <details>. El summary solo lleva texto e iconos (nada de botones dentro: la 0.7.2 lo pide por
 * accesibilidad). Si el plan de hoy dice lo mismo que el aviso de inercia, sale una sola tarjeta.
 */
import { esc, eur, pct, cuando, icono, norm } from './util.js';

/** lo que se ha abierto a mano en esta sesión: al repintar la ficha (llega el histórico, cambia el plan…) no se cierra */
const abiertos = (S) => (S.avisosAbiertos ||= {});
export function plegarAviso(S, k, abierto) { if (abierto) abiertos(S)[k] = 1; else delete abiertos(S)[k]; }

/** [primera frase, el resto] de un texto sin HTML. No parte «14,76 M. Si…» por el punto de los números */
export function frases(t) {
  const s = String(t || '').trim();
  const m = s.match(/^(.+?[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/);
  return m ? [m[1], s.slice(m[0].length)] : [s, ''];
}
export const parrafos = (...ps) => ps.filter(Boolean).map((p) => `<p>${p}</p>`).join('');

/**
 * Un aviso. t, l y d ya van escapados (llevan HTML). Sin d no hay nada que plegar y sale una tarjeta normal.
 * cls: '' (rojo), 'oro', 'verde' o 'azul'. chip: el dato corto de la derecha (solo en una de las maquetas).
 */
export function aviso(S, { k, pid = '', cls = '', ico, t, l = '', d = '', chip = null }) {
  const cab = `${icono(ico)}<span class="av-tx"><b class="av-t">${t}</b>${l ? `<span class="av-l">${l}</span>` : ''}</span>${chip ? `<span class="av-chip ${chip.cls || ''}">${esc(chip.t)}</span>` : ''}`;
  if (!d) return `<div class="aviso-ficha av ${cls}">${cab}</div>`;
  const clave = `${pid}:${k}`;
  return `<details class="aviso-ficha av av-pleg ${cls}"${abiertos(S)[clave] ? ' open' : ''}><summary data-accion="plegarAviso" data-k="${esc(clave)}">${cab}${icono('abajo', 'av-fl')}</summary><div class="av-d">${d}</div></details>`;
}

/** un aviso hecho con un texto plano: la primera frase a la vista y el resto plegado (notas del plan, descartes…) */
export function avisoDeTexto(S, { k, pid, cls = '', ico, t, texto }) {
  const [a, resto] = frases(texto);
  return aviso(S, { k, pid, cls, ico, t: esc(t), l: esc(a), d: resto ? parrafos(esc(resto)) : '' });
}

const FASES = ['giro', 'baja', 'parado', 'frena', 'acelera', 'rebote'];
const TIT = { giro: 'Ha girado a la baja', baja: 'Está bajando', parado: 'Se ha estancado', frena: 'Se está frenando', acelera: 'Sube cada vez más', rebote: 'Rebota tras semanas bajando' };
const fmt = (x) => eur(x, { signo: true });
const dias = (n) => `${n} día${n === 1 ? '' : 's'}`;
const minus = (s) => s[0].toLowerCase() + s.slice(1);

/** ¿el plan de hoy cuenta lo mismo que la inercia? (su motivo empieza con el texto del aviso) */
const mismoTexto = (op, x) => !!(op && op.motivo && x.texto && norm(op.motivo).startsWith(norm(x.texto).slice(0, 40)));

/**
 * El aviso de inercia y, si dice lo mismo, el plan de hoy en la misma tarjeta.
 * Devuelve { html, fundido }: fundido es true si el plan ya va dentro y no hay que pintarlo aparte.
 */
export function inerciaPlanHTML(S, pid, { mio = false, op = null, mia = null } = {}) {
  const { M } = S;
  const x = M.inercia ? M.inercia(pid) : null;
  if (!x || !(FASES.includes(x.fase) || x.vuelve)) return { html: '', fundido: false };
  const mal = x.fase === 'giro' || x.fase === 'baja', ojo = x.fase === 'parado' || x.fase === 'frena';
  // frenando pero con días de subida por delante: para comprar y vender pronto todavía vale (Carlos, 30 oct, Gulácsi)
  const larga = x.fase === 'frena' && x.giroEn != null && x.giroEn >= 3;
  const vu = x.vuelve;
  const pz = M.partidazo ? M.partidazo(pid) : null;
  const fundido = !!(op && mio && op.accion === 'vender' && mismoTexto(op, x));

  // la línea a la vista: el dato clave
  let linea;
  if (vu) linea = `Llegó a valer ${eur(vu.max)} · lleva ${dias(vu.racha)} subiendo`;
  else if (x.fase === 'rebote') linea = `Cayó un ${Math.round(x.rebote.caida * 100)} % en el mes (de ${eur(x.rebote.max)} a ${eur(x.rebote.min)})`;
  else if (x.fase === 'acelera') linea = `Unos ${fmt(x.proy3)} en 3 días`;
  else if (larga) linea = `Aún sube unos ${Math.max(1, Math.round(x.giroEn))} días${x.proy3 > 0 ? `: ${fmt(x.proy3)} en 3 días` : ''}`;
  else if (x.proyJ < 0) linea = `Si sigue así, pierde ~${eur(-x.proyJ)} en ${dias(x.hastaJ)}`;
  else linea = TIT[x.fase] || '';

  // el consejo corto del título (con un partidazo de por medio cambia el consejo: va solo dentro)
  let corto = '';
  if (!pz && !vu && x.fase !== 'rebote') corto = mio ? (mal ? 'véndelo ya' : larga ? `véndelo en ${Math.max(1, Math.round(x.giroEn) - 1)} días` : ojo ? 'véndelo antes de que gire' : '') : (larga ? 'aún da para comprar y vender' : mal || ojo ? 'no es momento de comprarlo' : '');
  if (vu) corto = mio ? 'aguántalo mientras suba' : 'compensa para revender';

  const tit = vu ? `Vuelve a subir` : TIT[x.fase];
  let titulo;
  if (fundido) titulo = `Plan de hoy: véndelo por ${eur(op.importe)}<span class="av-sub"> · ${esc(minus(tit))}</span>`;
  else titulo = `${esc(tit)}${corto ? `<span class="av-sub"> · ${esc(corto)}</span>` : ''}`;

  // dentro: lo de cada día, los puntos que quita, hasta cuándo está protegida la cláusula y el consejo
  const subida = x.R.slice(0, Math.max(0, x.R.length - Math.max(x.baja, 1))).filter((r) => r > x.quieto).slice(-4);
  const u3 = x.R.slice(-3).map(fmt).join(', ');
  let cadaDia = '';
  if (vu) cadaDia = `Vuelve a jugar y sube un ${pct(vu.ritmo * 100, 1, false)} al día de media estos últimos días.`;
  else if (x.fase === 'giro') cadaDia = `Venía subiendo (${subida.map(fmt).join(', ')} al día). ${x.baja >= 2 ? `Lleva ${dias(x.baja)} bajando.` : 'Hoy ya baja.'}`;
  else if (x.fase === 'baja') cadaDia = x.baja >= 2 ? `Lleva ${dias(x.baja)} seguidos bajando.` : '';
  else if (x.fase === 'parado') cadaDia = `Venía subiendo (${subida.map(fmt).join(', ')} al día) y hoy se ha parado. Lo normal es que ahora baje.`;
  else if (x.fase === 'frena') cadaDia = `Sube cada vez menos: ${u3} al día. A este ritmo deja de subir en ~${dias(Math.max(1, Math.round(x.giroEn)))} y luego baja.`;
  else if (x.fase === 'acelera') cadaDia = `Últimos días: ${u3} al día.`;
  else if (x.fase === 'rebote') cadaDia = `Es un rebote pequeño tras mucho bajar (${subida.map(fmt).join(', ')} al día). Puede estar tocando fondo o seguir bajando: solo con esto no hay motivo para venderlo.`;

  const vende = mio && (mal || ojo);
  const quita = vende && M.perdida ? M.perdida(pid) : 0;
  const quitaTxt = quita >= 0.3 ? `Vendiéndolo pierdes unos ${String(Math.round(quita * 10) / 10).replace('.', ',')} pts por jornada: ficha a quien lo sustituya.` : '';
  let proteg = '';
  if (vende && mia) {
    if (mia.abreEn > 0) proteg = `Su cláusula está protegida hasta ${esc(cuando(mia.protegidoHasta))}: nadie te lo puede clausular antes.`;
    else proteg = esc((M.esperarVenta ? M.esperarVenta(mia).nota : '') || '');
  }

  // el consejo (con partidazo, el escalón cambia lo que se hace)
  let consejo = '';
  if (vu) consejo = mio ? 'Aguántalo mientras siga subiendo: le queda mucho para lo que valía. Véndelo cuando deje de subir.' : 'Para comprarlo y revenderlo es de los más claros: le queda mucho recorrido. Mientras siga subiendo, compensa.';
  else if (pz && (mal || ojo)) {
    consejo = [
      `Hizo ${pz.pts} puntos en su último partido: puede suavizar la bajada.`,
      `Hizo ${pz.pts} puntos en su último partido: lo normal es que la bajada se frene. ${mio ? 'Sin prisa: espera al cambio de mañana antes de venderlo.' : 'Puede que mañana no esté más barato.'}`,
      `Hizo ${pz.pts} puntos en su último partido. LaLiga suele subirle el valor los días siguientes: la bajada puede frenarse o darse la vuelta. ${mio ? 'Espera al cambio de mañana antes de venderlo.' : 'Puede que mañana ya esté más caro.'}`,
    ][pz.nivel - 1];
  } else if (x.fase === 'rebote') consejo = mio ? 'Decide por sus puntos y su sitio en tu once.' : 'Está cerca de su mínimo del mes, pero aún no ha demostrado que vaya a subir.';
  else if (mio) consejo = mal ? 'Déjalo solo si lo necesitas sí o sí para la jornada.' : '';
  else consejo = larga ? 'Para quedártelo mucho tiempo, no: en unos días gira.' : '';

  const d = parrafos(esc(cadaDia), esc(quitaTxt), proteg, esc(consejo));
  const cls = mal ? '' : ojo ? 'oro' : x.fase === 'rebote' ? 'azul' : 'verde';
  const ico = mal ? 'baja' : ojo ? 'reloj' : x.fase === 'rebote' ? 'cambio' : 'sube';
  const chip = x.proyJ < 0 && (mal || ojo) ? { t: `${fmt(x.proyJ)}`, cls: 'baja' } : x.proy3 > 0 && !mal ? { t: fmt(x.proy3), cls: 'sube' } : null;
  return { html: aviso(S, { k: 'inercia', pid, cls, ico, t: titulo, l: esc(linea), d, chip }), fundido };
}
