// Prueba de la entrada de la web (0.8l): los tres pasos (abrir LaLiga, copiar la dirección, pegarla) en el iPhone, el
// ordenador y la web de un Android, sin tocar LaLiga ni gastar IA. Sirve web/ en local, corta todo lo que no sea localhost
// y contesta ella al canje del código (POST /p con la dirección de destino en la cabecera x-u). Comprueba:
//   1. el enlace «Abrir LaLiga» es un <a target="_blank"> con la redirect https, PKCE S256 y el state con la pista; el
//      inicio a medias (fm-n-pkce) no cambia al recargar ni al pulsar dos veces;
//   2. pegar entra solo: en el cuadro, en cualquier parte de la pantalla (ordenador), con «Pegar y entrar», con «Entrar» y
//      con la tecla Intro; el canje lleva la misma redirect, el código pegado y el verificador guardado;
//   3. lo que se pega mal se explica debajo del cuadro sin llamar a nadie (la página de entrar, la web propia, jwt.ms sin
//      código, nada); un enlace de otro intento, uno caducado y un corte de conexión dicen qué hacer y dejan repetir;
//   4. el error AADB2C90006 abre la ayuda y, en el ordenador, el método a mano, que canjea con la vuelta de la app;
//   5. sin portapapeles (o si el navegador no deja leerlo) todo sigue valiendo pegando a mano;
//   6. al volver de la pestaña de LaLiga, y también si la página se recarga, el paso de pegar queda por delante con el foco;
//   7. accesibilidad: nombres, etiquetas, alertas, orden del tabulador, pestañas con flechas y tamaño de lo que se toca;
//   8. la app de Android sigue igual: su vuelta de siempre y un inicio nuevo en cada toque.
// Uso: node .github/prueba-entrada.mjs   (PW_MODULO: ruta del index.mjs de playwright; MOTORES: «chromium», «webkit» o los
//      dos separados por coma, por defecto chromium y, si está instalado, webkit). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').then((m) => m.default || m).catch(() => import('playwright-core').then((m) => m.default || m));
const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  // el Worker de mentira: el semáforo, el embudo y lo demás contestan vacío (lo que importa, /p, lo contesta cada caso)
  if (/^\/(estado|embudo|hola|qr|vincular|caras|fallos)/.test(ruta)) { r.writeHead(204, { 'access-control-allow-origin': '*' }); r.end(); return; }
  try {
    const b = await readFile(join(WEB, ruta.endsWith('/') ? `${ruta}index.html` : ruta));
    r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
    r.end(b);
  } catch (e) { r.writeHead(404); r.end('no'); }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

let fallos = 0;
const bien = (m) => console.log(`BIEN ${m}`);
const mal = (m) => { fallos++; console.log(`MAL  ${m}`); };
const mira = (cond, m) => (cond ? bien(m) : mal(m));

