// TestFlight por la API de App Store Connect (sesión iOS 4). Lo lanza .github/workflows/testflight.yml.
//
//   node .github/ios/testflight.mjs clave                 la clave pública con la que se cifra contacto.enc (se puede enseñar)
//   node .github/ios/testflight.mjs cifrar <pública> <json>  (en local) deja .github/ios/contacto.enc cifrado para la Action
//   node .github/ios/testflight.mjs configurar [build]    la información de la beta, el contacto para la revisión, el grupo
//                                                         externo con enlace público, los probadores, la compilación en el
//                                                         grupo y el envío a la revisión de la beta
//
// Con ASC_KEY_ID, ASC_ISSUER_ID y ASC_KEY_P8 (secretos de Actions). El teléfono de contacto y los correos de los probadores
// son datos personales y el repo es público: van en contacto.enc, cifrados con la clave pública que saca «clave» de
// ASC_KEY_P8 (ECDH P-256 + HKDF + AES-256-GCM). Solo la Action, con el secreto, los puede leer, y nunca se escriben en el
// registro (::add-mask::). Todo es idempotente: se puede lanzar las veces que haga falta.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENC = path.join(AQUI, 'contacto.enc');
const APP = '6839220127'; // Apple ID de la app en App Store Connect
const API = 'https://api.appstoreconnect.apple.com';
const GRUPO = 'Probadores'; // el grupo externo, con enlace público
const TOPE_ENLACE = 50; // cuántos pueden entrar por el enlace público
const LOCALE = 'es-ES';

const INFO_BETA = {
  description: 'Fantasy Manager analiza tu liga de LaLiga Fantasy: tu plantilla, el mercado, las cláusulas y el dinero de tus rivales, y te hace un plan para cada día. Esta es la versión de pruebas de la app de iPhone.',
  feedbackEmail: 'fantasymanager.web.app@gmail.com',
  marketingUrl: 'https://fantasymanagerapp.com',
  privacyPolicyUrl: 'https://fantasymanagerapp.com/privacidad.html',
};

const QUE_PROBAR = `Gracias por probar la app de iPhone. Lo que más ayuda, por este orden:
1. Entrar con tu cuenta de LaLiga Fantasy.
2. Pedir un plan: la primera vez sale una ventana para dejar que la app mande tu liga a la IA.
3. Pedir otro plan y salir de la app antes de que acabe: tiene que llegarte un aviso cuando esté.
4. Hacer una pregunta en Pregunta (también con una foto y dictando, si te sale el micrófono).
5. Desbloquear algo con un anuncio. Los anuncios de esta versión son de prueba: no pasa nada por tocarlos.
6. Ajustes: probar la alarma y los avisos.
7. Invitar a un amigo y abrir la app en el ordenador leyendo el QR.
Si algo falla, mándalo desde la app con el botón de avisar de un fallo.`;

const NOTAS_REVISOR = `Fantasy Manager is an independent companion app for LaLiga Fantasy, the fantasy football game run by LaLiga (the Spanish football league). It is not affiliated with or endorsed by LaLiga. The interface is in Spanish.

After signing in with their own LaLiga Fantasy account, the user sees their private league (squad, balance, market, rival managers) and the app builds a daily plan, tracks release clauses, shows live matchday points, answers questions with an AI assistant and sends notifications.

HOW TO TEST WITHOUT AN ACCOUNT: on the first screen, tap "Ver con una liga de ejemplo". It opens a sample league where every section works.

Signing in ("Entrar") opens LaLiga's own login page in the system sign-in sheet (ASWebAuthenticationSession); the password is typed only there. LaLiga's page sometimes fails on the first try: tap "Entrar" again.

Ads: Google AdMob (test ads in this beta build). Before league data is sent to the AI provider, the app asks for permission and rival names are replaced with aliases.`;

