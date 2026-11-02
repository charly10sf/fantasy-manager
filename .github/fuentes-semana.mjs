// Quinta pasada (solo lectura): ¿qué traen las páginas de posibles titulares, lesionados y sancionados de futbolfantasy?
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const get = async (url) => {
  const t0 = Date.now();
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' }, signal: AbortSignal.timeout(25000) }); const b = await r.text(); return { s: r.status, b, ms: Date.now() - t0 }; }
  catch (e) { return { s: 0, b: '', ms: Date.now() - t0, err: String(e.cause?.code || e.message) }; }
};
const quita = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
const txt = (h) => quita(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const L = (t) => console.log(t);
// el texto de la página sin el menú: desde el primer «Jornada» o «Alineaciones»
const cuerpo = (h, marca) => { const t = txt(h); const i = t.search(marca); return i >= 0 ? t.slice(i) : t; };

L('## /laliga/posibles-alineaciones');
{
  const r = await get('https://www.futbolfantasy.com/laliga/posibles-alineaciones');
  L(`- ${r.s} · ${(r.b.length / 1024).toFixed(0)} KB`);
  const h = quita(r.b);
  L(`- porcentajes (N%) en el texto: ${(txt(r.b).match(/\b\d{1,3}\s?%/g) || []).length}; data-probabilidad=${(r.b.match(/data-probabilidad/g) || []).length}; data-lesion=${(r.b.match(/data-lesion/g) || []).length}; enlaces a /equipos/=${(r.b.match(/\/laliga\/equipos\//g) || []).length}; /jugadores/=${(r.b.match(/\/jugadores\//g) || []).length}`);
  L(`- encabezados: ${[...h.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/g)].map((m) => txt(m[1])).filter(Boolean).slice(0, 25).join(' | ')}`);
  const hrefs = [...new Set([...r.b.matchAll(/href="([^"#]*(?:alineacion|once|partido|previa)[^"#]*)"/gi)].map((m) => m[1]))];
  L(`- enlaces (alineacion|once|partido|previa): ${hrefs.slice(0, 25).join(' ')}`);
  const t = cuerpo(r.b, /Jornada \d+/);
  L(`- texto desde «Jornada»: «${t.slice(0, 1600)}»`);
}

L('\n## /laliga/lesionados');
{
  const r = await get('https://www.futbolfantasy.com/laliga/lesionados');
  const t = cuerpo(r.b, /Lesionados|Parte m[eé]dico|Baja/);
  L(`- ${r.s} · ${(r.b.length / 1024).toFixed(0)} KB · filas=${(r.b.match(/<tr[ >]/g) || []).length}`);
  const i = txt(r.b).search(/Lesionados LaLiga|Lista de lesionados|Jugadores lesionados/i);
  L(`- texto del cuerpo: «${txt(r.b).slice(Math.max(i, 0) + 0, Math.max(i, 0) + 1800)}»`);
}

L('\n## sancionados y otras');
for (const u of ['https://www.futbolfantasy.com/laliga/sancionados', 'https://www.futbolfantasy.com/laliga/apercibidos', 'https://www.futbolfantasy.com/laliga/clasificacion']) {
  const r = await get(u);
  const t = txt(r.b);
  L(`- ${u} → ${r.s || r.err} · ${(r.b.length / 1024).toFixed(0)} KB · «${(r.b.match(/<title>([^<]*)/) || [])[1]}»`);
  if (r.s === 200 && /sancionados/.test(u)) { const i = t.search(/Sancionados LaLiga|Jugadores sancionados|Sanci[oó]n/i); L(`  «${t.slice(Math.max(i, 0), Math.max(i, 0) + 1200)}»`); }
}

L('\n## /laliga/noticias: titulares y antigüedad');
{
  const r = await get('https://www.futbolfantasy.com/laliga/noticias');
  const arts = [...r.b.matchAll(/<a[^>]+href="(https:\/\/www\.futbolfantasy\.com\/laliga\/noticias\/\d+-[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1].split('/').pop().slice(0, 70), txt(m[2]).slice(0, 90)]);
  const vistos = new Set();
  let n = 0;
  for (const [slug, t] of arts) { if (vistos.has(slug) || n >= 14) continue; vistos.add(slug); n++; L(`- ${slug} · «${t}»`); }
  L(`- fechas/horas visibles: ${(txt(r.b).match(/hace \d+ (?:minutos?|horas?|días?)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}:\d{2}/g) || []).slice(0, 12).join(', ')}`);
}
