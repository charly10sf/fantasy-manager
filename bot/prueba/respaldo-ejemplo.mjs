// Pruebas sin red de «la plantilla solo como último recurso» (lib/respaldo.mjs) y de las marcas que deja lib/redaccion.mjs.
import { aplicaRedaccion, decidirRespaldo, olvidarFallos, porFallos, ejecucionesDe } from '../lib/respaldo.mjs';
import { redactar } from '../lib/redaccion.mjs';
import { fijarLimite } from '../lib/texto.mjs';
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
fijarLimite(1000);
process.env.ANTHROPIC_API_KEY = 'prueba';
const reg = () => ({ datos: { enviados: [] }, fichero: null, guardar() {} });
const t0 = Date.parse('2026-11-08T12:00:00Z');

// qué tipos se redactan
const cfg = { redactar: { activo: true, tipos: ['final', 'caidas'], ejecuciones: { defecto: 3, mercado: 5, directo: 1 } } };
ok(aplicaRedaccion('final', cfg) && aplicaRedaccion('caidas', cfg) && !aplicaRedaccion('lloros', cfg), 'solo se redactan los tipos de la lista');
ok(!aplicaRedaccion('final', { redactar: { activo: false, tipos: ['final'] } }), 'con redactar.activo apagado, nada se redacta');
ok(aplicaRedaccion('final', { redactar: { activo: false, tipos: ['final'] } }, { forzar: true }), 'forzado, sí');
ok(ejecucionesDe('mercado', cfg) === 5 && ejecucionesDe('final', cfg) === 3 && ejecucionesDe('directo', cfg) === 1, 'las ejecuciones fallidas que aguanta cada tipo');

// una redacción rechazada: espera dos ejecuciones y a la tercera sale con la plantilla
let r = reg();
const tw = () => ({ tipo: 'final', clave: 'final|1', redaccion: 'rechazada' });
let d = decidirRespaldo(tw(), { registro: r, config: cfg, ahora: t0 });
ok(!d.sale && /1 de 3/.test(d.motivo) && r.datos.fallosRedaccion['final|1'].n === 1, 'primer fallo: espera y lo cuenta');
d = decidirRespaldo(tw(), { registro: r, config: cfg, ahora: t0 + 5 * 60e3 });
ok(!d.sale && /2 de 3/.test(d.motivo), 'segundo fallo: espera');
d = decidirRespaldo(tw(), { registro: r, config: cfg, ahora: t0 + 10 * 60e3 });
ok(d.sale && /3 ejecuciones/.test(d.motivo), 'tercer fallo: sale con la plantilla');

// el directo: una sola ejecución
d = decidirRespaldo({ tipo: 'directo', clave: 'directo|1', redaccion: 'rechazada' }, { registro: reg(), config: cfg, ahora: t0 });
ok(d.sale, 'el directo no espera: a la primera sale el texto de siempre');

// caduca: onces antes del saque
const saque = t0 + 30 * 60e3;
d = decidirRespaldo({ tipo: 'onces', clave: 'onces|1', redaccion: 'rechazada', caduca: saque }, { registro: reg(), config: cfg, ahora: saque - 20 * 60e3 });
ok(!d.sale, 'a 20 min del saque aún espera');
d = decidirRespaldo({ tipo: 'onces', clave: 'onces|1', redaccion: 'rechazada', caduca: saque }, { registro: reg(), config: cfg, ahora: saque - 3 * 60e3 });
ok(d.sale && /caduca/.test(d.motivo), 'a 3 min del saque sale con la plantilla');

// sin Claude o sin cupo: no se espera; sin tiempo o sin intentar: se espera sin contar
d = decidirRespaldo({ tipo: 'final', clave: 'f2', redaccion: 'sin-ia' }, { registro: reg(), config: cfg, ahora: t0 });
ok(d.sale, 'sin Claude o con el tope de gasto: sale con la plantilla');
r = reg();
d = decidirRespaldo({ tipo: 'final', clave: 'f3', redaccion: 'sin-tiempo' }, { registro: r, config: cfg, ahora: t0 });
ok(!d.sale && !r.datos.fallosRedaccion.f3, 'sin tiempo en la ejecución: espera y no cuenta como fallo');
d = decidirRespaldo({ tipo: 'final', clave: 'f4' }, { registro: r, config: cfg, ahora: t0 });
ok(!d.sale, 'sin intentar (más tuits que cupo por ejecución): espera');
d = decidirRespaldo({ tipo: 'final', clave: 'f5', redaccion: 'ia-no' }, { registro: reg(), config: cfg, ahora: t0 });
ok(!d.sale, 'la API no contesta: se cuenta y espera');

// olvidar
r = reg(); r.datos.fallosRedaccion = { a: { n: 2, t: new Date(t0).toISOString(), ultima: new Date(t0).toISOString() }, b: { n: 1, t: new Date(t0 - 100 * 36e5).toISOString() } };
olvidarFallos(r, 'a', t0);
ok(!r.datos.fallosRedaccion.a && !r.datos.fallosRedaccion.b, 'al publicar se olvida su cuenta y se tiran las de más de 3 días');

// el orden: primero los que menos fallos llevan
r = reg(); r.datos.fallosRedaccion = { x: { n: 2 }, y: { n: 0 } };
ok(porFallos([{ clave: 'x' }, { clave: 'y' }, { clave: 'z' }], r).map((t) => t.clave).join() === 'y,z,x', 'los atascados van al final');

// lo que deja redactar() en cada tuit
const hechos = (n) => ({ tipo: 'final', jugadores: [{ nombre: `Iker Saldaña${n}`, principal: true }], clubes: {}, etiqueta: '' });
const mal = async () => ({ ok: true, modelo: 'm', datos: { texto: 'Un texto @con mención' } });
let tws = [{ tipo: 'final', clave: 'a', texto: 'p', hechos: hechos(1) }];
await redactar(tws, { tipo: 'final', config: { ...config, redactar: { ...config.redactar, activo: true, tipos: ['final'], intentos: 1 } }, pedir: mal, log: () => {}, forzar: true });
ok(tws[0].redaccion === 'rechazada', 'un texto que no pasa el validador deja redaccion = rechazada');
tws = [{ tipo: 'final', clave: 'a', texto: 'p', hechos: hechos(1) }];
await redactar(tws, { tipo: 'final', config: { ...config, redactar: { ...config.redactar, activo: true, tipos: ['final'] } }, pedir: async () => ({ ok: false, error: 'tope de 1,5 $ hoy (1.6 $ gastados)' }), log: () => {}, forzar: true });
ok(tws[0].redaccion === 'sin-ia', 'el tope de gasto deja redaccion = sin-ia');
tws = [{ tipo: 'final', clave: 'a', texto: 'p', hechos: hechos(1) }];
await redactar(tws, { tipo: 'final', config: { ...config, redactar: { ...config.redactar, activo: true, tipos: ['final'] } }, pedir: async () => ({ ok: false, error: 'HTTP 529' }), log: () => {}, forzar: true });
ok(tws[0].redaccion === 'ia-no', 'un error de la API deja redaccion = ia-no');

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