const PISTA = 'copia-esta-direccion-entera-y-pegala-en-Fantasy-Manager-';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ID_TOKEN = `${b64({ alg: 'none' })}.${b64({ name: 'Prueba', emails: ['prueba@example.com'], exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;
const CODIGO = `eyJraWQiOiJwcnVlYmEi.${'A1b2C3d4-_'.repeat(150)}`;

/** una página nueva en la pantalla de entrar. canje(datos del canje) → { s, cuerpo } o null para «sin respuesta» */
async function abrir(nav, opciones, { antes = null } = {}) {
  const ctx = await nav.newContext(opciones);
  const reg = { canjes: [], pasos: [], errores: [], fuera: [], canje: () => ({ s: 200, cuerpo: { id_token: ID_TOKEN, refresh_token: 'r1', id_token_expires_in: 3600 } }) };
  await ctx.addInitScript((b) => { try { localStorage.setItem('fm-worker', b); localStorage.setItem('fm-proxy2', b); localStorage.setItem('fm-tour', '1'); } catch (e) { /* nada */ } }, BASE);
  if (antes) await ctx.addInitScript(antes);
  // nada sale de localhost: lo de fuera se corta (las rutas concretas de abajo mandan sobre esta)
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (r) => { reg.fuera.push(r.request().url().slice(0, 60)); r.abort(); });
  await ctx.route(/^https:\/\/login\.laliga\.es\//, (r) => r.fulfill({ contentType: 'text/html', body: '<title>LaLiga de mentira</title><p>entrar</p>' }));
  await ctx.route(`${BASE}/embudo`, (r) => { try { reg.pasos.push(JSON.parse(r.request().postData() || '{}').p); } catch (e) { /* nada */ } r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); });
  await ctx.route(`${BASE}/p`, (r) => {
    const q = r.request();
    const u = q.headers()['x-u'] || '';
    const cab = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-s, x-t' };
    // la API de LaLiga «falla» (500): tras entrar, la carga se queda en su pantalla de error y la sesión no se toca
    if (!/\/oauth2\/v2\.0\/token/.test(u)) { r.fulfill({ status: 200, headers: { ...cab, 'x-s': '500' }, body: '{}' }); return; }
    const d = Object.fromEntries(new URLSearchParams(q.postData() || ''));
    // (el semáforo de la pantalla también llama a /token para ver si LaLiga contesta: eso no es un canje)
    if (d.grant_type !== 'authorization_code') {
      if (d.refresh_token === 'r1') r.fulfill({ status: 200, headers: { ...cab, 'x-s': '200' }, body: JSON.stringify({ id_token: ID_TOKEN, refresh_token: 'r1', id_token_expires_in: 3600 }) });
      else r.fulfill({ status: 200, headers: { ...cab, 'x-s': '400' }, body: '{"error":"invalid_grant","error_description":"AADB2C90080"}' });
      return;
    }
    reg.canjes.push(d);
    const x = reg.canje(d);
    if (!x) { r.fulfill({ status: 200, headers: cab, body: 'sin respuesta' }); return; }
    r.fulfill({ status: 200, headers: { ...cab, 'x-s': String(x.s) }, body: JSON.stringify(x.cuerpo) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => reg.errores.push(String(e)));
  await p.goto(`${BASE}/index.html`);
  await p.waitForSelector('#entrar', { timeout: 20000 });
  return { ctx, p, reg };
}
const pkce = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('fm-n-pkce') || 'null'));
const sesion = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('fm-n-sesion') || 'null'));
const enlace = async (p) => { await p.waitForFunction(() => { const a = document.getElementById('edAbrir'); return a && a.getAttribute('href'); }, null, { timeout: 5000 }); return p.getAttribute('#edAbrir', 'href'); };
const vuelta = (estado, codigo = CODIGO) => `https://jwt.ms/?state=${encodeURIComponent(estado)}&code=${codigo}`;
/** pegar de verdad no se puede en todos los motores sin permiso: se manda el mismo evento que manda el navegador */
const pegar = (p, sel, texto) => p.evaluate(([s, t]) => {
  const el = s ? document.querySelector(s) : document.body;
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => t, files: [] } });
  el.dispatchEvent(ev);
}, [sel, texto]);
const errorVisto = async (p) => { await p.waitForFunction(() => { const e = document.getElementById('vueltaErr'); return e && !e.hidden && e.textContent; }, null, { timeout: 8000 }); return p.textContent('#vueltaErr'); };
const dentro = (p) => p.waitForFunction(() => !!localStorage.getItem('fm-n-sesion'), null, { timeout: 8000 }).then(() => true, () => false);

const DISPOSITIVOS = {
  iphone: () => ({ ...pw.devices['iPhone 13'] }),
  pc: () => ({ viewport: { width: 1280, height: 900 } }),
  android: () => ({ ...pw.devices['Pixel 7'] }),
};
// el contexto de un dispositivo en un motor que no es el suyo: se quita lo que ese motor no admite
const para = (motor, disp) => { const o = DISPOSITIVOS[disp](); delete o.defaultBrowserType; if (motor !== 'chromium') delete o.isMobile; return o; };

