// ¿Está en el aire la jornada o un partido por una suspensión o un aplazamiento? (4-5 nov 2026: tras la muerte de Jesús de Miguel se
// estudiaba suspender la J12 y la previa iba a salir el jueves a las 9 como si nada.) Sale del registro: el tipo `liga` publica
// «se estudia» y después la decisión, con claves `liga|<suspension|aplazamiento>|<j|p<ids>|c<id>>|<estado>|J<n>`.
//   - se estudia y aún no hay decisión: espera, como mucho 36 h desde el tweet de «se estudia» (si la decisión no llega al
//     bot, la previa no se pierde la jornada entera);
//   - confirmado: espera para los partidos con la fecha de antes (a menos de 6 días de la decisión); con la fecha nueva, sigue;
//   - descartado: sigue.
const H = 36e5;

/** { espera, motivo } para un partido m (de stats/week) de la jornada `jornada` */
export function enElAire(registro, { jornada, m = null, ahora = Date.now() } = {}) {
  const env = (registro && registro.datos && registro.datos.enviados) || [];
  const ids = m ? [String(m.local && m.local.id), String(m.visitor && m.visitor.id)] : [];
  const toca = (obj) => obj === 'j' || (m && (obj === `p${[...ids].sort().join('-')}` || ids.some((id) => obj === `c${id}`)));
  const hs = env.map((e) => {
    const p = String(e.clave || '').split('|');
    if (p[0] !== 'liga' || !['suspension', 'aplazamiento'].includes(p[1])) return null;
    return { tipo: p[1], obj: p[2], estado: p[3], j: Number(String(p[4] || '').replace(/^J/, '')), t: Date.parse(e.t) || 0 };
  }).filter((x) => x && x.j === Number(jornada) && toca(x.obj)).sort((a, b) => a.t - b.t);
  if (!hs.length) return { espera: false };
  const ult = hs[hs.length - 1];
  if (ult.estado === 'descartado') return { espera: false };
  if (ult.estado === 'se_estudia') {
    if (ahora - ult.t > 36 * H) return { espera: false };
    return { espera: true, motivo: `se estudia ${ult.tipo === 'aplazamiento' ? 'aplazar' : 'suspender'} ${ult.obj === 'j' ? 'la jornada' : 'el partido'} (desde hace ${Math.round((ahora - ult.t) / H)} h): espero a la decisión` };
  }
  if (ult.estado === 'confirmado') {
    const f = m ? Date.parse(m.date) : NaN;
    if (Number.isFinite(f) && f - ult.t > 6 * 24 * H) return { espera: false };
    return { espera: true, motivo: `${ult.obj === 'j' ? 'jornada' : 'partido'} ${ult.tipo === 'aplazamiento' ? 'aplazado' : 'suspendido'}: espero a la fecha nueva` };
  }
  return { espera: false };
}
