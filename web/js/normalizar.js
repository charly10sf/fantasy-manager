/* Pasa las respuestas de la API (que cambian de forma de una temporada a otra) a un modelo propio y estable.
   Todo es defensivo: si un campo no está, se busca en sus otros sitios conocidos y si no, se deja vacío. */
import { ms, num, norm } from './util.js';

/** la lista que haya dentro: [..], {data:[..]}, {elements:[..]}, o el primer array que tenga */
export function lista(r) {
  if (Array.isArray(r)) return r;
  if (!r || typeof r !== 'object') return [];
  for (const k of ['data', 'elements', 'items', 'results', 'players', 'teams', 'leagues', 'matches', 'activity']) {
    if (Array.isArray(r[k])) return r[k];
    if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) { const x = lista(r[k]); if (x.length) return x; }
  }
  const a = Object.values(r).find(Array.isArray);
  return a || [];
}
const id = (x) => (x == null || x === '' ? '' : String(x));
const primero = (...v) => v.find((x) => x != null && x !== '');

/* ---------- equipos de LaLiga ---------- */
export function equiposLaLiga(r) {
  const m = {};
  for (const t of lista(r)) {
    if (!t || t.id == null) continue;
    const img = [t.badgeColor, t.badgeWhite, t.badge, t.image].find((x) => typeof x === 'string' && /^https?:/.test(x));
    m[id(t.id)] = { nombre: t.name || t.shortName || '', corto: t.shortName || t.abbreviation || (t.name || '').slice(0, 3).toUpperCase(), escudo: img || null, slug: t.slug || '' };
  }
  return m;
}

/* ---------- jugadores ---------- */
export function jugador(p, equipos = {}) {
  if (!p || typeof p !== 'object') return null;
  const pm = p.playerMaster && typeof p.playerMaster === 'object' ? p.playerMaster : p;
  if (pm.id == null) return null;
  const eqId = id(primero(pm.teamId, pm.team && pm.team.id));
  const eq = equipos[eqId] || {};
  const img = primero(
    pm.images && pm.images.transparent && pm.images.transparent['256x256'],
    pm.images && pm.images.player,
    pm.image, pm.photo,
  );
  return {
    id: id(pm.id),
    nombre: pm.nickname || pm.name || 'Jugador',
    largo: pm.name || pm.nickname || '',
    equipoId: eqId,
    equipo: (pm.team && pm.team.name) || eq.nombre || '',
    pos: num(primero(pm.positionId, pm.position)) || 0,
    valor: num(primero(pm.marketValue, pm.value, pm.price)),
    puntos: num(primero(pm.points, pm.totalPoints)),
    media: num(primero(pm.averagePoints, pm.avgPoints)),
    estado: pm.playerStatus || pm.status || 'ok',
    img: typeof img === 'string' ? img : null,
    temporadaPasada: num(pm.lastSeasonPoints),
  };
}

export function jugadores(r, equipos) {
  const m = {};
  for (const p of lista(r)) { const j = jugador(p, equipos); if (j) m[j.id] = j; }
  return m;
}

/* ---------- plantilla de un equipo de tu liga ---------- */
export function plantilla(r, equipos) {
  const datos = r && r.data && !Array.isArray(r.data) ? r.data : r;
  const lst = Array.isArray(datos && datos.players) ? datos.players : lista(datos);
  const fichas = [];
  for (const pt of lst) {
    const j = jugador(pt, equipos);
    if (!j) continue;
    fichas.push({
      pid: j.id,
      ptId: id(primero(pt.playerTeamId, pt.id !== (pt.playerMaster && pt.playerMaster.id) ? pt.id : null)),
      clausula: num(primero(pt.buyoutClause, pt.clause)),
      protegidoHasta: ms(primero(pt.buyoutClauseLockedEndTime, pt.clauseEndTime)),
      compra: num(primero(pt.purchasePrice, pt.buyPrice, pt.price)) || null,
      jugador: j,
    });
  }
  const info = {
    valor: num(primero(datos && datos.teamValue, datos && datos.team && datos.team.teamValue)),
    nombre: (datos && (datos.name || (datos.team && datos.team.name))) || '',
    dinero: datos && datos.teamMoney != null ? num(datos.teamMoney) : null,
  };
  return { fichas, info };
}

