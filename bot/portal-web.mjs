// El portal de datos de la web: el mercado de hoy (/mercado/), los 20 equipos (/equipos/), las jornadas (/jornada/) con el resumen de
// cada una al acabar y lo que lee la portada (mercado/hoy.json). Lo lanza cada noche .github/workflows/portal-web.yml, después del
// cambio de mercado; también a mano:
//   node bot/portal-web.mjs [--forzar=1] [--resumen=12] [--cache=carpeta] [--sin-tarjeta=1]
// --forzar rehace el mercado aunque el valor de hoy no haya llegado (con el último que haya) o ya esté hecho; --resumen rehace el de esa
// jornada; --cache guarda y reutiliza lo bajado de la API (para probar sin pedirlo todo otra vez). Escribe el contenido de cada página,
// su entrada en .github/paginas.json y .github/portal/estado.json, y ejecuta .github/paginas.py. Git lo hace la Action.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as LL from './lib/laliga.mjs';
import { hechosMercado, contenidoMercado, contenidoEquipos, hoyJson, proximaJornada } from './web/mercado.mjs';
import { hechosResumen, contenidoResumen, contenidoJornadas, metasResumen } from './web/resumen.mjs';
import { RAIZ, escribirPagina, paginas, diaMadrid } from './web/portal.mjs';

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
  semanaActual: conCache('actual', LL.semanaActual) };

const DIR = path.join(RAIZ, '.github', 'portal');
mkdirSync(DIR, { recursive: true });
const fEstado = path.join(DIR, 'estado.json');
const estado = existsSync(fEstado) ? JSON.parse(readFileSync(fEstado, 'utf8')) : { mercado: null, resumenes: {} };
let cambios = false;

const previas = () => paginas().filter((p) => p.grupo === 'jornadas' && p.jornada != null).map((p) => ({ ruta: p.ruta, jornada: p.jornada })).sort((a, b) => b.jornada - a.jornada);
const resumenes = () => paginas().filter((p) => p.grupo === 'resumenes' && p.jornada != null).map((p) => ({ ruta: p.ruta, jornada: p.jornada })).sort((a, b) => b.jornada - a.jornada);

// 1. el resumen de la última jornada acabada (o el que se pida). Se rehace mientras no hayan pasado 48 h desde el último partido, por si
// LaLiga corrige puntos (el de DAZN llega tarde): como mucho una vez cada 20 h
const sem = await api.semanaActual();
const jugadores = await api.jugadores();
const candidatas = arg('resumen') ? [Number(arg('resumen'))] : [sem.weekNumber, sem.previousWeek].filter((x) => x > 0);
for (const J of candidatas) {
  const st = await api.statsSemana(J);
  const h = hechosResumen(J, st, jugadores);
  if (!h) { log(`Jornada ${J}: no ha acabado entera, sin resumen`); continue; }
  const ya = estado.resumenes[J];
  const toca = arg('resumen') || !ya || (ya.generada - h.ultimo < 48 * HORA && Date.now() - ya.generada > 20 * HORA);
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
  const pv = previas().find((p) => p.jornada === J), sig = previas().find((p) => p.jornada === J + 1);
  const ruta = `jornada/resumen-jornada-${J}.html`;
  escribirPagina({ ruta, seccion: 'jornada', grupo: 'resumenes', jornada: J, ...metasResumen(J) }, contenidoResumen(h, { previa: pv ? pv.ruta : null, siguiente: sig, tarjeta, tarjetaAlto }));
  estado.resumenes[J] = { generada: h.generada, ultimo: h.ultimo, mejores: h.mejores.slice(0, 3) };
  cambios = true;
  log(`Jornada ${J}: resumen hecho (${h.mejores[0].nombre} ${h.mejores[0].pts})`);
}

// 2. el mercado de hoy y los equipos (una vez por día de mercado)
const hoy = diaMadrid();
let hm = null;
if (forzar || !estado.mercado || estado.mercado.dia !== hoy) {
  hm = await hechosMercado(api, { exigirHoy: !forzar, log });
  if (hm) {
    const prox = hm.proxima;
    const pv = prox && previas().find((p) => p.jornada === prox.jornada);
    const rs = resumenes()[0] || null;
    escribirPagina({ ruta: 'mercado/index.html', seccion: 'mercado', titulo: 'Mercado de LaLiga Fantasy hoy: quién sube y quién baja',
      h1: 'Mercado de LaLiga Fantasy hoy', descripcion: `Los jugadores que más suben y bajan hoy en el mercado de LaLiga Fantasy, las rachas, los que están en su máximo y la semana, con el valor de cada uno. Se pone al día cada noche.` },
    contenidoMercado(hm, { previa: pv ? pv.ruta : null, resumen: rs }));
    escribirPagina({ ruta: 'equipos/index.html', seccion: 'equipos', titulo: 'Equipos de LaLiga Fantasy: valor de cada plantilla',
      h1: 'Equipos de LaLiga Fantasy', descripcion: 'Lo que vale la plantilla de cada uno de los 20 equipos en el mercado de LaLiga Fantasy, cuánto gana o pierde cada día y su jugador más caro.' },
    contenidoEquipos(hm));
    writeFileSync(path.join(RAIZ, 'web', 'mercado', 'hoy.json'), JSON.stringify(hoyJson(hm, { previa: pv ? pv.ruta : null, resumen: rs })) + '\n');
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

writeFileSync(fEstado, JSON.stringify(estado, null, 1) + '\n');
execFileSync('python3', [path.join(RAIZ, '.github', 'paginas.py')], { stdio: 'inherit' });
const despues = readFileSync(pj, 'utf8');
if (antes !== despues) cambios = true;
salida('cambios', cambios ? 'true' : 'false');
