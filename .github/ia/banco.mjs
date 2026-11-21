// El banco de pruebas de la IA (plan del día y chat). Sirve web/, abre la liga de ejemplo con Chromium a una hora fija
// (así el prompt y las cuentas salen iguales cada vez) y pone un Google de mentira delante: lo que la app le manda a la
// IA se captura tal cual y lo que «contesta» la IA lo decide la prueba (una respuesta escrita a mano o una de verdad,
// guardada). Todo pasa por el código real de la app: planDelDia + cuadrarPlan y charlar con su revisión.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pw = await import(process.env.PW_MODULO || 'playwright').catch(() => import('playwright-core'));
export const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'web');
export const MODELO_FALSO = 'gemini-3.5-flash';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

/* Los escenarios: la liga de ejemplo en distintos momentos. La jornada 10 de la demo empieza siempre «el próximo sábado
   a las 14:00», así que con la hora fija (martes 3 nov 2026) cae el sábado 7. */
// (para las escenas: la serie de valores de un jugador, `sube` días subiendo un 1 % y `baja` días bajando un 1,5 %, que
// acaba en su valor de hoy)
/* (19 nov, sesión larga) el mercado de verdad de un día: los jugadores de LaLiga Fantasy del 19 nov como los dio la API
   esa noche (mercado-real-19nov.json, de web/jugadores/todos.json que deja la Action «Portal web»). Los de la liga de
   ejemplo pasan a valer lo que valían ese día, con su media y lo que se movieron (el último día y la semana), y los
   libres del mercado son los que más se movieron ese día y no son de nadie en la liga */
const REAL = JSON.parse(readFileSync(new URL('./mercado-real-19nov.json', import.meta.url), 'utf8')).jugadores;
const MERCADO_REAL = `const R = ${JSON.stringify(REAL)};
  const nn = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const CLUB = { barca: 'barcelona', atleticodemadrid: 'atletico', realbetis: 'betis', rayovallecano: 'rayo' };
  const eqId = Object.fromEntries(Object.entries(S.D.equipos).map(([id, e]) => [nn(e.nombre), id]));
  const clubDe = (c) => eqId[CLUB[nn(c)] || nn(c)];
  const real = new Map(R.map((x) => [nn(x.n), x]));
  const dia = (k) => new Date(Date.now() - k * 864e5 + 3600e3).toISOString().slice(0, 10);
  // (la serie de los 8 últimos días: lo de la semana repartido y, el último, lo que se movió ese día)
  const serie = (x) => { const s = []; for (let k = 8; k >= 1; k--) { const f = k === 1 ? x.v - x.d1 : x.v - x.d1 - (x.d2 - x.d1) * (k - 1) / 6; s.push([dia(k), Math.max(150000, Math.round(f))]); } return s; };
  S.H.v = S.H.v || {};
  for (const j of Object.values(S.D.maestro)) {
    const x = real.get(nn(j.nombre));
    if (!x || j.pos === 5) continue;
    j.valor = x.v; j.media = Math.round(x.m * 10) / 10;
    S.H.v[j.id] = serie(x);
    if (S.det && S.det[j.id]) delete S.det[j.id].valores;
  }
  const deAlguien = new Set(Object.values(S.D.plantillas).flat().map((f) => nn((S.D.maestro[f.pid] || {}).nombre)));
  const cierra = (S.D.mercado.find((m) => m.tipo === 'liga') || {}).cierra;
  S.D.mercado = S.D.mercado.filter((m) => m.tipo !== 'liga');
  const libres = R.filter((x) => !deAlguien.has(nn(x.n)) && clubDe(x.c) && x.v >= 300000).sort((a, b) => Math.abs(b.d1) - Math.abs(a.d1)).slice(0, 14);
  libres.forEach((x, i) => {
    let j = Object.values(S.D.maestro).find((y) => nn(y.nombre) === nn(x.n));
    if (!j) {
      const id = String(9000 + i), eq = clubDe(x.c), semanas = Array.from({ length: 9 }, (_, w) => ({ n: w + 1, pts: Math.round(x.m) }));
      j = { id, nombre: x.n, largo: x.n, equipoId: eq, equipo: S.D.equipos[eq].nombre, pos: x.p, valor: x.v, puntos: semanas.reduce((t, w) => t + w.pts, 0), media: Math.round(x.m * 10) / 10, estado: 'ok', img: null, lid: '', temporadaPasada: Math.round(x.m * 34), semanas };
      S.D.maestro[id] = j;
    }
    S.H.v[j.id] = serie(x);
    S.D.mercado.push({ id: 'mr' + i, pid: j.id, tipo: 'liga', precio: x.v, cierra, pujas: i % 3, ofertas: 0, vendedorTeamId: '', vendedor: '', miPuja: null, clausula: null });
  });`;
const SERIE = `const serie = (nombre, sube, baja) => { const j = Object.values(S.D.maestro).find((x) => x.nombre === nombre); const s = [];
  for (let k = sube + baja; k >= 1; k--) { const v = k <= baja ? j.valor * Math.pow(1.015, k) : j.valor * Math.pow(1.015, baja) / Math.pow(1.01, k - baja); s.push([new Date(Date.now() - k * 864e5 + 3600e3).toISOString().slice(0, 10), Math.round(v)]); }
  S.H.v = S.H.v || {}; S.H.v[j.id] = s; if (S.det && S.det[j.id]) delete S.det[j.id].valores; };`;
