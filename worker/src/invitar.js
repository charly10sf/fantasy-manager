/*
 * Invita a un amigo (19 nov; idea de Domy, diseño de Carlos: claude/pendiente-invitar-desbloquea.md en el proyecto).
 *
 * Solo gana quien invita:
 *   - por cada amigo que entra con su código, el dinero de `rivales` rivales que elige él, `horas` horas desde que entra el
 *     amigo (no desde que elige). Sin tope; cada amigo con su plazo.
 *   - escalones (los amigos que cuentan son los que vuelven otro día de Madrid): con 3, `dias` días con el doble de planes y
 *     preguntas gratis («doble»); con 5, `dias` días sin intersticiales ni anuncio de apertura («sinIntersticiales»).
 *     Cada escalón se gana una vez.
 * Cuenta solo si la cuenta invitada es nueva (su primera vez en la app hace como mucho `diasCodigo` días, o ninguna), nadie la
 * ha invitado antes, no es la misma que invita y está en la liga que dice (lo comprueba el Worker con LaLiga).
 *
 * Todo vive en un solo Durable Object («inv|todos»), no en el KV (las escrituras gratis del KV van justas):
 *   c|CODIGO → uid                     el código de cada cuenta
 *   k|uid    → { cod, t, inv: [...], esc: { premio: { desde, hasta } } }   lo de quien invita
 *              inv: [{ u, t, dia, v (ha vuelto otro día: 0/1), vt, r: [tid], l (liga de los rivales) }]
 *   a|uid    → { por, t, dia, v }      a quién ha invitado quién (para no contar dos veces y para «volver otro día»)
 *   b|uid    → t                       la cuenta ya existía y borró sus datos: no vale como nueva
 * Los números, en «invitar» de limites.json (cfgInvitar).
 */

export const INV_DEF = { on: true, rivales: 2, horas: 24, diasCodigo: 7, escalones: [{ n: 3, premio: 'doble', dias: 7 }, { n: 5, premio: 'sinIntersticiales', dias: 30 }] };
export const PREMIOS = new Set(['doble', 'sinIntersticiales']);
// sin I, O, 0 ni 1 (se confunden al copiarlo a mano)
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_COD = 6;
export const codValido = (x) => typeof x === 'string' && new RegExp(`^[${LETRAS}]{${LARGO_COD}}$`).test(x);
export const limpiarCod = (x) => String(x == null ? '' : x).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').slice(0, 12);
const uidOk = (x) => /^\d{1,15}$/.test(String(x || ''));
const tidOk = (x) => /^\d{1,15}$/.test(String(x || ''));

/** «invitar» de limites.json, con sus topes (lo raro, a lo de por defecto) */
export function cfgInvitar(lim) {
  const p = (lim && lim.invitar && typeof lim.invitar === 'object') ? lim.invitar : {};
  const n = (x, d, lo, hi) => { const v = Number(x); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d; };
  const esc = (Array.isArray(p.escalones) ? p.escalones : INV_DEF.escalones)
    .filter((e) => e && PREMIOS.has(e.premio))
    .map((e) => ({ n: n(e.n, 3, 1, 100), premio: e.premio, dias: n(e.dias, 7, 1, 120) }))
    .filter((e, i, a) => a.findIndex((x) => x.premio === e.premio) === i)
    .sort((a, b) => a.n - b.n);
  return { on: p.on !== false, rivales: n(p.rivales, INV_DEF.rivales, 0, 5), horas: n(p.horas, INV_DEF.horas, 1, 24 * 14), diasCodigo: n(p.diasCodigo, INV_DEF.diasCodigo, 0, 60), escalones: esc };
}

function nuevoCod() {
  const b = crypto.getRandomValues(new Uint8Array(LARGO_COD));
  return [...b].map((x) => LETRAS[x % LETRAS.length]).join('');
}

