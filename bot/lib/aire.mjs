// ¿Está en el aire la jornada o un partido por una suspensión o un aplazamiento? (4-5 nov 2026: tras la muerte de Jesús de Miguel se
// estudiaba suspender la J12 y la previa iba a salir el jueves a las 9 como si nada.) Sale del registro: el tipo `liga` publica
// «se estudia» y después la decisión, con claves `liga|<suspension|aplazamiento>|<j|p<ids>|c<id>>|<estado>|J<n>`.
// Cada tema (tipo y objeto: la jornada, un partido o un club; sin la jornada, para que un «se estudia» con J11 y un «descartado» con
// J12 sean el mismo tema) cuenta por su último tweet:
//   - se estudia y aún no hay decisión: espera, como mucho 36 h desde ese tweet (si la decisión no llega al bot, la previa no se
//     pierde la jornada entera). Vale el de la jornada y el de la anterior: la jornada de la clave es la del bot cuando salió el
//     tweet, no siempre la de la noticia («la próxima jornada», publicada la semana de antes);
//   - confirmado (solo para la jornada de la decisión, apuntada al publicarla: con la J12 suspendida, la J13 no espera; «suspendida
//     la J13» publicado el domingo de la J12 no para lo que queda de la J12): espera mientras el partido siga con la
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

/** ¿hay un partido por jugar (matchState 1) al que toca la clave? (para saber si una decisión es de esta jornada o de la siguiente) */
export function tocaPendiente(clave, stats = []) {
  const x = leer(clave);
  return !!x && (Array.isArray(stats) ? stats : []).some((m) => m && Number(m.matchState) === 1 && tocaA(x.obj, m));
}
/** al publicar una decisión confirmada: la fecha que tenía cada partido al que toca. `jornada`: la de la decisión, que puede ser la
 *  siguiente a la de la clave («suspendida la J13», publicado el domingo de la J12); `stats`, los partidos de esa jornada */
export function apuntarDecision(registro, clave, stats = [], jornada = null) {
  const x = leer(clave);
  if (!x || x.estado !== 'confirmado' || !registro || !registro.datos) return 0;
  const aire = caja(registro.datos);
  const fechas = {};
  for (const m of Array.isArray(stats) ? stats : []) if (m && m.id != null && tocaA(x.obj, m)) fechas[String(m.id)] = m.date || null;
  // el centro de la jornada (la mediana de sus fechas): «lejos» se mide contra él, no contra el día de la decisión (la J13, tras un
  // parón, puede jugarse 12 días después; auditoría del 5 nov)
  const ts = (Array.isArray(stats) ? stats : []).map((m) => Date.parse(m && m.date)).filter(Number.isFinite).sort((a, b) => a - b);
  aire[`${x.tipo}|${x.obj}|J${x.j}`] = { fechas, jornada: Number(jornada) || x.j, centro: ts.length ? ts[Math.floor(ts.length / 2)] : null };
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
    if (x.estado === 'confirmado' && m) {
      // la jornada de la decisión (la apuntada al publicarla; si no, la de la clave): la J12 suspendida no para la J13, y «suspendida
      // la J13» publicado durante la J12 no para lo que queda de la J12
      const ap = datos && datos.aire && typeof datos.aire === 'object' ? datos.aire[`${x.tipo}|${x.obj}|J${x.j}`] : null;
      const jDec = ap && Number(ap.jornada) ? Number(ap.jornada) : x.j;
      if (jDec !== J) continue;
      const fechas = ap && ap.fechas && typeof ap.fechas === 'object' ? ap.fechas : null;
      if (!fechas || !(String(m.id) in fechas)) continue;
      const f = Date.parse(m.date);
      // con la fecha de antes, espera; salvo que esa fecha ya esté lejos de la jornada (a más de 4 días de su centro: lo han movido a
      // otra semana y la API aún no lo dice de otra forma) o, sin centro apuntado, a más de 6 días de la decisión
      const lejos = Number.isFinite(f) && (Number.isFinite(ap.centro) ? Math.abs(f - ap.centro) > 4 * 24 * H : f - x.t > 6 * 24 * H);
      if (fechas[String(m.id)] === (m.date || null) && !lejos) {
        return { espera: true, motivo: `${x.obj === 'j' ? 'la jornada está suspendida' : x.tipo === 'aplazamiento' ? 'el partido está aplazado' : 'el partido está suspendido'}: espero a la fecha nueva` };
      }
    }
  }
  return { espera: false };
}
