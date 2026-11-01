/* Las tarjetas para compartir (0.6.11; era la 1.1 del roadmap, adelantada el 1 nov): el plan y las pullitas de la IA
   como imagen para el grupo de WhatsApp de la liga, con «Hecho con Fantasy Manager». Se dibujan en un canvas (1080 de
   ancho, con las fuentes de la app) y se mandan como PNG: en la app por el puente (Tarjetas.java), en el navegador con
   el menú de compartir del móvil o, si no lo hay, descargándola.
   En ese grupo están tus rivales (lo decidió Carlos el 1 nov): del plan solo sale lo que ya está hecho y se ve en
   LaLiga (un clausulazo, una venta, un blindaje); lo que tienes en marcha va como «y N movimientos más», sin nombres, y
   el titular se quita solo si nombra a uno de esos (se puede volver a poner). */
import { esc, eur, norm, fechaCorta, iniciales, icono, LOGO_D, POS_LARGO } from './util.js';
import { imagenDatos, enApp, nativo } from './puente.js';
import { hecho, hechoEnLiga } from './vistas.js';

const W = 1080, PAD = 76, ANCHO = W - 2 * PAD, PIE = 150;
const C = {
  fondo: '#08080a', plano: '#131317', plano2: '#1b1b21', linea: '#2c2c35', texto: '#f4f2f3', texto2: '#c3bec5',
  apagado: '#948f9b', rojo: '#ee1c3c', rojoL: '#ff5269', sube: '#2fd18f', baja: '#ff6f61', oro: '#ffc547', azul: '#58a6ff',
};
const POS_COLOR = { 1: C.oro, 2: C.azul, 3: C.sube, 4: C.rojo, 5: '#9a96a0' };
const F = (peso, px, cond = false) => `${peso} ${px}px ${cond ? '"Barlow Condensed", ' : ''}Barlow, system-ui, sans-serif`;
// lo que se ve en LaLiga en cuanto lo haces: eso sí se puede enseñar
const PUBLICA = { clausular: ['Clausulazo', C.rojoL], vender: ['Venta', C.sube], comprar: ['Fichaje', C.azul], pujar: ['Fichaje', C.azul], blindar: ['Blindaje', C.oro] };
const limpio = (t) => String(t || '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

/* ---------------- qué se puede compartir ---------------- */

/** lo que se puede compartir del plan que se ve: el plan y cada noticia y cada rival (ahí van las pullitas) */
export function opciones(S) {
  const P = S.plan;
  if (!P) return [];
  const l = [{ k: 'plan', t: 'Tu plan', ic: 'lista' }];
  (P.noticias || []).forEach((n, i) => { if (n && limpio(n.texto)) l.push({ k: `n${i}`, t: n.jugador || 'Noticia', ic: 'nota' }); });
  (P.rivales || []).forEach((r, i) => { if (r && limpio(r.texto)) l.push({ k: `r${i}`, t: r.manager || 'Rival', ic: 'usuario' }); });
  return l;
}

/** del plan, lo que se enseña (hecho y público) y lo que no; y si el titular nombra a alguien de lo que no */
export function delPlan(S) {
  const P = S.plan;
  const vistos = [], ocultos = [];
  for (const o of P.ops || []) {
    if (o.descartada || o.accion === 'esperar') continue;
    const liga = hechoEnLiga(S, P, o);
    let texto = null;
    if (liga && liga.estado === 'hecho') texto = liga.texto;
    else if (!liga && hecho(S, P, o)) {
      // marcado a mano y aún no se ve en LaLiga: solo lo que no puede ser secreto (una puja sí lo es hasta que se resuelve)
      const por = o.importe ? ` por ${eur(o.importe)}` : '';
      if (o.accion === 'clausular') texto = `Clausulado${por}`;
      else if (o.accion === 'blindar') texto = 'Blindado';
      else if (o.accion === 'vender' && o.etiqueta === 'Aceptar oferta') texto = `Vendido${por}`;
    }
    if (texto && PUBLICA[o.accion]) {
      // a quién se lo quitas o quién se lo lleva: es lo que da juego en el grupo
      const donde = String(o.donde || '');
      const quitado = o.accion === 'clausular' ? (donde.match(/cl[aá]usula a (.+)/i) || [])[1] : null;
      const lleva = o.accion === 'vender' ? (donde.match(/oferta de (.+)/i) || [])[1] : null;
      const mas = quitado ? ` · se lo has quitado a ${quitado.trim()}` : lleva ? ` · se lo lleva ${lleva.trim()}` : '';
      vistos.push({ o, j: o.j || null, nombre: (o.j && o.j.nombre) || o.jugador || '', texto: texto + mas });
    } else if (o.accion !== 'alinear') ocultos.push(o);
  }
  // ¿el titular chiva algo de lo que no sale? (un apellido de 4 letras o más de alguno de esos)
  const palabras = new Set(ocultos.flatMap((o) => [o.j && o.j.nombre, o.jugador]).filter(Boolean).flatMap((n) => norm(n).split(' ').filter((w) => w.length >= 4)));
  const tit = ` ${norm(P.titular)} `;
  const chiva = [...palabras].some((w) => tit.includes(` ${w} `));
  return { vistos, ocultos, chiva };
}

/* ---------------- dibujar ---------------- */

async function fuentes() {
  if (!document.fonts || !document.fonts.load) return;
  const l = ['500', '600', '700'].flatMap((p) => [document.fonts.load(F(p, 40, true)), document.fonts.load(F(p, 40))]);
  await Promise.race([Promise.all(l).catch(() => {}), new Promise((ok) => setTimeout(ok, 2500))]);
}

// las fotos (de LaLiga: otra web) se piden como data:… para no ensuciar el canvas; si no llegan en 6 s, las iniciales
const fotos = new Map();
function foto(url) {
  if (!url) return Promise.resolve(null);
  if (!fotos.has(url)) {
    fotos.set(url, (async () => {
      try {
        const datos = await Promise.race([imagenDatos(url), new Promise((_, mal) => setTimeout(() => mal(new Error('tiempo')), 6000))]);
        return await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = datos; });
      } catch (e) { return null; }
    })());
  }
  return fotos.get(url);
}

