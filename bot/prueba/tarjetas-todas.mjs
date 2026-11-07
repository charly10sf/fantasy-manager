// Banco de pruebas de TODAS las tarjetas (6 nov, rediseño): dibuja cada clase con datos reales de LaLiga (final, jugador en los cuatro
// metales, resumen, mercado, onces, bajas de uno, de un equipo y de varios, novedades, dudas y apercibidos), las pasa por el validador de
// siempre y deja los PNG en --salida. Con --estres=1 añade los nombres más largos de la liga (donde se rompen los diseños).
//   node bot/prueba/tarjetas-todas.mjs --salida=/tmp/tarjetas [--jornada=11] [--estres=1]
// Los datos de mercado de las tarjetas de mercado son inventados (solo para ver la maqueta); lo demás, de la API sin token.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const salida = arg('salida') || '/tmp/tarjetas', jornada = Number(arg('jornada') || 11);
mkdirSync(salida, { recursive: true });
const I = (f) => import(`../lib/${f}`);
const LL = await I('laliga.mjs');
const { tarjetasDe } = await I('con-tarjetas.mjs');
const { tarjetaBajas, tarjetaApercibidos, tarjetasNovedades } = await I('datos-tarjetas.mjs');
const { corto } = await I('texto.mjs');

// imágenes con caché en disco
const cache = '/tmp/tarjetas-cache'; mkdirSync(cache, { recursive: true });
const imagen = async (url) => {
  if (!url) return null;
  const f = `${cache}/${createHash('md5').update(url).digest('hex')}.png`;
  if (existsSync(f)) return readFileSync(f);
  const b = await LL.imagen(url).catch(() => null);
  if (b) writeFileSync(f, b);
  return b;
};
const fuentes = { ficha: LL.ficha, valor: LL.valorMercado, imagen };

const [stats, jugadores] = await Promise.all([LL.statsSemana(jornada), LL.jugadores()]);
const equipos = {};
for (const m of stats) for (const l of [m.local, m.visitor]) equipos[String(l.id)] = { id: String(l.id), nombre: l.mainName, corto: corto(l.mainName), badge: l.badgeColor };
const J = (n) => jugadores.find((p) => p.nickname === n) || (() => { throw new Error(`no hay ${n}`); })();
const caraUrl = (p) => p.image || (p.images && p.images.transparent && p.images.transparent['256x256']);
const fila = (p, extra = {}) => { const e = equipos[String(p.teamId)] || { nombre: '', corto: '', badge: null };
  return { id: p.id, nombre: p.nickname, teamId: p.teamId, pos: Number(p.positionId), equipo: e.corto, club: e.nombre, estado: 'lesionado', pct: null, media: Number(p.averagePoints), caraUrl: caraUrl(p), escudoUrl: e.badge, valor: Number(p.marketValue), ...extra }; };

const hechas = [];
const guardar = (nombre, lista) => { for (const t of lista) { writeFileSync(`${salida}/${nombre}${lista.length > 1 ? '-' + (t.nombre || '') : ''}.png`, t.png || Buffer.alloc(0)); hechas.push([nombre, t.ok, t.errores]); if (!t.ok) { console.log('FALLA', nombre, t.errores.slice(0, 4)); writeFileSync(`${salida}/${nombre}.svg`, t.svg); } else console.log('ok   ', nombre); } };
const ctx = { stats, jugadores, jornada, config: { tarjetas: {} }, forzar: true, fuentes };
const dibuja = async (nombre, t) => guardar(nombre, await tarjetasDe(t, ctx));

