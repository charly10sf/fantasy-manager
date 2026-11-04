// El validador: nada sale si falla. Comprueba el largo, la palabra «fantasy», que no haya enlaces y que cada número
// del texto esté entre los datos con los que se ha escrito.
import { peso } from './texto.mjs';

export function validar(texto, { numeros = [], max = 280 } = {}) {
  const e = [];
  const p = peso(texto);
  if (p > max) e.push(`largo ${p} > ${max}`);
  // «fantasy» ya no es obligatoria (Carlos, 4 nov 13:00: «que sea predominante, pero si no encaja, que no vaya»)
  if (/https?:|www\.|\b[a-z0-9-]+\.(com|es|eus|net|org|io|app)\b/i.test(texto)) e.push('lleva un enlace');
  const ok = new Set(numeros.map((n) => String(Math.abs(Number(n)))));
  for (const t of texto.replace(/[0-9#*]\uFE0F?\u20E3/g, '').match(/\d+/g) || []) if (!ok.has(String(Number(t)))) e.push(`número ${t} que no está en los datos`);
  if (/\n{3,}/.test(texto)) e.push('demasiados saltos de línea');
  return { ok: e.length === 0, errores: e, peso: p };
}

// El validador de las tarjetas con imagen: cada texto del SVG se parte en cifras y palabras, y cada una tiene que estar en
// `permitidos` (sacados de los datos crudos de LaLiga en datos-tarjetas.mjs) o entre las palabras fijas de la tarjeta.
const desEsc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const minus = (s) => String(s).normalize('NFC').toLowerCase();
export function validarTarjeta(svg, { numeros = [], palabras = [] } = {}, fijas = []) {
  const e = [];
  const textos = [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((x) => desEsc(x[1]));
  if (!textos.length) e.push('la tarjeta no lleva texto');
  const okNum = new Set(numeros.flatMap((n) => String(n).replace('.', ',').match(/\d+(?:,\d+)?/g) || []));
  const okPal = new Set([...fijas, ...palabras, 'J'].flatMap((p) => String(p).match(/[\p{L}_]+/gu) || []).map(minus));
  for (const t of textos) {
    if (/https?:|www\.|\.(com|es|net|org|io|app)\b/i.test(t)) e.push(`enlace en la imagen: «${t}»`);
    for (const c of t.match(/\d+(?:,\d+)?/g) || []) if (!okNum.has(c)) e.push(`cifra ${c} que no está en los datos («${t}»)`);
    for (const w of t.match(/[\p{L}_]+/gu) || []) if (!okPal.has(minus(w))) e.push(`palabra «${w}» que no está en los datos («${t}»)`);
  }
  return { ok: e.length === 0, errores: [...new Set(e)], textos };
}
