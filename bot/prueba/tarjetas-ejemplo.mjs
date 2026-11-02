// Tarjetas de ejemplo con datos reales, sin publicar nada: dibuja la de final y la de jugador (MVP) de varios partidos, las
// valida y deja los PNG en --salida.
//   node bot/prueba/tarjetas-ejemplo.mjs --jornada=11 [--partidos=106,105] [--salida=tarjetas]
//        [--datos=carpeta]   (sin --datos, lo pide a LaLiga; con --datos, lo lee de una carpeta: stats.json, jugadores.json,
//                             equipos.json, fichas/<id>.json, valor/<id>.json, img/cara-<id>.png, img/escudo-<idEquipo>.png)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { svgFinal, svgJugador, aPng } from '../lib/tarjetas.mjs';
import { datosFinal, datosJugador, PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';
import { validarTarjeta } from '../lib/validar.mjs';
import * as LL from '../lib/laliga.mjs';

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const jornada = Number(arg('jornada') || 11);
const salida = arg('salida') || 'tarjetas';
const dir = arg('datos');
mkdirSync(salida, { recursive: true });

let stats, jugadores, fuentes;
if (dir) {
  const leer = (f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  stats = leer('stats.json'); jugadores = leer('jugadores.json');
  const equipos = leer('equipos.json');
  const porEscudo = new Map(equipos.map((e) => [e.badgeColor, e.id]));
  const archivo = (f) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`) : null);
  fuentes = {
    ficha: async (id) => leer(`fichas/${id}.json`),
    valor: async (id) => leer(`valor/${id}.json`),
    imagen: async (url) => {
      if (!url) return null;
      const p = url.match(/\/p(\d+)\//);
      if (p) return archivo(`img/cara-${p[1]}.png`);
      return porEscudo.has(url) ? archivo(`img/escudo-${porEscudo.get(url)}.png`) : null;
    },
  };
} else {
  [stats, jugadores] = await Promise.all([LL.statsSemana(jornada), LL.jugadores()]);
  fuentes = { ficha: LL.ficha, valor: LL.valorMercado, imagen: LL.imagen };
}
const quiero = (arg('partidos') || '').split(',').filter(Boolean).map(Number);
const partidos = stats.filter((m) => m.matchState === 7 && (!quiero.length || quiero.includes(Number(m.id))));
const porId = new Map(jugadores.map((j) => [String(j.id), j]));
let fallos = 0;
for (const m of partidos) {
  const F = await datosFinal(m, { jornada, fuentes });
  const mvpId = [...m.local.players, ...m.visitor.players].sort((a, b) => b.weekPoints - a.weekPoints)[0].id;
  const J = await datosJugador(porId.get(String(mvpId)), m, { jornada, motivo: 'mvp', fuentes, ahora: Date.parse('2026-11-02T12:00:00Z') });
  for (const [tipo, svg, perm] of [['final', svgFinal(F.d), F.permitidos], ['jugador', svgJugador(J.d), J.permitidos]]) {
    const v = validarTarjeta(svg, perm, PALABRAS_FIJAS);
    if (!v.ok) { fallos++; console.log(`FALLA ${tipo} ${m.id}: ${v.errores.join('; ')}`); }
    const f = `${salida}/${tipo}-${m.id}.png`;
    writeFileSync(f, await aPng(svg));
    console.log(`${v.ok ? 'ok   ' : 'FALLA'} ${f}`);
  }
  const lado = (x) => `${x.corto} ${x.goles} · mejores ${x.mejores.map((j) => `${j.nombre} ${j.pts}`).join(', ')} · peores ${x.peores.map((j) => `${j.nombre} ${j.pts} (${j.min}')`).join(', ') || '—'}`;
  console.log(`  ${lado(F.d.local)} | ${lado(F.d.visitante)} | MVP ${J.d.nombre} ${J.d.ptsJornada}, valor ${J.d.valorHoy} (${J.d.cambio} % en 30 días)`);
}
process.exit(fallos ? 1 : 0);