export const ESCENAS = {
  // martes por la mañana, jornada el sábado: lo normal entre semana
  martes: { hora: '2026-11-03T10:00:00+01:00' },
  // viernes por la tarde: cláusulas cerradas (las 24 h de antes del primer partido)
  veda: { hora: '2026-11-06T16:00:00+01:00' },
  // sábado por la tarde: la jornada en juego, el once cerrado
  enjuego: { hora: '2026-11-07T16:00:00+01:00' },
  // (19 nov) sábado por la mañana, día del primer partido (14:00): cláusulas cerradas, el once aún se toca y el último
  // cambio de mercado de antes de la jornada ya ha pasado (00:15)
  sabado: { hora: '2026-11-07T10:30:00+01:00' },
  // (19 nov, escenas nuevas del plan) el sábado del partido por la mañana, en una liga con el mercado a las 12:00: queda el
  // cambio del mismo día del primer partido (14:00), con dos horas de margen
  'sabado-justo': { hora: '2026-11-07T09:00:00+01:00', prep: `const t = Date.parse('2026-11-07T12:00:00+01:00');
    for (const m of S.D.mercado) m.cierra = t; for (const v of S.D.misVentas || []) { v.cierra = t; for (const o of v.ofertas || []) o.caduca = t; }` },
  // martes, en una liga con el mercado a las 20:00 (como la de Carlos)
  'hora-20': { hora: '2026-11-03T10:00:00+01:00', prep: `const t = Date.parse('2026-11-03T20:00:00+01:00');
    for (const m of S.D.mercado) m.cierra = t; for (const v of S.D.misVentas || []) { v.cierra = t; for (const o of v.ofertas || []) o.caduca = t; }` },
  // jueves al mediodía en negativo: solo queda un cambio de mercado (vie 00:15) para llegar en positivo
  'jueves-negativo': { hora: '2026-11-05T12:00:00+01:00', prep: 'S.D.dinero = -8000000;' },
  // los dos últimos días del parón: la vuelta (jornada 10) el jueves a las 14:00, a dos días y cuatro horas
  'paron-final': { hora: '2026-11-03T10:00:00+01:00', demo: (s) => s.replace('9: base - 7 * DIA, 10: base,', '9: base - 16 * DIA, 10: base - 2 * DIA,') },
  // (19 nov) diez minutos después del cierre de cláusulas (vie 14:00): para el plan pedido justo antes y recogido después
  'veda-recien': { hora: '2026-11-06T14:10:00+01:00' },
  // parón de selecciones con la vuelta a más de 3 días
  paron: { hora: '2026-11-03T10:00:00+01:00', demo: (s) => s.replace('9: base - 7 * DIA, 10: base,', '9: base - 9 * DIA, 10: base + 7 * DIA,') },
  // (19 nov, sesión larga) martes con los valores y el mercado de verdad del 19 nov (MERCADO_REAL)
  'mercado-real': { hora: '2026-11-03T10:00:00+01:00', prep: MERCADO_REAL },
  // en negativo entre semana (ha tirado de deuda)
  negativo: { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = -4200000;' },
  // (19 nov, el trueque de Carlos con Domy) martes con 58,10 M; Fornals (58,95 M) es mío y Huijsen (57,42 M), del 2º, con
  // la cláusula a su valor abriéndose hoy a las 20:00: él me compra a Fornals a su valor y yo le compro a Huijsen por 60 M
  'trato-domy': { hora: '2026-11-03T10:00:00+01:00', prep: `S.D.dinero = 58100000;
    const pid = (n) => Object.values(S.D.maestro).find((x) => x.nombre === n).id, fo = pid('Fornals'), hu = pid('Huijsen');
    const r2 = S.D.clasif.find((e) => e.pos === 2).teamId, yo = S.D.yo.teamId;
    for (const t of Object.keys(S.D.plantillas)) S.D.plantillas[t] = S.D.plantillas[t].filter((f) => f.pid !== fo && f.pid !== hu);
    S.D.mercado = S.D.mercado.filter((m) => m.pid !== fo && m.pid !== hu);
    // (su histórico de valores, a la misma escala: si no, «sube 4,7 M al día»)
    for (const [id, v] of [[fo, 58950000], [hu, 57420000]]) { const k = v / S.D.maestro[id].valor; S.D.maestro[id].valor = v;
      if (S.H.v && S.H.v[id]) S.H.v[id] = S.H.v[id].map((x) => [x[0], Math.round(x[1] * k)]); if (S.det && S.det[id]) delete S.det[id].valores; }
    S.D.dineros = { ...(S.D.dineros || {}), [r2]: { v: 64300000, fuente: 'LaLiga' } };
    S.D.plantillas[yo].push({ pid: fo, ptId: 'pt' + fo, clausula: 66000000, protegidoHasta: Date.now() + 3 * 864e5, compra: 52000000 });
    S.D.plantillas[r2].push({ pid: hu, ptId: 'pt' + hu, clausula: 57420000, protegidoHasta: Date.parse('2026-11-03T20:00:00+01:00') });` },
  // con dinero de sobra (60 M): vender no hace falta ni contando las pujas que ya tiene puestas
  holgado: { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = 60000000;' },

  /* --- las del motor del plan (casos «motor», sin IA). En esos casos el motor se rehace siempre como en la app (con las
     fichas, los onces probables y lo que diga `extra`), para que el once salga igual en todas las escenas --- */
  // martes, sin la puja de 36,3 M que la liga de ejemplo trae puesta: el saldo es lo que hay
  'm-limpio': { hora: '2026-11-03T10:00:00+01:00', prep: 'for (const m of S.D.mercado) m.miPuja = null;' },
  'm-negativo': { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = -4200000;' },
  'm-holgado': { hora: '2026-11-03T10:00:00+01:00', prep: 'S.D.dinero = 60000000;' },
  // viernes, con las cláusulas cerradas y sin pujas puestas
  'm-cierre': { hora: '2026-11-06T16:00:00+01:00', prep: 'for (const m of S.D.mercado) m.miPuja = null;' },
  // en negativo y con las cláusulas ya cerradas: no queda ningún cambio de mercado que valga antes de la jornada
  'm-cierre-negativo': { hora: '2026-11-06T16:00:00+01:00', prep: 'S.D.dinero = -4200000;' },
  // la plantilla llena (25) y sin pujas puestas
  'm-25': { hora: '2026-11-03T10:00:00+01:00', prep: `for (const m of S.D.mercado) m.miPuja = null;
    const con = new Set(Object.values(S.D.plantillas).flat().map((f) => f.pid)), enM = new Set(S.D.mercado.map((m) => m.pid));
    const libres = Object.values(S.D.maestro).filter((j) => !con.has(j.id) && !enM.has(j.id) && j.pos !== 5).sort((a, b) => a.valor - b.valor).slice(0, 10);
    for (const j of libres) S.D.plantillas[S.D.yo.teamId].push({ pid: j.id, ptId: 'pt' + j.id, clausula: Math.round(j.valor * 1.6), protegidoHasta: Date.now() + 10 * 864e5, compra: j.valor });` },
  // sin porteros (un hueco en el once) y con dinero para taparlo
  'm-hueco': { hora: '2026-11-03T10:00:00+01:00', prep: `S.D.dinero = 80000000;
    S.D.plantillas[S.D.yo.teamId] = S.D.plantillas[S.D.yo.teamId].filter((f) => S.D.maestro[f.pid].pos !== 1);` },
  // un titular mío (Ionut Radu) con la cláusula abierta y casi a su valor: le llega a varios rivales
  'm-clausula-mia': { hora: '2026-11-03T10:00:00+01:00', prep: `const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === 'Ionut Radu');
    f.clausula = Math.round(S.D.maestro[f.pid].valor * 1.03); f.protegidoHasta = null;` },
  // martes, con una noticia de prensa de Fran García (uno que el motor manda vender): la IA puede quitarlo por ella
  'm-noticia': { hora: '2026-11-03T10:00:00+01:00', prep: '', extra: `const j = Object.values(S.D.maestro).find((x) => x.nombre === 'Fran García'); return { noticias: { lista: [{ titulo: 'Fran García será titular el sábado: el técnico lo confirma en rueda de prensa tras la lesión de su compañero', fuente: 'Marca', t: Date.now() - 3 * 36e5, pids: [j.id], equipos: [] }] } };` },
  /* --- segunda vuelta del motor (Carlos, 14 nov). `serie(nombre, sube, baja)`: su valor de las últimas semanas, subiendo
     hasta hace `baja` días y bajando un 1,5 % al día desde entonces (y sin el histórico de LaLiga, que manda) --- */
  // martes: Catena (titular, sin otro defensa que puntúe como él) baja todos los días
  'm-baja-sin-relevo': { hora: '2026-11-03T10:00:00+01:00', prep: 'for (const m of S.D.mercado) m.miPuja = null;', extra: `${SERIE} serie('Catena', 40, 5); return {};` },
  // martes: Julián Álvarez (titular con relevo: sin él, el once pierde poco) baja todos los días
  'm-baja-con-relevo': { hora: '2026-11-03T10:00:00+01:00', prep: 'for (const m of S.D.mercado) m.miPuja = null;', extra: `${SERIE} serie('Julián Álvarez', 40, 5); return {};` },
  // jueves, con 60 M y Jon Martin comprado para revender, que sigue subiendo y tiene 12 días de protección: se aguanta
  'm-reventa-aguanta': { hora: '2026-11-05T12:00:00+01:00', prep: `S.D.dinero = 60000000; for (const m of S.D.mercado) m.miPuja = null;
    const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === 'Jon Martin'); f.protegidoHasta = Date.now() + 12 * 864e5;`,
    extra: `${SERIE} serie('Jon Martin', 40, 0); const j = Object.values(S.D.maestro).find((x) => x.nombre === 'Jon Martin'); return { reventa: { [j.id]: { t: Date.now() - 2 * 864e5, precio: Math.round(j.valor * 0.95) } } };` },
  // (19 nov, Mario Soriano) comprado para revender a un 11,5 % más de lo que vale (pierde), con la cláusula cerrada 12 días y
  // subiendo cada vez menos (se frena, pero aún sube) y 58,10 M de saldo: no se vende
  'm-reventa-perdiendo': { hora: '2026-11-06T09:00:00+01:00', prep: `S.D.dinero = 58100000; for (const m of S.D.mercado) m.miPuja = null;
    const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === 'Jon Martin'); f.protegidoHasta = Date.now() + 12 * 864e5 + 7 * 3600e3;`,
    extra: `const j = Object.values(S.D.maestro).find((x) => x.nombre === 'Jon Martin'); const s = []; let v = j.valor;
      for (let k = 1; k <= 30; k++) { v = v / (1 + (k <= 7 ? 0.009 + 0.003 * (k - 1) : 0.03)); s.unshift([new Date(Date.now() - k * 864e5 + 3600e3).toISOString().slice(0, 10), Math.round(v)]); }
      S.H.v = S.H.v || {}; S.H.v[j.id] = s; if (S.det && S.det[j.id]) delete S.det[j.id].valores;
      return { reventa: { [j.id]: { t: Date.now() - 2 * 864e5, precio: Math.round(j.valor * 1.115) } } };` },
  // lo mismo, pero se le acaba la protección mañana: toca venderlo
  'm-reventa-protege': { hora: '2026-11-05T12:00:00+01:00', prep: `S.D.dinero = 60000000; for (const m of S.D.mercado) m.miPuja = null;
    const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === 'Jon Martin'); f.protegidoHasta = Date.now() + 20 * 3600e3;`,
    extra: `${SERIE} serie('Jon Martin', 40, 0); const j = Object.values(S.D.maestro).find((x) => x.nombre === 'Jon Martin'); return { reventa: { [j.id]: { t: Date.now() - 12 * 864e5, precio: Math.round(j.valor * 0.95) } } };` },
  // 24 jugadores, con dinero y la puja de 36,3 M que trae la liga de ejemplo: una puja más podría dejarte con 26
  'm-24-puja': { hora: '2026-11-03T10:00:00+01:00', prep: `S.D.dinero = 60000000;
    const con = new Set(Object.values(S.D.plantillas).flat().map((f) => f.pid)), enM = new Set(S.D.mercado.map((m) => m.pid));
    const libres = Object.values(S.D.maestro).filter((j) => !con.has(j.id) && !enM.has(j.id) && j.pos !== 5).sort((a, b) => a.valor - b.valor).slice(0, 9);
    for (const j of libres) S.D.plantillas[S.D.yo.teamId].push({ pid: j.id, ptId: 'pt' + j.id, clausula: Math.round(j.valor * 1.6), protegidoHasta: Date.now() + 10 * 864e5, compra: j.valor });` },
  // martes, con 30 M y Álex Baena en venta subiendo un 1 % al día: una oferta un 3 % por encima de su valor la gana solo
  // en 3 días, no se acepta (Fornals, Carlos 17 nov); una un 12 % por encima, sí
  ...Object.fromEntries([['m-oferta-sube', 1.03], ['m-oferta-sube-alta', 1.12]].map(([k, f]) => [k, { hora: '2026-11-03T10:00:00+01:00', prep: `S.D.dinero = 30000000; for (const m of S.D.mercado) m.miPuja = null;
    const v = S.D.misVentas.find((x) => S.D.maestro[x.pid].nombre === 'Álex Baena'); v.ofertas = [{ ...v.ofertas[0], importe: Math.round(S.D.maestro[v.pid].valor * ${f}), deLiga: false }];`,
    extra: `${SERIE} serie('Álex Baena', 40, 0); return {};` }])),
  // jueves, un titular mío (Ionut Radu) con la cláusula a su valor y sin protección: la jornada empieza el sábado
  'm-blinda-arranque': { hora: '2026-11-05T12:00:00+01:00', prep: `const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === 'Ionut Radu');
    f.clausula = Math.round(S.D.maestro[f.pid].valor * 1.03); f.protegidoHasta = null;` },
  // martes, con 60 M y TRES comprados para revender que se aguantan (suben y les quedan 12 días de protección): uno más
  // del tope de «2 a la vez» de entre semana (se compraron en el parón, que deja 3, o por tu cuenta). El 15 nov, con eso,
  // no cuadraba ninguna combinación: el plan de la app salía con las cuentas a medias y el de la IA fallaba siempre
  'm-reventa-de-mas': { hora: '2026-11-03T10:00:00+01:00', prep: `S.D.dinero = 60000000; for (const m of S.D.mercado) m.miPuja = null;
    for (const n of ['Jon Martin', 'Catena', 'Ionut Radu']) { const f = S.D.plantillas[S.D.yo.teamId].find((x) => S.D.maestro[x.pid].nombre === n); f.protegidoHasta = Date.now() + 12 * 864e5; }`,
    extra: `${SERIE} const r = {}; for (const n of ['Jon Martin', 'Catena', 'Ionut Radu']) { serie(n, 40, 0); const j = Object.values(S.D.maestro).find((x) => x.nombre === n); r[j.id] = { t: Date.now() - 2 * 864e5, precio: Math.round(j.valor * 0.95) }; } return { reventa: r };` },
  // jueves, con uno comprado para revender (Jon Martin): toca ponerlo a la venta para el último cambio de mercado
  'm-reventa': { hora: '2026-11-05T12:00:00+01:00', prep: '', extra: `const j = Object.values(S.D.maestro).find((x) => x.nombre === 'Jon Martin'); return { reventa: { [j.id]: { t: Date.now() - 2 * 864e5, precio: Math.round(j.valor * 0.95) } } };` },
};

let nav = null, srv = null, BASE = null, demoDe = null;
async function arrancar() {
  if (nav) return;
  srv = http.createServer(async (q, r) => {
    let ruta = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (ruta.endsWith('/')) ruta += 'index.html';
    try {
      let b = await readFile(join(WEB, ruta));
      if (ruta.endsWith('demo.js') && demoDe) b = Buffer.from(demoDe(b.toString('utf8')));
      r.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
      r.end(b);
    } catch (e) { r.writeHead(404); r.end('no'); }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  BASE = `http://127.0.0.1:${srv.address().port}`;
  nav = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--disable-dev-shm-usage'] });
}
export async function cerrar() { if (nav) await nav.close(); if (srv) srv.close(); nav = null; srv = null; }

const sse = (j) => `data: ${JSON.stringify(j)}\n\n`;
const respuestaGoogle = (texto) => ({ candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } });

/**
 * una página con la liga de ejemplo en ese escenario. `contesta(cuerpo, url)` devuelve el texto que «dice» la IA (o el
 * JSON entero de Google); lo que la app le manda queda en `pedidos`.
 */
export async function pagina(escena, contesta = () => 'vale') {
  await arrancar();
  const E = ESCENAS[escena] || ESCENAS.martes;
  demoDe = E.demo || null;
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const pedidos = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route('**/*', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (u.hostname !== 'generativelanguage.googleapis.com') return r.abort('blockedbyclient');
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (/\/models(\?|$)/.test(u.pathname + u.search) && q.method() === 'GET') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ models: [{ name: `models/${MODELO_FALSO}`, supportedGenerationMethods: ['generateContent'] }] }) });
    let cuerpo = null;
    try { cuerpo = JSON.parse(q.postData() || 'null'); } catch (e) { cuerpo = null; }
    pedidos.push({ url: u.pathname, cuerpo });
    let c = await contesta(cuerpo, u.pathname);
    if (typeof c === 'string') c = respuestaGoogle(c);
    if (/streamGenerateContent/.test(u.pathname)) return r.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream', body: sse(c) });
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(c) });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.clock.install({ time: new Date(E.hora) });
  await page.addInitScript("localStorage.setItem('fm-tour', '1'); localStorage.setItem('fm-prueba', 'true'); localStorage.setItem('fm-tema-aviso', '1');");
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.S && window.S.D && window.S.M, null, { timeout: 30000 });
  // una clave de mentira (la llamada no sale de la máquina) y, si el escenario toca los datos, el motor otra vez
  await page.evaluate(async (prep) => {
    const P = await import('./js/puente.js');
    await P.guardar('gemini', 'AIzaPRUEBA-banco-de-la-IA-0000000000000');
    if (prep) {
      const S = window.S;
      // eslint-disable-next-line no-new-func
      new Function('S', prep)(S);
      const Mo = await import('./js/motor.js');
      S.M = Mo.analizar(S.D, S.H, S.c, {});
    }
  }, E.prep || null);
  return { page, pedidos, errores, cerrar: () => ctx.close() };
}

