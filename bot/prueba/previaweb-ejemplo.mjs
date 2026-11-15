// Prueba sin red de la previa de la web (bot/previa-web.mjs y bot/web/): cuándo toca, el validador, la redacción con un Claude falso
// (un apartado que se inventa una cifra se queda sin análisis), la página y el tuit con el enlace.
import assert from 'node:assert/strict';
import { toca } from '../web/toca.mjs';
import { validar, permitidasDe, escribir } from '../web/texto.mjs';
import { vista } from '../web/vista.mjs';
import { contenido } from '../web/pagina.mjs';
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
};
const v = vista(h);
assert.match(v.clausulas.cierre, /jueves 19 de noviembre a las 21:00/);
const ctx = { permitidas: permitidasDe(v), nombresHechos: new Set(['gaya', 'zabiri', 'rodri', 'fermin', 'moleiro']), nombresLiga: [['mbappe', 'Mbappé'], ['fermin', 'Fermín']] };
assert.equal(validar('Fermín ha sumado 19,4 M en siete días.', ctx), '');
assert.match(validar('Fermín ha sumado 21,4 M en siete días.', ctx), /cifra/);
assert.match(validar('Mbappé también sube.', ctx), /jugador/);
assert.match(validar('Cabe destacar que Rodri baja.', ctx), /prohibida/);

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
