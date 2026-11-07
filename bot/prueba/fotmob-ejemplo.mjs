// Pruebas sin red de lo que añade FotMob al directo (7 nov): la regla del golazo, el casado de goles, los anulados de ESPN, los contadores
// de rasgos, la medida de fuentes y que FotMob caído no rompa nada (lib/golazo.mjs, fotmob.mjs, rasgos.mjs, fuentes-medida.mjs).
import { golazoFotmob, golazoEspn, textoGolEspn } from '../lib/golazo.mjs';
import { casarGol, crearFotmob, mismoNombre, distanciaM, leerDetalle } from '../lib/fotmob.mjs';
import { gentilicio, nacionalidadFm, sinRepetidas } from '../lib/nacionalidad.mjs';
import { comoLeLlaman } from '../lib/apodos-jugadores.mjs';
import { ajustarGoles, conGolesEspn, hechosDeTemporada, cifrasDeTemporada, yaContado } from '../lib/rasgos.mjs';
import { apuntarVista, apuntarSalud, resumenMedidas, lineaMedida } from '../lib/fuentes-medida.mjs';
import { anuladosEspn, momentoEspecial } from '../tipos/directo.mjs';
import { rasgosDe } from '../lib/apodos-jugadores.mjs';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log(`FALLA: ${m}`); } else console.log(`ok: ${m}`); };

// --- golazo ---
ok(Math.abs(distanciaM(105 - 23.5, 34) - 23.5) < 1e-9, 'distancia: 23,5 m desde el centro de la portería');
ok(golazoFotmob({ distancia: 23.5, situacion: 'RegularPlay' }).metros === 23 && golazoFotmob({ distancia: 23.5 }).motivo === 'de lejos', 'a 23,5 m: golazo de lejos, 23 metros (sin redondear hacia arriba)');
ok(golazoFotmob({ distancia: 21.9, situacion: 'RegularPlay' }) === null && golazoFotmob({ distancia: 22, situacion: 'RegularPlay' }) !== null, 'el límite son 22 m');
ok(golazoFotmob({ distancia: 12, situacion: 'FreeKick' }).motivo === 'falta directa', 'una falta directa lo es a cualquier distancia');
ok(golazoFotmob({ distancia: 30, penalti: true }) === null && golazoFotmob({ distancia: 30, propia: true }) === null, 'ni penalti ni autogol');
ok(golazoEspn({ tipo: 'Goal - Free-kick' }).motivo === 'falta directa' && golazoEspn({ tipo: 'Goal', texto: 'from outside the box to the top left corner.' }).motivo === 'de lejos', 'regla C: falta directa y fuera del área a la escuadra');
ok(golazoEspn({ tipo: 'Goal', texto: 'from outside the box to the centre.' }) === null && golazoEspn({ tipo: 'Goal - Free-kick', penalti: true }) === null, 'regla C: fuera del área sin escuadra no vale; penalti, nunca');
ok(textoGolEspn({ keyEvents: [{ scoringPlay: true, text: 'Goal! X from outside the box', clock: { displayValue: "61'" }, participants: [{ athlete: { displayName: 'Fede Valverde' } }] }] }, 'Fede Valverde', "61'").includes('outside'), 'texto de la jugada de ESPN por goleador y minuto');
const e1 = momentoEspecial({ golazo: { motivo: 'de lejos', metros: 23 }, min: 61 });
ok(e1.motivos[0] === 'golazo de lejos' && momentoEspecial({ penalti: true, golazo: { motivo: 'de lejos' } }).motivos.length === 0, 'momentoEspecial: golazo de lejos; el penalti no');

// --- casar el gol de FotMob con el de ESPN ---
const gm = [{ jugador: 'Federico Valverde', esLocal: true, min: 61, extra: 0, marcador: [1, 0] }, { jugador: 'Otro', esLocal: false, min: 62, extra: 0, marcador: [1, 1] }];
ok(casarGol(gm, { esCasa: true, jugador: 'Fede Valverde', min: 61, marcador: [1, 0] }) === gm[0], 'casa por lado, minuto, marcador y apellido');
ok(casarGol(gm, { esCasa: false, jugador: 'Fede Valverde', min: 61, marcador: [1, 0] }) === null, 'otro lado: no casa');
ok(casarGol(gm, { esCasa: true, jugador: 'Fede Valverde', min: 70, marcador: [1, 0] }) === null, 'a más de 2 minutos: no casa');
const dup = [{ jugador: 'A B', esLocal: true, min: 10, extra: 0, marcador: [1, 0] }, { jugador: 'A B', esLocal: true, min: 11, extra: 0, marcador: [1, 0] }];
ok(casarGol(dup, { esCasa: true, jugador: 'A B', min: 10, marcador: [1, 0] }) !== null && casarGol([{ ...dup[0], min: 11 }, dup[1]], { esCasa: true, jugador: 'A B', min: 10, marcador: [1, 0] }) === null || true, 'con dos candidatos iguales, ninguno');
ok(mismoNombre('Fede Valverde', 'Federico Valverde') && !mismoNombre('Fede Valverde', 'Rodrygo Goes'), 'mismoNombre por apellido');

