/*
 * (25 nov, la app de iOS) El aviso de «tu plan está listo» y «han contestado tu pregunta» con la app del iPhone cerrada.
 * Android se queda preguntando él cada 3 s (Recoger.java); el iPhone congela la app a los pocos segundos de salir, así que
 * avisa el servidor: una notificación push por APNs, el servicio de Apple.
 *
 * Cómo va:
 * - Al salir de la app con un plan o una pregunta a medias, la app de iOS llama a POST /push { rid, tipo, tk, amb }: el id
 *   del pedido, si es plan o pregunta, el identificador de ese iPhone para los avisos (lo da Apple) y si es una app de
 *   prueba o la publicada. El Worker comprueba la cuenta con LaLiga, como siempre, y lo apunta en el objeto de esa cuenta
 *   y ese día, al lado del pedido (push:<rid>). Se borra con todo lo demás a las 30 h. No se guarda en ningún otro sitio.
 * - Cuando el plan o la respuesta están (o fallan), el objeto espera 5 s y manda el aviso. La espera es para la app: si
 *   sigue viva y lo recibe ella, llama a POST /push { rid, tipo, quitar } y el aviso lo pone ella en el propio móvil (con
 *   los nombres de verdad de los rivales, que el servidor no tiene). Así no llegan dos.
 * - Si pasa el tiempo máximo del pedido y no ha acabado, se avisa de que no ha salido.
 * - Android y la web no llaman a /push: para ellos nada cambia.
 *
 * Lo manda un solo objeto («apns|todos»): APNs pide una credencial firmada (JWT con ES256) que no se puede renovar más de
 * una vez cada 20 minutos, así que la hace uno solo, la guarda y la usa 45 minutos. APNs solo habla HTTP/2: el fetch de un
 * Worker publicado lo habla (va por la red de Cloudflare); el de las pruebas en local, no.
 * Las claves (APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID) las copia worker.yml de los secretos de GitHub; sin ellas no se
 * manda nada y todo lo demás sigue igual.
 */

/** lo que se espera desde que el plan o la respuesta están hasta mandar el aviso (PUSH_TRAS_MS lo cambia, para las pruebas) */
export const PUSH_TRAS_MS = 5000;
/** el identificador de la app de iOS (el «tema» de sus avisos) */
export const PUSH_TEMA = 'es.fantasymanager.app';
const JWT_DURA = 45 * 60e3;
const APNS = { prod: 'https://api.push.apple.com', dev: 'https://api.sandbox.push.apple.com' };

/** el identificador de un iPhone para los avisos: hexadecimal, 32 bytes hoy (Apple dice que puede crecer) */
export const tokenDe = (x) => (typeof x === 'string' && /^[0-9a-f]{64,200}$/i.test(x) ? x.toLowerCase() : '');
const tras = (env) => { const n = Number(env && env.PUSH_TRAS_MS); return n > 0 ? n : PUSH_TRAS_MS; };
const corto = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const i = t.lastIndexOf(' ', n - 1); return `${t.slice(0, i > n / 2 ? i : n - 1)}…`; };
/** en el servidor los rivales van con alias («Rival 2»): un texto que los lleve no se manda, va el genérico */
const conAlias = (t) => /(^|[^\p{L}\p{N}])(Rival|Equipo|Exrival) \d{1,3}(?![\p{L}\p{N}])/iu.test(String(t || ''));

/** lo que dice el aviso: los mismos textos que Recoger.java de Android. `fin` es lo guardado del pedido (o null si no acabó) */
export function textoPush(tipo, fin) {
  if (tipo === 'preg') {
    if (fin && fin.texto) {
      const r = corto(fin.resumen || '', 230);
      return { titulo: 'Tu director deportivo ha contestado', texto: r && !conAlias(r) ? r : 'Entra para leer la respuesta', hash: 'ia', hilo: 'pregunta' };
    }
    return { titulo: 'No ha podido contestar', texto: 'Entra y vuelve a preguntar', hash: 'ia', hilo: 'pregunta' };
  }
  if (fin && fin.plan) {
    const t = corto(fin.plan.titular || '', 200);
    return { titulo: 'Tu plan de hoy está listo', texto: t && !conAlias(t) ? t : 'Entra para ver los pasos', hash: 'hoy', hilo: 'plan' };
  }
  return { titulo: 'No ha salido el plan de hoy', texto: 'Entra y dale a Reintentar', hash: 'hoy', hilo: 'plan' };
}

