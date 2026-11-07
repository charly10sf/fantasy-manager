// Qué es un golazo en el directo (Carlos, 7 nov, 22:21 y 22:43). Con los datos de FotMob: una falta directa o un disparo de 22 m o más,
// sin contar penaltis ni autogoles (26 goles en 11,4 jornadas de LaLiga: ~2,3 por jornada; el de Valverde del 7 nov, a 23,5 m, entra).
// Si FotMob no tiene el gol, vale la regla C con el texto de la jugada de ESPN: falta directa, fuera del área a la escuadra, o volea
// que sea de fuera del área o a la escuadra (21 goles en esa misma tanda). Ni ESPN ni FotMob dicen si hubo desvío ni cómo fue el
// golpeo, y la chilena no se detecta: «golazo» es esta regla, no una opinión.

export const GOLAZO_METROS = 22;

/** `g`: un gol de FotMob (lib/fotmob.mjs, `leerDetalle`). { motivo: 'falta directa' | 'de lejos', metros } o null */
export function golazoFotmob(g) {
  if (!g || g.propia || g.penalti) return null;
  const metros = g.distancia != null ? Math.floor(g.distancia) : null;
  if (g.situacion === 'FreeKick') return { motivo: 'falta directa', metros, fuente: 'fotmob' };
  if (g.distancia != null && g.distancia >= GOLAZO_METROS) return { motivo: 'de lejos', metros, fuente: 'fotmob' };
  return null;
}

/** Regla C de ESPN: `tipo` es el «Goal - Free-kick» de la jugada y `texto`, el de su `summary` («… from outside the box to the top left corner.»). */
export function golazoEspn({ tipo = '', texto = '', penalti = false } = {}) {
  if (penalti) return null;
  const ty = String(tipo), tx = String(texto);
  const fuera = /outside the (?:box|area)/i.test(tx), escuadra = /top (?:left|right) corner/i.test(tx);
  if (/free.?kick/i.test(ty)) return { motivo: 'falta directa', metros: null, fuente: 'espn' };
  if (fuera && escuadra) return { motivo: 'de lejos', metros: null, fuente: 'espn' };
  if (/volley/i.test(ty) && (fuera || escuadra)) return { motivo: 'de volea', metros: null, fuente: 'espn' };
  return null;
}

/** el texto de la jugada de un gol en el `summary` de ESPN (keyEvents), por goleador y minuto; '' si no está */
export function textoGolEspn(sumario, jugador, minuto) {
  for (const k of (sumario && sumario.keyEvents) || []) {
    if (!(k.scoringPlay || /goal/i.test((k.type && k.type.text) || ''))) continue;
    const a = ((k.participants || [])[0] || {}).athlete;
    if (a && a.displayName === jugador && String((k.clock && k.clock.displayValue) || '') === String(minuto)) return String(k.text || '');
  }
  return '';
}