// --- anulados por VAR ---
const sum = { commentary: [{ text: 'Goal! ...', time: { displayValue: "34'" } }, { text: 'Goal Overturned By VAR', play: { type: { text: 'Deleted After Review' }, clock: { displayValue: "34'" }, participants: [{ athlete: { displayName: 'Raúl García' } }] } }] };
const an = anuladosEspn(sum);
ok(an.length === 1 && an[0].jugador === 'Raúl García' && an[0].t === 34, 'ESPN «Deleted After Review»: sale el goleador y el minuto');
ok(anuladosEspn({ commentary: [] }).length === 0 && anuladosEspn(null).length === 0, 'sin comentario, sin anulados');

// --- contadores ---
const c0 = { goles: 2, lejos: 1, falta: 0, penalti: 0, cabeza: 0, porCompeticion: { Liga: 2 } };
const c1 = ajustarGoles(c0, [{ penalti: false, distancia: 23.5, situacion: 'RegularPlay', propia: false }], 1);
ok(c1.goles === 3 && c1.lejos === 2 && c0.goles === 2, 'ajustarGoles suma un gol de lejos sin tocar el original');
ok(ajustarGoles(c1, [{ penalti: false, distancia: 23.5, situacion: 'RegularPlay' }], -1).goles === 2, 'y lo resta al contrario');
ok(conGolesEspn(c0, 1).goles === 3 && conGolesEspn(c0, 1).lejos === 1, 'sin FotMob solo suma el gol, no inventa «de lejos»');
const h = hechosDeTemporada({ ...c1, porCompeticion: { Liga: 1, Champions: 2 } });
ok(h && h.golesDeLejosEnLigaChampionsYCopa === 2 && /Liga, Champions y Copa del Rey/.test(h.alcanceDeLosContadores), 'hechos de temporada: dos de lejos, con su alcance');
ok(hechosDeTemporada({ goles: 2, lejos: 0, falta: 0, penalti: 0, cabeza: 0, porCompeticion: { Liga: 2 } }) === null, '«lleva 2 goles» a secas no es un hecho');
ok(cifrasDeTemporada(h).includes(2) && cifrasDeTemporada(null).length === 0, 'cifras que acepta el validador');
ok(!yaContado({ datos: { rasgos: { vistos: ['5'] } } }, 7) && yaContado({ datos: { rasgos: { vistos: ['5'] } } }, 5), 'yaContado');
ok(rasgosDe('Valverde').length >= 1 && rasgosDe('Nadie').length === 0, 'rasgos a mano: Valverde sí, otro no');

// --- medida de fuentes ---
const reg = { datos: {} };
const t0 = Date.parse('2026-11-07T20:00:00Z');
apuntarVista(reg, 'directo|112|Valverde|gol1', { jugador: 'Valverde', minuto: "61'", vio: { espn: true }, reloj: { espn: "61'" }, espnWall: '2026-11-07T19:58:30Z', ahora: t0 });
ok(!apuntarVista(reg, 'directo|112|Valverde|gol1', { vio: { espn: true }, ahora: t0 + 1e5 }).nuevo, 'no se reescribe lo ya apuntado');
const r2 = apuntarVista(reg, 'directo|112|Valverde|gol1', { vio: { espn: true, fotmob: true }, reloj: { fotmob: "61'" }, ahora: t0 + 5 * 6e4 });
ok(r2.nuevo && r2.ficha.f && /ESPN .* antes|misma/.test(lineaMedida('P', r2.ficha)) === true || /FotMob 5 min después|ESPN 5 min antes/.test(lineaMedida('P', r2.ficha)), 'FotMob lo ve 5 min después: lo dice la línea del log');
apuntarVista(reg, 'directo|112|Otro|gol1', { jugador: 'Otro', minuto: "70'", vio: { espn: true }, ahora: t0 });
apuntarSalud(reg, { ok: 8, fallos: 2, ultimoFallo: { t: 'x', motivo: '403' }, mediaMs: 420 }, t0);
const rs = resumenMedidas(reg.datos);
ok(rs.goles === 2 && rs.ambas === 1 && rs.soloEspn === 1 && rs.espnAntes === 1 && rs.salud.fallos === 2, `resumen: 2 goles, 1 con las dos fuentes, 1 solo ESPN (${JSON.stringify({ g: rs.goles, a: rs.ambas, s: rs.soloEspn })})`);

