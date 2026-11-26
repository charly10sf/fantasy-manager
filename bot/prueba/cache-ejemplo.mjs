// Prueba sin red de la caché de 1 hora del bot (26 nov, claude/prompt-cache-bot.md del proyecto):
//   - redactar manda las instrucciones en dos bloques de `system` (la guía y los ejemplos del tipo), los dos con `ttl: '1h'`, y juntos
//     son, carácter a carácter, el mismo texto de antes (`${GUIA}\n\nEJEMPLOS (…):\n\n${ejemplosPara(tipo)}`);
//   - con un solo tuit también lleva la caché; el editor (lib/revisor.mjs), también a 1 hora;
//   - con `ia.cacheTTL: "5m"`, la marca de siempre, sin `ttl`, y redactar con un solo tuit sin caché, como antes;
//   - coste() cobra lo escrito a 5 min y a 1 hora a su precio; estimarCoste reserva las instrucciones a lo de escribir 1 hora.
// Las peticiones van a un `fetch` de mentira que guarda el cuerpo. Uso: node bot/prueba/cache-ejemplo.mjs (sale con 1 si algo falla)
import { readFileSync } from 'node:fs';
import { coste, PRECIOS, SONNET, HAIKU, bloquesSistema } from '../lib/claude.mjs';
import { preguntar, estimarCoste, ttlCache, textoSistema, CARACTERES_POR_TOKEN } from '../lib/ia.mjs';
import { redactar, sistemaDe, sistemaBloques } from '../lib/redaccion.mjs';
import { revisarConIA, SISTEMA as SISTEMA_REVISOR } from '../lib/revisor.mjs';
import { GUIA, ejemplosPara } from '../lib/voz.mjs';
import { fijarLimite } from '../lib/texto.mjs';
import { clubes } from '../lib/hechos.mjs';