/** parte un texto en líneas que caben en `ancho`; con más de `max`, la última acaba en «…» */
function partir(ctx, texto, ancho, max = 99) {
  const out = [];
  let l = '';
  for (const w of limpio(texto).split(' ')) {
    const p = l ? `${l} ${w}` : w;
    if (!l || ctx.measureText(p).width <= ancho) l = p;
    else { out.push(l); l = w; }
  }
  if (l) out.push(l);
  if (out.length <= max) return out;
  const r = out.slice(0, max);
  let u = r[max - 1];
  while (u.includes(' ') && ctx.measureText(`${u}…`).width > ancho) u = u.replace(/\s*\S+$/, '');
  r[max - 1] = `${u.replace(/[,.;:]$/, '')}…`;
  return r;
}

const espaciado = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };

function logo(ctx, x, y, tam) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tam / 188, tam / 188);
  ctx.translate(-6, -10);
  ctx.fillStyle = C.rojo; ctx.fill(new Path2D(LOGO_D.camiseta));
  ctx.fillStyle = '#fff'; ctx.fill(new Path2D(LOGO_D.dorsal));
  ctx.restore();
}

/** una cara redonda: la foto (arriba, que es donde va la cabeza) o las iniciales, con un aro del color que toque */
function cara(ctx, x, y, d, im, quien, color) {
  const r = d / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, Math.PI * 2); ctx.closePath();
  const g = ctx.createLinearGradient(x, y, x, y + d);
  g.addColorStop(0, C.plano2); g.addColorStop(1, '#0d0d10');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  if (im && im.width) {
    const s = Math.max(d / im.width, d / im.height);
    ctx.drawImage(im, x + r - (im.width * s) / 2, y, im.width * s, im.height * s);
  } else {
    ctx.fillStyle = C.texto2; ctx.font = F(700, Math.round(d * 0.38), true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(iniciales(quien), x + r, y + r + 2);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(x + r, y + r, r - 2, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(4, Math.round(d / 30)); ctx.strokeStyle = color || C.linea; ctx.stroke();
}

function fondo(ctx, h) {
  ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, W, h);
  const g = ctx.createRadialGradient(W - 60, 40, 0, W - 60, 40, 820);
  g.addColorStop(0, 'rgba(238,28,60,0.34)'); g.addColorStop(1, 'rgba(238,28,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = C.rojo; ctx.fillRect(0, 0, 14, h);
}

/** arriba: el logo, qué es (en rojo), a la derecha la fecha o la jornada y debajo, si hay, una línea más */
function cabecera(ctx, y, que, der, sub) {
  logo(ctx, PAD, y, 78);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = F(700, 38, true); ctx.fillStyle = C.rojoL; espaciado(ctx, 3);
  ctx.fillText(que.toUpperCase(), PAD + 100, y + (sub ? 34 : 52));
  if (der) { ctx.textAlign = 'right'; ctx.font = F(600, 34, true); ctx.fillStyle = C.apagado; ctx.fillText(der.toUpperCase(), W - PAD, y + (sub ? 34 : 52)); ctx.textAlign = 'left'; }
  espaciado(ctx, 0);
  if (sub) { ctx.font = F(500, 33); ctx.fillStyle = C.texto2; ctx.fillText(partir(ctx, sub, ANCHO - 100, 1)[0] || '', PAD + 100, y + 78); }
  return y + 96;
}

function pie(ctx, h) {
  const y = h - PIE;
  ctx.fillStyle = C.linea; ctx.fillRect(PAD, y, ANCHO, 2);
  logo(ctx, PAD, y + 38, 62);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = F(600, 34); ctx.fillStyle = C.texto;
  ctx.fillText('Hecho con Fantasy Manager', PAD + 80, y + 82);
  ctx.textAlign = 'right'; ctx.font = F(600, 34, true); ctx.fillStyle = C.rojoL;
  ctx.fillText('fantasymanagerapp.com', W - PAD, y + 82);
  ctx.textAlign = 'left';
}

/**
 * Dibuja dos veces con la misma función: la primera solo mide (para saber el alto) y la segunda pinta. `cuerpo(ctx, y)`
 * pinta desde `y` (con `aire` de más tras la cabecera) y devuelve dónde acaba. El alto va de 1080 (cuadrada) a 1920
 */
function componer(cuerpo) {
  const m = document.createElement('canvas').getContext('2d');
  const fin = cuerpo(m, 70, false);
  const h = Math.max(1080, Math.min(1920, Math.ceil(fin + 50 + PIE)));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = h;
  const ctx = cv.getContext('2d');
  fondo(ctx, h);
  // lo que sobra hasta el cuadrado va entre la cabecera y el contenido (un poco por encima de la mitad)
  cuerpo(ctx, 70, true, Math.max(0, h - Math.ceil(fin + 50 + PIE)) * 0.42);
  pie(ctx, h);
  return cv;
}

function plan(S, d, conTitular, caras) {
  const P = S.plan, D = S.D, M = S.M;
  const yo = D && D.yo ? (D.clasif || []).find((e) => e.teamId === D.yo.teamId) : null;
  const que = P.viejo ? `Plan del ${fechaCorta(P.t)}` : 'Plan de hoy';
  const jor = M && (M.enJuego || M.proxima) ? `Jornada ${(M.enJuego || M.proxima).n}` : fechaCorta(P.t || Date.now());
  const sub = yo ? `${yo.nombre}${yo.pos ? ` · ${yo.pos}º` : ''}${yo.puntos ? ` · ${yo.puntos} pts` : ''}` : '';
  return (ctx, y0, pintar, aire = 0) => {
    let y = pintar ? cabecera(ctx, y0, que, jor, sub) : y0 + 96;
    y += 52 + aire;
    if (conTitular && P.titular) {
      ctx.font = F(700, 86, true);
      const ls = partir(ctx, P.titular, ANCHO, 5);
      if (pintar) { ctx.fillStyle = C.texto; ls.forEach((l, i) => ctx.fillText(l, PAD, y + 72 + i * 92)); }
      y += ls.length * 92 + 46;
    }
    const vistos = d.vistos.slice(0, 5);
    if (vistos.length) {
      if (pintar) { ctx.font = F(700, 32, true); ctx.fillStyle = C.apagado; espaciado(ctx, 3); ctx.fillText('HECHO HOY', PAD, y + 30); espaciado(ctx, 0); }
      y += 58;
      const X = PAD + 128 + 34, AN = W - PAD - X;
      for (const v of vistos) {
        const [eti, color] = PUBLICA[v.o.accion];
        ctx.font = F(500, 33);
        const det = partir(ctx, v.texto, AN, 2);
        if (pintar) {
          cara(ctx, PAD, y, 128, caras.get(v.j && v.j.img), v.nombre, v.j ? POS_COLOR[v.j.pos] : color);
          ctx.font = F(700, 32, true); ctx.fillStyle = color; espaciado(ctx, 2); ctx.fillText(eti.toUpperCase(), X, y + 30); espaciado(ctx, 0);
          ctx.font = F(700, 60, true); ctx.fillStyle = C.texto; ctx.fillText(partir(ctx, v.nombre, AN, 1)[0] || '', X, y + 88);
          ctx.font = F(500, 33); ctx.fillStyle = C.texto2; det.forEach((l, i) => ctx.fillText(l, X, y + 134 + i * 42));
        }
        y += Math.max(128, 108 + det.length * 42) + 34;
      }
      if (d.vistos.length > vistos.length && pintar) { ctx.font = F(600, 34); ctx.fillStyle = C.texto2; ctx.fillText(`y ${d.vistos.length - vistos.length} más hechos`, PAD, y + 10); }
      if (d.vistos.length > vistos.length) y += 50;
    }
    if (d.ocultos.length) {
      const n = d.ocultos.length;
      const t = vistos.length ? `Y ${n} movimiento${n > 1 ? 's' : ''} más que no te cuento` : `${n} movimiento${n > 1 ? 's' : ''} en marcha que no te cuento`;
      if (pintar) {
        ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = C.linea;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PAD, y, ANCHO, 116, 24) : ctx.rect(PAD, y, ANCHO, 116); ctx.stroke(); ctx.restore();
        ctx.font = F(600, 38); ctx.fillStyle = C.texto2; ctx.fillText(`🤫  ${t}`, PAD + 36, y + 71);
      }
      y += 116 + 30;
    }
    if (!d.vistos.length && !d.ocultos.length && !(conTitular && P.titular)) {
      if (pintar) { ctx.font = F(700, 86, true); ctx.fillStyle = C.texto; ctx.fillText('Hoy toca esperar', PAD, y + 72); }
      y += 120;
    }
    return y;
  };
}

/** una noticia o un rival del plan, con su pullita */
function pullita(S, x, caraIm) {
  const que = x.tipo === 'rival' ? 'Tu rival' : x.efecto === 'sube' ? 'Noticia · sube' : x.efecto === 'baja' ? 'Noticia · baja' : 'Noticia';
  const color = x.tipo === 'rival' ? C.rojoL : x.j ? POS_COLOR[x.j.pos] : C.linea;
  return (ctx, y0, pintar, aire = 0) => {
    let y = pintar ? cabecera(ctx, y0, que, fechaCorta(S.plan.t || Date.now()), '') : y0 + 96;
    y += 44 + aire;
    const D = 200, X = PAD + D + 40, AN = W - PAD - X;
    ctx.font = F(700, 76, true);
    const nom = partir(ctx, x.nombre, AN, 2);
    if (pintar) {
      cara(ctx, PAD, y, D, caraIm, x.nombre, color);
      const alto = nom.length * 78 + (x.sub ? 50 : 0);
      let yy = y + D / 2 - alto / 2 + 64;
      ctx.fillStyle = C.texto; nom.forEach((l, i) => ctx.fillText(l, X, yy + i * 78));
      yy += (nom.length - 1) * 78;
      if (x.sub) { ctx.font = F(500, 34); ctx.fillStyle = C.texto2; ctx.fillText(partir(ctx, x.sub, AN, 1)[0] || '', X, yy + 52); }
    }
    y += D + 60;
    if (pintar) { ctx.font = F(700, 220, true); ctx.fillStyle = C.rojo; ctx.fillText('“', PAD - 10, y + 150); }
    y += 96;
    ctx.font = F(500, 50);
    const ls = partir(ctx, x.texto, ANCHO, 12);
    if (pintar) { ctx.fillStyle = C.texto; ls.forEach((l, i) => ctx.fillText(l, PAD, y + 50 + i * 68)); }
    return y + ls.length * 68 + 30;
  };
}

function datosPullita(S, k) {
  const P = S.plan, i = +k.slice(1);
  if (k[0] === 'n') {
    const n = (P.noticias || [])[i];
    if (!n) return null;
    const q = String(n.jugador || '').toLowerCase();
    const todos = Object.values((S.D && S.D.maestro) || {});
    const j = todos.find((x) => x.nombre.toLowerCase() === q) || todos.find((x) => q && x.nombre.toLowerCase().includes(q)) || null;
    const mio = j && S.M && S.M.mias.some((x) => x.pid === j.id);
    return { tipo: 'noticia', nombre: (j && j.nombre) || n.jugador || '', j, img: j && j.img, efecto: n.efecto, texto: n.texto, sub: j ? [j.equipo, POS_LARGO[j.pos], mio ? 'de mi equipo' : ''].filter(Boolean).join(' · ') : '' };
  }
  const r = (P.rivales || [])[i];
  if (!r) return null;
  const tid = S.M && S.M.teamDeManager ? S.M.teamDeManager(r.manager) : null;
  const e = tid && (S.D.clasif || []).find((x) => x.teamId === tid);
  return { tipo: 'rival', nombre: r.manager || (e && e.manager) || '', img: e && (e.avatar || e.escudo), texto: r.texto, sub: e ? [e.nombre !== e.manager ? e.nombre : '', e.pos ? `${e.pos}º` : '', e.puntos ? `${e.puntos} pts` : ''].filter(Boolean).join(' · ') : '' };
}

/**
 * La tarjeta `k` ('plan', 'n0', 'r1'…) como PNG: { url (data:…), blob (en el navegador, para compartirla dentro del
 * toque), chiva (el titular nombra algo de lo que no sale) }
 */
export async function dibujar(S, k, conTitular = null) {
  if (!S.plan) return null;
  await fuentes();
  let cv, chiva = false;
  if (k === 'plan') {
    const d = delPlan(S);
    chiva = d.chiva;
    const caras = new Map();
    await Promise.all(d.vistos.slice(0, 5).map(async (v) => { const u = v.j && v.j.img; if (u) caras.set(u, await foto(u)); }));
    cv = componer(plan(S, d, conTitular == null ? !d.chiva : conTitular, caras));
  } else {
    const x = datosPullita(S, k);
    if (!x) return null;
    cv = componer(pullita(S, x, await foto(x.img)));
  }
  const url = cv.toDataURL('image/png');
  const blob = enApp ? null : await new Promise((ok) => cv.toBlob(ok, 'image/png'));
  return { url, blob, chiva, alto: cv.height };
}

/* ---------------- la hoja de compartir y el envío ---------------- */

const puedeCompartirArchivos = () => {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; }
};