/* ---------- clasificación ---------- */
export function clasificacion(r) {
  const out = [];
  lista(r).forEach((e, i) => {
    const t = e.team || {};
    const m = t.manager || e.manager || {};
    const teamId = id(primero(e.teamId, t.id, e.id));
    if (!teamId) return;
    out.push({
      teamId,
      nombre: primero(t.name, e.name, m.managerName, typeof e.manager === 'string' ? e.manager : null) || `Equipo ${i + 1}`,
      manager: primero(m.managerName, typeof e.manager === 'string' ? e.manager : null, t.name, e.name) || '',
      userId: id(primero(e.userId, t.userId, m.id, m.userId, e.managerId)),
      puntos: num(primero(e.points, t.teamPoints, t.points)),
      valor: num(primero(e.teamValue, t.teamValue)),
      puntosJornada: num(primero(e.weekPoints, t.weekPoints)),
      pos: num(primero(e.position, e.rank, i + 1)),
      avatar: typeof m.avatar === 'string' ? m.avatar : null,
    });
  });
  out.sort((a, b) => a.pos - b.pos || b.puntos - a.puntos);
  return out;
}

export function dinero(r) {
  if (typeof r === 'number') return r;
  if (!r || typeof r !== 'object') return null;
  const d = r.data && typeof r.data === 'object' ? r.data : r;
  const v = primero(d.teamMoney, d.money, d.amount, d.balance, typeof r.data === 'number' ? r.data : null);
  return v == null ? null : num(v);
}

/* ---------- mercado ---------- */
export function mercado(r, equipos) {
  const out = [];
  for (const it of lista(r)) {
    const j = jugador(it.playerMaster || it.player || it, equipos);
    if (!j) continue;
    const vend = it.sellerTeam || {};
    const bid = it.bid && typeof it.bid === 'object' ? it.bid : null;
    out.push({
      id: id(it.id),
      pid: j.id,
      tipo: it.discr === 'marketPlayerTeam' || vend.id ? 'manager' : 'liga',
      precio: num(primero(it.salePrice, it.price, j.valor)),
      cierra: ms(primero(it.expirationDate, it.endDate)),
      pujas: num(primero(it.numberOfBids, it.bids && it.bids.length)),
      ofertas: num(it.numberOfOffers),
      vendedorTeamId: id(vend.id),
      vendedor: (vend.manager && vend.manager.managerName) || vend.name || '',
      miPuja: bid ? num(primero(bid.money, bid.amount)) : (typeof it.bid === 'number' ? it.bid : null),
      clausula: it.playerTeam ? num(it.playerTeam.buyoutClause) : null,
      jugador: j,
    });
  }
  return out;
}

/* ---------- jornada y partidos ---------- */
export function semana(r) {
  if (typeof r === 'number') return r;
  if (!r || typeof r !== 'object') return null;
  const d = r.data && typeof r.data === 'object' ? r.data : r;
  const v = primero(d.weekNumber, d.number, d.week, d.id, typeof r.data === 'number' ? r.data : null);
  return v == null ? null : num(v);
}

export function partidos(r, equipos, n) {
  const out = [];
  for (const m of lista(r)) {
    const lid = id(primero(m.localId, m.local && m.local.id, m.homeTeamId));
    const vid = id(primero(m.visitorId, m.visitor && m.visitor.id, m.awayTeamId));
    if (!lid || !vid) continue;
    out.push({
      id: id(m.id),
      jornada: num(primero(m.weekNumber, m.week, n)),
      fecha: ms(primero(m.matchDate, m.date, m.startDate, m.kickoff)),
      localId: lid, visitanteId: vid,
      local: (m.local && m.local.name) || (equipos[lid] || {}).nombre || '',
      visitante: (m.visitor && m.visitor.name) || (equipos[vid] || {}).nombre || '',
      gl: m.localScore ?? m.homeScore ?? null, gv: m.visitorScore ?? m.awayScore ?? null,
      estado: m.matchState ?? m.status ?? null,
    });
  }
  return out.sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
}

/* ---------- actividad de la liga ---------- */
// 1 compró · 4 blindó · 6 ganancia por jornada · 7 alineación incorrecta · 9 nuevo miembro · 31 fichó · 32 clausuló · 33 vendió
export const TIPO_ACT = { 1: 'compra', 31: 'compra', 32: 'clausula', 33: 'venta', 4: 'blindaje', 6: 'premio', 7: 'alineacion', 9: 'entra' };
export function actividad(r) {
  const out = [];
  const visitar = (x, prof) => {
    if (!x || prof > 5) return;
    if (Array.isArray(x)) { x.forEach((y) => visitar(y, prof + 1)); return; }
    if (typeof x !== 'object') return;
    if (x.activityTypeId != null) {
      const pl = x.player || x.playerMaster || {};
      out.push({
        id: id(primero(x.id, x.activityId)),
        t: ms(primero(x.createdAt, x.timestamp, x.date, x.publicationDate)),
        tipo: num(x.activityTypeId),
        clase: TIPO_ACT[num(x.activityTypeId)] || 'otro',
        quien: x.user1Name || '', quienId: id(x.user1Id),
        otro: x.user2Name || '', otroId: id(x.user2Id),
        pid: id(primero(x.playerMasterId, pl.id)),
        jugador: x.playerName || pl.nickname || pl.name || '',
        importe: x.amount == null ? null : num(x.amount),
        texto: x.description || '',
      });
      return;
    }
    Object.values(x).forEach((y) => { if (y && typeof y === 'object') visitar(y, prof + 1); });
  };
  visitar(r, 0);
  return out;
}

