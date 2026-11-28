// La ficha de la App Store por la API de App Store Connect (sesión iOS 6). Lo lanza el trabajo «ficha» de
// .github/workflows/testflight.yml (commit con «[ficha]» en la rama `testflight`) y, para la compilación de la tienda, el
// trabajo «configurar» con «[app-store]».
//
//   node .github/ios/ficha.mjs ficha              textos, URL, categoría, precio, países, edad, datos para la revisión y,
//                                                 si CAPTURAS apunta a una carpeta con 61/ y 67/, las capturas
//   node .github/ios/ficha.mjs version <build>    pone en la ficha la versión de esa compilación y la elige para enviar
//   node .github/ios/ficha.mjs estado             qué falta para poder enviar (también lo dice al final de los otros)
//   node .github/ios/ficha.mjs enviar             publicación manual y la versión a la revisión de la App Store
//   node .github/ios/ficha.mjs situacion          en qué está cada versión y cada envío, y el DSA (no toca nada)
//   node .github/ios/ficha.mjs retirar            quita de la revisión lo enviado (la versión vuelve a poder editarse)
//   node .github/ios/ficha.mjs publicar           publica la versión aprobada, solo con el DSA aprobado (SOLO=0.9: solo esa)
//
// `enviar` solo con el «envía» de Carlos (27 nov): lo lanza el trabajo «enviar» de testflight.yml con «[enviar]».
// La publicación queda en MANUAL: aprobada, no sale hasta que Carlos la publica en App Store Connect.
// Lo que no se puede hacer por la API, y hace Carlos en App Store Connect: «Privacidad de la app», la condición de
// comerciante (DSA) y la casilla de derechos de contenido. Todo es idempotente.
//
// Los textos salen de claude/ios-ficha.md del proyecto (25 nov) con lo que iOS 6 comprobó en la app de verdad: el botón de
// la liga de ejemplo se llama «Ver con una liga de ejemplo», las pestañas son siete (seis abajo y Pregunta arriba) y en la
// liga de ejemplo no se puede preguntar a la IA. Si cambian en la app, cambiarlos aquí.
//
// La cuenta de LaLiga para el revisor: secretos REVISOR_USUARIO y REVISOR_CLAVE (los pone Carlos en GitHub). Sin ellos, el
// hueco queda vacío y «estado» lo dice.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, LOCALE, api, todo, descifrar, ocultar } from './asc.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENC = path.join(AQUI, 'contacto.enc');

// ---------- los textos ----------
const SUBTITULO = 'Qué fichar, vender y clausular';
const PALABRAS = 'mercado,pujas,fichajes,cláusulas,alineación,once,jornada,puntos,plantilla,fútbol,chollos,blindaje';
const DESCRIPCION = `Fantasy Manager es una app para LaLiga Fantasy: lee tu liga privada con tu propia cuenta y cada día te dice qué hacer en ella. A quién pujar y cuánto, qué vender, a quién clausular antes de que se cierre su cláusula y qué once poner.

QUÉ HACE
• Plan del día: las operaciones de hoy en tu liga, de la más urgente a la que menos, con el motivo de cada una y el saldo que te queda después.
• Cláusulas: las de tus rivales que tienes a tu alcance y hasta cuándo, y cuáles de las tuyas corren peligro.
• Dinero de los rivales: cuánto tiene cada mánager, calculado con los movimientos de la liga, para saber quién puede pagar tu cláusula.
• Mercado: qué jugadores suben y bajan de valor, y la puja que suele ganar en tu liga.
• Tu equipo: el mejor once, el calendario de cada jugador y las ofertas que te llegan.
• Jornada en directo: los puntos de tus jugadores y los de cada mánager de tu liga.
• Preguntas a la IA: pregunta lo que quieras de tu liga con tus palabras. La respuesta sale de tus datos de ese momento.
• Avisos: el cierre del mercado, las cláusulas que se abren y el clausulazo que te toca, un minuto antes.

CÓMO SE ENTRA
Entras en la página de inicio de sesión de LaLiga sin salir de la app. Fantasy Manager no ve ni guarda tu contraseña, y no tienes que crear otra cuenta. Si antes quieres echar un vistazo, puedes abrir una liga de ejemplo sin entrar.

GRATIS, CON ANUNCIOS
Cada día tienes planes y preguntas gratis. Si quieres más, ves un anuncio corto y se desbloquean. No hay compras dentro de la app.

TUS DATOS
Los nombres de tus rivales se cambian antes de mandar los datos de tu liga a la IA. Lo que guarda nuestro servidor lo borras desde Ajustes cuando quieras. El detalle está en la política de privacidad.

Fantasy Manager es una app independiente: no está afiliada a LaLiga ni cuenta con su respaldo.`;
const SOPORTE = 'https://fantasymanagerapp.com/contacto.html';
const PRIVACIDAD = 'https://fantasymanagerapp.com/privacidad.html';
const MARKETING = 'https://fantasymanagerapp.com'; // ya puesta el 25 nov (AdMob la usa para encontrar app-ads.txt)
const COPYRIGHT = '2026 Carlos Díez Rodríguez';
const CATEGORIA = 'SPORTS';
const FUERA = ['CHN']; // todos los países menos China (Carlos, 26 nov): allí harían falta sus papeles de IA y seguridad

