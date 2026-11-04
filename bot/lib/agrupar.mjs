// Tweets con varios jugadores sin formato de lista (Carlos, 3 nov 12:06: «❌ Lemar (Elche), lesionado (5,5 de media)» una línea
// por jugador le sonaba a máquina). Se agrupa por lo que pasa y se dice como lo diría una persona:
//   «❌ Se caen por lesión Lemar en el Elche y M. Román en el Celta»
//   «✅ Vuelven Valverde al Real Madrid, Sadiq al Valencia y Gueye al Villarreal»
// La media, solo la del que más pesa, en su propia línea. Lo usan caidas.mjs y novedades.mjs.
import { el, al, fmt, partes, hash } from './texto.mjs';

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

/**
 * El motivo del que más pesa de los que lo tienen (Carlos, 3 nov 13:15: sin motivo suena a máquina):
 * «⚠️ Lemar, rotura fibrilar en el aductor: baja hasta finales de noviembre» · «⚠️ Vini Jr. vio la roja en la jornada 11».
 * Cada jugador puede llevar `parte` (lib/partes.mjs) y `motivoSan` ({ txt, numeros }). Devuelve { t, numeros } o null.
 */
const conMotivo = (xs) => [...xs].filter((x) => (x.parte && x.parte.lesion && x.estado !== 'disponible') || x.motivoSan).sort((a, b) => Number(!!(b.parte && b.parte.lesion)) - Number(!!(a.parte && a.parte.lesion)) || b.media - a.media);   // antes una lesión con parte que una sanción (la sanción ya se dice en su línea)
/** el motivo de uno, sin emoji: { t, numeros } */
function motivoDe(x) {
  if (x.motivoSan) return { t: `${x.nombre}: ${x.motivoSan.txt.replace(/^./, (c) => c.toLowerCase())}`, numeros: x.motivoSan.numeros };
  const p = x.parte;
  const fin = p.estado === 'baja' && p.hasta ? `: baja hasta ${p.hasta}` : p.estado === 'duda' && p.jornada ? `: duda para la jornada ${p.jornada}` : '';
  return { t: `${x.nombre}, ${p.lesion.replace(/^./, (c) => c.toLowerCase())}${fin}`, numeros: [p.jornada, ...(String(p.hasta || '').match(/\d+/g) || []).map(Number)].filter((n) => n != null) };
}
export function detalle(xs) {
  const x = conMotivo(xs)[0];
  if (!x) return null;
  const m = motivoDe(x);
  return { t: `⚠️ ${m.t}`, numeros: m.numeros };
}
// el artículo de una lesión para «tiene una rotura…», «arrastra un golpe…» («molestias», sin artículo)
const artLesion = (l) => (/^(lesi[oó]n|rotura|luxaci[oó]n|sobrecarga|contusi[oó]n|elongaci[oó]n|tendinitis|fractura|fascitis|distensi[oó]n|pubalgia|fisura|rotura|tendinopat|inflamaci[oó]n|tendinosis|operaci[oó]n)/i.test(l) ? 'una '
  : /^(golpe|esguince|edema|problema|pinchazo|tirón|desgarro|traumatismo)/i.test(l) ? 'un ' : '');