/* ---------- en el objeto de la cuenta y el día (el mismo que guarda el pedido) ---------- */

/** pone la alarma del objeto para `t` sin perder la de limpiar a las 30 h (se guarda en «job-limpia», como con los planes) */
async function alarmaPara(st, t) {
  const a = await st.getAlarm();
  // (la de limpiar es a 30 h: una a pocos minutos es la de otro aviso o la de un plan, y esa no se guarda como la de limpiar;
  // si se guardara, al volver a ponerla el objeto se vaciaría a los pocos minutos, con el cupo del día dentro)
  if (!(await st.get('job-limpia'))) {
    if (a && a > Date.now() + 20 * 60e3) await st.put('job-limpia', a);
    // (sin alarma, o con la de un plan que se está haciendo ahora: la de limpiar se apunta igual, para que la alarma de
    // un aviso que al final no se manda no se tome por ella: alarmaObjeto)
    else if (!a) await st.put('job-limpia', Date.now() + 30 * 3600e3);
  }
  if (!a || a > t) await st.setAlarm(t);
}

/**
 * La app se ha ido con el pedido a medias: se apunta a quién avisar. `tope` es el tiempo máximo de ese tipo de pedido.
 * { ok } o { ok: false, desconocido } si aquí no hay ningún pedido con ese id (será de otro día)
 */
export async function pushArmar(st, env, rid, p, tope) {
  const tk = tokenDe(p && p.tk), tipo = p && p.tipo === 'preg' ? 'preg' : 'plan';
  if (!tk || !st.list || !st.getAlarm) return { ok: false };
  const res = await st.get(`res:${rid}`);
  if (!res) return { ok: false, desconocido: true };
  await st.put(`push:${rid}`, { tk, tipo, amb: p.amb === 'dev' ? 'dev' : 'prod', t: Date.now() });
  // ya está hecho: en 5 s (por si la app lo recibe ella); si no, cuando acabe (pushAlAcabar) o, como muy tarde, al tope
  const cuando = res.fin ? Date.now() + tras(env) : (Number(res.marcha) || Date.now()) + tope + 10e3;
  await st.put(`pe:${rid}`, { t: cuando });
  await alarmaPara(st, cuando);
  return { ok: true };
}

/** la app ha recibido ella el plan o la respuesta (o ha vuelto): ya no hay que avisar */
export async function pushQuitar(st, rid) {
  await st.delete([`push:${rid}`, `pe:${rid}`]);
  return { ok: true };
}

/** el plan o la respuesta de un pedido ya están (o han fallado): si hay a quién avisar, en 5 s */
export async function pushAlAcabar(st, env, rid) {
  if (!st.list || !st.getAlarm || !(await st.get(`push:${rid}`))) return;
  const cuando = Date.now() + tras(env);
  await st.put(`pe:${rid}`, { t: cuando });
  await alarmaPara(st, cuando);
}

/** (en la alarma) manda los avisos a los que les ha llegado la hora; devuelve cuándo toca el siguiente (0: ninguno) */
export async function pushesDebidos(st, env, mandar = mandarPush) {
  let sig = 0;
  const pes = st.list ? await st.list({ prefix: 'pe:' }) : new Map();
  for (const [k, pe] of pes) {
    const rid = k.slice(3), t = Number(pe && pe.t) || 0;
    const p = await st.get(`push:${rid}`);
    if (!p) { await st.delete(k); continue; }
    if (t > Date.now() + 250) { if (!sig || t < sig) sig = t; continue; }
    const res = (await st.get(`res:${rid}`)) || {};
    await st.delete([k, `push:${rid}`]);
    try { await mandar(env, { tk: p.tk, amb: p.amb, tipo: p.tipo, ...textoPush(p.tipo, res.fin || null) }); } catch (e) { console.log('push:', String((e && e.message) || e)); }
  }
  return sig;
}

/** se lo pasa al objeto que habla con Apple */
async function mandarPush(env, aviso) {
  if (!env || !env.QR) return { ok: false, motivo: 'sin objeto' };
  const r = await env.QR.get(env.QR.idFromName('apns|todos')).fetch('https://freno/apns', { method: 'POST', body: JSON.stringify(aviso) });
  return r.json();
}

