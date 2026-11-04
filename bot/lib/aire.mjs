// ¿Está en el aire la jornada o un partido por una suspensión o un aplazamiento? (4-5 nov 2026: tras la muerte de Jesús de Miguel se
// estudiaba suspender la J12 y la previa iba a salir el jueves a las 9 como si nada.) Sale del registro: el tipo `liga` publica
// «se estudia» y después la decisión, con claves `liga|<suspension|aplazamiento>|<j|p<ids>|c<id>>|<estado>|J<n>`.
// Cada tema (tipo y objeto: la jornada, un partido o un club) cuenta por su último tweet:
//   - se estudia y aún no hay decisión: espera, como mucho 36 h desde ese tweet (si la decisión no llega al bot, la previa no se
//     pierde la jornada entera);
//   - confirmado: espera mientras el partido siga con la fecha que tenía cuando la previa lo vio por primera vez tras la decisión
//     (se guarda en el registro, `aire`) y esa fecha esté a menos de 6 días de la decisión; con la fecha nueva, sigue;
//   - descartado: ese tema ya no para nada.
// La jornada de la clave es la del bot cuando salió el tweet, no siempre la de la noticia («la próxima jornada», publicada la semana
// de antes): cuenta la de la clave y la siguiente.
const H = 36e5;

/** { espera, motivo } para un partido m (de stats/week) de la jornada `jornada` */
export function enElAire(registro, { jornada, m = null, ahora = Date.now() } = {}) {
  const datos = registro && registro.datos;
  const env = Array.isArray(datos && datos.enviados) ? datos.enviados.filter((e) => e && typeof e.clave === 'string') : [];
  const J = Number(jornada);
  const ids = m ? [String(m.local && m.local.id), String(m.visitor && m.visitor.id)] : [];
  const toca = (obj) => obj === 'j' || (!!m && (obj === `p${[...ids].sort().join('-')}` || ids.some((id) => obj === `c${id}`)));
  const temas = new Map();
  for (const e of env) {
    const p = e.clave.split('|');
    if (p[0] !== 'liga' || !['suspension', 'aplazamiento'].includes(p[1])) continue;
    const x = { tipo: p[1], obj: p[2], estado: p[3], j: Number(String(p[4] || '').replace(/^J/, '')), t: Date.parse(e.t) || 0 };
    if (!(x.j === J || x.j === J - 1) || !toca(x.obj)) continue;
    const k = `${x.tipo}|${x.obj}|J${x.j}`;
    if (!temas.has(k) || temas.get(k).t <= x.t) temas.set(k, x);
  }
  for (const [k, x] of temas) {
    const que = `${x.tipo === 'aplazamiento' ? 'aplazar' : 'suspender'} ${x.obj === 'j' ? 'la jornada' : 'el partido'}`;
    if (x.estado === 'se_estudia' && ahora - x.t <= 36 * H) return { espera: true, motivo: `se estudia ${que} (desde hace ${Math.round((ahora - x.t) / H)} h): espero a la decisión` };
    if (x.estado === 'confirmado' && m) {
      // la fecha del partido la primera vez que se mira tras la decisión; si cambia, ya tiene fecha nueva
      if (datos && typeof datos === 'object') {
        datos.aire = datos.aire && typeof datos.aire === 'object' ? datos.aire : {};
        const fechas = (datos.aire[k] = datos.aire[k] || {});
        if (!(String(m.id) in fechas)) { fechas[String(m.id)] = m.date || null; if (registro.fichero && registro.guardar) registro.guardar(); }
        const f = Date.parse(m.date);
        if (fechas[String(m.id)] === (m.date || null) && !(Number.isFinite(f) && f - x.t > 6 * 24 * H)) {
          return { espera: true, motivo: `${x.obj === 'j' ? 'jornada' : 'partido'} ${x.tipo === 'aplazamiento' ? 'aplazado' : 'suspendido'}: espero a la fecha nueva` };
        }
      }
    }
  }
  return { espera: false };
}
