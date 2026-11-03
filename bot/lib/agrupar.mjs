// Tweets con varios jugadores sin formato de lista (Carlos, 3 nov 12:06: «❌ Lemar (Elche), lesionado (5,5 de media)» una línea
// por jugador le sonaba a máquina). Se agrupa por lo que pasa y se dice como lo diría una persona:
//   «❌ Se caen por lesión Lemar en el Elche y M. Román en el Celta»
//   «✅ Vuelven Valverde al Real Madrid, Sadiq al Valencia y Gueye al Villarreal»
// La media, solo la del que más pesa, en su propia línea. Lo usan caidas.mjs y novedades.mjs.
import { el, al, fmt, partes } from './texto.mjs';

const NUM = ['ningún', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
/** 3 → «tres» (para las cabeceras: «Tres titulares habituales se caen…») */
export const enLetra = (n) => NUM[n] || String(n);
export const mayus = (s) => String(s).replace(/^./, (c) => c.toUpperCase());

/** «A», «A y B», «A, B y C» */
export const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** los jugadores por club, en el orden en que llegan */
export function porClub(xs) {
  const m = new Map();
  for (const x of xs) { if (!m.has(x.equipo)) m.set(x.equipo, []); m.get(x.equipo).push(x); }
  return [...m.values()];
}

const en = (eq) => `en ${el(eq)}`;
/** «Lemar en el Elche y M. Román en el Celta»; si un club tiene dos: «Lemar y Fer Niño en el Elche, y M. Román en el Celta» */
export function nombresPorClub(xs, prep = en) {
  const gs = porClub(xs).map((g) => `${lista(g.map((x) => x.nombre))} ${prep(g[0].equipo)}`);
  if (gs.length > 1 && porClub(xs).some((g) => g.length > 1)) return `${gs.slice(0, -1).join(', ')}, y ${gs[gs.length - 1]}`;
  return lista(gs);
}

/**
 * Una línea por estado. xs: [{ nombre, equipo, estado, pct }], todos con el mismo estado
 * (lesionado, sancionado, duda o disponible). club: todos son del mismo equipo y ya se ha dicho arriba; ya: sin repetir «vuelven».
 */
export function lineaEstado(estado, xs, { club = false, ya = false } = {}) {
  const n = xs.length, x = xs[0];
  const nombres = club ? lista(xs.map((y) => y.nombre)) : null;
  if (estado === 'lesionado') {
    if (n === 1) return `❌ ${x.nombre} se cae por lesión${club ? '' : ` ${en(x.equipo)}`}`;
    return `❌ Se caen por lesión ${club ? nombres : nombresPorClub(xs)}`;
  }
  if (estado === 'sancionado') {
    if (n === 1) return `🟥 ${x.nombre} cumple sanción${club ? '' : ` ${en(x.equipo)}`}`;
    return `🟥 Cumplen sanción ${club ? nombres : nombresPorClub(xs)}`;
  }
  if (estado === 'duda') {
    if (n === 1) return `⁉️ ${x.nombre} está en el aire${club ? '' : ` ${en(x.equipo)}`}: ${x.pct} % de titularidad`;
    return `⁉️ Están en el aire ${lista(xs.map((y) => `${y.nombre} (${y.pct} %)`))}`;
  }
  // disponible (ya: la cabecera ya ha dicho «vuelven», así que aquí no se repite)
  if (ya) return n === 1 ? `✅ ${x.nombre} ya está disponible${club ? '' : ` ${en(x.equipo)}`}` : `✅ Ya están disponibles ${club ? nombres : nombresPorClub(xs)}`;
  if (n === 1) return `✅ Vuelve ${x.nombre}${club ? '' : ` ${al(x.equipo)}`}`;
  return `✅ Vuelven ${club ? nombres : nombresPorClub(xs, al)}`;
}

const ORDEN = ['lesionado', 'sancionado', 'duda', 'disponible'];
/** las líneas de todos los estados, de peor a mejor noticia */
export function lineasPorEstado(xs, opciones) {
  return ORDEN.map((e) => xs.filter((x) => x.estado === e)).filter((g) => g.length).map((g) => lineaEstado(g[0].estado, g, opciones));
}

/** la media solo del que más pesa: «‼️ El que más pesa es Valverde: 5,5 puntos de media» (null si nadie llega a 3) */
export function elQueMasPesa(xs) {
  if (xs.length < 2) return null;
  const top = [...xs].sort((a, b) => b.media - a.media)[0];
  if (!(top.media >= 3)) return null;
  return { t: `‼️ El que más pesa es ${top.nombre}: ${fmt(top.media)} puntos de media`, numeros: partes(top.media) };
}