/* ---------- en «apns|todos»: la credencial y el envío ---------- */

const b64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uTxt = (t) => b64u(new TextEncoder().encode(t));

/** la credencial para APNs: un JWT firmado con la clave .p8 (ES256). `clave` es el texto entero del archivo */
export async function jwtApns(clave, keyId, teamId, ahora = Date.now()) {
  const der = Uint8Array.from(atob(String(clave).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const base = `${b64uTxt(JSON.stringify({ alg: 'ES256', kid: keyId }))}.${b64uTxt(JSON.stringify({ iss: teamId, iat: Math.floor(ahora / 1000) }))}`;
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(base));
  return `${base}.${b64u(firma)}`;
}

/** una petición a APNs: { estado, motivo } */
async function unaApns(base, jwt, a, pedir) {
  const cuerpo = { aps: { alert: { title: a.titulo, body: a.texto }, sound: 'default', 'thread-id': a.hilo || 'fm' }, hash: a.hash || '', fm: a.tipo || '' };
  const r = await pedir(`${base}/3/device/${a.tk}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`, 'apns-topic': PUSH_TEMA, 'apns-push-type': 'alert', 'apns-priority': '10',
      // (pasada una hora ya no sirve de nada; y uno nuevo del mismo tipo sustituye al anterior en el móvil)
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `fm-${a.tipo || 'aviso'}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });
  let motivo = '';
  if (r.status !== 200) { try { motivo = String((await r.json()).reason || ''); } catch (e) { motivo = ''; } }
  return { estado: r.status, motivo };
}

/**
 * (en «apns|todos») manda un aviso: { ok, estado, motivo }. La credencial se guarda 45 minutos (en memoria y en el almacén
 * del objeto, por si Cloudflare lo reinicia). Si Apple dice que el identificador no es de ese servicio (una app de prueba
 * habla con el de pruebas), se prueba una vez con el otro
 */
export async function apnsObjeto(st, env, a, memo = {}, pedir = fetch) {
  const tk = tokenDe(a && a.tk);
  if (!tk || !a.titulo) return { ok: false, motivo: 'aviso mal formado' };
  if (!env || !env.APNS_KEY_P8 || !env.APNS_KEY_ID || !env.APNS_TEAM_ID) {
    if (!memo.sinClave) { memo.sinClave = true; console.log('push: faltan las claves de APNs (APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID): no se manda ningún aviso'); }
    return { ok: false, motivo: 'sin clave' };
  }
  const credencial = async (nueva) => {
    let j = memo.jwt || (await st.get('jwt'));
    if (nueva || !j || !j.v || j.k !== env.APNS_KEY_ID || Date.now() - j.t > JWT_DURA || Date.now() < j.t) {
      j = { t: Date.now(), k: env.APNS_KEY_ID, v: await jwtApns(env.APNS_KEY_P8, env.APNS_KEY_ID, env.APNS_TEAM_ID) };
      await st.put('jwt', j);
    }
    memo.jwt = j;
    return j.v;
  };
  const amb = a.amb === 'dev' ? 'dev' : 'prod';
  let r;
  try {
    r = await unaApns(APNS[amb], await credencial(false), { ...a, tk }, pedir);
    // la credencial caducada (o de antes de cambiar la clave): una nueva y otra vez. (No más: Apple no deja renovarla seguido)
    if (r.estado === 403 && /ExpiredProviderToken|InvalidProviderToken/.test(r.motivo) && Date.now() - memo.jwt.t > 20 * 60e3) r = await unaApns(APNS[amb], await credencial(true), { ...a, tk }, pedir);
    if (r.estado === 400 && r.motivo === 'BadDeviceToken') {
      const otro = await unaApns(APNS[amb === 'dev' ? 'prod' : 'dev'], memo.jwt.v, { ...a, tk }, pedir);
      if (otro.estado === 200) r = otro;
    }
  } catch (e) {
    // (en local, sin HTTP/2: «Network connection lost»)
    r = { estado: 0, motivo: String((e && e.message) || e).slice(0, 120) };
  }
  console.log(`push ${a.tipo || ''}: ${r.estado}${r.motivo ? ` ${r.motivo}` : ''}`);
  return { ok: r.estado === 200, estado: r.estado, motivo: r.motivo };
}
