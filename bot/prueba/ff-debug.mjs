import { DOMParser } from 'linkedom';
import { get } from '../lib/http.mjs';
for (const slug of ['athletic', 'real-madrid']) {
  const r = await get(`https://www.futbolfantasy.com/laliga/equipos/${slug}`, { headers: { Accept: 'text/html' } });
  const doc = new DOMParser().parseFromString(r.b, 'text/html');
  const ws = [...doc.querySelectorAll('.camiseta-wrapper')];
  console.log(`# ${slug}: ${r.s}, ${r.b.length} bytes, ${ws.length} camisetas`);
  const cad = (el) => { const xs = []; for (let p = el.parentElement, i = 0; p && i < 6; p = p.parentElement, i++) xs.push(`${p.tagName.toLowerCase()}${p.id ? '#' + p.id : ''}.${(p.getAttribute('class') || '').split(' ').slice(0, 3).join('.')}`); return xs.join(' < '); };
  let prev = '';
  for (const w of ws) {
    const c = cad(w);
    if (c !== prev) { console.log(`\n  [${c}]`); prev = c; }
    const as = [...w.querySelectorAll('a[href*="/jugadores/"]')];
    console.log(`   onceff=${w.getAttribute('data-onceff')} cls=${w.getAttribute('class')} :: ${as.map((a) => `${(a.getAttribute('href') || '').split('/').pop()}(${a.getAttribute('data-probabilidad') || ''}|${(a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)})`).join(' ; ')} :: txt=${(w.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)}`);
  }
}
