// Novedades de jugadores entre semana (Carlos, 2 nov 23:28): cambios de estado en LaLiga Fantasy de los jugadores que importan
// (media de 4 o más, o 10 M o más de valor): pasa a lesionado, sancionado, o vuelve a estar disponible. Las dudas no salen solas
// (una duda necesita una segunda fuente, regla de Carlos). Compara con el estado guardado en el registro (`estados`, en la rama
// bot-estado); la primera vez solo lo guarda. Fuera de horario (9 a 23 h) no mira nada, así los cambios se acumulan para el día.
import { corto, fmt, partes, sinCierre, elegir } from '../lib/texto.mjs';

const IMPORTA = (j) => Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));

export async function generar({ jugadores, equipos, jornada, config = {}, registro = null, ventanas = true, forzar = false, previos = null, ahora = Date.now(), log = console.log }) {
  const [hD, hH] = config.horasNovedades || [9, 23];
  if (ventanas && !forzar && (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH)) return [];
  const actual = {};
  for (const j of jugadores || []) actual[j.id] = j.playerStatus || 'ok';
  const antes = previos || (registro && registro.datos && registro.datos.estados) || null;
  if (registro && registro.datos) { registro.datos.estados = actual; registro.guardar(); }
  if (!antes) { log('  (novedades) primera vez: guardo los estados y no publico nada'); return []; }
  const eventos = [];
  for (const j of (jugadores || []).filter(IMPORTA)) {
    const a = antes[j.id], b = actual[j.id];
    if (!a || a === b) continue;
    let que = null;
    if (b === 'injured' && a !== 'injured') que = 'lesion';
    else if (b === 'suspended' && a !== 'suspended') que = 'sancion';
    else if (b === 'ok' && ['injured', 'suspended', 'doubtful'].includes(a)) que = 'vuelve';
    if (!que) continue;
    eventos.push({ id: j.id, nombre: j.nickname, equipo: corto(equipos[String(j.teamId)] || '?'), media: Number(j.averagePoints) || 0, que, antes: a });
  }
  if (!eventos.length) return [];
  log(`  (novedades) ${eventos.length} cambios: ${eventos.map((e) => `${e.nombre} ${e.antes}→${e.que}`).join(', ')}`);
  eventos.sort((a, b) => b.media - a.media);
  const linea = (e) => {
    const m = e.media >= 3 ? ` Media de ${fmt(e.media)}.` : '';
    if (e.que === 'lesion') return `🤕 ${e.nombre} (${e.equipo}) aparece como lesionado.${m}`;
    if (e.que === 'sancion') return `🟥 ${e.nombre} (${e.equipo}) aparece como sancionado para la próxima.${m}`;
    return `✅ ${e.nombre} (${e.equipo}) vuelve a estar disponible${e.antes === 'injured' ? ' tras la lesión' : e.antes === 'suspended' ? ' tras cumplir sanción' : ''}.${m}`;
  };
  const out = [];
  let i = 0, k = 0;
  while (i < eventos.length && out.length < 4) {
    const cab = elegir(['🚨 Novedades fantasy', '📰 Última hora fantasy', '🚨 Cambios en LaLiga Fantasy'], `nov${diaMadrid(ahora)}${k}`);
    const resto = eventos.slice(i, i + 5);
    const { usadas, texto } = sinCierre(cab, resto.map(linea));
    if (!usadas.length) break;
    const quienes = resto.slice(0, usadas.length);
    out.push({ tipo: 'novedades', clave: `novedades|${quienes.map((e) => `${e.id}:${e.que}`).join(',')}|${diaMadrid(ahora)}`, jornada, texto,
      numeros: quienes.flatMap((e) => (e.media >= 3 ? partes(e.media) : [])) });
    i += usadas.length; k++;
  }
  return out;
}