function notasRevisor(conCuenta) {
  return `Fantasy Manager is an independent companion app for LaLiga Fantasy, the fantasy football game run by LaLiga (the Spanish football league). It is not affiliated with or endorsed by LaLiga. The interface is in Spanish.

WHAT IT DOES
After signing in with their own LaLiga Fantasy account, the user sees their private league: squad, balance, market, rival managers and league activity. From that data the app builds a daily plan (which players to bid on, sell, or buy by paying their release clause, and the best lineup), tracks rivals' release clauses and estimated budgets, shows live matchday points, answers questions about the league with an AI assistant, and sends notifications before the market closes or a release clause opens. The app does not make any move in LaLiga Fantasy: the user makes them there and can tick each step of the plan as done.

HOW TO REVIEW
1. Without an account: on the first screen, tap "Ver con una liga de ejemplo". It opens a sample league with made-up data where every tab works, except the AI assistant (Pregunta), which needs a real account.
2. ${conCuenta ? 'With the demo account (see Sign-In Information)' : 'With a LaLiga Fantasy account'}: tap "Entrar con mi cuenta de LaLiga". iOS asks once whether the app may use "login.laliga.es" to sign in; tap Continue. LaLiga's own login page then opens in the system sign-in sheet (ASWebAuthenticationSession). Enter the email and password there; the sheet closes and the league loads.${conCuenta ? ' The demo account belongs to a private league.' : ''}
LaLiga's login page sometimes shows "Lo sentimos, tenemos problemas para iniciar su sesión" on the first try. If that happens, close the sheet and tap "Repetir: abrir LaLiga".

Tabs: at the bottom, Hoy (today's plan), Equipo (squad and lineup), Directo (live matchday), Rivales (rival managers, their budgets and release clauses), Mercado (market) and Clubes (LaLiga clubs); at the top, Pregunta (AI assistant), Invitar and Ajustes.

SIGN-IN AND DATA
The password is typed only on LaLiga's page; the app never sees or stores it. The app keeps the session token LaLiga issues, in the Keychain. There is no separate Fantasy Manager account, so there is no account to delete; whatever our server keeps can be deleted at any time in Ajustes > "Borrar mis datos del servidor". Before league data is sent to the AI provider for a plan or a question, the app asks for permission ("¿Usamos la IA con tu liga?"), and rival managers' names are replaced with aliases.

ADS
Google AdMob, with no in-app purchases. In the EU, the Google consent form and the App Tracking Transparency prompt appear on first launch. There is an app-open ad at most once a day, occasional interstitials, and optional rewarded ads that unlock extra plans or questions for the day.

NATIVE FEATURES
Sign-in with ASWebAuthenticationSession and the Keychain; local notifications (the release-clause alarm uses AlarmKit on iOS 26), and push notifications when a plan or an answer is ready after the user leaves the app; share sheet; haptics; photo picker; QR scanner and on-device dictation on devices that support them.

Contact: fantasymanager.web.app@gmail.com`;
}

// La clasificación por edad (claude/ios-ficha.md): solo «Publicidad» es Sí; sale 4+ y no se sube a mano
const EDAD = {
  advertising: true,
  alcoholTobaccoOrDrugUseOrReferences: 'NONE', contests: 'NONE', gambling: false, gamblingSimulated: 'NONE',
  gunsOrOtherWeapons: 'NONE', healthOrWellnessTopics: false, lootBox: false, medicalOrTreatmentInformation: 'NONE',
  messagingAndChat: false, parentalControls: false, profanityOrCrudeHumor: 'NONE', ageAssurance: false,
  sexualContentGraphicAndNudity: 'NONE', sexualContentOrNudity: 'NONE', socialMedia: false, horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE', unrestrictedWebAccess: false, userGeneratedContent: false,
  violenceCartoonOrFantasy: 'NONE', violenceRealisticProlongedGraphicOrSadistic: 'NONE', violenceRealistic: 'NONE',
  ageRatingOverrideV2: 'NONE',
};

