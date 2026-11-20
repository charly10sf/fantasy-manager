/* Lo que toca hoy (la lista «Ahora mismo» de Hoy, `M.acciones`) y a quién vender por la inercia de su valor, con sus
   textos. Estaba dentro de motor.js (17 nov: motor.js, solo cálculos); el motor sigue llamándolo al final de `analizar`,
   así que `M.acciones` está donde siempre. `ventasInercia` lo usan Hoy y los avisos con la app cerrada (fondo.js): los
   dos dicen lo mismo de quién vender. */
import { eur, pct, dura, cuando, DIA, HORA } from './util.js';
import { paronLejos } from './operaciones.js';
import { esClausulable } from './motor.js';

const MALOS = new Set(['injured', 'suspended', 'out_of_league']);
const P7 = (t) => (!t ? null : t.p7e !== undefined ? t.p7e : t.p7);

/**
 * los míos que hay que poner a la venta por la inercia de su valor, de lo que más pierde a lo que menos: lo que ha girado
 * a la baja ya; lo que está a punto de girar, antes de que gire. Los que ya están en venta no (ahí manda la oferta que
 * tengan, en «Tus jugadores en venta»), ni los de baja (tienen su propio aviso), ni los que aún no han girado con la
 * cláusula abierta por encima de LaLiga y algún rival que la paga (mejor esperar a que te la paguen)
 */
export function ventasInercia(M) {
  return (M.mias || []).filter((x) => x.ventaInercia && !M.vendeBaja(x) && !M.enVenta.has(x.pid) && !(x.ventaInercia.urgencia !== 'ya' && M.esperarVenta(x).tipo === 'clausula'))
    .sort((a, b) => b.ventaInercia.perder - a.ventaInercia.perder);
}

