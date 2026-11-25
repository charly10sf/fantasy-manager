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
//   6. los pasos de antes de entrar salen con el canal «ios»; lo que aún no hay en iOS no se ofrece (QR, fotos) ni lo que
//      no puede haber (la IA con la app cerrada), y lo que se llama sin existir no rompe nada; el dictado dice qué hacer;
//   6b. (iOS 2) los avisos, el plan y la pregunta con la app cerrada y los anuncios llegan a la app como en Android: cada
//      llamada con sus datos, lo que la web lee al momento sale de lo que la app va diciendo (__pon), la alarma del
//      clausulazo solo se ofrece donde la hay, los bloques de anuncios de limites.json son los de iOS y en Ajustes no se
//      ofrece trabajar con la app cerrada;
//   7. respuesta() de una petición que no existe, compartir una imagen vacía y abrir algo que no es https no hacen nada raro.
//   8. (iOS 3) las fotos y la versión nueva (la App Store) llegan a la app; el QR y el dictado, solo donde el iPhone los
//      tiene; la IA, sin la clave de Google y con la ventana del permiso antes de mandar nada (qué dice, «No» y «Sí»); en la
//      liga de ejemplo, Pregunta y Ajustes sin la clave de Google; y con «iosMin», la versión nueva en la App Store.
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
const NATIVA = ({ puente, nativo, idToken, paquete, alarma, qr, voz }) => {
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
  const datos = { guardado: leerLl(), version: 42, nombre: '0.0.0-prueba', nativo, web: { nativo, propia: '0.0.0-prueba', bajada: 0, archivos: 0, mirada: 0 }, via: '', avisos: false, alarma: !!alarma, privacidad: false, vista: true, qr: !!qr, voz: !!voz };
  // eslint-disable-next-line no-new-func
  new Function(puente.replace('/*DATOS*/{}', JSON.stringify(datos)))();
};

const DISPOSITIVO = (motor) => { const o = { ...pw.devices['iPhone 13'] }; delete o.defaultBrowserType; if (motor !== 'chromium') delete o.isMobile; return o; };

