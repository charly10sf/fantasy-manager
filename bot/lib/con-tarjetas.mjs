// Pega las tarjetas con imagen a los tweets: decide qué tarjeta lleva cada uno, la dibuja con datos de LaLiga, la valida y la
// pasa a PNG. Solo se carga si alguna tarjeta está encendida en config.json (`tarjetas`) o con --tarjetas=1 en simulacro.
//   final   -> tarjeta de final de partido (si tarjetas.final)
//   mvp     -> tarjeta de jugador del MVP (si tarjetas.jugador)
//   caidas y novedades -> tarjeta de bajas (de un equipo o en lista), montada por el tipo (si tarjetas.caidas / tarjetas.novedades)
//   onceideal -> la tarjeta del once ideal de la jornada, montada por el tipo (si tarjetas.onceideal)
//   sancionados -> la de bajas de los sancionados y la de apercibidos, separados por equipo (si tarjetas.sancionados)
//   directo -> tarjeta de cada jugador implicado: gol con asistente en una sola (los dos), expulsado o el que falla el penalti (si tarjetas.jugador)
// Lo que no pasa el validador no sale: el tweet del final se publica entonces sin imagen y el del MVP no se publica.
import { svgFinal, svgJugador, svgGolAsistencia, svgResumen, svgOnces, svgOnceIdeal, svgMercado, svgBajas, svgApercibidos, aPng } from './tarjetas.mjs';
import { datosFinal, datosJugador, datosGolAsistencia, historialJugador, PALABRAS_FIJAS } from './datos-tarjetas.mjs';
import { validarTarjeta } from './validar.mjs';
import * as LL from './laliga.mjs';

const fuentesLaLiga = { ficha: LL.ficha, valor: LL.valorMercado, imagen: LL.imagen };

