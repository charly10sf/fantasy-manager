// Baja las fichas de jornada y el histórico de valor de todos los jugadores de LaLiga Fantasy (API sin token del bot) para las
// cifras de las guías de porteros, valor de mercado y alineación. Uso, desde esta carpeta: mkdir -p datos && node bajar.mjs
// y luego python3 analisis.py. datos/ no se sube (son unos 15 MB).
import { jugadores, ficha, valorMercado } from '../../bot/lib/laliga.mjs';
import { enParalelo } from '../../bot/lib/http.mjs';
import fs from 'fs';
const js = (await jugadores()).filter((j) => j.playerStatus !== 'out_of_league');
console.log('jugadores', js.length);
const fs1 = await enParalelo(js, 8, (j) => ficha(j.id).catch(() => null));
const vs = await enParalelo(js, 20, (j) => valorMercado(j.id).catch(() => null));
fs.writeFileSync('./datos/fichas.json', JSON.stringify(js.map((j, i) => ({ j, f: fs1[i] }))));
fs.writeFileSync('./datos/valores.json', JSON.stringify(js.map((j, i) => ({ id: j.id, nombre: j.nickname, pos: j.positionId, v: vs[i] }))));
console.log('fichas', fs1.filter(Boolean).length, 'valores', vs.filter(Boolean).length, new Date().toISOString());