async function abrir(nav, motor, { paquete = null, sesion = false, alarma = false, qr = false, voz = false, init = null } = {}) {
  const ctx = await nav.newContext(DISPOSITIVO(motor));
  const reg = { errores: [], fuera: [] };
  await ctx.addInitScript(() => { try { localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-sin-tema', '1'); } catch (e) { /* nada */ } });
  if (sesion) await ctx.addInitScript((t) => { try { if (!sessionStorage.getItem('fm-llavero')) sessionStorage.setItem('fm-llavero', JSON.stringify({ sesion: JSON.stringify({ token: t, idToken: t, renovar: 'r1', caduca: Date.now() + 3600e3 }) })); } catch (e) { /* nada */ } }, ID_TOKEN);
  if (init) await ctx.addInitScript(init);
  await ctx.addInitScript(NATIVA, { puente: PUENTE, nativo: NATIVO, idToken: ID_TOKEN, paquete, alarma, qr, voz });
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
    // (iOS 3) la clase de la app de iOS en <html> es «app-ios»: «.en-ios» ya es otra cosa en app.css (la tarjeta del iPhone),
    // y puesta en <html> enmarcaba la página entera y ponía los botones en blanco
    const cls = await p.evaluate(() => ({ app: document.documentElement.classList.contains('app-ios'), en: document.documentElement.classList.contains('en-ios'), boton: getComputedStyle(document.querySelector('[data-accion="entrar"]')).backgroundColor, borde: getComputedStyle(document.documentElement).borderTopWidth }));
    mira(cls.app && !cls.en && !/244, 242, 243/.test(cls.boton) && cls.borde === '0px', `${T} (iOS 3) <html> lleva «app-ios» y la página se ve como siempre (botón ${cls.boton})`);
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
        paso: se.canalPaso(), qr: n.hayQR(), fotos: n.hayFotos(), voz: n.hayVoz(), alarma: n.hayAlarma(), anuncios: n.hayAnuncios(), inter: n.hayIntersticial(), priv: n.hayPrivacidadAnuncios(), avisoPreg: n.hayAvisoPregunta(),
        permitidos: n.avisosPermitidos(), fondo: n.estadoFondo(), imagen: n.hayImagen(), hayFondo: n.hayFondo(), exactas: n.alarmasExactas(), vista: n.aLaVista(),
      };
      // lo que se llama sin existir en iOS: no puede romper
      try { n.programarFondo(true, 0); n.fondoTerminado(); n.pedirAlarmasExactas(); n.probarAlarma(10, 'a', 'b'); n.escanearQR(); n.voz(); r.sinRomper = true; } catch (e) { r.sinRomper = String(e); }
      r.mensajesDeMas = window.__msgs.length - antes;
      // (iOS 3) las fotos (con el selector del iPhone) y la versión nueva (la App Store) sí llegan a la app
      n.fotos(2); n.fotos(9); n.actualizar('https://x'); n.instalar();
      r.fotosMsgs = window.__msgs.filter((m) => m.a === 'fotos').map((m) => m.n).join(',');
      r.tienda = window.__msgs.filter((m) => m.a === 'tienda').length;
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
    mira(!varios.qr && !varios.voz && !varios.alarma && varios.fondo === null && varios.hayFondo === false, `${T} lo que este iPhone no tiene no se ofrece (QR, dictado, la alarma en un iPhone sin alarmas del sistema) ni la IA con la app cerrada`);
    mira(varios.fotos && varios.fotosMsgs === '2,4' && varios.tienda === 2, `${T} (iOS 3) las fotos se piden a la app (como mucho 4: ${varios.fotosMsgs}) y la versión nueva abre la App Store (${varios.tienda})`);
    mira(varios.anuncios && varios.inter && !varios.priv && varios.avisoPreg && varios.permitidos === false && varios.exactas === true && varios.vista === true, `${T} (iOS 2) hay anuncios y avisos; sin permiso de notificaciones y sin opciones de privacidad hasta que la app lo diga`);
    mira(varios.sinRomper === true && varios.mensajesDeMas === 0, `${T} llamar a lo que no existe no rompe ni manda nada a la app`);
    mira(varios.sinRespuesta === '{"s":0,"e":"sin respuesta"}' && varios.imagenVacia === false && varios.abiertos === 0, `${T} una respuesta que no existe, una imagen vacía y abrir algo que no es https no hacen nada`);
    mira(varios.buenos === '1,1,1,1,1,2' && varios.imagen && varios.imagenBuena === true, `${T} abrir, copiar, compartir, el toque, el teclado y «trabajando» llegan a la app`);
    /* ---- 6b (iOS 2): los avisos, el plan y la pregunta con la app cerrada y los anuncios ---- */
    const dos = await p.evaluate(async () => {
      const pu = await import('./js/puente.js'), li = await import('./js/limite.js'), ut = await import('./js/util.js');
      const n = pu.nativo, de = (a) => window.__msgs.filter((m) => m.a === a), r = {};
      const antes = window.__msgs.length;
      const lista = [{ id: 'c1', t: Date.now() + 60e3, titulo: 'Clausulazo', texto: 'Pedri', hash: 'rivales', alarma: true }, { id: 'diario', t: Date.now() + 3600e3, titulo: 'Tu liga hoy', texto: 'x', hash: '', cada: 86400e3 }];
      n.programarAvisos(lista); n.pedirPermisoAvisos(); n.notificar('Título', 'Texto', 'hoy');
      n.planEnMarcha('rid12345abc', 'SESION'); n.planAcabado();
      n.preguntaEnMarcha('preg1234abc', 'SESION', { 'rival 2': 'Marcos' }, '¿a quién vendo?'); n.preguntaAcabada(true, 'Vende a Pedri');
      n.zonaAnuncios(true, 'ca-app-pub-3175956326240112/9792190459', true); n.intersticial('ca-app-pub-3175956326240112/9792190459'); n.aperturaAnuncios(true, ''); n.verAnuncio('plan'); n.cancelarAnuncio(); n.privacidadAnuncios();
      r.avisos = JSON.parse(de('programarAvisos')[0].j);
      r.permiso = de('pedirPermisoAvisos').length;
      r.notificar = de('notificar')[0];
      r.plan = [de('planEnMarcha')[0], de('planAcabado').length];
      r.preg = [de('preguntaEnMarcha')[0], de('preguntaAcabada')[0]];
      // (la web ya le ha dicho antes a la app que aún no hay liga cargada: vale lo último)
      const ult = (a) => de(a).slice(-1)[0];
      r.zonaAntes = de('zonaAnuncios').slice(0, -1).every((m) => m.si === false);
      r.anuncios = [ult('zonaAnuncios'), ult('intersticial'), ult('aperturaAnuncios'), ult('verAnuncio'), de('cancelarAnuncio').length, de('privacidadAnuncios').length];
      r.mensajes = window.__msgs.length - antes;
      // lo que la web lee al momento, cuando la app lo cambia
      window.FantasyApp.__pon({ avisos: true, privacidad: true, vista: false });
      r.tras = [n.avisosPermitidos(), n.hayPrivacidadAnuncios(), n.aLaVista()];
      window.FantasyApp.__pon({ vista: true });
      // los bloques de anuncios de limites.json: en la app de iOS, los de iOS
      const g = ut.LS.get('limites', null);
      ut.LS.set('limites', { t: Date.now(), cfg: { intersticial: { on: true, bloque: 'ca-app-pub-3175956326240112/1111111111', bloqueIos: 'ca-app-pub-3175956326240112/2222222222' }, apertura: { on: true, bloque: '', bloqueIos: 'ca-app-pub-3175956326240112/3333333333' } } });
      r.bloques = [li.intersticialCfg().bloque, li.aperturaCfg().bloque];
      if (g) ut.LS.set('limites', g); else ut.LS.del('limites');
      return r;
    });
    mira(dos.avisos.length === 2 && dos.avisos[0].alarma === true && dos.avisos[1].cada === 86400e3 && dos.permiso === 1 && dos.notificar.t === 'Título' && dos.notificar.x === 'Texto' && dos.notificar.h === 'hoy', `${T} (iOS 2) la lista de avisos, el permiso y un aviso al momento llegan a la app`);
    mira(dos.plan[0].rid === 'rid12345abc' && dos.plan[0].tk === 'SESION' && dos.plan[1] === 1 && dos.preg[0].rid === 'preg1234abc' && dos.preg[0].tk === 'SESION' && !JSON.stringify(dos.preg[0]).includes('Marcos') && !JSON.stringify(dos.preg[0]).includes('vendo') && dos.preg[1].ok === true && dos.preg[1].r === 'Vende a Pedri', `${T} (iOS 2) el plan y la pregunta en marcha llegan con su id y la sesión (los nombres de los rivales y lo preguntado no hacen falta), y el final de la pregunta, con su resumen`);
    mira(dos.anuncios[0].si === true && dos.anuncios[0].inter === true && /9792190459$/.test(dos.anuncios[0].b) && /9792190459$/.test(dos.anuncios[1].b) && dos.anuncios[2].toca === true && dos.anuncios[3].p === 'plan' && dos.anuncios[4] === 1 && dos.anuncios[5] === 1 && dos.mensajes === 13 && dos.zonaAntes === true, `${T} (iOS 2) los anuncios llegan a la app como en Android (zona, intersticial, apertura, bonificado, cancelar y privacidad; ${dos.mensajes} mensajes), y sin liga cargada la web no pide anuncios`);
    mira(dos.tras.join() === 'true,true,false', `${T} (iOS 2) el permiso de avisos, las opciones de privacidad y si está a la vista salen de lo que dice la app (${dos.tras.join()})`);
    mira(/2222222222$/.test(dos.bloques[0]) && /3333333333$/.test(dos.bloques[1]), `${T} (iOS 2) los bloques de anuncios de limites.json son los de iOS (${dos.bloques.join(', ')})`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (varios)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    mira(reg.fuera.filter((x) => !/assets-fantasy|laliga|fonts\.g|googletag|gstatic/.test(x)).length === 0, `${T} la página no pide nada a otros sitios por su cuenta${reg.fuera.length ? ` (${reg.fuera.slice(0, 3).join(', ')})` : ''}`);
    await ctx.close();

    /* ---- 6b: la alarma del clausulazo, solo donde hay alarmas del sistema (iOS 26 o más) ---- */
    ({ ctx, p, reg } = await abrir(nav, motor, { alarma: true }));
    await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
    const al = await p.evaluate(async () => { const n = (await import('./js/puente.js')).nativo; const hay = n.hayAlarma(); n.probarAlarma(10.4, 'Así suena', 'texto'); return { hay, m: window.__msgs.filter((x) => x.a === 'probarAlarma')[0] }; });
    mira(al.hay === true && al.m && al.m.s === 10 && al.m.t === 'Así suena' && al.m.x === 'texto', `${T} (iOS 2) con alarmas del sistema, la alarma se ofrece y la de prueba llega a la app`);
    await ctx.close();

    /* ---- (iOS 3) el QR y el dictado, donde el iPhone los tiene; las fotos, de vuelta a la web ---- */
    ({ ctx, p, reg } = await abrir(nav, motor, { qr: true, voz: true }));
    await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
    const tres = await p.evaluate(async () => {
      const n = (await import('./js/puente.js')).nativo;
      const r = { qr: n.hayQR(), voz: n.hayVoz(), fotos: n.hayFotos() };
      n.escanearQR(); n.voz();
      r.msgs = window.__msgs.filter((m) => m.a === 'escanearQR' || m.a === 'voz').map((m) => m.a).join(',');
      return r;
    });
    mira(tres.qr && tres.voz && tres.fotos && tres.msgs === 'escanearQR,voz', `${T} (iOS 3) con lector de QR y dictado en el iPhone, se ofrecen y llegan a la app (${tres.msgs})`);
    // lo que contesta la app llega como en Android: qrLeido (aquí, sin sesión, dice que hace falta entrar) y fotosApp
    await p.evaluate(() => window.qrLeido && window.qrLeido(null, 'Sin permiso para la cámara'));
    await p.waitForFunction(() => /Sin permiso para la cámara/.test([...document.querySelectorAll('.tostada')].map((t) => t.textContent).join(' ')), null, { timeout: 3000 }).catch(() => {});
    mira(/Sin permiso para la cámara/.test(await tostada(p)), `${T} (iOS 3) si el QR falla, la app lo dice`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (QR y dictado)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();

    /* ---- (iOS 3) la IA: sin clave de Google y con permiso antes de mandar nada ---- */
    ({ ctx, p, reg } = await abrir(nav, motor, { init: () => { try { sessionStorage.setItem('fm-llavero', JSON.stringify({ gemini: 'AQ.clave-guardada' })); } catch (e) { /* nada */ } } }));
    await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
    const ia = await p.evaluate(async () => {
      const m = await import('./js/ia.js');
      const r = { clave: m.clave(), hay: m.hayClave(), pide: m.pidePermisoIA(), antes: m.permisoIA(), vale: m.iaPermitida() };
      try { await m.charlar('hola', { demo: false }, {}, {}, () => {}, null); r.charlar = 'sin error'; } catch (e) { r.charlar = e.sinPermiso ? 'sinPermiso' : String(e.message || e); }
      try { await m.planDelDia({ demo: false }, {}, {}); r.plan = 'sin error'; } catch (e) { r.plan = e.sinPermiso ? 'sinPermiso' : String(e.message || e); }
      r.pedidos = window.__pedidos.filter((x) => /plan|pregunta|generativelanguage/.test(x.u)).length;
      return r;
    });
    mira(ia.clave === '' && ia.hay === false, `${T} (iOS 3) la clave de Google no se usa aunque haya una guardada`);
    mira(ia.pide && ia.antes === '' && !ia.vale && ia.charlar === 'sinPermiso' && ia.plan === 'sinPermiso' && ia.pedidos === 0, `${T} (iOS 3) sin permiso, ni la pregunta ni el plan salen hacia la IA (${ia.charlar}, ${ia.plan}, ${ia.pedidos} peticiones)`);
    // la ventana
    await p.evaluate(async () => { const m = await import('./js/permiso-ia.js'); window.__seguido = 0; m.pedirPermisoIA(() => { window.__seguido++; }, (si) => { window.__acabado = si; }); });
    const vent = ((await p.textContent('#permIA').catch(() => '')) || '').replace(/\s+/g, ' ');
    mira(/datos de tu liga/.test(vent) && /Rival 1/.test(vent) && /fotos/.test(vent) && /otra empresa/.test(vent) && /política de privacidad/.test(vent) && /plan de la app sigue saliendo/.test(vent) && !/Anthropic|Claude|Gemini|Google/.test(vent), `${T} (iOS 3) la ventana dice qué se manda, a quién (en la política) y qué pasa con «No», sin nombres de IA`);
    await p.click('#permIA [data-perm="pol"]');
    mira((await msgs(p, 'abrir')).some((x) => /privacidad\.html/.test(x.u)) && (await p.locator('#permIA').count()) === 1, `${T} (iOS 3) «política de privacidad» se abre fuera y la ventana sigue`);
    await p.click('#permIA [data-perm="no"]');
    const trasNo = await p.evaluate(async () => { const m = await import("./js/ia.js"); return { p: m.permisoIA(), seguido: window.__seguido, acabado: window.__acabado, hay: !!document.getElementById('permIA') }; });
    mira(trasNo.p === "no" && trasNo.seguido === 0 && trasNo.acabado === false && !trasNo.hay, `${T} (iOS 3) con «No» se guarda, se cierra y no sigue (${JSON.stringify(trasNo)})`);
    await p.evaluate(async () => { const m = await import('./js/permiso-ia.js'); m.pedirPermisoIA(() => { window.__seguido++; }); });
    await p.click('#permIA [data-perm="si"]');
    const tras2 = await p.evaluate(async () => { const m = await import('./js/ia.js'); return { p: m.permisoIA(), vale: m.iaPermitida(), seguido: window.__seguido }; });
    mira(tras2.p === 'si' && tras2.vale && tras2.seguido === 1, `${T} (iOS 3) con «Sí» se guarda y sigue con lo que se iba a hacer`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (la IA)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
    await ctx.close();

    /* ---- (iOS 3) la liga de ejemplo: Pregunta, Ajustes y el tutorial sin clave de Google ---- */
    ({ ctx, p, reg } = await abrir(nav, motor));
    await p.waitForSelector('[data-accion="entrar"]', { timeout: 20000 });
    await p.click('[data-accion="entrarDemo"] >> visible=true');
    await p.waitForSelector('#vista', { timeout: 25000 });
    await p.evaluate(() => document.querySelector('[data-ir="ia"], #bPregunta')?.click());
    await p.waitForTimeout(600);
    const preg = ((await p.textContent('#vista').catch(() => '')) || '').replace(/\s+/g, ' ');
    mira(/En la liga de ejemplo no se le puede preguntar/.test(preg) && !/AI Studio|clave de Google|IA de Google/.test(preg) && (await p.locator('#vista [data-accion="salirDemo"]').count()) >= 1, `${T} (iOS 3) en la liga de ejemplo, Pregunta dice que hay que entrar con tu cuenta, sin la guía de la clave de Google`);
    await p.evaluate(() => document.querySelector('#bAjustes').click());
    await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelectorAll('details.aj-sec').forEach((d) => { d.open = true; }));
    const aj = ((await p.textContent('.hoja').catch(() => '')) || '').replace(/\s+/g, ' ');
    mira(!/AI Studio|Clave de Google/.test(aj) && /App Store/.test(aj), `${T} (iOS 3) en Ajustes, nada de la clave de Google y la versión dice «App Store»`);
    mira(reg.errores.length === 0, `${T} sin errores de la página (liga de ejemplo)${reg.errores.length ? `: ${reg.errores[0]}` : ''}`);
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
    // (iOS 3) con «iosMin» por encima de esta compilación, la versión nueva está en la App Store y se abre su ficha
    const des = await p.evaluate(async () => {
      const ut = await import('./js/util.js'), li = await import('./js/limite.js');
      const g = ut.LS.get('limites', null);
      ut.LS.set('limites', { t: Date.now(), cfg: { ...((g && g.cfg) || {}), iosMin: 43 } });
      const r = { des: li.iosDesfasada(), play: li.playDesfasada() };
      const b = document.createElement('button'); b.dataset.accion = 'buscarVersion'; document.body.appendChild(b); b.click();
      await new Promise((ok) => setTimeout(ok, 400));
      r.tienda = window.__msgs.filter((m) => m.a === 'tienda').length;
      r.tostada = [...document.querySelectorAll('.tostada')].map((t) => t.textContent).join(' | ');
      ut.LS.set('limites', { t: Date.now(), cfg: { ...((g && g.cfg) || {}), iosMin: 42 } });
      r.igual = li.iosDesfasada();
      if (g) ut.LS.set('limites', g); else ut.LS.del('limites');
      return r;
    });
    mira(des.des && !des.play && !des.igual && des.tienda === 1 && /en la App Store/.test(des.tostada), `${T} (iOS 3) con una compilación nueva aprobada («iosMin»), «Buscar nueva» abre la App Store (${JSON.stringify(des).slice(0, 160)})`);
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
