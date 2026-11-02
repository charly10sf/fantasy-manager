// Pega las tarjetas con imagen a los tweets: decide qué tarjeta lleva cada uno, la dibuja con datos de LaLiga, la valida y la
// pasa a PNG. Solo se carga si alguna tarjeta está encendida en config.json (`tarjetas`) o con --tarjetas=1 en simulacro.
//   final   -> tarjeta de final de partido (si tarjetas.final)
//   mvp     -> tarjeta de jugador del MVP (si tarjetas.jugador)
//   directo -> tarjeta de jugador en dobletes y tripletes (si tarjetas.jugador)
// Lo que no pasa el validador no sale: el tweet del final se publica entonces sin imagen y el del MVP no se publica.
import { svgFinal, svgJugador, aPng } from './tarjetas.mjs';
import { datosFinal, datosJugador, PALABRAS_FIJAS } from './datos-tarjetas.mjs';
import { validarTarjeta } from './validar.mjs';
import * as LL from './laliga.mjs';

const fuentesLaLiga = { ficha: LL.ficha, valor: LL.valorMercado, imagen: LL.imagen };

/** [{ nombre, png, svg, ok, errores }] para un tweet (vacío si no lleva tarjeta) */
export async function tarjetasDe(t, { stats, jugadores, jornada, config, forzar = false, fuentes = fuentesLaLiga }) {
  const cfg = config.tarjetas || {};
  const m = stats.find((x) => String(x.id) === String(t.partido));
  if (!m) return [];
  const hechas = [];
  const hacer = async (nombre, { d, permitidos }, svg) => {
    const v = validarTarjeta(svg, permitidos, PALABRAS_FIJAS);
    hechas.push({ nombre, svg, ok: v.ok, errores: v.errores, png: v.ok ? await aPng(svg) : null });
  };
  if (t.tipo === 'final' && (cfg.final || forzar)) {
    const x = await datosFinal(m, { jornada, fuentes });
    await hacer(`final-${m.id}`, x, svgFinal(x.d));
  }
  if ((t.tipo === 'mvp' || (t.tipo === 'directo' && t.motivo)) && t.jugadorId != null && (cfg.jugador || forzar)) {
    const j = jugadores.find((x) => String(x.id) === String(t.jugadorId));
    if (j) {
      const x = await datosJugador(j, m, { jornada, motivo: t.motivo || 'mvp', fuentes });
      await hacer(`${t.tipo}-${m.id}-${j.id}`, x, svgJugador(x.d));
    }
  }
  return hechas;
}
