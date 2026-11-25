// El portal de datos de la web: el mercado de hoy (/mercado/), los 20 equipos (/equipos/), las jornadas (/jornada/) con el resumen de
// cada una al acabar y lo que lee la portada (mercado/hoy.json). Lo lanza cada noche .github/workflows/portal-web.yml, después del
// cambio de mercado; también a mano:
//   node bot/portal-web.mjs [--forzar=1] [--resumen=12 | --resumen=1-11] [--cache=carpeta] [--sin-tarjeta=1] [--fichas=150]
//   node bot/portal-web.mjs --onces=1 [--esperar=45]          solo los onces confirmados (sesión 3 de AdSense, idea 12): mira cada 3 min
//                                                             hasta que estén los de los partidos de la próxima hora (o pasen 45 min)
//   node bot/portal-web.mjs --onces-toca --estado=f.json [--apuntar=1]   ¿toca lanzarlo? (lo pregunta el bot cada 5 min)
// --forzar rehace el mercado aunque el valor de hoy no haya llegado (con el último que haya) o ya esté hecho; --resumen rehace el de esa
// jornada; --cache guarda y reutiliza lo bajado de la API (para probar sin pedirlo todo otra vez); --fichas, cuántos jugadores con
// página como mucho (fase 2: una página por equipo y por jugador, con el mercado; 0 = sin fichas). Escribe el contenido de cada página,
// su entrada en .github/paginas.json y .github/portal/estado.json, y ejecuta .github/paginas.py. Git lo hace la Action.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as LL from './lib/laliga.mjs';
import { hechosMercado, contenidoMercado, contenidoEquipos, hoyJson, proximaJornada, prevision, acierto } from './web/mercado.mjs';
import { hechosResumen, contenidoResumen, contenidoJornadas, metasResumen, resumenCorto, semanaMercado } from './web/resumen.mjs';
import { RAIZ, FICHAS, escribirPagina, escribirFichas, paginas, diaMadrid, cargarEncuadres } from './web/portal.mjs';
import { hechosClausulas, contenidoClausulas, metasClausulas } from './web/clausulas.mjs';
import { hechosBajas, contenidoBajas, metasBajas, partesJson } from './web/bajas.mjs';
import { hechosOnces, contenidoOnces, metasOnces, confirmar, aciertoDe, lineaResumen } from './web/onces.mjs';
import { confirmadosDe, pendientes, tocaOnces } from './web/confirmados.mjs';
import { lesionados } from './lib/partes.mjs';
import { hechosFichas, contenidoEquipo, contenidoJugador, contenidoJugadores, metasEquipo, metasJugador, metasJugadores, metasPaginaJugadores, nPaginasJugadores, jugadoresJson, indiceBuscador, escudosPie, admitirIndexables, fichasQueCambian } from './web/fichas.mjs';

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : (process.argv.includes(`--${k}`) ? '1' : null); };
const salida = (k, v) => { if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`, { flag: 'a' }); };
const HORA = 36e5;
const forzar = arg('forzar') === '1';
const log = (s) => console.log(s);

// la API, con caché en disco si se pide (las pruebas en local)
const cache = arg('cache');
const conCache = (nombre, f) => async (...a) => {
  if (!cache) return f(...a);
  const p = path.join(cache, `${nombre}-${a.join('-') || 'x'}.json`);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  const r = await f(...a);
  mkdirSync(cache, { recursive: true });
  writeFileSync(p, JSON.stringify(r));
  return r;
};
const api = { jugadores: conCache('jugadores', LL.jugadores), valorMercado: conCache('valor', LL.valorMercado), statsSemana: conCache('semana', LL.statsSemana),
  semanaActual: conCache('actual', LL.semanaActual), ficha: conCache('ficha', LL.ficha) };

const DIR = path.join(RAIZ, '.github', 'portal');
mkdirSync(DIR, { recursive: true });
const fEstado = path.join(DIR, 'estado.json');
const estado = existsSync(fEstado) ? JSON.parse(readFileSync(fEstado, 'utf8')) : { mercado: null, resumenes: {} };
let cambios = false;
const maxFichas = arg('fichas') != null ? Number(arg('fichas')) : 2000;  // (rework, 21 nov) ficha para todos; antes, las 150 que más pesaban

// las rutas de las fichas que ya existen (para enlazar desde el resumen antes de rehacerlas; luego, las de hoy)
const rutasDe = (f) => ({ jugador: (id) => (f && f.jugadores && f.jugadores[String(id)] ? `jugadores/${f.jugadores[String(id)]}.html` : null),
  equipo: (id) => (f && f.equipos && f.equipos[String(id)] ? `equipos/${f.equipos[String(id)]}.html` : null) });
let rutas = rutasDe(estado.fichas);

const previas = () => paginas().filter((p) => p.grupo === 'jornadas' && p.jornada != null).map((p) => ({ ruta: p.ruta, jornada: p.jornada })).sort((a, b) => b.jornada - a.jornada);
const resumenes = () => paginas().filter((p) => p.grupo === 'resumenes' && p.jornada != null).map((p) => ({ ruta: p.ruta, jornada: p.jornada })).sort((a, b) => b.jornada - a.jornada);

// (sesión 3, idea 12) los onces probables de la jornada que viene: .github/portal/onces.json
const fOnces = path.join(DIR, 'onces.json');
const oncesPrevio = existsSync(fOnces) ? JSON.parse(readFileSync(fOnces, 'utf8')) : null;
const guardarOnces = (o) => writeFileSync(fOnces, JSON.stringify(o, null, 1) + '\n');
if (arg('onces-toca')) {
  const fe = arg('estado');
  const est = fe && existsSync(fe) ? JSON.parse(readFileSync(fe, 'utf8')) : {};
  const st = oncesPrevio ? await LL.statsSemana(oncesPrevio.J).catch(() => []) : [];
  const k = tocaOnces(st, oncesPrevio, est);
  if (k && fe && arg('apuntar')) { est[k] = Date.now(); for (const x of Object.keys(est)) if (Date.now() - est[x] > 10 * 24 * HORA) delete est[x]; writeFileSync(fe, JSON.stringify(est) + '\n'); }
  console.log(k);
  salida('toca', k);
  process.exit(0);
}
if (arg('onces') === '1') {
  if (!oncesPrevio) { log('Sin onces probables guardados: nada que confirmar'); salida('cambios', 'false'); process.exit(0); }
  const o = oncesPrevio;
  const jugadores = await api.jugadores();
  const fin = Date.now() + Number(arg('esperar') || 45) * 6e4;
  let hay = false;
  for (;;) {
    const st = await LL.statsSemana(o.J).catch(() => []);
    const ps = pendientes(st, o);
    for (const m of ps) {
      const c = await confirmadosDe(m, jugadores).catch((err) => { log(`  (onces) ${m.local.mainName}-${m.visitor.mainName}: ${err.message}`); return {}; });
      for (const [id, xs] of Object.entries(c)) if (confirmar(o, id, xs)) { hay = true; log(`Once confirmado: ${(o.equipos.find((y) => y.id === id) || {}).nombre}`); }
    }
    const quedan = pendientes(st, o).filter((m) => Date.parse(m.date) - Date.now() < 65 * 6e4);
    if (!quedan.length || Date.now() > fin) { if (quedan.length) log(`Sin once confirmado aún: ${quedan.map((m) => `${m.local.mainName}-${m.visitor.mainName}`).join(', ')}`); break; }
    await new Promise((r) => setTimeout(r, 3 * 6e4));
  }
  if (hay) {
    const a = aciertoDe(o);
    if (a) { estado.oncesAcierto = { ...(estado.oncesAcierto || {}), [o.J]: a }; log(`Acierto de la J${o.J} hasta ahora: ${a.ok} de ${a.n}`); }
    guardarOnces(o);
    const pv = paginas().find((p) => p.grupo === 'jornadas' && p.jornada === o.J);
    escribirPagina(metasOnces(o.J), contenidoOnces(o, { rutas: rutasDe(estado.fichas), previa: pv ? pv.ruta : null, aciertos: estado.oncesAcierto || {}, jugadores }));
    writeFileSync(fEstado, JSON.stringify(estado, null, 1) + '\n');
    execFileSync('python3', [path.join(RAIZ, '.github', 'paginas.py')], { stdio: 'inherit' });
  }
  salida('cambios', hay ? 'true' : 'false');
  process.exit(0);
}

// 1. el resumen de la última jornada acabada (o el que se pida). Se rehace mientras no hayan pasado 48 h desde el último partido, por si
// LaLiga corrige puntos (el de DAZN llega tarde): como mucho una vez cada 20 h
const sem = await api.semanaActual();
const jugadores = await api.jugadores();
// el encuadre de las caras (dónde está la cabeza en cada foto): .github/portal/encuadres.py, con Pillow; solo baja las nuevas
try {
  execFileSync('python3', [path.join(RAIZ, '.github', 'portal', 'encuadres.py')], { input: JSON.stringify(jugadores.map((j) => j.image).filter(Boolean)), stdio: ['pipe', 'inherit', 'inherit'] });
} catch (err) { log(`  encuadres: ${err.message.split('\n')[0]}`); }
cargarEncuadres();
// --resumen=12 rehace ese; --resumen=1-11, todos los de ese tramo (sesión 4: los de la J1 a la J11 de una vez)
const rango = arg('resumen') && /^\d+-\d+$/.test(arg('resumen')) ? arg('resumen').split('-').map(Number) : null;
const candidatas = rango ? Array.from({ length: rango[1] - rango[0] + 1 }, (_, i) => rango[0] + i)
  : arg('resumen') ? [Number(arg('resumen'))] : [sem.weekNumber, sem.previousWeek, ...faltan()].filter((x, i, l) => x > 0 && l.indexOf(x) === i);
/** (25 nov, B9) las jornadas de antes sin resumen (la J8, con un aplazado) y las que lo tienen con un partido aplazado cuya fecha
 * ya ha pasado, para ponerlo al día: como mucho 3 por noche */
function faltan() {
  const hasta = Math.max(0, (sem.previousWeek || sem.weekNumber || 1) - 1), out = [];
  for (let J = 1; J <= hasta && out.length < 3; J++) {
    const ya = estado.resumenes[J];
    if (!ya || (ya.aplazados || []).some((x) => x.t + 3 * HORA < Date.now())) out.push(J);
  }
  return out;
}
// (sesión 4) el mercado de hoy antes del resumen: la semana del mercado de cada jornada (idea 7) sale de su serie de valor
const hoy = diaMadrid();
const tocaMercado = forzar || !estado.mercado || estado.mercado.dia !== hoy;
let hm = tocaMercado ? await hechosMercado(api, { exigirHoy: !forzar, log }) : null;
// lo de cada jornada jugada, para comparar en el análisis del resumen (la más goleadora, el récord de puntos, el once más alto)
const temporada = [];
const statsDe = {};
if (candidatas.length) for (let k = 1; k <= Math.max(...candidatas); k++) {
  statsDe[k] = await api.statsSemana(k).catch(() => []);
  const hk = hechosResumen(k, statsDe[k], jugadores);
  if (hk) temporada.push(resumenCorto(hk));
}
for (const J of candidatas) {
  const st = await api.statsSemana(J);
  const h = hechosResumen(J, st, jugadores);
  if (!h) { log(`Jornada ${J}: no ha acabado entera, sin resumen`); continue; }
  const ya = estado.resumenes[J];
  const toca = arg('resumen') || !ya || (ya.generada - h.ultimo < 48 * HORA && Date.now() - ya.generada > 20 * HORA)
    || ((ya.aplazados || []).length > (h.aplazados || []).length);
  if (!toca) { log(`Jornada ${J}: resumen ya hecho`); continue; }
  let tarjeta = null, tarjetaAlto = null;
  if (arg('sin-tarjeta') !== '1') {
    try {
      // la tarjeta de los mejores, la misma que publica el bot (tipos/resumen.mjs y lib/con-tarjetas.mjs)
      const { generar } = await import('./tipos/resumen.mjs');
      const { tarjetasDe } = await import('./lib/con-tarjetas.mjs');
      const t = (await generar({ stats: st, jornada: J, jugadores, completo: true })).find((x) => /\|mejores\|/.test(x.clave));
      const [tj] = t ? await tarjetasDe(t, { stats: st, jugadores, jornada: J, config: { tarjetas: { resumen: true } }, forzar: true }) : [];
      if (tj && tj.ok && tj.png) {
        // la del bot sale a 2400 px y pesa 1,5 MB: en la web, WebP de 1080 px (~100 KB) con Pillow; sin Pillow, no se pone
        const dir = path.join(RAIZ, 'web', 'jornada', 'img');
        mkdirSync(dir, { recursive: true });
        const tmp = path.join(dir, `.resumen-${J}.png`), fin = path.join(dir, `resumen-${J}.webp`);
        writeFileSync(tmp, tj.png);
        try {
          execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB")\nim=im.resize((1080, round(im.height*1080/im.width)), Image.LANCZOS)\nim.save(sys.argv[2], "WEBP", quality=80, method=6)', tmp, fin]);
          tarjeta = `img/resumen-${J}.webp`;
          tarjetaAlto = Math.round((tj.png.readUInt32BE(20) * 1080) / tj.png.readUInt32BE(16));
          log(`  tarjeta: ${Math.round(readFileSync(fin).length / 1024)} KB`);
        } catch (err) { log(`  tarjeta: sin Pillow para pasarla a WebP (${err.message.split('\n')[0]})`); }
        rmSync(tmp, { force: true });
      } else if (tj) log(`  tarjeta: no pasa el validador (${(tj.errores || []).join('; ')})`);
    } catch (err) { log(`  tarjeta: ${err.message}`); }
  }
  // sin tarjeta nueva (--sin-tarjeta o si falla), la que ya hubiera de esa jornada
  const ya0 = path.join(RAIZ, 'web', 'jornada', 'img', `resumen-${J}.webp`);
  if (!tarjeta && existsSync(ya0)) {
    try {
      const [w, hh] = execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nprint(*Image.open(sys.argv[1]).size)', ya0]).toString().trim().split(' ').map(Number);
      tarjeta = `img/resumen-${J}.webp`; tarjetaAlto = Math.round((hh * 1080) / w);
    } catch { /* sin Pillow: sin tarjeta */ }
  }
  const pv = previas().find((p) => p.jornada === J), sig = previas().find((p) => p.jornada === J + 1);
  const ruta = `jornada/resumen-jornada-${J}.html`;
  // la semana del mercado: con el mercado de esta noche o, si hoy ya estaba hecho, la que se guardó la última vez
  const ant = J > 1 ? (statsDe[J - 1] || await api.statsSemana(J - 1).catch(() => [])) : [];
  const finAnt = ant.length ? Math.max(...ant.map((m) => Date.parse(m.date))) : null;
  const semana = (hm && semanaMercado(h, hm.todas, finAnt)) || (ya && ya.semana) || null;
  // (sesión 3, idea 12) el acierto de los onces probables de esa jornada, si se guardaron sus confirmados
  const acO = (oncesPrevio && oncesPrevio.J === J && aciertoDe(oncesPrevio)) || (estado.oncesAcierto || {})[J] || null;
  if (acO) estado.oncesAcierto = { ...(estado.oncesAcierto || {}), [J]: acO };
  escribirPagina({ ruta, seccion: 'jornada', grupo: 'resumenes', jornada: J, ...metasResumen(J) }, contenidoResumen(h, { previa: pv ? pv.ruta : null, siguiente: sig, tarjeta, tarjetaAlto, rutas, temporada, semana, onces: lineaResumen(acO, J) }));
  estado.resumenes[J] = { generada: h.generada, ultimo: h.ultimo, mejores: h.mejores.slice(0, 3), ...(semana ? { semana } : {}), ...(h.aplazados && h.aplazados.length ? { aplazados: h.aplazados } : {}) };
  cambios = true;
  log(`Jornada ${J}: resumen hecho (${h.mejores[0].nombre} ${h.mejores[0].pts})`);
}

// 2. el mercado de hoy y los equipos (una vez por día de mercado; `hm`, ya bajado arriba)
if (tocaMercado) {
  if (hm && maxFichas > 0) {
    // fase 2: una página por equipo y por jugador. Si falla, el mercado sale igual (con los enlaces de ayer)
    try {
      const H = await hechosFichas(api, hm, { estado: estado.fichas || {}, max: maxFichas, log });
      if (H) {
        H.previa = (hm.proxima && previas().find((p) => p.jornada === hm.proxima.jornada)) || previas()[0] || null;
        // (sesión 3, idea 12) los onces probables, antes de pintar las fichas de equipo (llevan el suyo)
        if (hm.proxima) {
          try {
            const partes = await lesionados({ log }).catch(() => []);
            H.onces = hechosOnces(H, { J: hm.proxima.jornada, jugadores, partes, previo: oncesPrevio });
            if (H.onces.equipos.length) {
              guardarOnces(H.onces);
              if (oncesPrevio && oncesPrevio.J === hm.proxima.jornada - 1) { const a = aciertoDe(oncesPrevio); if (a) estado.oncesAcierto = { ...(estado.oncesAcierto || {}), [oncesPrevio.J]: a }; }
              escribirPagina(metasOnces(H.onces.J), contenidoOnces(H.onces, { rutas: H.rutas, previa: H.previa && H.previa.jornada === H.onces.J ? H.previa.ruta : null, aciertos: estado.oncesAcierto || {}, jugadores }));
              log(`Onces: ${H.onces.equipos.length} equipos de la J${H.onces.J}, ${H.onces.equipos.reduce((s2, y) => s2 + y.dudas.length, 0)} dudas`);
            }
          } catch (err) { log(`::warning::Onces sin hacer: ${err.stack || err.message}`); }
        }
        // (rework de la web, 21 nov) ficha para todos: qué fichas entran hoy en el sitemap (unas pocas por noche) y cuáles hay que
        // reescribir (las que más valen, cada noche; las demás, cuando cambia lo suyo), para que el repo no crezca sin control
        const viejas = new Map((existsSync(FICHAS) ? JSON.parse(readFileSync(FICHAS, 'utf8')).paginas : []).map((p) => [p.ruta, p]));
        const adm = admitirIndexables(H, viejas);
        const qc = fichasQueCambian(H, estado.huellas || {}, { forzar: !!arg('todas'), existe: (r) => existsSync(path.join(RAIZ, 'web', r)) && viejas.has(r) });
        estado.huellas = qc.huellas;
        log(`Fichas de jugador: ${H.jugadores.length}, ${adm.total} indexables (${adm.nuevas} nuevas hoy, ${adm.espera} en espera), ${qc.escribir.length} para reescribir`);
        const pags = [
          ...H.equipos.map((q) => ({ entrada: metasEquipo(q), html: contenidoEquipo(q, H) })),
          ...qc.escribir.map((x) => ({ entrada: metasJugador(x, H), html: contenidoJugador(x, H) })),
          { entrada: metasJugadores(), html: contenidoJugadores(H) },
          ...Array.from({ length: nPaginasJugadores(H) - 1 }, (_, i) => ({ entrada: metasPaginaJugadores(i + 2), html: contenidoJugadores(H, i + 2) })),
        ];
        const n = escribirFichas(pags);
        // el buscador del menú (web/portal/portal.js) y la tira de escudos del pie (la pinta paginas.py)
        const ij = path.join(RAIZ, 'web', 'jugadores', 'indice.json'), ej = path.join(DIR, 'escudos.json');
        const nij = JSON.stringify(indiceBuscador(H)) + '\n', nej = JSON.stringify(escudosPie(H), null, 1) + '\n';
        // la tabla de todos con JS (web/portal/portal.js)
        const tj = path.join(RAIZ, 'web', 'jugadores', 'todos.json'), ntj = JSON.stringify(jugadoresJson(H)) + '\n';
        if (!existsSync(tj) || readFileSync(tj, 'utf8') !== ntj) { writeFileSync(tj, ntj); cambios = true; }
        if (!existsSync(ij) || readFileSync(ij, 'utf8') !== nij) { writeFileSync(ij, nij); cambios = true; }
        if (!existsSync(ej) || readFileSync(ej, 'utf8') !== nej) { writeFileSync(ej, nej); cambios = true; }
        estado.fichas = H.slugs;
        rutas = H.rutas;
        hm.nFichas = H.jugadores.length;
        if (n) cambios = true;
        log(`Fichas: ${H.equipos.length} equipos y ${H.jugadores.length} jugadores (${n} páginas cambiadas)`);
      }
    } catch (err) { log(`::warning::Fichas sin hacer: ${err.stack || err.message}`); }
  }
  if (hm) {
    const prox = hm.proxima;
    const pv = prox && previas().find((p) => p.jornada === prox.jornada);
    const rs = resumenes()[0] || null;
    // (sesión 4, idea 4) la previsión de mañana: la de ayer se compara con lo de hoy y se guarda la nueva (30 días de acierto)
    const ac = acierto(estado.prevision, hm);
    if (ac) { estado.aciertos = [...(estado.aciertos || []).filter((a) => a.dia !== ac.dia), ac].slice(-60); log(`Previsión de ayer: ${ac.sOk}/${ac.sN} subidas y ${ac.bOk}/${ac.bN} bajadas`); }
    const prev = prevision(hm);
    if (!estado.prevision || estado.prevision.dia !== prev.dia || forzar) estado.prevision = prev;
    escribirPagina({ ruta: 'mercado/index.html', seccion: 'mercado', titulo: 'Mercado de LaLiga Fantasy hoy: quién sube y quién baja',
      h1: 'Mercado de LaLiga Fantasy hoy', descripcion: `Los jugadores que más suben y bajan hoy en el mercado de LaLiga Fantasy, las rachas, los que están en su máximo y la semana, con el valor de cada uno. Se pone al día cada noche.` },
    contenidoMercado(hm, { previa: pv ? pv.ruta : null, resumen: rs, rutas, prev, aciertos: estado.aciertos || [] }));
    escribirPagina({ ruta: 'equipos/index.html', seccion: 'equipos', titulo: 'Equipos de LaLiga Fantasy: valor de cada plantilla',
      h1: 'Equipos de LaLiga Fantasy', descripcion: 'Lo que vale la plantilla de cada uno de los 20 equipos en el mercado de LaLiga Fantasy, cuánto gana o pierde cada día y su jugador más caro.' },
    contenidoEquipos(hm, { rutas, jugadores: hm.nFichas || null }));
    writeFileSync(path.join(RAIZ, 'web', 'mercado', 'hoy.json'), JSON.stringify(hoyJson(hm, { previa: pv ? pv.ruta : null, resumen: rs, rutas })) + '\n');
    estado.mercado = { dia: hm.dia, hecho: Date.now() };
    cambios = true;
    log(`Mercado del ${hm.dia}: ${hm.nSuben} suben, ${hm.nBajan} bajan; el que más sube, ${hm.suben[0].nombre}`);
  }
} else log(`Mercado del ${hoy}: ya hecho`);

// 3. la página de las jornadas: siempre (cambia con cada previa y cada resumen)
const prox = hm ? hm.proxima : await proximaJornada(api).catch(() => null);
const rs = resumenes();
const ult = rs[0] && estado.resumenes[rs[0].jornada] ? { jornada: rs[0].jornada, mejores: estado.resumenes[rs[0].jornada].mejores } : null;
const pj = path.join(RAIZ, 'web', 'jornada', 'index.html');
const antes = existsSync(pj) ? readFileSync(pj, 'utf8') : '';
escribirPagina({ ruta: 'jornada/index.html', seccion: 'jornada', titulo: 'Jornadas de LaLiga Fantasy: previas y resúmenes',
  h1: 'Jornadas de LaLiga Fantasy', descripcion: 'La próxima jornada de LaLiga Fantasy con su cierre de cláusulas, y la previa y el resumen de cada jornada: mejores, peores, once ideal y MVP de cada partido.' },
contenidoJornadas({ proxima: prox, previas: previas(), resumenes: rs, ultimo: ult }));

// 4. el calendario de cláusulas (clausulas/): siempre, porque cambia cada día (lo que queda hasta el cierre y la protección de un fichaje de hoy)
try {
  const hc = await hechosClausulas(api);
  if (hc) {
    const pc = path.join(RAIZ, 'web', 'clausulas', 'index.html');
    const antesC = existsSync(pc) ? readFileSync(pc, 'utf8') : '';
    const pvC = hc.siguiente && previas().find((p) => p.jornada === hc.siguiente.J);
    escribirPagina(metasClausulas(), contenidoClausulas(hc, { previa: pvC || null }));
    if (antesC !== readFileSync(pc, 'utf8')) cambios = true;
    log(`Cláusulas: próximo cierre ${hc.siguiente ? `J${hc.siguiente.J}, ${hc.cambios} cambios de mercado` : 'sin fecha'}`);
  }
} catch (err) { log(`::warning::Cláusulas sin hacer: ${err.stack || err.message}`); }

// 5. las bajas de la jornada (bajas/, sesión 4 de AdSense): con el mercado de esta noche (el valor y la racha de cada uno), una vez por día
if (hm) {
  try {
    const hb = await hechosBajas(api, hm, { rutas, log });
    if (hb) {
      const pvB = previas().find((p) => p.jornada === hb.jornada) || null;
      escribirPagina(metasBajas(hb), contenidoBajas(hb, { previa: pvB }));
      // (22 nov) lo que lee la app para la hoja de las bajas: aparte, con el id de LaLiga (bajas/ va en SOLO_WEB: no entra en el paquete)
      const pp = partesJson(hb);
      writeFileSync(path.join(RAIZ, 'web', 'bajas', 'partes.json'), JSON.stringify(pp) + '\n');
      cambios = true;
      log(`Bajas: jornada ${hb.jornada}, ${hb.bajas.length} lesionados, ${hb.dudas.length} dudas, ${hb.sancionados.length} sancionados, ${hb.apercibidos.length} apercibidos; partes.json con ${Object.keys(pp.j).length} de ${hb.partesApp.length}`);
    }
  } catch (err) { log(`::warning::Bajas sin hacer: ${err.stack || err.message}`); }
}

writeFileSync(fEstado, JSON.stringify(estado, null, 1) + '\n');
execFileSync('python3', [path.join(RAIZ, '.github', 'paginas.py')], { stdio: 'inherit' });
const despues = readFileSync(pj, 'utf8');
if (antes !== despues) cambios = true;
salida('cambios', cambios ? 'true' : 'false');
