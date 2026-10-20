/* Markdown sencillo para las respuestas de la IA: negritas, cursivas, listas y títulos. */
import { esc } from './util.js';

export function md(t) {
  const lineas = esc(t || '').split('\n');
  let h = '', lista = false;
  for (let l of lineas) {
    l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
    const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (m) { if (!lista) { h += '<ul>'; lista = true; } h += `<li>${m[1]}</li>`; continue; }
    if (lista) { h += '</ul>'; lista = false; }
    if (/^#{1,4}\s/.test(l)) { h += `<p><b>${l.replace(/^#+\s/, '')}</b></p>`; continue; }
    if (l.trim()) h += `<p>${l}</p>`;
  }
  if (lista) h += '</ul>';
  return h;
}
