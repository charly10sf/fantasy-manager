// Prueba (3 nov, rediseño de las tarjetas): baja de LaLiga, sin token, todo lo que necesitan las tarjetas de final y de
// jugador de los partidos acabados de una jornada y lo deja en la carpeta que lee bot/prueba/tarjetas-ejemplo.mjs --datos.
//   node .github/pruebas/volcar-tarjetas.mjs --jornada=11 --salida=datos
import { writeFileSync, mkdirSync } from 'node:fs';
import { datosFinal, datosJugador } from '../../bot/lib/datos-tarjetas.mjs';
import * as LL from '../../bot/lib/laliga.mjs';

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const jornada = Number(arg('jornada') || 11);
const dir = arg('salida') || 'datos';
for (const d of ['fichas', 'valor', 'img']) mkdirSync(`${dir}/${d}`, { recursive: true });

const [stats, jugadores] = await Promise.all([LL.statsSemana(jornada), LL.jugadores()]);
const equipos = new Map();
for (const m of stats) for (const e of [m.local, m.visitor]) equipos.set(String(e.id), { id: e.id, badgeColor: e.badgeColor });
const porEscudo = new Map([...equipos.values()].map((e) => [e.badgeColor, e.id]));
writeFileSync(`${dir}/stats.json`, JSON.stringify(stats));
writeFileSync(`${dir}/jugadores.json`, JSON.stringify(jugadores));
writeFileSync(`${dir}/equipos.json`, JSON.stringify([...equipos.values()]));

const fuentes = {
  ficha: async (id) => { const f = await LL.ficha(id); writeFileSync(`${dir}/fichas/${id}.json`, JSON.stringify(f)); return f; },
  valor: async (id) => { const v = await LL.valorMercado(id); writeFileSync(`${dir}/valor/${id}.json`, JSON.stringify(v)); return v; },
  imagen: async (url) => {
    const b = await LL.imagen(url);
    if (b) {
      const p = String(url).match(/\/p(\d+)\//);
      if (p) writeFileSync(`${dir}/img/cara-${p[1]}.png`, b);
      else if (porEscudo.has(url)) writeFileSync(`${dir}/img/escudo-${porEscudo.get(url)}.png`, b);
    }
    return b;
  },
};
const porId = new Map(jugadores.map((j) => [String(j.id), j]));
let n = 0;
for (const m of stats.filter((x) => x.matchState === 7)) {
  await datosFinal(m, { jornada, fuentes });
  // el MVP y los 2 siguientes de cada partido, para tener varias tarjetas de jugador donde elegir
  const top = [...m.local.players, ...m.visitor.players].sort((a, b) => b.weekPoints - a.weekPoints).slice(0, 3);
  for (const p of top) if (porId.has(String(p.id))) await datosJugador(porId.get(String(p.id)), m, { jornada, motivo: 'mvp', fuentes });
  n++;
}
console.log(`VOLCADO jornada ${jornada}: ${n} partidos acabados`);