/** lo que ve quien invita (sin ids de nadie): su código, cada amigo con su plazo y sus rivales, cuántos cuentan y los premios */
export function estadoDe(k, a, cfg, ahora) {
  const inv = (k && k.inv) || [];
  const cuentan = inv.filter((x) => x.v).length;
  const esc = (k && k.esc) || {};
  const sig = cfg.escalones.find((e) => !esc[e.premio]) || null;
  return {
    on: cfg.on,
    cod: (k && k.cod) || '',
    entran: inv.length,
    cuentan,
    amigos: inv.map((x, i) => ({ i, t: x.t, hasta: x.t + cfg.horas * 3600e3, r: x.r || [], l: x.l || '', v: x.v ? 1 : 0 })),
    premios: Object.fromEntries(Object.entries(esc).map(([p, e]) => [p, { desde: e.desde, hasta: e.hasta }])),
    sig: sig ? { n: sig.n, premio: sig.premio, dias: sig.dias } : null,
    cfg: { rivales: cfg.rivales, horas: cfg.horas, diasCodigo: cfg.diasCodigo, escalones: cfg.escalones },
    // a esta cuenta la invitaron (sin decir quién)
    ...(a ? { invitado: { t: a.t, v: a.v ? 1 : 0 } } : {}),
    ahora,
  };
}

/** los escalones que se acaban de ganar con los amigos que cuentan (cambia k.esc) */
export function ganarEscalones(k, cfg, ahora) {
  const cuentan = (k.inv || []).filter((x) => x.v).length;
  k.esc = k.esc || {};
  const nuevos = [];
  for (const e of cfg.escalones) {
    if (cuentan >= e.n && !k.esc[e.premio]) { k.esc[e.premio] = { desde: ahora, hasta: ahora + e.dias * 864e5 }; nuevos.push(e.premio); }
  }
  return nuevos;
}

/**
 * Lo que hace el objeto: { op, uid, cfg, ahora, dia, ... } → { ok, ... }. `st` es su almacén (get, put, delete, list).
 * op: 'estado' (y, si es un invitado de otro día, cuenta que ha vuelto), 'codigo', 'canjear', 'rivales', 'borrar', 'todos'.
 */
