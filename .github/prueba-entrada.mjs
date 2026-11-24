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
//   8. la app de Android: su vuelta de siempre y un inicio nuevo cada vez que se abre LaLiga; (21 nov) la primera vez, el
//      aviso de «Abrir con» como paso propio y después encima del botón; al volver sin el código, «¿No has vuelto solo?»
//      con las dos salidas, el paso x-vuelve y el botón de repetir; si vuelve con el código, nada de eso; con Auth Tab
//      (la app nueva), sin aviso;
//   9. (21 nov) la portada según el dispositivo: en el iPhone el botón rojo es «Entrar», sin nada de Google Play arriba y
//      con lo de entrar en la primera pantalla; en el ordenador, «iPhone y ordenador» antes que Android; en la web de un
//      Android, como estaba;
//  10. (21 nov) los pasos: «llega» al llegar, «ver» solo con lo de entrar a la vista y «v» al volver de LaLiga; y la marca
//      de las pruebas (?prueba=1, o un navegador manejado por un programa): nada sale hacia el Worker de verdad.
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
async function abrir(nav, opciones, { antes = null, ruta = '/index.html' } = {}) {
  const ctx = await nav.newContext(opciones);
  const reg = { canjes: [], pasos: [], errores: [], fuera: [], canje: () => ({ s: 200, cuerpo: { id_token: ID_TOKEN, refresh_token: 'r1', id_token_expires_in: 3600 } }) };
  await ctx.addInitScript((b) => { try { localStorage.setItem('fm-worker', b); localStorage.setItem('fm-proxy2', b); localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); } catch (e) { /* nada */ } }, BASE);
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
  await p.goto(`${BASE}${ruta}`);
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
    // un enlace de otro intento: LaLiga no lo canjea con el verificador de aquí (PKCE) y se dice que es de otro intento
    reg.canje = () => ({ s: 400, cuerpo: { error: 'invalid_grant', error_description: 'AADB2C90183: The provided code_verifier is invalid.' } });
    await pegar(p, '#vueltaWeb', vuelta(`${PISTA}otro-intento`));
    mira(/otro intento/.test(await errorVisto(p).catch(() => '')) && (await pkce(p)).estado === pk.estado, `${T} un enlace de otro intento se explica y no gasta el inicio`);
    reg.canjes.length = 0;
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

    /* ---- 2b'. si el state volviera cambiado (mayúsculas, un trozo de menos) pero el código es de este inicio, entra igual ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await abrirDetalles(p); await enlace(p);
    k = await pkce(p);
    await pegar(p, '#vueltaWeb', vuelta(k.estado.toLowerCase().slice(0, 40)));
    mira(await dentro(p) && (reg.canjes[0] || {}).code_verifier === k.verificador, `${T} la entrada no depende de que el state vuelva idéntico: con el código de este inicio, entra`);
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
    // (24 nov) cada dispositivo con su símbolo (el robot de Android y dos dibujos propios: ni la manzana ni el logo de
    // Windows) y una sola cosa que hacer; lo de entrar, en el bloque del dispositivo desde el que se mira
    const bloques = await p.evaluate(() => {
      const ent = document.querySelector('#entrar');
      const filas = [...document.querySelectorAll('.tl-l .tl-f')].map((f) => ({ d: f.dataset.d, tuyo: f.classList.contains('tuyo'), robot: !!f.querySelector('.tl-g svg.an'), dibujo: !!f.querySelector('.tl-g svg.dv'),
        nombre: f.querySelector('.tl-n b').textContent.trim(), play: !!f.querySelector('a.play-badge[href*="play.google.com/store/apps/details"] img[alt*="Google Play"]'), guia: (f.querySelector('a.tl-ir') || { getAttribute: () => '' }).getAttribute('href') }));
      const mio = ent.querySelector('.plat-and, .plat-ios');
      return { filas, manzana: document.querySelectorAll('svg.ap').length, tit: (document.querySelector('.tl-h') || {}).textContent || '',
        mioLogo: !!mio.querySelector('.plat-c .ent-logo svg'), mioNombre: mio.querySelector('h2').textContent, pasosDentro: !!mio.querySelector('#entrarDirecto'),
        playEnEntrar: ent.querySelectorAll('a[href*="play.google.com"]').length, playEnPagina: document.querySelectorAll('.pantalla a[href*="play.google.com"]').length };
    });
    const fila = (d) => (bloques.filas.find((f) => f.d === d) || {});
    mira(/Tu liga,\s*por dentro/i.test(bloques.tit) && bloques.manzana === 0, `${T} arriba dice qué es la app («Tu liga, por dentro») y no hay ninguna manzana`);
    mira(bloques.filas.length === (disp === 'iphone' ? 2 : 3) && fila('android').robot && (disp === 'iphone' || fila('iphone').dibujo) && (disp === 'pc' ? fila('pc').dibujo && /Windows y Mac/.test(fila('pc').nombre) : fila('pc').dibujo),
      `${T} los dispositivos van con su símbolo: el robot de Android, un móvil y un portátil («Ordenador · Windows y Mac»)`);
    mira(disp === 'iphone' ? bloques.filas.every((f) => !f.tuyo) : bloques.filas[0].d === disp && bloques.filas[0].tuyo && bloques.filas.filter((f) => f.tuyo).length === 1,
      `${T} ${disp === 'iphone' ? 'en el iPhone, arriba solo la frase: los otros dispositivos van debajo de los pasos' : 'el tuyo va el primero y destacado'}`);
    mira(disp === 'iphone' ? bloques.playEnPagina === 0 && fila('android').guia === 'instalar.html#android' : fila('android').play,
      `${T} ${disp === 'iphone' ? 'en el iPhone no hay ningún enlace a Google Play: la fila de Android lleva a la guía' : 'la fila de Android lleva la insignia de Google Play'}`);
    mira(bloques.mioLogo && bloques.pasosDentro && (disp === 'iphone' ? /iPhone/.test(bloques.mioNombre) : disp === 'pc' ? /ordenador/i.test(bloques.mioNombre) : /Android/.test(bloques.mioNombre)),
      `${T} lo de entrar va en el bloque de tu dispositivo («${bloques.mioNombre}»), con su símbolo`);
    if (disp === 'pc') {
      // un solo QR a la vista, el de tenerla en el móvil; al desplegar «Ya tengo la app» sale el de entrar y ese se quita
      const qrs = () => p.evaluate(() => [...document.querySelectorAll('#entrar svg.qr, #entrar #eqQR svg')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => (e.closest('#qrMovil') ? 'movil' : e.closest('#detApp') ? 'entrar' : 'otro')));
      const q1 = await qrs();
      mira(q1.length === 1 && q1[0] === 'movil' && /¿La quieres en el móvil\?/.test(await p.textContent('#qrMovil')) && /Ya tengo la app en el móvil/.test(await p.textContent('#detApp > summary')), `${T} en el ordenador hay un solo QR a la vista, el de tenerla en el móvil, con su rótulo (${q1.join(', ')})`);
      await p.click('#detApp > summary');
      await p.waitForSelector('#eqQR svg', { timeout: 5000 }).catch(() => {});
      const q2 = await qrs();
      mira(q2.length === 1 && q2[0] === 'entrar', `${T} al desplegar «Ya tengo la app en el móvil» sale el QR de entrar y el otro se quita (${q2.join(', ')})`);
      await p.click('#detApp > summary');
      // instalar como app: el botón no sale hasta que el navegador avisa (Chrome y Edge), y entonces abre su ventana
      mira(await p.isHidden('[data-accion="instalarPc"]'), `${T} «Instalar como app» no sale mientras el navegador no lo ofrezca`);
      await p.evaluate(() => { const ev = new Event('beforeinstallprompt', { cancelable: true }); ev.prompt = () => { window.__instalar = (window.__instalar || 0) + 1; }; ev.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(ev); });
      mira(await p.isVisible('[data-accion="instalarPc"]'), `${T} cuando el navegador lo ofrece, sale «Instalar como app» en la fila del ordenador`);
      await p.click('[data-accion="instalarPc"]'); await p.waitForTimeout(200);
      mira(await p.evaluate(() => window.__instalar === 1) && await p.isHidden('[data-accion="instalarPc"]'), `${T} al pulsarlo abre la ventana de instalar del navegador y el botón se quita`);
    } else {
      await p.evaluate(() => { const ev = new Event('beforeinstallprompt', { cancelable: true }); ev.prompt = () => {}; ev.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(ev); });
      mira(await p.locator('[data-accion="instalarPc"]:visible').count() === 0, `${T} en el móvil no se ofrece instalar la web`);
    }
    if (disp === 'pc') {
      // el tabulador dentro de los tres pasos: abrir, pegar, el cuadro, entrar y la ayuda, en ese orden
      await p.focus('#edAbrir');
      const orden = [];
      for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); orden.push(await p.evaluate(() => (document.activeElement.id || document.activeElement.tagName))); }
      mira(orden.join(' ') === 'edPegar vueltaWeb edEntrar SUMMARY', `${T} el tabulador va en orden: ${orden.join(' → ')}`);
      // «Ya tengo la app»: plegado no espera a nadie; al desplegarlo sale el QR para la app y el cuadro del código
      mira(await p.evaluate(() => !document.getElementById('detApp').open), `${T} el QR de la app va plegado`);
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

    /* ---- 9. la portada según el dispositivo ---- */
    ({ ctx, p, reg } = await abrir(nav, para(motor, disp)));
    await p.waitForSelector('#entrarDirecto', { state: 'attached' }); await p.waitForTimeout(300);
    {
      const P = await p.evaluate(() => {
        const y = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
        const bar = document.querySelector('.pt-bar');
        const rojo = bar.querySelector('.btn.pt-cta');
        const tl = document.querySelector('#pTenla');
        return { rojoT: rojo.textContent.trim(), rojoH: rojo.getAttribute('href'), playBarra: bar.querySelectorAll('a[href*="play.google.com"]').length, playSec: !!bar.querySelector('a.sec[href*="play.google.com"]'),
          insignia: !!document.querySelector('.pantalla .play-badge'), yEntrar: y('#entrar'), yPortal: y('.po-h1'), yBoton: y('#edAbrir'), yTenla: y('#pTenla'), yInsignia: y('.tl-f .play-badge'), alto: innerHeight,
          tuya: (tl.querySelector('.tl-f.tuyo') || { dataset: {} }).dataset.d || '', ancla: !!document.querySelector(rojo.getAttribute('href').startsWith('#') ? rojo.getAttribute('href') : 'body') };
      });
      if (disp === 'iphone') {
        mira(P.rojoT === 'Entrar' && P.rojoH === '#entrar' && P.ancla, `${T} el botón rojo de la barra es «Entrar» y baja a #entrar`);
        mira(P.playBarra === 0 && !P.insignia, `${T} arriba no hay nada de Google Play (ni en la barra ni la insignia)`);
        mira(P.yTenla < P.yBoton && P.yEntrar < P.yPortal && P.yBoton > 0 && P.yBoton < P.alto - 60, `${T} qué es la app y lo de entrar van lo primero, y «Abrir LaLiga y entrar» cabe en la primera pantalla (y=${P.yBoton} de ${P.alto})`);
      } else if (disp === 'pc') {
        mira(P.rojoT === 'Entrar' && P.rojoH === '#entrar' && P.playBarra === 1 && P.playSec, `${T} en la barra, «Entrar» en rojo y Google Play en secundario`);
        mira(P.tuya === 'pc' && P.yTenla < P.yPortal && P.yBoton < P.alto - 60, `${T} qué es la app va por encima de los datos, con el ordenador destacado, y «Abrir LaLiga y entrar» cabe en la primera pantalla (y=${P.yBoton} de ${P.alto})`);
      } else {
        mira(/^Descargar/.test(P.rojoT) && /play\.google\.com/.test(P.rojoH) && P.tuya === 'android' && P.yTenla < P.yPortal && P.yInsignia > 0 && P.yInsignia < P.alto - 60, `${T} en la web de un Android: «Descargar» en rojo, y arriba qué es la app con la insignia de Google Play en la primera pantalla (y=${P.yInsignia} de ${P.alto})`);
      }
    }
    /* ---- 10. los pasos: llega, ver (solo a la vista) y v (vuelve de LaLiga) ---- */
    {
      await p.waitForTimeout(400);
      mira(reg.pasos.includes('llega'), `${T} al llegar se apunta «llega»`);
      if (disp === 'android') {
        mira(!reg.pasos.includes('ver'), `${T} sin bajar hasta lo de entrar no se apunta «ver»`);
        await p.evaluate(() => document.querySelector('#entrar .plat').scrollIntoView({ block: 'center' }));
        await p.waitForFunction(() => true); await p.waitForTimeout(700);
        mira(reg.pasos.includes('ver'), `${T} al bajar hasta lo de entrar, «ver»`);
      } else mira(reg.pasos.includes('ver'), `${T} con el botón de entrar a la vista, «ver»`);
      mira(reg.pasos.filter((x) => x === 'llega').length === 1 && reg.pasos.filter((x) => x === 'ver').length === 1, `${T} una sola vez cada uno`);
      await abrirDetalles(p); await enlace(p);
      const [otra] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), p.click('#edAbrir')]);
      if (otra) await otra.close();
      await p.bringToFront();
      await p.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
      await p.waitForTimeout(500);
      mira(reg.pasos.filter((x) => x === 'l').length === 1 && reg.pasos.filter((x) => x === 'v').length === 1, `${T} abrir LaLiga apunta «l» y volver a la pestaña, «v» (una vez): ${reg.pasos.join(' ')}`);
      await p.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
      await p.waitForTimeout(300);
      mira(reg.pasos.filter((x) => x === 'v').length === 1, `${T} volver otra vez sin haber abierto LaLiga de nuevo no suma otra «v»`);
    }
    await ctx.close();
    /* ---- 10b. la marca de las pruebas: con el Worker de verdad no sale nada ---- */
    {
      const DE_VERDAD = 'https://worker-de-verdad.example';
      const sinMarca = (w) => { try { localStorage.setItem('fm-worker', w); localStorage.setItem('fm-proxy2', w); localStorage.removeItem('fm-prueba'); Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (e) { /* nada */ } };
      // un visitante de verdad (sin marca): sus pasos salen hacia el Worker
      ({ ctx, p, reg } = await abrir(nav, para(motor, disp), { antes: `(${sinMarca})(${JSON.stringify(DE_VERDAD)})` }));
      await p.waitForTimeout(600);
      mira(reg.fuera.some((u) => u.startsWith(`${DE_VERDAD}/embudo`)), `${T} un visitante sin marca sí manda sus pasos al Worker`);
      await ctx.close();
      // el mismo, llegando con ?prueba=1 y una campaña: no manda nada, la marca se queda y la dirección se limpia
      ({ ctx, p, reg } = await abrir(nav, para(motor, disp), { antes: `(${sinMarca})(${JSON.stringify(DE_VERDAD)})`, ruta: '/index.html?prueba=1&utm_source=X-iOS&l=1' }));
      await p.waitForTimeout(600);
      const m = await p.evaluate(() => ({ marca: localStorage.getItem('fm-prueba'), origen: JSON.parse(localStorage.getItem('fm-origen') || '{}').o, busca: location.search, pasos: window.__pasosPrueba }));
      mira(!reg.fuera.some((u) => u.includes('/embudo')) && m.marca === 'true' && m.pasos.includes('llega'), `${T} con ?prueba=1 no sale ningún paso hacia el Worker (se quedan en la página: ${m.pasos.join(' ')})`);
      mira(m.origen === 'x-ios' && !/prueba|utm_/.test(m.busca), `${T} la campaña se guarda («${m.origen}») y la dirección queda limpia («${m.busca}»)`);
      // y en la visita siguiente, ya sin ?prueba=1, sigue marcado (se quita el removeItem del arranque)
      await p.addInitScript(() => { try { localStorage.setItem('fm-prueba', 'true'); } catch (e) { /* nada */ } });
      await p.goto(`${BASE}/index.html`); await p.waitForSelector('#entrar'); await p.waitForTimeout(500);
      mira(!reg.fuera.some((u) => u.includes('/embudo')), `${T} y sigue sin contar en la visita siguiente`);
      await ctx.close();
      // un navegador manejado por un programa (navigator.webdriver), sin marca guardada: tampoco
      ({ ctx, p, reg } = await abrir(nav, para(motor, disp), { antes: `(${((w) => { try { localStorage.setItem('fm-worker', w); localStorage.setItem('fm-proxy2', w); localStorage.removeItem('fm-prueba'); Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => true, configurable: true }); } catch (e) { /* nada */ } })})(${JSON.stringify(DE_VERDAD)})` }));
      await p.waitForTimeout(600);
      mira(!reg.fuera.some((u) => u.includes('/embudo')), `${T} un navegador manejado por un programa (navigator.webdriver) tampoco cuenta`);
      await ctx.close();
    }

    /* ---- 11. (21 nov) el iPhone que llega de un anuncio, dentro de X, y la app de la pantalla de inicio ---- */
    if (disp === 'iphone') {
      const o = para(motor, disp);
      // en Safari, con la dirección del anuncio: dos frases y el botón en la primera pantalla, sin nada de Google Play
      ({ ctx, p, reg } = await abrir(nav, o, { ruta: '/index.html?utm_source=x-ios' }));
      await p.waitForSelector('#entrarDirecto'); await p.waitForTimeout(300);
      let L = await p.evaluate(() => { const b = document.getElementById('edAbrir').getBoundingClientRect(); const e = document.getElementById('entrar'); const est = document.getElementById('estadoLL');
        return { frases: (document.querySelector('.lleg p') || {}).textContent || '', y: Math.round(b.top), alto: innerHeight, play: e.querySelectorAll('a[href*="play.google.com"], img[src*="google-play"]').length, playArriba: document.querySelectorAll('.pt-bar a[href*="play.google.com"], .po-top .play-badge').length,
          menu: getComputedStyle(document.querySelector('.pt-menu')).display, semaforoDebajo: !!(est && (document.getElementById('edAbrir').compareDocumentPosition(est) & Node.DOCUMENT_POSITION_FOLLOWING)), aviso: document.querySelectorAll('.em-aviso').length }; });
      mira(/a quién vender/.test(L.frases) && L.y > 0 && L.y < L.alto - 60, `${T} llegando del anuncio: qué es la app en dos frases y «Abrir LaLiga y entrar» en la primera pantalla (y=${L.y} de ${L.alto})`);
      mira(L.play === 0 && L.playArriba === 0 && L.menu === 'none' && L.semaforoDebajo, `${T} sin nada de Google Play, sin el menú del portal por encima y con el semáforo debajo`);
      mira(L.aviso === 0, `${T} el aviso de la pantalla de inicio ya no sale antes de entrar`);
      mira(reg.pasos.includes('llega') && reg.pasos.includes('ver'), `${T} y se apuntan «llega» y «ver» con su campaña`);
      await ctx.close();
      // lo mismo dentro de X: «Abrir en Safari» lo primero, con la campaña marcada, y los pasos de aquí como salida
      ({ ctx, p, reg } = await abrir(nav, { ...o, userAgent: `${o.userAgent} Twitter for iPhone/11.40` }, { ruta: '/index.html?utm_source=x-ios' }));
      await p.waitForSelector('#edSafari');
      const hs = await p.getAttribute('#edSafari', 'href');
      mira(/^x-safari-https:\/\/127\.0\.0\.1:\d+\/index\.html\?utm_source=x-ios-safari$/.test(hs), `${T} dentro de X, «Abrir en Safari» es un enlace x-safari-https:// con la campaña «x-ios-safari»`);
      mira(await p.evaluate(() => { const a = document.getElementById('edSafari').getBoundingClientRect(), b = document.getElementById('edAbrir').getBoundingClientRect(); return a.top < b.top && a.height >= 44; }), `${T} va antes que los tres pasos y mide 44 px o más`);
      await p.evaluate(() => document.getElementById('edSafari').addEventListener('click', (e) => e.preventDefault()));
      await p.click('#edSafari');
      await p.waitForFunction(() => (document.getElementById('edSafariNo') || {}).textContent, null, { timeout: 4000 }).catch(() => {});
      mira(reg.pasos.includes('saf') && /Si Safari no se ha abierto/.test(await p.textContent('#edSafariNo')) && await p.evaluate(() => document.querySelector('.ed-safari-mas').open) && await p.isVisible('#edAbrir'), `${T} si Safari no se abre, a los 2 s lo dice, despliega las otras salidas y los tres pasos siguen ahí (paso «saf» apuntado)`);
      await ctx.close();
      // abierta desde el icono de la pantalla de inicio, sin sesión: traer la cuenta con un código, lo primero
      ({ ctx, p, reg } = await abrir(nav, o, { antes: () => { try { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }); } catch (e) { /* nada */ } } }));
      await p.waitForSelector('#entrarDirecto');
      mira(await p.evaluate(() => { const c = document.querySelector('.plat-cod'), i = document.querySelector('.plat-ios'); return !!(c && i && (c.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING) && c.querySelector('#codigoWeb')); }), `${T} desde el icono de la pantalla de inicio, «¿Ya has entrado en Safari?» con el cuadro del código va lo primero`);
      // un código viejo en la dirección del icono no molesta: ni aviso ni error
      await p.goto(`${BASE}/index.html#codigo=ABCD2345`); await p.reload(); await p.waitForSelector('#entrar'); await p.waitForTimeout(2200);
      mira(await p.locator('.tostada').count() === 0 && !(await p.evaluate(() => location.hash)), `${T} y un código caducado en la dirección del icono no saca ningún aviso`);
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

