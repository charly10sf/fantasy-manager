// Tweets largos con X Premium (lib/largo.mjs), sin red: cuándo se escriben largos, cuándo se vuelve a 280 y que con 280 las
// plantillas salen igual que antes.  node bot/prueba/largo-ejemplo.mjs
import { decidirLargo, rechazoPorLargo } from '../lib/largo.mjs';
import { fijarLimite, limite, largo, peso, esEtiquetaFinal } from '../lib/texto.mjs';
import { tweet } from '../lib/redactar.mjs';
import { maxDe, prompt } from '../lib/pulir.mjs';
import { validar } from '../lib/validar.mjs';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };
const config = { tweetMax: 280, largo: { activo: true, max: 1000, reintentarHoras: 24 } };
const ahora = Date.parse('2026-11-05T10:00:00Z');
const reg = (t) => ({ datos: t ? { largoRechazado: { t } } : {} });

ok(decidirLargo({ config, registro: reg(), env: {}, ahora }).largo === true, 'con Premium y sin rechazos: largo');
ok(decidirLargo({ config, registro: reg(), env: {}, ahora }).max === 1000, 'el máximo largo sale de config.largo.max');
ok(decidirLargo({ config: { ...config, largo: { activo: false } }, registro: reg(), env: {}, ahora }).largo === false, 'largo.activo = false: 280');
ok(decidirLargo({ config: { tweetMax: 280 }, registro: reg(), env: {}, ahora }).largo === false, 'sin largo en config: 280');
ok(decidirLargo({ config, registro: reg(), env: { BOT_LARGO: 'no' }, ahora }).largo === false, 'BOT_LARGO=no: 280');
ok(decidirLargo({ config, registro: reg(), env: { BOT_LARGO: 'si' }, ahora }).largo === true, 'BOT_LARGO=si: largo');
ok(decidirLargo({ config, registro: reg('2026-11-05T02:00:00Z'), env: {}, ahora }).largo === false, 'rechazo hace 8 h: 280');
ok(decidirLargo({ config, registro: reg('2026-11-04T09:00:00Z'), env: {}, ahora }).largo === true, 'rechazo hace 25 h: se vuelve a probar');
ok(decidirLargo({ config, registro: null, env: {}, ahora }).largo === true, 'sin registro (simulacro): largo');

ok(rechazoPorLargo({ estado: 403, cuerpo: '{"detail":"You are not permitted to create a Tweet with this length."}' }), '403 por el largo');
ok(rechazoPorLargo({ estado: 400, cuerpo: '{"errors":[{"message":"Tweet text is too long"}]}' }), '400 «too long»');
ok(!rechazoPorLargo({ estado: 403, cuerpo: 'You are not allowed to create a Tweet with duplicate content.' }), 'un duplicado no es por largo');
ok(rechazoPorLargo({ estado: 403, cuerpo: '{"title":"Forbidden","status":403}' }), 'un 403 sin explicación, en un tweet largo, cuenta como rechazo por largo');
ok(!rechazoPorLargo({ estado: 400, cuerpo: '{"errors":[{"message":"Your media IDs are invalid."}]}' }), 'un 400 por la imagen no es por el largo');
ok(!rechazoPorLargo({ estado: 401, cuerpo: 'Unauthorized' }), 'un 401 no es por largo');
ok(!rechazoPorLargo({ estado: 429, cuerpo: 'Too Many Requests' }), 'un 429 no es por largo');

// las plantillas: con 280, las ideas de prio baja se quedan fuera como siempre; con el límite largo, entran
const cab = '🚨 El Villarreal se queda sin dos titulares para la jornada 12';
const ideas = [
  { t: 'Se caen por lesión I. Akhomach y Foyth', prio: 9 },
  { t: 'Foyth, molestias musculares: duda para la jornada 12', prio: 7 },
  { t: 'El que más pesa es I. Akhomach: 4,8 puntos de media', prio: 6 },
  { t: 'I. Akhomach había sido titular en 4 de los 5 últimos partidos y Foyth en los 5', prio: 2 },
  { t: 'El Villarreal juega el sábado a las 18:30 contra el Getafe, y luego el miércoles en Champions', prio: 1 },
  { t: '❌ Baja para la jornada 12 contra el Getafe', prio: 8 },
];
fijarLimite(280);
const corto = tweet(cab, ideas);
ok(limite() === 280 && !largo(), 'fijarLimite(280): corto');
ok(peso(corto.texto) <= 280, `con 280 cabe en 280 (${peso(corto.texto)})`);
ok(!corto.usadas.some((t) => /Champions/.test(t)), 'con 280, la idea de prio 1 se queda fuera');
fijarLimite(1000);
const lar = tweet(cab, ideas);
ok(largo() && limite() === 1000, 'fijarLimite(1000): largo');
ok(lar.usadas.length === ideas.length, `con 1000 entran todas las ideas (${lar.usadas.length})`);
ok(peso(lar.texto) > 280 && peso(lar.texto) <= 1000, `el largo pasa de 280 (${peso(lar.texto)})`);
ok(validar(lar.texto, { numeros: [12, 4, 8, 5, 18, 30], max: limite() }).ok, 'el largo pasa el validador con el límite largo');
ok(!validar(lar.texto, { numeros: [12, 4, 8, 5, 18, 30], max: 280 }).ok, 'y no pasaría con 280');
ok(lar.texto.split('\n\n').every((b, i) => i === 0 || /[.!?…:]$/.test(b) || esEtiquetaFinal(b)), 'los párrafos de después del titular acaban en punto (menos la etiqueta)');
console.log(`\n${lar.texto}\n`);

// Gemini: con tweets largos puede alargar un poco (para unir frases), nunca pasar del límite
fijarLimite(280);
ok(maxDe('x'.repeat(200)) === 210 && maxDe('x'.repeat(275)) === 270, 'pulir con 280: el suyo + 10, sin pasar de 270');
ok(/nunca lo alargues/.test(prompt(['hola'])), 'pulir con 280: «nunca lo alargues»');
fijarLimite(1000);
ok(maxDe('x'.repeat(200)) === 240 && maxDe('x'.repeat(500)) === 600 && maxDe('x'.repeat(990)) === 980, 'pulir largo: +20 % (30 como poco), sin pasar de 980');
ok(/unas palabras más/.test(prompt(['hola'])) && !/nunca lo alargues/.test(prompt(['hola'])), 'pulir largo: puede usar unas palabras más');
fijarLimite(280);
console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
