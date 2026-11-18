// La previa de cada jornada en la web (guias/jornada-N.html). Lo lanza .github/workflows/previa-web.yml, que a su vez lanza el bot
// (bot.yml) cuando toca: unas 72 h antes del primer partido (el borrador) y unas 30 h antes (los datos al día antes del cierre).
//   node bot/previa-web.mjs --toca                     ¿toca ahora? escribe «borrador», «refresco» o nada (y sale)
//   node bot/previa-web.mjs [--jornada=13] [--forzar=1] [--textos=archivo.json] [--sin-ia=1]
// Genera los hechos (web/hechos.mjs), el texto (web/texto.mjs: Claude, el validador y el revisor; o el de --textos, que pasa el mismo
// validador), .github/previas/N.json, la página y su entrada en .github/paginas.json, y ejecuta .github/paginas.py. Escribe en
// $GITHUB_OUTPUT ok (true si se puede publicar sola), jornada y ruta. Git lo hace la Action.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hechosJornada } from './web/hechos.mjs';
import { toca } from './web/toca.mjs';
import { escribir, validar, permitidasDe } from './web/texto.mjs';
import { vista } from './web/vista.mjs';
import { contenido, metas } from './web/pagina.mjs';
import { semanaActual, statsSemana, jugadores as pedirJugadores } from './lib/laliga.mjs';
import { norm } from './lib/texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : (process.argv.includes(`--${k}`) ? '1' : null); };
const HORA = 36e5;
const salida = (k, v) => { if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`, { flag: 'a' }); };
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
/** el JSON como lo escribe la gente en paginas.json: objetos abiertos y listas de cadenas en una línea */
const bonito = (x, ind = '') => {
  const sub = `${ind}  `;
  if (Array.isArray(x)) return x.every((v) => v === null || typeof v !== 'object') ? `[${x.map((v) => JSON.stringify(v)).join(', ')}]` : `[\n${x.map((v) => sub + bonito(v, sub)).join(',\n')}\n${ind}]`;
  if (x && typeof x === 'object') { const e = Object.entries(x); return e.length ? `{\n${e.map(([k, v]) => `${sub}${JSON.stringify(k)}: ${bonito(v, sub)}`).join(',\n')}\n${ind}}` : '{}'; }
  return JSON.stringify(x);
};
const DIR = path.join(RAIZ, '.github', 'previas');

/** la jornada que viene y la hora de su primer partido */
async function proxima() {
  const sem = await semanaActual();
  let J = sem.weekNumber, st = await statsSemana(J);
  if (st.some((m) => m.matchState !== 1)) { J = sem.nextWeek; st = await statsSemana(J); }
  const ts = st.map((m) => Date.parse(m.date)).filter(Number.isFinite);
  return ts.length ? { J, primero: Math.min(...ts) } : null;
}

if (arg('toca')) {
  // --estado=<archivo>: lo ya lanzado, para no lanzarlo otra vez si la Action no llega a subir nada (lo guarda el bot en bot-estado)
  const p = await proxima();
  const f = p && path.join(DIR, `${p.J}.json`);
  const generada = f && existsSync(f) ? json(f).hechos.generada : null;
  let r = p ? toca({ primero: p.primero, generada }) : '';
  const fe = arg('estado');
  const est = fe && existsSync(fe) ? json(fe) : {};
  if (r && (est[p.J] || []).includes(r)) { console.log(`(ya lanzada: ${r} de la jornada ${p.J})`); r = ''; }
  if (r && fe && arg('apuntar')) { est[p.J] = [...(est[p.J] || []), r]; writeFileSync(fe, JSON.stringify(est) + '\n'); }
  console.log(r);
  salida('toca', r);
  if (p) salida('jornada', String(p.J));
  process.exit(0);
}

const forzar = arg('forzar') === '1';
const h = await hechosJornada({ jornada: arg('jornada') ? Number(arg('jornada')) : null, log: (s) => console.log(s) });
if (!h) { console.log('Sin calendario: nada que hacer'); salida('ok', 'false'); process.exit(0); }
if (Date.now() >= h.cierre && !forzar) { console.log(`Jornada ${h.jornada}: ya han cerrado las cláusulas, no rehago la previa`); salida('ok', 'false'); process.exit(0); }
const J = h.jornada;
const ruta = `guias/jornada-${J}.html`;
console.log(`Jornada ${J}: ${h.sancionados.length} sancionados, ${h.apercibidos.length} apercibidos, ${h.bajas.length} bajas, ${h.dudas.length} dudas, ${h.vuelven.length} vuelven`);

// el texto
const todos = await pedirJugadores();
const nombresLiga = [...new Set(todos.filter((j) => j.playerStatus !== 'out_of_league').map((j) => j.nickname).filter(Boolean))];
let r;
if (arg('textos')) {
  // a mano (la primera, la J13, la escribió Claude en la sesión): pasa el mismo validador de código, sin el revisor
  const textos = json(arg('textos'));
  const v = vista(h);
  const ctx = { permitidas: permitidasDe(v), nombresHechos: new Set(JSON.stringify(v).match(/"nombre":"([^"]+)"/g).map((x) => norm(x.slice(10, -1)))), nombresLiga: nombresLiga.map((n) => [norm(n), n]) };
  const fallos = {};
  for (const [k, t] of Object.entries(textos)) { const m = t ? validar(t, ctx) : ''; if (m) { fallos[k] = m; textos[k] = null; } }
  r = { textos, fallos, dolares: 0, ok: Object.keys(fallos).length === 0, a_mano: true };
} else if (arg('sin-ia') === '1' || !process.env.ANTHROPIC_API_KEY) {
  r = { textos: {}, fallos: { todo: 'sin IA' }, dolares: 0, ok: false };
} else {
  r = await escribir(h, { nombresLiga, log: (s) => console.log(s) });
}
console.log(`Texto: ${Object.values(r.textos).filter(Boolean).length} apartados con análisis; sin él: ${Object.entries(r.fallos).map(([k, m]) => `${k} (${m})`).join(', ') || 'ninguno'}; ${r.dolares} $`);

for (const [k, t] of Object.entries(r.textos)) console.log(`\n[${k}] ${t || '(sin análisis)'}`);

// los archivos
mkdirSync(DIR, { recursive: true });
writeFileSync(path.join(DIR, `${J}.json`), JSON.stringify({ hechos: h, textos: r.textos, fallos: r.fallos, dolares: r.dolares, ok: r.ok }, null, 1) + '\n');
const pj = path.join(RAIZ, '.github', 'paginas.json');
const P = json(pj);
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const m = metas(h);
const vieja = P.paginas.find((p) => p.ruta === ruta);
const entrada = { ruta, tipo: 'guia', grupo: 'jornadas', jornada: J, ...m, fecha: hoy, publicada: (vieja && vieja.publicada) || hoy,
  relacionadas: ['guias/apercibidos-laliga.html', 'guias/blindaje-laliga-fantasy.html', 'guias/cuanto-pujar.html'] };
if (vieja) Object.assign(vieja, entrada); else {
  // las previas van delante de las guías (justo después de las páginas legales)
  const i = P.paginas.findIndex((p) => p.ruta.startsWith('guias/'));
  P.paginas.splice(i < 0 ? P.paginas.length : i, 0, entrada);
}
writeFileSync(pj, bonito(P) + '\n');
const archivo = path.join(RAIZ, 'web', ruta);
// los jugadores con ficha en el portal (bot/portal-web.mjs, fase 2) van enlazados
const fichas = (() => { try { return json(path.join(RAIZ, '.github', 'portal', 'estado.json')).fichas || null; } catch { return null; } })();
const rutas = { jugador: (id) => (fichas && fichas.jugadores && fichas.jugadores[String(id)] ? `jugadores/${fichas.jugadores[String(id)]}.html` : null) };
// (sesión 3, idea 12) los onces probables de esa jornada, si «Portal web» ya los ha hecho (.github/portal/onces.json)
const onces = (() => { try { return json(path.join(RAIZ, '.github', 'portal', 'onces.json')); } catch { return null; } })();
writeFileSync(archivo, `<!-- contenido -->\n${contenido(h, r.textos, { rutas, onces })}\n<!-- /contenido -->\n`);
execFileSync('python3', [path.join(RAIZ, '.github', 'paginas.py')], { stdio: 'inherit' });
salida('ok', r.ok ? 'true' : 'false');
salida('jornada', String(J));
salida('ruta', ruta);
salida('sin_analisis', Object.keys(r.fallos).join(',') || 'ninguno');