export function acciones(D, M, c) {
  const out = [];
  const ahora = Date.now();
  const add = (x) => out.push(x);
  const inicio = M.proxima ? M.proxima.ini : null;

  if (M.negativo) {
    add({
      tipo: 'saldo', prio: 100, icono: 'alerta', cuando: inicio ? `La jornada empieza ${cuando(inicio)}` : 'Ahora',
      titulo: `Estás en negativo: ${eur(D.dinero)}`,
      texto: `Si la jornada empieza con el saldo en negativo, no puntúas. Vende o espera a una oferta antes${inicio ? ` (${dura(inicio - ahora)})` : ''}.`,
      hash: 'equipo',
    });
  }

  // las que merecen la pena (abiertas ya o que se abren pronto: los mismos filtros, para que al empezar el cierre no
  // salgan de golpe las caras que antes estaban descartadas)
  const clausulable = (x) => esClausulable(M, x, ahora);
  const abiertas = M.clausulas.filter((x) => x.abierta && clausulable(x))
    .sort((a, b) => (b.interes + (b.teQueda >= 0 ? 8 : 0)) - (a.interes + (a.teQueda >= 0 ? 8 : 0)));
  // (21 nov, Carlos: «si un jugador hace muchísimos puntos… y tiene la cláusula abierta, que te salga clausúlalo ya») el que
  // acaba de hacer un partidazo sube los días siguientes bastante más de lo que dice la inercia (medido con su liga: tras
  // 10 o más, +5,5 puntos porcentuales en 3 días): va el primero y lo dice
  const tras = (x) => { const e = M.efectoPartido ? M.efectoPartido(x.pid) : null; return e && e.etapa === 0 && e.e3 >= 0.03 ? e : null; };
  abiertas.slice(0, 3).forEach((x, k) => add({
    tipo: 'clausular', prio: 90 - k * 3 + x.interes / 20 + (tras(x) ? 6 : 0), icono: 'diana', pid: x.pid, cuando: 'Ya',
    titulo: `Clausula a ${x.j.nombre}`,
    texto: `${tras(x) ? `Acaba de hacer ${tras(x).pts} puntos: tras un partido así, los de su precio suben de media un ${pct(tras(x).e3 * 100, 1, false)} en 3 días. ` : ''}De ${x.rival.nombre}. Cláusula ${eur(x.clausula)}, vale ${eur(x.j.valor)}${x.por.length ? `: ${x.por.slice(0, 2).join(', ')}` : ''}. ${x.teQueda >= 0 ? `Te quedarías con ${eur(x.teQueda)}.` : `Te quedarías en ${eur(x.teQueda)}: tendrías que vender antes de que empiece la jornada.`}${M.compraCal(x.j, x.clausula).txt ? ` ${M.compraCal(x.j, x.clausula).txt}` : ''}${(() => { const s = M.salida(x.j, x.clausula, x.tend); return s && s.pierde > 0 ? ` ${s.txt[0].toUpperCase()}${s.txt.slice(1)}.` : ''; })()}`,
  }));

  const pronto = M.clausulas.filter((x) => !x.abierta && x.abreEn < 30 * HORA && clausulable(x));
  pronto.sort((a, b) => a.abreEn - b.abreEn).slice(0, 3).forEach((x, k) => add({
    tipo: 'pronto', prio: 75 - k * 2, icono: 'reloj', pid: x.pid, cuando: cuando(x.protegidoHasta),
    titulo: `Se abre la cláusula de ${x.j.nombre}`,
    texto: `En ${dura(x.abreEn)}${x.escudo ? ' (lo ha blindado su dueño)' : ''}. Es de ${x.rival.nombre} y cuesta ${eur(x.clausula)} (vale ${eur(x.j.valor)}). Te aviso al momento si tienes los avisos puestos.`,
  }));

  // blindar gratis a los tuyos (el escudo, viendo un anuncio): los importantes con la cláusula abierta y algún rival
  // que la puede pagar; antes que gastar en subirla
  const ES = M.escudosMios || { quedan: 0 };
  const paraEscudo = (M.paraEscudo || []).map((pid) => M.mias.find((x) => x.pid === pid)).filter(Boolean);
  paraEscudo.forEach((x, k) => {
    const quien = [...x.pagan.seguro, ...x.pagan.quiza].slice(0, 3).map((y) => y.nombre).join(', ');
    add({
      tipo: 'escudo', prio: 84 - k, icono: 'escudo', pid: x.pid, cuando: 'Ahora',
      titulo: `Blinda a ${x.j.nombre} (gratis)`,
      texto: `Su cláusula (${eur(x.clausula)}) está abierta y le llega a ${quien}. Con el blindaje de LaLiga (viendo un anuncio) queda protegida ${M.ESCUDO_H} h, hasta ${cuando(ahora + M.ESCUDO_H * HORA)}. Te quedan ${ES.quedan} esta jornada.`,
    });
  });

  M.mias.filter((x) => x.riesgo === 'alto' && x.importa && !x.escudo && !M.paraEscudo.includes(x.pid) && !(x.blindaje && (x.blindaje.caro || x.blindaje.yaVale)) && !(x.pagan && x.pagan.hayDatos && !x.pagan.seguro.length && !x.pagan.quiza.length))
    .sort((a, b) => b.pierde - a.pierde).slice(0, 2).forEach((x, k) => {
      const cerca = x.ratio < 1.05 ? `está en su valor (${eur(x.j.valor)})` : `solo pasa un ${pct((x.ratio - 1) * 100, 0)} de su valor (${eur(x.j.valor)})`;
      const quien = x.pagan && (x.pagan.seguro.length || x.pagan.quiza.length) ? ` Le llega a ${[...x.pagan.seguro, ...x.pagan.quiza].slice(0, 3).map((y) => y.nombre).join(', ')}${x.pagan.seguro.length + x.pagan.quiza.length > 3 ? ' y más' : ''}.` : '';
      const justo = x.blindaje && !x.blindaje.yaVale ? ` Subirla a ${eur(x.blindaje.objetivo)} te cuesta ${eur(x.blindaje.coste)}.` : '';
      add({
        tipo: 'blindar', prio: 80 - k * 2, icono: 'escudo', pid: x.pid, cuando: x.abierta ? 'Ahora' : cuando(x.protegidoHasta),
        titulo: `Protege a ${x.j.nombre}`,
        texto: `${x.abierta ? 'Cláusula abierta' : `Se abre en ${dura(x.abreEn)}`}: ${eur(x.clausula)}, que ${cerca}, y te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada.${quien}${justo}`,
      });
    });

  // la inercia: lo que ha girado a la baja se vende ya; lo que está a punto de girar, antes de que gire
  // (los que ya están en venta no: ahí manda la oferta que tengan, en «Tus jugadores en venta»)
  // (si la cláusula está abierta por encima de LaLiga y a algún rival le llega, y aún no ha girado, no se manda vender: espera a que te la paguen)
  ventasInercia(M).slice(0, 3).forEach((x, k) => {
    const vi = x.ventaInercia, pierde = M.perdida(x.pid);
    add({
      tipo: 'vender', prio: (vi.urgencia === 'ya' ? 86 : 68) - k, icono: 'hucha', pid: x.pid, cuando: vi.urgencia === 'ya' ? 'Hoy' : 'Antes de que gire',
      titulo: vi.urgencia === 'ya' ? `Vende a ${x.j.nombre}: ha girado a la baja` : `Vende a ${x.j.nombre} antes de que gire`,
      texto: `${vi.texto}${pierde >= 0.3 ? ` Es titular en tu once (${String(Math.round(pierde * 10) / 10).replace('.', ',')} pts por jornada): busca quién lo sustituya.` : ' No es imprescindible en tu once.'}${x.compra ? ` Lo pagaste a ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}).` : ''}${M.esperarVenta(x).nota ? ` ${M.esperarVenta(x).nota}` : ''}`,
    });
  });

  // los importantes que están a tiro pero cuyo blindaje no compensa: para que lo sepas, sin urgencias
  M.mias.filter((x) => x.riesgo === 'alto' && x.importa && !x.escudo && !M.paraEscudo.includes(x.pid) && x.blindaje && x.blindaje.caro && x.abierta).sort((a, b) => b.pierde - a.pierde).slice(0, 2).forEach((x) => add({
    tipo: 'riesgo', prio: 58, icono: 'escudo', pid: x.pid, cuando: 'Ojo',
    titulo: `${x.j.nombre} está a tiro de ${x.pagan.seguro.length + x.pagan.quiza.length} rivales`,
    texto: `Cláusula ${eur(x.clausula)} (vale ${eur(x.j.valor)}). Subirle la cláusula hasta que no le llegue a nadie costaría ${eur(x.blindaje.coste)}: no compensa. Si te lo quitan, cobras la cláusula; ten pensado su sustituto (te da ${String(Math.round(x.pierde * 10) / 10).replace('.', ',')} pts por jornada).`,
  }));

  M.mias.filter((x) => M.vendeBaja(x)).slice(0, 2).forEach((x) => add({
    tipo: 'vender', prio: 60, icono: 'lesion', pid: x.pid, cuando: 'Esta semana',
    titulo: `${x.j.nombre}: ${x.j.estado === 'injured' ? 'lesionado' : x.j.estado === 'suspended' ? 'sancionado' : 'fuera de LaLiga'}`,
    texto: `${M.deBaja(x.j) ? `${M.bajaTxt(x.j)}: no` : 'Sancionado una jornada, pero su valor cae deprisa: no'} te va a puntuar${x.tend.p7 != null && x.tend.p7 < 0 ? ` y baja ${pct(Math.abs(x.tend.p7), 1, false)} en 7 días` : ''}. Plantéate venderlo antes de que pierda más valor.`,
  }));
  // una sanción de un partido: se pierde la jornada y se aguanta (salvo que haya otra razón para venderlo, que va aparte)
  M.mias.filter((x) => M.sancionCorta(x.j) && !M.vendeBaja(x) && !x.ventaInercia && !(x.ganado > 0 && P7(x.tend) != null && P7(x.tend) < -3) && !M.enVenta.has(x.pid)).slice(0, 2).forEach((x) => add({
    tipo: 'alinear', prio: 56, icono: 'lesion', pid: x.pid, cuando: (M.sancion(x.j) || {}).jornada ? `Jornada ${M.sancion(x.j).jornada}` : 'Próxima jornada',
    titulo: `${x.j.nombre}: sancionado una jornada`,
    texto: `${M.sancionCortaTxt(x.j)} Si está en tu once, pon a otro.`,
    hash: 'equipo',
  }));

  M.mias.filter((x) => !x.ventaInercia && (M.partidazo(x.pid) || {}).nivel !== 2 && (M.partidazo(x.pid) || {}).nivel !== 3 && x.ganado > 0 && P7(x.tend) != null && P7(x.tend) < -3 && !M.vendeBaja(x) && !M.esperarVenta(x).tipo).slice(0, 2).forEach((x) => add({
    tipo: 'vender', prio: 50, icono: 'hucha', pid: x.pid, cuando: 'Antes de que baje más',
    titulo: `Vende a ${x.j.nombre} con beneficio`,
    texto: `Lo compraste por ${eur(x.compra)} y vale ${eur(x.j.valor)} (${eur(x.ganado, { signo: true })}), pero lleva ${pct(Math.abs(x.tend.p7), 1, false)} de bajada en 7 días.${M.esperarVenta(x).nota ? ` ${M.esperarVenta(x).nota}` : ''}`,
  }));

  M.mercado.filter((m) => !m.miPuja && m.veredicto === 'chollo' && m.meLlega && (m.puja || m.precio) <= M.pujaMax && !M.dueno[m.pid] && M.compraCal(m.j, m.puja || m.precio).ok).slice(0, 2).forEach((m, k) => add({
    tipo: 'pujar', prio: 55 - k, icono: 'mercado', pid: m.pid, cuando: m.cierra ? `Cierra ${cuando(m.cierra)}` : 'Hoy',
    titulo: `Puja por ${m.j.nombre}`,
    texto: `Está a ${eur(m.precio)}${m.sobre <= 0.005 ? ', lo que vale' : ` (un ${Math.round(m.sobre * 100)} % sobre su valor)`}${m.por.length ? `: ${m.por.slice(0, 2).join(', ')}` : ''}.${m.pujas ? ` Lleva ${m.pujas} puja${m.pujas > 1 ? 's' : ''}.` : ''}${M.compraCal(m.j, m.puja || m.precio).txt ? ` ${M.compraCal(m.j, m.puja || m.precio).txt}` : ''}`,
  }));

  if (paronLejos(M, ahora)) add({
    tipo: 'paron', prio: 45, icono: 'bandera', cuando: `Hasta ${cuando(M.proxima.ini, { hora: false })}`,
    titulo: 'Parón: toca sacar dinero',
    texto: `No hay LaLiga hasta la jornada ${M.proxima.n} (${cuando(M.proxima.ini)}) y nadie puntúa, así que manda el dinero: compra lo que sube para venderlo antes de la vuelta y vende en lo alto lo que va a girar. Clausular para el once, solo un chollo o en los dos o tres días antes de la jornada.`,
  });
  if (M.paron && M.paron.ini > ahora && M.paron.ini - ahora < 12 * DIA) add({
    tipo: 'paron', prio: 40, icono: 'bandera', cuando: `Desde ${cuando(M.paron.ini, { hora: false })}`,
    titulo: M.paron.nombre,
    texto: `Del ${cuando(M.paron.ini, { hora: false })} al ${cuando(M.paron.fin, { hora: false })}. En los parones los valores se mueven menos y hay riesgo de lesiones con las selecciones: buen momento para vender a los que están arriba y comprar barato para la vuelta.`,
  });

  if (inicio && inicio - ahora < 26 * HORA && inicio > ahora) add({
    tipo: 'alinear', prio: 70, icono: 'campo', cuando: cuando(inicio),
    titulo: `Revisa tu alineación: jornada ${M.proxima.n}`,
    texto: `Empieza en ${dura(inicio - ahora)}.${M.mias.some((x) => MALOS.has(x.j.estado) || x.j.estado === 'doubtful') ? ` Tienes ${M.mias.filter((x) => MALOS.has(x.j.estado) || x.j.estado === 'doubtful').map((x) => x.j.nombre).slice(0, 3).join(', ')} tocados.` : ''}`,
    hash: 'equipo',
  });

  // las alineaciones confirmadas: los tuyos que se quedan en el banquillo o no van, si aún se puede cambiar el once:
  // LaLiga lo cierra con el primer partido de la jornada, no con el suyo (aviso de Domy, 31 oct)
  const cierreOnce = (t, eq) => { const jo = (M.jornadas || []).find((x) => x.partidos.some((p) => Math.abs(p.fecha - t) < 3 * HORA && String(eq) && (String(p.localId) === String(eq) || String(p.visitanteId) === String(eq)))); return jo ? jo.ini : t; };
  const noJuegan = M.mias.filter((x) => { const a = M.alineacion(x.pid); return a && a.estado !== 'titular' && a.ini > ahora && cierreOnce(a.ini, x.j.equipoId) > ahora && !(a.estado === 'nosale' && MALOS.has(x.j.estado)); });
  if (noJuegan.length) add({
    tipo: 'alinear', prio: 75, icono: 'campo', cuando: cuando(Math.min(...noJuegan.map((x) => M.alineacion(x.pid).ini))),
    titulo: noJuegan.length === 1 ? `${noJuegan[0].j.nombre} no es titular` : `${noJuegan.length} de los tuyos no son titulares`,
    texto: `${noJuegan.map((x) => { const a = M.alineacion(x.pid); return `${x.j.nombre}, ${a.estado === 'suplente' ? 'suplente' : a.estado === 'nosale' ? 'no sale de titular' : a.estado === 'baja' ? 'de baja' : 'no convocado'} (juega ${cuando(a.ini)})`; }).join('; ')}. ${noJuegan.length === 1 ? 'Si lo tienes en el once, cámbialo' : 'Si los tienes en el once, cámbialos'} antes de ${cuando(Math.min(...noJuegan.map((x) => cierreOnce(M.alineacion(x.pid).ini, x.j.equipoId))))}, cuando empieza la jornada y LaLiga cierra el once.`,
    hash: 'equipo',
  });

  return out.sort((a, b) => b.prio - a.prio);
}