// --- final (partido normal y uno con nombres largos)
const parts = stats.filter((m) => m.matchState === 7);
await dibuja('final-1', { tipo: 'final', partido: parts[0].id });
await dibuja('final-2', { tipo: 'final', partido: parts[3].id });
// --- jugador: leyenda, oro, plata, bronce y motivos
const mvpDe = (m) => [...m.local.players, ...m.visitor.players].sort((a, b) => b.weekPoints - a.weekPoints)[0].id;
const partidoDe = (p) => stats.find((m) => [m.local.id, m.visitor.id].map(String).includes(String(p.teamId)) && m.matchState === 7);
const casos = [['jugador-leyenda', 'Lamine Yamal', 'mvp'], ['jugador-oro', 'Grimaldo', 'doblete'], ['jugador-plata', 'Cabrera', 'gol'], ['jugador-bronce', 'Hinojo', 'roja']];
for (const [n, nom, motivo] of casos) { const p = J(nom), m = partidoDe(p); if (!m) { console.log('sin partido', nom); continue; } await dibuja(n, { tipo: 'mvp', partido: m.id, jugadorId: p.id, motivo }); }
// el portero que para un penalti (#77): el portero con más puntos de la jornada
{ const por = stats.filter((m) => m.matchState === 7).flatMap((m) => [...m.local.players, ...m.visitor.players].map((p) => ({ p, m })))
    .map(({ p, m }) => ({ m, pl: jugadores.find((x) => String(x.id) === String(p.id)), pts: p.weekPoints })).filter((x) => x.pl && x.pl.positionId === '1').sort((a, b) => b.pts - a.pts)[0];
  if (por) await dibuja('jugador-parada', { tipo: 'mvp', partido: por.m.id, jugadorId: por.pl.id, motivo: 'parada' }); }
// --- resumen
const ordenados = [...stats.flatMap((m) => [...m.local.players, ...m.visitor.players])].filter((p) => p.weekPoints != null).sort((a, b) => b.weekPoints - a.weekPoints);
const filasRes = (lista) => lista.map((p) => { const pl = jugadores.find((x) => String(x.id) === String(p.id)); const e = equipos[String(pl.teamId)];
  return { id: p.id, nombre: p.nickname || p.name, equipo: e.corto, club: e.nombre, pts: Number(p.weekPoints), media: Number(pl.averagePoints), valor: Number(pl.marketValue), caraUrl: caraUrl(pl), escudoUrl: e.badge }; });
const top = filasRes(ordenados.slice(0, 6)), bajos = filasRes(ordenados.filter((p) => { const pl = jugadores.find((x) => String(x.id) === String(p.id)); return pl && pl.positionId !== '1'; }).slice(-6).reverse());
const resumen = (clave, filas) => ({ tipo: 'resumen', nombre: `resumen-${jornada}-${clave}`, d: { jornada, clave, filas }, permitidos: { numeros: [jornada, 1, 2, 3, 4, 5, 6, ...filas.map((f) => f.pts)].map(String), palabras: filas.flatMap((f) => [f.nombre, f.equipo, f.club]) } });
await dibuja('resumen-mejores', { tipo: 'resumen', tarjeta: resumen('mejores', top) });
await dibuja('resumen-peores', { tipo: 'resumen', tarjeta: resumen('peores', bajos) });
// --- mercado
const fmt = (x) => String(x).replace('.', ',');
const mfila = (nom, dif, pct) => { const p = J(nom), e = equipos[String(p.teamId)]; const v = Number(p.marketValue);
  const d = Math.abs(dif); const din = d >= 1e6 ? `${fmt(Math.round(d / 1e5) / 10)} M` : `${Math.round(d / 1e3)} K`;
  return { nombre: p.nickname, equipo: e.corto, club: e.nombre, caraUrl: caraUrl(p), escudoUrl: e.badge, dif: `${dif > 0 ? '+' : '-'}${din}`, pct: `${dif > 0 ? '+' : '-'}${fmt(pct)} %`, valor: `${fmt(Math.round(v / 1e5) / 10)} M` }; };
