// ¿Está en el aire la jornada o un partido por una suspensión o un aplazamiento? (4-5 nov 2026: tras la muerte de Jesús de Miguel se
// estudiaba suspender la J12 y la previa iba a salir el jueves a las 9 como si nada.) Sale del registro: el tipo `liga` publica
// «se estudia» y después la decisión, con claves `liga|<suspension|aplazamiento>|<j|p<ids>|c<id>>|<estado>|J<n>`.
// Cada tema (tipo y objeto: la jornada, un partido o un club; sin la jornada, para que un «se estudia» con J11 y un «descartado» con
// J12 sean el mismo tema) cuenta por su último tweet:
//   - se estudia y aún no hay decisión: espera, como mucho 36 h desde ese tweet (si la decisión no llega al bot, la previa no se
//     pierde la jornada entera). Vale el de la jornada y el de la anterior: la jornada de la clave es la del bot cuando salió el
//     tweet, no siempre la de la noticia («la próxima jornada», publicada la semana de antes);
//   - confirmado (solo el de la misma jornada: con la J12 suspendida, la J13 no espera): espera mientras el partido siga con la
//     fecha que tenía cuando se publicó la decisión (`apuntarDecision`, desde ejecutar.mjs, con los partidos de la jornada) y esa
//     fecha esté a menos de 6 días de la decisión; con la fecha nueva, sigue, aunque sea dentro de dos días. Sin fecha apuntada
//     (otro partido o un registro de antes), no espera;
//   - descartado: ese tema ya no para nada.
const H = 36e5;

const leer = (clave) => {
  const p = String(clave).split('|');
  if (p[0] !== 'liga' || !['suspension', 'aplazamiento'].includes(p[1]) || !p[2]) return null;
  return { tipo: p[1], obj: p[2], estado: p[3], j: Number(String(p[4] || '').replace(/^J/, '')) };
};
const tocaA = (obj, m) => {
  if (obj === 'j') return true;
  if (!m) return false;
  const ids = [String(m.local && m.local.id), String(m.visitor && m.visitor.id)];
  return obj === `p${[...ids].sort().join('-')}` || ids.some((id) => obj === `c${id}`);
};
const caja = (datos) => {
  if (!datos || typeof datos !== 'object') return null;
  if (!datos.aire || typeof datos.aire !== 'object' || Array.isArray(datos.aire)) datos.aire = {};
  return datos.aire;
};

/** al publicar una decisión confirmada: la fecha que tenía cada partido de la jornada al que toca (stats/week de esa jornada) */
export function apuntarDecision(registro, clave, stats = []) {
  const x = leer(clave);
  if (!x || x.estado !== 'confirmado' || !registro || !registro.datos) return 0;
  const aire = caja(registro.datos);
  const fechas = {};
  for (const m of Array.isArray(stats) ? stats : []) if (m && m.id != null && tocaA(x.obj, m)) fechas[String(m.id)] = m.date || null;
  aire[`${x.tipo}|${x.obj}|J${x.j}`] = { fechas };
  return Object.keys(fechas).length;
}

/** { espera, motivo } para un partido m (de stats/week) de la jornada `jornada` */
export function enElAire(registro, { jornada, m = null, ahora = Date.now() } = {}) {
  const datos = registro && registro.datos;
  const env = Array.isArray(datos && datos.enviados) ? datos.enviados.filter((e) => e && typeof e.clave === 'string') : [];
  const J = Number(jornada);
  const temas = new Map();
  for (const e of env) {
    const x = leer(e.clave);
    if (!x || !(x.j === J || x.j === J - 1) || !tocaA(x.obj, m)) continue;
    x.t = Date.parse(e.t) || 0;
    const k = `${x.tipo}|${x.obj}`;
    if (!temas.has(k) || temas.get(k).t <= x.t) temas.set(k, x);
  }
  for (const x of temas.values()) {
    const que = `${x.tipo === 'aplazamiento' ? 'aplazar' : 'suspender'} ${x.obj === 'j' ? 'la jornada' : 'el partido'}`;
    if (x.estado === 'se_estudia' && ahora - x.t <= 36 * H) return { espera: true, motivo: `se estudia ${que} (desde hace ${Math.round((ahora - x.t) / H)} h): espero a la decisión` };
    if (x.estado === 'confirmado' && x.j === J && m) {
      const ap = datos && datos.aire && typeof datos.aire === 'object' ? datos.aire[`${x.tipo}|${x.obj}|J${x.j}`] : null;
      const fechas = ap && ap.fechas && typeof ap.fechas === 'object' ? ap.fechas : null;
      if (!fechas || !(String(m.id) in fechas)) continue;
      const f = Date.parse(m.date);
      if (fechas[String(m.id)] === (m.date || null) && !(Number.isFinite(f) && f - x.t > 6 * 24 * H)) {
        return { espera: true, motivo: `${x.obj === 'j' ? 'la jornada está suspendida' : x.tipo === 'aplazamiento' ? 'el partido está aplazado' : 'el partido está suspendido'}: espero a la fecha nueva` };
      }
    }
  }
  return { espera: false };
}