// ---------- lo que hay en App Store Connect ----------
const EDITABLES = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
const estadoDe = (a) => a.appVersionState || a.appStoreState || a.state;

async function versionEditable() {
  const vs = await todo(`/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&limit=20`);
  const v = vs.find((x) => EDITABLES.includes(estadoDe(x.attributes)) || ['PREPARE_FOR_SUBMISSION', 'REJECTED', 'DEVELOPER_REJECTED'].includes(x.attributes.appStoreState));
  if (!v) throw new Error(`No hay ninguna versión de la App Store que se pueda editar (hay: ${vs.map((x) => `${x.attributes.versionString} ${estadoDe(x.attributes)}`).join(', ') || 'ninguna'})`);
  return v;
}
async function infoEditable() {
  const is = await todo(`/v1/apps/${APP}/appInfos?limit=10`);
  const i = is.find((x) => !['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO'].includes(estadoDe(x.attributes))) || is[0];
  if (!i) throw new Error('No hay información de la app');
  return i;
}
async function localizacion(lista, crear) {
  const l = lista.find((x) => x.attributes.locale === LOCALE);
  if (l) return l;
  return (await crear()).data;
}

// ---------- los pasos ----------
async function textos(v, info) {
  const vl = await localizacion(await todo(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`), () =>
    api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale: LOCALE }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } }));
  await api('PATCH', `/v1/appStoreVersionLocalizations/${vl.id}`, { data: { type: 'appStoreVersionLocalizations', id: vl.id, attributes: {
    description: DESCRIPCION, keywords: PALABRAS, supportUrl: SOPORTE, marketingUrl: MARKETING,
  } } });
  console.log(`descripción (${DESCRIPCION.length}), palabras clave (${Buffer.byteLength(PALABRAS)} bytes), soporte y marketing: puestos`);

  const il = await localizacion(await todo(`/v1/appInfos/${info.id}/appInfoLocalizations`), () =>
    api('POST', '/v1/appInfoLocalizations', { data: { type: 'appInfoLocalizations', attributes: { locale: LOCALE }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } } }));
  await api('PATCH', `/v1/appInfoLocalizations/${il.id}`, { data: { type: 'appInfoLocalizations', id: il.id, attributes: {
    subtitle: SUBTITULO, privacyPolicyUrl: PRIVACIDAD,
  } } });
  console.log(`nombre «${il.attributes.name}», subtítulo y política de privacidad: puestos`);

  await api('PATCH', `/v1/appStoreVersions/${v.id}`, { data: { type: 'appStoreVersions', id: v.id, attributes: { copyright: COPYRIGHT } } });
  console.log('copyright: puesto');
  return vl;
}

async function categoria(info) {
  await api('PATCH', `/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships: {
    primaryCategory: { data: { type: 'appCategories', id: CATEGORIA } },
  } } });
  console.log('categoría: Deportes');
}

async function edad(info) {
  const j = await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
  const id = j.data.id;
  try {
    await api('PATCH', `/v1/ageRatingDeclarations/${id}`, { data: { type: 'ageRatingDeclarations', id, attributes: EDAD } });
  } catch (e) {
    // si Apple ya no admite alguna pregunta (las cambia a menudo), se manda sin ella y se dice
    const malas = (e.errores || []).map((x) => (x.source && x.source.pointer || '').split('/').pop()).filter((k) => k in EDAD);
    if (!malas.length) throw e;
    const resto = { ...EDAD };
    for (const k of malas) delete resto[k];
    console.log(`::warning::la clasificación por edad, sin ${malas.join(', ')} (Apple no las admite)`);
    await api('PATCH', `/v1/ageRatingDeclarations/${id}`, { data: { type: 'ageRatingDeclarations', id, attributes: resto } });
  }
  const i2 = await api('GET', `/v1/appInfos/${info.id}`);
  console.log(`clasificación por edad: contestada; sale ${i2.data.attributes.appStoreAgeRating || '(aún sin calcular)'}`);
}

