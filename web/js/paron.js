/* La pestaña Parón (tarea 21, Carlos, 9 nov: «una buena pestaña, que te indique cómo ganar millones y esté bien
   depurada»). Solo durante el parón de selecciones: ocupa el sitio de Directo (sin partidos no hay directo) y arriba
   lleva un selector para seguir viendo el Directo de siempre (Carlos, 12:52).
   Las cuentas son las del motor: lo de revender es `M.especular` (la misma proyección que el plan, que en el parón se
   frena más), lo que baja o sube hasta la vuelta sale de `M.inercia(pid).proy(días)` y lo que te quita del once, de
   `M.perdida`. Con «Cuándo gira un jugador» cerrada, lo que depende de la inercia va con su candado. */
import { esc, eur, cuando, dura, icono, num, DIA, HORA } from './util.js';
import { ava, candado } from './comunes.js';
import { bloqueada } from './limite.js';
import { paronLejos, cholloParon, PARON_VUELTA } from './operaciones.js';
import { tabs, cols, ancho } from './vistas.js';
import { directo } from './directo.js';

// (creados una vez: nada de formateadores de fecha dentro de los bucles)
const F_SEM = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' });
const F_DIA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'Europe/Madrid' });
const F_CLAVE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
const diaClave = (t) => F_CLAVE.format(new Date(t));
const pctTxt = (x, d = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d).replace('.', ',')} %`;

/** ¿hay parón ahora, con la jornada de vuelta por delante? (lo mismo que la tarjeta del parón de Hoy) */
export const hayParon = (M) => !!(M && M.enParon && M.proxima && M.paron && M.proxima.ini >= M.paron.ini);

/** la pestaña del sitio de Directo: en el parón, el selector Parón / Directo; si no, el Directo de siempre */
export function vistaDirecto(S) {
  if (!hayParon(S.M)) return directo(S);
  const seg = S.seg.paron || 'paron';
  // (sin pegarse arriba: Directo lleva sus propias pestañas pegadas y se montaban una encima de otra)
  const sel = tabs('paron', seg, [['paron', 'Parón'], ['directo', 'Directo']], { llenas: true }).replace('class="tabs llenas"', 'class="tabs llenas pnz-sel"');
  return sel + (seg === 'directo' ? directo(S) : paron(S));
}

/** todas las cuentas de la pestaña, aparte de cómo se pintan (también para probarlas) */
export function cuentasParon(S) {
  const { M } = S, ahora = Date.now(), v = M.proxima;
  const lejos = paronLejos(M, ahora);
  const sinI = bloqueada('inercia');
  const ventana = M.ventanaEsp || {};
  // los días que se mueve el valor hasta el último cambio de mercado que vale para vender antes de la vuelta
  const diasV = Math.max(1, ventana.diasValor || Math.round((v.ini - ahora) / DIA) - 1);
  const vender = ventana.ponerVenta && ventana.ponerVenta > ahora ? ventana.ponerVenta : null;
  const cierre = v.ini - M.VEDA_H * HORA, once = v.ini - PARON_VUELTA;
  const enPlan = (pid) => !!(S.opPorPid && S.opPorPid[pid]);
  // 1 · compra y revende (lo del mercado y las cláusulas que la app ve subiendo hasta el día de venderlo)
  const esp = (M.especular || []).slice(0, 5);
  const gana = esp.slice(0, 3).reduce((s, e) => s + e.beneficio, 0);
  const yaRevender = (M.paraRevender || []).map((x) => ({ x, ben: x.beneficioYa }));
  // 2 · vende en lo alto: lo tuyo que ha girado, se ha parado o se frena, con lo que perdería hasta la vuelta
  const altos = sinI ? [] : M.mias.filter((x) => x.j.pos !== 5).map((x) => {
    const ine = M.inercia(x.pid);
    if (!ine || !['giro', 'baja', 'parado', 'frena'].includes(ine.fase)) return null;
    if (((M.partidazo(x.pid) || {}).nivel || 0) >= 3) return null;
    const pierde = ine.proy(diasV);
    if (!(pierde < -Math.max(150000, x.j.valor * 0.012))) return null;
    return { x, ine, pierde, pts: M.perdida ? M.perdida(x.pid) : 0, plan: enPlan(x.pid) };
  }).filter(Boolean).sort((a, b) => a.pierde - b.pierde).slice(0, 6);
  const evita = altos.reduce((s, a) => s - a.pierde, 0);
  // 3 · aguanta, que sube
  // (lo que el plan de hoy manda vender, p. ej. por una oferta buena, no sale como «aguanta»: manda el plan)
  const vendePlan = (pid) => !!(S.opPorPid && S.opPorPid[pid] && S.opPorPid[pid].accion === 'vender');
  const suben = sinI ? [] : M.mias.map((x) => {
    if (vendePlan(x.pid)) return null;
    const ine = M.inercia(x.pid);
    if (!ine || !['sube', 'acelera'].includes(ine.fase)) return null;
    const g = ine.proy(diasV);
    return g >= Math.max(150000, x.j.valor * 0.01) ? { x, ine, gana: g } : null;
  }).filter(Boolean).sort((a, b) => b.gana - a.gana).slice(0, 6);
  // 4 · el once de la vuelta: chollos que ya se pueden pagar y cláusulas que se abren los días de antes de la vuelta
  const chollos = M.clausulas.filter((x) => x.abierta && x.interes >= 55 && !(M.dueno[x.pid] === (S.D.yo || {}).teamId) && cholloParon(M, x.j, x.clausula)).sort((a, b) => b.interes - a.interes).slice(0, 3);
  const seAbren = M.clausulas.filter((x) => x.interes >= 55 && !x.abierta && x.protegidoHasta > Math.min(once, ahora + DIA) - DIA && x.protegidoHasta < cierre).sort((a, b) => a.protegidoHasta - b.protegidoHasta).slice(0, 4);
  // con la vuelta cerca: las abiertas que merecen la pena y te llegan
  const paraOnce = lejos ? [] : M.clausulas.filter((x) => x.abierta && x.interes >= 60 && x.meLlega).sort((a, b) => b.interes - a.interes).slice(0, 4);
  // que no te los quiten: cláusula abierta y riesgo alto
  const peligro = M.mias.filter((x) => x.abierta && x.riesgo === 'alto').slice(0, 4);
  const escudos = (M.escudosMios || {}).quedan || 0;
  return { v, lejos, sinI, diasV, vender, cierre, once, esp, gana, yaRevender, altos, evita, suben, chollos, seAbren, paraOnce, peligro, escudos, enPlan };
}

function paron(S) {
  const { M } = S, ahora = Date.now();
  const c = cuentasParon(S), v = c.v;
  // (días enteros que faltan, como «12 d 1 h» de la tarjeta de Hoy)
  const dias = Math.max(1, Math.floor((v.ini - ahora) / DIA));
  // las secciones se numeran según salen (con la vuelta cerca no hay «compra y revende» ni «vende en lo alto»)
  let nSec = 0;
  const nxt = () => ++nSec;
  // (en las tarjetas, «En tu plan»; en las filas, que van justas, «Plan»)
  const planTag = (pid, largo = false) => (c.enPlan(pid) ? `<span class="pnz-t en-plan">${largo ? 'En tu plan' : 'Plan'}</span>` : '');

  // la cabecera y los días del parón
  const kpis = c.lejos
    ? [['Puedes ganar', c.gana > 0 ? `+${eur(c.gana)}` : '—', c.gana > 0 ? 'mas' : '', c.esp.length ? `revendiendo ${Math.min(3, c.esp.length)}` : 'nada que suba hoy'],
      ['Evitas perder', c.sinI ? icono('candado') : c.evita > 0 ? eur(c.evita) : '—', c.evita > 0 ? 'menos' : '', c.sinI ? 'función top' : c.altos.length ? `vendiendo ${c.altos.length}` : 'nada ha girado'],
      ['Puedes gastar', eur(M.pujaMax), '', 'pujando, con la deuda que te dejan']]
    : [['Cláusulas, hasta', cuando(c.cierre), '', 'luego, cerradas'], ['Para revender', c.yaRevender.length ? `${c.yaRevender.length}` : '—', '', c.yaRevender.length ? 'véndelo ya' : 'nada pendiente'], ['Jornada', `${v.n}`, '', cuando(v.ini)]];
  const marcas = {};
  const marca = (t, cls, txt) => { if (t && t > ahora - DIA) { const k = diaClave(t); if (!marcas[k]) marcas[k] = [cls, txt]; } };
  marca(v.ini, 'd-vuelta', `Vuelve la J${v.n}`);
  marca(c.cierre, 'd-cierre', 'Cierran cláusulas');
  marca(c.vender, 'd-vende', 'Vende lo de revender');
  if (c.lejos) marca(c.once, 'd-once', 'Piensa en el once');
  // solo los días que cuentan (hoy y los marcados): todos los días del parón no cabían y lo importante quedaba fuera
  const hoyK = diaClave(ahora);
  const dias2 = [[ahora, ...(marcas[hoyK] || ['', c.lejos ? 'Compra lo que sube' : 'Prepara el once'])]];
  for (let k = 1; k <= dias + 1 && k < 16; k++) { const t = ahora + k * DIA, m = marcas[diaClave(t)]; if (m) dias2.push([t, ...m]); }
  const chips = dias2.map(([t, cls, txt], i) => `<div class="pnz-dia ${cls} ${i === 0 ? 'es-hoy' : ''}"><small>${i === 0 ? 'hoy' : esc(F_SEM.format(new Date(t)).replace('.', ''))}</small><b>${esc(F_DIA.format(new Date(t)))}</b><i>${esc(txt)}</i></div>`);
  const hero = `<div class="pnz-hero"><div class="pnz-top">${icono('bandera')}<span>Parón de selecciones</span><em>vuelve ${esc(cuando(v.ini))}</em></div>
    <h1>${c.lejos ? `${dias} días sin LaLiga: a por los millones` : `Vuelve LaLiga en ${esc(dura(v.ini - ahora))}: prepara el once`}</h1>
    <p>${c.lejos ? `Nadie puntúa hasta la jornada ${v.n}. Lo que hagas estos días se mide en dinero: compra lo que sube, véndelo antes de la vuelta y no te quedes con lo que va a bajar.` : `Las cláusulas se cierran ${esc(cuando(c.cierre))} y se reabren con el primer partido.${c.yaRevender.length ? ' Lo de revender, véndelo ya: tienes que empezar la jornada con saldo positivo.' : ' Empieza la jornada con saldo positivo o no puntúas.'}`}</p>
    <div class="pnz-kpis">${kpis.map(([a, b, cls, s]) => `<div><small>${esc(a)}</small><b class="${cls}">${b}</b><span>${esc(s)}</span></div>`).join('')}</div></div>
    <div class="pnz-cal" aria-label="Los días del parón">${chips.join('')}</div>`;

  const sec = (n, t, sub, tot, cls, mas) => `<div class="pnz-sec"><span class="n">${n}</span><h2>${t}</h2>${tot ? `<span class="tot ${cls}">${tot}</span>` : ''}${mas || ''}</div>${sub ? `<p class="pnz-sub">${sub}</p>` : ''}`;
  const vacio = (t) => `<div class="pnz-vacio">${t}</div>`;
  const fila = (j, n, s, g, gcls, gsub, extra = '') => `<button class="pnz-f" data-j="${esc(j.id)}">${ava(j, 'm')}<span class="pnz-fc"><span class="n">${esc(n)}${extra}</span><span class="s">${s}</span></span><span class="g ${gcls}">${g}${gsub ? `<small>${esc(gsub)}</small>` : ''}</span></button>`;
  const conf = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' };
  const vendeDia = c.vender ? `el ${cuando(c.vender, { hora: false })}` : 'antes de la vuelta';

  // 1 · compra y revende
  let s1 = '';
  if (c.lejos) {
    s1 = sec(nxt(), 'Compra y revende', `Suben cada día y da tiempo a venderlos antes de la J${v.n}: ponlos a la venta ${esc(vendeDia)} y acepta la oferta del cambio de mercado siguiente.`, c.gana > 0 ? `+${eur(c.gana)}` : '', 'mas', '<button class="mas" data-ir="mercado" data-seg="mercado:especular">Todos</button>');
    const maxB = Math.max(1, ...c.esp.map((e) => e.beneficio));
    s1 += c.esp.length ? c.esp.map((e, i) => `<button class="pnz-c" data-j="${esc(e.pid)}">${ava(e.j, 'm')}<span class="pnz-cc"><span class="n">${esc(e.j.nombre)}</span><span class="s">${esc(e.j.equipo || '')} · ${e.origen === 'mercado' ? `puja ${eur(e.puja || e.precio)}` : `cláusula ${eur(e.precio)}`}</span></span>
        <span class="g"><b class="mas">+${eur(e.beneficio)}</b><small>${pctTxt(e.pct * 100, 0)} en ${e.dias} días</small></span>
        <span class="pnz-barra"><span>${pctTxt(e.r * 100)}/día</span><span class="tr"><i style="width:${Math.max(6, Math.round((e.beneficio / maxB) * 100))}%"></i></span><span>valdrá ${eur(e.valorFuturo)}</span></span>
        <span class="pie"><span class="pnz-t ${e.origen === 'mercado' ? 'mer' : 'cl'}">${e.origen === 'mercado' ? 'Mercado' : `Cláusula de ${esc((e.rival && (e.rival.manager || e.rival.nombre)) || 'un rival')}`}</span><span class="pnz-t ${esc(e.confianza)}">${conf[e.confianza] || ''}</span>${e.vuelve ? `<span class="pnz-t vu">Vuelve: valía ${eur(e.vuelve.max)}</span>` : ''}${planTag(e.pid, true)}${i === 0 && !c.enPlan(e.pid) ? '<span class="pnz-t alta">El mejor</span>' : ''}</span></button>`).join('')
      : vacio('Hoy no hay nada que suba lo bastante como para revenderlo antes de la vuelta. Con el mercado nuevo se vuelve a mirar.');
  }
  // lo que ya compraste para revender
  if (c.yaRevender.length) {
    s1 += `${c.lejos ? '<div class="pnz-mini">Lo que ya tienes para revender</div>' : sec(nxt(), 'Vende lo de revender', `Ponlo a la venta ya y acepta la oferta antes de la jornada ${v.n}: si empieza con saldo negativo, no puntúas.`, '', '')}<div class="pnz-lista">${c.yaRevender.map(({ x, ben }) => fila(x.j, x.j.nombre, `Lo compraste a ${eur(x.rev.precio || x.compra || x.j.valor)} · vale ${eur(x.j.valor)}`, `${ben >= 0 ? '+' : '−'}${eur(Math.abs(ben))}`, ben >= 0 ? 'mas' : 'menos', c.lejos ? `vender ${vendeDia}` : 'véndelo ya', planTag(x.pid))).join('')}</div>`;
  }

  // 2 · vende en lo alto y 3 · aguanta, que sube (con la inercia cerrada, su candado)
  let s2 = '', s3 = '';
  if (c.lejos) {
    if (c.sinI) s2 = sec(nxt(), 'Vende en lo alto', 'Lo tuyo que ya ha tocado techo y lo que sigue subiendo hasta la vuelta.', '', '') + candado('inercia');
    else {
      s2 = sec(nxt(), 'Vende en lo alto', `Tuyos que ya han tocado techo. Quedan ${dias} días para reponerlos: lo que bajen hasta la vuelta lo pierdes.`, c.altos.length ? `−${eur(c.evita)}` : '', 'menos')
        + (c.altos.length ? `<div class="pnz-lista">${c.altos.map(({ x, ine, pierde, pts }) => fila(x.j, x.j.nombre,
          `<b class="${ine.fase === 'giro' || ine.fase === 'baja' ? 'baja' : 'oro'}">${ine.fase === 'giro' || ine.fase === 'baja' ? 'Ya baja' : ine.fase === 'parado' ? 'Parado' : 'Frena'}</b> · Vale ${eur(x.j.valor)}${x.ganado != null ? ` · ${x.ganado >= 0 ? 'ganas' : 'pierdes'} ${eur(Math.abs(x.ganado))} con lo que pagaste` : ''}${pts >= 0.3 ? ` · te da ${String(Math.round(pts * 10) / 10).replace('.', ',')} pts/jornada` : ''}`,
          `−${eur(-pierde)}`, 'menos', 'si esperas a la vuelta',
          planTag(x.pid))).join('')}</div>` : vacio('Nada de lo tuyo ha tocado techo: puedes aguantar.'));
      s3 = sec(nxt(), 'Aguanta, que sube', 'Siguen subiendo: no los vendas todavía, se revalorizan solos hasta la vuelta.', c.suben.length ? `+${eur(c.suben.reduce((s, o) => s + o.gana, 0))}` : '', 'mas')
        + (c.suben.length ? `<div class="pnz-lista">${c.suben.map(({ x, gana: g }) => fila(x.j, x.j.nombre, `Vale ${eur(x.j.valor)}${x.tend && x.tend.p7 != null ? ` · ${pctTxt(x.tend.p7)} en 7 días` : ''}`, `+${eur(g)}`, 'mas', 'hasta la vuelta')).join('')}</div>` : vacio('Ninguno de los tuyos está subiendo ahora.'));
    }
  }

  // 4 · el once de la vuelta
  const filasOnce = [
    ...c.chollos.map((x) => fila(x.j, x.j.nombre, `Chollo: cláusula ${eur(x.clausula)}, vale ${eur(x.j.valor)}`, 'ya', '', x.meLlega ? 'te llega' : 'no te llega', ` <span class="pnz-t">de ${esc(x.rival.manager || x.rival.nombre)}</span>${planTag(x.pid)}`)),
    ...c.paraOnce.filter((x) => !c.chollos.includes(x)).map((x) => fila(x.j, x.j.nombre, `Cláusula ${eur(x.clausula)}, vale ${eur(x.j.valor)}`, 'abierta', '', `interés ${x.interes}`, ` <span class="pnz-t">de ${esc(x.rival.manager || x.rival.nombre)}</span>${planTag(x.pid)}`)),
    ...c.seAbren.map((x) => fila(x.j, x.j.nombre, `Se abre ${esc(cuando(x.protegidoHasta))} · ${eur(x.clausula)}`, `${x.interes}`, '', `interés · ${x.meLlega ? 'te llega' : 'no te llega'}`, ` <span class="pnz-t">de ${esc(x.rival.manager || x.rival.nombre)}</span>`)),
  ];
  const s4 = sec(nxt(), 'El once de la vuelta', c.lejos ? `Desde el ${esc(cuando(c.once, { hora: false }))}. Antes, solo si es un chollo: a su valor y sin bajar. Las cláusulas se cierran ${esc(cuando(c.cierre))}.` : `Lo que merece la pena y te llega antes de que se cierren las cláusulas (${esc(cuando(c.cierre))}).`, '', '', '<button class="mas" data-ir="equipo">Tu once</button>')
    + (filasOnce.length ? `<div class="pnz-lista">${filasOnce.join('')}</div>` : vacio('Ninguna cláusula interesante se abre antes de la vuelta. Mira el mercado los últimos días.'));

  // que no te los quiten
  const s5 = c.peligro.length ? sec('!', 'Que no te los quiten', `Cláusula abierta y algún rival con dinero: en el parón también se clausula.${c.escudos ? ` Te quedan ${c.escudos} blindaje${c.escudos > 1 ? 's' : ''} gratis.` : ''}`, '', '')
    + `<div class="pnz-lista">${c.peligro.map((x) => fila(x.j, x.j.nombre, `Cláusula ${eur(x.clausula)} · vale ${eur(x.j.valor)}`, c.escudos ? 'Blíndalo' : 'Súbela', 'oro', c.escudos ? 'gratis' : (x.blindaje && x.blindaje.coste ? eur(x.blindaje.coste) : ''), planTag(x.pid))).join('')}</div>` : '';

  const nota = `<div class="pnz-nota"><b>Las reglas del parón.</b> Puedes bajar hasta −${eur(M.deuda)} pujando en el mercado; las cláusulas, solo con saldo. Lo único obligatorio es empezar la jornada ${v.n} en positivo: vende lo de revender ${esc(vendeDia)} y acepta las ofertas antes de que empiece (${esc(cuando(v.ini))}). Los que van con su selección pueden volver tocados: mira las noticias antes de pensar en el once.</div>`;
  void num;
  if (ancho()) return cols(hero + s1 + s2, s3 + s4 + s5 + nota);
  return `<div class="pnz">${hero}${s1}${s2}${s3}${s4}${s5}${nota}</div>`;
}
