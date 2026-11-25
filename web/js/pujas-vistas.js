/* Las pujas que van entrando por cada libre del mercado (0.8.2, 24 nov: la idea de un amigo de Carlos, «ver lo que pujan
   los rivales»). LaLiga no dice ni quién puja ni cuánto (comprobado en crudo: claude/pendiente-pujas-rivales.md del
   proyecto): solo cuántas pujas lleva cada jugador. Aquí se apunta, entre una lectura de la liga y la siguiente, cuándo
   sube ese número: con eso se sabe en qué rato entró cada puja de otro, y el motor (quien-puja.js) lo cruza con la hora a
   la que se mueve cada rival. Va en este dispositivo, por liga (LS «pujas-vistas»), 45 días.

   El registro: { t (la última lectura apuntada), cal: { si, no }, m: { [id del jugador en el mercado]: e } }
     e = { pid, c (cuándo cierra), n (pujas que da LaLiga), mia (1 si una es tuya), a (las de otros), t0 (primera vez que se
           vio), tl (última lectura), ev: [[desde, hasta, cuántas]] (cada vez que han entrado pujas de otros; desde 0 = no se
           sabe desde cuándo) }
   `cal` aprende sola si el número de LaLiga cuenta tu puja: cuando la app ve aparecer la tuya, mira si el número ha subido. */
import { num, DIA, HORA } from './util.js';

export const registroVacio = () => ({ t: 0, cal: { si: 0, no: 0 }, m: {} });
/** ¿el número de pujas que da LaLiga cuenta la tuya? (sí, mientras no se haya visto lo contrario más veces) */
export const cuentaLaMia = (reg) => !(reg && reg.cal && num(reg.cal.no) > num(reg.cal.si));
/** las pujas de otros que lleva un jugador del mercado, con el registro (o sin él) */
export function ajenasDe(m, reg) {
  const e = reg && reg.m && m && m.id != null ? reg.m[m.id] : null;
  const mia = m && Number(m.miPuja) > 0 ? 1 : 0;
  // (con tu puja «dicha» en Pregunta la foto de LaLiga no la traía: el registro no la ha descontado)
  if (e && e.n === num(m.pujas) && e.mia === mia) return e.a;
  return Math.max(0, num(m && m.pujas) - (cuentaLaMia(reg) ? mia : 0));
}

/**
 * Apunta la foto D en el registro. Devuelve { reg, cambia }: `reg` es otro objeto si ha cambiado algo (el de entrada no se
 * toca). Una misma foto no se apunta dos veces.
 */
export function registrarPujas(reg0, D) {
  const base = reg0 && reg0.m && typeof reg0.m === 'object' ? reg0 : registroVacio();
  if (!D || !D.t || !Array.isArray(D.mercado) || D.t <= num(base.t)) return { reg: base, cambia: false };
  const reg = { t: D.t, cal: { si: num(base.cal && base.cal.si), no: num(base.cal && base.cal.no) }, m: {} };
  for (const [k, e] of Object.entries(base.m)) reg.m[k] = { ...e, ev: (e.ev || []).map((x) => [...x]) };
  const antes = num(base.t);
  for (const m of D.mercado) {
    if (!m || m.tipo !== 'liga' || m.id == null) continue;
    const n = num(m.pujas), mia = Number(m.miPuja) > 0 ? 1 : 0;
    const e = reg.m[m.id];
    // ¿cuenta LaLiga tu puja en su número? Se ve cuando la tuya aparece entre dos lecturas
    if (e && e.mia === 0 && mia === 1) { if (n > e.n) reg.cal.si++; else if (n === e.n) reg.cal.no++; }
    const a = Math.max(0, n - (cuentaLaMia(reg) ? mia : 0));
    if (!e) {
      // la primera vez que se ve: si ya trae pujas, han entrado desde la lectura de antes (si fue hace menos de un día)
      const desde = antes && D.t - antes < DIA ? antes : 0;
      reg.m[m.id] = { pid: m.pid, c: m.cierra || 0, n, mia, a, t0: D.t, tl: D.t, ev: a > 0 ? [[desde, D.t, a]] : [] };
      continue;
    }
    const d = a - num(e.a);
    if (d > 0) e.ev.push([e.tl || 0, D.t, d]);
    else if (d < 0) {
      // alguien ha retirado la suya: se quitan las últimas que entraron (no se sabe cuál era)
      let q = -d;
      while (q > 0 && e.ev.length) { const u = e.ev[e.ev.length - 1]; if (u[2] <= q) { q -= u[2]; e.ev.pop(); } else { u[2] -= q; q = 0; } }
    }
    e.n = n; e.mia = mia; e.a = a; e.tl = D.t;
    if (m.cierra) e.c = m.cierra;
  }
  // lo viejo fuera: a los 45 días, y lo que se cerró sin pujas de nadie, a la hora
  const ids = Object.keys(reg.m);
  for (const k of ids) {
    const e = reg.m[k], cerrado = e.c && e.c < D.t - HORA;
    if ((e.c || e.tl) < D.t - 45 * DIA || (cerrado && !e.a)) delete reg.m[k];
  }
  const quedan = Object.entries(reg.m);
  if (quedan.length > 250) for (const [k] of quedan.sort((x, y) => (y[1].c || y[1].tl) - (x[1].c || x[1].tl)).slice(250)) delete reg.m[k];
  return { reg, cambia: true };
}

/** las pujas de otros que han entrado en la última lectura, por jugador del mercado: { [id]: cuántas } */
export function nuevasEn(reg) {
  const out = {};
  if (!reg || !reg.m || !reg.t) return out;
  for (const [k, e] of Object.entries(reg.m)) {
    const n = (e.ev || []).filter((x) => x[1] === reg.t && x[0] !== 0 && e.t0 !== reg.t).reduce((s, x) => s + x[2], 0);
    if (n > 0) out[k] = n;
  }
  return out;
}
