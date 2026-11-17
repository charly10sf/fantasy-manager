// Prueba sin red de la previa de la web (bot/previa-web.mjs y bot/web/): cuándo toca, el validador, la redacción con un Claude falso
// (un apartado que se inventa una cifra se queda sin análisis), la página y el tuit con el enlace.
import assert from 'node:assert/strict';
import { toca } from '../web/toca.mjs';
import { validar, permitidasDe, escribir, revisorSeDesdice } from '../web/texto.mjs';
import { vista } from '../web/vista.mjs';
import { contenido, metas } from '../web/pagina.mjs';
import { generar } from '../tipos/previaweb.mjs';
import { validar as validarTuit } from '../lib/validar.mjs';
import { norm } from '../lib/texto.mjs';

const H = 36e5;
const primero = Date.parse('2026-11-20T20:00:00Z');   // viernes 20 a las 21:00 de Madrid
// cuándo toca
assert.equal(toca({ primero, ahora: primero - 100 * H }), '');
assert.equal(toca({ primero, ahora: primero - 75 * H }), 'borrador');
assert.equal(toca({ primero, generada: primero - 120 * H, ahora: primero - 75 * H }), 'borrador', 'la hecha antes de tiempo se rehace');
assert.equal(toca({ primero, generada: primero - 75 * H, ahora: primero - 70 * H }), '');
assert.equal(toca({ primero, generada: primero - 75 * H, ahora: primero - 33 * H }), 'refresco');
assert.equal(toca({ primero, generada: primero - 33 * H, ahora: primero - 30 * H }), '');
assert.equal(toca({ primero, generada: primero - 75 * H, ahora: primero - 24.4 * H }), '', 'a media hora del cierre, ya no');

const j = (nombre, equipo, extra = {}) => ({ id: nombre, nombre, equipo, pos: 'defensa', media: 4.2, valor: 12.3e6, rival: 'Rayo', casa: true, titularPct: 80, ...extra });
const h = {
  jornada: 13, generada: primero - 75 * H, primero, ultimo: primero + 72 * H, cierre: primero - 24 * H, reapertura: primero,
  partidos: [{ t: primero, local: 'Athletic', visitante: 'Espanyol' }], primerPartido: { t: primero, local: 'Athletic', visitante: 'Espanyol' },
  cambiosAntesDelCierre: [primero - 44.75 * H, primero - 20.75 * H].slice(0, 1), diasDesdeAnterior: 12,
  sancionados: [j('Gayá', 'Valencia', { motivo: 'roja directa' })], apercibidos: [j('Zabiri', 'Racing', { amarillas: 4, rivalSiguiente: 'Levante' })],
  bajas: [j('Rodri', 'Barça', { lesion: 'Lesión en el bíceps femoral', hasta: 'principios de diciembre' })], dudas: [], vuelven: [],
  suben: [{ ...j('Fermín', 'Barça'), valor: 132.2e6, dif7: 19.4e6, pct7: 17.2, diasSubiendo: 25, estado: 'ok' }],
  bajan: [{ ...j('Moleiro', 'Villarreal'), valor: 71.6e6, dif7: -9.6e6, pct7: -11.8, diasBajando: 15, estado: 'ok' }], jugadoresMirados: 300,
  // (sesión 3) los chollos: uno que cumple todo, con una racha larga
  chollos: { criterio: { valor: 6e6, media: 3, racha: 3, ult5: 4 }, mirados: 4, lista: [{ ...j('Niño', 'Málaga'), valor: 4.8e6, media: 6.4, diasSubiendo: 37, ultimoDia: 0.1e6, ult5: 5, nivelRival: 'fácil', prob: 92.2, por: 'sube4' }] },
};
const v = vista(h);
assert.match(v.clausulas.cierre, /jueves 19 de noviembre a las 21:00/);
const ctx = { permitidas: permitidasDe(v), nombresHechos: new Set(['gaya', 'zabiri', 'rodri', 'fermin', 'moleiro']), nombresLiga: [['mbappe', 'Mbappé'], ['fermin', 'Fermín']] };
assert.equal(validar('Fermín ha sumado 19,4 M en siete días.', ctx), '');
assert.match(validar('Fermín ha sumado 21,4 M en siete días.', ctx), /cifra/);
assert.match(validar('Mbappé también sube.', ctx), /jugador/);
assert.match(validar('Cabe destacar que Rodri baja.', ctx), /prohibida/);
// (17 nov) los chollos pueden llevar más frases que el resto
const sieteFrases = 'Rodri baja. Rodri baja. Rodri baja. Rodri baja. Rodri baja. Rodri baja. Rodri baja.';
assert.match(validar(sieteFrases, ctx), /7 frases/);
assert.equal(validar(sieteFrases, { ...ctx, maxFrases: 8 }), '');
// (17 nov) el revisor marcó «no» con motivos que acababan diciendo que no había error: cuentan como sí
assert.ok(revisorSeDesdice('El texto dice «A. Fortuño, del Espanyol, es el único portero de la lista». Revisando mejor: no hay contradicción real.'));
assert.ok(revisorSeDesdice('Es opinión discutible, no un error. No hay error de hecho ni consejo peligroso.'));
assert.ok(revisorSeDesdice('Barrenetxea con vuelta en mayo también cuadra. No hay contradicción.'));
assert.ok(!revisorSeDesdice('El texto dice «Rodri vuelve en enero» y los hechos dicen principios de diciembre.'));
assert.ok(!revisorSeDesdice('No hay contradicción en Rodri, pero Gayá está sancionado y el texto lo alinea.'));
assert.ok(!revisorSeDesdice(''));