async function precio() {
  let hay = null;
  try { hay = await api('GET', `/v1/apps/${APP}/appPriceSchedule?include=manualPrices,baseTerritory`); } catch (e) { if (e.estado !== 404) throw e; }
  if (hay && (hay.included || []).some((x) => x.type === 'appPrices')) { console.log('precio: ya estaba puesto'); }
  else {
    const puntos = await api('GET', `/v1/apps/${APP}/appPricePoints?filter[territory]=ESP&limit=200`);
    const gratis = puntos.data.find((p) => Number(p.attributes.customerPrice) === 0);
    if (!gratis) throw new Error('No encuentro el precio «gratis» de España');
    await api('POST', '/v1/appPriceSchedules', {
      data: { type: 'appPriceSchedules', relationships: {
        app: { data: { type: 'apps', id: APP } },
        baseTerritory: { data: { type: 'territories', id: 'ESP' } },
        manualPrices: { data: [{ type: 'appPrices', id: '${gratis}' }] },
      } },
      included: [{ type: 'appPrices', id: '${gratis}', attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: 'appPricePoints', id: gratis.id } } } }],
    });
    console.log('precio: gratis (base, España)');
  }
}

async function paises() {
  let disp = null;
  try { disp = await api('GET', `/v1/apps/${APP}/appAvailabilityV2`); } catch (e) { if (e.estado !== 404) throw e; }
  const territorios = await todo('/v1/territories?limit=200');
  if (!disp || !disp.data) {
    const ids = territorios.map((t) => t.id);
    await api('POST', '/v2/appAvailabilities', {
      data: { type: 'appAvailabilities', attributes: { availableInNewTerritories: true }, relationships: {
        app: { data: { type: 'apps', id: APP } },
        territoryAvailabilities: { data: ids.map((t) => ({ type: 'territoryAvailabilities', id: `\${${t}}` })) },
      } },
      included: ids.map((t) => ({ type: 'territoryAvailabilities', id: `\${${t}}`, attributes: { available: !FUERA.includes(t) }, relationships: { territory: { data: { type: 'territories', id: t } } } })),
    });
    console.log(`países: ${ids.length - FUERA.length} de ${ids.length} (fuera: ${FUERA.join(', ')}), y los que Apple añada`);
    return;
  }
  const ta = await todo(`/v2/appAvailabilities/${disp.data.id}/territoryAvailabilities?include=territory&limit=200`);
  let cambios = 0;
  for (const t of ta) {
    const terr = t.relationships && t.relationships.territory && t.relationships.territory.data && t.relationships.territory.data.id;
    const quiero = !FUERA.includes(terr);
    if (terr && t.attributes.available !== quiero) {
      await api('PATCH', `/v1/territoryAvailabilities/${t.id}`, { data: { type: 'territoryAvailabilities', id: t.id, attributes: { available: quiero } } });
      cambios++;
    }
  }
  console.log(`países: ya estaban; ${cambios} cambiados (fuera: ${FUERA.join(', ')})`);
}

async function revision(v) {
  const c = fs.existsSync(ENC) ? (descifrar(JSON.parse(fs.readFileSync(ENC, 'utf8'))).contacto || {}) : {};
  ocultar(c.telefono); ocultar(c.email);
  const usuario = process.env.REVISOR_USUARIO || '', clave = process.env.REVISOR_CLAVE || '';
  ocultar(usuario); ocultar(clave);
  const conCuenta = !!(usuario && clave);
  const attrs = {
    contactFirstName: c.nombre, contactLastName: c.apellidos, contactPhone: c.telefono, contactEmail: c.email,
    demoAccountRequired: conCuenta, notes: notasRevisor(conCuenta),
    ...(conCuenta ? { demoAccountName: usuario, demoAccountPassword: clave } : {}),
  };
  let det = null;
  try { det = await api('GET', `/v1/appStoreVersions/${v.id}/appStoreReviewDetail`); } catch (e) { if (e.estado !== 404) throw e; }
  if (det && det.data) await api('PATCH', `/v1/appStoreReviewDetails/${det.data.id}`, { data: { type: 'appStoreReviewDetails', id: det.data.id, attributes: attrs } });
  else await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: attrs, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } });
  console.log(`datos para la revisión: contacto y notas puestos; cuenta de LaLiga para el revisor: ${conCuenta ? 'puesta' : 'FALTA (secretos REVISOR_USUARIO y REVISOR_CLAVE)'}`);
}