/** [{ nombre, png, svg, ok, errores }] para un tweet (vacío si no lleva tarjeta) */
export async function tarjetasDe(t, { stats, jugadores, jornada, config, forzar = false, fuentes = fuentesLaLiga }) {
  const cfg = config.tarjetas || {};
  const hechas = [];
  const hacer = async (nombre, { d, permitidos }, svg) => {
    const v = validarTarjeta(svg, permitidos, PALABRAS_FIJAS);
    hechas.push({ nombre, svg, ok: v.ok, errores: v.errores, png: v.ok ? await aPng(svg) : null });
  };
  // tarjetas que el propio tipo deja montadas (resumen de la jornada y onces de la previa): aquí solo se bajan las imágenes y se dibujan.
  // `t.tarjeta` puede ser una lista: unas novedades con buenas y malas noticias llevan dos (la verde de los que vuelven y la de bajas)
  const lista = t.tarjeta ? [].concat(t.tarjeta).filter(Boolean) : [];
  if (lista.length && (cfg[t.tipo] ?? cfg[lista[0].tipo] ?? forzar)) {
    for (const tj of lista) await montada(tj);
    return hechas;
  }
  async function montada(tarjeta) {
    const img = (u) => (u ? fuentes.imagen(u).catch(() => null) : null);
    const d = structuredClone(tarjeta.d);
    if (tarjeta.tipo === 'resumen') for (const f of d.filas) { f.cara = await img(f.caraUrl); f.escudo = await img(f.escudoUrl); }
    if (tarjeta.tipo === 'onces') {
      // las caras de los 22, de la lista de jugadores de LaLiga (Carlos, 3 nov 11:47: el once dibujado en el campo)
      const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
      for (const k of ['local', 'visitante']) {
        d[k].escudo = await img(d[k].escudoUrl);
        const caraDe = async (j) => { const p = j.id != null && porId.get(String(j.id)); return p ? img(p.image || (p.images && p.images.transparent && p.images.transparent['256x256'])) : null; };
        for (const j of d[k].once) { j.cara = await caraDe(j); if (j.alt) j.alt.cara = await caraDe(j.alt); }
        for (const j of d[k].suplentes || []) j.cara = await caraDe(j);
      }
    }
    if (tarjeta.tipo === 'bajas') {
      for (const f of d.filas) { f.cara = await img(f.caraUrl); f.escudo = await img(f.escudoUrl); }
      if (d.equipo) d.equipo.escudo = await img(d.equipo.escudoUrl);
      if (d.rival) d.rival.escudo = await img(d.rival.escudoUrl);
    }
    let permitidos = tarjeta.permitidos;
    // la de un solo jugador va en carta: con sus últimas jornadas y su valor, como la del MVP (Carlos, 3 nov 11:24)
    if (tarjeta.tipo === 'bajas' && d.filas.length === 1) {
      const j = (jugadores || []).find((x) => String(x.id) === String(d.filas[0].id));
      if (j) {
        const h = await historialJugador(j, { jornada, fuentes }).catch(() => null);
        if (h) { Object.assign(d.filas[0], h.d); permitidos = { ...permitidos, numeros: [...(permitidos.numeros || []), ...h.numeros] }; }
      }
    }
    if (tarjeta.tipo === 'apercibidos') for (const e of d.equipos) { e.escudo = await img(e.escudoUrl); for (const j of e.jugadores) j.cara = await img(j.caraUrl); }
    if (tarjeta.tipo === 'onceideal') for (const j of d.once) { j.cara = await img(j.caraUrl); j.escudo = await img(j.escudoUrl); }
    if (tarjeta.tipo === 'mercado') for (const f of [...d.suben, ...d.bajan]) { f.cara = await img(f.caraUrl); f.escudo = await img(f.escudoUrl); }
    const dibujo = { resumen: svgResumen, onces: svgOnces, onceideal: svgOnceIdeal, mercado: svgMercado, bajas: svgBajas, apercibidos: svgApercibidos }[tarjeta.tipo] || svgOnces;
    await hacer(tarjeta.nombre, { d, permitidos }, dibujo(d));
  }
  const m = stats.find((x) => String(x.id) === String(t.partido));
  if (!m) return [];
  if (t.tipo === 'final' && (cfg.final || forzar)) {
    const x = await datosFinal(m, { jornada, fuentes });
    await hacer(`final-${m.id}`, x, svgFinal(x.d));
  }
  // tarjetas de jugador: la del MVP, o las de cada jugador implicado en un tweet del directo (goleador, asistente, expulsado…)
  const quienes = t.tipo === 'mvp' ? (t.jugadorId != null ? [{ jugadorId: t.jugadorId, motivo: t.motivo || 'mvp' }] : [])
    : t.tipo === 'directo' ? (t.tarjetas || []) : [];
  if (quienes.length && (cfg.jugador || forzar)) {
    const vistos = new Set();
    // gol con asistente: una sola tarjeta con los dos (Carlos, 7 nov); el resto de implicados, cada uno la suya
    const qg = quienes.find((q) => ['gol', 'doblete', 'triplete'].includes(q.motivo)), qa = quienes.find((q) => q.motivo === 'asistencia');
    const jg = qg && jugadores.find((x) => String(x.id) === String(qg.jugadorId)), ja = qa && jugadores.find((x) => String(x.id) === String(qa.jugadorId));
    if (t.tipo === 'directo' && jg && ja && String(jg.id) !== String(ja.id)) {
      const x = await datosGolAsistencia(jg, ja, m, { jornada, motivo: qg.motivo, fuentes, marcador: t.marcador || null, minuto: t.minutoTxt || null });
      await hacer(`${t.tipo}-${m.id}-${jg.id}-${ja.id}-golasis`, x, svgGolAsistencia(x.d));
      vistos.add(String(jg.id)); vistos.add(String(ja.id));
    }
    for (const q of quienes.slice(0, 4)) {            // X admite hasta 4 imágenes por tweet
      if (vistos.has(String(q.jugadorId))) continue; vistos.add(String(q.jugadorId));
      const j = jugadores.find((x) => String(x.id) === String(q.jugadorId));
      if (!j) continue;
      const x = await datosJugador(j, m, { jornada, motivo: q.motivo, fuentes, marcador: t.marcador || null, minuto: t.minutoTxt || null });
      await hacer(`${t.tipo}-${m.id}-${j.id}-${q.motivo}`, x, svgJugador(x.d));
    }
  }
  return hechas;
}