// la redacción con un Claude falso: el mercado se inventa una cifra las dos veces y se queda sin análisis; el resto pasa
let preguntas = 0;
const claude = async ({ prompt, esquema }) => {
  preguntas++;
  const claves = Object.keys(esquema.properties);
  if (prompt.startsWith('HECHOS:\n')) return { ok: true, dolares: 0.001, datos: Object.fromEntries(claves.map((k) => [k, { ok: true, motivo: '' }])) };
  const t = { intro: 'Vuelve la liga tras el parón.', clausulas: 'Las cláusulas se cierran el jueves a las 21:00.', sancionados: 'Gayá no juega por la roja directa.',
    apercibidos: 'Zabiri juega con cuatro amarillas.', bajas: 'Rodri sigue de baja hasta principios de diciembre.', mercado: 'Fermín ha sumado 33,3 M.' };
  return { ok: true, dolares: 0.01, datos: Object.fromEntries(claves.map((k) => [k, t[k]])) };
};
const r = await escribir(h, { claude, clave: 'x', nombresLiga: ['Fermín', 'Mbappé'] });
// (sesión 3) los chollos van a la IA con el criterio y lo que suele pasar con su racha
assert.match(v.chollos.criterio, /menos de 6 M/);
assert.match(v.chollos.lista[0].queSuelePasar, /92,2 %/);
assert.ok(permitidasDe(v).has('92,2'), 'la cifra de la racha se puede escribir');
assert.equal(r.textos.mercado, null);
assert.match(r.fallos.mercado, /cifra/);
assert.equal(r.textos.sancionados, 'Gayá no juega por la roja directa.');
assert.ok(r.ok, 'con un apartado sin análisis se publica sola');
assert.equal(preguntas, 3, 'redactar, revisar y un segundo intento del que no valía (que no llega al revisor)');

// la página: HTML sin script, con los datos y el análisis
const html = contenido(h, r.textos);
assert.ok(!/<script/i.test(html));
assert.match(html, /<h1>Jornada 13 de <span>LaLiga Fantasy<\/span><\/h1>/);
assert.match(html, /Gayá no juega por la roja directa/);
assert.match(html, /\+19,4 M/);
assert.match(html, /jueves 19 de noviembre a las 21:00/);
// (sesión 3) chollos con su ancla y el criterio a la vista, sin la misma frase repetida con cada nombre; los onces con su enlace
assert.match(html, /<h2 id="chollos">Chollos de la jornada 13<\/h2>/);
assert.match(html, /valen menos de 6 M, han jugado 60 minutos o más en al menos 4 de sus 5 últimos partidos/);
assert.match(html, /solo el 42,2 % llega a diez/);
assert.match(html, /<h2 id="onces">Onces probables<\/h2>/);
assert.match(html, /jornada\/onces\.html/);
assert.doesNotMatch(html, /De dónde salen los datos|Con Fantasy Manager/, 'lo repetido en todas las previas, a metodo.html');
assert.match(html, /metodo\.html#previas/);
assert.match(metas(h).titulo, /chollos/);
// sin ninguno que cumpla, una frase y nada para la IA
const h0 = { ...h, chollos: { ...h.chollos, lista: [] } };
assert.match(contenido(h0, {}), /ninguno es titular fijo/);
assert.equal(vista(h0).chollos.lista.length, 0);
// con los onces de esa jornada, las dudas más igualadas
const on = { J: 13, equipos: [{ id: '1', nombre: 'Athletic', dudas: [{ linea: 3, a: { nombre: 'Sancet', p: 51 }, b: { nombre: 'Galarreta', p: 45 }, pa: 53 }], cambios: null }] };
assert.match(contenido(h, r.textos, { onces: on }), /Sancet o Galarreta del Athletic \(53\/47\)/);

// el tuit: el enlace va aparte y el texto pasa el validador del bot
const P = { hechos: { ...h, generada: primero - 70 * H }, textos: r.textos };
const ts = await generar({ jornada: 13, ventanas: false, leer: () => P, pedir: async () => ({ ok: true, status: 200, text: async () => 'Jornada 13 de LaLiga Fantasy' }), config: { tweetMax: 280 } });
assert.equal(ts.length, 1);
assert.equal(ts[0].enlace, 'https://fantasymanagerapp.com/guias/jornada-13.html');
assert.ok(validarTuit(ts[0].texto, { numeros: ts[0].numeros, max: 280 }).ok, ts[0].texto);
assert.equal((await generar({ jornada: 13, ventanas: false, leer: () => P, pedir: async () => ({ ok: false, status: 404, text: async () => '' }) })).length, 0, 'sin la página publicada, nada');
assert.equal((await generar({ jornada: 13, ventanas: false, leer: () => P, registro: { claves: new Set(['previaweb|13']) }, pedir: async () => ({ ok: true, text: async () => 'Jornada 13 de' }) })).length, 0, 'una vez por jornada');
console.log('previa de la web: BIEN');
void norm;