// las capturas: CAPTURAS/61/*.png → «iPhone con Dynamic Island (pantalla mediana)», CAPTURAS/67/*.png → la grande. Se
// sustituyen las que hubiera, en el orden de los nombres de archivo.
async function capturas(vl) {
  const dir = process.env.CAPTURAS;
  if (!dir || !fs.existsSync(dir)) { console.log('capturas: no hay carpeta (CAPTURAS); no se tocan'); return; }
  const sets = await todo(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets?limit=50`);
  for (const [sub, tipo] of [['61', 'APP_IPHONE_61'], ['67', 'APP_IPHONE_67']]) {
    const d = path.join(dir, sub);
    // solo las de la prueba Tienda («1-hoy.png»…): nunca la de un fallo («fallo.png»); sin las cinco, no se toca ese tamaño
    const archivos = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^\d+-[a-z]+\.(png|jpe?g)$/i.test(f)).sort().slice(0, 10) : [];
    if (archivos.length < 5) { console.log(`capturas ${tipo}: ${archivos.length} buenas en ${sub}/; no se tocan las que hay`); continue; }
    let set = sets.find((s) => s.attributes.screenshotDisplayType === tipo);
    if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: tipo }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vl.id } } } } })).data;
    for (const viejo of await todo(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`)) await api('DELETE', `/v1/appScreenshots/${viejo.id}`);
    for (const f of archivos) {
      const datos = fs.readFileSync(path.join(d, f));
      const r = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: datos.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
      for (const op of r.attributes.uploadOperations || []) {
        const h = {};
        for (const x of op.requestHeaders || []) h[x.name] = x.value;
        const p = await fetch(op.url, { method: op.method, headers: h, body: datos.subarray(op.offset, op.offset + op.length) });
        if (!p.ok) throw new Error(`subir ${f}: ${p.status}`);
      }
      const md5 = crypto.createHash('md5').update(datos).digest('hex');
      await api('PATCH', `/v1/appScreenshots/${r.id}`, { data: { type: 'appScreenshots', id: r.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
    }
    // Apple las procesa unos segundos: se mira que ninguna haya fallado
    await new Promise((res) => setTimeout(res, 15e3));
    const subidas = await todo(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    const mal = subidas.filter((s) => s.attributes.assetDeliveryState && s.attributes.assetDeliveryState.state === 'FAILED');
    console.log(`capturas ${tipo}: ${subidas.length} subidas${mal.length ? `; ${mal.length} FALLIDAS: ${mal.map((s) => JSON.stringify(s.attributes.assetDeliveryState.errors)).join(' ')}` : ''}`);
    if (mal.length) process.exitCode = 1;
  }
}

/** pone en la ficha la versión de una compilación (la de TestFlight va con la de la web sin letra) y la elige para enviar */
async function version(numero) {
  if (!numero) throw new Error('Falta el número de compilación');
  const v = await versionEditable();
  let b = null;
  for (let i = 0; i < 90 && !b; i++) { // hasta 45 min, lo que tarda Apple en procesarla
    const j = await api('GET', `/v1/builds?filter[app]=${APP}&filter[version]=${encodeURIComponent(numero)}&include=preReleaseVersion&limit=1`);
    const x = j.data[0];
    if (x && x.attributes.processingState === 'VALID') b = { build: x, version: (j.included || []).find((y) => y.type === 'preReleaseVersions').attributes.version };
    else if (x && ['FAILED', 'INVALID'].includes(x.attributes.processingState)) throw new Error(`Apple no ha aceptado la compilación ${numero}`);
    else { if (i % 4 === 0) console.log(`la compilación ${numero}: ${x ? x.attributes.processingState : 'aún no sale'}…`); await new Promise((r) => setTimeout(r, 30e3)); }
  }
  if (!b) throw new Error('La compilación no ha quedado lista en 45 min');
  if (b.build.attributes.usesNonExemptEncryption == null) await api('PATCH', `/v1/builds/${b.build.id}`, { data: { type: 'builds', id: b.build.id, attributes: { usesNonExemptEncryption: false } } });
  await api('PATCH', `/v1/appStoreVersions/${v.id}`, { data: { type: 'appStoreVersions', id: v.id, attributes: { versionString: b.version }, relationships: { build: { data: { type: 'builds', id: b.build.id } } } } });
  console.log(`la ficha, con la versión ${b.version} y la compilación ${numero}`);
}

/** lo que falta para poder enviar; también va al resumen de la Action */
async function estado() {
  const v = await versionEditable();
  const info = await infoEditable();
  const lineas = [];
  const faltan = [];
  const ok = (bien, txt) => { lineas.push(`${bien ? '✅' : '❌'} ${txt}`); if (!bien) faltan.push(txt); };
  const [vls, ils, app, det, build] = await Promise.all([
    todo(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`),
    todo(`/v1/appInfos/${info.id}/appInfoLocalizations`),
    api('GET', `/v1/apps/${APP}`),
    api('GET', `/v1/appStoreVersions/${v.id}/appStoreReviewDetail`).catch(() => null),
    api('GET', `/v1/appStoreVersions/${v.id}/build`).catch(() => null),
  ]);
  const vl = vls.find((x) => x.attributes.locale === LOCALE), il = ils.find((x) => x.attributes.locale === LOCALE);
  ok(vl && vl.attributes.description && vl.attributes.keywords && vl.attributes.supportUrl, 'descripción, palabras clave y URL de soporte');
  ok(il && il.attributes.subtitle && il.attributes.privacyPolicyUrl, 'subtítulo y política de privacidad');
  ok(!!v.attributes.copyright, 'copyright');
  const cat = await api('GET', `/v1/appInfos/${info.id}/primaryCategory`).catch(() => null);
  ok(cat && cat.data && cat.data.id === CATEGORIA, 'categoría Deportes');
  ok(!!info.attributes.appStoreAgeRating, `clasificación por edad (${info.attributes.appStoreAgeRating || 'sin contestar'})`);
  const sets = vl ? await todo(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets?limit=50`) : [];
  for (const tipo of ['APP_IPHONE_61', 'APP_IPHONE_67']) {
    const s = sets.find((x) => x.attributes.screenshotDisplayType === tipo);
    const n = s ? (await todo(`/v1/appScreenshotSets/${s.id}/appScreenshots?limit=50`)).length : 0;
    ok(n > 0, `capturas ${tipo === 'APP_IPHONE_61' ? 'de 6,3"' : 'de 6,9"'}: ${n}`);
  }
  const d = det && det.data && det.data.attributes;
  ok(d && d.contactEmail && d.notes, 'contacto y notas para la revisión');
  ok(d && d.demoAccountRequired && d.demoAccountName, 'cuenta de LaLiga para el revisor (Carlos: secretos REVISOR_USUARIO y REVISOR_CLAVE)');
  ok(build && build.data, `compilación elegida para enviar${build && build.data ? ` (${build.data.attributes.version})` : ' (falta: commit con «[app-store]»)'}`);
  ok(!!app.data.attributes.contentRightsDeclaration, `derechos de contenido (Carlos, a mano): ${app.data.attributes.contentRightsDeclaration || 'sin marcar'}`);
  // (iOS 5, 27 nov) La API no tiene nada para la condición de comerciante (DSA), pero la disponibilidad de cada país
  // dice por qué no se puede vender allí (`contentStatuses`): en los 27 de la UE, algo con «TRADER» mientras Apple no
  // la ha aprobado. Se cuentan los estados de la UE tal cual vienen, para no adivinar los nombres.
  const UE = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'];
  try {
    const disp = await api('GET', `/v1/apps/${APP}/appAvailabilityV2`);
    const ta = await todo(`/v2/appAvailabilities/${disp.data.id}/territoryAvailabilities?include=territory&limit=200`);
    const cuenta = {};
    let vistos = 0;
    for (const t of ta) {
      const terr = t.relationships && t.relationships.territory && t.relationships.territory.data && t.relationships.territory.data.id;
      if (!UE.includes(terr)) continue;
      vistos++;
      for (const s of (t.attributes.contentStatuses || ['(sin estado)'])) cuenta[s] = (cuenta[s] || 0) + 1;
    }
    const resumen = Object.entries(cuenta).map(([s, n]) => `${s} ×${n}`).join(', ') || 'nada';
    const comerciante = Object.keys(cuenta).filter((s) => /TRADER/.test(s));
    ok(vistos > 0 && !comerciante.length, `comerciante (DSA), visto por los países de la UE: ${comerciante.length ? `SIN APROBAR (${comerciante.join(', ')})` : vistos ? 'nada lo frena' : 'no salen los países'} · ${vistos} países: ${resumen}`);
  } catch (e) { lineas.push(`❔ comerciante (DSA): no he podido leer la disponibilidad por países (${e.message})`); }
  lineas.push('❔ «Privacidad de la app»: Carlos, a mano en App Store Connect (la API no la deja ver)');
  const txt = `Ficha de la App Store, versión ${v.attributes.versionString} (${estadoDe(v.attributes)}):\n${lineas.join('\n')}`;
  console.log(txt);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${txt.replace(/\n/, '\n\n').replace(/\n(?=[✅❌❔])/g, '\n- ')}\n`);
  return { v, faltan };
}

/** al resumen de la Action y al registro */
function decir(txt) {
  console.log(txt);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${txt}\n\n`);
}

/** (27 nov, el «envía» de Carlos) publicación manual y la versión editable a la revisión de la App Store. Lo que falte
 * según `estado` para, salvo el DSA: ese lo decide Apple al enviar (si no deja, se dice tal cual lo que contesta). */
async function enviar() {
  const { v, faltan } = await estado();
  const bloquean = faltan.filter((t) => !/comerciante/.test(t));
  if (bloquean.length) throw new Error(`No envío: falta ${bloquean.join(' · ')}`);
  if (faltan.length) decir(`⚠️ Lo intento con el DSA sin aprobar: si Apple no deja enviar por eso, lo dirá ahora.`);
  if (v.attributes.releaseType !== 'MANUAL') {
    await api('PATCH', `/v1/appStoreVersions/${v.id}`, { data: { type: 'appStoreVersions', id: v.id, attributes: { releaseType: 'MANUAL' } } });
  }
  decir(`publicación: manual (antes ${v.attributes.releaseType || 'sin poner'})`);
  // un envío ya hecho o a medias de antes: no se repite
  const abiertos = await todo(`/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=20`);
  const yaEnviado = abiertos.find((x) => x.attributes.state !== 'READY_FOR_REVIEW');
  if (yaEnviado) { decir(`Ya hay un envío en ${yaEnviado.attributes.state} (${yaEnviado.id}): no envío otro.`); return; }
  let sub = abiertos[0];
  if (!sub) sub = (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP } } } } })).data;
  const items = await todo(`/v1/reviewSubmissions/${sub.id}/items?include=appStoreVersion&limit=50`);
  const dentro = items.some((i) => i.relationships && i.relationships.appStoreVersion && i.relationships.appStoreVersion.data && i.relationships.appStoreVersion.data.id === v.id);
  const fallo = (paso, e) => {
    const dsa = /trader|dsa|comerciante|digital services/i.test(e.message);
    decir(`❌ ${paso}: ${e.message}${dsa ? '\n\n**Apple no deja enviar por la condición de comerciante (DSA) pendiente.**' : ''}`);
    throw e;
  };
  if (!dentro) {
    try {
      await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } });
    } catch (e) { fallo('meter la versión en el envío', e); }
  }
  let r;
  try {
    r = await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
  } catch (e) { fallo('enviar a revisión', e); }
  const v2 = await api('GET', `/v1/appStoreVersions/${v.id}`);
  decir(`✅ ENVIADA a la revisión de la App Store: versión ${v2.data.attributes.versionString}, envío ${sub.id} (${r.data.attributes.state}), la versión en ${estadoDe(v2.data.attributes)}, publicación ${v2.data.attributes.releaseType}.`);
}

