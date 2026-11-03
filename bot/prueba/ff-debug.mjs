import { DOMParser } from 'linkedom';
import { get } from '../lib/http.mjs';
const cad = (el) => { const xs = []; for (let p = el, i = 0; p && i < 7; p = p.parentElement, i++) xs.push(`${p.tagName.toLowerCase()}${p.id ? '#' + p.id : ''}.${(p.getAttribute('class') || '').split(' ').slice(0, 3).join('.')}`); return xs.join(' < '); };
for (const [url, nombres] of [['https://www.futbolfantasy.com/laliga/lesionados', ['Joaquín', 'Lemar', 'Valverde']], ['https://www.futbolfantasy.com/laliga/sancionados', ['Vini', 'Vinícius', 'Mingueza']]]) {
  const r = await get(url, { headers: { Accept: 'text/html' } });
  const doc = new DOMParser().parseFromString(r.b, 'text/html');
  console.log(`\n######## ${url}: ${r.s} ${r.b.length}`);
  for (const n of nombres) {
    const as = [...doc.querySelectorAll('a[href*="/jugadores/"]')].filter((a) => (a.textContent || '').includes(n));
    console.log(`\n== ${n}: ${as.length} enlaces`);
    const a = as[0]; if (!a) continue;
    let b = a; for (let i = 0; i < 4 && b.parentElement; i++) { b = b.parentElement; if ((b.textContent || '').length > 250) break; }
    console.log('cadena:', cad(a));
    console.log('bloque:', b.outerHTML.replace(/\s+/g, ' ').slice(0, 2500));
  }
}
