// Lo que gasta «Quién usa la app» (/hola/todos) con muchas cuentas (0.8.4). El plan gratis de Cloudflare da 10 ms de CPU por
// petición, al Worker y al objeto. Mide por separado lo que hace el objeto («todos» en quien.js, con SQLite de verdad) y lo
// que hace el Worker con su respuesta (pegarle las invitaciones y el embudo), con 1.000 cuentas de mentira y 7 días de uso
// de cada una (lo peor: todas activas toda la semana).
// Uso: node worker/prueba/mide-quien.mjs [cuentas=1000] [vueltas=30]. Sale con 1 si la mediana del objeto pasa de 10 ms.
import { almacen } from './objeto.mjs';
import { quienObjeto, diasAtras } from '../src/quien.js';

const N = Number(process.argv[2]) || 1000, VUELTAS = Number(process.argv[3]) || 30;
const { storage, db, filas } = almacen();
const memo = {};
const ahora = Date.now(), dia = new Date(ahora).toISOString().slice(0, 10), dias7 = diasAtras(dia, 7);
await quienObjeto(storage, null, { op: 'copiar', fase: 'u', filas: [], siguiente: 'hecho', ahora, dia }, memo);
const fi = db.prepare('INSERT INTO ficha (uid, ultima, foto, d) VALUES (?, ?, ?, ?)');
const re = db.prepare('INSERT INTO reg (uid, ultima, d) VALUES (?, ?, ?)');
const us = db.prepare('INSERT INTO uso (uid, dia, seg, t) VALUES (?, ?, ?, ?)');
db.exec('BEGIN');
for (let i = 0; i < N; i++) {
  const uid = String(100000 + i);
  const d = { uid, nombre: `Mánager número ${i}`, equipo: `C.A.D. Equipo «${i}»`, liga: '12345678', v: '0.8.3a', canal: i % 10 ? 'play' : 'web', app: 9001, primera: ahora - 40 * 864e5, ultima: ahora - i * 60e3, n: 57, foto: `https://assets-fantasy.llt-services.com/avatars/${uid}.png`, ...(i % 10 ? {} : { disp: 'web-iphone' }), ...(i % 7 ? {} : { bv: ahora - 9e8 }) };
  fi.run(uid, d.ultima, d.foto, JSON.stringify(d));
  re.run(uid, ahora - 864e5, JSON.stringify({ uid, primera: d.primera, ultima: ahora - 864e5, dia: dias7[1], canales: d.canal, dias: 20, ev: { [dias7[6]]: { p: 3, q: 2, b: 1, t: 4 }, [dias7[0]]: { p: 1 } }, tot: { p: 30, q: 9, b: 7, t: 12, l: 2 } }));
  for (const dd of dias7) us.run(uid, dd, 600 + i, ahora);
}
db.exec('COMMIT');
const med = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const cpu = (f) => { const c = process.cpuUsage(); const x = f(); const d = process.cpuUsage(c); return [x, (d.user + d.system) / 1000]; };
const tObj = [], tWor = [];
let txt = '', leidas = 0;
for (let v = 0; v < VUELTAS; v++) {
  const l0 = filas.leidas, c = process.cpuUsage();
  txt = await quienObjeto(storage, null, { op: 'todos', ahora, dia }, memo);
  const d = process.cpuUsage(c);
  tObj.push((d.user + d.system) / 1000); leidas = filas.leidas - l0;
  // el Worker: pegarle lo de las invitaciones y el embudo (unos KB), sin volver a leer lo del objeto
  const inv = { lista: Array.from({ length: 50 }, (_, i) => ({ uid: String(i), entran: 2, cuentan: 1 })) }, emb = { dias: Array.from({ length: 60 }, () => ({ ver: 10 })) };
  const [, tw] = cpu(() => `${txt.slice(0, -1)},"embudo":${JSON.stringify(emb)},"invitar":${JSON.stringify(inv)},"tiempos":{"fin":3}}`);
  tWor.push(tw);
}
const j = JSON.parse(txt);
console.log(`${N} cuentas, ${VUELTAS} vueltas: el objeto ${med(tObj).toFixed(2)} ms de CPU (mediana; la más lenta ${Math.max(...tObj).toFixed(2)}), el Worker ${med(tWor).toFixed(2)} ms; ${leidas} filas leídas por apertura; respuesta de ${Math.round(txt.length / 1024)} KB; ${j.lista.length} en la lista y ${j.registro.length} en el registro`);
if (med(tObj) > 10) { console.log('MAL  el objeto pasa de 10 ms'); process.exitCode = 1; }
