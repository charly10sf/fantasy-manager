/* La IA trabajando con la app cerrada. Android abre la web sin pantalla (index.html?fondo=1) cada 3 horas y unos
   minutos después de cada cambio de mercado; aquí se decide qué contar con una notificación: el plan nuevo, las
   ofertas que llegan por tus jugadores, los que te quitan o fichas y la sesión caducada. Cada aviso, una vez. */
import { LS, eur, pct, diaDe } from './util.js';

export const EN_FONDO = /[?&]fondo=1\b/.test(location.search);
export const cfgFondo = () => ({ on: true, ...LS.get('cfg-fondo', {}) });
export const guardarCfgFondo = (c) => LS.set('cfg-fondo', { ...cfgFondo(), ...c });
/** lo que pasó la última vez en segundo plano (para Ajustes y el diagnóstico) */
export const ultimoFondo = () => LS.get('fondo-ultimo', null);

/** de noche no se hace nada (de 1:00 a 7:59) y no se avisa (de 23:30 a 7:59) */
export const deNoche = (d = new Date()) => d.getHours() >= 1 && d.getHours() < 8;
export const callado = (d = new Date()) => d.getHours() < 8 || (d.getHours() === 23 && d.getMinutes() >= 30);

const ACC = { aceptar: 'Aceptar oferta', vender: 'Vender', clausular: 'Clausular', pujar: 'Pujar', blindar: 'Proteger', alinear: 'Alinear', esperar: 'Esperar' };

/** el plan en una notificación: el titular y los pasos de hoy, numerados */
export function avisoPlan(P, conIA) {
  const ops = (P.ops || []).filter((o) => o.hoy !== false && o.accion !== 'esperar').slice(0, 5);
  const pasos = ops.map((o, i) => `${i + 1}. ${o.etiqueta || ACC[o.accion] || o.accion}${o.jugador ? ` ${o.jugador}` : ''}${o.importe ? ` (${eur(o.importe)})` : ''}`);
  return {
    k: `plan:${P.t || diaDe()}`,
    titulo: conIA ? `Tu plan: ${P.titular || 'listo'}` : `Plan de hoy (sin IA): ${P.titular || ''}`.trim(),
    texto: pasos.length ? pasos.join('\n') : 'Hoy no hace falta tocar nada.',
    hash: 'hoy',
  };
}

/** lo que ha cambiado desde la última vez que se miró tu liga */
export function avisosNuevos(antes, D, M) {
  const out = [];
  const yo = D.yo && D.yo.teamId;
  const misAntes = new Set(((antes && antes.plantillas && antes.plantillas[yo]) || []).map((f) => f.pid));
  const misAhora = new Set(((D.plantillas && D.plantillas[yo]) || []).map((f) => f.pid));
  const misma = antes && antes.liga && D.liga && antes.liga.id === D.liga.id && !antes.demo && misAntes.size;
  if (misma) {
    for (const pid of misAntes) {
      if (misAhora.has(pid)) continue;
      const j = M.J(pid) || { nombre: 'un jugador' };
      const a = (M.actividad || []).find((x) => x.pid === pid && x.t >= (antes.t || 0) - 3600e3);
      if (a && a.clase === 'clausula' && !a.esYo) out.push({ k: `perdido:${pid}:${a.id}`, titulo: `Te han clausulado a ${j.nombre}`, texto: `${a.quien || 'Un rival'} ha pagado ${eur(a.importe)}. Mira el plan para reponerlo.`, hash: 'equipo' });
      else out.push({ k: `sale:${pid}:${diaDe()}`, titulo: `${j.nombre} ya no está en tu equipo`, texto: a && a.importe ? `Vendido por ${eur(a.importe)}.` : 'Se ha vendido.', hash: 'equipo' });
    }
    for (const pid of misAhora) {
      if (misAntes.has(pid)) continue;
      const j = M.J(pid) || { nombre: 'un jugador', valor: 0 };
      out.push({ k: `entra:${pid}:${diaDe()}`, titulo: `Has fichado a ${j.nombre}`, texto: `Vale ${eur(j.valor)}. Ya cuenta para tu once.`, hash: 'equipo' });
    }
  }
  for (const v of M.misVentas || []) {
    for (const o of v.ofertas || []) {
      const mejor = v.mejor && v.mejor === o;
      out.push({
        k: `oferta:${v.pid}:${o.id || o.importe}`,
        titulo: `Oferta por ${v.j.nombre}: ${eur(o.importe)}`,
        texto: `De ${o.de}${o.sobre != null ? ` · ${pct(o.sobre * 100)} sobre su valor` : ''}.${mejor && v.consejo === 'aceptar' ? ' Te conviene aceptarla.' : mejor && v.porque ? ` ${v.porque}` : ''}`,
        hash: 'equipo',
      });
    }
  }
  return out;
}

/** se queda con los que no se han avisado aún (y apunta los nuevos como avisados si no es de noche) */
export function sinAvisar(lista, { apuntar = true } = {}) {
  const vistos = LS.get('fondo-avisados', {});
  const ahora = Date.now();
  for (const k of Object.keys(vistos)) if (ahora - vistos[k] > 10 * 86400e3) delete vistos[k];
  const nuevos = lista.filter((a) => !vistos[a.k]);
  if (apuntar) { for (const a of nuevos) vistos[a.k] = ahora; LS.set('fondo-avisados', vistos); }
  return nuevos;
}

/** con la app abierta lo ves tú: se apunta como avisado para que luego no llegue la notificación */
export function marcarVistos(lista) { sinAvisar(lista, { apuntar: true }); }