// ---------- (27 nov, la 0.9) cómo va la revisión, retirar un envío y publicar ----------
const UE27 = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'];
/** la condición de comerciante (DSA), vista por la disponibilidad de los 27 de la UE: { ok, txt } */
async function dsaUE() {
  try {
    const disp = await api('GET', `/v1/apps/${APP}/appAvailabilityV2`);
    const ta = await todo(`/v2/appAvailabilities/${disp.data.id}/territoryAvailabilities?include=territory&limit=200`);
    const cuenta = {};
    let vistos = 0;
    for (const t of ta) {
      const terr = t.relationships && t.relationships.territory && t.relationships.territory.data && t.relationships.territory.data.id;
      if (!UE27.includes(terr)) continue;
      vistos++;
      for (const s of (t.attributes.contentStatuses || ['(sin estado)'])) cuenta[s] = (cuenta[s] || 0) + 1;
    }
    const frena = Object.keys(cuenta).filter((s) => /TRADER/.test(s));
    return { ok: vistos > 0 && !frena.length, txt: `${vistos} países de la UE: ${Object.entries(cuenta).map(([s, n]) => `${s} ×${n}`).join(', ') || 'nada'}` };
  } catch (e) { return { ok: false, txt: `no he podido leerla (${e.message})` }; }
}
const ABIERTOS = ['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES'];
const envios = () => todo(`/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=IOS&limit=20`);
const versiones = () => todo(`/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&limit=20`);

