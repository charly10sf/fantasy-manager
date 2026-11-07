// Reparto de los «posibles onces» (Carlos, 7 nov 10:41: el sábado por la mañana salieron 4 o 5 de golpe y de una jornada cuyas
// alineaciones ya estaban cerradas desde el viernes a las 21:00). Reglas:
//   - solo de la primera jornada que aún no ha empezado: con el primer partido empezado, las alineaciones fantasy están cerradas;
//   - no se abren hasta `abreHoras` antes de ese primer partido (84 h: un viernes a las 21:00, desde el martes a las 9:00);
//   - uno cada vez, con `separacionMin` minutos entre dos y `porDia` como mucho cada día de Madrid;
//   - en las últimas `sinTopeHoras` h antes del primer partido no hay tope por día y la separación baja a 60 min, para que
//     los partidos que queden salgan antes de que se cierre la jornada.
const dia = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));

export const POR_DEFECTO = { abreHoras: 84, separacionMin: 120, porDia: 3, sinTopeHoras: 24 };

/**
 * ¿Toca sacar ahora un posible once de esta jornada?
 * @param primero  hora (ms) del primer partido de la jornada
 * @param ahora    hora actual (ms)
 * @param config   config.json (clave `previaPosibles`)
 * @param salidos  cuándo salieron los posibles onces ya publicados (ISO o ms), de cualquier jornada
 * @returns { ok, motivo }
 */
export function tocaPosible({ primero, ahora, config = {}, salidos = [] }) {
  const c = { ...POR_DEFECTO, ...(config.previaPosibles || {}) };
  if (!Number.isFinite(primero)) return { ok: false, motivo: 'no se sabe cuándo empieza la jornada' };
  if (primero <= ahora) return { ok: false, motivo: 'la jornada ya ha empezado: alineaciones cerradas' };
  const falta = (primero - ahora) / 3600e3;
  if (falta > c.abreHoras) return { ok: false, motivo: `faltan ${Math.round(falta)} h para la jornada (se abre ${c.abreHoras} h antes)` };
  const ts = salidos.map((t) => (typeof t === 'number' ? t : Date.parse(t))).filter(Number.isFinite);
  const apretado = falta <= c.sinTopeHoras;
  const sep = apretado ? Math.min(c.separacionMin, 60) : c.separacionMin;
  const ult = ts.reduce((m, t) => Math.max(m, t), 0);
  const hace = (ahora - ult) / 60e3;
  if (ult && hace < sep) return { ok: false, motivo: `el último salió hace ${Math.round(hace)} min (separación de ${sep})` };
  if (!apretado) {
    const hoy = ts.filter((t) => dia(t) === dia(ahora)).length;
    if (hoy >= c.porDia) return { ok: false, motivo: `ya han salido ${hoy} hoy (tope de ${c.porDia} al día)` };
  }
  return { ok: true, motivo: '' };
}
