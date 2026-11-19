import { jugadores, ficha, semanaActual } from '../../bot/lib/laliga.mjs';
import fs from 'fs';
const js = await jugadores();
console.log('jugadores', js.length);
fs.writeFileSync('jugadores.json', JSON.stringify(js));
const xs = js.filter(j => j.positionId >= 1 && j.positionId <= 4);
const out = {};
let i = 0;
async function run(j){ try { out[j.id] = await ficha(j.id); } catch(e){ } if(++i%100==0) console.log(i); }
const cola = [...xs];
await Promise.all(Array.from({length:6}, async () => { while (cola.length) await run(cola.shift()); }));
fs.writeFileSync('fichas.json', JSON.stringify(out));
console.log('fichas', Object.keys(out).length);
try { console.log(JSON.stringify(await semanaActual())); } catch(e){ console.log('semana', e.message) }