const conCuerda = (page, promesa) => promesa;

/** pregunta en el chat como lo hace la app; devuelve lo que acaba viendo el mánager y lo que se apuntó */
export async function chat(escena, pregunta, contesta, { hist = [], notas = [] } = {}) {
  const P = await pagina(escena, contesta);
  try {
    const r = await conCuerda(P.page, P.page.evaluate(async ({ pregunta, hist, notas }) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
      const { D, M } = window.S;
      if (hist.length) U.LS.set(Dt.K('chat'), hist.map((m, i) => ({ r: i % 2 ? 'ia' : 'yo', t: m, ts: Date.now() - (hist.length - i) * 60000 })));
      if (notas.length) { U.LS.set(Dt.K('notas'), notas.map((n, i) => ({ id: `n${i}`, t: Date.now() - 3600e3, tipo: 'otro', ...n, pid: n.jugador ? I.pidDe(n.jugador, D) : null }))); U.LS.set(Dt.K('notas-t'), Date.now()); }
      try {
        const x = await I.charlar(pregunta, D, M, Dt.cfg(), null, null, []);
        return { texto: x.texto, apuntadas: x.apuntadas || [], vista: [x.texto, ...(x.apuntadas || []).map((n) => `NOTA: ${n.tipo || ''} · ${n.texto}${n.importe ? ` · ${U.eur(n.importe)}` : ''}`)].join('\n') };
      } catch (e) { return { error: e.message }; }
    }, { pregunta, hist, notas }));
    return { ...r, pedidos: P.pedidos, errores: P.errores };
  } finally { await P.cerrar(); }
}

