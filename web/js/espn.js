/* Quién salió de titular y quién entró (y en qué minuto) en los partidos de un club, de ESPN (Carlos, 5 nov: LaLiga Fantasy no
   dice quién fue titular, y con solo los minutos un titular que se lesiona en el 6' salía como suplente: pasó con Maroan Sannadi
   en la J11). Sin token y con CORS abierto (probado el 5 nov):
   - /teams: los 20 equipos (su id de ESPN), por nombre con los de LaLiga
   - /teams/{id}/schedule: sus partidos de liga (los acabados, con su fecha)
   - /teams/{id}/roster: su plantilla (id de ESPN y nombre), para casar cada jugador con el de LaLiga Fantasy
   - core …/events/{ev}/competitions/{ev}/competitors/{id}/roster: los del partido (titular, entra o sale y el minuto), ~15 KB
   Cada partido acabado se pide una vez y se guarda. Si algo falla, la app sigue con los minutos de LaLiga (clubes.js). */
import { norm as norm0, LS, enParalelo } from './util.js';

// (las letras que no se descomponen: Sørloth, Ødegaard, Łukasz…)
// y las abreviaturas de los apellidos que usa LaLiga Fantasy («Aitor Fdez», «Rafa Fdez.»)
const ABREV = { fdez: 'fernandez', glez: 'gonzalez', gzlez: 'gonzalez', rguez: 'rodriguez', rdguez: 'rodriguez', hdez: 'hernandez', hndez: 'hernandez', mtnez: 'martinez', mtez: 'martinez', sanz: 'sanz', jmnez: 'jimenez', dguez: 'dominguez' };
const norm = (x) => norm0(String(x || '').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd')).split(' ').map((w) => ABREV[w] || w).join(' ');
/** las letras que hay que cambiar para pasar de una palabra a otra (para «Jauregi» y «Jauregui») */
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1';
const CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/esp.1';
const DIA = 864e5;

async function json(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`ESPN ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const VACIAS = new Set(['de', 'fc', 'cf', 'club', 'real', 'ud', 'cd', 'rcd', 'rc', 'la', 'del', 'el', 'y', 'sd', 'ad', 'sad']);
// (LaLiga dice «Deportivo Alavés» y «RC Deportivo»; ESPN, «Alavés» y «Deportivo»: «deportivo» solo cuenta si va sola)
const fichas = (s) => { const t = norm(s).split(' ').filter((x) => x.length > 1 && !VACIAS.has(x)); return new Set(t.length > 1 ? t.filter((x) => x !== 'deportivo') : t); };
/** lo que se parecen dos nombres de club (0 a 1): «Atlético» y «Atlético Madrid» 0,5; «Real Madrid» y «Atlético Madrid» 0,33 */
export function pareceClub(a, b) {
  const A = fichas(a), B = fichas(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / (A.size + B.size - n);
}

/** el id de ESPN del club (los 20 equipos se guardan 30 días) */
async function idEspn(nombre) {
  let g = LS.get('espn-eq', null);
  if (!g || Date.now() - g.t > 30 * DIA || !Array.isArray(g.l) || !g.l.length) {
    const r = await json(`${SITE}/teams`);
    const l = (((r.sports || [])[0] || {}).leagues || [])[0];
    g = { t: Date.now(), l: ((l && l.teams) || []).map((x) => [String(x.team.id), x.team.displayName, x.team.shortDisplayName || '']) };
    if (g.l.length) LS.set('espn-eq', g);
  }
  let mejor = null, p = 0.3;
  for (const [id, a, b] of g.l) {
    const v = Math.max(pareceClub(nombre, a), pareceClub(nombre, b));
    if (v > p) { p = v; mejor = id; }
  }
  return mejor;
}

/* ---------- casar a los jugadores de ESPN con los de LaLiga Fantasy ---------- */
const sinInicial = (s) => norm(String(s || '').replace(/^\S{1,3}\.\s*/, ''));
const ultima = (s) => { const w = norm(s).split(' ').filter(Boolean); return w[w.length - 1] || ''; };
/**
 * { idEspn: pid } de los atletas de ESPN [{ id, n: [nombres] }] contra los de LaLiga [{ id, nombre, largo }]. Por pasos, de más
 * seguro a menos: el nombre igual; uno dentro del otro; el apellido, solo si nadie más lo lleva (los dos Williams del Athletic
 * se casan por el nombre completo)
 */
export function casar(atletas, jugadores) {
  const out = {};
  const libres = new Set(jugadores.map((j) => j.id));
  const nombresJ = (j) => [norm(j.nombre), norm(j.largo || '')].filter(Boolean);
  const pasos = [
    (a, j) => a.n.some((x) => nombresJ(j).includes(norm(x))),
    (a, j) => a.n.some((x) => { const s = sinInicial(x); return s.length > 4 && nombresJ(j).some((y) => y.length > 4 && (y.includes(s) || s.includes(y))); }),
  ];
  for (const paso of pasos) {
    for (const a of atletas) {
      if (out[a.id]) continue;
      const c = jugadores.filter((j) => libres.has(j.id) && paso(a, j));
      if (c.length === 1) { out[a.id] = c[0].id; libres.delete(c[0].id); }
    }
  }
  // el apodo de una palabra («Yuri», «Yeray») que es una de las palabras del nombre de ESPN («Yuri Berchiche»); y el apellido
  // («Navarro» y «Robert Navarro»): solo si no hay otro igual en ninguno de los dos lados
  const palabras = (x) => norm(x).split(' ').filter((w) => w.length >= 3);
  for (const a of atletas) {
    if (out[a.id]) continue;
    const pa = new Set(a.n.flatMap(palabras));
    const c = jugadores.filter((j) => libres.has(j.id) && palabras(j.nombre).length === 1 && pa.has(palabras(j.nombre)[0]));
    if (c.length !== 1) continue;
    const w = palabras(c[0].nombre)[0];
    if (atletas.filter((x) => !out[x.id] && x.n.flatMap(palabras).includes(w)).length === 1) { out[a.id] = c[0].id; libres.delete(c[0].id); }
  }
  // una palabra del apodo (4 letras o más) que es el principio de una del nombre de ESPN: «Vini Jr.» y «Vinícius Júnior»,
  // «Aitor Fdez» y «Aitor Fernández»; también solo si es único en los dos lados
  const empieza = (a, j) => { const pa = a.n.flatMap(palabras); return palabras(j.nombre).some((w) => w.length >= 4 && pa.some((x) => x !== w && x.startsWith(w))); };
  for (const a of atletas) {
    if (out[a.id]) continue;
    const c = jugadores.filter((j) => libres.has(j.id) && empieza(a, j));
    if (c.length === 1 && atletas.filter((x) => !out[x.id] && empieza(x, c[0])).length === 1) { out[a.id] = c[0].id; libres.delete(c[0].id); }
  }
  // ESPN con una sola palabra («Manu») que está en el apodo («Manu Hernando»); y un apellido de 6 letras o más que solo cambia
  // en una («Jauregi» y «Jauregui»): solo si es único en los dos lados
  const una = (a, j) => { const pa = a.n.flatMap(palabras); return new Set(pa).size === 1 && palabras(j.nombre).includes(pa[0]); };
  const casi = (a, j) => { const ua = ultima(a.n[0]), uj = ultima(j.nombre); return ua.length >= 6 && uj.length >= 6 && distancia(ua, uj) === 1; };
  for (const f of [una, casi]) {
    for (const a of atletas) {
      if (out[a.id]) continue;
      const c = jugadores.filter((j) => libres.has(j.id) && f(a, j));
      if (c.length === 1 && atletas.filter((x) => !out[x.id] && f(x, c[0])).length === 1) { out[a.id] = c[0].id; libres.delete(c[0].id); }
    }
  }
  for (const a of atletas) {
    if (out[a.id]) continue;
    const ua = ultima(a.n[0]);
    if (ua.length < 4) continue;
    const otrosA = atletas.filter((x) => !out[x.id] && ultima(x.n[0]) === ua);
    const c = jugadores.filter((j) => libres.has(j.id) && nombresJ(j).some((y) => ultima(y) === ua));
    if (otrosA.length === 1 && c.length === 1) { out[a.id] = c[0].id; libres.delete(c[0].id); }
  }
  return out;
}

const minDe = (s) => { const c = s && s.clock; if (!c) return null; const m = String(c.displayValue || '').match(/(\d+)/); if (m) return Number(m[1]); return Number(c.value) > 0 ? Math.ceil(Number(c.value) / 60) : null; };
/** el id de ESPN de un $ref de atleta (…/athletes/276996?lang=es) */
const idRef = (x) => { const m = String((x && x.$ref) || '').match(/athletes\/(\d+)/); return m ? m[1] : null; };

/**
 * Los titulares y los cambios de un club en cada jornada acabada: { t, eq, porN: { n: { tit: [pid], ent: [[pid, minuto]], forma,
 * sin, nc } } } (sin: los del partido que no se han podido casar con LaLiga Fantasy: canteranos que no salen en LaLiga Fantasy
 * o los que ya se fueron; nc: los de LaLiga Fantasy del club sin casar con nadie de ESPN).
 * D: la foto de la app (equipos, resultados, maestro); id: el club en LaLiga; previo: lo guardado (los partidos ya leídos no se
 * vuelven a pedir).
 */
export async function titularesClub(D, id, previo = null) {
  const nombre = ((D.equipos || {})[id] || {}).nombre;
  if (!nombre) return null;
  const eq = (previo && previo.eq) || await idEspn(nombre);
  if (!eq) return null;
  const porN = { ...((previo && previo.porN) || {}) };
  // sus partidos acabados en LaLiga y los de ESPN, casados por el rival y por si juega en casa o fuera (en una liga, cada cruce
  // pasa una vez: vale aunque el partido se aplazara; los resultados guardados no llevan la fecha)
  const res = (D.resultados || []).filter((p) => p.localId === id || p.visitanteId === id);
  const faltan = res.filter((p) => !porN[p.jornada]);
  if (!faltan.length) return { t: Date.now(), eq, porN, atl: previo && previo.atl };
  const sc = await json(`${SITE}/teams/${eq}/schedule`);
  const evs = [];
  for (const e of sc.events || []) {
    const c = (e.competitions || [])[0];
    if (!c || !(c.status && c.status.type && c.status.type.completed)) continue;
    const yo = (c.competitors || []).find((x) => String(x.id || (x.team && x.team.id)) === String(eq));
    const otro = (c.competitors || []).find((x) => x !== yo);
    if (yo && otro && otro.team) evs.push({ id: String(e.id), casa: yo.homeAway === 'home', rival: otro.team.displayName || otro.team.name || '' });
  }
  const eventoDe = (p) => {
    const casa = p.localId === id;
    const rn = ((D.equipos || {})[casa ? p.visitanteId : p.localId] || {}).nombre || '';
    let mejor = null, v = 0.3;
    for (const e of evs) if (e.casa === casa) { const x = pareceClub(rn, e.rival); if (x > v) { v = x; mejor = e; } }
    return mejor;
  };
  // la plantilla de ESPN (3 días)
  let atl = previo && previo.atl && Date.now() - previo.atl.t < 3 * DIA ? previo.atl : null;
  if (!atl) {
    const r = await json(`${SITE}/teams/${eq}/roster`);
    atl = { t: Date.now(), l: (r.athletes || []).map((a) => ({ id: String(a.id), n: [a.displayName, a.fullName, a.shortName].filter(Boolean) })) };
  }
  const jug = Object.values(D.maestro || {}).filter((j) => j.equipoId === id && j.pos >= 1 && j.pos <= 4).map((j) => ({ id: String(j.id), nombre: j.nombre, largo: j.largo }));
  const deEspn = casar(atl.l, jug);
  // los de LaLiga Fantasy que no se han casado con nadie de ESPN: solo esos pueden ser los «sin» de un partido
  const casados = new Set(Object.values(deEspn));
  const nc = jug.filter((j) => !casados.has(j.id)).map((j) => j.id);
  await enParalelo(faltan, 4, async (p) => {
    const ev = eventoDe(p);
    if (!ev) return;
    try {
      const r = await json(`${CORE}/events/${ev.id}/competitions/${ev.id}/competitors/${eq}/roster?lang=es`);
      const tit = [], ent = [];
      let sin = 0;
      // el minuto en que entra uno es el de la salida del que sustituye: ESPN pone el mismo reloj en las dos partes de la entrada
      // de cada jugador, así que el último de los suyos (si el sustituido también había entrado, su reloj de salida es el mayor)
      const porId = new Map((r.entries || []).map((e) => [String(e.playerId), e]));
      const salida = (e) => Math.max(...[e && e.subbedIn, e && e.subbedOut].map(minDe).filter((x) => x != null), -1);
      for (const e of r.entries || []) {
        const pid = deEspn[String(e.playerId)];
        const entra = e.subbedIn && e.subbedIn.didSub;
        if (!e.starter && !entra) continue;
        if (!pid) { sin++; continue; }
        if (e.starter) tit.push(pid);
        else { const m = salida(porId.get(idRef(e.subbedIn.replacementAthlete))); ent.push([pid, m >= 0 ? m : minDe(e.subbedIn)]); }
      }
      const f = r.formation && (r.formation.summary || r.formation.name);
      // (con menos de 7 titulares casados no vale: mejor los minutos de LaLiga)
      if (tit.length >= 7) porN[p.jornada] = { tit, ent, forma: f || null, sin, nc };
    } catch (e) { /* ese partido, con los minutos */ }
  });
  return { t: Date.now(), eq, porN, atl };
}