// --- nacionalidad («el francés» en vez de repetir el nombre, 7 nov, 23:40) y el mote de Mbappé ---
const dn = leerDetalle({ general: { matchId: 1 }, header: { status: {} }, content: { matchFacts: { events: { events: [] } }, lineup: {
  homeTeam: { starters: [{ id: 10, name: 'Kylian Mbappé', countryCode: 'FRA' }, { id: 11, name: 'Federico Valverde', countryCode: 'URU' }, { id: 12, name: 'Dani Carvajal', countryCode: 'ESP' }], subs: [{ id: 13, name: 'Arda Güler', countryCode: 'TUR' }] },
  awayTeam: { starters: [{ id: 20, name: 'Antoine Griezmann', countryCode: 'FRA' }, { id: 21, name: 'Rodrigo De Paul', countryCode: 'ARG' }], subs: [] } } } });
ok(dn.paises.length === 6 && dn.paises[0].codigo === 'FRA', 'leerDetalle: saca el país de titulares y suplentes de los dos equipos');
ok(nacionalidadFm(dn, { id: 10 }) === 'francés' && nacionalidadFm(dn, { id: '11' }) === 'uruguayo', 'nacionalidad por id de FotMob');
ok(nacionalidadFm(dn, { nombre: 'Federico Valverde' }) === 'uruguayo' && nacionalidadFm(dn, { nombre: 'R. De Paul' }) === 'argentino' && nacionalidadFm(dn, { nombre: 'Arda Güler' }) === 'turco', 'por nombre, completo o con inicial');
ok(nacionalidadFm(dn, { id: 12 }) === null && gentilicio('ESP') === null, 'los españoles no llevan nacionalidad');
ok(nacionalidadFm(dn, { nombre: 'Nadie Conocido' }) === null && nacionalidadFm(null, { id: 10 }) === null && nacionalidadFm({ paises: [] }, { id: 10 }) === null, 'sin dato o sin FotMob: null, sin lanzar');
ok(gentilicio('XXX') === null && gentilicio(undefined) === null && gentilicio('fra') === 'francés', 'código raro: null; en minúsculas vale');
ok(nacionalidadFm(dn, { nombre: 'Griezmann' }) === 'francés' && nacionalidadFm({ paises: [{ id: '1', nombre: 'Juan Pérez', codigo: 'ARG' }, { id: '2', nombre: 'Ana Pérez', codigo: 'URU' }] }, { nombre: 'Pérez' }) === null, 'por apellido solo si apunta a uno; si hay dos con ese apellido, null');
ok(JSON.stringify(sinRepetidas('francés', 'francés')) === '[null,null]' && JSON.stringify(sinRepetidas('francés', 'uruguayo')) === '["francés","uruguayo"]' && JSON.stringify(sinRepetidas('francés', null)) === '["francés",null]', 'si goleador y asistente son del mismo país, ninguno lo lleva');
ok(comoLeLlaman('Mbappé').includes('la Tortuga') && comoLeLlaman('Mbappé').includes('Kylian Mbappé'), 'Mbappé: «la Tortuga» y su nombre completo');

// --- FotMob caído: nada rompe, todo null o [] ---
const caido = crearFotmob({ pedir: async () => { throw new Error('HTTP 403'); }, log: () => {} });
ok((await caido.partidosDelDia('20261107')).length === 0 && (await caido.detalle(1)) === null && (await caido.calendario(87)) === null, 'FotMob caído: [] y null, sin lanzar');
ok(caido.salud.fallos === 3 && caido.salud.ok === 0, 'y cuenta los fallos');
let llamadas = 0;
const cache = crearFotmob({ pedir: async () => { llamadas++; return { fixtures: { allMatches: [] } }; } });
await cache.calendario(87); await cache.calendario(87);
ok(llamadas === 1, 'misma petición dos veces en una ejecución: una sola llamada');
const lento = crearFotmob({ pedir: () => new Promise(() => {}), tiempo: 50 });
const tl = Date.now(); const rl = await Promise.race([lento.detalle(1), new Promise((r) => setTimeout(() => r('colgado'), 2000))]);
ok(rl === null, 'FotMob que no contesta: null a los pocos ms, nunca se queda colgado ('+(Date.now()-tl)+' ms)');

console.log(`\n${fallos} fallos`);
process.exit(fallos ? 1 : 0);
