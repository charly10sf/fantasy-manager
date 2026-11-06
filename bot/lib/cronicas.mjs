// La prensa de un partido para dar color a los tuits redactados (lib/redaccion.mjs): titulares y entradillas de los RSS de MARCA, AS,
// Mundo Deportivo, SPORT y el resto de lib/prensa.mjs (la misma lectura que noticias y liga: una vez por ejecución). Solo titular y
// entradilla (hasta 400 caracteres), nunca el artículo: de ahí la IA saca uno o dos hechos con sus palabras y el validador tira lo que
// copie 6 palabras seguidas. Solo para los tipos de `redactar.prensa` (final, mvp, previa) y solo si el tweet trae `hechos.partido`.
// En el registro (repo público) no se guarda nada de esto.
import { noticiasPrensaUnaVez } from './prensa.mjs';
import { norm, corto } from './texto.mjs';

// palabras que dicen que una noticia es del partido (crónica, goles, rueda de prensa…) y no de otra cosa del club
const DEL_PARTIDO = /\b(gana|ganan|gol|goles|golea|goleada|empate|empata|remonta|remontada|vence|derrota|pierde|cae|victoria|triunfo|cronica|marcador|penalti|expuls|roja|once|alineacion|convocatoria|rueda de prensa|entrenador|previa|duda|bajas?|lesion|vuelve)\b/;

const nombresDe = (eq) => [...new Set([norm(eq), norm(corto(eq)), ...(corto(eq) === 'Atlético' ? ['atleti'] : []), ...(corto(eq) === 'Barça' ? ['barca', 'barcelona'] : []),
  ...(corto(eq) === 'Real Madrid' ? ['madrid'] : []), ...(corto(eq) === 'Deportivo' ? ['depor'] : []), ...(corto(eq) === 'Real Sociedad' ? ['la real'] : [])])].filter((x) => x.length >= 4);
const nombra = (txt, eq) => nombresDe(eq).some((n) => txt.includes(` ${n} `));

/**
 * Elige las noticias de un partido. `partido`: { local, visitante, fecha } (los nombres de los clubes); `tipo`: final o mvp (desde el
 * comienzo del partido hasta ahora) o previa (las 36 h de antes). Como mucho `n`, las más recientes, una por medio y titular.
 */
export function elegir(noticias, { partido, tipo, ahora = Date.now(), n = 4 }) {
  if (!partido || !partido.local || !partido.visitante) return [];
  const t0 = Date.parse(partido.fecha) || ahora;
  const desde = tipo === 'previa' ? ahora - 36 * 3600e3 : t0 - 30 * 60e3;
  const out = [], vistos = new Set();
  for (const x of [...noticias].sort((a, b) => (b.t || 0) - (a.t || 0))) {
    if (!x.t || x.t < desde || x.t > ahora + 60e3) continue;
    const txt = ` ${norm(`${x.titulo} ${x.entradilla}`)} `;
    const dos = nombra(txt, partido.local) && nombra(txt, partido.visitante);
    const uno = nombra(txt, partido.local) || nombra(txt, partido.visitante);
    if (!(dos || (uno && DEL_PARTIDO.test(txt)))) continue;
    const k = `${x.medio}|${norm(x.titulo).slice(0, 40)}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ medio: x.medio, titulo: x.titulo, entradilla: x.entradilla || '', dos });
    if (out.length >= n * 3) break;
  }
  // primero las que nombran a los dos clubes
  return out.sort((a, b) => Number(b.dos) - Number(a.dos)).slice(0, n).map(({ dos, ...c }) => c);
}

/** `de(t)`: la prensa del partido de un tweet, si su tipo lleva prensa (config.redactar.prensa) */
export function crearCronicas({ config = {}, leer = noticiasPrensaUnaVez, log = () => {}, ahora = () => Date.now() } = {}) {
  const tipos = (config.redactar && config.redactar.prensa) || ['final', 'mvp', 'previa'];
  return {
    async de(t) {
      if (!t || !t.hechos || !t.hechos.partido || !tipos.includes(t.tipo)) return [];
      const noticias = await leer({ log }).catch(() => []);
      const p = t.hechos.partido;
      return elegir(noticias, { partido: { local: p.local, visitante: p.visitante, fecha: p.fecha }, tipo: t.tipo, ahora: ahora() });
    },
  };
}
