// Prueba del puente de la app de iOS (ios/App/Puente/puente-ios.js) con la web de verdad, sin simulador ni Mac: sirve
// web/ en local, inyecta el puente al empezar cada documento (como hace Principal.swift) y pone en su lugar una parte
// nativa de mentira (window.webkit.messageHandlers.fm) que guarda, «abre» LaLiga y contesta a las peticiones. Con el
// motor de Safari (WebKit) y con Chromium. Nada sale de localhost. Comprueba:
//   1. la web se ve dentro de la app (clase en-app, canal «ios») y la pantalla de entrar es la de la app, sin el aviso de
//      «Abrir con» de Android;
//   2. «Entrar» abre la página de LaLiga con la vuelta de la app (authredirect://), PKCE S256 y el inicio a medias guardado
//      por el puente; la vuelta se entrega como en Android (loginPendiente y vueltaLogin), el canje lleva el código y el
//      verificador, y la sesión se guarda por el puente; la vuelta se recoge una sola vez;
//   3. lo guardado está al recargar la página (el puente nuevo se inyecta con lo que guardó la anterior) y se borra bien;
//   4. cerrar la ventana de entrar sin terminar: «¿No has vuelto solo?» solo con lo del error de LaLiga, sin nada de
//      Android;
//   5. la versión nueva: con la huella de iOS del paquete publicado («nativoIos») igual que la de la app, la ventana de
//      actualizar y «Actualizar ahora» pide la web nueva; si el paquete no la trae o es otra, nada (la app nueva llega por
//      la tienda); buscar la versión a mano dice que llega por la App Store;
//   6. los pasos de antes de entrar salen con el canal «ios»; lo que aún no hay en iOS no se ofrece (QR, fotos, alarma,
//      anuncios) y lo que se llama sin existir no rompe nada; el dictado dice qué hacer;
//   7. respuesta() de una petición que no existe, compartir una imagen vacía y abrir algo que no es https no hacen nada raro.
// Uso: node .github/prueba-ios.mjs   (PW_MODULO: ruta del index.mjs de playwright; MOTORES: «chromium», «webkit» o los
//      dos separados por coma, por defecto chromium y, si está instalado, webkit). Sale con 1 si algo falla.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PW_MODULO || 'playwright').then((m) => m.default || m).catch(() => import('playwright-core').then((m) => m.default || m));
const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const WEB = join(RAIZ, 'web');
const PUENTE = await readFile(join(RAIZ, 'ios', 'App', 'Puente', 'puente-ios.js'), 'utf8');
if (!PUENTE.includes('/*DATOS*/{}')) { console.log('MAL  puente-ios.js no tiene el hueco de los datos (/*DATOS*/{})'); process.exit(1); }
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer(async (q, r) => {
  const ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
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

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ID_TOKEN = `${b64({ alg: 'none' })}.${b64({ name: 'Prueba', emails: ['prueba@example.com'], exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;
const NATIVO = 'huella-ios-de-prueba';

/* La parte nativa de mentira, dentro de la página. Lo guardado vive en sessionStorage para que aguante una recarga, que es
   lo que hace la app de verdad: guarda en el llavero y, al cargar el documento siguiente, inyecta el puente con ello. */
const NATIVA = ({ puente, nativo, idToken, paquete }) => {
  const leerLl = () => { try { return JSON.parse(sessionStorage.getItem('fm-llavero') || '{}'); } catch (e) { return {}; } };
  const ponerLl = (m) => sessionStorage.setItem('fm-llavero', JSON.stringify(m));
  window.__msgs = []; window.__abiertos = []; window.__pedidos = []; window.__buscadas = 0;
  const fm = {
    postMessage: (m) => {
      window.__msgs.push(JSON.parse(JSON.stringify(m)));
      const ll = leerLl();
      if (m.a === 'guardar') { ll[m.k] = m.v; ponerLl(ll); }
      else if (m.a === 'borrar') { delete ll[m.k]; ponerLl(ll); }
      else if (m.a === 'abrirLogin') window.__abiertos.push(m.u);
      else if (m.a === 'buscarWeb') window.__buscadas++;
      else if (m.a === 'http') {
        window.__pedidos.push({ m: m.m, u: m.u, c: m.c, h: m.h });
        let r = { s: 0, e: 'sin red (prueba)' };
        if (/\/oauth2\/v2\.0\/token/.test(m.u) && /grant_type=authorization_code/.test(m.c || '')) r = { s: 200, b: JSON.stringify({ id_token: idToken, refresh_token: 'r1', id_token_expires_in: 3600 }), t: 'application/json' };
        else if (/fantasymanagerapp\.com\/paquete\.json/.test(m.u) && paquete) r = { s: 200, b: JSON.stringify(paquete), t: 'application/json' };
        setTimeout(() => window.FantasyApp.__r(m.id, JSON.stringify(r)), 15);
      }
    },
  };
  try { Object.defineProperty(window, 'webkit', { value: { messageHandlers: { fm } }, configurable: true, writable: true }); } catch (e) { window.webkit = { messageHandlers: { fm } }; }
  const datos = { guardado: leerLl(), version: 42, nombre: '0.0.0-prueba', nativo, web: { nativo, propia: '0.0.0-prueba', bajada: 0, archivos: 0, mirada: 0 }, via: '' };
  // eslint-disable-next-line no-new-func
  new Function(puente.replace('/*DATOS*/{}', JSON.stringify(datos)))();
};

const DISPOSITIVO = (motor) => { const o = { ...pw.devices['iPhone 13'] }; delete o.defaultBrowserType; if (motor !== 'chromium') delete o.isMobile; return o; };

async function abrir(nav, motor, { paquete = null, sesion = false } = {}) {
  const ctx = await nav.newContext(DISPOSITIVO(motor));
  const reg = { errores: [], fuera: [] };
  await ctx.addInitScript(() => { try { localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-sin-tema', '1'); } catch (e) { /* nada */ } });
  if (sesion) await ctx.addInitScript((t) => { try { if (!sessionStorage.getItem('fm-llavero')) sessionStorage.setItem('fm-llavero', JSON.stringify({ sesion: JSON.stringify({ token: t, idToken: t, renovar: 'r1', caduca: Date.now() + 3600e3 }) })); } catch (e) { /* nada */ } }, ID_TOKEN);
  await ctx.addInitScript(NATIVA, { puente: PUENTE, nativo: NATIVO, idToken: ID_TOKEN, paquete });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (r) => { reg.fuera.push(r.request().url().slice(0, 80)); r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => reg.errores.push(String(e)));
  await p.goto(`${BASE}/index.html`);
  return { ctx, p, reg };
}
const msgs = (p, a) => p.evaluate((x) => window.__msgs.filter((m) => m.a === x), a);
const llavero = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem('fm-llavero') || '{}'));
const tostada = (p) => p.evaluate(() => [...document.querySelectorAll('.tostada')].map((t) => t.textContent).join(' | '));

async function probar(motor) {
  const T = `[${motor} · app de iOS]`;
  const nav = await pw[motor].launch(motor === 'chromium' ? { executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] } : {});
  try {
    /* ---- 1 y 2: la pantalla de entrar y la entrada ---- */
    let { ctx, p, reg } = await abrir(nav, motor);
    await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
    const ini = await p.evaluate(async () => {
      const pu = await import('./js/puente.js');
      return { enApp: pu.enApp, canal: pu.nativo.canal(), clase: document.documentElement.classList.contains('en-app'), version: pu.nativo.version(), nombre: pu.nativo.nombreVersion(), huella: pu.nativo.huellaNativa(), authTab: pu.nativo.authTab(), web: pu.nativo.estadoWeb() };
    });
    mira(ini.enApp && ini.clase && ini.canal === 'ios', `${T} la web se ve dentro de la app y el canal es «ios»`);
    mira(ini.version === 42 && ini.nombre === '0.0.0-prueba' && ini.huella === NATIVO && ini.authTab === true && ini.web && ini.web.nativo === NATIVO, `${T} versión, huella nativa y estado de la web salen de los datos inyectados`);
    const pant = ((await p.textContent('#entrar')) || '').replace(/\s+/g, ' ');
    mira(/Entrar con mi cuenta de LaLiga/.test(pant) && (await p.locator('.abrir-con').count()) === 0 && (await p.locator('#edAbrir').count()) === 0, `${T} la pantalla de entrar es la de la app, sin el aviso de «Abrir con» ni los tres pasos de la web`);
    await p.click('[data-accion="entrar"]');
    await p.waitForFunction(() => window.__abiertos.length === 1, null, { timeout: 8000 });
    const u = new URL((await p.evaluate(() => window.__abiertos))[0]);
    const pk = JSON.parse((await llavero(p)).pkce || 'null');
    mira(u.hostname === 'login.laliga.es' && u.searchParams.get('redirect_uri') === 'authredirect://com.lfp.laligafantasy' && u.searchParams.get('code_challenge_method') === 'S256' && !!u.searchParams.get('code_challenge'), `${T} «Entrar» abre LaLiga con la vuelta de la app y PKCE S256`);
    mira(!!pk && pk.estado === u.searchParams.get('state') && pk.vuelta === 'authredirect://com.lfp.laligafantasy' && pk.verificador.length > 40, `${T} el inicio a medias se guarda por el puente`);
    mira((await p.locator('#pantAbrirCon').count()) === 0, `${T} el primer toque abre LaLiga, sin paso previo`);
    // la vuelta, como la entrega Principal.swift
    await p.evaluate((estado) => { window.FantasyApp.__pon({ login: `authredirect://com.lfp.laligafantasy?state=${encodeURIComponent(estado)}&code=CODIGO123`, via: 'sesion-ios' }); return window.vueltaLogin(); }, pk.estado).catch(() => {});
    await p.waitForFunction(() => !!JSON.parse(sessionStorage.getItem('fm-llavero') || '{}').sesion, null, { timeout: 8000 }).catch(() => {});
    const canje = (await p.evaluate(() => window.__pedidos)).find((x) => /\/token/.test(x.u) && /authorization_code/.test(x.c || ''));
    const d = canje ? Object.fromEntries(new URLSearchParams(canje.c)) : {};
    mira(!!canje && canje.m === 'POST' && d.code === 'CODIGO123' && d.code_verifier === pk.verificador && d.redirect_uri === 'authredirect://com.lfp.laligafantasy', `${T} el canje va por el puente con el código, el verificador y la misma vuelta`);
    const ll = await llavero(p);
    const ses = JSON.parse(ll.sesion || 'null');
    mira(!!ses && (ses.token || ses.idToken) && !ll.pkce, `${T} la sesión se guarda por el puente y el inicio a medias se borra`);
    mira((await msgs(p, 'loginRecogido')).length === 1 && (await p.evaluate(() => window.FantasyApp.loginPendiente())) === null, `${T} la vuelta se recoge una sola vez`);
    mira((await p.evaluate(async () => (await import('./js/util.js')).LS.get('login-via', null)))?.via === 'sesion-ios', `${T} queda apuntado por dónde llegó la vuelta`);

    /* ---- 3: lo guardado, al recargar ---- */
    await p.reload();
    await p.waitForFunction(() => !!window.FantasyApp && !!window.S, null, { timeout: 20000 });
    const tras = await p.evaluate(async () => { const a = await import('./js/auth.js'); return { hay: a.haySesion(), leer: !!window.FantasyApp.leer('sesion'), nada: window.FantasyApp.leer('no-existe') }; });
    mira(tras.hay && tras.leer && tras.nada === null, `${T} al recargar, la sesión sigue ahí (el puente nuevo lleva lo guardado) y lo que no existe es null`);
    await p.evaluate(async () => { const pu = await import('./js/puente.js'); pu.guardar('gemini', 'AQ.clave'); pu.guardar('gemini', null); });
    mira(!('gemini' in (await llavero(p))) && (await p.evaluate(() => window.FantasyApp.leer('gemini'))) === null, `${T} borrar quita lo guardado`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (entrada)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();

    /* ---- 4: se cierra la ventana de entrar sin terminar ---- */
    ({ ctx, p, reg } = await abrir(nav, motor));
    await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
    await p.click('[data-accion="entrar"]');
    await p.waitForFunction(() => window.__abiertos.length === 1, null, { timeout: 8000 });
    await p.evaluate(() => { window.loginCerrado(); window.alVolver(); });
    await p.waitForSelector('#pantNoVuelto', { timeout: 3000 }).catch(() => {});
    const nv = ((await p.textContent('#pantNoVuelto').catch(() => '')) || '').replace(/\s+/g, ' ');
    mira(/LaLiga dio un error/.test(nv) && !/Android|Se abrió LaLiga Fantasy/.test(nv), `${T} al cerrar la ventana sin entrar sale «¿No has vuelto solo?» solo con lo de LaLiga, sin nada de Android`);
    await p.click('[data-accion="volverEntrar"]');
    mira(await p.locator('[data-accion="entrar"]').count() === 1, `${T} «Ahora no» vuelve a la pantalla de entrar`);

    /* ---- 6 y 7: el canal, lo que aún no hay y lo que no debe hacer nada ---- */
    const varios = await p.evaluate(async () => {
      const pu = await import('./js/puente.js'), se = await import('./js/semaforo.js');
      const n = pu.nativo;
      const antes = window.__msgs.length;
      const r = {
        paso: se.canalPaso(), qr: n.hayQR(), fotos: n.hayFotos(), alarma: n.hayAlarma(), anuncios: n.hayAnuncios(), inter: n.hayIntersticial(), priv: n.hayPrivacidadAnuncios(), avisoPreg: n.hayAvisoPregunta(),
        permitidos: n.avisosPermitidos(), fondo: n.estadoFondo(), imagen: n.hayImagen(),
      };
      // lo que se llama sin existir en iOS: no puede romper
      try { n.programarAvisos([]); n.pedirPermisoAvisos(); n.notificar('a', 'b'); n.programarFondo(true, 0); n.fondoTerminado(); n.planEnMarcha('x', 'y'); n.planAcabado(); n.zonaAnuncios(true, '', true); n.verAnuncio('plan'); n.cancelarAnuncio(); n.actualizar('https://x'); n.instalar(); r.sinRomper = true; } catch (e) { r.sinRomper = String(e); }
      r.mensajesDeMas = window.__msgs.length - antes;
      r.sinRespuesta = window.FantasyApp.respuesta('no-existe');
      r.imagenVacia = n.compartirImagen('', '');
      n.abrir('javascript:alert(1)'); n.abrir('http://sin-https.example');
      r.abiertos = window.__msgs.filter((m) => m.a === 'abrir').length;
      n.abrir('https://fantasymanagerapp.com/privacidad.html'); n.copiar('hola'); n.compartir('texto'); n.toque(); n.teclado(); n.trabajando(true, 'x', 'y'); n.trabajando(false);
      r.buenos = ['abrir', 'copiar', 'compartir', 'toque', 'teclado', 'trabajando'].map((a) => window.__msgs.filter((m) => m.a === a).length).join(',');
      r.imagenBuena = n.compartirImagen(`data:image/png;base64,${'A'.repeat(200)}`, 'pie');
      return r;
    });
    mira(varios.paso === 'ios', `${T} los pasos de antes de entrar salen con el canal «ios»`);
    mira(!varios.qr && !varios.fotos && !varios.alarma && !varios.anuncios && !varios.inter && !varios.priv && !varios.avisoPreg && varios.permitidos === false && varios.fondo === null, `${T} lo que aún no hay en iOS no se ofrece (QR, fotos, alarma, anuncios, avisos)`);
    mira(varios.sinRomper === true && varios.mensajesDeMas === 0, `${T} llamar a lo que no existe no rompe ni manda nada a la app`);
    mira(varios.sinRespuesta === '{"s":0,"e":"sin respuesta"}' && varios.imagenVacia === false && varios.abiertos === 0, `${T} una respuesta que no existe, una imagen vacía y abrir algo que no es https no hacen nada`);
    mira(varios.buenos === '1,1,1,1,1,2' && varios.imagen && varios.imagenBuena === true, `${T} abrir, copiar, compartir, el toque, el teclado y «trabajando» llegan a la app`);
    await p.evaluate(() => window.FantasyApp.voz());
    await p.waitForFunction(() => /micrófono del teclado/.test([...document.querySelectorAll('.tostada')].map((t) => t.textContent).join(' ')), null, { timeout: 3000 }).catch(() => {});
    mira(/micrófono del teclado/.test(await tostada(p)), `${T} el dictado dice que se use el micrófono del teclado`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (varios)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    mira(reg.fuera.filter((x) => !/assets-fantasy|laliga|fonts\.g|googletag|gstatic/.test(x)).length === 0, `${T} la página no pide nada a otros sitios por su cuenta${reg.fuera.length ? ` (${reg.fuera.slice(0, 3).join(', ')})` : ''}`);
    await ctx.close();

    /* ---- 5: la versión nueva ---- */
    for (const [nombre, paquete, sale] of [
      ['el paquete publicado no trae la huella de iOS', { version: '99.0.0', nativo: 'huella-android', huella: 'h', archivos: {} }, false],
      ['la huella de iOS publicada es otra', { version: '99.0.0', nativo: 'huella-android', nativoIos: 'otra', huella: 'h', archivos: {} }, false],
      ['la huella de iOS publicada es la de la app', { version: '99.0.0', nativo: 'huella-android', nativoIos: NATIVO, huella: 'h', archivos: {} }, true],
    ]) {
      ({ ctx, p, reg } = await abrir(nav, motor, { paquete }));
      await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
      await p.waitForFunction(() => window.__pedidos.some((x) => /paquete\.json/.test(x.u)), null, { timeout: 8000 }).catch(() => {});
      await p.waitForSelector('#forzar', { timeout: sale ? 5000 : 1200 }).catch(() => {});
      const hay = await p.locator('#forzar').count();
      mira((hay === 1) === sale, `${T} versión nueva publicada y ${nombre}: ${sale ? 'sale la ventana de actualizar' : 'no sale nada (la app nueva llega por la tienda)'}`);
      if (sale) {
        const tx = ((await p.textContent('#forzar')) || '').replace(/\s+/g, ' ');
        mira(/99\.0\.0/.test(tx) && !/Google Play/.test(tx), `${T} la ventana dice la versión y no habla de Google Play`);
        await p.click('#forzar [data-accion="ponerAppNueva"]');
        await p.waitForFunction(() => window.__buscadas === 1, null, { timeout: 3000 }).catch(() => {});
        mira((await p.evaluate(() => window.__buscadas)) === 1, `${T} «Actualizar ahora» le pide la web nueva a la app`);
        // la app contesta que ya la ha bajado: la página se recarga con ella
        const recarga = p.waitForEvent('load', { timeout: 8000 }).then(() => true, () => false);
        await p.evaluate(() => window.webBuscada('nueva'));
        mira(await recarga, `${T} con la web nueva bajada, la página se recarga`);
      }
      await ctx.close();
    }
    ({ ctx, p, reg } = await abrir(nav, motor, { sesion: true }));
    await p.waitForFunction(() => !!window.S && typeof window.alVolver === 'function', null, { timeout: 20000 });
    await p.evaluate(() => { const b = document.createElement('button'); b.dataset.accion = 'buscarVersion'; document.body.appendChild(b); b.click(); });
    await p.waitForFunction(() => /App Store/.test([...document.querySelectorAll('.tostada')].map((t) => t.textContent).join(' ')), null, { timeout: 4000 }).catch(() => {});
    const ts = await tostada(p);
    mira(/llegan por la App Store/.test(ts) && !/Google Play/.test(ts), `${T} buscar la versión a mano dice que llega por la App Store${/App Store/.test(ts) ? '' : ` (sale: «${ts}»)`}`);
    await ctx.close();
  } finally { await nav.close(); }
}

const hayWebkit = await pw.webkit.launch().then((n) => n.close().then(() => true), () => false);
const motores = (process.env.MOTORES || (hayWebkit ? 'chromium,webkit' : 'chromium')).split(',').map((x) => x.trim()).filter(Boolean);
for (const motor of motores) {
  try { await probar(motor); } catch (e) { mal(`[${motor} · app de iOS] la prueba se ha roto: ${String(e && e.stack ? e.stack : e).split('\n').slice(0, 5).join(' / ')}`); }
}
servidor.close();
console.log(fallos ? `\n${fallos} cosas MAL` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