/** en qué está cada versión y cada envío a revisión, y el DSA. No toca nada. */
async function situacion() {
  const [vs, es, dsa] = await Promise.all([versiones(), envios(), dsaUE()]);
  const lin = ['## La App Store ahora', ''];
  for (const v of vs) {
    const b = await api('GET', `/v1/appStoreVersions/${v.id}/build`).catch(() => null);
    lin.push(`- versión ${v.attributes.versionString}: ${estadoDe(v.attributes)} · publicación ${v.attributes.releaseType || 'sin poner'} · compilación ${b && b.data ? b.data.attributes.version : 'sin elegir'} · creada ${String(v.attributes.createdDate || '').slice(0, 16)}`);
  }
  if (!vs.length) lin.push('- no hay ninguna versión');
  for (const e of es.slice(0, 8)) {
    const items = await todo(`/v1/reviewSubmissions/${e.id}/items?limit=50`).catch(() => []);
    lin.push(`- envío ${e.id}: ${e.attributes.state}${e.attributes.submittedDate ? ` · enviado ${String(e.attributes.submittedDate).slice(0, 16)}` : ''} · ${items.map((i) => i.attributes.state).join(', ') || 'sin nada dentro'}`);
  }
  if (!es.length) lin.push('- no hay ningún envío a revisión');
  lin.push(`- comerciante (DSA): ${dsa.ok ? 'APROBADO (nada lo frena)' : 'SIN APROBAR'} · ${dsa.txt}`);
  decir(lin.join('\n'));
}

