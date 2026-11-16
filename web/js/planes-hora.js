/* Los planes a su hora (0.7.13l; Carlos, 16 nov). Por defecto, uno de los dos planes del día con la IA sale solo 10 minutos
   después de que se refresca el mercado DE SU LIGA y el otro 12 horas después (0.7.13n, Carlos: «a las 20h es MI mercado,
   pero los de otras ligas tendrán el mercado a horas diferentes»): cada liga tiene su hora, que sale de `M.cierreMercado`
   (cuándo caducan casi todos los libres de su mercado) y se guarda por si un día no se sabe (`plan-mercado`); cada
   uno puede elegir sus dos horas en Ajustes → La IA o en los ajustes del plan. Los que salen solos cuentan en los del día.
   Con la app abierta salen a su hora (el reloj de cada 10 minutos de app.js); con la app cerrada, en la pasada en segundo
   plano que se pide para esa hora (programarFondo) y, si Android no la hace a tiempo, en cuanto se abra la app.
   Un «turno» es una de esas dos horas de un día: está pendiente desde su hora hasta 12 horas después (sin pasar del día) si no hay un plan
   con la IA hecho después de ella o en la hora y media de antes (pedido a mano o solo: así no se gastan dos seguidos).
   Cada turno se intenta como mucho dos veces. */
import { LS, MIN, HORA, diaDe } from './util.js';

const CLAVE = 'cfg-planes-hora';
/** on: si salen solos; h1 y h2: «HH:MM» elegidas por él, o '' para la de siempre (la del mercado) */
export const cfgHoras = () => ({ on: true, h1: '', h2: '', ...LS.get(CLAVE, {}) });
export const guardarCfgHoras = (c) => LS.set(CLAVE, { ...cfgHoras(), ...c });

const minutoDe = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const leer = (s) => { const x = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return x && +x[1] < 24 && +x[2] < 60 ? +x[1] * 60 + +x[2] : null; };

/** el minuto del día (hora local) en que se refresca el mercado de su liga: el de su próximo cierre (y se guarda) o, si
    hoy no se sabe, el último que se vio; null si nunca se ha visto (entonces no sale ninguno solo: no se adivina la hora) */
export function minutoMercado(M) {
  if (M && M.cierreMercado) { const m = minutoDe(M.cierreMercado); if (LS.get('plan-mercado', null) !== m) LS.set('plan-mercado', m); return m; }
  const g = LS.get('plan-mercado', null);
  return Number.isFinite(g) ? g : null;
}
/** el minuto del día (hora local) de los dos turnos: [{ m, txt, propia }]; [] si no se sabe la hora de su mercado y no
    ha elegido las suyas */
export function horasPlan(M) {
  const c = cfgHoras();
  const base = minutoMercado(M);
  const m1 = base == null ? null : (base + 10) % 1440, m2 = m1 == null ? null : (m1 + 720) % 1440;
  const h1 = leer(c.h1), h2 = leer(c.h2);
  return [h1 != null ? h1 : m1, h2 != null ? h2 : m2].map((m, i) => (m == null ? null : { m, txt: hhmm(m), propia: (i ? h2 : h1) != null })).filter(Boolean);
}
/** las horas por defecto, para enseñarlas en Ajustes (null si no se sabe la hora de su mercado) */
export const horasDefecto = (M) => { const b = minutoMercado(M); if (b == null) return null; const m1 = (b + 10) % 1440; return [hhmm(m1), hhmm((m1 + 720) % 1440)]; };

/** los turnos de un día (el de `t`), con su hora exacta */
function turnosDelDia(M, t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  const base = d.getTime();
  return horasPlan(M).map((h, i) => {
    // (con el cambio de hora, el día tiene 23 o 25 horas: se pone la hora del reloj, no la suma de minutos)
    const x = new Date(base); x.setHours(Math.floor(h.m / 60), h.m % 60, 0, 0);
    return { t: x.getTime(), n: i + 1, txt: h.txt, k: `${diaDe(x.getTime())}:${h.txt}` };
  });
}
const VENTANA = 12 * HORA, CUBRE = 90 * MIN;
/**
 * el turno que toca ahora (el último que ha pasado en las 12 últimas horas) si aún no lo cubre ningún plan con la IA:
 * { t, n, txt, k } o null. `ultimo` es el último plan con la IA guardado (ultimoPlan de ia.js)
 */
export function turnoPendiente(M, ultimo, ahora = Date.now()) {
  if (!cfgHoras().on) return null;
  // (solo los de hoy: los planes de la IA se cuentan por día, y uno de ayer pedido a las 00:20 gastaría uno de hoy antes
  // de que se refresque el mercado)
  const todos = turnosDelDia(M, ahora).filter((x) => x.t <= ahora && ahora - x.t < VENTANA);
  if (!todos.length) return null;
  const s = todos.reduce((a, b) => (b.t > a.t ? b : a));
  if (ultimo && !ultimo.auto && ultimo.t >= s.t - CUBRE) return null;
  const g = LS.get('plan-turno', null);
  if (g && g.k === s.k && g.n >= 2) return null;
  return s;
}
/** se va a intentar el turno: cuenta el intento (dos como mucho) */
export function intentarTurno(s) {
  if (!s) return;
  const g = LS.get('plan-turno', null);
  LS.set('plan-turno', { k: s.k, n: g && g.k === s.k ? g.n + 1 : 1, t: Date.now() });
}
/** el próximo turno (para la pasada en segundo plano y para decir cuándo sale el siguiente): { t, txt } o null */
export function proximoTurno(M, ahora = Date.now()) {
  if (!cfgHoras().on) return null;
  const xs = [...turnosDelDia(M, ahora), ...turnosDelDia(M, ahora + 24 * HORA)].filter((x) => x.t > ahora + MIN);
  return xs.length ? xs.reduce((a, b) => (b.t < a.t ? b : a)) : null;
}