const suben = [['Lamine Yamal', 4.2e6, 2.3], ['Mbappé', 3.1e6, 2.1], ['Fermín', 2.4e6, 3.4], ['Cabrera', 1.1e6, 5.2], ['Grimaldo', 0.8e6, 2.4]].map((a) => mfila(...a));
const bajan = [['Bellingham', -2.9e6, 2.8], ['De Frutos', -1.6e6, 2.6], ['Vini Jr.', -1.2e6, 1.1], ['Budimir', -0.9e6, 3.0], ['Roberto', -0.6e6, 4.4]].map((a) => mfila(...a));
const todasM = [...suben, ...bajan];
await dibuja('mercado', { tipo: 'mercado', tarjeta: { tipo: 'mercado', nombre: 'mercado-x', d: { fecha: '6 de noviembre', suben, bajan },
  permitidos: { numeros: [6, 1, 2, 3, 4, 5, ...todasM.flatMap((f) => [f.dif, f.pct, f.valor])].map(String), palabras: ['MERCADO', 'SUBEN', 'BAJAN', 'Y', 'de', 'M', 'K', 'noviembre', ...todasM.flatMap((f) => [f.nombre, f.equipo])] } } });
// --- onces (posibles y confirmados)
const once = (idEq, formacion, conAlt) => {
  const ps = jugadores.filter((p) => String(p.teamId) === String(idEq) && p.playerStatus !== 'out_of_league').sort((a, b) => Number(b.averagePoints) - Number(a.averagePoints));
  const f = formacion.split('-').map(Number), cupo = { 1: 1, 2: f[0], 3: f[1], 4: f[2] };
  const out = [];
  for (const pos of [1, 2, 3, 4]) ps.filter((p) => Number(p.positionId) === pos).slice(0, cupo[pos]).forEach((p, i) => out.push({ id: p.id, nombre: p.nickname, pos: LL.POS[pos], pct: Math.max(8, 97 - i * 11 - pos * 4 - (out.length % 3) * 6), duda: out.length === 4 }));
  if (conAlt) { const alt = ps.filter((p) => Number(p.positionId) === 3).slice(cupo[3], cupo[3] + 1)[0]; if (alt) { const m = out.find((o) => o.pos === 'MED'); m.pct = 52; m.alt = { id: alt.id, nombre: alt.nickname, pct: 38 }; } }
  return out;
};
const m0 = parts[1], L = m0.local, V = m0.visitor;
const mkOnces = (conf) => { const lL = once(L.id, '4-3-3', !conf), lV = once(V.id, '4-4-2'.replace('4-4-2', '4-3-3'), false);
  const lado = (e, o, fm) => ({ nombre: e.mainName, corto: corto(e.mainName), escudoUrl: e.badgeColor, formacion: fm, once: o });
  const d = { jornada, confirmados: conf, local: lado(L, lL, '4-3-3'), visitante: lado(V, lV, '4-3-3') };
  const todos = [...d.local.once, ...d.visitante.once];
  return { tipo: 'onces', nombre: `onces-${conf}`, d, permitidos: { numeros: [jornada, 4, 3, 3, ...todos.flatMap((x) => [x.pct, x.alt ? x.alt.pct : null]).filter((x) => x != null)].map(String),
    palabras: [d.local.corto, d.visitante.corto, L.mainName, V.mainName, ...todos.flatMap((x) => [x.nombre, x.alt ? x.alt.nombre : null]).filter(Boolean)] } }; };
