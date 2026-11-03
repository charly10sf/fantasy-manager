// Sondeo para la guía de puntos: baja la ficha de LaLiga de los jugadores que han jugado y cuenta, por posición y por acción,
// qué puntos da cada valor ([valor, puntos] en playerStats). Solo lectura, sin token. Salida: salida/puntos.json y un resumen en el log.
import { writeFileSync, mkdirSync } from 'node:fs';
import { jugadores, ficha } from '../lib/laliga.mjs';
import { enParalelo } from '../lib/http.mjs';
const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
const js = (await jugadores()).filter((j) => j.positionId >= 1 && j.positionId <= 4 && Number(j.points) > 0)
  .sort((a, b) => Number(b.points) - Number(a.points)).slice(0, 420);
console.log(`@@ ${js.length} jugadores`);
const fs = await enParalelo(js, 6, (j) => ficha(j.id).catch(() => null));
const t = {};   // t[pos][clave]["valor"] = { puntos: veces }
const totales = [];   // comprobar que la suma de puntos de la ficha da el total de la jornada
let ejemplo = null;
fs.forEach((f, i) => {
  const j = js[i]; const p = POS[j.positionId];
  if (!f || !Array.isArray(f.playerStats)) return;
  for (const s of f.playerStats) {
    if (!s.stats) continue;
    let suma = 0;
    for (const [k, v] of Object.entries(s.stats)) {
      if (!Array.isArray(v)) continue;
      const [val, pts] = v;
      ((t[p] ||= {})[k] ||= {});
      const key = String(val);
      ((t[p][k][key] ||= {})[pts] = (t[p][k][key][pts] || 0) + 1);
      if (Number.isFinite(pts)) suma += pts;
    }
    totales.push({ id: j.id, n: j.nickname, p, w: s.weekNumber, suma, total: s.totalPoints ?? null });
    if (!ejemplo && p === 'MED' && s.totalPoints >= 10) ejemplo = { jugador: j.nickname, pos: p, jornada: s.weekNumber, total: s.totalPoints, stats: s.stats };
  }
});
mkdirSync('salida', { recursive: true });
writeFileSync('salida/puntos.json', JSON.stringify({ t, ejemplo, claves: Object.keys(fs.find((f) => f && f.playerStats && f.playerStats[0])?.playerStats?.[0] || {}) }, null, 1));
writeFileSync('salida/totales.json', JSON.stringify(totales.slice(0, 3000)));
const iguales = totales.filter((x) => x.total != null && x.total === x.suma).length;
console.log(`@@ jornadas-jugador: ${totales.length}; suma de acciones = total en ${iguales} (con total: ${totales.filter((x) => x.total != null).length})`);
console.log('@@ claves de una entrada:', JSON.stringify(Object.keys(fs.find((f) => f && f.playerStats && f.playerStats[0]).playerStats[0])));
for (const p of Object.keys(t)) for (const k of Object.keys(t[p])) console.log(`@@ ${p} ${k}: ${JSON.stringify(t[p][k]).slice(0, 400)}`);
// portería a cero: con 0 goles encajados, los puntos según los minutos jugados (y si el partido acabó con el jugador en el campo)
const pc = {};
fs.forEach((f, i) => {
  const p = POS[js[i].positionId];
  if (!f || !Array.isArray(f.playerStats)) return;
  for (const s of f.playerStats) {
    const st = s.stats || {}; const gc = st.goals_conceded, mp = st.mins_played;
    if (!gc || !mp) continue;
    const tramo = mp[0] === 0 ? '0' : mp[0] < 60 ? '1-59' : mp[0] < 90 ? '60-89' : '90+';
    const k = `${p} gc=${gc[0]} min ${tramo}`;
    ((pc[k] ||= {})[gc[1]] = (pc[k][gc[1]] || 0) + 1);
    if (gc[0] === 0 && gc[1] > 0 && mp[0] < 60) console.log(`@@ raro: ${js[i].nickname} ${p} J${s.weekNumber} min ${mp[0]} → ${gc[1]}`);
  }
});
for (const k of Object.keys(pc).sort()) if (/gc=[01] /.test(k)) console.log(`@@ ${k}: ${JSON.stringify(pc[k])}`);
