// Rediseño premium (3 nov): la tarjeta de jugador en las dos direcciones nuevas («carta» y «oro») y la de ahora («noche»),
// con datos reales guardados (la carpeta que deja .github/pruebas/volcar-tarjetas.mjs). No publica nada.
//   node bot/prueba/premium-ejemplo.mjs --datos=carpeta --jornada=11 [--jugadores=Lamine Yamal,Mario Soriano] [--salida=premium]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { svgJugador, aPng } from '../lib/tarjetas.mjs';
import { svgJugadorCarta, svgJugadorOro, aPngPremium, FIJAS_PREMIUM } from '../lib/tarjetas-premium.mjs';
import { datosJugador, PALABRAS_FIJAS } from '../lib/datos-tarjetas.mjs';
import { validarTarjeta } from '../lib/validar.mjs';

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const dir = arg('datos'), jornada = Number(arg('jornada') || 11), salida = arg('salida') || 'premium';
mkdirSync(salida, { recursive: true });
const leer = (f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
const stats = leer('stats.json'), jugadores = leer('jugadores.json'), equipos = leer('equipos.json');
const porEscudo = new Map(equipos.map((e) => [e.badgeColor, e.id]));
const archivo = (f) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`) : null);
const fuentes = {
  valor: async (id) => leer(`valor/${id}.json`),
  imagen: async (url) => {
    if (!url) return null;
    const p = url.match(/\/p(\d+)\//);
    if (p) return archivo(`img/cara-${p[1]}.png`);
    return porEscudo.has(url) ? archivo(`img/escudo-${porEscudo.get(url)}.png`) : null;
  },
};
const quiero = (arg('jugadores') || 'Lamine Yamal,Mario Soriano,Grimaldo,Danjuma').split(',');
let fallos = 0;
for (const nombre of quiero) {
  const j = jugadores.find((x) => x.nickname === nombre);
  const m = j && stats.find((x) => [...x.local.players, ...x.visitor.players].some((p) => String(p.id) === String(j.id)));
  if (!m) { console.log(`no está: ${nombre}`); continue; }
  const J = await datosJugador(j, m, { jornada, motivo: 'mvp', fuentes, ahora: Date.parse('2026-11-02T12:00:00Z') });
  const slug = nombre.toLowerCase().replace(/[^a-z]+/g, '-');
  for (const [tipo, svg, png] of [['noche', svgJugador(J.d), aPng], ['carta', svgJugadorCarta(J.d), aPngPremium], ['oro', svgJugadorOro(J.d), aPngPremium]]) {
    const v = validarTarjeta(svg, J.permitidos, [...PALABRAS_FIJAS, ...FIJAS_PREMIUM]);
    if (!v.ok) { fallos++; console.log(`FALLA ${tipo} ${nombre}: ${v.errores.join('; ')}`); }
    writeFileSync(`${salida}/${slug}-${tipo}.png`, await png(svg));
  }
  console.log(`${nombre}: ${J.d.ptsJornada} pts, media ${J.d.media}, valor ${J.d.valorHoy} (${J.d.cambio} %)`);
}
process.exit(fallos ? 1 : 0);
