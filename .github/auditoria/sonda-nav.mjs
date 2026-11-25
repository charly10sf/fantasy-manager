// Sonda de la auditoría: fichas que llevan jugadores/clubes dentro y no vuelven a la ficha de antes
import { pagina, cerrar } from '../ia/banco.mjs';
const P = await pagina('martes');
const page = P.page;
const out = [];
const estado = () => page.evaluate(() => ({ tipo: window.S.tipoHoja ? window.S.tipoHoja.join(':') : null, hoja: !!window.S.hoja, pila: (window.S.pila || []).map((x) => x[0]).join('>'), volver: !!document.querySelector('.hoja .volver-h'), dentro: { j: document.querySelectorAll('.hoja [data-j]').length, club: document.querySelectorAll('.hoja [data-club]').length, acc: [...new Set([...document.querySelectorAll('.hoja [data-accion]')].map((e) => e.dataset.accion))].join(',') } }));
const ir = async (v) => { await page.evaluate((v) => { location.hash = '#' + v; }, v); await page.waitForTimeout(500); };
const cerrarTodo = async () => { for (let i = 0; i < 4; i++) { const h = await page.evaluate(() => !!window.S.hoja); if (!h) break; await page.evaluate(() => window.atras && window.atras()); await page.waitForTimeout(350); } };
async function probar(nombre, abrir) {
  await cerrarTodo();
  try { await abrir(); } catch (e) { out.push(`${nombre}: no se pudo abrir (${String(e.message).slice(0, 80)})`); return; }
  await page.waitForTimeout(500);
  const a = await estado();
  if (!a.hoja) { out.push(`${nombre}: no abrió ficha`); return; }
  const linea = [`${nombre}: ficha ${a.tipo} · dentro: ${a.dentro.j} jugadores, ${a.dentro.club} clubes · acciones: ${a.dentro.acc.slice(0, 160)}`];
  for (const sel of ['.hoja [data-j]:not([data-accion])', '.hoja [data-club]:not([data-accion])', '.hoja [data-accion="verPartido"]', '.hoja [data-accion="rival"]', '.hoja [data-rival]']) {
    const hay = await page.locator(sel).count();
    if (!hay) continue;
    await page.locator(sel).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const b = await estado();
    if (b.tipo === a.tipo) { linea.push(`   ${sel}: no cambia de ficha`); continue; }
    await page.evaluate(() => window.atras && window.atras());
    await page.waitForTimeout(450);
    const c = await estado();
    linea.push(`   ${sel} → ${b.tipo} (volver: ${b.volver ? 'sí' : 'NO'}, pila ${b.pila || '-'}) · atrás → ${c.hoja ? c.tipo : 'SE CIERRA TODO'} ${c.tipo === a.tipo ? 'BIEN' : 'MAL'}`);
    if (c.tipo !== a.tipo) { await cerrarTodo(); await abrir().catch(() => {}); await page.waitForTimeout(400); }
  }
  out.push(linea.join('\n'));
}
await ir('rivales');
await probar('rival', async () => { await page.locator('[data-accion="rival"], [data-r]').first().click(); });
await ir('equipo');
await probar('jugador (Equipo)', async () => { await page.locator('#app [data-j]').first().click(); });
await probar('once de una jornada', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('button, [data-seg], [data-accion]')].find((e) => /Jornadas/i.test(e.textContent || '') && e.textContent.length < 20); if (b) b.click(); }); await page.waitForTimeout(500); await page.locator('[data-accion="onceJ"]').first().click(); });
await ir('directo');
await probar('partido (Directo)', async () => { await page.locator('#app [data-accion="verPartido"]').first().click(); });
await probar('resumen', async () => { await page.locator('#app [data-accion="resumen"]').first().click(); });
await ir('clubes');
await probar('club', async () => { await page.locator('#app [data-club]').first().click(); });
await probar('bajas', async () => { await page.locator('#app [data-accion="bajas"], #app [data-accion="verBajas"]').first().click(); });
await ir('mercado');
await probar('jugador (Mercado)', async () => { await page.locator('#app [data-j]').first().click(); });
await ir('hoy');
await probar('jugador (Hoy)', async () => { await page.locator('#app [data-j]').first().click(); });
await probar('resumen (Hoy)', async () => { await page.locator('#app [data-accion="resumen"]').first().click(); });
console.log(out.join('\n'));
console.log('errores de página:', P.errores ? P.errores.length : '?');
await cerrar();