async function probar(motor, disp) {
  const T = `[${motor} · ${disp}]`;
  const nav = await pw[motor].launch(motor === 'chromium' ? { executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] } : {});
  const abrirDetalles = async (p) => { if (disp === 'android') await p.evaluate(() => { const d = document.querySelector('#entrarDirecto').closest('details'); if (d) d.open = true; }); };
  try {
    /* ---- 1. el enlace y el inicio a medias ---- */
    let { ctx, p, reg } = await abrir(nav, para(motor, disp));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' });
    mira(await p.isVisible('#entrarDirecto') === (disp !== 'android'), `${T} los tres pasos ${disp === 'android' ? 'van plegados (lo primero es Google Play)' : 'son lo primero que se ve'}`);
    await abrirDetalles(p);
    const h = new URL(await enlace(p));
    const pk = await pkce(p);
    mira(h.origin === 'https://login.laliga.es' && /\/oauth2\/v2\.0\/authorize$/.test(h.pathname), `${T} el enlace va a la página de entrar de LaLiga`);
    mira(h.searchParams.get('redirect_uri') === 'https://jwt.ms' && h.searchParams.get('code_challenge_method') === 'S256' && h.searchParams.get('response_type') === 'code', `${T} con la redirect https y PKCE S256`);
    mira(pk && pk.vuelta === 'https://jwt.ms' && pk.estado === h.searchParams.get('state') && pk.estado.startsWith(PISTA) && /^[A-Za-z0-9_-]+$/.test(pk.estado), `${T} el state lleva la pista y solo letras, números y guiones`);
    mira(await p.getAttribute('#edAbrir', 'target') === '_blank' && /noopener/.test(await p.getAttribute('#edAbrir', 'rel') || ''), `${T} es un enlace de verdad a otra pestaña (no depende de window.open)`);
    await p.reload(); await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p);
    mira(await enlace(p) === h.href, `${T} al recargar, el mismo enlace (el inicio a medias no cambia)`);

    /* ---- 3. lo que se pega mal, sin llamar a nadie ---- */
    const malos = [
      [h.href, /aún no has terminado/, 'la dirección de la página de entrar'],
      ['https://fantasymanagerapp.com/', /dirección de Fantasy Manager/, 'la dirección de la propia web'],
      ['https://jwt.ms/', /le falta el final/, 'jwt.ms sin el código'],
      ['hola qué tal', /no es la dirección/, 'un texto cualquiera'],
    ];
    for (const [t, re, que] of malos) {
      await p.fill('#vueltaWeb', '');
      await pegar(p, '#vueltaWeb', t);
      const e = await errorVisto(p).catch(() => '');
      mira(re.test(e) && await p.getAttribute('#vueltaWeb', 'aria-invalid') === 'true', `${T} al pegar ${que} lo dice y marca el cuadro`);
    }
    await p.fill('#vueltaWeb', '');
    await p.click('#edEntrar');
    mira(/No hay nada pegado/.test(await errorVisto(p).catch(() => '')), `${T} «Entrar» con el cuadro vacío lo dice`);
    mira(reg.canjes.length === 0, `${T} nada de eso llama a LaLiga`);

    /* ---- abrir LaLiga: otra pestaña, y el paso de pegar por delante ---- */
    const [otra] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), p.click('#edAbrir')]);
    mira(!!otra && /login\.laliga\.es/.test(otra ? otra.url() : ''), `${T} «Abrir LaLiga» abre su página en otra pestaña`);
    await p.waitForFunction(() => document.getElementById('entrarDirecto').dataset.abierto === '1');
    const conBoton = await p.locator('#edPegar').count() > 0;
    mira(await p.evaluate(() => document.getElementById('edAbrir').classList.contains('sec') && (!document.getElementById('edPegar') || !document.getElementById('edPegar').classList.contains('sec'))), `${T} después el botón rojo pasa a ser el de pegar`);
    mira((await pkce(p)).abierto > 0 && (await pkce(p)).estado === pk.estado, `${T} se apunta que se ha abierto, con el mismo inicio`);
    // la vuelta a la pestaña: el foco, en lo que toca
    await p.bringToFront();
    await p.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
    await p.waitForFunction(() => document.getElementById('vueltaEst').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    mira(await p.evaluate(() => (document.activeElement || {}).id) === (conBoton ? 'edPegar' : 'vueltaWeb') && /copiado la dirección/.test(await p.textContent('#vueltaEst')), `${T} al volver, el foco va a pegar y se dice qué toca`);
    if (otra) await otra.close();

    /* ---- un enlace de otro intento, uno caducado y un corte ---- */
    await pegar(p, '#vueltaWeb', vuelta(`${PISTA}otro-intento`));
    mira(/otro intento/.test(await errorVisto(p).catch(() => '')) && reg.canjes.length === 0 && (await pkce(p)).estado === pk.estado, `${T} un enlace de otro intento se explica y no gasta el inicio`);
    reg.canje = () => ({ s: 400, cuerpo: { error: 'invalid_grant', error_description: 'AADB2C90080: The provided grant has expired.' } });
    await pegar(p, '#vueltaWeb', vuelta(pk.estado));
    mira(/ya no vale/.test(await errorVisto(p).catch(() => '')) && await p.inputValue('#vueltaWeb') === '', `${T} un enlace caducado dice que se abra LaLiga otra vez y vacía el cuadro`);
    mira((await pkce(p)).estado === pk.estado && await enlace(p) === h.href, `${T} y el mismo enlace sigue valiendo para repetir`);
    reg.canje = () => null;
    await p.fill('#vueltaWeb', '');
    await pegar(p, '#vueltaWeb', vuelta(pk.estado));
    mira(/Sin conexión/.test(await errorVisto(p).catch(() => '')) && (await p.inputValue('#vueltaWeb')).includes('code=') && !(await p.isDisabled('#edEntrar')), `${T} sin conexión no se pierde lo pegado y se puede volver a pulsar`);
    mira(reg.pasos.includes('x-caduca') && reg.pasos.includes('x-red') && reg.pasos.includes('p') && reg.pasos.includes('l'), `${T} el embudo apunta abrir, pegar y cada fallo`);

    /* ---- 2. entrar: Intro en el cuadro con lo que ya estaba pegado ---- */
    reg.canje = () => ({ s: 200, cuerpo: { id_token: ID_TOKEN, refresh_token: 'r1', id_token_expires_in: 3600 } });
    reg.canjes.length = 0;
    await p.focus('#vueltaWeb'); await p.keyboard.press('Enter');
    mira(await dentro(p), `${T} con Intro en el cuadro, entra`);
    const c = reg.canjes[0] || {};
    mira(c.redirect_uri === 'https://jwt.ms' && c.code === CODIGO && c.code_verifier === pk.verificador && c.grant_type === 'authorization_code', `${T} el canje lleva la misma redirect, el código entero (${CODIGO.length} letras) y el verificador guardado`);
    mira((await sesion(p)).renovar === 'r1' && (await pkce(p)) === null && reg.pasos.includes('ok'), `${T} queda la sesión y se borra el inicio a medias`);
    mira(reg.errores.length === 0, `${T} sin errores de la página${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();

    /* ---- 2b. pegar con texto alrededor entra solo, sin pulsar nada más ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    let k = await pkce(p);
    await pegar(p, '#vueltaWeb', `mira, es esta:\n${vuelta(k.estado)}\ngracias`);
    mira(await dentro(p) && (reg.canjes[0] || {}).code === CODIGO, `${T} pegar en el cuadro (con texto de más alrededor) entra solo`);
    await ctx.close();

    /* ---- 2c. el botón «Pegar y entrar» (lo copiado lo da el navegador tras el toque) ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp), { antes: () => { window.__copiado = ''; const c = { readText: () => (window.__copiado === null ? Promise.reject(new DOMException('no', 'NotAllowedError')) : Promise.resolve(window.__copiado)), writeText: () => Promise.resolve() }; try { Object.defineProperty(navigator, 'clipboard', { value: c, configurable: true }); } catch (e) { /* nada */ } } }));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    k = await pkce(p);
    await p.click('#edPegar');
    mira(/No tienes nada copiado/.test(await errorVisto(p).catch(() => '')), `${T} «Pegar y entrar» sin nada copiado lo dice`);
    await p.evaluate(() => { window.__copiado = null; });
    await p.click('#edPegar');
    mira(/Pégalo tú/.test(await errorVisto(p).catch(() => '')) && await p.evaluate(() => document.activeElement.id) === 'vueltaWeb', `${T} si el navegador no deja leer lo copiado, manda al cuadro y pone ahí el foco`);
    await p.evaluate((v) => { window.__copiado = v; }, vuelta(k.estado));
    await p.click('#edPegar');
    mira(await dentro(p) && (reg.canjes[0] || {}).code_verifier === k.verificador, `${T} «Pegar y entrar» con la dirección copiada entra de un toque`);
    await ctx.close();

    /* ---- 5. sin portapapeles: no hay botón y se pega a mano ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp), { antes: () => { try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) { /* nada */ } } }));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    k = await pkce(p);
    mira(await p.locator('#edPegar').count() === 0 && /^Pégala aquí/.test(await p.textContent('label[for="vueltaWeb"]')), `${T} sin portapapeles no sale el botón y el cuadro lo explica`);
    await p.fill('#vueltaWeb', vuelta(k.estado));
    await p.click('#edEntrar');
    mira(await dentro(p), `${T} escribiendo o pegando a mano y con «Entrar», entra`);
    await ctx.close();

    /* ---- 4. LaLiga deja de aceptar la vuelta https (AADB2C90006) ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    k = await pkce(p);
    await pegar(p, '#vueltaWeb', `https://jwt.ms/?error=redirect_uri_mismatch&error_description=${encodeURIComponent("AADB2C90006: The redirect URI 'https://jwt.ms' provided in the request is not registered for the client id.")}&state=${k.estado}`);
    mira(/AADB2C90006/.test(await errorVisto(p).catch(() => '')) && await p.evaluate(() => document.getElementById('edAyuda').open), `${T} el error AADB2C90006 se explica y abre «¿Algo no va?»`);
    if (disp === 'pc') {
      mira(await p.evaluate(() => document.querySelector('.ed-mano').open), `${T} y deja abierto el método a mano`);
      const m = new URL(await p.getAttribute('#edAMano', 'href'));
      mira(m.searchParams.get('redirect_uri') === 'authredirect://com.lfp.laligafantasy' && m.searchParams.get('state') === k.estado, `${T} el enlace del método a mano vuelve al esquema de la app, con el mismo inicio`);
      await pegar(p, '#vueltaWeb', `authredirect://com.lfp.laligafantasy?state=${k.estado}&code=${CODIGO}`);
      mira(await dentro(p) && (reg.canjes[0] || {}).redirect_uri === 'authredirect://com.lfp.laligafantasy', `${T} y lo pegado del método a mano se canjea con esa misma vuelta`);
    } else {
      mira(await p.locator('.ed-mano').count() === 0 && /código/.test(await p.textContent('#edRedir + dd')), `${T} y en el móvil manda al código (no hay método a mano)`);
    }
    await ctx.close();

    /* ---- 6. la página se recarga al volver (Safari descarga las pestañas de fondo) ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    k = await pkce(p);
    await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).then((x) => x.close()).catch(() => null), p.click('#edAbrir')]);
    await p.reload();
    await p.waitForFunction(() => { const c = document.getElementById('entrarDirecto'); return c && c.dataset.abierto === '1'; }, null, { timeout: 8000 }).catch(() => {});
    mira(await p.isVisible('#vueltaWeb') && /copiado la dirección/.test(await p.textContent('#vueltaEst')) && (await pkce(p)).estado === k.estado, `${T} tras recargar, el paso de pegar está a la vista (también si iba plegado) con el mismo inicio`);
    await pegar(p, '#vueltaWeb', vuelta(k.estado));
    mira(await dentro(p), `${T} y el enlace copiado antes de recargar sigue entrando`);
    await ctx.close();

    /* ---- 7. accesibilidad ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    const a11y = await p.evaluate(() => {
      const visible = (e) => !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden';
      const nombre = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map((i) => (document.getElementById(i) || {}).textContent || '').join(' ') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || (e.querySelector('img[alt]') || { alt: '' }).alt || '').trim();
      const R = document.getElementById('entrar');
      const tocables = [...R.querySelectorAll('a[href], button, input, summary, [role="tab"]')].filter(visible);
      const sinNombre = tocables.filter((e) => !nombre(e)).map((e) => e.outerHTML.slice(0, 80));
      // lo que se toca dentro de un texto corrido (un enlace en una frase) no cuenta para el tamaño
      const enLinea = (e) => e.tagName === 'A' && !e.classList.contains('btn') && !e.classList.contains('play-badge') && getComputedStyle(e).display === 'inline';
      const chicos = tocables.filter((e) => !enLinea(e)).map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.height < 44 || r.width < 44).map(([e, r]) => `${(e.id || e.className || e.tagName).toString().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      const dibs = [...R.querySelectorAll('svg.dib')].filter((s) => s.getAttribute('role') !== 'img' || (s.getAttribute('aria-label') || '').length < 30).length;
      const svgSueltos = [...R.querySelectorAll('svg:not(.dib):not(.qr)')].filter((s) => visible(s) && s.getAttribute('aria-hidden') !== 'true' && !s.getAttribute('aria-label')).length;
      const inp = document.getElementById('vueltaWeb');
      return {
        sinNombre, chicos, dibs, svgSueltos,
        etiqueta: !!(inp.labels && inp.labels.length && inp.labels[0].textContent.trim()),
        letra: parseFloat(getComputedStyle(inp).fontSize),
        describe: (inp.getAttribute('aria-describedby') || '').split(' ').every((i) => document.getElementById(i)),
        alerta: document.getElementById('vueltaErr').getAttribute('role') === 'alert',
        estado: document.getElementById('vueltaEst').getAttribute('aria-live') === 'polite',
        lista: document.querySelector('.ed-pasos').getAttribute('role') === 'list' && document.querySelectorAll('.ed-pasos > li').length === 3,
        titulo: !!document.querySelector('#entrarDirecto[aria-labelledby="edT"] h2#edT'),
        oficial: /\boficial\b/i.test(document.getElementById('entrarDirecto').textContent),
      };
    });
    mira(a11y.sinNombre.length === 0, `${T} todo lo que se toca tiene nombre${a11y.sinNombre.length ? `: ${a11y.sinNombre.join(' | ')}` : ''}`);
    mira(a11y.chicos.length === 0, `${T} todo lo que se toca mide 44 px o más${a11y.chicos.length ? `: ${a11y.chicos.join(' | ')}` : ''}`);
    mira(a11y.etiqueta && a11y.describe && a11y.alerta && a11y.estado, `${T} el cuadro tiene etiqueta a la vista, y su error y su estado se leen solos`);
    mira(a11y.letra >= 16, `${T} la letra del cuadro es de ${a11y.letra} px (con menos de 16, el iPhone amplía la página)`);
    mira(a11y.lista && a11y.titulo && a11y.dibs === 0 && a11y.svgSueltos === 0, `${T} los pasos son una lista con título y el dibujo tiene su texto alternativo`);
    mira(!a11y.oficial, `${T} los tres pasos no llaman «oficial» a nada`);
    // Android y Apple, cada uno en su bloque, con su logo; el del dispositivo desde el que se mira va primero (en el ordenador, Android)
    const bloques = await p.evaluate(() => {
      const and = document.querySelector('#entrar .plat-and'), ios = document.querySelector('#entrar .plat-ios');
      if (!and || !ios) return null;
      return {
        andAntes: !!(and.compareDocumentPosition(ios) & Node.DOCUMENT_POSITION_FOLLOWING),
        play: !!and.querySelector('a.play-badge[href*="play.google.com/store/apps/details"] img[alt*="Google Play"]'),
        logoAnd: !!and.querySelector('.plat-c .ent-logo svg.an'), logoIos: !!ios.querySelector('.plat-c .ent-logo svg.ap'),
        nombres: [and.querySelector('h2').textContent, ios.querySelector('h2').textContent],
        playEnApple: !!ios.querySelector('a[href*="play.google.com"]'),
        pasosEnApple: !!ios.querySelector('#entrarDirecto'),
      };
    });
    mira(bloques && bloques.play && bloques.logoAnd && bloques.nombres[0] === 'Android' && !bloques.playEnApple, `${T} el bloque de Android lleva su logo y la insignia de Google Play, y solo él`);
    mira(bloques && bloques.logoIos && /^iPhone/.test(bloques.nombres[1]) && bloques.pasosEnApple === (disp !== 'android'), `${T} el bloque de Apple lleva su logo${disp === 'android' ? ' y dice que se entra desde Safari' : ' y dentro, los tres pasos para entrar'}`);
    mira(bloques && bloques.andAntes === (disp !== 'iphone'), `${T} ${disp === 'iphone' ? 'primero el de Apple y debajo el de Android' : 'primero el de Android y debajo el de Apple'}`);
    if (disp === 'pc') {
      // el tabulador dentro de los tres pasos: abrir, pegar, el cuadro, entrar y la ayuda, en ese orden
      await p.focus('#edAbrir');
      const orden = [];
      for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); orden.push(await p.evaluate(() => (document.activeElement.id || document.activeElement.tagName))); }
      mira(orden.join(' ') === 'edPegar vueltaWeb edEntrar SUMMARY', `${T} el tabulador va en orden: ${orden.join(' → ')}`);
      // «Ya tengo la app»: plegado no pide nada; al desplegarlo sale el QR para la app y el cuadro del código
      mira(await p.evaluate(() => !document.getElementById('detApp').open && !document.querySelector('#eqQR svg')), `${T} el QR de la app va plegado y sin pedir nada`);
      await p.click('#detApp > summary');
      await p.waitForSelector('#eqQR svg', { timeout: 5000 }).catch(() => {});
      mira(await p.evaluate(() => !!document.querySelector('#eqQR svg')) && await p.isVisible('#codigoWeb'), `${T} al desplegar «Ya tengo la app» salen el QR y el cuadro del código`);
      await p.click('#detApp > summary');
      // pegar en cualquier parte de la pantalla (Ctrl + V sin apuntar a nada)
      k = await pkce(p);
      await pegar(p, null, 'una frase cualquiera');
      mira(await p.isHidden('#vueltaErr'), `${T} pegar fuera del cuadro algo que no es la dirección no hace nada`);
      await pegar(p, null, vuelta(k.estado));
      mira(await dentro(p), `${T} Ctrl + V en cualquier parte de la pantalla, con la dirección copiada, entra`);
    }
    mira(reg.errores.length === 0, `${T} sin errores de la página en todo lo anterior${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();

    /* ---- con el permiso de leer lo copiado ya dado (Chrome y Edge): al volver entra solo, sin tocar nada ---- */
    if (motor === 'chromium' && disp === 'pc') {
      ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
      await p.waitForSelector('#entrarDirecto'); await enlace(p);
      k = await pkce(p);
      const [o2] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), p.click('#edAbrir')]);
      if (o2) await o2.close();
      await p.bringToFront();
      await p.evaluate((v) => navigator.clipboard.writeText(v), vuelta(k.estado));
      await p.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
      mira(await dentro(p) && (reg.canjes[0] || {}).code === CODIGO, `${T} con el permiso del portapapeles ya dado, al volver con la dirección copiada entra solo`);
      await ctx.close();
      ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
      await p.waitForSelector('#entrarDirecto'); await enlace(p);
      const [o3] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), p.click('#edAbrir')]);
      if (o3) await o3.close();
      await p.bringToFront();
      await p.evaluate(() => navigator.clipboard.writeText('la lista de la compra'));
      await p.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
      await p.waitForTimeout(500);
      mira(await p.isHidden('#vueltaErr') && reg.canjes.length === 0 && await p.inputValue('#vueltaWeb') === '', `${T} y si lo copiado es otra cosa, ni lo enseña ni se queja`);
      await ctx.close();
    }

    /* ---- dentro del navegador de otra app (X, Instagram…) se avisa ---- */
    if (disp === 'iphone') {
      const o = para(motor, disp);
      ({ ctx, p, reg } = await abrir(nav, { ...o, userAgent: `${o.userAgent} Twitter for iPhone/10.60` }));
      await p.waitForSelector('#entrarDirecto');
      mira(/dentro de la app de X/.test(await p.textContent('.ed-ajena').catch(() => '')) && await p.locator('[data-accion="copiarWeb"]').count() === 1, `${T} dentro del navegador de X avisa de abrirla en Safari`);
      await ctx.close();
      ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
      await p.waitForSelector('#entrarDirecto');
      mira(await p.locator('.ed-ajena').count() === 0, `${T} en Safari normal no sale ese aviso`);
      await ctx.close();
    }
  } finally { await nav.close(); }
}