// ---------- la credencial de la API (JWT ES256, 20 min) ----------
/** el .p8 tal cual lo pegue cada uno (en una línea, con \r, sin cabeceras): se rehace el PEM, como jwtApns del Worker */
function normaP8(txt) {
  const b = String(txt || '').replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  return `-----BEGIN PRIVATE KEY-----\n${b.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
}
const claveP8 = () => crypto.createPrivateKey(normaP8(process.env.ASC_KEY_P8));
const b64u = (b) => Buffer.from(b).toString('base64url');
function credencial() {
  const id = process.env.ASC_KEY_ID, iss = process.env.ASC_ISSUER_ID, p8 = process.env.ASC_KEY_P8;
  if (!id || !iss || !p8) throw new Error('Faltan los secretos ASC_KEY_ID, ASC_ISSUER_ID y ASC_KEY_P8');
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64u(JSON.stringify({ alg: 'ES256', kid: id, typ: 'JWT' }));
  const cuerpo = b64u(JSON.stringify({ iss, iat: ahora, exp: ahora + 19 * 60, aud: 'appstoreconnect-v1' }));
  const firma = crypto.sign('sha256', Buffer.from(`${cab}.${cuerpo}`), { key: claveP8(), dsaEncoding: 'ieee-p1363' });
  return `${cab}.${cuerpo}.${b64u(firma)}`;
}

let jwt = null, jwtT = 0;
async function api(metodo, ruta, cuerpo) {
  if (!jwt || Date.now() - jwtT > 15 * 60e3) { jwt = credencial(); jwtT = Date.now(); }
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const txt = await r.text();
  let j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch { /* no es JSON */ }
  if (!r.ok) {
    const err = (j && j.errors || []).map((e) => `${e.code}: ${e.detail || e.title}`).join(' | ') || txt.slice(0, 300);
    const e = new Error(`${metodo} ${ruta.split('?')[0]} → ${r.status} ${err}`);
    e.estado = r.status; e.errores = j && j.errors;
    throw e;
  }
  return j;
}

// ---------- cifrar lo personal con la clave pública de ASC_KEY_P8 ----------
const INFO_HKDF = Buffer.from('fantasy-manager contacto testflight');
function clavePublica() {
  const priv = claveP8();
  return crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' }).toString('base64');
}
function cifrar(publica, datos) {
  const pub = crypto.createPublicKey({ key: Buffer.from(publica, 'base64'), type: 'spki', format: 'der' });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const comun = crypto.diffieHellman({ privateKey, publicKey: pub });
  const k = Buffer.from(crypto.hkdfSync('sha256', comun, Buffer.alloc(0), INFO_HKDF, 32));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const d = Buffer.concat([c.update(Buffer.from(JSON.stringify(datos))), c.final(), c.getAuthTag()]);
  return { v: 1, e: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), iv: iv.toString('base64'), d: d.toString('base64') };
}
function descifrar(sobre, priv = claveP8()) {
  const efimera = crypto.createPublicKey({ key: Buffer.from(sobre.e, 'base64'), type: 'spki', format: 'der' });
  const comun = crypto.diffieHellman({ privateKey: priv, publicKey: efimera });
  const k = Buffer.from(crypto.hkdfSync('sha256', comun, Buffer.alloc(0), INFO_HKDF, 32));
  const d = Buffer.from(sobre.d, 'base64');
  const dc = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(sobre.iv, 'base64'));
  dc.setAuthTag(d.subarray(d.length - 16));
  return JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString());
}
const ocultar = (v) => { if (v) for (const t of String(v).split(/\s+/)) if (t) console.log(`::add-mask::${t}`); };

// ---------- los pasos ----------
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** la compilación (por su número), cuando Apple la ha procesado; sin número, la última */
async function compilacion(numero) {
  const filtro = numero ? `&filter[version]=${encodeURIComponent(numero)}` : '';
  for (let i = 0; i < 90; i++) { // hasta 45 min
    const j = await api('GET', `/v1/builds?filter[app]=${APP}${filtro}&sort=-uploadedDate&limit=1&fields[builds]=version,processingState,expired,usesNonExemptEncryption,uploadedDate`);
    const b = j.data[0];
    if (b) {
      const est = b.attributes.processingState;
      if (est === 'VALID') return b;
      if (est === 'FAILED' || est === 'INVALID') throw new Error(`Apple no ha aceptado la compilación ${b.attributes.version}: ${est}`);
      if (i % 4 === 0) console.log(`la compilación ${b.attributes.version}: ${est}…`);
    } else if (!numero) throw new Error('Aún no hay ninguna compilación en App Store Connect');
    else if (i % 4 === 0) console.log(`la compilación ${numero} aún no sale en App Store Connect…`);
    await espera(30e3);
  }
  throw new Error('La compilación no ha quedado lista en 45 min');
}

async function infoBeta() {
  const j = await api('GET', `/v1/apps/${APP}/betaAppLocalizations`);
  const hay = j.data.find((x) => x.attributes.locale === LOCALE);
  if (hay) await api('PATCH', `/v1/betaAppLocalizations/${hay.id}`, { data: { type: 'betaAppLocalizations', id: hay.id, attributes: INFO_BETA } });
  else await api('POST', '/v1/betaAppLocalizations', { data: { type: 'betaAppLocalizations', attributes: { locale: LOCALE, ...INFO_BETA }, relationships: { app: { data: { type: 'apps', id: APP } } } } });
  console.log('información de la beta: puesta');
}

async function contactoRevision(c) {
  const j = await api('GET', `/v1/apps/${APP}/betaAppReviewDetail`);
  const id = j.data.id;
  await api('PATCH', `/v1/betaAppReviewDetails/${id}`, { data: { type: 'betaAppReviewDetails', id, attributes: {
    contactFirstName: c.nombre, contactLastName: c.apellidos, contactPhone: c.telefono, contactEmail: c.email,
    demoAccountRequired: false, notes: NOTAS_REVISOR,
  } } });
  console.log('contacto y notas para la revisión de la beta: puestos');
}

async function grupoExterno() {
  const j = await api('GET', `/v1/apps/${APP}/betaGroups?limit=50`);
  let g = j.data.find((x) => x.attributes.name === GRUPO && !x.attributes.isInternalGroup);
  if (!g) {
    const r = await api('POST', '/v1/betaGroups', { data: { type: 'betaGroups', attributes: { name: GRUPO, feedbackEnabled: true }, relationships: { app: { data: { type: 'apps', id: APP } } } } });
    g = r.data;
    console.log('grupo externo «' + GRUPO + '»: creado');
  }
  // el enlace público (con tope). Apple solo lo deja encender cuando el grupo ya tiene una compilación aprobada: si dice que
  // no, se vuelve a intentar al final y en la próxima pasada
  return g;
}

async function enlacePublico(g) {
  try {
    const r = await api('PATCH', `/v1/betaGroups/${g.id}`, { data: { type: 'betaGroups', id: g.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: true, publicLinkLimit: TOPE_ENLACE, feedbackEnabled: true } } });
    const a = r.data.attributes;
    if (a.publicLink) console.log(`ENLACE PÚBLICO DE TESTFLIGHT: ${a.publicLink} (hasta ${a.publicLinkLimit})`);
    return a.publicLink || null;
  } catch (e) {
    console.log(`el enlace público aún no: ${e.message}`);
    return null;
  }
}

async function probadores(g, correos) {
  if (!correos || !correos.length) return;
  const ya = await api('GET', `/v1/betaGroups/${g.id}/betaTesters?limit=200&fields[betaTesters]=email`);
  const tienen = new Set(ya.data.map((t) => (t.attributes.email || '').toLowerCase()));
  let n = 0;
  for (const p of correos) {
    if (tienen.has(p.email.toLowerCase())) continue;
    await api('POST', '/v1/betaTesters', { data: { type: 'betaTesters', attributes: { email: p.email, firstName: p.nombre || undefined }, relationships: { betaGroups: { data: [{ type: 'betaGroups', id: g.id }] } } } });
    n++;
  }
  console.log(`probadores: ${correos.length} en el grupo (${n} nuevos)`);
}

async function queProbar(build) {
  const j = await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations`);
  const hay = j.data.find((x) => x.attributes.locale === LOCALE);
  if (hay) await api('PATCH', `/v1/betaBuildLocalizations/${hay.id}`, { data: { type: 'betaBuildLocalizations', id: hay.id, attributes: { whatsNew: QUE_PROBAR } } });
  else await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale: LOCALE, whatsNew: QUE_PROBAR }, relationships: { build: { data: { type: 'builds', id: build.id } } } } });
}

