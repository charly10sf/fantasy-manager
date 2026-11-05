// Tweets largos con X Premium (Carlos, 4 nov 2026, 22:39: Premium en @Fantasyman_app, «que los tweets sean más largos y se
// noten más humanos; no tienen por qué ser muy largos, pero ya no hay el límite del Twitter gratis»).
// Se escriben largos (hasta config.largo.max, contado como X) si:
//   - config.largo.activo es true;
//   - la variable de repositorio BOT_LARGO no dice «no» (el interruptor desde el móvil, como BOT_MODO);
//   - y X no ha rechazado un tweet largo en las últimas `largo.reintentarHoras`. Si el Premium caduca, X rechaza los de más
//     de 280: el bot lo apunta en el registro, vuelve solo a 280 y lo vuelve a probar pasado ese tiempo.
// La API cobra lo mismo por un tweet largo que por uno corto (0,015 $ sin enlace).

export function decidirLargo({ config = {}, registro = null, env = process.env, ahora = Date.now() } = {}) {
  const c = config.largo || {};
  if (!c.activo) return { largo: false, motivo: 'apagado en bot/config.json (largo.activo)' };
  if (/^(no|0|false|off|corto|280)$/i.test(String(env.BOT_LARGO || '').trim())) return { largo: false, motivo: 'variable BOT_LARGO = no' };
  const no = registro && registro.datos && registro.datos.largoRechazado;
  const horas = c.reintentarHoras ?? 24;
  const hace = no ? (ahora - Date.parse(no.t)) / 3600e3 : Infinity;
  if (hace < horas) return { largo: false, motivo: `X rechazó un tweet largo hace ${hace.toFixed(1)} h (se vuelve a probar a las ${horas} h)` };
  return { largo: true, max: c.max ?? 1000 };
}

/** ¿X ha rechazado el tweet por largo? Solo se mira con tweets de más de 280. Cualquier 400 o 403 que no sea «duplicate» cuenta:
    no se sabe con qué texto exacto lo rechaza X sin Premium (auditoría del 5 nov) y lo peor que pasa así es pasar 24 h en 280. */
export function rechazoPorLargo(r) {
  if (!r || (r.estado !== 400 && r.estado !== 403)) return false;
  // (un 400 por la imagen, «Your media IDs are invalid», no es por el largo: no pasa 24 h a 280; auditoría del 5 nov)
  return !/duplicate|media/i.test(String(r.cuerpo || ''));
}