let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'BIEN' : 'MAL '} ${m}`); if (!c) fallos++; };
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
fijarLimite(1000);
process.env.BOT_IA = 'claude';
process.env.ANTHROPIC_API_KEY = 'clave-de-mentira';

// --- el texto: el mismo de antes, repartido en dos bloques ---
const antes = (tipo) => `${GUIA}\n\nEJEMPLOS (jugadores inventados: sirven por la forma; no copies frases ni datos):\n\n${ejemplosPara(tipo)}`;
const tipos = [...new Set([...(config.redactar.tipos || []), 'otro-que-no-existe'])];
ok(tipos.every((t) => sistemaDe(t) === antes(t) && sistemaBloques(t).join('') === antes(t)), `los dos bloques juntos son el texto de antes, en los ${tipos.length} tipos`);
ok(tipos.every((t) => sistemaBloques(t).length === 2 && sistemaBloques(t)[0] === GUIA), 'el primer bloque es la guía, la misma para todos los tipos');
ok(tipos.every((t) => ejemplosPara(t) === ejemplosPara(t) && sistemaBloques(t)[1] === sistemaBloques(t)[1]), 'los ejemplos de un tipo salen siempre iguales (no rompen la caché)');
ok(!/\d{4}-\d{2}-\d{2}|\b20\d\d\b.*\d{1,2}:\d\d/.test(sistemaBloques('directo')[1].slice(0, 200)), 'el principio del bloque de ejemplos no lleva fechas');

// --- el fetch de mentira ---
const cuerpos = [];
const usoFalso = { input_tokens: 900, output_tokens: 120, cache_creation_input_tokens: 4800, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 4800 } };
const fetchFalso = (datos) => async (url, op) => {
  cuerpos.push(JSON.parse(op.body));
  return { status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(datos) }], usage: usoFalso, stop_reason: 'end_turn' }) };
};
const hechos = { tipo: 'noticias', noticia: 'Eric vuelve a la convocatoria', fuente: 'prensa: AS, MARCA',
  jugadores: [{ nombre: 'Eric', puesto: 'defensa', club: 'Barça', estado: 'disponible', mediaPuntos: '5,6', titularidad: '37 %', principal: true }],
  partido: { jornada: 12, partido: 'Atlético-Barça', local: 'Atlético', visitante: 'Barça', juega: 'fuera', rival: 'el Atlético', cuando: 'el domingo a las 21:00' },
  clubes: clubes('Barça', 'Atlético'), etiqueta: '✅ Disponible para la jornada 12 contra el Atlético' };
const revisorOk = async () => ({ ok: true, problemas: [], revisado: true, modelo: SONNET });
const conCfg = (ia = {}, red = {}) => ({ ...config, ia: { ...config.ia, ...ia }, redactar: { ...config.redactar, activo: true, intentos: 1, ...red } });
async function unTuit(cfg, tipo = 'noticias', n = 1) {
  cuerpos.length = 0;
  const reg = { datos: { enviados: [], recientes: {} }, fichero: 'prueba.json', guardar() {} };
  const xs = Array.from({ length: n }, (_, i) => ({ tipo, clave: `c${i}`, texto: '✅ plantilla', numeros: [12], hechos: { ...hechos, tipo } }));
  await redactar(xs, { tipo, registro: reg, config: cfg, jugadores: [{ nickname: 'Eric' }], equipos: { 1: 'FC Barcelona', 2: 'Atlético de Madrid' }, log: () => {},
    pedir: (op) => preguntar({ ...op, pedir: fetchFalso({ texto: 'Eric vuelve a la lista del Barça para el domingo, según AS y MARCA.', cronicas: [] }) }), revisor: revisorOk });
  return cuerpos.filter((c) => Array.isArray(c.system) && c.system.length === 2);
}

// 1 hora (lo de config.json)
ok(ttlCache(config) === '1h' && ttlCache({}) === '1h' && ttlCache({ ia: { cacheTTL: '5m' } }) === '5m', 'config.json lleva 1 hora; sin ia.cacheTTL, 1 hora; con "5m", 5 min');
let cs = await unTuit(conCfg());
const c0 = cs[0];
ok(cs.length >= 1, `redactar con un solo tuit pregunta con dos bloques de system (${cs.length} preguntas)`);
ok(c0 && c0.system.every((b) => b.type === 'text' && b.cache_control && b.cache_control.type === 'ephemeral' && b.cache_control.ttl === '1h'), 'los dos bloques llevan su marca de caché de 1 hora, también con un solo tuit');
ok(c0 && c0.system.map((b) => b.text).join('') === antes('noticias') && c0.system[0].text === GUIA, 'lo que llega a la IA, junto, es el texto de antes; el primero, la guía');
ok(c0 && !JSON.stringify(c0.messages).includes(GUIA.slice(0, 80)) && /HECHOS/.test(c0.messages[0].content), 'lo que cambia (los hechos) va en el mensaje, no en el system');
ok(c0 && c0.output_config && c0.output_config.format.type === 'json_schema' && c0.output_config.effort === 'medium', 'el esquema y el esfuerzo siguen fuera del system, como antes');
// un final y un directo comparten el primer bloque byte a byte
const fin = (await unTuit(conCfg(), 'final'))[0];
ok(fin && JSON.stringify(fin.system[0]) === JSON.stringify(c0.system[0]) && fin.system[1].text !== c0.system[1].text, 'el bloque de la guía es idéntico en otro tipo (un final lee lo que dejó otro); los ejemplos cambian');

// 5 minutos: como antes
cs = await unTuit(conCfg({ cacheTTL: '5m' }));
ok(cs[0] && cs[0].system.every((b) => !('cache_control' in b)), 'con "5m" y un solo tuit, redactar va sin caché, como antes');
cs = await unTuit(conCfg({ cacheTTL: '5m' }), 'noticias', 2);
ok(cs[0] && cs[0].system.every((b) => b.cache_control && b.cache_control.type === 'ephemeral' && !('ttl' in b.cache_control)), 'con "5m" y dos tuits, la marca de siempre, sin ttl');
cs = await unTuit(conCfg({}, { cacheSiempre: false }));
ok(cs[0] && cs[0].system.every((b) => !('cache_control' in b)), 'redactar.cacheSiempre a false manda (la prueba A/B lo usa)');

// el editor
cuerpos.length = 0;
await revisarConIA({ texto: 'Eric vuelve.', hechos, tipo: 'noticias', registro: { datos: {} }, config: conCfg(), pedir: (op) => preguntar({ ...op, pedir: fetchFalso({ publicable: true, problemas: [] }) }) });
ok(cuerpos[0] && cuerpos[0].system.length === 1 && cuerpos[0].system[0].text === SISTEMA_REVISOR && cuerpos[0].system[0].cache_control.ttl === '1h', 'el editor: su sistema de siempre, a 1 hora');
cuerpos.length = 0;
await revisarConIA({ texto: 'Eric vuelve.', hechos, tipo: 'noticias', registro: { datos: {} }, config: conCfg({ cacheTTL: '5m' }), pedir: (op) => preguntar({ ...op, pedir: fetchFalso({ publicable: true, problemas: [] }) }) });
ok(cuerpos[0] && cuerpos[0].system[0].cache_control && !('ttl' in cuerpos[0].system[0].cache_control), 'el editor con "5m": la marca de siempre');
// un texto suelto (clasificar, pulir, la previa web) sigue igual: un bloque, sin marca si no se pide
ok(JSON.stringify(bloquesSistema('guía')) === JSON.stringify([{ type: 'text', text: 'guía' }]) && bloquesSistema('').length === 0 && bloquesSistema(['a', '', 'b'], true, '1h').length === 2, 'un texto suelto, un bloque como antes; los vacíos no se mandan');

// --- el precio ---
const S = PRECIOS[SONNET], H = PRECIOS[HAIKU];
ok(S.cacheEscribe1h === 4 && S.cacheEscribe === 2.5 && H.cacheEscribe1h === 0.2 && H.cacheEscribe === 0.125, 'precios: escribir 1 hora el doble de la entrada (Sonnet 4 $, Haiku 0,20 $) y 5 min 1,25 veces');
const u = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 3000, cache_creation_input_tokens: 1500, cache_creation: { ephemeral_5m_input_tokens: 500, ephemeral_1h_input_tokens: 1000 } };
const esperado = (1000 * 2 + 100 * 10 + 3000 * 0.10 + 500 * 2.5 + 1000 * 4) / 1e6;
ok(Math.abs(coste(SONNET, u) - esperado) < 1e-12, `coste(): 5 min y 1 hora, cada uno a su precio (${coste(SONNET, u).toFixed(6)} $)`);
ok(Math.abs(coste(SONNET, { cache_creation_input_tokens: 1000 }) - 0.0025) < 1e-12 && Math.abs(coste(SONNET, { cache_creation_input_tokens: 1000 }, '1h') - 0.004) < 1e-12, 'sin desglose, lo escrito a la duración pedida (5 min por defecto, como antes)');
ok(Math.abs(coste(HAIKU, { cache_creation_input_tokens: 1000, cache_creation: { ephemeral_1h_input_tokens: 1000 } }) - 0.0002) < 1e-12, 'Haiku: 1.000 escritos a 1 hora, 0,0002 $');
// la respuesta de preguntar: dólares con el desglose y el uso con la suma, como siempre
const r = await preguntar({ uso: 'redactar', registro: { datos: {} }, config: conCfg(), prompt: 'x', esquema: { type: 'OBJECT' }, sistema: sistemaBloques('noticias'), cache: true, pedir: fetchFalso({ texto: 'a' }) });
// la guía real, contada a 2 caracteres por token, no se queda corta (5.554 tokens medidos el 26 nov)
ok(Math.ceil(GUIA.length / CARACTERES_POR_TOKEN) >= 5554, `la reserva cuenta la guía en ${Math.ceil(GUIA.length / CARACTERES_POR_TOKEN)} tokens (medidos: 5.554)`);
ok(r.ok && r.uso.cacheEscribe === 4800 && Math.abs(r.dolares - (900 * 2 + 120 * 10 + 4800 * 4) / 1e6) < 1e-12, `preguntar: cacheEscribe es la suma y los dólares, a 1 hora (${r.dolares} $)`);
// la reserva de antes de preguntar: las instrucciones a lo de escribir 1 hora (lo más caro), el resto como siempre
const sis = sistemaBloques('final'), pr = 'p'.repeat(3500);
const sinC = estimarCoste({ modelo: SONNET, prompt: pr, sistema: sis, uso: 'redactar', config: conCfg() });
const conC = estimarCoste({ modelo: SONNET, prompt: pr, sistema: sis, uso: 'redactar', config: conCfg(), cache: true });
const con5 = estimarCoste({ modelo: SONNET, prompt: pr, sistema: sis, uso: 'redactar', config: conCfg({ cacheTTL: '5m' }), cache: true });
const instr = Math.ceil(textoSistema(sis).length / CARACTERES_POR_TOKEN);
ok(sinC === estimarCoste({ modelo: SONNET, prompt: pr, sistema: sistemaDe('final'), uso: 'redactar', config: conCfg() }), 'sin caché, la estimación de siempre (con el texto o con los bloques)');
ok(Math.abs(conC - (Math.ceil(3500 / CARACTERES_POR_TOKEN) * 2 + instr * 4 + 700 * 10) / 1e6) < 1e-6 && conC > sinC && con5 < conC && con5 > sinC, `con caché de 1 hora se reserva más (${sinC} → ${conC} $; a 5 min, ${con5} $)`);

console.log(fallos ? `\n${fallos} MAL` : '\nTodo BIEN');
process.exit(fallos ? 1 : 0);