/** retira de la revisión lo que esté enviado (la versión vuelve a poder editarse). Sin nada enviado, no hace nada. */
async function retirar() {
  const es = (await envios()).filter((e) => ABIERTOS.includes(e.attributes.state));
  if (!es.length) { decir('No hay ningún envío abierto: nada que retirar.'); return situacion(); }
  for (const e of es) {
    if (e.attributes.state === 'READY_FOR_REVIEW') { decir(`envío ${e.id} sin enviar (READY_FOR_REVIEW): se queda`); continue; }
    try {
      const r = await api('PATCH', `/v1/reviewSubmissions/${e.id}`, { data: { type: 'reviewSubmissions', id: e.id, attributes: { canceled: true } } });
      decir(`envío ${e.id} (${e.attributes.state}): retirado → ${r.data.attributes.state}`);
    } catch (err) { decir(`❌ no he podido retirar el envío ${e.id} (${e.attributes.state}): ${err.message}`); throw err; }
  }
  // Apple tarda un poco en dejar la versión editable otra vez
  for (let i = 0; i < 40; i++) {
    const vs = await versiones();
    if (vs.some((x) => EDITABLES.includes(estadoDe(x.attributes)))) break;
    await new Promise((r) => setTimeout(r, 15e3));
  }
  await situacion();
}

/** publica la versión aprobada que espera al desarrollador, solo si el DSA está aprobado (Carlos, 27 nov) */
async function publicar() {
  const vs = await versiones();
  const v = vs.find((x) => estadoDe(x.attributes) === 'PENDING_DEVELOPER_RELEASE');
  if (!v) { decir('No publico: no hay ninguna versión aprobada esperando la publicación.'); return situacion(); }
  if (process.env.SOLO && v.attributes.versionString !== process.env.SOLO) { decir(`No publico: la aprobada es la ${v.attributes.versionString}, no la ${process.env.SOLO}.`); return situacion(); }
  const dsa = await dsaUE();
  if (!dsa.ok) { decir(`No publico: la ${v.attributes.versionString} está aprobada, pero el DSA sigue sin aprobar (${dsa.txt}).`); return situacion(); }
  await api('POST', '/v1/appStoreVersionReleaseRequests', { data: { type: 'appStoreVersionReleaseRequests', relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } });
  decir(`✅ PUBLICADA la ${v.attributes.versionString} en la App Store (puede tardar unas horas en verse).`);
  await situacion();
}

async function ficha() {
  const v = await versionEditable();
  const info = await infoEditable();
  console.log(`versión de la App Store: ${v.attributes.versionString} (${estadoDe(v.attributes)})`);
  const fallos = [];
  const paso = async (nombre, f) => { try { return await f(); } catch (e) { fallos.push(`${nombre}: ${e.message}`); console.log(`::error::${nombre}: ${e.message}`); return null; } };
  const vl = await paso('textos', () => textos(v, info));
  await paso('categoría', () => categoria(info));
  await paso('edad', () => edad(info));
  await paso('precio', () => precio());
  await paso('países', () => paises());
  await paso('revisión', () => revision(v));
  if (vl) await paso('capturas', () => capturas(vl));
  await paso('estado', () => estado());
  if (fallos.length) { console.log(`\n${fallos.length} pasos con fallo:\n${fallos.join('\n')}`); process.exitCode = 1; }
}

const [modo, a1] = process.argv.slice(2);
if (modo === 'ficha') await ficha();
else if (modo === 'version') { await version(a1 || process.env.BUILD); await estado(); }
else if (modo === 'estado') await estado();
else if (modo === 'enviar') await enviar();
else if (modo === 'situacion') await situacion();
else if (modo === 'retirar') await retirar();
else if (modo === 'publicar') await publicar();
else { console.error('modo: ficha | version <build> | estado | enviar'); process.exit(2); }