/* ---------- futbolfantasy.com: la subida o bajada del día de cada jugador ---------- */
export function paginaMercado(html) {
  const out = [];
  const trozos = String(html || '').split('class="elemento_jugador');
  for (let i = 1; i < trozos.length; i++) {
    const t = trozos[i].slice(0, 4000);
    const at = (n) => { const m = t.match(new RegExp(`data-${n}="([^"]*)"`)); return m ? m[1] : null; };
    const valor = num(at('valor'));
    if (!valor) continue;
    const difs = {};
    for (const m of t.matchAll(/data-diferencia(-pct)?(\d+)="([^"]*)"/g)) {
      const v = parseFloat(String(m[3]).replace(',', '.'));
      if (Number.isFinite(v)) difs[(m[1] ? 'p' : 'd') + m[2]] = v;
    }
    out.push({ nombre: at('nombre') || '', pos: at('posicion') || '', equipo: at('equipo') || '', valor, ...difs });
  }
  return out;
}

/** une lo de futbolfantasy con los jugadores de la API: por valor exacto (es el mismo número) y nombre */
export function unirTendencias(ff, maestro) {
  const porValor = {};
  for (const j of Object.values(maestro)) (porValor[j.valor] ||= []).push(j);
  const out = {};
  for (const x of ff) {
    const cands = porValor[x.valor] || [];
    let j = null;
    if (cands.length === 1) j = cands[0];
    else if (cands.length > 1) {
      const n = norm(x.nombre);
      j = cands.find((c) => norm(c.nombre) === n) || cands.find((c) => n.includes(norm(c.nombre).split(' ').pop()) || norm(c.largo).includes(n));
    }
    if (!j) {
      // el valor ya ha cambiado (futbolfantasy va unas horas por detrás o por delante): por nombre
      const n = norm(x.nombre);
      const porNombre = Object.values(maestro).filter((c) => norm(c.nombre) === n);
      if (porNombre.length === 1) j = porNombre[0];
    }
    if (j) out[j.id] = { d1: x.d1 ?? null, p1: x.p1 ?? null, d7: x.d7 ?? null, p7: x.p7 ?? null, ffValor: x.valor };
  }
  return out;
}

/* ---------- la ficha de un jugador: puntos por jornada (y el histórico de valor si viene) ---------- */
export function detalleJugador(r) {
  const d = r && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : r || {};
  const pm = d.playerMaster && typeof d.playerMaster === 'object' ? d.playerMaster : d;
  const st = (x, k) => { const v = x && x.stats && x.stats[k]; return Array.isArray(v) ? num(v[0]) : num(v); };
  const stats = (Array.isArray(pm.playerStats) ? pm.playerStats : Array.isArray(d.playerStats) ? d.playerStats : [])
    .map((s) => ({ n: num(s.weekNumber), pts: num(s.totalPoints), min: st(s, 'mins_played'), gol: st(s, 'goals'), asis: st(s, 'goal_assist'), am: st(s, 'yellow_card'), roja: st(s, 'red_card') }))
    .filter((s) => s.n).sort((a, b) => a.n - b.n);
  // si en algún sitio viene una lista de valores con fecha, es el histórico de valor
  let valores = null;
  const visitar = (x, prof) => {
    if (valores || !x || prof > 4 || typeof x !== 'object') return;
    if (Array.isArray(x)) {
      if (x.length > 2 && x[0] && typeof x[0] === 'object' && 'marketValue' in x[0] && ('date' in x[0] || 'day' in x[0] || 'createdAt' in x[0])) {
        valores = x.map((v) => [ms(v.date || v.day || v.createdAt), num(v.marketValue)]).filter(([t, v]) => t && v).sort((a, b) => a[0] - b[0]);
        return;
      }
      x.slice(0, 50).forEach((y) => visitar(y, prof + 1));
      return;
    }
    Object.values(x).forEach((y) => visitar(y, prof + 1));
  };
  visitar(d, 0);
  return { stats, valores: valores && valores.length > 2 ? valores : null };
}
