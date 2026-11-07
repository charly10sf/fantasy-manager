// Los números de la medida de fuentes del directo (ESPN frente a FotMob desde Actions): node bot/prueba/medida-fuentes.mjs <registro.json>
// El registro es registro.datos de la rama bot-estado (estado.json). La resolución es una vuelta del bot (5 min): «misma vuelta» no es «a la vez».
import { readFileSync } from 'node:fs';
import { resumenMedidas, lineaMedida } from '../lib/fuentes-medida.mjs';
const f = process.argv[2];
if (!f) { console.log('uso: node bot/prueba/medida-fuentes.mjs <registro.json>'); process.exit(1); }
const datos = JSON.parse(readFileSync(f, 'utf8'));
const r = resumenMedidas(datos.datos || datos);
const pc = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : '—');
console.log(`Goles apuntados: ${r.goles}`);
console.log(`  los ven las dos fuentes: ${r.ambas} (${pc(r.ambas, r.goles)}) · solo ESPN (FotMob aún no): ${r.soloEspn} · solo FotMob: ${r.soloFotmob} · goles que FotMob vio y ESPN nunca: ${r.fotmobSinEspn}`);
console.log(`  de los que ven las dos: FotMob antes ${r.fotmobAntes} · misma vuelta ${r.mismaVuelta} · ESPN antes ${r.espnAntes} · diferencia mediana ${r.medianaDifMin ?? '—'} min`);
console.log(`  ESPN tarda de mediana ${r.medianaEspnTrasJugadaMin != null ? r.medianaEspnTrasJugadaMin.toFixed(1) + ' min' : '—'} desde la hora de la jugada hasta que el bot la ve`);
const s = r.salud;
console.log(s ? `FotMob desde Actions: ${s.ok} peticiones bien, ${s.fallos} mal (${pc(s.fallos, s.ok + s.fallos)}), ${s.ejecucionesConFallo} de ${s.ejecuciones} ejecuciones con algún fallo, ${s.mediaMs} ms de media${s.ultimoFallo ? `, último fallo: ${s.ultimoFallo.motivo}` : ''}` : 'FotMob desde Actions: sin datos todavía');
if (process.argv.includes('--lineas')) for (const [k, v] of Object.entries(datos.datos?.medidaFuentes || datos.medidaFuentes || {})) console.log(lineaMedida(k, v));