await dibuja('onces-posibles', { tipo: 'previa', tarjeta: mkOnces(false) });
await dibuja('onces-confirmados', { tipo: 'onces', tarjeta: mkOnces(true) });
// --- bajas y novedades
const pp = (rival) => { const e = Object.values(equipos).find((x) => x.corto === rival); return { jornada: jornada + 1, rival: e.corto, rivalNombre: e.nombre, rivalEscudo: e.badge }; };
const caso = (nombre, filas, opts = {}) => ({ nombre, t: tarjetaBajas({ jornada: jornada + 1, filas, pp: opts.pp || null, clave: nombre }) });
const baj = [
  caso('baja-uno-lesion', [fila(J('Lemar'), { estado: 'lesionado' })], { pp: pp('Real Madrid') }),
  caso('baja-uno-duda', [fila(J('Natan'), { estado: 'duda', pct: 34 })], { pp: pp('Valencia') }),
  caso('baja-uno-sancion', [fila(J('Vini Jr.'), { estado: 'sancionado' })], { pp: pp('Valencia') }),
  caso('baja-uno-vuelve', [fila(J('Valverde'), { estado: 'disponible', pct: 78 })], { pp: pp('Elche') }),
  caso('baja-equipo-3', ['Lemar', 'M. Aguado', 'Pedro Bigas'].map((n, i) => { try { return fila(J(n), { estado: ['lesionado', 'sancionado', 'duda'][i], pct: i === 2 ? 40 : null }); } catch { return null; } }).filter(Boolean), { pp: pp('Real Madrid') }),
  caso('baja-lista-6', ['Lemar', 'Vini Jr.', 'Natan', 'Budimir', 'Roberto', 'Cardona'].map((n, i) => fila(J(n), { estado: ['lesionado', 'sancionado', 'duda', 'lesionado', 'duda', 'sancionado'][i], pct: [null, null, 40, null, 62, null][i] }))),
  caso('baja-novedades', ['Valverde', 'Mbappé', 'Bellingham'].map((n) => fila(J(n), { estado: 'vuelve', pct: 70 }))),
  caso('baja-dudas', ['Natan', 'Roberto', 'Budimir', 'Cardona'].map((n, i) => fila(J(n), { estado: 'duda', pct: [34, 55, 62, 28][i] }))),
];
for (const b of baj) await dibuja(b.nombre, { tipo: 'caidas', tarjeta: b.t });
// --- apercibidos
const ap = (nombres) => tarjetaApercibidos({ jornada: jornada + 1, filas: nombres.map((n) => fila(J(n), { estado: 'duda' })), clave: `ap-${nombres.length}` });
await dibuja('apercibidos-2', { tipo: 'sancionados', tarjeta: ap(['Cabrera', 'Roberto', 'Bauza', 'Cardona']) });
await dibuja('apercibidos-8', { tipo: 'sancionados', tarjeta: ap(['Cabrera', 'Roberto', 'Bauza', 'Cardona', 'Grimaldo', 'Bellingham', 'De Frutos', 'Fermín']) });

// --- once ideal (3-4-3, con apuesta y chollo; los puntos esperados, inventados)
{ const noms = ['Unai Simón', 'Cubarsí', 'Marcos Llorente', 'Grimaldo', 'Pedri', 'Fermín', 'Valverde', 'Cabrera', 'Lamine Yamal', 'Mbappé', 'Budimir'];
  const posDe = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
  const once = noms.map((n, i) => { let p; try { p = J(n); } catch { return null; } const e = equipos[String(p.teamId)] || {};
    return { id: p.id, pos: posDe[Number(p.positionId)], nombre: p.nickname, equipo: e.corto, club: e.nombre, pts: fmt(Math.round((8.9 - i * 0.3) * 10) / 10), rol: i === 9 ? 'apuesta' : i === 7 ? 'chollo' : null, caraUrl: caraUrl(p), escudoUrl: e.badge }; }).filter(Boolean)
    .sort((a, b) => ['POR', 'DEF', 'MED', 'DEL'].indexOf(a.pos) - ['POR', 'DEF', 'MED', 'DEL'].indexOf(b.pos));
  const c = { 2: 0, 3: 0, 4: 0 }; for (const x of once) if (x.pos !== 'POR') c[{ DEF: 2, MED: 3, DEL: 4 }[x.pos]]++;
  const form = `${c[2]}-${c[3]}-${c[4]}`;
  if (once.length === 11) await dibuja('onceideal', { tipo: 'onceideal', tarjeta: { tipo: 'onceideal', nombre: 'onceideal-x', d: { jornada: jornada + 1, formacion: form, valor: '612 M', apuesta: true, chollo: true, once },
    permitidos: { numeros: [jornada + 1, c[2], c[3], c[4], ...once.map((x) => x.pts), '612 M'].map(String), palabras: ['ONCE', 'IDEAL', 'FORMACIÓN', 'PUNTOS', 'ESPERADOS', 'APUESTA', 'CHOLLO', 'VALOR', 'M', ...once.map((x) => x.nombre)] } } });
  else console.log('once ideal: faltan jugadores', once.length); }