/** la hoja: qué compartir (el plan, una noticia, un rival), el titular sí o no, la imagen tal cual sale y el botón */
export function hojaTarjeta(S) {
  const T = S.tarjeta || { k: 'plan' };
  const ops = opciones(S);
  let h = `<div class="hoja-cab"><h2>Compartir</h2><button class="b-ico" data-accion="cerrarHoja" aria-label="Cerrar">${icono('cerrar')}</button></div>`;
  if (!S.plan) return `${h}<p class="t2">Cuando tengas el plan de hoy podrás mandarlo al grupo de tu liga.</p>`;
  h += '<p class="t2 peq tj-nota">Una imagen para el grupo de tu liga. Del plan solo sale lo que ya has hecho: lo que tienes en marcha no se chiva.</p>';
  if (ops.length > 1) h += `<div class="filtros tj-ops">${ops.map((o) => `<button class="${o.k === T.k ? 'activo' : ''}" data-accion="tarjetaVer" data-k="${esc(o.k)}">${icono(o.ic)}${esc(o.t)}</button>`).join('')}</div>`;
  if (T.k === 'plan' && S.plan.titular) {
    const con = T.titular == null ? !T.chiva : T.titular;
    h += `<div class="tj-tit"><button class="tj-sw ${con ? 'on' : ''}" data-accion="tarjetaTitular" aria-pressed="${con}"><i></i>Con el titular del plan</button>${T.chiva && !con ? '<span>Nombra a alguien que aún no has movido: por eso va quitado.</span>' : T.chiva ? '<span class="mal">Ojo: nombra a alguien que aún no has movido.</span>' : ''}</div>`;
  }
  h += `<div class="tj-prev">${T.url ? `<img src="${T.url}" alt="La tarjeta que vas a compartir">` : `<div class="tj-carga">${T.error ? esc(T.error) : 'Preparando la imagen…'}</div>`}</div>`;
  const web = !enApp && !puedeCompartirArchivos();
  h += `<button class="btn ancho" data-accion="tarjetaMandar" ${T.url ? '' : 'disabled'}>${icono(web ? 'descargar' : 'enviar')}${web ? 'Descargar la imagen' : 'Compartir'}</button>`;
  return h;
}

/** la manda: en la app, al menú de compartir de Android; en el navegador, al del móvil o se descarga. Devuelve qué ha pasado */
export async function mandar(T) {
  if (!T || !T.url) return 'nada';
  if (enApp) return nativo.hayImagen() && nativo.compartirImagen(T.url, '') ? 'ok' : 'sin';
  const blob = T.blob || await (await fetch(T.url)).blob();
  const archivo = new File([blob], 'fantasy-manager.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return 'ok'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'fantasy-manager.png';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return 'descargada';
}