export async function invObjeto(st, b) {
  const cfg = b.cfg || cfgInvitar(null), ahora = Number(b.ahora) || Date.now(), dia = String(b.dia || '');
  const uid = String(b.uid || '');
  if (b.op === 'todos') {
    const ks = [...(await st.list({ prefix: 'k|' })).entries()];
    const as = [...(await st.list({ prefix: 'a|' })).values()];
    return { ok: true, lista: ks.map(([kk, k]) => ({ uid: kk.slice(2), cod: k.cod, entran: (k.inv || []).length, cuentan: (k.inv || []).filter((x) => x.v).length, esc: Object.keys(k.esc || {}), ultima: Math.max(0, ...(k.inv || []).map((x) => x.t)) })).filter((x) => x.entran), invitados: as.length, vuelven: as.filter((x) => x.v).length };
  }
  if (!uidOk(uid)) return { ok: false, e: 'Cuenta no válida' };
  const kK = `k|${uid}`, kA = `a|${uid}`;
  if (b.op === 'borrar') {
    // (Ajustes → Borrar mis datos) su código y sus premios fuera; queda que la cuenta ya existía, sin nada más
    const k = await st.get(kK);
    if (k && k.cod) await st.delete(`c|${k.cod}`);
    await st.delete(kK);
    await st.put(`b|${uid}`, ahora);
    return { ok: true };
  }
  if (b.op === 'estado' || b.op === 'codigo') {
    let k = await st.get(kK);
    const a = await st.get(kA);
    // el invitado que vuelve otro día: ahora sí cuenta para los escalones de quien le invitó
    if (a && !a.v && dia && a.dia && dia !== a.dia) {
      a.v = 1; a.vt = ahora;
      await st.put(kA, a);
      const p = await st.get(`k|${a.por}`);
      if (p && Array.isArray(p.inv)) {
        const x = p.inv.find((y) => String(y.u) === uid);
        if (x && !x.v) { x.v = 1; x.vt = ahora; ganarEscalones(p, cfg, ahora); await st.put(`k|${a.por}`, p); }
      }
    }
    if (b.op === 'codigo' && !(k && k.cod)) {
      let cod = '';
      for (let i = 0; i < 8 && !cod; i++) { const c = nuevoCod(); if (!(await st.get(`c|${c}`))) cod = c; }
      if (!cod) return { ok: false, e: 'No se ha podido sacar tu código ahora. Vuelve a probar en un rato.' };
      k = { ...(k || { inv: [], esc: {} }), cod, t: ahora };
      await st.put(`c|${cod}`, uid);
      await st.put(kK, k);
    }
    const est = { ok: true, ...estadoDe(k, a, cfg, ahora) };
    // «¿Te ha invitado alguien?»: a una cuenta nueva sin invitación, en sus primeros diasCodigo días (con `primera`, el GET)
    if (b.primera != null) {
      const p = Number(b.primera) || 0, hasta = (p || ahora) + cfg.diasCodigo * 864e5;
      est.puedeCanjear = !!(cfg.on && !a && !(await st.get(`b|${uid}`)) && ahora <= hasta && !(k && (k.inv || []).length));
      if (est.puedeCanjear) est.canjearHasta = hasta;
    }
    return est;
  }
  if (b.op === 'canjear') {
    if (!cfg.on) return { ok: false, motivo: 'apagado', e: 'Las invitaciones están paradas ahora.' };
    const cod = limpiarCod(b.cod);
    if (!codValido(cod)) return { ok: false, motivo: 'codigo', e: 'Ese código no es válido. Son 6 letras y números.' };
    const por = await st.get(`c|${cod}`);
    if (!por) return { ok: false, motivo: 'codigo', e: 'Ese código no existe. Revísalo con quien te lo ha pasado.' };
    if (String(por) === uid) return { ok: false, motivo: 'misma', e: 'Ese código es el tuyo: pásaselo a un amigo.' };
    const ya = await st.get(kA);
    if (ya) return String(ya.por) === String(por) ? { ok: true, ya: true } : { ok: false, motivo: 'ya', e: 'Tu cuenta ya entró con la invitación de otra persona.' };
    // nueva: nunca vista o vista por primera vez hace como mucho diasCodigo días; y que no haya borrado sus datos antes
    const primera = Number(b.primera) || 0;
    if (await st.get(`b|${uid}`)) return { ok: false, motivo: 'vieja', e: 'Las invitaciones son para cuentas que empiezan a usar la app.' };
    if (primera && ahora - primera > cfg.diasCodigo * 864e5) return { ok: false, motivo: 'vieja', e: 'Las invitaciones son para cuentas que empiezan a usar la app.' };
    if (!b.enLiga) return { ok: false, motivo: 'liga', e: 'Entra antes en tu liga de LaLiga Fantasy y vuelve a probar.' };
    const p = (await st.get(`k|${por}`)) || { cod, t: ahora, inv: [], esc: {} };
    p.inv = Array.isArray(p.inv) ? p.inv : [];
    if (!p.inv.some((x) => String(x.u) === uid)) p.inv.push({ u: uid, t: ahora, dia, v: 0, r: [], l: '' });
    // (primero el invitado: si algo falla a medias, al repetir no se cuenta dos veces)
    await st.put(kA, { por: String(por), t: ahora, dia, v: 0 });
    await st.put(`k|${por}`, p);
    return { ok: true };
  }
  if (b.op === 'rivales') {
    const k = await st.get(kK);
    const i = Number(b.i);
    const x = k && Array.isArray(k.inv) && Number.isInteger(i) ? k.inv[i] : null;
    if (!x) return { ok: false, e: 'No tienes esa invitación.' };
    if (ahora >= x.t + cfg.horas * 3600e3) return { ok: false, e: 'Se ha acabado el plazo de esa invitación.' };
    const liga = String(b.liga || '');
    if (!/^\d{1,20}$/.test(liga)) return { ok: false, e: 'Liga no válida' };
    if (x.l && x.l !== liga && (x.r || []).length) return { ok: false, e: 'Esos rivales ya los elegiste en otra liga.' };
    const nuevos = (Array.isArray(b.tids) ? b.tids : []).map(String).filter(tidOk);
    // los ya elegidos no se cambian; se añaden hasta llegar a `rivales`
    const r = [...new Set([...(x.r || []), ...nuevos])].slice(0, cfg.rivales);
    if (r.length === (x.r || []).length) return { ok: false, e: (x.r || []).length >= cfg.rivales ? `Ya elegiste tus ${cfg.rivales} rivales de este amigo.` : 'Elige algún rival.' };
    x.r = r; x.l = liga;
    await st.put(kK, k);
    return { ok: true, ...estadoDe(k, await st.get(kA), cfg, ahora) };
  }
  return { ok: false, e: 'No existe' };
}

/** ¿tiene ahora ese premio? (con el estado que da invObjeto) */
export const premioActivo = (est, premio, ahora = Date.now()) => !!(est && est.premios && est.premios[premio] && est.premios[premio].hasta > ahora);