/* ---- 8. la app de Android ---- */
// el puente de mentira: guarda, «abre» LaLiga (apunta la dirección) y contesta a las peticiones de la app (el canje del
// código; lo demás, sin respuesta). authTab: como la app nueva, que entra por Auth Tab
const PUENTE = (authTab, idToken) => {
  const m = {}; window.__abiertos = []; window.__pedidos = []; window.__vuelta = null;
  const resp = {};
  window.FantasyApp = {
    leer: (k) => (k in m ? m[k] : null), guardar: (k, v) => { m[k] = v; }, borrar: (k) => { delete m[k]; },
    abrirLogin: (u) => { window.__abiertos.push(u); }, canal: () => 'play', version: () => 99999, nombreVersion: () => 'prueba',
    loginPendiente: () => { const v = window.__vuelta; window.__vuelta = null; return v; },
    http: (id, metodo, url, cab, cuerpo) => {
      window.__pedidos.push({ metodo, url, cuerpo });
      const canje = /\/oauth2\/v2\.0\/token/.test(url) && /grant_type=authorization_code/.test(cuerpo || '');
      resp[id] = canje ? { s: 200, b: JSON.stringify({ id_token: idToken, refresh_token: 'r1', id_token_expires_in: 3600 }) } : { s: 0, e: 'sin red' };
      setTimeout(() => window.__http(id), 20);
    },
    respuesta: (id) => { const r = resp[id]; delete resp[id]; return JSON.stringify(r || { s: 0 }); },
    __m: m,
  };
  if (authTab) window.FantasyApp.authTab = () => true;
};
async function probarApp() {
  const T = '[chromium · app de Android]';
  const nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
  const O = { ...DISPOSITIVOS.android(), defaultBrowserType: undefined };
  const pasos = (p) => p.evaluate(() => window.__pasosPrueba.slice());
  const abiertos = (p) => p.evaluate(() => window.__abiertos.length);
  try {
    let { ctx, p, reg } = await abrir(nav, O, { antes: `(${PUENTE})(false, ${JSON.stringify(ID_TOKEN)})` });
    await p.waitForSelector('[data-accion="entrar"]');
    mira(await p.locator('#entrarDirecto').count() === 0 && await p.locator('#vueltaWeb').count() === 0, `${T} un solo botón de entrar, sin pasos de copiar y pegar`);
    mira(await p.locator('.abrir-con').count() === 0, `${T} la primera vez, la pantalla de entrar va sin el aviso encima`);
    // (24 nov) dentro de la app no sale nada de tenerla o descargarla: ni el bloque de dispositivos, ni Google Play, ni instalar
    mira(await p.locator('#pTenla, .tl-l, .pt-bar, [data-accion="instalarPc"], .pantalla a[href*="play.google.com"]').count() === 0 && !/descargar/i.test(await p.textContent('.pantalla')), `${T} dentro de la app no sale nada de descargar ni de otros dispositivos`);
    /* la primera vez: el aviso de «Abrir con» como paso propio, antes de abrir LaLiga */
    await p.click('[data-accion="entrar"]');
    await p.waitForSelector('#pantAbrirCon');
    const alt = await p.getAttribute('#pantAbrirCon svg.dib', 'aria-label') || '';
    mira(await abiertos(p) === 0 && !(await pasos(p)).includes('l'), `${T} el primer toque enseña el aviso y aún no abre LaLiga ni apunta «le da»`);
    mira(/Fantasy Manager/.test(alt) && /Abrir con/.test(alt) && /Solo una vez/.test(alt) && await p.getAttribute('#pantAbrirCon svg.dib', 'role') === 'img', `${T} el dibujo del cuadro de Android lleva su texto alternativo`);
    mira(/elige\s+Fantasy Manager/i.test((await p.textContent('#pantAbrirCon')).replace(/\s+/g, ' ')) && await p.evaluate(() => document.activeElement === document.querySelector('.av-t')), `${T} dice «elige Fantasy Manager» y el foco va al título`);
    const medidas = await p.evaluate(() => { const f = parseFloat(getComputedStyle(document.querySelector('.abrir-con.grande p')).fontSize); const b = document.querySelector('[data-accion="entrarYa"]').getBoundingClientRect(); return { f, alto: b.height, abajo: b.bottom, pant: innerHeight }; });
    mira(medidas.f >= 17 && medidas.alto >= 44 && medidas.abajo <= medidas.pant, `${T} el aviso va en letra grande (${medidas.f} px) y el botón de abrir cabe en la pantalla sin bajar`);
    await p.click('[data-accion="entrarYa"]');
    await p.waitForFunction(() => window.__abiertos.length === 1);
    await p.waitForSelector('[data-accion="entrar"]');
    mira((await pasos(p)).filter((x) => x === 'l').length === 1, `${T} «le da a entrar» se apunta al abrir LaLiga, una vez`);
    mira(await p.locator('.abrir-con svg.dib').count() === 1 && await p.locator('#pantAbrirCon').count() === 0, `${T} detrás queda la pantalla de entrar, ya con el aviso y su dibujo encima del botón`);
    /* a partir de ahí, un toque abre LaLiga directamente */
    await p.click('[data-accion="entrar"]');
    await p.waitForFunction(() => window.__abiertos.length === 2);
    mira(await p.locator('#pantAbrirCon').count() === 0, `${T} la segunda vez no hay paso de más: un toque y se abre LaLiga`);
    /* (24 nov, Carlos) el QR que se escanea desde Ajustes: el de descargar no es el de entrar, y la app dice dónde está el bueno */
    const alQR = async (texto) => { await p.evaluate((t) => window.qrLeido(t), texto); return ((await p.textContent('.tostada')) || '').replace(/\s+/g, ' '); };
    const tPlay = await alQR('https://play.google.com/store/apps/details?id=es.fantasymanager.app');
    mira(/es el de descargar la app, no el de entrar/.test(tPlay) && /«Ya tengo la app en el móvil: abrirla en este ordenador»/.test(tPlay), `${T} al escanear el QR de Google Play, la app dice que es el de descargar y qué hay que pulsar en la web`);
    const tWeb = await alQR('https://fantasymanagerapp.com/');
    mira(/es el de descargar la app, no el de entrar/.test(tWeb), `${T} y lo mismo con el QR que lleva a la web (el del iPhone)`);
    const tOtro = await alQR('WIFI:S:casa;T:WPA;P:1234;;');
    mira(/no es el de Fantasy Manager/.test(tOtro) && /«Ya tengo la app en el móvil: abrirla en este ordenador»/.test(tOtro), `${T} con un QR de otra cosa, que no es el suyo y dónde está`);
    const tBueno = await alQR('https://fantasymanagerapp.com/#qr=AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB');
    mira(!/descargar la app|no es el de Fantasy Manager/.test(tBueno), `${T} el QR de entrar no se confunde con el de descargar («${tBueno.slice(0, 50)}»)`);
    const [a, b] = (await p.evaluate(() => window.__abiertos)).map((u) => new URL(u));
    const pk = await p.evaluate(() => JSON.parse(window.FantasyApp.__m.pkce));
    mira(a.searchParams.get('redirect_uri') === 'authredirect://com.lfp.laligafantasy' && pk.vuelta === 'authredirect://com.lfp.laligafantasy', `${T} la vuelta es la de siempre (authredirect://)`);
    mira(!a.searchParams.get('state').includes('copia') && a.searchParams.get('state') !== b.searchParams.get('state') && pk.estado === b.searchParams.get('state'), `${T} el state es al azar y nuevo cada vez que se abre LaLiga, como antes`);
    /* vuelve a la app sin el código: a los 3 s, «¿No has vuelto solo?» */
    await p.evaluate(() => window.alVolver());
    await p.waitForTimeout(1500);
    mira(await p.locator('#pantNoVuelto').count() === 0, `${T} al volver no pregunta al momento (espera por si llega la vuelta)`);
    await p.waitForSelector('#pantNoVuelto', { timeout: 4000 }).catch(() => {});
    const nv = ((await p.textContent('#pantNoVuelto').catch(() => '')) || '').replace(/\s+/g, ' ');
    mira(/¿No has vuelto solo\?/.test(nv) && /Se abrió LaLiga Fantasy en vez de esta app/.test(nv) && /LaLiga dio un error/.test(nv), `${T} a los 3 s sin la vuelta sale «¿No has vuelto solo?» con las dos salidas`);
    mira(/Ajustes y entra en Aplicaciones/.test(nv) && /Abrir de forma predeterminada/.test(nv) && /Borrar preferencias predeterminadas/.test(nv), `${T} con la ruta de Ajustes para quitar el «Siempre»`);
    mira((await pasos(p)).filter((x) => x === 'x-vuelve').length === 1, `${T} y se apunta el paso «x-vuelve», una vez`);
    await p.evaluate(() => window.alVolver()); await p.waitForTimeout(3400);
    mira((await pasos(p)).filter((x) => x === 'x-vuelve').length === 1, `${T} volver otra vez sin haber abierto LaLiga no lo apunta de nuevo`);
    const tocables = await p.evaluate(() => [...document.querySelectorAll('#pantNoVuelto button, #pantNoVuelto summary')].map((e) => Math.round(e.getBoundingClientRect().height)));
    mira(tocables.every((h) => h >= 44), `${T} todo lo que se toca mide 44 px o más (${tocables.join(', ')})`);
    mira(await p.evaluate(() => window.atras()) === true && await p.locator('[data-accion="entrar"]').count() === 1 && await p.locator('#pantNoVuelto').count() === 0, `${T} el botón de atrás de Android vuelve a la pantalla de entrar`);
    /* repetir desde esa pantalla: un toque */
    await p.click('[data-accion="entrar"]'); await p.waitForFunction(() => window.__abiertos.length === 3);
    await p.evaluate(() => window.alVolver());
    await p.waitForSelector('#pantNoVuelto', { timeout: 5000 });
    await p.click('#pantNoVuelto [data-accion="entrarYa"]');
    await p.waitForFunction(() => window.__abiertos.length === 4);
    mira((await pasos(p)).filter((x) => x === 'l').length === 4, `${T} «Repetir» abre LaLiga con un toque y cuenta como otro intento`);
    /* ahora vuelve con el código: entra y no pregunta nada */
    const est = await p.evaluate(() => JSON.parse(window.FantasyApp.__m.pkce).estado);
    await p.evaluate((u) => { window.__vuelta = u; window.vueltaLogin(); window.alVolver(); }, `authredirect://com.lfp.laligafantasy?state=${est}&code=${CODIGO}`);
    await p.waitForFunction(() => window.__pasosPrueba.includes('ok'), null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(3500);
    const canje = (await p.evaluate(() => window.__pedidos)).find((x) => /oauth2\/v2\.0\/token/.test(x.url) && /authorization_code/.test(x.cuerpo || ''));
    const dc = canje ? Object.fromEntries(new URLSearchParams(canje.cuerpo)) : {};
    mira((await pasos(p)).includes('ok') && dc.code === CODIGO && dc.redirect_uri === 'authredirect://com.lfp.laligafantasy', `${T} con la vuelta de LaLiga entra: el canje lleva el código y la misma redirect`);
    mira(await p.locator('#pantNoVuelto').count() === 0 && (await pasos(p)).filter((x) => x === 'x-vuelve').length === 2, `${T} y habiendo vuelto con el código no sale «¿No has vuelto solo?»`);
    mira(reg.errores.length === 0, `${T} sin errores de la página${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();

    /* si Android cierra la app mientras se entra en LaLiga y se vuelve sin el código, también pregunta */
    ({ ctx, p, reg } = await abrir(nav, O, { antes: `(${PUENTE})(false, ${JSON.stringify(ID_TOKEN)})` }));
    await p.waitForSelector('[data-accion="entrar"]');
    await p.click('[data-accion="entrar"]'); await p.click('[data-accion="entrarYa"]');
    await p.waitForFunction(() => window.__abiertos.length === 1);
    await p.reload();
    await p.waitForSelector('#pantNoVuelto', { timeout: 8000 }).catch(() => {});
    mira(await p.locator('#pantNoVuelto').count() === 1, `${T} si la app se ha cerrado mientras tanto y se abre sin la vuelta, sale «¿No has vuelto solo?»`);
    await ctx.close();

    /* la app nueva, con Auth Tab: Android no pregunta «Abrir con» */
    ({ ctx, p, reg } = await abrir(nav, O, { antes: `(${PUENTE})(true, ${JSON.stringify(ID_TOKEN)})` }));
    await p.waitForSelector('[data-accion="entrar"]');
    await p.click('[data-accion="entrar"]');
    await p.waitForFunction(() => window.__abiertos.length === 1);
    mira(await p.locator('#pantAbrirCon').count() === 0 && await p.locator('.abrir-con').count() === 0, `${T} con Auth Tab no hay aviso de «Abrir con»: el primer toque abre LaLiga`);
    await p.evaluate(() => window.loginCerrado());
    await p.waitForSelector('#pantNoVuelto', { timeout: 1500 }).catch(() => {});
    const nv2 = ((await p.textContent('#pantNoVuelto').catch(() => '')) || '').replace(/\s+/g, ' ');
    mira(/LaLiga dio un error/.test(nv2) && !/Se abrió LaLiga Fantasy/.test(nv2) && (await pasos(p)).includes('x-vuelve'), `${T} con Auth Tab, al cerrar la pestaña sin terminar sale la pantalla al momento, solo con el error de LaLiga`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (Auth Tab)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
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
