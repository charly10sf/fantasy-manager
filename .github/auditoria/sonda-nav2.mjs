import { pagina, cerrar } from '../ia/banco.mjs';
const P = await pagina('martes');
const page = P.page;
const out = [];
const est = () => page.evaluate(() => ({ tipo: window.S.tipoHoja ? window.S.tipoHoja.join(':') : null, hoja: !!window.S.hoja, h2: (document.querySelector('.hoja h2') || {}).textContent || '', volver: !!document.querySelector('.hoja .volver-h'), nj: document.querySelectorAll('.hoja [data-j]').length }));
const atras = async () => { await page.evaluate(() => window.atras && window.atras()); await page.waitForTimeout(450); };
const cerrarTodo = async () => { for (let i = 0; i < 5; i++) { if (!(await page.evaluate(() => !!window.S.hoja))) break; await atras(); } };
// 1. Directo → clasificación de la jornada → once de un rival (oj) → jugador → atrás
await page.evaluate(() => { location.hash = '#directo'; }); await page.waitForTimeout(700);
let n = await page.locator('#app [data-accion="onceJ"]').count();
if (!n) { await page.evaluate(() => { location.hash = '#rivales'; }); await page.waitForTimeout(600); n = await page.locator('#app [data-accion="onceJ"]').count(); }
out.push(`onceJ a la vista: ${n}`);
if (n) {
  await page.locator('#app [data-accion="onceJ"]').first().click({ force: true }); await page.waitForTimeout(600);
  const a = await est();
  out.push(`once de jornada: ficha ${a.tipo} «${a.h2.slice(0, 40)}», ${a.nj} jugadores dentro`);
  if (a.nj) { await page.locator('.hoja [data-j]').first().click({ force: true }); await page.waitForTimeout(600); const b = await est(); await atras(); const c = await est(); out.push(`   jugador → ${b.tipo} (volver: ${b.volver ? 'sí' : 'NO'}) · atrás → ${c.hoja ? c.tipo : 'SE CIERRA TODO'} ${c.tipo === a.tipo ? 'BIEN' : 'MAL'}`); }
}
await cerrarTodo();
// 2. ficha de un rival → su once de una jornada (oj) → atrás
await page.evaluate(() => { location.hash = '#rivales'; }); await page.waitForTimeout(600);
await page.locator('#app [data-r]').first().click({ force: true }); await page.waitForTimeout(700);
const r0 = await est();
const segs = await page.evaluate(() => [...document.querySelectorAll('.hoja [data-accion="segRival"], .hoja [data-accion="subRival"]')].map((e) => e.textContent.trim().slice(0, 18)));
out.push(`rival ${r0.tipo}: pestañas ${segs.join(' | ')}`);
for (const s of segs) {
  await page.evaluate((s) => { const b = [...document.querySelectorAll('.hoja [data-accion="segRival"], .hoja [data-accion="subRival"]')].find((e) => e.textContent.trim().slice(0, 18) === s); if (b) b.click(); }, s);
  await page.waitForTimeout(400);
  const k = await page.evaluate(() => ({ oj: document.querySelectorAll('.hoja [data-accion="onceJ"]').length, bloq: document.querySelectorAll('.hoja [data-accion="bloqueada"]').length, r: document.querySelectorAll('.hoja [data-r]').length }));
  if (k.oj) {
    await page.locator('.hoja [data-accion="onceJ"]').first().click({ force: true }); await page.waitForTimeout(600);
    const b = await est(); await atras(); const c = await est();
    out.push(`   [${s}] once de jornada desde el rival → ${b.tipo} (volver: ${b.volver ? 'sí' : 'NO'}) · atrás → ${c.hoja ? c.tipo : 'SE CIERRA TODO'} ${c.tipo === r0.tipo ? 'BIEN' : 'MAL'}`);
    if (c.tipo !== r0.tipo) { await cerrarTodo(); await page.locator('#app [data-r]').first().click({ force: true }); await page.waitForTimeout(600); }
  }
}
// 3. candado dentro de la ficha del rival (en la web: hoja de «función top») → Entendido
const hayB = await page.locator('.hoja [data-accion="bloqueada"]').count();
out.push(`candados en la ficha del rival: ${hayB}`);
if (hayB) {
  await page.locator('.hoja [data-accion="bloqueada"]').first().click({ force: true }); await page.waitForTimeout(600);
  const b = await page.evaluate(() => ({ txt: (document.querySelector('.hoja .bloq-hoja') || {}).innerText || '', tipo: window.S.tipoHoja ? window.S.tipoHoja.join(':') : null }));
  out.push(`   candado: «${b.txt.replace(/\s+/g, ' ').slice(0, 260)}» (S.tipoHoja ${b.tipo})`);
  await page.locator('.hoja .bloq-hoja [data-accion="cerrarHoja"]').last().click({ force: true }); await page.waitForTimeout(600);
  const c = await est();
  out.push(`   tras «Entendido» → ${c.hoja ? c.tipo + ' «' + c.h2.slice(0, 30) + '»' : 'SE CIERRA TODO (vuelve a la lista de Rivales)'}`);
}
await cerrarTodo();
// 4. ficha de un jugador de un rival: ¿enlace al dueño (data-r)? → rival → atrás
await page.evaluate(() => { location.hash = '#mercado'; }); await page.waitForTimeout(600);
const conDueno = await page.evaluate(() => { const S = window.S; const x = (S.M.clausulas || []).find((c) => c.teamId && c.teamId !== (S.D.yo && S.D.yo.teamId)); return x ? x.pid : null; });
out.push(`jugador de un rival para probar: ${conDueno}`);
console.log(out.join('\n'));
await cerrar();
