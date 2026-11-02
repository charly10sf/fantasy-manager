// El validador: nada sale si falla. Comprueba el largo, la palabra «fantasy», que no haya enlaces y que cada número
// del texto esté entre los datos con los que se ha escrito.
import { peso } from './texto.mjs';

export function validar(texto, { numeros = [], max = 280 } = {}) {
  const e = [];
  const p = peso(texto);
  if (p > max) e.push(`largo ${p} > ${max}`);
  if (!/fantasy/i.test(texto)) e.push('sin la palabra «fantasy»');
  if (/https?:|www\.|\b[a-z0-9-]+\.(com|es|eus|net|org|io|app)\b/i.test(texto)) e.push('lleva un enlace');
  const ok = new Set(numeros.map((n) => String(Math.abs(Number(n)))));
  for (const t of texto.match(/\d+/g) || []) if (!ok.has(String(Number(t)))) e.push(`número ${t} que no está en los datos`);
  if (/\n{3,}/.test(texto)) e.push('demasiados saltos de línea');
  return { ok: e.length === 0, errores: e, peso: p };
}