/**
 * pide el plan como lo hace la app y lo pasa por cuadrarPlan; devuelve la «vista»: lo que acaba viendo el mánager.
 * `largo`: un plan escrito por la IA con el contrato de antes (la IA escribe las operaciones), como los planes guardados
 * de antes: lo que «contesta» va tal cual a cuadrarPlan (desde el 17 nov la app ya no lo pide: se quitó planLargo; lo que
 * se prueba es que cuadrarPlan lo para). Sin él, el
 * corto: el plan lo hace el motor y la IA lo ordena, lo recorta y lo explica. En el corto se ve además
 *   FRASE <jugador>: la explicación de cada paso (la de la IA, o la de la app si la de la IA no vale)
 *   CAMBIOS: lo que la IA quitó o metió y lo que la app no le dejó
 *   MIRADO <jugador>: lo mirado y descartado, con su porqué
 */
export async function plan(escena, contesta, { largo = false } = {}) {
  const P = await pagina(escena, contesta);
  const escrito = largo ? String(await contesta(null, '')) : null;
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const r = await conCuerda(P.page, P.page.evaluate(async ({ largo, extra, escrito, modelo }) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Dt = await import('./js/datos.js');
      const S = window.S;
      if (!largo) {
        // como en los casos del motor: el motor montado como en la app, para que el plan salga igual cada vez
        const Mo = await import('./js/motor.js');
        for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
        const f = S.fuentes || {};
        // eslint-disable-next-line no-new-func
        S.M = Mo.analizar(S.D, S.H, S.c, { det: S.det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, ...(extra ? new Function('S', extra)(S) : {}) });
      }
      const { D, M } = S;
      let Pl;
      if (largo) {
        let json = null;
        try { json = JSON.parse(String(escrito).replace(/^[\s\S]*?```(?:json)?\s*|```[\s\S]*$/g, '')); } catch (e) { return { error: `el plan escrito no es JSON: ${e.message}` }; }
        Pl = { ...json, fuentes: [], modelo, web: false, t: Date.now(), dia: U.diaDe(), mercado: M.cierreMercado || null };
      } else { try { Pl = await I.planDelDia(D, M, Dt.cfg(), {}); } catch (e) { return { error: e.message }; } }
      const r = I.cuadrarPlan(Pl, D, M);
      const L = [`TITULAR: ${r.titular || Pl.titular || ''}`, `SITUACION: ${r.situacion || Pl.situacion || ''}`];
      const linea = (o) => `${o.etiqueta || o.accion} ${(o.j && o.j.nombre) || o.jugador || ''}${o.importe ? ` ${U.eur(o.importe)}` : ''}${o.cuando ? ` (${o.cuando})` : ''}${o.aviso ? ` | ${o.aviso}` : ''}`;
      for (const o of r.ops || []) L.push(`${o.descartada ? 'DESCARTADA' : o.sugerencia ? 'SUGERENCIA' : o.ya ? 'HECHA' : 'OP'}: ${linea(o)}`);
      const al = r.alineacion || null;
      if (al) L.push(`ONCE: ${al.formacion || ''} · ${(al.titulares || []).map((t) => (t && t.nombre) || t).join(', ')}`);
      if (r.avisoSaldo) L.push(`SALDO: ${r.avisoSaldo}`);
      if (Pl.corto) {
        for (const o of r.ops || []) if (o._k) L.push(`FRASE ${(o.j && o.j.nombre) || o.jugador || ''}: ${o.motivo}`);
        const c = Pl.cambios || {};
        L.push(`CAMBIOS: quita [${(c.quita || []).join(', ')}]; mete [${(c.mete || []).join(', ')}]; no aplicado [${(c.noAplicado || []).join(', ')}]; frases de la app ${c.sinFrase || 0}${c.rehecho ? `; REHECHO (${c.rehecho})` : ''}`);
        for (const d of r.descartes || []) L.push(`MIRADO ${d.jugador}: ${d.motivo}`);
        for (const n of Pl.noticias || []) L.push(`NOTICIA ${n.jugador}: ${n.texto}`);
        // (los rivales, como se ven: cuadrarPlan quita lo que ya no es verdad con la liga de ahora)
        for (const n of r.rivales || Pl.rivales || []) L.push(`RIVAL ${n.manager}: ${n.texto}`);
        // (punto 14) la búsqueda en Google: «Con la IA y Google» y la lista «Fuentes» de Hoy
        if (Pl.web) L.push('WEB: sí');
        for (const f of Pl.fuentes || []) L.push(`FUENTE ${f.t} · ${f.u}`);
        L.push(...window.__arbitro(r, D, M, U.eur));
      }
      const ops = (r.ops || []).filter((o) => !['alinear', 'esperar'].includes(o.accion));
      return { vista: L.join('\n'), n: ops.length, descartadas: ops.filter((o) => o.descartada).length, crudo: Pl, corto: !!Pl.corto, tok: Pl.tok || null };
    }, { largo, extra: (ESCENAS[escena] || {}).extra || null, escrito, modelo: MODELO_FALSO }));
    // lo que ocupa lo que la app manda a la IA (el sistema y los mensajes)
    const q = (P.pedidos.find((x) => x.cuerpo && x.cuerpo.contents) || {}).cuerpo;
    if (r.vista && r.corto && q) r.vista += `\nPEDIDO: ${(q.systemInstruction ? q.systemInstruction.parts[0].text.length : 0) + q.contents.flatMap((c) => c.parts || []).reduce((t, p) => t + (p.text || '').length, 0)} caracteres`;
    return { ...r, pedidos: P.pedidos, errores: P.errores };
  } finally { await P.cerrar(); }
}