/** el motivo de uno, contado de una de varias formas (v), para que una lista de bajas no suene a plantilla (Carlos, 4 nov 23:39) */
function motivoVario(x, v) {
  if (x.motivoSan) return motivoDe(x);
  const p = x.parte, les = p.lesion.replace(/^./, (c) => c.toLowerCase()), a = artLesion(les);
  const nums = [p.jornada, ...(String(p.hasta || '').match(/\d+/g) || []).map(Number)].filter((n) => n != null);
  if (p.estado === 'baja' && p.hasta) {
    const t = [`${x.nombre}, ${les}: baja hasta ${p.hasta}`, `${x.nombre} no volverá hasta ${p.hasta} por ${a}${les}`,
      `${x.nombre} estará fuera hasta ${p.hasta}${a ? ` por ${a}${les}` : `: ${les}`}`, `Lo de ${x.nombre} es ${a || 'por '}${les}, y no se le espera hasta ${p.hasta}`][v % 4];
    return { t, numeros: nums };
  }
  if (p.estado === 'duda' && p.jornada) return { t: [`${x.nombre}, ${les}: duda para la jornada ${p.jornada}`, `${x.nombre} arrastra ${a}${les} y es duda para la jornada ${p.jornada}`][v % 2], numeros: nums };
  return { t: [`${x.nombre}, ${les}`, `${x.nombre} tiene ${a}${les}`][v % 2], numeros: nums };
}
/** con tweets largos (X Premium): el motivo de todos los que lo tienen, hasta `max`, cada uno contado de otra forma */
export function detalles(xs, max = 5, semilla = '') {
  const h = hash(semilla);
  const ms = conMotivo(xs).slice(0, max).map((x, i) => motivoVario(x, h + i));
  if (!ms.length) return null;
  return { t: `⚠️ ${ms.map((m) => m.t).join('. ')}`, numeros: ms.flatMap((m) => m.numeros) };
}
/** con tweets largos: la media de todos, del que más pesa al que menos: «‼️ El que más pesa es Vini Jr., con 6,3 puntos de media;
    detrás, Rodri con 5,8 y Cuti Romero con 4,1» (sin paréntesis: Carlos, 3 nov). Solo los de 3 o más de media, hasta 4. */
export function pesos(xs, semilla = '', { bajas = true } = {}) {
  const ys = [...xs].filter((x) => x.media >= 3).sort((a, b) => b.media - a.media).slice(0, 4);
  if (xs.length < 2 || !ys.length) return null;
  // empatados con el primero: «Y. Zabiri y Yoel Lago, con 6 cada uno, son los que más pesan»
  const igual = ys.filter((x) => fmt(x.media) === fmt(ys[0].media));
  if (igual.length > 1) {
    const otros = ys.filter((x) => !igual.includes(x));
    const t = `‼️ ${lista(igual.map((x) => x.nombre))}, con ${fmt(igual[0].media)} de media cada uno, son los que más pesan${otros.length ? `; detrás, ${lista(otros.map((x) => `${x.nombre} con ${fmt(x.media)}`))}` : ''}`;
    return { t, numeros: ys.flatMap((x) => partes(x.media)) };
  }
  const [a, ...resto] = ys;
  // los que tienen la misma media, juntos («Cuti Romero, Miguel Sierra y Rodri, con 6,1 cada uno»)
  const grupos = [];
  for (const x of resto) { const g = grupos.find((y) => fmt(y[0].media) === fmt(x.media)); if (g) g.push(x); else grupos.push([x]); }
  const det = lista(grupos.map((g) => (g.length > 1 ? `${lista(g.map((x) => x.nombre))}, con ${fmt(g[0].media)} cada uno` : `${g[0].nombre} con ${fmt(g[0].media)}`)));
  const v = hash(semilla) % 2;
  // «la baja que más duele» solo si todos son bajas (en novedades van mezclados con los que vuelven)
  const t = !resto.length ? [`‼️ El que más pesa es ${a.nombre}: ${fmt(a.media)} puntos de media`, bajas ? `‼️ La baja que más se nota es la de ${a.nombre}, que promedia ${fmt(a.media)} puntos` : `‼️ ${a.nombre} es el que más puntos da: ${fmt(a.media)} de media`][v]
    : [`‼️ El que más pesa es ${a.nombre}, con ${fmt(a.media)} puntos de media; detrás, ${det}`, bajas ? `‼️ Por puntos, la que más duele es la de ${a.nombre}: ${fmt(a.media)} de media. ${resto.length > 1 ? 'Después van' : 'Después va'} ${det}` : `‼️ Por media manda ${a.nombre}, con ${fmt(a.media)}; luego, ${det}`][v];
  return { t, numeros: ys.flatMap((x) => partes(x.media)) };
}