// ---------------- estrés: los nombres más largos de la liga
if (arg('estres') === '1') {
  const largos = [...jugadores].filter((p) => p.playerStatus !== 'out_of_league').sort((a, b) => b.nickname.length - a.nickname.length).slice(0, 12);
  console.log('largos:', largos.map((p) => p.nickname).join(' | '));
  const eq = (p) => equipos[String(p.teamId)] || { nombre: '', corto: '?', badge: null };
  const resumenL = largos.slice(0, 6).map((p, i) => ({ id: p.id, nombre: p.nickname, equipo: eq(p).corto, club: eq(p).nombre, pts: 19 - i, media: 5, valor: 1e7, caraUrl: caraUrl(p), escudoUrl: eq(p).badge }));
  await dibuja('x-resumen', { tipo: 'resumen', tarjeta: resumen('mejores', resumenL) });
  const mL = largos.slice(0, 10).map((p, i) => mfila(p.nickname, (i < 5 ? 1 : -1) * (4.2e6 - i * 1e5), 4.2));
  await dibuja('x-mercado', { tipo: 'mercado', tarjeta: { tipo: 'mercado', nombre: 'mercado-y', d: { fecha: '30 de septiembre', suben: mL.slice(0, 5), bajan: mL.slice(5) },
    permitidos: { numeros: [30, 1, 2, 3, 4, 5, ...mL.flatMap((f) => [f.dif, f.pct, f.valor])].map(String), palabras: ['MERCADO', 'SUBEN', 'BAJAN', 'Y', 'de', 'M', 'K', 'septiembre', ...mL.flatMap((f) => [f.nombre, f.equipo])] } } });
  const bL = tarjetaBajas({ jornada: jornada + 1, filas: largos.slice(0, 6).map((p, i) => fila(p, { estado: ['duda', 'lesionado', 'sancionado', 'duda', 'lesionado', 'duda'][i], pct: [45, null, null, 61, null, 38][i] })), clave: 'x-baja' });
  await dibuja('x-bajas', { tipo: 'caidas', tarjeta: bL });
  const bD = tarjetaBajas({ jornada: jornada + 1, filas: largos.slice(0, 6).map((p, i) => fila(p, { estado: 'duda', pct: [45, 22, 61, 38, 50, 77][i] })), clave: 'x-dudas' });
  await dibuja('x-dudas', { tipo: 'caidas', tarjeta: bD });
  const cuatro = Object.values(equipos).slice(0, 4);
  await dibuja('x-apercibidos', { tipo: 'sancionados', tarjeta: tarjetaApercibidos({ jornada: jornada + 1, filas: largos.slice(0, 8).map((p, i) => { const e = cuatro[i % 4]; return { ...fila(p), teamId: e.id, equipo: e.corto, club: e.nombre, escudoUrl: e.badge }; }), clave: 'x-ap' }) });
  await dibuja('x-apercibidos-pocos', { tipo: 'sancionados', tarjeta: tarjetaApercibidos({ jornada: jornada + 1, filas: largos.slice(0, 3).map((p) => fila(p)), clave: 'x-ap3' }) });
  const equipoLargo = largos.filter((p) => p.teamId === largos[0].teamId).length > 1 ? largos.filter((p) => p.teamId === largos[0].teamId) : [largos[0]];
  console.log('equipo largo', equipoLargo.map((p) => p.nickname));
}

const malas = hechas.filter(([, ok]) => !ok);
console.log(`\n${hechas.length} tarjetas, ${malas.length} sin pasar el validador`);
process.exit(malas.length ? 1 : 0);