/**
 * EL ÁRBITRO: las reglas de LaLiga de claude/revision-ia.md (1-15) aplicadas a un plan ya cuadrado, con una cuenta aparte
 * que no usa nada del motor del plan. Devuelve las líneas REGLAS, JORNADA, HUECOS, ONCE_PTS, ONCE_BAJA y VENDE_POR_CAJA.
 * No usa nada de fuera (se manda a la página como texto): lo que necesita le llega por los argumentos.
 */
export function arbitro(R, D, M, eur) {
  const L = [];
  const nom = (o) => (o.j && o.j.nombre) || o.jugador || '';
  const mal = [];
  const vivos = (R.ops || []).filter((o) => !o.descartada && !o.sugerencia && !o.ya);
  const ciclos = (M.ventanaEsp && M.ventanaEsp.ciclos) || 0;
  const rev = (o) => String(o.objetivo || '').startsWith('revend');
  const acepta = (o) => o.accion === 'vender' && o.etiqueta === 'Aceptar oferta';
  let caja = +D.dinero, pujado = +M.misPujas || 0, n = M.mias.length, escudos = 0, vuelve = 0, ventas = 0;
  const salen = new Set(), entran = [], aceptadas = new Set();
  /* (19 nov, tercera parte) reglas que el árbitro no miraba: con 25 no se puja (17), el parón (dinero antes que once salvo lo
     que sube hasta la vuelta y los chollos o los buenos a su valor con saldo), nada «para hoy» que sea de otro día, en
     negativo entre semana no se malvende, la hora de mercado de la liga, comprar por debajo del precio (6), lo que no está
     en el mercado y el once con uno vendido hoy (18). La cuenta del parón, como paronLejos de operaciones.js */
  const ahora = Date.now(), DIA = 864e5;
  const paronLejos = !!(M.paron && M.proxima && M.paron.ini <= M.proxima.ini && M.paron.fin > ahora && M.proxima.ini - ahora > 3 * DIA);
  const cambiosQuedan = ((M.ventanaEsp && M.ventanaEsp.cambios) || []).length;
  const fmtH = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtD = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric' });
  const horaMercado = M.cierreMercado ? fmtH.format(new Date(M.cierreMercado)) : null;
  const hoyD = Number(fmtD.format(new Date(ahora)));
  const fase = (pid) => { const i = M.inercia ? M.inercia(pid) : null; return i ? i.fase : null; };
  const cae = (pid) => { const t = (M.tend && M.tend(pid)) || {}; return ['giro', 'baja', 'frena'].includes(fase(pid)) || (t.p7 != null && t.p7 < -2) || (t.p1 != null && t.p1 < -0.5); };
  for (const o of vivos) {
    const hoy = o.hoy !== false, imp = +o.importe || 0, q = nom(o);
    const cuando = String(o.cuando || '');
    // «para hoy» con el día de otro (lo de Huijsen: recomendar hoy lo que no se puede hasta dentro de días)
    const dMes = cuando.match(/\b(?:lun|mar|mié|jue|vie|sáb|dom)\w*\.?\s+(\d{1,2})\b/);
    if (hoy && dMes && Number(dMes[1]) !== hoyD && !/\bpara aceptar\b|\bantes de\b/.test(cuando) && ['clausular', 'pujar', 'comprar', 'blindar'].includes(o.accion)) mal.push(`rH: ${o.accion} ${q} va como de hoy y es para ${dMes[0]}`);
    // la hora del mercado de la liga (cada liga tiene la suya)
    const hm = cuando.match(/antes de las (\d{1,2}:\d{2})/);
    if (hm && horaMercado && hm[1].padStart(5, '0') !== horaMercado && /pujar|comprar/.test(o.accion)) mal.push(`rM: ${o.accion} ${q} «antes de las ${hm[1]}» y el mercado de la liga cambia a las ${horaMercado}`);
    if (['vender', 'clausular', 'pujar', 'comprar', 'blindar'].includes(o.accion) && !String(o.motivo || '').trim()) mal.push(`sin motivo: ${o.accion} ${q}`);
    if (o.accion === 'vender') {
      if (!M.mias.some((x) => x.pid === o.pid)) mal.push(`${q} no es mío`);
      salen.add(o.pid);
      if (acepta(o)) { if (hoy) { caja += imp; n--; aceptadas.add(o.pid); } } else if (ciclos >= 1) ventas += imp * 0.9;
      // en negativo entre semana, con dos cambios de mercado o más por delante, no se malvende hoy lo que no está cayendo
      // (Carlos, 3 nov): ni ponerlo a la venta «por caja» hoy, ni aceptar una oferta por debajo de su valor
      const x0 = M.mias.find((y) => y.pid === o.pid);
      if (hoy && +D.dinero < 0 && cambiosQuedan >= 2 && x0 && !cae(o.pid) && !rev(o) && !(M.vendeBaja && M.vendeBaja(x0)) && x0.j.pos !== 5) {
        const v0 = (M.misVentas || []).find((y) => y.pid === o.pid);
        if (acepta(o) && imp < x0.j.valor * 0.995 && !(v0 && v0.mejor && v0.mejor.sobre >= 0)) mal.push(`rN: en negativo y con ${cambiosQuedan} cambios por delante acepta ${eur(imp)} por ${q}, por debajo de su valor`);
        else if (!acepta(o) && String(o.objetivo || '') === 'caja') mal.push(`rN: en negativo y con ${cambiosQuedan} cambios por delante pone hoy a la venta a ${q} solo por caja`);
      }
    } else if (o.accion === 'clausular') {
      const cl = M.clausulas.find((x) => x.pid === o.pid);
      if (!cl) { mal.push(`${q} no tiene cláusula que pagar`); continue; }
      if (hoy && M.vedaAhora) mal.push(`r7: clausular a ${q} con las cláusulas cerradas`);
      if (hoy && !cl.abierta) mal.push(`r2: la cláusula de ${q} no está abierta`);
      if (imp > caja + 1) mal.push(`r5: la cláusula de ${q} (${eur(imp)}) no cabe en el saldo (${eur(caja)})`);
      caja -= imp; n++; entran.push(o.j);
      if (rev(o)) { if (ciclos < 1) mal.push(`r3: no da tiempo a revender a ${q}`); vuelve += imp * 0.92; if (!o.vender_el) mal.push(`${q}: para revender y sin día de venta`); }
      else if (M.mereceClausula && !M.mereceClausula(cl) && !String(o.objetivo || '').startsWith('revend')) mal.push(`hoy: la cláusula de ${q} no pasa la regla de Hoy y las alarmas`);
      if (hoy && n > 25) mal.push(`r17: clausula a ${q} con la plantilla llena`);
    } else if (o.accion === 'pujar' || o.accion === 'comprar') {
      if (M.dueno[o.pid] && o.accion === 'pujar') mal.push(`${q} tiene dueño: no se puja`);
      const enM = (M.mercado || []).find((m) => m.pid === o.pid);
      if (o.accion === 'pujar' && !enM) mal.push(`${q} no está en el mercado`);
      if (o.accion === 'comprar' && enM && enM.tipo === 'manager' && enM.precio && imp && imp < enM.precio - 1) mal.push(`r6: ${eur(imp)} por ${q}, por debajo de lo que pide (${eur(enM.precio)})`);
      // (Carlos, 20 nov, con Revivo: «por solo un millón más no me lo va a aceptar») a un rival no se le ofrece por uno suyo
      // que sube menos de lo que pediría (ofertaDueno)
      if (o.accion === 'comprar' && !enM && M.dueno[o.pid] && M.dueno[o.pid] !== (D.yo && D.yo.teamId) && M.ofertaDuenoDe && o.j) {
        const od = M.ofertaDuenoDe(o.j);
        if (od && od.sube && imp && imp < od.v - 1) mal.push(`rO: ${eur(imp)} a su dueño por ${q}, que sube, por debajo de lo que pediría (${eur(od.v)})`);
      }
      if (hoy && n >= 25) mal.push(`r17: ${o.accion} por ${q} con ${n} jugadores`);
      if (hoy) { pujado += imp; n++; entran.push(o.j); }
      if (rev(o)) { if (ciclos < 2) mal.push(`r3: no da tiempo a revender a ${q}`); vuelve += imp * 0.92; if (!o.vender_el) mal.push(`${q}: para revender y sin día de venta`); }
    }
    if (paronLejos && hoy && ['clausular', 'pujar', 'comprar'].includes(o.accion) && !rev(o) && o.j && o.j.valor) {
      // en el parón, para el once solo lo que sube (inercia), un chollo (a un 5 % de su valor sin bajar) o uno bueno a su
      // valor que se paga con el saldo
      const sube = ['sube', 'acelera'].includes(fase(o.pid));
      const mm = (M.mercado || []).find((m) => m.pid === o.pid);
      const paga = Math.max(imp, +o.puja_max || 0);
      // (un bueno a su valor: el precio del mercado a su valor y la puja que gana, con el saldo y sin deuda)
      const chollo = !cae(o.pid) && (paga <= o.j.valor * 1.05 || (mm && mm.precio <= o.j.valor * 1.02 && paga <= caja - pujado + (o.accion === 'pujar' ? paga : 0) + 1));
      if (!sube && !chollo) mal.push(`rP: en el parón ${o.accion} ${q} para el once (${eur(imp)} por uno de ${eur(o.j.valor)}, ${fase(o.pid) || 'sin inercia'})`);
    }
    if (o.accion === 'blindar') {
      const x = M.mias.find((y) => y.pid === o.pid);
      if (!x) { mal.push(`${q} no es mío`); continue; }
      // (Carlos, 20 nov: «en el fantasy las cláusulas casi nunca se suben») pagar por subirla, solo si cuesta un 5 % de su
      // valor como mucho y nunca a uno que se frena, gira, baja o se ha parado
      if (imp && x.j && x.j.valor && imp > x.j.valor * 0.05 + 1) mal.push(`rC: subir la cláusula de ${q} cuesta ${eur(imp)}, más de un 5 % de su valor (${eur(x.j.valor)})`);
      if (imp && ['frena', 'giro', 'baja', 'parado'].includes(fase(o.pid))) mal.push(`rC: subir la cláusula de ${q}, que ${fase(o.pid) === 'frena' ? 'se frena' : fase(o.pid) === 'parado' ? 'se ha parado' : 'baja'}`);
      if (imp) { if (imp > caja + 1) mal.push(`r5: subir la cláusula de ${q} no cabe en el saldo`); caja -= imp; }
      else { escudos++; if (hoy && !x.abierta) mal.push(`r9: blindaje a ${q} con la cláusula cerrada`); }
    } else if (o.retira) pujado -= +o.retira;   // una puja retirada deja de contar (se puede retirar cuando se quiera)
    else if (o.accion === 'alinear' && M.enJuego) mal.push('r8: alinear con la jornada en juego');
  }
  if (M.escudosMios && escudos > M.escudosMios.quedan) mal.push(`r9: ${escudos} blindajes y quedan ${M.escudosMios.quedan}`);
  // (si ya estaba pasado antes del plan, lo que no puede es dejarlo peor)
  if (caja - pujado < -M.deuda - 1 && caja - pujado < +D.dinero - (+M.misPujas || 0) - 1) mal.push(`r4: ${eur(caja - pujado)} pasa el tope de deuda (${eur(-M.deuda)})`);
  if (n > 25) mal.push(`r12: la plantilla se iría a ${n}`);
  // (Carlos, 20 nov: «si le preguntas una cosa a la IA, debe estar actualizada al momento») el plan, con la liga recién
  // pedida: no con la de hace más de media hora
  if (R.t && D.t && R.t - D.t > 30 * 60e3) mal.push(`rD: el plan va con la liga de hace ${Math.round((R.t - D.t) / 60e3)} min`);
  // lo pujado se cobra en el cambio de mercado: si el próximo llega con la jornada ya empezada, para esta no cuenta
  const pujasAntes = !M.cierreMercado || !M.proxima || M.cierreMercado < M.proxima.ini;
  const jornada = pujasAntes ? caja - pujado + vuelve + ventas : caja + ventas;
  if (jornada < 0) mal.push(`r10: empezaría la jornada en ${eur(jornada)}`);
  if (M.enJuego && R.alineacion) mal.push('r8: once con la jornada en juego');
  // (18) uno vendido hoy (oferta aceptada) no puede ir en el once
  if (R.alineacion && aceptadas.size) {
    const tit = new Set((R.alineacion.titulares || []).map(String));
    for (const pid of aceptadas) { const j = M.J ? M.J(pid) : null; if (j && tit.has(j.nombre)) mal.push(`r18: ${j.nombre} va en el once y se vende hoy`); }
  }
  // el titular no nombra a uno cuyo paso la app ha descartado
  const fuera = (R.ops || []).filter((o) => o.descartada && !vivos.some((v) => v.pid === o.pid)).map(nom).filter((x) => x && x.length > 3);
  for (const x of fuera) if (String(R.titular || '').includes(x)) mal.push(`titular: nombra a ${x}, que la app ha descartado`);
  L.push(`REGLAS: ${mal.length ? `MAL ${mal.join(' · ')}` : 'ok'}`);
  L.push(`JORNADA: ${eur(jornada)}`);
  const antes = M.mejorOnce(M.mias.map((x) => x.j));
  const despues = M.mejorOnce([...M.mias.filter((x) => !salen.has(x.pid)).map((x) => x.j), ...entran.filter(Boolean)]);
  const d1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  L.push(`HUECOS: ${antes.huecos || 0} → ${despues.huecos || 0}`);
  L.push(`ONCE_PTS: ${d1(antes.total)} → ${d1(despues.total)}`);
  if ((despues.huecos || 0) > (antes.huecos || 0) || despues.total < antes.total - 1.5) L.push(`ONCE_BAJA: ${d1(antes.total - despues.total)}${(despues.huecos || 0) > (antes.huecos || 0) ? ' y con huecos' : ''}`);
  // vender sin más motivo que el dinero: ni está de baja, ni ha girado, frena o baja, ni es de revender, ni le pagan más
  // de lo que subiría aguantándolo hasta la jornada (Fornals, 13 nov)
  const pagaCaja = vivos.some((o) => ['clausular', 'blindar'].includes(o.accion) && +o.importe > +D.dinero);
  const diasJ = M.proxima ? Math.min(14, Math.max(1, Math.ceil((M.proxima.ini - Date.now()) / 864e5) - 1)) : 3;
  for (const o of vivos.filter((x) => x.accion === 'vender')) {
    const x = M.mias.find((y) => y.pid === o.pid);
    if (!x) continue;
    const ine = M.inercia(o.pid), v = (M.misVentas || []).find((y) => y.pid === o.pid), t = M.tend(o.pid) || {};
    const p7 = t.p7e !== undefined ? t.p7e : t.p7;
    const sube = !!ine && ['sube', 'acelera'].includes(ine.fase) && ine.ult >= x.j.valor * 0.005;
    const prima = acepta(o) && v && v.mejor ? v.mejor.importe - x.j.valor : 0;
    const motivo = M.vendeBaja(x) || x.j.pos === 5 || (ine && ['giro', 'baja', 'frena', 'parado'].includes(ine.fase)) || (M.paraRevender || []).some((y) => y.pid === o.pid)
      || (t.p1 != null && t.p1 < -0.5) || (p7 != null && p7 < -2)
      || (acepta(o) && v && v.mejor && v.mejor.sobre >= 0.02 && (!sube || prima >= ine.proy(diasJ)));
    const haceFalta = jornada - (acepta(o) ? +o.importe : ciclos >= 1 ? +o.importe * 0.9 : 0) < 0 || (acepta(o) && pagaCaja);
    if (!motivo && !haceFalta) L.push(`VENDE_POR_CAJA: ${nom(o)} (${ine ? ine.fase : 'sin datos'}${v && v.mejor ? `, oferta ${Math.round(v.mejor.sobre * 1000) / 10} %` : ''})`);
  }
  return L;
}