/* ---- 8. la app de Android: igual que estaba ---- */
async function probarApp() {
  const T = '[chromium · app de Android]';
  const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
  try {
    const { ctx, p, reg } = await abrir(nav, { ...DISPOSITIVOS.android(), defaultBrowserType: undefined }, {
      antes: () => {
        const m = {}; window.__abiertos = [];
        window.FantasyApp = { leer: (k) => (k in m ? m[k] : null), guardar: (k, v) => { m[k] = v; }, borrar: (k) => { delete m[k]; }, abrirLogin: (u) => { window.__abiertos.push(u); }, canal: () => 'play', version: () => 99999, nombreVersion: () => 'prueba', __m: m };
      },
    });
    await p.waitForSelector('[data-accion="entrar"]');
    mira(await p.locator('#entrarDirecto').count() === 0 && await p.locator('#vueltaWeb').count() === 0, `${T} un solo botón de entrar, sin pasos de copiar y pegar`);
    await p.click('[data-accion="entrar"]');
    await p.waitForFunction(() => window.__abiertos.length === 1);
    await p.click('[data-accion="entrar"]');
    await p.waitForFunction(() => window.__abiertos.length === 2);
    const [a, b] = (await p.evaluate(() => window.__abiertos)).map((u) => new URL(u));
    const pk = await p.evaluate(() => JSON.parse(window.FantasyApp.__m.pkce));
    mira(a.searchParams.get('redirect_uri') === 'authredirect://com.lfp.laligafantasy' && pk.vuelta === 'authredirect://com.lfp.laligafantasy', `${T} la vuelta es la de siempre (authredirect://)`);
    mira(!a.searchParams.get('state').includes('copia') && a.searchParams.get('state') !== b.searchParams.get('state') && pk.estado === b.searchParams.get('state'), `${T} el state es al azar y nuevo en cada toque, como antes`);
    mira(reg.errores.length === 0, `${T} sin errores de la página${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();
  } finally { await nav.close(); }
}

const hayWebkit = await pw.webkit.launch().then((n) => n.close().then(() => true), () => false);
const motores = (process.env.MOTORES || (hayWebkit ? 'chromium,webkit' : 'chromium')).split(',').map((x) => x.trim()).filter(Boolean);
for (const motor of motores) for (const disp of ['iphone', 'pc', 'android']) {
  try { await probar(motor, disp); } catch (e) { mal(`[${motor} · ${disp}] la prueba se ha roto: ${String(e && e.stack ? e.stack : e).split('\n').slice(0, 4).join(' / ')}`); }
}
try { await probarApp(); } catch (e) { mal(`[app de Android] la prueba se ha roto: ${String(e && e.stack ? e.stack : e).split('\n').slice(0, 4).join(' / ')}`); }
servidor.close();
console.log(fallos ? `\n${fallos} cosas MAL` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