async function enviarRevision(build) {
  const est = await api('GET', `/v1/builds/${build.id}/buildBetaDetail`);
  const ext = est.data.attributes.externalBuildState;
  console.log(`estado de la beta externa de ${build.attributes.version}: ${ext}`);
  if (ext !== 'READY_FOR_BETA_SUBMISSION') return ext;
  try {
    await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } } });
    console.log('ENVIADA A LA REVISIÓN DE LA BETA');
    return 'WAITING_FOR_BETA_REVIEW';
  } catch (e) {
    console.log(`::warning::No se ha podido enviar a la revisión de la beta: ${e.message}`);
    return ext;
  }
}

async function configurar(numero) {
  let datos = null;
  if (fs.existsSync(ENC)) {
    datos = descifrar(JSON.parse(fs.readFileSync(ENC, 'utf8')));
    ocultar(datos.contacto && datos.contacto.telefono);
    for (const p of datos.probadores || []) ocultar(p.email);
  } else console.log('::warning::Sin .github/ios/contacto.enc: no se pone el contacto ni los probadores, ni se envía a revisión');

  let build = null;
  try { build = await compilacion(numero); } catch (e) {
    if (numero || !/ninguna compilación/.test(e.message)) throw e;
    // sin compilación todavía: se deja hecho todo lo que no depende de ella
    console.log('::notice::Aún no hay compilación: se deja lista la información de la beta, el grupo, el contacto y los probadores');
    await infoBeta();
    const g0 = await grupoExterno();
    if (datos) { await contactoRevision(datos.contacto); await probadores(g0, datos.probadores); }
    return;
  }
  console.log(`la compilación ${build.attributes.version}: lista`);
  if (build.attributes.usesNonExemptEncryption == null) {
    await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
  }
  await infoBeta();
  await queProbar(build);
  const g = await grupoExterno();
  try { await api('POST', `/v1/betaGroups/${g.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] }); } catch (e) { if (e.estado !== 409) throw e; }
  console.log(`la compilación ${build.attributes.version}, en «${GRUPO}»`);
  let estado = null;
  if (datos) {
    await contactoRevision(datos.contacto);
    await probadores(g, datos.probadores);
    estado = await enviarRevision(build);
  }
  const enlace = await enlacePublico(g);
  const resumen = [
    `Compilación ${build.attributes.version} en TestFlight, grupo «${GRUPO}».`,
    `Revisión de la beta: ${estado || 'sin enviar'}.`,
    enlace ? `Enlace público: ${enlace}` : 'Enlace público: cuando Apple apruebe la primera compilación (se enciende en la próxima pasada).',
  ].join('\n');
  console.log(resumen);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen.replace(/\n/g, '\n\n') + '\n');
}


// ---------- el certificado de distribución propio (la firma en la nube de Apple estropea las tildes del nombre) ----------
const NOMBRE_PERFIL = 'FM App Store (Actions)';
const BUNDLE = 'es.fantasymanager.app';
const sinCeros = (x) => String(x || '').toUpperCase().replace(/^0+/, '');

/** crea un certificado Apple Distribution con una clave nueva y lo deja, cifrado para la sesión que lo pide, en el registro */
async function certificado(publicaSesion) {
  const ya = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=50&fields[certificates]=name,expirationDate,serialNumber,certificateType');
  console.log(`certificados de distribución que ya hay: ${ya.data.length}`);
  for (const c of ya.data) console.log(`  ${c.id} ${c.attributes.name} caduca ${c.attributes.expirationDate}`);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-cert-'));
  const o = (args) => execFileSync('openssl', args, { cwd: d, stdio: ['ignore', 'pipe', 'pipe'] });
  o(['genrsa', '-out', 'k.pem', '2048']);
  o(['req', '-new', '-key', 'k.pem', '-out', 'c.csr', '-subj', '/CN=Fantasy Manager Actions/emailAddress=fantasymanager.web.app@gmail.com']);
  const csr = fs.readFileSync(path.join(d, 'c.csr'), 'utf8');
  const r = await api('POST', '/v1/certificates', { data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } } });
  const cert = r.data;
  fs.writeFileSync(path.join(d, 'c.der'), Buffer.from(cert.attributes.certificateContent, 'base64'));
  o(['x509', '-inform', 'DER', '-in', 'c.der', '-out', 'c.pem']);
  const clave = crypto.randomBytes(18).toString('base64url');
  const legado = ['-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1'];
  try { o(['pkcs12', '-export', '-legacy', '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'c.p12', '-passout', `pass:${clave}`, '-name', 'FM Distribution']); }
  catch { o(['pkcs12', '-export', ...legado, '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'c.p12', '-passout', `pass:${clave}`, '-name', 'FM Distribution']); }
  const p12 = fs.readFileSync(path.join(d, 'c.p12')).toString('base64');
  fs.rmSync(d, { recursive: true, force: true });
  console.log(`certificado creado: ${cert.id} ${cert.attributes.name} caduca ${cert.attributes.expirationDate} serie ${cert.attributes.serialNumber}`);
  console.log(`SOBRE ${JSON.stringify(cifrar(publicaSesion, { p12, clave, id: cert.id, serie: cert.attributes.serialNumber, caduca: cert.attributes.expirationDate }))}`);
}

/** el perfil App Store de la app con el certificado de esa serie, en `ruta` (se rehace cada vez: es gratis) */
async function perfil(ruta, serie) {
  const b = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}&limit=5`);
  const bid = b.data.find((x) => x.attributes.identifier === BUNDLE);
  if (!bid) throw new Error(`No está el App ID ${BUNDLE}`);
  const cs = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=50&fields[certificates]=serialNumber,name,expirationDate');
  const c = cs.data.find((x) => sinCeros(x.attributes.serialNumber) === sinCeros(serie));
  if (!c) throw new Error(`No está en Apple el certificado de la serie ${serie} (¿revocado?)`);
  const ps = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(NOMBRE_PERFIL)}&limit=20`);
  for (const p of ps.data) await api('DELETE', `/v1/profiles/${p.id}`).catch(() => {});
  const r = await api('POST', '/v1/profiles', { data: { type: 'profiles', attributes: { name: NOMBRE_PERFIL, profileType: 'IOS_APP_STORE' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } }, certificates: { data: [{ type: 'certificates', id: c.id }] } } } });
  fs.writeFileSync(ruta, Buffer.from(r.data.attributes.profileContent, 'base64'));
  console.log(`perfil «${NOMBRE_PERFIL}»: ${r.data.attributes.uuid}, caduca ${r.data.attributes.expirationDate}; certificado ${c.attributes.name}, caduca ${c.attributes.expirationDate}`);
}

const [modo, a1, a2] = process.argv.slice(2);
if (modo === 'p8') { fs.writeFileSync(a1, normaP8(process.env.ASC_KEY_P8), { mode: 0o600 }); claveP8(); console.log('la clave de la API, en su archivo'); }
else if (modo === 'clave') console.log(`CLAVE PÚBLICA PARA contacto.enc: ${clavePublica()}`);
else if (modo === 'cifrar') { fs.writeFileSync(ENC, JSON.stringify(cifrar(a1, JSON.parse(fs.readFileSync(a2, 'utf8')))) + '\n'); console.log('escrito', ENC); }
else if (modo === 'comprobar') { const d = descifrar(JSON.parse(fs.readFileSync(ENC, 'utf8'))); console.log('contacto.enc se lee bien:', Object.keys(d.contacto || {}).join(', '), '·', (d.probadores || []).length, 'probadores'); }
else if (modo === 'abrir') { const d = descifrar(JSON.parse(fs.readFileSync(a2, 'utf8')), crypto.createPrivateKey(fs.readFileSync(a1, 'utf8'))); fs.writeFileSync(a2 + '.abierto.json', JSON.stringify(d), { mode: 0o600 }); console.log('abierto:', d.id, d.serie, d.caduca); }
else if (modo === 'certificado') await certificado(fs.readFileSync(path.join(AQUI, 'sesion.pub'), 'utf8').trim());
else if (modo === 'perfil') await perfil(a1, a2);
else if (modo === 'configurar') await configurar(a1 || process.env.BUILD || '');
else { console.error('modo: clave | cifrar | comprobar | configurar'); process.exit(2); }