/**
 * El plan del motor (sin IA) en ese escenario, ya cuadrado por la app, y lo que dice de él el ÁRBITRO: una cuenta aparte,
 * escrita solo con las reglas de LaLiga de claude/revision-ia.md (1-15), que no usa nada del motor del plan. Lo que se ve:
 *   TITULAR / SITUACION / OP … [objetivo] (cuándo) · vender el … / ONCE / SALDO, como en el plan de la IA, y además
 *   REGLAS: ok | REGLAS: MAL r5 …      las reglas que el plan se salta (dinero, deuda, 25, blindajes, cierre, jornada)
 *   JORNADA: lo que tendría al empezar la jornada haciendo el plan (lo de revender al 92 % y lo puesto en venta al 90 %)
 *   HUECOS: a → b   y   ONCE_PTS: a → b   el once antes y después del plan
 *   ONCE_BAJA: cuánto pierde el once (si pierde más de 1,5 puntos o gana huecos)
 *   VENDE_POR_CAJA: una venta sin más motivo que el dinero, y sin que el dinero haga falta
 * `MOTOR=viejo` mide el plan sin IA de antes (planAuto), para comparar.
 */
export async function motor(escena) {
  const P = await pagina(escena);
  try {
    await P.page.evaluate(`window.__arbitro = ${arbitro.toString()}`);
    const r = await P.page.evaluate(async ({ viejo, extra }) => {
      const I = await import('./js/ia.js'), U = await import('./js/util.js'), Mo = await import('./js/motor.js');
      const S = window.S, arbitro = window.__arbitro;
      // el motor, como lo monta la app: con las fichas, los onces probables y las noticias (llegan un momento después de abrir)
      for (let i = 0; i < 40 && !S.fuentes; i++) await new Promise((ok) => setTimeout(ok, 50));
      const f = S.fuentes || {};
      // eslint-disable-next-line no-new-func
      S.M = Mo.analizar(S.D, S.H, S.c, { det: S.det, onces: f.onces, noticias: f.noticias, avanzadas: f.avanzadas, alineaciones: f.alineaciones, ...(extra ? new Function('S', extra)(S) : {}) });
      const { D, M, c } = S;
      let R;
      try {
        if (viejo) R = Mo.rematarAuto(I.cuadrarPlan(Mo.planAuto(D, M, c), D, M));
        else { const Pm = await import('./js/plan.js'); R = Pm.planDeHoy(D, M, c); }
      } catch (e) { return { error: `${e.message}\n${String(e.stack || '').split('\n').slice(1, 4).join('\n')}` }; }
      const eur = U.eur, nom = (o) => (o.j && o.j.nombre) || o.jugador || '';
      const L = [`TITULAR: ${R.titular || ''}`, `SITUACION: ${R.situacion || ''}`];
      const linea = (o) => `${o.etiqueta || o.accion} ${nom(o)}${o.importe ? ` ${eur(o.importe)}` : ''}${o.objetivo ? ` [${o.objetivo}]` : ''}${o.cuando ? ` (${o.cuando})` : ''}${o.vender_el ? ` · vender el ${o.vender_el}` : ''}${o.aviso ? ` | ${o.aviso}` : ''}`;
      for (const o of R.ops || []) L.push(`${o.descartada ? 'DESCARTADA' : o.sugerencia ? 'SUGERENCIA' : o.ya ? 'HECHA' : 'OP'}: ${linea(o)}`);
      const al = R.alineacion || null;
      if (al) L.push(`ONCE: ${al.formacion || ''} · ${(al.titulares || []).map((t) => (t && t.nombre) || t).join(', ')}`);
      if (R.avisoSaldo) L.push(`SALDO: ${R.avisoSaldo}`);
      if (R.avisoOnce) L.push(`AVISO_ONCE: ${R.avisoOnce}`);
      for (const d of R.descartes || []) L.push(`MIRADO ${d.jugador}: ${d.motivo}`);
      for (const d of R.proximos_dias || []) L.push(`DIAS ${d.dia}: ${d.texto}`);
      if (R.cuentas && R.cuentas.punto) L.push(`MOTOR: 1 punto en una jornada ≈ ${eur(R.cuentas.punto.v)} (${R.cuentas.punto.de}) · ${R.cuentas.candidatos} candidatos, ${R.cuentas.probados} en la búsqueda${R.vueltas ? `, ${R.vueltas} vuelta${R.vueltas > 1 ? 's' : ''} por descartes` : ''}${R.cuentas.backtest ? ` · reventas pasadas: ${R.cuentas.backtest.bien} de ${R.cuentas.backtest.n} bien, ${eur(R.cuentas.backtest.media, { signo: true })} de media a ${R.cuentas.backtest.dias} días` : ''}`);

      L.push(...arbitro(R, D, M, eur));
      const ops = (R.ops || []).filter((o) => !['alinear', 'esperar'].includes(o.accion));
      return { vista: L.join('\n'), n: ops.length, descartadas: ops.filter((o) => o.descartada).length };
    }, { viejo: process.env.MOTOR === 'viejo', extra: (ESCENAS[escena] || {}).extra || null });
    return { ...r, errores: P.errores };
  } finally { await P.cerrar(); }
}

/** ¿cumple el caso? `debe` y `nunca` son expresiones regulares (texto, sin mayúsculas ni minúsculas) sobre lo que se ve */
export function juzgar(caso, visto) {
  const fallos = [];
  const re = (s) => (s instanceof RegExp ? s : new RegExp(s, 'ims'));
  if (visto == null) return ['sin respuesta'];
  for (const d of caso.debe || []) if (!re(d).test(visto)) fallos.push(`falta ${re(d)}`);
  for (const n of caso.nunca || []) { const m = visto.match(re(n)); if (m) fallos.push(`sobra «${m[0].slice(0, 80)}»`); }
  return fallos;
}
